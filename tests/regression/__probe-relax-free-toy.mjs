/**
 * 回归:自定义捏捏的「自由模式」
 *
 * 只跑纯逻辑层(消毒 / 体检 / 提示词 / 零件计数)—— 这几个文件在顶层不碰 DOM,
 * node 能直接 import。DOM 那半边(toy-parts 的指针接管)靠手动在真机上试。
 *
 * 跑法:node --experimental-loader ./__loader-alias.mjs tests/regression/__probe-relax-free-toy.mjs
 */

import assert from 'node:assert/strict';

import {
    sanitizeToyTemplate,
    validateToyTemplate,
    validateToyCode,
    MAX_TOY_HTML_LEN,
    MAX_TOY_HTML_LEN_FREE,
    MAX_TOY_JS_LEN,
} from '../../js/apps/relax-app/services/toy-sanitizer.js';
import {
    buildCustomToyPrompt,
    normalizeToyBlueprint,
    normalizeToyLayout,
    splitAiReply,
    TOY_BLUEPRINT_PRESETS,
    TOY_MOVES,
    TOY_LAYOUTS,
} from '../../js/apps/relax-app/services/toy-prompt.js';
import { countToyParts, TOY_PART_GUIDE, TOY_PART_ATTRS } from '../../js/apps/relax-app/services/toy-parts.js';
// ★ 这一行同时也是语法检查:沙箱那份引导脚本是个巨大的模板字符串,
//   里面手滑打一个反引号就会把整个模块截断,而浏览器里只会报一句
//   莫名其妙的「Unexpected token」。node 一 import 就当场炸,省得跑到端到端才发现。
import { buildSandboxDoc } from '../../js/apps/relax-app/services/toy-sandbox.js';

let passed = 0;
function check(name, fn) {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
}

console.log('relax / 自由模式捏捏');

// ── 布局规整 ────────────────────────────────────────────
check('layout 只认 grid / free / code', () => {
    assert.equal(normalizeToyLayout('free'), 'free');
    assert.equal(normalizeToyLayout('grid'), 'grid');
    assert.equal(normalizeToyLayout('code'), 'code');
    assert.equal(normalizeToyLayout(undefined), 'grid');
    assert.equal(normalizeToyLayout('<script>'), 'grid');
});

// ── 零件计数 ────────────────────────────────────────────
check('countToyParts 只数认识的类型', () => {
    const html = `
        <div data-hb="stick" data-id="s"></div>
        <span data-hb='press'></span>
        <span data-hb=toggle></span>
        <span data-hb="button"></span>
        <span data-hb=""></span>`;
    assert.equal(countToyParts(html), 3);
    assert.equal(countToyParts('<div></div>'), 0);
    assert.equal(countToyParts(null), 0);
});

check('速查表和引擎认识的类型对得上', () => {
    const types = TOY_PART_GUIDE.map(item => item.type);
    assert.deepEqual(types, ['press', 'toggle', 'stick', 'slide', 'dial']);
    // 每一种都能被 countToyParts 数出来 —— 说明两处的判据没走岔
    for (const type of types) {
        assert.equal(countToyParts(`<b data-hb="${type}"></b>`), 1, type);
    }
    assert.ok(TOY_PART_ATTRS.length >= 10);
});

// ── 消毒:两种模式共用同一套危险判据 ──────────────────────
check('自由模式照样铲脚本和行内事件', () => {
    const dirty = '<div data-hb="press" onclick="alert(1)"><script>evil()</script></div>';
    const out = sanitizeToyTemplate(dirty, '.x{color:red}', { layout: 'free' });
    assert.ok(!out.html.includes('onclick'));
    assert.ok(!out.html.includes('<script'));
    assert.ok(out.html.includes('data-hb="press"'), 'data-hb 不能被误伤');
});

check('data-* 属性全部活着过消毒', () => {
    const html = '<i data-hb="slide" data-id="wheel" data-axis="y" data-wrap data-gain="0.35" data-step="0.12"></i>';
    const out = sanitizeToyTemplate(html, '', { layout: 'free' });
    for (const attr of ['data-hb="slide"', 'data-id="wheel"', 'data-axis="y"', 'data-wrap', 'data-gain="0.35"', 'data-step="0.12"']) {
        assert.ok(out.html.includes(attr), attr);
    }
});

check('越狱的 } 和全局选择器两种模式都拦', () => {
    for (const layout of ['grid', 'free']) {
        const out = sanitizeToyTemplate('<b data-hb="press"></b>', '.a{color:red} } body{display:none}', { layout });
        assert.ok(!/\bbody\s*\{/.test(out.css), `${layout}:body 选择器没被改写`);
        assert.ok(out.removed.length > 0, `${layout}:应该报告删了东西`);
    }
});

// ── 长度上限按模式分 ────────────────────────────────────
check('自由模式的 HTML 上限比格子模式宽', () => {
    assert.ok(MAX_TOY_HTML_LEN_FREE > MAX_TOY_HTML_LEN);
    const long = `<div data-hb="press">${'x'.repeat(MAX_TOY_HTML_LEN + 100)}</div>`;
    assert.equal(validateToyTemplate(long, '', { layout: 'grid' }).ok, false);
    assert.equal(validateToyTemplate(long, '', { layout: 'free' }).ok, true);
});

check('不传 options 时按格子模式走(老调用点不能被改坏)', () => {
    const long = `<div>${'x'.repeat(MAX_TOY_HTML_LEN + 100)}</div>`;
    assert.equal(validateToyTemplate(long, '').ok, false);
    assert.equal(sanitizeToyTemplate('<b>hi</b>', '.a{color:red}').ok, true);
});

// ── 体检:自由模式要提醒「一个零件都没有」 ────────────────
check('自由模式没零件时给警告而不是报错', () => {
    const out = validateToyTemplate('<div class="x"></div>', '.x{}', { layout: 'free' });
    assert.equal(out.ok, true, '只是提醒,不能拦住应用');
    assert.ok(out.warnings.some(w => w.includes('data-hb')));
});

check('自由模式有零件时不啰嗦', () => {
    const out = validateToyTemplate('<div data-hb="stick"></div>', '.x{color:red}', { layout: 'free' });
    assert.equal(out.warnings.length, 0);
});

check('格子模式不该冒出 data-hb 的提示', () => {
    const out = validateToyTemplate('<div class="x"></div>', '.x{color:red}', { layout: 'grid' });
    assert.ok(!out.warnings.some(w => w.includes('data-hb')));
});

// ── 提示词:两份契约必须分得干净 ──────────────────────────
check('格子模式的提示词讲「只写一格」,不提 data-hb', () => {
    const text = buildCustomToyPrompt(normalizeToyBlueprint(null), { rows: 4, cols: 4, layout: 'grid' });
    assert.ok(text.includes('你只写一格'));
    assert.ok(text.includes('{index}'));
    assert.ok(!text.includes('data-hb'), '格子模式不该出现零件协议');
});

check('自由模式的提示词讲 data-hb,不提占位符复制', () => {
    const bp = normalizeToyBlueprint({ moves: ['stick', 'press'] });
    const text = buildCustomToyPrompt(bp, { layout: 'free' });
    assert.ok(text.includes('data-hb'));
    assert.ok(text.includes('--hb-x'));
    assert.ok(text.includes('--hb-unit'));
    assert.ok(text.includes('pointer-events: none'));
    assert.ok(!text.includes('复制 16 份'));
});

check('自由模式只讲被勾中的零件', () => {
    const text = buildCustomToyPrompt(normalizeToyBlueprint({ moves: ['dial'] }), { layout: 'free' });
    assert.ok(text.includes('data-hb="dial"'));
    assert.ok(!text.includes('data-hb="stick"'));
    assert.ok(!text.includes('data-hb="toggle"'));
});

check('moves 会被规整:去重、滤掉不认识的、空了退回 press', () => {
    assert.deepEqual(normalizeToyBlueprint({ moves: ['stick', 'stick', 'nope'] }).moves, ['stick']);
    assert.deepEqual(normalizeToyBlueprint({ moves: [] }).moves, ['press']);
    assert.deepEqual(normalizeToyBlueprint({ moves: 'stick' }).moves, ['press']);
    assert.deepEqual(normalizeToyBlueprint(null).moves, ['press']);
});

check('章节编号连续,没有空洞', () => {
    const text = buildCustomToyPrompt(normalizeToyBlueprint({ motion: 'none', decorated: false }), { layout: 'free' });
    const nums = [...text.matchAll(/^## ([一二三四五六七八九十]+)、/gm)].map(m => m[1]);
    const order = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    nums.forEach((n, i) => assert.equal(n, order[i], `第 ${i + 1} 章编号是「${n}」`));
});

// ── 预设 ────────────────────────────────────────────────
check('每条蓝图预设都带合法的 layout', () => {
    const known = TOY_LAYOUTS.map(l => l.id);
    for (const preset of TOY_BLUEPRINT_PRESETS) {
        assert.ok(known.includes(preset.layout), `${preset.id} 的 layout 是 ${preset.layout}`);
        assert.ok(preset.name && preset.desc, preset.id);
    }
    assert.ok(TOY_BLUEPRINT_PRESETS.some(p => p.layout === 'free'), '要有自由模式的预设');
    assert.ok(TOY_BLUEPRINT_PRESETS.some(p => p.id === 'joystick'));
    assert.ok(TOY_BLUEPRINT_PRESETS.some(p => p.id === 'mouse'));
});

check('自由模式预设勾的零件都是认识的', () => {
    const known = TOY_MOVES.map(m => m.id);
    for (const preset of TOY_BLUEPRINT_PRESETS.filter(p => p.layout === 'free')) {
        for (const move of preset.blueprint.moves || []) {
            assert.ok(known.includes(move), `${preset.id} 勾了不存在的零件 ${move}`);
        }
    }
});

// ── 粘贴回填 ────────────────────────────────────────────
check('AI 回复拆分照旧', () => {
    const reply = '好的\n```html\n<div data-hb="press"></div>\n```\n```css\n.a{color:red}\n```';
    const out = splitAiReply(reply);
    assert.equal(out.ok, true);
    assert.ok(out.html.includes('data-hb'));
    assert.ok(out.css.includes('color:red'));
});

check('三段围栏能拆出 JS', () => {
    const reply = '```html\n<div class="a"></div>\n```\n```css\n.a{color:red}\n```\n```js\nhb.sound({rate:1});\n```';
    const out = splitAiReply(reply, { layout: 'code' });
    assert.equal(out.ok, true);
    assert.ok(out.js.includes('hb.sound'));
});

check('HTML 里夹着 <script> 会被挪到 JS 那栏', () => {
    const reply = '```html\n<div class="a"></div>\n<script>hb.haptic("light");<\/script>\n```';
    const out = splitAiReply(reply, { layout: 'code' });
    assert.equal(out.ok, true);
    assert.ok(!out.html.includes('<script'), 'script 标签要从 HTML 里摘掉');
    assert.ok(out.js.includes('hb.haptic'));
});

check('code 模式下只回 JS 也算成功;别的模式不算', () => {
    const reply = '```js\nhb.el.textContent = "hi";\n```';
    assert.equal(splitAiReply(reply, { layout: 'code' }).ok, true);
    assert.equal(splitAiReply(reply, { layout: 'free' }).ok, false);
});

check('没标语言但明显是 JS 的块能认出来', () => {
    const reply = '```\nvar a = 1;\nhb.el.addEventListener("pointerdown", function(){});\n```';
    const out = splitAiReply(reply, { layout: 'code' });
    assert.equal(out.ok, true);
    assert.ok(out.js.includes('addEventListener'));
    assert.equal(out.html, '');
});

// ── 沙箱模式:体检而不消毒 ──────────────────────────────
check('code 模式原样放行,不删 <script> 和 onclick', () => {
    const html = '<div onclick="go()"><style>.a{}</style></div>';
    const out = sanitizeToyTemplate(html, 'body{margin:0}', { layout: 'code', js: 'var a = 1;' });
    assert.equal(out.ok, true);
    assert.equal(out.html, html, 'HTML 必须一个字都不动');
    assert.equal(out.css, 'body{margin:0}', 'CSS 必须一个字都不动(body 选择器在 iframe 里是合法的)');
    assert.deepEqual(out.removed, []);
});

check('code 模式:HTML 和 JS 全空才报错', () => {
    assert.equal(validateToyCode('', '', '').ok, false);
    assert.equal(validateToyCode('', '.a{}', '').ok, false, '只有 CSS 不够');
    assert.equal(validateToyCode('<div></div>', '', '').ok, true);
    assert.equal(validateToyCode('', '', 'hb.el.textContent="x"').ok, true, '只有 JS 也行');
});

check('code 模式:死循环要警告', () => {
    const loop = validateToyCode('<div></div>', '', 'while (true) { hb.sound(); }');
    assert.equal(loop.ok, true, '只是警告,不能拦住应用');
    assert.ok(loop.warnings.some(w => w.includes('卡死')));
    assert.ok(validateToyCode('<div></div>', '', 'for(;;){}').warnings.some(w => w.includes('卡死')));
    // 正常的循环不能误报
    assert.ok(!validateToyCode('<div></div>', '', 'for (var i=0;i<3;i++) hb.sound();')
        .warnings.some(w => w.includes('卡死')));
});

check('code 模式:联网 / 读 parent / 没用 hb 都要提醒', () => {
    assert.ok(validateToyCode('<b></b>', '', 'fetch("/x")').warnings.some(w => w.includes('连不了网')));
    assert.ok(validateToyCode('<b></b>', '.a{background:url(https://x/a.png)}', 'hb.sound()')
        .warnings.some(w => w.includes('连不了网')));
    assert.ok(validateToyCode('<b></b>', '', 'parent.document.title="x"').warnings.some(w => w.includes('独立的')));
    assert.ok(validateToyCode('<b></b>', '', 'var a = 1;').warnings.some(w => w.includes('没用到 hb')));
});

check('code 模式:JS 也有长度上限', () => {
    const long = 'hb.sound();'.repeat(Math.ceil(MAX_TOY_JS_LEN / 11) + 20);
    assert.equal(validateToyCode('<b></b>', '', long).ok, false);
});

// ── 沙箱模式的提示词 ────────────────────────────────────
check('code 模式的提示词讲 hb 和沙箱,不讲 data-hb', () => {
    const text = buildCustomToyPrompt(normalizeToyBlueprint(null), { layout: 'code' });
    assert.ok(text.includes('hb.sound'));
    assert.ok(text.includes('hb.state'));
    assert.ok(text.includes('sandbox'));
    assert.ok(text.includes('requestAnimationFrame'));
    assert.ok(text.includes('while (true)') || text.includes('while(true)'), '必须警告死循环');
    assert.ok(text.includes('connect-src') || text.includes('上不了网'), '必须说清楚连不了网');
    assert.ok(!text.includes('data-hb'), 'code 模式不该出现零件协议');
    assert.ok(!text.includes('你只写一格'));
});

check('code 模式的输出格式要三段', () => {
    const text = buildCustomToyPrompt(normalizeToyBlueprint(null), { layout: 'code' });
    assert.ok(text.includes('```js'));
    assert.ok(text.includes('只输出三段代码'));
});

check('三种做法的提示词互不串味', () => {
    const bp = normalizeToyBlueprint(null);
    const grid = buildCustomToyPrompt(bp, { layout: 'grid' });
    const free = buildCustomToyPrompt(bp, { layout: 'free' });
    const code = buildCustomToyPrompt(bp, { layout: 'code' });

    // 「复制 N 份」是格子模式独有的硬约束,漏进另外两档就会让 AI 写错结构
    const GRID_ONLY = '板子会把你这段 HTML 复制';
    assert.ok(grid.includes(GRID_ONLY));
    assert.ok(!free.includes(GRID_ONLY));
    assert.ok(!code.includes(GRID_ONLY));

    // 零件协议只属于 free
    assert.ok(!grid.includes('data-hb'));
    assert.ok(free.includes('data-hb'));
    assert.ok(!code.includes('data-hb'));

    // hb 桥只属于 code
    assert.ok(!grid.includes('hb.sound'));
    assert.ok(!free.includes('hb.sound'));
    assert.ok(code.includes('hb.sound'));

    // free 会**提到** {index} 是为了叫 AI 别用,但只有 grid 才教它怎么用
    assert.ok(grid.includes('| `{index}` |'), 'grid 要有占位符对照表');
    assert.ok(!free.includes('| `{index}` |'));
    assert.ok(!code.includes('{index}'));
});

// ── 沙箱文档:安全边界本身 ──────────────────────────────
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

check('沙箱文档带齐了隔离用的那几条', () => {
    const doc = buildSandboxDoc({ channel: 'c1', tint: '#fff', state: {}, html: b64('<i></i>'), css: b64(''), js: b64('') });
    // 这一条最要命:加了 allow-same-origin 就等于没有沙箱
    assert.ok(!doc.includes('allow-same-origin'), '绝对不能出现 allow-same-origin');
    assert.ok(doc.includes("connect-src 'none'"), 'CSP 要掐掉网络');
    assert.ok(doc.includes("default-src 'none'"));
    assert.ok(doc.includes('img-src data: blob:'), '外部图片也要拦');
    assert.ok(doc.includes('Content-Security-Policy'));
});

check('用户代码走 base64,不会被当成文档的一部分', () => {
    const nasty = 'var a = 1; // </script><img src=x onerror=alert(1)>';
    const doc = buildSandboxDoc({
        channel: 'c1', tint: '#fff', state: {},
        html: b64('<i></i>'), css: b64(''), js: b64(nasty),
    });
    assert.ok(!doc.includes('onerror=alert'), '原文不该出现在文档里');
    assert.ok(!doc.includes('// </script>'), '不该有能提前闭合的片段');
    // 文档里只应该有一对 script 标签(引导脚本那一对)
    assert.equal((doc.match(/<\/script>/g) || []).length, 1);
});

check('存档里的怪字符也不会撑破文档', () => {
    const doc = buildSandboxDoc({
        channel: 'c1', tint: '#fff',
        state: { note: '</script><b>x</b>' },
        html: b64('<i></i>'), css: b64(''), js: b64(''),
    });
    assert.equal((doc.match(/<\/script>/g) || []).length, 1);
    assert.ok(!doc.includes('<b>x</b>'));
});

check('code 模式的预设齐全,layout 标对了', () => {
    const codePresets = TOY_BLUEPRINT_PRESETS.filter(p => p.layout === 'code');
    assert.ok(codePresets.length >= 3, `只有 ${codePresets.length} 条`);
    assert.deepEqual(TOY_LAYOUTS.map(l => l.id), ['grid', 'free', 'code']);
});

console.log(`\n全部通过(${passed} 项)`);
