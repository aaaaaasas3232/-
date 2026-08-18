/**
 * 点灯 · 技能块解析
 *
 * 把老师的一条回复拆成「正文 + 若干技能」。
 *
 * 协议见 prompt-builder.js：正文之外是若干个 ```starlit 围栏块，
 * 块里是 JSON，用 kind 区分类型。
 *
 * ── 设计原则 ──────────────────────────────────────────────────────
 * 模型总会犯错，所以这里**每一步都能坏**：
 *   - 围栏名写错（starlit / Starlit / sl）→ 都认
 *   - 围栏和 JSON 写在同一行 / 忘了三个反引号 / 忘了闭合 → 都尽量抠出来
 *   - JSON 尾巴多个逗号 → 修一下再解析
 *   - kind 拼错 / 缺字段 → 丢掉这一块，正文照常显示
 * 绝不能因为一个块坏了就让整条回复消失，更不能把 JSON 原文显示成气泡。
 */

import { CARD_TYPES, LINK_KINDS } from '../constants.js';
import { asArray, hostOf, safeHttpUrl, truncate, uid } from '../utils.js';

/** 认得的 kind。和 prompt-builder 里写的那份必须对齐。 */
const KNOWN_KINDS = new Set([
    'gloss', 'correct', 'word', 'concept', 'code', 'post',
    'quiz', 'dict', 'stuck', 'objective', 'reuse', 'end',
]);

const LINK_KIND_IDS = new Set(LINK_KINDS.map((k) => k.id));

const FENCE_OPEN_RE = /(?:```|~~~)[ \t]*(?:starlit|sl|star-lit)\b[ \t]*/gi;
const BARE_LABEL_RE = /(?:```|~~~)?[ \t]*(?:starlit|sl|star-lit)[ \t]*$/i;

/**
 * 宽容 JSON 解析。模型最常犯的两个错：
 *   1. 对象/数组最后多一个逗号
 *   2. 用了中文引号
 */
/** 模型常在 JSON 字符串里直接回车。标准 JSON 不允许，先把字符串内的裸换行转成 \n。 */
function escapeRawBreaksInStrings(text) {
    let out = '';
    let inStr = false;
    let esc = false;
    for (const ch of String(text || '')) {
        if (inStr) {
            if (esc) { out += ch; esc = false; continue; }
            if (ch === '\\') { out += ch; esc = true; continue; }
            if (ch === '"') { out += ch; inStr = false; continue; }
            if (ch === '\n') { out += '\\n'; continue; }
            if (ch === '\r') continue;
            out += ch;
            continue;
        }
        if (ch === '"') inStr = true;
        out += ch;
    }
    return out;
}

function looseParse(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;
    try { return JSON.parse(text); } catch (_) { /* 继续修 */ }

    const fixed = escapeRawBreaksInStrings(text)
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(fixed); } catch (_) { /* 继续 */ }

    // 最后一招：只取第一个完整的 {...}
    const start = fixed.indexOf('{');
    const end = fixed.lastIndexOf('}');
    if (start !== -1 && end > start) {
        try { return JSON.parse(fixed.slice(start, end + 1)); } catch (_) { /* 放弃 */ }
    }
    return null;
}

/** 从 start 起扫一个完整的 {...} 或 [...]，字符串里的括号不算。扫不到返回 null。 */
function scanJsonValue(text, start) {
    const first = text[start];
    if (first !== '{' && first !== '[') return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i += 1) {
        const ch = text[i];
        if (inStr) {
            if (esc) { esc = false; continue; }
            if (ch === '\\') { esc = true; continue; }
            if (ch === '"') inStr = false;
            continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === '{' || ch === '[') depth += 1;
        else if (ch === '}' || ch === ']') {
            depth -= 1;
            if (depth === 0) return { raw: text.slice(start, i + 1), end: i + 1 };
        }
    }
    return null;
}

function skillKind(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return '';
    return String(data.kind || '').trim().toLowerCase();
}

function isSkillObject(data) {
    return KNOWN_KINDS.has(skillKind(data));
}

/**
 * 把一段 payload 里所有技能对象抠出来。
 * 认：单个对象、对象数组、一个围栏里连续几个对象。
 * @returns {number} 吸收了几条技能
 */
function collectSkills(payload, skills) {
    let count = 0;
    const eat = (data) => {
        if (isSkillObject(data)) {
            skills.push({ ...data, kind: skillKind(data) });
            count += 1;
            return;
        }
        if (Array.isArray(data)) data.forEach(eat);
    };

    const parsed = looseParse(payload);
    if (parsed) {
        eat(parsed);
        if (count) return count;
    }

    const src = String(payload || '');
    let i = 0;
    while (i < src.length) {
        const ch = src[i];
        if (ch !== '{' && ch !== '[') { i += 1; continue; }
        const scanned = scanJsonValue(src, i);
        if (!scanned) { i += 1; continue; }
        eat(looseParse(scanned.raw));
        i = scanned.end;
    }
    return count;
}

function findFences(source) {
    const out = [];
    FENCE_OPEN_RE.lastIndex = 0;
    let m = FENCE_OPEN_RE.exec(source);
    while (m) {
        let bodyStart = m.index + m[0].length;
        if (source[bodyStart] === '\r') bodyStart += 1;
        if (source[bodyStart] === '\n') bodyStart += 1;
        const rest = source.slice(bodyStart);
        const close = rest.search(/(?:```|~~~)/);
        const bodyEnd = close === -1 ? source.length : bodyStart + close;
        const fenceEnd = close === -1 ? source.length : bodyStart + close + 3;
        out.push({ start: m.index, end: fenceEnd, body: source.slice(bodyStart, bodyEnd) });
        FENCE_OPEN_RE.lastIndex = fenceEnd;
        m = FENCE_OPEN_RE.exec(source);
    }
    return out;
}

function labelStart(text, jsonStart) {
    const before = text.slice(0, jsonStart);
    const m = before.match(BARE_LABEL_RE);
    return m ? jsonStart - m[0].length : jsonStart;
}

/**
 * 拆一条回复。
 * @returns {{ text:string, skills:Array<object>, broken:number }}
 */
export function parseReply(raw) {
    const source = String(raw || '');
    const skills = [];
    let broken = 0;

    // ① 正规 / 半正规围栏（三个反引号可跟 JSON 写在同一行，也可以忘了闭合）
    let rest = '';
    let cursor = 0;
    for (const fence of findFences(source)) {
        rest += source.slice(cursor, fence.start);
        if (!collectSkills(fence.body, skills)) broken += 1;
        cursor = fence.end;
    }
    rest += source.slice(cursor);

    // ② 围栏丢了：`starlit { ... }` 或裸的 `{"kind":"gloss",...}`
    let cleaned = '';
    let pos = 0;
    while (pos < rest.length) {
        const brace = rest.indexOf('{', pos);
        const bracket = rest.indexOf('[', pos);
        const hits = [brace, bracket].filter((n) => n >= 0);
        if (!hits.length) {
            cleaned += rest.slice(pos);
            break;
        }
        const start = Math.min(...hits);
        const scanned = scanJsonValue(rest, start);
        if (!scanned) {
            cleaned += rest.slice(pos, start + 1);
            pos = start + 1;
            continue;
        }
        const before = skills.length;
        collectSkills(scanned.raw, skills);
        if (skills.length > before) {
            cleaned += rest.slice(pos, labelStart(rest, start));
            pos = scanned.end;
            continue;
        }
        cleaned += rest.slice(pos, scanned.end);
        pos = scanned.end;
    }

    return {
        text: cleaned.replace(/\n{3,}/g, '\n\n').trim(),
        skills,
        broken,
    };
}

/**
 * 这条气泡是不是技能协议的残骸（围栏名、JSON 碎片、数组续行）。
 * 用来把已经落盘的坏消息拼回去再解析。
 */
export function looksLikeSkillDebris(text) {
    const s = String(text || '').trim();
    if (!s) return false;
    if (/^(?:```|~~~)?\s*(?:starlit|sl|star-lit)\b/i.test(s)) return true;
    if (/^\{\s*"kind"\s*:/.test(s)) return true;
    if (/^",/.test(s)) return true;
    if (/^"\s*[}\]]/.test(s)) return true;
    if (/"kind"\s*:\s*"(?:gloss|correct|word|concept|code|post|quiz|dict|stuck|objective|reuse|end)"/.test(s)
        && /(?:```|~~~|starlit|"texts"\s*:)/i.test(s)) return true;
    return false;
}

/** 取第一个某类技能 */
export function firstSkill(skills, kind) {
    return asArray(skills).find((s) => s?.kind === kind) || null;
}

/**
 * 把 gloss 块归一成字符串数组。
 *
 * 认三种写法，因为模型三种都会写：
 *   {"kind":"gloss","texts":["a","b"]}   新协议
 *   {"kind":"gloss","text":"a"}          老协议（单段）
 *   {"kind":"gloss","text":["a","b"]}    模型手滑把数组塞进 text
 *
 * ★ 一条都取不到时返回空数组，而不是 [''] ——
 *   调用方要靠「有没有」决定要不要显示翻译层。
 */
export function glossTexts(skill) {
    if (!skill) return [];
    const raw = Array.isArray(skill.texts) ? skill.texts
        : Array.isArray(skill.text) ? skill.text
            : [skill.text];
    return asArray(raw).map((t) => String(t || '').trim()).filter(Boolean);
}

export function allSkills(skills, kind) {
    return asArray(skills).filter((s) => s?.kind === kind);
}

// ============================================================
// 技能 → 卡片草稿
// ============================================================

function normFocus(list) {
    return asArray(list).map((f) => ({
        lang: ['html', 'css', 'js'].includes(String(f?.lang || '').toLowerCase())
            ? String(f.lang).toLowerCase() : 'html',
        line: Math.max(1, Number(f?.line) || 1),
        mark: Math.min(4, Math.max(1, Number(f?.mark) || 1)),
        note: String(f?.note || '').trim(),
    })).filter((f) => f.note || f.line);
}

function normRoots(list) {
    return asArray(list).map((r) => {
        if (typeof r === 'string') return { part: r, from: '', means: '' };
        return {
            part: String(r?.part || '').trim(),
            from: String(r?.from || '').trim(),
            means: String(r?.means || '').trim(),
        };
    }).filter((r) => r.part || r.means);
}

function normTags(list) {
    return asArray(list)
        .map((t) => String(t || '').trim().slice(0, 20))
        .filter(Boolean)
        .slice(0, 8);
}

/**
 * 把一个技能块变成「卡片草稿」（还没有 id / 坐标 / profileKey）。
 * 不认识的 kind 返回 null。
 */
export function skillToCardDraft(skill) {
    if (!skill) return null;
    const kind = skill.kind;

    if (kind === 'word') {
        const term = String(skill.term || skill.title || '').trim();
        if (!term) return null;
        const pos = String(skill.pos || '').trim();
        const meaning = String(skill.meaning || '').trim();
        return {
            type: CARD_TYPES.word,
            title: term,
            brief: [pos, meaning].filter(Boolean).join(' '),
            body: String(skill.why || '').trim(),
            word: {
                term,
                pos,
                meaning,
                roots: normRoots(skill.roots),
                examples: asArray(skill.examples).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 4),
            },
            tags: normTags(skill.tags),
        };
    }

    if (kind === 'concept') {
        const title = String(skill.title || '').trim();
        if (!title) return null;
        return {
            type: CARD_TYPES.concept,
            title,
            brief: String(skill.brief || '').trim() || truncate(String(skill.body || ''), 46),
            body: [String(skill.body || '').trim(), String(skill.origin || '').trim() && `【由来】${skill.origin}`]
                .filter(Boolean).join('\n\n'),
            tags: normTags(skill.tags),
        };
    }

    if (kind === 'code') {
        const src = skill.code && typeof skill.code === 'object' ? skill.code : skill;
        const html = String(src.html || '');
        const css = String(src.css || '');
        const js = String(src.js || '');
        if (!html && !css && !js) return null;
        return {
            type: CARD_TYPES.code,
            title: String(skill.title || '代码').trim(),
            brief: String(skill.brief || '').trim(),
            body: String(skill.origin || skill.why || '').trim(),
            code: {
                html, css, js,
                focus: normFocus(src.focus),
                disabled: [],
                previewH: 180,
            },
            tags: normTags(skill.tags),
        };
    }

    if (kind === 'post') {
        const url = safeHttpUrl(skill.url);
        // 链接不合法就整张卡不要 —— 帖子卡的全部价值就是那个链接能点开
        if (!url) return null;
        return {
            type: CARD_TYPES.post,
            title: String(skill.title || hostOf(url)).trim(),
            brief: truncate(String(skill.excerpt || '').trim(), 60),
            body: String(skill.excerpt || '').trim(),
            post: { url, host: hostOf(url), excerpt: String(skill.excerpt || '').trim() },
            tags: normTags(skill.tags),
        };
    }

    if (kind === 'quiz') {
        const q = String(skill.q || '').trim();
        const options = asArray(skill.options).map((x) => String(x || '').trim()).filter(Boolean);
        if (!q || options.length < 2) return null;
        return {
            type: CARD_TYPES.quiz,
            title: truncate(q, 24),
            brief: `${options.length} 选 1`,
            body: '',
            quiz: {
                q,
                options,
                answer: Math.min(options.length - 1, Math.max(0, Number(skill.answer) || 0)),
                why: String(skill.why || '').trim(),
            },
            tags: normTags(skill.tags),
        };
    }

    return null;
}

/** 词典条目草稿（一个 dict 块可能带多条） */
export function skillToDictDrafts(skill) {
    if (skill?.kind !== 'dict') return [];
    const items = asArray(skill.items).length ? asArray(skill.items) : [skill];
    return items.map((it) => ({
        front: String(it?.front || it?.term || '').trim(),
        pos: String(it?.pos || '').trim(),
        back: String(it?.back || it?.meaning || '').trim(),
        hint: String(it?.hint || '').trim(),
        by: 'ai',
    })).filter((x) => x.front && x.back);
}

/** 卡住点草稿 */
export function skillToStuckDraft(skill) {
    if (skill?.kind !== 'stuck') return null;
    const point = String(skill.point || '').trim();
    if (!point) return null;
    return {
        point,
        why: String(skill.why || '').trim(),
        prerequisite: String(skill.prerequisite || '').trim(),
        lessonIndex: Number(skill.lessonIndex) || 0,
    };
}

// ============================================================
// 结课 JSON → 卡片 / 连线
// ============================================================

/**
 * 结课时 AI 返回的 cards 数组和技能块格式略有不同（多了 tmpId），
 * 这里统一成草稿，并保留 tmpId 供连线映射。
 */
export function summaryCardsToDrafts(list) {
    return asArray(list).map((raw) => {
        const type = String(raw?.type || 'concept').toLowerCase();
        const draft = skillToCardDraft({ ...raw, kind: type === 'note' ? 'concept' : type });
        if (!draft) return null;
        return { ...draft, tmpId: String(raw?.tmpId || raw?.id || uid('tmp')) };
    }).filter(Boolean);
}

/**
 * 结课的 links：from/to 可能是 tmpId 也可能是真实 cardId。
 * @param {Map<string,string>} idMap tmpId → 真实 id
 */
export function summaryLinksToDrafts(list, idMap) {
    const map = idMap instanceof Map ? idMap : new Map();
    const seen = new Set();
    return asArray(list).map((raw) => {
        const from = map.get(String(raw?.from)) || String(raw?.from || '');
        const to = map.get(String(raw?.to)) || String(raw?.to || '');
        if (!from || !to || from === to) return null;
        // 同一对卡片只连一条（AI 有时会正反各连一次）
        const key = [from, to].sort().join('>');
        if (seen.has(key)) return null;
        seen.add(key);
        const kind = String(raw?.kind || 'because').toLowerCase();
        return {
            from,
            to,
            kind: LINK_KIND_IDS.has(kind) ? kind : 'because',
            label: truncate(String(raw?.label || '').trim(), 24),
            by: 'ai',
        };
    }).filter(Boolean);
}
