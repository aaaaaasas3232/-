/**
 * 群聊小游戏 / 通用引擎
 *
 * 三个游戏共用的那部分：建局、写日志、换阶段、提醒用户、收尾。
 *
 * 这一层**一行 DOM 都不碰**。所有函数的副作用只有两个：
 * 改 session、以及往灵动岛发一条提醒。这是「切出界面不断」的前提，
 * 也是这层能被三个玩法完全共用的原因。
 */

import { SESSION_STATUS } from './constants.js';
import { putSession, updateSession, getSession, flushSessions } from './store.js';
import { cancelStep, clearPending } from './clock.js';
import { USER_PLAYER_ID } from './players.js';

let seq = 0;
function nextId(prefix) {
    seq += 1;
    return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

// ---------------------------------------------------------------------------
// 建局
// ---------------------------------------------------------------------------

/**
 * 建一局的公共骨架。各游戏在返回值上加自己的字段。
 *
 * @param {object} opts
 * @param {string} opts.gameId
 * @param {string} opts.groupId
 * @param {Array}  opts.players
 * @param {boolean} opts.godMode  用户旁观（不参战）
 * @param {object} [opts.apiRef]  这一局固定用哪个 API
 * @param {object} [opts.setup]   游戏自己的开局配置（本子、词类型、主题…）
 */
export function createSession({ gameId, groupId, players, godMode = false, apiRef = null, setup = {} }) {
    const now = Date.now();
    return {
        id: nextId('cg'),
        gameId,
        groupId: String(groupId),
        status: SESSION_STATUS.RUNNING,
        godMode: !!godMode,
        apiRef: apiRef || null,
        setup: setup || {},

        players,
        round: 0,
        phase: '',
        phaseLabel: '',

        /** 界面上那条消息流。既是 UI 数据，也是复盘时喂给 AI 的素材。 */
        log: [],
        /** 结构化事件（死亡 / 投票 / 行动），给 AI 拼时间线用，不直接显示。 */
        events: [],

        /** 调度器读写：下一步 / 等用户 / AI 在跑 / 正在执行哪一步（刷新后据此续上）*/
        next: null,
        pending: null,
        busy: null,
        running: null,
        error: null,

        /** 用户不在对局页时，攒下的「轮到你了」提醒（回来时清空）。 */
        unread: 0,

        winner: null,
        result: null,
        startedAt: now,
        endedAt: 0,
        updatedAt: now,
    };
}

/** 开一局并入库。 */
export function startSession(session) {
    putSession(session);
    flushSessions();
    return session;
}

// ---------------------------------------------------------------------------
// 日志
// ---------------------------------------------------------------------------

/**
 * 往消息流里加一条。
 *
 * @param {object} session
 * @param {object} entry
 * @param {'system'|'phase'|'speech'|'action'|'vote'|'narrate'|'result'} entry.kind
 * @param {string} [entry.playerId]
 * @param {string} [entry.text]
 * @param {boolean} [entry.secret]  只有上帝视角/本人能看（狼人夜话、女巫心理）
 */
export function addLog(session, entry) {
    if (!session || !entry) return null;
    const player = entry.playerId
        ? (session.players || []).find((p) => p.id === entry.playerId)
        : null;
    const item = {
        id: nextId('lg'),
        at: Date.now(),
        round: session.round,
        kind: entry.kind || 'system',
        text: String(entry.text || ''),
        playerId: entry.playerId || '',
        playerName: entry.playerName || player?.name || '',
        secret: !!entry.secret,
        tone: entry.tone || '',
        data: entry.data || null,
    };
    session.log.push(item);
    // 一局狼人杀能产生几百条。留 400 条足够复盘，再多纯粹是拖慢
    // 序列化和渲染（原型没有上限，长局到后面明显卡）。
    if (session.log.length > 400) session.log.splice(0, session.log.length - 400);
    return item;
}

/** 结构化事件（喂 AI 的时间线）。 */
export function addEvent(session, event) {
    if (!session || !event) return;
    session.events.push({ round: session.round, at: Date.now(), ...event });
    if (session.events.length > 300) session.events.splice(0, session.events.length - 300);
}

/** 换阶段：写状态 + 在消息流里插一条分隔条。 */
export function setPhase(session, phase, label, opts = {}) {
    session.phase = phase;
    session.phaseLabel = label || phase;
    if (opts.silent !== true) {
        addLog(session, { kind: 'phase', text: label || phase });
    }
}

// ---------------------------------------------------------------------------
// 提醒
// ---------------------------------------------------------------------------

/**
 * 「轮到你了」。
 *
 * ★ 只在**用户不在对局页**时才弹岛。
 *   用户明明正盯着游戏界面，再弹一个岛属于重复告知，而且那个岛会把
 *   音乐/通话这类常驻岛顶掉（AGENTS2 §15.7）。
 *   「在不在对局页」由界面层写 `window.__chatGameViewing`，
 *   引擎只读不写 —— 这样引擎依然不知道 DOM 的存在。
 */
export function notifyTurn(session, text) {
    session.unread = (Number(session.unread) || 0) + 1;
    const viewing = typeof window !== 'undefined' && window.__chatGameViewing === session.groupId;
    if (viewing) return;
    try {
        window.__phoneIsland?.notify?.('info', '轮到你了', text || '游戏在等你操作');
    } catch (_) { /* 岛不可用不影响对局 */ }
}

/** 用户回到对局页，清掉未读。 */
export function markSeen(groupId) {
    updateSession(groupId, (s) => {
        if (!s.unread) return false;
        s.unread = 0;
    });
}

// ---------------------------------------------------------------------------
// 收尾
// ---------------------------------------------------------------------------

/**
 * 分出胜负，但**不结束对局**。
 *
 * ★ 「分出胜负」和「这局结束了」是两件事，原型把它们混成了一件。
 *   狼人杀打完还有复盘、卧底打完还要揭词聊两句 —— 这段时间对局必须
 *   还在调度器手里（AI 要接话），但战绩已经定了，不能再变。
 *   混在一起的后果是原型只能在复盘时把 status 硬掰回 running，
 *   而那会让「已结束」的判断在别处全部失灵。
 *
 * @param {object} session
 * @param {string} winner    游戏自定义的阵营 key
 * @param {string} summary   一句话结果
 * @param {string} [label]   给用户看的标题，如「好人阵营获胜」
 */
export function settleSession(session, winner, summary, label = '') {
    session.settled = true;
    session.winner = winner || 'none';
    session.result = {
        winner: winner || 'none',
        winnerLabel: label || '',
        summary: summary || '',
        rounds: session.round,
        durationMs: Date.now() - session.startedAt,
        highlights: [],
    };
    addLog(session, { kind: 'result', text: summary || '对局结束' });
}

/**
 * 真的结束（用户点「结束对局」，或者游戏本身没有复盘环节）。
 * 到这一步才写战绩、才不再被调度器推进。
 */
export function endSession(session, winner, summary) {
    cancelStep(session);
    clearPending(session);
    session.busy = null;
    if (!session.settled) settleSession(session, winner, summary);
    session.status = SESSION_STATUS.ENDED;
    session.endedAt = Date.now();
    if (session.result) session.result.durationMs = session.endedAt - session.startedAt;
    setPhase(session, 'ended', '对局结束', { silent: true });
}

/**
 * 中止一局（用户主动放弃）。
 *
 * 跟 `endSession` 分开是有原因的：原型的「退出」会强行把 `winner` 写成
 * 某一方并当成正常结束记进战绩，于是排行榜里全是一堆莫名其妙的
 * 「无人获胜」局。中止的局不进战绩。
 */
export function abortSession(session) {
    cancelStep(session);
    clearPending(session);
    session.busy = null;
    session.status = SESSION_STATUS.ABORTED;
    session.endedAt = Date.now();
}

// ---------------------------------------------------------------------------
// 给 prompt 用的上下文
// ---------------------------------------------------------------------------

/** 玩家清单文本：`3号 小明（存活）`。 */
export function describeRoster(session, { showDead = true } = {}) {
    return (session.players || [])
        .map((p) => {
            const state = p.alive ? '存活' : '出局';
            if (!showDead && !p.alive) return '';
            return `${p.seat}号 ${p.name}（${state}）`;
        })
        .filter(Boolean)
        .join('、');
}

/** 最近 N 条公开发言，喂给 AI 当上下文。 */
export function describeRecentSpeech(session, limit = 24) {
    return (session.log || [])
        .filter((l) => !l.secret && (l.kind === 'speech' || l.kind === 'vote' || l.kind === 'result'))
        .slice(-limit)
        .map((l) => (l.playerName ? `${l.playerName}：${l.text}` : l.text))
        .join('\n');
}

/** 一句话描述某个玩家（AI 自我认知用）。 */
export function describeSelf(player) {
    if (!player) return '';
    const parts = [`你是 ${player.seat} 号玩家「${player.name}」`];
    if (player.personality) parts.push(`你的性格：${player.personality}`);
    return parts.join('。');
}

export { USER_PLAYER_ID, getSession, updateSession };
