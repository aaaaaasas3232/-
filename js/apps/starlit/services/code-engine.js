/**
 * 点灯 · 代码引擎
 *
 * 四件事：
 *   1. highlightLines  逐行高亮（HTML / CSS / JS 各一个小 tokenizer）
 *   2. buildPreviewDoc 拼出能塞进 iframe srcdoc 的完整文档
 *   3. buildBirthFrames「看这个网页怎么从一片空白里长出来」的逐帧快照
 *   4. toggleLine      勾掉/恢复某一行（注释掉，可撤销）
 *
 * ── 为什么自己写 tokenizer ──────────────────────────────────────
 * 引一个 Prism / highlight.js 进来，单文件打包要多背几十 KB，
 * 而且它们输出的类名不受本 App 的 token 体系管。
 * 教学片段都很短，几百行的状态机足够，也快得多。
 *
 * ── 性能 ────────────────────────────────────────────────────────
 * 高亮结果按「源码 + 语言」缓存。推理墙上同一张代码卡反复进出视口时
 * 不会重复算。缓存有上限，超了就整个丢掉重来（LRU 的复杂度不值得）。
 */

import { escapeHtml } from '../utils.js';

// ============================================================
// 高亮
// ============================================================

const CACHE = new Map();
const CACHE_MAX = 240;

const JS_KEYWORDS = new Set([
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
    'break', 'continue', 'new', 'class', 'extends', 'super', 'this', 'typeof',
    'instanceof', 'in', 'of', 'try', 'catch', 'finally', 'throw', 'switch', 'case',
    'default', 'async', 'await', 'yield', 'import', 'export', 'from', 'delete', 'void',
    'true', 'false', 'null', 'undefined', 'NaN',
]);

function span(cls, text) {
    return `<span class="sl-t-${cls}">${escapeHtml(text)}</span>`;
}

/**
 * HTML 高亮。用一个很小的状态机走：文本 / 标签内 / 注释 / 属性值。
 * 不追求 100% 正确，追求「教学片段上永远不会崩」。
 */
function highlightHtmlLine(line, state) {
    let out = '';
    let i = 0;
    const n = line.length;

    while (i < n) {
        if (state.mode === 'comment') {
            const end = line.indexOf('-->', i);
            if (end === -1) { out += span('comment', line.slice(i)); i = n; break; }
            out += span('comment', line.slice(i, end + 3));
            i = end + 3;
            state.mode = 'text';
            continue;
        }

        if (state.mode === 'text') {
            if (line.startsWith('<!--', i)) { state.mode = 'comment'; continue; }
            const lt = line.indexOf('<', i);
            if (lt === -1) { out += escapeHtml(line.slice(i)); i = n; break; }
            if (lt > i) out += escapeHtml(line.slice(i, lt));
            // 标签名
            const m = line.slice(lt).match(/^<\/?\s*([a-zA-Z][\w:-]*)/);
            if (!m) { out += escapeHtml(line.slice(lt, lt + 1)); i = lt + 1; continue; }
            out += span('punct', line.slice(lt, lt + (m[0].length - m[1].length)));
            out += span('tag', m[1]);
            i = lt + m[0].length;
            state.mode = 'tag';
            continue;
        }

        // state.mode === 'tag'
        const ch = line[i];
        if (ch === '>') { out += span('punct', '>'); i += 1; state.mode = 'text'; continue; }
        if (ch === '/' && line[i + 1] === '>') { out += span('punct', '/>'); i += 2; state.mode = 'text'; continue; }
        if (ch === ' ' || ch === '\t') { out += ch; i += 1; continue; }
        if (ch === '=') { out += span('punct', '='); i += 1; continue; }
        if (ch === '"' || ch === "'") {
            const end = line.indexOf(ch, i + 1);
            const stop = end === -1 ? n : end + 1;
            out += span('string', line.slice(i, stop));
            i = stop;
            continue;
        }
        const attr = line.slice(i).match(/^[@:a-zA-Z_][\w:.-]*/);
        if (attr) { out += span('attr', attr[0]); i += attr[0].length; continue; }
        out += escapeHtml(ch);
        i += 1;
    }
    return out;
}

/** CSS 高亮：选择器 / 属性 / 值 / 注释 */
function highlightCssLine(line, state) {
    let out = '';
    let i = 0;
    const n = line.length;

    while (i < n) {
        if (state.mode === 'comment') {
            const end = line.indexOf('*/', i);
            if (end === -1) { out += span('comment', line.slice(i)); i = n; break; }
            out += span('comment', line.slice(i, end + 2));
            i = end + 2;
            state.mode = state.prev || 'sel';
            continue;
        }
        if (line.startsWith('/*', i)) { state.prev = state.mode; state.mode = 'comment'; continue; }

        const ch = line[i];
        if (ch === '{') { out += span('punct', '{'); i += 1; state.mode = 'body'; continue; }
        if (ch === '}') { out += span('punct', '}'); i += 1; state.mode = 'sel'; continue; }

        if (state.mode === 'body') {
            if (ch === ':') { out += span('punct', ':'); i += 1; state.mode = 'value'; continue; }
            if (ch === ';') { out += span('punct', ';'); i += 1; continue; }
            const prop = line.slice(i).match(/^-{0,2}[a-zA-Z][\w-]*/);
            if (prop) { out += span('prop', prop[0]); i += prop[0].length; continue; }
            out += escapeHtml(ch); i += 1; continue;
        }

        if (state.mode === 'value') {
            if (ch === ';') { out += span('punct', ';'); i += 1; state.mode = 'body'; continue; }
            if (ch === '"' || ch === "'") {
                const end = line.indexOf(ch, i + 1);
                const stop = end === -1 ? n : end + 1;
                out += span('string', line.slice(i, stop)); i = stop; continue;
            }
            const num = line.slice(i).match(/^#[0-9a-fA-F]{3,8}\b|^-?\d*\.?\d+(px|rem|em|%|vh|vw|s|ms|deg|fr)?/);
            if (num && num[0]) { out += span('number', num[0]); i += num[0].length; continue; }
            const word = line.slice(i).match(/^[a-zA-Z-][\w-]*/);
            if (word) { out += span('value', word[0]); i += word[0].length; continue; }
            out += escapeHtml(ch); i += 1; continue;
        }

        // 选择器区
        const at = line.slice(i).match(/^@[\w-]+/);
        if (at) { out += span('keyword', at[0]); i += at[0].length; continue; }
        const sel = line.slice(i).match(/^[.#]?[\w-]+/);
        if (sel && sel[0]) { out += span('tag', sel[0]); i += sel[0].length; continue; }
        out += escapeHtml(ch);
        i += 1;
    }
    return out;
}

/** JS 高亮 */
function highlightJsLine(line, state) {
    let out = '';
    let i = 0;
    const n = line.length;

    while (i < n) {
        if (state.mode === 'block') {
            const end = line.indexOf('*/', i);
            if (end === -1) { out += span('comment', line.slice(i)); i = n; break; }
            out += span('comment', line.slice(i, end + 2));
            i = end + 2;
            state.mode = 'code';
            continue;
        }
        if (line.startsWith('/*', i)) { state.mode = 'block'; continue; }
        if (line.startsWith('//', i)) { out += span('comment', line.slice(i)); i = n; break; }

        const ch = line[i];
        if (ch === '"' || ch === "'" || ch === '`') {
            let j = i + 1;
            while (j < n && (line[j] !== ch || line[j - 1] === '\\')) j += 1;
            out += span('string', line.slice(i, Math.min(j + 1, n)));
            i = j + 1;
            continue;
        }
        const num = line.slice(i).match(/^\d*\.?\d+/);
        if (num && num[0] && !/[\w$]/.test(line[i - 1] || '')) {
            out += span('number', num[0]); i += num[0].length; continue;
        }
        const word = line.slice(i).match(/^[A-Za-z_$][\w$]*/);
        if (word) {
            const w = word[0];
            out += JS_KEYWORDS.has(w) ? span('keyword', w) : escapeHtml(w);
            i += w.length;
            continue;
        }
        if (/[{}()[\];,.:=+\-*/<>!?&|]/.test(ch)) { out += span('punct', ch); i += 1; continue; }
        out += escapeHtml(ch);
        i += 1;
    }
    return out;
}

/**
 * 逐行高亮。
 * @returns {Array<{n:number, text:string, html:string, indent:number}>} n 从 1 开始
 */
export function highlightLines(code, lang = 'html') {
    const src = String(code ?? '');
    const key = `${lang}::${src.length}::${src.slice(0, 64)}::${src.slice(-64)}`;
    const hit = CACHE.get(key);
    if (hit) return hit;

    const fn = lang === 'css' ? highlightCssLine : lang === 'js' ? highlightJsLine : highlightHtmlLine;
    const state = { mode: lang === 'css' ? 'sel' : lang === 'js' ? 'code' : 'text', prev: '' };
    const out = src.split('\n').map((text, idx) => ({
        n: idx + 1,
        text,
        html: fn(text, state) || '&nbsp;',
        indent: (text.match(/^[ \t]*/) || [''])[0].length,
    }));

    if (CACHE.size > CACHE_MAX) CACHE.clear();
    CACHE.set(key, out);
    return out;
}

// ============================================================
// 勾掉一行（注释掉，可恢复）
// ============================================================

const COMMENT_STYLE = {
    html: { open: '<!-- ', close: ' -->', test: /^\s*<!--([\s\S]*?)-->\s*$/ },
    css: { open: '/* ', close: ' */', test: /^\s*\/\*([\s\S]*?)\*\/\s*$/ },
    js: { open: '// ', close: '', test: /^(\s*)\/\/ ?(.*)$/ },
};

export function isLineDisabled(text, lang) {
    const style = COMMENT_STYLE[lang] || COMMENT_STYLE.html;
    return style.test.test(String(text ?? ''));
}

/** 注释掉 / 取消注释某一行。返回新的整段源码。 */
export function toggleLine(code, lang, lineNumber) {
    const lines = String(code ?? '').split('\n');
    const idx = Math.max(0, Math.min(lines.length - 1, Number(lineNumber) - 1));
    const raw = lines[idx] ?? '';
    const style = COMMENT_STYLE[lang] || COMMENT_STYLE.html;
    const indent = (raw.match(/^[ \t]*/) || [''])[0];
    const body = raw.slice(indent.length);

    if (style.test.test(raw)) {
        const m = raw.match(style.test);
        // js 的分组和另外两个不一样
        const inner = lang === 'js' ? m[2] : m[1];
        lines[idx] = indent + String(inner).trim();
    } else {
        if (!body.trim()) return String(code ?? '');
        lines[idx] = `${indent}${style.open}${body}${style.close}`;
    }
    return lines.join('\n');
}

/** 改掉某一行的内容（长按编辑用） */
export function replaceLine(code, lineNumber, nextText) {
    const lines = String(code ?? '').split('\n');
    const idx = Math.max(0, Math.min(lines.length - 1, Number(lineNumber) - 1));
    const indent = (lines[idx].match(/^[ \t]*/) || [''])[0];
    lines[idx] = indent + String(nextText ?? '').replace(/^\s+/, '');
    return lines.join('\n');
}

// ============================================================
// 预览
// ============================================================

/**
 * 预览文档。
 *
 * 注意 iframe 用的是 sandbox="allow-scripts"（**不给 allow-same-origin**）：
 * 学生的代码跑在一个 opaque origin 里，读不到宿主的 localStorage / IndexedDB。
 * 教学片段不需要同源，安全上不值得冒这个险。
 */
export function buildPreviewDoc({ html = '', css = '', js = '', scale = 1, dark = false } = {}) {
    const body = String(html || '');
    const style = String(css || '');
    const script = String(js || '');
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
  font-size:14px;line-height:1.6;color:${dark ? '#e8e8ec' : '#22232a'};
  background:${dark ? '#16171c' : '#ffffff'};padding:12px;
  ${scale !== 1 ? `zoom:${scale};` : ''}}
</style>
<style>${style}</style>
</head><body>
${body}
<script>
(function(){
  try{
${script}
  }catch(e){
    var d=document.createElement('pre');
    d.style.cssText='margin:10px 0 0;padding:8px 10px;border-radius:8px;background:#fdecec;color:#9c2b2b;font-size:12px;white-space:pre-wrap';
    d.textContent='脚本出错：'+(e&&e.message?e.message:e);
    document.body.appendChild(d);
  }
})();
<\/script>
</body></html>`;
}

// ============================================================
// 「从一片空白里诞生」播放器
// ============================================================

/**
 * 把一段 HTML 拆成「一个节点一个节点长出来」的累积快照。
 *
 * 用 DOMParser 建真树再按文档序逐个补进去 —— 直接按字符串切的话，
 * 中途永远是「没闭合的半截标签」，浏览器会自动补全，画面会乱跳。
 */
function htmlGrowthFrames(html) {
    if (typeof DOMParser === 'undefined') return [String(html || '')];
    let doc;
    try {
        doc = new DOMParser().parseFromString(`<body>${String(html || '')}</body>`, 'text/html');
    } catch (_) {
        return [String(html || '')];
    }
    const source = doc.body;

    // 文档序展开（只要元素和非空文本）
    const order = [];
    const walk = (node) => {
        for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === 1) { order.push(child); walk(child); } else if (child.nodeType === 3 && child.nodeValue.trim()) { order.push(child); }
        }
    };
    walk(source);
    if (order.length === 0) return [String(html || '')];

    const holder = doc.createElement('div');
    const cloneMap = new Map([[source, holder]]);
    const frames = [''];

    for (const node of order) {
        const parentClone = cloneMap.get(node.parentNode) || holder;
        let clone;
        if (node.nodeType === 3) {
            clone = doc.createTextNode(node.nodeValue);
        } else {
            clone = node.cloneNode(false);
            cloneMap.set(node, clone);
        }
        parentClone.appendChild(clone);
        frames.push(holder.innerHTML);
        // 教学片段再大也不该超过这个数，超了就停止细分
        if (frames.length > 80) break;
    }
    if (frames[frames.length - 1] !== String(html || '')) frames.push(String(html || ''));
    return frames;
}

/**
 * 把 CSS 拆成一条规则一帧。
 * 花括号计数，@media 之类整块算一条 —— 拆到里面去意义不大，
 * 学生要看的是「加上这条规则，画面变成什么样」。
 */
function cssRuleFrames(css) {
    const src = String(css || '');
    const rules = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < src.length; i += 1) {
        const c = src[i];
        if (c === '{') depth += 1;
        else if (c === '}') {
            depth -= 1;
            if (depth === 0) {
                const chunk = src.slice(start, i + 1).trim();
                if (chunk) rules.push(chunk);
                start = i + 1;
            }
        }
    }
    const tail = src.slice(start).trim();
    if (tail) rules.push(tail);
    if (rules.length === 0) return [''];

    const frames = [];
    let acc = '';
    for (const rule of rules) {
        acc += `${rule}\n`;
        frames.push(acc);
    }
    return frames;
}

/**
 * 生成完整的「诞生」时间轴。
 *
 * 三幕：
 *   一、结构（裸 HTML，没有任何样式）—— 学生第一次看见「网页本来的样子」
 *   二、样式（一条规则一条规则地贴上去）
 *   三、脚本（跑起来）
 *
 * @returns {Array<{doc:string, stage:string, label:string}>}
 */
export function buildBirthFrames({ html = '', css = '', js = '' } = {}) {
    const frames = [];

    frames.push({
        stage: 'blank',
        label: '一片空白',
        doc: buildPreviewDoc({ html: '', css: '', js: '' }),
    });

    const structure = htmlGrowthFrames(html);
    structure.forEach((snapshot, i) => {
        if (i === 0) return;
        frames.push({
            stage: 'html',
            label: `结构 ${i}/${structure.length - 1}`,
            // 这一幕故意不带 CSS：让学生看见没有样式的 HTML 长什么样
            doc: buildPreviewDoc({ html: snapshot, css: '', js: '' }),
        });
    });

    if (String(css || '').trim()) {
        const rules = cssRuleFrames(css);
        rules.forEach((acc, i) => {
            frames.push({
                stage: 'css',
                label: `样式 ${i + 1}/${rules.length}`,
                doc: buildPreviewDoc({ html, css: acc, js: '' }),
            });
        });
    }

    if (String(js || '').trim()) {
        frames.push({
            stage: 'js',
            label: '脚本跑起来',
            doc: buildPreviewDoc({ html, css, js }),
        });
    }

    // 收尾：完整形态
    frames.push({
        stage: 'done',
        label: '完成',
        doc: buildPreviewDoc({ html, css, js }),
    });

    return frames;
}

/** 一张代码卡里哪些语言有内容 —— 决定要画几个页签 */
export function codeLangs(code = {}) {
    return ['html', 'css', 'js'].filter((l) => String(code?.[l] || '').trim());
}

/** 把 focus 数组整理成 { 'css:4': {mark, note} } 便于逐行查 */
export function focusMap(focus) {
    const map = {};
    for (const f of Array.isArray(focus) ? focus : []) {
        if (!f) continue;
        map[`${f.lang}:${f.line}`] = { mark: f.mark || 1, note: f.note || '' };
    }
    return map;
}
