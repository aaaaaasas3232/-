/**
 * 声浪 · 小工具
 *
 * 通用纯函数走 social-shared/social-kit.js；这里只放电竞论坛特有的纯计算。
 * 全部不碰 window / DOM，node 测试可直接 import。
 */

export {
    uid, asArray, sameId, clamp, truncate, tidyText, extractJson, toPlain,
    hashString, seededRandom, fmtCap, fmtCount,
    fmtTime, fmtRelative, dayKey, daysBetween,
} from '../social-shared/social-kit.js';

import { clamp, hashString } from '../social-shared/social-kit.js';
import { ATTR_DEFS, ATTR_MAX } from './constants.js';
import { playerPower } from '../esports-shared/esports-kit.js';

/** 属性对象 → 「操80 识65 …」短描述（进 prompt / 概要用） */
export function attrsBrief(attrs = {}) {
    return ATTR_DEFS
        .map((d) => `${d.short}${Math.round(clamp(attrs[d.key], 0, ATTR_MAX))}`)
        .join(' ');
}

/** 竞技实力（不含人气的七维合成，赛场表现用它） */
export function skillScore(attrs = {}) {
    return playerPower(attrs);
}

/** 世界观货币格式 */
export function fmtMoney(value) {
    const n = Math.round(Number(value) || 0);
    return n.toLocaleString('zh-CN');
}

/** 确定性抽取：从数组里按 seed 拿一个 */
export function pickBySeed(list, seedText) {
    if (!Array.isArray(list) || list.length === 0) return null;
    return list[hashString(seedText) % list.length];
}

/** 确定性抽取 N 个（不重复，list 不够就全给） */
export function pickManyBySeed(list, seedText, count) {
    const src = Array.isArray(list) ? [...list] : [];
    const out = [];
    let salt = 0;
    while (out.length < count && src.length > 0) {
        const idx = hashString(`${seedText}::${salt}`) % src.length;
        out.push(src.splice(idx, 1)[0]);
        salt += 1;
    }
    return out;
}

/** 模板占位符填充：{team} {opp} {player} ... */
export function fillTemplate(tpl, vars = {}) {
    return String(tpl || '').replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

/** 0~1 概率 → 「23.5%」 */
export function fmtPercent(p) {
    return `${(clamp(p, 0, 1) * 100).toFixed(1).replace(/\.0$/, '')}%`;
}
