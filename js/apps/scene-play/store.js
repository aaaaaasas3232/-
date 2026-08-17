/**
 * 情景剧场 · 状态仓库
 *
 * 模块级 `Vue.reactive` 单例 + mutator + 分对象防抖落盘。
 *
 * ── 规矩 ────────────────────────────────────────────────────────
 *
 * 1. 组件**只读** `getState()`,改状态一律走本文件导出的 mutator。
 * 2. 落盘按对象粒度:改设置只写 `spLibrary`,发一条消息只写**那一条**。
 * 3. hydrate 只用 `_hydrating` 防并发,**不用** `_hydrated` 硬阻断 ——
 *    硬阻断会让首次失败后永远没有第二次机会。
 * 4. 生成任务**只往 store 写,不碰 DOM**。组件卸载了照样在写,
 *    切回来时 Vue 按当前 state 重画 —— 「后台生成」于是不需要任何特殊代码。
 */

import {
    loadLibrary, saveLibrary, loadScenes, saveScene, deleteScene as dbDeleteScene,
    listSaves, saveSave, deleteSave as dbDeleteSave, listMessages, saveMessage,
    deleteMessages, cloneSave, normalizeScene, normalizeSave, normalizeMessage,
    normalizeTheme, normalizeCategory, normalizeClip, normalizeLibrary, seedLibrary,
} from './services/db.js';
import { normalizeRule, compileRules } from './services/regex-engine.js';
import * as nook from './services/nook-bridge.js';
import * as bridges from './services/app-bridges.js';
import * as ai from './services/ai-service.js';
import {
    collectSources, buildPrompt, buildUserTurn, buildDigestPrompt,
} from './services/prompt-builder.js';
import { createDefaultSettings, CONTEXT_SECTIONS, MODE_IDS } from './constants.js';
import {
    makeId, findById, isSameId, asArray, debounce, toPlain, truncate, clamp,
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

    /** 单例:设置 / 配色 / 分类 / 外观主题 / 正则库 / 文案库 */
    library: normalizeLibrary({}),
    scenes: [],
    /** 当前情景下的存档 */
    saves: [],
    /** 当前存档的消息。切档时整体换掉 */
    messages: [],

    activeSceneId: '',
    activeSaveId: '',

    // ── 渲染资源(从气泡机拉的) ─────────────
    bubbles: { left: null, right: null, shapes: [] },
    bubbleListCache: [],

    /** 从四叶草接过来的那一场(整场,不是摘要) */
    theater: null,

    // ── 生成 ────────────────────────────────
    generating: false,
    streamText: '',
    genError: '',
    digesting: false,

    // ── UI ──────────────────────────────────
    /** 打开的抽屉分页 id;空 = 关着 */
    drawer: '',
    modal: null,
    toast: '',
    /** 正在编辑的消息 id */
    editingId: '',
});

export function getState() {
    return STATE;
}

let _app = null;
let _hydrating = false;
/** 消息序号游标。**不用时间戳排序** —— 同一毫秒插两条会乱 */
let _seq = 0;

// ============================================================
// 派生
// ============================================================

export function getSettings() {
    return STATE.library.settings;
}

export function getScene() {
    return findById(STATE.scenes, STATE.activeSceneId);
}

export function getSave() {
    return findById(STATE.saves, STATE.activeSaveId);
}

export function getCategories() {
    return asArray(STATE.library.categories);
}

export function getThemes() {
    return asArray(STATE.library.themes);
}

export function getRules() {
    return asArray(STATE.library.rules);
}

export function getClips() {
    return asArray(STATE.library.clips);
}

/** 当前情景用的那套外观(取不到就用第一套内置的) */
export function getTheme() {
    const scene = getScene();
    return findById(getThemes(), scene?.themeId) || getThemes()[0] || normalizeTheme({});
}

/** 当前情景启用的正则,已编译 */
export function getCompiledRules() {
    const scene = getScene();
    const ids = new Set(asArray(scene?.regexIds).map(String));
    return compileRules(getRules().filter((r) => ids.has(String(r.id))));
}

/** 按分类分组的情景列表(没分类的归到「未分类」) */
export function getScenesByCategory() {
    const groups = getCategories().map((cat) => ({
        category: cat,
        scenes: STATE.scenes.filter((s) => isSameId(s.categoryId, cat.id)),
    }));
    const known = new Set(getCategories().map((c) => String(c.id)));
    const loose = STATE.scenes.filter((s) => !s.categoryId || !known.has(String(s.categoryId)));
    if (loose.length) groups.push({ category: { id: '', name: '未分类' }, scenes: loose });
    return groups;
}

export function getCast() {
    const scene = getScene();
    return asArray(scene?.castIds)
        .map((id) => {
            const person = nook.getAi(id);
            return person ? { id, ...person, note: String(scene?.castNotes?.[id] || '') } : null;
        })
        .filter(Boolean);
}

export function getUserCard() {
    return nook.getUserCard(getScene()?.userPersonaId);
}

/** 一条消息该显示谁的头像和名字 */
export function speakerOf(message) {
    if (message.role === 'user') {
        const card = getUserCard();
        return { name: card?.name || '我', avatar: card?.avatar || '' };
    }
    if (message.role === 'system') return { name: '', avatar: '' };
    const cast = getCast();
    const hit = cast.find((c) => c.name === message.speaker) || cast[0];
    return { name: message.speaker || hit?.name || '对方', avatar: hit?.avatar || '' };
}

// ============================================================
// 落盘
// ============================================================

const persistLibrary = debounce(() => {
    if (!_app) return;
    void saveLibrary(_app, STATE.library);
}, 450);

const _sceneTimers = new Map();

function persistScene(sceneId = STATE.activeSceneId) {
    if (!_app || !sceneId) return;
    const key = String(sceneId);
    if (_sceneTimers.has(key)) clearTimeout(_sceneTimers.get(key));
    _sceneTimers.set(key, setTimeout(() => {
        _sceneTimers.delete(key);
        const scene = findById(STATE.scenes, key);
        if (scene) void saveScene(_app, scene);
    }, 400));
}

/**
 * 消息落盘**不防抖**。
 *
 * 一条消息写完就不再改(除了编辑),而且发消息很可能是用户关掉页面前的
 * 最后一个动作 —— 防抖 400ms 足够让它丢掉。写盘量本来就只有一条记录。
 */
function persistMessage(message) {
    if (!_app || !message) return;
    void saveMessage(_app, message);
}

const persistSave = debounce(() => {
    if (!_app) return;
    const save = getSave();
    if (save) void saveSave(_app, save);
}, 400);

export async function flushPersist() {
    persistLibrary.flush();
    persistSave.flush();
    for (const [key, timer] of _sceneTimers.entries()) {
        clearTimeout(timer);
        _sceneTimers.delete(key);
        const scene = findById(STATE.scenes, key);
        if (scene && _app) await saveScene(_app, scene);
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
        const [library, scenes] = await Promise.all([loadLibrary(_app), loadScenes(_app)]);
        STATE.library = makeReactive(seedLibrary(library));
        STATE.scenes = makeReactive(scenes);
        persistLibrary();

        const wanted = library.activeSceneId && findById(STATE.scenes, library.activeSceneId)
            ? library.activeSceneId
            : (STATE.scenes[0]?.id || '');
        if (wanted) await openScene(wanted);

        STATE.ready = true;
        STATE.error = '';
    } catch (err) {
        console.error('[scene-play/store] 初始化失败', err);
        STATE.error = err?.message || '初始化失败';
        STATE.ready = true;   // 让 UI 能显示错误,而不是永远转圈
    } finally {
        _hydrating = false;
    }

    // nook 可能比本 App 晚就绪 —— 独立等,不阻塞首屏
    void nook.whenReady().then((ok) => { STATE.sdkReady = ok; });
}

// ============================================================
// 情景
// ============================================================

export async function createScene(patch = {}) {
    const userCard = nook.getUserCard(patch.userPersonaId);
    const world = nook.getWorld(patch.worldId, userCard);
    const scene = normalizeScene({
        ...patch,
        id: makeId('scene'),
        title: patch.title || '新情景',
        worldId: patch.worldId || world?.id || '',
        userPersonaId: patch.userPersonaId || userCard?.id || '',
        themeId: patch.themeId || getThemes()[0]?.id || '',
        // 默认把内置的几条正则全开 —— 一条都不开的话 AI 写出 [博客:…]
        // 也只会显示成一串方括号,用户不会想到是「没启用正则」
        regexIds: asArray(patch.regexIds).length ? patch.regexIds : getRules().map((r) => r.id),
        createdAt: Date.now(),
    });
    STATE.scenes.unshift(scene);
    await saveScene(_app, scene);
    await openScene(scene.id);
    // ★ 顺手开一条空线。不开的话 `activeSaveId` 是空的,而舞台的空状态写的是
    //   「这一档还是空的」—— 用户以为有档,点「自己写一条」却只弹一句
    //   「先建一个存档」,完全对不上。有 AI 的路径不会暴露这个问题
    //   (`generate()` 自己会补一条),所以它藏得很深。
    if (!STATE.saves.length) await createSave('第一档');
    return scene;
}

export async function openScene(sceneId) {
    const scene = findById(STATE.scenes, sceneId);
    if (!scene) return false;
    ai.abortAll();
    STATE.generating = false;
    STATE.streamText = '';
    STATE.genError = '';

    STATE.activeSceneId = scene.id;
    STATE.library.activeSceneId = scene.id;
    STATE.saves = makeReactive(await listSaves(_app, scene.id));

    const wanted = scene.activeSaveId && findById(STATE.saves, scene.activeSaveId)
        ? scene.activeSaveId
        : (STATE.saves[0]?.id || '');
    if (wanted) await openSave(wanted);
    else { STATE.activeSaveId = ''; STATE.messages = []; }

    await Promise.all([reloadBubbles(), reloadTheater()]);
    persistLibrary();
    return true;
}

export function updateScene(patch = {}, sceneId = STATE.activeSceneId) {
    const scene = findById(STATE.scenes, sceneId);
    if (!scene) return null;
    const merged = normalizeScene({ ...toPlain(scene), ...patch });
    for (const [key, value] of Object.entries(merged)) {
        if (key === 'id' || key === 'createdAt') continue;
        scene[key] = value;
    }
    persistScene(scene.id);
    // 换了外观就要重拉气泡 —— 不重拉的话主题名字变了、气泡还是旧的
    if (patch.themeId !== undefined) void reloadBubbles();
    if (patch.theaterId !== undefined) void reloadTheater();
    return scene;
}

export async function removeScene(sceneId) {
    const index = STATE.scenes.findIndex((s) => isSameId(s.id, sceneId));
    if (index === -1) return false;
    STATE.scenes.splice(index, 1);
    await dbDeleteScene(_app, sceneId);
    if (isSameId(STATE.activeSceneId, sceneId)) {
        STATE.activeSceneId = '';
        STATE.saves = [];
        STATE.messages = [];
        const next = STATE.scenes[0];
        if (next) await openScene(next.id);
    }
    return true;
}

export async function duplicateScene(sceneId) {
    const src = findById(STATE.scenes, sceneId);
    if (!src) return null;
    const copy = normalizeScene({
        ...toPlain(src),
        id: makeId('scene'),
        title: truncate(`${src.title} 副本`, 40),
        activeSaveId: '',
        createdAt: Date.now(),
    });
    // 存档不跟着复制 —— 复制情景是为了「同一个设定换个方向再演一次」,
    // 把旧存档也带过来的话新情景一打开就是别人的剧情
    STATE.scenes.unshift(copy);
    await saveScene(_app, copy);
    await openScene(copy.id);
    return copy;
}

export function setSceneCategory(sceneId, categoryId) {
    updateScene({ categoryId: String(categoryId || '') }, sceneId);
}

// ============================================================
// 分类
// ============================================================

export function addCategory(name) {
    const cat = normalizeCategory({ name, order: getCategories().length });
    STATE.library.categories = [...getCategories(), cat];
    persistLibrary();
    return cat;
}

export function renameCategory(categoryId, name) {
    const cat = findById(getCategories(), categoryId);
    if (!cat) return false;
    cat.name = String(name || '未命名分类').slice(0, 16);
    persistLibrary();
    return true;
}

/**
 * 删分类。
 *
 * ★ 底下的情景**不删**,只是变成「未分类」。删分类连带删情景是
 *   一种没人想要的破坏性行为,而且用户点删除时想的是「这个抽屉不要了」。
 */
export function removeCategory(categoryId) {
    STATE.library.categories = getCategories().filter((c) => !isSameId(c.id, categoryId));
    for (const scene of STATE.scenes) {
        if (isSameId(scene.categoryId, categoryId)) {
            scene.categoryId = '';
            persistScene(scene.id);
        }
    }
    persistLibrary();
}

export function moveCategory(categoryId, dir) {
    const list = [...getCategories()];
    const from = list.findIndex((c) => isSameId(c.id, categoryId));
    const to = from + (dir < 0 ? -1 : 1);
    if (from < 0 || to < 0 || to >= list.length) return false;
    [list[from], list[to]] = [list[to], list[from]];
    list.forEach((c, i) => { c.order = i; });
    STATE.library.categories = list;
    persistLibrary();
    return true;
}

// ============================================================
// 存档
// ============================================================

export async function createSave(name) {
    const scene = getScene();
    if (!scene) return null;
    const save = normalizeSave({
        id: makeId('save'),
        sceneId: scene.id,
        name: name || `存档 ${STATE.saves.length + 1}`,
        createdAt: Date.now(),
    });
    STATE.saves.unshift(save);
    await saveSave(_app, save);
    await openSave(save.id);
    return save;
}

export async function openSave(saveId) {
    const save = findById(STATE.saves, saveId);
    if (!save) return false;
    ai.abortAll();
    STATE.generating = false;
    STATE.streamText = '';
    STATE.activeSaveId = save.id;
    STATE.messages = makeReactive(await listMessages(_app, save.id));
    _seq = STATE.messages.reduce((max, m) => Math.max(max, m.seq || 0), 0);
    const scene = getScene();
    if (scene) updateScene({ activeSaveId: save.id });
    return true;
}

export function renameSave(saveId, name) {
    const save = findById(STATE.saves, saveId);
    if (!save) return false;
    save.name = String(name || '未命名存档').slice(0, 30);
    save.updatedAt = Date.now();
    void saveSave(_app, save);
    return true;
}

export async function removeSave(saveId) {
    const index = STATE.saves.findIndex((s) => isSameId(s.id, saveId));
    if (index === -1) return false;
    STATE.saves.splice(index, 1);
    await dbDeleteSave(_app, saveId);
    if (isSameId(STATE.activeSaveId, saveId)) {
        STATE.activeSaveId = '';
        STATE.messages = [];
        const next = STATE.saves[0];
        if (next) await openSave(next.id);
    }
    return true;
}

/** 另存为新档 —— 从当前进度分叉出一条新线,原档不动 */
export async function forkSave(name) {
    const save = getSave();
    if (!save) return null;
    const copy = await cloneSave(_app, toPlain(save), toPlain(STATE.messages), name);
    STATE.saves.unshift(copy);
    await openSave(copy.id);
    return copy;
}

/** 覆盖:把当前进度写回某个已有存档 */
export async function overwriteSave(targetSaveId) {
    const target = findById(STATE.saves, targetSaveId);
    const current = getSave();
    if (!target || !current || isSameId(target.id, current.id)) return false;

    const old = await listMessages(_app, target.id);
    await deleteMessages(_app, old.map((m) => m.id));
    for (const message of STATE.messages) {
        await saveMessage(_app, normalizeMessage({ ...toPlain(message), id: makeId('msg'), saveId: target.id }, target.id));
    }
    target.messageCount = STATE.messages.length;
    target.lastLine = truncate(STATE.messages[STATE.messages.length - 1]?.text || '', 60);
    target.updatedAt = Date.now();
    await saveSave(_app, target);
    return true;
}

/** 存档列表要显示的元信息,发完消息就更新一次 */
function touchSave() {
    const save = getSave();
    if (!save) return;
    save.messageCount = STATE.messages.length;
    save.lastLine = truncate(STATE.messages[STATE.messages.length - 1]?.text || '', 60);
    save.updatedAt = Date.now();
    persistSave();
}

/** 让 AI 给当前存档起个名 + 写一句摘要 */
export async function digestSave() {
    const save = getSave();
    if (!save || STATE.messages.length < 2) return { ok: false, error: '内容太少,先演几段' };
    if (STATE.digesting) return { ok: false, error: '正在生成' };

    const userCard = getUserCard();
    const apiRef = nook.resolveApiRef(userCard);
    if (!apiRef) return { ok: false, error: nook.describeMissingApi() };

    STATE.digesting = true;
    let result;
    try {
        result = await ai.generate({
            apiRef,
            systemPrompt: '',
            userTurn: buildDigestPrompt({ messages: toPlain(STATE.messages), userName: userCard?.name }),
            temperature: 0.4,
            stream: false,
            signal: ai.createAbort('digest'),
        });
    } finally {
        ai.releaseAbort('digest');
        STATE.digesting = false;
    }
    if (!result.ok) return { ok: false, error: result.error };

    const data = parseLooseJson(result.text);
    if (!data?.title) return { ok: false, error: 'AI 没按格式返回,再试一次' };
    save.name = String(data.title).slice(0, 30);
    save.summary = String(data.summary || '').slice(0, 120);
    save.updatedAt = Date.now();
    await saveSave(_app, save);
    return { ok: true, title: save.name };
}

/** 从一段可能带围栏的模型输出里抠 JSON */
function parseLooseJson(raw) {
    let text = String(raw ?? '').trim();
    if (!text) return null;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch (_) {
        return null;
    }
}

// ============================================================
// 消息
// ============================================================

function appendMessage(patch) {
    _seq += 1;
    const message = normalizeMessage({ ...patch, id: makeId('msg'), saveId: STATE.activeSaveId, seq: _seq }, STATE.activeSaveId);
    STATE.messages.push(message);
    persistMessage(message);
    touchSave();
    return message;
}

export function editMessage(messageId, text) {
    const message = findById(STATE.messages, messageId);
    if (!message) return false;
    message.text = String(text || '').slice(0, 8000);
    message.editedAt = Date.now();
    persistMessage(message);
    touchSave();
    return true;
}

export async function removeMessage(messageId) {
    const index = STATE.messages.findIndex((m) => isSameId(m.id, messageId));
    if (index === -1) return false;
    STATE.messages.splice(index, 1);
    await deleteMessages(_app, [messageId]);
    touchSave();
    return true;
}

/**
 * 删掉某条消息**及其之后的全部** —— 重 roll 的第一步。
 *
 * 用户点重 roll 时的心理模型是「从这里重来」,所以后面那些是必须走的。
 * 只删这一条的话,重新生成的内容会插在一段「未来」的前面,越演越乱。
 */
export async function truncateFrom(messageId) {
    const index = STATE.messages.findIndex((m) => isSameId(m.id, messageId));
    if (index === -1) return [];
    const removed = STATE.messages.splice(index);
    await deleteMessages(_app, removed.map((m) => m.id));
    touchSave();
    return removed;
}

export function countAfter(messageId) {
    const index = STATE.messages.findIndex((m) => isSameId(m.id, messageId));
    return index === -1 ? 0 : STATE.messages.length - index;
}

export function setEditing(messageId) {
    STATE.editingId = String(messageId || '');
}

// ============================================================
// 生成
// ============================================================

/**
 * 让 AI 写下一段。
 *
 * @param {object} opts
 * @param {'open'|'reply'|'continue'|'reroll'} opts.kind
 * @param {string} [opts.userText]   `reply` 时用户写的那句
 * @param {string} [opts.note]       `reroll` 时的修改意见
 * @param {string} [opts.fromId]     `reroll` 时从哪一条开始重来
 */
export async function generate(opts = {}) {
    if (STATE.generating) return { ok: false, error: '正在生成中' };
    const scene = getScene();
    if (!scene) return { ok: false, error: '先选一个情景' };
    if (!STATE.activeSaveId) {
        const save = await createSave('第一档');
        if (!save) return { ok: false, error: '建不了存档' };
    }

    const kind = ['open', 'reply', 'continue', 'reroll'].includes(opts.kind) ? opts.kind : 'reply';

    // 重 roll:先把那一条和它之后的全部删掉,再重新生成
    if (kind === 'reroll' && opts.fromId) {
        await truncateFrom(opts.fromId);
    }
    // 用户这一句要**先落盘再发** —— 反过来的话生成失败时用户写的那句就没了
    if (kind === 'reply' && String(opts.userText || '').trim()) {
        appendMessage({ role: 'user', text: String(opts.userText).trim() });
    }

    const sources = collectSources({
        scene,
        library: STATE.library,
        messages: toPlain(STATE.messages),
        theater: STATE.theater,
    });

    const apiRef = nook.resolveApiRef(sources.userCard);
    if (!apiRef) {
        STATE.genError = nook.describeMissingApi();
        return { ok: false, error: STATE.genError };
    }

    const { text: systemPrompt } = buildPrompt({
        scene, library: STATE.library, sources, saveId: STATE.activeSaveId,
    });
    const userTurn = buildUserTurn({
        kind,
        userText: opts.userText,
        note: opts.note,
        userName: sources.userCard?.name,
    });

    STATE.generating = true;
    STATE.genError = '';
    STATE.streamText = '';

    const settings = getSettings();
    const signal = ai.createAbort('reply');
    let result;
    try {
        result = await ai.generate({
            apiRef,
            systemPrompt,
            userTurn,
            temperature: settings.temperature,
            stream: settings.stream,
            signal,
            onChunk: (_delta, full) => { STATE.streamText = full; },
        });
    } finally {
        ai.releaseAbort('reply');
        STATE.generating = false;
        STATE.streamText = '';
    }

    // 中断时已经写出来的那部分**是用户的**,只要有内容就照常落成一条
    const text = String(result.text || '').trim();
    if (!text) {
        STATE.genError = result.aborted ? '已停止生成' : (result.error || '生成失败');
        return { ok: false, error: STATE.genError };
    }

    const message = appendMessage({ role: 'ai', text, speaker: guessSpeaker(text, sources.cast) });
    return { ok: true, id: message.id };
}

/**
 * 猜这一段主要是谁在说。
 *
 * ★ 只在**名册里**找,不靠正则从文本里抠名字。抠名字这条路在
 *   「他看着阿澈,说:…」这种句子上会把旁白里提到的人认成说话人。
 *   猜不出来就留空 —— 留空的表现是不显示名字,而认错人的表现是
 *   一整段台词挂在错误的头像下面。
 */
function guessSpeaker(text, cast) {
    const list = asArray(cast);
    if (list.length === 1) return list[0].ai.name;
    const head = String(text).slice(0, 40);
    for (const c of list) {
        if (c.ai.name && head.includes(c.ai.name)) return c.ai.name;
    }
    return '';
}

export function stopGeneration() {
    ai.abort('reply');
}

/**
 * 用户自己写一条(不触发 AI)—— 演旁白或者补一句台词时用。
 *
 * ★ 没有存档时**自己补一条**,而不是返回 null。和 `generate()` 保持一致:
 *   「先去建个存档再回来」对用户来说是一个没有理由的额外步骤。
 */
export async function addManualMessage({ role, text, speaker }) {
    const body = String(text || '').trim();
    if (!body) return null;
    if (!getScene()) return null;
    if (!STATE.activeSaveId) {
        const save = await createSave('第一档');
        if (!save) return null;
    }
    return appendMessage({
        role: role === 'user' ? 'user' : (role === 'system' ? 'system' : 'ai'),
        text: body,
        speaker,
    });
}

// ============================================================
// 外观主题
// ============================================================

export function addTheme(patch = {}) {
    const theme = normalizeTheme({ ...patch, id: makeId('theme'), createdAt: Date.now(), builtin: false });
    STATE.library.themes = [...getThemes(), theme];
    persistLibrary();
    return theme;
}

export function updateTheme(themeId, patch = {}) {
    const theme = findById(getThemes(), themeId);
    if (!theme) return null;
    const merged = normalizeTheme({ ...toPlain(theme), ...patch });
    for (const [key, value] of Object.entries(merged)) {
        if (key === 'id' || key === 'createdAt') continue;
        theme[key] = value;
    }
    persistLibrary();
    // 换气泡要重拉 —— 只改 id 不重拉的话画面上还是旧气泡
    if (patch.bubbleLeftId !== undefined || patch.bubbleRightId !== undefined) void reloadBubbles();
    return theme;
}

export function duplicateTheme(themeId, name) {
    const src = findById(getThemes(), themeId);
    if (!src) return null;
    return addTheme({ ...toPlain(src), name: name || `${src.name} 副本` });
}

export function removeTheme(themeId) {
    STATE.library.themes = getThemes().filter((t) => !isSameId(t.id, themeId));
    // 用到它的情景回落到第一套 —— 留着一个指向不存在主题的 id 会让那些情景
    // 每次打开都走「取不到主题」的兜底分支,而用户完全看不出原因
    const fallback = getThemes()[0]?.id || '';
    for (const scene of STATE.scenes) {
        if (isSameId(scene.themeId, themeId)) {
            scene.themeId = fallback;
            persistScene(scene.id);
        }
    }
    persistLibrary();
    void reloadBubbles();
}

/** 把气泡机里的两套气泡拉过来 */
export async function reloadBubbles() {
    const theme = getTheme();
    try {
        STATE.bubbles = await bridges.loadThemeBubbles(theme);
    } catch (err) {
        console.warn('[scene-play/store] 拉气泡失败', err);
        STATE.bubbles = { left: null, right: null, shapes: [] };
    }
}

export async function loadBubbleChoices() {
    STATE.bubbleListCache = await bridges.listBubbles();
    return STATE.bubbleListCache;
}

// ============================================================
// 正则库
// ============================================================

export function addRule(patch = {}) {
    const rule = normalizeRule({ ...patch, id: makeId('rx'), builtin: false, createdAt: Date.now() });
    STATE.library.rules = [...getRules(), rule];
    persistLibrary();
    return rule;
}

export function updateRule(ruleId, patch = {}) {
    const rule = findById(getRules(), ruleId);
    if (!rule) return null;
    const merged = normalizeRule({ ...toPlain(rule), ...patch });
    for (const [key, value] of Object.entries(merged)) {
        if (key === 'id' || key === 'createdAt') continue;
        rule[key] = value;
    }
    persistLibrary();
    return rule;
}

export function removeRule(ruleId) {
    STATE.library.rules = getRules().filter((r) => !isSameId(r.id, ruleId));
    for (const scene of STATE.scenes) {
        const next = asArray(scene.regexIds).filter((id) => !isSameId(id, ruleId));
        if (next.length !== asArray(scene.regexIds).length) {
            scene.regexIds = next;
            persistScene(scene.id);
        }
    }
    persistLibrary();
}

/** 当前情景启用 / 停用某条规则 */
export function toggleSceneRule(ruleId) {
    const scene = getScene();
    if (!scene) return;
    const ids = asArray(scene.regexIds).map(String);
    const next = ids.includes(String(ruleId))
        ? ids.filter((id) => id !== String(ruleId))
        : [...ids, String(ruleId)];
    updateScene({ regexIds: next });
}

// ============================================================
// 文案库
// ============================================================

export function addClip(patch = {}) {
    const clip = normalizeClip({ ...patch, id: makeId('clip'), builtin: false, createdAt: Date.now() });
    STATE.library.clips = [clip, ...getClips()];
    persistLibrary();
    return clip;
}

export function updateClip(clipId, patch = {}) {
    const clip = findById(getClips(), clipId);
    if (!clip) return null;
    if (patch.title != null) clip.title = String(patch.title).slice(0, 24);
    if (patch.content != null) clip.content = String(patch.content);
    if (patch.tag != null) clip.tag = String(patch.tag).slice(0, 12);
    persistLibrary();
    return clip;
}

/**
 * 删一条文案。
 *
 * ★ 删的是**内置**文案时要立一块墓碑(`removedBuiltinClipIds`)——
 *   不立的话下次打开 App,补种逻辑发现「库里没有这个 id」,又给加回来了。
 *   表现是「删了没用,重开又在」,而且用户找不到任何原因。
 */
export function removeClip(clipId) {
    const clip = findById(getClips(), clipId);
    if (clip?.builtin) {
        const tomb = asArray(STATE.library.removedBuiltinClipIds).map(String);
        if (!tomb.includes(String(clip.id))) {
            STATE.library.removedBuiltinClipIds = [...tomb, String(clip.id)];
        }
    }
    STATE.library.clips = getClips().filter((c) => !isSameId(c.id, clipId));
    persistLibrary();
}

/** 把一条文案塞进当前情景的「情景」字段 */
export function useClip(clipId, mode = 'replace') {
    const clip = findById(getClips(), clipId);
    const scene = getScene();
    if (!clip || !scene) return false;
    const next = mode === 'append' && scene.setting
        ? `${scene.setting}\n\n${clip.content}`
        : clip.content;
    updateScene({ setting: next });
    return true;
}

/** 当前情景引用 / 取消引用一条文案(作为独立上下文段) */
export function toggleSceneClip(clipId) {
    const scene = getScene();
    if (!scene) return;
    const ids = asArray(scene.clipIds).map(String);
    const next = ids.includes(String(clipId))
        ? ids.filter((id) => id !== String(clipId))
        : [...ids, String(clipId)];
    updateScene({ clipIds: next });
}

// ============================================================
// 小剧场
// ============================================================

export async function reloadTheater() {
    const scene = getScene();
    if (!scene?.theaterId) { STATE.theater = null; return; }
    STATE.theater = await bridges.getTheater(scene.theaterId);
}

export async function listTheaterChoices() {
    return bridges.listTheaters();
}

/**
 * 接住一场小剧场。
 *
 * 两件事一起做:记下 theaterId(它会作为「前情」进 prompt),
 * 并且把台词摊平成消息落进当前存档 —— 用户打开就能看到之前那些台词,
 * 而不是一个空白页面加一段看不见的 prompt。
 */
export async function adoptTheater(theaterId, { asMessages = true } = {}) {
    const scene = getScene();
    if (!scene) return { ok: false, error: '先选一个情景' };
    const theater = await bridges.getTheater(theaterId);
    if (!theater) return { ok: false, error: '取不到这一场,四叶草里可能已经删了' };

    updateScene({ theaterId: theater.id });
    STATE.theater = theater;

    if (asMessages) {
        if (!STATE.activeSaveId) await createSave(truncate(theater.title, 20));
        const userName = getUserCard()?.name || '';
        const rows = bridges.theaterToMessages(theater, (speaker) => (speaker === userName ? 'user' : 'ai'));
        for (const row of rows) appendMessage(row);
    }
    return { ok: true, count: theater.scenes.length };
}

// ============================================================
// 上下文分段
// ============================================================

export function setContextSection(sectionId, active) {
    const scene = getScene();
    if (!scene) return;
    updateScene({ contextConfig: { ...scene.contextConfig, [sectionId]: active !== false } });
}

/**
 * 当前的段落顺序。
 *
 * `scene.contextOrder` 里可能缺段(新版本加了新段落、用户的旧顺序里没有它)——
 * 缺的**补到末尾并保持原相对顺序**,不能丢掉也不能塞到最前面,
 * 否则用户会以为「新功能没生效」或者「排序被打乱了」。
 */
export function getContextOrder() {
    const scene = getScene();
    const saved = asArray(scene?.contextOrder).map(String);
    const known = CONTEXT_SECTIONS.map((s) => s.id);
    const out = saved.filter((id) => known.includes(id));
    for (const id of known) if (!out.includes(id)) out.push(id);
    return out;
}

export function moveContextSection(sectionId, dir) {
    const order = getContextOrder();
    const from = order.indexOf(String(sectionId));
    const to = from + (dir < 0 ? -1 : 1);
    if (from < 0 || to < 0 || to >= order.length) return false;
    [order[from], order[to]] = [order[to], order[from]];
    updateScene({ contextOrder: order });
    return true;
}

export function resetContextOrder() {
    updateScene({ contextOrder: [] });
}

// ============================================================
// 手动设定
// ============================================================

export function addNote(patch = {}) {
    const scene = getScene();
    if (!scene) return null;
    const note = {
        id: makeId('note'),
        title: String(patch.title || '未命名').slice(0, 24),
        content: String(patch.content || ''),
        active: patch.active !== false,
        createdAt: Date.now(),
    };
    updateScene({ notes: [...asArray(scene.notes), note] });
    return note;
}

export function updateNote(noteId, patch = {}) {
    const scene = getScene();
    if (!scene) return false;
    const notes = asArray(scene.notes).map((n) => (isSameId(n.id, noteId) ? { ...n, ...patch } : n));
    updateScene({ notes });
    return true;
}

export function removeNote(noteId) {
    const scene = getScene();
    if (!scene) return;
    updateScene({ notes: asArray(scene.notes).filter((n) => !isSameId(n.id, noteId)) });
}

// ============================================================
// 设置 / 配色
// ============================================================

export function updateSettings(patch = {}) {
    Object.assign(STATE.library.settings, patch);
    persistLibrary();
}

/**
 * 聊天区那条情景常驻条:展开 / 收起。
 *
 * 落在 `settings` 里而不是组件的 data —— 组件会随着切情景、切存档重建,
 * 存在 data 里的话每次回来都弹回默认状态,用户以为「它自己又展开了」。
 */
export function toggleSceneBanner() {
    updateSettings({ sceneBannerOpen: !getSettings().sceneBannerOpen });
    return getSettings().sceneBannerOpen;
}

/** 整条藏起来 / 放回来。外观面板里也有同一个开关 */
export function setSceneBannerHidden(hidden) {
    updateSettings({ sceneBannerHidden: hidden === true });
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
        id: makeId('palette'),
        name: String(name || '自定义配色').slice(0, 16),
        baseThemeId: String(baseThemeId || 'jelly'),
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

export function removeCustomTheme(paletteId) {
    const settings = STATE.library.settings;
    settings.customThemes = asArray(settings.customThemes).filter((t) => !isSameId(t.id, paletteId));
    if (isSameId(settings.activeCustomThemeId, paletteId)) settings.activeCustomThemeId = '';
    persistLibrary();
}

export function resetSettings() {
    STATE.library.settings = {
        ...createDefaultSettings(),
        customThemes: STATE.library.settings.customThemes,
    };
    persistLibrary();
}

// ============================================================
// UI
// ============================================================

export function setDrawer(drawerId) {
    STATE.drawer = STATE.drawer === drawerId ? '' : String(drawerId || '');
}

export function closeDrawer() {
    STATE.drawer = '';
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
    ai.abortAll();
}

// ============================================================
// 跨 App 服务
// ============================================================

/** murmur 的 `[开一场:…]` 落到这里 */
export async function captureScene(text) {
    await hydrate(_app);
    const body = String(text || '').trim();
    if (!body) return { ok: false, error: '内容为空' };
    const scene = await createScene({
        title: truncate(body, 16),
        setting: body,
        mode: 'dialogue',
    });
    await flushPersist();
    return { ok: Boolean(scene), id: scene?.id };
}

/** 给 murmur 读的当前进度摘要 */
export function readProgressBrief() {
    const scene = getScene();
    if (!scene) return null;
    const save = getSave();
    const last = STATE.messages[STATE.messages.length - 1];
    return {
        title: scene.title,
        mode: scene.mode,
        saveName: save?.name || '',
        rounds: STATE.messages.length,
        lastLine: truncate(last?.text || '', 40),
    };
}

/** 给外部判断「用了多少体裁」,顺便暴露一下可选体裁清单 */
export function listModes() {
    return MODE_IDS.slice();
}

/** 生成中给灵动岛用的进度百分比(纯展示,没有真实进度就按字数估) */
export function streamProgress() {
    return clamp(STATE.streamText.length / 400, 0, 1);
}
