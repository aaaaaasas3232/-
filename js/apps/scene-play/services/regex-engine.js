/**
 * 情景聊天 · 正则替换引擎
 *
 * ── 干什么 ────────────────────────────────────────────────────────
 *
 * 把一条消息的正文按用户定义的正则切开,匹配到的片段渲染成**卡片**
 * (博客体 / 日记体 / 对话体左右 / 便签),没匹配到的照常当正文。
 *
 * 比如规则 `\[博客[:：]([^|\]]+)\|([\s\S]+?)\]` 配上「标题 = 第 1 组、
 * 正文 = 第 2 组、卡片 = 博客体」,AI 写出 `[博客:今天的海|风很大…]` 就会
 * 渲染成一张博客卡。
 *
 * ── 为什么不让用户写 HTML 模板 ────────────────────────────────────
 *
 * 第一版设计是「规则里带一段 HTML 模板,用 $1 $2 占位」。放弃了,因为:
 *
 *   1. **那是一个 XSS 口子**,而且是用户自己给自己开的 —— AI 的输出会
 *      直接落进模板,提示词注入就能让它吐出 `<img onerror=…>`。
 *   2. 模板写错了没有任何提示,只会渲染出一坨乱的东西。
 *
 * 现在的模型是:**规则选一个卡片类型 + 把捕获组映射到卡片的槽位**。
 * 样式想改就改 CSS 变量(`styleVars`),那是安全的 —— 最坏结果是卡片变丑,
 * 不会执行任何东西。表达力少了一点,换来「不可能出错」。
 *
 * ── 安全边界 ──────────────────────────────────────────────────────
 *
 * - 每一段文本(包括捕获组)进 HTML 之前一律 `escapeHtml`,没有例外。
 * - `styleVars` 只放行 `--spc-*` 开头的变量名,值里不许出现 `;` 和 `url(`。
 * - 全局正则匹配到**零长度**时手动推进 `lastIndex` —— 少了这一步
 *   (比如用户写了 `(.*)`)`exec` 循环会永远停在原地,整个页面卡死。
 */

import { escapeHtml, asArray, makeId, truncate } from '../utils.js';
import { CARD_KIND_IDS } from '../constants.js';

/** 一次最多切多少段 —— 兜底,防止病态正则把一条消息切成几万段 */
const MAX_BLOCKS = 400;

// ============================================================
// 规则
// ============================================================

export function normalizeRule(raw = {}) {
    const card = CARD_KIND_IDS.includes(raw.card) ? raw.card : 'note';
    return {
        id: String(raw.id || makeId('rx')),
        name: String(raw.name || '未命名规则').slice(0, 24),
        enabled: raw.enabled !== false,
        pattern: String(raw.pattern || ''),
        /** 只放行 i / s / m,`g` 由引擎自己加(用户加了也没意义) */
        flags: String(raw.flags || '').replace(/[^ism]/g, '').slice(0, 3),
        card,
        slots: {
            title: toSlot(raw.slots?.title),
            body: toSlot(raw.slots?.body, 1),
            meta: toSlot(raw.slots?.meta),
        },
        styleVars: sanitizeStyleVars(raw.styleVars),
        /** 规则库里点「试一下」用的示例文本 */
        sample: String(raw.sample || '').slice(0, 200),
        builtin: raw.builtin === true,
        createdAt: Number(raw.createdAt) || Date.now(),
    };
}

/** 槽位存的是**捕获组序号**,0 表示这个槽不用 */
function toSlot(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 9) return fallback;
    return Math.floor(n);
}

/**
 * 样式覆盖白名单。
 *
 * 只收 `--spc-*`,值里禁掉 `;`(防止逃出属性)和 `url(`(防止外链追踪)。
 * 不认识的直接丢,不报错 —— 用户多半是从别处整段拷来的。
 */
export function sanitizeStyleVars(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [key, value] of Object.entries(raw)) {
        const k = String(key).trim().toLowerCase();
        if (!/^--spc-[a-z0-9-]+$/.test(k)) continue;
        const v = String(value).trim();
        if (!v || v.length > 80) continue;
        if (/[;{}<>]/.test(v) || /url\s*\(/i.test(v) || /expression/i.test(v)) continue;
        out[k] = v;
    }
    return out;
}

/**
 * 编译一条规则。
 *
 * 编译失败返回 `{ ok:false, error }` 而不是抛 —— 一条坏规则不该让整条消息
 * 渲染不出来。规则库那边会把 error 显示在卡片上,用户看得见自己写错了。
 */
export function compileRule(rule) {
    const r = normalizeRule(rule);
    if (!r.pattern) return { ok: false, rule: r, error: '还没写正则' };
    if (r.pattern.length > 400) return { ok: false, rule: r, error: '正则太长了(超过 400 字)' };
    try {
        // `g` 必须有 —— 引擎靠 lastIndex 逐段推进
        return { ok: true, rule: r, re: new RegExp(r.pattern, `${r.flags}g`) };
    } catch (err) {
        return { ok: false, rule: r, error: `正则写错了:${err?.message || '语法不对'}` };
    }
}

/** 批量编译,只留能用的 */
export function compileRules(rules) {
    return asArray(rules)
        .filter((r) => r && r.enabled !== false)
        .map(compileRule)
        .filter((c) => c.ok);
}

// ============================================================
// 切段
// ============================================================

/**
 * 把一段文本按规则切成若干块。
 *
 * @param {string} text
 * @param {Array} compiled  `compileRules()` 的产物
 * @returns {Array<{kind:'text'|'card', ...}>}
 */
export function splitBlocks(text, compiled = []) {
    const src = String(text ?? '');
    if (!src) return [];
    if (!compiled.length) return [{ kind: 'text', text: src }];

    // 先把所有规则的所有命中收集起来,再按位置排序、去重叠。
    // 逐条规则串行替换会让后一条规则匹配到前一条产出的内容,结果取决于规则顺序 ——
    // 用户完全没法预期,而且调整顺序时行为会莫名其妙地变。
    const hits = [];
    for (const c of compiled) {
        c.re.lastIndex = 0;
        let m;
        let guard = 0;
        while ((m = c.re.exec(src)) !== null) {
            if (guard++ > MAX_BLOCKS) break;
            hits.push({ start: m.index, end: m.index + m[0].length, groups: m, rule: c.rule });
            // ★ 零长度匹配必须手动推进,否则 exec 永远停在原地,页面直接卡死
            if (m[0].length === 0) c.re.lastIndex += 1;
        }
    }
    if (!hits.length) return [{ kind: 'text', text: src }];

    // 位置靠前的赢;同一位置上更长的赢(更具体的规则优先)
    hits.sort((a, b) => (a.start - b.start) || (b.end - a.end));

    const blocks = [];
    let cursor = 0;
    for (const hit of hits) {
        if (hit.start < cursor) continue;   // 和已采用的命中重叠,跳过
        if (hit.start > cursor) {
            const chunk = src.slice(cursor, hit.start);
            if (chunk.trim()) blocks.push({ kind: 'text', text: chunk });
        }
        blocks.push({
            kind: 'card',
            card: hit.rule.card,
            ruleId: hit.rule.id,
            ruleName: hit.rule.name,
            styleVars: hit.rule.styleVars,
            title: pickSlot(hit.groups, hit.rule.slots.title),
            body: pickSlot(hit.groups, hit.rule.slots.body) || hit.groups[0],
            meta: pickSlot(hit.groups, hit.rule.slots.meta),
            raw: hit.groups[0],
        });
        cursor = hit.end;
        if (blocks.length > MAX_BLOCKS) break;
    }
    if (cursor < src.length) {
        const tail = src.slice(cursor);
        if (tail.trim()) blocks.push({ kind: 'text', text: tail });
    }
    return blocks.length ? blocks : [{ kind: 'text', text: src }];
}

function pickSlot(groups, index) {
    if (!index) return '';
    const value = groups[index];
    return typeof value === 'string' ? value.trim() : '';
}

// ============================================================
// 渲染
// ============================================================

/**
 * 把一个 card 块渲染成 HTML。
 *
 * ★ 每一处插值都过 `escapeHtml`。这是整个 App 唯一一处 `v-html`,
 *   所以这里漏一个就是真的漏了。
 *
 * @param {object} block   `splitBlocks` 的产物
 * @param {object} ctx     { authorName, avatarUrl, timeText }
 */
export function renderCard(block, ctx = {}) {
    const styleAttr = buildStyleAttr(block.styleVars);
    const title = escapeHtml(block.title);
    const body = escapeHtml(block.body).replace(/\n/g, '<br>');
    const meta = escapeHtml(block.meta);
    const author = escapeHtml(ctx.authorName || '');
    const time = escapeHtml(ctx.timeText || '');

    if (block.card === 'blog') {
        return `<article class="spc spc-blog"${styleAttr}>
    <header class="spc-blog-head">
        <span class="spc-blog-avatar" aria-hidden="true"></span>
        <span class="spc-blog-who">
            <b class="spc-blog-author">${author || '作者'}</b>
            ${meta ? `<em class="spc-blog-place">${meta}</em>` : ''}
        </span>
    </header>
    ${title ? `<h4 class="spc-blog-title">${title}</h4>` : ''}
    <div class="spc-blog-body">${body}</div>
    <footer class="spc-blog-foot">
        <span class="spc-blog-act">赞</span>
        <span class="spc-blog-act">评论</span>
        <span class="spc-blog-act">收藏</span>
        ${time ? `<span class="spc-blog-time">${time}</span>` : ''}
    </footer>
</article>`;
    }

    if (block.card === 'diary') {
        return `<article class="spc spc-diary"${styleAttr}>
    ${title ? `<h4 class="spc-diary-title">${title}</h4>` : ''}
    <div class="spc-diary-body">${body}</div>
    ${meta || time ? `<footer class="spc-diary-foot">${meta || time}</footer>` : ''}
</article>`;
    }

    if (block.card === 'dialogue-left' || block.card === 'dialogue-right') {
        const side = block.card === 'dialogue-left' ? 'left' : 'right';
        return `<div class="spc spc-line is-${side}"${styleAttr}>
    ${title ? `<span class="spc-line-who">${title}</span>` : ''}
    <span class="spc-line-body">${body}</span>
</div>`;
    }

    if (block.card === 'plain') {
        return `<p class="spc spc-plain"${styleAttr}>${body}</p>`;
    }

    // note —— 兜底卡片。不认识的 card 值也走这里,不会渲染成空白
    return `<aside class="spc spc-note"${styleAttr}>
    ${title ? `<span class="spc-note-title">${title}</span>` : ''}
    <span class="spc-note-body">${body}</span>
    ${meta ? `<span class="spc-note-meta">${meta}</span>` : ''}
</aside>`;
}

function buildStyleAttr(styleVars) {
    const clean = sanitizeStyleVars(styleVars);
    const entries = Object.entries(clean);
    if (!entries.length) return '';
    const css = entries.map(([k, v]) => `${k}:${v}`).join(';');
    return ` style="${escapeHtml(css)}"`;
}

/**
 * 渲染一整条消息的所有块。
 *
 * 纯文本块**不在这里**渲染 —— 对话体里它要放进气泡(气泡是 Vue 组件),
 * 日记体里它是一个段落。所以这里只回一个「块 + 已渲染 HTML」的列表,
 * 由组件决定纯文本那部分怎么摆。
 */
export function renderBlocks(text, compiled, ctx = {}) {
    return splitBlocks(text, compiled).map((block) => (
        block.kind === 'card'
            ? { ...block, html: renderCard(block, ctx) }
            : block
    ));
}

/** 一条消息里有没有卡片 —— 决定它要不要跳出气泡单独排版 */
export function hasCard(text, compiled) {
    return splitBlocks(text, compiled).some((b) => b.kind === 'card');
}

// ============================================================
// 内置规则
// ============================================================

/**
 * 开箱可用的五条。
 *
 * 用**中英文冒号都认**的写法(`[:：]`):AI 在中文语境下十有八九打全角冒号,
 * 只认半角的话规则形同虚设,而且用户根本不会想到是这个原因。
 */
export const BUILTIN_RULES = Object.freeze([
    {
        id: 'rx-blog',
        name: '博客卡',
        pattern: '\\[博客[:：]\\s*([^|\\]\\n]{0,40})(?:\\|([\\s\\S]*?))?\\]',
        flags: '',
        card: 'blog',
        slots: { title: 1, body: 2, meta: 0 },
        sample: '[博客:今天的海|风大得站不住,但云走得特别好看。]',
        builtin: true,
    },
    {
        id: 'rx-diary',
        name: '日记卡',
        pattern: '\\[日记[:：]\\s*([\\s\\S]*?)\\]',
        flags: '',
        card: 'diary',
        slots: { title: 0, body: 1, meta: 0 },
        sample: '[日记:今天把窗台的花搬进屋里了。]',
        builtin: true,
    },
    {
        id: 'rx-left',
        name: '对话·左',
        pattern: '\\[左[:：]\\s*([^|\\]\\n]{0,20})\\|([\\s\\S]*?)\\]',
        flags: '',
        card: 'dialogue-left',
        slots: { title: 1, body: 2, meta: 0 },
        sample: '[左:阿澈|你也来看海?]',
        builtin: true,
    },
    {
        id: 'rx-right',
        name: '对话·右',
        pattern: '\\[右[:：]\\s*([^|\\]\\n]{0,20})\\|([\\s\\S]*?)\\]',
        flags: '',
        card: 'dialogue-right',
        slots: { title: 1, body: 2, meta: 0 },
        sample: '[右:我|路过而已。]',
        builtin: true,
    },
    {
        id: 'rx-note',
        name: '便签',
        pattern: '\\[便签[:：]\\s*([\\s\\S]*?)\\]',
        flags: '',
        card: 'note',
        slots: { title: 0, body: 1, meta: 0 },
        sample: '[便签:记得明天带伞]',
        builtin: true,
    },
]);

/**
 * 把启用的规则翻译成给 AI 的格式说明。
 *
 * ★ 这一段会进 system prompt。**用户新建的规则也要进** ——
 *   不进的话 AI 永远不会写出那个格式,用户会以为「我的正则没生效」,
 *   而实际上是根本没人告诉过 AI 有这个写法。
 */
export function describeRulesForAi(rules) {
    const list = asArray(rules).filter((r) => r.enabled !== false && r.pattern);
    if (!list.length) return '';
    const lines = list.map((r) => {
        const shape = r.sample ? r.sample : `(匹配 ${r.pattern})`;
        const what = {
            blog: '一张博客贴文卡',
            diary: '一段日记',
            'dialogue-left': '左侧一句台词',
            'dialogue-right': '右侧一句台词',
            note: '一张便签',
            plain: '一段普通文字',
        }[r.card] || '一张卡片';
        return `    - ${shape}  → ${what}`;
    });
    return `特殊写法须知:
  - Principle: 下面这几种写法会被渲染成卡片,该用的时候直接写,不用解释。
  - Behaviors:
${lines.join('\n')}
    - 单独成段,前后不要加多余的符号
    - 不需要卡片的内容就正常写,不要硬套`;
}

/** 规则库里「试一下」的预览 */
export function previewRule(rule, text) {
    const compiled = compileRule(rule);
    if (!compiled.ok) return { ok: false, error: compiled.error, blocks: [] };
    const source = String(text || rule.sample || '').trim();
    if (!source) return { ok: false, error: '先写一段示例文本', blocks: [] };
    const blocks = renderBlocks(source, [compiled], { authorName: '示例', timeText: '' });
    const matched = blocks.some((b) => b.kind === 'card');
    return {
        ok: matched,
        error: matched ? '' : '这段示例没有匹配上,检查一下正则或者示例',
        blocks,
        summary: truncate(source, 30),
    };
}
