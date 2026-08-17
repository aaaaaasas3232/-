/**
 * 候鸟 · 持久层
 *
 * 五张表，全部按「档案键」（`${userId}::${worldId}`）分档：
 *
 *   travelProfiles      低频（首配 / 主题 / 自定义配色）        一档一条
 *   travelFeeds         中频（每次刷新覆盖）                     一档一条 ← 不累积
 *   travelDestinations  低频（收藏或已展开详情的候选）           一条一记录
 *   travelTrips         每次买票追加（票据/同行/物品/状态/概要）  一趟一条
 *   travelMessages      高频（旁白 / 用户 / AI 消息）            一条一记录 ← 单独成表
 *
 * messages 单独成表的原因和情景剧场一样：塞进 trip 里的话，
 * 每发一条都要重新序列化整趟旅行。
 */

import { STORES } from '../constants.js';
import { toPlain, uid } from '../utils.js';

/** appConfig.stores 用这个。声明了 stores 就必须在 js/apps/index.js 走 async 注册。 */
export const TRAVEL_STORES = Object.freeze([
    { name: STORES.profiles, keyPath: 'id' },
    { name: STORES.feeds, keyPath: 'id' },
    { name: STORES.destinations, keyPath: 'id' },
    { name: STORES.trips, keyPath: 'id' },
    { name: STORES.messages, keyPath: 'id' },
]);

/** 优先 toolkit.db（校验表声明），兜底 window.myDb（外部预热路径拿不到 app 实例） */
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
        console.warn(`[travel] 读 ${store} 失败`, err);
        return [];
    }
}

async function put(app, store, record) {
    const handle = db(app);
    if (!handle) return null;
    try {
        // ★ reactive 对象直接写 IndexedDB 会抛 DataCloneError，剥壳收在这一处
        const plain = toPlain(record);
        await handle.put(store, plain);
        return plain;
    } catch (err) {
        console.warn(`[travel] 写 ${store} 失败`, err);
        return null;
    }
}

async function remove(app, store, id) {
    const handle = db(app);
    if (!handle || !id) return false;
    try {
        await handle.remove(store, id);
        return true;
    } catch (err) {
        console.warn(`[travel] 删 ${store} 失败`, err);
        return false;
    }
}

// ============================================================
// profiles —— 一档一条
// ============================================================

export function makeProfile(profileKey) {
    return {
        id: String(profileKey),
        /** 首配门闸。false 一直显示引导页。 */
        configured: false,
        /** 首配选中的世界观夹子 id */
        clipIds: [],
        /** 首配选中的 prompt 库条目 id */
        promptIds: [],
        /** 用户补充的旅行口味（喜欢什么样的地方） */
        taste: '',
        /** 主题 */
        themeId: 'sky',
        customColors: {},
        customThemes: [],
        activeCustomThemeId: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

export async function loadProfile(app, profileKey) {
    if (!profileKey) return null;
    const handle = db(app);
    if (!handle) return null;
    try {
        const row = await handle.get(STORES.profiles, String(profileKey));
        if (!row) return null;
        // 老档缺字段时补齐，加新字段后老用户不该崩
        return { ...makeProfile(profileKey), ...row };
    } catch (err) {
        console.warn('[travel] 读档案失败', err);
        return null;
    }
}

export function saveProfile(app, profile) {
    if (!profile?.id) return Promise.resolve(null);
    return put(app, STORES.profiles, { ...profile, updatedAt: Date.now() });
}

// ============================================================
// feeds —— 一档一条，刷新即覆盖
// ============================================================

export async function loadFeed(app, profileKey) {
    if (!profileKey) return null;
    const handle = db(app);
    if (!handle) return null;
    try {
        return (await handle.get(STORES.feeds, String(profileKey))) || null;
    } catch (err) {
        console.warn('[travel] 读候选列表失败', err);
        return null;
    }
}

export function saveFeed(app, profileKey, list, batch = 0) {
    if (!profileKey) return Promise.resolve(null);
    return put(app, STORES.feeds, {
        id: String(profileKey),
        profileKey: String(profileKey),
        list: Array.isArray(list) ? list : [],
        batch: Number(batch) || 0,
        updatedAt: Date.now(),
    });
}

// ============================================================
// destinations —— 收藏 / 已展开详情的候选
// ============================================================

export async function listDestinations(app, profileKey) {
    const rows = await getAll(app, STORES.destinations);
    return rows
        .filter((r) => r && r.profileKey === profileKey)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function saveDestination(app, profileKey, dest) {
    return put(app, STORES.destinations, {
        ...dest,
        id: dest.id || uid('ds'),
        profileKey: String(profileKey),
        updatedAt: Date.now(),
    });
}

export function removeDestination(app, id) {
    return remove(app, STORES.destinations, id);
}

// ============================================================
// trips —— 一趟一条
// ============================================================

export async function listTrips(app, profileKey) {
    const rows = await getAll(app, STORES.trips);
    return rows
        .filter((r) => r && r.profileKey === profileKey)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function saveTrip(app, profileKey, trip) {
    return put(app, STORES.trips, {
        ...trip,
        id: trip.id || uid('tp'),
        profileKey: String(profileKey),
        createdAt: trip.createdAt || Date.now(),
        updatedAt: Date.now(),
    });
}

export function removeTrip(app, id) {
    return remove(app, STORES.trips, id);
}

/**
 * 按 id 直接取一趟（不过滤档案键）。
 * 给 appConfig.services.getTrip 用 —— 调用方不知道也不该知道分档规则。
 */
export async function getTrip(app, id) {
    const handle = db(app);
    if (!handle || !id) return null;
    try {
        return (await handle.get(STORES.trips, String(id))) || null;
    } catch (err) {
        console.warn('[travel] 读行程失败', err);
        return null;
    }
}

// ============================================================
// messages —— 一条一记录，按 seq 排序
// ============================================================

export async function listMessages(app, tripId) {
    const rows = await getAll(app, STORES.messages);
    return rows
        .filter((r) => r && String(r.tripId) === String(tripId))
        // ★ 按 seq 而不是 createdAt —— 同一毫秒插两条时时间戳会撞
        .sort((a, b) => (a.seq || 0) - (b.seq || 0));
}

export function saveMessage(app, profileKey, message) {
    return put(app, STORES.messages, {
        ...message,
        id: message.id || uid('tm'),
        profileKey: String(profileKey),
        createdAt: message.createdAt || Date.now(),
    });
}

export function removeMessage(app, id) {
    return remove(app, STORES.messages, id);
}

/** 删一趟旅行时连消息一起清，不留孤儿记录 */
export async function removeMessagesByTrip(app, tripId) {
    const rows = await listMessages(app, tripId);
    for (const row of rows) {
        await remove(app, STORES.messages, row.id);
    }
    return rows.length;
}
