# 制作 app 的 prompt（v2.0 · 对齐真实代码）

> 本文档是「App 制作 App」问卷 → 生成 prompt 的 **唯一事实来源**。
> 喂给 LLM 时，把文档第 3 章「完整 prompt 模板」原文发出即可。
> 问卷只决定哪些变量有值。

---

## 0. 一句话总览

**「App 制作 App」** 通过问卷收集配置 → 按本文档 §3 模板拼装 prompt → LLM 生成可在本项目运行的 appConfig 文件。

`appConfig` 是 Vue 全局 (`js/vendor/vue.global.prod.js`) 下注册到 framework 的配置对象。框架会按 `renderMode` 把它的 `renderPage()` 输出挂到主壳里。

---

## 1. 问卷字段表（11 题 + 完成页）

> 改动问卷 = 改 `prompt-survey.js` 的 `QUESTION_PROTOTYPES` 数组；
> 改模板 = 改本文档 §3。
> 两边都用 `id` 作为字段 key。

| #  | 标题 | 字段 key | 必填 | 类型 / 选项 |
|----|------|----------|------|------------|
| 0  | 基本信息 | `appName`, `appId`, `appDesc` | ✅ | 文本 |
| 1  | 页面规划 | `structure` (`tab` / `single`), `pages[]` | ✅ | 多页 |
| 2  | 顶栏设计 | `topbarType` | ✅ | 6 种 framework 原生 type |
| 3  | 视觉风格 | `style` | ✅ | 12 种设计语言 |
| 4  | 核心能力 | `features[]` (多选) | — | 14 种能力 |
| 5  | 小组件 | `needWidget`, `widgetSizes[]` | — | 开关 + 多选 |
| 6  | 灵动岛 | `needIsland` | — | 开关 |
| 7  | AI 对话 | `needAi` (调 API), `aiProvider`, `aiPersonaId` | — | 调 `__apiSdk` |
| 8  | 世界观 | `needWorld` (读 worldview) | — | 调 `settingsSdk.worlds/places/...` |
| 9  | 人设 | `needPersona` (读人设) | — | 调 `settingsSdk.aiPersons/persona/diary` |
| 10 | Prompt 库 | `needPrompt` (绑 prompt 组) | — | 调 `settingsSdk.prompts.*` |
| 11 | 完成页 | — | — | 仅 UI，不输出 prompt |

### 1.1 各字段映射（生成 prompt 时从这里取值）

```
appName         → 字符串，App 名称
appId           → 字符串，kebab-case，全局唯一
appDesc         → 字符串，功能描述
structure       → 'tab' | 'single'
pages[]         → [{ name, desc }]
topbarType      → 'standard' | 'title-only' | 'search' | 'segmented' | 'large-title' | 'buttons-only'
style           → 风格 key（见 §2.5）
features[]      → 任意组合，详见 §2.6
needWidget      → bool
widgetSizes[]   → ['S','M','L'] 子集
needIsland      → bool
needAi          → bool，调 AI API
needWorld       → bool，读世界观
needPersona     → bool，读人设
needPrompt      → bool，读 prompt 库
```

### 1.2 下载状态字段（必填，控制桌面可见性）

**所有 App 必须在 appConfig 里声明 `distribution`**。结构如下：

```js
distribution: {
    requiresInstall: true,                 // true = 内容型 App，先在 App Store 下载才上桌面
    installed: false,                      // 运行时由 installApp / uninstallApp 维护（系统启动时不要写死 true）
    appStore: {                            // 可选：App Store 上的展示元数据
        subtitle: '午后记录，专注当下',
        category: '工具',
        rating: 4.8,
        size: '28 MB',
        accent: 'linear-gradient(145deg, #FFD3A5, #FD6585)',
        // ... 任意字段都会被 App Store 读取展示
    },
}
```

- `requiresInstall: true` → 启动时桌面看不到，必须先在 App Store 下载完才出现
- `requiresInstall: false`（默认 / 系统级 App） → 启动即在桌面
- `installed` 永远是运行时字段：`installApp(appId, app)` / `uninstallApp(appId, app)` 会同时写入 `app.distribution.installed`、持久化、派发 `phone:app-installation-changed` 事件，让桌面 / App Store / 下载按钮全部一致刷新。

业务侧推荐用法：

```js
import { installApp, uninstallApp, isAppInstalled } from '@/src/core/app-installation.js';

// 自己的方法里：标记为已下载 / 已卸载（同步刷新桌面 + 商店）
installApp('my-app', this.app);
uninstallApp('my-app', this.app);

// 任何地方（toolkit、自定义事件、外部面板）查状态
isAppInstalled('my-app');   // true / false
```

框架默认 `apps.value = listLaunchableApps(externalAppRegistry.apps)`：所有可启动 app = 系统级 App 或 `requiresInstall=true && installed=true` 的 App。下载 / 卸载时自动重算。

详见 §4 「appConfig 模板」中 `distribution` 字段。

### 1.3 不放进问卷但生成 prompt 时动态拼的字段

- **`iconBg`**：由 `style` 风格色自动推出（见 §2.5 配色表）。
- **`icon`**：固定占位 SVG，业务 App 作者后续替换。
- **`background / statusBarColor / homeIndicatorColor`**：由 `style` 自动推出。

---

## 2. 完整问卷选项定义（prompt-survey 同步更新用）

### 2.1 顶栏 6 种 type（framework `appConfig.topbar.type` 字段对齐）

| value | label | 含义 |
|-------|-------|------|
| `standard` | 标准 | 标题 + 副标题 + App 名 pill |
| `title-only` | 仅标题 | 只显示主标题 |
| `search` | 搜索框 | 主区域被搜索框占据 |
| `segmented` | 分段控件 | 顶部水平切换 tabs |
| `large-title` | 大标题 | iOS 大标题风格 |
| `buttons-only` | 仅按钮 | 隐藏标题，只留 pill |

### 2.2 视觉风格（`style`）

| key | 标题 | 配色（bg / card / prim） |
|-----|------|--------------------------|
| `ios-blue` | 经典蓝 | `#F2F2F7 / #FFFFFF / #007AFF` |
| `dopamine` | 多巴胺 | `#FFF0F5 / #FFD700 / #FF69B4` |
| `cyberpunk` | 赛博朋克 | `#0A0A0F / #1C1C2E / #00FF9D` |
| `glass` | 毛玻璃 | `linear-gradient(135deg,#a8edea,#fed6e3) / rgba(255,255,255,0.2) / #5e60ce` |
| `morandi` | 莫兰迪 | `#E0E5DF / #F0F2F0 / #76877D` |
| `warm-sunset` | 暖阳落日 | `linear-gradient(180deg,#FFF5EB,#FFE4D6) / #FFFFFF / #FF6B35` |
| `ocean-deep` | 深海蓝 | `#0B1426 / #132040 / #4FC3F7` |
| `sakura` | 樱花粉 | `#FFF0F3 / #FFFFFF / #E91E8C` |
| `neumorphism` | 新拟态 | `#E0E5EC / #E0E5EC / #6C63FF` |
| `flat-minimal` | 扁平极简 | `#FFFFFF / #F5F5F5 / #333333` |
| `material-you` | Material You | `#FFFBFE / #FEF7FF / #6750A4` |
| `retro-pixel` | 像素复古 | `#2B2B2B / #3C3C3C / #FFD700` |

### 2.3 核心能力（`features[]`）

| value | 标题 | 影响 appConfig |
|-------|------|----------------|
| `ai` | AI 对话 | `needAi` 自动 true，调 `__apiSdk` |
| `db` | 本地存储 | `stores: [...]` 必填 |
| `camera` | 图片上传 | methods 写 `input[type=file]` 监听 |
| `charts` | 数据图表 | 引 `<canvas>` 或 SVG 自画 |
| `search` | 搜索功能 | 加 search 栏 |
| `pull-refresh` | 下拉刷新 | 业务自己实现 |
| `dark-toggle` | 暗色切换 | 加 toggle + 主题 class |
| `gesture` | 手势操作 | 加 pointer 事件 |
| `share` | 分享功能 | `toolkit.actions.share(...)` |
| `favorite` | 收藏点赞 | 业务自存 IndexedDB |
| `onboarding` | 引导页 | 业务多写一个 page |
| `notification` | 通知模拟 | `toolkit.island.notify(...)` |
| `settings` | 设置页面 | 走 `toolkit.actions.openApp('settings')` |
| `login` | 登录注册 | 表单 + IndexedDB 存凭证 |

### 2.4 widget / island

| widget 大小 | 默认形态 |
|-------------|----------|
| S (2x1) | 桌面小组件 |
| M (2x2) | 桌面小组件 |
| L (4x2) | 桌面小组件 |

| island 模式 | 说明 |
|-------------|------|
| quiet | 最小指示器 |
| mini | 单行小药丸 |
| medium | 图标+标题+副标题 |
| large | 大面板 |

---

## 3. ★★★ 喂给 LLM 的完整 prompt 模板 ★★★

> 这一节是真正发给 AI 的内容。问卷答案作为变量代入。

---

你是一个**软件工程师**。下面我将给你一份新的工作内容指导方案，请你根据这份方案编写一个**完整的可以使用的软件**。

首先在技术层面上，本项目使用浏览器全局 Vue（`js/vendor/vue.global.prod.js`），你需要使用：**Vue 3.5+ 与 现代 ECMAScript 语法**（es2015+ 覆盖到 ES2024 引入的新特性）。

项目真实版本：`vite@^5.4.10` + `tailwindcss@^3.4.19` + Vue 是浏览器全局（`js/vendor/vue.global.prod.js`），不是 npm 依赖。

文件格式是 JavaScript ESM，不是 Vue SFC。导入方式用 ESM：`import { escapeHtml } from '@/src/core/escape.js'`（路径别名 `@` 指项目根）。

在不影响可读性的前提下请善用语法糖，但在使用语法糖时，请注意本项目中的 app 注册配置 `appConfig` 上，有 3 个 framework 直接调用、并会被注入 `this` 的函数字段：

1. `methods: { ... }` 用户的按钮、计算、改状态都走这里
2. `services: { ... }` 给别的 App 调用的对外接口
3. `renderPage(content, page, app)` 把页面渲染成 HTML 字符串

这 3 个函数字段内部必须写成方法简写形 —— `name() { this.xxx }`；禁止使用 `=>` 箭头语法写成 `name: () => { this.xxx }`，因为箭头函数会忽略 framework 注入的 this。

> 注意：上面说的是「framework 直接调用那层函数」—— 这 3 个函数字段内部嵌套的回调函数（setTimeout / forEach / Promise.then / 数组方法链的回调）可以用箭头语法，因为这些回调函数不需要 framework 注入的 this。

此外还有一个容易踩坑的细节：`renderPage(content, page, app)` 是从 appConfig 上拿出来**当独立函数**调用的，因此 `this` 已经丢失。

- ❌ 不要在 `renderPage` 内部使用 `this.xxx`
- ✅ 把渲染逻辑拆成模块顶层函数，`renderPage` 只做 `if (page.id === 'xxx') return renderXxxPage(app)` 的路由分发

### 一些注意事项

1. 因为 `renderPage` 返回字符串会走 Vue 的 HTML 插值指令 `v-html` 注入，所以 UI 用内联 HTML + Tailwind 类名（项目已经预编译 Tailwind 到 `css/main.css`）。**用户输入 / DB 读出的字符串必须 `escapeHtml`**，否则 XSS。
2. 如果要用 `v-if` 等 Vue 指令，需要把 appConfig 里的 `renderMode` 渲染模式字段对应的值改为 `hybrid`（默认值是 `template`）。要写完整 Vue 组件用 `vue`。
3. 不要写 `target="_blank"` 不带 `rel="noopener noreferrer"`；不要 `eval`；不要把用户输入 / DB 字段直接拼 HTML（必须 `escapeHtml`）。
- 现代 ECMAScript 语法（es2015+ 覆盖到 ES2024）。
- Tailwind 已经在 `css/main.css` 里预编译，class 直接写。
- 项目路径别名 `@` 指向项目根。

**可调用 API（this.toolkit.xxx）**

下面这些是你能用的一切。本项目里你不需要自己造 API，全部通过 `this.toolkit` 拿。

```js
// 灵动岛（通知 + 持续态 + 小组件槽位）
this.toolkit.island.notify(type, title, msg, opts?)           // type: 'success' | 'error' | 'info' | 'warning'
this.toolkit.island.show(size, payload)                       // size: 'mini' | 'medium' | 'large'
this.toolkit.island.toggle(size, payload)
this.toolkit.island.close(reason?)
this.toolkit.island.registerWidget(widgetConfig)
this.toolkit.island.previewWidget(qualifiedId, opts?)

// IndexedDB（要先在 appConfig.stores 声明数据表）
this.toolkit.db.add(name, data)
this.toolkit.db.get(name, key)
this.toolkit.db.getAll(name, query?)
this.toolkit.db.put(name, data)
this.toolkit.db.remove(name, key)
this.toolkit.db.clear(name)
this.toolkit.db.count(name)

// 跨 App 共享记录（targetApp 收件方）
this.toolkit.shared.put(record)
this.toolkit.shared.get(id)
this.toolkit.shared.getAll(query?)
this.toolkit.shared.listByTarget(targetApp)

// 动作 / 跳转 / 弹窗
this.toolkit.actions.detail(pageId)                           // 返回跳本 App 子页 action 对象
this.toolkit.actions.openApp(targetAppId, pageId?, payload?)  // 返回跳别的 App action 对象
this.toolkit.actions.modal(modalType, payload)                // 'center' | 'prompt' | 'sheet' | 'toast' | 'confirm'
this.toolkit.actions.method(name, payload)
this.toolkit.actions.deepLink(target, payload)
this.toolkit.actions.share(record)

// 顶层 import 的动作构造器
import { createActionAttr, createDetailAction, createOpenAppAction,
         createAppMethodAction, createModalAction, createDeepLinkAction,
         createShareRecordAction } from '@/src/core/actions.js';
createActionAttr(action, appId)        // 直接拿 data-app-action 字符串拼进 HTML

// 设置页构建器 / 渲染器
this.toolkit.builders.settings.row({ title, iconName, ... })  // 设置行
this.toolkit.builders.settings.group({ rows })
this.toolkit.renderers.renderActionButton(action, appId?)
this.toolkit.renderers.renderChevronRow(opts, appId?)
this.toolkit.templates.render('hero' | 'info-list' | 'share-card' | ... , payload)
this.toolkit.icons / toolkit.uiIcons / toolkit.uiSymbols       // 图标库
this.toolkit.tokens                                             // { radius, shadow, surface }
```

**系统事实表（window.settingsSdk）**

要拿人设 / 世界观 / 日记 / 日程 等跨 App 数据，统一走 `window.settingsSdk`。**不存在 toolkit.world / toolkit.persona / toolkit.social**。

```js
const sdk = window.settingsSdk;
sdk.users.list()                // 用户人设
sdk.aiPersons.list()            // AI 人设
sdk.aiPersons.getActive()       // 当前激活 AI
sdk.worlds.list()               // 世界观
sdk.worlds.getActive()
sdk.worlds.getActiveId()
sdk.places.list({ worldRef })   // 地点
sdk.locations.list({ worldRef })// 场所
sdk.chronology.format(ts, 'full', worldId)  // 纪时
sdk.timelines.list({ worldRef })            // 事件
sdk.anchors.list({ worldRef, type })        // 锚点

sdk.persona.module.get(persona, 'preferences')    // 12 个可选模块
sdk.persona.phases.list(persona)
sdk.persona.probability.roll('ai', 'ai0')          // 重抽今日心情

sdk.diary.getToday('ai', 'ai0')                    // 今日日记
sdk.diary.addSegment('ai', 'ai0', date, { text, source })
sdk.schedule.getForEntity('ai', 'ai0')             // 人设日程

// 资产桥（要先在 setting App 启动后才有，不是 settingsSdk 上的方法）
toolkit.persona.asset.snapshot('ai', 'ai0')          // { balance, accrued, baseBalance, currency, events }
toolkit.persona.asset.adjust(delta, note, 'ai', 'ai0')  // 增减余额
toolkit.persona.asset.settle('ai', 'ai0')
toolkit.persona.asset.addIncome(event, 'ai', 'ai0')

// Prompt 库（4 层：库/包/组/条目）
sdk.prompts.libraries.list()
sdk.prompts.packages.list({ libraryId })
sdk.prompts.groups.list({ enabled: true })          // 默认只取启用的
sdk.prompts.groups.get(id)
sdk.prompts.prompts.list({ groupId })
sdk.prompts.buildStack(ctx)                         // 拼装 prompt（详见 prompt 模块文档）
```

**AI API 调用（window.__apiSdk）**

设置 App 的「API 管理」里配置的 API key / 组，通过 `window.__apiSdk` 暴露（懒加载）：

```js
const api = window.__apiSdk;            // { apiKeySdk, apiGroupSdk, apiUsageSdk }
if (!api) { /* 还没加载 / 没配置 key */ }

const keys = api.apiKeySdk.list();                          // 全部 key
const enabled = api.apiKeySdk.listEnabled();                // 仅启用的
const groups = api.apiGroupSdk.list();

import { executeApiRequest } from '@/js/apps/setting/api-manager/api-key-sdk.js';
// 通用 OpenAI 兼容请求（自动鉴权 / 鉴错 / 记日志）
const result = await executeApiRequest({
    apiKeyId: keys[0].id,         // 或 groupId: groups[0].id
    endpoint: 'chat/completions',
    body: {
        messages: [{ role: 'user', content: '你好' }],
        temperature: 0.7,
    },
    timeout: 60000,
});
// result = { success, data, usage: {inputTokens, outputTokens, totalTokens}, latency, apiKeyId }
```

**Vue island（hybrid 模式用）**

framework 自动注册了 7 个 island 组件，直接写在 hybrid 模式的 HTML 里：

```html
<component-island name="toggle"   label="Wi-Fi" :value="true"></component-island>
<component-island name="slider"   label="音量"   :min="0" :max="100" :value="50"></component-island>
<component-island name="input"    label="昵称"   placeholder="请输入" :value="nickname"></component-island>
<component-island name="textarea" label="备注"   :rows="3" :maxlength="200"></component-island>
<component-island name="select"   label="主题"   :options='[{"value":"light","label":"浅色"}]'></component-island>
<component-island name="list"     :items='[{"value":"a","label":"A"}]'></component-island>
<component-island name="counter"  label="数量"   :min="1" :max="99" :value="qty"></component-island>
```

属性语法：字符串直接写 `label="昵称"`；布尔 / 数字带冒号 `:value="true"`；JSON 数组用单引号包 `:options='[...]'`。

要监听 island 变化：声明 `methods.onIslandChange(methodName, value)`（framework 会自动把 `update:value` 等事件桥接过来）。

**接入步骤（必走 3 步）**
1. 把生成的代码存为 `js/apps/<appId>.js`，default export 工厂函数 `create<Name>App`
2. 在 `js/apps/index.js` 加 `import` 和 `appFactories.push({ name: '<appId>', factory: create<Name>App })`
3. 刷新浏览器，桌面应该出新图标（不需要改 index.html / src/index.js）

---

## 4. ★★★ 完整 appConfig 模板 ★★★

下面是给 LLM 的标准模板。所有 `【问题：xxx 的答案】` 由问卷答案代入。

```js
// js/apps/<appId>.js
import { createActionAttr } from '@/src/core/actions.js';
import { escapeHtml } from '@/src/core/escape.js';

export default function createAppSpec() {
    return {

        // ============================================================
        // 一、基础信息
        // ============================================================
        id: `<appId>`,
        name: `<appName>`,
        icon: `<SVG 占位，业务作者后续替换>`,
        iconBg: `<由 style 自动推出的渐变>`,

        // ============================================================
        // 二、App 主题颜色（由 style 推出，可选覆盖）
        // ============================================================
        background: `<由 style 推出>`,
        statusBarColor: `<由 style 推出>`,
        homeIndicatorColor: `<由 style 推出>`,

        // ============================================================
        // 二 b、distribution（下载状态 + App Store 展示元数据）
        //      requiresInstall: 内容型 App 设为 true，系统级 App（设置/商店/...）留 false
        //      installed:      运行时由 installApp / uninstallApp 维护；启动时不要写死 true
        //      appStore:       App Store 卡片上展示的元数据（subtitle / category / accent / ...）
        // ============================================================
        distribution: {
            requiresInstall: `<本 App 是否需要从 App Store 下载（true / false）>`,
            installed: false,
            ...(requiresInstall ? {
                appStore: {
                    subtitle: '一句副标题',
                    category: '工具',
                    rating: 4.8,
                    ratingsCount: '新上架',
                    size: '28 MB',
                    age: '4+',
                    version: '1.0.0',
                    whatsNew: '优化使用体验。',
                    description: '适配小听系统，可从 App Store 直接打开。',
                    accent: 'linear-gradient(145deg, #A6C0FE, #F68084)',
                },
            } : {}),
        },

        // ============================================================
        // 三、Dock（true = 显示在 dock 栏）
        // ============================================================
        dock: { visible: true, order: 10 },

        // ============================================================
        // 四、顶部条
        // ============================================================
        topbar: {
            visible: true,
            type: `<topbarType>`,
            title: `<appName>`,
            ...(topbarType === 'standard' || topbarType === 'large-title'
                ? { subtitle: '可选副标题' }
                : {}),
        },

        // ============================================================
        // 五、导航栏（仅 tab 结构需要）
        // ============================================================
        ...(structure === 'tab' ? {
            nav: { type: 'tab' },
            pages: [
                ...(pages.map((p, i) => ({ id: toId(p.name), label: p.name, icon: '◦', nav: true }))),
            ],
        } : {
            pages: [{ id: 'main', label: '主', icon: '◦', nav: false }],
        }),
        defaultRootPageId: structure === 'tab' ? toId(pages[0].name) : 'main',

        // ============================================================
        // 六、数据表声明（用了 db 功能才写）
        // ============================================================
        ...(features.includes('db') ? {
            stores: [{ name: '<appId>Items', keyPath: 'id' }],
        } : {}),

        // ============================================================
        // 七、初始 state
        // ============================================================
        setup({ toolkit, app }) {
            return { items: [], loading: false };
        },

        // ============================================================
        // 八、业务方法
        // ============================================================
        methods: {
            // ★ 灵动岛通知
            demoNotify() {
                this.toolkit.island.notify('success', '已保存', '数据已写入');
            },

            // ★ 数据库操作（只有 features 包含 db 才生成完整示例）
            async addItem(text) {
                await this.toolkit.db.add('<appId>Items', { id: `item-${Date.now()}`, text, createdAt: Date.now() });
                this.toolkit.island.notify('success', '已添加', text);
            },

            // ★ AI 调用（只有 needAi 才生成）
            async callAi(userText) {
                const api = window.__apiSdk;
                if (!api) {
                    this.toolkit.island.notify('warning', '请先配置 API Key', '设置 → API 管理');
                    return null;
                }
                const key = api.apiKeySdk.listEnabled()[0];
                if (!key) {
                    this.toolkit.island.notify('warning', '没有可用的 API Key', '');
                    return null;
                }
                const { executeApiRequest } = await import('@/js/apps/setting/api-manager/api-key-sdk.js');
                const result = await executeApiRequest({
                    apiKeyId: key.id,
                    endpoint: 'chat/completions',
                    body: { messages: [{ role: 'user', content: userText }] },
                });
                if (!result.success) {
                    this.toolkit.island.notify('error', '调用失败', result.error || '');
                    return null;
                }
                return result.data?.choices?.[0]?.message?.content;
            },

            // ★ 读世界观（只有 needWorld 才生成）
            readWorld() {
                const sdk = window.settingsSdk;
                if (!sdk) return null;
                return {
                    world: sdk.worlds.getActive(),
                    places: sdk.places.list({ worldRef: sdk.worlds.getActiveId() }),
                    chrono: sdk.chronology.getConfig(sdk.worlds.getActiveId()),
                };
            },

            // ★ 读人设（只有 needPersona 才生成）
            readPersona() {
                const sdk = window.settingsSdk;
                if (!sdk) return null;
                const ai = sdk.aiPersons.getActive();
                if (!ai) return null;
                return {
                    persona: ai,
                    module: (mk) => sdk.persona.module.get(ai, mk),
                    today: sdk.diary.getToday('ai', ai.id),
                };
            },

            // ★ 读 prompt 组（只有 needPrompt 才生成）
            readPrompts() {
                const sdk = window.settingsSdk;
                if (!sdk?.prompts) return [];
                return sdk.prompts.groups.list({ enabled: true });
            },

            // ★ 下载 / 卸载自己（一般 App Store 调，业务自己暴露按钮时按需复制）
            async selfInstall() {
                const { installApp } = await import('@/src/core/app-installation.js');
                installApp(this.app.id, this.app);
                this.toolkit.island.notify('success', '已下载', `${this.app.name} 已添加到桌面`);
            },
            async selfUninstall() {
                const { uninstallApp } = await import('@/src/core/app-installation.js');
                uninstallApp(this.app.id, this.app);
                this.toolkit.island.notify('info', '已删除', `${this.app.name} 已从桌面移除`);
            },
        },

        // ============================================================
        // 九、对外 services（让别的 App 通过 invokeService 调用）
        // ============================================================
        services: {
            async getItems() {
                return this.app.state.items || [];
            },
            async handleDeepLink(payload) {
                // 别的 App deepLink 进来时的入口
            },
        },

        // ============================================================
        // 十、渲染（默认 template；需要 island 切 hybrid）
        // ============================================================
        renderMode: 'template',

        // ★ renderPage 必须是顶层函数分发的入口
        renderPage(content, page, app) {
            if (page.id === '<main>') {
                return renderHomePage(app);
            }
            return window.createDefaultPageRenderer(content, page, app);
        },

        renderDetailPage(content, page, app) {
            return window.createDefaultDetailRenderer(content, page, app);
        },

        // ============================================================
        // 十一、桌面小组件（只有 needWidget 才生成）
        // ============================================================
        ...(needWidget ? {
            widgets: [
                {
                    id: 'quick-item',
                    label: '快速项',
                    icon: `<SVG>`,
                    iconBg: `<由 style 推出>`,
                    defaultSize: widgetSizes[0] || 'S',
                    defaultOrientation: 'h',
                    render(size, payload = {}) {
                        const label = escapeHtml(payload.label || '');
                        const count = payload.count ?? 0;
                        return `<div class="p-3">
                            <div class="text-2xl font-bold">${count}</div>
                            <div class="text-xs text-gray-500">${label}</div>
                        </div>`;
                    },
                },
            ],
        } : {}),
    };
}

// ★ 顶层渲染函数：renderPage 内部用
function renderHomePage(app) {
    const items = app.state?.items || [];
    const action = createActionAttr({ action: 'appMethod', method: 'addItem', payload: { text: '示例' } }, app.id);
    const listHtml = items.map(it => `
        <div class="app-card">
            <div class="text-sm font-medium">${escapeHtml(it.text)}</div>
        </div>
    `).join('');

    return `
        <div class="space-y-3">
            <section class="app-card bg-white/76">
                <div class="text-[20px] font-bold text-slate-900">欢迎使用 <appName></div>
                <div class="mt-2 text-sm text-slate-600">${escapeHtml(appDesc)}</div>
                <button class="btn-primary mt-4" ${action}>演示灵动岛</button>
            </section>
            ${listHtml}
        </div>
    `;
}

function toId(name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
}
```

---

## 5. 已知 Bug 与必避陷阱

### 5.1 renderPage 内部不能用 `this`

`renderPage` 是从 appConfig 上拿出来当独立函数调用的，this 已丢失。详见上文「appConfig 关键约束」。

### 5.2 methods / services 内部必须用方法简写

```js
methods: {
    async save() { this.xxx; }    // ✅
    save: async () => { this.xxx; }  // ❌ 箭头函数 this 丢失
}
```

### 5.3 数据表必须声明

用了 `toolkit.db` 但 `stores` 没声明，会抛「未声明的数据表」错误。

### 5.4 XSS

`renderPage` 返回字符串经 `v-html` 注入，**用户输入 / DB 字段必须 escapeHtml**。

### 5.5 widget 的 `render(size, payload)` 返回值直接被 v-html 注入

同样必须自己 escape payload 字段。

### 5.6 settingsSdk 可能未就绪

设置 App 启动晚于你的 App，**不要直接** `window.settingsSdk.aiPersons.list()`。
正确做法：
```js
window.addEventListener('settings-sdk-ready', () => {
    // 这里用 sdk
}, { once: true });
// 或
import { whenSettingsSdkReady } from '@/js/apps/setting/world/sdk/settings-sdk.js';
whenSettingsSdkReady().then(sdk => { ... });
```

### 5.7 `__apiSdk` 是懒加载

第一次访问 settings App 的 API 管理面板才挂上。**用户没配 key 时是 null**，要判空。

### 5.8 distribution 字段（必读）

**所有 App 必须在 appConfig 里声明 `distribution`**。这是「App 是否在桌面可见」的唯一入口：

- `distribution.requiresInstall: true` → 内容型 App（在 App Store 下载型，如「片刻」）
- `distribution.requiresInstall: false` → 系统级 App（设置 / App Store / 模板 App）
- `distribution.installed` 是运行时字段，由 `installApp(appId, app)` / `uninstallApp(appId, app)` 维护
- `distribution.appStore` 是 App Store 卡片展示用的元数据，可选

要修改「是否下载」状态：

```js
import { installApp, uninstallApp, isAppInstalled } from '@/src/core/app-installation.js';

// 1) 安装（必传 app，会自动写回 app.distribution.installed = true，并持久化、派发事件）
installApp('my-app', this.app);

// 2) 卸载（同样必传 app）
uninstallApp('my-app', this.app);

// 3) 查询
isAppInstalled('my-app');  // 返回 boolean
```

**常见误用**：

- ❌ 直接修改 `app.distribution.installed = true` 而不调用 `installApp`：单进程内 OK，但**重启后状态丢失**（因为没有持久化），下次 `isAppInstalled` 仍返回 false。务必走 `installApp`。
- ❌ 修改本地 `apps.value` 来"删除 App"：那只是桌面 boardItems 过滤，**重启仍会复活**。要"删除 App" 走 `uninstallApp`。
- ❌ `distribution.requiresInstall` 设为 true 但没在 `appStore` 里填展示字段：App Store 会用默认占位，前台会难看。
- ❌ 在 `setup()` 里写 `distribution.installed = true` 试图"出厂已安装"：会启动时间竞态，最稳的做法是业务需要时显式 import `installApp`。**App Store 的「下载」按钮才该写入这个字段**。

### 5.9 framework 已知 Bug（必须知晓，写代码时要绕开）

#### Bug #1：顶栏视觉断层

- **症状**：`appConfig.topbar.bg` 设为非透明色（solid / gradient / rgba...）时，状态栏悬浮在 nav bar 上方，与 nav bar 形成视觉断层。违反 iOS HIG「Continuous Background」原则。
- **相关代码**：
  - `js/framework/use-app-navigation.js`  L45-58     topbarStyle 计算
  - `js/framework/use-app-navigation.js`  L109-148   statusBar*（颜色 / 样式 / 可见性）
  - `app-shell` 组件                              statusbar + navbar 渲染顺序
- **术语**：Status bar / nav bar discontinuity / "Status bar floats above navbar"
- **修复方向（三选一）**：
  - A. statusbar 容器与 navbar 共享同一父节点 + 同一背景
  - B. statusbar 不再独立容器，挪进 navbar 顶部内嵌
  - C. CSS 变量 `--topbar-bg` 同时驱动 statusbar + navbar 的 background
- **状态**：未修复，等待开工
- **对业务 App 的建议**：`topbar.bg` 留 `blur` / `transparent`，避免触发此 Bug

#### Bug #2：`__detailRenderTick` 双 ref 重复声明

- **症状**：设置 app（或所有 `xxxRoute({ sub: 'edit' })` 类业务方法）切子页 / 改 state 后，当前 detail 页不立即重渲。必须「切走再切回」或「关闭再打开」才生效。app 端写的 `window.__detailRenderTick.value++` 与 `__phoneAppsRef` 强制刷新看起来跑了但 computed 不动。
- **根因（两处同名 ref，互相看不见）**：
  - `core-shim.js`          L158  声明 `const detailRenderTick = Vue.ref(0)`
  - `use-app-navigation.js` L29   声明 `const detailRenderTick = Vue.ref(0)`
  - `syncRegisteredApps` 自增的是 core-shim 自己闭包里的 ref
  - `useAppNavigation` 里 `currentDetailView`（computed, L95）依赖的是它自己闭包里的 ref
  - 两个 ref 不是同一对象 → `__detailRenderTick.value++` 不通知 computed
  - 「切走再切回」能恢复：靠 activeAppId / currentDetailPage 变化触发 computed 重算，不靠 tick
- **修复（确保全局只 `Vue.ref(0)` 一次）**：
  1. `use-app-navigation.js`    return 里暴露 `detailRenderTick`
  2. `core-shim.js`             删掉自己的 ref；把 `useAppNavigation` 调用提前到 `syncRegisteredApps` 之前
  3. `syncRegisteredApps`       改成 `navigation.detailRenderTick.value++`
  4. `appConfig bridge`（L498）  改成 `detailRenderTick: navigation.detailRenderTick`
- **关键教训（给 AI 编程助手）**：
  - `window.__xxx` 暴露 ref 时保证整个项目只有一处 `Vue.ref(0)`
  - Vue computed 的依赖靠**闭包内的变量名解析**，不是 ref 引用本身——同名变量遮蔽 = 依赖丢失
  - 诊断信号：`tick.value++` 跑了但 computed 不重算 → 多半两个 ref 不是同一个
  - 优先通过 `return` 暴露而非 `window.__xxx`；后者是最后手段，需要中央登记避免重复声明
- **状态**：根因分析完整，修复方案已出，待落实
- **对业务 App 的建议**：通过切页触发重渲，不要依赖 `__detailRenderTick.value++` 强制刷新（无效）

---

## 6. 给业务 App 作者的 checklist

生成完代码后，AI 应自检：
- [ ] 工厂函数 `createXxxApp` 已 default export
- [ ] `id` 唯一，`appId` 用 kebab-case
- [ ] `icon` 是有效 SVG（viewBox + 闭合标签）
- [ ] `pages[]` 至少 1 项，`defaultRootPageId` 在其中
- [ ] `renderPage(content, page, app)` 存在，内部**不**用 `this`
- [ ] `methods` 用方法简写，**不**用箭头函数
- [ ] 用到的 store 都在 `stores` 声明
- [ ] 用户输入 / DB 字段都过 `escapeHtml`
- [ ] 用了 `settingsSdk` 的 await `settings-sdk-ready` 事件
- [ ] 用了 `__apiSdk` 的先判空再调
- [ ] 没在 `methods` / `renderPage` 内部用 `this`（顶层提到外面）
- [ ] 没写 `target="_blank"` 不带 `rel="noopener noreferrer"`
- [ ] 没 `eval` / 没拼用户输入到 JS 字符串
- [ ] `distribution.requiresInstall` 已声明；`distribution.installed` 默认 false（运行时由 installApp 维护）
- [ ] `requiresInstall === true` 时填了 `distribution.appStore`（subtitle / category / accent / ...）