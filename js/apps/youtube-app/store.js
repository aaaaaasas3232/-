/**
 * 萤火 · 状态单例
 *
 * 一份 Vue.reactive，所有组件读它、通过这里的 mutator 改它。
 * 生成任务只往 store 写不碰 DOM。
 *
 * ── 档案切换 ──────────────────────────────────────────────────────
 * `hydrate()` 每次现算档案键（AGENTS2 §16.1），和上次不一样就整份换掉。
 *
 * ── AI 调用边界（一条都不能松）────────────────────────────────────
 * 首配完成 → 只生成视频列表；
 * 点视频     → 才生成详情 + 首批评论；点「更多」→ 才 +5 条评论；
 * 点头像     → 才生成主页；点「开始看直播」→ 才生成一场（弹幕池一次拿完，JS 分发）；
 * 发闲聊     → 才生成对方回复；点「让 TA 发视频」→ 才生成 AI 作品；
 * 点「生成私信」→ 才生成收件箱。
 * 没有任何定时器会调 AI。
 */

import {
    AI_CREATOR_PREFIX, COMMENT_PAGE, COVER_HUES, DANMAKU_POOL, DM_BATCH,
    FEED_SIZE, LIVE_CHANCE, LIVE_WINDOW_MS, PERSON_KIND, TABS,
} from './constants.js';
import { asArray, clamp, fmtDuration, hashString, sameId, tidyText, truncate, uid } from './utils.js';
import * as dbx from './services/db.js';
import * as world from './services/world-context.js';
import * as ai from './services/ai-service.js';
import * as avatarPool from './services/avatar-pool.js';
import * as chatBridge from './services/chat-bridge.js';
import {
    computeUploadStats, coverHue, isLiveNow, liveViewers, publishedLabel, remainingComments,
} from './services/stats.js';
import { makeOfflineRoom } from './services/live-room.js';
import {
    buildAiVideoPrompt, buildChatReplyPrompt, buildDmPrompt, buildFeedPrompt,
    buildLivePrompt, buildMoreCommentsPrompt, buildPersonPrompt,
    buildUserCommentsPrompt, buildVideoDetailPrompt,
} from './services/prompt-builder.js';
import { registerEncounteredCharacter } from '@/src/core/world-profile.js';

const Vue = typeof window !== 'undefined' ? window.Vue : null;
const reactive = (o) => (Vue?.reactive ? Vue.reactive(o) : o);

const state = reactive({
    /** hydrate 跑完了吗。false 显示骨架。 */
    ready: false,
    /** SDK 没就绪 / 没绑世界观时的拦截文案 */
    blocked: '',

    identity: {
        userName: '我', userAvatar: '', userAvatarBg: '',
        worldName: '', profileKey: '', ready: false, userId: '', worldId: '',
        user: null, world: null,
    },
    profile: null,
    needsConfig: false,

    tab: 'home',
    /** '' | 'video' | 'creator' | 'live' | 'chat' | 'theme' | 'prompts' */
    view: '',
    /** 消息 tab 的分段：'chats' | 'dms' */
    inboxSeg: 'chats',

    /** 当前这批视频列表（刷新即覆盖） */
    feed: [],
    feedBatch: 0,
    /** 收藏 / 已展开详情 / 卡片重建的外部视频 */
    videos: [],
    /** 站内用户（频道主 / 观众 / AI 频道） */
    creators: [],
    /** 用户与世界 AI 的作品 */
    uploads: [],

    /** 当前打开的视频（外部 stub/记录 或 upload 记录） */
    activeVideo: null,
    /** 'external' | 'upload' */
    activeVideoKind: 'external',
    /** 当前视频的评论 */
    comments: [],

    /** 当前打开的主页 */
    activeCreatorId: '',
    /** 当前直播（记录本体；播放调度在组件里） */
    activeLive: null,
    /** 离线直播间的静态内容 */
    offlineRoom: null,

    /** 站内闲聊 */
    chatPeerId: '',
    chatMessages: [],
    /** 会话索引（peerId → 最后一条），进消息页时重算 */
    chatSessions: [],

    /** 私信 */
    dms: [],

    /** 头像 dataUrl 缓存（code → src），YtAvatar 直接读 */
    avatarSrc: {},

    loading: {
        feed: false, detail: false, comments: false, person: '',
        live: false, chat: false, aiVideo: '', dms: false,
        userComments: '', friend: '',
    },
    error: '',
    toast: '',

    onboarding: {
        step: 0,
        clips: [], prompts: [],
        clipIds: [], promptIds: [],
        taste: '',
        nickname: '',
        followers: 0,
        followerPresetId: 'tiny',
        galleryGroups: [],
        galleryGroupId: '',
        loading: false,
    },

    /** 弹窗 { type, payload } */
    modal: null,

    /** contentCards 深链：hydrate 完成后要打开的视频 */
    _pendingVideoId: '',

    /**
     * 覆盖页导航栈（不含当前 view）。
     * 视频 ↔ 主页 ↔ 直播可以互相点进去，返回时按来路退 ——
     * 没有栈的话「视频→作者→返回→视频→返回→作者」会变成死循环。
     */
    _viewStack: [],

    _app: null,
    _hydrating: false,
});

/** 进入一个覆盖页：把当前 view 压栈（同名页只留最近一层） */
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
    state.error = '';   // 上一页的错误条不跟着进新页
}

/** 返回上一层覆盖页；栈空回 tab */
function popView() {
    state.view = state._viewStack.pop() || '';
    state.error = '';
    return state.view;
}

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
// 启动 / 切档
// ---------------------------------------------------------------------------

let _hydratePromise = null;

/**
 * ★ 并发安全：contentCards（murmur 卡片点进来）和根组件 mounted 可能同时调。
 * 早返回会让后来的调用方拿着「半份数据」继续跑，所以所有并发调用方
 * 等**同一个** promise。
 */
export function hydrate(app) {
    if (app) state._app = app;
    if (_hydratePromise) return _hydratePromise;
    _hydratePromise = doHydrate().finally(() => { _hydratePromise = null; });
    return _hydratePromise;
}

async function doHydrate() {
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

        const [feedRow, videos, creators, uploads, dms] = await Promise.all([
            dbx.loadFeed(state._app, key),
            dbx.listVideos(state._app, key),
            dbx.listCreators(state._app, key),
            dbx.listUploads(state._app, key),
            dbx.listDms(state._app, key),
        ]);
        state.feed = asArray(feedRow?.list);
        state.feedBatch = Number(feedRow?.batch) || 0;
        state.videos = videos;
        state.creators = creators;
        state.uploads = uploads;
        state.dms = dms;

        await syncAiCreators();
        await rebuildChatSessions();
        state.ready = true;

        // contentCards 深链：数据就位后再开
        if (state._pendingVideoId) {
            const vid = state._pendingVideoId;
            state._pendingVideoId = '';
            await openVideoById(vid);
        }
    } catch (err) {
        console.error('[youtube] hydrate 失败', err);
        state.error = '读取数据失败：' + (err?.message || err);
        state.ready = true;
    } finally {
        state._hydrating = false;
    }
}

/** 每次 App 被打开重新对一次身份；键没变就什么都不做 */
export async function recheckIdentity() {
    const next = world.getProfileKey();
    if (next && next === state.identity.profileKey && state.profile) {
        await syncAiCreators();   // AI 名单可能变了（新绑了 AI 进这个世界）
        return;
    }
    resetForProfileSwitch();
    await hydrate(state._app);
}

function resetForProfileSwitch() {
    state.ready = false;
    state.profile = null;
    state.onboarding.step = 0;    // ★ 引导步数归零（AGENTS2 §16.5 ②）
    state.feed = [];
    state.feedBatch = 0;
    state.videos = [];
    state.creators = [];
    state.uploads = [];
    state.comments = [];
    state.dms = [];
    state.chatMessages = [];
    state.chatSessions = [];
    state.chatPeerId = '';
    state.activeVideo = null;
    state.activeCreatorId = '';
    state.activeLive = null;
    state.offlineRoom = null;
    state.view = '';
    state._viewStack = [];
    state.tab = 'home';
    state.inboxSeg = 'chats';
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
        state.onboarding.galleryGroups = await avatarPool.listGalleryGroups();
        const social = world.readUserSocialProfile(state.identity.user);
        if (state.profile) {
            state.onboarding.clipIds = [...asArray(state.profile.clipIds)];
            state.onboarding.promptIds = [...asArray(state.profile.promptIds)];
            state.onboarding.taste = state.profile.taste || '';
            state.onboarding.nickname = state.profile.channel?.nickname
                || social.nickname || state.identity.userName;
            state.onboarding.followers = Number(state.profile.channel?.followers) || 0;
            state.onboarding.galleryGroupId = state.profile.galleryGroupId || '';
        } else {
            state.onboarding.nickname = social.nickname || state.identity.userName;
        }
    } finally {
        state.onboarding.loading = false;
    }
}

export function setOnboardingStep(step) {
    state.onboarding.step = Math.max(0, Math.min(3, step));
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

export function setTaste(text) { state.onboarding.taste = String(text || ''); }
export function setObNickname(text) { state.onboarding.nickname = String(text || '').slice(0, 20); }
export function setObFollowers(n) { state.onboarding.followers = clamp(n, 0, 999999999); }
export function setObGalleryGroup(id) { state.onboarding.galleryGroupId = String(id || ''); }

/** 配完 → 落盘 → 只生成视频列表（详情、主页、直播都等用户点） */
export async function finishOnboarding() {
    const key = state.identity.profileKey;
    if (!key) return false;

    const profile = state.profile || dbx.makeProfile(key);
    profile.id = key;
    profile.configured = true;
    profile.clipIds = [...state.onboarding.clipIds];
    profile.promptIds = [...state.onboarding.promptIds];
    profile.taste = state.onboarding.taste;
    profile.channel = {
        ...(profile.channel || {}),
        nickname: state.onboarding.nickname.trim() || state.identity.userName,
        followers: Math.max(0, Number(state.onboarding.followers) || 0),
    };
    const nextGroup = state.onboarding.galleryGroupId;
    if (nextGroup !== profile.galleryGroupId) {
        profile.galleryGroupId = nextGroup;
        profile.galleryGroupName = state.onboarding.galleryGroups
            .find((g) => g.id === nextGroup)?.name || '';
        avatarPool.invalidateGroupCache(nextGroup);
    }
    state.profile = profile;

    await dbx.saveProfile(state._app, profile);
    state.needsConfig = false;
    applyTheme();
    await syncAiCreators();

    // ★ 生成失败也不退回引导页 —— 配置本身已经成功了
    return generateFeed();
}

export async function reopenOnboarding() {
    state.needsConfig = true;
    state.onboarding.step = 0;
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
        taste: p?.taste || '',
    };
}

/** 刷新页面后直接进 App 时，prompt 库条目可能还没拉过，补一次 */
async function ensurePromptsLoaded() {
    if (!asArray(state.profile?.promptIds).length) return;
    if (asArray(state.onboarding.prompts).length) return;
    state.onboarding.prompts = await world.listLibraryPrompts();
}

/** 被关掉的 provider 键（存 profile，按档案隔离） */
function disabledProviderKeys() {
    const prefs = state.profile?.providerPrefs || {};
    return Object.keys(prefs).filter((k) => prefs[k] === false);
}

/**
 * 收集演员 / 爱豆 / 电竞等 App 注册的动态影响。
 * provider 现在可能一个都没有 —— collect 返回空数组，prompt 不受影响。
 */
async function collectInfluences(channel) {
    const toolkit = state._app?.toolkit;
    if (!toolkit?.socialInfluences?.collect) return [];
    try {
        return await toolkit.socialInfluences.collect('youtube', {
            channel,
            profileKey: state.identity.profileKey,
            disabledProviderKeys: disabledProviderKeys(),
        });
    } catch (err) {
        console.warn('[youtube] 收集跨 App 影响失败（不影响本次生成）', err);
        return [];
    }
}

/** 提示词页要展示的 provider 清单（含启停状态） */
export function listProviders() {
    const toolkit = state._app?.toolkit;
    if (!toolkit?.socialInfluences?.list) return [];
    const disabled = new Set(disabledProviderKeys());
    return toolkit.socialInfluences.list('youtube').map((p) => ({
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

// ---------------------------------------------------------------------------
// 站内用户（externalId 稳定）
// ---------------------------------------------------------------------------

/** 按名字找已有站内用户（同名 = 同一个人，绝不发新身份） */
function findCreatorByName(name) {
    const key = String(name || '').trim();
    if (!key) return null;
    return state.creators.find((c) => c.name === key) || null;
}

export function getCreatorById(creatorId) {
    return state.creators.find((c) => sameId(c.creatorId, creatorId)) || null;
}

/**
 * 确保一个站内用户存在（feed / 评论 / 弹幕里出现的名字都走这里）。
 * 新用户会立刻从图库分到一张头像并持久化。
 */
async function ensureCreator(name, kind = PERSON_KIND.creator) {
    const existed = findCreatorByName(name);
    if (existed) return existed;
    const record = {
        creatorId: uid('cr'),
        name: String(name || '').trim() || '匿名用户',
        kind,
        bio: '',
        personality: '',
        followers: 0,
        following: 0,
        works: [],
        profileGenerated: false,
        followed: false,
        nookPersonId: '',
        firstSeenAt: Date.now(),
    };
    await avatarPool.ensureAvatarAssigned(state.profile, record.creatorId);
    persistProfile();
    const stored = await dbx.saveCreator(state._app, state.identity.profileKey, record);
    if (stored) state.creators = [stored, ...state.creators];
    return stored || record;
}

async function persistCreator(creator) {
    if (!creator) return;
    const stored = await dbx.saveCreator(state._app, state.identity.profileKey, creator);
    if (stored) {
        const i = state.creators.findIndex((c) => sameId(c.creatorId, creator.creatorId));
        if (i >= 0) state.creators.splice(i, 1, stored);
        else state.creators = [stored, ...state.creators];
    }
}

/** 世界 AI → AI 频道记录（名单每次进 App 对一遍；AI 频道不吃图库头像，用人设头像） */
async function syncAiCreators() {
    if (!state.profile?.configured) return;
    const ais = world.listWorldAis(state.identity.world);
    for (const person of ais) {
        if (!person.id) continue;
        const creatorId = AI_CREATOR_PREFIX + person.id;
        const existed = getCreatorById(creatorId);
        const nickname = String(person.social?.nickname || '').trim() || person.name;
        if (existed) {
            // 名字 / 头像跟着人设走（人设是真相），其余生成数据不动
            if (existed.name !== nickname || existed.aiAvatar !== person.avatar) {
                existed.name = nickname;
                existed.aiAvatar = person.avatar || '';
                existed.aiAvatarBg = person.avatarBg || '';
                await persistCreator(existed);
            }
            continue;
        }
        const record = {
            creatorId,
            name: nickname,
            kind: PERSON_KIND.ai,
            aiPersonId: person.id,
            aiAvatar: person.avatar || '',
            aiAvatarBg: person.avatarBg || '',
            bio: person.role || '',
            personality: person.personality || '',
            followers: 300 + (hashString(creatorId) % 4700),
            following: hashString(`f::${creatorId}`) % 200,
            works: [],
            profileGenerated: false,
            followed: false,
            nookPersonId: '',
            firstSeenAt: Date.now(),
        };
        await persistCreator(record);
    }
}

/** 世界 AI 频道列表（频道 tab 用） */
export function listAiCreators() {
    return state.creators.filter((c) => c.kind === PERSON_KIND.ai);
}

/** 认识的外部创作者（点开过主页的） */
export function listKnownPeople() {
    return state.creators.filter((c) => c.kind !== PERSON_KIND.ai && c.profileGenerated);
}

// ---------------------------------------------------------------------------
// 头像
// ---------------------------------------------------------------------------

/**
 * 组件用：拿某个站内用户的头像描述（同步）。
 * 图库头像先返回占位、后台把 dataUrl 灌进 state.avatarSrc（reactive，会自动重画）。
 */
export function avatarInfo(creator) {
    if (!creator) return { src: '', slot: 0, initial: '?' };
    if (creator.kind === PERSON_KIND.ai && creator.aiAvatar) {
        return { src: creator.aiAvatar, slot: 0, initial: creator.name?.[0] || 'A', bg: creator.aiAvatarBg || '' };
    }
    const code = state.profile?.avatarMap?.[creator.creatorId]?.code || '';
    if (code) {
        const cached = state.avatarSrc[code];
        if (cached === undefined) void loadAvatarSrc(code);
        if (cached) return { src: cached, slot: 0, initial: creator.name?.[0] || '?' };
    }
    return { src: '', slot: avatarPool.fallbackSlot(creator.creatorId), initial: creator.name?.[0] || '?' };
}

async function loadAvatarSrc(code) {
    if (state.avatarSrc[code] !== undefined) return;
    state.avatarSrc[code] = '';   // 占位，防止并发重复拉
    const src = await avatarPool.resolveAvatarSrc(code);
    state.avatarSrc[code] = src || '';
}

/** 换绑图组（已有映射保持 —— 「重新分配」是另一个显式按钮） */
export async function setGalleryGroup(groupId, groupName) {
    if (!state.profile) return;
    state.profile.galleryGroupId = String(groupId || '');
    state.profile.galleryGroupName = String(groupName || '');
    avatarPool.invalidateGroupCache(groupId);
    persistProfile();
    showToast(groupId ? '图库已绑定，新面孔会从这里取头像' : '已解绑图库，改用占位头像');
}

/** 重新分配全部头像（显式操作） */
export async function reassignAvatars() {
    if (!state.profile?.galleryGroupId) return 0;
    const ids = state.creators
        .filter((c) => c.kind !== PERSON_KIND.ai)
        .map((c) => c.creatorId);
    const n = await avatarPool.reassignAll(state.profile, ids);
    state.avatarSrc = {};   // 缓存作废，按新映射重新拉
    persistProfile();
    showToast(n ? `已重新分配 ${n} 张头像` : '图组里没有可用图片');
    return n;
}

// ---------------------------------------------------------------------------
// 视频列表
// ---------------------------------------------------------------------------

export async function generateFeed() {
    if (state.loading.feed) return false;
    state.loading.feed = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const ctx = generationContext();
        const influenceParts = await collectInfluences('feed');
        const knownCreators = state.creators
            .filter((c) => c.kind === PERSON_KIND.creator)
            .slice(0, 16)
            .map((c) => ({ name: c.name, kind: c.works?.[0]?.title ? '' : '', followers: c.followers }));
        const exclude = [
            ...state.feed.map((v) => v.title),
            ...state.videos.map((v) => v.title),
        ].filter(Boolean);

        const { text } = buildFeedPrompt({ ...ctx, influenceParts, knownCreators, exclude, size: FEED_SIZE });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) {
            state.error = res.error;
            return false;
        }

        const rows = asArray(res.data?.videos).filter((x) => x && x.title && x.creatorName);
        if (!rows.length) {
            state.error = 'AI 这次一条视频都没给出来，再试一次';
            return false;
        }

        const list = [];
        for (const row of rows.slice(0, FEED_SIZE + 2)) {
            const creator = await ensureCreator(row.creatorName, PERSON_KIND.creator);
            const id = uid('v');
            list.push({
                id,
                title: truncate(String(row.title).trim(), 40),
                coverText: truncate(String(row.coverText || row.title).trim(), 10),
                coverHue: coverHue(id, COVER_HUES),
                creatorId: creator.creatorId,
                creatorName: creator.name,
                kind: truncate(String(row.kind || '').trim(), 6),
                blurb: truncate(tidyText(row.blurb), 60),
                tags: asArray(row.tags).map((t) => String(t || '').trim()).filter(Boolean).slice(0, 3),
                durationSec: clamp(row.durationSec, 30, 7200),
                durationLabel: fmtDuration(row.durationSec, id),
                views: Math.max(0, Number(row.views) || 0),
                publishedLabel: publishedLabel(id),
                favorited: false,
                createdAt: Date.now(),
            });
        }
        state.feed = list;
        state.feedBatch += 1;
        await dbx.saveFeed(state._app, state.identity.profileKey, state.feed, state.feedBatch);
        return true;
    } catch (err) {
        console.error('[youtube] 生成列表失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.feed = false;
    }
}

// ---------------------------------------------------------------------------
// 视频详情 + 评论
// ---------------------------------------------------------------------------

/** 打开外部视频。没有 detail 才现生成（不点不生成）。 */
export async function openVideo(stub) {
    if (!stub) return;
    const saved = state.videos.find((v) => sameId(v.id, stub.id));
    state.activeVideo = saved || stub;
    state.activeVideoKind = 'external';
    pushView('video');
    state.comments = await dbx.listComments(state._app, stub.id);
    if (!state.activeVideo.detail) {
        await generateVideoDetail(state.activeVideo);
    }
}

/** 打开自己 / AI 的作品 */
export async function openUpload(upload) {
    if (!upload) return;
    state.activeVideo = upload;
    state.activeVideoKind = 'upload';
    pushView('video');
    state.comments = await dbx.listComments(state._app, upload.id);
}

export async function generateVideoDetail(video, { force = false } = {}) {
    if (!video || state.loading.detail) return false;
    if (video.detail && !force) return true;
    state.loading.detail = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const ctx = generationContext();
        const influenceParts = await collectInfluences('detail');
        const creator = getCreatorById(video.creatorId);
        const { text } = buildVideoDetailPrompt({ ...ctx, influenceParts, video, creator });
        const res = await ai.generateJson({ system: text, temperature: 0.95 });
        if (!res.ok) {
            state.error = res.error;
            return false;
        }
        const data = res.data || {};
        video.detail = {
            intro: tidyText(data.intro),
            sections: asArray(data.sections).map((s) => ({
                at: String(s?.at || '').trim().slice(0, 8),
                text: tidyText(s?.text),
            })).filter((s) => s.text).slice(0, 8),
            likes: Math.max(0, Number(data.likes) || 0),
            commentCount: Math.max(asArray(data.comments).length, Number(data.commentCount) || 0),
            generatedAt: Date.now(),
        };

        // 首批评论落盘（评论人进站内用户表，头像跟着分）
        const firstBatch = asArray(data.comments).slice(0, COMMENT_PAGE);
        let seq = state.comments.reduce((m, c) => Math.max(m, c.seq || 0), 0);
        for (const row of firstBatch) {
            if (!row?.text) continue;
            const person = await ensureCreator(String(row.authorName || '路人'), PERSON_KIND.viewer);
            seq += 1;
            const stored = await dbx.saveComment(state._app, state.identity.profileKey, {
                videoId: video.id,
                authorId: person.creatorId,
                authorName: person.name,
                text: tidyText(row.text),
                likes: Math.max(0, Number(row.likes) || 0),
                seq,
            });
            if (stored) state.comments = [...state.comments, stored];
        }

        await saveVideoSnapshot(video);
        return true;
    } catch (err) {
        console.error('[youtube] 生成详情失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.detail = false;
    }
}

/** 展开过详情的视频进 videos 表存住（token 已经花了，别丢） */
async function saveVideoSnapshot(video) {
    const key = state.identity.profileKey;
    const saved = state.videos.find((v) => sameId(v.id, video.id));
    if (saved) {
        Object.assign(saved, video);
        await dbx.saveVideo(state._app, key, saved);
    } else {
        const stored = await dbx.saveVideo(state._app, key, { ...video });
        if (stored) state.videos = [stored, ...state.videos];
    }
    if (state.feed.some((v) => sameId(v.id, video.id))) {
        await dbx.saveFeed(state._app, key, state.feed, state.feedBatch);
    }
}

/** 外部视频：更多评论（每次 +5，一次 API） */
export async function generateMoreComments() {
    const video = state.activeVideo;
    if (!video || state.activeVideoKind !== 'external' || state.loading.comments) return false;
    state.loading.comments = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const ctx = generationContext();
        const existing = state.comments.map((c) => ({ authorName: c.authorName, text: c.text }));
        const { text } = buildMoreCommentsPrompt({ ...ctx, video, existing, count: COMMENT_PAGE });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) { state.error = res.error; return false; }

        let seq = state.comments.reduce((m, c) => Math.max(m, c.seq || 0), 0);
        for (const row of asArray(res.data?.comments).slice(0, COMMENT_PAGE)) {
            if (!row?.text) continue;
            const person = await ensureCreator(String(row.authorName || '路人'), PERSON_KIND.viewer);
            seq += 1;
            const stored = await dbx.saveComment(state._app, state.identity.profileKey, {
                videoId: video.id,
                authorId: person.creatorId,
                authorName: person.name,
                text: tidyText(row.text),
                likes: Math.max(0, Number(row.likes) || 0),
                seq,
            });
            if (stored) state.comments = [...state.comments, stored];
        }
        // 评论总数至少要盖过已加载的
        if (video.detail && video.detail.commentCount < state.comments.length) {
            video.detail.commentCount = state.comments.length;
            await saveVideoSnapshot(video);
        }
        return true;
    } catch (err) {
        console.error('[youtube] 更多评论失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.comments = false;
    }
}

/** 用户自己发一条评论（不调 AI） */
export async function postComment(text) {
    const video = state.activeVideo;
    const body = String(text || '').trim();
    if (!video || !body) return false;
    const seq = state.comments.reduce((m, c) => Math.max(m, c.seq || 0), 0) + 1;
    const stored = await dbx.saveComment(state._app, state.identity.profileKey, {
        videoId: video.id,
        authorId: '',
        authorName: state.profile?.channel?.nickname || state.identity.userName,
        isUser: true,
        text: body,
        likes: 0,
        seq,
    });
    if (stored) state.comments = [...state.comments, stored];
    if (state.activeVideoKind === 'external' && video.detail) {
        video.detail.commentCount = (video.detail.commentCount || 0) + 1;
        await saveVideoSnapshot(video);
    }
    return true;
}

/** 关视频：按来路退（主页作品点进来的退回主页，feed 点进来的回 tab） */
export function closeVideo() {
    state.activeVideo = null;
    state.comments = [];
    popView();
    if (state.view !== 'creator' && state.view !== 'live') state.activeCreatorId = '';
}

/** 关主页：按来路退（视频页点进来的退回视频） */
export function closeCreator() {
    state.activeCreatorId = '';
    popView();
    if (state.view !== 'video') { state.activeVideo = null; state.comments = []; }
}

// ---------------------------------------------------------------------------
// 收藏 / 分享
// ---------------------------------------------------------------------------

/**
 * 收藏外部视频 = 搬进 videos 表；取消时若没展开过详情且不在当前 feed，整条删掉。
 * 幂等：连点两下回到原状态，不会重复入表。
 */
export async function toggleFavorite(video) {
    if (!video) return;
    if (state.activeVideoKind === 'upload' || video.ownerType) {
        return toggleFavoriteUpload(video);
    }
    const key = state.identity.profileKey;
    const saved = state.videos.find((v) => sameId(v.id, video.id));

    if (video.favorited && saved) {
        video.favorited = false;
        saved.favorited = false;
        const inFeed = state.feed.some((v) => sameId(v.id, video.id));
        if (!saved.detail && !inFeed) {
            await dbx.removeVideo(state._app, saved.id);
            state.videos = state.videos.filter((v) => !sameId(v.id, saved.id));
        } else {
            await dbx.saveVideo(state._app, key, saved);
        }
        if (inFeed) await dbx.saveFeed(state._app, key, state.feed, state.feedBatch);
        showToast('已取消收藏');
        return;
    }

    video.favorited = true;
    const record = saved || { ...video };
    record.favorited = true;
    const stored = await dbx.saveVideo(state._app, key, record);
    if (stored && !saved) state.videos = [stored, ...state.videos];
    if (state.feed.some((v) => sameId(v.id, video.id))) {
        await dbx.saveFeed(state._app, key, state.feed, state.feedBatch);
    }
    showToast('已收藏');
}

async function toggleFavoriteUpload(upload) {
    const row = state.uploads.find((u) => sameId(u.id, upload.id));
    if (!row) return;
    row.favorited = !row.favorited;
    await dbx.saveUpload(state._app, state.identity.profileKey, row);
    showToast(row.favorited ? '已收藏' : '已取消收藏');
}

/** 收藏 tab 的数据源：外部收藏 + 收藏的作品 */
export function listFavorites() {
    return [
        ...state.videos.filter((v) => v.favorited),
        ...state.uploads.filter((u) => u.favorited),
    ].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** 分享到 murmur（卡片只带快照；被分享的外部视频顺手入表，防止刷新后卡片指空） */
export async function shareVideo(video, aiId, note = '') {
    if (!video || !aiId) return false;
    const isUpload = Boolean(video.ownerType);
    const payload = {
        id: video.id,
        title: video.title,
        coverText: video.coverText,
        coverHue: video.coverHue,
        creatorName: isUpload ? video.ownerName : video.creatorName,
        kind: video.kind,
        blurb: video.blurb || video.intro || '',
        views: isUpload ? (video.stats?.views || 0) : (video.views || 0),
        durationSec: video.durationSec || 0,
    };
    const record = await chatBridge.shareVideoToChat({ aiId, video: payload, note });
    if (!record) {
        state.error = '分享失败：聊天系统还没就绪';
        return false;
    }
    if (!isUpload) {
        video.sharedAt = Date.now();
        await saveVideoSnapshot(video);
    }
    showToast('已分享到聊天');
    return true;
}

// ---------------------------------------------------------------------------
// 站内用户主页
// ---------------------------------------------------------------------------

export async function openCreator(creatorId) {
    const creator = getCreatorById(creatorId);
    if (!creator) return;
    state.activeCreatorId = creator.creatorId;
    pushView('creator');
    if (!creator.profileGenerated) {
        await generatePersonProfile(creator);
    }
}

export function activeCreator() {
    return getCreatorById(state.activeCreatorId);
}

export async function generatePersonProfile(creator, { force = false } = {}) {
    if (!creator || state.loading.person) return false;
    if (creator.profileGenerated && !force) return true;
    state.loading.person = creator.creatorId;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const ctx = generationContext();
        const influenceParts = await collectInfluences('person');
        const knownWorks = [
            ...state.feed.filter((v) => sameId(v.creatorId, creator.creatorId)).map((v) => v.title),
            ...state.videos.filter((v) => sameId(v.creatorId, creator.creatorId)).map((v) => v.title),
        ];
        const sourceHint = creator.kind === PERSON_KIND.viewer ? '在某条视频的评论区看到 TA' : '';
        const person = {
            name: creator.name,
            kind: creator.kind === PERSON_KIND.viewer ? 'viewer' : 'creator',
        };
        const { text } = buildPersonPrompt({ ...ctx, influenceParts, person, knownWorks, sourceHint });
        const res = await ai.generateJson({ system: text, temperature: 0.95 });
        if (!res.ok) { state.error = res.error; return false; }

        const data = res.data || {};
        creator.bio = tidyText(data.bio);
        creator.personality = tidyText(data.personality);
        creator.followers = Math.max(0, Number(data.followers) || 0);
        creator.following = Math.max(0, Number(data.following) || 0);
        creator.works = asArray(data.works).map((w) => {
            const wid = uid('vw');
            return {
                id: wid,
                title: truncate(String(w?.title || '').trim(), 40),
                coverText: truncate(String(w?.coverText || w?.title || '').trim(), 10),
                coverHue: coverHue(wid, COVER_HUES),
                views: Math.max(0, Number(w?.views) || 0),
                durationSec: clamp(w?.durationSec, 30, 7200),
                durationLabel: fmtDuration(w?.durationSec, wid),
            };
        }).filter((w) => w.title).slice(0, 6);
        creator.profileGenerated = true;
        creator.profileGeneratedAt = Date.now();
        await persistCreator(creator);
        return true;
    } catch (err) {
        console.error('[youtube] 生成主页失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.person = '';
    }
}

export async function toggleFollow(creatorId) {
    const creator = getCreatorById(creatorId);
    if (!creator) return;
    creator.followed = !creator.followed;
    await persistCreator(creator);
    showToast(creator.followed ? `已关注 ${creator.name}` : '已取消关注');
}

/** 把主页里的代表作变成可打开的视频（首次点开会走详情生成） */
export async function openCreatorWork(creator, work) {
    if (!creator || !work) return;
    const existed = state.videos.find((v) => sameId(v.id, work.id));
    const stub = existed || {
        id: work.id,
        title: work.title,
        coverText: work.coverText,
        coverHue: work.coverHue,
        creatorId: creator.creatorId,
        creatorName: creator.name,
        kind: '',
        blurb: '',
        tags: [],
        durationSec: work.durationSec || 0,
        durationLabel: work.durationLabel || fmtDuration(work.durationSec, work.id),
        views: work.views || 0,
        publishedLabel: publishedLabel(work.id),
        favorited: false,
        createdAt: Date.now(),
    };
    await openVideo(stub);
}

// ---------------------------------------------------------------------------
// 直播
// ---------------------------------------------------------------------------

export function liveWindowStamp() {
    return Math.floor(Date.now() / LIVE_WINDOW_MS);
}

/** 这个主播现在开播吗（可复现，不调 AI） */
export function creatorIsLive(creator) {
    if (!creator) return false;
    return isLiveNow(creator.creatorId, liveWindowStamp(), LIVE_CHANCE);
}

/** 进直播间：在播 → 读已有场次（没有就等用户点「开始看」再生成）；不在播 → 静态房间 */
export async function openLive(creatorId) {
    const creator = getCreatorById(creatorId);
    if (!creator) return;
    state.activeCreatorId = creator.creatorId;
    pushView('live');
    state.activeLive = null;
    state.offlineRoom = null;

    if (!creatorIsLive(creator)) {
        state.offlineRoom = makeOfflineRoom(creator);
        return;
    }
    const stamp = liveWindowStamp();
    const existed = await dbx.getLive(state._app, state.identity.profileKey, creator.creatorId, stamp);
    if (existed) state.activeLive = existed;
    // 没有已存场次时不自动生成 —— 直播页会给「开始看直播」按钮
}

/** 生成一场直播（一次 API 拿全弹幕池；JS 分发） */
export async function generateLiveSession() {
    const creator = activeCreator();
    if (!creator || state.loading.live || state.activeLive) return false;
    state.loading.live = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const ctx = generationContext();
        const influenceParts = await collectInfluences('live');
        const stamp = liveWindowStamp();
        const viewers = liveViewers(creator.followers, creator.creatorId, stamp);
        const danmakuCount = DANMAKU_POOL.min
            + (hashString(`${creator.creatorId}::${stamp}`) % (DANMAKU_POOL.max - DANMAKU_POOL.min + 1));

        const { text } = buildLivePrompt({ ...ctx, influenceParts, creator, viewers, danmakuCount });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) { state.error = res.error; return false; }

        const data = res.data || {};
        const norm = (rows, maxLen) => asArray(rows)
            .map((r) => ({
                atSec: clamp(r?.atSec, 0, 600),
                name: truncate(String(r?.name || '').trim(), 12),
                text: truncate(tidyText(r?.text), maxLen),
            }))
            .filter((r) => r.text)
            .sort((a, b) => a.atSec - b.atSec);

        const live = {
            creatorId: creator.creatorId,
            windowStamp: stamp,
            topic: truncate(tidyText(data.topic), 24) || `${creator.name} 的直播`,
            announcement: truncate(tidyText(data.announcement), 40),
            viewers,
            hostLines: norm(data.hostLines, 60),
            danmaku: norm(data.danmaku, 30),
            userDanmaku: [],
            generatedAt: Date.now(),
        };
        const stored = await dbx.saveLive(state._app, state.identity.profileKey, live);
        state.activeLive = stored || live;
        await dbx.pruneLives(state._app, state.identity.profileKey, creator.creatorId);
        return true;
    } catch (err) {
        console.error('[youtube] 生成直播失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.live = false;
    }
}

/** 用户发弹幕：立即落盘 + 组件立刻显示。不调 AI。 */
export async function sendDanmaku(text, atMs) {
    const live = state.activeLive;
    const body = String(text || '').trim();
    if (!live || !body) return null;
    const item = {
        // ★ floor 不是 round：组件已经把这条立刻上屏了，atSec 必须落在
        //   播放头**之前**，否则调度器下一拍又把它捞出来飘第二遍
        atSec: Math.max(0, Math.floor((Number(atMs) || 0) / 1000)),
        name: state.profile?.channel?.nickname || state.identity.userName,
        text: truncate(body, 30),
        mine: true,
        sentAt: Date.now(),
    };
    live.userDanmaku = [...asArray(live.userDanmaku), item];
    await dbx.saveLive(state._app, state.identity.profileKey, live);
    return item;
}

export function closeLive() {
    state.activeLive = null;
    state.offlineRoom = null;
    popView();
}

// ---------------------------------------------------------------------------
// 站内闲聊（不可编辑 / 删除 / 重 roll）
// ---------------------------------------------------------------------------

export function canChatWith(creator) {
    return Boolean(creator && creator.kind !== PERSON_KIND.ai && creator.profileGenerated);
}

export async function openChat(peerId) {
    const peer = getCreatorById(peerId);
    if (!canChatWith(peer)) {
        showToast('先看过 TA 的主页才能发起闲聊');
        return false;
    }
    state.chatPeerId = peer.creatorId;
    state.chatMessages = await dbx.listChatMessages(state._app, state.identity.profileKey, peer.creatorId);
    pushView('chat');
    return true;
}

export function closeChat() {
    state.chatPeerId = '';
    state.chatMessages = [];
    popView();
}

export function chatPeer() {
    return getCreatorById(state.chatPeerId);
}

function nextChatSeq() {
    return state.chatMessages.reduce((m, x) => Math.max(m, x.seq || 0), 0) + 1;
}

/** 发消息：用户消息落盘后**自动**让对方回一条（这就是一次点击一次生成） */
export async function sendChatMessage(text) {
    const peer = chatPeer();
    const body = String(text || '').trim();
    if (!peer || !body || state.loading.chat) return false;

    const mine = await dbx.saveChatMessage(state._app, state.identity.profileKey, {
        peerId: peer.creatorId,
        role: 'user',
        text: body,
        seq: nextChatSeq(),
    });
    if (mine) state.chatMessages = [...state.chatMessages, mine];

    state.loading.chat = true;
    state.error = '';
    await ensurePromptsLoaded();
    try {
        const ctx = generationContext();
        const metVia = firstMetHint(peer);
        const { text: prompt } = buildChatReplyPrompt({
            ...ctx,
            peer,
            metVia,
            messages: state.chatMessages,
            userName: state.profile?.channel?.nickname || state.identity.userName,
            userDesc: world.describeUser(state.identity.user),
        });
        const res = await ai.generateJson({ system: prompt, temperature: 0.95 });
        if (!res.ok) { state.error = res.error; return false; }
        const reply = tidyText(res.data?.text);
        if (!reply) { state.error = '对方这次没说出话来，再发一条试试'; return false; }
        const stored = await dbx.saveChatMessage(state._app, state.identity.profileKey, {
            peerId: peer.creatorId,
            role: 'peer',
            text: reply,
            seq: nextChatSeq(),
        });
        if (stored) state.chatMessages = [...state.chatMessages, stored];
        await rebuildChatSessions();
        return true;
    } catch (err) {
        console.error('[youtube] 闲聊回复失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.chat = false;
    }
}

/** 和 TA 是怎么认识的（进 prompt + 加好友时写进相识缘由） */
function firstMetHint(peer) {
    if (!peer) return '';
    if (peer.kind === PERSON_KIND.viewer) return '在视频评论区看到 TA 的评论，点进主页认识的';
    const seen = [...state.videos, ...state.feed].find((v) => sameId(v.creatorId, peer.creatorId));
    return seen ? `因为 TA 的视频《${seen.title}》认识的` : '在萤火刷到 TA 的频道认识的';
}

export async function rebuildChatSessions() {
    const all = await dbx.listAllChatMessages(state._app, state.identity.profileKey);
    const byPeer = new Map();
    for (const msg of all) {
        byPeer.set(String(msg.peerId), msg);   // 已按 seq 升序，留下的是最后一条
    }
    state.chatSessions = [...byPeer.entries()].map(([peerId, last]) => ({
        peerId,
        lastText: last.text,
        lastAt: last.createdAt || 0,
        count: all.filter((m) => String(m.peerId) === peerId).length,
    })).sort((a, b) => b.lastAt - a.lastAt);
}

/** 聊得投缘 → 注册进 nook 角色库（幂等），自动绑当前世界，简介带相识缘由 */
export async function addFriend(peerId) {
    const peer = getCreatorById(peerId);
    if (!peer || state.loading.friend) return { ok: false, error: '找不到这个人' };
    if (peer.nookPersonId) return { ok: true, personId: peer.nookPersonId, duplicated: true };
    state.loading.friend = peer.creatorId;

    try {
        const chatCount = state.chatMessages.filter((m) => sameId(m.peerId, peer.creatorId)).length
            || state.chatSessions.find((s) => sameId(s.peerId, peer.creatorId))?.count || 0;
        const encounter = `${firstMetHint(peer)}，在站内聊了 ${chatCount} 条消息后互加了好友`;
        const info = avatarInfo(peer);
        const result = await registerEncounteredCharacter({
            name: peer.name,
            bio: peer.bio || '',
            avatar: info.src || '',
            externalId: peer.creatorId,
        }, {
            sourceApp: 'youtube',
            encounter,
        });
        if (!result.ok) {
            state.error = result.error || '注册失败';
            return result;
        }
        peer.nookPersonId = String(result.person?.id || '');
        await persistCreator(peer);
        showToast(result.created ? `${peer.name} 已加入角色库` : '角色库里已经有 TA 了，直接复用');
        return { ok: true, personId: peer.nookPersonId, created: result.created };
    } catch (err) {
        console.error('[youtube] 加好友失败', err);
        state.error = err?.message || String(err);
        return { ok: false, error: state.error };
    } finally {
        state.loading.friend = '';
    }
}

// ---------------------------------------------------------------------------
// 我的频道：发布 / 编辑 / 删除 / 评论
// ---------------------------------------------------------------------------

export function userChannel() {
    const c = state.profile?.channel || {};
    return {
        nickname: c.nickname || state.identity.userName,
        followers: Math.max(0, Number(c.followers) || 0),
        bio: c.bio || '',
    };
}

export async function updateChannel(patch = {}) {
    if (!state.profile) return;
    state.profile.channel = {
        ...(state.profile.channel || {}),
        ...(typeof patch.nickname === 'string' ? { nickname: patch.nickname.trim().slice(0, 20) } : {}),
        ...(patch.followers !== undefined ? { followers: clamp(patch.followers, 0, 999999999) } : {}),
        ...(typeof patch.bio === 'string' ? { bio: patch.bio.trim().slice(0, 100) } : {}),
    };
    persistProfile();
    showToast('频道资料已更新');
}

/** 发布一条自己的视频（数据全由 JS 按粉丝数算，不调 AI） */
export async function publishUpload(form = {}) {
    const title = String(form.title || '').trim();
    if (!title) return null;
    const id = uid('up');
    const stats = computeUploadStats(userChannel().followers, id);
    const upload = {
        id,
        ownerType: 'user',
        ownerId: state.identity.userId,
        ownerName: userChannel().nickname,
        title: truncate(title, 40),
        coverText: truncate(String(form.coverText || title).trim(), 10),
        coverHue: coverHue(id, COVER_HUES),
        kind: truncate(String(form.kind || '').trim(), 6),
        blurb: truncate(String(form.blurb || '').trim(), 60),
        intro: tidyText(form.intro).slice(0, 400),
        sections: [],
        tags: asArray(form.tags).filter(Boolean).slice(0, 3),
        durationSec: clamp(form.durationSec, 10, 7200) || (120 + (hashString(id) % 500)),
        durationLabel: '',
        stats,
        generatedComments: 0,
        favorited: false,
        publishedAt: Date.now(),
    };
    upload.durationLabel = fmtDuration(upload.durationSec, id);
    const stored = await dbx.saveUpload(state._app, state.identity.profileKey, upload);
    if (stored) state.uploads = [stored, ...state.uploads];
    showToast('视频已发布');
    return stored;
}

export async function updateUpload(uploadId, patch = {}) {
    const row = state.uploads.find((u) => sameId(u.id, uploadId));
    if (!row) return false;
    if (typeof patch.title === 'string' && patch.title.trim()) row.title = truncate(patch.title.trim(), 40);
    if (typeof patch.coverText === 'string') row.coverText = truncate(patch.coverText.trim() || row.title, 10);
    if (typeof patch.blurb === 'string') row.blurb = truncate(patch.blurb.trim(), 60);
    if (typeof patch.intro === 'string') row.intro = tidyText(patch.intro).slice(0, 400);
    if (typeof patch.kind === 'string') row.kind = truncate(patch.kind.trim(), 6);
    if (Array.isArray(patch.sections)) {
        row.sections = patch.sections
            .map((s) => ({ at: String(s?.at || '').slice(0, 8), text: tidyText(s?.text) }))
            .filter((s) => s.text).slice(0, 8);
    }
    row.editedAt = Date.now();
    await dbx.saveUpload(state._app, state.identity.profileKey, row);
    if (sameId(state.activeVideo?.id, uploadId)) state.activeVideo = row;
    showToast('已保存');
    return true;
}

/** 删除作品（二次确认由 UI 层做）。相关评论一起清，murmur 卡片那头会优雅失效。 */
export async function deleteUpload(uploadId) {
    const row = state.uploads.find((u) => sameId(u.id, uploadId));
    if (!row) return false;
    await dbx.removeCommentsByVideo(state._app, row.id);
    await dbx.removeUpload(state._app, row.id);
    state.uploads = state.uploads.filter((u) => !sameId(u.id, row.id));
    if (sameId(state.activeVideo?.id, uploadId)) closeVideo();
    showToast('已删除');
    return true;
}

/** 给自己的视频生成一批观众评论（总数 JS 已定，正文按批出，每批 5 条） */
export async function generateUserComments() {
    const upload = state.activeVideo;
    if (!upload || state.activeVideoKind !== 'upload' || state.loading.userComments) return false;
    const remain = remainingComments(upload.stats?.comments, upload.generatedComments || 0);
    if (remain <= 0) { showToast('评论都到齐了'); return false; }
    state.loading.userComments = upload.id;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const ctx = generationContext();
        const influenceParts = await collectInfluences('comments');
        const count = Math.min(COMMENT_PAGE, remain);
        const existing = state.comments.map((c) => ({ authorName: c.authorName, text: c.text }));
        const { text } = buildUserCommentsPrompt({
            ...ctx, influenceParts,
            upload,
            channel: userChannel(),
            stats: upload.stats || {},
            existing,
            count,
        });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) { state.error = res.error; return false; }

        let seq = state.comments.reduce((m, c) => Math.max(m, c.seq || 0), 0);
        let added = 0;
        for (const row of asArray(res.data?.comments).slice(0, count)) {
            if (!row?.text) continue;
            const person = await ensureCreator(String(row.authorName || '路人'), PERSON_KIND.viewer);
            seq += 1;
            added += 1;
            const stored = await dbx.saveComment(state._app, state.identity.profileKey, {
                videoId: upload.id,
                authorId: person.creatorId,
                authorName: person.name,
                text: tidyText(row.text),
                likes: Math.max(0, Number(row.likes) || 0),
                seq,
            });
            if (stored) state.comments = [...state.comments, stored];
        }
        upload.generatedComments = (upload.generatedComments || 0) + added;
        await dbx.saveUpload(state._app, state.identity.profileKey, upload);
        return added > 0;
    } catch (err) {
        console.error('[youtube] 生成观众评论失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.userComments = '';
    }
}

// ---------------------------------------------------------------------------
// 世界 AI 的作品
// ---------------------------------------------------------------------------

export function listAiUploads(aiCreatorId) {
    return state.uploads.filter((u) => u.ownerType === 'ai' && sameId(u.ownerCreatorId, aiCreatorId));
}

/** 「让 TA 发视频」/ 带意见重 roll（rerollOf 传已有 upload id 时替换内容） */
export async function generateAiVideo(aiCreatorId, { opinion = '', rerollOf = '' } = {}) {
    const creator = getCreatorById(aiCreatorId);
    if (!creator || creator.kind !== PERSON_KIND.ai || state.loading.aiVideo) return false;
    state.loading.aiVideo = creator.creatorId;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const ctx = generationContext();
        const influenceParts = await collectInfluences('ai-video');
        const previousTitles = listAiUploads(creator.creatorId)
            .filter((u) => !sameId(u.id, rerollOf))
            .map((u) => u.title);
        const { text } = buildAiVideoPrompt({
            ...ctx, influenceParts,
            ai: { name: creator.name, desc: world.describeAi(creator.aiPersonId) },
            previousTitles,
            opinion,
        });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) { state.error = res.error; return false; }

        const data = res.data || {};
        const title = truncate(tidyText(data.title), 40);
        if (!title) { state.error = 'AI 没给出标题，再试一次'; return false; }

        let row = rerollOf ? state.uploads.find((u) => sameId(u.id, rerollOf)) : null;
        if (!row) {
            const id = uid('up');
            row = {
                id,
                ownerType: 'ai',
                ownerId: creator.aiPersonId,
                ownerCreatorId: creator.creatorId,
                ownerName: creator.name,
                coverHue: coverHue(id, COVER_HUES),
                stats: computeUploadStats(creator.followers, id),
                generatedComments: 0,
                favorited: false,
                publishedAt: Date.now(),
            };
        }
        row.title = title;
        row.coverText = truncate(tidyText(data.coverText) || title, 10);
        row.kind = truncate(tidyText(data.kind), 6);
        row.blurb = truncate(tidyText(data.blurb), 60);
        row.intro = tidyText(data.intro).slice(0, 400);
        row.sections = asArray(data.sections).map((s) => ({
            at: String(s?.at || '').trim().slice(0, 8),
            text: tidyText(s?.text),
        })).filter((s) => s.text).slice(0, 8);
        row.tags = asArray(data.tags).map((t) => String(t || '').trim()).filter(Boolean).slice(0, 3);
        row.durationSec = clamp(data.durationSec, 30, 7200) || row.durationSec || 300;
        row.durationLabel = fmtDuration(row.durationSec, row.id);
        if (rerollOf) row.rerolledAt = Date.now();

        const stored = await dbx.saveUpload(state._app, state.identity.profileKey, row);
        if (stored) {
            const i = state.uploads.findIndex((u) => sameId(u.id, row.id));
            if (i >= 0) state.uploads.splice(i, 1, stored);
            else state.uploads = [stored, ...state.uploads];
            if (sameId(state.activeVideo?.id, row.id)) state.activeVideo = stored;
        }

        // 写进 AI 的经历（幂等）：murmur 聊天里 TA 会记得自己发过这条
        if (creator.aiPersonId && !rerollOf) {
            await world.appendAiExperience(
                creator.aiPersonId,
                `【萤火】在视频软件萤火上发布过视频《${title}》：${row.blurb || row.intro?.slice(0, 40) || ''}`,
            );
        }
        return true;
    } catch (err) {
        console.error('[youtube] AI 发视频失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.aiVideo = '';
    }
}

// ---------------------------------------------------------------------------
// 私信
// ---------------------------------------------------------------------------

export async function generateDms() {
    if (state.loading.dms) return false;
    state.loading.dms = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const ctx = generationContext();
        // 私信是 provider 的主消费点：演员 / 爱豆 / 电竞的近况会改变私信风向
        const influenceParts = await collectInfluences('dm');
        const count = DM_BATCH.min + Math.floor(Math.random() * (DM_BATCH.max - DM_BATCH.min + 1));
        const uploadsBrief = state.uploads
            .filter((u) => u.ownerType === 'user')
            .slice(0, 5)
            .map((u) => `《${u.title}》`);
        const { text } = buildDmPrompt({
            ...ctx, influenceParts,
            channel: userChannel(),
            uploadsBrief,
            count,
        });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) { state.error = res.error; return false; }

        const batch = Date.now();
        for (const row of asArray(res.data?.dms).slice(0, DM_BATCH.max)) {
            if (!row?.text) continue;
            const stored = await dbx.saveDm(state._app, state.identity.profileKey, {
                fromName: truncate(String(row.fromName || '未知发件人').trim(), 12),
                fromKind: truncate(String(row.fromKind || '').trim(), 8),
                text: tidyText(row.text),
                tone: truncate(String(row.tone || '').trim(), 8),
                batch,
            });
            if (stored) state.dms = [stored, ...state.dms];
        }
        return true;
    } catch (err) {
        console.error('[youtube] 生成私信失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.dms = false;
    }
}

export async function deleteDm(dmId) {
    await dbx.removeDm(state._app, dmId);
    state.dms = state.dms.filter((d) => !sameId(d.id, dmId));
}

// ---------------------------------------------------------------------------
// contentCards 深链（murmur 卡片确认后进来）
// ---------------------------------------------------------------------------

export async function openVideoById(videoId, cardSnapshot = null) {
    const id = String(videoId || '');
    if (!id) return { ok: false, error: '卡片里没有视频 id' };

    // 1) 作品（用户 / AI）
    const upload = state.uploads.find((u) => sameId(u.id, id));
    if (upload) {
        await openUpload(upload);
        return { ok: true };
    }
    // 2) 已入表的外部视频 / feed 里的
    const known = state.videos.find((v) => sameId(v.id, id))
        || state.feed.find((v) => sameId(v.id, id));
    if (known) {
        await openVideo(known);
        if (!known.detail) return { ok: false, error: state.error || '详情生成失败，稍后再试' };
        return { ok: true };
    }
    // 3) 卡片快照重建（AI 发来的视频卡 / 内容已被刷新掉）
    if (cardSnapshot?.title) {
        const creator = await ensureCreator(String(cardSnapshot.creatorName || '神秘频道'), PERSON_KIND.creator);
        const stub = {
            id,
            title: truncate(String(cardSnapshot.title), 40),
            coverText: truncate(String(cardSnapshot.coverText || cardSnapshot.title), 10),
            coverHue: Number(cardSnapshot.coverHue) || coverHue(id, COVER_HUES),
            creatorId: creator.creatorId,
            creatorName: creator.name,
            kind: truncate(String(cardSnapshot.kind || ''), 6),
            blurb: truncate(String(cardSnapshot.blurb || ''), 60),
            tags: [],
            durationSec: Number(cardSnapshot.durationSec) || 0,
            durationLabel: fmtDuration(cardSnapshot.durationSec, id),
            views: Number(cardSnapshot.views) || 0,
            publishedLabel: publishedLabel(id),
            favorited: false,
            source: 'chat-card',
            createdAt: Date.now(),
        };
        await openVideo(stub);
        if (!stub.detail && !state.videos.find((v) => sameId(v.id, id))?.detail) {
            return { ok: false, error: state.error || '详情生成失败，稍后再试' };
        }
        return { ok: true };
    }
    return { ok: false, error: '内容已删除或不在当前档案里' };
}

/** 深链目标：hydrate 还没跑完时先记下，跑完再开 */
export function queuePendingVideo(videoId) {
    state._pendingVideoId = String(videoId || '');
}

// ---------------------------------------------------------------------------
// 主题
// ---------------------------------------------------------------------------

let _themeApplier = null;

export function registerThemeApplier(fn) {
    _themeApplier = fn;
    applyTheme();
}

export function applyTheme() {
    if (typeof _themeApplier === 'function') {
        _themeApplier(state.profile?.themeId || 'paper', state.profile?.customColors || {});
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
        baseThemeId: String(baseThemeId || 'paper'),
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
// UI 杂项
// ---------------------------------------------------------------------------

export function setTab(id) {
    if (!TABS.some((t) => t.id === id)) return;
    state.tab = id;
    state.view = '';
    state._viewStack = [];
    state.error = '';
    state.activeVideo = null;
    state.activeCreatorId = '';
    state.activeLive = null;
    state.offlineRoom = null;
    state.comments = [];
    if (id === 'inbox') void rebuildChatSessions();
}

export function setView(view) {
    state.view = view || '';
}

export function setInboxSeg(seg) {
    state.inboxSeg = seg === 'dms' ? 'dms' : 'chats';
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
