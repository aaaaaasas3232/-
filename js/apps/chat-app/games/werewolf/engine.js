/**
 * 狼人杀 / 引擎
 *
 * 一个纯状态机：`runStep(session, step)` 读 session、改 session、排下一步。
 * **不碰 DOM，不认识界面**。用户切出去、切回来、甚至刷新页面，
 * 流程都在 `core/clock.js` 的 ticker 上继续往前走。
 *
 * 步骤图（每个箭头都是一次 scheduleStep）：
 *
 *   beginNight ──> nightAction(i) ──…──> resolveNight ──> dawn(i)
 *        ↑                                                   │
 *        │                                              beginSpeech
 *        │                                                   │
 *        │                                               speak(i)
 *        │                                                   │
 *        │                                              beginVote
 *        │                                                   │
 *        │                                              aiVote(i)
 *        │                                                   │
 *        └──────── checkEnd <── resolveVote ─────────────────┘
 *
 * 需要用户操作的地方一律 `awaitUser(session, action)` —— **不排下一步**，
 * 也**不设超时**。用户可以关掉游戏页去跟 AI 聊二十分钟，回来接着点。
 * 这正是原型做不到的：它在这里直接往 `#game-actions` 里塞 HTML，
 * 页面没了就 `TypeError`，整局静默卡死。
 */

import {
    addLog, addEvent, setPhase, settleSession, notifyTurn,
} from '../core/engine.js';
import { writeSession } from '../core/store.js';
import { scheduleStep, awaitUser, clearPending, withBusy } from '../core/clock.js';
import { askAi, cleanSpeech, parseTarget, splitLines } from '../core/ai.js';
import { pickRandom, shuffle, alivePlayers, aliveExcept, getPlayer, userPlayer } from '../core/players.js';
import { WEREWOLF_TIMING as T } from '../core/constants.js';
import {
    ROLES, TEAMS, roleOf, roleName, configFor, dealRoles,
    nightOrderRoles, checkWin, isWinner,
} from './rules.js';
import * as P from './prompts.js';

export const PHASES = Object.freeze({
    NIGHT: 'night',
    DAWN: 'dawn',
    SPEECH: 'day_speech',
    VOTE: 'day_vote',
    ENDED: 'ended',
    REVIEW: 'review',
});

/** 需要用户操作的动作名。界面按这个决定画什么面板。 */
export const ACTIONS = Object.freeze({
    CUPID: 'cupid_link',
    GUARD: 'guard_protect',
    WOLF: 'wolf_kill',
    WITCH: 'witch_action',
    SEER: 'seer_check',
    SPEECH: 'speech',
    VOTE: 'vote',
    LAST_WORDS: 'last_words',
    HUNTER: 'hunter_shoot',
    REVIEW: 'review_chat',
});

// ---------------------------------------------------------------------------
// 建局
// ---------------------------------------------------------------------------

export function setup(session) {
    const config = configFor(session.players.length);
    dealRoles(session.players, config);
    session.setup = { ...(session.setup || {}), configName: config.name, configDesc: config.desc };

    session.night = null;
    session.day = null;
    session.lovers = [];
    session.seerChecks = [];
    session.witch = { antidoteUsed: false, poisonUsed: false };
    session.lastGuarded = '';   // ★ 原型声明了这个字段但从没赋值，连守规则形同虚设
    session.pendingDeaths = [];
    session.reviewSeq = 0;

    addLog(session, { kind: 'system', text: `本局板子：${config.name}（${config.desc}）` });
    addLog(session, {
        kind: 'system',
        text: `座位：${session.players.map((p) => `${p.seat}号 ${p.name}`).join('、')}`,
    });
    if (session.godMode) {
        addLog(session, { kind: 'system', text: '你是上帝，可以看到所有人的身份和暗话。' });
    }
    scheduleStep(session, 'beginNight', T.OPEN);
    return session;
}

// ---------------------------------------------------------------------------
// 步骤分发
// ---------------------------------------------------------------------------

export async function runStep(session, step, payload) {
    const handler = STEPS[step];
    if (!handler) {
        console.warn('[werewolf] 未知步骤', step);
        return;
    }
    await handler(session, payload || {});
}

const STEPS = {
    beginNight,
    nightAction,
    resolveNight,
    dawn,
    beginSpeech,
    speak,
    beginVote,
    aiVote,
    resolveVote,
    hunterShoot,
    afterLastWords,
    checkEnd,
    beginReview,
    reviewLine,
};

// ---------------------------------------------------------------------------
// 夜晚
// ---------------------------------------------------------------------------

function beginNight(session) {
    writeSession(session, (s) => {
        s.round += 1;
        setPhase(s, PHASES.NIGHT, `第 ${s.round} 夜 · 天黑请闭眼`);
        s.night = {
            queue: nightOrderRoles(s),
            index: 0,
            killTarget: '',
            guardTarget: '',
            poisonTarget: '',
            saved: false,
            wolfChat: [],
        };
        scheduleStep(s, 'nightAction', T.NIGHT_STEP, { index: 0 });
    });
}

async function nightAction(session, { index = 0 }) {
    const night = session.night;
    if (!night) return;
    const role = night.queue[index];
    if (!role) {
        writeSession(session, (s) => scheduleStep(s, 'resolveNight', T.NIGHT_RESOLVE));
        return;
    }

    const actors = alivePlayers(session).filter((p) => p.role === role);
    if (!actors.length) {
        writeSession(session, (s) => scheduleStep(s, 'nightAction', T.NIGHT_STEP, { index: index + 1 }));
        return;
    }

    writeSession(session, (s) => {
        s.night.index = index;
        addLog(s, { kind: 'phase', text: `${roleName(role)}请睁眼` });
    });

    // 用户就是这个角色 → 停下来等他。这里**不排下一步**，
    // 所以他离开多久都没关系（原型这里会直接往 DOM 里塞面板然后崩）。
    const me = actors.find((p) => p.isUser);
    if (me) {
        const action = {
            cupid: ACTIONS.CUPID, guard: ACTIONS.GUARD, wolf: ACTIONS.WOLF,
            witch: ACTIONS.WITCH, seer: ACTIONS.SEER,
        }[role];
        writeSession(session, (s) => {
            awaitUser(s, action, { index });
            notifyTurn(s, `${roleName(role)}该行动了`);
        });
        // 狼人局里除了用户还有 AI 狼：先让 AI 狼把想法说出来，用户再定夺
        if (role === 'wolf') await wolfDiscussion(session, actors.filter((p) => !p.isUser));
        return;
    }

    await runAiNightAction(session, role, actors, index);
}

/** AI 独立完成某个角色的夜间动作。 */
async function runAiNightAction(session, role, actors, index) {
    const actor = actors[0];
    const next = () => writeSession(session, (s) => {
        scheduleStep(s, 'nightAction', T.NIGHT_STEP, { index: index + 1 });
    });

    if (role === 'cupid') {
        const pool = shuffle([...session.players]);
        const [a, b] = pool.slice(0, 2);
        applyCupid(session, a.id, b.id);
        next();
        return;
    }

    if (role === 'guard') {
        const candidates = alivePlayers(session).filter((p) => p.id !== session.lastGuarded);
        const last = getPlayer(session, session.lastGuarded);
        const res = await withBusy(session, 'nightAction', `${actor.name}正在守护`, () => askAi({
            session, aiPersonId: actor.id, maxTokens: 60,
            ...P.guardPrompt(session, actor, candidates, last?.name || ''),
        }), { index });
        const target = (res.ok && parseTarget(res.text, candidates)) || pickRandom(candidates);
        applyGuard(session, target?.id || '');
        next();
        return;
    }

    if (role === 'wolf') {
        await wolfDiscussion(session, actors);
        const candidates = alivePlayers(session);
        const leader = actors[0];
        const res = await withBusy(session, 'nightAction', '狼人正在商量', () => askAi({
            session, aiPersonId: leader.id, maxTokens: 120,
            ...P.wolfKillPrompt(session, leader, candidates),
        }), { index });
        const line = pickLine(res.text, '目标');
        const target = (res.ok && parseTarget(line || res.text, candidates))
            || pickRandom(candidates.filter((p) => roleOf(p.role).team !== TEAMS.WOLF))
            || pickRandom(candidates);
        applyWolfKill(session, target?.id || '');
        next();
        return;
    }

    if (role === 'witch') {
        const victim = getPlayer(session, session.night.killTarget);
        const canSave = !session.witch.antidoteUsed && !!victim
            && !(session.setup?.witchNoSelfSaveAfterFirst && session.round > 1 && victim.id === actor.id);
        const canPoison = !session.witch.poisonUsed;
        const candidates = aliveExcept(session, actor.id);
        const res = await withBusy(session, 'nightAction', `${actor.name}正在用药`, () => askAi({
            session, aiPersonId: actor.id, maxTokens: 80,
            ...P.witchPrompt(session, actor, victim, canSave, canPoison, candidates),
        }), { index });
        const decision = parseWitchDecision(res.ok ? res.text : '', canSave, canPoison, candidates);
        applyWitch(session, actor, decision);
        next();
        return;
    }

    if (role === 'seer') {
        const candidates = aliveExcept(session, actor.id)
            .filter((p) => !(session.seerChecks || []).some((c) => c.seerId === actor.id && c.targetId === p.id));
        const pool = candidates.length ? candidates : aliveExcept(session, actor.id);
        const res = await withBusy(session, 'nightAction', `${actor.name}正在查验`, () => askAi({
            session, aiPersonId: actor.id, maxTokens: 40,
            ...P.seerPrompt(session, actor, pool),
        }), { index });
        const target = (res.ok && parseTarget(res.text, pool)) || pickRandom(pool);
        applySeer(session, actor, target?.id || '');
        next();
        return;
    }

    next();
}

/**
 * 狼队友夜话。
 *
 * 上帝视角和狼人自己看得到，别人看不到（`secret: true` + `audience`）。
 * 原型这段是狼人杀里最有意思的部分之一，但它只在「用户是狼」时才跑，
 * 上帝视角下反而看不到 —— 那正是最想看的场景。现在两种都跑。
 */
async function wolfDiscussion(session, wolves) {
    const audience = (session.players || [])
        .filter((p) => roleOf(p.role).team === TEAMS.WOLF)
        .map((p) => p.id);
    for (const w of wolves.slice(0, 3)) {
        const res = await withBusy(session, 'nightAction', `${w.name}正在跟队友商量`, () => askAi({
            session, aiPersonId: w.id, maxTokens: 80,
            ...P.wolfKillPrompt(session, w, alivePlayers(session)),
        }));
        if (!res.ok) continue;
        const reason = pickLine(res.text, '理由') || cleanSpeech(res.text, 40);
        if (!reason) continue;
        writeSession(session, (s) => {
            addLog(s, {
                kind: 'speech', playerId: w.id, text: reason,
                secret: true, data: { audience },
            });
            s.night.wolfChat.push({ id: w.id, text: reason });
        });
    }
}

// ---- 各角色动作落地（用户和 AI 共用，保证两条路径行为一致） ----

export function applyCupid(session, aId, bId) {
    writeSession(session, (s) => {
        s.lovers = [aId, bId];
        const a = getPlayer(s, aId);
        const b = getPlayer(s, bId);
        addLog(s, {
            kind: 'action', text: `丘比特把 ${a?.name} 和 ${b?.name} 连成了情侣`,
            secret: true, data: { audience: [aId, bId] },
        });
        addEvent(s, { type: 'cupid', a: aId, b: bId });
    });
}

export function applyGuard(session, targetId) {
    writeSession(session, (s) => {
        s.night.guardTarget = targetId;
        s.lastGuarded = targetId;
        const t = getPlayer(s, targetId);
        addLog(s, {
            kind: 'action', text: `守卫守护了 ${t?.name || '（放弃）'}`,
            secret: true, data: { audience: alivePlayers(s).filter((p) => p.role === 'guard').map((p) => p.id) },
        });
        addEvent(s, { type: 'guard', targetId, targetName: t?.name || '' });
    });
}

export function applyWolfKill(session, targetId) {
    writeSession(session, (s) => {
        s.night.killTarget = targetId;
        const t = getPlayer(s, targetId);
        addLog(s, {
            kind: 'action', text: `狼人决定刀 ${t?.name || '（空刀）'}`,
            secret: true,
            data: { audience: (s.players || []).filter((p) => roleOf(p.role).team === TEAMS.WOLF).map((p) => p.id) },
        });
        addEvent(s, { type: 'wolfKill', targetId, targetName: t?.name || '' });
    });
}

export function applyWitch(session, actor, decision) {
    writeSession(session, (s) => {
        const audience = [actor.id];
        if (decision.kind === 'save') {
            s.night.saved = true;
            s.witch.antidoteUsed = true;
            addLog(s, { kind: 'action', text: '女巫用了解药', secret: true, data: { audience } });
            addEvent(s, { type: 'witchSave', targetId: s.night.killTarget });
        } else if (decision.kind === 'poison' && decision.targetId) {
            s.night.poisonTarget = decision.targetId;
            s.witch.poisonUsed = true;
            const t = getPlayer(s, decision.targetId);
            addLog(s, { kind: 'action', text: `女巫毒了 ${t?.name || ''}`, secret: true, data: { audience } });
            addEvent(s, { type: 'witchPoison', targetId: decision.targetId, targetName: t?.name || '' });
        } else {
            addLog(s, { kind: 'action', text: '女巫没有用药', secret: true, data: { audience } });
        }
    });
}

export function applySeer(session, actor, targetId) {
    writeSession(session, (s) => {
        const t = getPlayer(s, targetId);
        if (!t) return;
        const isWolf = roleOf(t.role).team === TEAMS.WOLF;
        s.seerChecks.push({ seerId: actor.id, targetId, targetName: t.name, isWolf, round: s.round });
        addLog(s, {
            kind: 'action', text: `预言家查验 ${t.name}：${isWolf ? '狼人' : '好人'}`,
            secret: true, data: { audience: [actor.id] },
        });
        addEvent(s, { type: 'seerCheck', targetId, targetName: t.name, isWolf });
    });
}

function parseWitchDecision(text, canSave, canPoison, candidates) {
    const t = String(text || '');
    if (canSave && /救/.test(t) && !/不救|不用/.test(t)) return { kind: 'save' };
    if (canPoison && /毒/.test(t)) {
        const target = parseTarget(t, candidates);
        if (target) return { kind: 'poison', targetId: target.id };
    }
    return { kind: 'skip' };
}

// ---------------------------------------------------------------------------
// 天亮结算
// ---------------------------------------------------------------------------

function resolveNight(session) {
    const deaths = [];
    writeSession(session, (s) => {
        const night = s.night || {};
        const killed = getPlayer(s, night.killTarget);
        if (killed) {
            const guarded = night.guardTarget && night.guardTarget === night.killTarget;
            const saved = !!night.saved;
            // 同守同救：两个都生效反而死（标准局规则）。原型没有这条，
            // 做成开关是因为不玩标准局的人会觉得这是 bug。
            const bothCancel = !!s.setup?.sameNightGuardSave && guarded && saved;
            if (bothCancel || (!guarded && !saved)) {
                deaths.push({ id: killed.id, cause: 'night' });
            }
        }
        if (night.poisonTarget) deaths.push({ id: night.poisonTarget, cause: 'poison' });

        // 情侣殉情要在主死亡结算之后再算一遍
        const lovers = s.lovers || [];
        if (lovers.length === 2) {
            for (const d of [...deaths]) {
                if (!lovers.includes(d.id)) continue;
                const other = lovers.find((id) => id !== d.id);
                if (other && !deaths.some((x) => x.id === other)) {
                    deaths.push({ id: other, cause: 'lover' });
                }
            }
        }

        for (const d of deaths) killPlayer(s, d.id, d.cause);

        s.pendingDeaths = deaths.map((d) => d.id);
        setPhase(s, PHASES.DAWN, `第 ${s.round} 天 · 天亮了`);
        s.dawnLines = deaths.length
            ? deaths.map((d) => {
                const p = getPlayer(s, d.id);
                return `${p?.seat}号 ${p?.name} 昨晚离开了我们`;
            })
            : ['昨晚是平安夜，没有人死亡'];
        scheduleStep(s, 'dawn', T.DAWN_LINE, { index: 0 });
    });
}

function dawn(session, { index = 0 }) {
    const lines = session.dawnLines || [];
    if (index >= lines.length) {
        // 死者里有猎人 → 先让它开枪，再进发言
        const hunter = (session.pendingDeaths || [])
            .map((id) => getPlayer(session, id))
            .find((p) => p && p.role === 'hunter' && p.canShoot);
        if (hunter) {
            writeSession(session, (s) => scheduleStep(s, 'hunterShoot', 400, { playerId: hunter.id, then: 'beginSpeech' }));
            return;
        }
        writeSession(session, (s) => scheduleStep(s, 'checkEnd', 300, { then: 'beginSpeech' }));
        return;
    }
    writeSession(session, (s) => {
        addLog(s, { kind: 'system', text: lines[index], tone: 'death' });
        scheduleStep(s, 'dawn', T.DAWN_LINE, { index: index + 1 });
    });
}

/**
 * 杀死一个玩家。
 *
 * 猎人能不能开枪在这里定：被毒死不能开（通行规则，原型没有）。
 */
function killPlayer(s, id, cause) {
    const p = getPlayer(s, id);
    if (!p || !p.alive) return;
    p.alive = false;
    p.deathCause = cause;
    p.deathRound = s.round;
    if (p.role === 'hunter') p.canShoot = cause !== 'poison';
    addEvent(s, { type: 'death', playerId: id, playerName: p.name, cause });
}

// ---------------------------------------------------------------------------
// 白天发言
// ---------------------------------------------------------------------------

function beginSpeech(session) {
    writeSession(session, (s) => {
        setPhase(s, PHASES.SPEECH, `第 ${s.round} 天 · 依次发言`);
        s.day = {
            order: alivePlayers(s).sort((a, b) => a.seat - b.seat).map((p) => p.id),
            index: 0,
            votes: {},
        };
        scheduleStep(s, 'speak', T.TO_SPEECH, { index: 0 });
    });
}

async function speak(session, { index = 0 }) {
    const day = session.day;
    if (!day) return;
    const id = day.order[index];
    if (!id) {
        writeSession(session, (s) => scheduleStep(s, 'beginVote', T.TO_VOTE));
        return;
    }
    const player = getPlayer(session, id);
    // 发言途中死掉是不可能的，但轮到时人已经不在（被猎人带走）要跳过
    if (!player || !player.alive) {
        writeSession(session, (s) => scheduleStep(s, 'speak', 200, { index: index + 1 }));
        return;
    }

    writeSession(session, (s) => {
        s.day.index = index;
    });

    if (player.isUser) {
        writeSession(session, (s) => {
            awaitUser(s, ACTIONS.SPEECH, { index });
            notifyTurn(s, '轮到你发言了');
        });
        return;
    }

    const res = await withBusy(session, 'speak', `${player.name}正在发言`, () => askAi({
        session, aiPersonId: player.id, maxTokens: 220,
        ...P.speechPrompt(session, player, day.order),
    }), { index });

    writeSession(session, (s) => {
        const lines = res.ok ? splitLines(res.text, 3) : [];
        if (lines.length) {
            for (const line of lines) addLog(s, { kind: 'speech', playerId: id, text: line });
        } else {
            // AI 没说出来：明确写「过」，不要伪造一句发言塞进去。
            // 原型这里会填「(网络异常，请稍后)」当成玩家真的说了这句话。
            addLog(s, { kind: 'system', text: `${player.name} 选择了过（没有发言）` });
        }
        scheduleStep(s, 'speak', T.NEXT_SPEAKER, { index: index + 1 });
    });
}

// ---------------------------------------------------------------------------
// 投票
// ---------------------------------------------------------------------------

function beginVote(session) {
    writeSession(session, (s) => {
        setPhase(s, PHASES.VOTE, `第 ${s.round} 天 · 投票放逐`);
        s.day.votes = {};
        const me = userPlayer(s);
        if (me && me.alive) {
            awaitUser(s, ACTIONS.VOTE, {});
            notifyTurn(s, '该你投票了');
        }
        scheduleStep(s, 'aiVote', T.VOTE_REVEAL, { index: 0 });
    });
}

async function aiVote(session, { index = 0 }) {
    const voters = alivePlayers(session).filter((p) => !p.isUser);
    const voter = voters[index];
    if (!voter) {
        // AI 都投完了。用户还没投就等着 —— `pending` 还在，
        // 界面上是投票面板，用户回来点一下就继续。
        if (!session.pending) {
            writeSession(session, (s) => scheduleStep(s, 'resolveVote', T.VOTE_REVEAL));
        } else {
            writeSession(session, (s) => { s.day.aiVoteDone = true; });
        }
        return;
    }

    const candidates = aliveExcept(session, voter.id);
    const res = await withBusy(session, 'aiVote', `${voter.name}正在投票`, () => askAi({
        session, aiPersonId: voter.id, maxTokens: 100,
        ...P.votePrompt(session, voter, candidates),
    }), { index });

    const line = pickLine(res.text, '投票');
    const target = (res.ok && parseTarget(line || res.text, candidates)) || pickRandom(candidates);
    const reason = pickLine(res.text, '理由');

    writeSession(session, (s) => {
        s.day.votes[voter.id] = target?.id || '';
        addLog(s, {
            kind: 'vote',
            text: reason
                ? `${voter.name} 投给 ${target?.name || '弃票'}：${reason}`
                : `${voter.name} 投给 ${target?.name || '弃票'}`,
        });
        scheduleStep(s, 'aiVote', T.VOTE_REVEAL, { index: index + 1 });
    });
}

function resolveVote(session) {
    writeSession(session, (s) => {
        const counts = new Map();
        for (const targetId of Object.values(s.day?.votes || {})) {
            if (!targetId) continue;
            counts.set(targetId, (counts.get(targetId) || 0) + 1);
        }
        let top = [];
        let max = 0;
        for (const [id, n] of counts) {
            if (n > max) { max = n; top = [id]; } else if (n === max) top.push(id);
        }

        s.day.tally = [...counts.entries()]
            .map(([id, n]) => ({ id, name: getPlayer(s, id)?.name || '', count: n }))
            .sort((a, b) => b.count - a.count);

        if (!top.length) {
            addLog(s, { kind: 'system', text: '全员弃票，今天没有人被放逐' });
            scheduleStep(s, 'checkEnd', T.VOTE_REVEAL, { then: 'beginNight' });
            return;
        }
        if (top.length > 1) {
            // 平票不加赛：加赛会让一局的长度不可预期，而这个游戏本来就偏长。
            // 原型也是这么处理的。
            addLog(s, {
                kind: 'system',
                text: `平票（${top.map((id) => getPlayer(s, id)?.name).join(' / ')}各 ${max} 票），今天没有人被放逐`,
            });
            scheduleStep(s, 'checkEnd', T.VOTE_REVEAL, { then: 'beginNight' });
            return;
        }

        const outId = top[0];
        const out = getPlayer(s, outId);
        addLog(s, { kind: 'system', text: `${out?.seat}号 ${out?.name} 以 ${max} 票被放逐`, tone: 'death' });
        killPlayer(s, outId, 'vote');
        addEvent(s, { type: 'vote', targetId: outId, targetName: out?.name || '' });
        s.pendingDeaths = [outId];

        // 遗言
        if (out?.isUser) {
            awaitUser(s, ACTIONS.LAST_WORDS, { playerId: outId, cause: 'vote' });
            notifyTurn(s, '你被放逐了，可以留遗言');
        } else {
            scheduleStep(s, 'afterLastWords', T.VOTE_REVEAL, { playerId: outId, cause: 'vote' });
        }
    });
}

async function afterLastWords(session, { playerId, cause }) {
    const player = getPlayer(session, playerId);
    if (player && !player.isUser) {
        const res = await withBusy(session, 'afterLastWords', `${player.name}正在留遗言`, () => askAi({
            session, aiPersonId: player.id, maxTokens: 150,
            ...P.lastWordsPrompt(session, player, cause),
        }), { playerId, cause });
        writeSession(session, (s) => {
            const lines = res.ok ? splitLines(res.text, 2) : [];
            for (const line of lines) addLog(s, { kind: 'speech', playerId, text: line });
            if (!lines.length) addLog(s, { kind: 'system', text: `${player.name} 没有留下遗言` });
        });
    }

    // 猎人开枪
    if (player && player.role === 'hunter' && player.canShoot) {
        writeSession(session, (s) => scheduleStep(s, 'hunterShoot', T.AFTER_LAST_WORDS, { playerId, then: 'beginNight' }));
        return;
    }
    writeSession(session, (s) => scheduleStep(s, 'checkEnd', T.AFTER_LAST_WORDS, { then: 'beginNight' }));
}

async function hunterShoot(session, { playerId, then = 'beginNight' }) {
    const hunter = getPlayer(session, playerId);
    if (!hunter || !hunter.canShoot) {
        writeSession(session, (s) => scheduleStep(s, 'checkEnd', 200, { then }));
        return;
    }
    writeSession(session, (s) => {
        const h = getPlayer(s, playerId);
        if (h) h.canShoot = false;
        addLog(s, { kind: 'phase', text: '猎人翻牌，可以开枪' });
    });

    const candidates = alivePlayers(session);
    if (!candidates.length) {
        writeSession(session, (s) => scheduleStep(s, 'checkEnd', 200, { then }));
        return;
    }

    if (hunter.isUser) {
        // ★ 原型的 restore 分支没有传 callback，导致用户切出去再回来开完枪流程就断了。
        //   现在「开完枪之后干什么」写在 pending.data.then 里，跟着存档一起活。
        writeSession(session, (s) => {
            awaitUser(s, ACTIONS.HUNTER, { then });
            notifyTurn(s, '你是猎人，可以开枪带走一个人');
        });
        return;
    }

    const res = await withBusy(session, 'hunterShoot', `${hunter.name}正在开枪`, () => askAi({
        session, aiPersonId: hunter.id, maxTokens: 40,
        ...P.hunterPrompt(session, hunter, candidates),
    }), { playerId, then });
    const target = (res.ok && parseTarget(res.text, candidates)) || pickRandom(candidates);
    applyHunterShot(session, target?.id || '', then);
}

export function applyHunterShot(session, targetId, then = 'beginNight') {
    writeSession(session, (s) => {
        const t = getPlayer(s, targetId);
        if (t) {
            addLog(s, { kind: 'system', text: `猎人开枪带走了 ${t.seat}号 ${t.name}`, tone: 'death' });
            killPlayer(s, targetId, 'hunter');
            const lovers = s.lovers || [];
            if (lovers.includes(targetId)) {
                const other = lovers.find((id) => id !== targetId);
                if (other && getPlayer(s, other)?.alive) {
                    addLog(s, { kind: 'system', text: `${getPlayer(s, other).name} 殉情了`, tone: 'death' });
                    killPlayer(s, other, 'lover');
                }
            }
        }
        scheduleStep(s, 'checkEnd', 400, { then });
    });
}

// ---------------------------------------------------------------------------
// 胜负 / 复盘
// ---------------------------------------------------------------------------

function checkEnd(session, { then = 'beginNight' }) {
    const win = checkWin(session);
    if (!win) {
        writeSession(session, (s) => scheduleStep(s, then, then === 'beginNight' ? T.TO_NIGHT : T.TO_SPEECH));
        return;
    }
    writeSession(session, (s) => {
        for (const p of s.players) p.win = isWinner(p, win.winner, s);
        const reveal = s.players.map((p) => `${p.seat}号${p.name}=${roleName(p.role)}`).join('、');
        // 只是「分出胜负」—— 对局还留在调度器里跑复盘，
        // 真正结束要等用户点「结束对局」（见 core/engine.js settleSession 的注释）
        settleSession(s, win.winner, `${win.label}。身份：${reveal}`, win.label);
        s.result.highlights = buildHighlights(s);
        scheduleStep(s, 'beginReview', 1200);
    });
}

function buildHighlights(s) {
    const out = [];
    const wolves = s.players.filter((p) => roleOf(p.role).team === TEAMS.WOLF).map((p) => p.name);
    if (wolves.length) out.push(`狼队：${wolves.join('、')}`);
    const seer = s.players.find((p) => p.role === 'seer');
    if (seer) out.push(`预言家是 ${seer.name}`);
    if ((s.lovers || []).length === 2) {
        out.push(`情侣：${s.lovers.map((id) => getPlayer(s, id)?.name).join(' × ')}`);
    }
    return out;
}

function beginReview(session) {
    writeSession(session, (s) => {
        setPhase(s, PHASES.REVIEW, '复盘时间');
        addLog(s, { kind: 'system', text: '身份已全部公开，可以聊聊这一局' });
        s.reviewSeq = 0;
        scheduleStep(s, 'reviewLine', T.REVIEW_LINE, { index: 0 });
    });
}

async function reviewLine(session, { index = 0, userSaid = '' }) {
    const speakers = (session.players || []).filter((p) => !p.isUser);
    const speaker = userSaid ? pickRandom(speakers) : speakers[index];
    if (!speaker) {
        writeSession(session, (s) => {
            awaitUser(s, ACTIONS.REVIEW, {});
        });
        return;
    }

    const res = await withBusy(session, 'reviewLine', `${speaker.name}正在复盘`, () => askAi({
        session, aiPersonId: speaker.id, maxTokens: 150,
        ...P.reviewPrompt(session, speaker, userSaid),
    }), { index, userSaid });

    writeSession(session, (s) => {
        if (res.ok) {
            const line = cleanSpeech(res.text, 120);
            if (line) addLog(s, { kind: 'speech', playerId: speaker.id, text: line });
        }
        // 复盘最多自动播 3 条就停下来等用户 —— 再多就变成 AI 自说自话
        if (!userSaid && index + 1 < Math.min(speakers.length, 3)) {
            scheduleStep(s, 'reviewLine', T.REVIEW_LINE, { index: index + 1 });
        } else {
            awaitUser(s, ACTIONS.REVIEW, {});
        }
    });
}

// ---------------------------------------------------------------------------
// 用户操作入口（界面点按钮 → chat method → 这里）
// ---------------------------------------------------------------------------

/**
 * 用户完成了一个 pending 动作。
 *
 * ★ 每个分支的结尾都必须把流程接回去（scheduleStep），
 *   否则就是原型那种「点完之后什么都没发生」。
 */
export async function handleUserAction(session, action, payload = {}) {
    const pending = session.pending;
    if (!pending || pending.action !== action) return;
    const me = userPlayer(session);
    if (!me) return;
    const data = pending.data || {};

    if (action === ACTIONS.CUPID) {
        const ids = Array.isArray(payload.playerIds) ? payload.playerIds : [];
        if (ids.length !== 2) return;
        applyCupid(session, ids[0], ids[1]);
        advanceNight(session, data.index);
        return;
    }
    if (action === ACTIONS.GUARD) {
        applyGuard(session, payload.playerId || '');
        advanceNight(session, data.index);
        return;
    }
    if (action === ACTIONS.WOLF) {
        applyWolfKill(session, payload.playerId || '');
        advanceNight(session, data.index);
        return;
    }
    if (action === ACTIONS.WITCH) {
        applyWitch(session, me, {
            kind: payload.kind || 'skip',
            targetId: payload.playerId || '',
        });
        advanceNight(session, data.index);
        return;
    }
    if (action === ACTIONS.SEER) {
        applySeer(session, me, payload.playerId || '');
        advanceNight(session, data.index);
        return;
    }
    if (action === ACTIONS.SPEECH) {
        const text = cleanSpeech(payload.text, 200);
        writeSession(session, (s) => {
            clearPending(s);
            if (text) addLog(s, { kind: 'speech', playerId: me.id, text });
            else addLog(s, { kind: 'system', text: `${me.name} 选择了过` });
            scheduleStep(s, 'speak', T.NEXT_SPEAKER, { index: (data.index ?? 0) + 1 });
        });
        return;
    }
    if (action === ACTIONS.VOTE) {
        writeSession(session, (s) => {
            clearPending(s);
            const t = getPlayer(s, payload.playerId);
            s.day.votes[me.id] = payload.playerId || '';
            addLog(s, { kind: 'vote', text: `${me.name} 投给 ${t?.name || '弃票'}` });
            // AI 已经投完了才轮到我们收尾；否则等 aiVote 链跑完
            if (s.day.aiVoteDone) scheduleStep(s, 'resolveVote', T.VOTE_REVEAL);
        });
        return;
    }
    if (action === ACTIONS.LAST_WORDS) {
        const text = cleanSpeech(payload.text, 200);
        writeSession(session, (s) => {
            clearPending(s);
            if (text) addLog(s, { kind: 'speech', playerId: me.id, text });
            scheduleStep(s, 'afterLastWords', 400, { playerId: me.id, cause: data.cause || 'vote' });
        });
        return;
    }
    if (action === ACTIONS.HUNTER) {
        writeSession(session, (s) => clearPending(s));
        applyHunterShot(session, payload.playerId || '', data.then || 'beginNight');
        return;
    }
    if (action === ACTIONS.REVIEW) {
        const text = cleanSpeech(payload.text, 200);
        if (!text) return;
        writeSession(session, (s) => {
            clearPending(s);
            addLog(s, { kind: 'speech', playerId: me.id, text });
            scheduleStep(s, 'reviewLine', 600, { userSaid: text });
        });
    }
}

function advanceNight(session, index) {
    writeSession(session, (s) => {
        clearPending(s);
        scheduleStep(s, 'nightAction', T.NIGHT_STEP, { index: (index ?? 0) + 1 });
    });
}

// ---------------------------------------------------------------------------

/** 从「理由：xxx / 目标：yyy」这种结构里取一行。 */
function pickLine(text, key) {
    const m = String(text || '').match(new RegExp(`${key}\\s*[:：]\\s*(.+)`));
    return m ? cleanSpeech(m[1], 60) : '';
}

export { ROLES, roleName, checkWin };
