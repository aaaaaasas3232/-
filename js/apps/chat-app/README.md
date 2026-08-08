# chat-app 迁移实施文档

> 规划源:`c:\Users\Administrator\.cursor\plans\聊天app迁移规划_314ca0f8.plan.md`
> 类型:**hybrid**(framework 的 `renderPage` 返回 HTML 字符串,内嵌 `<component-island>` 挂岛组件)
> 当前 phase:**Phase 11 进行中**(CSS 1:1 复原 — nav-tab 抽屉风 + 消息列表页 + 聊天设置详情页 + 动态页面 + 个人页面 + 通讯录页面已完成，样式规范重构完成)
> 最近一次更新:2026-08-07(v0.57 — 系统 prompt 控制卡 + 注入开关,见文末 §X.10)

---

## A. 给 AI 的快速上手（必读）

> **如果你是 AI，请只读这个 A 节，就能了解 chat-app 的来龙去脉和本项目约束。**
> 下面的 §0-§6 是详细文档，**不需要每次都读**。

### A.1 项目起源

chat-app 是一个**从旧项目 chat.js（参考/chat.js）迁移**过来的聊天 App。

### A.2 旧版 chat.js 是什么

- **原始来源**:`c:\Users\Administrator\Desktop\小听启动\参考\chat.js`（**1.3M 巨文件**，不要直接读）
- **技术栈**:纯原生 HTML/CSS/JS，用 **jQuery + 原生 DOM**，用 **Template7** 模板引擎
- **功能**:完整的微信风格聊天，包含消息列表、私聊、群聊、AI 回复、游戏、表情包、通话等
- **UI 风格**:iPhone 微信风，深蓝导航栏，消息气泡，工具栏

### A.3 为什么迁移

chat.js 功能完整，但：
1. **语法不兼容本项目** — 本项目用 ESM + Vue 3，不支持 jQuery/Template7
2. **结构混乱** — 1.3M 单文件，难以维护
3. **需要接入本项目框架** — App Store、IndexedDB、AI API、灵动岛等

### A.4 旧版 vs 本项目的核心差异

| 维度 | 旧版 chat.js（参考/chat.js） | 本项目 chat-app |
|------|------------------------------|-----------------|
| **技术栈** | jQuery + 原生 DOM + Template7 | ESM + Vue 3 hybrid |
| **渲染方式** | 整页 innerHTML 替换 | renderPage() 返回 HTML + v-html |
| **CSS 写法** | 传统 class，单文件 style 标签 | 类名前缀 + css/apps/chat/ 模块化 |
| **事件绑定** | 原生 addEventListener | data-app-action + CustomEvent |
| **文件结构** | **单文件 1.3M**，所有功能混在一起 | 按 Phase 拆分成 services/pages/components/ |
| **数据存储** | localStorage | IndexedDB (ListenDb) |
| **AI 调用** | 原生 fetch | toolkit.island + AI SDK |

> ⚠️ **文件结构完全不同**：旧版 chat.js 是 1.3M 巨无霸单文件，本项目按功能拆成几十个小文件。不要抄旧版的目录结构。

### A.5 本项目的约束（必须遵守）

```
技术栈:ESM 模块 + Vue 3 + hybrid 模式
CSS:类名前缀 .chat-app / .chat-*，不用 #phone 守卫
renderPage:不能写 this，用模块顶层函数
外部 API:必须 async/await + try/catch + AbortSignal.timeout
XSS:用户输入必须 escapeHtml
```

### A.6 样式规范（重要！）

> **核心原则：JS 只负责结构，CSS 负责所有样式。**

```
允许在 JS 中使用 style="" 的情况：
  ✅ 动态颜色（无法预知的 bgColor 等）— 用 data-color 属性代替
  ✅ 图片的 onerror 回退

禁止在 JS 中使用 style="" 的情况：
  ❌ 固定尺寸（width/height/padding/margin）
  ❌ 布局属性（display/flex/grid/position）
  ❌ 字体样式（font-size/font-weight/color）
  ❌ 边框/圆角/阴影（border/radius/shadow）
  ❌ 动画延迟（animation-delay）— 用 CSS nth-child 实现
  ❌ 任何可以通过 class 实现的样式

实现方式：
  ✅ 固定样式 → CSS class（如 .profile-info-card）
  ✅ 动态 class → JS 拼接字符串（如 isPinned ? 'chat-item--pinned' : ''）
  ✅ 动态颜色 → data-color 属性 + CSS [data-color="xxx"] 选择器
  ✅ 动画延迟 → CSS nth-child 选择器
  ✅ SVG icon → 只保留 viewBox，宽高在 CSS 中设置
```

**示例：**

```js
// ❌ 错误：内联所有样式
<div style="width:48px;height:48px;border-radius:14px;background:${bgColor};" data-color="${bgColor}">

// ✅ 正确：只放动态颜色，其他交给 CSS
<div class="contact-avatar" data-color="${bgColor}">

// CSS 中：
.contact-avatar {
    width: 48px;
    height: 48px;
    border-radius: 14px;
}
[data-color="#FF6B6B"] { background: #FF6B6B; }
```

### A.7 Phase 进度总览

| Phase | 内容 | 状态 |
|-------|------|------|
| 0 | 空骨架 | ✅ 完成 |
| 1 | CSS 1:1 复原 | ✅ 进行中 |
| 1.1-1.2 | nav-tab 抽屉风 | ✅ 完成 |
| 1.3-1.8 | 私聊/群聊/气泡/输入区样式 | ☐ 待办 |
| 2 | IndexedDB 数据层 | ☐ 待办 |
| 3 | AI/Prompt/Bridge 服务 | ☐ 待办 |
| 4-12 | 核心服务/UI组件/页面/注册 | ☐ 待办 |

### A.8 遇到旧版 chat.js 里的代码怎么办

**不要直接复制**，而是：
1. 理解功能（问用户或看规划）
2. 用本项目语法重写
3. 参考 `js/apps/weather-app.js` / `js/apps/focus-app.js` 等现有 App 的写法

### A.9 遇到规划文件里的内容怎么办

**不要直接读那个 plan.md**（288K，太长），而是：
1. 问用户要具体功能点
2. 参考 README.md 的进度表（上面 A.6）
3. 已经在 README.md 的 §2「已完成的事情」里的，直接实现

---

## 0. 项目页面结构(重要前置)

> 理解 `.app-shell` 的 DOM 层次,是所有 UI 样式的前提。
> chat-app 的样式都写在这个结构内,不需要 `#phone` 守卫。

```
app-window                 ← 点 App 打开的窗口
   └── app-shell
       ├── app-topbar          ← 顶部标题栏（title/subtitle）
       ├── app-content           ← 内容区
       │   ├── app-page           ← 普通页面
       │   └── app-detail-page    ← detail 子页（返回按钮）
       ├── app-nav                ← 底部导航（tab / orb）
       │      └── .app-tab-bar                  
       │          └── .app-tab-item × 4         
       └── app-bottom             ← Home 指示条
           └── home-indicator
```

**nav-tab 样式对应关系:**


| 层级      | class                | chat-app 样式来源                                                                                            |
| ------- | -------------------- | -------------------------------------------------------------------------------------------------------- |
| 父容器     | `.app-nav`           | `padding: 0` (覆盖 framework 默认 `10px 14px 6px`)                                                           |
| tab-bar | `.app-tab-bar`       | `background:#FFF;border-top:1px solid rgba(0,0,0,0.06);border-radius:0;height:44px;backdrop-filter:none` |
| 指示器     | `.app-tab-indicator` | `position:absolute;bottom:0;height:2px;background:#4A6FA5;width:从 nav 组件注入`                              |


---

## 1. 实时完成进度


| Phase   | 任务                                                       | 状态    | 备注                                                    |
| ------- | -------------------------------------------------------- | ----- | ----------------------------------------------------- |
| **0**   | 空骨架(css.js + index.js + entry.js + index.css)            | ✅ 完成  | `js/apps/index.js` 已注册 chat,桌面上能看到图标                  |
| **1**   | CSS 1:1 复原                                               | ✅ 进行中 | **nav-tab 抽屉风已落地**(见下),detail-page header 待 Phase 1.3 |
| 1.1     | 提取 chat.js 内联 CSS                                        | ✅ 完成  | nav-tab 样式(白底/蓝灰/指示器/波纹)已注入 `index.css`               |
| 1.2     | nav-tab 骨架                                               | ✅ 完成  | 「消息/通讯录/动态/我」4 root page + SVG icon + **抽屉贴底风**       |
| 1.2a    | `css/apps/chat/_chat-base.css`                           | ✅ 完成  | **空文件**(暂无样式)                                         |
| 1.3     | `css/apps/chat/_chat-private.css`                        | ☐ 待办  | 私聊详情页样式(含顶部 header + 消息气泡 + 输入区)                      |
| 1.4     | `css/apps/chat/_chat-group.css`                          | ☐ 待办  | 群聊详情页样式                                               |
| 1.5     | `css/apps/chat/_chat-bubble.css`                         | ☐ 待办  | 消息气泡(用户/AI/系统/游戏/表情/图片/语音/红包/转账)                      |
| 1.6     | `css/apps/chat/_chat-input.css`                          | ☐ 待办  | 输入区 + 工具栏(图片/语音/表情/位置/红包/转账/通话/收藏)                    |
| 1.7     | 作用域隔离 `.chat-app` 容器                                     | ✅ 完成  | 类名前缀,不带 `#phone`(项目约定)                                |
| 1.8     | 改动点注释                                                    | ✅ 完成  | `index.css` 顶部有完整改动说明                                 |
| **1.9** | **「发送图片」小弹窗**(可复用)                                    | ✅ 完成  | `css/apps/chat/_chat-image-picker.css` — 复刻 framework 默认 modal 但套上 chat 粉蓝韩风,详见 §Y |
| **2**   | 数据层(IndexedDB Schema + 三个 Store)                         | ☐ 待办  |                                                       |
| **3**   | 核心服务(AI / Prompt / Summary / Bridge)                     | ☐ 待办  |                                                       |
| **4**   | Chat 模型基类(ChatCore / ChatPrivate / ChatGroup / ChatCall) | ☐ 待办  |                                                       |
| **5**   | 回复模式(ReplyModeManager)                                   | ☐ 待办  |                                                       |
| **6**   | 表情包系统(EmojiStore / Picker / Message)                     | ☐ 待办  |                                                       |
| **7**   | 历史记录(HistoryViewer / HistorySummaryManager)              | ☐ 待办  |                                                       |
| **8**   | 存档(ArchiveManager)                                       | ☐ 待办  |                                                       |
| **9**   | 游戏系统(统一 GameManager + 狼人杀等)                              | ☐ 待办  |                                                       |
| **9.5** | 通话功能(CallManager)                                        | ☐ 待办  |                                                       |
| **10**  | UI 组件(消息气泡 / 输入区 / 工具栏 等)                                | ☐ 待办  |                                                       |
| **11**  | 页面(消息列表 / 聊天详情 / 历史 / 存档 / 通讯录 / 动态 / 个人 / 游戏)           | ✅ 进行中 | **消息列表页 + 动态页 + 个人页 + 通讯录页 UI 已完成**                         |
| **12**  | 注册与集成(`main.js` + 文档 + 测试)                               | ☐ 待办  |                                                       |


---

## 1. 完整目标文件结构

> 与规划第七部分对齐。
> CSS 目录采用项目约定 `css/apps/chat/`(与 `css/apps/10-focus.css` 等一致)。

```
js/apps/chat-app/
├── main.js                              # App 主入口(注册)— Phase 12
├── index.js                             # 工厂函数 createChatApp() — Phase 0 ✅
├── entry.js                             # vite 构建入口 — Phase 0 ✅
├── css.js                               # 副作用入口(import css/index.css) — Phase 0 ✅
│
├── services/                            # 服务层(Phase 4)
│   ├── chat-core.js                     # 聊天核心基类
│   ├── chat-private.js                  # 私聊模型
│   ├── chat-group.js                    # 群聊模型
│   └── chat-call.js                     # 通话模型
│
├── services/store/                      # 存储层(Phase 2)
│   ├── db-schema.js                     # IndexedDB Schema 注册
│   ├── chat-message-store.js            # 消息存储
│   ├── chat-session-store.js            # 会话存储
│   └── chat-archive-store.js            # 存档存储
│
├── services/summary/                    # 摘要系统(Phase 7)
│   ├── rolling-summary-engine.js        # 滚动摘要引擎
│   ├── history-summary-manager.js       # 历史摘要管理器
│   └── summary-prompts.js               # 摘要 Prompt 模板
│
├── services/prompt/                     # Prompt 构建器(Phase 3)
│   ├── prompt-engine.js                 # Prompt 引擎
│   ├── prompt-sources.js                # Prompt 来源管理
│   ├── summary-prompts.js               # 摘要 Prompt
│   └── game-prompts.js                  # 游戏 Prompt
│
├── services/ai/                         # AI 服务(Phase 3)
│   ├── ai-service.js                    # AI 调用服务
│   └── ai-error.js                      # AI 错误处理
│
├── services/reply/                      # 回复模式(Phase 5)
│   └── reply-mode-manager.js            # 回复模式管理器
│
├── services/emoji/                      # 表情包系统(Phase 6)
│   ├── emoji-store.js                   # 表情包商店
│   ├── emoji-picker.js                  # 表情包选择器
│   └── emoji-message.js                 # 表情包消息
│
├── services/history/                    # 历史记录(Phase 7)
│   ├── history-viewer.js                # 历史查看器
│   └── history-summary-manager.js       # 历史摘要
│
├── services/archive/                    # 存档(Phase 8)
│   └── archive-manager.js               # 存档管理器
│
├── services/bridges/                    # 跨 App 接口(Phase 3)
│   ├── chat-bridge.js                   # 跨 App 桥接
│   ├── moments-bridge.js                # 朋友圈桥接
│   ├── nook-bridge.js                   # Nook 桥接
│   └── world-bridge.js                  # 世界观桥接
│
├── games/                               # 游戏系统(Phase 9)
│   ├── base/
│   │   ├── game-core.js                 # 游戏基类
│   │   ├── game-state.js                # 游戏状态机
│   │   ├── game-message-renderer.js     # 游戏消息渲染
│   │   └── game-manager.js              # 游戏管理器(统一私聊/群聊)
│   ├── private/                         # 私聊游戏
│   │   ├── werewolf-private.js
│   │   ├── undercover-private.js
│   │   └── trivia-private.js
│   ├── group/                           # 群聊游戏
│   │   ├── werewolf-group.js
│   │   ├── undercover-group.js
│   │   └── trivia-group.js
│   └── shared/
│       ├── prompts/
│       │   ├── werewolf-prompts.js
│       │   ├── undercover-prompts.js
│       │   └── trivia-prompts.js
│       └── utils/
│           ├── role-assigner.js
│           └── vote-calculator.js
│
├── call/                                # 通话功能(Phase 9.5)
│   ├── call-manager.js                  # 通话管理器
│   ├── call-channel.js                  # 语音/视频通道
│   ├── call-renderer.js                 # 通话 UI 渲染
│   └── call-page.js                     # 通话页面
│
├── pages/                               # 页面(Phase 11)
│   ├── messages-page.js                 # 消息列表
│   ├── chat-page.js                     # 聊天详情
│   ├── history-page.js                  # 历史记录
│   ├── summary-edit-modal.js            # 摘要编辑
│   ├── summary-select-modal.js          # 摘要注入选择
│   ├── contacts-page.js                 # 通讯录
│   ├── moments-page.js                  # 动态
│   ├── profile-page.js                  # 个人
│   ├── archive-page.js                  # 存档列表
│   └── game-page.js                     # 游戏房间
│
└── components/                          # UI 组件(Phase 10)
    ├── chat-base.js                     # 基础组件
    ├── chat-bubble.js                   # 消息气泡
    ├── chat-input.js                    # 输入区域
    ├── chat-toolbar.js                  # 工具栏
    ├── chat-emoji-picker.js             # 表情选择器
    ├── chat-image-uploader.js           # 图片上传
    ├── chat-voice-recorder.js           # 语音录制
    ├── chat-member-list.js              # 群成员列表
    ├── chat-game-panel.js               # 游戏面板
    └── chat-system-message.js           # 系统消息


css/apps/chat/                           # 聊天 CSS(Phase 1)
├── index.css                            # 副作用入口(被 css.js import)— Phase 0 ✅
├── _chat-base.css                       # 基础(1:1 复原)
├── _chat-private.css                    # 私聊(1:1 复原)
├── _chat-group.css                      # 群聊(1:1 复原)
├── _chat-call.css                       # 通话(1:1 复原)
├── _chat-bubble.css                     # 消息气泡
├── _chat-input.css                      # 输入区域
├── _chat-emoji.css                      # 表情包
├── _chat-history.css                    # 历史记录
├── _chat-summary.css                    # 摘要
├── _chat-game.css                       # 游戏
├── _chat-image-picker.css               # 图片发送弹窗(可复用)
└── _chat-responsive.css                 # 响应式
```

---

## 2. 已完成的事情

- ✅ **Phase 0 — 空骨架**
  - `js/apps/chat-app/{entry,css,index}.js` 三件套
  - `css/apps/chat/index.css` 空占位
  - `js/apps/index.js` 加 3 行(import + appModules + appFactories 注册)
  - **CSS 引入方式**:通过 `index.html` 静态 `<link>` 注入(2026-08-04 改),
  路径 `css/apps/chat/index.css?v=1`,与项目其他 app(weather-app.css / appstore.css / survey.css)风格一致
  - 桌面显示图标 ✅ / 点击能打开 ✅
  - **删除代价**:`rm -rf js/apps/chat-app/ css/apps/chat/`,从 `js/apps/index.js` 移除 3 行,从 `index.html` 移除 1 行 link
- ✅ 架构决策:renderMode = **hybrid**,CSS 用类名前缀(`.chat-app` / `.chat-*`),不写 `#phone` 守卫(与项目其他 app 一致)
- ✅ **Phase 1.2 — nav-tab 抽屉贴底风 1:1 复原**
  - 复原 chat.js 原版「消息 / 通讯录 / 动态 / 我」4 个 root page
  - chat.js 原版用 22×22 SVG icon
  - framework 用 `v-html="tab.iconHtml || escapeTabIcon(tab.icon)"` 渲染 SVG
  - **CSS 注入(`css/apps/chat/index.css`)**,选择器 `.app-nav[data-app-id="chat"]` 锁定 chat app:
    - **抽屉贴底风**(与 App Store 同款,参考 `css/core/50-app-shell.css :has(.appstore-app)`)
    - 顶/底都是**直面**,无圆角(`border-radius: 0 !important`)
    - 背景**纯白不透明**(`background: #FFFFFF !important`)
    - `height: 44px`(比 framework 默认 58px 矮)
    - 顶部 `1px solid rgba(0,0,0,0.06)` 细线作分隔
    - `backdrop-filter: none !important`(不透明,无毛玻璃)
  - **不再用** `.chat-dynamic-tabbar` class 注入 —— 直接用 `[data-app-id="chat"]` CSS 属性选择器
  - 切换逻辑:framework 原生处理,业务代码零介入
- ✅ **通讯录页 topbar search 样式 1:1 复原**(2026-08-04 13:46)
  - **背景**:蓝粉渐变 `linear-gradient(180deg,#E8F2FF 0%,#FFF5F7 50%,#FFFFFF 100%)`
  - **搜索框样式**:白色半透明背景 + 淡蓝色边框 + 圆角 14px,跟 chat.js 原版一致
  - **CSS 注入**:在 `css/apps/chat/index.css` 里覆盖 `.app-shell[data-app-id="chat"] .app-topbar-search`
  - **不改 framework**:样式改动全部在 chat-app 自己的 CSS 文件里,不影响其他 App
- ✅ **Phase 11 — 动态页面 UI 复原** (2026-08-04 14:02，2026-08-04 16:00 样式规范重构)
  - **来源**:旧版 `ChatApp.prototype.renderMomentsPage` + `renderMomentItem` + `loadMomentsListAsync`
  - **文件**:`js/apps/chat-app/pages/moments-page.js` + `css/apps/chat/_chat-moments.css`
  - **路由分发**:在 `index.js` 的 `renderChatPage` 加 `if (currentId === 'moments')` 分发
  - **CSS 链入**:在 `index.css` 加 `@import './_chat-moments.css'`
  - **样式规范**:所有内联 style 移到 CSS，只保留动态颜色(data-color 属性)
  - **UI 结构 1:1 复原**:
    - 韩风蓝粉渐变背景 (蓝→粉→白)
    - 博主头像信息区 (80px 头像 + `(我)` 标识)
    - 发布新动态按钮 (hover 上浮 + 阴影)
    - 动态卡片 (头像+名字+时间+文字+图片网格+位置+互动按钮)
    - 评论区 (简化版,显示评论数和回复关系)
    - `fadeInUp` / `spin` 动画
  - **演示数据**:3 条 DEMO_MOMENTS (文字/多图/单图+评论)
  - **待接交互**:点赞/评论/分享按钮的 data 属性已注入,后续 Phase 接 `toolkit.island`
- ✅ **Phase 11 — 个人页面 UI 复原** (2026-08-04 14:53，2026-08-04 16:05 样式规范重构)
  - **来源**:旧版 `ChatApp.prototype.renderProfilePage`
  - **文件**:`js/apps/chat-app/pages/profile-page.js` + `css/apps/chat/_chat-profile.css`
  - **路由分发**:在 `index.js` 的 `renderChatPage` 加 `if (currentId === 'profile')` 分发
  - **CSS 链入**:在 `index.css` 加 `@import './_chat-profile.css'`
  - **样式规范**:所有内联 style 移到 CSS，SVG icon 只保留 viewBox
  - **UI 结构 1:1 复原**:
    - 韩风蓝粉渐变背景 + 毛玻璃卡片
    - 个人信息卡片(72px 头像+名字+ID)
    - 功能列表(收藏/钱包+余额)
    - 设置组(拍一拍/消息模式/聊天记录管理/群聊记忆互通/设置)
  - **topbar 处理**:`NAV_TABS` 中 `profile.topbar = { visible: false }`,与动态页一致
  - **演示数据**:DEMO_USER (name/avatar/userId/balance/patSetting 等)
  - **待接交互**:各菜单项的 `data-menu-id` 已注入,后续 Phase 接 `toolkit.island`
- ✅ **Phase 11 — 通讯录页面 UI 复原** (2026-08-04 15:47)
  - **来源**:旧版 `ChatApp.prototype.renderContactsPage` + `renderContactItem`
  - **文件**:`js/apps/chat-app/pages/contacts-page.js` + `css/apps/chat/_chat-contacts.css`
  - **路由分发**:在 `index.js` 的 `renderChatPage` 加 `if (currentId === 'contacts')` 分发
  - **CSS 链入**:在 `index.css` 加 `@import './_chat-contacts.css'`
  - **样式规范**:所有内联 style 移到 CSS，只保留动态颜色(data-color 属性)
  - **UI 结构 1:1 复原**:
    - 韩风蓝粉渐变背景
    - 好友申请入口(头像堆叠+数量角标)
    - 分组联系人(主角色⭐/配角👥/NPC🎭)
    - 分类标签带图标
    - 联系人毛玻璃卡片(头像+名字+备注+签名)
    - 批量管理按钮(粉红渐变)
    - 空状态引导
  - **演示数据**:DEMO_CONTACTS (6 个联系人) + DEMO_PENDING_REQUESTS (1 条申请)
  - **待接交互**:联系人点击/搜索/批量管理按钮,后续 Phase 接 `toolkit.island`

- ✅ **Phase 11 — 聊天设置详情页 UI 复原** (2026-08-04 18:55)
  - **来源**:旧版 `ChatApp.prototype.openAIChatProfile(aiId)`(点击 header 「…」按钮触发)
  - **迁移 bug**:旧版只留了 `data-action="settings"`,framework 收不到任何 action,点了没反应。
  - **修复**:
    1. **按钮加 data-app-action**:改成 `{"action":"detail","appId":"chat","pageId":"chat-settings-${contactId}"}`,
       framework 收到 `detail` action 自动 push 到 `detailPageStack`。
    2. **新文件**:`js/apps/chat-app/pages/chat-settings-page.js` —
       `renderChatSettingsPage(app, contactId)` 1:1 复刻旧版 `openAIChatProfile` 的 UI。
    3. **路由分发**:`index.js` 的 `renderDetailPage` 加 `if (pageId.startsWith('chat-settings-'))` 分发。
    4. **新 CSS 文件**:`css/apps/chat/_chat-settings.css`,蓝粉渐变 + 白底卡片 + iOS toggle。
    5. **链入**:`css/apps/chat/index.css` 加 `@import './_chat-settings.css'`。
  - **UI 结构**:
    - 头部:80px 圆角方形头像 + 名字 + 状态(渐变色 + 阴影)
    - 三个圆形入口按钮(语音 / 视频 / 朋友圈),50×50 渐变圆
    - 「设置」卡片:备注 / 置顶开关 / 免打扰开关 / 聊天背景
    - 「AI 设置」卡片:上下文长度 / 上下文智能稀释开关 / 可读取朋友圈 / 回复提示词 /
      回复增强(带 Beta 角标)/ 关键词触发提示词 / 表情库
    - 「聊天记录管理」卡片:日历视图 / 故事记录(每个 item 配 32×32 渐变小图标)
    - 「互动统计」卡片(仅主角色):4 个色块统计(蓝/粉/绿/琥珀)+ 拉黑统计 + 统计数据进入 Prompt
    - 「危险操作」卡片:清空聊天记录 / 拉黑此联系人(红字 #FF3B30)
  - **iOS toggle**:`.chat-toggle` 50×28 圆角,checked 后 green + thumb 滑到右边
  - **样式规范**:所有内联样式移到 CSS,只保留动态颜色(data-avatar-color / data-color-kind / data-color-gradient)
  - **待接交互**:各 setting item 的 id 已注入(备注/上下文长度/朋友圈读取等),后续 Phase 接 IndexedDB + 业务逻辑

- ✅ **Phase 11 — 多页面 topbar 差异化 + app-content 背景差异化**
  - **问题**:点击「通讯录/动态/我」时,白色抽屉和搜索按钮还显示,topbar 标题还是「消息」
  - **根因**:chat-app 有 4 个 root page(消息/通讯录/动态/我),但 `app.topbar` 是静态配置,`app-content` 背景是固定白色
  - **方案选择**:改 framework 支持页面级 topbar
    - **理由**:通讯录/动态/我/消息这四个页面的 topbar 都不一样,以后的 App 也会有这个问题(通用需求)
  - **实现方式**:
    1. **framework 改动**:`use-app-navigation.js` 的 `activeAppTopbar` computed 改为优先取 `currentRootPage.topbar`(页面级),再 fallback 到 `app.topbar`(全局)
    2. **app 层**:在 `pages[]` 数组里给每个 tab 声明 `topbar` 对象,framework 自动读取
    3. **app-content 背景差异化**:用 CSS `:has()` 选择器 —— 默认透明,只有包含 `.chat-messages`(消息列表页)时才显示白色抽屉
  - **踩坑记录**:
    - 编辑出错导致 `activeAppTitle`/`activeAppSubtitle` 重复声明,删掉旧的即可
  - **APP 层完整 appConfig**(最全版本,见下方 §X)

- ✅ **Phase 11 — 「发送图片」小弹窗(可复用 modal 范式)** (2026-08-05 01:14)
  - **背景**:framework 默认 modal 模版(`.app-modal`)在 chat-app 里太大、标题字体黑粗不适合韩风
  - **方案**:在 `index.html` 的 modal 模板上加 `v-if="appModal.type !== 'image-picker'"` 隐藏默认标题 + 默认文本;
    弹窗样式 100% 由 chat-app 自己 CSS 提供(**不**污染 framework 核心样式)
  - **新文件**:`css/apps/chat/_chat-image-picker.css` — 280px 宽、22px 圆角、毛玻璃背景、粉/蓝双色按钮
  - **链入**:`css/apps/chat/index.css` 加 `@import './_chat-image-picker.css'`
  - **模板位置**:`index.html` 第 469 行 `<template v-else-if="appModal.type === 'image-picker'">`
  - **触发方式**:`appModal.type = 'image-picker'` + 填 `title / text / onConfirm` 即可
  - **完整文档**:见下方 §Y

### ⚠️ Framework 改动决策原则

> **优先级:App 层动态覆盖 > Framework 通用抽象 > 直接改 framework**
>
> - **App 层动态覆盖**:在 `renderPage` 里修改 `app.topbar` / 注入 CSS class / 用 `:has()` CSS 选择器
> - **Framework 通用抽象**:当 2+ 个 App 都有相同需求时,才在 framework 里加通用逻辑
> - **直接改 framework**:只有当前两种方案都做不到时才考虑,**必须先问用户**,并说明为什么 App 层方案不可行

### Framework 改动清单(本 chat-app 开发期间)

- `**js/framework/use-app-navigation.js**`:修改 `activeAppTopbar` computed
  1. 优先取 `currentRootPage.topbar`(页面级)
  2. 再 fallback 到 `app.topbar`(全局)
  3. **必须用 spread merge**:`{ ...appTopbar, ...pageTopbar }` 而不是 `pageTopbar || appTopbar`
     - 原因:pageTopbar 只有部分字段时,merge 能保留 appTopbar 的其他字段(如 `showPill: false`)

### APP 层完整 appConfig(Phase 11 最全版本)

- `**index.html:395`**:`{{ tab.icon || '•' }}` → `v-html="tab.iconHtml || escapeTabIcon(tab.icon)"`
- `**js/framework/core-shim.js**`:setup return 加 `escapeTabIcon(text)` method,转义 `&` / `<` / `>`
- `**AGENTS.md §16.11**`:iconHtml 是新字段,`icon` 降为 fallback

### chat-app CSS 选择器策略(2026-08-04 11:10)

- **不**依赖 JS 注入 class(如旧版的 `.chat-dynamic-tabbar`)
- **用** CSS 属性选择器 `[data-app-id="chat"]` 锁定 chat app 的 nav
- `css/apps/chat/index.css` 里的所有 chat-app 专属规则,全部以 `.app-nav[data-app-id="chat"]` 或其子级为前缀
- 与 `css/core/50-app-shell.css :has(.appstore-app)` 的 App Store 抽屉风同款策略

### Phase 1.2 验收清单

- [x] 桌面 chat 图标可点
- [x] 打开后**底部**出现 framework tab bar:**SVG icon**(消息/通讯录/动态/我)
- [x] 当前 tab 染色 + 放大(图标描边色 currentColor,#4A6FA5 当前态)
- [x] **tab-bar 形态:抽屉贴底**(顶/底直面,纯白,44px高,无毛玻璃)
- [x] 点击 tab 切换 root page,占位文案跟着变
- [x] SVG icon 22×22,跟 chat.js 原版一致
- [x] 消息列表页 UI 复原(头像/名字/预览/时间/未读角标/新建聊天按钮) — Phase 11 ✅
- [x] 动态页面 UI 复原(蓝粉渐变背景/头像区/发布按钮/动态卡片/点赞评论分享) — Phase 11 ✅ (2026-08-04 14:02)
- [x] 个人页面 UI 复原(毛玻璃卡片/头像+名字+ID/收藏/钱包/设置组) — Phase 11 ✅ (2026-08-04 14:53)
- [x] 通讯录页面 UI 复原(分组列表/好友申请入口/分类标签/毛玻璃卡片) — Phase 11 ✅ (2026-08-04 15:47)

---

## 3. 还没做的事

> 按 Phase 顺序,**当前在 Phase 11**。
> 下一步:接入 IndexedDB 数据层,或其他 Phase 11 页面(通讯录/动态/个人)。

---

## 4. 注意项(写代码前必读)

### 4.1 renderMode 选型

**hybrid**。理由:

- 聊天页 80% 是消息流(用 v-html 注入)+ 输入区(用 `<component-island>` 拼交互)
- 整页 vue 模式会跟 framework 的 `currentPageView` 切换打架,踩坑多
- hybrid 兼顾灵活性与稳定

### 4.2 CSS 作用域

- 用 `.chat-app` / `.chat-`* / `.chat__*`(BEM)类名前缀,**不写 `#phone` 守卫**(项目其他 app 都不写)
- 后续拆子文件时,在 `css/apps/chat/index.css` 里 `@import './_chat-base.css'` 链入

### 4.3 CSS 路径

`css/apps/chat/`,与 `css/apps/{其他 app}/` 平级。子文件用 `@import` 链入 `index.css`。

### 4.4 CSS 引入方式

通过 `index.html` 静态 `<link rel="stylesheet" href="/css/apps/chat/index.css?v=1" />` 引入,
**不在** `js/apps/chat-app/index.js` 里 `import './css.js'`。
`css.js` 文件保留为备用入口(如需切换到 ESM 注入,只需在 index.js 顶部加 import)。

### 4.5 通用约束(AGENTS.md §16)

- ❌ 不动 `index.html` / `src/index.js`
- ❌ `renderPage` 内部不能用 `this`(已踩坑)
- ❌ `pages[].icon` 只能塞单字符 emoji / 简短文字,不能塞 SVG
- ❌ 不要持久化敏感数据到 IndexedDB
- ✅ 用户输入 / 数据库读出来的字符串必须 `escapeHtml`
- ✅ widget render 返回值自行 escape
- ✅ 所有外部 API 调用用 `async/await` + try/catch + `AbortSignal.timeout`
- ✅ `<a target="_blank">` 必须带 `rel="noopener noreferrer"`

### 4.6 复用清单(规划 §7.4)


| 来源                                     | 用法          |
| -------------------------------------- | ----------- |
| `toolkit.island`                       | 所有通知        |
| `toolkit.db`                           | 数据库         |
| `toolkit.icons` / `uiIcons` / `tokens` | 图标          |
| `toolkit.actions`                      | action 属性   |
| `toolkit.templates`                    | 内置模板        |
| `window.__phoneConfirm`                | 确认弹窗        |
| `window.__detailRenderTick`            | 强制重画 detail |
| `src/core/island-components.js`        | 内部组件        |
| `src/core/escape.js`                   | XSS         |
| settings/persona/moments SDK           | 跨 App 接口    |


---

## 5. 删除指南(任意时刻想放弃)

```bash
rm -rf js/apps/chat-app/
rm -rf css/apps/chat/
# 手动从 js/apps/index.js 移除:
#   - import createChatApp from './chat-app/index.js';
#   - './chat-app/index.js'  (appModules 数组)
#   - { name: 'chat', factory: createChatApp, async: false }  (appFactories 数组)
# 手动从 index.html 移除:
#   - <link rel="stylesheet" href="/css/apps/chat/index.css?v=1" />
```

**以上步骤走完,框架完全无副作用。**

---

## 6. 下一步

### 当前在做

**Phase 1.2 → 1.3**:nav-tab 抽屉贴底风已完成。接下来做私聊详情页(`_chat-private.css`):顶部 header(头像+名字+更多入口) + 消息气泡 + 输入区。

### 建议跑一下 dev server 自测

```bash
npm run dev
# 浏览器打开 http://localhost:5173
# 点桌面 chat 图标 → 应看到顶部蓝灰导航栏,4 个圆形按钮,中央"示例联系人"
```

---

## X. APP 层完整 appConfig 文档

> 来源:`js/apps/chat-app/index.js` —— Phase 11 最全版本
> 本文档随代码同步更新,是 chat-app 的标准参考。

### X.1 appConfig 完整结构

```javascript
export function createChatApp() {
    return {
        // ── 基础标识 ──────────────────────────────────
        id: 'chat',                      // 全局唯一,桌面图标点击靠它定位
        name: '聊天',                     // 桌面显示名
        badge: 0,                        // 桌面图标未读角标
        iconBg: 'linear-gradient(135deg, #fb7299 0%, #c084fc 100%)',
        icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',

        // ── 渲染模式 ─────────────────────────────────
        renderMode: 'hybrid',             // hybrid: renderPage 返回 HTML 字符串 + <component-island> 挂交互组件

        // ── 导航 ─────────────────────────────────────
        nav: { type: 'tab' },            // tab: 底部 tab-bar 导航

        // ── 页面列表 ─────────────────────────────────
        // ★ 重点:每个 page 可以声明自己的 topbar,framework 会优先取 page.topbar
        pages: [
            {
                id: 'messages',           // 路由 id
                label: '消息',            // tab 显示名
                iconHtml: '<svg .../>',   // ★ SVG icon(走 v-html,不用 escape)
                nav: true,                // 出现在 tab-bar
                topbar: { visible: true, title: '消息' },  // ★ 页面级 topbar(framework v2 支持)
            },
            {
                id: 'contacts',
                label: '通讯录',
                iconHtml: '<svg .../>',
                nav: true,
                topbar: { visible: true, title: '通讯录' },
            },
            {
                id: 'moments',
                label: '动态',
                iconHtml: '<svg .../>',
                nav: true,
                topbar: { visible: true, title: '动态' },
            },
            {
                id: 'profile',
                label: '我',
                iconHtml: '<svg .../>',
                nav: true,
                topbar: { visible: true, title: '我' },
            },
        ],
        defaultRootPageId: 'messages',   // 默认打开的 root page

        // ── 全局 topbar fallback ───────────────────────
        // ★ 当 page 没有 topbar 时用这个,通常设为跟 defaultRootPageId 对应的 page topbar 一致
        topbar: {
            visible: true,
            title: '消息',
            showPill: false,
        },

        // ── 渲染函数 ─────────────────────────────────
        renderPage: renderChatPage,      // 返回 HTML 字符串

        // ── 业务方法 ─────────────────────────────────
        methods: {
            /** 初始化时挂载顶栏元素(如搜索按钮) */
            initTopbar() { ... },

            /** 切换搜索模式 */
            toggleSearch() { ... },

            /** 注入 .chat-tab-indicator div(仅初始化一次) */
            mountNavIndicator() { ... },
        },
    };
}
```

### X.2 page 对象支持的字段

| 字段 | 类型 | 用途 |
|------|------|------|
| `id` | string | 页面唯一标识 |
| `label` | string | tab-bar 显示名 |
| `iconHtml` | string | SVG icon(走 v-html) |
| `icon` | string | 单字符 fallback(走 escape) |
| `nav` | boolean | 是否出现在 tab-bar |
| `topbar` | object | **★ 页面级 topbar**(framework v2 支持) |
| `type` | string | `'detail'` 表示详情页,不出现在 tab-bar |

### X.3 page.topbar 支持的字段

| 字段 | 类型 | 用途 |
|------|------|------|
| `visible` | boolean | 是否显示 topbar |
| `title` | string | topbar 标题 |
| `subtitle` | string | topbar 副标题 |
| `showPill` | boolean | 是否显示标题药丸 |
| `color` | string | 文字颜色 |
| `bg` | string | 背景色 |
| `fontSize` | number | 标题字号(px) |
| `fontWeight` | number | 标题字重 |
| `titleSize` | number | CSS 变量 `--topbar-title-size` |

### X.4 Framework v2 topbar 优先级

```
page.topbar > app.topbar > window.__appTopbarOverride (临时覆盖)
```

### Framework v2 topbar 合并逻辑

```javascript
// 合并顺序:appTopbar → pageTopbar → window.__appTopbarOverride
// pageTopbar 覆盖 appTopbar 的同名字段,appTopbar 的其他字段保留
const base = pageTopbar ? { ...appTopbar, ...pageTopbar } : appTopbar;
```

**例子**:chat-app 的 page topbar 只有 `{ visible: true, title: '消息' }`,没有 `showPill`。
- 用覆盖逻辑:合并后没有 `showPill`,模板里 `undefined !== false` 为 true,导致 pill 一直显示
- 用 merge 逻辑:保留 `appTopbar.showPill: false`,pill 正确隐藏

### X.5 踩坑提醒

1. **iconHtml vs icon**:iconHtml 走 v-html(不 escape),icon 走 escape。SVG icon 必须用 iconHtml。
2. **page.topbar vs app.topbar**:framework v2 优先取 page.topbar,app.topbar 仅作 fallback。
3. **hybrid 模式**:renderPage 返回 HTML 字符串,交互组件用 `<component-island>` 嵌入。
4. **CSS 差异化**:用 `:has()` 选择器比动态注入 class 更稳定。

### X.6 修复记录 (2026-08-04 14:41)

#### 2026-08-07:多选模式下发的红包/文字/位置消息，切出再切回后"消失"（renderer cache 命中旧 HTML）

**现象**：在私聊详情页点「多选」进入多选模式后，再发红包 / 转账 / 图片 / 语音 / 位置 / 文字消息，气泡会正常追加显示在当前屏幕上；但只要 `closeDetail` 或切到其它 tab 再切回同一个私聊页，刚才发的这几条消息就"凭空消失"了（IndexedDB 里其实是有的，`chatMessages.list()` 也能查到）。

**排查过程**（关键：不要停在"数据层丢消息"的假设上）：

1. 先怀疑 `chatMessages.add()` / cacheMap 有并发写入 bug —— 加了 `[LOG-1]~[LOG-5]` 一路打点，确认每次 `add()` 后 `cacheMap.size` 都正确 +1，`chatMessages.list(aiPersonId, mode)` 返回的条数也完全对得上（比如发完是 46 条，`list()` 也返回 46 条）。**数据层从头到尾没有丢过任何一条。**
2. 再看 `closeDetail → openDetailPage(private-xxx)` 之后的日志——**`[LOG-4]`（`renderPrivateChatPage` 入口打点）压根没有被打出来**。说明不是"渲染出来的数据不对"，而是**"渲染函数根本没被再调用一次"**，页面用的还是**上一次的旧 HTML**。
3. 定位到 `js/framework/use-app-navigation.js` 的 `resolveAsyncRenderer()`——chat-app 的 `renderDetailPage` 是 `async function`，framework 为了让 computed 支持 async，做了一层 `{ tick, html }` 缓存：只要 `currentTick === cache.tick` 就直接返回缓存的 HTML 字符串，不重新调用 renderer。
4. 而 `toggleMultiSelect` 触发了一次 `tick++` → 重画 → cache 写入 `{ tick: N, html: 多选模式下的37条消息 }`。之后在多选模式里发的红包/文字，只是**手动 `appendMessageBubble` 追加到 DOM**，**没有 `tick++`**，所以 cache 还停在 `tick: N`。等 `closeDetail` 再 `openDetailPage` 回来时，`currentTick` 依然是 `N`（没人动过），**命中缓存，直接吐出多选模式那一刻的旧 HTML** —— 后续追加的红包/文字自然"不见了"。

**第一次修复尝试（不够，仍然复现）**：在每处 `sdk.chatMessages.add()` 成功之后调用 `window.invalidateRendererCache('chat', contactId)`（framework 暴露的 API，本意是"删 cache 条目 + tick++"）。结果**仍然复现**——因为：

**真正的根因**：`use-app-navigation.js` 里 `resolveAsyncRenderer` 的缓存容器 `_resolvedCache` 声明成了 **`WeakMap`**：

```js
const _resolvedCache = new WeakMap(); // renderer -> Map<key, { tick, html }>
```

但 `invalidateRendererCache()` 里想清缓存时写的是：

```js
_resolvedCache.forEach((cache) => { ... });   // ❌ WeakMap 没有 forEach 方法！
```

**`WeakMap` 原生不支持 `.forEach()`**（也不支持 `.keys()` / `.entries()`），这一行调用**静默不执行任何逻辑**（不报错，因为 `forEach` 在 `WeakMap.prototype` 上是 `undefined`，`_resolvedCache.forEach` 是 `undefined`，`?.()` 才会静默跳过；如果没写 `?.` 直接调用理论上会 `TypeError`，实际代码里这行是裸调用，说明从写下这行代码起就没被验证过执行到底有没有效果）。所以 `invalidateRendererCache()` 唯一还生效的部分只有 `tick++`，而这个 `tick++` 又会被 `resolveAsyncRenderer` 内部的 `promisedTick = currentTick + 1` 占位机制"提前吃掉"（上一次 async 渲染 resolve 时已经把 cache.tick 写到了 `N+1`），导致 `invalidateRendererCache` 触发的 `tick++` 刚好撞上这个已存在的缓存条目，等于白清。

**修复**：把 `_resolvedCache` 从 `WeakMap` 改成普通 `Map`：

```js
// js/framework/use-app-navigation.js
const _resolvedCache = new Map(); // renderer -> Map<key, { tick, html }>
```

`Map` 支持 `.forEach()`，`invalidateRendererCache()` 才能真正遍历并 `cache.delete(key)`，配合业务侧在 `sdk.chatMessages.add()` 成功后调用 `window.invalidateRendererCache('chat', contactId)`，才能让下次打开该 detail 页时强制走一遍真实渲染，而不是命中过期缓存。

**涉及改动**：

| 文件 | 改动 |
|------|------|
| `js/framework/use-app-navigation.js` | `_resolvedCache` 从 `WeakMap` → `Map` |
| `js/apps/chat-app/index.js` | 6 处 `sdk.chatMessages.add()`（图片/语音/位置/转账/红包/文字）成功后都加一行 `window.invalidateRendererCache?.('chat', contactId)` |

**教训 / 诊断台词**：

- **只要用到 `WeakMap` / `WeakSet`，先问自己一句"这里需要遍历吗？"** —— `WeakMap` 天生不可遍历（没有 `keys()` / `values()` / `entries()` / `forEach()`），是为了让 GC 能正常回收 key，如果业务逻辑需要"清空所有匹配某条件的条目"这种遍历型操作，**从设计上就不能用 WeakMap**，要用 `Map`。
- **`obj.forEach` 是 `undefined` 时裸调用会直接抛 `TypeError: obj.forEach is not a function`**——如果连这个报错都没有出现在 console 里，说明这行代码从来没有被真正执行到（比如被 try/catch 吞掉了，或者调用路径本身没走到）；这次踩坑里 `invalidateRendererCache` 外层没有 try/catch，`forEach` 未定义应该报错——**但因为 `_resolvedCache.forEach` 在 `WeakMap.prototype` 上确实是 `undefined`，`_resolvedCache.forEach(...)` 会立即抛 `TypeError`**，之所以线上没看到崩溃是因为 `invalidateRendererCache` 是在别的地方以 `try { ... } catch (_) {}` 包裹调用的，异常被静默吞掉——**这是本次排查耗时最长的一步：现象是"缓存没清"，但看不到任何报错，因为调用方统一 try/catch 吞掉了。**
- **"业务代码手动 append DOM + 不触发 tick，等下次重画时读缓存"这个模式本身就是危险信号**——任何写数据库成功后，只要这个数据还会影响"重新打开这个页面时该展示什么"，就必须让下次重新渲染时拿到最新数据,不能依赖"当前这次 DOM 操作看起来是对的"。`invalidateRendererCache(appId, pageId)` 就是为这个场景设计的兜底 API,以后新增任何"发消息 / 加好友 / 改设置"之类的写操作，只要该页面用了 async `renderDetailPage`,写完就该调一下。

#### 2026-08-07:个人页「拍一拍」后缀不更新

**问题**:在社媒里设置了「拍一拍」后缀,但个人页「拍一拍」那行显示的还是默认值「拍了拍我」,刷新页面也没用。

**根因**:两处 bug:

1. `profile-page.js` 读取路径错误:
   - ❌ `currentUser.patSetting` — 直接读 user 顶层字段
   - ✅ `chatProfile.patSetting` — 数据实际存储在 `user.socialProfiles.chat.patSetting`

2. `index.js` 的 `refreshProfileTab()` 没有更新「拍一拍」行 —— 只更新了名字/ID/余额/头像,漏掉了 pat-setting。

**修复**:

```js
// profile-page.js 第 104 行
patSetting: chatProfile.patSetting || '拍了拍我',  // 原来:currentUser.patSetting

// index.js refreshProfileTab() 加一行
const patSettingEl = shell.querySelector('[data-menu-id="pat-setting"] .profile-menu-sub');
if (patSettingEl) patSettingEl.textContent = user.patSetting || '拍了拍我';
```

**教训**:

- 用户数据里 `patSetting` 存在 `socialProfiles.chat.patSetting`,不是顶层字段
- `refreshProfileTab` 负责刷新个人页的动态数据,加了新字段后别忘了在这里同步更新

#### 问题1: 动态页 panel 的 padding 被全局样式影响

**现象**:消息页顶部有 16px padding,导致动态页顶部也出现了不该有的间距。

**原因**:旧代码在 `_chat-moments.css` 里全局清零了 `.app-screen-panel` 的 padding,但 `index.css` 又写了 `.app-screen-panel { padding: 16px 0 0 }`。

**修复方案**:使用 `:has()` 选择器精确匹配,只清零动态页的 panel padding。

```css
/* 错误:影响消息页 */
.app-screen-panel {
    padding: 0 !important;
}

/* 正确:只清零动态页 */
.app-shell[data-app-id="chat"] .app-screen-panel:has(.moments-page) {
    padding: 0 !important;
}
```

**教训**:全局样式与局部需求冲突时,优先用 `:has()` 等高级选择器精确匹配,而不是用 `!important` 覆盖全局。

#### 问题2: 动态页背景色与消息页不一致

**现象**:动态页背景是蓝色 `#4A90D9`,与消息页的渐变背景完全不同。

**修复**:统一为蓝粉渐变背景。

```css
.app-shell[data-app-id="chat"] .moments-page {
    background: linear-gradient(180deg, #E8F2FF 0%, #FFF5F7 50%, #FFFFFF 100%);
}
```

#### 问题3: profile-section 底部 margin 和圆角缺失

**现象**:profile-section 底部没有间距,四个角都是直角,与设计不符。

**修复**:

```css
.app-shell[data-app-id="chat"] .moments-profile-section {
    margin-bottom: 20px !important;
    border-radius: 0 0 24px 24px !important;
}
```

#### 问题4: 头像位置偏移

**现象**:头像应该往右下移动,偏离原来的居中位置。

**修复**:在 `moments-page.js` 的头像 div 上加 `transform: translate(60px, 60px)`。

```html
<div style="width:80px;height:80px;...transform:translate(60px,60px);">
```

#### 修复优先级总结

| 顺序 | 问题 | 文件 |
|------|------|------|
| 1 | panel padding 影响动态页 | `_chat-moments.css` |
| 2 | 动态页背景色不一致 | `_chat-moments.css` |
| 3 | profile-section margin/radius | `_chat-moments.css` |
| 4 | 头像位置偏移 | `moments-page.js` |

---

## Y. 可复用 Modal 范式 — image-picker

> **本节给「AI / 新开发者」复用 image-picker modal 模式** —— 比如以后要做「发送位置」「发送语音」「发送文件」「分享名片」这类小弹窗,
> 直接照搬这一套,30 秒接一个 modal。

### Y.1 这个弹窗是什么

- **触发场景**:用户在私聊/群聊里点击输入区「+」→ 选「图片」→ 弹出
- **目的**:让用户输入一段描述文字,送给 AI 让它生成对应的图片
- **结构**:`1 个小相机 icon + 标题 + 灰色小字提示 + 圆角淡蓝输入框 + 底部 [取消 / 发送]` 按钮
- **配色**:粉蓝韩风(蓝 `#4A6FA5`、粉 `#F4A6CD`、淡蓝 `#A8C8EC`)

![image-picker 弹窗](docs/image-picker-preview.png) *(暂缺截图,以实际样式为准)*

### Y.2 模板位置(framework 通用)

**`index.html` 第 469 行附近:**

```html
<!-- 图片发送弹窗 -->
<template v-else-if="appModal.type === 'image-picker'">
    <div class="app-modal-image-picker">
        <div class="image-picker-header">
            <svg class="image-picker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span class="image-picker-title">发送图片</span>
        </div>
        <div class="image-picker-hint">描述图片内容,让 AI 帮你生成</div>
        <div class="image-picker-body">
            <textarea
                class="image-picker-input"
                placeholder="例如:我家小猫在窗台晒太阳"
                rows="2"
            ></textarea>
        </div>
        <div class="app-modal-actions">
            <button class="app-modal-action app-modal-action--cancel" @click="closeModal">取消</button>
            <button class="app-modal-action app-modal-action--primary" @click="confirmAppModal">发送</button>
        </div>
    </div>
</template>
```

> ⚠️ 默认标题/文本 — index.html 第 441-442 行加了 `v-if="appModal.type !== 'image-picker'"`,
> 因为 image-picker 的标题/icon 是我们自己定义的,不要 framework 默认的 `{{ appModal.title }}` 重复渲染。

### Y.3 触发方式(framework API)

```js
// 在 chat-page.js 的 method 里
async openImagePicker() {
    this.toolkit.actions.modal('image-picker', {
        title: '发送图片',        // 实际不显示(模板自带标题),但 framework 要求必填
        text: '描述图片内容',     // 同上,不显示,framework 要求必填
        onConfirm: () => {
            // 用户按「发送」,读取 .image-picker-input 的 value
            const desc = document.querySelector('.image-picker-input')?.value?.trim();
            if (!desc) {
                this.toolkit.island.notify('warning', '请输入图片描述');
                return;
            }
            // TODO: 调 AI 图片生成接口,接到 .image-picker 弹窗就不卡 UI
        },
    });
}
```

> ⚠️ `actions.modal(type, payload)` 是 framework 通用 API。
> 见 `src/core/actions.js` 的 `createModalAction`。`onConfirm` 在用户点「发送」时触发。

### Y.4 CSS 结构(100% 隔离 framework)

**`css/apps/chat/_chat-image-picker.css`** — 所有规则都以 `.app-shell[data-app-id="chat"]` 前缀锁定:

| 选择器 | 作用 | 关键样式 |
|--------|------|----------|
| `.app-modal.image-picker` | 弹窗整体 | `width: 280px` `border-radius: 22px` `background: rgba(255,255,255,0.92)` `backdrop-filter: blur(20px)` |
| `.app-modal-image-picker` | 内部容器 | `display: flex; flex-direction: column; gap: 10px` |
| `.image-picker-header` | 头部 (icon+标题) | 居中、22px icon + 15px 蓝字 |
| `.image-picker-icon` | 相机图标 | `color: #F4A6CD`(粉色) |
| `.image-picker-title` | 标题 | `font-size: 15px` `color: #4A6FA5` `font-weight: 600` |
| `.image-picker-hint` | 灰色小字提示 | `font-size: 11px` `color: #9CA3AF` |
| `.image-picker-input` | 输入框 | 14px 圆角、淡蓝边框、focus 时 3px 浅蓝光晕 |
| `.app-modal-actions` | 按钮容器 | `margin: 12px -18px -14px`(左右贴边、底部贴边) |
| `.app-modal-action` | 单个按钮 | `font-size: 13px` `padding: 10px 0` `border-left: 0`(去掉按钮中间的竖线) |
| `.app-modal-action--cancel` | 「取消」按钮 | `color: #94a3b8`(灰) |
| `.app-modal-action--primary` | 「发送」按钮 | `color: #F4A6CD` `font-weight: 600`(粉) |

**配色变量**(如果想换主题色,改这一组):

```css
--chat-blue: #4A6FA5;     /* 主蓝(标题/聚焦边框) */
--chat-pink: #F4A6CD;     /* 主粉(图标/发送按钮) */
--chat-light-blue: #A8C8EC; /* 浅蓝(输入框边框) */
--chat-gray: #9CA3AF;     /* 提示文字 */
--chat-cancel: #94a3b8;   /* 取消按钮 */
```

### Y.5 复用指南 — 接一个新 modal 的步骤

**示例:做一个「发送位置」弹窗**

#### 步骤 1:在 `index.html` 加模板(469 行附近)

```html
<!-- 位置发送弹窗 — 复用 image-picker 范式 -->
<template v-else-if="appModal.type === 'location-picker'">
    <div class="app-modal-image-picker">  <!-- 复用同个容器类 -->
        <div class="image-picker-header">
            <svg class="image-picker-icon" viewBox="0 0 24 24" ...>...</svg>
            <span class="image-picker-title">发送位置</span>
        </div>
        <div class="image-picker-hint">选择你想分享的位置</div>
        <div class="image-picker-body">
            <!-- 这里换成位置选择器组件 -->
            <textarea class="image-picker-input" placeholder="输入位置名..." rows="2"></textarea>
        </div>
        <div class="app-modal-actions">
            <button class="app-modal-action app-modal-action--cancel" @click="closeModal">取消</button>
            <button class="app-modal-action app-modal-action--primary" @click="confirmAppModal">发送</button>
        </div>
    </div>
</template>
```

#### 步骤 2:不需要改 CSS — 容器类 `app-modal-image-picker` + `image-picker-*` 都已生效

> 现阶段复用 image-picker 的所有样式;后续如果样式差异大,**新建一个 `_chat-location-picker.css`** 而不是污染 image-picker 的样式。

#### 步骤 3:在业务方法里触发

```js
async openLocationPicker() {
    this.toolkit.actions.modal('location-picker', {
        title: '发送位置',
        text: '选择位置',
        onConfirm: () => {
            const loc = document.querySelector('.image-picker-input')?.value?.trim();
            if (!loc) {
                this.toolkit.island.notify('warning', '请输入位置');
                return;
            }
            this.sendLocationMessage(loc);
        },
    });
}
```

### Y.6 为什么这是「可复用」范式

- **不污染 framework** — 所有样式以 `.app-shell[data-app-id="chat"]` 前缀锁定,只对 chat-app 生效
- **不污染 index.html** — 模板片段加在 chat 专属分支(`v-else-if`),不影响其它 modal 类型
- **不污染其它 App** — 拿这个范式去 weather-app / focus-app 等,只需要在自己的 `css/apps/<app>/` 下新建 `_<app>-image-picker.css` 复制样式 + 改前缀就行
- **样式规范遵守项目约定** — 见 §A.6:JS 只放结构,CSS 负责一切样式

### Y.7 重构 / 删除指南

如果以后想做更通用的「粉蓝 modal」,把这套 CSS 提到 framework:

```bash
# 1. 把 _chat-image-picker.css 内容搬去 css/core/_modal-image-picker.css
# 2. 把 .app-shell[data-app-id="chat"] 前缀去掉,改成基础选择器
# 3. 从 chat-app 的 index.css 里删掉 @import './_chat-image-picker.css'
# 4. 在 index.html 顶部加 <link rel="stylesheet" href="/css/core/_modal-image-picker.css" />
```

如果 chat-app 整体删除:

```bash
rm css/apps/chat/_chat-image-picker.css
# 从 css/apps/chat/index.css 删 @import 行
# index.html 里的 <template v-else-if="appModal.type === 'image-picker'"> 留着也不会报错(只是这个 type 永远不再触发)
```

---

## X.7 修复记录(2026-08-07,v0.48)—— 私聊多选工具条不显示 + 切出私聊再回来后所有点击失效

> 这是一次「两个看起来毫不相关的 bug，根因分别但都很隐蔽」的修复。记录下来是因为
> **踩坑模式本身有复用价值**：v-html 驱动的页面，任何「绑定时机」和「样式优先级」问题都容易长这样。

### 现象(用户原话)

1. 「进入私聊后点『多选』，右上角工具条(收藏/转发/删除/取消)完全不出现」
2. 「不论发不发消息，只要切出这个私聊再切回来，工具栏按钮就卡住，地点卡片点击也失败无反应」

### Bug 1:多选工具条不显示

**根因**:`chat-page.js` 渲染 `.multi-select-bar` 时,根据 `multiSelectActive` 状态决定是否加内联样式:

```js
// chat-page.js
const multiSelectBarStyle = multiSelectActive ? '' : ' style="display:none"';
```

用户点「多选」按钮 → `toggleMultiSelect()` 方法把 `app.state.chat.action.multiSelectActive` 改成 `true` → 但**为了避免全量重渲染破坏 listener 绑定**(见 v0.47.1 注释),这个方法**不会重新 v-html**,只调用 `_refreshMultiSelectUI()` 手动改 DOM class:

```js
// 原来的 _refreshMultiSelectUI()
if (isActive) chat.classList.add('multi-select-mode');
```

期望靠 CSS `.multi-select-mode .multi-select-bar { display: flex }` 生效——**但上一次 v-html 渲染时写在 DOM 上的内联 `style="display:none"` 优先级高于任何普通 class 选择器**,CSS 规则被内联样式完全覆盖,所以工具条永远不显示。

**修复**(`index.js` `_refreshMultiSelectUI()`):除了切 class,**直接操作 `.multi-select-bar` 的 `style.display`**,绕开优先级问题:

```js
const bar = chat.querySelector('.multi-select-bar');
if (bar) bar.style.display = isActive ? 'flex' : 'none';
```

**教训**:v-html 渲染出来的内联 `style=""` 属性,后续想用 CSS class 去"反向覆盖"是不可靠的——**内联样式永远赢**。如果某个元素的显隐/样式一开始就是靠内联 style 决定的,后续手动 DOM 更新也必须直接改同一个内联 style,不能指望切个 class 就能反转。

### Bug 2:切出私聊再切回后,所有点击(工具栏按钮/地点卡片/收藏按钮)全部失效

**根因**:`initPrivateChatInteractions()` 原来的绑定时机竞态:

```
① renderDetailPage() 是 async 函数,return html 字符串
② framework 的 app-renderer-bridge 用 setTimeout(0) 排队执行 mountInto()
   → mountInto 内部才真正 rootEl.innerHTML = html
③ chat-app 侧用 queueMicrotask(() => initPrivateChatInteractions())
   → queueMicrotask 比 setTimeout(0) 更早执行！
④ initPrivateChatInteractions 内部用 waitForElement() 轮询查找 .chat-private
   → 此刻 DOM 里还是「上一次渲染」的旧节点(因为②还没跑到)
   → 轮询很快就"找到"了这个旧节点,立刻绑定 click listener
⑤ 紧接着②执行:rootEl.innerHTML = html → 整个 DOM 子树被替换成新节点
   → ④绑的 listener 跟着旧节点一起被扔掉,新节点上什么 listener 都没有
```

第一次进入私聊页时不会复现(因为 DOM 里还没有任何 `.chat-private`,轮询会等到 framework 真正写完才找到);
但**只要离开过一次再回来**,DOM 里已经残留着"上一次"的旧 `.chat-private` 节点,轮询会立刻命中它，Bug 100% 复现。

**修复方案**:放弃「猜时机」的轮询/微任务方案,改用 **`MutationObserver` 监听 DOM 变化**——这是唯一能保证"绑定发生在 `innerHTML` 真正写完之后"的方式,因为 MutationObserver 的回调本身就是由 DOM 变更触发的:

```js
// 模块顶层(index.js 顶部,只装一次)
if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined' && !window.__chatPrivateObserverInstalled) {
    window.__chatPrivateObserverInstalled = true;
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.classList?.contains('chat-private') && !node.__chatPrivateInteractionsBound) {
                    const chatApp = externalAppRegistry.getApp('chat');
                    chatApp?.methods?.initPrivateChatInteractions?.(node);
                }
                if (node.querySelectorAll) {
                    node.querySelectorAll('.chat-private').forEach(sub => {
                        if (!sub.__chatPrivateInteractionsBound) {
                            const chatApp = externalAppRegistry.getApp('chat');
                            chatApp?.methods?.initPrivateChatInteractions?.(sub);
                        }
                    });
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
```

配套改动:

1. `initPrivateChatInteractions(providedEl)` 改成**接受传入节点**,不再自己 `waitForElement` 轮询;`providedEl` 由 observer 直接给,不传时兜底查一次当前 DOM(极少数场景)
2. `renderDetailPage` 里原来 `pageId.startsWith('private-')` 分支的 `queueMicrotask(() => initPrivateChatInteractions())` **整段删除**——不再需要手动触发,MutationObserver 会自动接管
3. `__chatPrivateInteractionsBound` 防重复绑定标记继续保留(同一节点只绑一次;`toggleMultiSelect` 之类只改 class 不重新 v-html 的场景,节点不变,标记继续生效,不会重复绑)

**为什么 MutationObserver 是对的方案,而不是"改用更长的延迟"或"用 nextTick"**:

- `setTimeout(0)` / `queueMicrotask` / `Vue.nextTick()` 都是"猜一个大概靠谱的时机",本质上是时序竞态,只是把竞态窗口挪个位置,类似 bug 换个场景还会复现
- `MutationObserver` 的回调**由浏览器保证**在 DOM 真正变更后才触发,不存在"早于/晚于 innerHTML 写入"的问题,是这类"v-html 替换整个子树后需要重新绑定业务 listener"场景的**唯一可靠方案**

**排查过程中的教训**(过程曾经因为着急清诊断日志被用户当场纠正,记录下来避免下次重犯):

- 加了 `[LOG-DIAG-1]~[LOG-DIAG-11]` 一路打点后,**必须先在浏览器里实测确认现象消失，才能开始清日志**——写完代码 ≠ 修复生效,尤其是这种"绑定时机竞态"类 bug,凭代码审查很容易漏掉"新写的辅助函数根本没被正确调用"这种问题(这次就真的漏了一次:MutationObserver 最初调用了一个叫 `bindPrivateChatInteractions` 的函数,但这个函数根本不存在——应该调 `externalAppRegistry.getApp('chat').methods.initPrivateChatInteractions(node)`,是模块顶层作用域 vs methods 对象作用域搞混了)
- **诊断台词**:如果同一个 bug 修了"看起来对"但用户反馈"完全没修复",**第一步应该是重新读一遍刚写的代码而不是急着删日志或者道歉**——这次的教训是 MutationObserver 里调用的函数名和实际存在的函数名不一致,纯粹是没有跑一遍就自信"应该没问题了"。

**涉及改动**:

| 文件 | 改动 |
|------|------|
| `js/apps/chat-app/index.js` | 顶层新增 `MutationObserver`,监听 `.chat-private` 出现自动绑定;`_refreshMultiSelectUI()` 直接操作 `.multi-select-bar.style.display`;`initPrivateChatInteractions` 改成接受传入节点,不再轮询;删除 `renderDetailPage` 里对应的 `queueMicrotask` |

### 复用提示

如果后续 chat-app 里其他 detail 页(群聊/通话/收藏等)也出现"切出再切回后点击失效"的相同现象,**优先怀疑同一根因**——检查该页面的交互绑定是走 `queueMicrotask` / `setTimeout` 轮询,还是走 MutationObserver。前者只要 DOM 里残留旧节点就会复现,后者是稳定方案。

---

## v0.49 表情包库绑定 → 私聊/群聊表情贯通（2026-08-07）

### v0.49.1 目标

人设编辑器那一侧(2026-08-06 完成的 resources-section.js)已经支持把图库里的图组绑到 persona.boundResources.stickerGroupIds。**这一侧数据通路早就通,缺的就是 chat-app 私聊/群聊侧的表情选择器 + 点击发送。**

v0.49 把这条链路从「设置侧能绑」贯通到「聊天侧能发」。

### v0.49.2 触发流

```
用户在私聊/群聊输入区点右侧 #emojiBtn 笑脸
  ↓
.chats.private / .chat-group[data-emoji-open="1"] 切到「开」状态
  ↓ CSS 选择器控制显隐 — 不靠 v-html 重画
.input-toolbar 隐藏,.chat-emoji-picker 显示
  ↓
网格里点某个 .chat-emoji-cell[data-sticker-code]
  ↓ click delegate (initPrivateChatInteractions / initGroupChatInteractions)
调 sdk.chatMessages.add(type='sticker', url, stickerCode)
  ↓
appendChild 渲染气泡 + 关 picker + invalidateRendererCache 防止下次命中旧缓存
```

### v0.49.3 数据源

**当前 user persona**(`window.settingsSdk.users.getActive()`)的 `boundResources.stickerGroupIds: string[]`。

- 不读 AI 人设的 stickerGroupIds(你确认的:绑给「当前用户」)
- 图库数据走 `gallery_db.groups` / `gallery_db.images`,索引通过 `_findGroupPath` 走 `getAllLibraries → getLibraryAlbums → getAlbumGroups` 三层
- 缩略图:images.thumbnail(200×200 base64)— **首次进入页面时并行查 db + 填 src,不触发 v-html 重画**
- 发送时:按需 `getImageByCode(code)` 读 images.source(原图 base64),不存进 chatMessages

### v0.49.4 存储格式 — 只存 image.code 引用

`chatMessages.add()` 调用:

```js
sdk.chatMessages.add(sender, aiPersonId, mode, {
  id: msgId,
  sender: 'user',
  type: 'sticker',
  content: '[表情]',
  url: <原图 base64 临时读出来>,    // 临时构造,渲染完就不用了
  stickerCode: code,               // ★ 持久化的唯一引用
  timestamp: now,
})
```

**为什么不存 base64 进 IndexedDB**:
- 100KB+ base64 每条都存 → 100 条表情就 10MB+
- IndexedDB 性能急剧下降,刷新页面卡顿
- gallery_db 才是图片真理之源,chatMessages 只存 code 引用,渲染时按 code 现读

### v0.49.5 关键设计决策

| 决策 | 选择 | 为什么 |
|---|---|---|
| 触发点 | **只有**输入区 `#emojiBtn` 笑脸能 toggle | 工具栏「表情」按钮删了换「自定义」占位,避免重复入口 |
| 面板位置 | 替换输入区下方的 `.input-toolbar` 网格(同一位置) | 不需要新空间,符合微信/iMessage 习惯 |
| 布局 | 4 列 × 2 行 flex 网格 + overflow-y: auto | 表情多了自动滚动,无需分页 |
| 显隐切换 | `.chat-private[data-emoji-open="1"]` CSS 属性选择器 | **不重画 v-html**,避免破坏已绑的 listener |
| 缩略图填充 | 渲染后异步 `querySelectorAll` 填 src | 不触发重画,首屏不卡 |
| 发送时原图 | `getImageByCode(code)` 按需读 source | 性能 + 内存最优 |
| 关闭方式 | 点 `#emojiBtn` 笑脸关闭 + 表情图片点击 = 发送后自动关闭 | 单一交互路径 |
| 空状态 | 文案「暂未绑定表情包」 + 「去设置」按钮 | deepLink 到 settings → 人设编辑器 |

### v0.49.6 新增/改动文件

| 文件 | 改动 |
|---|---|
| `css/apps/chat/_chat-emoji-picker.css` | **新增** — 面板容器 + 网格 + cell + 头部 + 空状态 + loading + close button 全部样式 |
| `css/apps/chat/index.css` | 加 `@import './_chat-emoji-picker.css'` |
| `js/apps/chat-app/components/emoji-picker-panel.js` | **新增** — `renderEmojiPickerPanel()` 同步返回 HTML,`_fillEmojiPickerImages()` 异步填 src,`_loadThumbnail()` / `_loadSource()` 单图读取,`_invalidateEmojiCache()` 缓存失效 |
| `js/apps/chat-app/pages/chat-page.js` | import emoji-picker-panel;工具栏「表情」→「自定义」占位;`renderEmojiPickerHtml(aiPersonId)` 在 `.chat-private` 末尾塞 picker DOM;`data-emoji-open` 属性从 `app.state.chat.emojiOpen` 同步 |
| `js/apps/chat-app/pages/chat-group-page.js` | 同款改造(群聊页)|
| `js/apps/chat-app/index.js` | click delegate 加 `#emojiBtn` / `.chat-emoji-picker__close` / `.chat-emoji-cell[data-sticker-code]` 三个分支(私聊 + 群聊各一套);`__chatPrivateInteractionsBound` 后调 `_fillEmojiPickerImages` 初始填图;新增 `methods.closeEmojiPicker` 兜底方法 |

### v0.49.7 踩坑沉淀

1. **v-html 上下文里不能 `appendChild`**:picker DOM 必须在 `renderPrivateChatPage()` / `renderGroupChatPage()` 返回的**字符串**里,框架接管生命周期。AGENTS.md §16.21 同款禁止。

2. **缩略图填充不能靠 v-html 重画**:`_fillEmojiPickerImages(chatRoot, ids)` 直接 `querySelectorAll('.chat-emoji-cell[data-sticker-code]')` → 查 db → 把 src 塞进 img 元素。**完全不碰 framework 派发链**。这是异步 DOM 操作的"唯一合规"姿势(只读 / 写已挂载的属性,不改结构)。

3. **状态位要双向同步**:
   - render 时:`app.state.chat.emojiOpen` → 写到 `.chat-private` 的 `data-emoji-open` attribute
   - 点击时:反过来,改 attribute → 同步写回 `app.state.chat.emojiOpen`
   - 缺一不可,否则下次 v-html 会把状态抹掉

4. **`data-app-action` + click delegate 双保险**:
   - 关闭按钮 `.chat-emoji-picker__close` 写了 `data-app-action="closeEmojiPicker"`(framework 派发兜底)
   - click delegate 也直接处理 `.chat-emoji-picker__close` 关闭(快速路径)
   - 两边都生效,任一能跑就行,不会重复关闭(同步写 state,第二次进入时已是 closed)

5. **`invalidateRendererCache` 必须调**:v0.46 修过的 bug — sticker 消息写完后,如果下次切回私聊页面,framework 的 `_resolvedCache` 可能命中旧 HTML,导致新发的表情消息"凭空消失"。**任何写消息后调 `window.invalidateRendererCache?.('chat', contactId)`**,跟图片/语音/红包/转账同款。

6. **群聊的 `conversationType: 'group'` 必须显式设**:私聊 add() 默认 `conversationType: 'private'`,群聊必须显式传 'group',否则 `chatMessages.list()` 过滤时找不到。

### v0.49.8 不做的(v0.49 范围内排除)

- ❌ 表情包搜索 / 分类 / 收藏 / 最近使用(EmojiStore 完整功能,后续阶段)
- ❌ 系统 unicode emoji 字符(只做用户绑定的图组)
- ❌ AI 主动发表情(等 AI SDK 重构)
- ❌ 表情消息的转发 / 编辑 / 删除 / 多选(消息层通用操作后续接)
- ❌ 表情面板分页 dot(图片数 < 16 用网格滚动就够了)

### v0.49.9 验收清单

- [ ] 桌面打开 chat-app → 私聊某个 AI 联系人
- [ ] 输入区点笑脸 → 工具栏收起,表情面板出现
- [ ] 面板里展示当前 user persona 已绑定的所有图组的所有图片(4 列网格)
- [ ] 点击某个表情 → 消息流立刻追加 sticker 气泡 + 面板收起 + 灵动岛提示
- [ ] 切出私聊再切回 → sticker 消息**仍在**(invalidateRendererCache 生效)
- [ ] 刷新页面 → sticker 消息仍在(IndexedDB 持久化生效,渲染时按 code 现读 source)
- [ ] 当前 user 没绑图组 → 显示「暂未绑定表情包」+「去设置」按钮
- [ ] 点「去设置」→ 跳到 settings → 人设编辑器(资源绑定 section)
- [ ] 群聊页同款验证(emojiBtn + 表情发送 + 持久化)
- [ ] 工具栏「自定义」占位按钮:点击不报错,灵动岛提示「自定义 - 功能即将开放」


## X.8 回复提示词 v0.50(2026-08-07)—— 数据链路 + UI + 构造器(不接 AI)

### X.8.1 目标

把「回复提示词」从 **demo 占位 UI** 升级到 **真实数据驱动**:
- 每条提示词真的落到 IndexedDB(挂在 aiPerson 顶层字段,无新表)
- prompt-manager 详情页 UI 全部由 SDK 数据驱动,支持 **新增 / 编辑 / 删除 / 上移 / 下移 / 启停**
- 构造器 `buildReplyPromptsPrompt()` 真拼装 system prompt(人设 + 上下文 + 启用的提示词 + 特殊动作格式),暴露到 `window.__chatPromptBuilder`
- 后期接 AI SDK 时,业务代码只需:`const prompt = await window.__chatPromptBuilder.build({ aiPersonId, mode })` —— 不需要再读 chat.js

**不在 v0.50 范围**:
- ❌ 不接真实 AI SDK(留 `window.__chatPromptBuilder` 接入点,后续 PR 加)
- ❌ 不模拟 AI 回复(用户明确要求)
- ❌ 不动 prompt-db(settings 侧的 prompt 库编辑器)—— v0.51 再说

### X.8.2 触发流

```
聊天设置页 → AI 设置卡 → 「回复提示词」一行
   │
   └→ 跳 prompt-manager-{aiPersonId} 详情页
       │
       ├─ SDK 实时数据源: window.settingsSdk.replyPrompts.list(aiPersonId)
       │   └─ listActive(aiPersonId)         active=true,按 order 升序
       │   └─ get(aiPersonId, promptId)      读单条
       │   └─ add(aiPersonId, patch)         新增(返回写入的 record)
       │   └─ update(aiPersonId, id, patch)  更新(返回更新后的 record)
       │   └─ remove(aiPersonId, id)         删除
       │   └─ toggleActive(aiPersonId, id)   切换启停
       │   └─ setOrder(aiPersonId, ids[])    批量重排
       │
       └─ UI 所有按钮 → framework data-app-action → chat-app methods
           ├─ toggleReplyPromptActive  → sdk.replyPrompts.toggleActive
           ├─ moveReplyPromptUp/Down   → sdk.replyPrompts.setOrder(数组 swap)
           ├─ openEditReplyPromptModal → chatModalManager.openEditReplyPrompt(...)
           ├─ openCreateReplyPromptModal → 同上,isCreate=true
           └─ deleteReplyPrompt        → 走 framework 顶层确认弹窗 + remove
```

### X.8.3 数据存储

**存储位置**:`aiPerson.replyPrompts`(顶层字段,不是 socialProfiles.chat 下,避免与社媒字段混淆)

**为什么用顶层字段而不是新表**:
- `mergePatch` 已支持深合并,顶层字段写起来比 `socialProfiles.chat.replyPrompts` 更直观
- 不需要新增 IndexedDB store(避免 schema 升级)
- aiPersons 列表已经走 cache,读写都是 O(1)
- 跟 `boundResources` / `incomeEvents` 等类似字段保持一致风格

**单条结构**:
```js
{
    id: 'rp-mh3g-x8yz',        // 自动生成,前缀 'rp-'
    title: '温暖陪伴风格',        // 必填,UI 显示
    content: '...',             // 完整 prompt 文本(注入 system prompt 用)
    source: 'custom',           // 来源(custom / persona / chat / music / weather / calendar / album / moments)
    active: true,               // 是否进入当前上下文
    order: 1,                   // 注入顺序(越小越靠前)
    longBody: false,            // 是否默认折叠(预留,UI 暂未实现)
    createdAt: 1723123456789,
    updatedAt: 1723123456789,
}
```

### X.8.4 冷启动 fallback

为了让用户**冷启动**时也立刻看到真实数据(不等 SDK hydrate):
- `chat-snapshot.js` 的 `pickPersonSummary()` 在 aiPerson 有 replyPrompts 时,把 `replyPromptsActive: string[]` 写到 snapshot
- chat-app 启动时同步读 snapshot → 即使 SDK 未就绪,prompt-manager 页也能显示「已启用 X / 共 Y 条」的真实计数
- SDK ready 后,`prompt-manager-page.js` 会用 `sdk.replyPrompts.list()` 拿完整数据再重画

### X.8.5 Prompt 构造器

`js/apps/chat-app/services/prompt-builder.js`:

```js
import chatPromptBuilder from './services/prompt-builder.js';

// 1) build 完整 system prompt
const { systemPrompt, parts, stats } = await chatPromptBuilder.build({
    aiPersonId: 'ai0',
    mode: 'calendar',         // 或 'story'
    userId: 'user0',          // 可选,默认 defaultUserCard
    historyLimit: 12,         // 拉多少条近期聊天,默认 12
});
// systemPrompt → 喂给 AI SDK
// stats.activeReplyPrompts  → 这次注入了几条
// stats.totalHistory        → 拼装了多少条聊天历史

// 2) buildPreview 快速预览(给 prompt-manager 顶部展示用)
const { preview, stats } = chatPromptBuilder.buildPreview(aiPersonId);
```

**拼装顺序**(从最重要到最次要):
1. AI 人设本体 8 字段(name / gender / age / appearance / personality / bio / experience / avatar)
2. 用户人设本体 8 字段
3. 世界观背景(world.name / summary / keyPoints)
4. AI 的 enabled 模块(preferences / mood / memory / worldview / mbti / ...)
5. 用户的 enabled 模块
6. 近期聊天(最近 N 条 text + 特殊卡片摘要)
7. AI 当前心情(dailyMood)
8. 用户当前心情(dailyMood)
9. AI 今日日程(sdk.schedule.list)
10. 用户今日日程
11. AI 朋友圈(预留 hook,v0.51 接入 sdk.moments)
12. 用户朋友圈(同上)
13. **【关键】已启用的 replyPrompts(active=true,按 order)**
14. 特殊动作格式说明(SPECIAL_ACTIONS_HELP)

**特殊动作格式**(与 chat.js 兼容):
| 动作 | 格式 | 示例 |
|---|---|---|
| 发红包 | `[发红包:金额:祝福语]` | `[发红包:88:恭喜发财]` |
| 发位置 | `[发位置:地点名:详细地址]` | `[发位置:星巴克:北京xxx店]` |
| 转账 | `[转账:金额:备注]` | `[转账:100:本月生活费]` |
| 发语音 | `[发语音:秒数:文字内容]` | `[发语音:15:今天好累]` |
| 发图片 | `[发图片:背景色:文字色:描述]` | `[发图片:#FFE4EC:#D4728A:夕阳咖啡]` |
| 引用回复 | `[引用:消息id:回复内容]` | `[引用:msg-abc:我没听清]` |
| 分享聊天记录 | `[分享聊天记录:本会话最近N条]` | `[分享聊天记录:最近5条]` |
| 分享音乐 | `[分享音乐:歌名:歌手]` | `[分享音乐:晴天:周杰伦]` |

AI 输出这些格式时,message-renderer 会自动识别并渲染成对应卡片(v0.30+ 已实现)。

### X.8.6 暴露给外部的 API

```js
// chat-app 启动后挂到 window
window.__chatPromptBuilder = {
    build: function,         // 拼装完整 system prompt
    buildPreview: function,  // 快速预览(只拼装人设 + 模块 + replyPrompts)
    SPECIAL_ACTIONS_HELP: string,  // 特殊动作格式说明全文
};
```

**集成示例**(给后续 AI SDK 接入):
```js
// 在 sendReply / mockReply / 调用 AI 之前
async function callAi(aiPersonId, mode, history) {
    const { systemPrompt } = await window.__chatPromptBuilder.build({
        aiPersonId, mode, historyLimit: 20,
    });
    const reply = await callSomeAiSdk({
        model: 'gpt-4o',
        system: systemPrompt,
        messages: history,
    });
    return reply;
}
```

### X.8.7 改动文件清单

| 文件 | 改动 |
|---|---|
| `js/apps/setting/world/sdk/reply-prompts.js` | **新增** - replyPrompts SDK API(createReplyPromptsApi) |
| `js/apps/setting/world/sdk/settings-sdk.js` | import + 挂 `sdk.replyPrompts` |
| `js/apps/setting/world/sdk/chat-snapshot.js` | pickPersonSummary 加 `replyPromptsActive` |
| `js/apps/chat-app/services/prompt-builder.js` | **新增** - buildReplyPromptsPrompt / buildPreview / SPECIAL_ACTIONS_HELP |
| `js/apps/chat-app/pages/prompt-manager-page.js` | 重写:从 SDK 真实读数据 + 真实 UI |
| `css/apps/chat/_chat-prompt-manager.css` | 扩展:pm-toggle / pm-add-btn / pm-row-actions / pm-active/available-item / pm-empty |
| `js/apps/chat-app/index.js` | import prompt-builder + 暴露 window.__chatPromptBuilder + 6 个新 methods(toggle/move/edit/delete/create) |
| `js/apps/chat-app/components/chat-modal-components.js` | 新增 `EditReplyPromptModal` Vue 组件(title/content/source/active) |
| `js/apps/chat-app/components/chat-modal-registry.js` | import + `chatModalManager.openEditReplyPrompt()` 方法 |
| `css/apps/chat/_chat-private.css` | reply-prompt-modal-* 系列样式 |
| `js/apps/chat-app/pages/chat-settings-page.js` | 「回复提示词」显示从 replyPromptIds 改成 sdk.replyPrompts.listActive 真实计数 |

### X.8.8 验收清单

- [ ] 桌面打开 chat-app → 私聊某个 AI 联系人
- [ ] 聊天设置 → AI 设置卡 → 「回复提示词」显示「N 个已启用」/「未设置」
- [ ] 点「回复提示词」→ 跳 prompt-manager 详情页
- [ ] 「当前上下文」展示已启用的 prompt(系统虚拟 prompt 锁定 + 真实 active prompt)
- [ ] 「可用 Prompt」展示所有真实 prompt(active 标「已启用」、inactive 标「已停用」),每条带 segmented-tabs toggle
- [ ] 点「+」新增 → 弹窗填 title/content/source/active → 保存 → 自动出现在「可用 Prompt」里
- [ ] 点编辑 → 弹窗预填当前值 → 保存 → 字段实时更新
- [ ] 点 toggle → active 状态切换 + 跨 section 联动(「当前上下文」增减 + 「可用 Prompt」badge 切换 + 计数同步)
- [ ] 点删除 → 走顶层确认弹窗 → 删除 → 列表少一条
- [ ] 切走切回 chat-app → 数据不丢(IndexedDB 持久化生效)
- [ ] 刷新页面 → 数据不丢(mergePatch 深合并生效)
- [ ] 调 `window.__chatPromptBuilder.build({ aiPersonId: 'ai0' })` → 返回 `systemPrompt` 含「人设 + 模块 + 启用 replyPrompts + 特殊动作格式」
- [ ] SDK 未就绪时调 build → 兜底返回基础 prompt(仅特殊动作格式 + 警告)
- [ ] chat-snapshot 里有 `replyPromptsActive: [...]`(冷启动 fallback 生效)


