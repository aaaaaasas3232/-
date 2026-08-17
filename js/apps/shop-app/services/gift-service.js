/**
 * 四叶草 · 送礼与分享
 *
 * ── 这个文件必须能在「购物软件从没被打开过」的情况下工作 ──────────
 *
 * AI 在 murmur 里说「我给你买了个东西」时，用户人在聊天页，
 * 购物软件的组件根本没挂载、store 也没 hydrate。
 * 所以这里的每个函数都自己读档、自己写盘，**不依赖 store**；
 * 写完之后如果 store 恰好是热的，再顺手把内存里那份也更新掉。
 *
 * 反过来说：这里不能 import store（会成环，而且会把「打开过 App」变成隐含前提）。
 * store 那边通过 `onExternalChange` 注册一个回调来接收变化。
 */

import { FLOW_SOURCE, FEED_KINDS } from '../constants.js';
import { asArray, money, sameId, uid } from '../utils.js';
import * as dbx from './db.js';
import * as world from './world-context.js';
import * as wallet from './wallet-service.js';

/** store 热着的时候，写完盘顺手通知它 */
let _onChange = null;
export function onExternalChange(fn) {
    _onChange = typeof fn === 'function' ? fn : null;
}
function notify(kind, payload) {
    try { _onChange?.(kind, payload); } catch (err) { console.warn('[shop] 通知 store 失败', err); }
}

// ============================================================
// 往 murmur 写消息
// ============================================================

const VALID_MODES = new Set(['calendar', 'story']);

/**
 * 会话 mode：优先看 chat 里正打开的那个会话，否则回落 calendar。
 * （和 music 的 chat-bridge 同款做法）
 */
function resolveMode(aiId, preferred) {
    if (preferred && VALID_MODES.has(preferred)) return preferred;
    try {
        const el = document.querySelector(
            `.app-shell[data-app-id="chat"] [data-conversation-id="${CSS.escape(String(aiId))}"][data-mode]`,
        );
        const mode = el?.getAttribute('data-mode');
        if (mode && VALID_MODES.has(mode)) return mode;
    } catch (_) { /* CSS.escape 不支持时忽略 */ }
    return 'calendar';
}

async function addChatMessage(aiId, msg, mode) {
    const sdk = typeof window !== 'undefined' ? window.settingsSdk : null;
    if (!sdk?.chatMessages?.add || !aiId) return null;
    try {
        return await sdk.chatMessages.add(null, aiId, resolveMode(aiId, mode), msg);
    } catch (err) {
        console.warn('[shop] 写聊天消息失败', err);
        return null;
    }
}

/** 让聊天页把新消息画出来（chat 正开着才有可见效果） */
function pokeChat() {
    try {
        window.invalidateRendererCache?.('chat', null);
        window.__appRendererBridge?.syncNow?.({ force: true });
    } catch (_) { /* noop */ }
}

// ============================================================
// 分享商品 / 店铺
// ============================================================

/**
 * 把一件商品或一家店分享到某个 AI 的会话。
 * @param {{aiId:string, item:object, sender?:'user'|'ai', mode?:string, note?:string}} opts
 */
export async function shareItemToChat(opts = {}) {
    const { aiId, item, sender = 'user', mode, note = '' } = opts;
    if (!aiId || !item) return null;
    const currency = world.readIdentity().currency;
    const isProduct = item.kind === FEED_KINDS.product;

    const record = await addChatMessage(aiId, {
        sender,
        type: 'shop_item_share',
        content: `[${isProduct ? '商品' : '店铺'}] ${item.name}`,
        shopCard: {
            itemId: item.id,
            kind: item.kind,
            name: item.name,
            sub: isProduct ? (item.brand || item.category || '') : (item.area || item.category || ''),
            blurb: item.blurb || '',
            price: money(isProduct ? item.price : item.priceLevel),
            priceLabel: isProduct ? '' : '人均',
            currency,
            tags: asArray(item.tags).slice(0, 3),
            note,
        },
    }, mode);
    pokeChat();
    return record;
}

/**
 * 把一场小剧场的**概要**分享到会话。
 *
 * 只发概要不发全文：全文几百上千字，进了聊天记录之后每一轮都会
 * 被当成上下文重新发一遍，成本高得离谱，而且 AI 会开始复述它。
 */
export async function shareTheaterToChat(opts = {}) {
    const { aiId, theater, sender = 'user', mode } = opts;
    if (!aiId || !theater) return null;
    const record = await addChatMessage(aiId, {
        sender,
        type: 'shop_theater_share',
        content: `[小剧场] ${theater.title}`,
        theaterCard: {
            theaterId: theater.id,
            title: theater.title,
            summary: theater.summary || '',
            cast: asArray(theater.participants).map((p) => p.name).filter(Boolean),
            sceneCount: asArray(theater.scenes).length,
        },
    }, mode);
    pokeChat();
    return record;
}

// ============================================================
// 送礼
// ============================================================

/**
 * AI 送用户一样东西。**AI 的余额真的会扣。**
 *
 * 这是 murmur 里 `[送礼:...]` / `[匿名送礼:...]` 落地的地方。
 *
 * @param {object} opts
 * @param {string} opts.aiPersonId
 * @param {string} opts.name       商品名
 * @param {number} opts.price
 * @param {string} [opts.message]  附言
 * @param {boolean} [opts.anonymous]
 * @param {string} [opts.mode]
 * @returns {Promise<{ok:boolean, error?:string, order?:object, wish?:object}>}
 */
export async function aiGiftToUser(opts = {}) {
    const { aiPersonId, name, message = '', anonymous = false, mode } = opts;
    const identity = world.readIdentity();
    if (!identity.ready) return { ok: false, error: '购物软件还没配置好' };
    if (!aiPersonId || !name) return { ok: false, error: '缺少必要信息' };

    const sdk = window.settingsSdk;
    const aiPerson = sdk?.aiPersons?.get?.(aiPersonId);
    const aiName = aiPerson?.name || 'TA';

    const profile = await dbx.loadProfile(null, identity.profileKey);
    if (!profile?.configured) return { ok: false, error: '购物软件还没配置好' };

    // 心愿单里有同名的就按心愿单的价，AI 报的价可能离谱
    const wish = asArray(profile.wishlist).find((w) => !w.fulfilled
        && (w.title === name || w.title.includes(name) || name.includes(w.title)));
    const price = money(opts.price) || money(wish?.price) || 0;

    const orderId = uid('gf');
    if (price > 0) {
        const paid = await wallet.charge({
            entityType: 'ai',
            entityId: aiPersonId,
            amount: price,
            note: `四叶草 · 送给${identity.userName}：${name}`,
            sourceType: FLOW_SOURCE.giftIn,
            sourceId: orderId,
            counterparty: { type: 'user', id: identity.user.id, name: identity.userName },
        });
        if (!paid.ok) {
            // 余额不够就不买。**不要**降级成「先记账再说」——
            // 那会让「AI 的钱是真的」这条约定失效，用户很快就会发现
            return { ok: false, error: paid.error, insufficient: true };
        }
    }

    const order = await dbx.saveOrder(null, identity.profileKey, {
        id: orderId,
        type: 'gift-in',
        from: { type: 'ai', id: aiPersonId, name: aiName },
        anonymous: anonymous === true,
        items: [{ label: name, price, qty: 1 }],
        total: price,
        note: message,
        status: 'received',
        /** 用户还没在购物软件里看过它 —— 「我的」上会有个小圆点 */
        seen: false,
    });

    // 心愿单命中就标掉。匿名只是对**别的 AI** 匿名，买的人自己记得
    let fulfilledWish = null;
    if (wish) {
        wish.fulfilled = true;
        wish.fulfilledBy = aiPersonId;
        wish.fulfilledByName = aiName;
        wish.anonymous = anonymous === true;
        wish.fulfilledAt = Date.now();
        await dbx.saveProfile(null, profile);
        fulfilledWish = wish;
    }

    await addChatMessage(aiPersonId, {
        sender: 'ai',
        type: 'shop_gift',
        content: `[礼物] ${name}`,
        giftCard: {
            orderId,
            direction: 'in',
            name,
            price,
            currency: identity.currency,
            message,
            anonymous: anonymous === true,
            fromName: anonymous ? '一位朋友' : aiName,
            fromWish: Boolean(wish),
        },
    }, mode);
    pokeChat();

    notify('gift-in', { order, wish: fulfilledWish, profileKey: identity.profileKey });
    return { ok: true, order, wish: fulfilledWish, price };
}

/**
 * 用户送 AI 一样东西。用户的余额真的会扣。
 */
export async function userGiftToAi(opts = {}) {
    const { aiPersonId, item, price, message = '', mode } = opts;
    const identity = world.readIdentity();
    if (!identity.ready) return { ok: false, error: '还没配置好' };
    if (!aiPersonId || !item?.name) return { ok: false, error: '缺少必要信息' };

    const sdk = window.settingsSdk;
    const aiName = sdk?.aiPersons?.get?.(aiPersonId)?.name || 'TA';
    const amount = money(price != null ? price : item.price);

    const orderId = uid('gf');
    if (amount > 0) {
        const paid = await wallet.charge({
            entityType: 'user',
            entityId: identity.user.id,
            amount,
            note: `四叶草 · 送给${aiName}：${item.name}`,
            sourceType: FLOW_SOURCE.giftOut,
            sourceId: orderId,
            counterparty: { type: 'ai', id: aiPersonId, name: aiName },
        });
        if (!paid.ok) return { ok: false, error: paid.error, insufficient: true };
    }

    const order = await dbx.saveOrder(null, identity.profileKey, {
        id: orderId,
        type: 'gift-out',
        to: { type: 'ai', id: aiPersonId, name: aiName },
        items: [{ label: item.name, price: amount, qty: 1 }],
        total: amount,
        note: message,
        status: 'sent',
        seen: true,
    });

    await addChatMessage(aiPersonId, {
        sender: 'user',
        type: 'shop_gift',
        content: `[礼物] ${item.name}`,
        giftCard: {
            orderId,
            direction: 'out',
            name: item.name,
            price: amount,
            currency: identity.currency,
            message,
            anonymous: false,
            toName: aiName,
        },
    }, mode);
    pokeChat();

    notify('gift-out', { order, profileKey: identity.profileKey });
    return { ok: true, order };
}

// ============================================================
// 给 murmur 的 token 落地入口
// ============================================================

/**
 * 挂到 window，让 chat-app 的 `segmentsToMessages` 能调到。
 *
 * 和「一起听」同款解耦：chat **不 import** 购物软件，只读全局。
 * 购物软件没装 / 没配置时全是 optional chaining，不会炸。
 */
export function installGiftBridge() {
    if (typeof window === 'undefined') return;
    window.__shopGift = {
        aiGiftToUser,
        userGiftToAi,
        shareItemToChat,
        shareTheaterToChat,
        /** 用户当前 AI 有多少钱 —— 让 chat 侧能提前判断 */
        aiBalance: (aiId) => wallet.getBalance('ai', aiId),
        isReady: () => world.readIdentity().ready,
    };
}

/** 用户当前有多少未查看的礼物（「我的」小圆点） */
export async function countUnseenGifts(profileKey) {
    if (!profileKey) return 0;
    const orders = await dbx.listOrders(null, profileKey);
    return orders.filter((o) => o.type === 'gift-in' && o.seen === false).length;
}

/** 标记已看 */
export async function markGiftsSeen(profileKey) {
    const orders = await dbx.listOrders(null, profileKey);
    const unseen = orders.filter((o) => o.type === 'gift-in' && o.seen === false);
    for (const o of unseen) {
        await dbx.saveOrder(null, profileKey, { ...o, seen: true });
    }
    return unseen.length;
}

/** 找一件收藏里叫这个名字的东西（AI 送的东西尽量对上已有商品） */
export async function findItemByName(profileKey, name) {
    const items = await dbx.listItems(null, profileKey);
    const key = String(name || '').trim();
    return items.find((i) => sameId(i.name, key) || i.name.includes(key)) || null;
}
