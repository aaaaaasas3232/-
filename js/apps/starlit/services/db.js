/**
 * 点灯 · 持久层
 *
 * 八张表。除 profiles 外全部按「档案键」（`${userId}::${worldId|solo}`）分档。
 *
 *   slProfiles      一档一条   外观 / 弹幕 / 小电视 / 默认老师来源
 *   slTopics        一主题一条 模式、目标、水平侧写、课程规划、推理墙视口
 *   slLessons       一节一条   目标、状态、总结、笔记、反转课堂结论
 *   slMessages      一条一记录 上课与反转课堂的消息（高频，必须单独成表）
 *   slCards         一张一记录 **卡片库的唯一真相**，可跨课复用
 *   slLinks         一条一记录 卡片之间的连线
 *   slDictEntries   一条一记录 知识点词典 + SRS 调度字段
 *   slStuckPoints   一条一记录 错题本
 *
 * messages / cards / links 单独成表的原因：塞进 lesson 里的话，
 * 每发一条消息、每拖一次卡片都要重新序列化整节课。推理墙一拖就掉帧。
 *
 * 所有写入都在这一层 `toPlain` 剥 Vue Proxy —— 别的地方不用再想 DataCloneError。
 */

import { STORES, LESSON_STATUS, MODES } from '../constants.js';
import { asArray, toPlain, uid } from '../utils.js';

/** appConfig.stores 用这个。声明了 stores 就必须在 js/apps/index.js 走 async 注册。 */
export const STARLIT_STORES = Object.freeze([
    { name: STORES.profiles, keyPath: 'id' },
    { name: STORES.topics, keyPath: 'id' },
    { name: STORES.lessons, keyPath: 'id' },
    { name: STORES.messages, keyPath: 'id' },
    { name: STORES.cards, keyPath: 'id' },
    { name: STORES.links, keyPath: 'id' },
    { name: STORES.dict, keyPath: 'id' },
    { name: STORES.stuck, keyPath: 'id' },
]);

/** 优先 toolkit.db（会校验表声明），兜底 window.myDb（预热路径拿不到 app 实例） */
function db(app) {
    return app?.toolkit?.db || (typeof window !== 'undefined' ? window.myDb : null);
}

async function getAll(app, store) {
    const handle = db(app);
    if (!handle) return [];
    try {
        const rows = await handle.getAll(store);
        return Array.isArray(rows) ? rows : [];
    } catch (err) {
        console.warn(`[starlit] 读 ${store} 失败`, err);
        return [];
    }
}

async function put(app, store, record) {
    const handle = db(app);
    if (!handle) return null;
    try {
        const plain = toPlain(record);
        await handle.put(store, plain);
        return plain;
    } catch (err) {
        console.warn(`[starlit] 写 ${store} 失败`, err);
        return null;
    }
}

async function remove(app, store, id) {
    const handle = db(app);
    if (!handle || !id) return false;
    try {
        await handle.remove(store, id);
        return true;
    } catch (err) {
        console.warn(`[starlit] 删 ${store} 失败`, err);
        return false;
    }
}

/**
 * 批量写。IndexedDB 单条 put 各开一个事务，
 * 一节课收 30 张卡就是 30 个事务 —— 有 bulkPut 就用它。
 */
async function bulkPut(app, store, records) {
    const handle = db(app);
    const list = asArray(records).map(toPlain);
    if (!handle || list.length === 0) return list;
    try {
        if (typeof handle.bulkPut === 'function') {
            await handle.bulkPut(store, list);
        } else {
            for (const row of list) await handle.put(store, row);
        }
    } catch (err) {
        console.warn(`[starlit] 批量写 ${store} 失败`, err);
    }
    return list;
}

// ============================================================
// profiles —— 一档一条
// ============================================================

export function makeProfile(profileKey) {
    return {
        id: String(profileKey),

        themeId: 'lantern',
        customColors: {},
        customThemes: [],
        activeCustomThemeId: '',

        /** 默认老师来源：'persona' | 'model' */
        teacherSource: 'model',
        /** 选中的世界观 AI id（teacherSource === 'persona' 时用） */
        teacherAiId: '',

        /** 悬浮弹幕 */
        ticker: {
            on: false,
            zone: 'middle',        // all | top | middle | bottom
            density: 'normal',
            speed: 1,              // 0.5 ~ 2
            topicId: '',           // 空 = 全部主题混播
            includeMastered: false,
            showBack: true,        // 是否连释义一起飘
        },

        /** 灵动岛逐条播放 */
        island: {
            on: false,
            intervalMs: 6000,
        },

        /** 手机壳外的小电视 */
        tv: {
            on: false,
            width: 148,
            mode: 'roll',          // roll | drill
            intervalMs: 4200,
            maskBack: true,        // 单词机：先遮住释义
        },

        /** 翻译怎么显示：'meme' 描边贴边上 | 'tap' 点开才展开 */
        glossMode: 'meme',

        /** 老师一条回复拆成几个短气泡 */
        bubble: {
            split: true,
            maxChars: 46,
        },

        /** 长按翻译 */
        translate: {
            engine: 'local',       // local | ai
            /** 悬浮译文层上次被拖到哪儿（百分比，跟着屏幕走不跟像素走） */
            memeX: 50,
            memeY: 72,
        },

        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

export async function loadProfile(app, profileKey) {
    if (!profileKey) return null;
    const handle = db(app);
    if (!handle) return null;
    try {
        const row = await handle.get(STORES.profiles, String(profileKey));
        if (!row) return null;
        const base = makeProfile(profileKey);
        // 老档缺字段要补齐（含二级对象），加新字段后老用户不该崩
        return {
            ...base,
            ...row,
            ticker: { ...base.ticker, ...(row.ticker || {}) },
            island: { ...base.island, ...(row.island || {}) },
            tv: { ...base.tv, ...(row.tv || {}) },
            bubble: { ...base.bubble, ...(row.bubble || {}) },
            translate: { ...base.translate, ...(row.translate || {}) },
        };
    } catch (err) {
        console.warn('[starlit] 读档案失败', err);
        return null;
    }
}

export function saveProfile(app, profile) {
    if (!profile?.id) return Promise.resolve(null);
    return put(app, STORES.profiles, { ...profile, updatedAt: Date.now() });
}

// ============================================================
// topics —— 学习主题（一个主题 = 一个推理空间）
// ============================================================

export function makeTopic(profileKey, patch = {}) {
    return {
        id: uid('tp'),
        profileKey: String(profileKey),

        title: '',
        mode: MODES.language,
        /** 语言模式：目标语言（英语 / 日语 …）；代码模式：技术栈标签 */
        target: '',
        /** 目标语言的原生写法，进 prompt 用（English / 日本語 …） */
        targetNative: '',

        /**
         * 语言模式的浸没维度：'full' 全外文 | 'gradual' 循序渐进。
         * ★ 挂在主题上不是挂在档案上 —— 同一个人可能英语想全浸没、
         *   日语才入门想慢慢来。老档没有这个字段时按 gradual 兜底（见 listTopics 的补齐）。
         */
        immersion: 'gradual',

        /** 老师：'persona' 时 teacherAiId 有值 */
        teacherSource: '',
        teacherAiId: '',
        teacherName: '',

        /** 问卷 */
        surveyStage: 'none',   // none | asking | answering | done
        surveyQuestions: [],   // [{ id, q, kind:'choice'|'text', options:[], answer }]
        /** 用户填的终点（想达到什么目的） */
        goal: '',

        /** AI 出的水平侧写 —— 反转课堂的提示词就是它 */
        learnerProfile: '',
        /** 侧写版本号，每次覆盖 +1（防止内容越滚越多） */
        profileVersion: 0,

        /** 课程规划完成了没 */
        planned: false,

        /** 推理墙视口（记住用户上次看到哪儿） */
        wall: { x: 0, y: 0, zoom: 1 },

        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...patch,
    };
}

export async function listTopics(app, profileKey) {
    const rows = await getAll(app, STORES.topics);
    return rows
        .filter((r) => r && r.profileKey === profileKey)
        // ★ 老档没有 immersion 字段。不补的话 prompt 里会拿到 undefined，
        //   老师既不知道该全外文还是该夹中文，行为随机。
        .map((r) => (r.immersion ? r : { ...r, immersion: 'gradual' }))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function saveTopic(app, topic) {
    if (!topic?.id) return Promise.resolve(null);
    return put(app, STORES.topics, { ...topic, updatedAt: Date.now() });
}

export function removeTopic(app, id) {
    return remove(app, STORES.topics, id);
}

/** 删主题要连它名下的一切一起删，不留孤儿 */
export async function purgeTopic(app, topicId) {
    const id = String(topicId || '');
    if (!id) return 0;
    let n = 0;
    for (const store of [STORES.lessons, STORES.messages, STORES.cards, STORES.links, STORES.dict, STORES.stuck]) {
        const rows = await getAll(app, store);
        for (const row of rows) {
            if (row && String(row.topicId) === id) {
                await remove(app, store, row.id);
                n += 1;
            }
        }
    }
    await remove(app, STORES.topics, id);
    return n;
}

// ============================================================
// lessons
// ============================================================

export function makeLesson(profileKey, topicId, patch = {}) {
    return {
        id: uid('ls'),
        profileKey: String(profileKey),
        topicId: String(topicId),

        index: 0,               // 第几节（从 1 开始）
        title: '',
        /** 规划阶段就定好的目标（详细内容不拉） */
        objectives: [],         // [{ id, text, from:'plan'|'ai'|'stuck', done }]
        /** 上课时 AI 现场定的本节主旨 */
        thesis: '',

        status: LESSON_STATUS.planned,

        /** 用户自己记的笔记 */
        notes: '',
        /** 结课总结（AI 生成） */
        summary: '',
        /** 本节产出的卡片 id（推理墙靠 topicId 汇总，这里是「总结反思区」用的） */
        cardIds: [],

        /** 反转课堂 */
        flip: {
            status: 'none',     // none | running | done
            studentLevel: '',   // 用的是哪一版侧写
            endedBy: '',        // 'ai' | 'user'
            summary: '',
            startedAt: 0,
            endedAt: 0,
        },

        startedAt: 0,
        endedAt: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...patch,
    };
}

export async function listLessons(app, topicId) {
    const rows = await getAll(app, STORES.lessons);
    return rows
        .filter((r) => r && String(r.topicId) === String(topicId))
        .sort((a, b) => (a.index || 0) - (b.index || 0) || (a.createdAt || 0) - (b.createdAt || 0));
}

export function saveLesson(app, lesson) {
    if (!lesson?.id) return Promise.resolve(null);
    return put(app, STORES.lessons, { ...lesson, updatedAt: Date.now() });
}

export function saveLessons(app, lessons) {
    const now = Date.now();
    return bulkPut(app, STORES.lessons, asArray(lessons).map((l) => ({ ...l, updatedAt: now })));
}

export function removeLesson(app, id) {
    return remove(app, STORES.lessons, id);
}

// ============================================================
// messages —— 上课 / 反转课堂
// ============================================================

export function makeMessage(profileKey, topicId, lessonId, patch = {}) {
    return {
        id: uid('ms'),
        profileKey: String(profileKey),
        topicId: String(topicId),
        lessonId: String(lessonId),

        /** 'teacher' | 'me' | 'system' | 'student'（反转课堂里 AI 是学生） */
        role: 'teacher',
        /** 'lesson' | 'flip' —— 同一节课两个会话分开存 */
        scene: 'lesson',

        text: '',
        /** 语言模式：贴在气泡旁的描边中文 */
        gloss: '',
        /** 这条消息附带的卡片 id */
        cardIds: [],

        seq: 0,
        createdAt: Date.now(),
        ...patch,
    };
}

export async function listMessages(app, lessonId, scene = '') {
    const rows = await getAll(app, STORES.messages);
    return rows
        .filter((r) => r && String(r.lessonId) === String(lessonId) && (!scene || r.scene === scene))
        // 按 seq 排，不按 createdAt —— 同一毫秒插两条时时间戳会撞
        .sort((a, b) => (a.seq || 0) - (b.seq || 0));
}

export function saveMessage(app, message) {
    if (!message?.id) return Promise.resolve(null);
    return put(app, STORES.messages, message);
}

export function removeMessage(app, id) {
    return remove(app, STORES.messages, id);
}

export async function removeMessagesByLesson(app, lessonId, scene = '') {
    const rows = await listMessages(app, lessonId, scene);
    for (const row of rows) await remove(app, STORES.messages, row.id);
    return rows.length;
}

// ============================================================
// cards —— 卡片库（跨课复用的根据地）
// ============================================================

export function makeCard(profileKey, topicId, patch = {}) {
    return {
        id: uid('cd'),
        profileKey: String(profileKey),
        topicId: String(topicId),

        type: 'concept',
        title: '',
        /** 一句话摘要，墙上小卡显示这个 */
        brief: '',
        /** 正文（概念卡的「它为什么诞生」） */
        body: '',

        /** 词卡专用 */
        word: { term: '', pos: '', meaning: '', roots: [], examples: [] },
        /** 帖子卡专用 */
        post: { url: '', host: '', excerpt: '' },
        /** 代码卡专用 */
        code: {
            html: '', css: '', js: '',
            /** 重点行：[{ lang, line, mark:1..4, note }] */
            focus: [],
            /** 用户勾掉（注释掉）的行：['html:12', 'css:3'] */
            disabled: [],
            /** 预览高度（用户可拖） */
            previewH: 180,
        },
        /** 小测专用 */
        quiz: { q: '', options: [], answer: 0, why: '' },

        /** 从哪节课来的（第一次出现） */
        lessonId: '',
        /** 被哪几节课引用过 —— 复用的证据链 */
        usedInLessons: [],
        /** AI 打的检索标签，复用时按它匹配 */
        tags: [],

        /** 推理墙坐标（世界坐标） */
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        /** 属于哪个卡片堆（空 = 散卡） */
        stackId: '',
        /** 堆内顺序 */
        stackOrder: 0,
        /** 用户折叠 / 收藏 */
        pinned: false,
        collapsed: false,

        /** 用户改过内容没（改过就不再被 AI 覆盖） */
        edited: false,

        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...patch,
    };
}

export async function listCards(app, topicId) {
    const rows = await getAll(app, STORES.cards);
    return rows
        .filter((r) => r && String(r.topicId) === String(topicId))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export function saveCard(app, card) {
    if (!card?.id) return Promise.resolve(null);
    return put(app, STORES.cards, { ...card, updatedAt: Date.now() });
}

export function saveCards(app, cards) {
    const now = Date.now();
    return bulkPut(app, STORES.cards, asArray(cards).map((c) => ({ ...c, updatedAt: now })));
}

export function removeCard(app, id) {
    return remove(app, STORES.cards, id);
}

/** 删卡片要把挂在它身上的连线也删掉 */
export async function purgeCard(app, cardId) {
    const id = String(cardId || '');
    if (!id) return false;
    const links = await getAll(app, STORES.links);
    for (const link of links) {
        if (link && (String(link.from) === id || String(link.to) === id)) {
            await remove(app, STORES.links, link.id);
        }
    }
    return remove(app, STORES.cards, id);
}

// ============================================================
// links —— 连线
// ============================================================

export function makeLink(profileKey, topicId, from, to, patch = {}) {
    return {
        id: uid('lk'),
        profileKey: String(profileKey),
        topicId: String(topicId),
        from: String(from),
        to: String(to),
        kind: 'because',
        label: '',
        /** 谁连的：'ai' | 'user' */
        by: 'user',
        /** 弯曲量 -1..1，用户能调 */
        bulge: 0,
        createdAt: Date.now(),
        ...patch,
    };
}

export async function listLinks(app, topicId) {
    const rows = await getAll(app, STORES.links);
    return rows.filter((r) => r && String(r.topicId) === String(topicId));
}

export function saveLink(app, link) {
    if (!link?.id) return Promise.resolve(null);
    return put(app, STORES.links, link);
}

export function saveLinks(app, links) {
    return bulkPut(app, STORES.links, links);
}

export function removeLink(app, id) {
    return remove(app, STORES.links, id);
}

// ============================================================
// dict —— 知识点词典（含 SRS）
// ============================================================

export function makeDictEntry(profileKey, topicId, patch = {}) {
    return {
        id: uid('dc'),
        profileKey: String(profileKey),
        topicId: String(topicId),

        front: '',      // eat
        pos: '',        // v.
        back: '',       // 吃
        hint: '',       // 补充（词根 / 记忆钩子）

        /** 'user' | 'ai' */
        by: 'user',
        /** weak | normal | mastered */
        bucket: 'normal',

        /** SRS */
        step: 0,
        dueAt: 0,
        reps: 0,
        lapses: 0,
        lastGrade: '',
        lastSeenAt: 0,

        /** 用户手动关掉这一条的播放 */
        muted: false,

        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...patch,
    };
}

export async function listDict(app, profileKey, topicId = '') {
    const rows = await getAll(app, STORES.dict);
    return rows
        .filter((r) => r && r.profileKey === profileKey && (!topicId || String(r.topicId) === String(topicId)))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function saveDictEntry(app, entry) {
    if (!entry?.id) return Promise.resolve(null);
    return put(app, STORES.dict, { ...entry, updatedAt: Date.now() });
}

export function saveDictEntries(app, entries) {
    const now = Date.now();
    return bulkPut(app, STORES.dict, asArray(entries).map((e) => ({ ...e, updatedAt: now })));
}

export function removeDictEntry(app, id) {
    return remove(app, STORES.dict, id);
}

// ============================================================
// stuck —— 错题本
// ============================================================

export function makeStuck(profileKey, topicId, patch = {}) {
    return {
        id: uid('sk'),
        profileKey: String(profileKey),
        topicId: String(topicId),
        lessonId: '',

        point: '',          // 卡在哪个知识点
        why: '',            // AI 评估：为什么现在讲不通
        /** AI 判断：需要先补什么。规划器会据此给别的课加目标 */
        prerequisite: '',
        /** 已经在哪节课安排上了 */
        scheduledLessonId: '',

        status: 'open',     // open | scheduled | resolved
        resolvedAt: 0,

        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...patch,
    };
}

export async function listStuck(app, topicId) {
    const rows = await getAll(app, STORES.stuck);
    return rows
        .filter((r) => r && String(r.topicId) === String(topicId))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function saveStuck(app, row) {
    if (!row?.id) return Promise.resolve(null);
    return put(app, STORES.stuck, { ...row, updatedAt: Date.now() });
}

export function removeStuck(app, id) {
    return remove(app, STORES.stuck, id);
}
