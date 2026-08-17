/**
 * 四叶草 · 状态单例
 *
 * 一份 `Vue.reactive`，所有组件读它、通过这里的 mutator 改它。
 *
 * ── 后台生成不需要队列 ────────────────────────────────────────────
 *
 * 生成任务**只往 store 写，不碰 DOM**。用户点了「生成」然后切出去，
 * 组件卸载了照样在写；切回来 Vue 按当前 state 重画，内容就在那儿。
 * 梦境编织原型为此写了个 `backgroundTaskQueue`，实现是把回调排进队列，
 * 组件一卸载回调里的 `document.getElementById` 就是 null，被 try/catch 吞掉,
 * 表现为「切出去再回来，刚生成的内容没了」。
 *
 * ── 档案切换 ──────────────────────────────────────────────────────
 *
 * `hydrate()` 每次都现算档案键，和上次不一样就整个换一份数据。
 * 不依赖任何「用户切换了」的事件 —— 只挂一个事件的实现等于挂在运气上。
 */

import {
    FEED_KINDS, FEED_SIZE, LAST_PROFILE_KEY, WISHLIST_MAX,
    FLOW_SOURCE, TABS,
} from './constants.js';
import { asArray, money, sameId, uid, tidyText } from './utils.js';
import * as dbx from './services/db.js';
import * as world from './services/world-context.js';
import * as ai from './services/ai-service.js';
import * as wallet from './services/wallet-service.js';
import { installShopContext } from './services/shop-context.js';
import {
    buildFeedPrompt, buildDetailPrompt, buildTheaterPrompt, buildTheaterSummaryPrompt,
} from './services/prompt-builder.js';

const Vue = typeof window !== 'undefined' ? window.Vue : null;
const reactive = (o) => (Vue?.reactive ? Vue.reactive(o) : o);

const state = reactive({
    /** hydrate 跑完了吗。false 时整个 App 显示骨架，不显示「空」。 */
    ready: false,
    /** SDK 没就绪 / 用户没世界观时的拦截文案 */
    blocked: '',

    identity: {
        userName: '我', worldName: '', currency: '金币',
        profileKey: '', ready: false,
    },
    profile: null,

    /** 首配门闸。true 时只画引导页。 */
    needsConfig: false,

    tab: 'market',
    /** '' | 'detail' | 'theater' | 'checkout' | 'wishlist' | 'orders' | 'flow' | 'theme' | 'settings' */
    view: '',

    feeds: { product: [], store: [] },
    feedCategory: { product: '全部', store: '全部' },
    /** 店铺列表当前看的是到店还是外送 */
    serveMode: 'dinein',

    favorites: [],
    orders: [],
    theaters: [],

    /** 打开的详情 { kind, item } —— item 是列表项或收藏项的引用 */
    detail: null,
    /** 打开的小剧场 */
    theater: null,

    balance: 0,

    loading: {
        product: false, store: false, detail: false,
        theater: false, summary: false, checkout: false,
    },
    /** 加载动画的文案，按种类换 */
    loadingLabel: '',
    error: '',
    toast: '',

    /** 引导页的临时状态，配完就没用了，不落盘 */
    onboarding: {
        step: 0,
        clips: [], prompts: [],
        clipIds: [], promptIds: [],
        taste: '',
        loading: false,
    },

    /** 弹窗 { type, payload }。自绘，不用 AcModal。 */
    modal: null,

    _app: null,
    _hydrating: false,
});

export function getState() {
    return state;
}

// ---------------------------------------------------------------------------
// 落盘
// ---------------------------------------------------------------------------

let saveTimer = null;

function persistProfile() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        if (state.profile) dbx.saveProfile(state._app, state.profile);
    }, 400);
}

export function flushPersist() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (state.profile) return dbx.saveProfile(state._app, state.profile);
    return Promise.resolve(null);
}

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------

/**
 * 读取当前身份 + 对应的那一档数据。
 *
 * ★ 只用 `_hydrating` 防并发，**不用** `_hydrated` 硬阻断 ——
 *   硬阻断会让首次失败之后永远没有第二次机会（AGENTS2 里天气 App 那个坑）。
 */
export async function hydrate(app) {
    if (app) state._app = app;
    if (state._hydrating) return;
    state._hydrating = true;

    try {
        const identity = world.readIdentity();
        Object.assign(state.identity, identity);

        if (!identity.ready) {
            state.blocked = identity.user
                ? '这个用户还没绑定世界观。去「设置 → 世界观」建一个，再到人设里绑上。'
                : '还没有用户人设。去「设置 → 人设」建一张卡。';
            state.ready = true;
            return;
        }
        state.blocked = '';

        const key = identity.profileKey;
        try { localStorage.setItem(LAST_PROFILE_KEY, key); } catch (_) { /* 隐私模式 */ }

        const profile = await dbx.loadProfile(state._app, key);
        if (!profile || !profile.configured) {
            // 没配过 → 引导页。**不**在这里造一条空档写盘：
            // 用户可能只是路过看一眼，写了盘反而会让「配没配过」变得不准。
            state.profile = profile || dbx.makeProfile(key);
            state.needsConfig = true;
            await prepareOnboarding();
            state.ready = true;
            return;
        }

        state.profile = profile;
        state.needsConfig = false;
        applyTheme();

        const [favorites, orders, theaters, feedP, feedS] = await Promise.all([
            dbx.listItems(state._app, key),
            dbx.listOrders(state._app, key),
            dbx.listTheaters(state._app, key),
            dbx.loadFeed(state._app, key, FEED_KINDS.product),
            dbx.loadFeed(state._app, key, FEED_KINDS.store),
        ]);
        state.favorites = favorites;
        state.orders = orders;
        state.theaters = theaters;
        state.feeds.product = asArray(feedP?.list);
        state.feeds.store = asArray(feedS?.list);

        await refreshBalance();
        publishContext();
        state.ready = true;
    } catch (err) {
        console.error('[shop] hydrate 失败', err);
        state.error = '读取数据失败：' + (err?.message || err);
        state.ready = true;
    } finally {
        state._hydrating = false;
    }
}

/**
 * 身份可能变了，重新对一次。
 *
 * 每次 App 被打开都调。档案键没变就什么都不做（很便宜）；
 * 变了就整个换一份 —— 这就是「换了默认用户要重新配置、换回来数据还在」的实现。
 */
export async function recheckIdentity() {
    const next = world.getProfileKey();
    if (next && next === state.identity.profileKey && state.profile) return;
    resetForProfileSwitch();
    await hydrate(state._app);
}

function resetForProfileSwitch() {
    state.ready = false;
    state.profile = null;
    // ★ 引导页的步数也要归零。少了这一句的表现很隐蔽：
    //   换个世界观之后确实回到了引导页，但停在上次填到的那一屏，
    //   用户看到的是「还想让它知道什么」而不是「欢迎来到四叶草」——
    //   他既看不到新世界观的名字，也不知道自己为什么被弹回来了。
    state.onboarding.step = 0;
    state.feeds.product = [];
    state.feeds.store = [];
    state.favorites = [];
    state.orders = [];
    state.theaters = [];
    state.detail = null;
    state.theater = null;
    state.view = '';
    state.tab = 'market';
    state.modal = null;
    state.error = '';
}

export async function refreshBalance() {
    const u = state.identity.user;
    if (!u?.id) return;
    await wallet.settle('user', u.id);
    state.balance = wallet.getBalance('user', u.id);
}

// ---------------------------------------------------------------------------
// 首配
// ---------------------------------------------------------------------------

/** 引导页要展示的候选：世界观夹子 + prompt 库条目 */
export async function prepareOnboarding() {
    state.onboarding.loading = true;
    try {
        state.onboarding.clips = world.listClips(state.identity.world);
        state.onboarding.prompts = await world.listLibraryPrompts();
        // 老档重进引导页时把之前的选择带回来
        if (state.profile) {
            state.onboarding.clipIds = [...asArray(state.profile.clipIds)];
            state.onboarding.promptIds = [...asArray(state.profile.promptIds)];
            state.onboarding.taste = state.profile.taste || '';
        }
    } finally {
        state.onboarding.loading = false;
    }
}

export function setOnboardingStep(step) {
    state.onboarding.step = Math.max(0, Math.min(2, step));
}

export function toggleClip(id) {
    const arr = state.onboarding.clipIds;
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(id);
}

export function toggleLibraryPrompt(id) {
    const arr = state.onboarding.promptIds;
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(id);
}

export function setTaste(text) {
    state.onboarding.taste = String(text || '');
}

/** 配完了 → 落盘 → 立刻生成两张列表 */
export async function finishOnboarding() {
    const key = state.identity.profileKey;
    if (!key) return false;

    const profile = state.profile || dbx.makeProfile(key);
    profile.id = key;
    profile.configured = true;
    profile.clipIds = [...state.onboarding.clipIds];
    profile.promptIds = [...state.onboarding.promptIds];
    profile.taste = state.onboarding.taste;
    state.profile = profile;

    await dbx.saveProfile(state._app, profile);
    state.needsConfig = false;
    applyTheme();
    await refreshBalance();
    publishContext();

    // 两张列表并行生成 —— 用户配完就想看到东西
    await Promise.all([
        generateFeed(FEED_KINDS.product),
        generateFeed(FEED_KINDS.store),
    ]);
    return true;
}

/** 用户主动重新配置（「我的 → 生成设置」） */
export async function reopenOnboarding() {
    state.needsConfig = true;
    state.onboarding.step = 0;
    await prepareOnboarding();
}

// ---------------------------------------------------------------------------
// 生成上下文
// ---------------------------------------------------------------------------

/** 拼 prompt 时要用的那一份「选中的世界观材料」 */
function generationContext() {
    const p = state.profile;
    const clips = world.listClips(state.identity.world)
        .filter((c) => asArray(p?.clipIds).includes(c.id));
    const promptIds = asArray(p?.promptIds);
    const prompts = asArray(state.onboarding.prompts).filter((x) => promptIds.includes(x.id));
    return {
        identity: state.identity,
        summary: world.readSummary(state.identity.world),
        clips,
        prompts,
        taste: p?.taste || '',
    };
}

/**
 * prompt 库条目在引导页之外可能还没拉过（刷新页面后直接进 App）。
 * 拼 prompt 前补一次，否则用户选中的附加提示词会静默丢失。
 */
async function ensurePromptsLoaded() {
    if (!asArray(state.profile?.promptIds).length) return;
    if (asArray(state.onboarding.prompts).length) return;
    state.onboarding.prompts = await world.listLibraryPrompts();
}

// ---------------------------------------------------------------------------
// 列表
// ---------------------------------------------------------------------------

/**
 * 生成一批列表。
 *
 * 刷新 = 整批换掉。没收藏的那些**就此消失**，不进数据库 ——
 * 这是用户明确要的「减少数据库压力」。收藏过的在 favorites 里，不受影响。
 */
export async function generateFeed(kind = FEED_KINDS.product) {
    if (state.loading[kind]) return false;
    state.loading[kind] = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const ctx = generationContext();
        const exclude = [
            ...state.feeds[kind].map((x) => x.name),
            ...state.favorites.filter((f) => f.kind === kind).map((f) => f.name),
        ].filter(Boolean);

        const { text } = buildFeedPrompt({
            ...ctx,
            kind,
            category: state.feedCategory[kind],
            exclude,
            size: FEED_SIZE,
        });

        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) {
            state.error = res.error;
            return false;
        }

        const rows = asArray(res.data?.items).filter((x) => x && x.name);
        if (!rows.length) {
            state.error = 'AI 这次一件都没给出来，再试一次';
            return false;
        }

        state.feeds[kind] = rows.map((row) => normalizeFeedItem(row, kind));
        await dbx.saveFeed(state._app, state.identity.profileKey, kind, state.feeds[kind]);
        return true;
    } catch (err) {
        console.error('[shop] 生成列表失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading[kind] = false;
    }
}

function normalizeFeedItem(row, kind) {
    const base = {
        id: uid(kind === FEED_KINDS.product ? 'pd' : 'st'),
        kind,
        name: String(row.name || '').trim(),
        category: String(row.category || '其他').trim(),
        blurb: String(row.blurb || '').trim(),
        tags: asArray(row.tags).map((t) => String(t || '').trim()).filter(Boolean).slice(0, 3),
        detail: null,
        favorited: false,
        source: 'ai',
        createdAt: Date.now(),
    };
    if (kind === FEED_KINDS.product) {
        const price = money(row.price);
        const original = money(row.originalPrice);
        return {
            ...base,
            brand: String(row.brand || '').trim(),
            price,
            // 原价必须大于现价，否则划线价没有意义（AI 经常给反）
            originalPrice: original > price ? original : 0,
        };
    }
    const serve = asArray(row.serve).filter((s) => s === 'dinein' || s === 'delivery');
    return {
        ...base,
        area: String(row.area || '').trim(),
        priceLevel: money(row.priceLevel),
        rating: Math.min(5, Math.max(3, Number(row.rating) || 4.5)),
        serve: serve.length ? serve : ['dinein'],
        signature: String(row.signature || '').trim(),
    };
}

export function setFeedCategory(kind, category) {
    state.feedCategory[kind] = category;
}

export function setServeMode(mode) {
    state.serveMode = mode === 'delivery' ? 'delivery' : 'dinein';
}

// ---------------------------------------------------------------------------
// 详情
// ---------------------------------------------------------------------------

/**
 * 打开详情。没有 detail 就现生成一份 —— 这就是那个「可爱的加载动画」背后干的事。
 */
export async function openDetail(kind, item) {
    if (!item) return;
    state.detail = { kind, item };
    state.view = 'detail';
    if (item.detail) return;
    await generateDetail(kind, item);
}

export async function generateDetail(kind, item, { force = false } = {}) {
    if (!item) return false;
    if (item.detail && !force) return true;
    state.loading.detail = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const { text } = buildDetailPrompt({ ...generationContext(), kind, item });
        const res = await ai.generateJson({ system: text, temperature: 0.9 });
        if (!res.ok) {
            state.error = res.error;
            return false;
        }
        item.detail = normalizeDetail(res.data, kind);
        // 收藏过的才落盘 —— 没收藏的详情跟着列表一起，刷新就没了
        if (item.favorited) await dbx.saveItem(state._app, state.identity.profileKey, item);
        else await dbx.saveFeed(state._app, state.identity.profileKey, kind, state.feeds[kind]);
        return true;
    } catch (err) {
        console.error('[shop] 生成详情失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.detail = false;
    }
}

function normalizeDetail(data, kind) {
    const common = {
        desc: tidyText(data?.desc),
        reviews: asArray(data?.reviews).slice(0, 5).map((r) => ({
            user: String(r?.user || '匿名'),
            rating: Math.min(5, Math.max(1, Number(r?.rating) || 5)),
            text: String(r?.text || ''),
            when: String(r?.when || ''),
        })),
        generatedAt: Date.now(),
    };
    if (kind === FEED_KINDS.product) {
        return {
            ...common,
            specs: asArray(data?.specs).map(kv).filter(Boolean).slice(0, 8),
            params: asArray(data?.params).map(kv).filter(Boolean).slice(0, 8),
            shipping: String(data?.shipping || ''),
            related: asArray(data?.related).map((x) => String(x || '')).filter(Boolean).slice(0, 4),
        };
    }
    return {
        ...common,
        hours: String(data?.hours || ''),
        address: String(data?.address || ''),
        phone: String(data?.phone || ''),
        menu: asArray(data?.menu).slice(0, 12).map((m) => ({
            id: uid('mi'),
            name: String(m?.name || ''),
            price: money(m?.price),
            desc: String(m?.desc || ''),
            signature: m?.signature === true,
        })).filter((m) => m.name),
    };
}

function kv(x) {
    const label = String(x?.label || '').trim();
    const value = String(x?.value || '').trim();
    return label && value ? { label, value } : null;
}

export function closeDetail() {
    state.detail = null;
    state.view = '';
}

// ---------------------------------------------------------------------------
// 收藏 / 手动添加
// ---------------------------------------------------------------------------

/**
 * 收藏 / 取消收藏。
 *
 * 收藏 = 把这一件从「会被刷新冲掉的列表」搬进 items 表。
 * 取消收藏时它还留在当前列表里（用户可能只是点错了），下次刷新才真的消失。
 */
export async function toggleFavorite(item) {
    if (!item) return;
    const key = state.identity.profileKey;
    if (item.favorited) {
        item.favorited = false;
        const hit = state.favorites.find((f) => sameId(f.id, item.id));
        if (hit) {
            await dbx.removeItem(state._app, hit.id);
            state.favorites = state.favorites.filter((f) => !sameId(f.id, hit.id));
        }
        showToast('已取消收藏');
        return;
    }
    item.favorited = true;
    const saved = await dbx.saveItem(state._app, key, item);
    if (saved) {
        state.favorites = [saved, ...state.favorites.filter((f) => !sameId(f.id, saved.id))];
    }
    showToast('已收藏');
}

/** 用户自己加的东西**自动收藏** —— 他手打了一遍，不该刷新就没 */
export async function addManualItem(kind, fields = {}) {
    const key = state.identity.profileKey;
    if (!key) return null;
    const item = normalizeFeedItem({
        ...fields,
        serve: kind === FEED_KINDS.store ? asArray(fields.serve) : undefined,
    }, kind);
    item.source = 'user';
    item.favorited = true;
    if (fields.desc) {
        item.detail = normalizeDetail({ desc: fields.desc, reviews: [] }, kind);
    }
    const saved = await dbx.saveItem(state._app, key, item);
    if (saved) {
        state.favorites = [saved, ...state.favorites];
        state.feeds[kind] = [saved, ...state.feeds[kind]];
        await dbx.saveFeed(state._app, key, kind, state.feeds[kind]);
    }
    showToast('已添加并收藏');
    return saved;
}

/** 改一件收藏的东西（用户可修改） */
export async function updateItem(item, patch = {}) {
    if (!item) return;
    Object.assign(item, patch);
    if (item.favorited) await dbx.saveItem(state._app, state.identity.profileKey, item);
    else await dbx.saveFeed(state._app, state.identity.profileKey, item.kind, state.feeds[item.kind]);
    showToast('已保存');
}

/** 重 roll 一件东西的详情 */
export async function rerollDetail() {
    const d = state.detail;
    if (!d) return;
    await generateDetail(d.kind, d.item, { force: true });
}

// ---------------------------------------------------------------------------
// 购物车 / 结账
// ---------------------------------------------------------------------------

export function cartItems() {
    return asArray(state.profile?.cart);
}

export function cartTotal() {
    return money(cartItems().reduce((sum, row) => sum + money(row.price) * (row.qty || 1), 0));
}

export function addToCart(item, opts = {}) {
    if (!state.profile) return;
    const cart = state.profile.cart || (state.profile.cart = []);
    const price = opts.price != null ? money(opts.price)
        : (item.kind === FEED_KINDS.product ? money(item.price) : money(item.priceLevel));
    const label = opts.label || item.name;

    const hit = cart.find((r) => r.itemId === item.id && r.label === label);
    if (hit) hit.qty = (hit.qty || 1) + 1;
    else {
        cart.push({
            id: uid('ci'),
            kind: item.kind,
            itemId: item.id,
            label,
            price,
            qty: 1,
            /** 快照：列表刷新后原件可能已经不在了，结账和小剧场都要用它 */
            snapshot: {
                id: item.id, kind: item.kind, name: item.name,
                brand: item.brand || '', area: item.area || '',
                blurb: item.blurb || '', price,
            },
            serve: opts.serve || (item.kind === FEED_KINDS.store ? state.serveMode : ''),
        });
    }
    persistProfile();
    showToast('已加入购物车');
}

export function setCartQty(rowId, qty) {
    const cart = state.profile?.cart;
    if (!cart) return;
    const row = cart.find((r) => sameId(r.id, rowId));
    if (!row) return;
    const next = Math.max(0, Math.floor(qty));
    if (next === 0) {
        state.profile.cart = cart.filter((r) => !sameId(r.id, rowId));
    } else {
        row.qty = next;
    }
    persistProfile();
}

export function clearCart() {
    if (!state.profile) return;
    state.profile.cart = [];
    persistProfile();
}

/**
 * 结账。
 *
 * 顺序很重要：**先扣钱，扣成功了才写订单**。
 * 反过来的话余额不足时会留下一张没付款的订单，而用户看不出区别。
 */
export async function checkout(opts = {}) {
    if (state.loading.checkout) return { ok: false };
    const rows = cartItems();
    if (!rows.length) return { ok: false, error: '购物车是空的' };

    state.loading.checkout = true;
    try {
        const total = cartTotal();
        const orderId = uid('od');
        const names = rows.map((r) => `${r.label}${r.qty > 1 ? `×${r.qty}` : ''}`).join('、');

        const paid = await wallet.charge({
            entityType: 'user',
            entityId: state.identity.user.id,
            amount: total,
            note: `四叶草 · ${names}`,
            sourceType: FLOW_SOURCE.purchase,
            sourceId: orderId,
            counterparty: { type: 'system', id: 'shop', name: '四叶草' },
        });
        if (!paid.ok) {
            state.error = paid.error;
            return { ok: false, error: paid.error };
        }

        const order = await dbx.saveOrder(state._app, state.identity.profileKey, {
            id: orderId,
            type: 'purchase',
            items: rows.map((r) => ({ ...r })),
            total,
            note: opts.note || '',
            status: 'paid',
        });
        state.orders = [order, ...state.orders];
        state.balance = paid.balance;
        clearCart();

        // 买到的东西可能在心愿单里 —— 自己买回来的也算完成
        for (const row of rows) markWishFulfilledByName(row.label, { self: true });
        publishContext();
        return { ok: true, order };
    } finally {
        state.loading.checkout = false;
    }
}

// ---------------------------------------------------------------------------
// 心愿单
// ---------------------------------------------------------------------------

export function wishlist() {
    return asArray(state.profile?.wishlist);
}

export function addWish(fields = {}) {
    if (!state.profile) return null;
    const list = state.profile.wishlist || (state.profile.wishlist = []);
    if (list.length >= WISHLIST_MAX) {
        showToast(`心愿单最多 ${WISHLIST_MAX} 条`);
        return null;
    }
    const wish = {
        id: uid('wi'),
        title: String(fields.title || '').trim(),
        note: String(fields.note || '').trim(),
        price: money(fields.price),
        fulfilled: false,
        fulfilledBy: '',      // aiPersonId 或 'self'
        fulfilledByName: '',
        anonymous: false,
        fulfilledAt: 0,
        createdAt: Date.now(),
    };
    if (!wish.title) return null;
    list.unshift(wish);
    persistProfile();
    publishContext();
    return wish;
}

export function removeWish(id) {
    if (!state.profile) return;
    state.profile.wishlist = wishlist().filter((w) => !sameId(w.id, id));
    persistProfile();
    publishContext();
}

export function updateWish(id, patch = {}) {
    const w = wishlist().find((x) => sameId(x.id, id));
    if (!w) return;
    Object.assign(w, patch);
    persistProfile();
    publishContext();
}

/**
 * 有人（AI 或用户自己）买下了心愿单里的某一条。
 *
 * `anonymous` 只是**对其他 AI 匿名** —— 买的人自己当然记得。
 * 实时 prompt 会按这条分别给每个 AI 生成不同的措辞（见 shop-context.js）。
 */
export function markWishFulfilled(wishId, { by, byName, anonymous = false } = {}) {
    const w = wishlist().find((x) => sameId(x.id, wishId));
    if (!w || w.fulfilled) return null;
    w.fulfilled = true;
    w.fulfilledBy = String(by || '');
    w.fulfilledByName = String(byName || '');
    w.anonymous = anonymous === true;
    w.fulfilledAt = Date.now();
    persistProfile();
    publishContext();
    return w;
}

/** 按名字模糊匹配一条未完成的心愿 */
export function findWishByName(name) {
    const key = String(name || '').trim();
    if (!key) return null;
    return wishlist().find((w) => !w.fulfilled
        && (w.title === key || w.title.includes(key) || key.includes(w.title))) || null;
}

function markWishFulfilledByName(name, { self = false, by = '', byName = '', anonymous = false } = {}) {
    const w = findWishByName(name);
    if (!w) return null;
    return markWishFulfilled(w.id, {
        by: self ? 'self' : by,
        byName: self ? (state.identity.userName || '我') : byName,
        anonymous,
    });
}

// ---------------------------------------------------------------------------
// 小剧场
// ---------------------------------------------------------------------------

export function openTheater(theater) {
    state.theater = theater;
    state.view = 'theater';
}

export function closeTheater() {
    state.theater = null;
    state.view = '';
}

/**
 * 生成一场小剧场。
 *
 * @param {object} opts
 * @param {string} opts.occasion    THEATER_OCCASIONS 里的 id
 * @param {object} opts.subject     { name, price, blurb }
 * @param {string[]} opts.aiIds     参演的 AI
 * @param {string} [opts.length]
 * @param {string} [opts.extra]
 */
export async function generateTheater(opts = {}) {
    if (state.loading.theater) return null;
    state.loading.theater = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const participants = asArray(opts.aiIds).map((id) => {
            const brief = world.listWorldAis(state.identity.world).find((a) => sameId(a.id, id));
            return { id, name: brief?.name || 'AI', desc: world.describeAi(id) };
        }).filter((p) => p.name);

        const { text } = buildTheaterPrompt({
            ...generationContext(),
            occasion: opts.occasion || 'purchase',
            subject: opts.subject || {},
            participants,
            length: opts.length || state.profile?.theaterLength || 'medium',
            userDesc: world.describeUser(state.identity.user),
            extra: opts.extra || '',
        });

        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) {
            state.error = res.error;
            return null;
        }

        const theater = normalizeTheater(res.data, {
            occasion: opts.occasion,
            subject: opts.subject,
            participants,
            orderId: opts.orderId || '',
        });
        const saved = await dbx.saveTheater(state._app, state.identity.profileKey, theater);
        state.theaters = [saved, ...state.theaters];
        state.theater = saved;
        state.view = 'theater';

        // 概要是给 murmur 用的，慢一点没关系，不挡用户看正文
        void generateSummary(saved);
        return saved;
    } catch (err) {
        console.error('[shop] 生成小剧场失败', err);
        state.error = err?.message || String(err);
        return null;
    } finally {
        state.loading.theater = false;
    }
}

function normalizeTheater(data, meta = {}) {
    return {
        id: uid('th'),
        title: String(data?.title || '一段小插曲').trim(),
        occasion: meta.occasion || 'purchase',
        subject: meta.subject || {},
        orderId: meta.orderId || '',
        /** 参演者带 id —— 将来「情景聊天」要按 id 找到人设，光有名字不够 */
        participants: asArray(meta.participants).map((p) => ({ id: p.id, name: p.name })),
        scenes: asArray(data?.scenes).map((s) => ({
            id: uid('sc'),
            place: String(s?.place || '').trim(),
            narration: tidyText(s?.narration),
            lines: asArray(s?.lines).map((l) => ({
                id: uid('ln'),
                speaker: String(l?.speaker || '').trim(),
                text: tidyText(l?.text),
            })).filter((l) => l.speaker && l.text),
        })).filter((s) => s.lines.length || s.narration),
        closing: tidyText(data?.closing),
        summary: '',
        favorited: false,
    };
}

/** 概要：注册到 murmur 的是它，不是全文 */
export async function generateSummary(theater) {
    if (!theater) return '';
    state.loading.summary = true;
    try {
        const { text } = buildTheaterSummaryPrompt(theater);
        const res = await ai.generateText({ system: text, temperature: 0.6 });
        if (!res.ok) return '';
        theater.summary = tidyText(res.raw).slice(0, 200);
        await dbx.saveTheater(state._app, state.identity.profileKey, theater);
        publishContext();
        return theater.summary;
    } finally {
        state.loading.summary = false;
    }
}

export async function saveTheaterEdits(theater) {
    if (!theater) return;
    await dbx.saveTheater(state._app, state.identity.profileKey, theater);
    const i = state.theaters.findIndex((t) => sameId(t.id, theater.id));
    if (i >= 0) state.theaters.splice(i, 1, theater);
    showToast('已保存');
}

export async function deleteTheater(id) {
    await dbx.removeTheater(state._app, id);
    state.theaters = state.theaters.filter((t) => !sameId(t.id, id));
    if (sameId(state.theater?.id, id)) closeTheater();
    publishContext();
}

/** 重 roll：同样的配置再生成一次，覆盖当前这场 */
export async function rerollTheater(theater) {
    if (!theater) return null;
    const next = await generateTheater({
        occasion: theater.occasion,
        subject: theater.subject,
        aiIds: asArray(theater.participants).map((p) => p.id),
        orderId: theater.orderId,
    });
    if (next) await deleteTheater(theater.id);
    return next;
}

// ---------------------------------------------------------------------------
// 主题
// ---------------------------------------------------------------------------

let _themeApplier = null;

/** 根组件把「往根节点写变量」的函数交给 store，store 只管什么时候调 */
export function registerThemeApplier(fn) {
    _themeApplier = fn;
    applyTheme();
}

export function applyTheme() {
    if (typeof _themeApplier === 'function') {
        _themeApplier(state.profile?.themeId || 'dawn', state.profile?.customColors || {});
    }
}

export function setThemeId(id) {
    if (!state.profile) return;
    state.profile.themeId = id;
    // 换预设时清掉单独改过的色，否则用户会看到「换了主题但有几个颜色没变」
    state.profile.customColors = {};
    applyTheme();
    persistProfile();
}

export function setCustomColor(token, value) {
    if (!state.profile) return;
    const map = state.profile.customColors || (state.profile.customColors = {});
    if (value) map[token] = value;
    else delete map[token];
    applyTheme();
    persistProfile();
}

export function applyColorBatch(colors = {}) {
    if (!state.profile) return;
    state.profile.customColors = { ...(state.profile.customColors || {}), ...colors };
    applyTheme();
    persistProfile();
}

export function resetColors() {
    if (!state.profile) return;
    state.profile.customColors = {};
    applyTheme();
    persistProfile();
}

// ---------------------------------------------------------------------------
// UI 杂项
// ---------------------------------------------------------------------------

export function setTab(id) {
    if (!TABS.some((t) => t.id === id)) return;
    state.tab = id;
    state.view = '';
    state.detail = null;
    state.theater = null;
}

export function setView(view) {
    state.view = view || '';
}

export function openModal(type, payload = {}) {
    state.modal = { type, payload };
}

export function closeModal() {
    state.modal = null;
}

let toastTimer = null;
export function showToast(text) {
    state.toast = String(text || '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { state.toast = ''; }, 1800);
}

export function clearError() {
    state.error = '';
}

// ---------------------------------------------------------------------------
// 对外广播
// ---------------------------------------------------------------------------

/**
 * 把「murmur 发消息时要现算的东西」挂到 window。
 *
 * 为什么不走 prompt-manager 的 pre 快照：心愿单是**随时在变**的，
 * 而且**对每个 AI 内容不一样**（谁买了、匿不匿名）。快照做不到这两件事。
 *
 * ★ 挂上去的是**读取器**不是快照。
 *   快照会在下一次心愿单变动时过期，而这个函数每次被调用都现读 state。
 *   所以 `publishContext()` 其实只需要在「第一次有数据了」时调一次，
 *   之后的每次变动都自动生效 —— 但多调几次也完全无害（幂等）。
 *
 * ★ 这件事**由 store 做，不由根组件做**。
 *   放组件里的话，用户没打开过这个 App 就没人挂，表现是
 *   「AI 从来不知道我想要什么，除非我先去逛一圈」，
 *   而这个因果关系用户根本猜不到。store 是背景预热也会走到的地方。
 */
export function publishContext() {
    installShopContext(() => ({
        ready: Boolean(state.profile?.configured && state.identity.ready),
        userName: state.identity.userName,
        currency: state.identity.currency,
        wishlist: asArray(state.profile?.wishlist),
        theaters: state.theaters,
        aiBalance: (aiId) => (aiId ? wallet.getBalance('ai', aiId) : null),
        // ★ 给原始订单，**不要**在这里拼好文案。
        //   「最近发生了什么」必须按对话方过滤（A 不能知道 B 送了什么），
        //   而这里拿不到 aiId。第一版就是在这儿拼好的，结果匿名礼物的
        //   商品名出现在了所有 AI 的上下文里 —— 浏览器探针抓到的就是这个。
        orders: state.orders.slice(0, 12),
    }));
}
