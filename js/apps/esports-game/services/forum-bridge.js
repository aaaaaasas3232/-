/**
 * 赛点 · 声浪桥
 *
 * 声浪（esports-forum）是生涯事实源：赛季、属性、时间、薪资都归它。
 * 赛点只通过 externalAppRegistry 调它的 services —— 绝不 import 它的 store。
 * 声浪不可用时返回明确错误，写回类操作由调用方存 pendingSync 稍后重试。
 */

import { externalAppRegistry } from '@/src/core/app-registry.js';

async function call(serviceName, payload = {}) {
    try {
        const result = await externalAppRegistry.invokeService('esports-forum', serviceName, payload);
        if (result == null) {
            return { ok: false, error: '声浪（电竞论坛）还没就绪，稍后再试' };
        }
        return result;
    } catch (err) {
        console.warn(`[esports-game] 调声浪 ${serviceName} 失败`, err);
        return { ok: false, error: err?.message || String(err) };
    }
}

/** 完整生涯快照（配置 / 属性 / 时钟 / 队友 / 赛程） */
export async function getCareerState() {
    const result = await call('getCareerState');
    // getCareerState 直接返回快照对象（没有 ok 包装）
    if (result && result.ok === false) return result;
    return result;
}

export function getActiveSeason() {
    return call('getActiveSeason');
}

export function listSeasonEvents(payload) {
    return call('listSeasonEvents', payload);
}

/** 出战一场系列赛（声浪掷定并结算奖金/热度/赛后楼） */
export function playUserSeries(payload) {
    return call('playUserSeries', payload);
}

/** 路线协议：赛果写入（幂等） */
export function recordMatchResult(payload) {
    return call('recordMatchResult', payload);
}

/** 写回排位概要（幂等 by sessionId） */
export function recordRankSession(payload) {
    return call('recordRankSession', payload);
}

/** 消耗档内时间 */
export function spendTime(payload) {
    return call('spendTime', payload);
}

/** 写回属性微调 */
export function applyRankOutcome(payload) {
    return call('applyRankOutcome', payload);
}
