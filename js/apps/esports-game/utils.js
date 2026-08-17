/**
 * 赛点 · 小工具
 *
 * 通用纯函数走 social-shared/social-kit.js；这里只放游戏客户端特有的纯计算。
 */

export {
    uid, asArray, sameId, clamp, truncate, tidyText, extractJson, toPlain,
    hashString, seededRandom, fmtCap, fmtCount,
    fmtTime, fmtRelative, dayKey, daysBetween,
} from '../social-shared/social-kit.js';

import { clamp } from '../social-shared/social-kit.js';

/** KDA 数组 → 「7/2/11」 */
export function kdaText(k, d, a) {
    return `${k}/${d}/${a}`;
}

/** 胜率文本 */
export function winRateText(wins, losses) {
    const total = wins + losses;
    if (!total) return '—';
    return `${Math.round((wins / total) * 100)}%`;
}

/** 分钟 → 「1小时20分」 */
export function minutesText(minutes) {
    const m = Math.max(0, Math.round(Number(minutes) || 0));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (!h) return `${mm}分钟`;
    return mm ? `${h}小时${mm}分` : `${h}小时`;
}

/** 巅峰分变化文本 */
export function deltaText(delta) {
    const n = Math.round(Number(delta) || 0);
    return n >= 0 ? `+${n}` : String(n);
}

/** 0~100 clamp 快捷 */
export function pct(value) {
    return clamp(value, 0, 100);
}
