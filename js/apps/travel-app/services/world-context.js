/**
 * 候鸟 · 世界观上下文（唯一读取口）
 *
 * 「世界观里有什么」只在这里读。散在组件里读 window.settingsSdk 的话，
 * 迟早出现「首配读的是 A、生成时读的是 B」。
 *
 * 档案键 = `${默认用户id}::${绑定世界id}`，每次读写现算，
 * 不依赖任何「用户切换了」的事件（只挂事件等于挂运气）。
 */

import { asArray } from '../utils.js';
import {
    createProfileKey,
    getBoundWorld,
    getDefaultUser as readDefaultUser,
    getSettingsSdk,
    listWorldAiPersons,
    readWorldProfile,
} from '@/src/core/world-profile.js';

const FALLBACK_CURRENCY = '金币';

function sdk() {
    return getSettingsSdk();
}

// ============================================================
// 身份
// ============================================================

export function getDefaultUser() {
    return readDefaultUser(sdk());
}

/** 只认用户卡上明确绑定的世界观，不用 active world 兜底 */
export function getWorld(user) {
    return getBoundWorld(user || getDefaultUser(), sdk());
}

/** 档案键。空串 = 还不能读写，调用方必须拦住。 */
export function getProfileKey(user, world) {
    const u = user || getDefaultUser();
    const w = world || getWorld(u);
    return createProfileKey(u, w) || '';
}

/** 当前身份的只读快照 */
export function readIdentity() {
    const profile = readWorldProfile({ sdk: sdk() });
    const { user, world } = profile;
    return {
        ...profile,
        user,
        world,
        userName: user?.name || '我',
        userAvatar: String(user?.avatar || ''),
        userAvatarBg: String(user?.avatarBg || ''),
        worldName: world?.name || '',
        currency: (world?.currencyName || '').trim() || FALLBACK_CURRENCY,
        ready: profile.ready,
    };
}

// ============================================================
// 世界观内容
// ============================================================

/** 夹子（world.flows，历史命名不改） */
export function listClips(world) {
    const w = world || getWorld();
    return asArray(w?.flows)
        .filter((f) => f && f.id)
        .map((f) => ({
            id: String(f.id),
            title: String(f.title || '未命名夹子'),
            content: String(f.content || ''),
        }));
}

export function listKeyPoints(world) {
    const w = world || getWorld();
    return asArray(w?.keyPoints).map((x) => String(x || '')).filter(Boolean);
}

/** 世界观简介。生成必传，没有它内容和世界观毫无关系。 */
export function readSummary(world) {
    const w = world || getWorld();
    const summary = String(w?.summary || '').trim();
    const points = listKeyPoints(w);
    if (!summary && points.length === 0) return '';
    const parts = [];
    if (summary) parts.push(summary);
    if (points.length) parts.push(points.map((p) => `· ${p}`).join('\n'));
    return parts.join('\n');
}

// ============================================================
// 地理：世界里已有的地点 / 场所
// ============================================================

/**
 * 当前世界已有的 Place（含它下面的 Location 名单）。
 * 喂给候选生成 prompt（允许 AI 复用已有地点），也用于给候选打「已有」标。
 */
export function listWorldGeo(world) {
    const s = sdk();
    const w = world || getWorld();
    const worldId = String(w?.id || '');
    if (!worldId || !s?.places?.list) return [];
    let places = [];
    try {
        places = s.places.list({ worldRef: worldId }) || [];
    } catch (err) {
        console.warn('[travel] 读地点失败', err);
        return [];
    }
    return places.map((place) => {
        let locations = [];
        try {
            locations = s.locations?.getByPlace?.(worldId, place.id)
                || (s.locations?.list?.({ worldRef: worldId }) || []).filter((l) => l.placeRef === place.id);
        } catch (_) { /* 场所读不到不影响地点本身 */ }
        return {
            id: String(place.id),
            name: String(place.name || ''),
            summary: String(place.summary || ''),
            locations: asArray(locations).map((l) => ({
                id: String(l.id),
                name: String(l.name || ''),
            })),
        };
    }).filter((p) => p.name);
}

/** 按名字找已有 Place（大小写不敏感）。找不到返回 null。 */
export function findPlaceByName(geoList, name) {
    const key = String(name || '').trim().toLocaleLowerCase();
    if (!key) return null;
    return asArray(geoList).find((p) => p.name.trim().toLocaleLowerCase() === key) || null;
}

/** 某个 Place 下按名字找已有 Location */
export function findLocationByName(place, name) {
    const key = String(name || '').trim().toLocaleLowerCase();
    if (!key || !place) return null;
    return asArray(place.locations).find((l) => l.name.trim().toLocaleLowerCase() === key) || null;
}

// ============================================================
// prompt 库
// ============================================================

export async function listLibraryPrompts() {
    const s = sdk();
    if (!s?.promptLibrary?.listAllPrompts) return [];
    try {
        const rows = await s.promptLibrary.listAllPrompts();
        return asArray(rows).map((row) => ({
            id: String(row?.prompt?.id || ''),
            title: String(row?.prompt?.title || row?.prompt?.name || '未命名'),
            content: String(row?.prompt?.content || row?.prompt?.text || ''),
            path: [row?.library?.name, row?.package?.name, row?.group?.name]
                .filter(Boolean).join(' / '),
        })).filter((p) => p.id && p.content);
    } catch (err) {
        console.warn('[travel] 读取 prompt 库失败', err);
        return [];
    }
}

// ============================================================
// AI 人设
// ============================================================

/** 这个世界观下绑定的 AI（同行者只能从这里挑） */
export function listWorldAis(world) {
    const s = sdk();
    const w = world || getWorld();
    return listWorldAiPersons(w, s).map((ai) => ({
        id: String(ai?.id || ''),
        name: String(ai?.name || 'AI'),
        avatar: String(ai?.avatar || ''),
        avatarBg: String(ai?.avatarBg || ''),
        role: String(ai?.role || ''),
        personality: String(ai?.personality || ''),
        tone: String(ai?.tone || ''),
    }));
}

/** 单个 AI 的简介，进 prompt 用 */
export function describeAi(aiId) {
    const s = sdk();
    const ai = s?.aiPersons?.get?.(aiId);
    if (!ai) return '';
    const bits = [
        ai.name,
        ai.role && `身份：${ai.role}`,
        ai.personality && `性格：${ai.personality}`,
        ai.tone && `说话方式：${ai.tone}`,
    ].filter(Boolean);
    return bits.join('，');
}

/** 用户自己的人设简介 */
export function describeUser(user) {
    const u = user || getDefaultUser();
    if (!u) return '';
    const bits = [
        u.name,
        u.gender && `性别：${u.gender}`,
        u.age && `年龄：${u.age}`,
        u.personality && `性格：${u.personality}`,
        u.bio && `简介：${u.bio}`,
    ].filter(Boolean);
    return bits.join('，');
}

/**
 * 把 AI 的旅行概要写进它的人设经历区。
 * 概要成为 AI 的「记忆」——murmur 拼世界观人设时会带上 experience。
 */
export async function appendAiExperience(aiId, line) {
    const s = sdk();
    const text = String(line || '').trim();
    if (!s?.aiPersons?.get || !s?.aiPersons?.update || !aiId || !text) return false;
    try {
        const ai = s.aiPersons.get(aiId);
        if (!ai) return false;
        const previous = String(ai.experience || '').trim();
        if (previous.includes(text)) return true;   // 幂等：同一段概要不重复追加
        const next = [previous, text].filter(Boolean).join('\n');
        await s.aiPersons.update(aiId, { experience: next });
        return true;
    } catch (err) {
        console.warn('[travel] 写 AI 经历失败', err);
        return false;
    }
}
