/**
 * chat-app / 全局聊天记录模式（v0.23）
 *
 *   用户在消息列表页右上角「切换按钮」选择「日历模式」/「故事模式」，
 *   这个选择**只在这次停留在 murmur 里有效**：
 *   切出去再进来、或者刷新网页之后再打开，一律回到「日历模式」。
 *
 *   ⚠️ 2026-08-13：这段行为在注释里写了很久（v0.23 起），但代码从来没实现 ——
 *   老实现把模式写进 localStorage 并且无条件读回来，所以一旦切到故事模式
 *   就再也回不去了。
 *
 *   ── 修的时候走过一次弯路，值得记 ──────────────────────
 *   第一版只加了「openApp 时 reset」。逻辑没错，实测三种路径也都通过，
 *   但它**依赖一个事件**：只有走 framework 的 `openApp()` 才会归位。
 *   卡片模式恢复、以及任何将来新增的进入方式都不经过那里，
 *   一漏就又变成「有时候好使有时候不好使」。
 *
 *   现在改成**不依赖任何事件也成立**：
 *     1. 模式**根本不落盘**（这个文件里已经没有 localStorage 了）。
 *        它只活在 `window.__chatRecordMode` 里，刷新页面天然回到默认值 ——
 *        「刷新后回日历」不再需要谁去 reset。
 *     2. 在此之上，openApp / closeApp 各补一次 reset，
 *        覆盖「不刷新、只是切出去再进来」。
 *   两条是**冗余**的，任何一条单独成立都能满足需求 —— 这是有意的：
 *   这种「用户偶尔才会注意到」的行为，靠单点保证迟早会悄悄失效。
 *
 *   设计:
 *   - 单一来源 `window.__chatRecordMode` (string)，由本模块读写
 *   - 切换通过 `setChatRecordMode(mode)` + 派发 `chat:record-mode-changed` 事件
 *   - list 渲染通过 `getChatRecordMode()` 读当前值
 *
 *   'calendar' | 'story'
 */

// 老版本写过这个 key。现在不写了，但要主动清掉 ——
// 不清的话用户浏览器里会一直躺着一个 'story'，虽然没人读，
// 但下次有人「顺手把持久化加回来」时会立刻踩到（孤儿 key 是本项目
// 最高频的一类 bug，见 AGENTS2 §9.6）。
const LEGACY_STORAGE_KEY = 'xiaoting::chat-record-mode-v1';
const DEFAULT_MODE = 'calendar';
const VALID_MODES = new Set(['calendar', 'story']);

if (typeof window !== 'undefined') {
    try { window.localStorage?.removeItem(LEGACY_STORAGE_KEY); } catch (_) {}
}

export function getChatRecordMode() {
    if (typeof window !== 'undefined' && window.__chatRecordMode) {
        return window.__chatRecordMode;
    }
    // 内存里没有 = 页面刚加载 = 这次是「重新打开」→ 日历模式。
    // 不去读任何持久化，「刷新后回默认」由这一行天然保证。
    if (typeof window !== 'undefined') window.__chatRecordMode = DEFAULT_MODE;
    return DEFAULT_MODE;
}

export function setChatRecordMode(mode) {
    if (!VALID_MODES.has(mode)) mode = DEFAULT_MODE;
    if (typeof window !== 'undefined') {
        const prev = window.__chatRecordMode;
        window.__chatRecordMode = mode;
        if (prev !== mode) {
            window.dispatchEvent(new CustomEvent('chat:record-mode-changed', {
                detail: { mode, prev },
            }));
        }
    }
    return mode;
}

export function toggleChatRecordMode() {
    const cur = getChatRecordMode();
    const next = cur === 'calendar' ? 'story' : 'calendar';
    setChatRecordMode(next);
    return next;
}

/**
 * 归位到日历模式。
 *
 * 由 chat-app 在 framework 的 `phone:app-opened` / `phone:app-closed`
 * 事件里调用。注意这是**第二道保险**：就算这两个事件一个都没触发，
 * 「刷新后回日历」也已经由 getChatRecordMode() 不读持久化保证了。
 */
export function resetChatRecordMode() {
    return setChatRecordMode(DEFAULT_MODE);
}

export const CHAT_RECORD_MODES = {
    calendar: {
        key: 'calendar',
        label: '日历模式',
        bgClass: 'is-calendar-mode',
        // 蓝主题（与「普通」色系一致）
        listBg: '#FFFFFF',
    },
    story: {
        key: 'story',
        label: '故事模式',
        bgClass: 'is-story-mode',
        // 粉主题（游戏模式信号）
        listBg: '#FFE8F0',
    },
};

export function getModeConfig(mode) {
    return CHAT_RECORD_MODES[mode] || CHAT_RECORD_MODES.calendar;
}