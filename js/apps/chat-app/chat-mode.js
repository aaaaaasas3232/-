/**
 * chat-app / 全局聊天记录模式（v0.23）
 *
 *   用户在消息列表页右上角「切换按钮」选择「日历模式」/「故事模式」，
 *   这个选择是**全局会话级**的——影响所有 list 视图渲染，但不持久化到 db
 *   （每次重新打开 chat-app 默认回到「日历模式」）。
 *
 *   为什么存 localStorage 而不是 db：
 *   - 这是 UI 偏好，类似「显示密度」，不是数据
 *   - db 升级代价高（IndexedDB schema 改动需要迁移）
 *   - localStorage 够快，刷新后保留意图
 *
 *   设计:
 *   - 单一来源 `window.__chatRecordMode` (string)，由本模块读写
 *   - 切换通过 `setChatRecordMode(mode)` + 派发 `chat:record-mode-changed` 事件
 *   - list 渲染通过 `getChatRecordMode()` 读当前值
 *
 *   'calendar' | 'story'
 */

const STORAGE_KEY = 'xiaoting::chat-record-mode-v1';
const DEFAULT_MODE = 'calendar';
const VALID_MODES = new Set(['calendar', 'story']);

function _readStorage() {
    if (typeof window === 'undefined') return DEFAULT_MODE;
    try {
        const v = window.localStorage?.getItem(STORAGE_KEY);
        if (v && VALID_MODES.has(v)) return v;
    } catch (_) {}
    return DEFAULT_MODE;
}

function _writeStorage(mode) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage?.setItem(STORAGE_KEY, mode);
    } catch (_) {}
}

export function getChatRecordMode() {
    if (typeof window !== 'undefined' && window.__chatRecordMode) {
        return window.__chatRecordMode;
    }
    const v = _readStorage();
    if (typeof window !== 'undefined') window.__chatRecordMode = v;
    return v;
}

export function setChatRecordMode(mode) {
    if (!VALID_MODES.has(mode)) mode = DEFAULT_MODE;
    if (typeof window !== 'undefined') {
        const prev = window.__chatRecordMode;
        window.__chatRecordMode = mode;
        _writeStorage(mode);
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