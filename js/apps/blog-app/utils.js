/**
 * 氧气 · 小工具
 *
 * 通用纯函数在 social-shared/social-kit.js（萤火同款逻辑的共享层），
 * 这里 re-export + 放氧气独有的小计算。全部不碰 window / DOM。
 */

export {
    uid, asArray, sameId, clamp, truncate, tidyText, extractJson, toPlain,
    hashString, seededRandom, fmtCap, fmtCount, remainingCount,
    fmtTime, fmtRelative, dayKey, daysBetween,
} from '../social-shared/social-kit.js';

import { hashString, clamp } from '../social-shared/social-kit.js';

/**
 * 关注规模 → 一条用户帖子的互动数（确定性：同 seed 同结果）。
 * 粉丝多互动多；零粉也不出负数。
 */
export function computePostStats(followers, seedText) {
    const f = Math.max(0, Number(followers) || 0);
    const h = hashString(seedText);
    const jitter = (h % 1000) / 1000;               // 0~1 的确定性抖动
    const reach = Math.round(f * (0.05 + jitter * 0.22)) + (h % 7);
    const likes = Math.round(reach * (0.08 + ((h >> 3) % 100) / 900));
    const comments = Math.round(likes * (0.12 + ((h >> 7) % 100) / 700));
    return {
        reach: Math.max(0, reach),
        likes: Math.max(0, likes),
        comments: Math.max(0, comments),
    };
}

/**
 * 热搜热度的确定性波动：按词条 id + 小时窗演化，普通刷新不跳变。
 * 返回一个「看起来会呼吸」的热度值。
 */
export function hotHeat(baseHeat, termId, hourStamp) {
    const base = Math.max(10, Number(baseHeat) || 0);
    const h = hashString(`${termId}::${hourStamp}`);
    const wave = ((h % 200) - 100) / 100;          // -1 ~ 1
    return Math.max(5, Math.round(base * (1 + wave * 0.18)));
}

/** 帖子作者头像的确定性槽位（0~7，对应 CSS 的 --ox-ava-N） */
export function avatarSlot(id) {
    return hashString(String(id || '?')) % 8;
}

/** 小听颜色 → 几何体填充色（HSL 字符串；小听越浅几何体越浅，饱和度随深度轻微上升） */
export function geometryColor(colorL, shapeId) {
    const l = clamp(colorL, 10, 96);
    const hueSeed = hashString(String(shapeId || '')) % 360;
    const sat = Math.round(18 + (96 - l) * 0.45);   // 浅→素净，深→颜色沉一点
    return `hsl(${hueSeed}, ${clamp(sat, 8, 62)}%, ${l}%)`;
}

/** 小听本体颜色（无彩相的暖灰，只由 lightness 决定） */
export function xiaotingBodyColor(colorL) {
    const l = clamp(colorL, 10, 96);
    return `hsl(28, 8%, ${l}%)`;
}
