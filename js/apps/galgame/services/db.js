/**
 * 湛蓝回忆 · 持久化
 *
 * ── 为什么不照抄原型的存储 ────────────────────────────────────────
 *
 * 原型同时用了**两套**存储,而且分工毫无道理:
 *
 *   - Dexie(`GalgameDB`)声明了 `apiConfig / gameData / memoryModules / saveSlots`
 *     四张表,实际**只写了 apiConfig 一张**,另外三张从头到尾没人碰
 *   - 真正的游戏数据(CG / 记忆 / 存档 / 好感度 / 世界观)全在 localStorage,
 *     每个是一个整块 JSON:`galgame_cgHistory` / `galgame_memoryModules` /
 *     `galgame_saveSlots` / `galgame_affectionSystem` / `galgame_worldview`
 *
 * localStorage 装存档是不行的:一份存档要塞下整个 `gameHistory`(几十轮对话原文),
 * 三个档就能顶到 5MB 配额;而超配额时 `setItem` 抛的是同步异常,原型没有 try/catch,
 * 表现是「点保存,页面卡一下,什么都没发生」。
 *
 * 现在拆成三张 IndexedDB 表:
 *
 *   | 表 | keyPath | 装什么 | 写入频率 |
 *   |---|---|---|---|
 *   | `ggGames`   | id | 一局游戏的元数据 / 好感度 / 任务(**不含剧情**) | 中 |
 *   | `ggNodes`   | id | 单个剧情节点:对白 + 选项 + K 窗口状态        | 高(只写新增那一个) |
 *   | `ggLibrary` | id | 设置 / 立绘 / 场景 / CG / 存档(单例)         | 低 |
 *
 * 剧情是一棵**节点树**,一次生成只新增一个节点 —— 所以写盘量恒定,
 * 不会像原型那样「玩到第 50 轮,每存一次都要重新序列化前 49 轮」。
 */

import {
    STORE_GAMES, STORE_NODES, STORE_LIBRARY, LIBRARY_KEY,
    createDefaultSettings, createDefaultContextConfig, createDefaultQuest,
    KCHAIN_DEFAULTS, MOOD_IDS,
} from '../constants.js';
import { makeId, toPlain, isSameId, asArray, safeImageUrl, clamp } from '../utils.js';

function dbOf(app) {
    return app?.toolkit?.db || null;
}

// ============================================================
// 归一化 —— 读出来的东西一律先过一遍
// ============================================================

export function normalizeGame(raw = {}) {
    const id = String(raw.id || makeId('game'));
    return {
        id,
        title: String(raw.title || '新的故事'),

        // 绑定的 nook 实体。空 = 跟随当前激活项(每次读都现算,不缓存)
        worldId: raw.worldId ? String(raw.worldId) : '',
        userPersonaId: raw.userPersonaId ? String(raw.userPersonaId) : '',
        castIds: asArray(raw.castIds).map(String),

        genre: String(raw.genre || ''),
        worldTimeText: String(raw.worldTimeText || ''),
        openingHint: String(raw.openingHint || ''),

        rootNodeId: raw.rootNodeId ? String(raw.rootNodeId) : '',
        currentNodeId: raw.currentNodeId ? String(raw.currentNodeId) : '',

        /**
         * 只读剧本模式(预设模式)。
         *
         * ★ 默认 **false** —— 老记录里没有这个字段,`=== true` 保证它们一律按
         *   普通 AI 局处理,不会因为多了个字段就突然不肯生成剧情了。
         *   开着的时候整局**一次 AI 都不调**:选项没写下文就直说「剧本到这儿为止」,
         *   而不是偷偷去请求一个用户根本没配的 API。
         */
        presetMode: raw.presetMode === true,
        /** 这一局是从哪份剧本导进来的(只作展示,没有它也能玩) */
        scriptTitle: String(raw.scriptTitle || ''),

        quest: { ...createDefaultQuest(), ...(raw.quest || {}) },
        affection: normalizeAffection(raw.affection),

        notes: asArray(raw.notes).map(normalizeNote),
        customPrompts: asArray(raw.customPrompts).map(normalizeCustomPrompt),

        contextConfig: { ...createDefaultContextConfig(), ...(raw.contextConfig || {}) },
        contextOrder: asArray(raw.contextOrder).map(String),

        /** 已经压出过几个 K —— 用来给新 K 命名(K0 / K1 / …) */
        kCounter: Number(raw.kCounter) || 0,

        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

function normalizeAffection(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [key, value] of Object.entries(raw)) {
        if (!key) continue;
        out[String(key)] = {
            value: clamp(value?.value ?? 50, 0, 100),
            thoughts: String(value?.thoughts || ''),
            updatedAt: Number(value?.updatedAt) || 0,
        };
    }
    return out;
}

function normalizeNote(raw = {}) {
    return {
        id: String(raw.id || makeId('note')),
        title: String(raw.title || '未命名'),
        content: String(raw.content || ''),
        active: raw.active !== false,
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

/**
 * 归一化一个剧情节点。
 *
 * `kState` 是这个节点**之后**的 K 窗口状态 —— 因为它只依赖「根到本节点」这条路径,
 * 存在节点上就等于给每条分支各自记了一份窗口,回到旧节点开新分支时天然拿到当时的状态。
 */
export function normalizeNode(raw = {}, gameId = '') {
    return {
        id: String(raw.id || makeId('node')),
        gameId: String(raw.gameId || gameId),
        parentId: raw.parentId ? String(raw.parentId) : '',
        depth: Number(raw.depth) || 0,

        choice: {
            kind: ['start', 'option', 'custom'].includes(raw.choice?.kind) ? raw.choice.kind : 'start',
            text: String(raw.choice?.text || ''),
        },

        segments: asArray(raw.segments).map(normalizeSegment).filter((s) => s.text),
        options: asArray(raw.options).map((o) => String(o || '')).filter(Boolean),
        sceneKey: String(raw.sceneKey || ''),

        childIds: asArray(raw.childIds).map(String),

        kState: normalizeKState(raw.kState),

        /** 结局标记:AI 判定主线完成时打上,树上会显示旗子 */
        ending: raw.ending ? { title: String(raw.ending.title || ''), kind: String(raw.ending.kind || 'main') } : null,

        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

function normalizeSegment(raw = {}) {
    const mood = String(raw.mood || 'default');
    return {
        speaker: String(raw.speaker || ''),
        text: String(raw.text || '').trim(),
        mood: MOOD_IDS.includes(mood) ? mood : 'default',
    };
}

/**
 * K 窗口状态。
 *
 * `units` 里两种形态:
 *   `{ type:'r', nodeId }`                       一条真实回合
 *   `{ type:'k', id, index, content, coversNodeIds }`  一次压缩产物
 */
export function normalizeKState(raw = {}) {
    const units = asArray(raw?.units)
        .map((u) => {
            if (u?.type === 'k') {
                return {
                    type: 'k',
                    id: String(u.id || makeId('k')),
                    index: Number(u.index) || 0,
                    content: String(u.content || ''),
                    coversNodeIds: asArray(u.coversNodeIds).map(String),
                    createdAt: Number(u.createdAt) || Date.now(),
                };
            }
            if (!u?.nodeId) return null;
            return { type: 'r', nodeId: String(u.nodeId) };
        })
        .filter(Boolean);
    return {
        units,
        /** 这条线路上已经压过几次 —— 决定下一个 K 叫 K几 */
        kCount: Number(raw?.kCount) || units.filter((u) => u.type === 'k').length,
        /** 正在压缩中(压缩是异步的,失败要能重来) */
        pending: raw?.pending === true,
    };
}

export function normalizeLibrary(raw = {}) {
    return {
        id: LIBRARY_KEY,
        settings: {
            ...createDefaultSettings(),
            ...(raw.settings || {}),
            kChain: { ...KCHAIN_DEFAULTS, ...(raw.settings?.kChain || {}) },
        },
        /** 立绘 / 出场配置,key = nook 的 aiPersonId(nook 里没有立绘,只能在本机配) */
        cast: normalizeCast(raw.cast),
        scenes: asArray(raw.scenes).map(normalizeScene),
        cgs: asArray(raw.cgs).map(normalizeCg),
        saves: asArray(raw.saves).map(normalizeSave),
        activeGameId: raw.activeGameId ? String(raw.activeGameId) : '',
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

function normalizeCast(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [key, value] of Object.entries(raw)) {
        if (!key) continue;
        const sprites = {};
        for (const mood of MOOD_IDS) {
            const url = safeImageUrl(value?.sprites?.[mood]);
            if (url) sprites[mood] = url;
        }
        out[String(key)] = {
            sprites,
            defaultMood: MOOD_IDS.includes(value?.defaultMood) ? value.defaultMood : 'default',
            note: String(value?.note || ''),
            isNpc: value?.isNpc === true,
            /** 参与好感度系统(NPC 默认不参与) */
            trackAffection: value?.trackAffection !== false,
        };
    }
    return out;
}

function normalizeScene(raw = {}) {
    return {
        id: String(raw.id || makeId('scene')),
        name: String(raw.name || '未命名场景'),
        description: String(raw.description || ''),
        imageUrl: safeImageUrl(raw.imageUrl),
        /** 关联的 nook 场所 id —— 有它就从 nook 现读名字和简介,本机只存图 */
        locationId: raw.locationId ? String(raw.locationId) : '',
    };
}

function normalizeCg(raw = {}) {
    return {
        id: String(raw.id || makeId('cg')),
        gameId: String(raw.gameId || ''),
        nodeId: String(raw.nodeId || ''),
        title: String(raw.title || '未命名画面'),
        description: String(raw.description || ''),
        imageUrl: safeImageUrl(raw.imageUrl),
        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

function normalizeSave(raw = {}) {
    return {
        id: String(raw.id || makeId('save')),
        name: String(raw.name || '未命名存档'),
        gameId: String(raw.gameId || ''),
        nodeId: String(raw.nodeId || ''),
        preview: String(raw.preview || ''),
        /** 存档只记「停在哪个节点 + 当时的好感度/任务」—— 剧情本体在节点树里,不复制 */
        affection: normalizeAffection(raw.affection),
        quest: { ...createDefaultQuest(), ...(raw.quest || {}) },
        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

// ============================================================
// 读写
// ============================================================

export async function loadLibrary(app) {
    const db = dbOf(app);
    if (!db) return normalizeLibrary({});
    try {
        const raw = await db.get(STORE_LIBRARY, LIBRARY_KEY);
        return normalizeLibrary(raw || {});
    } catch (err) {
        console.warn('[galgame/db] 读取设置失败,用默认值', err);
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
        console.warn('[galgame/db] 保存设置失败', err);
        return false;
    }
}

export async function loadGames(app) {
    const db = dbOf(app);
    if (!db) return [];
    try {
        const rows = await db.getAllRecords(STORE_GAMES);
        return asArray(rows).map(normalizeGame).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
        console.warn('[galgame/db] 读取存档轨失败', err);
        return [];
    }
}

export async function saveGame(app, game) {
    const db = dbOf(app);
    if (!db || !game?.id) return false;
    const plain = toPlain({ ...game, updatedAt: Date.now() });
    if (!plain) return false;
    try {
        await db.put(STORE_GAMES, plain);
        return true;
    } catch (err) {
        console.warn('[galgame/db] 保存游戏失败', err);
        return false;
    }
}

/**
 * 删一局游戏:游戏本体 + 它名下所有节点。
 *
 * ★ 原型「重新开始」只把内存变量清空,localStorage 里的旧 key 原样留着;
 *   下次刷新 `initGame` 又把它们读回来,表现是「重开之后 CG 和记忆还在」。
 *   拆表之后不清就会留下真正读不到的孤儿记录,必须一起删。
 */
export async function deleteGame(app, gameId) {
    const db = dbOf(app);
    if (!db || !gameId) return false;
    try {
        const nodes = await listNodes(app, gameId);
        await Promise.all(nodes.map((n) => db.remove(STORE_NODES, n.id).catch(() => {})));
        await db.remove(STORE_GAMES, String(gameId));
        return true;
    } catch (err) {
        console.warn('[galgame/db] 删除游戏失败', err);
        return false;
    }
}

export async function listNodes(app, gameId) {
    const db = dbOf(app);
    if (!db || !gameId) return [];
    try {
        const rows = await db.getAllRecords(STORE_NODES);
        return asArray(rows)
            .filter((r) => isSameId(r?.gameId, gameId))
            .map((r) => normalizeNode(r, gameId))
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    } catch (err) {
        console.warn('[galgame/db] 读取节点失败', err);
        return [];
    }
}

export async function saveNode(app, node) {
    const db = dbOf(app);
    if (!db || !node?.id) return false;
    const plain = toPlain(node);
    if (!plain) return false;
    try {
        await db.put(STORE_NODES, plain);
        return true;
    } catch (err) {
        console.warn('[galgame/db] 保存节点失败', err);
        return false;
    }
}

export async function deleteNodes(app, nodeIds = []) {
    const db = dbOf(app);
    if (!db || !nodeIds.length) return false;
    try {
        await Promise.all(nodeIds.map((id) => db.remove(STORE_NODES, String(id)).catch(() => {})));
        return true;
    } catch (err) {
        console.warn('[galgame/db] 删除节点失败', err);
        return false;
    }
}

// ============================================================
// 旧数据迁移
// ============================================================

/** 原型把 CG 画廊整块 JSON 塞在这个 localStorage key 里 */
const LEGACY_CG_KEY = 'galgame_cgHistory';

/**
 * 捞一次原型留下的 CG 画廊。
 *
 * 只捞 CG —— 其余几样(剧情 / 立绘 / 记忆模块)结构对不上,
 * 迁过来只会得到看着像有、实际用不了的数据。理由写在
 * `store.migrateLegacyOnce()` 的注释里。
 *
 * ★ 读完**不删**旧 key:用户可能还想回原型 HTML 里看。
 *   防重复靠 `library.settings.legacyMigrated` 标志。
 */
export function readLegacyData() {
    if (typeof localStorage === 'undefined') return null;
    try {
        const raw = localStorage.getItem(LEGACY_CG_KEY);
        if (!raw) return null;
        const cg = JSON.parse(raw);
        return Array.isArray(cg) ? { cg } : null;
    } catch (_) {
        return null;
    }
}
