/**
 * chat-app / 战绩排行榜
 *
 * ★ 这一页之前是个空壳：`DEMO_LEADERBOARD.users = []`，永远显示空白。
 *   参考实现里它读的是 `GameStats`，而 `games.js` 根本不在参考包里 ——
 *   点进玩家详情会直接 `GameStats is not defined`。
 *
 *   现在读 `games/core/record.js` 的真实统计（对局正常结束时写入）。
 *   放弃的局不进榜，所以榜上的场次是真的打完的。
 *
 * 分 Tab：总榜 + 三个游戏各一个。细项按游戏不同：
 *   狼人杀 —— 好人局 / 狼人局分别的胜率
 *   谁是卧底 —— 平民 / 卧底分别的胜率
 *   大富翁 —— 破产次数
 */

import { escapeHtml } from '@/src/core/escape.js';
import { act } from '../games/components/ui.js';
import { buildLeaderboard, GAME_META, GAME_IDS } from '../games/index.js';

const TABS = [
    { key: 'all', label: '总榜' },
    { key: GAME_IDS.WEREWOLF, label: '狼人杀' },
    { key: GAME_IDS.UNDERCOVER, label: '谁是卧底' },
    { key: GAME_IDS.MONOPOLY, label: '大富翁' },
];

/** 当前 Tab。纯界面态，不落盘。 */
let activeTab = 'all';

export function setLeaderboardTab(key) {
    activeTab = TABS.some((t) => t.key === key) ? key : 'all';
}

export function renderGameLeaderboardPage() {
    const { rows, history } = buildLeaderboard(activeTab);

    const tabs = TABS.map((t) => `
        <button type="button" class="cg-lbtab${activeTab === t.key ? ' is-on' : ''}"
                ${act('gameLeaderboardTab', { key: t.key })}>${escapeHtml(t.label)}</button>
    `).join('');

    const podium = rows.slice(0, 3).map((r, i) => `
        <div class="cg-podium__item" data-rank="${i + 1}"${r.isUser ? ' data-me="1"' : ''}>
            <span class="cg-podium__av" data-hue="${hue(r.id)}">${escapeHtml((r.name || '?').charAt(0))}</span>
            <span class="cg-podium__name">${escapeHtml(r.name)}</span>
            <span class="cg-podium__wins">${r.wins} 胜</span>
            <span class="cg-podium__rate">${r.winRate}%</span>
        </div>
    `).join('');

    const list = rows.map((r, i) => `
        <div class="cg-lbrow${r.isUser ? ' is-me' : ''}">
            <span class="cg-lbrow__rank" data-rank="${i + 1}">${i + 1}</span>
            <span class="cg-lbrow__av" data-hue="${hue(r.id)}">${escapeHtml((r.name || '?').charAt(0))}</span>
            <span class="cg-lbrow__main">
                <span class="cg-lbrow__name">${escapeHtml(r.name)}</span>
                <span class="cg-lbrow__sub">${escapeHtml(detailText(activeTab, r))}</span>
            </span>
            <span class="cg-lbrow__score">
                <b>${r.winRate}%</b>
                <i>${r.wins}/${r.games}</i>
            </span>
        </div>
    `).join('');

    const historyHtml = history.length ? `
        <section class="cg-panel">
            <header class="cg-panel__head"><span class="cg-panel__title">最近对局</span></header>
            <div class="cg-panel__body">
                ${history.slice(0, 10).map((h) => `
                    <div class="cg-histrow">
                        <span class="cg-histrow__game" data-tone="${escapeHtml(GAME_META[h.gameId]?.tone || 'blue')}">${escapeHtml(GAME_META[h.gameId]?.name || h.gameId)}</span>
                        <span class="cg-histrow__text">${escapeHtml(h.summary || '')}</span>
                        <span class="cg-histrow__time">${formatWhen(h.at)}</span>
                    </div>
                `).join('')}
            </div>
        </section>
    ` : '';

    return `
        <div class="cg-lb">
            <header class="cg-topbar">
                <button type="button" class="cg-topbar__back" aria-label="返回" ${act('closeDetail')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <div class="cg-topbar__copy"><div class="cg-topbar__title">战绩排行榜</div></div>
                <div class="cg-topbar__right"></div>
            </header>

            <div class="cg-lb__tabs">${tabs}</div>

            <div class="cg-lb__body">
                ${rows.length ? `<div class="cg-podium">${podium}</div>` : ''}
                ${rows.length
                    ? `<div class="cg-lblist">${list}</div>`
                    : `<div class="cg-empty">
                            <div class="cg-empty__text">还没有战绩</div>
                            <div class="cg-empty__sub">打完一整局（不是中途退出）之后就会出现在这里</div>
                       </div>`}
                ${historyHtml}
            </div>
        </div>
    `;
}

function detailText(tab, r) {
    const d = r.detail || {};
    if (tab === GAME_IDS.WEREWOLF) {
        const good = `好人 ${d.villageWins || 0}/${d.villageGames || 0}`;
        const wolf = `狼人 ${d.wolfWins || 0}/${d.wolfGames || 0}`;
        return `${good} · ${wolf}`;
    }
    if (tab === GAME_IDS.UNDERCOVER) {
        return `平民 ${d.civilWins || 0}/${d.civilGames || 0} · 卧底 ${d.spyWins || 0}/${d.spyGames || 0}`;
    }
    if (tab === GAME_IDS.MONOPOLY) {
        return `破产 ${d.bankrupt || 0} 次`;
    }
    return `共 ${r.games} 场`;
}

function formatWhen(ts) {
    const diff = Date.now() - (Number(ts) || 0);
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return `${Math.floor(diff / 86400000)} 天前`;
}

function hue(seed) {
    const s = String(seed || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
    return h % 12;
}

export default renderGameLeaderboardPage;
