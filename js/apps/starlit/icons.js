/**
 * 点灯 · 图标
 *
 * 全部内联 SVG、全部带 width/height（桌面图标不带尺寸会画成空白）。
 * 描边式、currentColor —— 颜色由外层 CSS 决定，这里一个色值都没有。
 * 禁 emoji（全库规矩）。
 */

const S = (body, size = 22, stroke = 1.7, color = 'currentColor') =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" `
    + `stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const LAMP_PATH = '<path d="M12 4.4c-3 0-5.4 2.3-5.4 5.2 0 2 1 3.3 2 4.4.6.6.9 1.2 1 2h4.8c.1-.8.4-1.4 1-2 1-1.1 2-2.4 2-4.4 0-2.9-2.4-5.2-5.4-5.2Z"/><path d="M10 18.4h4M10.8 21h2.4"/>';

/** 桌面图标在 app-shell 外，无法继承 --sl-primary，因此直接使用默认主题主色。 */
export const APP_ICON = S(LAMP_PATH, 32, 1.7, '#C2703C');

const PATHS = {
    // 导航
    layers: '<path d="M12 3 3 7.5l9 4.5 9-4.5Z"/><path d="M3 12.4l9 4.5 9-4.5"/><path d="M3 17l9 4.5 9-4.5"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 18.5"/><path d="M8 7.5h7M8 11h5"/>',
    graph: '<circle cx="6" cy="6.5" r="2.4"/><circle cx="18" cy="8" r="2.4"/><circle cx="11" cy="18" r="2.4"/><path d="M8.2 7.4 15.7 8"/><path d="M7.1 8.7 10 15.7"/><path d="M17 10.2 12.4 16"/>',
    cards: '<rect x="3" y="6.5" width="12" height="12" rx="2.4"/><path d="M7.5 3.5h9.4A3.1 3.1 0 0 1 20 6.6v9.2"/><path d="M6.6 11h4.8M6.6 14.4h3"/>',
    user: '<circle cx="12" cy="8.4" r="3.6"/><path d="M5 20.2c.9-3.6 3.6-5.4 7-5.4s6.1 1.8 7 5.4"/>',

    // 动作
    plus: '<path d="M12 5.4v13.2M5.4 12h13.2"/>',
    close: '<path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6"/>',
    back: '<path d="M14.6 5.5 8 12l6.6 6.5"/>',
    chevron: '<path d="M9 5.5 15.6 12 9 18.5"/>',
    check: '<path d="M5 12.6 9.4 17 19 6.8"/>',
    send: '<path d="M4.4 12 20 4.6l-4.2 15.2-3.5-6.1Z"/><path d="M12.3 13.7 20 4.6"/>',
    edit: '<path d="M4.6 19.4h4l10-10a2.4 2.4 0 0 0-3.4-3.4l-10 10Z"/><path d="M14.6 7.4l2.6 2.6"/>',
    trash: '<path d="M5 7h14"/><path d="M9.2 7V5.2A1.2 1.2 0 0 1 10.4 4h3.2a1.2 1.2 0 0 1 1.2 1.2V7"/><path d="M6.6 7l.8 12.2a1.4 1.4 0 0 0 1.4 1.3h6.4a1.4 1.4 0 0 0 1.4-1.3L17.4 7"/>',
    refresh: '<path d="M20 5.6v4.8h-4.8"/><path d="M19.2 10.4A7.6 7.6 0 1 0 12 20"/>',
    sparkle: '<path d="M12 3.6l1.9 5.2 5.2 1.9-5.2 1.9L12 17.8l-1.9-5.2-5.2-1.9 5.2-1.9Z"/><path d="M18.6 16.4l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7Z"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.2"/><path d="M15.4 15.4 20 20"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3.4v2.2M12 18.4v2.2M4.8 7.8l1.9 1.1M17.3 15.1l1.9 1.1M4.8 16.2l1.9-1.1M17.3 8.9l1.9-1.1"/>',
    palette: '<path d="M12 3.6a8.4 8.4 0 0 0 0 16.8c1.5 0 2-.9 2-1.8 0-1.7-1.8-1.8-1.8-3.3 0-1.2 1-2 2.4-2h1.6a4.2 4.2 0 0 0 4.2-4.2c0-3-3.6-5.5-8.4-5.5Z"/><circle cx="8.4" cy="9.6" r="1.1"/><circle cx="12" cy="7.6" r="1.1"/><circle cx="7.6" cy="13.6" r="1.1"/>',

    // 学习
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1"/>',
    flag: '<path d="M6 20.4V4.2"/><path d="M6 4.8h10.6l-1.8 3.6 1.8 3.6H6"/>',
    root: '<path d="M12 4v6"/><path d="M12 10c0 4-3.4 4.4-3.4 7.2A3.4 3.4 0 0 0 12 20.6a3.4 3.4 0 0 0 3.4-3.4c0-2.8-3.4-3.2-3.4-7.2Z"/><path d="M8.6 6.4 12 10l3.4-3.6"/>',
    code: '<path d="M8.6 8.2 4.8 12l3.8 3.8"/><path d="M15.4 8.2 19.2 12l-3.8 3.8"/><path d="M13.4 5.4l-2.8 13.2"/>',
    link: '<path d="M10.2 13.8a3.6 3.6 0 0 1 0-5.1l2.4-2.4a3.6 3.6 0 0 1 5.1 5.1l-1.2 1.2"/><path d="M13.8 10.2a3.6 3.6 0 0 1 0 5.1l-2.4 2.4a3.6 3.6 0 0 1-5.1-5.1l1.2-1.2"/>',
    thread: '<path d="M4.6 5.4c5 0 3.4 6.6 7.4 6.6s2.4 6.6 7.4 6.6"/><circle cx="4.6" cy="5.4" r="1.6"/><circle cx="19.4" cy="18.6" r="1.6"/>',
    tidy: '<rect x="3.6" y="4" width="6.4" height="6.4" rx="1.4"/><rect x="14" y="4" width="6.4" height="6.4" rx="1.4"/><rect x="3.6" y="13.6" width="6.4" height="6.4" rx="1.4"/><rect x="14" y="13.6" width="6.4" height="6.4" rx="1.4"/>',
    focus: '<path d="M4 8.4V5.6A1.6 1.6 0 0 1 5.6 4h2.8"/><path d="M20 8.4V5.6A1.6 1.6 0 0 0 18.4 4h-2.8"/><path d="M4 15.6v2.8A1.6 1.6 0 0 0 5.6 20h2.8"/><path d="M20 15.6v2.8A1.6 1.6 0 0 1 18.4 20h-2.8"/>',
    expand: '<path d="M9 4H4.8A.8.8 0 0 0 4 4.8V9"/><path d="M15 4h4.2a.8.8 0 0 1 .8.8V9"/><path d="M9 20H4.8a.8.8 0 0 1-.8-.8V15"/><path d="M15 20h4.2a.8.8 0 0 0 .8-.8V15"/>',
    teacher: '<path d="M3.4 9.4 12 5.4l8.6 4-8.6 4Z"/><path d="M7.6 11.4v4.2c0 1.6 2 2.8 4.4 2.8s4.4-1.2 4.4-2.8v-4.2"/><path d="M20.6 9.4v5"/>',
    student: '<circle cx="12" cy="7.6" r="3.2"/><path d="M6 20c.6-3.4 3-5 6-5s5.4 1.6 6 5"/><path d="M15.4 4.4 18.6 3l-.6 3.2"/>',
    flip: '<path d="M4.6 9.4A7.6 7.6 0 0 1 18 6.6"/><path d="M19.4 14.6A7.6 7.6 0 0 1 6 17.4"/><path d="M18 3.4v3.4h-3.4"/><path d="M6 20.6v-3.4h3.4"/>',
    quiz: '<circle cx="12" cy="12" r="8.2"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9"/><path d="M12 16.8h.01"/>',
    note: '<path d="M5.4 4.6h9.2l4 4v10.8H5.4Z"/><path d="M14.6 4.6v4h4"/><path d="M8.4 12h7M8.4 15.4h4.6"/>',
    tv: '<rect x="3" y="6.4" width="18" height="12" rx="2.2"/><path d="M8.6 3.4 12 6.4l3.4-3"/><path d="M7 21h10"/>',
    play: '<path d="M7.6 5.4 18.6 12 7.6 18.6Z"/>',
    pause: '<path d="M9 5.6v12.8M15 5.6v12.8"/>',
    stack: '<rect x="6.4" y="3.6" width="11.2" height="14" rx="2"/><path d="M4 7.4v11.2A2 2 0 0 0 6 20.6h9"/>',
    eye: '<path d="M2.6 12S6 6.4 12 6.4 21.4 12 21.4 12 18 17.6 12 17.6 2.6 12 2.6 12Z"/><circle cx="12" cy="12" r="2.6"/>',
    eyeOff: '<path d="M4 4.4 20 20.4"/><path d="M9.4 9.6A2.6 2.6 0 0 0 12 14.6c.7 0 1.4-.3 1.9-.8"/><path d="M6.4 7.2C4 8.9 2.6 12 2.6 12S6 17.6 12 17.6c1.4 0 2.6-.3 3.7-.8"/><path d="M18.2 15.2c2-1.6 3.2-3.2 3.2-3.2S18 6.4 12 6.4c-.5 0-1 0-1.5.1"/>',
    lamp: LAMP_PATH,
    globe: '<circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8"/><path d="M12 3.6c2.4 2.4 3.4 5.4 3.4 8.4S14.4 18 12 20.4C9.6 18 8.6 15 8.6 12S9.6 6 12 3.6Z"/>',
    history: '<path d="M4 6.6v4.4h4.4"/><path d="M4.8 11A7.6 7.6 0 1 1 12 19.6"/><path d="M12 8.6V12l2.8 1.8"/>',
    grid: '<path d="M4 9.4h16M4 14.6h16M9.4 4v16M14.6 4v16"/>',
    drag: '<circle cx="9.4" cy="6.4" r="1.2"/><circle cx="14.6" cy="6.4" r="1.2"/><circle cx="9.4" cy="12" r="1.2"/><circle cx="14.6" cy="12" r="1.2"/><circle cx="9.4" cy="17.6" r="1.2"/><circle cx="14.6" cy="17.6" r="1.2"/>',
    scissors: '<circle cx="6.4" cy="6.4" r="2.4"/><circle cx="6.4" cy="17.6" r="2.4"/><path d="M8.4 8 19 18.4"/><path d="M8.4 16 19 5.6"/>',
    birth: '<path d="M4 20.4V6.4A2.4 2.4 0 0 1 6.4 4h11.2A2.4 2.4 0 0 1 20 6.4v14"/><path d="M4 9.4h16"/><path d="M8 13.4h4.6M8 16.6h8"/><path d="M6.4 6.8h.01M8.8 6.8h.01"/>',
};

/** 取一个图标。name 不存在时返回空串（不画错东西比画错好）。 */
export function icon(name, { size = 22, stroke = 1.7 } = {}) {
    const body = PATHS[name];
    return body ? S(body, size, stroke) : '';
}

export function hasIcon(name) {
    return Boolean(PATHS[name]);
}

/** 卡片类型 → 图标名 */
export const CARD_ICON = Object.freeze({
    concept: 'lamp',
    word: 'root',
    code: 'code',
    post: 'link',
    quiz: 'quiz',
    note: 'note',
    stuck: 'flag',
});
