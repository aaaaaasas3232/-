/**
 * 群聊小游戏 / 战绩与排行榜
 *
 * 两件事：
 *   1. 对局结束后往群聊里写一张战绩卡（`type: 'game_record'`）
 *   2. 累计每个玩家的胜负，供排行榜页读
 *
 * ★ 原型这一块是断的：
 *   - 大富翁写了 `renderMonopolyRecordCard`，但**全文件没有任何地方产生
 *     `msg.gameRecord`** —— 渲染器是个孤儿，永远画不出来。
 *   - 谁是卧底会 `GameStats.recordUndercoverGame(...)`，而 `games.js`
 *     根本不在参考包里，排行榜点进去必崩。
 *   - 狼人杀「返回退出」会把 `winner` 强行写成某一方并当正常结束记档，
 *     于是排行榜里会混进一堆没打完的局。
 *
 *   现在：只有**真的分出胜负**的局才记（`abortSession` 的局不记），
 *   写入前先确认有人读（AGENTS2 §9.6 孤儿 key）—— 战绩卡有渲染器、
 *   统计有排行榜页，两条都通了才写。
 */

import { STATS_KEY, GAME_META } from './constants.js';
import { findGroup, getCurrentUser, USER_PLAYER_ID } from './players.js';

// ---------------------------------------------------------------------------
// 战绩卡
// ---------------------------------------------------------------------------

/**
 * 把一局的结果压成战绩卡数据。
 * 只留渲染卡片 + 详情页要用的东西，不带完整 log（那玩意儿几百条，
 * 塞进每条群消息里会把 IndexedDB 撑爆）。
 */
export function buildGameRecord(session) {
    const meta = GAME_META[session.gameId] || {};
    return {
        id: session.id,
        gameId: session.gameId,
        gameName: meta.name || session.gameId,
        tone: meta.tone || 'blue',
        groupId: session.groupId,
        rounds: session.round,
        durationMs: session.result?.durationMs || 0,
        winner: session.winner || 'none',
        winnerLabel: session.result?.winnerLabel || '',
        summary: session.result?.summary || '',
        godMode: !!session.godMode,
        players: (session.players || []).map((p) => ({
            id: p.id,
            name: p.name,
            seat: p.seat,
            isUser: !!p.isUser,
            role: p.role || '',
            roleLabel: p.roleLabel || '',
            word: p.word || '',
            alive: !!p.alive,
            win: !!p.win,
        })),
        highlights: Array.isArray(session.result?.highlights) ? session.result.highlights : [],
        endedAt: session.endedAt || Date.now(),
    };
}

/**
 * 往群聊里写战绩卡。
 *
 * 用 `sender: 'system'` + `type: 'game_record'`。未在白名单里的
 * `gameRecord` 字段走 SDK 的 passthrough 原样保存（AGENTS2 §5.2）。
 */
export async function postGameRecord(session) {
    const found = findGroup(session.groupId);
    if (!found) return null;
    const { sdk, user, mode } = found;
    if (!sdk?.chatMessages?.add) return null;

    const record = buildGameRecord(session);
    const meta = GAME_META[session.gameId] || {};
    try {
        const saved = await sdk.chatMessages.add(user, session.groupId, mode, {
            sender: 'system',
            senderName: '',
            type: 'game_record',
            content: `[${meta.name || '小游戏'}战绩]`,
            gameRecord: record,
            conversationType: 'group',
            conversationId: session.groupId,
            timestamp: Date.now(),
        });
        if (sdk.chatGroups?.updateLastMessage) {
            await sdk.chatGroups.updateLastMessage(sdk, user, session.groupId, mode, {
                content: `[${meta.name || '小游戏'}] ${record.summary || '对局结束'}`,
                timestamp: Date.now(),
                senderName: '',
                type: 'game_record',
            });
        }
        return saved;
    } catch (err) {
        console.warn('[chat-games] 战绩卡写入失败', err);
        return null;
    }
}

// ---------------------------------------------------------------------------
// 累计统计
// ---------------------------------------------------------------------------

/**
 * 统计表结构：
 *
 *   { v: 1, players: { [playerId]: { name, isUser, games: { [gameId]: {...} } } },
 *     history: [ { gameId, groupId, winner, summary, at } ] }
 *
 * 每个游戏的细项由各自的 `statFields` 决定（狼人杀分好人/狼人场次，
 * 卧底分平民/卧底场次，大富翁记破产和总资产）。
 */
export function loadStats() {
    try {
        const raw = localStorage.getItem(STATS_KEY);
        if (!raw) return { v: 1, players: {}, history: [] };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { v: 1, players: {}, history: [] };
        return {
            v: 1,
            players: parsed.players && typeof parsed.players === 'object' ? parsed.players : {},
            history: Array.isArray(parsed.history) ? parsed.history : [],
        };
    } catch (_) {
        return { v: 1, players: {}, history: [] };
    }
}

function saveStats(stats) {
    try {
        // 历史只留最近 100 局 —— 排行榜页只显示最近的，
        // 无限增长的历史迟早会把 localStorage 写满（梦境编织踩过，AGENTS2 §12 #14）
        if (stats.history.length > 100) stats.history = stats.history.slice(-100);
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (err) {
        console.warn('[chat-games] 统计写入失败', err);
    }
}

/**
 * 记一局。
 *
 * @param {object} session  必须是已经 `endSession` 过的
 * @param {(player:object) => object} [extra]  游戏自己要记的字段
 */
export function recordResult(session, extra = null) {
    if (!session || session.status !== 'ended') return;
    const stats = loadStats();
    const gameId = session.gameId;

    for (const p of session.players || []) {
        const key = p.isUser ? USER_PLAYER_ID : p.id;
        if (!stats.players[key]) {
            stats.players[key] = { id: key, name: p.name, isUser: !!p.isUser, games: {} };
        }
        const entry = stats.players[key];
        // 名字用最新的一次 —— 用户改了 AI 昵称，榜上也该跟着改
        entry.name = p.name;
        if (!entry.games[gameId]) entry.games[gameId] = { games: 0, wins: 0, detail: {} };
        const g = entry.games[gameId];
        g.games += 1;
        if (p.win) g.wins += 1;
        const fields = typeof extra === 'function' ? (extra(p) || {}) : {};
        for (const [k, v] of Object.entries(fields)) {
            g.detail[k] = (Number(g.detail[k]) || 0) + (Number(v) || 0);
        }
    }

    stats.history.push({
        gameId,
        groupId: session.groupId,
        winner: session.winner,
        summary: session.result?.summary || '',
        rounds: session.round,
        at: session.endedAt || Date.now(),
    });
    saveStats(stats);
}

/**
 * 排行榜数据：按某个游戏排出名次。
 *
 * @param {string} gameId  传 'all' 表示汇总所有游戏
 */
export function buildLeaderboard(gameId = 'all') {
    const stats = loadStats();
    const rows = [];
    for (const entry of Object.values(stats.players || {})) {
        let games = 0;
        let wins = 0;
        let detail = {};
        if (gameId === 'all') {
            for (const g of Object.values(entry.games || {})) {
                games += Number(g.games) || 0;
                wins += Number(g.wins) || 0;
            }
        } else {
            const g = entry.games?.[gameId];
            if (!g) continue;
            games = Number(g.games) || 0;
            wins = Number(g.wins) || 0;
            detail = g.detail || {};
        }
        if (!games) continue;
        rows.push({
            id: entry.id,
            name: entry.name,
            isUser: !!entry.isUser,
            games,
            wins,
            winRate: games ? Math.round((wins / games) * 100) : 0,
            detail,
        });
    }
    // 胜场优先，其次胜率，最后场次 —— 只按胜率排的话打过 1 局赢 1 局的会霸榜
    rows.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.games - a.games);
    return { rows, history: [...(stats.history || [])].reverse().slice(0, 20) };
}

/** 清空统计（设置里给一个入口，方便用户重来）。 */
export function clearStats() {
    try {
        localStorage.removeItem(STATS_KEY);
    } catch (_) {}
}

export { getCurrentUser };
