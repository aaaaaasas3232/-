/**
 * relax-app / 自定义捏捏的代码消毒 + 体检
 *
 * ============================================================
 * 为什么要有这个文件
 * ============================================================
 * 「我的捏捏」(toys/custom-html-board.js)会把用户写的 HTML 用 innerHTML
 * 直接注入格子里,把用户写的 CSS 塞进一个 <style>。以前的判断是
 * 「用户自己写自己用,信任源」—— 但现在整条流程鼓励用户
 * **把 AI 生成的代码粘回来**,那段代码用户多半没逐行读过。
 * 信任前提没了,所以在写进主体之前必须先过一遍这里。
 *
 * ★ 本文件必须保持纯函数 + 零 DOM
 *   - 它要能被 node 直接 import 做回归(没有 window / document);
 *   - 主体那边是命令式 DOM,页面那边是 Vue,两边共用同一份规则,
 *     不能出现「预览通过了、应用进去被拦」这种两套标准。
 *
 * ★ 作用域壳子的护栏很薄,真正拦住的是这里
 *   主体注入的是 `[data-htmlbubble-scope="xxx"]{ 用户CSS }`(CSS 原生嵌套)。
 *   壳子只管「往里收」,管不住用户自己往外顶:多写一个 `}` 就能提前闭合,
 *   后面的规则直接变成全局样式。所以 sanitizeToyCss 做了三件事:
 *     1) 丢掉能提前闭合外壳的多余 `}`(经典越狱写法)
 *     2) 把 html / body / :root / * / .app- / .rx- 这类全局选择器改写成惰性类名
 *     3) 掐掉 @import / url(javascript:) / expression() 这些远程与执行入口
 *
 * ★ 三种布局模式,两套待遇
 *   grid(一格重复 N 份)和 free(整块画一个摇杆 / 鼠标)共用上面这一整套:
 *   它们的 DOM 是**直接注入本页**的,不消毒就等于开门。两者只有
 *   HTML 长度上限和体检提示不同。
 *
 *   code(写代码)完全不走消毒。它的 HTML/CSS/JS 跑在
 *   `<iframe sandbox="allow-scripts">` 的不透明源里(见 toy-sandbox.js),
 *   碰不到本页任何东西 —— 隔离已经由浏览器做掉了,这里再删一遍只会
 *   把用户的 <style> / onclick 删没,写出来的东西直接跑不起来。
 *   所以 code 模式这里只做**体检**(空不空、长不长、有没有明显的坑),
 *   不做改写。★ 这条别改成「保险起见也消一遍」,那是在拆掉功能本身。
 */

/** HTML 模板长度上限(格子模式)。144 格 × 这个数才是最终 DOM 体积,不能放开。 */
export const MAX_TOY_HTML_LEN = 8000;
/**
 * HTML 长度上限(自由模式)。
 * 自由模式整段只渲染**一份**,没有 ×144 的放大,所以给得起。
 * 一个像样的鼠标或者摇杆光结构就要一两千字,卡在 8000 上会逼人删掉细节。
 */
export const MAX_TOY_HTML_LEN_FREE = 24000;
/** CSS 长度上限。CSS 只注入一份,可以宽松一些。 */
export const MAX_TOY_CSS_LEN = 20000;
/** JS 长度上限(只有 code 模式有 JS)。 */
export const MAX_TOY_JS_LEN = 40000;

/** 自由模式认识的零件类型。★ 必须和 services/toy-parts.js 里的 PART_TYPES 一致。 */
const FREE_PART_TYPES = new Set(['press', 'toggle', 'stick', 'slide', 'dial']);

/** 成对标签:连同中间的内容一起铲掉(留着内容会变成裸文本漏出来) */
const PAIRED_TAGS = ['script', 'style', 'iframe', 'object', 'noscript'];
/** 自闭合 / 单标签:只铲标签本身 */
const VOID_TAGS = ['embed', 'link', 'meta', 'base'];

/** HTML 里不参与配对计数的空元素(体检用) */
const VOID_ELEMENTS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * 危险协议。`data:text/html` 也算 —— 它能在 <object>/<iframe> 之外
 * 通过 <a href> 打开一张可执行脚本的页面。
 */
const DANGEROUS_SCHEME_RE = /^(?:javascript|vbscript|livescript|mocha|data:text\/html)/i;

/**
 * 会把「App 本体」一起改掉的选择器。
 * 只在选择器的**开头**判断 html / body / :root / *(`.foo > *` 是安全的,
 * 它已经被 :scope 限制在 .foo 里面了),其余的按「出现即危险」处理。
 */
const GLOBAL_LEADING_RE = /^(?:html|body|:root)(?![-\w])|^\*/i;
const FRAMEWORK_CLASS_RE = /(?:\.app-|\.rx-|\.ac-|\.phone|#phone|\.island|\.home-indicator)/i;

/** 惰性类名:被改写掉的选择器落到这里,永远匹配不到任何节点 */
const BLOCKED_SELECTOR = '.rx-blocked-selector';

// ============================================================
// HTML
// ============================================================

/**
 * 消毒用户的 HTML 模板。
 * @param {string} raw
 * @returns {{ html: string, removed: string[] }} removed 是给用户看的中文标签
 */
export function sanitizeToyHtml(raw) {
    const removed = [];
    if (typeof raw !== 'string' || !raw) return { html: '', removed };

    let html = raw;

    // 1) 成对危险标签(连内容)
    for (const tag of PAIRED_TAGS) {
        const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/\\s*${tag}\\s*>`, 'gi');
        const orphan = new RegExp(`<\\/?\\s*${tag}\\b[^>]*>`, 'gi');
        if (paired.test(html) || orphan.test(html)) markRemoved(removed, `<${tag}>`);
        html = html.replace(paired, '').replace(orphan, '');
    }

    // 2) 单标签危险元素
    for (const tag of VOID_TAGS) {
        const re = new RegExp(`<\\/?\\s*${tag}\\b[^>]*>`, 'gi');
        if (re.test(html)) markRemoved(removed, `<${tag}>`);
        html = html.replace(re, '');
    }

    // 3) 逐个标签洗属性(on* / javascript: / srcdoc / style 里的执行入口)
    //    只在标签内部动手,正文里出现「onclick」这种字样不受影响。
    html = html.replace(/<[a-zA-Z][^>]*>/g, (tagText) => cleanAttributes(tagText, removed));

    return { html, removed };
}

/** 洗一个开标签里的属性 */
function cleanAttributes(tagText, removed) {
    let out = tagText;

    // on* 行内事件:onclick / onerror / onpointerdown …
    const handlerRe = /\son[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/g;
    if (handlerRe.test(out)) markRemoved(removed, 'on* 行内事件');
    out = out.replace(handlerRe, '');

    // srcdoc:等价于内嵌一整张 HTML,直接摘掉
    const srcdocRe = /\ssrcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
    if (srcdocRe.test(out)) markRemoved(removed, 'srcdoc');
    out = out.replace(srcdocRe, '');

    // 其余属性:按值判断
    out = out.replace(
        /\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
        (whole, name, dq, sq, bare) => {
            const value = dq != null ? dq : (sq != null ? sq : (bare || ''));
            const lowerName = String(name).toLowerCase();

            if (lowerName === 'style') {
                const cleaned = cleanStyleAttrValue(value, removed);
                if (cleaned === value) return whole;
                return ` style="${cleaned.replace(/"/g, '')}"`;
            }

            if (DANGEROUS_SCHEME_RE.test(decodeAttrValue(value))) {
                markRemoved(removed, 'javascript: 链接');
                return '';
            }
            return whole;
        },
    );

    return out;
}

/** 行内 style="" 里也可能藏 url(javascript:) / expression() */
function cleanStyleAttrValue(value, removed) {
    let out = value;
    const jsUrlRe = /url\(\s*['"]?\s*(?:javascript|vbscript)\s*:[^)]*\)/gi;
    if (jsUrlRe.test(out)) markRemoved(removed, 'javascript: 链接');
    out = out.replace(jsUrlRe, 'none');

    const exprRe = /expression\s*\(/gi;
    if (exprRe.test(out)) markRemoved(removed, 'expression()');
    out = out.replace(exprRe, 'blocked(');
    return out;
}

/**
 * 属性值可能被实体编码绕过(`java&#115;cript:`),
 * 判危险协议之前先解一层实体 + 去掉空白与控制字符。
 */
function decodeAttrValue(value) {
    return String(value)
        .replace(/&#x([0-9a-fA-F]+);?/g, (m, hex) => safeFromCharCode(parseInt(hex, 16)))
        .replace(/&#(\d+);?/g, (m, dec) => safeFromCharCode(Number(dec)))
        .replace(/[\s\u0000-\u001F]/g, '');
}

function safeFromCharCode(code) {
    if (!Number.isFinite(code) || code < 0 || code > 0x10FFFF) return '';
    try {
        return String.fromCodePoint(code);
    } catch {
        return '';
    }
}

// ============================================================
// CSS
// ============================================================

/**
 * 消毒用户的 CSS。
 * @param {string} raw
 * @returns {{ css: string, removed: string[] }}
 */
export function sanitizeToyCss(raw) {
    const removed = [];
    if (typeof raw !== 'string' || !raw) return { css: '', removed };

    let css = raw;

    // 1) 标签碎片:粘贴时常常连 <style> 一起带进来
    const tagRe = /<\/?\s*(?:style|script)\b[^>]*>/gi;
    if (tagRe.test(css)) markRemoved(removed, '<style> 标签');
    css = css.replace(tagRe, '');

    // 2) @import:会去外网拉一整张样式表,等于给 App 开了个远程口子
    const importRe = /@import\b[^;{]*(?:;|(?=\})|$)/gi;
    if (importRe.test(css)) markRemoved(removed, '@import');
    css = css.replace(importRe, '');

    // 3) url(javascript:) / expression() / -moz-binding:老浏览器里的执行入口
    const jsUrlRe = /url\(\s*['"]?\s*(?:javascript|vbscript)\s*:[^)]*\)/gi;
    if (jsUrlRe.test(css)) markRemoved(removed, 'url(javascript:)');
    css = css.replace(jsUrlRe, 'none');

    const exprRe = /expression\s*\(/gi;
    if (exprRe.test(css)) markRemoved(removed, 'expression()');
    css = css.replace(exprRe, 'blocked(');

    const bindingRe = /-moz-binding\s*:[^;}]*/gi;
    if (bindingRe.test(css)) markRemoved(removed, '-moz-binding');
    css = css.replace(bindingRe, '');

    // 4) 越狱的 `}`:提前闭合 :scope{ 之后写的东西就是全局样式了
    const balanced = balanceScopeBraces(css);
    css = balanced.css;
    if (balanced.escaped > 0) markRemoved(removed, '越出 :scope 的 }');

    // 5) 全局选择器改写(html / body / :root / * / .app- / .rx- …)
    const scoped = neutralizeGlobalSelectors(css);
    css = scoped.css;
    if (scoped.blocked > 0) markRemoved(removed, '指向整个 App 的选择器');

    return { css, removed };
}

/**
 * 把大括号配平,并丢掉「深度已经是 0 还想再闭合一层」的 `}`。
 *
 * ★ 手写状态机而不是正则:注释和字符串里的括号不能算数,
 *   `content: "}"` 这种写法在正则里没法安全处理。
 */
function balanceScopeBraces(css) {
    let out = '';
    let depth = 0;
    let escaped = 0;
    let i = 0;

    while (i < css.length) {
        const ch = css[i];

        // 注释:原样搬运,不参与计数
        if (ch === '/' && css[i + 1] === '*') {
            const end = css.indexOf('*/', i + 2);
            const stop = end === -1 ? css.length : end + 2;
            out += css.slice(i, stop);
            i = stop;
            continue;
        }

        // 字符串:同上。
        // ★ 遇到换行就当「这根本不是字符串,只是个孤零零的引号」——
        //   CSS 字符串不能跨行,不这么兜的话一个手滑的单引号会把后面全吞掉。
        if (ch === '"' || ch === "'") {
            let j = i + 1;
            let closed = false;
            while (j < css.length) {
                if (css[j] === '\n') break;
                if (css[j] === '\\') { j += 2; continue; }
                if (css[j] === ch) { j += 1; closed = true; break; }
                j += 1;
            }
            if (closed) {
                out += css.slice(i, j);
                i = j;
            } else {
                out += ch;
                i += 1;
            }
            continue;
        }

        if (ch === '{') { depth += 1; out += ch; i += 1; continue; }
        if (ch === '}') {
            if (depth === 0) { escaped += 1; i += 1; continue; }
            depth -= 1;
            out += ch;
            i += 1;
            continue;
        }

        out += ch;
        i += 1;
    }

    // 少写了 `}` 也不能放过去:不补的话 :scope{ 会把后面的东西一起吞掉
    if (depth > 0) out += '}'.repeat(depth);

    return { css: out, escaped, unclosed: depth };
}

/**
 * 把「会命中 App 本体」的选择器改写成惰性类名。
 * 只改前导选择器,`.my-cell > *` 这种已经被限制在自己内部的写法不动。
 */
function neutralizeGlobalSelectors(css) {
    let blocked = 0;

    // 前导选择器 = 从行首 / `}` / `;` 之后到下一个 `{` 之间的东西。
    // 允许括号(`:not(.a)` / `:nth-child(2n)`),但不允许 `{` `}` `;` —— 那说明跨规则了。
    const out = css.replace(/(^|[};])([^{};]*)\{/g, (whole, lead, prelude) => {
        const trimmed = prelude.trim();
        // @keyframes / @media / @supports 的前导不是选择器,别乱动
        if (!trimmed || trimmed.startsWith('@')) return whole;

        const parts = prelude.split(',');
        let changed = false;
        const next = parts.map((part) => {
            const sel = part.trim();
            if (!sel) return part;
            if (GLOBAL_LEADING_RE.test(sel) || FRAMEWORK_CLASS_RE.test(sel)) {
                changed = true;
                return ` ${BLOCKED_SELECTOR}`;
            }
            return part;
        });

        if (!changed) return whole;
        blocked += 1;
        return `${lead}${next.join(',')}{`;
    });

    return { css: out, blocked };
}

// ============================================================
// 体检
// ============================================================

/**
 * 应用之前的体检:空的 / 括号对不上 / 画出来什么都没有,都要当场说清楚,
 * 而不是把一块空板子推到舞台上让人以为 App 坏了。
 *
 * @param {string} html 已经过 sanitizeToyHtml 的 HTML
 * @param {string} css  已经过 sanitizeToyCss 的 CSS
 * @param {{ layout?: 'grid'|'free' }} [options] 布局模式。自由模式的长度上限和提示都不一样
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateToyTemplate(html, css, options = {}) {
    const errors = [];
    const warnings = [];
    const safeHtml = typeof html === 'string' ? html : '';
    const safeCss = typeof css === 'string' ? css : '';
    const free = options.layout === 'free';
    const maxHtml = free ? MAX_TOY_HTML_LEN_FREE : MAX_TOY_HTML_LEN;

    if (!safeHtml.trim()) {
        errors.push(free
            ? 'HTML 是空的 —— 自由模式至少要有一个元素,比如 <div class="my-toy"></div>。'
            : 'HTML 是空的 —— 至少要有一个元素,比如 <div class="my-cell"></div>。');
    } else {
        if (safeHtml.length > maxHtml) {
            errors.push(free
                ? `HTML 有 ${safeHtml.length} 个字符,超过上限 ${maxHtml}。`
                : `HTML 有 ${safeHtml.length} 个字符,超过上限 ${maxHtml}。每一格都会复制一份,太长会把界面拖卡。`);
        }
        if (!hasVisibleContent(safeHtml)) {
            errors.push('这段 HTML 画不出任何东西(只有注释或空白),换一段再试。');
        }
        const unbalanced = findUnbalancedTags(safeHtml);
        if (unbalanced.length) {
            errors.push(`标签没闭合:${unbalanced.join('、')}。补上对应的结束标签再应用。`);
        }
        // 自由模式没有「整格都能按」这回事,不打 data-hb 就是一张静态图片
        if (free && !countFreeParts(safeHtml)) {
            warnings.push('这段 HTML 里一个 data-hb 零件都没有 —— 做出来的东西能看不能玩。想让哪块能按 / 能拖,就给它加上 data-hb="press" 之类。');
        }
    }

    if (safeCss.length > MAX_TOY_CSS_LEN) {
        errors.push(`CSS 有 ${safeCss.length} 个字符,超过上限 ${MAX_TOY_CSS_LEN}。`);
    }
    if (safeCss.trim() && !safeCss.includes('{')) {
        warnings.push('CSS 里一条规则都没有,确认一下是不是只粘了半段。');
    }

    return { ok: errors.length === 0, errors, warnings };
}

/**
 * 数一段 HTML 里有几个合法零件。
 * ★ 这里是纯正则,不建 DOM —— 本文件要能被 node 直接 import 做回归。
 *   运行时那份在 services/toy-parts.js(countToyParts),两边判据保持一致。
 */
function countFreeParts(html) {
    let n = 0;
    const re = /\bdata-hb\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
    let match = re.exec(html);
    while (match) {
        const value = String(match[1] ?? match[2] ?? match[3] ?? '').trim().toLowerCase();
        if (FREE_PART_TYPES.has(value)) n += 1;
        match = re.exec(html);
    }
    return n;
}

/** 去掉注释和标签之后还剩点什么吗 */
function hasVisibleContent(html) {
    const body = html.replace(/<!--[\s\S]*?-->/g, '');
    if (/<[a-zA-Z][^>]*>/.test(body)) return true;
    return body.replace(/<[^>]*>/g, '').trim().length > 0;
}

/**
 * 粗略的标签配平检查。
 * 自闭合(`<path/>`)和空元素(`<br>`)不参与计数;
 * 只报「开多了 / 关多了」的标签名,不试图重建 DOM 树。
 */
function findUnbalancedTags(html) {
    const body = html.replace(/<!--[\s\S]*?-->/g, '');
    const counts = new Map();
    const re = /<(\/?)([a-zA-Z][-a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
    let match = re.exec(body);

    while (match) {
        const closing = match[1] === '/';
        const name = match[2].toLowerCase();
        const selfClosed = match[3] === '/';
        if (!VOID_ELEMENTS.has(name) && !selfClosed) {
            counts.set(name, (counts.get(name) || 0) + (closing ? -1 : 1));
        }
        match = re.exec(body);
    }

    const bad = [];
    for (const [name, delta] of counts) {
        if (delta !== 0) bad.push(`<${name}>`);
    }
    return bad;
}

/**
 * 沙箱模式的体检。
 *
 * ★ 这里**故意什么都不改写** —— 理由见本文件头注释。
 *   能报的只有「写了也没用 / 大概率会坑到自己」这类,而且一律是 warning,
 *   不能拦住应用:用户在自己的沙箱里想怎么写是他的自由。
 *
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateToyCode(html, css, js) {
    const errors = [];
    const warnings = [];
    const safeHtml = typeof html === 'string' ? html : '';
    const safeCss = typeof css === 'string' ? css : '';
    const safeJs = typeof js === 'string' ? js : '';

    if (!safeHtml.trim() && !safeJs.trim()) {
        errors.push('HTML 和 JS 都是空的 —— 至少要有一样,不然画布上什么都不会出现。');
    }
    if (safeHtml.length > MAX_TOY_HTML_LEN_FREE) {
        errors.push(`HTML 有 ${safeHtml.length} 个字符,超过上限 ${MAX_TOY_HTML_LEN_FREE}。`);
    }
    if (safeCss.length > MAX_TOY_CSS_LEN) {
        errors.push(`CSS 有 ${safeCss.length} 个字符,超过上限 ${MAX_TOY_CSS_LEN}。`);
    }
    if (safeJs.length > MAX_TOY_JS_LEN) {
        errors.push(`JS 有 ${safeJs.length} 个字符,超过上限 ${MAX_TOY_JS_LEN}。`);
    }

    // 死循环是这个模式唯一拦不住的事故:卡住的时候连提示都弹不出来
    if (/\bwhile\s*\(\s*(?:true|1)\s*\)|\bfor\s*\(\s*;\s*;\s*\)/.test(safeJs)) {
        warnings.push('代码里有 while(true) 或者 for(;;)。沙箱和界面共用一个线程,真跑起来会把整个 App 卡死 —— 循环动画请改用 requestAnimationFrame。');
    }
    // 沙箱的 CSP 把网络掐死了,写了也是白写,而且报错很难懂
    if (/https?:\/\//.test(safeCss) || /\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|import\s*\(/.test(safeJs)) {
        warnings.push('沙箱里连不了网(外部图片、外部字体、fetch 全都会被拦)。要图形请用 CSS 渐变、内联 SVG 或者 canvas 自己画。');
    }
    // 常见误解:以为能拿到外面的东西
    if (/\b(?:parent|top|window\.parent)\s*\./.test(safeJs)) {
        warnings.push('沙箱是独立的,读不到外面的页面。要出声、要震动、要存档请用 hb.sound() / hb.haptic() / hb.save()。');
    }
    if (safeJs.trim() && !/\bhb\b/.test(safeJs)) {
        warnings.push('代码里一次都没用到 hb —— 做出来的东西不会出声、不会震动,也不会存档。');
    }

    return { ok: errors.length === 0, errors, warnings };
}

/**
 * 一步到位:消毒 + 体检。页面「应用到主体」按钮走这条。
 * @param {string} rawHtml
 * @param {string} rawCss
 * @param {{ layout?: 'grid'|'free'|'code', js?: string }} [options] 不传按格子模式走(老调用点不用改)
 * @returns {{ ok: boolean, html: string, css: string, removed: string[], errors: string[], warnings: string[] }}
 */
export function sanitizeToyTemplate(rawHtml, rawCss, options = {}) {
    // ★ 沙箱模式原样放行,只体检不改写(理由见文件头注释)
    if (options.layout === 'code') {
        const html = typeof rawHtml === 'string' ? rawHtml : '';
        const css = typeof rawCss === 'string' ? rawCss : '';
        const check = validateToyCode(html, css, options.js);
        return { ok: check.ok, html, css, removed: [], errors: check.errors, warnings: check.warnings };
    }

    const htmlResult = sanitizeToyHtml(rawHtml);
    const cssResult = sanitizeToyCss(rawCss);
    const removed = [];
    htmlResult.removed.forEach(item => markRemoved(removed, item));
    cssResult.removed.forEach(item => markRemoved(removed, item));

    const check = validateToyTemplate(htmlResult.html, cssResult.css, options);
    return {
        ok: check.ok,
        html: htmlResult.html,
        css: cssResult.css,
        removed,
        errors: check.errors,
        warnings: check.warnings,
    };
}

/** 同一类东西只报一次,免得「已移除 on* 行内事件 ×12」 */
function markRemoved(list, label) {
    if (!list.includes(label)) list.push(label);
}

/**
 * 文本转义。页面上凡是要把「用户写的东西」当文字回显的地方都过一遍。
 * (Vue 的 {{ }} 本身会转义,这个留给拼字符串的场景,比如 aria-label。)
 */
export function escapeToyText(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
