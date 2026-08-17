/**
 * 追光 · 世界观上下文（唯一读取口）
 *
 * 档案键 = `${默认用户id}::${绑定世界id}`，每次读写现算。
 * 演员 App 只在 experienceMode === 'actor' 的世界出现（appConfig 里拦），
 * 这里再兜一层：世界不是演员模式时 blocked。
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

/** 当前身份快照（含演员模式判断） */
export function readIdentity() {
    const profile = readWorldProfile({ sdk: sdk() });
    const mode = profile.world ? resolveWorldMode(profile.world) : 'general';
    return {
        ...profile,
        userName: profile.user?.name || '我',
        userAvatar: String(profile.user?.avatar || ''),
        isActorWorld: mode === 'actor',
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

/** 当前世界绑定的 AI（可拉进档里当 NPC） */
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
    }));
}

/** 单个 AI 的完整人设文本（拉进档当 NPC 时做快照） */
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
// 世界观地点（探索 / 活动地点绑定）
// ============================================================

export function listWorldPlaces(world) {
    const s = sdk();
    const w = world || getWorld();
    if (!s?.places?.list || !w?.id) return [];
    try {
        return asArray(s.places.list({ worldRef: w.id })).map((p) => ({
            id: String(p.id),
            name: String(p.name || ''),
            summary: String(p.summary || ''),
        }));
    } catch (_) {
        return [];
    }
}

// ============================================================
// 纪时系统（世界观时间映射）
// ============================================================

export function chrono() {
    return sdk()?.chronology || null;
}

/**
 * 把「虚拟现实毫秒」翻成这个世界的日期文字。
 * 世界开了纪时映射 → 「纪5年3月12日」；没开 → 「2026年8月15日」。
 */
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

/** 「几点」的世界观叫法（辰时 / 19时…） */
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

/**
 * 把一条大事写进世界观 world 时间轴。
 * 返回事件 id —— 存进 save.worldTimelineIds，删档 / 重开时按 id 回收，
 * 不让 A 档的大事污染 B 档。
 */
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
        console.warn('[actor] 写世界时间轴失败', err);
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
// nook 作息（用户没设置时提醒去设置）
// ============================================================

/** 用户人设有没有配置作息（persona.schedule.rhythm 或今天的日程条目） */
export function readUserRoutine() {
    const s = sdk();
    const user = getDefaultUser();
    if (!s || !user) return { configured: false, rhythm: '', todayEvents: [] };
    const rhythm = String(user?.schedule?.rhythm || '').trim();
    let todayEvents = [];
    try {
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const day = s.schedule?.getDay?.('user', user.id, dateStr);
        todayEvents = asArray(day?.events);
    } catch (_) { /* 日程模块不可用不拦路 */ }
    return {
        configured: Boolean(rhythm) || todayEvents.length > 0,
        rhythm,
        todayEvents,
    };
}

// ============================================================
// 人设改写（重大事件 → 用户 / AI 人设经历，全部留痕可回收）
// ============================================================

/** 往人设经历里追加一行（幂等），返回是否写入 */
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
        console.warn('[actor] 写人设经历失败', err);
        return false;
    }
}

/** 从人设经历里移除某些行（重开档时回收本档改写） */
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
        console.warn('[actor] 回收人设经历失败', err);
        return false;
    }
}
