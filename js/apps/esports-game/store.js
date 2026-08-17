/**
 * 赛点 · 状态单例
 *
 * 生涯事实（属性 / 时间 / 赛季 / 薪资）全部归声浪，赛点通过 forum-bridge 读写；
 * 这里只养游戏客户端自己的数据：巅峰分、熟练度、场次、亲密关系、群聊。
 *
 * ── AI 调用边界 ───────────────────────────────────────────────────
 * 排位模拟、训练赛、他人战绩、每日群聊氛围全部 JS 本地。
 * 只有这些动作调 AI（全部用户主动触发）：
 *   对局文字回放（云端回放）/ 群聊回话 / 复盘。
 * 排位结果没有重 roll —— 打完就是打完了。
 */

import {
    COACH_DAILY_POOL, COACH_NAG_POOL, COUPLE_TAG_GATE, COUPLE_UNBIND_COST,
    DAILY_GAME_CAP, DEFAULT_COUPLE_TAG, ENERGY_FLOOR, INTIMACY_DAILY_CAP, INTIMACY_MAX,
    INTIMACY_PER_GAME, MEAL_ENERGY, MEAL_MINUTES, MEAL_WINDOWS, PROF_MAX,
    SESSION_GAME_CAP, TRAINING_ENERGY, TRAINING_MINUTES, rankModeById,
} from './constants.js';
import { asArray, clamp, hashString, tidyText, toPlain, uid } from './utils.js';
import * as dbx from './services/db.js';
import * as bridge from './services/forum-bridge.js';
import * as rankEngine from './services/rank-engine.js';
import * as chatBridge from './services/chat-bridge.js';
import { generateJson, generateText } from './services/ai.js';
import { buildChatReplyPrompt, buildReplayPrompt, buildReviewPrompt } from './services/prompt-builder.js';
import { buildCoopSummarySpec, syncCoopPrompt } from './services/app-prompts.js';
import { gameModelById, playerPower, rankTierLabel } from '../esports-shared/esports-kit.js';
import { listWorldAiPersons, readWorldProfile } from '@/src/core/world-profile.js';

const Vue = typeof window !== 'undefined' ? window.Vue : null;
const reactive = (o) => (Vue?.reactive ? Vue.reactive(o) : o);

const LS_THEME_KEY = 'xiaoting::esports-game-theme-v1';

const state = reactive({
    ready: false,
    blocked: '',
    /** 声浪已就绪但还没首配 */
    needsForumSetup: false,

    /** 声浪给的生涯快照（真相在声浪，这里是投影） */
    career: null,

    gState: null,
    sessions: [],
    relations: [],
    chats: { team: [], coach: [] },

    /** 出战揭示：最近一场系列赛结果（逐局翻开） */
    seriesReveal: null,

    tab: 'lobby',
    /** 覆盖页：'' | session | friend | records */
    view: '',
    viewPayload: null,
    modal: null,

    loading: {
        hydrate: false, rank: false, training: false, series: false,
        chat: '', replay: '', review: false,
    },
    theme: { id: 'nighttrain', custom: {} },
    toast: '',
});

let appRef = null;
let themeApplier = null;
let toastTimer = null;

export function getState() {
    return state;
}

export function registerThemeApplier(fn) {
    themeApplier = fn;
}

export function showToast(text) {
    state.toast = String(text || '');
    if (toastTimer) clearTimeout(toastTimer);
    if (state.toast) {
        toastTimer = setTimeout(() => { state.toast = ''; }, 2600);
    }
}

export function setTab(id) {
    state.tab = id;
    state.view = '';
    state.viewPayload = null;
}

export function setView(view, payload = null) {
    state.view = view || '';
    state.viewPayload = payload;
}

export function openModal(modal) {
    state.modal = modal;
}

export function closeModal() {
    state.modal = null;
}

// ============================================================
// 查询辅助
// ============================================================

export function model() {
    return gameModelById(state.career?.modelId);
}

export function ratingLabel() {
    return rankTierLabel(state.gState?.rating || 0);
}

export function todayGames() {
    const day = state.career?.clock?.day || 1;
    return Number(state.gState?.dailyGames?.[day]) || 0;
}

export function trainingDoneToday() {
    const day = state.career?.clock?.day || 1;
    return Boolean(state.gState?.trainingDays?.[day]);
}

/** 可邀请的同行者：绑定世界的 AI + 队友 NPC */
export function companionOptions() {
    const out = [];
    const profile = readWorldProfile();
    for (const ai of listWorldAiPersons(profile.world)) {
        out.push({
            id: `ai::${ai.id}`,
            aiPersonId: String(ai.id),
            name: String(ai.name || 'AI'),
            type: 'ai',
            power: 46 + (hashString(`aipower::${ai.id}`) % 28),
            desc: String(ai.role || ai.personality || 'AI 伙伴').slice(0, 18),
        });
    }
    for (const p of asArray(state.career?.teammates)) {
        out.push({
            id: p.id,
            name: p.gameId,
            type: 'npc',
            power: playerPower(p.attrs),
            desc: `${p.posLabel}${p.isSub ? ' · 替补' : ''}`,
        });
    }
    return out;
}

export function relationOf(targetId) {
    return state.relations.find((r) => r.targetId === targetId) || null;
}

/** 饭点状态：{ key, label, missed } */
export function mealStatus() {
    const meals = state.career?.meals || {};
    const minute = state.career?.clock?.minute || 0;
    const day = state.career?.clock?.day || 1;
    const effective = meals.day === day ? meals : { lunch: false, dinner: false };
    const rows = [];
    for (const [key, win] of Object.entries(MEAL_WINDOWS)) {
        rows.push({
            key,
            label: win.label,
            eaten: Boolean(effective[key]),
            open: minute >= win.from - 60,
            missed: !effective[key] && minute > win.to,
        });
    }
    return rows;
}

export function isHungryNow() {
    return mealStatus().some((m) => m.missed);
}

// ============================================================
// hydrate
// ============================================================

export async function hydrate(app) {
    if (app) appRef = app;
    if (state.loading.hydrate) return;
    state.loading.hydrate = true;
    try {
        await refreshCareer({ full: true });
    } finally {
        state.loading.hydrate = false;
        state.ready = true;
    }
    applyThemeFromState();
}

export async function refreshCareer({ full = false } = {}) {
    const career = await bridge.getCareerState();
    if (!career || career.ok === false) {
        state.blocked = career?.error || '声浪（电竞论坛）还没就绪。它是生涯的事实源，先打开它。';
        state.needsForumSetup = false;
        state.career = null;
        return;
    }
    if (!career.ready) {
        state.blocked = '';
        state.needsForumSetup = true;
        state.career = null;
        return;
    }
    state.blocked = '';
    state.needsForumSetup = false;

    const saveChanged = state.career?.saveId !== career.saveId;
    state.career = career;

    if (full || saveChanged || !state.gState) {
        let gs = await dbx.loadState(appRef, career.saveId);
        if (!gs) {
            gs = dbx.makeState(career.saveId, career.profileKey, career.peakRating || 1500);
            await dbx.saveState(appRef, gs);
        }
        state.gState = gs;
        state.sessions = await dbx.listSessions(appRef, career.saveId);
        state.relations = await dbx.listRelations(appRef, career.saveId);
        state.chats = {
            team: await dbx.listChat(appRef, career.saveId, 'team'),
            coach: await dbx.listChat(appRef, career.saveId, 'coach'),
        };
        await ensureMutualFollows();
        await ensureDailyCoachMessage();
        await retrySync();
        syncMurmur();
    } else {
        await ensureDailyCoachMessage();
    }
}

/** 队友默认互关（关系行的存在 = 互关 + 可见 rank 记录） */
async function ensureMutualFollows() {
    const career = state.career;
    if (!career) return;
    for (const p of asArray(career.teammates)) {
        if (relationOf(p.id)) continue;
        const row = await dbx.saveRelation(appRef, career.saveId, {
            targetId: p.id,
            targetType: 'npc',
            name: p.gameId,
            intimacy: 12 + (hashString(`rel::${career.saveId}::${p.id}`) % 10),
            coupleTag: null,
            mutualFollow: true,
            gamesTogether: 0,
            lastDay: 0,
            dailyGain: {},
        });
        state.relations = [...state.relations.filter((r) => r.id !== row.id), row];
    }
}

async function ensureRelation(target) {
    const existing = relationOf(target.id);
    if (existing) return existing;
    const row = await dbx.saveRelation(appRef, state.career.saveId, {
        targetId: target.id,
        targetType: target.type || 'npc',
        name: target.name,
        intimacy: target.type === 'ai' ? 20 : 10,
        coupleTag: null,
        mutualFollow: true,
        gamesTogether: 0,
        lastDay: 0,
        dailyGain: {},
    });
    state.relations = [...state.relations, row];
    return row;
}

async function gainIntimacy(target, amount) {
    const row = await ensureRelation(target);
    const day = state.career?.clock?.day || 1;
    const gained = Number(row.dailyGain?.[day]) || 0;
    const allow = Math.max(0, INTIMACY_DAILY_CAP - gained);
    const applied = Math.min(allow, amount);
    if (applied <= 0) return row;
    row.intimacy = clamp((row.intimacy || 0) + applied, 0, INTIMACY_MAX);
    row.dailyGain = { [day]: gained + applied };
    row.lastDay = day;
    const saved = await dbx.saveRelation(appRef, state.career.saveId, toPlain(row));
    state.relations = [...state.relations.filter((r) => r.id !== saved.id), saved];
    return saved;
}

// ============================================================
// 吃饭 / 时间
// ============================================================

export async function eatMeal(key) {
    const win = MEAL_WINDOWS[key];
    if (!win) return;
    const result = await bridge.spendTime({ minutes: MEAL_MINUTES, energyDelta: MEAL_ENERGY, meal: key });
    if (result.ok) {
        showToast(`${win.label}吃完了，精力 +${MEAL_ENERGY}`);
        await refreshCareer();
        if (result.hitMidnight) notifyMidnight();
    } else {
        showToast(result.error || '现在吃不了');
    }
}

function notifyMidnight() {
    openModal({ type: 'midnight' });
}

// ============================================================
// 排位
// ============================================================

/** 会话预检：时间 / 精力 / 每日上限 / 饭点 */
export function rankPlan(count) {
    const career = state.career;
    if (!career) return null;
    const m = model();
    const plan = rankEngine.planSession({
        startMinute: career.clock.minute,
        count,
        matchMinutes: m.matchMinutes,
        meals: career.meals?.day === career.clock.day ? career.meals : {},
    });
    const capLeft = DAILY_GAME_CAP - todayGames();
    return {
        ...plan,
        capLeft,
        overCap: count > capLeft,
        lowEnergy: (career.energy ?? 100) <= ENERGY_FLOOR,
        maxBySession: SESSION_GAME_CAP,
    };
}

/**
 * 开一次排位（JS 一次掷定全部，UI 逐局揭示；没有重 roll）。
 * @param {object} opts { modeId, count, companionIds, heroName, eatFirst }
 */
export async function startRankSession(opts = {}) {
    const career = state.career;
    if (!career || state.loading.rank) return { ok: false };
    const mode = rankModeById(opts.modeId);
    const count = clamp(opts.count, 1, SESSION_GAME_CAP);
    const plan = rankPlan(count);
    if (plan.overCap) return { ok: false, error: `今天最多还能打 ${plan.capLeft} 局` };
    if (plan.lowEnergy) return { ok: false, error: '精力见底了，先休息或吃口饭' };

    state.loading.rank = true;
    try {
        // 先吃饭（可选）
        if (opts.eatFirst && plan.mealsNeeded.length) {
            await eatMeal(plan.mealsNeeded[0].key);
        }
        await refreshCareer();

        const all = companionOptions();
        const companions = asArray(opts.companionIds)
            .map((id) => all.find((c) => c.id === id))
            .filter(Boolean)
            .slice(0, mode.companions);

        const day = career.clock.day;
        const seq = (state.sessions[0]?.seq || 0) + 1;
        const heroName = String(opts.heroName || '').trim() || model().heroPool[0];
        const heroProf = Number(state.gState?.practice?.[heroName]) || 0;

        const result = rankEngine.simulateRankSession({
            seedBase: `${career.saveId}::rank::${day}::${seq}`,
            saveId: career.saveId,
            day,
            sessionSeq: seq,
            count,
            modeId: mode.id,
            userPower: playerPower(career.attrs),
            companions,
            heroName,
            heroProf,
            focus: state.gState?.focusHero === heroName,
            energy: career.energy ?? 100,
            staminaHigh: (career.attrs?.stamina ?? 0) >= 70,
            meals: career.meals?.day === day ? career.meals : {},
            startMinute: career.clock.minute,
            rating: state.gState?.rating || 1500,
            teamSize: model().teamSize,
            model: model(),
        });

        // 时间与精力（声浪是真相）
        const spend = await bridge.spendTime({
            minutes: result.minutesTotal,
            energyDelta: result.energyDelta,
        });

        // 落场次与单局
        const session = await dbx.saveSession(appRef, career.saveId, {
            id: uid('sess'),
            seq,
            day,
            modeId: mode.id,
            modeLabel: mode.label,
            wins: result.wins,
            losses: result.losses,
            ratingBefore: result.ratingBefore,
            ratingAfter: result.ratingAfter,
            ratingDelta: result.ratingDelta,
            minutesTotal: result.minutesTotal,
            heroName,
            companionsMeta: companions.map((c) => ({ id: c.id, name: c.name, type: c.type, aiPersonId: c.aiPersonId || '' })),
        });
        for (const m of result.matches) {
            await dbx.saveMatch(appRef, career.saveId, {
                ...m,
                sessionId: session.id,
                day,
                modeLabel: mode.label,
                replay: '',
            });
        }
        state.sessions = await dbx.listSessions(appRef, career.saveId);

        // 游戏侧状态
        const gs = state.gState;
        gs.rating = result.ratingAfter;
        gs.best = Math.max(gs.best || 0, result.ratingAfter);
        gs.history = [...asArray(gs.history), { day, rating: result.ratingAfter }].slice(-60);
        gs.dailyGames = { ...(gs.dailyGames || {}), [day]: todayGames() + count };
        gs.practice = {
            ...(gs.practice || {}),
            [heroName]: clamp((Number(gs.practice?.[heroName]) || 0) + result.profGain, 0, PROF_MAX),
        };
        await dbx.saveState(appRef, gs);

        // 亲密
        for (const c of companions) {
            await gainIntimacy(c, INTIMACY_PER_GAME * count);
        }

        // 写回声浪（失败进 pendingSync）
        const summaryPayload = {
            sessionId: session.id,
            day,
            modeLabel: mode.label,
            wins: result.wins,
            losses: result.losses,
            ratingAfter: result.ratingAfter,
            ratingDelta: result.ratingDelta,
            matches: result.matches.map((m) => ({ win: m.win, hero: m.hero, kdaText: m.kdaText })),
            companions: companions.map((c) => c.name),
        };
        const synced = await bridge.recordRankSession(summaryPayload);
        if (!synced?.ok) {
            gs.pendingSync = [...asArray(gs.pendingSync), { kind: 'rank-session', payload: summaryPayload }];
            await dbx.saveState(appRef, gs);
        }
        if (Object.keys(result.attrDeltas).length) {
            await bridge.applyRankOutcome({ attrDeltas: result.attrDeltas, cap: 2 });
        }

        await refreshCareer();
        syncMurmur();
        if (spend?.hitMidnight) notifyMidnight();
        return { ok: true, session: toPlain(session) };
    } finally {
        state.loading.rank = false;
    }
}

// ============================================================
// 训练赛
// ============================================================

export async function playTraining() {
    const career = state.career;
    if (!career || state.loading.training) return { ok: false };
    if (trainingDoneToday()) return { ok: false, error: '今天的训练赛已经打完了' };
    state.loading.training = true;
    try {
        const day = career.clock.day;
        const opponents = asArray(career.teams).filter((t) => t.id !== career.userTeamId);
        const opp = opponents[hashString(`train::${career.saveId}::${day}`) % opponents.length];
        const myPower = playerPower(career.attrs);
        const result = rankEngine.simulateTraining({
            seedBase: `${career.saveId}::train::${day}`,
            myPower: myPower + 4,           // 有队友与教练在场
            oppPower: (opp?.powerBase || 55) + 2,
            oppName: opp?.name || '陪练队',
        });

        await bridge.spendTime({ minutes: TRAINING_MINUTES, energyDelta: -TRAINING_ENERGY });
        await bridge.applyRankOutcome({ attrDeltas: result.attrDeltas, cap: 1 });

        const gs = state.gState;
        gs.trainingDays = { ...(gs.trainingDays || {}), [day]: true };
        gs.lastTraining = { day, ...result };
        await dbx.saveState(appRef, gs);

        // 群里落一条战报（零 token）
        await appendChat('team', {
            senderId: 'system',
            senderName: '训练赛机器人',
            kind: 'system',
            text: `今日训练赛 vs ${result.oppName}：${result.wins}:${result.losses}${result.wins >= 2 ? '，打得不错' : '，回头复盘'}`,
        });

        await refreshCareer();
        return { ok: true, result };
    } finally {
        state.loading.training = false;
    }
}

// ============================================================
// 正式比赛（出战）
// ============================================================

export const SERIES_STRATEGIES = Object.freeze([
    { id: 'steady', label: '稳健运营', value: 2, reason: '按训练的体系打，不犯错' },
    { id: 'aggro', label: '前期强压', value: 4, reason: '赌前期节奏，把对面打崩' },
    { id: 'coach', label: '听教练的', value: 3, reason: '教练针对性 banpick' },
]);

export async function playSeries(seriesId, strategyId) {
    if (state.loading.series) return { ok: false };
    const strategy = SERIES_STRATEGIES.find((s) => s.id === strategyId) || SERIES_STRATEGIES[0];
    state.loading.series = true;
    try {
        const result = await bridge.playUserSeries({
            seriesId,
            modifiers: [{ id: strategy.id, label: strategy.label, value: strategy.value, reason: strategy.reason }],
        });
        if (!result?.ok) return { ok: false, error: result?.error || '出战失败' };
        state.seriesReveal = { series: result.series, revealed: 0 };
        await refreshCareer();
        return { ok: true, series: result.series };
    } finally {
        state.loading.series = false;
    }
}

export function revealNextGame() {
    if (!state.seriesReveal) return;
    const total = asArray(state.seriesReveal.series?.result?.games).length;
    state.seriesReveal = {
        ...state.seriesReveal,
        revealed: Math.min(total, state.seriesReveal.revealed + 1),
    };
}

export function closeSeriesReveal() {
    state.seriesReveal = null;
}

// ============================================================
// 群聊
// ============================================================

async function appendChat(channel, message) {
    const list = state.chats[channel] || [];
    const row = await dbx.saveChatMessage(appRef, state.career.saveId, {
        ...message,
        channel,
        seq: (list[list.length - 1]?.seq || 0) + 1,
        day: state.career.clock.day,
    });
    state.chats = { ...state.chats, [channel]: [...list, row] };
    return row;
}

/** 每天教练在群里发一条安排（确定性，零 token；晚间没打训练赛会催） */
async function ensureDailyCoachMessage() {
    const career = state.career;
    if (!career || !state.gState) return;
    const day = career.clock.day;
    const team = state.chats.team || [];
    const hasDaily = team.some((m) => m.day === day && m.kind === 'coach-daily');
    if (!hasDaily) {
        await appendChat('team', {
            senderId: 'coach',
            senderName: `${career.coach?.realName || '教练'}指导`,
            kind: 'coach-daily',
            text: COACH_DAILY_POOL[hashString(`coach::${career.saveId}::${day}`) % COACH_DAILY_POOL.length],
        });
    }
    const evening = (career.clock.minute || 0) >= 19 * 60;
    const hasNag = team.some((m) => m.day === day && m.kind === 'coach-nag');
    if (evening && !trainingDoneToday() && !hasNag) {
        await appendChat('team', {
            senderId: 'coach',
            senderName: `${career.coach?.realName || '教练'}指导`,
            kind: 'coach-nag',
            text: COACH_NAG_POOL[hashString(`nag::${career.saveId}::${day}`) % COACH_NAG_POOL.length],
        });
    }
}

function personasText(channel) {
    const career = state.career;
    const coach = career.coach
        ? `教练：${career.coach.realName}指导（${career.coach.style}，MBTI ${career.coach.mbti}，${asArray(career.coach.traits).join('；')}，小习惯：${career.coach.quirk}）`
        : '教练：一位严格但护短的老教练';
    if (channel === 'coach') return coach;
    const mates = asArray(career.teammates).map((p) => (
        `${p.gameId}（${p.posLabel}${p.isSub ? '·替补' : ''}，MBTI ${p.mbti}，${asArray(p.traits).join('；')}，对用户态度：${p.attitude}）`
    ));
    return [coach, ...mates].join('\n');
}

function todayFactsText() {
    const career = state.career;
    const bits = [];
    bits.push(`今天是这档生涯的第 ${career.clock.day} 天。`);
    if (trainingDoneToday() && state.gState?.lastTraining?.day === career.clock.day) {
        const t = state.gState.lastTraining;
        bits.push(`今日训练赛 vs ${t.oppName}：${t.wins}:${t.losses}。`);
    } else {
        bits.push('今天的训练赛还没打。');
    }
    const latest = state.sessions.find((s) => s.day === career.clock.day);
    if (latest) bits.push(`用户今天${latest.modeLabel}${latest.wins}胜${latest.losses}负（巅峰分 ${latest.ratingAfter}）。`);
    if (asArray(career.pendingSeries).length) bits.push('今天有正式比赛待出战。');
    return bits.join('\n');
}

export async function sendChat(channel, text) {
    const clean = String(text || '').trim();
    if (!clean || !state.career || state.loading.chat) return { ok: false };
    state.loading.chat = channel;
    try {
        await appendChat(channel, {
            senderId: 'user',
            senderName: state.career.gameId,
            kind: 'user',
            text: clean,
        });
        const { text: system } = buildChatReplyPrompt({
            career: state.career,
            channel,
            personas: personasText(channel),
            history: (state.chats[channel] || []).map((m) => ({ senderName: m.senderName, text: m.text })),
            userText: clean,
            todayFacts: todayFactsText(),
        });
        const result = await generateJson({ system, temperature: 0.95 });
        if (!result.ok) {
            return { ok: false, error: result.error };
        }
        for (const reply of asArray(result.data?.replies).slice(0, 3)) {
            const speaker = String(reply?.speaker || '').trim();
            const replyText = String(reply?.text || '').trim();
            if (!replyText) continue;
            await appendChat(channel, {
                senderId: speaker === '教练' ? 'coach' : `npc::${speaker}`,
                senderName: speaker === '教练' ? `${state.career.coach?.realName || '教练'}指导` : speaker,
                kind: 'npc',
                text: replyText,
            });
        }
        return { ok: true };
    } finally {
        state.loading.chat = '';
    }
}

/** 复盘（训练赛或最近一场正式赛） */
export async function startReview(opinion = '') {
    const career = state.career;
    if (!career || state.loading.review) return { ok: false };
    const t = state.gState?.lastTraining;
    let subject = '';
    if (t && t.day === career.clock.day) {
        subject = `今日训练赛 vs ${t.oppName}：${t.wins}:${t.losses}（${t.games.map((g) => `第${g.no}局${g.win ? '胜' : '负'}`).join('，')}）`;
    } else {
        const latest = state.sessions[0];
        if (latest) {
            subject = `${latest.modeLabel}：${latest.wins}胜${latest.losses}负，巅峰分 ${latest.ratingAfter}`;
        }
    }
    if (!subject) return { ok: false, error: '今天还没有可复盘的比赛' };

    state.loading.review = true;
    try {
        const { text: system } = buildReviewPrompt({
            career,
            personas: personasText('team'),
            subject,
            opinion,
        });
        const result = await generateJson({ system, temperature: 0.9 });
        if (!result.ok) return { ok: false, error: result.error };
        await appendChat('team', {
            senderId: 'system', senderName: '复盘', kind: 'system',
            text: `—— 复盘开始：${subject} ——`,
        });
        for (const reply of asArray(result.data?.replies).slice(0, 4)) {
            const speaker = String(reply?.speaker || '').trim();
            const replyText = String(reply?.text || '').trim();
            if (!replyText) continue;
            await appendChat('team', {
                senderId: speaker === '教练' ? 'coach' : `npc::${speaker}`,
                senderName: speaker === '教练' ? `${career.coach?.realName || '教练'}指导` : speaker,
                kind: 'npc',
                text: replyText,
            });
        }
        return { ok: true };
    } finally {
        state.loading.review = false;
    }
}

// ============================================================
// 对局回放（懒生成）
// ============================================================

export async function generateReplay(matchId) {
    const career = state.career;
    if (!career || state.loading.replay) return { ok: false };
    const matches = await dbx.listMatches(appRef, career.saveId);
    const match = matches.find((m) => m.id === matchId);
    if (!match) return { ok: false, error: '找不到这一局' };
    if (match.replay) return { ok: true, replay: match.replay };
    const session = state.sessions.find((s) => s.id === match.sessionId);
    state.loading.replay = matchId;
    try {
        const { text: system } = buildReplayPrompt({
            career,
            match,
            session: session || { modeLabel: match.modeLabel },
            companionsDesc: asArray(match.companions).map((c) => c.name).join('、'),
        });
        const result = await generateText({ system, temperature: 0.9 });
        if (!result.ok) return { ok: false, error: result.error };
        match.replay = tidyText(result.raw);
        await dbx.saveMatch(appRef, career.saveId, toPlain(match));
        return { ok: true, replay: match.replay };
    } finally {
        state.loading.replay = '';
    }
}

export async function matchesOfSession(sessionId) {
    if (!state.career) return [];
    return dbx.listMatches(appRef, state.career.saveId, sessionId);
}

// ============================================================
// 好友 / 亲密 / 情侣标 / 战绩围观
// ============================================================

export async function sendInvite(target, note = '') {
    const career = state.career;
    if (!career || target?.type !== 'ai') return { ok: false, error: '游戏邀请只能发给 AI 角色（发到 murmur 私聊）' };
    const record = await chatBridge.sendGameInvite({
        aiId: target.aiPersonId,
        gameName: career.gameName,
        modeLabel: '排位',
        note,
    });
    if (record) {
        await gainIntimacy(target, 1);
        showToast('邀请发到 murmur 了，去聊天里看 TA 的回复');
        return { ok: true };
    }
    return { ok: false, error: 'murmur 还没就绪' };
}

export async function bindCouple(targetId, tagName) {
    const row = relationOf(targetId);
    if (!row) return { ok: false, error: '还没有这个人的关系记录' };
    if (row.targetType !== 'ai') return { ok: false, error: '情侣标只能和 AI 角色绑' };
    if ((row.intimacy || 0) < COUPLE_TAG_GATE) {
        return { ok: false, error: `亲密值到 ${COUPLE_TAG_GATE} 才能绑（现在 ${row.intimacy || 0}）` };
    }
    row.coupleTag = {
        name: String(tagName || '').trim() || DEFAULT_COUPLE_TAG,
        sinceDay: state.career.clock.day,
    };
    const saved = await dbx.saveRelation(appRef, state.career.saveId, toPlain(row));
    state.relations = [...state.relations.filter((r) => r.id !== saved.id), saved];
    syncMurmur();
    showToast(`情侣标「${row.coupleTag.name}」戴上了`);
    return { ok: true };
}

export async function unbindCouple(targetId) {
    const row = relationOf(targetId);
    if (!row?.coupleTag) return;
    row.coupleTag = null;
    row.intimacy = clamp((row.intimacy || 0) - COUPLE_UNBIND_COST, 0, INTIMACY_MAX);
    const saved = await dbx.saveRelation(appRef, state.career.saveId, toPlain(row));
    state.relations = [...state.relations.filter((r) => r.id !== saved.id), saved];
    syncMurmur();
    showToast('情侣标摘了（亲密值掉了一截）');
}

/** 生成某人今日战绩（确定性揭示；具体对局内容看不到） */
export async function revealDailyRecord(person) {
    const career = state.career;
    if (!career) return null;
    const day = career.clock.day;
    const record = rankEngine.dailyRecordFor({
        profileKey: career.profileKey,
        person,
        day,
        model: model(),
    });
    const gs = state.gState;
    gs.recordSeen = { ...(gs.recordSeen || {}), [`${person.id}::${day}`]: true };
    await dbx.saveState(appRef, gs);
    return record;
}

export function recordSeen(personId) {
    const day = state.career?.clock?.day || 1;
    return Boolean(state.gState?.recordSeen?.[`${personId}::${day}`]);
}

export async function shareSession(aiTarget, session, note) {
    const record = await chatBridge.shareSessionToChat({
        aiId: aiTarget.aiPersonId, gameName: state.career.gameName, session, note,
    });
    showToast(record ? '分享到 murmur 了' : 'murmur 还没就绪');
    return Boolean(record);
}

export async function shareMatch(aiTarget, match, modeLabel, note) {
    const record = await chatBridge.shareMatchToChat({
        aiId: aiTarget.aiPersonId, gameName: state.career.gameName, match, modeLabel, note,
    });
    showToast(record ? '分享到 murmur 了' : 'murmur 还没就绪');
    return Boolean(record);
}

export async function shareRecord(aiTarget, record, note) {
    const row = await chatBridge.shareRecordToChat({
        aiId: aiTarget.aiPersonId, gameName: state.career.gameName, record, note,
    });
    showToast(row ? '分享到 murmur 了' : 'murmur 还没就绪');
    return Boolean(row);
}

// ============================================================
// 练习
// ============================================================

export async function setFocusHero(heroName) {
    const gs = state.gState;
    if (!gs) return;
    gs.focusHero = String(heroName || '');
    await dbx.saveState(appRef, gs);
    showToast(gs.focusHero ? `本命练习：${gs.focusHero}` : '取消了本命练习');
}

// ============================================================
// pendingSync
// ============================================================

export async function retrySync() {
    const gs = state.gState;
    if (!gs || !asArray(gs.pendingSync).length) return;
    const remain = [];
    for (const item of gs.pendingSync) {
        let ok = false;
        if (item.kind === 'rank-session') {
            const result = await bridge.recordRankSession(item.payload);
            ok = Boolean(result?.ok);
        }
        if (!ok) remain.push(item);
    }
    gs.pendingSync = remain;
    await dbx.saveState(appRef, gs);
    if (!remain.length) return;
    console.warn(`[esports-game] 还有 ${remain.length} 条待同步声浪`);
}

// ============================================================
// 主题
// ============================================================

function applyThemeFromState() {
    try {
        const raw = localStorage.getItem(LS_THEME_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                state.theme = { id: parsed.id || 'nighttrain', custom: parsed.custom || {} };
            }
        }
    } catch (_) { /* 坏数据当没有 */ }
    if (themeApplier) themeApplier(state.theme.id, state.theme.custom);
}

export async function setTheme(id) {
    state.theme = { ...state.theme, id };
    try { localStorage.setItem(LS_THEME_KEY, JSON.stringify(toPlain(state.theme))); } catch (_) { /* noop */ }
    if (themeApplier) themeApplier(state.theme.id, state.theme.custom);
}

export async function setCustomColors(colors) {
    state.theme = { ...state.theme, custom: { ...(colors || {}) } };
    try { localStorage.setItem(LS_THEME_KEY, JSON.stringify(toPlain(state.theme))); } catch (_) { /* noop */ }
    if (themeApplier) themeApplier(state.theme.id, state.theme.custom);
}

// ============================================================
// murmur 同游卡
// ============================================================

export function syncMurmur() {
    const toolkit = appRef?.toolkit;
    if (!toolkit || !state.career) return;
    const spec = buildCoopSummarySpec({
        saveId: state.career.saveId,
        gameName: state.career.gameName,
        sessions: state.sessions,
        relations: state.relations,
    });
    syncCoopPrompt(toolkit, spec, state.career.saveId);
}

export function flushPersist() {
    if (state.gState) void dbx.saveState(appRef, toPlain(state.gState));
}
