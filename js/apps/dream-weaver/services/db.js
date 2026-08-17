/**
 * 梦境编织 · 持久化
 *
 * ── 为什么不照抄原版的存储结构 ────────────────────────────────────
 *
 * 原版把**所有东西**塞进一个 key:`PhoneCore.db.put('app_data', 'dream-weaver-data', {...})`,
 * 里面装着全部书籍、全部章节正文、全部消息、全部设置。后果:
 *
 *   - 改一个字 → 整个库(可能几 MB 的正文)重新序列化 + 落盘
 *   - 流式生成每秒写好几次 → 卡到没法用,所以原版只好「生成完才存」,
 *     中途刷新页面就全丢了
 *   - 任何一处结构错误会毁掉整个库,没有部分恢复的可能
 *
 * 现在拆成三张表:
 *
 *   | 表 | keyPath | 装什么 | 写入频率 |
 *   |---|---|---|---|
 *   | `dwBooks`    | id | 书籍元数据 + 卷结构(**不含正文**) | 低 |
 *   | `dwChapters` | id | 单章正文 + 消息 + 分支           | 高(只写当前这一章) |
 *   | `dwLibrary`  | id | 设置 / 灵感 / 收藏 / 场景 / 历史   | 低 |
 *
 * 「高频写入的东西单独一张表」是这次结构调整的全部要点 ——
 * 生成一章不再拖累其他 99 章。
 */

import { makeId, toPlain, isSameId } from '../utils.js';
import {
    createDefaultSettings,
    createDefaultInputModes,
    createDefaultBubbleRules,
    createDefaultContextConfig,
    DEFAULT_ACTIVE_MODE_IDS,
    DEFAULT_COVER_TONE,
} from '../constants.js';

export const STORE_BOOKS = 'dwBooks';
export const STORE_CHAPTERS = 'dwChapters';
export const STORE_LIBRARY = 'dwLibrary';

/** dwLibrary 是单例表,只有这一条记录 */
const LIBRARY_KEY = 'root';

/** 旧版数据在宿主主库里的位置,用于一次性迁移 */
const LEGACY_KEY = 'dream-weaver-data';

export const DW_STORES = Object.freeze([
    { name: STORE_BOOKS, keyPath: 'id' },
    {
        name: STORE_CHAPTERS,
        keyPath: 'id',
        // 按书查章节是最高频的读操作,建索引免得每次全表扫
        indexes: [{ name: 'bookId', keyPath: 'bookId' }],
    },
    { name: STORE_LIBRARY, keyPath: 'id' },
]);

// ============================================================
// 归一化 —— 读出来的东西一律先过一遍
// ============================================================

/**
 * 归一化一本书。
 *
 * 这里同时承担**向后兼容**:老数据里 `coverColor` 是 hex、`timeline` 是旧结构、
 * 章节直接内嵌在 volume 里 —— 都在这儿抹平,上层代码只需要面对一种形状。
 */
export function normalizeBook(raw = {}) {
    const id = String(raw.id || makeId('book'));
    const volumes = Array.isArray(raw.volumes) ? raw.volumes : [];

    return {
        id,
        title: String(raw.title || '未命名'),
        author: String(raw.author || ''),
        // 老数据存的是 hex,新数据存 tone 名。hex 无法反推 tone,统一回落默认色。
        coverTone: typeof raw.coverTone === 'string' ? raw.coverTone : DEFAULT_COVER_TONE,
        synopsis: String(raw.synopsis || ''),

        worldId: raw.worldId || null,
        customWorld: raw.customWorld || null,

        characters: (Array.isArray(raw.characters) ? raw.characters : []).map(normalizeCharacter),
        locations: (Array.isArray(raw.locations) ? raw.locations : []).map(normalizeLocation),
        scenes: Array.isArray(raw.scenes) ? raw.scenes : [],

        userIdentity: raw.userIdentity || null,
        enableAuthorPersonality: raw.enableAuthorPersonality === true,
        authorStyle: String(raw.authorStyle || 'balanced'),

        // API 绑定:{ type:'key'|'group', refId }
        apiRef: raw.apiRef && raw.apiRef.refId ? { type: raw.apiRef.type || 'key', refId: String(raw.apiRef.refId) } : null,

        volumes: volumes.map((v, i) => ({
            id: String(v?.id || makeId('vol')),
            name: String(v?.name || `第${i + 1}卷`),
            // 章节正文已经拆到 dwChapters,这里只留 id 顺序
            chapterIds: Array.isArray(v?.chapterIds)
                ? v.chapterIds.map(String)
                : (Array.isArray(v?.chapters) ? v.chapters.map((c) => String(c?.id || '')).filter(Boolean) : []),
        })),

        timelineEvents: Array.isArray(raw.timelineEvents) ? raw.timelineEvents : [],
        worldTime: String(raw.worldTime || raw.timeline?.worldTime || ''),

        storyNodes: Array.isArray(raw.storyNodes) ? raw.storyNodes : [],
        ifLineArchives: Array.isArray(raw.ifLineArchives) ? raw.ifLineArchives : [],
        finaleCards: Array.isArray(raw.finaleCards) ? raw.finaleCards : [],

        customPrompts: Array.isArray(raw.customPrompts)
            ? raw.customPrompts
            : (Array.isArray(raw.promptConfig?.customPrompts) ? raw.promptConfig.customPrompts : []),
        contextConfig: { ...createDefaultContextConfig(), ...(raw.contextConfig || {}) },

        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

/**
 * 归一化角色。
 *
 * ★ 修了原版的 bug:`getCharacterInfo`(7067)只处理 `mask` / `ai` 两种 type,
 *   `custom` 直接落到 else 分支显示「未知角色」—— 而自定义角色恰恰是最常用的一种。
 *   这里三种 type 一视同仁,都保证有 `name`。
 */
export function normalizeCharacter(raw = {}) {
    const type = ['mask', 'ai', 'custom'].includes(raw.type) ? raw.type : 'custom';
    return {
        id: String(raw.id || makeId('char')),
        type,
        // mask / ai 的 name 运行时从人设 SDK 补;这里存一份快照,SDK 不可用时兜底
        name: String(raw.name || ''),
        refId: raw.refId ? String(raw.refId) : (raw.type !== 'custom' && raw.id ? String(raw.id) : ''),
        role: String(raw.role || ''),
        description: String(raw.description || ''),
        tone: String(raw.tone || ''),
        birthYear: raw.birthYear != null ? Number(raw.birthYear) : null,
        includeInPrompt: raw.includeInPrompt !== false,
    };
}

export function normalizeLocation(raw = {}) {
    return {
        id: String(raw.id || makeId('loc')),
        name: String(raw.name || ''),
        description: String(raw.description || ''),
        tone: String(raw.tone || ''),
        includeInPrompt: raw.includeInPrompt !== false,
    };
}

export function normalizeChapter(raw = {}, bookId = '') {
    const id = String(raw.id || makeId('ch'));
    return {
        id,
        bookId: String(raw.bookId || bookId),
        volumeId: String(raw.volumeId || ''),
        title: String(raw.title || '未命名章节'),

        messages: (Array.isArray(raw.messages) ? raw.messages : []).map(normalizeMessage),

        pov: raw.pov || null,
        povCharacterId: raw.povCharacterId ? String(raw.povCharacterId) : null,
        worldTime: String(raw.worldTime || ''),

        summary: String(raw.summary || ''),
        useSummary: raw.useSummary === true,

        isInnerView: raw.isInnerView === true,
        characterViews: Array.isArray(raw.characterViews) ? raw.characterViews : [],

        /**
         * 分支:{ [messageId]: { currentIndex, alternatives: [{ content, createdAt }] } }
         * 原版还支持 `followingMessages` / `nestedBranches` 嵌套,实际 UI 只用得到
         * 「同一条消息的多个候选」,嵌套那部分从来没有入口能创建。这里只保留能用的部分。
         */
        branches: raw.branches && typeof raw.branches === 'object' ? raw.branches : {},

        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

export function normalizeMessage(raw = {}) {
    return {
        id: String(raw.id || makeId('msg')),
        // user = 我写的 / ai = 生成的 / note = 只记录不进正文
        role: ['user', 'ai', 'note'].includes(raw.role) ? raw.role : 'ai',
        content: String(raw.content || ''),
        modeId: raw.modeId ? String(raw.modeId) : '',
        favorite: raw.favorite === true,
        pending: false,          // 流式中的临时态,永远不落盘
        error: '',
        timestamp: Number(raw.timestamp) || Date.now(),
    };
}

export function normalizeLibrary(raw = {}) {
    const settings = { ...createDefaultSettings(), ...(raw.settings || {}) };
    // 嵌套对象要单独深合并,否则用户老数据里缺字段会整块丢默认值
    settings.defaultWordRange = { ...createDefaultSettings().defaultWordRange, ...(raw.settings?.defaultWordRange || {}) };
    settings.displaySettings = { ...createDefaultSettings().displaySettings, ...(raw.settings?.displaySettings || {}) };
    settings.generationPrompts = {
        ...createDefaultSettings().generationPrompts,
        ...(raw.settings?.generationPrompts || {}),
        typePrompts: {
            ...createDefaultSettings().generationPrompts.typePrompts,
            ...(raw.settings?.generationPrompts?.typePrompts || {}),
        },
    };

    const inputModes = Array.isArray(raw.inputModes) && raw.inputModes.length
        ? raw.inputModes
        : createDefaultInputModes();

    // 激活列表里可能残留已删除的模式 id —— 过滤掉,否则输入栏会渲染出空按钮
    const validIds = new Set(inputModes.map((m) => String(m.id)));
    const activeModeIds = (Array.isArray(raw.activeModeIds) ? raw.activeModeIds : DEFAULT_ACTIVE_MODE_IDS)
        .map(String)
        .filter((id) => validIds.has(id));

    return {
        id: LIBRARY_KEY,
        settings,
        inputModes,
        activeModeIds: activeModeIds.length ? activeModeIds : inputModes.slice(0, 3).map((m) => String(m.id)),
        bubbleRules: Array.isArray(raw.bubbleRules) && raw.bubbleRules.length ? raw.bubbleRules : createDefaultBubbleRules(),
        inspirations: Array.isArray(raw.inspirations) ? raw.inspirations : [],
        collected: Array.isArray(raw.collected) ? raw.collected : [],
        scenes: Array.isArray(raw.scenes) ? raw.scenes : [],
        generatedHistory: Array.isArray(raw.generatedHistory) ? raw.generatedHistory : [],
        styleSummary: String(raw.styleSummary || ''),
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

// ============================================================
// 读写
// ============================================================

function dbOf(app) {
    return app?.toolkit?.db || null;
}

export async function loadLibrary(app) {
    const db = dbOf(app);
    if (!db) return normalizeLibrary({});
    try {
        const raw = await db.get(STORE_LIBRARY, LIBRARY_KEY);
        return normalizeLibrary(raw || {});
    } catch (err) {
        console.warn('[dream-weaver/db] 读取设置失败,用默认值', err);
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
        console.warn('[dream-weaver/db] 保存设置失败', err);
        return false;
    }
}

export async function loadBooks(app) {
    const db = dbOf(app);
    if (!db) return [];
    try {
        const rows = await db.getAllRecords(STORE_BOOKS);
        return (Array.isArray(rows) ? rows : [])
            .map(normalizeBook)
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
        console.warn('[dream-weaver/db] 读取书籍失败', err);
        return [];
    }
}

export async function saveBook(app, book) {
    const db = dbOf(app);
    if (!db || !book?.id) return false;
    const plain = toPlain({ ...book, updatedAt: Date.now() });
    if (!plain) return false;
    try {
        await db.put(STORE_BOOKS, plain);
        return true;
    } catch (err) {
        console.warn('[dream-weaver/db] 保存书籍失败', err);
        return false;
    }
}

/**
 * 删除一本书:书 + 它名下所有章节。
 *
 * ★ 原版删书只删了 books 数组里那一项,章节留在原地成了永远读不到的垃圾。
 *   单 blob 存储时这只是浪费空间,拆表之后会变成真正的孤儿记录,必须一起清。
 */
export async function deleteBook(app, bookId) {
    const db = dbOf(app);
    if (!db || !bookId) return false;
    try {
        const chapters = await listChapters(app, bookId);
        await Promise.all(chapters.map((c) => db.remove(STORE_CHAPTERS, c.id).catch(() => {})));
        await db.remove(STORE_BOOKS, String(bookId));
        return true;
    } catch (err) {
        console.warn('[dream-weaver/db] 删除书籍失败', err);
        return false;
    }
}

export async function listChapters(app, bookId) {
    const db = dbOf(app);
    if (!db || !bookId) return [];
    try {
        const rows = await db.getAllRecords(STORE_CHAPTERS);
        return (Array.isArray(rows) ? rows : [])
            .filter((r) => isSameId(r?.bookId, bookId))
            .map((r) => normalizeChapter(r, bookId));
    } catch (err) {
        console.warn('[dream-weaver/db] 读取章节失败', err);
        return [];
    }
}

export async function loadChapter(app, chapterId) {
    const db = dbOf(app);
    if (!db || !chapterId) return null;
    try {
        const raw = await db.get(STORE_CHAPTERS, String(chapterId));
        return raw ? normalizeChapter(raw) : null;
    } catch (err) {
        console.warn('[dream-weaver/db] 读取章节失败', err);
        return null;
    }
}

export async function saveChapter(app, chapter) {
    const db = dbOf(app);
    if (!db || !chapter?.id) return false;
    // pending / error 是流式过程中的 UI 态,不该进库 —— 否则刷新后会看到一条永远转圈的消息
    const cleaned = {
        ...chapter,
        messages: (chapter.messages || []).map((m) => ({ ...m, pending: false, error: '' })),
        updatedAt: Date.now(),
    };
    const plain = toPlain(cleaned);
    if (!plain) return false;
    try {
        await db.put(STORE_CHAPTERS, plain);
        return true;
    } catch (err) {
        console.warn('[dream-weaver/db] 保存章节失败', err);
        return false;
    }
}

export async function deleteChapter(app, chapterId) {
    const db = dbOf(app);
    if (!db || !chapterId) return false;
    try {
        await db.remove(STORE_CHAPTERS, String(chapterId));
        return true;
    } catch (err) {
        console.warn('[dream-weaver/db] 删除章节失败', err);
        return false;
    }
}

// ============================================================
// 旧版数据迁移
// ============================================================

/**
 * 一次性迁移旧版 `dream-weaver-data` 单 blob。
 *
 * 触发条件:新表里一本书都没有,且宿主主库里能读到旧 key。
 * 迁移完**不删旧数据** —— 万一新版有问题,用户的原始数据还在。
 * 只在 library 上打个 `migratedFrom` 标记防止重复导入。
 */
export async function migrateLegacyData(app) {
    const db = dbOf(app);
    if (!db) return { migrated: false };

    let legacy = null;
    try {
        // 旧数据在宿主主库的 app_data 表,不是本 App 声明的表,只能走 window.myDb
        legacy = await window.myDb?.get?.('app_data', LEGACY_KEY);
    } catch (_) {
        return { migrated: false };
    }
    if (!legacy || !Array.isArray(legacy.books) || legacy.books.length === 0) {
        return { migrated: false };
    }

    const books = [];
    const chapters = [];

    for (const rawBook of legacy.books) {
        const book = normalizeBook(rawBook);
        const rawVolumes = Array.isArray(rawBook?.volumes) ? rawBook.volumes : [];

        book.volumes = rawVolumes.map((vol, vi) => {
            const volumeId = String(vol?.id || makeId('vol'));
            const rawChapters = Array.isArray(vol?.chapters) ? vol.chapters : [];
            const chapterIds = [];

            for (const rawChapter of rawChapters) {
                const chapter = normalizeChapter({ ...rawChapter, volumeId }, book.id);
                // 老章节的正文存在 `content`(HTML 串),消息列表可能是空的。
                // 只有当 messages 为空时才把 content 转成一条消息,避免重复。
                if (chapter.messages.length === 0 && rawChapter?.content) {
                    chapter.messages = [
                        normalizeMessage({
                            role: 'ai',
                            content: String(rawChapter.content),
                            timestamp: Number(rawChapter.createdAt) || Date.now(),
                        }),
                    ];
                }
                chapters.push(chapter);
                chapterIds.push(chapter.id);
            }

            return { id: volumeId, name: String(vol?.name || `第${vi + 1}卷`), chapterIds };
        });

        books.push(book);
    }

    try {
        await db.bulkPut(STORE_BOOKS, books.map(toPlain).filter(Boolean));
        await db.bulkPut(STORE_CHAPTERS, chapters.map(toPlain).filter(Boolean));

        const library = normalizeLibrary({
            settings: legacy.settings,
            inputModes: legacy.customInputModes,
            activeModeIds: legacy.activeInputModeIds,
            bubbleRules: legacy.bubbleRegexRules,
            inspirations: legacy.inspirations,
            collected: legacy.collectedPassages,
            scenes: legacy.savedScenes,
            generatedHistory: legacy.generatedHistory,
            styleSummary: legacy.userStyleSummary,
        });
        library.migratedFrom = LEGACY_KEY;
        library.migratedAt = Date.now();
        await saveLibrary(app, library);

        console.log(`[dream-weaver/db] 已迁移旧版数据:${books.length} 本书 / ${chapters.length} 章`);
        return { migrated: true, books: books.length, chapters: chapters.length, library };
    } catch (err) {
        console.warn('[dream-weaver/db] 旧版数据迁移失败,不影响新建', err);
        return { migrated: false };
    }
}

// ============================================================
// 导出
// ============================================================

/** 导出全部数据为一个可读的 JSON 对象(「我的」页的导出按钮用) */
export async function exportAll(app) {
    const [library, books] = await Promise.all([loadLibrary(app), loadBooks(app)]);
    const chaptersByBook = {};
    for (const book of books) {
        chaptersByBook[book.id] = await listChapters(app, book.id);
    }
    return {
        format: 'dream-weaver-export',
        version: 2,
        exportedAt: new Date().toISOString(),
        library,
        books,
        chapters: chaptersByBook,
    };
}
