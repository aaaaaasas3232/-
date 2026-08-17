/**
 * 追光 · 小工具
 *
 * 通用纯函数走 social-shared/social-kit.js；这里只放演员系统特有的纯计算。
 * 全部不碰 window / DOM，node 测试可直接 import。
 */

export {
    uid, asArray, sameId, clamp, truncate, tidyText, extractJson, toPlain,
    hashString, seededRandom, fmtCap, fmtCount,
    fmtTime, fmtRelative, dayKey, daysBetween,
} from '../social-shared/social-kit.js';

import { clamp, hashString } from '../social-shared/social-kit.js';
import { ATTR_DEFS, ATTR_MAX } from './constants.js';

/** 声台形表四维平均 —— 「演技功底」，试镜与奖项条件都用它 */
export function craftScore(attrs = {}) {
    const keys = ['voice', 'diction', 'body', 'acting'];
    const sum = keys.reduce((acc, k) => acc + clamp(attrs[k], 0, ATTR_MAX), 0);
    return Math.round(sum / keys.length);
}

/** 试镜 / 演出综合分：演技为主，镜头感共情为辅，知名度小幅加成 */
export function performScore(attrs = {}) {
    return Math.round(
        craftScore(attrs) * 0.55
        + clamp(attrs.camera, 0, ATTR_MAX) * 0.18
        + clamp(attrs.empathy, 0, ATTR_MAX) * 0.15
        + clamp(attrs.fame, 0, ATTR_MAX) * 0.12,
    );
}

/** 属性对象 → 「声80 台65 …」短描述（进 prompt / 概要用） */
export function attrsBrief(attrs = {}) {
    return ATTR_DEFS
        .map((d) => `${d.short}${Math.round(clamp(attrs[d.key], 0, ATTR_MAX))}`)
        .join(' ');
}

/** 分钟 → 「HH:MM」 */
export function minuteToHm(minute) {
    const m = Math.max(0, Math.min(24 * 60, Math.round(Number(minute) || 0)));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** 世界观货币格式（不带币种，币种由世界观决定） */
export function fmtMoney(value) {
    const n = Math.round(Number(value) || 0);
    return n.toLocaleString('zh-CN');
}

/** 确定性抽取：从数组里按 seed 拿一个 */
export function pickBySeed(list, seedText) {
    if (!Array.isArray(list) || list.length === 0) return null;
    return list[hashString(seedText) % list.length];
}

/** 0~1 概率 → 「23.5%」 */
export function fmtPercent(p) {
    return `${(clamp(p, 0, 1) * 100).toFixed(1).replace(/\.0$/, '')}%`;
}
