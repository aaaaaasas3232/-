/**
 * 人设机 · 题库文本格式(导入的唯一入口)
 *
 * ── 为什么是「一行一条 键：值」 ────────────────────────────────────
 *
 * 用户拿题目的路径是:在网上 / 书里找一套题 → 丢给 AI 说"改成这个格式" → 粘进来。
 * 所以格式要满足三件事:
 *
 *   1. **人一眼看得懂**,不然用户没法自己检查 AI 有没有改错
 *   2. **AI 一次就能写对**,不要求引号、逗号、缩进(JSON 少个括号就全废)
 *   3. 和本 App 已有的写法是同一套 —— 人设正文也是「键：值」,
 *      用户不需要学第二种语法(`services/card-schema.js`)
 *
 * ── 解析规则(没有启发式) ──────────────────────────────────────────
 *
 *   · 一行的冒号前命中已知键名才算一条指令,否则整行忽略并记一条提示
 *   · `题库：` 开一套新的;一次可以粘好几套
 *   · `问：` 开一道新题,后面跟着的 `选：` 都算这道题的
 *   · `-` / `1.` / `A.` 开头的行等价于 `选：`(AI 特别爱这么写,认了省一轮返工)
 *   · 全角半角冒号都行,`#` 开头是注释
 *
 * 解析失败**不抛异常**:能认出来的照收,认不出来的逐条报给用户看,
 * 让他知道哪一行没吃进去 —— 静默丢题是这类导入功能最讨厌的失败方式。
 */

import { splitKeyValue, toLines, truncate } from '../utils.js';

/** 上限。粘进来一本书不该把 App 卡死,超了就截断并明说。 */
export const QUIZ_LIMITS = Object.freeze({
    sets: 12,
    questions: 200,
    options: 8,
    pool: 60,
    textLength: 300,
});

const KEYS = {
    set: ['题库', '题库名', '名称', '标题', 'set', 'name', 'title'],
    desc: ['说明', '描述', '简介', 'desc', 'description'],
    kind: ['类型', '玩法', 'kind', 'type'],
    question: ['问', '题', '题目', '问题', 'q', 'question'],
    option: ['选', '选项', '答', '答案', 'a', 'option', 'options'],
    prompt: ['提示', '对比', '对比提示', 'prompt'],
    pool: ['项', '候选', '选手', 'pool', 'item'],
    rounds: ['轮数', '轮次', 'rounds'],
};

/** 「擂台」这两个字出现在类型里就当擂台赛,其余一律固定题 */
function readKind(value) {
    return /擂台|ladder|pk|对决|淘汰/i.test(String(value || '')) ? 'ladder' : 'fixed';
}

function normKey(raw) {
    return String(raw ?? '').toLowerCase().replace(/[\s_\-*#·・]/g, '');
}

const KEY_MAP = (() => {
    const map = new Map();
    for (const [field, aliases] of Object.entries(KEYS)) {
        for (const alias of aliases) map.set(normKey(alias), field);
    }
    return map;
})();

/** 列表符号开头的行:`- 很主动` / `1. 很主动` / `A、很主动` */
const BULLET_RE = /^\s*(?:[-*+·•]|[(（]?(?:[0-9]{1,2}|[a-hA-H①②③④⑤⑥⑦⑧])[.、．:：)）])\s*/;

function clean(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, QUIZ_LIMITS.textLength);
}

// ============================================================
// 解析
// ============================================================

/**
 * @typedef {object} ParsedQuizSet
 * @property {string} name
 * @property {string} desc
 * @property {'fixed'|'ladder'} kind
 * @property {string[]} questions
 * @property {string[][]} options
 * @property {string} prompt
 * @property {string[]} pool
 * @property {number} rounds
 */

function emptySet(name) {
    return {
        name: clean(name),
        desc: '',
        kind: 'fixed',
        questions: [],
        options: [],
        prompt: '',
        pool: [],
        rounds: 0,
    };
}

/**
 * 文本 → 题库。
 *
 * @param {string} raw
 * @returns {{ sets: ParsedQuizSet[], notes: string[] }}
 *   `notes` 是给用户看的逐条提示(哪一行没吃进去、哪里被截断了)
 */
export function parseQuizText(raw) {
    const lines = toLines(raw);
    const sets = [];
    const notes = [];
    let current = null;
    let questionAt = -1;
    let truncated = false;
    let capped = false;

    const ensureSet = () => {
        if (current) return current;
        // 没写「题库：」就先开一套无名的,名字最后用第一题兜底 —— 比整段丢掉强
        current = emptySet('');
        sets.push(current);
        return current;
    };

    lines.forEach((line, i) => {
        const lineNo = i + 1;
        const text = line.trim();
        if (!text || text.startsWith('#') || text.startsWith('//') || capped) return;

        const kv = splitKeyValue(text);
        const field = kv ? KEY_MAP.get(normKey(kv.key)) : null;

        if (field === 'set') {
            if (sets.length >= QUIZ_LIMITS.sets) {
                notes.push(`一次最多导 ${QUIZ_LIMITS.sets} 套，后面的没收`);
                capped = true;
                return;
            }
            current = emptySet(kv.value);
            questionAt = -1;
            sets.push(current);
            return;
        }

        if (field === 'desc') { ensureSet().desc = clean(kv.value); return; }
        if (field === 'kind') { ensureSet().kind = readKind(kv.value); return; }
        if (field === 'prompt') {
            const set = ensureSet();
            set.prompt = clean(kv.value);
            if (set.kind !== 'ladder') set.kind = 'ladder';
            return;
        }
        if (field === 'rounds') {
            const n = parseInt(String(kv.value).replace(/[^0-9]/g, ''), 10);
            if (Number.isFinite(n) && n > 0) ensureSet().rounds = n;
            return;
        }

        if (field === 'question') {
            const set = ensureSet();
            const q = clean(kv.value);
            if (!q) { notes.push(`第 ${lineNo} 行「问」后面是空的，跳过`); return; }
            if (set.questions.length >= QUIZ_LIMITS.questions) {
                if (!truncated) notes.push(`单套最多 ${QUIZ_LIMITS.questions} 题，多的没收`);
                truncated = true;
                return;
            }
            set.questions.push(q);
            set.options.push([]);
            questionAt = set.questions.length - 1;
            return;
        }

        if (field === 'pool') {
            const set = ensureSet();
            const item = clean(kv.value);
            if (item && set.pool.length < QUIZ_LIMITS.pool) set.pool.push(item);
            if (set.kind !== 'ladder') set.kind = 'ladder';
            return;
        }

        const bullet = !field && BULLET_RE.test(text) ? clean(text.replace(BULLET_RE, '')) : '';
        const optionText = field === 'option' ? clean(kv.value) : bullet;

        if (optionText) {
            const set = ensureSet();
            // 擂台赛没有「题」,列表项就是池子里的选手
            if (set.kind === 'ladder' && questionAt < 0) {
                if (set.pool.length < QUIZ_LIMITS.pool) set.pool.push(optionText);
                return;
            }
            if (questionAt < 0) {
                notes.push(`第 ${lineNo} 行的选项写在「问」前面了，没收：${truncate(optionText, 16)}`);
                return;
            }
            const bucket = set.options[questionAt];
            if (bucket.length >= QUIZ_LIMITS.options) {
                notes.push(`第 ${questionAt + 1} 题的选项超过 ${QUIZ_LIMITS.options} 个，多的没收`);
                return;
            }
            bucket.push(optionText);
            return;
        }

        notes.push(`第 ${lineNo} 行没认出键名，跳过：${truncate(text, 18)}`);
    });

    return { sets: sets.map(finishSet).filter(Boolean), notes };
}

/** 收尾:补名字、补轮数、去空题。不合格的整套丢掉(返回 null)。 */
function finishSet(set) {
    const out = {
        name: set.name || (set.kind === 'ladder' ? set.prompt : set.questions[0]) || '',
        desc: set.desc,
        kind: set.kind,
        questions: [],
        options: [],
        prompt: set.prompt,
        pool: [...new Set(set.pool)],
        rounds: set.rounds,
    };
    out.name = truncate(out.name, 20) || '未命名题库';

    if (set.kind === 'ladder') {
        if (out.pool.length < 3) return null;
        if (!out.prompt) out.prompt = '这两个，她更倾向哪个？';
        const max = out.pool.length - 1;
        out.rounds = out.rounds > 0 ? Math.min(out.rounds, max) : Math.min(12, max);
        return out;
    }

    set.questions.forEach((q, i) => {
        if (!q) return;
        out.questions.push(q);
        out.options.push(set.options[i] || []);
    });
    return out.questions.length ? out : null;
}

/** 一句话概括一套题,导入预览和抽屉列表共用 */
export function describeSet(set) {
    if (!set) return '';
    if (set.kind === 'ladder') {
        const rounds = Math.min(set.rounds || 0, Math.max(0, (set.pool?.length || 0) - 1));
        return `擂台 · ${rounds} 轮 · ${set.pool?.length || 0} 个候选`;
    }
    const withOptions = (set.options || []).filter((o) => o && o.length).length;
    return `${set.questions?.length || 0} 题 · ${withOptions} 题带选项`;
}

// ============================================================
// 给用户复制的格式说明
// ============================================================

/**
 * 「复制格式说明」按钮的内容。
 *
 * 用户会把这段连同找来的题目一起发给 AI,所以它必须**自带指令口吻**,
 * 不能只是一张字段表 —— 只给表的话模型十次有三次会回一段解释。
 */
export const QUIZ_FORMAT_GUIDE = [
    '把我给你的题目改写成下面这个纯文本格式。只输出改写结果，不要解释、不要代码块。',
    '',
    '规则：',
    '1. 一行一条「键：值」，冒号全角半角都行。',
    '2. 「题库：」开一套题；一次可以写好几套，每套之间空一行。',
    '3. 「问：」是一道题，紧跟在它后面的「选：」都属于这道题，一个选项一行。',
    '4. 选项 2-4 个最好，最多 8 个。选项是给角色挑的，写成她会说出口的话，不要写 A/B/C。',
    '5. 题目要能问一个虚构角色，第二人称「你」，不要出现「玩家」「测试」这类词。',
    '6. 擂台赛（两两对比、一轮淘汰一个）写「类型：擂台」，用「提示：」写对比的问法，',
    '   用「项：」一行一个候选，可以写「轮数：12」。',
    '',
    '固定题的样子：',
    '',
    '题库：童年底色',
    '说明：8 题，问她是怎么长大的',
    '类型：固定',
    '',
    '问：小时候家里最常有的声音是什么？',
    '选：电视一直开着',
    '选：谁在厨房忙',
    '选：很安静',
    '选：外面街上的动静',
    '',
    '问：那时候你放学先去哪？',
    '选：直接回家',
    '选：绕远路',
    '选：去同学家',
    '选：随便走走',
    '',
    '擂台赛的样子：',
    '',
    '题库：她更受不了哪个',
    '类型：擂台',
    '提示：这两件事，她更能忍哪个？',
    '轮数：12',
    '项：说话不算数',
    '项：当众开她玩笑',
    '项：擅自替她做决定',
    '项：借了东西不还',
].join('\n');
