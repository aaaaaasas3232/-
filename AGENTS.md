# AGENTS.md — 小听启动 项目指引

> 本文件是给「AI 编程助手 / 新加入的开发者」的项目入门手册。
> 读完后应能独立回答：项目用什么语法、App 长什么样、新 App 怎么接入、XSS 怎么防、widget 怎么挂。

---

## 0. 一句话总览

**小听启动** 是一个跑在浏览器里的「iPhone 风格模拟器」：
- 入口 `index.html` → `src/index.js` → 自动把 `js/apps/*.js` 里所有 App 注册到桌面。
- 桌面 / App 窗口 / 灵动岛 / 小组件 / IndexedDB 都是同一套 Vue 3 框架（通过 `vue.global.prod.js` 暴露的全局 `Vue`）在驱动。
- 业务 App 都是 **纯 ESM 文件**，只通过 `registerPhoneApp({...})` 这一个口子接入，**不需要改 `index.html`、不需要改 `src/index.js`**。

开发命令：

```bash
npm install
npm run dev        # vite dev server, http://localhost:5173
npm run build      # 普通多文件产物 → dist/
npm run build:single  # 全部 inline 成单 HTML（vite-plugin-singlefile） → dist-single/
```

---

## 1. 模块语法与项目结构

### 1.1 强制 ESM

`package.json` 里有：

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:single": "vite build --config vite.config.single.js"
  }
}
```

所以：

- **所有 `.js` 文件都按 ESM 解析**。不要写 `require(...)`、不要写 `module.exports`。
- 用 `import ... from '...'`、`export default ...`、`export const ...`。
- 路径别名：`@` 指向项目根（`vite.config.js` 里有 `alias: { '@': path.resolve(__dirname, './') }`）。
  例如 `import { foo } from '@/src/core/escape.js'`。
- 浏览器侧的旧 IIFE/全局脚本仍然允许（例如 `js/vendor/vue.global.prod.js`、CSS），但**业务代码必须 ESM**。

### 1.2 目录约定

```
小听启动/
├── index.html                  # 单一 HTML 入口，<script type="module" src="/src/index.js">
├── src/
│   ├── index.js                # Vite 入口：拼装所有 framework / apps
│   ├── core/                   # 给 App 用的「核心 SDK」
│   │   ├── actions.js          #   动作系统（详见 §3）
│   │   ├── app-registry.js     #   registerPhoneApp(...) 的实现
│   │   ├── app-toolkit.js      #   每个 App 拿到的 toolkit（island / db / actions / icons ...）
│   │   ├── store-api.js        #   IndexedDB 封装 + sharedRecords
│   │   ├── escape.js           #   escapeHtml / renderTextBlock（XSS 防线）
│   │   ├── renderers.js        #   通用 HTML 片段渲染器
│   │   ├── templates.js        #   appTemplates：info-list / hero / ... 模板
│   │   ├── page-renderers.js   #   createDefaultPageRenderer / createDefaultDetailRenderer
│   │   ├── icon-library.js     #   内置图标库 + 设置页 builder
│   │   ├── icons.js            #   APP_ICONS / UI_ICONS / UI_TOKENS / UI_SYMBOLS
│   │   ├── island-helper.js    #   toolkit.island 的具体实现
│   │   └── island-templates.js #   灵动岛 html 模板 + style 注入
│   └── apps/
│       └── template-app.js     # 用 templates 描述 App 的样板（适合「非代码流」生成器）
├── js/
│   ├── apps/                   # ★ 真实 App 全部在这里 ★
│   │   ├── index.js            # 静态 import 所有 App，调用 registerPhoneApp
│   │   ├── prompt-survey.js    # 业务 App 范例
│   │   ├── framework-test-app.js
│   │   ├── placeholder-apps.js # 仅占位的批量空壳，调试翻页用
│   │   └── setting/            # 设置 App（持久化、配置）
│   ├── framework/              # 桌面 / 灵动岛 / App 窗口 / widget 选择器的 Vue 组合
│   │   ├── index.js            # 统一 re-export
│   │   ├── core-shim.js        # bootstrapSystemData()：创建 Vue app 并挂到 #phone
│   │   ├── use-system-clock.js
│   │   ├── use-dynamic-island.js
│   │   ├── use-app-navigation.js
│   │   ├── use-desktop-edit.js # 桌面分页、拖拽、编辑模式、widget 板
│   │   ├── use-card-mode.js    # 应用卡片模式（home indicator 上滑切卡）
│   │   ├── use-widget-picker.js
│   │   └── utils.js
│   ├── db/                     # IndexedDB（window.myDb / window.musicDb）
│   │   ├── engine.js           #   ListenDb：open / put / get / getAll / ...
│   │   ├── base-stores.js      #   基础 store 集合
│   │   └── music-stores.js
│   └── vendor/                 # 第三方（vue.global.prod.js 等）
├── css/main.css                # 主样式 + tailwind 产物
├── public/                     # 静态资源
├── vite.config.js              # 多文件 build 配置
├── vite.config.single.js       # 单文件 build 配置
└── AGENTS.md                   # 本文件
```

### 1.3 加载顺序

`src/index.js` 是唯一的「组装现场」，顺序是：

1. `src/core/*` — 核心 SDK（同步 import，纯函数/常量）。
2. `@/js/db/index.js` — 创建 `window.myDb` / `window.musicDb`，**不** 等待 `open()`。
3. `@/js/framework/index.js` — 把 `core-shim` 的 `bootstrapSystemData` 暴露到 `window`，并把 framework hook 挂到 `window.*`（兼容老代码）。
4. `@/js/apps/index.js` — 静态 `import` 所有 App，循环调用 `registerPhoneApp(...)`。
5. 顶层把 `core` 模块的常用导出再次挂到 `window.*`，这是「非 ESM 老代码 → ESM」过渡层，**新代码不要写 `window.createAppAction(...)` 这种调用**，直接 `import`。

> 「老代码兼容层」约定：如果看到 `if (typeof window !== 'undefined') window.xxx = ...`，说明在迁移期。**新 App 不需要这套**，直接 `import`。

---

## 2. App 的原型（Prototype）

### 2.1 一个 App 是什么

每个 App 都是一个**默认导出的工厂函数**，返回一份配置对象（也叫 `appConfig`）：

```js
// js/apps/my-app.js
export default function createMyApp() {
    return {
        id: 'my-app',                       // 必须全局唯一（不同 App 撞 id 会冲突）
        name: '我的 App',                    // 桌面图标下方的名字
        icon: `<svg viewBox="0 0 60 60" ...>...</svg>`,  // 必须是内联 SVG 字符串
        iconBg: 'linear-gradient(145deg, #7c3aed, #ec4899)',

        // ===== 可选 =====
        background: 'linear-gradient(180deg, #f8f5ff, #fffdfd)',  // 应用内背景
        statusBarColor: '#3b1d75',          // 状态栏文字颜色
        homeIndicatorColor: 'rgba(59,29,117,0.28)',
        dock: { visible: true, order: 0 },  // 是否出现在底部 Dock
        topbar: { visible: true, title: '...', subtitle: '...' },
        nav: { type: 'tab' },               // 'tab' | 'orb' | 不设置

        pages: [                            // 根页面（出现在 App 顶部 nav）
            { id: 'home',  label: '首页', icon: '◦', nav: true },
            { id: 'about', label: '说明', icon: '◎', nav: true },
        ],
        defaultRootPageId: 'home',

        detailContent: {                    // 二级页面（push 进入的细节页）
            'install-guide': { title: '...', subtitle: '...', blocks: [...] },
        },

        setup({ toolkit, app }) {           // 初始 state，可在 renderPage 前塞入 app.state
            return { counter: 0, items: [] };
        },

        methods: {                          // 业务方法。框架会 bind context：{ app, toolkit, methods, services, ...methods }
            increment() { this.app.state.counter = (this.app.state.counter || 0) + 1; },
        },

        services: {                         // 给其他 App 调用的「对外接口」
            async ping(payload) { return { ok: true, payload }; },
        },

        renderPage(content, page, app) {    // ★ 必填 ★ 返回 HTML 字符串，会被 v-html 注入
            if (page.id === 'home') return `<div class="app-card">Hello</div>`;
            return createDefaultPageRenderer(page);  // 兜底
        },

        widgets: [                          // 可选：app 提供的小组件
            {
                id: 'quick-counter',        // 全局唯一（同 App 内唯一即可）
                label: '计数器',
                icon: '...',
                iconBg: '#222',
                defaultSize: 'S',          // 'S' | 'M' | 'L'
                defaultOrientation: 'h',   // S 才有意义：'h' 2x1 或 'v' 1x2
                render(size, payload) { return `<div class="p-2">${payload.label}</div>`; },
                renderItem(size, payload) { return this.render(size, payload); },
                onTap() { /* ... */ },
            }
        ],
    };
}
```

> `renderPage / methods / services` 里的 `this` 由 `app-registry.js` 注入，**不要用箭头函数**，否则拿不到上下文。

### 2.2 两种 App 风格

- **代码流（推荐用于真实业务）**：直接写 JS，例如 `js/apps/prompt-survey.js`、`js/apps/framework-test-app.js`。`renderPage` 拼字符串、读 `app.state`、调 `toolkit.island.xxx`。
- **模板流（适合 AI 生成的 App）**：用 `appTemplates`（`info-list` / `hero` / `chevron-row` / `settings-group` / ...）+ `detailContent.blocks`，根本不写 `renderPage`。范例见 `src/apps/template-app.js`，由 `src/index.js` 末尾 `registerPhoneApp(createTemplateApp())` 注册。

### 2.3 `renderPage` 返回 HTML 字符串 —— 这是事实上的 DSL

`app-shell.app-content` 里那一段 `<div class="app-screen-panel" v-html="currentPageView"></div>` 直接吃你 return 的字符串（见 `index.html:270`）。所以：

- 可以用任何内联 HTML + Tailwind 类名（`main.css` 已经把 Tailwind 编译进去了）。
- 想加交互 → 用 action 系统（§3）。
- 想加受控输入 → 给 input/textarea 加 `data-prompt-field` 这种约定字段，然后在 app 自己 `document.addEventListener('input', ...)` 里派发 action（参考 `prompt-survey.js:640-665`）。
- 想要 block 化 → 用 `appTemplates`：`block: { template: 'hero', payload: {...} }`。

---

## 3. 动作系统（actions）—— App 内的「点击」怎么跑

App 的内容是 `v-html` 出来的纯 HTML，**没有 Vue 指令可用**。所有点击/输入都通过 **action attribute** 走：

```js
import {
    createActionAttr,       // 给 HTML 拼 data-app-action='...'
    createAppAction,        // 给 v-html 字符串拼 JSON
    createDetailAction,     // 进入细节页
    createOpenAppAction,    // 跳到另一个 App
    createAppMethodAction,  // 调自己的 methods.xxx
    createModalAction,      // 拉起全局 modal
    createDeepLinkAction,   // 发送 deep link 事件
    createShareRecordAction,// 分享一条记录
} from '@/src/core/actions.js';
```

用法示例（直接照抄 `prompt-survey.js`）：

```js
// 调自己的方法
createActionAttr({ action: 'appMethod', method: 'copyPrompt' }, app.id)
// → data-app-action='{"action":"appMethod","appId":"my-app","method":"copyPrompt"}'

// 带 payload
createActionAttr({
    action: 'appMethod',
    method: 'updateAnswer',
    payload: { type: 'toggleFeature', value: 'AI 生成' }
}, app.id)

// 进细节页
createActionAttr({ action: 'detail', pageId: 'install-guide' }, app.id)

// 跳另一个 App
createActionAttr({ action: 'openApp', targetAppId: 'prompt-survey', pageId: 'survey' }, 'my-app')
```

**事件流向**（框架自动处理，App 作者只需要知道结果）：

1. App HTML 上的 `data-app-action` 属性被框架的全局点击监听捕获。
2. 解析 JSON → 用 `app:page-action` CustomEvent 派发到 `window`。
3. `useAppNavigation` 收到事件 → 找到目标 App → 执行方法 / 打开 modal / 切换 page / 打开 detail。

> 想监听键盘输入（input / textarea），要么 `data-prompt-field` + 顶层 `document.addEventListener('input', ...)`，要么自己在 HTML 里挂事件（但仅限 App 自己用，不走 action 系统）。

---

## 4. App Toolkit（每个 App 拿到的工具箱）

在 `methods` / `services` 里通过 `this.toolkit.xxx` 访问（也支持 `this.app.toolkit.xxx`）。由 `src/core/app-toolkit.js` 构造：

| 字段 | 用途 |
|---|---|
| `toolkit.island` | 灵动岛：`show(size, content)` / `toggle(content)` / `notify(state, title, msg)` / `close(reason)`。详细见 §6 |
| `toolkit.db` | IndexedDB 封装：`add/get/getAll/put/remove/clear/count/bulkPut/bulkRemove`。**必须先在 `appConfig.stores` 里声明表名** |
| `toolkit.shared` | 跨 App 共享记录：`put(record)` / `get(id)` / `getAll()` / `listByTarget(appId)`，存到 `sharedRecords` 表 |
| `toolkit.icons / uiIcons / uiSymbols / iconLibrary / tokens` | 内置图标 / 符号 / 设计 token |
| `toolkit.templates` | `appTemplates.render(template, payload)` —— 在模板流 App 里很常用 |
| `toolkit.actions` | `detail(pageId)` / `modal(type, payload)` / `method(name, payload)` / `openApp(id, pageId, payload)` / `deepLink(...)` / `share(...)` |
| `toolkit.builders.settings` | 设置页 builder（`createSettingsPageBuilder(appId)`） |
| `toolkit.renderers` | `renderActionButton` / `renderChevronRow` / `renderSettingsGroup` / `renderSurfaceCard` / `renderSectionShell` |
| `toolkit.app` | 当前 App 配置本身（循环引用，用 `app` 参数更直接） |

**声明数据表**：

```js
{
    id: 'todo',
    name: '待办',
    icon: '...', iconBg: '...',
    stores: [
        { name: 'todoItems', keyPath: 'id' },     // 必须声明，否则 toolkit.db.add('todoItems', ...) 会抛错
    ],
    methods: {
        async addTask(text) {
            await this.toolkit.db.add('todoItems', {
                id: `task-${Date.now()}`,
                text, done: false, createdAt: Date.now(),
            });
            this.toolkit.island.notify('success', '已添加', text);
        },
    },
    renderPage(content, page, app) {
        const tasks = app.state?.tasks || [];  // 自己用 state 缓存当前列表
        // ...
    }
}
```

---

## 5. XSS 防护（**必读**，本项目最大安全约定）

**核心规则：因为 `renderPage` 返回的字符串会经过 `v-html` 注入，任何「用户输入 / 动态数据」出现在 HTML 里之前必须先转义。**

### 5.1 转义工具

`src/core/escape.js` 提供了统一的 escape：

```js
import { escapeHtml, renderTextBlock } from '@/src/core/escape.js';

escapeHtml('<script>alert(1)</script>')
// → '&lt;script&gt;alert(1)&lt;/script&gt;'

renderTextBlock('hi <bad>', 'text-sm text-slate-600')
// → <div class="text-sm text-slate-600">hi &lt;bad&gt;</div>
```

它覆盖 5 个字符：`& < > " '`。

### 5.2 App 里哪些地方要 escape

| 数据 | 该怎么处理 |
|---|---|
| 用户填的文本（问卷答案、备注、标签等）| **必** `escapeHtml(value)` 再插入 HTML |
| 数据库读出来的字符串字段 | **必** `escapeHtml`，因为 IndexedDB 里的内容不受信任 |
| URL（href/src）| **必** 校验协议（只允许 `http:https:mailto:`，或用 `URL` 校验 host 白名单），并对查询串做 `encodeURIComponent` |
| icon / 模板字符串里固定的 SVG | **不** 需要 escape（开发者写的，受信任），但**不要**把 SVG 字符串与用户输入拼接 |
| `pageContent` / `detailContent.blocks` 里的常量 | **不** 需要 escape（数据源是开发者手写）|
| widget 的 `render(size, payload)` | 由 widget 负责 escape，框架不二次处理 |

### 5.3 不要做的危险操作

- ❌ 直接 `v-html` 一段包含 `${userInput}` 的字符串 → 必先用 `escapeHtml`。
- ❌ 把 `data-prompt-field` 的输入框 value 不转义塞回 `renderPage`。
- ❌ 用 `innerHTML = ...` 或 `document.write(...)` 写未经 escape 的内容。
- ❌ 用 `dangerouslySetInnerHTML` 风格的字符串拼接 + 用户输入。
- ❌ 用 `target="_blank"` 时不加 `rel="noopener noreferrer"`。
- ❌ 用 `eval` / `new Function(...)` 解析任何用户输入。

### 5.4 推荐模式（参考 `prompt-survey.js`）

```js
renderPage(content, page, app) {
    const escapeHtml = app.methods.escapeHtml;        // 自己 methods 里实现的 escape
    const userInput  = app.state?.answers?.appName;   // 可能含 < > & " '
    return `<input class="prompt-input" value="${escapeHtml(userInput)}" />`;
}
```

或者引入 SDK 的：

```js
import { escapeHtml } from '@/src/core/escape.js';
// ...直接 escapeHtml(value)
```

### 5.5 Action 的安全约束

`data-app-action` 的内容会被 `JSON.stringify` + `escapeHtml` 双重处理（见 `serializeAction`），所以**用户输入即使出现在 action payload 里也不会破坏属性结构**。但仍然建议：

- 不要把 token / 密码 / cookie 之类塞进 action payload。
- 不要用 action 系统执行任何 `eval` 类副作用。

---

## 6. 灵动岛（Dynamic Island）

通过 `toolkit.island` 控制：

```js
this.toolkit.island.show('medium', {
    type: 'info',           // 'info' | 'notification' | 'message'
    title: '...',
    message: '...',
    detail: '...',
    icon: '<svg>...</svg>', // 可选
    iconBg: '#222',
});
this.toolkit.island.notify('success', '标题', '副标题');   // 自动 mini + 3 秒消失
this.toolkit.island.toggle({ ... });                      // 同 show 但可重复触发
this.toolkit.island.close('user');                        // 强制收起
```

`size` 取值：

| size | 形态 | 适用 |
|---|---|---|
| `mini` | 单行小药丸 | 轻提醒 / 状态 |
| `medium` | 圆角矩形 + 图标 + 标题 + 副标题 | 任务进行中 |
| `large` | 大面板 | 复杂状态详情 |

**自定义 HTML 模板**：在 `window.islandTemplates` 注册（`src/index.js` 里已经初始化），可写任意 HTML 字符串，框架会用 `v-html` 注入。**模板里若含用户数据，仍需 escape**。

---

## 7. Widget（桌面小组件）

### 7.1 App 提供 widget

在 `appConfig.widgets` 里挂数组，**每个 widget 至少包含**：

```js
{
    id: 'quick-counter',                  // 在 App 内唯一即可
    label: '计数器',
    icon: '<svg>...</svg>',
    iconBg: '#222',
    defaultSize: 'S',                     // 'S'(2x1) | 'M'(2x2) | 'L'(4x2)
    defaultOrientation: 'h',              // S 时 'h'(2x1) 或 'v'(1x2)
    render(size, payload) {               // 桌面缩略渲染；payload.label/icon/...
        const safeLabel = escapeHtml(payload.label);
        return `<div class="p-2">${safeLabel}</div>`;
    },
    renderItem(size, payload) {           // 可选，跟 render 一致即可
        return this.render(size, payload);
    },
    onTap() {                             // 点击 widget 触发的回调（可选）
        // 一般这里发 deepLink 到自己
    },
}
```

`render` 拿到的 `payload` 长这样：

```js
{
    size: 'S',
    orientation: 'h',
    label: '...',
    icon: '...',
    iconBg: '...',
    qualifiedId: 'todo::quick-counter',   // appId::widgetId
    instanceId: 'wb-xxxxxxxx',            // 桌面唯一实例 id
}
```

### 7.2 添加到桌面

- 用户流程：长按桌面任意位置 → 进入编辑模式 → 点灵动岛 → 弹出 widget 选择面板 → 点击要添加的 widget。
- 框架会自动：
  1. 给 widget 加 `instanceId`。
  2. 持久化到 IndexedDB（`widgetBoardRecords` 表，`__widgetBoard__` 键）。
  3. 渲染到桌面对应网格 slot。
- `instanceId` 是 widget 在桌面上的「身份」，删除时按 instanceId 移除。

### 7.3 widget 的安全约束

`render(size, payload)` 的返回值**直接被 `v-html` 注入**（见 `index.html:197` 的 `v-html="renderWidgetBody(item.widget, item.footprint)"`），所以：

- ❌ 不要把任何「用户输入 / 第三方数据」直接塞进 widget HTML。
- ✅ 任何不确定来源的字段先 `escapeHtml`。
- widget 的 `icon` / `label` 是开发者写定的，可以信任，但**如果允许用户自定义 widget label/icon，要把字符串 escape 之后再插入**。

---

## 8. 把 App 注册到系统（**最重要**）

### 8.1 三步走

1. **在 `js/apps/` 下新建 `my-app.js`**，按 §2 的原型写一个 default export 工厂函数。
2. **在 `js/apps/index.js` 静态 import + 加进 `appFactories` 数组**：

   ```js
   // js/apps/index.js
   import createMyApp from './my-app.js';

   const appFactories = [
       // ... 已有 ...
       { name: 'my-app', factory: createMyApp },
   ];
   ```

3. **刷新浏览器**。桌面会出现新 App 图标，不需要改 `index.html`、不需要改 `src/index.js`。

### 8.2 工厂函数的两种 return 形式

```js
export default function createMyApp() {
    return appConfig;                // 单 App
    // 或者
    return [appConfig, appConfig2];  // 多 App（少见，参考 placeholder-apps.js）
}
```

`js/apps/index.js` 的循环逻辑会处理这两种：

```js
const configList = Array.isArray(configOrList) ? configOrList : [configOrList];
for (const config of configList) registerPhoneApp(config);
```

### 8.3 单文件 build 的额外注意

`npm run build:single` 用 `vite-plugin-singlefile` 把全部 ESM 合到**一个 HTML**。只要：

- App 文件是**静态 import**（动态 `import()` 会被 inline，但要小心 chunk 边界）。
- App 文件本身**没有运行时 `fetch`**（这是单文件，单文件离线，CDN/外链都会失效）。
- 没有用到 `js/vendor/` 之外的新 vendor。

### 8.4 不需要改的地方

- ❌ 不需要改 `index.html`。
- ❌ 不需要改 `src/index.js`。
- ❌ 不需要手动 `import` App 到页面。
- ❌ 不需要手动 `registerPhoneApp` —— `js/apps/index.js` 会代劳。

> 但如果你写的是「**仅供调试**」或「**永远不应该出现在产品里**」的 App（比如 `placeholder-apps.js`），可以单独维护一个 import 入口，或干脆用环境变量隔离。框架目前没有 dynamic import，统一走静态。

---

## 9. 调试与常见坑

| 现象 | 原因 / 处理 |
|---|---|
| 桌面看不到 App | 没在 `js/apps/index.js` 加 import；或者 `registerPhoneApp` 之前抛错导致循环中断。打开 console 看 `[apps/index] 已注册 app: xxx (N 个)` |
| App 图标 / 名字没更新 | 检查 `externalAppRegistry`：`window.refreshPhoneApps?.()` 会强制刷新，注册新 App 时框架已经自动调用 |
| 点击按钮没反应 | HTML 上没加 `data-app-action`；或 JSON 拼错；或派发的事件名不是 `app:page-action`（用 framework 的 helper 就不会出错）|
| 灵动岛没出来 | `toolkit.island.show` 后没有 UI 变化？检查 `src/index.js` 里 `window.islandTemplates = createIslandTemplates()` 是否执行；检查 `use-dynamic-island.js` 是否有报错 |
| IndexedDB 报错 `未声明的数据表` | 在 `appConfig.stores` 里声明 `name` 和 `keyPath` |
| widget 添加失败 | App 没在 `widgets` 里挂；或 widget id 重复；或 `render` 不是函数 |
| `v-html` 后样式没生效 | 类名拼错；或 Tailwind JIT 没扫到字符串里的类名（动态拼接的类名要保证字面量里完整出现）|
| XSS 警告 | 你忘了 `escapeHtml` 用户输入 / 第三方字段，参考 §5 |

---

## 10. 给「AI 编程助手」的合作约定

如果你是来给本项目加新 App 的 AI，请遵守：

1. **不要改 `index.html` 和 `src/index.js`** 来注册 App。所有 App 注册走 `js/apps/index.js` 的 import 数组。
2. **优先 ESM 静态 import**，不要用动态 `import()`、不要写 IIFE / 全局变量。
3. **任何用户输入 / 数据库读出来的字符串** 在拼 HTML 之前必须 `escapeHtml`（`@/src/core/escape.js`）。
4. **不要自己起一套生命周期**：用 `setup()` 初始化 state，用 `methods` 处理交互，用 `services` 暴露对外能力，用 `renderPage` 渲染页面。
5. **保持视觉风格**：iPhone 风格、柔和、毛玻璃、圆角。**不要** 用自己的 CSS reset 把现有体系覆盖掉；新 CSS 类请加在 `css/main.css` 里并取语义化命名。
6. **不要写 `target="_blank"` 不带 `rel="noopener noreferrer"`**。
7. **不要在 App 里直接 `window.location = ...`**；跳转 / 打开另一个 App 走 `createOpenAppAction(...)` 或 `toolkit.actions.openApp(...)`。
8. **不要持久化敏感数据到 IndexedDB**（密码、token 等）；本项目 IndexedDB 仅用于业务记录（todo / 设置 / widget 桌面 / sharedRecords 等）。
9. 写 widget 时务必自己 escape payload 字段；framework 不替你 escape。
10. 新增数据表务必在 `appConfig.stores` 里声明，并在 `js/db/base-stores.js` 或新建 stores 文件里 `registerStore(name, keyPath)`（参考 `js/db/base-stores.js` 的写法）。

---

## 11. 附录：完整注册一个 App 的最小模板

```js
// js/apps/hello.js
import { createActionAttr } from '@/src/core/actions.js';
import { escapeHtml } from '@/src/core/escape.js';

export default function createHelloApp() {
    return {
        id: 'hello',
        name: '你好',
        icon: `
            <svg viewBox="0 0 60 60" width="60" height="60" xmlns="http://www.w3.org/2000/svg">
                <rect width="60" height="60" rx="14" fill="#10b981" />
                <text x="30" y="38" font-size="24" text-anchor="middle" fill="white" font-family="-apple-system">Hi</text>
            </svg>
        `,
        iconBg: 'linear-gradient(145deg, #10b981, #06b6d4)',
        background: 'linear-gradient(180deg, #ecfeff, #ffffff)',
        statusBarColor: '#064e3b',
        dock: { visible: true, order: 99 },

        topbar: { visible: true, title: '你好 App', subtitle: '一个最小范例' },
        nav: { type: 'tab' },
        pages: [
            { id: 'main', label: '主页', icon: '◦', nav: true },
        ],
        defaultRootPageId: 'main',

        setup() {
            return { message: 'Hello, world!' };
        },

        methods: {
            greet() {
                this.app.state.message = 'Hi from method!';
                this.toolkit.island.notify('success', '已更新', this.app.state.message);
                window.refreshPhoneApps?.();
            },
        },

        renderPage(content, page, app) {
            const msg = escapeHtml(app.state?.message || '');
            const action = createActionAttr({ action: 'appMethod', method: 'greet' }, app.id);
            return `
                <div class="space-y-3">
                    <section class="app-card bg-white/76">
                        <div class="text-[20px] font-bold text-slate-900">${msg}</div>
                        <div class="mt-2 text-sm text-slate-600">点击按钮调用 methods.greet()</div>
                        <button class="detail-link !mt-3" ${action}>
                            <span>打个招呼</span><span>›</span>
                        </button>
                    </section>
                </div>
            `;
        },
    };
}
```

然后在 `js/apps/index.js`：

```js
import createHelloApp from './hello.js';
// ...
const appFactories = [
    { name: 'prompt-survey', factory: createPromptSurveyApp },
    { name: 'framework-test-app', factory: createFrameworkTestApp },
    { name: 'placeholder-apps', factory: createPlaceholderApps },
    { name: 'hello', factory: createHelloApp },   // ← 新增
];
```

刷新浏览器，桌面上就有「你好」图标了。

---

最后：如果读到这里仍有疑问，按优先级排查：
1. `src/core/app-registry.js` —— App 怎么被规范化进系统。
2. `js/framework/use-app-navigation.js` —— action 事件怎么派发到 App。
3. `js/apps/prompt-survey.js` —— 一个完整的、几乎覆盖所有功能的范例。