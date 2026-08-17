/**
 * 追光 · 状态单例
 *
 * 一份 Vue.reactive，所有组件读它、通过这里的 mutator 改它。
 *
 * ── 存档模型 ──────────────────────────────────────────────────────
 * 档案键（用户+世界）下有一份 profile（30 NPC 名册 / 奖项 / 节日 / 人设改写台账），
 * 和任意多个「档」（save）。同一档案键的所有档共享 30 人名册；
 * 新开档 = 时间线回到原点 + 属性按首配重置 + 可选回收本档案的人设改写；
 * 阶段卡跨档保留。
 *
 * ── AI 调用边界 ───────────────────────────────────────────────────
 * 掷签、概率、结算全部 JS 本地：突发事件、试镜、演出成色、奖项都不调 AI。
 * 只有这些动作调 AI（全部用户主动触发）：
 *   生成剧本 / 演绎一场戏 / 快进区间叙事 / 阶段结算五块 / NPC 聊一句 / 生成结局。
 * 阶段结算与演出**没有重 roll**。
 */

import {
    ACTIVITIES, ATTR_MAX, DAY_END_MINUTE, ENERGY_MAX, EVENT_KINDS, PROJECT_TYPES,
    REPEAT_DECAY, ROLE_LEVELS, SETTLEMENT_BLOCKS, SETTLEMENT_DELTA_CAP,
    FAST_FORWARD_DELTA_CAP, tierSpec,
} from './constants.js';
import {
    asArray, clamp, craftScore, hashString, seededRandom, tidyText, toPlain, uid,
} from './utils.js';
import * as dbx from './services/db.js';
import * as world from './services/world-context.js';
import * as clockSvc from './services/clock.js';
import * as npcEngine from './services/npc-engine.js';
import * as eventEngine from './services/event-engine.js';
import * as career from './services/career-engine.js';
import * as money from './services/salary.js';
import * as dream from './services/dream-bridge.js';
import { generateJson, generateText } from './services/ai.js';
import {
    buildEndingPrompt, buildEventScenePrompt, buildFastForwardPrompt,
    buildNpcChatPrompt, buildScenePrompt, buildScriptPrompt, buildSettlementBlockPrompt,
} from './services/prompt-builder.js';
import { syncCareerPrompt } from './services/app-prompts.js';
import { registerEncounteredCharacter } from '@/src/core/world-profile.js';

const Vue = typeof window !== 'undefined' ? window.Vue : null;
const reactive = (o) => (Vue?.reactive ? Vue.reactive(o) : o);

const state = reactive({
    ready: false,
    /** 拦截：'' 可用；否则显示拦截文案 */
    blocked: '',
    needsConfig: false,

    identity: {
        ready: false, userId: '', userName: '我', userAvatar: '',
        worldId: '', worldName: '', profileKey: '', isActorWorld: false, currency: '元',
    },

    profile: null,
    saves: [],
    save: null,

    projects: [],
    events: [],
    timeline: [],
    todaySchedule: null,
    stageCards: [],
    npcChat: { npcId: '', messages: [] },
    balance: 0,
    routine: { configured: true, rhythm: '' },

    tab: 'today',
    /** 覆盖页：'' | project | npc | saves | theme | prompts | ending | stagecards | anchors | risk */
    view: '',
    viewPayload: null,

    /** 弹窗：{ type: 'event'|'next-day'|'fast-forward'|'persona-sync'|'confirm'|'award'|'settlement'|'new-save'|'ai-persona-diff', ... } */
    modal: null,

    /** 阶段结算运行态（多块串行） */
    settlementRun: null,

    loading: {
        hydrate: false, script: false, scene: '', fastForward: false,
        settlement: false, npcReply: false, ending: false, register: '',
    },
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
// hydrate / 档案键切换
// ============================================================

export async function hydrate(app) {
    if (app) appRef = app;
    if (!appRef || state.loading.hydrate) return;
    state.loading.hydrate = true;
    try {
        await recheckIdentity();
    } finally {
        state.loading.hydrate = false;
        state.ready = true;
    }
}

export async function recheckIdentity() {
    const identity = world.readIdentity();
    state.identity = {
        ready: identity.ready,
        userId: identity.userId,
        userName: identity.userName,
        userAvatar: identity.userAvatar,
        worldId: identity.worldId,
        worldName: identity.worldName,
        profileKey: identity.profileKey || '',
        isActorWorld: identity.isActorWorld,
        currency: identity.currency,
    };

    if (!identity.ready) {
        state.blocked = '追光需要默认用户明确绑定一个世界观。去设置里绑定后回来。';
        return;
    }
    if (!identity.isActorWorld) {
        state.blocked = '这个世界观不是演员模式。把世界的体验模式设为「演员」后，追光会自动出现。';
        return;
    }
    state.blocked = '';

    const key = identity.profileKey;
    if (state.profile?.id === key && state.save) {
        await refreshBalance();
        await syncClockWithReal();
        return;
    }

    // 换档案键：整份换掉
    const profile = await dbx.loadProfile(appRef, key);
    state.profile = profile;
    state.needsConfig = !profile?.configured;
    state.saves = await dbx.listSaves(appRef, key);
    state.save = null;
    state.projects = [];
    state.events = [];
    state.timeline = [];
    state.todaySchedule = null;
    state.stageCards = await dbx.listStageCards(appRef, key);

    if (profile?.configured) {
        const targetId = profile.activeSaveId || state.saves[0]?.id;
        if (targetId) await loadSaveIntoState(targetId);
    }
    await refreshBalance();
    applyThemeFromProfile();
}

async function refreshBalance() {
    state.balance = money.userBalance(state.identity.userId);
}

function applyThemeFromProfile() {
    if (themeApplier && state.profile) {
        themeApplier(state.profile.themeId || 'stage', state.profile.customColors || {});
    }
}

// ============================================================
// 首次配置
// ============================================================

/**
 * @param {object} setup {
 *   stageName, agencyStatus, genres[], style, goal, representativeWork,
 *   startTier, attrs（含 fame 锁定值）, awards[], festivals[], saveName
 * }
 */
export async function completeSetup(setup = {}) {
    const key = state.identity.profileKey;
    if (!key) return { ok: false, error: '档案键还没就绪' };

    const tier = clamp(setup.startTier, 1, 18);
    const check = career.validateAllocation(setup.attrs || {}, tier);
    if (!check.ok) return { ok: false, error: check.error };

    const profile = {
        ...dbx.makeProfile(key),
        ...(state.profile || {}),
        id: key,
        profileKey: key,
        configured: true,
        setupVersion: 1,
        stageName: String(setup.stageName || '').trim() || state.identity.userName,
        agencyStatus: String(setup.agencyStatus || '').trim(),
        genres: asArray(setup.genres).map((g) => String(g)),
        style: String(setup.style || '').trim(),
        goal: String(setup.goal || '').trim(),
        representativeWork: String(setup.representativeWork || '').trim(),
        startTier: tier,
        npcRoster: state.profile?.npcRoster?.length
            ? state.profile.npcRoster
            : npcEngine.generateRoster(key),
        awards: asArray(setup.awards).length ? setup.awards : career.defaultAwardConfig(),
        festivals: asArray(setup.festivals).length ? setup.festivals : career.defaultFestivalConfig(),
    };

    const save = dbx.makeSave(key, {
        name: String(setup.saveName || '').trim() || career.newSaveName(0),
        tier,
        attrs: { ...setup.attrs, fame: tierSpec(tier).fameBase },
        clock: clockSvc.createClock(),
        npcActiveIds: npcEngine.defaultActiveIds(profile.npcRoster),
    });
    profile.activeSaveId = save.id;

    await dbx.saveProfile(appRef, profile);
    await dbx.saveSave(appRef, save);

    state.profile = await dbx.loadProfile(appRef, key);
    state.saves = await dbx.listSaves(appRef, key);
    state.needsConfig = false;

    await loadSaveIntoState(save.id);
    await grantStartFunds(save);
    await pushTimeline({
        day: 1, title: `以${tierSpec(tier).label}演员的身份入行`,
        detail: profile.goal ? `目标：${profile.goal}` : '', kind: 'milestone', major: true,
    });
    showToast('生涯开始了');
    return { ok: true };
}

async function grantStartFunds(save) {
    const spec = tierSpec(save.tier);
    const amount = Math.round(spec.dayPay * 10);
    const result = await money.grantIncome({
        userId: state.identity.userId,
        amount,
        sourceType: 'actor-start',
        sourceId: save.id,
        note: `开档安家费（${spec.label}）`,
        counterpartyName: '经纪公司',
    });
    if (result.ok && !result.duplicated) {
        showToast(`经纪公司打来了 ${amount} ${state.identity.currency} 安家费`);
    }
    await refreshBalance();
}

// ============================================================
// 存档系统
// ============================================================

async function loadSaveIntoState(saveId) {
    const save = await dbx.getSave(appRef, saveId);
    if (!save) return;
    state.save = save;
    state.projects = await dbx.listProjects(appRef, saveId);
    state.events = await dbx.listEvents(appRef, saveId);
    state.timeline = await dbx.listTimeline(appRef, saveId);
    state.todaySchedule = await dbx.loadSchedule(appRef, saveId, save.clock?.day || 1)
        || { day: save.clock?.day || 1, entries: [] };
    state.npcChat = { npcId: '', messages: [] };
    state.routine = world.readUserRoutine();

    save.lastPlayedAt = Date.now();
    await dbx.saveSave(appRef, save);
    if (state.profile && state.profile.activeSaveId !== saveId) {
        state.profile.activeSaveId = saveId;
        await dbx.saveProfile(appRef, toPlain(state.profile));
    }
    await syncClockWithReal();
    syncMurmur();
    await checkAiNpcPersonaDiff();
}

export async function switchSave(saveId) {
    if (!saveId || saveId === state.save?.id) return;
    await loadSaveIntoState(saveId);
    state.saves = await dbx.listSaves(appRef, state.identity.profileKey);
    showToast(`已读档：${state.save?.name || ''}`);
}

/**
 * 新开一档。
 * @param {object} opts { name, resetPersonaWrites: boolean }
 * 时间线回到原点（anchorMs = 现在）；属性按首配重置；
 * resetPersonaWrites 时回收其他档写进人设的经历行；阶段卡不删。
 */
export async function createSave(opts = {}) {
    const profile = state.profile;
    if (!profile?.configured) return { ok: false, error: '先完成首次配置' };

    if (opts.resetPersonaWrites) {
        await resetPersonaWrites();
    }

    const tier = profile.startTier;
    const base = career.suggestAllocation(tier, profile.id);
    const attrs = opts.attrs && Object.keys(opts.attrs).length ? { ...opts.attrs } : base;
    attrs.fame = tierSpec(tier).fameBase;

    const save = dbx.makeSave(profile.id, {
        name: String(opts.name || '').trim() || career.newSaveName(state.saves.length),
        tier,
        attrs,
        clock: clockSvc.createClock(),
        npcActiveIds: npcEngine.defaultActiveIds(profile.npcRoster),
    });
    await dbx.saveSave(appRef, save);
    state.saves = await dbx.listSaves(appRef, profile.id);
    await loadSaveIntoState(save.id);
    await grantStartFunds(save);
    await pushTimeline({
        day: 1, title: '新的一档人生开始了', detail: '时间线回到原点', kind: 'milestone', major: false,
    });
    showToast('新档已开');
    return { ok: true };
}

export async function deleteSave(saveId) {
    const target = state.saves.find((s) => s.id === saveId);
    if (!target) return;
    // 回收写进世界观时间轴的事件
    await world.removeWorldTimelineEvents(state.identity.worldId, target.worldTimelineIds || []);
    await dbx.purgeSaveData(appRef, saveId);
    await dbx.removeSave(appRef, saveId);
    state.saves = await dbx.listSaves(appRef, state.identity.profileKey);
    if (state.save?.id === saveId) {
        state.save = null;
        const next = state.saves[0];
        if (next) await loadSaveIntoState(next.id);
    }
    showToast('档已删除');
}

/** 回收「本档案键下所有档」写进 nook 人设的经历行 */
async function resetPersonaWrites() {
    const writes = asArray(state.profile?.personaWrites);
    if (!writes.length) return;
    const byTarget = new Map();
    for (const w of writes) {
        const key = `${w.entityType}::${w.entityId}`;
        if (!byTarget.has(key)) byTarget.set(key, []);
        byTarget.get(key).push(w.line);
    }
    for (const [key, lines] of byTarget) {
        const [entityType, entityId] = key.split('::');
        await world.removePersonaExperienceLines(entityType, entityId, lines);
    }
    state.profile.personaWrites = [];
    await dbx.saveProfile(appRef, toPlain(state.profile));
    showToast('已回收本档案对人设的改写');
}

// ============================================================
// 时钟
// ============================================================

async function persistSave() {
    if (!state.save) return;
    await dbx.saveSave(appRef, toPlain(state.save));
}

/** 与现实同步的档：把现实钟点带进来；现实跨日则询问是否进入新一天 */
async function syncClockWithReal() {
    const save = state.save;
    if (!save?.clock?.syncReal) return;
    const { clock, crossedRealDay, realDayKey } = clockSvc.syncToRealTime(save.clock);
    save.clock = clock;
    if (crossedRealDay) {
        save.clock = { ...save.clock, lastRealDayKey: realDayKey };
        openModal({ type: 'next-day', reason: 'real-day-crossed' });
    }
    await persistSave();
}

export async function setDaySlot(slotId) {
    if (!state.save) return;
    state.save.clock = clockSvc.setSlot(state.save.clock, slotId);
    await persistSave();
}

export async function toggleSyncReal(on) {
    if (!state.save) return;
    state.save.clock = clockSvc.setSyncReal(state.save.clock, on);
    await persistSave();
    showToast(on ? '已与现实时间同步' : '已切为手动时间');
}

export function requestNextDay() {
    openModal({ type: 'next-day', reason: 'manual' });
}

export async function confirmNextDay() {
    closeModal();
    if (!state.save) return;
    state.save.clock = clockSvc.nextDay(state.save.clock);
    state.save.energy = clamp((state.save.energy ?? 100) + 45, 0, ENERGY_MAX);
    await persistSave();
    await onDayArrived();
}

/** 每天到来时的结算：掷事件、开奖、节日公告、隐藏 NPC 揭示 */
async function onDayArrived() {
    const save = state.save;
    if (!save) return;
    const day = save.clock.day;

    // 1. 掷突发事件
    const rolled = eventEngine.rollDailyEvents(save.id, day, {
        tier: save.tier,
        attrs: save.attrs,
        day,
        shieldUntilDay: save.shieldUntilDay,
        energy: save.energy,
        hasProject: state.projects.some((p) => p.status === 'shooting'),
        triggeredOnceIds: save.triggeredOnceIds,
        lastTriggeredDayById: save.lastTriggeredDayById,
    });
    for (const { def, p } of rolled) {
        await triggerEvent(def, p, day);
    }

    // 2. 奖项开奖（段锚点）
    for (const award of career.dueAwards(state.profile?.awards, day)) {
        await settleAward(award, day);
    }

    // 3. 节日公告（点锚点）
    for (const fest of career.dueFestivals(state.profile?.festivals, day)) {
        await dbx.saveEvent(appRef, state.identity.profileKey, save.id, {
            type: 'announce', kind: 'festival', title: fest.name,
            body: fest.desc, day, resolved: true,
        });
        await pushTimeline({ day, title: fest.name, detail: fest.desc, kind: 'festival', major: false });
    }

    // 4. 隐藏 NPC 揭示
    const rand = seededRandom(hashString(`${save.id}::reveal::${day}`));
    const revealNpc = npcEngine.checkHiddenReveal(
        allNpcs(), { ...toPlain(save), craft: craftScore(save.attrs) }, rand(),
    );
    if (revealNpc) {
        save.revealedNpcIds = [...(save.revealedNpcIds || []), revealNpc.id];
        if (!save.npcActiveIds.includes(revealNpc.id)) save.npcActiveIds.push(revealNpc.id);
        await dbx.saveEvent(appRef, state.identity.profileKey, save.id, {
            type: 'announce', kind: 'hidden', title: '有个神秘的人注意到了你',
            body: `${revealNpc.name}（${revealNpc.occupation}）出现在了你的圈子里。`, day, resolved: true,
        });
        showToast('圈子里出现了一个神秘的人');
    }

    await persistSave();
    state.events = await dbx.listEvents(appRef, save.id);
    state.timeline = await dbx.listTimeline(appRef, save.id);
    state.todaySchedule = await dbx.loadSchedule(appRef, save.id, day) || { day, entries: [] };
    syncMurmur();
}

async function triggerEvent(def, p, day) {
    const save = state.save;
    save.lastTriggeredDayById = { ...(save.lastTriggeredDayById || {}), [def.id]: day };
    if (def.once) save.triggeredOnceIds = [...(save.triggeredOnceIds || []), def.id];

    let encounterNpc = null;
    if (def.isEncounter) {
        encounterNpc = npcEngine.pickEncounterNpc(
            allNpcs(), save.npcActiveIds || [], save.chattedNpcIds || [], `${save.id}::${day}::${def.id}`,
        );
    }

    const row = await dbx.saveEvent(appRef, state.identity.profileKey, save.id, {
        type: 'event', kind: def.kind, defId: def.id,
        title: def.title, body: def.desc, day,
        chance: Math.round(p * 1000) / 10,
        resolved: !(def.options && def.options.length),
        npcId: encounterNpc?.id || '',
        npcName: encounterNpc?.name || '',
    });

    // 无选项事件直接结算默认效果
    if (!(def.options && def.options.length)) {
        await applyEventEffects(def.autoEffects, `${def.id}::auto::${day}`);
        if (def.kind === 'scandal' || def.kind === 'hidden' || def.kind === 'industry') {
            await pushTimeline({ day, title: def.title, detail: def.autoEffects?.note || def.desc, kind: 'event', major: def.kind !== 'industry' });
        }
    } else {
        openModal({ type: 'event', eventId: row.id, defId: def.id });
    }
}

function allNpcs() {
    return [...asArray(state.profile?.npcRoster), ...asArray(state.save?.npcExtra)];
}

async function applyEventEffects(effects = {}, seedText = '') {
    const save = state.save;
    if (!save || !effects) return { changes: [] };
    let note = effects.note || '';

    // 赌博分支
    if (effects.gamble) {
        const { win, outcome } = eventEngine.resolveGamble(effects.gamble, `${save.id}::${seedText}`);
        note = outcome.note || (win ? '赌赢了' : '赌输了');
        if (outcome.attrs) {
            const { attributes, changes } = career.settleAttrDeltas(save.attrs, outcome.attrs);
            save.attrs = attributes;
            await persistSave();
            return { changes, note };
        }
        await persistSave();
        return { changes: [], note };
    }

    let changes = [];
    if (effects.attrs && Object.keys(effects.attrs).length) {
        const settled = career.settleAttrDeltas(save.attrs, effects.attrs);
        save.attrs = settled.attributes;
        changes = settled.changes;
    }
    if (effects.energy) {
        save.energy = clamp((save.energy ?? 100) + effects.energy, 0, ENERGY_MAX);
    }
    await persistSave();
    return { changes, note };
}

/** 事件弹窗里选择处理方式 */
export async function resolveEventOption(eventLogId, optionId) {
    const save = state.save;
    const row = state.events.find((e) => e.id === eventLogId);
    const def = eventEngine.eventDefById(row?.defId);
    if (!save || !row || !def) return;
    const option = (def.options || []).find((o) => o.id === optionId);
    if (!option) return;

    // 花钱的选项先扣款
    if (option.costKind) {
        const spec = tierSpec(save.tier);
        const amount = option.costKind === 'bigMoney' ? spec.prCost * 6 : spec.prCost;
        const paid = option.costKind === 'bigMoney'
            ? await money.chargeEventCost({ userId: state.identity.userId, amount, sourceId: `${row.id}::${optionId}`, note: `${def.title}：${option.label}` })
            : await money.chargePr({ userId: state.identity.userId, amount, sourceId: `${row.id}::${optionId}`, note: `${def.title}：${option.label}` });
        if (!paid.ok) {
            showToast(paid.error || '余额不足');
            return;
        }
        await refreshBalance();
    }

    const { note } = await applyEventEffects(option.effects, `${row.id}::${optionId}`);

    row.resolved = true;
    row.choice = option.label;
    row.outcome = note || option.effects?.note || '';
    await dbx.saveEvent(appRef, state.identity.profileKey, save.id, toPlain(row));
    state.events = await dbx.listEvents(appRef, save.id);

    if (def.kind === 'scandal' || def.kind === 'hidden') {
        await pushTimeline({
            day: row.day, title: def.title,
            detail: `处理：${option.label}${row.outcome ? ` —— ${row.outcome}` : ''}`,
            kind: 'event', major: true,
        });
        await proposePersonaWrite(`经历过「${def.title}」事件，选择了${option.label}。`);
    }
    closeModal();
    syncMurmur();
}

/** 买断黑料：公关护盾 14 天 */
export async function buyPrShield() {
    const save = state.save;
    if (!save) return;
    const spec = tierSpec(save.tier);
    const day = save.clock.day;
    const paid = await money.chargePr({
        userId: state.identity.userId,
        amount: spec.prCost,
        sourceId: `${save.id}::shield::${day}`,
        note: `买断黑料（护盾至第 ${day + 14} 天）`,
    });
    if (!paid.ok) {
        showToast(paid.error || '余额不足');
        return;
    }
    save.shieldUntilDay = day + 14;
    await persistSave();
    await refreshBalance();
    showToast('黑料买断了，接下来两周清净些');
}

// ============================================================
// 快进
// ============================================================

export async function fastForwardDays(days, opinion = '') {
    const save = state.save;
    if (!save || state.loading.fastForward) return { ok: false };
    const n = clamp(days, 1, 90);
    state.loading.fastForward = true;
    try {
        // 1. JS 先掷这段时间的事件（压缩：每天照掷，只保留触发的）
        const rolledEvents = [];
        for (let d = save.clock.day + 1; d <= save.clock.day + n; d += 1) {
            const rolled = eventEngine.rollDailyEvents(save.id, d, {
                tier: save.tier, attrs: save.attrs, day: d,
                shieldUntilDay: save.shieldUntilDay, energy: 80,
                hasProject: state.projects.some((p) => p.status === 'shooting'),
                triggeredOnceIds: save.triggeredOnceIds,
                lastTriggeredDayById: save.lastTriggeredDayById,
            });
            for (const { def } of rolled) {
                rolledEvents.push({ day: d, title: def.title, defId: def.id });
                save.lastTriggeredDayById = { ...(save.lastTriggeredDayById || {}), [def.id]: d };
                if (def.once) save.triggeredOnceIds = [...(save.triggeredOnceIds || []), def.id];
            }
        }

        // 2. AI 生成这段时间的合理经历
        const { text } = buildFastForwardPrompt({
            identity: state.identity, profile: state.profile, save: toPlain(save),
            timeline: state.timeline, days: n, rolledEvents, opinion,
        });
        const result = await generateJson({ system: text, temperature: 0.85 });

        // 3. 推进时钟（AI 失败也要推进 —— 时间是系统真相，叙事只是锦上添花）
        save.clock = clockSvc.fastForward(save.clock, n);
        save.energy = ENERGY_MAX;

        let narrative = '';
        if (result.ok && result.data) {
            narrative = tidyText(String(result.data.narrative || ''));
            const deltas = result.data.attrDeltas || {};
            const settled = career.settleAttrDeltas(save.attrs, deltas, FAST_FORWARD_DELTA_CAP);
            save.attrs = settled.attributes;
            for (const ev of asArray(result.data.timelineEvents).slice(0, 4)) {
                const day = save.clock.day - n + clamp(ev.dayOffset, 1, n);
                await pushTimeline({
                    day, title: String(ev.title || '一段经历'),
                    detail: String(ev.detail || ''), kind: 'skip', major: false,
                });
            }
        }
        for (const ev of rolledEvents) {
            await dbx.saveEvent(appRef, state.identity.profileKey, save.id, {
                type: 'event', kind: 'skip', defId: ev.defId, title: ev.title,
                body: '（快进区间内发生）', day: ev.day, resolved: true,
            });
        }
        await pushTimeline({
            day: save.clock.day,
            title: `快进了 ${n} 天`,
            detail: narrative ? narrative.slice(0, 120) : '这段时间平静地过去了',
            kind: 'skip', major: false,
        });

        await persistSave();
        state.events = await dbx.listEvents(appRef, save.id);
        state.timeline = await dbx.listTimeline(appRef, save.id);
        state.todaySchedule = await dbx.loadSchedule(appRef, save.id, save.clock.day) || { day: save.clock.day, entries: [] };
        closeModal();
        syncMurmur();
        showToast(`时间快进了 ${n} 天`);
        return { ok: true, narrative, aiError: result.ok ? '' : result.error };
    } finally {
        state.loading.fastForward = false;
    }
}

// ============================================================
// 日程 / 活动
// ============================================================

export function activityCatalog() {
    const save = state.save;
    const fame = clamp(save?.attrs?.fame, 0, 100);
    return ACTIVITIES.map((a) => ({
        ...a,
        locked: (a.minFame && fame < a.minFame)
            || (a.needsProject && !state.projects.some((p) => p.status === 'shooting')),
        lockReason: a.minFame && fame < a.minFame
            ? `知名度需 ${a.minFame}`
            : (a.needsProject ? '需要进行中的项目' : ''),
    }));
}

/** 安排一件活动：立即消耗时长、结算效果（同课重复递减） */
export async function doActivity(activityId) {
    const save = state.save;
    const activity = ACTIVITIES.find((a) => a.id === activityId);
    if (!save || !activity) return;

    if (activity.needsProject && !state.projects.some((p) => p.status === 'shooting')) {
        showToast('没有进行中的项目');
        return;
    }
    const remainMin = DAY_END_MINUTE - save.clock.minute;
    if (activity.hours * 60 > remainMin) {
        showToast('今天剩下的时间不够了');
        return;
    }
    if ((save.energy ?? 100) + (activity.energy || 0) < 0) {
        showToast('精力见底了，先休息一下');
        return;
    }

    const day = save.clock.day;
    const schedule = state.todaySchedule?.day === day
        ? state.todaySchedule
        : (await dbx.loadSchedule(appRef, save.id, day)) || { day, entries: [] };

    // 同类课程重复递减
    const repeatCount = asArray(schedule.entries).filter((e) => e.activityId === activity.id).length;
    const decay = Math.pow(REPEAT_DECAY, repeatCount);

    const effects = {};
    for (const [key, value] of Object.entries(activity.effects || {})) {
        const applied = Math.round(value * decay * 10) / 10;
        if (applied) effects[key] = applied;
    }

    const { clock, hitMidnight } = clockSvc.advanceMinutes(save.clock, activity.hours * 60);
    save.clock = clock;
    save.energy = clamp((save.energy ?? 100) + (activity.energy || 0), 0, ENERGY_MAX);

    let settledChanges = [];
    if (Object.keys(effects).length) {
        const settled = career.settleAttrDeltas(save.attrs, effects);
        save.attrs = settled.attributes;
        settledChanges = settled.changes;
    }

    // 综艺通告费
    let payNote = '';
    if (activity.pay) {
        const spec = tierSpec(save.tier);
        const amount = Math.round(spec.dayPay * 1.5);
        const paid = await money.grantIncome({
            userId: state.identity.userId, amount,
            sourceType: 'actor-variety',
            sourceId: `${save.id}::variety::${day}::${asArray(schedule.entries).length}`,
            note: `综艺通告费（第${day}天）`,
            counterpartyName: '节目组',
        });
        if (paid.ok && !paid.duplicated) payNote = `+${amount} ${state.identity.currency}`;
        await refreshBalance();
    }

    // 交际活动可能带出 NPC 偶遇
    let encounterNote = '';
    if (activity.encounter) {
        const rand = seededRandom(hashString(`${save.id}::party::${day}::${asArray(schedule.entries).length}`));
        if (rand() < 0.55) {
            const npc = npcEngine.pickEncounterNpc(
                allNpcs(), save.npcActiveIds || [], save.chattedNpcIds || [], `${save.id}::party::${day}`,
            );
            if (npc) {
                encounterNote = `遇到了 ${npc.name}（${npc.occupation}）`;
                await dbx.saveEvent(appRef, state.identity.profileKey, save.id, {
                    type: 'event', kind: 'social', title: '酒会偶遇',
                    body: `在${activity.label}上${encounterNote}，可以去圈子里找 TA 聊聊。`,
                    day, resolved: true, npcId: npc.id, npcName: npc.name,
                });
            }
        }
    }

    schedule.entries = [...asArray(schedule.entries), {
        id: uid('act'),
        activityId: activity.id,
        label: activity.label,
        hours: activity.hours,
        startMinute: save.clock.minute - activity.hours * 60,
        effects,
        decayApplied: repeatCount > 0,
        payNote,
        encounterNote,
    }];
    await dbx.saveSchedule(appRef, state.identity.profileKey, save.id, day, schedule);
    state.todaySchedule = { ...schedule };
    await persistSave();

    const gainText = settledChanges
        .filter((c) => c.applied !== 0)
        .map((c) => `${c.key} ${c.applied > 0 ? '+' : ''}${c.applied}`).join(' ');
    showToast([activity.label, gainText, payNote, encounterNote].filter(Boolean).join(' · '));

    if (hitMidnight) {
        openModal({ type: 'next-day', reason: 'midnight' });
    }
    state.events = await dbx.listEvents(appRef, save.id);
}

// ============================================================
// 项目 / 剧本
// ============================================================

export async function listDreamBooksForPick() {
    return dream.listDreamBooks();
}

/**
 * 生成剧本（来源：'dream' 带 bookId / 'ai' 纯生成）。
 * AI 只出剧本与角色建议，试镜结果由 JS resolveContest 决定。
 */
export async function generateScript({ sourceKind, bookId, opinion } = {}) {
    const save = state.save;
    if (!save || state.loading.script) return { ok: false };
    state.loading.script = true;
    try {
        let source = null;
        if (sourceKind === 'dream' && bookId) {
            const pulled = await dream.getAdaptationSource(bookId);
            if (!pulled.ok) return { ok: false, error: pulled.error };
            source = pulled.source;
        }
        const { text } = buildScriptPrompt({
            identity: state.identity, profile: state.profile, save: toPlain(save),
            timeline: state.timeline, clips: world.listClips(), source, opinion,
        });
        const result = await generateJson({ system: text, temperature: 0.95 });
        if (!result.ok) return { ok: false, error: result.error };

        const data = result.data || {};
        const type = PROJECT_TYPES.find((t) => t.id === data.type) ? data.type : 'drama';
        const chapters = asArray(data.chapters).slice(0, 6).map((c, i) => ({
            index: i,
            title: String(c.title || `第${i + 1}章`),
            summary: String(c.summary || ''),
        }));
        const project = {
            id: uid('proj'),
            title: String(data.title || '未命名剧目'),
            type,
            synopsis: String(data.synopsis || ''),
            roleName: String(data.roleName || ''),
            roleDesc: String(data.roleDesc || ''),
            difficulty: clamp(data.difficulty, 40, 85),
            chapters,
            scenes: chapters.map((c, i) => ({
                index: i, title: c.title, summary: c.summary, done: false,
            })),
            source,
            roleLevel: '',
            status: 'draft',            // draft → cast → shooting → wrapped → aired
            performRecords: [],
            payment: null,
            airing: null,
        };
        await dbx.saveProject(appRef, state.identity.profileKey, save.id, project);
        state.projects = await dbx.listProjects(appRef, save.id);
        return { ok: true, projectId: project.id };
    } finally {
        state.loading.script = false;
    }
}

export function reachableRoleLevels() {
    return state.save ? career.reachableRoles(toPlain(state.save)) : ROLE_LEVELS;
}

/** 试镜（seed 存盘可回放；失败也留下记录，剧情可以继续） */
export async function auditionForRole(projectId, roleLevelId) {
    const save = state.save;
    const project = state.projects.find((p) => p.id === projectId);
    if (!save || !project) return { ok: false };

    save.auditionCount = (save.auditionCount || 0) + 1;
    const { seed, role, result } = career.audition(toPlain(save), roleLevelId, project.difficulty);

    project.auditionRecord = {
        seed, roleLevelId, at: Date.now(), day: save.clock.day,
        chance: result.chance, roll: result.roll, success: result.success, grade: result.grade,
        modifiers: result.modifiers,
    };
    if (result.success) {
        project.roleLevel = roleLevelId;
        project.status = 'cast';
        showToast(`试镜通过：${role.label}`);
        await pushTimeline({
            day: save.clock.day, title: `试镜《${project.title}》拿下${role.label}`,
            detail: `成功率 ${Math.round(result.chance * 100)}%`, kind: 'work', major: true,
        });
    } else {
        showToast(`试镜没过（成功率 ${Math.round(result.chance * 100)}%）`);
        await pushTimeline({
            day: save.clock.day, title: `试镜《${project.title}》失利`,
            detail: '角色给了别人，履历上多了一次不甘心', kind: 'work', major: false,
        });
    }
    await dbx.saveProject(appRef, state.identity.profileKey, save.id, toPlain(project));
    await persistSave();
    state.projects = await dbx.listProjects(appRef, save.id);
    return { ok: true, success: result.success };
}

export async function startShooting(projectId) {
    const project = state.projects.find((p) => p.id === projectId);
    if (!project || project.status !== 'cast') return;
    project.status = 'shooting';
    await dbx.saveProject(appRef, state.identity.profileKey, state.save.id, toPlain(project));
    state.projects = await dbx.listProjects(appRef, state.save.id);
    showToast(`《${project.title}》开机`);
}

/**
 * 拍一场戏：结果 JS 掷定（不可重 roll），AI 只演绎过程。
 * 消耗 4 小时 + 精力。
 */
export async function shootScene(projectId, sceneIndex, opinion = '') {
    const save = state.save;
    const project = state.projects.find((p) => p.id === projectId);
    const scene = project?.scenes?.[sceneIndex];
    if (!save || !project || !scene || scene.done) return { ok: false };
    if (project.status !== 'shooting') return { ok: false, error: '项目还没开机' };

    const remainMin = DAY_END_MINUTE - save.clock.minute;
    if (240 > remainMin) return { ok: false, error: '今天时间不够拍这场戏了' };
    if ((save.energy ?? 100) < 26) return { ok: false, error: '精力见底，拍不动了' };

    state.loading.scene = `${projectId}::${sceneIndex}`;
    try {
        const outcome = career.performScene(toPlain(save), project, sceneIndex);

        // 时间与精力
        const { clock, hitMidnight } = clockSvc.advanceMinutes(save.clock, 240);
        save.clock = clock;
        save.energy = clamp((save.energy ?? 100) - 26, 0, ENERGY_MAX);

        // 成色影响属性
        const deltaByGrade = {
            'miracle-win': { acting: 2, camera: 1, fame: 1 },
            'decisive-win': { acting: 1, camera: 1 },
            'close-win': { acting: 1 },
            'close-loss': { resilience: 1 },
            'heavy-loss': { resilience: -1, fame: -1 },
            collapse: { resilience: -2, fame: -1 },
        };
        const settled = career.settleAttrDeltas(save.attrs, deltaByGrade[outcome.result.grade] || {});
        save.attrs = settled.attributes;

        // AI 演绎（失败不影响已结算的结果）
        let narrative = '';
        const { text } = buildScenePrompt({
            identity: state.identity, profile: state.profile, save: toPlain(save),
            project: toPlain(project), scene: { ...scene }, outcome, opinion,
        });
        const gen = await generateText({ system: text, temperature: 0.95 });
        if (gen.ok) narrative = tidyText(gen.raw);

        scene.done = true;
        scene.narrative = narrative;
        project.performRecords = [...asArray(project.performRecords), {
            sceneIndex, seed: outcome.seed, grade: outcome.result.grade,
            gradeLabel: outcome.gradeLabel, gradeFactor: outcome.gradeFactor,
            chance: outcome.result.chance, roll: outcome.result.roll, day: save.clock.day,
        }];

        const allDone = project.scenes.every((s) => s.done);
        if (allDone) project.status = 'wrapped';

        await dbx.saveProject(appRef, state.identity.profileKey, save.id, toPlain(project));
        await persistSave();
        state.projects = await dbx.listProjects(appRef, save.id);

        if (hitMidnight) openModal({ type: 'next-day', reason: 'midnight' });
        return { ok: true, outcome, narrative, wrapped: allDone };
    } finally {
        state.loading.scene = '';
    }
}

/** 杀青结算：片酬入账（幂等）→ 上映热度 → 涨粉 / 综艺邀约倾斜 */
export async function settleProject(projectId) {
    const save = state.save;
    const project = state.projects.find((p) => p.id === projectId);
    if (!save || !project || project.status !== 'wrapped') return { ok: false };

    const pay = career.projectPay(toPlain(save), toPlain(project));
    const paid = await money.grantIncome({
        userId: state.identity.userId, amount: pay,
        sourceType: 'actor-salary', sourceId: project.id,
        note: `《${project.title}》片酬`,
        counterpartyName: '剧组制片',
    });
    const airing = career.airingResult(toPlain(save), toPlain(project));
    project.payment = { amount: pay, settledAt: Date.now() };
    project.airing = airing;
    project.status = 'aired';

    const settled = career.settleAttrDeltas(save.attrs, { fame: airing.fameDelta });
    save.attrs = settled.attributes;
    save.finishedWorks = (save.finishedWorks || 0) + 1;

    const verdictText = airing.verdict === 'hit' ? '爆了' : airing.verdict === 'solid' ? '反响平稳' : '悄无声息';
    await pushTimeline({
        day: save.clock.day,
        title: `《${project.title}》上映，${verdictText}`,
        detail: `热度 ${airing.heat}/100 · 片酬 ${pay} ${state.identity.currency}${paid.duplicated ? '（已入账）' : ''}`,
        kind: 'work', major: airing.verdict === 'hit',
    });
    if (airing.verdict === 'hit') {
        await proposePersonaWrite(`主演的《${project.title}》播出后大爆，事业迈上新台阶。`);
    }

    await dbx.saveProject(appRef, state.identity.profileKey, save.id, toPlain(project));
    await persistSave();
    await refreshBalance();
    state.projects = await dbx.listProjects(appRef, save.id);
    state.timeline = await dbx.listTimeline(appRef, save.id);
    syncMurmur();
    showToast(`片酬 ${pay} ${state.identity.currency} 已入账`);
    return { ok: true, pay, airing };
}

/** 原作更新时的重新同步（用户主动点） */
export async function resyncProjectSource(projectId) {
    const project = state.projects.find((p) => p.id === projectId);
    if (!project?.source?.bookId) return { ok: false };
    const check = await dream.checkSourceUpdated(toPlain(project));
    if (check.error) return { ok: false, error: check.error };
    if (!check.updated) {
        showToast('原作没有更新');
        return { ok: true, updated: false };
    }
    project.source = check.fresh;
    await dbx.saveProject(appRef, state.identity.profileKey, state.save.id, toPlain(project));
    state.projects = await dbx.listProjects(appRef, state.save.id);
    showToast('已同步原作最新版本');
    return { ok: true, updated: true };
}

// ============================================================
// 奖项（段锚点）
// ============================================================

async function settleAward(award, day) {
    const save = state.save;
    const evaluated = career.evaluateAward(award, toPlain(save));

    if (!evaluated.nominated) {
        await dbx.saveEvent(appRef, state.identity.profileKey, save.id, {
            type: 'announce', kind: 'award', title: `${award.name}揭晓`,
            body: `本届你未获提名（${evaluated.fails.join('；')}）。`, day, resolved: true,
        });
        return;
    }
    if (evaluated.won) {
        const honor = { id: uid('honor'), title: evaluated.honor || `${award.name}·获奖`, day, source: 'award' };
        save.honors = [...asArray(save.honors), honor];
        const settled = career.settleAttrDeltas(save.attrs, { fame: award.reward?.fame || 5 });
        save.attrs = settled.attributes;
        if (award.reward?.money) {
            await money.grantIncome({
                userId: state.identity.userId, amount: award.reward.money,
                sourceType: 'actor-award', sourceId: `${save.id}::${award.id}::${day}`,
                note: `${award.name}奖金`, counterpartyName: '组委会',
            });
            await refreshBalance();
        }
        await pushTimeline({
            day, title: `捧起了${award.name}`,
            detail: `概率 ${Math.round((evaluated.contest?.chance || 0) * 100)}% · roll ${evaluated.contest?.roll?.toFixed(3)}`,
            kind: 'award', major: true,
        });
        await proposePersonaWrite(`获得了${honor.title}。`);
        openModal({ type: 'award', won: true, award: { ...award }, honor: honor.title, contest: evaluated.contest });
    } else {
        await dbx.saveEvent(appRef, state.identity.profileKey, save.id, {
            type: 'announce', kind: 'award', title: `${award.name}揭晓`,
            body: `你入围了，但奖杯给了别人（概率 ${Math.round((evaluated.contest?.chance || 0) * 100)}%）。`,
            day, resolved: true,
        });
        await pushTimeline({
            day, title: `${award.name}陪跑`,
            detail: '入围即认可，下一届再来', kind: 'award', major: false,
        });
    }
    await persistSave();
    state.events = await dbx.listEvents(appRef, save.id);
}

/** 奖项 / 节日配置修改（首配后也能调） */
export async function updateAnchors({ awards, festivals }) {
    if (!state.profile) return;
    if (awards) state.profile.awards = awards;
    if (festivals) state.profile.festivals = festivals;
    await dbx.saveProfile(appRef, toPlain(state.profile));
    try {
        const { syncCareerAnchorsToWorld } = await import('@/js/apps/setting/world/sdk/anchor-sync.js');
        const sdk = window.settingsSdk;
        const worldId = state.identity?.worldId;
        if (sdk && worldId) {
            await syncCareerAnchorsToWorld(sdk, worldId, {
                awards: state.profile.awards,
                festivals: state.profile.festivals,
            });
        }
    } catch (err) {
        console.warn('[actor] 同步世界观锚点失败', err);
    }
    showToast('锚点配置已保存');
}

export function randomizeAwardConfig() {
    return career.randomizeAwards(String(Date.now()));
}

// ============================================================
// NPC
// ============================================================

export function visibleNpcs() {
    const save = state.save;
    if (!save) return [];
    const revealed = new Set(save.revealedNpcIds || []);
    return allNpcs()
        .filter((n) => !n.hidden || revealed.has(n.id))
        .map((n) => ({
            ...n,
            active: (save.npcActiveIds || []).includes(n.id),
            chatted: (save.chattedNpcIds || []).includes(n.id),
        }));
}

export async function toggleNpcActive(npcId) {
    const save = state.save;
    if (!save) return;
    const list = new Set(save.npcActiveIds || []);
    if (list.has(npcId)) list.delete(npcId);
    else list.add(npcId);
    save.npcActiveIds = [...list];
    await persistSave();
}

/** 把绑定世界的 AI 拉进本档当 NPC */
export async function addAiAsNpc(aiPersonId) {
    const save = state.save;
    if (!save) return;
    const ai = world.listWorldAis().find((a) => a.id === aiPersonId);
    if (!ai) return;
    if (asArray(save.npcExtra).some((n) => n.aiPersonId === aiPersonId)) {
        showToast('TA 已经在圈子里了');
        return;
    }
    const persona = world.describeAiPersona(aiPersonId);
    const npc = npcEngine.wrapAiAsNpc(ai, persona);
    save.npcExtra = [...asArray(save.npcExtra), npc];
    save.npcActiveIds = [...(save.npcActiveIds || []), npc.id];
    await persistSave();
    showToast(`${ai.name} 加入了你的圈子`);
}

/** AI 人设变化检测：变了问用户三选一（覆盖快照 / 存阶段卡 / 暂不动） */
async function checkAiNpcPersonaDiff() {
    const save = state.save;
    if (!save) return;
    for (const npc of asArray(save.npcExtra)) {
        if (!npc.fromAi || !npc.aiPersonId) continue;
        const current = world.describeAiPersona(npc.aiPersonId);
        if (!current) continue;
        const hash = hashString(current);
        if (npc.personaHash && hash !== npc.personaHash) {
            openModal({
                type: 'ai-persona-diff',
                npcId: npc.id,
                npcName: npc.name,
                freshPersona: current,
            });
            return; // 一次处理一个
        }
    }
}

export async function resolveAiPersonaDiff(npcId, choice) {
    const save = state.save;
    const npc = asArray(save?.npcExtra).find((n) => n.id === npcId);
    closeModal();
    if (!save || !npc) return;
    const current = world.describeAiPersona(npc.aiPersonId);
    if (choice === 'overwrite') {
        npc.personaSnapshot = current;
        npc.personaHash = hashString(current);
        showToast('已用最新人设覆盖');
    } else if (choice === 'stagecard') {
        await dbx.saveStageCard(appRef, state.identity.profileKey, {
            saveId: save.id,
            subjectType: 'ai',
            subjectId: npc.aiPersonId,
            subjectName: npc.name,
            stageTier: save.tier,
            title: `${npc.name} · 阶段快照（第${save.clock.day}天）`,
            content: npc.personaSnapshot,
        });
        npc.personaSnapshot = current;
        npc.personaHash = hashString(current);
        state.stageCards = await dbx.listStageCards(appRef, state.identity.profileKey);
        showToast('旧人设已存为阶段卡，快照已更新');
    } else {
        npc.personaHash = hashString(current); // 暂不动：只消掉提醒
        showToast('保持原快照不变');
    }
    await persistSave();
}

export async function openNpcChat(npcId) {
    const save = state.save;
    if (!save) return;
    state.npcChat = {
        npcId,
        messages: await dbx.listNpcChat(appRef, save.id, npcId),
    };
    setView('npc', { npcId });
}

export async function sendNpcChat(text) {
    const save = state.save;
    const npcId = state.npcChat.npcId;
    const npc = allNpcs().find((n) => n.id === npcId);
    const say = String(text || '').trim();
    if (!save || !npc || !say || state.loading.npcReply) return;

    state.loading.npcReply = true;
    try {
        const seq = state.npcChat.messages.length;
        const userMsg = await dbx.saveNpcChatMessage(appRef, state.identity.profileKey, save.id, {
            npcId, seq, role: 'user', text: say,
        });
        state.npcChat.messages = [...state.npcChat.messages, userMsg];

        if (!(save.chattedNpcIds || []).includes(npcId)) {
            save.chattedNpcIds = [...(save.chattedNpcIds || []), npcId];
            await persistSave();
        }

        const { text: system } = buildNpcChatPrompt({
            identity: state.identity, profile: state.profile, save: toPlain(save),
            npc: toPlain(npc), history: toPlain(state.npcChat.messages), userText: say,
        });
        const result = await generateText({ system, temperature: 0.95 });
        const replyText = result.ok ? tidyText(result.raw) : `（${result.error}）`;
        const reply = await dbx.saveNpcChatMessage(appRef, state.identity.profileKey, save.id, {
            npcId, seq: seq + 1, role: 'npc', text: replyText, failed: !result.ok,
        });
        state.npcChat.messages = [...state.npcChat.messages, reply];
    } finally {
        state.loading.npcReply = false;
    }
}

/** 喜欢这个 NPC → 注册进 nook 角色库（幂等） */
export async function registerNpcToNook(npcId) {
    const npc = allNpcs().find((n) => n.id === npcId);
    if (!npc || state.loading.register) return;
    state.loading.register = npcId;
    try {
        const result = await registerEncounteredCharacter({
            name: npc.name,
            bio: `${npc.occupation}（${npc.status}）`,
            summary: npcEngine.npcPersonaText(npc, { withAgenda: false }),
            externalId: npc.id,
        }, {
            sourceApp: '追光',
            encounter: `在演艺圈结识（${npc.occupation}）`,
        });
        if (result.ok) {
            showToast(result.created ? `${npc.name} 已加入角色库` : `${npc.name} 已在角色库里`);
        } else {
            showToast(result.error || '注册失败');
        }
    } finally {
        state.loading.register = '';
    }
}

// ============================================================
// 阶段结算（多块串行，不可重 roll）
// ============================================================

export async function startSettlement() {
    const save = state.save;
    if (!save || state.loading.settlement) return;
    if (save.tier <= 1) {
        showToast('已经是 1 线了，往上没有线，只有传说');
        return;
    }
    state.loading.settlement = true;
    state.settlementRun = {
        fromTier: save.tier,
        toTier: save.tier - 1,
        blocks: SETTLEMENT_BLOCKS.map((b) => ({ ...b, status: 'pending', output: null })),
        failed: false,
    };
    openModal({ type: 'settlement' });

    try {
        const done = [];
        for (const block of state.settlementRun.blocks) {
            block.status = 'running';
            const { text } = buildSettlementBlockPrompt({
                identity: state.identity, profile: state.profile, save: toPlain(save),
                timeline: state.timeline, block, previousBlocks: done,
            });
            const result = block.type === 'json'
                ? await generateJson({ system: text, temperature: 0.85 })
                : await generateText({ system: text, temperature: 0.9 });

            if (!result.ok) {
                block.status = 'failed';
                block.error = result.error;
                state.settlementRun.failed = true;
                showToast(`「${block.label}」没生成完：${result.error}`);
                return; // 温柔停下：已完成的块保留，不重试轰炸
            }
            block.output = block.type === 'json' ? result.data : tidyText(result.raw);
            block.status = 'done';
            done.push({ label: block.label, output: block.output });
        }

        // 全部块完成 → 结算
        await applySettlement();
    } finally {
        state.loading.settlement = false;
    }
}

async function applySettlement() {
    const save = state.save;
    const run = state.settlementRun;
    if (!save || !run || run.failed) return;

    const statsBlock = run.blocks.find((b) => b.id === 'stats');
    const deltas = statsBlock?.output?.attrDeltas || {};
    const settled = career.settleAttrDeltas(save.attrs, deltas, SETTLEMENT_DELTA_CAP);
    save.attrs = settled.attributes;

    const newTier = run.toTier;
    save.tier = newTier;
    // 知名度至少到新线基准
    const fameFloor = tierSpec(newTier).fameBase;
    if ((save.attrs.fame || 0) < fameFloor) {
        save.attrs = { ...save.attrs, fame: fameFloor };
    }

    const record = {
        id: uid('settle'),
        at: Date.now(),
        day: save.clock.day,
        fromTier: run.fromTier,
        toTier: newTier,
        blocks: toPlain(run.blocks).map((b) => ({ id: b.id, label: b.label, output: b.output })),
        attrChanges: settled.changes,
    };
    save.settlements = [...asArray(save.settlements), record];

    await pushTimeline({
        day: save.clock.day,
        title: `晋升 ${tierSpec(newTier).label}`,
        detail: `${tierSpec(run.fromTier).label} → ${tierSpec(newTier).label}（${tierSpec(newTier).group}）`,
        kind: 'milestone', major: true,
    });
    await persistSave();
    state.timeline = await dbx.listTimeline(appRef, save.id);
    syncMurmur();

    await proposePersonaWrite(
        `从${tierSpec(run.fromTier).label}演员晋升为${tierSpec(newTier).label}演员。`,
        { alsoStageCard: true },
    );
}

// ============================================================
// 人设改写（覆盖 / 新开阶段卡 / 暂不）
// ============================================================

/**
 * 重大事件后询问是否同步人设卡。
 * 不直接写 —— 弹窗三选一，写了就记台账（personaWrites），重开档可回收。
 */
async function proposePersonaWrite(line, opts = {}) {
    openModal({
        type: 'persona-sync',
        line: String(line || ''),
        alsoStageCard: opts.alsoStageCard === true,
    });
}

export async function applyPersonaChoice(choice) {
    const modal = state.modal;
    closeModal();
    if (!modal || modal.type !== 'persona-sync' || !state.save) return;
    const line = `【追光】${modal.line}`;

    if (choice === 'overwrite') {
        const ok = await world.appendPersonaExperience('user', state.identity.userId, line);
        if (ok) {
            state.profile.personaWrites = [...asArray(state.profile.personaWrites), {
                saveId: state.save.id, entityType: 'user', entityId: state.identity.userId,
                line, at: Date.now(),
            }];
            await dbx.saveProfile(appRef, toPlain(state.profile));
            showToast('已写进人设经历');
        } else {
            showToast('人设系统暂时写不进去');
        }
    } else if (choice === 'stagecard') {
        await dbx.saveStageCard(appRef, state.identity.profileKey, {
            saveId: state.save.id,
            subjectType: 'user',
            subjectId: state.identity.userId,
            subjectName: state.profile?.stageName || state.identity.userName,
            stageTier: state.save.tier,
            title: `${tierSpec(state.save.tier).label} · 第${state.save.clock.day}天`,
            content: modal.line,
        });
        state.stageCards = await dbx.listStageCards(appRef, state.identity.profileKey);
        showToast('已存为阶段卡');
    }
    // skip：什么都不做
}

export async function deleteStageCard(cardId) {
    await dbx.removeStageCard(appRef, cardId);
    state.stageCards = await dbx.listStageCards(appRef, state.identity.profileKey);
    showToast('阶段卡已删除');
}

// ============================================================
// 结局
// ============================================================

export async function generateEnding(opinion = '') {
    const save = state.save;
    if (!save || state.loading.ending) return { ok: false };
    state.loading.ending = true;
    try {
        const { text } = buildEndingPrompt({
            identity: state.identity, profile: state.profile, save: toPlain(save),
            timeline: state.timeline, opinion,
        });
        const result = await generateText({ system: text, temperature: 0.9 });
        if (!result.ok) return { ok: false, error: result.error };
        save.endingText = tidyText(result.raw);
        save.status = 'ended';
        save.endedAt = Date.now();
        await persistSave();
        await pushTimeline({
            day: save.clock.day, title: '为这一档写下了结局',
            detail: '（结局之后仍可继续日常）', kind: 'milestone', major: false,
        });
        state.saves = await dbx.listSaves(appRef, state.identity.profileKey);
        setView('ending');
        return { ok: true };
    } finally {
        state.loading.ending = false;
    }
}

// ============================================================
// 事件现场演绎（可选：给已结算事件补一段小剧场）
// ============================================================

export async function narrateEvent(eventLogId) {
    const row = state.events.find((e) => e.id === eventLogId);
    if (!row || row.narrative) return;
    const { text } = buildEventScenePrompt({
        identity: state.identity, profile: state.profile, save: toPlain(state.save),
        eventTitle: row.title, eventDesc: row.body,
        choiceLabel: row.choice || '', resultNote: row.outcome || '',
    });
    const result = await generateText({ system: text, temperature: 0.95 });
    if (result.ok) {
        row.narrative = tidyText(result.raw);
        await dbx.saveEvent(appRef, state.identity.profileKey, state.save.id, toPlain(row));
        state.events = await dbx.listEvents(appRef, state.save.id);
    } else {
        showToast(result.error);
    }
}

// ============================================================
// 时间轴
// ============================================================

async function pushTimeline({ day, title, detail, kind, major }) {
    const save = state.save;
    if (!save) return;
    await dbx.saveTimelineEntry(appRef, state.identity.profileKey, save.id, {
        day, title, detail: detail || '', kind: kind || 'event', major: major === true,
    });
    state.timeline = await dbx.listTimeline(appRef, save.id);

    // 重大事件自动登记到世界观时间轴（按档留 id，删档可回收）
    if (major) {
        const ms = clockSvc.virtualMs(save.clock);
        const dateText = world.formatWorldDate(ms, state.identity.worldId);
        const eventId = await world.pushWorldTimeline({
            worldId: state.identity.worldId,
            title: `【追光】${title}`,
            description: detail || '',
            dateText,
        });
        if (eventId) {
            save.worldTimelineIds = [...(save.worldTimelineIds || []), eventId];
            await persistSave();
        }
    }
}

// ============================================================
// 风险面板 / 锚点日历（透明性）
// ============================================================

export function currentRiskPanel() {
    const save = state.save;
    if (!save) return [];
    return eventEngine.riskPanel({
        tier: save.tier, attrs: save.attrs, day: save.clock.day,
        shieldUntilDay: save.shieldUntilDay, energy: save.energy,
        hasProject: state.projects.some((p) => p.status === 'shooting'),
        triggeredOnceIds: save.triggeredOnceIds,
        lastTriggeredDayById: save.lastTriggeredDayById,
    });
}

export function anchorCalendar(horizon = 60) {
    const save = state.save;
    if (!save || !state.profile) return [];
    return career.upcomingAnchors(state.profile.awards, state.profile.festivals, save.clock.day, horizon);
}

// ============================================================
// murmur / provider 同步
// ============================================================

function syncMurmur() {
    const toolkit = appRef?.toolkit;
    if (!toolkit || !state.save) return;
    try {
        syncCareerPrompt(toolkit, toPlain(state.save), toPlain(state.timeline));
    } catch (err) {
        console.warn('[actor] 同步 murmur 生涯卡失败', err);
    }
}

/** provider 的懒读取口（registerActorProviders 用） */
export function readProviderState() {
    return {
        save: state.save ? toPlain(state.save) : null,
        timeline: toPlain(state.timeline),
        projects: toPlain(state.projects),
        profile: state.profile ? toPlain(state.profile) : null,
    };
}

// ============================================================
// 主题
// ============================================================

export async function setTheme(themeId) {
    if (!state.profile) return;
    state.profile.themeId = themeId;
    await dbx.saveProfile(appRef, toPlain(state.profile));
    applyThemeFromProfile();
}

export async function setCustomColors(colors) {
    if (!state.profile) return;
    state.profile.customColors = { ...(colors || {}) };
    await dbx.saveProfile(appRef, toPlain(state.profile));
    applyThemeFromProfile();
}

// ============================================================
// 杂项
// ============================================================

export function flushPersist() {
    return persistSave();
}

export function attrMax() {
    return ATTR_MAX;
}

export function eventKindMeta(kind) {
    return EVENT_KINDS[kind] || EVENT_KINDS.social;
}
