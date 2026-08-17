/**
 * 候鸟 · 图标
 *
 * 全部内联 SVG（stroke 线条风），禁 emoji。
 * ★ 每个都带 width/height —— 不带的话浏览器按 300×150 画，整张卡会被撑爆。
 */

const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

const PATHS = {
    /** 纸飞机（App 主标） */
    plane: '<path d="M21 3.5 3.6 10.2c-.8.3-.75 1.4.06 1.7l6.1 2.1 2.1 6.1c.3.8 1.4.85 1.7.06L21 3.5Z"/><path d="M21 3.5 9.8 14"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 5-4.8 2 2.2-5 4.8-2Z"/>',
    ticket: '<path d="M4 8.5V6.8C4 6 4.6 5.4 5.4 5.4h13.2c.8 0 1.4.6 1.4 1.4v1.7a2.5 2.5 0 0 0 0 5v1.7c0 .8-.6 1.4-1.4 1.4H5.4c-.8 0-1.4-.6-1.4-1.4v-1.7a2.5 2.5 0 0 0 0-5Z"/><path d="M14.5 5.8v12" stroke-dasharray="2.4 2.4"/>',
    footprints: '<path d="M7.2 4.5c1.5 0 2.5 1.4 2.5 3.2 0 1.3-.5 2.2-1.2 3.1-.4.5-.6 1-.6 1.7H5.6c-.5-1-.9-2-.9-3.6 0-2.5 1-4.4 2.5-4.4Z"/><path d="M5.8 14.6h2.3v1.2c0 .8-.5 1.5-1.2 1.5s-1.1-.7-1.1-1.5v-1.2Z"/><path d="M16.8 8.2c-1.5 0-2.5 1.4-2.5 3.2 0 1.3.5 2.2 1.2 3.1.4.5.6 1 .6 1.7h2.3c.5-1 .9-2 .9-3.6 0-2.5-1-4.4-2.5-4.4Z"/><path d="M18.2 18.3h-2.3v1.2c0 .8.5 1.5 1.2 1.5s1.1-.7 1.1-1.5v-1.2Z"/>',
    users: '<circle cx="9" cy="8.2" r="3.2"/><path d="M3.6 19.5c.6-3 2.8-4.7 5.4-4.7s4.8 1.7 5.4 4.7"/><circle cx="16.8" cy="9.4" r="2.5"/><path d="M16.2 14.9c2.3.1 3.9 1.6 4.4 4"/>',
    user: '<circle cx="12" cy="8.4" r="3.4"/><path d="M5.4 19.8c.8-3.4 3.4-5.3 6.6-5.3s5.8 1.9 6.6 5.3"/>',
    gear: '<circle cx="12" cy="12" r="3.1"/><path d="M12 3.4v2.2M12 18.4v2.2M3.4 12h2.2M18.4 12h2.2M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6"/>',
    palette: '<path d="M12 3.6a8.4 8.4 0 1 0 0 16.8c1.2 0 1.8-.7 1.8-1.5 0-.7-.4-1-.4-1.7 0-.9.7-1.5 1.7-1.5h1.7c2 0 3.6-1.5 3.6-3.5C20.4 7 16.6 3.6 12 3.6Z"/><circle cx="8" cy="10" r="1.1"/><circle cx="12" cy="7.6" r="1.1"/><circle cx="16" cy="10" r="1.1"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>',
    refresh: '<path d="M4.6 10a7.6 7.6 0 0 1 12.9-3.3l2 2"/><path d="M19.5 4.6v4.1h-4.1"/><path d="M19.4 14a7.6 7.6 0 0 1-12.9 3.3l-2-2"/><path d="M4.5 19.4v-4.1h4.1"/>',
    heart: '<path d="M12 19.8S4.4 15.2 4.4 9.9C4.4 7.2 6.4 5.4 8.7 5.4c1.4 0 2.6.7 3.3 1.8.7-1.1 1.9-1.8 3.3-1.8 2.3 0 4.3 1.8 4.3 4.5 0 5.3-7.6 9.9-7.6 9.9Z"/>',
    heartFill: '<path fill="currentColor" stroke="none" d="M12 19.8S4.4 15.2 4.4 9.9C4.4 7.2 6.4 5.4 8.7 5.4c1.4 0 2.6.7 3.3 1.8.7-1.1 1.9-1.8 3.3-1.8 2.3 0 4.3 1.8 4.3 4.5 0 5.3-7.6 9.9-7.6 9.9Z"/>',
    back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    chevronRight: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
    chevronDown: '<path d="m5.5 9.5 6.5 6.5 6.5-6.5"/>',
    chevronUp: '<path d="m5.5 14.5 6.5-6.5 6.5 6.5"/>',
    send: '<path d="M19.8 4.2 4.9 10.1c-.8.3-.75 1.4.05 1.7l5.4 1.8 1.8 5.4c.3.8 1.4.85 1.7.05L19.8 4.2Z"/>',
    trash: '<path d="M5 6.8h14M9.5 6.8V5.2c0-.6.5-1 1-1h3c.5 0 1 .4 1 1v1.6M7 6.8l.7 11.5c0 .9.8 1.5 1.6 1.5h5.4c.8 0 1.6-.6 1.6-1.5L17 6.8"/><path d="M10.2 10.5v4.8M13.8 10.5v4.8"/>',
    edit: '<path d="M14.8 5.2 18.8 9.2 9 19l-4.6.6L5 15l9.8-9.8Z"/><path d="m13.2 6.8 4 4"/>',
    reroll: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="8.8" cy="8.8" r="1" fill="currentColor" stroke="none"/><circle cx="15.2" cy="15.2" r="1" fill="currentColor" stroke="none"/><circle cx="15.2" cy="8.8" r="1" fill="currentColor" stroke="none"/><circle cx="8.8" cy="15.2" r="1" fill="currentColor" stroke="none"/>',
    image: '<rect x="4" y="5" width="16" height="14" rx="2.4"/><circle cx="9" cy="10" r="1.5"/><path d="m5 17 4.6-4.6c.5-.5 1.3-.5 1.8 0L16 17M14.4 15l1.6-1.6c.5-.5 1.3-.5 1.8 0l2 2"/>',
    check: '<path d="m5 12.6 4.4 4.4L19 7.4"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 10.8v5"/><circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none"/>',
    luggage: '<rect x="6" y="7.5" width="12" height="12" rx="2.4"/><path d="M9.5 7.5V5.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7M9.5 11v5M14.5 11v5"/>',
    calendar: '<rect x="4.5" y="5.5" width="15" height="14" rx="2.4"/><path d="M4.5 10h15M8.6 3.8v3M15.4 3.8v3"/>',
    mapPin: '<path d="M12 20.6s-6.4-5.5-6.4-10.2A6.3 6.3 0 0 1 12 4.2a6.3 6.3 0 0 1 6.4 6.2c0 4.7-6.4 10.2-6.4 10.2Z"/><circle cx="12" cy="10.3" r="2.3"/>',
    pinPlus: '<path d="M11 20.4s-6-5.3-6-9.9A5.9 5.9 0 0 1 11 4.7a5.9 5.9 0 0 1 6 5.8c0 .5-.1 1-.2 1.6"/><circle cx="11" cy="10.4" r="2.1"/><path d="M17.5 15v5M15 17.5h5"/>',
    note: '<path d="M6 4.8h12c.7 0 1.2.5 1.2 1.2v9.4L15 19.6H6c-.7 0-1.2-.5-1.2-1.2V6c0-.7.5-1.2 1.2-1.2Z"/><path d="M14.8 19.6v-4.4h4.4M8.5 9.5h7M8.5 12.7h4.5"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M5.5 14.5c-.6 0-1-.5-1-1v-8c0-.6.4-1 1-1h8c.5 0 1 .4 1 1"/>',
    eye: '<path d="M3.6 12S6.6 6.6 12 6.6 20.4 12 20.4 12 17.4 17.4 12 17.4 3.6 12 3.6 12Z"/><circle cx="12" cy="12" r="2.4"/>',
    quote: '<path d="M9.6 7.2c-2.4.9-3.9 2.7-3.9 5.2v4.4h4.7v-4.7H7.9c0-1.6.9-2.8 2.4-3.4l-.7-1.5ZM18 7.2c-2.4.9-3.9 2.7-3.9 5.2v4.4h4.7v-4.7h-2.5c0-1.6.9-2.8 2.4-3.4L18 7.2Z"/>',
    globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.3 2.3 3.4 5.2 3.4 8.6s-1.1 6.3-3.4 8.6c-2.3-2.3-3.4-5.2-3.4-8.6s1.1-6.3 3.4-8.6Z"/>',
    wallet: '<path d="M4.5 7.6c0-1.1.9-2 2-2h10.4c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2H6.5c-1.1 0-2-.9-2-2v-9Z"/><path d="M14.6 11h4.3v3h-4.3c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5Z"/>',
    sunrise: '<path d="M12 4.6v3M5 8.6l1.8 1.8M19 8.6l-1.8 1.8M7.6 15.6a4.4 4.4 0 0 1 8.8 0"/><path d="M4 15.6h16M8 19h8"/>',
    sun: '<circle cx="12" cy="12" r="3.6"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"/>',
    moon: '<path d="M19.2 14.3A7.6 7.6 0 0 1 9.7 4.8a7.6 7.6 0 1 0 9.5 9.5Z"/>',
    flag: '<path d="M6 20.5v-16M6 5.2c3.4-1.9 6.6 1.7 10 0v7.4c-3.4 1.9-6.6-1.7-10 0"/>',
    hourglass: '<path d="M7 4.5h10M7 19.5h10M8.2 4.5v3.2c0 2.4 3.8 3 3.8 4.3 0-1.3 3.8-1.9 3.8-4.3V4.5M8.2 19.5v-3.2c0-2.4 3.8-3 3.8-4.3 0 1.3 3.8 1.9 3.8 4.3v3.2"/>',
    more: '<circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
    sparkle: '<path d="M12 4.4 13.7 10 19.3 12 13.7 14 12 19.6 10.3 14 4.7 12 10.3 10 12 4.4Z"/>',
    save: '<path d="M6 4.8h9.6L19.2 8.4V18c0 .7-.5 1.2-1.2 1.2H6c-.7 0-1.2-.5-1.2-1.2V6c0-.7.5-1.2 1.2-1.2Z"/><path d="M8.4 4.8v4h6.4v-4M8 19.2v-5.6h8v5.6"/>',
};

/** 取一个图标。size 是 px。 */
export function icon(name, opts = {}) {
    const body = PATHS[name] || PATHS.info;
    const size = Number(opts.size) || 18;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" ${STROKE} aria-hidden="true">${body}</svg>`;
}

/**
 * 桌面 App 图标。
 * 桌面图标画在 app-shell 之外，CSS 变量够不着，所以这里的颜色不算硬编码
 * （和其他 App 的 iconBg 同一豁免口径）。禁渐变：底色是纯色，图形是单色线条。
 */
export const APP_ICON = `<svg viewBox="0 0 48 48" width="30" height="30" fill="none" aria-hidden="true">
    <path d="M40 10 9.5 21.6c-1.5.6-1.4 2.7.1 3.2l10.6 3.6 3.6 10.6c.5 1.5 2.6 1.6 3.2.1L40 10Z" stroke="#3A6B96" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M40 10 20.5 28.2" stroke="#3A6B96" stroke-width="2.6" stroke-linecap="round"/>
</svg>`;
