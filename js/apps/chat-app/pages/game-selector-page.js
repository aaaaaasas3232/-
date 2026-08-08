/**
 * chat-app / 游戏选择页面
 *
 * Phase 11 UI 复原
 *
 * 功能:
 *   - 游戏大厅入口
 *   - 狼人杀 / 谁是卧底 / 大富翁游戏卡片
 *   - 积分排行榜入口
 *
 * 当前阶段:1:1 复原 UI,模拟效果
 */

import { escapeHtml } from '@/src/core/escape.js';

/**
 * 渲染游戏选择器页面
 *
 * @param {Object} app - app 配置(framework 注入)
 * @returns {string} HTML 字符串
 */
export function renderGameSelectorPage(app) {
    // 顶部 header
    const headerHtml = `
        <div class="game-selector-topbar">
            <button class="game-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                <svg viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="game-selector-title">小游戏</div>
            <div style="width:32px;"></div>
        </div>
    `;

    // 排行榜入口卡片
    const leaderboardCard = `
        <div class="game-card game-card-leaderboard" id="game-leaderboard"
             data-app-action='{"action":"detail","appId":"chat","pageId":"game-leaderboard"}'>
            <div class="game-card-icon" style="background:linear-gradient(135deg,#E8D6F0,#F5EEFF);">
                <svg viewBox="0 0 24 24" fill="#9B7AA0">
                    <path d="M7.5 21H2V9h5.5v12zm7.25-18h-5.5v18h5.5V3zM22 11h-5.5v10H22V11z"/>
                </svg>
            </div>
            <div class="game-card-content">
                <div class="game-card-name" style="color:#7A5A80;">积分排行榜</div>
                <div class="game-card-desc">查看游戏胜率和角色数据</div>
            </div>
            <svg class="game-card-arrow" viewBox="0 0 24 24" fill="#C9A0DC">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
        </div>
    `;

    // 狼人杀卡片
    const werewolfCard = `
        <div class="game-card game-card-werewolf" id="game-werewolf">
            <div class="game-card-icon" style="background:linear-gradient(135deg,#A8C8EC,#D6E4FF);">
                <svg viewBox="0 0 24 24" fill="#4A6FA5">
                    <path d="M12 3c-1.94 0-3.64.85-4.5 2.14-.42-.08-.85-.14-1.3-.14C3.01 5 1 7.01 1 9.5c0 1.12.4 2.14 1.06 2.93C1.4 13.52 1 15.23 1 17c0 2.76 2.24 5 5 5 .7 0 1.36-.14 1.97-.4.91.26 1.93.4 3.03.4s2.12-.14 3.03-.4c.61.26 1.27.4 1.97.4 2.76 0 5-2.24 5-5 0-1.77-.4-3.48-1.06-4.57.66-.79 1.06-1.81 1.06-2.93 0-2.49-2.01-4.5-4.2-4.5-.45 0-.88.06-1.3.14C15.64 3.85 13.94 3 12 3zm-4 5c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm8 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-4 8c-2 0-3.5-1.5-3.5-3h7c0 1.5-1.5 3-3.5 3z"/>
                </svg>
            </div>
            <div class="game-card-content">
                <div class="game-card-name" style="color:#3A5A80;">狼人杀</div>
                <div class="game-card-desc">经典桌游，考验推理与演技</div>
                <div class="game-card-tag">4-12 人</div>
            </div>
            <svg class="game-card-arrow" viewBox="0 0 24 24" fill="#A8C8EC">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
        </div>
    `;

    // 谁是卧底卡片
    const undercoverCard = `
        <div class="game-card game-card-undercover" id="game-undercover">
            <div class="game-card-icon" style="background:linear-gradient(135deg,#FFD6E0,#FFF0F3);">
                <svg viewBox="0 0 24 24" fill="#E88FAC">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
            </div>
            <div class="game-card-content">
                <div class="game-card-name" style="color:#C76B8F;">谁是卧底</div>
                <div class="game-card-desc">语言描述，找出隐藏的卧底</div>
                <div class="game-card-tag" style="background:#FFF0F3;color:#E88FAC;">3-10 人</div>
            </div>
            <svg class="game-card-arrow" viewBox="0 0 24 24" fill="#FFB3C6">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
        </div>
    `;

    // 大富翁卡片
    const monopolyCard = `
        <div class="game-card game-card-monopoly" id="game-monopoly">
            <div class="game-card-icon" style="background:linear-gradient(135deg,#E8E4E1,#F5F5F5);">
                <svg viewBox="0 0 24 24" fill="#7B8FA1">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9C6.67 9 6 8.33 6 7.5S6.67 6 7.5 6 9 6.67 9 7.5 8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9z"/>
                </svg>
            </div>
            <div class="game-card-content">
                <div class="game-card-name" style="color:#7B8FA1;">大富翁</div>
                <div class="game-card-desc">经典棋盘游戏，掷骰子前进</div>
                <div class="game-card-tag" style="background:#F0F0F0;color:#9BA8B4;">1-4 人 · 飞行棋</div>
            </div>
            <svg class="game-card-arrow" viewBox="0 0 24 24" fill="#b8c0ff">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
        </div>
    `;

    // 更多游戏提示
    const moreGamesHint = `
        <div class="game-more-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="#7A9BBF" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
            </svg>
            <span>更多游戏即将推出...</span>
        </div>
    `;

    return `
        <div class="game-selector-page">
            ${headerHtml}
            <div class="game-selector-content">
                ${leaderboardCard}
                ${werewolfCard}
                ${undercoverCard}
                ${monopolyCard}
                ${moreGamesHint}
            </div>
        </div>
    `;
}

export default renderGameSelectorPage;
