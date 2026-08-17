/**
 * 日记 · 图标集
 *
 * 全是**线性 SVG**，1.5px 描边，`stroke="currentColor"` ——
 * 产品要求禁用 emoji，所以任何「用符号表意」的地方都必须从这里取。
 *
 * ★ 只写 `viewBox`，**不写 width/height**。
 *   尺寸由 CSS 控制（`_base.css` 里有一条零特异性兜底：
 *   不带宽高的内联 SVG 浏览器会按 300×150 画，能把整个布局撑爆 ——
 *   这是本项目的老坑，见 `docs/提示词-从零生成App.md` 第 5 步）。
 */

const PATHS = {
    // ── 导航 ──────────────────────────────
    book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v14.5H5.5A1.5 1.5 0 0 0 4 20V5.5Z"/><path d="M4 18.5A1.5 1.5 0 0 1 5.5 17H19"/><path d="M8.5 8.5h6"/><path d="M8.5 11.5h4"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17"/><path d="M8 3.5v3"/><path d="M16 3.5v3"/>',
    drop: '<path d="M12 3.5s5.5 5.6 5.5 9.4a5.5 5.5 0 0 1-11 0C6.5 9.1 12 3.5 12 3.5Z"/>',
    flag: '<path d="M5.5 20.5V4"/><path d="M5.5 5h9.2l-1.4 3 1.4 3H5.5"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/>',

    // ── 动作 ──────────────────────────────
    pen: '<path d="M4 20h4l10-10a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M14.5 6.5 17.5 9.5"/>',
    note: '<path d="M5 4.5h14v10l-4.5 5H5v-15Z"/><path d="M19 14.5h-4.5v5"/><path d="M8.5 9h7"/>',
    plus: '<path d="M12 5.5v13"/><path d="M5.5 12h13"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    close: '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
    trash: '<path d="M4.5 6.5h15"/><path d="M9.5 6.5V4.5h5v2"/><path d="M6.5 6.5 7.5 20h9l1-13.5"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5"/><path d="M19.5 4.5V9h-4.5"/>',
    edit: '<path d="M12 20h8"/><path d="M4 20h3.5L18 9.5a1.8 1.8 0 0 0-2.5-2.5L5 17.5V20Z"/>',
    save: '<path d="M5 5.5h11L19 8.5V19H5V5.5Z"/><path d="M8.5 5.5v5h7v-5"/><path d="M8.5 19v-5h7v5"/>',

    // ── 方向 ──────────────────────────────
    left: '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
    right: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
    down: '<path d="m5.5 9.5 6.5 6.5 6.5-6.5"/>',
    up: '<path d="m5.5 14.5 6.5-6.5 6.5 6.5"/>',

    // ── 状态 ──────────────────────────────
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    heart: '<path d="M12 19.5S4.5 15 4.5 9.8A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7.5 1.8c0 5.2-7.5 9.7-7.5 9.7Z"/>',
    star: '<path d="m12 4.5 2.3 4.9 5.2.7-3.8 3.7 1 5.2-4.7-2.6-4.7 2.6 1-5.2L4.5 10l5.2-.7L12 4.5Z"/>',
    moon: '<path d="M19 14.2A7.6 7.6 0 0 1 9.8 5a7.6 7.6 0 1 0 9.2 9.2Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2"/><path d="M12 19v2"/><path d="M3 12h2"/><path d="M19 12h2"/><path d="m5.6 5.6 1.4 1.4"/><path d="m17 17 1.4 1.4"/><path d="m18.4 5.6-1.4 1.4"/><path d="m7 17-1.4 1.4"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    eye: '<path d="M2.8 12S6.5 6 12 6s9.2 6 9.2 6-3.7 6-9.2 6-9.2-6-9.2-6Z"/><circle cx="12" cy="12" r="2.6"/>',

    // ── 设置 ──────────────────────────────
    sliders: '<path d="M4.5 8h9"/><path d="M17 8h2.5"/><path d="M4.5 16h3"/><path d="M11 16h8.5"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.4-1-1.7-1-2.7 0-.8.7-1.4 1.6-1.4h1.4a4.7 4.7 0 0 0 4.7-4.7c0-3.6-3.6-6.5-8.5-6.5Z"/><circle cx="7.8" cy="11" r="1"/><circle cx="10.4" cy="7.6" r="1"/><circle cx="14.6" cy="7.8" r="1"/>',
    layers: '<path d="m12 4 8 4-8 4-8-4 8-4Z"/><path d="m4 12.5 8 4 8-4"/>',
    chart: '<path d="M4.5 19.5h15"/><path d="M7.5 16.5v-5"/><path d="M12 16.5v-9"/><path d="M16.5 16.5v-3"/>',

    // ── 特殊 ──────────────────────────────
    /** 「让 AI 写」的按钮。不用 emoji，用一支带火花的笔。 */
    quill: '<path d="M4.5 19.5c4-9 9-11.5 15-12-1 6.5-4 11-11 12"/><path d="M4.5 19.5 9 15"/><path d="M18.5 4.5v2"/><path d="M17.5 5.5h2"/>',
    /** 空状态用的一张空纸 */
    sheet: '<path d="M6 3.5h8L18.5 8v12.5H6V3.5Z"/><path d="M14 3.5V8h4.5"/>',
    /** 世界观 */
    globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><path d="M12 4a12 12 0 0 1 0 16 12 12 0 0 1 0-16Z"/>',
    /** 提醒铃 */
    bell: '<path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10Z"/><path d="M10 18.5a2.2 2.2 0 0 0 4 0"/>',
};

/**
 * 取一个图标。
 * @param {string} name PATHS 里的键
 * @param {string} [cls] 额外 class
 */
export function icon(name, cls = '') {
    const body = PATHS[name];
    if (!body) return '';
    const klass = cls ? ` ${cls}` : '';
    return `<svg class="dy-icon${klass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function hasIcon(name) {
    return Boolean(PATHS[name]);
}

export const ICON_NAMES = Object.freeze(Object.keys(PATHS));

/**
 * 桌面图标。
 *
 * 这一张是**唯一**带尺寸和颜色的 SVG —— 框架把它画在桌面网格里，
 * 不在 app-shell 作用域内，CSS 变量够不着，只能内联。
 */
export const APP_ICON = `<svg viewBox="0 0 60 60" width="56" height="56" xmlns="http://www.w3.org/2000/svg" style="display:block;">
    <rect width="60" height="60" rx="15" fill="#E8E2D9" />
    <rect x="16" y="13" width="28" height="34" rx="3" fill="#FBF9F6" />
    <path d="M16 16a3 3 0 0 1 3-3h3v34h-3a3 3 0 0 1-3-3V16Z" fill="#B9A99A" />
    <path d="M27 22h11M27 28h11M27 34h7" stroke="#9C8E80" stroke-width="1.6" stroke-linecap="round" />
    <circle cx="19" cy="30" r="1.4" fill="#FBF9F6" />
</svg>`;

export default icon;
