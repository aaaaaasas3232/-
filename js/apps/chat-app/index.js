/**
 * chat-app / 工厂函数
 *
 * 当前 phase:Phase 11 — 多页面 UI 复原(消息列表/动态/个人/通讯录)
 *
 * 样式注入(css/apps/chat/index.css):
 *   - 通过 index.html `<link rel="stylesheet" href="/css/apps/chat/index.css?v=1" />` 引入
 *   - 与项目其他 app(weather-app.css / appstore.css / survey.css)风格一致
 *   - 白底 tab-bar,蓝灰 icon/stroke
 *   - :has() + nth-child 定位滑动指示器(纯 CSS,无需 JS)
 *   - ::after + animation 实现点击波纹
 * 切换逻辑:framework .app-tab-bar 原生处理,无需业务代码介入。
 */

import { renderMessagesPage } from './pages/messages-page.js';
import { renderContactsPage } from './pages/contacts-page.js';
import { renderMomentsPage } from './pages/moments-page.js';
import { renderProfilePage, getCurrentChatUser, clearUserCache } from './pages/profile-page.js';
import { bootstrapSettingsSdk } from '../setting/world/sdk/bootstrap.js';
import { getSettingsSdk } from '../setting/world/sdk/settings-sdk.js';
import { saveSnapshot, loadSnapshot as loadChatSnapshot } from '../setting/world/sdk/chat-snapshot.js';
import { openAiRemarkModal, triggerPatAction } from './pages/chat-page.js';
// ★ v0.62.x:主动 import api-manager-section 触发 module top-level preload,
//   让 _cacheKeys/_cacheGroups 在 chat-settings 渲染前加载完成,
//   并把所有 label/name 同步写到 localStorage 给 renderChatSettingsPage 兜底
import '../setting/api-manager/api-manager-section.js';

/**
 * 把 snapshot 里的 defaultUser / activeUser 转成 renderProfilePage 期望的 user 形态
 *
 * snapshot 的 user 对象里 chat 配置在 socialProfiles.chat 下(v0.28),
 * nickname / avatar / avatarCode / background 等均从中读取。
 */
function snapshotToProfileUser(snap) {
    const u = snap?.defaultUser || snap?.activeUser;
    if (!u) return null;
    const chatProfile = u.socialProfiles?.chat || {};
    return {
        name: chatProfile.nickname || u.name || '',
        avatar: chatProfile.avatar || u.avatar || '',
        avatarCode: chatProfile.avatarCode || '',
        background: chatProfile.background || '',
        backgroundCode: chatProfile.backgroundCode || '',
        userId: u.id || '',
        balance: 0,
    };
}
import { escapeHtml } from '@/src/core/escape.js';
import { getChatRecordMode, getModeConfig, toggleChatRecordMode } from './chat-mode.js';
import { renderPrivateChatPage } from './pages/chat-page.js';
import { renderGroupChatPage } from './pages/chat-group-page.js';
import { renderVoiceMessageBubble } from './pages/chat-page.js';
import { renderTextBubble } from './components/text-bubble.js';
import { renderChatSettingsPage } from './pages/chat-settings-page.js';
import { renderGroupSettingsPage } from './pages/chat-group-settings-page.js';
import { renderNewChatPage, renderNewChatPageAsync, getWorldAiPersons, getAvatarColor } from './pages/new-chat-page.js';
import { renderNewGroupPage, renderNewGroupPageAsync } from './pages/new-group-page.js';
import { renderCallRecordDetailPage } from './pages/call-record-detail-page.js';
import { renderChatPostPage } from './pages/chat-post-page.js';
import { renderCalendarViewPage, renderCalendarDayPanel, groupMessagesByDate, toDateKey } from './pages/calendar-view-page.js';
import { renderStoryArchivePage } from './pages/story-archive-page.js';
import { renderHistoryPage } from './pages/history-page.js'; // ★ v0.61.3 历史消息页(v0.65 已替换为 memory-history-page)
import { renderPromptManagerPage } from './pages/prompt-manager-page.js';
import { renderMemoryManagementPage } from './pages/memory-management-page.js'; // ★ v0.65 层级管理页
import { renderMemoryHistoryPage } from './pages/memory-history-page.js'; // ★ v0.65 历史消息页(上下结构)
// ★ v0.62.1 AI 服务层:拼 prompt → 调 AI SDK → 解析 [发红包:88:...] 等特殊动作
import { callAiAndSplit, generateKChainSummary } from './services/ai-service.js';
import {
    buildUserPersonaContextText,
    buildAiPersonaContextText,
    defaultReplyNote,
} from './pages/prompt-manager-page.js';
import { renderFavoritesPage } from './pages/favorites-page.js';
import { renderGameSelectorPage } from './pages/game-selector-page.js';
import { renderGameLeaderboardPage } from './pages/game-leaderboard-page.js';
import { renderCallPage } from './pages/call-page.js';
import { chatModalManager, DESC_IMAGE_PRESETS } from './components/chat-modal-registry.js';
import { _getCurrentSummaryEditInstance } from './components/summary-edit-modal.js';
import { DEMO_CONTACTS } from './pages/new-chat-page.js';
import { externalAppRegistry } from '@/src/core/app-registry.js';
// ★ v0.50 回复提示词构造器:暴露到 window.__chatPromptBuilder,后期接 AI SDK 时直接调
import chatPromptBuilder from './services/prompt-builder.js';
// ★ v0.61.2 拖拽控制器(副作用:模块顶层挂 MutationObserver,见 components/prompt-drag-controller.js)
//   导入即生效,无需手动调 init()
import './components/prompt-drag-controller.js';
// ★ v0.61.8 chat-app 自有 island:第三方 App Prompt 预览编辑器
import { registerIslandComponent } from '@/src/core/app-renderer.js';
import { AppPromptPreviewIsland } from './components/app-prompt-preview-island.js';
import { renderAppPromptCardPreview } from './components/app-prompt-card.js';

// ★ v0.50 把 prompt-builder 暴露到 window,方便后期接 AI SDK 时直接调:
//   const prompt = await window.__chatPromptBuilder.build({ aiPersonId, mode });
// 暴露 preview 单独方法,给 prompt-manager 顶部展示 prompt 摘要用
if (typeof window !== 'undefined') {
    window.__chatPromptBuilder = chatPromptBuilder;
}

// ★ v0.61.8.5 暴露 App Prompt 卡片预览渲染函数,供 module-level input 监听器实时重渲染预览卡片
if (typeof window !== 'undefined' && typeof renderAppPromptCardPreview === 'function') {
    window.__renderAppPromptCardPreview = renderAppPromptCardPreview;
}

// ★ v0.61.8 chat-app 自有 island:第三方 App Prompt 预览编辑器
//   - 在 createChatApp() 里注册到 framework
//   - 在 prompt-manager 卡片下方内联展示
const appPromptPreviewIsland = AppPromptPreviewIsland;

// ============================================================
// ★ v0.61.5 第三方 App Prompt 注册 SDK 测试入口 + Demo 注册
//   - window.__appPromptRegistry 直接代理 sdk.appPrompts(便于调试 + dev console 验证)
//   - chat-app 启动时 fire-and-forget 注册一个「音乐分享」demo prompt
//     (如果用户已经装了真正的 music app → 跳过,music app 自己 register)
//   - 不阻塞 chat-app 启动,SDK 未就绪时静默跳过
// ============================================================
if (typeof window !== 'undefined') {
    window.__appPromptRegistry = {
        /** SDK 就绪后再绑定真实 API */
        _bind() {
            const sdk = window.settingsSdk;
            if (!sdk?.appPrompts) return null;
            this.sdk = sdk;
            this.register = (spec) => sdk.appPrompts.register(spec);
            this.unregister = (appId, promptId) => sdk.appPrompts.unregister(appId, promptId);
            this.list = () => sdk.appPrompts.list();
            this.listByApp = (appId) => sdk.appPrompts.listByApp(appId);
            this.get = (appId, promptId) => sdk.appPrompts.get(appId, promptId);
            this.setState = (appId, promptId, patch) => sdk.appPrompts.setState(appId, promptId, patch);
            this.removeState = (appId, promptId) => sdk.appPrompts.removeState(appId, promptId);
            this._registry = sdk.appPrompts._registry;
            this._stateCache = sdk.appPrompts._stateCache;
            return sdk.appPrompts;
        },
    };
    // 监听 SDK ready 事件,绑定测试入口
    const _bindOnReady = () => {
        try {
            const sdk = window.settingsSdk;
            if (sdk?.appPrompts) {
                window.__appPromptRegistry._bind();
            }
        } catch (err) {
            console.warn('[chat-app] __appPromptRegistry bind failed', err);
        }
    };
    window.addEventListener('settings-sdk-ready', _bindOnReady, { once: false });
    // 兜底:SDK 已就绪时立即绑定
    if (window.settingsSdk?.appPrompts) _bindOnReady();

    // ★ v0.61.5 Demo:注册一个「音乐分享」prompt(占位用)
    //   - 仅当系统里没有真正的 music app 时注册(避免重复)
    //   - SDK 未就绪时静默跳过
    const _registerMusicDemo = () => {
        const sdk = window.settingsSdk;
        if (!sdk?.appPrompts) return;
        // 检查是否已有 music app 注册(避免重复)
        const existing = sdk.appPrompts.listByApp('music');
        if (existing.length > 0) return;
        try {
            sdk.appPrompts.register({
                appId: 'music',
                promptId: 'music-share-demo',
                label: '分享音乐卡片',
                content: '当用户请求分享音乐时,使用 [分享音乐:歌名:歌手] 格式输出。示例:[分享音乐:晴天:周杰伦]',
                category: 'special-action',
                previewType: 'music-card',
                previewData: { song: '晴天', artist: '周杰伦', cover: '' },
                defaultActive: true,
                defaultOrder: 10,
            });
        } catch (err) {
            console.warn('[chat-app] music demo register failed', err);
        }
    };
    // 等 SDK ready 后再注册,失败也无所谓(纯 demo)
    const _tryRegisterMusicDemo = () => {
        try { _registerMusicDemo(); } catch (err) {
            console.warn('[chat-app] registerMusicDemo failed', err);
        }
    };
    if (window.settingsSdk?.appPrompts) _tryRegisterMusicDemo();
    else window.addEventListener('settings-sdk-ready', _tryRegisterMusicDemo, { once: true });
}

// ─── 联系人/群组名称映射 ──────────────────────────────

// ============================================================
// ★ v0.36 收藏页搜索框:window 级 input 监听
//   之前 renderDetailPage 内联 addEventListener('input') 会在 v-html 重建后失效。
//   现在改成 module 顶层挂一个 input 委托监听器,只响应带 data-app-search
//   标记的 input(目前 favorites 搜索框独占),其他 input 跳过。
//   监听器内部通过 externalAppRegistry.getApp('chat') 拿到 chat-app 实例,
//   调用 methods.setFavoriteSearchKeyword 更新 in-memory state,
//   然后 __detailRenderTick.value++ 触发 framework 整页重画。
//
//   debounce 100ms:每次按键都重画会卡,合并后只触发最后一次。
// ============================================================

if (typeof window !== 'undefined' && !window.__chatFavoritesSearchListenerInstalled) {
    window.__chatFavoritesSearchListenerInstalled = true;
    let _searchDebounceTimer = null;
    window.addEventListener('input', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.matches('[data-app-search]')) return;
        const value = target.value || '';
        clearTimeout(_searchDebounceTimer);
        _searchDebounceTimer = setTimeout(() => {
            const chatApp = externalAppRegistry.getApp('chat');
            const method = chatApp?.methods?.setFavoriteSearchKeyword;
            if (typeof method === 'function') {
                method({ keyword: value });
            }
        }, 100);
    }, true /* capture: 在 framework 派发前先抓到,避免被 stopPropagation 阻断 */);
}

// ============================================================
// ★ v0.48 MutationObserver 自动绑定私聊交互
//   问题:queueMicrotask 比 mountInto(setTimeout 0)早执行,waitForElement 拿到旧节点绑 listener,
//   然后 rootEl.innerHTML = html 把 DOM 全部替换,listener 跟旧节点一起死。
//   修法:用 MutationObserver 监听整个 document,只要 .chat-private 出现就立刻绑定(此时 innerHTML 已完成)。
// ============================================================
if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined' && !window.__chatPrivateObserverInstalled) {
    window.__chatPrivateObserverInstalled = true;
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                // 检查新增节点自己是否是 .chat-private
                if (node.classList && node.classList.contains('chat-private')) {
                    if (!node.__chatPrivateInteractionsBound) {
                        const chatApp = externalAppRegistry.getApp('chat');
                        chatApp?.methods?.initPrivateChatInteractions?.(node);
                    }
                }
                // 检查新增节点的子树里是否有 .chat-private
                if (node.querySelectorAll) {
                    const subs = node.querySelectorAll('.chat-private');
                    subs.forEach(sub => {
                        if (!sub.__chatPrivateInteractionsBound) {
                            const chatApp = externalAppRegistry.getApp('chat');
                            chatApp?.methods?.initPrivateChatInteractions?.(sub);
                        }
                    });
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('[chat-app] MutationObserver installed for .chat-private');
}

// ============================================================
// ★ v0.50 统一「滚到底部」工具
//   真实聊天软件体验:发完一条消息(图片/语音/文字/位置/红包/转账/表情)后,
//   滚动条必须稳定停在最新一条,不能让用户看到「中间」位置。
//   难点:消息气泡里的图片/语音波形是异步加载的,
//        scrollHeight 在加载完后才会变大,所以同步一次 scrollTop 不够。
//   策略:同步 + requestAnimationFrame(下一帧,等 img 标签 layout 完成)
//        + 200ms 兜底(等 decode 完成/网络图加载)
//   调用方:
//        - init 末尾:scrollToBottomWithRetry(container)  ← 进入页面即滚到底
//        - 每条消息 append 后:scrollToBottomWithRetry(container)  ← 发送后滚到底
//   注意:container 必须是当前 chat root 内的 .chat-messages,
//        不要缓存跨 v-html 的引用(framework 重画时会指向旧节点)。
// ============================================================
function scrollToBottomWithRetry(container) {
    if (!container) return;
    // 1) 同步滚:气泡 append 后立即滚,能解决文字 / sticker / 表情等同步 DOM
    try { container.scrollTop = container.scrollHeight; } catch (_) {}
    // 2) 下一帧再滚:等新加节点的 layout 完成(同步插入的 <img> 此时已有自然高度)
    try {
        requestAnimationFrame(() => {
            try { container.scrollTop = container.scrollHeight; } catch (_) {}
        });
    } catch (_) {}
    // 3) 200ms 兜底:等图片/音频异步加载完后,scrollHeight 才会真正反映最终高度
    setTimeout(() => {
        try { container.scrollTop = container.scrollHeight; } catch (_) {}
    }, 200);
}

// ─── 联系人/群组名称映射 ──────────────────────────────

const CONTACT_NAMES = {
    'ai-1': '小美',
    'ai-2': '小明',
    'ai-3': '小蓝',
    'ai-4': '小红',
    'group-1': '游戏群',
};

/**
 * 获取联系人或群组的名称
 */
function getContactOrGroupName(id, sourceType) {
    if (sourceType === 'group') {
        return CONTACT_NAMES[`group-${id}`] || id;
    }
    return CONTACT_NAMES[`ai-${id}`] || id;
}

/**
 * 短日期格式 (YYYY/MM/DD HH:mm) — 故事存档弹窗副标用
 */
function formatDateShort(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ★ v0.25 framework 级 headerActions:顶栏右侧按钮组(每个按钮塞 svg + 派发 data-app-action,
//   framework 自动补 appId)。
//   mode toggle 按钮的 iconHtml / variant 跟随当前 chatRecordMode 动态变,
//   通过 syncHeaderActionsWithMode() 在切换时调 __appTopbarOverride 更新。
//   ICON 常量必须在 NAV_TABS 之前声明(NAV_TABS 初始化时立即调 buildMessagesHeaderActions,
//   而 const 不会 hoist)。
const ICON_CALENDAR = '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="8" y1="3" x2="8" y2="7"></line><line x1="16" y1="3" x2="16" y2="7"></line></svg>';
const ICON_STORY = '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5l2.4 5 5.5.8-4 3.9.9 5.5L12 15.4 7.2 17.7l.9-5.5-4-3.9 5.5-.8L12 2.5z"/></svg>';
const ICON_SEARCH = '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';

// ★ v0.61.8.11 framework scroll 保留 hook(在 mountInto 之前抓 scrollTop,mountInto 之后恢复)
//
// 时序问题:
//   - 业务方法 toggleReplyPromptActive 等先 setState + invalidate cache + bridge.syncNow
//   - bridge.syncNow 内部 setTimeout(mountInto, 0) → mountInto async → await renderer → rootEl.innerHTML = result
//   - 整个过程跨 N 个微任务/宏任务,scrollTop 会在 rootEl.innerHTML 替换前一刻被框架/浏览器的某些逻辑归零
//   - 业务侧自己设 scrollTop(setTimeout/microtask)抓不到新 .pm-page 的时机
// 解决方案:
//   - 我们把"抓 scrollTop"放在 framework 决定 mountInto 之前(syncRenderer 的 detail 分支)
//   - 把"恢复 scrollTop"放在 framework mountInto 完成之后(async IIFE 的 finally 块)
//   - 这样无论 bridge 内部怎么异步,只要 .pm-page 出现,我们的 rAF + setTimeout 多次重试肯定能追上
//   - 业务代码不再需要调 _preserveScrollAroundTick()(还在,作为兜底)
if (typeof window !== 'undefined') {
    // ★ v0.61.8.11 framework scroll 保留机制
    //
    // 问题:bridge.syncNow 触发 mountInto,async mountInto 替换 rootEl.innerHTML,
    //   .pm-page 这种自接管滚动容器被替换,scrollTop 变 0。
    //   业务代码 setTimeout(restore, X) 时机太早/太晚,追不上。
    //
    // 解决:framework 在 mountInto 完成后,告诉 chat-app 「该 restore 了」,
    //   chat-app 用 MutationObserver 监听 .app-detail-panel 子树变化,
    //   子树变化停止 50ms 后(说明 mountInto 完成),做 restore。
    //   加上 rAF + 多次 setTimeout 兜底,确保新 .pm-page 元素 layout 完成才设 scrollTop。
    //
    // ★ v0.61.8.11 关键洞察(用户 visual feedback still jump):
    //   启停切换会让 prompt 卡片在「当前上下文」/「可用 Prompt」之间移动,
    //   整个 list height 变化,设 scrollTop = 1000(固定值)会让视觉位置漂移。
    //   解决:同时记 click 时的 anchor element(closest .pm-card)和它的 offsetTop,
    //   restore 时**优先按 anchor 找新元素**,找不到才退回 scrollTop 数值。
    //
    // 实现:
    //   window.__chatScrollCapture() → 返回 {selector, scrollTop, anchorMatch, anchorOffsetTop} 或 null
    //     - anchorMatch: promptId 字符串(从 [data-prompt-id] 上读)
    //   window.__chatScrollRestore(selector, scrollTop, anchorMatch) → 异步恢复
    //   window.__chatScrollRestoreOnMutation(...) → 用 MO 监听,子树稳定后恢复
    const CHAT_SCROLL_SELECTORS = [
        '.prompt-manager .pm-page',
        '.memory-mgmt .memory-mgmt-page',
        '.memory-history .memory-history-page',
        '.chat-settings .chat-settings-page',
        '.new-group-page .new-group-body',
        '.new-chat-page .new-chat-content',
        '.chat-calendar-view .chat-calendar-view-page',
        '.chat-story-archive-page',
        '.chat-favorites .chat-favorites-scroll',
        '.chat-history-page',
        '.app-detail-body',
    ];

    // ★ v0.61.8.11 捕获 anchor:从 click 事件冒泡到 document.body,
    //   在 capture 阶段记下最近一次 click 的 [data-prompt-id] 祖先元素
    let _lastAnchorPromptId = null;
    let _lastAnchorOffsetTop = 0;
    let _lastAnchorParent = null;
    if (typeof document !== 'undefined' && document.body && !document.body.__chatScrollAnchorHooked) {
        document.body.__chatScrollAnchorHooked = true;
        document.body.addEventListener('click', (e) => {
            try {
                const t = e.target;
                if (!t || typeof t.closest !== 'function') return;
                // 优先找 .pm-card[data-prompt-id]
                const card = t.closest('.pm-card[data-prompt-id]');
                if (card) {
                    _lastAnchorPromptId = card.getAttribute('data-prompt-id');
                    _lastAnchorOffsetTop = findOffsetTopInScroller(card);
                    _lastAnchorParent = card.parentElement;
                    return;
                }
                // 兜底:任何 [data-prompt-id] 元素(segmented tabs 在 promptId 的 details 里)
                const pidEl = t.closest('[data-prompt-id]');
                if (pidEl) {
                    _lastAnchorPromptId = pidEl.getAttribute('data-prompt-id');
                    _lastAnchorOffsetTop = findOffsetTopInScroller(pidEl);
                    _lastAnchorParent = pidEl.parentElement;
                }
            } catch (_) { /* ignore */ }
        }, true); // capture phase
    }
    function findOffsetTopInScroller(el) {
        try {
            let cur = el;
            let top = 0;
            while (cur && !(cur.classList && cur.classList.contains('pm-page'))) {
                top += cur.offsetTop || 0;
                cur = cur.offsetParent;
            }
            return top;
        } catch (_) {
            return 0;
        }
    }

    function _findChatScroller() {
        try {
            const root = document.querySelector('.app-shell[data-app-id="chat"]');
            if (!root) return null;
            for (const sel of CHAT_SCROLL_SELECTORS) {
                const el = root.querySelector(sel);
                if (el && el.scrollTop > 0) {
                    return {
                        selector: sel,
                        scrollTop: el.scrollTop,
                        anchorPromptId: _lastAnchorPromptId,
                        anchorOffsetTop: _lastAnchorOffsetTop,
                        el,
                    };
                }
            }
            return null;
        } catch (_) {
            return null;
        }
    }
    function _restoreChatScroller(selector, scrollTop, anchorPromptId) {
        if (typeof selector !== 'string' || !selector) return;
        const tryRestore = () => {
            try {
                const root = document.querySelector('.app-shell[data-app-id="chat"]');
                const el = root ? root.querySelector(selector) : null;
                if (!el) return;
                // ★ v0.61.8.11 优先按 anchor 找新位置
                let targetTop = scrollTop;
                if (anchorPromptId) {
                    const newAnchor = el.querySelector(`[data-prompt-id="${cssEscape(anchorPromptId)}"]`);
                    if (newAnchor) {
                        // 计算新 anchor 在 scroller 里的 offsetTop
                        let cur = newAnchor;
                        let top = 0;
                        while (cur && cur !== el) {
                            top += cur.offsetTop || 0;
                            cur = cur.offsetParent;
                        }
                        // 恢复成原 anchor offsetTop(等于"恢复用户当时看到的同一卡片位置")
                        if (top !== _lastAnchorOffsetTop) {
                            targetTop = el.scrollTop + (top - _lastAnchorOffsetTop);
                            targetTop = Math.max(0, Math.min(targetTop, el.scrollHeight - el.clientHeight));
                        }
                    }
                }
                el.scrollTop = targetTop;
            } catch (_) { /* ignore */ }
        };
        tryRestore();
        try { requestAnimationFrame(tryRestore); } catch (_) {}
        setTimeout(tryRestore, 0);
        setTimeout(tryRestore, 30);
        setTimeout(tryRestore, 100);
        setTimeout(tryRestore, 300);
    }
    function cssEscape(s) {
        try {
            if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
        } catch (_) {}
        return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }
    window.__chatScrollCapture = _findChatScroller;
    window.__chatScrollRestore = _restoreChatScroller;
    // ★ v0.61.8.11 终极方案:MutationObserver 监听 .app-detail-panel 子树变化,
    //   子树「停止变化」50ms 后做 restore。这能追上 framework mountInto + Vue.nextTick +
    //   mountHybridIslands 全部完成后的稳定状态。
    window.__chatScrollRestoreOnMutation = function (selector, scrollTop, anchorPromptId) {
        if (typeof selector !== 'string' || !selector) return;
        const target = document.querySelector('.app-detail-panel');
        if (!target) {
            _restoreChatScroller(selector, scrollTop, anchorPromptId);
            return;
        }
        let pendingRestoreTimer = null;
        let done = false;
        const restore = () => {
            pendingRestoreTimer = null;
            if (done) return;
            done = true;
            _restoreChatScroller(selector, scrollTop, anchorPromptId);
        };
        const scheduleRestore = () => {
            if (pendingRestoreTimer) clearTimeout(pendingRestoreTimer);
            pendingRestoreTimer = setTimeout(restore, 60);
        };
        const mo = new MutationObserver((mutations) => {
            let relevant = false;
            for (const m of mutations) {
                if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
                    relevant = true;
                    break;
                }
            }
            if (!relevant) return;
            scheduleRestore();
        });
        mo.observe(target, { childList: true, subtree: true });
        setTimeout(() => {
            try { mo.disconnect(); } catch (_) {}
        }, 2500);
        scheduleRestore();
        // 立即先试一次(可能 MO 监听不到某些情况)
        _restoreChatScroller(selector, scrollTop, anchorPromptId);
    };
}

const NAV_TABS = [
    {
        id: 'messages',
        label: '消息',
        iconHtml: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
        topbar: {
            visible: true,
            title: '消息',
            showPill: false,
            // ★ v0.25 framework 级 headerActions:顶栏右侧按钮组
            //   mode toggle 按钮的 iconHtml / variant 跟随 chatRecordMode 动态变,
            //   通过 syncHeaderActionsWithMode() 在切换时调 __appTopbarOverride 更新。
            //   这里取模块加载时的默认 mode 渲染首屏;后续切 mode 会写到 override。
            headerActions: buildMessagesHeaderActions(),
        },
    },
    {
        id: 'contacts',
        label: '通讯录',
        iconHtml: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        topbar: { visible: true, type: 'search', searchPlaceholder: '搜索' },
    },
    {
        id: 'moments',
        label: '动态',
        iconHtml: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/></svg>',
        topbar: { visible: false },
    },
    {
        id: 'profile',
        label: '我',
        iconHtml: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        topbar: { visible: false },
    },
];

/**
 * 根据当前 chatRecordMode 生成 headerActions。
 * - mode === 'story' → 用 ICON_STORY,variant 'solid'(粉色实色,提示当前是故事模式)
 * - mode === 'calendar' → 用 ICON_CALENDAR,variant 'subtle'(默认浅色玻璃)
 * 第二个按钮(搜索)永远不变。
 */
function buildMessagesHeaderActions() {
    const mode = getChatRecordMode();
    const isStory = mode === 'story';
    return [
        {
            iconHtml: isStory ? ICON_STORY : ICON_CALENDAR,
            ariaLabel: isStory ? '切换到日历模式' : '切换到故事模式',
            variant: isStory ? 'solid' : 'subtle',
            action: { action: 'appMethod', method: 'toggleRecordMode' },
        },
        {
            iconHtml: ICON_SEARCH,
            ariaLabel: '搜索聊天',
            action: { action: 'appMethod', method: 'toggleSearch' },
        },
    ];
}

/**
 * 把当前 mode 对应的 headerActions 写到 framework 的 __appTopbarOverride,
 * 触发顶栏 reactive 重渲(mode toggle 按钮的 svg + variant 跟着变)。
 * 多次写入安全(Vue ref 同值不会触发 watch);没就绪则静默忽略(framework 未 mount)。
 */
function syncHeaderActionsWithMode() {
    if (typeof window === 'undefined') return;
    const ref = window.__appTopbarOverride;
    if (!ref) return;
    const mode = getChatRecordMode();
    try {
        // ★ v0.37 故事模式顶栏标题改为 "Dream",日历模式显式回 "消息"(硬编码默认,
        //   避免 framework activeAppTopbar 合并后 title=null 落到 app.name 'murmur')
        const titleOverride = mode === 'story' ? 'Dream' : '消息';
        ref.value = Object.assign({}, ref.value || {}, {
            headerActions: buildMessagesHeaderActions(),
            title: titleOverride,
        });
    } catch (_) {}
    // ★ v0.37 顺便同步 .app-shell 的 data-chat-mode(让顶栏按钮颜色跟随 mode)
    try {
        syncShellDataMode(mode);
    } catch (_) {}
}

/**
 * ★ v0.37 把当前 mode 写到 .app-shell[data-app-id="chat"] 的 data-chat-mode 属性上,
 *   让 CSS 可以根据 mode 切换顶栏按钮颜色(故事模式按钮变粉)。
 *
 *   设计要点:
 *   - 只挂在 .app-shell 上,不挂在 inner 容器 — framework v-html 重画不会清掉 app-shell,
 *     所以属性稳定;framework 关闭 chat app / 切换到其他 app 时这个 app-shell 会从 DOM 移除,
 *     下次进入再重挂,不会出现泄漏。
 *   - 同步还设置 .is-story-mode / .is-calendar-mode 两个 class,便于将来需要时用 class 选择器。
 *   - 静默忽略找不到 shell 的情况(framework 还没 mount)。
 */
function syncShellDataMode(mode) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const shell = document.querySelector('.app-shell[data-app-id="chat"]');
    if (!shell) return;
    const next = mode === 'story' ? 'story' : 'calendar';
    shell.dataset.chatMode = next;
    shell.classList.toggle('is-story-mode', next === 'story');
    shell.classList.toggle('is-calendar-mode', next === 'calendar');
}

/**
 * 监听 chat:record-mode-changed 事件,把 mode 反映到 app-shell 的 data-chat-mode。
 * 模块加载时挂一次,后续切 mode 自动同步 — 不需要每个 method 单独调。
 * 旧调用方(syncHeaderActionsWithMode / toggleRecordMode)仍可继续调 syncShellDataMode,
 * 双保险无副作用(写入同值不触发 DOM 变更)。
 */
let _shellModeListenerBound = false;
function bindShellModeListener() {
    if (_shellModeListenerBound || typeof window === 'undefined') return;
    _shellModeListenerBound = true;
    window.addEventListener('chat:record-mode-changed', (e) => {
        const mode = e?.detail?.mode;
        if (mode) syncShellDataMode(mode);
    });
}

/**
 * ★ v0.37 监听 framework 的 root page 切换事件,处理 messages tab 顶栏按钮 / 标题恢复。
 *
 *   背景:之前 framework 在切回 messages tab 时直接调 chat-app 的 `buildMessagesHeaderActions()`,
 *   触发 ReferenceError(framework 不该依赖具体 app 的内部函数,AGENTS.md §16.4)。
 *   现在 framework 改为派发 `app:rootpage-changed` 通用事件,这里订阅:
 *   - 从其他 tab 切回 messages → 立即恢复 override(保持标题/按钮最新)
 *   - 从 messages 切到其他 tab → 让 framework 的 v0.28 fix 把 override 清掉,这里不再做额外事
 *   - 同一 app 内其他切换(暂不需要改动)→ 跳过
 */
let _rootPageChangedListenerBound = false;
function bindRootPageChangedListener() {
    if (_rootPageChangedListenerBound || typeof window === 'undefined') return;
    _rootPageChangedListenerBound = true;
    window.addEventListener('app:rootpage-changed', (e) => {
        const { from, to, appId } = e?.detail || {};
        if (appId !== 'chat') return;
        // 仅处理「进入 messages tab」的路径(切回来 / 初始化首次渲染后)
        if (to === 'messages') {
            try {
                syncHeaderActionsWithMode();
            } catch (_) {}
        }
        // from === 'messages' && to !== 'messages' 的路径,framework 已在 switchRootPage 内清掉 override,
        // 这里无需再做(v0.28 fix 的逻辑保留)
    });
}

/**
 * 触发 framework 重渲当前消息列表 tab。
 * 用于模式切换 / 联系人变化后让 .chat-messages-list-page 重画。
 * 不依赖 `this`：framework 调 method 时 this 是 undefined。
 */
function refreshMessagesTab(ctx) {
    // 1. 让 framework 的 currentPageView 重新计算 → 触发 v-html 重渲
    try {
        const tickRef = typeof window !== 'undefined' ? window.__detailRenderTick : null;
        if (tickRef && typeof tickRef.value === 'number') tickRef.value++;
    } catch (_) {}

    // 2. 通知 framework（chat-app）刷新 — 通过 CustomEvent 让 chat-app 的方法触发
    try {
        window.dispatchEvent(new CustomEvent('chat:needs-refresh'));
    } catch (_) {}

    // ★ v0.25 模式切换按钮的文案 / class 由 renderMessagesPage 输出 v-html 时直接写对,
    //   framework 重渲时按钮自然带正确的 mode class,这里不再手改 DOM。
}

/**
 * 渲染聊天 app 各 root page 的内容
 *
 * @param {Object} content
 * @param {Object} page
 * @param {Object} app
 * @returns {string} HTML 字符串
 */
export function renderChatPage(content, page, app) {
    const currentId = page?.id || app?.defaultRootPageId || 'messages';

    // 立即执行初始化（底栏 tab 指示器需要 framework 渲染 .app-tab-bar 之后注入）
    if (app?.methods?.mountNavIndicator) {
        app.methods.mountNavIndicator();
    }

    // 根据当前 tab 渲染对应页面
    if (currentId === 'messages') {
        return renderMessagesPage(app);
    }
    if (currentId === 'contacts') {
        return renderContactsPage(app);
    }
    if (currentId === 'moments') {
        // ★ v0.32:跟 profile tab 一样,先用 chat-snapshot 兜底渲染真实 userData,
        //   initMomentsPageInteractions 里再异步 SDK 校准(覆盖 avatarCode 解析)
        let bootstrapUserData = null;
        try {
            const snap = loadChatSnapshot?.();
            bootstrapUserData = snapshotToProfileUser(snap);
        } catch (_) {}
        const html = renderMomentsPage(app, null, bootstrapUserData);
        // 动态页面需要绑定交互
        queueMicrotask(() => {
            try {
                app?.methods?.initMomentsPageInteractions?.();
            } catch (err) {
                console.warn('[chat-app] initMomentsPageInteractions failed', err);
            }
        });
        return html;
    }
    if (currentId === 'profile') {
        // ★ v0.28 同步优先用 snapshot 渲染真实用户卡(SDK 还没 bootstrap 时也立即可见)
        //   SDK ready 后 refreshProfileTab 会再次用真实数据覆盖
        let html;
        const sdkReady = !!window.settingsSdk;
        if (!sdkReady) {
            try {
                const snap = loadChatSnapshot?.();
                const snapUser = snap?.defaultUser || snap?.activeUser;
                if (snapUser && (snapUser.name || snapUser.avatar)) {
                    html = renderProfilePage(app, snapshotToProfileUser(snap));
                } else {
                    html = renderProfilePage(app);
                }
            } catch (_) {
                html = renderProfilePage(app);
            }
        } else {
            html = renderProfilePage(app);
        }
        // 页面渲染后异步加载真实用户数据并刷新
        queueMicrotask(() => {
            // 监听用户切换事件，当用户切换时刷新页面
            if (!window.__chatProfileRefreshBound) {
                window.__chatProfileRefreshBound = true;
                window.addEventListener('settings:user-switched', () => {
                    clearUserCache();
                    // 通知 framework 重新渲染 profile tab
                    app?.methods?.refreshProfileTab?.();
                });
            }
            // 首次加载：异步获取用户数据并刷新
            if (app?.methods?.refreshProfileTab) {
                app.methods.refreshProfileTab();
            }
        });
        return html;
    }

    // 其他 tab 占位
    const title = NAV_TABS.find(t => t.id === currentId)?.topbar?.title || currentId;

    return `
<div class="chat-app">
    <div class="chat-tab-content">
        <p class="chat-tab-placeholder__title">${title}</p>
        <p class="chat-tab-placeholder__subtitle">Phase 11 待接入(${title}页面)</p>
    </div>
</div>
`;
}

// ★ v0.44:初始化全局收藏 ID 注册表(用于渲染时高亮已收藏按钮)
if (typeof window !== 'undefined' && !window.__chatFavoritedIds) {
    window.__chatFavoritedIds = new Set();
}

// ============================================================
// ★ v0.58 模块顶层 helper:系统 prompt override 持久化
//   - 必须放在 createChatApp() 外部(不能放进 methods 块)
//   - 函数声明会 hoist,methods 块里 _getSystemPromptOverride / _setSystemPromptOverride
//     都能调到这两个函数
// ============================================================
function _loadSystemPromptOverrides() {
    try {
        const raw = localStorage.getItem('xiaoting::chat-system-prompt-overrides-v1');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) { return {}; }
}

function _saveSystemPromptOverrides(map) {
    try {
        localStorage.setItem(
            'xiaoting::chat-system-prompt-overrides-v1',
            JSON.stringify(map || {})
        );
    } catch (_) { /* 静默兜底(隐私模式/配额满) */ }
}

// ============================================================
// ★ v0.61.7.3 prompt-manager contextOrder 持久化
//   - data: { [aiPersonId]: orderedId[] }  // 完整 ID 顺序,包含 system-* / context-rounds / world-* / custom
//   - 之前只在内存 this.app.state.chat.contextOrder[aiPersonId] 写,刷新后丢失
//   - 现在双写到 localStorage,hydrate 第一步回填到内存
//   - 关键:由于 user 在拖拽时同时包含 replyPrompts(自定义) + system-*(虚拟) + context-rounds(虚拟),
//     SDK 的 replyPrompts.setOrder 只能持久化 replyPrompts,system-* 的位置变化只能靠 contextOrder
// ============================================================
function _loadContextOrder() {
    try {
        const raw = localStorage.getItem('xiaoting::chat-context-order-v1');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) { return {}; }
}

function _saveContextOrder(map) {
    try {
        localStorage.setItem(
            'xiaoting::chat-context-order-v1',
            JSON.stringify(map || {})
        );
    } catch (_) {}
}

export function createChatApp() {
    // ★ v0.61.8.5 component-island 在 chat-app detail 渲染时未生效,
    //   编辑器已改为内联 HTML + data-app-action,不再依赖 island
    //   - 保留 registerIslandComponent 调用是 noop(framework 找不到 <component-island> 标签)
    try {
        if (typeof registerIslandComponent === 'function') {
            registerIslandComponent('app-prompt-preview', appPromptPreviewIsland);
        }
    } catch (_) { /* 静默兜底 */ }
    return {
        id: 'chat',
        name: 'murmur',
        badge: 0,
        iconBg: 'linear-gradient(145deg, #b8e0f7 0%, #8ecae6 100%)',
        icon: '<svg viewBox="0 0 60 60" style="width:100%;height:100%;"><path d="M0,-22 Q2.5,-4 15,0 Q2.5,4 0,22 Q-2.5,4 -15,0 Q-2.5,-4 0,-22Z" fill="#4a9eca" transform="translate(15, 12) scale(1.5)"/><path d="M0,-22 Q2.5,-4 15,0 Q2.5,4 0,22 Q-2.5,4 -15,0 Q-2.5,-4 0,-22Z" fill="#3d8ab8" transform="translate(45, 49) scale(1.5)"/></svg>',
        renderMode: 'hybrid',
        background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        // v0.26:framework 会在切 tab 时重算 activeAppBackgroundStyle,
        // 所以这里读 activePageId 区分「只在 messages tab 才让背景变粉」——
        // 通讯录/动态/我 这三个 tab 仍保留原色,避免全 app 都被染成粉色。
        getBackground(_state, activePageId) {
            if (getChatRecordMode() === 'story' && activePageId === 'messages') {
                return 'linear-gradient(180deg, #FFE0EC 0%, #FFF5F8 50%, #FFFFFF 100%)';
            }
            return 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)';
        },
        nav: { type: 'tab' },
        pages: [
            // Tab 页
            ...NAV_TABS.map((tab) => ({
                id: tab.id,
                label: tab.label,
                iconHtml: tab.iconHtml,
                nav: true,
                topbar: tab.topbar,
            })),
        ],
        defaultRootPageId: 'messages',
        topbar: {
            visible: true,
            title: '消息',
            showPill: false,
            // headerActions 由 messages tab 的 page.topbar 提供(activeAppTopbar 优先 page),
            // 这里不再重复声明。
        },
        // detailContent 用于告诉 framework 详情页的存在和标题
        detailContent: {},
        renderPage: renderChatPage,
        renderDetailPage: async function(content, page, app) {
            const pageId = page?.id || '';
            let html = '';

            // ★ v0.28 new-chat 页面需要 SDK 数据,如果没有就走 whenSettingsSdkReady
            //   (framework/prewarm.js 已经 fire-and-forget 启动了 SDK,大概率已经就绪;
            //    这里只是兜底,确保打开 new-chat 时 SDK 必然可用)
            if (pageId === 'new-chat' && !window.settingsSdk) {
                try {
                    if (typeof window.whenSettingsSdkReady === 'function') {
                        await window.whenSettingsSdkReady(3000);
                    } else {
                        await bootstrapSettingsSdk({ toolkit: app?.toolkit });
                    }
                    // bootstrap 完成后立刻写一份快照,下次冷启动有数据
                    try {
                        const sdk = getSettingsSdk();
                        if (sdk) saveSnapshot(sdk);
                    } catch (_) {}
                } catch (err) {
                    console.warn('[chat-app] renderDetailPage bootstrap failed:', err);
                }
            }
            // 发起聊天页面
            if (pageId === 'favorites' || pageId.startsWith('favorites-')) {
                // ★ v0.44:确保 SDK 已就绪(可能在打开 settings app 之前就打开收藏页)
                if (typeof window.whenSettingsSdkReady === 'function') {
                    await window.whenSettingsSdkReady(3000);
                }
                // ★ v0.44:用 `_` 分隔 sourceType 和 sourceId(aiPersonId 不含 `_`),
                //   pageId 格式: favorites-{sourceType}_{sourceId}
                //   例: favorites-private_ai0 → sourceType=private, sourceId=ai0
                const favMatch = pageId.match(/^favorites-(?:([a-z]+)_(.+))?$/);
                const favSourceType = favMatch?.[1] || null;
                const favSourceId = favMatch?.[2] || null;
                // ★ v0.44:读取真实收藏数据(sdk.chatFavorites)与 DEMO 合并展示
                const sdk = window.settingsSdk;
                console.log('[chat] renderFavoritesPage sdk?', !!sdk, 'chatFavorites?', !!sdk?.chatFavorites);
                const realFavs = (() => {
                    try {
                        const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                        console.log('[chat] favorite user:', user);
                        if (!user) return [];
                        const userId = typeof user === 'string' ? user : user.id;
                        console.log('[chat] favorite userId:', userId);
                        // 按 (user, aiPersonId, mode) 拉取,不过滤特定联系人(全部)
                        const list = sdk?.chatFavorites?.list?.(user) || [];
                        console.log('[chat] realFavs count:', list.length);
                        return list;
                    } catch (err) {
                        console.warn('[chat] realFavs error:', err);
                        return [];
                    }
                })();
                // ★ v0.44:读取对话片段收藏(内存)
                const conversationFavs = Array.isArray(app?.state?._conversationFavorites)
                    ? app.state._conversationFavorites
                    : [];
                const favOptions = {
                    contactId: favSourceId,
                    sourceType: favSourceType,
                    sourceName: favSourceId ? getContactOrGroupName(favSourceId, favSourceType) : null,
                    // ★ v0.36:从 app.state 读取收藏页 in-memory state(分类 / 搜索 keyword / 展开状态)
                    state: (app?.state?.chat?.favorites) || {},
                    // ★ v0.44:合并三类收藏数据:对话片段(内存) + 单条收藏(sdk) + DEMO(兜底)
                    realFavorites: [...conversationFavs, ...realFavs],
                };
                html = renderFavoritesPage(app, favOptions);
            } else if (pageId === 'new-chat') {
                // ★ v0.28 SDK 已经在上面 bootstrap 完毕,直接用 async 版本拿到真实世界名 + AI 名单
                html = await renderNewChatPageAsync(app);
                // 异步刷新联系人列表(框架会重渲染)
                queueMicrotask(() => {
                    if (!window.__chatNewChatRefreshBound) {
                        window.__chatNewChatRefreshBound = true;
                        app?.methods?.refreshNewChatContacts?.();
                    }
                });
            } else if (pageId === 'new-group') {
                // ★ v0.39 发起群聊(分两步: 选 AI → 选 mode)
                //   - 跟 new-chat 一样先 bootstrap SDK,确保 getWorldAiPersons 拿到真实数据
                //   - 用 renderNewGroupPageAsync(async)让 framework 的 resolveAsyncRenderer 接管 Promise,
                //     避免旧版「同步渲染空 grid + 后置 syncNow 失败」导致卡在空状态
                if (!window.settingsSdk) {
                    try {
                        if (typeof window.whenSettingsSdkReady === 'function') {
                            await window.whenSettingsSdkReady(3000);
                        } else {
                            await bootstrapSettingsSdk({ toolkit: app?.toolkit });
                        }
                        // bootstrap 完成后写一份快照,下次冷启动有数据
                        try {
                            const sdk = getSettingsSdk();
                            if (sdk) saveSnapshot(sdk);
                        } catch (_) {}
                    } catch (err) {
                        console.warn('[chat-app] renderDetailPage new-group bootstrap failed:', err);
                    }
                }
                const options = {
                    step: window.__chatNewGroupStep === 2 ? 2 : 1,
                    selectedIds: Array.from(window.__chatNewGroupSelection || []),
                    presetMode: window.__chatNewGroupMode || '',
                };
                html = await renderNewGroupPageAsync(app, options);
                // initNewGroupPageInteractions 现在是 no-op(SDK bootstrap 已挪到上面 await whenSettingsSdkReady)
                queueMicrotask(() => {
                    app?.methods?.initNewGroupPageInteractions?.();
                });
            } else if (pageId === 'chat-post') {
                // 发布新动态详情页(动态页顶部「发布新动态」按钮)
                html = renderChatPostPage(app);
            } else if (pageId.startsWith('ai-moments-')) {
                // ★ v0.31 AI 专属朋友圈详情页(聊天设置 → 朋友圈)
                //   pageId = 'ai-moments-{aiPersonId}-{mode}'
                const cid = pageId.replace('ai-moments-', '');
                // 解析 aiPersonId + mode
                const lastDash = cid.lastIndexOf('-');
                let aiPersonId = cid;
                let ownerMode = 'calendar';
                if (lastDash > 0) {
                    const tail = cid.slice(lastDash + 1);
                    if (tail === 'calendar' || tail === 'story') {
                        ownerMode = tail;
                        aiPersonId = cid.slice(0, lastDash);
                    }
                }
                html = renderMomentsPage(app, null, null, { aiPersonId, mode: ownerMode });
            } else if (pageId.startsWith('calendar-view-')) {
                // 日历视图详情页(聊天设置 → 聊天记录管理 → 日历视图)
                const cid = pageId.replace('calendar-view-', '');
                html = renderCalendarViewPage(app, cid);
                // ★ v0.32 绑定日历交互(月份导航 + 当天消息面板的滚动锚定)
                setTimeout(() => {
                    try {
                        app?.methods?.initCalendarViewInteractions?.();
                    } catch (err) {
                        console.warn('[chat-app] initCalendarViewInteractions failed', err);
                    }
                }, 50);
            } else if (pageId.startsWith('memory-management-')) {
                // ★ v0.65 层级管理页(聊天设置 → 聊天记录管理 → 层级管理)
                html = renderMemoryManagementPage(app, pageId);
            } else if (pageId.startsWith('memory-history-')) {
                // ★ v0.65 历史消息页(层级管理 → 历史消息),上下结构 + 层级 tab
                html = renderMemoryHistoryPage(app, pageId);
            } else if (pageId.startsWith('chat-history-')) {
                // ★ v0.61.3 历史消息详情页(聊天设置 → 聊天记录管理 → 历史消息)
                const cid = pageId.replace('chat-history-', '');
                html = renderHistoryPage(app, cid);
            } else if (pageId.startsWith('story-archive-')) {
                // 故事存档详情页(聊天设置 → 聊天记录管理 → 故事记录)
                const cid = pageId.replace('story-archive-', '');
                html = renderStoryArchivePage(app, cid);
                // ★ v0.42 绑定存档列表交互(目前所有按钮都走 data-app-action,这里仅做
                //   一次性的 SDK ready 兜底刷新)
                queueMicrotask(() => {
                    try {
                        app?.methods?.initStoryArchiveInteractions?.();
                    } catch (err) {
                        console.warn('[chat-app] initStoryArchiveInteractions failed', err);
                    }
                });
            } else if (pageId.startsWith('prompt-manager-')) {
                // ★ v0.58 回复提示词管理详情页(聊天设置 → AI 设置 → 回复提示词)
                //   async:加载 prompt_db 里的「Prompt 库」条目做「拉取」入口
                const cid = pageId.replace('prompt-manager-', '');
                html = await renderPromptManagerPage(app, cid);
            } else if (pageId.startsWith('private-')) {
                // ★ v0.28 路由:private-{aiPersonId}-{mode} → 私聊详情页
                //   完整 contactId 传给 renderPrivateChatPage，内部解析 aiPersonId + mode
                html = renderPrivateChatPage(app, pageId);
                // ★ v0.61.3:实时计算「当前聊天回合」prompt 文本 + 后台触发滚动摘要压缩
                //   - 写入 app.state.chat.contextRoundsMap[aiPersonId] = { rounds, content, lastUpdated }
                //   - fire-and-forget 调 _triggerRollingCompress(由 sdk.rollingSummaries.compressIfNeeded 处理)
                //   - 写入完成后用 __appRendererBridge.syncNow({ force: true }) 强制 detail 重画,
                //     避免使用 window.__detailRenderTick.value++ 触发死循环(AGENTS.md §16.27)
                (() => {
                    try {
                        const stripped = pageId.startsWith('private-')
                            ? pageId.slice('private-'.length)
                            : pageId;
                        const lastDash = stripped.lastIndexOf('-');
                        const mode = (lastDash > 0 && (stripped.slice(lastDash + 1) === 'calendar' || stripped.slice(lastDash + 1) === 'story'))
                            ? stripped.slice(lastDash + 1)
                            : 'calendar';
                        const aiPersonId = (lastDash > 0 && (stripped.slice(lastDash + 1) === 'calendar' || stripped.slice(lastDash + 1) === 'story'))
                            ? stripped.slice(0, lastDash)
                            : stripped;
                        const sdk = window.settingsSdk;
                        if (!sdk || !app?.methods?.computeContextRoundsPrompt) return;
                        const user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                        const msgs = sdk.chatMessages?.list
                            ? (sdk.chatMessages.list(user, aiPersonId, mode) || [])
                            : [];
                        const cfg = sdk.rollingSummaries?.getRollingConfig?.(aiPersonId) || { contextRounds: 20 };
                        const ctxN = Number(cfg.contextRounds) || 20;
                        const content = app.methods.computeContextRoundsPrompt(aiPersonId, msgs, ctxN);
                        const roundsCount = (() => {
                            const list = Array.isArray(msgs) ? msgs.slice() : [];
                            // ★ v0.61.8.12 roundsCount 与 content 保持口径一致,只算「今天的回合」
                            const _now = new Date();
                            const _dayStart = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 0, 0, 0, 0).getTime();
                            const _dayEnd = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 23, 59, 59, 999).getTime();
                            const todayList = list.filter((m) => {
                                const ts = Number(m && m.timestamp) || 0;
                                return ts >= _dayStart && ts <= _dayEnd;
                            });
                            todayList.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
                            let n = 0; let cur = []; let curSender = null;
                            for (const m of todayList) {
                                if (!m || m.sender == null) continue;
                                if (m.sender !== curSender && cur.length > 0) { n += 1; cur = []; }
                                cur.push(m); curSender = m.sender;
                            }
                            if (cur.length > 0) n += 1;
                            return n;
                        })();
                        if (!app.state.chat) app.state.chat = {};
                        if (!app.state.chat.contextRoundsMap) app.state.chat.contextRoundsMap = {};
                        app.state.chat.contextRoundsMap[aiPersonId] = {
                            rounds: roundsCount,
                            content,
                            lastUpdated: Date.now(),
                            contextRounds: ctxN,
                        };
                        // 后台 K 链压缩:不阻塞 renderPage,fire-and-forget
                        if (app?.methods?._triggerRollingCompress) {
                            app.methods._triggerRollingCompress(aiPersonId, mode, msgs).catch(() => {});
                        }
                        // 压缩完后异步触发 detail 重画,让 prompt-manager / 私聊页用最新数据
                        setTimeout(() => {
                            try {
                                window.__appRendererBridge?.syncNow?.({ force: true });
                            } catch (_) {}
                        }, 60);
                    } catch (err) {
                        console.warn('[chat-app] v0.61.3 private-page context rounds init failed:', err);
                    }
                })();
            } else if (pageId.startsWith('call-record-')) {
                // 通话记录详情页(语音/视频)— 卡片点击进入
                const callRecordId = pageId.replace('call-record-', '');
                html = renderCallRecordDetailPage(app, callRecordId);
            } else if (pageId.startsWith('chat-settings-')) {
                // 聊天设置详情页(顶部「…」按钮)
                const contactId = pageId.replace('chat-settings-', '');
                // ★ v0.62.x fix:chat-settings 渲染依赖 window.__apiSdk 的缓存
                //   但 __apiSdk 是 settings app 模块的内部状态,只在打开过 settings 时挂载
                //   + 缓存异步加载。渲染前必须先 await __apiSdkLoadingPromise,
                //   否则 findById 会拿到 undefined → '未配置'。
                //   这里保险地用 whenSettingsSdkReady + 双保险(__apiSdk 已挂就跳过)
                try {
                    if (window.__apiSdkLoadingPromise && typeof window.__apiSdkLoadingPromise.then === 'function') {
                        await window.__apiSdkLoadingPromise;
                    } else if (typeof window.whenSettingsSdkReady === 'function') {
                        await window.whenSettingsSdkReady(2000);
                    }
                    if (!window.__apiSdk && typeof window.getApiSdk === 'function') {
                        const s = window.getApiSdk();
                        if (s && s._loadingPromise) {
                            await s._loadingPromise;
                        } else if (window.__apiSdkLoadingPromise) {
                            await window.__apiSdkLoadingPromise;
                        }
                    }
                } catch (_) {}
                html = renderChatSettingsPage(app, contactId);
                // 绑定聊天设置页面的交互 - 延迟确保 v-html 完成
                setTimeout(() => {
                    try {
                        app?.methods?.initChatSettingsInteractions?.();
                    } catch (err) {
                        console.warn('[chat-app] initChatSettingsInteractions failed', err);
                    }
                }, 50);
            } else if (pageId.startsWith('group-settings-')) {
                // 群聊设置详情页(顶部「…」按钮) — 必须在 group-* 之前匹配!
                const groupId = pageId.replace('group-settings-', '');
                html = renderGroupSettingsPage(app, groupId);
            } else if (pageId.startsWith('group-')) {
                // 群聊详情页 — 必须在 group-settings-* 之后匹配
                const groupId = pageId.replace('group-', '');
                html = renderGroupChatPage(app, groupId);
            } else if (pageId === 'game-selector') {
                // 游戏选择器页面
                html = renderGameSelectorPage(app);
            } else if (pageId === 'game-leaderboard') {
                // 游戏排行榜页面
                html = renderGameLeaderboardPage(app);
            } else if (pageId.startsWith('call-')) {
                // 通话页面(call-voice-{contactId} / call-video-{contactId})
                const parts = pageId.replace('call-', '').split('-');
                const callType = parts[0];
                const contactId = parts.slice(1).join('-');
                html = renderCallPage(app, contactId, callType);
            } else {
                html = `<div style="padding:20px;text-align:center;color:#999;">未知页面: ${pageId}</div>`;
            }

            // ★ v0.36 改造: 收藏页面的所有交互(fav-category-tab / fav-expand-btn /
            //   fav-context-header / 搜索 input)全部走 framework 顶层 click / input
            //   委托(通过 data-app-action / data-app-search + window 级 input 捕获)。
            //   之前 renderDetailPage 内联挂的 addEventListener 会因:
            //     1) selector (.chat-favorites 复数)在某些旧 build 下找不到 → 静默失效
            //     2) v-html 重建后 listener 跟旧 DOM 一起死,而 framework 重画时新 DOM 没绑
            //   导致分类切换 / 展开按钮全部点不了。新方案:
            //     - 按钮交互: 在 favorites-page.js 渲染时塞 data-app-action(method + payload)
            //       → framework handleAppContentClick 自动派发 → methods.switchFavoriteCategory
            //       / toggleFavoriteExpand / toggleFavoriteContext 处理,改 app.state 后
            //       __detailRenderTick.value++ 触发 framework 整页重画
            //     - 搜索 input: 在 chat-app/index.js 模块顶层挂 window 级 input 监听
            //       (通过 data-app-search 标记区分,favorites 页面挂上标记才响应)
            //   此处不再写任何 inline addEventListener。

            // ★ v0.36 状态清理:离开 favorites 页面时重置 app.state.chat.favorites
            //   切到其他 tab 再进收藏页时,状态应从头开始(category=all,keyword='',都不展开),
            //   而不是继承上一次浏览时的残留状态;但切到其他 detail page(如 private-xxx → 收藏)
            //   时保留状态(因为用户可能从私聊页点了收藏又切回来)。
            if (!((pageId === 'favorites' || pageId.startsWith('favorites-')))) {
                const favState = app?.state?.chat?.favorites;
                if (favState) {
                    favState.category = 'all';
                    favState.searchKeyword = '';
                    favState.expandedConv = new Set();
                    favState.expandedContext = new Set();
                }
            }

            if (pageId === 'new-chat') {
                queueMicrotask(() => {
                    try {
                        app?.methods?.initNewChatPageInteractions?.();
                    } catch (err) {
                        console.warn('[chat-app] initNewChatPageInteractions failed', err);
                    }
                });
            } else if (pageId.startsWith('private-')) {
                // ★ v0.48: 改由模块顶层 MutationObserver 自动绑定,不需要 queueMicrotask
            } else if (pageId.startsWith('group-settings-')) {
                // 群聊设置页 — 不绑定群聊交互
            } else if (pageId.startsWith('group-')) {
                // 群聊详情页 — 必须在 group-settings-* 之后匹配
                queueMicrotask(() => {
                    try {
                        app?.methods?.initGroupChatInteractions?.();
                    } catch (err) {
                        console.warn('[chat-app] initGroupChatInteractions failed', err);
                    }
                });
            } else if (pageId.startsWith('prompt-manager-')) {
                // 回复提示词管理页 — 绑定折叠/展开/复制交互
                queueMicrotask(() => {
                    try {
                        app?.methods?.initPromptManagerInteractions?.();
                    } catch (err) {
                        console.warn('[chat-app] initPromptManagerInteractions failed', err);
                    }
                });
            }
            return html;
        },
        methods: {
            // ============================================================
            // ★ v0.43 消息操作组 state / helpers(逐步加,先加 state helpers + 复制)
            //   - app.state.chat.action:
            //       replyingTo: 引用回复快照
            //       selectedMessages: 多选 Set<msgId>
            //       multiSelectActive: 多选模式开关
            // ============================================================
            _ensureChatActionState(app) {
                if (!app.state.chat) app.state.chat = {};
                if (!app.state.chat.action) {
                    app.state.chat.action = {
                        replyingTo: null,
                        selectedMessages: new Set(),
                        multiSelectActive: false,
                    };
                }
                const st = app.state.chat.action;
                if (!(st.selectedMessages instanceof Set)) {
                    st.selectedMessages = new Set(Array.isArray(st.selectedMessages) ? st.selectedMessages : []);
                }
                return st;
            },

            _triggerChatActionRerender() {
                if (typeof window !== 'undefined' && window.__detailRenderTick) {
                    window.__detailRenderTick.value++;
                }
            },

            /**
             * ★ v0.57 系统 prompt 注入开关状态
             *   - 存放在 app.state.chat.systemPromptInject[aiPersonId] = { user: bool, ai: bool }
             *   - 默认全 true(开启),prompt-builder 读这个字段决定是否过滤
             *   - 控制范围:「当前上下文」section 顶部的人设上下文文本
             */
            _ensureSystemPromptInject(app, aiPersonId) {
                if (!app.state) app.state = {};
                if (!app.state.chat) app.state.chat = {};
                const map = app.state.chat.systemPromptInject || (app.state.chat.systemPromptInject = {});
                if (!map[aiPersonId]) {
                    map[aiPersonId] = { user: true, ai: true };
                }
                return map[aiPersonId];
            },

            /**
             * 切换系统 prompt 的注入状态(人设级别 user / ai)
             * payload: { aiPersonId, kind: 'user' | 'ai' }
             * 重画后保留滚动位置(framework 重画默认会滚到顶部)
             */
            toggleSystemPromptInject(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                const kind = payload?.kind === 'ai' ? 'ai' : (payload?.kind === 'sticker-library' ? 'sticker-library' : 'user');
                if (!aiPersonId) return null;
                // ★ v0.64 「AI 表情包库」开关走独立的 stickerLibraryInject 状态,
                //   跟 user/ai 系统 prompt 注入开关解耦(数据语义完全不同)
                if (kind === 'sticker-library') {
                    return this.toggleStickerLibraryActive({ aiPersonId });
                }
                const st = this._ensureSystemPromptInject(this.app, aiPersonId);
                st[kind] = !st[kind];
                this._preserveScrollAroundTick();
                this.toolkit?.island?.notify?.(
                    'info',
                    '已更新注入设置',
                    `${kind === 'user' ? '用户人设' : 'AI 人设'} → ${st[kind] ? '已启用' : '已停用'}`
                );
                // ★ v0.61.7 用 syncNow 触发 prompt-manager 重画(让「当前上下文」区显示/消失对应卡)
                //   - 必须先 invalidate cache,否则 resolveAsyncRenderer 命中旧缓存返回旧 HTML
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}
                return st;
            },

            /**
             * ★ v0.61.7 切换「当前聊天回合」是否注入上下文
             * payload: { aiPersonId }
             * 状态存储在 app.state.chat.contextRoundsActive[aiPersonId]
             */
            toggleContextRoundsActive(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                if (!aiPersonId) return null;
                if (!this.app.state) this.app.state = {};
                if (!this.app.state.chat) this.app.state.chat = {};
                const map = this.app.state.chat.contextRoundsActive || (this.app.state.chat.contextRoundsActive = {});
                map[aiPersonId] = !(map[aiPersonId] !== false); // 默认 true，切换为 false
                this._preserveScrollAroundTick();
                this.toolkit?.island?.notify?.(
                    'info',
                    '已更新上下文',
                    `当前聊天回合 → ${map[aiPersonId] ? '已启用' : '已停用'}`
                );
                // ★ v0.61.7 触发 prompt-manager 重画(必须 invalidate cache)
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}
                return map[aiPersonId];
            },

            /**
             * ★ v0.62.x 切换「回复格式与聊天风格」是否注入上下文
             *   - payload: { aiPersonId }
             *   - 状态存储:app.state.chat.replyFormatInject[aiPersonId]
             *   - 默认 true,切到 false 表示「不告诉 AI 格式 + 短句风格」(完全关闭)
             *   - 持久化到 localStorage 'xiaoting::chat-reply-format-inject-v1'
             *     (防 HMR / 旧实例不重跑 hydrate 时丢失,跟 systemPromptOverrides 同样模式)
             *   - prompt-builder.build({ opts.replyFormatInject: { enabled: true } }) → 末尾注入
             *     prompt-builder.build({ opts.replyFormatInject: { enabled: false } }) → 不注入
             */
            toggleReplyFormatActive(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                if (!aiPersonId) return null;
                if (!this.app.state) this.app.state = {};
                if (!this.app.state.chat) this.app.state.chat = {};
                const map = this.app.state.chat.replyFormatInject || (this.app.state.chat.replyFormatInject = {});
                map[aiPersonId] = !(map[aiPersonId] !== false); // 默认 true,切换为 false
                // ★ v0.62.x 持久化到 localStorage(防止 HMR 后内存丢失)
                try {
                    localStorage.setItem(
                        'xiaoting::chat-reply-format-inject-v1',
                        JSON.stringify(map),
                    );
                } catch (_) { /* 隐私模式 / 配额满 */ }
                this._preserveScrollAroundTick();
                this.toolkit?.island?.notify?.(
                    'info',
                    '已更新回复格式设置',
                    `回复格式与聊天风格 → ${map[aiPersonId] ? '已启用' : '已停用'}`,
                );
                // ★ 二段式重画(跟 toggleContextRoundsActive 完全对齐)
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}
                return map[aiPersonId];
            },

            /**
             * ★ v0.64 切换「AI 表情包库」是否注入上下文
             *   - payload: { aiPersonId }
             *   - 状态存储:app.state.chat.stickerLibraryInject[aiPersonId]
             *   - 默认 true(让 AI 知道能用什么表情包),切到 false 表示「完全不告诉 AI 表情包」
             *     (此时 AI 自己脑补 [表情包:瞎说] 会全部失败,但语义上等价于「关闭表情能力」)
             *   - 持久化到 localStorage 'xiaoting::chat-sticker-library-inject-v1'(防 HMR)
             *   - 模式跟 replyFormatInject / kChainActive 一致
             */
            toggleStickerLibraryActive(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                if (!aiPersonId) return null;
                if (!this.app.state) this.app.state = {};
                if (!this.app.state.chat) this.app.state.chat = {};
                const map = this.app.state.chat.stickerLibraryInject
                    || (this.app.state.chat.stickerLibraryInject = {});
                map[aiPersonId] = !(map[aiPersonId] !== false); // 默认 true,切换为 false
                try {
                    localStorage.setItem(
                        'xiaoting::chat-sticker-library-inject-v1',
                        JSON.stringify(map),
                    );
                } catch (_) { /* ignore */ }
                this._preserveScrollAroundTick();
                this.toolkit?.island?.notify?.(
                    'info',
                    '已更新表情包设置',
                    `AI 表情包库 → ${map[aiPersonId] ? '已启用' : '已停用'}`,
                );
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}
                return map[aiPersonId];
            },

            /**
             * ★ v0.63 切换「K 链摘要」是否注入上下文
             *   - payload: { aiPersonId }
             *   - 状态存储:app.state.chat.kChainActive[aiPersonId]
             *   - 默认 true,切到 false 表示「关闭 K 链注入」(K 链数据仍会保留)
             *   - 持久化到 localStorage 'xiaoting::chat-k-chain-active-v1'
             *   - 跟 reply-format 一样的模式
             */
            toggleKChainActive(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                if (!aiPersonId) return null;
                if (!this.app.state) this.app.state = {};
                if (!this.app.state.chat) this.app.state.chat = {};
                const map = this.app.state.chat.kChainActive || (this.app.state.chat.kChainActive = {});
                map[aiPersonId] = !(map[aiPersonId] !== false); // 默认 true,切换为 false
                // ★ v0.63 持久化到 localStorage(防止 HMR 后内存丢失)
                try {
                    localStorage.setItem(
                        'xiaoting::chat-k-chain-active-v1',
                        JSON.stringify(map),
                    );
                } catch (_) { /* 隐私模式 / 配额满 */ }
                this._preserveScrollAroundTick();
                this.toolkit?.island?.notify?.(
                    'info',
                    '已更新 K 链设置',
                    `K 链摘要 → ${map[aiPersonId] ? '已启用' : '已停用'}`,
                );
                // ★ 二段式重画(跟 toggleContextRoundsActive 完全对齐)
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}
                return map[aiPersonId];
            },

            /**
             * ★ v0.63.1 切换 K 链卡片的小眼睛预览面板(跟 previewAppPrompt 同样的状态机)
             *   - 用户期望(基于 8/8 反馈):
             *     · 点 summary(卡片本体)→ 展开 details 显示「真实拼接到上下文的 K 链概要」(text-panel)
             *     · 点小眼睛           → 显示「K 组里所有 K 的原文列表」(preview-panel,实时刷新)
             *     · 再点小眼睛         → 收起预览面板(同时收起 details,回到完全收起状态)
             *     · 两个面板互斥:真实概要 vs K 组原文不会同时显示
             *   - 复用 .pm-app-prompt-views + data-active="preview" 模式
             *   - 容器在 prompt-manager-page.js 的 renderKChainGroupItem 里生成,
             *     data-prompt-id="k-chain::{aiPersonId}"
             *   - 由于按钮在 <summary> 内,click 冒泡会触发 summary 的 toggle,
             *     必须主动 set details.open 来覆盖(微任务兜底)
             * payload: { aiPersonId }
             */
            previewKChainCard(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                if (!aiPersonId) return null;
                const compositeId = `k-chain::${aiPersonId}`;
                // 精确定位容器(避开 App Prompt 其它详情面板)
                const container = document.querySelector(
                    `.pm-kchain-views[data-prompt-id="${compositeId}"]`,
                );
                if (!container) return null;
                // 找外层 details
                const outerDetails = container.closest('details.pm-item') || container.closest('details');
                if (!outerDetails) return null;
                const cur = container.getAttribute('data-active') || '';
                let nextActive = '';
                let nextOpen = false;
                if (cur === 'preview') {
                    // 当前显示预览面板 → 再点收起(回到完全收起状态)
                    nextActive = '';
                    nextOpen = false;
                } else {
                    // 当前未显示预览面板 → 切到 preview
                    nextActive = 'preview';
                    nextOpen = true;
                }
                // 1) 同步设 data-active(切面板)
                if (nextActive) {
                    container.setAttribute('data-active', nextActive);
                } else {
                    container.removeAttribute('data-active');
                }
                // 2) 同步设 details.open(覆盖 summary 的 toggle 残留)
                if (outerDetails.open !== nextOpen) {
                    outerDetails.open = nextOpen;
                }
                // 3) 微任务兜底(覆盖任何异步残留)
                const targetOpen = nextOpen;
                queueMicrotask(() => {
                    try {
                        if (outerDetails.open !== targetOpen) {
                            outerDetails.open = targetOpen;
                        }
                    } catch (_) { /* noop */ }
                });
                // 4) 进入 preview 时滚到预览区
                if (nextActive === 'preview') {
                    try {
                        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    } catch (_) { /* noop */ }
                }
                return true;
            },

            /**
             * ★ v0.57 / 修于 v0.61.8.11:保留当前滚动位置后触发 framework 重画
             *   - 监听 detail 重画产生的 scrollTop 归零,重置回保存位置
             *   - 解决「点 prompt-manager 按钮 → 页面跳回顶部」的问题
             *   - ★ v0.61.8.11 修:chat-app 内的所有 detail 页都是**自接管滚动容器**
             *     (.prompt-manager > .pm-page / .chat-settings > .chat-settings-page /
             *      .new-group-page > .new-group-body / .new-chat-page > .new-chat-content /
             *      .chat-calendar-view > .chat-calendar-view-page / .chat-story-archive-page /
             *      .chat-favorites > .chat-favorites-scroll / .chat-private > .chat-messages ...),
             *     .app-detail-body 在 chat-app 内被设为 `overflow: hidden`,
             *     scrollTop 永远 = 0 → 老实现找错元素,scroll 保持完全失效,
             *     按任何按钮都跳回顶部。
             *   - 现在按优先级找正确的滚动容器:
             *     1) .prompt-manager 下的 .pm-page(本 bug 的核心场景)
             *     2) chat-app 内其他自接管页面的滚动容器(向后兼容)
             *     3) 兜底:.app-detail-body(理论上 framework 默认的滚动容器,
             *        但 chat-app 已把它设成 overflow:hidden,所以永远找不到内容)
             */
            _preserveScrollAroundTick() {
                try {
                    const root = document.querySelector('.app-shell[data-app-id="chat"]');
                    if (!root) { console.warn('[scroll-preserve] no chat shell'); return; }
                    // ★ v0.61.8.11 优先级:prompt-manager > 其它自接管页 > .app-detail-body
                    //   - 用 `:scope > X` 保证不嵌套到子组件里(比如 .pm-page 内部还有 .pm-context-preview__raw 也是 overflow:auto)
                    const candidates = [
                        '.prompt-manager .pm-page',
                        '.chat-settings .chat-settings-page',
                        '.new-group-page .new-group-body',
                        '.new-chat-page .new-chat-content',
                        '.chat-calendar-view .chat-calendar-view-page',
                        '.chat-story-archive-page',
                        '.chat-favorites .chat-favorites-scroll',
                        '.chat-history-page',
                        '.app-detail-body',
                    ];
                    let scroller = null;
                    let scrollerSel = '';
                    for (const sel of candidates) {
                        scroller = root.querySelector(sel);
                        if (scroller) { scrollerSel = sel; break; }
                    }
                    if (!scroller) {
                        console.warn('[scroll-preserve] no scroller found, candidates=', candidates);
                        return;
                    }
                    const savedTop = scroller.scrollTop;
                    if (savedTop === 0) {
                        // 本来就在顶部,不需要保存
                        return;
                    }
                    // ★ v0.61.8.11 MutationObserver 兜底:监听 rootEl(.app-detail-panel)子树变化,
                    //   一旦发现 .pm-page 被(重新)替换,立刻恢复 scrollTop。
                    //   这样不管 framework 的 mountInto / bridge.syncNow / Vue.nextTick
                    //   内部怎么异步,只要 .pm-page 出现就立即把 scrollTop 设回去。
                    //   - 防御节流:连发 100 次 restore 只接第 1 次(restored 锁)
                    //   - 兜底窗口:500ms 后自动 stop 监听(防内存泄漏)
                    const finalDetailEl = document.querySelector('.app-detail-panel');
                    if (!finalDetailEl) return;
                    let restored = false;
                    const restore = () => {
                        if (restored) return;
                        restored = true;
                        try {
                            const liveRoot = document.querySelector('.app-shell[data-app-id="chat"]');
                            const liveScroller = liveRoot ? liveRoot.querySelector(scrollerSel) : null;
                            const target = liveScroller || scroller;
                            if (target) {
                                target.scrollTop = savedTop;
                            }
                        } catch (e) {
                            // silent
                        }
                    };
                    // 1) 同步微任务尝试(vue v-html 同步替换,大部分情况已经在这一步生效)
                    queueMicrotask(restore);
                    // 2) setTimeout 多档兜底
                    setTimeout(restore, 0);
                    setTimeout(restore, 60);
                    setTimeout(restore, 200);
                    // 3) MutationObserver 兜底:监听 .app-detail-panel 子树变化,
                    //    任何子节点被替换 → 再尝试一次 restore
                    try {
                        const mo = new MutationObserver((mutations) => {
                            // 只关心子节点增删(childList),不关心 attribute / 文本
                            let relevant = false;
                            for (const m of mutations) {
                                if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
                                    relevant = true;
                                    break;
                                }
                            }
                            if (!relevant) return;
                            // 用 rAF 兜底,等 v-html + Vue.nextTick 完成后执行
                            requestAnimationFrame(() => {
                                if (!restored) {
                                    try { restore(); } catch (_) {}
                                }
                                // 多次重试:framework mountInto 完成后还有岛扫描 / 异步组件挂载
                                setTimeout(() => { if (!restored) restore(); }, 50);
                                setTimeout(() => { if (!restored) restore(); }, 150);
                            });
                        });
                        mo.observe(finalDetailEl, { childList: true, subtree: true });
                        // 1.2s 后自动断开监听(防内存泄漏)
                        setTimeout(() => {
                            try { mo.disconnect(); } catch (_) {}
                        }, 1200);
                    } catch (e) {
                        console.warn('[scroll-preserve] MutationObserver failed', e);
                    }
                } catch (e) {
                    console.warn('[scroll-preserve] outer failed', e);
                }
            },

            /**
             * 编辑系统 prompt → 打开弹窗(只编辑「回复须知」文本 + 位置 before/after)
             * payload: { kind: 'user' | 'ai' }
             * 不改 settings 的人设,只存 chat-app 自己的 override。
             */
            openSystemPromptEditor(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                const kind = payload?.kind === 'ai' ? 'ai' : (payload?.kind === 'sticker-library' ? 'sticker-library' : 'user');
                if (!aiPersonId) return null;
                // ★ v0.64 「AI 表情包库」编辑入口:弹自己的 modal(跟其它 replyPrompt/系统 prompt 卡行为一致)
                //   - 用户原话:「不要跳转,出现弹窗就好了,跟别的卡片一样」
                //   - 字段语义:title=卡片名 / content=注入到 prompt 的文本(可编辑) / active=注入开关
                //   - 不跳 settings(避免「点编辑就跳到另一个 app」的割裂感)
                if (kind === 'sticker-library') {
                    try {
                        if (!chatModalManager?.openEditReplyPrompt) {
                            this.toolkit?.island?.notify?.('error', '弹窗组件未加载');
                            return null;
                        }
                        // ★ 读现有状态(从内存 → localStorage 兜底)
                        let stickerMap = this.app?.state?.chat?.stickerLibraryInject;
                        if (!stickerMap || Object.keys(stickerMap).length === 0) {
                            try {
                                const raw = localStorage.getItem('xiaoting::chat-sticker-library-inject-v1');
                                if (raw) {
                                    stickerMap = JSON.parse(raw);
                                    if (this.app?.state?.chat) this.app.state.chat.stickerLibraryInject = stickerMap;
                                }
                            } catch (_) { /* ignore */ }
                        }
                        stickerMap = stickerMap || {};
                        const currentActive = stickerMap[aiPersonId] !== false; // 默认 true
                        // ★ 注入文本(默认占位,允许用户编辑后保存)
                        const defaultContent = [
                            '# AI 表情包库',
                            '',
                            '你现在可以发送表情包给用户,用以下格式:',
                            '[表情包:表情名称]',
                            '',
                            '示例:',
                            '[表情包:狗-哭]',
                            '[表情包:蝴蝶-飞飞]',
                            '[表情包:开心]',
                            '',
                            '规则:',
                            '1) 只能使用下面列表里的名称,不要自己编造表情名;',
                            '2) 不要每条消息都发表情包,自然使用;',
                            '3) 表情包不能取代文字,跟文字一起出现。',
                        ].join('\n');
                        chatModalManager.openEditReplyPrompt({
                            initial: {
                                title: 'AI 表情包库',
                                content: defaultContent,
                                source: 'sticker-library',
                                active: currentActive,
                            },
                            isCreate: false,
                            onSave: (next) => {
                                const nextActive = next?.active !== false;
                                // 1) 更新注入开关(走 toggleStickerLibraryActive 同一份持久化)
                                if (!this.app.state) this.app.state = {};
                                if (!this.app.state.chat) this.app.state.chat = {};
                                if (!this.app.state.chat.stickerLibraryInject) {
                                    this.app.state.chat.stickerLibraryInject = {};
                                }
                                const prev = this.app.state.chat.stickerLibraryInject[aiPersonId];
                                if (nextActive !== prev) {
                                    this.app.state.chat.stickerLibraryInject[aiPersonId] = nextActive;
                                }
                                // 2) 持久化(同一份 localStorage 路径)
                                try {
                                    localStorage.setItem(
                                        'xiaoting::chat-sticker-library-inject-v1',
                                        JSON.stringify(this.app.state.chat.stickerLibraryInject),
                                    );
                                } catch (_) { /* 隐私模式 / 配额满 */ }
                                // 3) 保存自定义 content(允许用户编辑注入文本本身)
                                //    跟 replyFormatInject 同样的三段式:内存 + localStorage 兜底
                                let noteMap = this.app?.state?.chat?.stickerLibraryNote;
                                if (!noteMap || typeof noteMap !== 'object') noteMap = {};
                                noteMap[aiPersonId] = String(next?.content || defaultContent);
                                if (this.app?.state?.chat) this.app.state.chat.stickerLibraryNote = noteMap;
                                try {
                                    localStorage.setItem(
                                        'xiaoting::chat-sticker-library-note-v1',
                                        JSON.stringify(noteMap),
                                    );
                                } catch (_) { /* ignore */ }
                                // 4) 保留滚动位置
                                this._preserveScrollAroundTick();
                                // 5) 二段式重画(让 prompt-manager 立即反映新 active 状态)
                                try {
                                    if (typeof window.invalidateRendererCache === 'function') {
                                        window.invalidateRendererCache('chat', null);
                                    }
                                } catch (_) {}
                                try {
                                    window.__appRendererBridge?.syncNow?.({ force: true });
                                } catch (_) {}
                                this.toolkit?.island?.notify?.(
                                    'success',
                                    '已保存',
                                    `AI 表情包库 → ${nextActive ? '已启用' : '已停用'}`
                                );
                            },
                        });
                    } catch (err) {
                        console.warn('[chat-app] openSystemPromptEditor sticker-library failed:', err);
                        this.toolkit?.island?.notify?.('error', '打开弹窗失败', err?.message);
                    }
                    return null;
                }
                try {
                    if (!chatModalManager?.openSystemPromptEdit) {
                        this.toolkit?.island?.notify?.('error', '弹窗组件未加载');
                        return null;
                    }
                    const sdk = window.settingsSdk;
                    const user = sdk?.users?.getActive?.() || null;
                    const ai = sdk?.aiPersons?.get?.(aiPersonId) || null;
                    const persona = kind === 'user' ? user : ai;
                    if (!persona) {
                        this.toolkit?.island?.notify?.('warning', '人设不存在');
                        return null;
                    }
                    const baseContent = kind === 'user'
                        ? buildUserPersonaContextText(user)
                        : buildAiPersonaContextText(ai);
                    const existing = this._getSystemPromptOverride(aiPersonId, kind);
                    chatModalManager.openSystemPromptEdit({
                        kind,
                        aiPersonId,
                        title: kind === 'user' ? '当前用户人设' : '当前 AI 人设',
                        baseContent,
                        replyNote: existing?.note ?? defaultReplyNote(kind),
                        position: existing?.position ?? 'after',
                        onSave: ({ note, position }) => {
                            this._setSystemPromptOverride(aiPersonId, kind, { note, position });
                            // ★ v0.61.8.11 保留滚动位置
                            this._preserveScrollAroundTick();
                            // ★ v0.58 修复:保存后必须触发 framework 重画 prompt-manager,
                            //   否则位置切换 / 回复须知变更在 UI 上看不到任何反馈。
                            //   同时派发 chat:reply-prompt-updated 事件,跟其他 replyPrompt
                            //   方法(toggle / move / edit / delete)保持一致。
                            //   ★ v0.61.8.11 同步改成 invalidate cache + syncNow 二段式
                            //   (老代码用 ++detailRenderTick,在 async renderMode 下会被
                            //    resolveAsyncRenderer 缓存拦截,导致 system prompt 内容不变)
                            try {
                                if (typeof window.invalidateRendererCache === 'function') {
                                    window.invalidateRendererCache('chat', null);
                                }
                            } catch (_) {}
                            try {
                                const bridge = window.__appRendererBridge;
                                if (bridge && typeof bridge.syncNow === 'function') {
                                    bridge.syncNow({ force: true });
                                } else if (window.__detailRenderTick) {
                                    window.__detailRenderTick.value++;
                                }
                            } catch (_) { /* ignore */ }
                            try {
                                window.dispatchEvent(new CustomEvent('chat:reply-prompt-updated', {
                                    detail: {
                                        aiPersonId,
                                        promptId: `system-${kind}-persona`,
                                        action: 'system-prompt-edit',
                                        kind,
                                        note,
                                        position,
                                    },
                                }));
                            } catch (_) {}
                            this.toolkit?.island?.notify?.('success', '已保存');
                        },
                    });
                } catch (err) {
                    console.error('[chat-app] openSystemPromptEditor failed:', err);
                    this.toolkit?.island?.notify?.('error', '打开弹窗失败', err?.message);
                }
            },

            /**
             * ★ v0.58 读系统 prompt 的 override
             *   - 优先从内存 app.state.chat.systemPromptOverrides 读(可能还没同步进 localStorage)
             *   - 兜底从 localStorage 读(刷新后 / app 重启后内存被清)
             */
_getSystemPromptOverride(aiPersonId, kind) {
    const memMap = this.app?.state?.chat?.systemPromptOverrides || {};
    const fromMem = memMap[aiPersonId]?.[kind];
    if (fromMem) return fromMem;
    try {
        const diskMap = _loadSystemPromptOverrides();
        return diskMap[aiPersonId]?.[kind] || null;
    } catch (_) { return null; }
},

/**
             * ★ v0.58 写系统 prompt 的 override
             *   - 同时落内存 + localStorage(刷新后还在)
             */
_setSystemPromptOverride(aiPersonId, kind, { note, position }) {
    if (!this.app.state.chat) this.app.state.chat = {};
    const memMap = this.app.state.chat.systemPromptOverrides
        || (this.app.state.chat.systemPromptOverrides = {});
    if (!memMap[aiPersonId]) memMap[aiPersonId] = {};
    memMap[aiPersonId][kind] = {
        note: String(note ?? ''),
        position: position === 'before' ? 'before' : 'after',
        updatedAt: Date.now(),
    };
    // 落 localStorage 兜底
    _saveSystemPromptOverrides(memMap);
},

            /**
             * ★ v0.43 复制消息文本
             *  - 优先 navigator.clipboard.writeText
             *  - 退化:临时 textarea + execCommand('copy')
             */
            async copyMessage(payload = {}) {
                const { messageId, aiPersonId, mode } = payload;
                if (!messageId) {
                    this.toolkit?.island?.notify?.('warning', '缺少消息 ID');
                    return;
                }

                // ★ v0.44 从 IndexedDB 获取消息原始内容
                let text = '';
                const sdk = window.settingsSdk;
                try {
                    const messages = sdk?.chatMessages?.list?.(
                        sdk.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.(),
                        aiPersonId,
                        mode || 'calendar'
                    ) || [];
                    const msg = messages.find(m => m.id === messageId);
                    text = msg?.content || '';
                } catch (_) {}

                if (!text) {
                    this.toolkit?.island?.notify?.('warning', '没有可复制的文本', '该消息没有文字内容');
                    return;
                }

                try {
                    if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(text);
                    } else {
                        const ta = document.createElement('textarea');
                        ta.value = text;
                        ta.style.position = 'fixed';
                        ta.style.opacity = '0';
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                    }
                    this.toolkit?.island?.notify?.('success', '已复制', text.length > 20 ? `${text.slice(0, 20)}…` : text);
                } catch (err) {
                    console.warn('[chat] copyMessage failed', err);
                    this.toolkit?.island?.notify?.('error', '复制失败', err?.message || '');
                }
            },

            /**
             * ★ v0.43 切换多选模式（顶栏「多选」按钮点击）
             *  - 多选模式开启中 → 退出
             *  - 多选模式未开启 → 进入
             */
            toggleMultiSelect(payload = {}) {
                const app = this.app;
                const st = this._ensureChatActionState(app);
                const wasActive = !!st.multiSelectActive;
                st.multiSelectActive = !wasActive;
                if (!wasActive) {
                    // 进入多选模式时清空选中
                    st.selectedMessages = new Set();
                    if (payload.aiPersonId) st.aiPersonId = payload.aiPersonId;
                    if (payload.mode) st.mode = payload.mode;
                } else {
                    // 退出时也清空
                    st.selectedMessages = new Set();
                }
                // ★ FIX v0.47.1: 不触发全量重渲，只刷新 DOM class
                //   _triggerChatActionRerender 会导致 v-html 替换整个 DOM，
                //   initPrivateChatInteractions 的防重绑定标记随旧节点一起消失
                // this._triggerChatActionRerender();
                queueMicrotask(() => this._refreshMultiSelectUI());
            },

            /**
             * ★ v0.43 进入多选模式（仅入口调用，进入后切 toggleMultiSelect）
             *  - 清空 selectedMessages，打开多选模式标记
             *  - payload: { aiPersonId, mode }
             */
            enterMultiSelect(payload = {}) {
                const app = this.app;
                const st = this._ensureChatActionState(app);
                if (payload.aiPersonId) st.aiPersonId = payload.aiPersonId;
                if (payload.mode) st.mode = payload.mode;
                st.multiSelectActive = true;
                st.selectedMessages = new Set();
                // ★ FIX v0.47.1: 不触发全量重渲，只刷新 DOM class
                // this._triggerChatActionRerender();
                queueMicrotask(() => this._refreshMultiSelectUI());
            },

            /**
             * ★ v0.43 退出多选模式(底部「取消」按钮 / 按 ESC / 离开页面)
             */
            exitMultiSelect() {
                const app = this.app;
                const st = this._ensureChatActionState(app);
                st.multiSelectActive = false;
                st.selectedMessages = new Set();
                // ★ FIX v0.47.1: 不触发全量重渲，只刷新 DOM class
                // this._triggerChatActionRerender();
                queueMicrotask(() => this._refreshMultiSelectUI());
            },

            /**
             * ★ v0.43 切换消息选中状态(每条消息左侧的圆圈按钮)
             *  - payload: { messageId, aiPersonId, mode }
             */
            toggleMessageSelect(payload = {}) {
                const { messageId, aiPersonId, mode } = payload;
                if (!messageId) return;
                const app = this.app;
                const st = this._ensureChatActionState(app);
                const key = `${aiPersonId || st.aiPersonId || ''}::${mode || st.mode || 'calendar'}::${messageId}`;
                if (st.selectedMessages.has(key)) {
                    st.selectedMessages.delete(key);
                } else {
                    st.selectedMessages.add(key);
                }
                this._triggerChatActionRerender();
                queueMicrotask(() => this._refreshMultiSelectUI());
            },

            /**
             * ★ v0.43 同步多选 UI(选中数 + body class)
             *  - 因为 v-html 不响应 app.state 变化,所以手动改 DOM
             *  - 只动 .multi-select-count / .chat-private[多选class] / 单条气泡的 .is-selected
             */
            _refreshMultiSelectUI() {
                try {
                    const root = document.querySelector('.app-shell[data-app-id="chat"]');
                    if (!root) return;
                    const app = this.app;
                    const st = (app.state.chat && app.state.chat.action) || {};
                    const chat = root.querySelector('.chat-private');
                    if (!chat) return;
                    const isActive = !!st.multiSelectActive;
                    if (isActive) chat.classList.add('multi-select-mode');
                    else chat.classList.remove('multi-select-mode');
                    // ★ FIX v0.48:HTML 渲染时给 .multi-select-bar 写了内联 style="display:none"
                    //   (chat-page.js multiSelectBarStyle)，优先级高于 CSS class 选择器
                    //   .multi-select-mode .multi-select-bar { display: flex }，导致 class 加了但条不出现。
                    //   必须直接操作内联 style 才能生效。
                    const bar = chat.querySelector('.multi-select-bar');
                    if (bar) bar.style.display = isActive ? 'flex' : 'none';
                    const countEl = chat.querySelector('.multi-select-count strong[data-selected-count], .multi-select-count [data-selected-count]');
                    if (countEl) countEl.textContent = String((st.selectedMessages && st.selectedMessages.size) || 0);
                    const bubbles = chat.querySelectorAll('[data-message-id]');
                    bubbles.forEach((el) => {
                        const id = el.getAttribute('data-message-id');
                        const aiId = el.getAttribute('data-msg-ai') || (st.aiPersonId || '');
                        const md = el.getAttribute('data-msg-mode') || (st.mode || 'calendar');
                        const key = `${aiId}::${md}::${id}`;
                        if (st.selectedMessages && st.selectedMessages.has(key)) el.classList.add('is-selected');
                        else el.classList.remove('is-selected');
                    });
                } catch (err) {
                    console.warn('[chat] _refreshMultiSelectUI failed', err);
                }
            },

            /**
             * ★ v0.44 多选模式 — 收藏
             *  - 形成对话片段,需要 ≥2 条消息
             *  - 对话片段存到 app.state (内存),刷新页面后需要重新收藏
             *  - 从 DOM 读取真实选中状态
             */
            async favoriteMulti() {
                const chatPrivate = document.querySelector('.chat-private');
                if (!chatPrivate) {
                    this.toolkit?.island?.notify?.('error', '页面结构异常');
                    return;
                }
                const selectedWrappers = chatPrivate.querySelectorAll('.message-wrapper.selected');
                const count = selectedWrappers.length;
                if (count < 2) {
                    this.toolkit?.island?.notify?.('info', '请至少选择 2 条消息', '对话片段需要多条消息');
                    return;
                }
                const sdk = window.settingsSdk;
                const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                if (!user) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户');
                    return;
                }

                // 收集选中消息并按 DOM 顺序排列
                const selectedMsgs = [];
                const mode = 'calendar';
                const aiPersonId = 'ai0';

                for (const wrapper of selectedWrappers) {
                    const messageId = wrapper.getAttribute('data-message-id');
                    const msgAi = wrapper.getAttribute('data-msg-ai') || aiPersonId;
                    const msgMode = wrapper.getAttribute('data-msg-mode') || mode;
                    if (!messageId) continue;
                    const msgs = sdk?.chatMessages?.list ? sdk.chatMessages.list(user, msgAi, msgMode) : [];
                    const target = msgs.find((m) => m.id === messageId);
                    if (target) selectedMsgs.push(target);
                }

                if (selectedMsgs.length < 2) {
                    this.toolkit?.island?.notify?.('info', '请至少选择 2 条消息', '对话片段需要多条消息');
                    return;
                }

                // 构建对话片段收藏
                const contactName = (() => {
                    try {
                        const meta = window.aiMeta?.getAiMeta?.(aiPersonId, mode);
                        return meta?.name || aiPersonId;
                    } catch (_) { return aiPersonId; }
                })();

                const conversation = {
                    // ★ v0.44:用 id 而不是 favoriteId,保持跟 sdk.chatFavorites.list 返回结构一致
                    id: 'conv-' + Date.now(),
                    type: 'conversation',
                    sourceType: 'private',
                    sourceId: aiPersonId,
                    sourceName: contactName,
                    time: '今天 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                    messageCount: selectedMsgs.length,
                    messages: selectedMsgs.map(msg => ({
                        id: msg.id,
                        sender: msg.sender,
                        senderName: msg.senderName || (msg.sender === 'user' ? '我' : contactName),
                        senderColor: msg.sender === 'user' ? 'pink' : 'blue',
                        type: msg.type || 'text',
                        content: msg.content || msg.text || '',
                        time: msg.time || msg.timestamp,
                        imagePreview: msg.imageDescription ? (msg.imageDescription.substring(0, 20) + '...') : null,
                        cardColor: msg.cardColor || null,
                        locationName: msg.locationCard?.name || null,
                        locationAddress: msg.locationCard?.address || null,
                    })),
                };

                // ★ v0.44:对话片段存到 app.state._conversationFavorites (内存)
                //  结构跟 sdk.chatFavorites.list 一致,合并时不会冲突
                const app = this.app;
                if (!app.state) app.state = {};
                if (!app.state._conversationFavorites) app.state._conversationFavorites = [];
                app.state._conversationFavorites.unshift(conversation);

                this.toolkit?.island?.notify?.('success', '收藏成功', `已收藏 ${selectedMsgs.length} 条消息为对话片段`);
                this.exitMultiSelect();

                // 触发收藏页重渲染
                window.__detailRenderTick && window.__detailRenderTick.value++;
            },

            /**
             * ★ v0.44 多选模式 — 转发
             *  - 从 DOM 读取真实选中状态
             */
            async forwardMulti() {
                const chatPrivate = document.querySelector('.chat-private');
                if (!chatPrivate) {
                    this.toolkit?.island?.notify?.('error', '页面结构异常');
                    return;
                }
                const selectedWrappers = chatPrivate.querySelectorAll('.message-wrapper.selected');
                if (selectedWrappers.length === 0) {
                    this.toolkit?.island?.notify?.('info', '请先选择消息');
                    return;
                }
                const sdk = window.settingsSdk;
                const user = sdk?.users?.getActive?.() || sdk?.defaultUserCard?.getDefault?.();
                if (!user) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户');
                    return;
                }
                // 收集选中的消息
                const items = [];
                for (const wrapper of selectedWrappers) {
                    const messageId = wrapper.getAttribute('data-message-id');
                    const aiPersonId = wrapper.getAttribute('data-msg-ai') || '';
                    const mode = wrapper.getAttribute('data-msg-mode') || 'calendar';
                    if (!messageId) continue;
                    const msgs = sdk?.chatMessages?.list ? sdk.chatMessages.list(user, aiPersonId, mode) : [];
                    const target = msgs.find((m) => m.id === messageId);
                    if (target) items.push({ aiPersonId, mode, messageId, content: target.content || target.text || '', type: target.type || 'text', sender: target.sender });
                }
                if (!items.length) {
                    this.toolkit?.island?.notify?.('warning', '未找到可转发的消息');
                    return;
                }
                // 使用 chat-forward.js 的 openForwardTargetSelection（会生成转发卡片 + 排除当前会话）
                const { openForwardTargetSelection } = await import('./chat-forward.js');
                const sourceMeta = {
                    conversationType: 'private',
                    conversationId: items[0].aiPersonId,
                    mode: items[0].mode,
                };
                await openForwardTargetSelection({
                    mode: items[0].mode,
                    messageIds: items.map(i => i.messageId),
                    sourceMessages: items.map(i => ({
                        id: i.messageId,
                        sender: i.sender,
                        senderName: i.sender === 'user' ? '我' : (this.app.state?.currentAiName || 'AI'),
                        content: i.content,
                        type: i.type,
                        timestamp: Date.now(),
                    })),
                    sourceMeta,
                });
                this.exitMultiSelect();
            },

            /**
             * ★ v0.44 多选模式 — 删除
             *  - 从 DOM 读取真实选中状态
             */
            async deleteMulti() {
                const chatPrivate = document.querySelector('.chat-private');
                if (!chatPrivate) {
                    this.toolkit?.island?.notify?.('error', '页面结构异常');
                    return;
                }
                const selectedWrappers = chatPrivate.querySelectorAll('.message-wrapper.selected');
                if (selectedWrappers.length === 0) {
                    this.toolkit?.island?.notify?.('info', '请先选择消息');
                    return;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.chatMessages) {
                    this.toolkit?.island?.notify?.('error', '聊天存储未就绪');
                    return;
                }
                const user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                if (!user) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户');
                    return;
                }
                let ok = 0;
                let fail = 0;
                for (const wrapper of selectedWrappers) {
                    const messageId = wrapper.getAttribute('data-message-id');
                    const aiPersonId = wrapper.getAttribute('data-msg-ai') || '';
                    const mode = wrapper.getAttribute('data-msg-mode') || 'calendar';
                    if (!messageId) { fail++; continue; }
                    try {
                        const removed = await sdk.chatMessages.remove(messageId);
                        if (!removed) { fail++; continue; }
                        if (user && sdk.chatFavorites?.has?.(user, aiPersonId, mode, messageId)) {
                            await sdk.chatFavorites.remove(user, aiPersonId, mode, messageId);
                        }
                        ok++;
                    } catch (_) { fail++; }
                }
                this.toolkit?.island?.notify?.('success', `已删除 ${ok} 条`, fail > 0 ? `${fail} 条失败` : '');
                this.exitMultiSelect();
                window.__detailRenderTick && window.__detailRenderTick.value++;
            },

            /**
             * ★ v0.43 触发语音通话(顶部语音通话按钮)
             *  - 简单占位:灵动岛提示 + 实际进入 call 页留给后续
             */
            async triggerVoiceCall(payload = {}) {
                const aiPersonId = payload.aiPersonId || (this.app?.state?.chat?.action?.aiPersonId);
                const mode = payload.mode || (this.app?.state?.chat?.action?.mode) || 'calendar';
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('warning', '缺少联系人上下文');
                    return;
                }
                this.toolkit?.island?.notify?.('info', '正在呼叫…', '语音通话');
                try {
                    const action = { action: 'detail', appId: 'chat', pageId: `call-${aiPersonId}-${mode}-voice` };
                    document.dispatchEvent(new CustomEvent('app:page-action', { detail: action, bubbles: true }));
                } catch (err) {
                    console.warn('[chat] triggerVoiceCall dispatch failed', err);
                }
            },

            /**
             * ★ v0.43 触发视频通话
             */
            async triggerVideoCall(payload = {}) {
                const aiPersonId = payload.aiPersonId || (this.app?.state?.chat?.action?.aiPersonId);
                const mode = payload.mode || (this.app?.state?.chat?.action?.mode) || 'calendar';
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('warning', '缺少联系人上下文');
                    return;
                }
                this.toolkit?.island?.notify?.('info', '正在呼叫…', '视频通话');
                try {
                    const action = { action: 'detail', appId: 'chat', pageId: `call-${aiPersonId}-${mode}-video` };
                    document.dispatchEvent(new CustomEvent('app:page-action', { detail: action, bubbles: true }));
                } catch (err) {
                    console.warn('[chat] triggerVideoCall dispatch failed', err);
                }
            },

            /**
             * ★ v0.44 转发消息（单条）
             *  - 复用 chat-forward.js 的 openForwardTargetSelection（生成转发卡片 + 排除当前会话）
             *  - payload: { messageId, aiPersonId, mode, text, sender, senderLabel, type }
             */
            async forwardMessage(payload = {}) {
                const { messageId, aiPersonId, mode, text, sender, type, conversationType, groupId } = payload;
                if (!messageId || (!aiPersonId && !groupId)) {
                    this.toolkit?.island?.notify?.('warning', '缺少消息上下文', '无法转发');
                    return;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.chatMessages) {
                    this.toolkit?.island?.notify?.('error', '聊天存储未就绪');
                    return;
                }
                const sourceMode = mode || 'calendar';
                const user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                if (!user) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户');
                    return;
                }
                // ★ v0.62 群聊转发支持(aiPersonId 字段对群聊就是 groupId)
                const convType = conversationType || (groupId ? 'group' : 'private');
                const convId = aiPersonId || groupId;
                // 使用 chat-forward.js 的 openForwardTargetSelection（会生成转发卡片 + 排除当前会话）
                const { openForwardTargetSelection } = await import('./chat-forward.js');
                const sourceMeta = {
                    conversationType: convType,
                    conversationId: convId,
                    mode: sourceMode,
                    conversationName: payload?.conversationName || '',
                };
                // 单条消息也包装成 sourceMessages 数组，用于生成转发卡片
                const sourceMessages = [{
                    id: messageId,
                    sender: sender || 'user',
                    senderName: sender === 'user' ? '我' : (this.app.state?.currentAiName || 'AI'),
                    content: text || '',
                    type: type || 'text',
                    timestamp: Date.now(),
                }];
                await openForwardTargetSelection({
                    mode: sourceMode,
                    messageIds: [messageId],
                    sourceMessages,
                    sourceMeta,
                });
            },

            /**
             * ★ v0.44 消息删除（带确认弹窗）
             *  - 弹出确认对话框，用户确认后才执行删除
             *  - 联动:如果在 sdk.chatFavorites 里有快照,一并清掉
             *  - payload: { messageId, aiPersonId, mode }
             */
            async deleteMessage(payload = {}) {
                const { messageId, aiPersonId, mode } = payload;
                if (!messageId || !aiPersonId) {
                    this.toolkit?.island?.notify?.('warning', '缺少消息上下文');
                    return;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.chatMessages) {
                    this.toolkit?.island?.notify?.('error', '聊天存储未就绪');
                    return;
                }
                const targetMode = mode || 'calendar';

                // ★ v0.44 弹出确认对话框
                chatModalManager.openMessageDeleteConfirm({
                    onConfirm: async () => {
                        let user = null;
                        try {
                            user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                        } catch (_) {}
                        try {
                            const removed = await sdk.chatMessages.remove(messageId);
                            if (!removed) {
                                this.toolkit?.island?.notify?.('warning', '消息已被删除');
                                return;
                            }
                            if (user && sdk.chatFavorites?.has?.(user, aiPersonId, targetMode, messageId)) {
                                await sdk.chatFavorites.remove(user, aiPersonId, targetMode, messageId);
                            }
                            this.toolkit?.island?.notify?.('success', '已删除');
                            this._triggerChatActionRerender();
                        } catch (err) {
                            console.warn('[chat] deleteMessage failed', err);
                            this.toolkit?.island?.notify?.('error', '删除失败', err?.message || '');
                        }
                    },
                    onClose: () => {
                        // 用户取消删除，什么都不做
                    },
                });
            },

            /**
             * ★ v0.44 收藏单条消息
             *  - 未收藏:直接添加
             *  - 已收藏:弹窗确认是否取消
             *  - payload: { messageId, aiPersonId, mode }
             */
            async favoriteMessage(payload = {}) {
                const { messageId, aiPersonId, mode } = payload;
                if (!messageId || !aiPersonId) {
                    this.toolkit?.island?.notify?.('warning', '缺少消息上下文');
                    return;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.chatFavorites) {
                    this.toolkit?.island?.notify?.('error', '收藏服务未就绪');
                    return;
                }
                const targetMode = mode || 'calendar';
                try {
                    const user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                    if (!user) {
                        this.toolkit?.island?.notify?.('error', '未找到默认用户');
                        return;
                    }
                    // ★ v0.44:已收藏则弹确认框,未收藏则直接添加
                    if (sdk.chatFavorites.has(user, aiPersonId, targetMode, messageId)) {
                        window.__phoneConfirm?.request({
                            title: '取消收藏',
                            text: '确定要取消收藏这条消息吗？',
                            confirmLabel: '取消收藏',
                            danger: true,
                            onConfirm: async () => {
                                await sdk.chatFavorites.remove(user, aiPersonId, targetMode, messageId);
                                if (window.__chatFavoritedIds) {
                                    window.__chatFavoritedIds.delete(`${aiPersonId}|${targetMode}|${messageId}`);
                                }
                                window.__detailRenderTick && window.__detailRenderTick.value++;
                                this.toolkit?.island?.notify?.('info', '已取消收藏');
                            },
                            onCancel: () => {},
                        });
                        return;
                    }
                    const messages = sdk.chatMessages?.list
                        ? sdk.chatMessages.list(user, aiPersonId, targetMode)
                        : [];
                    const target = messages.find((m) => m.id === messageId);
                    if (!target) {
                        this.toolkit?.island?.notify?.('warning', '消息已不存在', '无法收藏');
                        return;
                    }
                    const contactName = (() => {
                        try {
                            const meta = window.aiMeta?.getAiMeta?.(aiPersonId, targetMode);
                            return meta?.name || aiPersonId;
                        } catch (_) { return aiPersonId; }
                    })();
                    await sdk.chatFavorites.add(user, aiPersonId, targetMode, {
                        ...target,
                        _contactName: contactName,
                        _favoritedAt: Date.now(),
                    }, {
                        contactName,
                        messageType: target.type || 'text',
                    });
                    if (window.__chatFavoritedIds) {
                        window.__chatFavoritedIds.add(`${aiPersonId}|${targetMode}|${messageId}`);
                    }
                    window.__detailRenderTick && window.__detailRenderTick.value++;
                    this.toolkit?.island?.notify?.('success', '已收藏', contactName);
                } catch (err) {
                    console.warn('[chat] favoriteMessage failed', err);
                    this.toolkit?.island?.notify?.('error', '收藏失败', err?.message || '');
                }
            },

            /**
             * ★ v0.43 引用回复(写入 app.state.chat.action.replyingTo,渲染时显示 reply-preview)
             *  - payload: { messageId, aiPersonId, mode, text, sender, senderLabel }
             *  - 不需要持久化,只存内存;切走或发送后清掉
             */
            quoteMessage(payload = {}) {
                const app = this.app;
                const st = this._ensureChatActionState(app);
                console.log('[chat] quoteMessage called, payload:', JSON.stringify(payload));
                if (!payload.messageId || !payload.aiPersonId) {
                    this.toolkit?.island?.notify?.('warning', '缺少消息上下文', '无法引用');
                    return;
                }
                const replyingTo = {
                    messageId: payload.messageId,
                    aiPersonId: payload.aiPersonId,
                    mode: payload.mode || 'calendar',
                    text: payload.text || '',
                    sender: payload.sender || 'ai',
                    senderLabel: payload.senderLabel || '',
                    createdAt: Date.now(),
                };
                console.log('[chat] quoteMessage set replyingTo:', JSON.stringify(replyingTo));
                st.replyingTo = replyingTo;
                this._triggerChatActionRerender();
            },

            /**
             * ★ v0.43 取消引用回复
             */
            cancelReply() {
                const app = this.app;
                const st = this._ensureChatActionState(app);
                st.replyingTo = null;
                this._triggerChatActionRerender();
            },

            /**
             * ★ v0.43 编辑消息(打开 MessageEditModal 弹窗,复用 chat-modal-registry.openMessageEdit)
             *  - payload 来自 message-actions.js 的编辑按钮:
             *      { messageId, aiPersonId, mode, text, sender }
             *  - 仅 user 自己发的消息可编辑(sender === 'user')
             *  - 保存后:走 sdk.chatMessages.update → 触发 __detailRenderTick 重画
             */
            async editMessage(payload = {}) {
                const { messageId, aiPersonId, mode, text, sender } = payload;
                if (!messageId || !aiPersonId) {
                    this.toolkit?.island?.notify?.('warning', '缺少消息上下文', 'messageId / aiPersonId 为空');
                    return;
                }
                if (sender && sender !== 'user') {
                    this.toolkit?.island?.notify?.('warning', '只能编辑自己发的消息');
                    return;
                }
                const aiLabel = (() => {
                    try {
                        const snap = window.aiMeta?.getAiMeta?.(aiPersonId, mode);
                        return snap?.name || aiPersonId;
                    } catch (_) { return aiPersonId; }
                })();
                chatModalManager.openMessageEdit({
                    originalText: text || '',
                    senderLabel: aiLabel,
                    messageType: 'text',
                    editable: true,
                    onSave: async (newText) => {
                        const sdk = window.settingsSdk;
                        if (!sdk?.chatMessages) {
                            this.toolkit?.island?.notify?.('error', '聊天存储未就绪');
                            return;
                        }
                        const trimmed = String(newText || '').trim();
                        if (!trimmed) {
                            this.toolkit?.island?.notify?.('warning', '内容不能为空');
                            return;
                        }
                        try {
                            const updated = await sdk.chatMessages.update(messageId, { content: trimmed, editedAt: Date.now() });
                            if (updated === null) {
                                this.toolkit?.island?.notify?.('error', '消息已被删除或存储失败');
                                return;
                            }
                            this.toolkit?.island?.notify?.('success', '已保存', trimmed.length > 18 ? `${trimmed.slice(0, 18)}…` : trimmed);
                            this._triggerChatActionRerender();
                        } catch (err) {
                            console.warn('[chat] editMessage failed', err);
                            this.toolkit?.island?.notify?.('error', '保存失败', err?.message || '');
                        }
                    },
                });
            },

            /**
             * 打开发起聊天页面（v0.24 改造：直接进入「添加新朋友」联系人列表）
             *   - 不再走 record-mode-selector 详情页
             *   - 模式选择改在「点击联系人」时弹窗（pickContactForMode）
             */
            openNewChat() {
                const action = { action: 'detail', appId: 'chat', pageId: 'new-chat' };
                document.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: action,
                    bubbles: true,
                }));
            },

            // ============================================================
            // ★ v0.36 收藏页交互 methods(由 data-app-action 派发)
            //   状态保存在 app.state.chat.favorites,跟 DOM 解耦
            //   每次改动后 __detailRenderTick.value++ 让 framework 重画整页
            // ============================================================

            _ensureFavoritesState(app) {
                if (!app.state.chat) app.state.chat = {};
                if (!app.state.chat.favorites) {
                    app.state.chat.favorites = {
                        category: 'all',
                        searchKeyword: '',
                        expandedConv: new Set(),
                        expandedContext: new Set(),
                    };
                }
                // 兼容:旧调用可能传 Array,这里统一成 Set
                const st = app.state.chat.favorites;
                if (!(st.expandedConv instanceof Set)) {
                    st.expandedConv = new Set(Array.isArray(st.expandedConv) ? st.expandedConv : []);
                }
                if (!(st.expandedContext instanceof Set)) {
                    st.expandedContext = new Set(Array.isArray(st.expandedContext) ? st.expandedContext : []);
                }
                return st;
            },

            /** 切换收藏页当前激活分类 */
            switchFavoriteCategory(payload = {}) {
                const app = this.app;
                const st = this._ensureFavoritesState(app);
                const category = String(payload.category || 'all');
                if (st.category === category) return;
                st.category = category;
                // 切分类时清掉搜索 keyword(用户体验跟原版 inline 一致)
                st.searchKeyword = '';
                this._triggerFavoritesRerender();
            },

            /** 切换对话片段展开/收起(全部 tab 内的 .chat-favorite-item--conversation) */
            toggleFavoriteExpand(payload = {}) {
                const app = this.app;
                const st = this._ensureFavoritesState(app);
                const favoriteId = String(payload.favoriteId || '');
                if (!favoriteId) return;
                if (st.expandedConv.has(favoriteId)) {
                    st.expandedConv.delete(favoriteId);
                } else {
                    st.expandedConv.add(favoriteId);
                }
                this._triggerFavoritesRerender();
            },

            /** 切换上下文展开/收起(单条收藏内的 .fav-context) */
            toggleFavoriteContext(payload = {}) {
                const app = this.app;
                const st = this._ensureFavoritesState(app);
                const favoriteId = String(payload.favoriteId || '');
                if (!favoriteId) return;
                if (st.expandedContext.has(favoriteId)) {
                    st.expandedContext.delete(favoriteId);
                } else {
                    st.expandedContext.add(favoriteId);
                }
                this._triggerFavoritesRerender();
            },

            /** 触发 framework 重新渲染当前 detail 页(v-html 不响应底层数据变化) */
            _triggerFavoritesRerender() {
                if (typeof window !== 'undefined' && window.__detailRenderTick) {
                    window.__detailRenderTick.value++;
                }
            },

            /** 设置收藏页搜索 keyword(input 事件触发,debounce 100ms) */
            setFavoriteSearchKeyword(payload = {}) {
                const app = this.app;
                const st = this._ensureFavoritesState(app);
                const keyword = String(payload.keyword || '');
                if (st.searchKeyword === keyword) return;
                st.searchKeyword = keyword;
                this._triggerFavoritesRerender();
            },

            // ============================================================
            // ★ v0.36 收藏页交互 methods 结束
            // ============================================================

            /**
             * ★ v0.36 转发多选入口 - 被 chat-private 工具条的「转发」按钮调用
             *   - 从 chat-app 内存里的 selectedMsgIds 拿选中的消息 id
             *   - 从 chatPrivate.dataset.rawMessages 拿原始消息列表
             */
            async openForwardPickerMulti(payload = {}) {
                try {
                    const { openForwardTargetSelection } = await import('./chat-forward.js');
                    await openForwardTargetSelection({
                        mode: payload.mode,
                        messageIds: payload.messageIds,
                        sourceMessages: payload.sourceMessages,
                        sourceMeta: payload.sourceMeta,
                    });
                } catch (err) {
                    console.error('[chat-app] openForwardPickerMulti failed', err);
                    this.toolkit?.island?.notify?.('error', '转发失败', err?.message || '');
                }
            },

            /**
             * ★ v0.33 打开聊天记录详情弹窗
             *   - 用户点击 chat-record-card 触发
             *   - 多条:列出**全部**消息(不只是 preview 的 3 条折叠)
             *   - 1:1 复原 chat.js 的 openChatRecordModal(aiId, msgId)
             *
             *   payload: { msgId }
             *   优先从 DOM 的 chat-record-card[data-msg-id=msgId] 拿 record(JSON)
             *   失败回退到 .chat-private[data-raw-messages] 找 target msg
             */
            async openChatRecordDetail(payload = {}) {
                const msgId = payload?.msgId;
                if (!msgId) {
                    console.warn('[chat-app] openChatRecordDetail: missing msgId');
                    return;
                }
                try {
                    // 1. 从 DOM 找 chat-record-card (可靠路径,卡片本身有完整 chatRecord JSON)
                    const card = document.querySelector(
                        `.chat-record-card[data-msg-id="${CSS.escape(msgId)}"]`
                    );
                    if (!card) {
                        this.toolkit?.island?.notify?.('warning', '找不到该聊天记录卡片');
                        return;
                    }

                    // 2. 读卡片的 data-record-* 属性 + 卡内 record-* 节点
                    const recordAttr = card.getAttribute('data-record-data');
                    let record = null;
                    if (recordAttr) {
                        try {
                            record = JSON.parse(recordAttr);
                        } catch (e) {
                            console.warn('[chat-app] record-data JSON parse failed, fallback to rawMessages', e);
                        }
                    }

                    // 3. 兜底:从 chat-private rawMessages 里找(老路径)
                    if (!record) {
                        const chatPrivate = document.querySelector('.chat-private');
                        if (chatPrivate) {
                            const rawAttr = chatPrivate.getAttribute('data-raw-messages');
                            if (rawAttr) {
                                try {
                                    const rawMessages = JSON.parse(rawAttr);
                                    const targetMsg = Array.isArray(rawMessages)
                                        ? rawMessages.find((m) => m && m.id === msgId)
                                        : null;
                                    if (targetMsg?.chatRecord) {
                                        record = targetMsg.chatRecord;
                                    }
                                } catch (_) {}
                            }
                        }
                    }

                    if (!record) {
                        this.toolkit?.island?.notify?.('warning', '该聊天记录数据为空');
                        return;
                    }

                    const messages = Array.isArray(record.messages) ? record.messages : [];
                    const mode = card.getAttribute('data-record-mode') || record.mode || 'calendar';
                    const chatPrivate = document.querySelector('.chat-private');
                    const sourceLabel = `来自 ${chatPrivate?.getAttribute('data-conversation-name') || '对话'}`;

                    // 4. 弹 ChatRecordDetailModal(显示完整消息列表)
                    const { chatModalManager } = await import('./components/chat-modal-registry.js');
                    chatModalManager.openChatRecordDetail({
                        title: record.title || '聊天记录',
                        messages,
                        sourceLabel,
                        onClose: () => {},
                    });
                } catch (err) {
                    console.error('[chat-app] openChatRecordDetail failed', err);
                    this.toolkit?.island?.notify?.('error', '打开失败', err?.message || '');
                }
            },

            /**
             * ★ v0.27 在联系人列表点某个 AI 时调用
             *   - 弹「模式选择」弹窗（chat-component modal）
             *   - 选定后调用 pickContactAndCreate({ ...payload, recordMode: <mode> })
             */
            pickContactForMode(payload = {}) {
                const aiPersonSnapshot = payload.aiPersonSnapshot || payload || {};
                const aiPersonId = payload.aiPersonId || aiPersonSnapshot.id;
                if (!aiPersonId) return null;

                chatModalManager.openRecordModeSelector({
                    name: aiPersonSnapshot.name || '',
                    // ★ v0.28:传入当前 mode 的 addedInMode，让弹窗里对应按钮变灰
                    addedInMode: payload.addedInMode || false,
                    addedInOtherMode: payload.addedInOtherMode || false,
                    onSelect: (mode) => {
                        // 弹窗的 $emit('close') 已触发 framework closeModal()
                        // 这里只负责创建好友（pickContactAndCreate 内部会跳 private 页）
                        this.pickContactAndCreate({
                            aiPersonId,
                            aiPersonSnapshot,
                            recordMode: mode,
                        });
                    },
                    onClose: () => {
                        // 用户取消 → 不做任何事
                    },
                });
                return null;
            },

            /**
             * ★ v0.27 选中联系人 → 在当前默认 User 人设的 socialProfiles.chat
             *   下追加一条 entry(recordMode = calendar/story)
             *   - 同 AI 同 mode 重复添加 → 拒绝（return null）
             *   - 创建完成后 push private-<aiPersonId>-<mode> 进私聊
             */
            async pickContactAndCreate(payload = {}) {
                const sdk = window.settingsSdk;
                if (!sdk?.chatFriends || !sdk?.users) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                const mode = (payload?.recordMode === 'story' || payload?.recordMode === 'calendar')
                    ? payload.recordMode
                    : (window.__pendingRecordMode === 'story' ? 'story' : 'calendar');
                const aiPersonId = payload.aiPersonId;
                if (!aiPersonId) return null;

                // 取当前默认 User(每个 User 各自管自己的好友名单)
                const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                if (!defaultUser) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户卡');
                    return null;
                }

                // 取完整 AI 人设 record
                const aiPerson = sdk.aiPersons.get(aiPersonId);
                if (!aiPerson) {
                    this.toolkit?.island?.notify?.('error', '找不到该 AI 人设');
                    return null;
                }

                // 同 AI 同 mode 已存在 → 拒绝重复
                if (sdk.chatFriends.has(defaultUser, aiPersonId, mode)) {
                    const modeLabel = mode === 'story' ? '故事模式' : '日历模式';
                    this.toolkit?.island?.notify?.(
                        'warning',
                        '已添加过',
                        `「${aiPerson.name || aiPersonId}」在${modeLabel}已存在`
                    );
                    return null;
                }

                try {
                    const created = await sdk.chatFriends.add(
                        sdk,
                        defaultUser,
                        aiPerson,
                        mode,
                    );
                    if (!created) {
                        this.toolkit?.island?.notify?.('error', '添加好友失败');
                        return null;
                    }
                    this.toolkit?.island?.notify?.(
                        'success',
                        '已添加',
                        aiPerson.name || aiPersonId
                    );
                    // 清掉 pending mode（防止下次添加继承）
                    delete window.__pendingRecordMode;
                    // 切到私聊页（无 mode 后缀），日历/故事视图由聊天内顶栏按钮进入
                    const action = {
                        action: 'detail',
                        appId: 'chat',
                        pageId: `private-${aiPersonId}-${mode}`,
                    };
                    document.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: action,
                        bubbles: true,
                    }));
                    // 刷新消息列表（让新联系人出现）
                    refreshMessagesTab(this);
                    return created;
                } catch (err) {
                    console.warn('[chat-app] pickContactAndCreate failed', err);
                    this.toolkit?.island?.notify?.('error', '添加失败', err?.message || '');
                    return null;
                }
            },

            /**
             * ★ v0.33 发起群聊 (new-group 页) 相关 method
             *  - 用 window.__chatNewGroupSelection 存已选 aiPersonId 集合
             *  - 用 window.__chatNewGroupStep 存 step 1/2
             *  - 用 window.__chatNewGroupMode 存 presetMode
             * 每个 method 都会触发 detailRenderTick++,framework 重渲当前页
             */

            /** 进入发起群聊流程 */
            openNewGroup() {
                window.__chatNewGroupSelection = window.__chatNewGroupSelection || new Set();
                window.__chatNewGroupStep = 1;
                window.__chatNewGroupMode = '';
                const action = { action: 'detail', appId: 'chat', pageId: 'new-group' };
                document.dispatchEvent(new CustomEvent('app:page-action', { detail: action, bubbles: true }));
            },

            /** 切换某个 AI 的选中状态 */
            toggleNewGroupAi(payload) {
                const aiPersonId = payload?.aiPersonId;
                if (!aiPersonId) return null;
                const selection = window.__chatNewGroupSelection || (window.__chatNewGroupSelection = new Set());
                if (selection.has(aiPersonId)) selection.delete(aiPersonId);
                else selection.add(aiPersonId);
                // 触发重画
                try {
                    if (typeof window.__detailRenderTick !== 'undefined') {
                        window.__detailRenderTick.value++;
                    }
                } catch (_) {}
                return null;
            },

            /** 进入第 2 步(选 mode) */
            confirmNewGroupStep1() {
                const selection = window.__chatNewGroupSelection || new Set();
                if (selection.size < 2) {
                    this.toolkit?.island?.notify?.('warning', '请至少选择 2 位 AI');
                    return null;
                }
                window.__chatNewGroupStep = 2;
                try {
                    if (typeof window.__detailRenderTick !== 'undefined') {
                        window.__detailRenderTick.value++;
                    }
                } catch (_) {}
                return null;
            },

            /** 第 2 步选 mode */
            pickNewGroupMode(payload) {
                const mode = payload?.mode;
                if (mode !== 'calendar' && mode !== 'story') return null;
                window.__chatNewGroupMode = mode;
                try {
                    if (typeof window.__detailRenderTick !== 'undefined') {
                        window.__detailRenderTick.value++;
                    }
                } catch (_) {}
                return null;
            },

            /** 返回第 1 步 */
            backToNewGroupStep1() {
                window.__chatNewGroupStep = 1;
                window.__chatNewGroupMode = '';
                try {
                    if (typeof window.__detailRenderTick !== 'undefined') {
                        window.__detailRenderTick.value++;
                    }
                } catch (_) {}
                return null;
            },

            /** 取消 - 清掉暂存并返回 */
            cancelNewGroup() {
                window.__chatNewGroupSelection = new Set();
                window.__chatNewGroupStep = 1;
                window.__chatNewGroupMode = '';
                try {
                    if (typeof window.__detailRenderTick !== 'undefined') {
                        window.__detailRenderTick.value++;
                    }
                } catch (_) {}
                // 直接退到上一页(new-chat)
                try {
                    const action = { action: 'detail', appId: 'chat', pageId: 'new-chat' };
                    document.dispatchEvent(new CustomEvent('app:page-action', { detail: action, bubbles: true }));
                } catch (_) {}
                return null;
            },

            /** 提交创建群聊 */
            async confirmCreateNewGroup() {
                const mode = window.__chatNewGroupMode;
                if (mode !== 'calendar' && mode !== 'story') {
                    this.toolkit?.island?.notify?.('warning', '请选择群聊模式');
                    return null;
                }
                const selection = Array.from(window.__chatNewGroupSelection || []);
                if (selection.length < 2) {
                    this.toolkit?.island?.notify?.('warning', '请至少选择 2 位 AI');
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.chatGroups?.create) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                if (!defaultUser) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户');
                    return null;
                }
                try {
                    const result = await sdk.chatGroups.create(sdk, defaultUser, {
                        memberIds: selection,
                        mode,
                        aiPersons: sdk.aiPersons,
                    });
                    const groupId = result?.id || result?.groupId;
                    if (!groupId) {
                        this.toolkit?.island?.notify?.('error', '创建群聊失败');
                        return null;
                    }
                    this.toolkit?.island?.notify?.('success', '群聊已创建', `${result?.name || '新群聊'}`);
                    // 清暂存
                    window.__chatNewGroupSelection = new Set();
                    window.__chatNewGroupStep = 1;
                    window.__chatNewGroupMode = '';
                    // ★ v0.38 刷新消息列表，让新群聊出现在列表中
                    refreshMessagesTab(this);
                    // 跳到群聊详情
                    const action = { action: 'detail', appId: 'chat', pageId: `group-${groupId}` };
                    document.dispatchEvent(new CustomEvent('app:page-action', { detail: action, bubbles: true }));
                    return result;
                } catch (err) {
                    console.error('[chat-app] confirmCreateNewGroup failed', err);
                    this.toolkit?.island?.notify?.('error', '创建群聊失败', err?.message || '');
                    return null;
                }
            },

            /** 初始化发起聊天页面交互 */
            initNewChatPageInteractions() {
                const page = document.querySelector('.app-shell[data-app-id="chat"] .new-chat-page');
                if (!page) return;
                if (page.__newChatInteractionsBound) return;
                page.__newChatInteractionsBound = true;

                // v0.27 兜底:每次进 new-chat 页都挂一次 SDK ready 监听器,确保 SDK 还没好时进入,
                // 之后 SDK 就绪会自动触发刷新(避免页面卡在 demo fallback)。
                try { this.watchSettingsSdkReady?.(); } catch (_) {}

                // 联系人点击 - 打开私聊
                page.addEventListener('click', (event) => {
                    const contactItem = event.target.closest('.contact-select-item');
                    if (contactItem) {
                        // ★ v0.28:只有当同 AI 的 calendar+story 两种模式都已添加，才真正跳过
                        const contactId = contactItem.dataset.contactId;
                        if (contactId && !contactItem.classList.contains('contact-select-item--disabled')) {
                            const action = { action: 'detail', appId: 'chat', pageId: `private-${contactId}` };
                            document.dispatchEvent(new CustomEvent('app:page-action', {
                                detail: action,
                                bubbles: true,
                            }));
                        }
                        return;
                    }

                    // 创建群聊按钮(legacy fallback:新按钮已走 data-app-action,但保留兜底)
                    if (event.target.closest('#createGroupBtn')) {
                        this.openNewGroup?.();
                        return;
                    }

                    // 添加朋友按钮
                    if (event.target.closest('#addFriendBtn')) {
                        window.__phoneIsland?.notify?.('info', '添加朋友', '功能即将开放');
                        return;
                    }
                });

                // 搜索功能
                const searchInput = page.querySelector('#newChatSearchInput');
                if (searchInput) {
                    searchInput.addEventListener('input', () => {
                        const keyword = searchInput.value.trim().toLowerCase();
                        const contactItems = page.querySelectorAll('.contact-select-item');
                        contactItems.forEach(item => {
                            const name = item.querySelector('.contact-name')?.textContent?.toLowerCase() || '';
                            item.style.display = name.includes(keyword) ? 'flex' : 'none';
                        });
                    });
                }

                console.log('[chat-app] initNewChatPageInteractions bound');
            },

            /**
             * ★ v0.39 初始化发起群聊页面交互
             *   - SDK bootstrap 已经挪到 renderDetailPage(new-group 分支) await whenSettingsSdkReady 里,
             *     这里不需要再监听 settings-sdk-ready 事件
             *   - 方法保留为空 stub,避免外部调用报错
             */
            initNewGroupPageInteractions() {
                // no-op:SDK 已在 renderDetailPage 里 await 完成,无需再监听
            },

            /**
             * ★ v0.42 初始化故事存档页交互
             *   - 存档列表按钮全走 data-app-action,framework 顶层 click 委托
             *     自动派发到 methods.onArchiveRestore / onArchiveView / onArchiveDelete
             *   - 这里只做兜底:如果 SDK 还没就绪,挂一个 ready 监听器,等就绪后
             *     ++detailRenderTick 触发存档页重画(让真实数据取代空状态)
             */
            initStoryArchiveInteractions() {
                if (window.__storyArchiveSdkReadyBound) return;
                const sdk = window.settingsSdk;
                if (sdk?.storyArchives) return; // 已就绪,无需绑定
                let bound = false;
                const onReady = () => {
                    if (bound) return;
                    bound = true;
                    // SDK 就绪后立即重画存档页
                    try {
                        if (window.__detailRenderTick) window.__detailRenderTick.value++;
                    } catch (_) {}
                };
                window.addEventListener('settings-sdk-ready', onReady, { once: true });
                window.__storyArchiveSdkReadyBound = true;
            },

            // ============================================================
            // ★ v0.42 故事存档交互 methods(由 data-app-action 派发)
            //   - 全部走 sdk.storyArchives + sdk.chatMessages API
            //   - 弹窗复用 chatModalManager
            //   - 状态保存在 app.state.chat.storyArchive(暂存当前查看的 archiveId + ctx)
            // ============================================================

            /**
             * 派发「封存当前聊天记录」弹窗(v0.42)
             *   - payload: { aiPersonId, mode, currentMessageCount, suggestedName, contactName }
             *   - 弹窗确认后 → 写存档 + 清空当前故事会话
             */
            async openArchiveSaveModal(payload = {}) {
                const aiPersonId = payload.aiPersonId;
                const mode = payload.mode || 'story';
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('error', '参数错误', '缺少 aiPersonId');
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.storyArchives) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }
                const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive();
                if (!defaultUser) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户');
                    return null;
                }

                // 1. 拉当前故事会话的真实消息(用于存档,实时抓一次)
                let currentMessages = [];
                try {
                    if (sdk.chatMessages?.list) {
                        currentMessages = sdk.chatMessages.list(null, aiPersonId, mode) || [];
                    }
                } catch (_) {}
                const realCount = currentMessages.length;

                // 2. 弹窗
                const { chatModalManager } = await import('./components/chat-modal-registry.js');
                return await new Promise((resolve) => {
                    chatModalManager.openArchiveSave({
                        contactName: payload.contactName || '',
                        messageCount: realCount,
                        suggestedName: payload.suggestedName || '',
                        onConfirm: async ({ name, description }) => {
                            try {
                                // 1) 写存档
                                const archive = await sdk.storyArchives.add(defaultUser, aiPersonId, {
                                    name,
                                    description,
                                    messages: currentMessages,
                                    mode,
                                });
                                if (!archive) {
                                    this.toolkit?.island?.notify?.('error', '封存失败');
                                    resolve(null);
                                    return;
                                }
                                // 2) 清空当前故事会话(让用户能重新开始写新故事)
                                try {
                                    if (sdk.chatMessages?.removeAllForConversation) {
                                        await sdk.chatMessages.removeAllForConversation(null, aiPersonId, mode);
                                    }
                                } catch (err) {
                                    console.warn('[chat-app] 清空当前故事会话失败', err);
                                }
                                this.toolkit?.island?.notify?.('success', '已封存', name);
                                // 3) 触发 framework 重画存档页(顶部计数 + 列表)
                                try {
                                    if (window.__detailRenderTick) window.__detailRenderTick.value++;
                                } catch (_) {}
                                resolve(archive);
                            } catch (err) {
                                console.error('[chat-app] openArchiveSaveModal confirm failed', err);
                                this.toolkit?.island?.notify?.('error', '封存失败', err?.message || '');
                                resolve(null);
                            }
                        },
                        onClose: () => {
                            resolve(null);
                        },
                    });
                });
            },

            /**
             * 派发「恢复存档」二次确认弹窗(v0.42)
             *   - payload: { archiveId }
             *   - 当前故事会话有数据时弹覆盖确认,无数据时直接恢复
             */
            async onArchiveRestore(payload = {}) {
                const archiveId = payload.archiveId;
                if (!archiveId) return null;
                const sdk = window.settingsSdk;
                if (!sdk?.storyArchives) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                const archive = sdk.storyArchives.get(archiveId);
                if (!archive) {
                    this.toolkit?.island?.notify?.('warning', '该存档不存在或已被删除');
                    // 刷新存档页
                    try { if (window.__detailRenderTick) window.__detailRenderTick.value++; } catch (_) {}
                    return null;
                }

                // 通过 aiPersonId 推断 mode(存档本身带 mode,但 story 一律 'story')
                const aiPersonId = archive.aiPersonId;
                const mode = archive.mode || 'story';
                const currentCount = sdk.chatMessages?.count
                    ? (sdk.chatMessages.count(null, aiPersonId, mode) || 0)
                    : 0;

                const doRestore = async () => {
                    try {
                        const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive();
                        if (!defaultUser) {
                            this.toolkit?.island?.notify?.('error', '未找到默认用户');
                            return;
                        }
                        // 1) 清空当前故事会话
                        if (sdk.chatMessages?.removeAllForConversation) {
                            await sdk.chatMessages.removeAllForConversation(null, aiPersonId, mode);
                        }
                        // 2) 把存档里的消息快照逐条写回 chatMessages
                        const snapshot = Array.isArray(archive.messages) ? archive.messages : [];
                        for (const m of snapshot) {
                            try {
                                await sdk.chatMessages.add(defaultUser, aiPersonId, mode, {
                                    id: m.id || undefined,
                                    sender: m.sender || 'user',
                                    senderId: m.senderId || '',
                                    senderName: m.senderName || '',
                                    type: m.type || 'text',
                                    content: m.content || '',
                                    chatRecord: m.chatRecord || null,
                                    imageUrl: m.imageUrl || '',
                                    imageDescription: m.imageDescription || '',
                                    stickerUrl: m.stickerUrl || '',
                                    locationCard: m.locationCard || null,
                                    redpacketCard: m.redpacketCard || null,
                                    transferCard: m.transferCard || null,
                                    voiceUrl: m.voiceUrl || '',
                                    voiceDuration: m.voiceDuration || null,
                                    replyTo: m.replyTo || null,
                                    timestamp: m.timestamp || Date.now(),
                                });
                            } catch (err) {
                                console.warn('[chat-app] 恢复某条消息失败', err);
                            }
                        }
                        this.toolkit?.island?.notify?.('success', '已恢复', archive.name);
                        // 跳到私聊页,让用户看到恢复后的话题
                        try {
                            const action = {
                                action: 'detail',
                                appId: 'chat',
                                pageId: `private-${aiPersonId}-${mode}`,
                            };
                            document.dispatchEvent(new CustomEvent('app:page-action', {
                                detail: action, bubbles: true,
                            }));
                        } catch (_) {}
                    } catch (err) {
                        console.error('[chat-app] onArchiveRestore failed', err);
                        this.toolkit?.island?.notify?.('error', '恢复失败', err?.message || '');
                    }
                };

                if (currentCount > 0) {
                    // 当前会话有数据 → 二次确认
                    const { chatModalManager } = await import('./components/chat-modal-registry.js');
                    chatModalManager.openArchiveRestoreConfirm({
                        archiveName: archive.name,
                        currentCount,
                        onConfirm: () => doRestore(),
                        onClose: () => {},
                    });
                } else {
                    // 当前无数据 → 直接恢复
                    await doRestore();
                }
                return null;
            },

            /**
             * 派发「查看存档」弹窗(v0.42)
             *   - payload: { archiveId }
             *   - 复用 ChatRecordDetailModal 展示完整消息
             */
            async onArchiveView(payload = {}) {
                const archiveId = payload.archiveId;
                if (!archiveId) return null;
                const sdk = window.settingsSdk;
                if (!sdk?.storyArchives) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                const archive = sdk.storyArchives.get(archiveId);
                if (!archive) {
                    this.toolkit?.island?.notify?.('warning', '该存档不存在或已被删除');
                    try { if (window.__detailRenderTick) window.__detailRenderTick.value++; } catch (_) {}
                    return null;
                }
                const messages = Array.isArray(archive.messages) ? archive.messages : [];
                const { chatModalManager } = await import('./components/chat-modal-registry.js');
                chatModalManager.openChatRecordDetail({
                    title: archive.name || '存档详情',
                    messages,
                    sourceLabel: `封存于 ${formatDateShort(archive.createdAt)} · ${archive.messageCount} 条消息`,
                    onClose: () => {},
                });
                return null;
            },

            /**
             * 派发「删除存档」确认弹窗(v0.42)
             *   - payload: { archiveId }
             *   - 二次确认后 sdk.storyArchives.remove
             */
            async onArchiveDelete(payload = {}) {
                const archiveId = payload.archiveId;
                if (!archiveId) return null;
                const sdk = window.settingsSdk;
                if (!sdk?.storyArchives) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                const archive = sdk.storyArchives.get(archiveId);
                if (!archive) {
                    this.toolkit?.island?.notify?.('warning', '该存档不存在或已被删除');
                    try { if (window.__detailRenderTick) window.__detailRenderTick.value++; } catch (_) {}
                    return null;
                }
                const { chatModalManager } = await import('./components/chat-modal-registry.js');
                chatModalManager.openArchiveDeleteConfirm({
                    archiveName: archive.name,
                    archiveDate: formatDateShort(archive.createdAt),
                    messageCount: archive.messageCount || 0,
                    onConfirm: async () => {
                        try {
                            await sdk.storyArchives.remove(archiveId);
                            this.toolkit?.island?.notify?.('success', '已删除', archive.name);
                            // 触发 framework 重画
                            try { if (window.__detailRenderTick) window.__detailRenderTick.value++; } catch (_) {}
                        } catch (err) {
                            console.error('[chat-app] onArchiveDelete failed', err);
                            this.toolkit?.island?.notify?.('error', '删除失败', err?.message || '');
                        }
                    },
                    onClose: () => {},
                });
                return null;
            },

            // ============================================================
            // ★ v0.61.3 概要系统 methods
            //   - openCalendarSummaryRangeModal    日历模式 → 弹 SummaryRangeModal
            //   - openStorySummaryRangeModal       故事模式 → 弹 SummaryRangeModal(story)
            //   - _saveCalendarSummary             保存占位概要 → sdk.calendarSummaries.add
            //   - _saveStorySummary                保存占位概要 → sdk.storySummaries.add
            //   - computeContextRoundsPrompt       实时计算「当前聊天回合」prompt
            //   - _triggerRollingCompress          chat-page 渲染时后台触发 K 链压缩
            // ============================================================

            /**
             * ★ v0.61.3 日历模式 → 弹概要范围选择弹窗
             *   payload: { aiPersonId, mode, contactName }
             *   流程:
             *     1. 从 sdk.chatMessages + sdk.chatArchive 合并拉消息(都按 YYYY-MM-DD 分组)
             *     2. 弹 SummaryRangeModal,用户选日期范围
             *     3. 选完 → 调 _buildCalendarSummaryFromSelection 生成占位概要
             *     4. 弹 SummaryEditModal 让用户编辑/重 Roll/保存
             */
            async openCalendarSummaryRangeModal(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                const mode = 'calendar';
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('error', '参数错误', '缺少 aiPersonId');
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.calendarSummaries) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }

                // 1. 收集「有聊天记录的日期」+ count
                let availableDays = [];
                try {
                    const todayList = sdk.chatMessages?.list
                        ? (sdk.chatMessages.list(null, aiPersonId, mode) || [])
                        : [];
                    const archiveList = sdk.chatArchive?.list
                        ? (sdk.chatArchive.list(aiPersonId, mode) || [])
                        : [];
                    const all = [...todayList, ...archiveList];
                    const map = new Map();
                    for (const m of all) {
                        const dk = m.archivedDay || (() => {
                            const d = new Date(Number(m.timestamp) || Date.now());
                            const y = d.getFullYear();
                            const mo = String(d.getMonth() + 1).padStart(2, '0');
                            const da = String(d.getDate()).padStart(2, '0');
                            return `${y}-${mo}-${da}`;
                        })();
                        if (!dk) continue;
                        map.set(dk, (map.get(dk) || 0) + 1);
                    }
                    availableDays = Array.from(map.entries())
                        .map(([dateKey, count]) => ({ dateKey, count }))
                        .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
                } catch (err) {
                    console.warn('[chat-app] collect availableDays failed', err);
                }

                if (availableDays.length === 0) {
                    this.toolkit?.island?.notify?.('warning', '暂无聊天记录', '先聊几天再来生成概要吧');
                    return null;
                }

                chatModalManager.openSummaryRange({
                    mode: 'calendar',
                    contactName: payload.contactName || aiPersonId,
                    availableDays,
                    onConfirm: async ({ startDay, endDay, selectedDays }) => {
                        try {
                            // 收集选中日期范围内的所有消息
                            const todayList = sdk.chatMessages?.list
                                ? (sdk.chatMessages.list(null, aiPersonId, mode) || [])
                                : [];
                            const archiveList = sdk.chatArchive?.list
                                ? (sdk.chatArchive.list(aiPersonId, mode, {
                                    sinceDay: startDay,
                                    untilDay: endDay,
                                }) || [])
                                : [];
                            const inRange = [...todayList, ...archiveList].filter((m) => {
                                const dk = m.archivedDay || (() => {
                                    const d = new Date(Number(m.timestamp) || Date.now());
                                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                })();
                                return dk >= startDay && dk <= endDay;
                            });
                            // 占位生成
                            const built = sdk.calendarSummaries.buildPlaceholderFromMessages(inRange, {
                                title: `${startDay} ~ ${endDay} 聊天概要`,
                                maxLines: 50,
                            });
                            // 弹编辑弹窗
                            chatModalManager.openSummaryEdit({
                                mode: 'calendar',
                                initialTitle: built.title,
                                initialContent: built.content,
                                dateRange: built.dateRange,
                                messageCount: built.messageCount,
                                defaultAsPrompt: false,
                                onSave: async (next) => {
                                    await this._saveCalendarSummary(aiPersonId, {
                                        title: next.title,
                                        content: next.content,
                                        dateRange: next.dateRange,
                                        messageCount: next.messageCount,
                                        asPrompt: { active: !!next.asPrompt, order: 0, source: 'calendar-summary' },
                                    });
                                },
                                onReroll: () => {
                                    // 重 Roll:再次计算 + 重新弹编辑弹窗
                                    const newBuilt = sdk.calendarSummaries.buildPlaceholderFromMessages(inRange, {
                                        title: `${startDay} ~ ${endDay} 聊天概要`,
                                        maxLines: 50,
                                    });
                                    chatModalManager.openSummaryEdit({
                                        mode: 'calendar',
                                        initialTitle: newBuilt.title,
                                        initialContent: newBuilt.content,
                                        dateRange: newBuilt.dateRange,
                                        messageCount: newBuilt.messageCount,
                                        defaultAsPrompt: false,
                                        onSave: async (n2) => {
                                            await this._saveCalendarSummary(aiPersonId, {
                                                title: n2.title,
                                                content: n2.content,
                                                dateRange: n2.dateRange,
                                                messageCount: n2.messageCount,
                                                asPrompt: { active: !!n2.asPrompt, order: 0, source: 'calendar-summary' },
                                            });
                                        },
                                    });
                                },
                            });
                        } catch (err) {
                            console.error('[chat-app] openCalendarSummaryRangeModal confirm failed', err);
                            this.toolkit?.island?.notify?.('error', '生成失败', err?.message || '');
                        }
                    },
                });
                return true;
            },

            /**
             * ★ v0.61.3 故事模式 → 弹概要范围选择弹窗
             *   payload: { aiPersonId, mode, contactName }
             *   流程: 拉当前故事会话全部消息 → 弹 SummaryRangeModal(story,显示条数)
             *     → 直接弹 SummaryEditModal → 保存到 sdk.storySummaries
             */
            async openStorySummaryRangeModal(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                const mode = 'story';
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('error', '参数错误', '缺少 aiPersonId');
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.storySummaries) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                // 拉当前故事会话全部消息
                let messages = [];
                try {
                    messages = sdk.chatMessages?.list
                        ? (sdk.chatMessages.list(null, aiPersonId, mode) || [])
                        : [];
                } catch (_) {
                    messages = [];
                }
                if (messages.length === 0) {
                    this.toolkit?.island?.notify?.('warning', '当前故事会话为空', '先去聊几句再来生成概要吧');
                    return null;
                }
                chatModalManager.openSummaryRange({
                    mode: 'story',
                    contactName: payload.contactName || aiPersonId,
                    messages,
                    onConfirm: async () => {
                        try {
                            const built = sdk.storySummaries.buildPlaceholderFromMessages(messages, {
                                title: `故事概要 - ${payload.contactName || aiPersonId}`,
                                maxLines: 80,
                            });
                            chatModalManager.openSummaryEdit({
                                mode: 'story',
                                initialTitle: built.title,
                                initialContent: built.content,
                                dateRange: { start: '', end: '' },
                                messageCount: built.messageCount,
                                defaultAsPrompt: false,
                                onSave: async (next) => {
                                    await this._saveStorySummary(aiPersonId, {
                                        title: next.title,
                                        content: next.content,
                                        messageCount: next.messageCount,
                                        asPrompt: { active: !!next.asPrompt, order: 0, source: 'story-summary' },
                                    });
                                },
                                onReroll: () => {
                                    const newBuilt = sdk.storySummaries.buildPlaceholderFromMessages(messages, {
                                        title: `故事概要 - ${payload.contactName || aiPersonId}`,
                                        maxLines: 80,
                                    });
                                    chatModalManager.openSummaryEdit({
                                        mode: 'story',
                                        initialTitle: newBuilt.title,
                                        initialContent: newBuilt.content,
                                        dateRange: { start: '', end: '' },
                                        messageCount: newBuilt.messageCount,
                                        defaultAsPrompt: false,
                                        onSave: async (n2) => {
                                            await this._saveStorySummary(aiPersonId, {
                                                title: n2.title,
                                                content: n2.content,
                                                messageCount: n2.messageCount,
                                                asPrompt: { active: !!n2.asPrompt, order: 0, source: 'story-summary' },
                                            });
                                        },
                                    });
                                },
                            });
                        } catch (err) {
                            console.error('[chat-app] openStorySummaryRangeModal confirm failed', err);
                            this.toolkit?.island?.notify?.('error', '生成失败', err?.message || '');
                        }
                    },
                });
                return true;
            },

            /**
             * ★ v0.61.3 保存一条 calendar summary(异步)
             */
            async _saveCalendarSummary(aiPersonId, patch) {
                const sdk = window.settingsSdk;
                if (!sdk?.calendarSummaries?.add) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                const record = await sdk.calendarSummaries.add(aiPersonId, patch);
                if (!record) {
                    this.toolkit?.island?.notify?.('warning', '保存失败');
                    return null;
                }
                this.toolkit?.island?.notify?.('success', '已保存概要', record.title);
                // 触发 framework 重画(让 prompt-manager 看到新条目)
                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                try { window.__detailRenderTick.value++; } catch (_) {}
                try {
                    window.dispatchEvent(new CustomEvent('chat:summary-updated', {
                        detail: { aiPersonId, summaryId: record.id, source: 'calendar' },
                    }));
                } catch (_) {}
                return record;
            },

            /**
             * ★ v0.61.3 保存一条 story summary(异步)
             */
            async _saveStorySummary(aiPersonId, patch) {
                const sdk = window.settingsSdk;
                if (!sdk?.storySummaries?.add) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                const record = await sdk.storySummaries.add(aiPersonId, patch);
                if (!record) {
                    this.toolkit?.island?.notify?.('warning', '保存失败');
                    return null;
                }
                this.toolkit?.island?.notify?.('success', '已保存故事概要', record.title);
                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                try { window.__detailRenderTick.value++; } catch (_) {}
                try {
                    window.dispatchEvent(new CustomEvent('chat:summary-updated', {
                        detail: { aiPersonId, summaryId: record.id, source: 'story' },
                    }));
                } catch (_) {}
                return record;
            },

            // ============================================================
            // ★ v0.65 分级记忆系统 methods
            //   - switchMemoryHistoryLevel             切换历史消息页层级 tab
            //   - openMemoryHistoryCreateModal         L1 新建概要 → SummaryRangeModal + EditModal
            //   - editMemorySummary / rerollMemorySummary / deleteMemorySummary
            //   - generateMemorySummaryManually        L2+ 「生成概要」按钮
            //   - openAddLevelModal / openRemoveLevelModal  层级增/删
            //   - saveAddLevel / saveUpdateLevelCycle / saveRemoveLevel  弹窗内保存
            // ============================================================

            /**
             * ★ v0.65 切换历史消息页层级 tab
             *   payload: { aiPersonId, mode, levelId }
             *   只更新 window.__memoryHistoryActiveLevel + 触发重画
             */
            switchMemoryHistoryLevel(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                const levelId = String(payload.levelId || 'L1');
                if (!aiPersonId) return;
                if (typeof window === 'undefined') return;
                if (!window.__memoryHistoryActiveLevel) window.__memoryHistoryActiveLevel = {};
                window.__memoryHistoryActiveLevel[aiPersonId] = levelId;
                // 触发 detail 重画
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}
                try { window.__detailRenderTick.value++; } catch (_) {}
            },

            // ============================================================
            // ★ v0.66 日历视图「当天生成概要」入口（完全重写）
            //   - payload: { dateKey }
            //   - 行为流程:
            //     1. 收集当天消息
            //     2. 读 textarea 模板(localStorage)
            //     3. 自动拼 AI 人设 / 用户人设 / 当日对话信息 → 占位符替换
            //        · {{aiName}}   → aiPerson.name
            //        · {{userName}} → 用户人设.name
            //        · {{dateRange}}→ startDay ~ endDay
            //        · {{messages}} → 当天对话格式化文本
            //     4. 弹 SummaryRangeModal(只含当天) → 弹 SummaryEditModal(初始内容 = 替换后模板)
            //     5. 保存到 sdk.memorySummaries.add(L1)
            //   - 占位 div(cdd-summary-placeholder-{dateKey})也实时显示已生成的概要,带「应用到 prompt 管理」按钮
            // ============================================================
            async openDaySummaryRangeModal(payload = {}) {
                const dateKey = String(payload.dateKey || '');
                if (!dateKey) return null;
                // 从当前 detail 页拿 aiPersonId + mode
                // ★ v0.66 bug 修复:外层 .chat-calendar-view 只有 data-contact-id,
                //   data-ai-person-id / data-mode 在内层 #calendar-container 上,
                //   选择器优先精确到 #calendar-container,fallback 才读外层。
                let aiPersonId = '';
                let mode = 'calendar';
                try {
                    const detailEl = document.querySelector('.app-shell[data-app-id="chat"] #calendar-container')
                        || document.querySelector('.app-shell[data-app-id="chat"] .chat-calendar-view');
                    if (detailEl) {
                        aiPersonId = detailEl.dataset.aiPersonId || '';
                        mode = detailEl.dataset.mode || 'calendar';
                    }
                } catch (_) {}
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('error', '参数错误', '请从日历视图打开');
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.memorySummaries) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }

                // 收集当天的真实消息(实时从 sdk.chatMessages + chatArchive 拉)
                let dayMessages = [];
                try {
                    const todayList = sdk.chatMessages?.list
                        ? (sdk.chatMessages.list(null, aiPersonId, mode) || [])
                        : [];
                    const archiveList = sdk.chatArchive?.list
                        ? (sdk.chatArchive.list(aiPersonId, mode, { sinceDay: dateKey, untilDay: dateKey }) || [])
                        : [];
                    const all = [...todayList, ...archiveList];
                    dayMessages = all.filter((m) => {
                        if (!m) return false;
                        const dk = m.archivedDay || (() => {
                            const d = new Date(Number(m.timestamp) || Date.now());
                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        })();
                        return dk === dateKey;
                    });
                } catch (err) {
                    console.warn('[chat-app] collect dayMessages failed', err);
                }

                if (dayMessages.length === 0) {
                    this.toolkit?.island?.notify?.('warning', '当天无聊天记录');
                    return null;
                }

                // 取日历视图的 AI prompt 模板(localStorage 持久化的 textarea 内容)
                const promptKey = `xiaoting::calendar-prompt-template-${aiPersonId}-${mode}`;
                let promptTemplate = '';
                try { promptTemplate = localStorage.getItem(promptKey) || ''; } catch (_) {}

                // ★ v0.66 占位符替换:AI 人设 / 用户人设 / dateRange / messages
                const aiPerson = sdk.aiPersons?.get?.(aiPersonId) || null;
                const aiName = aiPerson?.name || aiPersonId;
                const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.() || null;
                const userName = defaultUser?.name || defaultUser?.chineseName || '用户';
                const dateRangeText = dateKey; // 单天
                const messagesText = this._formatDayMessagesForPrompt(dayMessages, aiName);

                // ★ v0.66 人设信息摘要:给 SummaryEditModal 展示用
                const aiPersonaSummary = this._buildAiPersonaSummary(aiPerson);
                const userPersonaSummary = this._buildUserPersonaSummary(defaultUser);

                // ★ v0.66 bug 修复:textarea 不再预填「发给 AI 的 prompt 模板」(用户误以为 AI 已生成)
                //   正确语义:textarea = AI 概要正文初始为空(等 AI 生成)
                //   mergedPrompt = 内部传给 AI 的指令,不要透到 textarea
                const mergedPrompt = this._fillPromptPlaceholders(promptTemplate, {
                    aiName,
                    userName,
                    dateRange: dateRangeText,
                    messages: messagesText,
                });

                // 不弹 SummaryRangeModal(范围固定 = 当天 1 天),直接弹 SummaryEditModal
                chatModalManager.openSummaryEdit({
                    mode: 'calendar',
                    initialTitle: `${dateKey} 聊天概要`,
                    // ★ v0.66:initialContent = 空,textarea 初始为空等 AI 生成
                    initialContent: '',
                    dateRange: { start: dateKey, end: dateKey },
                    messageCount: dayMessages.length,
                    defaultAsPrompt: false,
                    // ★ v0.66:promptPrefix = 内部传给 AI 的指令模板,不透到 textarea
                    promptPrefix: mergedPrompt
                        ? `${mergedPrompt}\n\n---\n\n请基于以上指令,生成当日聊天概要。\n\n`
                        : '',
                    aiPersonaSummary,
                    userPersonaSummary,
                    onSave: async (next) => {
                        try {
                            await sdk.memorySummaries.add(aiPersonId, {
                                storageLevel: 'L1',
                                title: next.title,
                                content: next.content,
                                sourceLevel: 'L0',
                                sourceDates: [dateKey],
                                messageCount: next.messageCount,
                                originalDateRange: { start: dateKey, end: dateKey },
                                asPrompt: { active: true, order: 999, source: 'memory-summary' },
                            });
                            try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                            this.toolkit?.island?.notify?.('success', '已保存概要', next.title);
                        } catch (err) {
                            console.error('[chat-app] openDaySummaryRangeModal save failed', err);
                            this.toolkit?.island?.notify?.('error', '保存失败', err?.message || '');
                        }
                    },
                    // ★ v0.66:textarea 为空时点「生成概要」触发 AI 调用
                    //   通过 _getCurrentSummaryEditInstance() 拿到当前弹窗实例,写回 textarea
                    onGenerate: async (payload) => {
                        const inst = _getCurrentSummaryEditInstance();
                        if (!inst) return;
                        inst.isGenerating = true;
                        inst.errorMsg = '';
                        try {
                            // 调用 AI 生成概要
                            const result = await this._generateDaySummary(aiPersonId, mode, {
                                aiName,
                                userName,
                                dateRange: dateRangeText,
                                messages: messagesText,
                                promptTemplate: mergedPrompt,
                                dayMessages,
                            });
                            if (result.ok && result.content) {
                                // 成功:把 AI 返回的概要写入 textarea
                                inst.onGenerateSuccess({
                                    content: result.content,
                                    title: payload.title || `${dateKey} 聊天概要`,
                                });
                                this.toolkit?.island?.notify?.('success', '概要已生成', '请确认后保存');
                            } else {
                                inst.onGenerateError(result.error || '生成失败，请重试');
                                this.toolkit?.island?.notify?.('warning', '生成失败', result.error || '');
                            }
                        } catch (err) {
                            console.error('[chat-app] onGenerate failed', err);
                            inst.onGenerateError('网络错误，请重试');
                            this.toolkit?.island?.notify?.('error', '生成失败', err?.message || '');
                        }
                    },
                });
                return true;
            },

            /**
             * ★ v0.66 调用 AI 生成当日聊天概要
             *   返回: { ok: boolean, content: string, error?: string }
             */
            async _generateDaySummary(aiPersonId, mode, opts = {}) {
                const { aiName, userName, dateRange, messages, promptTemplate, dayMessages } = opts;
                const apiSdk = window.__apiSdk;
                if (!apiSdk) return { ok: false, error: 'API SDK 未加载' };

                // 拼装系统 prompt
                const systemPrompt = `你是聊天概要生成助手。请根据以下对话记录,生成一段简洁准确的聊天概要。

=== AI 人设 ===
名字: ${aiName || '未知'}

=== 用户人设 ===
名字: ${userName || '用户'}

=== 日期范围 ===
${dateRange || '未知'}

=== 对话记录 ===
${messages || '(无对话记录)'}

请生成一段 100-200 字的聊天概要,包括:
1. 聊了哪些话题
2. 双方的主要互动和情感基调
3. 有无重要事件或约定

直接输出概要正文,不要加前缀说明。`;

                // 选 API key
                const apiKeySdk = apiSdk.apiKeySdk;
                let activeKey = null;
                if (apiKeySdk) {
                    // 优先 listEnabled(),fallback 到 list() 第一条
                    const enabled = apiKeySdk.listEnabled?.() || [];
                    const all = apiKeySdk.list?.() || [];
                    activeKey = enabled[0] || all[0] || null;
                }
                if (!activeKey?.apiKey) {
                    console.warn('[chat-app] _generateDaySummary: no apiKey found. apiSdk=', Object.keys(apiSdk || {}), 'apiKeySdk exists?', !!apiKeySdk);
                    return { ok: false, error: '未配置 API Key,请先在设置中添加' };
                }

                let resp;
                try {
                    resp = await fetch(`${activeKey.baseUrl}/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${activeKey.apiKey}`,
                        },
                        body: JSON.stringify({
                            model: activeKey.model || 'gpt-4o',
                            messages: [{ role: 'user', content: systemPrompt }],
                            temperature: 0.7,
                            max_tokens: 500,
                        }),
                        signal: AbortSignal.timeout(60000),
                    });
                } catch (err) {
                    return { ok: false, error: `网络错误: ${err?.message || '连接失败'}` };
                }

                if (!resp.ok) {
                    const txt = await resp.text().catch(() => '');
                    return { ok: false, error: `HTTP ${resp.status}: ${txt.slice(0, 100)}` };
                }

                let data;
                try {
                    data = await resp.json();
                } catch (_) {
                    return { ok: false, error: 'AI 返回格式错误' };
                }

                const content = data?.choices?.[0]?.message?.content || '';
                if (!content.trim()) return { ok: false, error: 'AI 返回内容为空' };

                return { ok: true, content: content.trim() };
            },

            /**
             * ★ v0.66 把 prompt 模板里的占位符替换成实际值
             *   占位符: {{aiName}} {{userName}} {{dateRange}} {{messages}}
             *   - promptTemplate 为空 → 返回空字符串(让调用方用 fallback)
             *   - 没替换成功的占位符 → 保留原样(不报错,让用户看到提示)
             */
            _fillPromptPlaceholders(template, vars) {
                const t = String(template || '');
                if (!t) return '';
                const aiName = String(vars?.aiName ?? '');
                const userName = String(vars?.userName ?? '');
                const dateRange = String(vars?.dateRange ?? '');
                const messages = String(vars?.messages ?? '');
                return t
                    .replace(/\{\{\s*aiName\s*\}\}/g, aiName)
                    .replace(/\{\{\s*userName\s*\}\}/g, userName)
                    .replace(/\{\{\s*dateRange\s*\}\}/g, dateRange)
                    .replace(/\{\{\s*messages\s*\}\}/g, messages);
            },

            /**
             * ★ v0.66 把当天消息格式化成「发送者: 内容」纯文本(给 prompt 模板的 {{messages}} 用)
             *   - 按时间升序
             *   - 文本直接用 content
             *   - 表情包: [表情包]name
             *   - 位置: [位置]name address
             *   - 图片: [图片]description
             *   - 语音: [语音 N秒]content
             *   - 红包/转账/聊天记录/通话记录: 简化标签
             */
            _formatDayMessagesForPrompt(messages, aiName) {
                if (!Array.isArray(messages)) return '';
                const sorted = messages.slice().sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
                const lines = [];
                for (const m of sorted) {
                    if (!m) continue;
                    if (m.type === 'system' || m.type === 'call_record') continue;
                    const sender = m.sender === 'ai' ? (aiName || 'AI') : '用户';
                    const text = this._summarizeOneMessageForPrompt(m);
                    if (text) lines.push(`- ${sender}: ${text}`);
                }
                return lines.join('\n');
            },

            /**
             * ★ v0.66 从 AI 人设对象抽出一段人类可读的摘要文本,
             *   给 SummaryEditModal 的人设信息折叠区展示用。
             *   字段参考 defaults.js DEFAULT_AI_PERSONA 实际 schema。
             */
            _buildAiPersonaSummary(aiPerson) {
                if (!aiPerson || typeof aiPerson !== 'object') return '';
                const parts = [];
                const name = String(aiPerson.name || '').trim();
                if (name) parts.push(`【名字】${name}`);
                const gender = String(aiPerson.gender || '').trim();
                if (gender) parts.push(`【性别】${gender}`);
                const age = aiPerson.age != null ? String(aiPerson.age) : '';
                if (age) parts.push(`【年龄】${age}`);
                const appearance = String(aiPerson.appearance || '').trim();
                if (appearance) parts.push(`【外貌】${appearance}`);
                const personality = String(aiPerson.personality || '').trim();
                if (personality) parts.push(`【性格】${personality}`);
                const bio = String(aiPerson.bio || '').trim();
                if (bio) parts.push(`【背景/简介】${bio}`);
                const experience = String(aiPerson.experience || '').trim();
                if (experience) parts.push(`【经历】${experience}`);
                const greeting = String(aiPerson.greeting || '').trim();
                if (greeting) parts.push(`【开场白】${greeting}`);
                // socialProfiles.chat 是数组,遍历找 chatProfile
                const chatProfiles = aiPerson.socialProfiles?.chat;
                if (Array.isArray(chatProfiles)) {
                    const chatProfile = chatProfiles[0];
                    if (chatProfile) {
                        const bg = String(chatProfile.background || '').trim();
                        if (bg) parts.push(`【关系背景】${bg}`);
                    }
                }
                return parts.length > 0 ? parts.join('\n') : '';
            },

            /**
             * ★ v0.66 从用户对象(user record)抽出一段人类可读的摘要文本,
             *   给 SummaryEditModal 的人设信息折叠区展示用。
             *   字段参考 defaults.js DEFAULT_USER 实际 schema。
             */
            _buildUserPersonaSummary(userRecord) {
                if (!userRecord || typeof userRecord !== 'object') return '';
                const parts = [];
                const name = String(userRecord.name || userRecord.chineseName || '').trim();
                if (name) parts.push(`【名字/昵称】${name}`);
                const gender = String(userRecord.gender || '').trim();
                if (gender) parts.push(`【性别】${gender}`);
                const age = userRecord.age != null ? String(userRecord.age) : '';
                if (age) parts.push(`【年龄】${age}`);
                const appearance = String(userRecord.appearance || '').trim();
                if (appearance) parts.push(`【外貌】${appearance}`);
                const personality = String(userRecord.personality || '').trim();
                if (personality) parts.push(`【性格】${personality}`);
                const bio = String(userRecord.bio || '').trim();
                if (bio) parts.push(`【背景/简介】${bio}`);
                const experience = String(userRecord.experience || '').trim();
                if (experience) parts.push(`【经历】${experience}`);
                // 爱好在 preferences.hobbies 数组里
                const hobbies = userRecord.preferences?.hobbies;
                if (Array.isArray(hobbies) && hobbies.length > 0) {
                    parts.push(`【爱好】${hobbies.join('、')}`);
                }
                return parts.length > 0 ? parts.join('\n') : '';
            },

            /**
             * ★ v0.66 单条消息转简化文本(给 {{messages}} 用)
             */
            _summarizeOneMessageForPrompt(m) {
                if (!m) return '';
                const lc = m.locationCard || {};
                const rp = m.redpacketCard || {};
                const tc = m.transferCard || {};
                const cr = m.callRecord || {};
                const rec = m.chatRecord || {};
                switch (m.type) {
                    case 'text':
                        return String(m.content || '').trim();
                    case 'sticker':
                        return `[表情包]${m.stickerName || m.stickerCode || ''}`.trim();
                    case 'location': {
                        const name = lc.name || '位置';
                        const address = lc.address || '';
                        return address ? `[位置]${name} ${address}` : `[位置]${name}`;
                    }
                    case 'image':
                    case 'descriptive_image': {
                        const desc = m.imageDescription || m.desc || m.content || '';
                        return desc ? `[图片]${desc}` : '[图片]';
                    }
                    case 'voice': {
                        const dur = Number(m.duration || m.voiceDuration) || 0;
                        const vc = String(m.voiceContent || m.content || '').trim();
                        return vc ? `[语音 ${dur}秒]${vc}` : `[语音 ${dur}秒]`;
                    }
                    case 'redpacket': {
                        const greet = rp.message || rp.blessing || '恭喜发财';
                        const amt = rp.amount ? ` ¥${Number(rp.amount).toFixed(2)}` : '';
                        return `[红包]${greet}${amt}`;
                    }
                    case 'transfer': {
                        const note = tc.note || '转账';
                        const amt = tc.amount ? ` ¥${Number(tc.amount).toFixed(2)}` : '';
                        return `[转账]${note}${amt}`;
                    }
                    case 'chat_record': {
                        const t = rec.title || '聊天记录';
                        return `[聊天记录]${t}`;
                    }
                    case 'call_record': {
                        const ct = cr.callType === 'video' ? '视频通话' : '语音通话';
                        return cr.wasConnected === false ? `[${ct}] 未接通` : `[${ct}]`;
                    }
                    default:
                        return String(m.content || `[${m.type || '消息'}]`).trim();
                }
            },

            /**
             * ★ v0.66 应用 L1 概要到 prompt 管理
             *   - 跳到 prompt-manager 页
             *   - 自动把这条概要「active=true」并拼到 contextOrder 最前面
             *   - payload: { aiPersonId, mode, summaryId }
             */
            async applyMemorySummaryToPromptManager(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                const summaryId = String(payload.summaryId || '');
                const mode = String(payload.mode || 'calendar');
                if (!aiPersonId || !summaryId) return;
                const sdk = window.settingsSdk;
                if (!sdk?.memorySummaries) return;
                const cur = sdk.memorySummaries.get(aiPersonId, summaryId);
                if (!cur) {
                    this.toolkit?.island?.notify?.('warning', '概要不存在');
                    return;
                }
                // 1) 设 active=true
                try {
                    await sdk.memorySummaries.setActive(aiPersonId, summaryId, true);
                } catch (err) {
                    console.warn('[chat-app] applyMemorySummaryToPromptManager setActive failed', err);
                }
                // 1.5) 清掉 memorySummaryInjectMap 里「该 summary 已关闭」的残留(同步 setActive + localStorage)
                try {
                    if (!this.app.state) this.app.state = {};
                    if (!this.app.state.chat) this.app.state.chat = {};
                    if (this.app.state.chat.memorySummaryInject?.[aiPersonId]) {
                        const aiMap = this.app.state.chat.memorySummaryInject[aiPersonId];
                        if (aiMap[summaryId] === false) {
                            delete aiMap[summaryId];
                            this.app.state.chat.memorySummaryInject[aiPersonId] = aiMap;
                            try {
                                localStorage.setItem(
                                    'xiaoting::chat-memory-summary-inject-v1',
                                    JSON.stringify(this.app.state.chat.memorySummaryInject),
                                );
                            } catch (_) {}
                        }
                    }
                } catch (_) { /* ignore */ }
                // 2) 写 contextOrder,把这条概要拼到最前面
                try {
                    if (!this.app.state) this.app.state = {};
                    if (!this.app.state.chat) this.app.state.chat = {};
                    if (!this.app.state.chat.contextOrder) this.app.state.chat.contextOrder = {};
                    const list = (this.app.state.chat.contextOrder[aiPersonId] || []).slice();
                    const filtered = list.filter((id) => id !== summaryId);
                    filtered.unshift(summaryId);
                    this.app.state.chat.contextOrder[aiPersonId] = filtered;
                    try {
                        localStorage.setItem(
                            'xiaoting::chat-context-order-v1',
                            JSON.stringify(this.app.state.chat.contextOrder),
                        );
                    } catch (_) {}
                } catch (err) {
                    console.warn('[chat-app] applyMemorySummaryToPromptManager contextOrder failed', err);
                }
                // 3) 跳到 prompt-manager
                try {
                    this.toolkit?.actions?.openApp?.('chat', `prompt-manager-${aiPersonId}`, {});
                } catch (err) {
                    // fallback: 派发 detail action
                    try {
                        document.dispatchEvent(new CustomEvent('app:page-action', {
                            detail: {
                                action: 'detail',
                                appId: 'chat',
                                pageId: `prompt-manager-${aiPersonId}`,
                            },
                            bubbles: true,
                        }));
                    } catch (_) {}
                }
                this.toolkit?.island?.notify?.('success', '已应用到 Prompt 管理', cur.title);
                // ★ v0.66 立即二段式重画 + 跳页
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}
            },

            /**
             * ★ v0.65 L1 日概要新建
             *   弹 SummaryRangeModal(选日期范围) → 弹 SummaryEditModal(编辑/重 Roll/保存)
             *   落库到 sdk.memorySummaries.add (storageLevel='L1')
             */
            async openMemoryHistoryCreateModal(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                const mode = String(payload.mode || 'calendar');
                const levelId = String(payload.levelId || 'L1');
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('error', '参数错误', '缺少 aiPersonId');
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.memorySummaries) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }

                // 拉真实消息按日期分组
                let availableDays = [];
                try {
                    const todayList = sdk.chatMessages?.list
                        ? (sdk.chatMessages.list(null, aiPersonId, mode) || [])
                        : [];
                    const archiveList = sdk.chatArchive?.list
                        ? (sdk.chatArchive.list(aiPersonId, mode) || [])
                        : [];
                    const all = [...todayList, ...archiveList];
                    const map = new Map();
                    for (const m of all) {
                        const dk = m.archivedDay || (() => {
                            const d = new Date(Number(m.timestamp) || Date.now());
                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        })();
                        if (!dk) continue;
                        map.set(dk, (map.get(dk) || 0) + 1);
                    }
                    availableDays = Array.from(map.entries())
                        .map(([dateKey, count]) => ({ dateKey, count }))
                        .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
                } catch (err) {
                    console.warn('[chat-app] collect availableDays failed', err);
                }

                if (availableDays.length === 0) {
                    this.toolkit?.island?.notify?.('warning', '暂无聊天记录', '先聊几天再来生成概要吧');
                    return null;
                }

                chatModalManager.openSummaryRange({
                    mode: 'calendar',
                    contactName: '',
                    availableDays,
                    onConfirm: async ({ startDay, endDay, selectedDays }) => {
                        try {
                            // 收集选中日期范围内的所有消息
                            const todayList = sdk.chatMessages?.list
                                ? (sdk.chatMessages.list(null, aiPersonId, mode) || [])
                                : [];
                            const archiveList = sdk.chatArchive?.list
                                ? (sdk.chatArchive.list(aiPersonId, mode, {
                                    sinceDay: startDay,
                                    untilDay: endDay,
                                }) || [])
                                : [];
                            const inRange = [...todayList, ...archiveList].filter((m) => {
                                const dk = m.archivedDay || (() => {
                                    const d = new Date(Number(m.timestamp) || Date.now());
                                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                })();
                                return dk >= startDay && dk <= endDay;
                            });
                            // 占位生成
                            const built = sdk.calendarSummaries.buildPlaceholderFromMessages(inRange, {
                                title: `${startDay} 聊天概要`,
                                maxLines: 50,
                            });
                            // 弹编辑弹窗
                            chatModalManager.openSummaryEdit({
                                mode: 'calendar',
                                initialTitle: built.title,
                                initialContent: built.content,
                                dateRange: built.dateRange,
                                messageCount: built.messageCount,
                                defaultAsPrompt: false,
                                onSave: async (next) => {
                                    await sdk.memorySummaries.add(aiPersonId, {
                                        storageLevel: levelId,
                                        title: next.title,
                                        content: next.content,
                                        sourceLevel: 'L0',
                                        sourceDates: selectedDays || [startDay],
                                        messageCount: next.messageCount,
                                        originalDateRange: next.dateRange,
                                        asPrompt: { active: true, order: 999, source: 'memory-summary' },
                                    });
                                    try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                                    this.toolkit?.island?.notify?.('success', '已保存概要', next.title);
                                },
                            });
                        } catch (err) {
                            console.error('[chat-app] openMemoryHistoryCreateModal failed', err);
                            this.toolkit?.island?.notify?.('error', '生成失败', err?.message || '');
                        }
                    },
                });
                return true;
            },

            /**
             * ★ v0.65 编辑单条概要
             *   payload: { aiPersonId, mode, summaryId }
             *   弹 SummaryEditModal 改标题/内容,保存到 sdk.memorySummaries.update
             */
            async editMemorySummary(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                const summaryId = String(payload.summaryId || '');
                if (!aiPersonId || !summaryId) return;
                const sdk = window.settingsSdk;
                if (!sdk?.memorySummaries) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return;
                }
                const cur = sdk.memorySummaries.get(aiPersonId, summaryId);
                if (!cur) {
                    this.toolkit?.island?.notify?.('warning', '概要不存在');
                    return;
                }
                chatModalManager.openSummaryEdit({
                    mode: 'calendar',
                    initialTitle: cur.title,
                    initialContent: cur.content,
                    dateRange: cur.originalDateRange || { start: '', end: '' },
                    messageCount: cur.messageCount || 0,
                    defaultAsPrompt: cur.asPrompt?.active !== false,
                    onSave: async (next) => {
                        await sdk.memorySummaries.update(aiPersonId, summaryId, {
                            title: next.title,
                            content: next.content,
                            asPrompt: { ...cur.asPrompt, active: !!next.asPrompt },
                        });
                        try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                        this.toolkit?.island?.notify?.('success', '已更新概要', next.title);
                    },
                });
            },

            /**
             * ★ v0.65 重 Roll(重新生成该条概要)
             *   payload: { aiPersonId, mode, summaryId }
             *   当前是占位版:用下层概要重新拼接内容
             */
            async rerollMemorySummary(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                const summaryId = String(payload.summaryId || '');
                if (!aiPersonId || !summaryId) return;
                const sdk = window.settingsSdk;
                if (!sdk?.memorySummaries) return;
                const cur = sdk.memorySummaries.get(aiPersonId, summaryId);
                if (!cur) return;
                // 取 sourceIds 拼回下层概要
                let lowerList = [];
                if (Array.isArray(cur.sourceIds) && cur.sourceIds.length > 0) {
                    lowerList = cur.sourceIds
                        .map((id) => sdk.memorySummaries.get(aiPersonId, id))
                        .filter(Boolean);
                }
                const placeholder = sdk.memorySummaries.buildPlaceholderFromLowerLevel(lowerList, {
                    title: cur.title,
                });
                await sdk.memorySummaries.update(aiPersonId, summaryId, {
                    content: placeholder.content,
                });
                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                this.toolkit?.island?.notify?.('success', '已重新生成', cur.title);
            },

            /**
             * ★ v0.65 删除单条概要(软删,弹确认)
             *   payload: { aiPersonId, mode, summaryId }
             */
            async deleteMemorySummary(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                const summaryId = String(payload.summaryId || '');
                if (!aiPersonId || !summaryId) return;
                const sdk = window.settingsSdk;
                if (!sdk?.memorySummaries) return;
                const cur = sdk.memorySummaries.get(aiPersonId, summaryId);
                if (!cur) return;
                // 顶层确认弹窗
                const ok = typeof window !== 'undefined' && window.__phoneConfirm
                    ? await new Promise((resolve) => {
                        window.__phoneConfirm.request({
                            title: '确认删除概要',
                            text: cur.title,
                            confirmLabel: '删除',
                            danger: true,
                            onConfirm: () => resolve(true),
                            onCancel: () => resolve(false),
                        });
                    })
                    : true;
                if (!ok) return;
                await sdk.memorySummaries.remove(aiPersonId, summaryId);
                // ★ v0.66.x 二段式重画(AGENTS.md §32):先 invalidate cache 再 syncNow,
                //   否则 async detail renderer 命中缓存返回旧 HTML → 「删除后卡片不消失,要切出去再回来」恶性 bug
                try { if (typeof window.invalidateRendererCache === 'function') window.invalidateRendererCache('chat', null); } catch (_) {}
                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                this.toolkit?.island?.notify?.('success', '已删除概要', cur.title);
            },

            /**
             * ★ v0.66 prompt-manager Murmur 组内,记忆概要虚拟卡的「关闭 / 启用」toggle
             *   payload: { aiPersonId, summaryId }
             *   - 行为:跟 replyFormatInject / kChainActive / stickerLibraryInject 完全对齐
             *     · 关闭 → app.state.chat.memorySummaryInject[aiPersonId][summaryId] = false
             *     · 启用 → 设为 true(从 map 里删掉)
             *   - 持久化:localStorage 'xiaoting::chat-memory-summary-inject-v1'
             *   - 影响:
             *     · prompt-manager murmur 折叠区卡片从「启用」切到「关闭」(消失)
             *     · prompt-builder.buildMemoryContext 在拼装时排除该条
             *       (注意:这里我们没改 sdk.memorySummaries.list,而是改 injectMap,
             //        prompt-manager 渲染过滤 = 关闭的从 list 里过滤掉;
             //        prompt-builder 注入 → 我们在 buildMemoryContext 之外再加一层过滤)
             */
            toggleMemorySummaryInject(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                const summaryId = String(payload.summaryId || '');
                if (!aiPersonId || !summaryId) return;
                if (!this.app.state) this.app.state = {};
                if (!this.app.state.chat) this.app.state.chat = {};
                if (!this.app.state.chat.memorySummaryInject) this.app.state.chat.memorySummaryInject = {};
                const aiMap = this.app.state.chat.memorySummaryInject[aiPersonId] || {};
                // 当前 = true → 切到 false;否则切到 true
                const isCurrentlyOn = aiMap[summaryId] !== false;
                if (isCurrentlyOn) {
                    aiMap[summaryId] = false;
                } else {
                    delete aiMap[summaryId];
                }
                this.app.state.chat.memorySummaryInject[aiPersonId] = aiMap;
                try {
                    localStorage.setItem(
                        'xiaoting::chat-memory-summary-inject-v1',
                        JSON.stringify(this.app.state.chat.memorySummaryInject),
                    );
                } catch (_) {}
                // 二段式重画(AGENTS.md §32)
                try { if (typeof window.invalidateRendererCache === 'function') window.invalidateRendererCache('chat', null); } catch (_) {}
                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                this.toolkit?.island?.notify?.(
                    isCurrentlyOn ? 'info' : 'success',
                    isCurrentlyOn ? '已停用' : '已启用',
                    '记忆概要',
                );
            },

            /**
             * ★ v0.66 prompt-manager Murmur 组内,记忆概要虚拟卡的「删除」按钮
             *   payload: { aiPersonId, summaryId }
             *   - 行为:
             *     · 弹顶层确认弹窗(跟 deleteMemorySummary 同款)
             *     · 确认 → sdk.memorySummaries.remove(aiPersonId, summaryId) = 软删
             *     · 软删后从 prompt-manager murmur 区消失 + 重新打开 prompt-builder 时也不注入
             *   - 不改 memorySummaryInjectMap(因为已经从 list 里过滤掉 deleted=true)
             */
            async deleteMemorySummaryFromMurmur(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                const summaryId = String(payload.summaryId || '');
                if (!aiPersonId || !summaryId) return;
                const sdk = window.settingsSdk;
                if (!sdk?.memorySummaries) return;
                const cur = sdk.memorySummaries.get(aiPersonId, summaryId);
                if (!cur) {
                    this.toolkit?.island?.notify?.('warning', '概要不存在');
                    return;
                }
                const ok = typeof window !== 'undefined' && window.__phoneConfirm
                    ? await new Promise((resolve) => {
                        window.__phoneConfirm.request({
                            title: '确认删除概要',
                            text: cur.title,
                            confirmLabel: '删除',
                            danger: true,
                            onConfirm: () => resolve(true),
                            onCancel: () => resolve(false),
                        });
                    })
                    : true;
                if (!ok) return;
                await sdk.memorySummaries.remove(aiPersonId, summaryId);
                // ★ v0.66.x 二段式重画(AGENTS.md §32):先 invalidate cache 再 syncNow,
                //   否则 async detail renderer 命中缓存返回旧 HTML → 「删除后卡片不消失,要切出去再回来」恶性 bug
                try { if (typeof window.invalidateRendererCache === 'function') window.invalidateRendererCache('chat', null); } catch (_) {}
                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                this.toolkit?.island?.notify?.('success', '已删除概要', cur.title);
            },

            /**
             * ★ v0.65 L2+ 「生成概要」按钮
             *   payload: { aiPersonId, mode, levelId }
             *   调 sdk.memorySummaries.generateLevelSummary(满 N 消 N)
             */
            async generateMemorySummaryManually(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                const mode = String(payload.mode || 'calendar');
                const levelId = String(payload.levelId || 'L2');
                if (!aiPersonId) return null;
                const sdk = window.settingsSdk;
                if (!sdk?.memorySummaries) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                const result = await sdk.memorySummaries.generateLevelSummary(aiPersonId, levelId, {});
                if (!result.ok) {
                    this.toolkit?.island?.notify?.('warning', '生成失败', result.error || '');
                    return null;
                }
                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                this.toolkit?.island?.notify?.('success', '已生成', result.summary?.title || '');
                return result;
            },

            /**
             * ★ v0.65 弹「添加层级」表单弹窗
             *   内联渲染到 body(走 framework 顶层 click 委托)
             */
            async openAddLevelModal(payload = {}) {
                // 从当前 detail 页拿 aiPersonId + mode
                let aiPersonId = '';
                let mode = 'calendar';
                try {
                    const detailEl = document.querySelector('.app-shell[data-app-id="chat"] .memory-mgmt');
                    if (detailEl) {
                        aiPersonId = detailEl.dataset.aiPersonId || '';
                        mode = detailEl.dataset.mode || 'calendar';
                    }
                } catch (_) {}
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('error', '参数错误', '请从层级管理页打开');
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.memorySummaries) return null;
                const config = sdk.memorySummaries.getConfig(aiPersonId);
                const levels = config.levels || [];

                // 渲染弹窗
                const overlay = document.createElement('div');
                overlay.className = 'memory-modal-overlay';
                overlay.innerHTML = `
                    <div class="memory-modal" id="add-level-modal">
                        <div class="memory-modal-header">
                            <div class="memory-modal-title">添加层级</div>
                            <div class="memory-modal-desc">在已有层级之间插入新层级,新层初始存量为 0</div>
                        </div>
                        <div class="memory-modal-body">
                            <div class="memory-modal-field">
                                <label class="memory-modal-label">插入位置</label>
                                <select class="memory-modal-select" id="add-level-position">
                                    ${levels.map((l, i) => `<option value="after-${escapeHtml(l.id)}">在 ${escapeHtml(l.name)} 之后</option>`).join('')}
                                    <option value="append">追加到最上层</option>
                                </select>
                            </div>
                            <div class="memory-modal-field">
                                <label class="memory-modal-label">层级名称</label>
                                <input type="text" class="memory-modal-input" id="add-level-name" placeholder="例如:季概要" />
                            </div>
                            <div class="memory-modal-field">
                                <label class="memory-modal-label">周期(天)</label>
                                <div class="memory-modal-cycle-row">
                                    <input type="number" class="memory-modal-input memory-modal-cycle-input" id="add-level-cycle" min="1" value="14" />
                                    <span class="memory-modal-cycle-unit">天</span>
                                </div>
                                <div class="memory-modal-hint" id="add-level-hint">请选择位置后查看约束</div>
                            </div>
                        </div>
                        <div class="memory-modal-footer">
                            <button type="button" class="memory-modal-btn" data-action="cancel">取消</button>
                            <button type="button" class="memory-modal-btn is-primary" data-action="confirm" id="add-level-confirm">添加</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);

                const updateHint = () => {
                    const sel = overlay.querySelector('#add-level-position');
                    const hint = overlay.querySelector('#add-level-hint');
                    const cycleInput = overlay.querySelector('#add-level-cycle');
                    const value = parseInt(cycleInput.value, 10);
                    if (!value || value < 1) {
                        hint.textContent = '周期必须 ≥ 1';
                        hint.classList.remove('is-success');
                        return false;
                    }
                    const posVal = sel.value;
                    if (posVal === 'append') {
                        // 追加:只需 > 当前最上层
                        const max = Math.max(...levels.map((l) => Number(l.cycle) || 1));
                        if (value <= max) {
                            hint.textContent = `必须 > 当前最上层周期(${max})`;
                            hint.classList.remove('is-success');
                            return false;
                        }
                        hint.textContent = `✓ 合法`;
                        hint.classList.add('is-success');
                        return true;
                    }
                    const m = posVal.match(/^after-(.+)$/);
                    if (!m) return false;
                    const anchor = levels.find((l) => l.id === m[1]);
                    if (!anchor) return false;
                    const idx = levels.findIndex((l) => l.id === m[1]);
                    const lower = levels[idx + 1];
                    if (value <= anchor.cycle) {
                        hint.textContent = `必须 > ${anchor.name} 周期(${anchor.cycle})`;
                        hint.classList.remove('is-success');
                        return false;
                    }
                    if (lower && value >= lower.cycle) {
                        hint.textContent = `必须 < ${lower.name} 周期(${lower.cycle})`;
                        hint.classList.remove('is-success');
                        return false;
                    }
                    hint.textContent = `✓ 合法`;
                    hint.classList.add('is-success');
                    return true;
                };

                overlay.querySelector('#add-level-position').addEventListener('change', updateHint);
                overlay.querySelector('#add-level-cycle').addEventListener('input', updateHint);
                overlay.querySelector('#add-level-name').addEventListener('input', () => {});
                updateHint();

                const cleanup = () => {
                    try { document.body.removeChild(overlay); } catch (_) {}
                };
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) cleanup();
                });
                overlay.querySelector('[data-action="cancel"]').addEventListener('click', cleanup);
                overlay.querySelector('[data-action="confirm"]').addEventListener('click', async () => {
                    const name = overlay.querySelector('#add-level-name').value.trim() || '新层级';
                    const cycle = parseInt(overlay.querySelector('#add-level-cycle').value, 10) || 1;
                    const position = overlay.querySelector('#add-level-position').value;
                    if (!updateHint()) {
                        this.toolkit?.island?.notify?.('warning', '周期不合法', '请检查提示');
                        return;
                    }
                    const res = await sdk.memorySummaries.addLevel(aiPersonId, { name, cycle, position });
                    cleanup();
                    if (!res.ok) {
                        this.toolkit?.island?.notify?.('warning', '添加失败', res.error || '');
                        return;
                    }
                    try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                    this.toolkit?.island?.notify?.('success', '已添加层级', res.level?.name || '');
                });
            },

            /**
             * ★ v0.65 弹「删除层级」确认弹窗
             *   payload: { levelId }
             */
            async openRemoveLevelModal(payload = {}) {
                const levelId = String(payload.levelId || '');
                if (!levelId) return;
                let aiPersonId = '';
                try {
                    const detailEl = document.querySelector('.app-shell[data-app-id="chat"] .memory-mgmt');
                    if (detailEl) aiPersonId = detailEl.dataset.aiPersonId || '';
                } catch (_) {}
                if (!aiPersonId) return;
                const sdk = window.settingsSdk;
                if (!sdk?.memorySummaries) return;
                const config = sdk.memorySummaries.getConfig(aiPersonId);
                const level = (config.levels || []).find((l) => l.id === levelId);
                if (!level) return;

                const ok = typeof window !== 'undefined' && window.__phoneConfirm
                    ? await new Promise((resolve) => {
                        window.__phoneConfirm.request({
                            title: `确认删除 ${level.name}`,
                            text: '删除后该层概要将标记为已删除(数据保留可恢复),上层自动降级',
                            confirmLabel: '删除',
                            danger: true,
                            onConfirm: () => resolve(true),
                            onCancel: () => resolve(false),
                        });
                    })
                    : true;
                if (!ok) return;

                const res = await sdk.memorySummaries.removeLevel(aiPersonId, levelId);
                if (!res.ok) {
                    this.toolkit?.island?.notify?.('warning', '删除失败', res.error || '');
                    return;
                }
                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                this.toolkit?.island?.notify?.('success', '已删除层级', level.name);
            },

            /**
             * ★ v0.65 改周期:从 inline input blur 时弹确认弹窗(改后清存量)
             *   payload: { aiPersonId, levelId, newCycle }
             */
            async saveUpdateLevelCycle(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                const levelId = String(payload.levelId || '');
                if (!aiPersonId || !levelId) return;
                const sdk = window.settingsSdk;
                if (!sdk?.memorySummaries) return;
                // 从 DOM 读最新 input 值(payload 不带 newCycle,避免 v-html 重画后旧值)
                let newCycle = 0;
                try {
                    const input = document.querySelector(`.app-shell[data-app-id="chat"] .memory-mgmt-level-cycle-input[data-level-id="${levelId}"]`);
                    if (input) newCycle = Math.max(1, Math.floor(Number(input.value) || 1));
                } catch (_) {}
                if (!newCycle) {
                    this.toolkit?.island?.notify?.('warning', '周期值无效');
                    return;
                }
                const config = sdk.memorySummaries.getConfig(aiPersonId);
                const level = (config.levels || []).find((l) => l.id === levelId);
                if (!level) return;
                if (level.cycle === newCycle) return;

                const ok = typeof window !== 'undefined' && window.__phoneConfirm
                    ? await new Promise((resolve) => {
                        window.__phoneConfirm.request({
                            title: `确认修改 ${level.name} 周期`,
                            text: `新周期 ${newCycle} 天,旧周期 ${level.cycle} 天。修改后该层所有存量清零,从下层已压缩数量重新开始计数。`,
                            confirmLabel: '确认修改',
                            danger: false,
                            onConfirm: () => resolve(true),
                            onCancel: () => resolve(false),
                        });
                    })
                    : true;
                if (!ok) return;

                const res = await sdk.memorySummaries.updateLevelCycle(aiPersonId, levelId, newCycle);
                if (!res.ok) {
                    this.toolkit?.island?.notify?.('warning', '修改失败', res.error || '');
                    try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {} // 让 input 回滚
                    return;
                }
                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                this.toolkit?.island?.notify?.('success', '已修改周期', `${level.name}: ${level.cycle} → ${newCycle} 天`);
            },

            /**
             * ★ v0.61.3 实时计算「当前聊天回合」prompt 文本
             *   - 输入: messages 数组(必须带 sender / timestamp)
             *   - 回合定义:从最新到最旧,连续的同一侧消息归一组;
             *     当 sender 切到另一边时,新一组开始。
             *   - 取最近 contextRounds 个回合(默认 20),拼成文本
             *   - 位置:注入 prompt 时排在「近期聊天」之前 / 之后
             *
             * @param {string} aiPersonId
             * @param {Array} messages
             * @param {number} [contextRounds=20]  - 取自 aiPerson.socialProfiles.chat.rollingConfig.contextRounds
             * @returns {string} 概要文本
             */
            computeContextRoundsPrompt(aiPersonId, messages = [], contextRounds = 20) {
                const list = Array.isArray(messages) ? messages.slice() : [];
                if (list.length === 0) return '';

                // SDK 配置优先
                try {
                    const sdk = window.settingsSdk;
                    const cfg = sdk?.rollingSummaries?.getRollingConfig?.(aiPersonId);
                    if (cfg && Number(cfg.contextRounds) > 0) {
                        contextRounds = Number(cfg.contextRounds);
                    }
                } catch (_) { /* 兜底用传入值 */ }

                // ★ v0.61.8.12 只保留「今天的聊天记录」,过滤掉 8.7 / 8.6 等历史日期
                //   - 过滤基准:调用方本地时区的今天 00:00:00 ~ 23:59:59.999
                const _now = new Date();
                const _dayStart = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 0, 0, 0, 0).getTime();
                const _dayEnd = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 23, 59, 59, 999).getTime();
                const todayList = list.filter((m) => {
                    const ts = Number(m && m.timestamp) || 0;
                    return ts >= _dayStart && ts <= _dayEnd;
                });
                if (todayList.length === 0) return '';

                // 按时间升序
                todayList.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

                // 分组回合:从最早到最新,连续的同一侧归一组
                const rounds = [];
                let cur = [];
                let curSender = null;
                for (const m of todayList) {
                    if (!m || m.sender == null) continue;
                    if (m.sender !== curSender && cur.length > 0) {
                        rounds.push(cur);
                        cur = [];
                    }
                    cur.push(m);
                    curSender = m.sender;
                }
                if (cur.length > 0) rounds.push(cur);

                // 取最后 contextRounds 个回合
                const start = Math.max(0, rounds.length - contextRounds);
                const picked = rounds.slice(start);
                if (picked.length === 0) return '';

                const lines = [`# 当前聊天回合(最近 ${picked.length} / ${contextRounds} 回合,1 回合 = 1 组用户 + 1 组 AI)`];
                picked.forEach((round, i) => {
                    for (const m of round) {
                        const sender = m.sender === 'ai' ? 'AI' : '用户';
                        const text = String(m.content || '').replace(/\s+/g, ' ').trim();

                        // ★ v0.61.8.11 特殊消息永远显示完整内容,不做「空 content 才显示」的判断
                        // 表情包
                        if (m.stickerCode || m.type === 'sticker') {
                            const stickerName = m.stickerName || m.stickerCode || '表情包';
                            const emoji = m.metadata?.emoji || '';
                            const display = emoji ? `${stickerName}${emoji}` : stickerName;
                            lines.push(`- ${sender}: [表情包]${display}`);
                            continue;
                        }
                        // 位置
                        if (m.locationCard || m.type === 'location') {
                            const name = m.locationCard?.name || '';
                            const address = m.locationCard?.address || '';
                            const display = name || address || '位置';
                            lines.push(`- ${sender}: [位置]${display}`);
                            continue;
                        }
                        // 图片描述
                        if (m.imageDescription || (m.type === 'image' && !m.url)) {
                            const desc = m.imageDescription || '';
                            lines.push(`- ${sender}: [图片]${desc || '图片'}`);
                            continue;
                        }
                        // 语音
                        if (m.voiceContent || m.voiceDuration || m.type === 'voice') {
                            const content = m.voiceContent || '';
                            const duration = m.voiceDuration || m.duration || '';
                            const display = content
                                ? `[语音 ${duration}s]${content}`
                                : `[语音 ${duration}s]`;
                            lines.push(`- ${sender}: ${display}`);
                            continue;
                        }
                        // 红包
                        if (m.redpacketCard || m.type === 'redpacket') {
                            const amount = m.redpacketCard?.amount || '';
                            const bless = m.redpacketCard?.blessing || '';
                            const display = bless ? `${amount}元 ${bless}` : `${amount}元`;
                            lines.push(`- ${sender}: [红包 ¥${display}]`);
                            continue;
                        }
                        // 转账
                        if (m.transferCard || m.type === 'transfer') {
                            const amount = m.transferCard?.amount || '';
                            const note = m.transferCard?.note || '';
                            const display = note ? `${amount}元 ${note}` : `${amount}元`;
                            lines.push(`- ${sender}: [转账 ¥${display}]`);
                            continue;
                        }
                        // ★ v0.61.8.13 聊天记录(分享的对话快照)
                        //   卡片 m.type='chat_record' + m.content='' + m.chatRecord={title, messages[]}
                        //   把内嵌 messages 展开成多行「发送者: 内容」
                        if (m.chatRecord && Array.isArray(m.chatRecord.messages) && m.chatRecord.messages.length > 0) {
                            const cr = m.chatRecord;
                            const crTitle = cr.title || '聊天记录';
                            lines.push(`- ${sender}: [聊天记录:${crTitle}]`);
                            for (const inner of cr.messages) {
                                if (!inner) continue;
                                const innerWho = inner.sender === 'ai' ? 'AI' : (inner.sender === 'user' ? '用户' : (inner.senderName || inner.sender || '?'));
                                let innerText = String(inner.content || '').replace(/\s+/g, ' ').trim();
                                const innerType = inner.type || 'text';
                                if (inner.stickerCode || innerType === 'sticker') {
                                    innerText = `[表情包]${inner.stickerName || inner.stickerCode || '表情包'}`;
                                } else if (inner.locationCard || innerType === 'location') {
                                    innerText = `[位置]${inner.locationCard?.name || '位置'}`;
                                } else if (inner.imageDescription) {
                                    innerText = `[图片]${inner.imageDescription || ''}`;
                                } else if (inner.voiceContent || inner.voiceDuration || innerType === 'voice') {
                                    const vc = String(inner.voiceContent || '').replace(/\s+/g, ' ').trim();
                                    const vd = inner.voiceDuration || inner.duration || '';
                                    innerText = vc ? `[语音 ${vd}s]${vc}` : `[语音 ${vd}s]`;
                                } else if (inner.redpacketCard || innerType === 'redpacket') {
                                    const amt = inner.redpacketCard?.amount || '';
                                    const bless = inner.redpacketCard?.blessing || '';
                                    innerText = `[红包 ¥${amt}元 ${bless}]`;
                                } else if (inner.transferCard || innerType === 'transfer') {
                                    const amt = inner.transferCard?.amount || '';
                                    const note2 = inner.transferCard?.note || '';
                                    innerText = `[转账 ¥${amt}元 ${note2}]`;
                                }
                                if (!innerText) innerText = `[${innerType}]`;
                                if (innerText.length > 160) innerText = innerText.slice(0, 160) + '…';
                                lines.push(`  - ${innerWho}: ${innerText}`);
                            }
                            continue;
                        }
                        // ★ v0.61.8.13 通话记录
                        //   卡片 m.type='call_record' + m.callRecord{callType, duration, wasConnected}
                        if (m.callRecord || m.type === 'call_record') {
                            const cr = m.callRecord || {};
                            const callType = cr.callType === 'video' ? '视频通话' : '语音通话';
                            const connected = cr.wasConnected === false ? '未接通' : '已接通';
                            const dur = Number(cr.duration) || 0;
                            const durText = dur > 0 ? `${Math.floor(dur / 60)}分${dur % 60}秒` : '';
                            lines.push(`- ${sender}: [${callType} ${connected}${durText ? ' ' + durText : ''}]`);
                            continue;
                        }
                        // 普通文本
                        if (!text) continue;
                        const short = text.length > 160 ? text.slice(0, 160) + '…' : text;
                        lines.push(`- ${sender}: ${short}`);
                    }
                    // 回合分隔
                    if (i < picked.length - 1) lines.push('---');
                });
                return lines.join('\n');
            },

            /**
             * ★ v0.63 chat-page 渲染时后台触发 K 链压缩(异步,fire-and-forget)
             *   - 不会 throw,失败静默
             *   - v0.63:实际调用AI生成梗概,然后写入K链
             *   - 完成后通知灵动岛
             */
            async _triggerRollingCompress(aiPersonId, mode, messages) {
                try {
                    const sdk = window.settingsSdk;
                    if (!sdk?.rollingSummaries?.compressIfNeeded) return;
                    const cfg = sdk.rollingSummaries.getRollingConfig(aiPersonId);
                    if (!cfg?.enabled) return;

                    // ★ v0.63:传入 generateSummary 回调,让 rollingSummaries 在内部调用AI生成梗概
                    const res = await sdk.rollingSummaries.compressIfNeeded(aiPersonId, mode, messages, {
                        contextRounds: cfg.contextRounds,
                        kMergeSize: cfg.kMergeSize,
                        maxChainLength: cfg.maxChainLength,
                        generateSummary: async (rounds, opts) => {
                            // 这里调用 AI 生成梗概
                            return await generateKChainSummary(rounds, {
                                aiPersonId: opts.aiPersonId,
                                mode: opts.mode || 'calendar',
                                summaryStyle: opts.summaryStyle || 'concise',
                            });
                        },
                    });
                    if (res?.compressed) {
                        // v0.63:通知内容包含生成的梗概预览
                        const preview = res.summaryContent
                            ? res.summaryContent.slice(0, 30) + (res.summaryContent.length > 30 ? '…' : '')
                            : '';
                        this.toolkit?.island?.notify?.(
                            'info',
                            '已生成滚动摘要',
                            preview ? `K${res.chainLength - 1}: ${preview}` : `K链现有 ${res.chainLength} 个 K`,
                        );
                        // ★ v0.63.1 K 生成完成后主动触发 detail 重画
                        //   - 让 prompt-manager 的 K 链卡片(小眼睛 badge + preview 列表)实时显示新 K
                        //   - 之前只在 v0.61.3 上下文初始化时跑过一次 setTimeout 60ms syncNow,
                        //     但 AI 生成 K 可能 1~30 秒,那次 syncNow 早就跑完 → UI 还是看不到新 K
                        try {
                            if (typeof window.invalidateRendererCache === 'function') {
                                window.invalidateRendererCache('chat', null);
                            }
                        } catch (_) {}
                        try {
                            window.__appRendererBridge?.syncNow?.({ force: true });
                        } catch (_) {}
                    }
                } catch (err) {
                    console.warn('[chat-app] _triggerRollingCompress failed', err);
                }
            },

            // ============================================================
            // ★ v0.42 故事存档交互 methods 结束
            // ============================================================

            /** 刷新发起聊天页面的联系人列表（异步加载真实 AI 人设） */
            async refreshNewChatContacts() {
                const page = document.querySelector('.app-shell[data-app-id="chat"] .new-chat-page');
                if (!page) return;

                const contactsList = page.querySelector('#newChatContactsList');
                const contactsTitle = page.querySelector('.contacts-title');
                if (!contactsList) return;

                // ★ v0.28 同步兜底:SDK 还没 ready 时,先从 localStorage 快照渲染
                //   (同时 refreshNewChatContacts 被 SDK ready 事件触发的二次调用会自然覆盖)
                const sdkReady = !!window.settingsSdk;
                if (!sdkReady) {
                    try {
                        const { renderContactItem: renderItem, loadSnapshot } = await import('./pages/new-chat-page.js');
                        const snap = loadSnapshot();
                        const snapAiPersons = Array.isArray(snap?.aiPersons) ? snap.aiPersons : [];
                        const snapWorld = snap?.world || null;
                        if (snapAiPersons.length > 0 && snapWorld) {
                            if (contactsTitle) contactsTitle.textContent = '可添加的 AI 人设（按当前模式筛选）';
                            contactsList.innerHTML = snapAiPersons.map(renderItem).join('');
                            console.log('[chat-app] refreshNewChatContacts snapshot path, count:', snapAiPersons.length);
                            // 不 return —— 后面继续走 SDK 路径覆盖
                        }
                    } catch (_) {}
                }

                try {
                    const { renderContactItem } = await import('./pages/new-chat-page.js');
                    const aiPersons = await getWorldAiPersons();

                    // 没拉到任何 AI 人设时,显示空状态(默认 user 没绑世界时按用户要求不该拉 ai 人设)
                    if (aiPersons.length === 0) {
                        if (contactsTitle) contactsTitle.textContent = '当前默认用户卡未绑定世界观';

                        // 引导:跳到 settings-app 的「用户」详情,让用户绑世界
                        const gotoSettings = JSON.stringify({
                            action: 'appMethod', appId: 'chat', method: 'gotoSettingsBindWorld',
                        });
                        contactsList.innerHTML = `
                            <div class="new-chat-empty-state" data-app-action='${escapeHtml(gotoSettings)}' style="cursor: pointer;">
                                <div class="new-chat-empty-icon">🌐</div>
                                <div class="new-chat-empty-text">还没有可添加的 AI 人设</div>
                                <div class="new-chat-empty-hint">
                                    默认用户卡还没有绑定世界观。<br/>
                                    请到「设置 → 用户」中为「默认用户卡」绑定一个世界观。<br/>
                                    <span class="new-chat-empty-link">→ 前往设置</span>
                                </div>
                            </div>
                        `;
                        console.log('[chat-app] refreshNewChatContacts empty, no ai persons for current world');
                        return;
                    }

                    if (contactsTitle) contactsTitle.textContent = '可添加的 AI 人设（按当前模式筛选）';
                    const itemsHtml = aiPersons.map(renderContactItem).join('');
                    contactsList.innerHTML = itemsHtml;
                    console.log('[chat-app] refreshNewChatContacts done, count:', aiPersons.length);
                } catch (err) {
                    console.warn('[chat-app] refreshNewChatContacts failed:', err);
                }
            },

            /** 刷新个人页面的用户数据 */
            async refreshProfileTab() {
                const shell = document.querySelector('.app-shell[data-app-id="chat"]');
                if (!shell) return;

                try {
                    const user = await getCurrentChatUser();
                    if (!user) return;

                    // 更新用户名和 ID
                    const nameEl = shell.querySelector('.profile-user-name');
                    const idEl = shell.querySelector('.profile-user-id');
                    const balanceEl = shell.querySelector('[data-menu-id="wallet"] .profile-menu-sub');

                    if (nameEl) nameEl.textContent = user.name;
                    if (idEl) idEl.textContent = 'ID: ' + user.userId;
                    if (balanceEl) balanceEl.textContent = '¥' + (typeof user.balance === 'number' ? user.balance.toFixed(2) : '0.00');

                    // 更新拍一拍后缀
                    const patSettingEl = shell.querySelector('[data-menu-id="pat-setting"] .profile-menu-sub');
                    if (patSettingEl) patSettingEl.textContent = user.patSetting || '拍了拍我';

                    // 更新头像
                    const avatarWrap = shell.querySelector('.profile-avatar-inner');
                    if (avatarWrap) {
                        if (user.avatar) {
                            avatarWrap.innerHTML = `<img src="${escapeHtml(user.avatar)}" class="profile-avatar-img" alt="">`;
                        }
                    }

                    // 更新动态页面的背景和头像
                    const momentsPage = shell.querySelector('.moments-page');
                    if (momentsPage) {
                        const profileSection = momentsPage.querySelector('.moments-profile-section');
                        if (profileSection && user.background) {
                            profileSection.style.backgroundImage = `url("${escapeHtml(user.background)}")`;
                            profileSection.style.backgroundSize = 'cover';
                            profileSection.style.backgroundPosition = 'center';
                        }
                        const postAvatar = momentsPage.querySelector('.moments-post-avatar');
                        if (postAvatar && user.avatar) {
                            postAvatar.innerHTML = `<img src="${escapeHtml(user.avatar)}" alt="" class="moments-post-avatar-img">`;
                        }
                    }

                    console.log('[chat-app] refreshProfileTab done, user:', user.name);
                } catch (err) {
                    console.warn('[chat-app] refreshProfileTab failed:', err);
                }
            },

            /** framework 调用：关闭当前 detail 页 */
            closeDetail() {
                console.log('[chat-app] closeDetail called, nav=', !!window.__navigationForDebug);
                if (window.__navigationForDebug?.closeDetailPage) {
                    window.__navigationForDebug.closeDetailPage();
                }
            },

            /**
             * ★ v0.49 关闭表情选择器面板
             *  - 派发入口:data-app-action="{action:appMethod, method:closeEmojiPicker}"
             *  - 实际效果:移除 .chat-private 的 data-emoji-open 属性 + 清状态
             */
            closeEmojiPicker() {
                try {
                    const chatPrivate = document.querySelector('.chat-private');
                    if (chatPrivate) chatPrivate.removeAttribute('data-emoji-open');
                    const chatGroup = document.querySelector('.chat-group');
                    if (chatGroup) chatGroup.removeAttribute('data-emoji-open');
                } catch (_) {}
                try {
                    const chatApp = window.__chatAppSingleton || window.externalAppRegistry?.getApp?.('chat');
                    if (chatApp?.state?.chat) chatApp.state.chat.emojiOpen = false;
                } catch (_) {}
            },

            /**
             * ★ v0.25 模式切换 + 搜索按钮 — 直接画在 renderMessagesPage 输出里
             *
             * 历史问题(v0.24 → v0.24b):
             *   原方案用 initTopbar + MutationObserver 在 .app-topbar 末尾 appendChild 按钮,
             *   但 .app-topbar 是 framework 的 v-if/v-else 模板控制的子节点,framework 重渲时会
             *   子树被重建 → observer 误判「按钮被清掉了」 → 再次注入 → appendChild 触发 observer
             *   → 无限循环(app:close → closeApp → 重画 → observer 检测到 topbar 子树变化
             *   → 注入 → 控制台死循环刷日志,页面卡死)。
             *
             * v0.25 修法:把按钮写进 messages-page 的 v-html 字符串里,在页面结构层落地,
             *   framework 重渲整块 v-html 时按钮自然同步,不再依赖任何 observer / DOM 注入。
             */

            /** 切换搜索模式（后续实现） */
            toggleSearch() {
                // TODO: 搜索逻辑后续实现
                console.log('[chat] toggleSearch called');
            },

            /**
             * ★ v0.23 切换聊天记录模式（日历/故事）
             *   - 翻转全局 mode
             *   - 让 framework 重渲当前消息列表 tab（背景 / 内容都跟着切）
             */
            toggleRecordMode() {
                console.log('[chat-app] toggleRecordMode CALLED, this.toolkit?', !!this.toolkit, 'this.methods?', Object.keys(this.methods || {}).slice(0, 6));
                let next;
                try {
                    next = toggleChatRecordMode();
                    console.log('[chat-app] toggleChatRecordMode returned:', next);
                } catch (err) {
                    console.error('[chat-app] toggleChatRecordMode threw:', err);
                    return;
                }
                const modeCfg = getModeConfig(next);
                console.log('[chat-app] modeCfg:', modeCfg);
                this.toolkit?.island?.notify?.(
                    next === 'story' ? 'info' : 'success',
                    `已切换到${modeCfg.label}`,
                    next === 'story' ? '消息列表背景变为粉色，对话视为游戏模式' : '正常日历模式'
                );
                console.log('[chat-app] refreshMessagesTab starting');
                try {
                    refreshMessagesTab(this);
                    console.log('[chat-app] refreshMessagesTab done');
                } catch (err) {
                    console.error('[chat-app] refreshMessagesTab threw:', err);
                }
                // 同步顶栏 mode toggle 按钮的 svg / variant(framework reactive 重渲)
                syncHeaderActionsWithMode();
            },

            /**
             * ★ v0.31 占位:聊天设置页「语音」入口(原 chat.js 用此触发 AI 语音通话)。
             *   当前 murmur 暂不实现真实语音通话,灵动岛提示后返回。
             */
            placeholderVoiceCall() {
                this.toolkit?.island?.notify?.('info', '语音通话', '即将开放');
            },

            /**
             * ★ v0.31 占位:聊天设置页「视频」入口。
             */
            placeholderVideoCall() {
                this.toolkit?.island?.notify?.('info', '视频通话', '即将开放');
            },

            /**
             * ★ v0.31 占位:AI 专属朋友圈下「查看更多动态」按钮(等待 SDK 接 listOwnerMoments)。
             */
            placeholderSoon() {
                this.toolkit?.island?.notify?.('info', '更多动态', '即将开放');
            },

            /** 显示模拟图片发送弹窗（供外部调用） */
            openDescImageModal() {
                chatModalManager.openDescImageSend({
                    onConfirm: (result) => {
                        // 发送成功后添加到聊天界面
                        const chatPrivate = document.querySelector('.app-shell[data-app-id="chat"] .chat-private');
                        if (chatPrivate) {
                            const messagesContainer = chatPrivate.querySelector('.chat-messages');
                            if (messagesContainer) {
                                const tempMsg = document.createElement('div');
                                tempMsg.className = 'message-wrapper user temporary-message';
                                const shortDesc = result.description.length > 30 ? result.description.substring(0, 30) + '...' : result.description;
                                tempMsg.innerHTML = `
                                    <button class="message-select-button" type="button" aria-label="选择消息" data-message-select="temp-${Date.now()}">
                                        <span class="message-select-check"></span>
                                    </button>
                                    <div class="message sent">
                                        <div class="avatar self" data-poke="self" style="background: #F4A6CD;">我</div>
                                        <div class="message-content">
                                            <div class="message-bubble message-bubble-card">
                                                <div class="desc-image-card" data-desc="${result.description.replace(/"/g, '&quot;')}" data-color="${result.cardColor}" data-text-color="${result.textColor}">
                                                    <div class="desc-image-card-inner" style="background: ${result.cardColor};">
                                                        <div class="desc-image-card-icon" style="color: ${result.textColor};">
                                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.7;">
                                                                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                                            </svg>
                                                        </div>
                                                        <div class="desc-image-card-text" style="color: ${result.textColor};">${shortDesc}</div>
                                                        <div class="desc-image-card-hint" style="color: ${result.textColor};">点击查看详情</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="message-time">${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>
                                `;
                                messagesContainer.appendChild(tempMsg);
                                scrollToBottomWithRetry(messagesContainer);
                                setTimeout(() => tempMsg.classList.remove('temporary-message'), 100);
                            }
                        }
                    }
                });
            },

            /** 为私聊详情页绑定输入区与工具栏交互(每次进 detail 都会调用一次,这里要做幂等) */
            async initPrivateChatInteractions(providedEl) {
                // ★ FIX v0.48:彻底改用 MutationObserver 驱动(见模块顶部 __chatPrivateObserver)。
                //   MutationObserver 保证 innerHTML 写完之后才回调，拿到的一定是「当前显示」
                //   的新节点，不会像旧版 queueMicrotask + 轮询那样在 v-html 替换前绑到旧节点上。
                //   providedEl 由 observer 直接传入；不传时兜底查一次当前 DOM(极少数直接调用场景)。
                const chatPrivate = providedEl || document.querySelector('.chat-private');

                if (!chatPrivate) {
                    return;
                }

                // ★ 防重复绑定:同一节点只绑一次
                //   toggleMultiSelect → 只改 class/文本，不重新 v-html，节点不变，标记继续生效
                if (chatPrivate.__chatPrivateInteractionsBound) {
                    return;
                }
                chatPrivate.__chatPrivateInteractionsBound = true;

                // ★ v0.49 表情选择器面板 — 首次绑定时预填缓存
                //   v0.49.1 流程:
                //     ① _prerenderEmojiPicker(ids) 填 _emojiCache + bridge.syncNow({force:true}) 触发 v-html 重画
                //     ② v-html 重画后 init 又跑一次(新节点没 __chatPrivateInteractionsBound)
                //     ③ 第二次 init 走 cacheHit 分支,但因为 chatRoot 是旧节点,不 fill
                //     ④ 用户点 emoji 按钮时,toggle 路径传入新 chatRoot → prerender 走 cacheHit + fill 分支
                //   注意:init 时不传 chatRoot,因为那是即将被 v-html 重画的旧节点,fill 会被重画冲掉
                try {
                    const sdk = window.settingsSdk;
                    const activeUser = sdk?.users?.getActive?.();
                    const ids = activeUser?.boundResources?.stickerGroupIds || [];
                    if (ids.length > 0) {
                        // ★ v0.49.1:传 chatPrivate 进 prerender ——
                        //   首次:缓存空 → 填缓存 + bridge.syncNow 触发 v-html 重画(chatPrivate 即将失效,fill 被跳过)
                        //   重画后 init 第二次跑(observer 触发,新节点):
                        //   → prerender cacheHit + chatRoot 是新节点 → _fillEmojiPickerImages 直接 fill 缩略图
                        const { _prerenderEmojiPicker } = await import('./components/emoji-picker-panel.js');
                        _prerenderEmojiPicker(ids, chatPrivate).catch(err => {
                            console.warn('[chat-app] prerender emoji picker (init) failed', err);
                        });
                    }
                } catch (err) {
                    console.warn('[chat-app] init emoji picker failed', err);
                }

                // ★ v0.50 进入私聊页即滚到底(像微信那样:打开聊天默认看最新消息)
                //   - 不要等用户点「跳到最新」按钮,符合聊天直觉
                //   - 这里 chatPrivate 已经是 observer 写入后的新节点,container 引用稳定
                try {
                    const initMessagesContainer = chatPrivate.querySelector('.chat-messages');
                    scrollToBottomWithRetry(initMessagesContainer);
                } catch (_) {}

                // ★ FIX v0.46:每次进入页面都重新绑定交互事件
                //   v-html 会替换整个 DOM，切出再返回时旧的事件监听器已失效
                //   必须重新绑定才能让按钮响应点击
                const selectedMessages = new Set();
                const setMultiSelectMode = (enabled) => {
                    chatPrivate.classList.toggle('multi-select-mode', enabled);
                    chatPrivate.querySelectorAll('[data-selected-count]').forEach(el => { el.textContent = selectedMessages.size; });
                    chatPrivate.querySelectorAll('.message-wrapper').forEach(wrapper => wrapper.classList.toggle('selectable', enabled));
                    if (!enabled) {
                        selectedMessages.clear();
                        chatPrivate.querySelectorAll('.message-wrapper.selected').forEach(wrapper => wrapper.classList.remove('selected'));
                        chatPrivate.querySelectorAll('.message-select-button[aria-checked="true"]').forEach(button => button.setAttribute('aria-checked', 'false'));
                    }
                };
                const updateSelection = (button) => {
                    const messageId = button.dataset.messageSelect;
                    const wrapper = button.closest('.message-wrapper');
                    if (!messageId || !wrapper) return;
                    if (selectedMessages.has(messageId)) {
                        selectedMessages.delete(messageId);
                        wrapper.classList.remove('selected');
                        button.setAttribute('aria-checked', 'false');
                    } else {
                        selectedMessages.add(messageId);
                        wrapper.classList.add('selected');
                        button.setAttribute('aria-checked', 'true');
                    }
                    chatPrivate.querySelectorAll('[data-selected-count]').forEach(el => { el.textContent = selectedMessages.size; });
                };
                const notifyMultiAction = async (action) => {
                    const labels = { favorite: '收藏', forward: '转发', delete: '删除' };
                    if (!selectedMessages.size) {
                        window.__phoneIsland?.notify?.('info', '请先选择消息', '点击消息左侧的圆圈进行选择');
                        return;
                    }
                    if (action === 'favorite') {
                        // 创建对话片段收藏
                        const selectedIds = Array.from(selectedMessages);
                        const selectedMsgs = DEMO_MESSAGES.filter(m => selectedIds.includes(m.id));

                        // 构建对话片段
                        const newConversation = {
                            favoriteId: 'conv-' + Date.now(),
                            type: 'conversation',
                            sourceType: 'private',
                            sourceId: contactId,
                            sourceName: '小美',
                            time: '今天 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                            messageCount: selectedMsgs.length,
                            messages: selectedMsgs.map(msg => ({
                                id: msg.id,
                                sender: msg.sender,
                                senderName: msg.senderName || (msg.sender === 'user' ? '我' : '小美'),
                                senderColor: msg.sender === 'user' ? 'pink' : 'blue',
                                type: msg.type,
                                content: msg.content || msg.imageDescription || '',
                                time: msg.time,
                                imagePreview: msg.imageDescription ? (msg.imageDescription.substring(0, 20) + '...') : null,
                                cardColor: msg.cardColor || null,
                                locationName: msg.locationCard?.name || null,
                                locationAddress: msg.locationCard?.address || null,
                            })),
                        };

                        // 添加到收藏列表(在开头插入)
                        window.__chatDemoFavorites.unshift(newConversation);

                        window.__phoneIsland?.notify?.('success', '收藏成功', `已收藏 ${selectedMsgs.length} 条消息为对话片段`);
                    } else if (action === 'forward') {
                        // ★ v0.33 转发:从 DOM 反查消息 + 弹目标选择弹窗
                        const messageIds = Array.from(selectedMessages);
                        const mode = chatPrivate.dataset.mode || 'calendar';
                        const convType = chatPrivate.dataset.conversationType || 'private';
                        const convId = chatPrivate.dataset.conversationId || '';
                        const convName = chatPrivate.dataset.conversationName || '';
                        const sourceMeta = {
                            mode,
                            conversationType: convType,
                            conversationId: convId,
                            conversationName: convName,
                        };
                        let sourceMessages = [];
                        try {
                            const raw = chatPrivate.dataset.rawMessages;
                            if (raw) sourceMessages = JSON.parse(raw);
                        } catch (_) {}
                        try {
                            const { openForwardTargetSelection } = await import('./chat-forward.js');
                            await openForwardTargetSelection({
                                mode,
                                messageIds,
                                sourceMessages,
                                sourceMeta,
                            });
                        } catch (err) {
                            console.error('[chat-app] forward failed', err);
                            window.__phoneIsland?.notify?.('error', '转发失败', err?.message || '');
                        }
                    } else {
                        window.__phoneIsland?.notify?.(action === 'delete' ? 'warning' : 'success', `消息${labels[action]}成功`, `已处理 ${selectedMessages.size} 条消息`);
                    }
                    setMultiSelectMode(false);
                };

                chatPrivate.addEventListener('click', async (event) => {
                    // ★ v0.49 获取 chat-app 单例,用于操作 state.chat.emojiOpen
                    const chatApp = externalAppRegistry.getApp('chat');

                    const selectButton = event.target.closest('[data-message-select]');
                    if (selectButton && chatPrivate.classList.contains('multi-select-mode')) {

                        updateSelection(selectButton);
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                    const multiAction = event.target.closest('[data-multi-action]');
                    if (multiAction) {
                        const action = multiAction.dataset.multiAction;
                        if (action === 'cancel') setMultiSelectMode(false);
                        else notifyMultiAction(action);
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                    const multiSelectButton = event.target.closest('[data-action="multiselect"]');
                    if (multiSelectButton) {
                        setMultiSelectMode(!chatPrivate.classList.contains('multi-select-mode'));
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    const expandBtn = event.target.closest('.expand-toolbar-btn');
                    if (expandBtn) {
                        const toolbar = chatPrivate.querySelector('.input-toolbar');
                        if (!toolbar) return;
                        const expanded = toolbar.classList.toggle('expanded');
                        expandBtn.classList.toggle('active', expanded);
                        expandBtn.setAttribute('aria-expanded', String(expanded));
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // ★ v0.49 输入区右侧 #emojiBtn 笑脸 → 切换表情面板显隐
                    const emojiBtn = event.target.closest('#emojiBtn');
                    if (emojiBtn) {
                        const isOpen = chatPrivate.getAttribute('data-emoji-open') === '1';
                        if (isOpen) {
                            chatPrivate.removeAttribute('data-emoji-open');
                            if (chatApp.state?.chat) chatApp.state.chat.emojiOpen = false;
                        } else {
                            chatPrivate.setAttribute('data-emoji-open', '1');
                            if (chatApp.state?.chat) chatApp.state.chat.emojiOpen = true;
                            // ★ v0.49.1:表情 DOM 已在 v-html 里(只是被 CSS 隐藏),
                            //   init 时已经 prerender + fill 过,这里只需在缓存可能过期时重 fill
                            //   prerender 内部会自动检测 cacheKey 变化并清缓存重载
                            try {
                                const sdk = window.settingsSdk;
                                const activeUser = sdk?.users?.getActive?.();
                                const ids = activeUser?.boundResources?.stickerGroupIds || [];
                                const { _prerenderEmojiPicker } = await import('./components/emoji-picker-panel.js');
                                _prerenderEmojiPicker(ids, chatPrivate).catch(err => {
                                    console.warn('[chat-app] prerender emoji picker failed', err);
                                });
                            } catch (err) {
                                console.warn('[chat-app] prerender emoji picker (toggle) failed', err);
                            }
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // ★ v0.49 表情面板「关闭」按钮 (chat-emoji-picker__close)
                    const emojiClose = event.target.closest('.chat-emoji-picker__close');
                    if (emojiClose) {
                        chatPrivate.removeAttribute('data-emoji-open');
                        if (chatApp.state?.chat) chatApp.state.chat.emojiOpen = false;
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // ★ v0.49 表情图片点击 → 发送 sticker 消息
                    const stickerCell = event.target.closest('.chat-emoji-cell[data-sticker-code]');
                    if (stickerCell) {
                        const code = stickerCell.getAttribute('data-sticker-code');
                        const aiPersonId = chatPrivate.dataset.conversationId || '';
                        const mode = chatPrivate.dataset.mode || 'calendar';
                        try {
                            const sdk = window.settingsSdk;
                            const sender = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                            const { _loadSource } = await import('./components/emoji-picker-panel.js');
                            const url = await _loadSource(code);
                            if (!url) {
                                window.__phoneIsland?.notify?.('warning', '表情加载失败', '原图不存在');
                                event.preventDefault();
                                event.stopPropagation();
                                return;
                            }
                            const now = Date.now();
                            const msgId = `sticker-${now}`;
                            const senderName = (sender?.socialProfiles?.chat?.nickname) || sender?.name || '我';
                            // ★ 持久化 (v0.45 sticker 走 type='sticker' + url 字段)
                            let saved = null;
                            if (sdk?.chatMessages?.add && sender) {
                                saved = await sdk.chatMessages.add(sender, aiPersonId, mode, {
                                    id: msgId,
                                    sender: 'user',
                                    senderName,
                                    type: 'sticker',
                                    content: '[表情]',
                                    url,
                                    stickerCode: code,
                                    timestamp: now,
                                });
                            }
                            if (saved) {
                                // ★ v0.46 修复:写完消息后 invalidate cache,防止下次切回命中旧 HTML
                                window.invalidateRendererCache?.('chat', chatPrivate.dataset.contactId);
                                // ★ 渲染气泡(text-bubble.js 的 case 'sticker' 走 msg.url)
                                const messagesContainer = chatPrivate.querySelector('.chat-messages');
                                if (messagesContainer) {
                                    const { renderTextBubble } = await import('./components/text-bubble.js');
                                    const tempDiv = document.createElement('div');
                                    tempDiv.className = 'message-wrapper user';
                                    tempDiv.dataset.messageId = msgId;
                                    tempDiv.innerHTML = renderTextBubble(saved, null, { aiPersonId, mode });
                                    messagesContainer.appendChild(tempDiv);
                                    scrollToBottomWithRetry(messagesContainer);
                                }
                                // ★ 关闭 picker
                                chatPrivate.removeAttribute('data-emoji-open');
                                if (chatApp.state?.chat) chatApp.state.chat.emojiOpen = false;
                                window.__phoneIsland?.notify?.('success', '已发送表情');
                            } else {
                                window.__phoneIsland?.notify?.('warning', '发送失败', '消息未保存');
                            }
                        } catch (err) {
                            console.error('[chat-app] send sticker failed', err);
                            window.__phoneIsland?.notify?.('error', '发送失败', err?.message || '');
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // ★ v0.33 单条消息操作组的「转发」按钮
                    const singleForwardBtn = event.target.closest('.message-actions [data-action="forward"]');
                    if (singleForwardBtn) {
                        const wrapper = singleForwardBtn.closest('.message-wrapper');
                        const msgId = wrapper?.dataset.messageId;
                        if (msgId) {
                            const mode = chatPrivate.dataset.mode || 'calendar';
                            const convType = chatPrivate.dataset.conversationType || 'private';
                            const convId = chatPrivate.dataset.conversationId || '';
                            const convName = chatPrivate.dataset.conversationName || '';
                            const sourceMeta = { mode, conversationType: convType, conversationId: convId, conversationName: convName };
                            let sourceMessages = [];
                            try {
                                const raw = chatPrivate.dataset.rawMessages;
                                if (raw) sourceMessages = JSON.parse(raw);
                            } catch (_) {}
                            try {
                                const { openForwardTargetSelection } = await import('./chat-forward.js');
                                await openForwardTargetSelection({
                                    mode,
                                    messageIds: [msgId],
                                    sourceMessages,
                                    sourceMeta,
                                });
                            } catch (err) {
                                console.error('[chat-app] single forward failed', err);
                                window.__phoneIsland?.notify?.('error', '转发失败', err?.message || '');
                            }
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                    }

                    const toolBtn = event.target.closest('.toolbar-btn');
                    if (toolBtn) {
                        const expandBtn = chatPrivate.querySelector('.expand-toolbar-btn');
                        const toolbar = chatPrivate.querySelector('.input-toolbar');
                        toolbar?.classList.remove('expanded');
                        expandBtn?.classList.remove('active');
                        expandBtn?.setAttribute('aria-expanded', 'false');

                        const action = toolBtn.dataset.action;

                        // 图片按钮：打开模拟图片发送弹窗
                        if (action === 'image') {
                            chatModalManager.openDescImageSend({
                                onConfirm: async (result) => {
                                    // ★ v0.45:重新查询 DOM（页面加载时为 null），SDK 持久化 + proper 渲染器
                                    const sdk = window.settingsSdk;
                                    const messagesContainer = chatPrivate.querySelector('.chat-messages');
                                    const { aiPersonId, mode } = parseContactId(chatPrivate.dataset.contactId);
                                    const now = Date.now();
                                    const msgId = `img-${now}`;

                                    // 从 SDK 拿 user 头像用于渲染
                                    let userAvatar = '', userAvatarBg = '';
                                    let senderName = '我';
                                    try {
                                        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                                        if (defaultUser) {
                                            const chatProfile = defaultUser.socialProfiles?.chat || {};
                                            userAvatar = chatProfile.avatar || defaultUser.avatar || '';
                                            userAvatarBg = chatProfile.avatarBg || defaultUser.avatarBg || '';
                                            senderName = chatProfile.nickname || defaultUser.name || '我';
                                        }
                                    } catch (_) {}

                                    // 1. 持久化到 IndexedDB
                                    let saved = null;
                                    try {
                                        const sender = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                                        if (sdk?.chatMessages?.add && sender) {
                                            saved = await sdk.chatMessages.add(sender, aiPersonId, mode, {
                                                id: msgId,
                                                sender: 'user',
                                                senderName,
                                                type: 'descriptive_image',
                                                content: result.description,
                                                imageDescription: result.description,
                                                cardColor: result.cardColor,
                                                textColor: result.textColor,
                                                timestamp: now,
                                            });
                                        }
                                    } catch (err) {
                                        console.warn('[chat-app] save image message failed:', err);
                                    }
                                    // ★ FIX v0.47:清 renderer 缓存,避免切出再切回时命中旧 HTML 缓存丢消息
                                    try { window.invalidateRendererCache?.('chat', chatPrivate.dataset.contactId); } catch (_) {}

                                    // 2. 构建消息对象(SDK 没成功时用本地对象)
                                    const msg = saved || {
                                        id: msgId,
                                        sender: 'user',
                                        senderName,
                                        type: 'descriptive_image',
                                        content: result.description,
                                        imageDescription: result.description,
                                        cardColor: result.cardColor,
                                        textColor: result.textColor,
                                        timestamp: now,
                                        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                                    };

                                    // 3. 用 proper 渲染器追加到 DOM
                                    if (messagesContainer) {
                                        const { renderDescImageBubble } = await import('./components/card-messages.js');
                                        const tempDiv = document.createElement('div');
                                        tempDiv.className = 'message-wrapper user';
                                        tempDiv.innerHTML = renderDescImageBubble(msg, null, {
                                            userAvatar, userAvatarBg, aiPersonId, mode
                                        });
                                        messagesContainer.appendChild(tempDiv);
                                        scrollToBottomWithRetry(messagesContainer);
                                    }

                                    window.__phoneIsland?.notify?.('success', '图片已发送', '');
                                }
                            });
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }

                        // 语音按钮：打开语音录制弹窗
                        if (action === 'voice') {
                            chatModalManager.openVoiceRecord({
                                onConfirm: async (result) => {
                                    // ★ v0.45:重新查询 DOM（页面加载时为 null），SDK 持久化 + proper 渲染器
                                    const sdk = window.settingsSdk;
                                    const messagesContainer = chatPrivate.querySelector('.chat-messages');
                                    const { aiPersonId, mode } = parseContactId(chatPrivate.dataset.contactId);
                                    const now = Date.now();
                                    const msgId = `voice-${now}`;

                                    // 从 SDK 拿 user 头像
                                    let userAvatar = '', userAvatarBg = '';
                                    let senderName = '我';
                                    try {
                                        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                                        if (defaultUser) {
                                            const chatProfile = defaultUser.socialProfiles?.chat || {};
                                            userAvatar = chatProfile.avatar || defaultUser.avatar || '';
                                            userAvatarBg = chatProfile.avatarBg || defaultUser.avatarBg || '';
                                            senderName = chatProfile.nickname || defaultUser.name || '我';
                                        }
                                    } catch (_) {}

                                    // 1. 持久化到 IndexedDB
                                    let saved = null;
                                    try {
                                        const sender = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                                        if (sdk?.chatMessages?.add && sender) {
                                            saved = await sdk.chatMessages.add(sender, aiPersonId, mode, {
                                                id: msgId,
                                                sender: 'user',
                                                senderName,
                                                type: 'voice',
                                                content: '[语音消息]',
                                                voiceContent: result.content,
                                                voiceDuration: result.duration,
                                                duration: result.duration,
                                                timestamp: now,
                                            });
                                        }
                                    } catch (err) {
                                        console.warn('[chat-app] save voice message failed:', err);
                                    }
                                    // ★ FIX v0.47:清 renderer 缓存,避免切出再切回时命中旧 HTML 缓存丢消息
                                    try { window.invalidateRendererCache?.('chat', chatPrivate.dataset.contactId); } catch (_) {}

                                    // 2. 构建消息对象
                                    const msg = saved || {
                                        id: msgId,
                                        sender: 'user',
                                        senderName,
                                        type: 'voice',
                                        content: '[语音消息]',
                                        voiceContent: result.content,
                                        voiceDuration: result.duration,
                                        duration: result.duration,
                                        timestamp: now,
                                        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                                    };

                                    // 3. 用 proper 渲染器追加到 DOM
                                    if (messagesContainer) {
                                        const { renderVoiceBubble } = await import('./components/special-messages.js');
                                        const tempDiv = document.createElement('div');
                                        tempDiv.className = 'message-wrapper user';
                                        tempDiv.innerHTML = renderVoiceBubble(msg, null, {
                                            userAvatar, userAvatarBg, aiPersonId, mode
                                        });
                                        messagesContainer.appendChild(tempDiv);
                                        scrollToBottomWithRetry(messagesContainer);
                                    }

                                    window.__phoneIsland?.notify?.('success', '语音已发送', `${result.duration}秒`);
                                }
                            });
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }

                        // 收藏按钮 - 跳转到该联系人的收藏
                        if (action === 'favorite') {
                            // ★ v0.44:用 `_` 分隔 sourceType 和 sourceId(因为 aiPersonId 不含 `_`),
                            //   这样 favorites-private_ai0 能正确解析为 sourceType=private, sourceId=ai0
                            const contactId = chatPrivate.dataset.conversationId || 'ai-1';
                            document.dispatchEvent(new CustomEvent('app:page-action', {
                                detail: { action: 'detail', appId: 'chat', pageId: `favorites-private_${contactId}` },
                                bubbles: true,
                            }));
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }

                        // 位置按钮 - 打开地点选择弹窗
                        if (action === 'location') {
                            chatModalManager.openLocationPicker({
                                onSelect: async (locationData) => {
                                    // ★ v0.46:确保 SDK 已就绪，否则 IndexedDB 保存会静默失败
                                    let sdk = window.settingsSdk;
                                    if (!sdk?.chatMessages?.add) {
                                        if (typeof window.whenSettingsSdkReady === 'function') {
                                            sdk = await window.whenSettingsSdkReady(3000);
                                        }
                                    }
                                    const messagesContainer = chatPrivate.querySelector('.chat-messages');
                                    const { aiPersonId, mode } = parseContactId(chatPrivate.dataset.contactId);
                                    const now = Date.now();

                                    let userAvatar = '', userAvatarBg = '';
                                    let senderName = '我';
                                    try {
                                        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                                        if (defaultUser) {
                                            const chatProfile = defaultUser.socialProfiles?.chat || {};
                                            userAvatar = chatProfile.avatar || defaultUser.avatar || '';
                                            userAvatarBg = chatProfile.avatarBg || defaultUser.avatarBg || '';
                                            senderName = chatProfile.nickname || defaultUser.name || '我';
                                        }
                                    } catch (_) {}

                                    // 构建位置消息（★ v0.45 position 只存 x/y，防止函数导致 DataCloneError）
                                    const locationMsg = {
                                        id: `loc-${now}`,
                                        sender: 'user',
                                        senderName,
                                        type: 'location',
                                        content: '[位置]',
                                        locationCard: {
                                            name: locationData.name || '',
                                            address: locationData.address || '',
                                            position: {
                                                x: locationData.position?.x ?? 0,
                                                y: locationData.position?.y ?? 0,
                                            },
                                        },
                                        timestamp: now,
                                        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                                    };

                                    // 保存到 IndexedDB（★ v0.45 直接用 locationMsg.locationCard，避免引用未序列化的对象）
                                    try {
                                        const sender = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                                        if (sdk?.chatMessages?.add && sender) {
                                            await sdk.chatMessages.add(sender, aiPersonId, mode, {
                                                id: locationMsg.id,
                                                sender: 'user',
                                                senderName,
                                                type: 'location',
                                                content: '[位置]',
                                                locationCard: {
                                                    name: locationData.name || '',
                                                    address: locationData.address || '',
                                                    position: {
                                                        x: locationData.position?.x ?? 0,
                                                        y: locationData.position?.y ?? 0,
                                                    },
                                                },
                                                timestamp: now,
                                            });
                                        }
                                    } catch (err) {
                                        console.warn('[chat] save location message failed:', err);
                                    }
                                    // ★ FIX v0.47:清 renderer 缓存,避免切出再切回时命中旧 HTML 缓存丢消息
                                    try { window.invalidateRendererCache?.('chat', chatPrivate.dataset.contactId); } catch (_) {}

                                    // 立即显示到聊天界面
                                    if (messagesContainer) {
                                        const { renderLocationBubble } = await import('./components/share-cards.js');
                                        const tempDiv = document.createElement('div');
                                        tempDiv.className = 'message-wrapper user';
                                        tempDiv.innerHTML = renderLocationBubble(locationMsg, null, {
                                            userAvatar, userAvatarBg, aiPersonId, mode
                                        });
                                        messagesContainer.appendChild(tempDiv);
                                        scrollToBottomWithRetry(messagesContainer);
                                    }

                                    window.__phoneIsland?.notify?.('success', '位置已发送', locationData.name);
                                },
                                onClose: () => {},
                            });
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }

                        // 拍一拍按钮 - 发送一个中心化的拍一拍提示消息
                        if (action === 'pat') {
                            // v0.33 拍一拍入口已切换为「双击 AI 头像」,工具栏按钮已移除,
                            //   此分支仅做兜底兼容(历史消息里若还有旧按钮 DOM 也不会崩)
                            triggerPatAction(chatPrivate).catch(err => {
                                console.warn('[chat-app] pat action failed:', err);
                                window.__phoneIsland?.notify?.('warning', '拍一拍未完成', '请稍后再试');
                            });
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }

                        // 红包按钮：打开红包发送弹窗
                        if (action === 'redpacket') {
                            chatModalManager.openRedpacketSend({
                                onConfirm: async (result) => {
                                    // ★ v0.46:确保 SDK 已就绪，否则 IndexedDB 保存会静默失败
                                    let sdk = window.settingsSdk;
                                    if (!sdk?.chatMessages?.add) {
                                        if (typeof window.whenSettingsSdkReady === 'function') {
                                            sdk = await window.whenSettingsSdkReady(3000);
                                        }
                                    }
                                    const messagesContainer = chatPrivate.querySelector('.chat-messages');
                                    const { aiPersonId, mode } = parseContactId(chatPrivate.dataset.contactId);
                                    const now = Date.now();
                                    const msgId = `rp-${now}`;

                                    let userAvatar = '', userAvatarBg = '';
                                    let senderName = '我';
                                    try {
                                        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                                        if (defaultUser) {
                                            const chatProfile = defaultUser.socialProfiles?.chat || {};
                                            userAvatar = chatProfile.avatar || defaultUser.avatar || '';
                                            userAvatarBg = chatProfile.avatarBg || defaultUser.avatarBg || '';
                                            senderName = chatProfile.nickname || defaultUser.name || '我';
                                        }
                                    } catch (_) {}

                                    // ★ v0.67 走 chat-asset-service:扣 user 余额 + 写 assetFlow + 写消息
                                    let saved = null;
                                    try {
                                        const { userSendRedpacket } = await import('./services/chat-asset-service.js');
                                        const res = await userSendRedpacket({
                                            aiPersonId,
                                            mode,
                                            amount: Number(result.amount) || 0,
                                            message: result.message || '恭喜发财',
                                        });
                                        if (!res?.ok) {
                                            window.__phoneIsland?.notify?.('warning', '红包发送失败', res?.error || '请稍后重试');
                                            return;
                                        }
                                        saved = res.msg;
                                    } catch (err) {
                                        console.warn('[chat-app] userSendRedpacket failed:', err);
                                        window.__phoneIsland?.notify?.('warning', '红包发送失败');
                                        return;
                                    }
                                    // ★ FIX v0.47:清 renderer 缓存,避免切出再切回时命中旧 HTML 缓存丢消息
                                    try { window.invalidateRendererCache?.('chat', chatPrivate.dataset.contactId); } catch (_) {}

                                    // 2. 构建消息对象
                                    const msg = saved || {
                                        id: msgId,
                                        sender: 'user',
                                        senderName,
                                        type: 'redpacket',
                                        content: '[红包]',
                                        redpacketCard: {
                                            message: result.message,
                                            amount: result.amount,
                                            style: result.style || 'normal',
                                        },
                                        timestamp: now,
                                        time: new Date(now).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                                    };

                                    // 3. 渲染到 DOM
                                    if (messagesContainer) {
                                        const { renderRedpacketBubble } = await import('./components/share-cards.js');
                                        const tempDiv = document.createElement('div');
                                        tempDiv.className = 'message-wrapper user';
                                        tempDiv.innerHTML = renderRedpacketBubble(msg, null, {
                                            userAvatar, userAvatarBg, aiPersonId, mode
                                        });
                                        messagesContainer.appendChild(tempDiv);
                                        scrollToBottomWithRetry(messagesContainer);
                                    }
                                }
                            });
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }

                        // 转账按钮：打开转账发送弹窗
                        if (action === 'transfer') {
                            chatModalManager.openTransferSend({
                                onConfirm: async (result) => {
                                    // ★ v0.46:确保 SDK 已就绪，否则 IndexedDB 保存会静默失败
                                    let sdk = window.settingsSdk;
                                    if (!sdk?.chatMessages?.add) {
                                        if (typeof window.whenSettingsSdkReady === 'function') {
                                            sdk = await window.whenSettingsSdkReady(3000);
                                        }
                                    }
                                    const messagesContainer = chatPrivate.querySelector('.chat-messages');
                                    const { aiPersonId, mode } = parseContactId(chatPrivate.dataset.contactId);
                                    const now = Date.now();
                                    const msgId = `tf-${now}`;

                                    let userAvatar = '', userAvatarBg = '';
                                    let senderName = '我';
                                    try {
                                        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                                        if (defaultUser) {
                                            const chatProfile = defaultUser.socialProfiles?.chat || {};
                                            userAvatar = chatProfile.avatar || defaultUser.avatar || '';
                                            userAvatarBg = chatProfile.avatarBg || defaultUser.avatarBg || '';
                                            senderName = chatProfile.nickname || defaultUser.name || '我';
                                        }
                                    } catch (_) {}

                                    // ★ v0.67 走 chat-asset-service:扣 user 余额 + 写 assetFlow + 写消息
                                    let saved = null;
                                    try {
                                        const { userSendTransfer } = await import('./services/chat-asset-service.js');
                                        const res = await userSendTransfer({
                                            aiPersonId,
                                            mode,
                                            amount: Number(result.amount) || 0,
                                            note: result.note || '转账',
                                        });
                                        if (!res?.ok) {
                                            window.__phoneIsland?.notify?.('warning', '转账发送失败', res?.error || '请稍后重试');
                                            return;
                                        }
                                        saved = res.msg;
                                    } catch (err) {
                                        console.warn('[chat-app] userSendTransfer failed:', err);
                                        window.__phoneIsland?.notify?.('warning', '转账发送失败');
                                        return;
                                    }
                                    // ★ FIX v0.47:清 renderer 缓存,避免切出再切回时命中旧 HTML 缓存丢消息
                                    try { window.invalidateRendererCache?.('chat', chatPrivate.dataset.contactId); } catch (_) {}

                                    // 2. 构建消息对象
                                    const msg = saved || {
                                        id: msgId,
                                        sender: 'user',
                                        senderName,
                                        type: 'transfer',
                                        content: '[转账]',
                                        transferCard: {
                                            amount: result.amount,
                                            note: result.note,
                                            received: false,
                                        },
                                        timestamp: now,
                                        time: new Date(now).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                                    };

                                    // 3. 渲染到 DOM
                                    if (messagesContainer) {
                                        const { renderTransferBubble } = await import('./components/share-cards.js');
                                        const tempDiv = document.createElement('div');
                                        tempDiv.className = 'message-wrapper user';
                                        tempDiv.innerHTML = renderTransferBubble(msg, null, {
                                            userAvatar, userAvatarBg, aiPersonId, mode
                                        });
                                        messagesContainer.appendChild(tempDiv);
                                        scrollToBottomWithRetry(messagesContainer);
                                    }
                                }
                            });
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }

                        if (action && window.__phoneIsland?.notify) {
                            const labels = {
                                voice: '语音',
                                call: '通话',
                                favorite: '收藏',
                                pat: '拍一拍',
                                // ★ v0.49 「自定义」按钮暂时占位,后续接新功能
                                custom: '自定义',
                            };
                            if (labels[action]) {
                                window.__phoneIsland.notify('info', labels[action], '功能即将开放');
                            }
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // 语音通话按钮
                    const voiceCallBtn = event.target.closest('[data-action="voice-call"]');
                    if (voiceCallBtn) {
                        const contactId = chatPrivate.dataset.contactId || 'ai-1';
                        const { aiPersonId, mode } = parseContactId(contactId);
                        // ★ v0.67 真实启动通话(走 callManager)
                        try {
                            const { callManager } = await import('./services/call-manager.js');
                            await callManager.startOutgoingCall(aiPersonId, 'voice', mode);
                        } catch (err) {
                            console.warn('[chat-app] startOutgoingCall failed', err);
                        }
                        document.dispatchEvent(new CustomEvent('app:page-action', {
                            detail: { action: 'detail', appId: 'chat', pageId: `call-voice-${contactId}` },
                            bubbles: true,
                        }));
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // 视频通话按钮
                    const videoCallBtn = event.target.closest('[data-action="video-call"]');
                    if (videoCallBtn) {
                        const contactId = chatPrivate.dataset.contactId || 'ai-1';
                        const { aiPersonId, mode } = parseContactId(contactId);
                        // ★ v0.67 真实启动视频通话
                        try {
                            const { callManager } = await import('./services/call-manager.js');
                            await callManager.startOutgoingCall(aiPersonId, 'video', mode);
                        } catch (err) {
                            console.warn('[chat-app] startOutgoingCall (video) failed', err);
                        }
                        document.dispatchEvent(new CustomEvent('app:page-action', {
                            detail: { action: 'detail', appId: 'chat', pageId: `call-video-${contactId}` },
                            bubbles: true,
                        }));
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // 通话记录卡片的工具按钮(收藏/删除) — 阻止冒泡触发卡片的 detail action
                    const callRecordActionBtn = event.target.closest('.call-record-actions [data-action]');
                    if (callRecordActionBtn) {
                        const action = callRecordActionBtn.dataset.action;
                        if (window.__phoneIsland?.notify) {
                            const labels = {
                                'favorite-call-record': '通话记录收藏',
                                'delete-call-record': '通话记录删除',
                            };
                            window.__phoneIsland.notify('info', labels[action] || '通话操作', '功能即将开放');
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // 模拟图片卡片点击 — 显示图片描述详情
                    const descImageCard = event.target.closest('.desc-image-card');
                    if (descImageCard) {
                        const desc = descImageCard.dataset.desc || '';
                        const cardColor = descImageCard.dataset.color || '#FFE4EC';
                        const textColor = descImageCard.dataset.textColor || '#D4728A';
                        const borderColor = Object.values(DESC_IMAGE_PRESETS || {}).find(p => p.cardColor === cardColor)?.borderColor || '#C0607A';
                        chatModalManager.openDescImage({ description: desc, cardColor, textColor, borderColor });
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // 地点卡片点击 — 显示地点详情弹窗
                    const locationCard = event.target.closest('.location-card-in-chat');
                    if (locationCard) {
                        const name = locationCard.dataset.locationName || '位置';
                        const address = locationCard.dataset.locationAddress || '';
                        const mapEl = locationCard.querySelector('.location-card-map');
                        const bgGradient = mapEl ? (
                            mapEl.style.background ||
                            'linear-gradient(135deg, #E8F2FF, #D6E4FF)'
                        ) : 'linear-gradient(135deg, #E8F2FF, #D6E4FF)';

                        chatModalManager.openLocationCard({ name, address, style: { bgGradient } });
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // ★ v0.67 红包卡片点击 — 弹出领取/拒绝确认弹窗
                    const redpacketCard = event.target.closest('.redpacket-card');
                    if (redpacketCard) {
                        const msgId = redpacketCard.dataset.msgId || '';
                        const wrapper = redpacketCard.closest('.message-wrapper');
                        const isUser = wrapper?.classList?.contains('user') || false;
                        if (!msgId || isUser) {
                            // 用户自己发的红包卡片:不弹窗,只提示一下
                            window.__phoneIsland?.notify?.('info', '你发的红包', '对方可领取');
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                        const msg = findMessageById(msgId);
                        if (!msg) return;
                        const rp = msg.redpacketCard || {};
                        if (rp.opened) {
                            window.__phoneIsland?.notify?.('info', '红包已领取');
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                        if (rp.rejected) {
                            window.__phoneIsland?.notify?.('info', '红包已拒绝');
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                        const { aiPersonId: aiId, mode: md } = parseContactId(chatPrivate.dataset.contactId);
                        const senderName = msg.senderName || '对方';
                        // 检查 AI 余额
                        let insufficientBalance = false;
                        try {
                            const sdk = window.settingsSdk;
                            const balance = sdk?.assetFlow?.getBalance?.('ai', aiId) || 0;
                            if (balance < (Number(rp.amount) || 0)) insufficientBalance = true;
                        } catch (_) {}
                        chatModalManager.openRedpacketReceive({
                            message: rp.message || '恭喜发财',
                            amount: rp.amount || 0,
                            senderName,
                            insufficientBalance,
                            onAccept: async () => {
                                try {
                                    const { userReceiveRedpacket } = await import('./services/chat-asset-service.js');
                                    const res = await userReceiveRedpacket({
                                        aiPersonId: aiId, mode: md, msgId,
                                        amount: rp.amount, message: rp.message,
                                    });
                                    if (res?.ok) {
                                        window.__phoneIsland?.notify?.('success', `领取了 ¥${Number(rp.amount).toFixed(2)} 红包`, '');
                                        // 刷新消息
                                        try { window.invalidateRendererCache?.('chat', chatPrivate.dataset.contactId); } catch (_) {}
                                        try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                                    } else {
                                        window.__phoneIsland?.notify?.('warning', '领取失败', res?.error || '请稍后重试');
                                    }
                                } catch (err) {
                                    console.warn('[chat-app] accept redpacket failed', err);
                                }
                            },
                            onReject: async () => {
                                try {
                                    const { userRejectRedpacket } = await import('./services/chat-asset-service.js');
                                    await userRejectRedpacket({
                                        aiPersonId: aiId, mode: md, msgId,
                                        amount: rp.amount, message: rp.message,
                                    });
                                    window.__phoneIsland?.notify?.('info', '已拒绝红包', '');
                                    try { window.invalidateRendererCache?.('chat', chatPrivate.dataset.contactId); } catch (_) {}
                                    try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                                } catch (err) {
                                    console.warn('[chat-app] reject redpacket failed', err);
                                }
                            },
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // ★ v0.67 转账卡片点击 — 弹出收款/退回确认弹窗
                    const transferCard = event.target.closest('.transfer-card');
                    if (transferCard) {
                        const msgId = transferCard.dataset.msgId || '';
                        const wrapper = transferCard.closest('.message-wrapper');
                        const isUser = wrapper?.classList?.contains('user') || false;
                        if (!msgId || isUser) {
                            window.__phoneIsland?.notify?.('info', '你发的转账', '对方可收款');
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                        const msg = findMessageById(msgId);
                        if (!msg) return;
                        const tc = msg.transferCard || {};
                        if (tc.received) {
                            window.__phoneIsland?.notify?.('info', '转账已收款');
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                        if (tc.returned) {
                            window.__phoneIsland?.notify?.('info', '转账已退回');
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                        const { aiPersonId: aiId, mode: md } = parseContactId(chatPrivate.dataset.contactId);
                        const senderName = msg.senderName || '对方';
                        let insufficientBalance = false;
                        try {
                            const sdk = window.settingsSdk;
                            const balance = sdk?.assetFlow?.getBalance?.('ai', aiId) || 0;
                            if (balance < (Number(tc.amount) || 0)) insufficientBalance = true;
                        } catch (_) {}
                        chatModalManager.openTransferReceive({
                            amount: tc.amount || 0,
                            note: tc.note || '转账',
                            senderName,
                            insufficientBalance,
                            onAccept: async () => {
                                try {
                                    const { userReceiveTransfer } = await import('./services/chat-asset-service.js');
                                    const res = await userReceiveTransfer({
                                        aiPersonId: aiId, mode: md, msgId,
                                        amount: tc.amount, note: tc.note,
                                    });
                                    if (res?.ok) {
                                        window.__phoneIsland?.notify?.('success', `已收款 ¥${Number(tc.amount).toFixed(2)}`, '');
                                        try { window.invalidateRendererCache?.('chat', chatPrivate.dataset.contactId); } catch (_) {}
                                        try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                                    } else {
                                        window.__phoneIsland?.notify?.('warning', '收款失败', res?.error || '请稍后重试');
                                    }
                                } catch (err) {
                                    console.warn('[chat-app] accept transfer failed', err);
                                }
                            },
                            onReturn: async () => {
                                try {
                                    const { userReturnTransfer } = await import('./services/chat-asset-service.js');
                                    await userReturnTransfer({
                                        aiPersonId: aiId, mode: md, msgId,
                                        amount: tc.amount, note: tc.note,
                                    });
                                    window.__phoneIsland?.notify?.('info', '已退回转账', '');
                                    try { window.invalidateRendererCache?.('chat', chatPrivate.dataset.contactId); } catch (_) {}
                                    try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                                } catch (err) {
                                    console.warn('[chat-app] return transfer failed', err);
                                }
                            },
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // 语音消息转文字切换
                    const voiceTranscribeToggle = event.target.closest('.voice-transcribe-toggle');
                    if (voiceTranscribeToggle) {
                        const transcribeEl = voiceTranscribeToggle.closest('.voice-transcribe');
                        if (transcribeEl) {
                            transcribeEl.classList.toggle('expanded');
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                    }
                });

                // ★ v0.33 双击头像触发拍一拍
                //   - 用 dblclick 而不是 click,避免和单击(无操作)冲突
                //   - 双击用户头像(.avatar[data-poke="self"])→ 用户拍 AI
                //   - 双击 AI 头像(.avatar[data-poke="other"]) → AI 拍用户
                //   - 各自只生成 1 条气泡,不再「用户拍 AI 后 AI 自动拍回」
                chatPrivate.addEventListener('dblclick', (event) => {
                    const avatar = event.target.closest('.avatar[data-poke]');
                    if (!avatar) return;
                    const from = avatar.dataset.poke === 'self' ? 'user' : 'ai';
                    event.preventDefault();
                    event.stopPropagation();
                    triggerPatAction(chatPrivate, from).catch(err => {
                        console.warn('[chat-app] pat dblclick failed:', err);
                    });
                });

                // ★ v0.30 真实发送文本消息
                //   - 点 sendBtn / 输入框 Enter / Shift+Enter 换行 → 写盘 + 立即追加到 DOM
                //   - 输入框是 contenteditable div,content 在 textContent / innerText
                //   - 写盘后立刻更新 entry.lastMessage,这样消息列表页预览能跟上
                const sendBtn = chatPrivate.querySelector('#sendBtn');
                const messageInput = chatPrivate.querySelector('#messageInput');
                const messagesContainer = chatPrivate.querySelector('.chat-messages');

                /**
                 * 解析 chatPrivate.dataset.contactId 为 aiPersonId + mode
                 * contactId 可能是 'ai0' 或 'private-ai0-calendar' 或 'ai0-calendar'
                 */
                const parseContactId = (raw) => {
                    let id = String(raw || '');
                    if (id.startsWith('private-')) id = id.slice('private-'.length);
                    const lastDash = id.lastIndexOf('-');
                    if (lastDash > 0) {
                        const tail = id.slice(lastDash + 1);
                        if (tail === 'calendar' || tail === 'story') {
                            return { aiPersonId: id.slice(0, lastDash), mode: tail };
                        }
                    }
                    return { aiPersonId: id, mode: chatPrivate.dataset.mode || 'calendar' };
                };

                /**
                 * ★ v0.67 在当前 chat 缓存里查某条消息(从 dataset.rawMessages 拿)
                 * 渲染时 chat-page.js 把最近 100 条消息塞到 data-raw-messages attribute
                 * 给卡片点击 handler 用,避免再去 sdk.chatMessages.list 同步读
                 */
                const findMessageById = (id) => {
                    if (!id) return null;
                    try {
                        const raw = chatPrivate.dataset.rawMessages;
                        if (!raw) return null;
                        const list = JSON.parse(raw);
                        return Array.isArray(list) ? list.find((m) => m && m.id === id) || null : null;
                    } catch (_) { return null; }
                };

                /**
                 * 把消息对象追加到消息列表末尾 + 滚动到底部
                 *  复用 renderTextBubble,与上面 renderMessageList 保持视觉一致
                 */
                const appendMessageBubble = (msg, contact, ctxOpts = {}) => {
                    if (!messagesContainer) return;
                    // renderTextBubble 已经在 chat-page.js 里 import 进来了
                    // 通过模块顶层 import 拿到
                    const aiPersonId = ctxOpts.aiPersonId || '';
                    const mode = ctxOpts.mode || 'calendar';
                    const html = renderTextBubble(msg, contact || {}, { aiPersonId, mode });
                    const tmp = document.createElement('div');
                    tmp.innerHTML = html.trim();
                    const node = tmp.firstElementChild;
                    if (node) {
                        messagesContainer.appendChild(node);
                        scrollToBottomWithRetry(messagesContainer);
                    }
                };

                const doSend = async () => {
                    if (!messageInput) return;
                    const text = (messageInput.innerText || messageInput.textContent || '').trim();
                    if (!text) return;

                    const { aiPersonId, mode } = parseContactId(chatPrivate.dataset.contactId);
                    // ★ LOG-1: 文字消息发送时的关键参数
                    console.log('[LOG-1][doSend] contactId=', chatPrivate.dataset.contactId, 'aiPersonId=', aiPersonId, 'mode=', mode, 'text=', text.slice(0,20));
                    const sdk = window.settingsSdk;
                    if (!sdk?.chatMessages?.add) {
                        window.__phoneIsland?.notify?.('error', '发送失败', 'SDK 未就绪');
                        return;
                    }

                    // 默认 user 名(从 defaultUserCard 拿)
                    let senderName = '我';
                    try {
                        const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                        senderName = defaultUser?.socialProfiles?.chat?.nickname || defaultUser?.name || '我';
                    } catch (_) {}

                    // ★ v0.43 如果有引用回复,带上 replyTo
                    let replyTo = null;
                    try {
                        const st = this._ensureChatActionState(this.app);
                        if (st.replyingTo && st.replyingTo.aiPersonId === aiPersonId && st.replyingTo.mode === mode) {
                            replyTo = { ...st.replyingTo };
                            // 发送后清空引用状态并触发重渲染
                            st.replyingTo = null;
                            this._triggerChatActionRerender();
                        }
                    } catch (_) {}

                    const msg = {
                        sender: 'user',
                        senderName,
                        type: 'text',
                        content: text,
                        timestamp: Date.now(),
                        ...(replyTo ? { replyTo } : {}),
                    };

                    try {
                        // 1. 写盘
                        const sender = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                        if (!sender) {
                            window.__phoneIsland?.notify?.('error', '发送失败', '未找到默认用户');
                            return;
                        }
                        const saved = await sdk.chatMessages.add(sender, aiPersonId, mode, msg);
                        if (!saved) {
                            window.__phoneIsland?.notify?.('error', '发送失败', '请重试');
                            return;
                        }
                        // ★ FIX v0.47:清 renderer 缓存,避免切出再切回时命中旧 HTML 缓存丢消息
                        try { window.invalidateRendererCache?.('chat', chatPrivate.dataset.contactId); } catch (_) {}
                        // 2. 立即把气泡追到 DOM
                        appendMessageBubble(saved, { name: senderName, senderName }, { aiPersonId, mode });
                        // 3. 清空输入框
                        messageInput.innerHTML = '';
                        messageInput.focus();
                        // 4. 更新联系人 entry.lastMessage(消息列表页预览要用)
                        try {
                            const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                            if (defaultUser && sdk.chatFriends?.updateLastMessage) {
                                await sdk.chatFriends.updateLastMessage(sdk, defaultUser, aiPersonId, mode, {
                                    content: text,
                                    timestamp: saved.timestamp,
                                    senderName,
                                    type: 'text',
                                });
                            }
                        } catch (e) {
                            console.warn('[chat-app] updateLastMessage failed:', e);
                        }
                        // 5. 派发事件,通知消息列表页刷新预览
                        try {
                            window.dispatchEvent(new CustomEvent('chat:message-sent', {
                                detail: { aiPersonId, mode, message: saved },
                            }));
                        } catch (_) {}
                    } catch (err) {
                        console.warn('[chat-app] send message failed:', err);
                        window.__phoneIsland?.notify?.('error', '发送失败', err?.message || '请重试');
                    }
                };

                // ★ v0.62.5 发送按钮改造:短按 vs 长按
                //   - 短按(< 1.5 秒):仅发文字消息,不调 AI
                //   - 长按(≥ 1.5 秒):发文字 + 调 AI
                //   - 空文本:整个发送逻辑不响应(短按长按都不响应)
                //   - 长按时按钮变粉 + 进度填充,作为视觉反馈
                if (sendBtn) {
                    const PRESS_THRESHOLD_MS = 1500; // ★ v0.62.5 长按 1.5 秒触发
                    let pressTimer = null;
                    let pressProgressRaf = null;
                    let pressStartTs = 0;
                    let pressTriggered = false;
                    // ★ v0.62.8 长按时:输入框为空 → 从 prompt-manager 预览区(pre)读文本
                    //   - 优先 DOM 读(detail 页打开过就有),fallback 调 builder.buildPreview
                    function _readPromptPreviewText() {
                        const { aiPersonId: aid, mode: m } = parseContactId(chatPrivate.dataset.contactId);
                        try {
                            const pre = document.querySelector(
                                '.app-shell[data-app-id="chat"] .pm-context-preview__raw'
                            );
                            if (pre) {
                                const t = (pre.textContent || pre.innerText || '').trim();
                                if (t) return t;
                            }
                        } catch (_) {}
                        try {
                            const builder = window.__chatPromptBuilder;
                            if (builder?.buildPreview && aid) {
                                const r = builder.buildPreview(aid, { mode: m });
                                const t = (r?.preview || '').trim();
                                if (t) return t;
                            }
                        } catch (_) {}
                        return '';
                    }

                    // ★ v0.62.8 长按触发 AI 回复(独立入口,不依赖 doSend)
                    //   - 长按 + 有文本 → 什么也不做(用户原话:输入框有内容时长按无效)
                    //   - 长按 + 空文本 → 读 pre 内容,作为 userText 调 AI 回复(不写盘)
                    async function _longPressInvokeAi() {
                        const { aiPersonId, mode } = parseContactId(chatPrivate.dataset.contactId);
                        const inputText = messageInput ? (messageInput.innerText || messageInput.textContent || '').trim() : '';
                        if (inputText) return; // 输入框有内容 → 长按无效(用户偏好)
                        const sendText = _readPromptPreviewText();
                        if (!sendText) {
                            try {
                                window.__phoneIsland?.notify?.('warning', '无可发送内容', '输入框为空且未生成预览');
                            } catch (_) {}
                            return;
                        }
                        try {
                            window.__phoneIsland?.notify?.('info', '正在发送给 AI…', sendText.slice(0, 30));
                        } catch (_) {}
                        try {
                            const inst = externalAppRegistry?.getApp?.('chat') || window.__chatAppSingleton;
                            if (inst?.methods?.sendMessageWithAi) {
                                await inst.methods.sendMessageWithAi({ aiPersonId, mode, text: sendText });
                            } else {
                                console.warn('[chat-app] sendMessageWithAi not found, inst=', inst);
                            }
                        } catch (aiErr) {
                            console.warn('[chat-app] sendMessageWithAi invoke failed', aiErr);
                        }
                        console.log('[chat][sendBtn] 长按 1.5 秒(pre)触发,textLen=', sendText.length);
                    }

                    const startPress = (ev) => {
                        if (!sendBtn) return;
                        // ★ v0.62.8 任何情况都允许长按启动进度条;最终要不要触发由 endPress 决定
                        pressTriggered = false;
                        sendBtn.classList.add('is-pressing');
                        sendBtn.classList.remove('is-pressing--armed');
                        sendBtn.style.setProperty('--press-progress', '0');
                        pressStartTs = Date.now();
                        sendBtn.style.setProperty('--press-duration', PRESS_THRESHOLD_MS + 'ms');
                        pressTimer = setTimeout(() => {
                            pressTriggered = true;
                            sendBtn.classList.add('is-pressing--armed');
                        }, PRESS_THRESHOLD_MS);
                        if (typeof ev?.preventDefault === 'function') ev.preventDefault();
                        if (typeof ev?.stopPropagation === 'function') ev.stopPropagation();
                    };
                    const endPress = (ev) => {
                        if (pressTimer) {
                            clearTimeout(pressTimer);
                            pressTimer = null;
                        }
                        sendBtn.classList.remove('is-pressing', 'is-pressing--armed');
                        sendBtn.style.setProperty('--press-progress', '0');
                        const inputText = messageInput ? (messageInput.innerText || messageInput.textContent || '').trim() : '';
                        if (pressTriggered) {
                            // 长按 1.5 秒达到阈值 → 调 AI(走 _longPressInvokeAi,内部判断输入框状态)
                            pressTriggered = false;
                            ev?.preventDefault?.();
                            ev?.stopPropagation?.();
                            _longPressInvokeAi();
                        } else {
                            // ★ v0.62.7:短按(< 1.5 秒松开)→ 仅发送文字消息,不调 AI
                            //   与群聊页(chat-group)的「短按 = 发文字」行为对齐。
                            ev?.preventDefault?.();
                            ev?.stopPropagation?.();
                            if (inputText) {
                                doSend();
                            } else {
                                try {
                                    window.__phoneIsland?.notify?.('warning', '消息为空', '请先输入内容');
                                } catch (_) {}
                            }
                        }
                    };
                    sendBtn.addEventListener('pointerdown', startPress);
                    sendBtn.addEventListener('pointerup', endPress);
                    sendBtn.addEventListener('pointercancel', endPress);
                    sendBtn.addEventListener('pointerleave', (ev) => {
                        if (pressTimer) endPress(ev);
                    });
                    sendBtn.addEventListener('touchstart', (ev) => {
                        if (sendBtn.dataset.pressing === '1') return;
                        sendBtn.dataset.pressing = '1';
                        startPress(ev);
                    }, { passive: true });
                    sendBtn.addEventListener('touchend', (ev) => {
                        if (sendBtn.dataset.pressing !== '1') return;
                        sendBtn.dataset.pressing = '0';
                        endPress(ev);
                    });
                    sendBtn.addEventListener('touchcancel', (ev) => {
                        if (sendBtn.dataset.pressing !== '1') return;
                        sendBtn.dataset.pressing = '0';
                        endPress(ev);
                    });
                }
                if (messageInput) {
                    // ★ 使用 keydown 监听 Enter 而不是 Enter 合成 keypress
                    // 1) keypress 不受 contenteditable 元素默认 Enter 行为影响
                    // 2) Shift+Enter 仍然走默认换行
                    // 3) 中文输入法正在输入时浏览器不会触发 keydown key=Enter
                    messageInput.addEventListener('keydown', (ev) => {
                        if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
                            ev.preventDefault();
                            doSend();
                        }
                    });
                }

                console.log('[chat-app] initPrivateChatInteractions bound');
            },

            /**
             * ★ v0.29 聊天设置页「聊天背景」行点击入口。
             *
             * 触发链路:
             *   <div class="chat-setting-item" id="set-chat-background" data-app-action="...">
             *   → framework 顶层 click 委托
             *   → externalAppRegistry.invokeMethod('chat', 'openChatBackgroundModal', payload)
             *   → 本方法
             *
             * 设计要点:
             *   - payload = { contactId, mode }
             *   - 拿 SDK 读 entry,得到当前 chatBackground(可能为空)
             *   - 弹 chatModalManager.openChatBackground 弹窗(v0.29.1 极简版, 只支持上传图片)
             *   - 用户点「保存」→ onSave(value) → sdk.chatFriends.updateBackground 写盘
             *   - 写入成功后:派发 chat:chat-background-changed 事件 + 触发 framework 重画
             *     (让消息列表/私聊页立刻生效)
             *   - 用户点「恢复默认」onSave 传空字符串,等效清空背景
             *
             * @param {Object} payload { contactId: string, mode: string }
             */
            async openChatBackgroundModal(payload = {}) {
                const contactId = payload?.contactId || '';
                const mode = payload?.mode || 'calendar';

                if (!contactId) {
                    console.warn('[chat-app] openChatBackgroundModal: contactId empty');
                    this.toolkit?.island?.notify?.('error', '打开失败', '缺少联系人 ID');
                    return null;
                }

                const sdk = window.settingsSdk;
                if (!sdk?.chatFriends || !sdk?.users) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }
                const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                if (!defaultUser) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户卡');
                    return null;
                }

                const entry = sdk.chatFriends.get(defaultUser, contactId, mode);
                if (!entry) {
                    this.toolkit?.island?.notify?.(
                        'warning',
                        '该联系人尚未添加',
                        '请先在「发起聊天」页添加此 AI 联系人后再设置背景'
                    );
                    return null;
                }

                const currentValue = entry.chatBackground || '';

                chatModalManager.openChatBackground({
                    currentValue,
                    onSave: async (newValue) => {
                        try {
                            const updated = await sdk.chatFriends.updateBackground(
                                sdk, defaultUser, contactId, mode, newValue
                            );
                            if (!updated) {
                                this.toolkit?.island?.notify?.('warning', '保存失败', '该联系人已被删除');
                                return;
                            }
                            // 派发事件让监听方自行重画
                            try {
                                window.dispatchEvent(new CustomEvent('chat:chat-background-changed', {
                                    detail: {
                                        contactId,
                                        mode,
                                        oldValue: currentValue,
                                        newValue: newValue || '',
                                        entry: updated,
                                    },
                                }));
                            } catch (_) {}

                            // 触发 framework 重画:聊天设置页(更新右侧预览) + 私聊页(应用新背景)
                            if (typeof window.__detailRenderTick !== 'undefined') {
                                window.__detailRenderTick.value++;
                            }
                            refreshMessagesTab(this);

                            this.toolkit?.island?.notify?.(
                                'success',
                                newValue ? '聊天背景已保存' : '已恢复默认背景',
                                newValue ? '消息滚动区已应用新背景' : '消息滚动区背景已清空'
                            );
                        } catch (err) {
                            console.error('[chat-app] openChatBackgroundModal: save failed', err);
                            this.toolkit?.island?.notify?.('error', '保存失败', err?.message || '请重试');
                        }
                    },
                    onClose: () => {
                        // 弹窗关闭后 force 重画聊天设置页,让右侧预览区正确反映当前值
                        if (typeof window.__detailRenderTick !== 'undefined') {
                            window.__detailRenderTick.value++;
                        }
                    },
                });

                return null;
            },

            /**
             * ★ v0.61.8.11 上下文长度设置弹窗入口
             *
             * 触发链路:
             *   <div id="set-context-length" data-app-action="...">
             *   → framework 顶层 click 委托
             *   → externalAppRegistry.invokeMethod('chat', 'openContextLengthModal', payload)
             *   → 本方法
             *
             * @param {Object} payload { contactId: string, mode: string }
             */
            async openContextLengthModal(payload = {}) {
                const contactId = payload?.contactId || '';
                const mode = payload?.mode || 'calendar';
                if (!contactId) {
                    console.warn('[chat-app] openContextLengthModal: contactId empty');
                    this.toolkit?.island?.notify?.('error', '打开失败', '缺少联系人 ID');
                    return null;
                }

                // 从 rollingConfig 读当前 contextRounds 值
                let currentValue = 20;
                let contactName = contactId;
                try {
                    const sdk = window.settingsSdk;
                    const cfg = sdk?.rollingSummaries?.getRollingConfig?.(contactId);
                    if (cfg) {
                        currentValue = Number(cfg.contextRounds) || 20;
                    }
                    const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                    const entry = sdk?.chatFriends?.get?.(defaultUser, contactId, mode);
                    if (entry) {
                        contactName = entry.displayName || entry.remark || contactId;
                    }
                } catch (_) { /* 兜底用默认值 */ }

                // 打开弹窗
                const { chatModalManager } = await import('./components/chat-modal-registry.js');
                chatModalManager.openContextLength({
                    aiPersonId: contactId,
                    contactName,
                    currentValue,
                    mode,
                    onSave: async (value) => {
                        try {
                            const sdk = window.settingsSdk;
                            if (sdk?.rollingSummaries?.setRollingConfig && contactId) {
                                await sdk.rollingSummaries.setRollingConfig(contactId, {
                                    contextRounds: Number(value) || 20,
                                });
                            }
                            this.toolkit?.island?.notify?.(
                                'success',
                                '已保存',
                                `上下文长度: ${value} 回合`
                            );
                        } catch (err) {
                            console.error('[chat-app] openContextLengthModal: save failed', err);
                            this.toolkit?.island?.notify?.('error', '保存失败', err?.message || '请重试');
                        }
                    },
                    onClose: () => {
                        // ★ v0.61.8.12 改:async renderMode 下 + invalidate cache 二段式重画
                        //   (AGENTS.md §27 + §32):
                        //   - 旧 __detailRenderTick.value++ 在 async 缓存命中时不重画,且容易死循环
                        //   - 新走 invalidateRendererCache('chat', null) + bridge.syncNow({ force: true })
                        try {
                            if (typeof window.invalidateRendererCache === 'function') {
                                window.invalidateRendererCache('chat', null);
                            }
                        } catch (_) {}
                        try {
                            window.__appRendererBridge?.syncNow?.({ force: true });
                        } catch (_) {}
                    },
                });

                return null;
            },

            /**
             * ★ v0.63 滚动摘要容量设置弹窗入口
             *
             * 触发链路:
             *   <div id="set-rolling-capacity" data-app-action="...">
             *   → framework 顶层 click 委托
             *   → externalAppRegistry.invokeMethod('chat', 'openRollingCapacityModal', payload)
             *   → 本方法
             *
             * 配置:
             *   - kMergeSize: 每多少个回合合并成一个 K（默认 5）
             *   - maxChainLength: K 链最大长度（默认 10）
             *
             * @param {Object} payload { contactId: string, mode: string }
             */
            async openRollingCapacityModal(payload = {}) {
                const contactId = payload?.contactId || '';
                const mode = payload?.mode || 'calendar';
                if (!contactId) {
                    console.warn('[chat-app] openRollingCapacityModal: contactId empty');
                    this.toolkit?.island?.notify?.('error', '打开失败', '缺少联系人 ID');
                    return null;
                }

                // 从 rollingConfig 读当前的 kMergeSize / maxChainLength
                let currentMergeSize = 5;
                let currentChainLength = 10;
                let contactName = contactId;
                try {
                    const sdk = window.settingsSdk;
                    const cfg = sdk?.rollingSummaries?.getRollingConfig?.(contactId);
                    if (cfg) {
                        currentMergeSize = Number(cfg.kMergeSize) || 5;
                        currentChainLength = Number(cfg.maxChainLength) || 10;
                    }
                    const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                    const entry = sdk?.chatFriends?.get?.(defaultUser, contactId, mode);
                    if (entry) {
                        contactName = entry.displayName || entry.remark || contactId;
                    }
                } catch (_) { /* 兜底用默认值 */ }

                // 打开弹窗
                const { chatModalManager } = await import('./components/chat-modal-registry.js');
                chatModalManager.openRollingCapacity({
                    aiPersonId: contactId,
                    contactName,
                    currentMergeSize,
                    currentChainLength,
                    mode,
                    onSave: async ({ kMergeSize, maxChainLength }) => {
                        try {
                            const sdk = window.settingsSdk;
                            if (sdk?.rollingSummaries?.setRollingConfig && contactId) {
                                await sdk.rollingSummaries.setRollingConfig(contactId, {
                                    kMergeSize: Number(kMergeSize) || 5,
                                    maxChainLength: Number(maxChainLength) || 10,
                                });
                            }
                            this.toolkit?.island?.notify?.(
                                'success',
                                '已保存',
                                `K 链容量: 合并粒度 ${kMergeSize} · 链长 ${maxChainLength}`
                            );
                        } catch (err) {
                            console.error('[chat-app] openRollingCapacityModal: save failed', err);
                            this.toolkit?.island?.notify?.('error', '保存失败', err?.message || '请重试');
                        }
                    },
                    onClose: () => {
                        // ★ 二段式重画(async renderMode 缓存命中 + AGENTS.md §27 §32)
                        try {
                            if (typeof window.invalidateRendererCache === 'function') {
                                window.invalidateRendererCache('chat', null);
                            }
                        } catch (_) {}
                        try {
                            window.__appRendererBridge?.syncNow?.({ force: true });
                        } catch (_) {}
                    },
                });

                return null;
            },

            /**
             * ★ v0.28 聊天设置页的 toggle 开关派发入口。
             *
             * 触发链路:
             *   <label data-app-action="...">  ← renderToggle() 输出
             *   → framework 顶层 click 委托 (handleAppContentClick)
             *   → handlePageAction('appMethod', method=onChatSettingToggle)
             *   → externalAppRegistry.invokeMethod('chat', 'onChatSettingToggle', { settingId })
             *   → 本方法
             *
             * 设计要点:
             *   - payload.settingId 形如 'set-pinned' / 'set-muted' / 'set-context-dilute'
             *     路由到对应处理分支
             *   - 真实 checked 值从 DOM 实时读(input.checked),不要信 payload
             *     (payload 是 v-html 渲染时的快照,click 派发时已经过时)
             *   - 数据写入走 sdk.chatFriends.update / .togglePin(异步)
             *   - 写入成功后:派发 chat:contact-pinned-changed 事件 + 触发 framework
             *     重画消息列表(refreshMessagesTab 风格)
             *
             * @param {Object} payload { settingId: string }
             */
            async onChatSettingToggle(payload = {}) {
                const settingId = payload?.settingId || '';

                // ★ v0.28.1 同步去重: 同一 settingId 在 100ms 内被二次调用 → 直接 no-op
                //   兜底 framework 偶尔的 label+input 双派发残留(主要修复见
                //   chat-settings-page.js renderToggle:data-app-action 放在 input 上)。
                //   用「最近一次 timestamp + settingId」做 key,简单可靠。
                if (!this.__toggleDedupe) this.__toggleDedupe = {};
                const now = Date.now();
                const last = this.__toggleDedupe[settingId] || 0;
                if (now - last < 100) {
                    console.log('[chat-app] onChatSettingToggle: dedupe within 100ms, skip', settingId);
                    return null;
                }
                this.__toggleDedupe[settingId] = now;

                const shell = document.querySelector('.app-shell[data-app-id="chat"]');
                const page = shell?.querySelector('.chat-settings');
                if (!page) {
                    console.warn('[chat-app] onChatSettingToggle: .chat-settings not found');
                    return null;
                }

                // 1. 从 DOM 拿真实 input.checked 状态
                const toggleItem = page.querySelector(`.chat-setting-toggle-item#${CSS.escape(settingId)}`)
                    || page.querySelector(`[data-setting-id="${CSS.escape(settingId)}"]`);
                if (!toggleItem) {
                    console.warn('[chat-app] onChatSettingToggle: setting item not found for', settingId);
                    return null;
                }
                const input = toggleItem.querySelector('.chat-toggle-input');
                if (!input) {
                    console.warn('[chat-app] onChatSettingToggle: toggle input not found for', settingId);
                    return null;
                }
                const newChecked = !!input.checked;

                // 2. 拿到当前 contactId(aiPersonId)+ mode(pageId 形如 chat-settings-ai0-calendar)
                const fullPageId = window.__detailPageStack?.[window.__detailPageStack.length - 1]
                    || (window.__navigationForDebug?.currentDetailPage)
                    || '';
                let aiPersonId = page.dataset.contactId || '';
                let mode = 'calendar';
                // 解析 pageId 格式: 'chat-settings-<aiPersonId>-<mode>' 或 'chat-settings-<aiPersonId>'
                // 注意 aiPersonId 可能含 '-' (例如 'ai-default')
                if (typeof fullPageId === 'string' && fullPageId.startsWith('chat-settings-')) {
                    const tail = fullPageId.slice('chat-settings-'.length);
                    const lastDash = tail.lastIndexOf('-');
                    if (lastDash > 0 && (tail.slice(lastDash + 1) === 'calendar' || tail.slice(lastDash + 1) === 'story')) {
                        aiPersonId = tail.slice(0, lastDash);
                        mode = tail.slice(lastDash + 1);
                    } else {
                        aiPersonId = tail;
                    }
                }

                // 兜底:从隐藏 input 取 aiPersonId / mode(chat-settings-page.js 的备注区有同样的 input)
                if (!aiPersonId || aiPersonId === page.dataset.contactId) {
                    const aiIdInput = page.querySelector('#set-remark-aiid');
                    const modeInput = page.querySelector('#set-remark-mode');
                    if (aiIdInput?.value) aiPersonId = aiIdInput.value;
                    if (modeInput?.value) mode = modeInput.value;
                }

                if (!aiPersonId) {
                    console.warn('[chat-app] onChatSettingToggle: aiPersonId empty');
                    return null;
                }

                // 3. 路由到具体处理
                const sdk = window.settingsSdk;
                if (!sdk?.chatFriends || !sdk?.users) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    // 回滚 DOM 状态
                    input.checked = !newChecked;
                    return null;
                }
                const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                if (!defaultUser) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户卡');
                    input.checked = !newChecked;
                    return null;
                }

                try {
                    let updated = null;
                    switch (settingId) {
                        case 'set-pinned':
                            // 直接调 togglePin — 内部读现有 isPinned 然后翻转
                            updated = await sdk.chatFriends.togglePin(sdk, defaultUser, aiPersonId, mode);
                            if (!updated) {
                                // entry 不存在 → 拒绝(常见:用户在没 add 过好友的 demo 页上点)
                                this.toolkit?.island?.notify?.(
                                    'warning',
                                    '该联系人尚未添加',
                                    '请先在「发起聊天」页添加此 AI 联系人'
                                );
                                input.checked = !newChecked;
                                return null;
                            }
                            this.toolkit?.island?.notify?.(
                                'success',
                                updated.isPinned ? '已置顶' : '已取消置顶',
                                updated.displayName || aiPersonId
                            );
                            break;

                        case 'set-muted':
                            updated = await sdk.chatFriends.update(sdk, defaultUser, aiPersonId, mode, {
                                isMuted: newChecked,
                            });
                            if (!updated) {
                                this.toolkit?.island?.notify?.('warning', '该联系人尚未添加');
                                input.checked = !newChecked;
                                return null;
                            }
                            this.toolkit?.island?.notify?.(
                                'success',
                                updated.isMuted ? '已开启免打扰' : '已关闭免打扰',
                                updated.displayName || aiPersonId
                            );
                            break;

                        // 后续可以加 case 'set-context-dilute' / 'set-reply-enhance'
                        // 目前只接 set-pinned / set-muted(其它 AI 设置项的 toggle
                        // 继续走通知「功能即将开放」,避免静默存到错误位置)
                        // ★ v0.61.3:接 set-context-dilute / set-rolling-enabled
                        //   - contextLength 单位已经从「条」改成「回合」(chat-settings UI)
                        //   - rollingEnabled 落到 aiPerson.socialProfiles.chat.rollingConfig.enabled
                        case 'set-context-dilute':
                            updated = await sdk.chatFriends.update(sdk, defaultUser, aiPersonId, mode, {
                                contextDiluteEnabled: newChecked,
                            });
                            if (!updated) {
                                this.toolkit?.island?.notify?.('warning', '该联系人尚未添加');
                                input.checked = !newChecked;
                                return null;
                            }
                            this.toolkit?.island?.notify?.(
                                'success',
                                newChecked ? '已开启上下文智能稀释' : '已关闭上下文智能稀释',
                                updated.displayName || aiPersonId
                            );
                            break;

                        case 'set-rolling-enabled':
                            // 持久化到 aiPerson.socialProfiles.chat.rollingConfig.enabled
                            // 走 aiPersons.update(SDK 顶层 API,自动 mergePatch)
                            try {
                                const aiPerson = sdk.aiPersons?.get?.(aiPersonId);
                                if (!aiPerson) {
                                    throw new Error('AI 人设不存在');
                                }
                                const socialProfiles = aiPerson.socialProfiles || {};
                                const chat = socialProfiles.chat || {};
                                const rollingConfig = chat.rollingConfig || {
                                    enabled: false,
                                    contextRounds: 20,
                                    kMergeSize: 5,
                                    maxChainLength: 10,
                                    style: 'concise',
                                };
                                rollingConfig.enabled = newChecked;
                                const nextChat = { ...chat, rollingConfig };
                                const nextSocial = { ...socialProfiles, chat: nextChat };
                                const updatedAi = await sdk.aiPersons.update(aiPersonId, {
                                    socialProfiles: nextSocial,
                                });
                                if (!updatedAi) {
                                    throw new Error('保存失败');
                                }
                                this.toolkit?.island?.notify?.(
                                    'success',
                                    newChecked ? '已开启滚动摘要' : '已关闭滚动摘要',
                                    aiPerson.name || aiPersonId
                                );
                            } catch (err) {
                                console.warn('[chat-app] set-rolling-enabled failed:', err);
                                this.toolkit?.island?.notify?.('error', '保存失败', err?.message || '');
                                input.checked = !newChecked;
                                return null;
                            }
                            break;

                        default:
                            // 未知 settingId → 静默不存,避免误写
                            console.warn('[chat-app] onChatSettingToggle: unhandled settingId', settingId);
                            input.checked = !newChecked;
                            return null;
                    }

                    // 4. 派发业务事件,让消息列表 tab 重画(让置顶排序立刻生效)
                    try {
                        window.dispatchEvent(new CustomEvent('chat:contact-setting-changed', {
                            detail: {
                                aiPersonId,
                                mode,
                                settingId,
                                value: newChecked,
                                entry: updated,
                            },
                        }));
                    } catch (_) {}

                    // 5. 触发 framework 重画(走 detailRenderTick 强制 v-html 重画)
                    refreshMessagesTab(this);

                    return updated;
                } catch (err) {
                    console.warn('[chat-app] onChatSettingToggle failed:', err);
                    this.toolkit?.island?.notify?.('error', '保存失败', err?.message || '');
                    // 回滚 DOM
                    input.checked = !newChecked;
                    return null;
                }
            },

            // ============================================================
            // ★ v0.50 回复提示词管理 methods
            //   触发点:prompt-manager-page 的所有按钮都走 framework data-app-action
            //     - toggleReplyPromptActive  启停切换
            //     - moveReplyPromptUp        上移(order -1)
            //     - moveReplyPromptDown      下移(order +1)
            //     - deleteReplyPrompt        删除(确认后)
            //     - openEditReplyPromptModal 编辑弹窗
            //     - openCreateReplyPromptModal 新增弹窗
            //   所有写入走 sdk.replyPrompts API,落盘后 ++detailRenderTick 重画页面
            // ============================================================

            /**
             * 启停切换 replyPrompt。
             * payload: { aiPersonId, promptId }
             *
             * 系统虚拟 prompt(以 'system-' 开头)不能被 toggle,
             * 走 SDK 会返回 null → 给用户提示,不再重画。
             */
            async toggleReplyPromptActive(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                const promptId = String(payload?.promptId || '');
                if (!aiPersonId || !promptId) {
                    console.warn('[chat-app] toggleReplyPromptActive: missing params');
                    return null;
                }
                // 系统虚拟 prompt 不可停用
                if (promptId.startsWith('system-')) {
                    this.toolkit?.island?.notify?.(
                        'info',
                        '系统提示词',
                        '「当前用户人设 / 当前 AI 人设」自动注入,不可关闭'
                    );
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.replyPrompts) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }
                const next = await sdk.replyPrompts.toggleActive(aiPersonId, promptId);
                if (!next) {
                    this.toolkit?.island?.notify?.('warning', '提示词不存在', '可能被删除,请刷新');
                    return null;
                }
                // ★ v0.61.8.11 保留滚动位置(prompt-manager 自管 .pm-page 滚动容器)
                this._preserveScrollAroundTick();
                // ★ v0.61.7 必须 invalidate cache + syncNow({force:true}),
                //   不能只 ++detailRenderTick(否则 resolveAsyncRenderer 命中缓存返回旧 HTML,
                //   「当前上下文」卡片不会因为 active 切换而增删)
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}
                try {
                    window.dispatchEvent(new CustomEvent('chat:reply-prompt-updated', {
                        detail: { aiPersonId, promptId, action: 'toggle', active: next.active },
                    }));
                } catch (_) {}
                return next;
            },

            /**
             * 上移一条 replyPrompt(order 减小,数组里往前挪一位)。
             * payload: { aiPersonId, promptId }
             */
            async moveReplyPromptUp(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                const promptId = String(payload?.promptId || '');
                if (!aiPersonId || !promptId) return null;
                const sdk = window.settingsSdk;
                if (!sdk?.replyPrompts) return null;
                const list = sdk.replyPrompts.list(aiPersonId);
                const idx = list.findIndex((p) => p && p.id === promptId);
                if (idx <= 0) return null; // 第一条 / 不存在
                const newOrder = list.slice();
                [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
                await sdk.replyPrompts.setOrder(aiPersonId, newOrder.map((p) => p.id));
                // ★ v0.61.8.11 保留滚动位置
                this._preserveScrollAroundTick();
                // ★ v0.61.7 invalidate + syncNow 让 prompt-manager 重画
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}
                return true;
            },

            /**
             * 下移一条 replyPrompt。
             * payload: { aiPersonId, promptId }
             */
            async moveReplyPromptDown(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                const promptId = String(payload?.promptId || '');
                if (!aiPersonId || !promptId) return null;
                const sdk = window.settingsSdk;
                if (!sdk?.replyPrompts) return null;
                const list = sdk.replyPrompts.list(aiPersonId);
                const idx = list.findIndex((p) => p && p.id === promptId);
                if (idx < 0 || idx >= list.length - 1) return null; // 最后一条 / 不存在
                const newOrder = list.slice();
                [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                await sdk.replyPrompts.setOrder(aiPersonId, newOrder.map((p) => p.id));
                // ★ v0.61.8.11 保留滚动位置
                this._preserveScrollAroundTick();
                // ★ v0.61.7 invalidate + syncNow
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}
                return true;
            },

            /**
             * 删除一条 replyPrompt(灵动岛先确认)。
             * payload: { aiPersonId, promptId }
             */
            async deleteReplyPrompt(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                const promptId = String(payload?.promptId || '');
                if (!aiPersonId || !promptId) return false;
                const sdk = window.settingsSdk;
                if (!sdk?.replyPrompts) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return false;
                }
                const cur = sdk.replyPrompts.get(aiPersonId, promptId);
                if (!cur) {
                    this.toolkit?.island?.notify?.('warning', '提示词不存在', '可能被删除');
                    return false;
                }
                const confirmTitle = '删除提示词';
                const confirmText = `确认删除「${cur.title}」?该操作不可撤销。`;
                // 走 framework 顶层确认弹窗
                if (typeof window.__phoneConfirm?.request === 'function') {
                    window.__phoneConfirm.request({
                        title: confirmTitle,
                        text: confirmText,
                        confirmLabel: '删除',
                        danger: true,
                        onConfirm: async () => {
                            const ok = await sdk.replyPrompts.remove(aiPersonId, promptId);
                            if (!ok) {
                                this.toolkit?.island?.notify?.('warning', '删除失败', '可能已被删除');
                                return;
                            }
                            // ★ v0.61.8.11 保留滚动位置
                            this._preserveScrollAroundTick();
                            // ★ v0.61.7 invalidate + syncNow 让 prompt-manager 重画
                            try {
                                if (typeof window.invalidateRendererCache === 'function') {
                                    window.invalidateRendererCache('chat', null);
                                }
                            } catch (_) {}
                            try {
                                window.__appRendererBridge?.syncNow?.({ force: true });
                            } catch (_) {}
                            this.toolkit?.island?.notify?.('success', '已删除', cur.title);
                            try {
                                window.dispatchEvent(new CustomEvent('chat:reply-prompt-updated', {
                                    detail: { aiPersonId, promptId, action: 'remove' },
                                }));
                            } catch (_) {}
                        },
                        onCancel: () => {},
                    });
                    return true;
                }
                // 退化方案:无确认弹窗 API,直接删
                const ok = await sdk.replyPrompts.remove(aiPersonId, promptId);
                if (!ok) return false;
                // ★ v0.61.8.11 保留滚动位置
                this._preserveScrollAroundTick();
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}
                return true;
            },

            /**
             * 打开「编辑 replyPrompt」弹窗。
             * payload: { aiPersonId, promptId }
             */
            async openEditReplyPromptModal(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                const promptId = String(payload?.promptId || '');
                if (!aiPersonId || !promptId) return null;
                const sdk = window.settingsSdk;
                if (!sdk?.replyPrompts) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }
                const cur = sdk.replyPrompts.get(aiPersonId, promptId);
                if (!cur) {
                    this.toolkit?.island?.notify?.('warning', '提示词不存在', '可能被删除');
                    return null;
                }
                // 复用 settings 侧的 prompt 编辑 modal(单 title + content + source + active)
                chatModalManager.openEditReplyPrompt({
                    initial: {
                        title: cur.title || '',
                        content: cur.content || '',
                        source: cur.source || 'custom',
                        active: cur.active !== false,
                    },
                    onSave: async (next) => {
                        if (!next?.title) {
                            this.toolkit?.island?.notify?.('warning', '保存失败', '标题不能为空');
                            return;
                        }
                        const updated = await sdk.replyPrompts.update(aiPersonId, promptId, {
                            title: next.title,
                            content: next.content || '',
                            source: next.source || 'custom',
                            active: !!next.active,
                        });
                        if (!updated) {
                            this.toolkit?.island?.notify?.('warning', '保存失败', '该提示词已被删除');
                            return;
                        }
                        // ★ v0.61.8.11 保留滚动位置
                        this._preserveScrollAroundTick();
                        try {
                            if (typeof window.invalidateRendererCache === 'function') {
                                window.invalidateRendererCache('chat', null);
                            }
                        } catch (_) {}
                        try {
                            window.__appRendererBridge?.syncNow?.({ force: true });
                        } catch (_) {}
                        this.toolkit?.island?.notify?.('success', '已保存', updated.title);
                        try {
                            window.dispatchEvent(new CustomEvent('chat:reply-prompt-updated', {
                                detail: { aiPersonId, promptId, action: 'update', record: updated },
                            }));
                        } catch (_) {}
                    },
                });
                return true;
            },

            /**
             * 打开「新增 replyPrompt」弹窗。
             * payload: { aiPersonId }
             */
            async openCreateReplyPromptModal(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                if (!aiPersonId) return null;
                const sdk = window.settingsSdk;
                if (!sdk?.replyPrompts) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }
                chatModalManager.openEditReplyPrompt({
                    initial: {
                        title: '',
                        content: '',
                        source: 'custom',
                        active: true,
                    },
                    isCreate: true,
                    onSave: async (next) => {
                        if (!next?.title) {
                            this.toolkit?.island?.notify?.('warning', '保存失败', '标题不能为空');
                            return;
                        }
                        const created = await sdk.replyPrompts.add(aiPersonId, {
                            title: next.title,
                            content: next.content || '',
                            source: next.source || 'custom',
                            active: next.active !== false,
                        });
                        if (!created) {
                            this.toolkit?.island?.notify?.('warning', '创建失败', '请重试');
                            return;
                        }
                        // ★ v0.61.8.11 保留滚动位置
                        this._preserveScrollAroundTick();
                        try {
                            if (typeof window.invalidateRendererCache === 'function') {
                                window.invalidateRendererCache('chat', null);
                            }
                        } catch (_) {}
                        try {
                            window.__appRendererBridge?.syncNow?.({ force: true });
                        } catch (_) {}
                        this.toolkit?.island?.notify?.('success', '已新增', created.title);
                        try {
                            window.dispatchEvent(new CustomEvent('chat:reply-prompt-updated', {
                                detail: { aiPersonId, promptId: created.id, action: 'create', record: created },
                            }));
                        } catch (_) {}
                    },
                });
                return true;
            },

            /**
             * ★ v0.58 从 prompt 库拉取一条 prompt 到当前 AI 人设的 replyPrompts 列表
             * payload: { aiPersonId, promptId }
             * 流程:
             *   1. sdk.promptLibrary.getPromptWithPath(promptId) 读源数据
             *   2. 检查是否已拉取过(sourceLibraryPromptId 标记)
             *   3. sdk.replyPrompts.add() 写入,带 sourceLibraryPromptId
             *   4. 触发重画 + 灵动岛通知
             */
            async pullReplyPromptFromLibrary(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                const promptId = String(payload?.promptId || '');
                if (!aiPersonId || !promptId) return null;
                const sdk = window.settingsSdk;
                if (!sdk?.promptLibrary || !sdk?.replyPrompts) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }
                let entry = null;
                try {
                    entry = await sdk.promptLibrary.getPromptWithPath(promptId);
                } catch (err) {
                    console.warn('[chat-app] pullReplyPromptFromLibrary getPromptWithPath failed', err);
                }
                if (!entry || !entry.prompt) {
                    this.toolkit?.island?.notify?.('warning', '库条目不存在', '可能被删除');
                    return null;
                }
                const pr = entry.prompt;
                const path = `${entry.library?.name || ''} / ${entry.package?.name || ''} / ${entry.group?.name || ''}`.trim();
                // 去重检查:同 sourceLibraryPromptId 视为已拉取
                try {
                    const existing = sdk.replyPrompts.list(aiPersonId);
                    const dup = existing.find((p) => p && p.sourceLibraryPromptId === promptId);
                    if (dup) {
                        this.toolkit?.island?.notify?.('info', '已拉取过', dup.title || '该条目');
                        return null;
                    }
                } catch (_) { /* 静默,不影响主流程 */ }
                // 写入 replyPrompts
                //   - title 取 prompt.text 第一行前 24 字(避免空标题)
                //   - source = 'prompt-library:{libraryId}'(来源标识)
                //   - sourceLibraryPromptId 用于去重
                //   ★ v0.61.8.8 拉过来的库条目默认 active=false(只在「可用 Prompt」区展示,
                //     不进「当前上下文」;用户想用就手动在「可用 Prompt」区启用)
                const firstLine = (pr.text || '').split('\n')[0] || '';
                const title = firstLine.slice(0, 24) || path || promptId;
                const created = await sdk.replyPrompts.add(aiPersonId, {
                    title,
                    content: pr.text || '',
                    source: entry.library?.id ? `prompt-library:${entry.library.id}` : 'prompt-library',
                    active: false,
                    sourceLibraryPromptId: promptId,
                    sourcePath: path,
                });
                if (!created) {
                    this.toolkit?.island?.notify?.('warning', '拉取失败', '请重试');
                    return null;
                }
                // ★ v0.61.8.11 保留滚动位置
                this._preserveScrollAroundTick();
                // ★ v0.61.8.10 invalidate + syncNow({force:true}) 二段式重画
                //   - 跟 toggleReplyPromptActive / moveReplyPromptUp/Down 等保持一致
                //   - 历史代码用 __detailRenderTick.value++ 在 async renderMode 下会被缓存拦截,
                //     导致「拉取成功但 UI 不出现新卡片」(用户反馈「拉取 prompt区域不会出现新卡片了」)
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}
                this.toolkit?.island?.notify?.('success', '已拉取', created.title);
                try {
                    window.dispatchEvent(new CustomEvent('chat:reply-prompt-updated', {
                        detail: { aiPersonId, promptId: created.id, action: 'pull-from-library', record: created },
                    }));
                } catch (_) {}
                return created;
            },

            /**
             * ★ v0.61.7.1 「当前上下文」section 拖拽重排入口
             *   - 由 prompt-drag-controller 在 drop 时调用
             *   - payload: { aiPersonId, promptIdsInOrder: string[] }
             *   - ★ v0.61.7.1 改为走 sdk.replyPrompts.setOrder
             *     (与 toggle/move/delete/edit/create/save 等方法保持一致,
             *      避免历史上 nookPrompts / replyPrompts 两套数据源错位的 bug:
             *      之前拖拽调 nookSdk.prompts.reorder 写 aiPerson.nookPrompts[],
             *      但 prompt-manager 显示 / prompt-builder.buildPreview 全部读 aiPerson.replyPrompts[],
             *      两边数据不同步,改顺序后 prompt-builder 完全感知不到)
             *   - 落盘成功后用 bridge.syncNow({ force: true }) 整页重画(不用 ++detailRenderTick:
             *     AGENTS.md §27 已经沉淀 detailTick 死循环坑,这里走 syncNow 更安全)
             *   - 系统虚拟 prompt(system-*)与世界观 prompt(nook-world-*)不在 replyPrompts 数组里,
             *     setOrder 内部 map.has(pid) 失败自动跳过,只持久化 replyPrompts 数组里的真实条目
             */
            async reorderContextPrompts(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                const promptIdsInOrder = Array.isArray(payload?.promptIdsInOrder) ? payload.promptIdsInOrder : [];
                if (!aiPersonId || promptIdsInOrder.length === 0) {
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.replyPrompts?.setOrder) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }
                try {
                    await sdk.replyPrompts.setOrder(aiPersonId, promptIdsInOrder);
                } catch (err) {
                    console.warn('[chat-app] reorderContextPrompts replyPrompts failed', err);
                    this.toolkit?.island?.notify?.('warning', '重排失败', err?.message || '请重试');
                    return null;
                }
                // ★ v0.61.7.3 ★ 把「完整 ID 顺序」(含 system-*/context-rounds/world-* 等虚拟 id)
                //   保存到 state + 持久化到 localStorage
                //   - 历史 bug:只写 state.chat.contextOrder[aiPersonId],刷新后内存丢失
                //   - SDK.replyPrompts.setOrder 只能改 replyPrompts 自己的顺序,无法影响 system-* 位置
                //   - prompt-builder 读 contextOrder 来决定注入顺序,所以必须持久化
                if (!this.app.state) this.app.state = {};
                if (!this.app.state.chat) this.app.state.chat = {};
                if (!this.app.state.chat.contextOrder) this.app.state.chat.contextOrder = {};
                this.app.state.chat.contextOrder[aiPersonId] = promptIdsInOrder.slice();
                _saveContextOrder(this.app.state.chat.contextOrder);
                // ★ v0.61.8.11 保留滚动位置
                this._preserveScrollAroundTick();
                // ★ v0.61.7:必须先 invalidate 当前 detail 的 renderer 缓存,
                //   否则 bridge.syncNow({force:true}) 触发 mountInto 后,
                //   resolveAsyncRenderer 命中 cache 仍返回旧 HTML(序号/顺序不变)
                //   - async renderMode + bridge.syncNow({force:true}) 单独使用 = 无效
                //   - 必须配合 invalidateRendererCache 第二参数 = null(清整个 app)
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                // ★ v0.61.7 兜底:close + reopen 当前 detail page,detailKey 变了 → cache 必失效
                try {
                    const nav = window.__navigationForDebug;
                    if (nav && typeof nav.closeDetailPage === 'function' && typeof nav.openDetailPage === 'function') {
                        const stack = nav?.detailPageStack;
                        let curPageId = null;
                        if (stack && typeof stack.value !== 'undefined') {
                            const arr = stack.value;
                            curPageId = arr[arr.length - 1]?.id || null;
                        }
                        if (curPageId && curPageId.startsWith('prompt-manager-')) {
                            // ★ v0.61.8.11 在 close 之前先把 scrollTop 缓存下来,
                            //   reopen 后异步回填(close→reopen 会导致整个 detail 重画,
                            //   _preserveScrollAroundTick 的 microtask/setTimeout 都太早执行,
                            //   抓不到新 .pm-page,需要在 reopen 之后单独再设一次)
                            let savedTop = 0;
                            try {
                                const pmPage = document.querySelector('.app-shell[data-app-id="chat"] .prompt-manager .pm-page');
                                if (pmPage) savedTop = pmPage.scrollTop;
                            } catch (_) {}
                            nav.closeDetailPage();
                            setTimeout(() => {
                                try { nav.openDetailPage('chat', curPageId); } catch (_) {}
                                // ★ v0.61.8.11 等 reopen + v-html 完成后再设 scrollTop
                                //   - 用多次 setTimeout + rAF 兜底(vue mount 时机不可控)
                                const restore = () => {
                                    const newPmPage = document.querySelector('.app-shell[data-app-id="chat"] .prompt-manager .pm-page');
                                    if (newPmPage) {
                                        try { newPmPage.scrollTop = savedTop; } catch (_) {}
                                    }
                                };
                                requestAnimationFrame(restore);
                                setTimeout(restore, 30);
                                setTimeout(restore, 120);
                            }, 30);
                        }
                    }
                } catch (_) {}
                // ★ v0.61.7:走 invalidate + bridge.syncNow({force:true}) 二段式
                //   - async renderMode 单独 ++detailRenderTick 或单独 syncNow 都无效
                //     (resolveAsyncRenderer cache 命中,renderer 不重跑)
                //   - reason:async detail renderer + ++tick 在 hybrid 模式会触发 syncRenderer 死循环
                //     (见 AGENTS.md §27,chat-app/new-group-page 已踩过坑并迁移)
                try {
                    const bridge = window.__appRendererBridge;
                    if (bridge && typeof bridge.syncNow === 'function') {
                        bridge.syncNow({ force: true });
                    } else if (window.__detailRenderTick) {
                        window.__detailRenderTick.value++;
                    }
                } catch (_) { /* ignore */ }
                try {
                    window.dispatchEvent(new CustomEvent('chat:reply-prompt-updated', {
                        detail: { aiPersonId, action: 'reorder', promptIdsInOrder: promptIdsInOrder.slice() },
                    }));
                } catch (_) {}
                return true;
            },

            /**
             * ★ v0.61.7.1 「保存」当前上下文的更改
             *   - 「当前上下文」标题旁的 💾 按钮触发
             *   - ★ v0.61.7.1 改为走 sdk.replyPrompts.setOrder(与所有交互方法保持一致)
             *   - 把当前 DOM 上看到的卡片顺序落盘到 IndexedDB
             *   - 拖拽过程中已即时落盘,但如果用户在编辑器中更改顺序后又手动调整 / 启停一些项,
             *     状态可能未及时同步,这里强制以当前 DOM 顺序为准重新 persist 一次
             *   - 同步更新 app.state.chat.contextOrder 给 prompt-builder 读取
             *   - invalidate + syncNow 让 detail 页重画(序号/preview 100% 反映最新顺序)
             */
            async savePromptManagerChanges(payload = {}) {
                const sdk = window.settingsSdk;
                // 1) 从 DOM 读「当前上下文」section 当前顺序
                const listEl = document.querySelector('.prompt-manager .pm-active-list');
                const rootEl = document.querySelector('.prompt-manager');
                const aiPersonId = payload?.aiPersonId
                    || rootEl?.getAttribute('data-ai-person-id')
                    || '';
                const ids = listEl
                    ? Array.from(listEl.querySelectorAll('.pm-card.pm-item'))
                        .map((el) => el.getAttribute('data-prompt-id') || el.dataset?.promptId)
                        .filter(Boolean)
                    : [];
                if (!aiPersonId) {
                    try { this.toolkit?.island?.notify?.('warning', '无法保存', '未找到当前 AI 人设'); } catch (_) {}
                    return null;
                }
                if (ids.length === 0) {
                    try { this.toolkit?.island?.notify?.('info', '无需保存', '当前上下文为空'); } catch (_) {}
                    return null;
                }
                // 2) 落盘到 IndexedDB(走 sdk.replyPrompts.setOrder,与 toggle/move/edit/create 全部一致)
                if (!sdk?.replyPrompts?.setOrder) {
                    try { this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试'); } catch (_) {}
                    return null;
                }
                try {
                    await sdk.replyPrompts.setOrder(aiPersonId, ids);
                } catch (err) {
                    console.warn('[chat-app] savePromptManagerChanges replyPrompts failed', err);
                    try { this.toolkit?.island?.notify?.('warning', '保存失败', err?.message || '请重试'); } catch (_) {}
                    return null;
                }
                // 3) 把「完整 ID 顺序」同步到 state.contextOrder + 持久化到 localStorage
                //   - ★ v0.61.7.3 持久化是为了刷新后顺序仍在
                if (!this.app.state) this.app.state = {};
                if (!this.app.state.chat) this.app.state.chat = {};
                if (!this.app.state.chat.contextOrder) this.app.state.chat.contextOrder = {};
                this.app.state.chat.contextOrder[aiPersonId] = ids.slice();
                _saveContextOrder(this.app.state.chat.contextOrder);
                // ★ v0.61.8.11 保留滚动位置
                this._preserveScrollAroundTick();
                // 4) ★ v0.61.7.1 必须先 invalidate 当前 detail 的 renderer 缓存,否则 syncNow 命中 cache
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                // 5) 强制重画 detail
                try {
                    const bridge = window.__appRendererBridge;
                    if (bridge && typeof bridge.syncNow === 'function') {
                        bridge.syncNow({ force: true });
                    }
                } catch (_) { /* ignore */ }
                // 6) 灵动岛反馈「已保存」
                try {
                    this.toolkit?.island?.notify?.('success', '已保存', `当前上下文 ${ids.length} 条已落盘`);
                } catch (_) {}
                return { aiPersonId, saved: ids.length, ids };
            },

            /**
             * ★ v0.61.5 启停切换第三方 App Prompt(走 sdk.appPrompts.setState 落盘)
             * payload: { appId, promptId }
             */
            async toggleAppPromptActive(payload = {}) {
                const appId = String(payload?.appId || '');
                const promptId = String(payload?.promptId || '');
                if (!appId || !promptId) return null;
                const sdk = window.settingsSdk;
                if (!sdk?.appPrompts) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }
                const cur = sdk.appPrompts.get(appId, promptId);
                if (!cur) {
                    this.toolkit?.island?.notify?.('warning', 'App Prompt 不存在', '可能已被卸载');
                    return null;
                }
                const next = !cur.active;
                const updated = await sdk.appPrompts.setState(appId, promptId, { active: next });
                if (!updated) {
                    this.toolkit?.island?.notify?.('warning', '切换失败', '请重试');
                    return null;
                }
                // ★ v0.61.8.11 保留滚动位置
                this._preserveScrollAroundTick();
                // ★ v0.61.5 走 bridge.syncNow({force:true}) 而非 ++detailRenderTick
                //   - reason:async detail renderer + ++tick 在 hybrid 模式会触发 syncRenderer 死循环
                try {
                    const bridge = window.__appRendererBridge;
                    if (bridge && typeof bridge.syncNow === 'function') {
                        bridge.syncNow({ force: true });
                    } else if (window.__detailRenderTick) {
                        window.__detailRenderTick.value++;
                    }
                } catch (_) { /* ignore */ }
                this.toolkit?.island?.notify?.(
                    next ? 'success' : 'info',
                    next ? '已启用' : '已停用',
                    `${appId} · ${cur.label || promptId}`,
                );
                return updated;
            },

            /**
             * ★ v0.61.8.3 重做「App Prompt 特殊卡片」预览按钮三态循环(基于用户 8/8 反馈)
             *   - 状态机(从收起状态开始):
             *     · 状态 0 details 收起    → 点小眼睛 → details 展开 + view-mode="content"(只显示正文 1 个 div)
             *     · 状态 1 view-mode=content → 点小眼睛 → view-mode="preview"(显示正文 + 预览 2 个 div)
             *     · 状态 2 view-mode=preview → 点小眼睛 → 收起 details(view-mode 重置为 content)
             *     · 状态 3 view-mode=editor → 点小眼睛 → view-mode="content"(回到正文)
             *   - 关键:小眼睛 button 在 <summary> 内,click 事件冒泡会触发 <details> 原生 toggle,
             *     我们必须主动 set details.open 来覆盖 summary 的 toggle 结果,
             *     否则会出现「点小眼睛 toggle 状态反了 / 视图对不上」的混乱
             *   - 在微任务里同步设置 details.open,确保覆盖任何残留的 toggle 副作用
             * payload: { appId, promptId }
             */
            /**
             * ★ v0.61.8.4 小眼睛按钮:切换「预览面板」(完全独立于 summary 的展开/收起)
             *   - 用户期望(基于 8/8 反馈):
             *     · 点 summary(卡片本身)→ 展开 details 显示正文,收起时无内容
             *     · 点小眼睛          → 显示「预览卡片 + 编辑器」面板,正文面板强制隐藏
             *     · 再点小眼睛         → 收起预览面板(同时收起 details)
             *     · 两个面板互斥:正文与预览/编辑器不会同时显示
             *   - 状态机(仅控制 preview 面板,不动 summary 行为):
             *     · 当前 data-active 不存在或 === 'text':
             *         - 收起 text 面板(如果有),强制收起 details,展开 details,设 data-active='preview'
             *     · 当前 data-active === 'preview':
             *         - 收起 details,移除 data-active(回到完全收起状态)
             *   - 由于 button 在 summary 内,click 冒泡会触发 summary 的 toggle,
             *     必须主动 set details.open 来覆盖(微任务兜底)
             * payload: { appId, promptId }
             */
            async previewAppPrompt(payload = {}) {
                const appId = String(payload?.appId || '');
                const promptId = String(payload?.promptId || '');
                if (!appId || !promptId) return null;
                const compositeId = `${appId}::${promptId}`;
                // 精确定位容器(避开 prompt 库 / 系统 prompt 等其它详情面板)
                const container = document.querySelector(
                    `.pm-app-prompt-views[data-prompt-id="${compositeId}"]`
                );
                if (!container) return null;
                // 找外层 details(容器在 details > body 内)
                const outerDetails = container.closest('details.pm-item') || container.closest('details');
                if (!outerDetails) return null;
                const cur = container.getAttribute('data-active') || '';
                let nextActive = '';
                let nextOpen = false;
                if (cur === 'preview') {
                    // 当前显示预览面板 → 再点收起(回到完全收起状态)
                    nextActive = '';
                    nextOpen = false;
                } else {
                    // 当前未显示预览面板(无 active / active=text / details 收起)→ 切到 preview
                    // 强制展开 details(让 preview 可见)
                    nextActive = 'preview';
                    nextOpen = true;
                }
                // 1) 同步设 data-active(切面板)
                if (nextActive) {
                    container.setAttribute('data-active', nextActive);
                } else {
                    container.removeAttribute('data-active');
                }
                // 2) 同步设 details.open(覆盖 summary 的 toggle 残留)
                if (outerDetails.open !== nextOpen) {
                    outerDetails.open = nextOpen;
                }
                // 3) 微任务兜底(覆盖任何异步残留)
                const targetOpen = nextOpen;
                queueMicrotask(() => {
                    try {
                        if (outerDetails.open !== targetOpen) {
                            outerDetails.open = targetOpen;
                        }
                    } catch (_) { /* noop */ }
                });
                // 4) 进入 preview 时滚到预览区
                if (nextActive === 'preview') {
                    try {
                        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    } catch (_) { /* noop */ }
                }
                return true;
            },

            /**
             * ★ v0.61.8.4 监听 details.open 状态变化(由 summary 原生 toggle 触发)
             *   - 用户点 summary(关闭 details)→ 清掉 data-active="preview",
             *     否则下次点小眼睛会因残留状态走错分支
             *   - 用户点 summary(展开 details)→ 也清掉 data-active="preview"
             *     (互斥:点 summary 应该回正文,不是预览)
             *   - 通过监听 details 的 toggle 事件实现(标准 HTML 事件,不开 addEventListener)
             *   - module-level 委托:document 上统一监听 .pm-item 的 toggle 事件
             *     (delegate,避免给每张卡片绑监听)
             */
            _initAppPromptDetailsObserver() {
                if (typeof document === 'undefined') return;
                if (window.__chatAppPromptObserverInstalled) return;
                window.__chatAppPromptObserverInstalled = true;
                // 用 capture 阶段监听,确保在 framework 派发 action 之前抓到 toggle 事件
                document.addEventListener('toggle', (e) => {
                    const target = e?.target;
                    if (!(target instanceof HTMLElement)) return;
                    // 只关心 App Prompt 卡片的 details(.pm-item 且包含 .pm-app-prompt-views)
                    if (!target.classList || !target.classList.contains('pm-item')) return;
                    const container = target.querySelector(
                        '.pm-app-prompt-views[data-prompt-id]'
                    );
                    if (!container) return;
                    if (!target.open) {
                        // 关闭 details → 清掉 data-active(让面板完全收起)
                        container.removeAttribute('data-active');
                    } else {
                        // 展开 details → 如果 data-active=preview 残留,清掉(强制回正文)
                        // (互斥:点 summary 应该是显示正文,不是预览)
                        if (container.getAttribute('data-active') === 'preview') {
                            container.removeAttribute('data-active');
                        }
                    }
                }, true /* capture: 先于 framework 派发 */);
            },

            /**
             * ★ v0.61.8.5 监听 App Prompt 预览编辑器 textarea 输入 → 实时注入 CSS 到预览卡片
             *   - 走 module-level 委托(避免 inline addEventListener 在 v-html 后失效,跟 favorites 搜索框同款)
             *   - 找到 textarea → 拿到 compositeId(appId::promptId)
             *   - 直接把 textarea 内容塞到 .pm-special-card-preview[data-preview-card] 内的 <style> 标签
             *   - 用户改 CSS → 卡片样式实时变化(所见即所得)
             */
            _initAppPromptPreviewInputObserver() {
                if (typeof document === 'undefined') return;
                if (window.__chatAppPreviewInputInstalled) return;
                window.__chatAppPreviewInputInstalled = true;
                document.addEventListener('input', (e) => {
                    const target = e?.target;
                    if (!(target instanceof HTMLElement)) return;
                    if (!target.matches('textarea[data-app-prompt-textarea]')) return;
                    const compositeId = target.getAttribute('data-app-prompt-textarea') || '';
                    if (!compositeId) return;
                    const css = String(target.value || '');
                    const injector = window.__injectCardCss;
                    if (typeof injector === 'function') {
                        try { injector(compositeId, css); } catch (_) {}
                    }
                });
            },

            /**
             * ★ v0.61.8.6 保存 App Prompt 卡片 CSS 到 localStorage(实时生效已经在 input 监听里做了)
             *   - textarea 内容是 CSS 字符串
             *   - 保存路径:xiaoting::prompt-card-css-{appId}::{promptId}
             *   - 实时注入到 .pm-special-card-preview[data-preview-card] 内的 <style> 标签
             * payload: { appId, promptId }
             */
            async appPromptSave(payload = {}) {
                const appId = String(payload?.appId || '');
                const promptId = String(payload?.promptId || '');
                if (!appId || !promptId) return null;
                const compositeId = `${appId}::${promptId}`;
                const textarea = document.querySelector(
                    `.app-detail-page textarea[data-app-prompt-textarea="${compositeId}"]`
                );
                if (!textarea) {
                    this.toolkit?.island?.notify?.('error', '找不到编辑器', '请刷新页面重试');
                    return null;
                }
                const css = String(textarea.value || '');
                if (!css.trim()) {
                    this.toolkit?.island?.notify?.('warning', 'CSS 为空', '请填写样式');
                    return null;
                }
                try {
                    localStorage.setItem(`xiaoting::prompt-card-css-${compositeId}`, css);
                } catch (_) { /* 隐私模式 / 配额满 */ }
                // ★ v0.61.8.11 保留滚动位置
                this._preserveScrollAroundTick();
                this.toolkit?.island?.notify?.('success', '已保存', `${appId} · ${promptId} CSS 样式`);
                try {
                    const bridge = window.__appRendererBridge;
                    if (bridge?.syncNow) bridge.syncNow({ force: true });
                    else if (window.__detailRenderTick) window.__detailRenderTick.value++;
                } catch (_) { /* ignore */ }
                return true;
            },

            /**
             * ★ v0.61.8.5 复制 textarea 内容到剪贴板(走 framework action 派发)
             *   - 之前 v0.61.8 由 island 自处理剪贴板;现在改成 method 直接读 DOM
             */
            async appPromptCopyJson(payload = {}) {
                const appId = String(payload?.appId || '');
                const promptId = String(payload?.promptId || '');
                if (!appId || !promptId) return false;
                const compositeId = `${appId}::${promptId}`;
                const textarea = document.querySelector(
                    `.app-detail-page textarea[data-app-prompt-textarea="${compositeId}"]`
                );
                const text = String(textarea?.value || '');
                try {
                    if (navigator?.clipboard?.writeText) {
                        await navigator.clipboard.writeText(text);
                    } else {
                        const tmp = document.createElement('textarea');
                        tmp.value = text;
                        tmp.style.position = 'fixed';
                        tmp.style.opacity = '0';
                        document.body.appendChild(tmp);
                        tmp.select();
                        document.execCommand('copy');
                        document.body.removeChild(tmp);
                    }
                    this.toolkit?.island?.notify?.('success', '已复制', 'JSON 已复制到剪贴板');
                    return true;
                } catch (err) {
                    this.toolkit?.island?.notify?.('warning', '复制失败', String(err?.message || err));
                    return false;
                }
            },

            /**
             * ★ v0.61.8.6 复原:把 textarea 重置为 .pm-app-prompt-editor-wrap 的 data-default-card-css
             *   - 默认 CSS 由 prompt-manager-page.js 的 getDefaultCardCss 提供
             *   - 写到 textarea.value + 触发 input 事件(让预览卡片样式重置)
             *   - 同步清掉 localStorage 里的覆盖
             */
            async appPromptRestore(payload = {}) {
                const appId = String(payload?.appId || '');
                const promptId = String(payload?.promptId || '');
                if (!appId || !promptId) return false;
                const compositeId = `${appId}::${promptId}`;
                const wrap = document.querySelector(
                    `.app-detail-page .pm-app-prompt-editor-wrap[data-editor-app-id="${appId}"][data-editor-prompt-id="${promptId}"]`
                );
                const textarea = document.querySelector(
                    `.app-detail-page textarea[data-app-prompt-textarea="${compositeId}"]`
                );
                if (!wrap || !textarea) return false;
                const defaultCss = wrap.getAttribute('data-default-card-css') || '';
                if (!defaultCss) {
                    this.toolkit?.island?.notify?.('warning', '没有默认 CSS', '无法复原');
                    return false;
                }
                textarea.value = defaultCss;
                try { textarea.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
                try {
                    localStorage.removeItem(`xiaoting::prompt-card-css-${compositeId}`);
                } catch (_) {}
                this.toolkit?.island?.notify?.('info', '已复原', 'CSS 已还原为默认值');
                return true;
            },

            /**
             * ★ v0.61.5 打开 App Prompt 编辑弹窗(复用 EditReplyPromptModal)
             *   - 编辑字段:content / active / order / customPreviewData(预览数据)
             *   - 调用方传入的 patch 在 onSave 后通过 sdk.appPrompts.setState 写入
             * payload: { appId, promptId }
             */
            async openEditAppPromptModal(payload = {}) {
                const appId = String(payload?.appId || '');
                const promptId = String(payload?.promptId || '');
                if (!appId || !promptId) return null;
                const sdk = window.settingsSdk;
                if (!sdk?.appPrompts) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }
                const cur = sdk.appPrompts.get(appId, promptId);
                if (!cur) {
                    this.toolkit?.island?.notify?.('warning', 'App Prompt 不存在', '可能被卸载');
                    return null;
                }
                chatModalManager.openEditReplyPrompt({
                    initial: {
                        title: cur.label || '',
                        content: cur.content || '',
                        source: cur.appId || 'custom',
                        active: cur.active !== false,
                    },
                    isCreate: false,
                    onSave: async (next) => {
                        if (!next?.title && !next?.content) {
                            this.toolkit?.island?.notify?.('warning', '保存失败', '标题或正文不能为空');
                            return;
                        }
                        const updated = await sdk.appPrompts.setState(appId, promptId, {
                            content: next.content || '',
                            active: !!next.active,
                        });
                        if (!updated) {
                            this.toolkit?.island?.notify?.('warning', '保存失败', '请重试');
                            return;
                        }
                        // ★ v0.61.8.11 保留滚动位置
                        this._preserveScrollAroundTick();
                        try {
                            const bridge = window.__appRendererBridge;
                            if (bridge && typeof bridge.syncNow === 'function') {
                                bridge.syncNow({ force: true });
                            } else if (window.__detailRenderTick) {
                                window.__detailRenderTick.value++;
                            }
                        } catch (_) { /* ignore */ }
                        this.toolkit?.island?.notify?.('success', '已保存', next.title || promptId);
                    },
                });
                return true;
            },

            /**
             * ★ v0.61.5 删除 App Prompt 的用户状态(走 framework 顶层确认弹窗)
             *   - 走 sdk.appPrompts.removeState(**不**清注册表 → 下次 register 自动恢复用户状态)
             *   - 用户主动"重置"用,正常卸载 app 不需要调这个
             * payload: { appId, promptId }
             */
            async deleteAppPromptState(payload = {}) {
                const appId = String(payload?.appId || '');
                const promptId = String(payload?.promptId || '');
                if (!appId || !promptId) return false;
                const sdk = window.settingsSdk;
                if (!sdk?.appPrompts) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return false;
                }
                const cur = sdk.appPrompts.get(appId, promptId);
                if (!cur) {
                    this.toolkit?.island?.notify?.('warning', 'App Prompt 不存在', '可能已被卸载');
                    return false;
                }
                const confirmTitle = '重置 App Prompt 状态';
                const confirmText = `确认重置「${cur.label || promptId}」的用户状态?(用户编辑过的内容会清掉,注册信息保留)`;
                if (typeof window.__phoneConfirm?.request === 'function') {
                    window.__phoneConfirm.request({
                        title: confirmTitle,
                        text: confirmText,
                        confirmLabel: '重置',
                        danger: true,
                        onConfirm: async () => {
                            const ok = await sdk.appPrompts.removeState(appId, promptId);
                            if (!ok) {
                                this.toolkit?.island?.notify?.('warning', '重置失败', '请重试');
                                return;
                            }
                            // ★ v0.61.8.11 保留滚动位置
                            this._preserveScrollAroundTick();
                            try {
                                const bridge = window.__appRendererBridge;
                                if (bridge && typeof bridge.syncNow === 'function') {
                                    bridge.syncNow({ force: true });
                                } else if (window.__detailRenderTick) {
                                    window.__detailRenderTick.value++;
                                }
                            } catch (_) { /* ignore */ }
                            this.toolkit?.island?.notify?.('success', '已重置', cur.label || promptId);
                        },
                        onCancel: () => {},
                    });
                    return true;
                }
                // 兜底:无顶层确认弹窗 → 静默同步 remove(场景极少见)
                const ok = await sdk.appPrompts.removeState(appId, promptId);
                if (!ok) return false;
                // ★ v0.61.8.11 保留滚动位置
                this._preserveScrollAroundTick();
                try {
                    const bridge = window.__appRendererBridge;
                    if (bridge && typeof bridge.syncNow === 'function') {
                        bridge.syncNow({ force: true });
                    } else if (window.__detailRenderTick) {
                        window.__detailRenderTick.value++;
                    }
                } catch (_) { /* ignore */ }
                return true;
            },

            /** 为聊天设置页面绑定交互 */
            initChatSettingsInteractions() {
                console.log('[chat-app] initChatSettingsInteractions called');
                const page = document.querySelector('.app-shell[data-app-id="chat"] .chat-settings');
                if (!page) {
                    console.warn('[chat-app] initChatSettingsInteractions: .chat-settings not found');
                    return;
                }
                if (page.__chatSettingsInteractionsBound) {
                    console.log('[chat-app] initChatSettingsInteractions: already bound, skipping');
                    return;
                }
                page.__chatSettingsInteractionsBound = true;

                // 备注按钮 - 使用更可靠的选择器
                const remarkItem = page.querySelector('.chat-setting-item[id="set-remark"]');
                if (remarkItem) {
                    remarkItem.style.cursor = 'pointer';
                    remarkItem.addEventListener('click', (event) => {
                        // 从隐藏输入框读取 aiPersonId 和 mode
                        const aiIdInput = page.querySelector('#set-remark-aiid');
                        const modeInput = page.querySelector('#set-remark-mode');
                        const aiPersonId = aiIdInput?.value || page.dataset.contactId || '';
                        const mode = modeInput?.value || 'calendar';

                        console.log('[chat-app] remark clicked, aiPersonId:', aiPersonId, 'mode:', mode);
                        if (aiPersonId) {
                            openAiRemarkModal(aiPersonId, mode);
                        }
                        event.preventDefault();
                        event.stopPropagation();
                    });
                    console.log('[chat-app] initChatSettingsInteractions: remark handler attached');
                }

                console.log('[chat-app] initChatSettingsInteractions bound');
            },

            /**
             * ★ v0.32 日历视图详情页交互
             *  - 监听 chat:message-sent 事件,自动刷新当前展开的当天面板
             *  - 标记 __calendarViewInteractionsBound 防止重复绑定
             */
            initCalendarViewInteractions() {
                const view = document.querySelector('.app-shell[data-app-id="chat"] .chat-calendar-view');
                if (!view) {
                    console.warn('[chat-app] initCalendarViewInteractions: .chat-calendar-view not found');
                    return;
                }
                if (view.__calendarViewInteractionsBound) {
                    return;
                }
                view.__calendarViewInteractionsBound = true;

                const handler = (event) => {
                    const detail = event?.detail || {};
                    if (detail?.aiPersonId && view.dataset.contactId) {
                        // pageId 是 'calendar-view-<aiPersonId>-<mode>' 或
                        // 'calendar-view-<aiPersonId>',只比对 aiPersonId + mode 段
                        const cid = view.dataset.contactId;
                        let viewAi = cid;
                        let viewMode = 'calendar';
                        const lastDash = cid.lastIndexOf('-');
                        if (lastDash > 0) {
                            const tail = cid.slice(lastDash + 1);
                            if (tail === 'calendar' || tail === 'story') {
                                viewMode = tail;
                                viewAi = cid.slice(0, lastDash);
                            }
                        }
                        if (detail.aiPersonId !== viewAi || detail.mode !== viewMode) {
                            return;
                        }
                    }
                    // 触发 framework v-html 重画(让 panel 重新跑 groupMessagesByDate)
                    if (typeof window.__detailRenderTick !== 'undefined') {
                        window.__detailRenderTick.value++;
                    }
                };
                window.addEventListener('chat:message-sent', handler);
                view.__calendarViewSentHandler = handler;

                // ★ v0.65.1 「发给 AI Prompt」textarea → 实时持久化
                const textarea = view.querySelector('.calendar-prompt-textarea');
                if (textarea && !textarea.__boundPersist) {
                    textarea.__boundPersist = true;
                    const persist = () => {
                        try {
                            const key = `xiaoting::calendar-prompt-template-${textarea.dataset.aiPersonId || ''}-${textarea.dataset.mode || 'calendar'}`;
                            localStorage.setItem(key, textarea.value || '');
                        } catch (_) {}
                    };
                    textarea.addEventListener('input', persist);
                    textarea.addEventListener('blur', persist);
                }
            },

            /**
             * ★ v0.32 日历视图:点击某天,展开「当天 AI/用户消息记录」面板
             *   - 走 framework action 派发,目标 method 在 methods 内
             *   - 用 window.__chatCalendarViewSelectedDate 持久化「当前展开的日期」,
             *     renderCalendarViewPage 重新渲染时能记住状态
             */
            viewCalendarDay(payload = {}) {
                const { aiPersonId, mode, date } = payload;
                if (!aiPersonId || !date) return null;
                try {
                    window.__chatCalendarViewSelectedDate = date;
                } catch (_) {}
                if (typeof window.__detailRenderTick !== 'undefined') {
                    window.__detailRenderTick.value++;
                }
                return { ok: true };
            },

            /**
             * ★ v0.32 关闭「当天消息面板」
             */
            closeCalendarDay() {
                try {
                    window.__chatCalendarViewSelectedDate = null;
                } catch (_) {}
                if (typeof window.__detailRenderTick !== 'undefined') {
                    window.__detailRenderTick.value++;
                }
                return { ok: true };
            },

            /**
             * ★ v0.32 月份导航:delta = -1 上一月 / +1 下一月
             *   - 切换时清空「选中的日期」,避免跨月保留状态
             *   - 重画整页用 detailRenderTick++
             */
            shiftCalendarMonth(payload = {}) {
                const delta = Number(payload.delta) || 0;
                if (!delta) return null;
                const view = document.querySelector('.app-shell[data-app-id="chat"] .chat-calendar-view');
                if (!view) return null;
                const y = Number(view.dataset.year);
                const m = Number(view.dataset.month);
                if (!Number.isFinite(y) || !Number.isFinite(m)) return null;

                const next = new Date(y, m + delta, 1);
                try {
                    window.__chatCalendarViewMonth = {
                        year: next.getFullYear(),
                        month: next.getMonth(),
                    };
                    window.__chatCalendarViewSelectedDate = null;
                } catch (_) {}
                if (typeof window.__detailRenderTick !== 'undefined') {
                    window.__detailRenderTick.value++;
                }
                return { ok: true, year: next.getFullYear(), month: next.getMonth() };
            },

            /** 为群聊详情页绑定输入区与工具栏交互 */
            async initGroupChatInteractions() {
                // ★ FIX v0.47.1: 等待 .chat-group 真正出现在 DOM 后再绑定（同 private）
                const waitForElement = (selector, timeout = 2000) => {
                    return new Promise((resolve) => {
                        const start = Date.now();
                        const check = () => {
                            const el = document.querySelector(selector);
                            if (el) {
                                resolve(el);
                            } else if (Date.now() - start > timeout) {
                                resolve(null);
                            } else {
                                requestAnimationFrame(check);
                            }
                        };
                        check();
                    });
                };

                const chatGroup = await waitForElement('.app-shell[data-app-id="chat"] .chat-group', 2000);
                if (!chatGroup) {
                    console.warn('[chat-app] initGroupChatInteractions: .chat-group not found after 2s');
                    return;
                }
                if (chatGroup.__chatGroupInteractionsBound) return;
                chatGroup.__chatGroupInteractionsBound = true;

                // ★ v0.49 表情选择器面板 — 首次绑定时预填缓存 + 触发重画
                //   v0.49.1 修复:之前调 _fillEmojiPickerImages 因 DOM 是 loading HTML
                //   查不到 .chat-emoji-cell 死锁 → 永远 loading
                try {
                    const sdk = window.settingsSdk;
                    const activeUser = sdk?.users?.getActive?.();
                    const ids = activeUser?.boundResources?.stickerGroupIds || [];
                    if (ids.length > 0) {
                        // ★ v0.49.1:传 chatGroup 给 prerender,让重画后的第二次 init 能 fill 缩略图
                        const { _prerenderEmojiPicker } = await import('./components/emoji-picker-panel.js');
                        _prerenderEmojiPicker(ids, chatGroup).catch(err => {
                            console.warn('[chat-app] group prerender emoji picker (init) failed', err);
                        });
                    }
                } catch (err) {
                    console.warn('[chat-app] group init emoji picker failed', err);
                }

                // ★ v0.50 进入群聊页即滚到底(同上,跟私聊保持一致)
                try {
                    const initGroupMessagesContainer = chatGroup.querySelector('.chat-messages');
                    scrollToBottomWithRetry(initGroupMessagesContainer);
                } catch (_) {}

                // ============================================================
                // ★ v0.62 群聊发送消息(文本 / 图片 / 语音 / 位置 / 红包 / 转账 / sticker)
                //   跟私聊 doSend 平行,只是 conversationType='group' + conversationId=groupId
                //   + chatGroups.updateLastMessage 走群聊 entry
                // ============================================================
                const sendBtn = chatGroup.querySelector('#sendBtn');
                const messageInput = chatGroup.querySelector('#messageInput');
                const messagesContainer = chatGroup.querySelector('.chat-messages');
                const groupId = chatGroup.dataset.conversationId || chatGroup.dataset.groupId || '';
                const mode = chatGroup.dataset.mode || 'calendar';

                /**
                 * ★ v0.62 群聊发送文本消息(与私聊 doSend 平行)
                 */
                const doSend = async () => {
                    if (!messageInput) return;
                    const text = (messageInput.innerText || messageInput.textContent || '').trim();
                    if (!text) return;
                    const sdk = window.settingsSdk;
                    if (!sdk?.chatMessages?.add) {
                        window.__phoneIsland?.notify?.('error', '发送失败', 'SDK 未就绪');
                        return;
                    }
                    let senderName = '我';
                    try {
                        const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                        senderName = defaultUser?.socialProfiles?.chat?.nickname || defaultUser?.name || '我';
                    } catch (_) {}

                    // ★ v0.62 群聊 replyTo(私聊同款,跨 (groupId, mode) 校验)
                    //   quoteMessage 写入的 replyingTo 用 aiPersonId 字段,在群聊里就是 groupId
                    let replyTo = null;
                    try {
                        const st = this._ensureChatActionState(this.app);
                        if (st.replyingTo && st.replyingTo.aiPersonId === groupId && st.replyingTo.mode === mode) {
                            replyTo = { ...st.replyingTo };
                            st.replyingTo = null;
                            this._triggerChatActionRerender();
                        }
                    } catch (_) {}

                    const msg = {
                        sender: 'user',
                        senderName,
                        type: 'text',
                        content: text,
                        timestamp: Date.now(),
                        ...(replyTo ? { replyTo } : {}),
                    };

                    try {
                        const sender = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                        if (!sender) {
                            window.__phoneIsland?.notify?.('error', '发送失败', '未找到默认用户');
                            return;
                        }
                        const saved = await sdk.chatMessages.add(sender, groupId, mode, {
                            ...msg,
                            conversationType: 'group',
                            conversationId: groupId,
                        });
                        if (!saved) {
                            window.__phoneIsland?.notify?.('error', '发送失败', '请重试');
                            return;
                        }
                        // 清 renderer 缓存 + syncNow
                        try { window.invalidateRendererCache?.('chat', chatGroup.dataset.groupId); } catch (_) {}
                        try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}

                        // ★ v0.62 群聊 lastMessage(消息列表页预览)
                        try {
                            if (sdk.chatGroups?.updateLastMessage && sender) {
                                await sdk.chatGroups.updateLastMessage(sdk, sender, groupId, mode, {
                                    content: text,
                                    timestamp: saved.timestamp,
                                    senderName,
                                    type: 'text',
                                });
                            }
                        } catch (e) { console.warn('[chat-app] group updateLastMessage failed:', e); }

                        // 清空输入框
                        messageInput.innerHTML = '';
                        messageInput.focus();

                        // 派发事件,通知消息列表页刷新预览
                        try {
                            window.dispatchEvent(new CustomEvent('chat:message-sent', {
                                detail: { groupId, mode, message: saved },
                            }));
                        } catch (_) {}
                    } catch (err) {
                        console.warn('[chat-app] group send text failed:', err);
                        window.__phoneIsland?.notify?.('error', '发送失败', err?.message || '请重试');
                    }
                };

                // ★ v0.62 群聊页发送按钮也改造:长按→调 AI,短按→只发文字
                if (sendBtn) {
                    const PRESS_THRESHOLD_MS = 800;
                    let pressTimer = null;
                    let pressTriggered = false;
                    const startPress = (ev) => {
                        if (!messageInput) return;
                        const text = (messageInput.innerText || messageInput.textContent || '').trim();
                        if (!text) return;
                        pressTriggered = false;
                        sendBtn.classList.add('is-pressing');
                        pressTimer = setTimeout(() => {
                            pressTriggered = true;
                            sendBtn.classList.add('is-pressing--armed');
                            try {
                                window.__phoneIsland?.notify?.('info', '正在发送给 AI…', text.slice(0, 30));
                            } catch (_) {}
                            sendBtn.style.setProperty('--press-progress', '1');
                            if (typeof ev?.preventDefault === 'function') ev.preventDefault();
                            if (typeof ev?.stopPropagation === 'function') ev.stopPropagation();
                        }, PRESS_THRESHOLD_MS);
                    };
                    const endPress = (ev) => {
                        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
                        sendBtn.classList.remove('is-pressing', 'is-pressing--armed');
                        const text = messageInput ? (messageInput.innerText || messageInput.textContent || '').trim() : '';
                        if (!text) return;
                        if (pressTriggered) {
                            ev?.preventDefault?.();
                            ev?.stopPropagation?.();
                            (async () => {
                                await doSend();
                                // 群聊的 aiPersonId 不存在,sendMessageWithAi 不适用于群聊
                                // 这里仅做提示,实际 AI 调用留给 v0.63 群聊版本
                                try {
                                    window.__phoneIsland?.notify?.('info', '群聊 AI 对话', '暂未支持');
                                } catch (_) {}
                            })();
                        } else {
                            ev?.preventDefault?.();
                            ev?.stopPropagation?.();
                            doSend();
                        }
                        pressTriggered = false;
                    };
                    sendBtn.addEventListener('pointerdown', startPress);
                    sendBtn.addEventListener('pointerup', endPress);
                    sendBtn.addEventListener('pointercancel', endPress);
                    sendBtn.addEventListener('pointerleave', (ev) => { if (pressTimer) endPress(ev); });
                    sendBtn.addEventListener('touchstart', (ev) => {
                        if (sendBtn.dataset.pressing === '1') return;
                        sendBtn.dataset.pressing = '1';
                        startPress(ev);
                    }, { passive: true });
                    sendBtn.addEventListener('touchend', (ev) => {
                        if (sendBtn.dataset.pressing !== '1') return;
                        sendBtn.dataset.pressing = '0';
                        endPress(ev);
                    });
                    sendBtn.addEventListener('touchcancel', (ev) => {
                        if (sendBtn.dataset.pressing !== '1') return;
                        sendBtn.dataset.pressing = '0';
                        endPress(ev);
                    });
                }
                if (messageInput) {
                    messageInput.addEventListener('keydown', (ev) => {
                        if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
                            ev.preventDefault();
                            doSend();
                        }
                    });
                }

                /**
                 * ★ v0.62 群聊工具栏处理器(image / voice / location / redpacket / transfer /
                 *   mention / announcement / members / favorite / game)
                 */
                const handleGroupToolBar = async (action) => {
                    const sdk = window.settingsSdk;
                    if (!sdk) {
                        window.__phoneIsland?.notify?.('error', 'SDK 未就绪');
                        return;
                    }
                    const sender = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                    if (!sender) {
                        window.__phoneIsland?.notify?.('error', '未找到默认用户');
                        return;
                    }
                    let userAvatar = '', userAvatarBg = '';
                    let senderName = '我';
                    try {
                        const chatProfile = sender.socialProfiles?.chat || {};
                        userAvatar = chatProfile.avatar || sender.avatar || '';
                        userAvatarBg = chatProfile.avatarBg || sender.avatarBg || '';
                        senderName = chatProfile.nickname || sender.name || '我';
                    } catch (_) {}

                    if (action === 'image') {
                        chatModalManager.openDescImageSend({
                            onConfirm: async (result) => {
                                const now = Date.now();
                                const msgId = `img-${now}`;
                                try {
                                    await sdk.chatMessages.add(sender, groupId, mode, {
                                        id: msgId, sender: 'user', senderName,
                                        conversationType: 'group', conversationId: groupId,
                                        type: 'descriptive_image',
                                        content: result.description,
                                        imageDescription: result.description,
                                        cardColor: result.cardColor,
                                        textColor: result.textColor,
                                        timestamp: now,
                                    });
                                } catch (err) { console.warn('[chat-app] group save image failed', err); }
                                try { window.invalidateRendererCache?.('chat', chatGroup.dataset.groupId); } catch (_) {}
                                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                                try {
                                    if (sdk.chatGroups?.updateLastMessage) {
                                        await sdk.chatGroups.updateLastMessage(sdk, sender, groupId, mode, {
                                            content: '[图片]', timestamp: now, senderName, type: 'descriptive_image',
                                        });
                                    }
                                } catch (e) {}
                                window.__phoneIsland?.notify?.('success', '图片已发送');
                            },
                        });
                    } else if (action === 'voice') {
                        chatModalManager.openVoiceRecord({
                            onConfirm: async (result) => {
                                const now = Date.now();
                                try {
                                    await sdk.chatMessages.add(sender, groupId, mode, {
                                        id: `voice-${now}`, sender: 'user', senderName,
                                        conversationType: 'group', conversationId: groupId,
                                        type: 'voice',
                                        content: '[语音消息]',
                                        voiceContent: result.content,
                                        voiceDuration: result.duration,
                                        duration: result.duration,
                                        timestamp: now,
                                    });
                                } catch (err) { console.warn('[chat-app] group save voice failed', err); }
                                try { window.invalidateRendererCache?.('chat', chatGroup.dataset.groupId); } catch (_) {}
                                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                                try {
                                    if (sdk.chatGroups?.updateLastMessage) {
                                        await sdk.chatGroups.updateLastMessage(sdk, sender, groupId, mode, {
                                            content: '[语音]', timestamp: now, senderName, type: 'voice',
                                        });
                                    }
                                } catch (e) {}
                                window.__phoneIsland?.notify?.('success', '语音已发送', `${result.duration}秒`);
                            },
                        });
                    } else if (action === 'location') {
                        chatModalManager.openLocationPicker({
                            onSelect: async (locationData) => {
                                const now = Date.now();
                                try {
                                    await sdk.chatMessages.add(sender, groupId, mode, {
                                        id: `loc-${now}`, sender: 'user', senderName,
                                        conversationType: 'group', conversationId: groupId,
                                        type: 'location', content: '[位置]',
                                        locationCard: {
                                            name: locationData.name || '',
                                            address: locationData.address || '',
                                            position: { x: locationData.position?.x ?? 0, y: locationData.position?.y ?? 0 },
                                        },
                                        timestamp: now,
                                    });
                                } catch (err) { console.warn('[chat-app] group save location failed', err); }
                                try { window.invalidateRendererCache?.('chat', chatGroup.dataset.groupId); } catch (_) {}
                                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                                try {
                                    if (sdk.chatGroups?.updateLastMessage) {
                                        await sdk.chatGroups.updateLastMessage(sdk, sender, groupId, mode, {
                                            content: '[位置]', timestamp: now, senderName, type: 'location',
                                        });
                                    }
                                } catch (e) {}
                                window.__phoneIsland?.notify?.('success', '位置已发送', locationData.name);
                            },
                            onClose: () => {},
                        });
                    } else if (action === 'redpacket') {
                        chatModalManager.openRedpacketSend({
                            onConfirm: async (result) => {
                                const now = Date.now();
                                try {
                                    await sdk.chatMessages.add(sender, groupId, mode, {
                                        id: `rp-${now}`, sender: 'user', senderName,
                                        conversationType: 'group', conversationId: groupId,
                                        type: 'redpacket', content: '[红包]',
                                        redpacketCard: { style: 'normal', message: result.message || '', opened: false },
                                        timestamp: now,
                                    });
                                } catch (err) { console.warn('[chat-app] group save redpacket failed', err); }
                                try { window.invalidateRendererCache?.('chat', chatGroup.dataset.groupId); } catch (_) {}
                                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                                window.__phoneIsland?.notify?.('success', '红包已发送');
                            },
                        });
                    } else if (action === 'transfer') {
                        chatModalManager.openTransferSend({
                            onConfirm: async (result) => {
                                const now = Date.now();
                                try {
                                    await sdk.chatMessages.add(sender, groupId, mode, {
                                        id: `tr-${now}`, sender: 'user', senderName,
                                        conversationType: 'group', conversationId: groupId,
                                        type: 'transfer', content: '[转账]',
                                        transferCard: { amount: result.amount || 0, note: result.note || '', received: false },
                                        timestamp: now,
                                    });
                                } catch (err) { console.warn('[chat-app] group save transfer failed', err); }
                                try { window.invalidateRendererCache?.('chat', chatGroup.dataset.groupId); } catch (_) {}
                                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                                window.__phoneIsland?.notify?.('success', '转账已发送');
                            },
                        });
                    } else if (action === 'mention') {
                        // ★ v0.62 @成员:从 chatGroup 解析成员列表
                        try {
                            const { getMemberMeta } = await import('./pages/chat-group-page.js');
                            let memberOptions = [];
                            if (sdk.chatGroups?.resolveMembers) {
                                const real = sdk.chatGroups.get?.(sender, groupId, mode);
                                if (real) memberOptions = sdk.chatGroups.resolveMembers(sdk, sender, real);
                            }
                            const options = memberOptions.map((m) => {
                                const id = m.id || m.aiPersonId;
                                const meta = getMemberMeta(id, memberOptions);
                                return { id, label: meta.nickname || id };
                            });
                            if (options.length === 0) {
                                window.__phoneIsland?.notify?.('warning', '没有可@的成员');
                                return;
                            }
                            if (chatModalManager.openMentionPicker) {
                                chatModalManager.openMentionPicker({
                                    members: options,
                                    onSelect: (chosen) => {
                                        if (!messageInput) return;
                                        const cur = (messageInput.innerText || '').trim();
                                        messageInput.innerText = `${cur} @${chosen.label} `;
                                        messageInput.focus();
                                    },
                                });
                            } else {
                                const cur = (messageInput.innerText || '').trim();
                                messageInput.innerText = `${cur} @${options[0].label} `;
                                messageInput.focus();
                                window.__phoneIsland?.notify?.('info', '@成员', `已输入 @${options[0].label}`);
                            }
                        } catch (e) {
                            console.warn('[chat-app] group mention failed', e);
                            window.__phoneIsland?.notify?.('warning', '@成员失败');
                        }
                    } else if (action === 'announcement') {
                        window.__phoneIsland?.notify?.('info', '公告', '群公告功能即将开放');
                    } else if (action === 'members') {
                        try {
                            document.dispatchEvent(new CustomEvent('app:page-action', {
                                detail: { action: 'detail', appId: 'chat', pageId: `group-settings-${groupId}` },
                                bubbles: true,
                            }));
                        } catch (_) {}
                    } else if (action === 'favorite') {
                        document.dispatchEvent(new CustomEvent('app:page-action', {
                            detail: { action: 'detail', appId: 'chat', pageId: `favorites-group_${groupId}` },
                            bubbles: true,
                        }));
                    } else if (action === 'game') {
                        document.dispatchEvent(new CustomEvent('app:page-action', {
                            detail: { action: 'detail', appId: 'chat', pageId: 'game-selector' },
                            bubbles: true,
                        }));
                    } else {
                        window.__phoneIsland?.notify?.('info', '群聊工具', '功能即将开放');
                    }
                };

                const selectedMessages = new Set();
                const setMultiSelectMode = (enabled) => {
                    chatGroup.classList.toggle('multi-select-mode', enabled);
                    chatGroup.querySelectorAll('[data-selected-count]').forEach(el => { el.textContent = selectedMessages.size; });
                    if (!enabled) {
                        selectedMessages.clear();
                        chatGroup.querySelectorAll('.message-wrapper.selected').forEach(wrapper => wrapper.classList.remove('selected'));
                        chatGroup.querySelectorAll('.message-select-button[aria-checked="true"]').forEach(button => button.setAttribute('aria-checked', 'false'));
                    }
                };
                const updateSelection = (button) => {
                    const messageId = button.dataset.messageSelect;
                    const wrapper = button.closest('.message-wrapper');
                    if (!messageId || !wrapper) return;
                    if (selectedMessages.has(messageId)) { selectedMessages.delete(messageId); wrapper.classList.remove('selected'); button.setAttribute('aria-checked', 'false'); }
                    else { selectedMessages.add(messageId); wrapper.classList.add('selected'); button.setAttribute('aria-checked', 'true'); }
                    chatGroup.querySelectorAll('[data-selected-count]').forEach(el => { el.textContent = selectedMessages.size; });
                };
                chatGroup.addEventListener('click', async (event) => {
                    const selectButton = event.target.closest('[data-message-select]');
                    if (selectButton && chatGroup.classList.contains('multi-select-mode')) { updateSelection(selectButton); event.preventDefault(); event.stopPropagation(); return; }
                    const multiAction = event.target.closest('[data-multi-action]');
                    if (multiAction) {
                        const action = multiAction.dataset.multiAction;
                        if (action === 'cancel') {
                            setMultiSelectMode(false);
                        } else if (action === 'forward') {
                            // ★ v0.33 群聊转发
                            const messageIds = Array.from(selectedMessages);
                            const mode = chatGroup.dataset.mode || 'calendar';
                            const convType = chatGroup.dataset.conversationType || 'group';
                            const convId = chatGroup.dataset.conversationId || chatGroup.dataset.groupId || '';
                            const convName = chatGroup.dataset.conversationName || '';
                            const sourceMeta = {
                                mode,
                                conversationType: convType,
                                conversationId: convId,
                                conversationName: convName,
                            };
                            let sourceMessages = [];
                            try {
                                const raw = chatGroup.dataset.rawMessages;
                                if (raw) sourceMessages = JSON.parse(raw);
                            } catch (_) {}
                            try {
                                const { openForwardTargetSelection } = await import('./chat-forward.js');
                                await openForwardTargetSelection({
                                    mode,
                                    messageIds,
                                    sourceMessages,
                                    sourceMeta,
                                });
                            } catch (err) {
                                console.error('[chat-app] group forward failed', err);
                                window.__phoneIsland?.notify?.('error', '转发失败', err?.message || '');
                            }
                            setMultiSelectMode(false);
                        } else {
                            window.__phoneIsland?.notify?.('success', `消息${action === 'favorite' ? '收藏' : '删除'}成功`, `已选择 ${selectedMessages.size} 条消息`);
                            setMultiSelectMode(false);
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                    const multiSelectButton = event.target.closest('[data-action="multiselect"]');
                    if (multiSelectButton) { setMultiSelectMode(!chatGroup.classList.contains('multi-select-mode')); event.preventDefault(); event.stopPropagation(); return; }

                    // ★ v0.49 群聊也支持 #emojiBtn 笑脸切换表情面板
                    const groupEmojiBtn = event.target.closest('#emojiBtn');
                    if (groupEmojiBtn) {
                        const chatApp = externalAppRegistry.getApp('chat');
                        const isOpen = chatGroup.getAttribute('data-emoji-open') === '1';
                        if (isOpen) {
                            chatGroup.removeAttribute('data-emoji-open');
                            if (chatApp.state?.chat) chatApp.state.chat.emojiOpen = false;
                        } else {
                            chatGroup.setAttribute('data-emoji-open', '1');
                            if (chatApp.state?.chat) chatApp.state.chat.emojiOpen = true;
                            try {
                                const sdk = window.settingsSdk;
                                const activeUser = sdk?.users?.getActive?.();
                                const ids = activeUser?.boundResources?.stickerGroupIds || [];
                                const { _prerenderEmojiPicker } = await import('./components/emoji-picker-panel.js');
                                _prerenderEmojiPicker(ids, chatGroup).catch(err => {
                                    console.warn('[chat-app] group prerender emoji picker failed', err);
                                });
                            } catch (err) {
                                console.warn('[chat-app] group prerender emoji picker (toggle) failed', err);
                            }
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // ★ v0.49 群聊表情面板关闭按钮
                    const groupEmojiClose = event.target.closest('.chat-emoji-picker__close');
                    if (groupEmojiClose) {
                        chatGroup.removeAttribute('data-emoji-open');
                        const chatApp = externalAppRegistry.getApp('chat');
                        if (chatApp.state?.chat) chatApp.state.chat.emojiOpen = false;
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // ★ v0.49 群聊表情图片点击 → 发送 sticker 消息
                    const groupStickerCell = event.target.closest('.chat-emoji-cell[data-sticker-code]');
                    if (groupStickerCell) {
                        const code = groupStickerCell.getAttribute('data-sticker-code');
                        const groupId = chatGroup.dataset.conversationId || chatGroup.dataset.groupId || '';
                        const mode = chatGroup.dataset.mode || 'calendar';
                        try {
                            const sdk = window.settingsSdk;
                            const sender = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                            const { _loadSource } = await import('./components/emoji-picker-panel.js');
                            const url = await _loadSource(code);
                            if (!url) {
                                window.__phoneIsland?.notify?.('warning', '表情加载失败', '原图不存在');
                                event.preventDefault();
                                event.stopPropagation();
                                return;
                            }
                            const now = Date.now();
                            const msgId = `sticker-${now}`;
                            const senderName = (sender?.socialProfiles?.chat?.nickname) || sender?.name || '我';
                            let saved = null;
                            if (sdk?.chatMessages?.add && sender) {
                                saved = await sdk.chatMessages.add(sender, groupId, mode, {
                                    id: msgId,
                                    sender: 'user',
                                    senderName,
                                    conversationType: 'group',
                                    conversationId: groupId,
                                    type: 'sticker',
                                    content: '[表情]',
                                    url,
                                    stickerCode: code,
                                    timestamp: now,
                                });
                            }
                            if (saved) {
                                window.invalidateRendererCache?.('chat', chatGroup.dataset.groupId);
                                const messagesContainer = chatGroup.querySelector('.chat-messages');
                                if (messagesContainer) {
                                    const { renderTextBubble } = await import('./components/text-bubble.js');
                                    const tempDiv = document.createElement('div');
                                    tempDiv.className = 'message-wrapper user';
                                    tempDiv.dataset.messageId = msgId;
                                    tempDiv.innerHTML = renderTextBubble(saved, null, { aiPersonId: groupId, mode });
                                    messagesContainer.appendChild(tempDiv);
                                    scrollToBottomWithRetry(messagesContainer);
                                }
                                chatGroup.removeAttribute('data-emoji-open');
                                const chatApp = externalAppRegistry.getApp('chat');
                                if (chatApp.state?.chat) chatApp.state.chat.emojiOpen = false;
                                window.__phoneIsland?.notify?.('success', '已发送表情');
                            } else {
                                window.__phoneIsland?.notify?.('warning', '发送失败', '消息未保存');
                            }
                        } catch (err) {
                            console.error('[chat-app] group send sticker failed', err);
                            window.__phoneIsland?.notify?.('error', '发送失败', err?.message || '');
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    const expandBtn = event.target.closest('.expand-toolbar-btn');
                    if (expandBtn) {
                        const toolbar = chatGroup.querySelector('.input-toolbar');
                        if (!toolbar) return;
                        const expanded = toolbar.classList.toggle('expanded');
                        expandBtn.classList.toggle('active', expanded);
                        expandBtn.setAttribute('aria-expanded', String(expanded));
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // ★ v0.33 群聊单条消息「转发」按钮
                    const groupSingleForwardBtn = event.target.closest('.message-actions [data-action="forward"]');
                    if (groupSingleForwardBtn) {
                        const wrapper = groupSingleForwardBtn.closest('.message-wrapper');
                        const msgId = wrapper?.dataset.messageId;
                        if (msgId) {
                            const mode = chatGroup.dataset.mode || 'calendar';
                            const convType = chatGroup.dataset.conversationType || 'group';
                            const convId = chatGroup.dataset.conversationId || chatGroup.dataset.groupId || '';
                            const convName = chatGroup.dataset.conversationName || '';
                            const sourceMeta = { mode, conversationType: convType, conversationId: convId, conversationName: convName };
                            let sourceMessages = [];
                            try {
                                const raw = chatGroup.dataset.rawMessages;
                                if (raw) sourceMessages = JSON.parse(raw);
                            } catch (_) {}
                            try {
                                const { openForwardTargetSelection } = await import('./chat-forward.js');
                                await openForwardTargetSelection({
                                    mode,
                                    messageIds: [msgId],
                                    sourceMessages,
                                    sourceMeta,
                                });
                            } catch (err) {
                                console.error('[chat-app] group single forward failed', err);
                                window.__phoneIsland?.notify?.('error', '转发失败', err?.message || '');
                            }
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                    }

                    const toolBtn = event.target.closest('.group-toolbar-btn');
                    if (toolBtn) {
                        const expandBtn = chatGroup.querySelector('.expand-toolbar-btn');
                        const toolbar = chatGroup.querySelector('.input-toolbar');
                        toolbar?.classList.remove('expanded');
                        expandBtn?.classList.remove('active');
                        expandBtn?.setAttribute('aria-expanded', 'false');

                        const action = toolBtn.dataset.action;

                        // 收藏按钮 - 跳转到该群聊的收藏
                        if (action === 'favorite') {
                            const groupId = chatGroup.dataset.groupId || 'group-1';
                            document.dispatchEvent(new CustomEvent('app:page-action', {
                                detail: { action: 'detail', appId: 'chat', pageId: `favorites-group_${groupId}` },
                                bubbles: true,
                            }));
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                        if (action === 'game') {
                            document.dispatchEvent(new CustomEvent('app:page-action', {
                                detail: { action: 'detail', appId: 'chat', pageId: 'game-selector' },
                                bubbles: true,
                            }));
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                        if (action && window.__phoneIsland?.notify) {
                            const labels = {
                                image: '图片',
                                voice: '语音',
                                mention: '@成员',
                                announcement: '公告',
                                members: '成员',
                                game: '游戏',
                            };
                            // ★ v0.62 走统一工具栏处理器(私聊同款)
                            handleGroupToolBar(action).catch(err => {
                                console.error('[chat-app] group toolbar (notify fallback) failed', err);
                                window.__phoneIsland.notify('info', labels[action] || '群聊工具', '功能即将开放');
                            });
                        }
                        event.preventDefault();
                        event.stopPropagation();
                    }
                });
                console.log('[chat-app] initGroupChatInteractions bound');
            },

            /**
             * 为回复提示词管理详情页做一次性挂载。
             *
             * ★ v0.50 改造:页面所有按钮(启/停 toggle / 上移 / 下移 / 编辑 / 删除 /
             *   新增)均走 framework `data-app-action` 派发,统一在 methods 里处理,
             *   此方法只做最轻量的存在性检查 + 幂等标记。
             *
             * 历史兼容:v0.49 之前此方法手动绑定点击事件(支持折叠 / 复制 JSON),
             *   v0.50 已移除这些 UI 元素,所有交互统一走 framework。
             */
            initPromptManagerInteractions() {
                const pm = document.querySelector('.app-shell[data-app-id="chat"] .prompt-manager');
                if (!pm) {
                    // 不打印 warn:页面未挂载是正常场景(没打开 prompt-manager 时)
                    return;
                }
                if (pm.__pmInteractionsBound) return;
                pm.__pmInteractionsBound = true;
                // 占位,所有交互由 framework data-app-action 派发
            },

            /** 注入 .chat-tab-indicator div(仅初始化一次) */
            mountNavIndicator() {
                if (this._navIndicatorMounted) return;
                this._navIndicatorMounted = true;
                // 只在 chat app 的 tab-bar 注入指示器
                const tabBar = document.querySelector('.app-nav[data-app-id="chat"] .app-tab-bar');
                if (!tabBar) {
                    console.warn('[chat-app] mountNavIndicator: .app-tab-bar not found. nav HTML:', document.querySelector('.app-nav[data-app-id="chat"]')?.outerHTML?.slice(0, 400));
                    return;
                }
                if (tabBar.querySelector('.chat-tab-indicator')) return;
                tabBar.insertAdjacentHTML('afterbegin', '<div class="chat-tab-indicator"></div>');
                console.log('[chat-app] tab-bar 指示器已注入');
            },

            /** 初始化动态页面交互 */
            initMomentsPageInteractions() {
                const momentsPage = document.querySelector('.app-shell[data-app-id="chat"] .moments-page');
                if (!momentsPage) {
                    console.warn('[chat-app] initMomentsPageInteractions: .moments-page not found');
                    return;
                }
                if (momentsPage.__momentsInteractionsBound) return;
                momentsPage.__momentsInteractionsBound = true;

                // 使用事件委托绑定 AI 图片点击
                momentsPage.addEventListener('click', (event) => {
                    const descImage = event.target.closest('.clickable-desc-image, .ai-image-display, .ai-image-grid-item');
                    if (descImage) {
                        const desc = descImage.dataset.desc || '';
                        const cardColor = descImage.dataset.color || '#FFE4EC';
                        const textColor = descImage.dataset.textColor || '#D4728A';
                        const borderColor = Object.values(DESC_IMAGE_PRESETS || {}).find(p => p.cardColor === cardColor)?.borderColor || '#C0607A';

                        chatModalManager.openDescImage({ description: desc, cardColor, textColor, borderColor });
                        event.stopPropagation();
                    }
                });

                console.log('[chat-app] initMomentsPageInteractions bound');
            },

            /**
             * ★ v0.23 chat-app 启动时,如果 settings SDK 还没就绪就主动 bootstrap。
             * 之前 settings app 必须被打开才能 bootstrap SDK,导致用户先开 chat-app 时
             * 「SDK 未初始化」空状态。现在 chat-app 也接管 bootstrap,谁先打开谁负责。
             *
             * ★ v0.27 修复:SDK ready 后,主动触发一次「new-chat 联系人列表刷新」,
             * 否则第一次进入 new-chat 时 SDK 还没就绪会 fallback 到 demo,即使 SDK 之后
             * 就绪了页面也不会刷新。
             */
            async hydrate() {
                // ★ v0.62.x:chat-settings 详情页渲染依赖 window.__apiSdk 的缓存,
                //   但 __apiSdk 是 settings app 模块的内部状态,只在打开过 settings 时挂载
                //   + 缓存异步加载。chat-app 自己先 await __apiSdkLoadingPromise,
                //   把所有 key/group 的 label 一次性写到 localStorage 兜底。
                try {
                    if (typeof window.whenSettingsSdkReady === 'function') {
                        await window.whenSettingsSdkReady(2000);
                    }
                    // 主动触发 api-sdk 加载(幂等)
                    if (!window.__apiSdk && typeof window.getApiSdk === 'function') {
                        window.getApiSdk();
                    }
                    if (window.__apiSdkLoadingPromise && typeof window.__apiSdkLoadingPromise.then === 'function') {
                        await window.__apiSdkLoadingPromise;
                    } else if (window.__apiSdk?._loadingPromise) {
                        await window.__apiSdk._loadingPromise;
                    }
                } catch (_) { /* api-sdk 不一定可用,不影响 chat-app 其他功能 */ }

                // ★ v0.61.7.2 ★ 修复:app 启动时必须从 localStorage 恢复 systemPromptOverrides 到内存
                //   - 历史 bug:_saveSystemPromptOverrides 写到 localStorage 但 hydrate 不读回
                //   - 用户编辑 system prompt 后刷新,内存 state.chat.systemPromptOverrides 为空,
                //     prompt-manager 渲染时 getOverride() 返回 null,改动看起来「不生效」
                //   - 现在在 hydrate 第一时间同步加载一次,后续内存写入照旧双写到 localStorage
                try {
                    if (!this.app) this.app = {};
                    if (!this.app.state) this.app.state = {};
                    if (!this.app.state.chat) this.app.state.chat = {};
                    if (!this.app.state.chat.systemPromptOverrides) {
                        this.app.state.chat.systemPromptOverrides = _loadSystemPromptOverrides();
                    }
                    if (!this.app.state.chat.contextOrder) {
                        this.app.state.chat.contextOrder = _loadContextOrder();
                    }
                    // ★ v0.63.2 跟 systemPromptOverrides 同样的模式:hydrate 第一步同步加载
                    //   - 历史 bug(用户 8/8 反馈):kChainActive / replyFormatInject 在 toggleKChainActive
                    //     / toggleReplyFormatActive 写到 localStorage 但 hydrate 不读回
                    //     → 刷新页面后 state.chat.kChainActive / replyFormatInject 为空对象,
                    //     prompt-manager 渲染时 kChainVisible/kChainActive 计算错误,
                    //     K 链卡片可能消失
                    //   - 解决方案:跟 systemPromptOverrides 一样的兜底三段式
                    if (!this.app.state.chat.kChainActive) {
                        try {
                            const raw = localStorage.getItem('xiaoting::chat-k-chain-active-v1');
                            if (raw) {
                                const parsed = JSON.parse(raw);
                                if (parsed && typeof parsed === 'object') {
                                    this.app.state.chat.kChainActive = parsed;
                                }
                            }
                        } catch (_) { /* ignore */ }
                    }
                    if (!this.app.state.chat.replyFormatInject) {
                        try {
                            const raw = localStorage.getItem('xiaoting::chat-reply-format-inject-v1');
                            if (raw) {
                                const parsed = JSON.parse(raw);
                                if (parsed && typeof parsed === 'object') {
                                    this.app.state.chat.replyFormatInject = parsed;
                                }
                            }
                        } catch (_) { /* ignore */ }
                    }
                    // ★ v0.66 跟其他 inject map 同款三段式:hydrate 立即从 localStorage 读回
                    if (!this.app.state.chat.memorySummaryInject) {
                        try {
                            const raw = localStorage.getItem('xiaoting::chat-memory-summary-inject-v1');
                            if (raw) {
                                const parsed = JSON.parse(raw);
                                if (parsed && typeof parsed === 'object') {
                                    this.app.state.chat.memorySummaryInject = parsed;
                                }
                            }
                        } catch (_) { /* ignore */ }
                    }
                } catch (_) { /* ignore */ }

                // ★ v0.37 立即挂上 mode→app-shell 的同步监听,并把当前 mode 写到 app-shell 上
                //   (覆盖「用户刷新页面后 mode 已存在但 data 属性未写」的场景)
                try {
                    bindShellModeListener();
                    syncShellDataMode(getChatRecordMode());
                    // ★ v0.37 同步顶栏标题(冷启动如果 mode=story,要立即显示 "Dream")
                    syncHeaderActionsWithMode();
                    // ★ v0.37 监听 framework 的 root page 切换 — 切回 messages 时自动恢复 headerActions / title override
                    bindRootPageChangedListener();
                    // ★ v0.61.8.4 挂 App Prompt 卡片 details 的 toggle 监听(在 hydrate 里调一次,后续 module-level 复用)
                    this._initAppPromptDetailsObserver?.();
                    // ★ v0.61.8.5 挂 App Prompt 预览编辑器 textarea 的 input 监听(实时重渲染预览卡片)
                    this._initAppPromptPreviewInputObserver?.();
                } catch (_) {}

                // ★ v0.28 走顶层预热入口(幂等,可能已被 framework 启动过)
                if (typeof window.whenSettingsSdkReady === 'function') {
                    await window.whenSettingsSdkReady(3000);
                    return;
                }
                if (getSettingsSdk()) return;
                try {
                    await bootstrapSettingsSdk({ toolkit: this.toolkit });
                } catch (err) {
                    console.warn('[chat-app] bootstrapSettingsSdk 失败,继续监听 settings-sdk-ready', err);
                }
            },

            /**
             * v0.27 chat-app 自身在 hydrate 之外再监听 settings-sdk-ready,
             * 用于兜底(settings app 已经 bootstrap 过的话 chat-app 直接 return 不监听)。
             */
            watchSettingsSdkReady() {
                if (window.__chatAppSettingsSdkReadyBound) return;
                window.__chatAppSettingsSdkReadyBound = true;
                window.addEventListener('settings-sdk-ready', () => {
                    // ★ v0.28 SDK ready 后立即把内存数据写到 localStorage 快照
                    //   (避免下次冷启动又是「加载中…」)
                    try {
                        const sdk = getSettingsSdk();
                        if (sdk) saveSnapshot(sdk);
                    } catch (_) {}

                    // ★ v0.44:从 sdk.chatFavorites 预填充 __chatFavoritedIds(用于按钮高亮)
                    try {
                        const sdk = getSettingsSdk();
                        const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                        if (user && sdk?.chatFavorites && window.__chatFavoritedIds) {
                            const all = sdk.chatFavorites.list(user);
                            for (const fav of all) {
                                window.__chatFavoritedIds.add(`${fav.aiPersonId}|${fav.mode}|${fav.messageId}`);
                            }
                        }
                    } catch (_) {}

                    // 如果当前在 new-chat 页面,刷新联系人列表
                    const onNewChatPage = !!document.querySelector('.app-shell[data-app-id="chat"] .new-chat-page');
                    if (onNewChatPage) {
                        try { this.refreshNewChatContacts?.(); } catch (_) {}
                    }
                });

                // 监听备注更新事件,刷新私聊页显示
                window.addEventListener('chat:remark-updated', (e) => {
                    const { contactId, mode } = e.detail || {};
                    if (!contactId) return;
                    // 刷新私聊页的联系人名称
                    const chatPrivate = document.querySelector('.app-shell[data-app-id="chat"] .chat-private');
                    if (chatPrivate) {
                        const nameEl = chatPrivate.querySelector('.chat-header-name');
                        if (nameEl) {
                            // 直接更新显示名
                            const sdk = getSettingsSdk();
                            const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive();
                            const entry = (sdk && defaultUser)
                                ? sdk.chatFriends?.get?.(defaultUser, contactId, mode)
                                : null;
                            nameEl.textContent = entry?.displayName || contactId;
                        }
                    }
                    // 刷新聊天设置页
                    if (typeof window.__detailRenderTick !== 'undefined') {
                        window.__detailRenderTick.value++;
                    }
                });
            },

            /**
             * v0.27:空状态引导,跳到设置 app 的「用户」详情,让用户绑世界观
             */
            gotoSettingsBindWorld() {
                try {
                    document.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: { action: 'openApp', targetAppId: 'settings', pageId: 'user' },
                        bubbles: true,
                    }));
                } catch (_) {}
            },

            /**
             * ★ v0.62.1 API 调用设置 — 弹窗版(不再走详情页)
             *   payload: { contactId, mode }
             *     - contactId 可能是 'private-{aiPersonId}-{mode}' / '{aiPersonId}-{mode}' / '{aiPersonId}'
             *   流程:
             *     1) 解析出 aiPersonId + mode
             *     2) 聚合 AI 人设 + 用户人设的 boundResources.apiRefs[]
             *     3) 弹 chatModalManager.openApiCallModal(列出 refs + 选默认)
             *     4) 用户选完 → saveDefaultApiKey(aiPersonId, refId) 持久化
             *     5) invalidateCache + syncNow({ force: true }) 重画聊天设置页(右侧 preview 更新)
             */
            openApiCallModal(payload = {}) {
                const rawId = String(payload?.contactId || '');
                let aiPersonId = rawId;
                let mode = String(payload?.mode || 'calendar');
                // 解析 pageId: 'private-{aiPersonId}-{mode}'
                if (aiPersonId.startsWith('private-')) {
                    aiPersonId = aiPersonId.slice('private-'.length);
                }
                const lastDash = aiPersonId.lastIndexOf('-');
                if (lastDash > 0) {
                    const tail = aiPersonId.slice(lastDash + 1);
                    if (tail === 'calendar' || tail === 'story') {
                        mode = tail;
                        aiPersonId = aiPersonId.slice(0, lastDash);
                    }
                }
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('error', '打开失败', '缺少 AI 人设 ID');
                    return null;
                }

                const sdk = window.settingsSdk;
                const apiSdk = window.__apiSdk;
                if (!sdk) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }

                // 1) AI 人设本体
                const ai = sdk.aiPersons?.get?.(aiPersonId) || null;
                const aiName = ai?.name || aiPersonId;

                // 2) 用户人设(默认 / active)
                const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.() || null;

                // 3) 聚合两边的 refs(去重)
                // ★ 真实存储形态:{ refType: 'key'|'group', refId: string, name, subTitle, addedAt }
                //   (来自 settings-side personaResourcesAddApi,见 resources-section.js / methods.js)
                const refsMap = new Map();
                function _pushFrom(refs, source) {
                    if (!Array.isArray(refs)) return;
                    for (const r of refs) {
                        if (!r || typeof r !== 'object') continue;
                        const refType = r.refType === 'group' ? 'group' : 'key';
                        const refId = String(r.refId || '');
                        if (!refId) continue;
                        // 去重 key:key refType::refId
                        const dedupKey = refType + '::' + refId;
                        if (refsMap.has(dedupKey)) continue;
                        let label = r.name || refId;
                        let model = '';
                        let baseUrl = '';
                        let subTitle = r.subTitle || '';
                        let enabled = true;
                        let keyCount = 0;
                        // 实时拉 apiSdk 拿最新元数据(snapshot 是历史缓存)
                        if (refType === 'key' && apiSdk?.apiKeySdk?.get) {
                            const k = apiSdk.apiKeySdk.get(refId);
                            if (k) {
                                label = k.label || label;
                                model = k.model || '';
                                baseUrl = k.baseUrl || '';
                                enabled = k.enabled !== false;
                            }
                        } else if (refType === 'group' && apiSdk?.apiGroupSdk?.get) {
                            const g = apiSdk.apiGroupSdk.get(refId);
                            if (g) {
                                label = g.name || label;
                                keyCount = Array.isArray(g.apiKeyIds) ? g.apiKeyIds.length : 0;
                            }
                        }
                        refsMap.set(dedupKey, {
                            refId,
                            type: refType,
                            label,
                            model,
                            baseUrl,
                            subTitle,
                            enabled,
                            source,
                            keyCount,
                        });
                    }
                }
                _pushFrom(ai?.boundResources?.apiRefs, 'ai');
                _pushFrom(defaultUser?.boundResources?.apiRefs, 'user');

                const refs = Array.from(refsMap.values());
                const localKey = 'xiaoting::chat-default-api-key::' + aiPersonId;
                let defaultRefId = '';
                let defaultRefType = '';
                try {
                    const stored = localStorage.getItem(localKey) || '';
                    // 存的是 key 或 group:id(我们内部存 refId + 单独的 refType)
                    if (stored.includes('::')) {
                        const parts = stored.split('::');
                        defaultRefType = parts[0] === 'group' ? 'group' : 'key';
                        defaultRefId = parts[1] || '';
                    } else {
                        defaultRefId = stored;
                    }
                } catch (_) {}
                const defaultDedup = defaultRefType && defaultRefId ? (defaultRefType + '::' + defaultRefId) : defaultRefId;
                const finalDefaultRefId = refs.some((r) => (r.type + '::' + r.refId) === defaultDedup) ? defaultRefId : '';

                // 4) 弹窗
                chatModalManager.openApiCallModal({
                    aiPersonId,
                    contactName: aiName,
                    refs,
                    defaultRefId,
                    defaultRefType,
                    onSelect: (refId, refType) => {
                        // 持久化(用 refType::refId 形态保存,避免 key id 和 group id 撞车)
                        try {
                            const finalType = refType === 'group' ? 'group' : 'key';
                            if (refId) {
                                localStorage.setItem(localKey, finalType + '::' + refId);
                            } else {
                                localStorage.removeItem(localKey);
                            }
                        } catch (_) {}
                        const matched = refs.find((r) => r.refId === refId);
                        // ★ v0.62.x:同步把选中的 label 写到 localStorage,
                        //   给 chat-settings 详情页兜底渲染(__apiSdk 可能未挂载)
                        try {
                            const labelLocalKey = 'xiaoting::api-label::' + (refType === 'group' ? 'group::' : 'key::') + refId;
                            if (matched?.label) {
                                localStorage.setItem(labelLocalKey, matched.label);
                            }
                        } catch (_) {}
                        this.toolkit?.island?.notify?.(
                            refId ? 'success' : 'info',
                            refId ? '已设为默认 API' : '已清除默认 API',
                            matched?.label || ''
                        );
                        // ★ v0.62.1 async renderMode 下走二段式重画(AGENTS.md §27/§32)
                        const __diagApiCall = (window.__APP_RENDERER_BRIDGE_DEBUG__ = window.__APP_RENDERER_BRIDGE_DEBUG__ || {});
                        const __diagBefore = (() => {
                            try { return localStorage.getItem(localKey) || ''; } catch (_) { return ''; }
                        })();
                        console.log('[chat][openApiCallModal] onSelect refId=', refId, 'refType=', refType, 'localStorage写=', __diagBefore, 'hasBridge=', !!window.__appRendererBridge, 'hasInvalidate=', typeof window.invalidateRendererCache);
                        try {
                            if (typeof window.invalidateRendererCache === 'function') {
                                window.invalidateRendererCache('chat', null);
                            }
                        } catch (_) {}
                        try {
                            window.__appRendererBridge?.syncNow?.({ force: true });
                        } catch (_) {}
                        // ★ 兜底:有些环境下 syncNow 没真正触发 mountInto,
                        //   这里直接 ++detailRenderTick 强制 currentDetailView 重算,
                        //   Vue watcher 会重跑 → syncRenderer 自然 mountInto。
                        //   注意:AGENTS.md §27 警告 ++tick 可能引发死循环,
                        //   但 invalidateCache 已经把 cache 清空,currentTick 比 cache tick 大一档,
                        //   watch 重跑会调 renderer 拿到新 HTML(读新 localStorage),
                        //   不会命中旧 cache,不会 ++tick 后再 ++tick。
                        try {
                            if (window.__detailRenderTick && typeof window.__detailRenderTick.value === 'number') {
                                window.__detailRenderTick.value++;
                            }
                        } catch (_) {}
                    },
                    onClose: () => {},
                });
                return null;
            },

            /**
             * ★ v0.62 真实 AI 对话 — 长按发送时调 AI SDK
             *   payload: { aiPersonId, mode, text }
             *   流程:
             *     1) 灵动岛通知「正在发送给 AI」(用户感知"已发送")
             *     2) 后台 await callAiAndSplit()(不阻塞用户操作,期间可切 app)
             *     3) 拿到 aiMessages[] → 写盘 + 追加到 DOM
             *     4) 灵动岛通知「AI 已回复」+ 消息数
             *
             *   注意:
             *     - 此方法只负责"调 AI + 落盘 AI 回复",用户消息已经在 doSend 写盘了
             *     - 此方法不抛异常,所有失败走灵动岛通知
             *     - console.log 完整 prompt / AI 原文在 ai-service.js 内已完成
             */
            async sendMessageWithAi(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                const mode = String(payload?.mode || 'calendar');
                const text = String(payload?.text || '').trim();
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('error', 'AI 对话失败', '缺少 aiPersonId');
                    return null;
                }
                if (!text) {
                    this.toolkit?.island?.notify?.('warning', '消息为空', '请先输入内容');
                    return null;
                }

                // 1) 灵动岛「正在发送给 AI」(不阻塞主线程)
                this.toolkit?.island?.notify?.('info', '正在发送给 AI…', text.slice(0, 30));
                const startTs = Date.now();

                // 2) 后台调 AI(用户可以在这期间切到其他 app / 滑动屏幕)
                let result;
                try {
                    result = await callAiAndSplit({
                        aiPersonId,
                        mode,
                        userText: text,
                        historyLimit: 12,
                    });
                } catch (err) {
                    console.error('[chat-app] sendMessageWithAi failed', err);
                    this.toolkit?.island?.notify?.('error', 'AI 调用异常', err?.message || String(err));
                    return null;
                }

                if (!result || result.ok === false) {
                    const err = result?.error || '未知错误';
                    // ★ v0.62.6 错误提示放宽到 200 字(friendly 文案可能较长)
                    this.toolkit?.island?.notify?.('error', 'AI 回复失败', err.slice(0, 200));
                    return null;
                }

                // 3) 写盘每条 AI 消息 + 立即追加到 DOM(用户切走也没事,回来能看到)
                const sdk = window.settingsSdk;
                const sender = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                if (!sender) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户卡');
                    return null;
                }

                const aiMessages = result.messages || [];
                // ★ v0.64 预先拉一次历史(给 _resolveAiStickerFromHistory 反查用)
                let recentHistory = [];
                try {
                    const userForHistory = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                    if (userForHistory && sdk.chatMessages?.list) {
                        recentHistory = sdk.chatMessages.list(userForHistory, aiPersonId, mode) || [];
                    }
                } catch (_) { recentHistory = []; }

                for (const msg of aiMessages) {
                    try {
                        // ★ v0.67 AI 发红包/转账 → 扣 AI 余额 + 写 assetFlow + 写消息
                        if (msg.type === 'redpacket') {
                            try {
                                const { aiSendRedpacket } = await import('./services/chat-asset-service.js');
                                const res = await aiSendRedpacket({
                                    aiPersonId,
                                    mode,
                                    amount: Number(msg.redpacketCard?.amount) || 0,
                                    message: msg.redpacketCard?.message || '恭喜发财',
                                    senderName: msg.senderName || 'AI',
                                });
                                if (!res?.ok) {
                                    console.warn('[chat-app] aiSendRedpacket failed', res?.error);
                                    // 余额不足等失败:不写消息卡片,继续下一条
                                    continue;
                                }
                                if (res?.msg?.id) msg.id = res.msg.id;
                            } catch (assetErr) {
                                console.warn('[chat-app] aiSendRedpacket error', assetErr);
                                continue;
                            }
                        } else if (msg.type === 'transfer') {
                            try {
                                const { aiSendTransfer } = await import('./services/chat-asset-service.js');
                                const res = await aiSendTransfer({
                                    aiPersonId,
                                    mode,
                                    amount: Number(msg.transferCard?.amount) || 0,
                                    note: msg.transferCard?.note || '转账',
                                    senderName: msg.senderName || 'AI',
                                });
                                if (!res?.ok) {
                                    console.warn('[chat-app] aiSendTransfer failed', res?.error);
                                    continue;
                                }
                                if (res?.msg?.id) msg.id = res.msg.id;
                            } catch (assetErr) {
                                console.warn('[chat-app] aiSendTransfer error', assetErr);
                                continue;
                            }
                        }
                        // ★ v0.67 AI 触发来电(走 call-manager,不写消息)
                        if (msg.type === 'call') {
                            try {
                                const { callManager } = await import('./services/call-manager.js');
                                const aiInst = sdk?.aiPersons?.get?.(aiPersonId);
                                const aiName = aiInst?.name || 'AI';
                                const aiChatProfile = aiInst?.socialProfiles?.chat || {};
                                const aiAvatar = aiChatProfile.avatar || aiInst?.avatar || '';
                                const started = await callManager.startIncomingCall(aiPersonId, msg.callType || 'voice', mode);
                                if (started) {
                                    // 弹来电弹窗
                                    try {
                                        const { chatModalManager } = await import('./components/chat-modal-registry.js');
                                        chatModalManager.openIncomingCall({
                                            callerName: aiName,
                                            callerAvatar: aiAvatar,
                                            callType: msg.callType || 'voice',
                                            onAccept: async () => {
                                                await callManager.acceptIncomingCall();
                                                // 跳转到通话页
                                                try {
                                                    const pageId = msg.callType === 'video'
                                                        ? `call-video-${aiPersonId}`
                                                        : `call-voice-${aiPersonId}`;
                                                    document.dispatchEvent(new CustomEvent('app:page-action', {
                                                        detail: { action: 'detail', appId: 'chat', pageId },
                                                        bubbles: true,
                                                    }));
                                                } catch (_) {}
                                            },
                                            onReject: async () => {
                                                await callManager.rejectIncomingCall();
                                            },
                                        });
                                    } catch (modalErr) {
                                        console.warn('[chat-app] openIncomingCall failed', modalErr);
                                    }
                                }
                            } catch (callErr) {
                                console.warn('[chat-app] startIncomingCall failed', callErr);
                            }
                            continue; // call 不写消息卡片
                        }
                        // ★ v0.64 AI sticker 解析 + 偷表情包:
                        //   - 拿 msg.url(原图 base64)+ stickerCode + 触发「偷」机制
                        //   - 偷成功 → 立即 invalidateRendererCache 让 prompt-manager 重画
                        //   - 偷失败 → 保持占位(aiStickerUnresolved=true),text-bubble 渲染时降级
                        let resolvedMsg = msg;
                        if (msg.type === 'sticker') {
                            try {
                                const { _resolveAiStickerFromHistory } = await import('./services/ai-service.js');
                                resolvedMsg = await _resolveAiStickerFromHistory(msg, aiPersonId, mode, recentHistory);
                            } catch (resolveErr) {
                                console.warn('[chat-app] resolve AI sticker failed:', resolveErr);
                            }
                            // ★ 偷成功:灵动岛通知(用户能看到「AI 偷了你一张表情」)
                            if (resolvedMsg.aiStickerStolen) {
                                try {
                                    this.toolkit?.island?.notify?.(
                                        'success',
                                        'AI 偷了一张表情',
                                        `${resolvedMsg.stickerName}（来自「${resolvedMsg.aiStickerStolenFromName || '用户资源'}」）`,
                                    );
                                } catch (_) {}
                            } else if (resolvedMsg.aiStickerUnresolved) {
                                // 偷不到(用户没发过同名表情):灵动岛提示一下,避免静默失败
                                try {
                                    this.toolkit?.island?.notify?.(
                                        'info',
                                        'AI 想发表情包',
                                        `「${resolvedMsg.stickerName}」不在用户资源里,AI 自己想的`,
                                    );
                                } catch (_) {}
                            }
                        }
                        const saved = await sdk.chatMessages?.add?.(sender, aiPersonId, mode, resolvedMsg);
                        if (!saved) continue;
                        // 立即追加到当前私聊页 DOM(若还在)
                        try {
                            const chatPrivate = document.querySelector(
                                '.app-shell[data-app-id="chat"] .chat-private'
                            );
                            if (chatPrivate) {
                                const messagesContainer = chatPrivate.querySelector('.chat-messages');
                                if (messagesContainer) {
                                    const contactName =
                                        chatPrivate.querySelector('.chat-header-name')?.textContent || 'AI';
                                    const { renderTextBubble } = await import('./components/text-bubble.js');
                                    const html = renderTextBubble(
                                        saved,
                                        { name: contactName, senderName: saved.senderName },
                                        { aiPersonId, mode }
                                    );
                                    const tmp = document.createElement('div');
                                    tmp.innerHTML = html.trim();
                                    const node = tmp.firstElementChild;
                                    if (node) {
                                        messagesContainer.appendChild(node);
                                        // 滚动到底部(如有 scrollToBottomWithRetry 函数)
                                        try {
                                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                                        } catch (_) {}
                                    }
                                }
                            }
                        } catch (domErr) {
                            console.warn('[chat-app] append AI bubble failed', domErr);
                        }
                    } catch (saveErr) {
                        console.warn('[chat-app] save AI message failed', saveErr);
                    }
                }

                // 4) 清掉该 contact 的 renderer 缓存 + 触发整页重画(回到私聊时显示 AI 消息)
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}

                // 5) 灵动岛最终通知(切走也看得到)
                const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);
                this.toolkit?.island?.notify?.(
                    'success',
                    `AI 已回复 (${aiMessages.length} 条 · ${elapsed}s)`,
                    result.raw?.slice(0, 60) || ''
                );

                // 6) 派发事件给消息列表页,刷新预览
                try {
                    window.dispatchEvent(new CustomEvent('chat:ai-message-received', {
                        detail: { aiPersonId, mode, messages: aiMessages },
                    }));
                } catch (_) {}

                return result;
            },
        },
    };
}

export default createChatApp;