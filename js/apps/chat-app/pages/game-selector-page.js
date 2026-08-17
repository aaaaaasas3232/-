/**
 * chat-app / 游戏大厅
 *
 * ★ 这一页之前是个壳：点游戏卡片只会 `__chatContextMode.setMode('game')`
 *   然后弹个「已进入游戏模式」的岛就关掉了 —— 不会开任何一局。
 *   现在点卡片是真的进设置页开局。
 *
 * 顺带修的两处：
 *   1. 原来的卡片交互是 `initGameSelectorPage()` 里 `addEventListener('click')`。
 *      那是在 `queueMicrotask` 里绑的，比框架 `mountInto` 早，绑到的是**上一次**
 *      的节点，随后 innerHTML 一换就全死了（chat-app v0.48 踩过同款）。
 *      现在全部走 `data-app-action`，框架顶层委托，不存在绑不上的问题。
 *   2. 原来的颜色是内联 `style="background:linear-gradient(...)"` 写死的。
 *      改成 `data-tone`，色值在 `_chat-game.css` 里，换皮时跟着走。
 */

import { escapeHtml } from '@/src/core/escape.js';
import { act, detailAct } from '../games/components/ui.js';
import { listGames, getRunningGame, GAME_META } from '../games/index.js';

const ICONS = {
    werewolf: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-1.94 0-3.64.85-4.5 2.14-.42-.08-.85-.14-1.3-.14C3.01 5 1 7.01 1 9.5c0 1.12.4 2.14 1.06 2.93C1.4 13.52 1 15.23 1 17c0 2.76 2.24 5 5 5 .7 0 1.36-.14 1.97-.4.91.26 1.93.4 3.03.4s2.12-.14 3.03-.4c.61.26 1.27.4 1.97.4 2.76 0 5-2.24 5-5 0-1.77-.4-3.48-1.06-4.57.66-.79 1.06-1.81 1.06-2.93 0-2.49-2.01-4.5-4.2-4.5-.45 0-.88.06-1.3.14C15.64 3.85 13.94 3 12 3zm-4 5c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm8 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-4 8c-2 0-3.5-1.5-3.5-3h7c0 1.5-1.5 3-3.5 3z"/></svg>`,
    undercover: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`,
    monopoly: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9C6.67 9 6 8.33 6 7.5S6.67 6 7.5 6 9 6.67 9 7.5 8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9z"/></svg>`,
    board: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 21H2V9h5.5v12zm7.25-18h-5.5v18h5.5V3zM22 11h-5.5v10H22V11z"/></svg>`,
    arrow: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>`,
    wand: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 5.6 5 7l1.4-2.5L5 2l2.5 1.4L10 2 8.6 4.5 10 7 7.5 5.6zM19 15l-1.5 2.6L15 19l2.5 1.4L19 23l1.4-2.6L23 19l-2.6-1.4L19 15zM11.3 8.1l4.6 4.6L6.4 22.2l-4.6-4.6L11.3 8.1zm0 2.83L4.63 17.6l1.77 1.77 6.67-6.67-1.77-1.77z"/></svg>`,
};

/**
 * @param {object} app
 * @param {string} groupId 从哪个群进来的。没有 groupId 就只能看排行榜。
 */
export function renderGameSelectorPage(app, groupId = '') {
    const running = groupId ? getRunningGame(groupId) : null;

    const resumeCard = running ? `
        <button type="button" class="cg-lobby-card is-resume" data-tone="${escapeHtml(GAME_META[running.gameId]?.tone || 'blue')}"
                ${detailAct(`game-play-${groupId}`)}>
            <span class="cg-lobby-card__icon">${ICONS[running.gameId] || ICONS.board}</span>
            <span class="cg-lobby-card__main">
                <span class="cg-lobby-card__name">继续 · ${escapeHtml(GAME_META[running.gameId]?.name || '对局')}</span>
                <span class="cg-lobby-card__desc">${escapeHtml(running.phaseLabel || '进行中')}${running.unread ? ` · ${running.unread} 条待处理` : ''}</span>
                <span class="cg-lobby-card__tag">第 ${running.round} 轮</span>
            </span>
            <span class="cg-lobby-card__arrow">${ICONS.arrow}</span>
        </button>
    ` : '';

    const gameCards = listGames().map((meta) => {
        // 已经有一局在跑的时候，开新局会顶掉它 —— 先让用户知道
        const warn = running && running.gameId !== meta.id ? '会结束当前这一局' : '';
        return `
            <button type="button" class="cg-lobby-card" data-tone="${escapeHtml(meta.tone)}"
                    ${groupId ? detailAct(`game-setup-${meta.id}-${groupId}`) : ''}
                    ${groupId ? '' : 'disabled'}>
                <span class="cg-lobby-card__icon">${ICONS[meta.id] || ICONS.board}</span>
                <span class="cg-lobby-card__main">
                    <span class="cg-lobby-card__name">${escapeHtml(meta.name)}${meta.custom ? '<em class="cg-lobby-card__badge">自制</em>' : ''}</span>
                    <span class="cg-lobby-card__desc">${escapeHtml(warn || meta.desc)}</span>
                    <span class="cg-lobby-card__tag">${escapeHtml(meta.tag)}</span>
                </span>
                <span class="cg-lobby-card__arrow">${ICONS.arrow}</span>
            </button>
        `;
    }).join('');

    return `
        <div class="cg-lobby">
            <header class="cg-topbar">
                <button type="button" class="cg-topbar__back" aria-label="返回" ${act('closeDetail')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <div class="cg-topbar__copy"><div class="cg-topbar__title">小游戏</div></div>
                <div class="cg-topbar__right"></div>
            </header>

            <div class="cg-lobby__body">
                ${resumeCard}
                ${!groupId ? `<div class="cg-lobby__note">从群聊的工具栏进来才能开局</div>` : ''}
                ${gameCards}
                <button type="button" class="cg-lobby-card is-board" data-tone="violet" ${detailAct('game-leaderboard')}>
                    <span class="cg-lobby-card__icon">${ICONS.board}</span>
                    <span class="cg-lobby-card__main">
                        <span class="cg-lobby-card__name">战绩排行榜</span>
                        <span class="cg-lobby-card__desc">胜率、场次、各角色数据</span>
                    </span>
                    <span class="cg-lobby-card__arrow">${ICONS.arrow}</span>
                </button>

                <button type="button" class="cg-lobby-card is-maker" data-tone="amber"
                        ${detailAct(groupId ? `game-maker-${groupId}` : 'game-maker')}>
                    <span class="cg-lobby-card__icon">${ICONS.wand}</span>
                    <span class="cg-lobby-card__main">
                        <span class="cg-lobby-card__name">做一个新游戏</span>
                        <span class="cg-lobby-card__desc">出提示词让 AI 写玩法，上传后每个群都能玩</span>
                    </span>
                    <span class="cg-lobby-card__arrow">${ICONS.arrow}</span>
                </button>
            </div>
        </div>
    `;
}

export default renderGameSelectorPage;
