/**
 * settings-sdk · 人设日记 (Diary)
 *
 *   存储位置：sdkDiaries 表，keyPath = 'id'
 *   id 结构：`<entityType>:<entityId>:<YYYY-MM-DD>` （一天一篇 / 人设）
 *
 *   数据模型：
 *     {
 *       id: 'ai:ai0:2026-07-17',
 *       entityType: 'ai' | 'user',
 *       entityId: 'ai0',
 *       date: '2026-07-17',
 *       mood: '开心',
 *       moodIntensity: 0.7,          // 心情浓度 0.0~1.0
 *       isPositive: true,             // 好心情(粉) true / 坏心情(蓝) false
 *       diary: '今天心情不错...',       // 一行日记（用户填写或 AI 生成）
 *       segments: [                   // 详细段落（可选）
 *         { id, text, author: 'ai'|'user', source: 'generated'|'manual', createdAt },
 *         ...
 *       ],
 *       createdAt, updatedAt,
 *     }
 *
 *   API：list / getToday / get / upsert / addSegment / updateSegment / removeSegment / regenerate
 *
 *   注意：
 *     - 本文件只负责「数据」层；生成逻辑在 persona-diary-generator.js（保留 API 注入点）
 *     - mood 是「今日心情」，每次生成段落时自动 lock 到当日记录
 *     - moodIntensity / isPositive / diary 字段由 AI 生成或用户手动填写
 */

import { SDK_STORES } from './defaults.js';
import { createPersister, now } from './helpers.js';
import { MOOD_PRESETS, MOOD_LABELS, getMoodIsPositive, getMoodDefaultIntensity } from '@/src/core/mood.js';

// 重新导出心情相关常量（兼容旧导入路径）
export { MOOD_PRESETS, MOOD_LABELS, getMoodIsPositive, getMoodDefaultIntensity };

/** 兜底：根据权重加权抽一个心情。无权重则从预选取。 */
export function pickMood(weights = {}) {
    const entries = Object.entries(weights || {}).filter(([, w]) => Number(w) > 0);
    if (entries.length === 0) {
        return MOOD_LABELS[Math.floor(Math.random() * MOOD_LABELS.length)];
    }
    const total = entries.reduce((sum, [, w]) => sum + Number(w), 0);
    let r = Math.random() * total;
    for (const [k, w] of entries) {
        r -= Number(w);
        if (r <= 0) return k;
    }
    return entries[entries.length - 1][0];
}

export function diaryId(entityType, entityId, date) {
    return `${entityType}:${entityId}:${date}`;
}

export function todayKey(date = new Date()) {
    return date.toLocaleDateString('en-CA');
}

export function makeSegment(text, { author = 'user', source = 'manual' } = {}) {
    return {
        id: `seg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        text: String(text || '').slice(0, 240),
        author,
        source,
        createdAt: now(),
    };
}

export function createDiaryApi({ toolkit, cache, events, bump }) {
    const storeName = SDK_STORES.diaries;
    const persist = createPersister(toolkit, storeName);
    const cacheMap = new Map();

    // 内存缓存（避免每次都查 IndexedDB；UI 渲染走 cache）
    cache.diaries = cacheMap;

    const list = () => Array.from(cacheMap.values());
    const listForEntity = (entityType, entityId) =>
        list()
            .filter(d => d.entityType === entityType && d.entityId === entityId)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const get = (id) => cacheMap.get(id) || null;
    const getToday = (entityType, entityId) => get(diaryId(entityType, entityId, todayKey()));

    const upsert = async (record) => {
        const next = { ...record, updatedAt: now() };
        cacheMap.set(next.id, next);
        await persist(next);
        bump('diaries', 'upsert', next);
        return next;
    };

    const ensureDay = async (entityType, entityId, { mood = '' } = {}) => {
        const id = diaryId(entityType, entityId, todayKey());
        const existing = cacheMap.get(id);
        if (existing) return existing;
        return upsert({
            id,
            entityType,
            entityId,
            date: todayKey(),
            mood,
            segments: [],
            createdAt: now(),
        });
    };

    const addSegment = async (entityType, entityId, text, options = {}) => {
        const seg = makeSegment(text, options);
        const day = await ensureDay(entityType, entityId, { mood: options.mood || '' });
        const segments = Array.isArray(day.segments) ? day.segments.slice() : [];
        segments.push(seg);
        return upsert({ ...day, segments, mood: day.mood || options.mood || '' });
    };

    const updateSegment = async (entityType, entityId, segmentId, patch) => {
        const id = diaryId(entityType, entityId, todayKey());
        const day = cacheMap.get(id);
        if (!day) return null;
        const segments = (day.segments || []).map(s =>
            s.id === segmentId ? { ...s, ...patch, updatedAt: now() } : s
        );
        return upsert({ ...day, segments });
    };

    const removeSegment = async (entityType, entityId, segmentId) => {
        const id = diaryId(entityType, entityId, todayKey());
        const day = cacheMap.get(id);
        if (!day) return null;
        const segments = (day.segments || []).filter(s => s.id !== segmentId);
        return upsert({ ...day, segments });
    };

    const setMood = async (entityType, entityId, mood) => {
        const id = diaryId(entityType, entityId, todayKey());
        const day = cacheMap.get(id) || { id, entityType, entityId, date: todayKey(), segments: [], createdAt: now() };
        return upsert({ ...day, mood: mood || '' });
    };

    /**
     * 设置心情详情（包含浓度和日记）
     * payload: { mood, moodIntensity?, isPositive?, diary?, date? }
     * 如果不传 date，默认保存到今天
     */
    const setMoodDetail = async (entityType, entityId, payload = {}) => {
        const date = payload.date || todayKey();
        const id = diaryId(entityType, entityId, date);
        const day = cacheMap.get(id) || { id, entityType, entityId, date, segments: [], createdAt: now() };
        const patch = { ...day };
        if (payload.mood !== undefined) patch.mood = payload.mood;
        if (payload.moodIntensity !== undefined) patch.moodIntensity = Math.max(0, Math.min(1, Number(payload.moodIntensity)));
        if (payload.isPositive !== undefined) patch.isPositive = !!payload.isPositive;
        if (payload.diary !== undefined) patch.diary = String(payload.diary || '').slice(0, 200);
        return upsert(patch);
    };

    /**
     * 获取指定月份的日记列表
     * @param {string} entityType
     * @param {string} entityId
     * @param {number} year
     * @param {number} month (1-12)
     * @returns {Array} 该月所有日记，按日期升序
     */
    const getMonthDiaries = (entityType, entityId, year, month) => {
        const prefix = `${entityType}:${entityId}:`;
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
        return list()
            .filter(d =>
                d.entityType === entityType &&
                d.entityId === entityId &&
                d.date >= startDate &&
                d.date <= endDate
            )
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    };

    /**
     * 获取指定日期的日记
     */
    const getDateDiary = (entityType, entityId, date) => {
        const id = diaryId(entityType, entityId, date);
        return get(id);
    };

    /**
     * 删除某日的日记
     */
    const removeDay = async (entityType, entityId, date) => {
        const id = diaryId(entityType, entityId, date);
        const existed = cacheMap.get(id);
        if (!existed) return false;
        cacheMap.delete(id);
        await persist({ id, _deleted: true });
        bump('diaries', 'remove', { id });
        return true;
    };

    /**
     * 批量获取某日期段的日记（用于注入上下文）
     */
    const getDateRange = (entityType, entityId, startDate, endDate) => {
        return list()
            .filter(d =>
                d.entityType === entityType &&
                d.entityId === entityId &&
                d.date >= startDate &&
                d.date <= endDate
            )
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    };

    /**
     * 强制刷新今日日记（清空 AI 生成段落，保留手动段落；再做一次生成）。
     * options.generator：async (ctx) => [{ text, source? }]
     */
    const regenerate = async (entityType, entityId, options = {}) => {
        const id = diaryId(entityType, entityId, todayKey());
        const day = cacheMap.get(id) || { id, entityType, entityId, date: todayKey(), segments: [], createdAt: now() };
        const manualOnly = (day.segments || []).filter(s => s.source !== 'generated');
        let generated = [];
        try {
            if (typeof options.generator === 'function') {
                const out = await options.generator({ entityType, entityId, mood: day.mood, date: day.date });
                generated = (out || []).map(t => (typeof t === 'string' ? { text: t } : t)).filter(Boolean);
            }
        } catch (err) {
            console.warn('[settings-sdk.diary] generator 报错', err);
        }
        return upsert({
            ...day,
            segments: [...manualOnly, ...generated.map(g => makeSegment(g.text, { author: 'ai', source: 'generated' }))],
        });
    };

    const hydrate = async () => {
        if (!toolkit?.db) return;
        const records = await toolkit.db.getAll(storeName);
        cacheMap.clear();
        for (const r of records || []) if (r?.id && !r._deleted) cacheMap.set(r.id, r);
    };

    return {
        list, listForEntity, get, getToday,
        ensureDay, addSegment, updateSegment, removeSegment, setMood, setMoodDetail,
        getMonthDiaries, getDateDiary, removeDay, getDateRange,
        regenerate, hydrate, _cache: cacheMap,
        MOOD_PRESETS, MOOD_LABELS, getMoodIsPositive, getMoodDefaultIntensity,
    };
}
