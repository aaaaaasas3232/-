/**
 * 蓝图 → 交给 AI 的提示词
 *
 * ── 这份提示词和「一段通用模板 + 用户答案」有本质区别 ──────────────
 *
 * 旧做法是：一大段固定的框架说明，后面拼上问卷答案。问题是那段固定说明
 * 里 80% 的内容跟当前这个 App 无关 —— 用户没做社交 App，却读了三屏
 * 「怎么注册 socialProfile」；用户选了 template 模式，却读了 vue 模式的
 * hydrate 契约。AI 的注意力被稀释，真正相关的约束反而被淹掉。
 *
 * 这里按蓝图**裁剪**：只有勾了的能力才会出现对应章节，
 * 每条约束旁边直接写「你这个 App 具体该怎么写」。
 *
 * 另外，提示词里的每一条「坑」都不是泛泛的最佳实践，
 * 而是这个项目真实踩过、并且**运行时不报错**的那些。
 * 会报错的问题不需要写进提示词，AI 自己就能从报错里改出来。
 */

const HR = '\n---\n';

function section(title, body) {
    if (!body) return '';
    return `\n## ${title}\n\n${body}\n`;
}

function bullets(list) {
    return list.filter(Boolean).map((l) => `- ${l}`).join('\n');
}

// ===========================================================================

function partIntro(bp) {
    const persona = bp.engineerStyle
        ? `你是一个${bp.engineerStyle}的软件工程师。`
        : '你是一个注重细节、不喜欢留半成品的软件工程师。';

    return `${persona}

我要你在「小听启动」这个项目里做一个 App。下面是完整的需求和这个项目的所有硬约束。

**小听启动**是跑在浏览器里的 iPhone 模拟器：一个 Vue 3 应用挂在 \`#phone\` 上，负责画桌面、状态栏、灵动岛、Dock 和 App 窗口。业务 App 是纯 ESM 模块，通过 \`registerPhoneApp(appConfig)\` 接进来。

技术栈是真实的，别猜：\`vite@^5.4.10\` + \`tailwindcss@^3.4.19\`，Vue 是浏览器全局变量（\`js/vendor/vue.global.prod.js\`），**不是 npm 依赖**。文件格式是 JavaScript ESM，不是 Vue SFC。`;
}

function partSpec(bp) {
    const lines = [
        `- **名称**：${bp.appName}`,
        `- **App ID**：\`${bp.appId}\`（全局唯一，发布后不要改）`,
        `- **工厂函数名**：\`${bp.factoryName}\``,
        `- **文件位置**：\`js/apps/${bp.appId}/index.js\`（多文件）或 \`js/apps/${bp.appId}.js\`（单文件）`,
    ];
    if (bp.tagline) lines.push(`- **一句话定位**：${bp.tagline}`);
    if (bp.appDesc) lines.push(`- **它是干什么的**：${bp.appDesc}`);
    return bullets(lines);
}

function partRenderMode(bp) {
    const mode = bp.renderMode;
    const common = `\`renderMode: '${mode}'\`（${bp.renderModeInfo?.title}）`;

    if (mode === 'vue') {
        return `${common}

\`renderPage()\` 返回一个 Vue 组件配置对象，框架用 \`Vue.createApp()\` 挂载它。

这个模式下有两条**只在运行时暴露**的约束：

1. **框架不会自动调 \`hydrate()\`。** template 模式下框架会在打开 App 时替你调，vue 模式不会。你必须在根组件的 \`mounted()\` 里自己踢一次，而且放进 microtask 让首帧先画出来：
   \`\`\`js
   mounted() {
       Promise.resolve().then(() => store.hydrate(this.app));
   }
   \`\`\`
   忘了这一步的表现是：页面能打开，但永远是空的 / 永远是默认数据，没有任何报错。

2. **写 IndexedDB 前必须剥 Proxy。** \`Vue.reactive\` 出来的对象是 Proxy，直接 \`db.put()\` 会抛 \`DataCloneError\`：
   \`\`\`js
   await this.toolkit.db.put(STORE, JSON.parse(JSON.stringify(record)));
   \`\`\`
   这个错构建和 lint 都发现不了。

组件内部用 \`@click\` 直接绑事件，不需要走 \`data-app-action\`。`;
    }

    if (mode === 'hybrid') {
        return `${common}

\`renderPage()\` 返回 HTML 字符串，但可以在里面插 \`<component-island name="toggle" label="开关" :value="true" />\`，框架会在 \`v-html\` 之后扫描并替换成真正的 Vue 组件。

注意这是两套心智模型混着用：字符串部分的交互走 \`data-app-action\`，组件部分走 Vue 的事件。出问题时先确认是哪一边。`;
    }

    return `${common}

\`renderPage()\` 返回 HTML 字符串，框架原样 \`v-html\` 注入。

这个模式有一个**很具体的坑**：state 一变，整块 DOM 就会重建。如果页面上有 \`<input>\` / \`<textarea>\`，用户每敲一个字都会导致输入框节点被销毁重建，光标跳走、中文输入法的拼音被打断。

绕开的办法是：输入过程中**完全不碰 reactive state**，把值暂存在 DOM 元素上，等 \`blur\` / \`change\` / \`compositionend\` 时才写回。如果这个 App 有大量文字输入，直接改用 \`renderMode: 'vue'\` 更省事。`;
}

function partStructure(bp) {
    const pageLines = bp.pages.map((p, i) => {
        const cards = p.cards.map((c) => `${c.title}`).join(' + ');
        const fields = p.cardFields.length ? p.cardFields.join(' / ') : '（未指定）';
        const subs = p.subpages.length
            ? p.subpages.map((s) => `\`${s.id}\`（${s.title}：${s.desc}）`).join('、')
            : '无';
        return `${i + 1}. **${p.name}**${p.desc ? ` —— ${p.desc}` : ''}
   - 页面 id：\`${p.id}\`
   - 布局：**${p.layoutTitle}**（${p.layout}）${p.layoutHint ? ` —— ${p.layoutHint}` : ''}
   - 内容用什么卡片：${cards || '（未选）'}
   - 卡片上要显示：${fields}
   - 内边距 ${p.padding}px / 卡片间距 ${p.gap}px
   - 页内搜索框：${p.hasSearch ? '要' : '不要'}
   - 空状态文案：「${p.emptyText}」
   - 子页面：${subs}`;
    }).join('\n\n');

    return `一共 ${bp.pages.length} 个主页面，默认打开 \`${bp.defaultRootPageId}\`。

${pageLines}

**子页面怎么接**：主页面之外的都走 \`detailContent\` + \`renderDetailPage(content, page, app)\`，用 \`{ action: 'openDetail', pageId: 'xxx' }\` 跳过去。**每个子页面都必须有一个能点到它的入口** —— 声明了却没入口的子页面等于不存在，这是最容易漏的一步。`;
}

function partBars(bp) {
    const t = bp.topbar;
    const n = bp.tabbar;
    const lines = [];

    if (!t.visible) {
        lines.push('**顶栏**：关掉（\`topbar: { visible: false }\`）。App 自己画顶部区域的话，注意状态栏是浮在 `.app-shell` 之上的，自绘顶栏要留出 **54px**。');
    } else {
        lines.push(`**顶栏**：${t.title}（\`${t.type}\`）`);
        if (t.type === 'buttons-only') {
            lines.push('- 这条顶栏**没有标题**，整条平分给一排功能按钮。必须写 `showPill: false`，否则中间会顶出一颗 App 名胶囊，把按钮挤到右边。');
            lines.push(`- 按钮：${t.right.join('、') || '（还没选）'}，走 \`headerActions\`，每项形如：`);
            lines.push('  `{ id: \'add\', label: \'新建\', ariaLabel: \'新建\', iconHtml: \'<svg…>\', action: { action: \'appMethod\', appId: APP_ID, method: \'topbarAction\', payload: { id: \'add\' } } }`');
            lines.push(t.buttonLabels
                ? '- 每个按钮**带文字**（`label`），框架画成图标在上、文字在下的宽按钮。'
                : '- 按钮**不带文字**（不要给 `label`），框架画成一排圆形图标钮。');
            lines.push('- `methods.topbarAction({ id })` 里按 id 分支写逻辑，每个 id 都要有实现 —— 点了没反应的按钮比没有按钮更糟。');
        } else {
            if (t.left !== 'none') lines.push(`- 左侧放：${t.left}`);
            if (t.right.length) lines.push(`- 右侧按钮：${t.right.join('、')}，全部走 \`headerActions\`，每个带自己的 \`action\``);
            if (t.type === 'search') lines.push('- 顶栏主区域是搜索框（`type: \'search\'` + `placeholder`）');
            if (t.type === 'segmented') lines.push('- 顶栏下方有一排横向切换 tab');
        }
        lines.push('- **注意**：`topbar.bg` 请保持 `transparent` 或 `blur`。设成实色会触发框架的已知问题：状态栏悬浮在 nav bar 上方形成视觉断层。');
    }

    lines.push('');

    if (!n.visible) {
        lines.push('**底栏**：不要（`nav: { type: \'none\' }`）。');
    } else {
        lines.push(`**底栏**：${n.title}（\`nav: { type: 'tab', preset: '${n.type}' }\`），${n.showLabels ? '显示文字' : '只显示图标'}，共 ${bp.pages.length} 个 tab。`);
    }

    if (bp.fab.visible) {
        lines.push('');
        lines.push(`**浮动主按钮**：放在 ${bp.fab.position}，文案「${bp.fab.label}」。`);
        lines.push('- **注意**：底部定位必须加 `var(--app-safe-bottom)`，否则会压住 home 指示条：`bottom: calc(18px + var(--app-safe-bottom, 0px))`');
    }

    return lines.join('\n');
}

function partVisual(bp) {
    const s = bp.style;
    return `**设计语言**：${s.title}（${s.desc}）

| 用途 | 值 |
|---|---|
| 页面背景 | \`${s.bg}\` |
| 卡片背景 | \`${s.card}\` |
| 主色 | \`${s.primary}\`${s.accentOverridden ? `（用户指定，覆盖了配色自带的 \`${s.presetPrimary}\`）` : ''} |
| 正文文字 | \`${s.text}\` |
| 桌面图标底色 | \`${s.iconBg}\` |
| 状态栏颜色 | \`${s.statusBar}\` |

**尺寸**：圆角 ${bp.radius} / 阴影 ${bp.elevation} / 页面内边距 ${bp.padding}px / 元素间距 ${bp.gap}px

**颜色写在哪儿**：JS 里一个 hex 都不要出现。全部定义成 CSS 变量放 \`css/apps/${bp.appId}/_theme.css\`，挂在 \`.app-shell[data-app-id="${bp.appId}"]\` 上，组件 CSS 只允许 \`var(--xx-*)\`。

唯一允许 JS 里出现颜色的情况是「从 CSS 读出来转发给框架」：
\`\`\`js
const cs = getComputedStyle(shell);
this.app.statusBarColor = cs.getPropertyValue('--xx-text').trim();
\`\`\``;
}

function partPresets(bp) {
    const lines = ['框架自带一套预设库，**先用它，不要自己造**。'];
    lines.push('');
    lines.push('```js');
    lines.push("import { presets as LP } from '@/src/core/presets/index.js';");
    lines.push('// 用户上传的插件不能用 import，改成： const LP = window.__listenPresets;');
    lines.push('```');
    lines.push('');

    lines.push('**布局**（`LP.layouts.*`）：`page` / `column` / `twoColumn` / `grid` / `masonry` / `carousel` / `groupedList` / `split` / `stickyFooter`');
    lines.push('');
    lines.push('**卡片**（`LP.cards.*`）：`surface` / `sectionHeader` / `stat` / `info` / `row` / `media` / `progress` / `banner` / `empty` / `tags` / `timeline` / `keyValue` / `profile` / `bars` / `button` / `fab` / `searchBar` / `segmented`');
    lines.push('');
    lines.push('每个卡片都接受 `padding` / `radius` / `elevation` / `accent`，所以上面那些尺寸要求直接当参数传，不用另写 CSS。');

    if (bp.modals.length) {
        lines.push('');
        lines.push(`**这个 App 要用到的弹窗**（\`LP.modals.*\`，都是 Promise，\`await\` 直接拿结果）：`);
        lines.push(bullets(bp.modals.map((m) => `\`${m.value}\` —— ${m.title}：${m.desc}`)));
        lines.push('');
        lines.push('```js');
        lines.push("const ok = await LP.modals.confirm({ title: '确认删除', message: '删了找不回来', danger: true });");
        lines.push("const data = await LP.modals.form({ title: '新建', fields: [{ name: 'title', label: '标题' }] });");
        lines.push("LP.modals.toast('已保存', { type: 'success' });");
        lines.push('```');
        lines.push('');
        lines.push('这些弹窗挂在**当前 app-shell** 上（不是 document.body），所以不会跑到手机壳外面。切页 / 退出 App 时记得 `LP.modals.closeAll()`，否则弹窗会留在下一个页面上。');
    }

    return lines.join('\n');
}

function partIsland(bp) {
    if (!bp.islands.length) return '';

    const lines = [];
    lines.push('这个 App 要用到这几种灵动岛：');
    lines.push('');
    lines.push(bullets(bp.islands.map((i) => (
        `**${i.title}**（kind: \`${i.kindId}\`）—— ${i.desc}${i.sustained ? ' · **属于「进行中的活动」**' : ''}`
    ))));
    lines.push('');
    lines.push('灵动岛是**两件事**，很容易只做一半：');
    lines.push('');
    lines.push('1. **声明** —— `appConfig.islandKinds`，让系统知道你会弹什么。不声明也能弹，但用户在「灵动岛与小组件」总览页里既预览不到、也关不掉它。');
    lines.push('2. **弹** —— `this.toolkit.island.show(size, payload)` / `.notify(type, title, msg)`。');
    lines.push('');
    lines.push('两边靠 `kind` 字段串起来：**`show()` 的 payload 里不带 `kind`，用户的开关就是摆设**（框架拦截逻辑找不到对应项，一律放行）。');

    const sustained = bp.islands.filter((i) => i.sustained);
    if (sustained.length) {
        lines.push('');
        lines.push(`**注意**：${sustained.map((i) => `「${i.title}」`).join('、')}代表**还在进行中的活动**，弹的时候必须带 \`minSize: 'mini'\`：`);
        lines.push('');
        lines.push('```js');
        lines.push("this.toolkit.island.show('medium', {");
        lines.push(`    kind: '${sustained[0].kindId}',`);
        lines.push("    title: '正在处理', message: '第 3 / 20 条',");
        lines.push("    minSize: 'mini',        // ★ 少了这个，用户在别的 App 里点三下就把它点没了");
        lines.push("    lifecycle: 'manual',    // 不自动消失，任务结束时自己 dismiss()");
        lines.push('});');
        lines.push('```');
        lines.push('');
        lines.push('框架的全局「点岛外收起」是 large → medium → mini → 关岛。不设 `minSize` 的话它会一路被收到关闭，而任务还在后台跑着。');
    }

    lines.push('');
    lines.push('还有一条：**每次 `show()` 都是一次完整替换**。更新内容时要把 `minSize` / `onClosed` 这些一起带上，漏了就等于清掉了。');
    lines.push('');
    lines.push('可以直接用预设省掉这些细节：`LP.islands.show(this.toolkit.island, \'progress\', { title, value }, { kind })` 会自动补 `minSize` 和 `lifecycle`。');

    return lines.join('\n');
}

function partWidgets(bp) {
    if (!bp.widgets.length) return '';
    const lines = [];
    lines.push('要做这几个桌面小组件：');
    lines.push('');
    lines.push(bullets(bp.widgets.map((w) => `**${w.title}**（id: \`${w.widgetId}\`，尺寸 ${w.size}）—— ${w.desc}`)));
    lines.push('');
    lines.push('声明在 `appConfig.widgets[]`，每项要有 `id` / `label` / `icon` / `iconBg` / `size` / `render(size, payload)` / `onTap`。');
    lines.push('');
    lines.push('尺寸约定：**S = 2×1**（只够放一个数字）、**M = 2×2**（数字 + 说明）、**L = 4×2**（列表或图表）。第一次写 widget 最常见的错误是塞太多东西，S 尺寸下文字直接被裁掉。');
    lines.push('');
    lines.push('`render` 返回的字符串也走 `v-html`，**动态内容必须 escapeHtml**。');
    lines.push('');
    lines.push('可以直接用 `LP.widgets.widget(\'stat\', { id, label, getPayload })`，三档尺寸的降级它已经处理好了。');
    return lines.join('\n');
}

function partData(bp) {
    if (!bp.needsDb) {
        return '这个 App 不需要持久化。如果后来发现要存东西，记得声明 `stores` —— 用了 `toolkit.db` 但没声明表，写入会**静默失败**（表现是「保存成功但刷新就没了」）。';
    }

    const rows = bp.stores.map((s) => `| \`${s.name}\` | \`${s.keyPath}\` | ${s.desc} |`).join('\n');

    return `需要这几张 IndexedDB 表：

| 表名 | 主键 | 存什么 |
|---|---|---|
${rows}

声明方式：
\`\`\`js
stores: [
${bp.stores.map((s) => `    { name: '${s.name}', keyPath: '${s.keyPath}' },`).join('\n')}
],
\`\`\`

**三条必须遵守的**：

1. **声明了 \`stores\` 就必须在 \`js/apps/index.js\` 里用 \`async: true\` 注册。** 同步注册不会走 \`ensureSchema()\`，表压根没建出来，首次 \`put\` 静默失败。
2. **写盘前 \`JSON.parse(JSON.stringify(x))\` 剥 Proxy**，否则 \`DataCloneError\`。
3. **落盘要防抖 + 在 \`pagehide\` / \`beforeUnmount\` 时 flush**，否则用户切走的那一下最后一次修改会丢。

还有一条经验：**写数据前先确认有人读**。这个项目里最高频的一类问题是「孤儿 key」—— 存了一堆字段，但从来没有任何代码读它们。

顺便：新表记得去 \`src/core/db-catalog.js\` 登记一条（表名、归属、主键、存什么）。nook 的数据库页从那份目录读，不登记的话用户在那里看不到你的表，而且对账会把它报成「未登记」。`;
}

function partAi(bp) {
    if (!bp.needsAi) return '';
    return `要调 AI。**不要自己写 fetch**，走框架的 API 管理：

\`\`\`js
const apiSdk = window.__apiSdk;
// ★ __apiSdk 是懒加载的 —— 用户没进过「设置 → API 管理」时它是 undefined，必须判空
if (!apiSdk) return { ok: false, error: 'API 模块还没加载好' };

const result = await apiSdk.executeApiRequest({
    apiKeyId: ref.type === 'key' ? ref.refId : undefined,
    groupId:  ref.type === 'group' ? ref.refId : undefined,
    endpoint: 'chat/completions',
    method: 'POST',
    body: { messages: [{ role: 'system', content: sys }, { role: 'user', content: text }], temperature: 0.8 },
    timeout: 60000,
});
\`\`\`

**用哪个 API 的优先级**（这一段的最后一条兜底很重要）：

1. 这个 App 自己绑的（如果做了「选 API」的 UI）
2. 当前用户卡绑的：\`settingsSdk.defaultUserCard.getDefault().boundResources.apiRefs\`
3. **第一个可用的 key**：\`apiSdk.apiKeySdk.listEnabled()[0]\`

第 3 条不能省。新用户从来没在任何地方点过「选 API」，没有兜底就完全发不出去，而报错还只说「未找到 API 配置」，用户根本不知道该去哪儿配。错误提示里请直接写清楚「去设置 → API 管理加一个」。

要流式就换 \`executeApiStream({ ..., idleTimeout, signal, onChunk })\`。注意它用的是**空闲超时**而不是总时长超时（生成三千字跑两分钟是正常的，该判定为挂掉的是「连续 90 秒没有新数据」），而且用户点停止时 \`aborted: true\` 但 \`text\` 里有已生成的部分 —— 那些内容是用户的，不要丢。

解析返回值时兼容三家格式：\`data.choices[0].message.content\`（OpenAI）、\`data.content[0].text\`（Anthropic）、\`data.candidates[0].content.parts[0].text\`（Gemini）。`;
}

/**
 * 「按世界观动态生成内容」那一档。
 *
 * 单独成章而不是并进「AI 调用」，是因为它要求的不是一个方法，而是一套**架构**：
 * 首次配置、档案分档、两段式生成、货币映射。少任何一条，做出来的东西
 * 都会「能跑但和世界观没关系」—— 而这个失败在开发机上完全看不出来，
 * 随便什么内容看着都像那么回事。
 *
 * 这一章的内容来自 2026-08-13 做「四叶草购物」那一轮的实测，
 * 每一条都是当时真的踩到并修掉的。
 */
function partWorldContent(bp) {
    if (!bp.needsWorldContent) return '';
    return `这个 App 里的内容**不预置**，全部由 AI 按用户当前的世界观现生成。这不只是「多调一次 API」，它要求下面五件事一起成立 —— 少一件，做出来的东西都会「能跑，但和世界观没关系」。

### 1. 世界观里有什么，怎么读

一处读，不要散在各个组件里。散着读迟早出现「首配读的是 A、生成时读的是 B」。

\`\`\`js
const sdk = window.settingsSdk;
const user  = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
const world = user?.boundWorldId ? sdk.worlds.get(user.boundWorldId) : sdk?.worlds?.getActive?.();

world.summary          // 简介 —— **必传**
world.keyPoints        // 要点数组，补充简介
world.currencyName     // 货币名（默认「金币」）—— **必传**
world.flows            // 「夹子」：碎知识 prompt 库 [{ id, title, content }]
                       //   ⚠️ UI 上叫「夹子」，字段却叫 flows，这是历史命名，别改
sdk.aiPersons.list().filter(a => a.boundWorldId === world.id)   // 这个世界里的 AI
await sdk.promptLibrary.listAllPrompts()                        // 用户的 prompt 库
\`\`\`

### 2. 两段必须传，而且**不给用户关**

**世界观简介**和**资金映射**（货币名）是这类 App 的地基。用户可以关掉夹子、关掉附加提示词，但这两段一关，生成出来的就是一堆和世界观无关的通用内容 —— 那这个 App 就没有存在意义了。

资金映射那段要写得很硬，否则 AI 会自己冒出「元」：

\`\`\`
这个世界的通用货币叫「星币」。
- 所有价格都用「星币」计价，只给数字，不要带单位符号，不要写「元」「块」「$」
- 定价要符合这个世界的物价水平
\`\`\`

### 3. 首次配置：门闸 + 档案键

第一次打开必须先配置，配置内容至少包括「选哪些夹子」「选哪些 prompt 库条目」。

**档案键 = \`\${defaultUserId}::\${worldId}\`。** 所有数据按它分档。

这样才能满足「换了默认用户、而且世界观不同 → 要求重新配置；换回来 → 数据原样恢复」。

\`\`\`js
// 每次读数据都**现算**键，不要缓存
function getProfileKey() {
    const u = ..., w = ...;
    return (u?.id && w?.id) ? \`\${u.id}::\${w.id}\` : '';   // 拿不到就返回空串
}
\`\`\`

⚠️ **不要靠「用户切换了」这个事件来触发重置。** 只要有任何一条切换路径不派发那个事件，行为就会变成「有时候好使有时候不好使」，而这种问题你和用户都很难稳定复现。现算键的做法根本不需要事件到达。

⚠️ 空串必须当成「还不能读写」，不能当成一个合法的键 —— 否则数据会被写进一个谁也读不到的档。

### 4. 两段式生成：列表先、详情后

这是控 token 的主要手段，也是这类 App 唯一能做大的方式。

| | 什么时候生成 | 内容 |
|---|---|---|
| 列表 | 用户进页面 / 按「换一批」 | 只要名字、一句话、价格。一次 8 条 |
| 详情 | 用户**点进某一张卡** | 规格、评价、菜单…… 一次一份 |

一次列表 8 条的成本远低于 8 份详情，而用户真正会点开的通常只有一两件。

详情生成期间要有**加载动画**，而且不要用骨架屏 —— 骨架的前提是「结构已知只差内容」，而这时连有几条规格都还不知道，画一堆假条目再整个换掉，跳变比等待更难受。

### 5. 存盘策略：收藏的才留，其余刷新即弃

- 收藏的 → 一条一记录，永久留着
- 当前这批列表 → **一条会被覆盖的记录**，刷新即覆盖

不落盘不行（切个 App 回来就空了，得重烧一次 token），一条一记录也不行（几十次刷新之后数据库里全是没人要的垃圾）。折中就是「整批存成一条」：刷新 = 覆盖，旧的自然消失，数据库里永远只有一条。

用户手动添加的东西**自动收藏** —— 他手打了一遍，不该被刷新带走。

### 6. 输出格式一律要 JSON

嵌套结构用自定义分隔符表达很脆，少一个符号会解析歪**而且看不出来**。

解析要三步加固：剥 \\\`\\\`\\\` 围栏 → 从第一个 \`{\` 截到最后一个 \`}\` → parse。
**失败要明确报错，不要把乱码填进 UI 假装成功。**

\`\`\`
只输出一个 JSON，不要任何解释文字，不要 markdown 代码围栏。
\`\`\`

### 7. 提示词组装：预览和发送必须是同一次计算

\`\`\`js
const { text, parts } = buildPrompt({ ... });
//      ↑ 发给 AI      ↑ 预览面板渲染这个
\`\`\`

同一次调用的两个返回字段。**不能是两个函数** —— 无论一开始写得多一致，都会分叉，这是时间问题不是能力问题。分叉之后的表现是「用户在预览里关掉了某段，那段照发不误」，而且不报任何错。`;
}

/**
 * ★ v0.88 新增：购物与求职 App 的专项指南
 *
 * 这两类 App 的共性：
 * 1. 有明确的「资金链」概念（购物付款、求职薪资）
 * 2. 有时间线的概念（订单日期、求职周期）
 * 3. 内容量大、条目多，需要良好的列表管理和搜索筛选
 */
function partCommerce(bp) {
    const hasShopping = bp.capSet.has('shopping') || bp.capSet.has('payment');
    const hasJob = bp.capSet.has('job') || bp.capSet.has('resume');
    if (!hasShopping && !hasJob) return '';

    const lines = [];

    if (hasShopping) {
        lines.push('### 购物 App 专项');
        lines.push('');
        lines.push('**商品数据模型**：');
        lines.push('```js');
        lines.push('{ id, name, desc, price, currency, category, image, stock, rating }');
        lines.push('```');
        lines.push('');
        lines.push('**购物车数据模型**：');
        lines.push('```js');
        lines.push('{ id, productId, quantity, addedAt }');
        lines.push('```');
        lines.push('');
        lines.push('**订单数据模型**：');
        lines.push('```js');
        lines.push('{ id, items: [{productId, name, price, quantity}], total, currency, status, createdAt, updatedAt }');
        lines.push('// status: pending | paid | shipped | completed | cancelled');
        lines.push('```');
        lines.push('');
        lines.push('**资金链映射（必须走同一本账）**：');
        lines.push('参考 `js/apps/shop-app/services/wallet-service.js`。付钱、退款、余额全部走 `window.settingsSdk.assetFlow`，和红包 / 转账 / 演员片酬是同一本账。**禁止**自己在 App store 里另存一份 `balance`。');
        lines.push('');
        lines.push('```js');
        lines.push('const sdk = window.settingsSdk;');
        lines.push('const userId = sdk.users.getActive()?.id;');
        lines.push('const pay = await sdk.assetFlow.add({');
        lines.push("    type: 'purchase',");
        lines.push("    direction: 'out',");
        lines.push('    amount: Math.abs(total),          // 绝对值，方向由 direction 决定');
        lines.push("    sourceType: 'shop-order',");
        lines.push('    sourceId: orderId,                // 同一 sourceId 24h 内会去重');
        lines.push("    note: `购买 ${itemName}`,");
        lines.push('}, "user", userId);');
        lines.push('if (!pay.ok) { /* pay.insufficientBalance 时提示余额不足，不要再调 adjust */ }');
        lines.push('```');
        lines.push('');
        lines.push('1. 商品价格用世界观货币名（`sdk.worlds.getActive()?.currencies` 里 `isBase` 那条的 name），不要写「元」「块」「$」');
        lines.push('2. 支付文案写「用某某币支付」，这是模拟支付但余额是真扣的');
        lines.push('3. 退款用 `sdk.assetFlow.removeBySource(sourceType, sourceId, "user", userId)`，不要再 add 一笔反向流水凑数');
        lines.push('');
        lines.push('**结算流程**：');
        lines.push('1. 购物车 → 确认商品列表 → 选择配送地址（可预设） → 确认支付');
        lines.push('2. 支付成功后：购物车清空、生成订单、状态变为「待发货」');
        lines.push('3. 订单列表显示：订单号、时间、商品摘要、总价、当前状态');
        lines.push('');
        lines.push('**订单状态流转**：');
        lines.push('```');
        lines.push('pending(待支付) → paid(已支付) → shipped(已发货) → completed(已完成)');
        lines.push('                  ↓');
        lines.push('             cancelled(已取消)');
        lines.push('```');
        lines.push('');
    }

    if (hasJob) {
        lines.push('### 求职 App 专项');
        lines.push('');
        lines.push('**职位数据模型**：');
        lines.push('```js');
        lines.push('{ id, title, company, location, salary, salaryType, requirements: [], description, postedAt, deadline }');
        lines.push('// salaryType: monthly | yearly | one-time | negotiable');
        lines.push('```');
        lines.push('');
        lines.push('**简历数据模型**：');
        lines.push('```js');
        lines.push('{ id, name, title, phone, email, education: [], experience: [], skills: [], summary }');
        lines.push('// education: [{ school, degree, major, from, to }]');
        lines.push('// experience: [{ company, title, from, to, desc }]');
        lines.push('```');
        lines.push('');
        lines.push('**投递记录数据模型**：');
        lines.push('```js');
        lines.push('{ id, jobId, jobTitle, company, resumeId, status, appliedAt, updatedAt }');
        lines.push('// status: submitted(已投递) | viewed(已查看) | interview(面试中) | offer(录用) | rejected(不合适)');
        lines.push('```');
        lines.push('');
        lines.push('**投递流程**：');
        lines.push('1. 职位列表 → 点击查看详情 → 选择简历 → 确认投递');
        lines.push('2. 投递后：生成投递记录、职位状态变为「已投递」');
        lines.push('3. 投递记录列表显示：职位名、公司名、投递时间、当前状态');
        lines.push('');
        lines.push('**时间映射（重要）**：');
        lines.push('1. 职位发布时间用「X天前」格式，过期职位要特殊标记');
        lines.push('2. 简历中的教育/工作经历按时间倒序排列');
        lines.push('3. 投递截止日期要明确显示，过期不可投递');
        lines.push('');
        lines.push('**搜索与筛选**：');
        lines.push('1. 职位搜索：按职位名、公司名搜索');
        lines.push('2. 筛选条件：薪资范围、地点、职位类型（全职/兼职/实习）、发布日期');
        lines.push('3. 排序选项：最新发布、薪资最高、距离最近');
    }

    return lines.join('\n');
}

/**
 * ★ v0.90：世界观模拟系统专章。
 *
 * 「追光」（js/apps/actor-career/，演员成长之路）把这套地基完整落了一遍：
 * 真资产、每档时间轴、加权事件、多档存档、确定性 NPC。这一章不重新发明
 * 任何东西，只把那套已验证的做法按用户勾选裁剪出来。每个小节都指向
 * src/core 或参考实现里的真模块 —— 让 AI 抄对的，别让它现编。
 */
function partWorldSim(bp) {
    const ws = bp.worldSim || {};
    if (!ws.any) return '';
    const lines = [];

    lines.push('这个 App 是「世界观模拟」类：钱是真的、时间会走、事件有概率、可以存档重来。**参考实现是 `js/apps/actor-career/`（追光，演员成长之路）**，下面每个系统在那里都有完整落地，照它的结构写，不要自己发明。');
    lines.push('');
    lines.push('通用分档：**档案键 = `${defaultUserId}::${worldId}`**（`src/core/world-profile.js` 的 `readWorldProfile()` / `createProfileKey()`），配置级数据挂档案键，游玩级数据挂 saveId。');

    if (ws.asset) {
        lines.push('');
        lines.push('### 真实资产联动（src/core/asset-ledger.js）');
        lines.push('');
        lines.push('**不要新建余额系统。** 全系统一本账（和聊天红包、四叶草、候鸟同一个钱包）：');
        lines.push('');
        lines.push('```js');
        lines.push("import { chargeAsset, getAssetBalance } from '@/src/core/asset-ledger.js';");
        lines.push('');
        lines.push('// 扣款（幂等：同 sourceType+sourceId 重复点击不会二次扣）');
        lines.push("const paid = await chargeAsset({ entityType: 'user', entityId: userId, amount,");
        lines.push(`    sourceType: '${bp.appId}-ticket', sourceId: stableId, note: '……' });`);
        lines.push("if (!paid.ok) return showToast(paid.error);   // 「余额不足」也在这里");
        lines.push('');
        lines.push('// 入账（收入方向 asset-ledger 没有现成封装，参考 actor-career/services/salary.js 的 grantIncome：');
        lines.push('// 先 listBySource 查重（direction \"in\"），再 sdk.assetFlow.add({ direction: \"in\", ... })）');
        lines.push('```');
        lines.push('');
        lines.push('三条铁律：① 每笔收支必须有**稳定的** sourceType + sourceId（重复点击 = 同一凭据 = 只记一次）；② 金额与货币名来自世界观（`world.currencyName`），UI 不写死「元」；③ 退款按同一凭据 `refundAsset`，已完成的消费不自动退。');
    }

    if (ws.time) {
        lines.push('');
        lines.push('### 世界时间系统（每档独立时间轴）');
        lines.push('');
        lines.push('两层结构，别混：');
        lines.push('');
        lines.push('1. **世界观纪时映射**（`settingsSdk.chronology`）：把现实毫秒翻成这个世界的说法（「纪5年3月12日 辰时」）。开没开由世界观决定，没开就退回公历。');
        lines.push('2. **每档虚拟时钟**（参考 `actor-career/services/clock.js`）：');
        lines.push('');
        lines.push('```js');
        lines.push('clock = {');
        lines.push('    anchorMs,   // 开档那刻的现实毫秒 = 档内第 1 天 00:00');
        lines.push('    day: 1,     // 档内第几天；快进 = day 直接加');
        lines.push('    minute,     // 当日分钟 0~1440；24:00 封顶等用户决定跨日');
        lines.push('    syncReal,   // 是否跟现实钟走');
        lines.push('}');
        lines.push('// 虚拟毫秒 = anchorMs + (day-1)*86400000 + minute*60000 → 喂给 chronology 显示');
        lines.push('```');
        lines.push('');
        lines.push('必须满足的行为：调「早/中/晚」只动 minute；活动消耗固定时长，到 24:00 弹「进入下一天还是现实明天再玩」；**快进 N 天 = 整档纪时一起走**，锚点照开、事件照掷、回不了头；**新开一档 anchorMs 重置为现在**（时间线回到原点）。快进后如果要补叙事，AI 只出叙事和建议属性变化，时间推进本身不依赖 AI 成功。');
    }

    if (ws.stats) {
        lines.push('');
        lines.push('### 数值成长系统（src/core/experience-system.js）');
        lines.push('');
        lines.push('```js');
        lines.push("import { validateExperienceSetup, applyAttributeDeltas, resolveContest, createSeededRandom } from '@/src/core/experience-system.js';");
        lines.push('```');
        lines.push('');
        lines.push('- 属性字段**集中声明**在 constants.js（一个数组），进度条 0~100，不许散落');
        lines.push('- 首配要有**初始加点**：预算集中定义，实时校验（`validateAllocation` 模式），锁定项（如按阶段派生的数值）明确标 locked');
        lines.push('- **一切属性变化都走 `applyAttributeDeltas`**（带 before/applied/after/reason 留痕），AI 只出建议 delta，代码钳制后结算');
        lines.push('- 对抗判定（试镜/比赛/考核）走 `resolveContest`：保存 seed、双方分数、修正项、概率、roll —— 同 seed 回放同结果，**没有重 roll**；强弱差要真实（明显弱势大概率失败，保留小概率爆种 upsetChance）');
    }

    if (ws.events) {
        lines.push('');
        lines.push('### 加权突发事件（参考 actor-career/services/event-engine.js）');
        lines.push('');
        lines.push('事件概率是四层乘积，每一层都要可解释：');
        lines.push('');
        lines.push('```');
        lines.push('p = 阶段曲线 × 属性护盾 × 消费护盾 × 状态修正，clamp 到 [floor, cap]');
        lines.push('  阶段曲线：p0 = base × (peak/base)^t   // 指数插值，越接近顶端涨得越快');
        lines.push('  属性护盾：p ×= factor^((attr - pivot) / 50)   // factor<1 保护，属性低反向放大');
        lines.push('  消费护盾：花钱买的保护期内 ×0.15（如公关买断黑料）');
        lines.push('  状态修正：精力见底 ×1.35 之类');
        lines.push('```');
        lines.push('');
        lines.push('- 掷签 seed = `${saveId}::${day}::${eventId}`（确定性：同档同天永远同一批，不存在刷好事件）');
        lines.push('- 每天常规事件设上限（如 2 件），按严重度排优先；隐藏事件低概率 + 条件触发，不占额度');
        lines.push('- UI 要有**风险透明面板**：把每个事件此刻的真实概率亮给用户看');
        lines.push('- 有选项的事件弹窗三选一（含花钱选项，走资产系统）；不处理走默认效果');
    }

    if (ws.saves) {
        lines.push('');
        lines.push('### 多档存档（参考 actor-career 的 profile / save 两层）');
        lines.push('');
        lines.push('| 层 | 键 | 存什么 | 重开新档时 |');
        lines.push('|---|---|---|---|');
        lines.push('| profile | 档案键 | 首配、名册、奖项/节日定义、改写台账 | **保留** |');
        lines.push('| save | saveId | 时钟、属性、事件状态、进度、结局 | 新建（时间归零、属性按首配重置） |');
        lines.push('');
        lines.push('- 附属数据（事件日志/时间轴/项目/聊天/日程）全部带 saveId，删档要 purge');
        lines.push('- 往外部系统写过的东西（世界观时间轴、人设经历）要**留台账**（ids / lines 存进 save 或 profile），删档/重开时按台账回收 —— A 档的痕迹不能污染 B 档');
        lines.push('- 「结局」是一次 AI 生成存进 save.endingText，status 标 ended，但**不锁玩法**（用户还能继续日常）');
        lines.push('- 跨档要保留的记忆（如阶段卡）单独一张表挂档案键，明确「重开不删卡」');
    }

    if (ws.npcs) {
        lines.push('');
        lines.push('### 确定性 NPC 名册（参考 actor-career/services/npc-engine.js）');
        lines.push('');
        lines.push('- NPC = 素材池拼装：姓名 + 职业(地位) + MBTI + 2 条性格细节 + 怪癖 + 隐秘目标 + 初始态度，**全程 JS，不调 AI**');
        lines.push('- seed 来自档案键 → **同档案永远同一批人，换人设/换世界才换人**；名册固化进 profile');
        lines.push('- 每档独立的是「启用了谁」（默认启用一部分），支持增删、拉世界绑定的 AI 进来当角色（人设做快照，源人设变了弹三选一：覆盖/存阶段卡/不动）');
        lines.push('- 聊得投缘 → `registerEncounteredCharacter`（src/core/world-profile.js）注册进 nook 角色库，externalId 幂等');
        lines.push('- 留少量隐藏 NPC：条件 + 低概率揭示');
    }

    if (ws.geo) {
        lines.push('');
        lines.push('### 世界地点接入（src/core/world-profile.js）');
        lines.push('');
        lines.push('- 读：`sdk.places.list({ worldRef })` / `sdk.locations.getByPlace()` 作为活动/探索目标');
        lines.push('- 写：**只有用户主动确认**才 `registerGeoCandidate({ place, location })` —— 已有地点只加场所、新地点才建图，重复注册幂等；App 打开时禁止批量写世界地图');
    }

    lines.push('');
    lines.push('### 世界观时间轴与提示词');
    lines.push('');
    lines.push('- 档内大事记自己存一张表；**重大**事件同步 `sdk.timelines.addTimelineEvent(worldId, "world", {...})`，返回的 id 存进 save 以便回收');
    lines.push('- 所有 prompt 走 `src/core/context-composer.js` 的 `composeAndSave()`：预览与发送同源；世界观/人设/数值/时间/近期大事各自独立 part');
    lines.push('- murmur 概要卡（`toolkit.prompts.register`）注入的是**概要**，切档要重放并注销别档的卡');

    return lines.join('\n');
}

function partSystemReads(bp) {
    if (!bp.systemReads.length) return '';
    const lines = [];
    lines.push('要读这些系统数据：');
    lines.push('');
    lines.push(bullets(bp.systemReads.map((r) => `**${r.title}** —— ${r.desc}（\`${r.api}\`）`)));
    lines.push('');
    lines.push('**注意：`window.settingsSdk` 可能还没就绪。** 冷启动时直接 `window.settingsSdk.aiPersons.list()` 会抛 undefined。两种写法二选一：');
    lines.push('');
    lines.push('```js');
    lines.push("// A. 等事件");
    lines.push("await new Promise(r => window.settingsSdk ? r() : window.addEventListener('settings-sdk-ready', r, { once: true }));");
    lines.push('');
    lines.push('// B. 每一层判空（读一次就走的场景用这个）');
    lines.push('const sdk = window.settingsSdk;');
    lines.push('const person = sdk?.aiPersons?.getActive?.();');
    lines.push('```');
    return lines.join('\n');
}

function partCrossApp(bp) {
    if (!bp.crossSet.has('promptToMurmur') && !bp.crossSet.has('socialProfile')
        && !bp.crossSet.has('socialInfluence') && !bp.crossSet.has('worldMode')) return '';

    const lines = [];

    if (bp.crossSet.has('worldMode')) {
        lines.push('### 绑定专属世界模式');
        lines.push('');
        lines.push('这个 App 只属于某一种体验模式的世界（actor / idol / esports / cultivation / apocalypse）：');
        lines.push('');
        lines.push('```js');
        lines.push('worldAvailability: {');
        lines.push("    includeModes: ['actor'],      // 模式见 src/core/world-profile.js 的 WORLD_MODES");
        lines.push('    requiresBoundWorld: true,     // 没绑世界不出现');
        lines.push('},');
        lines.push('distribution: { requiresInstall: false },   // 对应世界桌面自动出现，离开自动隐藏');
        lines.push('```');
        lines.push('');
        lines.push('App 内部再兜一层：hydrate 时 `resolveWorldMode(world)` 不匹配就显示拦截页 —— 桌面可见性和数据可用性是两道闸。');
        lines.push('');
    }

    if (bp.crossSet.has('socialInfluence')) {
        lines.push('### 影响社交 App（social-influence provider）');
        lines.push('');
        lines.push('你 App 里发生的事出现在氧气热搜 / 萤火私信的**唯一通道**（参考 `actor-career/services/providers.js`）：');
        lines.push('');
        lines.push('```js');
        lines.push("import { registerSocialInfluenceProvider } from '@/src/core/social-influence-registry.js';");
        lines.push('');
        lines.push('setup({ toolkit }) {');
        lines.push('    registerSocialInfluenceProvider({');
        lines.push(`        sourceAppId: '${bp.appId}',`);
        lines.push("        providerId: 'hot-terms',           // 发布后不能改");
        lines.push("        label: '热搜词条',");
        lines.push("        targetAppIds: ['blog'],");
        lines.push("        channels: ['hot-search'],          // hot-search / dm / feed / comment");
        lines.push('        getContent: () => 读当前档概要拼一句话,   // ★ 只读状态、不调 AI');
        lines.push('    });');
        lines.push('}');
        lines.push('```');
        lines.push('');
        lines.push('三条边界：① provider 只输出**概要文本**，由氧气/萤火在用户点击生成时收集；② 注册放 `setup()`（内存注册表，刷新即失效要重放）；③ **不得**触碰氧气值 / batteryBridge / 冥想空间 / 小听 / 黑匣子的任何接口，也不得直接 import 目标 App 的 store。');
        lines.push('');
    }

    if (bp.crossSet.has('promptToMurmur')) {
        lines.push('### 往 murmur 注册提示词');
        lines.push('');
        lines.push('目的是让 AI 在聊天时知道用户在你这个 App 里发生了什么。注册之后，murmur 的「回复提示词」页会多出你这个 App 的一组卡片，用户能逐条开关、编辑正文、拖顺序。');
        lines.push('');
        lines.push('```js');
        lines.push('setup({ toolkit }) {');
        lines.push('    toolkit.prompts.register({');
        lines.push("        id: 'overview',");
        lines.push(`        label: '${bp.appName} · 概况',`);
        lines.push("        desc: '让 AI 知道用户在这个 App 里都有什么',");
        lines.push("        content: '……',");
        lines.push('        defaultActive: false,');
        lines.push('        order: 50,');
        lines.push('    });');
        lines.push('    return { /* 初始 state */ };');
        lines.push('}');
        lines.push('```');
        lines.push('');
        lines.push('**四个必须知道的细节：**');
        lines.push('');
        lines.push('1. **注册要放 `setup()`，不能放 `hydrate()`。** hydrate 只在用户**打开你这个 App** 时才跑。用户完全可能先进 murmur 看提示词 —— 那时折叠区里就该已经有你这一组了。放 hydrate 的表现是「装了 App，但 murmur 里死活找不到」。');
        lines.push('');
        lines.push('2. **注册表是内存的，用户的改动才在数据库里。** 每次启动都要重新 `register()`；用户编辑过的正文、开关状态、排序存在 IndexedDB 的 `appPromptStates` 表（key = `` `${appId}::${promptId}` ``），`register()` 之后框架会自动合并回来。所以**卸载 App 再装回来，用户的设置还在** —— 不要自己写迁移。');
        lines.push('');
        lines.push('3. **`content` 是快照，不是实时值。** 整条链路是：');
        lines.push('   ```');
        lines.push('   register() → appPrompts SDK → prompt-manager 折叠区 → systemActiveItems');
        lines.push('             → orderedCards → previewParts → writeContextPreview → pre（localStorage 快照）');
        lines.push('             → ai-service.callAiAndSplit 读 pre → 发给 AI');
        lines.push('   ```');
        lines.push('   注意倒数第二步：**内容被冻结成 `pre` 快照**。所以「现在播到第几秒」「此刻几点」「群主是谁」这类随时在变的东西写进 `content` 是没用的 —— 用户看到的和 AI 收到的会对不上。这类内容必须在发送时现算再追加。');
        lines.push('');
        lines.push('4. **少接一环就是静默失效。** 这条链任何一环没接上，表现都是「开关能点、计数会变、AI 完全收不到」，没有任何报错。新增一类能进上下文的内容时，顺着上面那条链走一遍。');
        lines.push('');
        lines.push('变量系统：`content` 里可以用 `{{aiName}}` / `{{userName}}` 这类占位符，替换实现只有一份（`src/core/prompt-variables.js`），不要自己再写一套。');
        lines.push('');
    }

    if (bp.crossSet.has('socialProfile')) {
        lines.push('### 声明为社交 App');
        lines.push('');
        lines.push('「社交 App」指的是**用户和 AI 会在里面以某个形象出现**的 App。声明之后，nook（设置 App）的人设编辑器里会自动多出一张「社媒形象」卡。');
        lines.push('');
        lines.push('```js');
        lines.push('socialProfile: {');
        lines.push(`    label: '${bp.appName}',`);
        lines.push(`    desc: '${bp.tagline || bp.appDesc || '在这里的形象'}',`);
        lines.push('    order: 50,');
        lines.push("    fields: ['nickname', 'avatar', 'background'],");
        lines.push('},');
        lines.push('```');
        lines.push('');
        lines.push('数据存在 `persona.socialProfiles[appId]`。**不要去改 nook 的内部实现** —— 这个列表现在是注册制的（`src/core/social-app-registry.js`），App 只通过 `registerPhoneApp` 一个口子接入是这个项目的基本约定。');
        lines.push('');
    }

    return lines.join('\n');
}

function partPitfalls(bp) {
    const items = [];

    items.push(`**\`renderPage\` / \`renderDetailPage\` / \`setup\` 内部没有 \`this\`。**
框架是从 appConfig 上把这些函数**取出来当独立函数调**的，\`this\` 已经丢了。渲染逻辑拆成模块顶层函数，\`renderPage\` 只做 \`if (page.id === 'xxx') return renderXxx(app)\` 的分发。要用 app 就用第三个参数。`);

    items.push(`**\`methods\` / \`services\` 里必须用方法简写。**
\`\`\`js
methods: {
    async save() { this.toolkit.xxx },   // 对
    save: async () => { this.toolkit },  // 错：箭头函数忽略框架注入的 this
}
\`\`\`
写成箭头函数的表现是「按钮点了没反应」，**不报错**。
注意这只针对「框架直接调的那层函数」—— 它们内部嵌套的 \`setTimeout\` / \`forEach\` / \`.then\` 回调用箭头函数没问题。`);

    if (bp.renderMode !== 'vue') {
        items.push(`**\`createActionAttr\` 返回的是完整属性串。**
\`\`\`js
\`<button \${action}>\`                      // 对：直接展开
\`<button data-app-action='\${action}'>\`    // 错：套了两层，DOM 上看着还挺正常
\`\`\`
这个坑本项目踩过两次，因为出错后 DOM 检查器里看不出异常。`);
    }

    items.push(`**CSS 类名前缀先确认没被占用（全项目 grep 一遍再定）。**
已知被占用的前缀：\`.ac-*\`（全局 AcModal 弹窗，\`.ac-overlay\` 是 z-index 9999 的居中遮罩）、\`.ox-*\`（氧气）、\`.lp-*\`（预设库）、\`.wv-*\`（世界观库）、\`.gg-*\`（湛蓝回忆）、\`.tv-*\`（候鸟）、\`.chat-*\`（murmur）、\`.zg-*\`（追光）。
撞名的表现是**样式互相污染且零报错** —— 追光第一版用了 \`ac-\`，所有子页面被 AcModal 的居中样式挤成一团。CSS 变量名（\`--xx-*\`）单独确认一次，类名不撞不代表变量不撞。`);

    items.push(`**自绘全套 UI 的 fullscreen App：四条框架覆写 + 层级铁律，缺一个就崩一种。**
四条覆写（AGENTS2 §19.4，不写 = App 左右各空 14px、子页挤在中间、底栏被内容顶出屏）：
\`\`\`css
.app-shell[data-app-id="${bp.appId}"] .app-content { padding: 0; }
.app-shell[data-app-id="${bp.appId}"] .app-page-stack { border-radius: 0; }
.app-shell[data-app-id="${bp.appId}"] .app-page { overflow: hidden; }
.app-shell[data-app-id="${bp.appId}"] .app-screen-panel { height: 100%; min-height: 0; padding: 0; }
\`\`\`
层级铁律：home 指示条层 \`.app-bottom\` 是 \`z-index: 6\` 浮在最上，**App 内一切绝对定位层必须 < 6**（建议 tabbar 4、覆盖页/弹窗/toast 全 5、靠 DOM 顺序分先后）。盖住它的表现是指示条消失、用户拖不出卡片、**退不了你的 App**。探针加两条断言：根组件宽度 === shell 宽度；\`elementFromPoint(指示条中心)\` 命中 \`.app-bottom\` 子树。`);

    items.push(`**用户输入 / 数据库字段拼进 HTML 前必须 \`escapeHtml\`。**
\`renderPage\` 和 widget 的 \`render\` 返回值都走 \`v-html\`。图标、固定 SVG、框架常量不用 escape。`);

    items.push(`**内联 SVG 不写尺寸会被画成 300×150。**
浏览器对没有 width/height 的 \`<svg>\` 用这个默认值，一个图标就能把整行布局撑爆。加一条零特异性兜底：
\`\`\`css
:where(.app-shell[data-app-id="${bp.appId}"]) svg:where(:not([width]):not([height])) {
    width: 18px; height: 18px; flex-shrink: 0;
}
\`\`\``);

    items.push(`**底部悬浮元素要让开 home 指示条。**
用 \`var(--app-safe-bottom)\` 和 \`env(safe-area-inset-bottom)\`，不要写死数值。自绘顶栏则要留 **54px** 给状态栏。`);

    items.push(`**id 可能是字符串，全项目禁止 \`Number(id)\` 比较。**`);

    items.push(`**框架已知问题：\`topbar.bg\` 设成实色会造成状态栏与 nav bar 的视觉断层。**
这个还没修，你的 App 请保持 \`transparent\` / \`blur\` 绕开它。`);

    items.push(`**框架已知问题：\`__detailRenderTick\` 有两处同名 ref，\`.value++\` 通知不到 computed。**
所以不要依赖手动 tick 强制重渲（无效），通过切页触发。template 模式的 App 重画认 \`__detailRenderTick\`，不认 \`syncNow\`；如果 detail 页用了 async renderer，还要先 \`window.invalidateRendererCache?.(appId, null)\` 再 \`syncNow({ force: true })\`。`);

    return items.map((t, i) => `### ${i + 1}. ${t.split('\n')[0].replace(/\*\*/g, '')}\n\n${t.split('\n').slice(1).join('\n')}`).join('\n\n');
}

function partWiring(bp) {
    return `接进项目要改**两处**（不需要动 \`index.html\` 之外的东西，也**不需要**改 \`src/index.js\`）：

1. \`js/apps/index.js\`
   \`\`\`js
   import ${bp.factoryName} from './${bp.appId}/index.js';
   // appModules 数组里加一行
   // appFactories 数组里加：
   { name: '${bp.appId}', factory: ${bp.factoryName}, async: ${bp.needsDb} },
   \`\`\`
   ${bp.needsDb ? '★ 声明了 `stores`，`async` 必须是 `true`。' : '没有 stores，`async: false` 即可。'}

2. \`index.html\` 里加一行样式引用：
   \`\`\`html
   <link rel="stylesheet" href="/css/apps/${bp.appId}/index.css?v=1" />
   \`\`\`

**如果这个 App 是要做成「用户上传的插件」**（从 nook 的软件管理装），规则完全不同：

- **一行 \`import\` 都不能有。** 插件走 \`import(blobURL)\` 运行时加载，没有构建、没有别名解析，\`@/src/core/escape.js\` 会直接抛 "Failed to resolve module specifier"。
- 依赖全部从 window 取：\`window.__listenPresets\`（预设库）、\`window.settingsSdk\`、\`window.__apiSdk\`。
- \`escapeHtml\` 这类小工具自己内联一份。
- CSS 随代码 \`document.createElement('style')\` 注入，用 id 去重。
- 整个 App 写成**一个文件**，\`export default function ${bp.factoryName}() { ... }\`。`;
}

function partDeliver(bp) {
    return `1. 完整可运行的 App 代码。
2. 一段给我看的说明：**每个页面能做什么**，用大白话，不要贴代码。
3. 自查：
   \`\`\`bash
   npm run build
   \`\`\`
4. **必须真的在浏览器里点一遍。** 这个项目历史上的恶性 bug 有个共同特征：build 和 lint 全绿，只在浏览器里才炸 —— hydrate 没人调、Proxy 写不进 IndexedDB、图标撑爆布局、按钮点了没反应。
5. 没做完的部分列出来并说明原因。

**做得少但每一处都真的能用，好过做得全但一半按钮是死的。** 篇幅不够就主动说「先做核心的两个页面，剩下的下一轮」，不要为了看起来完整而铺一堆点不动的 UI。`;
}

function partGames(bp) {
    const g = bp.games || {};
    if (!g.any) return '';
    const lines = [];
    lines.push('这个 App 带可玩的小游戏。群聊小游戏走 `js/apps/chat-app/games/`（上传 JS 动态注册）；独立 App 自己画棋盘，但 **AI 调用必须走 `window.__apiSdk`**，钱和时间如果沾了就走 `settingsSdk.assetFlow` / `settingsSdk.chronology`。');
    lines.push('');
    lines.push('三条铁律：');
    lines.push('1. 棋盘 / 蛇身 / 回合状态全部是 JS 确定性的，**不要让 AI 改规则**');
    lines.push('2. 需要 AI 走棋时，每个座位用**自己的** API Key（`apiKeySdk.listEnabled()` 里按座位选，不要共用一把钥匙）');
    lines.push('3. 上传到群聊游戏区的文件**一行 import 都不能有**，依赖从 `window` 上拿');

    if (g.gomoku) {
        lines.push('');
        lines.push('### 五子棋（连 AI）');
        lines.push('');
        lines.push('- 15×15 棋盘，黑先。胜负：横竖斜任意五子');
        lines.push('- 用户点空位落子 → 校验 → 判定 → 再轮到 AI');
        lines.push('- AI prompt 只给「棋盘文本 + 你是黑/白 + 请返回 `x,y`」，解析失败就在合法空位里随机一格，**不要重问把额度烧光**');
        lines.push('- 参考群聊实现：`js/apps/chat-app/games/` 里已有的棋类结构');
    }
    if (g.snake) {
        lines.push('');
        lines.push('### 贪吃蛇（不连 AI）');
        lines.push('');
        lines.push('- 纯本地：方向键 / 滑动、吃到变长、撞墙或撞自己结束');
        lines.push('- **禁止**调用 `window.__apiSdk` / `executeApiRequest`');
        lines.push('- 分数和最高分可以进自己的 store，不要写进人设钱包');
    }
    if (g.arena) {
        lines.push('');
        lines.push('### 跨时空回合制（用户 + 最多 3 个 AI，一共最多 4 人）');
        lines.push('');
        lines.push('- 座位：`user` 必有；其余座位各绑一个 AI 人设 + 一个 API Key');
        lines.push('- 每个 AI 的 system prompt 只描述**自己的**身份和可见信息，不要把别人的隐秘目标泄漏过去');
        lines.push('- 调用：`const { executeApiRequest } = await 从 window.__apiSdk 取`；按座位的 keyId 发，失败就跳过该座位并写一条系统旁白');
        lines.push('- 回合时钟如果要跟世界观走，用 `sdk.chronology.realToWorld`，不要自己 `Date.now()` 冒充世界时间');
        lines.push('- 胜负结算可以写世界观时间轴（`sdk.timelines.addTimelineEvent`），返回的 id 存进本局以便删档回收');
    }
    return lines.join('\n');
}

function partNotes(bp) {
    if (!bp.extraNotes) return '';
    return bp.extraNotes;
}

// ===========================================================================

/**
 * @param {object} bp blueprint
 * @returns {string} 完整提示词
 */
export function buildPrompt(bp) {
    const parts = [
        partIntro(bp),
        HR,
        section('一、要做的 App', partSpec(bp)),
        section('二、渲染模式', partRenderMode(bp)),
        section('三、页面结构', partStructure(bp)),
        section('四、顶栏与底栏', partBars(bp)),
        section('五、视觉', partVisual(bp)),
        section('六、可以直接用的预设', partPresets(bp)),
        section('七、灵动岛', partIsland(bp)),
        section('八、桌面小组件', partWidgets(bp)),
        section('九、数据存储', partData(bp)),
        section('十、AI 调用', partAi(bp)),
        section('十一、按世界观生成内容', partWorldContent(bp)),
        section('十一B、世界观模拟系统（资产 / 时间 / 数值 / 事件 / 存档 / NPC / 地点）', partWorldSim(bp)),
        section('十二、读系统数据', partSystemReads(bp)),
        section('十三、跨 App 接入', partCrossApp(bp)),
        section('十四、购物与求职 App 专项', partCommerce(bp)),
        section('十五、小游戏专项', partGames(bp)),
        HR,
        section('必须避开的坑', '下面每一条都是这个项目**真实踩过**、并且**运行时不报错**的问题。会报错的问题不用写在这里，你从报错里就能改出来；下面这些不会给你任何提示。\n\n' + partPitfalls(bp)),
        HR,
        section('接进项目', partWiring(bp)),
        section('交付', partDeliver(bp)),
        section('补充要求', partNotes(bp)),
        HR,
        `## 自查清单\n\n${buildChecklist(bp)}`,
    ];

    return parts.filter(Boolean).join('\n').replace(/\n{4,}/g, '\n\n\n');
}

function buildChecklist(bp) {
    const items = [
        `工厂函数 \`${bp.factoryName}\` 已 default export`,
        `\`id\` 是 \`${bp.appId}\`，和现有 App 不重名`,
        `\`pages[]\` 有 ${bp.pages.length} 项，\`defaultRootPageId\` 是 \`${bp.defaultRootPageId}\` 且在其中`,
        '`renderPage` 存在，内部**没有**用 `this`',
        '`methods` 全部用方法简写，**没有**箭头函数',
        '用户输入 / DB 字段都过了 `escapeHtml`',
    ];
    if (bp.needsDb) {
        items.push('用到的 store 都在 `stores` 里声明了');
        items.push('`js/apps/index.js` 里用的是 `async: true`');
        items.push('写盘前 `JSON.parse(JSON.stringify(x))` 剥了 Proxy');
        items.push('新表已在 `src/core/db-catalog.js` 登记');
    }
    if (bp.renderMode === 'vue') {
        items.push('根组件 `mounted()` 里调了一次 `hydrate()`');
        items.push('`beforeUnmount()` 里 flush 了未落盘的改动');
    }
    if (bp.islands.length) {
        items.push('`islandKinds` 已声明，且 `show()` 的 payload 里带了 `kind`');
        if (bp.islands.some((i) => i.sustained)) items.push('进行中的活动类的岛带了 `minSize: \'mini\'`');
    }
    if (bp.widgets.length) items.push('widget 的 `render` 在 S 尺寸下没有被裁掉');
    if (bp.needsAi) items.push('`window.__apiSdk` 用前判空了，且有「第一个可用 key」的兜底');
    if (bp.needsWorldContent) {
        items.push('世界观**简介**和**货币名**每次生成都传了，且用户关不掉');
        items.push('数据按 `${userId}::${worldId}` 分档，换用户换世界观会要求重配、换回来数据还在');
        items.push('列表和详情是两段式，详情等用户点进去才生成');
        items.push('「当前这批列表」是一条会被覆盖的记录，不是一条一记录');
        items.push('AI 返回的 JSON 解析失败时明确报错，没有把乱码填进 UI');
        items.push('预览和发送用的是同一次 `buildPrompt()` 的两个返回字段');
    }
    if (bp.systemReads.length) items.push('`settingsSdk` 等了 ready 或每层判空');
    if (bp.crossSet.has('promptToMurmur')) items.push('`toolkit.prompts.register` 写在 `setup()` 里，不是 `hydrate()`');
    if (bp.fab.visible || bp.tabbar.visible) items.push('底部元素用了 `var(--app-safe-bottom)`，没挡住 home 指示条');

    // ★ v0.88 购物 App 检查项
    if (bp.capSet.has('shopping') || bp.capSet.has('payment')) {
        items.push('商品价格使用世界观货币，没有出现「元」「块」「$」等现实货币符号');
        items.push('支付流程完整：确认订单 → 支付 → 生成订单 → 更新状态');
        items.push('订单状态流转正确：pending → paid → shipped → completed（或 cancelled）');
        items.push('购物车增删改数量功能正常');
    }

    // ★ v0.88 求职 App 检查项
    if (bp.capSet.has('job') || bp.capSet.has('resume')) {
        items.push('职位发布时间使用相对时间格式（X天前）');
        items.push('投递记录状态跟踪完整：submitted → viewed → interview → offer/rejected');
        items.push('简历编辑和选择功能正常');
        items.push('过期职位有特殊标记，不可投递');
    }

    // ★ v0.90 世界观模拟系统检查项
    const ws = bp.worldSim || {};
    if (ws.asset) {
        items.push('所有收支走 assetFlow（asset-ledger），带稳定 sourceType+sourceId，重复点击只记一次账');
        items.push('余额不足有明确提示，取消操作不扣款');
    }
    if (ws.time) {
        items.push('每档时钟独立（anchorMs/day/minute），快进后整档纪时一起走');
        items.push('到 24:00 弹「进入下一天 / 明天再玩」，新开档时间回到原点');
        items.push('叙事里的日期来自世界纪时映射，不是现实日期');
    }
    if (ws.stats) {
        items.push('属性字段集中声明，一切增减走 applyAttributeDeltas 留痕，AI 只出建议 delta');
        items.push('对抗判定 resolveContest 带 seed 存档，同 seed 回放同结果，没有重 roll');
    }
    if (bp.games?.gomoku) items.push('五子棋胜负判定在 JS 里，AI 只返回坐标，解析失败有随机合法落子兜底');
    if (bp.games?.snake) items.push('贪吃蛇没有调用任何 AI / API');
    if (bp.games?.arena) items.push('跨时空回合制每个 AI 座位用自己的 API Key，失败跳过该座位');
    if (bp.capSet.has('shopping') || bp.capSet.has('payment') || ws.asset) {
        items.push('付钱走 sdk.assetFlow.add，没有在 App 自己的 store 里另存 balance');
    }

    if (ws.events) {
        items.push('事件概率 = 阶段曲线 × 属性护盾 × 消费护盾 × 状态，UI 有风险透明面板');
        items.push('掷签 seed 确定（saveId+day+eventId），每天常规事件有上限');
    }
    if (ws.saves) {
        items.push('profile（档案键）与 save（档）分层；删档 purge 附属数据并回收外部写入');
        items.push('重开新档：时间归零、属性重置、名册保留、阶段卡不删');
    }
    if (ws.npcs) {
        items.push('NPC 由素材池 seeded 拼装（不调 AI），同档案键永远同一批');
        items.push('AI 拉进来当 NPC 有人设快照；源人设变了弹「覆盖/存阶段卡/不动」三选一');
    }
    if (ws.geo) {
        items.push('地点只在用户确认后 registerGeoCandidate，注册幂等，打开 App 不批量写地图');
    }
    if (bp.crossSet.has('socialInfluence')) {
        items.push('provider 只输出概要、不调 AI，注册在 setup() 且没碰氧气值/小听等禁区');
    }
    if (bp.crossSet.has('worldMode')) {
        items.push('worldAvailability.includeModes 生效：对应模式桌面自动出现，切走自动隐藏');
    }

    items.push('每个子页面都有能点到它的入口');
    items.push('随便点十个按钮，没有点了没反应的');
    items.push('关掉 App 再打开，数据还在');

    return items.map((i) => `- [ ] ${i}`).join('\n');
}
