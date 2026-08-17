/**
 * 群聊小游戏 / 活视图控制器
 *
 * 引擎只写 store，界面靠这个文件跟上。它做四件事：
 *
 *   1. 用 MutationObserver 盯着 `.cg-page` 出现（框架每次重画详情页都会重建它）
 *   2. 订阅 store，状态一变就给区域打补丁
 *   3. 打完补丁把消息流滚到底、把骰子动画挂上
 *   4. 挂一个作用域限定在 chat shell 里的回车监听（框架只代理 click）
 *
 * ★ 为什么用 MutationObserver 而不是 `queueMicrotask`
 *   queueMicrotask 比 `mountInto`（setTimeout 0）早，拿到的是**上一次**的节点，
 *   紧接着 `rootEl.innerHTML = html` 会把它整个换掉 —— 绑上去的东西跟着旧节点一起死。
 *   这个坑 chat-app 在 v0.48 踩过一次（群聊工具栏全失效），
 *   MutationObserver 是唯一能保证 innerHTML 已经写完的时机（README §X.7）。
 *
 * ★ 为什么要区域比对而不是整页重画
 *   见 `components/game-shell.js` 顶部的说明：滚动位置、输入框里打了一半的字、
 *   骰子动画，三样东西都受不了整页重画。
 */

import { getSession, subscribe } from './core/store.js';
import { markSeen } from './core/engine.js';
import { getGame } from './registry.js';
import { patchFeed } from './components/log-feed.js';
import { mountDice } from './components/dice-3d.js';
import { renderRegions } from './components/game-shell.js';

const SHELL = '.app-shell[data-app-id="chat"]';

/** 当前挂着的那一页。同时只可能有一个对局页。 */
let mounted = null; // { el, groupId, unsubscribe, lastRegions }

// ---------------------------------------------------------------------------
// 挂载 / 卸载
// ---------------------------------------------------------------------------

function mount(el) {
    if (!el || el.__cgMounted) return;
    const groupId = el.getAttribute('data-cg-group') || '';
    if (!groupId) return;
    el.__cgMounted = true;

    unmountCurrent();

    const unsubscribe = subscribe(groupId, () => scheduleSync());
    mounted = { el, groupId, unsubscribe, lastRegions: {} };

    // 「用户正在看这一局」—— 引擎用它决定要不要弹岛（core/engine.notifyTurn）。
    // 这是界面告诉引擎的**唯一**一件事，方向是单向的：引擎依然不认识 DOM。
    window.__chatGameViewing = groupId;
    markSeen(groupId);

    sync(true);
}

function unmountCurrent() {
    if (!mounted) return;
    try { mounted.unsubscribe(); } catch (_) {}
    if (window.__chatGameViewing === mounted.groupId) window.__chatGameViewing = '';
    mounted = null;
}

/** 页面被框架换掉之后，旧节点会脱离文档。定期确认一下。 */
function ensureAlive() {
    if (!mounted) return false;
    if (mounted.el.isConnected) return true;
    unmountCurrent();
    return false;
}

// ---------------------------------------------------------------------------
// 同步
// ---------------------------------------------------------------------------

let syncHandle = 0;
function scheduleSync() {
    if (syncHandle) return;
    // 合并同一帧里的多次状态变化：引擎一步里经常连改好几次 store
    syncHandle = requestAnimationFrame(() => {
        syncHandle = 0;
        sync(false);
    });
}

function sync(first) {
    if (!ensureAlive()) return;
    const { el, groupId } = mounted;
    const session = getSession(groupId);
    if (!session) return;
    const game = getGame(session.gameId);
    if (!game) return;

    let view;
    try {
        view = game.buildView(session);
    } catch (err) {
        console.error('[chat-games] 视图渲染失败', err);
        return;
    }

    // 顶栏的标签（存活数 / 现金）也会变
    const tag = el.querySelector('.cg-topbar__right');
    if (tag && tag.innerHTML !== (view.right || '')) tag.innerHTML = view.right || '';
    const sub = el.querySelector('.cg-topbar__sub');
    if (sub && sub.textContent !== (view.subtitle || '')) sub.textContent = view.subtitle || '';
    if (el.getAttribute('data-cg-status') !== session.status) {
        el.setAttribute('data-cg-status', session.status);
    }

    const regions = renderRegions(session, view);
    for (const [name, html] of Object.entries(regions)) {
        if (mounted.lastRegions[name] === html) continue;
        const target = el.querySelector(`[data-cg-region="${name}"]`);
        if (!target) continue;
        // 输入框里打了一半的字：换 HTML 之前存一下，换完填回去。
        // 用户可能正在打字时 AI 说了句话触发重画 —— 那不该把他的输入吃掉。
        const draft = readDraft(target);
        target.innerHTML = html;
        if (draft) writeDraft(target, draft);
        mounted.lastRegions[name] = html;
    }

    // 消息流走增量追加（见 log-feed.patchFeed 的说明）
    const feedList = el.querySelector('[data-cg-feed="1"]');
    if (feedList) {
        const atBottom = isNearBottom(feedList.parentElement || feedList);
        const added = patchFeed(feedList, session, { viewerId: view.viewerId });
        if (first || (added && atBottom)) scrollToBottom(feedList.parentElement || feedList);
    }

    mountDice(el);
}

function readDraft(container) {
    const input = container.querySelector('[data-cg-input="1"]');
    if (!input) return null;
    const value = input.value || '';
    if (!value) return null;
    return { value, start: input.selectionStart, end: input.selectionEnd, focused: document.activeElement === input };
}

function writeDraft(container, draft) {
    const input = container.querySelector('[data-cg-input="1"]');
    if (!input) return;
    input.value = draft.value;
    if (draft.focused) {
        try {
            input.focus();
            input.setSelectionRange(draft.start, draft.end);
        } catch (_) { /* textarea/input 类型差异，失败就算了 */ }
    }
}

function isNearBottom(el) {
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
}

function scrollToBottom(el) {
    if (!el) return;
    el.scrollTop = el.scrollHeight;
}

/** 外部（method 里改完状态）也可以主动要求刷新一次。 */
export function refreshGameView() {
    scheduleSync();
}

// ---------------------------------------------------------------------------
// 群聊顶部那条「有一局在打」的回条
// ---------------------------------------------------------------------------

/**
 * 用户可能正待在群聊里（而不是对局页），这时候轮到他了要能立刻看出来。
 *
 * ★ 只改那一条的文字和状态，**不重画群聊页** —— 群聊页重画一次要重读消息、
 *   重建几十个气泡，而这里变化的只有两个字。一局游戏几百次状态变化，
 *   每次都整页重画会让群聊卡得没法用。
 */
function patchGameBar(session, groupId) {
    // 不用 `[data-group-id="..."]` 拼选择器：群 id 里可能有需要转义的字符，
    // 而 CSS.escape 在非浏览器环境（回归测试）里不存在，会把订阅回调整个炸掉。
    const bars = document.querySelectorAll?.(`${SHELL} .chat-game-bar`) || [];
    for (const bar of bars) {
        const group = bar.closest?.('.chat-group');
        if (!group || group.getAttribute('data-group-id') !== groupId) continue;
        if (!session || session.status !== 'running') {
            bar.remove();
            continue;
        }
        const waiting = !!session.pending;
        if (waiting) bar.setAttribute('data-waiting', '1');
        else bar.removeAttribute('data-waiting');
        const cta = bar.querySelector('.chat-game-bar__cta');
        if (cta) cta.textContent = waiting ? '轮到你了' : '回到对局';
        const text = bar.querySelector('.chat-game-bar__text');
        const label = session.phaseLabel || '进行中';
        if (text?.lastChild?.nodeType === 3 && text.lastChild.textContent.trim() !== label) {
            text.lastChild.textContent = label;
        }
    }
}

if (typeof window !== 'undefined' && !window.__chatGameBarWatch) {
    window.__chatGameBarWatch = true;
    subscribe('*', (session, groupId) => patchGameBar(session, groupId));
}

/** 读当前输入框里的内容。method 收到点击时用它取值。 */
export function readGameInput() {
    const input = document.querySelector(`${SHELL} .cg-page [data-cg-input="1"]`);
    return input ? String(input.value || '').trim() : '';
}

/** 清空输入框（发送成功后）。 */
export function clearGameInput() {
    const input = document.querySelector(`${SHELL} .cg-page [data-cg-input="1"]`);
    if (input) input.value = '';
}

// ---------------------------------------------------------------------------
// 安装（模块加载时跑一次）
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined' && !window.__chatGameViewInstalled) {
    window.__chatGameViewInstalled = true;

    const scan = (node) => {
        if (!node || node.nodeType !== 1) return;
        if (node.classList?.contains('cg-page')) mount(node);
        if (node.querySelectorAll) node.querySelectorAll('.cg-page').forEach(mount);
    };

    new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) scan(node);
            // 页面被移除时立刻解绑，别等下一次 sync 才发现
            if (mounted && m.removedNodes.length && !mounted.el.isConnected) unmountCurrent();
        }
    }).observe(document.body, { childList: true, subtree: true });

    // 首次加载时页面可能已经在了
    document.querySelectorAll('.cg-page').forEach(mount);

    /**
     * 回车发送。
     *
     * 框架只代理 click，键盘事件要自己挂，而且**必须用 app-shell 限定作用域**，
     * 否则会串到别的 App（AGENTS2 §3.9）。
     */
    document.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter' || ev.shiftKey || ev.isComposing) return;
        const input = ev.target?.closest?.('[data-cg-input="1"]');
        if (!input || !input.closest(SHELL)) return;
        const bar = input.closest('.cg-inputbar');
        const sendBtn = bar?.querySelector('.cg-btn.is-send');
        if (!sendBtn) return;
        ev.preventDefault();
        sendBtn.click();
    }, true);
}
