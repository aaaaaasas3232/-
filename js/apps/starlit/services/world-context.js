/**
 * 点灯 · 身份与世界观（唯一读取口）
 *
 * ── 和候鸟的关键区别 ──────────────────────────────────────────────
 *   候鸟必须绑世界观才出现在桌面。点灯**不需要** ——
 *   老师可以是「世界观里的 AI」，也可以就是模型本身。
 *   所以没绑世界时档案键退化成 `${userId}::solo`，App 照常能用，
 *   只是「老师来源」那一栏里没有人设可选。
 *
 * 散在组件里读 window.settingsSdk 迟早出现「问卷读的是 A、上课读的是 B」，
 * 所以只在这里读。
 */

import { asArray } from '../utils.js';
import {
    getBoundWorld,
    getDefaultUser as readDefaultUser,
    getSettingsSdk,
    listWorldAiPersons,
} from '@/src/core/world-profile.js';

/** 没绑世界观时的档案后缀 */
const SOLO = 'solo';

function sdk() {
    return getSettingsSdk();
}

export function getDefaultUser() {
    return readDefaultUser(sdk());
}

/** 只认用户卡上明确绑定的世界观，不用 active world 偷偷兜底 */
export function getWorld(user) {
    return getBoundWorld(user || getDefaultUser(), sdk());
}

/**
 * 档案键。没有用户 → 空串（调用方必须拦住）；
 * 有用户没世界 → `${userId}::solo`（照常能学）。
 */
export function getProfileKey(user, world) {
    const u = user || getDefaultUser();
    const userId = String(u?.id || '').trim();
    if (!userId) return '';
    const w = world === undefined ? getWorld(u) : world;
    const worldId = String(w?.id || '').trim();
    return `${userId}::${worldId || SOLO}`;
}

/** 当前身份的只读快照 */
export function readIdentity() {
    const s = sdk();
    const user = getDefaultUser();
    const world = getWorld(user);
    return {
        sdkReady: Boolean(s),
        user,
        world,
        userId: String(user?.id || ''),
        userName: String(user?.name || '我'),
        userAvatar: String(user?.avatar || ''),
        userAvatarBg: String(user?.avatarBg || ''),
        worldId: String(world?.id || ''),
        worldName: String(world?.name || ''),
        hasWorld: Boolean(world?.id),
        profileKey: getProfileKey(user, world),
        ready: Boolean(user?.id),
    };
}

/** 拦截文案。空串 = 可以正常用。 */
export function describeBlock() {
    const s = sdk();
    if (!s) return '设置模块还没加载好，稍等一下再打开';
    const user = getDefaultUser();
    if (!user?.id) return '还没有默认用户卡。去「设置 → 人设」建一个，回来就能开课了';
    return '';
}

// ============================================================
// AI 人设（老师候选）
// ============================================================

/** 这个世界观下绑定的 AI。没绑世界时返回空数组。 */
export function listTeacherCandidates(world) {
    const s = sdk();
    const w = world === undefined ? getWorld() : world;
    if (!w?.id) return [];
    return listWorldAiPersons(w, s).map((ai) => ({
        id: String(ai?.id || ''),
        name: String(ai?.name || 'AI'),
        avatar: String(ai?.avatar || ''),
        avatarBg: String(ai?.avatarBg || ''),
        role: String(ai?.role || ''),
        personality: String(ai?.personality || ''),
        tone: String(ai?.tone || ''),
    })).filter((x) => x.id);
}

export function getTeacher(aiId) {
    const s = sdk();
    if (!aiId || !s?.aiPersons?.get) return null;
    try {
        return s.aiPersons.get(aiId) || null;
    } catch (_) {
        return null;
    }
}

/** 一位 AI 的简介，进 prompt 用 */
export function describeAi(aiId) {
    const ai = getTeacher(aiId);
    if (!ai) return '';
    return [
        ai.name,
        ai.role && `身份：${ai.role}`,
        ai.personality && `性格：${ai.personality}`,
        ai.tone && `说话方式：${ai.tone}`,
    ].filter(Boolean).join('，');
}

/** 用户自己的人设简介 */
export function describeUser(user) {
    const u = user || getDefaultUser();
    if (!u) return '';
    return [
        u.name,
        u.age && `年龄：${u.age}`,
        u.personality && `性格：${u.personality}`,
        u.bio && `简介：${u.bio}`,
    ].filter(Boolean).join('，');
}

/**
 * 世界观简介。老师是世界观 AI 时才带进 prompt ——
 * 模型模式下带世界观只会让它演起来，冲淡教学。
 */
export function readWorldSummary(world) {
    const w = world === undefined ? getWorld() : world;
    if (!w) return '';
    const summary = String(w.summary || '').trim();
    const points = asArray(w.keyPoints).map((p) => String(p || '')).filter(Boolean);
    if (!summary && points.length === 0) return '';
    return [summary, points.map((p) => `· ${p}`).join('\n')].filter(Boolean).join('\n');
}

/**
 * 把一段学习经历写进 AI 的人设经历区。
 * 世界观老师带完一门课之后，murmur 里聊天时它会记得教过你什么。
 * 幂等：同一段不重复追加。
 */
export async function appendTeacherExperience(aiId, line) {
    const s = sdk();
    const text = String(line || '').trim();
    if (!s?.aiPersons?.get || !s?.aiPersons?.update || !aiId || !text) return false;
    try {
        const ai = s.aiPersons.get(aiId);
        if (!ai) return false;
        const previous = String(ai.experience || '').trim();
        if (previous.includes(text)) return true;
        await s.aiPersons.update(aiId, { experience: [previous, text].filter(Boolean).join('\n') });
        return true;
    } catch (err) {
        console.warn('[starlit] 写 AI 经历失败', err);
        return false;
    }
}
