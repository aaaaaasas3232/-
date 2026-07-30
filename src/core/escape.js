// ============================================
// XSS 防护 & 文本块渲染
// 从 apps.js 第 47-66 行提取
// ============================================

const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => escapeMap[char]);
}

export function normalizeTextList(value) {
    return Array.isArray(value)
        ? value.filter(Boolean)
        : value == null || value === '' ? [] : [value];
}

export function renderTextBlock(text, className = '') {
    return text
        ? `<div${className ? ` class="${className}"` : ''}>${escapeHtml(text)}</div>`
        : '';
}
