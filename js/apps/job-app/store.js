/**
 * 灯塔 · 状态单例
 *
 * 一份 `Vue.reactive`，所有组件读它、通过这里的 mutator 改它。
 *
 * ── 后台生成不需要队列 ────────────────────────────────────────────
 *
 * 生成任务**只往 store 写，不碰 DOM**。用户点了「生成」然后切出去，
 * 组件卸载了照样在写；切回来 Vue 按当前 state 重画，内容就在那儿。
 *
 * ── 档案切换 ──────────────────────────────────────────────────────
 *
 * `hydrate()` 每次都现算档案键，和上次不一样就整个换一份数据。
 * 不依赖任何「用户切换了」的事件 —— 只挂一个事件的实现等于挂在运气上。
 *
 * ── 钱在哪儿 ──────────────────────────────────────────────────────
 *
 * 这个文件不算钱也不存钱，只调 `payroll-service`。那边是唯一往
 * `sdk.assetFlow` 写的地方，所以「工资到底怎么算的」永远只有一处答案。
 */

import {
    FEED_SIZE, MAX_JOBS, TABS, TALK_STATUS,
    LAST_PROFILE_KEY, THEATER_PER_DAY,
} from './constants.js';
import {
    asArray, money, sameId, uid, tidyText, todayKey, dayKey, fmtDay,
} from './utils.js';
import * as dbx from './services/db.js';
import * as world from './services/world-context.js';
import * as ai from './services/ai-service.js';
import * as payroll from './services/payroll-service.js';
import * as sched from './services/schedule-service.js';
import {
    resolveCards, PROMPT_CARDS,
} from './services/prompt-cards.js';
import { installJobContext } from './services/job-context.js';
import {
    buildFeedPrompt, buildDetailPrompt, buildRecruiterPrompt, buildTalkPrompt,
    buildTheaterPrompt, buildDigestPrompt, defaultTheaterPrompt,
} from './services/prompt-builder.js';

const Vue = typeof window !== 'undefined' ? window.Vue : null;
const reactive = (o) => (Vue?.reactive ? Vue.reactive(o) : o);

const now = new Date();

const state = reactive({
    /** hydrate 跑完了吗。false 时整个 App 显示骨架，不显示「空」。 */
    ready: false,
    /** SDK 没就绪 / 用户没世界观时的拦截文案 */
    blocked: '',

    identity: {
        user: null, world: null,
        userName: '我', worldName: '', currency: '金币',
        profileKey: '', occupation: '', ready: false,
    },
    profile: null,

    /** 首配门闸。true 时只画引导页。 */
    needsConfig: false,

    tab: 'market',
    /** '' | 'detail' | 'talk' | 'post' | 'theater' | 'prompts' | 'theme' | 'flow' | 'saved' | 'about' */
    view: '',

    /** 当前这批职位（刷新即换掉，没收藏的就此消失） */
    feed: [],
    feedCategory: '全部',

    saved: [],        // 收藏的职位
    posts: [],        // 已入职，最多 MAX_JOBS 份
    recruiters: [],   // HR + 面试对话
    theaters: [],     // 每日小剧场

    /** 打开的东西。都存 id 而不是对象引用 —— 列表刷新后引用会指向被丢弃的旧对象 */
    detailJob: null,
    talkId: '',
    postId: '',
    theaterId: '',

    balance: 0,
    /** 这个月从工作里挣到的（只统计本 App 产生的流水） */
    monthIncome: 0,

    /** 工作详情页的日历停在哪个月 */
    calendar: { year: now.getFullYear(), month: now.getMonth() + 1 },

    loading: {
        feed: false, detail: false, recruiter: false, reply: false,
        theater: false, digest: false,
    },
    error: '',
    toast: '',

    /** 引导页的临时状态，配完就没用了，不落盘 */
    onboarding: {
        step: 0,
        clips: [], prompts: [],
        clipIds: [], promptIds: [],
        aim: '',
        loading: false,
    },

    /** 弹层 { type, payload }。自绘，不用 AcModal。 */
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

function persistPost(post) {
    if (!post) return Promise.resolve(null);
    return dbx.savePost(state._app, state.identity.profileKey, post);
}

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------

/**
 * 读取当前身份 + 对应的那一档数据，然后**补发欠的工资**。
 *
 * ★ 只用 `_hydrating` 防并发，**不用** `_hydrated` 硬阻断 ——
 *   硬阻断会让首次失败之后永远没有第二次机会。
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

        const [saved, posts, recruiters, theaters, feed] = await Promise.all([
            dbx.listItems(state._app, key),
            dbx.listPosts(state._app, key),
            dbx.listRecruiters(state._app, key),
            dbx.listTheaters(state._app, key),
            dbx.loadFeed(state._app, key),
        ]);
        // 清掉旧版本自动塞入的演员 / 爱豆 / 电竞候选入口。既有在职记录不删，
        // 避免破坏用户已经发生的剧情；只是不能再从这些旧候选发起新面试。
        const isLegacySpecial = (item) => item?.source === 'special'
            || ['actor', 'idol', 'esports'].includes(item?.track);
        state.saved = saved.filter((item) => !isLegacySpecial(item));
        state.posts = posts;
        state.recruiters = recruiters.filter((item) => !isLegacySpecial(item?.job || item));
        state.theaters = theaters;
        state.feed = asArray(feed?.list).filter((item) => !isLegacySpecial(item));

        await settleAll();
        publishContext();
        state.ready = true;
    } catch (err) {
        console.error('[job] hydrate 失败', err);
        state.error = '读取数据失败：' + (err?.message || err);
        state.ready = true;
    } finally {
        state._hydrating = false;
    }
}

/**
 * 身份可能变了，重新对一次。每次 App 被打开都调。
 * 档案键没变就什么都不做（很便宜）；变了就整个换一份。
 */
export async function recheckIdentity() {
    const next = world.getProfileKey();
    if (next && next === state.identity.profileKey && state.profile) {
        // 键没变也要再结一次 —— 用户可能昨天开过，今天又开
        await settleAll();
        publishContext();
        return;
    }
    resetForProfileSwitch();
    await hydrate(state._app);
}

/**
 * 切档时的重置。
 *
 * ★ 写完这个函数要**对着 state 的初始字段列表逐个核一遍**。
 *   四叶草那轮漏的是 `onboarding.step`，表现是「换了世界观确实回到引导页，
 *   但停在上次填到的那一屏」—— 用户既看不到新世界观的名字，
 *   也不知道自己为什么被弹回来。临时 UI 状态最容易漏，因为它不像数据。
 */
function resetForProfileSwitch() {
    state.ready = false;
    state.profile = null;
    state.onboarding.step = 0;
    state.onboarding.clipIds = [];
    state.onboarding.promptIds = [];
    state.onboarding.aim = '';
    state.feed = [];
    state.feedCategory = '全部';
    state.saved = [];
    state.posts = [];
    state.recruiters = [];
    state.theaters = [];
    state.detailJob = null;
    state.talkId = '';
    state.postId = '';
    state.theaterId = '';
    state.balance = 0;
    state.monthIncome = 0;
    state.calendar = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
    state.view = '';
    state.tab = 'market';
    state.modal = null;
    state.error = '';
}

// ---------------------------------------------------------------------------
// 结算 —— 这个 App 的核心
// ---------------------------------------------------------------------------

/**
 * 把所有欠的钱补上，然后刷新余额。
 *
 * 这就是需求里那句「如果这一天用户打开网页，js 就会动态计算这件事」。
 * 触发点是**每次 App 打开**（hydrate + recheckIdentity），不是定时器 ——
 * 定时器只在页面开着时走，而用户多半是隔几天来一次。
 */
export async function settleAll() {
    const u = state.identity.user;
    if (!u?.id) return;

    await payroll.settleIncome(u.id);

    let total = 0;
    let times = 0;
    for (const post of state.posts) {
        const res = await payroll.settleMonthly(u.id, post);
        if (res.times > 0) {
            total += res.paid;
            times += res.times;
            // 游标被 settleMonthly 改在了 post.pay 上，必须落盘，
            // 否则下次打开又会重发一遍（SDK 的 24h 去重挡得住今天，挡不住后天）
            await persistPost(post);
        }
    }

    refreshBalance();

    if (times > 0) {
        const text = payroll.describeSettle({ paid: total, times }, state.identity.currency);
        showToast(text);
        notifyIsland('工资到账', text);
    }
}

export function refreshBalance() {
    const u = state.identity.user;
    if (!u?.id) return;
    state.balance = payroll.getBalance(u.id);
    state.monthIncome = sumMonthIncome(u.id);
}

/** 这个月本 App 带来的进账 */
function sumMonthIncome(entityId) {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const from = start.getTime();
    return money(payroll.listJobFlow(entityId, 200)
        .filter((e) => e.direction === 'in' && (e.timestamp || 0) >= from)
        .reduce((sum, e) => sum + money(e.amount), 0));
}

/** 钱包流水（本 App 的） */
export function jobFlow(limit = 60) {
    const u = state.identity.user;
    return u?.id ? payroll.listJobFlow(u.id, limit) : [];
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
            state.onboarding.aim = state.profile.aim || '';
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

export function setAim(text) {
    state.onboarding.aim = String(text || '');
}

/** 配完了 → 落盘 → 立刻拉一批职位 */
export async function finishOnboarding() {
    const key = state.identity.profileKey;
    if (!key) return false;

    const profile = state.profile || dbx.makeProfile(key);
    profile.id = key;
    profile.configured = true;
    profile.clipIds = [...state.onboarding.clipIds];
    profile.promptIds = [...state.onboarding.promptIds];
    profile.aim = state.onboarding.aim;
    state.profile = profile;

    await dbx.saveProfile(state._app, profile);
    state.needsConfig = false;
    applyTheme();
    refreshBalance();
    publishContext();

    return generateFeed();
}

/** 用户主动重新配置 */
export async function reopenOnboarding() {
    state.needsConfig = true;
    state.onboarding.step = 0;
    await prepareOnboarding();
}

// ---------------------------------------------------------------------------
// 生成上下文
// ---------------------------------------------------------------------------

/** 当前生效的提示词卡（管理页和生成走的是同一份） */
export function promptCards() {
    return resolveCards(state.profile?.promptOverrides || {}, state.profile?.promptOrder || []);
}

/** 拼 prompt 时要用的那一份上下文 */
function generationContext() {
    const p = state.profile;
    const clips = world.listClips(state.identity.world)
        .filter((c) => asArray(p?.clipIds).includes(c.id));
    const promptIds = asArray(p?.promptIds);
    const prompts = asArray(state.onboarding.prompts).filter((x) => promptIds.includes(x.id));
    return {
        identity: state.identity,
        summary: world.readSummary(state.identity.world),
        userDesc: world.describeUser(state.identity.user),
        clips,
        prompts,
        aim: p?.aim || '',
        cards: promptCards(),
    };
}

/**
 * 提示词管理页的预览用它。
 *
 * ★ 和真正生成走的是**同一个** `generationContext()`，不是另拼一份。
 *   分成两份的话，预览里看到的世界观 / 夹子 / 附加提示词迟早和实际发出去的
 *   对不上，而且不会有任何报错。
 */
export function previewContext() {
    return generationContext();
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
// 职位列表
// ---------------------------------------------------------------------------

/**
 * 生成一批职位。
 *
 * 刷新 = 整批换掉。没收藏的那些**就此消失**，不进数据库 ——
 * 这是「减少数据库压力」的做法。收藏过的在 saved 里，不受影响。
 * 职位只能来自当前世界观，不再额外钉入演员 / 爱豆 / 电竞保送入口。
 */
export async function generateFeed() {
    if (state.loading.feed) return false;
    state.loading.feed = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const ctx = generationContext();
        const exclude = [
            ...state.feed.map((j) => j.title),
            ...state.saved.map((j) => j.title),
        ].filter(Boolean);

        const { text } = buildFeedPrompt({
            ...ctx,
            category: state.feedCategory,
            exclude,
            size: FEED_SIZE,
        });

        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) {
            state.error = res.error;
            return false;
        }

        const rows = asArray(res.data?.items).filter((x) => x && x.title);
        if (!rows.length) {
            state.error = 'AI 这次一个职位都没给出来，再试一次';
            return false;
        }

        state.feed = rows.map(normalizeJob);
        await dbx.saveFeed(state._app, state.identity.profileKey, state.feed);
        return true;
    } catch (err) {
        console.error('[job] 生成职位失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.feed = false;
    }
}

function normalizeJob(row, extra = {}) {
    const payMode = ['monthly', 'daily', 'tip'].includes(row.payMode) ? row.payMode : 'monthly';
    return {
        id: uid('jb'),
        title: String(row.title || '').trim(),
        employer: String(row.employer || '').trim(),
        category: String(row.category || '其他').trim(),
        jobType: ['fulltime', 'parttime', 'gig', 'contract'].includes(row.jobType)
            ? row.jobType : 'fulltime',
        payMode,
        payText: String(row.payText || '').trim(),
        payAmount: money(row.payAmount),
        blurb: String(row.blurb || '').trim(),
        ask: String(row.ask || '').trim(),
        area: String(row.area || '').trim(),
        tags: asArray(row.tags).map((t) => String(t || '').trim()).filter(Boolean).slice(0, 3),
        track: '',
        detail: null,
        favorited: false,
        source: 'ai',
        createdAt: Date.now(),
        ...extra,
    };
}

export function setFeedCategory(category) {
    state.feedCategory = category;
}

/** 列表按分类过滤。 */
export function visibleFeed() {
    const cat = state.feedCategory;
    if (!cat || cat === '全部') return state.feed;
    return state.feed.filter((j) => j.category === cat);
}

// ---------------------------------------------------------------------------
// 职位详情
// ---------------------------------------------------------------------------

export async function openJob(job) {
    if (!job) return;
    state.detailJob = job;
    state.view = 'detail';
    if (job.detail) return;
    await generateDetail(job);
}

export async function generateDetail(job, { force = false } = {}) {
    if (!job) return false;
    if (job.detail && !force) return true;
    state.loading.detail = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const { text } = buildDetailPrompt({ ...generationContext(), job });
        const res = await ai.generateJson({ system: text, temperature: 0.9 });
        if (!res.ok) {
            state.error = res.error;
            return false;
        }
        job.detail = normalizeDetail(res.data);
        // 收藏过的才单独落盘 —— 没收藏的详情跟着列表一起，刷新就没了
        if (job.favorited) await dbx.saveItem(state._app, state.identity.profileKey, job);
        else await dbx.saveFeed(state._app, state.identity.profileKey, state.feed);
        return true;
    } catch (err) {
        console.error('[job] 生成职位详情失败', err);
        state.error = err?.message || String(err);
        return false;
    } finally {
        state.loading.detail = false;
    }
}

function normalizeDetail(data) {
    const strList = (v, n, max = 24) => asArray(v)
        .map((x) => String(x || '').trim()).filter(Boolean).slice(0, n)
        .map((x) => (x.length > max ? x.slice(0, max) : x));
    return {
        desc: tidyText(data?.desc),
        duties: strList(data?.duties, 6),
        requires: strList(data?.requires, 5),
        perks: strList(data?.perks, 5, 18),
        employerInfo: tidyText(data?.employerInfo),
        workTime: String(data?.workTime || '').trim(),
        process: strList(data?.process, 5, 14),
        voices: asArray(data?.voices).slice(0, 4).map((v) => ({
            who: String(v?.who || '某人').trim(),
            role: String(v?.role || '').trim(),
            text: String(v?.text || '').trim(),
        })).filter((v) => v.text),
        generatedAt: Date.now(),
    };
}

export function closeJob() {
    state.detailJob = null;
    state.view = '';
}

export async function rerollDetail() {
    if (state.detailJob) await generateDetail(state.detailJob, { force: true });
}

// ---------------------------------------------------------------------------
// 收藏
// ---------------------------------------------------------------------------

/**
 * 收藏 / 取消收藏。
 *
 * 收藏 = 把这一条从「会被刷新冲掉的列表」搬进 items 表。
 * 取消收藏时它还留在当前列表里（用户可能只是点错了），下次刷新才真的消失。
 */
export async function toggleSave(job) {
    if (!job) return;
    const key = state.identity.profileKey;
    if (job.favorited) {
        job.favorited = false;
        const hit = state.saved.find((f) => sameId(f.id, job.id));
        if (hit) {
            await dbx.removeItem(state._app, hit.id);
            state.saved = state.saved.filter((f) => !sameId(f.id, hit.id));
        }
        showToast('已取消收藏');
        return;
    }
    job.favorited = true;
    const saved = await dbx.saveItem(state._app, key, job);
    if (saved) state.saved = [saved, ...state.saved.filter((f) => !sameId(f.id, saved.id))];
    showToast('收藏了，刷新带不走它');
}

// ---------------------------------------------------------------------------
// 面试
// ---------------------------------------------------------------------------

export function currentTalk() {
    return state.recruiters.find((r) => sameId(r.id, state.talkId)) || null;
}

/**
 * 开始一场面试。
 *
 * ★ HR 人设**这时候才生成** —— 用户明确要求「进入求职详情页看完以后、
 *   确认跟 hr 聊天的时候才生成」。放在列表或详情阶段生成的话，
 *   用户随手翻十个职位就造了十个人设，全是浪费。
 *
 * 同一个职位已经聊过就直接打开那一场，不重新造人 ——
 * 重新造的表现是「上次那个 HR 不见了，换了个人接着聊」。
 */
export async function startTalk(job) {
    if (!job) return null;
    const existing = state.recruiters.find(
        (r) => sameId(r.jobId, job.id) && r.status === TALK_STATUS.open,
    );
    if (existing) {
        state.talkId = existing.id;
        state.view = 'talk';
        return existing;
    }

    state.loading.recruiter = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const { text } = buildRecruiterPrompt({ ...generationContext(), job });
        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) {
            state.error = res.error;
            return null;
        }

        const d = res.data || {};
        const opening = tidyText(d.opening) || '你好，看到你投过来了。先说说你会什么吧。';
        const hr = {
            id: uid('hr'),
            jobId: job.id,
            track: job.track || '',
            job: snapshotJob(job),
            name: String(d.name || '招人的').trim(),
            title: String(d.title || (spec ? spec.recruiterRole : '招人的')).trim(),
            age: String(d.age || '').trim(),
            look: String(d.look || '').trim(),
            persona: tidyText(d.persona),
            tone: String(d.tone || '').trim(),
            care: String(d.care || '').trim(),
            dislike: String(d.dislike || '').trim(),
            opening,
            messages: [{ id: uid('m'), role: 'hr', text: opening, ts: Date.now() }],
            status: TALK_STATUS.open,
            reason: '',
            postId: '',
            createdAt: Date.now(),
        };

        const saved = await dbx.saveRecruiter(state._app, state.identity.profileKey, hr);
        if (saved) {
            state.recruiters = [saved, ...state.recruiters];
            state.talkId = saved.id;
            state.view = 'talk';
            return saved;
        }
        return null;
    } catch (err) {
        console.error('[job] 生成 HR 人设失败', err);
        state.error = err?.message || String(err);
        return null;
    } finally {
        state.loading.recruiter = false;
    }
}

function snapshotJob(job) {
    return {
        id: job.id, title: job.title, employer: job.employer, category: job.category,
        jobType: job.jobType, payMode: job.payMode, payText: job.payText,
        payAmount: job.payAmount, blurb: job.blurb, ask: job.ask, area: job.area,
        track: job.track || '',
    };
}

export function openTalk(id) {
    state.talkId = String(id || '');
    state.view = 'talk';
}

export function closeTalk() {
    state.talkId = '';
    state.view = '';
}

/**
 * 说一句，然后听 HR 怎么回。
 *
 * 决定权来自对话。代码只守两条硬边界：
 *   1. 至少完成两轮有效交流，不能刚发一句就入职
 *   2. 已经三份工作时不能再录
 */
export async function sendTalk(rawText) {
    const hr = currentTalk();
    const body = String(rawText || '').trim();
    if (!hr || !body || state.loading.reply) return;
    if (hr.status !== TALK_STATUS.open) return;

    hr.messages.push({ id: uid('m'), role: 'user', text: body, ts: Date.now() });
    await dbx.saveRecruiter(state._app, state.identity.profileKey, hr);

    state.loading.reply = true;
    state.error = '';
    try {
        const rounds = hr.messages.filter((m) => m.role === 'user').length - 1;
        const { text } = buildTalkPrompt({
            ...generationContext(),
            job: hr.job, recruiter: hr, rounds,
        });
        const history = hr.messages.slice(-16).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text,
        }));
        // 最后一条已经是本轮用户输入，作为 user turn 单独传，不要在 history 里重复
        history.pop();

        const res = await ai.generateJson({
            system: text, history, user: body, temperature: 0.95,
        });
        if (!res.ok) {
            state.error = res.error;
            return;
        }

        let reply = tidyText(res.data?.reply) || '……';
        let decision = ['pending', 'hire', 'reject'].includes(res.data?.decision)
            ? res.data.decision
            : 'pending';
        let reason = tidyText(res.data?.reason);

        if (decision === 'hire' && rounds < 1) {
            decision = 'pending';
            reason = '';
            reply = '我还不能现在就定。再具体说一件你做过的相关事情，或者说说遇到这份工作最难的情况时你会怎么处理。';
        }

        hr.messages.push({ id: uid('m'), role: 'hr', text: reply, ts: Date.now() });

        // 满员了就不能再录，改成「先留着」。
        // 不再存在任何按职业强制录用的分支，AI 的结论必须来自实际面试表现。
        if (decision === 'hire' && state.posts.length >= MAX_JOBS) {
            hr.messages.push({
                id: uid('m'), role: 'system',
                text: `你已经有 ${MAX_JOBS} 份工作了。先去「在职」辞掉一份，再回来接这个。`,
                ts: Date.now(),
            });
            decision = 'pending';
        }

        if (decision === 'hire') {
            hr.status = TALK_STATUS.hired;
            hr.reason = reason;
            await dbx.saveRecruiter(state._app, state.identity.profileKey, hr);
            await hireFromTalk(hr);
            return;
        }
        if (decision === 'reject') {
            hr.status = TALK_STATUS.rejected;
            hr.reason = reason || '这次不太合适';
            showToast('这家没要你');
        }
        await dbx.saveRecruiter(state._app, state.identity.profileKey, hr);
    } catch (err) {
        console.error('[job] 面试回复失败', err);
        state.error = err?.message || String(err);
    } finally {
        state.loading.reply = false;
    }
}

/** 用户自己撤掉一场面试 */
export async function closeTalkThread(id) {
    const hr = state.recruiters.find((r) => sameId(r.id, id));
    if (!hr) return;
    hr.status = TALK_STATUS.closed;
    await dbx.saveRecruiter(state._app, state.identity.profileKey, hr);
    if (sameId(state.talkId, id)) closeTalk();
}

export async function deleteTalk(id) {
    await dbx.removeRecruiter(state._app, id);
    state.recruiters = state.recruiters.filter((r) => !sameId(r.id, id));
    if (sameId(state.talkId, id)) closeTalk();
}

// ---------------------------------------------------------------------------
// 入职
// ---------------------------------------------------------------------------

/**
 * 录用 → 变成一份真的工作。
 *
 * 三件事必须一起发生，缺一件用户就会觉得「入职了但哪儿都没变」：
 *   1. 建 post（带默认排班、默认薪资、默认小剧场 prompt）
 *   2. HR 人设进数据库并和 post 互相引用 —— 需求原话「hr 的人设要进入数据库」
 *   3. **人设里的职业跟着改** —— 需求原话「nook 里用户人设的职业也会同步更新」
 */
export async function hireFromTalk(hr) {
    if (!hr) return null;
    const job = hr.job || {};
    const today = todayKey();

    const post = {
        id: uid('po'),
        jobId: job.id || '',
        recruiterId: hr.id,
        track: hr.track || '',
        title: job.title || '新工作',
        company: job.employer || '',
        category: job.category || '',
        duty: job.blurb || '',
        place: job.area || '',
        note: '',
        pay: defaultPay(job),
        shift: sched.makeShift(job.jobType === 'gig' ? 'free' : 'weekly'),
        colleagueIds: [],
        rivalIds: [],
        theaterPrompt: '',
        startDay: today,
        createdAt: Date.now(),
    };
    post.theaterPrompt = defaultTheaterPrompt(post);

    const saved = await dbx.savePost(state._app, state.identity.profileKey, post);
    if (!saved) {
        showToast('入职没写进数据库，再试一次');
        return null;
    }
    state.posts = [...state.posts, saved];

    hr.postId = saved.id;
    hr.status = TALK_STATUS.hired;
    await dbx.saveRecruiter(state._app, state.identity.profileKey, hr);

    await world.writeOccupation(saved.title);
    state.identity.occupation = saved.title;

    publishContext();
    showToast(`入职了：${saved.title}`);
    notifyIsland('入职成功', `${saved.title}${saved.company ? ` · ${saved.company}` : ''}`);
    return saved;
}

/** 按职位的 payMode 给一份能直接用的默认薪资设置 */
function defaultPay(job = {}) {
    const amount = money(job.payAmount);
    if (job.payMode === 'daily') {
        return {
            mode: 'daily', amount: 0, payDay: 10,
            dailyBase: Math.round(amount * 0.4) || 40,
            dailyMax: amount || 120,
            lastPaidDay: todayKey(),
        };
    }
    if (job.payMode === 'tip') {
        return {
            mode: 'tip', amount: 0, payDay: 10,
            dailyBase: 0,
            dailyMax: amount || 200,
            lastPaidDay: todayKey(),
        };
    }
    return {
        mode: 'monthly',
        amount: amount || 2000,
        payDay: 10,
        dailyBase: 0,
        dailyMax: 0,
        lastPaidDay: todayKey(),
    };
}

export function currentPost() {
    return state.posts.find((p) => sameId(p.id, state.postId)) || null;
}

export function openPost(id) {
    state.postId = String(id || '');
    state.view = 'post';
    const d = new Date();
    state.calendar = { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function closePost() {
    state.postId = '';
    state.view = '';
}

/** 改一份工作（标题 / 单位 / 日常 / 备注 / 薪资 / 排班 / 同事 / 敌对 / 专属 prompt） */
export async function updatePost(post, patch = {}) {
    if (!post) return;
    Object.assign(post, patch);
    await persistPost(post);
    // 标题改了，人设里的职业也跟着改 —— 否则两处会长期对不上
    if (patch.title && sameId(post.id, state.posts[0]?.id)) {
        await world.writeOccupation(patch.title);
        state.identity.occupation = patch.title;
    }
    publishContext();
    showToast('已保存');
}

export async function addManualPost(fields = {}) {
    if (state.posts.length >= MAX_JOBS) {
        showToast(`最多同时有 ${MAX_JOBS} 份工作`);
        return null;
    }
    const post = {
        id: uid('po'),
        jobId: '', recruiterId: '', track: '',
        title: String(fields.title || '').trim() || '一份工作',
        company: String(fields.company || '').trim(),
        category: String(fields.category || '其他').trim(),
        duty: String(fields.duty || '').trim(),
        place: String(fields.place || '').trim(),
        note: String(fields.note || '').trim(),
        pay: { ...defaultPay({ payMode: fields.payMode, payAmount: fields.payAmount }) },
        shift: sched.makeShift(fields.shiftMode || 'weekly'),
        colleagueIds: [], rivalIds: [],
        theaterPrompt: '',
        startDay: todayKey(),
        createdAt: Date.now(),
    };
    post.theaterPrompt = defaultTheaterPrompt(post);

    const saved = await dbx.savePost(state._app, state.identity.profileKey, post);
    if (!saved) return null;
    state.posts = [...state.posts, saved];
    await world.writeOccupation(saved.title);
    state.identity.occupation = saved.title;
    publishContext();
    showToast('加好了');
    return saved;
}

/**
 * 辞职。
 *
 * ★ 小剧场**不删**。那是发生过的事，工作没了不代表那几天没上过班；
 *   而且用户很可能只是想腾个位置。要清理有单独的删除入口。
 */
export async function resign(postId) {
    const post = state.posts.find((p) => sameId(p.id, postId));
    if (!post) return;
    await dbx.removePost(state._app, post.id);
    state.posts = state.posts.filter((p) => !sameId(p.id, post.id));

    const hr = state.recruiters.find((r) => sameId(r.postId, post.id));
    if (hr) {
        hr.status = TALK_STATUS.closed;
        await dbx.saveRecruiter(state._app, state.identity.profileKey, hr);
    }

    // 人设里的职业换成还在做的那份；一份都不剩就清空
    const next = state.posts[0];
    await world.writeOccupation(next ? next.title : '');
    state.identity.occupation = next ? next.title : '';

    if (sameId(state.postId, post.id)) closePost();
    publishContext();
    showToast(`辞掉了：${post.title}`);
}

// ---------------------------------------------------------------------------
// 小剧场
// ---------------------------------------------------------------------------

export function theatersOf(postId) {
    return state.theaters.filter((t) => sameId(t.postId, postId));
}

export function playedDaysOf(postId) {
    return theatersOf(postId).map((t) => t.day);
}

export function currentTheater() {
    return state.theaters.find((t) => sameId(t.id, state.theaterId)) || null;
}

export function openTheater(id) {
    state.theaterId = String(id || '');
    state.view = 'theater';
}

export function closeTheater() {
    state.theaterId = '';
    state.view = state.postId ? 'post' : '';
}

/** 这一天能不能演（含「已经演过」「还没到」「休息日」三种拦截） */
export function playCheck(post, day) {
    if (!post) return { ok: false, reason: 'rest', text: '' };
    return sched.canPlay(post.shift, day, playedDaysOf(post.id));
}

/**
 * 演一天。
 *
 * 顺序很重要：**先存小剧场，再结钱**。
 * 反过来的话，结完钱存盘失败会留下一笔来路不明的进账，
 * 而且用户重试时会再结一次。
 */
export async function generateTheater(post, day, opts = {}) {
    if (!post || !day) return null;
    if (state.loading.theater) return null;

    const check = playCheck(post, day);
    if (!check.ok) {
        showToast(check.text);
        return null;
    }

    state.loading.theater = true;
    state.error = '';
    await ensurePromptsLoaded();

    try {
        const ais = world.listWorldAis(state.identity.world);
        const pick = (ids) => asArray(ids)
            .map((id) => {
                const hit = ais.find((a) => sameId(a.id, id));
                return hit ? { id: hit.id, name: hit.name, desc: world.describeAi(hit.id) } : null;
            })
            .filter(Boolean);

        const recentDigests = theatersOf(post.id)
            .filter((t) => t.digest)
            .slice(0, 5)
            .map((t) => ({ day: t.day, text: t.digest }));

        const { text } = buildTheaterPrompt({
            ...generationContext(),
            post,
            day,
            length: opts.length || state.profile?.theaterLength || 'medium',
            colleagues: pick(post.colleagueIds),
            rivals: pick(post.rivalIds),
            recentDigests,
            extra: opts.extra || '',
        });

        const res = await ai.generateJson({ system: text, temperature: 1 });
        if (!res.ok) {
            state.error = res.error;
            return null;
        }

        const theater = normalizeTheater(res.data, { postId: post.id, day });
        const saved = await dbx.saveTheater(state._app, state.identity.profileKey, theater);
        if (!saved) {
            state.error = '小剧场没写进数据库，再试一次';
            return null;
        }
        state.theaters = [saved, ...state.theaters];
        state.theaterId = saved.id;
        state.view = 'theater';

        await settleTheaterPay(post, saved);

        // 梗概慢一点没关系，不挡用户看正文
        void generateDigest(post, saved);
        return saved;
    } catch (err) {
        console.error('[job] 生成小剧场失败', err);
        state.error = err?.message || String(err);
        return null;
    } finally {
        state.loading.theater = false;
    }
}

function normalizeTheater(data, meta = {}) {
    const perf = data?.performance || {};
    return {
        id: uid('th'),
        postId: meta.postId,
        day: meta.day,
        title: String(data?.title || fmtDay(meta.day)).trim(),
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
        performance: {
            level: ['bad', 'poor', 'ok', 'good', 'great'].includes(perf.level) ? perf.level : 'ok',
            note: String(perf.note || '').trim(),
            bonus: money(perf.bonus),
        },
        paid: 0,
        digest: '',
        createdAt: Date.now(),
    };
}

/** 结这一天的钱，并把实际到账金额记回小剧场（详情页要显示） */
async function settleTheaterPay(post, theater) {
    const u = state.identity.user;
    if (!u?.id) return;
    const res = await payroll.settleTheater(u.id, post, theater);
    if (!res.ok) {
        if (res.error) console.warn('[job] 当天结算失败', res.error);
        return;
    }
    theater.paid = res.amount;
    await dbx.saveTheater(state._app, state.identity.profileKey, theater);
    refreshBalance();
    if (res.amount > 0) {
        const line = `${payroll.labelOfLevel(theater.performance.level)} · +${res.amount} ${state.identity.currency}`;
        showToast(line);
        notifyIsland('今天到账', line);
    }

}

/** 当天梗概 —— 下次生成小剧场时会被读回去 */
export async function generateDigest(post, theater) {
    if (!theater) return '';
    state.loading.digest = true;
    try {
        const { text } = buildDigestPrompt({ ...generationContext(), theater, post });
        const res = await ai.generateText({ system: text, temperature: 0.6 });
        if (!res.ok) return '';
        theater.digest = tidyText(res.raw).slice(0, 240);
        await dbx.saveTheater(state._app, state.identity.profileKey, theater);
        publishContext();
        return theater.digest;
    } finally {
        state.loading.digest = false;
    }
}

export async function saveTheaterEdits(theater) {
    if (!theater) return;
    await dbx.saveTheater(state._app, state.identity.profileKey, theater);
    const i = state.theaters.findIndex((t) => sameId(t.id, theater.id));
    if (i >= 0) state.theaters.splice(i, 1, theater);
    publishContext();
    showToast('已保存');
}

/**
 * 重 roll。
 *
 * ★ 先把上一版带来的钱撤掉再重生成。不撤的话演一场刷十次，
 *   钱包能刷出十天的工资 —— 而且流水里全是同一天的重复记录。
 */
export async function rerollTheater(theater, opts = {}) {
    if (!theater) return null;
    const post = state.posts.find((p) => sameId(p.id, theater.postId));
    if (!post) return null;

    const day = theater.day;
    await deleteTheater(theater.id, { silent: true });
    return generateTheater(post, day, opts);
}

export async function deleteTheater(id, { silent = false } = {}) {
    const theater = state.theaters.find((t) => sameId(t.id, id));
    if (!theater) return;
    const u = state.identity.user;
    if (u?.id) await payroll.revokeTheaterPay(u.id, theater.id);
    await dbx.removeTheater(state._app, theater.id);
    state.theaters = state.theaters.filter((t) => !sameId(t.id, theater.id));
    refreshBalance();
    if (sameId(state.theaterId, theater.id)) {
        state.theaterId = '';
        state.view = state.postId ? 'post' : '';
    }
    publishContext();
    if (!silent) showToast('删掉了，那天的钱也一起撤回了');
}

// ---------------------------------------------------------------------------
// 日历
// ---------------------------------------------------------------------------

export function setCalendar(year, month) {
    state.calendar = { year, month };
}

export function stepCalendar(delta) {
    const next = sched.shiftMonth(state.calendar.year, state.calendar.month, delta);
    state.calendar = next;
}

/** 在日历上点一天：自己排的模式切换上班/不上班，其他模式切换请假 */
export async function toggleShiftDay(post, day) {
    if (!post || !day) return;
    const shift = post.shift || (post.shift = sched.makeShift());
    if (shift.mode === 'custom') {
        const arr = shift.days || (shift.days = []);
        const i = arr.indexOf(day);
        if (i >= 0) arr.splice(i, 1);
        else arr.push(day);
    } else {
        const arr = shift.offDays || (shift.offDays = []);
        const i = arr.indexOf(day);
        if (i >= 0) arr.splice(i, 1);
        else arr.push(day);
    }
    await persistPost(post);
    publishContext();
}

// ---------------------------------------------------------------------------
// 提示词管理
// ---------------------------------------------------------------------------

function overrides() {
    const p = state.profile;
    if (!p) return null;
    return p.promptOverrides || (p.promptOverrides = {});
}

export function setPromptActive(id, active) {
    const ov = overrides();
    if (!ov) return;
    const card = PROMPT_CARDS.find((c) => c.id === id);
    if (!card || card.locked) return;
    ov[id] = { ...(ov[id] || {}), active: active !== false };
    persistProfile();
}

export function setPromptText(id, text) {
    const ov = overrides();
    if (!ov) return;
    const card = PROMPT_CARDS.find((c) => c.id === id);
    if (!card) return;
    const next = String(text ?? '');
    if (next === card.text) {
        // 改回默认值就把 override 去掉，这样以后默认文案更新时能跟着走
        const rest = { ...(ov[id] || {}) };
        delete rest.text;
        if (Object.keys(rest).length) ov[id] = rest;
        else delete ov[id];
    } else {
        ov[id] = { ...(ov[id] || {}), text: next };
    }
    persistProfile();
    showToast('已保存');
}

export function resetPrompt(id) {
    const ov = overrides();
    if (!ov) return;
    delete ov[id];
    persistProfile();
    showToast('还原成默认的了');
}

export function resetAllPrompts() {
    const p = state.profile;
    if (!p) return;
    p.promptOverrides = {};
    p.promptOrder = [];
    persistProfile();
    showToast('全部还原了');
}

/** 上下移一张卡。顺序只影响拼接次序（后写的指令赢），所以是有意义的。 */
export function movePrompt(id, delta) {
    const p = state.profile;
    if (!p) return;
    const cards = promptCards();
    const from = cards.findIndex((c) => c.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= cards.length) return;
    const ids = cards.map((c) => c.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    p.promptOrder = ids;
    persistProfile();
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
        _themeApplier(state.profile?.themeId || 'dayshift', state.profile?.customColors || {});
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

export function setTheaterLength(id) {
    if (!state.profile) return;
    state.profile.theaterLength = id;
    persistProfile();
}

// ---------------------------------------------------------------------------
// UI 杂项
// ---------------------------------------------------------------------------

export function setTab(id) {
    if (!TABS.some((t) => t.id === id)) return;
    state.tab = id;
    state.view = '';
    state.detailJob = null;
    state.talkId = '';
    state.postId = '';
    state.theaterId = '';
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
    if (!text) return;
    state.toast = String(text);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { state.toast = ''; }, 1900);
}

export function clearError() {
    state.error = '';
}

/**
 * 灵动岛只用来说「他不在这一页也该知道」的事：工资到账、入职成功。
 * 别的反馈走 toast —— 每弹一次岛都会顶掉正在播放的音乐岛。
 */
function notifyIsland(title, text) {
    try {
        state._app?.toolkit?.island?.notify?.('success', title, text);
    } catch (_) { /* 岛不可用不影响主流程 */ }
}

// ---------------------------------------------------------------------------
// 对外广播
// ---------------------------------------------------------------------------

/**
 * 把「murmur 发消息时要现算的东西」挂到 window。
 *
 * ★ 挂上去的是**读取器**不是快照。快照会在下一次工作变动时过期，
 *   而这个函数每次被调用都现读 state。
 *
 * ★ 这件事**由 store 做，不由根组件做**。放组件里的话，用户没打开过这个 App
 *   就没人挂，表现是「AI 从来不知道我在上班，除非我先去点一下」。
 *
 * ★ 传出去的是**原始数据**，不是拼好的文案 —— 「哪个 AI 能知道哪份工作的细节」
 *   这个判断必须在拿得到 aiId 的地方做。在这里拼好等于永久放弃它。
 */
export function publishContext() {
    installJobContext(() => ({
        ready: Boolean(state.profile?.configured && state.identity.ready),
        userName: state.identity.userName,
        currency: state.identity.currency,
        seeking: state.posts.length < MAX_JOBS,
        monthIncome: state.monthIncome,
        posts: state.posts.map((p) => ({
            id: p.id,
            title: p.title,
            company: p.company,
            duty: p.duty,
            shiftText: sched.describeShift(p.shift),
            colleagueIds: [...asArray(p.colleagueIds)],
            rivalIds: [...asArray(p.rivalIds)],
            digests: theatersOf(p.id)
                .filter((t) => t.digest)
                .slice(0, 4)
                .map((t) => ({ day: t.day, text: t.digest })),
        })),
    }));
}

// 给组件用的只读派生
export { sched, payroll };
export const helpers = { dayKey, todayKey, fmtDay, THEATER_PER_DAY };
