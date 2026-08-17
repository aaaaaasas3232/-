/**
 * 追光 · 持久层
 *
 * 八张表两种粒度：
 *   按档案键（profileKey = userId::worldId）：
 *     actorProfiles    一档案一条：首配 + 30 NPC 名册 + 奖项/节日定义 + 人设改写台账
 *     actorStageCards  阶段卡（跨存档保留；重开档只重置属性，不删卡）
 *   按存档（saveId，档案键冗余存一份便于清理）：
 *     actorSaves       档：时钟 / 线级 / 属性 / 精力 / NPC 启用 / 护盾 / 结局
 *     actorEvents      事件日志（突发 / 交际 / 公告）
 *     actorTimeline    大事记
 *     actorProjects    剧本与项目
 *     actorSchedules   每日安排（id = `${saveId}::${day}`）
 *     actorNpcChats    NPC 聊天
 */

import { STORES } from '../constants.js';
import { toPlain, uid } from '../utils.js';

export const ACTOR_STORES = Object.freeze(
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
        console.warn(`[actor] 读 ${store} 失败`, err);
        return [];
    }
}

async function getOne(app, store, id) {
    const handle = db(app);
    if (!handle || !id) return null;
    try {
        return (await handle.get(store, String(id))) || null;
    } catch (err) {
        console.warn(`[actor] 读 ${store} 单条失败`, err);
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
        console.warn(`[actor] 写 ${store} 失败`, err);
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
        console.warn(`[actor] 删 ${store} 失败`, err);
        return false;
    }
}

// ============================================================
// profiles
// ============================================================

export function makeProfile(profileKey) {
    return {
        id: String(profileKey),
        profileKey: String(profileKey),
        configured: false,
        setupVersion: 1,
        // 首配身份
        stageName: '',
        agencyStatus: '',
        genres: [],
        style: '',
        goal: '',
        representativeWork: '',
        startTier: 18,
        // 30 人名册（确定性生成后固化，跨档共享）
        npcRoster: [],
        // 奖项（段锚点）与节日（点锚点）定义 —— 用户可随机 / 编辑
        awards: [],
        festivals: [],
        // 人设改写台账：[{ saveId, entityType, entityId, line, at }]
        personaWrites: [],
        // provider 开关（记「关掉的」）
        providerPrefs: {},
        activeSaveId: '',
        themeId: 'stage',
        customColors: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

export async function loadProfile(app, profileKey) {
    if (!profileKey) return null;
    const row = await getOne(app, STORES.profiles, profileKey);
    if (!row) return null;
    return { ...makeProfile(profileKey), ...row };
}

export function saveProfile(app, profile) {
    if (!profile?.id) return Promise.resolve(null);
    return put(app, STORES.profiles, { ...profile, updatedAt: Date.now() });
}

// ============================================================
// saves（档）
// ============================================================

export function makeSave(profileKey, { name, tier, attrs, clock, npcActiveIds }) {
    return {
        id: uid('save'),
        profileKey: String(profileKey),
        name: String(name || '新档'),
        status: 'active',            // active / ended
        tier: Number(tier) || 18,
        attrs: { ...(attrs || {}) },
        energy: 100,
        money0: true,                // 首日发放安家费标记
        clock: { ...(clock || {}) },
        // NPC
        npcActiveIds: [...(npcActiveIds || [])],
        npcExtra: [],                // 用户加的 NPC / 拉进来的 AI（wrapAiAsNpc 产物）
        revealedNpcIds: [],
        chattedNpcIds: [],
        // 事件系统状态
        shieldUntilDay: 0,
        triggeredOnceIds: [],
        lastTriggeredDayById: {},
        pendingEventIds: [],
        // 生涯
        finishedWorks: 0,
        honors: [],                  // [{ id, title, day, source }]
        auditionCount: 0,
        settlements: [],             // 阶段结算记录（多块）
        // 与外部系统的钩子
        worldTimelineIds: [],        // 写进世界观时间轴的事件 id（删档回收）
        endingText: '',
        endedAt: 0,
        lastPlayedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

export async function listSaves(app, profileKey) {
    const rows = await getAll(app, STORES.saves);
    return rows
        .filter((r) => r && r.profileKey === String(profileKey))
        .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
}

export function getSave(app, id) {
    return getOne(app, STORES.saves, id);
}

export function saveSave(app, save) {
    if (!save?.id) return Promise.resolve(null);
    return put(app, STORES.saves, { ...save, updatedAt: Date.now() });
}

export function removeSave(app, id) {
    return removeRow(app, STORES.saves, id);
}

// ============================================================
// 按 saveId 的表（events / timeline / projects / npcChats）
// ============================================================

function bySave(rows, saveId) {
    return rows.filter((r) => r && r.saveId === String(saveId));
}

export async function listEvents(app, saveId) {
    const rows = await getAll(app, STORES.events);
    return bySave(rows, saveId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function saveEvent(app, profileKey, saveId, event) {
    return put(app, STORES.events, {
        ...event,
        id: event.id || uid('ev'),
        profileKey: String(profileKey),
        saveId: String(saveId),
        createdAt: event.createdAt || Date.now(),
    });
}

export async function listTimeline(app, saveId) {
    const rows = await getAll(app, STORES.timeline);
    return bySave(rows, saveId).sort((a, b) => (b.day || 0) - (a.day || 0) || (b.createdAt || 0) - (a.createdAt || 0));
}

export function saveTimelineEntry(app, profileKey, saveId, entry) {
    return put(app, STORES.timeline, {
        ...entry,
        id: entry.id || uid('tl'),
        profileKey: String(profileKey),
        saveId: String(saveId),
        createdAt: entry.createdAt || Date.now(),
    });
}

export async function listProjects(app, saveId) {
    const rows = await getAll(app, STORES.projects);
    return bySave(rows, saveId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function saveProject(app, profileKey, saveId, project) {
    return put(app, STORES.projects, {
        ...project,
        id: project.id || uid('proj'),
        profileKey: String(profileKey),
        saveId: String(saveId),
        updatedAt: Date.now(),
        createdAt: project.createdAt || Date.now(),
    });
}

export function removeProject(app, id) {
    return removeRow(app, STORES.projects, id);
}

export async function listNpcChat(app, saveId, npcId) {
    const rows = await getAll(app, STORES.npcChats);
    return bySave(rows, saveId)
        .filter((r) => String(r.npcId) === String(npcId))
        .sort((a, b) => (a.seq || 0) - (b.seq || 0));
}

export function saveNpcChatMessage(app, profileKey, saveId, message) {
    return put(app, STORES.npcChats, {
        ...message,
        id: message.id || uid('nm'),
        profileKey: String(profileKey),
        saveId: String(saveId),
        createdAt: message.createdAt || Date.now(),
    });
}

// ============================================================
// schedules（id = `${saveId}::${day}`）
// ============================================================

export function scheduleId(saveId, day) {
    return `${saveId}::${day}`;
}

export async function loadSchedule(app, saveId, day) {
    return getOne(app, STORES.schedules, scheduleId(saveId, day));
}

export function saveSchedule(app, profileKey, saveId, day, record) {
    return put(app, STORES.schedules, {
        ...record,
        id: scheduleId(saveId, day),
        profileKey: String(profileKey),
        saveId: String(saveId),
        day: Number(day),
        updatedAt: Date.now(),
    });
}

// ============================================================
// stageCards（跨档保留）
// ============================================================

export async function listStageCards(app, profileKey) {
    const rows = await getAll(app, STORES.stageCards);
    return rows
        .filter((r) => r && r.profileKey === String(profileKey))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function saveStageCard(app, profileKey, card) {
    return put(app, STORES.stageCards, {
        ...card,
        id: card.id || uid('sc'),
        profileKey: String(profileKey),
        createdAt: card.createdAt || Date.now(),
    });
}

export function removeStageCard(app, id) {
    return removeRow(app, STORES.stageCards, id);
}

// ============================================================
// 删档清理：把某个 save 的全部附属数据抹掉
// ============================================================

export async function purgeSaveData(app, saveId) {
    const stores = [STORES.events, STORES.timeline, STORES.projects, STORES.npcChats, STORES.schedules];
    for (const store of stores) {
        const rows = await getAll(app, store);
        for (const row of bySave(rows, saveId)) {
            await removeRow(app, store, row.id);
        }
    }
    return true;
}
