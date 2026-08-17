/**
 * 谁是卧底 / 视图
 *
 * ★ 原型这一页最大的问题是「我的词」只有顶栏一行小字，而它是整局最重要的信息 ——
 *   用户每轮都要抬头找一次。现在用 `roleCard` 做成一张卡，跟狼人杀的身份卡是同一个组件。
 */

import { escapeHtml, panel, buttonRow, textInput, thinking } from '../components/ui.js';
import { seatStrip, targetPicker } from '../components/seat-strip.js';
import { phaseBar, errorBanner } from '../components/game-shell.js';
import { resultPanel, roleCard, voteBoard } from '../components/result-panel.js';
import { alivePlayers, aliveExcept, userPlayer } from '../core/players.js';
import { PHASES, ACTIONS, TEAMS } from './engine.js';
import { wordTypeLabel } from './words.js';

const M = {
    ACTION: 'gameUserAction',
    FINISH: 'gameFinish',
    ABORT: 'gameAbort',
    RETRY: 'gameRetryStep',
};

export function buildView(session) {
    const me = userPlayer(session);
    return {
        tone: 'pink',
        viewerId: session.godMode ? '' : (me?.id || ''),
        title: '谁是卧底',
        subtitle: `${session.players.length} 人 · 卧底 ${session.spyCount || 1} 人`,
        right: `<span class="cg-topbar__tag">存活 ${alivePlayers(session).length}/${session.players.length}</span>`,
        head: renderHead(session, me),
        action: renderAction(session, me),
    };
}

function renderHead(session, me) {
    const parts = [];
    parts.push(phaseBar({
        round: session.round,
        phase: session.phaseLabel || '准备中',
        extra: session.settled ? '已分胜负' : (session.busy?.label || ''),
        tone: 'day',
    }));

    if (session.godMode) {
        const pair = session.wordPair || {};
        parts.push(panel({
            title: '上帝视角',
            hint: wordTypeLabel(session.setup?.wordType),
            compact: true,
            body: `
                <div class="cg-wordpair">
                    <div class="cg-wordpair__item" data-side="civilian">
                        <span class="cg-wordpair__k">平民词</span>
                        <span class="cg-wordpair__v">${escapeHtml(pair.civilian || '')}</span>
                    </div>
                    <div class="cg-wordpair__item" data-side="undercover">
                        <span class="cg-wordpair__k">卧底词</span>
                        <span class="cg-wordpair__v">${escapeHtml(pair.undercover || '')}</span>
                    </div>
                </div>
            `,
        }));
    } else if (me) {
        parts.push(roleCard({
            label: me.alive ? `你的词 · ${me.seat}号` : `你的词 · ${me.seat}号（已出局）`,
            name: me.word || '',
            desc: '别直接说出这个词，也别说它的字数和偏旁',
            tone: 'word',
        }));
    }

    parts.push(seatStrip(session.players, {
        activeId: session.phase === PHASES.DESCRIBE ? (session.day?.order || [])[session.day?.index ?? -1] : '',
        sub: (p) => {
            if (session.godMode || session.settled) return p.roleLabel;
            if (me && p.id === me.id) return '我';
            return p.alive ? '' : '出局';
        },
    }));

    if (session.busy?.label) parts.push(thinking(session.busy.label));
    parts.push(errorBanner(session));

    if (session.phase === PHASES.VOTE && session.day?.tally?.length) {
        parts.push(panel({
            title: '票型',
            compact: true,
            body: voteBoard(session.day.tally.map((t) => ({ target: { name: t.name }, count: t.count })), { showVoters: false }),
        }));
    }

    return parts.filter(Boolean).join('');
}

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
        return `<div class="cg-waiting">${escapeHtml(session.busy?.label || '其他人正在说…')}</div>`;
    }

    if (pending.action === ACTIONS.DESCRIBE) {
        return `
            <div class="cg-actbar">
                <div class="cg-actbar__title">轮到你描述「${escapeHtml(me?.word || '')}」</div>
                ${textInput({
                    placeholder: '一句话，10-30 字，别说出这个词',
                    method: M.ACTION,
                    payload: { action: ACTIONS.DESCRIBE },
                    sendLabel: '说',
                    maxlength: 60,
                })}
            </div>
        `;
    }

    if (pending.action === ACTIONS.DISCUSS) {
        // 「进入投票」永远可点：走到这个分支说明流程正等着这个人推进
        // （出局的用户根本不会停在这里，见 engine.beginDiscuss）
        return `
            <div class="cg-actbar">
                <div class="cg-actbar__title">自由讨论</div>
                ${me && me.alive
                    ? textInput({
                        placeholder: '说说你怀疑谁…',
                        method: M.ACTION,
                        payload: { action: ACTIONS.DISCUSS },
                        sendLabel: '说',
                        maxlength: 120,
                    })
                    : ''}
                ${buttonRow([{
                    label: '进入投票',
                    method: M.ACTION,
                    payload: { action: ACTIONS.DISCUSS, go: 'vote' },
                    tone: 'primary',
                    block: true,
                }])}
            </div>
        `;
    }

    if (pending.action === ACTIONS.VOTE) {
        return targetPicker({
            title: '投票淘汰',
            hint: '票数最多的人出局；平票会重投一次',
            players: aliveExcept(session, me?.id),
            method: M.ACTION,
            payload: { action: ACTIONS.VOTE },
            footer: buttonRow([{ label: '弃票', method: M.ACTION, payload: { action: ACTIONS.VOTE, playerId: '' }, tone: 'ghost' }]),
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
    const pair = session.wordPair || {};
    return resultPanel({
        title: session.result?.winnerLabel || '对局结束',
        summary: `平民词「${pair.civilian}」 · 卧底词「${pair.undercover}」`,
        outcome: !me ? 'draw' : (me.win ? 'win' : 'lose'),
        players: session.players,
        stats: [
            { k: '轮数', v: session.round },
            { k: '卧底', v: session.players.filter((p) => p.role === TEAMS.UNDERCOVER).length },
            { k: '存活', v: alivePlayers(session).length },
        ],
        actions: [{ label: '返回群聊', method: 'closeGamePage', tone: 'primary' }],
    });
}
