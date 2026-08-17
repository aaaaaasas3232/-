/**
 * 谁是卧底 / 引擎
 *
 * 步骤图：
 *
 *   beginRound ──> describe(i) ──…──> beginDiscuss ──> beginVote
 *        ↑                                                 │
 *        │                                             aiVote(i)
 *        │                                                 │
 *        └──────── checkEnd <──── resolveVote ─────────────┘
 *
 * ★ 相对原型修掉的：
 *
 *   1. **投票是真的 AI 决策**（见 prompts.js 的说明），不再是随机。
 *   2. **`player.isAlive` 死字段**。原型初始化时写了 `isAlive: true`，
 *      淘汰时却只从 `alivePlayers` 数组里删 id，`isAlive` 永远是 true。
 *      两套真相并存，渲染时读哪个全看运气。现在只有 `player.alive`。
 *   3. **中途退出不清状态**。原型的 `onBack` 只存了个记录就走了，
 *      timer 和 AI 回调还在跑，会在后台把这一局打完，还会再打一堆 API。
 *      现在退出走 `abortSession`，调度器立刻不再管它。
 *   4. **投票揭身份的条件恒假**。原型写 `game.phase === 'ended'`，
 *      而那行代码执行时 phase 还是 `'vote'` —— 上帝模式下本该看到的
 *      身份从来没显示过。
 *   5. **平票**：原型随机抽一个出局。改成「平票重投一次，再平就都不出局」——
 *      随机淘汰会让用户觉得「我明明推对了」，是这个游戏最让人恼火的体验。
 */

import { addLog, addEvent, setPhase, settleSession, notifyTurn } from '../core/engine.js';
import { writeSession } from '../core/store.js';
import { scheduleStep, awaitUser, clearPending, withBusy } from '../core/clock.js';
import { askAi, cleanSpeech, parseTarget, parseJson } from '../core/ai.js';
import { pickRandom, shuffle, alivePlayers, aliveExcept, getPlayer, userPlayer } from '../core/players.js';
import { UNDERCOVER_TIMING as T } from '../core/constants.js';
import { pickWordPair, wordTypeLabel } from './words.js';
import * as P from './prompts.js';

export const PHASES = Object.freeze({
    DESCRIBE: 'describe',
    DISCUSS: 'discuss',
    VOTE: 'vote',
    REVIEW: 'review',
});

export const ACTIONS = Object.freeze({
    DESCRIBE: 'describe',
    DISCUSS: 'discuss',
    VOTE: 'vote',
    REVIEW: 'review_chat',
});

export const TEAMS = Object.freeze({ CIVILIAN: 'civilian', UNDERCOVER: 'undercover' });

/**
 * 卧底人数。
 *
 * 原型写的是 `count<=4 ? 1 : (count<=7 ? 1 : 2)` —— 前两支完全一样，
 * 说明作者本来想分三档后来改了主意但没删干净。这里就是两档。
 */
export function undercoverCount(total) {
    return total >= 8 ? 2 : 1;
}

// ---------------------------------------------------------------------------

export function setup(session) {
    const type = session.setup?.wordType || 'mixed';
    const pair = session.setup?.wordPair || pickWordPair(type);
    const spies = undercoverCount(session.players.length);

    const order = shuffle(session.players.map((p) => p.id));
    const spyIds = new Set(order.slice(0, spies));
    for (const p of session.players) {
        p.role = spyIds.has(p.id) ? TEAMS.UNDERCOVER : TEAMS.CIVILIAN;
        p.roleLabel = spyIds.has(p.id) ? '卧底' : '平民';
        p.word = spyIds.has(p.id) ? pair.undercover : pair.civilian;
    }

    session.wordPair = pair;
    session.spyCount = spies;
    session.setup = { ...(session.setup || {}), wordType: type };

    addLog(session, {
        kind: 'system',
        text: `${session.players.length} 人局，其中卧底 ${spies} 人。词库类型：${wordTypeLabel(type)}`,
    });
    if (session.godMode) {
        addLog(session, { kind: 'system', text: `平民词「${pair.civilian}」，卧底词「${pair.undercover}」` });
    }
    scheduleStep(session, 'beginRound', T.OPEN);
    return session;
}

/**
 * 让 AI 出题（可选）。开局前调，失败就回落到本地词库。
 * ★ 失败**不阻塞开局** —— 原型在这里 await 一个可能永远不返回的请求，
 *   全屏遮罩转到天荒地老。
 */
export async function generateWordPair(session, type) {
    const res = await askAi({
        session, maxTokens: 120, temperature: 1,
        ...P.wordPairPrompt(wordTypeLabel(type)),
    });
    if (res.ok) {
        const json = parseJson(res.text);
        const civilian = String(json?.civilian || '').trim();
        const undercover = String(json?.undercover || '').trim();
        if (civilian && undercover && civilian !== undercover) {
            return { civilian, undercover, source: 'ai' };
        }
    }
    return pickWordPair(type);
}

// ---------------------------------------------------------------------------

export async function runStep(session, step, payload) {
    const handler = STEPS[step];
    if (!handler) {
        console.warn('[undercover] 未知步骤', step);
        return;
    }
    await handler(session, payload || {});
}

const STEPS = {
    beginRound, describe, beginDiscuss, beginVote, aiVote, resolveVote, checkEnd, beginReview, reviewLine,
};

// ---------------------------------------------------------------------------

function beginRound(session) {
    writeSession(session, (s) => {
        s.round += 1;
        setPhase(s, PHASES.DESCRIBE, `第 ${s.round} 轮 · 依次描述`);
        s.day = {
            order: alivePlayers(s).sort((a, b) => a.seat - b.seat).map((p) => p.id),
            index: 0,
            votes: {},
            reasons: {},
            tie: 0,
        };
        scheduleStep(s, 'describe', T.NEXT_SPEAKER, { index: 0 });
    });
}

async function describe(session, { index = 0 }) {
    const day = session.day;
    if (!day) return;
    const id = day.order[index];
    if (!id) {
        writeSession(session, (s) => scheduleStep(s, 'beginDiscuss', T.TO_DISCUSS));
        return;
    }
    const player = getPlayer(session, id);
    if (!player || !player.alive) {
        writeSession(session, (s) => scheduleStep(s, 'describe', 200, { index: index + 1 }));
        return;
    }

    writeSession(session, (s) => { s.day.index = index; });

    if (player.isUser) {
        writeSession(session, (s) => {
            awaitUser(s, ACTIONS.DESCRIBE, { index });
            notifyTurn(s, '轮到你描述了');
        });
        return;
    }

    const res = await withBusy(session, 'describe', `${player.name}正在描述`, () => askAi({
        session, aiPersonId: player.id, maxTokens: 120,
        ...P.describePrompt(session, player, day.order),
    }), { index });

    writeSession(session, (s) => {
        const text = res.ok ? cleanSpeech(res.text, 60) : '';
        if (text) {
            addLog(s, { kind: 'speech', playerId: id, text });
            addEvent(s, { type: 'describe', playerId: id, playerName: player.name, text });
        } else {
            // 不伪造发言。原型这里会塞「思考中...(网络延迟)」，
            // 而那条会被后面的 prompt 当成这个人真的说过的话喂回给 AI。
            addLog(s, { kind: 'system', text: `${player.name} 这轮没说出话（跳过）` });
        }
        scheduleStep(s, 'describe', T.NEXT_SPEAKER, { index: index + 1 });
    });
}

function beginDiscuss(session) {
    writeSession(session, (s) => {
        setPhase(s, PHASES.DISCUSS, `第 ${s.round} 轮 · 自由讨论`);
        const me = userPlayer(s);
        // ★ 用户已经出局时**不能**停下来等他 —— 出局的人只是旁观，
        //   却要负责推进流程的话，界面上那个「进入投票」按钮就得给死人开放，
        //   不开放就是死锁（第一版写成了后者，这里记一笔免得改回去）。
        //   上帝视角没有玩家身份，但他是主持人，仍然由他控节奏。
        if (me && !me.alive) {
            addLog(s, { kind: 'system', text: '大家在互相质疑…' });
            scheduleStep(s, 'beginVote', T.DISCUSS_REPLY * 2);
            return;
        }
        addLog(s, { kind: 'system', text: '可以互相质疑，聊够了点「进入投票」' });
        awaitUser(s, ACTIONS.DISCUSS, {});
        notifyTurn(s, '可以讨论，或者直接进入投票');
    });
}

function beginVote(session) {
    writeSession(session, (s) => {
        clearPending(s);
        setPhase(s, PHASES.VOTE, `第 ${s.round} 轮 · 投票`);
        s.day.votes = {};
        s.day.reasons = {};
        s.day.aiVoteDone = false;
        const me = userPlayer(s);
        if (me && me.alive) {
            awaitUser(s, ACTIONS.VOTE, {});
            notifyTurn(s, '该你投票了');
        }
        scheduleStep(s, 'aiVote', T.TO_VOTE, { index: 0 });
    });
}

async function aiVote(session, { index = 0 }) {
    const voters = alivePlayers(session).filter((p) => !p.isUser);
    const voter = voters[index];
    if (!voter) {
        writeSession(session, (s) => {
            s.day.aiVoteDone = true;
            if (!s.pending) scheduleStep(s, 'resolveVote', T.VOTE_REVEAL);
        });
        return;
    }

    const candidates = aliveExcept(session, voter.id);
    const res = await withBusy(session, 'aiVote', `${voter.name}正在投票`, () => askAi({
        session, aiPersonId: voter.id, maxTokens: 100,
        ...P.votePrompt(session, voter, candidates),
    }), { index });

    const reason = pickLine(res.text, '理由');
    const line = pickLine(res.text, '投票');
    const target = (res.ok && parseTarget(line || res.text, candidates)) || pickRandom(candidates);

    writeSession(session, (s) => {
        s.day.votes[voter.id] = target?.id || '';
        if (reason) s.day.reasons[voter.id] = reason;
        addLog(s, {
            kind: 'vote',
            text: reason
                ? `${voter.name} 投给 ${target?.name || '弃票'}：${reason}`
                : `${voter.name} 投给 ${target?.name || '弃票'}`,
        });
        scheduleStep(s, 'aiVote', T.VOTE_STEP, { index: index + 1 });
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

        if (top.length !== 1) {
            // 平票重投一次。再平就都留着 —— 随机淘汰会让「我推对了」变成「我运气不好」
            if (top.length > 1 && (s.day.tie || 0) < 1) {
                s.day.tie = (s.day.tie || 0) + 1;
                addLog(s, {
                    kind: 'system',
                    text: `平票（${top.map((id) => getPlayer(s, id)?.name).join(' / ')}各 ${max} 票），重新投一次`,
                });
                scheduleStep(s, 'beginVote', T.VOTE_REVEAL);
                return;
            }
            addLog(s, { kind: 'system', text: '还是平票，这轮没有人出局' });
            scheduleStep(s, 'checkEnd', T.VOTE_REVEAL);
            return;
        }

        const outId = top[0];
        const out = getPlayer(s, outId);
        if (out) {
            out.alive = false;
            out.outRound = s.round;
            addEvent(s, { type: 'eliminate', playerId: outId, playerName: out.name, role: out.role, votes: max });
        }
        // 揭不揭身份看模式：上帝视角当场揭，玩家视角留到结束
        // （原型这里的判断是 `phase === 'ended'`，而此刻 phase 还是 'vote' —— 恒假）
        const revealed = s.godMode ? `（他是${out?.roleLabel}）` : '';
        addLog(s, { kind: 'system', text: `${out?.seat}号 ${out?.name} 以 ${max} 票出局${revealed}`, tone: 'death' });
        scheduleStep(s, 'checkEnd', T.VOTE_REVEAL);
    });
}

function checkEnd(session) {
    const alive = alivePlayers(session);
    const spies = alive.filter((p) => p.role === TEAMS.UNDERCOVER).length;
    const civilians = alive.length - spies;

    let winner = null;
    if (spies === 0) winner = TEAMS.CIVILIAN;
    else if (spies >= civilians) winner = TEAMS.UNDERCOVER;

    if (!winner) {
        writeSession(session, (s) => scheduleStep(s, 'beginRound', T.NEXT_ROUND));
        return;
    }

    writeSession(session, (s) => {
        for (const p of s.players) p.win = p.role === winner;
        const pair = s.wordPair || {};
        const spyNames = s.players.filter((p) => p.role === TEAMS.UNDERCOVER).map((p) => p.name).join('、');
        const label = winner === TEAMS.CIVILIAN ? '平民获胜' : '卧底获胜';
        settleSession(
            s, winner,
            `${label}。卧底是 ${spyNames}；平民词「${pair.civilian}」，卧底词「${pair.undercover}」`,
            label,
        );
        s.result.highlights = [
            `平民词：${pair.civilian}`,
            `卧底词：${pair.undercover}`,
            `卧底：${spyNames}`,
        ];
        scheduleStep(s, 'beginReview', 1000);
    });
}

function beginReview(session) {
    writeSession(session, (s) => {
        setPhase(s, PHASES.REVIEW, '复盘时间');
        scheduleStep(s, 'reviewLine', T.REVIEW_LINE, { index: 0 });
    });
}

async function reviewLine(session, { index = 0, userSaid = '' }) {
    const speakers = (session.players || []).filter((p) => !p.isUser);
    const speaker = userSaid ? pickRandom(speakers) : speakers[index];
    if (!speaker) {
        writeSession(session, (s) => awaitUser(s, ACTIONS.REVIEW, {}));
        return;
    }
    const res = await withBusy(session, 'reviewLine', `${speaker.name}正在复盘`, () => askAi({
        session, aiPersonId: speaker.id, maxTokens: 120,
        ...P.reviewPrompt(session, speaker, userSaid),
    }), { index, userSaid });

    writeSession(session, (s) => {
        if (res.ok) {
            const line = cleanSpeech(res.text, 100);
            if (line) addLog(s, { kind: 'speech', playerId: speaker.id, text: line });
        }
        if (!userSaid && index + 1 < Math.min(speakers.length, 3)) {
            scheduleStep(s, 'reviewLine', T.REVIEW_LINE, { index: index + 1 });
        } else {
            awaitUser(s, ACTIONS.REVIEW, {});
        }
    });
}

// ---------------------------------------------------------------------------

export async function handleUserAction(session, action, payload = {}) {
    const pending = session.pending;
    if (!pending || pending.action !== action) return;
    const me = userPlayer(session);
    const data = pending.data || {};

    if (action === ACTIONS.DESCRIBE) {
        const text = cleanSpeech(payload.text, 60);
        if (!text) return;
        writeSession(session, (s) => {
            clearPending(s);
            addLog(s, { kind: 'speech', playerId: me.id, text });
            addEvent(s, { type: 'describe', playerId: me.id, playerName: me.name, text });
            scheduleStep(s, 'describe', T.NEXT_SPEAKER, { index: (data.index ?? 0) + 1 });
        });
        return;
    }

    if (action === ACTIONS.DISCUSS) {
        // 两种子操作：说一句（AI 会接话）/ 进入投票
        if (payload.go === 'vote') {
            // ★ pending 必须**当场**清掉，不能等 beginVote 跑起来再清 ——
            //   中间这 200ms 里界面还是讨论面板，用户能把「进入投票」再点一次，
            //   于是排两次 beginVote。（回归测试就是靠这一点抓到的：
            //   它比 ticker 严格，pending 没清就不往下走。）
            writeSession(session, (s) => {
                clearPending(s);
                scheduleStep(s, 'beginVote', 200);
            });
            return;
        }
        const text = cleanSpeech(payload.text, 120);
        if (!text) return;
        writeSession(session, (s) => {
            addLog(s, { kind: 'speech', playerId: me.id, text });
        });
        await discussReplies(session, text);
        return;
    }

    if (action === ACTIONS.VOTE) {
        writeSession(session, (s) => {
            clearPending(s);
            const t = getPlayer(s, payload.playerId);
            s.day.votes[me.id] = payload.playerId || '';
            addLog(s, { kind: 'vote', text: `${me.name} 投给 ${t?.name || '弃票'}` });
            if (s.day.aiVoteDone) scheduleStep(s, 'resolveVote', T.VOTE_REVEAL);
        });
        return;
    }

    if (action === ACTIONS.REVIEW) {
        const text = cleanSpeech(payload.text, 120);
        if (!text) return;
        writeSession(session, (s) => {
            clearPending(s);
            addLog(s, { kind: 'speech', playerId: me.id, text });
            scheduleStep(s, 'reviewLine', 600, { userSaid: text });
        });
    }
}

/**
 * 讨论时随机挑 1~2 个 AI 接话。
 *
 * ★ 原型这里要「长按发送」才触发 AI 回应，而界面上只有一行小字说明 ——
 *   一个没人会发现的隐藏交互。现在就是普通发送，AI 自然接话。
 */
async function discussReplies(session, userText) {
    const pool = shuffle(alivePlayers(session).filter((p) => !p.isUser));
    const speakers = pool.slice(0, Math.min(2, pool.length));
    for (const sp of speakers) {
        const res = await withBusy(session, 'discuss', `${sp.name}正在回应`, () => askAi({
            session, aiPersonId: sp.id, maxTokens: 100,
            ...P.discussPrompt(session, sp, userText),
        }));
        if (!res.ok) continue;
        const line = cleanSpeech(res.text, 80);
        if (!line) continue;
        writeSession(session, (s) => {
            addLog(s, { kind: 'speech', playerId: sp.id, text: line });
        });
    }
    // 讨论不会自动结束 —— 用户想聊多久聊多久，点「进入投票」才走
    writeSession(session, (s) => {
        if (s.phase === PHASES.DISCUSS) awaitUser(s, ACTIONS.DISCUSS, {});
    });
}

function pickLine(text, key) {
    const m = String(text || '').match(new RegExp(`${key}\\s*[:：]\\s*(.+)`));
    return m ? cleanSpeech(m[1], 60) : '';
}
