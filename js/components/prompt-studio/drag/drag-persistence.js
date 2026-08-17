/**
 * prompt-studio / drag / drag-persistence.js
 * ------------------------------------------------------------
 * 上下文顺序持久化(阶段 1 步骤 1.6)
 *
 * 从 chat-app/index.js 的 hydrate / reorderContextPrompts 里抽出来
 * 原来的内联实现:
 *   - _loadContextOrder()  hydrate 阶段从 localStorage 同步读取
 *   - _saveContextOrder(map)  reorderContextPrompts 写完内存后同步写 localStorage
 *
 * 函数签名 / 行为完全等价,只是把函数从 chat-app/index.js 搬到 prompt-studio。
 */

import { STATE_KEYS } from '../persistence/state-keys.js';

/**
 * 读取上下文顺序 map
 * @returns {Record<string, string[]>}  { [aiPersonId]: string[] of id }
 */
export function loadContextOrder() {
    if (typeof localStorage === 'undefined') return {};
    try {
        const raw = localStorage.getItem(STATE_KEYS.CONTEXT_ORDER);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) {
        return {};
    }
}

/**
 * 写入上下文顺序 map
 * @param {Record<string, string[]>} map
 */
export function saveContextOrder(map) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(STATE_KEYS.CONTEXT_ORDER, JSON.stringify(map || {}));
    } catch (_) {
        // 隐私模式 / 配额满 —— 静默兜底,不抛
    }
}
