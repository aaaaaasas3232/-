/**
 * chat-app / 游戏排行榜页面
 *
 * Phase 11 UI 复原
 *
 * 功能:
 *   - 积分排行榜
 *   - 狼人杀/谁是卧底 胜率数据
 *   - 角色统计
 *
 * 当前阶段:1:1 复原 UI,模拟效果
 */

import { escapeHtml } from '@/src/core/escape.js';

// Demo 排行榜数据
const DEMO_LEADERBOARD = {
    users: [
        {
            id: 'ai-1',
            name: '小美',
            avatarBg: '#FF9ECD',
            totalScore: 2850,
            werewolfGames: 23,
            werewolfWinRate: 0.65,
            undercoverGames: 18,
            undercoverWinRate: 0.72,
            badges: ['狼王', '卧神'],
        },
        {
            id: 'ai-2',
            name: '小明',
            avatarBg: '#A8C8EC',
            totalScore: 2340,
            werewolfGames: 19,
            werewolfWinRate: 0.58,
            undercoverGames: 22,
            undercoverWinRate: 0.55,
            badges: ['预言家'],
        },
        {
            id: 'ai-3',
            name: '小蓝',
            avatarBg: '#B8E6CF',
            totalScore: 1980,
            werewolfGames: 15,
            werewolfWinRate: 0.47,
            undercoverGames: 20,
            undercoverWinRate: 0.65,
            badges: ['平民之光'],
        },
        {
            id: 'user',
            name: '我',
            avatarBg: '#FFD700',
            totalScore: 1650,
            werewolfGames: 12,
            werewolfWinRate: 0.50,
            undercoverGames: 10,
            undercoverWinRate: 0.60,
            badges: [],
        },
    ],
};

// 头像背景色工具
function getAvatarColor(id) {
    const palette = ['#A8C8EC', '#F4A6CD', '#B8D4F0', '#FFD4E5', '#C8E6F4', '#FFC8DD', '#B8E6CF', '#D4B8F0'];
    let hash = 0;
    for (let i = 0; i < (id || '').length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
    }
    return palette[Math.abs(hash) % palette.length];
}

// 渲染排名徽章
function renderRankBadge(rank) {
    if (rank === 1) {
        return `<div class="lb-rank-badge lb-rank-gold">
            <svg viewBox="0 0 24 24" fill="#FFD700" width="20" height="20">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
        </div>`;
    } else if (rank === 2) {
        return `<div class="lb-rank-badge lb-rank-silver">
            <svg viewBox="0 0 24 24" fill="#C0C0C0" width="18" height="18">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
        </div>`;
    } else if (rank === 3) {
        return `<div class="lb-rank-badge lb-rank-bronze">
            <svg viewBox="0 0 24 24" fill="#CD7F32" width="16" height="16">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
        </div>`;
    }
    return `<div class="lb-rank-number">${rank}</div>`;
}

/**
 * 渲染游戏排行榜页面
 *
 * @param {Object} app - app 配置
 * @returns {string} HTML 字符串
 */
export function renderGameLeaderboardPage(app) {
    const users = DEMO_LEADERBOARD.users;

    // 顶部 header
    const headerHtml = `
        <div class="lb-topbar">
            <button class="lb-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                <svg viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="lb-title">积分排行榜</div>
            <div style="width:32px;"></div>
        </div>
    `;

    // 渲染排名列表
    const rankListHtml = users.map((user, index) => {
        const rank = index + 1;
        const rankBadge = renderRankBadge(rank);
        const isCurrentUser = user.id === 'user';
        const badgesHtml = user.badges.map(badge => `
            <span class="lb-badge">${escapeHtml(badge)}</span>
        `).join('');

        return `
            <div class="lb-item ${isCurrentUser ? 'lb-item-current' : ''}" data-user-id="${escapeHtml(user.id)}">
                <div class="lb-rank">${rankBadge}</div>
                <div class="lb-avatar" style="background:${user.avatarBg || getAvatarColor(user.id)};">
                    ${escapeHtml(user.name.charAt(0))}
                </div>
                <div class="lb-info">
                    <div class="lb-name">
                        ${escapeHtml(user.name)}
                        ${badgesHtml}
                    </div>
                    <div class="lb-stats">
                        <span>狼人杀 ${user.werewolfGames}场 ${Math.round(user.werewolfWinRate * 100)}%</span>
                        <span class="lb-stats-sep">·</span>
                        <span>卧底 ${user.undercoverGames}场 ${Math.round(user.undercoverWinRate * 100)}%</span>
                    </div>
                </div>
                <div class="lb-score">
                    <div class="lb-score-value">${user.totalScore}</div>
                    <div class="lb-score-label">积分</div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="lb-page">
            ${headerHtml}
            <div class="lb-content">
                <!-- 前三名展示 -->
                <div class="lb-top3">
                    ${users.slice(0, 3).map((user, index) => {
                        const rank = index + 1;
                        const medals = ['🥇', '🥈', '🥉'];
                        const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                        const isCurrentUser = user.id === 'user';

                        return `
                            <div class="lb-top3-item ${isCurrentUser ? 'lb-top3-current' : ''}" style="--medal-color: ${medalColors[index]};">
                                <div class="lb-top3-avatar" style="background:${user.avatarBg || getAvatarColor(user.id)}; border-color: ${medalColors[index]};">
                                    ${escapeHtml(user.name.charAt(0))}
                                </div>
                                <div class="lb-top3-medal" style="color: ${medalColors[index]};">${medals[index]}</div>
                                <div class="lb-top3-name">${escapeHtml(user.name)}</div>
                                <div class="lb-top3-score">${user.totalScore}</div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- 排名列表 -->
                <div class="lb-list">
                    <div class="lb-list-header">
                        <span>排名</span>
                        <span>玩家</span>
                        <span>积分</span>
                    </div>
                    ${rankListHtml}
                </div>
            </div>
        </div>
    `;
}

export default renderGameLeaderboardPage;
