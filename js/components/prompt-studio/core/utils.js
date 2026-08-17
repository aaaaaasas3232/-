/**
 * prompt-studio / core / utils.js
 * ------------------------------------------------------------
 * 通用工具函数,从 chat-app/pages/prompt-manager-page.js 原封不动搬过来
 * 来源行号:原 prompt-manager-page.js line 49~84
 * 阶段 1 步骤 1.2 抽出
 *
 * 用途:
 *   - getAvatarColor:头像背景色 hash(与 chat-settings / calendar-view 同款)
 *   - previewText:超长文本截断(用于卡片预览)
 *   - parseContactId:pageId 解析 → aiPersonId + mode
 *
 * 注意:函数签名 / 行为 0 修改,只搬位置
 */

import { escapeHtml } from '@/src/core/escape.js';

/**
 * 头像背景色工具(与 chat-settings / calendar-view 同款)
 * @param {string} id
 * @returns {string}  背景色 hex
 */
export function getAvatarColor(id) {
    const palette = ['#A8C8EC', '#F4A6CD', '#B8D4F0', '#FFD4E5', '#C8E6F4', '#FFC8DD', '#B8E6CF', '#D4B8F0'];
    let hash = 0;
    for (let i = 0; i < (id || '').length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
    }
    return palette[Math.abs(hash) % palette.length];
}

/**
 * 内容预览(超过 limit 字符就截断 + …)
 * @param {string} text
 * @param {number} limit
 * @returns {string}
 */
export function previewText(text, limit = 80) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (s.length <= limit) return s || '(空内容)';
    return s.slice(0, limit) + '…';
}

/**
 * 把 pageId 解析成 aiPersonId + mode。
 *   - 'ai0'                          → { aiPersonId: 'ai0', mode: 'calendar' }
 *   - 'ai0-calendar' / 'ai0-story'   → 标准形态
 *   - 'private-ai0-calendar'         → 切掉 private- 前缀后同标准形态
 * @param {string} contactId
 * @returns {{ aiPersonId: string, mode: 'calendar' | 'story' }}
 */
export function parseContactId(contactId) {
    let id = String(contactId || '');
    if (id.startsWith('private-')) id = id.slice('private-'.length);
    const lastDash = id.lastIndexOf('-');
    if (lastDash > 0) {
        const tail = id.slice(lastDash + 1);
        if (tail === 'calendar' || tail === 'story') {
            return { aiPersonId: id.slice(0, lastDash), mode: tail };
        }
    }
    return { aiPersonId: id, mode: 'calendar' };
}

// 重新 export escapeHtml(让 prompt-studio 内部消费方可以从 utils 单点 import)
export { escapeHtml };
