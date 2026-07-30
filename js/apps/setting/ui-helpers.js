/**
 * 设置 App · UI 辅助函数
 *
 *  - re-export escapeHtml（避免每个 section 都要从 SDK 引）
 *  - dispatchMethodAction：派发一个 appMethod action，模拟「在按钮上写 data-app-action」的效果
 *  - dispatchFieldAction：派发带 payload 的 appMethod action
 *
 * 之所以单独抽出来：
 *  1. settings 多个文件都要发 action，集中在一个地方更省 import；
 *  2. 后续如果改派发协议（比如换成 ChannelMessage），只改这里。
 */

import { escapeHtml } from '@/src/core/escape.js';

export { escapeHtml };

/** 设置 App 的固定 appId（settings） */
export const SETTINGS_APP_ID = 'settings';

/**
 * 派发一个 appMethod 事件，等价于在按钮上写：
 *   data-app-action='{"action":"appMethod","appId":"settings","method":"...","payload":{...}}'
 */
export function dispatchMethodAction(method, payload) {
    const detail = {
        action: 'appMethod',
        appId: SETTINGS_APP_ID,
        method,
        payload,
    };
    window.dispatchEvent(new CustomEvent('app:page-action', { detail }));
}

/**
 * 由 scope（world / user / ai / api）+ fieldName → 默认方法名
 *   updateWorldField, updateUserField, updateAiField, updateApiField
 * 一些特殊的 list 字段（preferences / keyPoints / rules）走 draft 文本方法。
 */
export function pickMethodForScopeField(scope, field) {
    const cap = scope[0].toUpperCase() + scope.slice(1);
    if (field === 'preferences' || field === 'keyPoints' || field === 'rules') {
        return `update${cap}Text`;
    }
    return `update${cap}Field`;
}

/**
 * 把 data-settings-field="scope.field" 解析成 {scope, field}
 * 不带 . 的会原样返回 null，让上层跳过。
 */
export function parseSettingsFieldPath(fieldPath) {
    if (!fieldPath || typeof fieldPath !== 'string') return null;
    const dot = fieldPath.indexOf('.');
    if (dot <= 0 || dot === fieldPath.length - 1) return null;
    return {
        scope: fieldPath.slice(0, dot),
        field: fieldPath.slice(dot + 1),
    };
}

/**
 * 把任意值规整为 CSS 可接受的「hex/linear/radial/conic/颜色值」开头。
 * 给 color input 用。
 */
export function normalizeHexColor(value, fallback = '#000000') {
    if (typeof value !== 'string') return fallback;
    const v = value.trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v;
    return fallback;
}

/**
 * 格式化已保存时间（ISO 友好字符串）
 */
export function formatSavedAt(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}