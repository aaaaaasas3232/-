/**
 * 日记 · 从 AI 的回写里解析特殊 token
 *
 * 产品要求：「AI 可以在写日记的过程中返回内容，去生成他想纪念的纪念日
 * 跟他准备去做的事」。约定的两个 token：
 *
 *   [记纪念日:名称:YYYY-MM-DD:为什么想记住]
 *   [记计划:名称:YYYY-MM-DD:一句说明]
 *
 * ── 为什么用「限次分割」而不是简单 split(':') ────────────────────
 *
 * 最后一段是自由文本，里面出现冒号是很正常的：
 *
 *   [记纪念日:第一次通话:2025-11-03:她说「等你回来:我们去看海」]
 *
 * 无脑 split 会把它切成 5 段，第 4 段变成半句话，第 5 段被丢掉。
 * 这里只切前三刀，剩下的整体当理由 —— 前三段（token 名 / 标题 / 日期）
 * 的格式是我们规定死的，不会含冒号。
 *
 * ── 解析失败怎么办 ────────────────────────────────────────────────
 *
 * **保留原文**。把一条格式不对的 token 直接删掉，用户会看到日记里
 * 莫名其妙少了一句，而且完全不知道发生了什么。宁可让它以原样留在正文里 ——
 * 至少用户看得见、能自己改。
 */

import { MARKER_KIND } from '../constants.js';
import { isValidDateKey, makeId } from '../utils.js';

/** 全角冒号也认 —— 中文输入法下模型很容易打出全角 */
const SEP = /[:：]/;

const TOKEN_KINDS = [
    { name: '记纪念日', kind: MARKER_KIND.ANNIVERSARY },
    { name: '记计划', kind: MARKER_KIND.COUNTDOWN },
];

const TOKEN_RE = /\[(记纪念日|记计划)[:：]([^\]]*)\]/g;

/**
 * 把一行 token 内容切成 [标题, 日期, 理由]。
 * 只切前两刀，第三段整体保留。
 */
function splitPayload(payload) {
    const raw = String(payload || '');
    const first = raw.search(SEP);
    if (first === -1) return [raw.trim(), '', ''];
    const title = raw.slice(0, first).trim();
    const rest = raw.slice(first + 1);
    const second = rest.search(SEP);
    if (second === -1) return [title, rest.trim(), ''];
    return [title, rest.slice(0, second).trim(), rest.slice(second + 1).trim()];
}

/**
 * 从正文里解析出 marker，并返回去掉 token 之后的干净正文。
 *
 * @param {string} text     AI 返回的正文
 * @param {string} spaceId  存到哪个日记空间
 * @returns {{ content:string, markers:object[], failed:string[] }}
 */
export function extractMarkers(text, spaceId) {
    const src = String(text || '');
    if (!src) return { content: '', markers: [], failed: [] };

    const markers = [];
    const failed = [];

    const content = src.replace(TOKEN_RE, (whole, tokenName, payload) => {
        const meta = TOKEN_KINDS.find((t) => t.name === tokenName);
        const [title, date, reason] = splitPayload(payload);

        if (!meta || !title || !isValidDateKey(date)) {
            // 格式不对：原样留在正文里，同时记一笔给调试看
            failed.push(whole);
            return whole;
        }

        markers.push({
            id: makeId('mk'),
            spaceId: String(spaceId || ''),
            kind: meta.kind,
            title,
            date,
            reason,
            // 纪念日默认每年重复（「第一次一起看雪」这类本来就是每年想起一次），
            // 计划不重复（考试考完就完了）
            repeat: meta.kind === MARKER_KIND.ANNIVERSARY ? 'yearly' : 'none',
            pinned: false,
            source: 'ai',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
        return '';
    });

    return {
        content: tidy(content),
        markers,
        failed,
    };
}

/**
 * token 被摘掉之后会留下空行。
 * 顺手把常见的模型脏输出也清掉 —— 即使 prompt 里写了「只输出正文」，
 * 模型还是会时不时加上代码围栏和「好的，以下是」。这些进了日记就是脏数据，
 * 用户每次都得手动删。
 */
export function tidy(raw) {
    let text = String(raw || '').trim();
    if (!text) return '';

    const fence = text.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
    if (fence) text = fence[1].trim();

    // 只去开头一行、且必须以冒号结尾 —— 否则会误删正文第一句
    text = text.replace(/^(?:好的|好[,，]|明白|收到)[^\n]{0,30}[:：]\s*\n+/, '');
    text = text.replace(/^(?:以下是|这是)[^\n]{0,30}[:：]\s*\n+/, '');

    // 模型偶尔会自己加个「日记」标题
    text = text.replace(/^#{1,6}\s*[^\n]{0,20}\n+/, '');

    return text.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 解析 AI 自配日记本返回的 JSON。
 *
 * 用 JSON 而不是自定义分隔符：嵌套结构用分隔符切非常脆，
 * 少一个冒号整条就废了（AGENTS2 §13.6.2）。
 *
 * 模型仍然可能加代码围栏或前后废话，所以这里做两层兜底：
 * 先剥围栏，再从文本里抠出第一个 `{...}`。
 *
 * @returns {object|null} 解析不出来返回 null，调用方回落默认配置
 */
export function parseSpaceSetup(raw) {
    let text = String(raw || '').trim();
    if (!text) return null;

    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();

    if (!text.startsWith('{')) {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end <= start) return null;
        text = text.slice(start, end + 1);
    }

    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
        return null;
    }
}
