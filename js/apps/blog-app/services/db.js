/**
 * 氧气 · 持久层
 *
 * 十四张表分两类：
 *
 * 按档案键（`${userId}::${worldId}`）分档 —— 世界里的社交内容：
 *   blogProfiles   一档一条：首配 / 兴趣 / 关注规模 / provider 开关 / 主题 / 阅读设置 /
 *                  已解锁的隐藏彩蛋
 *   blogFeeds      一档一条：当前这批广场列表（标签级 stub），刷新即覆盖
 *   blogPosts      打开过 / 收藏 / 用户与 AI 的帖子（普通刷新不碰用户与 AI 帖）
 *   blogAuthors    站内作者与评论者（同名 = 同一个人，externalId 稳定）
 *   blogComments   评论（外部帖的 + 用户自己帖子的），按 seq 排
 *   blogHotSearch  一档一条：热搜词条 + 各词条下的帖子 stub
 *   blogChats      站内闲聊消息（不可编辑 / 删除 / 重 roll）
 *   blogDms        收到的私信
 *
 * 全局档（owner = global，属于屏幕前的人，不分用户卡 / 世界）：
 *   blogEssays     随笔（纯本地，永不调 AI）
 *   blogOxygen     氧气值单条记录（id 'global'）：开关 / 数值 / 流水 / 黑匣子与恶作剧开关
 *   blogRoomItems  冥想空间的纸条与自我标签
 *   blogGeometries 小听送的几何体（含抽屉）
 *   blogXiaoting   小听单条记录（id 'global'）：名字 / 颜色 / 画像 / 记忆 / 频控
 *   blogBlackbox   黑匣子条目
 */

import { GLOBAL_KEY, STORES } from '../constants.js';
import { toPlain, uid } from '../utils.js';

/** appConfig.stores 用这个。声明了 stores 就必须在 js/apps/index.js 走 async 注册。 */
export const BLOG_STORES = Object.freeze([
    { name: STORES.profiles, keyPath: 'id' },
    { name: STORES.feeds, keyPath: 'id' },
    { name: STORES.posts, keyPath: 'id' },
    { name: STORES.authors, keyPath: 'id' },
    { name: STORES.comments, keyPath: 'id' },
    { name: STORES.hot, keyPath: 'id' },
    { name: STORES.chats, keyPath: 'id' },
    { name: STORES.dms, keyPath: 'id' },
    { name: STORES.essays, keyPath: 'id' },
    { name: STORES.oxygen, keyPath: 'id' },
    { name: STORES.room, keyPath: 'id' },
    { name: STORES.geometries, keyPath: 'id' },
    { name: STORES.xiaoting, keyPath: 'id' },
    { name: STORES.blackbox, keyPath: 'id' },
]);

/** 优先 toolkit.db（校验表声明），兜底 window.myDb（外部路径拿不到 app 实例） */
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
        console.warn(`[blog] 读 ${store} 失败`, err);
        return [];
    }
}

async function getOne(app, store, id) {
    const handle = db(app);
    if (!handle || !id) return null;
    try {
        return (await handle.get(store, String(id))) || null;
    } catch (err) {
        console.warn(`[blog] 读 ${store} 单条失败`, err);
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
        console.warn(`[blog] 写 ${store} 失败`, err);
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
        console.warn(`[blog] 删 ${store} 失败`, err);
        return false;
    }
}

function byProfile(rows, profileKey) {
    const key = String(profileKey || '');
    return rows.filter((r) => r && r.profileKey === key);
}

// ============================================================
// profiles —— 一档一条
// ============================================================

export function makeProfile(profileKey) {
    return {
        id: String(profileKey),
        configured: false,
        clipIds: [],
        promptIds: [],
        /** 用户在氧气上关注什么话题（进列表 prompt） */
        interests: [],
        nickname: '',
        followers: 0,
        /** 私信 / 热搜 provider 开关：只记「关掉的」 */
        providerPrefs: {},
        /** 长文阅读设置 */
        reading: { fontSize: 16, lineHeight: 1.9, pageWidth: 92 },
        /**
         * 隐藏彩蛋（services/easter-eggs.js）：解锁过的 id + 上次混进来的批次号。
         * 不开新表，就存在这条档案记录里；老档案没有这两个字段，
         * loadProfile 的 { ...base, ...row } 会自动补成下面的默认值。
         */
        openedEggIds: [],
        eggLastBatch: 0,
        /** 主题 */
        themeId: 'air',
        customColors: {},
        customThemes: [],
        activeCustomThemeId: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

export async function loadProfile(app, profileKey) {
    if (!profileKey) return null;
    const row = await getOne(app, STORES.profiles, profileKey);
    if (!row) return null;
    const base = makeProfile(profileKey);
    return { ...base, ...row, reading: { ...base.reading, ...(row.reading || {}) } };
}

export function saveProfile(app, profile) {
    if (!profile?.id) return Promise.resolve(null);
    return put(app, STORES.profiles, { ...profile, updatedAt: Date.now() });
}

// ============================================================
// feeds —— 一档一条，刷新即覆盖
// ============================================================

export async function loadFeed(app, profileKey) {
    return getOne(app, STORES.feeds, profileKey);
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
// posts —— 打开过 / 收藏 / 用户与 AI 的帖子
// ============================================================

export async function listPosts(app, profileKey) {
    const rows = await getAll(app, STORES.posts);
    return byProfile(rows, profileKey).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function savePost(app, profileKey, post) {
    return put(app, STORES.posts, {
        ...post,
        id: post.id || uid('p'),
        profileKey: String(profileKey),
        updatedAt: Date.now(),
    });
}

export function removePost(app, id) {
    return remove(app, STORES.posts, id);
}

export function getPost(app, id) {
    return getOne(app, STORES.posts, id);
}

// ============================================================
// authors —— 站内作者 / 评论者（记录 id = `${profileKey}::${authorId}`）
// ============================================================

export function authorRecordId(profileKey, authorId) {
    return `${profileKey}::${authorId}`;
}

export async function listAuthors(app, profileKey) {
    const rows = await getAll(app, STORES.authors);
    return byProfile(rows, profileKey).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function saveAuthor(app, profileKey, author) {
    if (!author?.authorId) return Promise.resolve(null);
    return put(app, STORES.authors, {
        ...author,
        id: authorRecordId(profileKey, author.authorId),
        profileKey: String(profileKey),
        updatedAt: Date.now(),
    });
}

// ============================================================
// comments —— 按 postId 取，按 seq 排
// ============================================================

export async function listComments(app, postId) {
    const rows = await getAll(app, STORES.comments);
    return rows
        .filter((r) => r && String(r.postId) === String(postId))
        .sort((a, b) => (a.seq || 0) - (b.seq || 0));
}

export function saveComment(app, profileKey, comment) {
    return put(app, STORES.comments, {
        ...comment,
        id: comment.id || uid('c'),
        profileKey: String(profileKey),
        createdAt: comment.createdAt || Date.now(),
    });
}

export async function removeCommentsByPost(app, postId) {
    const rows = await listComments(app, postId);
    for (const row of rows) {
        await remove(app, STORES.comments, row.id);
    }
    return rows.length;
}

// ============================================================
// hot —— 一档一条：{ terms:[], updatedAt }
// ============================================================

export async function loadHot(app, profileKey) {
    return getOne(app, STORES.hot, profileKey);
}

export function saveHot(app, profileKey, record) {
    if (!profileKey) return Promise.resolve(null);
    return put(app, STORES.hot, {
        ...record,
        id: String(profileKey),
        profileKey: String(profileKey),
        updatedAt: Date.now(),
    });
}

// ============================================================
// chats —— 站内闲聊（按 peer 取，按 seq 排；没有编辑 / 删除入口）
// ============================================================

export async function listChatMessages(app, profileKey, peerId) {
    const rows = await getAll(app, STORES.chats);
    return byProfile(rows, profileKey)
        .filter((r) => String(r.peerId) === String(peerId))
        .sort((a, b) => (a.seq || 0) - (b.seq || 0));
}

export function saveChatMessage(app, profileKey, message) {
    return put(app, STORES.chats, {
        ...message,
        id: message.id || uid('m'),
        profileKey: String(profileKey),
        createdAt: message.createdAt || Date.now(),
    });
}

// ============================================================
// dms —— 收到的私信
// ============================================================

export async function listDms(app, profileKey) {
    const rows = await getAll(app, STORES.dms);
    return byProfile(rows, profileKey).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function saveDm(app, profileKey, dm) {
    return put(app, STORES.dms, {
        ...dm,
        id: dm.id || uid('d'),
        profileKey: String(profileKey),
        createdAt: dm.createdAt || Date.now(),
    });
}

export function removeDm(app, id) {
    return remove(app, STORES.dms, id);
}

// ============================================================
// 全局档：随笔
// ============================================================

export async function listEssays(app) {
    const rows = await getAll(app, STORES.essays);
    return rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function saveEssay(app, essay) {
    return put(app, STORES.essays, {
        owner: GLOBAL_KEY,
        ...essay,
        id: essay.id || uid('e'),
        updatedAt: Date.now(),
    });
}

export function removeEssay(app, id) {
    return remove(app, STORES.essays, id);
}

// ============================================================
// 全局档：氧气单条记录
// ============================================================

export function makeOxygenRecord() {
    return {
        id: GLOBAL_KEY,
        owner: GLOBAL_KEY,
        enabled: false,
        value: 100,
        blackboxEnabled: false,
        pranksEnabled: true,
        lastSettleDay: '',
        todayDay: '',
        todayCount: 0,
        shutdownCount: 0,
        ledger: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

export async function loadOxygen(app) {
    const row = await getOne(app, STORES.oxygen, GLOBAL_KEY);
    if (!row) return makeOxygenRecord();
    return { ...makeOxygenRecord(), ...row };
}

export function saveOxygen(app, record) {
    return put(app, STORES.oxygen, { ...record, id: GLOBAL_KEY, updatedAt: Date.now() });
}

// ============================================================
// 全局档：冥想空间的纸条 / 自我标签
// ============================================================

export async function listRoomItems(app) {
    const rows = await getAll(app, STORES.room);
    return rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export function saveRoomItem(app, item) {
    return put(app, STORES.room, {
        owner: GLOBAL_KEY,
        ...item,
        id: item.id || uid('n'),
    });
}

export function removeRoomItem(app, id) {
    return remove(app, STORES.room, id);
}

// ============================================================
// 全局档：几何体
// ============================================================

export async function listGeometries(app) {
    const rows = await getAll(app, STORES.geometries);
    return rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export function saveGeometry(app, geo) {
    return put(app, STORES.geometries, {
        owner: GLOBAL_KEY,
        ...geo,
        id: geo.id || uid('g'),
    });
}

export function removeGeometry(app, id) {
    return remove(app, STORES.geometries, id);
}

// ============================================================
// 全局档：小听单条记录
// ============================================================

export function makeXiaotingRecord() {
    return {
        id: GLOBAL_KEY,
        owner: GLOBAL_KEY,
        name: '',
        colorL: 85,
        personalityNotes: '',
        personaPromptOverride: '',
        giftPromptOverride: '',
        memoryFragments: [],
        taughtPhrases: [],
        sessionsCount: 0,
        negativeStreak: 0,
        positiveStreak: 0,
        appearedOnce: false,
        lastMood: 0,
        lastPrankAt: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

export async function loadXiaoting(app) {
    const row = await getOne(app, STORES.xiaoting, GLOBAL_KEY);
    if (!row) return makeXiaotingRecord();
    return { ...makeXiaotingRecord(), ...row };
}

export function saveXiaoting(app, record) {
    return put(app, STORES.xiaoting, { ...record, id: GLOBAL_KEY, updatedAt: Date.now() });
}

// ============================================================
// 全局档：黑匣子
// ============================================================

export async function listBlackbox(app) {
    const rows = await getAll(app, STORES.blackbox);
    return rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function saveBlackboxEntry(app, entry) {
    return put(app, STORES.blackbox, {
        owner: GLOBAL_KEY,
        ...entry,
        id: entry.id || uid('bb'),
        createdAt: entry.createdAt || Date.now(),
    });
}

export function removeBlackboxEntry(app, id) {
    return remove(app, STORES.blackbox, id);
}
