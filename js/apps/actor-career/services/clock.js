/**
 * 追光 · 每档独立时间系统
 *
 * ── 设计 ──────────────────────────────────────────────────────────
 * 每个存档（档）有一条自己的虚拟时间轴：
 *
 *   anchorMs   开档那一刻的现实毫秒，对应「档内第 1 天的 00:00」
 *   day        档内第几天（从 1 开始；快进 = day 直接加）
 *   minute     当日分钟（0..1440；24:00 封顶等用户决定跨日）
 *   syncReal   与现实同步：开着时当日钟点跟现实钟走（跨现实日会提示进入新一天）
 *
 * 「虚拟现实毫秒」= anchorMs + (day-1)×86400000 + minute×60000。
 * 把它喂给世界观纪时系统（chronology.realToWorld）就得到世界日期 ——
 * 纪时开了显示「纪5年3月12日 辰时」，没开显示公历。
 *
 * 这样保证了用户要的三件事：
 *   1. 快进一周 = day+7，整个档的纪时一起走，回不去（除非回档）
 *   2. 新开一档 anchorMs 重置为「现在」，时间线回到原点
 *   3. 调整早/中/晚只动 minute，不影响天数
 *
 * 全部纯函数：传入 clock 返回新 clock，不改原对象、不碰存储。
 */

import { DAY_SLOTS, DAY_START_MINUTE, DAY_END_MINUTE } from '../constants.js';
import { clamp, minuteToHm } from '../utils.js';

const DAY_MS = 86400000;

export function createClock(now = Date.now()) {
    const anchor = new Date(now);
    anchor.setHours(0, 0, 0, 0);
    return {
        anchorMs: anchor.getTime(),
        day: 1,
        minute: clamp(new Date(now).getHours() * 60 + new Date(now).getMinutes(), DAY_START_MINUTE, DAY_END_MINUTE),
        syncReal: true,
        lastRealDayKey: realDayKey(now),
    };
}

export function realDayKey(ms = Date.now()) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 档内当前时刻对应的虚拟现实毫秒 */
export function virtualMs(clock) {
    if (!clock) return Date.now();
    return clock.anchorMs + (clock.day - 1) * DAY_MS + clock.minute * 60000;
}

/** 与现实同步时，把现实钟点带进 minute（不动 day；现实跨日由调用方询问用户） */
export function syncToRealTime(clock, now = Date.now()) {
    if (!clock?.syncReal) return { clock, crossedRealDay: false };
    const d = new Date(now);
    const next = {
        ...clock,
        minute: clamp(d.getHours() * 60 + d.getMinutes(), 0, DAY_END_MINUTE),
    };
    const key = realDayKey(now);
    const crossedRealDay = Boolean(clock.lastRealDayKey && clock.lastRealDayKey !== key);
    return { clock: next, crossedRealDay, realDayKey: key };
}

/** 手动调时段（早 / 中 / 晚 / 深夜）——切手动模式 */
export function setSlot(clock, slotId) {
    const slot = DAY_SLOTS.find((s) => s.id === slotId);
    if (!slot) return clock;
    return { ...clock, minute: slot.minute, syncReal: false };
}

export function setSyncReal(clock, on, now = Date.now()) {
    if (!on) return { ...clock, syncReal: false };
    const d = new Date(now);
    return {
        ...clock,
        syncReal: true,
        minute: clamp(d.getHours() * 60 + d.getMinutes(), 0, DAY_END_MINUTE),
        lastRealDayKey: realDayKey(now),
    };
}

/**
 * 推进若干分钟（安排活动消耗时长）。
 * 到 24:00 封顶：hitMidnight = true，由 UI 问用户「进入下一天，还是明天再玩」。
 */
export function advanceMinutes(clock, minutes) {
    const target = clock.minute + Math.max(0, Math.round(minutes));
    if (target >= DAY_END_MINUTE) {
        return { clock: { ...clock, minute: DAY_END_MINUTE, syncReal: false }, hitMidnight: true };
    }
    return { clock: { ...clock, minute: target, syncReal: false }, hitMidnight: false };
}

/** 进入下一天（用户确认后） */
export function nextDay(clock, now = Date.now()) {
    return {
        ...clock,
        day: clock.day + 1,
        minute: DAY_START_MINUTE,
        lastRealDayKey: realDayKey(now),
    };
}

/** 快进 N 天：整个档的纪时一起走 */
export function fastForward(clock, days) {
    const n = Math.max(1, Math.round(Number(days) || 0));
    return {
        ...clock,
        day: clock.day + n,
        minute: DAY_START_MINUTE,
        syncReal: false,
    };
}

/** 当前时段 id（按 minute 归档到最近的槽位） */
export function currentSlotId(clock) {
    const m = clock?.minute ?? 0;
    if (m < 11 * 60) return 'morning';
    if (m < 17 * 60) return 'noon';
    if (m < 21 * 60 + 30) return 'evening';
    return 'night';
}

export function currentSlotLabel(clock) {
    const id = currentSlotId(clock);
    return DAY_SLOTS.find((s) => s.id === id)?.label || '早';
}

/** 「档内第 12 天 · 与现实相差 +5 天」这种偏移说明 */
export function offsetSummary(clock, now = Date.now()) {
    if (!clock) return '';
    const virtual = virtualMs(clock);
    const diffDays = Math.round((virtual - now) / DAY_MS);
    if (diffDays === 0) return '与现实同步';
    return diffDays > 0 ? `比现实快 ${diffDays} 天` : `比现实慢 ${Math.abs(diffDays)} 天`;
}

export function clockHm(clock) {
    return minuteToHm(clock?.minute ?? 0);
}

/** 当日剩余可安排的小时数 */
export function remainHours(clock) {
    return Math.max(0, (DAY_END_MINUTE - (clock?.minute ?? 0)) / 60);
}
