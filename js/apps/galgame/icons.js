/**
 * 湛蓝回忆 · 图标集
 *
 * Feather 风格线性图标,`stroke="currentColor"`,**不带 width/height**。
 * 尺寸交给 CSS(`_base.css` 里有一条两层 `:where()` 的零特异性兜底,
 * 接住任何忘了配尺寸的图标 —— 否则浏览器会按规范画成 300×150 把卡片撑爆)。
 *
 * 用法:
 *   <GgIcon name="tree" />        组件
 *   icon('tree')                  拿字符串
 */

const STROKE_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const FILL_ATTRS = 'viewBox="0 0 24 24" fill="currentColor"';

const ICONS = {
    // ── 主菜单 ──────────────────────────────────
    globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    gallery: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    memory: '<path d="M12 2a5 5 0 0 0-5 5v1a4 4 0 0 0-1 7.87V17a3 3 0 0 0 3 3 3 3 0 0 0 3-3"/><path d="M12 2a5 5 0 0 1 5 5v1a4 4 0 0 1 1 7.87V17a3 3 0 0 1-3 3 3 3 0 0 1-3-3"/><line x1="12" y1="2" x2="12" y2="22"/>',
    log: '<line x1="7" y1="7" x2="21" y2="7"/><line x1="7" y1="12" x2="21" y2="12"/><line x1="7" y1="17" x2="21" y2="17"/><circle cx="3.5" cy="7" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="17" r="1"/>',
    tree: '<circle cx="5" cy="6" r="2.4"/><circle cx="18" cy="3.6" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="18" cy="20.4" r="2"/><path d="M7.4 6h3a2 2 0 0 1 2 2v10.4a2 2 0 0 0 2 2H16"/><path d="M12.4 8V5.6a2 2 0 0 1 2-2H16"/><path d="M7.4 6.4H14a2 2 0 0 1 2 2V12"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1.2"/><circle cx="17.5" cy="10.5" r="1.2"/><circle cx="8.5" cy="7.5" r="1.2"/><circle cx="6.5" cy="12.5" r="1.2"/><path d="M12 2a10 10 0 0 0 0 20 2.5 2.5 0 0 0 2.5-2.5c0-.7-.3-1.3-.7-1.7a2.4 2.4 0 0 1 1.7-4.1H18a4 4 0 0 0 4-4c0-4.4-4.5-7.7-10-7.7z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',

    // ── 基础操作 ────────────────────────────────
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 8 12 3 17 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    script: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="15" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',

    // ── 方向 ────────────────────────────────────
    chevronRight: '<polyline points="9 18 15 12 9 6"/>',
    chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    chevronUp: '<polyline points="18 15 12 9 6 15"/>',
    back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',

    // ── 剧情 ────────────────────────────────────
    pen: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z"/><path d="M2 2l7.59 7.59"/><circle cx="11" cy="11" r="2"/>',
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    map: '<polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21"/><line x1="8" y1="3" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="21"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
    sparkle: '<path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="M19 15l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    compress: '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    warning: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>',
};

const FILLED = {
    dot: '<circle cx="12" cy="12" r="5"/>',
    triangleRight: '<polygon points="8 5 18 12 8 19"/>',
    /** 桌面图标：电影幕布 + 播放三角 */
    appIcon: null, // 由 icon() 函数特殊处理
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
    if (key === 'appIcon') {
        return `<svg viewBox="0 0 60 60" width="56" height="56" xmlns="http://www.w3.org/2000/svg" style="display:block;">
            <defs>
                <linearGradient id="ggDeskGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#5DADE2"/>
                    <stop offset="55%" stop-color="#85C1E9"/>
                    <stop offset="100%" stop-color="#F5B7B1"/>
                </linearGradient>
            </defs>
            <rect width="60" height="60" rx="15" fill="url(#ggDeskGrad)"/>
            <rect x="12" y="16" width="36" height="28" rx="4" fill="#FFF" opacity="0.95"/>
            <rect x="12" y="16" width="36" height="5" rx="2" fill="#A8D8F0" opacity="0.5"/>
            <polygon points="27,25 37,32 27,39" fill="#5DADE2" stroke="#5DADE2" stroke-width="3" stroke-linejoin="round"/>
        </svg>`;
    }
    if (FILLED[key]) return `<svg ${FILL_ATTRS}>${FILLED[key]}</svg>`;
    const body = ICONS[key];
    if (!body) {
        if (!_warned.has(key)) {
            _warned.add(key);
            console.warn(`[galgame/icons] 没有名为 "${key}" 的图标,已回落到 info`);
        }
        return `<svg ${STROKE_ATTRS}>${ICONS.info}</svg>`;
    }
    return `<svg ${STROKE_ATTRS}>${body}</svg>`;
}

export default icon;
