/**
 * 梦境编织 · 状态仓库
 *
 * 模块级 `Vue.reactive` 单例 + mutator + 防抖落盘,照 relax-app 那套(项目里最成熟的 vue 模式范式)。
 *
 * ── 规矩 ────────────────────────────────────────────────────────
 *
 * 1. 组件**只读** `getState()`,改状态一律走本文件导出的 mutator。
 *    这样「什么时候该落盘」只有一个地方要考虑。
 * 2. 落盘按对象粒度分开:改设置只写 `dwLibrary`,改正文只写**当前那一章**。
 *    原版一次写全库,流式生成时直接卡死。
 * 3. hydrate 只用 `_hydrating` 防并发,**不用** `_hydrated` 硬阻断 ——
 *    硬阻断会让首次失败后永远没有第二次机会(AGENTS2 §9.12 天气 App 的坑)。
 */

import {
    loadLibrary, saveLibrary, loadBooks, saveBook, deleteBook,
    listChapters, saveChapter, deleteChapter, migrateLegacyData,
    normalizeBook, normalizeChapter, normalizeMessage, normalizeLibrary,
    makeBranchAlt, normalizeBranchRecord,
} from './services/db.js';
import {
    createDefaultSettings, createDefaultContextConfig,
    DEFAULT_COVER_TONE, MAX_ACTIVE_MODES,
} from './constants.js';
import { makeId, isSameId, findById, indexById, debounce, moveItem, countWords, toPlain } from './utils.js';

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

    // ── 数据 ────────────────────────────────
    books: [],
    library: normalizeLibrary({}),

    /** 当前打开这本书的全部章节。切书时整体换掉,不常驻全部书的章节。 */
    chapters: [],

    // ── 路由 ────────────────────────────────
    activeTab: 'shelf',
    openBookId: null,
    openChapterId: null,

    // ── 编辑器 UI ───────────────────────────
    drawer: null,            // 'chapters' | 'context' | 'timeline' | 'tools'
    inputModeId: '',
    composerText: '',
    /** 选中文本时记录 { text, messageId } —— 选区菜单、建角色/地点都读它 */
    selection: null,
    /** 多选/格式化模式 */
    formatMode: false,

    // ── 生成 ────────────────────────────────
    /** 正在生成的任务:{ chapterId, messageId, kind, startedAt } */
    generating: null,
    /** 后台任务:切出编辑器后仍在跑的,key = chapterId */
    backgroundTasks: {},

    // ── 弹窗 / 提示 ─────────────────────────
    modal: null,             // { type, payload }
    sheet: null,             // 底部抽屉 { type, payload }

    /**
     * 全屏子页面。{ type, payload }
     *
     * 和 modal 的区别：modal 是「问一句就走」，page 是「进去待一会儿」。
     * 灵感库这种要翻、要改、要删的东西塞进 340px 宽的弹窗里，
     * 一条长灵感三行就撑满了，编辑还得再套一层弹窗。做成整页才够用。
     */
    page: null,
});

export function getState() {
    return STATE;
}

let _app = null;
let _hydrating = false;

// ============================================================
// 派生
// ============================================================

export function getOpenBook() {
    return findById(STATE.books, STATE.openBookId);
}

export function getOpenChapter() {
    return findById(STATE.chapters, STATE.openChapterId);
}

/** 按卷的顺序把章节铺平 —— 目录、上一章/下一章、前情提要都按这个顺序 */
export function getOrderedChapters(book = getOpenBook()) {
    if (!book) return [];
    const byId = new Map(STATE.chapters.map((c) => [String(c.id), c]));
    const out = [];
    for (const volume of book.volumes || []) {
        for (const chapterId of volume.chapterIds || []) {
            const chapter = byId.get(String(chapterId));
            if (chapter) {
                out.push(chapter);
                byId.delete(String(chapterId));
            }
        }
    }
    // 卷结构里没登记的章节(理论上不该有,但数据坏了要能看见,不能凭空消失)
    for (const orphan of byId.values()) out.push(orphan);
    return out;
}

export function getActiveModes() {
    const { inputModes, activeModeIds } = STATE.library;
    const out = [];
    for (const id of activeModeIds) {
        const mode = findById(inputModes, id);
        if (mode) out.push(mode);
        if (out.length >= MAX_ACTIVE_MODES) break;
    }
    return out;
}

export function getCurrentMode() {
    return findById(STATE.library.inputModes, STATE.inputModeId) || getActiveModes()[0] || null;
}

export function getSettings() {
    return STATE.library.settings;
}

export function getBookWordCount(bookId) {
    if (!isSameId(bookId, STATE.openBookId)) return 0;   // 只有打开的书才有章节在内存里
    return STATE.chapters.reduce(
        (sum, chapter) => sum + chapter.messages.reduce((s, m) => s + (m.role === 'note' ? 0 : countWords(m.content)), 0),
        0,
    );
}

export function getChapterWordCount(chapter) {
    if (!chapter) return 0;
    return chapter.messages.reduce((s, m) => s + (m.role === 'note' ? 0 : countWords(m.content)), 0);
}

// ============================================================
// 落盘
// ============================================================

const persistLibrary = debounce(() => {
    if (!_app) return;
    void saveLibrary(_app, STATE.library);
}, 500);

/**
 * 章节落盘按 id 分桶防抖。
 *
 * 为什么不能只用一个全局防抖:流式生成时用户可能切章,
 * 单个 timer 会把「上一章的最后一次写入」丢掉。每章一个 timer 才安全。
 */
const _chapterTimers = new Map();

function persistChapter(chapterId) {
    if (!_app || !chapterId) return;
    const key = String(chapterId);
    if (_chapterTimers.has(key)) clearTimeout(_chapterTimers.get(key));
    _chapterTimers.set(
        key,
        setTimeout(() => {
            _chapterTimers.delete(key);
            const chapter = findById(STATE.chapters, key);
            if (chapter) void saveChapter(_app, chapter);
        }, 400),
    );
}

const persistBookDebounced = new Map();

function persistBook(bookId) {
    if (!_app || !bookId) return;
    const key = String(bookId);
    if (persistBookDebounced.has(key)) clearTimeout(persistBookDebounced.get(key));
    persistBookDebounced.set(
        key,
        setTimeout(() => {
            persistBookDebounced.delete(key);
            const book = findById(STATE.books, key);
            if (book) void saveBook(_app, book);
        }, 400),
    );
}

/**
 * 立刻把所有挂起的写入落盘。
 *
 * 必须在离开 App / 页面隐藏 / 组件卸载时调 —— 否则防抖窗口里的最后一次修改会丢。
 * 这是「改了没保存」这类投诉最常见的来源。
 */
export async function flushPersist() {
    persistLibrary.flush();

    const jobs = [];
    for (const [key, timer] of _chapterTimers) {
        clearTimeout(timer);
        const chapter = findById(STATE.chapters, key);
        if (chapter) jobs.push(saveChapter(_app, chapter));
    }
    _chapterTimers.clear();

    for (const [key, timer] of persistBookDebounced) {
        clearTimeout(timer);
        const book = findById(STATE.books, key);
        if (book) jobs.push(saveBook(_app, book));
    }
    persistBookDebounced.clear();

    await Promise.all(jobs);
}

// ============================================================
// hydrate
// ============================================================

export async function hydrate(app) {
    if (app) _app = app;
    if (_hydrating) return;
    _hydrating = true;
    try {
        const library = await loadLibrary(_app);
        STATE.library = library;

        let books = await loadBooks(_app);
        // 空库时试一次旧版迁移。有书就跳过 —— 用户已经在新版里创作了,不能覆盖。
        if (books.length === 0) {
            const result = await migrateLegacyData(_app);
            if (result.migrated) {
                books = await loadBooks(_app);
                if (result.library) STATE.library = result.library;
            }
        }
        STATE.books = books;

        if (!STATE.inputModeId) {
            STATE.inputModeId = STATE.library.activeModeIds[0] || '';
        }
        STATE.ready = true;
        STATE.error = '';
    } catch (err) {
        console.error('[dream-weaver/store] hydrate 失败', err);
        STATE.error = err?.message || '数据加载失败';
        // ★ 不设 ready=false 就走人 —— 让 UI 至少能显示错误和「重试」,
        //   而不是永远停在骨架屏上(封面设计器踩过这个坑)
        STATE.ready = true;
    } finally {
        _hydrating = false;
    }
}

// ============================================================
// 路由
// ============================================================

export function setTab(tabId) {
    STATE.activeTab = String(tabId || 'shelf');
}

export async function openBook(bookId) {
    const book = findById(STATE.books, bookId);
    if (!book) return false;
    STATE.openBookId = book.id;
    STATE.chapters = await listChapters(_app, book.id);

    // 打开时定位到最后编辑的那一章;没有就第一章;一章都没有就自动建一章,
    // 免得用户进来面对一个什么都点不了的空编辑器。
    const ordered = getOrderedChapters(book);
    if (ordered.length === 0) {
        await addChapter({ silent: true });
    } else {
        const latest = ordered.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
        STATE.openChapterId = latest.id;
    }
    STATE.drawer = null;
    return true;
}

export function closeBook() {
    STATE.openBookId = null;
    STATE.openChapterId = null;
    STATE.chapters = [];
    STATE.drawer = null;
    STATE.selection = null;
    STATE.formatMode = false;
}

export function openChapter(chapterId) {
    if (!findById(STATE.chapters, chapterId)) return;
    STATE.openChapterId = String(chapterId);
    STATE.selection = null;
    STATE.formatMode = false;
}

/** 上一章 / 下一章。到头返回 false,调用方据此给「已经是第一章」的提示。 */
export function stepChapter(delta) {
    const ordered = getOrderedChapters();
    const index = indexById(ordered, STATE.openChapterId);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= ordered.length) return false;
    openChapter(ordered[next].id);
    return true;
}

export function setDrawer(panelId) {
    STATE.drawer = STATE.drawer === panelId ? null : (panelId || null);
}

// ============================================================
// 书籍
// ============================================================

export async function createBook(patch = {}) {
    const volumeId = makeId('vol');
    const book = normalizeBook({
        ...patch,
        id: makeId('book'),
        coverTone: patch.coverTone || DEFAULT_COVER_TONE,
        volumes: [{ id: volumeId, name: '第一卷', chapterIds: [] }],
        contextConfig: createDefaultContextConfig(),
    });
    STATE.books = [book, ...STATE.books];
    await saveBook(_app, book);
    return book;
}

export function updateBook(bookId, patch = {}) {
    const book = findById(STATE.books, bookId);
    if (!book) return null;
    Object.assign(book, patch, { updatedAt: Date.now() });
    persistBook(book.id);
    return book;
}

export async function removeBook(bookId) {
    const index = indexById(STATE.books, bookId);
    if (index < 0) return false;
    STATE.books.splice(index, 1);
    if (isSameId(STATE.openBookId, bookId)) closeBook();
    await deleteBook(_app, bookId);
    return true;
}

// ── 角色 / 地点 ────────────────────────────

export function addCharacter(bookId, patch = {}) {
    const book = findById(STATE.books, bookId);
    if (!book) return null;
    const character = { ...patch, id: makeId('char') };
    book.characters = [...book.characters, character];
    persistBook(book.id);
    return character;
}

export function updateCharacter(bookId, characterId, patch = {}) {
    const book = findById(STATE.books, bookId);
    const character = findById(book?.characters, characterId);
    if (!character) return null;
    Object.assign(character, patch);
    persistBook(book.id);
    return character;
}

export function removeCharacter(bookId, characterId) {
    const book = findById(STATE.books, bookId);
    if (!book) return false;
    book.characters = book.characters.filter((c) => !isSameId(c.id, characterId));
    persistBook(book.id);
    return true;
}

export function addLocation(bookId, patch = {}) {
    const book = findById(STATE.books, bookId);
    if (!book) return null;
    const location = { ...patch, id: makeId('loc') };
    book.locations = [...book.locations, location];
    persistBook(book.id);
    return location;
}

export function updateLocation(bookId, locationId, patch = {}) {
    const book = findById(STATE.books, bookId);
    const location = findById(book?.locations, locationId);
    if (!location) return null;
    Object.assign(location, patch);
    persistBook(book.id);
    return location;
}

export function removeLocation(bookId, locationId) {
    const book = findById(STATE.books, bookId);
    if (!book) return false;
    book.locations = book.locations.filter((l) => !isSameId(l.id, locationId));
    persistBook(book.id);
    return true;
}

// ── 上下文开关 ─────────────────────────────

/**
 * 切换某段上下文是否进 prompt。
 *
 * ★ 这是原版最严重那个 bug 的修复点:原版这个开关只影响预览面板,
 *   `buildPrompt` 根本不读 `contextConfig`。现在预览和发送共用
 *   `buildContextParts()`,而它的唯一开关来源就是这里。
 */
export function setContextSection(bookId, sectionId, enabled) {
    const book = findById(STATE.books, bookId);
    if (!book) return;
    book.contextConfig = { ...book.contextConfig, [sectionId]: enabled !== false };
    persistBook(book.id);
}

export function setContextOrder(bookId, order) {
    const book = findById(STATE.books, bookId);
    if (!book) return;
    book.contextOrder = Array.isArray(order) ? order.map(String) : [];
    persistBook(book.id);
}

// ============================================================
// 卷 / 章
// ============================================================

export function addVolume(name = '') {
    const book = getOpenBook();
    if (!book) return null;
    const volume = { id: makeId('vol'), name: name || `第${book.volumes.length + 1}卷`, chapterIds: [] };
    book.volumes = [...book.volumes, volume];
    persistBook(book.id);
    return volume;
}

export function updateVolume(volumeId, patch = {}) {
    const book = getOpenBook();
    const volume = findById(book?.volumes, volumeId);
    if (!volume) return null;
    Object.assign(volume, patch);
    persistBook(book.id);
    return volume;
}

/**
 * 删卷。卷里的章节**移到前一卷**而不是一起删 ——
 * 「整理目录结构」不该等于「毁掉三万字」。只有卷为空时才是纯删除。
 */
export async function removeVolume(volumeId) {
    const book = getOpenBook();
    if (!book || book.volumes.length <= 1) return false;
    const index = indexById(book.volumes, volumeId);
    if (index < 0) return false;
    const volume = book.volumes[index];
    const fallback = book.volumes[index - 1] || book.volumes[index + 1];
    if (fallback && volume.chapterIds.length) {
        fallback.chapterIds = [...fallback.chapterIds, ...volume.chapterIds];
        for (const chapterId of volume.chapterIds) {
            const chapter = findById(STATE.chapters, chapterId);
            if (chapter) {
                chapter.volumeId = fallback.id;
                persistChapter(chapter.id);
            }
        }
    }
    book.volumes.splice(index, 1);
    persistBook(book.id);
    return true;
}

export async function addChapter({ volumeId, title, silent = false } = {}) {
    const book = getOpenBook();
    if (!book) return null;
    const volume = findById(book.volumes, volumeId) || book.volumes[book.volumes.length - 1];
    if (!volume) return null;

    const chapter = normalizeChapter(
        {
            id: makeId('ch'),
            volumeId: volume.id,
            title: title || `第${getOrderedChapters(book).length + 1}章`,
        },
        book.id,
    );

    STATE.chapters = [...STATE.chapters, chapter];
    volume.chapterIds = [...volume.chapterIds, chapter.id];
    if (!silent) STATE.openChapterId = chapter.id;
    else if (!STATE.openChapterId) STATE.openChapterId = chapter.id;

    await saveChapter(_app, chapter);
    persistBook(book.id);
    return chapter;
}

export function updateChapter(chapterId, patch = {}) {
    const chapter = findById(STATE.chapters, chapterId);
    if (!chapter) return null;
    Object.assign(chapter, patch, { updatedAt: Date.now() });
    persistChapter(chapter.id);
    return chapter;
}

export async function removeChapter(chapterId) {
    const book = getOpenBook();
    const index = indexById(STATE.chapters, chapterId);
    if (!book || index < 0) return false;

    STATE.chapters.splice(index, 1);
    for (const volume of book.volumes) {
        volume.chapterIds = volume.chapterIds.filter((id) => !isSameId(id, chapterId));
    }

    if (isSameId(STATE.openChapterId, chapterId)) {
        const ordered = getOrderedChapters(book);
        STATE.openChapterId = ordered[Math.min(index, ordered.length - 1)]?.id || null;
        // 删光了就补一章空的,不要让编辑器进入「没有章节」的死状态
        if (!STATE.openChapterId) await addChapter({ silent: true });
    }

    persistBook(book.id);
    await deleteChapter(_app, chapterId);
    return true;
}

/** 在目录里拖动章节:可以跨卷 */
export function moveChapter(chapterId, targetVolumeId, targetIndex) {
    const book = getOpenBook();
    const chapter = findById(STATE.chapters, chapterId);
    const targetVolume = findById(book?.volumes, targetVolumeId);
    if (!book || !chapter || !targetVolume) return false;

    for (const volume of book.volumes) {
        volume.chapterIds = volume.chapterIds.filter((id) => !isSameId(id, chapterId));
    }
    const ids = targetVolume.chapterIds.slice();
    ids.splice(Math.max(0, Math.min(targetIndex, ids.length)), 0, chapter.id);
    targetVolume.chapterIds = ids;
    chapter.volumeId = targetVolume.id;

    persistBook(book.id);
    persistChapter(chapter.id);
    return true;
}

// ============================================================
// 消息
// ============================================================

export function addMessage(chapterId, patch = {}) {
    const chapter = findById(STATE.chapters, chapterId);
    if (!chapter) return null;
    const message = normalizeMessage({ ...patch, id: patch.id || makeId('msg') });
    chapter.messages = [...chapter.messages, message];
    chapter.updatedAt = Date.now();
    persistChapter(chapter.id);
    return message;
}

export function updateMessage(chapterId, messageId, patch = {}) {
    const chapter = findById(STATE.chapters, chapterId);
    const message = findById(chapter?.messages, messageId);
    if (!message) return null;
    Object.assign(message, patch);
    chapter.updatedAt = Date.now();
    // pending 期间不落盘 —— 流式每秒改十几次,写盘毫无意义还拖慢生成
    if (!message.pending) persistChapter(chapter.id);
    return message;
}

export function removeMessage(chapterId, messageId) {
    const chapter = findById(STATE.chapters, chapterId);
    if (!chapter) return false;
    chapter.messages = chapter.messages.filter((m) => !isSameId(m.id, messageId));
    // 这条文段自己的分叉清掉;别人路上 tail 里若还指着它,也一并摘掉
    if (chapter.branches) {
        const next = { ...chapter.branches };
        delete next[messageId];
        delete next[String(messageId)];
        chapter.branches = next;
    }
    stripMessageFromTails(chapter, messageId);
    chapter.updatedAt = Date.now();
    persistChapter(chapter.id);
    return true;
}

/**
 * 丢掉某条之后的全部消息。重 roll 中间一段时,后面那些回复是接着旧稿写的,
 * 留着会和新政文对不上。
 *
 * 那些文段的分支记录不要删 —— 已经打进未激活那路的 tail,切回去还要用。
 */
export function removeMessagesAfter(chapterId, messageId) {
    const chapter = findById(STATE.chapters, chapterId);
    if (!chapter) return 0;
    const index = chapter.messages.findIndex((m) => isSameId(m.id, messageId));
    if (index < 0 || index >= chapter.messages.length - 1) return 0;
    const dropped = chapter.messages.slice(index + 1);
    chapter.messages = chapter.messages.slice(0, index + 1);
    chapter.updatedAt = Date.now();
    persistChapter(chapter.id);
    return dropped.length;
}

export function toggleMessageFavorite(chapterId, messageId) {
    const chapter = findById(STATE.chapters, chapterId);
    const message = findById(chapter?.messages, messageId);
    if (!message) return false;
    message.favorite = !message.favorite;

    // 收藏夹是 library 级的,和消息本身是两份数据 —— 两边都要动。
    // 原版这里只加了个 CSS class,刷新就没了(和 AGENTS2 §9.6 朋友圈收藏同款坑)。
    if (message.favorite) {
        STATE.library.collected = [
            {
                id: makeId('fav'),
                messageId: message.id,
                chapterId: chapter.id,
                bookId: chapter.bookId,
                content: message.content,
                createdAt: Date.now(),
            },
            ...STATE.library.collected,
        ];
    } else {
        STATE.library.collected = STATE.library.collected.filter((c) => !isSameId(c.messageId, message.id));
    }

    persistChapter(chapter.id);
    persistLibrary();
    return message.favorite;
}

// ── 分支 ───────────────────────────────────

function getChapterBranch(chapter, messageId) {
    if (!chapter.branches || typeof chapter.branches !== 'object') {
        chapter.branches = {};
    }
    const key = String(messageId);
    const current = chapter.branches[key];
    if (current && Array.isArray(current.alternatives) && current.alternatives.every((a) => a && a.id)) {
        return current;
    }
    const next = normalizeBranchRecord(current);
    chapter.branches = { ...chapter.branches, [key]: next };
    return next;
}

function snapshotTail(chapter, messageIndex) {
    const rest = chapter.messages.slice(messageIndex + 1);
    return toPlain(rest.map((m) => normalizeMessage({ ...m, pending: false, error: '' }))) || [];
}

function stripMessageFromTails(chapter, messageId) {
    const branches = chapter.branches || {};
    for (const branch of Object.values(branches)) {
        for (const alt of branch.alternatives || []) {
            if (!Array.isArray(alt.tail) || !alt.tail.length) continue;
            alt.tail = alt.tail.filter((m) => !isSameId(m.id, messageId));
        }
    }
}

function resolveAltIndex(branch, altIdOrIndex) {
    if (typeof altIdOrIndex === 'number' && Number.isFinite(altIdOrIndex)) {
        return altIdOrIndex;
    }
    return branch.alternatives.findIndex((a) => isSameId(a.id, altIdOrIndex));
}

/**
 * 把当前这一路存进对应版本(正文 + 后面的文段),为重 roll / 建分支点腾位置。
 */
export function pushBranch(chapterId, messageId) {
    const chapter = findById(STATE.chapters, chapterId);
    const index = indexById(chapter?.messages, messageId);
    if (index < 0) return null;
    const message = chapter.messages[index];
    const branch = getChapterBranch(chapter, messageId);
    const tail = snapshotTail(chapter, index);
    // 旧存档没有 tail。第一次记下这一路时,把当前后面的文段补到还空着的版本上,
    // 免得切到旧版本把后面整段抹掉。
    for (const alt of branch.alternatives) {
        if (!(alt.tail || []).length) alt.tail = tail;
    }

    const existingIdx = branch.alternatives.findIndex((a) => a.content === message.content);
    if (existingIdx >= 0) {
        branch.currentIndex = existingIdx;
        branch.alternatives[existingIdx].tail = tail;
    } else {
        const alt = makeBranchAlt({
            content: message.content,
            createdAt: message.timestamp || Date.now(),
            tail,
        });
        branch.alternatives = [...branch.alternatives, alt];
        branch.currentIndex = branch.alternatives.length - 1;
    }

    chapter.branches = { ...chapter.branches, [String(messageId)]: branch };
    chapter.updatedAt = Date.now();
    persistChapter(chapter.id);
    return branch;
}

export function commitBranch(chapterId, messageId, content) {
    const chapter = findById(STATE.chapters, chapterId);
    const message = findById(chapter?.messages, messageId);
    if (!message) return null;

    const branch = getChapterBranch(chapter, messageId);
    const text = String(content || '');
    const index = indexById(chapter.messages, messageId);
    const tail = index >= 0 ? snapshotTail(chapter, index) : [];
    const existingIdx = branch.alternatives.findIndex((a) => a.content === text);
    if (existingIdx >= 0) {
        branch.currentIndex = existingIdx;
        branch.alternatives[existingIdx].tail = tail;
    } else {
        branch.alternatives = [...branch.alternatives, makeBranchAlt({ content: text, tail })];
        branch.currentIndex = branch.alternatives.length - 1;
    }
    message.content = text;
    chapter.branches = { ...chapter.branches, [String(messageId)]: branch };
    chapter.updatedAt = Date.now();
    persistChapter(chapter.id);
    return branch;
}

/**
 * 切到另一路:先把当前正文和后面的文段存回当前版本,再恢复目标版本。
 * @param {string|number} altIdOrIndex
 */
export function switchBranch(chapterId, messageId, altIdOrIndex) {
    const chapter = findById(STATE.chapters, chapterId);
    const index = indexById(chapter?.messages, messageId);
    if (index < 0) return false;
    const message = chapter.messages[index];
    const branch = getChapterBranch(chapter, messageId);
    const nextIndex = resolveAltIndex(branch, altIdOrIndex);
    const target = branch.alternatives[nextIndex];
    if (!target) return false;
    if (nextIndex === branch.currentIndex) return true;

    const usesTail = branch.alternatives.some((a) => (a.tail || []).length > 0);
    const cur = branch.alternatives[branch.currentIndex];
    if (cur) {
        cur.content = message.content;
        if (usesTail) cur.tail = snapshotTail(chapter, index);
    }

    message.content = target.content;
    message.pending = false;
    message.error = '';
    if (usesTail) {
        const keep = chapter.messages.slice(0, index + 1);
        const restored = (target.tail || []).map((m) => normalizeMessage({ ...m, pending: false, error: '' }));
        chapter.messages = [...keep, ...restored];
    }
    branch.currentIndex = nextIndex;
    chapter.updatedAt = Date.now();
    persistChapter(chapter.id);
    return true;
}

export function renameBranchAlt(chapterId, messageId, altId, name) {
    const chapter = findById(STATE.chapters, chapterId);
    if (!chapter) return false;
    const branch = getChapterBranch(chapter, messageId);
    const alt = branch.alternatives.find((a) => isSameId(a.id, altId));
    if (!alt) return false;
    alt.name = String(name || '').trim().slice(0, 16);
    chapter.updatedAt = Date.now();
    persistChapter(chapter.id);
    return true;
}

/**
 * 删一条岔路。只剩一路时等同删掉这段文段,和编辑器里删气泡同步。
 */
export function removeBranchAlt(chapterId, messageId, altId) {
    const chapter = findById(STATE.chapters, chapterId);
    if (!chapter) return false;
    let branch = getChapterBranch(chapter, messageId);
    const idx = branch.alternatives.findIndex((a) => isSameId(a.id, altId));
    if (idx < 0) return false;

    if (branch.alternatives.length <= 1) {
        return removeMessage(chapterId, messageId);
    }

    if (idx === branch.currentIndex) {
        const fallback = idx === 0 ? 1 : idx - 1;
        switchBranch(chapterId, messageId, fallback);
        branch = getChapterBranch(chapter, messageId);
    }

    const currentId = branch.alternatives[branch.currentIndex]?.id;
    branch.alternatives = branch.alternatives.filter((a) => !isSameId(a.id, altId));
    const nextIndex = branch.alternatives.findIndex((a) => isSameId(a.id, currentId));
    branch.currentIndex = nextIndex >= 0 ? nextIndex : 0;
    chapter.branches = { ...chapter.branches, [String(messageId)]: branch };
    chapter.updatedAt = Date.now();
    persistChapter(chapter.id);
    return true;
}

/** 手动改完正文后,把当前版本的 content 对齐,免得切走再切回来丢改动。 */
export function syncCurrentAltContent(chapterId, messageId) {
    const chapter = findById(STATE.chapters, chapterId);
    const message = findById(chapter?.messages, messageId);
    if (!message || !chapter?.branches?.[messageId]) return false;
    const branch = getChapterBranch(chapter, messageId);
    const cur = branch.alternatives[branch.currentIndex];
    if (!cur) return false;
    cur.content = message.content;
    persistChapter(chapter.id);
    return true;
}

export function getBranch(chapterId, messageId) {
    const chapter = findById(STATE.chapters, chapterId);
    if (!chapter) return null;
    const raw = chapter.branches?.[messageId];
    return raw ? normalizeBranchRecord(raw) : null;
}

// ============================================================
// 生成状态
// ============================================================

export function beginGenerating(task) {
    STATE.generating = { startedAt: Date.now(), ...task };
}

export function endGenerating() {
    STATE.generating = null;
}

export function isGenerating(chapterId) {
    if (!STATE.generating) return false;
    if (!chapterId) return true;
    return isSameId(STATE.generating.chapterId, chapterId);
}

// ============================================================
// 设置 / 库
// ============================================================

export function updateSettings(patch = {}) {
    STATE.library.settings = { ...STATE.library.settings, ...patch };
    persistLibrary();
}

export function updateDisplaySettings(patch = {}) {
    STATE.library.settings.displaySettings = { ...STATE.library.settings.displaySettings, ...patch };
    persistLibrary();
}

export function resetSettings() {
    STATE.library.settings = createDefaultSettings();
    persistLibrary();
}

// ── 主题 ───────────────────────────────────

/**
 * 应用一套主题。
 *
 * @param {object} opts
 * @param {string} opts.baseThemeId    'retro-dark' | 'oriental-light'
 * @param {object} [opts.customColors] 在预设之上的改动,空对象表示纯内置主题
 * @param {string} [opts.customThemeId] 来自哪个已保存主题(用于列表高亮)
 */
export function applyTheme({ baseThemeId, customColors = {}, customThemeId = '' } = {}) {
    STATE.library.settings.theme = baseThemeId === 'oriental-light' ? 'oriental-light' : 'retro-dark';
    STATE.library.settings.customThemeColors = { ...(customColors || {}) };
    STATE.library.settings.activeCustomThemeId = String(customThemeId || '');
    persistLibrary();
}

export function saveCustomTheme({ name, baseThemeId, colors }) {
    const theme = {
        id: makeId('theme'),
        name: String(name || '自定义主题'),
        baseThemeId: baseThemeId === 'oriental-light' ? 'oriental-light' : 'retro-dark',
        colors: { ...(colors || {}) },
        createdAt: Date.now(),
    };
    STATE.library.settings.customThemes = [...(STATE.library.settings.customThemes || []), theme];
    // 存完直接应用,否则用户点了「保存」还得再点一次「应用」
    applyTheme({ baseThemeId: theme.baseThemeId, customColors: theme.colors, customThemeId: theme.id });
    return theme;
}

/**
 * 改一套已保存主题：改名、或者用当前配色覆盖它。
 *
 * 以前只有「存为新主题」，改一版就多存一条，几次之后列表里躺着五六个
 * 「自定义主题」「自定义主题2」，谁也认不出哪个是哪个。
 */
export function updateCustomTheme(themeId, patch = {}) {
    const settings = STATE.library.settings;
    const theme = (settings.customThemes || []).find((t) => isSameId(t.id, themeId));
    if (!theme) return null;
    if (typeof patch.name === 'string') theme.name = patch.name.trim() || theme.name;
    if (patch.colors && typeof patch.colors === 'object') theme.colors = { ...patch.colors };
    if (patch.baseThemeId) theme.baseThemeId = patch.baseThemeId === 'oriental-light' ? 'oriental-light' : 'retro-dark';
    theme.updatedAt = Date.now();
    // 改的正是当前生效的那套 → 顺手让它立刻生效，不用再点一次应用
    if (isSameId(settings.activeCustomThemeId, themeId)) {
        applyTheme({ baseThemeId: theme.baseThemeId, customColors: theme.colors, customThemeId: theme.id });
    } else {
        persistLibrary();
    }
    return theme;
}

export function removeCustomTheme(themeId) {
    const settings = STATE.library.settings;
    settings.customThemes = (settings.customThemes || []).filter((t) => !isSameId(t.id, themeId));
    // 删的正是当前用着的那套 → 回到它的基础内置主题
    if (isSameId(settings.activeCustomThemeId, themeId)) {
        applyTheme({ baseThemeId: settings.theme, customColors: {}, customThemeId: '' });
        return;
    }
    persistLibrary();
}

// ── 输入模式 ───────────────────────────────

export function addInputMode(patch = {}) {
    const mode = { id: makeId('mode'), isPreset: false, recentN: 5, historyStrategy: 'latest_only', ...patch };
    STATE.library.inputModes = [...STATE.library.inputModes, mode];
    persistLibrary();
    return mode;
}

export function updateInputMode(modeId, patch = {}) {
    const mode = findById(STATE.library.inputModes, modeId);
    if (!mode) return null;
    Object.assign(mode, patch);
    persistLibrary();
    return mode;
}

export function removeInputMode(modeId) {
    const mode = findById(STATE.library.inputModes, modeId);
    if (!mode || mode.isPreset) return false;   // 预设模式不给删,删了没法恢复
    STATE.library.inputModes = STATE.library.inputModes.filter((m) => !isSameId(m.id, modeId));
    STATE.library.activeModeIds = STATE.library.activeModeIds.filter((id) => !isSameId(id, modeId));
    if (isSameId(STATE.inputModeId, modeId)) STATE.inputModeId = STATE.library.activeModeIds[0] || '';
    persistLibrary();
    return true;
}

export function toggleActiveMode(modeId) {
    const ids = STATE.library.activeModeIds;
    const key = String(modeId);
    if (ids.includes(key)) {
        if (ids.length <= 1) return false;      // 至少留一个,否则输入栏没法用
        STATE.library.activeModeIds = ids.filter((id) => id !== key);
    } else {
        if (ids.length >= MAX_ACTIVE_MODES) return false;
        STATE.library.activeModeIds = [...ids, key];
    }
    if (!STATE.library.activeModeIds.includes(STATE.inputModeId)) {
        STATE.inputModeId = STATE.library.activeModeIds[0] || '';
    }
    persistLibrary();
    return true;
}

export function setInputMode(modeId) {
    STATE.inputModeId = String(modeId || '');
}

export function reorderActiveModes(from, to) {
    STATE.library.activeModeIds = moveItem(STATE.library.activeModeIds, from, to);
    persistLibrary();
}

// ── 正则规则 ───────────────────────────────

export function addBubbleRule(patch = {}) {
    const rule = { id: makeId('rule'), enabled: true, flags: 'g', kind: 'dialogue', ...patch };
    STATE.library.bubbleRules = [...STATE.library.bubbleRules, rule];
    persistLibrary();
    return rule;
}

export function updateBubbleRule(ruleId, patch = {}) {
    const rule = findById(STATE.library.bubbleRules, ruleId);
    if (!rule) return null;
    Object.assign(rule, patch);
    persistLibrary();
    return rule;
}

export function removeBubbleRule(ruleId) {
    STATE.library.bubbleRules = STATE.library.bubbleRules.filter((r) => !isSameId(r.id, ruleId));
    persistLibrary();
}

// ── 灵感 / 收藏 / 场景 / 历史 ───────────────

export function addInspiration(content) {
    const text = String(content || '').trim();
    if (!text) return null;
    const note = { id: makeId('insp'), content: text, createdAt: Date.now(), updatedAt: Date.now() };
    STATE.library.inspirations = [note, ...STATE.library.inspirations];
    persistLibrary();
    return note;
}

export function updateInspiration(id, content) {
    const note = findById(STATE.library.inspirations, id);
    if (!note) return null;
    note.content = String(content || '');
    note.updatedAt = Date.now();
    persistLibrary();
    return note;
}

export function removeInspiration(id) {
    STATE.library.inspirations = STATE.library.inspirations.filter((n) => !isSameId(n.id, id));
    persistLibrary();
}

export function removeCollected(id) {
    const entry = findById(STATE.library.collected, id);
    STATE.library.collected = STATE.library.collected.filter((c) => !isSameId(c.id, id));
    // 同步把消息上的收藏标记摘掉,否则气泡上的星还亮着
    if (entry) {
        const chapter = findById(STATE.chapters, entry.chapterId);
        const message = findById(chapter?.messages, entry.messageId);
        if (message) {
            message.favorite = false;
            persistChapter(chapter.id);
        }
    }
    persistLibrary();
}

export function addScene(patch = {}) {
    const scene = { id: makeId('scene'), createdAt: Date.now(), ...patch };
    STATE.library.scenes = [scene, ...STATE.library.scenes];
    persistLibrary();
    return scene;
}

export function updateScene(id, patch = {}) {
    const scene = findById(STATE.library.scenes, id);
    if (!scene) return null;
    Object.assign(scene, patch);
    persistLibrary();
    return scene;
}

export function removeScene(id) {
    STATE.library.scenes = STATE.library.scenes.filter((s) => !isSameId(s.id, id));
    persistLibrary();
}

export function addGeneratedRecord(record) {
    const entry = { id: makeId('gen'), createdAt: Date.now(), ...record };
    // 只留最近 100 条 —— 生成历史是「翻一翻」用的,不是归档,无限增长会把库撑爆
    STATE.library.generatedHistory = [entry, ...STATE.library.generatedHistory].slice(0, 100);
    persistLibrary();
    return entry;
}

export function removeGeneratedRecord(id) {
    STATE.library.generatedHistory = STATE.library.generatedHistory.filter((g) => !isSameId(g.id, id));
    persistLibrary();
}

// ============================================================
// 时间线
// ============================================================

export function addTimelineEvent(bookId, patch = {}) {
    const book = findById(STATE.books, bookId);
    if (!book) return null;
    const event = {
        id: makeId('evt'),
        time: '',
        title: '',
        description: '',
        bindType: 'none',
        chapterId: null,
        messageId: null,
        includeInPrompt: true,
        createdAt: Date.now(),
        ...patch,
    };
    book.timelineEvents = [...book.timelineEvents, event];
    persistBook(book.id);
    return event;
}

export function updateTimelineEvent(bookId, eventId, patch = {}) {
    const book = findById(STATE.books, bookId);
    const event = findById(book?.timelineEvents, eventId);
    if (!event) return null;
    Object.assign(event, patch, { updatedAt: Date.now() });
    persistBook(book.id);
    return event;
}

export function removeTimelineEvent(bookId, eventId) {
    const book = findById(STATE.books, bookId);
    if (!book) return false;
    book.timelineEvents = book.timelineEvents.filter((e) => !isSameId(e.id, eventId));
    persistBook(book.id);
    return true;
}

/** 用户自己排时间线。delta = -1 上移 / +1 下移,到头就不动。 */
export function moveTimelineEvent(bookId, eventId, delta) {
    const book = findById(STATE.books, bookId);
    if (!book) return false;
    const list = book.timelineEvents || [];
    const from = list.findIndex((e) => isSameId(e.id, eventId));
    const to = from + Number(delta);
    if (from < 0 || to < 0 || to >= list.length) return false;
    const next = list.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    book.timelineEvents = next;
    persistBook(book.id);
    return true;
}

/**
 * 推进 / 回退故事时间(顶栏时间线齿轮每咔哒一下走一天)。
 *
 * 照抄原版 `advanceWorldTime`(12194):解析 `YYYY年M月D日`,解析不出来就从今天起算,
 * 加减天数后写回同样的格式。
 */
export function advanceWorldTime(bookId, days) {
    const book = findById(STATE.books, bookId);
    if (!book) return '';

    const match = String(book.worldTime || '').match(/(\d+)年(\d+)月(\d+)日/);
    const date = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        : new Date();

    date.setDate(date.getDate() + days);
    const next = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    book.worldTime = next;
    book.updatedAt = Date.now();
    persistBook(book.id);
    return next;
}

// ============================================================
// 杀青梗卡片
// ============================================================

/**
 * `book.finaleCards` 形状:`{ weibo: Topic[], groupchat: Chat[], twitter: [], review: [], forum: [] }`
 *
 * 原版这些卡片是**用户手填**的(`generateWeiboTopic` 之类只造空壳,不调 AI),
 * 所以这里的 mutator 全是「加一个空的 / 改某个字段 / 删掉」这种细粒度操作。
 * AI 填充走 `services/finale-service.js`,填完再调这里的 `setFinaleCards` 写回。
 */
export function getFinaleCards(bookId, type) {
    const book = findById(STATE.books, bookId);
    return book?.finaleCards?.[type] || [];
}

export function setFinaleCards(bookId, type, cards) {
    const book = findById(STATE.books, bookId);
    if (!book) return;
    book.finaleCards = { ...(book.finaleCards || {}), [type]: cards };
    book.updatedAt = Date.now();
    persistBook(book.id);
}

/** 改卡片树里某一处 —— 传一个纯函数,拿到当前数组返回新数组 */
export function updateFinaleCards(bookId, type, updater) {
    const current = getFinaleCards(bookId, type);
    const next = updater(JSON.parse(JSON.stringify(current)));
    if (next) setFinaleCards(bookId, type, next);
    return next;
}

/** 收藏当前这组卡片(原版 `saveFinaleCards`:深拷贝 push 进 savedFinaleCards,可重复累积) */
export function archiveFinaleCards(bookId, type) {
    const book = findById(STATE.books, bookId);
    if (!book) return 0;
    const cards = getFinaleCards(bookId, type);
    if (cards.length === 0) return 0;
    const saved = book.savedFinaleCards || {};
    const list = saved[type] || [];
    book.savedFinaleCards = {
        ...saved,
        [type]: [...list, ...JSON.parse(JSON.stringify(cards)).map((c) => ({ ...c, savedAt: Date.now() }))],
    };
    persistBook(book.id);
    return cards.length;
}

// ============================================================
// IF 线
// ============================================================

export function addIfArchive(bookId, patch) {
    const book = findById(STATE.books, bookId);
    if (!book) return null;
    const archive = { id: makeId('iftext'), createdAt: Date.now(), ...patch };
    book.ifLineArchives = [archive, ...(book.ifLineArchives || [])];
    persistBook(book.id);
    return archive;
}

export function removeIfArchive(bookId, archiveId) {
    const book = findById(STATE.books, bookId);
    if (!book) return;
    book.ifLineArchives = (book.ifLineArchives || []).filter((a) => !isSameId(a.id, archiveId));
    persistBook(book.id);
}

/** 改存档的标题 / 正文。工作台里改完直接覆盖同一条，不再堆出一堆近似的版本。 */
export function updateIfArchive(bookId, archiveId, patch = {}) {
    const book = findById(STATE.books, bookId);
    if (!book) return null;
    const archive = findById(book.ifLineArchives, archiveId);
    if (!archive) return null;
    Object.assign(archive, patch, { updatedAt: Date.now() });
    persistBook(book.id);
    return archive;
}

/** 改对话存档的标题 */
export function updateIfChat(bookId, chatId, patch = {}) {
    const book = findById(STATE.books, bookId);
    if (!book) return null;
    const chat = findById(book.ifLineChats, chatId);
    if (!chat) return null;
    Object.assign(chat, patch, { updatedAt: Date.now() });
    persistBook(book.id);
    return chat;
}

export function saveIfChat(bookId, chat) {
    const book = findById(STATE.books, bookId);
    if (!book) return null;
    const list = book.ifLineChats || [];
    const index = list.findIndex((c) => isSameId(c.id, chat.id));
    const record = { ...chat, updatedAt: Date.now() };
    // 已存过就原地更新 —— 原版「继续聊天」会新建一条空记录,旧消息只在 DOM 里,
    // 于是同一段对话会存出好几条、而且续聊时 AI 看不到之前的消息。这里改成同 id 覆盖。
    book.ifLineChats = index >= 0
        ? list.map((c, i) => (i === index ? record : c))
        : [record, ...list];
    persistBook(book.id);
    return record;
}

export function removeIfChat(bookId, chatId) {
    const book = findById(STATE.books, bookId);
    if (!book) return;
    book.ifLineChats = (book.ifLineChats || []).filter((c) => !isSameId(c.id, chatId));
    persistBook(book.id);
}

// ============================================================
// 章节信息(梗概 / 角色视角 / 出场 / 上下文模式)
// ============================================================

export function getChapterInfo(chapterId) {
    const chapter = findById(STATE.chapters, chapterId);
    if (!chapter) return null;
    if (!chapter.chapterInfo) {
        chapter.chapterInfo = {
            summary: '',
            characterViews: [],
            contextMode: 'full',
            appearingCharacters: [],
            scenes: [],
        };
    }
    return chapter.chapterInfo;
}

export function updateChapterInfo(chapterId, patch = {}) {
    const chapter = findById(STATE.chapters, chapterId);
    const info = getChapterInfo(chapterId);
    if (!chapter || !info) return null;
    Object.assign(info, patch);

    // ★ 兼容:章节顶层也存一份。前情提要读的是 `chapter.summary` / `useSummary`,
    //   只写 chapterInfo 的话「上下文模式」调了等于没调(原版就是两处都写)。
    if (patch.summary !== undefined) chapter.summary = patch.summary;
    if (patch.contextMode !== undefined) chapter.useSummary = patch.contextMode === 'summary';

    chapter.updatedAt = Date.now();
    persistChapter(chapter.id);
    return info;
}

export function addCharacterView(chapterId, view) {
    const info = getChapterInfo(chapterId);
    if (!info) return null;
    const record = { createdAt: Date.now(), ...view };
    info.characterViews = [...info.characterViews, record];
    persistChapter(chapterId);
    return record;
}

export function updateCharacterView(chapterId, index, patch) {
    const info = getChapterInfo(chapterId);
    if (!info?.characterViews?.[index]) return null;
    Object.assign(info.characterViews[index], patch, { updatedAt: Date.now() });
    persistChapter(chapterId);
    return info.characterViews[index];
}

export function removeCharacterView(chapterId, index) {
    const info = getChapterInfo(chapterId);
    if (!info) return;
    info.characterViews = info.characterViews.filter((_, i) => i !== index);
    persistChapter(chapterId);
}

// ============================================================
// 聊天背景
// ============================================================

/**
 * 背景优先级:本书 → 全局 → 无。和原版一致。
 * `scope: 'book' | 'global'` 决定这次写哪一层。
 */
export function setBackground(scope, bookId, config) {
    if (scope === 'book') {
        const book = findById(STATE.books, bookId);
        if (!book) return;
        book.customBackground = config;
        persistBook(book.id);
        return;
    }
    STATE.library.settings.customBackground = config;
    persistLibrary();
}

export function getEffectiveBackground(bookId) {
    const book = findById(STATE.books, bookId);
    return book?.customBackground || STATE.library.settings.customBackground || null;
}

// ============================================================
// 弹窗 / 抽屉
// ============================================================

export function openModal(type, payload = {}) {
    STATE.modal = { type, payload };
}

export function closeModal() {
    STATE.modal = null;
}

/** 往输入框里塞文字（灵感页「放进输入框」、素材引用都走这里） */
export function setComposerText(text) {
    STATE.composerText = String(text ?? '');
}

/** 打开全屏子页面。会顺手把弹窗和抽屉收掉 —— 三层叠着用户找不到返回在哪。 */
export function openPage(type, payload = {}) {
    STATE.modal = null;
    STATE.sheet = null;
    STATE.page = { type, payload };
}

export function closePage() {
    STATE.page = null;
}

export function openSheet(type, payload = {}) {
    STATE.sheet = { type, payload };
}

export function closeSheet() {
    STATE.sheet = null;
}

export function setSelection(selection) {
    STATE.selection = selection || null;
}

export default {
    getState, hydrate, flushPersist,
    getOpenBook, getOpenChapter, getOrderedChapters, getActiveModes, getCurrentMode, getSettings,
};
