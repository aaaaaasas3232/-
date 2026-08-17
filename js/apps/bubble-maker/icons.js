/**
 * 气泡机 · 图标集
 *
 * Feather 风格线性图标,`stroke="currentColor"`,**不带 width/height**。
 * 尺寸交给 CSS(`_base.css` 里有一条两层 `:where()` 的零特异性兜底,
 * 接住任何忘了配尺寸的图标 —— 否则浏览器会按规范画成 300×150 撑爆布局)。
 *
 * 用法:
 *   <BbIcon name="bubble" />   组件
 *   icon('bubble')             拿字符串
 */

const STROKE = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
    // ── 主导航 ──────────────────────────────────
    bubble: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.5-.7L3 21l1.8-5.2A8.3 8.3 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/>',
    shape: '<path d="M12 3 3 8.5v7L12 21l9-5.5v-7z"/><path d="M12 12 3 8.5"/><path d="M12 12v9"/><path d="m12 12 9-3.5"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1.2"/><circle cx="17.5" cy="10.5" r="1.2"/><circle cx="8.5" cy="7.5" r="1.2"/><circle cx="6.5" cy="12.5" r="1.2"/><path d="M12 2a10 10 0 0 0 0 20 2.5 2.5 0 0 0 2.5-2.5c0-.7-.3-1.3-.7-1.7a2.4 2.4 0 0 1 1.7-4.1H18a4 4 0 0 0 4-4c0-4.4-4.5-7.7-10-7.7z"/>',

    // ── 面板 ────────────────────────────────────
    text: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
    box: '<rect x="3" y="3" width="18" height="18" rx="4"/>',
    frame: '<rect x="3" y="3" width="14" height="14" rx="3"/><path d="M7 21h11a3 3 0 0 0 3-3V7"/>',
    tail: '<path d="M4 4h11a5 5 0 0 1 0 10H9l-5 5z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',

    // ── 操作 ────────────────────────────────────
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    star: '<polygon points="12 2 15.1 8.6 22 9.5 17 14.4 18.2 21.4 12 18.1 5.8 21.4 7 14.4 2 9.5 8.9 8.6"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    rotate: '<polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/>',
    flip: '<path d="M12 3v18"/><path d="M8 7 4 12l4 5z"/><path d="m16 7 4 5-4 5z"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    left: '<polyline points="15 18 9 12 15 6"/>',
    right: '<polyline points="9 18 15 12 9 6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
};

export function icon(name) {
    const body = ICONS[name];
    if (!body) return '';
    return `<svg ${STROKE}>${body}</svg>`;
}

export const ICON_NAMES = Object.freeze(Object.keys(ICONS));

/** 桌面图标 —— 渐变蓝色气泡碗,带高光层 */
export const APP_ICON = '<svg viewBox="0 0 50 50" style="width:115%;height:115%;"><defs><linearGradient id="bubbleBlue" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#93C5FD"/><stop offset="50%" stop-color="#60A5FA"/><stop offset="100%" stop-color="#3B82F6"/></linearGradient></defs><rect width="50" height="50" rx="15" fill="url(#bubbleBlue)"/><path d="M25 11 C33.27 11 40 16.36 40 22.95 C40 25.58 38.96 27.96 36.78 30.30 C35.21 32.08 32.66 34.04 30.31 35.66 C27.96 37.26 25.80 38.52 25 38.85 C24.68 38.98 24.44 39.04 24.25 39.04 C23.59 39.04 23.65 38.34 23.70 38.05 C23.74 37.83 23.92 36.79 23.92 36.79 C23.97 36.42 24.02 35.83 23.87 35.46 C23.70 35.05 23.03 34.84 22.54 34.74 C15.34 33.80 10 28.85 10 22.95 C10 16.36 16.73 11 25 11 z" fill="white"/></svg>';
