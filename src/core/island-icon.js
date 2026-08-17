/**
 * 灵动岛左侧圆标的唯一入口。
 *
 * 历史事故：第三方 / 预览 / 通知把 canvas 的 `ctx`、画图函数、裸文本
 * 塞进 `icon` / `senderAvatar`，Vue 再 `v-html` 或 `{{ }}` 出去，
 * 左边圆里就会出现 `ctx`、`function (ctx) { ... }` 或整段 SVG 源码。
 *
 * 规则：
 *   - 只有「以 <svg 开头的字符串」才能当图标 HTML
 *   - 只有 1～2 个字的安全文本（姓名首字）才能当文字头像
 *   - 函数 / 对象 / 源码长得像 JS 的字符串一律丢掉，回退系统图标
 */

export const ISLAND_STATE_COLORS = Object.freeze({
    success: { bg: 'rgba(37,111,64,1)', color: '#4ade80', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' },
    warning: { bg: 'rgba(126,96,18,1)', color: '#fbbf24', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>' },
    error: { bg: 'rgba(124,57,57,1)', color: '#f87171', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' },
    info: { bg: 'rgba(48,83,125,1)', color: '#60a5fa', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path fill="#fff" d="M11 7h2v2h-2zm0 4h2v6h-2z"/></svg>' },
    message: { bg: 'rgba(48,83,125,1)', color: '#60a5fa', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' },
    call: { bg: 'rgba(37,111,64,1)', color: '#4ade80', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>' },
    system: { bg: 'rgba(71,71,74,1)', color: '#8e8e93', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>' },
});

const CODE_LOOKING = /^(function|class|const|let|var|ctx)\b|function\s*\(|=>\s*\{|CanvasRenderingContext|\bctx\s*[\).\[]/;

export function getIslandState(type) {
    return ISLAND_STATE_COLORS[type] || ISLAND_STATE_COLORS.info;
}

export function isSafeSvgIcon(raw) {
    if (typeof raw !== 'string') return false;
    const s = raw.trim();
    if (!s || s.length > 20000) return false;
    if (!s.toLowerCase().startsWith('<svg')) return false;
    if (CODE_LOOKING.test(s) && !/<svg[\s>]/i.test(s)) return false;
    return true;
}

/**
 * @param {*} raw
 * @param {string} [fallback]
 * @returns {string} 可直接 v-html 的 SVG，或 fallback
 */
export function sanitizeIslandIcon(raw, fallback = '') {
    if (typeof raw === 'function' || (raw && typeof raw === 'object')) {
        return fallback || '';
    }
    const s = String(raw ?? '').trim();
    if (!s) return fallback || '';
    if (CODE_LOOKING.test(s)) return fallback || '';
    if (isSafeSvgIcon(s)) return s;
    return fallback || '';
}

/**
 * 文字头像只允许极短、不像代码的内容（「听」「A」）。
 */
export function isSafeAvatarText(raw) {
    if (typeof raw !== 'string') return false;
    const s = raw.trim();
    if (!s || s.startsWith('<')) return false;
    if (s.length > 2) return false;
    if (CODE_LOOKING.test(s)) return false;
    if (/[{}();=]/.test(s)) return false;
    return true;
}

export function sanitizeSlotIcon(slot, fallback = '') {
    return sanitizeIslandIcon(slot?.icon, fallback);
}
