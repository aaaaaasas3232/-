/**
 * 梦境编织 · 正文渲染
 *
 * 把一条消息的纯文本切成**结构化片段**,交给 Vue 用插值渲染。
 *
 * ── 为什么不像原版那样直接拼 HTML 字符串 ──────────────────────────
 *
 * 原版 `processMessageBubbles` / `processContentHighlights` / `applyBubbleRegexRules`
 * 是一路 `replace()` 拼 HTML 再 `innerHTML` 塞进去。两个后果:
 *
 *   1. **XSS**:正文里出现 `<script>` 或 `<img onerror>` 就直接执行了。
 *      正文有一部分来自 AI 返回,不能当成可信内容。
 *   2. **规则互相破坏**:第二条正则会匹配到第一条刚插进去的 `<span class="...">`,
 *      于是出现「高亮标签被当成对话内容再包一层」的乱码。原版靠调整规则顺序绕,
 *      加一条新规则就可能重新炸。
 *
 * 现在产出的是 `{ type, text }[]`,由模板渲染 —— 天然转义,规则之间也不会互吃,
 * 因为每一轮只在**还没被认领的纯文本片段**上继续切。
 */

import { escapeRegExp, findById } from '../utils.js';

/**
 * 片段类型：
 *   text     普通正文
 *   dialogue 对话 / inner 内心 / aside 旁白  —— 只是换个样式显示
 *   char     角色名 / loc 地点名             —— 可点，跳设定
 *   html     规则产出的 HTML 片段            —— 用 v-html 渲染，见下面的消毒
 */

/** 规则的三种工作方式 */
export const RULE_MODES = Object.freeze({
    /** 只标记：匹配到的部分换个样式（默认，也是老规则的行为） */
    SEGMENT: 'segment',
    /** 文本替换：把匹配到的换成另一段纯文本 */
    REPLACE: 'replace',
    /** 画成东西：把匹配到的换成一小段 HTML（[糖果] → 一颗画出来的糖） */
    HTML: 'html',
});

function safeRegExp(pattern, flags) {
    try {
        // 强制带 g,否则下面的 exec 循环会死循环
        return new RegExp(pattern, flags?.includes('g') ? flags : `${flags || ''}g`);
    } catch (_) {
        return null;   // 用户写错正则不该让整页白屏
    }
}

// ============================================================
// HTML 片段消毒
// ------------------------------------------------------------
// 规则本身是用户自己配的（可信），但**匹配到的内容来自 AI 输出**（不可信），
// 而 $1 会被插进 HTML 模板里。所以两件事都得做：
//   1. 插值先转义 —— AI 写个 <img onerror> 也只会显示成字符
//   2. 模板本身过一遍白名单 —— 防止用户从网上抄来一段带 onclick 的片段
// ============================================================

const ALLOWED_TAGS = new Set([
    'span', 'b', 'i', 'em', 'strong', 'small', 'sub', 'sup', 'u', 's',
    'div', 'p', 'br', 'hr', 'code', 'mark', 'ruby', 'rt', 'rp',
    'svg', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'g', 'defs',
    'lineargradient', 'radialgradient', 'stop', 'text', 'tspan', 'use', 'title',
]);

/** style 允许留，但 on* 一律砍掉；href/src 只允许非 javascript: 的 */
function sanitizeAttrs(el) {
    for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || '');
        if (name.startsWith('on')) { el.removeAttribute(attr.name); continue; }
        if ((name === 'href' || name === 'src' || name === 'xlink:href')
            && /^\s*(javascript|data:text\/html)/i.test(value)) {
            el.removeAttribute(attr.name);
        }
    }
}

/**
 * 把一段 HTML 洗成「只剩排版和画图」的安全版本。
 * 不认识的标签整个丢掉（连同内容），认识的递归往下洗。
 */
export function sanitizeHtmlFragment(html) {
    const raw = String(html || '');
    if (!raw) return '';
    if (typeof document === 'undefined') return '';
    const tpl = document.createElement('template');
    tpl.innerHTML = raw;
    const walk = (node) => {
        for (const child of [...node.childNodes]) {
            if (child.nodeType === 3) continue;               // 文本，放行
            if (child.nodeType !== 1) { child.remove(); continue; } // 注释等，删
            const tag = child.tagName.toLowerCase();
            if (!ALLOWED_TAGS.has(tag)) { child.remove(); continue; }
            sanitizeAttrs(child);
            walk(child);
        }
    };
    walk(tpl.content);
    return tpl.innerHTML;
}

/** 把 $1 $2 … 和 $& 填进模板，填进去的内容先转义 */
function fillTemplate(template, match) {
    const esc = (s) => String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return String(template || '').replace(/\$(\d|&)/g, (_, k) => {
        if (k === '&') return esc(match[0]);
        return esc(match[Number(k)] ?? '');
    });
}

/**
 * 用一条规则切分片段列表。只切 `type === 'text'` 的片段 ——
 * 已经被前面规则认领过的不再参与,这是「规则不互吃」的实现方式。
 *
 * @param {Array} segments
 * @param {RegExp} regex
 * @param {string} type 命中片段的类型（segment 模式下就是 dialogue/inner/aside）
 * @param {object} [rule] 带 mode / replacement 时按替换模式产出片段
 */
function splitByRule(segments, regex, type, rule = null) {
    const mode = rule?.mode || RULE_MODES.SEGMENT;
    const out = [];
    for (const segment of segments) {
        if (segment.type !== 'text') {
            out.push(segment);
            continue;
        }
        const source = segment.text;
        let lastIndex = 0;
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(source)) !== null) {
            // 零宽匹配会让 exec 原地打转,手动推进一格
            if (match[0].length === 0) {
                regex.lastIndex += 1;
                continue;
            }
            if (match.index > lastIndex) {
                out.push({ type: 'text', text: source.slice(lastIndex, match.index) });
            }
            if (mode === RULE_MODES.HTML) {
                const html = sanitizeHtmlFragment(fillTemplate(rule.replacement, match));
                // 洗完是空的（模板全是不认识的标签）就退回显示原文，别让内容凭空消失
                if (html) out.push({ type: 'html', html, raw: match[0] });
                else out.push({ type: 'text', text: match[0] });
            } else if (mode === RULE_MODES.REPLACE) {
                const text = fillTemplate(rule.replacement, match)
                    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                // 替换成的仍然是普通文字，交给下一条规则继续切
                out.push({ type: 'text', text });
            } else {
                // 有捕获组用第一组(去掉引号/括号本身),没有就用整段
                out.push({ type, text: match[1] != null ? match[1] : match[0], raw: match[0] });
            }
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < source.length) {
            out.push({ type: 'text', text: source.slice(lastIndex) });
        }
    }
    return out;
}

/**
 * 把正文切成片段。
 *
 * @param {string} content
 * @param {object} opts
 * @param {object[]} [opts.rules]       气泡正则规则
 * @param {object[]} [opts.characters]  用于高亮角色名
 * @param {object[]} [opts.locations]   用于高亮地点名
 * @param {object}   [opts.display]     显示设置(控制是否启用各类高亮)
 * @returns {{type:string, text:string, tone?:string, id?:string}[]}
 */
export function segmentContent(content, opts = {}) {
    const text = String(content || '');
    if (!text) return [];

    const { rules = [], characters = [], locations = [], display = {} } = opts;
    let segments = [{ type: 'text', text }];

    // 1) 规则（对话 / 内心 / 旁白的标记，以及文本替换、HTML 片段）
    //
    //    showBubbles 只管「标记类」规则 —— 关掉它是「我不想看到对话被染色」，
    //    不等于「我不想让 [糖果] 画出来」。替换类规则和它无关，始终生效。
    for (const rule of rules) {
        if (rule?.enabled === false || !rule?.pattern) continue;
        const mode = rule.mode || RULE_MODES.SEGMENT;
        if (mode === RULE_MODES.SEGMENT && display.showBubbles === false) continue;
        if (mode !== RULE_MODES.SEGMENT && !rule.replacement) continue;
        const regex = safeRegExp(rule.pattern, rule.flags);
        if (!regex) continue;
        segments = splitByRule(segments, regex, rule.kind || 'dialogue', rule);
    }

    // 2) 角色名高亮 —— 按名字长度倒序,避免「林」先匹配掉「林清越」
    if (display.highlightCharacters !== false && characters.length) {
        const named = characters
            .filter((c) => c.__name)
            .sort((a, b) => b.__name.length - a.__name.length);
        for (const character of named) {
            const regex = safeRegExp(escapeRegExp(character.__name), 'g');
            if (!regex) continue;
            segments = splitByRule(segments, regex, 'char').map((seg) =>
                seg.type === 'char' && !seg.id ? { ...seg, id: character.id, tone: character.tone || '' } : seg,
            );
        }
    }

    // 3) 地点名高亮
    if (display.highlightLocations !== false && locations.length) {
        const named = locations.filter((l) => l.name).sort((a, b) => b.name.length - a.name.length);
        for (const location of named) {
            const regex = safeRegExp(escapeRegExp(location.name), 'g');
            if (!regex) continue;
            segments = splitByRule(segments, regex, 'loc').map((seg) =>
                seg.type === 'loc' && !seg.id ? { ...seg, id: location.id, tone: location.tone || '' } : seg,
            );
        }
    }

    // html 片段没有 text 字段，别被这一步滤掉
    return segments.filter((seg) => seg.type === 'html' || seg.text !== '');
}

/**
 * 按段落拆分。渲染时先分段再切片段,这样 CSS 的首行缩进才是按段生效的。
 * @returns {Array<Array>} 每个元素是一段的片段列表
 */
export function segmentParagraphs(content, opts = {}) {
    return String(content || '')
        .split(/\n{2,}|\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => segmentContent(line, opts));
}

/**
 * 应用「替换型」正则规则(有 replacement 的那些)。
 *
 * 和上面的切分是两回事:切分只改显示,替换是**真的改正文**,
 * 所以只在用户主动点「应用正则」时跑,不在渲染路径里自动执行 ——
 * 渲染路径里悄悄改用户的字是很吓人的行为。
 */
export function applyReplacements(content, rules = []) {
    let text = String(content || '');
    for (const rule of rules) {
        if (rule?.enabled === false || !rule?.pattern || !rule?.replacement) continue;
        const regex = safeRegExp(rule.pattern, rule.flags);
        if (!regex) continue;
        text = text.replace(regex, rule.replacement);
    }
    return text;
}

/** 给角色补上显示名(解析 mask/ai 引用),供高亮用 */
export function decorateCharacters(characters, resolveName) {
    return (characters || []).map((c) => ({ ...c, __name: resolveName(c) }));
}

/** 校验一条正则规则,给编辑器实时反馈 */
export function validateRule(pattern, flags) {
    if (!pattern) return { ok: false, error: '正则不能为空' };
    try {
        new RegExp(pattern, flags || 'g');
        return { ok: true, error: '' };
    } catch (err) {
        return { ok: false, error: err?.message || '正则语法错误' };
    }
}

/** 试跑一条规则,返回命中的片段(规则编辑器的预览用) */
export function testRule(pattern, flags, sample) {
    const regex = safeRegExp(pattern, flags);
    if (!regex) return [];
    const out = [];
    let match;
    let guard = 0;
    while ((match = regex.exec(String(sample || ''))) !== null && guard < 50) {
        guard += 1;
        if (match[0].length === 0) { regex.lastIndex += 1; continue; }
        out.push(match[1] != null ? match[1] : match[0]);
    }
    return out;
}

/**
 * 规则编辑器的「效果预览」：拿一条规则跑一段样例，产出和正文里**完全一样**的片段。
 *
 * 走的就是 segmentContent 的那条路，不是另写一份近似实现 ——
 * 预览和真实渲染分两套代码是这个 App 以前踩过的坑（上下文预览曾经和实际发送对不上）。
 */
export function previewRule(rule, sample) {
    if (!rule?.pattern) return [];
    const check = validateRule(rule.pattern, rule.flags);
    if (!check.ok) return [];
    return segmentContent(sample, {
        rules: [{ ...rule, enabled: true }],
        display: { showBubbles: true, highlightCharacters: false, highlightLocations: false },
    });
}

/** 从书里按 id 找角色/地点(片段点击时用) */
export function lookupMark(book, segment) {
    if (!segment?.id) return null;
    if (segment.type === 'char') return findById(book?.characters, segment.id);
    if (segment.type === 'loc') return findById(book?.locations, segment.id);
    return null;
}
