/**
 * 手书 · 图标集
 *
 * Feather 风格线性图标,`stroke="currentColor"`,**不带 width/height**,
 * 尺寸交给 CSS(`index.css` 里有一条兜底,接住任何忘了配尺寸的图标 ——
 * 否则浏览器按规范画成 300×150,能把整张卡片撑爆)。
 *
 * ★ 全 App 禁用 emoji。要一个新符号就在这里加一条 path,不要往模板里贴字符。
 *
 * 用法:
 *   <HsIcon name="play" />   组件
 *   icon('play')             拿字符串
 */

const STROKE_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const FILL_ATTRS = 'viewBox="0 0 24 24" fill="currentColor"';

const ICONS = {
    // ── 导航 ────────────────────────────────────
    grid: '<rect x="3" y="4" width="8" height="7" rx="1.6"/><rect x="13" y="4" width="8" height="7" rx="1.6"/><rect x="3" y="13" width="8" height="7" rx="1.6"/><rect x="13" y="13" width="8" height="7" rx="1.6"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>',
    chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    chevronUp: '<polyline points="18 15 12 9 6 15"/>',
    more: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2"/>',

    // ── 基础操作 ────────────────────────────────
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    question: '<circle cx="12" cy="12" r="10"/><path d="M9.2 9.2a2.8 2.8 0 0 1 5.5.7c0 1.9-2.8 2.4-2.8 4.1"/><line x1="12" y1="17.5" x2="12.01" y2="17.5"/>',
    warn: '<path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',

    // ── 播放 ────────────────────────────────────
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    skipBack: '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>',
    skipForward: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
    replay: '<polyline points="1 4 1 10 7 10"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/>',

    // ── 编辑器 ──────────────────────────────────
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.1" y2="15.9"/><line x1="14.5" y1="14.5" x2="20" y2="20"/><line x1="8.1" y1="8.1" x2="12" y2="12"/>',
    undo: '<polyline points="9 14 4 9 9 4"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo: '<polyline points="15 14 20 9 15 4"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2"/><line x1="8" y1="11" x2="14" y2="11"/>',
    magnet: '<path d="M6 4H3v7a9 9 0 0 0 18 0V4h-3v7a6 6 0 0 1-12 0z"/><line x1="3" y1="9" x2="6" y2="9"/><line x1="18" y1="9" x2="21" y2="9"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    text: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    wand: '<path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/>',
    sparkle: '<path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="M19 15l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1.2"/><circle cx="17.5" cy="10.5" r="1.2"/><circle cx="8.5" cy="7.5" r="1.2"/><circle cx="6.5" cy="12.5" r="1.2"/><path d="M12 2a10 10 0 0 0 0 20 2.5 2.5 0 0 0 2.5-2.5c0-.7-.3-1.3-.7-1.7a2.4 2.4 0 0 1 1.7-4.1H18a4 4 0 0 0 4-4c0-4.4-4.5-7.7-10-7.7z"/>',
    film: '<rect x="2" y="4" width="20" height="16" rx="2.4"/><line x1="7" y1="4" x2="7" y2="20"/><line x1="17" y1="4" x2="17" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="8" x2="7" y2="8"/><line x1="2" y1="16" x2="7" y2="16"/><line x1="17" y1="8" x2="22" y2="8"/><line x1="17" y1="16" x2="22" y2="16"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
};

/** 需要实心的少数几个 */
const FILLED = {
    playSolid: '<polygon points="7 4 20 12 7 20 7 4"/>',
    dot: '<circle cx="12" cy="12" r="5"/>',
};

const _warned = new Set();

/** 桌面图标:一块「打字中的纸」,纯路径,不引任何外部资源 */
export const APP_ICON = `<svg viewBox="0 0 60 60" width="56" height="56" xmlns="http://www.w3.org/2000/svg" style="display:block;">
    <defs>
        <linearGradient id="hsDeskGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2B2F45"/>
            <stop offset="55%" stop-color="#3E4668"/>
            <stop offset="100%" stop-color="#C98A9B"/>
        </linearGradient>
    </defs>
    <rect width="60" height="60" rx="15" fill="url(#hsDeskGrad)"/>
    <rect x="11" y="14" width="38" height="24" rx="3.5" fill="#F6F1EA" opacity="0.94"/>
    <rect x="17" y="21" width="17" height="3.2" rx="1.6" fill="#3E4668" opacity="0.75"/>
    <rect x="17" y="28" width="10" height="3.2" rx="1.6" fill="#3E4668" opacity="0.45"/>
    <rect x="29.5" y="27" width="3" height="5.6" rx="1.2" fill="#C98A9B"/>
    <rect x="13" y="44" width="34" height="3" rx="1.5" fill="#F6F1EA" opacity="0.5"/>
    <circle cx="19" cy="45.5" r="4" fill="#C98A9B"/>
</svg>`;

/** 灵动岛左侧圆标 —— 必须是以 `<svg` 开头的字符串,不能是函数或 canvas */
export const ISLAND_ICON = `<svg ${STROKE_ATTRS} width="20" height="20" xmlns="http://www.w3.org/2000/svg">${ICONS.text}</svg>`;

export function icon(key, { size = 0 } = {}) {
    const dim = size ? ` width="${Number(size)}" height="${Number(size)}"` : '';
    if (FILLED[key]) return `<svg ${FILL_ATTRS}${dim}>${FILLED[key]}</svg>`;
    const body = ICONS[key];
    if (!body) {
        if (!_warned.has(key)) {
            _warned.add(key);
            console.warn(`[handwrite/icons] 没有名为 "${key}" 的图标,已回落到 info`);
        }
        return `<svg ${STROKE_ATTRS}${dim}>${ICONS.info}</svg>`;
    }
    return `<svg ${STROKE_ATTRS}${dim}>${body}</svg>`;
}

export default icon;
