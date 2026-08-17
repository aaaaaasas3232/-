/**
 * 人设机 · 状态仓库
 *
 * 模块级 `Vue.reactive` 单例 + mutator + 防抖落盘,照 relax-app / dream-weaver
 * 那套(项目里最成熟的 vue 模式范式)。
 *
 * ── 规矩 ──────────────────────────────────────────────────────────
 *
 * 1. 组件**只读** `getState()`,改状态一律走本文件导出的 mutator。
 *    这样「什么时候该落盘」只有一个地方要考虑。
 * 2. 落盘按草稿粒度分桶防抖。流式回答每秒改十几次,
 *    单个全局 timer 会把「上一份草稿的最后一次写入」丢掉。
 * 3. hydrate 只用 `_hydrating` 防并发,**不用** `_hydrated` 硬阻断 ——
 *    硬阻断会让首次失败后永远没有第二次机会。
 */

import {
    loadDrafts, saveDraft, deleteDraft,
    normalizeDraft, normalizeMessage, normalizeLogEntry,
} from './services/db.js';
import { normalizeCardText, readName } from './services/card-schema.js';
import { getQuestion, countQuestions } from './question-bank.js';
import { LOG_LIMIT, UNTITLED, STARTER_TEXT } from './constants.js';
import { makeId, isSameId, findById, indexById, pickTone } from './utils.js';

const TONES = ['rose', 'blush', 'plum', 'sand', 'sage', 'sky'];

function makeReactive(raw) {
    const Vue = typeof window !== 'undefined' ? window.Vue : null;
    return typeof Vue?.reactive === 'function' ? Vue.reactive(raw) : raw;
}

const STATE = makeReactive({
    ready: false,
    error: '',
    /** nook 连上了没。没连上时人设库页显示占位而不是空列表 —— 空列表会让人以为卡都没了 */
    nookReady: false,

    drafts: [],
    openDraftId: null,

    // ── 工作台 UI ───────────────────────────
    wbTab: 'ask',
    askMode: 'persona',
    composer: '',
    /** 抽屉:'quiz' 题库 | 'context' 上下文 | null */
    drawer: null,

    // ── 运行中的任务 ────────────────────────
    /** '' | 'persona' | 'advisor' | 'convert' */
    busy: '',
    streamingMessageId: null,

    // ── 导入转换 ────────────────────────────
    importSource: '',
    importResult: '',
    importError: '',

    // ── 弹窗 / 提示 ─────────────────────────
    modal: null,
});

export function getState() {
    return STATE;
}

let _app = null;
let _hydrating = false;

// ============================================================
// 派生
// ============================================================

export function getOpenDraft() {
    return findById(STATE.drafts, STATE.openDraftId);
}

/** 当前这道测题(题库没开时返回 null)。工作台顶部、prompt 都读它。 */
export function getCurrentQuiz(draft = getOpenDraft()) {
    if (!draft?.quiz?.setId) return null;
    const q = getQuestion(draft.quiz.setId, draft.quiz.index, draft.quiz.answers);
    if (!q) return null;
    return {
        setId: draft.quiz.setId,
        setName: q.setName,
        index: draft.quiz.index,
        total: q.total,
        question: q.question,
        options: q.options,
        answer: draft.quiz.answers[draft.quiz.index] || '',
    };
}

/** 正文相对「上次保存回 nook 时」变了没有 */
export function isDirty(draft = getOpenDraft()) {
    if (!draft) return false;
    if (!draft.savedAt) return Boolean(draft.text.trim());
    return normalizeCardText(draft.text) !== normalizeCardText(draft.savedText);
}

// ============================================================
// 落盘
// ============================================================

const _timers = new Map();

function persist(draftId) {
    if (!_app || !draftId) return;
    const key = String(draftId);
    if (_timers.has(key)) clearTimeout(_timers.get(key));
    _timers.set(key, setTimeout(() => {
        _timers.delete(key);
        const draft = findById(STATE.drafts, key);
        if (draft) void saveDraft(_app, draft);
    }, 450));
}

/**
 * 把挂起的写入立刻落盘。
 *
 * 必须在离开 App / 页面隐藏 / 组件卸载时调 —— 否则防抖窗口里的最后一次修改会丢。
 * 「改了没保存」这类投诉最常见的来源就是漏了这一步。
 */
export async function flushPersist() {
    const jobs = [];
    for (const [key, timer] of _timers) {
        clearTimeout(timer);
        const draft = findById(STATE.drafts, key);
        if (draft) jobs.push(saveDraft(_app, draft));
    }
    _timers.clear();
    await Promise.all(jobs);
}

function touch(draft) {
    if (!draft) return;
    draft.updatedAt = Date.now();
    persist(draft.id);
}

// ============================================================
// hydrate
// ============================================================

export async function hydrate(app) {
    if (app) _app = app;
    if (_hydrating) return;
    _hydrating = true;
    try {
        STATE.drafts = await loadDrafts(_app);
        STATE.error = '';
    } catch (err) {
        console.error('[persona-lab/store] hydrate 失败', err);
        STATE.error = err?.message || '草稿加载失败';
    } finally {
        // ★ 出错也要 ready —— 让 UI 至少能显示错误和「重试」,
        //   而不是永远停在骨架屏上(封面设计器踩过这个坑)
        STATE.ready = true;
        _hydrating = false;
    }
}

export function setNookReady(ok) {
    STATE.nookReady = Boolean(ok);
}

// ============================================================
// 草稿
// ============================================================

/**
 * 新建一份草稿。
 *
 * @param {object} patch
 * @param {'user'|'ai'} [patch.scope]
 * @param {string} [patch.personaId] 从 nook 拉过来时带上,保存时就会**覆盖**那张卡
 * @param {string} [patch.text]
 */
export async function createDraft(patch = {}) {
    const text = normalizeCardText(patch.text != null ? patch.text : STARTER_TEXT);
    const draft = normalizeDraft({
        ...patch,
        id: makeId('draft'),
        text,
        title: String(patch.title || '').trim() || readName(text) || UNTITLED,
        tone: pickTone(patch.personaId || patch.title || Date.now(), TONES),
        // 从 nook 拉过来的卡:此刻正文和卡上是一致的,所以基线就是它自己
        savedAt: patch.personaId ? Date.now() : 0,
        savedText: patch.personaId ? text : '',
    });
    STATE.drafts = [draft, ...STATE.drafts];
    await saveDraft(_app, draft);
    return draft;
}

export function openDraft(draftId) {
    if (!findById(STATE.drafts, draftId)) return false;
    STATE.openDraftId = String(draftId);
    STATE.wbTab = 'ask';
    STATE.askMode = 'persona';
    STATE.composer = '';
    STATE.drawer = null;
    return true;
}

export function closeDraft() {
    STATE.openDraftId = null;
    STATE.drawer = null;
    STATE.composer = '';
}

export async function removeDraft(draftId) {
    const index = indexById(STATE.drafts, draftId);
    if (index < 0) return false;
    STATE.drafts.splice(index, 1);
    if (isSameId(STATE.openDraftId, draftId)) closeDraft();
    _timers.delete(String(draftId));
    await deleteDraft(_app, draftId);
    return true;
}

export function updateDraft(draftId, patch = {}) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft) return null;
    Object.assign(draft, patch);
    touch(draft);
    return draft;
}

/**
 * 改正文。
 *
 * 标题跟着正文里的「姓名：」走 —— 用户在正文里改了名字,库页的卡片标题
 * 却还是老的,这种不一致是原型里「保存后列表不刷新」那类 bug 的同源问题。
 */
export function setDraftText(draftId, text) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft) return null;
    draft.text = normalizeCardText(text);
    const name = readName(draft.text);
    if (name) draft.title = name;
    touch(draft);
    return draft;
}

export function setDraftScope(draftId, scope) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft) return null;
    const next = scope === 'user' ? 'user' : 'ai';
    if (draft.scope === next) return draft;
    draft.scope = next;
    // 换了库,原来那张卡的 id 就不能用了(user0 和 ai0 是两张表里的两条记录),
    // 清掉之后下次保存会在新库里建一张,而不是去覆盖另一个库里同 id 的卡
    draft.personaId = '';
    draft.savedAt = 0;
    draft.savedText = '';
    touch(draft);
    return draft;
}

/** 保存成功后回写绑定关系 */
export function markSaved(draftId, { personaId, scope } = {}) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft) return null;
    if (personaId) draft.personaId = String(personaId);
    if (scope) draft.scope = scope;
    draft.savedAt = Date.now();
    draft.savedText = draft.text;
    touch(draft);
    return draft;
}

export function setContextSection(draftId, sectionId, enabled) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft) return;
    draft.contextConfig = { ...draft.contextConfig, [sectionId]: enabled !== false };
    touch(draft);
}

// ============================================================
// 对话
// ============================================================

export function addMessage(draftId, patch = {}) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft) return null;
    const message = normalizeMessage({ ...patch, id: patch.id || makeId('msg') });
    // pending 是运行时态,normalizeMessage 会抹掉,这里补回来
    message.pending = patch.pending === true;
    message.error = String(patch.error || '');
    draft.messages = [...draft.messages, message];
    touch(draft);
    return message;
}

export function updateMessage(draftId, messageId, patch = {}) {
    const draft = findById(STATE.drafts, draftId);
    const message = findById(draft?.messages, messageId);
    if (!message) return null;
    Object.assign(message, patch);
    draft.updatedAt = Date.now();
    // 流式过程中不落盘 —— 每秒写十几次毫无意义还拖慢生成;结束时 pending 转 false 会写一次
    if (!message.pending) persist(draft.id);
    return message;
}

export function removeMessage(draftId, messageId) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft) return false;
    draft.messages = draft.messages.filter((m) => !isSameId(m.id, messageId));
    touch(draft);
    return true;
}

export function clearMessages(draftId) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft) return false;
    draft.messages = [];
    touch(draft);
    return true;
}

// ============================================================
// 题库
// ============================================================

export function startQuiz(draftId, setId) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft) return null;
    draft.quiz = { setId: String(setId || ''), index: 0, answers: {} };
    touch(draft);
    return draft.quiz;
}

export function stopQuiz(draftId) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft) return;
    draft.quiz = { setId: '', index: 0, answers: {} };
    touch(draft);
}

/** 翻题。到头返回 false,调用方据此提示「已经是最后一题」。 */
export function stepQuiz(draftId, delta) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft?.quiz?.setId) return false;
    const total = countQuestions(draft.quiz.setId);
    const next = draft.quiz.index + delta;
    if (next < 0 || next >= total) return false;
    draft.quiz = { ...draft.quiz, index: next };
    touch(draft);
    return true;
}

export function recordQuizAnswer(draftId, answer) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft?.quiz?.setId) return;
    draft.quiz = {
        ...draft.quiz,
        answers: { ...draft.quiz.answers, [draft.quiz.index]: String(answer || '') },
    };
    touch(draft);
}

// ============================================================
// 建议 / 日志
// ============================================================

export function setSuggestion(draftId, suggestion, note = '') {
    const draft = findById(STATE.drafts, draftId);
    if (!draft) return;
    draft.suggestion = suggestion || null;
    draft.advisorNote = String(note || '');
    touch(draft);
}

export function clearSuggestion(draftId) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft) return;
    draft.suggestion = null;
    touch(draft);
}

/**
 * 记一条日志。
 *
 * `snapshot` 是**改动之前**整份正文,撤销就是把它写回去。
 * 原型的撤销是「反向套用那一条修改」,一旦用户在两次修改之间手动编辑过正文,
 * 反向套用会把手动改的部分也一起冲掉。整份快照没有这个问题。
 */
export function pushLog(draftId, entry) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft) return null;
    const record = normalizeLogEntry({ ...entry, id: makeId('log') });
    draft.log = [record, ...draft.log].slice(0, LOG_LIMIT);
    touch(draft);
    return record;
}

/** 撤到某条日志之前的样子。默认撤最近一条。 */
export function undoLog(draftId, logId) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft || !draft.log.length) return false;
    const index = logId ? indexById(draft.log, logId) : 0;
    if (index < 0) return false;
    const entry = draft.log[index];
    if (typeof entry.snapshot !== 'string' || !entry.snapshot) return false;

    draft.text = normalizeCardText(entry.snapshot);
    const name = readName(draft.text);
    if (name) draft.title = name;
    // 撤销点之前(含它自己)的记录全部作废 —— 留着它们的 snapshot 已经不成立了
    draft.log = draft.log.slice(index + 1);
    draft.suggestion = null;
    touch(draft);
    return true;
}

export function clearLog(draftId) {
    const draft = findById(STATE.drafts, draftId);
    if (!draft) return;
    draft.log = [];
    touch(draft);
}

// ============================================================
// UI 态
// ============================================================

export function setWbTab(tabId) { STATE.wbTab = String(tabId || 'ask'); }
export function setAskMode(mode) { STATE.askMode = mode === 'advisor' ? 'advisor' : 'persona'; }
export function setComposer(text) { STATE.composer = String(text ?? ''); }
export function setDrawer(id) { STATE.drawer = STATE.drawer === id ? null : (id || null); }
export function setBusy(kind) { STATE.busy = String(kind || ''); }
export function setStreamingMessage(id) { STATE.streamingMessageId = id || null; }
export function openModal(type, payload = {}) { STATE.modal = { type, payload }; }
export function closeModal() { STATE.modal = null; }

export function setImportSource(text) { STATE.importSource = String(text ?? ''); }
export function setImportResult(text) { STATE.importResult = String(text ?? ''); }
export function setImportError(text) { STATE.importError = String(text ?? ''); }

export default { getState, hydrate, flushPersist, getOpenDraft, getCurrentQuiz, isDirty };
