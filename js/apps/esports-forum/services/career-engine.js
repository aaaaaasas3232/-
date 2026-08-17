/**
 * 声浪 · 生涯引擎（加点 / 数值结算 / 锚点 / 薪资周期）
 *
 * 一切数值变化走 settleAttrDeltas（内部 applyAttributeDeltas，留 before/applied/after），
 * AI 只出建议 delta，钳制后由代码结算。
 */

import { applyAttributeDeltas } from '@/src/core/experience-system.js';
import {
    ALLOC_KEYS, ATTR_MAX, FESTIVAL_PRESETS, SALARY_PERIOD_DAYS, START_TIERS,
    TOURNAMENT_PRESETS, startTierSpec,
} from '../constants.js';
import { asArray, clamp, hashString, seededRandom } from '../utils.js';

// ============================================================
// 初始加点
// ============================================================

export function blankAllocation(tier) {
    const attrs = {};
    for (const key of ALLOC_KEYS) attrs[key] = 0;
    return { attrs, budget: startTierSpec(tier).budget };
}

export function validateAllocation(attrs = {}, tier) {
    const budget = startTierSpec(tier).budget;
    let spent = 0;
    for (const key of ALLOC_KEYS) {
        const v = Number(attrs[key]) || 0;
        if (v < 0 || v > ATTR_MAX) {
            return { ok: false, error: `${key} 必须在 0~${ATTR_MAX} 之间`, budget, spent };
        }
        spent += v;
    }
    if (spent > budget) {
        return { ok: false, error: `加点超出预算（${spent}/${budget}）`, budget, spent };
    }
    return { ok: true, budget, spent, left: budget - spent };
}

/** 推荐加点：按位置口味加权铺开（确定性） */
export function suggestAllocation(tier, seedKey = '', positionId = '') {
    const { budget } = blankAllocation(tier);
    const rand = seededRandom(hashString(`esf-alloc::${seedKey}::${tier}::${positionId}`));
    // 位置口味：打野/牵制吃意识，射手/突击吃操作，辅助/指挥吃沟通
    const taste = {
        mechanics: 1.15, awareness: 1.1, comms: 0.9, pool: 1,
        mentality: 0.95, stamina: 0.85, synergy: 1.05,
    };
    if (['jungle', 'kiter', 'lurker'].includes(positionId)) taste.awareness = 1.35;
    if (['farm', 'assault', 'hunter'].includes(positionId)) taste.mechanics = 1.35;
    if (['roam', 'assist', 'igl', 'support'].includes(positionId)) { taste.comms = 1.3; taste.synergy = 1.2; }

    const weights = ALLOC_KEYS.map((k) => (taste[k] || 1) * (0.85 + rand() * 0.3));
    const totalW = weights.reduce((a, b) => a + b, 0);
    const attrs = {};
    let used = 0;
    ALLOC_KEYS.forEach((key, i) => {
        const v = Math.min(95, Math.floor((budget * weights[i]) / totalW));
        attrs[key] = v;
        used += v;
    });
    // 余数回填到第一维
    let left = budget - used;
    for (const key of ALLOC_KEYS) {
        if (left <= 0) break;
        const add = Math.min(left, 95 - attrs[key]);
        attrs[key] += add;
        left -= add;
    }
    return attrs;
}

/** 数值结算：逐条钳制 |delta| ≤ cap，再走 applyAttributeDeltas（0~100） */
export function settleAttrDeltas(attrs, deltas, cap = 0) {
    const entries = Array.isArray(deltas)
        ? deltas
        : Object.entries(deltas || {}).map(([key, value]) => ({ key, value }));
    const capped = entries
        .filter((e) => ALLOC_KEYS.includes(e.key) || e.key === 'fame')
        .map((e) => ({
            ...e,
            value: cap > 0 ? clamp(Number(e.value) || 0, -cap, cap) : (Number(e.value) || 0),
        }));
    return applyAttributeDeltas(attrs, capped, { min: 0, max: ATTR_MAX });
}

// ============================================================
// 锚点：赛事（段）与节日（点）
// ============================================================

export function defaultTournamentConfig() {
    return TOURNAMENT_PRESETS.map((t) => ({ ...t }));
}

export function defaultFestivalConfig() {
    return FESTIVAL_PRESETS.map((f) => ({ ...f, enabled: true }));
}

const RANDOM_TOURNAMENT_NAMES = Object.freeze([
    '燎原杯', '破晓杯', '星轨联赛', '风暴角逐战', '苍穹之巅', '斩浪杯', '曙光邀请赛', '雷鸣赛点',
]);

/** 随机一套赛事：只换名字与奖金档，不改 id（启停与进度按 id 存） */
export function randomizeTournaments(seedText) {
    const rand = seededRandom(hashString(`esf-tour::${seedText}`));
    const names = [...RANDOM_TOURNAMENT_NAMES];
    return TOURNAMENT_PRESETS.map((t) => {
        const jitter = 0.7 + rand() * 0.6;
        const name = t.kind === 'major' && names.length && rand() < 0.75
            ? names.splice(Math.floor(rand() * names.length), 1)[0]
            : t.name;
        return {
            ...t,
            name,
            prizeChampion: Math.round((t.prizeChampion * jitter) / 10000) * 10000,
            prizeRunner: Math.round((t.prizeRunner * jitter) / 10000) * 10000,
        };
    });
}

/** 今天到点的节日（点锚点） */
export function dueFestivals(festivals, day) {
    return asArray(festivals).filter((f) => (
        f && f.enabled !== false && f.everyDays > 0 && day > 0 && day % f.everyDays === 0
    ));
}

/** 薪资：第 day 天应已发到第几期（第 1 期在第 SALARY_PERIOD_DAYS+1 天发） */
export function salaryPeriodsDue(day) {
    return Math.max(0, Math.floor((Number(day) - 1) / SALARY_PERIOD_DAYS));
}

/**
 * 未来 horizon 天的锚点日历：比赛日 / 节日 / 发薪日 / 赛季里程碑。
 */
export function upcomingAnchors({ season, festivals, day, userTeamId, horizon = 60, teamNameOf = (x) => x }) {
    const out = [];
    for (let d = day; d <= day + horizon; d += 1) {
        for (const f of dueFestivals(festivals, d)) {
            out.push({ day: d, kind: 'festival', title: f.name, detail: f.desc });
        }
        if (d > day && (d - 1) % SALARY_PERIOD_DAYS === 0) {
            out.push({ day: d, kind: 'salary', title: '发薪日', detail: '俱乐部月薪到账' });
        }
    }
    for (const s of asArray(season?.series)) {
        if (s.result || s.day < day || s.day > day + horizon) continue;
        const mine = s.homeId === userTeamId || s.awayId === userTeamId;
        if (mine || s.phase === 'gate' || s.phase === 'playoffs' || s.phase === 'ko') {
            out.push({
                day: s.day,
                kind: mine ? 'my-match' : 'big-match',
                title: mine ? `出战：对阵 ${teamNameOf(s.homeId === userTeamId ? s.awayId : s.homeId)}` : (s.label || '焦点战'),
                detail: s.label || `BO${s.bo}`,
            });
        }
    }
    return out.sort((a, b) => a.day - b.day).slice(0, 40);
}

export function newSaveName(count) {
    return `第 ${Number(count || 0) + 1} 档`;
}

export function tierOptions() {
    return START_TIERS;
}
