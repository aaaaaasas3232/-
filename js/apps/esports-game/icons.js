/**
 * 赛点 · 图标
 *
 * 全部线性 SVG，禁 emoji。stroke 用 currentColor，宽高由调用处 size 决定。
 */

const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

const PATHS = {
    logo: '<path d="M6.5 8h11A4.5 4.5 0 0 1 22 12.5V15a3 3 0 0 1-5.6 1.5L15.2 14H8.8l-1.2 2.5A3 3 0 0 1 2 15v-2.5A4.5 4.5 0 0 1 6.5 8z"/><path d="M7.5 11v3M6 12.5h3M16 11.4v.2M18.2 13v.2"/>',
    gamepad: '<path d="M6.5 8h11A4.5 4.5 0 0 1 22 12.5V15a3 3 0 0 1-5.6 1.5L15.2 14H8.8l-1.2 2.5A3 3 0 0 1 2 15v-2.5A4.5 4.5 0 0 1 6.5 8z"/><path d="M7.5 11v3M6 12.5h3M16 11.4v.2M18.2 13v.2"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5.5H4a3 3 0 0 0 3 4M17 5.5h3a3 3 0 0 1-3 4M12 14v3.5M8.5 20.5h7M10 17.5h4v3h-4z"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.8 14.7c2.4.2 4.1 1.7 4.7 4.3"/>',
    comment: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.7-.3-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/>',
    me: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c.9-4 3.7-6 7.2-6s6.3 2 7.2 6"/>',
    swords: '<path d="m4 4 7 7M4 4v3.5M4 4h3.5M20 4l-7 7M20 4v3.5M20 4h-3.5M6.5 14 4 16.5 7.5 20 10 17.5M17.5 14l2.5 2.5L16.5 20 14 17.5"/>',
    rank: '<path d="M4 20V10M10 20V4M16 20v-8M4 20h16"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    energy: '<path d="M13 2.5 4.5 13.5H11L9.5 21.5 19 10h-6.5z"/>',
    meal: '<path d="M4 11h16M5 11a7 7 0 0 1 14 0M12 4v-1.5M12 20.5v-2M8 18.5h8a4 4 0 0 0 4-4v-1H4v1a4 4 0 0 0 4 4z"/>',
    heart: '<path d="M12 20.5C6.5 16.8 3.5 13.6 3.5 9.9 3.5 7.2 5.6 5 8.2 5c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2 2.6 0 4.7 2.2 4.7 4.9 0 3.7-3 6.9-8.5 10.6z"/>',
    heartRing: '<path d="M12 19c-4.5-3-7-5.7-7-8.8C5 8 6.7 6.2 8.8 6.2c1.3 0 2.5.7 3.2 1.7.7-1 1.9-1.7 3.2-1.7 2.1 0 3.8 1.8 3.8 4 0 3.1-2.5 5.8-7 8.8z"/><circle cx="12" cy="12" r="10"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    back: '<path d="m15 6-6 6 6 6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    play: '<path d="M7.5 5.5v13l10.5-6.5z"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="17.5" cy="5.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="m8.3 10.8 7-4M8.3 13.2l7 4"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 3.5V8h-4.5"/>',
    cloud: '<path d="M7 18.5h10a4.5 4.5 0 0 0 .9-8.9 6 6 0 0 0-11.7 1.4A3.8 3.8 0 0 0 7 18.5z"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-.6-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h1.8A4.2 4.2 0 0 0 21 10c-.5-4-4.4-7-9-7z"/><circle cx="7.5" cy="10.5" r="1.1"/><circle cx="10.5" cy="6.8" r="1.1"/><circle cx="15" cy="7.2" r="1.1"/>',
    coach: '<circle cx="12" cy="7" r="3.2"/><path d="M5.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M9 11.5 12 14l3-2.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
    fire: '<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-2.6 1.6-4.4 3-6 1.2-1.4 2.4-2.8 2.6-5 2.5 1.4 3.6 3.4 3.4 5.6 1-.4 1.7-1.1 2-2.2 1.4 1.7 2 3.6 2 5.6 0 4.5-2.5 8-6.5 8z"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20M8 7.5h8M8 11h5"/>',
    send: '<path d="M21 3 3.5 10.5l6.5 2.5L12.5 20z"/><path d="M21 3 10 13"/>',
    alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 9.5v5M12 17.2v.2"/>',
    link: '<path d="M9.5 14.5 14.5 9.5M8 12l-2.5 2.5a3.5 3.5 0 0 0 5 5L13 17M16 12l2.5-2.5a3.5 3.5 0 0 0-5-5L11 7"/>',
    ghost: '<path d="M5 21V11a7 7 0 0 1 14 0v10l-2.3-2-2.4 2-2.3-2-2.3 2-2.4-2z"/><circle cx="9.5" cy="11" r="1"/><circle cx="14.5" cy="11" r="1"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/><circle cx="15" cy="15" r="1.2"/>',
    trash: '<path d="M4.5 6.5h15M9.5 6V4h5v2M6.5 6.5 7.5 20h9l1-13.5"/><path d="M10 10.5v6M14 10.5v6"/>',
    hourglass: '<path d="M6.5 3.5h11M6.5 20.5h11M8 3.5v3.2c0 2.6 4 3.7 4 5.3 0-1.6 4-2.7 4-5.3V3.5M8 20.5v-3.2c0-2.6 4-3.7 4-5.3 0 1.6 4 2.7 4 5.3v3.2"/>',
    invite: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="m4 6.5 8 6 8-6"/>',
};

export function icon(name, { size = 18 } = {}) {
    const body = PATHS[name] || PATHS.gamepad;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" ${STROKE} aria-hidden="true">${body}</svg>`;
}

/** 桌面图标：深蓝底手柄电光 */
export const APP_ICON = `
<svg viewBox="0 0 60 60" width="60" height="60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="48" height="48" rx="14" fill="#10141E"/>
    <path d="M20 24h20a8 8 0 0 1 8 8v4.5a5 5 0 0 1-9.4 2.4L36.5 35h-13l-2.1 3.9A5 5 0 0 1 12 36.5V32a8 8 0 0 1 8-8z" stroke="#5EA2FF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M22.5 29.5v5M20 32h5" stroke="#5EA2FF" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="38" cy="30.5" r="1.6" fill="#5EA2FF"/>
    <circle cx="41.5" cy="33.5" r="1.6" fill="#43E6B0"/>
</svg>`;
