/**
 * 萤火 · 持久层
 *
 * 九张表，全部按「档案键」（`${userId}::${worldId}`）分档：
 *
 *   youtubeProfiles   低频（首配 / 图库绑定 / 头像映射 / 主题 / provider 开关）  一档一条
 *   youtubeFeeds      中频（每次刷新覆盖）                                       一档一条 ← 不累积
 *   youtubeVideos     外部视频：收藏 / 已展开详情 / 卡片重建                     一条一记录
 *   youtubeCreators   站内用户（频道主 / 观众 / AI 频道），externalId 稳定       一条一记录
 *   youtubeComments   评论（外部视频的 + 用户自己视频的）                        一条一记录
 *   youtubeLives      直播场次（一次 API 生成的弹幕池 + 主播词）                 一场一条
 *   youtubeUploads    用户和世界 AI 的作品（普通刷新永远不碰）                   一条一记录
 *   youtubeChats      站内闲聊消息（不可编辑 / 删除 / 重 roll）                  一条一记录
 *   youtubeDms        收到的私信                                                 一条一记录
 *
 * comments / chats 单独成表的原因和候鸟消息表一样：塞进视频记录里的话，
 * 每加一条都要重新序列化整条视频。
 */

import { STORES } from '../constants.js';
import { toPlain, uid } from '../utils.js';

/** appConfig.stores 用这个。声明了 stores 就必须在 js/apps/index.js 走 async 注册。 */
export const YOUTUBE_STORES = Object.freeze([
    { name: STORES.profiles, keyPath: 'id' },
    { name: STORES.feeds, keyPath: 'id' },
    { name: STORES.videos, keyPath: 'id' },
    { name: STORES.creators, keyPath: 'id' },
    { name: STORES.comments, keyPath: 'id' },
    { name: STORES.lives, keyPath: 'id' },
    { name: STORES.uploads, keyPath: 'id' },
    { name: STORES.chats, keyPath: 'id' },
    { name: STORES.dms, keyPath: 'id' },
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
        console.warn(`[youtube] 读 ${store} 失败`, err);
        return [];
    }
}

async function getOne(app, store, id) {
    const handle = db(app);
    if (!handle || !id) return null;
    try {
        return (await handle.get(store, String(id))) || null;
    } catch (err) {
        console.warn(`[youtube] 读 ${store} 单条失败`, err);
        return null;
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
        console.warn(`[youtube] 写 ${store} 失败`, err);
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
        console.warn(`[youtube] 删 ${store} 失败`, err);
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
        /** 首配门闸。false 一直显示引导页。 */
        configured: false,
        clipIds: [],
        promptIds: [],
        /** 用户爱看什么（进列表 prompt） */
        taste: '',
        /** 我的频道：昵称 / 粉丝数（JS 计算评论量的输入）/ 简介 */
        channel: { nickname: '', followers: 0, bio: '' },
        /** 绑定的图库图组（'' = 未绑定，用占位头像） */
        galleryGroupId: '',
        galleryGroupName: '',
        /** externalId → { code(图库编号), name(图片名) } 的持久映射，刷新不换脸 */
        avatarMap: {},
        /** 私信 provider 开关：{ [providerKey]: false } —— 只记「关掉的」 */
        providerPrefs: {},
        /** 主题 */
        themeId: 'paper',
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
    // 老档缺字段时补齐，加新字段后老用户不该崩
    const base = makeProfile(profileKey);
    return { ...base, ...row, channel: { ...base.channel, ...(row.channel || {}) } };
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
// videos —— 收藏 / 已展开详情的外部视频
// ============================================================

export async function listVideos(app, profileKey) {
    const rows = await getAll(app, STORES.videos);
    return byProfile(rows, profileKey).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function saveVideo(app, profileKey, video) {
    return put(app, STORES.videos, {
        ...video,
        id: video.id || uid('vd'),
        profileKey: String(profileKey),
        updatedAt: Date.now(),
    });
}

export function removeVideo(app, id) {
    return remove(app, STORES.videos, id);
}

export function getVideo(app, id) {
    return getOne(app, STORES.videos, id);
}

// ============================================================
// creators —— 站内用户（externalId 稳定，同名不换身份）
// ============================================================

export async function listCreators(app, profileKey) {
    const rows = await getAll(app, STORES.creators);
    return byProfile(rows, profileKey).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** 记录 id = `${profileKey}::${creatorId}`，天然幂等 */
export function creatorRecordId(profileKey, creatorId) {
    return `${profileKey}::${creatorId}`;
}

export function saveCreator(app, profileKey, creator) {
    if (!creator?.creatorId) return Promise.resolve(null);
    return put(app, STORES.creators, {
        ...creator,
        id: creatorRecordId(profileKey, creator.creatorId),
        profileKey: String(profileKey),
        updatedAt: Date.now(),
    });
}

export function getCreator(app, profileKey, creatorId) {
    return getOne(app, STORES.creators, creatorRecordId(profileKey, creatorId));
}

export function removeCreator(app, id) {
    return remove(app, STORES.creators, id);
}

// ============================================================
// comments —— 按 videoId 取，按 seq 排
// ============================================================

export async function listComments(app, videoId) {
    const rows = await getAll(app, STORES.comments);
    return rows
        .filter((r) => r && String(r.videoId) === String(videoId))
        // ★ 按 seq 而不是 createdAt —— 同一毫秒插两条时时间戳会撞
        .sort((a, b) => (a.seq || 0) - (b.seq || 0));
}

export function saveComment(app, profileKey, comment) {
    return put(app, STORES.comments, {
        ...comment,
        id: comment.id || uid('cm'),
        profileKey: String(profileKey),
        createdAt: comment.createdAt || Date.now(),
    });
}

export function removeComment(app, id) {
    return remove(app, STORES.comments, id);
}

export async function removeCommentsByVideo(app, videoId) {
    const rows = await listComments(app, videoId);
    for (const row of rows) {
        await remove(app, STORES.comments, row.id);
    }
    return rows.length;
}

// ============================================================
// lives —— 一场一条（id = `${profileKey}::${creatorId}::${windowStamp}`）
// ============================================================

export function liveRecordId(profileKey, creatorId, windowStamp) {
    return `${profileKey}::${creatorId}::${windowStamp}`;
}

export function getLive(app, profileKey, creatorId, windowStamp) {
    return getOne(app, STORES.lives, liveRecordId(profileKey, creatorId, windowStamp));
}

export function saveLive(app, profileKey, live) {
    if (!live?.creatorId || !live?.windowStamp) return Promise.resolve(null);
    return put(app, STORES.lives, {
        ...live,
        id: liveRecordId(profileKey, live.creatorId, live.windowStamp),
        profileKey: String(profileKey),
        updatedAt: Date.now(),
    });
}

/** 一个主播只留最近 3 场，旧场次清理掉（弹幕池不小） */
export async function pruneLives(app, profileKey, creatorId, keep = 3) {
    const rows = await getAll(app, STORES.lives);
    const mine = byProfile(rows, profileKey)
        .filter((r) => String(r.creatorId) === String(creatorId))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    for (const row of mine.slice(keep)) {
        await remove(app, STORES.lives, row.id);
    }
}

// ============================================================
// uploads —— 用户与世界 AI 的作品（普通刷新永远不碰）
// ============================================================

export async function listUploads(app, profileKey) {
    const rows = await getAll(app, STORES.uploads);
    return byProfile(rows, profileKey).sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
}

export function saveUpload(app, profileKey, upload) {
    return put(app, STORES.uploads, {
        ...upload,
        id: upload.id || uid('up'),
        profileKey: String(profileKey),
        updatedAt: Date.now(),
    });
}

export function removeUpload(app, id) {
    return remove(app, STORES.uploads, id);
}

export function getUpload(app, id) {
    return getOne(app, STORES.uploads, id);
}

// ============================================================
// chats —— 站内闲聊消息（按 peer 取，按 seq 排；没有编辑 / 删除入口）
// ============================================================

export async function listChatMessages(app, profileKey, peerId) {
    const rows = await getAll(app, STORES.chats);
    return byProfile(rows, profileKey)
        .filter((r) => String(r.peerId) === String(peerId))
        .sort((a, b) => (a.seq || 0) - (b.seq || 0));
}

/** 全部聊天消息（会话列表要按 peer 分组取最后一条） */
export async function listAllChatMessages(app, profileKey) {
    const rows = await getAll(app, STORES.chats);
    return byProfile(rows, profileKey).sort((a, b) => (a.seq || 0) - (b.seq || 0));
}

export function saveChatMessage(app, profileKey, message) {
    return put(app, STORES.chats, {
        ...message,
        id: message.id || uid('ch'),
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
        id: dm.id || uid('dm'),
        profileKey: String(profileKey),
        createdAt: dm.createdAt || Date.now(),
    });
}

export function removeDm(app, id) {
    return remove(app, STORES.dms, id);
}
