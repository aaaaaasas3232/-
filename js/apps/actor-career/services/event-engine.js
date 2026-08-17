/**
 * 追光 · 突发事件引擎
 *
 * ── 加权概率（用户点名要认真做的那部分）─────────────────────────────
 *
 * 一个事件在「某档某天」的真实概率由四层相乘：
 *
 *   1. 分线曲线：p0 = base × (peak/base)^t，t = (18-tier)/17 ∈ [0,1]
 *      —— 指数插值。「被全网黑」18 线 5%、1 线 80%，中段不是直线而是
 *      越接近顶流涨得越快，符合「树大招风」的直觉。
 *
 *   2. 属性护盾：每条 guard 让 p ×= factor^((attr - pivot)/50)
 *      —— 属性比 pivot 高 50 点，概率乘一次 factor（<1 保护）；
 *      低 50 点则除一次（反向放大）。数值特别好的顶流可以把 80% 压到 ~25%。
 *
 *   3. 公关护盾：买断黑料期间（shieldUntilDay 未过）舆情类 ×0.15。
 *
 *   4. 状态修正：精力见底（<20）当天所有事件 ×1.35。
 *
 * 最后 clamp 到 [floor, cap]（默认 0.5%~95%）。
 *
 * ── 掷签 ───────────────────────────────────────────────────────────
 * 每天结算时对全事件库逐个掷签，seed = `${saveId}::${day}::${eventId}`，
 * 同一档同一天永远掷出同一批 —— 回档重放结果一致，不存在「刷出好事件」。
 * 每天最多触发 2 件（舆情优先），隐藏事件不占额度。
 */

import {
    EVENT_DEFS, ENERGY_DANGER, LOW_ENERGY_EVENT_MULTIPLIER,
} from '../constants.js';
import { clamp, hashString, seededRandom } from '../utils.js';

const DEFAULT_FLOOR = 0.005;
const DEFAULT_CAP = 0.95;

/** 分线插值：t=0 是 18 线，t=1 是 1 线 */
export function tierCurveP(curve, tier) {
    const base = Math.max(0.0001, Number(curve?.base) || 0.01);
    const peak = Math.max(base, Number(curve?.peak) || base);
    const t = clamp((18 - clamp(tier, 1, 18)) / 17, 0, 1);
    return base * Math.pow(peak / base, t);
}

/** 属性护盾因子（全部 guard 相乘） */
export function guardFactor(guards, attrs = {}) {
    let factor = 1;
    for (const g of guards || []) {
        const value = clamp(attrs[g.attr], 0, 100);
        const pivot = Number(g.pivot) || 50;
        const f = Math.max(0.05, Number(g.factor) || 1);
        factor *= Math.pow(f, (value - pivot) / 50);
    }
    return factor;
}

/**
 * 一个事件此刻的完整概率与分解（分解给 UI 做「概率透明」展示）。
 * @param {object} def 事件定义
 * @param {object} ctx { tier, attrs, day, shieldUntilDay, energy, hasProject, triggeredOnceIds, lastTriggeredDayById }
 */
export function eventProbability(def, ctx = {}) {
    const tier = clamp(ctx.tier, 1, 18);
    const attrs = ctx.attrs || {};

    // 硬性排除
    if (def.once && (ctx.triggeredOnceIds || []).includes(def.id)) {
        return { p: 0, blocked: 'once', parts: null };
    }
    if (def.requiresProject && !ctx.hasProject) {
        return { p: 0, blocked: 'no-project', parts: null };
    }
    if (def.minFameBase && clamp(attrs.fame, 0, 100) < def.minFameBase) {
        return { p: 0, blocked: 'fame-low', parts: null };
    }
    const lastDay = (ctx.lastTriggeredDayById || {})[def.id];
    if (def.cooldownDays && Number.isFinite(lastDay) && (ctx.day - lastDay) < def.cooldownDays) {
        return { p: 0, blocked: 'cooldown', parts: null };
    }

    const base = tierCurveP(def.curve, tier);
    const guard = guardFactor(def.guards, attrs);
    const shielded = def.shieldable && Number(ctx.shieldUntilDay) >= ctx.day;
    const shield = shielded ? 0.15 : 1;
    const lowEnergy = clamp(ctx.energy, 0, 100) < ENERGY_DANGER ? LOW_ENERGY_EVENT_MULTIPLIER : 1;

    const raw = base * guard * shield * lowEnergy;
    const p = clamp(raw, def.floor ?? DEFAULT_FLOOR, def.cap ?? DEFAULT_CAP);

    return {
        p,
        blocked: '',
        parts: { base, guard, shield, lowEnergy, shielded },
    };
}

/**
 * 某档某天掷签（确定性）。
 * @returns {Array<object>} 今天触发的事件定义（≤2 常规 + 隐藏另算）
 */
export function rollDailyEvents(saveId, day, ctx = {}) {
    const triggered = [];
    for (const def of EVENT_DEFS) {
        const { p } = eventProbability(def, { ...ctx, day });
        if (p <= 0) continue;
        const rand = seededRandom(hashString(`${saveId}::day${day}::${def.id}`));
        if (rand() < p) triggered.push({ def, p });
    }

    // 舆情 > 隐藏 > 机遇 > 行业 > 交际；每天常规事件最多 2 件，隐藏不占额度
    const order = { scandal: 0, hidden: 1, chance: 2, industry: 3, social: 4 };
    triggered.sort((a, b) => (order[a.def.kind] ?? 9) - (order[b.def.kind] ?? 9));

    const hidden = triggered.filter((t) => t.def.kind === 'hidden');
    const normal = triggered.filter((t) => t.def.kind !== 'hidden').slice(0, 2);
    return [...normal, ...hidden.slice(0, 1)];
}

/** 给 UI 的「此刻风险面板」：每个可能事件的当前概率（按概率倒序） */
export function riskPanel(ctx = {}) {
    return EVENT_DEFS
        .map((def) => ({ def, ...eventProbability(def, ctx) }))
        .filter((row) => !row.blocked || row.blocked === 'cooldown')
        .sort((a, b) => b.p - a.p);
}

/** 事件选项里的赌博分支（税务风波「赌它查不到」这类） */
export function resolveGamble(gamble, seedText) {
    if (!gamble) return null;
    const rand = seededRandom(hashString(seedText));
    const win = rand() < clamp(gamble.chance, 0, 1);
    return { win, outcome: win ? (gamble.win || {}) : (gamble.lose || {}) };
}

export function eventDefById(id) {
    return EVENT_DEFS.find((d) => d.id === id) || null;
}
