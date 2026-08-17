/**
 * 声浪 · 状态单例
 *
 * 一份 Vue.reactive，所有组件读它、通过这里的 mutator 改它。
 *
 * ── 存档模型 ──────────────────────────────────────────────────────
 * 档案键（用户+世界）下有一份 profile（战队名册定制 / 赛事与节日锚点 / 社媒偏好 /
 * 论坛身份与小号 / 人设改写台账），和任意多个「档」（save）。
 * 名册由档案键确定性生成（换档不换人）；新开档 = 时间回原点 + 属性按首配重置
 * + 赛季从第一个启用赛事重开 + 可选回收人设改写；阶段卡跨档保留。
 *
 * ── AI 调用边界 ───────────────────────────────────────────────────
 * 掷签、赛果、积分、热度、预置帖全部 JS 本地。只有这些动作调 AI（全部用户主动触发）：
 *   板块 AI 帖批量 / 用户帖生成评论 / 战绩围观锐评 / 赛报 / 快进叙事 / 生成结局。
 * 生成过的评论可以删除，但没有重 roll。
 *
 * ── 对赛点（esports-game）的服务 ─────────────────────────────────
 * getCareerState / playUserSeries / recordRankSession / applyRankOutcome /
 * getActiveSeason / listSeasonEvents / recordMatchResult —— 声浪是事实源。
 */

import {
    EVENT_DELTA_CAP, FAN_HANDLES, FAST_FORWARD_DELTA_CAP, LS_KEYS, MVP_BONUS_FACTOR,
    SEASON_DELTA_CAP, ENERGY_MAX, prCostByFame, startTierSpec,
} from './constants.js';
import {
    asArray, clamp, hashString, pickBySeed, tidyText, toPlain, uid,
} from './utils.js';
import * as dbx from './services/db.js';
import * as world from './services/world-context.js';
import * as npcEngine from './services/npc-engine.js';
import * as seasonEngine from './services/season-engine.js';
import * as forumEngine from './services/forum-engine.js';
import * as career from './services/career-engine.js';
import * as eventEngine from './services/event-engine.js';
import * as money from './services/salary.js';
import { generateJson, generateText } from './services/ai.js';
import {
    buildBoardBatchPrompt, buildEndingPrompt, buildFastForwardPrompt,
    buildMatchReportPrompt, buildRankRoastPrompt, buildUserPostCommentsPrompt,
} from './services/prompt-builder.js';
import { buildCareerSummarySpec, syncCareerPrompt } from './services/app-prompts.js';
import {
    createClock, advanceMinutes, fastForward as clockFastForward, gameModelById,
    nextDay as clockNextDay, positionLabel, setSlot as clockSetSlot,
    setSyncReal as clockSetSyncReal, syncToRealTime, teamPower,
} from '../esports-shared/esports-kit.js';

const Vue = typeof window !== 'undefined' ? window.Vue : null;
const reactive = (o) => (Vue?.reactive ? Vue.reactive(o) : o);

const state = reactive({
    ready: false,
    blocked: '',
    needsConfig: false,

    identity: {
        ready: false, userId: '', userName: '我', userAvatar: '',
        worldId: '', worldName: '', profileKey: '', isEsportsWorld: false, currency: '元',
    },

    profile: null,
    saves: [],
    save: null,

    /** 名册（确定性现算 + AI 替换叠加），不落盘 */
    roster: null,
    heat: {},

    posts: [],
    ratings: [],
    events: [],
    timeline: [],
    stageCards: [],
    balance: 0,

    tab: 'home',
    /** 覆盖页：'' | board | thread | season | teams | anchors | timeline | identities | social |
     *          prompts | saves | stagecards | theme | ending | risk | player */
    view: '',
    viewPayload: null,
    modal: null,

    loading: {
        hydrate: false, boardBatch: false, comments: '', roast: '',
        report: '', fastForward: false, ending: false,
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
// 名册与查询辅助
// ============================================================

export function teamNameOf(teamId) {
    const custom = state.profile?.teamNames?.[teamId];
    if (custom) return custom;
    const team = state.roster?.teams?.find((t) => t.id === teamId);
    return team?.defaultName || teamId || '未知战队';
}

export function teamTagOf(teamId) {
    return state.roster?.teams?.find((t) => t.id === teamId)?.tag || '';
}

/** 槽位被 AI 角色卡替换后的展示名（人设归 AI，数值仍是槽位的） */
export function displayPlayer(player) {
    if (!player) return null;
    const rep = state.profile?.aiReplacements?.[player.id];
    if (!rep) return player;
    return { ...player, gameId: rep.name, realName: rep.name, fromAi: true, aiPersonId: rep.aiPersonId };
}

export function playersOfTeam(teamId, { includeSub = true } = {}) {
    return asArray(state.roster?.players)
        .filter((p) => p.teamId === teamId && (includeSub || !p.isSub))
        .map(displayPlayer);
}

export function coachOfTeam(teamId) {
    return asArray(state.roster?.coaches).find((c) => c.teamId === teamId) || null;
}

export function playerById(playerId) {
    const p = asArray(state.roster?.players).find((x) => x.id === playerId)
        || asArray(state.roster?.coaches).find((x) => x.id === playerId);
    return p ? displayPlayer(p) : null;
}

export function userModel() {
    return gameModelById(state.profile?.modelId);
}

export function userPosLabel() {
    return positionLabel(userModel(), state.profile?.positionId);
}

/** 用户队友（首发 4 人 + 替补） */
export function userTeammates() {
    return playersOfTeam(state.profile?.userTeamId || 'team-1');
}

/** 队伍强度（用户队含用户属性 + 精力修正；他队含状态波动） */
export function powerOfTeam(teamId, day) {
    const starters = asArray(state.roster?.players)
        .filter((p) => p.teamId === teamId && !p.isSub)
        .map((p) => p.attrs);
    let power;
    if (teamId === state.profile?.userTeamId && state.save) {
        power = teamPower([state.save.attrs, ...starters]);
        if ((state.save.energy ?? 100) < 30) power -= 4;
    } else {
        power = teamPower(starters);
    }
    const form = ((hashString(`form::${state.save?.id}::${teamId}::${day}`) % 9) - 4);
    return Math.max(1, power + form);
}

function rebuildRoster() {
    const key = state.identity.profileKey;
    const profile = state.profile;
    if (!key || !profile?.configured) {
        state.roster = null;
        return;
    }
    const roster = npcEngine.generateRoster(key, profile.modelId, profile.positionId);
    // AI 角色卡带「串子」属性 → 顶替的槽位继承小号行为
    for (const [slotId, rep] of Object.entries(profile.aiReplacements || {})) {
        if (!rep?.lurkerFromAi) continue;
        const p = roster.players.find((x) => x.id === slotId);
        if (p) p.isLurker = true;
    }
    state.roster = roster;
    recomputeHeat();
}

function recomputeHeat() {
    if (!state.roster) { state.heat = {}; return; }
    state.heat = seasonEngine.computeHeat(
        state.roster.teams, state.save?.season || null,
        state.profile?.userTeamId, state.save?.heatShifts || {},
    );
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
        isEsportsWorld: identity.isEsportsWorld,
        currency: identity.currency,
        user: identity.user,
        world: identity.world,
    };

    if (!identity.ready) {
        state.blocked = '声浪需要默认用户明确绑定一个世界观。去设置里绑定后回来。';
        return;
    }
    if (!identity.isEsportsWorld) {
        state.blocked = '这个世界观不是电竞模式。把世界的体验模式设为「电竞」后，声浪会自动出现。';
        return;
    }
    state.blocked = '';

    const key = identity.profileKey;
    if (state.profile?.id === key && state.save) {
        await refreshBalance();
        await syncClockWithReal();
        return;
    }

    const profile = await dbx.loadProfile(appRef, key);
    state.profile = profile;
    state.needsConfig = !profile?.configured;
    state.saves = await dbx.listSaves(appRef, key);
    state.save = null;
    state.posts = [];
    state.ratings = [];
    state.events = [];
    state.timeline = [];
    state.stageCards = await dbx.listStageCards(appRef, key);
    rebuildRoster();

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
        themeApplier(state.profile.themeId || 'stand', state.profile.customColors || {});
    }
}

// ============================================================
// 首次配置
// ============================================================

/**
 * @param {object} setup {
 *   gameId, realNameShown, region, modelId, positionId, gameName, motto, honorsInit,
 *   startTier, attrs, tournaments[], festivals[], teamNames{}, userTeamName,
 *   salary { monthSalary, winBonus }, forumHandle, saveName
 * }
 */
export async function completeSetup(setup = {}) {
    const key = state.identity.profileKey;
    if (!key) return { ok: false, error: '档案键还没就绪' };

    const tier = clamp(setup.startTier, 1, 6);
    const check = career.validateAllocation(setup.attrs || {}, tier);
    if (!check.ok) return { ok: false, error: check.error };
    if (!String(setup.gameId || '').trim()) return { ok: false, error: '选手 ID 不能为空' };

    const spec = startTierSpec(tier);
    const teamNames = { ...(setup.teamNames || {}) };
    if (String(setup.userTeamName || '').trim()) {
        teamNames['team-1'] = String(setup.userTeamName).trim();
    }

    const profile = {
        ...dbx.makeProfile(key),
        ...(state.profile || {}),
        id: key,
        profileKey: key,
        configured: true,
        setupVersion: 1,
        gameId: String(setup.gameId).trim(),
        realNameShown: String(setup.realNameShown || '').trim(),
        region: String(setup.region || '荣耀赛区').trim(),
        modelId: setup.modelId || 'moba',
        positionId: setup.positionId || gameModelById(setup.modelId).positions[0].id,
        gameName: String(setup.gameName || '').trim() || gameModelById(setup.modelId).defaultGameName,
        formatId: 'sab',
        startTier: tier,
        motto: String(setup.motto || '').trim(),
        honorsInit: String(setup.honorsInit || '').trim(),
        teamNames,
        userTeamId: 'team-1',
        tournaments: asArray(setup.tournaments).length ? setup.tournaments : career.defaultTournamentConfig(),
        festivals: asArray(setup.festivals).length ? setup.festivals : career.defaultFestivalConfig(),
        salary: {
            monthSalary: Number(setup.salary?.monthSalary) > 0 ? Math.round(setup.salary.monthSalary) : spec.monthSalary,
            winBonus: Number(setup.salary?.winBonus) > 0 ? Math.round(setup.salary.winBonus) : spec.winBonus,
        },
        identities: [{
            id: uid('idn'),
            name: String(setup.forumHandle || '').trim() || `峡谷来客${hashString(key) % 9000 + 1000}`,
            isMain: true,
            createdAt: Date.now(),
        }],
    };

    const save = dbx.makeSave(key, {
        name: String(setup.saveName || '').trim() || career.newSaveName(0),
        tier,
        attrs: { ...setup.attrs, fame: spec.fameBase },
        clock: createClock(),
    });
    profile.activeSaveId = save.id;

    await dbx.saveProfile(appRef, profile);
    await dbx.saveSave(appRef, save);

    state.profile = await dbx.loadProfile(appRef, key);
    state.saves = await dbx.listSaves(appRef, key);
    state.needsConfig = false;
    rebuildRoster();

    await loadSaveIntoState(save.id);
    await startFirstSeason();
    await grantStartFunds(save);
    await pushTimeline({
        day: 1,
        title: `以${spec.label}的身份加入${teamNameOf('team-1')}`,
        detail: profile.motto ? `赛场宣言：${profile.motto}` : '',
        kind: 'milestone', major: true,
    });
    try { localStorage.removeItem(LS_KEYS.draft); } catch (_) { /* noop */ }
    showToast('职业生涯开始了');
    return { ok: true };
}

async function grantStartFunds(save) {
    const spec = startTierSpec(save.startTier);
    const amount = Math.round(spec.monthSalary * 0.6);
    const result = await money.grantIncome({
        userId: state.identity.userId,
        amount,
        sourceType: 'esports-start',
        sourceId: save.id,
        note: `签约安家费（${spec.label}）`,
        counterpartyName: '俱乐部经理',
    });
    if (result.ok && !result.duplicated) {
        showToast(`俱乐部打来了 ${amount} ${state.identity.currency} 安家费`);
    }
    await refreshBalance();
}

// ============================================================
// 赛季生命周期
// ============================================================

function enabledTournaments() {
    return asArray(state.profile?.tournaments).filter((t) => t && t.enabled !== false);
}

function initialRanking() {
    return asArray(state.roster?.teams)
        .slice()
        .sort((a, b) => b.powerBase - a.powerBase)
        .map((t) => t.id);
}

async function startFirstSeason() {
    const save = state.save;
    if (!save || save.season) return;
    const list = enabledTournaments();
    if (!list.length) return;
    const tournament = list[0];
    save.seasonNo = 1;
    save.season = seasonEngine.buildSeason({
        instanceId: `${save.id}::season1`,
        tournament,
        startDay: save.clock.day + 2,
        ranking: initialRanking(),
        userTeamId: state.profile.userTeamId,
    });
    await persistSave();
    recomputeHeat();
    await dbx.saveEvent(appRef, state.identity.profileKey, save.id, {
        type: 'announce', kind: 'season', title: `${tournament.name}即将开赛`,
        body: `赛程已公布，第 ${save.season.startDay} 天正式打响。`, day: save.clock.day, resolved: true,
    });
    state.events = await dbx.listEvents(appRef, save.id);
}

/** 赛季收官 → 荣誉 / 奖金 / 大事记 / 官宣下一项赛事 */
async function settleSeasonEnd() {
    const save = state.save;
    const season = save?.season;
    if (!season?.done || season.settled) return;
    season.settled = true;

    const myTeam = state.profile.userTeamId;
    const isChampion = season.championId === myTeam;
    const isRunner = season.runnerUpId === myTeam;

    if (isChampion || isRunner) {
        const amount = isChampion ? season.prizeChampion : season.prizeRunner;
        if (amount > 0) {
            await money.grantIncome({
                userId: state.identity.userId,
                amount,
                sourceType: 'esports-prize',
                sourceId: `${season.instanceId}::${isChampion ? 'champion' : 'runner'}`,
                note: `${season.name}${isChampion ? '冠军' : '亚军'}个人奖金`,
                counterpartyName: '赛事组委会',
            });
            await refreshBalance();
        }
        const honorTitle = `${season.name}${isChampion ? '冠军' : '亚军'}`;
        save.honors = [...asArray(save.honors), {
            id: uid('honor'), title: honorTitle, day: save.clock.day, source: 'system',
        }];
        const settled = career.settleAttrDeltas(save.attrs, { fame: isChampion ? 8 : 4, mentality: 2 }, 8);
        save.attrs = settled.attributes;
        await pushTimeline({
            day: save.clock.day, title: `拿下${honorTitle}`,
            detail: isChampion ? '冠军奖杯举起来的那一刻，一切都值了' : '差一步登顶，下个赛季再来',
            kind: 'honor', major: true,
        });
        proposePersonaWrite(`在「${season.name}」中随${teamNameOf(myTeam)}拿到${isChampion ? '冠军' : '亚军'}。`);
        openModal({
            type: 'season-end', seasonName: season.name,
            champion: teamNameOf(season.championId), isChampion, isRunner,
            prize: isChampion ? season.prizeChampion : season.prizeRunner,
        });
    } else if (season.championId) {
        await pushTimeline({
            day: save.clock.day, title: `${season.name}收官`,
            detail: `冠军：${teamNameOf(season.championId)}`, kind: 'season', major: false,
        });
        openModal({
            type: 'season-end', seasonName: season.name,
            champion: teamNameOf(season.championId), isChampion: false, isRunner: false, prize: 0,
        });
    }
    await persistSave();
    syncMurmur();
}

/** 收官后的休赛期结束 → 开下一项赛事 */
async function maybeStartNextSeason() {
    const save = state.save;
    const season = save?.season;
    if (!season?.done) return;
    const list = enabledTournaments();
    if (!list.length) return;
    const current = list.findIndex((t) => t.id === season.tournamentId);
    const tournament = list[(current + 1) % list.length];
    const gap = Number(list[current >= 0 ? current : 0]?.gapDays) || 7;
    const nextStart = season.phaseEndDay + gap;
    if (save.clock.day < nextStart) return;

    const ranking = asArray(season.finalRanking).length >= asArray(state.roster?.teams).length
        ? season.finalRanking
        : initialRanking();
    save.seasonNo += 1;
    save.season = seasonEngine.buildSeason({
        instanceId: `${save.id}::season${save.seasonNo}`,
        tournament,
        startDay: save.clock.day + 2,
        ranking,
        userTeamId: state.profile.userTeamId,
    });
    await persistSave();
    recomputeHeat();
    await dbx.saveEvent(appRef, state.identity.profileKey, save.id, {
        type: 'announce', kind: 'season', title: `${tournament.name}官宣`,
        body: `新赛事第 ${save.season.startDay} 天开打，赛程已挂出。`, day: save.clock.day, resolved: true,
    });
    state.events = await dbx.listEvents(appRef, save.id);
}

/** 把赛季推进到当前天：NPC 自动打，用户场留着；顺手清理过期用户场 */
async function advanceSeasonToToday() {
    const save = state.save;
    if (!save?.season || save.season.done) {
        await maybeStartNextSeason();
        if (!save?.season || save.season.done) return;
    }
    const { season, resolved } = seasonEngine.advanceSeason(save.season, {
        day: save.clock.day,
        userTeamId: state.profile.userTeamId,
        powerOf: (teamId, day) => powerOfTeam(teamId, day),
    });
    save.season = season;

    for (const s of resolved) {
        const mine = s.homeId === state.profile.userTeamId || s.awayId === state.profile.userTeamId;
        if (mine) {
            await onUserSeriesSettled(s, { auto: true });
        } else if (s.phase === 'gate' || s.phase === 'playoffs' || s.phase === 'ko') {
            await createMatchThread(s);
        }
    }
    if (save.season.done) await settleSeasonEnd();
    recomputeHeat();
    await persistSave();
}

// ============================================================
// 存档系统
// ============================================================

async function persistSave() {
    if (!state.save) return;
    await dbx.saveSave(appRef, toPlain(state.save));
}

async function loadSaveIntoState(saveId) {
    const save = await dbx.getSave(appRef, saveId);
    if (!save) return;
    state.save = save;
    state.posts = await dbx.listPosts(appRef, saveId);
    state.ratings = await dbx.listRatings(appRef, saveId);
    state.events = await dbx.listEvents(appRef, saveId);
    state.timeline = await dbx.listTimeline(appRef, saveId);

    save.lastPlayedAt = Date.now();
    await dbx.saveSave(appRef, save);
    if (state.profile && state.profile.activeSaveId !== saveId) {
        state.profile.activeSaveId = saveId;
        await dbx.saveProfile(appRef, toPlain(state.profile));
    }
    recomputeHeat();
    await syncClockWithReal();
    syncMurmur();
    await checkAiPersonaDiff();
}

export async function switchSave(saveId) {
    if (!saveId || saveId === state.save?.id) return;
    await loadSaveIntoState(saveId);
    state.saves = await dbx.listSaves(appRef, state.identity.profileKey);
    showToast(`已读档：${state.save?.name || ''}`);
}

/**
 * 新开一档：时间回原点、属性按首配重置、赛季从头再来；
 * resetPersonaWrites 时回收写进 nook 人设的经历行；阶段卡不删。
 */
export async function createSave(opts = {}) {
    const profile = state.profile;
    if (!profile?.configured) return { ok: false, error: '先完成首次配置' };

    if (opts.resetPersonaWrites) {
        await resetPersonaWrites();
    }

    const tier = profile.startTier;
    const attrs = opts.attrs && Object.keys(opts.attrs).length
        ? { ...opts.attrs }
        : career.suggestAllocation(tier, profile.id, profile.positionId);
    attrs.fame = startTierSpec(tier).fameBase;

    const save = dbx.makeSave(profile.id, {
        name: String(opts.name || '').trim() || career.newSaveName(state.saves.length),
        tier,
        attrs,
        clock: createClock(),
    });
    await dbx.saveSave(appRef, save);
    state.saves = await dbx.listSaves(appRef, profile.id);
    await loadSaveIntoState(save.id);
    await startFirstSeason();
    await grantStartFunds(save);
    await pushTimeline({
        day: 1, title: '新的一档生涯开始了', detail: '时间线回到原点', kind: 'milestone', major: false,
    });
    showToast('新档已开');
    return { ok: true };
}

export async function deleteSave(saveId) {
    const target = state.saves.find((s) => s.id === saveId);
    if (!target) return;
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

async function syncClockWithReal() {
    const save = state.save;
    if (!save?.clock?.syncReal) return;
    const { clock, crossedRealDay, realDayKey } = syncToRealTime(save.clock);
    save.clock = clock;
    if (crossedRealDay) {
        save.clock = { ...save.clock, lastRealDayKey: realDayKey };
        openModal({ type: 'next-day', reason: 'real-day-crossed' });
    }
    await persistSave();
}

export async function setDaySlot(slotId) {
    if (!state.save) return;
    state.save.clock = clockSetSlot(state.save.clock, slotId);
    await persistSave();
}

export async function toggleSyncReal(on) {
    if (!state.save) return;
    state.save.clock = clockSetSyncReal(state.save.clock, on);
    await persistSave();
    showToast(on ? '已与现实时间同步' : '已切为手动时间');
}

export function requestNextDay() {
    openModal({ type: 'next-day', reason: 'manual' });
}

export async function confirmNextDay() {
    closeModal();
    if (!state.save) return;
    state.save.clock = clockNextDay(state.save.clock);
    state.save.energy = clamp((state.save.energy ?? 100) + 45, 0, ENERGY_MAX);
    state.save.meals = { day: state.save.clock.day, lunch: false, dinner: false };
    await persistSave();
    await onDayArrived();
}

/** 每天到来时的结算：赛季推进 / 发薪 / 掷事件 / 节日公告 */
async function onDayArrived() {
    const save = state.save;
    if (!save) return;
    const day = save.clock.day;

    await advanceSeasonToToday();
    await paySalaryIfDue();

    const rolled = eventEngine.rollDailyEvents(save.id, day, {
        attrs: save.attrs,
        day,
        shieldUntilDay: save.shieldUntilDay,
        energy: save.energy,
        hasAlt: asArray(state.profile?.identities).some((i) => !i.isMain),
        triggeredOnceIds: save.triggeredOnceIds,
        lastTriggeredDayById: save.lastTriggeredDayById,
    });
    for (const { def, p } of rolled) {
        await triggerEvent(def, p, day);
    }

    for (const fest of career.dueFestivals(state.profile?.festivals, day)) {
        await dbx.saveEvent(appRef, state.identity.profileKey, save.id, {
            type: 'announce', kind: 'festival', title: fest.name,
            body: fest.desc, day, resolved: true,
        });
        await pushTimeline({ day, title: fest.name, detail: fest.desc, kind: 'festival', major: false });
    }

    await persistSave();
    state.events = await dbx.listEvents(appRef, save.id);
    state.timeline = await dbx.listTimeline(appRef, save.id);
    syncMurmur();
}

async function paySalaryIfDue() {
    const save = state.save;
    if (!save) return;
    const due = career.salaryPeriodsDue(save.clock.day);
    while ((save.salaryLastPeriod || 0) < due) {
        const period = (save.salaryLastPeriod || 0) + 1;
        const amount = state.profile?.salary?.monthSalary || startTierSpec(save.startTier).monthSalary;
        const result = await money.grantIncome({
            userId: state.identity.userId,
            amount,
            sourceType: 'esports-salary',
            sourceId: `${save.id}::salary::${period}`,
            note: `第 ${period} 期月薪`,
            counterpartyName: '俱乐部财务',
        });
        save.salaryLastPeriod = period;
        if (result.ok && !result.duplicated) {
            showToast(`月薪 ${amount} ${state.identity.currency} 到账`);
        }
    }
    await refreshBalance();
    await persistSave();
}

// ============================================================
// 事件
// ============================================================

async function triggerEvent(def, p, day) {
    const save = state.save;
    save.lastTriggeredDayById = { ...(save.lastTriggeredDayById || {}), [def.id]: day };
    if (def.once) save.triggeredOnceIds = [...(save.triggeredOnceIds || []), def.id];

    const row = await dbx.saveEvent(appRef, state.identity.profileKey, save.id, {
        type: 'event', kind: def.kind, defId: def.id,
        title: def.title, body: def.desc, day,
        chance: Math.round(p * 1000) / 10,
        resolved: !(def.options && def.options.length),
    });

    if (!(def.options && def.options.length)) {
        await applyEventEffects(def.autoEffects, `${def.id}::auto::${day}`);
        if (def.kind === 'scandal') {
            await pushTimeline({ day, title: def.title, detail: def.autoEffects?.note || def.desc, kind: 'event', major: true });
        }
    } else {
        openModal({ type: 'event', eventId: row.id, defId: def.id });
    }
}

async function applyEventEffects(effects = {}, seedText = '') {
    const save = state.save;
    if (!save || !effects) return { changes: [], note: '' };
    let note = effects.note || '';

    if (effects.gamble) {
        const { win, outcome } = eventEngine.resolveGamble(effects.gamble, `${save.id}::${seedText}`);
        note = outcome.note || (win ? '赌赢了' : '赌输了');
        if (outcome.attrs) {
            const settled = career.settleAttrDeltas(save.attrs, outcome.attrs, EVENT_DELTA_CAP * 2);
            save.attrs = settled.attributes;
        }
        await persistSave();
        return { changes: [], note };
    }

    let changes = [];
    if (effects.attrs && Object.keys(effects.attrs).length) {
        const settled = career.settleAttrDeltas(save.attrs, effects.attrs, EVENT_DELTA_CAP);
        save.attrs = settled.attributes;
        changes = settled.changes;
    }
    if (effects.energy) {
        save.energy = clamp((save.energy ?? 100) + effects.energy, 0, ENERGY_MAX);
    }
    if (effects.income === 'brand') {
        const amount = Math.round((state.profile?.salary?.monthSalary || 10000) * 1.5);
        await money.grantIncome({
            userId: state.identity.userId, amount,
            sourceType: 'esports-brand', sourceId: `${save.id}::brand::${seedText}`,
            note: '外设代言费', counterpartyName: '品牌方',
        });
        await refreshBalance();
        note = `${note}（代言费 ${amount} 到账）`;
    }
    await persistSave();
    return { changes, note };
}

export async function resolveEventOption(eventLogId, optionId) {
    const save = state.save;
    const row = state.events.find((e) => e.id === eventLogId);
    const def = eventEngine.eventDefById(row?.defId);
    if (!save || !row || !def) return;
    const option = (def.options || []).find((o) => o.id === optionId);
    if (!option) return;

    if (option.costKind) {
        const fame = save.attrs?.fame ?? 0;
        const amount = option.costKind === 'bigMoney' ? prCostByFame(fame) * 5 : prCostByFame(fame);
        const paid = option.costKind === 'bigMoney'
            ? await money.chargeEventCost({ userId: state.identity.userId, amount, sourceId: `${row.id}::${optionId}`, note: `${def.title}：${option.label}` })
            : await money.chargePr({ userId: state.identity.userId, amount, sourceId: `${row.id}::${optionId}`, note: `${def.title}：${option.label}` });
        if (!paid.ok) {
            showToast(paid.error || '余额不足');
            return;
        }
        if (option.costKind === 'pr') {
            save.shieldUntilDay = save.clock.day + 10;
        }
        await refreshBalance();
    }

    const { note } = await applyEventEffects(option.effects, `${row.id}::${optionId}`);

    row.resolved = true;
    row.choice = option.label;
    row.outcome = note || option.effects?.note || '';
    await dbx.saveEvent(appRef, state.identity.profileKey, save.id, toPlain(row));
    state.events = await dbx.listEvents(appRef, save.id);

    if (def.kind === 'scandal') {
        await pushTimeline({
            day: row.day, title: def.title,
            detail: `处理：${option.label}${row.outcome ? ` —— ${row.outcome}` : ''}`,
            kind: 'event', major: true,
        });
        proposePersonaWrite(`经历过「${def.title}」风波，选择了${option.label}。`);
    }
    closeModal();
    syncMurmur();
}

/** 买断黑料：公关护盾 14 天 */
export async function buyPrShield() {
    const save = state.save;
    if (!save) return;
    const day = save.clock.day;
    const amount = prCostByFame(save.attrs?.fame ?? 0);
    const paid = await money.chargePr({
        userId: state.identity.userId,
        amount,
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
        // 1. JS 先掷这段时间的事件（只登记，不弹窗）
        const rolledEvents = [];
        for (let d = save.clock.day + 1; d <= save.clock.day + n; d += 1) {
            const rolled = eventEngine.rollDailyEvents(save.id, d, {
                attrs: save.attrs, day: d,
                shieldUntilDay: save.shieldUntilDay, energy: 80,
                hasAlt: asArray(state.profile?.identities).some((i) => !i.isMain),
                triggeredOnceIds: save.triggeredOnceIds,
                lastTriggeredDayById: save.lastTriggeredDayById,
            });
            for (const { def } of rolled) {
                rolledEvents.push({ day: d, title: def.title, defId: def.id });
                save.lastTriggeredDayById = { ...(save.lastTriggeredDayById || {}), [def.id]: d };
                if (def.once) save.triggeredOnceIds = [...(save.triggeredOnceIds || []), def.id];
            }
        }

        // 2. 推进时钟与赛季（AI 失败时间也照走 —— 时间是系统真相）
        save.clock = clockFastForward(save.clock, n);
        save.energy = ENERGY_MAX;
        save.meals = { day: save.clock.day, lunch: false, dinner: false };
        await advanceSeasonToToday();
        await paySalaryIfDue();

        const autoResults = asArray(save.season?.series)
            .filter((s) => s.result && (s.homeId === state.profile.userTeamId || s.awayId === state.profile.userTeamId))
            .slice(-4)
            .map((s) => {
                const mine = s.homeId === state.profile.userTeamId;
                const my = mine ? s.result.homeScore : s.result.awayScore;
                const opp = mine ? s.result.awayScore : s.result.homeScore;
                const oppId = mine ? s.awayId : s.homeId;
                return { text: `${my}:${opp} ${s.result.winnerId === state.profile.userTeamId ? '胜' : '负'} ${teamNameOf(oppId)}` };
            });

        // 3. AI 叙事（可失败）
        const { text } = buildFastForwardPrompt({
            identity: state.identity, profile: state.profile, save: toPlain(save),
            season: save.season, teamNameOf, timeline: state.timeline,
            days: n, rolledEvents, autoResults, opinion,
        });
        const result = await generateJson({ system: text, temperature: 0.85 });

        let narrative = '';
        let aiError = '';
        if (result.ok && result.data) {
            narrative = tidyText(String(result.data.narrative || ''));
            const settled = career.settleAttrDeltas(save.attrs, result.data.attrDeltas || {}, FAST_FORWARD_DELTA_CAP);
            save.attrs = settled.attributes;
            for (const ev of asArray(result.data.timelineEvents).slice(0, 3)) {
                const day = save.clock.day - n + clamp(ev.dayOffset, 1, n);
                await pushTimeline({
                    day, title: String(ev.title || '一段经历'),
                    detail: String(ev.detail || ''), kind: 'skip', major: false,
                });
            }
        } else {
            aiError = result.error || '';
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
            detail: narrative ? narrative.slice(0, 120) : '这段时间按部就班地过去了',
            kind: 'skip', major: false,
        });

        await persistSave();
        state.events = await dbx.listEvents(appRef, save.id);
        state.timeline = await dbx.listTimeline(appRef, save.id);
        closeModal();
        syncMurmur();
        return { ok: true, aiError };
    } finally {
        state.loading.fastForward = false;
    }
}

// ============================================================
// 用户出战（声浪是赛果事实源；赛点通过服务调这里）
// ============================================================

export function pendingUserSeries() {
    const save = state.save;
    if (!save?.season) return [];
    return asArray(save.season.series).filter((s) => {
        if (s.result || s.day > save.clock.day) return false;
        const home = s.homeSlot && !s.homeId ? seasonEngine.resolvePlayoffSlot(save.season, s.homeSlot) : s.homeId;
        const away = s.awaySlot && !s.awayId ? seasonEngine.resolvePlayoffSlot(save.season, s.awaySlot) : s.awayId;
        return home === state.profile.userTeamId || away === state.profile.userTeamId;
    });
}

/**
 * 打一场用户系列赛（JS 一次掷定全部小局，UI 可逐局揭示，零 API）。
 * @param {string} seriesId
 * @param {Array}  modifiers [{ id, label, value, reason }] 策略/状态修正（可解释）
 */
export async function playUserSeries(seriesId, modifiers = []) {
    const save = state.save;
    if (!save?.season) return { ok: false, error: '现在没有进行中的赛季' };
    const series = save.season.series.find((s) => s.id === seriesId);
    if (!series) return { ok: false, error: '找不到这场比赛' };
    if (series.result) return { ok: false, error: '这场已经打完了', series: toPlain(series) };

    if (series.homeSlot && !series.homeId) series.homeId = seasonEngine.resolvePlayoffSlot(save.season, series.homeSlot);
    if (series.awaySlot && !series.awayId) series.awayId = seasonEngine.resolvePlayoffSlot(save.season, series.awaySlot);
    const myTeam = state.profile.userTeamId;
    if (series.homeId !== myTeam && series.awayId !== myTeam) {
        return { ok: false, error: '这不是你的比赛' };
    }

    const amHome = series.homeId === myTeam;
    const result = seasonEngine.simulateSeries(
        series.id, series.bo,
        {
            id: series.homeId,
            power: powerOfTeam(series.homeId, series.day) + (amHome ? modTotal(modifiers) : 0),
        },
        {
            id: series.awayId,
            power: powerOfTeam(series.awayId, series.day) + (amHome ? 0 : modTotal(modifiers)),
        },
    );

    // MVP：胜方首发 + 用户加权
    const winnerStarters = asArray(state.roster?.players)
        .filter((p) => p.teamId === result.winnerId && !p.isSub)
        .map(displayPlayer);
    const mvpId = seasonEngine.pickSeriesMvp(
        series.id, winnerStarters,
        result.winnerId === myTeam ? { id: 'user', weight: 130 } : null,
    );
    const mvpName = mvpId === 'user' ? state.profile.gameId : (playerById(mvpId)?.gameId || '');
    result.mvpId = mvpId;
    result.mvpName = mvpName;

    save.season = seasonEngine.applyUserSeriesResult(save.season, seriesId, { ...result, modifiers });
    const settledSeries = save.season.series.find((s) => s.id === seriesId);
    await onUserSeriesSettled(settledSeries, { auto: false });
    if (save.season.done) await settleSeasonEnd();
    recomputeHeat();
    await persistSave();
    syncMurmur();
    return { ok: true, series: toPlain(settledSeries) };
}

function modTotal(modifiers) {
    return asArray(modifiers).reduce((acc, m) => acc + (Number(m.value) || 0), 0);
}

/** 用户系列赛落定后的连锁：奖金 / MVP / 属性微调 / 大事记 / 赛后帖 */
async function onUserSeriesSettled(series, { auto }) {
    const save = state.save;
    const myTeam = state.profile.userTeamId;
    const won = series.result.winnerId === myTeam;
    const oppId = series.homeId === myTeam ? series.awayId : series.homeId;
    const my = series.homeId === myTeam ? series.result.homeScore : series.result.awayScore;
    const opp = series.homeId === myTeam ? series.result.awayScore : series.result.homeScore;

    if (won) {
        const bonus = state.profile?.salary?.winBonus || startTierSpec(save.startTier).winBonus;
        await money.grantIncome({
            userId: state.identity.userId, amount: bonus,
            sourceType: 'esports-bonus', sourceId: `${save.id}::bonus::${series.id}`,
            note: `赢下 ${teamNameOf(oppId)}（${my}:${opp}）的奖金`,
            counterpartyName: '俱乐部财务',
        });
        if (series.result.mvpId === 'user') {
            await money.grantIncome({
                userId: state.identity.userId, amount: Math.round(bonus * MVP_BONUS_FACTOR),
                sourceType: 'esports-mvp', sourceId: `${save.id}::mvp::${series.id}`,
                note: '系列赛 MVP 追加奖金', counterpartyName: '俱乐部财务',
            });
        }
        await refreshBalance();
    }

    const deltas = won
        ? { synergy: 1, fame: series.phase === 'playoffs' ? 3 : 1, mentality: 1 }
        : { mentality: -1, fame: series.phase === 'playoffs' ? -1 : 0 };
    const settled = career.settleAttrDeltas(save.attrs, deltas, SEASON_DELTA_CAP);
    save.attrs = settled.attributes;
    if (!auto) {
        save.energy = clamp((save.energy ?? 100) - 14, 0, ENERGY_MAX);
    }

    const big = series.phase === 'gate' || series.phase === 'playoffs' || series.phase === 'ko';
    await pushTimeline({
        day: series.day,
        title: `${won ? '战胜' : '不敌'}${teamNameOf(oppId)}（${my}:${opp}）`,
        detail: `${series.label || `BO${series.bo}`}${series.result.mvpName ? ` · MVP ${series.result.mvpName}` : ''}${auto ? '（快进期间）' : ''}`,
        kind: 'match', major: big,
    });
    await createMatchThread(series);
}

/** 赛后讨论楼（持久帖；正文可再点「生成赛报」由 AI 补写） */
async function createMatchThread(series) {
    const exists = state.posts.some((p) => p.kind === 'match' && p.seriesId === series.id);
    if (exists) return;
    const homeName = teamNameOf(series.homeId);
    const awayName = teamNameOf(series.awayId);
    const post = await dbx.savePost(appRef, state.identity.profileKey, state.save.id, {
        kind: 'match',
        boardId: 'post-match',
        seriesId: series.id,
        day: series.day,
        stance: 'analyst',
        authorHandle: '赛事机器人',
        authorKind: 'official',
        altOf: '',
        title: `【赛后】${homeName} ${series.result.homeScore}:${series.result.awayScore} ${awayName}${series.label ? ` · ${series.label}` : ''}`,
        body: [
            `${homeName} ${series.result.homeScore}:${series.result.awayScore} ${awayName}`,
            `逐局：${series.result.games.map((g) => `第${g.no}局 ${teamNameOf(g.winner)}胜${g.peak ? '（巅峰对决）' : ''}`).join('；')}`,
            series.result.mvpName ? `系列赛 MVP：${series.result.mvpName}` : '',
        ].filter(Boolean).join('\n'),
        commentTotal: clamp(Math.round((state.heat[series.homeId] || 40) / 5) + 6, 6, 60),
        likes: hashString(`ml::${series.id}`) % 120,
        reportDone: false,
    });
    state.posts = [post, ...state.posts.filter((p) => p.id !== post.id)];
}

// ============================================================
// 赛点写回：排位概要（幂等）
// ============================================================

export async function recordRankSession(payload = {}) {
    const save = state.save;
    if (!save) return { ok: false, error: '声浪还没有开档' };
    const sessionId = String(payload.sessionId || '');
    if (!sessionId) return { ok: false, error: '缺少 sessionId' };
    if (asArray(save.rankSummaries).some((r) => r.id === sessionId)) {
        return { ok: true, duplicated: true };
    }

    const summary = {
        id: sessionId,
        day: Number(payload.day) || save.clock.day,
        modeLabel: String(payload.modeLabel || '排位'),
        wins: Number(payload.wins) || 0,
        losses: Number(payload.losses) || 0,
        ratingAfter: Number(payload.ratingAfter) || 0,
        ratingDelta: Number(payload.ratingDelta) || 0,
        matches: asArray(payload.matches).slice(0, 12).map((m) => ({
            win: !!m.win, hero: String(m.hero || ''), kdaText: String(m.kdaText || ''),
        })),
        companions: asArray(payload.companions).map((c) => String(c)),
    };
    save.rankSummaries = [summary, ...asArray(save.rankSummaries)].slice(0, 12);

    // 论坛围观楼（预置评论立刻有，锐评等用户点）
    const stub = forumEngine.rankWatchStub({ session: summary, userGameId: state.profile.gameId });
    const post = await dbx.savePost(appRef, state.identity.profileKey, save.id, {
        kind: 'rank-watch',
        boardId: 'general',
        sessionId,
        day: summary.day,
        stance: stub.goodRun ? 'fan' : 'anti',
        authorHandle: pickBySeed(FAN_HANDLES, `rw::${sessionId}`),
        authorKind: 'fan',
        altOf: '',
        title: stub.title,
        body: stub.summary,
        commentTotal: 12,
        likes: hashString(`rwl::${sessionId}`) % 60,
        sessionSnapshot: summary,
    });
    state.posts = [post, ...state.posts.filter((p) => p.id !== post.id)];
    await persistSave();
    syncMurmur();
    return { ok: true };
}

// ============================================================
// 论坛：板块信息流 / 帖子 / 评论
// ============================================================

export function boards() {
    if (!state.roster) return [];
    return forumEngine.boardsList(state.roster.teams, teamNameOf);
}

/** 模板变量（预置内容的填充材料） */
function templateVars(board) {
    const save = state.save;
    const myTeam = state.profile?.userTeamId;
    const teamId = board?.teamId || myTeam;
    const players = playersOfTeam(teamId, { includeSub: false });
    const seedDay = `${teamId}::${save?.clock?.day || 1}`;
    const player = pickBySeed(players, seedDay);
    const recent = asArray(save?.season?.series)
        .filter((s) => s.result && (s.homeId === teamId || s.awayId === teamId))
        .slice(-1)[0];
    const oppId = recent ? (recent.homeId === teamId ? recent.awayId : recent.homeId) : null;
    const model = userModel();
    return {
        team: teamNameOf(teamId),
        opp: oppId ? teamNameOf(oppId) : teamNameOf(pickBySeed(asArray(state.roster?.teams).filter((t) => t.id !== teamId), seedDay)?.id),
        player: player?.gameId || state.profile?.gameId || '选手',
        user: state.profile?.gameId || '选手',
        score: recent ? `${recent.result.homeScore}:${recent.result.awayScore}` : '3:2',
        hero: pickBySeed(model.heroPool, seedDay) || '新英雄',
        pos: userPosLabel(),
        rank: '巅峰赛',
    };
}

/** 板块信息流：持久帖（用户/AI/赛后/围观）+ 官博 + 每日预置，按时间粗排 */
export function boardFeed(boardId) {
    const save = state.save;
    if (!save) return [];
    const board = boards().find((b) => b.id === boardId);
    if (!board) return [];
    const day = save.clock.day;
    const vars = templateVars(board);

    const persisted = state.posts.filter((p) => p.boardId === boardId);
    const out = [...persisted];

    if (board.kind === 'team') {
        const seriesToday = asArray(save.season?.series).filter((s) => (
            s.result && (s.homeId === board.teamId || s.awayId === board.teamId)
            && s.day >= day - 1
        ));
        out.push(...forumEngine.officialPosts({
            profileKey: state.identity.profileKey,
            day,
            teamId: board.teamId,
            teamName: teamNameOf(board.teamId),
            heat: state.heat[board.teamId] || 40,
            seriesToday,
            teamNameOf,
        }));
    }
    if (board.kind !== 'post-match') {
        const heat = board.kind === 'team'
            ? (state.heat[board.teamId] || 40)
            : Math.round(Object.values(state.heat).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(state.heat).length));
        // 保留近三天的预置帖：改过名的小号在旧楼里还挂着旧名字，等着被扒
        for (let d = day; d >= Math.max(1, day - 2); d -= 1) {
            out.push(...forumEngine.dailyBoardPosts({
                profileKey: state.identity.profileKey,
                day: d, board, heat, roster: state.roster, vars,
            }));
        }
    }
    return out.sort((a, b) => (b.day || 0) - (a.day || 0) || (b.createdAt || 0) - (a.createdAt || 0));
}

/** 找一条帖子（持久的或预置的） */
export function findPost(postId, boardId = '') {
    const persisted = state.posts.find((p) => p.id === postId);
    if (persisted) return persisted;
    const feeds = boardId ? boardFeed(boardId) : boards().flatMap((b) => boardFeed(b.id));
    return feeds.find((p) => p.id === postId) || null;
}

/** 帖子的评论（持久 AI/用户评论 + 预置楼层，按楼层排） */
export async function threadComments(post, page = 0) {
    if (!post || !state.save) return [];
    const persisted = await dbx.listComments(appRef, state.save.id, post.id);
    let preset = [];
    if (post.kind === 'rank-watch' && post.sessionSnapshot) {
        preset = forumEngine.rankWatchComments({
            session: post.sessionSnapshot, page, vars: templateVars(null),
        });
    } else if (post.kind !== 'user' && post.kind !== 'ai') {
        preset = forumEngine.presetComments({
            profileKey: state.identity.profileKey,
            post, page, vars: templateVars(boards().find((b) => b.id === post.boardId)),
            roster: state.roster, day: state.save.clock.day,
        });
    }
    return [...preset, ...persisted.map((c) => ({ ...c, persisted: true }))];
}

/** 用户发帖（默认匿名马甲；identityId 指定用哪个身份） */
export async function createUserPost({ boardId, title, body, identityId }) {
    const save = state.save;
    if (!save) return { ok: false, error: '还没开档' };
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) return { ok: false, error: '标题不能为空' };
    const identity = asArray(state.profile?.identities).find((i) => i.id === identityId)
        || asArray(state.profile?.identities).find((i) => i.isMain);
    const post = await dbx.savePost(appRef, state.identity.profileKey, save.id, {
        kind: 'user',
        boardId: boardId || 'general',
        day: save.clock.day,
        stance: 'passerby',
        authorHandle: identity?.name || '匿名用户',
        authorKind: 'user',
        identityId: identity?.id || '',
        altOf: '',
        title: cleanTitle,
        body: String(body || '').trim(),
        commentTotal: 0,
        likes: 0,
        commentsGenerated: 0,
    });
    state.posts = [post, ...state.posts];
    showToast('发出去了（没人知道是你）');
    return { ok: true, post };
}

export async function deleteUserPost(postId) {
    const post = state.posts.find((p) => p.id === postId);
    if (!post) return;
    await dbx.removePost(appRef, postId);
    state.posts = state.posts.filter((p) => p.id !== postId);
    showToast('帖子已删除');
}

/** 用户回帖（任何楼都能回，身份可选） */
export async function addUserComment({ postId, text, identityId }) {
    const save = state.save;
    const clean = String(text || '').trim();
    if (!save || !clean) return { ok: false };
    const identity = asArray(state.profile?.identities).find((i) => i.id === identityId)
        || asArray(state.profile?.identities).find((i) => i.isMain);
    const persisted = await dbx.listComments(appRef, save.id, postId);
    const comment = await dbx.saveComment(appRef, state.identity.profileKey, save.id, {
        postId,
        seq: 1000 + persisted.length,
        floor: 0,
        handle: identity?.name || '匿名用户',
        identityId: identity?.id || '',
        altOf: '',
        stance: 'passerby',
        text: clean,
        likes: 0,
        byUser: true,
    });
    return { ok: true, comment };
}

/** 生成评论（用户帖 / AI 帖）：追加一批，可删除，不能重 roll */
export async function generateCommentsFor(postId) {
    const post = state.posts.find((p) => p.id === postId);
    const save = state.save;
    if (!post || !save || state.loading.comments) return { ok: false };
    state.loading.comments = postId;
    try {
        const { text } = buildUserPostCommentsPrompt({
            identity: state.identity, profile: state.profile, save: toPlain(save),
            season: save.season, teamNameOf, post,
            identityName: post.authorHandle,
            standingsBrief: standingsBrief(),
        });
        const result = await generateJson({ system: text, temperature: 0.95 });
        if (!result.ok) return { ok: false, error: result.error };
        const persisted = await dbx.listComments(appRef, save.id, postId);
        let seq = 1000 + persisted.length;
        const rows = [];
        for (const c of asArray(result.data?.comments).slice(0, 8)) {
            const textClean = String(c?.text || '').trim();
            if (!textClean) continue;
            seq += 1;
            rows.push(await dbx.saveComment(appRef, state.identity.profileKey, save.id, {
                postId,
                seq,
                floor: 0,
                handle: String(c.handle || '路过网友').slice(0, 20),
                altOf: '',
                stance: ['fan', 'anti', 'passerby', 'analyst', 'memer'].includes(c.stance) ? c.stance : 'passerby',
                text: textClean,
                likes: hashString(`${postId}::${seq}`) % 30,
                byAi: true,
            }));
        }
        post.commentsGenerated = (post.commentsGenerated || 0) + rows.length;
        post.commentTotal = (post.commentTotal || 0) + rows.length;
        await dbx.savePost(appRef, state.identity.profileKey, save.id, toPlain(post));
        return { ok: true, count: rows.length };
    } finally {
        state.loading.comments = '';
    }
}

/** 战绩围观楼：生成锐评（追加持久评论） */
export async function generateRankRoast(postId) {
    const post = state.posts.find((p) => p.id === postId);
    const save = state.save;
    if (!post?.sessionSnapshot || !save || state.loading.roast) return { ok: false };
    state.loading.roast = postId;
    try {
        const { text } = buildRankRoastPrompt({
            identity: state.identity, profile: state.profile, save: toPlain(save),
            session: post.sessionSnapshot,
        });
        const result = await generateJson({ system: text, temperature: 0.95 });
        if (!result.ok) return { ok: false, error: result.error };
        const persisted = await dbx.listComments(appRef, save.id, postId);
        let seq = 1000 + persisted.length;
        let count = 0;
        for (const c of asArray(result.data?.comments).slice(0, 8)) {
            const textClean = String(c?.text || '').trim();
            if (!textClean) continue;
            seq += 1;
            count += 1;
            await dbx.saveComment(appRef, state.identity.profileKey, save.id, {
                postId, seq, floor: 0,
                handle: String(c.handle || '路过网友').slice(0, 20),
                altOf: '', stance: c.stance || 'passerby',
                text: textClean, likes: hashString(`${postId}::${seq}`) % 40, byAi: true,
            });
        }
        return { ok: true, count };
    } finally {
        state.loading.roast = '';
    }
}

export async function deleteCommentById(commentId) {
    await dbx.removeComment(appRef, commentId);
    showToast('评论已删除');
}

/** 板块 AI 帖批量（用户点「让论坛热闹一下」） */
export async function aiBoardBatch(boardId, opinion = '') {
    const save = state.save;
    const board = boards().find((b) => b.id === boardId);
    if (!save || !board || state.loading.boardBatch) return { ok: false };
    state.loading.boardBatch = true;
    try {
        const heat = board.teamId ? (state.heat[board.teamId] || 40) : 50;
        const { text } = buildBoardBatchPrompt({
            identity: state.identity, profile: state.profile, save: toPlain(save),
            season: save.season, teamNameOf, board, heat, opinion,
            standingsBrief: standingsBrief(),
        });
        const result = await generateJson({ system: text, temperature: 0.95 });
        if (!result.ok) return { ok: false, error: result.error };
        let count = 0;
        for (const p of asArray(result.data?.posts).slice(0, 6)) {
            const title = String(p?.title || '').trim();
            if (!title) continue;
            count += 1;
            const post = await dbx.savePost(appRef, state.identity.profileKey, save.id, {
                kind: 'ai',
                boardId,
                day: save.clock.day,
                stance: ['fan', 'anti', 'passerby', 'analyst', 'memer'].includes(p.stance) ? p.stance : 'passerby',
                authorHandle: String(p.handle || '热心网友').slice(0, 20),
                authorKind: 'fan',
                altOf: '',
                title,
                body: String(p.body || '').trim(),
                commentTotal: 0,
                likes: hashString(`aip::${title}`) % 50,
                commentsGenerated: 0,
            });
            state.posts = [post, ...state.posts];
        }
        return { ok: true, count };
    } finally {
        state.loading.boardBatch = false;
    }
}

/** 赛后楼生成赛报（AI 演绎已定结果） */
export async function generateMatchReport(postId, opinion = '') {
    const post = state.posts.find((p) => p.id === postId);
    const save = state.save;
    if (!post?.seriesId || !save?.season || state.loading.report) return { ok: false };
    const series = save.season.series.find((s) => s.id === post.seriesId);
    if (!series?.result) return { ok: false, error: '这场还没有结果' };
    state.loading.report = postId;
    try {
        const { text } = buildMatchReportPrompt({
            identity: state.identity, profile: state.profile, save: toPlain(save),
            season: save.season, teamNameOf, series, opinion,
        });
        const result = await generateText({ system: text, temperature: 0.85 });
        if (!result.ok) return { ok: false, error: result.error };
        post.body = `${post.body}\n\n【赛报】\n${tidyText(result.raw)}`;
        post.reportDone = true;
        await dbx.savePost(appRef, state.identity.profileKey, save.id, toPlain(post));
        return { ok: true };
    } finally {
        state.loading.report = '';
    }
}

function standingsBrief() {
    const save = state.save;
    if (!save?.season) return '';
    const boards2 = seasonEngine.standingsBoards(save.season);
    const mine = boards2.find((b) => b.rows.some((r) => r.teamId === state.profile.userTeamId));
    if (!mine) return '';
    const idx = mine.rows.findIndex((r) => r.teamId === state.profile.userTeamId);
    return `${mine.name}：${teamNameOf(state.profile.userTeamId)}暂列第 ${idx + 1}（${mine.rows[idx].wins}胜${mine.rows[idx].losses}负）`;
}

// ============================================================
// 评分
// ============================================================

export function ratingRows(teamId) {
    const save = state.save;
    if (!save) return [];
    const players = playersOfTeam(teamId, { includeSub: true });
    const day = save.clock.day;
    return players.map((p) => {
        const recent = asArray(save.season?.series)
            .filter((s) => s.result && (s.homeId === teamId || s.awayId === teamId))
            .slice(-3);
        const momentum = recent.reduce((acc, s) => acc + (s.result.winnerId === teamId ? 1 : -0.5), 0);
        const mine = state.ratings.find((r) => r.playerId === p.id);
        return {
            player: p,
            fanScore: forumEngine.fanScoreFor(state.identity.profileKey, p, day, momentum),
            myScore: mine?.score || 0,
            comments: forumEngine.ratingComments(p.id, day),
        };
    });
}

export async function ratePlayer(playerId, score) {
    const save = state.save;
    if (!save) return;
    const row = await dbx.saveRating(appRef, state.identity.profileKey, save.id, {
        playerId, score: clamp(score, 1, 10),
    });
    state.ratings = [...state.ratings.filter((r) => r.playerId !== playerId), row];
    showToast('打分已记录');
}

/** 用户自己的粉丝评分（论坛视角） */
export function userFanScore() {
    const save = state.save;
    if (!save) return 5;
    const fakePlayer = { id: 'user', attrs: save.attrs };
    const recent = asArray(save.season?.series)
        .filter((s) => s.result && (s.homeId === state.profile.userTeamId || s.awayId === state.profile.userTeamId))
        .slice(-3);
    const momentum = recent.reduce((acc, s) => acc + (s.result.winnerId === state.profile.userTeamId ? 1 : -0.5), 0);
    return forumEngine.fanScoreFor(state.identity.profileKey, fakePlayer, save.clock.day, momentum);
}

// ============================================================
// 身份 / 小号
// ============================================================

export async function addIdentity(name) {
    const clean = String(name || '').trim();
    if (!clean) return { ok: false, error: '名字不能为空' };
    if (asArray(state.profile.identities).length >= 5) return { ok: false, error: '最多 5 个身份' };
    state.profile.identities = [...asArray(state.profile.identities), {
        id: uid('idn'), name: clean, isMain: false, createdAt: Date.now(),
    }];
    await dbx.saveProfile(appRef, toPlain(state.profile));
    showToast('小号注册好了');
    return { ok: true };
}

export async function renameIdentity(identityId, name) {
    const clean = String(name || '').trim();
    if (!clean) return;
    state.profile.identities = asArray(state.profile.identities).map((i) => (
        i.id === identityId ? { ...i, name: clean } : i
    ));
    await dbx.saveProfile(appRef, toPlain(state.profile));
    showToast('改好了');
}

export async function removeIdentity(identityId) {
    const target = asArray(state.profile.identities).find((i) => i.id === identityId);
    if (!target || target.isMain) return;
    state.profile.identities = asArray(state.profile.identities).filter((i) => i.id !== identityId);
    await dbx.saveProfile(appRef, toPlain(state.profile));
    showToast('小号注销了（发过的帖子还在）');
}

// ============================================================
// 战队配置 / 社媒偏好 / AI 替换
// ============================================================

export async function renameTeam(teamId, name) {
    const clean = String(name || '').trim();
    if (!clean) return;
    state.profile.teamNames = { ...(state.profile.teamNames || {}), [teamId]: clean };
    await dbx.saveProfile(appRef, toPlain(state.profile));
}

export async function randomizeTeamNames({ includeUserTeam = false } = {}) {
    const fresh = npcEngine.generateTeams(`${state.identity.profileKey}::${Date.now()}`);
    const map = { ...(state.profile.teamNames || {}) };
    asArray(state.roster?.teams).forEach((team, i) => {
        if (!includeUserTeam && team.id === state.profile.userTeamId) return;
        map[team.id] = fresh[i]?.defaultName || team.defaultName;
    });
    state.profile.teamNames = map;
    await dbx.saveProfile(appRef, toPlain(state.profile));
    showToast('战队名重新洗了一遍');
}

/** 把占位选手换成世界观里已有的 AI 角色卡（人设快照 + 哈希 + 串子旗标） */
export async function replaceSlotWithAi(playerId, aiPersonId) {
    const ai = world.listWorldAis().find((a) => a.id === aiPersonId);
    if (!ai) return { ok: false, error: '找不到这个 AI 角色' };
    const snapshot = world.describeAiPersona(aiPersonId);
    state.profile.aiReplacements = {
        ...(state.profile.aiReplacements || {}),
        [playerId]: {
            ...npcEngine.wrapAiAsPlayer(ai, snapshot),
            lurkerFromAi: world.aiHasLurkerTrait(ai),
        },
    };
    await dbx.saveProfile(appRef, toPlain(state.profile));
    rebuildRoster();
    showToast(`${ai.name} 顶上了这个位置`);
    return { ok: true };
}

export async function removeReplacement(playerId) {
    const map = { ...(state.profile.aiReplacements || {}) };
    delete map[playerId];
    state.profile.aiReplacements = map;
    await dbx.saveProfile(appRef, toPlain(state.profile));
    rebuildRoster();
    showToast('恢复了原选手');
}

/** AI 替换的人设卡变了 → 三选一 */
async function checkAiPersonaDiff() {
    const map = state.profile?.aiReplacements || {};
    for (const [slotId, rep] of Object.entries(map)) {
        const now = world.describeAiPersona(rep.aiPersonId);
        if (!now) continue;
        if (hashString(now) !== rep.personaHash) {
            openModal({ type: 'ai-persona-diff', slotId, npcName: rep.name });
            return;
        }
    }
}

export async function resolveAiPersonaDiff(slotId, choice) {
    const rep = state.profile?.aiReplacements?.[slotId];
    if (!rep) { closeModal(); return; }
    if (choice === 'overwrite' || choice === 'stagecard') {
        if (choice === 'stagecard') {
            await createStageCard({
                title: `${rep.name} · 旧人设快照`,
                content: rep.personaSnapshot,
                entityType: 'ai',
                entityId: rep.aiPersonId,
            });
        }
        const snapshot = world.describeAiPersona(rep.aiPersonId);
        state.profile.aiReplacements = {
            ...(state.profile.aiReplacements || {}),
            [slotId]: { ...rep, personaSnapshot: snapshot, personaHash: hashString(snapshot) },
        };
        await dbx.saveProfile(appRef, toPlain(state.profile));
        showToast('快照更新了');
    }
    closeModal();
}

export async function setSocialPrefs(patch = {}) {
    state.profile.socialPrefs = { ...(state.profile.socialPrefs || {}), ...patch };
    await dbx.saveProfile(appRef, toPlain(state.profile));
}

export async function toggleVisibleTeam(teamId) {
    const set = new Set(asArray(state.profile.socialPrefs?.visibleTeamIds));
    if (set.has(teamId)) set.delete(teamId); else set.add(teamId);
    await setSocialPrefs({ visibleTeamIds: [...set] });
}

export async function toggleHiddenPlayer(playerId) {
    const set = new Set(asArray(state.profile.socialPrefs?.hiddenPlayerIds));
    if (set.has(playerId)) set.delete(playerId); else set.add(playerId);
    await setSocialPrefs({ hiddenPlayerIds: [...set] });
}

export async function toggleProviderPref(key) {
    const prefs = { ...(state.profile.providerPrefs || {}) };
    prefs[key] = !prefs[key];
    state.profile.providerPrefs = prefs;
    await dbx.saveProfile(appRef, toPlain(state.profile));
}

// ============================================================
// 锚点编辑（赛事 / 节日）
// ============================================================

async function syncEsportsAnchors() {
    try {
        const { syncEsportsAnchorsToWorld } = await import('@/js/apps/setting/world/sdk/anchor-sync.js');
        const sdk = window.settingsSdk;
        const worldId = state.identity?.worldId;
        if (sdk && worldId) {
            await syncEsportsAnchorsToWorld(sdk, worldId, {
                tournaments: state.profile.tournaments,
                festivals: state.profile.festivals,
            });
        }
    } catch (err) {
        console.warn('[esports] 同步世界观锚点失败', err);
    }
}

export async function updateTournaments(list) {
    state.profile.tournaments = asArray(list);
    await dbx.saveProfile(appRef, toPlain(state.profile));
    await syncEsportsAnchors();
    showToast('赛事配置已保存（下个赛季生效）');
}

export async function updateFestivals(list) {
    state.profile.festivals = asArray(list);
    await dbx.saveProfile(appRef, toPlain(state.profile));
    await syncEsportsAnchors();
    showToast('节日配置已保存');
}

// ============================================================
// 人设改写 / 阶段卡
// ============================================================

export function proposePersonaWrite(line) {
    openModal({ type: 'persona-sync', line: String(line || '') });
}

export async function applyPersonaChoice(choice) {
    const line = state.modal?.line;
    closeModal();
    if (!line) return;
    if (choice === 'overwrite') {
        const ok = await world.appendPersonaExperience('user', state.identity.userId, line);
        if (ok) {
            state.profile.personaWrites = [...asArray(state.profile.personaWrites), {
                saveId: state.save?.id || '', entityType: 'user', entityId: state.identity.userId,
                line, at: Date.now(),
            }];
            await dbx.saveProfile(appRef, toPlain(state.profile));
            showToast('写进人设经历了（台账可回收）');
        }
    } else if (choice === 'stagecard') {
        await createStageCard({ title: line.slice(0, 18), content: line, entityType: 'user', entityId: state.identity.userId });
        showToast('存成阶段卡了');
    }
}

export async function createStageCard({ title, content, entityType = 'user', entityId = '' }) {
    const card = await dbx.saveStageCard(appRef, state.identity.profileKey, {
        title: String(title || '阶段卡'),
        content: String(content || ''),
        entityType,
        entityId: entityId || state.identity.userId,
        saveId: state.save?.id || '',
        day: state.save?.clock?.day || 0,
    });
    state.stageCards = [card, ...state.stageCards];
    return card;
}

export async function deleteStageCard(cardId) {
    await dbx.removeStageCard(appRef, cardId);
    state.stageCards = state.stageCards.filter((c) => c.id !== cardId);
    showToast('阶段卡已删除');
}

// ============================================================
// 主题 / 提示词
// ============================================================

export async function setTheme(themeId) {
    state.profile.themeId = themeId;
    await dbx.saveProfile(appRef, toPlain(state.profile));
    applyThemeFromProfile();
}

export async function setCustomColors(colors) {
    state.profile.customColors = { ...(colors || {}) };
    await dbx.saveProfile(appRef, toPlain(state.profile));
    applyThemeFromProfile();
}

// ============================================================
// 大事记 / 世界观时间轴
// ============================================================

async function pushTimeline({ day, title, detail = '', kind = 'note', major = false }) {
    const save = state.save;
    if (!save) return;
    const entry = await dbx.saveTimelineEntry(appRef, state.identity.profileKey, save.id, {
        day, title, detail, kind, major,
    });
    state.timeline = [entry, ...state.timeline];

    if (major) {
        const eventId = await world.pushWorldTimeline({
            worldId: state.identity.worldId,
            title,
            description: detail,
            dateText: `档内第 ${day} 天`,
        });
        if (eventId) {
            save.worldTimelineIds = [...asArray(save.worldTimelineIds), eventId];
            await persistSave();
        }
    }
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
            timeline: state.timeline, honors: save.honors, opinion,
        });
        const result = await generateText({ system: text, temperature: 0.9 });
        if (!result.ok) return { ok: false, error: result.error };
        save.endingText = tidyText(result.raw);
        save.endedAt = Date.now();
        await persistSave();
        setView('ending');
        return { ok: true };
    } finally {
        state.loading.ending = false;
    }
}

// ============================================================
// murmur 概要卡
// ============================================================

export function syncMurmur() {
    const toolkit = appRef?.toolkit;
    if (!toolkit || !state.save || !state.profile) return;
    const spec = buildCareerSummarySpec({
        save: toPlain(state.save),
        profile: state.profile,
        timeline: state.timeline,
        seasonName: state.save.season && !state.save.season.done ? state.save.season.name : '',
        teamName: teamNameOf(state.profile.userTeamId),
    });
    syncCareerPrompt(toolkit, spec, state.save.id);
}

// ============================================================
// provider 懒读取（注册时传给 social-influence-registry）
// ============================================================

export function readProviderState() {
    const prefs = state.profile?.socialPrefs || {};
    const model = userModel();
    const teammates = state.profile?.configured
        ? userTeammates().map((p) => ({
            id: p.id, gameId: p.gameId,
            posLabel: positionLabel(model, p.positionId),
        }))
        : [];
    const visibleOthers = asArray(prefs.visibleTeamIds)
        .filter((teamId) => teamId !== state.profile?.userTeamId)
        .map((teamId) => ({
            teamName: teamNameOf(teamId),
            names: playersOfTeam(teamId, { includeSub: false })
                .filter((p) => !asArray(prefs.hiddenPlayerIds).includes(p.id))
                .map((p) => p.gameId).join('、'),
        }))
        .filter((x) => x.names);
    return {
        profile: state.profile,
        save: state.save,
        season: state.save?.season || null,
        timeline: state.timeline,
        heat: state.heat,
        teamNameOf,
        teammates,
        visibleOthers,
        rankSummaries: state.save?.rankSummaries || [],
    };
}

// ============================================================
// 给赛点（esports-game）的服务实现
// ============================================================

export async function ensureHydrated(app) {
    if (!state.ready) await hydrate(app || appRef);
    return state.ready;
}

/** 赛点开档所需的完整快照（plain object） */
export function careerStateSnapshot() {
    if (!state.profile?.configured || !state.save) {
        return { ready: false, configured: Boolean(state.profile?.configured) };
    }
    const model = userModel();
    return toPlain({
        ready: true,
        configured: true,
        profileKey: state.identity.profileKey,
        userId: state.identity.userId,
        userName: state.identity.userName,
        currency: state.identity.currency,
        saveId: state.save.id,
        saveName: state.save.name,
        gameId: state.profile.gameId,
        modelId: state.profile.modelId,
        gameName: state.profile.gameName,
        positionId: state.profile.positionId,
        posLabel: userPosLabel(),
        userTeamId: state.profile.userTeamId,
        teamName: teamNameOf(state.profile.userTeamId),
        attrs: state.save.attrs,
        energy: state.save.energy,
        meals: state.save.meals,
        clock: state.save.clock,
        startTier: state.save.startTier,
        peakRating: startTierSpec(state.save.startTier).peakRating,
        heat: state.heat,
        teams: asArray(state.roster?.teams).map((t) => ({
            id: t.id, name: teamNameOf(t.id), tag: t.tag, hue: t.hue, powerBase: t.powerBase,
        })),
        teammates: userTeammates().map((p) => ({
            id: p.id, gameId: p.gameId, realName: p.realName, positionId: p.positionId,
            posLabel: positionLabel(model, p.positionId), isSub: p.isSub, attrs: p.attrs,
            mbti: p.mbti, traits: p.traits, quirk: p.quirk, attitude: p.attitude,
            hue: p.hue, fromAi: p.fromAi === true, aiPersonId: p.aiPersonId || '',
        })),
        coach: (() => {
            const c = coachOfTeam(state.profile.userTeamId);
            return c ? {
                id: c.id, realName: c.realName, style: c.style, mbti: c.mbti,
                traits: c.traits, quirk: c.quirk, hue: c.hue,
            } : null;
        })(),
        season: state.save.season ? {
            name: state.save.season.name,
            phase: state.save.season.phase,
            phaseLabel: seasonEngine.phaseLabel(state.save.season),
            done: state.save.season.done,
        } : null,
        pendingSeries: pendingUserSeries().map((s) => toPlain(s)),
        upcoming: seasonEngine.upcomingUserSeries(state.save.season, state.profile.userTeamId, state.save.clock.day)
            .map((s) => ({ id: s.id, day: s.day, label: s.label, bo: s.bo, oppName: teamNameOf(s.homeId === state.profile.userTeamId ? s.awayId : s.homeId) })),
    });
}

/** 赛点消耗时间（排位 / 训练 / 吃饭） */
export async function spendTime({ minutes, energyDelta = 0, meal = '' }) {
    const save = state.save;
    if (!save) return { ok: false, error: '还没开档' };
    const { clock, hitMidnight } = advanceMinutes(save.clock, minutes);
    save.clock = clock;
    if (energyDelta) save.energy = clamp((save.energy ?? 100) + energyDelta, 0, ENERGY_MAX);
    if (meal === 'lunch') save.meals = { ...(save.meals || {}), day: save.clock.day, lunch: true };
    if (meal === 'dinner') save.meals = { ...(save.meals || {}), day: save.clock.day, dinner: true };
    await persistSave();
    if (hitMidnight) openModal({ type: 'next-day', reason: 'midnight' });
    return { ok: true, hitMidnight, clock: toPlain(save.clock), energy: save.energy, meals: toPlain(save.meals) };
}

/** 赛点写回属性微调（排位后的成长，钳制后结算） */
export async function applyRankOutcome({ attrDeltas = {}, cap = 2 } = {}) {
    const save = state.save;
    if (!save) return { ok: false };
    const settled = career.settleAttrDeltas(save.attrs, attrDeltas, clamp(cap, 1, 4));
    save.attrs = settled.attributes;
    await persistSave();
    syncMurmur();
    return { ok: true, changes: settled.changes, attrs: toPlain(save.attrs) };
}

/** 路线协议：recordMatchResult（幂等，按 seriesId/matchId 去重） */
export async function recordMatchResult(payload = {}) {
    const matchId = String(payload.matchId || payload.seriesId || '');
    if (!matchId) return { ok: false, error: '缺少 matchId' };
    const save = state.save;
    if (!save?.season) return { ok: false, error: '没有进行中的赛季' };
    const series = save.season.series.find((s) => s.id === matchId);
    if (!series) return { ok: false, error: '找不到这场比赛' };
    if (series.result) return { ok: true, duplicated: true, series: toPlain(series) };
    return playUserSeries(matchId, asArray(payload.modifiers));
}

export function flushPersist() {
    if (state.save) void persistSave();
}
