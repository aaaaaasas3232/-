// ============================================
// App 渲染桥（framework ↔ app-renderer）
//
// 负责：把 framework Vue app 里 currentPageView / currentDetailView 的字符串
// 喂给 app-renderer（template / hybrid / vue 三模式）。
//
// 关键设计：
//   - framework 老代码（currentPageView / currentDetailView）**完全不动**
//   - 我们只挂两个 Vue watcher，监控这两个 computed 的变化
//   - 当值变化时：
//       · template 模式：什么都不做（v-html 由 framework 原生处理）
//       · hybrid 模式：等 v-html 完毕后扫描 island
//       · vue 模式：清掉 v-html 的内容，用调度器接管
//
// 接入方式：
//   import { bindAppRendererBridge } from './app-renderer-bridge.js';
//   bindAppRendererBridge({ apps, activeApp, currentPageView, currentDetailView });
// ============================================

import { mountInto, unmountFrom } from '../../src/core/app-renderer.js';

// 框架里两个"主区域"的 DOM ref 容器
// 真实 DOM 在 index.html：appScreenPanel / appDetailPanel
// 我们通过 ref 拿到，由 framework 注入

export function bindAppRendererBridge({
    apps,
    activeApp,
    activeAppId,
    activeRootPageId,
    currentPageView,
    currentDetailView,
    currentPageContent,
    currentRootPage,
    currentDetailPage,
    currentDetailContent,
    getScreenPanelEl,
    getDetailPanelEl,
    detailRenderTick,
}) {
    if (typeof Vue === 'undefined') {
        console.error('[app-renderer-bridge] Vue 未加载');
        return;
    }

    // 跟踪"上一个挂载了什么"，便于清场
    const lastMountedKey = { value: null }; // { appId, pageKey, mode, tickVal, detailKey, detailTickVal }
    let pendingTickHandle = null;
    // ★ v0.36 fix:detail async mount 的防重入
    // detail renderer 是 async,await 完后会 ++tick → 触发 watch → syncRenderer 重跑
    // 在 detail mountInto 整个过程(in-flight promise)内,如果 syncRenderer 重入,
    // 同一个 detailKey+tickVal 不应该再 enqueue 一次 mountInto(否则 +tick 后又来一次,无限循环)
    let pendingDetailMountId = 0;
    let inFlightDetailMount = 0; // 0 = 无 in-flight;非 0 = 当前正在执行的 mountId

            async function syncRenderer(opts = {}) {
                const force = !!opts.force;
                if (pendingTickHandle) {
                    clearTimeout(pendingTickHandle);
                    pendingTickHandle = null;
                }

                const app = activeApp?.value;
                // 支持 getScreenPanelEl 传 ref（Vue.ref(null)）或函数（() => el）
                const screenEl = typeof getScreenPanelEl === 'function'
                    ? getScreenPanelEl()
                    : (getScreenPanelEl?.value !== undefined ? getScreenPanelEl.value : null);
                const detailEl = typeof getDetailPanelEl === 'function'
                    ? getDetailPanelEl()
                    : (getDetailPanelEl?.value !== undefined ? getDetailPanelEl.value : null);

                // 防御：Vue ref 可能还没绑定（v-if 条件刚开始满足），直接查 DOM 作为 fallback
                const finalDetailEl = detailEl || document.querySelector('.app-detail-panel');

                if (typeof window !== 'undefined' && window.__APP_RENDERER_BRIDGE_DEBUG__) {
                    console.log('[bridge] syncRenderer', 'app=', app?.id, 'screenEl=', !!screenEl, 'detailEl=', !!detailEl, 'finalDetailEl=', !!finalDetailEl, 'detailPage=', currentDetailPage?.value?.id);
                }

                if (!app) {
                    // 没 app：清空
                    if (screenEl) unmountFrom(screenEl);
                    if (finalDetailEl) unmountFrom(finalDetailEl);
                    lastMountedKey.value = null;
                    return;
                }

                // 防御：framework 的 #app-screen-panel 可能还没 mount（setup() 还没跑完）
                if (!screenEl) {
                    // 等待 Vue 下一次 flush 后重试
                    pendingTickHandle = setTimeout(() => syncRenderer(), 50);
                    return;
                }

                // 防御：detail panel 的 .app-detail-panel 可能还没出现在 DOM 中（v-if 刚满足）
                // 如果需要渲染 detail 但 DOM 还没准备好，延迟重试
                if (currentDetailPage?.value && !finalDetailEl) {
                    console.log('[bridge] syncRenderer: detail needed but no DOM, retrying...', { force });
                    pendingTickHandle = setTimeout(() => syncRenderer({ force }), 50);
                    return;
                }

        const mode = app.renderMode || 'template';

        // 屏区（root page）
        if (screenEl) {
            // 绕过 currentRootPage：直接用 activeRootPageId + app.pages 算
            // 避免 computed 依赖链时序问题导致永远取到旧值
            const activePageId = activeRootPageId?.value || app.defaultRootPageId || 'home';
            const navPages = Array.isArray(app.pages) ? app.pages.filter(p => p && p.type !== 'detail' && p.nav !== false) : [];
            const rootPage = navPages.find(p => p.id === activePageId) || navPages[0] || { id: activePageId };
            const pageKey = `${app.id}::${rootPage.id}`;
            const lastKey = lastMountedKey.value;
            // 强制 remount 的条件：
            // 1. 换了 app / page / renderMode
            // 2. hybrid/vue 模式下 detailRenderTick 变化（数据变了，如 mode 切换）
            const tickVal = detailRenderTick?.value ?? 0;
            const needsRemount = !lastKey
                || lastKey.appId !== app.id
                || lastKey.pageKey !== pageKey
                || lastKey.mode !== mode
                || (mode !== 'template' && lastKey.tickVal !== tickVal);
            if (needsRemount) {
                if (mode === 'template') {
                    // 模板模式：v-html 已经通过 Vue 响应式更新 DOM，bridge 不操作 innerHTML
                    // 只清理可能的 Vue 残留实例
                    unmountFrom(screenEl);
                } else {
                    // hybrid / vue：交给调度器（会 set innerHTML）
                    // ★ v0.87 root tab 也要保滚动位置。
                    //   之前只有 detail 区做了 capture/restore，root tab（朋友圈、消息列表…）
                    //   一旦因为数据变化重画就弹回顶部 —— 用户在朋友圈里点个收藏就被踢回最上面。
                    //   只在「同一个 page 内因 tick 变化重画」时恢复；真的换 tab 就该回到顶部。
                    const samePage = !!lastKey && lastKey.appId === app.id && lastKey.pageKey === pageKey;
                    let saved = null;
                    if (samePage) {
                        try { saved = window.__chatScrollCapture?.() || null; } catch (_) { saved = null; }
                    }
                    pendingTickHandle = setTimeout(() => {
                        mountInto(
                            screenEl,
                            app,
                            currentPageContent?.value,
                            rootPage,
                            'page'
                        );
                        if (saved?.selector) {
                            try {
                                (window.__chatScrollRestoreOnMutation || window.__chatScrollRestore)?.(
                                    saved.selector, saved.scrollTop, saved.anchorPromptId,
                                );
                            } catch (_) { /* 恢复失败最多就是回到顶部 */ }
                        }
                    }, 0);
                }
                lastMountedKey.value = { appId: app.id, pageKey, mode, tickVal };
            }
        }

        // 详情区
        if (finalDetailEl) {
            const detailPage = currentDetailPage?.value;
            if (detailPage) {
                const detailKey = `${app.id}::detail::${detailPage.id}`;
                const lastKey = lastMountedKey.value;
                // ★ v0.36 fix:detail async mount 防无限循环
                //   问题:detail renderer 是 async,await resolve 时 ++tick,
                //   watch 触发 syncRenderer 重跑,如果 lastKey.detailKey 不变
                //   但 detailTickVal 已经更新(因为是 promise resolve 时才写的),
                //   又会触发 mountInto → 再 ++tick → ... 死循环
                //   修复:用 inFlight 锁 + 等 promise 完成才更新 lastKey
                const tickVal = detailRenderTick?.value ?? 0;
                const detailChanged = !lastKey || lastKey.detailKey !== detailKey;
                const tickChanged = lastKey && mode !== 'template' && lastKey.detailTickVal !== tickVal;
                const detailMountInFlight = inFlightDetailMount > 0;
                // 判定:
                //   - detailKey 变了:必须重渲(即使 in-flight,先让原 promise 跑完,然后强制重渲)
                //   - detailKey 没变但 tick 变了:业务代码 ++tick 想强制重画
                //   - 但如果上次 mountInto 还在跑(inFlight),**不要**立刻 enqueue,
                //     等 inFlight 完成后,lastKey 会更新到新 tick,后续 syncRenderer 自然跳过
                //   - force=true(bridge.syncNow({ force:true })):忽略 inFlight,强制重画(业务 SDK ready 后用)
                const needDetailRemount = (force || detailChanged || tickChanged) && (force || !detailMountInFlight);
                if (needDetailRemount) {
                    if (mode === 'template') {
                        // 模板模式:v-html 响应式更新
                        unmountFrom(finalDetailEl);
                        lastMountedKey.value = {
                            ...(lastMountedKey.value || {}),
                            detailKey,
                            detailTickVal: tickVal,
                        };
                } else {
                    const myMountId = ++pendingDetailMountId;
                    inFlightDetailMount = myMountId;
                    // ★ v0.61.8.11 framework scroll 保留(mountInto 之前保存 scrollTop,
                    //   mountInto 完成后异步恢复)
                    //   - 业务必须保证 .prompt-manager / .pm-page 这种自接管滚动容器存在
                    //   - 我们用 module-level 的 __chatScrollCapture / __chatScrollRestoreOnMutation
                    //   - 默认实现:按 selector 列表找第一个非顶部的滚动容器,记录 scrollTop
                    //   - mountInto 完成后异步回调 restore(用 MO 监听子树稳定后,再多次重试 restore)
                    let savedScrollTop = 0;
                    let savedScrollSel = '';
                    let savedAnchorPromptId = null;
                    try {
                        if (window.__chatScrollCapture) {
                            const captured = window.__chatScrollCapture();
                            if (captured) {
                                savedScrollTop = captured.scrollTop;
                                savedScrollSel = captured.selector;
                                savedAnchorPromptId = captured.anchorPromptId || null;
                            }
                        }
                    } catch (_) {}
                    // ★ 关键:写 lastKey 时,**记录当前 tick**,
                    //   然后 mountInto 完成后再更新 lastKey 到最新 tick
                    lastMountedKey.value = {
                        ...(lastMountedKey.value || {}),
                        detailKey,
                        detailTickVal: tickVal,
                    };
                    pendingTickHandle = setTimeout(() => {
                        (async () => {
                            try {
                                await mountInto(
                                    finalDetailEl,
                                    app,
                                    currentDetailContent?.value,
                                    detailPage,
                                    'detail'
                                );
                            } catch (e) {
                                console.warn('[bridge] detail mountInto failed', e);
                            } finally {
                                // ★ v0.61.8.11 mountInto 完成后 restore scrollTop
                                //   优先用 MO 监听方案(追上 Vue.nextTick + mountHybridIslands),
                                //   fallback 到普通 restore
                                if (savedScrollSel) {
                                    try {
                                        if (window.__chatScrollRestoreOnMutation) {
                                            window.__chatScrollRestoreOnMutation(savedScrollSel, savedScrollTop, savedAnchorPromptId);
                                        } else if (window.__chatScrollRestore) {
                                            window.__chatScrollRestore(savedScrollSel, savedScrollTop, savedAnchorPromptId);
                                        }
                                    } catch (_) {}
                                }
                                // ★ 释放锁(只有当前 mount 还没被"取代"的情况下)
                                if (inFlightDetailMount === myMountId) {
                                    inFlightDetailMount = 0;
                                }
                                // ★ mountInto 完成后,把 lastKey 同步到「最新 tick」
                                // 这样后续 syncRenderer 看到 tick 不变就直接跳过
                                const newTick = detailRenderTick?.value ?? tickVal;
                                if (lastMountedKey.value && lastMountedKey.value.detailKey === detailKey) {
                                    lastMountedKey.value = {
                                        ...lastMountedKey.value,
                                        detailTickVal: newTick,
                                    };
                                }
                            }
                        })();
                    }, 0);
                }
                }
            }
        }
    }

    // ★ 关键：监听 currentPageView / currentDetailView 的变化
    // 如有 detailRenderTick，把 tick 也加入依赖（业务代码 ++tick 触发重画）
    // 页面切换（activeRootPageId）和 app 切换（activeAppId）也要触发
    //
    // 注意：vue/hybrid 模式下 currentPageView 永远是空串 ''，Vue 的 watch
    // 比较 '' === '' 会跳过回调。所以必须把 activeRootPageId / activeAppId
    // 也放进 watchSources，确保每次页面切换都触发。
    const watchSources = [];
    if (currentPageView) watchSources.push(() => currentPageView.value);
    if (currentDetailView) watchSources.push(() => currentDetailView.value);
    if (currentDetailPage) watchSources.push(() => currentDetailPage.value);
    if (detailRenderTick) watchSources.push(() => detailRenderTick.value);
    if (activeRootPageId) watchSources.push(() => activeRootPageId.value);
    if (activeAppId) watchSources.push(() => activeAppId.value);

    Vue.watch(watchSources, () => {
        syncRenderer();
    }, { flush: 'post' });

    // 第一次跑（页面打开时）
    syncRenderer();

    // 暴露给 window 方便调试
    if (typeof window !== 'undefined') {
        window.__appRendererBridge = {
            syncNow: syncRenderer,
            unmountApp() {
                // ★ screenEl / detailEl 是 syncRenderer 内部的局部 const，
                // 这里拿不到，必须重新解析一次面板元素（否则 ReferenceError）。
                const screen = (typeof getScreenPanelEl === 'function' ? getScreenPanelEl() : null)
                    || document.querySelector('.app-screen-panel');
                const detail = (typeof getDetailPanelEl === 'function' ? getDetailPanelEl() : null)
                    || document.querySelector('.app-detail-panel');
                if (screen) unmountFrom(screen);
                if (detail) unmountFrom(detail);
            },
        };
    }
    return {
        syncNow: syncRenderer,
    };
}
