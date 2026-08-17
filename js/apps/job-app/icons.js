/**
 * 灯塔 · 图标
 *
 * 全部 24×24 线性图标，`stroke="currentColor"`，靠父级的 color 上色。
 *
 * ★ 每个都带 width/height。不带的话浏览器按规范默认画成 300×150，整张卡会被撑爆。
 *   CSS 那边还有一条 :where() 兜底，但兜底是兜底，不该指望它。
 *
 * ★ 全项目禁 emoji。emoji 的字形由系统字体决定，不同设备大小和描边粗细都不一样。
 */

const wrap = (inner, opts = {}) => {
    const { size = 24, fill = 'none', stroke = 'currentColor', width = 1.6 } = opts;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
};

/** 主体标识：灯塔 */
export const BEACON_PATH = `<path d="M10 9h4"/><path d="M9.6 9 8 21h8L14.4 9"/><path d="M10.2 4.6a1.8 1.8 0 0 1 3.6 0V9h-3.6z"/><path d="M12 2.8V1.5"/><path d="m6.4 6.2-2 -1.1"/><path d="m17.6 6.2 2-1.1"/><path d="M7.6 15h8.8"/>`;

const PATHS = {
    beacon: BEACON_PATH,

    // 导航
    compass: `<circle cx="12" cy="12" r="8.8"/><path d="m15.2 8.8-1.8 4.6-4.6 1.8 1.8-4.6z"/>`,
    chat: `<path d="M20.5 11.6a7.4 7.4 0 0 1-8 7.4 8.6 8.6 0 0 1-2.6-.4L5 20.5l1.3-4a7.2 7.2 0 0 1-.8-3.3 7.4 7.4 0 0 1 7.5-7.2 7.4 7.4 0 0 1 7.5 5.6z"/>`,
    briefcase: `<rect x="3" y="7.5" width="18" height="12.5" rx="2.2"/><path d="M8.5 7.5V5.8A1.8 1.8 0 0 1 10.3 4h3.4a1.8 1.8 0 0 1 1.8 1.8v1.7"/><path d="M3 12.5h18"/><path d="M10.5 12.5v1.8h3v-1.8"/>`,
    user: `<path d="M20 21v-1.8a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4V21"/><circle cx="12" cy="7.5" r="3.8"/>`,

    // 操作
    back: `<path d="M15 18.5 8.5 12 15 5.5"/>`,
    close: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
    plus: `<path d="M12 5.5v13"/><path d="M5.5 12h13"/>`,
    minus: `<path d="M5.5 12h13"/>`,
    check: `<path d="M4.5 12.5 9.5 17.5 19.5 7"/>`,
    search: `<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.2-4.2"/>`,
    refresh: `<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 4.5V10h-5.5"/>`,
    edit: `<path d="M4 20h4.5L19 9.5a2.12 2.12 0 0 0-3-3L5.5 17z"/><path d="M14.5 6.5 17.5 9.5"/>`,
    trash: `<path d="M4 6.5h16"/><path d="M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7"/><path d="M6.5 6.5 7.4 20a1.3 1.3 0 0 0 1.3 1.2h6.6a1.3 1.3 0 0 0 1.3-1.2l.9-13.5"/>`,
    dice: `<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>`,
    send: `<path d="M21 3 10.5 13.5"/><path d="M21 3 14.4 21l-3.9-7.5L3 9.6z"/>`,
    copy: `<rect x="8.5" y="8.5" width="12" height="12" rx="2.2"/><path d="M15.5 5.5v-.8A1.2 1.2 0 0 0 14.3 3.5H4.7a1.2 1.2 0 0 0-1.2 1.2v9.6a1.2 1.2 0 0 0 1.2 1.2h.8"/>`,
    undo: `<path d="M3.5 8.5h11a5.5 5.5 0 0 1 0 11H9"/><path d="M7 4 3.5 8.5 7 13"/>`,

    // 语义
    star: `<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9L3.5 9.7l5.9-.8z"/>`,
    bookmark: `<path d="M6 4.5h12a1 1 0 0 1 1 1v15l-7-4-7 4v-15a1 1 0 0 1 1-1z"/>`,
    calendar: `<rect x="3.5" y="5.5" width="17" height="15" rx="2.2"/><path d="M3.5 10h17"/><path d="M8 3.5v4"/><path d="M16 3.5v4"/>`,
    coin: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9"/><path d="M14.8 9.6a3 3 0 0 0-2.8-1.4c-1.7 0-2.8.9-2.8 2.1 0 2.9 5.6 1.5 5.6 4.2 0 1.2-1.1 2.1-2.8 2.1a3 3 0 0 1-2.8-1.4"/>`,
    wallet: `<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z"/><path d="M16 12.5h4.5"/><circle cx="16.4" cy="12.5" r="0.9" fill="currentColor" stroke="none"/>`,
    theater: `<path d="M4 5.5h16"/><path d="M5.5 5.5v9a6.5 6.5 0 0 0 13 0v-9"/><path d="M9.5 10.5h.01"/><path d="M14.5 10.5h.01"/><path d="M9.5 15a3.5 3.5 0 0 0 5 0"/>`,
    scroll: `<path d="M6 3.5h11a2 2 0 0 1 2 2V18a2.5 2.5 0 0 0 2.5 2.5H7.5"/><path d="M6 3.5A2.5 2.5 0 0 0 3.5 6v1.5H6"/><path d="M7.5 20.5A2.5 2.5 0 0 1 5 18V7.5"/><path d="M9 8.5h6"/><path d="M9 12h6"/>`,
    sparkle: `<path d="M12 3.5 13.6 9 19 10.5 13.6 12 12 17.5 10.4 12 5 10.5 10.4 9z"/><path d="M18.5 16.5 19.2 18.8 21.5 19.5 19.2 20.2 18.5 22.5 17.8 20.2 15.5 19.5 17.8 18.8z"/>`,
    pin: `<path d="M12 21s6.5-6 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 15 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.4"/>`,
    palette: `<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2a1.7 1.7 0 0 1 1.2-2.9h1.6a4.4 4.4 0 0 0 4.4-4.4C20.5 6.4 16.7 3.5 12 3.5z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="7.5" r="1.1" fill="currentColor" stroke="none"/>`,
    settings: `<circle cx="12" cy="12" r="3"/><path d="M19.1 14.2a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V20a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H10a1.6 1.6 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V10a1.6 1.6 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>`,
    chevron: `<path d="m9 5.5 6.5 6.5L9 18.5"/>`,
    chevronDown: `<path d="m5.5 9 6.5 6.5L18.5 9"/>`,
    chevronUp: `<path d="m5.5 15 6.5-6.5L18.5 15"/>`,
    layers: `<path d="m12 3.5 8.5 4.3-8.5 4.3-8.5-4.3z"/><path d="m3.5 12.2 8.5 4.3 8.5-4.3"/><path d="m3.5 16.4 8.5 4.3 8.5-4.3"/>`,
    globe: `<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5a13 13 0 0 1 0 17 13 13 0 0 1 0-17z"/>`,
    sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2"/><path d="M12 19.3v2.2"/><path d="m4.9 4.9 1.6 1.6"/><path d="m17.5 17.5 1.6 1.6"/><path d="M2.5 12h2.2"/><path d="M19.3 12h2.2"/><path d="m4.9 19.1 1.6-1.6"/><path d="m17.5 6.5 1.6-1.6"/>`,
    moon: `<path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8z"/>`,
    building: `<path d="M4.5 20.5V5.2a1.7 1.7 0 0 1 1.7-1.7h7.6a1.7 1.7 0 0 1 1.7 1.7v15.3"/><path d="M15.5 10h2.8a1.7 1.7 0 0 1 1.7 1.7v8.8"/><path d="M3 20.5h18"/><path d="M8 7.5h3.5"/><path d="M8 11.5h3.5"/><path d="M8 15.5h3.5"/>`,
    badge: `<circle cx="12" cy="9.5" r="5.5"/><path d="m8.4 14 -1.4 7 5-2.6 5 2.6-1.4-7"/>`,
    handshake: `<path d="m11 17.5 1.6 1.5a1.7 1.7 0 0 0 2.4-2.4"/><path d="m15 16.6 2 1.9a1.7 1.7 0 0 0 2.4-2.4l-5.6-5.6"/><path d="M2.5 10.5 6 7h4l3 3"/><path d="M13.8 10.1 12 12a1.9 1.9 0 0 1-2.7-2.7L11 7.6"/><path d="M14 7h4l3.5 3.5"/><path d="m8.6 14.2-1.4 1.4a1.7 1.7 0 0 0 2.4 2.4l1.4-1.4"/>`,
    ban: `<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>`,
    flame: `<path d="M12 21.5c3.6 0 6-2.4 6-5.6 0-3.6-2.6-5-4-7.9-.6 2.3-2 3-3 3.9-1.2-.9-1.4-2.3-1.4-3.4C7.6 10 6 12 6 15.9c0 3.2 2.4 5.6 6 5.6z"/><path d="M12 21.5c1.6 0 2.6-1.1 2.6-2.5 0-1.7-1.4-2.4-2.6-4-1.2 1.6-2.6 2.3-2.6 4 0 1.4 1 2.5 2.6 2.5z"/>`,
    clock: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.2 1.9"/>`,
    doc: `<path d="M13.5 3.5H7a1.8 1.8 0 0 0-1.8 1.8v13.4A1.8 1.8 0 0 0 7 20.5h10a1.8 1.8 0 0 0 1.8-1.8V8.8z"/><path d="M13.5 3.5v5.3h5.3"/><path d="M8.6 13h6.8"/><path d="M8.6 16.4h4.6"/>`,
    users: `<path d="M16.5 20v-1.6a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.4V20"/><circle cx="9.8" cy="7.6" r="3.4"/><path d="M21 20v-1.6a3.6 3.6 0 0 0-2.7-3.5"/><path d="M15.6 4.4a3.6 3.6 0 0 1 0 6.5"/>`,
    exit: `<path d="M9.5 20.5H6a1.8 1.8 0 0 1-1.8-1.8V5.3A1.8 1.8 0 0 1 6 3.5h3.5"/><path d="M15.5 16.5 20 12l-4.5-4.5"/><path d="M20 12H9"/>`,
};

/**
 * @param {string} name  PATHS 里的一个 key
 * @param {{size?:number, width?:number, fill?:string}} [opts]
 */
export function icon(name, opts = {}) {
    const inner = PATHS[name] || PATHS.beacon;
    return wrap(inner, opts);
}

export const ICON_NAMES = Object.freeze(Object.keys(PATHS));

/** 桌面图标 —— 紫色渐变背景 + 右下角倾斜公文包 */
export const APP_ICON = `<svg viewBox="0 0 60 60" style="width:135%;height:135%;"><defs><linearGradient id="jobPurple" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#C4B5FD"/><stop offset="50%" stop-color="#8B5CF6"/><stop offset="100%" stop-color="#7B5CFA"/></linearGradient></defs><rect width="60" height="60" rx="15" fill="url(#jobPurple)"/><g transform="translate(-2,-4) rotate(-15, 48, 46) scale(1.5)"><rect x="12" y="20" width="36" height="26" rx="5" fill="#FFF"/><path d="M21 20 L21 15 Q21 11 25 11 L35 11 Q39 11 39 15 L39 20" fill="none" stroke="#FFF" stroke-width="4" stroke-linecap="round"/></g></svg>`;
