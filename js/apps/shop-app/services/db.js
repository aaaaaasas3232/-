/**
 * 四叶草 · 持久层
 *
 * 五张表，全部按「档案键」分档（见 `world-context.js` 的说明）。
 *
 * ── 为什么不是一张大表 ────────────────────────────────────────────
 *
 * 梦境编织原型把全部内容塞进一个 key，改一个字就要重新序列化几 MB，
 * 于是它只能「全做完才存」，中途刷新全丢。这里拆开的判据是**写入频率**：
 *
 *   profiles   低频（改配置 / 心愿单 / 主题）  一档一条
 *   feeds      中频（每次刷新覆盖）            一档一种一条 ← 关键
 *   items      低频（只有收藏的才进来）        一件一条
 *   orders     每次下单追加                    一单一条
 *   theaters   每次生成追加                    一场一条
 *
 * ── feeds 为什么是「一条」而不是「一件一条」──────────────────────
 *
 * 用户要求「不收藏的商品刷新以后自动销毁，不进数据库」。
 * 但列表完全不落盘也不行 —— 切个 App 回来就空了，得重新烧一次 token。
 *
 * 折中：当前这批列表存成**一条会被覆盖的记录**。刷新 = 覆盖，
 * 旧的那批自然消失，数据库里永远只有一条，不累积。
 * 收藏则是把那一件复制进 items 表，从此和 feed 无关，刷新也带不走它。
 */

import { STORES } from '../constants.js';
import { toPlain, uid } from '../utils.js';

/** appConfig.stores 用这个。声明了 stores 就必须走 async 注册。 */
export const SHOP_STORES = Object.freeze([
    { name: STORES.profiles, keyPath: 'id' },
    { name: STORES.items, keyPath: 'id' },
    { name: STORES.feeds, keyPath: 'id' },
    { name: STORES.orders, keyPath: 'id' },
    { name: STORES.theaters, keyPath: 'id' },
]);

/**
 * 拿 db 句柄。
 *
 * 优先用 app 的 toolkit.db（它会校验「这张表是不是你声明过的」），
 * 兜底 window.myDb —— 有些路径（murmur 里 AI 送礼）拿不到 app 实例。
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
        console.warn(`[shop] 读 ${store} 失败`, err);
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
        console.warn(`[shop] 写 ${store} 失败`, err);
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
        console.warn(`[shop] 删 ${store} 失败`, err);
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
        /** 用户额外补充的口味描述 */
        taste: '',
        /** 主题：内置 id + 用户改过的单个色 */
        themeId: 'dawn',
        customColors: {},
        /** 心愿单 [{ id, title, note, price, fulfilledBy, anonymous, fulfilledAt }] */
        wishlist: [],
        /** 购物车 [{ id, kind, itemId, snapshot, qty }] */
        cart: [],
        /** 小剧场默认参演 AI */
        theaterAiIds: [],
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
        console.warn('[shop] 读档案失败', err);
        return null;
    }
}

export function saveProfile(app, profile) {
    if (!profile?.id) return Promise.resolve(null);
    return put(app, STORES.profiles, { ...profile, updatedAt: Date.now() });
}

// ============================================================
// feeds —— 一档一种一条，刷新即覆盖
// ============================================================

const feedId = (profileKey, kind) => `${profileKey}::${kind}`;

export async function loadFeed(app, profileKey, kind) {
    if (!profileKey) return null;
    const handle = db(app);
    if (!handle) return null;
    try {
        return (await handle.get(STORES.feeds, feedId(profileKey, kind))) || null;
    } catch (err) {
        console.warn('[shop] 读列表失败', err);
        return null;
    }
}

export function saveFeed(app, profileKey, kind, list) {
    if (!profileKey) return Promise.resolve(null);
    return put(app, STORES.feeds, {
        id: feedId(profileKey, kind),
        profileKey: String(profileKey),
        kind,
        list: Array.isArray(list) ? list : [],
        updatedAt: Date.now(),
    });
}

// ============================================================
// items —— 只有收藏的才进来
// ============================================================

export async function listItems(app, profileKey) {
    const rows = await getAll(app, STORES.items);
    return rows.filter((r) => r && r.profileKey === profileKey);
}

export function saveItem(app, profileKey, item) {
    const record = {
        ...item,
        id: item.id || uid('it'),
        profileKey: String(profileKey),
        favorited: true,
        updatedAt: Date.now(),
    };
    return put(app, STORES.items, record);
}

export function removeItem(app, id) {
    return remove(app, STORES.items, id);
}

// ============================================================
// orders —— 订单 / 礼物
// ============================================================

export async function listOrders(app, profileKey) {
    const rows = await getAll(app, STORES.orders);
    return rows
        .filter((r) => r && r.profileKey === profileKey)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function saveOrder(app, profileKey, order) {
    return put(app, STORES.orders, {
        ...order,
        id: order.id || uid('od'),
        profileKey: String(profileKey),
        createdAt: order.createdAt || Date.now(),
    });
}

export function removeOrder(app, id) {
    return remove(app, STORES.orders, id);
}

// ============================================================
// theaters —— 小剧场
// ============================================================

export async function listTheaters(app, profileKey) {
    const rows = await getAll(app, STORES.theaters);
    return rows
        .filter((r) => r && r.profileKey === profileKey)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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
 *
 * ★ 这是给**将来的「情景聊天」App** 留的口子：它需要按 id 直接取一场戏，
 *   而它不知道也不该知道购物软件的档案键。所以这里不过滤 profileKey。
 *   对外的入口是 appConfig.services.getTheater（见 index.js）。
 */
export async function getTheater(app, id) {
    const handle = db(app);
    if (!handle || !id) return null;
    try {
        return (await handle.get(STORES.theaters, String(id))) || null;
    } catch (err) {
        console.warn('[shop] 读小剧场失败', err);
        return null;
    }
}
