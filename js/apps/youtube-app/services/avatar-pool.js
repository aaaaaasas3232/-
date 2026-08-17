/**
 * 萤火 · 头像池（图库绑定）
 *
 * 需求：绑定 nook 图库的一个图组后，站内用户（频道主 / 评论区观众）的头像
 * 从图组里取，而不是默认占位；**同一个 externalId 的头像映射必须持久化**，
 * 刷新后不能换脸（映射存在 profile.avatarMap，跟档案走）。
 *
 * 读图库走 settings 的对外 services（externalAppRegistry），
 * 不 import 它的内部模块 —— 和候鸟读四叶草物品同款理由（AGENTS2 §15.10）。
 *
 * 图库为空 / 未绑定时用确定性占位头像（色块 + 首字），不用 emoji、
 * 不引用网络随机头像。
 */

import { externalAppRegistry } from '@/src/core/app-registry.js';
import { asArray } from '../utils.js';
import { pickAvatarCode } from './avatar-logic.js';

// 纯逻辑住在 avatar-logic.js（node 可测），这里透传给组件用
export { fallbackSlot, pickAvatarCode } from './avatar-logic.js';

const SETTINGS_APP = 'settings';

/** code → dataUrl 的内存缓存（图片是 base64，读一次就够了） */
const srcCache = new Map();
/** groupId → 图片元信息列表 的内存缓存 */
const groupCache = new Map();

// ============================================================
// 图库读取（全部经 settings services，找不到就安静降级）
// ============================================================

/** 所有可绑定的图组（顺带路径，绑定 UI 用） */
export async function listGalleryGroups() {
    let rows = null;
    try {
        rows = await externalAppRegistry.invokeService(SETTINGS_APP, 'galleryListAllGroups', {});
    } catch (err) {
        console.warn('[youtube] 读图库图组失败', err);
        return [];
    }
    return asArray(rows).map((g) => ({
        id: String(g?.id || ''),
        name: String(g?.name || '未命名图组'),
        path: String(g?.path || ''),
        imageCount: Number(g?.imageCount) || 0,
    })).filter((g) => g.id);
}

/** 某图组的图片元信息（code / name / thumbnail），带缓存 */
export async function listGroupImages(groupId) {
    const id = String(groupId || '');
    if (!id) return [];
    if (groupCache.has(id)) return groupCache.get(id);
    let rows = null;
    try {
        rows = await externalAppRegistry.invokeService(SETTINGS_APP, 'galleryListGroupImages', { groupId: id });
    } catch (err) {
        console.warn('[youtube] 读图组图片失败', err);
        return [];
    }
    const list = asArray(rows).map((img) => ({
        code: String(img?.code || ''),
        name: String(img?.name || ''),
    })).filter((img) => img.code);
    if (list.length) groupCache.set(id, list);
    return list;
}

/** 按图库编号取图片 dataUrl（带缓存；取不到返回 ''） */
export async function resolveAvatarSrc(code) {
    const key = String(code || '');
    if (!key) return '';
    if (srcCache.has(key)) return srcCache.get(key);
    let src = '';
    try {
        src = await externalAppRegistry.invokeService(SETTINGS_APP, 'galleryGetImageUrl', { code: key }) || '';
    } catch (err) {
        console.warn('[youtube] 读头像图片失败', err);
    }
    if (src) srcCache.set(key, src);
    return String(src || '');
}

/** 切换绑定图组后调用：让下一次分配读到新图组 */
export function invalidateGroupCache(groupId) {
    if (groupId) groupCache.delete(String(groupId));
    else groupCache.clear();
}

// ============================================================
// 映射分配
// ============================================================

/**
 * 确保 profile.avatarMap 里有这个 externalId 的映射。
 * **直接改传入的 profile 对象**（reactive），落盘由调用方负责。
 *
 * @returns {Promise<string>} 分配到的 code（'' = 没绑图库或图组为空）
 */
export async function ensureAvatarAssigned(profile, externalId) {
    if (!profile || !externalId) return '';
    const map = profile.avatarMap || (profile.avatarMap = {});
    const existed = map[externalId];
    if (existed?.code) return existed.code;
    if (!profile.galleryGroupId) return '';
    const images = await listGroupImages(profile.galleryGroupId);
    const code = pickAvatarCode(externalId, images, map, profile.avatarSalt || '');
    if (code) {
        const named = images.find((img) => img.code === code);
        map[externalId] = { code, name: named?.name || '' };
    }
    return code;
}

/**
 * 重新分配全部头像（用户点了「重新分配头像」才走这里）。
 * 换一个 salt 再逐个分配 —— 同一批 id 会得到一套新组合。
 */
export async function reassignAll(profile, externalIds) {
    if (!profile?.galleryGroupId) return 0;
    const images = await listGroupImages(profile.galleryGroupId);
    if (!images.length) return 0;
    profile.avatarSalt = `s${Date.now().toString(36)}`;
    profile.avatarMap = {};
    let count = 0;
    for (const id of asArray(externalIds)) {
        if (!id) continue;
        const code = pickAvatarCode(id, images, profile.avatarMap, profile.avatarSalt);
        if (code) {
            const named = images.find((img) => img.code === code);
            profile.avatarMap[id] = { code, name: named?.name || '' };
            count += 1;
        }
    }
    return count;
}
