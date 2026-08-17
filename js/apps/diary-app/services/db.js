/**
 * 日记 · 持久化
 *
 * ── 表怎么分的 ────────────────────────────────────────────────────
 *
 *   | 表 | keyPath | 装什么 | 写入频率 |
 *   |---|---|---|---|
 *   | `diarySpaces`   | id | 一个人的日记本配置（主题 / 时段 / 经期设置） | 低 |
 *   | `diaryEntries`  | id | 日记正文，**一天一篇**                    | 中 |
 *   | `diaryNotes`    | id | 便利贴，一天不限篇数                       | 中 |
 *   | `diaryMarkers`  | id | 纪念日 + 倒计时                          | 低 |
 *   | `diaryCycleDays`| id | 经期每日打卡                              | 低 |
 *
 * ── 为什么日记的主键是 `<spaceId>::<date>` ────────────────────────
 *
 * 「一天只能有一篇日记」是产品的第一条规则。用自增 id 的话，这条规则得靠
 * 业务代码每次写入前先查一遍「今天有没有」—— 并发或双击就能写出两篇，
 * 而且事后很难发现（列表里就是多了一条）。
 *
 * 把日期编进主键之后，重复写入在**存储层**就退化成覆盖，
 * 规则由数据结构保证，不依赖任何调用方的自觉。
 * 便利贴反过来用随机 id，因为它本来就允许一天多条。
 *
 * ── 归一化 ────────────────────────────────────────────────────────
 *
 * 读出来的东西一律先过 `normalizeXxx`。上层代码只面对一种形状，
 * 不用到处写 `entry.mood || ''`。
 */

import { makeId, toPlain, todayKey, isValidDateKey, clamp } from '../utils.js';
import {
    ENTRY_KIND, MARKER_KIND, CYCLE_STATE, OWNER_KIND,
    DEFAULT_THEME, DEFAULT_LAYOUT, DEFAULT_WINDOW_START,
    WINDOW_START_MIN, WINDOW_START_MAX,
    DEFAULT_CYCLE, CYCLE_MODE, THEMES, LAYOUT_STYLES, TEXT_SCALES,
    CONTEXT_SECTIONS, createDefaultContextConfig, createDefaultSpace,
} from '../constants.js';

export const STORE_SPACES = 'diarySpaces';
export const STORE_ENTRIES = 'diaryEntries';
export const STORE_NOTES = 'diaryNotes';
export const STORE_MARKERS = 'diaryMarkers';
export const STORE_CYCLE_DAYS = 'diaryCycleDays';

/**
 * ★ 声明了 stores 就必须在 `js/apps/index.js` 里 `async: true` 注册，
 *   否则首次写盘时表还没建出来，表现是「保存成功但刷新就没了」。
 */
export const DIARY_STORES = Object.freeze([
    { name: STORE_SPACES, keyPath: 'id' },
    { name: STORE_ENTRIES, keyPath: 'id', indexes: [{ name: 'spaceId', keyPath: 'spaceId' }] },
    { name: STORE_NOTES, keyPath: 'id', indexes: [{ name: 'spaceId', keyPath: 'spaceId' }] },
    { name: STORE_MARKERS, keyPath: 'id', indexes: [{ name: 'spaceId', keyPath: 'spaceId' }] },
    { name: STORE_CYCLE_DAYS, keyPath: 'id', indexes: [{ name: 'spaceId', keyPath: 'spaceId' }] },
]);

/** 日记 / 经期打卡的复合主键 */
export function dayRecordId(spaceId, date) {
    return `${spaceId}::${date}`;
}

// ============================================================
// 归一化
// ============================================================

function pickId(list, value, fallback) {
    return list.some((x) => x.id === value) ? value : fallback;
}

export function normalizeSpace(raw = {}) {
    const ownerKind = raw.ownerKind === OWNER_KIND.AI ? OWNER_KIND.AI : OWNER_KIND.USER;
    const ownerId = String(raw.ownerId || '');
    const base = createDefaultSpace(ownerKind, ownerId);

    return {
        ...base,
        id: String(raw.id || base.id),
        configured: raw.configured === true,
        title: String(raw.title || ''),
        theme: pickId(THEMES, raw.theme, DEFAULT_THEME),
        layout: pickId(LAYOUT_STYLES, raw.layout, DEFAULT_LAYOUT),
        textScale: pickId(TEXT_SCALES, raw.textScale, 'md'),
        styleNote: String(raw.styleNote || ''),
        birthday: isValidDateKey(raw.birthday) ? raw.birthday : '',
        // 时段起点夹到 0-19：起点固定 5 小时，19 点开始正好 24:00 结束。
        // 老数据里可能存过 20+（早期没夹），读的时候一并修掉。
        windowStart: clamp(raw.windowStart ?? DEFAULT_WINDOW_START, WINDOW_START_MIN, WINDOW_START_MAX),
        cycle: normalizeCycleConfig(raw.cycle),
        contextConfig: { ...createDefaultContextConfig(), ...(raw.contextConfig || {}) },
        contextOrder: normalizeContextOrder(raw.contextOrder),
        apiRef: raw.apiRef?.refId
            ? { type: raw.apiRef.type === 'group' ? 'group' : 'key', refId: String(raw.apiRef.refId) }
            : null,
        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

/**
 * 段落顺序。
 *
 * 用户排过序之后我们新增了一段 prompt —— 它不会出现在旧的 order 里。
 * 这里把「缺失的段按定义顺序补到末尾」，既保留用户的排序，
 * 又不会让新段落凭空消失（用户会以为新功能没生效）。
 */
function normalizeContextOrder(raw) {
    const known = CONTEXT_SECTIONS.map((s) => s.id);
    const saved = (Array.isArray(raw) ? raw : []).map(String).filter((id) => known.includes(id));
    const missing = known.filter((id) => !saved.includes(id));
    return [...saved, ...missing];
}

export function normalizeCycleConfig(raw = {}) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const trackFields = Array.isArray(src.trackFields) && src.trackFields.length
        ? src.trackFields.map(String)
        : [...DEFAULT_CYCLE.trackFields];
    return {
        ...DEFAULT_CYCLE,
        ...src,
        enabled: src.enabled === true,
        mode: src.mode === CYCLE_MODE.CYCLE_LENGTH ? CYCLE_MODE.CYCLE_LENGTH : CYCLE_MODE.MONTH_DAY,
        startDay: clamp(src.startDay ?? DEFAULT_CYCLE.startDay, 1, 31),
        cycleLength: clamp(src.cycleLength ?? DEFAULT_CYCLE.cycleLength, 15, 90),
        periodLength: clamp(src.periodLength ?? DEFAULT_CYCLE.periodLength, 1, 15),
        irregular: src.irregular === true,
        remindDaysBefore: clamp(src.remindDaysBefore ?? DEFAULT_CYCLE.remindDaysBefore, 0, 10),
        lastStart: isValidDateKey(src.lastStart) ? src.lastStart : '',
        careTone: String(src.careTone || DEFAULT_CYCLE.careTone),
        worldNote: String(src.worldNote || ''),
        customPrompt: String(src.customPrompt || ''),
        trackFields,
    };
}

export function normalizeEntry(raw = {}, spaceId = '') {
    const sid = String(raw.spaceId || spaceId);
    const date = isValidDateKey(raw.date) ? raw.date : todayKey();
    return {
        id: String(raw.id || dayRecordId(sid, date)),
        spaceId: sid,
        date,
        kind: ENTRY_KIND.DIARY,
        author: raw.author === OWNER_KIND.AI ? OWNER_KIND.AI : OWNER_KIND.USER,
        content: String(raw.content || ''),
        mood: String(raw.mood || ''),
        weather: String(raw.weather || ''),
        // 'manual' = 人写的 / 'ai' = 生成的。用于「重 roll 只重生成 AI 那篇」这类判断
        source: raw.source === 'ai' ? 'ai' : 'manual',
        /**
         * 重 roll 历史。每次重 roll 把旧正文压进来，用户能翻回去。
         * 只留最近 5 版 —— 全留会让单条记录无限膨胀，而 5 版之前的没人看。
         */
        revisions: (Array.isArray(raw.revisions) ? raw.revisions : []).slice(-5).map((r) => ({
            content: String(r?.content || ''),
            note: String(r?.note || ''),
            at: Number(r?.at) || 0,
        })),
        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

export function normalizeNote(raw = {}, spaceId = '') {
    const sid = String(raw.spaceId || spaceId);
    return {
        id: String(raw.id || makeId('note')),
        spaceId: sid,
        date: isValidDateKey(raw.date) ? raw.date : todayKey(),
        kind: ENTRY_KIND.NOTE,
        author: raw.author === OWNER_KIND.AI ? OWNER_KIND.AI : OWNER_KIND.USER,
        content: String(raw.content || ''),
        mood: String(raw.mood || ''),
        source: raw.source === 'ai' ? 'ai' : 'manual',
        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

export function normalizeMarker(raw = {}, spaceId = '') {
    const sid = String(raw.spaceId || spaceId);
    return {
        id: String(raw.id || makeId('mk')),
        spaceId: sid,
        kind: raw.kind === MARKER_KIND.COUNTDOWN ? MARKER_KIND.COUNTDOWN : MARKER_KIND.ANNIVERSARY,
        title: String(raw.title || ''),
        reason: String(raw.reason || ''),
        date: isValidDateKey(raw.date) ? raw.date : '',
        repeat: ['none', 'yearly', 'monthly'].includes(raw.repeat) ? raw.repeat : 'none',
        pinned: raw.pinned === true,
        // 'ai' 表示是 AI 在写日记时用 [记纪念日:] 存进来的，UI 上会标一下来源
        source: raw.source === 'ai' ? 'ai' : 'user',
        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

export function normalizeCycleDay(raw = {}, spaceId = '') {
    const sid = String(raw.spaceId || spaceId);
    const date = isValidDateKey(raw.date) ? raw.date : todayKey();
    const state = [CYCLE_STATE.PERIOD, CYCLE_STATE.NONE].includes(raw.state)
        ? raw.state
        : CYCLE_STATE.UNKNOWN;
    return {
        id: String(raw.id || dayRecordId(sid, date)),
        spaceId: sid,
        date,
        /**
         * ★ 三态。`none` 是「用户明确记录了今天没来」，和 `unknown`（还没记）
         *   必须分开 —— prompt 里要能对 AI 说死「她说了还没来，别当成来了」，
         *   而这句话只有在用户**主动记过**的前提下才成立。
         */
        state,
        /** 本次经期的第一天。周期长度的实测值全靠这些点算出来。 */
        isStart: raw.isStart === true,
        flow: String(raw.flow || ''),
        pain: String(raw.pain || ''),
        painSpots: (Array.isArray(raw.painSpots) ? raw.painSpots : []).map(String),
        mood: String(raw.mood || ''),
        symptoms: (Array.isArray(raw.symptoms) ? raw.symptoms : []).map(String),
        discharge: String(raw.discharge || ''),
        temp: raw.temp === '' || raw.temp == null ? '' : String(raw.temp),
        intimacy: raw.intimacy === true,
        intimacyProtected: raw.intimacyProtected !== false,
        meds: String(raw.meds || ''),
        product: String(raw.product || ''),
        productChanges: Number(raw.productChanges) || 0,
        note: String(raw.note || ''),
        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

// ============================================================
// 读写
// ============================================================

function dbOf(app) {
    return app?.toolkit?.db || null;
}

/**
 * 读整张表。
 *
 * `getAllRecords` 是 toolkit 的全表读；本 App 的数据量级（一年 365 篇日记）
 * 全读没有性能问题，而按 index 分次读反而会让「切换空间」变成 N 次异步。
 */
async function readAll(app, store, normalize) {
    const db = dbOf(app);
    if (!db) return [];
    try {
        const rows = await db.getAllRecords(store);
        return (Array.isArray(rows) ? rows : []).filter(Boolean).map((r) => normalize(r));
    } catch (err) {
        console.warn(`[diary/db] 读取 ${store} 失败`, err);
        return [];
    }
}

async function writeOne(app, store, record) {
    const db = dbOf(app);
    if (!db || !record?.id) return false;
    const plain = toPlain({ ...record, updatedAt: Date.now() });
    if (!plain) return false;
    try {
        await db.put(store, plain);
        return true;
    } catch (err) {
        console.warn(`[diary/db] 写入 ${store} 失败`, err);
        return false;
    }
}

async function removeOne(app, store, id) {
    const db = dbOf(app);
    if (!db || !id) return false;
    try {
        await db.remove(store, String(id));
        return true;
    } catch (err) {
        console.warn(`[diary/db] 删除 ${store} 失败`, err);
        return false;
    }
}

export const loadSpaces = (app) => readAll(app, STORE_SPACES, normalizeSpace);
export const loadEntries = (app) => readAll(app, STORE_ENTRIES, normalizeEntry);
export const loadNotes = (app) => readAll(app, STORE_NOTES, normalizeNote);
export const loadMarkers = (app) => readAll(app, STORE_MARKERS, normalizeMarker);
export const loadCycleDays = (app) => readAll(app, STORE_CYCLE_DAYS, normalizeCycleDay);

export const saveSpace = (app, r) => writeOne(app, STORE_SPACES, r);
export const saveEntry = (app, r) => writeOne(app, STORE_ENTRIES, r);
export const saveNote = (app, r) => writeOne(app, STORE_NOTES, r);
export const saveMarker = (app, r) => writeOne(app, STORE_MARKERS, r);
export const saveCycleDay = (app, r) => writeOne(app, STORE_CYCLE_DAYS, r);

export const removeEntry = (app, id) => removeOne(app, STORE_ENTRIES, id);
export const removeNote = (app, id) => removeOne(app, STORE_NOTES, id);
export const removeMarker = (app, id) => removeOne(app, STORE_MARKERS, id);
export const removeCycleDay = (app, id) => removeOne(app, STORE_CYCLE_DAYS, id);

/**
 * 删掉一整个日记空间。
 *
 * ★ 必须连带删掉它名下的日记 / 便利贴 / 纪念日 / 打卡。
 *   只删 space 那一条的话，剩下的记录再也没有入口能读到，
 *   但仍然占着空间，而且下次这个 AI 被重新配置时旧数据会诡异地冒出来。
 */
export async function removeSpaceCascade(app, spaceId) {
    const db = dbOf(app);
    if (!db || !spaceId) return false;
    const sid = String(spaceId);
    try {
        const [entries, notes, markers, days] = await Promise.all([
            loadEntries(app), loadNotes(app), loadMarkers(app), loadCycleDays(app),
        ]);
        const jobs = [];
        const sweep = (rows, store) => {
            for (const row of rows) {
                if (String(row.spaceId) === sid) jobs.push(db.remove(store, row.id).catch(() => {}));
            }
        };
        sweep(entries, STORE_ENTRIES);
        sweep(notes, STORE_NOTES);
        sweep(markers, STORE_MARKERS);
        sweep(days, STORE_CYCLE_DAYS);
        await Promise.all(jobs);
        await db.remove(STORE_SPACES, sid);
        return true;
    } catch (err) {
        console.warn('[diary/db] 删除空间失败', err);
        return false;
    }
}

/** 导出全部数据（「我的」页的导出按钮用） */
export async function exportAll(app) {
    const [spaces, entries, notes, markers, cycleDays] = await Promise.all([
        loadSpaces(app), loadEntries(app), loadNotes(app), loadMarkers(app), loadCycleDays(app),
    ]);
    return {
        format: 'diary-export',
        version: 1,
        exportedAt: new Date().toISOString(),
        spaces, entries, notes, markers, cycleDays,
    };
}
