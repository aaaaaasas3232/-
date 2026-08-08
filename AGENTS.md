# AGENTS.md — 小听启动 项目指引

> 给「AI 编程助手 / 新加入开发者」的项目入门手册。
> 读完后应能独立回答:项目用什么语法、App 长什么样、新 App 怎么接入、XSS 怎么防、widget 怎么挂、灵动岛怎么调、Dock 怎么改。

---

## 0. 一句话总览

**小听启动** 是一个跑在浏览器里的「iPhone 风格模拟器」:

- 入口 `index.html` → `src/index.js` → 自动把 `js/apps/*.js` 里所有 App 注册到桌面。
- 桌面 / App 窗口 / 灵动岛 / 小组件 / IndexedDB 都由同一套 Vue 3 + ESM 框架驱动。
- 业务 App 都是 **纯 ESM 文件**,只通过 `registerPhoneApp({...})` 这一个口子接入。
- **v0.28**:框架在启动时 fire-and-forget 预热 `settings-sdk`,chat/weather 等依赖 SDK 的 app 无需先打开 settings 即可秒渲染真实数据。详见 §19。
- **v0.30**:chat-app 支持真实发送文字消息(IndexedDB 持久化 + 消息列表预览就地更新);同时修了 `ListenDb._doOpen` 的 `close() → null.version` bug(详见 §16.26 + chat迁移/README.md v0.30 段)。
- **v0.37**:故事模式顶栏标题从「消息」→「Dream」+ 粉色;同时修 framework `switchRootPage` 调不存在函数 `buildMessagesHeaderActions()` 的 ReferenceError,并把 v0.28「防泄漏」短路改成「只忽略 override.headerActions、合并其他字段」(详见 chat迁移/README.md v0.37 段 + §16.4 沉淀)。
- **v0.61.7**:prompt-manager「当前上下文」拖拽 / 启用按钮立即生效(不用按刷新)。两条坑:① async detail renderer 的 cache 不会被 ++tick / syncNow 单清,必须 `invalidateRendererCache(appId, null)` + `bridge.syncNow({force:true})` 二段式;② drag handler `_endDrag()` 把 `dragState.container` 清成 null,`_commitReorder()` 永远拿到空,reorderContextPrompts 从未被调(详见 chat迁移/README.md §v0.61.7)。
- **v0.61.7.3**:prompt-manager「保存生效、顺序不生效」+ `systemPromptOverrides` 丢失补丁。三条新坑:① `systemPromptOverrides` 写到 localStorage 但 hydrate 不读回;② `state.chat.contextOrder` 只在内存,刷新后顺序回退;③ SDK `replyPrompts.setOrder` 只持久化 replyPrompts 自己的顺序,`system-*` / `context-rounds` / `nook-world-*` 等虚拟卡片的位置变化只能靠 `contextOrder`,但没持久化;附加 Bug:④ `renderPromptControlCard` 漏写 `pm-card` 类 → drag-controller 选不到 system/world/library 等卡;⑤ `reorderContextPrompts` / `savePromptManagerChanges` 走 `nookSdk.prompts.reorder` → 写到 `aiPerson.nookPrompts`,跟所有 toggle/edit/delete/move 操作的 `sdk.replyPrompts` 是两套数据(详见 chat迁移/README.md §v0.61.7.3 + §28/§29/§30)。
- **v0.61.8.10**:prompt-manager「拉取按钮灰态」+「启停不消失」恶性 bug 修复。① 库区拉取按钮从「变成对勾」改成「disabled 灰态 + 文案「已拉取」」(用户原话「必须变灰防止反复拉取」),`<button disabled>` 浏览器原生拦截 click → framework 派发自动失效;② `pulledFromLibrary` 过滤逻辑三次翻车:`inactiveList` 漏 active=true → `filter(sourceLibraryPromptId)` 漏普通自定义 prompt → 最终 `replyPromptsList.slice()` 全集(跟其他 prompt 区域对齐);③ 拉取后 `__detailRenderTick.value++` 在 async renderMode 缓存命中时不重画 → 改 `invalidateRendererCache` + `bridge.syncNow({ force: true })` 二段式(AGENTS.md §27 + §32 沉淀的「禁止 ++tick」)。详见 chat迁移/README.md §v0.61.8.10 + §31/§32/§33。
- **v0.62.x**:prompt-manager「Murmur 组新增「回复格式与聊天风格」卡」+ 短句聊天风格注入。① 在「可用 Prompt → Murmur 折叠组」里「当前聊天回合」卡下面**新增一张与「当前聊天回合」同款 UI** 的卡,内容是「回复格式 + 短句聊天风格」指令;② 用户原话「这个直接改成回复格式提示」+「再包括让ai聊天的时候一般不要长句 分成短句」;③ 「回复格式」从 prompt-builder 末尾的 `SPECIAL_ACTIONS_HELP` 抽出来,跟 `REPLY_STYLE_INSTRUCTIONS`(短句风格)合并,以 `opts.replyFormatInject.enabled` 开关控制是否注入;④ 第一次踩坑:新增卡只渲染在「可用 Prompt → Murmur」,但 `systemActiveItems`(当前上下文区要展示的「虚拟系统级卡」)没 push `reply-format` → 「当前上下文」区看不到对应卡片,预览区能看到(preview 是直接拼 SPECIAL_ACTIONS_HELP + REPLY_STYLE_INSTRUCTIONS) → 看似「启用了但没起作用」恶性 bug。⑤ AI SDK 集成侧(ai-service.js)是 service 层,没有 `app.state` 引用,走 localStorage 同步读 `xiaoting::chat-reply-format-inject-v1` 兜底(同 hydrate 路径)。详见 chat迁移/README.md §v0.62.x + §34/§35/§36。
- **v0.63.2**:prompt-manager「K 链 toggle 卡死 + 关闭按钮失效」恶性 bug 修复。① Murmur 组里 K 链控制卡 `renderKChainGroupItem` 渲染的 segmented-tabs「关闭 / 启用」**不论怎么点都卡在启用**(灵动岛通知正确显示「已停用」,但视觉状态不变)—— 子函数 `renderAppPromptGroupSection` 解构时加了 `kChainInjected = true`(默认兜底),但 `ctx` 里**根本没有 `kChainInjected` 这个 key**,解构出来永远是默认值 `true` → Murmur 卡 `active` 永远是 `true`。② 关闭按钮按了 K 链卡「K 链摘要 (空内容)」**还留在当前上下文区**—— `systemActiveItems.push` 条件用了 `kChainVisible`(只看总开关),不是 `kChainActive`(总开关 && 个人 toggle)。③ 修复:`renderAppPromptGroupSection` 去掉 `kChainInjected` 别名,Murmur 卡 `active: kChainActive`,`systemActiveItems.push` 条件改 `if (kChainActive)` —— Murmur 组可见性仍由 `kChainVisible`(总开关)控制,卡上 toggle + 当前上下文可见性都由 `kChainActive` 控制。详见 chat迁移/README.md §v0.63.2 + §36。
- **v0.63.3**:prompt-manager「当前上下文预览 `<pre>` 末尾重复两段『回复格式与聊天风格』」修复。① 根因:`orderedCards` 已经从 `systemActiveItems.push(reply-format)` 把内容拼到 `previewParts`,但 `previewParts` 末尾又兜底 push 了一次 `SPECIAL_ACTIONS_HELP + REPLY_STYLE_INSTRUCTIONS`,导致 `<pre>` 里出现两份几乎一模一样的特殊消息格式 + 短句聊天风格 —— 而且因为兜底 push 在最尾巴,用户**怎么拖拽顺序都看不到变化**(reply-format 卡拖到最前面,pre 末尾仍是兜底那两份)。② 修复:删掉 `previewParts` 末尾的兜底 push,只让 `orderedCards` / `systemActiveItems` 做 single source of truth。详见 chat迁移/README.md §v0.63.3 + §34「注意『当前上下文顶部预览 pre』不要重复 push」。
- **v0.66**:「日历视图 → 层级管理 → Prompt 管理」三级联动完成。① 日历 prompt 模板新增 `{{aiName}}` / `{{userName}}` / `{{dateRange}}` / `{{messages}}` 占位符,生成概要时自动从 SDK 替换;② 日历日详情 `cdd-summary-content` 显示已生成的 L1 概要,每条带「应用到 Prompt 管理」按钮;③ 「层级管理历史信息页 → 日概要」tab 下新增可滚动 div,显示「【日期】概要内容 [应用到prompt管理]」条目;④ 概要进 prompt-manager 后进 Murmur 组,带**层级徽章**(L1/L2/L3/L4)+ toggle 启用/关闭 + 删除按钮,删除走顶层确认弹窗 + SDK 软删;⑤ `sdk.memorySummaries.list` 返回的「deleted=true」记录不出现在 Murmur 组,本次生成的概要默认 active=true;⑥ `prompt-builder` 新增 `memorySummaryInjectOverride` 临时屏蔽用户在 prompt-manager 关闭的概要(不写盘,只影响本次 AI 调用);⑦ 三段式持久化:app.state.chat.memorySummaryInject 走 localStorage `xiaoting::chat-memory-summary-inject-v1`,hydrate 时读回。详见 chat迁移/README.md §v0.66 + §38。
- **v0.66.1**:日历日详情「生概要」modal `initialContent` 误填 prompt 模板 + 「未配置 API Key」bug 修复。① `chat-modal-registry.openSummaryEdit` 之前 v0.65.1 加了 `mergedContent = promptPrefix + initialContent` 拼接,目的是让用户能改 prompt 模板;v0.66 重构后,textarea 只该显示 AI 概要正文,prompt 必须**内部传给 AI、不透到 textarea** → 改成 `initialContent` 原值直传(空串)。② `_generateDaySummary` 用 `apiSdk.listKeys()`,但 `window.__apiSdk` 实际暴露的是 `{apiKeySdk, apiGroupSdk, apiUsageSdk}`,**没有 listKeys 方法** → 改成 `apiKeySdk.listEnabled()[0] || apiKeySdk.list()[0]` + console.warn 兜底。③ `summary-edit-modal.js` 的模块级 `let _currentSummaryEditInstance` 在 `index.js` 直接引用报 `ReferenceError` —— 因为 ESM 模块局部变量跨文件不可见 → 改成通过 `window.__currentSummaryEditModal` 全局注册(避免 ESM 子模块访问问题),并 `export { _getCurrentSummaryEditInstance }` 让 `index.js` 通过 import 访问。详见 chat迁移/README.md §v0.66.1 + §39 + §40。

```bash
npm install
npm run dev         # vite dev server, http://localhost:5173
npm run build       # 多文件产物 → dist/
npm run build:single # 单文件 HTML(vite-plugin-singlefile)→ dist-single/
```

---

## 1. 模块语法与项目结构

### 1.1 强制 ESM

`package.json` 里有 `"type": "module"`,所有 `.js` 文件按 ESM 解析:

- 用 `import` / `export`,不要 `require` / `module.exports`。
- 路径别名 `@` 指向项目根(`vite.config.js` 有 `alias`)。

### 1.2 真实目录结构

```
小听启动/
├── index.html                  # 单一 HTML 入口(Vue 模板 + 灵动岛模板)
├── src/
│   ├── index.js                # Vite 入口:拼装 framework / apps / db
│   ├── core/                   # 给 App 用的核心 SDK(纯 ESM)
│   │   ├── actions.js          # 动作系统:detail / openApp / appMethod / ...
│   │   ├── app-registry.js     # registerPhoneApp / registerPhoneAppAsync 实现
│   │   ├── app-toolkit.js      # 每个 App 拿到的 toolkit 工厂
│   │   ├── app-renderer.js     # 三模式渲染调度器
│   │   ├── app-renderer-registry.js  # island 组件内部注册表
│   │   ├── app-installation.js # 系统级 vs 可下载 App 的安装状态机
│   │   ├── dock-config.js      # Dock 栏布局持久化(visible / order)
│   │   ├── island-components.js # 内置 island 组件(toggle / slider / ...)
│   │   ├── island-helper.js    # App 侧灵动岛 helper(show / toggle / notify / ...)
│   │   ├── island-templates.js # 灵动岛模板(目前只有 music)
│   │   ├── store-api.js        # App 的 IndexedDB API + 共享记录 API
│   │   ├── escape.js           # XSS 防线(escapeHtml / normalizeTextList / renderTextBlock)
│   │   ├── renderers.js        # 通用 HTML 片段渲染器
│   │   ├── templates.js        # appTemplates 注册表 + 内置 7 个模板
│   │   ├── page-renderers.js   # 默认页面 / 详情页渲染器
│   │   ├── icons.js            # APP_ICONS / UI_ICONS / UI_TOKENS / UI_SYMBOLS
│   │   ├── icon-library.js     # 全局图标库 + createSettingsPageBuilder
│   │   └── mood.js             # 心情预设与配色工具
│   └── apps/
│       └── template-app.js     # 模板 App,所有业务 App 都参考这个
├── js/
│   ├── apps/                   # 所有真实业务 App
│   │   ├── index.js            # 静态 import + appFactories 数组
│   │   ├── prompt-survey.js    # App 制作问卷
│   │   ├── prompt-survey-glossary.js  # 问卷术语词典(被 prompt-survey 引用)
│   │   ├── weather-app.js      # 天气
│   │   ├── focus-app.js        # 专注计时器
│   │   ├── appstore.js         # App Store(distribution 系统)
│   │   └── setting/            # 设置 App(超大规模,内部按模块拆)
│   ├── framework/              # 桌面 / 灵动岛 / App 窗口(Vue composition)
│   │   ├── index.js            # re-export 入口
│   │   ├── core-shim.js        # 拼装 systemData Vue app 并 mount 到 #phone
│   │   ├── app-renderer-bridge.js  # framework ↔ app-renderer 三模式桥接器
│   │   ├── utils.js            # UI_CONSTANTS / 状态工厂 / 关闭原因枚举
│   │   ├── use-system-clock.js # 每秒更新的 systemTime ref
│   │   ├── use-dynamic-island.js  # 灵动岛核心:show / close / 替换栈 / 生命周期
│   │   ├── use-app-navigation.js   # activeApp / activeRootPageId / 详情栈 / 模态框
│   │   ├── use-desktop-edit.js     # 桌面编辑模式(长按 / 拖拽 / swipe 翻页)
│   │   ├── use-card-mode.js        # App ↔ 卡片模式切换手势
│   │   └── use-widget-picker.js    # 小组件选择浮层
│   ├── db/                     # IndexedDB
│   │   ├── engine.js           # ListenDb 类(动态 store 注册)
│   │   ├── base-stores.js      # 主库 listen_db 的 24 张表
│   │   ├── music-stores.js     # 音乐库 listen_music_db 的 4 张表
│   │   └── index.js            # 创建两个实例挂到 window
│   ├── components/             # 通用 Vue 组件
│   │   ├── color-picker.js
│   │   └── color-picker-auto.js  # 自动 mount [data-cp-mount] 节点
│   └── vendor/
│       └── vue.global.prod.js  # Vue 3 全局构建(由 index.html 直接 <script> 引入)
├── css/                        # 全局样式(由 index.html 引入)
│   ├── main.css                # 桌面 / 卡片 / 灵动岛 / 通用 UI
│   ├── settings.css            # 设置 App 专用
│   ├── gallery.css             # 图库 App 专用
│   ├── color-picker.css
│   ├── survey.css              # App 制作问卷专用
│   ├── weather-app.css
│   ├── appstore.css
│   └── music-island.css        # 灵动岛音乐模板专用(动态注入)
├── public/                     # 静态资源(favicon 等)
├── vite.config.js              # 多文件构建配置
├── vite.config.single.js       # 单文件构建配置
└── AGENTS.md
```

> ⚠️ 历史上曾出现过 `test-debug/`、`scripts/` 两个空目录,以及 `js/framework/use-dynamic-island.js.bak` 备份文件,均已清理。当前项目不应再有任何 `.bak` / `test-debug` / 临时调试脚本。

---

## 2. App 的原型

### 2.1 一个 App 是什么

每个 App 是 default exported 工厂函数,返回 `appConfig`:

```js
export default function createMyApp() {
    return {
        id: 'my-app',                // 必填,全局唯一
        name: '我的 App',             // 桌面显示名
        icon: `<svg>...</svg>`,      // 桌面 icon
        iconBg: 'linear-gradient(...)',
        // 可选:App 自己的背景(用于 App 窗口打开时的容器背景)
        background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        statusBarColor: '#111827',
        homeIndicatorColor: 'rgba(17,24,39,0.28)',
        // 顶栏(6 种 type:standard / title-only / search / segmented / large-title / buttons-only)
        topbar: { visible: true, title: '...', subtitle: '' },
        // 声明 IndexedDB 表
        stores: [
            { name: 'myAppRecords', keyPath: 'id' },
        ],
        // 页面系统
        pages: [
            { id: 'home',     label: '首页', icon: '◦', nav: true },
            { id: 'detail-x', type: 'detail' },  // 详情页不出现在 tab bar
        ],
        defaultRootPageId: 'home',
        // 页面 / 详情内容(可选,framework 会用默认渲染器渲染)
        pageContent: { home: { blocks: [...] }, 'detail-x': { paragraphs: [...] } },
        // 业务方法(framework 注入 context:this.app / this.toolkit / this.services)
        methods: {
            greet() { this.toolkit.island.notify('success', 'Hi'); }
        },
        // 灵动岛小组件(可选)
        widgets: [ { id, label, icon, iconBg, size, orientation, render, onTap } ],
        // 渲染模式(三选一,默认 'template')
        renderMode: 'template',
        // renderPage(content, page, app):string — 自定义页面 HTML
        renderPage(content, page, app) { ... },
    };
}
```

### 2.2 renderMode:三种渲染模式

| 模式 | `renderPage` 返回 | 适用 |
|---|---|---|
| **template**(默认)| HTML 字符串 | 旧 App / 纯静态 App / 用内置模板拼装 |
| **hybrid** | HTML 字符串 + `<component-island name="..." />` | 半交互 App(80% 的业务场景) |
| **vue** | Vue 组件配置 | 状态复杂、需要响应式交互 |

### 2.3 ⚠️ renderPage 内部不能用 this

framework 渲染管线:

```js
const renderer = activeApp.value.renderPage || createDefaultPageRenderer;
return renderer(content, page, app) || '';
```

**`renderPage` 是从对象上拿出来当独立函数调用的,this 已经丢失。**

- ✅ 把渲染逻辑拆成**模块顶层函数**,renderPage 只做路由分发
- ❌ 不要在 renderPage 内部用 `this.xxx(...)`
- **methods 里的 this 是有的**(framework 注入了 context),所以 methods 里 `this.app.state` 没问题
- vue 模式(§2.5)不受影响:组件内的 `this` 是 Vue 的代理

**反面教材(已修复)**:

```js
// 错
renderPage(content, page, app) {
    return this.renderHomePage(app);
}

// 对
renderPage(content, page, app) {
    return renderHomePage(app);  // 顶层函数
}
```

### 2.4 template 模式

renderPage 返回纯 HTML 字符串。framework 用 `v-html` 注入。

**适合的 App**:`prompt-survey.js`、`weather-app.js`、`focus-app.js` 都是这种模式。
**快速拼页面**:用 `appTemplates.render('hero', {...})` / `'info-list'` / `'quick-actions'` / `'profile-hero'` / `'group-list'` / `'share-card'` / `'glass-action-card'` / `'settings-note'` 这 8 个内置模板,详见 `src/core/templates.js`。

### 2.5 hybrid 模式

renderPage 返回 HTML 字符串,**可以嵌入** `<component-island name="..." />` 标签:

```html
<section class="app-card">
    <component-island name="toggle" label="Wi-Fi" :value="true"></component-island>
    <component-island name="slider" label="亮度" :min="0" :max="100" :value="70"></component-island>
</section>
```

framework 在 v-html 完成后**扫描这些标签**,把每个替换成 `<div class="island-mount" />`,然后 `Vue.createApp()` 挂载真组件到这个 div。

**属性语法**:
- `label="昵称"` —— 字符串属性
- `:value="true"` —— 布尔 / 数字(带冒号表示 JS 表达式字符串)
- `:options='[{"value":"a","label":"A"}]'` —— JSON 数组(单引号包 JSON)

**内置 island 组件**:`toggle` / `slider` / `input` / `textarea` / `select` / `list` / `counter`(详见 `src/core/island-components.js`)。

**业务组件注册**:`registerIslandComponent('my-card', componentConfig)` 后,hybrid App 里就能用 `<component-island name="my-card" />`。

### 2.6 vue 模式

renderPage 返回**完整的 Vue 组件配置**,整块挂载成 Vue app:

```js
renderPage(content, page, app) {
    if (page.id === 'counter') {
        return {
            props: { app: Object, page: Object },
            data() { return { count: 0 }; },
            computed: { double() { return this.count * 2; } },
            methods: { inc() { this.count++; } },
            template: `
                <div>
                    {{ count }} <button @click="inc">+</button>
                </div>
            `,
        };
    }
}
```

**framework 自动注入 props**:组件通过 `props.app` / `props.page` 访问当前 app 和 page 配置。

---

## 3. 动作系统(actions)

App 内容是 `v-html` 出来的纯 HTML,所有点击/输入走 **action attribute**:

```js
import { createActionAttr } from '@/src/core/actions.js';

// 调自己的方法
createActionAttr({ action: 'appMethod', method: 'greet' }, app.id)
// → data-app-action='{"action":"appMethod","appId":"my-app","method":"greet"}'

// 进细节页
createActionAttr({ action: 'detail', pageId: 'install-guide' }, app.id)

// 跳另一个 App
createActionAttr({ action: 'openApp', targetAppId: 'prompt-survey' }, 'my-app')
```

**所有 action 类型**(见 `src/core/actions.js`):

| 函数 | action 类型 | 用途 |
|---|---|---|
| `createDetailAction(pageId, appId)` | `detail` | 打开 App 内详情页 |
| `createOpenAppAction(targetAppId, pageId, payload)` | `openApp` | 跳另一个 App |
| `createAppMethodAction(method, payload, appId)` | `appMethod` | 调自己的 methods |
| `createModalAction(modalType, payload, appId)` | `modal` | 弹模态框 |
| `createDeepLinkAction(target, pageId, payload)` | `deepLink` | 带负载的跨 App 跳转 |
| `createShareRecordAction(targetApp, entityType, entityId, payload)` | `shareRecord` | 写共享记录到 IndexedDB |

事件流向:HTML `data-app-action` → JSON 解析 → `app:page-action` CustomEvent → `useAppNavigation` 派发。

---

## 4. App Toolkit

每个 App 通过 `this.toolkit.xxx` 访问:

| 字段 | 类型 | 用途 |
|---|---|---|
| `toolkit.island` | `IslandHelper` | 灵动岛:show / toggle / notify / dismiss / setCallbacks / startIdleTimer |
| `toolkit.db` | `AppDbApi` | IndexedDB:add / get / getAll / put / remove / clear / bulkPut |
| `toolkit.shared` | `SharedStoreApi` | 跨 App 共享记录(put / get / listByTarget) |
| `toolkit.templates` | `TemplateRegistry` | appTemplates.render('hero', {...}) |
| `toolkit.actions` | `ActionFactory` | detail / modal / method / openApp / deepLink / share |
| `toolkit.icons / uiIcons / uiSymbols / iconLibrary / tokens` | 图标 | 全局图标库 |
| `toolkit.renderers` | `renderers.js` | renderActionButton / renderChevronRow / renderSettingsGroup / renderSurfaceCard / renderSectionShell |
| `toolkit.builders.settings` | `SettingsPageBuilder` | detail / modal / method / row / group |
| `toolkit.app` | `appConfig` | 反向引用当前 app |

声明数据表:

```js
{
    id: 'todo',
    stores: [
        { name: 'todoItems', keyPath: 'id' },
    ],
}
```

---

## 5. XSS 防护(必读)

因为 `renderPage` 返回的字符串会经过 `v-html` 注入,任何「用户输入 / 动态数据」必须先 escape。

```js
import { escapeHtml, renderTextBlock } from '@/src/core/escape.js';

escapeHtml('<script>alert(1)</script>')
// → '&lt;script&gt;alert(1)&lt;/script&gt;'
```

| 数据 | 处理 |
|---|---|
| 用户填的文本 | **必** `escapeHtml(value)` |
| 数据库读出来的字符串字段 | **必** `escapeHtml` |
| URL(href/src)| **必** 校验协议 + `encodeURIComponent` |
| icon / 模板里固定的 SVG | 不需要 escape(开发者写的,受信任)|

**App 写数据库时**就用 plain object 写,framework 不强制 escape 写入(因为读取时也要 escape,合理分工)。

### widget 的安全约束

`render(size, payload)` 返回值**直接被 v-html 注入**,所以:

- ❌ 不要把任何「用户输入 / 第三方数据」直接塞进 widget HTML
- ✅ 任何不确定来源的字段先 `escapeHtml`

---

## 6. 异步 API 调用规范(必读)

任何调用**外部 HTTP API**(OpenAI / Anthropic / Gemini 兼容、自建 LLM 网关、第三方云服务等)并**等待返回内容**的代码,**必须使用 `async/await`**,**禁止**使用 `.then().catch()` 链式调用,也**禁止**用任何阻塞式同步写法(如 `XMLHttpRequest` 同步模式、`require('sync-fetch')` 等)。

### 6.0 为什么强制 async/await

- **AI 回复通常要 1~30 秒**,阻塞主线程会让整个手机模拟器冻结:灵动岛不滚动、tab 切不动、长按无响应。
- `.then().catch()` 不会阻塞主线程,但**调用者拿不到 Promise**,无法 `await` 后续逻辑,容易出 race condition 或吞掉异常 —— 出 bug 后排查很痛苦。
- `async/await` 是统一风格,栈追踪友好,后续维护者一眼能看清流程。

### 6.0.1 强制约束清单

| 场景 | 要求 |
|---|---|
| 调用 LLM / 外部 API 的 method | method 必须 `async`,函数体里用 `await fetch(...)` |
| 工具函数封装 API 调用(如 `callAiRaw`) | 必须 `async`,返回 `Promise<string>` |
| `fetch().then().catch()` 链式调用 | **禁止**,改成 `try { const r = await fetch(...) } catch { ... }` |
| 在 `for` 循环里串行调用多个 API | 用 `for...of` + `await`,**不要** `forEach` + `.then`(后者无法保证顺序) |
| 同时调用多个 API | 用 `Promise.all([...])`,**不要**手动 await 串行 |
| API 超时控制 | 必须传 `signal: AbortSignal.timeout(ms)` 或自建 `AbortController` |
| 解析响应体 | `await resp.json()` 必须包 `try/catch`,AI 返回空 / 非法 JSON 时不能崩 |

### 6.0.2 模板

```js
// ✅ 正确:method 标记 async,内部 await fetch + try/catch
async myAiMethod(payload) {
    const sdk = window.__apiSdk;
    const key = sdk?.apiKeySdk?.get(payload.keyId);
    if (!key?.apiKey) return null;

    this.toolkit?.island?.notify?.('info', 'AI 生成中…', key.label);
    const start = Date.now();

    let resp;
    try {
        resp = await fetch(key.baseUrl + '/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key.apiKey}` },
            body: JSON.stringify({ model: key.model, messages: [{ role: 'user', content: payload.prompt }] }),
            signal: AbortSignal.timeout((key.timeout || 60) * 1000),
        });
    } catch (err) {
        this.toolkit?.island?.notify?.('error', '网络错误', err?.message);
        return null;
    }

    if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        this.toolkit?.island?.notify?.('warning', `HTTP ${resp.status}`, txt.slice(0, 120));
        return null;
    }

    try {
        const data = await resp.json();
        return data?.choices?.[0]?.message?.content || '';
    } catch (err) {
        this.toolkit?.island?.notify?.('warning', 'AI 返回不是合法 JSON');
        return null;
    }
}

// ❌ 禁止:.then().catch() 链式(就算函数不阻塞,也不允许)
myAiMethod(payload) {
    fetch(...).then(r => r.json()).then(d => { ... }).catch(e => { ... });
}
```

### 6.0.3 实际范例

- ✅ `js/apps/setting/api-manager/api-key-sdk.js` —— `executeApiRequest()` 是 `async`,内部 `await fetch(...)` + `await response.json()`。
- ✅ `js/apps/setting/api-manager/api-manager-methods.js` —— `apiTestKey()`(重构后)`async`,内部 `await fetch(...)` + try/catch。
- ✅ `js/apps/setting/api-manager/api-manager-section.js` —— `_fetchModels()` 是 `async`。
- ✅ `js/apps/setting/persona/space-ai.js` —— `callAiRaw()` 是 `async`,返回 `Promise<string>`。
- ✅ `js/apps/setting/persona/methods.js` —— `personaAiFillVariant()` 是 `async`,内含 `await fetch(...)`。
- ✅ `js/apps/setting/persona/home-methods.js` —— `personaGenerateMood()` / `callMoodApi()` 都是 `async`。

### 6.0.4 历史踩坑(防止再犯)

2026-08-03 改造记录:

- `api-manager-methods.js` 的 `apiTestKey` 原先用 `fetch().then().catch()` 链式调用,虽然不阻塞主线程,但**调用者拿不到 Promise**、**异常处理分散**、**无法串联后续 await 逻辑**。已统一改造为 `async` method + `try/catch` + `await fetch(...)`。

---

## 7. 灵动岛

### 7.1 关闭逻辑收口(v2 协议)

所有关闭路径必须走 `closeIsland(reason)`,`reason` 来自 `ISLAND_CLOSE_REASONS`:

| reason | 触发场景 |
|---|---|
| `manual` | 自己调 dismiss |
| `userOutside` | 用户点岛外部 |
| `userLongPress` | 用户长按岛(仅 mini 生效)|
| `lifecycleExpired` | lifecycle=time 到期 |
| `replaced` | 被另一个岛顶替 |
| `editMode` | 编辑模式接管 |
| `widgetPicker` | widget picker 接管 |
| `forced` | 框架强制重置 |

**栈恢复**:当一个岛被 `replaced` / `editMode` / `widgetPicker` 这三种 reason 关掉,会在延迟 `ISLAND_RESTORE_DELAY_MS`(300ms)后恢复栈顶的快照。

**size 升级约束**:`maxSize` 控制点岛不能超过的封顶(例:`maxSize: 'medium'` 表示点岛不会升到 large)。

### 7.2 App 侧用法

```js
this.toolkit.island.show('medium', { type: 'info', title: '...', message: '...' });
this.toolkit.island.toggle('mini', { title: '...', message: '...' });  // 同 view 再调会关闭
this.toolkit.island.notify('success', '标题', '副标题');
this.toolkit.island.dismiss();
this.toolkit.island.setCallbacks({ onLongPress: () => {...}, onClosed: ({ reason }) => {...} });
this.toolkit.island.startIdleTimer(60000);  // 1 分钟后自动关岛
```

size 取值:`mini` / `medium` / `large`(info 模式);notification 模式是 `compact`。

### 7.3 灵动岛模板

`src/core/island-templates.js` 提供了 `music` 模板,渲染完整音乐卡片(进度条、播放控制、歌词滚动)。用法:

```js
this.toolkit.island.show('large', {
    type: 'info',
    title: '...',
    islandTemplate: 'music',
    payload: { song, lyrics, currentTime, duration, progress, isPlaying, liked, actions }
});
```

style 由 `css/music-island.css` 提供,通过 `ensureIslandTemplateStyles()` 动态注入。

---

## 8. Widget(桌面小组件)

### 8.1 App 提供 widget

```js
widgets: [
    {
        id: 'quick-counter',           // appId 内唯一
        label: '计数器',
        icon: '<svg>...</svg>',
        iconBg: '#222',
        size: 'S',                     // 'S' | 'M' | 'L'
        orientation: 'h',              // 仅 S 生效:'h'(2x1) / 'v'(1x2)
        render(size, payload) {
            const safeLabel = escapeHtml(payload.label);
            return `<div class="p-2">${safeLabel}</div>`;
        },
        onTap(instanceId, qualifiedId, ctx) {
            // 返回 true = 已处理;返回 false = fallback 到打开宿主 app
            ctx.toolkit.island.notify('info', '点击');
            return true;
        },
    },
],
```

### 8.2 尺寸 footprint 与桌面布局

| size | orientation | footprint | 物理格 |
|---|---|---|---|
| S | h | 2×1 横 | 2 cells |
| S | v | 1×2 竖 | 2 cells |
| M | — | 2×2 | 4 cells |
| L | — | 4×2 | 8 cells |

桌面 4×4 网格,跨格 widget 后续 app 会自动跳过占用的物理格。

### 8.3 添加到桌面

长按桌面 → 进入编辑模式 → 点灵动岛(只有已注册 widget 才触发)→ 弹出 widget picker → 点击要添加的 widget。

### 8.4 持久化

桌面 widget 列表自动存到 IndexedDB 的 `widgetBoardRecords` 表,刷新后位置保留(由 `core-shim.js` 的 `saveWidgetBoard` / `loadWidgetBoard` 处理)。

### 8.5 widget 的安全约束

`render(size, payload)` 的返回值**直接被 v-html 注入**,所以 widget 自己负责 escape。

---

## 9. App 安装状态(Distribution)

App 通过 `distribution.requiresInstall = true` 声明「需要走下载/安装流程」。否则视为**系统级 App**,始终在桌面可见。

- 系统级 App:`settings`、`appstore`、`template`、`prompt-survey`(典型)|
- 可下载 App:`weather-app`、`focus-app`(默认注册到桌面,但用户可在 App Store 卸载)

状态持久化到 `localStorage('xiaoting::installed-apps-v1')`。状态变更派发 `phone:app-installation-changed` 事件,framework 收到后自动重算桌面图标。

**API**:`requiresAppInstallation(app)` / `isAppInstalled(app)` / `installApp(appId, app)` / `uninstallApp(appId, app)` / `listLaunchableApps(apps)` —— 见 `src/core/app-installation.js`。

---

## 10. Dock 栏布局

Dock 是桌面底部固定的 app 栏(最多 5 个),独立于安装状态。

- 把 App 拖到 Dock / 从 Dock 删除 → 仅改 `app.dock.visible`,**不**改安装状态
- Dock 顺序持久化到 `localStorage('xiaoting::dock-layout-v1')`
- 状态变更派发 `phone:dock-changed` 事件

**API**:`hydrateDockLayout(apps)` / `getDockMeta(app)` / `addToDock(appId, apps)` / `removeFromDock(appId, apps)` / `reorderDock(appId, index, apps)` / `swapDockOrder(a, b, apps)` / `listRemovedFromDock(apps)` / `listAddableToDock(apps)` —— 见 `src/core/dock-config.js`。

**声明默认在 Dock**:

```js
{
    id: 'settings',
    dock: { visible: true, order: 0 }
}
```

---

## 11. 三模式渲染桥接器

`js/framework/app-renderer-bridge.js` 是 framework 与 `app-renderer` 的对接层。它:

1. 监听 `currentPageView` / `currentDetailView` / `activeRootPageId` / `activeAppId` / `detailRenderTick` 的变化
2. 按 `app.renderMode` 分发:
   - **template** 模式:什么都不做,framework 原生 v-html 即可
   - **hybrid / vue** 模式:调 `app-renderer.mountInto(rootEl, app, content, page, key)`
3. 切换 app/page 时自动 `unmountFrom(rootEl)` 清掉上一个 Vue 实例,避免泄漏

**detailRenderTick**:framework 暴露 `window.__detailRenderTick`,业务代码需要强制重渲当前 detail 页(v-html 不响应底层数据变化)时,`window.__detailRenderTick.value++` 即可。

---

## 12. IndexedDB(双实例)

| 实例 | 数据库名 | 来源 | 表数 |
|---|---|---|---|
| `window.myDb` | `listen_db` | `js/db/base-stores.js` | 24(主库:用户/角色/世界/AI/API/SDK 系列/天气)|
| `window.musicDb` | `listen_music_db` | `js/db/music-stores.js` | 4(歌单/歌曲/历史/收藏)|

`ListenDb` 类(`js/db/engine.js`)支持动态 store 注册:

- `appendBaseStore(name, keyPath)` —— 启动时声明必须存在的 store
- `registerStore(name, keyPath)` —— 启动后追加声明
- `ensureSchema()` —— 强制升级 schema(给 app 注册用)

App 自己的表用 `toolkit.db.put('myStore', record)` 之类,无需手动管升级。

---

## 13. 顶层确认弹窗

独立于 App 的二次确认弹窗(用于桌面红叉删除等不在 App 内触发的场景)。

```js
window.__phoneConfirm.request({
    title: '确定删除?',
    text: '此操作不可撤销',
    confirmLabel: '删除',
    danger: true,
    onConfirm: () => { /* 删除逻辑 */ },
    onCancel: () => {},
});
```

实现见 `js/framework/core-shim.js` 的 `requestConfirm` / `closeConfirm`。

---

## 14. 把 App 注册到系统

三步走:

1. **在 `js/apps/` 下新建 `my-app.js`**,按 §2.1 写 default export 工厂函数
2. **在 `js/apps/index.js` 静态 import + 加到 `appFactories` 数组**(注明 sync / async)
3. **刷新浏览器**

```js
// js/apps/index.js
import createMyApp from './my-app.js';

const appFactories = [
    { name: 'my-app', factory: createMyApp, async: false },  // 写 db 的用 true
];
```

**不需要改 `index.html` 或 `src/index.js`。**

---

## 15. 调试与常见坑

| 现象 | 原因 / 处理 |
|---|---|
| 桌面看不到 App | 没在 `js/apps/index.js` 加 import;或注册前抛错;或 `distribution.requiresInstall = true` 但没安装 |
| 点击按钮没反应 | HTML 上没加 `data-app-action` |
| 灵动岛没出来 | 检查 `src/index.js` 是否导入 `island-components.js`(由 `core-shim.js` 自动注册)|
| IndexedDB 报错 `未声明的数据表` | 在 `appConfig.stores` 声明 |
| widget 添加失败 | widget id 重复(qualifiedId = `${appId}::${widgetId}`),或 render 不是函数 |
| **renderPage 报 `Cannot read properties of undefined`** | renderPage 内部用了 this,把渲染函数提到模块顶层 |
| **底栏 tab icon 露 `<svg viewBox...>` 字符** | 旧版 bug:framework `{{ tab.icon }}` 会 escape HTML。**2026-08-04 已改 framework**——用 `pages[].iconHtml` 字段(走 v-html)塞 SVG,用 `icon` 单字符走 fallback `escapeTabIcon`。详见 §16.11。 |
| **detail 页修改数据后视图不更新** | v-html 不响应底层数据变化,`window.__detailRenderTick.value++` 触发重画 |
| XSS 警告 | 忘了 `escapeHtml` |
| 状态栏白字 vs 黑字不对 | 检查 `topbar.color` / `statusBarColor`,或 `app.getBackground(state)` 是否返回非 transparent |
| 灵动岛点岛无效 | `maxSize` 限制了升级,或 `isWidgetPickerIslandState` 处于 widgetSlots 模式 |
| **详情页打开时,主页内容透到 detail 上**(两个 App 容器同时显示) | framework `core-shim.js` 的 setup() 漏 expose `currentDetailPage` 给 template,导致 `v-show="!currentDetailPage"` / `:class="{ 'detail-active': !!currentDetailPage }"` 永远是 undefined,反应式追踪没建立。**修复位置**:`js/framework/core-shim.js` setup return 里加 `currentDetailPage: navigation.currentDetailPage,`(2026-08-04 补回)。**诊断台词**:`use-app-navigation.js` 里 `currentDetailPage` 已经 return 出来,但 `core-shim.js` 把它只喂给 rendererBridge,没喂给 setup return → template 拿不到。下次再有「detail-active 不生效」类问题,先在 core-shim.js 里 grep `navigation.${refName}` 对比 setup return 块。 |
| **`refreshProfileTab` 报 `ReferenceError: escapeHtml is not defined`**(2026-08-05 踩坑) | `chat-app/index.js` 用到 `escapeHtml`(拼头像 / 背景 URL),但顶部 import 区没加。**修复**:`js/apps/chat-app/index.js` 顶部加 `import { escapeHtml } from '@/src/core/escape.js';`。**预防**:任何 `methods.*` 内部用了 `escapeHtml` / `createActionAttr` 之类 core 工具,顶部 import 区必须同步加进去。 |
| **`refreshNewChatContacts` 报 `ReferenceError: DEMO_CONTACTS is not defined`**(2026-08-05 踩坑) | `chat-app/index.js` 在 `refreshNewChatContacts` 里 fallback 用到 `DEMO_CONTACTS`,但只在 `new-chat-page.js` 里用 `const` 定义、不导出。**修复**:`js/apps/chat-app/pages/new-chat-page.js` 把 `const DEMO_CONTACTS = [...]` 改成 `export const DEMO_CONTACTS = [...]`,然后 `index.js` 顶部 `import { DEMO_CONTACTS } from './pages/new-chat-page.js';`。**预防**:跨文件共享的常量 / 函数必须 `export`,不要靠「同包内同 const」的隐式约定。 |
| **社媒头像 / 背景图 / 网名没应用到 murmur**(2026-08-05 踩坑) | `chat-app/pages/profile-page.js` 的 `getCurrentChatUser()` 在 `window.settingsSdk` 未就绪时**直接返回 DEMO_USER**(兜底),但此时 `refreshProfileTab` 已经发起调用,SDK 通常还没初始化完成,真实 persona 数据读不到。**修复**:`getCurrentChatUser()` 先等 SDK 就绪(`window.addEventListener('settings-sdk-ready', ...)`),再读 `currentUser.socialProfiles?.chat`。**预防**:任何跨 app 读取 `window.settingsSdk` 的接口必须先 `whenSettingsSdkReady()` 或自挂 ready 事件,**不能**在 SDK 还没准备好的情况下 sync 返回空数据 —— 那会让人误以为数据真的为空。 |
| **钱包余额一直显示 0 / 没同步**(2026-08-05 踩坑) | `settingsSdk.persona` 来自 `bindPersona(sdk)`,**只有** module / variants / phases / paro / resources / probability,**没有 asset**。`asset` API 原本只在 `installPersonaApis(toolkit)` 里挂载到 `toolkit.persona.asset`,但 chat-app 是按 `sdk.persona.asset.snapshot(...)` 调的,导致 `undefined`。**修复**:把 `installPersonaApis` 里的 `_createAssetApi` 工厂抽出来,在 `settings-sdk.js` 里 `sdk.persona.asset = _createAssetApi(sdk, toolkit);`,然后 `installPersonaApis` 改成「复用 settingsSdk.persona.asset」。**预防**:`bindPersona` 返回的 API 是固定的(模块/变体/阶段/资源/概率),任何跟「人设相关」的工具 API(asset / diary / schedule)如果也想通过 `settingsSdk.persona.*` 暴露,必须在 `settings-sdk.js` 里显式挂载,不能只在 `installPersonaApis` 里挂。**诊断台词**:某个 SDK API「明明有 export 出来但调不到」,先看它挂在哪个对象上 —— `settingsSdk.persona.X` ≠ `toolkit.persona.X`,两者走的初始化路径独立。 |
| **`Failed to resolve import ".../income-engine.js"` Vite 500**(2026-08-05 踩坑) | `js/apps/setting/world/sdk/settings-sdk.js` 要 import `../../persona/income-engine.js`(世界 SDK 子目录 → persona 目录,跨两级),手抖写成 `../persona/income-engine.js` 漏了一层。**修复**:改成 `../../persona/income-engine.js`(退出 sdk/ → 退出 world/ → 进 persona/)。**预防**:从 `world/sdk/*.js` 出发 import `world/` 外的模块,先 `cd` 一下 —— `world/sdk` 里 import `persona/` 必须从 `js/apps/setting/` 起算,正确路径是 `../../persona/...`。**诊断台词**:vite 给的报错路径里通常会显示「from / to」的文件路径,数一下被 import 文件在哪个目录、相对于当前文件差几级就知道该用几个 `..`。 |
| **人设 / AI 卡 / 用户卡编辑后保存无效(灵动岛弹「已保存」但字段没改)**(2026-08-05 踩坑) | `js/apps/setting/persona/renderer.js` 给 `base` / `meta` 顶层字段生成的 `data-persona-field="entityType\|groupKey\|fieldKey"`,但 `persona.name` / `gender` / `age` / `boundWorldId` 等都是 persona 顶层字段,不是 `persona.base.X` 嵌套。`collectFieldsFromDom` 把它们收集到 `patch.base.X`,`api.update` → `mergePatch` 写入 `persona.base.X`,但前端读的还是顶层 `persona.X`,看起来「没保存」。**修复**:`renderer.js` 新增 `personaFieldPath(entityType, groupKey, fieldKey)`,`base` / `meta` 写成 `entityType\|fieldKey`(省略中间 groupKey),其他模块组(`preferences` / `memory` / `mbti` / `assetNotes` / ...)保持 `entityType\|groupKey\|fieldKey` 不变;`collectFieldsFromDom` 单段(`parts.length === 1`)直接 `patch[parts[0]] = raw` 已能正确处理。**预防**:写「分组渲染器 + 收集器」时,必须让 data attribute 反映**真实存储路径**,而不是 UI 分组;UI 分组 ≠ 存储嵌套。**诊断台词**:保存流程跑通了(没报错 / 灵动岛通知 / `api.update` 返回非 null / db 写入了 / `updatedAt` 变了)但字段没变,基本可以确认「保存写到了错的存储位置」,打开 IndexedDB 直读 `sdkUsers` / `sdkAiPersons` 对比 `persona.X` vs `persona.groupKey.X` 哪个有更新。 |
| **v-html 里手动 `dom.appendChild(svgBtn); btn.addEventListener('click', ...)` 后点击不响应**(2026-08-05 踩坑) | `renderPage` 返回的字符串会被 Vue 走 `v-html` 整体替换,**业务代码没办法拿到 DOM 引用去挂 listener** —— 用 `appendChild` 塞进去的 DOM 是「孤儿」,跟 framework 的 click 派发链没关系。**修复**:业务要响应点击必须把 action 写在 HTML 字符串里(`data-app-action`),framework 通过 `__detailRenderTick.value++` 重新 v-html 后,顶层 click 委托才会重新扫到 action attr。**预防**:遇到「按钮没反应」**先 grep** 这个文件是否用了 `appendChild` / `addEventListener` / `querySelector` 后挂 listener —— 如果用了,说明走错了路线,改成 `data-app-action`。详见 §16.21 + §3。 |
| **顶栏按钮在 `messages-page` v-html 顶部输出 + CSS 绝对定位覆盖 framework**,改成 framework `topbar.headerActions` 后偏移 10px(2026-08-05) | chat-app 最早在 `messages-page.js` 的 v-html 顶部手动输出 `<div class="chat-topbar-actions">`,配 `_chat-messages.css` 的 `position: absolute; top: -54px; right: 0` 覆盖到 framework topbar。**问题**:framework 的 pill (`.app-topbar-action`)只听 `topbar.headerActions` + `pages[].topbar.headerActions` —— 手动输出的 DOM 既无样式也无 click 委派,**位置错位 + 点击失效**。**修复**:用 `appConfig.pages[i].topbar.headerActions = [{ icon, label, method, variant? }]` 让 framework 自己渲染按钮;位置偏移用 `.app-shell[data-app-id="chat"] .app-topbar-action { transform: translateY(-10px); }` 而不是绝对定位覆盖(因为顶栏高度是动态的,绝对定位很容易错位)。详见 §3.0 / §16.23 / §16.24。 |
| **`index.css:1 GET ... 500`** 在 dev server 启动后第一次访问 (2026-08-05 现象) | Vite dev server 在 `index.html` 引用 `/css/apps/chat/index.css?v=1` 时,首次请求偶发 500。**不影响功能**(只是 chat-app 的 css 没及时加载,刷新就好)但污染 console。**根因猜测**:Vite `@import` 多文件(25+)冷启动慢,在 dev server 完成解析前浏览器已经把请求发出去了。**临时绕过**:bash 里 `npm run build && npm run build:single` 看产物是否齐全 —— 产物没问题就是 dev server 临时抽风。**预防**:用 `vite-plugin-singlefile` 走 `build:single` 打包成单文件后用 `npx serve dist-single` 跑生产,能绕开 dev server 的 hot reload 抖动。 |

---

## 16. 给「AI 编程助手」的合作约定

1. **不要改 `index.html` 和 `src/index.js`** 注册 App
2. **优先 ESM 静态 import**
3. **用户输入 / 数据库读出来的字符串必须 escapeHtml**
4. **renderPage 内部不能用 this**(已踩坑,提炼到这里了)
5. **保持视觉风格**:iPhone 风格、柔和、毛玻璃、圆角
6. **不要写 `target="_blank"` 不带 `rel="noopener noreferrer"`**
7. **跳转 / 打开另一个 App 走 `createOpenAppAction()` 或 `toolkit.actions.openApp()`**
8. **不要持久化敏感数据到 IndexedDB**
9. **写 widget 时务必自己 escape payload 字段**
10. **新增数据表在 `appConfig.stores` 声明**
11. **`pages[]` 底栏 icon 字段(2026-08-04 改动)** ——
    - `iconHtml`:走 `v-html`,可塞 SVG(用此字段塞 SVG icon)
    - `icon`:走 `escapeTabIcon()`,只接受单字符 emoji / 简短文字(旧 app 兼容)
    - **优先填 `iconHtml`**,framework 自动 fallback。
    - 旧版约束(只能填单字符)**作废**:`{{ tab.icon }}` 已替换为 `v-html="tab.iconHtml || escapeTabIcon(tab.icon)"`。
    - 安全:`escapeTabIcon` 把 `&` / `<` / `>` 转义,挡 XSS;`iconHtml` 是开发者写的字符串,跟 `app.icon` 一样受信任。
12. **新文件不要带 `.bak` 后缀、不要建 `test-debug/` / `scripts/` 这种空调试目录** —— 历史清理已经完成。
13. **改 widget / dock / 安装状态时记得派发对应事件** —— 否则桌面不会自动刷新。
14. **不要把函数引用塞进 IndexedDB** —— JSON.stringify 会丢。`saveWidgetBoard` 已经处理了 widget render / onTap 的还原。
15. **所有调用外部 API(返回内容)的代码必须 `async/await`**,绝不允许同步阻塞等待 AI 响应。详见 §6。
16. **framework 改反应式暴露 / template 字段时,记得同步检查 `core-shim.js` setup return 块**(2026-08-04 踩坑)——
    - `use-app-navigation.js` 的 `return {...}` 里有 X 不代表 template 拿得到 X
    - 必须同步在 `js/framework/core-shim.js` setup 函数里 `return { x: navigation.x, ... }` 把 X 暴露出来
    - `bindAppRendererBridge` 那块是给桥接器用的,**和 template 无关**;template 只看 setup return 块
    - 检查清单:任何 `currentXxx` / `activeXxx` / `isXxx` 之类的 computed,如果 template 里用得到,必须在 core-shim setup return 里有对应字段
    - 漏了会导致:`v-show` / `v-if` / `:class` 条件不响应,看上去"静态"在某个值上不动,本质上因为 Vue 编译时找不到 ref key,降级成静态求值
17. **`settingsSdk.persona.X` ≠ `toolkit.persona.X`,两个对象的初始化路径独立**(2026-08-05 踩坑)——
    - `settingsSdk.persona` 由 `bindPersona(sdk)` 构造,只包含 module / variants / phases / paro / resources / probability 这几个固定 API
    - `toolkit.persona.asset` / `toolkit.persona.diary` 来自 `installPersonaApis(toolkit)`,挂在 app 的 toolkit 上
    - 跨 app 读取时(chat 读 settings 的资产),如果代码走 `sdk.persona.asset.snapshot(...)` 会拿到 `undefined`
    - **正确做法**:SDK 类的 API 统一在 `settings-sdk.js` 里挂到 `sdk.persona` 上,然后 `installPersonaApis` 复用同一个对象(`toolkit.persona.asset = sdk.persona.asset`),保证两边同步
    - **检查清单**:给 `settingsSdk.persona` 加新 API 时,要么在 `bindPersona` 里加(永久),要么在 `settings-sdk.js` 里 `sdk.persona.X = ...`(同步初始化);不要只在 `installPersonaApis` 里挂,否则其他 app 调不到
18. **跨文件共享的常量 / 函数必须 `export`,不要靠「同包内同 const」的隐式约定**(2026-08-05 踩坑)——
    - `chat-app/pages/new-chat-page.js` 用 `const DEMO_CONTACTS = [...]` 定义,但 `chat-app/index.js` 直接引用 `DEMO_CONTACTS` 触发 `ReferenceError`
    - **修复**:`const` → `export const`,然后在 `index.js` 顶部 `import { DEMO_CONTACTS } from './pages/new-chat-page.js';`
    - **预防**:跨文件使用的常量一律加 `export`,包括 fallback 数据 / 默认配置 / 工具函数
19. **跨 app 读 `window.settingsSdk` 必须等 ready,不能 sync 返回空数据兜底**(2026-08-05 踩坑)——
    - `chat-app/pages/profile-page.js` 的 `getCurrentChatUser()` 在 SDK 未就绪时直接 `return DEMO_USER`,让人误以为真实 persona 为空
    - **正确做法**:先 `await _waitForSdk()`(监听 `settings-sdk-ready` 事件),再读 `sdk.users.getActive()` 等接口
    - **预防**:任何初始化可能晚于调用方的 getter,必须用 ready promise / event 处理时序;sync 返回空会让上层误判「数据真的空」,实际是「还没读到」
20. **`data-*` 属性必须编码「真实存储路径」,不是「UI 分组」**(2026-08-05 踩坑)——
    - 写「分组渲染器 + 收集器」时,如果给每个 input 都塞 `data-persona-field="${groupKey}|${fieldKey}"`,后续 collect 就会原样写到 `patch[groupKey][fieldKey]`,**前提是这个字段真的存在嵌套对象里**
    - 人设编辑器里 `base` / `meta` 是**纯 UI 分组**(`renderPersonaGroup` 用来把同一类字段摆一起),不是存储嵌套,真正的 `name` / `gender` / `boundWorldId` 在 persona 顶层 —— 但旧版 renderer 一律写 `entityType|base|name` / `entityType|meta|boundWorldId`,导致 `collectFieldsFromDom` 把改动写到了 `persona.base.X` / `persona.meta.X`,顶层字段没动,看起来「保存无效」
    - **预防清单**:
      - 给 input / select 写 `data-*` 路径前,先确认**对象真实结构**(`console.log(obj)` / 查 defaults.js / IndexedDB 直读)
      - UI 分组 ≠ 存储嵌套;如果不一样,要么 a) 渲染器写「真实路径」(`entityType|fieldKey`),要么 b) 收集器按 groupKey 白名单跳过嵌套
      - 「保存流程全跑通但字段没变」的 bug,99% 是「写到了错的存储位置」,先 IndexedDB 直读对比 `obj.X` vs `obj.groupKey.X` 哪个被改了
      - 收集器读取时,`split('|')` 后 `parts.length === 1` 也要正常处理(顶层字段),不能假设一定有 groupKey
21. **v-html 内容里**严禁**用 `appendChild` / `addEventListener` 注入交互**(2026-08-05 严重踩坑)——
    - `renderPage(...)` 返回的字符串会被 Vue 走 `v-html` 整体替换;**业务代码拿不到 DOM 引用** —— 用 `document.createElement` + `someDiv.appendChild(btn)` 拼出来的节点,跟 framework 完全脱钩:
      - 顶层 click 委托扫的是 `data-app-action` 属性,**不会**冒泡到你 `addEventListener` 注册的回调
      - 你塞进去的 DOM 在每次 v-html 重画时被覆盖,listener 自然没了,你以为是「监听器泄漏」其实是「节点被替换」
      - 灵动岛 / mode 切换时 framework 还会再 v-html 一遍,你的节点彻底消失
    - **正确做法(唯一)**:
      - 业务节点写在 `renderPage` 返回的**字符串**里(`data-app-action` + `data-app-modal`)
      - 用 `tabAppContainer.appendChild(virtualNode)` 这种「framework 给的合法接口」去操作
      - 不要碰真 DOM 树,不要碰全局 `document.createElement` 拼业务节点
    - **反例(已修复)**:`chat-app/index.js` 原先用 `document.createElement('div')` 拼 toolbar → `messagesContent.appendChild(toolbar)` → `toolbar.querySelector('.btn-x').addEventListener('click', ...)`,结果按钮在 framework 重画后「卡死」(framework 重新 v-html 时把整个 app-content 替换,你挂的 listener 跟旧 DOM 一起消失,但新 DOM 上没绑)
    - **诊断台词**:「按钮 / chip / attachment / 工具栏」点击没反应,先 grep `addEventListener` / `appendChild` / `querySelector`;命中了说明走错路线,改用 `data-app-action`。**framework 的 click 委托是唯一可靠的派发链**
22. **v-html 的 XSS 重灾区:动态 `src` / `href` / 任意属性插值**(2026-08-05 踩坑)——
    - 想在 chip / attachment / 头像里塞一个图片 URL,代码:
      ```js
      `<img src="${userMsg.imageUrl}" />`  // ❌ userMsg.imageUrl 从 db 读的,内容不可信
      ```
    - **风险**:v-html 直接当 HTML 解析,如果 `userMsg.imageUrl === '"/><script>alert(1)</script>'`(虽然 db 写时被 escape 过,但读出来插到属性里有可能没转义到位),`<img src="" />` 后跟一段 `<script>`,payload 立刻执行
    - **修复(已经统一)**:所有动态插值的属性走 `escapeHtml(value)`,**框架不替你转义属性**,只有 textContent(Vue 模板 `{{ }}`)才会自动转义;**v-html 完全是 raw HTML**,任何插值都是你的责任
    - **XSS 安全清单**:
      - `<img src="${x}">` → `<img src="${encodeURI(escapeHtml(x))}">`
      - `<a href="${x}">` → `<a href="${escapeHtml(x)}">` + 协议白名单(`http:` / `https:` / `mailto:`)
      - `style="background: url(${x})"` → `style="background: url('${escapeHtml(x).replace(/'/g, '%27')}')"`
      - `onclick="${x}"` / `onerror="${x}"` → **绝对禁止**,事件 handler 永远走 `data-app-action`
      - 任何「构造 HTML 字符串」都把它当成「在写 HTML 文件」,每个变量都要 `escapeHtml`
23. **顶栏按钮必须用 framework `topbar.headerActions`(2026-08-05 新规约)**——
    - 升级前:app 自己在 v-html 里画 pill 按钮 + CSS 绝对定位偏移到 framework topbar 上
    - **新规约**(`v0.25` 起):
      ```js
      pages: [
          {
              id: 'messages',
              topbar: {
                  headerActions: [
                      { icon: 'search',    label: '搜索', method: 'toggleSearch',         variant: 'solid' },
                      { icon: 'calendar',  label: '日历', method: 'toggleRecordMode',     variant: 'solid' },
                  ],
              },
          },
      ]
      ```
      framework 会在 `<div class="app-topbar">` 里自动渲染 `<button class="app-topbar-action">`,带 `data-app-action` + 默认 click 委托 + 圆形 svg icon
    - **字段含义**:
      - `icon`:framework 内置 svg 名(`search` / `calendar` / `plus` / `gear` / `star` / `back` / ...)或自定义 `'<svg ...>...</svg>'` 字符串;framework 走 `v-html`
      - `label`:无障碍 `aria-label` + 灵动岛 `notify('info', label)` 提示时显示
      - `method`:app methods 里的函数名,framework 通过 `appMethod` action 派发
      - `variant`:`'solid'`(实心背景)/ `'glass'`(毛玻璃,默认)/ `'bare'`(裸文字)
    - **位置微调**:默认位置由 framework 控制 —— app 想偏移**用 CSS `transform: translateY()` 而不是绝对定位**,因为顶栏高度随 type 变,绝对定位很容易错位。详见 §16.24。
    - **不兼容旧版**:app 自己 v-html 输出的顶栏 pill 既不会触发 framework 派发(没有 action attr),也不会被 framework 的样式覆盖 —— 上线前 grep `app-topbar-action` 看是不是 framework 自动生成的,不要自己输出。
24. **调整 framework 控件位置 → 用 `transform: translateY`,**不要**用绝对定位覆盖**(2026-08-05 沉淀)——
    - 历史反例:chat-app 在 messages-page v-html 顶部手动输出 `<div class="chat-topbar-actions">`,然后在 `_chat-messages.css` 用 `position: absolute; top: -54px; right: 0; z-index: 99` 把整个按钮组覆盖到 framework topbar 上 —— **问题**:
      - 顶栏高度随 `topbar.type` 变(`standard` ≈ 44px / `large-title` ≈ 96px),固定的 `top: -54px` 只对一种顶栏生效
      - framework 重画 v-html(切 tab / detail 退出 / mode 切换)时不动你的绝对定位 div,但你的 div 会因为 v-html 替换上下文而「失效」
      - 灵动岛展开 / 收缩时顶栏高度会动态变,绝对定位 div 不跟动
    - **正确做法**:用 framework 自己的 `topbar.headerActions`(详见 §16.23),位置偏移一律走 `.app-shell[data-app-id="your-app"] .app-topbar-action { transform: translateY(-10px); }` —— **`transform` 不影响布局**(不会推开其他元素),且 100% 作用域在你的 app 内部,其他 app 顶栏不受影响
    - **诊断台词**:`grep -n "position:.*absolute.*top:" css/your-app/` 看是否有「贴在顶栏位置」的绝对定位 —— 命中了基本就是 legacy 残留,转 `transform` 或改用 `headerActions`
25. **`appendChild` + `addEventListener` 在 `renderPage` 路径上 = 严重反模式**(2026-08-05 总结,与 §16.21 同源但更直白)——
    - 任何在 app 代码(`renderPage` / `methods.*` / `widget.render` / `topbar` / `mounted` 钩子)里出现的 `xxxContainer.appendChild(node)` + `node.addEventListener(...)`,**几乎都是 bug 的温床**
    - 原因:framework 通过 v-html 控制 DOM,业务拿到的「引用」会在下次 v-html 时被指向**新节点**,而 listener 绑在**旧节点**上,v-html 后 listener 跟着旧节点一起死
    - **正确路径只有 2 条**:
      1. **字符串 + `data-app-action`**:`renderPage` 返回的字符串里塞动作属性(framework 派发)
      2. **hybrid `<component-island>`**:framework 把 `<component-island name="x" :value="true" />` 替换成 Vue 组件(framework mount)
    - **这两条路径外的一切 DOM 操作都不被 framework 支持** —— 包括 `querySelector` 找元素绑 listener / 往 `document.body` 里 `appendChild` / 监听 `click` 然后 `closest` 找 `[data-app-action]`(虽然能跑但非常脆弱,v-html 一重画就崩)
    - **诊断台词**:任何「点击不响应 / 切换 app 后行为变了 / 第二次操作失效」,**第一时间 grep `addEventListener` + `appendChild`**,然后用上面 2 个路径改写
26. **`ListenDb._doOpen` 的 `close() → this.db.version` 顺序颠倒 = 百行 storm bug**(2026-08-06 严重踩坑)——
    - 现象:加新 store 进 `base-stores.js` 后,冷启动时 `engine.js:122` 一直刷「回落后检测到缺失 store」,然后跟 `Cannot read properties of null (reading 'version')` 崩溃,**所有 SDK 读写全挂**
    - 根因:`ListenDb._doOpen` 检测到磁盘 db 缺 store 时,会 `this.close()`(把 `this.db = null`) → 然后 `this.dbVersion = this.db.version + 1`。**`close()` 之后访问 `this.db.version` 必定 null** —— 升级路径永远走不到,连 base 读也连带失败
    - 正确做法:
      ```js
      const oldVersion = this.db ? this.db.version : this.dbVersion;
      this.close();                          // 先 close
      this.dbVersion = oldVersion + 1;       // 再用本地缓存的 version
      this.ready = null;
      try {
        this.db = await this._openWithVersion(this.dbVersion);
      } catch (e) {
        this.ready = null;                   // 升级 open 失败必须清 ready,让上层 open() 重试
        throw e;
      }
      ```
    - 预防清单:
      - 任何 `close()` 之后的代码访问 `this.db` 的字段(**任何字段**)前,先 `const oldX = this.db ? this.db.X : this.X` 缓存到 local
      - `_doOpen` 这种「db 重启」流程,**默认会失败** —— 必须把所有 catch 路径里的 `this.ready` 都清掉,否则 `open()` 永远返回第一次 reject 的 promise,`_request` 内部 retry 也没用
      - 「加新 store 后冷启动疯狂报错」99% 是这 bug,先 grep `this.db.version` / `this.db.objectStoreNames` 紧跟在 `this.close()` 后面
    - 诊断台词:console 大量刷 `[ListenDb] 回落后检测到缺失 store` 然后跟 `Cannot read properties of null (reading 'version')`,基本就是这个 bug;打开 `engine.js` 搜 `this.close()` 看后两行有没有访问 `this.db.*`

---

## 17. 完整注册一个 App 的最小模板

参考 `src/apps/template-app.js`(template 模式 + 完整 widget 示例 + 灵动岛演示)。

更复杂的业务范例:
- `js/apps/prompt-survey.js` —— 大型 hybrid 表单 + 自研术语词典(用了 `prompt-survey-glossary.js`)
- `js/apps/weather-app.js` —— 完整业务 App(搜索 + 列表 + 详情 + IndexedDB 缓存 + widget)
- `js/apps/focus-app.js` —— Vue 模式(直接返回组件配置)
- `js/apps/setting/main.js` —— 巨型设置 App(126+ 文件,按子系统模块化)
- `js/apps/appstore.js` —— App Store 模式(枚举所有 app,处理 requiresInstall)
- `js/apps/chat-app/index.js` —— **顶栏按钮范例**(v0.25 起唯一允许的写法,见 §16.23):
    ```js
    pages: [
        {
            id: 'messages',
            topbar: {
                headerActions: [
                    { icon: 'search',   label: '搜索聊天', method: 'toggleSearch' },
                    { icon: 'calendar', label: '切换到日历模式', method: 'toggleRecordMode', variant: 'solid' },
                ],
            },
        },
    ],
    methods: {
        async toggleSearch() { ... },
        async toggleRecordMode() { ... },
    },
    ```

---

## 18. 「业务 DOM 操作的禁止做法」清单(2026-08-05 浓缩)

经过这次 chat-app 顶栏按钮调试,把 v-html 时代最容易踩的反模式提炼成一张黑名单。**命中即改写**:

| ❌ 禁止 | ✅ 替代 |
|---|---|
| `document.createElement('button'); container.appendChild(btn); btn.addEventListener('click', ...)` | `<button data-app-action="${...}" >` 写在 v-html 字符串里 |
| `container.querySelector('.x').addEventListener(...)` | 用 framework 顶层 click 委托:HTML 字符串里塞 `data-app-action` |
| 用 CSS `position: absolute` 把自绘 DOM 覆盖到 framework topbar / 灵动岛 / 抽屉上 | 用 framework 自己的 API:`topbar.headerActions` / `<component-island>` / 灵动岛 helper |
| `mounted() { this.$el.appendChild(myDiv); }` 手动挂节点 | `renderPage` 字符串返回,framework 接管生命周期 |
| `<img src="${userUrl}">` 直接插值 | `<img src="${escapeHtml(userUrl)}">` 必 escape;v-html 不会自动转义属性 |
| `<a href="${x}">` 不校验协议 | `<a href="${escapeHtml(x)}">` + `href.startsWith('http') \|\| href.startsWith('mailto:')` 白名单 |
| `style="background: url('${userUrl}')"` 直接插值 | 拆到 `data-bg="${escapeHtml(userUrl)}"`,CSS 用 `attr(data-bg)` 或内联::before |
| 把 event handler 写进字符串:`onclick="myFn()"` / `onerror="..."` | **永远**走 `data-app-action`;事件 handler 在 HTML 字符串里出现 = 立即修 |
| `renderPage(...) { const self = this; return ...; }` 抓 this | 把渲染函数提到模块顶层,renderPage 只做路由分发 |
| 靠「app 内容容器 selector 不变」假设缓存 DOM 引用 | framework 重画随时清掉,只缓存数据对象,不缓存 DOM 节点 |

**核心规则一条**:app 跟 framework 交互只有 **2 个面** —— **「写入」**返回字符串 / SDK 调用;**「读取」**靠 `data-app-action` 派发。**没有第三条路**。其余任何 `appendChild` / `addEventListener` / `querySelector` 都是「framework 外的野生 DOM」,命运完全不可控。

---

## 19. 全局启动预热(v0.28)

### 19.1 问题

settings-sdk 原来只在打开 settings app 时才 `bootstrapSettingsSdk()`,导致:

- chat-app 的 new-chat 详情页打开时看不到真实世界名,只能显示 demo 数据
- 桌面外观(手机壳高度/颜色)需要打开 settings 一次才渲染
- weather-app 的 place 映射需要等 `settings-sdk-ready` 事件

**解决思路**:把 SDK 启动从「打开 settings app 时」提前到「页面加载时」。

### 19.2 顶层预热入口

```
js/framework/prewarm.js          ← 新增,fire-and-forget 预热
js/framework/index.js             ← re-export prewarmSettingsSdk / whenSettingsSdkReady
src/index.js                      ← import '@/js/framework/index.js'(副作用启动预热)
```

预热时机:framework index.js 被 ESM import 那一刻,`prewarm.js` 模块内部 `Promise.resolve().then()` 立即 fire-and-forget 启动 `bootstrapSettingsSdk()`,**不阻塞 framework mount,也不阻塞 index.html 渲染**。

### 19.3 核心 API

```js
// 业务 app 用这个,推荐写法:
const sdk = await window.whenSettingsSdkReady(2000);
// 2000ms 内等待;超时返回 null 表示未就绪
if (sdk) {
    // 真实数据
} else {
    // 降级:走 localStorage 快照或占位
}

// 主动触发预热(幂等,多次调用无害):
window.prewarmSettingsSdk(); // fire-and-forget,返回 Promise
```

### 19.4 三层保险(任一成立即可渲染)

| 层级 | 来源 | 速度 | 说明 |
|---|---|---|---|
| 1 | `window.settingsSdk` | 同步 | prewarm 已完成,直接拿 |
| 2 | `localStorage['xiaoting::chat-snapshot-v1']` | 同步 | SDK 正在 hydrate 时,快照立刻可用 |
| 3 | 占位渲染 | — | 以上都没有时的 UI 兜底 |

### 19.5 chat-snapshot 快照

`js/apps/setting/world/sdk/chat-snapshot.js`:

- `saveSnapshot(sdk)`:SDK hydrate 完成后立即写入 localStorage
- `loadSnapshot()`:同步读取,失败返回 null
- 字段:`ts / defaultUserId / activeUserId / defaultUser / activeUser / world / aiPersons`

快照写入时机:

- `prewarm.js` fire-and-forget 完成 SDK hydrate 后
- settings app 里编辑 user / world / aiPersons 后

### 19.6 冷启动链路

```
页面加载
  ↓
src/index.js import '@/js/framework/index.js'
  ↓
js/framework/prewarm.js (模块副作用,立刻触发)
  ↓ Promise.resolve().then() → bootstrapSettingsSdk()
  ↓ (并行,不阻塞)
  ├─ hydrate users → aiPersons → worlds → places → ...
  ├─ SDK 就绪 → 落盘 chat-snapshot
  └─ dispatchEvent('settings-sdk-ready')

// 用户还没点任何东西,SDK 已经就绪
// 进 chat → new-chat → renderDetailPage('new-chat')
//   └→ window.settingsSdk ✓ → renderNewChatPageAsync(app)
//       └→ sdk.worlds.get(wid).name → 「🌐 海贼王」chip
```

### 19.7 业务 app 接入

```js
// 在 app 的 hydrate() / renderDetailPage() / 任意 method 里:
async hydrate() {
    const sdk = await window.whenSettingsSdkReady(3000);
    if (sdk) {
        // 真实数据
    } else {
        // 降级
    }
}
```

已有的 `_waitForSdk()` 实现全部改用 `window.whenSettingsSdkReady()`:

```js
// profile-page.js / chat-app/index.js 的 _waitForSdk()
function _waitForSdk() {
    if (typeof window.whenSettingsSdkReady === 'function') {
        return window.whenSettingsSdkReady(2000);
    }
    // 兜底:裸事件订阅(兼容老环境)
    return new Promise((resolve) => {
        if (window.settingsSdk?.users) { resolve(); return; }
        const handler = () => { window.removeEventListener('settings-sdk-ready', handler); resolve(); };
        window.addEventListener('settings-sdk-ready', handler);
    });
}
```

### 19.8 历史踩坑(2026-08-06)

- 原来 `_waitForSdk()` 只挂 `settings-sdk-ready` 事件,不会主动触发 SDK bootstrap
- 如果 prewarm 因为某种原因没跑(`js/framework/index.js` 没被 import),裸事件订阅永远不触发
- **修复**:`_waitForSdk()` 优先调 `window.whenSettingsSdkReady()`,后者内部会幂等触发 `prewarmSettingsSdk()`
- **预防**:任何「等 SDK」的函数,不要只挂事件,必须调 `whenSettingsSdkReady()` 兜底主动触发

### 19.9 SDK 预热时未传入 toolkit 导致数据不持久化(2026-08-06 严重 Bug)

**问题现象**:保存世界观/用户人设/AI人设后刷新页面,数据全部丢失。

**根本原因**:`js/framework/prewarm.js` 调用 `prewarmSettingsSdk()` 时**没有传入 toolkit**,导致:
1. `bootstrapSettingsSdk({ toolkit: undefined })` → `createSettingsSdk({ toolkit: undefined })`
2. `createPersister(toolkit, storeName)` 中 `toolkit?.db` 为 `undefined`
3. 所有 `db.put()` 调用被静默跳过(`if (!toolkit?.db) return;`)
4. 数据只写到了内存 Map,刷新后内存清空

**修复**:在 `js/apps/setting/world/sdk/bootstrap.js` 的 `bootstrapSettingsSdk` 开头加兜底:
```js
if (!toolkit || !toolkit.db) {
    console.warn('[bootstrap] 未传入 toolkit，使用 window.myDb 替代');
    if (typeof window !== 'undefined' && window.myDb) {
        toolkit = { db: window.myDb };
    } else {
        toolkit = { db: null };
    }
}
```

---

## 20. 聊天 App 双副本与顶栏按钮隔离(2026-08-06)

### 20.1 双副本架构

chat-app 每个 AI 人设支持 **calendar** 和 **story** 两个独立聊天副本：

- **calendar（日历模式）**: 正常聊天，消息按日期归档，可被社媒 App 调用
- **story（故事模式）**: 情景扮演/游戏模式，消息列表背景变粉色，与日历模式数据隔离

好友数据存储在 `user.socialProfiles.chat.{calendarContacts|storyContacts}` 数组里，通过 `sdk.chatFriends` API 读写。

### 20.2 添加好友的完整流程

```
new-chat 页（通讯录列表）
  ↓ 点某个 AI 联系人
pickContactForMode(app method)
  ↓ 弹 ModeSelectorModal
  ↓ 用户选 calendar/story → pickContactAndCreate
  ↓ sdk.chatFriends.add() 写入 IndexedDB
  ↓ 跳转 private-{aiPersonId}（私聊页，不是 private-{aiPersonId}-{mode}！）
  ↓ refreshMessagesTab 刷新消息列表
```

**pageId 命名规范**：

- `private-{aiPersonId}` — 私聊主页（所有 mode 共用入口）
- `private-{aiPersonId}-calendar` — 日历视图详情页（聊天设置 → 聊天记录管理 → 进入）
- `private-{aiPersonId}-story` — 故事存档详情页（同上）
- 列表页点击 → 跳 `private-{aiPersonId}`，由聊天内顶栏按钮进入对应模式视图

### 20.3 重复添加的禁用逻辑（v0.28）

| 状态 | 联系人项 | 弹窗行为 |
|---|---|---|
| 两种都没加 | 可点击 | 两个按钮都正常 |
| 只加过 calendar | 可点击 | 日历按钮灰掉（`addedInMode=true`） |
| 只加过 story | 可点击 | 故事按钮灰掉 |
| 两种都加过 | **disabled**（不可点击） | 不弹窗 |

`addedInMode` / `addedInOtherMode` 在 `getWorldAiPersons()` 里通过 `sdk.chatFriends.has()` 实时计算。

### 20.4 顶栏 mode-toggle 按钮隔离（v0.28 Bug Fix）

**问题**:切换过一次 mode 后，mode-toggle 按钮（故事/日历切换）会泄漏到 contacts/new-chat 等其他页面顶部。

**根因**:
1. `syncHeaderActionsWithMode()` 把 `window.__appTopbarOverride = { headerActions: [...] }` 写入 Vue ref
2. 切换到其他 tab 时，`activeAppTopbar` computed 合并 `{ ...base, ...ov }`，把 override 的 `headerActions` 混进 contacts 顶栏
3. `contacts` 页面的 `topbar = { visible: true, type: 'search' }` 没有声明 `headerActions`，被 override 污染

**修复**:在 `use-app-navigation.js` 的 `switchRootPage` 里：

```520:530:js/framework/use-app-navigation.js
function switchRootPage(pageId) {
    // ...
    const prevPageId = activeRootPageId.value;
    activeRootPageId.value = pageId;
    detailPageStack.value = [];
    // ★ v0.28 fix:切换离开 messages tab 时清掉 override
    if (prevPageId === 'messages' && pageId !== 'messages') {
        appTopbarOverride.value = null;
    }
    // 切换回 messages tab 时立即恢复 override
    if (pageId === 'messages' && prevPageId !== 'messages') {
        appTopbarOverride.value = { headerActions: buildMessagesHeaderActions() };
    }
}
```

**诊断台词**:「按钮出现在不该出现的页面顶部」→ 先 grep `__appTopbarOverride` 搜泄漏源；再查 `switchRootPage` 是否有清理逻辑。

27. **`syncRenderer` 的 detail 分支「enqueue 时写 lastKey.detailTickVal」= 死循环温床（v0.38 严重踩坑）**——
 - 现象:进入 hybrid 模式 + async detail renderer 的页面(典型如 chat-app `new-group`)后,console 不停刷 `[bridge:debug] syncRenderer called`,每秒几百次,页面卡死
 - 根因链:
 1. 业务代码 `++tick` 想触发 detail 重画
 2. `bridge.syncRenderer` watch tick 触发,detail 分支看到 `detailKey` 没变 + `tickVal` 变了 → enqueue `mountInto` (setTimeout 0)
 3. **enqueue 那一刻就把 lastKey.detailTickVal 写成「此刻 tick」**(天真做法)
 4. `mountInto` 内部 `await renderer(content, page, app)` → `resolveAsyncRenderer` 在 promise resolve 时 `tick = Math.max(..., promisedTick)` → tick++ 一次
 5. watch 再次触发 syncRenderer → 看到 lastKey.detailTickVal(=enqueue tick) != 当前 tickVal → 又 enqueue mountInto → ...
 6. **死循环**
 - 修复(`js/framework/app-renderer-bridge.js`):
 1. **inFlight 锁**: `pendingDetailMountId` 单调递增 ID + `inFlightDetailMount` 当前 ID,enqueue 时 set,mountInto 跑完 finally 里 `if (inFlightDetailMount === myMountId) inFlightDetailMount = 0`。syncRenderer 看到 inFlight > 0 时直接 skip 整个 detail 分支
 2. **lastKey 写入移到 promise 完成之后**:enqueue 时仍同步写 lastKey(防别处抢先 enqueue),但 `finally` 里再 `lastMountedKey.value = { ...lastMountedKey.value, detailTickVal: detailRenderTick?.value };` —— 把 tick 同步到「最新」
 3. **bridge.syncNow({ force: true })** 逃生口:业务需要强制重画时(比如 SDK ready 后想刷新数据),调这个,跳过所有 inFlight / tick 比较。**禁止业务代码 `++tick` 触发 detail 重画**(会用循环)
 4. 业务代码所有 `window.__detailRenderTick.value++` 全部改成 `window.__appRendererBridge.syncNow({ force: true })`(已迁移 chat-app `initNewGroupPageInteractions` + `new-group-page.js` 的 aiList async resolve)
 - 预防清单:
 - `app-renderer-bridge.js` 里**任何**「在 setTimeout 之前写 lastKey」的写法都得检查:enqueue 时写的 lastKey 字段 vs mountInto promise resolve 时字段会不会差,有差就是死循环候选人
 - detail renderer 是 async 的 app(chat-app 全是)改 detail branch 时,务必用 inFlight 锁;template 模式(同步 v-html)不受此问题影响
 - 「console 一直在刷 syncRenderer 日志」**就是**死循环,不要再加 log「诊断」,先去 grep `__detailRenderTick.value++` 和 `lastMountedKey.value` 的写入时机
 - 业务代码 → bridge:**只**走 `bridge.syncNow({ force: true })`,不走 `++tick`。这条已经踩过的坑不需要再踩

---

## 21. chat-app 回复提示词 SDK + 构造器(v0.50,2026-08-07)

### 21.1 一句话

回复提示词 = **每个 AI 人设挂 0~N 条「这次怎么回」的小指令**,拼到 AI 的 system prompt 头部(顺序 = user 设置的 order)。**v0.50 把这条链路从 chat.js 搬出来做成独立服务 + SDK**,后期接 AI SDK 时直接调 `window.__chatPromptBuilder.build(...)`。

### 21.2 数据落地位置

**`aiPerson.replyPrompts`**(顶层字段,不是 `socialProfiles.chat.X`):
- `aiPersons.update(id, { replyPrompts: [...] })` 走 `mergePatch` 深合并,自动落盘
- 不需要新 IndexedDB 表 / 新 schema
- 跟 `boundResources` / `incomeEvents` 等类似字段保持一致风格

**单条结构**:`{ id, title, content, source, active, order, longBody?, createdAt, updatedAt }`

### 21.3 SDK 入口

```js
// settingsSdk 暴露在 window.settingsSdk,prewarm 启动后即可用
const sdk = await window.whenSettingsSdkReady();

// 读
sdk.replyPrompts.list(aiPersonId)              // 全部,按 order 升序
sdk.replyPrompts.listActive(aiPersonId)        // active=true 子集
sdk.replyPrompts.get(aiPersonId, promptId)     // 单条

// 写(全部 async,自动落盘到 aiPerson record)
sdk.replyPrompts.add(aiPersonId, patch)         // 新增
sdk.replyPrompts.update(aiPersonId, id, patch) // 更新
sdk.replyPrompts.remove(aiPersonId, id)        // 删除
sdk.replyPrompts.toggleActive(aiPersonId, id)  // 切换启停
sdk.replyPrompts.setOrder(aiPersonId, ids[])   // 批量重排

// 兜底:SDK 未就绪时所有 API 返回空/不抛异常(避免业务代码 race)
```

实现:`js/apps/setting/world/sdk/reply-prompts.js`(100% 独立 ESM)。

### 21.4 构造器入口

`window.__chatPromptBuilder`(chat-app 启动时挂上):

```js
const { systemPrompt, parts, stats } = await window.__chatPromptBuilder.build({
    aiPersonId: 'ai0',
    mode: 'calendar',         // 'calendar' | 'story'
    historyLimit: 12,
});

// parts: { aiPerson, user, world, modules, history, activeReplyPrompts }
// stats: { activeReplyPrompts, totalHistory, promptLength }

// 快速预览(只拼人设 + 模块,不快读聊天历史)
const { preview, stats } = window.__chatPromptBuilder.buildPreview(aiPersonId);
```

**拼装顺序**:人设 8 字段 → 世界观 → AI/用户 enabled 模块 → 近期聊天 → 心情 → 今日日程 → 朋友圈(预留)→ **已启用 replyPrompts** → 特殊动作格式说明。

**特殊动作格式**(`SPECIAL_ACTIONS_HELP` 全文常量化导出):
| 动作 | 格式 | 示例 |
|---|---|---|
| 发红包 | `[发红包:金额:祝福语]` | `[发红包:88:恭喜发财]` |
| 发位置 | `[发位置:地点名:详细地址]` | `[发位置:星巴克:北京xxx店]` |
| 转账 | `[转账:金额:备注]` | `[转账:100:生活费]` |
| 发语音 | `[发语音:秒数:文字]` | `[发语音:15:今天好累]` |
| 发图片 | `[发图片:背景色:文字色:描述]` | `[发图片:#FFE4EC:#D4728A:夕阳咖啡]` |
| 引用回复 | `[引用:消息id:回复]` | `[引用:msg-abc:我没听清]` |
| 分享聊天记录 | `[分享聊天记录:本会话最近N条]` | `[分享聊天记录:最近5条]` |
| 分享音乐 | `[分享音乐:歌名:歌手]` | `[分享音乐:晴天:周杰伦]` |

message-renderer 已支持解析这些格式(v0.30+),AI 直接输出格式串即可。

### 21.5 冷启动 fallback

`chat-snapshot.pickPersonSummary()` 在 aiPerson 有 replyPrompts 时,把 `replyPromptsActive: string[]` 写到 snapshot。**冷启动 chat-app 即使 SDK 没就绪也能渲染真实计数**(三层保险,见 §19.4)。

### 21.6 UI 入口

`prompt-manager-page.js` 是数据驱动的真实 UI(无 demo 数据):
- 「当前上下文」= listActive,支持 toggle/上移/下移/编辑/删除
- 「可用 Prompt」= list − listActive,同上
- 所有按钮走 `data-app-action` 派发,methods 落在 chat-app/index.js:
  - `toggleReplyPromptActive` / `moveReplyPromptUp` / `moveReplyPromptDown`
  - `openEditReplyPromptModal` / `openCreateReplyPromptModal`
  - `deleteReplyPrompt`(走 framework 顶层确认弹窗)

新增 / 编辑共用 `EditReplyPromptModal` Vue 组件(`chat-modal-registry.openEditReplyPrompt()`)。

### 21.7 集成 AI SDK 的最小步骤

```js
// 1) 拿到构造器(window 已暴露,直接调)
const builder = window.__chatPromptBuilder;

// 2) 在 sendReply / callAi 里调
async function callAi(aiPersonId, mode, history) {
    const { systemPrompt } = await builder.build({
        aiPersonId, mode, historyLimit: 20,
    });
    // 3) 把 systemPrompt 喂给 AI SDK
    return await yourAiSdk.chat({
        model: 'gpt-4o',
        system: systemPrompt,
        messages: history,
    });
}
```

**不要**自己拼 prompt 文本,业务重复造轮子。

### 21.8 详情

详见 `js/apps/chat-app/README.md` §X.8(120+ 行,带流程图 + 验收清单 + 全部改动文件)。

---

## 28. 业务 state 持久化黄金规则(v0.61.7.3,2026-08-08)

**核心规则**:`app.state.*` **永远不是持久化存储**,刷新即丢。

任何业务自定义 state 子树必须显式持久化到 localStorage 或 IndexedDB,并在 hydrate 时同步加载。

**三段式模板**:

```js
// 1) 加载函数
function _loadXxx() {
    try {
        const raw = localStorage.getItem('xiaoting::xxx-v1');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) { return {}; }
}

// 2) 保存函数
function _saveXxx(map) {
    try {
        localStorage.setItem('xiaoting::xxx-v1', JSON.stringify(map || {}));
    } catch (_) { /* 隐私模式 / 配额满 */ }
}

// 3) hydrate 第一步同步加载
async hydrate() {
    if (!this.app.state) this.app.state = {};
    if (!this.app.state.xxx) this.app.state.xxx = _loadXxx();
    ...
}
```

**渲染兜底双重**:渲染函数也要在内存为空时直接读 localStorage(防 HMR / 旧 chat-app 实例不重跑 hydrate):

```js
let map = app?.state?.xxx;
if (!map || Object.keys(map).length === 0) {
    try {
        const raw = localStorage.getItem('xiaoting::xxx-v1');
        if (raw) {
            map = JSON.parse(raw);
            if (app?.state) app.state.xxx = map; // 回填内存
        }
    } catch (_) {}
}
map = map || {};
```

**反例(已踩坑)**:
- `chat-app/index.js` 的 `systemPromptOverrides` 写 localStorage 但 hydrate 不读回,刷新后 system prompt 编辑「不生效」
- `chat-app/index.js` 的 `contextOrder` 只在内存,刷新后 prompt-manager 顺序回退
- 诊断台词:「保存按钮生效了但 X 改了不生效」99% 是这个规则违反

---

## 29. `renderXxxCard` class 串必须对齐 selector(v0.61.7.3,2026-08-08)

**核心规则**:`renderXxxCard` 输出什么 class,所有 `querySelectorAll(...)` selector 必须严格用相同 class。漏写一个 class = 整个 selector 链失效 + 零报错 + 用户体验是「按钮没反应 / 拖不动」。

**反例(已踩坑)**:
- `chat-app/pages/prompt-manager-page.js` 的 `renderPromptControlCard`(用于 system prompt / library / context-rounds / world / 第三方 app prompt 的卡片)class 串只有 `pm-item pm-item--control`,**漏写 `pm-card`**。但 `savePromptManagerChanges` 用 `.pm-card.pm-item` 选卡片,`prompt-drag-controller` 用 `.pm-card` 选卡片 → 这些卡全部被 selector 漏选,「保存按钮写完不变」「system 卡拖不动」

**建议模式**:写一个 `getXxxCardClasses()` 工具函数 + 单点维护,所有 selector 都用这个函数:

```js
function getCardClasses(opts = {}) {
    const parts = ['pm-card', 'pm-item'];
    if (opts.control) parts.push('pm-item--control');
    if (opts.library) parts.push('pm-item--library');
    return parts.join(' ');
}
```

**诊断台词**:
- 「按钮按了没反应 / 拖拽不触发」 → 先 grep `querySelectorAll` 的 selector 跟 `renderXxx` 的 class 串对比
- 「一类卡片被选中,另一类没被选中」 → 90% 是 `renderXxx` 漏写共同 class

---

## 30. SDK API ≠ 业务全部意图,数据按字段拆分存储(v0.61.7.3,2026-08-08)

**核心规则**:`sdk.X.setOrder(...)` 只持久化 sdk 自己能识别的 id 子集,**业务把所有 id 都传给它 = 意图丢失**。

拖拽 / 重排 / 排序这类 UI 操作,SDK 只能管一部分,**业务必须把「SDK 不管的 id」单独持久化**。

**正确拆解模式**(以 prompt-manager 顺序为例):

| 字段 | 谁负责 | 落到哪里 |
|---|---|---|
| `aiPerson.replyPrompts[*].order` | SDK `replyPrompts.setOrder`(只接收 replyPrompts 自己的 id) | IndexedDB `sdkAiPersons.replyPrompts[]` |
| `app.state.chat.contextOrder[aiPersonId]` | chat-app `reorderContextPrompts`(接收完整 5 个 id) | localStorage `xiaoting::chat-context-order-v1`(v0.61.7.3 起) |
| `app.state.chat.systemPromptOverrides[aiPersonId]` | chat-app `saveSystemPromptOverride` | localStorage `xiaoting::chat-system-prompt-overrides-v1` |

**反例(已踩坑)**:
- v0.61.7.1 把 activeList 改成 `sdk.replyPrompts.list()`,但 `reorderContextPrompts` 还在调 `nookSdk.prompts.reorder()` → 写到 `aiPerson.nookPrompts[]`,跟 toggle/edit/delete 操作的 `aiPerson.replyPrompts[]` 是两份独立数据 → 「保存按钮写完 order 不变」
- v0.61.7 把完整 5 个 id 传给 `sdk.replyPrompts.setOrder`,但 SDK 只过滤 `aiPerson.replyPrompts[]` 里有的 id,其余 4 个虚拟 id 全部被跳过 → 「SDK 顺序没变」
- 业务完整顺序数组(含 SDK 不管的 id) → 业务持久化 + SDK 单独持久化自己那部分 → 渲染时「业务完整顺序」+「SDK 子集排序」叠加

**诊断台词**:
- 「保存生效、顺序不生效」 → 99% 是 `state.X` 没持久化 + SDK API 只能处理部分 id
- 「拖拽后 DOM 顺序变了,但 SDK 缓存没变」 → `setOrder` 把不存在的 id 全部跳过了,真实数据没动
- 「切换 app 后数据丢失」 → 业务把 X 写到 `state`,但 state 不持久化(详见 §28)

---

## 31. 禁用按钮必须留位置、留文案、disabled(v0.61.8.10,2026-08-08)

**核心规则**:表达「不可用」的方式有两种——把按钮整个删掉(消失) vs 把按钮留在原位但置灰(disabled)。**永远选后者**,因为:
- 用户能看到**位置一致性**:「这个按钮应该在这里,但现在我不能点」
- 状态恢复简单:从灰恢复成可点,跟原来一模一样
- framework click 委托走原路径,不用重新挂载 DOM

**正确写法**:

```js
// ✅ 留位置 + 改文案 + disabled
const pullBtnClass = isImported ? 'pm-chip pm-chip--pull pm-chip--pulled' : 'pm-chip pm-chip--pull';
const pullBtnLabel = isImported ? '已拉取' : '拉取';
const actionsHtml = `
    <button type="button" class="${pullBtnClass}"
        data-app-action='${escapeHtml(JSON.stringify({
            action: 'appMethod', appId: 'chat', method: 'pullReplyPromptFromLibrary',
            payload: { aiPersonId, promptId: pr.id },
        }))}'
        ${isImported ? 'disabled' : ''}
        title="...">
        <svg ...></svg>
        <span>${pullBtnLabel}</span>
    </button>`;
```

```css
/* ✅ 灰态样式 + cursor:not-allowed + opacity 衰减 */
.app-shell .pm-chip--pulled,
.app-shell .pm-chip--pulled:hover {
    color: #B0B0B5;
    background: rgba(120, 120, 128, 0.08);
    cursor: not-allowed;
    opacity: 0.6;
}
.app-shell .pm-chip--pulled:active {
    transform: none;
}
```

**反例(已踩坑)**:
- ❌ 把按钮整个换成对勾(`<span class="pm-library-check">✓</span>`),用户根本意识不到「这条已被当前 AI 人设拉过」→ 反复点击同一个位置,UI 没反馈,体验诡异
- ❌ 只加 CSS `opacity: 0.5` + `pointer-events: none`(framework click 委托依然会被拦,绕过去又会触发底层 method)

**关键事实**:`<button disabled>` 浏览器原生拦截 click → framework 顶层 click 委托自动失效 → **业务代码不用写任何禁用判断逻辑**。SDK 内部去重(例如 `sourceLibraryPromptId`)保留作为**最后防线**(用户绕过 disabled 直接调 method 时兜底)。

**诊断台词**:
- 「按钮没变 / 按钮消失 / 按钮变灰又重新可点」 → 先看 DOM 上是否还有「拉取」按钮 + `disabled` 属性
- 「库区按钮点了没反应 / 用户反复拉取同一 prompt」 → grep `pm-library-check`(老对勾残留)

---

## 32. async renderMode 下的 detail 重画 = 二段式(v0.61.8.10,2026-08-08)

**核心规则**:业务代码触发 detail 重画,必须走 `invalidateRendererCache(appId, null)` + `bridge.syncNow({ force: true })` 二段式。**禁止**用 `window.__detailRenderTick.value++`。

**为什么禁止 `++tick`**(AGENTS.md §27 已沉淀,这次第三次踩坑):
- `__detailRenderTick.value++` 在 async renderMode 缓存命中时**不会触发重画** → SDK 数据已写,但 UI 不刷新
- 即使走重画路径,enqueue 时机 + lastKey 写入时机不一致 → **死循环温床**(console 几百次/秒刷 `[bridge:debug] syncRenderer called`)

**正确写法**(任何 SDK 写入操作后):

```js
// ✅ 二段式重画:invalidate cache + force syncNow
try {
    if (typeof window.invalidateRendererCache === 'function') {
        window.invalidateRendererCache('chat', null);
    }
} catch (_) {}
try {
    window.__appRendererBridge?.syncNow?.({ force: true });
} catch (_) {}
this.toolkit?.island?.notify?.('success', '已拉取', created.title);
```

**二段式分工**:
- `invalidateRendererCache(appId, null)`:清掉 app 的 detail renderer 缓存,下次 `mountInto` 必须重新调 `renderer(content, page, app)` 拿最新 HTML
- `syncNow({ force: true })`:跳过所有 inFlight 锁 + tick 比较,**强制重画**

**适用范围**:任何 SDK 写入操作(`add` / `update` / `remove` / `toggleActive` / `setOrder` / `pullFromLibrary` / ...)写完后,**必须**走二段式重画。

**反例(已踩坑)**:
- ❌ `pullReplyPromptFromLibrary` 写入 SDK 后 `__detailRenderTick.value++` → async renderMode 缓存命中,nook 组不出现新卡片
- ❌ 早期所有 method 都用 `++tick` → 全部统一改二段式

**诊断台词**:
- 「SDK 数据写对了但 UI 没刷新」 → grep `__detailRenderTick.value++` 看是否还在用老的 tick 触发
- 「拉取/删除/移动按钮按了没反应」 → 99% 是「写了 SDK 但没 invalidate cache」或「invalidate 了但没 syncNow」

---

## 33. nook 组 = replyPrompt 全集,不按 active / source 过滤(v0.61.8.10,2026-08-08)

**核心规则**:`pulledFromLibrary = replyPromptsList.slice()`,**不做任何过滤**。不论 active 与否、不论 sourceLibraryPromptId 是否存在,都展示在「可用 Prompt → Nook 组」。

**为什么全集**:
- **跟其他 prompt 区域对齐**:system prompt / 第三方 App Prompt / 当前聊天回合 都不做 active 过滤,replyPrompt 也必须这样
- **一致性能省下大量认知成本**:用户只学一次「关掉就是切视觉高亮,不消失卡片」
- 启停切换只在 toggle 视觉上反映(`关闭` / `启用` 哪个加 `is-active` class),**不影响卡片可见性**

**行为对称表**:

| 操作 | 「当前上下文」 | 「可用 Prompt → Nook 组」 |
|---|---|---|
| 启用(active=false → true) | ✅ 进入 | ✅ 保持可见(toggle 切「启用」高亮) |
| 关闭(active=true → false) | ❌ 退出 | ✅ 保持可见(toggle 切「关闭」高亮) |
| 删除 | ❌ 完全消失 | ❌ 完全消失 |

**反例(已踩坑)**:
- ❌ `pulledFromLibrary = inactiveList`(只过滤 active === false)→ 启用后 nook 组消失
- ❌ `pulledFromLibrary = filter(sourceLibraryPromptId)`(只过滤库拉来的)→ 普通自定义 prompt 不显示,用户「333」消失恶性 bug
- ❌ `pulledFromLibrary = filter(active === false && sourceLibraryPromptId)`(双重过滤)→ 只展示「库拉来且关闭的」,漏掉全部自定义 prompt

**正确写法**:
```js
// ✅ 不做任何过滤,全集
const pulledFromLibrary = replyPromptsList.slice();
```

**当前上下文**才是 active 过滤的归宿:
```js
let activeList = replyPromptsList.filter((p) => p && p.active !== false && !p.sourceLibraryPromptId);
```

**诊断台词**:
- 「切换启停后卡片在 nook 组消失」 → 99% 是 `pulledFromLibrary` 过滤了 `active === false`
- 「自定义 prompt 不显示在 nook 组」 → 99% 是 `pulledFromLibrary` 过滤了 `sourceLibraryPromptId`
- 「`pulledFromLibrary` 漏过滤了某类 prompt」 → 检查过滤条件是否对所有 replyPrompt 一视同仁,黄金规则 = **`.slice()` 全集**

---

## 36. K 链 toggle 状态字段必须严格穿透到所有渲染层(v0.63.2,2026-08-08)

**核心规则**:Murmur 组里的「虚拟系统级卡」(回复格式 / 当前聊天回合 / K 链)的 toggle 状态必须**用一个字段**贯穿三个渲染层,不能「拆分语义」「默认兜底」「别名解构」。一旦某层用了错误的局部变量,**视觉 toggle 卡死 + 关闭后卡片还在当前上下文**双重 bug。

### 36.1 三层穿透模型

以 K 链为例:

| 层 | 字段 | 用途 |
|---|---|---|
| `renderAppPromptGroupSection` 子函数入参 | `kChainActive` | ctx 传入,等于「总开关 && 个人 toggle」 |
| Murmur 组 control-card | `items.push({ active: kChainActive })` | 控制卡上 segmented-tabs 反映当前状态 |
| 当前上下文 systemActiveItems | `if (kChainActive) systemActiveItems.push({...})` | 控制卡是否进入「当前上下文」区 |

**禁忌**:
- ❌ 子函数用 `const { kChainInjected = true } = ctx;` 当「默认兜底」—— **ctx 里没有 `kChainInjected` 这个 key,解构出来永远是 `true`** → toggle 卡死 + 关闭后卡片还在
- ❌ Murmur 组里 `active: kChainInjected` 用 ctx 没传的字段
- ❌ systemActiveItems 用 `if (kChainVisible)`(只看总开关)而不是 `if (kChainActive)`(总开关 && 个人 toggle)—— 关闭按钮按了卡片还在
- ❌ `kChainVisible`(总开关)和 `kChainActive`(个人 toggle)混淆:Murmur 组可见性用 `kChainVisible`,当前上下文可见性用 `kChainActive`

### 36.2 v0.63.2 K 链最终语义

| 状态 | Murmur 折叠组(可用 Prompt) | 当前上下文区 | AI systemPrompt 注入 |
|---|---|---|---|
| 总开关 ON + 启用 | ✅ 出现(启 toggle 高亮) | ✅ 出现 | ✅ 注入 |
| 总开关 ON + 关闭 | ✅ 出现(关 toggle 高亮) | ❌ 消失 | ❌ 不注入 |
| 总开关 OFF | ❌ 整组不显示 | ❌ 消失 | ❌ 不注入 |

### 36.3 反例(已踩坑)

```js
// ❌ v0.63.2 第一次实现,踩了三个坑:
function renderAppPromptGroupSection(ctx) {
    const {
        kChainVisible = true,
        kChainActive = true,
        // ★ 致命错误:ctx 里没有 kChainInjected,默认 true 永远生效
        kChainInjected = true,
    } = ctx;

    // 坑 1:Murmur 卡 active 用了 ctx 没传的字段 → toggle 永远 = 启用
    items.push({ ..., active: kChainInjected });

    // 坑 2:systemActiveItems push 用了 kChainVisible(只看总开关)
    //   → 关闭按钮按了,卡片还在当前上下文(用户原话恶性 bug)
    if (kChainVisible) systemActiveItems.push({...});
}
```

### 36.4 正确写法

```js
function renderAppPromptGroupSection(ctx) {
    const {
        kChainVisible = true,  // 总开关(只控制 Murmur 组可见性)
        kChainActive = true,   // 个人 toggle(控制卡 + 当前上下文可见性)
    } = ctx;

    // Murmur 组:总开关 ON 就显示,卡上 toggle 反映 kChainActive
    if (kChainVisible) {
        items.push({ ..., active: kChainActive });
    }

    // 当前上下文区:kChainActive 才 push(总开关 && 个人 toggle 都开)
    // 关闭按钮按了 → 卡片从当前上下文消失
    if (kChainActive) systemActiveItems.push({...});
}
```

### 36.5 诊断台词

- 「K 链 / 回复格式 / 当前聊天回合 toggle 卡在启用」 → 子函数解构时加了 ctx 没有的字段带默认值,grep `const { kChainInjected` / `const { replyFormatInjected` / `const { contextRoundsInjected`
- 「关闭按钮按了,卡片还在当前上下文区」 → `systemActiveItems.push` 条件用了 `kChainVisible` 而非 `kChainActive`
- 「Murmur 组里 toggle 跟当前上下文显示不同步」 → 三层没用同一个字段,grep `active:` 在 push 时的字段名 vs segmented-tabs 模板里的字段名

---

## 37. AI 表情包 + AI 偷用户表情包(v0.64, 2026-08-08)

### 37.1 一句话

prompt-manager「Nook」组新增「AI 表情包库」虚拟系统级卡,跟「K 链」「回复格式」同款三层穿透模型。AI 输出 `[表情包:名称]` 时,如果用户历史发过同名表情,自动把那个图组「偷」到 `aiPerson.boundResources.stickerGroupIds`。

### 37.2 表情包发送格式

```
[表情包:表情名称]
```

例:`[表情包:狗-哭]`、`[表情包:蝴蝶-飞飞]`、`[表情包:开心]`

跟其他特殊动作同款:`[发红包:88:祝福]`、`[发位置:xxx:xxx]`、`[发图片:#xxx:#xxx:描述]`。AI 直接输出这种格式串,系统自动解析为 sticker 消息。

### 37.3 数据存储

| 数据 | 位置 | 说明 |
|------|------|------|
| AI 可发表情包图组 | `aiPerson.boundResources.stickerGroupIds[]` | 走 `sdk.aiPersons.update({boundResources:{stickerGroupIds:[...]}})` |
| AI 表情包注入开关 | `app.state.chat.stickerLibraryInject[aiPersonId]` + localStorage `xiaoting::chat-sticker-library-inject-v1` | 跟 `replyFormatInject` / `kChainActive` 同款三段式持久化 |
| AI sticker 消息 | `chatMessages.add(type='sticker', stickerCode, url, stickerName, content='[表情包]xxx')` | 跟用户 sticker 同款,共用 `text-bubble.js case 'sticker'` |

### 37.4 偷表情包机制

```js
// ai-service.js 提供的两个公开 helper
await _stealStickerIfNeeded(aiPersonId, mode, stickerName, userHistory);
// → { stolen:boolean, stickerCode:string, groupId:string, sourceGroupName:string }

await _resolveAiStickerFromHistory(msg, aiPersonId, mode, userHistory);
// → 改造后的 msg: stickerCode + url 已填,aiStickerUnresolved 标记偷不到
```

**触发时机**:`sendMessageWithAi` 写盘循环里,**写盘前**调用 `_resolveAiStickerFromHistory`。

**偷的语义**:用户发过的 sticker(stickerName/stickerCode 跟 AI 输出名称匹配)→ 反查 `gallery_db.images` 拿 groupId → 加进 `aiPerson.boundResources.stickerGroupIds`(整组偷,不是单图)。

### 37.5 三层穿透模型(跟 K 链 / 回复格式完全对齐)

| 层 | 字段 | 用途 |
|-----|------|------|
| `renderAppPromptGroupSection` 子函数入参 | `_stickerActive` | 决定卡上 segmented-tabs 高亮 |
| Nook 组 control-card | `isActive` 反映 `_stickerActive` | 启停视觉 |
| 当前上下文 systemActiveItems | `if (stickerLibraryInjectAvailable) systemActiveItems.push({id:'sticker-library',...})` | 是否进入「当前上下文」区 |

**禁忌**:
- ❌ nook 组 push 字段用错(比如 `systemActiveItems.push` 条件用了 `_stickerActive` 但 nook 组 item 用的是 `stickerLibraryInjectAvailable`)
- ❌ 偷表情包后没调 `invalidateRendererCache` → 用户切到 prompt-manager 看不到新加的 sticker 组
- ❌ `_resolveAiStickerFromHistory` 不 await 就在 add() 里用 → sticker 消息 url 为空,渲染破图

### 37.6 编辑入口跳 settings

「AI 表情包库」卡上「编辑」按钮 → `openSystemPromptEditor({kind:'sticker-library'})` → 跳 `settings → 人设编辑器 → 资源绑定 → 表情包`:

```js
toolkit.actions.openApp('settings', detailPageId, {
    focusSection: 'resources',
    resourceKind: 'sticker',
});
```

settings 那边需要识别这两个 payload 字段自动滚到「表情包库」section(settings 端后续实现)。

### 37.7 踩坑沉淀

1. **prompt-builder 是 async**:`_renderAiStickerLibraryBlock` 内部 await `getGroupImages`,build() 必须 await 它。
2. **localStorage 兜底加载**:每次 prompt-manager 渲染时内存为空 → 直接读 `xiaoting::chat-sticker-library-inject-v1` → 回填到 `app.state.chat.stickerLibraryInject`(§28 三段式)。
3. **写盘前必须 await**:`_resolveAiStickerFromHistory` 拿到 url(读 source base64 是 IO)才能 `sdk.chatMessages.add(resolvedMsg)`。否则落库的 sticker 没 url → text-bubble 渲染破图。
4. **灵动岛通知分两档**:
   - 偷成功 → 「AI 偷了一张表情」「xxx 来自 xx」(success)
   - 偷不到 → 「AI 想发表情包」「xxx 不在用户资源里」(info)
   - 避免静默失败让用户困惑。
5. **AI sticker 消息降级渲染**(已知 v0.64 缺陷,下版修):`stickerCode=''` + `url=''` 时 text-bubble.js `case 'sticker'` 输出空 `<img>` → 破图。后续要加 `aiStickerUnresolved` 分支兜底显示「[表情包]开心（AI 自己想的，未找到图片）」placeholder。
6. **不要给 aiPerson.boundResources 整对象覆盖**:`sdk.aiPersons.update(id, {boundResources:{...otherFields, stickerGroupIds:[...]}})` 必须 spread 其他字段(avatarGroupIds / apiRefs / promptIds),否则会把其他资源绑定清空。`_stealStickerIfNeeded` 内部已经做了 `...ai.boundResources` 展开。
7. **不要用 emoji-picker 的 `stickerGroupIds`**:那是用户资源(`users.getActive().boundResources.stickerGroupIds`),跟 AI 资源(`aiPerson.boundResources.stickerGroupIds`)是两套,别读错。

### 37.8 诊断台词

- 「AI 输出 [表情包:xxx] 但 chat 里只显示空气泡」 → `_resolveAiStickerFromHistory` 没 await,或 url 加载失败
- 「AI 偷了表情包但 prompt-manager 看不到新组」 → 偷完没调 `invalidateRendererCache('chat', null)` + `bridge.syncNow({force:true})`
- 「AI 表情包卡 toggle 按了无反应」 → `toggleSystemPromptInject` 没加 `kind === 'sticker-library'` 分支,或者 `_renderAiStickerLibraryBlock` 的开关判断错了字段名
- 「关掉 AI 表情库 toggle 但 systemPrompt 还在注入」 → prompt-builder.build 调用方没传 `opts.stickerLibraryInject` / 传错了字段名
- 「stickerGroupIds 加进去了但 prompt 里没显示新表情」 → `_renderAiStickerLibraryBlock` 内部 `getGroupImages` 没读到,可能 aiPerson.boundResources.stickerGroupIds 字段没真正写入(mergePatch 漏展开)

### 37.9 改动文件速查

| 文件 | 关键改动 |
|------|----------|
| `js/apps/chat-app/services/ai-service.js` | `_parseOneToken` 加 `case '表情包'`；`segmentsToMessages` 加 `case 'sticker'`；新增 `_stealStickerIfNeeded` + `_resolveAiStickerFromHistory` |
| `js/apps/chat-app/services/prompt-builder.js` | 新增 `_renderAiStickerLibraryBlock`；build() 在 replyFormatBlock 之前 push；SPECIAL_ACTIONS_HELP 加表情包格式 + 不要瞎编的提示 |
| `js/apps/chat-app/pages/prompt-manager-page.js` | 新增 `renderStickerLibraryControlItem`；nook 组 push `_isStickerLibrary` item；`systemActiveItems.push` 加 sticker-library；读 stickerLibraryInjectAvailable 状态 |
| `js/apps/chat-app/index.js` | 新增 `toggleStickerLibraryActive`；`toggleSystemPromptInject` / `openSystemPromptEditor` 加 sticker-library 分支；`sendMessageWithAi` 写盘循环调 `_resolveAiStickerFromHistory` + 灵动岛通知 |

---

最后:如果读到这里仍有疑问,按优先级排查:

1. `src/core/app-renderer.js` —— 三模式调度器
2. `src/core/island-components.js` —— 内置 island 组件
3. `js/framework/app-renderer-bridge.js` —— framework 接入点
4. `js/apps/prompt-survey.js` —— 完整业务范例
5. **§18 「业务 DOM 操作的禁止做法」** —— 一旦觉得「要自己拼 DOM 了」,先看这里
6. **§21 「chat-app 回复提示词」** —— 要接 AI SDK / 改 prompt-manager / 改 replyPrompts 数据层,先看这里
6. **§34 「v0.62.x 回复格式与聊天风格」** —— 改 Murmur 组 / 改 prompt-builder 末尾注入 / 改 systemActiveItems 时,先看这里
7. **§36 「v0.63.2 K 链 toggle 三层穿透」** —— 改 K 链 / 任何「虚拟系统级卡」的 toggle 状态时,先看这里
8. **§39 「v0.66.1 modal promptPrefix 隔离」** —— 改 SummaryEditModal / 任何 AI 生成 modal 时,先看这里
9. **§40 「v0.66.1 apiSdk.listKeys() 不存在」** —— 改 _generateDaySummary / 任何调 API Key SDK 的代码时,先看这里
---

## 34. 「可用 Prompt → Murmur」新增虚拟卡 = 三处必改(v0.62.x,2026-08-08)

**核心规则**:在 prompt-manager「可用 Prompt → Murmur 折叠组」里新增一张「虚拟系统级卡」(类似「当前聊天回合」),**必须同时改 3 处**:

| # | 位置 | 作用 | 漏改后果 |
|---|---|---|---|
| ① | `renderMurmurGroup()` / `renderAvailableMurmurPrompts()` | 在「可用 Prompt → Murmur」渲染**控制卡**(`pm-card pm-item pm-item--control pm-item--in-available`) | 提示词库不显示这张卡 |
| ② | `systemActiveItems.push({...})` | 在「当前上下文」渲染**实际卡**(跟 enabled 的 nook/world/context-rounds 同级) | 用户**启用 toggle 后,「当前上下文」区看不到对应卡片**,看似「启用了但没起作用」 |
| ③ | `fullContextPreview` / `prompt-builder.build()` 末尾 | 在 AI 真实 `systemPrompt` 里注入**实际生效的文本** | AI 完全不会遵守这张卡的指令,只有 UI 看起来生效 |

**为什么三处必须齐**:
- ① 跟 ② 看起来是「同一张卡」,但 code 上是两个独立函数:
  - 「可用 Prompt」里那张是 **control-card**(灰态,可启停,可拖,可编辑),class 串必须带 `pm-card pm-item pm-item--control pm-item--in-available`
  - 「当前上下文」里那张是 **active-card**(绿色高亮,可拖,可上移下移),class 串不带 `--in-available`,带 `is-active` / `is-system` 系列
- ③ 跟 ①② 完全不同层:①② 只是 UI 表现,真正写入 AI `systemPrompt` 的位置是 `prompt-builder.build()` 末尾的 `opts.replyFormatInject.enabled` 分支
- **反例(已踩坑)**:`reply-format` 卡新增时只改了 ① / ③,漏改 ② → 用户点启用(灰 → 绿),但「当前上下文」区看不到对应卡片,「预览」能看到(预览直接拼 SPECIAL_ACTIONS_HELP + REPLY_STYLE_INSTRUCTIONS),**用户分了 30 分钟确认是否启用成功** → 实际是「systemActiveItems 没 push」

**正确写法**(v0.62.x 实际代码,以 `reply-format` 为例):

```js
// ① 可用 Prompt → Murmur 控制卡
function renderAvailableMurmurPrompts(opts) {
    const items = [];
    // ...
    // 当前聊天回合卡(原有)
    if (!contextRoundsActive) {
        items.push(renderPromptControlCard({
            id: 'context-rounds',
            title: '当前聊天回合',
            content: contextRoundsText,
            source: 'murmur',
            // ...
        }));
    }
    // ★ v0.62.x 新增:回复格式与聊天风格
    if (!replyFormatInjectActive) {
        items.push(renderPromptControlCard({
            id: 'reply-format',
            title: '回复格式与聊天风格',
            content: [SPECIAL_ACTIONS_HELP, REPLY_STYLE_INSTRUCTIONS].join('\n\n'),
            source: 'reply-format',
            // ...
        }));
    }
    return items.join('');
}

// ② 当前上下文 → systemActiveItems(必须 push,否则当前上下文看不到)
const systemActiveItems = [];
visibleSystemPrompts.forEach((sp) => { /* ... */ }); // 用户/AI 人设
if (worldPrompt && worldPromptActive) { /* ... */ }  // 世界观
if (contextRoundsText && contextRoundsActive) { /* ... */ } // 当前聊天回合
// ★ v0.62.x 新增:回复格式与聊天风格
if (replyFormatInjectAvailable) {
    systemActiveItems.push({
        id: 'reply-format',
        title: '回复格式与聊天风格',
        content: [SPECIAL_ACTIONS_HELP, REPLY_STYLE_INSTRUCTIONS].join('\n\n'),
        source: 'reply-format',
    });
}

// ③ ★ 注意「当前上下文顶部预览 pre」不要重复 push(2026-08-08 v0.63.x 踩坑)
//   - previewParts 已经从 orderedCards 把 systemActiveItems 的 content 都拼进去了
//     (reply-format 卡的 content 也是 SPECIAL_ACTIONS_HELP + REPLY_STYLE_INSTRUCTIONS)
//   - 如果再额外 `if (replyFormatInjectAvailable) { previewParts.push(SPECIAL_ACTIONS_HELP); previewParts.push(REPLY_STYLE_INSTRUCTIONS); }`
//     → pre 里会出现**两段一模一样的**「回复格式 + 聊天风格」,而且都在末尾
//     → 用户拖拽顺序怎么调都没用,因为这段兜底 push 永远在最尾巴
//   - 反例:v0.62.x 升级时为了「AI 看到的 = 预览看到的」一致性,加了兜底 push
//     当时 systemActiveItems 里没有 reply-format,所以兜底 push 是必要的;
//     后来 v0.62.x 补了 systemActiveItems.push(reply-format),但兜底 push 没删 → 重复拼接
//   - 修复:删掉兜底 push,只让 orderedCards / systemActiveItems 走 single source of truth
//   - 诊断台词:
//     - 「pre 末尾永远是同一段文本(回复格式 / 聊天风格 / 特殊动作)」
//       → grep `previewParts.push(SPECIAL_ACTIONS_HELP)` 或类似兜底 push
//     - 「pre 里有两段几乎一模一样的内容」
//       → 99% 是 ② + ③ 都拼了同一份 content,删一处即可

// 35. K链滚动摘要 AI 生成（v0.63,2026-08-08）

### 35.1 核心机制

**K链（滚动摘要链）** 用于压缩长聊天的上下文：
- **C窗口**：最近 N 个回合的原始消息（由 `contextRounds` 控制）
- **K链**：已压缩的梗概（当 C 窗口满了时触发）

**触发条件**：
- 当回合数 > `contextRounds` 时，把最早的 `kMergeSize` 个回合压缩成一个 K
- K 链超过 `maxChainLength` 时，合并最早的 2 个 K

**数据存储**：`aiPerson.socialProfiles.chat.rollingSummaries[]`

### 35.2 AI 生成梗概流程

```
触发 compressIfNeeded
    ↓
rollingSummaries.compressIfNeeded(aiPersonId, mode, messages, {
    generateSummary: async (rounds, opts) => {
        return await generateKChainSummary(rounds, opts);
    }
})
    ↓
generateKChainSummary():
    1. 格式化回合列表 → roundsText
    2. 构造压缩专用 system prompt
    3. 查找 API key → executeApiRequest
    4. 返回梗概文本
    ↓
compressIfNeeded 写入 K 链（content = 梗概）
```

### 35.3 涉及文件改动

| 文件 | 改动 |
|------|------|
| `js/apps/chat-app/services/ai-service.js` | 新增 `generateKChainSummary()` 函数 |
| `js/apps/setting/world/sdk/rolling-summaries.js` | `compressIfNeeded` 新增 `generateSummary` 回调参数 |
| `js/apps/chat-app/index.js` | 导入 `generateKChainSummary`，传入 `compressIfNeeded` |

### 35.4 generateKChainSummary 函数签名

```js
export async function generateKChainSummary(rounds, opts = {}) {
    // rounds: 回合数组，每项 = [{sender, content, ...}, ...]
    // opts.aiPersonId: AI人设ID
    // opts.mode: 'calendar' | 'story'
    // opts.summaryStyle: 'concise' | 'detailed'
    // 返回: { ok: boolean, summary: string, error?: string }
}
```

### 35.5 压缩 Prompt 模板

```js
const systemPrompt = `# 压缩任务
你是一个对话压缩助手...
压缩规则：
- 简洁风格：1-3句话概括核心内容
- 保留关键信息：主要话题、人物互动、情感基调
- 直接输出梗概，不要前缀说明
- 语言风格自然，像在描述"用户和AI聊了什么"
...`;
```

### 35.6 只记录今天的聊天

**实现位置**：`index.js` 的 `computeContextRoundsPrompt` 方法：
```js
// v0.61.8.12 只保留「今天的聊天记录」
const _dayStart = new Date(...).getTime();
const _dayEnd = new Date(...).getTime();
const todayList = list.filter(m => {
    const ts = Number(m.timestamp) || 0;
    return ts >= _dayStart && ts <= _dayEnd;
});
```

### 35.7 预防踩坑

1. **async/await 必须**：K链生成是耗时操作，必须 `async/await`
2. **容错兜底**：AI 生成失败时回退到占位文本
3. **通知用户**：用灵动岛通知压缩结果，包含梗概预览

---

## 38. 日历概要三级联动(v0.66, 2026-08-08)

### 38.1 一句话

「日历视图 → 层级管理 → Prompt 管理」三级联动:日历单日详情 → 「生成概要」 → AI 生成 L1 → 用户在层级管理看到 → 一键应用进 prompt-manager 的 Murmur 组 → AI 下次回复会参考。

### 38.2 日历 prompt 模板占位符

`localStorage['xiaoting::calendar-prompt-template-{aiPersonId}-{mode}']`:

模板支持 4 个占位符,`_fillPromptPlaceholders` 自动替换:

| 占位符 | 来源 | 说明 |
|--------|------|------|
| `{{aiName}}` | `sdk.aiPersons.get(aiPersonId).name` | AI 人设名 |
| `{{userName}}` | `sdk.defaultUserCard.getDefault().name` / `sdk.users.getActive().name` | 当前用户名 |
| `{{dateRange}}` | `dateKey` 或 `start..end` | 日期范围 |
| `{{messages}}` | `_formatDayMessagesForPrompt(messages, aiName)` | 当天消息格式化(YYYY-MM-DD HH:MM [发送方]:内容) |

### 38.3 数据落点

| 数据 | 存储位置 | SDK 接口 |
|------|----------|----------|
| 概要记录 | IndexedDB `sdkMemorySummaries` | `sdk.memorySummaries.add(aiPersonId, {storageLevel, title, content, sourceLevel, sourceDates})` |
| 概要软删 | 同上 + `deleted: true` | `sdk.memorySummaries.softDelete(id)` |
| Murmur 组启用 | localStorage `xiaoting::chat-memory-summary-inject-v1` | 三段式 hydrate 同步加载 |
| 临时屏蔽 | 不写盘,只 `prompt-builder.build({opts.memorySummaryInjectOverride})` | `Set<summaryId>` |

### 38.4 prompt-manager 的 Murmur 组过滤

`renderAvailableMurmurPrompts()` 里:

```js
// ✅ 正确:排除 deleted + 默认 active=true(本次新生成的概要默认启用)
const memorySummaryList = (sdk.memorySummaries.list(aiPersonId) || [])
    .filter((s) => !s.deleted);
```

`renderMemorySummaryCard()` 渲染时加**层级徽章**(L1/L2/L3/L4 用不同颜色),toggle 走 `toggleSystemPromptInject({kind:'memory-summary', id})`。

### 38.5 应用入口跳转

「应用到 prompt 管理」按钮 → `openSystemPromptEditor({kind:'memory-summary', id})` → 跳 `settings → 人设编辑器 → Prompt 管理 → Murmur 组 → 该概要卡片`。

### 38.6 三段式持久化

跟 §28 同款:

```js
// 1) 加载
function _loadMemorySummaryInject() {
    try {
        const raw = localStorage.getItem('xiaoting::chat-memory-summary-inject-v1');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) { return {}; }
}

// 2) 保存
function _saveMemorySummaryInject(map) {
    try {
        localStorage.setItem('xiaoting::chat-memory-summary-inject-v1', JSON.stringify(map || {}));
    } catch (_) {}
}

// 3) hydrate 第一步
async hydrate() {
    if (!this.app.state) this.app.state = {};
    if (!this.app.state.chat) this.app.state.chat = {};
    if (!this.app.state.chat.memorySummaryInject) {
        this.app.state.chat.memorySummaryInject = _loadMemorySummaryInject();
    }
}
```

### 38.7 诊断台词

- 「日历生成的概要在 prompt-manager 看不到」 → grep `sdk.memorySummaries.list` 返回的过滤条件,可能漏 `deleted: true` 过滤
- 「应用概要按钮按了但 prompt-manager 没跳转」 → 检查 `openSystemPromptEditor` 是否加 `kind === 'memory-summary'` 分支
- 「AI 没参考概要回复」 → `prompt-builder.build()` 没传 `opts.memorySummaryInjectOverride`,或传了但 key 名写错
- 「层级徽章不显示」 → `renderMemorySummaryCard` 没读 `summary.storageLevel`,徽章节点漏写

---

## 39. modal promptPrefix 内部使用 ≠ 透到 textarea(v0.66.1, 2026-08-08)

**核心规则**:任何 AI 生成 modal(SummaryEditModal 之类),`promptPrefix` / `systemPrompt` / `mergedPrompt` 这类**「发给 AI 的指令模板」**字段,**必须只在内部 `onGenerate` 回调里透给 `_generateXxx`,绝不允许拼到 textarea(用户看得到的输入框)里**。

### 39.1 反例(已踩坑)

`chat-modal-registry.js` 的 `openSummaryEdit` 之前(v0.65.1)有一行:

```js
// ❌ v0.66 之前的实现
let mergedContent = initialContent || '';
const prefix = String(promptPrefix || '').trim();
if (prefix) {
    mergedContent = `${prefix}\n\n---\n\n${mergedContent}`.trim();
}
this._dispatch(SummaryEditModal, {
    initialContent: mergedContent,  // ← promptPrefix 拼到 textarea 初始内容
    ...
});
```

**问题**:用户打开 modal,textarea 里满满都是「发给 AI 的 prompt 模板 + 模板说明」,误以为「AI 已经生成好了概要」,但实际是 prompt 模板本身。

### 39.2 修复后(v0.66.1)

```js
// ✅ 正确:initialContent 原值直传(空串),promptPrefix 仅作为字段占位
openSummaryEdit({ mode, initialTitle, initialContent, promptPrefix, ... } = {}) {
    const safeInitialContent = String(initialContent || '');
    this._dispatch(SummaryEditModal, {
        initialContent: safeInitialContent,  // ← 空串,textarea 等 AI 生成
        ...
    }, {
        onGenerate: (payload) => {
            try { onGenerate?.(payload); } catch (err) { ... }
        },
        ...
    });
}
```

`promptPrefix` 参数保留为字段占位(后续如果需要可以透到 `_generateDaySummary`),**不要**拼到 textarea。

### 39.3 双层隔离清单

| 层 | 应该放什么 | 不应该放什么 |
|----|-----------|--------------|
| **modal `initialContent`** | AI 生成的概要正文(空串等 AI 生成) | ❌ prompt 模板 / system prompt / 内部指令 |
| **modal `initialTitle`** | 概要标题 | ❌ prompt 模板标题 |
| **modal `promptPrefix` prop** | 仅作为内部字段占位,**不在 template 里显示** | ❌ 透到 textarea |
| **`onGenerate` 回调 payload** | 概要标题 / dateRange / messageCount | ❌ 完整的 prompt 模板(用户在 modal 里看不到) |

### 39.4 诊断台词

- 「textarea 打开就有 prompt 模板内容」 → grep `mergedContent = promptPrefix + initialContent` 或类似拼接 → 删掉,只传 `initialContent` 原值
- 「modal 关闭后再打开 textarea 内容变了」 → modal 内部用了 `promptPrefix` 当 content 缓存
- 「用户能看到 prompt 模板但 AI 没收到」 → 模板只在 modal 里显示但没透到 `_generateXxx`
- 「用户看不到 prompt 模板但 AI 收到了」 → ✅ 正确状态,这是 v0.66.1 修复的目标

---

## 40. window.__apiSdk 没有 listKeys() 方法(v0.66.1, 2026-08-08)

**核心规则**:`window.__apiSdk` 暴露的是 `{apiKeySdk, apiGroupSdk, apiUsageSdk}` 三个 SDK,**没有** `listKeys()` / `getKeys()` 这类顶层便捷方法。所有 key 操作必须走 `apiKeySdk` 子对象的接口。

### 40.1 API 接口列表

```js
const apiSdk = window.__apiSdk;
// apiSdk = { apiKeySdk, apiGroupSdk, apiUsageSdk }

// apiKeySdk 接口(api-key-sdk.js:createApiKeySdk):
apiKeySdk.list()             // 全部 keys,按 sortOrder 升序
apiKeySdk.listEnabled()      // 只返回 enabled=true 的 keys
apiKeySdk.get(id)            // 单条
apiKeySdk.put(key)           // 写入
apiKeySdk.remove(id)         // 删除
apiKeySdk.executeRequest(...) // 执行 AI 请求(高级 API,自动选 key + fail-over)
apiKeySdk.testKey(...)       // 测试单条 key 是否可用

// apiGroupSdk 接口(api-group-sdk.js):key 分组管理

// apiUsageSdk 接口(api-usage-sdk.js):用量统计
```

### 40.2 反例(已踩坑)

```js
// ❌ v0.66 之前的实现
const keys = apiSdk.listKeys?.() || [];
const activeKey = keys.find((k) => k.isActive) || keys[0];
if (!activeKey?.apiKey) return { ok: false, error: '未配置 API Key' };
```

**问题**:`apiSdk.listKeys` 永远是 `undefined`,走 `|| []` 兜底 → `activeKey = undefined` → 「未配置 API Key」错误,**但 `__apiSdk` 实际是有的**(用户已经配过 key)。

### 40.3 修复后(v0.66.1)

```js
// ✅ 正确:走 apiKeySdk.listEnabled() / list()
const apiKeySdk = apiSdk.apiKeySdk;
let activeKey = null;
if (apiKeySdk) {
    const enabled = apiKeySdk.listEnabled?.() || [];
    const all = apiKeySdk.list?.() || [];
    activeKey = enabled[0] || all[0] || null;
}
if (!activeKey?.apiKey) {
    console.warn('[chat-app] _generateDaySummary: no apiKey found. apiSdk=', Object.keys(apiSdk || {}));
    return { ok: false, error: '未配置 API Key,请先在设置中添加' };
}
```

### 40.4 console.warn 诊断价值

永远加一行 `console.warn` 把 `Object.keys(apiSdk)` 打印出来 —— 万一以后 API 又变了,直接看 console 就知道走哪条路。

### 40.5 调试诀窍

「明明已经配了 key,但业务代码说『未配置 API Key』」:
1. `window.__apiSdk` 是不是真的有?`Object.keys(window.__apiSdk)` 看到底几个
2. 顶层有 `listKeys` / `getKeys` 这种便捷方法吗?**没有**,只有 `apiKeySdk.listEnabled` / `apiKeySdk.list`
3. `apiKeySdk.listEnabled()` 真的返回数组吗?可能 `enabled` 字段名是 `isEnabled` / `active` / `isActive`?检查 `chat-settings-page.js:566 [chat][renderChatSettings] savedType=key` 推断字段名
4. `apiKeySdk.list()` 返回的 keys 数组里,`apiKey` / `baseUrl` / `model` 字段名是不是对的?默认是 `apiKey` / `baseUrl` / `model`(参考 `js/apps/setting/defaults.js` 的 `API_*_DEFAULT`)

### 40.6 ESM 模块局部变量跨文件不可见(关键子规则)

**核心规则**:ESM 模块顶层 `let _currentXxx` / `const _currentXxx` 局部变量**只在**自己文件可见。**`index.js` 直接引用 `_currentSummaryEditInstance` → `ReferenceError`**。

**反例(已踩坑)**:

```js
// summary-edit-modal.js
let _currentSummaryEditInstance = null;  // ← 模块顶层,只在此文件可见

// index.js(错):
onGenerate: async (payload) => {
    const inst = _currentSummaryEditInstance;  // ReferenceError: _currentSummaryEditInstance is not defined
};
```

**修复**:

```js
// summary-edit-modal.js
function _setCurrentSummaryEditInstance(instance) {
    if (typeof window !== 'undefined') {
        window.__currentSummaryEditModal = instance;  // window 全局,跨文件可见
    }
}
function _getCurrentSummaryEditInstance() {
    if (typeof window === 'undefined') return null;
    return window.__currentSummaryEditModal || null;
}
export { SummaryEditModal, _getCurrentSummaryEditInstance };  // ← 关键:export 出去

// index.js(对):
import { _getCurrentSummaryEditInstance } from './components/summary-edit-modal.js';
onGenerate: async (payload) => {
    const inst = _getCurrentSummaryEditInstance();  // ✅ 拿到当前 instance
};
```

**两条等价路径**(任选其一):

1. **export 函数 + import**(推荐):类型安全,IDE 能跳转
2. **window 全局变量**(本例用了这种):防 ESM 子模块 import 路径搞错 / HMR 缓存不一致

**为什么用 window 而不是单纯 export**:
- chat-modal-registry 在 `chat-modal-registry.js` 里 import `SummaryEditModal` 时,**模块实例**是同一份(同一文件 = 同一 ESM module record)
- 但跨文件 import 在 Vite dev HMR 时可能拿到不同实例(HMR 重载新模块,旧 import 失效)
- `window.__currentSummaryEditModal` 永远指向「当前 mounted 实例」,HMR 后自动刷新,无依赖问题

### 40.7 诊断台词

- 「明明配了 key 但 AI 调用报未配置 API Key」 → grep `apiSdk.listKeys` / `apiSdk.getKeys`,改用 `apiKeySdk.listEnabled` / `apiKeySdk.list`
- 「ReferenceError: _currentXxxInstance is not defined」 → 模块顶层 `let _currentXxxInstance` 跨文件访问,改成 export 函数或 window 全局
- 「mounted hook 跑了但 instance 还是 null」 → 检查 export 出去的 getter 是不是从 window 读 + window 是不是有值(`console.log(window.__currentXxxModal)`)
- 「HMR 后 instance 还是旧的」 → 用 window 全局(§40.6 的第二条路径)

---

最后:如果读到这里仍有疑问,按优先级排查:

1. `src/core/app-renderer.js` —— 三模式调度器
2. `src/core/island-components.js` —— 内置 island 组件
3. `js/framework/app-renderer-bridge.js` —— framework 接入点
4. `js/apps/prompt-survey.js` —— 完整业务范例
5. **§18 「业务 DOM 操作的禁止做法」** —— 一旦觉得「要自己拼 DOM 了」,先看这里
6. **§21 「chat-app 回复提示词」** —— 要接 AI SDK / 改 prompt-manager / 改 replyPrompts 数据层,先看这里
6. **§34 「v0.62.x 回复格式与聊天风格」** —— 改 Murmur 组 / 改 prompt-builder 末尾注入 / 改 systemActiveItems 时,先看这里