/**
 * 人设机 · 图标
 *
 * 原型用的是 Font Awesome(`<i class="fas fa-cog">`)+ 少量 emoji。
 * 这里统一成**内联 SVG + `currentColor`**:
 *   - 不引外部字体(离线可用、不闪一下方块)
 *   - 颜色跟随文字,主题一换就跟着变
 *   - 用户明确要求禁用 emoji
 *
 * ⚠️ SVG 不写 width/height 时浏览器按规范画成 300×150,会把整张卡撑爆。
 *    兜底规则在 `css/apps/persona-lab/_base.css` 顶部(两层 `:where()`,
 *    特异性压到 (0,0,1),任何具名规则都能盖过它)。
 */

const S = (body, extra = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${extra ? ` ${extra}` : ''}>${body}</svg>`;

export const ICONS = Object.freeze({
    /* 导航 */
    library: S('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M11 4h3.5A1.5 1.5 0 0 1 16 5.5v13a1.5 1.5 0 0 1-1.5 1.5H11z"/><path d="M18.5 6.2 20 18.4"/>'),
    import: S('<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>'),
    export: S('<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M12 12v6"/><path d="m15 15-3-3-3 3"/>'),

    /* 工作台 */
    ask: S('<path d="M21 11.5a8.5 8.5 0 0 1-11.9 7.8L4 21l1.7-5A8.5 8.5 0 1 1 21 11.5z"/><path d="M9.6 9.2a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2-2.4 3.4"/><path d="M12 16.4h.01"/>'),
    refine: S('<path d="M4 20.5 8 19l10.6-10.6a2 2 0 0 0 0-2.8l-.2-.2a2 2 0 0 0-2.8 0L5 16z"/><path d="m14.5 6.5 3 3"/><path d="M4 20.5 5 16"/>'),
    card: S('<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.75" cy="10.5" r="2.1"/><path d="M5.4 16.4c.5-1.6 1.8-2.5 3.35-2.5s2.85.9 3.35 2.5"/><path d="M14.8 9.6h4"/><path d="M14.8 13h4"/>'),

    /* 动作 */
    send: S('<path d="M4.5 12 20 4.5 15 20l-3.4-6.3z"/><path d="m11.6 13.7 8.4-9.2"/>'),
    stop: S('<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>'),
    plus: S('<path d="M12 5v14"/><path d="M5 12h14"/>'),
    check: S('<path d="m5 12.8 4.5 4.5L19 7"/>'),
    close: S('<path d="M6.5 6.5 17.5 17.5"/><path d="M17.5 6.5 6.5 17.5"/>'),
    back: S('<path d="M15 5 8 12l7 7"/>'),
    undo: S('<path d="M4 9h10a5 5 0 0 1 0 10h-5"/><path d="m8 5-4 4 4 4"/>'),
    save: S('<path d="M5 4.5h10.2L20 9.3V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V6a1.5 1.5 0 0 1 1-1.5z"/><path d="M8 4.5v5h6v-5"/><rect x="7.5" y="13" width="9" height="6.5" rx="1"/>'),
    refresh: S('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4.5V10h-5.4"/>'),
    trash: S('<path d="M4.5 7h15"/><path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7"/><path d="M6.5 7l.8 11.6A1.5 1.5 0 0 0 8.8 20h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>'),
    copy: S('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5.5 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v.5"/>'),

    /* 状态 / 装饰 */
    spark: S('<path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9z"/><path d="M18.5 16.5 19.2 18.8 21.5 19.5 19.2 20.2 18.5 22.5 17.8 20.2 15.5 19.5 17.8 18.8z"/>'),
    quiz: S('<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 8.5h8"/><path d="M8 12h8"/><path d="M8 15.5h5"/>'),
    world: S('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.2 2.4 3.4 5.4 3.4 8.5s-1.2 6.1-3.4 8.5c-2.2-2.4-3.4-5.4-3.4-8.5S9.8 5.9 12 3.5z"/>'),
    key: S('<circle cx="8" cy="14" r="4"/><path d="m11 11 8-8"/><path d="m16.5 5.5 2 2"/><path d="m14 8 2 2"/>'),
    link: S('<path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.4 1.4"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.4-1.4"/>'),
    user: S('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.8 20c.9-3.6 3.7-5.6 7.2-5.6s6.3 2 7.2 5.6"/>'),
    bot: S('<rect x="4" y="7.5" width="16" height="12" rx="3"/><path d="M12 3.5v4"/><circle cx="9" cy="13" r="1.2"/><circle cx="15" cy="13" r="1.2"/><path d="M10 16.6h4"/>'),
    chevronDown: S('<path d="m6 9.5 6 6 6-6"/>'),
    chevronRight: S('<path d="m9.5 6 6 6-6 6"/>'),
    empty: S('<path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z"/><path d="m4 8.5 8 4.5 8-4.5"/><path d="M12 13v7"/>'),
});

/** 取一个图标;名字打错时返回空串而不是 undefined —— 免得模板里插出 "undefined" */
export function icon(name) {
    return ICONS[name] || '';
}

/**
 * 桌面图标。
 *
 * ★ 这是本 App 里**唯一**一处写死颜色的地方,而且是必要的:
 *   桌面的 `.appIcon` 在 `.app-shell` 外面,拿不到 `--pl-*`,
 *   而图标里的 `currentColor` 会继承桌面的浅色文字 —— 浅色描边画在
 *   近白色的 `iconBg` 上等于隐形。所以这里给一个显式描边色。
 *   (`iconBg` 本身也是 appConfig 上的 hex,项目里每个 App 都这么写。)
 */
export function desktopIcon() {
    return `<svg viewBox="0 0 60 60" style="width:130%;height:130%;"><defs><linearGradient id="plBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFB6D9"/><stop offset="50%" stop-color="#FF8FAB"/><stop offset="100%" stop-color="#FF7AA2"/></linearGradient></defs><rect width="60" height="60" rx="15" fill="url(#plBg)"/><g transform="translate(2,-2) rotate(-15, 48, 46) scale(1.3)"><rect x="8" y="4" width="34" height="44" rx="4" fill="#FFF"/><line x1="15" y1="16" x2="35" y2="16" stroke="#FF8FAB" stroke-width="2.2" stroke-linecap="round"/><line x1="15" y1="23" x2="32" y2="23" stroke="#FFB6D9" stroke-width="2.2" stroke-linecap="round"/><line x1="15" y1="30" x2="28" y2="30" stroke="#FFB6D9" stroke-width="2.2" stroke-linecap="round"/></g></svg>`;
}
