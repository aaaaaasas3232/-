/**
 * 大富翁 / 视图
 *
 * 棋盘用 6×6 网格画外圈 20 格，内圈 4×4 空出来放骰子 —— 跟原型一样，
 * 这个布局在手机竖屏上正好。
 */

import { escapeHtml, panel, buttonRow, textInput, thinking, avatar, hueOf } from '../components/ui.js';
import { phaseBar, errorBanner } from '../components/game-shell.js';
import { resultPanel } from '../components/result-panel.js';
import { renderDiceStage } from '../components/dice-3d.js';
import { getPlayer, userPlayer } from '../core/players.js';
import { BOARD, gridPosition, tileAt } from './board.js';
import {
    formatMoney, netWorth, estatesOf, activePlayers, houseCost, rentOf, MAX_HOUSES,
} from './rules.js';
import { PHASES, ACTIONS } from './engine.js';

const M = {
    ACTION: 'gameUserAction',
    FINISH: 'gameFinish',
    ABORT: 'gameAbort',
    RETRY: 'gameRetryStep',
};

export function buildView(session) {
    const me = userPlayer(session);
    return {
        tone: 'slate',
        viewerId: me?.id || '',
        title: '大富翁',
        subtitle: `第 ${session.round}/${session.maxRounds} 轮`,
        right: me ? `<span class="cg-topbar__tag">${formatMoney(me.money)}</span>` : '',
        head: renderHead(session, me),
        action: renderAction(session, me),
    };
}

function renderHead(session, me) {
    const cur = getPlayer(session, session.currentId);
    return [
        phaseBar({
            round: session.round,
            phase: cur ? `${cur.name}的回合` : '准备中',
            extra: session.settled ? '已结算' : (session.busy?.label || ''),
        }),
        // ★ 骰子放在棋盘中间那块空地里，不是放在棋盘下面。
        //   放下面的话手机上要滚一屏才看得见 —— 而掷骰是每回合都要看的那一下。
        //   棋盘内圈本来就是空的（20 格走外圈），正好是它的位置。
        renderBoard(session),
        renderStandings(session),
        session.busy?.label ? thinking(session.busy.label) : '',
        errorBanner(session),
    ].filter(Boolean).join('');
}

/** 棋盘。 */
function renderBoard(session) {
    const byIndex = new Map();
    for (const p of session.players || []) {
        if (p.bankrupt) continue;
        if (!byIndex.has(p.pos)) byIndex.set(p.pos, []);
        byIndex.get(p.pos).push(p);
    }

    const cells = BOARD.map((tile) => {
        const pos = gridPosition(tile.i);
        const estate = session.estates?.[tile.i];
        const owner = estate?.ownerId ? getPlayer(session, estate.ownerId) : null;
        const pawns = byIndex.get(tile.i) || [];
        const isCurrent = pawns.some((p) => p.id === session.currentId);

        return `
            <div class="cg-cell${isCurrent ? ' is-current' : ''}"
                 data-type="${escapeHtml(tile.type)}"
                 ${tile.group ? `data-group="${escapeHtml(tile.group)}"` : ''}
                 ${owner ? `data-owner-hue="${hueOf(owner.id)}"` : ''}
                 style="grid-column:${pos.x + 1};grid-row:${pos.y + 1}">
                <span class="cg-cell__name">${escapeHtml(tile.name)}</span>
                ${tile.price ? `<span class="cg-cell__price">${tile.price}</span>` : ''}
                ${estate?.houses ? `<span class="cg-cell__houses">${'●'.repeat(estate.houses)}</span>` : ''}
                ${pawns.length ? `<span class="cg-cell__pawns">${pawns.map((p) => `<i data-hue="${hueOf(p.id)}" title="${escapeHtml(p.name)}"></i>`).join('')}</span>` : ''}
            </div>
        `;
    }).join('');

    const center = session.dice
        ? renderDiceStage(session.dice)
        : `<div class="cg-board__hint">${escapeHtml(session.lastCard?.text || '掷骰子开始')}</div>`;
    return `<div class="cg-board">${cells}<div class="cg-board__center">${center}</div></div>`;
}

/** 玩家资产条。 */
function renderStandings(session) {
    const rows = (session.players || []).map((p) => {
        const own = estatesOf(session, p.id);
        return `
            <div class="cg-stand${p.id === session.currentId ? ' is-current' : ''}${p.bankrupt ? ' is-out' : ''}" data-hue="${hueOf(p.id)}">
                ${avatar(p, 28)}
                <div class="cg-stand__main">
                    <div class="cg-stand__name">${escapeHtml(p.name)}${p.isUser ? '（我）' : ''}${p.jailTurns > 0 ? ' · 狱中' : ''}</div>
                    <div class="cg-stand__sub">${own.length} 处地产 · 净资产 ${formatMoney(netWorth(session, p))}</div>
                </div>
                <div class="cg-stand__money">${p.bankrupt ? '破产' : formatMoney(p.money)}</div>
            </div>
        `;
    }).join('');
    return `<div class="cg-stands">${rows}</div>`;
}

// ---------------------------------------------------------------------------

function renderAction(session, me) {
    if (session.error) {
        return buttonRow([
            { label: '重试这一步', method: M.RETRY, tone: 'primary', block: true },
            { label: '放弃这一局', method: M.ABORT, tone: 'danger' },
        ]);
    }
    if (session.settled && session.phase === PHASES.REVIEW) {
        return `
            <div class="cg-actbar">
                ${textInput({ placeholder: '聊聊这一局…', method: M.ACTION, payload: { action: ACTIONS.REVIEW }, sendLabel: '说' })}
                ${buttonRow([{ label: '结束对局', method: M.FINISH, tone: 'primary' }])}
            </div>
        `;
    }
    if (session.settled) {
        return buttonRow([{ label: '结束对局', method: M.FINISH, tone: 'primary', block: true }]);
    }

    const pending = session.pending;
    if (!pending) {
        const cur = getPlayer(session, session.currentId);
        return `<div class="cg-waiting">${escapeHtml(session.busy?.label || `${cur?.name || '对手'}的回合…`)}</div>`;
    }

    if (pending.action === ACTIONS.ROLL) {
        return buttonRow([{ label: '掷骰子', method: M.ACTION, payload: { action: ACTIONS.ROLL }, tone: 'primary', block: true }]);
    }

    if (pending.action === ACTIONS.JAIL) {
        return panel({
            title: '你在监狱里',
            hint: `还要蹲 ${me?.jailTurns || 0} 回合`,
            body: buttonRow([
                { label: '交 500 罚金出狱', method: M.ACTION, payload: { action: ACTIONS.JAIL, choice: 'pay' }, tone: 'primary' },
                { label: '掷骰碰运气（对子出狱）', method: M.ACTION, payload: { action: ACTIONS.JAIL, choice: 'roll' }, tone: 'soft' },
            ], { wrap: true }),
        });
    }

    if (pending.action === ACTIONS.BUY) {
        const tile = tileAt(pending.data?.tileIndex ?? 0);
        return panel({
            title: `买下「${tile.name}」？`,
            hint: `售价 ${formatMoney(tile.price)} · 你有 ${formatMoney(me?.money)}`,
            body: `
                <div class="cg-deal">
                    <div class="cg-deal__row"><span>基础租金</span><b>${formatMoney(rentOf({ ...session, estates: { [tile.i]: { ownerId: 'x' } } }, tile, 7))}</b></div>
                    ${tile.group ? `<div class="cg-deal__row"><span>所属组</span><b>${escapeHtml(tile.group)} 组（集齐翻倍）</b></div>` : ''}
                </div>
                ${buttonRow([
                    { label: '买下', method: M.ACTION, payload: { action: ACTIONS.BUY, buy: true }, tone: 'primary' },
                    { label: '不买', method: M.ACTION, payload: { action: ACTIONS.BUY, buy: false }, tone: 'ghost' },
                ])}
            `,
        });
    }

    if (pending.action === ACTIONS.UPGRADE) {
        const tile = tileAt(pending.data?.tileIndex ?? 0);
        const estate = session.estates?.[tile.i];
        return panel({
            title: `在「${tile.name}」加一栋房？`,
            hint: `造价 ${formatMoney(houseCost(tile))} · 当前 ${estate?.houses || 0}/${MAX_HOUSES} 级`,
            body: buttonRow([
                { label: '加一栋', method: M.ACTION, payload: { action: ACTIONS.UPGRADE, upgrade: true }, tone: 'primary' },
                { label: '这次算了', method: M.ACTION, payload: { action: ACTIONS.UPGRADE, upgrade: false }, tone: 'ghost' },
            ]),
        });
    }

    if (pending.action === ACTIONS.REVIEW) {
        return `
            <div class="cg-actbar">
                ${textInput({ placeholder: '聊聊这一局…', method: M.ACTION, payload: { action: ACTIONS.REVIEW }, sendLabel: '说' })}
                ${buttonRow([{ label: '结束对局', method: M.FINISH, tone: 'primary' }])}
            </div>
        `;
    }
    return '';
}

export function buildResult(session) {
    const me = userPlayer(session);
    return resultPanel({
        title: session.result?.winnerLabel || '对局结束',
        summary: `打了 ${session.round} 轮`,
        outcome: !me ? 'draw' : (me.win ? 'win' : 'lose'),
        players: [...session.players].sort((a, b) => netWorth(session, b) - netWorth(session, a)),
        stats: [
            { k: '轮数', v: session.round },
            { k: '剩余玩家', v: activePlayers(session).length },
        ],
        actions: [{ label: '返回群聊', method: 'closeGamePage', tone: 'primary' }],
    });
}
