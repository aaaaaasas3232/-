/**
 * 氧气 · 小听的机制（纯函数，node 测试直接 import）
 *
 * 出现概率 / 颜色漂移 / 记忆淘汰 / 恶作剧频控，全部由 JS 决定，
 * AI 只负责说话和做几何体。常量在 constants.js 的 XIAOTING 里。
 */

import { SHAPE_IDS, SIZE_HINTS, XIAOTING } from '../constants.js';
import { clamp } from '../utils.js';

/**
 * 这次进房间她出现的概率。
 * @param {object} s { sessionsCount, negativeStreak, positiveStreak, lastMood, appearedOnce }
 * @returns {number} 0~1
 */
export function appearProbability(s = {}) {
    const sessions = Math.max(0, Number(s.sessionsCount) || 0);
    if (sessions < XIAOTING.APPEAR_FREE_SESSIONS) return 0;

    // 出现过之后：常驻倾向 —— 低落时几乎总在，状态好时常常不在（去玩了）
    if (s.appearedOnce) {
        const low = (Number(s.lastMood) || 0) < 0 || (Number(s.negativeStreak) || 0) > 0;
        return low ? XIAOTING.STAY_WHEN_LOW : XIAOTING.STAY_WHEN_FINE;
    }

    let p = XIAOTING.APPEAR_BASE;
    p += (Math.max(0, Number(s.negativeStreak) || 0)) * XIAOTING.APPEAR_PER_NEGATIVE;
    p -= (Math.max(0, Number(s.positiveStreak) || 0)) * XIAOTING.APPEAR_DROP_PER_POSITIVE;
    if ((Number(s.lastMood) || 0) <= -2) {
        p = Math.max(p, XIAOTING.APPEAR_MIN_WHEN_VERY_LOW);
    }
    return clamp(p, 0, XIAOTING.APPEAR_CAP);
}

/**
 * 整理后按 mood 更新连败 / 连胜与颜色。
 * @param {object} s { colorL, negativeStreak, positiveStreak }
 * @param {number} mood -2~2
 * @param {Function} [rand] 0~1 随机源（默认 Math.random，测试可传定值）
 * @returns {{ colorL:number, negativeStreak:number, positiveStreak:number, lastMood:number }}
 */
export function driftAfterSession(s = {}, mood = 0, rand = Math.random) {
    const m = clamp(Math.round(mood), -2, 2);
    const spread = XIAOTING.COLOR_DRIFT_MAX - XIAOTING.COLOR_DRIFT_MIN;
    const step = XIAOTING.COLOR_DRIFT_MIN + rand() * spread;
    // mood 越负颜色越深（lightness 下降）；正向缓慢变浅
    const delta = m < 0 ? -step * (Math.abs(m)) : step * (m * 0.6);
    const colorL = clamp((Number(s.colorL) || XIAOTING.COLOR_INIT) + delta, XIAOTING.COLOR_MIN, XIAOTING.COLOR_MAX);

    let negativeStreak = Math.max(0, Number(s.negativeStreak) || 0);
    let positiveStreak = Math.max(0, Number(s.positiveStreak) || 0);
    if (m < 0) {
        negativeStreak += 1;
        positiveStreak = 0;
    } else if (m > 0) {
        positiveStreak += 1;
        negativeStreak = 0;
    }
    return { colorL: Math.round(colorL * 10) / 10, negativeStreak, positiveStreak, lastMood: m };
}

/**
 * 记忆碎片淘汰：超上限时先丢最旧的普通碎片，用户输入（关机输入框）的优先保留。
 * fragment: { text, source, at }
 */
export function capMemories(fragments) {
    const list = Array.isArray(fragments) ? fragments.filter((f) => f && f.text) : [];
    if (list.length <= XIAOTING.MEMORY_CAP) return list;
    const keep = [...list].sort((a, b) => {
        const wa = a.source === 'shutdown' ? 1 : 0;
        const wb = b.source === 'shutdown' ? 1 : 0;
        if (wa !== wb) return wa - wb;          // 普通的排前面（先被淘汰）
        return (a.at || 0) - (b.at || 0);       // 旧的排前面
    });
    return keep.slice(keep.length - XIAOTING.MEMORY_CAP)
        .sort((a, b) => (a.at || 0) - (b.at || 0));
}

/**
 * 恶作剧频控判定。只管「能不能」，不管「做什么」。
 * @param {object} s { appearedOnce, pranksEnabled, lastPrankAt }
 * @param {number} now
 * @param {number} hour 当前小时（0~23）
 * @param {Function} rand
 */
export function canPrank(s = {}, now = Date.now(), hour = new Date().getHours(), rand = Math.random) {
    if (!s.appearedOnce) return false;
    if (s.pranksEnabled === false) return false;
    if (hour >= XIAOTING.PRANK_QUIET_FROM || hour < XIAOTING.PRANK_QUIET_TO) return false;
    if (now - (Number(s.lastPrankAt) || 0) < XIAOTING.PRANK_MIN_GAP_MS) return false;
    return rand() < XIAOTING.PRANK_CHANCE;
}

/**
 * 是否送礼物（整理第 3 步之前由 JS 决定，AI 不参与）。
 * 低落时更倾向送；同一次整理最多 1 个（调用方保证）。
 */
export function shouldGift(mood, rand = Math.random) {
    const m = clamp(Math.round(mood), -2, 2);
    const p = m <= -2 ? 0.85 : m === -1 ? 0.6 : m === 0 ? 0.35 : m === 1 ? 0.25 : 0.2;
    return rand() < p;
}

/**
 * 几何体白名单解析：非法字段丢弃，绝不执行 AI 返回的任何代码。
 * @returns {{shape:string, sealedQuote:string, sizeHint:string}|null}
 */
export function parseGiftSpec(data) {
    if (!data || typeof data !== 'object') return null;
    const shape = String(data.shape || '').trim();
    if (!SHAPE_IDS.includes(shape)) return null;
    const sealedQuote = String(data.sealedQuote || '').trim().slice(0, 40);
    if (!sealedQuote) return null;
    const sizeHint = SIZE_HINTS.includes(String(data.sizeHint || '').trim())
        ? String(data.sizeHint).trim()
        : '中';
    return { shape, sealedQuote, sizeHint };
}
