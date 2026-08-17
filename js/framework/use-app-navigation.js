/**
 * 小听框架 - App 导航（Vue 组合）
 * 管理当前打开的 app、页面栈、详情页栈、模态框。
 */
import { createModalState } from './utils.js';
import { createDeepLinkAction } from '../../src/core/actions.js';
import {
    APP_PAGE_CONTENT,
    DETAIL_PAGE_CONTENT,
    externalAppRegistry,
} from '../../src/core/app-registry.js';
import {
    createDefaultDetailRenderer,
    createDefaultPageRenderer,
} from '../../src/core/page-renderers.js';
import { escapeHtml } from '../../src/core/escape.js';
import { modals as presetModals } from '../../src/core/presets/modals.js';
// 栏系统 (Phase 2-3)
import {
    normalizeTopbarConfig,
    normalizeNavConfig,
} from './bar-config-normalizer.js';
import {
    hasCustomRender,
    renderTopbarAsync,
    renderTabbarAsync,
} from './bar-renderer.js';
import {
    createTopbarContext,
    createNavContext,
} from './bar-context.js';

/**
 * resolveAsyncRenderer - 让 renderPage/renderDetailPage 支持 async
 *
 * 背景：很多 App（聊天、设置）需要先 await 读 IndexedDB 再拼 HTML。
 *      Vue 的 computed 不能直接 await，所以这里统一处理：
 *      - 如果返回 Promise：第一次返回 loading HTML，Promise 完成后写入 cache + ++tick
 *      - 第二次 computed 重算时（tick 变了但 cacheKey 没变），命中 cache 直接返回
 *      - 如果 renderer 返回字符串：直接返回
 *
 * 业务侧更新数据后想重新渲染时，调：
 *      window.__invalidateRendererCache(appId, pageId)
 *      或
 *      invalidateRendererCache(appId, pageId)
 *
 * ★ cache 失效策略：cacheValue 是 { tick, html }，只有当 tick 不变时才算命中。
 *   tick++（window.__detailRenderTick.value++）是业务方主动通知「我改了 state，给我重渲」的信号。
 *   没有这个机制的话，业务方直接 mutate app.state（plain object,Vue 不可感知）时，
 *   即便 currentDetailView 被 invalidate 触发重算，renderer 也会命中缓存返回旧 HTML，
 *   导致「点了按钮但 view 没反应」。
 */
// ★ FIX v0.47:改用 Map（WeakMap 无 forEach，invalidateRendererCache 无法清条目）
const _resolvedCache = new Map(); // renderer -> Map<key, { tick, html }>

function resolveAsyncRenderer(renderer, content, page, app, detailRenderTick) {
    if (typeof renderer !== 'function') return '';

    const cacheKey = `${app?.id || ''}::${page?.id || ''}`;
    const currentTick = detailRenderTick && typeof detailRenderTick.value === 'number'
        ? detailRenderTick.value
        : 0;
    let cache = _resolvedCache.get(renderer);
    if (!cache) {
        cache = new Map();
        _resolvedCache.set(renderer, cache);
    }

    // 已经 resolved 过且 tick 没变 → 同步返回缓存值
    const cached = cache.get(cacheKey);
    if (cached && cached.tick === currentTick) {
        return cached.html || '';
    }

    // 第一次调用：调 renderer，看返回的是字符串还是 Promise
    let result;
    try {
        result = renderer(content, page, app);
    } catch (e) {
        console.error('[framework] renderer 抛错:', e);
        const html = `<div style="padding:16px;color:#DC2626;">渲染失败：${String(e?.message || e)}</div>`;
        cache.set(cacheKey, { tick: currentTick, html });
        return html;
    }

    if (result && typeof result.then === 'function') {
        const loadingHtml = '<div class="app-render-loading" style="padding:24px;text-align:center;color:#8E8AA8;font-size:12px;">加载中…</div>';
        cache.set(cacheKey, { tick: currentTick, html: loadingHtml });

        // ★ 关键：Promise resolve 时把 cache 的 tick 预写到 promisedTick (= currentTick + 1)，
        // 这样随后 ++detailRenderTick 触发 Vue 重算时，currentTick 与 cache.tick
        // 才能对齐、命中缓存返回真正的 html，避免死循环（每次重算都看到缓存失效、
        // 再调 renderer → 再 Promise → 再加载中 → 再 ++tick → 永远停在加载中）。
        const promisedTick = currentTick + 1;
        result.then((html) => {
            // ★ cache 用 promisedTick 对齐未来 currentTick,保证下次 Vue 重算时
            // currentTick === promisedTick === cache.tick,命中缓存返回真 html。
            // (之前用 detailRenderTick.value 会有「cache.tick 落后 currentTick 一拍」
            // 的问题 —— 当前代码执行时 detailRenderTick.value 还是 currentTick 旧值,
            // 写进去 cache 后 +1 才让 Vue 重算,结果 cache tick < currentTick,
            // 永远 miss,触发「加载中」死循环)
            cache.set(cacheKey, { tick: promisedTick, html: typeof html === 'string' ? html : '' });
            if (detailRenderTick && typeof detailRenderTick.value === 'number') {
                detailRenderTick.value = Math.max(detailRenderTick.value, promisedTick);
            }
        }).catch((e) => {
            console.error('[framework] async renderer 失败:', e);
            cache.set(cacheKey, { tick: promisedTick, html: `<div style="padding:16px;color:#DC2626;">加载失败：${String(e?.message || e)}</div>` });
            if (detailRenderTick && typeof detailRenderTick.value === 'number') {
                detailRenderTick.value = Math.max(detailRenderTick.value, promisedTick);
            }
        });

        return loadingHtml;
    }

    const str = result || '';
    cache.set(cacheKey, { tick: currentTick, html: str });
    return str;
}

/**
 * 失效 renderer cache（让下一次 computed 重算时重新调 renderer）
 * 业务侧更新 IndexedDB 数据后调用，确保新数据能渲染出来
 *
 * 2026-08 修正：
 * - 不再顺手调 window.refreshPhoneApps()（之前会触发整个桌面重渲染，
 *   调用方只是想重画一个 detail 页时被迫承担整个桌面的重新计算），
 *   这是 §3.5 沉淀的「API 语义没设计对」问题。
 * - 调完 invalidateRendererCache 后，业务方再显式调
 *   window.__appRendererBridge?.syncNow?.({ force: true }) 即可触发重画。
 */
export function invalidateRendererCache(appId, pageId) {
    // 遍历所有 renderer，清掉对应 cacheKey
    // ★ v0.61.7:pageId 传 null/undefined 时,清整个 app 的所有 detail 缓存
    //   - 业务场景:detail pageId 包含动态 segment(如 prompt-manager-ai0-calendar),
    //     业务方不知道完整 pageId,只能按 app 清全部
    _resolvedCache.forEach((cache) => {
        for (const key of cache.keys()) {
            if (!pageId) {
                if (key.startsWith(`${appId}::`)) cache.delete(key);
            } else if (key === `${appId}::${pageId}`) {
                cache.delete(key);
            }
        }
    });
    // tick++ 触发 computed 重算（仅依赖 detailRenderTick 的视图会刷新）
    if (typeof window !== 'undefined' && window.__detailRenderTick) {
        window.__detailRenderTick.value += 1;
    }
    // ★ 2026-08 移除：refreshPhoneApps() 不再顺手触发
    //   业务方若需要刷新桌面，自己调 window.refreshPhoneApps?.()
}

/**
 * 2026-08 新增：组合 invalidateRendererCache + bridge.syncNow，替代
 * 业务代码里的「二段式」。保留旧函数名做兼容（内部转调 requestRerender）。
 *
 * ```js
 * // 推荐写法
 * window.__requestAppRerender?.('my-app', null);
 * ```
 */
export function requestAppRerender(appId, pageId) {
    invalidateRendererCache(appId, pageId);
    try {
        window.__appRendererBridge?.syncNow?.({ force: true });
    } catch (_) {}
}

// 挂到 window 方便业务侧调用
if (typeof window !== 'undefined') {
    window.invalidateRendererCache = invalidateRendererCache;
    window.__requestAppRerender = requestAppRerender;
}

export function useAppNavigation({ apps, island, createModalState: createModalStateArg, resetCardState }) {
    const activeAppId = Vue.ref('');
    const activeRootPageId = Vue.ref('');
    const detailPageStack = Vue.ref([]);
    const appViewMode = Vue.ref('full');
    // 兼容旧调用：createModalState() 可以来自参数也可以来自 utils
    const makeModal = typeof createModalStateArg === 'function' ? createModalStateArg : createModalState;
    const appModal = Vue.ref(makeModal());

    // 给「app 直接 mutate plain-object 的 state」用的滴答计数器：
    // 任何 app 业务方法需要强制重渲当前 detail view，递增这个 ref 即可（通过 window.__detailRenderTick）。
    // currentDetailView 会因为读取它的 .value 而被自动追踪。
    const detailRenderTick = Vue.ref(0);
    if (typeof window !== 'undefined') {
        window.__detailRenderTick = detailRenderTick;
    }

    const activeApp = Vue.computed(() => apps.value.find(app => app.id === activeAppId.value) || null);
    const appPages = Vue.computed(() => Array.isArray(activeApp.value?.pages) ? activeApp.value.pages : []);
    const navigationPages = Vue.computed(() => appPages.value.filter(page => page && page.type !== 'detail' && page.nav !== false));
    const activeAppNavType = Vue.computed(() => {
        if (navigationPages.value.length <= 1) {
            return 'none';
        }
        return activeApp.value?.nav?.type || 'tab';
    });
    const showAppNav = Vue.computed(() => !isInDetailPage.value && activeAppNavType.value !== 'none');
    const isInDetailPage = Vue.computed(() => detailPageStack.value.length > 0);
    // ★ showAppTopbar：参考合并后的 activeAppTopbar（含 page 级覆盖），而非全局 app.topbar
    const showAppTopbar = Vue.computed(() => !isInDetailPage.value && activeAppTopbar.value?.visible !== false);
    // ★ mutable ref：app 可通过 window.__appTopbarOverride 临时覆盖 pill 文本/点击
    const appTopbarOverride = Vue.ref(null);
    // ★ v2 协议：优先取 currentRootPage.topbar（支持页面级 topbar），
    //   再 fallback 到 app.topbar（向后兼容全局 topbar）
    const activeAppTopbar = Vue.computed(() => {
        // currentRootPage 在下方定义，这里内联计算
        const currentPage = activeApp.value
            ? navigationPages.value.find(page => page.id === activeRootPageId.value) || navigationPages.value[0]
            : null;
        const pageTopbar = currentPage?.topbar;
        const appTopbar = activeApp.value?.topbar || null;
        const ov = appTopbarOverride.value;
        // 合并：pageTopbar 有值则以此为准，无则 fallback 到 appTopbar
        // 这样 page.topbar 的所有字段（包括 showPill:false）都会生效
        const base = pageTopbar ? { ...appTopbar, ...pageTopbar } : appTopbar;
        if (!ov) return base;
        // ★ v0.28 fix:如果 page 显式设置 visible:false，override 的 headerActions 不应该覆盖它
        //   （否则「通讯录/新建聊天」等页面切换过来时，mode-toggle 按钮会错误地出现）
        if (base && base.visible === false) {
            return base;
        }
        // ★ v0.28 fix:如果 page 自身已声明 headerActions，不应用 override 的 headerActions
        //   （contacts/new-chat 等页面有自己的 topbar，不想被 messages 的 mode-toggle 按钮污染）
        //   但 **title / subtitle 等其他字段**仍然允许 override 注入（v0.37：让 story mode 改 "消息"→"Dream"）
        if (base && base.headerActions && base.headerActions.length > 0) {
            const { headerActions: _ignored, ...restOverride } = ov;
            return { ...(base || {}), ...restOverride };
        }
        return { ...(base || {}), ...ov };
    });
    // activeAppTitle / activeAppSubtitle 跟随 activeAppTopbar 变化，无需单独改
    const activeAppTitle = Vue.computed(() => activeAppTopbar.value?.title || activeApp.value?.name || '');
    const activeAppSubtitle = Vue.computed(() => activeAppTopbar.value?.subtitle || '');
    const topbarStyle = Vue.computed(() => {
        const t = activeAppTopbar.value;
        if (!t) return {};
        const style = {};
        if (typeof t.fontSize === 'number') style.fontSize = t.fontSize + 'px';
        if (typeof t.fontWeight === 'number') style.fontWeight = t.fontWeight;
        if (typeof t.titleSize === 'number') style['--topbar-title-size'] = t.titleSize + 'px';
        if (t.bg) style.background = t.bg;
        if (t.color) style.color = t.color;
        if (t.titleColor && t.titleColor !== 'auto') style.color = t.titleColor;
        return style;
    });
    /**
     * 底栏样式。
     *
     * `bar-config-normalizer` 从一开始就声明了 nav 的 bg / color / height，
     * 但**没有任何代码读它们** —— App 照着 schema 写了，运行时一点变化都没有。
     * 这类「schema 说有、实现里没有」的字段比缺字段更糟：作者会以为是自己写错了。
     *
     * 值通过 CSS 变量下发（见 css/core/50-app-shell.css 的 .app-tab-bar），
     * 而不是直接写 background —— 因为 tab 项的前景色也要跟着变，
     * 直接写 style 只能覆盖容器那一层。
     */
    const navStyle = Vue.computed(() => {
        const n = activeApp.value?.nav;
        if (!n) return {};
        const style = {};
        if (n.bg) style['--tabbar-bg'] = n.bg;
        if (n.borderColor) style['--tabbar-border'] = n.borderColor;
        if (typeof n.height === 'number') style['--tabbar-height'] = `${n.height}px`;
        if (n.color) {
            // 未选中的 tab 用同色系的淡版本：只给一个 color 就能同时管住两态，
            // App 不用为「选中」「未选中」各配一个颜色
            style['--tabbar-color'] = `color-mix(in srgb, ${n.color} 52%, transparent)`;
            style['--tabbar-active-color'] = n.color;
        }
        if (n.activeColor) style['--tabbar-active-color'] = n.activeColor;
        return style;
    });
    const activeAppBackgroundStyle = Vue.computed(() => {
        // 依赖 detailRenderTick：weather-app 等业务代码可在切换 detailCity
        // 时 ++detailRenderTick.value，强制本样式在依赖动态背景时重算。
        void detailRenderTick.value;
        const app = activeApp.value;
        if (!app) {
            return { background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' };
        }
        // 优先用 app.getBackground(state) 钩子：让 App 在 detail / 路由场景下
        // 返回条件背景（如天气 App 跟随当前 detailCity 的 condition 渐变）。
        // 第二个参数传当前 active root page id —— 部分 App（如 chat-app 的
        // 故事模式）需要区分「哪个 tab 处于激活态」,只在特定 tab 返回条件背景。
        let bg = null;
        if (typeof app.getBackground === 'function') {
            try { bg = app.getBackground(app.state, activeRootPageId.value); } catch (_) { /* 静默，回退 */ }
        }
        return {
            background: bg || app.background || app.color || 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)'
        };
    });
    /**
     * v0.29：状态栏 / nav bar 视觉一体（解决"视觉断层"）。
     *
     * 当 App 的背景是"非透明"（如天气 App 的渐变、prompt-survey 的彩色卡）时，
     * 状态栏和 nav bar 不应该悬浮在墙纸色上 —— 应该用**白字**与背景融为一体。
     * 顶栏视觉断层的术语 / 修复方向详见 `待办/框架顶栏视觉断断层问题.md`。
     *
     * 优先级（从高到低）：
     *   1. App 用 `topbar.color` / `statusBarColor` 自己声明
     *   2. App 暴露 `getBackground(state)` 返回了**非 transparent** 的背景
     *      → 默认白字（用户视觉上背景肯定是亮色才需要白字）
     *   3. 兜底黑字（iOS 默认）
     */
    const currentStatusBarColor = Vue.computed(() => {
        const app = activeApp.value;
        if (!app) return '#111827';
        if (app.statusBarColor) return app.statusBarColor;
        const topbar = activeAppTopbar.value;
        if (topbar?.color) return topbar.color;
        // detail 页 / App 声明了动态背景 → 状态栏默认白，与背景一体
        if (typeof app.getBackground === 'function') return '#ffffff';
        return '#111827';
    });
    const currentRootPage = Vue.computed(() => {
        if (!activeApp.value) return null;
        return navigationPages.value.find(page => page.id === activeRootPageId.value) || navigationPages.value[0] || null;
    });
    const currentPageContent = Vue.computed(() => {
        if (!activeApp.value || !currentRootPage.value) {
            return null;
        }
        return APP_PAGE_CONTENT[activeApp.value.id]?.[currentRootPage.value.id] || null;
    });
    const currentPageView = Vue.computed(() => {
        void detailRenderTick.value;
        if (!activeApp.value || !currentRootPage.value) {
            return '';
        }
        // hybrid / vue 模式：framework 的 v-html 交给 bridge 的 mountInto 处理，
        // 这里返回空串避免 [object Object] 出现在 v-html 里跟 Vue.createApp 冲突。
        const mode = activeApp.value.renderMode || 'template';
        if (mode === 'hybrid' || mode === 'vue') {
            return '';
        }
        const renderer = activeApp.value.renderPage || createDefaultPageRenderer;
        // ★ 支持 async renderer：如果 renderer 返回 Promise，自动 await 并触发重渲染
        return resolveAsyncRenderer(renderer, currentPageContent.value, currentRootPage.value, activeApp.value, detailRenderTick);
    });
    const currentDetailPage = Vue.computed(() => {
        if (!detailPageStack.value.length) return null;
        return detailPageStack.value[detailPageStack.value.length - 1];
    });
    const currentDetailContent = Vue.computed(() => currentDetailPage.value ? DETAIL_PAGE_CONTENT[currentDetailPage.value.id] || null : null);
    const currentDetailTitle = Vue.computed(() => currentDetailContent.value?.title || currentDetailPage.value?.title || '详情');
    const currentDetailSubtitle = Vue.computed(() => currentDetailContent.value?.subtitle || currentDetailPage.value?.subtitle || '');
    const currentDetailView = Vue.computed(() => {
        // 读取 detailRenderTick.value 让 Vue 跟踪它 —— 业务代码 ++ 这个 ref 即可强制本视图重渲。
        void detailRenderTick.value;
        if (!activeApp.value || !currentDetailPage.value) {
            return '';
        }
        const mode = activeApp.value.renderMode || 'template';
        const renderer = activeApp.value.renderDetailPage || createDefaultDetailRenderer;
        // ★ 支持 async renderer
        return resolveAsyncRenderer(renderer, currentDetailContent.value, currentDetailPage.value, activeApp.value, detailRenderTick);
    });
    // statusBarStyle / currentStatusBarColor 已在上面定义（v0.29 视觉断层修复）。
    const statusBarStyle = Vue.computed(() => ({
        color: currentStatusBarColor.value
    }));

    // ---- 状态栏细分字段（从 settings app 的 reactive 桥读取）----
    // 注意：window.__phoneStatusBarConfig 在 theme-bridge 模块加载时才会创建
    // （晚于 framework bootstrap）。如果 computed 第一次求值时 cfg 还没创建，
    // 它会因为 `!cfg` 短路而**丢失响应式依赖** —— 后续 cfg 内容变了 computed
    // 也永远不会重算。
    // 解决方案：
    //   1. 加一个 `statusBarConfigVersion` ref，每次 theme-bridge 调用
    //      syncStatusBarConfig() 都会 dispatch `settings:statusbar-updated` 事件，
    //      这里递增 version，强制依赖它的 computed 重算。
    //   2. computed 内部读 `version.value` 把这个 ref 当作必追踪的依赖建立连接。
    const statusBarConfigVersion = Vue.ref(0);
    function bumpStatusBarConfigVersion() {
        statusBarConfigVersion.value = statusBarConfigVersion.value + 1;
    }
    function getStatusBarConfig() {
        return typeof window !== 'undefined' ? window.__phoneStatusBarConfig : null;
    }
    if (typeof window !== 'undefined') {
        window.addEventListener('settings:statusbar-updated', bumpStatusBarConfigVersion);
    }

    const statusBarVisible = Vue.computed(() => {
        // 主动追踪 statusBarConfigVersion，让"late-bind"和"同步刷新"都能驱动重算
        const version = statusBarConfigVersion.value;
        void version;
        const cfg = getStatusBarConfig();
        return !cfg || cfg.showStatusBar !== false;
    });
    // 时间 / 信号 / 5G 的显隐已统一到 showStatusBar 一个开关，不再单独控制。
    const currentTimeColor = Vue.computed(() => {
        void statusBarConfigVersion.value;
        const cfg = getStatusBarConfig();
        const v = cfg?.statusBarTimeColor;
        return (typeof v === 'string' && v) ? v : currentStatusBarColor.value;
    });
    // 信号格已移除（2026-08-13），currentSignalColor 一并删除。
    const currentFiveGColor = Vue.computed(() => {
        void statusBarConfigVersion.value;
        const cfg = getStatusBarConfig();
        const v = cfg?.statusBarFiveGColor;
        return (typeof v === 'string' && v) ? v : currentStatusBarColor.value;
    });
    const currentFiveGLabel = Vue.computed(() => {
        void statusBarConfigVersion.value;
        const cfg = getStatusBarConfig();
        const v = cfg?.statusBarFiveGLabel;
        return (typeof v === 'string' && v) ? v : '5G';
    });

    function getDefaultRootPageId(app) {
        if (!app) {
            return '';
        }
        const pages = Array.isArray(app.pages) ? app.pages.filter(page => page && page.type !== 'detail' && page.nav !== false) : [];
        return app.defaultRootPageId || (pages[0] && pages[0].id) || '';
    }

    function normalizeAction(action) {
        if (!action) {
            return null;
        }
        // 处理 URI 编码的 action（wvAction 使用 encodeURIComponent）
        if (typeof action === 'string' && action.includes('%')) {
            try {
                action = decodeURIComponent(action);
            } catch (_) {}
        }
        if (typeof action === 'string') {
            // ★ 容错剥离:有人写过 data-app-action='{"action":...}' 这种把完整
            //   属性串塞进 dataset.value 的历史写法,需要裁掉首尾 'data-app-action=' 和 尾随 "'。
            const nestedPrefix = "data-app-action='";
            if (action.startsWith(nestedPrefix) && action.endsWith("'")) {
                action = action.slice(nestedPrefix.length, -1);
            }
            try {
                return JSON.parse(action);
            } catch (err) {
                if (typeof console !== 'undefined') {
                    console.warn('[normalizeAction] JSON.parse failed:', err.message, 'raw=', JSON.stringify(action));
                }
                return null;
            }
        }
        return action;
    }

    async function handleContentCardAction(normalizedAction) {
        const targetAppId = normalizedAction.targetAppId || '';
        const targetApp = externalAppRegistry.getApp(targetAppId);
        if (!targetApp) {
            presetModals.toast('对应的 App 还没有安装', { type: 'warning' });
            return;
        }

        const payload = normalizedAction.payload || {};
        const title = payload.confirmTitle || '查看这条内容？';
        const message = payload.confirmMessage
            || (payload.title ? `将打开「${payload.title}」的详情。` : '确认后才会生成并打开详情，不确认不会调用 API。');
        const confirmed = await presetModals.confirm({
            title,
            message,
            okLabel: payload.confirmLabel || '确认查看',
            cancelLabel: payload.cancelLabel || '暂不查看',
        });
        if (!confirmed) return;

        const closeLoading = presetModals.toast('正在准备内容…', { duration: 15000 });
        try {
            const request = {
                sourceAppId: normalizedAction.appId || activeAppId.value,
                targetAppId,
                entityType: normalizedAction.entityType || '',
                entityId: normalizedAction.entityId || '',
                payload,
            };
            const resolved = await externalAppRegistry.invokeService(targetAppId, 'contentCards', request);
            if (resolved?.ok === false) {
                await presetModals.alert({
                    title: '暂时打不开',
                    message: resolved.error || '内容准备失败，请稍后再试。',
                });
                return;
            }

            const pageId = resolved?.pageId || normalizedAction.pageId || payload.pageId || '';
            const pageType = resolved?.pageType || payload.pageType || 'detail';
            const nextPayload = {
                ...payload,
                ...(resolved?.payload || {}),
                entityType: normalizedAction.entityType || '',
                entityId: normalizedAction.entityId || '',
            };

            openApp(targetAppId);
            if (pageId) {
                if (pageType === 'root') switchRootPage(pageId);
                else openDetailPage(targetAppId, pageId, nextPayload);
            }
        } catch (err) {
            console.error('[content-card] 打开失败', err);
            await presetModals.alert({
                title: '暂时打不开',
                message: err?.message || String(err),
            });
        } finally {
            closeLoading();
        }
    }

    async function handlePageAction(action) {
        const normalizedAction = normalizeAction(action);
        if (!normalizedAction) {
            return;
        }

        if (normalizedAction.action === 'detail') {
            openDetailPage(normalizedAction.appId || activeAppId.value, normalizedAction.pageId, normalizedAction.payload);
            return;
        }

        if (normalizedAction.action === 'modal') {
            // chat-component 类型：component/props/callbacks 直接在 action 根级别
            if (normalizedAction.modalType === 'chat-component') {
                openModal('chat-component', normalizedAction);
            } else {
                openModal(normalizedAction.modalType, normalizedAction.payload || {});
            }
            return;
        }

        if (normalizedAction.action === 'switchPage') {
            switchRootPage(normalizedAction.pageId);
            return;
        }

        if (normalizedAction.action === 'openApp') {
            const targetAppId = normalizedAction.targetAppId || normalizedAction.appId;
            openApp(targetAppId);
            if (normalizedAction.pageId) {
                if (normalizedAction.pageType === 'detail') {
                    openDetailPage(targetAppId, normalizedAction.pageId, normalizedAction.payload);
                } else {
                    switchRootPage(normalizedAction.pageId);
                }
            }
            return;
        }

        if (normalizedAction.action === 'deepLink') {
            const targetAppId = normalizedAction.targetAppId || normalizedAction.appId;
            openApp(targetAppId);
            if (normalizedAction.pageId) {
                if (normalizedAction.pageType === 'detail') {
                    openDetailPage(targetAppId, normalizedAction.pageId);
                } else {
                    switchRootPage(normalizedAction.pageId);
                }
            }
            if (normalizedAction.payload) {
                externalAppRegistry.invokeService(targetAppId, 'handleDeepLink', normalizedAction.payload);
            }
            return;
        }

        if (normalizedAction.action === 'contentCard') {
            await handleContentCardAction(normalizedAction);
            return;
        }

        if (normalizedAction.action === 'shareRecord') {
            const sourceAppId = normalizedAction.appId || activeAppId.value;
            await externalAppRegistry.shareRecord(sourceAppId, {
                targetApp: normalizedAction.targetAppId || '',
                entityType: normalizedAction.entityType,
                entityId: normalizedAction.entityId,
                title: normalizedAction.payload?.title || '',
                summary: normalizedAction.payload?.summary || '',
                cover: normalizedAction.payload?.cover || '',
                payload: normalizedAction.payload || {},
                pageId: normalizedAction.pageId || '',
                action: normalizedAction.payload?.action || createDeepLinkAction(
                    normalizedAction.targetAppId || sourceAppId,
                    normalizedAction.pageId || '',
                    normalizedAction.payload || {}
                ),
                tags: normalizedAction.payload?.tags || [],
            });
            return;
        }

        if (normalizedAction.action === 'appMethod') {
            const appId = normalizedAction.appId || activeAppId.value;
            const methodName = normalizedAction.method;
            const payload = normalizedAction.payload;
            const targetApp = externalAppRegistry.getApp(appId);
            const hasMethod = !!(targetApp?.methods?.[methodName]);
            if (methodName) {
                // await Promise 返回值，防止 async 方法被丢弃
                if (hasMethod) await externalAppRegistry.invokeMethod(appId, methodName, payload);
            }
        }
    }

    function handleAppContentClick(event) {
        const actionElement = event.target.closest('[data-app-action]');
        if (!actionElement) {
            return;
        }
        void handlePageAction(actionElement.dataset.appAction);
    }

    function handleExternalPageAction(event) {
        void handlePageAction(event?.detail);
    }

    window.addEventListener('app:page-action', handleExternalPageAction);
    window.addEventListener('music:page-action', handleExternalPageAction);

    Vue.onBeforeUnmount(() => {
        window.removeEventListener('app:page-action', handleExternalPageAction);
        window.removeEventListener('music:page-action', handleExternalPageAction);
    });

    function openApp(appId) {
        const app = apps.value.find(item => item.id === appId);
        if (!app) {
            return;
        }
        activeAppId.value = app.id;
        activeRootPageId.value = getDefaultRootPageId(app);
        detailPageStack.value = [];
        appModal.value = makeModal();
        appViewMode.value = 'full';
        resetCardState();
        // ★ 跨 App 切换必清掉 override:前一个 App 的 headerActions / title 注入
        //   (如 chat-app 的 mode-toggle 按钮)不能泄漏到当前 App 的顶栏
        //   修复前:chat 在 story mode 时切到 music,music 顶栏会出现 chat 的 toggleRecordMode 按钮 + "Dream" 标题
        //   修复后:每次开新 App 都从干净状态开始
        appTopbarOverride.value = null;

        // 告诉 App「你被打开了」。
        // 框架本身已经把 rootPage / detailStack / modal 都重置成干净状态了，
        // 但 App 自己那些「会话级 UI 偏好」（比如 murmur 的日历/故事模式）
        // 框架并不知道，只能由 App 自己在这个事件里归位。
        // 没有这个事件的话，App 只能靠 renderPage 猜「这次是不是新打开的」——
        // 而 renderPage 每次重画都会跑，分不出来。
        try {
            window.dispatchEvent(new CustomEvent('phone:app-opened', { detail: { appId: app.id } }));
        } catch (_) { /* 事件失败不该挡住开 App */ }
    }

    function closeApp() {
        const closedId = activeAppId.value;
        activeAppId.value = '';
        activeRootPageId.value = '';
        detailPageStack.value = [];
        appModal.value = makeModal();
        appViewMode.value = 'full';
        resetCardState();
        // 关闭 App 时一并清掉 override(虽然顶层顶栏会被隐藏,但保持 clean state)
        appTopbarOverride.value = null;

        // 跟 openApp 的 phone:app-opened 成对。
        // App 自己那些「会话级 UI 偏好」除了在打开时归位，关闭时也该归位 ——
        // 只挂 open 的话，「退到桌面停一会儿再进来」这条路径依赖的还是同一次 open，
        // 中间但凡有别的入口（卡片模式恢复之类）绕过 openApp 就会漏。
        if (closedId) {
            try {
                window.dispatchEvent(new CustomEvent('phone:app-closed', { detail: { appId: closedId } }));
            } catch (_) { /* 事件失败不该挡住关 App */ }
        }
    }

    function switchRootPage(pageId) {
        if (!activeApp.value) {
            return;
        }
        const targetPage = navigationPages.value.find(page => page.id === pageId);
        if (!targetPage) {
            return;
        }
        const prevPageId = activeRootPageId.value;
        activeRootPageId.value = pageId;
        detailPageStack.value = [];
        // ★ v0.28 fix:切换离开 messages tab 时清掉 override（防止 mode-toggle 按钮泄漏到其他页面）
        if (prevPageId === 'messages' && pageId !== 'messages') {
            appTopbarOverride.value = null;
        }
        // ★ v0.37 修复:之前直接调 buildMessagesHeaderActions() 会 ReferenceError(framework 不该依赖具体 app 的内部函数)
        //   现在改为派发通用事件,由具体 app(如 chat)在 hydrate 时订阅并按需更新 override
        try {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('app:rootpage-changed', {
                    detail: { from: prevPageId, to: pageId, appId: activeApp.value?.id },
                }));
            }
        } catch (_) {}
    }

    function openDetailPage(appId, pageId, payload) {
        if (activeAppId.value !== appId || !pageId) {
            return;
        }
        // payload 会被 renderDetailPage 的 content 参数接收到
        detailPageStack.value = [...detailPageStack.value, { id: pageId, payload }];
    }

    function closeDetailPage() {
        if (detailPageStack.value.length > 0) {
            const newStack = detailPageStack.value.slice(0, -1);
            detailPageStack.value = newStack;
        }
    }

    // chat-component 弹窗的回调存储
    let _chatComponentCallbacks = null;
    let _chatComponent = null;
    let _chatComponentProps = null;

    function openModal(type, payload) {
        // chat-component 类型：组件/props/callbacks 直接在 payload 里（不是嵌套在 payload.xxx）
        if (type === 'chat-component') {
            _chatComponentCallbacks = payload?.callbacks || null;
            _chatComponent = payload?.component || null;
            _chatComponentProps = payload?.props || {};
            appModal.value = {
                visible: true,
                type: 'chat-component',
                component: _chatComponent,
                props: _chatComponentProps,
            };
            return;
        }

        appModal.value = {
            visible: true,
            type: type || 'center',
            title: payload?.title || '弹窗',
            text: payload?.text || '',
            content: payload?.content || '', // HTML 内容（用于 prompt 类型）
            placeholder: payload?.placeholder || '',
            danger: payload?.danger === true,
            confirmLabel: payload?.confirmLabel || '确定',
            cancelLabel: payload?.cancelLabel || '取消',
            onConfirm: typeof payload?.onConfirm === 'function' ? payload.onConfirm : null,
        };
    }

    function confirmAppModal() {
        const callback = appModal.value.onConfirm;
        // 如果是 prompt 类型，获取输入框的值
        let inputValue = '';
        if (appModal.value.type === 'prompt') {
            const textarea = document.querySelector('.app-modal-prompt-input');
            inputValue = textarea?.value?.trim() || '';
        } else if (appModal.value.type === 'image-picker') {
            // 图片发送弹窗：获取图片描述
            const textarea = document.querySelector('.image-picker-input');
            inputValue = textarea?.value?.trim() || '';
        }
        appModal.value = makeModal();
        _chatComponentCallbacks = null;
        if (typeof callback === 'function') {
            try { callback(inputValue); } catch (err) { console.error('[app-modal] onConfirm 执行失败', err); }
        }
    }

    function closeModal() {
        appModal.value = makeModal();
        _chatComponentCallbacks = null;
        // ★ 同时清空 chat-component 内部引用,避免下一次 _dispatch 时
        //   `:is` 引用同一个 component 对象 → Vue 触发 update 而非重新 mount → 报
        //   「r.update is not a function」(组件已 destroyed 但 patch 还在跑)。
        _chatComponent = null;
        _chatComponentProps = null;
    }

    // ================================================================
    // 栏自定义渲染（Phase 3: 彻底自定义支持）
    // ================================================================

    /**
     * 获取当前顶栏的渲染模式
     * @returns {'default'|'custom'}
     */
    function getTopbarRenderMode() {
        const config = activeAppTopbar.value;
        if (!config) return 'default';
        return hasCustomRender(config) ? 'custom' : 'default';
    }

    /**
     * 获取当前底栏的渲染模式
     * @returns {'default'|'custom'}
     */
    function getNavRenderMode() {
        const config = activeApp.value?.nav;
        if (!config) return 'default';
        return hasCustomRender(config) ? 'custom' : 'default';
    }

    /**
     * 获取顶栏上下文（供自定义 render 使用）
     * @returns {object}
     */
    function getTopbarContext() {
        const app = activeApp.value;
        const config = activeAppTopbar.value;
        if (!app || !config) return null;

        const normalizedConfig = normalizeTopbarConfig(config);

        return createTopbarContext({
            app,
            state: app.state || {},
            topbar: config,
            appId: app.id,
            pageId: activeRootPageId.value,
            handleAction,
            t: (key) => key, // i18n placeholder
            escapeHtml,
            normalizedConfig,
        });
    }

    /**
     * 获取底栏上下文（供自定义 render 使用）
     * @returns {object}
     */
    function getNavContext() {
        const app = activeApp.value;
        const config = app?.nav;
        if (!app || !config) return null;

        const normalizedConfig = normalizeNavConfig(config);

        // 获取当前激活的按钮 ID
        const activePageId = activeRootPageId.value;
        const activePage = navigationPages.value.find(p => p.id === activePageId);
        const activeButtonId = activePage?.id || '';

        return createNavContext({
            app,
            state: app.state || {},
            nav: config,
            appId: app.id,
            activePageId,
            handleAction,
            t: (key) => key, // i18n placeholder
            escapeHtml,
            normalizedConfig,
        });
    }

    /**
     * 渲染自定义顶栏（供模板调用）
     * @returns {Promise<string>} HTML 字符串
     */
    async function renderCustomTopbar() {
        const config = activeAppTopbar.value;
        if (!config || config.visible === false) {
            return '';
        }

        const context = getTopbarContext();
        return await renderTopbarAsync({
            config,
            appId: activeApp.value?.id || '',
            context,
        });
    }

    /**
     * 渲染自定义底栏（供模板调用）
     * @returns {Promise<string>} HTML 字符串
     */
    async function renderCustomTabbar() {
        const config = activeApp.value?.nav;
        if (!config || config.type === 'none') {
            return '';
        }

        const context = getNavContext();
        const activePageId = activeRootPageId.value;

        return await renderTabbarAsync({
            config,
            appId: activeApp.value?.id || '',
            activeButtonId: activePageId,
            context,
        });
    }

    /**
     * 触发 chat-component 弹窗的事件回调
     * 由 Vue 组件在适当时候调用
     */
    function emitChatComponentEvent(eventName, ...args) {
        if (_chatComponentCallbacks && typeof _chatComponentCallbacks[eventName] === 'function') {
            try {
                _chatComponentCallbacks[eventName](...args);
            } catch (err) {
                console.error(`[app-modal] chat-component callback ${eventName} 执行失败`, err);
            }
        } else {
            console.warn('[emitChatComponentEvent] no callback for', eventName, 'callbacks:', _chatComponentCallbacks);
        }
    }

    return {
        activeAppId,
        activeRootPageId,
        detailPageStack,
        appViewMode,
        appModal,
        activeApp,
        navigationPages,
        activeAppNavType,
        showAppNav,
        showAppTopbar,
        activeAppTitle,
        activeAppSubtitle,
        activeAppTopbar,
        topbarStyle,
        navStyle,
        activeAppBackgroundStyle,
        currentPageContent,
        currentPageView,
        currentDetailContent,
        currentDetailTitle,
        currentDetailSubtitle,
        currentDetailView,
        currentDetailPage,
        detailRenderTick,
        currentStatusBarColor,
        statusBarStyle,
        // 状态栏细分（由 settings app 同步到 window.__phoneStatusBarConfig）
        statusBarVisible,
        currentTimeColor,
        currentFiveGColor,
        currentFiveGLabel,
        handlePageAction,
        handleAppContentClick,
        openApp,
        closeApp,
        switchRootPage,
        openDetailPage,
        closeDetailPage,
        appTopbarOverride,
        openModal,
        closeModal,
        confirmAppModal,
        emitChatComponentEvent,
        // 栏自定义渲染（Phase 3）
        getTopbarRenderMode,
        getNavRenderMode,
        getTopbarContext,
        getNavContext,
        renderCustomTopbar,
        renderCustomTabbar,
    };
}