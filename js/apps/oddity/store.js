/**
 * 小奇怪 · 状态仓库
 *
 * 模块级 `Vue.reactive` 单例 + mutator + 分对象防抖落盘,
 * 照 relax-app / 湛蓝回忆 那套(项目里最成熟的 vue 模式范式)。
 *
 * ── 规矩 ────────────────────────────────────────────────────────
 *
 * 1. 组件**只读** `getState()`,改状态一律走本文件导出的 mutator。
 *    这样「什么时候该落盘」只有一个地方要考虑。
 * 2. 落盘按对象粒度:改主题只写 `oqLibrary`,落一子只写 `oqGames` 那一条。
 * 3. hydrate 只用 `_hydrating` 防并发,**不用** `_hydrated` 硬阻断 ——
 *    首次失败后必须还能有第二次(AGENTS2 §9.12 天气 App 踩过)。
 * 4. vue 模式框架**不会**帮你调 hydrate,根组件 `mounted()` 里自己踢。
 */

import {
    GAME_MINESWEEPER, GAME_HAVEYOU, GAME_GOMOKU, DEFAULT_SUB_TABS,
    TABS, TAB_ITEMS, FAVORITE_LIMIT, ANON,
    ANON_ASKBOX, ANON_LETTERBOX, ANON_BOTTLE,
} from './constants.js';
import * as db from './services/db.js';
import * as ms from './services/minesweeper-engine.js';
import * as hy from './services/haveyou-engine.js';
import * as go from './services/gomoku-engine.js';
import * as bridge from './services/chat-bridge.js';
import { syncStatsPrompt, syncAnonPrompt } from './services/app-prompts.js';
import { buildBlock } from './services/subtitle-art.js';
import { makeId, asArray, debounce, truncate } from './utils.js';
import { normalizeTheme } from './theme.js';

const PERSIST_DEBOUNCE_MS = 380;

// ============================================================
// 状态
// ============================================================

function makeReactive(raw) {
    const Vue = typeof window !== 'undefined' ? window.Vue : null;
    return typeof Vue?.reactive === 'function' ? Vue.reactive(raw) : raw;
}

const STATE = makeReactive({
    ready: false,

    // ── 导航 ────────────────────────────────
    tab: 'play',
    subTabs: { ...DEFAULT_SUB_TABS },

    // ── 数据 ────────────────────────────────
    library: db.normalizeLibrary({}),
    /** 各玩法「当前这一局」的引擎 state。null = 还没开局 */
    minesweeper: null,
    haveyou: null,
    gomoku: null,
    /** 战绩(读一次,打完再刷) */
    scores: [],

    /** 匿名三件套。三张单例记录,结构见 services/db.js 的 normalizeAnon */
    askbox: { questions: [] },
    letterbox: { letters: [] },
    bottle: { rounds: [] },

    // ── UI ─────────────────────────────────
    modal: null,     // { type, payload } —— 居中小卡片
    /**
     * 底部面板。和 modal 分开管。
     *
     * 面板是「当前这个小东西的工具抽屉」,由顶部细浮条上那一个工具键统一开;
     * 各个 view 自己决定 `panel === 'tools'` 的时候画什么。
     * 这样「工具放哪儿」是全 App 一致的一条规矩,而不是每个页面自己发明一条底栏。
     */
    panel: '',
    toast: '',
});

let _app = null;
let _hydrating = null;

export function getState() {
    return STATE;
}

export function getSettings() {
    return STATE.library.settings;
}

export function getLibrary() {
    return STATE.library;
}

// ============================================================
// 落盘
// ============================================================

const persistLibrary = debounce(() => {
    if (!_app) return;
    void db.saveLibrary(_app, STATE.library);
}, PERSIST_DEBOUNCE_MS);

const persistMinesweeper = debounce(() => {
    if (!_app) return;
    void db.saveGame(_app, GAME_MINESWEEPER, GAME_MINESWEEPER, STATE.minesweeper);
}, PERSIST_DEBOUNCE_MS);

const persistHaveyou = debounce(() => {
    if (!_app) return;
    void db.saveGame(_app, GAME_HAVEYOU, GAME_HAVEYOU, STATE.haveyou);
}, PERSIST_DEBOUNCE_MS);

const persistGomoku = debounce(() => {
    if (!_app) return;
    void db.saveGame(_app, GAME_GOMOKU, GAME_GOMOKU, STATE.gomoku);
}, PERSIST_DEBOUNCE_MS);

const persistAskbox = debounce(() => {
    if (!_app) return;
    void db.saveAnon(_app, ANON_ASKBOX, { questions: STATE.askbox.questions });
    syncAnonToMurmur();
}, PERSIST_DEBOUNCE_MS);

const persistLetterbox = debounce(() => {
    if (!_app) return;
    void db.saveAnon(_app, ANON_LETTERBOX, { letters: STATE.letterbox.letters });
    syncAnonToMurmur();
}, PERSIST_DEBOUNCE_MS);

const persistBottle = debounce(() => {
    if (!_app) return;
    void db.saveAnon(_app, ANON_BOTTLE, { rounds: STATE.bottle.rounds });
}, PERSIST_DEBOUNCE_MS);

/**
 * 把防抖里还没落的都写掉。
 *
 * 离开 App / 页面隐藏时必须调 —— `beforeUnmount` 里 Vue 是同步卸载的,
 * 但 IndexedDB 的 put 是异步,不 flush 的话最后几步操作会被吞。
 */
export async function flushPersist() {
    persistLibrary.flush();
    persistMinesweeper.flush();
    persistHaveyou.flush();
    persistGomoku.flush();
    persistAskbox.flush();
    persistLetterbox.flush();
    persistBottle.flush();
    // 给上面几个 put 一个 microtask 的空档真正发出去
    await Promise.resolve();
}

// ============================================================
// hydrate
// ============================================================

export async function hydrate(app) {
    if (app) _app = app;
    if (_hydrating) return _hydrating;

    _hydrating = (async () => {
        try {
            const library = await db.loadLibrary(_app);
            STATE.library = library;
            STATE.tab = TABS.some((t) => t.id === library.settings.lastTab)
                ? library.settings.lastTab
                : 'play';
            STATE.subTabs = { ...DEFAULT_SUB_TABS, ...(library.settings.lastSubTabs || {}) };

            const [msRow, hyRow, goRow] = await Promise.all([
                db.loadGame(_app, GAME_MINESWEEPER),
                db.loadGame(_app, GAME_HAVEYOU),
                db.loadGame(_app, GAME_GOMOKU),
            ]);
            // revive 返回 null = 存档结构对不上,当没有,而不是拿半个棋盘去渲染
            STATE.minesweeper = msRow?.state ? ms.reviveMatch(msRow.state) : null;
            STATE.haveyou = hyRow?.state ? hy.reviveMatch(hyRow.state) : null;
            STATE.gomoku = goRow?.state ? go.reviveMatch(goRow.state) : null;

            const [askbox, letterbox, bottle] = await Promise.all([
                db.loadAnon(_app, ANON_ASKBOX),
                db.loadAnon(_app, ANON_LETTERBOX),
                db.loadAnon(_app, ANON_BOTTLE),
            ]);
            STATE.askbox = { questions: askbox.questions || [] };
            STATE.letterbox = { letters: letterbox.letters || [] };
            STATE.bottle = { rounds: bottle.rounds || [] };

            STATE.scores = await db.listScores(_app, '', 30);
            syncStatsToMurmur();
            syncAnonToMurmur();
        } catch (err) {
            console.warn('[oddity/store] hydrate 失败', err);
        } finally {
            STATE.ready = true;
            _hydrating = null;
        }
    })();

    return _hydrating;
}

export function teardown() {
    // 只丢引用,不清状态 —— 用户切走再切回来还要看到原来那盘棋
    _hydrating = null;
}

// ============================================================
// 导航
// ============================================================

export function setTab(tabId) {
    if (!TABS.some((t) => t.id === tabId)) return;
    STATE.tab = tabId;
    STATE.panel = '';   // 面板属于「上一个小东西」,跟着一起收掉
    STATE.library.settings.lastTab = tabId;
    persistLibrary();
}

export function setSubTab(tabId, itemId) {
    const items = TAB_ITEMS[tabId] || [];
    if (!items.some((item) => item.id === itemId)) return;
    STATE.subTabs[tabId] = itemId;
    STATE.panel = '';
    STATE.library.settings.lastSubTabs = { ...STATE.subTabs };
    markUnlocked(itemId);
    persistLibrary();
}

export function currentItemId() {
    return STATE.subTabs[STATE.tab] || DEFAULT_SUB_TABS[STATE.tab] || '';
}

export function currentItemMeta() {
    const items = TAB_ITEMS[STATE.tab] || [];
    return items.find((item) => item.id === currentItemId()) || items[0] || null;
}

export function isUnlocked(itemId) {
    return STATE.library.unlocked[String(itemId)] === true;
}

export function markUnlocked(itemId) {
    const key = String(itemId || '');
    if (!key || STATE.library.unlocked[key]) return;
    STATE.library.unlocked[key] = true;
    persistLibrary();
}

// ============================================================
// 设置
// ============================================================

export function setTheme(themeId) {
    STATE.library.settings.theme = normalizeTheme(themeId);
    persistLibrary();
}

/**
 * 果冻心的台词池。
 *
 * 触摸反馈要**当场**出字,所以进页面时先跟真人设批量要一轮存着。
 * 存在 library 里而不是组件 data:切走再回来不该重新请求一次。
 */
export function setPersonaLines(aiId, { hurt = [], soothe = [] } = {}) {
    const key = String(aiId || '');
    if (!key) return;
    STATE.library.personaLines[key] = {
        hurt: asArray(hurt).map(String).filter(Boolean).slice(0, 40),
        soothe: asArray(soothe).map(String).filter(Boolean).slice(0, 40),
        at: Date.now(),
    };
    persistLibrary();
}

export function getPersonaLines(aiId) {
    return STATE.library.personaLines[String(aiId || '')] || null;
}

/** 通用设置补丁。只接受已知键 —— 免得组件手滑写进一堆脏字段 */
export function patchSettings(patch = {}) {
    const settings = STATE.library.settings;
    for (const [key, value] of Object.entries(patch)) {
        if (!(key in settings)) continue;
        settings[key] = value;
    }
    persistLibrary();
}

// ============================================================
// 扫雷
// ============================================================

export function newMinesweeper(opts = {}) {
    STATE.minesweeper = ms.createMatch(opts);
    persistMinesweeper();
    return STATE.minesweeper;
}

export function ensureMinesweeper() {
    if (!STATE.minesweeper) newMinesweeper();
    return STATE.minesweeper;
}

export function endMinesweeper() {
    STATE.minesweeper = null;
    void db.removeGame(_app, GAME_MINESWEEPER);
}

/**
 * `playerId` 扫 `index` 这一格。**唯一**的落子入口(点格子直接扫,真扫雷)。
 */
export function sweepMinesweeper(index, playerId) {
    const state = ensureMinesweeper();
    const result = ms.sweepAt(state, { index, playerId });
    if (!result.ok) return result;
    persistMinesweeper();
    if (state.finished) void recordMinesweeperScore(state);
    return result;
}

/** 长按插旗 / 拔旗。不消耗回合。 */
export function flagMinesweeper(index) {
    const state = STATE.minesweeper;
    if (!state) return { ok: false, reason: 'no-match', flagged: false };
    const result = ms.toggleFlag(state, index);
    if (result.ok) persistMinesweeper();
    return result;
}

/** AI 的台词落进日志 */
export function minesweeperFlavor(playerId, line) {
    const state = STATE.minesweeper;
    if (!state) return;
    ms.pushFlavor(state, playerId, line);
    persistMinesweeper();
}

async function recordMinesweeperScore(state) {
    const record = await db.addScore(_app, {
        gameKind: GAME_MINESWEEPER,
        label: '扫雷',
        entries: asArray(state.players).map((p) => ({
            seatId: p.id,
            name: p.name,
            score: state.scores[p.id] || 0,
        })),
        winner: state.winner,
        note: `${state.moveCount} 步 · 踩到 ${ms.hitMines(state)} 颗雷${asArray(state.players).some((p) => p.kind === 'ai') ? ' · 和 AI 打的' : ''}`,
        finishedAt: state.finishedAt || Date.now(),
    });
    if (record) STATE.scores = [record, ...STATE.scores].slice(0, 30);
    await db.archiveGame(_app, GAME_MINESWEEPER, state);
    syncStatsToMurmur();
}

// ============================================================
// 五子棋
// ============================================================

export function newGomoku(opts = {}) {
    STATE.gomoku = go.createMatch(opts);
    persistGomoku();
    return STATE.gomoku;
}

export function endGomoku() {
    STATE.gomoku = null;
    void db.removeGame(_app, GAME_GOMOKU);
}

/** 落一子。唯一入口。 */
export function placeGomoku(index, playerId) {
    const state = STATE.gomoku;
    if (!state) return { ok: false, reason: 'no-match', win: false };
    const result = go.place(state, { index, playerId });
    if (!result.ok) return result;
    persistGomoku();
    if (state.finished) void recordGomokuScore(state);
    return result;
}

export function gomokuFlavor(playerId, line) {
    const state = STATE.gomoku;
    if (!state) return;
    go.pushFlavor(state, playerId, line);
    persistGomoku();
}

async function recordGomokuScore(state) {
    const record = await db.addScore(_app, {
        gameKind: GAME_GOMOKU,
        label: '五子棋',
        entries: asArray(state.players).map((p) => ({
            seatId: p.id,
            name: p.name,
            score: state.winner === p.id ? 1 : 0,
        })),
        winner: state.winner,
        note: `${state.moveCount} 手${asArray(state.players).some((p) => p.kind === 'ai') ? ' · 和 AI 下的' : ''}`,
        finishedAt: state.finishedAt || Date.now(),
    });
    if (record) STATE.scores = [record, ...STATE.scores].slice(0, 30);
    await db.archiveGame(_app, GAME_GOMOKU, state);
    syncStatsToMurmur();
}

// ============================================================
// 你有我没有
// ============================================================

export function newHaveyou(opts = {}) {
    STATE.haveyou = hy.createMatch(opts);
    STATE.library.settings.haveyouSeatIds = asArray(opts.seats)
        .filter((seat) => seat?.kind === 'ai')
        .map((seat) => String(seat.aiId || ''))
        .filter(Boolean);
    persistLibrary();
    persistHaveyou();
    return STATE.haveyou;
}

export function endHaveyou() {
    STATE.haveyou = null;
    void db.removeGame(_app, GAME_HAVEYOU);
}

/**
 * 引擎操作的统一出口。
 *
 * 组件不直接 import 引擎去改 STATE.haveyou —— 都从这里过一道,
 * 「改完要落盘 / 结束要记战绩」就只需要写一次。
 */
export function runHaveyou(fn) {
    const state = STATE.haveyou;
    if (!state) return { ok: false, reason: 'no-match' };
    const wasFinished = state.finished;
    const result = fn(state) || { ok: true };
    persistHaveyou();
    if (!wasFinished && state.finished) void recordHaveyouScore(state);
    return result;
}

async function recordHaveyouScore(state) {
    const record = await db.addScore(_app, {
        gameKind: GAME_HAVEYOU,
        label: '你有我没有',
        entries: state.seats.map((seat) => ({ seatId: seat.id, name: seat.name, score: seat.lives })),
        winner: state.winnerId,
        note: `${state.roundNo - 1} 轮 · ${state.mode === 'local' ? '本地模式' : 'AI 模式'}`,
        finishedAt: state.finishedAt || Date.now(),
    });
    if (record) STATE.scores = [record, ...STATE.scores].slice(0, 30);
    await db.archiveGame(_app, GAME_HAVEYOU, state);
    syncStatsToMurmur();
}

// ============================================================
// 分享到 murmur / 游戏数据概要
// ============================================================

/** 三种游戏共用:把某局(默认当前局)的终局分享给某个联系人 */
export async function shareMatch(kind, contactId, note = '') {
    const state = kind === GAME_MINESWEEPER ? STATE.minesweeper
        : kind === GAME_GOMOKU ? STATE.gomoku
            : kind === GAME_HAVEYOU ? STATE.haveyou
                : null;
    if (!state || !state.finished) return { ok: false, error: '这局还没打完' };
    const record = bridge.buildRecord({ kind, state });
    if (!record) return { ok: false, error: '拼不出战绩卡' };
    return bridge.shareRecordTo({ contactId, record, note });
}

export function listShareTargets() {
    return bridge.listShareTargets();
}

/**
 * 把战绩概要同步成 murmur 的动态提示词卡。
 *
 * 数据源就是 STATE.scores(最近战绩)加三个「进行中」的棋局,
 * 每次战绩变化 / hydrate 后重放一遍 —— 注册表在内存里,刷新就没。
 */
export function syncStatsToMurmur() {
    const toolkit = _app?.toolkit;
    if (!toolkit) return;

    const lines = asArray(STATE.scores).slice(0, 8).map((row) => {
        const parts = asArray(row.entries).map((e) => `${e.name} ${e.score}`).join(' / ');
        const winner = row.winner && row.winner !== 'draw'
            ? asArray(row.entries).find((e) => e.seatId === row.winner)?.name || ''
            : '';
        return `${row.label}:${parts}${winner ? `,${winner}赢` : row.winner === 'draw' ? ',平' : ''}${row.note ? `(${row.note})` : ''}`;
    });

    const current = [];
    if (STATE.minesweeper && !STATE.minesweeper.finished && STATE.minesweeper.moveCount > 0) {
        const s = STATE.minesweeper;
        current.push(`扫雷打到第 ${s.moveCount} 步,比分 ${s.scores.p1} : ${s.scores.p2}`);
    }
    if (STATE.gomoku && !STATE.gomoku.finished && STATE.gomoku.moveCount > 0) {
        current.push(`五子棋下到第 ${STATE.gomoku.moveCount} 手`);
    }
    if (STATE.haveyou && !STATE.haveyou.finished) {
        current.push(`「你有我没有」进行到第 ${STATE.haveyou.roundNo} 轮`);
    }

    try {
        syncStatsPrompt(toolkit, { lines, current: current.join(';') });
    } catch (err) {
        console.warn('[oddity/store] 同步游戏数据概要失败', err);
    }
}

// ============================================================
// 提示词库(自定义提示词,注入所有 AI 对局)
// ============================================================

export function listCustomPrompts() {
    return STATE.library.customPrompts;
}

export function addCustomPrompt({ title = '', content = '' } = {}) {
    const body = String(content || '').trim();
    if (!body) return null;
    const row = {
        id: makeId('cp'),
        title: truncate(String(title || ''), 24),
        content: body,
        enabled: true,
    };
    STATE.library.customPrompts.push(row);
    persistLibrary();
    return row;
}

export function updateCustomPrompt(id, patch = {}) {
    const row = STATE.library.customPrompts.find((p) => p.id === id);
    if (!row) return false;
    if ('title' in patch) row.title = truncate(String(patch.title || ''), 24);
    if ('content' in patch) row.content = String(patch.content || '');
    if ('enabled' in patch) row.enabled = patch.enabled !== false;
    persistLibrary();
    return true;
}

export function removeCustomPrompt(id) {
    const index = STATE.library.customPrompts.findIndex((p) => p.id === id);
    if (index < 0) return false;
    STATE.library.customPrompts.splice(index, 1);
    persistLibrary();
    return true;
}

// ============================================================
// 收藏夹系统（前三个标签页的统一收藏 + 旧字幕兼容）
// ============================================================

export function listFavorites(kind = '') {
    const list = STATE.library.favorites || [];
    if (!kind || kind === 'all') return list;
    return list.filter((item) => item.kind === kind || (kind === 'heart' && !item.kind));
}

/**
 * 添加一条收藏（支持心跳心语、沙漏表里、打字机踌躇或字幕快照）
 */
export function addFavorite(opts = {}) {
    const kind = String(opts.kind || opts.type || (opts.surround ? 'subtitle' : 'heart'));
    const title = String(opts.title || opts.surround || '心事记录');
    const content = String(opts.content || opts.text || '');

    const record = {
        id: makeId('fav'),
        kind,
        title,
        content,
        meta: opts.meta ? { ...opts.meta } : {
            surround: String(opts.surround || ''),
            center: String(opts.center || ''),
            variant: String(opts.variant || ''),
            upperCenter: opts.upperCenter !== false,
            surface: String(opts.surface || ''),
            deep: String(opts.deep || ''),
            personaName: String(opts.personaName || ''),
            steps: Array.isArray(opts.steps) ? opts.steps : null,
        },
        text: content,
        createdAt: Date.now(),
    };

    // 去重: 如果完全相同的正文和分类，则顶掉旧的
    const dupIndex = STATE.library.favorites.findIndex(
        (item) => item.kind === record.kind && (item.content === record.content || item.text === record.text),
    );
    if (dupIndex >= 0) STATE.library.favorites.splice(dupIndex, 1);

    STATE.library.favorites.unshift(record);
    if (STATE.library.favorites.length > FAVORITE_LIMIT) {
        STATE.library.favorites.length = FAVORITE_LIMIT;
    }
    persistLibrary();
    return record;
}

export function removeFavorite(id) {
    const index = STATE.library.favorites.findIndex((item) => item.id === id);
    if (index < 0) return false;
    STATE.library.favorites.splice(index, 1);
    persistLibrary();
    return true;
}

// ============================================================
// 打字机踌躇草稿箱
// ============================================================

export function listHesitations() {
    return STATE.library.hesitations || [];
}

export function addHesitation({ title = '', author = 'AI', steps = [], finalPreview = '' } = {}) {
    const item = {
        id: makeId('hes'),
        title: truncate(String(title || '欲言又止'), 30),
        author: String(author || 'AI'),
        steps: Array.isArray(steps) ? steps : [],
        finalPreview: String(finalPreview || ''),
        createdAt: Date.now(),
    };
    STATE.library.hesitations.unshift(item);
    if (STATE.library.hesitations.length > 50) {
        STATE.library.hesitations.length = 50;
    }
    persistLibrary();
    return item;
}

export function removeHesitation(id) {
    const index = STATE.library.hesitations.findIndex((item) => item.id === id);
    if (index < 0) return false;
    STATE.library.hesitations.splice(index, 1);
    persistLibrary();
    return true;
}

/**
 * 给 murmur 的 `[做个字幕:环绕词/中心词]` 用。
 *
 * ★ 走 `appConfig.services`,所以可能在**用户从没打开过本 App** 的情况下被调 ——
 *   内部先 hydrate 再写,不能假设 STATE 已经是好的。
 */
export async function captureSubtitle(surround, center) {
    await hydrate(_app);
    const small = String(surround || '').trim();
    const big = String(center || '').trim();
    if (!small || !big) return { ok: false, error: '环绕词和中心词都要有' };
    const block = buildBlock({
        surround: small,
        center: big,
        variant: STATE.library.settings.subtitleVariant,
        upperCenter: STATE.library.settings.upperCenter,
    });
    const record = addFavorite({
        surround: small,
        center: big,
        variant: STATE.library.settings.subtitleVariant,
        upperCenter: STATE.library.settings.upperCenter,
        text: block.text,
    });
    await flushPersist();
    return { ok: true, id: record.id, text: block.text, note: block.note };
}

/** 给别的 App 读:这个人在小奇怪里玩到哪了(只读摘要,不含正文) */
export async function readProgressBrief() {
    await hydrate(_app);
    const sweep = STATE.minesweeper;
    const party = STATE.haveyou;
    return {
        favorites: STATE.library.favorites.length,
        lastFavorite: STATE.library.favorites[0]
            ? truncate(`${STATE.library.favorites[0].surround} · ${STATE.library.favorites[0].center}`, 24)
            : '',
        minesweeper: sweep
            ? { started: true, finished: sweep.finished, p1: sweep.scores.p1, p2: sweep.scores.p2 }
            : { started: false },
        haveyou: party
            ? { started: true, finished: party.finished, seats: party.seats.length, round: party.roundNo }
            : { started: false },
        gomoku: STATE.gomoku
            ? { started: true, finished: STATE.gomoku.finished, moves: STATE.gomoku.moveCount }
            : { started: false },
    };
}

// ============================================================
// 匿名三件套
// ============================================================
//
// 三个页面的写操作都很碎(加一条、改一句、删一条、往对话里追一轮),
// 所以这里给的是**通用的四件套**而不是每个页面各一套 CRUD:
//
//   anonAdd / anonPatch / anonRemove / anonAppendTurn
//
// 组件只需要说清「哪个箱子、哪一条」,不需要知道该 debounce 哪个 persist。

const ANON_TABLES = {
    askbox: { list: () => STATE.askbox.questions, persist: () => persistAskbox() },
    letterbox: { list: () => STATE.letterbox.letters, persist: () => persistLetterbox() },
    bottle: { list: () => STATE.bottle.rounds, persist: () => persistBottle() },
};

function tableOf(box) {
    return ANON_TABLES[String(box)] || null;
}

export function anonList(box) {
    return tableOf(box)?.list() || [];
}

export function anonFind(box, id) {
    return anonList(box).find((row) => row.id === String(id)) || null;
}

/** 新的排在最前。超出上限从尾部砍 —— 砍的是最旧的,不是最新的 */
export function anonAdd(box, record) {
    const table = tableOf(box);
    if (!table || !record) return null;
    const list = table.list();
    list.unshift(record);
    const limit = box === 'bottle' ? ANON.roundLimit : ANON.listLimit;
    if (list.length > limit) list.length = limit;
    table.persist();
    return record;
}

export function anonPatch(box, id, patch = {}) {
    const row = anonFind(box, id);
    if (!row) return false;
    Object.assign(row, patch);
    tableOf(box).persist();
    return true;
}

/**
 * 结构内部被就地改过了(比如漂流瓶里某个成员的正文),只要落一次盘。
 *
 * 有这个口子是因为 `anonPatch(box, id, {})` 能达到同样效果,但读代码的人
 * 会以为那行是写漏了参数。
 */
export function anonTouch(box, id) {
    if (!anonFind(box, id)) return false;
    tableOf(box).persist();
    return true;
}

export function anonRemove(box, id) {
    const table = tableOf(box);
    if (!table) return false;
    const list = table.list();
    const index = list.findIndex((row) => row.id === String(id));
    if (index < 0) return false;
    list.splice(index, 1);
    table.persist();
    return true;
}

/**
 * 往某条记录的对话里追一轮。
 *
 * `path` 用于漂流瓶那种「一条记录里有好几条对话」的结构:
 * 传 `'threads.me>ai-3'` 就是往那一对的对话里追。不传就是记录自己的 `thread`。
 */
export function anonAppendTurn(box, id, turn, path = '') {
    const row = anonFind(box, id);
    if (!row || !turn) return false;
    let list;
    if (path) {
        const [bucket, key] = String(path).split('.');
        if (!row[bucket] || typeof row[bucket] !== 'object') row[bucket] = {};
        if (!Array.isArray(row[bucket][key])) row[bucket][key] = [];
        list = row[bucket][key];
    } else {
        if (!Array.isArray(row.thread)) row.thread = [];
        list = row.thread;
    }
    list.push(turn);
    if (list.length > ANON.threadLimit) list.splice(0, list.length - ANON.threadLimit);
    tableOf(box).persist();
    return true;
}

export function anonClear(box) {
    const table = tableOf(box);
    if (!table) return false;
    table.list().length = 0;
    table.persist();
    return true;
}

/**
 * 把匿名往来同步成 murmur 的动态提示词卡。
 *
 * ★ 这张卡里**带 AI 的真名**,而 UI 里一个真名都不出现 —— 这不矛盾:
 *   玩法要求的是「用户不知道是谁问的」,不是「AI 不知道自己问过什么」。
 *   用户在 murmur 里打开这张卡,那位 AI 才认得出自己那条。
 *   卡里写死了「只认领属于你自己的,别提别人的」。
 */
export function syncAnonToMurmur() {
    const toolkit = _app?.toolkit;
    if (!toolkit) return;
    if (STATE.library.settings.anonShareToMurmur === false) {
        try { toolkit.prompts.unregister?.('oddity-anon'); } catch (_) { /* 没注册过 */ }
        return;
    }

    const asked = asArray(STATE.askbox.questions)
        .slice(0, ANON.briefLimit)
        .filter((row) => row.aiName && row.text)
        .map((row) => {
            const replied = asArray(row.thread).filter((t) => t.role === 'me');
            return `${row.aiName} 投过:「${truncate(row.text, 48)}」`
                + (replied.length ? `,对方答:「${truncate(replied[replied.length - 1].text, 48)}」` : ',还没有回答');
        });

    const received = asArray(STATE.letterbox.letters)
        .slice(0, ANON.briefLimit)
        .filter((row) => row.aiName && row.text)
        .map((row) => `${row.aiName} 收到过一封匿名来信:「${truncate(row.text, 48)}」`);

    try {
        syncAnonPrompt(toolkit, { asked, received });
    } catch (err) {
        console.warn('[oddity/store] 同步匿名概要失败', err);
    }
}

// ============================================================
// UI
// ============================================================

export function openPanel(id) {
    STATE.panel = String(id || '');
}

export function closePanel() {
    STATE.panel = '';
}

export function togglePanel(id) {
    const next = String(id || '');
    STATE.panel = STATE.panel === next ? '' : next;
}

export function openModal(type, payload = {}) {
    STATE.modal = { type: String(type), payload };
}

export function closeModal() {
    STATE.modal = null;
}

export function notify(message) {
    STATE.toast = String(message || '');
}

export function clearToast() {
    STATE.toast = '';
}

export async function refreshScores(gameKind = '') {
    STATE.scores = await db.listScores(_app, gameKind, 30);
    return STATE.scores;
}
