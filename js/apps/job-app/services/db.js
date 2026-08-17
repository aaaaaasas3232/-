/**
 * 灯塔 · 持久层
 *
 * 六张表，全部按「档案键」分档（见 `world-context.js` 的说明）。
 *
 * ── 拆表的判据是写入频率 ──────────────────────────────────────────
 *
 *   profiles     低频（改配置 / 主题 / prompt）        一档一条
 *   feeds        中频（每次刷新覆盖）                  一档一条 ← 关键
 *   items        低频（只有收藏的才进来）              一条一件
 *   posts        低频（最多 3 份工作，但改得勤）        一份一条
 *   recruiters   每条面试消息都要写                    一个 HR 一条
 *   theaters     每天一场                              一场一条
 *
 * ── feeds 为什么是「一条」而不是「一件一条」──────────────────────
 *
 * 用户要求「不收藏的职位刷新即销毁」。但列表完全不落盘也不行 ——
 * 切个 App 回来就空了，得重新烧一次 token。
 *
 * 折中：当前这批列表存成**一条会被覆盖的记录**。刷新 = 覆盖，
 * 旧的那批自然消失，数据库里永远只有一条，不累积。
 * 收藏则是把那一条复制进 items 表，从此和 feed 无关。
 *
 * ── recruiters 为什么独立成表 ─────────────────────────────────────
 *
 * HR 人设是「用户点了『跟他聊聊』才生成」的，生成之后要能一直聊下去，
 * 聊天记录会长。塞进 posts 里的话，每发一条消息就要重写整份工作记录
 * （含小剧场索引、日历、prompt），而那些完全没变。
 */

import { STORES } from '../constants.js';
import { toPlain, uid } from '../utils.js';

/** appConfig.stores 用这个。声明了 stores 就必须走 async 注册。 */
export const JOB_STORES = Object.freeze([
    { name: STORES.profiles, keyPath: 'id' },
    { name: STORES.feeds, keyPath: 'id' },
    { name: STORES.items, keyPath: 'id' },
    { name: STORES.posts, keyPath: 'id' },
    { name: STORES.recruiters, keyPath: 'id' },
    { name: STORES.theaters, keyPath: 'id' },
]);

/**
 * 拿 db 句柄。
 * 优先用 app 的 toolkit.db（它会校验「这张表是不是你声明过的」），
 * 兜底 window.myDb —— 有些路径（后台结算）拿不到 app 实例。
 */
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
        console.warn(`[job] 读 ${store} 失败`, err);
        return [];
    }
}

async function put(app, store, record) {
    const handle = db(app);
    if (!handle) return null;
    try {
        // ★ reactive 对象直接写 IndexedDB 会抛 DataCloneError（结构化克隆拒绝 Proxy）。
        //   剥一层收在这里，以后加字段也不会漏。
        const plain = toPlain(record);
        await handle.put(store, plain);
        return plain;
    } catch (err) {
        console.warn(`[job] 写 ${store} 失败`, err);
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
        console.warn(`[job] 删 ${store} 失败`, err);
        return false;
    }
}

// ============================================================
// profiles —— 一档一条
// ============================================================

export function makeProfile(profileKey) {
    return {
        id: String(profileKey),
        /** 首配完成了吗。没完成就一直显示引导页。 */
        configured: false,
        /** 首配时选中的夹子 id */
        clipIds: [],
        /** 首配时选中的 prompt 库条目 id */
        promptIds: [],
        /** 用户对自己求职方向的补充描述 */
        aim: '',
        /** 主题：内置 id + 用户改过的单个色 */
        themeId: 'dayshift',
        customColors: {},
        /**
         * 提示词管理页的用户改动。
         * `{ [cardId]: { active?: boolean, text?: string } }`
         * 只存**改过的**那几条，没改过的读默认值 —— 这样以后改默认文案，
         * 没动过的用户能跟着更新，动过的保留他自己的。
         */
        promptOverrides: {},
        /** 提示词卡片的显示顺序（只存 id 数组，没出现的按默认顺序排在后面） */
        promptOrder: [],
        /** 小剧场默认篇幅 */
        theaterLength: 'medium',
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
        // 老档缺字段时补齐：加了新字段之后老用户不该崩
        return { ...makeProfile(profileKey), ...row };
    } catch (err) {
        console.warn('[job] 读档案失败', err);
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
        console.warn('[job] 读职位列表失败', err);
        return null;
    }
}

export function saveFeed(app, profileKey, list) {
    if (!profileKey) return Promise.resolve(null);
    return put(app, STORES.feeds, {
        id: String(profileKey),
        profileKey: String(profileKey),
        list: Array.isArray(list) ? list : [],
        updatedAt: Date.now(),
    });
}

// ============================================================
// items —— 只有收藏的才进来
// ============================================================

export async function listItems(app, profileKey) {
    const rows = await getAll(app, STORES.items);
    return rows
        .filter((r) => r && r.profileKey === profileKey)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function saveItem(app, profileKey, item) {
    return put(app, STORES.items, {
        ...item,
        id: item.id || uid('jb'),
        profileKey: String(profileKey),
        favorited: true,
        updatedAt: Date.now(),
    });
}

export function removeItem(app, id) {
    return remove(app, STORES.items, id);
}

// ============================================================
// posts —— 已入职的工作
// ============================================================

export async function listPosts(app, profileKey) {
    const rows = await getAll(app, STORES.posts);
    return rows
        .filter((r) => r && r.profileKey === profileKey)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export function savePost(app, profileKey, post) {
    return put(app, STORES.posts, {
        ...post,
        id: post.id || uid('po'),
        profileKey: String(profileKey),
        createdAt: post.createdAt || Date.now(),
        updatedAt: Date.now(),
    });
}

export function removePost(app, id) {
    return remove(app, STORES.posts, id);
}

/**
 * 按 id 直接取一份工作（不限档）。
 * ★ 给以后的「博客 App / idol App」留的口子 —— 它们不知道也不该知道档案键。
 */
export async function getPost(app, id) {
    const handle = db(app);
    if (!handle || !id) return null;
    try {
        return (await handle.get(STORES.posts, String(id))) || null;
    } catch (err) {
        console.warn('[job] 读工作失败', err);
        return null;
    }
}

// ============================================================
// recruiters —— HR 人设 + 面试对话
// ============================================================

export async function listRecruiters(app, profileKey) {
    const rows = await getAll(app, STORES.recruiters);
    return rows
        .filter((r) => r && r.profileKey === profileKey)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function saveRecruiter(app, profileKey, hr) {
    return put(app, STORES.recruiters, {
        ...hr,
        id: hr.id || uid('hr'),
        profileKey: String(profileKey),
        createdAt: hr.createdAt || Date.now(),
        updatedAt: Date.now(),
    });
}

export function removeRecruiter(app, id) {
    return remove(app, STORES.recruiters, id);
}

// ============================================================
// theaters —— 每日小剧场
// ============================================================

export async function listTheaters(app, profileKey) {
    const rows = await getAll(app, STORES.theaters);
    return rows
        .filter((r) => r && r.profileKey === profileKey)
        .sort((a, b) => String(b.day || '').localeCompare(String(a.day || '')));
}

export function saveTheater(app, profileKey, theater) {
    return put(app, STORES.theaters, {
        ...theater,
        id: theater.id || uid('th'),
        profileKey: String(profileKey),
        createdAt: theater.createdAt || Date.now(),
        updatedAt: Date.now(),
    });
}

export function removeTheater(app, id) {
    return remove(app, STORES.theaters, id);
}

/**
 * 读单场小剧场（不限档）。
 * 和 `getPost` 一样，是给以后那两个 App 留的读取口。
 */
export async function getTheater(app, id) {
    const handle = db(app);
    if (!handle || !id) return null;
    try {
        return (await handle.get(STORES.theaters, String(id))) || null;
    } catch (err) {
        console.warn('[job] 读小剧场失败', err);
        return null;
    }
}
