/**
 * 追光 · 生涯引擎
 *
 * 分线、初始加点、奖项（段锚点）、节日（点锚点）、试镜与演出结算、片酬。
 * AI 只提建议，最终数值全在这里结算（applyAttributeDeltas / resolveContest）。
 */

import {
    ALLOC_KEYS, ATTR_MAX, AWARD_PRESETS, AWARD_NAME_POOL, FESTIVAL_PRESETS,
    PERFORM_GRADES, PROJECT_TYPES, ROLE_LEVELS, tierSpec,
} from '../constants.js';
import {
    applyAttributeDeltas, createSeededRandom, resolveContest,
} from '@/src/core/experience-system.js';
import { clamp, craftScore, hashString, performScore, seededRandom, uid } from '../utils.js';

// ============================================================
// 初始属性
// ============================================================

/** 空白加点表（除知名度全 0，知名度锁定为线级基准） */
export function blankAllocation(tier) {
    const spec = tierSpec(tier);
    const attrs = {};
    for (const key of ALLOC_KEYS) attrs[key] = 0;
    attrs.fame = spec.fameBase;
    return { attrs, budget: spec.budget };
}

export function allocationSpent(attrs = {}) {
    return ALLOC_KEYS.reduce((acc, key) => acc + clamp(attrs[key], 0, ATTR_MAX), 0);
}

export function validateAllocation(attrs = {}, tier) {
    const { budget } = blankAllocation(tier);
    const spent = allocationSpent(attrs);
    if (spent > budget) return { ok: false, error: `超出预算 ${spent - budget} 点` };
    for (const key of ALLOC_KEYS) {
        const v = Number(attrs[key]);
        if (!Number.isFinite(v) || v < 0 || v > ATTR_MAX) {
            return { ok: false, error: '有属性超出 0~100 的范围' };
        }
    }
    return { ok: true, spent, budget, left: budget - spent };
}

/** 一键推荐加点：按职业直觉分配（可再手调） */
export function suggestAllocation(tier, seedText = '') {
    const { budget } = blankAllocation(tier);
    const rand = seededRandom(hashString(`alloc::${seedText || tier}`));
    const weights = {
        voice: 0.9, diction: 1.15, body: 0.95, acting: 1.3,
        empathy: 1.0, camera: 1.05, network: 0.85, resilience: 0.8,
    };
    const jitter = {};
    let total = 0;
    for (const key of ALLOC_KEYS) {
        jitter[key] = weights[key] * (0.85 + rand() * 0.3);
        total += jitter[key];
    }
    const attrs = {};
    let used = 0;
    for (const key of ALLOC_KEYS) {
        const v = Math.min(ATTR_MAX, Math.floor((budget * jitter[key]) / total));
        attrs[key] = v;
        used += v;
    }
    // 余数给表演
    attrs.acting = Math.min(ATTR_MAX, attrs.acting + (budget - used));
    attrs.fame = tierSpec(tier).fameBase;
    return attrs;
}

// ============================================================
// 属性结算（统一入口：一切属性变化都走这里留痕）
// ============================================================

/**
 * @returns {{ attrs, changes }} changes 带 before/applied/after/reason
 */
export function settleAttrDeltas(attrs, deltas, capPerAttr = 0) {
    let entries = Array.isArray(deltas)
        ? deltas
        : Object.entries(deltas || {}).map(([key, value]) => ({ key, value }));
    if (capPerAttr > 0) {
        entries = entries.map((e) => ({
            ...e,
            value: clamp(e.value ?? e.delta, -capPerAttr, capPerAttr),
        }));
    }
    return applyAttributeDeltas(attrs, entries, { min: 0, max: ATTR_MAX });
}

// ============================================================
// 奖项（段锚点）
// ============================================================

/** 默认奖项配置（可整体随机 / 逐项编辑） */
export function defaultAwardConfig() {
    return AWARD_PRESETS.map((preset) => ({
        ...preset,
        conditions: { ...preset.conditions },
        reward: { ...preset.reward },
        enabled: true,
        custom: false,
    }));
}

/** 随机一套奖项：换名字、扰动周期与条件 */
export function randomizeAwards(seedText = String(Date.now())) {
    const rand = seededRandom(hashString(`awards::${seedText}`));
    const names = [...AWARD_NAME_POOL].sort(() => rand() - 0.5);
    return AWARD_PRESETS.map((preset, i) => {
        const drift = (v, span) => Math.max(1, Math.round(v * (1 - span + rand() * span * 2)));
        return {
            ...preset,
            name: rand() < 0.6 ? (names[i % names.length] || preset.name) : preset.name,
            cycleDays: drift(preset.cycleDays, 0.25),
            conditions: {
                ...preset.conditions,
                minFame: preset.conditions.minFame ? drift(preset.conditions.minFame, 0.2) : undefined,
                minCraft: preset.conditions.minCraft ? drift(preset.conditions.minCraft, 0.15) : undefined,
                minWorks: preset.conditions.minWorks,
                maxTier: preset.conditions.maxTier,
            },
            reward: {
                ...preset.reward,
                money: drift(preset.reward.money, 0.3),
                honor: undefined, // 用名字现拼
            },
            enabled: true,
            custom: true,
        };
    });
}

/** 某天到期的奖项（cycleDays 的整数倍那天开奖） */
export function dueAwards(awardConfig, day) {
    return (awardConfig || [])
        .filter((a) => a.enabled !== false && a.cycleDays > 0 && day > 0 && day % a.cycleDays === 0);
}

/** 条件核对（不满足则连提名都没有） */
export function checkAwardConditions(award, save) {
    const c = award?.conditions || {};
    const attrs = save?.attrs || {};
    const fails = [];
    if (c.maxTier && save.tier < c.maxTier) fails.push(`线级已高于 ${c.maxTier} 线（新人限定）`);
    if (c.minFame && clamp(attrs.fame, 0, 100) < c.minFame) fails.push(`知名度不足 ${c.minFame}`);
    if (c.minWorks && (save.finishedWorks || 0) < c.minWorks) fails.push(`完成作品不足 ${c.minWorks} 部`);
    if (c.minCraft && craftScore(attrs) < c.minCraft) fails.push(`声台形表均值不足 ${c.minCraft}`);
    return { ok: fails.length === 0, fails };
}

/**
 * 开奖：条件过了再和「本届竞争场」拼一把（resolveContest，seed 存盘可回放）。
 */
export function evaluateAward(award, save) {
    const gate = checkAwardConditions(award, save);
    if (!gate.ok) return { nominated: false, won: false, fails: gate.fails };

    const seed = hashString(`${save.id}::award::${award.id}::${save.clock?.day || 0}`);
    const player = performScore(save.attrs) + clamp(save.attrs?.fame, 0, 100) * 0.2;
    const field = award.fieldStrength || 60;
    const result = resolveContest({
        playerScore: player,
        opponentScore: field,
        volatility: 0.2,
        upsetChance: 0.06,
        random: createSeededRandom(seed),
    });
    return {
        nominated: true,
        won: award.competitive === false ? true : result.success,
        seed,
        contest: result,
        honor: award.reward?.honor || `${award.name}·获奖`,
    };
}

// ============================================================
// 节日（点锚点）
// ============================================================

export function defaultFestivalConfig() {
    return FESTIVAL_PRESETS.map((f) => ({ ...f, enabled: true }));
}

export function dueFestivals(festivalConfig, day) {
    return (festivalConfig || [])
        .filter((f) => f.enabled !== false && f.everyDays > 0 && day > 0 && day % f.everyDays === 0);
}

/** 未来 N 天的锚点日历（奖项 + 节日） */
export function upcomingAnchors(awardConfig, festivalConfig, day, horizon = 60) {
    const rows = [];
    for (let d = day + 1; d <= day + horizon; d += 1) {
        for (const a of dueAwards(awardConfig, d)) {
            rows.push({ day: d, inDays: d - day, kind: 'award', name: a.name, desc: a.desc });
        }
        for (const f of dueFestivals(festivalConfig, d)) {
            rows.push({ day: d, inDays: d - day, kind: 'festival', name: f.name, desc: f.desc });
        }
    }
    return rows;
}

// ============================================================
// 试镜与演出
// ============================================================

/** 按数值给出「接得到的角色档位」——数值不同，接到的角色不同 */
export function reachableRoles(save) {
    const craft = craftScore(save.attrs);
    const fame = clamp(save.attrs?.fame, 0, 100);
    return ROLE_LEVELS.map((role) => ({
        ...role,
        reachable: craft >= role.craftGate * 0.8 && fame >= role.fameGate * 0.6,
        comfortable: craft >= role.craftGate && fame >= role.fameGate,
    }));
}

/**
 * 试镜：角色档位越高对手越强。seed 存盘，同一次试镜永远同一个结果。
 */
export function audition(save, roleLevelId, projectDifficulty = 55) {
    const role = ROLE_LEVELS.find((r) => r.id === roleLevelId) || ROLE_LEVELS[3];
    const seed = hashString(`${save.id}::audition::${roleLevelId}::${save.clock?.day || 0}::${save.auditionCount || 0}`);
    const opponent = projectDifficulty + role.craftGate * 0.6 + role.fameGate * 0.3;
    const modifiers = [];
    const fame = clamp(save.attrs?.fame, 0, 100);
    if (fame >= role.fameGate) {
        modifiers.push({ id: 'fame-fit', label: '咖位匹配', value: Math.round(fame * 0.15), reason: '制片方看重你的号召力' });
    }
    if ((save.energy ?? 100) < 25) {
        modifiers.push({ id: 'tired', label: '状态疲惫', value: -8, reason: '连轴转的黑眼圈藏不住' });
    }
    const result = resolveContest({
        playerScore: performScore(save.attrs),
        opponentScore: opponent,
        modifiers,
        volatility: 0.18,
        upsetChance: 0.05,
        random: createSeededRandom(seed),
    });
    return { seed, role, result };
}

/**
 * 单场演出（拍摄场次）：一次性掷签，**没有重 roll**。
 * grade 决定这场戏的成色与后续口碑。
 */
export function performScene(save, project, sceneIndex) {
    const seed = hashString(`${save.id}::${project.id}::scene::${sceneIndex}`);
    const difficulty = (project.difficulty || 55) + sceneIndex * 2;
    const result = resolveContest({
        playerScore: performScore(save.attrs),
        opponentScore: difficulty,
        volatility: 0.22,
        upsetChance: 0.06,
        random: createSeededRandom(seed),
    });
    const grade = PERFORM_GRADES[result.grade] || PERFORM_GRADES['close-win'];
    return { seed, result, gradeLabel: grade.label, gradeFactor: grade.factor };
}

// ============================================================
// 片酬与热度
// ============================================================

/** 项目总片酬：线级日薪 × 类型 × 角色档位 × 场次 */
export function projectPay(save, project) {
    const spec = tierSpec(save.tier);
    const type = PROJECT_TYPES.find((t) => t.id === project.type) || PROJECT_TYPES[0];
    const role = ROLE_LEVELS.find((r) => r.id === project.roleLevel) || ROLE_LEVELS[3];
    const scenes = project.scenes?.length || type.scenes;
    return Math.round(spec.dayPay * type.payFactor * role.payFactor * scenes * 1.6);
}

/** 上映热度：平均演出成色 + 知名度 → 火没火（决定综艺邀约与涨粉） */
export function airingResult(save, project) {
    const seed = hashString(`${save.id}::${project.id}::airing`);
    const rand = seededRandom(seed);
    const avgFactor = (project.performRecords || []).length
        ? project.performRecords.reduce((acc, r) => acc + (r.gradeFactor || 1), 0) / project.performRecords.length
        : 1;
    const fame = clamp(save.attrs?.fame, 0, 100);
    const heat = clamp(Math.round(avgFactor * 40 + fame * 0.5 + rand() * 20), 0, 100);
    return {
        seed,
        heat,
        verdict: heat >= 75 ? 'hit' : heat >= 45 ? 'solid' : 'flop',
        fameDelta: heat >= 75 ? 6 : heat >= 45 ? 3 : -1,
    };
}

// ============================================================
// 结局与生涯短评
// ============================================================

export function careerBrief(save) {
    const spec = tierSpec(save.tier);
    return `${spec.label}（${spec.group}）· 档内第 ${save.clock?.day || 1} 天 · 作品 ${save.finishedWorks || 0} 部 · 荣誉 ${
        (save.honors || []).length} 项`;
}

export function newSaveName(existingCount) {
    return `第 ${existingCount + 1} 档`;
}

export function makeId(prefix) {
    return uid(prefix);
}
