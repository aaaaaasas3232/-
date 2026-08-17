/**
 * 声浪 · 世界观上下文（唯一读取口）
 *
 * 档案键 = `${默认用户id}::${绑定世界id}`，每次读写现算。
 * 声浪只在 experienceMode === 'esports' 的世界出现（appConfig 里拦），
 * 这里再兜一层：世界不是电竞模式时 blocked。
 */

import { asArray } from '../utils.js';
import {
    createProfileKey,
    getBoundWorld,
    getDefaultUser as readDefaultUser,
    getSettingsSdk,
    listWorldAiPersons,
    readWorldProfile,
    resolveWorldMode,
} from '@/src/core/world-profile.js';

function sdk() {
    return getSettingsSdk();
}

export function getDefaultUser() {
    return readDefaultUser(sdk());
}

export function getWorld(user) {
    return getBoundWorld(user || getDefaultUser(), sdk());
}

export function getProfileKey(user, world) {
    const u = user || getDefaultUser();
    const w = world || getWorld(u);
    return createProfileKey(u, w) || '';
}

/** 当前身份快照（含电竞模式判断） */
export function readIdentity() {
    const profile = readWorldProfile({ sdk: sdk() });
    const mode = profile.world ? resolveWorldMode(profile.world) : 'general';
    return {
        ...profile,
        userName: profile.user?.name || '我',
        userAvatar: String(profile.user?.avatar || ''),
        isEsportsWorld: mode === 'esports',
        currency: String(profile.world?.currency || profile.world?.currencyName || '元'),
    };
}

export function listKeyPoints(world) {
    const w = world || getWorld();
    return asArray(w?.keyPoints).map((x) => String(x || '')).filter(Boolean);
}

/** 世界观简介，生成必带 */
export function readWorldSummary(world) {
    const w = world || getWorld();
    if (!w) return '';
    const parts = [];
    if (String(w.summary || '').trim()) parts.push(String(w.summary).trim());
    const points = listKeyPoints(w);
    if (points.length) parts.push(points.map((p) => `· ${p}`).join('\n'));
    return parts.join('\n');
}

/** 世界观夹子（world.flows） */
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

/** 当前世界绑定的 AI（可替换进战队当选手） */
export function listWorldAis(world) {
    const s = sdk();
    const w = world || getWorld();
    return listWorldAiPersons(w, s).map((ai) => ({
        id: String(ai?.id || ''),
        name: String(ai?.name || 'AI'),
        avatar: String(ai?.avatar || ''),
        role: String(ai?.role || ''),
        personality: String(ai?.personality || ''),
        bio: String(ai?.bio || ''),
        experience: String(ai?.experience || ''),
    }));
}

/** 单个 AI 的完整人设文本（替换进战队时做快照） */
export function describeAiPersona(aiId) {
    const s = sdk();
    const ai = s?.aiPersons?.get?.(aiId);
    if (!ai) return '';
    return [
        ai.name,
        ai.gender && `性别：${ai.gender}`,
        ai.age && `年龄：${ai.age}`,
        ai.role && `身份：${ai.role}`,
        ai.personality && `性格：${ai.personality}`,
        ai.bio && `简介：${ai.bio}`,
        ai.experience && `经历：${ai.experience}`,
    ].filter(Boolean).join('\n');
}

/** AI 人设卡里有没有「串子」属性（去论坛开小号冲浪的人） */
export function aiHasLurkerTrait(ai) {
    const text = [ai?.personality, ai?.bio, ai?.experience].filter(Boolean).join(' ');
    return /串子|冲浪|小号|网瘾|乐子人|论坛老哥/.test(text);
}

/** 用户人设简介（进 prompt） */
export function describeUser(user) {
    const u = user || getDefaultUser();
    if (!u) return '';
    return [
        u.name,
        u.gender && `性别：${u.gender}`,
        u.age && `年龄：${u.age}`,
        u.personality && `性格：${u.personality}`,
        u.bio && `简介：${u.bio}`,
    ].filter(Boolean).join('，');
}

// ============================================================
// 纪时系统（世界观时间映射）
// ============================================================

export function chrono() {
    return sdk()?.chronology || null;
}

export function formatWorldDate(virtualMs, worldId, formatType = 'date') {
    const c = chrono();
    const w = worldId || getWorld()?.id;
    if (!c) {
        const d = new Date(virtualMs);
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    }
    try {
        const worldTime = c.realToWorld(new Date(virtualMs), w);
        return c.format(worldTime, formatType, w);
    } catch (_) {
        const d = new Date(virtualMs);
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    }
}

export function formatWorldClock(virtualMs, worldId) {
    const c = chrono();
    const w = worldId || getWorld()?.id;
    if (!c) {
        const d = new Date(virtualMs);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    try {
        return c.formatClockText(new Date(virtualMs), 'chronology', w);
    } catch (_) {
        const d = new Date(virtualMs);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
}

// ============================================================
// 世界观时间轴（重大事件自动登记，按档可回收）
// ============================================================

export async function pushWorldTimeline({ worldId, title, description, dateText }) {
    const s = sdk();
    const w = worldId || getWorld()?.id;
    if (!s?.timelines?.addTimelineEvent || !w) return null;
    try {
        const event = await s.timelines.addTimelineEvent(w, 'world', {
            title: String(title || '').slice(0, 40),
            date: String(dateText || ''),
            category: 'major',
            description: String(description || '').slice(0, 200),
        });
        return event?.id || null;
    } catch (err) {
        console.warn('[esports-forum] 写世界时间轴失败', err);
        return null;
    }
}

export async function removeWorldTimelineEvents(worldId, ids = []) {
    const s = sdk();
    const w = worldId || getWorld()?.id;
    if (!s?.timelines?.deleteTimelineEvent || !w) return 0;
    let removed = 0;
    for (const id of asArray(ids)) {
        try {
            const ok = await s.timelines.deleteTimelineEvent(w, id);
            if (ok) removed += 1;
        } catch (_) { /* 已经没了就算了 */ }
    }
    return removed;
}

// ============================================================
// 人设改写（重大事件 → 用户 / AI 人设经历，全部留痕可回收）
// ============================================================

export async function appendPersonaExperience(entityType, entityId, line) {
    const s = sdk();
    const text = String(line || '').trim();
    if (!s || !entityId || !text) return false;
    try {
        const api = entityType === 'user' ? s.users : s.aiPersons;
        const persona = api?.get?.(entityId);
        if (!persona) return false;
        const previous = String(persona.experience || '');
        if (previous.includes(text)) return true;
        const next = [previous.trim(), text].filter(Boolean).join('\n');
        await api.update(entityId, { experience: next });
        return true;
    } catch (err) {
        console.warn('[esports-forum] 写人设经历失败', err);
        return false;
    }
}

export async function removePersonaExperienceLines(entityType, entityId, lines = []) {
    const s = sdk();
    if (!s || !entityId || !lines.length) return false;
    try {
        const api = entityType === 'user' ? s.users : s.aiPersons;
        const persona = api?.get?.(entityId);
        if (!persona) return false;
        let text = String(persona.experience || '');
        for (const line of lines) {
            const t = String(line || '').trim();
            if (!t) continue;
            text = text.split('\n').filter((row) => row.trim() !== t).join('\n');
        }
        await api.update(entityId, { experience: text.trim() });
        return true;
    } catch (err) {
        console.warn('[esports-forum] 回收人设经历失败', err);
        return false;
    }
}
