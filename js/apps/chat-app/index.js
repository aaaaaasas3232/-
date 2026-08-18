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
import { SNAIL_EMPTY_SVG } from './snail-icon.js';
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

// ★ v0.69 通话岛模板已在 framework 的 src/core/island-templates.js 里注册
//   (window.islandTemplates['call-medium']),chat-app 直接调用即可
import { getChatRecordMode, getModeConfig, toggleChatRecordMode, setChatRecordMode, resetChatRecordMode } from './chat-mode.js';
import { renderPrivateChatPage } from './pages/chat-page.js';
import { renderGroupChatPage } from './pages/chat-group-page.js';
import { renderVoiceMessageBubble } from './pages/chat-page.js';
import { renderTextBubble } from './components/text-bubble.js';
import { renderChatSettingsPage } from './pages/chat-settings-page.js';
import { renderGroupSettingsPage } from './pages/chat-group-settings-page.js';
import { renderGroupManagePage, MAX_GROUP_ADMIN_COUNT } from './pages/chat-group-manage-page.js'; // ★ v0.81 群成员管理页
import { renderNewChatPage, renderNewChatPageAsync, getWorldAiPersons } from './pages/new-chat-page.js';
import { renderNewGroupPage, renderNewGroupPageAsync } from './pages/new-group-page.js';
import { renderCallRecordDetailPage } from './pages/call-record-detail-page.js';
import { renderChatPostPage } from './pages/chat-post-page.js';
import { DEFAULT_AI_AVATAR_BG, DEFAULT_USER_AVATAR_BG, resolveAiAvatar, prefetchAllAvatars } from './aiMeta.js';
import { renderCalendarViewPage, renderCalendarDayPanel, groupMessagesByDate } from './pages/calendar-view-page.js';
import { renderStoryManagementPage } from './pages/story-management-page.js';
import { renderHistoryPage } from './pages/history-page.js'; // ★ v0.61.3 历史消息页(v0.65 已替换为 memory-history-page)
import { renderPromptManagerPage } from './pages/prompt-manager-page.js';
import { renderMemoryManagementPage } from './pages/memory-management-page.js'; // ★ v0.65 层级管理页
import { renderMemoryHistoryPage } from './pages/memory-history-page.js'; // ★ v0.65 历史消息页(上下结构)
// ★ v0.62.1 AI 服务层:拼 prompt → 调 AI SDK → 解析 [发红包:88:...] 等特殊动作
import { callAiAndSplit, recomputeContextPreviewAfterReroll, _resolveAiStickerFromHistory } from './services/ai-service.js';
// 「对方正在输入中」：发消息给 AI 的反馈长在聊天页顶栏，不弹灵动岛
import { beginTyping, endTyping, applyTypingToRoot } from './services/typing-indicator.js';
import { getGroupSendAsId, setGroupSendAsId, resolveGroupWriteIdentity } from './services/group-send-identity.js';
import {
    buildUserPersonaContextText,
    buildAiPersonaContextText,
    defaultReplyNote,
    refreshContextPreview,
} from './pages/prompt-manager-page.js';
// 回复提示词的整组 / 卡片开关。prompt-manager 画状态、ai-service 发送时查,都读这一份。
import { makeOwnerKey, toggleGroupEnabled, toggleCardEnabled } from './services/prompt-toggles.js';
import { applyPromptFolds, installPromptFoldGuards } from './services/prompt-fold-state.js';
import { renderFavoritesPage } from './pages/favorites-page.js';
import { renderGameSelectorPage } from './pages/game-selector-page.js';
import { renderGameLeaderboardPage, setLeaderboardTab } from './pages/game-leaderboard-page.js';
// 群聊小游戏（狼人杀 / 谁是卧底 / 大富翁）
//   引擎是纯状态机 + 模块级调度器，跟界面完全解耦 ——
//   用户切出对局页去别的 App，流程照样往前跑（见 games/core/clock.js）
import * as chatGames from './games/index.js';
import {
    renderGameSetupPage, getSetupDraft, clearSetupDraft,
    updateSetupDraft, toggleSetupAi, toggleSetupRule,
} from './pages/game-setup-page.js';
import {
    renderGameMakerPage, updateMakerDraft, setMakerStep,
    resetMakerDraft, buildDraftPrompt, getMakerDraft,
} from './pages/game-maker-page.js';
import { renderGameRecordDetail } from './components/game-cards.js';
import { renderCallPage } from './pages/call-page.js';
import { chatModalManager, DESC_IMAGE_PRESETS } from './components/chat-modal-registry.js';
import './components/moment-share-modal.js'; // 朋友圈分享弹窗
import { _getCurrentSummaryEditInstance } from './components/summary-edit-modal.js';
import { externalAppRegistry } from '@/src/core/app-registry.js';
// 「聊天回合」的唯一口径：1 回合 = 用户说一次 + AI 回一次
import { takeRecentRounds, buildContextRoundsHeading } from './services/context-rounds.js';
import { installKChainBridge, countPending as countKChainPending } from './services/k-chain-service.js';
// 朋友圈数据层：用户动态(localStorage) + AI 动态(aiPerson.moments) 的统一读写
import { toggleFavoriteMoment, updateMomentContent, deleteMoment } from './services/moments-service.js';
// 拖拽控制器(副作用:模块顶层挂 MutationObserver)
import './components/prompt-drag-controller.js';
// 上下文模式(通话/游戏场景切换时自动改变 prompt-manager 中的「当前模式」卡)
import './services/context-mode.js';
// ★ v0.61.8 chat-app 自有 island:第三方 App Prompt 预览编辑器
import { registerIslandComponent } from '@/src/core/app-renderer.js';
import { AppPromptPreviewIsland } from './components/app-prompt-preview-island.js';
import { renderAppPromptCardPreview } from './components/app-prompt-card.js';

// ★ v0.61.8.5 暴露 App Prompt 卡片预览渲染函数,供 module-level input 监听器实时重渲染预览卡片
if (typeof window !== 'undefined' && typeof renderAppPromptCardPreview === 'function') {
    window.__renderAppPromptCardPreview = renderAppPromptCardPreview;
}

// ★ v0.87 无头刷新「当前上下文」pre 的全局入口。
//   最终 pre 一直是 renderPromptManagerPage 的副作用,不点进那一页就永远是旧快照
//   —— 用户原话「每次来聊天要点进回复提示词才能正确拉取当前聊天回合上下文」。
//   这里把它暴露成全局,让「打开私聊」和「发送前」两个时机都能补一次。
//   放全局而不是 import:ai-service 是 services/,prompt-manager 是 pages/,
//   直接 import 会形成 pages ↔ services 的循环依赖。
if (typeof window !== 'undefined') {
    window.__chatRefreshContextPreview = async ({ aiPersonId, mode = 'calendar', isGroup = false, groupId = null } = {}) => {
        try {
            const app = externalAppRegistry.getApp('chat');
            if (!app) return false;
            const contactId = isGroup && groupId
                ? `group_${groupId}-${mode}`
                : `private-${aiPersonId}-${mode}`;
            return await refreshContextPreview(app, contactId);
        } catch (err) {
            console.warn('[chat-app] refreshContextPreview 失败', err);
            return false;
        }
    };
}

// ★ v0.88 K 链记忆:挂 window.__chatKChain,供 ai-service 在**发送时现算**注入。
//   走全局而不是 import,理由和 __chatRefreshContextPreview 一样 ——
//   ai-service 在 services/,这段逻辑要读 chatMessages 又要拼 prompt,
//   直接 import 容易绕出循环依赖。模块顶层就装,不等 App 被打开。
installKChainBridge();

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

    // ★ v0.87 这里原本有一段「音乐分享」demo 注册。
    //   它只是占位:内容进不了最终 pre,音乐 App 也从不覆盖它,
    //   于是用户在折叠区看到「分享音乐卡片 · 已启用」却对 AI 毫无影响。
    //   现在改由音乐 App 自己 `toolkit.prompts.register(...)` 注册真货
    //   (见 js/apps/music-app/services/app-prompts.js),demo 删除。
    //   新 App 怎么接:docs/跨App注册Prompt指导方案.md
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
// ★ v0.69 MutationObserver 自动绑定群聊交互
//   历史踩坑(v0.48):queueMicrotask 比 mountInto(setTimeout 0)早执行,
//   waitForElement 拿到旧节点绑 listener,然后 rootEl.innerHTML = html 把 DOM 全部替换,
//   listener 跟旧节点一起死。群聊沿用旧方案导致工具栏/多选按钮全失效。
//   修法:跟私聊一致 — 用 MutationObserver 监听 document,
//   只要 .chat-group / .chat-post / .moments-page 出现就立刻绑定(此时 innerHTML 已完成)。
// ============================================================
if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined' && !window.__chatGroupObserverInstalled) {
    window.__chatGroupObserverInstalled = true;
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            // 监听所有添加的节点，包括后代
            const checkAndBind = (node) => {
                if (node.nodeType !== 1) return;
                
                // 检查是否是目标元素本身
                if (node.classList && node.classList.contains('chat-group')) {
                    console.log('[chat-app] MutationObserver: found .chat-group');
                    if (!node.__chatGroupInteractionsBound) {
                        const chatApp = externalAppRegistry.getApp('chat');
                        chatApp?.methods?.initGroupChatInteractions?.(node);
                    }
                }
                if (node.classList && node.classList.contains('chat-post')) {
                    console.log('[chat-app] MutationObserver: found .chat-post');
                    if (!node.__chatPostInteractionsBound) {
                        const chatApp = externalAppRegistry.getApp('chat');
                        chatApp?.methods?.initChatPostInteractions?.();
                    }
                }
                if (node.classList && node.classList.contains('moments-page')) {
                    console.log('[chat-app] MutationObserver: found .moments-page');
                    if (!node.__momentsInteractionsBound) {
                        const chatApp = externalAppRegistry.getApp('chat');
                        chatApp?.methods?.initMomentsPageInteractions?.();
                    }
                }
                
                // 检查后代元素
                if (node.querySelectorAll) {
                    const chatGroups = node.querySelectorAll('.chat-group');
                    chatGroups.forEach(sub => {
                        if (!sub.__chatGroupInteractionsBound) {
                            console.log('[chat-app] MutationObserver: found .chat-group in descendants');
                            const chatApp = externalAppRegistry.getApp('chat');
                            chatApp?.methods?.initGroupChatInteractions?.(sub);
                        }
                    });
                    const chatPosts = node.querySelectorAll('.chat-post');
                    chatPosts.forEach(sub => {
                        if (!sub.__chatPostInteractionsBound) {
                            console.log('[chat-app] MutationObserver: found .chat-post in descendants');
                            const chatApp = externalAppRegistry.getApp('chat');
                            chatApp?.methods?.initChatPostInteractions?.();
                        }
                    });
                    const momentsPages = node.querySelectorAll('.moments-page');
                    momentsPages.forEach(sub => {
                        if (!sub.__momentsInteractionsBound) {
                            console.log('[chat-app] MutationObserver: found .moments-page in descendants');
                            const chatApp = externalAppRegistry.getApp('chat');
                            chatApp?.methods?.initMomentsPageInteractions?.();
                        }
                    });
                }
            };
            
            // 检查 mutation.addedNodes
            for (const node of mutation.addedNodes) {
                checkAndBind(node);
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('[chat-app] MutationObserver installed');
}

// ============================================================
// ★ FIX v0.69 恢复:MutationObserver 自动绑定私聊交互
//   之前 v0.69 改 chat-app 时**误把私聊的 MutationObserver 删掉了**,
//   只剩群聊的 observer,导致:
//   - 进私聊详情页 → .expand-toolbar-btn / #emojiBtn / 多选按钮 全部没绑 click handler
//   - 工具栏按钮点击没反应 / 表情面板切不出来 / 多选模式点不动
//   修复:加回跟群聊完全同款的 observer,watch .chat-private 出现 → 调 initPrivateChatInteractions
// ============================================================
if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined' && !window.__chatPrivateObserverInstalled) {
    window.__chatPrivateObserverInstalled = true;
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.classList && node.classList.contains('chat-private')) {
                    if (!node.__chatPrivateInteractionsBound) {
                        const chatApp = externalAppRegistry.getApp('chat');
                        chatApp?.methods?.initPrivateChatInteractions?.(node);
                    }
                }
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
}

// ============================================================
// 收藏列表:挂「左滑露出分享 / 编辑 / 删除」
// ------------------------------------------------------------
// 手势逻辑在框架层 src/core/components/swipe-actions.js，这里只负责
// 「新的列表节点一出现就 attach 一次」。
// 用 MutationObserver 而不是 queueMicrotask/setTimeout：只有它能保证
// innerHTML 已经写完（§X.7 的结论）；用后者会绑到上一次的旧节点上，
// 表现为「切出去再回来就滑不动了」。
// attachSwipeActions 内部有 WeakSet 去重，重复调用是安全的。
// ============================================================
if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined' && !window.__chatFavSwipeObserverInstalled) {
    window.__chatFavSwipeObserverInstalled = true;
    const bindFavList = (el) => {
        if (!el) return;
        import('@/src/core/components/swipe-actions.js')
            .then(({ attachSwipeActions }) => attachSwipeActions(el))
            .catch((err) => console.warn('[chat-app] attach favorites swipe failed', err));
    };
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.classList?.contains('chat-favorites-list')) bindFavList(node);
                node.querySelectorAll?.('.chat-favorites-list').forEach(bindFavList);
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// ============================================================
// ★ v0.88 朋友圈卡片:挂「左滑露出编辑 / 删除」
// ------------------------------------------------------------
// 朋友圈卡片现在使用 swipe-row 结构，需要对每个 .moments-swipe-row 绑定滑动操作。
// 跟收藏列表类似的逻辑：MutationObserver 监听新的列表节点出现时绑定。
// ============================================================
if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined' && !window.__chatMomentsSwipeObserverInstalled) {
    window.__chatMomentsSwipeObserverInstalled = true;
    const bindMomentsSwipeRow = (el) => {
        if (!el) return;
        import('@/src/core/components/swipe-actions.js')
            .then(({ attachSwipeActions }) => attachSwipeActions(el))
            .catch((err) => console.warn('[chat-app] attach moments swipe failed', err));
    };
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                // 直接是 .moments-swipe-row
                if (node.classList?.contains('moments-swipe-row')) {
                    bindMomentsSwipeRow(node);
                }
                // 后代里的 .moments-swipe-row
                node.querySelectorAll?.('.moments-swipe-row').forEach(bindMomentsSwipeRow);
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// ============================================================
// 每次打开 murmur 都回到「日历模式」
// ------------------------------------------------------------
// 这是**第二道保险**。第一道在 chat-mode.js 里：那个模式根本不落盘，
// 所以刷新页面天然回到日历，不需要谁去 reset。
//
// 这里再补两个事件，覆盖「不刷新、只是切出去再进来」：
//   · phone:app-opened  —— 用户重新打开 murmur
//   · phone:app-closed  —— 用户退回桌面（下次不管从哪个入口进来都是干净的）
// 两个事件都由 framework 的 openApp/closeApp 派发。renderPage 不行 ——
// 它每次重画都会跑，分不出「重新打开」和「只是重画了一次」。
// ============================================================
if (typeof window !== 'undefined' && !window.__chatRecordModeResetInstalled) {
    window.__chatRecordModeResetInstalled = true;
    const resetIfChat = (e) => {
        if (e?.detail?.appId !== 'chat') return;
        resetChatRecordMode();
    };
    window.addEventListener('phone:app-opened', resetIfChat);
    window.addEventListener('phone:app-closed', resetIfChat);
}

// ============================================================
// ★ v0.88 修复「切出 murmur 再切回,故事模式粉色残留」bug
// 问题根因:bindShellModeListener / bindRootPageChangedListener 只在 hydrate() 异步完成后才绑定,
// 但 phone:app-opened 事件在 hydrate() 完成前就派发了,导致 syncShellDataMode / syncHeaderActionsWithMode
// 没机会执行,app-shell 保留旧的 story-mode 样式。
// 解决:把监听器绑定移到「定义位置后立刻执行一次」,保证 phone:app-opened 事件随时能被接收。
// 注意:由于 let 声明的暂时性死区(TDZ),这里只能用哨兵变量占位,
//      真正的 addEventListener 要等下面函数定义后再调。
// ============================================================
let _shellModeListenerBoundEarly = false;
let _rootPageChangedListenerBoundEarly = false;

// 如果 chat:record-mode-changed 事件在监听器挂上之前就派发了,
// 我们用「replay」机制补一次:监听器挂上后,主动派发一次当前 mode。
// 这里只是占位,真正 dispatch 是在 hydrate 后 syncShellDataMode(getChatRecordMode()) 已完成时。

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
// ★ v0.70 抽到 components/chat-scroll.js,这里 re-export 保持向后兼容
import { scrollToBottomWithRetry as _scrollToBottomWithRetry } from './components/chat-scroll.js';
const scrollToBottomWithRetry = _scrollToBottomWithRetry;

// ─── 联系人/群组名称映射 ──────────────────────────────
// ★ v0.80:移除占位联系人名称(小美/小明/小蓝/小红/游戏群) — 真实联系人全部走 SDK,
//   找不到就回退返回 id 本身,UI 自己根据 id 走「未知」展示逻辑。
const CONTACT_NAMES = {};

/**
 * 获取联系人或群组的名称
 * @param {string} id - 可能是完整ID(如 'group-1', 'ai-1')或部分ID
 * @param {string} sourceType - 'group' 或 'private'
 */
function getContactOrGroupName(id, sourceType) {
    if (!id) return null;
    if (sourceType === 'group') {
        return CONTACT_NAMES[id] || CONTACT_NAMES[`group-${id}`] || id;
    }
    return CONTACT_NAMES[id] || CONTACT_NAMES[`ai-${id}`] || id;
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
        '.chat-story-management .chat-story-mgmt-page',
        '.chat-favorites .chat-favorites-scroll',
        '.chat-history-page',
        // ★ v0.87 root tab 的滚动容器（朋友圈 / 联系人 / 我的）
        //   之前只列了 detail 页的容器，root tab 重画一律弹回顶部
        '.moments-page',
        '.chat-contacts-page',
        '.chat-profile-page',
        '.app-detail-body',
        '.app-content',
    ];

    // ★ v0.61.8.11 捕获 anchor:从 click 事件冒泡到 document.body,
    //   在 capture 阶段记下最近一次 click 的 [data-prompt-id] 祖先元素
    let _lastAnchorPromptId = null;
    let _lastAnchorOffsetTop = 0;
    let _lastAnchorAt = 0;
    // 锚点只在「刚点完就重画」这个窗口内有效。超过这个时间说明用户中间又滚动过，
    // 拿旧锚点去算偏移会把页面拽到别的地方。
    const ANCHOR_TTL_MS = 4000;
    if (typeof document !== 'undefined' && document.body && !document.body.__chatScrollAnchorHooked) {
        document.body.__chatScrollAnchorHooked = true;
        document.body.addEventListener('click', (e) => {
            try {
                const t = e.target;
                if (!t || typeof t.closest !== 'function') return;
                // 优先找 .pm-card[data-prompt-id],兜底任何 [data-prompt-id]
                // (segmented tabs 在 promptId 的 details 里);朋友圈用 [data-moment-id]
                const el = t.closest('.pm-card[data-prompt-id]')
                    || t.closest('[data-prompt-id]')
                    || t.closest('[data-moment-id]');
                if (!el) return;
                _lastAnchorPromptId = el.getAttribute('data-prompt-id')
                    || `moment:${el.getAttribute('data-moment-id')}`;
                _lastAnchorOffsetTop = findOffsetTopInScroller(el);
                _lastAnchorAt = Date.now();
            } catch (_) { /* ignore */ }
        }, true); // capture phase
    }
    /**
     * 算元素相对**它所在滚动容器**的 offsetTop。
     * ★ v0.87 之前这里写死「一直往上走到 .pm-page 为止」,只有回复提示词页是对的;
     *   其他页面走到 null 才停,算出来的是相对文档的距离。
     *   而 restore 那边是走到「滚动容器」为止 —— 两个基准不一样,
     *   相减出来的 delta 是个毫无意义的大数,页面直接跳飞。
     */
    function findOffsetTopInScroller(el) {
        try {
            const scroller = _resolveScrollerFor(el);
            let cur = el;
            let top = 0;
            while (cur && cur !== scroller) {
                top += cur.offsetTop || 0;
                cur = cur.offsetParent;
            }
            return top;
        } catch (_) {
            return 0;
        }
    }
    /** 元素往上找到第一个属于 CHAT_SCROLL_SELECTORS 的祖先 */
    function _resolveScrollerFor(el) {
        try {
            const root = document.querySelector('.app-shell[data-app-id="chat"]');
            if (!root) return null;
            for (const sel of CHAT_SCROLL_SELECTORS) {
                const candidate = el.closest?.(sel);
                if (candidate && root.contains(candidate)) return candidate;
            }
        } catch (_) { /* ignore */ }
        return null;
    }

    function _findChatScroller() {
        try {
            const root = document.querySelector('.app-shell[data-app-id="chat"]');
            if (!root) return null;
            const anchorFresh = _lastAnchorPromptId && (Date.now() - _lastAnchorAt) < ANCHOR_TTL_MS;
            for (const sel of CHAT_SCROLL_SELECTORS) {
                const el = root.querySelector(sel);
                if (el && el.scrollTop > 0) {
                    return {
                        selector: sel,
                        scrollTop: el.scrollTop,
                        anchorPromptId: anchorFresh ? _lastAnchorPromptId : null,
                        anchorOffsetTop: anchorFresh ? _lastAnchorOffsetTop : 0,
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
                // ★ v0.61.8.11 优先按 anchor 找新位置：卡片在重画后可能整体上移/下移
                //   （启停一条 prompt 会让它在「当前上下文」和「可用 Prompt」之间搬家），
                //   死记 scrollTop 会让用户看到的内容漂走。
                let targetTop = scrollTop;
                if (anchorPromptId) {
                    const selector = anchorPromptId.startsWith('moment:')
                        ? `[data-moment-id="${cssEscape(anchorPromptId.slice('moment:'.length))}"]`
                        : `[data-prompt-id="${cssEscape(anchorPromptId)}"]`;
                    const newAnchor = el.querySelector(selector);
                    if (newAnchor) {
                        // 计算新 anchor 在 scroller 里的 offsetTop
                        let cur = newAnchor;
                        let top = 0;
                        while (cur && cur !== el) {
                            top += cur.offsetTop || 0;
                            cur = cur.offsetParent;
                        }
                        // ★ v0.87 这里原来写的是 `el.scrollTop + (top - _lastAnchorOffsetTop)`。
                        //   restore 发生在元素刚重建之后,此时 el.scrollTop 恒为 0,
                        //   于是 targetTop 变成了「锚点位移量」而不是「原位置 + 位移量」——
                        //   结果每次重画都把用户弹到接近顶部。基准必须是**捕获时的** scrollTop。
                        targetTop = scrollTop + (top - _lastAnchorOffsetTop);
                    }
                }
                targetTop = Math.max(0, Math.min(targetTop, Math.max(0, el.scrollHeight - el.clientHeight)));
                el.scrollTop = targetTop;
                try { applyPromptFolds(el); } catch (_) { /* ignore */ }
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
    try { installPromptFoldGuards(); } catch (_) { /* ignore */ }
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
            title: 'murmur',
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
        // ★ 通讯录页搜索框:interactive=true 让 framework 渲染真正的 input,
        //   onSearchInputMethod 指向 chat-app 的方法(framework 收到 input 事件会调用)
        topbar: { visible: true, type: 'search', searchPlaceholder: '搜索联系人', interactive: true, onSearchInputMethod: 'onTopbarSearchInput' },
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
    // ★ 切到 calendar/story 模式后,framework 会重画 .app-tab-bar,旧指示器跟着旧 DOM 一起死。
    //   renderChatPage() 只在常规 chat 页面渲染时被调,接管模式下走不到,所以这里补一次。
    try {
        const tabBar = document.querySelector('.app-nav[data-app-id="chat"] .app-tab-bar');
        if (tabBar && !tabBar.querySelector('.chat-tab-indicator')) {
            tabBar.insertAdjacentHTML('afterbegin', '<div class="chat-tab-indicator"></div>');
        }
    } catch (_) {}
}

/**
 * 监听 chat:record-mode-changed 事件,把 mode 反映到 app-shell 的 data-chat-mode。
 * 模块加载时挂一次,后续切 mode 自动同步 — 不需要每个 method 单独调。
 * 旧调用方(syncHeaderActionsWithMode / toggleRecordMode)仍可继续调 syncShellDataMode,
 * 双保险无副作用(写入同值不触发 DOM 变更)。
 */
let _shellModeListenerBound = false;
function bindShellModeListener() {
    // ★ v0.88 兼容早期模块级哨兵:函数可能在变量声明前就被调用,
    //   用 _shellModeListenerBoundEarly 防止在早期路径重复挂监听。
    if (typeof window === 'undefined') return;
    if (_shellModeListenerBound || _shellModeListenerBoundEarly) {
        _shellModeListenerBound = true;
        return;
    }
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
    // ★ v0.88 兼容早期模块级哨兵:函数可能在变量声明前就被调用,
    //   用 _rootPageChangedListenerBoundEarly 防止在早期路径重复挂监听。
    if (typeof window === 'undefined') return;
    if (_rootPageChangedListenerBound || _rootPageChangedListenerBoundEarly) {
        _rootPageChangedListenerBound = true;
        return;
    }
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

// ★ v0.88 模块加载后立即绑定这两个监听器,确保 phone:app-opened 事件随时能被接收到。
//   这两行在函数定义之后才执行,绕开了 let 的 TDZ。
if (typeof window !== 'undefined') {
    try { bindShellModeListener(); } catch (_) {}
    try { bindRootPageChangedListener(); } catch (_) {}
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
        // 注意:交互绑定由模块顶层的 MutationObserver 处理
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

// ============================================================
// ★ v0.81 群成员管理辅助函数
//   - buildGroupPickerCandidates: 把 resolvedMembers + 当前用户
//     转成 GroupMemberPickerModal 的 candidates 列表
//   - generateAiGroupNickname: 基于 AI 人设字段启发式生成群昵称
// ============================================================

/**
 * 构建群成员选择器候选列表
 *
 * @param {Object} opts
 * @param {Array} opts.resolvedMembers  resolveMembers 返回 [{id, name, avatar, avatarBg, ...}]
 * @param {Object} opts.defaultUser    sdk.users.getActive()
 * @param {string} opts.currentOwnerId 当前群主 id
 * @param {string[]} opts.adminIds    当前管理员 id 列表
 * @param {Object} opts.memberNicknames 当前群昵称映射
 * @param {'all'|'admin-picker'} [opts.filter='all']
 *        'all' → 给群主选择用,包含 user + 所有 AI
 *        'admin-picker' → 给选管理员用,排除 user、排除群主、已是管理员置灰
 * @returns {Array} candidates
 */
function buildGroupPickerCandidates(opts) {
    const {
        resolvedMembers = [],
        defaultUser,
        currentOwnerId,
        adminIds = [],
        memberNicknames = {},
        filter = 'all',
    } = opts || {};
    const adminSet = new Set(adminIds.map(String));
    const ownerStr = String(currentOwnerId || '');
    const userIdStr = String(defaultUser?.id || '');
    const out = [];

    // user 本人
    if (filter === 'all' || filter === 'owner-picker') {
        const userAv = (function () {
            try {
                const cu = defaultUser?.socialProfiles?.chat || {};
                return {
                    url: cu.avatar || defaultUser?.avatar || '',
                    bg: cu.avatarBg || defaultUser?.avatarBg || '#F4A6CD',
                };
            } catch (_) {
                return { url: '', bg: '#F4A6CD' };
            }
        })();
        const userNick = memberNicknames[userIdStr] || '';
        const isCurrentOwner = String(userIdStr) === ownerStr;
        out.push({
            id: userIdStr || 'user',
            label: defaultUser?.name || '我',
            avatar: userAv.url,
            avatarBg: userAv.bg,
            initial: '我',
            kind: 'user',
            isCurrentUser: true,
            tag: isCurrentOwner ? '当前群主' : (userNick ? `昵称: ${userNick}` : ''),
            disabled: isCurrentOwner, // 当前群主不可重复选择
            disabledReason: isCurrentOwner ? '当前已是群主' : '',
        });
    }

    // AI 成员
    for (const m of resolvedMembers || []) {
        const id = m.id || m.aiPersonId || '';
        if (!id) continue;
        const meta = (function () {
            try {
                const sdk = window.settingsSdk;
                const ai = sdk?.aiPersons?.get?.(id);
                const chat = ai?.socialProfiles?.chat || {};
                return {
                    nickname: chat.nickname || ai?.name || id,
                    avatar: chat.avatar || ai?.avatar || '',
                    avatarBg: chat.avatarBg || ai?.avatarBg || '#A8C8EC',
                };
            } catch (_) {
                return { nickname: id, avatar: '', avatarBg: '#A8C8EC' };
            }
        })();
        const nick = memberNicknames[id] || '';
        const isOwner = String(id) === ownerStr;
        const isAdmin = adminSet.has(String(id));
        let disabled = false;
        let disabledReason = '';
        if (filter === 'admin-picker') {
            if (isOwner) {
                disabled = true;
                disabledReason = '当前是群主';
            } else if (isAdmin) {
                disabled = true;
                disabledReason = '已是管理员';
            }
        }
        out.push({
            id,
            label: meta.nickname,
            avatar: meta.avatar,
            avatarBg: meta.avatarBg,
            initial: (meta.nickname || id || '?').charAt(0),
            kind: 'ai',
            isCurrentUser: false,
            tag: isOwner
                ? '当前群主'
                : (isAdmin ? '管理员' : (nick ? `昵称: ${nick}` : '')),
            disabled,
            disabledReason,
        });
    }

    return out;
}

function loadGroupChatEntry(sdk, user, groupId, mode) {
    if (!sdk?.chatGroups?.get || !user || !groupId) return null;
    const hit = sdk.chatGroups.get(user, groupId, mode);
    if (hit) return hit;
    for (const m of ['calendar', 'story']) {
        const e = sdk.chatGroups.get(user, groupId, m);
        if (e) return e;
    }
    return null;
}

/**
 * 群聊工具栏用的成员列表（自定义身份 / @ / 转账）。
 * 默认不置灰任何人；owner-picker 那套 disabled 在这里清掉。
 */
function listGroupActionCandidates(sdk, user, groupId, mode, opts = {}) {
    const {
        includeUser = true,
        includeAll = false,
        excludeUser = false,
        currentAsId = '',
    } = opts;
    const entry = loadGroupChatEntry(sdk, user, groupId, mode);
    const resolved = (sdk?.chatGroups?.resolveMembers && entry)
        ? sdk.chatGroups.resolveMembers(sdk, user, entry)
        : (entry?.members || []).map((id) => ({ id }));
    let candidates = buildGroupPickerCandidates({
        resolvedMembers: resolved,
        defaultUser: user,
        currentOwnerId: entry?.ownerId || user?.id,
        adminIds: entry?.adminIds || [],
        memberNicknames: entry?.memberNicknames || {},
        filter: 'all',
    }).map((c) => ({ ...c, disabled: false, disabledReason: '' }));
    if (!includeUser || excludeUser) {
        candidates = candidates.filter((c) => !c.isCurrentUser);
    }
    const asId = String(currentAsId || '');
    const userId = String(user?.id || '');
    if (asId || opts.markSelfCurrent) {
        for (const c of candidates) {
            const isCurrent = asId
                ? String(c.id) === asId
                : !!c.isCurrentUser || String(c.id) === userId;
            if (isCurrent) {
                c.tag = c.tag ? `${c.tag} · 当前` : '当前';
            }
        }
    }
    if (includeAll) {
        candidates.unshift({
            id: '__all__',
            label: '所有人',
            avatar: '',
            avatarBg: '#A8C8EC',
            initial: '@',
            kind: 'all',
            isCurrentUser: false,
            tag: '通知全体成员',
            disabled: false,
            disabledReason: '',
        });
    }
    return { entry, candidates };
}

/**
 * 启发式 AI 群昵称生成器
 *
 * 优先用人设里的 role / tone / personality 等结构化字段拼出
 * 「昵称 + 修饰词」形式的群昵称。
 *
 * 模板(按顺序尝试,命中即返回):
 *   1. {name}·{role 取首 2~3 字}
 *   2. {name}（{tone 取首 4~6 字}）
 *   3. {name}の{tagName}
 *   4. {name}{groupName 末 2 字}
 *   5. {name} · {role/tone 摘要前 2 字}
 *
 * @param {Object} ai aiPerson 实例
 * @param {Object} entry chatGroup entry
 * @returns {string|null} 生成的群昵称,失败返回 null
 */
function generateAiGroupNickname(ai, entry) {
    try {
        const chat = ai?.socialProfiles?.chat || {};
        const nickname = chat.nickname || ai?.name || '';
        if (!nickname) return null;
        const role = String(ai?.role || '').trim();
        const tone = String(ai?.tone || '').trim();
        const personality = String(ai?.personality || '').trim();
        const bio = String(ai?.bio || '').trim();
        const groupName = String(entry?.name || '').trim();

        // 第一个有意义的修饰词
        const pickFragment = (raw, max = 4) => {
            if (!raw) return '';
            const cleaned = raw
                .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '')
                .replace(/[、，。！？,.\s]+/g, '、')
                .trim();
            if (!cleaned) return '';
            return cleaned.split(/[、,，]/)[0].slice(0, max);
        };

        // 模板 1:昵称·职业
        if (role) {
            const r = pickFragment(role, 3);
            if (r) return `${nickname}·${r}`.slice(0, 16);
        }
        // 模板 2:昵称（语气）
        if (tone) {
            const t = pickFragment(tone, 5);
            if (t) return `${nickname}（${t}）`.slice(0, 16);
        }
        // 模板 3:昵称の人格
        if (personality) {
            const p = pickFragment(personality, 4);
            if (p) return `${nickname}の${p}`.slice(0, 16);
        }
        // 模板 4:昵称 + 群聊末 2 字
        if (groupName && groupName.length >= 2) {
            const tail = groupName.slice(-2);
            return `${nickname}${tail}`.slice(0, 16);
        }
        // 模板 5:昵称 + bio 前 2 字
        if (bio) {
            const b = pickFragment(bio, 3);
            if (b) return `${nickname}·${b}`.slice(0, 16);
        }
        // 兜底:仅昵称
        return nickname.slice(0, 16);
    } catch (err) {
        console.warn('[chat-app] generateAiGroupNickname failed', err);
        return null;
    }
}

export function createChatApp() {
    // ★ v0.69 通话岛模板已在模块顶层注册过(见文件顶部),这里 noop

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
        // 有 getBackground 时框架会把状态栏图标兜底成白字；murmur 浅底要用收藏页主蓝。
        statusBarColor: '#4a6fa5',
        dock: { visible: true, order: 2 },
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

        // ★ 声明「我是社交软件」：人设编辑器（nook）里会自动出现一张
        //   murmur 的「社媒形象」卡（网名 / 头像 / 背景），数据存在
        //   persona.socialProfiles.chat。
        //   以前这张卡是写死在 settings 的 home-section.js 里的，
        //   现在改成 App 自己声明（src/core/social-app-registry.js）。
        socialProfile: {
            label: 'murmur',
            desc: '社交聊天软件',
            order: 10,
            // signature 和 pat 是 murmur 独有的：签名显示在通讯录
            // （contacts-page 读 aiMeta.signature），拍一拍文案由
            // chat-page 读 socialProfiles.chat.patSetting。别的社交 App
            // 没有消费这两样的地方，所以不该在它们的卡上出现输入框。
            fields: ['nickname', 'signature', 'pat', 'avatar', 'background'],
        },

        // ★ App Store 详情页描述
        distribution: {
            appStore: {
                subtitle: '和你的人设聊天',
                category: '社交',
                description: `人为什么需要把话说给谁听？我也不知道。也许有些念头，只有在得到回应以后，才肯显出原来的形状。

murmur 接住的是你与人设之间持续生长的关系。私聊也好，群聊也好，文字、通话、动态里的来往，都从 nook 中的人设与世界开始，不替它们预先规定结局。

消息会留下，记忆和上下文可以查看、取舍；走到别处时，对方也仍可能发来消息。你来与不来，那些对话都在那里，等下一句自然发生。`,
            },
        },

        // ★ v0.87 声明 murmur 会占用灵动岛的全部时机。
        //   用户在「我 → 灵动岛与小组件」里能逐条预览和开关。
        //   通话那条标了 essential —— 正在通话时把岛关掉等于把电话弄丢，不允许。
        islandKinds: [
            {
                id: 'call',
                label: '通话中',
                desc: '头像、通话时长、挂断按钮和一个输入框。点岛展开成大卡后能直接看消息、继续对话。',
                when: '语音通话最小化后常驻，直到挂断为止（视频通话不支持最小化）',
                template: 'call-medium',
                sizes: ['medium', 'large'],
                essential: true,
                previewPayload: {
                    name: '示例联系人',
                    avatarBg: '#A8C8EC',
                    callType: 'voice',
                    durationMs: 125000,
                    messages: [
                        { sender: 'ai', senderName: '示例联系人', content: '喂？听得到吗', timestamp: Date.now() - 60000 },
                        { sender: 'user', content: '听得到 你说', timestamp: Date.now() - 30000 },
                    ],
                },
            },
            {
                id: 'incoming-call',
                label: '来电提醒',
                desc: '对方打进来时的提示胶囊。',
                when: 'AI 主动发起通话、而你正在别的页面时',
                sizes: ['compact'],
                previewPayload: { title: '示例联系人', message: '邀请你语音通话' },
            },
            {
                id: 'new-message',
                label: '新消息通知',
                desc: '发送者名字 + 消息摘要，3.5 秒后自动消失。',
                when: '你不在这个会话里、但收到了新消息时',
                sizes: ['compact'],
                previewPayload: { title: '示例联系人', message: '在吗 刚看到你发的朋友圈' },
            },
        ],

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
            title: 'murmur',
            showPill: false,
            // headerActions 由 messages tab 的 page.topbar 提供(activeAppTopbar 优先 page),
            // 这里不再重复声明。
        },
        // detailContent 用于告诉 framework 详情页的存在和标题
        detailContent: {
            // ★ v0.67.x 钱包流水:从 chat profile 钱包菜单进入
            //   - 复用 settings/persona/transaction-history.js 的渲染函数
            //   - 但 settings 自己 detailContent 用的是驼峰 transactionHistory(看起来是 v0.67 留的小 bug),
            //     跨 app 走 framework 全局 DETAIL_PAGE_CONTENT 时,按 pageId 'transaction-history' 找不到
            //   - 这里在 chat-app 内显式补一条,framework detail 顶栏就能显示「钱包流水」标题
            'transaction-history': { title: '钱包流水', subtitle: '最近的收支记录' },
            // ★ v0.87 群聊记忆互通:从 chat profile → 群聊记忆互通 菜单进入
            'group-memory-sync': { title: '群聊记忆互通', subtitle: '私聊与群聊记忆互通' },
        },
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
                // ★ v0.44:读取真实收藏数据(sdk.chatFavorites)
                const sdk = window.settingsSdk;
                const realFavs = (() => {
                    try {
                        const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                        if (!user) return [];
                        const userId = typeof user === 'string' ? user : user.id;
                        // 按 (user, aiPersonId, mode) 拉取,不过滤特定联系人(全部)
                        const list = sdk?.chatFavorites?.list?.(user) || [];
                        return list;
                    } catch (err) {
                        console.warn('[chat] realFavs error:', err);
                        return [];
                    }
                })();
                // ★ v0.44:读取对话片段收藏(内存 + v0.69 localStorage 兜底,刷新仍可见)
                let conversationFavs = Array.isArray(app?.state?._conversationFavorites)
                    ? app.state._conversationFavorites
                    : [];
                try {
                    const ls = JSON.parse(localStorage.getItem('xiaoting::chat-conversation-favorites-v1') || '[]');
                    if (Array.isArray(ls) && ls.length > 0) {
                        // 用 conv key 去重,内存优先
                        const seen = new Set(conversationFavs.map((c) => `${c.sourceType}::${c.sourceId}::${c.messages?.[0]?.id}`));
                        for (const c of ls) {
                            const k = `${c.sourceType}::${c.sourceId}::${c.messages?.[0]?.id}`;
                            if (!seen.has(k)) { conversationFavs.push(c); seen.add(k); }
                        }
                    }
                } catch (_) {}
                const favOptions = {
                    contactId: favSourceId,
                    sourceType: favSourceType,
                    sourceName: favSourceId ? getContactOrGroupName(favSourceId, favSourceType) : null,
                    // ★ v0.36:从 app.state 读取收藏页 in-memory state(分类 / 搜索 keyword / 展开状态)
                    state: (app?.state?.chat?.favorites) || {},
                    // ★ v0.44:合并两类收藏数据:对话片段(内存) + 单条收藏(sdk)
                    //   v0.80:不再合并 DEMO_FAVORITES 占位数据
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
                // 注意:交互绑定由模块顶层的 MutationObserver 处理
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
            } else if (pageId === 'group-memory-sync') {
                // ★ v0.87 群聊记忆互通设置详情页(个人页面 → 群聊记忆互通 菜单)
                //   - 走 sdk.groupMemorySync 全局 + 每个 AI 配置
                //   - 改完走 appMethod → SDK 落盘 → invalidateRendererCache + syncNow 二段式重画
                try {
                    if (typeof window.whenSettingsSdkReady === 'function') {
                        await window.whenSettingsSdkReady(3000);
                    }
                    const sdk = window.settingsSdk;
                    const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                    if (!sdk || !sdk.groupMemorySync || !defaultUser) {
                        html = `<div class="settings-empty">SDK 尚未就绪,请稍后重试</div>`;
                    } else {
                        const { renderGroupMemorySyncPage } = await import('./pages/group-memory-sync-page.js');
                        html = renderGroupMemorySyncPage(app, { sdk, user: defaultUser });
                    }
                } catch (err) {
                    console.warn('[chat-app] group-memory-sync render failed:', err);
                    html = `<div class="settings-empty">加载失败:${escapeHtml(String(err && err.message || err))}</div>`;
                }
            } else if (pageId.startsWith('chat-history-')) {
                // ★ v0.61.3 历史消息详情页(聊天设置 → 聊天记录管理 → 历史消息)
                const cid = pageId.replace('chat-history-', '');
                html = renderHistoryPage(app, cid);
            } else if (pageId.startsWith('story-archive-') || pageId.startsWith('story-management-')) {
                // 故事管理详情页(原「故事存档」,v0.68 改名 → 故事管理)
                //   - pageId 同时支持 story-archive-{cid} 和 story-management-{cid} 两种入口
                //     (避免破坏已有 chat-settings-page / chat-group-settings-page 的入口链接)
                const cid = pageId.replace(/^(story-archive|story-management)-/, '');
                html = renderStoryManagementPage(app, cid);
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
                //   完整 contactId 传给 renderPrivateChatPage,内部解析 aiPersonId + mode
                html = await renderPrivateChatPage(app, pageId);
                // ★ v0.61.3:实时计算「当前聊天回合」prompt 文本(只 contextRounds,无 K 链)
                //   - 写入 app.state.chat.contextRoundsMap[aiPersonId] = { rounds, content, lastUpdated }
                //   - 用途:prompt-manager「当前聊天回合」卡片 + 计算 realtime context prompt
                //   - 不再触发任何 K 链压缩(K 链已移除)
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
                        // roundsCount 与 content 同口径(1 回合 = 用户说一次 + AI 回一次),
                        // 之前这里自己抄了一份"按 sender 切换计数"的逻辑,算出来正好是两倍。
                        const roundsCount = takeRecentRounds(msgs, ctxN).total;
                        if (!app.state.chat) app.state.chat = {};
                        if (!app.state.chat.contextRoundsMap) app.state.chat.contextRoundsMap = {};
                        app.state.chat.contextRoundsMap[aiPersonId] = {
                            rounds: roundsCount,
                            content,
                            lastUpdated: Date.now(),
                            contextRounds: ctxN,
                        };
                        // 打开私聊就把 pre 刷一次 —— 不用等用户点进「回复提示词」页。
                        // 不 await:渲染链路不该被它拖慢,发送前 ai-service 还会再补一次。
                        void window.__chatRefreshContextPreview?.({ aiPersonId, mode });
                    } catch (err) {
                        console.warn('[chat-app] v0.61.3 private-page context rounds init failed:', err);
                    }
                })();
            } else if (pageId.startsWith('call-record-')) {
                // 通话记录详情页(语音/视频)— 卡片点击进入
                const callRecordId = pageId.replace('call-record-', '');
                html = renderCallRecordDetailPage(app, callRecordId);
            } else if (pageId === 'transaction-history') {
                // ★ v0.67.x 钱包流水(从 chat profile 钱包菜单进入)
                //   - 渲染在 chat app 的 detail 容器里,返回 → closeDetailPage 直接回 chat profile
                //   - 结构对齐 chat-favorites 详情页:同套 topbar + 渐变背景 + 摘要卡片 + 列表卡片
                //   - 配色沿用 chat 主题蓝(#4a6fa5)/粉(#f2aacb) 渐变,而不是 chat 之外的绿色
                try {
                    if (typeof window.whenSettingsSdkReady === 'function') {
                        await window.whenSettingsSdkReady(3000);
                    }
                    const sdk = window.settingsSdk;
                    if (!sdk?.assetFlow) {
                        html = `<div class="settings-empty">SDK 未就绪,请稍后再试</div>`;
                    } else {
                        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                        const personaName = defaultUser?.name || defaultUser?.socialProfiles?.chat?.nickname || '用户';
                        const safeName = escapeHtml(personaName);
                        const userId = defaultUser?.id || '';
                        const balance = sdk.assetFlow.getBalance('user', userId) || 0;
                        const flows = sdk.assetFlow.list('user', userId, { limit: 0 }) || [];

                        // 流水类型
                        const txTypeMap = {
                            'redpacket': (d) => d === 'in' ? '收到红包' : '发红包',
                            'transfer': (d) => d === 'in' ? '收到转账' : '转账',
                            'income-settle': () => '定时收入到账',
                            'manual': () => '手动调整',
                            'unknown': () => '其他',
                        };
                        const fmtTime = (ts) => {
                            const d = new Date(ts || Date.now());
                            const pad = (n) => String(n).padStart(2, '0');
                            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        };
                        const inCount = flows.filter(e => e.direction === 'in').length;
                        const outCount = flows.filter(e => e.direction !== 'in').length;
                        const listHtml = flows.length === 0
                            ? `
                            <div class="wallet-empty">
                                <div class="wallet-empty-icon">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                                        <circle cx="16" cy="12" r="2"></circle>
                                    </svg>
                                </div>
                                <div class="wallet-empty-text">暂无交易记录</div>
                                <div class="wallet-empty-hint">收发红包、转账后记录将显示在这里</div>
                            </div>`
                            : flows.map((e) => {
                                const isIn = e.direction === 'in';
                                const sign = isIn ? '+' : '-';
                                const typeFn = txTypeMap[e.type] || (() => '其他');
                                const typeLabel = typeFn(e.direction);
                                const cpName = e.counterpartyName ? escapeHtml(e.counterpartyName) : '';
                                const note = e.note ? escapeHtml(e.note) : '';
                                const itemCls = `wallet-flow-item${isIn ? ' is-in' : ' is-out'}`;
                                return `
                                    <div class="${itemCls}">
                                        <div class="wallet-flow-item-main">
                                            <div class="wallet-flow-item-title">${typeLabel}${cpName ? ` <span class="wallet-flow-item-cp">· ${cpName}</span>` : ''}</div>
                                            ${note ? `<div class="wallet-flow-item-note">${note}</div>` : ''}
                                            <div class="wallet-flow-item-meta">${fmtTime(e.timestamp)}</div>
                                        </div>
                                        <div class="wallet-flow-item-amount ${isIn ? 'wallet-amount--in' : 'wallet-amount--out'}">${sign}¥${(Number(e.amount) || 0).toFixed(2)}</div>
                                    </div>`;
                            }).join('');

                        html = `
<div class="wallet-page">
    <div class="wallet-topbar">
        <button class="wallet-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}' aria-label="返回">
            <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <h1>钱包</h1>
        <span class="wallet-topbar-spacer"></span>
    </div>

    <div class="wallet-scroll">
        <!-- 余额 hero 卡片 -->
        <div class="wallet-hero">
            <div class="wallet-hero-bg wallet-hero-bg--1"></div>
            <div class="wallet-hero-bg wallet-hero-bg--2"></div>
            <div class="wallet-hero-deco">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="white"><rect x="2" y="4" width="20" height="16" rx="2"></rect><circle cx="16" cy="12" r="2"></circle></svg>
            </div>
            <div class="wallet-hero-name">${safeName} 的钱包</div>
            <div class="wallet-hero-label">账户余额</div>
            <div class="wallet-hero-balance">¥ ${balance.toFixed(2)}</div>
        </div>

        <!-- 摘要卡片(对齐 chat-favorites-summary) -->
        <div class="wallet-summary">
            <div class="wallet-summary-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M21 7H5a1 1 0 0 1 0-2h14V3H5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h16v-2H5a1 1 0 0 1 0-2h16v-8zm-5 5a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>
            </div>
            <div>
                <strong>交易记录</strong>
                <span>收入 ${inCount} 笔 · 支出 ${outCount} 笔</span>
            </div>
            <button class="wallet-refresh-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"refreshWalletHistory"}' id="refresh-transactions" aria-label="刷新">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 4 21 10 15 10"/></svg>
                <span>刷新</span>
            </button>
        </div>

        <div class="wallet-section-title">最近的流水</div>

        <!-- 列表卡片(对齐 chat-favorites-list) -->
        <div class="wallet-list" id="transactions-list">
            ${listHtml}
        </div>
    </div>
</div>`;
                    }
                } catch (err) {
                    console.warn('[chat-app] renderTransactionHistory failed:', err);
                    html = `<div class="settings-empty">钱包加载失败:${escapeHtml(err?.message || String(err))}</div>`;
                }
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
            } else if (pageId.startsWith('group-manage-')) {
                // ★ v0.81 群成员管理详情页(从群设置 → 群聊设置 进入)
                //   pageId 格式: group-manage-{groupId}-{mode}
                //   groupId 可能含横杠,只剥掉前缀和末尾 mode
                const stripped = pageId.slice('group-manage-'.length);
                let mgmtGroupId = stripped;
                let mgmtMode = 'calendar';
                const lastDash = stripped.lastIndexOf('-');
                if (lastDash > 0 && (stripped.slice(lastDash + 1) === 'calendar' || stripped.slice(lastDash + 1) === 'story')) {
                    mgmtGroupId = stripped.slice(0, lastDash);
                    mgmtMode = stripped.slice(lastDash + 1);
                }
                html = renderGroupManagePage(app, mgmtGroupId, mgmtMode);
            } else if (pageId.startsWith('group-')) {
                // 群聊详情页 — 必须在 group-settings-* 之后匹配
                const groupId = pageId.replace('group-', '');
                html = renderGroupChatPage(app, groupId);
            } else if (pageId === 'game-leaderboard') {
                // 战绩排行榜（读 games/core/record.js 的真实统计）
                html = renderGameLeaderboardPage(app);
            } else if (pageId === 'game-selector' || pageId.startsWith('game-selector-')) {
                // 游戏大厅。带 groupId 才能开局（从群聊工具栏进来的都带）
                const lobbyGroupId = pageId === 'game-selector' ? '' : pageId.slice('game-selector-'.length);
                html = renderGameSelectorPage(app, lobbyGroupId);
            } else if (pageId === 'game-maker' || pageId.startsWith('game-maker-')) {
                // 「做一个新游戏」：出提示词 + 上传玩法 js
                const makerGroupId = pageId === 'game-maker' ? '' : pageId.slice('game-maker-'.length);
                html = renderGameMakerPage(app, makerGroupId);
            } else if (pageId.startsWith('game-setup-')) {
                // game-setup-{gameId}-{groupId}
                const rest = pageId.slice('game-setup-'.length);
                const cut = rest.indexOf('-');
                const setupGameId = cut > 0 ? rest.slice(0, cut) : rest;
                const setupGroupId = cut > 0 ? rest.slice(cut + 1) : '';
                html = renderGameSetupPage(app, setupGameId, setupGroupId);
            } else if (pageId.startsWith('game-play-')) {
                // 对局页。renderGamePage 只按当前 store 状态画一次，
                // 之后的实时更新由 games/live-view.js 打补丁（它靠 MutationObserver
                // 认出 .cg-page，是唯一能保证 innerHTML 已写完的时机）
                const playGroupId = pageId.slice('game-play-'.length);
                html = chatGames.renderGamePage(playGroupId);
            } else if (pageId.startsWith('game-record-')) {
                // 群聊里点战绩卡进来的详情
                const recordMsgId = pageId.slice('game-record-'.length);
                let record = null;
                try {
                    const sdk = getSettingsSdk();
                    const msg = await sdk?.chatMessages?.get?.(recordMsgId);
                    record = msg?.gameRecord || null;
                } catch (err) {
                    console.warn('[chat-app] 读战绩失败', err);
                }
                html = renderGameRecordDetail(record);
            } else if (pageId.startsWith('call-')) {
                // 通话页面(call-voice-{contactId} / call-video-{contactId})
                const parts = pageId.replace('call-', '').split('-');
                const callType = parts[0];
                const contactId = parts.slice(1).join('-');
                html = renderCallPage(app, contactId, callType);
                // ★ v0.67.x 异步挂载通话页交互(挂断 / 静音 / 输入框 / call-manager)
                queueMicrotask(() => {
                    try {
                        app?.methods?.initCallPage?.(contactId, callType);
                    } catch (err) {
                        console.warn('[chat-app] initCallPage failed:', err);
                    }
                });
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
                // ★ v0.69:群聊详情页也改由模块顶层 MutationObserver 自动绑定
                //   (见模块顶部 __chatGroupObserverInstalled 块,跟私聊同款)
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
            // ★ 顶栏搜索框 input 事件 — framework 把 input 事件转发到这里
            //   payload: { value, eventType }
            //   写 keyword 到 app.state.chat.contacts.searchKeyword,触发 framework 重画通讯录页
            // ============================================================
            _ensureContactsSearchState(app) {
                if (!app.state) app.state = {};
                if (!app.state.chat) app.state.chat = {};
                if (!app.state.chat.contacts) {
                    app.state.chat.contacts = { searchKeyword: '' };
                }
                return app.state.chat.contacts;
            },

            onTopbarSearchInput(payload = {}) {
                const app = this.app;
                const st = this._ensureContactsSearchState(app);
                const value = String(payload.value || '');
                if (st.searchKeyword === value) return;
                st.searchKeyword = value;
                // 触发 framework 重画当前 page(通讯录页)
                if (typeof window !== 'undefined' && window.__detailRenderTick) {
                    window.__detailRenderTick.value++;
                }
                // 同步 framework 的 appTopbarOverride.searchValue,让 input :value 跟随输入
                try {
                    if (window.__appTopbarOverride) {
                        const ov = window.__appTopbarOverride.value || {};
                        window.__appTopbarOverride.value = Object.assign({}, ov, { searchValue: value });
                    }
                } catch (_) { /* override 可能为空,忽略 */ }
            },

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
             * ★ v0.85 群聊版:payload 同时支持 { isGroup, groupId, mode, memberId }
             *   - 群聊时写 groupSystemPromptInject[groupId](独立存储,不影响单 aiPersonId 维度)
             *   - 用户人设:groupSystemPromptInject[groupId].user
             *   - 每个 AI 成员:groupSystemPromptInject[groupId].aiMemberIds[memberId]
             *   - 持久化到 localStorage('xiaoting::chat-group-system-prompt-inject-v1')
             *     防 HMR / 旧实例不重跑 hydrate 时丢失(§28 黄金规则)
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
                // ★ v0.85 群聊版:群维度开关走 groupSystemPromptInject(独立存储)
                const isGroup = payload?.isGroup === true;
                const groupId = payload?.groupId || null;
                const memberId = payload?.memberId || null;
                const mode = payload?.mode || 'calendar';
                if (isGroup && groupId) {
                    if (!this.app.state) this.app.state = {};
                    if (!this.app.state.chat) this.app.state.chat = {};
                    const groupMap = this.app.state.chat.groupSystemPromptInject
                        || (this.app.state.chat.groupSystemPromptInject = {});
                    if (!groupMap[groupId]) {
                        groupMap[groupId] = { user: true, aiMemberIds: {} };
                    }
                    const groupCfg = groupMap[groupId];
                    if (kind === 'user') {
                        groupCfg.user = !(groupCfg.user !== false);
                    } else if (kind === 'ai' && memberId) {
                        if (!groupCfg.aiMemberIds) groupCfg.aiMemberIds = {};
                        const prev = groupCfg.aiMemberIds[memberId];
                        groupCfg.aiMemberIds[memberId] = !(prev !== false);
                    }
                    // 持久化到 localStorage(防 HMR 丢失)
                    try {
                        localStorage.setItem(
                            'xiaoting::chat-group-system-prompt-inject-v1',
                            JSON.stringify(groupMap),
                        );
                    } catch (_) { /* 隐私模式 / 配额满 */ }
                    // 显示更精确的通知文案(包含 AI 成员名字或群名)
                    let label;
                    try {
                        const sdk = window.settingsSdk;
                        if (kind === 'user') {
                            label = '用户人设';
                        } else if (memberId) {
                            const member = sdk?.aiPersons?.get?.(memberId);
                            label = member?.name || memberId;
                        } else {
                            label = 'AI 人设';
                        }
                    } catch (_) {
                        label = kind === 'user' ? '用户人设' : 'AI 人设';
                    }
                    const current = kind === 'user'
                        ? groupCfg.user
                        : (groupCfg.aiMemberIds?.[memberId]);
                    this._preserveScrollAroundTick();
                    this.toolkit?.island?.notify?.(
                        'info',
                        '已更新群人设注入',
                        `${label} → ${current ? '已启用' : '已停用'}`,
                    );
                    try {
                        if (typeof window.invalidateRendererCache === 'function') {
                            window.invalidateRendererCache('chat', null);
                        }
                    } catch (_) {}
                    try {
                        window.__appRendererBridge?.syncNow?.({ force: true });
                    } catch (_) {}
                    return groupCfg;
                }
                // 私聊版(原 v0.57 行为):injectMap[aiPersonId][kind]
                const st = this._ensureSystemPromptInject(this.app, aiPersonId);
                st[kind] = !st[kind];
                // ★ v0.85 持久化到 localStorage(防 HMR 丢失,跟 replyFormatInject 同款)
                try {
                    const allMap = this.app.state.chat.systemPromptInject || {};
                    localStorage.setItem(
                        'xiaoting::chat-system-prompt-inject-v1',
                        JSON.stringify(allMap),
                    );
                } catch (_) { /* 隐私模式 / 配额满 */ }
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
             * 整组开关：一次关掉 / 打开「可用 Prompt」里某个折叠组下的全部内容。
             *
             * payload: { aiPersonId, source, isGroup?, groupId?, mode? }
             *   source = 'nook' | 'murmur' | appId
             *
             * 语义是「总闸」而不是「批量改单卡」：关掉整组时组内每张卡自己的开关原样保留，
             * 再打开时用户之前一张张调好的状态还在。过滤只发生在 prompt-manager 拼 pre
             * 的那一处，以及 ai-service 追加实时块的那一处 —— 两边读的是同一张表。
             */
            togglePromptGroupInject(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                const source = String(payload?.source || '');
                if (!aiPersonId || !source) return null;
                const ownerKey = makeOwnerKey({
                    aiPersonId,
                    isGroup: payload?.isGroup === true,
                    groupId: payload?.groupId || '',
                });
                const next = toggleGroupEnabled(ownerKey, source);
                this._preserveScrollAroundTick();
                this.toolkit?.island?.notify?.(
                    'info',
                    next ? '整组已启用' : '整组已关闭',
                    `${source} → ${next ? '这一组会发给 AI' : '这一组一条都不发'}`,
                );
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}
                return next;
            },

            /**
             * 卡片开关（对话总则 + 四张实时卡）。
             *
             * payload: { aiPersonId, cardId, isGroup?, groupId?, mode? }
             *
             * 实时卡（一起听 / 四叶草 / 灯塔 / 日记）以前**没有开关**：一起听和日记只在
             * 「当前上下文」露个脸，四叶草和灯塔连脸都不露，但每一轮都在往 prompt 里塞。
             * 现在关掉之后 ai-service 只剪不拼，AI 是真的收不到。
             */
            togglePromptCardInject(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                const cardId = String(payload?.cardId || '');
                if (!aiPersonId || !cardId) return null;
                const ownerKey = makeOwnerKey({
                    aiPersonId,
                    isGroup: payload?.isGroup === true,
                    groupId: payload?.groupId || '',
                });
                const next = toggleCardEnabled(ownerKey, cardId);
                this._preserveScrollAroundTick();
                this.toolkit?.island?.notify?.(
                    'info',
                    '已更新上下文',
                    `${cardId} → ${next ? '已启用' : '已停用'}`,
                );
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}
                return next;
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
             * ★ v0.79 「用户朋友圈」虚拟系统级卡的独立开关。
             * 状态按 aiPersonId 保存到 app.state.chat.userMomentsInject。
             * 关闭后该卡从 murmur 折叠区「当前上下文」消失 + prompt-builder 不注入用户朋友圈。
             *   - 默认 true(开启状态),用户切到 false 才显示「关闭」高亮
             *   - 持久化到 localStorage('xiaoting::chat-user-moments-inject-v1')
             *   - 与 toggleReplyFormatActive 行为完全对齐
             */
            toggleUserMomentsInject(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                if (!aiPersonId) return null;
                if (!this.app.state) this.app.state = {};
                if (!this.app.state.chat) this.app.state.chat = {};
                const map = this.app.state.chat.userMomentsInject || (this.app.state.chat.userMomentsInject = {});
                map[aiPersonId] = !(map[aiPersonId] !== false); // 默认 true,切换为 false
                try {
                    localStorage.setItem(
                        'xiaoting::chat-user-moments-inject-v1',
                        JSON.stringify(map),
                    );
                } catch (_) { /* 隐私模式 / 配额满 */ }
                this._preserveScrollAroundTick();
                this.toolkit?.island?.notify?.(
                    'info',
                    '已更新用户朋友圈设置',
                    `用户朋友圈 → ${map[aiPersonId] ? '已启用' : '已停用'}`,
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
             * ★ v0.79 「AI 朋友圈概要」虚拟系统级卡的独立开关。
             * 状态按 aiPersonId 保存到 app.state.chat.aiMomentsInject。
             * 关闭后该卡从 murmur 折叠区消失 + prompt-builder 不注入 AI 朋友圈概要。
             *   - 默认 true(开启状态),用户切到 false 才显示「关闭」高亮
             *   - 持久化到 localStorage('xiaoting::chat-ai-moments-inject-v1')
             *   - 与 toggleReplyFormatActive 行为完全对齐
             */
            toggleAiMomentsInject(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                if (!aiPersonId) return null;
                if (!this.app.state) this.app.state = {};
                if (!this.app.state.chat) this.app.state.chat = {};
                const map = this.app.state.chat.aiMomentsInject || (this.app.state.chat.aiMomentsInject = {});
                map[aiPersonId] = !(map[aiPersonId] !== false); // 默认 true,切换为 false
                try {
                    localStorage.setItem(
                        'xiaoting::chat-ai-moments-inject-v1',
                        JSON.stringify(map),
                    );
                } catch (_) { /* 隐私模式 / 配额满 */ }
                this._preserveScrollAroundTick();
                this.toolkit?.island?.notify?.(
                    'info',
                    '已更新 AI 朋友圈概要设置',
                    `AI 朋友圈概要 → ${map[aiPersonId] ? '已启用' : '已停用'}`,
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
             * 当前模式卡的独立开关。
             * 状态按 aiPersonId 保存；关闭后该卡从 orderedCards 移除，因而也不会进入 pre。
             */
            toggleContextModeInject(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                const modeKey = String(payload?.modeKey || 'context-mode');
                if (!aiPersonId) return null;
                if (!this.app.state) this.app.state = {};
                if (!this.app.state.chat) this.app.state.chat = {};
                const rootMap = this.app.state.chat.contextModeInject || (this.app.state.chat.contextModeInject = {});
                const aiMap = rootMap[aiPersonId] || (rootMap[aiPersonId] = {});
                aiMap[modeKey] = !(aiMap[modeKey] !== false); // 默认 true,切换为 false
                try {
                    localStorage.setItem(
                        'xiaoting::chat-context-mode-inject-v1',
                        JSON.stringify(rootMap),
                    );
                } catch (_) {}
                this._preserveScrollAroundTick();
                this.toolkit?.island?.notify?.(
                    'info',
                    '上下文模式',
                    aiMap[modeKey] ? '已启用(AI 收到当前模式指令)' : '已停用(AI 收不到当前模式指令)',
                );
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    window.__appRendererBridge?.syncNow?.({ force: true });
                } catch (_) {}
                return aiMap[modeKey];
            },

/**
 * ★ v0.70 标记弃用 —— 切换 mode 现在完全由 call-manager / game-selector 自动完成
 *   - 用户不再主动按按钮切换
 *   - 保留 method 名(防止旧 link action 报错)但什么都不做
 *   - 由 call-manager / game-selector 直接调 window.__chatContextMode.setMode()
 */
switchContextMode(_payload = {}) {
    this.toolkit?.island?.notify?.(
        'info',
        '模式自动切换',
        '通话/视频/游戏时会自动切换,无需手动',
    );
    return null;
},

            /**
             * 打开「当前模式」编辑器弹窗:4 个 tab(聊天/语音/视频/游戏) + textarea + 保存/取消/恢复默认。
             * v0.72 改 AcModal:走 chat-modal-manager 派发,由 framework app-modal-layer 渲染。
             *   - 视觉风格跟 ContextLengthModal / EditReplyPromptModal 一致
             *   - 弹窗在 app-shell 内(不会溢出手机壳)
             *   - 「恢复默认」组件内部直接响应(textarea 立即显示默认文本,需点保存才生效)
             *   - 保存后通过 contextMode.setModePromptOverrides 持久化
             */
            async openContextModeEditor(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                const notify = (state, title, body) => this.toolkit?.island?.notify?.(state, title, body);
                try {
                    const { chatModalManager } = await import('./components/chat-modal-registry.js');
                    chatModalManager.openContextModeEditor({
                        aiPersonId,
                        onSave: (map) => {
                            // 不需要手动调 setModePromptOverrides:registry 默认行为已处理
                            // 但仍可在 onSave 闭包里加自定义副作用(显示通知 / 触发其他重画)
                            notify?.('success', '已保存', '4 种模式提示词已更新');
                            // 触发 prompt-manager 重画(Murmur 组的「当前模式」卡)
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
                } catch (err) {
                    console.warn('[chat-app] openContextModeEditor failed', err);
                }
                return null;
            },

            /**
             * ★ v0.79 「可读取朋友圈」设置弹窗入口
             *   - 入口:聊天设置 → 「可读取朋友圈」行
             *   - payload: { contactId, mode }
             *   - 弹窗本身由 chatModalManager.openMomentsReadModal 提供
             *   - 保存:把 { self, user, social } merge patch 到 chatFriends entry
             *   - 兜底:无 entry 时直接读 aiPerson.momentsReadConfig
             *   - 联动:写入后让 chat-settings-page 重新渲染(显示新条数)
             *             + prompt-manager 重画(让用户朋友圈 / AI 朋友圈概要按新条数注 pre)
             */
            async openMomentsReadModal(payload = {}) {
                const contactId = String(payload?.contactId || '');
                const mode = String(payload?.mode || 'calendar');
                const notify = (state, title, body) => this.toolkit?.island?.notify?.(state, title, body);
                if (!contactId) {
                    notify?.('error', '打开失败', '缺少 contactId');
                    return null;
                }
                try {
                    const sdk = window.settingsSdk;
                    const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                    const entry = (sdk && defaultUser)
                        ? sdk.chatFriends?.get?.(defaultUser, contactId, mode)
                        : null;
                    // 兼容:entry 优先,fallback 到 aiPerson 顶层
                    const currentValue = entry?.momentsReadConfig
                        || sdk?.aiPersons?.get?.(contactId)?.momentsReadConfig
                        || { self: 3, user: 3, social: 3 };
                    const contactName = entry?.displayName
                        || sdk?.aiPersons?.get?.(contactId)?.name
                        || contactId;
                    const { chatModalManager } = await import('./components/chat-modal-registry.js');
                    chatModalManager.openMomentsReadModal({
                        contactId,
                        contactName,
                        currentValue,
                        onSave: async (next) => {
                            try {
                                // 1) write back to chatFriends entry(merge patch)
                                if (sdk && defaultUser && sdk.chatFriends?.update) {
                                    await sdk.chatFriends.update(defaultUser, contactId, mode, {
                                        momentsReadConfig: next,
                                    });
                                }
                                // 2) 同步写到 aiPerson 顶层(老路径 fallback:某些旧 reader 直接读 aiPerson)
                                const aiPerson = sdk?.aiPersons?.get?.(contactId);
                                if (aiPerson && sdk.aiPersons?.update) {
                                    await sdk.aiPersons.update(contactId, {
                                        momentsReadConfig: next,
                                    });
                                }
                                notify?.('success', '可读取朋友圈已更新', `自己${next.self}/用户${next.user}/交际圈${next.social}`);
                                // 3) 触发整页重画
                                try {
                                    if (typeof window.invalidateRendererCache === 'function') {
                                        window.invalidateRendererCache('chat', null);
                                    }
                                } catch (_) {}
                                try {
                                    window.__appRendererBridge?.syncNow?.({ force: true });
                                } catch (_) {}
                            } catch (err) {
                                console.warn('[chat-app] openMomentsReadModal save failed', err);
                                notify?.('error', '保存失败', err?.message || String(err));
                            }
                        },
                    });
                } catch (err) {
                    console.warn('[chat-app] openMomentsReadModal failed', err);
                    notify?.('error', '打开失败', err?.message || String(err));
                }
                return null;
            },

            /**
             * ★ v0.79 「朋友圈管理」弹窗入口(AI 朋友圈概要详情)
             *   - 入口:聊天设置 → 「朋友圈管理」行
             *   - payload: { contactId, mode }
             *   - 弹窗展示 aiPerson.moments[] 全部条目 + 每条概要的可编辑/重生成/删除
             *   - 任意数据变化(sdk.moments.add / setSummary / remove / regenerateMomentSummary)→
             *     触发整页重画,让 chat-settings 的「共 N 条」计数实时更新 + 让 prompt-manager
             *     重新渲染用户朋友圈 / AI 朋友圈概要卡
             */
            async openAiMomentsDetailModal(payload = {}) {
                const contactId = String(payload?.contactId || '');
                const mode = String(payload?.mode || 'calendar');
                const notify = (state, title, body) => this.toolkit?.island?.notify?.(state, title, body);
                if (!contactId) {
                    notify?.('error', '打开失败', '缺少 contactId');
                    return null;
                }
                try {
                    const sdk = window.settingsSdk;
                    const entry = (sdk && sdk.defaultUserCard?.getDefault)
                        ? sdk.chatFriends?.get?.(sdk.defaultUserCard.getDefault(), contactId, mode)
                        : null;
                    const contactName = entry?.displayName
                        || sdk?.aiPersons?.get?.(contactId)?.name
                        || contactId;
                    let list = [];
                    try {
                        list = sdk?.moments?.list?.(contactId) || [];
                    } catch (_) { list = []; }
                    const { chatModalManager } = await import('./components/chat-modal-registry.js');
                    chatModalManager.openAiMomentsDetailModal({
                        contactId,
                        contactName,
                        initialMoments: list,
                        onChange: (event) => {
                            // 任意变化:重新计算 chat-settings 行的「共 N 条」+ prompt-manager 重画
                            try {
                                if (typeof window.invalidateRendererCache === 'function') {
                                    window.invalidateRendererCache('chat', null);
                                }
                            } catch (_) {}
                            try {
                                window.__appRendererBridge?.syncNow?.({ force: true });
                            } catch (_) {}
                            // 删除/重生成后给一个轻提示
                            if (event?.type === 'delete') {
                                notify?.('info', '已删除朋友圈', '概要不再注入到 AI prompt');
                            } else if (event?.type === 'regenerate') {
                                notify?.('success', '概要已重生成', '');
                            } else if (event?.type === 'save') {
                                notify?.('success', '概要已保存', '');
                            }
                        },
                    });
                } catch (err) {
                    console.warn('[chat-app] openAiMomentsDetailModal failed', err);
                    notify?.('error', '打开失败', err?.message || String(err));
                }
                return null;
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
 * ★ v0.57 / 修于 v0.61.8.11:保留当前滚动位置后触发 framework 重画
             *   - 监听 detail 重画产生的 scrollTop 归零,重置回保存位置
             *   - 解决「点 prompt-manager 按钮 → 页面跳回顶部」的问题
             *   - ★ v0.61.8.11 修:chat-app 内的所有 detail 页都是**自接管滚动容器**
             *     (.prompt-manager > .pm-page / .chat-settings > .chat-settings-page /
             *      .new-group-page > .new-group-body / .new-chat-page > .new-chat-content /
             *      .chat-calendar-view > .chat-calendar-view-page / .chat-story-management > .chat-story-mgmt-page /
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
                        '.chat-story-management .chat-story-mgmt-page',
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
                    // ★ defaultReplyNote 新增 ctx,跟 prompt-manager-page.js 同款(变量替换在调用方完成)
                    const replyNoteCtx = kind === 'user'
                        ? { userName: user?.name || user?.chineseName || '' }
                        : { aiName: ai?.name || '' };
                    // 系统预设原文：既是「没改过时的初始值」，也是「复原预设」按钮的目标。
                    // 只算一次，两处共用 —— 分开算迟早会分叉（AGENTS2 §11.2 的通则）。
                    const presetNote = defaultReplyNote(kind, replyNoteCtx);
                    chatModalManager.openSystemPromptEdit({
                        kind,
                        aiPersonId,
                        title: kind === 'user' ? '当前用户人设' : '当前 AI 人设',
                        baseContent,
                        replyNote: existing?.note ?? presetNote,
                        position: existing?.position ?? 'after',
                        defaultNote: presetNote,
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
                    // ★ v0.69:同时支持私聊 / 群聊
                    const chat = root.querySelector('.chat-private') || root.querySelector('.chat-group');
                    if (!chat) return;
                    const isActive = !!st.multiSelectActive;
                    chat.classList.toggle('multi-select-mode', isActive);
                    // ★ FIX v0.48:HTML 渲染时给 .multi-select-bar 写了内联 style="display:none"
                    //   必须直接操作内联 style 才能生效(覆盖 chat-page / chat-group-page 初始隐藏)
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
             *  - v0.69 群聊同步 + 持久化到 localStorage(刷新页面后仍能看到)
             *  - 私聊/群聊都能用,自动从 DOM 上下文判断 sourceType
             */
            async favoriteMulti() {
                const sdk = window.settingsSdk;
                const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                if (!user) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户');
                    return;
                }
                // ★ v0.69:同时支持私聊 / 群聊 — 取当前活动的容器
                const chatEl = document.querySelector('.chat-private') || document.querySelector('.chat-group');
                if (!chatEl) {
                    this.toolkit?.island?.notify?.('error', '页面结构异常');
                    return;
                }
                // ★ v0.69:根据容器判断 sourceType
                const isGroup = chatEl.classList.contains('chat-group');
                const sourceType = isGroup ? 'group' : 'private';
                const convId = isGroup
                    ? (chatEl.dataset.groupId || chatEl.dataset.conversationId || '')
                    : (chatEl.dataset.contactId || chatEl.dataset.conversationId || '');
                const mode = chatEl.dataset.mode || 'calendar';

                const selectedWrappers = chatEl.querySelectorAll('.message-wrapper.selected');
                const count = selectedWrappers.length;
                if (count < 2) {
                    this.toolkit?.island?.notify?.('info', '请至少选择 2 条消息', '对话片段需要多条消息');
                    return;
                }

                const selectedMsgs = [];
                for (const wrapper of selectedWrappers) {
                    const messageId = wrapper.getAttribute('data-message-id');
                    if (!messageId) continue;
                    const msgs = sdk?.chatMessages?.list ? sdk.chatMessages.list(user, convId, mode) : [];
                    const target = msgs.find((m) => m.id === messageId);
                    if (target) selectedMsgs.push(target);
                }

                if (selectedMsgs.length < 2) {
                    this.toolkit?.island?.notify?.('info', '请至少选择 2 条消息', '对话片段需要多条消息');
                    return;
                }

                // 计算会话显示名
                let sourceName = convId;
                try {
                    if (isGroup) {
                        const g = sdk?.chatGroups?.get?.(user, convId, mode);
                        sourceName = g?.name || convId;
                    } else {
                        const meta = window.aiMeta?.getAiMeta?.(convId, mode);
                        sourceName = meta?.name || convId;
                    }
                } catch (_) {}

                const conversation = {
                    id: 'conv-' + Date.now(),
                    type: 'conversation',
                    sourceType,
                    sourceId: convId,
                    sourceName,
                    time: '今天 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                    messageCount: selectedMsgs.length,
                    messages: selectedMsgs.map(msg => ({
                        id: msg.id,
                        sender: msg.sender,
                        senderName: msg.senderName || (msg.sender === 'user' ? '我' : sourceName),
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

                // ★ v0.69:同时写内存 + localStorage,刷新仍能看到
                const app = this.app;
                if (!app.state) app.state = {};
                if (!app.state._conversationFavorites) app.state._conversationFavorites = [];
                app.state._conversationFavorites.unshift(conversation);
                try {
                    const key = 'xiaoting::chat-conversation-favorites-v1';
                    const arr = JSON.parse(localStorage.getItem(key) || '[]');
                    // 用 convId+sourceType+首条消息 id 去重
                    const dedupKey = `${sourceType}::${convId}::${selectedMsgs[0].id}`;
                    const filtered = arr.filter((c) => `${c.sourceType}::${c.sourceId}::${c.messages?.[0]?.id}` !== dedupKey);
                    filtered.unshift(conversation);
                    localStorage.setItem(key, JSON.stringify(filtered.slice(0, 200)));
                } catch (_) {}

                this.toolkit?.island?.notify?.('success', '收藏成功', `已收藏 ${selectedMsgs.length} 条消息为对话片段`);
                this.exitMultiSelect();

                // 触发收藏页重渲染
                window.__detailRenderTick && window.__detailRenderTick.value++;
            },

            /**
             * ★ v0.44 多选模式 — 转发
             *  - v0.69 同时支持私聊 / 群聊(自动从 DOM 上下文判断 sourceType)
             */
            async forwardMulti() {
                const chatEl = document.querySelector('.chat-private') || document.querySelector('.chat-group');
                if (!chatEl) {
                    this.toolkit?.island?.notify?.('error', '页面结构异常');
                    return;
                }
                const isGroup = chatEl.classList.contains('chat-group');
                const convId = isGroup
                    ? (chatEl.dataset.groupId || chatEl.dataset.conversationId || '')
                    : (chatEl.dataset.contactId || chatEl.dataset.conversationId || '');
                const convType = isGroup ? 'group' : 'private';
                const mode = chatEl.dataset.mode || 'calendar';

                const selectedWrappers = chatEl.querySelectorAll('.message-wrapper.selected');
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
                const items = [];
                for (const wrapper of selectedWrappers) {
                    const messageId = wrapper.getAttribute('data-message-id');
                    if (!messageId) continue;
                    const msgs = sdk?.chatMessages?.list ? sdk.chatMessages.list(user, convId, mode) : [];
                    const target = msgs.find((m) => m.id === messageId);
                    if (target) items.push({ aiPersonId: convId, mode, messageId, content: target.content || target.text || '', type: target.type || 'text', sender: target.sender });
                }
                if (!items.length) {
                    this.toolkit?.island?.notify?.('warning', '未找到可转发的消息');
                    return;
                }
                // ★ v0.69 用当前容器判断 sourceType
                const { openForwardTargetSelection } = await import('./chat-forward.js');
                const sourceMeta = {
                    conversationType: convType,
                    conversationId: convId,
                    mode: items[0].mode,
                    conversationName: chatEl.dataset.conversationName || '',
                };
                await openForwardTargetSelection({
                    mode: items[0].mode,
                    messageIds: items.map(i => i.messageId),
                    sourceMessages: items.map(i => ({
                        id: i.messageId,
                        sender: i.sender,
                        senderName: i.sender === 'user' ? '我' : (this.app.state?.currentAiName || (isGroup ? '成员' : 'AI')),
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
             *  - v0.69 同时支持私聊 / 群聊
             */
            async deleteMulti() {
                const chatEl = document.querySelector('.chat-private') || document.querySelector('.chat-group');
                if (!chatEl) {
                    this.toolkit?.island?.notify?.('error', '页面结构异常');
                    return;
                }
                const isGroup = chatEl.classList.contains('chat-group');
                const convId = isGroup
                    ? (chatEl.dataset.groupId || chatEl.dataset.conversationId || '')
                    : (chatEl.dataset.contactId || chatEl.dataset.conversationId || '');
                const mode = chatEl.dataset.mode || 'calendar';

                const selectedWrappers = chatEl.querySelectorAll('.message-wrapper.selected');
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
                    if (!messageId) { fail++; continue; }
                    try {
                        const removed = await sdk.chatMessages.remove(messageId);
                        if (!removed) { fail++; continue; }
                        if (user && sdk.chatFavorites?.has?.(user, convId, mode, messageId)) {
                            await sdk.chatFavorites.remove(user, convId, mode, messageId);
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
             * ★ v0.67.x 修复:从 chatPrivate.dataset.contactId 拿到当前联系人,避免「缺少联系人上下文」告警
             *  - 优先级:payload.aiPersonId > state.chat.action.aiPersonId > 当前 DOM chatPrivate.dataset.contactId
             */
            async triggerVoiceCall(payload = {}) {
                const aiPersonId = payload.aiPersonId
                    || this.app?.state?.chat?.action?.aiPersonId
                    || (() => {
                        try {
                            const el = document.querySelector('.app-shell[data-app-id="chat"] .chat-private');
                            const cid = el?.dataset?.contactId || '';
                            if (cid.startsWith('private-')) return cid.slice('private-'.length);
                            return cid;
                        } catch (_) { return ''; }
                    })();
                const mode = payload.mode
                    || this.app?.state?.chat?.action?.mode
                    || 'calendar';
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('warning', '缺少联系人上下文', '请先进入私聊再拨打电话');
                    return;
                }
                this.toolkit?.island?.notify?.('info', '正在呼叫…', '语音通话');
                try {
                    const action = { action: 'detail', appId: 'chat', pageId: `call-voice-${aiPersonId}-${mode}` };
                    document.dispatchEvent(new CustomEvent('app:page-action', { detail: action, bubbles: true }));
                } catch (err) {
                    console.warn('[chat] triggerVoiceCall dispatch failed', err);
                }
            },

            /**
             * ★ v0.43 触发视频通话
             * ★ v0.67.x 修复:同样从 DOM 拿 aiPersonId 兜底
             */
            async triggerVideoCall(payload = {}) {
                const aiPersonId = payload.aiPersonId
                    || this.app?.state?.chat?.action?.aiPersonId
                    || (() => {
                        try {
                            const el = document.querySelector('.app-shell[data-app-id="chat"] .chat-private');
                            const cid = el?.dataset?.contactId || '';
                            if (cid.startsWith('private-')) return cid.slice('private-'.length);
                            return cid;
                        } catch (_) { return ''; }
                    })();
                const mode = payload.mode
                    || this.app?.state?.chat?.action?.mode
                    || 'calendar';
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('warning', '缺少联系人上下文', '请先进入私聊再拨打电话');
                    return;
                }
                this.toolkit?.island?.notify?.('info', '正在呼叫…', '视频通话');
                try {
                    const action = { action: 'detail', appId: 'chat', pageId: `call-video-${aiPersonId}-${mode}` };
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
                    // ★ v0.85 迁移到 AcModal
                    if (sdk.chatFavorites.has(user, aiPersonId, targetMode, messageId)) {
                        // 获取消息预览
                        const messages = sdk.chatMessages?.list
                            ? sdk.chatMessages.list(user, aiPersonId, targetMode)
                            : [];
                        const target = messages.find((m) => m.id === messageId);
                        const messagePreview = target?.content?.substring(0, 100) || '';
                        chatModalManager?.openUnfavoriteConfirm?.({
                            messagePreview: messagePreview,
                            onConfirm: async () => {
                                await sdk.chatFavorites.remove(user, aiPersonId, targetMode, messageId);
                                if (window.__chatFavoritedIds) {
                                    window.__chatFavoritedIds.delete(`${aiPersonId}|${targetMode}|${messageId}`);
                                }
                                window.__detailRenderTick && window.__detailRenderTick.value++;
                                this.toolkit?.island?.notify?.('info', '已取消收藏');
                            },
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
                            if (payload.conversationType === 'group') {
                                const g = sdk.chatGroups?.get?.(user, aiPersonId, targetMode)
                                    || sdk.chatGroups?.get?.(user, aiPersonId, 'calendar')
                                    || sdk.chatGroups?.get?.(user, aiPersonId, 'story');
                                return g?.name || '群聊';
                            }
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
                        sourceType: payload.conversationType === 'group' ? 'group' : 'private',
                        conversationId: aiPersonId,
                    });
                    if (window.__chatFavoritedIds) {
                        window.__chatFavoritedIds.add(`${aiPersonId}|${targetMode}|${messageId}`);
                    }
                    if (!payload.silentRerender) {
                        window.__detailRenderTick && window.__detailRenderTick.value++;
                    }
                    this.toolkit?.island?.notify?.('success', '已收藏', contactName);
                } catch (err) {
                    console.warn('[chat] favoriteMessage failed', err);
                    this.toolkit?.island?.notify?.('error', '收藏失败', err?.message || '');
                }
            },

            /**
             * ★ v0.85 群聊消息发送给AI
             *   - payload: { messageId, aiPersonId, mode, sender, conversationType, text, senderLabel }
             *   - 群聊时 aiPersonId = groupId
             *   - 将消息内容填入输入框,用户可选择直接发送或长按触发AI回复
             */
            sendMessageToAi(payload = {}) {
                const { messageId, aiPersonId, mode, text, senderLabel } = payload;
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('warning', '缺少群聊上下文');
                    return;
                }
                // 找到对应的群聊页面
                const chatGroup = document.querySelector('.app-shell[data-app-id="chat"] .chat-group');
                if (!chatGroup) {
                    this.toolkit?.island?.notify?.('warning', '未找到群聊页面');
                    return;
                }
                const messageInput = chatGroup.querySelector('#messageInput');
                if (!messageInput) {
                    this.toolkit?.island?.notify?.('warning', '未找到输入框');
                    return;
                }
                // 将消息内容填入输入框
                const textToSend = text || '';
                messageInput.innerHTML = escapeHtml(textToSend);
                // 将光标移到输入框
                messageInput.focus();
                /**
                 * ★ 这里以前是 `scrollIntoView({ block: 'center' })`。
                 *
                 * 输入框本来就贴在屏幕底部，「滚到视口正中」意味着浏览器要把
                 * 整个页面往上顶半屏 —— 手机壳模式下的表现就是「整台手机猛地
                 * 往上蹿一大截」。软键盘的让位由框架统一处理
                 * （src/index.js 的 --phone-keyboard-lift，抬到刚好够为止），
                 * 这里只要保证输入框在它自己的滚动容器里没被挡住就行。
                 */
                messageInput.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                this.toolkit?.island?.notify?.('info', '已填入输入框', senderLabel ? `来自: ${senderLabel}` : '请检查内容后发送');
            },

            /**
             * ★ v0.43 引用回复(写入 app.state.chat.action.replyingTo,渲染时显示 reply-preview)
             *  - payload: { messageId, aiPersonId, mode, text, sender, senderLabel }
             *  - 不需要持久化,只存内存;切走或发送后清掉
             */
            quoteMessage(payload = {}) {
                const app = this.app;
                const st = this._ensureChatActionState(app);
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
             *  - 用户和 AI 消息都可编辑(后续 AI 上下文会看到改动后的内容)
             *  - 保存后:走 sdk.chatMessages.update → 触发 __detailRenderTick 重画
             */
            async editMessage(payload = {}) {
                const { messageId, aiPersonId, mode, text, sender } = payload;
                if (!messageId || !aiPersonId) {
                    this.toolkit?.island?.notify?.('warning', '缺少消息上下文', 'messageId / aiPersonId 为空');
                    return;
                }
                const aiLabel = (() => {
                    try {
                        const snap = window.aiMeta?.getAiMeta?.(aiPersonId, mode);
                        return snap?.name || aiPersonId;
                    } catch (_) { return aiPersonId; }
                })();
                const isAiMsg = sender === 'ai';
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
                            // ★ 不写 editedAt — 编辑过的消息在 UI 上不显示「已编辑」标记,
                            //   AI 后续上下文也只看到改后的 content,等同于原生「原话覆写」
                            const updated = await sdk.chatMessages.update(messageId, { content: trimmed });
                            if (updated === null) {
                                this.toolkit?.island?.notify?.('error', '消息已被删除或存储失败');
                                return;
                            }
                            this.toolkit?.island?.notify?.('success', isAiMsg ? '已编辑 AI 消息' : '已保存', trimmed.length > 18 ? `${trimmed.slice(0, 18)}…` : trimmed);
                            this._triggerChatActionRerender();
                        } catch (err) {
                            console.warn('[chat] editMessage failed', err);
                            this.toolkit?.island?.notify?.('error', '保存失败', err?.message || '');
                        }
                    },
                });
            },

            /**
             * ★ v0.72 重roll 消息(气泡循环按钮,AI/用户消息都能用)
             *  - payload: { messageId, aiPersonId, mode, sender, conversationType, senderId }
             *  - 私聊 / 群聊都生效:
             *      · aiPersonId 字段在私聊 = 真实 AI 人设 ID
             *      · aiPersonId 字段在群聊 = groupId
             *  - sender: 'ai' → 删除该消息及之后所有消息,重新生成 AI 回复
             *  - sender: 'user' → 删除该用户消息之后所有消息(含最后 AI 回复),重新生成 AI 回复
             *  - 流程:
             *      1) 定位目标消息 → 找到"待删除起始点"
             *      2) 立即清 DOM 中后续消息气泡(先清视图,后端删库异步进行)
             *      3) 从剩余消息中找到触发 AI 的 userText
             *      4) 重算 contextRounds + 写回 contextPreview 缓存
             *      5) 调 AI 重新生成回复
             */
            async rerollMessage(payload = {}) {
                const messageId = String(payload?.messageId || '');
                const aiPersonId = String(payload?.aiPersonId || '');
                const mode = String(payload?.mode || 'calendar');
                const conversationType = String(payload?.conversationType || 'private');
                const senderId = String(payload?.senderId || '');
                if (!messageId || !aiPersonId) {
                    this.toolkit?.island?.notify?.('warning', '缺少消息上下文');
                    return;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.chatMessages?.list) {
                    this.toolkit?.island?.notify?.('error', '聊天存储未就绪');
                    return;
                }
                const user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
                if (!user) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户');
                    return;
                }

                // 1) 拉取当前会话所有消息,定位目标消息
                const allMessages = sdk.chatMessages.list(user, aiPersonId, mode) || [];
                const targetIdx = allMessages.findIndex((m) => m && String(m.id) === messageId);
                if (targetIdx === -1) {
                    this.toolkit?.island?.notify?.('warning', '找不到该消息');
                    return;
                }
                const targetMsg = allMessages[targetIdx];

                // 2) 确定删除起点:
                //    - AI 消息:从这条 AI 消息开始删(包含它)
                //    - 用户消息:从这条用户消息的「下一条 AI 消息」开始删
                let deleteFromIdx = targetIdx;
                if (payload.sender === 'user') {
                    for (let i = targetIdx + 1; i < allMessages.length; i++) {
                        if (allMessages[i]?.sender === 'ai') { deleteFromIdx = i; break; }
                        if (allMessages[i]?.type === 'system') { deleteFromIdx = i; break; }
                    }
                }

                // 3) 先算出「要删哪些 id」，DOM 和数据库用**同一份**清单。
                //    以前 DOM 删了 system 消息、数据库跳过 system 消息，于是重画一次
                //    那几条灰色系统提示就自己回来了 —— 看着像「删了个寂寞」。
                const toRemoveIds = [];
                for (let i = deleteFromIdx; i < allMessages.length; i++) {
                    if (allMessages[i] && allMessages[i].id) toRemoveIds.push(allMessages[i].id);
                }
                const idsToRemove = new Set(toRemoveIds);

                // 4) 立刻清视图 —— 用户按下重 roll 的那一刻后面的消息就该没了。
                //    带 id 的选择器有可能匹配不上（群聊/私聊的 id 字段名不一样、
                //    或者 detail 页刚重建还没写上 attribute），所以补一个不带 id 的兜底：
                //    同一时刻屏幕上只可能有一个会话详情页。
                const rootSelector = conversationType === 'group'
                    ? `.app-shell[data-app-id="chat"] .chat-group[data-group-id="${aiPersonId}"]`
                    : `.app-shell[data-app-id="chat"] .chat-private[data-contact-id="${aiPersonId}"]`;
                const fallbackSelector = conversationType === 'group'
                    ? '.app-shell[data-app-id="chat"] .chat-group'
                    : '.app-shell[data-app-id="chat"] .chat-private';
                const chatRoot = document.querySelector(rootSelector) || document.querySelector(fallbackSelector);
                if (chatRoot) {
                    const container = chatRoot.querySelector('.chat-messages');
                    if (container) {
                        // 不限定 .message-wrapper：卡片类消息（通话记录 / 红包 / 拍一拍）
                        // 的外层 class 各不相同，统一按 data-message-id 抓。
                        container.querySelectorAll('[data-message-id]').forEach((el) => {
                            const mid = el.getAttribute('data-message-id');
                            if (mid && idsToRemove.has(mid)) el.remove();
                        });
                    } else {
                        console.warn('[chat] rerollMessage .chat-messages 未找到', chatRoot);
                    }
                } else {
                    console.warn('[chat] rerollMessage chatRoot 未找到, conversationType=', conversationType, 'aiPersonId=', aiPersonId);
                }

                // 5) ★ 必须 await 删完再往下走。
                //    以前这里是 fire-and-forget 的 IIFE，紧接着就去调 AI；而
                //    callAiAndSplit 内部是**重新从数据库读历史**的 —— 删还没落地，
                //    AI 就会看到那条正准备被替换掉的旧回复，重 roll 出来的东西
                //    经常跟原来一模一样。删完再调，AI 看到的才是真正的「删除点之前」。
                for (const rid of toRemoveIds) {
                    try { await sdk.chatMessages.remove(rid); } catch (_) {}
                }
                // 删完立刻作废 renderer 缓存：否则切出去再回来会命中删除前的那份 HTML，
                // 被删的气泡原样复活（AGENTS.md §X.6 同款坑）。
                try { window.invalidateRendererCache?.('chat', null); } catch (_) {}

                // 6) 找 beforeList(删除点之前的内容,不含 system)
                const beforeList = allMessages.slice(0, deleteFromIdx).filter((m) => m && m.type !== 'system');

                // 6) 找触发 AI 的 userText + 群聊时要找 senderId(AI 成员 ID)
                //    群聊路径依赖 senderId 来调 AI API,如果为空则从消息历史中找
                let resolvedSenderId = senderId;
                if (conversationType === 'group' && !resolvedSenderId) {
                    // 从 targetIdx 往前找第一条 AI 消息的 senderId
                    for (let i = targetIdx; i >= 0; i--) {
                        if (allMessages[i]?.sender === 'ai' && allMessages[i]?.senderId) {
                            resolvedSenderId = allMessages[i].senderId;
                            break;
                        }
                    }
                    if (!resolvedSenderId) {
                        this.toolkit?.island?.notify?.('warning', '群聊找不到 AI 成员 ID');
                        return;
                    }
                }

                let userText = '';
                for (let i = beforeList.length - 1; i >= 0; i--) {
                    const m = beforeList[i];
                    if (m?.sender === 'user' && String(m.content || '').trim()) {
                        userText = String(m.content || '').trim();
                        break;
                    }
                    // 遇到 AI 消息就停止(这是触发 roll 的那条 AI,不再用它之前的内容)
                    if (m?.sender === 'ai') break;
                }
                if (!userText) {
                    this.toolkit?.island?.notify?.('warning', '没有可重roll 的上下文');
                    return;
                }

                // 7) 重算 contextRounds + 写回 contextPreview 缓存
                const realAiPersonId = (conversationType === 'group' && resolvedSenderId) ? resolvedSenderId : aiPersonId;
                try {
                    recomputeContextPreviewAfterReroll({
                        aiPersonId: realAiPersonId,
                        mode,
                        messages: beforeList,
                        oldSystemPrompt: payload?.oldSystemPrompt || '',
                        computeContextRoundsPrompt: (pid, msgs) => {
                            try {
                                const cfg = sdk?.rollingSummaries?.getRollingConfig?.(pid);
                                const ctxN = (cfg && Number(cfg.contextRounds) > 0) ? Number(cfg.contextRounds) : 20;
                                return this.computeContextRoundsPrompt(pid, msgs, ctxN);
                            } catch (_) { return this.computeContextRoundsPrompt(pid, msgs, 20); }
                        },
                    });
                } catch (recompErr) {
                    console.warn('[chat] rerollMessage recomputeContextPreview failed', recompErr);
                }

                // 8) 调 AI 重新生成回复。
                //    等待反馈跟普通发送一致：顶栏名字变成闪烁的「对方正在输入中」，
                //    不弹「正在重 roll…」的岛（用户就在这一页看着）。
                beginTyping(conversationType === 'group' ? 'group' : 'private', aiPersonId);

                if (conversationType === 'group' && resolvedSenderId) {
                    // 群聊路径
                    try {
                        // 带上 groupId：让 ai-service 在发送时现算并追加「群成员与职务」
                        // （群主 / 管理员 / 群昵称 + 可用的群管理格式）
                        const result = await callAiAndSplit({ aiPersonId: senderId, mode, userText, historyLimit: 12, groupId: aiPersonId });
                        if (!result || result.ok === false) {
                            this.toolkit?.island?.notify?.('error', '重roll 失败', result?.error?.slice(0, 200) || '');
                            return;
                        }
                        const aiMessages = result.messages || [];
                        const memberName = (() => {
                            try { const ai = sdk?.aiPersons?.get?.(senderId); return ai?.name || ai?.nickname || senderId; }
                            catch (_) { return senderId; }
                        })();
                        let written = 0;
                        for (const msg of aiMessages) {
                            try {
                                // 群管理动作不是消息，是动作：交给 group-admin-service 执行，
                                // 它自己会写一条群公告。不能当普通消息写进 chatMessages，
                                // 否则聊天流里会出现一条 "[群务]" 的空气泡。
                                if (msg.type === 'group_admin') {
                                    const svc = await import('./services/group-admin-service.js');
                                    await svc.applyGroupAdminActions({
                                        sdk, user, groupId: aiPersonId, mode,
                                        actorId: senderId, actions: [msg.groupAdminAction],
                                    });
                                    continue;
                                }
                                // 四叶草送礼。群里也允许 —— 礼物卡会落到**这个群**里，
                                // 但扣的是 senderId 那个成员自己的钱包。
                                if (msg.type === 'shop_gift_request') {
                                    const bridge = window.__shopGift;
                                    if (bridge?.aiGiftToUser && bridge.isReady?.()) {
                                        const res = await bridge.aiGiftToUser({
                                            aiPersonId: senderId, mode, ...(msg.shopGift || {}),
                                        });
                                        if (!res?.ok) console.warn('[chat-app] 群里 AI 送礼没成功：', res?.error);
                                    }
                                    continue;
                                }
                                let resolvedMsg = msg;
                                if (resolvedMsg.type === 'sticker') resolvedMsg = await _resolveAiStickerFromHistory(resolvedMsg, senderId, mode, beforeList);
                                resolvedMsg.sender = 'ai';
                                if (!resolvedMsg.senderName) resolvedMsg.senderName = memberName;
                                if (!resolvedMsg.timestamp) resolvedMsg.timestamp = Date.now() + written;
                                const saved = await sdk.chatMessages.add(user, aiPersonId, mode, {
                                    ...resolvedMsg, conversationType: 'group', conversationId: aiPersonId, senderId,
                                });
                                if (saved) written += 1;
                            } catch (saveErr) { console.warn('[chat] rerollMessage group save failed', saveErr); }
                        }
                        try {
                            if (sdk.chatGroups?.updateLastMessage) {
                                const last = aiMessages[aiMessages.length - 1];
                                await sdk.chatGroups.updateLastMessage(sdk, user, aiPersonId, mode, {
                                    content: last?.content || '[AI 回复]', timestamp: Date.now(),
                                    senderName: memberName, type: last?.type || 'text',
                                });
                            }
                        } catch (_) {}
                        try { if (typeof window.invalidateRendererCache === 'function') window.invalidateRendererCache('chat', aiPersonId); } catch (_) {}
                        try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                        if (written === 0) {
                            this.toolkit?.island?.notify?.('warning', '重roll 没写出内容', 'AI 返回为空');
                        }
                    } catch (err) {
                        console.warn('[chat] rerollMessage group send failed', err);
                        this.toolkit?.island?.notify?.('error', '重roll 失败', err?.message || '');
                    } finally {
                        endTyping('group', aiPersonId);
                    }
                    return;
                }

                // 私聊路径
                try {
                    const result = await this.sendMessageWithAi({ aiPersonId, mode, text: userText, silentIsland: true });
                    if (!result) this.toolkit?.island?.notify?.('error', '重roll 失败');
                } catch (err) {
                    console.warn('[chat] rerollMessage sendMessageWithAi failed', err);
                    this.toolkit?.island?.notify?.('error', '重roll 失败', err?.message || '');
                } finally {
                    endTyping('private', aiPersonId);
                }
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

            /**
             * ★ v0.87 record-mode-selector 页那两张卡的落点。
             * 这个 method 一直没实现 —— 页面还在、按钮还在，点了什么都不会发生
             * （invokeMethod 找不到就静默 resolve(null)）。
             * 主流程改成「选联系人时再选模式」之后这页基本不走了，但入口没删干净，
             * 补上实现，别让用户点进死胡同。
             */
            selectRecordMode(payload = {}) {
                const mode = payload?.mode === 'story' ? 'story' : 'calendar';
                try { setChatRecordMode(mode); } catch (_) { /* noop */ }
                document.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'detail', appId: 'chat', pageId: 'new-chat' },
                    bubbles: true,
                }));
            },

            /**
             * ★ v0.87 语音消息的「转文字」展开/收起。
             * 同样是有 UI 没实现 —— 气泡上那行「转文字」点下去毫无反应。
             * CSS 靠 `.voice-transcribe.expanded` 控制显示，这里只切 class。
             * 不走整页重渲染：转个文字把整个消息列表重画一遍会把滚动位置冲掉。
             */
            toggleVoiceTranscribe(payload = {}) {
                const messageId = String(payload?.messageId || '');
                if (!messageId) return;
                const root = document.querySelector('.app-shell[data-app-id="chat"]');
                const box = root?.querySelector(`.voice-transcribe[data-voice-id="${CSS.escape(messageId)}"]`);
                if (!box) return;
                box.classList.toggle('expanded');
                const label = box.querySelector('.voice-transcribe-toggle span');
                if (label) label.textContent = box.classList.contains('expanded') ? '收起' : '转文字';
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

            // ============================================================
            // 收藏左滑操作:分享 / 编辑 / 删除
            //   三个按钮都由 favorites-page.js 渲染成 data-app-action,
            //   framework 派发到这里。手势本身在框架层
            //   (src/core/components/swipe-actions.js)。
            //
            //   收藏分两类,处理方式不同:
            //     · type === 'conversation' —— 对话片段,存在
            //       app.state._conversationFavorites + localStorage
            //     · 其他 —— 单条收藏,存在 sdk.chatFavorites(IndexedDB)
            //   下面每个方法都要同时照顾这两条路径,漏一条就是「删了刷新又回来」。
            // ============================================================

            /** 从两个数据源里按 id 找一条收藏,顺带告诉调用方它是哪一类 */
            _findFavoriteById(favoriteId) {
                const id = String(favoriteId || '');
                if (!id) return null;
                // 对话片段(内存 + localStorage)
                const convList = Array.isArray(this.app?.state?._conversationFavorites)
                    ? this.app.state._conversationFavorites
                    : [];
                const conv = convList.find((f) => String(f?.id || f?.favoriteId) === id);
                if (conv) return { kind: 'conversation', record: conv };
                // 单条收藏(SDK)
                try {
                    const rec = window.settingsSdk?.chatFavorites?.get?.(id);
                    if (rec) return { kind: 'single', record: rec };
                } catch (_) {}
                return null;
            },

            /** 把对话片段收藏写回内存 + localStorage(两处都写,否则刷新会回滚) */
            _persistConversationFavorites(list) {
                if (!this.app.state) this.app.state = {};
                this.app.state._conversationFavorites = list;
                try {
                    localStorage.setItem('xiaoting::chat-conversation-favorites-v1', JSON.stringify(list));
                } catch (_) { /* 隐私模式 / 配额满 */ }
            },

            /** 左滑「分享」:把这条收藏转发给某个联系人 / 群 */
            async shareFavorite(payload = {}) {
                const found = this._findFavoriteById(payload?.favoriteId);
                if (!found) {
                    this.toolkit?.island?.notify?.('warning', '找不到这条收藏');
                    return;
                }
                const { kind, record } = found;
                // 复用已有的「转发选择目标」弹窗 —— 转发链路已经处理过
                // 文本 / 卡片 / 聊天记录三种载荷,这里不该再造一份。
                let messages = [];
                if (kind === 'conversation') {
                    messages = Array.isArray(record.messages) ? record.messages : [];
                } else {
                    messages = [{
                        id: record.messageId || record.id,
                        sender: record.sender || 'user',
                        senderName: record.senderName || '',
                        type: record.type || 'text',
                        content: record.content || record.summary || '',
                        timestamp: record.createdAt || Date.now(),
                    }];
                }
                if (!messages.length) {
                    this.toolkit?.island?.notify?.('warning', '这条收藏没有可分享的内容');
                    return;
                }
                try {
                    // 复用消息转发那条链路 —— 它已经处理好「选目标 + 生成转发卡片 + 落盘」，
                    // 收藏分享跟转发是同一件事，不该再写一遍。
                    const { openForwardTargetSelection } = await import('./chat-forward.js');
                    await openForwardTargetSelection({
                        mode: record.mode || 'calendar',
                        messageIds: messages.map((m) => m.id).filter(Boolean),
                        sourceMessages: messages,
                        sourceMeta: {
                            conversationType: record.sourceType || 'private',
                            conversationId: record.conversationId || record.sourceId || record.aiPersonId || '',
                            mode: record.mode || 'calendar',
                            conversationName: record.sourceName || '收藏',
                        },
                    });
                } catch (err) {
                    console.warn('[chat] shareFavorite failed', err);
                    this.toolkit?.island?.notify?.('error', '分享失败', err?.message || '');
                }
            },

            /** 左滑「编辑」:改这条收藏的正文(不动原消息 —— 收藏是快照) */
            editFavorite(payload = {}) {
                const found = this._findFavoriteById(payload?.favoriteId);
                if (!found) {
                    this.toolkit?.island?.notify?.('warning', '找不到这条收藏');
                    return;
                }
                const { kind, record } = found;
                const id = String(record.id || record.favoriteId);
                const current = kind === 'conversation'
                    ? String(record.firstMessage || record.sourceName || '')
                    : String(record.content || record.summary || '');
                chatModalManager.openEditReplyPrompt({
                    initial: {
                        title: record.sourceName || '收藏',
                        content: current,
                        source: 'custom',
                        active: true,
                    },
                    isCreate: false,
                    onSave: async (next) => {
                        const content = String(next?.content ?? '');
                        if (kind === 'conversation') {
                            const list = (this.app?.state?._conversationFavorites || []).map((f) => (
                                String(f?.id || f?.favoriteId) === id ? { ...f, firstMessage: content } : f
                            ));
                            this._persistConversationFavorites(list);
                        } else {
                            const updated = await window.settingsSdk?.chatFavorites?.updateById?.(id, { content });
                            if (!updated) {
                                this.toolkit?.island?.notify?.('warning', '保存失败', '这条收藏可能已被删除');
                                return;
                            }
                        }
                        this._triggerFavoritesRerender();
                        this.toolkit?.island?.notify?.('success', '已保存');
                    },
                });
            },

            /** 左滑「删除」:走顶层确认弹窗,确认后从对应数据源移除 */
            async deleteFavorite(payload = {}) {
                const found = this._findFavoriteById(payload?.favoriteId);
                if (!found) {
                    this.toolkit?.island?.notify?.('warning', '找不到这条收藏');
                    return;
                }
                const { kind, record } = found;
                const id = String(record.id || record.favoriteId);
                const doDelete = async () => {
                    if (kind === 'conversation') {
                        const list = (this.app?.state?._conversationFavorites || [])
                            .filter((f) => String(f?.id || f?.favoriteId) !== id);
                        this._persistConversationFavorites(list);
                        // demo 数组也同步一份,否则渲染时又会把它合并回来
                        try {
                            if (Array.isArray(window.__chatDemoFavorites)) {
                                const idx = window.__chatDemoFavorites
                                    .findIndex((f) => String(f?.id || f?.favoriteId) === id);
                                if (idx >= 0) window.__chatDemoFavorites.splice(idx, 1);
                            }
                        } catch (_) {}
                    } else {
                        const ok = await window.settingsSdk?.chatFavorites?.removeById?.(id);
                        if (!ok) {
                            this.toolkit?.island?.notify?.('warning', '删除失败', '这条收藏可能已经不在了');
                            return;
                        }
                    }
                    this._triggerFavoritesRerender();
                    this.toolkit?.island?.notify?.('success', '已取消收藏');
                };
                const preview = kind === 'conversation'
                    ? String(record.firstMessage || record.sourceName || '')
                    : String(record.content || record.summary || '');
                chatModalManager.openUnfavoriteConfirm({
                    messagePreview: preview.substring(0, 100),
                    subtitle: '确定要从收藏中移除这条内容吗？原始消息不受影响。',
                    onConfirm: () => { doDelete(); },
                });
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
                    // ★ v0.85:优先从 record.contactName 拿(卡片创建时就带),其次从 DOM 拿
                    const conversationName = record.contactName
                        || chatPrivate?.getAttribute('data-conversation-name')
                        || '';

                    // 4. 弹 ChatRecordDetailModal(显示完整消息列表)
                    const { chatModalManager } = await import('./components/chat-modal-registry.js');
                    chatModalManager.openChatRecordDetail({
                        title: record.title || '聊天记录',
                        messages,
                        sourceLabel: `来自 ${conversationName}`,
                        contactName: conversationName, // ★ v0.85:用于显示 AI 发送者真实名字
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
             * ★ v0.67.x 初始化通话页面交互(call-voice-xxx / call-video-xxx)
             *   - 内部逻辑在 call-page.js 的 initCallPage() 里
             *   - 这里只做 wrapper + 异步 import
             */
            async initCallPage(contactId, callType = 'voice') {
                try {
                    const mod = await import('./pages/call-page.js');
                    if (typeof mod.initCallPage === 'function') {
                        mod.initCallPage(this.app, contactId, callType);
                    }
                } catch (err) {
                    console.warn('[chat-app] initCallPage import failed:', err);
                }
            },

            // ─── 群聊小游戏 ────────────────────────────────────────────
            //
            // 这一组 method 是「界面 → 引擎」的唯一通道。它们只做三件事：
            // 收集用户意图、调 games/index.js 的 API、触发重画。
            // 规则、AI、节奏全在 games/ 里，这里不做任何游戏逻辑。
            //
            // ⚠️ 所有会改变**页面结构**的操作都要走 `_rerenderGameDetail()`
            //    （invalidate + syncNow 二段式）。对局进行中的实时更新**不走**
            //    这里 —— 那条路在 games/live-view.js，走区域补丁，
            //    否则每收到一句 AI 发言就整页重画，滚动和输入都会被打断。

            /** 设置页：改一个字段（模式 / API / 词库类型…）。 */
            gameSetupPatch(payload = {}) {
                updateSetupDraft(payload);
                this._rerenderGameDetail();
            },

            // ─── 做一个新游戏 ──────────────────────────────────────────
            //
            // 产物是**提示词**，不是代码：玩法逻辑是状态机 + AI 决策 + 异常兜底，
            // 让模型一次写对的概率不高，而且写错了很难自动发现。用户拿提示词去
            // 自己惯用的模型里写、改、重试，回来上传。上传时做静态体检
            // （games/custom-games.js），把最容易犯的四个错拦下来。

            /** 表单里改一个字段（选项卡 / 开关都走它）。 */
            setGameMakerField(payload = {}) {
                if (!payload.field) return;
                updateMakerDraft({ [payload.field]: payload.value });
                this._rerenderGameDetail();
            },

            /** 换一步。 */
            setGameMakerStep(payload = {}) {
                // 输入框的值只在 DOM 里（data-app-action 是渲染时写死的字符串），
                // 换步之前先把这一屏的输入收走，否则用户填的名字会丢
                this._collectGameMakerInputs();
                setMakerStep(payload.step);
                this._rerenderGameDetail();
            },

            resetGameMaker() {
                resetMakerDraft();
                this._rerenderGameDetail();
                this.toolkit?.island?.notify?.('info', '已清空', '重新填一份');
            },

            /** 把当前这一屏的 input / textarea 收进草稿 */
            _collectGameMakerInputs() {
                try {
                    const shell = document.querySelector('.app-shell[data-app-id="chat"]');
                    if (!shell) return;
                    const patch = {};
                    shell.querySelectorAll('[data-cgm-field]').forEach((el) => {
                        const key = el.getAttribute('data-cgm-field');
                        if (!key) return;
                        patch[key] = el.type === 'number' ? Number(el.value) : String(el.value || '');
                    });
                    if (Object.keys(patch).length) updateMakerDraft(patch);
                } catch (_) { /* 页面已经换掉了就算了 */ }
            },

            async copyGamePrompt() {
                this._collectGameMakerInputs();
                const text = buildDraftPrompt();
                try {
                    await navigator.clipboard.writeText(text);
                    this.toolkit?.island?.notify?.('success', '提示词已复制', `${text.length} 字，粘给 AI 就行`);
                } catch (_) {
                    this.toolkit?.island?.notify?.('warning', '复制失败', '浏览器不让读写剪贴板，用「存成 .md」吧');
                }
            },

            downloadGamePrompt() {
                this._collectGameMakerInputs();
                const d = getMakerDraft();
                const text = buildDraftPrompt();
                const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${d.gameId || 'my-game'}-提示词.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                this.toolkit?.island?.notify?.('success', '已下载');
            },

            /** 选一个 .js 文件装上。 */
            uploadGameFile() {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.js,text/javascript,application/javascript';
                input.onchange = async () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    let code = '';
                    try { code = await file.text(); } catch (err) {
                        this.toolkit?.island?.notify?.('error', '读不了这个文件', String(err?.message || err));
                        return;
                    }
                    await this._installGameCode(code, file.name);
                };
                input.click();
            },

            /** 装一个现成的示例，让用户先看到效果再照着改。 */
            async installSampleGame() {
                const { buildSampleGameCode } = chatGames;
                await this._installGameCode(buildSampleGameCode(), 'show-of-hands.js');
            },

            async _installGameCode(code, fileName) {
                const result = await chatGames.installAndPersistGame(code, { fileName, allowReplace: true });
                if (!result.success) {
                    // 把体检出的问题一条条说清楚 —— 只说「装不上」用户没法改
                    const detail = (result.errors || [result.error]).slice(0, 3).join('；');
                    this.toolkit?.island?.notify?.('error', '装不上', detail);
                    console.warn('[chat-games] 安装失败', result);
                    return;
                }
                if (result.warnings?.length) {
                    console.warn('[chat-games] 安装警告', result.warnings);
                }
                this._rerenderGameDetail();
                this.toolkit?.island?.notify?.(
                    'success',
                    `「${result.name}」装好了`,
                    result.warnings?.length ? `有 ${result.warnings.length} 条提醒，见控制台` : '每个群聊的小游戏页都能开了',
                );
            },

            removeCustomGame(payload = {}) {
                if (!payload.gameId) return;
                const r = chatGames.removeCustomGame(payload.gameId);
                this._rerenderGameDetail();
                this.toolkit?.island?.notify?.(r.success ? 'success' : 'warning', r.success ? '已删除' : (r.error || '删不掉'));
            },

            /** 设置页：勾选 / 取消一个 AI。 */
            gameSetupToggleAi(payload = {}) {
                if (!payload.aiId) return;
                toggleSetupAi(payload.aiId);
                this._rerenderGameDetail();
            },

            /** 设置页：切一条规则开关。 */
            gameSetupToggleRule(payload = {}) {
                if (!payload.key) return;
                toggleSetupRule(payload.key);
                this._rerenderGameDetail();
            },

            /** 设置页：开始游戏。 */
            async gameStart() {
                const draft = getSetupDraft();
                if (!draft) return;

                // 「给 AI 的额外交代」是 textarea，值只在 DOM 里 ——
                // data-app-action 是渲染时就写死的字符串，读不到用户后来打的字
                try {
                    const el = document.querySelector('.app-shell[data-app-id="chat"] [data-cg-setup-prompt="1"]');
                    if (el) draft.customPrompt = String(el.value || '').trim();
                } catch (_) {}

                const setup = {
                    customPrompt: draft.customPrompt || '',
                    ...(draft.rules || {}),
                };

                // 卧底可以让 AI 现出题。失败会自动回落到本地词库，不阻塞开局
                if (draft.gameId === chatGames.GAME_IDS.UNDERCOVER) {
                    setup.wordType = draft.wordType;
                    if (draft.aiWords) {
                        this.toolkit?.island?.notify?.('info', '正在出题…', 'AI 在想一对词');
                        try {
                            setup.wordPair = await chatGames.prepareUndercoverWords(
                                draft.apiRef, draft.groupId, draft.wordType,
                            );
                        } catch (err) {
                            console.warn('[chat-app] AI 出题失败，用本地词库', err);
                        }
                    }
                }

                // 开新局会顶掉这个群原来那一局。原来那局如果还在跑，
                // 先明确放弃掉，免得两个 session 同时被调度器推进
                const running = chatGames.getRunningGame(draft.groupId);
                if (running) chatGames.abortGame(draft.groupId);

                const result = chatGames.startGame({
                    gameId: draft.gameId,
                    groupId: draft.groupId,
                    aiIds: draft.aiIds,
                    userPlays: draft.userPlays,
                    apiRef: draft.apiRef,
                    setup,
                });
                if (!result.ok) {
                    this.toolkit?.island?.notify?.('warning', '开不了局', result.error || '');
                    return;
                }
                clearSetupDraft();
                // 对局期间告诉 AI「现在在打游戏」（私聊那边的语气会跟着变）
                try { window.__chatContextMode?.setMode?.('game'); } catch (_) {}
                this._openGamePage(draft.groupId);
            },

            /** 对局页：用户点了操作区里的按钮。 */
            async gameUserAction(payload = {}) {
                const groupId = this._currentGameGroupId();
                if (!groupId) return;
                await chatGames.submitUserAction(groupId, payload);
            },

            /** 对局页：多选（丘比特连情侣）。 */
            gameSelectPlayer(payload = {}) {
                const groupId = this._currentGameGroupId();
                if (!groupId || !payload.playerId) return;
                chatGames.togglePlayerSelection(groupId, payload.playerId, 2);
            },

            /** 对局页：女巫面板在「用药」和「选毒谁」之间切。 */
            gameSetWitchMode(payload = {}) {
                const groupId = this._currentGameGroupId();
                if (!groupId) return;
                chatGames.setWitchMode(groupId, payload.mode || '');
            },

            /** 对局页：某一步出错后重试。 */
            gameRetryStep() {
                const groupId = this._currentGameGroupId();
                if (!groupId) return;
                chatGames.retryStep(groupId);
            },

            /** 对局页：正常结束（写战绩卡 + 记排行榜）。 */
            async gameFinish() {
                const groupId = this._currentGameGroupId();
                if (!groupId) return;
                await chatGames.finishGame(groupId);
                try { window.__chatContextMode?.setMode?.('chat'); } catch (_) {}
                // 战绩卡是一条新的群消息，群聊页要重读
                try { window.invalidateRendererCache?.('chat', groupId); } catch (_) {}
                this._rerenderGameDetail();
            },

            /** 对局页：放弃这一局（不记战绩、不发卡）。 */
            gameAbort() {
                const groupId = this._currentGameGroupId();
                if (!groupId) return;
                chatGames.abortGame(groupId);
                try { window.__chatContextMode?.setMode?.('chat'); } catch (_) {}
                this.closeDetail();
            },

            /**
             * 对局页：返回。
             *
             * ★ 只是收起界面，**不结束对局**。这正是这次要解决的核心需求：
             *   狼人杀夜里流程长，用户去别的 App 聊会儿天，回来接着玩。
             *   引擎在模块级调度器上跑，跟这个页面在不在完全无关。
             */
            closeGamePage() {
                chatGames.flushSessions();
                this.closeDetail();
            },

            /** 排行榜切 Tab。 */
            gameLeaderboardTab(payload = {}) {
                setLeaderboardTab(payload.key || 'all');
                this._rerenderGameDetail();
            },

            /**
             * 群聊里点战绩卡 → 开详情页。
             *
             * 走 detail 页而不是弹窗：名单可能有 12 个人，弹窗里要滚，
             * 而这个内容是「看完就走」的，全屏更合适。
             */
            openGameRecordDetail(payload = {}) {
                if (!payload.messageId) return;
                document.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'detail', appId: 'chat', pageId: `game-record-${payload.messageId}` },
                    bubbles: true,
                }));
            },

            /** 当前对局页是哪个群。detail 页 id 是 `game-play-{groupId}`。 */
            _currentGameGroupId() {
                try {
                    const el = document.querySelector('.app-shell[data-app-id="chat"] .cg-page[data-cg-group]');
                    if (el) return el.getAttribute('data-cg-group') || '';
                } catch (_) {}
                return '';
            },

            _openGamePage(groupId) {
                document.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: { action: 'detail', appId: 'chat', pageId: `game-play-${groupId}` },
                    bubbles: true,
                }));
            },

            /**
             * 重画当前 detail 页。
             *
             * chat-app 的 detail renderer 是 async，单独 `++__detailRenderTick`
             * 会命中 HTML 缓存拿到旧内容 —— 必须 invalidate + syncNow 二段式
             * （framework-总览 §8）。
             */
            _rerenderGameDetail() {
                try { window.invalidateRendererCache?.('chat', null); } catch (_) {}
                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
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
                // ★ v0.85:从 chatGroups.get 拿群名称,用于显示 AI 发送者名字
                let conversationName = '存档详情';
                if (archive.groupId) {
                    try {
                        const sdk = window.settingsSdk;
                        const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                        const group = sdk?.chatGroups?.get?.(user, archive.groupId, archive.mode || 'calendar');
                        conversationName = group?.name || '群聊';
                    } catch (_) {}
                }
                chatModalManager.openChatRecordDetail({
                    title: archive.name || '存档详情',
                    messages,
                    sourceLabel: `封存于 ${formatDateShort(archive.createdAt)} · ${archive.messageCount} 条消息`,
                    contactName: conversationName, // ★ v0.85:用于显示发送者真实名字
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
            //   - _triggerRollingCompress          (K 链已移除 2026-08-09,占位留作历史索引)
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
            // ★ v0.68 故事概要管理 methods (故事管理主页使用)
            //   故事模式无层级管理,每个故事对应 1 份概要。
            //   storySummary.storyId 可空:
            //     · 空 = 手动撰写的概要(用户自己写「当前情提要」)
            //     · 非空 = 绑定到 storyArchive.id 的概要(AI 从存档提取生成)
            //
            //   methods:
            //     - openStorySummaryEditModal(payload)        弹 SummaryEditModal
            //     - extractStorySummary(payload)              AI 从存档/当前会话 提取概要
            //     - saveStorySummary(payload)                 保存/覆盖 storySummary
            //     - deleteStorySummary(payload)               删除 storySummary(走确认弹窗)
            //     - addStorySummaryAsReplyPrompt(payload)     注入到 replyPrompts
            // ============================================================

            /**
             * ★ v0.68 通过 summaryId 直接拿 storySummary
             */
            _getStorySummaryById(aiPersonId, summaryId) {
                const sdk = window.settingsSdk;
                if (!sdk?.storySummaries?.get || !aiPersonId || !summaryId) return null;
                return sdk.storySummaries.get(aiPersonId, summaryId) || null;
            },

            /**
             * ★ v0.68 通过 storyArchive.id 找到对应的 storySummary
             *   (1:1 绑定:storyId === archiveId)
             */
            _getStorySummaryByArchiveId(aiPersonId, archiveId) {
                const sdk = window.settingsSdk;
                if (!sdk?.storySummaries?.list || !aiPersonId || !archiveId) return null;
                const list = sdk.storySummaries.list(aiPersonId) || [];
                return list.find((s) => s && s.storyId === archiveId) || null;
            },

            /**
             * ★ v0.68 打开故事概要的编辑弹窗(三种入口,根据 payload 区分)
             *   入口 A: payload = { aiPersonId, summaryId }              → 编辑现有概要
             *   入口 B: payload = { aiPersonId, archiveId, archiveName } → 从存档生成概要
             *   入口 C: payload = { aiPersonId }                         → 新增空白概要(手动撰写)
             *
             *   弹窗内容:
             *     - 「生成概要」按钮 → 调 extractStorySummary 触发 AI(入口 B/C 都生效)
             *     - 「保存概要」按钮 → 调 saveStorySummary 落盘
             */
            async openStorySummaryEditModal(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('error', '参数错误', '缺少 aiPersonId');
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.storySummaries) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }

                // ====== 入口 A:编辑现有概要 ======
                if (payload.summaryId) {
                    const summary = this._getStorySummaryById(aiPersonId, payload.summaryId);
                    if (!summary) {
                        this.toolkit?.island?.notify?.('error', '概要不存在', '可能被删除');
                        return null;
                    }
                    return this._openStorySummaryModalForEdit({
                        aiPersonId,
                        summary,
                        archive: summary.storyId
                            ? sdk.storyArchives?.get?.(summary.storyId) || null
                            : null,
                        archiveName: payload.archiveName || '',
                    });
                }

                // ====== 入口 B:从存档生成概要 ======
                if (payload.archiveId) {
                    const archiveId = String(payload.archiveId || '');
                    const archive = sdk.storyArchives?.get?.(archiveId);
                    if (!archive) {
                        this.toolkit?.island?.notify?.('error', '故事存档不存在', '可能被删除');
                        return null;
                    }
                    // 找已有的(绑这个 archiveId 的概要)
                    const summary = this._getStorySummaryByArchiveId(aiPersonId, archiveId);
                    return this._openStorySummaryModalForEdit({
                        aiPersonId,
                        summary,
                        archive,
                        archiveName: payload.archiveName || archive.name || '',
                    });
                }

                // ====== 入口 C:新增空白概要(手动撰写) ======
                return this._openStorySummaryModalForEdit({
                    aiPersonId,
                    summary: null,
                    archive: null,
                    archiveName: '',
                });
            },

            /**
             * ★ v0.68 内部 helper:统一打开 SummaryEditModal 的逻辑
             *   三种入口共用:传入 archive + summary(null/有) 决定 UI 行为
             */
            async _openStorySummaryModalForEdit({ aiPersonId, summary, archive, archiveName }) {
                const sdk = window.settingsSdk;
                const aiPerson = sdk.aiPersons?.get?.(aiPersonId) || null;
                const aiName = aiPerson?.name || aiPersonId;
                const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.() || null;
                const userName = defaultUser?.name || defaultUser?.chineseName || '用户';
                const aiPersonaSummary = this._buildAiPersonaSummary(aiPerson);
                const userPersonaSummary = this._buildUserPersonaSummary(defaultUser);

                // dateRange / messageCount / 标题
                const dateRange = archive
                    ? {
                        start: this._toDateKey(archive.createdAt),
                        end: this._toDateKey(archive.createdAt),
                    }
                    : { start: '', end: '' };
                const messageCount = summary?.messageCount
                    || (archive ? (Array.isArray(archive.messages) ? archive.messages.length : 0) : 0);

                // 标题:
                //   - 入口 A:用 summary.title
                //   - 入口 B:用 archiveName 兜底
                //   - 入口 C:留空,让用户起名
                const initialTitle = summary?.title || archiveName || '';

                chatModalManager.openSummaryEdit({
                    mode: 'story',
                    initialTitle,
                    initialContent: summary?.content || '',
                    dateRange,
                    messageCount,
                    defaultAsPrompt: false,
                    aiPersonaSummary,
                    userPersonaSummary,
                    // 保存:编辑现有 summary,或新建
                    onSave: async (next) => {
                        try {
                            await this.saveStorySummary({
                                aiPersonId,
                                summaryId: summary?.id || '',
                                archiveId: archive?.id || '',
                                title: next.title,
                                content: next.content,
                                messageCount: next.messageCount,
                            });
                        } catch (err) {
                            console.error('[chat-app] openStorySummaryEditModal save failed', err);
                            this.toolkit?.island?.notify?.('error', '保存失败', err?.message || '');
                        }
                    },
                    // 生成:从 archive / 当前会话提取
                    onGenerate: async (genPayload) => {
                        const inst = _getCurrentSummaryEditInstance();
                        if (!inst) return;
                        inst.isGenerating = true;
                        inst.errorMsg = '';
                        try {
                            const result = await this.extractStorySummary({
                                aiPersonId,
                                archive, // null = 走「当前会话」
                                archiveName,
                                aiName,
                                userName,
                                suggestedTitle: genPayload?.title,
                            });
                            if (result.ok && result.content) {
                                inst.onGenerateSuccess({
                                    content: result.content,
                                    title: result.title || genPayload?.title || (archiveName ? `${archiveName}概要` : '故事概要'),
                                });
                                this.toolkit?.island?.notify?.('success', '概要已生成', '请确认后保存');
                            } else {
                                inst.onGenerateError(result.error || '生成失败，请重试');
                                this.toolkit?.island?.notify?.('warning', '生成失败', result.error || '');
                            }
                        } catch (err) {
                            console.error('[chat-app] openStorySummaryEditModal generate failed', err);
                            inst.onGenerateError('网络错误，请重试');
                            this.toolkit?.island?.notify?.('error', '生成失败', err?.message || '');
                        }
                    },
                });
                return true;
            },

            /**
             * ★ v0.68 从素材源(存档 / 当前会话) 提取概要(AI 生成)
             *   payload: { aiPersonId, archive, archiveName, aiName, userName, suggestedTitle, mode }
             *     · archive 有 → 从 archive.messages 快照提取
             *     · archive 无 → 从当前故事会话 chatMessages.list 提取
             *   返回: { ok, content, title, error? }
             */
            async extractStorySummary(payload = {}) {
                const {
                    aiPersonId,
                    archive,
                    archiveName,
                    aiName,
                    userName,
                    suggestedTitle,
                    mode = 'story',
                } = payload;
                if (!aiPersonId) return { ok: false, error: '缺少 aiPersonId' };

                // 拿消息源
                let messages = [];
                let sourceLabel = '';
                if (archive && Array.isArray(archive.messages) && archive.messages.length > 0) {
                    messages = archive.messages;
                    sourceLabel = archive.name || archiveName || '故事存档';
                } else {
                    // 兜底:从当前故事会话读
                    const sdk = window.settingsSdk;
                    try {
                        messages = sdk?.chatMessages?.list
                            ? (sdk.chatMessages.list(null, aiPersonId, mode) || [])
                            : [];
                    } catch (_) {}
                    sourceLabel = '当前故事会话';
                }
                if (messages.length === 0) {
                    return { ok: false, error: '暂无对话内容可提炼,请先聊几句或封存当前聊天' };
                }
                const apiSdk = window.__apiSdk;
                if (!apiSdk) return { ok: false, error: 'API SDK 未加载' };
                const apiKeySdk = apiSdk.apiKeySdk;
                let activeKey = null;
                if (apiKeySdk) {
                    const enabled = apiKeySdk.listEnabled?.() || [];
                    const all = apiKeySdk.list?.() || [];
                    activeKey = enabled[0] || all[0] || null;
                }
                if (!activeKey?.apiKey) {
                    console.warn('[chat-app] extractStorySummary: no apiKey. apiSdk=', Object.keys(apiSdk || {}));
                    return { ok: false, error: '未配置 API Key,请先在设置中添加' };
                }

                const messagesText = this._formatDayMessagesForPrompt(messages, aiName);
                const titleHint = suggestedTitle || archiveName || '故事概要';
                const systemPrompt = `你是故事概要生成助手。请根据以下故事对话记录,生成一段简洁准确的故事概要。

=== AI 人设 ===
名字: ${aiName || '未知'}

=== 用户人设 ===
名字: ${userName || '用户'}

=== 素材来源 ===
${sourceLabel}

=== 对话记录 ===
${messagesText || '(无对话记录)'}

请生成一段 150-300 字的故事概要,包括:
1. 故事发生在什么场景 / 时代背景
2. 主要角色和关系
3. 核心剧情走向(起承转合 / 关键转折点)
4. 故事的情感基调和主题
5. 是否有未完结的伏笔 / 后续线索

直接输出概要正文,不要加前缀说明。语言风格可以稍微文学化一点,适合作为故事存档的简短回顾。`;

                let apiResult;
                try {
                    apiResult = await apiSdk.executeApiRequest({
                        apiKeyId: activeKey.id,
                        endpoint: 'chat/completions',
                        method: 'POST',
                        body: {
                            messages: [{ role: 'user', content: systemPrompt }],
                            temperature: 0.7,
                            max_tokens: 800,
                        },
                        timeout: 60000,
                        source: 'chat-app',
                        note: '故事概要',
                    });
                } catch (err) {
                    return { ok: false, error: `网络错误: ${err?.message || '连接失败'}` };
                }
                if (!apiResult?.success) {
                    const status = apiResult?.statusCode ? `HTTP ${apiResult.statusCode} ` : '';
                    return { ok: false, error: `${status}${apiResult?.error || 'API 调用失败'}` };
                }
                const data = apiResult.data;
                const content = data?.choices?.[0]?.message?.content
                    || data?.content?.[0]?.text
                    || data?.candidates?.[0]?.content?.parts?.[0]?.text
                    || '';
                if (!content.trim()) return { ok: false, error: 'AI 返回内容为空' };
                return { ok: true, content: content.trim(), title: titleHint };
            },

            /**
             * ★ v0.68 保存(覆盖)故事概要到 aiPerson.storySummaries
             *   payload: { aiPersonId, summaryId?, archiveId?, title, content, messageCount }
             *   三种入口:
             *     - summaryId 有 → 更新现有 summary(覆盖)
             *     - summaryId 无 + archiveId 有 → 创建 summary 并绑定到 archiveId
             *       · 但若已有 archiveId 绑定的 summary(1:1),则更新那个
             *     - summaryId 无 + archiveId 无 → 创建空白 summary(storyId 为空)
             */
            async saveStorySummary(payload = {}) {
                const sdk = window.settingsSdk;
                if (!sdk?.storySummaries) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                const aiPersonId = String(payload.aiPersonId || '');
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('error', '参数错误', '缺少 aiPersonId');
                    return null;
                }
                const summaryId = String(payload.summaryId || '');
                const archiveId = String(payload.archiveId || '');
                const title = String(payload.title || '故事概要').trim();
                const content = String(payload.content || '');
                const messageCount = Number(payload.messageCount) || 0;
                if (!title) {
                    this.toolkit?.island?.notify?.('warning', '概要标题不能为空');
                    return null;
                }

                const patch = {
                    title,
                    content,
                    messageCount,
                    asPrompt: { active: false, order: 0, source: 'story-summary' },
                };
                let record = null;
                let targetSummaryId = summaryId;

                // 优先级 1:summaryId 明确 → update
                if (summaryId) {
                    record = await sdk.storySummaries.update(aiPersonId, summaryId, patch);
                } else if (archiveId) {
                    // 优先级 2:有 archiveId,查 1:1 绑定的 summary
                    const existing = this._getStorySummaryByArchiveId(aiPersonId, archiveId);
                    if (existing) {
                        record = await sdk.storySummaries.update(aiPersonId, existing.id, patch);
                        targetSummaryId = existing.id;
                    } else {
                        // 优先级 3:新建 + 绑定
                        record = await sdk.storySummaries.add(aiPersonId, {
                            ...patch,
                            storyId: archiveId,
                        });
                    }
                } else {
                    // 优先级 4:全新手写(storyId 留空)
                    record = await sdk.storySummaries.add(aiPersonId, patch);
                }
                if (!record) {
                    this.toolkit?.island?.notify?.('warning', '保存失败');
                    return null;
                }
                this.toolkit?.island?.notify?.('success', '已保存概要', record.title);
                // 二段式重画(AGENTS.md §32)
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                try {
                    window.dispatchEvent(new CustomEvent('chat:summary-updated', {
                        detail: {
                            aiPersonId,
                            summaryId: record.id,
                            source: 'story',
                            archiveId: archiveId || undefined,
                        },
                    }));
                } catch (_) {}
                return record;
            },

            /**
             * ★ v0.68 删除故事概要(走顶层确认弹窗)
             *   payload: { aiPersonId, summaryId }
             */
            async deleteStorySummary(payload = {}) {
                const sdk = window.settingsSdk;
                if (!sdk?.storySummaries) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                const aiPersonId = String(payload.aiPersonId || '');
                const summaryId = String(payload.summaryId || '');
                if (!aiPersonId || !summaryId) return null;
                const existing = this._getStorySummaryById(aiPersonId, summaryId);
                if (!existing) {
                    this.toolkit?.island?.notify?.('info', '该概要已不存在');
                    return null;
                }
                const title = existing.title || '故事概要';
                if (typeof window.__phoneConfirm?.request !== 'function') {
                    this.toolkit?.island?.notify?.('error', '确认弹窗未加载');
                    return null;
                }
                window.__phoneConfirm.request({
                    title: '删除故事概要?',
                    text: `「${title}」将被删除,无法恢复`,
                    confirmLabel: '删除',
                    danger: true,
                    onConfirm: async () => {
                        const ok = await sdk.storySummaries.remove(aiPersonId, summaryId);
                        if (!ok) {
                            this.toolkit?.island?.notify?.('warning', '删除失败');
                            return;
                        }
                        this.toolkit?.island?.notify?.('success', '概要已删除', title);
                        // 二段式重画
                        try {
                            if (typeof window.invalidateRendererCache === 'function') {
                                window.invalidateRendererCache('chat', null);
                            }
                        } catch (_) {}
                        try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                        try {
                            window.dispatchEvent(new CustomEvent('chat:summary-updated', {
                                detail: { aiPersonId, summaryId, source: 'story', deleted: true },
                            }));
                        } catch (_) {}
                    },
                    onCancel: () => {},
                });
                return true;
            },

            /**
             * ★ v0.68 把故事概要注入到回复提示词(replyPrompts)
             *   payload: { aiPersonId, summaryId }
             *   - 默认 active=true
             *   - 去重:sourceStorySummaryId === summaryId 即视为重复
             *   - 注入后,AI 下次回复会参考这份概要
             */
            async addStorySummaryAsReplyPrompt(payload = {}) {
                const sdk = window.settingsSdk;
                if (!sdk?.storySummaries || !sdk?.replyPrompts) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                const aiPersonId = String(payload.aiPersonId || '');
                const summaryId = String(payload.summaryId || '');
                if (!aiPersonId || !summaryId) return null;
                const summary = this._getStorySummaryById(aiPersonId, summaryId);
                if (!summary) {
                    this.toolkit?.island?.notify?.('warning', '该概要已不存在');
                    return null;
                }
                // 去重检查
                const existingList = sdk.replyPrompts.list(aiPersonId) || [];
                const dup = existingList.find((p) => p && p.sourceStorySummaryId === summaryId);
                if (dup) {
                    this.toolkit?.island?.notify?.('info', '已应用到回复提示词', dup.title || '该条目');
                    return null;
                }
                const title = summary.title || '故事概要';
                const content = `【故事概要】${title}\n\n${summary.content || ''}`;
                const created = await sdk.replyPrompts.add(aiPersonId, {
                    title,
                    content,
                    source: 'story-summary',
                    active: true,
                    sourceStorySummaryId: summaryId,
                });
                if (!created) {
                    this.toolkit?.island?.notify?.('warning', '注入失败');
                    return null;
                }
                this.toolkit?.island?.notify?.('success', '已应用到回复提示词', title);
                // 二段式重画
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                return created;
            },

            /**
             * ★ v0.68 timestamp → YYYY-MM-DD(本地时区)
             */
            _toDateKey(ts) {
                const t = Number(ts) || Date.now();
                const d = new Date(t);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
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

                // 不弹 SummaryRangeModal(范围固定 = 当天 1 天),直接弹 SummaryEditModal
                chatModalManager.openSummaryEdit({
                    mode: 'calendar',
                    initialTitle: `${dateKey} 聊天概要`,
                    // ★ v0.66:initialContent = 空,textarea 初始为空等 AI 生成
                    initialContent: '',
                    dateRange: { start: dateKey, end: dateKey },
                    messageCount: dayMessages.length,
                    defaultAsPrompt: false,
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
                const { aiName, userName, dateRange, messages } = opts;
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

                let apiResult;
                try {
                    apiResult = await apiSdk.executeApiRequest({
                        apiKeyId: activeKey.id,
                        endpoint: 'chat/completions',
                        method: 'POST',
                        body: {
                            messages: [{ role: 'user', content: systemPrompt }],
                            temperature: 0.7,
                            max_tokens: 500,
                        },
                        timeout: 60000,
                        source: 'chat-app',
                        note: '聊天概要',
                    });
                } catch (err) {
                    return { ok: false, error: `网络错误: ${err?.message || '连接失败'}` };
                }

                if (!apiResult?.success) {
                    const status = apiResult?.statusCode ? `HTTP ${apiResult.statusCode}: ` : '';
                    return { ok: false, error: `${status}${apiResult?.error || 'API 调用失败'}` };
                }

                const data = apiResult.data;
                const content = data?.choices?.[0]?.message?.content
                    || data?.content?.[0]?.text
                    || data?.candidates?.[0]?.content?.parts?.[0]?.text
                    || '';
                if (!content.trim()) return { ok: false, error: 'AI 返回内容为空' };

                return { ok: true, content: content.trim() };
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
             * ★ v0.72 切换概要的 Prompt 应用状态
             *   - active=true → 取消应用(active=false)
             *   - active=false → 重新应用(active=true)
             *   payload: { aiPersonId, mode, summaryId, active }
             */
            async toggleMemorySummaryPromptActive(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                const summaryId = String(payload.summaryId || '');
                const mode = String(payload.mode || 'calendar');
                const active = payload.active === undefined ? false : !!payload.active;
                if (!aiPersonId || !summaryId) return;
                const sdk = window.settingsSdk;
                if (!sdk?.memorySummaries) return;

                try {
                    await sdk.memorySummaries.setActive(aiPersonId, summaryId, active);
                } catch (err) {
                    console.warn('[chat-app] toggleMemorySummaryPromptActive setActive failed', err);
                    return;
                }

                // 同步 memorySummaryInjectMap
                try {
                    if (!this.app.state) this.app.state = {};
                    if (!this.app.state.chat) this.app.state.chat = {};
                    if (!this.app.state.chat.memorySummaryInject) this.app.state.chat.memorySummaryInject = {};
                    if (!this.app.state.chat.memorySummaryInject[aiPersonId]) {
                        this.app.state.chat.memorySummaryInject[aiPersonId] = {};
                    }
                    if (!active) {
                        // 标记为不注入
                        this.app.state.chat.memorySummaryInject[aiPersonId][summaryId] = false;
                    } else {
                        // 移除标记(重新启用)
                        delete this.app.state.chat.memorySummaryInject[aiPersonId][summaryId];
                    }
                    localStorage.setItem(
                        'xiaoting::chat-memory-summary-inject-v1',
                        JSON.stringify(this.app.state.chat.memorySummaryInject),
                    );
                } catch (_) {}

                this.toolkit?.island?.notify?.(
                    active ? 'success' : 'info',
                    active ? '已重新应用' : '已取消应用',
                );

                // 刷新 UI
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
             *   - 行为:跟 replyFormatInject / stickerLibraryInject 完全对齐
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
                const levels = (config.levels || []).map((l) => ({
                    id: String(l.id || ''),
                    name: String(l.name || ''),
                    cycle: Math.max(1, Number(l.cycle) || 1),
                }));

                // ★ v0.74 迁移到 AcModal:不再用 document.createElement + body.appendChild 野生 DOM
                //   通过 chatModalManager.openAddLevel 派发,弹窗由 framework mountInto,自动套用
                //   .app-shell 作用域样式 + AcModal squircle / footer 按钮 / 关闭按钮 / Esc 关闭
                const onConfirm = async (next) => {
                    try {
                        const res = await sdk.memorySummaries.addLevel(aiPersonId, {
                            name: next.name,
                            cycle: next.cycle,
                            position: next.position,
                        });
                        if (!res.ok) {
                            this.toolkit?.island?.notify?.('warning', '添加失败', res.error || '');
                            return;
                        }
                        // 双重刷新确保列表更新
                        try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                        try { window.__detailRenderTick.value++; } catch (_) {}
                        this.toolkit?.island?.notify?.('success', '已添加层级', res.level?.name || '');
                    } catch (err) {
                        this.toolkit?.island?.notify?.('error', '添加失败', err?.message || String(err));
                    }
                };

                chatModalManager.openAddLevel({ levels, onConfirm, onClose: () => {} });
            },

            /**
             * ★ v0.75 弹「删除层级」确认弹窗(AcModal)
             *   替代原 window.__phoneConfirm.request 的野生确认弹窗
             *   payload: { levelId }
             */
            async openRemoveLevelModal(payload = {}) {
                const { aiPersonId, levelId } = payload;
                if (!aiPersonId || !levelId) return;
                const sdk = window.settingsSdk;
                if (!sdk?.memorySummaries) return;
                const config = sdk.memorySummaries.getConfig(aiPersonId);
                const level = (config.levels || []).find((l) => l.id === levelId);
                if (!level) return;

                // ★ v0.75 改 AcModal 弹窗
                chatModalManager.openRemoveLevelConfirm({
                    levelName: level.name,
                    onConfirm: async () => {
                        const res = await sdk.memorySummaries.removeLevel(aiPersonId, levelId);
                        if (!res.ok) {
                            this.toolkit?.island?.notify?.('warning', '删除失败', res.error || '');
                            return;
                        }
                        // 双重刷新确保列表更新
                        try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                        try { window.__detailRenderTick.value++; } catch (_) {}
                        this.toolkit?.island?.notify?.('success', '已删除层级', level.name);
                    },
                    onClose: () => {},
                });
            },

            /**
             * ★ v0.75 改周期:从 inline input blur 时弹确认弹窗(改后清存量)(AcModal)
             *   替代原 window.__phoneConfirm.request 的野生确认弹窗
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

                // ★ v0.75 改 AcModal 弹窗
                chatModalManager.openUpdateLevelCycleConfirm({
                    levelName: level.name,
                    oldCycle: level.cycle,
                    newCycle,
                    onConfirm: async () => {
                        const res = await sdk.memorySummaries.updateLevelCycle(aiPersonId, levelId, newCycle);
                        if (!res.ok) {
                            this.toolkit?.island?.notify?.('warning', '修改失败', res.error || '');
                            try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {} // 让 input 回滚
                            return;
                        }
                        // 双重刷新确保列表更新
                        try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                        try { window.__detailRenderTick.value++; } catch (_) {}
                        this.toolkit?.island?.notify?.('success', '已修改周期', `${level.name}: ${level.cycle} → ${newCycle} 天`);
                    },
                    onClose: () => {},
                });
            },

            /**
             * ★ v0.61.3 实时计算「当前聊天回合」prompt 文本
             *   - 输入: messages 数组(必须带 sender / timestamp)
             *   - 回合定义见 services/context-rounds.js:
             *     **1 回合 = 1 组用户消息 + 紧随其后的 1 组 AI 消息**
             *     (v0.87 修复:之前把每个"连续同侧块"当一个回合,一来一回被算成 2 个,
             *      用户设 20 回合实际只拿到 10 组来回)
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

                const { rounds: picked } = takeRecentRounds(list, contextRounds);
                if (picked.length === 0) return '';

                const lines = [buildContextRoundsHeading(picked.length, contextRounds)];
                picked.forEach((round, i) => {
                    for (const m of round) {
                        const sender = String(m.senderName || '').trim()
                            || (m.sender === 'ai' ? 'AI' : (m.sender === 'user' ? '用户' : (m.sender || '?')));
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
                                <div class="new-chat-empty-icon">${SNAIL_EMPTY_SVG}</div>
                                <div class="new-chat-empty-text">还没有可添加的 AI 人设</div>
                                <div class="new-chat-empty-hint">
                                    默认用户卡还没有绑定世界观。<br/>
                                    请到「设置 → 用户」中为「默认用户卡」绑定一个世界观。<br/>
                                    <span class="new-chat-empty-link">→ 前往设置</span>
                                </div>
                            </div>
                        `;
                        return;
                    }

                    if (contactsTitle) contactsTitle.textContent = '可添加的 AI 人设（按当前模式筛选）';
                    const itemsHtml = aiPersons.map(renderContactItem).join('');
                    contactsList.innerHTML = itemsHtml;
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

                } catch (err) {
                    console.warn('[chat-app] refreshProfileTab failed:', err);
                }
            },

            /**
             * ★ v0.67.x 钱包流水页「刷新」按钮 handler
             *   - 派发入口:transaction-history 页 #refresh-transactions 元素的 data-app-action
             *   - 走 framework 二段式重画:invalidateRendererCache + bridge.syncNow({force:true})
             *   - 严禁用 __detailRenderTick.value++(async renderMode 会死循环,详见 AGENTS.md §27)
             *   - 灵动岛提示一下,让用户有反馈
             */
            async refreshWalletHistory() {
                try {
                    try {
                        if (typeof window.invalidateRendererCache === 'function') {
                            window.invalidateRendererCache('chat', null);
                        }
                    } catch (_) {}
                    try {
                        window.__appRendererBridge?.syncNow?.({ force: true });
                    } catch (_) {}
                    this.toolkit?.island?.notify?.('success', '钱包已刷新');
                } catch (err) {
                    console.warn('[chat-app] refreshWalletHistory failed:', err);
                    this.toolkit?.island?.notify?.('warning', '刷新失败', err?.message || '');
                }
            },

            /** framework 调用：关闭当前 detail 页 */
            closeDetail() {
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
            },

            /**
             * ★ v0.23 切换聊天记录模式（日历/故事）
             *   - 翻转全局 mode
             *   - 让 framework 重渲当前消息列表 tab（背景 / 内容都跟着切）
             */
            toggleRecordMode() {
                let next;
                try {
                    next = toggleChatRecordMode();
                } catch (err) {
                    console.error('[chat-app] toggleChatRecordMode threw:', err);
                    return;
                }
                const modeCfg = getModeConfig(next);
                this.toolkit?.island?.notify?.(
                    next === 'story' ? 'info' : 'success',
                    `已切换到${modeCfg.label}`,
                    next === 'story' ? '消息列表背景变为粉色，对话视为游戏模式' : '正常日历模式'
                );
                try {
                    refreshMessagesTab(this);
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
                                        <div class="avatar self" data-poke="self" style="background: ${DEFAULT_USER_AVATAR_BG};">我</div>
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

                // 「对方正在输入中」状态重放。
                //   v-html 每次重画都会把顶栏的名字还原成联系人名，所以状态不能
                //   「设一次就完事」—— 必须在页面重新挂载后重放一遍。这里是唯一
                //   能保证 innerHTML 已写完的时机（同 §X.7 的结论）。
                //   场景：发消息 → 切出 murmur → 切回来，AI 还没回，要继续闪。
                applyTypingToRoot(chatPrivate);

                // ★ v0.49 表情选择器面板 — 首次绑定时预填缓存
                //   v0.49.1 流程:
                //     ① _prerenderEmojiPicker(ids) 填 _emojiCache + bridge.syncNow({force:true}) 触发 v-html 重画
                //     ② v-html 重画后 init 又跑一次(新节点没 __chatPrivateInteractionsBound)
                //     ③ 第二次 init 走 cacheHit 分支,但因为 chatRoot 是旧节点,不 fill
                //     ④ 用户点 emoji 按钮时,toggle 路径传入新 chatRoot → prerender 走 cacheHit + fill 分支
                //   注意:init 时不传 chatRoot,因为那是即将被 v-html 重画的旧节点,fill 会被重画冲掉
                // ★ v0.70:抽出到 components/chat-emoji-panel.js
                const { prerenderEmojiPickerOnInit, scrollChatToBottomOnInit } = await import('./components/chat-emoji-panel.js');
                await prerenderEmojiPickerOnInit(chatPrivate);

                // ★ v0.50 进入私聊页即滚到底(像微信那样:打开聊天默认看最新消息)
                //   - 不要等用户点「跳到最新」按钮,符合聊天直觉
                //   - 这里 chatPrivate 已经是 observer 写入后的新节点,container 引用稳定
                scrollChatToBottomOnInit(chatPrivate);

                // ★ FIX v0.46:每次进入页面都重新绑定交互事件
                //   v-html 会替换整个 DOM，切出再返回时旧的事件监听器已失效
                //   必须重新绑定才能让按钮响应点击
                // ★ v0.70:多选模式工具抽到 components/chat-multi-select.js
                const { createMultiSelectController } = await import('./components/chat-multi-select.js');
                const multiSelect = createMultiSelectController(chatPrivate);
                // ★ v0.70:从 sdk 拿 sender + senderName + avatar 抽成 helper
                //   原代码在 toolBtn onConfirm 里重复 5 次(image/voice/location/redpacket/transfer)
                const { resolveSenderProfile } = await import('./components/chat-sender-profile.js');
                const _resolveSenderInfo = () => {
                    const { sender, senderName, userAvatar, userAvatarBg } = resolveSenderProfile();
                    return { sender, senderName, userAvatar, userAvatarBg };
                };
                // ★ v0.70:长按发送按钮 + Enter 键发送抽到 components/chat-press-sender.js
                const { createChatSendHandlers } = await import('./components/chat-press-sender.js');
                const notifyMultiAction = async (action) => {
                    const labels = { favorite: '收藏', forward: '转发', delete: '删除' };
                    if (!multiSelect.getSelectedCount()) {
                        window.__phoneIsland?.notify?.('info', '请先选择消息', '点击消息左侧的圆圈进行选择');
                        return;
                    }
                    if (action === 'favorite') {
                        // 创建对话片段收藏(从当前聊天 DOM 拿真实消息)
                        const selectedIds = multiSelect.getSelectedIds();
                        const convName = chatPrivate.dataset.conversationName || '联系人';
                        let sourceMessages = [];
                        try {
                            const raw = chatPrivate.dataset.rawMessages;
                            if (raw) sourceMessages = JSON.parse(raw);
                        } catch (_) {}
                        const selectedMsgs = sourceMessages.filter(m => selectedIds.includes(m.id));

                        // 构建对话片段
                        const newConversation = {
                            favoriteId: 'conv-' + Date.now(),
                            type: 'conversation',
                            sourceType: chatPrivate.dataset.conversationType || 'private',
                            sourceId: chatPrivate.dataset.conversationId || contactId,
                            sourceName: convName,
                            time: '今天 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                            messageCount: selectedMsgs.length,
                            messages: selectedMsgs.map(msg => ({
                                id: msg.id,
                                sender: msg.sender,
                                senderName: msg.senderName || (msg.sender === 'user' ? '我' : convName),
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
                        if (Array.isArray(window.__chatDemoFavorites)) {
                            window.__chatDemoFavorites.unshift(newConversation);
                        }
                        // 同步写入 app.state._conversationFavorites + localStorage(v0.44 兜底)
                        try {
                            const app = window.__chatAppInstance;
                            if (app) {
                                if (!Array.isArray(app.state._conversationFavorites)) {
                                    app.state._conversationFavorites = [];
                                }
                                app.state._conversationFavorites.unshift(newConversation);
                            }
                            const lsKey = 'xiaoting::chat-conversation-favorites-v1';
                            const ls = JSON.parse(localStorage.getItem(lsKey) || '[]');
                            ls.unshift(newConversation);
                            localStorage.setItem(lsKey, JSON.stringify(ls));
                        } catch (_) {}

                        window.__phoneIsland?.notify?.('success', '收藏成功', `已收藏 ${selectedMsgs.length} 条消息为对话片段`);
                    } else if (action === 'forward') {
                        // ★ v0.33 转发:从 DOM 反查消息 + 弹目标选择弹窗
                        const messageIds = multiSelect.getSelectedIds();
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
                        window.__phoneIsland?.notify?.(action === 'delete' ? 'warning' : 'success', `消息${labels[action]}成功`, `已处理 ${multiSelect.getSelectedCount()} 条消息`);
                    }
                    multiSelect.disable();
                };

                chatPrivate.addEventListener('click', async (event) => {
                    // ★ v0.49 获取 chat-app 单例,用于操作 state.chat.emojiOpen
                    const chatApp = externalAppRegistry.getApp('chat');

                    const selectButton = event.target.closest('[data-message-select]');
                    if (selectButton && multiSelect.isActive()) {

                        multiSelect.toggleMessage(selectButton);
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                    const multiAction = event.target.closest('[data-multi-action]');
                    if (multiAction) {
                        const action = multiAction.dataset.multiAction;
                        if (action === 'cancel') multiSelect.disable();
                        else notifyMultiAction(action);
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                    const multiSelectButton = event.target.closest('[data-action="multiselect"]');
                    if (multiSelectButton) {
                        multiSelect.toggle();
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

                    // ★ v0.49 输入区右侧 #emojiBtn 笑脸 / 表情面板关闭 / sticker 点击
                    //   已抽到 components/chat-emoji-panel.js(见模块底部 bindEmojiPanelInteractions)
                    //   这里只接管 emoji 之外的转发按钮(emojiBtn / close / sticker 由独立 listener 处理)

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
                                    const { sender, senderName, userAvatar, userAvatarBg } = _resolveSenderInfo();

                                    // ★ v1.0 身份转换模式:决定消息 sender 字段 + 写盘 senderName
                                    const swapOn = getSwapMode();
                                    const swapProfile = swapOn ? _resolveSwapSenderProfile() : null;
                                    const writeSender = swapOn && swapProfile ? 'ai' : 'user';
                                    const writeSenderName = swapOn && swapProfile ? swapProfile.senderName : senderName;
                                    // 渲染时用的 contact(供 share-cards 读 avatar/avatarBg)
                                    const renderContact = swapOn && swapProfile ? {
                                        name: writeSenderName,
                                        senderName: writeSenderName,
                                        avatar: swapProfile.aiAvatar,
                                        avatarBg: swapProfile.aiAvatarBg,
                                    } : null;

                                    // 1. 持久化到 IndexedDB
                                    let saved = null;
                                    try {
                                        const sender = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                                        if (sdk?.chatMessages?.add && sender) {
                                            saved = await sdk.chatMessages.add(sender, aiPersonId, mode, {
                                                id: msgId,
                                                sender: writeSender,
                                                senderName: writeSenderName,
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
                                        sender: writeSender,
                                        senderName: writeSenderName,
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
                                        tempDiv.className = `message-wrapper ${writeSender}`;
                                        tempDiv.innerHTML = renderDescImageBubble(msg, renderContact, {
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
                                    const { sender, senderName, userAvatar, userAvatarBg } = _resolveSenderInfo();

                                    // ★ v1.0 身份转换模式
                                    const swapOn = getSwapMode();
                                    const swapProfile = swapOn ? _resolveSwapSenderProfile() : null;
                                    const writeSender = swapOn && swapProfile ? 'ai' : 'user';
                                    const writeSenderName = swapOn && swapProfile ? swapProfile.senderName : senderName;
                                    const renderContact = swapOn && swapProfile ? {
                                        name: writeSenderName,
                                        senderName: writeSenderName,
                                        avatar: swapProfile.aiAvatar,
                                        avatarBg: swapProfile.aiAvatarBg,
                                    } : null;

                                    // 1. 持久化到 IndexedDB
                                    let saved = null;
                                    try {
                                        const sender = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                                        if (sdk?.chatMessages?.add && sender) {
                                            saved = await sdk.chatMessages.add(sender, aiPersonId, mode, {
                                                id: msgId,
                                                sender: writeSender,
                                                senderName: writeSenderName,
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
                                        sender: writeSender,
                                        senderName: writeSenderName,
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
                                        tempDiv.className = `message-wrapper ${writeSender}`;
                                        tempDiv.innerHTML = renderVoiceBubble(msg, renderContact, {
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

                                    // 从 SDK 拿 user 头像
                                    const { sender, senderName, userAvatar, userAvatarBg } = _resolveSenderInfo();

                                    // ★ v1.0 身份转换模式
                                    const swapOn = getSwapMode();
                                    const swapProfile = swapOn ? _resolveSwapSenderProfile() : null;
                                    const writeSender = swapOn && swapProfile ? 'ai' : 'user';
                                    const writeSenderName = swapOn && swapProfile ? swapProfile.senderName : senderName;
                                    const renderContact = swapOn && swapProfile ? {
                                        name: writeSenderName,
                                        senderName: writeSenderName,
                                        avatar: swapProfile.aiAvatar,
                                        avatarBg: swapProfile.aiAvatarBg,
                                    } : null;

                                    // 构建位置消息（★ v0.45 position 只存 x/y，防止函数导致 DataCloneError）
                                    const locationMsg = {
                                        id: `loc-${now}`,
                                        sender: writeSender,
                                        senderName: writeSenderName,
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
                                        if (sdk?.chatMessages?.add && sender) {
                                            await sdk.chatMessages.add(sender, aiPersonId, mode, {
                                                id: locationMsg.id,
                                                sender: writeSender,
                                                senderName: writeSenderName,
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
                                        tempDiv.className = `message-wrapper ${writeSender}`;
                                        tempDiv.innerHTML = renderLocationBubble(locationMsg, renderContact, {
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

                                    // 从 SDK 拿 user 头像
                                    const { sender, senderName, userAvatar, userAvatarBg } = _resolveSenderInfo();

                                    // ★ v1.0 身份转换模式
                                    const swapOn = getSwapMode();
                                    const swapProfile = swapOn ? _resolveSwapSenderProfile() : null;
                                    const writeSender = swapOn && swapProfile ? 'ai' : 'user';
                                    const writeSenderName = swapOn && swapProfile ? swapProfile.senderName : senderName;
                                    const renderContact = swapOn && swapProfile ? {
                                        name: writeSenderName,
                                        senderName: writeSenderName,
                                        avatar: swapProfile.aiAvatar,
                                        avatarBg: swapProfile.aiAvatarBg,
                                    } : null;

                                    // ★ v0.67 走 chat-asset-service:扣 user 余额 + 写 assetFlow + 写消息
                                    let saved = null;
                                    try {
                                        const { userSendRedpacket } = await import('./services/chat-asset-service.js');
                                        const res = await userSendRedpacket({
                                            aiPersonId,
                                            mode,
                                            amount: Number(result.amount) || 0,
                                            message: result.message || '恭喜发财',
                                            // ★ v1.0 swap 模式:传 sender/senderName 走 AI 身份写盘
                                            sender: writeSender,
                                            senderName: writeSenderName,
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
                                        sender: writeSender,
                                        senderName: writeSenderName,
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
                                        tempDiv.className = `message-wrapper ${writeSender}`;
                                        tempDiv.innerHTML = renderRedpacketBubble(msg, renderContact, {
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

                                    // 从 SDK 拿 user 头像
                                    const { sender, senderName, userAvatar, userAvatarBg } = _resolveSenderInfo();

                                    // ★ v1.0 身份转换模式
                                    const swapOn = getSwapMode();
                                    const swapProfile = swapOn ? _resolveSwapSenderProfile() : null;
                                    const writeSender = swapOn && swapProfile ? 'ai' : 'user';
                                    const writeSenderName = swapOn && swapProfile ? swapProfile.senderName : senderName;
                                    const renderContact = swapOn && swapProfile ? {
                                        name: writeSenderName,
                                        senderName: writeSenderName,
                                        avatar: swapProfile.aiAvatar,
                                        avatarBg: swapProfile.aiAvatarBg,
                                    } : null;

                                    // ★ v0.67 走 chat-asset-service:扣 user 余额 + 写 assetFlow + 写消息
                                    let saved = null;
                                    try {
                                        const { userSendTransfer } = await import('./services/chat-asset-service.js');
                                        const res = await userSendTransfer({
                                            aiPersonId,
                                            mode,
                                            amount: Number(result.amount) || 0,
                                            note: result.note || '转账',
                                            // ★ v1.0 swap 模式:传 sender/senderName 走 AI 身份写盘
                                            sender: writeSender,
                                            senderName: writeSenderName,
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
                                        sender: writeSender,
                                        senderName: writeSenderName,
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
                                        tempDiv.className = `message-wrapper ${writeSender}`;
                                        tempDiv.innerHTML = renderTransferBubble(msg, renderContact, {
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
                                // ★ v1.0 「身份」按钮走 toggleSwapMode 单独处理,不在这里占位
                            };
                            if (labels[action]) {
                                window.__phoneIsland.notify('info', labels[action], '功能即将开放');
                            }
                        }
                        // ★ v1.0 「身份」按钮:切换身份转换模式(原本是「自定义」占位)
                        //   - 默认蓝色 → 激活粉色
                        //   - 开启后用户发出去的消息(文字 + 图片/语音/位置/红包/转账)全部以 AI 身份显示
                        if (action === 'custom') {
                            toggleSwapMode(chatPrivate);
                            event.preventDefault();
                            event.stopPropagation();
                            return;
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
                        const { collectCardContext } = await import('./services/card-detail-actions.js');
                        const desc = descImageCard.dataset.desc || '';
                        const cardColor = descImageCard.dataset.color || '#FFE4EC';
                        const textColor = descImageCard.dataset.textColor || '#D4728A';
                        const borderColor = Object.values(DESC_IMAGE_PRESETS || {}).find(p => p.cardColor === cardColor)?.borderColor || '#C0607A';
                        chatModalManager.openDescImage({
                            description: desc, cardColor, textColor, borderColor,
                            context: collectCardContext(descImageCard),
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // 地点卡片点击 — 显示地点详情弹窗
                    const locationCard = event.target.closest('.location-card-in-chat');
                    if (locationCard) {
                        const { collectCardContext } = await import('./services/card-detail-actions.js');
                        const name = locationCard.dataset.locationName || '位置';
                        const address = locationCard.dataset.locationAddress || '';
                        const mapEl = locationCard.querySelector('.location-card-map');
                        const bgGradient = mapEl ? (
                            mapEl.style.background ||
                            'linear-gradient(135deg, #E8F2FF, #D6E4FF)'
                        ) : 'linear-gradient(135deg, #E8F2FF, #D6E4FF)';

                        chatModalManager.openLocationCard({
                            name, address, style: { bgGradient },
                            context: collectCardContext(locationCard),
                        });
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

                // ★ v0.70:把 emoji panel 的三个交互(emojiBtn / close / sticker)绑到独立 listener
                //   因为这些交互可能异步加载图片/触发 prerender,跟主 click 委托解耦更清晰
                const { bindEmojiPanelInteractions } = await import('./components/chat-emoji-panel.js');
                bindEmojiPanelInteractions(chatPrivate, { conversationType: 'private', chatApp: this });

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
                 * ★ v1.0 身份转换模式(swap mode) — 状态工具
                 *   - 状态存 app.state.chat.swapMode[`<aiPersonId>::<mode>`] = true/false
                 *   - DOM 同步:开启时给 .chat-private 加 data-swap-active="1",关闭时移除
                 *   - 持久化:用 localStorage,key = chat.swapMode,刷新/重启后状态仍在
                 */
                const SWAP_MODE_STORAGE_KEY = 'chat.swapMode.v1';
                const _loadSwapModeMap = () => {
                    try {
                        const raw = localStorage.getItem(SWAP_MODE_STORAGE_KEY);
                        if (!raw) return {};
                        const obj = JSON.parse(raw);
                        return (obj && typeof obj === 'object') ? obj : {};
                    } catch (_) { return {}; }
                };
                const _saveSwapModeMap = (map) => {
                    try { localStorage.setItem(SWAP_MODE_STORAGE_KEY, JSON.stringify(map || {})); } catch (_) {}
                };
                const _ensureSwapModeState = () => {
                    if (!this.app.state) this.app.state = {};
                    if (!this.app.state.chat) this.app.state.chat = {};
                    if (!this.app.state.chat.swapMode || typeof this.app.state.chat.swapMode !== 'object') {
                        // 启动时从 localStorage 恢复(防止热更新/刷新后状态丢失)
                        this.app.state.chat.swapMode = _loadSwapModeMap();
                    }
                    return this.app.state.chat.swapMode;
                };
                const _getSwapKey = (aiPersonId, mode) => `${aiPersonId}::${mode}`;

                /**
                 * 读取当前 chat-private 是否在 swap 模式
                 * @returns {boolean}
                 */
                const getSwapMode = () => {
                    try {
                        const { aiPersonId, mode } = parseContactId(chatPrivate.dataset.contactId);
                        const map = _ensureSwapModeState();
                        return !!map[_getSwapKey(aiPersonId, mode)];
                    } catch (_) { return false; }
                };

                /**
                 * 切换 swap 模式
                 * @param {HTMLElement} rootEl .chat-private 容器
                 * @returns {boolean} 切换后的状态
                 */
                const toggleSwapMode = (rootEl) => {
                    const { aiPersonId, mode } = parseContactId(rootEl.dataset.contactId);
                    const key = _getSwapKey(aiPersonId, mode);
                    const map = _ensureSwapModeState();
                    const next = !map[key];
                    map[key] = next;
                    _saveSwapModeMap(map);
                    // 同步 DOM 属性
                    if (next) {
                        rootEl.setAttribute('data-swap-active', '1');
                    } else {
                        rootEl.removeAttribute('data-swap-active');
                    }
                    // 灵动岛提示
                    try {
                        if (next) {
                            window.__phoneIsland?.notify?.('success', '身份转换已开启', '接下来发出的消息将作为 AI 发送');
                        } else {
                            window.__phoneIsland?.notify?.('info', '身份转换已关闭', '恢复以你本人身份发送');
                        }
                    } catch (_) {}
                    return next;
                };

                /**
                 * ★ v1.0 swap 模式开关后,消息渲染需要用 AI 头像/名字
                 *   - 走 aiMeta.resolveAiAvatar(aiPersonId) 拿 url/bg
                 *   - senderName 走 chat-page 里 contact.name(已实时算好)
                 * @returns {{ sender: 'ai', senderName: string, aiAvatar: string, aiAvatarBg: string, aiPersonId: string, mode: string }|null}
                 */
                const _resolveSwapSenderProfile = () => {
                    try {
                        const { aiPersonId, mode } = parseContactId(chatPrivate.dataset.contactId);
                        const aiAv = resolveAiAvatar(aiPersonId);
                        // contact.name 已经在 chat-page 渲染时算好,直接从 dataset 读
                        const aiName = chatPrivate.dataset.conversationName || 'AI';
                        return {
                            sender: 'ai',
                            senderName: aiName,
                            aiAvatar: aiAv.url,
                            aiAvatarBg: aiAv.bg,
                            aiPersonId,
                            mode,
                        };
                    } catch (_) { return null; }
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

                // ★ v0.67.x 修复:发送按钮同时被 pointer + touch 触发 + Enter 键连续按 → 同一手势多次发同一条消息
                //   - 加 doSendRunning 锁:同一条 doSend 链没跑完之前,新触发直接 return
                //   - 锁在 await save 之前同步置位,写盘完成后才释放
                let doSendRunning = false;
                const doSend = async () => {
                    if (!messageInput) return;
                    if (doSendRunning) return; // 上一条还没写完,直接跳过
                    const text = (messageInput.innerText || messageInput.textContent || '').trim();
                    if (!text) return;

                    const { aiPersonId, mode } = parseContactId(chatPrivate.dataset.contactId);
                    const sdk = window.settingsSdk;
                    if (!sdk?.chatMessages?.add) {
                        window.__phoneIsland?.notify?.('error', '发送失败', 'SDK 未就绪');
                        return;
                    }

                    // ★ v0.67.x 同步置位,防止写盘期间再触发
                    doSendRunning = true;

                    // ★ v1.0 身份转换模式判断:
                    //   - 开启时:消息以 AI 身份发送,sender='ai',用 AI 头像/名字
                    //   - 但写盘 owner 仍要是 user(否则 chatFriends 找不到 entry)
                    const swapOn = getSwapMode();
                    const swapProfile = swapOn ? _resolveSwapSenderProfile() : null;

                    // 默认 user 名(从 defaultUserCard 拿)
                    // ★ v0.70:用 chat-sender-profile.resolveSenderProfile 统一提取
                    const { sender, senderName: userSenderName } = _resolveSenderInfo();
                    if (!sender) {
                        window.__phoneIsland?.notify?.('error', '发送失败', '未找到默认用户');
                        doSendRunning = false;
                        return;
                    }

                    // 写盘时使用的 senderName = swap 时用 AI 名字,否则用用户自己名字
                    const writeSenderName = swapOn && swapProfile ? swapProfile.senderName : userSenderName;

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
                        sender: swapOn ? 'ai' : 'user',
                        senderName: writeSenderName,
                        type: 'text',
                        content: text,
                        timestamp: Date.now(),
                        ...(replyTo ? { replyTo } : {}),
                    };

                    try {
                        // 1. 写盘(写盘 owner 仍用 user,确保 chatFriends 能找到)
                        const saved = await sdk.chatMessages.add(sender, aiPersonId, mode, msg);
                        if (!saved) {
                            window.__phoneIsland?.notify?.('error', '发送失败', '请重试');
                            return;
                        }
                        // ★ FIX v0.47:清 renderer 缓存,避免切出再切回时命中旧 HTML 缓存丢消息
                        try { window.invalidateRendererCache?.('chat', chatPrivate.dataset.contactId); } catch (_) {}
                        // 2. 立即把气泡追到 DOM
                        //   swap 时 contact 用 AI 头像/名字 + sender='ai' → text-bubble 自然渲染成 AI 气泡
                        if (swapOn && swapProfile) {
                            appendMessageBubble(saved, {
                                name: writeSenderName,
                                senderName: writeSenderName,
                                avatar: swapProfile.aiAvatar,
                                avatarBg: swapProfile.aiAvatarBg,
                            }, { aiPersonId, mode });
                        } else {
                            appendMessageBubble(saved, { name: userSenderName, senderName: userSenderName }, { aiPersonId, mode });
                        }
                        // 3. 清空输入框
                        messageInput.innerHTML = '';
                        messageInput.focus();
                        // 4. 更新联系人 entry.lastMessage(消息列表页预览要用)
                        try {
                            if (sender && sdk.chatFriends?.updateLastMessage) {
                                await sdk.chatFriends.updateLastMessage(sdk, sender, aiPersonId, mode, {
                                    content: text,
                                    timestamp: saved.timestamp,
                                    senderName: writeSenderName,
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
                        // ★ v0.67.x 写盘完成 → 释放锁,允许后续发送
                        doSendRunning = false;
                    } catch (err) {
                        console.warn('[chat-app] send message failed:', err);
                        window.__phoneIsland?.notify?.('error', '发送失败', err?.message || '请重试');
                        // ★ v0.67.x 失败也要释放锁,否则会卡死
                        doSendRunning = false;
                    }
                };

                // ★ v0.62.5 发送按钮改造:短按 vs 长按
                //   - 短按(< 1.5 秒):仅发文字消息,不调 AI
                //   - 长按(≥ 1.5 秒):发文字 + 调 AI
                //   - 空文本:整个发送逻辑不响应(短按长按都不响应)
                //   - 长按时按钮变粉 + 进度填充,作为视觉反馈
                // ★ v0.70:startPress/endPress/Enter 监听抽到 components/chat-press-sender.js
                //   私聊独有逻辑:_longPressInvokeAi(读 pre 文本 → 调 AI)作为 onLongPress 传入
                if (sendBtn) {
                    const PRESS_THRESHOLD_MS = 800; // ★ v0.62.5 长按 0.8 秒触发(降低等待焦虑)
                    const _longPressInvokeAi = async () => {
                        const { aiPersonId, mode } = parseContactId(chatPrivate.dataset.contactId);
                        const inputText = (messageInput?.innerText || messageInput?.textContent || '').trim();
                        const apiText = inputText || '（请根据当前对话上下文接着回复）';

                        beginTyping('private', aiPersonId);
                        try {
                            if (inputText) await doSend();
                            const inst = externalAppRegistry?.getApp?.('chat') || window.__chatAppSingleton;
                            if (inst?.methods?.sendMessageWithAi) {
                                await inst.methods.sendMessageWithAi({
                                    aiPersonId,
                                    mode,
                                    text: apiText,
                                    silentIsland: true,
                                });
                            } else {
                                console.warn('[chat-app] sendMessageWithAi not found, inst=', inst);
                                window.__phoneIsland?.notify?.('error', 'AI 入口未找到');
                            }
                        } catch (aiErr) {
                            console.warn('[chat-app] sendMessageWithAi invoke failed', aiErr);
                            window.__phoneIsland?.notify?.('error', 'AI 调用失败', aiErr?.message || '');
                        } finally {
                            endTyping('private', aiPersonId);
                        }
                    };

                    const { bindEnterToSend, bindPressToSend } = createChatSendHandlers({
                        sendBtn,
                        messageInput,
                        threshold: PRESS_THRESHOLD_MS,
                        requireTextOnStart: false, // 私聊:空文本也允许长按(走 _longPressInvokeAi)
                        doSend,
                        onLongPress: _longPressInvokeAi,
                        notifyEmpty: () => {
                            try { window.__phoneIsland?.notify?.('warning', '消息为空', '请先输入内容'); } catch (_) {}
                        },
                    });
                    bindEnterToSend();
                    bindPressToSend();
                }
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
            /**
             * ★ v0.62 聊天背景弹窗(支持私聊 + 群聊)
             *   - 私聊:payload = { contactId, mode } → sdk.chatFriends.updateBackground
             *   - 群聊:payload = { contactId, mode, isGroup: true } → sdk.chatGroups.updateBackground
             *
             * @param {Object} payload { contactId: string, mode: string, isGroup?: boolean }
             */
            async openChatBackgroundModal(payload = {}) {
                const contactId = payload?.contactId || '';
                const mode = payload?.mode || 'calendar';
                const isGroup = !!payload?.isGroup;

                if (!contactId) {
                    console.warn('[chat-app] openChatBackgroundModal: contactId empty');
                    this.toolkit?.island?.notify?.('error', '打开失败', '缺少 ID');
                    return null;
                }

                const sdk = window.settingsSdk;
                if (!sdk?.users) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }
                const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                if (!defaultUser) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户卡');
                    return null;
                }

                // ★ 根据 isGroup 分发到不同 SDK
                let currentValue = '';
                let saveBackground;
                if (isGroup) {
                    const entry = sdk.chatGroups?.get?.(defaultUser, contactId, mode);
                    if (!entry) {
                        this.toolkit?.island?.notify?.(
                            'warning',
                            '该群聊已被删除',
                            '请退出此页'
                        );
                        return null;
                    }
                    currentValue = entry.chatBackground || '';
                    saveBackground = async (newValue) => {
                        // ★ v0.69 直接走 sdk.chatGroups.update(chatBackground)
                        return await sdk.chatGroups.update(sdk, defaultUser, contactId, mode, {
                            chatBackground: newValue,
                        });
                    };
                } else {
                    const entry = sdk.chatFriends?.get?.(defaultUser, contactId, mode);
                    if (!entry) {
                        this.toolkit?.island?.notify?.(
                            'warning',
                            '该联系人尚未添加',
                            '请先在「发起聊天」页添加此 AI 联系人后再设置背景'
                        );
                        return null;
                    }
                    currentValue = entry.chatBackground || '';
                    saveBackground = async (newValue) => {
                        return await sdk.chatFriends.updateBackground(
                            sdk, defaultUser, contactId, mode, newValue
                        );
                    };
                }

                chatModalManager.openChatBackground({
                    currentValue,
                    onSave: async (newValue) => {
                        try {
                            const updated = await saveBackground(newValue);
                            if (!updated) {
                                this.toolkit?.island?.notify?.('warning', '保存失败', isGroup ? '该群聊已被删除' : '该联系人已被删除');
                                return;
                            }
                            // 派发事件让监听方自行重画
                            try {
                                window.dispatchEvent(new CustomEvent('chat:chat-background-changed', {
                                    detail: {
                                        contactId,
                                        mode,
                                        isGroup,
                                        oldValue: currentValue,
                                        newValue: newValue || '',
                                        entry: updated,
                                    },
                                }));
                            } catch (_) {}

                            // 触发 framework 重画:聊天设置页(更新右侧预览) + 私聊/群聊页(应用新背景)
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
                        if (typeof window.__detailRenderTick !== 'undefined') {
                            window.__detailRenderTick.value++;
                        }
                    },
                });

                return null;
            },

            /**
             * ★ v0.69 群聊设置 - 编辑群名称
             *   payload = { groupId, mode }
             *   走 chatModalManager.openAiRemark(复用私聊备注弹窗)
             *   写入 sdk.chatGroups.update({ name })
             */
            async openGroupNameEdit(payload = {}) {
                const groupId = payload?.groupId || '';
                const mode = payload?.mode || 'calendar';
                if (!groupId) {
                    this.toolkit?.island?.notify?.('warning', '群 ID 缺失');
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.chatGroups || !sdk?.users) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                if (!defaultUser) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户');
                    return null;
                }
                const entry = sdk.chatGroups.get(defaultUser, groupId, mode);
                if (!entry) {
                    this.toolkit?.island?.notify?.('warning', '群聊已被删除');
                    return null;
                }
                chatModalManager.openAiRemark({
                    name: entry.name || '群聊',
                    avatarBg: DEFAULT_AI_AVATAR_BG,
                    remark: entry.name || '',
                    mode,
                    onSave: async (newName) => {
                        try {
                            const trimmed = String(newName || '').trim().slice(0, 30);
                            if (!trimmed) {
                                this.toolkit?.island?.notify?.('warning', '名称不能为空');
                                return;
                            }
                            const updated = await sdk.chatGroups.update(sdk, defaultUser, groupId, mode, {
                                name: trimmed,
                            });
                            if (!updated) {
                                this.toolkit?.island?.notify?.('warning', '保存失败', '该群聊已被删除');
                                return;
                            }
                            // 派发事件 + 重画
                            try {
                                window.dispatchEvent(new CustomEvent('chat:group-name-changed', {
                                    detail: { groupId, mode, oldName: entry.name, newName: trimmed, entry: updated },
                                }));
                            } catch (_) {}
                            if (typeof window.__detailRenderTick !== 'undefined') {
                                window.__detailRenderTick.value++;
                            }
                            refreshMessagesTab(this);
                            this.toolkit?.island?.notify?.('success', '群名称已保存', trimmed);
                        } catch (err) {
                            console.error('[chat-app] openGroupNameEdit failed', err);
                            this.toolkit?.island?.notify?.('error', '保存失败', err?.message || '');
                        }
                    },
                });
                return null;
            },

            /**
             * ★ v0.69 群聊设置 - 编辑群公告
             *   payload = { groupId, mode }
             *   复用 AiRemarkModal,允许多行
             *   写入 sdk.chatGroups.update({ announcement })
             */
            async openGroupAnnouncementEdit(payload = {}) {
                const groupId = payload?.groupId || '';
                const mode = payload?.mode || 'calendar';
                if (!groupId) {
                    this.toolkit?.island?.notify?.('warning', '群 ID 缺失');
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.chatGroups || !sdk?.users) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                if (!defaultUser) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户');
                    return null;
                }
                const entry = sdk.chatGroups.get(defaultUser, groupId, mode);
                if (!entry) {
                    this.toolkit?.island?.notify?.('warning', '群聊已被删除');
                    return null;
                }
                chatModalManager.openAiRemark({
                    name: '群公告',
                    avatarBg: DEFAULT_USER_AVATAR_BG,
                    remark: entry.announcement || '',
                    mode,
                    onSave: async (text) => {
                        try {
                            const trimmed = String(text || '').trim().slice(0, 200);
                            const updated = await sdk.chatGroups.update(sdk, defaultUser, groupId, mode, {
                                announcement: trimmed,
                            });
                            if (!updated) {
                                this.toolkit?.island?.notify?.('warning', '保存失败', '该群聊已被删除');
                                return;
                            }
                            try {
                                window.dispatchEvent(new CustomEvent('chat:group-announcement-changed', {
                                    detail: { groupId, mode, newAnnouncement: trimmed, entry: updated },
                                }));
                            } catch (_) {}
                            if (typeof window.__detailRenderTick !== 'undefined') {
                                window.__detailRenderTick.value++;
                            }
                            this.toolkit?.island?.notify?.('success', '群公告已保存');
                        } catch (err) {
                            console.error('[chat-app] openGroupAnnouncementEdit failed', err);
                            this.toolkit?.island?.notify?.('error', '保存失败', err?.message || '');
                        }
                    },
                });
                return null;
            },

            /**
             * ★ v0.69 群聊设置 - 编辑群备注(per-mode 独立)
             *   payload = { groupId, mode }
             *   复用 AiRemarkModal
             *   写入 sdk.chatGroups.update({ remark })
             */
            async openGroupRemarkEdit(payload = {}) {
                const groupId = payload?.groupId || '';
                const mode = payload?.mode || 'calendar';
                if (!groupId) {
                    this.toolkit?.island?.notify?.('warning', '群 ID 缺失');
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.chatGroups || !sdk?.users) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                if (!defaultUser) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户');
                    return null;
                }
                const entry = sdk.chatGroups.get(defaultUser, groupId, mode);
                if (!entry) {
                    this.toolkit?.island?.notify?.('warning', '群聊已被删除');
                    return null;
                }
                chatModalManager.openAiRemark({
                    name: '群备注',
                    avatarBg: DEFAULT_AI_AVATAR_BG,
                    remark: entry.remark || '',
                    mode,
                    onSave: async (text) => {
                        try {
                            const trimmed = String(text || '').trim().slice(0, 100);
                            const updated = await sdk.chatGroups.update(sdk, defaultUser, groupId, mode, {
                                remark: trimmed,
                            });
                            if (!updated) {
                                this.toolkit?.island?.notify?.('warning', '保存失败', '该群聊已被删除');
                                return;
                            }
                            try {
                                window.dispatchEvent(new CustomEvent('chat:group-remark-changed', {
                                    detail: { groupId, mode, newRemark: trimmed, entry: updated },
                                }));
                            } catch (_) {}
                            if (typeof window.__detailRenderTick !== 'undefined') {
                                window.__detailRenderTick.value++;
                            }
                            this.toolkit?.island?.notify?.('success', '群备注已保存');
                        } catch (err) {
                            console.error('[chat-app] openGroupRemarkEdit failed', err);
                            this.toolkit?.island?.notify?.('error', '保存失败', err?.message || '');
                        }
                    },
                });
                return null;
            },

            /**
             * ★ v0.69 群聊设置 - 切换开关(置顶 / 免打扰 / 提醒)
             *   payload = { groupId, mode, field: 'isPinned' | 'isMuted' | 'isRemindEnabled' }
             *   走 sdk.chatGroups.update
             *   不需要弹窗,直接写盘
             */
            async toggleGroupSetting(payload = {}) {
                const groupId = payload?.groupId || '';
                const mode = payload?.mode || 'calendar';
                const field = payload?.field || '';
                if (!groupId || !field) {
                    this.toolkit?.island?.notify?.('warning', '参数缺失');
                    return null;
                }
                const validFields = ['isPinned', 'isMuted', 'isRemindEnabled'];
                if (!validFields.includes(field)) {
                    this.toolkit?.island?.notify?.('warning', '未知字段', field);
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.chatGroups || !sdk?.users) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                if (!defaultUser) {
                    this.toolkit?.island?.notify?.('error', '未找到默认用户');
                    return null;
                }
                const entry = sdk.chatGroups.get(defaultUser, groupId, mode);
                if (!entry) {
                    this.toolkit?.island?.notify?.('warning', '群聊已被删除');
                    return null;
                }
                try {
                    const newValue = !entry[field];
                    const updated = await sdk.chatGroups.update(sdk, defaultUser, groupId, mode, {
                        [field]: newValue,
                    });
                    if (!updated) {
                        this.toolkit?.island?.notify?.('warning', '保存失败');
                        return null;
                    }
                    try {
                        window.dispatchEvent(new CustomEvent('chat:group-setting-changed', {
                            detail: { groupId, mode, field, newValue, entry: updated },
                        }));
                    } catch (_) {}
                    if (typeof window.__detailRenderTick !== 'undefined') {
                        window.__detailRenderTick.value++;
                    }
                    refreshMessagesTab(this);
                    const labelMap = { isPinned: '置顶', isMuted: '免打扰', isRemindEnabled: '消息提醒' };
                    this.toolkit?.island?.notify?.('success',
                        `${labelMap[field]}已${newValue ? '开启' : '关闭'}`,
                        '');
                } catch (err) {
                    console.error('[chat-app] toggleGroupSetting failed', err);
                    this.toolkit?.island?.notify?.('error', '保存失败', err?.message || '');
                }
                return null;
            },

            /**
             * ★ v0.81 群成员管理 - 打开群主选择器
             *   payload = { groupId, mode }
             *   - 候选:当前群所有成员(user + ai)
             *   - 排除已是管理员的 AI?(允许,但 UI 提示)
             *   - 当前群主默认置灰 + 标注「当前群主」
             */
            openGroupOwnerPicker(payload = {}) {
                const groupId = payload?.groupId || '';
                const mode = payload?.mode || 'calendar';
                if (!groupId) {
                    this.toolkit?.island?.notify?.('warning', '群 ID 缺失');
                    return null;
                }
                const sdk = window.settingsSdk;
                const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                if (!sdk?.chatGroups || !defaultUser) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                let entry = null;
                for (const m of ['calendar', 'story']) {
                    const e = sdk.chatGroups.get?.(defaultUser, groupId, m);
                    if (e) { entry = e; break; }
                }
                if (!entry) {
                    this.toolkit?.island?.notify?.('warning', '群聊已被删除');
                    return null;
                }
                // 当前用户本人必须是群主(本次 MVP),否则不允许换群主
                const currentOwnerId = entry.ownerId || defaultUser.id;
                if (String(currentOwnerId) !== String(defaultUser.id)) {
                    this.toolkit?.island?.notify?.(
                        'warning',
                        '当前不是群主',
                        '仅群主本人可转让群主身份'
                    );
                    return null;
                }
                const resolved = (sdk.chatGroups.resolveMembers && entry)
                    ? sdk.chatGroups.resolveMembers(sdk, defaultUser, entry)
                    : (entry.members || []).map((id) => ({ id }));
                const candidates = buildGroupPickerCandidates({
                    resolvedMembers: resolved,
                    defaultUser,
                    currentOwnerId,
                    adminIds: entry.adminIds || [],
                    memberNicknames: entry.memberNicknames || {},
                });
                chatModalManager.openGroupMemberPicker({
                    title: '选择新群主',
                    subtitle: '群主转让后,原群主将自动降为普通成员',
                    confirmLabel: '转让群主',
                    candidates,
                    onPick: async (member) => {
                        try {
                            // 走 group-admin-service：它顺带写一条「XX 把群主转让给了 XX」
                            // 的群公告消息。之前这里只改字段，聊天流里什么都不留，
                            // 用户过两天完全不记得群主什么时候换的。
                            const { applyGroupOwner } = await import('./services/group-admin-service.js');
                            const res = await applyGroupOwner({
                                sdk, user: defaultUser, groupId, mode,
                                actorId: defaultUser.id, targetId: member.id,
                            });
                            if (!res?.ok) {
                                this.toolkit?.island?.notify?.('warning', '保存失败', res?.error || '');
                                return;
                            }
                            try {
                                window.dispatchEvent(new CustomEvent('chat:group-owner-changed', {
                                    detail: { groupId, mode, newOwnerId: member.id, entry: res.group },
                                }));
                            } catch (_) {}
                            refreshMessagesTab(this);
                            const memberLabel = member?.label || member?.id || '新群主';
                            this.toolkit?.island?.notify?.('success', '群主已转让', memberLabel);
                        } catch (err) {
                            console.error('[chat-app] openGroupOwnerPicker onPick failed', err);
                            this.toolkit?.island?.notify?.('error', '转让失败', err?.message || '');
                        }
                    },
                });
                return null;
            },

            /**
             * ★ v0.81 群成员管理 - 打开管理员选择器
             *   payload = { groupId, mode }
             *   - 候选:AI 成员,排除已是群主的人,排除已是管理员的人(置灰)
             *   - 最多 MAX_GROUP_ADMIN_COUNT(2)个
             */
            openGroupAdminPicker(payload = {}) {
                const groupId = payload?.groupId || '';
                const mode = payload?.mode || 'calendar';
                if (!groupId) {
                    this.toolkit?.island?.notify?.('warning', '群 ID 缺失');
                    return null;
                }
                const sdk = window.settingsSdk;
                const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                if (!sdk?.chatGroups || !defaultUser) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                let entry = null;
                for (const m of ['calendar', 'story']) {
                    const e = sdk.chatGroups.get?.(defaultUser, groupId, m);
                    if (e) { entry = e; break; }
                }
                if (!entry) {
                    this.toolkit?.island?.notify?.('warning', '群聊已被删除');
                    return null;
                }
                const currentOwnerId = entry.ownerId || defaultUser.id;
                if (String(currentOwnerId) !== String(defaultUser.id)) {
                    this.toolkit?.island?.notify?.('warning', '当前不是群主', '仅群主可设置管理员');
                    return null;
                }
                const adminIds = Array.isArray(entry.adminIds) ? entry.adminIds : [];
                if (adminIds.length >= MAX_GROUP_ADMIN_COUNT) {
                    this.toolkit?.island?.notify?.('warning', '已达上限', `最多 ${MAX_GROUP_ADMIN_COUNT} 名管理员`);
                    return null;
                }
                const resolved = (sdk.chatGroups.resolveMembers && entry)
                    ? sdk.chatGroups.resolveMembers(sdk, defaultUser, entry)
                    : (entry.members || []).map((id) => ({ id }));
                const candidates = buildGroupPickerCandidates({
                    resolvedMembers: resolved,
                    defaultUser,
                    currentOwnerId,
                    adminIds,
                    memberNicknames: entry.memberNicknames || {},
                    filter: 'admin-picker',
                });
                chatModalManager.openGroupMemberPicker({
                    title: '添加管理员',
                    subtitle: `还可添加 ${MAX_GROUP_ADMIN_COUNT - adminIds.length} 名管理员`,
                    confirmLabel: '设为管理员',
                    candidates,
                    onPick: async (member) => {
                        try {
                            if (adminIds.includes(member.id)) {
                                this.toolkit?.island?.notify?.('warning', '已是管理员', member.label);
                                return;
                            }
                            if (adminIds.length >= MAX_GROUP_ADMIN_COUNT) {
                                this.toolkit?.island?.notify?.('warning', '已达上限', `最多 ${MAX_GROUP_ADMIN_COUNT} 名管理员`);
                                return;
                            }
                            // 走 group-admin-service：写盘 + 「XX 把 XX 设为了管理员」群公告
                            const { applyGroupAdmin } = await import('./services/group-admin-service.js');
                            const res = await applyGroupAdmin({
                                sdk, user: defaultUser, groupId, mode,
                                actorId: defaultUser.id, targetId: member.id, on: true,
                            });
                            if (!res?.ok) {
                                this.toolkit?.island?.notify?.('warning', '保存失败', res?.error || '');
                                return;
                            }
                            try {
                                window.dispatchEvent(new CustomEvent('chat:group-admin-changed', {
                                    detail: { groupId, mode, adminIds: res.group?.adminIds || [], entry: res.group },
                                }));
                            } catch (_) {}
                            refreshMessagesTab(this);
                            this.toolkit?.island?.notify?.('success', '已设为管理员', member.label);
                        } catch (err) {
                            console.error('[chat-app] openGroupAdminPicker onPick failed', err);
                            this.toolkit?.island?.notify?.('error', '设置失败', err?.message || '');
                        }
                    },
                });
                return null;
            },

            /**
             * ★ v0.81 群成员管理 - 移除管理员
             *   payload = { groupId, mode, aiPersonId }
             */
            async removeGroupAdmin(payload = {}) {
                const groupId = payload?.groupId || '';
                const mode = payload?.mode || 'calendar';
                const aiPersonId = payload?.aiPersonId || '';
                if (!groupId || !aiPersonId) {
                    this.toolkit?.island?.notify?.('warning', '参数缺失');
                    return null;
                }
                const sdk = window.settingsSdk;
                const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                if (!sdk?.chatGroups || !defaultUser) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                let entry = null;
                for (const m of ['calendar', 'story']) {
                    const e = sdk.chatGroups.get?.(defaultUser, groupId, m);
                    if (e) { entry = e; break; }
                }
                if (!entry) {
                    this.toolkit?.island?.notify?.('warning', '群聊已被删除');
                    return null;
                }
                const currentOwnerId = entry.ownerId || defaultUser.id;
                if (String(currentOwnerId) !== String(defaultUser.id)) {
                    this.toolkit?.island?.notify?.('warning', '当前不是群主', '仅群主可移除管理员');
                    return null;
                }
                const oldAdmins = Array.isArray(entry.adminIds) ? entry.adminIds : [];
                if (!oldAdmins.map(String).includes(String(aiPersonId))) {
                    return null; // 不在管理员列表
                }
                try {
                    const { applyGroupAdmin } = await import('./services/group-admin-service.js');
                    const res = await applyGroupAdmin({
                        sdk, user: defaultUser, groupId, mode,
                        actorId: defaultUser.id, targetId: aiPersonId, on: false,
                    });
                    if (!res?.ok) {
                        this.toolkit?.island?.notify?.('warning', '保存失败', res?.error || '');
                        return null;
                    }
                    try {
                        window.dispatchEvent(new CustomEvent('chat:group-admin-changed', {
                            detail: { groupId, mode, adminIds: res.group?.adminIds || [], entry: res.group },
                        }));
                    } catch (_) {}
                    refreshMessagesTab(this);
                    this.toolkit?.island?.notify?.('success', '已移除管理员');
                } catch (err) {
                    console.error('[chat-app] removeGroupAdmin failed', err);
                    this.toolkit?.island?.notify?.('error', '移除失败', err?.message || '');
                }
                return null;
            },

            /**
             * ★ v0.81 群成员管理 - 编辑某个成员的群昵称
             *   payload = { groupId, mode, memberId, memberLabel, memberKind, currentNickname }
             *   - 任意成员都能编辑自己(user 始终可以编辑;AI 编辑自己需要在群聊中)
             *   - 群主额外可以编辑任何成员
             *   - 复用 chatModalManager.openAiRemark(单行版本)
             */
            openGroupMemberNicknameEdit(payload = {}) {
                const groupId = payload?.groupId || '';
                const mode = payload?.mode || 'calendar';
                const memberId = payload?.memberId || '';
                const memberLabel = payload?.memberLabel || '成员';
                const memberKind = payload?.memberKind || 'ai';
                const currentNickname = payload?.currentNickname || '';
                if (!groupId || !memberId) {
                    this.toolkit?.island?.notify?.('warning', '参数缺失');
                    return null;
                }
                const sdk = window.settingsSdk;
                const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                if (!sdk?.chatGroups || !defaultUser) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                let entry = null;
                for (const m of ['calendar', 'story']) {
                    const e = sdk.chatGroups.get?.(defaultUser, groupId, m);
                    if (e) { entry = e; break; }
                }
                if (!entry) {
                    this.toolkit?.island?.notify?.('warning', '群聊已被删除');
                    return null;
                }
                // 权限判断:群主 / 管理员可以编辑任何人,其他人只能编辑自己。
                // ⚠️ 之前这里写的是 `String(memberId) === String(memberId)` —— 恒为 true，
                //    等于「谁都能改任何人」，权限判断从来没生效过。
                const isSelf = String(memberId) === String(defaultUser.id);
                const canManage = sdk.chatGroups.isAdmin?.(entry, defaultUser.id, defaultUser.id) ?? true;
                if (!canManage && !isSelf) {
                    this.toolkit?.island?.notify?.('warning', '没有权限', '仅群主 / 管理员或本人可编辑群昵称');
                    return null;
                }
                const avatarBg = memberKind === 'user' ? '#F4A6CD' : '#A8C8EC';
                chatModalManager.openAiRemark({
                    name: memberLabel,
                    avatarBg,
                    remark: currentNickname,
                    mode,
                    onSave: async (text) => {
                        try {
                            const trimmed = String(text || '').trim().slice(0, 16);
                            // 走 group-admin-service：写盘 + 「XX 给 XX 设置的群昵称是 XX」群公告
                            const { applyGroupNickname } = await import('./services/group-admin-service.js');
                            const res = await applyGroupNickname({
                                sdk, user: defaultUser, groupId, mode,
                                actorId: defaultUser.id, targetId: memberId, nickname: trimmed,
                            });
                            if (!res?.ok) {
                                this.toolkit?.island?.notify?.('warning', '保存失败', res?.error || '');
                                return;
                            }
                            try {
                                window.dispatchEvent(new CustomEvent('chat:group-nickname-changed', {
                                    detail: { groupId, mode, memberId, newNickname: trimmed, entry: res.group },
                                }));
                            } catch (_) {}
                            refreshMessagesTab(this);
                            this.toolkit?.island?.notify?.(
                                'success',
                                trimmed ? '群昵称已保存' : '群昵称已清空',
                                trimmed || memberLabel
                            );
                        } catch (err) {
                            console.error('[chat-app] openGroupMemberNicknameEdit onSave failed', err);
                            this.toolkit?.island?.notify?.('error', '保存失败', err?.message || '');
                        }
                    },
                });
                return null;
            },

            /**
             * 请「AI 群主」安排群务（任命管理员 + 取群昵称）。
             *
             * 什么时候用：群主已经转让给某个 AI 了。这时候用户自己不能再改管理员
             * 和别人的群昵称（那是群主的权力），只能按这个按钮请群主去安排。
             *
             * 做法不是「再写一套 AI 调用」，而是**把一段请求当成用户消息发给群主 AI**：
             *   - 走的还是 callAiAndSplit 那条唯一的 AI 链路
             *   - AI 输出的 [设为管理员:x] / [群昵称:x:y] 由 group-admin-service 解析执行
             *   - 每条执行都会留一条群公告
             * 这样「AI 自己在聊天里安排群务」和「用户按按钮请它安排」走的是同一套解析，
             * 不会出现两边行为不一致。
             *
             * payload = { groupId, mode }
             */
            async askGroupOwnerAiToArrange(payload = {}) {
                const groupId = String(payload?.groupId || '');
                const mode = payload?.mode === 'story' ? 'story' : 'calendar';
                if (!groupId) {
                    this.toolkit?.island?.notify?.('warning', '群 ID 缺失');
                    return null;
                }
                const sdk = window.settingsSdk;
                const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                if (!sdk?.chatGroups || !defaultUser) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                let entry = null;
                let realMode = mode;
                for (const m of [mode, mode === 'story' ? 'calendar' : 'story']) {
                    const e = sdk.chatGroups.get?.(defaultUser, groupId, m);
                    if (e) { entry = e; realMode = m; break; }
                }
                if (!entry) {
                    this.toolkit?.island?.notify?.('warning', '群聊已被删除');
                    return null;
                }
                const ownerId = sdk.chatGroups.getOwnerId(entry, defaultUser.id);
                if (String(ownerId) === String(defaultUser.id)) {
                    this.toolkit?.island?.notify?.(
                        'info', '你就是群主',
                        '直接在上面的卡片里安排就行，不用请 AI',
                    );
                    return null;
                }
                const ownerAi = sdk.aiPersons?.get?.(ownerId);
                if (!ownerAi) {
                    this.toolkit?.island?.notify?.('warning', '找不到群主的人设', '可能已被删除');
                    return null;
                }

                const svc = await import('./services/group-admin-service.js');
                const askText = svc.buildAskOwnerToArrangePrompt({ sdk, user: defaultUser, group: entry });

                // 等待期间在群聊顶栏显示「对方正在输入中」，跟普通发消息一致
                beginTyping('group', groupId);
                try {
                    const result = await callAiAndSplit({
                        aiPersonId: ownerId,
                        mode: realMode,
                        userText: askText,
                        historyLimit: 12,
                        groupId,   // 让它看到花名册 + 群管理格式，否则它不知道能输出什么 token
                    });
                    if (!result || result.ok === false) {
                        this.toolkit?.island?.notify?.('error', '群主没有回应', (result?.error || '').slice(0, 200));
                        return null;
                    }
                    // 从原文里抠出管理动作并执行（AI 可能把 token 分散在几段里，
                    // 所以用 raw 全文解析，而不是逐条消息解析）
                    // callAiAndSplit 已经把 token 拆成 type:'group_admin' 的动作段了，
                    // 这里直接取那些段，不用再对 raw 正则一遍（两份解析迟早会分叉）。
                    const actions = (result.messages || [])
                        .filter((m) => m.type === 'group_admin')
                        .map((m) => m.groupAdminAction)
                        .filter(Boolean);
                    const applied = await svc.applyGroupAdminActions({
                        sdk, user: defaultUser, groupId, mode: realMode,
                        actorId: ownerId, actions,
                    });
                    const okCount = applied.filter((r) => r?.ok).length;
                    // AI 顺带说的那些话也要落进群聊，否则用户只看到一堆公告，
                    // 不知道群主为什么这么安排
                    const ownerName = ownerAi.name || ownerAi.socialProfiles?.chat?.nickname || ownerId;
                    for (const msg of (result.messages || [])) {
                        if (msg.type === 'group_admin') continue;
                        try {
                            await sdk.chatMessages.add(defaultUser, groupId, realMode, {
                                ...msg,
                                sender: 'ai',
                                senderId: ownerId,
                                senderName: msg.senderName || ownerName,
                                conversationType: 'group',
                                conversationId: groupId,
                                timestamp: msg.timestamp || Date.now(),
                            });
                        } catch (saveErr) {
                            console.warn('[chat-app] askGroupOwnerAiToArrange save failed', saveErr);
                        }
                    }
                    try { window.invalidateRendererCache?.('chat', null); } catch (_) {}
                    try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                    refreshMessagesTab(this);
                    this.toolkit?.island?.notify?.(
                        okCount > 0 ? 'success' : 'warning',
                        okCount > 0 ? `群主安排了 ${okCount} 项群务` : '群主没有做出安排',
                        okCount > 0 ? '' : '它这次没有按格式输出，可以再试一次',
                    );
                } catch (err) {
                    console.error('[chat-app] askGroupOwnerAiToArrange failed', err);
                    this.toolkit?.island?.notify?.('error', '请求失败', err?.message || '');
                } finally {
                    endTyping('group', groupId);
                }
                return null;
            },

            /**
             * ★ v0.81 群成员管理 - AI 自动生成群昵称
             *   payload = { groupId, mode, memberId }
             *   - 基于 AI 人设的 name / nickname / role / personality 等字段启发式拼装
             *   - MVP:本地启发式生成,写盘后立即生效
             *   - hook: 预留接入真正的 AI 调用(让 AI 来给建议)
             */
            async aiGenerateGroupNickname(payload = {}) {
                const groupId = payload?.groupId || '';
                const mode = payload?.mode || 'calendar';
                const memberId = payload?.memberId || '';
                if (!groupId || !memberId) {
                    this.toolkit?.island?.notify?.('warning', '参数缺失');
                    return null;
                }
                const sdk = window.settingsSdk;
                const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                if (!sdk?.chatGroups) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                let entry = null;
                for (const m of ['calendar', 'story']) {
                    const e = sdk.chatGroups.get?.(defaultUser, groupId, m);
                    if (e) { entry = e; break; }
                }
                if (!entry) {
                    this.toolkit?.island?.notify?.('warning', '群聊已被删除');
                    return null;
                }
                const currentOwnerId = entry.ownerId || defaultUser.id;
                if (String(currentOwnerId) !== String(defaultUser.id)) {
                    this.toolkit?.island?.notify?.('warning', '当前不是群主', '仅群主可让 AI 生成群昵称');
                    return null;
                }
                try {
                    const ai = sdk.aiPersons?.get?.(memberId);
                    if (!ai) {
                        this.toolkit?.island?.notify?.('warning', '找不到该成员的人设');
                        return null;
                    }
                    const generated = generateAiGroupNickname(ai, entry);
                    if (!generated) {
                        this.toolkit?.island?.notify?.('warning', '生成失败', 'AI 人设信息不足');
                        return null;
                    }
                    // actorId 用 memberId 而不是用户 —— 这是「AI 给自己取了个群昵称」，
                    // 群公告应该写成「XX 给自己的群昵称修改为 XX」，而不是用户改的。
                    const { applyGroupNickname } = await import('./services/group-admin-service.js');
                    const res = await applyGroupNickname({
                        sdk, user: defaultUser, groupId, mode,
                        actorId: memberId, targetId: memberId, nickname: generated,
                    });
                    if (!res?.ok) {
                        this.toolkit?.island?.notify?.('warning', '保存失败', res?.error || '');
                        return null;
                    }
                    try {
                        window.dispatchEvent(new CustomEvent('chat:group-nickname-changed', {
                            detail: { groupId, mode, memberId, newNickname: generated, source: 'ai', entry: res.group },
                        }));
                    } catch (_) {}
                    refreshMessagesTab(this);
                    this.toolkit?.island?.notify?.('success', '已用 AI 生成群昵称', generated);
                } catch (err) {
                    console.error('[chat-app] aiGenerateGroupNickname failed', err);
                    this.toolkit?.island?.notify?.('error', '生成失败', err?.message || '');
                }
                return null;
            },

            /**
             * ★ v0.69 群聊设置 - 查找聊天记录
             *   payload = { groupId, mode }
             *   自动根据 mode 跳到:
             *     - calendar → memory-management-{groupId}-calendar(层级管理)
             *     - story → memory-management-{groupId}-story(层级管理,故事模式背景粉色)
             *     - 同步设 app.state.chat.currentGroupRecordMode 便于详情页读取
             */
            openGroupChatHistory(payload = {}) {
                const groupId = payload?.groupId || '';
                const mode = payload?.mode || 'calendar';
                if (!groupId) {
                    this.toolkit?.island?.notify?.('warning', '群 ID 缺失');
                    return null;
                }
                try {
                    // ★ v0.69 写入当前群聊 id 给详情页读
                    if (this?.app?.state?.chat) {
                        this.app.state.chat.currentGroupRecordMode = mode;
                        this.app.state.chat.currentGroupId = groupId;
                    }
                    // 跳到层级管理详情页(沿用私聊同款入口)
                    document.dispatchEvent(new CustomEvent('app:page-action', {
                        detail: {
                            action: 'detail',
                            appId: 'chat',
                            pageId: `memory-management-${groupId}-${mode}`,
                        },
                        bubbles: true,
                    }));
                } catch (err) {
                    console.error('[chat-app] openGroupChatHistory failed', err);
                    this.toolkit?.island?.notify?.('error', '打开失败', err?.message || '');
                }
                return null;
            },

            /**
             * ★ v0.69 群聊设置 - 清空聊天记录
             *   payload = { groupId, mode }
             *   ★ v0.85 迁移到 AcModal
             */
            async clearGroupHistory(payload = {}) {
                const groupId = payload?.groupId || '';
                const mode = payload?.mode || 'calendar';
                if (!groupId) {
                    this.toolkit?.island?.notify?.('warning', '群 ID 缺失');
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.chatMessages || !sdk?.users) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                // ★ v0.85:获取群名称
                let groupName = '群聊';
                try {
                    const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                    const groupEntry = sdk.chatGroups?.get?.(defaultUser, groupId, mode);
                    groupName = groupEntry?.name || groupName;
                } catch (_) {}
                chatModalManager?.openClearChatConfirm?.({
                    targetName: groupName,
                    targetType: 'group',
                    onConfirm: async () => {
                        try {
                            const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                            if (!defaultUser) {
                                this.toolkit?.island?.notify?.('error', '未找到默认用户');
                                return;
                            }
                            const result = await this._clearConversationMessages({
                                sdk,
                                defaultUser,
                                aiPersonId: groupId,
                                mode,
                                conversationType: 'group',
                            });
                            if (!result.ok) {
                                this.toolkit?.island?.notify?.('error', '清空失败', result.error || '');
                                return;
                            }
                            // 重画
                            if (typeof window.__detailRenderTick !== 'undefined') {
                                window.__detailRenderTick.value++;
                            }
                            refreshMessagesTab(this);
                            this.toolkit?.island?.notify?.(
                                'success',
                                '已清空聊天记录',
                                `共删除 ${result.removed} 条`
                            );
                        } catch (err) {
                            console.error('[chat-app] clearGroupHistory failed', err);
                            this.toolkit?.island?.notify?.('error', '清空失败', err?.message || '');
                        }
                    },
                });
                return null;
            },

            /**
             * ★ v0.71 私聊设置 - 清空聊天记录
             *   payload = { aiPersonId, mode }
             *   ★ v0.85 迁移到 AcModal
             */
            async clearChatHistory(payload = {}) {
                const aiPersonId = payload?.aiPersonId || '';
                const mode = payload?.mode || 'calendar';
                if (!aiPersonId) {
                    this.toolkit?.island?.notify?.('warning', '联系人 ID 缺失');
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.chatMessages || !sdk?.users) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                // ★ v0.85:获取联系人名称
                let contactName = '联系人';
                try {
                    const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                    const entry = sdk.chatFriends?.get?.(defaultUser, aiPersonId, mode);
                    if (entry?.remark) {
                        contactName = entry.remark;
                    } else {
                        const meta = window.aiMeta?.getAiMeta?.(aiPersonId, mode);
                        contactName = meta?.name || aiPersonId;
                    }
                } catch (_) {}
                chatModalManager?.openClearChatConfirm?.({
                    targetName: contactName,
                    targetType: 'private',
                    onConfirm: async () => {
                        try {
                            const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                            if (!defaultUser) {
                                this.toolkit?.island?.notify?.('error', '未找到默认用户');
                                return;
                            }
                            const result = await this._clearConversationMessages({
                                sdk,
                                defaultUser,
                                aiPersonId,
                                mode,
                                conversationType: 'private',
                            });
                            if (!result.ok) {
                                this.toolkit?.island?.notify?.('error', '清空失败', result.error || '');
                                return;
                            }
                            // 重画(私聊详情页 + 消息列表 + 日历视图共用同一 tick)
                            if (typeof window.__detailRenderTick !== 'undefined') {
                                window.__detailRenderTick.value++;
                            }
                            try {
                                if (typeof window.invalidateRendererCache === 'function') {
                                    window.invalidateRendererCache('chat', null);
                                }
                            } catch (_) {}
                            try {
                                window.__appRendererBridge?.syncNow?.({ force: true });
                            } catch (_) {}
                            refreshMessagesTab(this);
                            this.toolkit?.island?.notify?.(
                                'success',
                                '已清空聊天记录',
                                `共删除 ${result.removed} 条`
                            );
                        } catch (err) {
                            console.error('[chat-app] clearChatHistory failed', err);
                            this.toolkit?.island?.notify?.('error', '清空失败', err?.message || '');
                        }
                    },
                });
                return null;
            },

            /**
             * ★ v0.71 私有:把某个 (aiPersonId, mode) 会话的主表 / 归档表消息全部物理清空。
             *   - 主表:sdk.chatMessages.removeAllForConversation (优先) 或 list+remove 兜底
             *   - 归档:sdk.chatArchive.cache 直删 + db.remove + 计数
             *   - lastMessage:走 sdk.chatFriends.update 清成 null/0,消息列表预览立即更新
             * 返回 { ok, removed, error? }
             */
            async _clearConversationMessages({ sdk, defaultUser, aiPersonId, mode, conversationType = 'private' }) {
                let removed = 0;
                try {
                    // 1) 主表 chatMessages
                    if (typeof sdk.chatMessages.removeAllForConversation === 'function') {
                        removed += await sdk.chatMessages.removeAllForConversation(defaultUser, aiPersonId, mode);
                    } else if (typeof sdk.chatMessages.list === 'function') {
                        const list = sdk.chatMessages.list(defaultUser, aiPersonId, mode) || [];
                        for (const m of list) {
                            try {
                                if (typeof sdk.chatMessages.remove === 'function') {
                                    await sdk.chatMessages.remove(m.id);
                                }
                                removed++;
                            } catch (_) {}
                        }
                    }

                    // 2) 归档表 chatArchiveMessages(私聊 / 群聊都走 aiPersonId(=conversationId) 区分)
                    //    settings-sdk 没有把 cache 暴露到 sdk.chatArchive,但 record.id === 原消息 id
                    //    (见 chat-archive.js archive() 实现),所以直接从 db 删就行。
                    if (sdk?.toolkit?.db?.getAll) {
                        try {
                            const archiveRecords = await sdk.toolkit.db.getAll('chatArchiveMessages') || [];
                            for (const rec of archiveRecords) {
                                if (!rec || rec.aiPersonId !== aiPersonId) continue;
                                if (mode && rec.mode !== mode) continue;
                                if (conversationType && rec.conversationType !== conversationType) continue;
                                try {
                                    await sdk.toolkit.db.remove('chatArchiveMessages', rec.id);
                                    removed++;
                                } catch (_) {}
                            }
                        } catch (err) {
                            console.warn('[chat-app] _clearConversationMessages: archive cleanup failed', err);
                        }
                    }

                    // 3) 重置 lastMessage / lastMessageAt,消息列表预览立刻消失
                    try {
                        if (typeof sdk.chatFriends?.update === 'function') {
                            await sdk.chatFriends.update(sdk, defaultUser, aiPersonId, mode, {
                                lastMessage: null,
                                lastMessageAt: 0,
                                unreadCount: 0,
                            });
                        }
                    } catch (_) { /* entry 可能不存在,静默 */ }

                    // 4) 派发业务事件,让日历视图 / 存档页等也同步刷新
                    try {
                        window.dispatchEvent(new CustomEvent('chat:conversation-cleared', {
                            detail: { aiPersonId, mode, conversationType, removed },
                        }));
                    } catch (_) {}

                    return { ok: true, removed };
                } catch (err) {
                    console.error('[chat-app] _clearConversationMessages failed', err);
                    return { ok: false, error: err?.message || String(err), removed };
                }
            },

            /**
             * ★ v0.69 群聊设置 - 退出群聊
             *   payload = { groupId, mode }
             *   ★ v0.85 迁移到 AcModal
             */
            async exitGroup(payload = {}) {
                const groupId = payload?.groupId || '';
                const mode = payload?.mode || 'calendar';
                if (!groupId) {
                    this.toolkit?.island?.notify?.('warning', '群 ID 缺失');
                    return null;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.chatGroups || !sdk?.users) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return null;
                }
                // ★ v0.85:获取群名称
                let groupName = '群聊';
                try {
                    const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                    const groupEntry = sdk.chatGroups?.get?.(defaultUser, groupId, mode);
                    groupName = groupEntry?.name || groupName;
                } catch (_) {}
                chatModalManager?.openExitGroupConfirm?.({
                    groupName: groupName,
                    onConfirm: async () => {
                        try {
                            const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
                            if (!defaultUser) {
                                this.toolkit?.island?.notify?.('error', '未找到默认用户');
                                return;
                            }
                            const ok = await sdk.chatGroups.remove(sdk, defaultUser, groupId, mode);
                            if (!ok) {
                                this.toolkit?.island?.notify?.('warning', '退出失败');
                                return;
                            }
                            // 派发事件 + 重画消息列表 + 关闭详情
                            try {
                                window.dispatchEvent(new CustomEvent('chat:group-removed', {
                                    detail: { groupId, mode },
                                }));
                            } catch (_) {}
                            if (typeof window.__detailRenderTick !== 'undefined') {
                                window.__detailRenderTick.value++;
                            }
                            refreshMessagesTab(this);
                            // 关闭当前 detail 回到消息列表
                            try {
                                this.toolkit?.actions?.detail?.('') ||
                                document.dispatchEvent(new CustomEvent('app:page-action', {
                                    detail: { action: 'detail', appId: 'chat', pageId: '' },
                                    bubbles: true,
                                }));
                            } catch (_) {}
                            this.toolkit?.island?.notify?.('success', '已退出群聊');
                        } catch (err) {
                            console.error('[chat-app] exitGroup failed', err);
                            this.toolkit?.island?.notify?.('error', '退出失败', err?.message || '');
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
             * ★ v0.88 K 链记忆设置弹窗入口
             *
             * 触发链路和「上下文长度」一样:
             *   <div id="set-kchain" data-app-action="..."> → framework click 委托
             *   → invokeMethod('chat', 'openKChainModal', payload) → 本方法
             *
             * 「还差几轮」在这里现算再传进弹窗 —— 数回合要用 chat-app 的回合口径
             * (`context-rounds.js`),弹窗层和 SDK 层都拿不到。
             *
             * @param {Object} payload { contactId: string, mode: string }
             */
            async openKChainModal(payload = {}) {
                const contactId = payload?.contactId || '';
                const mode = payload?.mode === 'story' ? 'story' : 'calendar';
                if (!contactId) {
                    console.warn('[chat-app] openKChainModal: contactId empty');
                    this.toolkit?.island?.notify?.('error', '打开失败', '缺少联系人 ID');
                    return null;
                }

                const sdk = window.settingsSdk;
                if (!sdk?.kChain) {
                    this.toolkit?.island?.notify?.('warning', '还没准备好', '设置 SDK 未就绪,稍等一下再试');
                    return null;
                }

                let contactName = contactId;
                try {
                    const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                    const entry = sdk?.chatFriends?.get?.(defaultUser, contactId, mode);
                    if (entry) contactName = entry.displayName || entry.remark || contactId;
                } catch (_) { /* 显示名拿不到就用 id */ }

                const pending = countKChainPending(contactId, mode);
                const { chatModalManager } = await import('./components/chat-modal-registry.js');

                const repaint = () => {
                    // async renderMode 下必须 invalidate + syncNow 二段式(AGENTS.md §32),
                    // 单靠 __detailRenderTick++ 在缓存命中时不会重画
                    try { window.invalidateRendererCache?.('chat', null); } catch (_) {}
                    try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                };

                chatModalManager.openKChain({
                    aiPersonId: contactId,
                    contactName,
                    mode,
                    pending,
                    onSave: async ({ enabled, windowSize, content }) => {
                        try {
                            await sdk.kChain.setConfig(contactId, { enabled, windowSize });
                            // 正文单独走 editCurrent:它改的是「当前这一版」,不该新增版本号
                            const before = sdk.kChain.getSlot(contactId, mode)?.current?.content || '';
                            if (String(content || '') !== String(before)) {
                                await sdk.kChain.editCurrent(contactId, mode, content);
                            }
                            this.toolkit?.island?.notify?.(
                                'success',
                                '已保存',
                                enabled ? `K 链记忆:每 ${windowSize} 回合更新一次` : 'K 链记忆已关闭',
                            );
                        } catch (err) {
                            console.error('[chat-app] openKChainModal: save failed', err);
                            this.toolkit?.island?.notify?.('error', '保存失败', err?.message || '请重试');
                        }
                    },
                    onClear: async () => {
                        try {
                            await sdk.kChain.reset(contactId, mode);
                            this.toolkit?.island?.notify?.('info', '已清空', '回合数也从头开始数');
                        } catch (err) {
                            console.error('[chat-app] openKChainModal: clear failed', err);
                        }
                    },
                    onClose: repaint,
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
                        // ★ v0.61.3:接 set-context-dilute
                        //   - contextLength 单位已经从「条」改成「回合」(chat-settings UI)
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
            //
            //   ★ v0.82 群聊版:新增 payload.isGroup + payload.groupId + payload.mode,
            //     method 内部切到 sdk.groupReplyPrompts(挂在 chatGroup.prompts[] 顶层,
            //     N 个 AI 共享)。私聊 payload 不带这些字段,行为不变。
            // ============================================================

            /**
             * ★ v0.82 群聊版辅助:从 payload 拆出「prompt 操作的目标 SDK」
             *   - 私聊 → { isGroup:false, sdkReply: sdk.replyPrompts, aiPersonId, user }
             *   - 群聊 → { isGroup:true,  sdkReply: sdk.groupReplyPrompts, groupId, mode, user }
             *   私聊 SDK 仍然只接 aiPersonId;群聊 SDK 总是接 user + groupId + mode。
             *
             *   调用方拿到 sdkReply 后,操作方式完全平行(都是 list/listActive/get/add/...)。
             */
            _resolvePromptTarget(payload = {}) {
                const sdk = window.settingsSdk;
                const isGroup = payload?.isGroup === true;
                const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.() || null;
                if (isGroup) {
                    return {
                        isGroup: true,
                        groupId: String(payload?.groupId || ''),
                        mode: payload?.mode === 'story' ? 'story' : 'calendar',
                        aiPersonId: String(payload?.aiPersonId || ''), // 群聊版也带 aiPersonId 占位,某些 method 仍用
                        user,
                        sdkReply: sdk?.groupReplyPrompts || null,
                    };
                }
                return {
                    isGroup: false,
                    groupId: null,
                    mode: null,
                    aiPersonId: String(payload?.aiPersonId || ''),
                    user,
                    sdkReply: sdk?.replyPrompts || null,
                };
            },

            /**
             * 启停切换 replyPrompt。
             * payload: { aiPersonId, promptId }
             *
             * 系统虚拟 prompt(以 'system-' 开头)不能被 toggle,
             * 走 SDK 会返回 null → 给用户提示,不再重画。
             */
            async toggleReplyPromptActive(payload = {}) {
                const promptId = String(payload?.promptId || '');
                if (!promptId) {
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
                const target = this._resolvePromptTarget(payload);
                if (!target.sdkReply) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }
                let next = null;
                if (target.isGroup) {
                    if (!target.groupId) return null;
                    next = await target.sdkReply.toggleActive(target.user, target.groupId, target.mode, promptId);
                } else {
                    if (!target.aiPersonId) return null;
                    next = await target.sdkReply.toggleActive(target.aiPersonId, promptId);
                }
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
                        detail: {
                            aiPersonId: target.aiPersonId,
                            groupId: target.groupId,
                            isGroup: target.isGroup,
                            promptId,
                            action: 'toggle',
                            active: next.active,
                        },
                    }));
                } catch (_) {}
                return next;
            },

            /**
             * 上移一条 replyPrompt(order 减小,数组里往前挪一位)。
             * payload: { aiPersonId, promptId }
             */
            async moveReplyPromptUp(payload = {}) {
                const promptId = String(payload?.promptId || '');
                if (!promptId) return null;
                const target = this._resolvePromptTarget(payload);
                if (!target.sdkReply) return null;
                let list = [];
                if (target.isGroup) {
                    if (!target.groupId) return null;
                    list = target.sdkReply.list(target.user, target.groupId, target.mode) || [];
                } else {
                    if (!target.aiPersonId) return null;
                    list = target.sdkReply.list(target.aiPersonId) || [];
                }
                const idx = list.findIndex((p) => p && p.id === promptId);
                if (idx <= 0) return null; // 第一条 / 不存在
                const newOrder = list.slice();
                [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
                if (target.isGroup) {
                    await target.sdkReply.setOrder(target.user, target.groupId, target.mode, newOrder.map((p) => p.id));
                } else {
                    await target.sdkReply.setOrder(target.aiPersonId, newOrder.map((p) => p.id));
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
                return true;
            },

            /**
             * 下移一条 replyPrompt。
             * payload: { aiPersonId, promptId } 或 { isGroup, groupId, mode, promptId }
             */
            async moveReplyPromptDown(payload = {}) {
                const promptId = String(payload?.promptId || '');
                if (!promptId) return null;
                const target = this._resolvePromptTarget(payload);
                if (!target.sdkReply) return null;
                let list = [];
                if (target.isGroup) {
                    if (!target.groupId) return null;
                    list = target.sdkReply.list(target.user, target.groupId, target.mode) || [];
                } else {
                    if (!target.aiPersonId) return null;
                    list = target.sdkReply.list(target.aiPersonId) || [];
                }
                const idx = list.findIndex((p) => p && p.id === promptId);
                if (idx < 0 || idx >= list.length - 1) return null; // 最后一条 / 不存在
                const newOrder = list.slice();
                [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                if (target.isGroup) {
                    await target.sdkReply.setOrder(target.user, target.groupId, target.mode, newOrder.map((p) => p.id));
                } else {
                    await target.sdkReply.setOrder(target.aiPersonId, newOrder.map((p) => p.id));
                }
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
                const promptId = String(payload?.promptId || '');
                if (!promptId) return false;
                const target = this._resolvePromptTarget(payload);
                if (!target.sdkReply) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return false;
                }
                let cur = null;
                if (target.isGroup) {
                    if (!target.groupId) return false;
                    cur = target.sdkReply.get(target.user, target.groupId, target.mode, promptId);
                } else {
                    if (!target.aiPersonId) return false;
                    cur = target.sdkReply.get(target.aiPersonId, promptId);
                }
                if (!cur) {
                    this.toolkit?.island?.notify?.('warning', '提示词不存在', '可能被删除');
                    return false;
                }
                const confirmTitle = '删除提示词';
                const confirmText = `确认删除「${cur.title}」?该操作不可撤销。`;
                // 走 framework 顶层确认弹窗
                const _doDelete = async () => {
                    let ok = false;
                    if (target.isGroup) {
                        ok = await target.sdkReply.remove(target.user, target.groupId, target.mode, promptId);
                    } else {
                        ok = await target.sdkReply.remove(target.aiPersonId, promptId);
                    }
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
                            detail: {
                                aiPersonId: target.aiPersonId,
                                groupId: target.groupId,
                                isGroup: target.isGroup,
                                promptId,
                                action: 'remove',
                            },
                        }));
                    } catch (_) {}
                };
                if (typeof window.__phoneConfirm?.request === 'function') {
                    window.__phoneConfirm.request({
                        title: confirmTitle,
                        text: confirmText,
                        confirmLabel: '删除',
                        danger: true,
                        onConfirm: _doDelete,
                        onCancel: () => {},
                    });
                    return true;
                }
                // 退化方案:无确认弹窗 API,直接删
                await _doDelete();
                return true;
            },

            /**
             * 打开「编辑 replyPrompt」弹窗。
             * payload: { aiPersonId, promptId } 或 { isGroup, groupId, mode, promptId }
             */
            async openEditReplyPromptModal(payload = {}) {
                const promptId = String(payload?.promptId || '');
                if (!promptId) return null;
                const target = this._resolvePromptTarget(payload);
                if (!target.sdkReply) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }
                let cur = null;
                if (target.isGroup) {
                    if (!target.groupId) return null;
                    cur = target.sdkReply.get(target.user, target.groupId, target.mode, promptId);
                } else {
                    if (!target.aiPersonId) return null;
                    cur = target.sdkReply.get(target.aiPersonId, promptId);
                }
                if (!cur) {
                    this.toolkit?.island?.notify?.('warning', '提示词不存在', '可能被删除');
                    return null;
                }
                // 这条如果是从 Prompt 库拉来的，把库里的原文捞出来，
                // 弹窗里就能给一个「复原原文」按钮 —— 用户改坏了能退回去，
                // 不用自己记得原来写的什么。自己新建的没有 sourceLibraryPromptId，
                // originContent 是空串，按钮不显示。
                let originContent = '';
                if (cur.sourceLibraryPromptId) {
                    try {
                        const origin = await window.settingsSdk?.promptLibrary?.getPrompt?.(cur.sourceLibraryPromptId);
                        originContent = String(origin?.text || '');
                    } catch (err) {
                        console.warn('[chat-app] 读 Prompt 库原文失败', err);
                    }
                }
                // 复用 settings 侧的 prompt 编辑 modal(单 title + content + source + active)
                chatModalManager.openEditReplyPrompt({
                    initial: {
                        title: cur.title || '',
                        content: cur.content || '',
                        source: cur.source || 'custom',
                        active: cur.active !== false,
                    },
                    originContent,
                    onSave: async (next) => {
                        if (!next?.title) {
                            this.toolkit?.island?.notify?.('warning', '保存失败', '标题不能为空');
                            return;
                        }
                        const patch = {
                            title: next.title,
                            content: next.content || '',
                            source: next.source || 'custom',
                            active: !!next.active,
                        };
                        let updated = null;
                        if (target.isGroup) {
                            updated = await target.sdkReply.update(target.user, target.groupId, target.mode, promptId, patch);
                        } else {
                            updated = await target.sdkReply.update(target.aiPersonId, promptId, patch);
                        }
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
                                detail: {
                                    aiPersonId: target.aiPersonId,
                                    groupId: target.groupId,
                                    isGroup: target.isGroup,
                                    promptId,
                                    action: 'update',
                                    record: updated,
                                },
                            }));
                        } catch (_) {}
                    },
                });
                return true;
            },

            /**
             * 打开「新增 replyPrompt」弹窗。
             * payload: { aiPersonId } 或 { isGroup, groupId, mode }
             */
            async openCreateReplyPromptModal(payload = {}) {
                const target = this._resolvePromptTarget(payload);
                if (!target.sdkReply) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }
                if (target.isGroup && !target.groupId) return null;
                if (!target.isGroup && !target.aiPersonId) return null;
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
                        const patch = {
                            title: next.title,
                            content: next.content || '',
                            source: next.source || 'custom',
                            active: next.active !== false,
                        };
                        let created = null;
                        if (target.isGroup) {
                            created = await target.sdkReply.add(target.user, target.groupId, target.mode, patch);
                        } else {
                            created = await target.sdkReply.add(target.aiPersonId, patch);
                        }
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
                                detail: {
                                    aiPersonId: target.aiPersonId,
                                    groupId: target.groupId,
                                    isGroup: target.isGroup,
                                    promptId: created.id,
                                    action: 'create',
                                    record: created,
                                },
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
                const promptId = String(payload?.promptId || '');
                if (!promptId) return null;
                const target = this._resolvePromptTarget(payload);
                if (!target.sdkReply) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }
                if (target.isGroup && !target.groupId) return null;
                if (!target.isGroup && !target.aiPersonId) return null;
                const sdk = window.settingsSdk;
                if (!sdk?.promptLibrary) {
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
                    let existing = [];
                    if (target.isGroup) {
                        existing = target.sdkReply.list(target.user, target.groupId, target.mode) || [];
                    } else {
                        existing = target.sdkReply.list(target.aiPersonId) || [];
                    }
                    const dup = existing.find((p) => p && p.sourceLibraryPromptId === promptId);
                    if (dup) {
                        this.toolkit?.island?.notify?.('info', '已拉取过', dup.title || '该条目');
                        return null;
                    }
                } catch (_) { /* 静默,不影响主流程 */ }
                // 写入 replyPrompts / groupReplyPrompts
                //   - title 取 prompt.text 第一行前 24 字(避免空标题)
                //   - source = 'prompt-library:{libraryId}'(来源标识)
                //   - sourceLibraryPromptId 用于去重
                //   ★ v0.61.8.8 拉过来的库条目默认 active=false(只在「可用 Prompt」区展示,
                //     不进「当前上下文」;用户想用就手动在「可用 Prompt」区启用)
                const firstLine = (pr.text || '').split('\n')[0] || '';
                const title = firstLine.slice(0, 24) || path || promptId;
                const patch = {
                    title,
                    content: pr.text || '',
                    source: entry.library?.id ? `prompt-library:${entry.library.id}` : 'prompt-library',
                    active: false,
                    sourceLibraryPromptId: promptId,
                    sourcePath: path,
                };
                let created = null;
                if (target.isGroup) {
                    created = await target.sdkReply.add(target.user, target.groupId, target.mode, patch);
                } else {
                    created = await target.sdkReply.add(target.aiPersonId, patch);
                }
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
                        detail: {
                            aiPersonId: target.aiPersonId,
                            groupId: target.groupId,
                            isGroup: target.isGroup,
                            promptId: created.id,
                            action: 'pull-from-library',
                            record: created,
                        },
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
                const promptIdsInOrder = Array.isArray(payload?.promptIdsInOrder) ? payload.promptIdsInOrder : [];
                if (promptIdsInOrder.length === 0) {
                    return null;
                }
                const target = this._resolvePromptTarget(payload);
                if (!target.sdkReply?.setOrder) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试');
                    return null;
                }
                if (target.isGroup && !target.groupId) return null;
                if (!target.isGroup && !target.aiPersonId) return null;
                try {
                    if (target.isGroup) {
                        await target.sdkReply.setOrder(target.user, target.groupId, target.mode, promptIdsInOrder);
                    } else {
                        await target.sdkReply.setOrder(target.aiPersonId, promptIdsInOrder);
                    }
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
                //   ★ v0.82 群聊版:key 改用 groupId,内存结构按 aiPersonId/groupId 分桶
                if (!this.app.state) this.app.state = {};
                if (!this.app.state.chat) this.app.state.chat = {};
                if (!this.app.state.chat.contextOrder) this.app.state.chat.contextOrder = {};
                const orderKey = target.isGroup ? `group::${target.groupId}` : target.aiPersonId;
                this.app.state.chat.contextOrder[orderKey] = promptIdsInOrder.slice();
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
                        detail: {
                                aiPersonId: target.aiPersonId,
                                groupId: target.groupId,
                                isGroup: target.isGroup,
                                action: 'reorder',
                                promptIdsInOrder: promptIdsInOrder.slice(),
                            },
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
                // 1) 从 DOM 读「当前上下文」section 当前顺序
                const listEl = document.querySelector('.prompt-manager .pm-active-list');
                const rootEl = document.querySelector('.prompt-manager');
                // ★ v0.82 群聊版:从 data-* 读 groupId / mode,优先级 payload → DOM
                const domGroupId = rootEl?.getAttribute('data-group-id') || '';
                const domIsGroup = rootEl?.getAttribute('data-is-group') === 'true';
                const target = this._resolvePromptTarget({
                    isGroup: payload?.isGroup !== undefined ? payload.isGroup : domIsGroup,
                    groupId: payload?.groupId || domGroupId,
                    mode: payload?.mode || rootEl?.getAttribute('data-chat-mode') || 'calendar',
                    aiPersonId: payload?.aiPersonId || rootEl?.getAttribute('data-ai-person-id') || '',
                });
                const ids = listEl
                    ? Array.from(listEl.querySelectorAll('.pm-card.pm-item'))
                        .map((el) => el.getAttribute('data-prompt-id') || el.dataset?.promptId)
                        .filter(Boolean)
                    : [];
                if ((target.isGroup && !target.groupId) || (!target.isGroup && !target.aiPersonId)) {
                    try { this.toolkit?.island?.notify?.('warning', '无法保存', '未找到当前对象'); } catch (_) {}
                    return null;
                }
                if (ids.length === 0) {
                    try { this.toolkit?.island?.notify?.('info', '无需保存', '当前上下文为空'); } catch (_) {}
                    return null;
                }
                // 2) 落盘到 IndexedDB(走 sdk.replyPrompts.setOrder / sdk.groupReplyPrompts.setOrder)
                if (!target.sdkReply?.setOrder) {
                    try { this.toolkit?.island?.notify?.('error', 'SDK 未就绪', '请稍后再试'); } catch (_) {}
                    return null;
                }
                try {
                    if (target.isGroup) {
                        await target.sdkReply.setOrder(target.user, target.groupId, target.mode, ids);
                    } else {
                        await target.sdkReply.setOrder(target.aiPersonId, ids);
                    }
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
                const orderKey = target.isGroup ? `group::${target.groupId}` : target.aiPersonId;
                this.app.state.chat.contextOrder[orderKey] = ids.slice();
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
                return {
                    aiPersonId: target.aiPersonId,
                    groupId: target.groupId,
                    isGroup: target.isGroup,
                    saved: ids.length,
                    ids,
                };
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
                const page = document.querySelector('.app-shell[data-app-id="chat"] .chat-settings');
                if (!page) {
                    console.warn('[chat-app] initChatSettingsInteractions: .chat-settings not found');
                    return;
                }
                if (page.__chatSettingsInteractionsBound) {
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

                        if (aiPersonId) {
                            openAiRemarkModal(aiPersonId, mode);
                        }
                        event.preventDefault();
                        event.stopPropagation();
                    });
                }

                // ★ v0.67.x 互动统计自动刷新:
                //   - chat-settings 打开后,每 4s 重读一次 chatMessages,统计有变化时
                //     **就地更新 .chat-stat-value 文本** + 写回 [data-*] 钩子,**不再**
                //     调 invalidateRendererCache / bridge.syncNow({force:true})。
                //   - 历史实现走 framework 全页 v-html 重建,会导致 .chat-settings-page 滚动
                //     位置被重置,体感像「页面被强刷 / 自动回滚到顶部」,且对性能也是浪费。
                //   - timer 绑定到 page 元素上,framework v-html 重建不影响旧 timer
                //   - 离开 chat-settings 时由 closeDetail 清掉(见下)
                const statsRefreshIntervalMs = 4000;
                let lastStatsSig = '';
                const computeSig = (msgList) => {
                    const daySet = new Set();
                    let aiCount = 0;
                    for (const m of msgList) {
                        if (m && m.sender === 'ai') aiCount += 1;
                        const ts = Number(m && m.timestamp);
                        if (!Number.isFinite(ts) || ts <= 0) continue;
                        const d = new Date(ts);
                        daySet.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
                    }
                    return `${msgList.length}|${aiCount}|${daySet.size}`;
                };
                const patchStatsDom = (grid, msgList) => {
                    // 计算四组数字
                    const daySet = new Set();
                    let aiCount = 0;
                    for (const m of msgList) {
                        if (m && m.sender === 'ai') aiCount += 1;
                        const ts = Number(m && m.timestamp);
                        if (!Number.isFinite(ts) || ts <= 0) continue;
                        const d = new Date(ts);
                        daySet.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
                    }
                    const total = msgList.length;
                    const chatDays = daySet.size;
                    const avgPerDay = chatDays > 0 ? String(Math.ceil(total / chatDays)) : '0';
                    // 写回 data-* 钩子(下次进来不会过时)
                    grid.dataset.totalMessages = String(total);
                    grid.dataset.aiReplies = String(aiCount);
                    grid.dataset.chatDays = String(chatDays);
                    grid.dataset.avgPerDay = avgPerDay;
                    // 就地写四张 .chat-stat-value 文本(避免重建 DOM → 滚动位置保留)
                    const valueNodes = grid.querySelectorAll('.chat-stat-value');
                    if (valueNodes.length >= 4) {
                        valueNodes[0].textContent = String(total);
                        valueNodes[1].textContent = String(aiCount);
                        valueNodes[2].textContent = String(chatDays);
                        valueNodes[3].textContent = avgPerDay;
                    }
                };
                page.__chatSettingsStatsTimer = setInterval(() => {
                    try {
                        // 详情页已被关闭(page 节点已从 DOM 移除)就停 timer
                        if (!document.body.contains(page)) {
                            clearInterval(page.__chatSettingsStatsTimer);
                            page.__chatSettingsStatsTimer = null;
                            return;
                        }
                        const aiIdInput = page.querySelector('#set-remark-aiid');
                        const modeInput = page.querySelector('#set-remark-mode');
                        const aiPersonId = aiIdInput?.value || page.dataset.contactId || '';
                        const mode = modeInput?.value || 'calendar';
                        if (!aiPersonId) return;

                        const sdk = window.settingsSdk;
                        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                        const msgList = (sdk?.chatMessages?.list && defaultUser)
                            ? sdk.chatMessages.list(defaultUser, aiPersonId, mode)
                            : [];
                        const sig = computeSig(msgList);
                        if (sig === lastStatsSig) return; // 没变化,跳过
                        lastStatsSig = sig;
                        // ★ 就地更新四张统计卡的数字(不动其他 DOM)
                        const grid = page.querySelector('.chat-stat-grid[data-chat-settings-stats]');
                        if (grid) patchStatsDom(grid, msgList);
                    } catch (err) {
                        // 静默 — 不影响聊天设置其他交互
                    }
                }, statsRefreshIntervalMs);
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
            },

            /**
             * ★ 点击日期 div 展开当天面板
             *   - 用 window.__chatCalendarViewSelectedDate 持久化「当前展开的日期」,
             *     renderCalendarViewPage 重新渲染时能记住状态
             *   - 由于面板 header 已经没有关闭按钮，state 持久化只是个无害的旁路
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
             * ★ 保留 closeCalendarDay method 兜底（理论上没有关闭按钮就不会触发）
             *   - 外部如果通过别的入口想清掉展开状态，仍然可以走这里
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

            /** 为群聊详情页绑定输入区与工具栏交互(每次进 detail 都会调用一次,这里要做幂等) */
            async initGroupChatInteractions(providedEl) {
                console.log('[chat-group] initGroupChatInteractions START, providedEl=', !!providedEl);
                // ★ FIX v0.69:跟私聊对齐 — MutationObserver 驱动,providedEl 由 observer 直接传入
                //   不用 queueMicrotask + waitForElement(会拿到 v-html 替换前的旧节点)
                const chatGroup = providedEl || document.querySelector('.app-shell[data-app-id="chat"] .chat-group');
                if (!chatGroup) {
                    return;
                }
                if (chatGroup.__chatGroupInteractionsBound) {
                    return;
                }
                chatGroup.__chatGroupInteractionsBound = true;
                console.log('[chat-group] chatGroup bound, groupId=', chatGroup.dataset.groupId);

                // ★ v0.49 表情选择器面板 — 首次绑定时预填缓存 + 触发重画
                //   v0.49.1 修复:之前调 _fillEmojiPickerImages 因 DOM 是 loading HTML
                //   查不到 .chat-emoji-cell 死锁 → 永远 loading
                // ★ v0.70:抽出到 components/chat-emoji-panel.js
                const { prerenderEmojiPickerOnInit, scrollChatToBottomOnInit } = await import('./components/chat-emoji-panel.js');
                await prerenderEmojiPickerOnInit(chatGroup);

                // ★ v0.50 进入群聊页即滚到底(同上,跟私聊保持一致)
                scrollChatToBottomOnInit(chatGroup);

                // 「对方正在输入中」状态重放（同私聊，见 initPrivateChatInteractions 的注释）
                applyTypingToRoot(chatGroup);

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
                const refreshGroupChat = () => {
                    const gid = chatGroup.dataset.groupId || groupId || '';
                    // pageId 是 group-${id}，只传裸 id 清不到缓存
                    try { window.invalidateRendererCache?.('chat', `group-${gid}`); } catch (_) {}
                    try { window.invalidateRendererCache?.('chat', gid); } catch (_) {}
                    try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
                };

                // ★ v0.70:抽到 components/chat-sender-profile.js
                const { resolveSenderProfile } = await import('./components/chat-sender-profile.js');
                const _resolveSenderInfo = () => {
                    const { sender, senderName, userAvatar, userAvatarBg } = resolveSenderProfile();
                    return { sender, senderName, userAvatar, userAvatarBg };
                };
                // ★ v0.70:多选模式工具抽到 components/chat-multi-select.js
                const { createMultiSelectController } = await import('./components/chat-multi-select.js');
                const multiSelect = createMultiSelectController(chatGroup);
                // ★ v0.70:长按发送按钮 + Enter 键发送抽到 components/chat-press-sender.js
                const { createChatSendHandlers } = await import('./components/chat-press-sender.js');

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
                    // ★ v0.70:统一从 chat-sender-profile.js 拿 sender + senderName
                    const { sender, senderName } = _resolveSenderInfo();
                    if (!sender) {
                        window.__phoneIsland?.notify?.('error', '发送失败', '未找到默认用户');
                        return;
                    }

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

                    const ident = resolveGroupWriteIdentity(sdk, sender, groupId, mode, senderName);
                    const msg = {
                        sender: ident.sender,
                        senderName: ident.senderName,
                        senderId: ident.senderId,
                        type: 'text',
                        content: text,
                        timestamp: Date.now(),
                        ...(replyTo ? { replyTo } : {}),
                    };

                    try {
                        const saved = await sdk.chatMessages.add(sender, groupId, mode, {
                            ...msg,
                            conversationType: 'group',
                            conversationId: groupId,
                        });
                        if (!saved) {
                            window.__phoneIsland?.notify?.('error', '发送失败', '请重试');
                            return null;
                        }
                        // 清 renderer 缓存 + syncNow
                        refreshGroupChat();

                        // ★ v0.62 群聊 lastMessage(消息列表页预览)
                        try {
                            if (sdk.chatGroups?.updateLastMessage && sender) {
                                await sdk.chatGroups.updateLastMessage(sdk, sender, groupId, mode, {
                                    content: text,
                                    timestamp: saved.timestamp,
                                    senderName: ident.senderName,
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
                        return saved;
                    } catch (err) {
                        console.warn('[chat-app] group send text failed:', err);
                        window.__phoneIsland?.notify?.('error', '发送失败', err?.message || '请重试');
                        return null;
                    }
                };

                // 短按有字只发字；没字或长按都调 API。没字不写空气泡。
                if (sendBtn) {
                    const PRESS_THRESHOLD_MS = 800;
                    const { bindEnterToSend, bindPressToSend } = createChatSendHandlers({
                        sendBtn,
                        messageInput,
                        threshold: PRESS_THRESHOLD_MS,
                        requireTextOnStart: false,
                        doSend,
                        onLongPress: async () => {
                            const text = (messageInput?.innerText || messageInput?.textContent || '').trim();
                            beginTyping('group', groupId);
                            try {
                                if (text) {
                                    const saved = await doSend();
                                    if (!saved) return;
                                }
                                const inst = externalAppRegistry?.getApp?.('chat') || window.__chatAppSingleton;
                                if (inst?.methods?.sendGroupMessageWithAi) {
                                    await inst.methods.sendGroupMessageWithAi({
                                        groupId, mode, text, silentIsland: true,
                                    });
                                } else {
                                    window.__phoneIsland?.notify?.('error', '群聊 AI 入口未找到');
                                }
                            } catch (err) {
                                console.warn('[chat-app] group long-press AI failed', err);
                                window.__phoneIsland?.notify?.('error', 'AI 调用失败', err?.message || '');
                            } finally {
                                endTyping('group', groupId);
                            }
                        },
                    });
                    bindEnterToSend();
                    bindPressToSend();
                }

                /**
                 * 群聊工具栏：图片 / 语音 / 自定义 / 位置 / 红包 / 转账 / @成员 / 公告 / 成员 / 收藏
                 */
                const handleGroupToolBar = async (action) => {
                    const sdk = window.settingsSdk;
                    if (!sdk) {
                        window.__phoneIsland?.notify?.('error', 'SDK 未就绪');
                        return;
                    }
                    const senderInfo = _resolveSenderInfo();
                    if (!senderInfo.sender) {
                        window.__phoneIsland?.notify?.('error', '未找到默认用户');
                        return;
                    }
                    const { sender, senderName, userAvatar, userAvatarBg } = senderInfo;
                    const ident = resolveGroupWriteIdentity(sdk, sender, groupId, mode, senderName);
                    const withIdent = (fields = {}) => ({
                        ...fields,
                        sender: ident.sender,
                        senderName: ident.senderName,
                        senderId: ident.senderId,
                    });
                    const updateGroupLast = async (content, type) => {
                        try {
                            if (sdk.chatGroups?.updateLastMessage) {
                                await sdk.chatGroups.updateLastMessage(sdk, sender, groupId, mode, {
                                    content, timestamp: Date.now(), senderName: ident.senderName, type,
                                });
                            }
                        } catch (_) {}
                    };
                    const pickGroupMember = (pickerOpts = {}) => new Promise((resolve) => {
                        const { candidates } = listGroupActionCandidates(sdk, sender, groupId, mode, {
                            includeUser: pickerOpts.includeUser !== false,
                            includeAll: !!pickerOpts.includeAll,
                            excludeUser: !!pickerOpts.excludeUser,
                            currentAsId: pickerOpts.markCurrentAs ? getGroupSendAsId(groupId, mode) : '',
                            markSelfCurrent: !!pickerOpts.markCurrentAs && !getGroupSendAsId(groupId, mode),
                        });
                        if (!candidates.length) {
                            window.__phoneIsland?.notify?.('warning', pickerOpts.emptyText || '没有可选成员');
                            resolve(null);
                            return;
                        }
                        chatModalManager.openGroupMemberPicker({
                            title: pickerOpts.title || '选择成员',
                            subtitle: pickerOpts.subtitle || '',
                            confirmLabel: pickerOpts.confirmLabel || '确认',
                            candidates,
                            onPick: (member) => resolve(member || null),
                            onClose: () => resolve(null),
                        });
                    });

                    if (action === 'image') {
                        chatModalManager.openDescImageSend({
                            onConfirm: async (result) => {
                                const now = Date.now();
                                const msgId = `img-${now}`;
                                try {
                                    await sdk.chatMessages.add(sender, groupId, mode, withIdent({
                                        id: msgId,
                                        conversationType: 'group', conversationId: groupId,
                                        type: 'descriptive_image',
                                        content: result.description,
                                        imageDescription: result.description,
                                        cardColor: result.cardColor,
                                        textColor: result.textColor,
                                        timestamp: now,
                                    }));
                                } catch (err) { console.warn('[chat-app] group save image failed', err); }
                                try {
                                    if (messagesContainer) {
                                        const { renderDescImageBubble } = await import('./components/card-messages.js');
                                        const injectMsg = withIdent({
                                            id: msgId,
                                            type: 'descriptive_image',
                                            content: result.description,
                                            imageDescription: result.description,
                                            cardColor: result.cardColor,
                                            textColor: result.textColor,
                                            timestamp: now,
                                            time: new Date(now).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                                            conversationType: 'group',
                                            conversationId: groupId,
                                        });
                                        const html = renderDescImageBubble(injectMsg, {
                                            name: senderName,
                                            avatar: userAvatar,
                                            avatarBg: userAvatarBg,
                                        }, {
                                            userAvatar, userAvatarBg,
                                            aiPersonId: groupId,
                                            mode,
                                            conversationType: 'group',
                                            isGroup: true,
                                            showSendToAi: true,
                                        });
                                        messagesContainer.insertAdjacentHTML('beforeend', html);
                                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                                    }
                                } catch (err) { console.warn('[chat-app] group inject image failed', err); }
                                refreshGroupChat();
                                try {
                                    await updateGroupLast('[图片]', 'descriptive_image');
                                } catch (e) {}
                                window.__phoneIsland?.notify?.('success', '图片已发送');
                            },
                        });
                    } else if (action === 'voice') {
                        chatModalManager.openVoiceRecord({
                            onConfirm: async (result) => {
                                const now = Date.now();
                                try {
                                    await sdk.chatMessages.add(sender, groupId, mode, withIdent({
                                        id: `voice-${now}`,
                                        conversationType: 'group', conversationId: groupId,
                                        type: 'voice',
                                        content: '[语音消息]',
                                        voiceContent: result.content,
                                        voiceDuration: result.duration,
                                        duration: result.duration,
                                        timestamp: now,
                                    }));
                                } catch (err) { console.warn('[chat-app] group save voice failed', err); }
                                refreshGroupChat();
                                try {
                                    await updateGroupLast('[语音]', 'voice');
                                } catch (e) {}
                                window.__phoneIsland?.notify?.('success', '语音已发送', `${result.duration}秒`);
                            },
                        });
                    } else if (action === 'location') {
                        chatModalManager.openLocationPicker({
                            onSelect: async (locationData) => {
                                const now = Date.now();
                                try {
                                    await sdk.chatMessages.add(sender, groupId, mode, withIdent({
                                        id: `loc-${now}`,
                                        conversationType: 'group', conversationId: groupId,
                                        type: 'location', content: '[位置]',
                                        locationCard: {
                                            name: locationData.name || '',
                                            address: locationData.address || '',
                                            position: { x: locationData.position?.x ?? 0, y: locationData.position?.y ?? 0 },
                                        },
                                        timestamp: now,
                                    }));
                                } catch (err) { console.warn('[chat-app] group save location failed', err); }
                                refreshGroupChat();
                                try {
                                    await updateGroupLast('[位置]', 'location');
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
                                    await sdk.chatMessages.add(sender, groupId, mode, withIdent({
                                        id: `rp-${now}`,
                                        conversationType: 'group', conversationId: groupId,
                                        type: 'redpacket', content: '[红包]',
                                        redpacketCard: { style: 'normal', message: result.message || '', opened: false },
                                        timestamp: now,
                                    }));
                                } catch (err) { console.warn('[chat-app] group save redpacket failed', err); }
                                refreshGroupChat();
                                window.__phoneIsland?.notify?.('success', '红包已发送');
                            },
                        });
                    } else if (action === 'transfer') {
                        const toMember = await pickGroupMember({
                            title: '转账给谁',
                            subtitle: '选择要转给的群成员',
                            confirmLabel: '下一步',
                            excludeUser: true,
                            emptyText: '没有可转账的成员',
                        });
                        if (!toMember) return;
                        chatModalManager.openTransferSend({
                            title: `转账给 ${toMember.label}`,
                            onConfirm: async (result) => {
                                const now = Date.now();
                                const msgId = `tr-${now}`;
                                const amount = Number(result.amount) || 0;
                                const note = result.note || '转账';
                                try {
                                    const uid = sender.id;
                                    const bal = sdk.assetFlow?.getBalance?.('user', uid) || 0;
                                    if (bal < amount) {
                                        window.__phoneIsland?.notify?.('warning', '余额不足', `当前余额不足，无法转账`);
                                        return;
                                    }
                                    const flowRes = await sdk.assetFlow?.add?.({
                                        type: 'transfer',
                                        direction: 'out',
                                        amount,
                                        counterpartyType: toMember.kind === 'user' ? 'user' : 'ai',
                                        counterpartyId: toMember.id,
                                        counterpartyName: toMember.label,
                                        sourceType: 'transfer',
                                        sourceId: msgId,
                                        note: `群转账给 ${toMember.label}:${note}`,
                                    }, 'user', uid);
                                    if (flowRes && flowRes.ok === false) {
                                        window.__phoneIsland?.notify?.(
                                            'warning',
                                            flowRes.insufficientBalance ? '余额不足' : '转账失败',
                                            flowRes.error || '',
                                        );
                                        return;
                                    }
                                    await sdk.chatMessages.add(sender, groupId, mode, withIdent({
                                        id: msgId,
                                        conversationType: 'group', conversationId: groupId,
                                        type: 'transfer', content: '[转账]',
                                        transferCard: {
                                            amount,
                                            note,
                                            received: false,
                                            toId: toMember.id,
                                            toName: toMember.label,
                                        },
                                        timestamp: now,
                                    }));
                                } catch (err) { console.warn('[chat-app] group save transfer failed', err); }
                                refreshGroupChat();
                                window.__phoneIsland?.notify?.('success', '转账已发送', `给 ${toMember.label}`);
                            },
                        });
                    } else if (action === 'mention') {
                        try {
                            const chosen = await pickGroupMember({
                                title: '选择要@的成员',
                                subtitle: '点选后会插入到输入框',
                                confirmLabel: '@TA',
                                includeAll: true,
                                emptyText: '没有可@的成员',
                            });
                            if (!chosen || !messageInput) return;
                            const label = chosen.id === '__all__' ? '所有人' : chosen.label;
                            const cur = (messageInput.innerText || messageInput.textContent || '').replace(/\u00a0/g, ' ');
                            const prefix = cur && !/\s$/.test(cur) ? `${cur} ` : cur;
                            messageInput.innerText = `${prefix}@${label} `;
                            messageInput.focus();
                        } catch (e) {
                            console.warn('[chat-app] group mention failed', e);
                            window.__phoneIsland?.notify?.('warning', '@成员失败');
                        }
                    } else if (action === 'announcement') {
                        try {
                            await this.openGroupAnnouncementEdit({ groupId, mode });
                        } catch (err) {
                            console.warn('[chat-app] group announcement failed', err);
                            window.__phoneIsland?.notify?.('warning', '打不开公告');
                        }
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
                    } else if (action === 'custom') {
                        const chosen = await pickGroupMember({
                            title: '以谁的身份发送',
                            subtitle: '之后发出的消息会显示成这个人',
                            confirmLabel: '使用此身份',
                            includeUser: true,
                            markCurrentAs: true,
                            emptyText: '没有可选身份',
                        });
                        if (!chosen) return;
                        const asSelf = !!chosen.isCurrentUser || String(chosen.id) === String(sender.id);
                        setGroupSendAsId(groupId, mode, asSelf ? '' : chosen.id);
                        refreshGroupChat();
                        if (asSelf) {
                            window.__phoneIsland?.notify?.('info', '已恢复本人身份', '接下来以你自己发送');
                        } else {
                            window.__phoneIsland?.notify?.('success', '自定义身份', `接下来以 ${chosen.label} 发送`);
                        }
                    } else {
                        window.__phoneIsland?.notify?.('info', '群聊工具', '功能即将开放');
                    }
                };

                // ★ v0.70:多选模式工具已经抽到 components/chat-multi-select.js,见顶部 multiSelect 实例

                chatGroup.addEventListener('click', async (event) => {
                    const selectButton = event.target.closest('[data-message-select]');
                    if (selectButton && multiSelect.isActive()) { multiSelect.toggleMessage(selectButton); event.preventDefault(); event.stopPropagation(); return; }
                    const multiAction = event.target.closest('[data-multi-action]');
                    if (multiAction) {
                        const action = multiAction.dataset.multiAction;
                        if (action === 'cancel') {
                            multiSelect.disable();
                        } else if (action === 'forward') {
                            // ★ v0.33 群聊转发
                            const messageIds = multiSelect.getSelectedIds();
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
                            multiSelect.disable();
                        } else {
                            window.__phoneIsland?.notify?.('success', `消息${action === 'favorite' ? '收藏' : '删除'}成功`, `已选择 ${multiSelect.getSelectedCount()} 条消息`);
                            multiSelect.disable();
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                    const multiSelectButton = event.target.closest('[data-action="multiselect"]');
                    if (multiSelectButton) { multiSelect.toggle(); event.preventDefault(); event.stopPropagation(); return; }

                    // ★ v0.70:emoji 面板 / sticker 发送已经抽到 components/chat-emoji-panel.js
                    //   由 init 末尾的 bindEmojiPanelInteractions 统一接管

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

                    const descImageCard = event.target.closest('.desc-image-card');
                    if (descImageCard) {
                        const { collectCardContext } = await import('./services/card-detail-actions.js');
                        const desc = descImageCard.dataset.desc || '';
                        const cardColor = descImageCard.dataset.color || '#FFE4EC';
                        const textColor = descImageCard.dataset.textColor || '#D4728A';
                        const borderColor = Object.values(DESC_IMAGE_PRESETS || {}).find(p => p.cardColor === cardColor)?.borderColor || '#C0607A';
                        chatModalManager.openDescImage({
                            description: desc, cardColor, textColor, borderColor,
                            context: collectCardContext(descImageCard),
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    const locationCard = event.target.closest('.location-card-in-chat');
                    if (locationCard) {
                        const { collectCardContext } = await import('./services/card-detail-actions.js');
                        const name = locationCard.dataset.locationName || '位置';
                        const address = locationCard.dataset.locationAddress || '';
                        const mapEl = locationCard.querySelector('.location-card-map');
                        const bgGradient = mapEl ? (
                            mapEl.style.background ||
                            'linear-gradient(135deg, #E8F2FF, #D6E4FF)'
                        ) : 'linear-gradient(135deg, #E8F2FF, #D6E4FF)';
                        chatModalManager.openLocationCard({
                            name, address, style: { bgGradient },
                            context: collectCardContext(locationCard),
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    const toolBtn = event.target.closest('.toolbar-btn[data-action]');
                    if (toolBtn) {
                        const expandBtn = chatGroup.querySelector('.expand-toolbar-btn');
                        const toolbar = chatGroup.querySelector('.input-toolbar');
                        toolbar?.classList.remove('expanded');
                        expandBtn?.classList.remove('active');
                        expandBtn?.setAttribute('aria-expanded', 'false');

                        const action = toolBtn.dataset.action;
                        // 群聊工具栏：图片/语音/自定义/位置/红包/转账/@成员/公告/成员/收藏
                        handleGroupToolBar(action).catch(err => {
                            console.error('[chat-app] group toolbar failed', err);
                            window.__phoneIsland?.notify?.('error', '操作失败', err?.message || '');
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }

                    // ★ v0.69 工具栏翻页指示器(小圆点点击切换 page1/page2)
                    const toolbarDot = event.target.closest('.toolbar-dot');
                    if (toolbarDot) {
                        const targetPage = toolbarDot.dataset.pageTarget;
                        const toolbar = chatGroup.querySelector('.input-toolbar');
                        if (toolbar) {
                            toolbar.querySelectorAll('.toolbar-page').forEach((p) => {
                                p.classList.toggle('toolbar-page--active', p.dataset.page === targetPage);
                            });
                            toolbar.querySelectorAll('.toolbar-dot').forEach((d) => {
                                d.classList.toggle('toolbar-dot--active', d.dataset.pageTarget === targetPage);
                            });
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                });

                // ★ v0.70:emoji panel / sticker 发送由独立 listener 处理
                const { bindEmojiPanelInteractions } = await import('./components/chat-emoji-panel.js');
                bindEmojiPanelInteractions(chatGroup, { conversationType: 'group', chatApp: this });
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
                try { applyPromptFolds(pm); } catch (_) { /* ignore */ }
                if (pm.__pmInteractionsBound) return;
                pm.__pmInteractionsBound = true;
            },

            /** 注入 .chat-tab-indicator div(每次框架重渲后都补一遍,防 DOM 重建后丢失) */
            mountNavIndicator() {
                // 只在 chat app 的 tab-bar 注入指示器
                const tabBar = document.querySelector('.app-nav[data-app-id="chat"] .app-tab-bar');
                if (!tabBar) {
                    // 详情页没有底栏是正常的，不必打 warn
                    return;
                }
                // 幂等:已存在就不重复插入;framework 重渲时 .app-tab-bar 会被整体替换,
                //   div 跟着旧 DOM 一起死,这里每次都重建,防止「有时候出现有时候不出现」
                if (!tabBar.querySelector('.chat-tab-indicator')) {
                    tabBar.insertAdjacentHTML('afterbegin', '<div class="chat-tab-indicator"></div>');
                }
                // ★ v0.72 修复:从聊天 detail 退出时 .app-tab-bar 会被 framework patch/重画,
                //   chldren 改变导致 .chat-tab-indicator 丢失(常见于 closeDetailPage 触发
                //   v-html 重渲但 chat-app 的 renderChatPage 没走到的路径)。
                //   用 MutationObserver 监听 .app-tab-bar 的 children — indicator 消失即补上。
                this._ensureTabIndicatorObserver();
            },

            /**
             * ★ v0.72 启动一个全局 MutationObserver 监听 chat 顶栏 tab-bar。
             *   - 监听 .app-nav[data-app-id="chat"] 容器(容器本身可能替换)
             *   - 监听 chat app 全 .app-tab-bar 的 childrenList / 子树变化
             *   - 一旦任何 .app-tab-bar 内的 .chat-tab-indicator 消失,立即补上
             */
            _ensureTabIndicatorObserver() {
                if (this._tabIndicatorObserver) return;
                if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
                const self = this;
                const tryInject = () => {
                    const tabBar = document.querySelector('.app-nav[data-app-id="chat"] .app-tab-bar');
                    if (tabBar && !tabBar.querySelector('.chat-tab-indicator')) {
                        tabBar.insertAdjacentHTML('afterbegin', '<div class="chat-tab-indicator"></div>');
                    }
                };
                // 监听 body 子树(framework 可能直接重建 .app-nav;绑定到 body 能覆盖所有路径)
                this._tabIndicatorObserver = new MutationObserver(() => {
                    tryInject();
                });
                this._tabIndicatorObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                });
                // 立即跑一次保底
                tryInject();
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
                console.log('[chat-app] initMomentsPageInteractions: binding click events');

                // 使用事件委托绑定点击事件
                momentsPage.addEventListener('click', (event) => {
                    const target = event.target;
                    
                    // AI 图片点击
                    const descImage = target.closest('.clickable-desc-image, .ai-image-display, .ai-image-grid-item');
                    if (descImage) {
                        console.log('[chat-app] AI image clicked:', descImage.dataset.desc);
                        const desc = descImage.dataset.desc || '';
                        const cardColor = descImage.dataset.color || descImage.dataset.textColor || '#FFE4EC';
                        const textColor = descImage.dataset.textColor || '#D4728A';
                        
                        chatModalManager.openDescImage({
                            description: desc,
                            cardColor,
                            textColor,
                            context: {
                                conversationId: 'moments',
                                conversationType: 'private',
                                mode: 'calendar',
                                conversationName: '朋友圈',
                                fallbackMessage: {
                                    id: `moment-img-${String(desc).slice(0, 40)}`,
                                    type: 'descriptive_image',
                                    content: desc,
                                    imageDescription: desc,
                                    cardColor,
                                    textColor,
                                    sender: 'user',
                                    senderName: '我',
                                    timestamp: Date.now(),
                                },
                            },
                        });
                        event.stopPropagation();
                        return;
                    }
                    
                    // 收藏按钮点击（id 在按钮 / .swipe-row 上，不在 .swipe-row__content）
                    const likeBtn = target.closest('.moment-like-btn');
                    if (likeBtn) {
                        const momentData = this._getMomentDataFromCard(likeBtn);
                        if (momentData) {
                            this._handleLikeMoment(momentData, likeBtn);
                        }
                        event.stopPropagation();
                        return;
                    }
                    
                    // 分享按钮点击
                    const shareBtn = target.closest('.moment-share-btn');
                    if (shareBtn) {
                        const momentData = this._getMomentDataFromCard(shareBtn);
                        if (momentData) {
                            this._handleShareMoment(momentData);
                        }
                        event.stopPropagation();
                        return;
                    }

                    // ★ v0.87 编辑按钮点击(用户的和 AI 的动态都能改)
                    // ★ v0.88 编辑按钮改为左滑操作
                    const editBtn = target.closest('.moment-swipe-action--edit, .moment-edit-btn');
                    if (editBtn) {
                        const swipeRow = editBtn.closest('.swipe-row');
                        const momentData = this._getMomentDataFromCard(swipeRow);
                        if (momentData) {
                            this._handleEditMoment(momentData);
                        }
                        event.stopPropagation();
                        return;
                    }

                    // ★ v0.85 删除按钮点击
                    // ★ v0.88 删除按钮改为左滑操作
                    const deleteBtn = target.closest('.moment-swipe-action--delete, .moment-delete-btn');
                    if (deleteBtn) {
                        const swipeRow = deleteBtn.closest('.swipe-row');
                        const momentData = this._getMomentDataFromCard(swipeRow);

                        if (momentData) {
                            this._handleDeleteMoment(momentData);
                        }
                        event.stopPropagation();
                        return;
                    }
                });

            },

            /**
             * 朋友圈列表重画。
             * 发布 / 编辑 / 删除 / 收藏之后都要调 —— 之前发完朋友圈得切出去再切回来才看得到。
             * 走 invalidate + syncNow 而不是 detailRenderTick:朋友圈是 root tab,不是 detail 页。
             */
            _refreshMomentsFeed() {
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) { /* noop */ }
                try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) { /* noop */ }
                try { window.__detailRenderTick && window.__detailRenderTick.value++; } catch (_) { /* noop */ }
            },
            
            /** 从卡片 DOM 中获取动态数据（支持新滑动结构） */
            _getMomentDataFromCard(card) {
                if (!card) return null;

                // data-moment-id 写在 .swipe-row / 按钮上，.swipe-row__content 本身没有
                const idHost = card.closest?.('[data-moment-id]') || card;
                const row = card.closest?.('.swipe-row') || (card.classList?.contains('swipe-row') ? card : null);
                const contentEl = (row && row.querySelector('.swipe-row__content'))
                    || card.closest?.('.swipe-row__content')
                    || card;

                const momentId = idHost.dataset.momentId || row?.dataset?.momentId || '';
                const authorId = idHost.dataset.authorId || row?.dataset?.authorId || '';
                const isUser = (idHost.dataset.isUser || row?.dataset?.isUser) === 'true';

                // 获取内容
                const contentDiv = contentEl.querySelector('.moments-card-content');
                const content = contentDiv ? contentDiv.textContent.trim() : '';

                // 获取时间
                const timeEl = contentEl.querySelector('.moments-author-time');
                const timeStr = timeEl ? timeEl.textContent.trim() : '';

                // 获取图片
                const images = [];
                const aiImages = [];

                contentEl.querySelectorAll('.post-image-wrap img').forEach(img => {
                    if (img.src) images.push(img.src);
                });

                contentEl.querySelectorAll('.ai-image-grid-item, .ai-image-display').forEach(aiEl => {
                    aiImages.push({
                        description: aiEl.dataset.desc || '',
                        cardColor: aiEl.dataset.color || '#FFE4EC',
                        textColor: aiEl.dataset.textColor || '#D4728A',
                    });
                });

                // 获取位置
                const locationEl = contentEl.querySelector('.location-name');
                const location = locationEl ? locationEl.textContent.trim() : '';

                return {
                    id: momentId,
                    authorId: authorId,
                    authorName: contentEl.querySelector('.moments-author-name')?.textContent.replace('(我)', '').trim() || '匿名',
                    isUser: isUser,
                    content: content,
                    images: images,
                    aiImages: aiImages,
                    location: location,
                    timestamp: Number(contentEl.dataset.timestamp || card.dataset.timestamp) || 0,
                };
            },

            /**
             * 收藏 / 取消收藏一条朋友圈。
             *
             * ★ v0.87 之前这里只加了个 CSS class,再把数据塞进
             * `xiaoting::chat-moment-favorites` —— 那是个**没人读的孤儿 key**,
             * 跟真正的收藏系统(sdk.chatFavorites)毫无关系。
             * 用户点了收藏,收藏页「朋友圈」分类里永远是空的,这就是「收藏不成功」。
             * 现在统一走 moments-service → sdk.chatFavorites(type='moments')。
             */
            async _handleLikeMoment(momentData, btnEl) {
                const res = await toggleFavoriteMoment(momentData);
                if (!res.ok) {
                    this.toolkit?.island?.notify?.('error', '收藏失败', res.error || '');
                    return;
                }
                // 先就地改按钮外观（重画之前也要有即时反馈）
                btnEl.classList.toggle('liked', res.favorited);
                btnEl.setAttribute('aria-pressed', String(res.favorited));
                btnEl.setAttribute('title', res.favorited ? '取消收藏' : '收藏');
                const svg = btnEl.querySelector('svg');
                if (svg) svg.setAttribute('fill', res.favorited ? 'currentColor' : 'none');
                this.toolkit?.island?.notify?.(
                    res.favorited ? 'success' : 'info',
                    res.favorited ? '已收藏' : '已取消收藏',
                );
            },

            /** ★ v0.87 编辑一条朋友圈正文（用户的和 AI 的都能改） */
            _handleEditMoment(momentData) {
                chatModalManager?.openMessageEdit?.({
                    originalText: momentData.content || '',
                    senderLabel: momentData.isUser ? '我的朋友圈' : `${momentData.authorName || 'AI'} 的朋友圈`,
                    messageType: 'text',
                    editable: true,
                    onSave: async (nextText) => {
                        const text = String(nextText || '').trim();
                        if (!text) {
                            this.toolkit?.island?.notify?.('warning', '内容不能为空');
                            return;
                        }
                        const ok = await updateMomentContent(momentData, text);
                        if (!ok) {
                            this.toolkit?.island?.notify?.('error', '保存失败');
                            return;
                        }
                        this.toolkit?.island?.notify?.('success', '已保存');
                        this._refreshMomentsFeed();
                    },
                });
            },
            
            /**
             * 转发朋友圈到聊天。
             *
             * ★ v0.87 这里原来还挂了个 `onSelect` 回调去调 `_sendMomentShare`，
             *   但 `openMomentShare` 根本不接受 onSelect —— 发送逻辑在
             *   MomentShareModal 自己的 doShare 里。那份 `_sendMomentShare` 是死代码，
             *   而且它在 `shareMsg` 里引用了几行之后才 `const` 出来的 `defaultUser`，
             *   真被调到会直接 ReferenceError。已删。
             */
            _handleShareMoment(momentData) {
                chatModalManager.openMomentShare({
                    shareData: {
                        momentId: momentData.id,
                        authorName: momentData.authorName,
                        content: momentData.content,
                        aiImages: momentData.aiImages,
                    },
                });
            },

            /**
             * ★ v0.85 处理删除朋友圈
             * ★ v0.87 之前这里删的是 `xiaoting::chat-moment-favorites`(收藏的孤儿 key),
             *   动态本身根本没删 —— 用户点删除,提示「已删除」,刷新一看还在。
             *   现在按来源分流:用户动态删 localStorage,AI 动态走 sdk.moments.remove。
             */
            async _handleDeleteMoment(momentData) {
                const doDelete = async () => {
                    try {
                        const ok = await deleteMoment(momentData);
                        if (!ok) {
                            this.toolkit?.island?.notify?.('error', '删除失败', '没找到这条动态');
                            return;
                        }
                        this.toolkit?.island?.notify?.('success', '已删除');
                        this._refreshMomentsFeed();
                    } catch (e) {
                        console.error('[chat-app] _handleDeleteMoment failed:', e);
                        this.toolkit?.island?.notify?.('error', '删除失败', e?.message || '');
                    }
                };
                if (chatModalManager?.openMomentDeleteConfirm) {
                    chatModalManager.openMomentDeleteConfirm({
                        momentId: momentData.id,
                        momentContent: momentData.content,
                        onConfirm: doDelete,
                    });
                } else if (window.confirm('确定要删除这条朋友圈动态吗？')) {
                    await doDelete();
                }
            },

            /** 初始化发布朋友圈页面交互 */
            initChatPostInteractions() {
                const chatPost = document.querySelector('.app-shell[data-app-id="chat"] .chat-post');
                if (!chatPost) {
                    console.warn('[chat-app] initChatPostInteractions: .chat-post not found');
                    return;
                }
                if (chatPost.__chatPostInteractionsBound) return;
                chatPost.__chatPostInteractionsBound = true;

                const contentEl = chatPost.querySelector('#moment-content');
                const imagesPreview = chatPost.querySelector('#moment-images-preview');
                const addAiImageBtn = chatPost.querySelector('#add-ai-image');
                const publishBtn = chatPost.querySelector('#publish-moment-btn');
                const locationRow = chatPost.querySelector('#add-location');
                const locationText = chatPost.querySelector('#location-text');

                // 存储已选择的图片
                const selectedImages = [];
                let currentLocation = null;
                let currentLocationAddress = '';

                // AI 描述生成图片按钮 - 打开描述生成弹窗
                if (addAiImageBtn) {
                    addAiImageBtn.addEventListener('click', () => {
                        // 使用 chatModalManager 打开 AI 描述图片生成弹窗
                        if (chatModalManager?.openDescImageSend) {
                            chatModalManager.openDescImageSend({
                                onConfirm: (result) => {
                                    // result = { description, cardColor, textColor, borderColor }
                                    selectedImages.push({
                                        type: 'ai',
                                        description: result.description,
                                        cardColor: result.cardColor || '#FFE4EC',
                                        textColor: result.textColor || '#D4728A',
                                    });
                                    renderImagesPreview();
                                },
                                onCancel: () => {},
                            });
                        } else {
                            // 兜底:直接弹窗让用户输入描述
                            const desc = prompt('请输入图片描述(AI会生成对应的图片卡片):');
                            if (desc && desc.trim()) {
                                const colors = [
                                    { card: '#FFE4EC', text: '#D4728A' },
                                    { card: '#E8F2FF', text: '#4A6FA5' },
                                    { card: '#FFF3E0', text: '#FF9800' },
                                    { card: '#E8F8F0', text: '#4CAF50' },
                                    { card: '#F3E8FF', text: '#8B5CF6' },
                                ];
                                const color = colors[Math.floor(Math.random() * colors.length)];
                                selectedImages.push({
                                    type: 'ai',
                                    description: desc.trim(),
                                    cardColor: color.card,
                                    textColor: color.text,
                                });
                                renderImagesPreview();
                            }
                        }
                    });
                }

                // 渲染图片预览
                const renderImagesPreview = () => {
                    if (!imagesPreview) return;
                    if (selectedImages.length === 0) {
                        imagesPreview.innerHTML = '';
                        return;
                    }

                    // 最多显示9张
                    const displayImages = selectedImages.slice(0, 9);
                    const totalImages = selectedImages.length;

                    imagesPreview.innerHTML = displayImages.map((img, idx) => {
                        const extraOverlay = (idx === 8 && totalImages > 9)
                            ? `<div class="moment-image-overlay">+${totalImages - 9}</div>`
                            : '';

                        if (img.type === 'ai') {
                            return `
                                <div class="moment-image-item moment-image-item--ai"
                                     data-index="${idx}"
                                     style="background: ${escapeHtml(img.cardColor)};">
                                    <div class="moment-image-ai-text" style="color: ${escapeHtml(img.textColor)};">
                                        ${escapeHtml(img.description.substring(0, 30))}${img.description.length > 30 ? '...' : ''}
                                    </div>
                                    <button class="moment-image-remove" data-index="${idx}">×</button>
                                    ${extraOverlay}
                                </div>`;
                        } else {
                            return `
                                <div class="moment-image-item" data-index="${idx}">
                                    <img src="${escapeHtml(img.url || img)}" alt="">
                                    <button class="moment-image-remove" data-index="${idx}">×</button>
                                    ${extraOverlay}
                                </div>`;
                        }
                    }).join('');
                };

                // 图片预览区事件委托(删除按钮)
                if (imagesPreview) {
                    imagesPreview.addEventListener('click', (e) => {
                        const removeBtn = e.target.closest('.moment-image-remove');
                        if (removeBtn) {
                            const index = parseInt(removeBtn.dataset.index, 10);
                            selectedImages.splice(index, 1);
                            renderImagesPreview();
                            e.stopPropagation();
                        }
                    });
                }

                // 位置选项 - 打开位置选择弹窗
                if (locationRow && locationText) {
                    locationRow.addEventListener('click', () => {
                        // 使用位置选择弹窗
                        if (chatModalManager?.openLocationPicker) {
                            chatModalManager.openLocationPicker({
                                onSelect: (locationData) => {
                                    currentLocation = locationData.name || locationData.address || '未知位置';
                                    currentLocationAddress = locationData.address || '';
                                    locationText.textContent = currentLocation;
                                },
                                onClose: () => {},
                            });
                        } else {
                            // 兜底:简单的确认弹窗
                            window.__phoneConfirm?.request({
                                title: '添加位置',
                                text: '当前位置: 上海市浦东新区(模拟)',
                                confirmLabel: '确认',
                                onConfirm: () => {
                                    currentLocation = '上海市浦东新区';
                                    currentLocationAddress = '上海市浦东新区陆家嘴';
                                    locationText.textContent = currentLocation;
                                },
                                onCancel: () => {},
                            });
                        }
                    });
                }

                // 发布按钮
                if (publishBtn) {
                    publishBtn.addEventListener('click', async () => {
                        const content = contentEl?.value?.trim() || '';
                        if (!content && selectedImages.length === 0) {
                            this.toolkit?.island?.notify?.('warning', '请输入内容或添加图片');
                            return;
                        }

                        publishBtn.disabled = true;
                        publishBtn.textContent = '发布中...';

                        try {
                            // 模拟发布成功
                            await new Promise(resolve => setTimeout(resolve, 800));

                            // ★ 发布成功后保存到全局数据,并刷新朋友圈页面
                            // 将新动态添加到朋友圈数据中
                            const newMoment = {
                                id: 'moment-user-' + Date.now(),
                                authorName: '我',
                                authorId: 'user_self',
                                authorAvatar: '',
                                isUser: true,
                                timestamp: Date.now(),
                                content: content,
                                images: [],
                                aiImages: selectedImages.filter(i => i.type === 'ai').map(i => ({
                                    description: i.description,
                                    cardColor: i.cardColor,
                                    textColor: i.textColor,
                                })),
                                likes: [],
                                comments: [],
                                location: currentLocation || null,
                            };

                            // 保存到本地存储(模拟)
                            try {
                                const momentsData = JSON.parse(localStorage.getItem('xiaoting::chat-user-moments') || '[]');
                                momentsData.unshift(newMoment);
                                localStorage.setItem('xiaoting::chat-user-moments', JSON.stringify(momentsData.slice(0, 50)));
                            } catch (e) {
                                console.warn('[chat-post] save moment failed:', e);
                            }

                            // 通知发布成功
                            this.toolkit?.island?.notify?.('success', '发布成功!');

                            // ★ 关闭发布页面并切换到朋友圈 tab
                            // 先关闭当前 detail 页面
                            document.dispatchEvent(new CustomEvent('app:page-action', {
                                detail: { action: 'appMethod', appId: 'chat', method: 'closeDetail' },
                                bubbles: true,
                            }));
                            // 然后切换到朋友圈 tab（延迟确保关闭完成）
                            setTimeout(() => {
                                document.dispatchEvent(new CustomEvent('app:page-action', {
                                    detail: { action: 'switchPage', pageId: 'moments' },
                                    bubbles: true,
                                }));
                                // ★ v0.87 切 tab 只是路由,渲染结果还在 renderer 缓存里 ——
                                //   之前必须再切出去切回来才看得到新发的那条。这里主动作废缓存重画。
                                this._refreshMomentsFeed();
                            }, 100);
                        } catch (err) {
                            console.error('[chat-post] publish failed:', err);
                            this.toolkit?.island?.notify?.('error', '发布失败');
                        } finally {
                            publishBtn.disabled = false;
                            publishBtn.textContent = '发布动态';
                        }
                    });
                }

                // 自动聚焦到输入框
                if (contentEl) {
                    setTimeout(() => contentEl.focus(), 100);
                }
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
                    //   - 历史 bug(用户 8/8 反馈):replyFormatInject 在 toggleReplyFormatActive
                    //     写到 localStorage 但 hydrate 不读回
                    //     → 刷新页面后 state.chat.replyFormatInject 为空对象,
                    //     prompt-manager 渲染时计算错误,
                    //     回复格式卡片可能消失
                    //   - 解决方案:跟 systemPromptOverrides 一样的兜底三段式
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
                    // ★ v0.79 「用户朋友圈」启用状态 — 跟 replyFormatInject 同款三段式 hydrate
                    if (!this.app.state.chat.userMomentsInject) {
                        try {
                            const raw = localStorage.getItem('xiaoting::chat-user-moments-inject-v1');
                            if (raw) {
                                const parsed = JSON.parse(raw);
                                if (parsed && typeof parsed === 'object') {
                                    this.app.state.chat.userMomentsInject = parsed;
                                }
                            }
                        } catch (_) { /* ignore */ }
                    }
                    // ★ v0.79 「AI 朋友圈概要」启用状态 — 跟 replyFormatInject 同款三段式 hydrate
                    if (!this.app.state.chat.aiMomentsInject) {
                        try {
                            const raw = localStorage.getItem('xiaoting::chat-ai-moments-inject-v1');
                            if (raw) {
                                const parsed = JSON.parse(raw);
                                if (parsed && typeof parsed === 'object') {
                                    this.app.state.chat.aiMomentsInject = parsed;
                                }
                            }
                        } catch (_) { /* ignore */ }
                    }
                } catch (_) { /* ignore */ }

                // ★ v0.61.8.4 挂 App Prompt 卡片 details 的 toggle 监听(在 hydrate 里调一次,后续 module-level 复用)
                this._initAppPromptDetailsObserver?.();
                // ★ v0.61.8.5 挂 App Prompt 预览编辑器 textarea 的 input 监听(实时重渲染预览卡片)
                this._initAppPromptPreviewInputObserver?.();

                // ★ v0.28 走顶层预热入口(幂等,可能已被 framework 启动过)
                if (typeof window.whenSettingsSdkReady === 'function') {
                    await window.whenSettingsSdkReady(3000);
                    try { await prefetchAllAvatars(); } catch (_) {}
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
                    try { prefetchAllAvatars(); } catch (_) {}

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
                // 2) 用户人设(默认 / active)
                const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.() || null;

                // 判断是否是用户本人
                const isUserSelf = !ai && (defaultUser?.id === aiPersonId || aiPersonId === defaultUser?.id);

                // 获取显示名称
                let aiName = aiPersonId;
                if (isUserSelf) {
                    aiName = defaultUser?.name || defaultUser?.socialProfiles?.chat?.nickname || '我';
                } else if (ai) {
                    aiName = ai.name || aiPersonId;
                }

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
             * ★ v0.72 群聊 API 调用设置
             *   payload: { groupId, mode }
             *   流程:
             *     1) 读取 group.members 里的 AI 成员
             *     2) 弹窗让用户选择为哪个 AI 成员设置 API
             *     3) 选完后调 openApiCallModal(传入 aiPersonId)
             */
            openGroupApiCallModal(payload = {}) {
                const groupId = String(payload?.groupId || '');
                if (!groupId) {
                    this.toolkit?.island?.notify?.('error', '打开失败', '缺少群 ID');
                    return;
                }
                const sdk = window.settingsSdk;
                if (!sdk?.chatGroups) {
                    this.toolkit?.island?.notify?.('error', 'SDK 未就绪');
                    return;
                }
                const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                if (!defaultUser) {
                    this.toolkit?.island?.notify?.('error', '未找到当前用户');
                    return;
                }
                const mode = payload.mode || 'calendar';
                const group = sdk.chatGroups.get(defaultUser, groupId, mode);
                if (!group) {
                    this.toolkit?.island?.notify?.('error', '找不到该群聊');
                    return;
                }

                // 构造成员列表（包含用户本人）
                const memberRows = [];
                for (const aiPersonId of (group.members || [])) {
                    // 判断是否是用户本人
                    const isUserSelf = aiPersonId === defaultUser?.id;
                    const ai = sdk?.aiPersons?.get?.(aiPersonId);
                    const label = isUserSelf
                        ? (defaultUser?.name || defaultUser?.socialProfiles?.chat?.nickname || '我')
                        : (ai?.name || ai?.socialProfiles?.chat?.nickname || aiPersonId || '未知');

                    // 获取当前 API 设置
                    let savedKey = '';
                    let savedLabel = '未设置';
                    if (!isUserSelf) {
                        try {
                            const localKey = 'xiaoting::chat-default-api-key::' + aiPersonId;
                            savedKey = localStorage.getItem(localKey) || '';
                            if (savedKey) {
                                const parts = savedKey.split('::');
                                const refType = parts[0] || 'key';
                                const refId = parts[1] || savedKey;
                                const labelKey = 'xiaoting::api-label::' + refType + '::' + refId;
                                savedLabel = localStorage.getItem(labelKey) || refId.slice(0, 12) + '...';
                            }
                        } catch (_) {}
                    }

                    memberRows.push({ id: aiPersonId, label, savedLabel, savedKey, isUserSelf });
                }

                if (memberRows.length === 0) {
                    console.log('[openGroupApiCallModal] group.members=', group?.members);
                    this.toolkit?.island?.notify?.('warning', '群里没有成员');
                    return;
                }

                // ★ v0.75 群聊 API 设置：跟私聊一样弹 ApiCallModal
                //   - 聚合群里所有 AI 成员 + 用户人设绑定的 API refs
                //   - 保存时按 groupId 存一个"群默认 API"，群聊对话时优先用这个
                const refsMap = new Map();
                const apiSdk = window.__apiSdk;

                function _pushRefs(refs, source) {
                    if (!Array.isArray(refs)) return;
                    for (const r of refs) {
                        if (!r || typeof r !== 'object') continue;
                        const refType = r.refType === 'group' ? 'group' : 'key';
                        const refId = String(r.refId || '');
                        if (!refId) continue;
                        const dedupKey = refType + '::' + refId;
                        if (refsMap.has(dedupKey)) continue;
                        let label = r.name || refId;
                        let model = '';
                        let baseUrl = '';
                        let subTitle = r.subTitle || '';
                        let enabled = true;
                        let keyCount = 0;
                        if (refType === 'key' && apiSdk?.apiKeySdk?.get) {
                            const k = apiSdk.apiKeySdk.get(refId);
                            if (k) { label = k.label || label; model = k.model || ''; baseUrl = k.baseUrl || ''; enabled = k.enabled !== false; }
                        } else if (refType === 'group' && apiSdk?.apiGroupSdk?.get) {
                            const g = apiSdk.apiGroupSdk.get(refId);
                            if (g) { label = g.name || label; keyCount = Array.isArray(g.apiKeyIds) ? g.apiKeyIds.length : 0; }
                        }
                        refsMap.set(dedupKey, { refId, type: refType, label, model, baseUrl, subTitle, enabled, source, keyCount });
                    }
                }

                // 聚合非用户的 AI 成员的 refs
                for (const row of memberRows) {
                    if (!row.isUserSelf) {
                        const ai = sdk?.aiPersons?.get?.(row.id);
                        _pushRefs(ai?.boundResources?.apiRefs, 'ai');
                    }
                }
                // 聚合用户人设的 refs
                _pushRefs(defaultUser?.boundResources?.apiRefs, 'user');

                const refs = Array.from(refsMap.values());
                const localKey = 'xiaoting::chat-default-api-key::group::' + groupId;
                let defaultRefId = '';
                let defaultRefType = '';
                try {
                    const stored = localStorage.getItem(localKey) || '';
                    if (stored.includes('::')) {
                        const parts = stored.split('::');
                        defaultRefType = parts[0] === 'group' ? 'group' : 'key';
                        defaultRefId = parts[1] || '';
                    } else {
                        defaultRefId = stored;
                    }
                } catch (_) {}

                chatModalManager.openApiCallModal({
                    aiPersonId: groupId,
                    contactName: group.name || '群聊',
                    refs,
                    defaultRefId,
                    defaultRefType,
                    onSelect: (refId, refType) => {
                        // 保存到 groupId 下（群聊专用）
                        try {
                            const finalType = refType === 'group' ? 'group' : 'key';
                            if (refId) {
                                localStorage.setItem(localKey, finalType + '::' + refId);
                            } else {
                                localStorage.removeItem(localKey);
                            }
                        } catch (_) {}
                        const matched = refs.find((r) => r.refId === refId);
                        try {
                            if (matched?.label) {
                                const labelLocalKey = 'xiaoting::api-label::' + (refType === 'group' ? 'group::' : 'key::') + refId;
                                localStorage.setItem(labelLocalKey, matched.label);
                            }
                        } catch (_) {}
                        this.toolkit?.island?.notify?.(refId ? 'success' : 'info', refId ? '已设为群默认 API' : '已清除群默认 API', matched?.label || '');
                    },
                    onClose: () => {},
                });
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
             *     - ★ v0.71 新增 silentIsland:true → 跳过内部 notify(留给外层胶囊灵动岛显示进度)
             */
            async sendMessageWithAi(payload = {}) {
                const aiPersonId = String(payload?.aiPersonId || '');
                const mode = String(payload?.mode || 'calendar');
                const text = String(payload?.text || '').trim();
                // ★ v0.71:外部胶囊灵动岛已挂起进度提示时,本方法不再弹自己的 notify
                const silentIsland = !!payload?.silentIsland;
                const _notify = (state, title, body) => {
                    if (silentIsland) return;
                    this.toolkit?.island?.notify?.(state, title, body);
                };
                if (!aiPersonId) {
                    _notify('error', 'AI 对话失败', '缺少 aiPersonId');
                    return null;
                }
                const apiText = text || '（请根据当前对话上下文接着回复）';

                // 1) 灵动岛「正在发送给 AI」(silentIsland=true 时跳过)
                _notify('info', '正在发送给 AI…', text.slice(0, 30));
                const startTs = Date.now();

                // 2) 后台调 AI(用户可以在这期间切到其他 app / 滑动屏幕)
                let result;
                try {
                    result = await callAiAndSplit({
                        aiPersonId,
                        mode,
                        userText: apiText,
                        historyLimit: 12,
                    });
                } catch (err) {
                    console.error('[chat-app] sendMessageWithAi failed', err);
                    _notify('error', 'AI 调用异常', err?.message || String(err));
                    return null;
                }

                if (!result || result.ok === false) {
                    const err = result?.error || '未知错误';
                    // ★ v0.62.6 错误提示放宽到 200 字(friendly 文案可能较长)
                    _notify('error', 'AI 回复失败', err.slice(0, 200));
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
                        // ★ v0.79 AI 发朋友圈(由 [发朋友圈:内容] 触发)
                        //   - 调用 chat-asset-service.aiSendMoment → 写完整朋友圈到 aiPerson.moments[]
                        //     + 后台异步生成概要(summary) + 写一条 action_notify 系统消息
                        //   - 这种 type='moment' 的 marker 不直接进 chatMessages(由 aiSendMoment 自己处理)
                        //   - 一轮对话最多一次(moments[] 增加一条后,下次同样格式 token 系统照常处理,
                        //     但 AI 自己会被 prompt 里的「不要每条消息都发朋友圈」约束)
                        if (msg.type === 'moment') {
                            try {
                                const { aiSendMoment } = await import('./services/chat-asset-service.js');
                                const res = await aiSendMoment({
                                    aiPersonId,
                                    mode,
                                    content: msg.momentContent || msg.content || '',
                                });
                                if (!res?.ok) {
                                    console.warn('[chat-app] aiSendMoment failed', res?.error);
                                    continue;
                                }
                                // ★ 朋友圈写入成功:灵动岛提示
                                try {
                                    const aiInst = sdk?.aiPersons?.get?.(aiPersonId);
                                    const aiName = aiInst?.name || 'AI';
                                    this.toolkit?.island?.notify?.(
                                        'success',
                                        `${aiName} 发了一条朋友圈`,
                                        (msg.momentContent || msg.content || '').slice(0, 30),
                                    );
                                } catch (_) {}
                            } catch (momentErr) {
                                console.warn('[chat-app] aiSendMoment error', momentErr);
                            }
                            continue; // moment 不直接写 chatMessages(type='moment' 是 marker)
                        }
                        // 四叶草送礼（由 [送礼:] / [匿名送礼:] 触发）。
                        // 同样是 marker：真正的扣款 + 写订单 + 勾心愿单 + 产出礼物卡
                        // 全在 shop 那边做，这里只负责把动作转过去。
                        // 走 window.__shopGift 而不是 import —— chat 不该知道购物软件的
                        // 内部模块长什么样，而且它可能根本没装（那时候这段就静默跳过）。
                        if (msg.type === 'shop_gift_request') {
                            try {
                                const bridge = window.__shopGift;
                                if (!bridge?.aiGiftToUser || !bridge.isReady?.()) {
                                    console.warn('[chat-app] 四叶草没准备好，这次送礼跳过');
                                    continue;
                                }
                                const res = await bridge.aiGiftToUser({
                                    aiPersonId, mode, ...(msg.shopGift || {}),
                                });
                                if (!res?.ok) {
                                    // 余额不够是**正常结果**不是异常：AI 想买但买不起。
                                    // 不写卡片、不报错弹窗，只留一条能搜到的日志。
                                    console.warn('[chat-app] AI 送礼没成功：', res?.error);
                                }
                            } catch (giftErr) {
                                console.warn('[chat-app] AI 送礼出错', giftErr);
                            }
                            continue;
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
                        // ★ AI 用 [一起听:歌名] 发起一起听:通知音乐 App 开会话并放歌
                        if (saved.type === 'listen_together_invite' && saved.listenTogetherRequest) {
                            try {
                                window.dispatchEvent(new CustomEvent('chat:listen-together-request', {
                                    detail: {
                                        aiId: aiPersonId,
                                        song: saved.listenTogetherRequest.song || '',
                                    },
                                }));
                            } catch (_) {}
                        }
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
                                    // 用总渲染器分发:卡片类消息(歌曲/歌单/一起听/位置/红包…)
                                    // 走 renderTextBubble 会画成一句纯文本
                                    const { renderMessage } = await import('./components/message-renderer.js');
                                    const html = renderMessage(
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

                // 5) 不再弹「AI 已回复」灵动岛。
                //    用户就在聊天页看着，消息已经追加到 DOM 了，再弹一个岛是重复信息，
                //    而且会把音乐/通话那类常驻岛顶掉（AGENTS2 §1.3）。
                //    「发出去了 / 还在等」这件事由顶栏的「对方正在输入中」表达，
                //    由 _longPressInvokeAi 那层负责开关（见 services/typing-indicator.js）。
                void startTs;

                // 6) 派发事件给消息列表页,刷新预览
                try {
                    window.dispatchEvent(new CustomEvent('chat:ai-message-received', {
                        detail: { aiPersonId, mode, messages: aiMessages },
                    }));
                } catch (_) {}

                return result;
            },

            /**
             * 群聊长按发送后的 AI 回复。用户那条已经 doSend 写过了。
             * payload: { groupId, mode, text, silentIsland? }
             */
            async sendGroupMessageWithAi(payload = {}) {
                const groupId = String(payload?.groupId || '');
                const mode = String(payload?.mode || 'calendar');
                const text = String(payload?.text || '').trim();
                const silentIsland = !!payload?.silentIsland;
                const _notify = (state, title, body) => {
                    if (silentIsland) return;
                    this.toolkit?.island?.notify?.(state, title, body);
                };
                if (!groupId) {
                    _notify('error', 'AI 对话失败', '缺少 groupId');
                    return null;
                }
                try {
                    const { replyInGroup } = await import('./services/group-ai-reply.js');
                    const result = await replyInGroup({ groupId, mode, userText: text });
                    if (!result?.ok) {
                        this.toolkit?.island?.notify?.('error', 'AI 回复失败', (result?.error || '').slice(0, 200));
                        return result;
                    }
                    try {
                        window.dispatchEvent(new CustomEvent('chat:ai-message-received', {
                            detail: { groupId, mode, conversationType: 'group' },
                        }));
                    } catch (_) {}
                    return result;
                } catch (err) {
                    console.error('[chat-app] sendGroupMessageWithAi failed', err);
                    this.toolkit?.island?.notify?.('error', 'AI 调用异常', err?.message || String(err));
                    return null;
                }
            },

            // ============================================================
            // ★ v0.87 群聊记忆互通 — 设置详情页交互方法(8 个)
            //   - 全部走 data-app-action 派发,framework 调到这里
            //   - 写完 SDK → 二段式(invalidateRendererCache + syncNow)重画
            // ============================================================

            /**
             * 切总开关(整体开启 / 关闭群聊记忆互通)
             *   - payload: 无
             *   - 走 sdk.groupMemorySync.toggleGlobal(user)
             */
            async toggleGroupMemorySyncGlobal() {
                try {
                    const sdk = window.settingsSdk;
                    if (!sdk?.groupMemorySync) {
                        this.toolkit?.island?.notify?.('warning', 'SDK 未就绪');
                        return;
                    }
                    const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                    if (!user) {
                        this.toolkit?.island?.notify?.('warning', '未找到当前用户');
                        return;
                    }
                    const cur = sdk.groupMemorySync.getGlobalConfig(user) || { enabled: false, aiIds: [] };
                    await sdk.groupMemorySync.toggleGlobal(user);
                    const after = sdk.groupMemorySync.getGlobalConfig(user) || { enabled: false, aiIds: [] };
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                    if (window.__appRendererBridge?.syncNow) {
                        window.__appRendererBridge.syncNow({ force: true });
                    }
                    this.toolkit?.island?.notify?.(
                        after.enabled ? 'success' : 'info',
                        after.enabled ? '群聊记忆互通已开启' : '群聊记忆互通已关闭',
                        `已选 ${after.aiIds.length} 个 AI`
                    );
                } catch (err) {
                    console.warn('[chat-app] toggleGroupMemorySyncGlobal failed:', err);
                    this.toolkit?.island?.notify?.('error', '切换失败', String(err?.message || err));
                }
            },

            /**
             * 切换 AI 是否在互通名单里(点 AI 行)
             *   - payload: { aiPersonId }
             *   - 在名单里 → 移除;不在 → 追加
             */
            async toggleGroupMemorySyncAiMembership(payload = {}) {
                try {
                    const aiPersonId = String(payload.aiPersonId || '');
                    if (!aiPersonId) return;
                    const sdk = window.settingsSdk;
                    if (!sdk?.groupMemorySync) {
                        this.toolkit?.island?.notify?.('warning', 'SDK 未就绪');
                        return;
                    }
                    const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                    if (!user) return;
                    const cur = sdk.groupMemorySync.getGlobalConfig(user) || { enabled: false, aiIds: [] };
                    if (cur.aiIds.includes(aiPersonId)) {
                        await sdk.groupMemorySync.removeAi(user, aiPersonId);
                    } else {
                        await sdk.groupMemorySync.addAi(user, aiPersonId);
                    }
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                    if (window.__appRendererBridge?.syncNow) {
                        window.__appRendererBridge.syncNow({ force: true });
                    }
                } catch (err) {
                    console.warn('[chat-app] toggleGroupMemorySyncAiMembership failed:', err);
                    this.toolkit?.island?.notify?.('error', '操作失败', String(err?.message || err));
                }
            },

            /**
             * 切换某个 AI 的个人 enabled 开关
             *   - payload: { aiPersonId }
             */
            async toggleGroupMemorySyncAiEnabled(payload = {}) {
                try {
                    const aiPersonId = String(payload.aiPersonId || '');
                    if (!aiPersonId) return;
                    const sdk = window.settingsSdk;
                    if (!sdk?.groupMemorySync) return;
                    await sdk.groupMemorySync.toggleAi(aiPersonId);
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                    if (window.__appRendererBridge?.syncNow) {
                        window.__appRendererBridge.syncNow({ force: true });
                    }
                } catch (err) {
                    console.warn('[chat-app] toggleGroupMemorySyncAiEnabled failed:', err);
                }
            },

            /**
             * 步进:某个 AI 的「读今天群聊回合数」+1(上限 50)
             */
            async incrementGroupMemorySyncRounds(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                if (!aiPersonId) return;
                const sdk = window.settingsSdk;
                if (!sdk?.groupMemorySync) return;
                const cur = sdk.groupMemorySync.getAiConfig(aiPersonId);
                const next = Math.min(50, (Number(cur.contextRounds) || 0) + 1);
                await sdk.groupMemorySync.setAiContextRounds(aiPersonId, next);
                await this._rerenderGroupMemorySync();
            },

            /**
             * 步进:某个 AI 的「读今天群聊回合数」-1(下限 0)
             */
            async decrementGroupMemorySyncRounds(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                if (!aiPersonId) return;
                const sdk = window.settingsSdk;
                if (!sdk?.groupMemorySync) return;
                const cur = sdk.groupMemorySync.getAiConfig(aiPersonId);
                const next = Math.max(0, (Number(cur.contextRounds) || 0) - 1);
                await sdk.groupMemorySync.setAiContextRounds(aiPersonId, next);
                await this._rerenderGroupMemorySync();
            },

            /**
             * 步进:某个 AI 的「读往期群聊概要数」+1(上限 10)
             */
            async incrementGroupMemorySyncSummaries(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                if (!aiPersonId) return;
                const sdk = window.settingsSdk;
                if (!sdk?.groupMemorySync) return;
                const cur = sdk.groupMemorySync.getAiConfig(aiPersonId);
                const next = Math.min(10, (Number(cur.summaryReadCount) || 0) + 1);
                await sdk.groupMemorySync.setAiSummaryReadCount(aiPersonId, next);
                await this._rerenderGroupMemorySync();
            },

            /**
             * 步进:某个 AI 的「读往期群聊概要数」-1(下限 0)
             */
            async decrementGroupMemorySyncSummaries(payload = {}) {
                const aiPersonId = String(payload.aiPersonId || '');
                if (!aiPersonId) return;
                const sdk = window.settingsSdk;
                if (!sdk?.groupMemorySync) return;
                const cur = sdk.groupMemorySync.getAiConfig(aiPersonId);
                const next = Math.max(0, (Number(cur.summaryReadCount) || 0) - 1);
                await sdk.groupMemorySync.setAiSummaryReadCount(aiPersonId, next);
                await this._rerenderGroupMemorySync();
            },

            /**
             * 全选:把所有 AI 都加入互通名单
             */
            async selectAllGroupMemorySyncAi() {
                const sdk = window.settingsSdk;
                if (!sdk?.groupMemorySync || !sdk?.aiPersons) return;
                const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                if (!user) return;
                const allIds = (() => {
                    try {
                        if (typeof sdk.aiPersons.list === 'function') {
                            return (sdk.aiPersons.list() || []).map((ai) => ai.id).filter(Boolean);
                        }
                        const cache = sdk.aiPersons.cache;
                        if (cache instanceof Map) {
                            return Array.from(cache.keys()).filter(Boolean);
                        }
                        return [];
                    } catch (_) { return []; }
                })();
                await sdk.groupMemorySync.setGlobalConfig(user, { aiIds: allIds });
                await this._rerenderGroupMemorySync();
            },

            /**
             * 取消全选
             */
            async deselectAllGroupMemorySyncAi() {
                const sdk = window.settingsSdk;
                if (!sdk?.groupMemorySync) return;
                const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                if (!user) return;
                await sdk.groupMemorySync.setGlobalConfig(user, { aiIds: [] });
                await this._rerenderGroupMemorySync();
            },

            /**
             * 内部 helper:写完 SDK 后强制重画当前页
             *   - 走 AGENTS.md §32 的二段式:invalidateRendererCache + syncNow
             */
            async _rerenderGroupMemorySync() {
                try {
                    if (typeof window.invalidateRendererCache === 'function') {
                        window.invalidateRendererCache('chat', null);
                    }
                } catch (_) {}
                try {
                    if (window.__appRendererBridge?.syncNow) {
                        window.__appRendererBridge.syncNow({ force: true });
                    } else if (typeof window !== 'undefined' && window.__detailRenderTick) {
                        window.__detailRenderTick.value++;
                    }
                } catch (_) {}
            },
        },
    };
}

export default createChatApp;