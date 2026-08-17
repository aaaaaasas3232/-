/**
 * 萤火 · 图标
 *
 * 全部 inline SVG（stroke 风格，currentColor），带 width/height，禁 emoji。
 * `icon(name, { size })` 返回字符串，组件里走 v-html（开发者受信任内容）。
 */

const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

const PATHS = {
    // 播放（首页 tab / 封面角标）
    play: `<polygon points="9 6.5 18 12 9 17.5" />`,
    // 信号塔（频道 tab）
    tower: `<path d="M12 9v12" /><circle cx="12" cy="7.5" r="2" /><path d="M7.6 3.6a7 7 0 0 0 0 7.8" /><path d="M16.4 3.6a7 7 0 0 1 0 7.8" /><path d="M9 21h6" />`,
    // 星（收藏）
    star: `<path d="M12 3.6l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z" />`,
    // 信封（消息）
    mail: `<rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="M4.5 7.5l7.5 5.5 7.5-5.5" />`,
    // 用户
    user: `<circle cx="12" cy="8.4" r="3.6" /><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />`,
    users: `<circle cx="9" cy="8.6" r="3.2" /><path d="M2.8 19.4a6.2 6.2 0 0 1 12.4 0" /><path d="M15.4 5.8a3.2 3.2 0 0 1 0 5.7" /><path d="M17.6 13.7a6.2 6.2 0 0 1 3.6 5.7" />`,
    // 刷新
    refresh: `<path d="M20 11a8 8 0 1 0-2.3 6.3" /><path d="M20 5.5V11h-5.5" />`,
    // 返回 / 关闭
    back: `<path d="M14.5 5.5L8 12l6.5 6.5" />`,
    close: `<path d="M6 6l12 12" /><path d="M18 6L6 18" />`,
    chevron: `<path d="M9.5 5.5L16 12l-6.5 6.5" />`,
    // 分享
    share: `<circle cx="6.2" cy="12" r="2.4" /><circle cx="17.4" cy="5.8" r="2.4" /><circle cx="17.4" cy="18.2" r="2.4" /><path d="M8.4 10.9l6.8-3.9" /><path d="M8.4 13.1l6.8 3.9" />`,
    // 点赞
    like: `<path d="M7.5 10.5v9.5" /><path d="M7.5 10.5l3.4-6.8a2 2 0 0 1 3.8 1l-.7 3.8h4.6a2 2 0 0 1 2 2.4l-1.3 6a2 2 0 0 1-2 1.6H7.5" /><path d="M7.5 10.5H4a1 1 0 0 0-1 1V19a1 1 0 0 0 1 1h3.5" />`,
    // 评论
    comment: `<path d="M20 11.6a7.4 7.4 0 0 1-7.7 7.2 8.5 8.5 0 0 1-3-.5L4 20l1.4-4.1a7 7 0 0 1-1-3.7A7.4 7.4 0 0 1 12.3 5 7.4 7.4 0 0 1 20 11.6z" />`,
    // 弹幕
    danmaku: `<rect x="3.5" y="6" width="17" height="12" rx="2.5" /><path d="M7 10h6" /><path d="M10 14h7" />`,
    // 直播点
    live: `<circle cx="12" cy="12" r="3.4" /><path d="M6.6 6.6a7.6 7.6 0 0 0 0 10.8" /><path d="M17.4 6.6a7.6 7.6 0 0 1 0 10.8" />`,
    // 发送
    send: `<path d="M4.5 12L20 4.5 16.4 20l-4.2-5.2L4.5 12z" /><path d="M12.2 14.8L20 4.5" />`,
    plus: `<path d="M12 5v14" /><path d="M5 12h14" />`,
    pen: `<path d="M14.5 5.2l4.3 4.3L8.3 20H4v-4.3z" /><path d="M12.6 7.1l4.3 4.3" />`,
    trash: `<path d="M5 7.2h14" /><path d="M9.5 7V5.4a1.4 1.4 0 0 1 1.4-1.4h2.2a1.4 1.4 0 0 1 1.4 1.4V7" /><path d="M7 7.2l.8 11.4a1.6 1.6 0 0 0 1.6 1.4h5.2a1.6 1.6 0 0 0 1.6-1.4L17 7.2" />`,
    check: `<path d="M5.5 12.6l4.2 4.2 8.8-9.6" />`,
    // 骰子（重 roll）
    reroll: `<path d="M4 8.8a8 8 0 0 1 13.7-3" /><path d="M17.9 2.6v3.5h-3.5" /><path d="M20 15.2a8 8 0 0 1-13.7 3" /><path d="M6.1 21.4v-3.5h3.5" />`,
    // 图库
    image: `<rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.7" /><path d="M4.5 17.5l4.7-4.4 3.4 3 3-2.6 4 3.8" />`,
    // 滑杆（设置）
    sliders: `<path d="M5 7h14" /><circle cx="10" cy="7" r="2" /><path d="M5 12.5h14" /><circle cx="15" cy="12.5" r="2" /><path d="M5 18h14" /><circle cx="8" cy="18" r="2" />`,
    palette: `<path d="M12 3.6a8.4 8.4 0 1 0 0 16.8c1.3 0 1.9-.8 1.9-1.7 0-.8-.5-1.3-.5-2 0-1 .8-1.7 1.9-1.7h1.8a3.3 3.3 0 0 0 3.3-3.3c0-4.5-3.9-8.1-8.4-8.1z" /><circle cx="8" cy="9.4" r="1.1" /><circle cx="12" cy="7.4" r="1.1" /><circle cx="16" cy="9.4" r="1.1" />`,
    doc: `<path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" /><path d="M14 3.5V8h4.5" /><path d="M8.5 12h7" /><path d="M8.5 15.5h7" />`,
    eye: `<path d="M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6z" /><circle cx="12" cy="12" r="2.6" />`,
    // 加好友
    friend: `<circle cx="10" cy="8.4" r="3.4" /><path d="M3.4 20a6.8 6.8 0 0 1 13.2 0" /><path d="M18.5 8v6" /><path d="M15.5 11h6" />`,
    dots: `<circle cx="5.5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18.5" cy="12" r="1.4" />`,
    // 萤火（App 标志：一只小小的光点虫）
    spark: `<circle cx="12" cy="13.6" r="4.6" /><path d="M12 9V5.6" /><path d="M8.6 6.8l1.5 2.3" /><path d="M15.4 6.8l-1.5 2.3" /><circle cx="12" cy="13.6" r="1.2" />`,
    warn: `<path d="M12 4.5l8.6 15H3.4z" /><path d="M12 10v4" /><path d="M12 17.1v.1" />`,
    copy: `<rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M5.5 15V6.5A2 2 0 0 1 7.5 4.5H16" />`,
    save: `<path d="M5 4.5h11l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 19V6a1.5 1.5 0 0 1 1-1.5z" /><path d="M8 4.5V9h7V4.5" /><rect x="8" y="13.5" width="8" height="6" rx="1" />`,
    globe: `<circle cx="12" cy="12" r="8.4" /><path d="M3.6 12h16.8" /><path d="M12 3.6c2.6 2.4 3.9 5.2 3.9 8.4s-1.3 6-3.9 8.4c-2.6-2.4-3.9-5.2-3.9-8.4s1.3-6 3.9-8.4z" />`,
    heart: `<path d="M12 20s-7.3-4.6-9-9.2C1.9 7.6 4 5 6.7 5 8.8 5 10.5 6.2 12 8c1.5-1.8 3.2-3 5.3-3C20 5 22.1 7.6 21 10.8c-1.7 4.6-9 9.2-9 9.2z" />`,
};

/**
 * @param {string} name PATHS 里的键
 * @param {{size?:number}} [opts]
 * @returns {string} SVG 字符串；未知名字返回一个空心圆而不是空串（可见性排错）
 */
export function icon(name, opts = {}) {
    const size = Number(opts.size) || 18;
    const body = PATHS[name] || '<circle cx="12" cy="12" r="8" />';
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" ${STROKE} aria-hidden="true">${body}</svg>`;
}

/** 桌面图标（app-shell 外，颜色不吃 token；暖粉底上一枚深色播放萤） */
export const APP_ICON = `
<svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
    <rect x="4" y="7" width="26" height="20" rx="6" fill="#C4485B"/>
    <polygon points="14.5,12.5 22.5,17 14.5,21.5" fill="#FFF4F0"/>
</svg>`;
