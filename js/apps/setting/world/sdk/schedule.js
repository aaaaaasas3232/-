/**
 * settings-sdk · 人设日程 (Schedule) v0.20
 *
 *   存储位置：sdkSchedules 表，keyPath = 'id'
 *   id 结构：`<entityType>:<entityId>:<YYYY-MM-DD>` —— 与 diary 共享粒度（一天一篇 / 人设）
 *     字段：events: ScheduleEvent[]
 *
 *   ScheduleEvent 形状：
 *     {
 *       id: 'evt-<timestamp>-<rand>',
 *       title: string,                  // 标题（必填，<= 32 字符）
 *       startTime: 'HH:MM',             // 开始时间（24h，可选；空 = 全天）
 *       endTime:   'HH:MM',             // 结束时间（可选）
 *       note: string,                   // 备注（可选，<= 120 字符）
 *       createdAt, updatedAt,
 *     }
 *
 *   关系：
 *     - 日程挂在 user / ai persona 上（类似 diary）
 *     - 世界观 wv-schedule 只读展示绑定人设的日程（不写入）
 *
 *   API：listForEntity / getDay / addEvent / updateEvent / removeEvent / listByDate
 */

import { SDK_STORES } from './defaults.js';
import { createPersister, now } from './helpers.js';

const MAX_TITLE = 32;
const MAX_NOTE = 120;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function scheduleId(entityType, entityId, date) {
    return `${entityType}:${entityId}:${date}`;
}

function makeEventId() {
    return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function clampText(v, max) {
    if (v == null) return '';
    const s = String(v).trim();
    return s.length > max ? s.slice(0, max) : s;
}

function normalizeTime(v) {
    if (v == null || v === '') return '';
    const s = String(v).trim();
    return TIME_RE.test(s) ? s : '';
}

export function createScheduleApi({ toolkit, cache, events, bump }) {
    const storeName = SDK_STORES.schedules;
    const persist = createPersister(toolkit, storeName);
    const cacheMap = new Map();
    cache.schedules = cacheMap;

    const ensureDay = async (entityType, entityId, date) => {
        const id = scheduleId(entityType, entityId, date);
        const existing = cacheMap.get(id);
        if (existing) return existing;
        const next = {
            id,
            entityType,
            entityId,
            date,
            events: [],
            createdAt: now(),
            updatedAt: now(),
        };
        cacheMap.set(next.id, next);
        await persist(next);
        return next;
    };

    const get = (id) => cacheMap.get(id) || null;

    /**
     * 取某一天的日程。
     */
    const getDay = (entityType, entityId, date) => {
        const base = get(scheduleId(entityType, entityId, date));
        if (!base) return null;
        const baseEvents = Array.isArray(base?.events) ? base.events : [];
        return {
            id: base.id,
            entityType, entityId, date,
            events: baseEvents,
            createdAt: base.createdAt,
            updatedAt: base.updatedAt,
        };
    };

    const list = () => Array.from(cacheMap.values());

    const listForEntity = (entityType, entityId) =>
        list()
            .filter(d => d.entityType === entityType && d.entityId === entityId)
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    /**
     * 列出指定日期范围内每天的事件，按日期升序展开。
     * 返回 [{ date, entityType, entityId, events }]。
     */
    const listByDateRange = (entityType, entityId, startDate, endDate) => {
        const out = [];
        for (const d of listForEntity(entityType, entityId)) {
            if (d.date >= startDate && d.date <= endDate) {
                out.push({ date: d.date, entityType, entityId, events: d.events || [] });
            }
        }
        return out;
    };

    /**
     * 列出某一天从所有绑定到指定 worldId 的人设（user + ai）汇总的日程。
     * 用于 wv-schedule 只读展示。
     */
    const listByDateForWorld = (sdk, worldId, date) => {
        if (!sdk) return [];
        const collect = (api) => {
            const items = api.list ? api.list() : [];
            return items
                .filter(p => p && p.boundWorldId === worldId)
                .map(p => ({ p, api }));
        };
        const pools = [
            ...collect(sdk.users),
            ...collect(sdk.aiPersons),
        ];
        const out = [];
        for (const { p, api } of pools) {
            const entityType = api === sdk.users ? 'user' : 'ai';
            const day = getDay(entityType, p.id, date);
            if (day?.events?.length) {
                out.push({
                    entityType,
                    entityId: p.id,
                    personaName: p.name || p.id,
                    events: day.events,
                });
            }
        }
        return out;
    };

    /**
     * 列出当前世界所有绑定人设，在给定周（周一-周日）每一天的合并日程。
     * 返回 Map<date, [{ entityType, entityId, personaName, events }]>
     */
    const listWeekForWorld = (sdk, worldId, dates /* YYYY-MM-DD 数组 */) => {
        const map = new Map();
        if (!sdk || !worldId) return map;
        dates.forEach(d => map.set(d, []));
        const collect = (api) => {
            const items = api.list ? api.list() : [];
            return items
                .filter(p => p && p.boundWorldId === worldId)
                .map(p => ({ p, api }));
        };
        const pools = [
            ...collect(sdk.users),
            ...collect(sdk.aiPersons),
        ];
        for (const { p, api } of pools) {
            const entityType = api === sdk.users ? 'user' : 'ai';
            const personaName = p.name || p.id;
            for (const d of dates) {
                const day = getDay(entityType, p.id, d);
                if (day?.events?.length) {
                    map.get(d).push({ entityType, entityId: p.id, personaName, events: day.events });
                }
            }
        }
        return map;
    };

    const upsertDay = async (day) => {
        const next = { ...day, updatedAt: now() };
        cacheMap.set(next.id, next);
        await persist(next);
        bump('schedules', 'upsert', next);
        return next;
    };

    const addEvent = async (entityType, entityId, date, payload = {}) => {
        if (!entityType || !entityId || !date) return null;
        const event = {
            id: makeEventId(),
            title: clampText(payload.title, MAX_TITLE) || '未命名日程',
            startTime: normalizeTime(payload.startTime),
            endTime: normalizeTime(payload.endTime),
            note: clampText(payload.note, MAX_NOTE),
            createdAt: now(),
            updatedAt: now(),
        };
        const day = await ensureDay(entityType, entityId, date);
        const events = Array.isArray(day.events) ? day.events.slice() : [];
        events.push(event);
        events.sort((a, b) => {
            const ax = a.startTime || '99:99';
            const bx = b.startTime || '99:99';
            return ax.localeCompare(bx);
        });
        return upsertDay({ ...day, events });
    };

    const updateEvent = async (entityType, entityId, date, eventId, patch = {}) => {
        const day = getDay(entityType, entityId, date);
        if (!day) return null;
        const events = (day.events || []).map((e) => {
            if (e.id !== eventId) return e;
            const next = {
                ...e,
                title: clampText(patch.title ?? e.title, MAX_TITLE) || e.title,
                startTime: patch.startTime !== undefined ? normalizeTime(patch.startTime) : e.startTime,
                endTime:   patch.endTime   !== undefined ? normalizeTime(patch.endTime)   : e.endTime,
                note:      patch.note      !== undefined ? clampText(patch.note, MAX_NOTE) : e.note,
                updatedAt: now(),
            };
            return next;
        });
        return upsertDay({ ...day, events });
    };

    const removeEvent = async (entityType, entityId, date, eventId) => {
        const day = getDay(entityType, entityId, date);
        if (!day) return null;
        const events = (day.events || []).filter((e) => e.id !== eventId);
        return upsertDay({ ...day, events });
    };

    const hydrate = async () => {
        if (!toolkit?.db) return;
        const records = await toolkit.db.getAll(storeName);
        cacheMap.clear();
        for (const r of records || []) if (r?.id) cacheMap.set(r.id, r);
    };

    return {
        list, listForEntity, listByDateRange, listByDateForWorld, listWeekForWorld,
        get, getDay, ensureDay,
        addEvent, updateEvent, removeEvent,
        hydrate, _cache: cacheMap,
        MAX_TITLE, MAX_NOTE,
        scheduleId,
    };
}

/**
 * settings-sdk · 每周重复日程 (Weekly Schedule) v0.31
 *
 *   存储位置：sdkWeeklySchedules 表，keyPath = 'id'
 *   id 结构：`<entityType>:<entityId>:<dayOfWeek>` —— 0=周日 ~ 6=周六
 *
 *   WeeklyDay 形状：
 *     {
 *       id: "user:user0:5",          // keyPath
 *       entityType: "user",
 *       entityId: "user0",
 *       dayOfWeek: 5,                // 0=周日,1=周一,...,6=周六（JS Date.getDay() 一致）
 *       events: [WeeklyEvent, ...],
 *       createdAt, updatedAt
 *     }
 *
 *   WeeklyEvent 形状：
 *     {
 *       id: 'evt-<timestamp>-<rand>',
 *       title: string,                  // 标题（必填，<= 32 字符）
 *       startTime: 'HH:MM',             // 开始时间（24h，可选；空 = 全天）
 *       endTime:   'HH:MM',             // 结束时间（可选）
 *       note: string,                   // 备注（可选，<= 120 字符）
 *       createdAt, updatedAt,
 *     }
 *
 *   API：getByDay / listForEntity / addEvent / updateEvent / removeEvent / hydrate
 */
export function createWeeklyScheduleApi({ toolkit, cache, events, bump }) {
    const storeName = SDK_STORES.weeklySchedules;
    const persist = createPersister(toolkit, storeName);
    const cacheMap = new Map();
    cache.weeklySchedules = cacheMap;

    function weeklyId(entityType, entityId, dayOfWeek) {
        return `${entityType}:${entityId}:${Number(dayOfWeek)}`;
    }

    function makeEventId() {
        return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    }

    function clampText(v, max) {
        if (v == null) return '';
        const s = String(v).trim();
        return s.length > max ? s.slice(0, max) : s;
    }

    function normalizeTime(v) {
        if (v == null || v === '') return '';
        const s = String(v).trim();
        return TIME_RE.test(s) ? s : '';
    }

    const ensureDay = async (entityType, entityId, dayOfWeek) => {
        const dow = Number(dayOfWeek);
        const id = weeklyId(entityType, entityId, dow);
        const existing = cacheMap.get(id);
        if (existing) return existing;
        const next = {
            id,
            entityType,
            entityId,
            dayOfWeek: dow,
            events: [],
            createdAt: now(),
            updatedAt: now(),
        };
        cacheMap.set(next.id, next);
        await persist(next);
        return next;
    };

    const get = (id) => cacheMap.get(id) || null;

    /** 按「周几」取某人某天的每周重复日程。*/
    const getByDay = (entityType, entityId, dayOfWeek) => {
        const dow = Number(dayOfWeek);
        const base = get(weeklyId(entityType, entityId, dow));
        if (!base) return null;
        return {
            id: base.id,
            entityType, entityId,
            dayOfWeek: base.dayOfWeek,
            events: Array.isArray(base.events) ? base.events : [],
            createdAt: base.createdAt,
            updatedAt: base.updatedAt,
        };
    };

    const list = () => Array.from(cacheMap.values());

    const listForEntity = (entityType, entityId) =>
        list()
            .filter(d => d.entityType === entityType && d.entityId === entityId)
            .sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0));

    const upsertDay = async (day) => {
        const next = { ...day, updatedAt: now() };
        cacheMap.set(next.id, next);
        await persist(next);
        bump('weeklySchedules', 'upsert', next);
        return next;
    };

    /** 添加一条每周重复日程。*/
    const addEvent = async (entityType, entityId, dayOfWeek, payload = {}) => {
        if (!entityType || !entityId || dayOfWeek === undefined) return null;
        const dow = Number(dayOfWeek);
        if (isNaN(dow) || dow < 0 || dow > 6) return null;
        const event = {
            id: makeEventId(),
            title: clampText(payload.title, MAX_TITLE) || '未命名日程',
            startTime: normalizeTime(payload.startTime),
            endTime: normalizeTime(payload.endTime),
            note: clampText(payload.note, MAX_NOTE),
            createdAt: now(),
            updatedAt: now(),
        };
        const day = await ensureDay(entityType, entityId, dow);
        const events = Array.isArray(day.events) ? day.events.slice() : [];
        events.push(event);
        events.sort((a, b) => {
            const ax = a.startTime || '99:99';
            const bx = b.startTime || '99:99';
            return ax.localeCompare(bx);
        });
        return upsertDay({ ...day, events });
    };

    /** 更新一条每周重复日程。*/
    const updateEvent = async (entityType, entityId, dayOfWeek, eventId, patch = {}) => {
        const day = getByDay(entityType, entityId, dayOfWeek);
        if (!day) return null;
        const events = (day.events || []).map((e) => {
            if (e.id !== eventId) return e;
            return {
                ...e,
                title: clampText(patch.title ?? e.title, MAX_TITLE) || e.title,
                startTime: patch.startTime !== undefined ? normalizeTime(patch.startTime) : e.startTime,
                endTime:   patch.endTime   !== undefined ? normalizeTime(patch.endTime)   : e.endTime,
                note:      patch.note      !== undefined ? clampText(patch.note, MAX_NOTE) : e.note,
                updatedAt: now(),
            };
        });
        return upsertDay({ ...day, events });
    };

    /** 删除一条每周重复日程。*/
    const removeEvent = async (entityType, entityId, dayOfWeek, eventId) => {
        const day = getByDay(entityType, entityId, dayOfWeek);
        if (!day) return null;
        const events = (day.events || []).filter((e) => e.id !== eventId);
        return upsertDay({ ...day, events });
    };

    const hydrate = async () => {
        if (!toolkit?.db) return;
        const records = await toolkit.db.getAll(storeName);
        cacheMap.clear();
        for (const r of records || []) if (r?.id) cacheMap.set(r.id, r);
    };

    return {
        list, listForEntity, listByDateForEntity: listForEntity,
        get, getByDay, ensureDay,
        addEvent, updateEvent, removeEvent,
        hydrate, _cache: cacheMap,
        MAX_TITLE, MAX_NOTE,
        weeklyId,
    };
}
