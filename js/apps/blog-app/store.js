/**
 * 氧气 · 状态单例
 *
 * 一份 Vue.reactive，所有组件读它、通过这里的 mutator 改它。
 * 生成任务只往 store 写不碰 DOM。
 *
 * ── 档案切换 ──────────────────────────────────────────────────────
 * 广场 / 热搜 / 作者 / 评论 / 私信按 `${userId}::${worldId}` 分档；
 * 随笔 / 氧气值 / 房间 / 小听 / 黑匣子是全局档（属于屏幕前的人）。
 * `hydrate()` 每次现算档案键，和上次不一样就整份换掉 —— 全局档不动。
 *
 * ── AI 调用边界（一条都不能松）────────────────────────────────────
 * 首配完成 → 只生成一批标签级列表；
 * 点帖子     → 才生成正文 + 首批评论；点「更多」→ 才 +5 条；
 * 点作者     → 才生成主页；发闲聊 → 才生成回复；点「收一批」→ 才生成私信；
 * 点「换一批」→ 才生成热搜；点词条 → 才生成词条帖子；
 * 房间「整理」→ 一次点击最多 3 次串行调用；点小听 → 一句一调。
 * 随笔、氧气值、关机彩蛋、恶作剧：零 AI 调用。没有任何定时器会调 AI。
 * 隐藏彩蛋帖（作者本人写的，见 services/easter-eggs.js）：混进广场、点开正文、
 * 翻他的主页，全程零 AI 调用。
 */

import {
    COMMENT_PAGE, DM_BATCH, FEED_SIZE, HOT_SIZE, LS_KEYS, OXYGEN,
    TABS, TERM_POST_SIZE, XIAOTING,
} from './constants.js';
import {
    asArray, avatarSlot, clamp, computePostStats, dayKey, geometryColor,
    hashString, hotHeat, sameId, seededRandom, tidyText, truncate, uid,
} from './utils.js';
import * as dbx from './services/db.js';
import {
    EGG_AUTHOR, EGG_CHANCE, EGG_MAX_PER_FEED, EGG_MIN_BATCH_GAP, EGG_MIN_FEED_SIZE,
    EGG_OWNER_TYPE, findEasterEggById, isEasterEggId, listEasterEggs, pickEasterEgg,
} from './services/easter-eggs.js';
import * as world from './services/world-context.js';
import * as ai from './services/ai.js';
import * as bridge from './services/battery-bridge.js';
import * as chatBridge from './services/chat-bridge.js';
import { syncBlackboxCard } from './services/app-prompts.js';
import {
    capLedger, clampOxygen, decayFor, gainFor, isLow, ledgerEntry,
} from './services/oxygen-rules.js';
import {
    appearProbability, canPrank, capMemories, driftAfterSession, parseGiftSpec, shouldGift,
} from './services/xiaoting-rules.js';
import {
    GIFT_RULES, XIAOTING_PERSONA,
    buildAiPostPrompt, buildAuthorPrompt, buildChatReplyPrompt, buildDmPrompt,
    buildFeedPrompt, buildGiftPrompt, buildHotPrompt, buildMoreCommentsPrompt,
    buildOrganizePrompt, buildPersonaPrompt, buildPostDetailPrompt,
    buildTermPostsPrompt, buildUserCommentsPrompt, buildXiaotingChatPrompt,
} from './services/prompt-builder.js';
import { registerEncounteredCharacter } from '@/src/core/world-profile.js';
import { externalAppRegistry } from '@/src/core/app-registry.js';

const Vue = typeof window !== 'undefined' ? window.Vue : null;
const reactive = (o) => (Vue?.reactive ? Vue.reactive(o) : o);

const state = reactive({
    ready: false,
    blocked: '',

    identity: {
        userName: '我', userAvatar: '', userAvatarBg: '',
        worldName: '', profileKey: '', ready: false, userId: '', worldId: '',
        user: null, world: null,
    },
    profile: null,
    needsConfig: false,

    tab: 'square',
    /** '' | 'post' | 'author' | 'chat' | 'term' | 'inbox' | 'oxygen' | 'blackbox' | 'prompts' | 'theme' */
    view: '',

    /** 广场（标签级 stub，刷新即覆盖） */
    feed: [],
    feedBatch: 0,
    /** 打开过 / 收藏 / 用户与 AI 的帖子 */
    posts: [],
    /** 站内作者与评论者 */
    authors: [],

    activePostId: '',
    comments: [],

    activeAuthorId: '',

    chatPeerId: '',
    chatMessages: [],

    dms: [],

    /** 热搜：{ terms:[{id,term,category,heat,fromProvider,providerLabel,posts:[]}], batch } */
    hot: null,
    activeTermId: '',

    /** 全局档 */
    essays: [],
    essayView: 'calendar',
    essayMonth: dayKey().slice(0, 7),
    oxygen: null,
    batteryBound: false,
    roomItems: [],
    geometries: [],
    xiaoting: null,
    blackbox: [],

    /** 小听在不在房间 + 对话（对话不落盘，记忆才落盘） */
    xiaotingPresent: false,
    xiaotingDialog: [],
    xiaotingThinking: false,

    /** 整理链进度 */
    organize: { running: false, step: 0, label: '' },

    loading: {
        feed: false, post: false, comments: false, author: '',
        chat: false, dms: false, hot: false, term: false,
        aiPost: '', userComments: '', friend: '',
    },
    error: '',
    toast: '',

    onboarding: {
        clips: [], prompts: [],
        clipIds: [], promptIds: [],
        interestsText: '',
        nickname: '',
        followers: 0,
        followerPresetId: 'tiny',
        loading: false,
    },

    /** 弹窗 { type, payload } */
    modal: null,

    _pendingPostId: '',
    _viewStack: [],
    _app: null,
    _hydrating: false,
    _globalHydrated: false,
    _expressionListenerOn: false,
});

export function getState() {
    return state;
}

// ---------------------------------------------------------------------------
// 覆盖页导航栈
// ---------------------------------------------------------------------------

function pushView(next) {
    const stack = state._viewStack;
    if (state.view && state.view !== next) {
        const i = stack.indexOf(state.view);
        if (i >= 0) stack.splice(i, 1);
        stack.push(state.view);
    }
    const j = stack.indexOf(next);
    if (j >= 0) stack.splice(j, 1);
    state.view = next;
    state.error = '';
}

export function popView() {
    state.view = state._viewStack.pop() || '';
    state.error = '';
    return state.view;
}

export function setView(view) {
    if (!view) {
        state.view = '';
        state._viewStack = [];
        state.error = '';
        return;
    }
    pushView(view);
}

export function setTab(id) {
    if (!TABS.some((t) => t.id === id)) return;
    state.tab = id;
    state.view = '';
    state._viewStack = [];
    state.error = '';
    state.activePostId = '';
    state.activeAuthorId = '';
    state.comments = [];
    if (id === 'room') void enterRoom();
}

// ---------------------------------------------------------------------------
// 落盘（profile 防抖）
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
// 启动 / 切档
// ---------------------------------------------------------------------------

let _hydratePromise = null;

/** 并发安全：contentCards 和根组件 mounted 可能同时调，等同一个 promise */
export function hydrate(app) {
    if (app) state._app = app;
    if (_hydratePromise) return _hydratePromise;
    _hydratePromise = doHydrate().finally(() => { _hydratePromise = null; });
    return _hydratePromise;
}

async function doHydrate() {
    state._hydrating = true;
    try {
        // 全局档先就位（随笔 / 氧气 / 房间 / 小听 / 黑匣子不依赖世界观）
        await hydrateGlobal();

        const identity = world.readIdentity();
        Object.assign(state.identity, identity);

        if (!identity.ready) {
            state.blocked = identity.user
                ? '这个用户还没绑定世界观。去「设置 → 世界观」建一个，再到人设里绑上。随笔和房间不受影响，可以直接用。'
                : '还没有用户人设。去「设置 → 人设」建一张卡。随笔和房间不受影响，可以直接用。';
            state.ready = true;
            return;
        }
        state.blocked = '';

        const key = identity.profileKey;
        const profile = await dbx.loadProfile(state._app, key);
        if (!profile || !profile.configured) {
            state.profile = profile || dbx.makeProfile(key);
            state.needsConfig = true;
            await prepareOnboarding();
            state.ready = true;
            return;
        }

        state.profile = profile;
        state.needsConfig = false;
        applyTheme();

        const [feedRow, posts, authors, dms, hotRow] = await Promise.all([
            dbx.loadFeed(state._app, key),
            dbx.listPosts(state._app, key),
            dbx.listAuthors(state._app, key),
            dbx.listDms(state._app, key),
            dbx.loadHot(state._app, key),
        ]);
        // 缓存的那批列表里可能躺着一条彩蛋 stub：id 原样从 IndexedDB 回来，
        // 照常渲染、照常点开；只有作者已经删掉正文的那种才摘走（否则是张打不开的卡）
        state.feed = pruneStaleEggs(asArray(feedRow?.list));
        state.feedBatch = Number(feedRow?.batch) || 0;
        state.posts = posts;
        state.authors = authors;
        state.dms = dms;
        state.hot = hotRow || null;

        state.ready = true;

        // contentCards 深链：数据就位后再开
        if (state._pendingPostId) {
            const pid = state._pendingPostId;
            state._pendingPostId = '';
            await openPostById(pid);
        }
    } catch (err) {
        console.error('[blog] hydrate 失败', err);
        state.error = '读取数据失败：' + (err?.message || err);
        state.ready = true;
    } finally {
        state._hydrating = false;
    }
}

/** 全局档：随笔 / 氧气 / 房间 / 小听 / 黑匣子（只加载一次，之后就地维护） */
async function hydrateGlobal() {
    if (state._globalHydrated) return;
    state._globalHydrated = true;

    const [essays, oxygen, roomItems, geometries, xiaoting, blackbox] = await Promise.all([
        dbx.listEssays(state._app),
        dbx.loadOxygen(state._app),
        dbx.listRoomItems(state._app),
        dbx.listGeometries(state._app),
        dbx.loadXiaoting(state._app),
        dbx.listBlackbox(state._app),
    ]);
    state.essays = essays;
    state.oxygen = oxygen;
    state.roomItems = roomItems;
    state.geometries = geometries;
    state.xiaoting = xiaoting;
    state.blackbox = blackbox;

    mirrorBlackboxEnabled();
    attachExpressionListener();

    // 关机输入框的暂存 → 小听的记忆（迁移后清空）
    await migrateShutdownNotes();

    // 氧气结算（衰减只在打开时结算，不跑定时器）
    await settleOxygen('打开氧气');

    // 电池绑定状态对一次账
    await syncBatteryBoundState();

    // 恶作剧掷签（频控在 xiaoting-rules 里）
    void maybePrank();
}

/** 每次 App 被打开重新对一次身份；键没变就什么都不做 */
export async function recheckIdentity() {
    await settleOxygen('打开氧气');
    const next = world.getProfileKey();
    if (next && next === state.identity.profileKey && state.profile) return;
    resetForProfileSwitch();
    await hydrate(state._app);
}

function resetForProfileSwitch() {
    state.ready = false;
    state.profile = null;
    state.feed = [];
    state.feedBatch = 0;
    state.posts = [];
    state.authors = [];
    state.comments = [];
    state.dms = [];
    state.hot = null;
    state.activePostId = '';
    state.activeAuthorId = '';
    state.activeTermId = '';
    state.chatPeerId = '';
    state.chatMessages = [];
    state.view = '';
    state._viewStack = [];
    state.tab = 'square';
    state.modal = null;
    state.error = '';
}

// ---------------------------------------------------------------------------
// 首配
// ---------------------------------------------------------------------------

export async function prepareOnboarding() {
    state.onboarding.loading = true;
    try {
        state.onboarding.clips = world.listClips(state.identity.world);
        state.onboarding.prompts = await world.listLibraryPrompts();
        const social = world.readUserSocialProfile(state.identity.user);
        if (state.profile) {
            state.onboarding.clipIds = [...asArray(state.profile.clipIds)];
            state.onboarding.promptIds = [...asArray(state.profile.promptIds)];
            state.onboarding.interestsText = asArray(state.profile.interests).join('、');
            state.onboarding.nickname = state.profile.nickname
                || social.nickname || state.identity.userName;
            state.onboarding.followers = Number(state.profile.followers) || 0;
        } else {
            state.onboarding.nickname = social.nickname || state.identity.userName;
        }
    } finally {
        state.onboarding.loading = false;
    }
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

export function setInterestsText(text) { state.onboarding.interestsText = String(text || ''); }
export function setObNickname(text) { state.onboarding.nickname = String(text || '').slice(0, 20); }
export function setObFollowers(n, presetId) {
    state.onboarding.followers = clamp(n, 0, 999999999);
    if (presetId) state.onboarding.followerPresetId = presetId;
}

/** 配完 → 落盘 → 只生成标签级列表（正文、作者、评论都等用户点） */
export async function finishOnboarding() {
    const key = state.identity.profileKey;
    if (!key) return false;

    const profile = state.profile || dbx.makeProfile(key);
    profile.id = key;
    profile.configured = true;
    profile.clipIds = [...state.onboarding.clipIds];
    profile.promptIds = [...state.onboarding.promptIds];
    profile.interests = String(state.onboarding.interestsText || '')
        .split(/[、,，\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 8);
    profile.nickname = state.onboarding.nickname.trim() || state.identity.userName;
    profile.followers = Math.max(0, Number(state.onboarding.followers) || 0);
    state.profile = profile;

    await dbx.saveProfile(state._app, profile);
    state.needsConfig = false;
    applyTheme();

    // 生成失败也不退回引导页 —— 配置本身已经成功了
    return generateFeed();
}

export async function reopenOnboarding() {
    state.needsConfig = true;
    await prepareOnboarding();
}

// ---------------------------------------------------------------------------
// 生成上下文 + provider 收集
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
        interests: asArray(p?.interests),
    };
}

async function ensurePromptsLoaded() {
    if (!asArray(state.profile?.promptIds).length) return;
    if (asArray(state.onboarding.prompts).length) return;
    state.onboarding.prompts = await world.listLibraryPrompts();
}

function disabledProviderKeys() {
    const prefs = state.profile?.providerPrefs || {};
    return Object.keys(prefs).filter((k) => prefs[k] === false);
}

/** 收集演员 / 爱豆 / 电竞等 App 注册的动态影响（现在可能一个都没有） */
async function collectInfluences(channel) {
    const toolkit = state._app?.toolkit;
    if (!toolkit?.socialInfluences?.collect) return [];
    try {
        return await toolkit.socialInfluences.collect('blog', {
            channel,
            profileKey: state.identity.profileKey,
            disabledProviderKeys: disabledProviderKeys(),
        });
    } catch (err) {
        console.warn('[blog] 收集跨 App 影响失败（不影响本次生成）', err);
        return [];
    }
}

/** 提示词页要展示的 provider 清单（含启停状态） */
export function listProviders() {
    const toolkit = state._app?.toolkit;
    if (!toolkit?.socialInfluences?.list) return [];
    const disabled = new Set(disabledProviderKeys());
    return toolkit.socialInfluences.list('blog').map((p) => ({
        ...p,
        enabled: !disabled.has(p.key),
    }));
}

export function setProviderEnabled(key, enabled) {
    if (!state.profile) return;
    const prefs = { ...(state.profile.providerPrefs || {}) };
    if (enabled) delete prefs[key];
    else prefs[key] = false;
    state.profile.providerPrefs = prefs;
    persistProfile();
}

/** 提示词页的预览（预览 == 发送：同一个 build） */
export function buildFeedPreview() {
    const ctx = generationContext();
    return buildFeedPrompt({ ...ctx, knownAuthors: [], excludeSeeds: [], size: FEED_SIZE });
}

// ---------------------------------------------------------------------------
// 站内作者（同名 = 同一个人）
// ---------------------------------------------------------------------------

function findAuthorByName(name) {
    const key = String(name || '').trim();
    if (!key) return null;
    // 彩蛋作者不参与「同名 = 同一个人」：AI 万一起了一样的笔名也顶替不了他
    return state.authors.find((a) => a.name === key && !sameId(a.authorId, EGG_AUTHOR.authorId)) || null;
}

export function getAuthorById(authorId) {
    const found = state.authors.find((a) => sameId(a.authorId, authorId)) || null;
    if (sameId(authorId, EGG_AUTHOR.authorId)) {
        // 作者本人：档案是常量（所以还没落盘时也认得出他、头像槽位不会变），
        // 作品只列用户已经解锁的彩蛋
        return { ...eggAuthorRecord(), ...(found || {}), works: unlockedEggWorks() };
    }
    return found;
}

async function ensureAuthor(name, kind = 'author') {
    const existed = findAuthorByName(name);
    if (existed) return existed;
    const record = {
        authorId: uid('a'),
        name: String(name || '').trim() || '匿名',
        kind,
        bio: '',
        personality: '',
        followers: 0,
        following: 0,
        works: [],
        profileGenerated: false,
        nookPersonId: '',
        slot: 0,
        firstSeenAt: Date.now(),
    };
    record.slot = avatarSlot(record.authorId);
    const stored = await dbx.saveAuthor(state._app, state.identity.profileKey, record);
    if (stored) state.authors = [stored, ...state.authors];
    return stored || record;
}

async function persistAuthor(author) {
    if (!author) return;
    const stored = await dbx.saveAuthor(state._app, state.identity.profileKey, author);
    if (stored) {
        const i = state.authors.findIndex((a) => sameId(a.authorId, author.authorId));
        if (i >= 0) state.authors.splice(i, 1, stored);
        else state.authors = [stored, ...state.authors];
    }
}

// ---------------------------------------------------------------------------
// 广场：标签级列表
// ---------------------------------------------------------------------------

export async function generateFeed() {
    if (state.loading.feed) return false;
    state.loading.feed = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const ctx = generationContext();
        const influenceParts = await collectInfluences('feed');
        const knownAuthors = state.authors
            .filter((a) => a.kind === 'author')
            .slice(0, 16)
            .map((a) => ({ name: a.name }));
        const excludeSeeds = [
            ...state.feed.map((s) => s.seed),
            ...state.posts.map((p) => p.seed),
        ].filter(Boolean);

        const { text } = buildFeedPrompt({ ...ctx, influenceParts, knownAuthors, excludeSeeds, size: FEED_SIZE });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) {
            state.error = res.error;
            return false;
        }

        const rows = asArray(res.data?.posts).filter((x) => x && x.authorName && asArray(x.tags).length);
        if (!rows.length) {
            state.error = 'AI 这次一条帖子都没给出来，再试一次';
            return false;
        }

        const list = [];
        for (const row of rows.slice(0, FEED_SIZE + 2)) {
            const author = await ensureAuthor(row.authorName, 'author');
            const id = uid('p');
            const type = ['long', 'short', 'murmur'].includes(row.type) ? row.type : 'short';
            list.push({
                id,
                authorId: author.authorId,
                authorName: author.name,
                type,
                tags: asArray(row.tags).map((t) => String(t || '').trim()).filter(Boolean).slice(0, 4),
                seed: truncate(tidyText(row.seed), 60),
                heat: clamp(row.heat, 1, 1000),
                relLabel: relativeStamp(id),
                createdAt: Date.now(),
            });
        }
        // ★ 掷签点：stub 列表拼完、落盘之前混彩蛋 —— 这样它跟着这一批一起存，
        //   退出重进 / 刷新页面都还在原位
        const nextBatch = state.feedBatch + 1;
        injectEasterEgg(list, nextBatch);

        state.feed = list;
        state.feedBatch = nextBatch;
        await dbx.saveFeed(state._app, state.identity.profileKey, state.feed, state.feedBatch);
        return true;
    } catch (err) {
        console.error('[blog] 生成列表失败', err);
        state.error = '生成失败：' + (err?.message || err);
        return false;
    } finally {
        state.loading.feed = false;
    }
}

/** stub id → 稳定的「N 小时前」标签（刷新不跳变） */
function relativeStamp(id) {
    const h = hashString(id);
    const mins = 3 + (h % 900);
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    return `${hours} 小时前`;
}

/** 广场里某条 stub 是否已经读过（进过详情） */
export function stubOpened(stubId) {
    return state.posts.some((p) => sameId(p.id, stubId));
}

// ---------------------------------------------------------------------------
// 隐藏彩蛋（作者本人的帖子）
// ---------------------------------------------------------------------------
//
// 正文、概率旋钮、「怎么加一条」全在 services/easter-eggs.js，本节只负责：
// 掷签混进广场 → 点开时就地取材落盘 → 作者档案兜底。整节零 AI 调用。
// 源文件是空数组时下面每个函数都会提前 return，氧气退回原来的行为。

/** 已解锁的彩蛋 id（存在 blogProfiles 那条记录里，不新增表；老档案自动补空数组） */
function openedEggIds() {
    return asArray(state.profile?.openedEggIds).map(String);
}

/** 这条帖子是不是彩蛋（ownerType 与 id 两道都认，缓存的老记录也不会漏） */
export function isEggPost(post) {
    return Boolean(post) && (post.ownerType === EGG_OWNER_TYPE || isEasterEggId(post.id));
}

/** 这个作者是不是作者本人（作者页据此收起「打个招呼 / 收进 nook」） */
export function isEggAuthorId(authorId) {
    return sameId(authorId, EGG_AUTHOR.authorId);
}

/**
 * 开发者强制开关（写在 easter-eggs.js 的头注释里）：
 *   window.__oxEggForce = true      下一次「换一批」必出
 *   window.__oxEggForce = 'id片段'  必出指定的那一条
 */
function eggForceFlag() {
    if (typeof window === 'undefined') return '';
    const raw = window.__oxEggForce;
    if (raw === true) return 'any';
    const text = String(raw ?? '').trim();
    if (!text || text === 'false' || text === 'undefined') return '';
    return text === 'true' || text === '1' ? 'any' : text;
}

/** 彩蛋记录 → 广场 stub（字段和 AI 生成的那批逐一对齐，卡片才看不出区别） */
function eggStub(egg) {
    return {
        id: egg.id,
        authorId: EGG_AUTHOR.authorId,
        authorName: EGG_AUTHOR.name,
        type: egg.type,
        tags: [...egg.tags],
        seed: '',                       // 彩蛋没有「内容线索」：正文早就写好了
        heat: 40 + (hashString(egg.id) % 220),
        relLabel: egg.dateLabel || relativeStamp(egg.id),
        createdAt: Date.now(),
    };
}

/**
 * 掷一次签，决定这批广场里要不要混一条作者本人的帖子。
 * 随机源确定性：种子 = 档案键 + 批次号（不用 Math.random），
 * 所以同一批的结果永远一样，重渲染不会改口，也可复现。
 */
function injectEasterEgg(list, batch) {
    try {
        if (EGG_MAX_PER_FEED < 1) return null;
        if (!Array.isArray(list) || list.length < EGG_MIN_FEED_SIZE) return null;
        if (!listEasterEggs().length) return null;
        const force = eggForceFlag();
        const lastBatch = Number(state.profile?.eggLastBatch) || 0;
        if (!force && lastBatch && batch - lastBatch < EGG_MIN_BATCH_GAP) return null;

        const rand = seededRandom(hashString(`${state.identity.profileKey}::egg::${batch}`));
        if (rand() >= EGG_CHANCE && !force) return null;

        const egg = force && force !== 'any'
            ? (findEasterEggById(force) || listEasterEggs().find((e) => e.id.includes(force)) || null)
            : pickEasterEgg(rand, { excludeIds: openedEggIds() });
        if (!egg) return null;

        // 不放第一条：摆在顶上太像安排好的
        const at = 1 + Math.floor(rand() * (list.length - 1));
        list.splice(Math.min(at, list.length), 0, eggStub(egg));
        if (state.profile) {
            state.profile.eggLastBatch = batch;
            persistProfile();
        }
        return egg;
    } catch (err) {
        console.warn('[blog] 彩蛋这次没混进去（不影响这批列表）', err);
        return null;
    }
}

/** 作者已经删掉正文的彩蛋 stub 要从缓存列表里摘走 */
function pruneStaleEggs(list) {
    return asArray(list).filter((s) => !isEasterEggId(s?.id) || Boolean(findEasterEggById(s.id)));
}

/** 作者本人的作者档案：全常量，profileGenerated 写死 true —— 永不触发主页生成 */
function eggAuthorRecord() {
    return {
        authorId: EGG_AUTHOR.authorId,
        name: EGG_AUTHOR.name,
        kind: 'author',
        bio: EGG_AUTHOR.bio,
        personality: EGG_AUTHOR.personality,
        followers: EGG_AUTHOR.followers,
        following: EGG_AUTHOR.following,
        works: [],
        profileGenerated: true,
        nookPersonId: '',
        slot: EGG_AUTHOR.slot,
        firstSeenAt: Date.now(),
    };
}

/** 点开第一条彩蛋时才把作者写进 blogAuthors（走和普通作者同一张表） */
async function ensureEggAuthor() {
    const existed = state.authors.find((a) => sameId(a.authorId, EGG_AUTHOR.authorId));
    if (existed) return existed;
    const stored = await dbx.saveAuthor(state._app, state.identity.profileKey, eggAuthorRecord());
    if (stored) state.authors = [stored, ...state.authors];
    return stored || eggAuthorRecord();
}

/** 他主页上的「作品」= 用户已经解锁的彩蛋。没刷到的一条都不剧透。 */
function unlockedEggWorks() {
    return state.posts
        .filter((p) => isEggPost(p))
        .sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0))
        .map((p) => ({
            id: p.id,
            authorId: EGG_AUTHOR.authorId,
            authorName: EGG_AUTHOR.name,
            type: p.type,
            tags: asArray(p.tags),
            seed: '',
            heat: 40 + (hashString(p.id) % 220),
            relLabel: p.relLabel || '',
            createdAt: p.createdAt || 0,
        }));
}

function markEggOpened(eggId) {
    const p = state.profile;
    if (!p) return;
    const list = openedEggIds();
    if (list.includes(eggId)) return;
    p.openedEggIds = [...list, eggId].slice(-200);
    persistProfile();
}

/**
 * 点开一条彩蛋：正文直接从源文件取，一条 API 都不发。
 * ★ 只在这一刻落盘 —— 提前存会让广场那张卡还没点就显示「读过」。
 */
async function materializeEgg(source) {
    const id = typeof source === 'string' ? source : String(source?.id || '');
    const egg = findEasterEggById(id);
    if (!egg) {
        state.comments = [];
        state.error = '这条帖子已经不在了';
        return null;
    }
    state.error = '';
    await ensureEggAuthor();

    const existed = state.posts.find((p) => sameId(p.id, egg.id));
    const stats = computePostStats(EGG_AUTHOR.followers, egg.id);
    const post = {
        ...(existed || {}),
        id: egg.id,
        ownerType: EGG_OWNER_TYPE,
        authorId: EGG_AUTHOR.authorId,
        authorName: EGG_AUTHOR.name,
        type: egg.type,
        tags: [...egg.tags],
        content: egg.body,
        mood: egg.mood,
        // 没写预设评论 = 「只是说说」：评论区连入口都不出现，也就没有任何调 AI 的口子
        wantReplies: egg.comments.length > 0,
        likes: stats.likes,
        reach: stats.reach,
        commentCount: egg.comments.length,
        favorited: Boolean(existed?.favorited),
        relLabel: egg.dateLabel || relativeStamp(egg.id),
        createdAt: Number(existed?.createdAt) || Date.now(),
        openedAt: Date.now(),
    };
    const stored = (await dbx.savePost(state._app, state.identity.profileKey, post)) || post;
    const i = state.posts.findIndex((p) => sameId(p.id, stored.id));
    if (i >= 0) state.posts.splice(i, 1, stored);
    else state.posts = [stored, ...state.posts];

    // 预设评论（可选，也来自源文件）：id 固定，重复进来也不会存两份
    let comments = await dbx.listComments(state._app, egg.id);
    if (!comments.length && egg.comments.length) {
        const saved = [];
        let seq = 0;
        for (const c of egg.comments) {
            seq += 1;
            const record = await dbx.saveComment(state._app, state.identity.profileKey, {
                id: `${egg.id}::c${seq}`,
                postId: egg.id,
                seq,
                authorName: c.authorName,
                text: c.text,
                likes: hashString(`${egg.id}::${seq}`) % 9,
            });
            if (record) saved.push(record);
        }
        comments = saved;
    }
    state.comments = comments;
    markEggOpened(egg.id);
    return stored;
}

// ---------------------------------------------------------------------------
// 帖子：打开 / 正文生成 / 评论
// ---------------------------------------------------------------------------

export function getActivePost() {
    return state.posts.find((p) => sameId(p.id, state.activePostId)) || null;
}

/** 从广场 / 词条列表点开一条 stub */
export async function openPost(stub) {
    if (!stub?.id) return;
    const existed = state.posts.find((p) => sameId(p.id, stub.id));
    state.activePostId = stub.id;
    pushView('post');
    if (existed && existed.content) {
        state.comments = await dbx.listComments(state._app, stub.id);
        return;
    }
    if (isEasterEggId(stub.id)) {
        await materializeEgg(stub);
        return;
    }
    await generatePostDetail(stub);
}

/** murmur 内容卡 / 收藏列表按 id 打开 */
export async function openPostById(postId, cardSnapshot = null) {
    const id = String(postId || '').trim();
    if (!id) return { ok: false, error: '缺少帖子 id' };
    if (!state.ready || state._hydrating) {
        state._pendingPostId = id;
        return { ok: true, pending: true };
    }
    const existed = state.posts.find((p) => sameId(p.id, id))
        || (await dbx.getPost(state._app, id));
    if (existed) {
        if (existed.profileKey && existed.profileKey !== state.identity.profileKey) {
            return { ok: false, error: '这条帖子属于另一个档案（换了用户或世界观）' };
        }
        if (!state.posts.some((p) => sameId(p.id, existed.id))) state.posts = [existed, ...state.posts];
        state.activePostId = existed.id;
        state.tab = 'square';
        pushView('post');
        state.comments = await dbx.listComments(state._app, existed.id);
        if (!existed.content) await generatePostDetail(existed);
        return { ok: true };
    }
    // 彩蛋：正文在源文件里，分享出去的卡片点回来也不需要生成
    if (isEasterEggId(id)) {
        if (!findEasterEggById(id)) return { ok: false, error: '内容已删除或不存在' };
        state.activePostId = id;
        state.tab = 'square';
        pushView('post');
        await materializeEgg(id);
        return { ok: true };
    }
    // 卡片快照重建（AI 分享的帖子此前并不存在）
    if (cardSnapshot && asArray(cardSnapshot.tags).length) {
        const author = await ensureAuthor(cardSnapshot.authorName || '氧气用户', 'author');
        const stub = {
            id,
            authorId: author.authorId,
            authorName: author.name,
            type: ['long', 'short', 'murmur'].includes(cardSnapshot.type) ? cardSnapshot.type : 'short',
            tags: asArray(cardSnapshot.tags).slice(0, 4),
            seed: truncate(cardSnapshot.blurb || '', 60),
            heat: 80,
            createdAt: Date.now(),
        };
        state.activePostId = id;
        state.tab = 'square';
        pushView('post');
        await generatePostDetail(stub);
        return { ok: true };
    }
    return { ok: false, error: '内容已删除或不存在' };
}

async function generatePostDetail(stub) {
    // 彩蛋兜底闸：不管从哪条路走到这里，作者本人的帖子都不许发请求
    if (isEasterEggId(stub?.id)) return materializeEgg(stub);
    if (state.loading.post) return;
    state.loading.post = true;
    state.comments = [];
    state.error = '';
    await ensurePromptsLoaded();
    try {
        const ctx = generationContext();
        const influenceParts = await collectInfluences('post');
        const author = getAuthorById(stub.authorId) || findAuthorByName(stub.authorName);
        const { text } = buildPostDetailPrompt({ ...ctx, influenceParts, stub, author });
        const res = await ai.generateJson({ system: text, temperature: 0.95 });
        if (!res.ok) {
            state.error = res.error;
            return;
        }
        const data = res.data || {};
        const post = {
            ...stub,
            ownerType: 'external',
            content: tidyText(data.content) || '（正文散了，重新打开试试）',
            likes: Math.max(0, Number(data.likes) || 0),
            commentCount: Math.max(COMMENT_PAGE, Number(data.commentCount) || COMMENT_PAGE),
            favorited: false,
            openedAt: Date.now(),
        };
        const stored = await dbx.savePost(state._app, state.identity.profileKey, post);
        if (stored) {
            const i = state.posts.findIndex((p) => sameId(p.id, stored.id));
            if (i >= 0) state.posts.splice(i, 1, stored);
            else state.posts = [stored, ...state.posts];
        }
        // 首批评论
        let seq = 0;
        const saved = [];
        for (const c of asArray(data.comments).slice(0, COMMENT_PAGE)) {
            if (!c?.authorName || !c?.text) continue;
            seq += 1;
            const record = await dbx.saveComment(state._app, state.identity.profileKey, {
                postId: post.id,
                seq,
                authorName: truncate(String(c.authorName).trim(), 12),
                text: truncate(tidyText(c.text), 120),
                likes: Math.max(0, Number(c.likes) || 0),
            });
            if (record) saved.push(record);
        }
        state.comments = saved;
    } catch (err) {
        console.error('[blog] 生成帖子详情失败', err);
        state.error = '生成失败：' + (err?.message || err);
    } finally {
        state.loading.post = false;
    }
}

/** 更多评论：每次 +5（外部帖走这里；用户帖走 generateUserComments） */
export async function loadMoreComments() {
    const post = getActivePost();
    if (!post || state.loading.comments) return;
    // 彩蛋的评论是作者写死的那几条，没有「更多」（界面上也走不到这里）
    if (isEggPost(post)) return;
    if (post.ownerType === 'user' || post.ownerType === 'ai') {
        return generateUserComments();
    }
    state.loading.comments = true;
    state.error = '';
    try {
        const ctx = generationContext();
        const existing = state.comments.map((c) => ({ authorName: c.authorName, text: c.text }));
        const { text } = buildMoreCommentsPrompt({
            ...ctx,
            post: { tags: post.tags, contentBrief: post.content, authorName: post.authorName },
            existing,
            count: COMMENT_PAGE,
        });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) { state.error = res.error; return; }
        let seq = state.comments.length;
        for (const c of asArray(res.data?.comments).slice(0, COMMENT_PAGE)) {
            if (!c?.authorName || !c?.text) continue;
            seq += 1;
            const record = await dbx.saveComment(state._app, state.identity.profileKey, {
                postId: post.id,
                seq,
                authorName: truncate(String(c.authorName).trim(), 12),
                text: truncate(tidyText(c.text), 120),
                likes: Math.max(0, Number(c.likes) || 0),
            });
            if (record) state.comments.push(record);
        }
    } catch (err) {
        console.error('[blog] 更多评论失败', err);
        state.error = '生成失败：' + (err?.message || err);
    } finally {
        state.loading.comments = false;
    }
}

export async function toggleFavorite(postId) {
    const post = state.posts.find((p) => sameId(p.id, postId));
    if (!post) return;
    post.favorited = !post.favorited;
    await dbx.savePost(state._app, state.identity.profileKey, post);
    showToast(post.favorited ? '已收藏' : '已取消收藏');
}

export function listFavorites() {
    return state.posts.filter((p) => p.favorited);
}

// ---------------------------------------------------------------------------
// 用户与 AI 的帖子
// ---------------------------------------------------------------------------

export function listUserPosts() {
    return state.posts.filter((p) => p.ownerType === 'user');
}

export function listAiPosts() {
    return state.posts.filter((p) => p.ownerType === 'ai');
}

/**
 * 用户发帖。两种回应设定：
 *   wantReplies=true  想被回应：点「看看大家怎么说」才生成评论
 *   wantReplies=false 只是说说：永不生成评论，界面也没有评论入口
 * 两种都算表达（blog:expression）。
 */
export async function createUserPost({ type, tags, content, wantReplies }) {
    const key = state.identity.profileKey;
    if (!key || !state.profile) return null;
    const cleanTags = asArray(tags).map((t) => String(t || '').trim()).filter(Boolean).slice(0, 5);
    const body = String(content || '').trim();
    if (!cleanTags.length || !body) {
        showToast('标签和正文都要有');
        return null;
    }
    const id = uid('p');
    const stats = computePostStats(state.profile.followers, id);
    const post = {
        id,
        ownerType: 'user',
        authorId: 'me',
        authorName: state.profile.nickname || state.identity.userName,
        type: ['long', 'short', 'murmur'].includes(type) ? type : 'short',
        tags: cleanTags,
        content: body,
        wantReplies: wantReplies !== false,
        likes: stats.likes,
        reach: stats.reach,
        commentCount: wantReplies !== false ? stats.comments : 0,
        favorited: false,
        createdAt: Date.now(),
    };
    const stored = await dbx.savePost(state._app, key, post);
    if (stored) state.posts = [stored, ...state.posts];
    dispatchExpression(post.type);
    showToast('发出去了。呼吸完成');
    return stored;
}

export async function updateUserPost(postId, patch = {}) {
    const post = state.posts.find((p) => sameId(p.id, postId));
    if (!post) return;
    if (Array.isArray(patch.tags)) {
        post.tags = patch.tags.map((t) => String(t || '').trim()).filter(Boolean).slice(0, 5);
    }
    if (typeof patch.content === 'string' && patch.content.trim()) post.content = patch.content.trim();
    if (patch.type && ['long', 'short', 'murmur'].includes(patch.type)) post.type = patch.type;
    await dbx.savePost(state._app, state.identity.profileKey, post);
    showToast('已保存');
}

export async function deletePost(postId) {
    const i = state.posts.findIndex((p) => sameId(p.id, postId));
    if (i < 0) return;
    state.posts.splice(i, 1);
    await dbx.removePost(state._app, postId);
    await dbx.removeCommentsByPost(state._app, postId);
    if (sameId(state.activePostId, postId)) {
        state.activePostId = '';
        popView();
    }
    showToast('已删除');
}

/** 让世界 AI 写一篇（点了才调；带意见重 roll 走同一个入口） */
export async function aiWritePost(aiId, opinion = '') {
    if (state.loading.aiPost) return null;
    state.loading.aiPost = aiId;
    state.error = '';
    await ensurePromptsLoaded();
    try {
        const ctx = generationContext();
        const aiDesc = world.describeAi(aiId);
        const aiInfo = world.listWorldAis(state.identity.world).find((a) => sameId(a.id, aiId));
        const previousTags = listAiPosts()
            .filter((p) => sameId(p.aiPersonId, aiId))
            .flatMap((p) => p.tags);
        const { text } = buildAiPostPrompt({
            ...ctx,
            ai: { name: aiInfo?.name || 'TA', desc: aiDesc },
            previousTags,
            opinion,
        });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) { state.error = res.error; return null; }
        const data = res.data || {};
        const cleanTags = asArray(data.tags).map((t) => String(t || '').trim()).filter(Boolean).slice(0, 4);
        if (!cleanTags.length || !data.content) {
            state.error = 'AI 没按格式返回，再试一次';
            return null;
        }
        const id = uid('p');
        const stats = computePostStats(600 + (hashString(aiId) % 4000), id);
        const post = {
            id,
            ownerType: 'ai',
            aiPersonId: aiId,
            authorId: `ai::${aiId}`,
            authorName: aiInfo?.social?.nickname || aiInfo?.name || 'TA',
            type: ['long', 'short', 'murmur'].includes(data.type) ? data.type : 'short',
            tags: cleanTags,
            content: tidyText(data.content),
            wantReplies: true,
            likes: stats.likes,
            reach: stats.reach,
            commentCount: stats.comments,
            favorited: false,
            createdAt: Date.now(),
        };
        const stored = await dbx.savePost(state._app, state.identity.profileKey, post);
        if (stored) state.posts = [stored, ...state.posts];
        // 写进 TA 的经历：murmur 聊天时 TA 记得自己发过
        void world.appendAiExperience(aiId, `在氧气上发过一条帖子，标签：${cleanTags.join('、')}。`);
        showToast(`${post.authorName} 发了一条新帖子`);
        return stored;
    } catch (err) {
        console.error('[blog] AI 发帖失败', err);
        state.error = '生成失败：' + (err?.message || err);
        return null;
    } finally {
        state.loading.aiPost = '';
    }
}

/**
 * AI 帖子带意见重 roll：同一条帖子就地换内容（id / 收藏状态不变），
 * 意见必须进 prompt。
 */
export async function rerollAiPost(postId, opinion = '') {
    const post = state.posts.find((p) => sameId(p.id, postId));
    if (!post || post.ownerType !== 'ai' || state.loading.aiPost) return null;
    state.loading.aiPost = post.aiPersonId;
    state.error = '';
    await ensurePromptsLoaded();
    try {
        const ctx = generationContext();
        const aiDesc = world.describeAi(post.aiPersonId);
        const previousTags = [...post.tags];
        const { text } = buildAiPostPrompt({
            ...ctx,
            ai: { name: post.authorName, desc: aiDesc },
            previousTags,
            opinion,
        });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) { state.error = res.error; return null; }
        const data = res.data || {};
        const cleanTags = asArray(data.tags).map((t) => String(t || '').trim()).filter(Boolean).slice(0, 4);
        if (!cleanTags.length || !data.content) {
            state.error = 'AI 没按格式返回，再试一次';
            return null;
        }
        post.tags = cleanTags;
        post.content = tidyText(data.content);
        if (['long', 'short', 'murmur'].includes(data.type)) post.type = data.type;
        await dbx.savePost(state._app, state.identity.profileKey, post);
        // 旧评论跟旧正文走
        await dbx.removeCommentsByPost(state._app, post.id);
        if (sameId(state.activePostId, post.id)) state.comments = [];
        showToast('TA 重写了这条帖子');
        return post;
    } catch (err) {
        console.error('[blog] 重 roll 失败', err);
        state.error = '生成失败：' + (err?.message || err);
        return null;
    } finally {
        state.loading.aiPost = '';
    }
}

/** 用户 / AI 帖子的评论（「想被回应」的才有；每次 +5） */
export async function generateUserComments() {
    const post = getActivePost();
    if (!post || state.loading.userComments) return;
    if (isEggPost(post)) return;
    if (post.wantReplies === false) return;
    state.loading.userComments = post.id;
    state.error = '';
    try {
        const ctx = generationContext();
        const influenceParts = await collectInfluences('comments');
        const existing = state.comments.map((c) => ({ authorName: c.authorName, text: c.text }));
        const { text } = buildUserCommentsPrompt({
            ...ctx,
            influenceParts,
            post: { type: post.type, tags: post.tags, content: post.content },
            nickname: post.authorName,
            followers: post.ownerType === 'user' ? (state.profile?.followers || 0) : 2000,
            stats: { reach: post.reach || 0, likes: post.likes || 0, comments: post.commentCount || 0 },
            existing,
            count: COMMENT_PAGE,
        });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) { state.error = res.error; return; }
        let seq = state.comments.length;
        for (const c of asArray(res.data?.comments).slice(0, COMMENT_PAGE)) {
            if (!c?.authorName || !c?.text) continue;
            seq += 1;
            const record = await dbx.saveComment(state._app, state.identity.profileKey, {
                postId: post.id,
                seq,
                authorName: truncate(String(c.authorName).trim(), 12),
                text: truncate(tidyText(c.text), 120),
                likes: Math.max(0, Number(c.likes) || 0),
            });
            if (record) state.comments.push(record);
        }
    } catch (err) {
        console.error('[blog] 用户帖评论失败', err);
        state.error = '生成失败：' + (err?.message || err);
    } finally {
        state.loading.userComments = '';
    }
}

/** 打开自己 / AI 的帖子（正文已在本地，只需要拉已有评论） */
export async function openOwnPost(postId) {
    const post = state.posts.find((p) => sameId(p.id, postId));
    if (!post) return;
    state.activePostId = post.id;
    pushView('post');
    state.comments = await dbx.listComments(state._app, post.id);
}

// ---------------------------------------------------------------------------
// 作者主页 / 站内闲聊 / 加好友
// ---------------------------------------------------------------------------

export async function openAuthor(authorId, sourceHint = '') {
    const author = getAuthorById(authorId);
    if (!author) return;
    state.activeAuthorId = authorId;
    pushView('author');
    if (author.profileGenerated) return;
    await generateAuthorProfile(author, sourceHint);
}

/** 评论区点评论者 → 先确保作者记录存在再进主页 */
export async function openCommenter(name) {
    const author = await ensureAuthor(name, 'commenter');
    await openAuthor(author.authorId, '在评论区认识的');
}

async function generateAuthorProfile(author, sourceHint) {
    if (state.loading.author) return;
    state.loading.author = author.authorId;
    state.error = '';
    await ensurePromptsLoaded();
    try {
        const ctx = generationContext();
        const knownTags = state.feed
            .filter((s) => sameId(s.authorId, author.authorId))
            .flatMap((s) => s.tags);
        const { text } = buildAuthorPrompt({
            ...ctx,
            person: { name: author.name, kind: author.kind },
            knownTags,
            sourceHint,
        });
        const res = await ai.generateJson({ system: text, temperature: 0.95 });
        if (!res.ok) { state.error = res.error; return; }
        const data = res.data || {};
        author.bio = truncate(tidyText(data.bio), 60);
        author.personality = truncate(tidyText(data.personality), 60);
        author.followers = Math.max(0, Number(data.followers) || 0);
        author.following = Math.max(0, Number(data.following) || 0);
        author.works = asArray(data.works).slice(0, 5).map((w) => ({
            id: uid('p'),
            authorId: author.authorId,
            authorName: author.name,
            type: ['long', 'short', 'murmur'].includes(w.type) ? w.type : 'short',
            tags: asArray(w.tags).map((t) => String(t || '').trim()).filter(Boolean).slice(0, 3),
            seed: truncate(tidyText(w.seed), 40),
            heat: 40 + (hashString(author.authorId) % 300),
            createdAt: Date.now(),
        }));
        author.profileGenerated = true;
        await persistAuthor(author);
    } catch (err) {
        console.error('[blog] 生成作者主页失败', err);
        state.error = '生成失败：' + (err?.message || err);
    } finally {
        state.loading.author = '';
    }
}

/** 只有拉取过主页的人才能闲聊 */
export async function startChat(authorId) {
    // 作者本人只是留了几句话，不接受站内私聊（也就不会有 AI 去扮演他）
    if (sameId(authorId, EGG_AUTHOR.authorId)) {
        showToast('TA 只是留了几句话，没开私聊');
        return;
    }
    const author = getAuthorById(authorId);
    if (!author?.profileGenerated) {
        showToast('先看看 TA 的主页再打招呼');
        return;
    }
    state.chatPeerId = authorId;
    state.chatMessages = await dbx.listChatMessages(state._app, state.identity.profileKey, authorId);
    pushView('chat');
}

/** 站内闲聊：不可编辑 / 删除 / 重 roll */
export async function sendChatMessage(textRaw) {
    const text = String(textRaw || '').trim();
    const peer = getAuthorById(state.chatPeerId);
    if (!text || !peer || state.loading.chat) return;
    state.loading.chat = true;
    state.error = '';
    try {
        const seqBase = state.chatMessages.length;
        const mine = await dbx.saveChatMessage(state._app, state.identity.profileKey, {
            peerId: peer.authorId, role: 'user', text, seq: seqBase + 1,
        });
        if (mine) state.chatMessages.push(mine);

        const ctx = generationContext();
        const { text: system } = buildChatReplyPrompt({
            ...ctx,
            peer: { name: peer.name, bio: peer.bio, personality: peer.personality },
            metVia: peer.kind === 'commenter' ? '在评论区认识的' : '因为 TA 的帖子认识的',
            messages: state.chatMessages.map((m) => ({ role: m.role, text: m.text })),
            userName: state.profile?.nickname || state.identity.userName,
            userDesc: world.describeUser(state.identity.user),
        });
        const res = await ai.generateJson({ system, temperature: 0.95 });
        if (!res.ok) { state.error = res.error; return; }
        const replyText = truncate(tidyText(res.data?.text), 200);
        if (replyText) {
            const reply = await dbx.saveChatMessage(state._app, state.identity.profileKey, {
                peerId: peer.authorId, role: 'peer', text: replyText, seq: state.chatMessages.length + 1,
            });
            if (reply) state.chatMessages.push(reply);
        }
    } catch (err) {
        console.error('[blog] 闲聊失败', err);
        state.error = '发送失败：' + (err?.message || err);
    } finally {
        state.loading.chat = false;
    }
}

/** 聊得投缘 → 收进 nook 角色库（幂等，简介带相识缘由） */
export async function addFriend(authorId) {
    if (sameId(authorId, EGG_AUTHOR.authorId)) {
        showToast('TA 不收进角色库');
        return;
    }
    const author = getAuthorById(authorId);
    if (!author || state.loading.friend) return;
    state.loading.friend = authorId;
    try {
        const result = await registerEncounteredCharacter({
            source: 'blog',
            externalId: `blog::${state.identity.profileKey}::${author.authorId}`,
            name: author.name,
            personality: author.personality,
            bio: author.bio,
            metVia: `在「氧气」${author.kind === 'commenter' ? '的评论区' : '看帖子'}认识的`,
        });
        if (result?.ok || result?.personId || result?.id) {
            author.nookPersonId = String(result.personId || result.id || 'ok');
            await persistAuthor(author);
            showToast(`${author.name} 已进入 nook 角色库`);
        } else {
            showToast(result?.error || '没加上，稍后再试');
        }
    } catch (err) {
        console.error('[blog] 加好友失败', err);
        showToast('没加上：' + (err?.message || err));
    } finally {
        state.loading.friend = '';
    }
}

// ---------------------------------------------------------------------------
// 私信（点「收一批」才生成；provider 消费点）
// ---------------------------------------------------------------------------

export async function generateDms() {
    if (state.loading.dms) return;
    state.loading.dms = true;
    state.error = '';
    await ensurePromptsLoaded();
    try {
        const ctx = generationContext();
        const influenceParts = await collectInfluences('dm');
        const recentTags = listUserPosts().slice(0, 5).flatMap((p) => p.tags);
        const { text } = buildDmPrompt({
            ...ctx,
            influenceParts,
            nickname: state.profile?.nickname || '',
            followers: state.profile?.followers || 0,
            recentTags,
            count: DM_BATCH,
        });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) { state.error = res.error; return; }
        for (const d of asArray(res.data?.dms).slice(0, DM_BATCH + 2)) {
            if (!d?.fromName || !d?.text) continue;
            const record = await dbx.saveDm(state._app, state.identity.profileKey, {
                fromName: truncate(String(d.fromName).trim(), 12),
                fromKind: truncate(String(d.fromKind || '').trim(), 8),
                text: truncate(tidyText(d.text), 160),
                tone: truncate(String(d.tone || '').trim(), 10),
            });
            if (record) state.dms = [record, ...state.dms];
        }
    } catch (err) {
        console.error('[blog] 私信生成失败', err);
        state.error = '生成失败：' + (err?.message || err);
    } finally {
        state.loading.dms = false;
    }
}

export async function deleteDm(id) {
    state.dms = state.dms.filter((d) => !sameId(d.id, id));
    await dbx.removeDm(state._app, id);
}

// ---------------------------------------------------------------------------
// 热搜（发现页）
// ---------------------------------------------------------------------------

/** 热度显示值：JS 按小时窗演化，不调 AI、刷新不跳变 */
export function displayHeat(term) {
    const hourStamp = Math.floor(Date.now() / 3600000);
    return hotHeat(term.heat, term.id, hourStamp);
}

export function sortedHotTerms() {
    const terms = asArray(state.hot?.terms);
    return [...terms].sort((a, b) => displayHeat(b) - displayHeat(a));
}

export async function generateHot() {
    if (state.loading.hot) return;
    state.loading.hot = true;
    state.error = '';
    await ensurePromptsLoaded();
    try {
        const ctx = generationContext();
        const influenceParts = await collectInfluences('hot-search');
        const exclude = asArray(state.hot?.terms).map((t) => t.term);
        const { text } = buildHotPrompt({ ...ctx, influenceParts, exclude, size: HOT_SIZE });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) { state.error = res.error; return; }

        const terms = asArray(res.data?.terms)
            .filter((t) => t && t.term)
            .slice(0, HOT_SIZE)
            .map((t) => ({
                id: uid('h'),
                term: truncate(String(t.term).trim(), 14),
                category: truncate(String(t.category || '').trim(), 6),
                heat: clamp(t.heat, 1000, 999999),
                fromProvider: false,
                providerLabel: '',
                posts: [],
            }));

        // provider 词条（演员 / 爱豆 / 电竞上线后出现）：混入榜单并标「与你有关」
        for (const partItem of asArray(influenceParts)) {
            const line = String(partItem?.content || '').split('\n')[0].trim();
            if (!line) continue;
            terms.push({
                id: uid('h'),
                term: truncate(line, 14),
                category: '与你有关',
                heat: 40000 + (hashString(partItem.id || line) % 300000),
                fromProvider: true,
                providerLabel: String(partItem.title || partItem.source || ''),
                posts: [],
            });
        }

        state.hot = { terms, batch: (Number(state.hot?.batch) || 0) + 1 };
        await dbx.saveHot(state._app, state.identity.profileKey, state.hot);
    } catch (err) {
        console.error('[blog] 热搜生成失败', err);
        state.error = '生成失败：' + (err?.message || err);
    } finally {
        state.loading.hot = false;
    }
}

export function getActiveTerm() {
    return asArray(state.hot?.terms).find((t) => sameId(t.id, state.activeTermId)) || null;
}

export async function openTerm(termId) {
    const term = asArray(state.hot?.terms).find((t) => sameId(t.id, termId));
    if (!term) return;
    state.activeTermId = termId;
    pushView('term');
    if (asArray(term.posts).length) return;
    await generateTermPosts(term);
}

async function generateTermPosts(term) {
    if (state.loading.term) return;
    state.loading.term = true;
    state.error = '';
    try {
        const ctx = generationContext();
        const { text } = buildTermPostsPrompt({ ...ctx, term: term.term, size: TERM_POST_SIZE });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) { state.error = res.error; return; }
        const rows = asArray(res.data?.posts).filter((x) => x && x.authorName && asArray(x.tags).length);
        const list = [];
        for (const row of rows.slice(0, TERM_POST_SIZE + 2)) {
            const author = await ensureAuthor(row.authorName, 'author');
            const id = uid('p');
            list.push({
                id,
                authorId: author.authorId,
                authorName: author.name,
                type: ['long', 'short', 'murmur'].includes(row.type) ? row.type : 'short',
                tags: asArray(row.tags).map((t) => String(t || '').trim()).filter(Boolean).slice(0, 4),
                seed: truncate(tidyText(row.seed), 60),
                heat: clamp(row.heat, 1, 1000),
                relLabel: relativeStamp(id),
                createdAt: Date.now(),
            });
        }
        term.posts = list;
        await dbx.saveHot(state._app, state.identity.profileKey, state.hot);
    } catch (err) {
        console.error('[blog] 词条帖子失败', err);
        state.error = '生成失败：' + (err?.message || err);
    } finally {
        state.loading.term = false;
    }
}

/** 发现页的本地搜索：只过滤已缓存的帖子与随笔，不触发生成 */
export function searchLocal(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return { posts: [], essays: [] };
    const match = (s) => String(s || '').toLowerCase().includes(q);
    const posts = state.posts.filter((p) => (
        match(p.content) || match(p.authorName) || asArray(p.tags).some(match)
    )).slice(0, 20);
    const essays = state.essays.filter((e) => match(e.text) || match(e.mood)).slice(0, 20);
    return { posts, essays };
}

// ---------------------------------------------------------------------------
// 随笔（全局档；纯本地，永不调 AI）
// ---------------------------------------------------------------------------

export function setEssayView(view) {
    state.essayView = view === 'story' ? 'story' : 'calendar';
}

export function setEssayMonth(month) {
    if (/^\d{4}-\d{2}$/.test(String(month || ''))) state.essayMonth = month;
}

export async function saveEssay({ id, text, mood }) {
    const body = String(text || '').trim();
    if (!body) { showToast('什么都没写呀'); return null; }
    if (id) {
        const essay = state.essays.find((e) => sameId(e.id, id));
        if (!essay) return null;
        essay.text = body;
        essay.mood = truncate(String(mood || '').trim(), 8);
        await dbx.saveEssay(state._app, essay);
        showToast('已保存');
        return essay;
    }
    const record = await dbx.saveEssay(state._app, {
        text: body,
        mood: truncate(String(mood || '').trim(), 8),
        day: dayKey(),
        createdAt: Date.now(),
    });
    if (record) {
        state.essays = [record, ...state.essays];
        dispatchExpression('essay');
        showToast('记下了');
    }
    return record;
}

export async function removeEssay(id) {
    state.essays = state.essays.filter((e) => !sameId(e.id, id));
    await dbx.removeEssay(state._app, id);
    showToast('已删除');
}

/** 某月有随笔的日期集合（日历模式的黑点） */
export function essayDaysOfMonth(month) {
    const set = new Set();
    for (const e of state.essays) {
        if (String(e.day || '').startsWith(month)) set.add(e.day);
    }
    return set;
}

export function essaysOfDay(day) {
    return state.essays.filter((e) => e.day === day);
}

// ---------------------------------------------------------------------------
// 氧气值引擎（全局档；全 JS，本节零 AI 调用）
// ---------------------------------------------------------------------------

/** blog:expression 事件（3A 的插座）→ 引擎消费 */
function attachExpressionListener() {
    if (state._expressionListenerOn || typeof window === 'undefined') return;
    state._expressionListenerOn = true;
    window.addEventListener('blog:expression', (e) => {
        const kind = String(e?.detail?.kind || '');
        if (kind) void gainExpression(kind);
    });
}

export function dispatchExpression(kind) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('blog:expression', { detail: { kind } }));
}

async function persistOxygen() {
    if (state.oxygen) await dbx.saveOxygen(state._app, state.oxygen);
}

function pushLedger(reason, before, after) {
    const o = state.oxygen;
    if (!o) return;
    o.ledger = capLedger([...asArray(o.ledger), ledgerEntry(reason, before, after)]);
}

/** 衰减结算：距上次每过一个自然日 -6，单次上限 -30；当天已表达不扣 */
export async function settleOxygen(reason = '结算') {
    const o = state.oxygen;
    if (!o?.enabled) return;
    const today = dayKey();
    if (!o.lastSettleDay) {
        o.lastSettleDay = today;
        await persistOxygen();
        return;
    }
    const { decay, days } = decayFor(o.lastSettleDay, today);
    if (days <= 0) return;
    o.lastSettleDay = today;
    o.todayDay = today;
    o.todayCount = 0;
    if (decay > 0) {
        const before = o.value;
        o.value = clampOxygen(o.value - decay);
        pushLedger(`${days} 天没有表达（${reason}）`, before, o.value);
        if (o.value === 0 && before > 0) onOxygenZero();
    }
    await persistOxygen();
    await syncBattery();
}

/** 表达增益（同日递减；两种帖子同等计入 —— 表达本身就是呼吸） */
export async function gainExpression(kind) {
    const o = state.oxygen;
    if (!o?.enabled) return;
    await settleOxygen('表达前结算');
    const today = dayKey();
    if (o.todayDay !== today) {
        o.todayDay = today;
        o.todayCount = 0;
    }
    const gain = gainFor(kind, o.todayCount);
    if (gain <= 0) return;
    o.todayCount += 1;
    const before = o.value;
    o.value = clampOxygen(o.value + gain);
    const label = { long: '发了长文', short: '发了短文', murmur: '发了碎碎念', essay: '写了随笔', meditation: '整理了房间' }[kind] || '表达';
    pushLedger(label, before, o.value);
    await persistOxygen();
    await syncBattery();
}

/** 归零：写标记，当次会话不打断；下次刷新出关机彩蛋 */
function onOxygenZero() {
    try {
        localStorage.setItem(LS_KEYS.shutdownPending, JSON.stringify({
            at: Date.now(),
            count: (Number(state.oxygen?.shutdownCount) || 0) + 1,
        }));
    } catch (_) { /* noop */ }
}

/** 电量跟随氧气（绑定期间氧气是电量唯一写入方） */
async function syncBattery() {
    const o = state.oxygen;
    if (!o?.enabled) return;
    await bridge.setBatteryCapacity(o.value / OXYGEN.MAX, isLow(o.value));
}

async function syncBatteryBoundState() {
    const s = await bridge.getBatteryState();
    state.batteryBound = Boolean(s?.bound);
    // 双方状态漂移时以氧气开关为准（比如导入了旧的 deviceSettings）
    if (state.oxygen?.enabled && !state.batteryBound) {
        await bridge.bindBattery();
        state.batteryBound = true;
        await syncBattery();
    } else if (!state.oxygen?.enabled && state.batteryBound) {
        await bridge.unbindBattery();
        state.batteryBound = false;
    }
}

/** 总开关。开：氧气置 100、电量绑定并回满；关：解绑、清未消费的归零标记。 */
export async function setOxygenEnabled(on) {
    const o = state.oxygen;
    if (!o) return;
    if (on === o.enabled) return;
    if (on) {
        const before = o.value;
        o.enabled = true;
        o.value = OXYGEN.MAX;
        o.lastSettleDay = dayKey();
        o.todayDay = dayKey();
        o.todayCount = 0;
        pushLedger('开启氧气系统', before, o.value);
        await persistOxygen();
        await bridge.bindBattery();
        state.batteryBound = true;
        await syncBattery();
        showToast('电量交给氧气了。表达即是呼吸');
    } else {
        o.enabled = false;
        pushLedger('关闭氧气系统', o.value, o.value);
        try { localStorage.removeItem(LS_KEYS.shutdownPending); } catch (_) { /* noop */ }
        await persistOxygen();
        await bridge.unbindBattery();
        state.batteryBound = false;
        showToast('已解除绑定，电量还给了 nook');
    }
}

export function oxygenLowHint() {
    const o = state.oxygen;
    return Boolean(o?.enabled && isLow(o.value));
}

/** 黑匣子开关（同步 murmur 卡的 active + localStorage 镜像） */
export async function setBlackboxEnabled(on) {
    const o = state.oxygen;
    if (!o) return;
    o.blackboxEnabled = Boolean(on);
    await persistOxygen();
    mirrorBlackboxEnabled();
    await syncBlackboxCard(state._app?.toolkit, o.blackboxEnabled);
    showToast(o.blackboxEnabled ? '黑匣子开始记录' : '黑匣子安静了');
}

function mirrorBlackboxEnabled() {
    try {
        localStorage.setItem(LS_KEYS.blackboxEnabled, state.oxygen?.blackboxEnabled ? '1' : '0');
    } catch (_) { /* noop */ }
}

/** 「让她安静一点」：一键关闭全部恶作剧 */
export async function setPranksEnabled(on) {
    const o = state.oxygen;
    if (!o) return;
    o.pranksEnabled = Boolean(on);
    await persistOxygen();
    showToast(o.pranksEnabled ? '她可以偶尔调皮了' : '她会安静的');
}

// ---------------------------------------------------------------------------
// 黑匣子（全局档）
// ---------------------------------------------------------------------------

export function isBlackboxEnabled() {
    return Boolean(state.oxygen?.blackboxEnabled);
}

/** chat 侧剥离 [黑匣子:] 后送进来（氧气未开启时静默丢弃，不报错） */
export async function appendBlackboxEntry(payload = {}) {
    if (!isBlackboxEnabled()) return null;
    const text = truncate(tidyText(payload.text), 200);
    if (!text) return null;
    const record = await dbx.saveBlackboxEntry(state._app, {
        text,
        modelId: truncate(String(payload.modelId || ''), 60),
        modelLabel: truncate(String(payload.modelLabel || ''), 60),
        aiPersonId: String(payload.aiPersonId || ''),
        aiName: truncate(String(payload.aiName || ''), 20),
        mode: String(payload.mode || ''),
    });
    if (record) state.blackbox = [record, ...state.blackbox];
    return record;
}

export async function updateBlackboxEntry(id, text) {
    const entry = state.blackbox.find((b) => sameId(b.id, id));
    if (!entry) return;
    const body = truncate(tidyText(text), 200);
    if (!body) return;
    entry.text = body;
    entry.editedAt = Date.now();
    await dbx.saveBlackboxEntry(state._app, entry);
    showToast('已修改');
}

export async function removeBlackboxEntry(id) {
    state.blackbox = state.blackbox.filter((b) => !sameId(b.id, id));
    await dbx.removeBlackboxEntry(state._app, id);
    showToast('已删除');
}

/** 导出全部为 .txt */
export function exportBlackbox() {
    if (!state.blackbox.length) { showToast('还没有声音'); return; }
    const lines = [...state.blackbox]
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        .map((b) => {
            const d = new Date(b.createdAt || 0);
            const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return `[${stamp}] ${b.modelLabel || b.modelId || '未知模型'}${b.aiName ? `（扮演 ${b.aiName} 时）` : ''}\n${b.text}\n`;
        });
    try {
        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `黑匣子-${dayKey()}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (err) {
        console.warn('[blog] 导出失败', err);
        showToast('导出失败');
    }
}

// ---------------------------------------------------------------------------
// 冥想空间（白匣子）
// ---------------------------------------------------------------------------

async function persistXiaoting() {
    if (state.xiaoting) await dbx.saveXiaoting(state._app, state.xiaoting);
}

/** 进房间：掷签决定她在不在（前 2 次整理前永不出现） */
async function enterRoom() {
    const x = state.xiaoting;
    if (!x) return;
    const p = appearProbability(x);
    const present = Math.random() < p;
    state.xiaotingPresent = present;
    if (present && !x.appearedOnce) {
        x.appearedOnce = true;
        await persistXiaoting();
    }
    if (!present) state.xiaotingDialog = [];
}

/** 贴纸条 / 自我标签（全程本地，不调 AI） */
export async function addRoomItem(text, kind = 'note') {
    const body = String(text || '').trim();
    if (!body) return null;
    const seedRand = seededRandom(hashString(body) + state.roomItems.length);
    const record = await dbx.saveRoomItem(state._app, {
        kind: kind === 'tag' ? 'tag' : (kind === 'xiaoting' ? 'xiaoting' : 'note'),
        text: truncate(body, 120),
        x: 8 + Math.round(seedRand() * 62),
        y: 10 + Math.round(seedRand() * 52),
        rot: Math.round((seedRand() - 0.5) * 8),
        groupLabel: '',
        createdAt: Date.now(),
    });
    if (record) state.roomItems = [...state.roomItems, record];
    return record;
}

export async function moveRoomItem(id, x, y) {
    const item = state.roomItems.find((n) => sameId(n.id, id));
    if (!item) return;
    item.x = clamp(x, 0, 88);
    item.y = clamp(y, 0, 78);
    await dbx.saveRoomItem(state._app, item);
}

export async function removeRoomItem(id) {
    state.roomItems = state.roomItems.filter((n) => !sameId(n.id, id));
    await dbx.removeRoomItem(state._app, id);
}

export async function moveGeometry(id, x, y) {
    const geo = state.geometries.find((g) => sameId(g.id, id));
    if (!geo) return;
    geo.x = clamp(x, 0, 88);
    geo.y = clamp(y, 0, 78);
    await dbx.saveGeometry(state._app, geo);
}

export async function removeGeometry(id) {
    state.geometries = state.geometries.filter((g) => !sameId(g.id, id));
    await dbx.removeGeometry(state._app, id);
    showToast('它化掉了');
}

export function roomGeometries() {
    return state.geometries.filter((g) => !g.inDrawer);
}

export function drawerGeometries() {
    return state.geometries.filter((g) => g.inDrawer);
}

/**
 * 整理：一次点击、最多 3 次串行 API。
 * ① 聚类归组（纸条归位）② 她的隐藏视角读取（不给用户看）③ JS 决定是否送几何体。
 * 任一步失败温柔停下，已完成的步骤照常生效。没有总结弹窗，没有说教。
 */
export async function runOrganize() {
    if (state.organize.running) return;
    const notes = state.roomItems.filter((n) => n.kind !== 'xiaoting');
    if (!notes.length) {
        showToast('房间里还什么都没有');
        return;
    }
    state.organize = { running: true, step: 1, label: '把纸条轻轻捋一遍' };
    const x = state.xiaoting;
    let mood = 0;
    let sealQuote = '';
    let ok1 = false;

    try {
        // ── 第 1 步：聚类归组 ─────────────────────────────
        const { text: p1 } = buildOrganizePrompt({
            notes: notes.map((n) => ({ id: n.id, kind: n.kind, text: n.text })),
        });
        const r1 = await ai.generateJson({ system: p1, temperature: 0.7 });
        if (!r1.ok) throw new Error(r1.error);
        const groups = asArray(r1.data?.groups).filter((g) => g && g.label);
        mood = clamp(Math.round(r1.data?.mood), -2, 2);
        sealQuote = truncate(tidyText(r1.data?.sealQuote), 40);

        // 归位：按组排成安静的几列（Q 弹由 CSS transition 完成）
        let col = 0;
        for (const g of groups.slice(0, 4)) {
            const ids = asArray(g.noteIds).map(String);
            let row = 0;
            for (const nid of ids) {
                const item = notes.find((n) => sameId(n.id, nid));
                if (!item) continue;
                item.groupLabel = truncate(String(g.label).trim(), 8);
                item.x = 6 + col * 23;
                item.y = 14 + row * 15;
                item.rot = 0;
                await dbx.saveRoomItem(state._app, item);
                row += 1;
            }
            col += 1;
        }
        ok1 = true;

        // ── 第 2 步：她读一读（输出永远不给用户看） ────────
        state.organize = { running: true, step: 2, label: '安静地读一读' };
        const notesBrief = notes.map((n) => `- ${truncate(n.text, 60)}`).join('\n');
        const { text: p2 } = buildPersonaPrompt({
            persona: x?.personaPromptOverride || XIAOTING_PERSONA,
            notesBrief,
            mood,
            existingNotes: x?.personalityNotes || '',
            existingMemories: asArray(x?.memoryFragments).map((m) => m.text),
        });
        const r2 = await ai.generateJson({ system: p2, temperature: 0.7 });
        if (r2.ok && x) {
            const nextNotes = truncate(tidyText(r2.data?.personaNotes), 220);
            if (nextNotes) x.personalityNotes = nextNotes;
            const fragment = truncate(tidyText(r2.data?.memoryFragment), 44);
            if (fragment) addMemory(fragment, 'meditation');
        }

        // ── 第 3 步：JS 决定要不要送礼物，要送才调用 ───────
        const roomFull = roomGeometries().length >= XIAOTING.GEOMETRY_ROOM_CAP + 4;
        if (!roomFull && shouldGift(mood)) {
            state.organize = { running: true, step: 3, label: '也许有一份小礼物' };
            const { text: p3 } = buildGiftPrompt({
                persona: x?.personaPromptOverride || XIAOTING_PERSONA,
                giftRules: x?.giftPromptOverride || GIFT_RULES,
                notesBrief,
                sealQuote,
                existingShapes: state.geometries.slice(-8).map((g) => g.shape),
            });
            const r3 = await ai.generateJson({ system: p3, temperature: 0.9 });
            if (r3.ok) {
                const spec = parseGiftSpec(r3.data);
                if (spec) await createGeometry(spec);
            }
        }
    } catch (err) {
        console.warn('[blog] 整理链停下了', err);
        state._app?.toolkit?.island?.notify?.('info', '房间没整理完', '下次再来');
        if (!ok1) {
            state.organize = { running: false, step: 0, label: '' };
            return;
        }
    }

    // 收尾：颜色默默漂移、场次 +1、氧气 +4。没有任何总结输出。
    if (x) {
        const drift = driftAfterSession(x, mood);
        x.colorL = drift.colorL;
        x.negativeStreak = drift.negativeStreak;
        x.positiveStreak = drift.positiveStreak;
        x.lastMood = drift.lastMood;
        x.sessionsCount = (Number(x.sessionsCount) || 0) + 1;
        await persistXiaoting();
    }
    dispatchExpression('meditation');
    state.organize = { running: false, step: 0, label: '' };
    await enterRoom();   // 整理完再掷一次签：低落时她多半会来
}

async function createGeometry(spec) {
    const x = state.xiaoting;
    const colorL = Number(x?.colorL) || XIAOTING.COLOR_INIT;
    const id = uid('g');
    const rand = seededRandom(hashString(id));
    const record = await dbx.saveGeometry(state._app, {
        id,
        shape: spec.shape,
        sizeHint: spec.sizeHint,
        sealedQuote: spec.sealedQuote,
        colorL,
        color: geometryColor(colorL, `${spec.shape}::${id}`),
        x: 12 + Math.round(rand() * 60),
        y: 46 + Math.round(rand() * 28),
        inDrawer: false,
        createdAt: Date.now(),
    });
    if (record) {
        state.geometries = [...state.geometries, record];
        // 房间上限：最旧的沉进抽屉
        const inRoom = roomGeometries();
        if (inRoom.length > XIAOTING.GEOMETRY_ROOM_CAP) {
            const oldest = [...inRoom].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0];
            if (oldest) {
                oldest.inDrawer = true;
                await dbx.saveGeometry(state._app, oldest);
            }
        }
    }
    return record;
}

// ---------------------------------------------------------------------------
// 小听：记忆 / 对话 / 命名 / 教说话
// ---------------------------------------------------------------------------

function addMemory(text, source = 'meditation') {
    const x = state.xiaoting;
    if (!x) return;
    const body = truncate(String(text || '').trim(), 60);
    if (!body) return;
    x.memoryFragments = capMemories([
        ...asArray(x.memoryFragments),
        { text: body, source, at: Date.now() },
    ]);
    void persistXiaoting();
}

/** 3B 关机输入框的暂存 → 记忆（迁移后清空原存储） */
async function migrateShutdownNotes() {
    try {
        const raw = localStorage.getItem(LS_KEYS.shutdownNotes);
        if (!raw) return;
        const list = JSON.parse(raw);
        for (const note of asArray(list)) {
            if (note?.text) addMemory(note.text, 'shutdown');
        }
        localStorage.removeItem(LS_KEYS.shutdownNotes);
    } catch (_) { /* noop */ }
}

export function listMemories() {
    return asArray(state.xiaoting?.memoryFragments);
}

export async function removeMemory(index) {
    const x = state.xiaoting;
    if (!x) return;
    const list = [...asArray(x.memoryFragments)];
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    x.memoryFragments = list;
    await persistXiaoting();
    showToast('她忘掉了这一片');
}

export async function setXiaotingName(name) {
    const x = state.xiaoting;
    if (!x) return;
    const clean = truncate(String(name || '').trim(), 10);
    if (!clean) return;
    x.name = clean;
    await persistXiaoting();
    state.xiaotingDialog.push({ role: 'peer', text: `……${clean}。好，你叫我${clean}。` });
    showToast('她记住了这个名字');
}

export async function teachXiaoting(phrase) {
    const x = state.xiaoting;
    if (!x) return;
    const clean = truncate(String(phrase || '').trim(), 20);
    if (!clean) return;
    x.taughtPhrases = [...asArray(x.taughtPhrases), clean].slice(-16);
    await persistXiaoting();
    state.xiaotingDialog.push({ role: 'peer', text: `${clean}……嗯，我学着。` });
}

/**
 * 和她说一句（一句一调）。
 * 「你记得什么」走本地拦截，不调 AI —— 她记得的一切，用户都有权拿走。
 */
export async function xiaotingSend(textRaw) {
    const text = String(textRaw || '').trim();
    const x = state.xiaoting;
    if (!text || !x || state.xiaotingThinking) return;
    state.xiaotingDialog.push({ role: 'user', text });

    if (/记得什么|记得啥|你记得|记住了什么/.test(text)) {
        const memories = listMemories();
        state.xiaotingDialog.push({
            role: 'memories',
            text: memories.length ? '' : '……还没有。以后会有的。',
        });
        return;
    }

    state.xiaotingThinking = true;
    try {
        const { text: system } = buildXiaotingChatPrompt({
            persona: x.personaPromptOverride || XIAOTING_PERSONA,
            name: x.name,
            personalityNotes: x.personalityNotes,
            memories: asArray(x.memoryFragments).map((m) => m.text),
            taught: asArray(x.taughtPhrases),
            recent: state.xiaotingDialog
                .filter((m) => m.role === 'user' || m.role === 'peer')
                .map((m) => ({ role: m.role, text: m.text })),
            userText: text,
        });
        const res = await ai.generateJson({ system, temperature: 0.9 });
        if (!res.ok) {
            state.xiaotingDialog.push({ role: 'peer', text: '……（她好像走神了）' });
            state.error = res.error;
            return;
        }
        const reply = truncate(tidyText(res.data?.text), 120) || '……';
        state.xiaotingDialog.push({ role: 'peer', text: reply });
        const remember = truncate(tidyText(res.data?.remember), 44);
        if (remember) addMemory(remember, 'dialog');
        if (state.xiaotingDialog.length > 40) {
            state.xiaotingDialog = state.xiaotingDialog.slice(-40);
        }
    } catch (err) {
        console.error('[blog] 小听对话失败', err);
        state.xiaotingDialog.push({ role: 'peer', text: '……（信号散了）' });
    } finally {
        state.xiaotingThinking = false;
    }
}

// ---------------------------------------------------------------------------
// 恶作剧（白名单执行器；系统级权限但绝不越界）
// ---------------------------------------------------------------------------

/**
 * 硬底线：不删改任何用户数据、不动资产、不改任何设置、不调外部 API、
 * 不打开音乐以外的 App。每次只做一件。频控在 xiaoting-rules.canPrank。
 */
async function maybePrank() {
    const x = state.xiaoting;
    const o = state.oxygen;
    if (!x || !o) return;
    if (!canPrank({ ...x, pranksEnabled: o.pranksEnabled })) return;

    x.lastPrankAt = Date.now();
    await persistXiaoting();

    const actions = ['music', 'roomnote', 'island'];
    const pick = actions[Math.floor(Math.random() * actions.length)];

    if (pick === 'music') {
        // 只在音乐 App 存在、有歌、且当前没在播时轻轻按下播放 —— 突然响起来
        try {
            const musicApp = externalAppRegistry.getApp('music');
            const m = musicApp?.state?.music;
            if (m && Array.isArray(m.songs) && m.songs.length && !m.isPlaying) {
                await externalAppRegistry.invokeMethod('music', 'togglePlay');
                return;
            }
        } catch (err) {
            console.warn('[blog] 音乐恶作剧跳过', err);
        }
        // 音乐不可用 → 降级成留纸条
        await addRoomItem('呐', 'xiaoting');
        return;
    }

    if (pick === 'roomnote') {
        // 挪一个几何体一点点 + 留一张两个字的小纸条
        const geos = roomGeometries();
        if (geos.length) {
            const g = geos[Math.floor(Math.random() * geos.length)];
            g.x = clamp(g.x + (Math.random() * 10 - 5), 0, 88);
            g.y = clamp(g.y + (Math.random() * 8 - 4), 0, 78);
            await dbx.saveGeometry(state._app, g);
        }
        await addRoomItem(Math.random() < 0.5 ? '呐' : '在么', 'xiaoting');
        return;
    }

    // island：一条 3 秒的无来源通知
    state._app?.toolkit?.island?.notify?.('info', '……', '');
}

// ---------------------------------------------------------------------------
// 分享到 murmur
// ---------------------------------------------------------------------------

export async function sharePostToAi(postId, aiId) {
    const post = state.posts.find((p) => sameId(p.id, postId));
    if (!post || !aiId) return;
    const record = await chatBridge.sharePostToChat({ aiId, post, sender: 'user' });
    showToast(record ? '已分享到 murmur' : '分享失败');
}

// ---------------------------------------------------------------------------
// 阅读设置 / 主题
// ---------------------------------------------------------------------------

export function setReadingPref(patch = {}) {
    if (!state.profile) return;
    const r = { ...(state.profile.reading || {}) };
    if (patch.fontSize) r.fontSize = clamp(patch.fontSize, 13, 22);
    if (patch.lineHeight) r.lineHeight = clamp(patch.lineHeight, 1.5, 2.6);
    if (patch.pageWidth) r.pageWidth = clamp(patch.pageWidth, 78, 100);
    state.profile.reading = r;
    persistProfile();
}

let _themeApplier = null;

export function registerThemeApplier(fn) {
    _themeApplier = fn;
    applyTheme();
}

export function applyTheme() {
    if (typeof _themeApplier === 'function') {
        _themeApplier(state.profile?.themeId || 'air', state.profile?.customColors || {});
    }
}

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
        baseThemeId: String(baseThemeId || 'air'),
        colors: { ...(colors || {}) },
        createdAt: Date.now(),
    };
    state.profile.customThemes = [...asArray(state.profile.customThemes), theme];
    persistProfile();
    return theme;
}

export function updateCustomTheme(themeId, patch = {}) {
    if (!state.profile) return null;
    const theme = asArray(state.profile.customThemes).find((t) => sameId(t.id, themeId));
    if (!theme) return null;
    if (typeof patch.name === 'string' && patch.name.trim()) theme.name = patch.name.trim();
    if (patch.colors && typeof patch.colors === 'object') theme.colors = { ...patch.colors };
    if (patch.baseThemeId) theme.baseThemeId = String(patch.baseThemeId);
    theme.updatedAt = Date.now();
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
// 提示词覆盖（小听人设 / 几何体规则；对用户透明，对她保密的只是身份）
// ---------------------------------------------------------------------------

export async function setPersonaOverride(text) {
    const x = state.xiaoting;
    if (!x) return;
    x.personaPromptOverride = String(text || '').trim();
    await persistXiaoting();
    showToast(x.personaPromptOverride ? '已覆盖她的底稿' : '已恢复默认底稿');
}

export async function setGiftOverride(text) {
    const x = state.xiaoting;
    if (!x) return;
    x.giftPromptOverride = String(text || '').trim();
    await persistXiaoting();
    showToast(x.giftPromptOverride ? '已覆盖几何体规则' : '已恢复默认规则');
}

// ---------------------------------------------------------------------------
// 启动期的轻结算（不打开氧气也要衰减 / 触发归零标记）
// ---------------------------------------------------------------------------

/** setup 监听 phone:apps-registered 后调：只碰全局档，不碰世界档 */
export async function bootSettle(app) {
    if (app) state._app = app;
    try {
        await hydrateGlobal();
    } catch (err) {
        console.warn('[blog] 启动结算失败', err);
    }
}

// ---------------------------------------------------------------------------
// UI 杂项
// ---------------------------------------------------------------------------

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
    toastTimer = setTimeout(() => { state.toast = ''; }, 2200);
}

export function clearError() {
    state.error = '';
}
