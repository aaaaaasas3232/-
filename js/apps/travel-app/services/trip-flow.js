/**
 * 候鸟 · 行程推进（纯函数）
 *
 * 旅行按「天 × 三个时段」推进：第 1 天早 → 午 → 晚 → 第 2 天早 → …
 * slotIndex 是**已生成旁白的数量**（0 = 还没出发）。
 *
 * 这些函数有五个消费方（对话页进度条、继续旁白按钮、旁白 prompt、
 * 完成判定、足迹统计），必须只有一份实现。全是纯函数，node 直接测。
 */

import { DAY_PHASES, TRIP_DAYS_MAX, TRIP_DAYS_MIN } from '../constants.js';
import { clamp } from '../utils.js';

/** 规范化天数：1..7 的整数 */
export function normalizeDays(days) {
    return Math.round(clamp(days, TRIP_DAYS_MIN, TRIP_DAYS_MAX));
}

/** 一趟 days 天的旅行共有多少个旁白段 */
export function totalSlots(days) {
    return normalizeDays(days) * DAY_PHASES.length;
}

/**
 * slotIndex（0 基）→ { day: 1 基, phase: 0..2 }
 * slotIndex 超界时钳到最后一段。
 */
export function slotToStage(slotIndex, days) {
    const total = totalSlots(days);
    const i = Math.round(clamp(slotIndex, 0, Math.max(0, total - 1)));
    return {
        day: Math.floor(i / DAY_PHASES.length) + 1,
        phase: i % DAY_PHASES.length,
    };
}

/** 「第 2 天 · 午」这种给人看的标签 */
export function stageLabel(slotIndex, days) {
    const { day, phase } = slotToStage(slotIndex, days);
    return `第 ${day} 天 · ${DAY_PHASES[phase].label}`;
}

/** 时段图标名（sunrise / sun / moon） */
export function stageIcon(slotIndex, days) {
    const { phase } = slotToStage(slotIndex, days);
    return ['sunrise', 'sun', 'moon'][phase] || 'sun';
}

/** 这一段是不是旅行的最后一段（生成完就该收尾了） */
export function isFinalSlot(slotIndex, days) {
    return Math.round(Number(slotIndex) || 0) >= totalSlots(days) - 1;
}

/** 生成完 slotIndex 之后旅行是否结束 */
export function isTripDone(generatedCount, days) {
    return Math.round(Number(generatedCount) || 0) >= totalSlots(days);
}

/** 进度 0..1，给进度条 */
export function tripProgress(generatedCount, days) {
    const total = totalSlots(days);
    if (total <= 0) return 0;
    return clamp((Number(generatedCount) || 0) / total, 0, 1);
}

/** 「3 天 2 晚」 */
export function tripDurationLabel(days) {
    const d = normalizeDays(days);
    return `${d} 天 ${Math.max(0, d - 1)} 晚`;
}
