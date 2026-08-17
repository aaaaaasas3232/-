/**
 * 情景聊天 · 图标集
 *
 * Feather 风格线性图标,`stroke="currentColor"`,**不带 width/height**。
 * 尺寸交给 CSS(`_base.css` 里有一条两层 `:where()` 的零特异性兜底)。
 *
 * ★ 全 App 禁用 emoji,所有符号都是 SVG。
 */

const STROKE = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
    // ── 抽屉分页 ────────────────────────────────
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1.2"/><circle cx="17.5" cy="10.5" r="1.2"/><circle cx="8.5" cy="7.5" r="1.2"/><circle cx="6.5" cy="12.5" r="1.2"/><path d="M12 2a10 10 0 0 0 0 20 2.5 2.5 0 0 0 2.5-2.5c0-.7-.3-1.3-.7-1.7a2.4 2.4 0 0 1 1.7-4.1H18a4 4 0 0 0 4-4c0-4.4-4.5-7.7-10-7.7z"/>',
    regex: '<path d="M12 3v8"/><path d="m8.5 5 7 4"/><path d="m15.5 5-7 4"/><rect x="3" y="14" width="6" height="6" rx="2"/><rect x="15" y="14" width="6" height="6" rx="2"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16.5 19.8 18.7 22 19.5 19.8 20.3 19 22.5 18.2 20.3 16 19.5 18.2 18.7z"/>',
    clip: '<path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.19a1.83 1.83 0 0 1-2.59-2.59l8.49-8.48"/>',

    // ── 舞台 ────────────────────────────────────
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
    theater: '<path d="M3 5h18"/><path d="M4 5v9a5 5 0 0 0 5 5h6a5 5 0 0 0 5-5V5"/><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M9.5 15.5a3.5 3.5 0 0 0 5 0"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',

    // ── 操作 ────────────────────────────────────
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
    reroll: '<path d="M21 12a9 9 0 1 1-3.2-6.9"/><polyline points="21 3 21 9 15 9"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    bubble: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.5-.7L3 21l1.8-5.2A8.3 8.3 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>',
    left: '<polyline points="15 18 9 12 15 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    star: '<polygon points="12 2 15.1 8.6 22 9.5 17 14.4 18.2 21.4 12 18.1 5.8 21.4 7 14.4 2 9.5 8.9 8.6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    text: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
    up: '<polyline points="18 15 12 9 6 15"/>',
    down: '<polyline points="6 9 12 15 18 9"/>',
};

export function icon(name) {
    const body = ICONS[name];
    if (!body) return '';
    return `<svg ${STROKE}>${body}</svg>`;
}

export const ICON_NAMES = Object.freeze(Object.keys(ICONS));

/** 桌面图标 —— 青绿到蓝的渐变 + 白色聊天消息气泡 + 右下角时钟 */
export const APP_ICON = `<svg viewBox="0 0 120 120" style="width:115%;height:115%;"><defs><linearGradient id="chime-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#A8E6CF"/><stop offset="100%" style="stop-color:#56CCF2"/></linearGradient></defs><rect width="120" height="120" rx="26" fill="url(#chime-grad)"/><rect x="25" y="35" width="70" height="50" rx="8" fill="white" opacity="0.95"/><line x1="35" y1="50" x2="65" y2="50" stroke="#56CCF2" stroke-width="4" stroke-linecap="round"/><line x1="35" y1="62" x2="85" y2="62" stroke="#A8E6CF" stroke-width="4" stroke-linecap="round"/><line x1="35" y1="74" x2="75" y2="74" stroke="#56CCF2" stroke-width="4" stroke-linecap="round"/><circle cx="85" cy="75" r="12" fill="#FFD93D" opacity="0.9"/><path d="M 85 70 L 85 77 L 88 74" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
