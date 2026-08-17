/**
 * 蓝图 → 可直接运行的白膜 App 源码
 *
 * @audit-ignore 这是产出 App 代码的代码，里面的 method 名和颜色都属于生成出来的那个 App
 *
 * 生成结果的正确性由两道检查兜底，都比静态扫描更强：
 *   - `tests/regression/__test-codegen.mjs` 对每种渲染模式生成一份，用 new Function 真编译，
 *                                           再跑出 appConfig 逐字段验，最后调一次 renderPage
 *   - `tests/e2e/__probe-app-maker.mjs`     真实浏览器里装到桌面、打开、点弹窗、弹岛、刷新
 *
 * 「白膜」= 3D 里的人模：结构、比例、关节都对，只是没上材质。
 * 生成出来的 App 有真实的页面、真实的顶栏底栏、能点开的弹窗、能弹的灵动岛、
 * 能摆上桌面的小组件 —— 只是里面的内容是占位数据。
 * 用户拿它去看「我要的这个东西，长出来是这个样子吗」。
 *
 * ── 生成代码的三条硬约束 ──────────────────────────────────────────
 *
 * 1. **一行 import 都不能有。**
 *    这段代码有两条命：一条是直接 registerPhoneApp 装到桌面，另一条是
 *    用户下载成 .js、之后从 nook 上传。后者走的是 `import(blobURL)`，
 *    没有构建、没有 importmap，`@/src/core/xxx.js` 这种写法会直接抛
 *    "Failed to resolve module specifier"。所以依赖一律从 window 上取。
 *
 * 2. **预设库拿不到也要能跑。**
 *    `window.__listenPresets` 理论上启动时就在，但插件的加载时机不由我们控制。
 *    所以取不到时退化到内联的极简渲染，宁可难看也不能白屏。
 *
 * 3. **生成的每个按钮都得真的有反应。**
 *    白膜最没意义的形态就是「一堆点不动的 UI」——那还不如看截图。
 *    所以选了什么弹窗就生成对应的 demo 方法，选了什么岛就真的能弹出来。
 */

const INDENT = '    ';

/** 生成代码里出现的字符串字面量。用单引号，转义单引号和换行。 */
function q(value) {
    return `'${String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function indent(text, level = 1) {
    const pad = INDENT.repeat(level);
    return String(text).split('\n').map((line) => (line ? pad + line : line)).join('\n');
}

// ===========================================================================
// 图标
// ===========================================================================

function buildIcon(bp) {
    const initial = (bp.appName || 'A').trim().charAt(0);
    return `<svg viewBox="0 0 60 60" width="60" height="60" xmlns="http://www.w3.org/2000/svg">`
        + `<rect x="10" y="10" width="40" height="40" rx="12" fill="rgba(255,255,255,0.22)" />`
        + `<text x="30" y="38" text-anchor="middle" font-size="22" font-weight="700" fill="#ffffff">${escapeForSvg(initial)}</text>`
        + `</svg>`;
}

function escapeForSvg(ch) {
    return String(ch).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===========================================================================
// 各段
// ===========================================================================

function buildHeader(bp) {
    const lines = [
        '/**',
        ` * ${bp.appName} —— 由「App 制作」生成的白膜`,
        ' *',
    ];
    if (bp.appDesc) lines.push(` * ${bp.appDesc}`, ' *');
    lines.push(
        ' * 这是一个「结构完整、内容占位」的 App：页面、顶栏、底栏、卡片布局、弹窗、',
        ' * 灵动岛、小组件都是真的，可以点、可以弹；卡片里的文字是假数据。',
        ' * 拿它先确认「形状对不对」，再把占位数据换成真业务。',
        ' *',
        ' * ★ 这个文件不能有任何 import。',
        ' *   它要能被 nook 的「软件管理」直接上传安装 —— 那条路径是运行时',
        ' *   import(blobURL)，没有构建步骤，任何相对路径 / @ 别名都解析不了。',
        ' *   依赖全部从 window 上取（见下方 LP）。',
        ' *',
        ` * 生成时间：${new Date().toLocaleString('zh-CN')}`,
        ' */',
        '',
    );
    return lines.join('\n');
}

function buildPreamble(bp) {
    return `${INDENT}// ── 依赖 ────────────────────────────────────────────────────
${INDENT}// 框架预设库。取不到时下面的渲染函数会退化成内联的极简版本，
${INDENT}// 宁可难看也不能白屏 —— 插件的加载时机不完全由我们控制。
${INDENT}const LP = (typeof window !== 'undefined' && window.__listenPresets) || null;

${INDENT}/** XSS 防线。用户输入 / 数据库字段拼进 HTML 前必须过这一层。 */
${INDENT}function esc(value) {
${INDENT}${INDENT}return String(value ?? '').replace(/[&<>"']/g, function (c) {
${INDENT}${INDENT}${INDENT}return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
${INDENT}${INDENT}});
${INDENT}}

${INDENT}/** 拼 data-app-action 属性串。★ 返回的已经是完整属性，模板里直接展开，别再套一层引号。 */
${INDENT}function act(method, payload) {
${INDENT}${INDENT}const obj = { action: 'appMethod', appId: APP_ID, method: method, payload: payload || {} };
${INDENT}${INDENT}return " data-app-action='" + esc(JSON.stringify(obj)) + "'";
${INDENT}}
`;
}

function buildTheme(bp) {
    const s = bp.style;
    return `${INDENT}// ── 主题 ────────────────────────────────────────────────────
${INDENT}// 颜色集中在这一处，改皮肤只动这个对象。
${INDENT}const THEME = {
${INDENT}${INDENT}bg: ${q(s.bg)},
${INDENT}${INDENT}surface: ${q(s.card)},
${INDENT}${INDENT}primary: ${q(s.primary)},
${INDENT}${INDENT}text: ${q(s.text)},
${INDENT}${INDENT}radius: ${q(bp.radius)},
${INDENT}${INDENT}elevation: ${q(bp.elevation)},
${INDENT}${INDENT}padding: ${bp.padding},
${INDENT}${INDENT}gap: ${bp.gap},
${INDENT}};

${INDENT}/** 把主题变量灌到 app-shell 上，预设组件的 --lp-* 会读它们 */
${INDENT}const THEME_STYLE = 'background:' + THEME.bg + ';'
${INDENT}${INDENT}+ '--lp-accent:' + THEME.primary + ';'
${INDENT}${INDENT}+ '--lp-surface:' + THEME.surface + ';'
${INDENT}${INDENT}+ '--lp-text:' + THEME.text + ';';
`;
}

/** 每个页面的占位数据：卡片数量、假标题。做成常量而不是随机，重画时内容不跳。 */
function buildSampleData(bp) {
    const rows = bp.pages.map((page) => {
        const items = Array.from({ length: sampleCount(page) }, (_, i) => (
            `{ id: ${q(`${page.id}-${i + 1}`)}, title: ${q(`${page.name}条目 ${i + 1}`)}, subtitle: ${q(sampleSubtitle(page, i))}, value: ${(i + 1) * 7}, time: ${q(`0${(i % 9) + 1}:${String((i * 13) % 60).padStart(2, '0')}`)} }`
        ));
        return `${INDENT}${INDENT}${q(page.id)}: [\n${items.map((s) => `${INDENT}${INDENT}${INDENT}${s},`).join('\n')}\n${INDENT}${INDENT}],`;
    });
    return `${INDENT}// ── 占位数据 ────────────────────────────────────────────────
${INDENT}// 白膜阶段用它撑起页面形状。接真数据时把 sampleOf() 换成 state / db 读取即可。
${INDENT}const SAMPLE = {
${rows.join('\n')}
${INDENT}};

${INDENT}function sampleOf(pageId) {
${INDENT}${INDENT}return SAMPLE[pageId] || [];
${INDENT}}
`;
}

function sampleCount(page) {
    if (page.layout === 'grid' || page.layout === 'twoColumn') return 6;
    if (page.layout === 'masonry') return 6;
    if (page.layout === 'carousel') return 4;
    return 4;
}

function sampleSubtitle(page, i) {
    const pool = ['刚刚更新', '来自占位数据', '点开看详情', '这一行是副标题'];
    return pool[i % pool.length];
}

// ---------------------------------------------------------------------------
// 卡片渲染
// ---------------------------------------------------------------------------

function buildCardRenderer(bp) {
    // 只为用到的卡片类型生成分支，避免生成一大段用不上的代码
    const used = new Set();
    bp.pages.forEach((p) => p.cards.forEach((c) => used.add(c.value)));

    const branches = [];
    const has = (t) => used.has(t);

    if (has('info')) {
        branches.push(`${INDENT}${INDENT}if (kind === 'info') {
${INDENT}${INDENT}${INDENT}return LP.cards.info({
${INDENT}${INDENT}${INDENT}${INDENT}title: item.title,
${INDENT}${INDENT}${INDENT}${INDENT}subtitle: showField('subtitle') ? item.subtitle : '',
${INDENT}${INDENT}${INDENT}${INDENT}body: showField('body') ? '这里是正文摘要，接真数据后换成条目的实际内容。' : '',
${INDENT}${INDENT}${INDENT}${INDENT}icon: showField('icon') ? DOT_ICON : '',
${INDENT}${INDENT}${INDENT}${INDENT}badge: showField('badge') ? 'NEW' : '',
${INDENT}${INDENT}${INDENT}${INDENT}padding: page.padding, radius: THEME.radius, elevation: THEME.elevation,
${INDENT}${INDENT}${INDENT}${INDENT}action: { action: 'appMethod', method: 'openItem', payload: { id: item.id, page: page.id } },
${INDENT}${INDENT}${INDENT}${INDENT}appId: APP_ID,
${INDENT}${INDENT}${INDENT}});
${INDENT}${INDENT}}`);
    }
    if (has('row')) {
        branches.push(`${INDENT}${INDENT}if (kind === 'row') {
${INDENT}${INDENT}${INDENT}return LP.cards.row({
${INDENT}${INDENT}${INDENT}${INDENT}title: item.title,
${INDENT}${INDENT}${INDENT}${INDENT}subtitle: showField('subtitle') ? item.subtitle : '',
${INDENT}${INDENT}${INDENT}${INDENT}leading: showField('icon') ? DOT_ICON : '',
${INDENT}${INDENT}${INDENT}${INDENT}trailing: showField('time') ? item.time : (showField('number') ? String(item.value) : ''),
${INDENT}${INDENT}${INDENT}${INDENT}chevron: showField('chevron'),
${INDENT}${INDENT}${INDENT}${INDENT}padding: page.padding, radius: THEME.radius, elevation: THEME.elevation,
${INDENT}${INDENT}${INDENT}${INDENT}action: { action: 'appMethod', method: 'openItem', payload: { id: item.id, page: page.id } },
${INDENT}${INDENT}${INDENT}${INDENT}appId: APP_ID,
${INDENT}${INDENT}${INDENT}});
${INDENT}${INDENT}}`);
    }
    if (has('stat')) {
        branches.push(`${INDENT}${INDENT}if (kind === 'stat') {
${INDENT}${INDENT}${INDENT}return LP.cards.stat({
${INDENT}${INDENT}${INDENT}${INDENT}label: item.title, value: item.value, unit: '项',
${INDENT}${INDENT}${INDENT}${INDENT}hint: showField('subtitle') ? item.subtitle : '',
${INDENT}${INDENT}${INDENT}${INDENT}padding: page.padding, radius: THEME.radius, elevation: THEME.elevation,
${INDENT}${INDENT}${INDENT}});
${INDENT}${INDENT}}`);
    }
    if (has('media')) {
        branches.push(`${INDENT}${INDENT}if (kind === 'media') {
${INDENT}${INDENT}${INDENT}return LP.cards.media({
${INDENT}${INDENT}${INDENT}${INDENT}title: item.title,
${INDENT}${INDENT}${INDENT}${INDENT}subtitle: showField('subtitle') ? item.subtitle : '',
${INDENT}${INDENT}${INDENT}${INDENT}badge: showField('badge') ? '占位' : '',
${INDENT}${INDENT}${INDENT}${INDENT}radius: THEME.radius, elevation: THEME.elevation,
${INDENT}${INDENT}${INDENT}${INDENT}action: { action: 'appMethod', method: 'openItem', payload: { id: item.id, page: page.id } },
${INDENT}${INDENT}${INDENT}${INDENT}appId: APP_ID,
${INDENT}${INDENT}${INDENT}});
${INDENT}${INDENT}}`);
    }
    if (has('progress')) {
        branches.push(`${INDENT}${INDENT}if (kind === 'progress') {
${INDENT}${INDENT}${INDENT}return LP.cards.progress({
${INDENT}${INDENT}${INDENT}${INDENT}title: item.title, value: item.value, max: 100,
${INDENT}${INDENT}${INDENT}${INDENT}hint: showField('subtitle') ? item.subtitle : '',
${INDENT}${INDENT}${INDENT}${INDENT}padding: page.padding, radius: THEME.radius, elevation: THEME.elevation,
${INDENT}${INDENT}${INDENT}});
${INDENT}${INDENT}}`);
    }
    if (has('profile')) {
        branches.push(`${INDENT}${INDENT}if (kind === 'profile') {
${INDENT}${INDENT}${INDENT}return LP.cards.profile({
${INDENT}${INDENT}${INDENT}${INDENT}name: item.title, desc: item.subtitle, avatar: '',
${INDENT}${INDENT}${INDENT}${INDENT}actionLabel: showField('actions') ? '查看' : '',
${INDENT}${INDENT}${INDENT}${INDENT}action: { action: 'appMethod', method: 'openItem', payload: { id: item.id, page: page.id } },
${INDENT}${INDENT}${INDENT}${INDENT}appId: APP_ID,
${INDENT}${INDENT}${INDENT}${INDENT}padding: page.padding, radius: THEME.radius, elevation: THEME.elevation,
${INDENT}${INDENT}${INDENT}});
${INDENT}${INDENT}}`);
    }
    if (has('timeline')) {
        branches.push(`${INDENT}${INDENT}if (kind === 'timeline') {
${INDENT}${INDENT}${INDENT}return LP.cards.timeline(items.map(function (it) {
${INDENT}${INDENT}${INDENT}${INDENT}return { title: it.title, time: it.time, desc: it.subtitle };
${INDENT}${INDENT}${INDENT}}), { padding: page.padding, radius: THEME.radius, elevation: THEME.elevation });
${INDENT}${INDENT}}`);
    }
    if (has('keyValue')) {
        branches.push(`${INDENT}${INDENT}if (kind === 'keyValue') {
${INDENT}${INDENT}${INDENT}return LP.cards.keyValue(items.map(function (it) {
${INDENT}${INDENT}${INDENT}${INDENT}return { key: it.title, value: it.subtitle };
${INDENT}${INDENT}${INDENT}}), { padding: page.padding, radius: THEME.radius, elevation: THEME.elevation });
${INDENT}${INDENT}}`);
    }
    if (has('bars')) {
        branches.push(`${INDENT}${INDENT}if (kind === 'bars') {
${INDENT}${INDENT}${INDENT}return LP.cards.bars({
${INDENT}${INDENT}${INDENT}${INDENT}title: page.name + ' 趋势',
${INDENT}${INDENT}${INDENT}${INDENT}items: items.map(function (it) { return { label: it.time, value: it.value }; }),
${INDENT}${INDENT}${INDENT}${INDENT}padding: page.padding, radius: THEME.radius, elevation: THEME.elevation,
${INDENT}${INDENT}${INDENT}});
${INDENT}${INDENT}}`);
    }
    if (has('banner')) {
        branches.push(`${INDENT}${INDENT}if (kind === 'banner') {
${INDENT}${INDENT}${INDENT}return LP.cards.banner({
${INDENT}${INDENT}${INDENT}${INDENT}title: page.name, desc: page.desc || '这里放一句引导文案',
${INDENT}${INDENT}${INDENT}${INDENT}ctaLabel: '开始',
${INDENT}${INDENT}${INDENT}${INDENT}action: { action: 'appMethod', method: 'primaryAction', payload: { page: page.id } },
${INDENT}${INDENT}${INDENT}${INDENT}appId: APP_ID,
${INDENT}${INDENT}${INDENT}${INDENT}padding: page.padding, radius: THEME.radius, elevation: THEME.elevation,
${INDENT}${INDENT}${INDENT}});
${INDENT}${INDENT}}`);
    }
    if (has('tags')) {
        branches.push(`${INDENT}${INDENT}if (kind === 'tags') {
${INDENT}${INDENT}${INDENT}return LP.cards.tags(items.map(function (it, i) {
${INDENT}${INDENT}${INDENT}${INDENT}return { label: it.title, active: i === 0 };
${INDENT}${INDENT}${INDENT}}), { appId: APP_ID });
${INDENT}${INDENT}}`);
    }

    // 「一张卡渲染多条」的类型：整组一次画完，不要每条都画一个
    const groupKinds = ['timeline', 'keyValue', 'bars', 'tags'].filter(has);

    return `${INDENT}// ── 卡片 ────────────────────────────────────────────────────
${INDENT}const DOT_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8" /></svg>';

${INDENT}/** 这几种卡片是「一张卡画一整组数据」，不是「一条数据一张卡」 */
${INDENT}const GROUP_CARDS = ${JSON.stringify(groupKinds)};

${INDENT}function renderCard(kind, item, items, page) {
${INDENT}${INDENT}function showField(name) { return page.cardFields.indexOf(name) >= 0; }
${INDENT}${INDENT}if (!LP) return fallbackCard(item, page);
${branches.length ? branches.join('\n') : `${INDENT}${INDENT}// 没有勾任何卡片类型，用兜底`}
${INDENT}${INDENT}return fallbackCard(item, page);
${INDENT}}

${INDENT}/** 预设库不可用时的兜底：难看，但至少页面不是白的 */
${INDENT}function fallbackCard(item, page) {
${INDENT}${INDENT}return '<div style="padding:' + page.padding + 'px;margin-bottom:' + page.gap + 'px;'
${INDENT}${INDENT}${INDENT}+ 'background:' + THEME.surface + ';border-radius:14px;">'
${INDENT}${INDENT}${INDENT}+ '<div style="font-weight:600;">' + esc(item.title) + '</div>'
${INDENT}${INDENT}${INDENT}+ '<div style="font-size:12px;opacity:.6;margin-top:2px;">' + esc(item.subtitle) + '</div>'
${INDENT}${INDENT}${INDENT}+ '</div>';
${INDENT}}
`;
}

// ---------------------------------------------------------------------------
// 页面渲染
// ---------------------------------------------------------------------------

function buildPageRenderer(bp) {
    const searchBar = bp.needsSearch
        ? `${INDENT}${INDENT}if (page.hasSearch && LP) {\n${INDENT}${INDENT}${INDENT}blocks.push(LP.cards.searchBar({ placeholder: '搜索' + page.name, field: 'keyword' }));\n${INDENT}${INDENT}}\n`
        : '';

    const fab = bp.fab.visible
        ? `${INDENT}${INDENT}// 浮动主按钮：绝对定位在 shell 上，CSS 里已经加了 --app-safe-bottom，不会压住指示条\n`
          + `${INDENT}${INDENT}const fabHtml = LP ? LP.cards.fab({\n`
          + `${INDENT}${INDENT}${INDENT}icon: '+', label: ${q(bp.fab.label)}, position: ${q(bp.fab.position)},\n`
          + `${INDENT}${INDENT}${INDENT}action: { action: 'appMethod', method: 'primaryAction', payload: { page: page.id } },\n`
          + `${INDENT}${INDENT}${INDENT}appId: APP_ID,\n`
          + `${INDENT}${INDENT}}) : '';\n`
        : `${INDENT}${INDENT}const fabHtml = '';\n`;

    return `${INDENT}// ── 页面 ────────────────────────────────────────────────────
${INDENT}// ★ 这些都是模块级的独立函数，不是 appConfig 上的方法 ——
${INDENT}//   renderPage 被框架当独立函数调用，里面拿不到 this。
${INDENT}function renderPageBody(page, app) {
${INDENT}${INDENT}const items = sampleOf(page.id);
${INDENT}${INDENT}const blocks = [];

${searchBar}${INDENT}${INDENT}if (page.desc && LP) {
${INDENT}${INDENT}${INDENT}blocks.push(LP.cards.sectionHeader({ title: page.name, subtitle: page.desc }));
${INDENT}${INDENT}}

${INDENT}${INDENT}if (!items.length) {
${INDENT}${INDENT}${INDENT}blocks.push(LP
${INDENT}${INDENT}${INDENT}${INDENT}? LP.cards.empty({ title: page.emptyText, desc: '接上真数据后这里会显示内容', ctaLabel: '新建一条', action: { action: 'appMethod', method: 'primaryAction', payload: { page: page.id } }, appId: APP_ID })
${INDENT}${INDENT}${INDENT}${INDENT}: '<div style="padding:32px;text-align:center;opacity:.5;">' + esc(page.emptyText) + '</div>');
${INDENT}${INDENT}} else {
${INDENT}${INDENT}${INDENT}page.cards.forEach(function (kind) {
${INDENT}${INDENT}${INDENT}${INDENT}if (GROUP_CARDS.indexOf(kind) >= 0) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}blocks.push(renderCard(kind, items[0], items, page));
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return;
${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}${INDENT}items.forEach(function (item) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}blocks.push(renderCard(kind, item, items, page));
${INDENT}${INDENT}${INDENT}${INDENT}});
${INDENT}${INDENT}${INDENT}});
${INDENT}${INDENT}}

${INDENT}${INDENT}// 子页面入口。没有入口的子页面等于不存在 —— 白膜阶段最容易漏这一步。
${INDENT}${INDENT}if (page.subpages.length && LP) {
${INDENT}${INDENT}${INDENT}blocks.push(LP.cards.sectionHeader({ title: '子页面', subtitle: '这一页能进到哪儿' }));
${INDENT}${INDENT}${INDENT}page.subpages.forEach(function (sp) {
${INDENT}${INDENT}${INDENT}${INDENT}blocks.push(LP.cards.row({
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}title: sp.title, subtitle: sp.desc, chevron: true,
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}padding: 'snug', radius: THEME.radius, elevation: THEME.elevation,
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}action: { action: 'openDetail', pageId: sp.id },
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}appId: APP_ID,
${INDENT}${INDENT}${INDENT}${INDENT}}));
${INDENT}${INDENT}${INDENT}});
${INDENT}${INDENT}}

${fab}
${INDENT}${INDENT}const body = LP ? layoutFor(page, blocks) : blocks.join('');
${INDENT}${INDENT}return LP
${INDENT}${INDENT}${INDENT}? LP.layouts.page(body, { padding: page.padding, gap: page.gap }) + fabHtml
${INDENT}${INDENT}${INDENT}: '<div style="padding:' + page.padding + 'px;">' + body + '</div>' + fabHtml;
${INDENT}}

${INDENT}/** 布局：问卷里「这一页是一列还是两列还是瀑布流」那道题的落点 */
${INDENT}function layoutFor(page, blocks) {
${INDENT}${INDENT}const opts = { gap: page.gap };
${INDENT}${INDENT}switch (page.layout) {
${INDENT}${INDENT}${INDENT}case 'twoColumn': return LP.layouts.twoColumn(blocks, opts);
${INDENT}${INDENT}${INDENT}case 'grid': return LP.layouts.grid(blocks, { gap: page.gap, minItemWidth: '140px' });
${INDENT}${INDENT}${INDENT}case 'masonry': return LP.layouts.masonry(blocks, { cols: 2, gap: page.gap });
${INDENT}${INDENT}${INDENT}case 'carousel': return LP.layouts.carousel(blocks, { gap: page.gap, itemWidth: '72%' });
${INDENT}${INDENT}${INDENT}case 'groupedList': return LP.layouts.groupedList([{ title: page.name, items: blocks }], opts);
${INDENT}${INDENT}${INDENT}case 'split': return LP.layouts.split(LP.cards.tags(['全部', '最近'], {}), LP.layouts.column(blocks, opts), opts);
${INDENT}${INDENT}${INDENT}default: return LP.layouts.column(blocks, opts);
${INDENT}${INDENT}}
${INDENT}}

${INDENT}/** 子页面（详情 / 编辑 / 设置…）。白膜阶段每一种给一个能看出形状的骨架。 */
${INDENT}function renderSubpage(sp, app) {
${INDENT}${INDENT}if (!LP) return '<div style="padding:20px;">' + esc(sp.title) + '</div>';
${INDENT}${INDENT}const blocks = [
${INDENT}${INDENT}${INDENT}LP.cards.sectionHeader({ title: sp.title, subtitle: sp.desc }),
${INDENT}${INDENT}];
${INDENT}${INDENT}if (sp.kind === 'edit') {
${INDENT}${INDENT}${INDENT}blocks.push(LP.cards.info({ title: '表单区', body: '这里放输入框。真做的时候用 LP.modals.form 或者页面内的原生 input。', padding: THEME.padding, radius: THEME.radius }));
${INDENT}${INDENT}${INDENT}blocks.push(LP.cards.button({ label: '保存', variant: 'primary', block: true, action: { action: 'appMethod', method: 'demoSave' }, appId: APP_ID }));
${INDENT}${INDENT}} else if (sp.kind === 'settings') {
${INDENT}${INDENT}${INDENT}blocks.push(LP.layouts.groupedList([{ title: '偏好', items: [
${INDENT}${INDENT}${INDENT}${INDENT}LP.cards.row({ title: '选项一', trailing: '开', chevron: true, padding: 'snug' }),
${INDENT}${INDENT}${INDENT}${INDENT}LP.cards.row({ title: '选项二', trailing: '关', chevron: true, padding: 'snug' }),
${INDENT}${INDENT}${INDENT}] }]));
${INDENT}${INDENT}} else if (sp.kind === 'search') {
${INDENT}${INDENT}${INDENT}blocks.push(LP.cards.searchBar({ placeholder: '输入关键词' }));
${INDENT}${INDENT}${INDENT}blocks.push(LP.cards.empty({ title: '输入点什么', desc: '搜索结果会显示在这里' }));
${INDENT}${INDENT}} else {
${INDENT}${INDENT}${INDENT}blocks.push(LP.cards.keyValue([
${INDENT}${INDENT}${INDENT}${INDENT}{ key: '字段一', value: '占位值' },
${INDENT}${INDENT}${INDENT}${INDENT}{ key: '字段二', value: '占位值' },
${INDENT}${INDENT}${INDENT}${INDENT}{ key: '更新时间', value: '刚刚' },
${INDENT}${INDENT}${INDENT}], { padding: THEME.padding, radius: THEME.radius }));
${INDENT}${INDENT}}
${INDENT}${INDENT}return LP.layouts.page(LP.layouts.column(blocks, { gap: THEME.gap }), { padding: THEME.padding });
${INDENT}}
`;
}

// ---------------------------------------------------------------------------
// appConfig 各字段
// ---------------------------------------------------------------------------

function buildPagesConst(bp) {
    const pages = bp.pages.map((p) => `${INDENT}${INDENT}{
${INDENT}${INDENT}${INDENT}id: ${q(p.id)},
${INDENT}${INDENT}${INDENT}name: ${q(p.name)},
${INDENT}${INDENT}${INDENT}desc: ${q(p.desc)},
${INDENT}${INDENT}${INDENT}glyph: ${q(p.glyph)},
${INDENT}${INDENT}${INDENT}layout: ${q(p.layout)},
${INDENT}${INDENT}${INDENT}padding: ${p.padding},
${INDENT}${INDENT}${INDENT}gap: ${p.gap},
${INDENT}${INDENT}${INDENT}cards: ${JSON.stringify(p.cards.map((c) => c.value))},
${INDENT}${INDENT}${INDENT}cardFields: ${JSON.stringify(p.cardFields)},
${INDENT}${INDENT}${INDENT}hasSearch: ${p.hasSearch},
${INDENT}${INDENT}${INDENT}emptyText: ${q(p.emptyText)},
${INDENT}${INDENT}${INDENT}subpages: [${p.subpages.map((sp) => `{ id: ${q(sp.id)}, kind: ${q(sp.value)}, title: ${q(sp.title)}, desc: ${q(sp.desc)} }`).join(', ')}],
${INDENT}${INDENT}},`).join('\n');

    return `${INDENT}// ── 页面表 ──────────────────────────────────────────────────
${INDENT}const PAGE_DEFS = [
${pages}
${INDENT}];

${INDENT}const ALL_SUBPAGES = PAGE_DEFS.reduce(function (acc, p) { return acc.concat(p.subpages); }, []);

${INDENT}function findPage(pageId) {
${INDENT}${INDENT}for (let i = 0; i < PAGE_DEFS.length; i += 1) if (PAGE_DEFS[i].id === pageId) return PAGE_DEFS[i];
${INDENT}${INDENT}return PAGE_DEFS[0];
${INDENT}}
`;
}

function buildTopbarConfig(bp) {
    const t = bp.topbar;
    if (!t.visible) return `${INDENT}${INDENT}topbar: { visible: false },`;

    // ★ 框架渲染顶栏按钮用的是 `v-html="act.iconHtml"` —— 只给 label 的话
    //   按钮会是一个空的灰色圆点。必须给 iconHtml。
    // buttons-only 额外给 label：框架会把它画在图标下面，整条顶栏就是一排功能键。
    const withLabel = t.type === 'buttons-only' && t.buttonLabels;
    const right = t.right.length
        ? `\n${INDENT}${INDENT}${INDENT}headerActions: [\n${t.right.map((r) => `${INDENT}${INDENT}${INDENT}${INDENT}{ id: ${q(r)},${withLabel ? ` label: ${q(rightLabel(r))},` : ''} ariaLabel: ${q(rightLabel(r))}, iconHtml: ${q(rightIcon(r))}, action: { action: 'appMethod', appId: APP_ID, method: 'topbarAction', payload: { id: ${q(r)} } } },`).join('\n')}\n${INDENT}${INDENT}${INDENT}],`
        : '';

    let typeLine = '';
    if (t.type === 'search') {
        typeLine = `\n${INDENT}${INDENT}${INDENT}type: 'search',\n${INDENT}${INDENT}${INDENT}placeholder: '搜索',`;
    } else if (t.type === 'large-title') {
        typeLine = `\n${INDENT}${INDENT}${INDENT}largeTitle: true,`;
    } else if (t.type === 'buttons-only') {
        // showPill: false 是这个类型的关键 —— 不关的话中间还会顶出一颗 App 名胶囊，
        // 按钮被挤到右边，就不叫「纯按钮组」了。
        typeLine = `\n${INDENT}${INDENT}${INDENT}type: 'buttons-only',\n${INDENT}${INDENT}${INDENT}showPill: false,`;
    }

    return `${INDENT}${INDENT}// 顶栏：${t.title}
${INDENT}${INDENT}// ★ bg 留 transparent —— 设成实色会触发状态栏与 nav bar 的视觉断层（框架已知问题）。
${INDENT}${INDENT}// ★ color 必须显式给：框架默认用深色文字，深色主题下标题会是黑字压在黑底上，
${INDENT}${INDENT}//   看上去就像"标题没渲染出来"。
${INDENT}${INDENT}topbar: {
${INDENT}${INDENT}${INDENT}visible: true,
${INDENT}${INDENT}${INDENT}title: ${q(bp.appName)},${bp.tagline ? `\n${INDENT}${INDENT}${INDENT}subtitle: ${q(bp.tagline)},` : ''}${typeLine}${right}
${INDENT}${INDENT}${INDENT}bg: 'transparent',
${INDENT}${INDENT}${INDENT}color: THEME.text,
${INDENT}${INDENT}},`;
}

function rightLabel(id) {
    return {
        search: '搜索', add: '新建', more: '更多', filter: '筛选', settings: '设置', done: '完成',
        sort: '排序', star: '收藏', refresh: '刷新', export: '导出',
    }[id] || id;
}

/** 顶栏按钮图标。用 currentColor 描边，跟着 topbar.color 走。 */
function rightIcon(id) {
    const wrap = (inner) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
    switch (id) {
        case 'search': return wrap('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>');
        case 'add': return wrap('<path d="M12 5v14M5 12h14"/>');
        case 'more': return wrap('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>');
        case 'filter': return wrap('<path d="M3 5h18l-7 8v6l-4 2v-8z"/>');
        case 'settings': return wrap('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 008.9 19a1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 8.4a1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>');
        case 'done': return wrap('<path d="M20 6L9 17l-5-5"/>');
        case 'sort': return wrap('<path d="M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 20l-3-3"/>');
        case 'star': return wrap('<path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z"/>');
        case 'refresh': return wrap('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>');
        case 'export': return wrap('<path d="M12 16V4M12 4L7 9M12 4l5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>');
        default: return wrap('<circle cx="12" cy="12" r="8"/>');
    }
}

function buildNavConfig(bp) {
    if (!bp.tabbar.visible) return `${INDENT}${INDENT}nav: { type: 'none' },`;
    const preset = bp.tabbar.type === 'default' ? 'default' : bp.tabbar.type;
    // 框架 tab 栏的默认底色是半透明白。深色主题下那层白会变成一块灰疙瘩，
    // 所以按主题深浅各给一套。
    const bg = bp.style.dark ? "'rgba(20, 22, 32, 0.62)'" : "'rgba(255, 255, 255, 0.5)'";
    return `${INDENT}${INDENT}// 底栏：${bp.tabbar.title}
${INDENT}${INDENT}nav: {
${INDENT}${INDENT}${INDENT}type: 'tab',
${INDENT}${INDENT}${INDENT}preset: ${q(preset)},
${INDENT}${INDENT}${INDENT}showLabels: ${bp.tabbar.showLabels},
${INDENT}${INDENT}${INDENT}bg: ${bg},
${INDENT}${INDENT}${INDENT}color: THEME.text,
${INDENT}${INDENT}${INDENT}activeColor: THEME.primary,
${INDENT}${INDENT}},`;
}

function buildStores(bp) {
    if (!bp.stores.length) return '';
    const rows = bp.stores.map((s) => `${INDENT}${INDENT}${INDENT}{ name: ${q(s.name)}, keyPath: ${q(s.keyPath)} }, // ${s.desc}`).join('\n');
    return `${INDENT}${INDENT}// ★ 声明了 stores 就必须走 registerPhoneAppAsync。
${INDENT}${INDENT}//   同步注册不会建表，首次写入会静默失败（表现是「保存成功但刷新就没了」）。
${INDENT}${INDENT}//   从 nook 上传安装时，安装器已经自动帮你走异步路径。
${INDENT}${INDENT}stores: [
${rows}
${INDENT}${INDENT}],
`;
}

function buildIslandKinds(bp) {
    if (!bp.islands.length) return '';
    const rows = bp.islands.map((i) => `${INDENT}${INDENT}${INDENT}{
${INDENT}${INDENT}${INDENT}${INDENT}id: ${q(i.kindId)},
${INDENT}${INDENT}${INDENT}${INDENT}label: ${q(i.title)},
${INDENT}${INDENT}${INDENT}${INDENT}desc: ${q(i.desc)},
${INDENT}${INDENT}${INDENT}${INDENT}when: ${q(islandWhen(i))},
${INDENT}${INDENT}${INDENT}${INDENT}sizes: ${JSON.stringify(i.sustained ? ['mini', 'medium'] : ['medium'])},
${INDENT}${INDENT}${INDENT}${INDENT}previewPayload: { title: ${q(i.title)}, message: ${q(bp.appName)} },
${INDENT}${INDENT}${INDENT}},`).join('\n');

    return `${INDENT}${INDENT}// ★ 声明灵动岛形态。不声明也能弹，但用户在「灵动岛与小组件」里
${INDENT}${INDENT}//   既预览不到、也关不掉它。
${INDENT}${INDENT}islandKinds: [
${rows}
${INDENT}${INDENT}],
`;
}

function islandWhen(i) {
    return {
        toast: '保存 / 删除 / 操作失败时',
        message: '收到新消息或通知时',
        progress: '导出、上传这类要等一会儿的任务进行中',
        timer: '计时 / 录音进行中',
        status: '连接或同步状态变化时',
        nowPlaying: '正在播放内容时',
    }[i.value] || '待补充';
}

function buildWidgets(bp) {
    if (!bp.widgets.length) return '';
    const rows = bp.widgets.map((w) => `${INDENT}${INDENT}${INDENT}{
${INDENT}${INDENT}${INDENT}${INDENT}id: ${q(w.widgetId)},
${INDENT}${INDENT}${INDENT}${INDENT}label: ${q(`${bp.appName}·${w.title}`)},
${INDENT}${INDENT}${INDENT}${INDENT}icon: APP_ICON,
${INDENT}${INDENT}${INDENT}${INDENT}iconBg: ${q(bp.style.iconBg)},
${INDENT}${INDENT}${INDENT}${INDENT}size: ${q(w.size)},
${INDENT}${INDENT}${INDENT}${INDENT}render: function (size, payload) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}// 预设自带占位数据，接真数据时把 payload 换成实际值
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}const preset = LP && LP.widgets.WIDGET_PRESETS[${q(w.value)}];
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}if (!preset) return '<div style="padding:12px;font-size:12px;">' + esc(${q(w.title)}) + '</div>';
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return preset.render(size, (payload && Object.keys(payload).length) ? payload : preset.previewPayload);
${INDENT}${INDENT}${INDENT}${INDENT}},
${INDENT}${INDENT}${INDENT}${INDENT}onTap: function (instanceId, qualifiedId, ctx) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}if (ctx && ctx.toolkit && ctx.toolkit.app && ctx.toolkit.app.methods.onWidgetTap) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return ctx.toolkit.app.methods.onWidgetTap();
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return false;
${INDENT}${INDENT}${INDENT}${INDENT}},
${INDENT}${INDENT}${INDENT}},`).join('\n');

    return `${INDENT}${INDENT}// 桌面小组件。长按桌面 → 添加小组件里能找到它们。
${INDENT}${INDENT}widgets: [
${rows}
${INDENT}${INDENT}],
`;
}

function buildSocialProfile(bp) {
    if (!bp.crossSet.has('socialProfile')) return '';
    return `${INDENT}${INDENT}// 声明为社交 App：nook 的人设编辑器里会自动多出一张「社媒形象」卡，
${INDENT}${INDENT}// 数据存在 persona.socialProfiles['${bp.appId}']。
${INDENT}${INDENT}socialProfile: {
${INDENT}${INDENT}${INDENT}label: ${q(bp.appName)},
${INDENT}${INDENT}${INDENT}desc: ${q(bp.tagline || bp.appDesc || '在这里的形象')},
${INDENT}${INDENT}${INDENT}order: 50,
${INDENT}${INDENT}${INDENT}fields: ['nickname', 'avatar', 'background'],
${INDENT}${INDENT}},
`;
}

function buildDistribution(bp) {
    const requires = bp.crossSet.has('appStore');
    return `${INDENT}${INDENT}distribution: {
${INDENT}${INDENT}${INDENT}// ${requires ? 'true = 要先去 App Store 装一次才会出现在桌面' : 'false = 系统级，注册完直接在桌面上'}
${INDENT}${INDENT}${INDENT}requiresInstall: ${requires},
${INDENT}${INDENT}${INDENT}installed: true,
${requires ? `${INDENT}${INDENT}${INDENT}appStore: {
${INDENT}${INDENT}${INDENT}${INDENT}subtitle: ${q(bp.tagline || bp.appDesc || bp.appName)},
${INDENT}${INDENT}${INDENT}${INDENT}category: '效率',
${INDENT}${INDENT}${INDENT}${INDENT}version: '1.0.0',
${INDENT}${INDENT}${INDENT}${INDENT}whatsNew: '白膜首版。',
${INDENT}${INDENT}${INDENT}${INDENT}description: ${q(bp.appDesc || bp.appName)},
${INDENT}${INDENT}${INDENT}${INDENT}accent: ${q(bp.style.iconBg)},
${INDENT}${INDENT}${INDENT}},
` : ''}${INDENT}${INDENT}},
`;
}

// ---------------------------------------------------------------------------
// methods
// ---------------------------------------------------------------------------

function buildMethods(bp) {
    const parts = [];

    parts.push(`${INDENT}${INDENT}${INDENT}/** 打开一条内容。白膜阶段只弹个提示，接真数据后改成跳详情页。 */
${INDENT}${INDENT}${INDENT}openItem(payload) {
${INDENT}${INDENT}${INDENT}${INDENT}const page = findPage(payload && payload.page);
${INDENT}${INDENT}${INDENT}${INDENT}const detail = page.subpages.filter(function (s) { return s.kind === 'detail'; })[0];
${INDENT}${INDENT}${INDENT}${INDENT}if (detail) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}window.dispatchEvent(new CustomEvent('app:page-action', {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}detail: { action: 'openDetail', appId: APP_ID, pageId: detail.id },
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}}));
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return;
${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}${INDENT}this.toolkit.island.notify('info', ${q(bp.appName)}, '点开了一条内容');
${INDENT}${INDENT}${INDENT}},`);

    // 主按钮：优先用用户选的弹窗，选了什么就演示什么
    const primaryModal = bp.modals.find((m) => ['form', 'prompt', 'sheet', 'actionSheet'].includes(m.value));
    if (primaryModal && primaryModal.value === 'form') {
        parts.push(`${INDENT}${INDENT}${INDENT}/** 主按钮：弹表单。这是「新建一条」最常见的形态。 */
${INDENT}${INDENT}${INDENT}async primaryAction() {
${INDENT}${INDENT}${INDENT}${INDENT}if (!LP) return;
${INDENT}${INDENT}${INDENT}${INDENT}const data = await LP.modals.form({
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}title: '新建',
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}fields: [
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}{ name: 'title', label: '标题', placeholder: '起个名字' },
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}{ name: 'note', label: '备注', type: 'textarea', placeholder: '可以不填' },
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}],
${INDENT}${INDENT}${INDENT}${INDENT}});
${INDENT}${INDENT}${INDENT}${INDENT}if (!data) return;
${INDENT}${INDENT}${INDENT}${INDENT}${bp.needsDb ? 'await this.methods.saveItem(data);' : "LP.modals.toast('拿到了：' + (data.title || '(空)'), { type: 'success' });"}
${INDENT}${INDENT}${INDENT}},`);
    } else if (primaryModal && primaryModal.value === 'prompt') {
        parts.push(`${INDENT}${INDENT}${INDENT}async primaryAction() {
${INDENT}${INDENT}${INDENT}${INDENT}if (!LP) return;
${INDENT}${INDENT}${INDENT}${INDENT}const text = await LP.modals.prompt({ title: '新建', placeholder: '输入内容' });
${INDENT}${INDENT}${INDENT}${INDENT}if (text == null) return;
${INDENT}${INDENT}${INDENT}${INDENT}${bp.needsDb ? 'await this.methods.saveItem({ title: text });' : "LP.modals.toast('拿到了：' + text, { type: 'success' });"}
${INDENT}${INDENT}${INDENT}},`);
    } else if (primaryModal && primaryModal.value === 'actionSheet') {
        parts.push(`${INDENT}${INDENT}${INDENT}async primaryAction() {
${INDENT}${INDENT}${INDENT}${INDENT}if (!LP) return;
${INDENT}${INDENT}${INDENT}${INDENT}const choice = await LP.modals.actionSheet({
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}title: '要做什么',
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}items: [
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}{ value: 'new', label: '新建一条' },
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}{ value: 'import', label: '从别处导入' },
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}],
${INDENT}${INDENT}${INDENT}${INDENT}});
${INDENT}${INDENT}${INDENT}${INDENT}if (choice) LP.modals.toast('选了：' + choice);
${INDENT}${INDENT}${INDENT}},`);
    } else {
        parts.push(`${INDENT}${INDENT}${INDENT}primaryAction() {
${INDENT}${INDENT}${INDENT}${INDENT}this.toolkit.island.notify('success', ${q(bp.appName)}, '主按钮被点了');
${INDENT}${INDENT}${INDENT}},`);
    }

    if (bp.topbar.right.length) {
        parts.push(`${INDENT}${INDENT}${INDENT}/** 顶栏右侧按钮统一入口，按 id 分派 */
${INDENT}${INDENT}${INDENT}topbarAction(payload) {
${INDENT}${INDENT}${INDENT}${INDENT}const id = payload && payload.id;
${INDENT}${INDENT}${INDENT}${INDENT}if (id === 'add') return this.methods.primaryAction();
${INDENT}${INDENT}${INDENT}${INDENT}if (id === 'more' && LP) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return LP.modals.actionSheet({ title: '更多', items: [{ value: 'a', label: '操作一' }, { value: 'b', label: '操作二' }] });
${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}${INDENT}this.toolkit.island.notify('info', '顶栏按钮', String(id || ''));
${INDENT}${INDENT}${INDENT}},`);
    }

    // 弹窗 demo
    if (bp.modals.length) {
        const demos = bp.modals.map((m) => `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}case ${q(m.value)}: return ${modalDemoCall(m.value)};`).join('\n');
        parts.push(`${INDENT}${INDENT}${INDENT}/**
${INDENT}${INDENT}${INDENT} * 弹窗演示。白膜里每种选中的弹窗都要真的能弹出来 ——
${INDENT}${INDENT}${INDENT} * 「点不动的 UI」是白膜最没意义的形态。
${INDENT}${INDENT}${INDENT} */
${INDENT}${INDENT}${INDENT}demoModal(payload) {
${INDENT}${INDENT}${INDENT}${INDENT}if (!LP) return null;
${INDENT}${INDENT}${INDENT}${INDENT}switch (payload && payload.kind) {
${demos}
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}default: return LP.modals.alert({ title: '弹窗', message: '这是一个预设弹窗' });
${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}},`);
    }

    // 灵动岛 demo
    if (bp.islands.length) {
        const cases = bp.islands.map((i) => `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}case ${q(i.value)}:
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}LP.islands.show(this.toolkit.island, ${q(i.value)}, ${islandDemoData(i, bp)}, { kind: ${q(i.kindId)} });
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}break;`).join('\n');
        parts.push(`${INDENT}${INDENT}${INDENT}/**
${INDENT}${INDENT}${INDENT} * 灵动岛演示。
${INDENT}${INDENT}${INDENT} * ★ 必须带 kind —— 不带的话用户在「灵动岛与小组件」里关掉这一种也没用。
${INDENT}${INDENT}${INDENT} * ★ 「进行中的活动」类（进度 / 计时 / 播放）由预设自动补 minSize:'mini'，
${INDENT}${INDENT}${INDENT} *   否则用户在别的 App 里点三下就把它点没了，而活动还在跑。
${INDENT}${INDENT}${INDENT} */
${INDENT}${INDENT}${INDENT}demoIsland(payload) {
${INDENT}${INDENT}${INDENT}${INDENT}if (!LP) return;
${INDENT}${INDENT}${INDENT}${INDENT}switch (payload && payload.kind) {
${cases}
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}default:
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}this.toolkit.island.notify('info', ${q(bp.appName)}, '');
${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}},

${INDENT}${INDENT}${INDENT}closeIsland() {
${INDENT}${INDENT}${INDENT}${INDENT}this.toolkit.island.dismiss();
${INDENT}${INDENT}${INDENT}},`);
    }

    if (bp.widgets.length) {
        parts.push(`${INDENT}${INDENT}${INDENT}/** 桌面小组件被点时回到 App */
${INDENT}${INDENT}${INDENT}onWidgetTap() {
${INDENT}${INDENT}${INDENT}${INDENT}window.dispatchEvent(new CustomEvent('app:page-action', {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}detail: { action: 'openApp', appId: APP_ID, pageId: ${q(bp.defaultRootPageId)} },
${INDENT}${INDENT}${INDENT}${INDENT}}));
${INDENT}${INDENT}${INDENT}${INDENT}return true;
${INDENT}${INDENT}${INDENT}},`);
    }

    if (bp.needsDb) {
        const store = bp.stores[0];
        parts.push(`${INDENT}${INDENT}${INDENT}/**
${INDENT}${INDENT}${INDENT} * 写一条到本地库。
${INDENT}${INDENT}${INDENT} * ★ 写盘前必须 JSON.parse(JSON.stringify(x)) —— Vue 的 reactive 对象是 Proxy，
${INDENT}${INDENT}${INDENT} *   直接塞进 IndexedDB 会抛 DataCloneError。这个错只在运行时出现，
${INDENT}${INDENT}${INDENT} *   构建和 lint 都发现不了。
${INDENT}${INDENT}${INDENT} */
${INDENT}${INDENT}${INDENT}async saveItem(data) {
${INDENT}${INDENT}${INDENT}${INDENT}const record = JSON.parse(JSON.stringify(Object.assign({
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${store.keyPath}: 'item-' + Date.now().toString(36),
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}createdAt: Date.now(),
${INDENT}${INDENT}${INDENT}${INDENT}}, data || {})));
${INDENT}${INDENT}${INDENT}${INDENT}try {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}await this.toolkit.db.put(${q(store.name)}, record);
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}this.toolkit.island.notify('success', '已保存', record.title || '');
${INDENT}${INDENT}${INDENT}${INDENT}} catch (err) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}this.toolkit.island.notify('error', '保存失败', String(err && err.message || err));
${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}${INDENT}return record;
${INDENT}${INDENT}${INDENT}},

${INDENT}${INDENT}${INDENT}async listItems() {
${INDENT}${INDENT}${INDENT}${INDENT}try {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return (await this.toolkit.db.getAll(${q(store.name)})) || [];
${INDENT}${INDENT}${INDENT}${INDENT}} catch (err) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return [];
${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}},

${INDENT}${INDENT}${INDENT}async demoSave() {
${INDENT}${INDENT}${INDENT}${INDENT}await this.methods.saveItem({ title: '示例条目 ' + new Date().toLocaleTimeString('zh-CN') });
${INDENT}${INDENT}${INDENT}},`);
    } else {
        parts.push(`${INDENT}${INDENT}${INDENT}demoSave() {
${INDENT}${INDENT}${INDENT}${INDENT}this.toolkit.island.notify('success', '已保存', '（白膜阶段没有真的存盘）');
${INDENT}${INDENT}${INDENT}},`);
    }

    if (bp.needsAi) {
        parts.push(buildAiMethod(bp));
    }

    if (bp.systemReads.length) {
        parts.push(buildSystemReadMethod(bp));
    }

    parts.push(`${INDENT}${INDENT}${INDENT}/**
${INDENT}${INDENT}${INDENT} * 初始化。
${INDENT}${INDENT}${INDENT} * ★ template / hybrid 模式下框架会在打开 App 时调它；
${INDENT}${INDENT}${INDENT} *   vue 模式不会 —— 那种情况要自己在根组件 mounted 里踢一次。
${INDENT}${INDENT}${INDENT} */
${INDENT}${INDENT}${INDENT}async hydrate() {
${INDENT}${INDENT}${INDENT}${INDENT}if (this.app.state._hydrating) return;
${INDENT}${INDENT}${INDENT}${INDENT}this.app.state._hydrating = true;
${INDENT}${INDENT}${INDENT}${INDENT}try {
${bp.needsDb ? `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}this.app.state.items = await this.methods.listItems();` : `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}// 白膜阶段没有要加载的东西`}
${INDENT}${INDENT}${INDENT}${INDENT}} finally {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}// 只用 _hydrating 防并发，不要用 _hydrated 硬阻断 ——
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}// 硬阻断会让首次失败后永远没有第二次机会
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}this.app.state._hydrating = false;
${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}},`);

    return parts.join('\n\n');
}

function modalDemoCall(kind) {
    switch (kind) {
        case 'confirm': return `LP.modals.confirm({ title: '确认删除', message: '删了就找不回来了，确定吗？', danger: true })`;
        case 'prompt': return `LP.modals.prompt({ title: '重命名', placeholder: '输入新名字' })`;
        case 'form': return `LP.modals.form({ title: '编辑', fields: [{ name: 'title', label: '标题' }, { name: 'on', label: '启用', type: 'switch', value: true }] })`;
        case 'actionSheet': return `LP.modals.actionSheet({ title: '更多操作', items: [{ value: 'edit', label: '编辑' }, { value: 'del', label: '删除', danger: true }] })`;
        case 'picker': return `LP.modals.picker({ title: '选一个', items: [{ value: 'a', label: '选项 A' }, { value: 'b', label: '选项 B' }], value: 'a' })`;
        case 'sheet': return `LP.modals.sheet({ title: '抽屉', bodyHtml: '<p class="lp-modal-text">这里可以放任意内容，长了会自己滚。</p>', actions: [{ id: 'ok', label: '好', variant: 'primary' }] })`;
        case 'toast': return `LP.modals.toast('这是一条轻提示', { type: 'success' })`;
        default: return `LP.modals.alert({ title: '弹窗', message: '' })`;
    }
}

function islandDemoData(i, bp) {
    switch (i.value) {
        case 'progress': return `{ title: '正在处理', value: 62, hint: '第 31 / 50 条' }`;
        case 'timer': return `{ title: '进行中', time: '12:34', hint: '${bp.appName}' }`;
        case 'status': return `{ title: '已连接', value: '同步中', tone: 'ok' }`;
        case 'nowPlaying': return `{ title: '正在播放', message: '占位曲目' }`;
        case 'message': return `{ title: '${bp.appName}', message: '你有一条新消息' }`;
        default: return `{ title: '已完成', message: '操作成功' }`;
    }
}

function buildAiMethod(bp) {
    return `${INDENT}${INDENT}${INDENT}/**
${INDENT}${INDENT}${INDENT} * 调 AI。
${INDENT}${INDENT}${INDENT} *
${INDENT}${INDENT}${INDENT} * 选 API 的优先级：用户卡上绑定的 → 第一个可用的。
${INDENT}${INDENT}${INDENT} * 最后那条兜底很重要：新用户没在任何地方点过「选 API」，
${INDENT}${INDENT}${INDENT} * 没有兜底就完全发不出去，而错误提示还只说「未找到配置」。
${INDENT}${INDENT}${INDENT} *
${INDENT}${INDENT}${INDENT} * ★ window.__apiSdk 是懒加载的 —— 用户没进过设置的 API 面板时它是 undefined，
${INDENT}${INDENT}${INDENT} *   必须判空。
${INDENT}${INDENT}${INDENT} */
${INDENT}${INDENT}${INDENT}async callAi(payload) {
${INDENT}${INDENT}${INDENT}${INDENT}const question = String((payload && payload.text) || '').trim();
${INDENT}${INDENT}${INDENT}${INDENT}if (!question) return { ok: false, error: '没有内容' };

${INDENT}${INDENT}${INDENT}${INDENT}const apiSdk = window.__apiSdk;
${INDENT}${INDENT}${INDENT}${INDENT}if (!apiSdk) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return { ok: false, error: 'API 模块还没加载好。先去「设置 → API 管理」看一眼再回来。' };
${INDENT}${INDENT}${INDENT}${INDENT}}

${INDENT}${INDENT}${INDENT}${INDENT}let apiRef = null;
${INDENT}${INDENT}${INDENT}${INDENT}try {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}const sdk = window.settingsSdk;
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}const user = sdk && (sdk.defaultUserCard && sdk.defaultUserCard.getDefault && sdk.defaultUserCard.getDefault()
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}|| sdk.users && sdk.users.getActive && sdk.users.getActive());
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}const refs = (user && user.boundResources && user.boundResources.apiRefs) || [];
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}for (let i = 0; i < refs.length; i += 1) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}const type = refs[i].refType || refs[i].type;
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}const refId = refs[i].refId || refs[i].id;
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}if (type && refId) { apiRef = { type: type === 'group' ? 'group' : 'key', refId: String(refId) }; break; }
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}${INDENT}} catch (_) { /* 人设读不到不影响兜底 */ }

${INDENT}${INDENT}${INDENT}${INDENT}if (!apiRef) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}const keys = (apiSdk.apiKeySdk && apiSdk.apiKeySdk.listEnabled && apiSdk.apiKeySdk.listEnabled()) || [];
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}if (keys.length) apiRef = { type: 'key', refId: String(keys[0].id) };
${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}${INDENT}if (!apiRef) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return { ok: false, error: '还没有可用的 API Key。去「设置 → API 管理」加一个。' };
${INDENT}${INDENT}${INDENT}${INDENT}}

${INDENT}${INDENT}${INDENT}${INDENT}try {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}const result = await apiSdk.executeApiRequest({
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}apiKeyId: apiRef.type === 'key' ? apiRef.refId : undefined,
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}groupId: apiRef.type === 'group' ? apiRef.refId : undefined,
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}endpoint: 'chat/completions',
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}method: 'POST',
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}body: {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}messages: [
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}{ role: 'system', content: ${q(`你是 ${bp.appName} 的助手。${bp.appDesc || ''}`)} },
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}{ role: 'user', content: question },
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}],
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}temperature: 0.8,
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}},
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}timeout: 60000,
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}});
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}if (!result || result.success === false) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return { ok: false, error: (result && result.error) || '请求失败' };
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}const data = result.data || {};
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}|| (data.content && data.content[0] && data.content[0].text)
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}|| '';
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return { ok: !!text, text: text, error: text ? '' : 'AI 返回了空内容' };
${INDENT}${INDENT}${INDENT}${INDENT}} catch (err) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return { ok: false, error: String((err && err.message) || err) };
${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}},`;
}

function buildSystemReadMethod(bp) {
    const reads = [];
    const has = (v) => bp.systemReads.some((r) => r.value === v);
    if (has('persona')) reads.push(`${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}out.aiPerson = sdk.aiPersons && sdk.aiPersons.getActive && sdk.aiPersons.getActive();`);
    if (has('user')) reads.push(`${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}out.user = sdk.defaultUserCard && sdk.defaultUserCard.getDefault && sdk.defaultUserCard.getDefault();`);
    if (has('world')) reads.push(`${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}out.world = sdk.worlds && sdk.worlds.getActive && sdk.worlds.getActive();`);
    if (has('promptLib')) reads.push(`${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}out.prompts = sdk.prompts && sdk.prompts.groups && sdk.prompts.groups.list && sdk.prompts.groups.list();`);
    if (has('diary')) reads.push(`${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}out.diaries = sdk.diaries && sdk.diaries.list && sdk.diaries.list();`);

    return `${INDENT}${INDENT}${INDENT}/**
${INDENT}${INDENT}${INDENT} * 读系统数据（人设 / 世界观 / prompt 库）。
${INDENT}${INDENT}${INDENT} *
${INDENT}${INDENT}${INDENT} * ★ settingsSdk 可能还没就绪 —— 直接 window.settingsSdk.xxx() 会在
${INDENT}${INDENT}${INDENT} *   冷启动时抛 undefined。要么等 'settings-sdk-ready' 事件，
${INDENT}${INDENT}${INDENT} *   要么像这里一样每一层都判空。
${INDENT}${INDENT}${INDENT} */
${INDENT}${INDENT}${INDENT}readSystemData() {
${INDENT}${INDENT}${INDENT}${INDENT}const sdk = window.settingsSdk;
${INDENT}${INDENT}${INDENT}${INDENT}const out = {};
${INDENT}${INDENT}${INDENT}${INDENT}if (!sdk) return out;
${INDENT}${INDENT}${INDENT}${INDENT}try {
${reads.join('\n')}
${INDENT}${INDENT}${INDENT}${INDENT}} catch (err) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}console.warn('[' + APP_ID + '] 读系统数据失败', err);
${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}${INDENT}return out;
${INDENT}${INDENT}${INDENT}},`;
}

// ---------------------------------------------------------------------------
// setup（跨 App prompt 注册）
// ---------------------------------------------------------------------------

function buildSetup(bp) {
    if (!bp.crossSet.has('promptToMurmur')) {
        return `${INDENT}${INDENT}setup() {
${INDENT}${INDENT}${INDENT}return { items: [], loading: false, _hydrating: false };
${INDENT}${INDENT}},
`;
    }

    return `${INDENT}${INDENT}/**
${INDENT}${INDENT} * ★ 注册必须放 setup，不能放 hydrate。
${INDENT}${INDENT} *   hydrate 只在用户**打开这个 App** 时才跑，而用户完全可能先进 murmur
${INDENT}${INDENT} *   看提示词 —— 那时折叠区里就该已经有这一组了。
${INDENT}${INDENT} *
${INDENT}${INDENT} *   注册表是内存的，每次启动都要重来；用户改过的正文和开关存在
${INDENT}${INDENT} *   IndexedDB 的 appPromptStates 表里，register 之后会自动合并回来。
${INDENT}${INDENT} */
${INDENT}${INDENT}setup({ toolkit }) {
${INDENT}${INDENT}${INDENT}try {
${INDENT}${INDENT}${INDENT}${INDENT}toolkit.prompts.register({
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}id: 'overview',
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}label: ${q(`${bp.appName} · 概况`)},
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}desc: '让 AI 知道用户在这个 App 里都有什么',
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}// content 是**静态快照**。随时在变的东西（当前播放进度、
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}// 此刻几点）不要写在这里 —— 它会被缓存成 pre，不会实时更新。
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}content: ${q(`【${bp.appName}】\n用户正在使用「${bp.appName}」${bp.appDesc ? `——${bp.appDesc}` : ''}。\n如果用户提到相关内容，可以自然地聊起来。`)},
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}defaultActive: false,
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}order: 50,
${INDENT}${INDENT}${INDENT}${INDENT}});
${INDENT}${INDENT}${INDENT}} catch (err) {
${INDENT}${INDENT}${INDENT}${INDENT}// SDK 还没就绪时 register 内部会自己排队重试，这里只兜住意外
${INDENT}${INDENT}${INDENT}${INDENT}console.warn('[' + APP_ID + '] 注册 prompt 失败', err);
${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}return { items: [], loading: false, _hydrating: false };
${INDENT}${INDENT}},
`;
}

// ---------------------------------------------------------------------------
// renderPage：三种模式
// ---------------------------------------------------------------------------

function buildRenderPage(bp) {
    if (bp.renderMode === 'vue') {
        return buildVueRenderPage(bp);
    }

    const hybridNote = bp.renderMode === 'hybrid'
        ? `${INDENT}${INDENT}${INDENT}// hybrid 模式：可以在返回的字符串里插 <component-island name="toggle" ... />，\n${INDENT}${INDENT}${INDENT}// 框架会在 v-html 之后扫描并替换成真 Vue 组件。\n`
        : '';

    return `${INDENT}${INDENT}renderMode: ${q(bp.renderMode)},

${INDENT}${INDENT}/**
${INDENT}${INDENT} * ★ 这里没有 this。
${INDENT}${INDENT} *   框架是从 appConfig 上把这个函数取出来当独立函数调的，
${INDENT}${INDENT} *   写 this.xxx 运行时会抛 undefined。要用 app 就用第三个参数。
${INDENT}${INDENT} */
${INDENT}${INDENT}renderPage(content, page, app) {
${hybridNote}${INDENT}${INDENT}${INDENT}const def = findPage(page && page.id);
${INDENT}${INDENT}${INDENT}return '<div style="' + THEME_STYLE + 'min-height:100%;">' + renderPageBody(def, app) + '</div>';
${INDENT}${INDENT}},

${INDENT}${INDENT}/** 子页面（详情 / 编辑 / 设置…） */
${INDENT}${INDENT}renderDetailPage(content, page, app) {
${INDENT}${INDENT}${INDENT}const pageId = (page && page.id) || (content && content.id) || '';
${INDENT}${INDENT}${INDENT}const sp = ALL_SUBPAGES.filter(function (s) { return s.id === pageId; })[0];
${INDENT}${INDENT}${INDENT}if (!sp) return '<div style="padding:20px;">未知子页面</div>';
${INDENT}${INDENT}${INDENT}return '<div style="' + THEME_STYLE + 'min-height:100%;">' + renderSubpage(sp, app) + '</div>';
${INDENT}${INDENT}},
`;
}

function buildVueRenderPage(bp) {
    return `${INDENT}${INDENT}renderMode: 'vue',

${INDENT}${INDENT}/**
${INDENT}${INDENT} * ★ vue 模式：返回一个 Vue 组件配置，框架用 Vue.createApp 挂载它。
${INDENT}${INDENT} *   同样没有 this。
${INDENT}${INDENT} *
${INDENT}${INDENT} * ★ vue 模式框架**不会**自动调 hydrate，得自己在 mounted 里踢一次。
${INDENT}${INDENT} *   放在 microtask 里是为了让首帧先画出来，不要为了等数据白屏。
${INDENT}${INDENT} */
${INDENT}${INDENT}renderPage() {
${INDENT}${INDENT}${INDENT}return {
${INDENT}${INDENT}${INDENT}${INDENT}name: 'WhiteModelRoot',
${INDENT}${INDENT}${INDENT}${INDENT}props: { app: { type: Object, required: true } },
${INDENT}${INDENT}${INDENT}${INDENT}data() {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return { activeId: ${q(bp.defaultRootPageId)}, subpageId: '', tick: 0 };
${INDENT}${INDENT}${INDENT}${INDENT}},
${INDENT}${INDENT}${INDENT}${INDENT}computed: {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}pages() { return PAGE_DEFS; },
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}activePage() { return findPage(this.activeId); },
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}activeSubpage() {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}const id = this.subpageId;
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return ALL_SUBPAGES.filter(function (s) { return s.id === id; })[0] || null;
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}},
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}bodyHtml() {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}// 读一下 tick，让「数据变了要重画」有个统一的触发点
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}void this.tick;
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return this.activeSubpage
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}? renderSubpage(this.activeSubpage, this.app)
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}: renderPageBody(this.activePage, this.app);
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}},
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}shellStyle() { return THEME_STYLE; },
${INDENT}${INDENT}${INDENT}${INDENT}},
${INDENT}${INDENT}${INDENT}${INDENT}mounted() {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}const self = this;
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}Promise.resolve().then(function () {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}if (self.app && self.app.methods && self.app.methods.hydrate) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return self.app.methods.hydrate();
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}return null;
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}}).then(function () { self.tick += 1; });
${INDENT}${INDENT}${INDENT}${INDENT}},
${INDENT}${INDENT}${INDENT}${INDENT}beforeUnmount() {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}// 弹窗挂在 app-shell 上，不关掉会留在下一个 App 的界面上
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}if (LP) LP.modals.closeAll();
${INDENT}${INDENT}${INDENT}${INDENT}},
${INDENT}${INDENT}${INDENT}${INDENT}methods: {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}goPage(id) { this.activeId = id; this.subpageId = ''; },
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}goBack() { this.subpageId = ''; },
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}/** v-html 出来的按钮走 data-app-action，框架的全局委托会派发到 methods。
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}  * 只有「切子页」这一类纯 UI 跳转需要在组件里自己拦。 */
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}onBodyClick(e) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}const el = e.target.closest && e.target.closest('[data-app-action]');
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}if (!el) return;
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}let payload = null;
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}try { payload = JSON.parse(el.getAttribute('data-app-action')); } catch (_) { return; }
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}if (payload && payload.action === 'openDetail' && payload.pageId) {
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}e.stopPropagation();
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}this.subpageId = payload.pageId;
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}}
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}},
${INDENT}${INDENT}${INDENT}${INDENT}},
${INDENT}${INDENT}${INDENT}${INDENT}template: [
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}'<div class="wm-root" :style="shellStyle">',
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}'  <div v-if="activeSubpage" class="wm-subbar">',
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}'    <button type="button" class="wm-back" @click="goBack">‹ 返回</button>',
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}'    <span class="wm-subtitle">{{ activeSubpage.title }}</span>',
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}'  </div>',
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}'  <div class="wm-body" v-html="bodyHtml" @click="onBodyClick"></div>',
${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}'</div>',
${INDENT}${INDENT}${INDENT}${INDENT}].join(''),
${INDENT}${INDENT}${INDENT}};
${INDENT}${INDENT}},
`;
}

/** vue 模式需要几条自己的样式，随代码一起注入，不依赖外部 CSS 文件 */
function buildStyleInjection(bp) {
    if (bp.renderMode !== 'vue') return '';
    return `${INDENT}// ── 样式 ────────────────────────────────────────────────────
${INDENT}// 插件没有配套的 CSS 文件，样式随代码一起注入。
${INDENT}// 用 id 去重，重复安装不会堆出十几个 <style>。
${INDENT}(function injectStyle() {
${INDENT}${INDENT}if (typeof document === 'undefined') return;
${INDENT}${INDENT}const id = 'wm-style-' + APP_ID;
${INDENT}${INDENT}if (document.getElementById(id)) return;
${INDENT}${INDENT}const el = document.createElement('style');
${INDENT}${INDENT}el.id = id;
${INDENT}${INDENT}el.textContent = [
${INDENT}${INDENT}${INDENT}'.wm-root{display:flex;flex-direction:column;height:100%;min-height:100%;}',
${INDENT}${INDENT}${INDENT}'.wm-body{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;}',
${INDENT}${INDENT}${INDENT}'.wm-subbar{display:flex;align-items:center;gap:8px;padding:8px 12px;flex:0 0 auto;}',
${INDENT}${INDENT}${INDENT}'.wm-back{appearance:none;border:0;background:none;font:inherit;font-size:15px;color:' + THEME.primary + ';cursor:pointer;padding:4px 2px;}',
${INDENT}${INDENT}${INDENT}'.wm-subtitle{font-size:14px;font-weight:600;color:' + THEME.text + ';}',
${INDENT}${INDENT}].join('');
${INDENT}${INDENT}document.head.appendChild(el);
${INDENT}})();
`;
}

// ===========================================================================
// 总装
// ===========================================================================

/**
 * @param {object} bp  blueprint
 * @returns {string}   完整的、可直接运行 / 可下载上传的 App 源码
 */
export function generateAppCode(bp) {
    const icon = buildIcon(bp);

    const chunks = [
        buildHeader(bp),
        `export default function ${bp.factoryName}() {`,
        `${INDENT}const APP_ID = ${q(bp.appId)};`,
        `${INDENT}const APP_ICON = ${q(icon)};`,
        '',
        buildPreamble(bp),
        buildTheme(bp),
        buildPagesConst(bp),
        buildSampleData(bp),
        buildCardRenderer(bp),
        buildPageRenderer(bp),
        buildStyleInjection(bp),
        `${INDENT}// ── appConfig ───────────────────────────────────────────────`,
        `${INDENT}return {`,
        `${INDENT}${INDENT}id: APP_ID,`,
        `${INDENT}${INDENT}name: ${q(bp.appName)},`,
        `${INDENT}${INDENT}icon: APP_ICON,`,
        `${INDENT}${INDENT}iconBg: ${q(bp.style.iconBg)},`,
        '',
        `${INDENT}${INDENT}background: ${q(bp.style.bg)},`,
        `${INDENT}${INDENT}statusBarColor: ${q(bp.style.statusBar)},`,
        `${INDENT}${INDENT}homeIndicatorColor: 'rgba(0,0,0,0.28)',`,
        '',
        buildDistribution(bp),
        buildTopbarConfig(bp),
        buildNavConfig(bp),
        '',
        `${INDENT}${INDENT}pages: PAGE_DEFS.map(function (p) {`,
        `${INDENT}${INDENT}${INDENT}return { id: p.id, label: p.name, icon: p.glyph, nav: true };`,
        `${INDENT}${INDENT}}),`,
        `${INDENT}${INDENT}defaultRootPageId: ${q(bp.defaultRootPageId)},`,
        '',
        `${INDENT}${INDENT}// 子页面标题：框架从这里取详情页的顶栏文案`,
        `${INDENT}${INDENT}detailContent: {`,
        ...bp.pages.flatMap((p) => p.subpages.map((sp) => (
            `${INDENT}${INDENT}${INDENT}${q(sp.id)}: { title: ${q(sp.title)}, subtitle: ${q(sp.desc)} },`
        ))),
        `${INDENT}${INDENT}},`,
        '',
        buildStores(bp),
        buildIslandKinds(bp),
        buildWidgets(bp),
        buildSocialProfile(bp),
        buildRenderPage(bp),
        buildSetup(bp),
        `${INDENT}${INDENT}/**`,
        `${INDENT}${INDENT} * ★ 全部用方法简写 name() {}，不要写成 name: () => {}。`,
        `${INDENT}${INDENT} *   框架是用 apply 把 this 注进来的，箭头函数会忽略它 ——`,
        `${INDENT}${INDENT} *   表现就是「按钮点了没反应」，而且不报错。`,
        `${INDENT}${INDENT} */`,
        `${INDENT}${INDENT}methods: {`,
        buildMethods(bp),
        `${INDENT}${INDENT}},`,
        `${INDENT}};`,
        '}',
        '',
    ];

    return chunks.filter((c) => c !== null && c !== undefined).join('\n');
}
