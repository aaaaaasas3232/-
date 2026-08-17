/**
 * 小奇怪 · 图标集
 *
 * ★ 全站零 emoji(用户明确要求)。所有图形都是内联 SVG,
 *   `stroke="currentColor"`、**不带 width/height** —— 尺寸交给 CSS。
 *   忘了配尺寸时浏览器会按规范画成 300×150 把卡片撑爆,`index.css` 里
 *   有一条零特异性兜底接住这种情况。
 *
 * ★ 灵动岛的左圆标只接受以 `<svg` 开头的字符串(AGENTS.md §3.1),
 *   所以 `islandIcon()` 单独给一份自带尺寸的实心版本。
 *
 * 用法:
 *   <OqIcon name="dice" />     组件
 *   icon('dice')               拿字符串
 */

const STROKE_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
const FILL_ATTRS = 'viewBox="0 0 24 24" fill="currentColor"';

const ICONS = {
    // ── 通用 ────────────────────────────────────
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    star: '<polygon points="12 2.6 14.9 8.5 21.4 9.4 16.7 14 17.8 20.5 12 17.4 6.2 20.5 7.3 14 2.6 9.4 9.1 8.5"/>',
    starFilled: null,
    chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    warning: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    island: '<rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="7.5" cy="12" r="1.6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1.2"/><circle cx="17.5" cy="10.5" r="1.2"/><circle cx="8.5" cy="7.5" r="1.2"/><circle cx="6.5" cy="12.5" r="1.2"/><path d="M12 2a10 10 0 0 0 0 20 2.5 2.5 0 0 0 2.5-2.5c0-.7-.3-1.3-.7-1.7a2.4 2.4 0 0 1 1.7-4.1H18a4 4 0 0 0 4-4c0-4.4-4.5-7.7-10-7.7z"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    send: '<line x1="21" y1="3" x2="10.5" y2="13.5"/><polygon points="21 3 14.5 21 10.5 13.5 3 9.5"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.8 1.1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    scroll: '<path d="M5 4h11a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 0-2-2z"/><line x1="9" y1="8" x2="14" y2="8"/><line x1="9" y1="12" x2="14" y2="12"/>',
    drop: '<path d="M12 2.6s6 6.7 6 11a6 6 0 0 1-12 0c0-4.3 6-11 6-11z"/>',
    pen: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9"/>',
    hand: '<path d="M18 11V6.5a1.5 1.5 0 0 0-3 0V11"/><path d="M15 10.5V4.5a1.5 1.5 0 0 0-3 0V11"/><path d="M12 10.5V5.5a1.5 1.5 0 0 0-3 0V13"/><path d="M9 12.5V9a1.5 1.5 0 0 0-3 0v6.5a6.5 6.5 0 0 0 12 0V11"/>',
    // ── 游戏相关 ────────────────────────────────
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/>',
    trophy: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v6a5 5 0 0 1-10 0z"/><path d="M7 6H4a2 2 0 0 0 2 4h1"/><path d="M17 6h3a2 2 0 0 1-2 4h-1"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
    board: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>',
};

/** 实心版本 —— 需要在小尺寸下有分量的地方用 */
const FILLED = {
    dot: '<circle cx="12" cy="12" r="5"/>',
    starFilled: '<polygon points="12 2.6 14.9 8.5 21.4 9.4 16.7 14 17.8 20.5 12 17.4 6.2 20.5 7.3 14 2.6 9.4 9.1 8.5"/>',
    heartFilled: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.8 1.1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
};

const _warned = new Set();

/**
 * 取图标 SVG 字符串。
 *
 * 名字不存在时回落到 `info` 并**警告一次**。图标名写错是纯视觉 bug ——
 * 不报错、不塌布局,只是那个位置变成别的图标,只能靠肉眼在截图里发现。
 * 回落 + 警告把它变成一条能搜到的信号。
 */
export function icon(name) {
    const key = String(name || '');
    if (FILLED[key]) return `<svg ${FILL_ATTRS}>${FILLED[key]}</svg>`;
    const body = ICONS[key];
    if (!body) {
        if (!_warned.has(key)) {
            _warned.add(key);
            console.warn(`[oddity/icons] 没有名为 "${key}" 的图标,已回落到 info`);
        }
        return `<svg ${STROKE_ATTRS}>${ICONS.info}</svg>`;
    }
    return `<svg ${STROKE_ATTRS}>${body}</svg>`;
}

/**
 * 灵动岛左侧圆标专用。
 *
 * ★ 必须自带 width/height 并以 `<svg` 开头 —— 岛那边只做字符串前缀判断,
 *   传函数 / 传 canvas ctx / 用 `{{ icon }}` 插值都会在圆里画出源码
 *   (AGENTS.md §10 那张表里的「岛左边圆里是 ctx / 源码」)。
 */
export function islandIcon(name = 'dot') {
    const key = String(name);
    const body = FILLED[key] || ICONS[key] || FILLED.dot;
    const filled = Boolean(FILLED[key]);
    const attrs = filled
        ? 'viewBox="0 0 24 24" width="18" height="18" fill="currentColor"'
        : 'viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
    return `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;
}

/** 桌面图标 —— 一个装小玩意儿的盒子,盖子掀开一角 */
export const ODDITY_APP_ICON = `<svg viewBox="0 0 60 60" width="56" height="56" xmlns="http://www.w3.org/2000/svg" style="display:block;">
    <defs>
        <linearGradient id="oqDeskGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#c9b8a8"/>
            <stop offset="52%" stop-color="#b8a9a0"/>
            <stop offset="100%" stop-color="#9aa8b5"/>
        </linearGradient>
    </defs>
    <rect width="60" height="60" rx="15" fill="url(#oqDeskGrad)"/>
    <rect x="13" y="26" width="34" height="21" rx="4" fill="#fdfbf8" opacity="0.95"/>
    <rect x="13" y="26" width="34" height="6" rx="3" fill="#a3b1a1" opacity="0.55"/>
    <path d="M15 24 L45 18 L46.6 23.4 L16.6 29.4 Z" fill="#fdfbf8" opacity="0.9"/>
    <circle cx="24" cy="39" r="3.4" fill="#b8a9a0"/>
    <rect x="32" y="35.6" width="7" height="7" rx="2" fill="#9aa8b5" transform="rotate(18 35.5 39.1)"/>
    <circle cx="41" cy="14" r="2.6" fill="#fdfbf8" opacity="0.85"/>
</svg>`;

export default icon;
