/**
 * 萤火 · 头像分配纯逻辑
 *
 * 从 avatar-pool.js 拆出来的原因：pool 那头 import 了 externalAppRegistry
 * （浏览器链），node 测试没法安全 import；这里只依赖 utils，纯函数可测。
 */

import { asArray, hashString } from '../utils.js';

/**
 * 给一个 externalId 挑图片：从哈希起点开始找第一张还没被用的；
 * 全被用过就直接用哈希位（重复无妨 —— 人比图多的时候只能共用）。
 *
 * @param {string} externalId
 * @param {{code:string}[]} images
 * @param {Record<string, {code:string}>} avatarMap 已有映射（不改动）
 * @param {string} [salt] 重新分配时换一个 salt 就能全员换脸
 * @returns {string} code（图组为空返回 ''）
 */
export function pickAvatarCode(externalId, images, avatarMap = {}, salt = '') {
    const list = asArray(images).filter((img) => img && img.code);
    if (!list.length) return '';
    const used = new Set(Object.values(avatarMap || {}).map((v) => String(v?.code || '')));
    const start = hashString(`${salt}::${externalId}`) % list.length;
    for (let i = 0; i < list.length; i += 1) {
        const candidate = list[(start + i) % list.length];
        if (!used.has(candidate.code)) return candidate.code;
    }
    return list[start].code;
}

/** 占位头像的色槽（0~7，对应 CSS .yt-avatar--p0 ~ p7；稳定） */
export function fallbackSlot(externalId) {
    return hashString(`avatar::${externalId}`) % 8;
}
