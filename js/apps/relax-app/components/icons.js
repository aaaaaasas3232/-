/**
 * relax-app / 内联 SVG 图标
 *
 * 为什么不用 emoji / 符号字形(✕ ✓ ★ ⋮):
 *   同一个字形在 iOS / Android / Windows 上的字重、基线、大小全不一样,
 *   彩色 emoji 还吃不到 currentColor,选中态换色就跟着糊。
 *   统一成 stroke 风格的 SVG 之后,大小走 CSS、颜色跟 currentColor 走。
 *
 * 用法:模板是普通字符串,直接把常量插进去就行 ——
 *   template: `<button>${ICON_CLOSE}</button>`
 * 尺寸别写死在 SVG 上,统一用 `.rx-icon` / `.rx-icon-sm` 这些 CSS 类调。
 */

/** 统一那一串固定属性,免得 20 个图标抄 20 遍还抄歪 */
function icon(name, body) {
    return `<svg class="rx-icon rx-icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** 收藏星标。收藏态由 CSS 给它 fill:currentColor,不另做一个实心图标 */
export const ICON_STAR = icon('star', '<path d="M12 3.2 14.85 9l6.4.93-4.63 4.5 1.1 6.37L12 17.79l-5.72 3.01 1.1-6.37L2.75 9.93 9.15 9 12 3.2Z"/>');

export const ICON_CHEVRON_DOWN = icon('chevron-down', '<path d="m6 9 6 6 6-6"/>');
export const ICON_CHEVRON_LEFT = icon('chevron-left', '<path d="m15 18-6-6 6-6"/>');
export const ICON_CLOSE = icon('close', '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');
export const ICON_CHECK = icon('check', '<path d="m20 6-11 11-5-5"/>');
export const ICON_TRASH = icon('trash', '<path d="M3.5 6h17"/><path d="M8.5 6V4.2h7V6"/><path d="M18.5 6 17.6 20H6.4L5.5 6"/><path d="M10 10.5v6"/><path d="M14 10.5v6"/>');
export const ICON_PENCIL = icon('pencil', '<path d="M12.5 20H21"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L8.2 17.8 4 19l1.2-4.2Z"/>');
export const ICON_FLIP = icon('flip', '<path d="M12 3.5v17"/><path d="M8 8 4 12l4 4"/><path d="m16 8 4 4-4 4"/>');
export const ICON_GRIP = icon('grip', '<path d="M9.5 6h.01"/><path d="M9.5 12h.01"/><path d="M9.5 18h.01"/><path d="M14.5 6h.01"/><path d="M14.5 12h.01"/><path d="M14.5 18h.01"/>');
export const ICON_UPLOAD = icon('upload', '<path d="M12 16V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4.5 15.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-3.5"/>');
export const ICON_MUSIC = icon('music', '<path d="M9 17.5V5.2l10-2v12.3"/><circle cx="6" cy="17.5" r="3"/><circle cx="16" cy="15.5" r="3"/>');
export const ICON_WAVE = icon('wave', '<path d="M3 12h2.2l2-6.4 3.2 13.2 3-10 1.9 3.2H21"/>');
export const ICON_PLAY = icon('play', '<path d="M8 5.5 18 12 8 18.5Z"/>');
/** 灵动岛：一颗胶囊 + 左侧那个小圆点，跟系统总览页的图标保持一致 */
export const ICON_ISLAND = icon('island', '<rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="8" cy="12" r="1.4" fill="currentColor" stroke="none"/>');
