/**
 * 候鸟 · 状态单例
 *
 * 一份 Vue.reactive，所有组件读它、通过这里的 mutator 改它。
 * 生成任务只往 store 写不碰 DOM —— 用户切出去，组件卸载了照样在写。
 *
 * ── 档案切换 ──────────────────────────────────────────────────────
 * `hydrate()` 每次现算档案键，和上次不一样就整份换掉。
 * 不依赖任何「用户切换了」的事件。
 *
 * ── AI 调用边界 ───────────────────────────────────────────────────
 * 首配完成 → 只生成候选列表；点候选 → 才生成详情；确认买票 → 才有行程；
 * 点「生成小剧场」→ 才调小剧场；对话页每一段都由用户点击触发。
 * 没有任何定时器会调 AI。
 */

import { FEED_SIZE, TABS, TRIP_STATUS } from './constants.js';
import { asArray, clamp, money, sameId, tidyText, uid } from './utils.js';
import * as dbx from './services/db.js';
import * as world from './services/world-context.js';
import * as ai from './services/ai-service.js';
import * as wallet from './services/ticket-service.js';
import * as shopBridge from './services/shop-bridge.js';
import {
    buildAiReplyPrompt, buildDetailPrompt, buildFeedPrompt,
    buildNarrationPrompt, buildSummaryPrompt, buildTheaterPrompt,
} from './services/prompt-builder.js';
import { isFinalSlot, isTripDone, normalizeDays } from './services/trip-flow.js';
import { syncTripSummaryPrompts, unregisterTripSummaryPrompt } from './services/app-prompts.js';
import { registerGeoCandidate } from '@/src/core/world-profile.js';

const Vue = typeof window !== 'undefined' ? window.Vue : null;
const reactive = (o) => (Vue?.reactive ? Vue.reactive(o) : o);

const state = reactive({
    /** hydrate 跑完了吗。false 显示骨架。 */
    ready: false,
    /** SDK 没就绪 / 没绑世界观时的拦截文案 */
    blocked: '',

    identity: {
        userName: '我', userAvatar: '', userAvatarBg: '',
        worldName: '', currency: '金币',
        profileKey: '', ready: false, userId: '',
    },
    profile: null,
    needsConfig: false,

    tab: 'explore',
    /** '' | 'detail' | 'prep' | 'chat' | 'theme' */
    view: '',
    /** 探索页的分段：'feed' | 'saved' */
    exploreSeg: 'feed',

    /** 当前候选列表（刷新即覆盖） */
    feed: [],
    feedBatch: 0,
    /** 收藏 / 已展开详情的候选 */
    destinations: [],
    /** 全部行程（含足迹） */
    trips: [],
    /** 打开的候选（详情页） */
    activeDest: null,
    /** 打开的行程（准备板 / 对话页） */
    activeTripId: '',
    /** 当前行程的消息 */
    messages: [],

    balance: 0,

    loading: {
        feed: false, detail: false, theater: false,
        narration: false, reply: false, summary: '',   // summary 存 tripId，区分是哪趟在转
        register: '',                                   // 同上
    },
    error: '',
    toast: '',

    onboarding: {
        step: 0,
        clips: [], prompts: [],
        clipIds: [], promptIds: [],
        taste: '',
        loading: false,
    },

    /** 弹窗 { type, payload } */
    modal: null,

    /** 出行准备板的临时选择（进准备板时从 trip 读入，出发时写回） */
    prep: {
        days: 3,
        companionIds: [],
        itemIds: [],
        extra: '',
        shopItems: [],
        shopLoading: false,
        showPrompt: false,
    },

    _app: null,
    _hydrating: false,
});

export function getState() {
    return state;
}

export function currentTrip() {
    return state.trips.find((t) => sameId(t.id, state.activeTripId)) || null;
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

async function persistTrip(trip) {
    if (!trip) return;
    await dbx.saveTrip(state._app, state.identity.profileKey, trip);
}

// ---------------------------------------------------------------------------
// 启动 / 切档
// ---------------------------------------------------------------------------

/**
 * 读取当前身份 + 那一档数据。
 * 只用 `_hydrating` 防并发，不用 `_hydrated` 硬阻断 ——
 * 硬阻断会让首次失败后永远没有第二次机会。
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
        const profile = await dbx.loadProfile(state._app, key);
        if (!profile || !profile.configured) {
            // 没配过 → 引导页。不在这里写盘：用户可能只是路过看一眼。
            state.profile = profile || dbx.makeProfile(key);
            state.needsConfig = true;
            await prepareOnboarding();
            state.ready = true;
            return;
        }

        state.profile = profile;
        state.needsConfig = false;
        applyTheme();

        const [feedRow, destinations, trips] = await Promise.all([
            dbx.loadFeed(state._app, key),
            dbx.listDestinations(state._app, key),
            dbx.listTrips(state._app, key),
        ]);
        state.feed = asArray(feedRow?.list);
        state.feedBatch = Number(feedRow?.batch) || 0;
        state.destinations = destinations;
        state.trips = trips;

        await refreshBalance();
        syncSummaryPrompts();
        state.ready = true;
    } catch (err) {
        console.error('[travel] hydrate 失败', err);
        state.error = '读取数据失败：' + (err?.message || err);
        state.ready = true;
    } finally {
        state._hydrating = false;
    }
}

/** 每次 App 被打开重新对一次身份；键没变就什么都不做 */
export async function recheckIdentity() {
    const next = world.getProfileKey();
    if (next && next === state.identity.profileKey && state.profile) return;
    resetForProfileSwitch();
    await hydrate(state._app);
}

function resetForProfileSwitch() {
    state.ready = false;
    state.profile = null;
    state.onboarding.step = 0;      // ★ 引导步数归零，否则新档停在上次填到的那一屏
    state.feed = [];
    state.feedBatch = 0;
    state.destinations = [];
    state.trips = [];
    state.messages = [];
    state.activeDest = null;
    state.activeTripId = '';
    state.view = '';
    state.tab = 'explore';
    state.exploreSeg = 'feed';
    state.modal = null;
    state.error = '';
}

export async function refreshBalance() {
    const u = state.identity.user;
    if (!u?.id) return;
    await wallet.settle(u.id);
    state.balance = wallet.getBalance(u.id);
}

/** murmur 折叠区的旅行概要卡：按当前档案重放（幂等） */
function syncSummaryPrompts() {
    const toolkit = state._app?.toolkit;
    if (!toolkit) return;
    syncTripSummaryPrompts(toolkit, state.trips);
}

// ---------------------------------------------------------------------------
// 首配
// ---------------------------------------------------------------------------

export async function prepareOnboarding() {
    state.onboarding.loading = true;
    try {
        state.onboarding.clips = world.listClips(state.identity.world);
        state.onboarding.prompts = await world.listLibraryPrompts();
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

/** 配完 → 落盘 → 只生成候选列表（详情、行程都等用户点） */
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
    syncSummaryPrompts();

    // ★ 生成失败也不退回引导页 —— 配置本身已经成功了
    return generateFeed();
}

export async function reopenOnboarding() {
    state.needsConfig = true;
    state.onboarding.step = 0;
    await prepareOnboarding();
}

// ---------------------------------------------------------------------------
// 生成上下文
// ---------------------------------------------------------------------------

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

/** 刷新页面后直接进 App 时，prompt 库条目可能还没拉过，补一次 */
async function ensurePromptsLoaded() {
    if (!asArray(state.profile?.promptIds).length) return;
    if (asArray(state.onboarding.prompts).length) return;
    state.onboarding.prompts = await world.listLibraryPrompts();
}

// ---------------------------------------------------------------------------
// 候选列表
// ---------------------------------------------------------------------------

/**
 * 生成一批候选。刷新 = 整批换掉；收藏和已去过的记录不受影响
 * （它们在 destinations / trips 里，不在 feed 里）。
 */
export async function generateFeed() {
    if (state.loading.feed) return false;
    state.loading.feed = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const ctx = generationContext();
        const existingGeo = world.listWorldGeo(state.identity.world);
        const exclude = [
            ...state.feed.map((c) => `${c.placeName}·${c.locationName}`),
            ...state.destinations.map((d) => `${d.placeName}·${d.locationName}`),
        ].filter(Boolean);

        const { text } = buildFeedPrompt({ ...ctx, existingGeo, exclude, size: FEED_SIZE });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) {
            state.error = res.error;
            return false;
        }

        const rows = asArray(res.data?.candidates)
            .filter((x) => x && x.placeName && x.locationName);
        if (!rows.length) {
            state.error = 'AI 这次一个候选都没给出来，再试一次';
            return false;
        }

        state.feed = rows.map((row) => normalizeCandidate(row, existingGeo));
        state.feedBatch += 1;
        await dbx.saveFeed(state._app, state.identity.profileKey, state.feed, state.feedBatch);
        return true;
    } catch (err) {
        console.error('[travel] 生成候选失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.feed = false;
    }
}

function normalizeCandidate(row, existingGeo) {
    const placeName = String(row.placeName || '').trim();
    const locationName = String(row.locationName || '').trim();
    // ★ 「已有」不信 AI 的 reusePlace，按名字和 nook 里的真实地点对一遍
    const hit = world.findPlaceByName(existingGeo, placeName);
    const hitLoc = hit ? world.findLocationByName(hit, locationName) : null;
    return {
        id: uid('cd'),
        placeName,
        locationName,
        kind: String(row.kind || '').trim(),
        blurb: String(row.blurb || '').trim(),
        tags: asArray(row.tags).map((t) => String(t || '').trim()).filter(Boolean).slice(0, 3),
        existingPlaceId: hit ? hit.id : '',
        existingLocationId: hitLoc ? hitLoc.id : '',
        detail: null,
        favorited: false,
        createdAt: Date.now(),
    };
}

export function setExploreSeg(seg) {
    state.exploreSeg = seg === 'saved' ? 'saved' : 'feed';
}

/**
 * 收藏 = 把候选搬进 destinations 表，刷新带不走。
 * 取消收藏时若没展开过详情且不在当前 feed 里，就整条删掉。
 */
export async function toggleFavorite(candidate) {
    if (!candidate) return;
    const key = state.identity.profileKey;
    const saved = state.destinations.find((d) => sameId(d.id, candidate.id));

    if (candidate.favorited && saved) {
        candidate.favorited = false;
        saved.favorited = false;
        const inFeed = state.feed.some((c) => sameId(c.id, candidate.id));
        if (!saved.detail && !inFeed) {
            await dbx.removeDestination(state._app, saved.id);
            state.destinations = state.destinations.filter((d) => !sameId(d.id, saved.id));
        } else {
            await dbx.saveDestination(state._app, key, saved);
        }
        showToast('已取消收藏');
        return;
    }

    candidate.favorited = true;
    const record = saved || { ...candidate };
    record.favorited = true;
    const stored = await dbx.saveDestination(state._app, key, record);
    if (stored && !saved) state.destinations = [stored, ...state.destinations];
    // feed 里的那份也标上，UI 同步
    const feedHit = state.feed.some((c) => sameId(c.id, candidate.id));
    if (feedHit) await dbx.saveFeed(state._app, key, state.feed, state.feedBatch);
    showToast('已收藏');
}

// ---------------------------------------------------------------------------
// 详情
// ---------------------------------------------------------------------------

/** 打开详情。没有 detail 才现生成（不点不生成）。 */
export async function openDetail(candidate) {
    if (!candidate) return;
    const saved = state.destinations.find((d) => sameId(d.id, candidate.id));
    state.activeDest = saved || candidate;
    state.view = 'detail';
    if (!state.activeDest.detail) {
        await generateDetail(state.activeDest);
    }
}

export async function generateDetail(dest, { force = false } = {}) {
    if (!dest || state.loading.detail) return false;
    if (dest.detail && !force) return true;
    state.loading.detail = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const ctx = generationContext();
        const { text } = buildDetailPrompt({ ...ctx, candidate: dest });
        const res = await ai.generateJson({ system: text, temperature: 0.9 });
        if (!res.ok) {
            state.error = res.error;
            return false;
        }
        dest.detail = normalizeDetail(res.data);
        await saveDestSnapshot(dest);
        return true;
    } catch (err) {
        console.error('[travel] 生成详情失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.detail = false;
    }
}

function normalizeDetail(data) {
    return {
        environment: tidyText(data?.environment),
        features: asArray(data?.features).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 5),
        risks: tidyText(data?.risks),
        stayTime: String(data?.stayTime || '').trim(),
        ticketPrice: money(data?.ticketPrice),
        notes: tidyText(data?.notes),
        suggestedItems: asArray(data?.suggestedItems).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 4),
        generatedAt: Date.now(),
    };
}

/** 展开过详情的候选进 destinations 表存住（token 已经花了，别丢） */
async function saveDestSnapshot(dest) {
    const key = state.identity.profileKey;
    const saved = state.destinations.find((d) => sameId(d.id, dest.id));
    if (saved) {
        Object.assign(saved, dest);
        await dbx.saveDestination(state._app, key, saved);
    } else {
        const stored = await dbx.saveDestination(state._app, key, { ...dest });
        if (stored) state.destinations = [stored, ...state.destinations];
    }
    // feed 里的同一条也带上 detail，回列表再点开不用重新生成
    if (state.feed.some((c) => sameId(c.id, dest.id))) {
        await dbx.saveFeed(state._app, key, state.feed, state.feedBatch);
    }
}

export function closeDetail() {
    state.activeDest = null;
    state.view = '';
}

// ---------------------------------------------------------------------------
// 机票
// ---------------------------------------------------------------------------

/** 这个候选是否已经有一张没出发的票（有就别再卖第二张） */
export function findPreparedTrip(dest) {
    if (!dest) return null;
    return state.trips.find((t) => (
        t.status === TRIP_STATUS.prepared
        && t.destination?.placeName === dest.placeName
        && t.destination?.locationName === dest.locationName
    )) || null;
}

/**
 * 确认购票。先扣钱，扣成功了才写行程 ——
 * 反过来的话余额不足会留下一张没付款的票。
 */
export async function confirmBuyTicket(dest) {
    if (!dest?.detail) return { ok: false, error: '详情还没生成' };

    const existed = findPreparedTrip(dest);
    if (existed) {
        openPrep(existed.id);
        return { ok: true, trip: existed, duplicated: true };
    }

    const tripId = uid('tp');
    const price = money(dest.detail.ticketPrice);
    const paid = await wallet.buyTicket({
        userId: state.identity.user?.id,
        tripId,
        amount: price,
        note: `候鸟机票 · ${dest.placeName}·${dest.locationName}`,
    });
    if (!paid.ok) {
        state.error = paid.error || '扣款失败';
        return { ok: false, error: state.error, short: paid.short };
    }

    const trip = {
        id: tripId,
        status: TRIP_STATUS.prepared,
        destination: {
            candidateId: dest.id,
            placeName: dest.placeName,
            locationName: dest.locationName,
            kind: dest.kind,
            blurb: dest.blurb,
            existingPlaceId: dest.existingPlaceId || '',
            existingLocationId: dest.existingLocationId || '',
            detail: dest.detail ? { ...dest.detail } : null,
        },
        ticket: {
            price,
            currency: state.identity.currency,
            sourceType: 'travel-ticket',
            sourceId: tripId,
            paidAt: Date.now(),
            duplicated: paid.duplicated === true,
        },
        days: 3,
        companions: [],
        items: [],
        extra: '',
        theater: null,
        /** 已生成的旁白段数。0 = 还没出发。 */
        slotCount: 0,
        background: { url: '', blur: 6 },
        note: '',
        summary: '',
        nook: null,
        startedAt: 0,
        completedAt: 0,
    };
    const stored = await dbx.saveTrip(state._app, state.identity.profileKey, trip);
    state.trips = [stored, ...state.trips];
    state.balance = money(paid.balance);
    showToast('票已出好，去准备行装吧');
    openPrep(stored.id);
    return { ok: true, trip: stored };
}

/**
 * 删除行程。未出发的自动退款；出发过的不退。
 * 足迹（completed）删除也走这里，二次确认由 UI 层做。
 */
export async function deleteTrip(tripId) {
    const trip = state.trips.find((t) => sameId(t.id, tripId));
    if (!trip) return false;

    if (trip.status === TRIP_STATUS.prepared) {
        await wallet.refundTicket({ userId: state.identity.user?.id, tripId: trip.id });
        await refreshBalance();
    }

    await dbx.removeMessagesByTrip(state._app, trip.id);
    await dbx.removeTrip(state._app, trip.id);
    unregisterTripSummaryPrompt(state._app?.toolkit, trip.id);
    state.trips = state.trips.filter((t) => !sameId(t.id, trip.id));
    if (sameId(state.activeTripId, trip.id)) {
        state.activeTripId = '';
        state.messages = [];
        state.view = '';
    }
    showToast(trip.status === TRIP_STATUS.prepared ? '已退票删除' : '已删除');
    return true;
}

// ---------------------------------------------------------------------------
// 出行准备板
// ---------------------------------------------------------------------------

export function openPrep(tripId) {
    const trip = state.trips.find((t) => sameId(t.id, tripId));
    if (!trip) return;
    state.activeTripId = trip.id;
    state.prep.days = normalizeDays(trip.days);
    state.prep.companionIds = asArray(trip.companions).map((c) => c.id);
    state.prep.itemIds = asArray(trip.items).map((it) => it.id);
    state.prep.extra = trip.extra || '';
    state.prep.showPrompt = false;
    state.view = 'prep';
    void loadShopItems();
}

/** 四叶草物品清单（准备板懒加载，四叶草不在也不报错） */
export async function loadShopItems() {
    if (state.prep.shopLoading) return;
    state.prep.shopLoading = true;
    try {
        state.prep.shopItems = await shopBridge.listPurchasedItems();
    } finally {
        state.prep.shopLoading = false;
    }
}

export function setPrepDays(days) {
    state.prep.days = normalizeDays(days);
    void persistPrep();
}

export function togglePrepCompanion(aiId) {
    const arr = state.prep.companionIds;
    const i = arr.indexOf(aiId);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(aiId);
    void persistPrep();
}

export function togglePrepItem(itemId) {
    const arr = state.prep.itemIds;
    const i = arr.indexOf(itemId);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(itemId);
    void persistPrep();
}

export function setPrepExtra(text) {
    state.prep.extra = String(text || '');
    void persistPrep();
}

export function togglePrepPrompt() {
    state.prep.showPrompt = !state.prep.showPrompt;
}

/** 把准备板的选择写回 trip（配置改了小剧场还在 —— 重生成由用户决定） */
async function persistPrep() {
    const trip = currentTrip();
    if (!trip || trip.status !== TRIP_STATUS.prepared) return;
    trip.days = normalizeDays(state.prep.days);
    trip.companions = world.listWorldAis(state.identity.world)
        .filter((a) => state.prep.companionIds.includes(a.id))
        .map((a) => ({ id: a.id, name: a.name, avatar: a.avatar, avatarBg: a.avatarBg }));
    trip.items = asArray(state.prep.shopItems)
        .filter((it) => state.prep.itemIds.includes(it.id))
        .map((it) => ({ id: it.id, label: it.label, qty: 1 }));
    trip.extra = state.prep.extra;
    await persistTrip(trip);
}

/** 小剧场 prompt 的上下文（预览和发送共用同一份） */
export function theaterPromptContext(opinion = '') {
    const trip = currentTrip();
    if (!trip) return null;
    return {
        ...generationContext(),
        trip,
        userDesc: world.describeUser(state.identity.user),
        companionDescs: asArray(trip.companions).map((c) => ({ id: c.id, desc: world.describeAi(c.id) })),
        opinion,
    };
}

/**
 * 生成 / 重 roll 出发小剧场。重 roll 必须带意见（UI 层弹意见框）。
 */
export async function generateTheater(opinion = '') {
    const trip = currentTrip();
    if (!trip || state.loading.theater) return false;
    state.loading.theater = true;
    state.error = '';
    await ensurePromptsLoaded();
    await persistPrep();

    try {
        const ctx = theaterPromptContext(opinion);
        const { text } = buildTheaterPrompt(ctx);
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) {
            state.error = res.error;
            return false;
        }
        trip.theater = normalizeTheater(res.data);
        await persistTrip(trip);
        return true;
    } catch (err) {
        console.error('[travel] 生成小剧场失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.theater = false;
    }
}

function normalizeTheater(data) {
    return {
        title: String(data?.title || '出发').trim(),
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
        generatedAt: Date.now(),
    };
}

export async function saveTheaterEdits() {
    const trip = currentTrip();
    if (!trip) return;
    await persistTrip(trip);
    showToast('已保存');
}

export async function deleteTheater() {
    const trip = currentTrip();
    if (!trip) return;
    trip.theater = null;
    await persistTrip(trip);
    showToast('已删除小剧场');
}

/**
 * 正式出发：锁定配置，行程转 ongoing，进对话页。
 * 不自动生成第一段旁白 —— 那也是一次 AI 调用，由用户在对话页点。
 */
export async function departTrip() {
    const trip = currentTrip();
    if (!trip || trip.status !== TRIP_STATUS.prepared) return false;
    await persistPrep();
    trip.status = TRIP_STATUS.ongoing;
    trip.startedAt = Date.now();
    await persistTrip(trip);
    await openTripChat(trip.id);
    showToast('出发了');
    return true;
}

// ---------------------------------------------------------------------------
// 旅行对话页
// ---------------------------------------------------------------------------

export async function openTripChat(tripId) {
    const trip = state.trips.find((t) => sameId(t.id, tripId));
    if (!trip) return;
    state.activeTripId = trip.id;
    state.messages = await dbx.listMessages(state._app, trip.id);
    state.view = 'chat';
}

export function closeTripView() {
    state.activeTripId = '';
    state.messages = [];
    state.view = '';
}

function nextSeq() {
    return state.messages.reduce((max, m) => Math.max(max, m.seq || 0), 0) + 1;
}

async function appendMessage(message) {
    const stored = await dbx.saveMessage(state._app, state.identity.profileKey, {
        ...message,
        seq: nextSeq(),
    });
    if (stored) state.messages = [...state.messages, stored];
    return stored;
}

/** 旁白 prompt 上下文（预览 == 发送） */
export function narrationPromptContext(slotIndex, opinion = '') {
    const trip = currentTrip();
    if (!trip) return null;
    return {
        ...generationContext(),
        trip,
        slotIndex,
        isFinal: isFinalSlot(slotIndex, trip.days),
        messages: state.messages,
        userDesc: world.describeUser(state.identity.user),
        companionDescs: asArray(trip.companions).map((c) => ({ id: c.id, desc: world.describeAi(c.id) })),
        opinion,
    };
}

/**
 * 继续旁白：生成当前 slot 的旁白并推进进度。
 * 生成到最后一段后旅行自动结束（completed，输入区关闭）。
 */
export async function continueNarration() {
    const trip = currentTrip();
    if (!trip || trip.status !== TRIP_STATUS.ongoing || state.loading.narration) return false;
    state.loading.narration = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const slotIndex = Number(trip.slotCount) || 0;
        const ctx = narrationPromptContext(slotIndex);
        const { text } = buildNarrationPrompt(ctx);
        const res = await ai.generateJson({ system: text, temperature: 0.95 });
        if (!res.ok) {
            state.error = res.error;
            return false;
        }
        const narration = tidyText(res.data?.narration);
        if (!narration) {
            state.error = '这一段是空的，再试一次';
            return false;
        }

        await appendMessage({
            tripId: trip.id,
            role: 'narration',
            text: narration,
            slotIndex,
        });
        trip.slotCount = slotIndex + 1;

        if (isTripDone(trip.slotCount, trip.days)) {
            trip.status = TRIP_STATUS.completed;
            trip.completedAt = Date.now();
            showToast('旅行结束了，这一趟已收进足迹');
        }
        await persistTrip(trip);
        return true;
    } catch (err) {
        console.error('[travel] 生成旁白失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.narration = false;
    }
}

/** 用户自己发消息。不调 AI。 */
export async function sendUserMessage(text) {
    const trip = currentTrip();
    const body = String(text || '').trim();
    if (!trip || trip.status !== TRIP_STATUS.ongoing || !body) return false;
    await appendMessage({
        tripId: trip.id,
        role: 'user',
        userName: state.identity.userName,
        text: body,
    });
    return true;
}

/**
 * 让某位同行 AI 回复（长按消息选的，或输入区点的）。
 * @param {string} aiId
 * @param {object} [replyTo] 被长按的那条消息
 */
export async function generateAiReply(aiId, replyTo = null) {
    const trip = currentTrip();
    if (!trip || trip.status !== TRIP_STATUS.ongoing || state.loading.reply) return false;
    const companion = asArray(trip.companions).find((c) => sameId(c.id, aiId));
    if (!companion) return false;

    state.loading.reply = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const ctx = {
            ...generationContext(),
            trip,
            targetAi: { id: companion.id, name: companion.name, desc: world.describeAi(companion.id) },
            messages: state.messages,
            userDesc: world.describeUser(state.identity.user),
            companionDescs: asArray(trip.companions).map((c) => ({ id: c.id, desc: world.describeAi(c.id) })),
            replyTo: replyTo ? {
                role: replyTo.role,
                speaker: replyTo.role === 'user' ? state.identity.userName : replyTo.aiName,
                text: replyTo.text,
            } : null,
        };
        const { text } = buildAiReplyPrompt(ctx);
        const res = await ai.generateJson({ system: text, temperature: 0.95 });
        if (!res.ok) {
            state.error = res.error;
            return false;
        }
        const body = tidyText(res.data?.text);
        if (!body) {
            state.error = '这个角色没说出话来，再试一次';
            return false;
        }
        await appendMessage({
            tripId: trip.id,
            role: 'ai',
            aiId: companion.id,
            aiName: companion.name,
            aiAvatar: companion.avatar || '',
            aiAvatarBg: companion.avatarBg || '',
            text: body,
        });
        return true;
    } catch (err) {
        console.error('[travel] 生成回复失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.reply = false;
    }
}

/** 编辑任意一条消息的文本 */
export async function editMessage(messageId, text) {
    const msg = state.messages.find((m) => sameId(m.id, messageId));
    const body = String(text || '').trim();
    if (!msg || !body) return false;
    msg.text = body;
    msg.editedAt = Date.now();
    await dbx.saveMessage(state._app, state.identity.profileKey, msg);
    showToast('已保存');
    return true;
}

/** 删除一条消息（旁白删除不回退进度 —— 那一段已经「过去了」） */
export async function deleteMessage(messageId) {
    const msg = state.messages.find((m) => sameId(m.id, messageId));
    if (!msg) return false;
    await dbx.removeMessage(state._app, msg.id);
    state.messages = state.messages.filter((m) => !sameId(m.id, msg.id));
    return true;
}

/**
 * 重 roll 一条旁白 / AI 消息。意见必填由 UI 层保证（弹意见框）。
 * 只换正文，不改进度、不改位置。
 */
export async function rerollMessage(messageId, opinion = '') {
    const trip = currentTrip();
    const msg = state.messages.find((m) => sameId(m.id, messageId));
    if (!trip || !msg) return false;
    // ★ 锁必须在 try 之前查 —— 进了 try 再查的话，finally 会把别人的锁清掉
    if (state.loading.narration || state.loading.reply) return false;
    if (msg.role === 'user') return false;   // 用户消息不重 roll

    const before = state.messages.slice(0, state.messages.indexOf(msg));
    state.error = '';
    await ensurePromptsLoaded();

    try {
        if (msg.role === 'narration') {
            state.loading.narration = true;
            const ctx = {
                ...narrationPromptContext(Number(msg.slotIndex) || 0, opinion),
                messages: before,
            };
            const { text } = buildNarrationPrompt(ctx);
            const res = await ai.generateJson({ system: text, temperature: 1 });
            if (!res.ok) { state.error = res.error; return false; }
            const narration = tidyText(res.data?.narration);
            if (!narration) { state.error = '这一段是空的，再试一次'; return false; }
            msg.text = narration;
        } else if (msg.role === 'ai') {
            state.loading.reply = true;
            const companion = asArray(trip.companions).find((c) => sameId(c.id, msg.aiId));
            const ctx = {
                ...generationContext(),
                trip,
                targetAi: {
                    id: msg.aiId,
                    name: msg.aiName,
                    desc: companion ? world.describeAi(companion.id) : '',
                },
                messages: before,
                userDesc: world.describeUser(state.identity.user),
                companionDescs: asArray(trip.companions).map((c) => ({ id: c.id, desc: world.describeAi(c.id) })),
                opinion,
            };
            const { text } = buildAiReplyPrompt(ctx);
            const res = await ai.generateJson({ system: text, temperature: 1 });
            if (!res.ok) { state.error = res.error; return false; }
            const body = tidyText(res.data?.text);
            if (!body) { state.error = '这个角色没说出话来，再试一次'; return false; }
            msg.text = body;
        }

        msg.rerolledAt = Date.now();
        await dbx.saveMessage(state._app, state.identity.profileKey, msg);
        return true;
    } catch (err) {
        console.error('[travel] 重 roll 失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.narration = false;
        state.loading.reply = false;
    }
}

/** 旅行背景（按 trip 保存） */
export async function setTripBackground(url, blur) {
    const trip = currentTrip();
    if (!trip) return;
    trip.background = {
        url: String(url || ''),
        blur: clamp(blur, 0, 20),
    };
    await persistTrip(trip);
    showToast('背景已更新');
}

// ---------------------------------------------------------------------------
// 足迹 / 概要 / Nook 注册
// ---------------------------------------------------------------------------

export async function setTripNote(tripId, note) {
    const trip = state.trips.find((t) => sameId(t.id, tripId));
    if (!trip) return;
    trip.note = String(note || '').trim();
    await persistTrip(trip);
    showToast('备注已保存');
}

/**
 * 生成这趟旅行的概要：写进每位同行 AI 的经历区 + 注册成 murmur 的旅行卡。
 * 概要是给 AI 当记忆的，不是全过程 —— 全过程留在对话页。
 */
export async function generateTripSummary(tripId) {
    const trip = state.trips.find((t) => sameId(t.id, tripId));
    if (!trip || trip.status !== TRIP_STATUS.completed || state.loading.summary) return false;
    state.loading.summary = trip.id;
    state.error = '';

    try {
        const messages = await dbx.listMessages(state._app, trip.id);
        const { text } = buildSummaryPrompt({ trip, messages });
        const res = await ai.generateText({ system: text, temperature: 0.6 });
        if (!res.ok) {
            state.error = res.error;
            return false;
        }
        trip.summary = tidyText(res.raw).slice(0, 300);
        await persistTrip(trip);

        // 写进每位同行 AI 的经历区（幂等：同段概要不重复追加）
        const dest = trip.destination || {};
        const line = `【旅行】和${state.identity.userName}一起去过${dest.placeName}·${dest.locationName}：${trip.summary}`;
        for (const c of asArray(trip.companions)) {
            await world.appendAiExperience(c.id, line);
        }

        syncSummaryPrompts();
        showToast('概要已生成，murmur 的候鸟折叠组里能看到');
        return true;
    } catch (err) {
        console.error('[travel] 生成概要失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.summary = '';
    }
}

/**
 * 把去过的地点注册进 nook（Place + Location 两层，幂等）。
 * 已有地点只新增场所 pin；新地点先建地图再建场所；重复点击复用。
 */
export async function registerTripToNook(tripId) {
    const trip = state.trips.find((t) => sameId(t.id, tripId));
    if (!trip || state.loading.register) return { ok: false, error: '行程不存在' };
    const dest = trip.destination || {};
    state.loading.register = trip.id;

    try {
        const result = await registerGeoCandidate({
            place: {
                id: dest.existingPlaceId || '',
                name: dest.placeName,
                summary: dest.detail?.environment ? dest.detail.environment.split('\n')[0] : dest.blurb,
            },
            location: {
                id: dest.existingLocationId || '',
                name: dest.locationName,
                summary: dest.blurb || dest.detail?.stayTime || '',
            },
            worldId: state.identity.worldId,
        });
        if (!result.ok) {
            state.error = result.error || '注册失败';
            return result;
        }
        trip.nook = {
            placeId: result.place?.id || '',
            locationId: result.location?.id || '',
            createdPlace: result.createdPlace === true,
            createdLocation: result.createdLocation === true,
            registeredAt: Date.now(),
        };
        await persistTrip(trip);
        showToast(result.createdPlace
            ? '已在世界里登记新地点和场所'
            : (result.createdLocation ? '已在已有地点下登记新场所' : '这个地方世界里已经有了，直接复用'));
        return result;
    } catch (err) {
        console.error('[travel] 注册 Nook 失败', err);
        state.error = err?.message || String(err);
        return { ok: false, error: state.error };
    } finally {
        state.loading.register = '';
    }
}

// ---------------------------------------------------------------------------
// 主题
// ---------------------------------------------------------------------------

let _themeApplier = null;

/** 根组件把「往根节点写变量」的函数交给 store */
export function registerThemeApplier(fn) {
    _themeApplier = fn;
    applyTheme();
}

export function applyTheme() {
    if (typeof _themeApplier === 'function') {
        _themeApplier(state.profile?.themeId || 'sky', state.profile?.customColors || {});
    }
}

/** 应用（基础主题 + 自定义色 + 关联的已存主题 id） */
export function applyThemeSelection({ baseThemeId, customColors, customThemeId } = {}) {
    if (!state.profile) return;
    if (baseThemeId) state.profile.themeId = baseThemeId;
    state.profile.customColors = { ...(customColors || {}) };
    state.profile.activeCustomThemeId = String(customThemeId || '');
    applyTheme();
    persistProfile();
}

export function saveCustomTheme({ name, baseThemeId, colors }) {
    if (!state.profile) return null;
    const theme = {
        id: uid('th'),
        name: String(name || '我的配色').trim() || '我的配色',
        baseThemeId: String(baseThemeId || 'sky'),
        colors: { ...(colors || {}) },
        createdAt: Date.now(),
    };
    state.profile.customThemes = [...asArray(state.profile.customThemes), theme];
    persistProfile();
    return theme;
}

/** 改名 / 用当前颜色覆盖已存的那条 */
export function updateCustomTheme(themeId, patch = {}) {
    if (!state.profile) return null;
    const theme = asArray(state.profile.customThemes).find((t) => sameId(t.id, themeId));
    if (!theme) return null;
    if (typeof patch.name === 'string' && patch.name.trim()) theme.name = patch.name.trim();
    if (patch.colors && typeof patch.colors === 'object') theme.colors = { ...patch.colors };
    if (patch.baseThemeId) theme.baseThemeId = String(patch.baseThemeId);
    theme.updatedAt = Date.now();
    // 改的正是当前生效的那套 → 立刻生效
    if (sameId(state.profile.activeCustomThemeId, themeId)) {
        state.profile.customColors = { ...theme.colors };
        state.profile.themeId = theme.baseThemeId;
        applyTheme();
    }
    persistProfile();
    return theme;
}

export function removeCustomTheme(themeId) {
    if (!state.profile) return;
    state.profile.customThemes = asArray(state.profile.customThemes).filter((t) => !sameId(t.id, themeId));
    if (sameId(state.profile.activeCustomThemeId, themeId)) state.profile.activeCustomThemeId = '';
    persistProfile();
}

// ---------------------------------------------------------------------------
// UI 杂项
// ---------------------------------------------------------------------------

export function setTab(id) {
    if (!TABS.some((t) => t.id === id)) return;
    state.tab = id;
    state.view = '';
    state.activeDest = null;
    state.activeTripId = '';
    state.messages = [];
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
    toastTimer = setTimeout(() => { state.toast = ''; }, 2000);
}

export function clearError() {
    state.error = '';
}
