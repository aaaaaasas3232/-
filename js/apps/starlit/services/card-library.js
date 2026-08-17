/**
 * 点灯 · 卡片库（复用）
 *
 * 第一节讲盒模型的 padding，第二节讲 margin —— 都是盒模型。
 * 第二节没必要再让 AI 重画一张「盒模型」概念卡：
 * 直接从这个主题的卡片库里把那张调出来，挂到第二节课名下就行。
 *
 * 省的不只是 token，更重要的是**同一个概念在推理墙上只有一张卡**。
 * 每讲一次就多一张重复卡，墙很快就没法看了。
 *
 * 纯函数 + 一点点字符串相似度，不调 AI（判重要是也调 AI，就本末倒置了）。
 */

import { asArray, tokenizeWords } from '../utils.js';

/** 归一化：去掉大小写、标点、常见修饰词 */
function normalize(text) {
    return String(text || '')
        .toLocaleLowerCase()
        .replace(/[\s\u3000·・、，,。.；;：:！!？?（）()【】\[\]「」“”"'`~*_-]+/g, '');
}

function tokenSet(card) {
    const bag = [
        card?.title,
        card?.brief,
        ...asArray(card?.tags),
        card?.word?.term,
    ].filter(Boolean).join(' ');
    return new Set(tokenizeWords(bag).map((w) => w.toLocaleLowerCase()));
}

function jaccard(a, b) {
    if (a.size === 0 || b.size === 0) return 0;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter += 1;
    return inter / (a.size + b.size - inter);
}

/**
 * 这张新卡是不是已经有了？
 *
 * 判定顺序（先严后松）：
 *   1. 标题归一化后完全相同 → 一定是同一张
 *   2. 词卡的 term 相同 → 同一个词
 *   3. 标题包含关系 + 类型相同 → 很可能是同一张
 *   4. 标签词集合相似度超阈值 → 疑似
 *
 * @returns {{ card: object, reason: string, score: number } | null}
 */
export function findDuplicate(draft, existing) {
    if (!draft?.title) return null;
    const key = normalize(draft.title);
    const pool = asArray(existing).filter((c) => c && c.id);
    if (pool.length === 0 || !key) return null;

    for (const card of pool) {
        if (normalize(card.title) === key) {
            return { card, reason: 'title', score: 1 };
        }
    }

    if (draft.type === 'word' && draft.word?.term) {
        const term = normalize(draft.word.term);
        for (const card of pool) {
            if (card.type === 'word' && normalize(card.word?.term) === term) {
                return { card, reason: 'term', score: 1 };
            }
        }
    }

    let best = null;
    const draftTokens = tokenSet(draft);
    for (const card of pool) {
        if (card.type !== draft.type) continue;
        const other = normalize(card.title);
        if (other && (other.includes(key) || key.includes(other))) {
            const score = Math.min(other.length, key.length) / Math.max(other.length, key.length);
            if (score >= 0.62 && (!best || score > best.score)) {
                best = { card, reason: 'contains', score };
            }
        }
        const sim = jaccard(draftTokens, tokenSet(card));
        if (sim >= 0.58 && (!best || sim > best.score)) {
            best = { card, reason: 'tags', score: sim };
        }
    }
    return best;
}

/**
 * 一批草稿过一遍库：分成「要新建的」和「复用已有的」。
 *
 * @returns {{ creates: Array, reuses: Array<{draft, card, reason}> }}
 */
export function dedupeDrafts(drafts, existing) {
    const creates = [];
    const reuses = [];
    // 本批内部也要判重：AI 偶尔会在同一次结课里给两张一样的卡
    const pool = asArray(existing).slice();

    for (const draft of asArray(drafts)) {
        if (!draft) continue;
        const hit = findDuplicate(draft, pool);
        if (hit) {
            reuses.push({ draft, card: hit.card, reason: hit.reason });
        } else {
            creates.push(draft);
            // 先把它当成「已存在」，防止同批重复
            pool.push({ ...draft, id: draft.tmpId || `pending_${creates.length}` });
        }
    }
    return { creates, reuses };
}

/**
 * 按关键词搜卡片库（用户在墙上手动找卡复用时用）。
 * 按相关度排序：标题命中 > 标签命中 > 正文命中。
 */
export function search(cards, keyword, { limit = 30 } = {}) {
    const key = String(keyword || '').trim().toLocaleLowerCase();
    const list = asArray(cards).filter((c) => c && c.id);
    if (!key) return list.slice(0, limit);

    const scored = [];
    for (const card of list) {
        const title = String(card.title || '').toLocaleLowerCase();
        const tags = asArray(card.tags).join(' ').toLocaleLowerCase();
        const body = `${card.brief || ''} ${card.body || ''}`.toLocaleLowerCase();
        let score = 0;
        if (title.includes(key)) score += 10 + (title.startsWith(key) ? 4 : 0);
        if (tags.includes(key)) score += 5;
        if (body.includes(key)) score += 2;
        if (score > 0) scored.push({ card, score });
    }
    return scored
        .sort((a, b) => b.score - a.score || (b.card.updatedAt || 0) - (a.card.updatedAt || 0))
        .slice(0, limit)
        .map((x) => x.card);
}

/**
 * 一张卡被第几节课用过 —— 复用的证据，显示在卡片详情里。
 * 让学生看见「这张卡我在第 1、3、5 节都碰到过」，本身就是一种强化。
 */
export function usageLabel(card, lessons) {
    const ids = new Set(asArray(card?.usedInLessons).map(String));
    if (card?.lessonId) ids.add(String(card.lessonId));
    const hits = asArray(lessons)
        .filter((l) => ids.has(String(l.id)))
        .map((l) => l.index)
        .filter(Boolean)
        .sort((a, b) => a - b);
    if (hits.length === 0) return '';
    if (hits.length === 1) return `第 ${hits[0]} 节`;
    return `第 ${hits.join('、')} 节都用到`;
}
