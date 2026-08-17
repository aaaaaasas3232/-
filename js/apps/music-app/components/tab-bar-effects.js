/**
 * music-app · components/tab-bar-effects.js
 * 步骤 9 — 动态底部导航栏(music 自绘,framework 的 .app-nav 在 music app 内已被显式关闭)
 *
 * 输出的 DOM 结构(逐字符匹配截图):
 *   <div class="app-tab-bar music-dynamic-tabbar" data-tab="<activeIndex>" style="">
 *     <div class="music-tabbar-bg"> ×3 wave
 *     <div class="music-tabbar-notes"> ×5 note
 *     <div class="music-tab-indicator"> inner
 *     <div class="app-tab-item" data-index="0"> …<span>首页</span>
 *     … 4 个
 *   </div>
 *
 * 视觉:
 *   - 选中 tab 上浮 + 粉色主题
 *   - 切 tab 时粉色 indicator 滑动
 *   - 播放中:wave 加速 + active icon 律动 + 音符浮现
 *   - 点击波纹
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';

/**
 * 4 个 tab 配置(顺序固定为:首页 / 一起听 / 发现 / 我的)
 */
const TABS = [
    { id: 'home',             label: '首页',   icon: 'home' },
    { id: 'listen-together',  label: '一起听', icon: 'users' },
    { id: 'discover',         label: '发现',   icon: 'search' },
    { id: 'me',               label: '我的',   icon: 'user' },
];

// 播放中从底栏飘上来的音符。原来直接写 ♪ ♫ 字符，各平台字体不一样，
// Windows 上会退化成方框，而且属于「界面里的表情符号」。改成 SVG 到哪都一样。
const NOTE_SINGLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';
const NOTE_DOUBLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 3l-10 2v10.28c-.6-.34-1.28-.53-2-.53-2.21 0-4 1.57-4 3.5S5.79 21.75 8 21.75s4-1.57 4-3.5V8.09l6-1.2v6.19c-.6-.34-1.28-.53-2-.53-2.21 0-4 1.57-4 3.5s1.79 3.5 4 3.5 4-1.57 4-3.5V3z"/></svg>';

/**
 * 渲染 music 自己的底部动态 tab bar。
 * @param {Object} app        music app 实例
 * @param {string} activeTab  当前 root page id(默认 'home')
 * @param {boolean} isPlaying 是否在播放中
 */
export function renderTabBar(app, activeTab = 'home', isPlaying = false) {
    const appId = app?.id || 'music';
    const safeActive = TABS.some((t) => t.id === activeTab) ? activeTab : 'home';
    const activeIndex = TABS.findIndex((t) => t.id === safeActive);
    const clampedIndex = activeIndex >= 0 ? activeIndex : 0;

    return `
        <div class="app-tab-bar music-dynamic-tabbar ${isPlaying ? 'playing' : ''}"
             data-tab="${clampedIndex}"
             style=""
             data-app-id="${escapeHtml(appId)}">
            <div class="music-tabbar-bg">
                <div class="music-tabbar-wave"></div>
                <div class="music-tabbar-wave"></div>
                <div class="music-tabbar-wave"></div>
            </div>
            <div class="music-tabbar-notes">
                <span class="music-note" style="left:10%;animation-delay:0s;">${NOTE_SINGLE}</span>
                <span class="music-note" style="left:30%;animation-delay:0.5s;">${NOTE_DOUBLE}</span>
                <span class="music-note" style="left:50%;animation-delay:1s;">${NOTE_SINGLE}</span>
                <span class="music-note" style="left:70%;animation-delay:1.5s;">${NOTE_DOUBLE}</span>
                <span class="music-note" style="left:90%;animation-delay:2s;">${NOTE_SINGLE}</span>
            </div>
            <div class="music-tab-indicator">
                <div class="music-tab-indicator-inner"></div>
            </div>
            ${TABS.map((t, i) => `
                <div class="app-tab-item ${t.id === safeActive ? 'active' : ''}"
                     data-index="${i}"
                     data-tab-id="${escapeHtml(t.id)}"
                     ${createActionAttr({
                         action: 'switchPage',
                         appId,
                         pageId: t.id,
                     }, appId)}>
                    <span class="tab-icon">${renderTabIcon(t.icon)}</span>
                    <span>${escapeHtml(t.label)}</span>
                </div>
            `).join('')}
        </div>
    `.trim();
}

/**
 * 和 framework 风格保持一致的 outlined SVG icon(uncolored,fill 由 CSS 控制)
 */
function renderTabIcon(name) {
    switch (name) {
        case 'home':
            return `<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"></path></svg>`;
        case 'users':
            return `<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"></path></svg>`;
        case 'search':
            return `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path></svg>`;
        case 'user':
            return `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>`;
        default:
            return '';
    }
}

/**
 * 计算并设置 indicator 的 left/width(照搬原版 music-app.js 的逻辑)
 *  - 取 active tab 的中心 - bar 的 left
 *  - width = min(tabWidth - 16, 70)
 * 如果没传参,自动查 `.app-shell[data-app-id="music"] .music-dynamic-tabbar` 和 `.app-tab-item.active` 索引
 */
export function moveTabIndicator(tabBar, tabIndex) {
    if (!tabBar) {
        tabBar = document.querySelector('.app-shell[data-app-id="music"] .music-dynamic-tabbar');
    }
    if (!tabBar) return;
    const indicator = tabBar.querySelector('.music-tab-indicator');
    const tabItems = tabBar.querySelectorAll('.app-tab-item');
    if (!indicator || !tabItems.length) return;

    if (typeof tabIndex !== 'number' || tabIndex < 0 || tabIndex >= tabItems.length) {
        // 自动查 active tab
        tabIndex = Array.from(tabItems).findIndex((it) => it.classList.contains('active'));
        if (tabIndex < 0) tabIndex = Number(tabBar.dataset.tab || 0);
    }

    const tabItem = tabItems[tabIndex];
    if (!tabItem) return;
    const tabRect = tabItem.getBoundingClientRect();
    const barRect = tabBar.getBoundingClientRect();
    if (!tabRect.width || !barRect.width) return;

    const indicatorWidth = Math.min(tabRect.width - 16, 70);
    const indicatorLeft = tabRect.left - barRect.left + (tabRect.width - indicatorWidth) / 2;

    indicator.style.width = indicatorWidth + 'px';
    indicator.style.left = indicatorLeft + 'px';
}

/**
 * 挂载 tab bar 的交互(指标器位置 + 切换 tab 时重新计算)
 */
export function mountTabBarInteractions(tabBar, activeIndex = 0) {
    if (!tabBar || tabBar.dataset.tabBound === '1') return;
    tabBar.dataset.tabBound = '1';

    // 初始定位(下一帧,等 layout 稳定)
    requestAnimationFrame(() => {
        moveTabIndicator(tabBar, activeIndex);
    });

    // resize 时重新计算
    let resizeTimer = null;
    const onResize = () => {
        if (resizeTimer) cancelAnimationFrame(resizeTimer);
        resizeTimer = requestAnimationFrame(() => {
            const idx = Number(tabBar.dataset.tab || 0);
            moveTabIndicator(tabBar, idx);
        });
    };
    window.addEventListener('resize', onResize);

    // 点击 tab 时重新定位
    const tabItems = tabBar.querySelectorAll('.app-tab-item');
    tabItems.forEach((item, i) => {
        item.addEventListener('click', () => {
            tabBar.dataset.tab = String(i);
            // 让 framework 先 re-render(active class 切换到新 tab),下一帧再定位
            requestAnimationFrame(() => requestAnimationFrame(() => moveTabIndicator(tabBar, i)));
        });
    });
}

/**
 * 把 indicator 拨到当前 active tab。framework 在切换 root page 后会 re-render,
 * 所以这里每次 render 后调用一次;在 hydrate 钩子里挂 MutationObserver 自动调。
 */
