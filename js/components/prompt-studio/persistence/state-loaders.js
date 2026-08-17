/**
 * prompt-studio / persistence / state-loaders.js
 * ------------------------------------------------------------
 * 5 对「inject 三段式」持久化函数(阶段 1 步骤 1.8)
 *
 * 从 chat-app 的 renderPromptManagerPage() 函数体里抽出来的「渲染兜底加载」逻辑:
 *   - 内存 map 为空 → 直接读 localStorage → 回填内存(防 HMR / 旧实例不重跑 hydrate)
 *   - 函数返回规范化后的 map
 *
 * 5 对:
 *   1) replyFormatInject        —— v0.62.x 引入
 *   2) kChainInject             —— v0.63 引入(2026-08-09 移除)
 *   3) stickerLibraryInject     —— v0.64 引入
 *   4) memorySummaryInject      —— v0.66 引入
 *   5) contextModeInject        —— v0.68 引入
 *
 * 函数行为完全等价,只是把内联代码提到模块层 + 增加 hydrate 同步加载 helper。
 */

import { STATE_KEYS } from './state-keys.js';

/**
 * 通用「localStorage 读取 map」helper
 * @param {string} key
 * @returns {object}
 */
function _loadMapFromStorage(key) {
    if (typeof localStorage === 'undefined') return {};
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) {
        return {};
    }
}

/**
 * 通用「localStorage 写入 map」helper
 * @param {string} key
 * @param {object} map
 */
function _saveMapToStorage(key, map) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(map || {}));
    } catch (_) {
        // 隐私模式 / 配额满 —— 静默兜底
    }
}

// ============================================================
// 1) replyFormatInject —— v0.62.x 「回复格式 + 短句聊天风格」启停
// ============================================================
export function loadReplyFormatInject() {
    return _loadMapFromStorage(STATE_KEYS.REPLY_FORMAT_INJECT);
}
export function saveReplyFormatInject(map) {
    _saveMapToStorage(STATE_KEYS.REPLY_FORMAT_INJECT, map);
}

// ============================================================
// 3) stickerLibraryInject —— v0.64 「AI 表情包库」启停
//   （kChainInject 已随 K 链功能移除 2026-08-09）
// ============================================================
export function loadStickerLibraryInject() {
    return _loadMapFromStorage(STATE_KEYS.STICKER_LIBRARY_INJECT);
}
export function saveStickerLibraryInject(map) {
    _saveMapToStorage(STATE_KEYS.STICKER_LIBRARY_INJECT, map);
}

// ============================================================
// 4) memorySummaryInject —— v0.66 「记忆概要」启停
// ============================================================
export function loadMemorySummaryInject() {
    return _loadMapFromStorage(STATE_KEYS.MEMORY_SUMMARY_INJECT);
}
export function saveMemorySummaryInject(map) {
    _saveMapToStorage(STATE_KEYS.MEMORY_SUMMARY_INJECT, map);
}

// ============================================================
// 5) contextModeInject —— v0.68 「上下文模式」启停
// ============================================================
export function loadContextModeInject() {
    return _loadMapFromStorage(STATE_KEYS.CONTEXT_MODE_INJECT);
}
export function saveContextModeInject(map) {
    _saveMapToStorage(STATE_KEYS.CONTEXT_MODE_INJECT, map);
}

// ============================================================
// ★ 渲染兜底 helper(从 prompt-manager-page renderPromptManagerPage 里抽出来)
//   - 内存 map 为空时,自动从 localStorage 兜底加载并回填内存
//   - 防 HMR / 旧 chat-app 实例不重跑 hydrate 时 state 全空
// ============================================================

/**
 * 渲染兜底加载(replyFormatInject)
 * @param {object} app  chat-app 实例
 * @returns {object}  规范化后的 map(空对象兜底)
 */
export function hydrateReplyFormatInject(app) {
    if (!app || !app.state || !app.state.chat || !app.state.chat.replyFormatInject
        || Object.keys(app.state.chat.replyFormatInject).length === 0) {
        const loaded = loadReplyFormatInject();
        if (Object.keys(loaded).length > 0 && app) {
            if (!app.state) app.state = {};
            if (!app.state.chat) app.state.chat = {};
            app.state.chat.replyFormatInject = loaded;
        }
        return loaded || {};
    }
    return app.state.chat.replyFormatInject;
}

/**
 * 渲染兜底加载(kChainInject)
 *   （K 链功能已移除 2026-08-09,这里保留 noop 防止旧 import 报错）
 */
export function hydrateKChainInject(app) {
    return {};
}

/**
 * 渲染兜底加载(stickerLibraryInject)
 */
export function hydrateStickerLibraryInject(app) {
    if (!app || !app.state || !app.state.chat || !app.state.chat.stickerLibraryInject
        || Object.keys(app.state.chat.stickerLibraryInject).length === 0) {
        const loaded = loadStickerLibraryInject();
        if (Object.keys(loaded).length > 0 && app) {
            if (!app.state) app.state = {};
            if (!app.state.chat) app.state.chat = {};
            app.state.chat.stickerLibraryInject = loaded;
        }
        return loaded || {};
    }
    return app.state.chat.stickerLibraryInject;
}

/**
 * 渲染兜底加载(memorySummaryInject)
 */
export function hydrateMemorySummaryInject(app) {
    if (!app || !app.state || !app.state.chat || !app.state.chat.memorySummaryInject
        || Object.keys(app.state.chat.memorySummaryInject).length === 0) {
        const loaded = loadMemorySummaryInject();
        if (Object.keys(loaded).length > 0 && app) {
            if (!app.state) app.state = {};
            if (!app.state.chat) app.state.chat = {};
            app.state.chat.memorySummaryInject = loaded;
        }
        return loaded || {};
    }
    return app.state.chat.memorySummaryInject;
}

/**
 * 渲染兜底加载(contextModeInject)
 */
export function hydrateContextModeInject(app) {
    if (!app || !app.state || !app.state.chat || !app.state.chat.contextModeInject
        || Object.keys(app.state.chat.contextModeInject).length === 0) {
        const loaded = loadContextModeInject();
        if (Object.keys(loaded).length > 0 && app) {
            if (!app.state) app.state = {};
            if (!app.state.chat) app.state.chat = {};
            app.state.chat.contextModeInject = loaded;
        }
        return loaded || {};
    }
    return app.state.chat.contextModeInject;
}

/**
 * 渲染兜底加载(contextOrder)—— 拖拽顺序
 */
export function hydrateContextOrder(app) {
    if (!app || !app.state || !app.state.chat || !app.state.chat.contextOrder
        || Object.keys(app.state.chat.contextOrder).length === 0) {
        const loaded = loadContextOrder();
        if (Object.keys(loaded).length > 0 && app) {
            if (!app.state) app.state = {};
            if (!app.state.chat) app.state.chat = {};
            app.state.chat.contextOrder = loaded;
        }
        return loaded || {};
    }
    return app.state.chat.contextOrder;
}
