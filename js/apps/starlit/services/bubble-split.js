/**
 * 点灯 · 把老师的一条回复拆成若干短气泡
 *
 * ── 为什么要拆 ────────────────────────────────────────────────────
 *
 * 语言模式下每个气泡旁边要贴一行描边中文。气泡一长，中文就没处放了：
 * 要么盖住外文，要么被挤出屏幕。所以气泡必须短 —— 一两行，中文正好贴得下。
 *
 * ── 两条来源，优先级不同 ──────────────────────────────────────────
 *
 * 1. **老师自己分好的**：正文里用空行分段，一段一个气泡。
 *    这是首选 —— 模型知道哪句和哪句该待在一起。
 * 2. **本地兜底**：模型不分段时，按句子边界切。
 *    中英文的句末标点不一样，两套都要认。
 *
 * ★ 纯函数模块，不 import 运行时依赖，node 里可以直接测。
 */

import { BUBBLE_SPLIT } from '../constants.js';

/**
 * 视觉宽度：中日韩全角字符算 2，其余算 1。
 * 用字符数当上限的话，一行中文和一行英文的实际长度差一倍。
 */
export function visualWidth(text) {
    let width = 0;
    for (const ch of String(text || '')) {
        const code = ch.codePointAt(0);
        // CJK 统一表意文字 + 全角标点 + 假名 + 谚文
        const wide = (code >= 0x1100 && code <= 0x115f)
            || (code >= 0x2e80 && code <= 0xa4cf)
            || (code >= 0xac00 && code <= 0xd7a3)
            || (code >= 0xf900 && code <= 0xfaff)
            || (code >= 0xfe30 && code <= 0xfe6f)
            || (code >= 0xff00 && code <= 0xff60)
            || (code >= 0xffe0 && code <= 0xffe6);
        width += wide ? 2 : 1;
    }
    return width;
}

/**
 * 按句末标点切句。
 * 标点跟着前一句走 —— 切在标点前面会得到一堆以「。」开头的碎片。
 */
function splitSentences(text) {
    const src = String(text || '').trim();
    if (!src) return [];

    const out = [];
    let buf = '';

    for (const ch of src) {
        buf += ch;
        // 中文句末 + 英文句末。英文的 . ! ? 后面通常还有空格，这里不强求
        if (/[。！？；!?;]/.test(ch)) {
            out.push(buf.trim());
            buf = '';
        }
    }
    if (buf.trim()) out.push(buf.trim());

    // 英文里 "Mr. Smith" 这种会被误切。把过短的碎片并回前一句。
    const merged = [];
    for (const piece of out) {
        if (merged.length && visualWidth(piece) < 6) {
            merged[merged.length - 1] += ' ' + piece;
        } else {
            merged.push(piece);
        }
    }
    return merged;
}

/**
 * 把一段长文按宽度装进若干气泡。
 * 句子本身就超长时不硬切 —— 切在词中间比长一点更难读。
 */
function packSentences(sentences, maxWidth) {
    const out = [];
    let buf = '';

    for (const sentence of sentences) {
        if (!buf) {
            buf = sentence;
            continue;
        }
        if (visualWidth(buf) + visualWidth(sentence) + 1 <= maxWidth) {
            buf += ' ' + sentence;
        } else {
            out.push(buf);
            buf = sentence;
        }
    }
    if (buf) out.push(buf);
    return out;
}

/**
 * 主入口。
 *
 * @param {string} text     老师的正文
 * @param {object} opts
 * @param {boolean} opts.enabled   关掉就原样返回一条
 * @param {number}  opts.maxChars  单泡软上限（视觉宽度）
 * @param {number}  opts.maxBubbles
 * @returns {string[]} 至少一条；text 为空时返回空数组
 */
export function splitBubbles(text, opts = {}) {
    const src = String(text || '').trim();
    if (!src) return [];

    const enabled = opts.enabled !== false;
    if (!enabled) return [src];

    const maxChars = Number(opts.maxChars) || BUBBLE_SPLIT.maxChars;
    const maxBubbles = Number(opts.maxBubbles) || BUBBLE_SPLIT.maxBubbles;
    const minTail = Number(opts.minTail) || BUBBLE_SPLIT.minTail;

    // ① 老师自己用空行分好的段，优先尊重
    const paragraphs = src.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

    let pieces = [];
    for (const para of paragraphs) {
        // 段内如果还是很长，再按句子装箱
        if (visualWidth(para) <= maxChars) {
            pieces.push(para);
        } else {
            pieces.push(...packSentences(splitSentences(para), maxChars));
        }
    }

    // ② 单行没分段但很长 —— 上面那一轮已经处理了，这里兜住空结果
    if (!pieces.length) pieces = [src];

    // ③ 太短的尾巴并回去，别留只有两个字的孤儿泡
    const tidied = [];
    for (const piece of pieces) {
        if (tidied.length && visualWidth(piece) < minTail) {
            tidied[tidied.length - 1] += ' ' + piece;
        } else {
            tidied.push(piece);
        }
    }

    // ④ 超出上限的部分全部并进最后一泡 —— 宁可最后一条长，也不要刷屏
    if (tidied.length > maxBubbles) {
        const head = tidied.slice(0, maxBubbles - 1);
        head.push(tidied.slice(maxBubbles - 1).join(' '));
        return head;
    }

    return tidied;
}

/**
 * 把老师给的翻译对齐到气泡上。
 *
 * 老师可以给一个数组（每泡一条），也可能只给一整段。
 * 数量对不上、或一整段中文被堆在第一个气泡上时，按句切开再按气泡宽度分摊。
 *
 * @param {string[]} bubbles
 * @param {string[]|string} gloss
 * @returns {string[]} 和 bubbles 等长
 */
export function alignGloss(bubbles, gloss) {
    const list = Array.isArray(bubbles) ? bubbles : [];
    if (!list.length) return [];

    const pieces = Array.isArray(gloss)
        ? gloss.map((g) => String(g || '').trim()).filter(Boolean)
        : String(gloss || '').trim() ? [String(gloss).trim()] : [];
    if (!pieces.length) return list.map(() => '');

    if (pieces.length === list.length && !glossNeedsRedistribute(list, pieces)) {
        return pieces;
    }

    const sentences = pieces.flatMap((p) => {
        const paras = String(p).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
        const src = paras.length ? paras : [p];
        return src.flatMap((para) => splitSentences(para));
    }).filter(Boolean);

    if (!sentences.length) return list.map(() => '');
    if (sentences.length === list.length) return sentences;
    return distributeByWidth(sentences, list);
}

function compactText(value) {
    return String(value || '').replace(/\s+/g, '');
}

/** 某一条译文明显装着后面几泡的内容，就要重切 */
function glossNeedsRedistribute(bodies, glosses) {
    for (let i = 0; i < bodies.length; i += 1) {
        const g = compactText(glosses[i]);
        if (!g) continue;
        if (visualWidth(glosses[i]) > visualWidth(bodies[i]) * 1.8 && splitSentences(glosses[i]).length > 1) {
            return true;
        }
        for (let j = i + 1; j < bodies.length; j += 1) {
            const later = compactText(bodies[j]);
            if (later.length > 6 && g.includes(later)) return true;
        }
    }
    return false;
}

function joinGlossParts(parts) {
    let s = '';
    for (const p of parts) {
        const t = String(p || '').trim();
        if (!t) continue;
        if (!s) { s = t; continue; }
        s += /[。！？；、…)]$/.test(s) ? t : ` ${t}`;
    }
    return s;
}

function distributeByWidth(sentences, bubbles) {
    const buckets = bubbles.map(() => []);
    const totalBody = bubbles.reduce((sum, b) => sum + Math.max(visualWidth(b), 1), 0);
    const totalGloss = sentences.reduce((sum, g) => sum + visualWidth(g), 0) || 1;
    let si = 0;
    for (let bi = 0; bi < bubbles.length; bi += 1) {
        if (bi === bubbles.length - 1) {
            while (si < sentences.length) buckets[bi].push(sentences[si++]);
            break;
        }
        const target = (Math.max(visualWidth(bubbles[bi]), 1) / totalBody) * totalGloss;
        let acc = 0;
        while (si < sentences.length) {
            const leftBubbles = bubbles.length - bi;
            const leftSentences = sentences.length - si;
            if (buckets[bi].length && leftSentences < leftBubbles) break;
            const w = visualWidth(sentences[si]);
            if (acc > 0 && acc + w > target * 1.25) break;
            buckets[bi].push(sentences[si]);
            acc += w;
            si += 1;
            if (acc >= target * 0.7 && leftSentences - 1 >= leftBubbles - 1) break;
        }
    }
    return buckets.map(joinGlossParts);
}

/**
 * 上课气泡的最终正文 / 描边。
 *
 * 模型有时把课上要说的话只写进 gloss、正文留空。
 * 那种情况把 gloss 当正文用，描边也挂上同一句 —— 语言课必须看得见中文描边。
 */
export function resolveLessonBubbles(text, gloss, opts = {}) {
    const glossList = Array.isArray(gloss)
        ? gloss.map((g) => String(g || '').trim()).filter(Boolean)
        : String(gloss || '').trim() ? [String(gloss).trim()] : [];
    const bodies = splitBubbles(text, opts);
    if (bodies.length) return { bodies, glosses: alignGloss(bodies, glossList) };
    if (glossList.length) return { bodies: glossList, glosses: [...glossList] };
    return { bodies: [], glosses: [] };
}

export default splitBubbles;
