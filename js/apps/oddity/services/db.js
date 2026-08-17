/**
 * 小奇怪 · 持久化
 *
 * 三张表,分工按「写入频率」切,不按「业务模块」切:
 *
 *   | 表 | keyPath | 装什么 | 写入频率 |
 *   |---|---|---|---|
 *   | `oqLibrary` | id | 设置 / 主题 / 字幕收藏 / 解锁位(**单例,id='root'**) | 低 |
 *   | `oqGames`   | id | 当前这局的完整棋局 + 归档的旧局                    | 高 |
 *   | `oqScores`  | id | 每局打完的一条战绩                                 | 低 |
 *
 * ★ 为什么棋局要单独一张表而不是塞进 library:
 *   扫雷每落一子就要落盘一次(切走再回来棋不能没),而 library 里躺着
 *   几十条字幕收藏。合在一张记录里的话,每落一子都要把收藏整个重新序列化一遍。
 *
 * ★ 所有 put 之前一律 `toPlain()`。state 是 `Vue.reactive` 出来的 Proxy,
 *   结构化克隆拒绝 Proxy,直接写会抛 `DataCloneError` —— 纯运行时错误,
 *   build / lint 都发现不了,表现是「保存成功但刷新就没了」(AGENTS.md §2.3)。
 */

import {
    STORE_LIBRARY, STORE_GAMES, STORE_SCORES, STORE_ANON, LIBRARY_KEY,
    ARCHIVE_PREFIX, DEFAULT_SUB_TABS, SUBTITLE_DEFAULTS,
    FAVORITE_LIMIT, ANON, createDefaultContextConfig,
} from '../constants.js';
import { normalizeTheme } from '../theme.js';
import { makeId, toPlain, asArray, clampInt, truncate } from '../utils.js';

function dbOf(app) {
    return app?.toolkit?.db || null;
}

// ============================================================
// 归一化 —— 读出来的东西一律先过一遍
// ============================================================

export function createDefaultSettings() {
    return {
        theme: 'morandi',
        /** 上次停在哪个 tab / 哪个小东西,下次进来接着 */
        lastTab: 'play',
        lastSubTabs: { ...DEFAULT_SUB_TABS },

        // 果冻心设置
        jellyAiId: '',
        jellyCustomPrompt: '',
        jellyDisableEmoji: true,
        jellyTouches: 0,

        // 沙漏设置
        // ★ 表 / 里两句话默认是**空**的。之前这里塞了两句写死的情话,
        //   于是从没调过 AI 的用户看到的也是「像是 AI 说的」内容 ——
        //   用户要求「去掉所有预设,真实 AI 拉取」,空串会让页面显示召唤入口。
        hourglassGravity: false,
        hourglassAiId: '',
        hourglassCustomPrompt: '',
        hourglassDisableEmoji: true,
        hourglassSurfaceText: '',
        hourglassDeepText: '',

        // 打字机设置
        typewriterAiId: '',
        typewriterCustomPrompt: '',
        typewriterDisableEmoji: true,

        // 匿名三件套共用设置
        anonCustomPrompt: '',
        anonDisableEmoji: true,
        /** 是否把匿名对话概要喂给 murmur 的动态提示词卡 */
        anonShareToMurmur: true,

        // 你有我没有:上次选了哪几个 AI 座位
        haveyouSeatIds: [],
    };
}

export function normalizeLibrary(raw = {}) {
    const defaults = createDefaultSettings();
    const settings = { ...defaults, ...(raw.settings || {}) };
    settings.theme = normalizeTheme(settings.theme);
    settings.lastSubTabs = { ...DEFAULT_SUB_TABS, ...(raw.settings?.lastSubTabs || {}) };
    settings.haveyouSeatIds = asArray(settings.haveyouSeatIds).map(String).slice(0, 3);

    return {
        id: LIBRARY_KEY,
        settings,
        favorites: asArray(raw.favorites).map(normalizeFavorite).slice(0, FAVORITE_LIMIT),
        hesitations: asArray(raw.hesitations).map(normalizeHesitation),
        /**
         * 果冻心的台词池:`{ [aiId]: { hurt: [], soothe: [], at } }`。
         *
         * ★ 触摸反馈必须**当场**出字,等不了一次网络往返。所以改成
         *   「进页面时先跟真人设批量要一轮台词存着,摸的时候从池子里取」——
         *   既满足「真实 AI 拉取」,又没有 800ms 的空白。
         */
        personaLines: normalizePersonaLines(raw.personaLines),
        customPrompts: asArray(raw.customPrompts).map(normalizeCustomPrompt),
        contextConfig: { ...createDefaultContextConfig(), ...(raw.contextConfig || {}) },
        contextOrder: asArray(raw.contextOrder).map(String),
        /**
         * 解锁位:玩过一次的小东西在导航上不再挂「新」。
         * 存 boolean 而不是时间戳 —— 这里只需要「见过没有」。
         */
        unlocked: normalizeUnlocked(raw.unlocked),
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

function normalizePersonaLines(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [aiId, pool] of Object.entries(raw)) {
        if (!aiId || !pool || typeof pool !== 'object') continue;
        const hurt = asArray(pool.hurt).map((s) => String(s || '').trim()).filter(Boolean).slice(0, 40);
        const soothe = asArray(pool.soothe).map((s) => String(s || '').trim()).filter(Boolean).slice(0, 40);
        if (!hurt.length && !soothe.length) continue;
        out[String(aiId)] = { hurt, soothe, at: Number(pool.at) || 0 };
    }
    return out;
}

function normalizeUnlocked(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [key, value] of Object.entries(raw)) {
        if (!key) continue;
        out[String(key)] = value === true;
    }
    return out;
}

export function normalizeFavorite(raw = {}) {
    const kind = String(raw.kind || raw.type || (raw.surround ? 'subtitle' : 'heart'));
    return {
        id: String(raw.id || makeId('fav')),
        kind,
        title: String(raw.title || raw.surround || '心事记录'),
        content: String(raw.content || raw.text || ''),
        meta: raw.meta && typeof raw.meta === 'object' ? { ...raw.meta } : {
            surround: String(raw.surround || ''),
            center: String(raw.center || ''),
            variant: String(raw.variant || SUBTITLE_DEFAULTS.variant),
            upperCenter: raw.upperCenter !== false,
            surface: String(raw.surface || ''),
            deep: String(raw.deep || ''),
            personaName: String(raw.personaName || ''),
            steps: Array.isArray(raw.steps) ? raw.steps : null,
        },
        /** 正文快照 (兼容旧字幕) */
        text: String(raw.text || raw.content || ''),
        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

export function normalizeHesitation(raw = {}) {
    return {
        id: String(raw.id || makeId('hes')),
        title: String(raw.title || '欲言又止'),
        author: String(raw.author || 'AI'),
        /**
         * 动效步骤列表:
         * [{ action: 'type', text: '想你' }, { action: 'pause', ms: 1000 }, { action: 'delete', count: 2 }, ...]
         *
         * ★ 步骤缺失时给**空数组**,不给示例步骤。以前这里兜底了一段写死的
         *   「其实我一直在想你…」,任何一条脏数据都会被补成那句话,
         *   看上去像是 AI 生成的,其实是常量。
         */
        steps: Array.isArray(raw.steps) ? raw.steps : [],
        finalPreview: String(raw.finalPreview || ''),
        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

function normalizeCustomPrompt(raw = {}) {
    return {
        id: String(raw.id || makeId('cp')),
        title: String(raw.title || ''),
        content: String(raw.content || ''),
        enabled: raw.enabled !== false,
    };
}

export function normalizeGameRecord(raw = {}) {
    return {
        id: String(raw.id || makeId('game')),
        kind: String(raw.kind || ''),
        /** 引擎自己的 state,原样存。反序列化由各引擎的 reviveMatch 负责 */
        state: raw.state && typeof raw.state === 'object' ? raw.state : null,
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

export function normalizeScore(raw = {}) {
    return {
        id: String(raw.id || makeId('score')),
        gameKind: String(raw.gameKind || ''),
        label: String(raw.label || ''),
        entries: asArray(raw.entries).map((entry) => ({
            seatId: String(entry?.seatId || ''),
            name: String(entry?.name || ''),
            score: Number(entry?.score) || 0,
        })),
        winner: String(raw.winner || ''),
        note: truncate(raw.note || '', 60),
        finishedAt: Number(raw.finishedAt) || Date.now(),
    };
}

// ============================================================
// library
// ============================================================

export async function loadLibrary(app) {
    const db = dbOf(app);
    if (!db) return normalizeLibrary({});
    try {
        const raw = await db.get(STORE_LIBRARY, LIBRARY_KEY);
        return normalizeLibrary(raw || {});
    } catch (err) {
        console.warn('[oddity/db] 读取设置失败,用默认值', err);
        return normalizeLibrary({});
    }
}

export async function saveLibrary(app, library) {
    const db = dbOf(app);
    if (!db) return false;
    const plain = toPlain({ ...library, id: LIBRARY_KEY, updatedAt: Date.now() });
    if (!plain) return false;
    try {
        await db.put(STORE_LIBRARY, plain);
        return true;
    } catch (err) {
        console.warn('[oddity/db] 保存设置失败', err);
        return false;
    }
}

// ============================================================
// games
// ============================================================

/** 读某个玩法「当前这一局」。id 就是玩法名(见 constants.js 的注释) */
export async function loadGame(app, gameId) {
    const db = dbOf(app);
    if (!db || !gameId) return null;
    try {
        const raw = await db.get(STORE_GAMES, String(gameId));
        return raw ? normalizeGameRecord(raw) : null;
    } catch (err) {
        console.warn('[oddity/db] 读取棋局失败', err);
        return null;
    }
}

export async function saveGame(app, gameId, kind, state) {
    const db = dbOf(app);
    if (!db || !gameId) return false;
    const plain = toPlain({ id: String(gameId), kind: String(kind || ''), state, updatedAt: Date.now() });
    if (!plain) return false;
    try {
        await db.put(STORE_GAMES, plain);
        return true;
    } catch (err) {
        console.warn('[oddity/db] 保存棋局失败', err);
        return false;
    }
}

export async function removeGame(app, gameId) {
    const db = dbOf(app);
    if (!db || !gameId) return false;
    try {
        await db.remove(STORE_GAMES, String(gameId));
        return true;
    } catch (err) {
        console.warn('[oddity/db] 删除棋局失败', err);
        return false;
    }
}

/**
 * 打完了归档一份。
 *
 * 归档记录的 id 带前缀和时间戳,和「当前局」那条固定 id 分得开;
 * 列历史时按前缀过滤,不需要额外索引。
 */
export async function archiveGame(app, kind, state) {
    const db = dbOf(app);
    if (!db) return false;
    const plain = toPlain({
        id: `${ARCHIVE_PREFIX}-${kind}-${Date.now().toString(36)}`,
        kind: String(kind || ''),
        state,
        updatedAt: Date.now(),
    });
    if (!plain) return false;
    try {
        await db.put(STORE_GAMES, plain);
        return true;
    } catch (err) {
        console.warn('[oddity/db] 归档失败', err);
        return false;
    }
}

/** 列某个玩法的历史(最近的在前) */
export async function listArchives(app, kind, limit = 20) {
    const db = dbOf(app);
    if (!db) return [];
    try {
        const rows = await db.getAllRecords(STORE_GAMES);
        return asArray(rows)
            .filter((row) => String(row?.id || '').startsWith(`${ARCHIVE_PREFIX}-`))
            .filter((row) => !kind || row.kind === kind)
            .map(normalizeGameRecord)
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .slice(0, clampInt(limit, 1, 200, 20));
    } catch (err) {
        console.warn('[oddity/db] 读取历史失败', err);
        return [];
    }
}

// ============================================================
// anon —— 匿名三件套
// ============================================================

/**
 * 一条匿名对话。
 *
 * `role` 只有 `'them'` / `'me'` 两种,**不存 AI 的名字**在这一层 ——
 * 名字只挂在外层记录的 `aiId` 上,渲染层拿不到(见各 view 的 computed)。
 */
function normalizeTurn(raw = {}) {
    return {
        id: String(raw.id || makeId('t')),
        role: raw.role === 'me' ? 'me' : 'them',
        text: String(raw.text || '').slice(0, ANON.textMax),
        at: Number(raw.at) || Date.now(),
    };
}

export function normalizeQuestion(raw = {}) {
    return {
        id: String(raw.id || makeId('q')),
        /** 真身。只用于发请求和拼 murmur 卡,**永远不渲染** */
        aiId: String(raw.aiId || ''),
        aiName: String(raw.aiName || ''),
        /** 落盘时定死的代号,渲染层只认它 */
        alias: String(raw.alias || '?'),
        text: String(raw.text || '').slice(0, ANON.textMax),
        thread: asArray(raw.thread).map(normalizeTurn).slice(-ANON.threadLimit),
        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

export function normalizeLetter(raw = {}) {
    return {
        id: String(raw.id || makeId('l')),
        /** 收信人是用户自己挑的,所以这一侧的名字**可以**给用户看 */
        aiId: String(raw.aiId || ''),
        aiName: String(raw.aiName || ''),
        text: String(raw.text || '').slice(0, ANON.textMax),
        thread: asArray(raw.thread).map(normalizeTurn).slice(-ANON.threadLimit),
        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

function normalizeBottleMember(raw = {}) {
    return {
        key: String(raw.key || ''),
        alias: String(raw.alias || '?'),
        aiId: String(raw.aiId || ''),
        name: String(raw.name || ''),
        isMe: raw.isMe === true,
        text: String(raw.text || '').slice(0, ANON.textMax),
    };
}

export function normalizeRound(raw = {}) {
    return {
        id: String(raw.id || makeId('r')),
        createdAt: Number(raw.createdAt) || Date.now(),
        members: asArray(raw.members).map(normalizeBottleMember).filter((m) => m.key),
        /** [{ from, to }] —— JS 一次性算好的错位配对,不是渲染时随机 */
        pairs: asArray(raw.pairs)
            .map((p) => ({ from: String(p?.from || ''), to: String(p?.to || '') }))
            .filter((p) => p.from && p.to),
        /** `${from}>${to}` → 这一对捡到瓶子之后的往来,点开才生成 */
        threads: normalizeThreadMap(raw.threads),
    };
}

function normalizeThreadMap(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [key, turns] of Object.entries(raw)) {
        if (!key) continue;
        const list = asArray(turns).map(normalizeTurn).slice(-ANON.threadLimit);
        if (list.length) out[String(key)] = list;
    }
    return out;
}

const ANON_SHAPES = {
    askbox: (raw) => ({ questions: asArray(raw?.questions).map(normalizeQuestion).slice(0, ANON.listLimit) }),
    letterbox: (raw) => ({ letters: asArray(raw?.letters).map(normalizeLetter).slice(0, ANON.listLimit) }),
    bottle: (raw) => ({ rounds: asArray(raw?.rounds).map(normalizeRound).slice(0, ANON.roundLimit) }),
};

export function normalizeAnon(id, raw = {}) {
    const shape = ANON_SHAPES[String(id)];
    if (!shape) return { id: String(id) };
    return { id: String(id), ...shape(raw), updatedAt: Number(raw?.updatedAt) || Date.now() };
}

export async function loadAnon(app, id) {
    const db = dbOf(app);
    if (!db || !id) return normalizeAnon(id, {});
    try {
        const raw = await db.get(STORE_ANON, String(id));
        return normalizeAnon(id, raw || {});
    } catch (err) {
        console.warn('[oddity/db] 读取匿名数据失败', err);
        return normalizeAnon(id, {});
    }
}

export async function saveAnon(app, id, data) {
    const db = dbOf(app);
    if (!db || !id) return false;
    const plain = toPlain({ ...data, id: String(id), updatedAt: Date.now() });
    if (!plain) return false;
    try {
        await db.put(STORE_ANON, plain);
        return true;
    } catch (err) {
        console.warn('[oddity/db] 保存匿名数据失败', err);
        return false;
    }
}

// ============================================================
// scores
// ============================================================

export async function addScore(app, record) {
    const db = dbOf(app);
    if (!db) return null;
    const normalized = normalizeScore({ ...record, id: record?.id || makeId('score') });
    const plain = toPlain(normalized);
    if (!plain) return null;
    try {
        await db.put(STORE_SCORES, plain);
        return normalized;
    } catch (err) {
        console.warn('[oddity/db] 写战绩失败', err);
        return null;
    }
}

export async function listScores(app, gameKind = '', limit = 30) {
    const db = dbOf(app);
    if (!db) return [];
    try {
        const rows = await db.getAllRecords(STORE_SCORES);
        return asArray(rows)
            .map(normalizeScore)
            .filter((row) => !gameKind || row.gameKind === gameKind)
            .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0))
            .slice(0, clampInt(limit, 1, 200, 30));
    } catch (err) {
        console.warn('[oddity/db] 读取战绩失败', err);
        return [];
    }
}

export async function clearScores(app, gameKind = '') {
    const db = dbOf(app);
    if (!db) return false;
    try {
        const rows = await db.getAllRecords(STORE_SCORES);
        const targets = asArray(rows).filter((row) => !gameKind || row?.gameKind === gameKind);
        await Promise.all(targets.map((row) => db.remove(STORE_SCORES, String(row.id)).catch(() => {})));
        return true;
    } catch (err) {
        console.warn('[oddity/db] 清空战绩失败', err);
        return false;
    }
}
