/**
 * 湛蓝回忆 · 状态仓库
 *
 * 模块级 `Vue.reactive` 单例 + mutator + 分对象防抖落盘,照 relax-app / 梦境编织
 * 那套(项目里最成熟的 vue 模式范式)。
 *
 * ── 规矩 ────────────────────────────────────────────────────────
 *
 * 1. 组件**只读** `getState()`,改状态一律走本文件导出的 mutator。
 *    这样「什么时候该落盘」只有一个地方要考虑。
 * 2. 落盘按对象粒度:改设置只写 `ggLibrary`,新增一幕只写**那一个节点**。
 * 3. hydrate 只用 `_hydrating` 防并发,**不用** `_hydrated` 硬阻断 ——
 *    硬阻断会让首次失败后永远没有第二次机会(AGENTS2 §9.12 天气 App 的坑)。
 * 4. 生成任务**只往 store 写,不碰 DOM**。组件卸载了照样在写,
 *    切回来时 Vue 按当前 state 重画 —— 「后台生成」于是不需要任何特殊代码。
 */

import {
    loadLibrary, saveLibrary, loadGames, saveGame, deleteGame as dbDeleteGame,
    listNodes, saveNode, deleteNodes, normalizeGame, normalizeNode, normalizeLibrary,
    readLegacyData,
} from './services/db.js';
import * as nook from './services/nook-bridge.js';
import * as ai from './services/ai-service.js';
import {
    buildPrompt, buildUserTurn, collectSources,
    buildAffectionPrompt, buildQuestPrompt, buildCgPrompt,
    buildScriptPrompt, buildScriptUserTurn,
} from './services/prompt-builder.js';
import { parseScript, formatScript } from './services/script-format.js';
import {
    buildScriptNodes, collectScriptSpeakers, collectScriptScenes,
} from './services/script-io.js';
import {
    advanceWindow, collectUnitTexts, buildCompressPrompt, makeKUnit,
    readContext, pathTo,
} from './services/kchain.js';
import { parseStoryResponse, fallbackOptions, summarizeNode } from './services/story-engine.js';
import {
    createDefaultSettings, createDefaultQuest, createDefaultContextConfig,
    KCHAIN_DEFAULTS, MOOD_IDS, CONTEXT_SECTIONS,
} from './constants.js';
import {
    makeId, isSameId, findById, asArray, clamp, debounce, toPlain,
    truncate, parseLooseJson, safeImageUrl,
} from './utils.js';

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
    games: [],
    library: normalizeLibrary({}),
    /** 当前这一局的全部节点。切局时整体换掉,不常驻所有局的节点 */
    nodes: [],

    activeGameId: '',

    // ── 演出 ────────────────────────────────
    /** 当前显示到第几段对白 */
    playIndex: 0,
    /** 逐字机已经打出来的文字 */
    typed: '',
    typing: false,
    /** 这一幕放完了,等玩家选 */
    awaitingChoice: false,

    // ── 生成 ────────────────────────────────
    generating: false,
    /** 流式原文(只给「生成中」的进度感,不直接显示给玩家) */
    streamChars: 0,
    genError: '',
    /** K 链压缩中 */
    compressing: false,
    /** 好感度判定中 */
    judging: false,
    /** CG 生成中 */
    cgBusy: false,
    /** 整份剧本生成中 */
    scriptBusy: false,
    scriptChars: 0,

    // ── UI ──────────────────────────────────
    /** 打开的面板 id(见 constants.PANELS),空 = 舞台 */
    panel: '',
    modal: null,
    toast: '',
});

export function getState() {
    return STATE;
}

let _app = null;
let _hydrating = false;

// ============================================================
// 派生
// ============================================================

export function getGame() {
    return findById(STATE.games, STATE.activeGameId);
}

export function getNodeMap() {
    return new Map(STATE.nodes.map((n) => [String(n.id), n]));
}

export function getCurrentNode() {
    const game = getGame();
    if (!game?.currentNodeId) return null;
    return findById(STATE.nodes, game.currentNodeId);
}

export function getSettings() {
    return STATE.library.settings;
}

/** 当前节点到根的路径 */
export function getCurrentPath() {
    const node = getCurrentNode();
    if (!node) return [];
    return pathTo(node, getNodeMap());
}

export function getSegments() {
    return asArray(getCurrentNode()?.segments);
}

export function getCurrentSegment() {
    const segs = getSegments();
    return segs[clamp(STATE.playIndex, 0, Math.max(0, segs.length - 1))] || null;
}

/** 这一局能出场的角色(nook 人设 + 本机立绘配置) */
export function getCast() {
    const game = getGame();
    if (!game) return [];
    const conf = STATE.library.cast || {};
    return asArray(game.castIds)
        .map((id) => {
            const ai_ = nook.getAi(id);
            if (!ai_) return null;
            const c = conf[id] || {};
            return {
                id,
                ai: ai_,
                name: ai_.name,
                isNpc: c.isNpc === true,
                trackAffection: c.trackAffection !== false && c.isNpc !== true,
                note: String(c.note || ''),
                sprites: c.sprites || {},
                defaultMood: MOOD_IDS.includes(c.defaultMood) ? c.defaultMood : 'default',
            };
        })
        .filter(Boolean);
}

/** 舞台背景:当前节点的场景 → 往上找最近一个设过场景的祖先 */
export function getStageImage() {
    const path = getCurrentPath();
    for (let i = path.length - 1; i >= 0; i -= 1) {
        const key = path[i].sceneKey;
        if (!key) continue;
        const scene = findById(STATE.library.scenes, key);
        if (scene?.imageUrl) return scene.imageUrl;
    }
    return '';
}

/** 当前说话人的立绘 */
export function getStageSprite() {
    if (!getSettings().showSprite) return '';
    const seg = getCurrentSegment();
    if (!seg?.speaker || seg.isPlayer) return '';
    const member = getCast().find((c) => c.name === seg.speaker);
    if (!member) return '';
    return member.sprites[seg.mood] || member.sprites[member.defaultMood] || member.sprites.default || '';
}

/** K 链状态(记忆面板 + 舞台角标都读它) */
export function getKStats() {
    return readContext(getCurrentNode(), getNodeMap(), getSettings().kChain).stats;
}

/** 这一局是不是只读剧本(预设模式) */
export function isPresetMode() {
    return getGame()?.presetMode === true;
}

/**
 * 这一幕的选项:哪些已经走过(走过的直接跳,不重新生成)。
 *
 * `blocked` = 预设剧本里这条线没写下文。点它不会去调 AI,而是直说到头了。
 */
export function getChoices() {
    const node = getCurrentNode();
    if (!node) return [];
    const preset = isPresetMode();
    const children = asArray(node.childIds).map((id) => findById(STATE.nodes, id)).filter(Boolean);
    return asArray(node.options).map((text) => {
        const visited = children.find((c) => c.choice?.text === text) || null;
        return { text, visitedNodeId: visited ? visited.id : '', blocked: preset && !visited };
    });
}

/** 这一幕之外、玩家自己写过的分支 */
export function getCustomChildren() {
    const node = getCurrentNode();
    if (!node) return [];
    return asArray(node.childIds)
        .map((id) => findById(STATE.nodes, id))
        .filter((c) => c && c.choice?.kind === 'custom');
}

// ============================================================
// 落盘
// ============================================================

const persistLibrary = debounce(() => {
    if (!_app) return;
    void saveLibrary(_app, STATE.library);
}, 450);

const _gameTimers = new Map();

function persistGame(gameId = STATE.activeGameId) {
    if (!_app || !gameId) return;
    const key = String(gameId);
    if (_gameTimers.has(key)) clearTimeout(_gameTimers.get(key));
    _gameTimers.set(key, setTimeout(() => {
        _gameTimers.delete(key);
        const game = findById(STATE.games, key);
        if (game) void saveGame(_app, game);
    }, 400));
}

/**
 * 节点落盘**不防抖**。
 *
 * 节点是一次性写完就不再改的(除了 kState),而且一幕可能就是玩家关掉页面前的
 * 最后一个动作 —— 防抖 400ms 足够让它丢掉。写盘量本来就只有一条记录,不值得省。
 */
function persistNode(node) {
    if (!_app || !node) return;
    void saveNode(_app, node);
}

export async function flushPersist() {
    persistLibrary.flush();
    for (const [key, timer] of _gameTimers.entries()) {
        clearTimeout(timer);
        _gameTimers.delete(key);
        const game = findById(STATE.games, key);
        if (game && _app) await saveGame(_app, game);
    }
}

// ============================================================
// 初始化
// ============================================================

export async function hydrate(app) {
    if (app) _app = app;
    if (_hydrating) return;
    _hydrating = true;
    try {
        const [library, games] = await Promise.all([loadLibrary(_app), loadGames(_app)]);
        STATE.library = makeReactive(library);
        STATE.games = makeReactive(games);

        migrateLegacyOnce();

        const wanted = library.activeGameId && findById(games, library.activeGameId)
            ? library.activeGameId
            : (games[0]?.id || '');
        if (wanted) await openGame(wanted);

        STATE.ready = true;
        STATE.error = '';
    } catch (err) {
        console.error('[galgame/store] 初始化失败', err);
        STATE.error = err?.message || '初始化失败';
        STATE.ready = true;   // 让 UI 能显示错误,而不是永远转圈
    } finally {
        _hydrating = false;
    }

    // nook 可能比本 App 晚就绪 —— 独立等,不阻塞首屏
    void nook.whenReady().then((ok) => { STATE.sdkReady = ok; });
}

/**
 * 从原型的 localStorage 捞一次 CG 画廊。
 *
 * **只迁 CG。** 其余三样都迁不了,而且理由各不相同:
 *   - 剧情:原型存的是一条线性 `gameHistory`,没有树结构,
 *     硬塞进来只会得到一棵既不能分支也不能跳转的假树
 *   - 立绘:原型按「角色名」存,这边按 nook 的 `aiPersonId` 存,
 *     两者之间没有可靠的对应关系,猜错了比没有更糟
 *   - 记忆模块:是「分类 → 条目」结构,和 K 链不是一回事
 *
 * 迁完**不删**旧 key —— 用户可能还想回原型 HTML 里看。
 */
function migrateLegacyOnce() {
    if (STATE.library.settings.legacyMigrated) return;
    STATE.library.settings.legacyMigrated = true;

    const legacy = readLegacyData();
    const list = asArray(legacy?.cg);
    for (const cg of list) {
        STATE.library.cgs.push({
            id: makeId('cg'),
            gameId: '',
            nodeId: '',
            title: String(cg?.title || '旧版画面'),
            description: String(cg?.description || ''),
            imageUrl: safeImageUrl(cg?.imageUrl || cg?.image),
            createdAt: Number(cg?.timestamp) || Date.now(),
        });
    }
    if (list.length) STATE.toast = `从旧版捞回了 ${list.length} 张 CG`;
    persistLibrary();
}

// ============================================================
// 局
// ============================================================

export async function createGame(patch = {}) {
    const playerCard = nook.getPlayerCard(patch.userPersonaId);
    const world = nook.getWorld(patch.worldId, playerCard);
    const game = normalizeGame({
        ...patch,
        id: makeId('game'),
        title: patch.title || world?.name || '新的故事',
        worldId: patch.worldId || world?.id || '',
        userPersonaId: patch.userPersonaId || playerCard?.id || '',
        contextConfig: createDefaultContextConfig(),
        quest: { ...createDefaultQuest(), ...(patch.quest || {}) },
    });
    // 出场角色都给一份初始好感度(NPC 不参与,由 cast 配置决定)
    for (const id of game.castIds) {
        game.affection[id] = { value: 50, thoughts: '', updatedAt: 0 };
    }
    STATE.games.unshift(game);
    await saveGame(_app, game);
    await openGame(game.id);
    return game;
}

export async function openGame(gameId) {
    const game = findById(STATE.games, gameId);
    if (!game) return false;
    stopTyping();
    ai.abortAll();
    STATE.generating = false;
    STATE.activeGameId = game.id;
    STATE.library.activeGameId = game.id;
    STATE.nodes = makeReactive(await listNodes(_app, game.id));
    STATE.panel = '';
    resetPlayback();
    persistLibrary();
    return true;
}

export function updateGame(patch = {}) {
    const game = getGame();
    if (!game) return null;
    Object.assign(game, patch, { updatedAt: Date.now() });
    persistGame(game.id);
    return game;
}

export async function removeGame(gameId) {
    const index = STATE.games.findIndex((g) => isSameId(g.id, gameId));
    if (index === -1) return false;
    STATE.games.splice(index, 1);
    await dbDeleteGame(_app, gameId);
    // 存档也要跟着走,否则会留下一堆点了报「找不到节点」的死档
    STATE.library.saves = STATE.library.saves.filter((s) => !isSameId(s.gameId, gameId));
    STATE.library.cgs = STATE.library.cgs.filter((c) => !isSameId(c.gameId, gameId));
    persistLibrary();
    if (isSameId(STATE.activeGameId, gameId)) {
        STATE.activeGameId = '';
        STATE.nodes = [];
        const next = STATE.games[0];
        if (next) await openGame(next.id);
    }
    return true;
}

// ============================================================
// 演出
// ============================================================

let _typeTimer = null;

function stopTyping() {
    if (_typeTimer) {
        clearTimeout(_typeTimer);
        _typeTimer = null;
    }
    STATE.typing = false;
}

function resetPlayback() {
    stopTyping();
    STATE.playIndex = 0;
    STATE.typed = '';
    STATE.awaitingChoice = false;
    revealCurrent();
}

function revealCurrent() {
    stopTyping();
    const segs = getSegments();
    const seg = segs[STATE.playIndex];
    if (!seg) {
        STATE.typed = '';
        STATE.awaitingChoice = segs.length > 0;
        return;
    }
    const settings = getSettings();
    if (!settings.typewriter) {
        STATE.typed = seg.text;
        STATE.awaitingChoice = STATE.playIndex >= segs.length - 1;
        return;
    }
    STATE.typed = '';
    STATE.typing = true;
    const full = seg.text;
    const speed = clamp(settings.typeSpeed, 4, 120);
    let i = 0;
    const step = () => {
        i += 1;
        STATE.typed = full.slice(0, i);
        if (i >= full.length) {
            _typeTimer = null;
            STATE.typing = false;
            STATE.awaitingChoice = STATE.playIndex >= getSegments().length - 1;
            return;
        }
        _typeTimer = setTimeout(step, speed);
    };
    _typeTimer = setTimeout(step, speed);
}

/** 点对话框:打字中就直接打完,否则下一句 */
export function advanceDialogue() {
    if (STATE.typing) {
        stopTyping();
        const seg = getCurrentSegment();
        STATE.typed = seg ? seg.text : '';
        STATE.awaitingChoice = STATE.playIndex >= getSegments().length - 1;
        return;
    }
    const segs = getSegments();
    if (STATE.playIndex < segs.length - 1) {
        STATE.playIndex += 1;
        revealCurrent();
        return;
    }
    STATE.awaitingChoice = segs.length > 0;
}

/** 跳到这一幕的末尾(玩家想直接看选项) */
export function skipToChoices() {
    stopTyping();
    const segs = getSegments();
    STATE.playIndex = Math.max(0, segs.length - 1);
    STATE.typed = segs[STATE.playIndex]?.text || '';
    STATE.awaitingChoice = segs.length > 0;
}

/**
 * 切到任意节点。
 *
 * **用户可以在任意时间切换任意节点** —— 这是本 App 的核心交互,
 * 所以它必须是一个便宜、无副作用的操作:只改「当前在哪」,
 * 不动任何已生成的内容,也不删任何分支。
 */
export function setCurrentNode(nodeId) {
    const node = findById(STATE.nodes, nodeId);
    if (!node) return false;
    updateGame({ currentNodeId: node.id });
    STATE.panel = '';
    resetPlayback();
    return true;
}

// ============================================================
// 生成
// ============================================================

function resolveSceneKey(sceneName, parentNode) {
    const name = String(sceneName || '').trim();
    if (!name) return parentNode?.sceneKey || '';
    const hit = asArray(STATE.library.scenes).find((s) => s.name === name);
    return hit ? hit.id : (parentNode?.sceneKey || '');
}

/**
 * 生成下一幕。
 *
 * @param {object} opts
 * @param {'start'|'option'|'custom'} opts.kind
 * @param {string} [opts.choice]
 * @param {string} [opts.replaceNodeId]  重写某一幕时传它(会先把那一幕连同后续删掉)
 */
export async function generateNext(opts = {}) {
    if (STATE.generating) return { ok: false, error: '正在生成中' };
    const game = getGame();
    if (!game) return { ok: false, error: '还没有开始一局' };
    // ★ 预设剧本整局都不调 AI —— 用户可能压根没有 API Key,
    //   悄悄发一个必然失败的请求只会得到一句他看不懂的报错
    if (game.presetMode) {
        return { ok: false, presetBlocked: true, error: '这是预设剧本,不会调用 AI。到「剧本」面板里关掉预设模式就能接着往下编。' };
    }

    const kind = ['start', 'option', 'custom'].includes(opts.kind) ? opts.kind : 'option';
    const choice = String(opts.choice || '');

    if (opts.replaceNodeId) {
        await deleteSubtree(opts.replaceNodeId, { silent: true });
    }

    const parent = kind === 'start' ? null : getCurrentNode();
    const nodeMap = getNodeMap();
    const sources = collectSources({ game, library: STATE.library, currentNode: parent, nodeMap });

    const apiRef = nook.resolveApiRef(sources.playerCard);
    if (!apiRef) {
        STATE.genError = nook.describeMissingApi();
        return { ok: false, error: STATE.genError };
    }

    const { text: systemPrompt } = buildPrompt({ game, library: STATE.library, sources, currentNode: parent });
    const userTurn = buildUserTurn({
        kind,
        choice,
        playerName: sources.playerCard?.name || '',
        opening: game.openingHint,
    });

    STATE.generating = true;
    STATE.genError = '';
    STATE.streamChars = 0;
    STATE.awaitingChoice = false;

    const settings = getSettings();
    const signal = ai.createAbort('story');
    let result;
    try {
        result = await ai.generate({
            apiRef,
            systemPrompt,
            userTurn,
            temperature: settings.temperature,
            stream: settings.stream,
            signal,
            onChunk: (_delta, full) => { STATE.streamChars = full.length; },
        });
    } finally {
        ai.releaseAbort('story');
        STATE.generating = false;
    }

    // 中断时已经写出来的那部分**是用户的**,只要解析得出内容就照常落成一幕
    if (!result.ok && !result.text.trim()) {
        STATE.genError = result.aborted ? '已停止生成' : (result.error || '生成失败');
        return { ok: false, error: STATE.genError };
    }

    const parsed = parseStoryResponse(result.text, {
        castNames: sources.cast.map((c) => c.ai.name),
        playerName: sources.playerCard?.name || '',
        optionCount: settings.optionCount,
    });

    if (!parsed.segments.length) {
        STATE.genError = 'AI 没写出可用的剧情,再试一次';
        return { ok: false, error: STATE.genError };
    }

    const node = normalizeNode({
        id: makeId('node'),
        gameId: game.id,
        parentId: parent?.id || '',
        depth: (parent?.depth ?? -1) + 1,
        choice: { kind, text: choice },
        segments: parsed.segments,
        options: parsed.options.length ? parsed.options : fallbackOptions(settings.optionCount),
        sceneKey: resolveSceneKey(parsed.scene, parent),
        createdAt: Date.now(),
    }, game.id);

    // ── K 窗口推进 ──
    const kChain = { ...KCHAIN_DEFAULTS, ...(settings.kChain || {}) };
    const adv = advanceWindow(parent?.kState, node.id, kChain.windowSize);
    node.kState = { units: adv.units, kCount: adv.kCount, pending: false };

    STATE.nodes.push(node);
    if (parent) {
        parent.childIds = [...asArray(parent.childIds), node.id];
        persistNode(parent);
    } else {
        game.rootNodeId = node.id;
    }
    persistNode(node);
    updateGame({ currentNodeId: node.id, rootNodeId: game.rootNodeId || node.id });
    resetPlayback();

    if (parsed.warnings.length) {
        STATE.toast = parsed.warnings[0];
    }

    // ── 后台任务:压缩 / 好感度 ──
    // 只往 store 写,不碰 DOM —— 用户切走了照样跑完
    if (kChain.enabled && kChain.autoCompress && adv.needsCompress) {
        void compressNode(node.id);
    }
    if (settings.autoAffection && kind !== 'start') {
        void judgeAffection(node.id);
    }

    return { ok: true, nodeId: node.id };
}

export function stopGeneration() {
    ai.abort('story');
}

/** 玩家点了一个选项 */
export async function chooseOption(text) {
    const node = getCurrentNode();
    if (!node) return { ok: false, error: '当前没有剧情' };
    const hit = asArray(node.childIds)
        .map((id) => findById(STATE.nodes, id))
        .find((c) => c && c.choice?.text === text);
    // 走过的岔路直接过去 —— 重新生成一遍等于把之前那条线覆盖掉,
    // 而分支树的全部意义就是「走过的都还在」
    if (hit) {
        setCurrentNode(hit.id);
        return { ok: true, nodeId: hit.id, revisited: true };
    }
    if (isPresetMode()) {
        return {
            ok: false,
            presetBlocked: true,
            error: `剧本里没写「${truncate(text, 12)}」之后发生了什么。换一条选项,或者到「剧本」面板关掉预设模式让 AI 接着编。`,
        };
    }
    return generateNext({ kind: 'option', choice: text });
}

/** 重写这一幕(会把它和它之后的分支一起删掉) */
export async function regenerateCurrent() {
    const node = getCurrentNode();
    if (!node) return { ok: false, error: '当前没有剧情' };
    const parentId = node.parentId;
    const kind = node.choice?.kind || 'start';
    const choice = node.choice?.text || '';
    if (parentId) {
        updateGame({ currentNodeId: parentId });
    }
    return generateNext({ kind, choice, replaceNodeId: node.id });
}

// ============================================================
// 树维护
// ============================================================

function collectSubtree(nodeId) {
    const map = getNodeMap();
    const out = [];
    const walk = (id) => {
        const node = map.get(String(id));
        if (!node) return;
        out.push(node);
        for (const child of asArray(node.childIds)) walk(child);
    };
    walk(nodeId);
    return out;
}

export function countSubtree(nodeId) {
    return collectSubtree(nodeId).length;
}

/** 删一条分支:节点本身 + 它下面所有后代 */
export async function deleteSubtree(nodeId, { silent = false } = {}) {
    const doomed = collectSubtree(nodeId);
    if (!doomed.length) return false;
    const ids = new Set(doomed.map((n) => String(n.id)));

    const target = doomed[0];
    const parent = target.parentId ? findById(STATE.nodes, target.parentId) : null;
    if (parent) {
        parent.childIds = asArray(parent.childIds).filter((id) => !ids.has(String(id)));
        persistNode(parent);
    }

    STATE.nodes = STATE.nodes.filter((n) => !ids.has(String(n.id)));
    await deleteNodes(_app, [...ids]);

    // 存档/CG 指向被删节点就成了死链,一起清
    STATE.library.saves = STATE.library.saves.filter((s) => !ids.has(String(s.nodeId)));
    STATE.library.cgs = STATE.library.cgs.filter((c) => !c.nodeId || !ids.has(String(c.nodeId)));
    persistLibrary();

    const game = getGame();
    if (game && ids.has(String(game.currentNodeId))) {
        updateGame({ currentNodeId: parent?.id || '' });
        resetPlayback();
    }
    if (game && ids.has(String(game.rootNodeId))) {
        updateGame({ rootNodeId: STATE.nodes[0]?.id || '' });
    }
    if (!silent) STATE.toast = `已删除 ${doomed.length} 幕`;
    return true;
}

// ============================================================
// K 链压缩
// ============================================================

/**
 * 压一次。
 *
 * 失败时**保持窗口原样**(不消耗那几个单元)—— 下一幕进来窗口变成 5 个,
 * `needsCompress` 依然成立,会自动再试一次。这比「失败就丢掉这段记忆」好得多。
 */
export async function compressNode(nodeId) {
    const node = findById(STATE.nodes, nodeId);
    if (!node) return { ok: false, error: '节点不存在' };
    const units = asArray(node.kState?.units);
    if (units.length < 2) return { ok: false, error: '内容太少,不用压' };
    if (node.kState.pending) return { ok: false, error: '正在压缩中' };

    const game = getGame();
    const playerCard = nook.getPlayerCard(game?.userPersonaId);
    const apiRef = nook.resolveApiRef(playerCard);
    if (!apiRef) return { ok: false, error: nook.describeMissingApi() };

    node.kState.pending = true;
    STATE.compressing = true;
    persistNode(node);

    const nodeMap = getNodeMap();
    const materials = collectUnitTexts(units, nodeMap);
    const prompt = buildCompressPrompt({ materials, kIndex: node.kState.kCount });

    let result;
    try {
        result = await ai.generate({
            apiRef,
            systemPrompt: '',
            userTurn: prompt,
            temperature: 0.4,
            stream: false,
            signal: ai.createAbort('kchain'),
        });
    } finally {
        ai.releaseAbort('kchain');
        STATE.compressing = false;
    }

    node.kState.pending = false;
    if (!result.ok || !result.text.trim()) {
        persistNode(node);
        STATE.toast = `K${node.kState.kCount} 压缩失败:${result.error || '返回为空'},下一幕会自动重试`;
        return { ok: false, error: result.error };
    }

    const kUnit = makeKUnit({
        units,
        index: node.kState.kCount,
        content: result.text.trim(),
        nodeMap,
    });
    node.kState = { units: [kUnit], kCount: node.kState.kCount + 1, pending: false };
    persistNode(node);

    if (game) {
        updateGame({ kCounter: Math.max(game.kCounter || 0, node.kState.kCount) });
    }
    STATE.toast = `已生成 K${kUnit.index}`;
    return { ok: true, unit: kUnit };
}

/** 手动改一条 K 摘要的正文(记忆面板里编辑) */
export function editKUnit(nodeId, unitId, content) {
    const node = findById(STATE.nodes, nodeId);
    if (!node) return false;
    const unit = asArray(node.kState?.units).find((u) => u.type === 'k' && isSameId(u.id, unitId));
    if (!unit) return false;
    unit.content = String(content || '');
    persistNode(node);
    return true;
}

// ============================================================
// 好感度 / 主线
// ============================================================

/**
 * 好感度判定。
 *
 * ★ 只做**增量**更新。原型的 `initializeAffectionSystem()` 会把整张表清空重建成 50,
 *   而 `saveWorldviewConfig()` 每次都调它 —— 进设置点一下「保存」,
 *   攒了几十轮的好感度全部归零,还不提示。这里的初始化只补齐新角色。
 */
export async function judgeAffection(nodeId) {
    const game = getGame();
    const node = findById(STATE.nodes, nodeId) || getCurrentNode();
    if (!game || !node) return;
    const cast = getCast().filter((c) => c.trackAffection);
    if (!cast.length) return;

    const playerCard = nook.getPlayerCard(game.userPersonaId);
    const apiRef = nook.resolveApiRef(playerCard);
    if (!apiRef) return;

    const recent = asArray(node.segments)
        .map((s) => (s.speaker ? `${s.speaker}:${s.text}` : s.text))
        .join('\n');

    STATE.judging = true;
    let result;
    try {
        result = await ai.generate({
            apiRef,
            systemPrompt: '',
            userTurn: buildAffectionPrompt({
                cast: cast.map((c) => ({ ...c, enabled: true })),
                affection: game.affection,
                recent,
                choice: node.choice?.text,
            }),
            temperature: 0.5,
            stream: false,
            signal: ai.createAbort('affection'),
        });
    } finally {
        ai.releaseAbort('affection');
        STATE.judging = false;
    }
    if (!result.ok) return;

    const data = parseLooseJson(result.text);
    const updates = asArray(data?.updates);
    if (!updates.length) return;

    for (const item of updates) {
        const id = String(item?.id || '');
        if (!id || !cast.some((c) => c.id === id)) continue;
        const prev = game.affection[id] || { value: 50, thoughts: '' };
        const delta = clamp(Number(item.change) || 0, -10, 10);
        game.affection[id] = {
            value: clamp(prev.value + delta, 0, 100),
            thoughts: truncate(String(item.thoughts || prev.thoughts || ''), 20),
            updatedAt: Date.now(),
        };
    }
    persistGame(game.id);
}

export function setAffection(castId, value, thoughts) {
    const game = getGame();
    if (!game) return;
    const prev = game.affection[castId] || { value: 50, thoughts: '' };
    game.affection[castId] = {
        value: clamp(value, 0, 100),
        thoughts: thoughts == null ? prev.thoughts : String(thoughts),
        updatedAt: Date.now(),
    };
    persistGame(game.id);
}

export async function checkQuest() {
    const game = getGame();
    const node = getCurrentNode();
    if (!game?.quest?.title || !node) return { ok: false, error: '还没设置主线' };
    if (game.quest.completed) return { ok: false, error: '主线已经完成了' };

    const playerCard = nook.getPlayerCard(game.userPersonaId);
    const apiRef = nook.resolveApiRef(playerCard);
    if (!apiRef) return { ok: false, error: nook.describeMissingApi() };

    // 判定要看**整条线路**而不是只看最后一幕 —— 主线是攒出来的
    const recent = getCurrentPath()
        .slice(-8)
        .map((n) => asArray(n.segments).map((s) => (s.speaker ? `${s.speaker}:${s.text}` : s.text)).join('\n'))
        .join('\n\n');

    STATE.judging = true;
    let result;
    try {
        result = await ai.generate({
            apiRef,
            systemPrompt: '',
            userTurn: buildQuestPrompt({ quest: game.quest, recent }),
            temperature: 0.3,
            stream: false,
            signal: ai.createAbort('quest'),
        });
    } finally {
        ai.releaseAbort('quest');
        STATE.judging = false;
    }
    if (!result.ok) return { ok: false, error: result.error };

    const data = parseLooseJson(result.text);
    if (!data) return { ok: false, error: 'AI 没按格式返回,再试一次' };

    if (data.completed === true) {
        game.quest = { ...game.quest, completed: true, completedAt: Date.now() };
        node.ending = { title: game.quest.title, kind: 'main' };
        persistNode(node);
        persistGame(game.id);
        STATE.toast = `主线完成:${data.reason || game.quest.title}`;
        return { ok: true, completed: true, reason: String(data.reason || '') };
    }
    STATE.toast = `还没完成:${data.reason || '剧情里还没有明确达成'}`;
    return { ok: true, completed: false, reason: String(data.reason || '') };
}

// ============================================================
// 剧本(预设流程的导入 / 导出 / 指导 prompt)
// ============================================================

/**
 * 拼指导 prompt 要用到的外部数据。
 *
 * 还没建局时(第一次用的人多半就是这样)拿这个世界观下的**全部角色**兜底 ——
 * 名册是空的话 AI 会自己编名字,而 `parseScript` 认不出编出来的名字,
 * 那几句台词会全部变成旁白,名牌整幕都不出现。
 */
function collectScriptSources() {
    const game = getGame();
    const sources = collectSources({
        game,
        library: STATE.library,
        currentNode: null,
        nodeMap: new Map(),
    });
    if (!sources.cast.length) {
        sources.cast = nook.listWorldAis(sources.world).map((ai) => ({
            ai, enabled: true, isNpc: false, trackAffection: true,
            note: '', sprites: {}, defaultMood: 'default',
        }));
    }
    return { game, sources };
}

/** 指导 prompt(面板里预览 / 复制的就是它,一键生成发出去的也是它) */
export function buildScriptGuide(flowText) {
    const { game, sources } = collectScriptSources();
    return buildScriptPrompt({ game, sources, flowText }, { save: false });
}

/** 校验一份剧本文本,报告里带行号 */
export function validateScript(text) {
    const { sources } = collectScriptSources();
    return parseScript(text, {
        castNames: sources.cast.map((c) => c.ai.name),
        playerName: sources.playerCard?.name || '',
    });
}

/**
 * 有 API 时的一键生成。
 *
 * 生成完**不直接导入** —— 先把文本交回面板走一遍校验报告,
 * 用户确认之后才建局。AI 写错格式是常态,静默导入一棵半截树最难查。
 */
export async function generateScript(flowText) {
    if (STATE.scriptBusy) return { ok: false, error: '正在生成中' };
    const { game, sources } = collectScriptSources();

    const apiRef = nook.resolveApiRef(sources.playerCard);
    if (!apiRef) return { ok: false, error: nook.describeMissingApi() };

    const { text: systemPrompt } = buildScriptPrompt({ game, sources, flowText });
    const userTurn = buildScriptUserTurn({ playerName: sources.playerCard?.name || '' });

    STATE.scriptBusy = true;
    STATE.scriptChars = 0;
    const settings = getSettings();
    let result;
    try {
        result = await ai.generate({
            apiRef,
            systemPrompt,
            userTurn,
            temperature: 0.9,
            stream: settings.stream,
            signal: ai.createAbort('script'),
            onChunk: (_delta, full) => { STATE.scriptChars = full.length; },
        });
    } finally {
        ai.releaseAbort('script');
        STATE.scriptBusy = false;
    }

    // 中断时写出来的半份剧本也还给用户 —— 多半能改改就用
    if (!result.ok && !result.text.trim()) {
        return { ok: false, error: result.aborted ? '已停止生成' : (result.error || '生成失败') };
    }
    return { ok: true, text: result.text, aborted: result.aborted === true };
}

export function stopScriptGeneration() {
    ai.abort('script');
}

/**
 * 把一份剧本导入成**新的一局**。
 *
 * ★ 永远新建,绝不覆盖已有的局 —— 导入是个很容易点错的动作,
 *   而剧情树是用户最不想丢的东西。
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {boolean} [opts.presetMode] 默认 true(只读剧本模式)
 */
export async function importScript(text, opts = {}) {
    const parsed = validateScript(text);
    if (!parsed.ok) {
        return { ok: false, error: '这份剧本还有拦下来的错,先照报告改一下', parsed };
    }

    const playerCard = nook.getPlayerCard();
    const world = nook.getWorld('', playerCard);
    const roster = nook.listWorldAis(world);

    // 剧本里的名字 → nook 人设 id。对不上的照样能玩,只是没有立绘和好感度
    const castIds = [];
    const unmatched = [];
    for (const name of collectScriptSpeakers(parsed)) {
        if (playerCard?.name && name === playerCard.name) continue;
        const hit = roster.find((a) => a.name === name);
        if (!hit) { unmatched.push(name); continue; }
        if (!castIds.includes(hit.id)) castIds.push(hit.id);
    }

    const game = await createGame({
        title: parsed.meta.title || '导入的剧本',
        genre: parsed.meta.genreId,
        worldTimeText: parsed.meta.worldTime,
        openingHint: parsed.meta.opening,
        worldId: world?.id || '',
        userPersonaId: playerCard?.id || '',
        castIds,
        presetMode: opts.presetMode !== false,
        scriptTitle: parsed.meta.title || '',
    });

    // 剧本里的场景名登记成本机场景 —— 之后就能给它配背景图
    const sceneIdByName = new Map();
    for (const name of collectScriptScenes(parsed)) {
        const exist = asArray(STATE.library.scenes).find((s) => s.name === name);
        sceneIdByName.set(name, exist ? exist.id : addScene({ name }).id);
    }

    const { nodes, rootNodeId, skipped } = buildScriptNodes({
        parsed,
        gameId: game.id,
        windowSize: getSettings().kChain?.windowSize || KCHAIN_DEFAULTS.windowSize,
        sceneIdByName,
    });
    if (!nodes.length || !rootNodeId) {
        await removeGame(game.id);
        return { ok: false, error: '这份剧本没有能用的幕(可能开场那一幕被 [GOTO] 指了回去)', parsed };
    }

    // 先落盘再进内存:写盘失败的话内存里那棵树是假的,刷新就没了
    for (const node of nodes) await saveNode(_app, node);
    STATE.nodes = makeReactive(nodes);

    game.rootNodeId = rootNodeId;
    updateGame({ rootNodeId, currentNodeId: rootNodeId });
    await saveGame(_app, game);
    setCurrentNode(rootNodeId);

    STATE.toast = `已导入「${game.title}」${nodes.length} 幕`;
    return { ok: true, game, parsed, count: nodes.length, skipped, unmatched };
}

/** 把当前这一局的**整棵树**写回剧本格式 */
export function exportCurrentScript() {
    const game = getGame();
    if (!game) return { ok: false, error: '还没有故事', text: '' };
    if (!STATE.nodes.length) return { ok: false, error: '这一局还没有任何剧情', text: '' };
    const text = formatScript({
        game,
        nodes: STATE.nodes,
        castNames: getCast().map((c) => c.name),
        scenes: STATE.library.scenes,
    });
    return { ok: true, text, count: STATE.nodes.length };
}

/** 只读剧本模式开关(按局存) */
export function setPresetMode(on) {
    if (!getGame()) return false;
    updateGame({ presetMode: on === true });
    return true;
}

// ============================================================
// CG
// ============================================================

export async function generateCg() {
    const game = getGame();
    const node = getCurrentNode();
    if (!game || !node) return { ok: false, error: '当前没有剧情' };
    if (STATE.cgBusy) return { ok: false, error: '正在生成' };

    const playerCard = nook.getPlayerCard(game.userPersonaId);
    const apiRef = nook.resolveApiRef(playerCard);
    if (!apiRef) return { ok: false, error: nook.describeMissingApi() };

    const world = nook.getWorld(game.worldId, playerCard);
    const recent = asArray(node.segments)
        .map((s) => (s.speaker ? `${s.speaker}:${s.text}` : s.text))
        .join('\n');

    STATE.cgBusy = true;
    let result;
    try {
        result = await ai.generate({
            apiRef,
            systemPrompt: '',
            userTurn: buildCgPrompt({ recent, world }),
            temperature: 0.7,
            stream: false,
            signal: ai.createAbort('cg'),
        });
    } finally {
        ai.releaseAbort('cg');
        STATE.cgBusy = false;
    }
    if (!result.ok) return { ok: false, error: result.error };

    const data = parseLooseJson(result.text);
    if (!data?.description) {
        return { ok: false, error: 'AI 没按格式返回,再试一次' };
    }
    const cg = {
        id: makeId('cg'),
        gameId: game.id,
        nodeId: node.id,
        title: truncate(String(data.title || '未命名画面'), 12),
        description: String(data.description),
        imageUrl: '',
        createdAt: Date.now(),
    };
    STATE.library.cgs.unshift(cg);
    persistLibrary();
    return { ok: true, cg };
}

export function updateCg(cgId, patch = {}) {
    const cg = findById(STATE.library.cgs, cgId);
    if (!cg) return false;
    if (patch.title != null) cg.title = String(patch.title);
    if (patch.description != null) cg.description = String(patch.description);
    if (patch.imageUrl != null) cg.imageUrl = safeImageUrl(patch.imageUrl);
    persistLibrary();
    return true;
}

export function removeCg(cgId) {
    STATE.library.cgs = STATE.library.cgs.filter((c) => !isSameId(c.id, cgId));
    persistLibrary();
}

// ============================================================
// 存档
// ============================================================

/**
 * 存档 = **书签**,不是快照。
 *
 * 剧情本体在节点树里、永远都在,所以一个档只需要记「停在哪个节点 +
 * 当时的好感度和任务状态」。原型是把整个 `gameHistory` 复制一份塞进 localStorage,
 * 三个档就能把 5MB 配额顶爆,而 `setItem` 超配额抛的是同步异常、它没有 try/catch。
 */
export function createSave(name) {
    const game = getGame();
    const node = getCurrentNode();
    if (!game || !node) return null;
    const save = {
        id: makeId('save'),
        name: String(name || '').trim() || `第 ${getCurrentPath().length} 幕`,
        gameId: game.id,
        nodeId: node.id,
        preview: summarizeNode(node, 30),
        affection: toPlain(game.affection) || {},
        quest: toPlain(game.quest) || createDefaultQuest(),
        createdAt: Date.now(),
    };
    STATE.library.saves.unshift(save);
    persistLibrary();
    return save;
}

export async function loadSave(saveId) {
    const save = findById(STATE.library.saves, saveId);
    if (!save) return false;
    if (!isSameId(save.gameId, STATE.activeGameId)) {
        const ok = await openGame(save.gameId);
        if (!ok) { STATE.toast = '这个档所属的故事已经被删了'; return false; }
    }
    const node = findById(STATE.nodes, save.nodeId);
    if (!node) { STATE.toast = '这个档指向的剧情已经被删了'; return false; }
    const game = getGame();
    if (game) {
        game.affection = toPlain(save.affection) || {};
        game.quest = { ...createDefaultQuest(), ...(save.quest || {}) };
    }
    setCurrentNode(node.id);
    persistGame(STATE.activeGameId);
    STATE.toast = `已读取「${save.name}」`;
    return true;
}

export function removeSave(saveId) {
    STATE.library.saves = STATE.library.saves.filter((s) => !isSameId(s.id, saveId));
    persistLibrary();
}

// ============================================================
// 角色 / 场景 / 手记 / 自定义提示词
// ============================================================

export function setCastConfig(aiPersonId, patch = {}) {
    const conf = STATE.library.cast[aiPersonId] || {
        sprites: {}, defaultMood: 'default', note: '', isNpc: false, trackAffection: true,
    };
    if (patch.note != null) conf.note = String(patch.note);
    if (patch.isNpc != null) conf.isNpc = patch.isNpc === true;
    if (patch.trackAffection != null) conf.trackAffection = patch.trackAffection === true;
    if (patch.defaultMood && MOOD_IDS.includes(patch.defaultMood)) conf.defaultMood = patch.defaultMood;
    if (patch.sprites) {
        for (const [mood, url] of Object.entries(patch.sprites)) {
            if (!MOOD_IDS.includes(mood)) continue;
            const safe = safeImageUrl(url);
            if (safe) conf.sprites[mood] = safe;
            else delete conf.sprites[mood];
        }
    }
    STATE.library.cast[aiPersonId] = conf;
    persistLibrary();
    return conf;
}

export function toggleCastMember(aiPersonId) {
    const game = getGame();
    if (!game) return;
    const list = asArray(game.castIds);
    if (list.includes(aiPersonId)) {
        game.castIds = list.filter((id) => id !== aiPersonId);
    } else {
        game.castIds = [...list, aiPersonId];
        if (!game.affection[aiPersonId]) {
            game.affection[aiPersonId] = { value: 50, thoughts: '', updatedAt: 0 };
        }
    }
    persistGame(game.id);
}

export function addScene(patch = {}) {
    const scene = {
        id: makeId('scene'),
        name: String(patch.name || '新场景'),
        description: String(patch.description || ''),
        imageUrl: safeImageUrl(patch.imageUrl),
        locationId: patch.locationId ? String(patch.locationId) : '',
    };
    STATE.library.scenes.push(scene);
    persistLibrary();
    return scene;
}

export function updateScene(sceneId, patch = {}) {
    const scene = findById(STATE.library.scenes, sceneId);
    if (!scene) return false;
    if (patch.name != null) scene.name = String(patch.name);
    if (patch.description != null) scene.description = String(patch.description);
    if (patch.imageUrl != null) scene.imageUrl = safeImageUrl(patch.imageUrl);
    persistLibrary();
    return true;
}

export function removeScene(sceneId) {
    STATE.library.scenes = STATE.library.scenes.filter((s) => !isSameId(s.id, sceneId));
    persistLibrary();
}

/**
 * 从 nook 把这个世界观下的场所拉成场景。
 *
 * 已经拉过的(按 locationId 判重)只更新名字和简介,**不动本机配的图** ——
 * 图是 nook 里没有的东西,重拉一次把它清掉是最让人恼火的行为。
 */
export function pullScenesFromNook() {
    const game = getGame();
    const playerCard = nook.getPlayerCard(game?.userPersonaId);
    const world = nook.getWorld(game?.worldId, playerCard);
    const locations = nook.listWorldLocations(world);
    if (!locations.length) return { added: 0, updated: 0 };

    let added = 0;
    let updated = 0;
    for (const loc of locations) {
        const exist = STATE.library.scenes.find((s) => isSameId(s.locationId, loc.id));
        if (exist) {
            exist.name = loc.name;
            exist.description = loc.summary;
            updated += 1;
        } else {
            STATE.library.scenes.push({
                id: makeId('scene'),
                name: loc.name,
                description: loc.summary,
                imageUrl: '',
                locationId: loc.id,
            });
            added += 1;
        }
    }
    persistLibrary();
    return { added, updated };
}

export function addNote(patch = {}) {
    const game = getGame();
    if (!game) return null;
    const note = {
        id: makeId('note'),
        title: String(patch.title || '未命名'),
        content: String(patch.content || ''),
        active: patch.active !== false,
        createdAt: Date.now(),
    };
    game.notes = [...asArray(game.notes), note];
    persistGame(game.id);
    return note;
}

export function updateNote(noteId, patch = {}) {
    const game = getGame();
    const note = findById(game?.notes, noteId);
    if (!note) return false;
    if (patch.title != null) note.title = String(patch.title);
    if (patch.content != null) note.content = String(patch.content);
    if (patch.active != null) note.active = patch.active === true;
    persistGame(game.id);
    return true;
}

export function removeNote(noteId) {
    const game = getGame();
    if (!game) return;
    game.notes = asArray(game.notes).filter((n) => !isSameId(n.id, noteId));
    persistGame(game.id);
}

export function setContextSection(sectionId, active) {
    const game = getGame();
    if (!game) return;
    game.contextConfig = { ...game.contextConfig, [sectionId]: active !== false };
    persistGame(game.id);
}

/**
 * 当前的段落顺序。
 *
 * `game.contextOrder` 里可能缺段(新版本加了新段落、用户的旧顺序里没有它)——
 * 缺的**补到末尾并保持原相对顺序**,不能丢掉也不能塞到最前面,
 * 否则用户会以为「新功能没生效」或者「排序被打乱了」。
 */
export function getContextOrder() {
    const game = getGame();
    const saved = asArray(game?.contextOrder).map(String);
    const known = CONTEXT_SECTIONS.map((s) => s.id);
    const out = saved.filter((id) => known.includes(id));
    for (const id of known) if (!out.includes(id)) out.push(id);
    return out;
}

/** 把一段往上/往下挪一格 */
export function moveContextSection(sectionId, dir) {
    const order = getContextOrder();
    const from = order.indexOf(String(sectionId));
    const to = from + (dir < 0 ? -1 : 1);
    if (from < 0 || to < 0 || to >= order.length) return false;
    [order[from], order[to]] = [order[to], order[from]];
    updateGame({ contextOrder: order });
    return true;
}

/** 拖拽用:把 a 挪到 b 现在的位置 */
export function moveContextSectionTo(sectionId, targetId) {
    const order = getContextOrder();
    const from = order.indexOf(String(sectionId));
    const to = order.indexOf(String(targetId));
    if (from < 0 || to < 0 || from === to) return false;
    order.splice(to, 0, order.splice(from, 1)[0]);
    updateGame({ contextOrder: order });
    return true;
}

export function resetContextOrder() {
    updateGame({ contextOrder: [] });
}

// ============================================================
// 设置 / 主题
// ============================================================

export function updateSettings(patch = {}) {
    Object.assign(STATE.library.settings, patch);
    persistLibrary();
}

export function updateKChain(patch = {}) {
    STATE.library.settings.kChain = {
        ...KCHAIN_DEFAULTS,
        ...STATE.library.settings.kChain,
        ...patch,
    };
    persistLibrary();
}

export function applyTheme({ baseThemeId, customColors, customThemeId }) {
    const settings = STATE.library.settings;
    if (baseThemeId) settings.theme = baseThemeId;
    settings.customThemeColors = { ...(customColors || {}) };
    settings.activeCustomThemeId = String(customThemeId || '');
    persistLibrary();
}

export function saveCustomTheme({ name, baseThemeId, colors }) {
    const theme = {
        id: makeId('theme'),
        name: String(name || '自定义主题'),
        baseThemeId: String(baseThemeId || 'azure'),
        colors: { ...(colors || {}) },
        createdAt: Date.now(),
    };
    STATE.library.settings.customThemes = [...asArray(STATE.library.settings.customThemes), theme];
    persistLibrary();
    return theme;
}

/**
 * 改一套已保存配色：改名、或者用当前颜色覆盖它。
 *
 * 以前只有「存为新配色」，改一版就多存一条，几次之后列表里躺着五六个
 * 「自定义配色」，谁也认不出哪个是哪个。
 */
export function updateCustomTheme(themeId, patch = {}) {
    const settings = STATE.library.settings;
    const theme = asArray(settings.customThemes).find((t) => isSameId(t.id, themeId));
    if (!theme) return null;
    if (typeof patch.name === 'string' && patch.name.trim()) theme.name = patch.name.trim();
    if (patch.colors && typeof patch.colors === 'object') theme.colors = { ...patch.colors };
    if (patch.baseThemeId) theme.baseThemeId = String(patch.baseThemeId);
    theme.updatedAt = Date.now();
    // 改的正是当前生效的那套 → 顺手让它立刻生效
    if (isSameId(settings.activeCustomThemeId, themeId)) {
        settings.customThemeColors = { ...theme.colors };
        settings.theme = theme.baseThemeId;
    }
    persistLibrary();
    return theme;
}

export function removeCustomTheme(themeId) {
    const settings = STATE.library.settings;
    settings.customThemes = asArray(settings.customThemes).filter((t) => !isSameId(t.id, themeId));
    if (isSameId(settings.activeCustomThemeId, themeId)) settings.activeCustomThemeId = '';
    persistLibrary();
}

export function resetSettings() {
    STATE.library.settings = {
        ...createDefaultSettings(),
        legacyMigrated: true,
        customThemes: STATE.library.settings.customThemes,
    };
    persistLibrary();
}

// ============================================================
// UI
// ============================================================

export function setPanel(panelId) {
    STATE.panel = STATE.panel === panelId ? '' : String(panelId || '');
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

export function teardown() {
    stopTyping();
    ai.abortAll();
}

// ============================================================
// 跨 App 服务
// ============================================================

/** murmur 的 `[写进故事:…]` 落到这里 */
export async function captureNote(text) {
    await hydrate(_app);
    const game = getGame();
    if (!game) return { ok: false, error: '还没有开始一局' };
    const note = addNote({ title: '来自聊天', content: text });
    await flushPersist();
    return { ok: Boolean(note), id: note?.id };
}

/** 给 murmur 读的当前进度摘要 */
export function readProgressBrief() {
    const game = getGame();
    if (!game) return null;
    const path = getCurrentPath();
    const node = getCurrentNode();
    return {
        title: game.title,
        scenes: path.length,
        lastChoice: node?.choice?.text || '',
        lastLine: node ? summarizeNode(node, 40) : '',
        questTitle: game.quest?.title || '',
        questCompleted: game.quest?.completed === true,
    };
}
