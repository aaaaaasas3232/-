/**
 * 氧气 · 数值规则（纯函数，node 测试直接 import）
 *
 * 所有常量在 constants.js 的 OXYGEN 里。engine（store）只做读写和联动，
 * 「加多少 / 扣多少」的账全在这里算，每一笔都能解释。
 */

import { OXYGEN } from '../constants.js';
import { clamp, daysBetween } from '../utils.js';

/** 表达类型 → 基础增益 */
export function baseGain(type) {
    return OXYGEN.GAIN[type] || 0;
}

/**
 * 算一次表达的实际增益（考虑同日递减）。
 * @param {string} type long|short|murmur|essay|meditation
 * @param {number} todayCount 今天已经表达过几次（本次之前）
 * @returns {number} 实际加多少
 */
export function gainFor(type, todayCount) {
    const base = baseGain(type);
    if (base <= 0) return 0;
    const n = Math.max(0, Number(todayCount) || 0);
    if (n >= OXYGEN.DIMINISH_AFTER) {
        return Math.max(1, Math.round(base / 2));
    }
    return base;
}

/**
 * 结算衰减：从 lastSettleDay 到 today 之间隔了几天就扣几天，带单次上限。
 * 同一天内重复结算不扣（days = 0）。
 * @returns {{ decay:number, days:number }}
 */
export function decayFor(lastSettleDay, today) {
    if (!lastSettleDay) return { decay: 0, days: 0 };
    const days = daysBetween(lastSettleDay, today);
    if (days <= 0) return { decay: 0, days: 0 };
    const decay = Math.min(OXYGEN.DECAY_CAP, days * OXYGEN.DAILY_DECAY);
    return { decay, days };
}

/** clamp 到 0~100 */
export function clampOxygen(value) {
    return clamp(Math.round(Number(value) || 0), 0, OXYGEN.MAX);
}

/** 是否低氧（电池变红 + 首页轻提示） */
export function isLow(value) {
    return clampOxygen(value) <= OXYGEN.LOW_THRESHOLD;
}

/**
 * 生成一条流水（调用方负责 push + 截断）。
 * @returns {{at:number, reason:string, delta:number, before:number, after:number}}
 */
export function ledgerEntry(reason, before, after) {
    return {
        at: Date.now(),
        reason: String(reason || ''),
        delta: clampOxygen(after) - clampOxygen(before),
        before: clampOxygen(before),
        after: clampOxygen(after),
    };
}

/** 流水截断 */
export function capLedger(ledger) {
    const list = Array.isArray(ledger) ? ledger : [];
    return list.length > OXYGEN.LEDGER_CAP ? list.slice(list.length - OXYGEN.LEDGER_CAP) : list;
}
