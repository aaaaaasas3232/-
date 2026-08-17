/**
 * 日记 · 状态仓库
 *
 * 模块级 `Vue.reactive` 单例 + mutator + 分对象防抖落盘，照 relax-app / dream-weaver
 * 那套（项目里最成熟的 vue 模式范式）。
 *
 * ── 规矩 ────────────────────────────────────────────────────────
 *
 * 1. 组件**只读** `getState()`，改状态一律走本文件导出的 mutator。
 *    「什么时候该落盘」只有这一个地方要考虑。
 * 2. 落盘按对象粒度分开：改一篇日记只写那一条，不重写整库。
 * 3. hydrate 只用 `_hydrating` 防并发，**不用** `_hydrated` 硬阻断 ——
 *    硬阻断会让首次失败后永远没有第二次机会（AGENTS2 §9.12 天气 App 的坑）。
 *
 * ── 「一天一篇日记」这条规则在哪儿实现的 ─────────────────────────
 *
 * 三层：
 *   1. **存储层**：`diaryEntries` 的主键是 `<spaceId>::<date>`，重复写入天然是覆盖
 *   2. **本文件** `saveTodayEntry()`：先算 kind，时段外一律走便利贴
 *   3. UI 层只是把结果显示出来，不做任何判断
 *
 * 判定只在第 2 层做一次（`resolveWriteKind`），UI 和 AI 生成都调它 ——
 * 否则会出现「界面说在写日记、实际存成了便利贴」这种对不上的情况。
 */

import {
    DIARY_STORES, dayRecordId,
    loadSpaces, loadEntries, loadNotes, loadMarkers, loadCycleDays,
    saveSpace, saveEntry, saveNote, saveMarker, saveCycleDay,
    removeEntry as dbRemoveEntry, removeNote as dbRemoveNote,
    removeMarker as dbRemoveMarker, removeCycleDay as dbRemoveCycleDay,
    removeSpaceCascade, exportAll,
    normalizeSpace, normalizeEntry, normalizeNote, normalizeMarker, normalizeCycleDay,
} from './services/db.js';
import {
    OWNER_KIND, ENTRY_KIND, CYCLE_STATE,
    makeSpaceId, createDefaultSpace,
} from './constants.js';
import {
    isSameId, findById, todayKey, addDays, isInWriteWindow, compareDateKey,
    debounce, isValidDateKey,
} from './utils.js';
import * as nook from './services/nook-bridge.js';
import { resolveCycle } from './services/cycle-service.js';
import * as ai from './services/ai-service.js';
import { bindLiveState, writeSnapshot } from './services/live-context.js';

// ============================================================
// 状态
// ============================================================

function makeReactive(raw) {
    const Vue = typeof window !== 'undefined' ? window.Vue : null;
    return typeof Vue?.reactive === 'function' ? Vue.reactive(raw) : raw;
}

const STATE = makeReactive({
    ready: false,
    error: '',
    sdkReady: false,

    // ── 数据 ────────────────────────────────
    spaces: [],
    entries: [],
    notes: [],
    markers: [],
    cycleDays: [],

    // ── 路由 ────────────────────────────────
    /** 'home' | 'archive' | 'cycle' | 'plans' */
    tab: 'home',
    /** 当前正在看谁的日记本 */
    activeSpaceId: '',
    /** 归档页正在看的月份 'YYYY-MM' */
    archiveMonth: '',
    /** 归档 / 经期页点开的某一天 */
    focusDate: '',

    // ── UI ──────────────────────────────────
    modal: null,        // { type, payload }
    sheet: null,        // 底部抽屉
    busy: '',           // 正在跑的异步任务描述（空 = 空闲）
    toast: '',

    /**
     * 每分钟 +1，只为了让「现在是不是写日记时段」这类 computed 重算。
     * 不存时间戳本身 —— 存了的话每次 tick 都会让所有依赖时间的 computed 失效，
     * 而实际上大部分只关心「分钟变了没」。
     */
    minuteTick: 0,
});

export function getState() {
    return STATE;
}

let _app = null;
let _hydrating = false;
let _tickTimer = null;

// ============================================================
// 派生
// ============================================================

export function getActiveSpace() {
    return findById(STATE.spaces, STATE.activeSpaceId);
}

/** 「我」的日记本 —— 跟着默认用户卡走 */
export function getUserSpaceId() {
    const user = nook.getDefaultUser();
    return user?.id ? makeSpaceId(OWNER_KIND.USER, user.id) : '';
}

export function getUserSpace() {
    return findById(STATE.spaces, getUserSpaceId());
}

export function isUserSpace(space = getActiveSpace()) {
    return space?.ownerKind === OWNER_KIND.USER;
}

export function getSpace(spaceId) {
    return findById(STATE.spaces, spaceId);
}

export function entriesOf(spaceId) {
    return STATE.entries
        .filter((e) => isSameId(e.spaceId, spaceId))
        .sort((a, b) => compareDateKey(b.date, a.date));
}

export function notesOf(spaceId, date) {
    return STATE.notes
        .filter((n) => isSameId(n.spaceId, spaceId) && (!date || n.date === date))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function markersOf(spaceId) {
    return STATE.markers
        .filter((m) => isSameId(m.spaceId, spaceId))
        .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return compareDateKey(a.date, b.date);
        });
}

export function cycleDaysOf(spaceId) {
    return STATE.cycleDays
        .filter((d) => isSameId(d.spaceId, spaceId))
        .sort((a, b) => compareDateKey(a.date, b.date));
}

export function getEntry(spaceId, date) {
    return findById(STATE.entries, dayRecordId(spaceId, date));
}

export function getTodayEntry(spaceId = STATE.activeSpaceId) {
    return getEntry(spaceId, todayKey());
}

export function getCycleInfo(spaceId = STATE.activeSpaceId) {
    const space = getSpace(spaceId);
    if (!space) return { enabled: false, state: 'off' };
    return resolveCycle(space, cycleDaysOf(spaceId));
}

/**
 * 现在写东西会存成什么。
 *
 * ★ 这是「一天一篇日记」规则的**唯一判定点**。UI 显示什么、AI 生成什么
 *   都读它，不允许任何地方自己再判一次时间。
 */
export function resolveWriteKind(space = getActiveSpace()) {
    if (!space) return ENTRY_KIND.NOTE;
    // 读一下 tick，让这个函数在分钟变化时被 Vue 重新求值
    void STATE.minuteTick;
    return isInWriteWindow(space.windowStart) ? ENTRY_KIND.DIARY : ENTRY_KIND.NOTE;
}

export function isWriteWindowOpen(space = getActiveSpace()) {
    return resolveWriteKind(space) === ENTRY_KIND.DIARY;
}

/** 这个 AI 有没有配置过自己的日记本 —— 没配置就进不去（产品要求） */
export function isSpaceReady(spaceId) {
    return getSpace(spaceId)?.configured === true;
}

// ============================================================
// 落盘
// ============================================================

/**
 * 按 id 分桶防抖。
 *
 * 为什么不用一个全局 timer：用户可能连续改两条不同的记录，
 * 单 timer 会把前一条的写入吞掉。每条一个 timer 才安全。
 */
function makeBucketPersister(saveFn, pick, wait = 400) {
    const timers = new Map();
    const flushOne = (key) => {
        const record = pick(key);
        return record ? saveFn(_app, record) : Promise.resolve(false);
    };
    return {
        schedule(key) {
            if (!_app || !key) return;
            const k = String(key);
            if (timers.has(k)) clearTimeout(timers.get(k));
            timers.set(k, setTimeout(() => {
                timers.delete(k);
                void flushOne(k);
            }, wait));
        },
        async flush() {
            const jobs = [];
            for (const [key, timer] of timers) {
                clearTimeout(timer);
                jobs.push(flushOne(key));
            }
            timers.clear();
            await Promise.all(jobs);
        },
    };
}

const persistSpace = makeBucketPersister(saveSpace, (id) => findById(STATE.spaces, id));
const persistEntry = makeBucketPersister(saveEntry, (id) => findById(STATE.entries, id));
const persistNote = makeBucketPersister(saveNote, (id) => findById(STATE.notes, id));
const persistMarker = makeBucketPersister(saveMarker, (id) => findById(STATE.markers, id));
const persistCycleDay = makeBucketPersister(saveCycleDay, (id) => findById(STATE.cycleDays, id));

/** 快照给 murmur 用，节流一下 —— 它只影响下一次发消息，不需要实时 */
const syncSnapshot = debounce(() => writeSnapshot(STATE), 800);

/**
 * 立刻把所有挂起的写入落盘。
 *
 * 必须在离开 App / 页面隐藏 / 组件卸载时调 —— 否则防抖窗口里的最后一次修改会丢。
 * 这是「改了没保存」这类投诉最常见的来源。
 */
export async function flushPersist() {
    syncSnapshot.flush();
    await Promise.all([
        persistSpace.flush(), persistEntry.flush(), persistNote.flush(),
        persistMarker.flush(), persistCycleDay.flush(),
    ]);
}

function touched(kind, id) {
    ({ space: persistSpace, entry: persistEntry, note: persistNote, marker: persistMarker, cycleDay: persistCycleDay })[kind]
        ?.schedule(id);
    syncSnapshot();
}

// ============================================================
// hydrate
// ============================================================

export async function hydrate(app) {
    if (_hydrating) return;
    _hydrating = true;
    if (app) _app = app;

    try {
        // SDK 可能比 App 起得晚。等一下但不阻塞 —— 等不到也要把本地数据读出来，
        // 至少用户能看见自己写过的东西（人设名字那些位置显示占位）。
        const ready = await nook.whenReady(6000);
        STATE.sdkReady = ready;

        const [spaces, entries, notes, markers, cycleDays] = await Promise.all([
            loadSpaces(_app), loadEntries(_app), loadNotes(_app), loadMarkers(_app), loadCycleDays(_app),
        ]);

        STATE.spaces = spaces;
        STATE.entries = entries;
        STATE.notes = notes;
        STATE.markers = markers;
        STATE.cycleDays = cycleDays;

        ensureUserSpace();

        if (!STATE.activeSpaceId || !getSpace(STATE.activeSpaceId)) {
            STATE.activeSpaceId = getUserSpaceId();
        }
        if (!STATE.archiveMonth) STATE.archiveMonth = todayKey().slice(0, 7);

        STATE.ready = true;
        STATE.error = '';

        bindLiveState(STATE);
        writeSnapshot(STATE);
        startTicker();
    } catch (err) {
        console.error('[diary/store] hydrate 失败', err);
        STATE.error = err?.message || '数据加载失败';
        // ★ 不设 ready=true 也不设永久失败标记：下次进 App 还会再试一次
    } finally {
        _hydrating = false;
    }
}

/**
 * 分钟计时器。
 *
 * 挂在**真实时间**上而不是「某个方法被调用时」—— AGENTS2 §1.2 的教训：
 * 计时器挂在方法调用上，方法没被调就永远不 tick，UI 会停在打开 App 那一刻的状态。
 */
function startTicker() {
    if (_tickTimer) return;
    _tickTimer = setInterval(() => {
        STATE.minuteTick = (STATE.minuteTick + 1) % 100000;
    }, 60000);
}

export function stopTicker() {
    if (_tickTimer) {
        clearInterval(_tickTimer);
        _tickTimer = null;
    }
}

// ============================================================
// 空间
// ============================================================

/** 保证「我」的日记本存在（哪怕还没配置过） */
export function ensureUserSpace() {
    const user = nook.getDefaultUser();
    if (!user?.id) return null;
    const id = makeSpaceId(OWNER_KIND.USER, user.id);
    let space = getSpace(id);
    if (!space) {
        space = normalizeSpace(createDefaultSpace(OWNER_KIND.USER, user.id));
        STATE.spaces.push(space);
        touched('space', id);
    }
    return space;
}

/**
 * 保证某个 AI 的日记本记录存在。
 *
 * 注意**建记录 ≠ 配置好**：新建出来的 `configured` 是 false，
 * 用户点进去看到的是「TA 还没有布置自己的日记本」+ 一个「让 TA 布置」按钮。
 * 产品要求「某个 AI 得让他调取 API 配置完毕才能进入日记空间」。
 */
export function ensureAiSpace(aiId) {
    if (!aiId) return null;
    const id = makeSpaceId(OWNER_KIND.AI, aiId);
    let space = getSpace(id);
    if (!space) {
        space = normalizeSpace(createDefaultSpace(OWNER_KIND.AI, aiId));
        STATE.spaces.push(space);
        touched('space', id);
    }
    return space;
}

export function patchSpace(spaceId, patch) {
    const space = getSpace(spaceId);
    if (!space) return null;
    Object.assign(space, patch, { updatedAt: Date.now() });
    touched('space', space.id);
    return space;
}

export function patchCycleConfig(spaceId, patch) {
    const space = getSpace(spaceId);
    if (!space) return null;
    space.cycle = { ...space.cycle, ...patch };
    space.updatedAt = Date.now();
    touched('space', space.id);
    return space;
}

/** 走完配置向导 */
export function completeSetup(spaceId, patch = {}) {
    return patchSpace(spaceId, { ...patch, configured: true });
}

export function openSpace(spaceId) {
    if (!getSpace(spaceId)) return false;
    STATE.activeSpaceId = spaceId;
    STATE.tab = 'home';
    STATE.focusDate = '';
    return true;
}

export async function deleteSpace(spaceId) {
    const space = getSpace(spaceId);
    if (!space || space.ownerKind === OWNER_KIND.USER) return false;   // 自己的本子不给删
    await removeSpaceCascade(_app, spaceId);
    STATE.spaces = STATE.spaces.filter((s) => !isSameId(s.id, spaceId));
    STATE.entries = STATE.entries.filter((e) => !isSameId(e.spaceId, spaceId));
    STATE.notes = STATE.notes.filter((n) => !isSameId(n.spaceId, spaceId));
    STATE.markers = STATE.markers.filter((m) => !isSameId(m.spaceId, spaceId));
    STATE.cycleDays = STATE.cycleDays.filter((d) => !isSameId(d.spaceId, spaceId));
    if (isSameId(STATE.activeSpaceId, spaceId)) STATE.activeSpaceId = getUserSpaceId();
    syncSnapshot();
    return true;
}

// ============================================================
// 日记 / 便利贴
// ============================================================

/**
 * 写入今天的内容。
 *
 * 时段内 → 覆盖今天那一篇日记（主键相同，天然覆盖）
 * 时段外 → 新增一张便利贴
 *
 * @param {object} opts
 * @param {string} opts.content
 * @param {string} [opts.spaceId]
 * @param {string} [opts.mood]
 * @param {string} [opts.author]  'user' | 'ai'
 * @param {string} [opts.source]  'manual' | 'ai'
 * @param {string} [opts.date]    补写往期日记时指定
 * @param {string} [opts.forceKind] 明确指定类型，跳过时段判断（重 roll 时用）
 */
export function saveTodayEntry(opts = {}) {
    const spaceId = opts.spaceId || STATE.activeSpaceId;
    const space = getSpace(spaceId);
    if (!space) return null;

    const content = String(opts.content || '').trim();
    if (!content) return null;

    const date = isValidDateKey(opts.date) ? opts.date : todayKey();
    // 补写往期：日期不是今天时一律当日记（那天的时段早就过了，
    // 但用户是在"补写"而不是"随手记"，语义上就是日记）
    const kind = opts.forceKind
        || (date !== todayKey() ? ENTRY_KIND.DIARY : resolveWriteKind(space));

    if (kind === ENTRY_KIND.NOTE) {
        return addNote({ ...opts, spaceId, content, date });
    }
    return upsertEntry({ ...opts, spaceId, content, date });
}

export function upsertEntry(opts = {}) {
    const spaceId = opts.spaceId || STATE.activeSpaceId;
    const date = isValidDateKey(opts.date) ? opts.date : todayKey();
    const id = dayRecordId(spaceId, date);

    let entry = findById(STATE.entries, id);
    if (entry) {
        // 内容真的变了才压 revision —— 只改心情不该产生一条重 roll 历史
        const nextContent = String(opts.content ?? entry.content);
        if (opts.pushRevision && nextContent !== entry.content && entry.content) {
            entry.revisions = [...entry.revisions, {
                content: entry.content, note: String(opts.wish || ''), at: Date.now(),
            }].slice(-5);
        }
        entry.content = nextContent;
        if (opts.mood !== undefined) entry.mood = String(opts.mood || '');
        if (opts.weather !== undefined) entry.weather = String(opts.weather || '');
        if (opts.source) entry.source = opts.source;
        entry.updatedAt = Date.now();
    } else {
        entry = normalizeEntry({
            id, spaceId, date,
            content: opts.content,
            mood: opts.mood,
            weather: opts.weather,
            author: opts.author || getSpace(spaceId)?.ownerKind || OWNER_KIND.USER,
            source: opts.source || 'manual',
        });
        STATE.entries.push(entry);
    }
    touched('entry', id);
    return entry;
}

export function removeEntryRecord(spaceId, date) {
    const id = dayRecordId(spaceId, date);
    const idx = STATE.entries.findIndex((e) => isSameId(e.id, id));
    if (idx === -1) return false;
    STATE.entries.splice(idx, 1);
    void dbRemoveEntry(_app, id);
    syncSnapshot();
    return true;
}

/** 翻回上一版（重 roll 之后反悔） */
export function revertEntry(spaceId, date) {
    const entry = getEntry(spaceId, date);
    if (!entry || entry.revisions.length === 0) return false;
    const last = entry.revisions[entry.revisions.length - 1];
    entry.revisions = entry.revisions.slice(0, -1);
    entry.content = last.content;
    entry.updatedAt = Date.now();
    touched('entry', entry.id);
    return true;
}

export function addNote(opts = {}) {
    const spaceId = opts.spaceId || STATE.activeSpaceId;
    const note = normalizeNote({
        spaceId,
        date: opts.date,
        content: opts.content,
        mood: opts.mood,
        author: opts.author || getSpace(spaceId)?.ownerKind || OWNER_KIND.USER,
        source: opts.source || 'manual',
    }, spaceId);
    STATE.notes.push(note);
    touched('note', note.id);
    return note;
}

export function patchNote(noteId, patch) {
    const note = findById(STATE.notes, noteId);
    if (!note) return null;
    Object.assign(note, patch, { updatedAt: Date.now() });
    touched('note', note.id);
    return note;
}

export function removeNote(noteId) {
    const idx = STATE.notes.findIndex((n) => isSameId(n.id, noteId));
    if (idx === -1) return false;
    STATE.notes.splice(idx, 1);
    void dbRemoveNote(_app, noteId);
    syncSnapshot();
    return true;
}

// ============================================================
// 纪念日 / 计划
// ============================================================

export function addMarker(opts = {}) {
    const spaceId = opts.spaceId || STATE.activeSpaceId;
    const marker = normalizeMarker({ ...opts, spaceId }, spaceId);
    if (!marker.title || !marker.date) return null;
    STATE.markers.push(marker);
    touched('marker', marker.id);
    return marker;
}

/**
 * 批量吸收 AI 回写的 marker。
 *
 * 去重：同一个空间下「标题 + 日期」都一样就当同一条。
 * 不去重的话，AI 每写一篇日记就会把「第一次见面」再存一遍。
 */
export function absorbMarkers(list, spaceId) {
    const sid = spaceId || STATE.activeSpaceId;
    const existing = new Set(
        markersOf(sid).map((m) => `${m.title}::${m.date}`),
    );
    const added = [];
    for (const raw of (Array.isArray(list) ? list : [])) {
        const key = `${raw.title}::${raw.date}`;
        if (existing.has(key)) continue;
        existing.add(key);
        const marker = addMarker({ ...raw, spaceId: sid });
        if (marker) added.push(marker);
    }
    return added;
}

export function patchMarker(markerId, patch) {
    const marker = findById(STATE.markers, markerId);
    if (!marker) return null;
    Object.assign(marker, patch, { updatedAt: Date.now() });
    touched('marker', marker.id);
    return marker;
}

export function removeMarker(markerId) {
    const idx = STATE.markers.findIndex((m) => isSameId(m.id, markerId));
    if (idx === -1) return false;
    STATE.markers.splice(idx, 1);
    void dbRemoveMarker(_app, markerId);
    syncSnapshot();
    return true;
}

// ============================================================
// 经期打卡
// ============================================================

export function getCycleDay(spaceId, date) {
    return findById(STATE.cycleDays, dayRecordId(spaceId, date));
}

/**
 * 打卡。
 *
 * ★ `state` 是三态。把它设成 `none` 表示「用户明确记录了今天没来」——
 *   这条记录是 prompt 里那句「在她自己更新之前不要认为她来了」的依据，
 *   删不得也不能和「还没记」混为一谈。
 */
export function setCycleDay(spaceId, date, patch = {}) {
    const sid = spaceId || STATE.activeSpaceId;
    const day = isValidDateKey(date) ? date : todayKey();
    const id = dayRecordId(sid, day);

    let record = findById(STATE.cycleDays, id);
    if (!record) {
        record = normalizeCycleDay({ id, spaceId: sid, date: day }, sid);
        STATE.cycleDays.push(record);
    }
    Object.assign(record, patch, { updatedAt: Date.now() });

    // 标了「来了」而前一天不是经期 → 自动认定为本次的第一天。
    // 用户很少主动点「这是第一天」，但周期长度全靠这个点算，不能指望她记得。
    if (record.state === CYCLE_STATE.PERIOD && patch.isStart === undefined) {
        const prev = getCycleDay(sid, addDays(day, -1));
        record.isStart = prev?.state !== CYCLE_STATE.PERIOD;
    }
    if (record.state !== CYCLE_STATE.PERIOD) record.isStart = false;

    touched('cycleDay', id);
    // 最近一次开始日同步回配置，让「没有打卡历史」的推算也能用上
    if (record.isStart) patchCycleConfig(sid, { lastStart: day });
    return record;
}

export function clearCycleDay(spaceId, date) {
    const id = dayRecordId(spaceId, date);
    const idx = STATE.cycleDays.findIndex((d) => isSameId(d.id, id));
    if (idx === -1) return false;
    STATE.cycleDays.splice(idx, 1);
    void dbRemoveCycleDay(_app, id);
    syncSnapshot();
    return true;
}

/** 一键「来了 / 没来」—— 今日卡片上最常用的两个按钮 */
export function markToday(state, spaceId = STATE.activeSpaceId) {
    return setCycleDay(spaceId, todayKey(), { state });
}

// ============================================================
// AI 调用
// ============================================================

/**
 * 组装 prompt 需要的完整上下文。
 *
 * 抽出来是因为「生成」「重 roll」「预览」三处都要用，
 * 而且必须**完全一致** —— 预览里看到的段落就是发出去的段落。
 */
export function buildContext({ spaceId = STATE.activeSpaceId, kind, wish, hint, date } = {}) {
    const space = getSpace(spaceId);
    if (!space) return null;

    const isAi = space.ownerKind === OWNER_KIND.AI;
    const userCard = nook.getDefaultUser();
    const world = nook.getBoundWorld(userCard);
    const aiCard = isAi ? nook.getAi(space.ownerId) : null;

    // 对方 = 另一侧的人。AI 的本子里，「对方」是用户；用户的本子里，
    // 「对方」是这个世界观下的第一个 AI（用户本子不绑定单一 AI）
    const peerSpaceId = isAi ? getUserSpaceId() : '';
    const peerEntries = peerSpaceId ? entriesOf(peerSpaceId) : [];

    const target = isValidDateKey(date) ? date : todayKey();
    const entry = getEntry(spaceId, target);

    // 经期永远读**用户**的本子 —— AI 不会有生理期，但它要知道用户的
    const cycleSpaceId = isUserSpace(space) ? spaceId : getUserSpaceId();
    const cycleSpace = getSpace(cycleSpaceId);

    return {
        space,
        date: target,
        kind: kind || resolveWriteKind(space),
        authorKind: space.ownerKind,
        selfCard: isAi ? aiCard : userCard,
        selfName: (isAi ? aiCard?.name : userCard?.name) || '',
        peerCard: isAi ? userCard : null,
        peerName: isAi ? (userCard?.name || '对方') : '',
        world,
        selfEntries: entriesOf(spaceId),
        peerEntries,
        todayNotes: notesOf(spaceId, target),
        // 纪念日两边都给：AI 要知道用户的考试，用户也想看到 AI 记了什么
        markers: [...markersOf(spaceId), ...(peerSpaceId ? markersOf(peerSpaceId) : [])],
        cycleSpace,
        cycleInfo: cycleSpace ? resolveCycle(cycleSpace, cycleDaysOf(cycleSpaceId)) : null,
        wish: wish || '',
        hint: hint || '',
        previousContent: entry?.content || '',
    };
}

function resolveApiFor(space) {
    const ownerCard = space.ownerKind === OWNER_KIND.AI
        ? nook.sdk()?.aiPersons?.get?.(space.ownerId)
        : nook.getDefaultUser();
    return nook.resolveApiRef({ space, ownerCard });
}

/**
 * 让 AI 写一篇（或重 roll）。
 *
 * @param {object} opts
 * @param {string} [opts.spaceId]
 * @param {string} [opts.wish]  重 roll 时用户提的意见，不提就是空
 * @param {string} [opts.hint]  首次生成时给的方向
 */
export async function generateEntry(opts = {}) {
    const spaceId = opts.spaceId || STATE.activeSpaceId;
    const space = getSpace(spaceId);
    if (!space) return { ok: false, error: '日记本不存在' };
    if (STATE.busy) return { ok: false, error: '还有一个任务在跑，等它结束' };

    const ctx = buildContext({ spaceId, wish: opts.wish, hint: opts.hint, date: opts.date });
    if (!ctx) return { ok: false, error: '上下文拼不出来' };

    STATE.busy = ctx.kind === ENTRY_KIND.DIARY ? '正在写今天的日记' : '正在写便利贴';
    const signal = ai.createAbort(spaceId);

    try {
        const result = await ai.generateEntry({
            ctx,
            apiRef: resolveApiFor(space),
            signal,
        });
        if (!result.ok) return { ok: false, error: result.error };

        // 写入。重 roll 时压一版历史，让用户能翻回去
        const saved = saveTodayEntry({
            spaceId,
            date: ctx.date,
            content: result.content,
            author: space.ownerKind,
            source: 'ai',
            forceKind: ctx.kind,
            pushRevision: Boolean(opts.wish),
            wish: opts.wish,
        });

        const added = absorbMarkers(result.markers, spaceId);
        return { ok: true, entry: saved, kind: ctx.kind, markers: added };
    } catch (err) {
        console.error('[diary/store] 生成失败', err);
        return { ok: false, error: err?.message || '生成失败' };
    } finally {
        ai.releaseAbort(spaceId);
        STATE.busy = '';
    }
}

export function abortGenerate(spaceId = STATE.activeSpaceId) {
    ai.abort(spaceId);
    STATE.busy = '';
}

/**
 * 让 AI 自己布置日记本。
 *
 * 产品要求：AI 的日记空间必须由 AI 通过 API 调用配置完毕才能进入。
 * 所以这里成功之后才把 `configured` 置 true。
 */
export async function configureAiSpace(aiId) {
    const space = ensureAiSpace(aiId);
    if (!space) return { ok: false, error: '找不到这个 AI' };
    if (STATE.busy) return { ok: false, error: '还有一个任务在跑，等它结束' };

    const aiCard = nook.sdk()?.aiPersons?.get?.(aiId) || nook.getAi(aiId);
    const world = nook.getBoundWorld(nook.getDefaultUser());

    STATE.busy = '正在让 TA 布置日记本';
    const signal = ai.createAbort(space.id);
    try {
        const result = await ai.generateSpaceSetup({
            aiCard,
            world,
            apiRef: resolveApiFor(space),
            signal,
        });
        if (!result.ok) return { ok: false, error: result.error };

        patchSpace(space.id, { ...result.patch, configured: true });
        return { ok: true, space: getSpace(space.id) };
    } catch (err) {
        console.error('[diary/store] AI 配置失败', err);
        return { ok: false, error: err?.message || '配置失败' };
    } finally {
        ai.releaseAbort(space.id);
        STATE.busy = '';
    }
}

// ============================================================
// UI 辅助
// ============================================================

export function openModal(type, payload = {}) {
    STATE.modal = { type, payload };
}

export function closeModal() {
    STATE.modal = null;
}

export function openSheet(type, payload = {}) {
    STATE.sheet = { type, payload };
}

export function closeSheet() {
    STATE.sheet = null;
}

let _toastTimer = null;

export function toast(message) {
    STATE.toast = String(message || '');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { STATE.toast = ''; }, 2400);
}

export function setTab(tab) {
    STATE.tab = tab;
    STATE.focusDate = '';
}

export function setArchiveMonth(month) {
    STATE.archiveMonth = month;
}

export function setFocusDate(date) {
    STATE.focusDate = date || '';
}

export { DIARY_STORES, exportAll };
