/**
 * 声浪 · 突发事件引擎（人气加权，与追光同一套数学）
 *
 * 一个事件在「某档某天」的真实概率由四层相乘：
 *   1. 人气曲线：p0 = base × (peak/base)^(fame/100) —— 树大招风，越红越容易上热搜
 *   2. 属性护盾：每条 guard 让 p ×= factor^((attr - pivot)/50)
 *   3. 公关护盾：买断期间（shieldUntilDay 未过）舆情类 ×0.15
 *   4. 状态修正：精力见底（<20）当天所有事件 ×1.3
 *
 * 掷签 seed = `${saveId}::day${day}::${eventId}`：同档同天永远同一批，回放一致。
 * 每天常规事件 ≤2（舆情优先）。
 */

import {
    ENERGY_DANGER, EVENT_DEFS, LOW_ENERGY_EVENT_MULTIPLIER,
} from '../constants.js';
import { clamp, hashString, seededRandom } from '../utils.js';

const DEFAULT_FLOOR = 0.004;
const DEFAULT_CAP = 0.9;

/** 人气插值：fame 0 → base，fame 100 → peak，指数上升 */
export function fameCurveP(curve, fame) {
    const base = Math.max(0.0001, Number(curve?.base) || 0.01);
    const peak = Math.max(base, Number(curve?.peak) || base);
    const t = clamp(fame, 0, 100) / 100;
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
 * 一个事件此刻的完整概率与分解（分解给 UI 做「风险透明」展示）。
 * @param {object} ctx { attrs, day, shieldUntilDay, energy, hasAlt, triggeredOnceIds, lastTriggeredDayById }
 */
export function eventProbability(def, ctx = {}) {
    const attrs = ctx.attrs || {};
    const fame = clamp(attrs.fame, 0, 100);

    if (def.once && (ctx.triggeredOnceIds || []).includes(def.id)) {
        return { p: 0, blocked: 'once', parts: null };
    }
    if (def.requiresAlt && !ctx.hasAlt) {
        return { p: 0, blocked: 'no-alt', parts: null };
    }
    if (def.minFameBase && fame < def.minFameBase) {
        return { p: 0, blocked: 'fame-low', parts: null };
    }
    const lastDay = (ctx.lastTriggeredDayById || {})[def.id];
    if (def.cooldownDays && Number.isFinite(lastDay) && (ctx.day - lastDay) < def.cooldownDays) {
        return { p: 0, blocked: 'cooldown', parts: null };
    }

    const base = fameCurveP(def.curve, fame);
    const guard = guardFactor(def.guards, attrs);
    const shielded = def.shieldable && Number(ctx.shieldUntilDay) >= ctx.day;
    const shield = shielded ? 0.15 : 1;
    const lowEnergy = clamp(ctx.energy, 0, 100) < ENERGY_DANGER ? LOW_ENERGY_EVENT_MULTIPLIER : 1;

    const raw = base * guard * shield * lowEnergy;
    const p = clamp(raw, def.floor ?? DEFAULT_FLOOR, def.cap ?? DEFAULT_CAP);
    return { p, blocked: '', parts: { base, guard, shield, lowEnergy, shielded } };
}

/** 某档某天掷签（确定性）。每天常规 ≤2，舆情优先。 */
export function rollDailyEvents(saveId, day, ctx = {}) {
    const triggered = [];
    for (const def of EVENT_DEFS) {
        const { p } = eventProbability(def, { ...ctx, day });
        if (p <= 0) continue;
        const rand = seededRandom(hashString(`${saveId}::day${day}::${def.id}`));
        if (rand() < p) triggered.push({ def, p });
    }
    const order = { scandal: 0, chance: 1, form: 2, industry: 3 };
    triggered.sort((a, b) => (order[a.def.kind] ?? 9) - (order[b.def.kind] ?? 9));
    return triggered.slice(0, 2);
}

/** 给 UI 的「此刻风险面板」（按概率倒序） */
export function riskPanel(ctx = {}) {
    return EVENT_DEFS
        .map((def) => ({ def, ...eventProbability(def, ctx) }))
        .filter((row) => !row.blocked || row.blocked === 'cooldown')
        .sort((a, b) => b.p - a.p);
}

/** 事件选项里的赌博分支（小号开麦对线这类） */
export function resolveGamble(gamble, seedText) {
    if (!gamble) return null;
    const rand = seededRandom(hashString(seedText));
    const win = rand() < clamp(gamble.chance, 0, 1);
    return { win, outcome: win ? (gamble.win || {}) : (gamble.lose || {}) };
}

export function eventDefById(id) {
    return EVENT_DEFS.find((d) => d.id === id) || null;
}
