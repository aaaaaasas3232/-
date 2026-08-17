/**
 * 氧气 · 图标
 *
 * 全部是 24 viewBox 的线性 SVG（stroke: currentColor），禁 emoji、禁渐变。
 * `icon(name, { size })` 返回带宽高的 SVG 字符串（开发者受信任内容，可进 v-html）。
 */

const PATHS = {
    /** 呼吸圈：两个错位的圆，氧气的标志 */
    logo: '<circle cx="10.5" cy="12" r="6.5"/><circle cx="14.5" cy="12" r="6.5" opacity="0.45"/>',
    /** 广场：四宫格 */
    square: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
    /** 发现：放大镜 */
    discover: '<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8 L20 20"/>',
    /** 房间：打开的白盒 */
    room: '<path d="M4 9.5 L12 5 L20 9.5 L20 18 L4 18 Z"/><path d="M4 9.5 L12 13.5 L20 9.5"/><path d="M12 13.5 L12 18"/>',
    /** 随笔：笔 */
    essay: '<path d="M5 19 L7.5 18.4 L18.2 7.7 A1.6 1.6 0 0 0 15.9 5.4 L5.2 16.1 Z"/><path d="M13.6 7.7 L15.9 10"/>',
    /** 我的：人 */
    me: '<circle cx="12" cy="8.4" r="3.6"/><path d="M5.2 19.4 C6.4 15.9 9 14.4 12 14.4 C15 14.4 17.6 15.9 18.8 19.4"/>',
    back: '<path d="M14.5 5.5 L8 12 L14.5 18.5"/>',
    close: '<path d="M6.5 6.5 L17.5 17.5"/><path d="M17.5 6.5 L6.5 17.5"/>',
    plus: '<path d="M12 5.5 L12 18.5"/><path d="M5.5 12 L18.5 12"/>',
    tag: '<path d="M4.5 11.2 L4.5 5.5 A1 1 0 0 1 5.5 4.5 L11.2 4.5 A2 2 0 0 1 12.6 5.1 L19.2 11.7 A1.8 1.8 0 0 1 19.2 14.2 L14.2 19.2 A1.8 1.8 0 0 1 11.7 19.2 L5.1 12.6 A2 2 0 0 1 4.5 11.2 Z"/><circle cx="8.6" cy="8.6" r="1.1"/>',
    heart: '<path d="M12 19.2 C7.4 15.9 4.6 13.2 4.6 9.9 C4.6 7.6 6.4 5.9 8.5 5.9 C9.9 5.9 11.2 6.6 12 7.9 C12.8 6.6 14.1 5.9 15.5 5.9 C17.6 5.9 19.4 7.6 19.4 9.9 C19.4 13.2 16.6 15.9 12 19.2 Z"/>',
    star: '<path d="M12 4.6 L14.1 9.2 L19.2 9.8 L15.4 13.2 L16.5 18.2 L12 15.6 L7.5 18.2 L8.6 13.2 L4.8 9.8 L9.9 9.2 Z"/>',
    comment: '<path d="M5 6.8 A2 2 0 0 1 7 4.8 L17 4.8 A2 2 0 0 1 19 6.8 L19 14 A2 2 0 0 1 17 16 L9.6 16 L6 19.2 L6 16 A2 2 0 0 1 5 14 Z"/>',
    share: '<circle cx="6.6" cy="12" r="2.1"/><circle cx="17" cy="6.4" r="2.1"/><circle cx="17" cy="17.6" r="2.1"/><path d="M8.5 11 L15.1 7.4"/><path d="M8.5 13 L15.1 16.6"/>',
    refresh: '<path d="M18.4 8.6 A7 7 0 1 0 19 12"/><path d="M18.8 4.6 L18.8 8.8 L14.6 8.8"/>',
    send: '<path d="M5 12 L19 5 L15.5 19 L11.5 13.5 Z"/><path d="M11.5 13.5 L19 5"/>',
    mic: '<rect x="9.4" y="4.4" width="5.2" height="9.4" rx="2.6"/><path d="M6.4 11.6 A5.6 5.6 0 0 0 17.6 11.6"/><path d="M12 17.2 L12 19.8"/>',
    check: '<path d="M5.5 12.6 L10 17 L18.6 7.4"/>',
    copy: '<rect x="8.6" y="8.6" width="10" height="10" rx="1.8"/><path d="M5.4 14.6 L5.4 7 A1.6 1.6 0 0 1 7 5.4 L14.6 5.4"/>',
    save: '<path d="M5.4 6.6 A1.2 1.2 0 0 1 6.6 5.4 L15.6 5.4 L18.6 8.4 L18.6 17.4 A1.2 1.2 0 0 1 17.4 18.6 L6.6 18.6 A1.2 1.2 0 0 1 5.4 17.4 Z"/><path d="M8.4 5.4 L8.4 9.4 L14.6 9.4 L14.6 5.4"/><rect x="8.6" y="12.6" width="6.8" height="6" rx="0.8"/>',
    trash: '<path d="M5.5 7.4 L18.5 7.4"/><path d="M9.4 7.4 L9.4 5.8 A1.2 1.2 0 0 1 10.6 4.6 L13.4 4.6 A1.2 1.2 0 0 1 14.6 5.8 L14.6 7.4"/><path d="M7.2 7.4 L7.8 18 A1.4 1.4 0 0 0 9.2 19.4 L14.8 19.4 A1.4 1.4 0 0 0 16.2 18 L16.8 7.4"/><path d="M10.3 10.4 L10.3 16.2"/><path d="M13.7 10.4 L13.7 16.2"/>',
    edit: '<path d="M5 19 L8 18.3 L18.4 7.9 A1.7 1.7 0 0 0 16 5.5 L5.6 15.9 Z"/>',
    drawer: '<rect x="4.5" y="5.5" width="15" height="13" rx="1.8"/><path d="M4.5 13 L9.4 13 L10.8 15 L13.2 15 L14.6 13 L19.5 13"/>',
    box: '<rect x="4.5" y="6.5" width="15" height="11" rx="1.4"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><path d="M10.8 12 L13.2 12"/>',
    settings: '<circle cx="12" cy="12" r="2.6"/><path d="M12 4.4 L12 6.6 M12 17.4 L12 19.6 M4.4 12 L6.6 12 M17.4 12 L19.6 12 M6.6 6.6 L8.2 8.2 M15.8 15.8 L17.4 17.4 M17.4 6.6 L15.8 8.2 M8.2 15.8 L6.6 17.4"/>',
    chevron: '<path d="M9.5 5.5 L16 12 L9.5 18.5"/>',
    dots: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
    battery: '<rect x="4" y="8" width="14" height="8" rx="2"/><path d="M20 10.6 L20 13.4"/><rect x="6" y="10" width="6" height="4" rx="0.8"/>',
    wind: '<path d="M4.5 9.2 L13.4 9.2 A2.3 2.3 0 1 0 11.1 6.9"/><path d="M4.5 13 L17.4 13 A2.4 2.4 0 1 1 15 15.4"/><path d="M4.5 16.8 L9.8 16.8"/>',
    calendar: '<rect x="4.5" y="6" width="15" height="13.5" rx="1.8"/><path d="M4.5 10 L19.5 10"/><path d="M8.6 4 L8.6 7.6 M15.4 4 L15.4 7.6"/>',
    timeline: '<path d="M7 4.5 L7 19.5"/><circle cx="7" cy="7.4" r="1.6"/><circle cx="7" cy="13" r="1.6"/><circle cx="7" cy="18" r="1.6"/><path d="M10.6 7.4 L19 7.4 M10.6 13 L16.6 13 M10.6 18 L18 18"/>',
    question: '<path d="M9.2 9.1 A2.9 2.9 0 0 1 14.9 9.7 C14.9 11.6 12 11.9 12 13.9"/><circle cx="12" cy="17.1" r="0.5"/><circle cx="12" cy="12" r="9" opacity="0.35"/>',
    world: '<circle cx="12" cy="12" r="7.6"/><path d="M4.4 12 L19.6 12"/><path d="M12 4.4 C14.6 6.8 14.6 17.2 12 19.6 C9.4 17.2 9.4 6.8 12 4.4 Z"/>',
    fold: '<path d="M5 8.5 L12 14 L19 8.5"/>',
    fire: '<path d="M12 4.8 C13.4 7.2 16.8 9 16.8 13 A4.8 4.8 0 0 1 7.2 13 C7.2 11 8.2 9.6 9.4 8.4 C9.6 9.4 10.2 10.2 11 10.6 C10.6 8.6 11 6.4 12 4.8 Z"/>',
    quiet: '<path d="M5 9.5 C7 8 9 8 11 9.5 C13 11 15 11 17 9.5"/><path d="M5 14.5 C7 13 9 13 11 14.5 C13 16 15 16 17 14.5" opacity="0.4"/>',
    export: '<path d="M12 4.6 L12 14.6"/><path d="M8.4 8.2 L12 4.6 L15.6 8.2"/><path d="M5.4 12.6 L5.4 17.6 A1.6 1.6 0 0 0 7 19.2 L17 19.2 A1.6 1.6 0 0 0 18.6 17.6 L18.6 12.6"/>',
    users: '<circle cx="9" cy="9" r="3"/><path d="M3.8 18.6 C4.8 15.8 6.7 14.6 9 14.6 C11.3 14.6 13.2 15.8 14.2 18.6"/><circle cx="16.4" cy="9.6" r="2.4"/><path d="M15.6 14.9 C17.9 14.9 19.5 16 20.2 18.2"/>',
    mail: '<rect x="4" y="6" width="16" height="12" rx="1.8"/><path d="M4.6 7 L12 12.6 L19.4 7"/>',
};

function svg(body, size, strokeWidth = 1.6) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

export function icon(name, { size = 18, strokeWidth = 1.6 } = {}) {
    const body = PATHS[name] || PATHS.logo;
    return svg(body, size, strokeWidth);
}

/** 桌面图标：白底黑圈（呼吸的两个圆），禁渐变 */
export const APP_ICON = `
    <svg viewBox="0 0 60 60" width="56" height="56" xmlns="http://www.w3.org/2000/svg" style="display:block;">
        <rect x="0" y="0" width="60" height="60" rx="14" fill="#FFFFFF"/>
        <circle cx="26" cy="30" r="13" fill="none" stroke="#111111" stroke-width="2.6"/>
        <circle cx="36" cy="30" r="13" fill="none" stroke="#111111" stroke-width="2.6" opacity="0.38"/>
    </svg>
`;
