/**
 * 赛点 · 持久层
 *
 * 五张表，全部挂 saveId（声浪的档 id，游戏数据跟着档走）：
 *   esgStates     一档一条：巅峰分 / 英雄熟练度 / 每日局数 / 待同步 / 揭示记录
 *   esgSessions   排位场次（一次 N 局的概要）
 *   esgMatches    单局明细（含懒生成的文字回放）
 *   esgRelations  亲密关系（互关 / 亲密值 / 情侣标）
 *   esgChats      战队群 / 教练私聊消息（按 seq 排）
 */

import { STORES } from '../constants.js';
import { toPlain, uid } from '../utils.js';

export const GAME_STORES = Object.freeze(
    Object.values(STORES).map((name) => ({ name, keyPath: 'id' })),
);

function db(app) {
    return app?.toolkit?.db || (typeof window !== 'undefined' ? window.myDb : null);
}

async function getAll(app, store) {
    const handle = db(app);
    if (!handle) return [];
    try {
        const rows = await handle.getAll(store);
        return Array.isArray(rows) ? rows : [];
    } catch (err) {
        console.warn(`[esports-game] 读 ${store} 失败`, err);
        return [];
    }
}

async function getOne(app, store, id) {
    const handle = db(app);
    if (!handle || !id) return null;
    try {
        return (await handle.get(store, String(id))) || null;
    } catch (err) {
        console.warn(`[esports-game] 读 ${store} 单条失败`, err);
        return null;
    }
}

async function put(app, store, record) {
    const handle = db(app);
    if (!handle) return null;
    try {
        const plain = toPlain(record);
        await handle.put(store, plain);
        return plain;
    } catch (err) {
        console.warn(`[esports-game] 写 ${store} 失败`, err);
        return null;
    }
}

async function removeRow(app, store, id) {
    const handle = db(app);
    if (!handle || !id) return false;
    try {
        await handle.remove(store, id);
        return true;
    } catch (err) {
        console.warn(`[esports-game] 删 ${store} 失败`, err);
        return false;
    }
}

// ============================================================
// states（一档一条，id = saveId）
// ============================================================

export function makeState(saveId, profileKey, initialRating) {
    return {
        id: String(saveId),
        saveId: String(saveId),
        profileKey: String(profileKey),
        rating: Number(initialRating) || 1500,
        best: Number(initialRating) || 1500,
        history: [],                 // [{ day, rating }]
        practice: {},                // heroName -> proficiency
        focusHero: '',
        dailyGames: {},              // day -> count
        trainingDays: {},            // day -> true
        recordSeen: {},              // `${personId}::${day}` -> true（生成过的他人战绩）
        pendingSync: [],             // 声浪不可用时积压的写回
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

export async function loadState(app, saveId) {
    if (!saveId) return null;
    return getOne(app, STORES.states, saveId);
}

export function saveState(app, state) {
    if (!state?.id) return Promise.resolve(null);
    return put(app, STORES.states, { ...state, updatedAt: Date.now() });
}

// ============================================================
// sessions / matches
// ============================================================

function bySave(rows, saveId) {
    return rows.filter((r) => r && r.saveId === String(saveId));
}

export async function listSessions(app, saveId) {
    const rows = await getAll(app, STORES.sessions);
    return bySave(rows, saveId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function saveSession(app, saveId, session) {
    return put(app, STORES.sessions, {
        ...session,
        id: session.id || uid('sess'),
        saveId: String(saveId),
        createdAt: session.createdAt || Date.now(),
    });
}

export async function listMatches(app, saveId, sessionId = '') {
    const rows = await getAll(app, STORES.matches);
    return bySave(rows, saveId)
        .filter((r) => !sessionId || r.sessionId === sessionId)
        .sort((a, b) => (a.seq || 0) - (b.seq || 0));
}

export function saveMatch(app, saveId, match) {
    return put(app, STORES.matches, {
        ...match,
        id: match.id || uid('match'),
        saveId: String(saveId),
        createdAt: match.createdAt || Date.now(),
    });
}

// ============================================================
// relations
// ============================================================

export function relationId(saveId, targetId) {
    return `${saveId}::${targetId}`;
}

export async function listRelations(app, saveId) {
    const rows = await getAll(app, STORES.relations);
    return bySave(rows, saveId);
}

export function saveRelation(app, saveId, relation) {
    return put(app, STORES.relations, {
        ...relation,
        id: relation.id || relationId(saveId, relation.targetId),
        saveId: String(saveId),
        updatedAt: Date.now(),
    });
}

// ============================================================
// chats（channel: 'team' | 'coach'）
// ============================================================

export async function listChat(app, saveId, channel) {
    const rows = await getAll(app, STORES.chats);
    return bySave(rows, saveId)
        .filter((r) => r.channel === channel)
        .sort((a, b) => (a.seq || 0) - (b.seq || 0));
}

export function saveChatMessage(app, saveId, message) {
    return put(app, STORES.chats, {
        ...message,
        id: message.id || uid('gm'),
        saveId: String(saveId),
        createdAt: message.createdAt || Date.now(),
    });
}

// ============================================================
// 清理（跟档走：声浪删档后，赛点数据成为孤儿时可清）
// ============================================================

export async function purgeSaveData(app, saveId) {
    for (const store of Object.values(STORES)) {
        const rows = await getAll(app, store);
        for (const row of bySave(rows, saveId)) {
            await removeRow(app, store, row.id);
        }
    }
    return true;
}
