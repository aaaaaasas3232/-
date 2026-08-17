/**
 * 图标
 *
 * 这个 App 之前用的是「⌕ ≡ ◇ ⌄ ●●●」这类文字符号当图标。
 * 文字符号有两个治不好的毛病：
 *   1. 不同系统落到的字体不一样，同一个字符在 Windows 上和 iOS 上宽度、
 *      基线、粗细全不同 —— 对不齐是必然的，不是调 padding 能救的；
 *   2. 它们的粗细跟着字重走，和界面里其它 1.6px 的线条永远搭不上。
 *
 * 所以全部换成同一套 24×24、stroke 1.6、currentColor 的线性图标。
 * 尺寸由外层 CSS 用 width/height 控制，这里不写死。
 */

const wrap = (body, { fill = false } = {}) =>
    `<svg viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}"`
    + ` stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
    /* ── 底部 tab ───────────────────────────────────────────── */

    // 科普：一本摊开的书
    book: wrap('<path d="M12 6.5C10.6 5.2 8.8 4.5 6.7 4.5H4.5v13h2.2c2.1 0 3.9.7 5.3 2 1.4-1.3 3.2-2 5.3-2h2.2v-13h-2.2c-2.1 0-3.9.7-5.3 2Z"/><path d="M12 6.5v13"/>'),

    // 配置：三条带滑块的横线
    sliders: wrap('<path d="M4 7.5h4M12.5 7.5H20M4 16.5h8.5M17 16.5H20"/><circle cx="10.2" cy="7.5" r="2.1"/><circle cx="14.8" cy="16.5" r="2.1"/>'),

    // 助手：对话气泡
    chat: wrap('<path d="M20 12.2c0 3.9-3.6 7-8 7-1 0-2-.2-2.9-.5L4.5 20l1.2-3.5A6.6 6.6 0 0 1 4 12.2c0-3.9 3.6-7 8-7s8 3.1 8 7Z"/>'),

    // 生成：向下的箭头落进托盘
    download: wrap('<path d="M12 4.5v9.5M8.5 10.8 12 14.3l3.5-3.5M5 16v2.2c0 .7.6 1.3 1.3 1.3h11.4c.7 0 1.3-.6 1.3-1.3V16"/>'),

    /* ── 通用 ───────────────────────────────────────────────── */

    search: wrap('<circle cx="11" cy="11" r="6"/><path d="m19 19-3.6-3.6"/>'),
    close: wrap('<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>'),
    check: wrap('<path d="m5 12.5 4.5 4.5L19 7"/>'),
    plus: wrap('<path d="M12 5v14M5 12h14"/>'),
    minus: wrap('<path d="M5 12h14"/>'),
    chevronRight: wrap('<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>'),
    chevronLeft: wrap('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
    chevronDown: wrap('<path d="m5.5 9 6.5 6.5L18.5 9"/>'),
    chevronUp: wrap('<path d="M5.5 15 12 8.5l6.5 6.5"/>'),
    arrowUp: wrap('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    more: wrap('<circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none"/>'),
    menu: wrap('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    settings: wrap('<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6"/>'),
    filter: wrap('<path d="M4.5 6.5h15M7.5 12h9M10.5 17.5h3"/>'),
    user: wrap('<circle cx="12" cy="8.5" r="3.5"/><path d="M5.5 19.5c.6-3.3 3.3-5.2 6.5-5.2s5.9 1.9 6.5 5.2"/>'),
    trash: wrap('<path d="M5 7h14M10 7V5.5h4V7M6.5 7l.8 11.2c0 .7.6 1.3 1.3 1.3h6.8c.7 0 1.3-.6 1.3-1.3L17.5 7"/>'),
    copy: wrap('<rect x="9" y="9" width="10.5" height="10.5" rx="2.6"/><path d="M15 6.2A2.2 2.2 0 0 0 12.8 4H7.2A3.2 3.2 0 0 0 4 7.2v5.6c0 1.2.8 2 2.2 2.2"/>'),
    refresh: wrap('<path d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4"/><path d="M19.5 5v4h-4"/>'),
    question: wrap('<circle cx="12" cy="12" r="8"/><path d="M9.8 9.6a2.3 2.3 0 0 1 4.4.8c0 1.5-2.2 1.9-2.2 3.2"/><circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none"/>'),
    info: wrap('<circle cx="12" cy="12" r="8"/><path d="M12 11.2v5"/><circle cx="12" cy="8.2" r=".9" fill="currentColor" stroke="none"/>'),
    warn: wrap('<path d="M12 4.8 3.6 19h16.8L12 4.8Z"/><path d="M12 10v4"/><circle cx="12" cy="16.6" r=".85" fill="currentColor" stroke="none"/>'),
    sparkle: wrap('<path d="M12 4.5 13.6 9 18 10.5 13.6 12 12 16.5 10.4 12 6 10.5 10.4 9 12 4.5Z"/><path d="M18 16.5 18.7 18.4 20.5 19l-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.6.7-1.9Z"/>'),
    send: wrap('<path d="M19.5 12 5 5.5l2.6 6.5L5 18.5 19.5 12Z"/><path d="M7.6 12h11.9"/>'),

    /* ── 预览里的假状态栏 ───────────────────────────────────── */

    signal: '<svg viewBox="0 0 18 12" fill="currentColor" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>',
    wifi: '<svg viewBox="0 0 18 13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M1 4.6a12 12 0 0 1 16 0"/><path d="M4 7.8a7.6 7.6 0 0 1 10 0"/><path d="M7 11a3.2 3.2 0 0 1 4 0"/></svg>',
    battery: '<svg viewBox="0 0 26 12" fill="none" aria-hidden="true"><rect x="0.6" y="0.6" width="21" height="10.8" rx="3.2" stroke="currentColor" stroke-opacity=".38" stroke-width="1.1"/><rect x="2.4" y="2.4" width="14" height="7.2" rx="2" fill="currentColor"/><path d="M23.4 4.3v3.4a2.1 2.1 0 0 0 0-3.4Z" fill="currentColor" fill-opacity=".38"/></svg>',
};

/** 词典分类图标。key 必须和 glossary.js 里的 group.id 一一对应。 */
export const GROUP_ICONS = {
    // 布局：一格一格的分栏
    layout: wrap('<rect x="4" y="4.5" width="16" height="15" rx="2.6"/><path d="M4 10h16M10 10v9.5"/>'),
    // 弹窗：压在页面上的一层
    modal: wrap('<rect x="3.5" y="6" width="17" height="12" rx="2.6"/><path d="M8 10.5h8M8 13.8h5"/>'),
    // 视图：主屏 + 边上还有一屏
    view: wrap('<rect x="3.5" y="5" width="12" height="14" rx="2.4"/><path d="M18 7.5h2.5v9H18"/>'),
    // 控件：一个开关
    widget: wrap('<rect x="3.5" y="8.5" width="17" height="7" rx="3.5"/><circle cx="9" cy="12" r="2.2"/>'),
    // 视觉：调色盘
    visual: wrap('<path d="M12 4.2c-4.4 0-7.8 3.3-7.8 7.6 0 4.4 3.2 7.4 7 7.4 1.5 0 2.2-.8 2.2-1.7 0-1.3-1.2-1.5-1.2-2.6 0-.8.7-1.4 1.7-1.4h1.6c2.6 0 4.3-1.7 4.3-4.2 0-3-3-5.1-7.8-5.1Z"/><circle cx="8.6" cy="10.4" r="1.05" fill="currentColor" stroke="none"/><circle cx="12" cy="8.2" r="1.05" fill="currentColor" stroke="none"/><circle cx="15.4" cy="10.4" r="1.05" fill="currentColor" stroke="none"/>'),
    // 导航：往前走的箭头
    nav: wrap('<path d="M4 6v12"/><path d="M7.5 12h12M14 6.5l5.5 5.5-5.5 5.5"/>'),
    // 交互：手指点下去
    interaction: wrap('<path d="M9.5 11.4V6.6a1.9 1.9 0 0 1 3.8 0v6.2"/><path d="M13.3 11.2a1.7 1.7 0 0 1 3.4 0v.9"/><path d="M16.7 12.4a1.7 1.7 0 0 1 3.3 0v2.5c0 2.7-2.1 4.9-4.8 4.9h-1.7c-2 0-3.3-.9-4.2-2.5l-2.4-4a1.7 1.7 0 0 1 2.8-1.9l1.1 1.5"/>'),
    // 动效：跳起来的弧线
    animation: wrap('<path d="M4 17c3.6 0 3.6-9.4 7.2-9.4S14.8 17 18.4 17"/><circle cx="4" cy="17" r="1.35" fill="currentColor" stroke="none"/><circle cx="20.4" cy="17" r="1.35" fill="currentColor" stroke="none"/>'),
    // 数据：数据库柱体
    data: wrap('<ellipse cx="12" cy="6.6" rx="7" ry="2.6"/><path d="M5 6.6v10.8c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6.6"/><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6"/>'),
    // 反馈：一颗提示星
    feedback: wrap('<path d="M12 4.5 14 9.4l5.3.4-4 3.5 1.2 5.2L12 15.7l-4.5 2.8 1.2-5.2-4-3.5 5.3-.4L12 4.5Z"/>'),
    // 状态：时钟，表示「此刻处在哪一种情况」
    state: wrap('<circle cx="12" cy="12" r="8"/><path d="M12 7.6V12l2.8 1.8"/>'),
    // 通用概念：积木
    concept: wrap('<path d="M12 3.6 19.5 8v8L12 20.4 4.5 16V8L12 3.6Z"/><path d="M4.5 8 12 12.2 19.5 8M12 12.2v8.2"/>'),
};

/** 找不到就回退到一个中性方块，不返回空串 —— 空图标位比错图标更难看 */
export function groupIcon(id) {
    return GROUP_ICONS[id] || wrap('<rect x="4.5" y="4.5" width="15" height="15" rx="3"/>');
}
