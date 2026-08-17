/**
 * 追光 · 图标
 *
 * 全部线性 SVG，禁 emoji。stroke 用 currentColor，宽高由调用处 size 决定。
 */

const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

const PATHS = {
    logo: '<circle cx="12" cy="12" r="9"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><path d="M8.5 13.5 12 7l3.5 6.5"/><path d="M9.8 11.5h4.4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    moon: '<path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    clapper: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3.6 9 5.5 4.6a2 2 0 0 1 2.6-1.1L20 7.5 19 9.8"/><path d="M8 4.8 9.8 8M12.4 5.9 14.2 9M16.8 7 18.2 9.6"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.8 14.7c2.4.2 4.1 1.7 4.7 4.3"/>',
    me: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c.9-4 3.7-6 7.2-6s6.3 2 7.2 6"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z"/>',
    spark: '<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
    alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 9.5v5M12 17.2v.2"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 9.5h7M8.5 12h7M10 15h4M12 6.5v11"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10.5h17"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    back: '<path d="m15 6-6 6 6 6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    play: '<path d="M7.5 5.5v13l10.5-6.5z"/>',
    forward: '<path d="M5 5.5v13l8-6.5zM13 5.5v13l8-6.5z"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 14h8v6H8z"/>',
    mask: '<path d="M4 5.5c2.6 1 5.4 1 8 0 2.6 1 5.4 1 8 0v6c0 5-3.4 8.5-8 9.5-4.6-1-8-4.5-8-9.5z"/><path d="M8.5 11c.5.8 1.4.8 2 0M13.5 11c.5.8 1.4.8 2 0M9 15.5c1.8 1.4 4.2 1.4 6 0"/>',
    heart: '<path d="M12 20.5C6.5 16.8 3.5 13.6 3.5 9.9 3.5 7.2 5.6 5 8.2 5c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2 2.6 0 4.7 2.2 4.7 4.9 0 3.7-3 6.9-8.5 10.6z"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20M8 7.5h8M8 11h5"/>',
    shield: '<path d="M12 3 5 5.5v6c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5v-6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4.5 6.5h15M9.5 6V4h5v2M6.5 6.5 7.5 20h9l1-13.5"/><path d="M10 10.5v6M14 10.5v6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    film: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M8 4.5v15M16 4.5v15M3.5 9h4.5M3.5 15h4.5M16 9h4.5M16 15h4.5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/>',
    timeline: '<path d="M12 3v18"/><circle cx="12" cy="6.5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="17.5" r="1.8"/><path d="M14 6.5h6M14 12h6M14 17.5h6"/>',
    gift: '<rect x="3.5" y="9" width="17" height="11.5" rx="1.5"/><path d="M12 9v11.5M3.5 13.5h17"/><path d="M12 9c-4.5 0-5.5-5-2.5-5 2 0 2.5 3 2.5 5zm0 0c4.5 0 5.5-5 2.5-5-2 0-2.5 3-2.5 5z"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 3.5V8h-4.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8 13 5.5a7 7 0 0 1 2 .9l2.7-1 1.9 1.9-1 2.7c.4.6.7 1.3.9 2l2.7 1v2.6l-2.7 1a7 7 0 0 1-.9 2l1 2.7-1.9 1.9-2.7-1a7 7 0 0 1-2 .9l-1 2.7h-2.6l-1-2.7a7 7 0 0 1-2-.9l-2.7 1-1.9-1.9 1-2.7a7 7 0 0 1-.9-2l-2.7-1v-2.6l2.7-1c.2-.7.5-1.4.9-2l-1-2.7L6.3 4.4l2.7 1a7 7 0 0 1 2-.9z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeOff: '<path d="M4 4l16 16M9.9 6.1A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.7M6.6 6.9A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.3-1.1"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-.6-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h1.8A4.2 4.2 0 0 0 21 10c-.5-4-4.4-7-9-7z"/><circle cx="7.5" cy="10.5" r="1.1"/><circle cx="10.5" cy="6.8" r="1.1"/><circle cx="15" cy="7.2" r="1.1"/>',
    prompt: '<path d="m7 8-4 4 4 4M17 8l4 4-4 4M13.5 5l-3 14"/>',
    megaphone: '<path d="M3.5 10.5v3.5h3l7 4.5V6l-7 4.5z"/><path d="M17 9a4.5 4.5 0 0 1 0 6M13.5 18.5v-13"/>',
    swap: '<path d="M7 4 3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7"/>',
    flag: '<path d="M5.5 21V4"/><path d="M5.5 4.8c4.5-2.4 8.5 2.2 13 0v9c-4.5 2.2-8.5-2.4-13 0"/>',
    scroll: '<path d="M6 3.5h12a2 2 0 0 1 2 2V17M6 3.5a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2H8"/><path d="M9.5 8h7M9.5 11.5h5"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/><circle cx="15" cy="15" r="1.2"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    energy: '<path d="M13 2.5 4.5 13.5H11L9.5 21.5 19 10h-6.5z"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5.5H4a3 3 0 0 0 3 4M17 5.5h3a3 3 0 0 1-3 4M12 14v3.5M8.5 20.5h7M10 17.5h4v3h-4z"/>',
    hourglass: '<path d="M6.5 3.5h11M6.5 20.5h11M8 3.5v3.2c0 2.6 4 3.7 4 5.3 0-1.6 4-2.7 4-5.3V3.5M8 20.5v-3.2c0-2.6 4-3.7 4-5.3 0 1.6 4 2.7 4 5.3v3.2"/>',
};

export function icon(name, { size = 18 } = {}) {
    const body = PATHS[name] || PATHS.spark;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" ${STROKE} aria-hidden="true">${body}</svg>`;
}

/** 桌面图标：暖金底聚光灯 */
export const APP_ICON = `
<svg viewBox="0 0 60 60" width="60" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="48" height="48" rx="14" fill="#1C1917"/>
    <path d="M24 14 L40 40 H31.5 L21 20 Z" fill="#F5C64B" fill-opacity="0.9"/>
    <path d="M24 14 L44 46 H14 Z" fill="#F5C64B" fill-opacity="0.28"/>
    <ellipse cx="29" cy="46" rx="15" ry="3.4" fill="#F5C64B" fill-opacity="0.5"/>
    <circle cx="24" cy="14" r="3.2" fill="#FFF7E0"/>
</svg>`;
