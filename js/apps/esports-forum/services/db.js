/**
 * 声浪 · 持久层
 *
 * 八张表两种粒度：
 *   按档案键（profileKey = userId::worldId）：
 *     esfProfiles    一档案一条：首配 + 战队名册定制 + 锚点定义 + 社媒偏好 + 小号 + 人设改写台账
 *     esfStageCards  阶段卡（跨档保留）
 *   按存档（saveId，档案键冗余存一份便于清理）：
 *     esfSaves       档：时钟 / 属性 / 精力 / 赛季状态 / 荣誉 / 已发薪月
 *     esfPosts       论坛帖（用户帖 / AI 帖 / 战绩围观帖 / 赛后帖）
 *     esfComments    评论（按 seq 排）
 *     esfRatings     用户给选手打的分
 *     esfEvents      事件日志
 *     esfTimeline    大事记
 */

import { STORES } from '../constants.js';
import { toPlain, uid } from '../utils.js';

export const FORUM_STORES = Object.freeze(
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
        console.warn(`[esports-forum] 读 ${store} 失败`, err);
        return [];
    }
}

async function getOne(app, store, id) {
    const handle = db(app);
    if (!handle || !id) return null;
    try {
        return (await handle.get(store, String(id))) || null;
    } catch (err) {
        console.warn(`[esports-forum] 读 ${store} 单条失败`, err);
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
        console.warn(`[esports-forum] 写 ${store} 失败`, err);
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
        console.warn(`[esports-forum] 删 ${store} 失败`, err);
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
        gameId: '',                 // 选手游戏 ID
        realNameShown: '',          // 对外展示的本名（可空）
        region: '荣耀赛区',
        positionId: '',             // 用户位置（依游戏模型）
        modelId: 'moba',            // 游戏模型（moba / asym / shooter）
        gameName: '',               // 这个世界观里这款游戏叫什么
        formatId: 'sab',            // 主赛制
        startTier: 3,
        motto: '',                  // 赛场宣言
        honorsInit: '',             // 入行前荣誉（用户自定义，AI 不覆盖）
        // 战队定制
        teamNames: {},              // teamId -> 自定义名（缺省用名册默认名）
        userTeamId: 'team-1',
        aiReplacements: {},         // slotKey(teamId::slotIdx) -> { aiPersonId, name, snapshot, hash }
        // 锚点定义（段=赛事，点=节日）
        tournaments: [],
        festivals: [],
        // 薪资合同（用户可改）
        salary: { monthSalary: 0, winBonus: 0 },
        // 论坛身份：main + 小号
        identities: [],             // [{ id, name, isMain, createdAt }]
        // 社媒联动偏好
        socialPrefs: {
            syncTeammates: true,        // 队友在氧气/萤火与用户互关
            officialBlogs: true,        // 战队官博出现在氧气/萤火
            visibleTeamIds: [],         // 允许出现的其他战队
            hiddenPlayerIds: [],        // 显式隐藏的个人
        },
        // provider 开关（记「关掉的」）
        providerPrefs: {},
        // 人设改写台账：[{ saveId, entityType, entityId, line, at }]
        personaWrites: [],
        activeSaveId: '',
        themeId: 'stand',
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

export function makeSave(profileKey, { name, tier, attrs, clock }) {
    return {
        id: uid('esave'),
        profileKey: String(profileKey),
        name: String(name || '新档'),
        status: 'active',            // active / ended
        startTier: Number(tier) || 3,
        attrs: { ...(attrs || {}) },
        energy: 100,
        meals: { day: 1, lunch: false, dinner: false },
        clock: { ...(clock || {}) },
        // 赛季状态（season-engine 维护）
        season: null,
        seasonNo: 0,
        heatShifts: {},              // teamId -> 手动热度偏移（事件造成）
        // 事件系统状态
        shieldUntilDay: 0,
        triggeredOnceIds: [],
        lastTriggeredDayById: {},
        // 生涯
        honors: [],                  // [{ id, title, day, source }]
        salaryLastPeriod: 0,         // 已发薪的期数
        rankSummaries: [],           // 赛点写回的排位概要（最近 12 条）
        trainingDone: {},            // day -> true（训练赛完成标记）
        // 与外部系统的钩子
        worldTimelineIds: [],
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
// 按 saveId 的表
// ============================================================

function bySave(rows, saveId) {
    return rows.filter((r) => r && r.saveId === String(saveId));
}

export async function listPosts(app, saveId) {
    const rows = await getAll(app, STORES.posts);
    return bySave(rows, saveId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function savePost(app, profileKey, saveId, post) {
    return put(app, STORES.posts, {
        ...post,
        id: post.id || uid('efp'),
        profileKey: String(profileKey),
        saveId: String(saveId),
        createdAt: post.createdAt || Date.now(),
        updatedAt: Date.now(),
    });
}

export function removePost(app, id) {
    return removeRow(app, STORES.posts, id);
}

export async function listComments(app, saveId, postId) {
    const rows = await getAll(app, STORES.comments);
    return bySave(rows, saveId)
        .filter((r) => String(r.postId) === String(postId))
        .sort((a, b) => (a.seq || 0) - (b.seq || 0));
}

export function saveComment(app, profileKey, saveId, comment) {
    return put(app, STORES.comments, {
        ...comment,
        id: comment.id || uid('efc'),
        profileKey: String(profileKey),
        saveId: String(saveId),
        createdAt: comment.createdAt || Date.now(),
    });
}

export function removeComment(app, id) {
    return removeRow(app, STORES.comments, id);
}

export async function listRatings(app, saveId) {
    const rows = await getAll(app, STORES.ratings);
    return bySave(rows, saveId);
}

export function saveRating(app, profileKey, saveId, rating) {
    return put(app, STORES.ratings, {
        ...rating,
        id: rating.id || `${saveId}::${rating.playerId}`,
        profileKey: String(profileKey),
        saveId: String(saveId),
        updatedAt: Date.now(),
    });
}

export async function listEvents(app, saveId) {
    const rows = await getAll(app, STORES.events);
    return bySave(rows, saveId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function saveEvent(app, profileKey, saveId, event) {
    return put(app, STORES.events, {
        ...event,
        id: event.id || uid('efe'),
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
        id: entry.id || uid('eft'),
        profileKey: String(profileKey),
        saveId: String(saveId),
        createdAt: entry.createdAt || Date.now(),
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
        id: card.id || uid('efsc'),
        profileKey: String(profileKey),
        createdAt: card.createdAt || Date.now(),
    });
}

export function removeStageCard(app, id) {
    return removeRow(app, STORES.stageCards, id);
}

// ============================================================
// 删档清理
// ============================================================

export async function purgeSaveData(app, saveId) {
    const stores = [STORES.posts, STORES.comments, STORES.ratings, STORES.events, STORES.timeline];
    for (const store of stores) {
        const rows = await getAll(app, store);
        for (const row of bySave(rows, saveId)) {
            await removeRow(app, store, row.id);
        }
    }
    return true;
}
