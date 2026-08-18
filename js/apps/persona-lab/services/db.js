/**
 * 人设机 · 持久化
 *
 * 两张表。因为本 App 存的东西很少:
 *
 *   | 存在哪 | 存什么 |
 *   |---|---|
 *   | `plDrafts` | 草稿正文 + 对话 + 修改日志 + 上下文开关 |
 *   | `plQuizSets` | 用户导入的题库(内置那 6 套是代码常量,不进库) |
 *   | nook `sdkUsers` / `sdkAiPersons` | **人设卡本体**(这里不复制一份) |
 *   | nook `apiKeys` | API Key(这里连读都不读) |
 *
 * 人设卡不进本表是刻意的:复制一份就会有两个真相,而「人设机里是新的、
 * nook 里是旧的」这种不一致不会报错,只会让用户在别的 App 里发现 AI 还是老样子。
 *
 * ⚠️ 声明了 stores 就必须在 `js/apps/index.js` 里 `async: true` 注册,
 *    否则首次写盘时表还没建出来,表现是「保存成功但刷新就没了」。
 */

import { makeId, toPlain } from '../utils.js';
import { UNTITLED } from '../constants.js';
import { normalizeCardText } from './card-schema.js';
import { QUIZ_LIMITS } from './quiz-format.js';

export const STORE_DRAFTS = 'plDrafts';
export const STORE_QUIZ_SETS = 'plQuizSets';

export const PL_STORES = Object.freeze([
    { name: STORE_DRAFTS, keyPath: 'id', indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }] },
    { name: STORE_QUIZ_SETS, keyPath: 'id', indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }] },
]);

function dbOf(app) {
    return app?.toolkit?.db || null;
}

// ============================================================
// 归一化
// ============================================================

export function normalizeMessage(raw = {}) {
    return {
        id: String(raw.id || makeId('msg')),
        role: raw.role === 'user' || raw.role === 'advisor' || raw.role === 'system' ? raw.role : 'persona',
        text: String(raw.text || ''),
        // pending / error 是运行时 UI 态,读盘时一律清掉 ——
        // 否则刷新后会看到一条永远在转圈的消息
        pending: false,
        error: '',
        quizRef: raw.quizRef || null,
        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

export function normalizeLogEntry(raw = {}) {
    return {
        id: String(raw.id || makeId('log')),
        action: String(raw.action || 'edit'),
        title: String(raw.title || ''),
        before: String(raw.before || ''),
        after: String(raw.after || ''),
        reason: String(raw.reason || ''),
        /** 撤销用:整份正文的上一版。只留最近若干条,见 constants.LOG_LIMIT */
        snapshot: typeof raw.snapshot === 'string' ? raw.snapshot : '',
        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

export function normalizeDraft(raw = {}) {
    const id = String(raw.id || makeId('draft'));
    return {
        id,
        scope: raw.scope === 'user' ? 'user' : 'ai',
        /** 非空 = 这份草稿对应 nook 里那张卡,保存时**覆盖**它 */
        personaId: raw.personaId ? String(raw.personaId) : '',
        title: String(raw.title || '').trim() || UNTITLED,
        text: normalizeCardText(raw.text || ''),
        tone: String(raw.tone || ''),

        messages: (Array.isArray(raw.messages) ? raw.messages : []).map(normalizeMessage),
        log: (Array.isArray(raw.log) ? raw.log : []).map(normalizeLogEntry),

        /** 当前待处理的那一条建议(接受 / 忽略之后清空) */
        suggestion: raw.suggestion || null,
        advisorNote: String(raw.advisorNote || ''),

        /**
         * 题库进度。
         *
         *   answers  这一题她回的原话
         *   picks    这段话**落到了哪个选项**(原文照抄);有选项时答了就会有
         *
         * 两份都留是有必要的:原话要给 prompt 看,选项要给擂台赛算下一轮对阵。
         * 只留原话的话擂主永远换不掉(见 `question-bank.getQuestion`)。
         */
        quiz: {
            setId: String(raw.quiz?.setId || ''),
            index: Number(raw.quiz?.index) || 0,
            answers: raw.quiz?.answers && typeof raw.quiz.answers === 'object' ? { ...raw.quiz.answers } : {},
            picks: raw.quiz?.picks && typeof raw.quiz.picks === 'object' ? { ...raw.quiz.picks } : {},
        },

        /** 上下文段落开关。缺省即全开;locked 的段不受它影响。 */
        contextConfig: raw.contextConfig && typeof raw.contextConfig === 'object' ? { ...raw.contextConfig } : {},

        /** 上一次成功保存回 nook 的时间,UI 用它显示「有未保存的改动」 */
        savedAt: Number(raw.savedAt) || 0,
        /** 保存那一刻的正文,用来判断「现在和已保存的比,变了没有」 */
        savedText: typeof raw.savedText === 'string' ? raw.savedText : '',

        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

// ============================================================
// 读写
// ============================================================

export async function loadDrafts(app) {
    const db = dbOf(app);
    if (!db) return [];
    try {
        const rows = await db.getAllRecords(STORE_DRAFTS);
        return (Array.isArray(rows) ? rows : [])
            .map(normalizeDraft)
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
        console.warn('[persona-lab/db] 读取草稿失败', err);
        return [];
    }
}

export async function saveDraft(app, draft) {
    const db = dbOf(app);
    if (!db || !draft?.id) return false;
    const plain = toPlain({ ...draft, updatedAt: Date.now() });
    if (!plain) return false;
    try {
        await db.put(STORE_DRAFTS, plain);
        return true;
    } catch (err) {
        console.warn('[persona-lab/db] 保存草稿失败', err);
        return false;
    }
}

export async function deleteDraft(app, draftId) {
    const db = dbOf(app);
    if (!db || !draftId) return false;
    try {
        await db.remove(STORE_DRAFTS, String(draftId));
        return true;
    } catch (err) {
        console.warn('[persona-lab/db] 删除草稿失败', err);
        return false;
    }
}

// ============================================================
// 自定义题库
// ============================================================

/**
 * 归一化一套题库。
 *
 * ★ 这里要挡住的是「导入时是好的、下次开机变形了」:库里的记录可能来自
 *   上一个版本、也可能被用户从数据库页手改过。`getQuestion` 假定
 *   questions / options 一一对应,对不上就会渲染出空题。
 */
export function normalizeQuizSet(raw = {}) {
    const kind = raw.kind === 'ladder' ? 'ladder' : 'fixed';
    const questions = (Array.isArray(raw.questions) ? raw.questions : [])
        .map((q) => String(q || '').trim())
        .filter(Boolean)
        .slice(0, QUIZ_LIMITS.questions);
    const options = questions.map((_, i) => {
        const list = Array.isArray(raw.options?.[i]) ? raw.options[i] : [];
        return list.map((o) => String(o || '').trim()).filter(Boolean).slice(0, QUIZ_LIMITS.options);
    });
    const pool = [...new Set(
        (Array.isArray(raw.pool) ? raw.pool : []).map((p) => String(p || '').trim()).filter(Boolean),
    )].slice(0, QUIZ_LIMITS.pool);

    return {
        id: String(raw.id || makeId('quiz')),
        name: String(raw.name || '').trim() || '未命名题库',
        desc: String(raw.desc || '').trim(),
        kind,
        questions,
        options,
        prompt: String(raw.prompt || '').trim(),
        pool,
        rounds: Math.max(0, Number(raw.rounds) || 0),
        source: String(raw.source || 'import'),
        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || Date.now(),
    };
}

export async function loadQuizSets(app) {
    const db = dbOf(app);
    if (!db) return [];
    try {
        const rows = await db.getAllRecords(STORE_QUIZ_SETS);
        return (Array.isArray(rows) ? rows : [])
            .map(normalizeQuizSet)
            // 归一化之后可能空了(手改坏了 / 老版本的残留),空的不该出现在挑题库的列表里
            .filter((s) => (s.kind === 'ladder' ? s.pool.length >= 3 : s.questions.length > 0))
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
        console.warn('[persona-lab/db] 读取自定义题库失败', err);
        return [];
    }
}

export async function saveQuizSet(app, set) {
    const db = dbOf(app);
    if (!db || !set?.id) return false;
    const plain = toPlain({ ...set, updatedAt: Date.now() });
    if (!plain) return false;
    try {
        await db.put(STORE_QUIZ_SETS, plain);
        return true;
    } catch (err) {
        console.warn('[persona-lab/db] 保存自定义题库失败', err);
        return false;
    }
}

export async function deleteQuizSet(app, setId) {
    const db = dbOf(app);
    if (!db || !setId) return false;
    try {
        await db.remove(STORE_QUIZ_SETS, String(setId));
        return true;
    } catch (err) {
        console.warn('[persona-lab/db] 删除自定义题库失败', err);
        return false;
    }
}
