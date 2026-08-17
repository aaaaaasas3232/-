/**
 * 「对方正在输入中…」状态
 * ====================================================================
 * 用户按下发送之后，反馈应该长在**聊天界面本身**上（顶栏的名字位置变成
 * 闪烁的「对方正在输入中」），而不是弹一个灵动岛告诉他「我发出去了」。
 * 灵动岛是给「你不在这个页面时也要知道」的事用的；用户明明正盯着聊天页，
 * 再弹一个岛既多余又会把常驻岛顶掉。
 *
 * 三条约束（都是从需求直接来的）：
 *   1. 按下发送 → 顶栏名字立刻变成「对方正在输入中」并闪烁
 *   2. 切出 murmur 再切回来，AI 还没回 → 还是「正在输入中」
 *   3. 消息被 JS 接到、渲染出来 → 恢复成名字
 *
 * 为什么状态放模块级内存、而不是 localStorage：
 *   这个状态的生命周期**就是那个 fetch 的生命周期**。切 App 只是把 DOM 换掉，
 *   JS 里的 promise 还活着，所以内存态是准的。但刷新页面会把请求一起干掉，
 *   这时候如果状态存在 localStorage 里，就会留下一个永远转不完的
 *   「正在输入中」—— 那是假的。宁可丢状态，不要留假状态。
 *
 * DOM 是会被重画掉的（v-html 整块替换），所以这里不是「改一次就完事」，
 * 而是「记状态 + 提供一个重放函数」，页面每次挂载都重放一遍。
 * 重放的调用点在 index.js 的 initPrivateChatInteractions /
 * initGroupChatInteractions 里 —— 那两个函数由 MutationObserver 驱动，
 * 是唯一能保证「innerHTML 已经写完」的时机（AGENTS.md §X.7 的结论）。
 */

const TYPING_TEXT = '对方正在输入中';
const TYPING_CLASS = 'chat-header-name--typing';

/** convKey -> { startedAt } */
const _typing = new Map();

/** 会话标识：私聊按 aiPersonId，群聊按 groupId */
export function typingKey(conversationType, id) {
    return `${conversationType === 'group' ? 'group' : 'private'}:${id}`;
}

export function isTyping(conversationType, id) {
    return _typing.has(typingKey(conversationType, id));
}

/** 当前屏幕上那个会话根节点（同一时刻只可能有一个详情页） */
function findChatRoot(conversationType, id) {
    const base = '.app-shell[data-app-id="chat"] ';
    if (conversationType === 'group') {
        return document.querySelector(`${base}.chat-group[data-group-id="${id}"]`)
            || document.querySelector(`${base}.chat-group`);
    }
    return document.querySelector(`${base}.chat-private[data-contact-id="${id}"]`)
        || document.querySelector(`${base}.chat-private`);
}

/** 顶栏那块显示名字的元素（私聊和群聊用的是同一个 class） */
function findNameEl(root) {
    return root?.querySelector('.chat-header-name') || null;
}

function paintTyping(nameEl) {
    if (!nameEl || nameEl.classList.contains(TYPING_CLASS)) return;
    // 把原名字存在 dataset 里，恢复时用它 —— 不能靠「重新查一次联系人」，
    // 因为备注/群名可能刚被改过，重查会把用户刚改的名字覆盖回旧值。
    if (nameEl.dataset.originalName === undefined) {
        nameEl.dataset.originalName = nameEl.textContent || '';
    }
    nameEl.classList.add(TYPING_CLASS);
    nameEl.textContent = TYPING_TEXT;
}

function paintIdle(nameEl) {
    if (!nameEl) return;
    if (!nameEl.classList.contains(TYPING_CLASS)) return;
    nameEl.classList.remove(TYPING_CLASS);
    const original = nameEl.dataset.originalName;
    if (original !== undefined) {
        nameEl.textContent = original;
        delete nameEl.dataset.originalName;
    }
}

/**
 * 把内存里的状态重放到当前 DOM 上。
 * 页面每次重建后都要调一次，否则重画会把「正在输入中」抹掉。
 */
export function applyTypingToDom(conversationType, id) {
    const root = findChatRoot(conversationType, id);
    if (!root) return;
    const nameEl = findNameEl(root);
    if (!nameEl) return;
    if (isTyping(conversationType, id)) paintTyping(nameEl);
    else paintIdle(nameEl);
}

/**
 * 给一个刚挂载好的会话根节点重放状态。
 * 从节点自己的 data 属性推会话身份，调用方不用再传一遍。
 */
export function applyTypingToRoot(rootEl) {
    if (!rootEl) return;
    const isGroup = rootEl.classList.contains('chat-group');
    const id = isGroup
        ? (rootEl.getAttribute('data-group-id') || '')
        : (rootEl.getAttribute('data-contact-id') || '');
    if (!id) return;
    const nameEl = findNameEl(rootEl);
    if (!nameEl) return;
    if (isTyping(isGroup ? 'group' : 'private', id)) paintTyping(nameEl);
    else paintIdle(nameEl);
}

export function beginTyping(conversationType, id) {
    if (!id) return;
    _typing.set(typingKey(conversationType, id), { startedAt: Date.now() });
    applyTypingToDom(conversationType, id);
}

export function endTyping(conversationType, id) {
    if (!id) return;
    _typing.delete(typingKey(conversationType, id));
    applyTypingToDom(conversationType, id);
}

/** 出异常时的兜底：把所有会话的「正在输入中」都摘掉，别留一个转不完的 */
export function clearAllTyping() {
    _typing.clear();
    document.querySelectorAll(`.${TYPING_CLASS}`).forEach(paintIdle);
}
