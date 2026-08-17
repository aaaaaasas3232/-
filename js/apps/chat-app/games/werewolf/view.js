/**
 * 狼人杀 / 视图
 *
 * 纯函数：session 进，四块 HTML 出。不订阅、不绑事件、不 querySelector。
 * 所有交互走 `data-app-action` → chat-app method → 引擎。
 *
 * ★ 原型的界面在这里有个结构性问题：**没有座位图**。
 *   身份只在「游戏信息」弹窗里以纯文本列出，白天要推谁得先点开弹窗
 *   记住谁是几号，再关掉弹窗回来看发言。抽出 `seat-strip` 之后
 *   座位一直挂在顶部，这一步白捡。
 */

import { escapeHtml, panel, buttonRow, textInput, keyValue, thinking } from '../components/ui.js';
import { seatStrip, targetPicker } from '../components/seat-strip.js';
import { phaseBar, errorBanner } from '../components/game-shell.js';
import { resultPanel, roleCard, voteBoard } from '../components/result-panel.js';
import { alivePlayers, aliveExcept, getPlayer, userPlayer } from '../core/players.js';
import { roleOf, roleName, TEAMS } from './rules.js';
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
        tone: 'blue',
        viewerId: session.godMode ? '' : (me?.id || ''),
        title: '狼人杀',
        subtitle: session.setup?.configName || '',
        right: rightSlot(session),
        head: renderHead(session, me),
        action: renderAction(session, me),
    };
}

// ---------------------------------------------------------------------------

function rightSlot(session) {
    const alive = alivePlayers(session).length;
    return `<span class="cg-topbar__tag">存活 ${alive}/${session.players.length}</span>`;
}

function renderHead(session, me) {
    const parts = [];

    parts.push(phaseBar({
        round: session.round,
        phase: session.phaseLabel || '准备中',
        extra: session.settled ? '已分胜负' : (session.busy?.label || ''),
        tone: session.phase === PHASES.NIGHT ? 'night' : 'day',
    }));

    // 身份卡：只有本人看得到自己的牌
    if (session.godMode) {
        parts.push(roleCard({ hidden: true }));
    } else if (me) {
        const role = roleOf(me.role);
        parts.push(roleCard({
            label: me.alive ? `你的身份 · ${me.seat}号` : `你的身份 · ${me.seat}号（已出局）`,
            name: role.name,
            desc: role.desc,
            tone: role.team === TEAMS.WOLF ? 'wolf' : 'village',
            extra: renderMyExtra(session, me),
        }));
    }

    parts.push(seatStrip(session.players, {
        activeId: currentSpeakerId(session),
        sub: (p) => seatSub(session, p, me),
        badge: (p) => ((session.lovers || []).includes(p.id) ? '♥' : ''),
    }));

    if (session.busy?.label) parts.push(thinking(session.busy.label));
    parts.push(errorBanner(session));

    if (session.phase === PHASES.VOTE && session.day?.tally?.length) {
        parts.push(panel({
            title: '票型',
            body: voteBoard(session.day.tally.map((t) => ({
                target: { name: t.name },
                count: t.count,
            })), { showVoters: false }),
            compact: true,
        }));
    }

    return parts.filter(Boolean).join('');
}

/** 身份卡下面那一小块：狼队友 / 查验记录 / 药剩几瓶。 */
function renderMyExtra(session, me) {
    if (!me) return '';
    const rows = [];
    if (roleOf(me.role).team === TEAMS.WOLF) {
        const mates = (session.players || [])
            .filter((p) => p.id !== me.id && roleOf(p.role).team === TEAMS.WOLF)
            .map((p) => `${p.seat}号${p.name}${p.alive ? '' : '(出局)'}`);
        rows.push({ k: '狼队友', v: mates.join('、') || '只有你一个' });
    }
    if (me.role === 'seer') {
        const checks = (session.seerChecks || []).filter((c) => c.seerId === me.id);
        rows.push({
            k: '查验记录',
            v: checks.length ? checks.map((c) => `${c.targetName}=${c.isWolf ? '狼' : '好'}`).join('、') : '还没查过',
        });
    }
    if (me.role === 'witch') {
        rows.push({ k: '解药', v: session.witch?.antidoteUsed ? '已用' : '还有' });
        rows.push({ k: '毒药', v: session.witch?.poisonUsed ? '已用' : '还有' });
    }
    if (me.role === 'guard' && session.lastGuarded) {
        rows.push({ k: '昨晚守', v: getPlayer(session, session.lastGuarded)?.name || '' });
    }
    if ((session.lovers || []).length === 2 && session.lovers.includes(me.id)) {
        const other = session.lovers.find((id) => id !== me.id);
        rows.push({ k: '你的情侣', v: getPlayer(session, other)?.name || '' });
    }
    return rows.length ? keyValue(rows) : '';
}

/** 座位下面那行小字。上帝视角揭身份，玩家视角只显示存活。 */
function seatSub(session, p, me) {
    if (session.godMode || session.settled) return roleName(p.role);
    if (me && p.id === me.id) return roleName(p.role);
    // 狼人互相认识
    if (me && roleOf(me.role).team === TEAMS.WOLF && roleOf(p.role).team === TEAMS.WOLF) return '狼队友';
    const check = (session.seerChecks || []).find((c) => c.seerId === me?.id && c.targetId === p.id);
    if (check) return check.isWolf ? '查杀' : '金水';
    return p.alive ? '' : '出局';
}

function currentSpeakerId(session) {
    if (session.phase !== PHASES.SPEECH) return '';
    const order = session.day?.order || [];
    return order[session.day?.index ?? -1] || '';
}

// ---------------------------------------------------------------------------
// 操作区
// ---------------------------------------------------------------------------

function renderAction(session, me) {
    if (session.error) {
        return buttonRow([
            { label: '重试这一步', method: M.RETRY, tone: 'primary', block: true },
            { label: '放弃这一局', method: M.ABORT, tone: 'danger' },
        ]);
    }

    if (session.settled && session.phase === PHASES.REVIEW) return renderReview(session, me);
    if (session.settled) return renderSettled(session);

    const pending = session.pending;
    if (!pending) {
        return `<div class="cg-waiting">${escapeHtml(session.busy?.label || waitLabel(session))}</div>`;
    }

    switch (pending.action) {
        case ACTIONS.CUPID: return renderCupid(session);
        case ACTIONS.GUARD: return renderGuard(session, me);
        case ACTIONS.WOLF: return renderWolf(session, me);
        case ACTIONS.WITCH: return renderWitch(session, me);
        case ACTIONS.SEER: return renderSeer(session, me);
        case ACTIONS.SPEECH: return renderSpeech(session);
        case ACTIONS.VOTE: return renderVote(session, me);
        case ACTIONS.LAST_WORDS: return renderLastWords(session);
        case ACTIONS.HUNTER: return renderHunter(session);
        default: return '';
    }
}

function waitLabel(session) {
    if (session.phase === PHASES.NIGHT) return '天黑了，其他人正在行动…';
    if (session.phase === PHASES.SPEECH) return '其他人正在发言…';
    if (session.phase === PHASES.VOTE) return '等待其他人投票…';
    return '游戏进行中…';
}

function renderCupid(session) {
    const selected = session.uiSelection || [];
    return targetPicker({
        title: '丘比特：选两个人连成情侣',
        hint: '情侣一死俱死；如果最后只剩他们两个，情侣直接获胜',
        players: session.players,
        method: 'gameSelectPlayer',
        selectedIds: selected,
        footer: buttonRow([{
            label: selected.length === 2 ? '就这两个人' : `还要再选 ${2 - selected.length} 个`,
            method: selected.length === 2 ? M.ACTION : '',
            payload: { action: ACTIONS.CUPID, playerIds: selected },
            tone: 'primary', block: true, disabled: selected.length !== 2,
        }]),
    });
}

function renderGuard(session, me) {
    const banned = session.lastGuarded;
    return targetPicker({
        title: '守卫：今晚守谁',
        hint: banned ? `昨晚守过 ${getPlayer(session, banned)?.name || ''}，今晚不能重复` : '守中了就能挡下狼人的刀',
        players: alivePlayers(session),
        method: M.ACTION,
        payload: { action: ACTIONS.GUARD },
        disabled: (p) => p.id === banned,
        footer: buttonRow([{ label: '今晚不守', method: M.ACTION, payload: { action: ACTIONS.GUARD, playerId: '' }, tone: 'ghost' }]),
    });
}

function renderWolf(session, me) {
    const chatHtml = (session.night?.wolfChat || [])
        .map((c) => `<div class="cg-wolfchat__line"><b>${escapeHtml(getPlayer(session, c.id)?.name || '')}</b>${escapeHtml(c.text)}</div>`)
        .join('');
    return `
        ${chatHtml ? `<div class="cg-wolfchat">${chatHtml}</div>` : ''}
        ${targetPicker({
            title: '狼人：今晚刀谁',
            hint: '可以自刀，但想清楚',
            players: alivePlayers(session),
            method: M.ACTION,
            payload: { action: ACTIONS.WOLF },
            sub: (p) => (roleOf(p.role).team === TEAMS.WOLF ? '队友' : ''),
        })}
    `;
}

function renderWitch(session, me) {
    const victim = getPlayer(session, session.night?.killTarget);
    const canSave = !session.witch?.antidoteUsed && !!victim
        && !(session.setup?.witchNoSelfSaveAfterFirst && session.round > 1 && victim.id === me?.id);
    const canPoison = !session.witch?.poisonUsed;
    const mode = session.uiWitchMode || '';

    if (mode === 'poison' && canPoison) {
        return targetPicker({
            title: '女巫：毒谁',
            hint: '毒药只有一瓶，用了就没了',
            players: aliveExcept(session, me?.id),
            method: M.ACTION,
            payload: { action: ACTIONS.WITCH, kind: 'poison' },
            footer: buttonRow([{ label: '算了，不毒', method: 'gameSetWitchMode', payload: { mode: '' }, tone: 'ghost' }]),
        });
    }

    return panel({
        title: '女巫：用药',
        hint: victim ? `今晚 ${victim.seat}号 ${victim.name} 被刀` : '今晚没有人被刀',
        body: buttonRow([
            canSave ? { label: `救 ${victim.name}`, method: M.ACTION, payload: { action: ACTIONS.WITCH, kind: 'save' }, tone: 'primary' } : null,
            canPoison ? { label: '用毒药', method: 'gameSetWitchMode', payload: { mode: 'poison' }, tone: 'danger' } : null,
            { label: '不用药', method: M.ACTION, payload: { action: ACTIONS.WITCH, kind: 'skip' }, tone: 'ghost' },
        ].filter(Boolean), { wrap: true }),
    });
}

function renderSeer(session, me) {
    const checked = new Set((session.seerChecks || []).filter((c) => c.seerId === me?.id).map((c) => c.targetId));
    return targetPicker({
        title: '预言家：查验谁',
        hint: '查过的人不用再查了',
        players: aliveExcept(session, me?.id),
        method: M.ACTION,
        payload: { action: ACTIONS.SEER },
        disabled: (p) => checked.has(p.id),
        sub: (p) => {
            const c = (session.seerChecks || []).find((x) => x.seerId === me?.id && x.targetId === p.id);
            return c ? (c.isWolf ? '已查·狼' : '已查·好') : '';
        },
    });
}

function renderSpeech(session) {
    return `
        <div class="cg-actbar">
            <div class="cg-actbar__title">轮到你发言</div>
            ${textInput({
                placeholder: '说点什么…可以怀疑谁、可以报身份',
                method: M.ACTION,
                payload: { action: ACTIONS.SPEECH },
                multiline: true,
                sendLabel: '发言',
            })}
            ${buttonRow([{ label: '过（不发言）', method: M.ACTION, payload: { action: ACTIONS.SPEECH, text: '' }, tone: 'ghost' }])}
        </div>
    `;
}

function renderVote(session, me) {
    return targetPicker({
        title: '投票放逐',
        hint: '票数最多的人出局；平票则无人出局',
        players: aliveExcept(session, me?.id),
        method: M.ACTION,
        payload: { action: ACTIONS.VOTE },
        footer: buttonRow([{ label: '弃票', method: M.ACTION, payload: { action: ACTIONS.VOTE, playerId: '' }, tone: 'ghost' }]),
    });
}

function renderLastWords(session) {
    return `
        <div class="cg-actbar">
            <div class="cg-actbar__title">你出局了，留句遗言</div>
            ${textInput({
                placeholder: '最后想说的话…',
                method: M.ACTION,
                payload: { action: ACTIONS.LAST_WORDS },
                multiline: true,
                sendLabel: '说完了',
            })}
            ${buttonRow([{ label: '不说了', method: M.ACTION, payload: { action: ACTIONS.LAST_WORDS, text: '' }, tone: 'ghost' }])}
        </div>
    `;
}

function renderHunter(session) {
    return targetPicker({
        title: '猎人开枪',
        hint: '你可以带走一个人',
        players: alivePlayers(session),
        method: M.ACTION,
        payload: { action: ACTIONS.HUNTER },
        footer: buttonRow([{ label: '不开枪', method: M.ACTION, payload: { action: ACTIONS.HUNTER, playerId: '' }, tone: 'ghost' }]),
    });
}

function renderReview(session, me) {
    return `
        <div class="cg-actbar">
            ${textInput({
                placeholder: '聊聊这一局…',
                method: M.ACTION,
                payload: { action: ACTIONS.REVIEW },
                sendLabel: '说',
            })}
            ${buttonRow([
                { label: '结束对局', method: M.FINISH, tone: 'primary' },
            ])}
        </div>
    `;
}

function renderSettled(session) {
    return buttonRow([{ label: '结束对局', method: M.FINISH, tone: 'primary', block: true }]);
}

/** 结算屏（`gameFinish` 之后，对局页变成这个）。 */
export function buildResult(session) {
    const me = userPlayer(session);
    const outcome = !me ? 'draw' : (me.win ? 'win' : 'lose');
    return resultPanel({
        title: session.result?.winnerLabel || '对局结束',
        summary: session.result?.highlights?.join('　') || '',
        outcome,
        players: session.players,
        stats: [
            { k: '轮数', v: session.round },
            { k: '时长', v: `${Math.max(1, Math.round((session.result?.durationMs || 0) / 60000))} 分钟` },
            { k: '存活', v: alivePlayers(session).length },
        ],
        actions: [
            { label: '返回群聊', method: 'closeGamePage', tone: 'primary' },
        ],
    });
}
