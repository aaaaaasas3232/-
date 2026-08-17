/**
 * 小奇怪 · 模板编译体检
 *
 * 为什么要单独有这么一个东西:Vue 3 的运行时模板编译器在遇到某些**合法长相
 * 但非法结构**的写法时(比如 `<template v-if>` 里面又塞一个 `<template #slot>`),
 * 抛的是 `Cannot read properties of undefined (reading 'type')` ——
 * 既不报哪个文件、也不报哪一行,页面直接白屏。踩过一次就不想再靠肉眼找。
 *
 * 这里把每个组件的 template 字符串抠出来单独编一遍,谁坏了立刻点名。
 *
 *   node scripts/quality/__check-oddity-templates.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const DIR = 'js/apps/oddity/components';

/**
 * Vue 是浏览器全局包,不是 npm 包 —— 只能读文件塞进 vm 里跑。
 *
 * ★ 编译器解析 HTML 实体时会借一个 `<div>` 来解码,而且**两条路都要走通**:
 *     文本   `div.innerHTML = raw` → 读 `div.textContent`
 *     属性   `div.innerHTML = '<div foo="raw">'` → 读 `div.children[0].getAttribute('foo')`
 *   只给一个空壳的话,凡是属性值里带 `&` 的模板(`:class="a && b"` 这种)
 *   全都会在解码这一步炸掉,报一个和模板本身毫无关系的错 ——
 *   足以让人以为六个好模板全坏了。所以这个替身必须真的能来回一趟。
 */
function decodeBasic(text) {
    return String(text)
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, '\u00a0')
        .replace(/&amp;/g, '&');
}

const decoder = {
    _html: '',
    set innerHTML(value) { this._html = String(value); },
    get innerHTML() { return this._html; },
    get textContent() { return decodeBasic(this._html); },
    get children() {
        const hit = /^<div foo="([\s\S]*)">$/.exec(this._html);
        const value = hit ? decodeBasic(hit[1]) : '';
        return [{ getAttribute: () => value }];
    },
};

const sandbox = { console, document: { createElement: () => decoder } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/vendor/vue.global.prod.js', 'utf8'), sandbox);

let bad = 0;
let total = 0;

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.js'))) {
    const code = fs.readFileSync(path.join(DIR, file), 'utf8');
    for (const match of code.matchAll(/template:\s*`([\s\S]*?)`,\n/g)) {
        total += 1;
        try {
            sandbox.Vue.compile(match[1]);
        } catch (err) {
            bad += 1;
            const head = match[1].trim().split('\n')[0].trim();
            console.error(`  XX  ${file}  ${head}\n      ${err.message}`);
        }
    }
}

console.log(`\n=== ${total - bad}/${total} 个模板能编 ===`);
process.exit(bad ? 1 : 0);
