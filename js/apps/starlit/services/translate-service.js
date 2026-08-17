/**
 * 点灯 · 长按翻译
 *
 * ── 两个引擎 ──────────────────────────────────────────────────────
 *
 * local  用**学生自己的词典**（slDictEntries）逐词拼。零消耗、瞬间出、离线可用。
 *        它翻不出漂亮句子，但学生长按一句话，多半是想确认「这几个词是什么意思」，
 *        而不是要一篇译文。已经学过的词优先命中，正好复习。
 *
 * ai     真翻译。**只把这一张卡的内容发出去** —— 不带世界观、不带上下文、
 *        不带聊天历史。用户明确要求省 token，而翻译这件事本来也不需要上下文。
 *
 * ── 为什么不默认用 AI ─────────────────────────────────────────────
 * 长按是个很轻的动作，用户会按很多次。每按一次都发一次请求，
 * 额度会以他预料不到的速度消失。所以默认 local，想要准的自己去设置里换。
 *
 * ★ 本模块不碰 store、不碰 DOM。AI 调用走 ai-service，和全 App 一个口子。
 */

import { asArray } from '../utils.js';
import * as ai from './ai-service.js';

/** AI 翻译的输入上限。超过就截断 —— 一张卡再长也不该有这么多字 */
const MAX_INPUT = 900;

/**
 * 把一段文本切成「可查的词」。
 *
 * 拉丁语系按空格和标点切；中日韩没有词边界，按连续同类字符切成块。
 * 这不是分词器，也不需要是 —— 命中不了就原样留着，不影响别的词。
 */
export function tokenize(text) {
    const src = String(text || '');
    const out = [];
    // 拉丁词（允许词内 ' 和 -，比如 don't / well-known）
    const latin = /[A-Za-z][A-Za-z'’-]*/g;
    let m;
    while ((m = latin.exec(src)) !== null) {
        out.push({ raw: m[0], index: m.index });
    }
    return out;
}

/** 归一化：查词典时忽略大小写和词尾变化 */
function normalize(word) {
    return String(word || '').toLowerCase().replace(/[’']/g, "'").trim();
}

/**
 * 极简词形还原。
 * 只处理最常见的几种屈折 —— 目的是提高命中率，不是做形态学。
 */
function lemmaCandidates(word) {
    const w = normalize(word);
    if (!w) return [];
    const out = [w];
    if (w.endsWith('ies') && w.length > 4) out.push(w.slice(0, -3) + 'y');
    if (w.endsWith('es') && w.length > 3) out.push(w.slice(0, -2));
    if (w.endsWith('s') && w.length > 2) out.push(w.slice(0, -1));
    if (w.endsWith('ing') && w.length > 5) {
        out.push(w.slice(0, -3));
        out.push(w.slice(0, -3) + 'e');
    }
    if (w.endsWith('ed') && w.length > 4) {
        out.push(w.slice(0, -2));
        out.push(w.slice(0, -1));
    }
    if (w.endsWith('er') && w.length > 4) out.push(w.slice(0, -2));
    if (w.endsWith('ly') && w.length > 4) out.push(w.slice(0, -2));
    return [...new Set(out)];
}

/**
 * 用词典条目建索引。
 * @param {Array} entries slDictEntries 的记录（{ front, back, pos }）
 */
export function buildIndex(entries) {
    const map = new Map();
    for (const entry of asArray(entries)) {
        const front = normalize(entry?.front);
        if (!front || !entry?.back) continue;
        // 先来的优先 —— 用户自己加的词条排在 AI 加的前面时会先命中
        if (!map.has(front)) {
            map.set(front, { back: String(entry.back).trim(), pos: String(entry.pos || '').trim() });
        }
    }
    return map;
}

/**
 * 本地翻译。
 *
 * @returns {{ ok:boolean, kind:'local', hits:Array, missed:number, text:string }}
 *   `text` 是拼出来的「词 = 释义」串；命中为 0 时 ok 为 false，
 *   让调用方能提示「这句里的词你还没学过，换 AI 试试」。
 */
export function translateLocal(input, entries) {
    const index = buildIndex(entries);
    const tokens = tokenize(input);

    const hits = [];
    const seen = new Set();
    let missed = 0;

    for (const token of tokens) {
        let found = null;
        for (const candidate of lemmaCandidates(token.raw)) {
            if (index.has(candidate)) { found = index.get(candidate); break; }
        }
        if (!found) { missed += 1; continue; }
        const key = normalize(token.raw);
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push({ word: token.raw, pos: found.pos, meaning: found.back });
    }

    return {
        ok: hits.length > 0,
        kind: 'local',
        hits,
        missed,
        text: hits.map((h) => `${h.word} ${h.pos ? h.pos + ' ' : ''}${h.meaning}`).join('　'),
    };
}

/**
 * AI 翻译。
 *
 * ★ 省 token 的三条硬约束（用户明确要求）：
 *   1. 只发这张卡的内容，不带任何上下文
 *   2. system 提示词压到最短
 *   3. 让它只回译文，不要解释、不要原文、不要 JSON 壳
 *
 * @param {string} input     要翻的内容（调用方已经拼好，通常就是这张卡的正文）
 * @param {object} opts
 * @param {string} opts.target 目标语言名（只是给模型一个方向，可空）
 */
export async function translateWithAi(input, opts = {}) {
    const body = String(input || '').trim().slice(0, MAX_INPUT);
    if (!body) return { ok: false, kind: 'ai', error: '没有可翻译的内容' };

    const target = String(opts.target || '').trim();
    const system = target
        ? `把用户给的${target}内容翻成自然的中文。只输出译文，不要解释，不要重复原文。`
        : '把用户给的内容翻成自然的中文。只输出译文，不要解释，不要重复原文。';

    const res = await ai.generateText({
        system,
        user: body,
        temperature: 0.3,
        timeout: 45000,
    });

    if (!res.ok) return { ok: false, kind: 'ai', error: res.error };

    // 模型爱加「译文：」「以下是翻译」这类前缀，剥掉
    const text = String(res.raw || '')
        .replace(/^\s*(译文|翻译|中文)\s*[:：]\s*/i, '')
        .replace(/^\s*以下是.*?[:：]\s*/i, '')
        .trim();

    if (!text) return { ok: false, kind: 'ai', error: 'AI 返回了空译文' };
    return { ok: true, kind: 'ai', text };
}

/**
 * 统一入口。engine 决定走哪条路。
 *
 * @param {string} input
 * @param {object} ctx { engine, entries, target }
 */
export async function translate(input, ctx = {}) {
    const engine = ctx.engine === 'ai' ? 'ai' : 'local';

    if (engine === 'local') {
        const result = translateLocal(input, ctx.entries);
        if (result.ok) return result;
        return {
            ok: false,
            kind: 'local',
            hits: [],
            missed: result.missed,
            error: '这段里的词你的词典里还没有。到「我的」里把长按翻译换成 AI，或者先把词学进词典。',
        };
    }

    if (!ai.hasUsableApi()) {
        return { ok: false, kind: 'ai', error: '还没有可用的 API Key，先去「设置 → API 管理」加一个，或者改用本地词典。' };
    }
    return translateWithAi(input, { target: ctx.target });
}

/**
 * 从一张卡里抽出「该翻什么」。
 *
 * ★ 这就是「最多把这个卡片内容发给 AI」那条要求的落点：
 *   上限在这里，调用方拿不到比这更多的东西。
 */
export function cardTranslatableText(card) {
    if (!card) return '';
    const parts = [];

    if (card.type === 'word') {
        const w = card.word || {};
        parts.push(w.term || card.title);
        for (const ex of asArray(w.examples)) parts.push(ex);
    } else if (card.type === 'post') {
        parts.push(card.title);
        parts.push(card.post?.excerpt || card.brief);
    } else if (card.type === 'quiz') {
        const q = card.quiz || {};
        parts.push(q.q);
        for (const opt of asArray(q.options)) parts.push(opt);
    } else {
        parts.push(card.title);
        parts.push(card.brief);
        parts.push(card.body);
    }

    return parts.map((p) => String(p || '').trim()).filter(Boolean).join('\n').slice(0, MAX_INPUT);
}

export default translate;
