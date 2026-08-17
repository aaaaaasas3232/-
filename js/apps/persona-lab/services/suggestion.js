/**
 * 人设机 · 修改建议的解析与应用
 *
 * ── 原型这一块的三个真实 bug ────────────────────────────────────────
 *
 * 1. **凭空造建议**。`generateSuggestions()`(5999)解析不出行号格式时会调
 *    `generateDefaultSuggestion()`(6267):它从正文里挑一个带冒号的行,
 *    把教师回复的一段话塞进去当"新内容"。用户看到的 diff 里,
 *    有相当一部分是**AI 从来没说过的修改**。这里改成:解析不出来就只显示原文,
 *    一条 diff 都不生成。
 *
 * 2. **理由会吃掉下一条建议**。`parseTeacherResponse()`(6088)的
 *    `collectingReason` 一旦打开,后面所有非空行都往理由里塞,
 *    直到遇到空行。AI 如果在建议之间没空行,第二条建议就整条变成第一条的理由。
 *    现在用成对定界符,不存在"从哪儿开始算理由"的问题。
 *
 * 3. **行号可能对不上**。原型给 AI 的行号来自 `addLineNumbersToText`,
 *    应用修改时用 `text.split('\n')` —— 两处对空行的处理不一样。
 *    现在两边都走 `utils.toLines`,并且**应用前会核对原文**:
 *    对不上就顺着找一次,再找不到就报错,不硬写。
 */

import { toLines, makeId } from '../utils.js';

const BLOCK_RE = /<<<\s*(改|加|无)\s*([\s\S]*?)>>>/;

/**
 * @typedef {object} Suggestion
 * @property {string} id
 * @property {'modify'|'insert'} kind
 * @property {number} lineNumber   modify: 要改的行;insert: 加在这一行后面(0 = 最前)
 * @property {string} original     modify 时的原文(用来核对)
 * @property {string} next         新内容
 * @property {string} reason
 * @property {number} createdAt
 */

/**
 * 解析顾问回复。
 *
 * @returns {{ note:string, suggestion:Suggestion|null, verdict:'ok'|'clean'|'unparsed' }}
 *   - `note`       块外面那段白话结论,永远展示给用户
 *   - `verdict`    ok=有建议 / clean=顾问说没问题 / unparsed=没按格式回
 */
export function parseAdvisorReply(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return { note: '', suggestion: null, verdict: 'unparsed' };

    const match = text.match(BLOCK_RE);
    if (!match) {
        return { note: text, suggestion: null, verdict: 'unparsed' };
    }

    const note = text.replace(BLOCK_RE, '').trim();
    const type = match[1];
    if (type === '无') {
        return { note: note || '这一版看下来没有明显问题。', suggestion: null, verdict: 'clean' };
    }

    const fields = parseFields(match[2]);

    if (type === '改') {
        const lineNumber = toInt(fields['行']);
        const next = fields['新'];
        if (!lineNumber || next == null) {
            return { note: text, suggestion: null, verdict: 'unparsed' };
        }
        return {
            note,
            verdict: 'ok',
            suggestion: {
                id: makeId('sug'),
                kind: 'modify',
                lineNumber,
                original: fields['原'] ?? '',
                next,
                reason: fields['因'] || '',
                createdAt: Date.now(),
            },
        };
    }

    // 加
    const after = toInt(fields['行后'], 0);
    const next = fields['新'];
    if (after == null || next == null) {
        return { note: text, suggestion: null, verdict: 'unparsed' };
    }
    return {
        note,
        verdict: 'ok',
        suggestion: {
            id: makeId('sug'),
            kind: 'insert',
            lineNumber: after,
            original: '',
            next,
            reason: fields['因'] || '',
            createdAt: Date.now(),
        },
    };
}

/**
 * 解析块里的 `键=值`。
 *
 * 值可以跨行(下一行不以 `已知键=` 开头就算续行)—— 人设里的一句话经常带换行,
 * 强行要求单行会逼 AI 把内容截断。
 */
function parseFields(body) {
    const out = {};
    const keys = ['行', '行后', '原', '新', '因'];
    const keyRe = new RegExp(`^\\s*(${keys.join('|')})\\s*=`);
    let current = null;

    for (const rawLine of String(body || '').split('\n')) {
        const hit = rawLine.match(keyRe);
        if (hit) {
            current = hit[1];
            out[current] = rawLine.slice(rawLine.indexOf('=') + 1).trim();
        } else if (current && rawLine.trim()) {
            out[current] = `${out[current]}\n${rawLine.trim()}`;
        }
    }
    return out;
}

function toInt(value, fallback = null) {
    if (value == null || value === '') return fallback;
    const n = Number(String(value).replace(/[^\d-]/g, ''));
    return Number.isFinite(n) ? n : fallback;
}

// ============================================================
// 应用
// ============================================================

/**
 * 把建议应用到正文。
 *
 * @returns {{ ok:boolean, text:string, error?:string, hitLine?:number, shifted?:boolean }}
 *   - `shifted` 为 true 表示 AI 报的行号不对、是靠内容找回来的,UI 要提示一声
 */
export function applySuggestion(text, suggestion) {
    if (!suggestion) return { ok: false, text, error: '没有待处理的建议' };
    const lines = toLines(text);

    if (suggestion.kind === 'insert') {
        const at = Math.max(0, Math.min(Number(suggestion.lineNumber) || 0, lines.length));
        const inserted = String(suggestion.next).split('\n');
        lines.splice(at, 0, ...inserted);
        return { ok: true, text: lines.join('\n'), hitLine: at + 1 };
    }

    const target = resolveLine(lines, suggestion);
    if (target.index < 0) {
        return {
            ok: false,
            text,
            error: `第 ${suggestion.lineNumber} 行现在是「${lines[suggestion.lineNumber - 1] ?? '(不存在)'}」,和建议里的原文对不上。正文可能已经改过了,让顾问重新看一遍。`,
        };
    }

    lines[target.index] = String(suggestion.next);
    return { ok: true, text: lines.join('\n'), hitLine: target.index + 1, shifted: target.shifted };
}

/**
 * 找到要改的那一行。
 *
 * 三段:行号直接命中 → 按原文全局找 → 放弃。
 * **不做模糊匹配** —— 改错行比不改坏得多,而且用户不一定会发现。
 */
function resolveLine(lines, suggestion) {
    const idx = Number(suggestion.lineNumber) - 1;
    const original = String(suggestion.original ?? '').trim();

    if (idx >= 0 && idx < lines.length) {
        if (!original || lines[idx].trim() === original) return { index: idx, shifted: false };
    }
    if (!original) return { index: -1, shifted: false };

    const found = lines.findIndex((line) => line.trim() === original);
    return found >= 0 ? { index: found, shifted: found !== idx } : { index: -1, shifted: false };
}

/** 建议在 diff 视图里怎么显示 */
export function describeSuggestion(text, suggestion) {
    if (!suggestion) return null;
    const lines = toLines(text);
    if (suggestion.kind === 'insert') {
        const at = Math.max(0, Math.min(Number(suggestion.lineNumber) || 0, lines.length));
        return {
            title: at === 0 ? '在开头插入' : `在第 ${at} 行后插入`,
            before: '',
            after: String(suggestion.next),
            anchor: at > 0 ? lines[at - 1] : '',
            reason: suggestion.reason,
        };
    }
    const target = resolveLine(lines, suggestion);
    return {
        title: target.index >= 0 ? `修改第 ${target.index + 1} 行` : `修改第 ${suggestion.lineNumber} 行`,
        before: target.index >= 0 ? lines[target.index] : String(suggestion.original || ''),
        after: String(suggestion.next),
        anchor: '',
        reason: suggestion.reason,
        stale: target.index < 0,
        shifted: target.shifted,
    };
}
