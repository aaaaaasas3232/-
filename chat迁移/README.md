# chat-app 迁移实施文档

> 规划源:`c:\Users\Administrator\.cursor\plans\聊天app迁移规划_314ca0f8.plan.md`
> 类型:**hybrid**(framework 的 `renderPage` 返回 HTML 字符串,内嵌 `<component-island>` 挂岛组件)
> 当前 phase:**Phase 11 进行中**(CSS 1:1 复原 — nav-tab 抽屉风 + 消息列表页 + 聊天设置详情页 + 动态页面 + 个人页面 + 日历视图 + 故事存档已完成)
> 最近一次更新:2026-08-08 11:10 — **v0.61.8.10 prompt-manager「拉取按钮灰态」+「启停不消失」恶性 bug 修复**:
> ① 拉取按钮点击一次以后必须变灰(之前用对勾 + 没「拉取」按钮 → 用户以为可重复拉取)
> ② `pulledFromLibrary` 过滤逻辑错:之前用 `inactiveList` 漏 active=true 的 → 「启停切换时卡片消失」(用户「333」消失恶性 bug)
> ③ 修复后用 `replyPromptsList.slice()`(全集) → 不论 active 与否都显示在 nook 组,toggle 切视觉高亮
> ④ 拉取成功后的 `__detailRenderTick.value++` 在 async renderMode 下被缓存拦截 → 改用 `invalidateRendererCache` + `syncNow({ force: true })` 二段式
> 详见 §v0.61.8.10
>
> **上一次更新 2026-08-08 08:55** — **v0.61.7.3 prompt-manager 顺序修改 / systemPromptOverrides / contextOrder 三持久化补丁**:
> ① `systemPromptOverrides` 没在 hydrate 恢复(localStorage 有但内存丢)
> ② `state.chat.contextOrder` 只在内存,刷新后 prompt-manager 顺序回退
> ③ SDK `replyPrompts.setOrder` 只持久化 replyPrompts 自己的顺序,**system-*/context-rounds/world-* 等虚拟卡片的位置变化只能靠 `contextOrder`**,但没持久化
> ④ `renderPromptControlCard` 漏写 `pm-card` 类,drag-controller 选不到 system/world/library 等卡
> ⑤ `reorderContextPrompts` / `savePromptManagerChanges` 之前走 `nookSdk.prompts.reorder` 写到 `aiPerson.nookPrompts`,跟所有 toggle/edit/delete/move 操作的 `sdk.replyPrompts` 是两套数据,保存按钮「写完 order 不变」的根因
> 详见 §v0.61.7.3
> 
> **追加日志 2026-08-07 21:11**:v0.45 ~ v0.49 中间多个版本(故事模式 + 顶栏修复 + 收藏页 data-app-action 重写 + 消息操作按钮 + SDK 签名修正 + 对话片段)在 §v0.36 / §v0.37 / §v0.43 / §v0.44 已经覆盖。**v0.49 表情包发送闭环**是 2026-08-07 晚上新增的核心功能(详见 §v0.49)

---

## A.0 本轮新增：默认用户卡 + 联系人独立副本 + 聊天记录模式（v0.23 2026-08-05）

### A.0.1 数据层新增

| 新增 | 位置 | 说明 |
|---|---|---|
| `isDefaultUserCard: boolean` | `sdkUsers` 每条记录顶层字段 | 标记这张用户卡是不是「默认」 |
| `chatContacts` 表 | `listen_db` 新表 | 聊天 app 的联系人独立副本（keyPath=`id`） |
| `sdk.defaultUserCard` | `window.settingsSdk.defaultUserCard` | 新增 API（getDefault / setDefault / clearDefault / isDefault / listWithDefault / onUserRemoved） |
| `sdk.chatContacts` | `window.settingsSdk.chatContacts` | 新增 CRUD（list / listForMode / listForAi / get / getByAiAndMode / create / update / remove / hydrate） |

**chatContacts 表字段**：
```js
{
  id: 'contact-{aiPersonId}-{mode}-{ts}-{rand}',
  aiPersonId: 'ai0',                              // 绑定的 AI 人设
  recordMode: 'calendar' | 'story',               // ★ 添加时选定的模式（不可改）
  displayName: '小美',
  avatar: '...', avatarBg: '...',
  boundWorldId: 'world0',                         // 添加时的世界观快照
  lastMessage: null, lastMessageAt: 0,
  unreadCount: 0, isPinned: false,
  createdAt, updatedAt
}
```

### A.0.2 业务流程

**默认用户卡**
- 用户库里任意一张 user 卡右上角会显示「当前」(active) +「默认」(isDefaultUserCard) 两个 badge
- 选中卡编辑表单底部，在「保存全部」与「删除此卡设定」之间新增「设为默认 / 取消默认」按钮
- AI 卡没有默认字段（编辑器底部不显示该按钮）
- 默认卡被删除时，SDK `defaultUserCard.onUserRemoved()` 自动 fallback 到当前 active user
- 切换默认卡后，下次进入 chat-app / murmur 的「我」页面会自动用新默认卡数据

**联系人独立副本（chatContacts）**
- 同一个 AI 人设可被添加两次：一次选「日历模式」生成一个副本，再选「故事模式」再生成另一个副本
- 副本 id 不一样（`contact-{aiPersonId}-calendar-...` vs `contact-{aiPersonId}-story-...`），互不影响
- 进入私聊的 pageId 变成 `private-${contact.id}` 而不是 `private-ai-1`

**聊天记录模式（chat-mode.js）**
- 消息列表右上角搜索按钮左边新增「模式切换按钮」
- 点击在「日历视图模式 / 故事记录模式」之间切换
- 切换后**仅消息列表页**背景变粉（其他页面背景不变）
- 模式存在 `localStorage('xiaoting::chat-record-mode-v1')`（每次重新打开 chat-app 默认回日历模式）
- 切换时灵动岛提示 + 自动刷新消息列表

**添加新朋友流程（重构）**
1. 消息列表「+」 → push `record-mode-selector`（v0.23 新页）
2. 用户选「日历视图模式 / 故事记录模式」（**选定后不可改**）
3. push `new-chat` 联系人列表页，列表自动按「当前 mode 已添加的副本」过滤（避免同 AI 同 mode 重复添加）
4. 点联系人 → chat-app method `pickContactAndCreate` → 创建 `chatContacts` entry → push `private-${newContactId}` 私聊页

### A.0.3 当前默认用户卡未绑世界观 → 通讯录/消息列表 空状态

- 默认卡没绑世界 → 消息列表显示「尚未绑定世界观」提示
- 默认卡没绑世界 → 通讯录显示「默认用户卡未绑定世界观」提示
- 新朋友页也读不到任何 AI 人设（因为没有「当前世界观」）

### A.0.4 AI 联系人备注功能（v0.28 2026-08-06）

**功能描述**：每个 AI 联系人可以在日历模式和故事模式下分别设置不同的备注名，备注会覆盖显示名。

**数据存储**：
- `remark` 字段存储在 `chatContacts` entry 里，每个 mode 独立存储
- 通过 `sdk.chatFriends.updateRemark(user, aiPersonId, mode, remark)` 更新
- 入口：聊天设置页 → 备注一行 → 弹出 AiRemarkModal 编辑弹窗

**UI 显示优先级**：`entry.remark || entry.displayName || fallbackName`

**涉及文件**：
- `js/apps/setting/world/sdk/chat-friends.js` — `add` 函数初始化 `remark` 字段
- `js/apps/chat-app/pages/chat-settings-page.js` — 联系人名字优先显示备注
- `js/apps/chat-app/pages/chat-page.js` — 私聊页顶栏名字优先显示备注
- `js/apps/chat-app/pages/messages-page.js` — 消息列表名字优先显示备注 + `loadContactsForMode` 映射 `remark`
- `js/apps/chat-app/components/chat-modal-components.js` — AiRemarkModal 弹窗组件
- `index.html` — `@close` 事件触发 `onClose` 回调刷新 UI

**已知限制**：
- 之前添加的好友 entry 没有 `remark` 字段，需要**重新添加好友**才能使用备注功能

### A.0.5 涉及文件清单

**新增**
- `js/apps/chat-app/chat-mode.js` — 全局 mode 模块
- `js/apps/chat-app/pages/record-mode-selector-page.js` — 模式选择页
- `js/apps/setting/world/sdk/default-user-card.js` — SDK API
- `js/apps/setting/world/sdk/chat-contacts.js` — SDK CRUD

**修改**
- `js/db/base-stores.js` — 加 `chatContacts` 表
- `js/apps/setting/world/sdk/defaults.js` — SDK_STORES 加 chatContacts
- `js/apps/setting/world/sdk/settings-sdk.js` — 挂 defaultUserCard + chatContacts
- `js/apps/setting/user/section.js` — persona-card 加「默认」badge
- `js/apps/setting/persona/renderer.js` — 编辑器底部加「设为默认 / 取消默认」按钮
- `js/apps/setting/persona/methods.js` — 加 `personaSetDefault` / `personaUnsetDefault` / 删除 user 时调 `onUserRemoved`
- `js/apps/chat-app/index.js` — 加 `openNewChat`(push mode-selector) / `selectRecordMode` / `pickContactAndCreate` / `toggleRecordMode` / `refreshMessagesTab`
- `js/apps/chat-app/pages/messages-page.js` — 改用 chatContacts.listForMode
- `js/apps/chat-app/pages/contacts-page.js` — 改用 chatContacts.listForMode
- `js/apps/chat-app/pages/new-chat-page.js` — 加 `__pendingRecordMode` + 过滤已添加副本
- `js/apps/chat-app/pages/chat-page.js` — 私聊从 `chatContacts.get(id)` 读
- `css/apps/chat/_chat-messages.css` — 加消息列表背景蓝/粉 + 切换按钮样式
- `css/apps/chat/_chat-new-chat.css` — 加模式选择页 + mode-chip 样式
- `css/settings/_persona.css` — 加「默认」badge + 默认卡按钮样式

### A.0.6 v0.23b 按钮样式调整（2026-08-05 19:45）

1. **模式切换按钮 + 搜索按钮统一包到 .chat-topbar-actions 容器里** — 两者高度都是 28px 圆形,SVG 都 18px,垂直对齐
2. **模式切换按钮只显示 SVG 不显示文字** — 圆角背景下日历图标,hover 提示文案(title显示「点击切换为日历/故事模式」)
3. **chat-mode-toggle-btn class 保留,但样式从圆角矩形改成圆形** — 跟 search-btn 保持一致风格
4. **children is not defined 报错** — 重写 initTopbar 时漏了 const children = Array.from(topbar.children);,要确保该行在 titleDiv 引用前就执行(踩坑)

### A.0.5 踩坑笔记（写给下一轮 AI）

1. **`renderPrivateChatPage` 必须从 chatContacts 读 contact,别再用硬编码 `DEMO_CONTACTS[contactId]`** — v0.23 之后 contactId 是副本 id（`contact-xxx-calendar-...`），不是 ai id
2. **同 AI 不同 mode 的副本是两个独立 entry** — 修改其中一个不影响另一个，包括消息、置顶、未读等
3. **「设为默认」按钮只在 entityType === 'user' 时显示** — AI 卡没有 isDefaultUserCard 字段
4. **模式切换按钮只影响 `.chat-messages-list-page` 背景** — 不要给整个 chat-app 加 .is-story-mode，否则通讯录/动态/我都会跟着变粉
5. **chatContacts.create 时 mode 必填** — 走 `window.__pendingRecordMode`(选模式页临时写入)或调用方显式传入
6. **删除 user 卡时会自动 fallback 默认卡** — 通过 `defaultUserCard.onUserRemoved()`，不要手动调用 `setDefault`(`onUserRemoved` 已经包含 fallback 逻辑)
7. **`refreshMessagesTab` 是顶层函数不依赖 this** — framework 调 method 时 this 是 undefined,顶层函数更鲁棒

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

### A.7.1 Bug 修复记录

| 日期 | 问题 | 根因 | 修复 |
|------|------|------|------|
| 2026-08-05 | 页面显示 `[object Promise]` | `renderChatPage`/`renderDetailPage` 使用 `async function` 返回 Promise，framework 不支持 async root renderer | 改回同步函数，异步数据加载改用 `queueMicrotask` + DOM 操作 |
| 2026-08-05 | ESM 导入路径错误（500 错误） | `../setting/gallery/gallery-db.js` 路径错误（`pages/` 向上只有一级） | 改为 `../../setting/gallery/gallery-db.js` |
| 2026-08-05 | `getWorldAiPersons` 未导出 | 函数未加 `export` 关键字 | 添加 `export` |
| 2026-08-05 | 人设 / AI 卡 / 用户卡编辑后保存无效（灵动岛弹「已保存」但字段没改） | `js/apps/setting/persona/renderer.js` 给 `base` / `meta` 顶层字段生成 `data-persona-field="entityType\|groupKey\|fieldKey"`，但 `persona.name` / `gender` / `boundWorldId` 等都是 persona 顶层字段，不是 `persona.base.X` 嵌套。`collectFieldsFromDom` 把改动写到 `patch.base.X` / `patch.meta.X`，`mergePatch` 写入 `persona.base.X` / `persona.meta.X`，前端读的还是顶层 `persona.X`，看起来「没保存」。 | `renderer.js` 新增 `personaFieldPath(entityType, groupKey, fieldKey)`：`base` / `meta` 写成 `entityType\|fieldKey`（省略中间 groupKey），其他模块组（`preferences` / `memory` / `mbti` / `assetNotes` / ...）保持 `entityType\|groupKey\|fieldKey` 不变。详细分析与诊断台词见 `AGENTS.md` §15。 |
| 2026-08-06 | AI 联系人备注功能三处不生效（聊天设置页 / 私聊页 / 消息列表页） | 1) `chat-friends.js` 的 `add` 函数没有初始化 `remark` 字段；2) `messages-page.js` 的 `loadContactsForMode` 没有映射 `remark` 字段；3) `index.html` 的 `@close` 事件没有触发 `onClose` 回调 | 1) `add` 函数添加 `remark: chatPerson.remark \|\| ''`；2) `loadContactsForMode` 映射 `remark` 字段；3) `@close` 事件触发 `onClose` 回调刷新 UI |
| 2026-08-06 | 聊天背景弹窗看不到弹窗内容（看到的是 framework 的 backdrop 模糊遮罩） | 自己重写了弹窗结构，删了 `.chat-bg-modal-overlay` wrapper 让 `.chat-bg-modal` 直接占满整层 (`width:100%;height:100%;background:#FFFFFF`)，把 framework 的 `.app-modal-backdrop` 完全覆盖了 | 恢复 overlay + modal 双层结构，照抄 `LocationCardModal` / `AiRemarkModal` 的 `position: fixed; inset: 0; background: rgba(0,0,0,0.4)` 样式 |
| 2026-08-06 | 聊天背景图跟着消息滚动（应该是 fixed 不动的） | `data-chat-bg` 和内联 `background-image` style 直接挂在 `.chat-messages` 上（`.chat-messages` 本身是 `overflow-y: auto` 的滚动容器），滚动容器的背景图被 scroll 一起带走 | 把 `data-chat-bg` + 内联 style 改挂到 `.chat-private` 页面根（`position: absolute; inset: 0; overflow: hidden`，不滚动），CSS 配套：把 `.chat-messages[data-chat-bg]` 所有的规则都换成 `.chat-private[data-chat-bg]`，同时 `.chat-messages` 改 `background: transparent` 让背景透过来，气泡用 `position: relative; z-index: 1` 抬到背景之上 |
| 2026-08-06 | 聊天背景弹窗点「×」清空预览立即写入空背景（用户期望仅清预览，必须点保存才生效） | `clearBackground` 方法同时做了两件事：清 `activeImage` + `$emit('save', '')`，导致预览的「×」按钮和底部「恢复默认」按钮触发同一个行为 | 拆成两个方法：`clearBackground()` 只清 `activeImage`（点预览图上的「×」时调用），`resetBackground()` 才 `$emit('save', '')`（底部「恢复默认」按钮调用） |

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
| **1**   | CSS 1:1 复原                                               | ✅ 进行中 | **nav-tab 抽屉风 + 消息列表 + 动态 + 个人页已完成**,Phase 1.3/1.5/1.6 CSS 完成 |
| 1.1     | 提取 chat.js 内联 CSS                                        | ✅ 完成  | nav-tab 样式(白底/蓝灰/指示器/波纹)已注入 `index.css`               |
| 1.2     | nav-tab 骨架                                               | ✅ 完成  | 「消息/通讯录/动态/我」4 root page + SVG icon + **抽屉贴底风**       |
| 1.2a    | `css/apps/chat/_chat-base.css`                           | ✅ 完成  | **空文件**(暂无样式)                                         |
| 1.3     | `css/apps/chat/_chat-private.css`                        | ✅ 完成  | 私聊详情页样式(顶部 header + 消息区 + 回复预览)                        |
| 1.4     | `css/apps/chat/_chat-group.css`                          | ☐ 待办  | 群聊详情页样式                                               |
| 1.5     | `css/apps/chat/_chat-bubble.css`                         | ✅ 完成  | 消息气泡(用户/AI/系统/游戏/表情/图片/语音/红包/转账)                      |
| 1.6     | `css/apps/chat/_chat-input.css`                          | ✅ 完成  | 输入区 + 工具栏(图片/语音/表情/位置/红包/转账/通话/收藏)                    |
| 1.7     | 作用域隔离 `.chat-app` 容器                                     | ✅ 完成  | 类名前缀,不带 `#phone`(项目约定)                                |
| 1.8     | 改动点注释                                                    | ✅ 完成  | `index.css` 顶部有完整改动说明                                 |
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
| **11**  | 页面(消息列表 / 聊天详情 / 历史 / 存档 / 通讯录 / 动态 / 个人 / 游戏)           | ✅ 进行中 | **消息列表页 + 动态页 + 个人页 + 私聊详情页 + 聊天设置页 UI 已完成**,通讯录待办                         |
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
- ✅ **Phase 11 — 动态页面 UI 复原** (2026-08-04 14:02)
  - **来源**:旧版 `ChatApp.prototype.renderMomentsPage` + `renderMomentItem` + `loadMomentsListAsync`
  - **文件**:`js/apps/chat-app/pages/moments-page.js` + `css/apps/chat/_chat-moments.css`
  - **路由分发**:在 `index.js` 的 `renderChatPage` 加 `if (currentId === 'moments')` 分发
  - **CSS 链入**:在 `index.css` 加 `@import './_chat-moments.css'`
  - **UI 结构 1:1 复原**:
    - 韩风蓝粉渐变背景 (蓝→粉→白)
    - 博主头像信息区 (80px 头像 + `(我)` 标识)
    - 发布新动态按钮 (hover 上浮 + 阴影)
    - 动态卡片 (头像+名字+时间+文字+图片网格+位置+互动按钮)
    - 评论区 (简化版,显示评论数和回复关系)
    - `fadeInUp` / `spin` 动画
  - **演示数据**:3 条 DEMO_MOMENTS (文字/多图/单图+评论)
  - **待接交互**:点赞/评论/分享按钮的 data 属性已注入,后续 Phase 接 `toolkit.island`
|- ✅ 私聊页面 UI 复原 (2026-08-04 17:55)
  - **来源**:旧版 `ChatApp.prototype.renderPrivateChat()`
  - **文件**:`js/apps/chat-app/pages/chat-page.js`
  - **路由分发**:在 `index.js` 的 `renderDetailPage` 加 `if (pageId.startsWith('private-'))` 分发
  - **CSS 链入**:沿用 `_chat-private.css` / `_chat-bubble.css` / `_chat-input.css`
  - **UI 结构 1:1 复原**:
    - 顶部栏(返回按钮 + 头像 + 名字 + 在线状态 + 更多按钮)
    - 消息气泡(用户粉 #FFE8F0 / AI 蓝 #E8F2FF + 圆角 + 阴影)
    - 日期分隔线
    - 消息操作按钮(收藏/删除/回复)
    - 回复预览区
    - 输入区域(输入框 + 发送按钮 + 工具栏展开按钮)
    - 工具栏(8 个按钮:图片/语音/表情/位置/红包/转账/通话/收藏)
  - **Demo 数据**:6 条示例消息(文字对话 + 日期分隔)
  - **交互待接**:返回按钮/发送按钮/工具栏按钮的 data 属性已注入,后续 Phase 接 IndexedDB + AI 服务

- ✅ **聊天设置详情页 UI 复原 (2026-08-04 18:55)** — 由私聊页 header 「…」更多按钮触发
  - **现象**:旧版 `chat.js` 里私聊页 header 右上角的「…」按钮叫 `chat-settings-btn`,
    点击会进入 `openAIChatProfile(aiId)`,展示该 AI 联系人的完整设置面板
    (头像/名字、语音视频入口、备注/置顶/免打扰、上下文长度、朋友圈读取、回复提示词、
    互动统计、危险操作等)。
  - **迁移 bug**:迁移版本 `chat-page.js` 只留了 `data-action="settings"`,没有
    `data-app-action` JSON,framework 派发不到任何 action,点上去毫无反应。
  - **修复**:
    1. **按钮加 data-app-action**:改成 `{"action":"detail","appId":"chat","pageId":"chat-settings-${contactId}"}`,
       framework 收到 `detail` action 自动 push 到 `detailPageStack`。
    2. **新文件**:`js/apps/chat-app/pages/chat-settings-page.js` —
       `renderChatSettingsPage(app, contactId)`,1:1 复刻旧版 `openAIChatProfile` 的 UI。
    3. **路由分发**:在 `index.js` 的 `renderDetailPage` 加
       `if (pageId.startsWith('chat-settings-'))` 分发。
    4. **新 CSS 文件**:`css/apps/chat/_chat-settings.css`,蓝粉渐变背景 + 白底卡片
      + iOS 风 toggle,跟其他 chat 详情页同风格。
    5. **链入**:`css/apps/chat/index.css` 加 `@import './_chat-settings.css'`。
  - **UI 结构**:
    - 顶部:头像 + 名字 + 状态(80px 圆角方形头像 + 渐变色 background)
    - 三个圆形入口按钮(语音 / 视频 / 朋友圈),原版 50×50 渐变圆
    - 「设置」卡片:备注 / 置顶开关 / 免打扰开关 / 聊天背景 / 拍一拍后缀
    - 「AI 设置」卡片:上下文长度 / 上下文智能稀释开关 / 可读取朋友圈 / 回复提示词 /
      回复增强(带 Beta 角标)/ 关键词触发提示词 / 表情库
    - 「聊天记录管理」卡片:日历视图 / 故事记录(每个 item 配 32×32 渐变小图标)
    - 「互动统计」卡片(仅主角色):4 个色块统计(蓝/粉/绿/琥珀)+ 拉黑统计 + 统计数据进入 Prompt
    - 「危险操作」卡片:清空聊天记录 / 拉黑此联系人(红字 #FF3B30)
  - **iOS toggle 样式**:`.chat-toggle` 50×28 圆角,checked 后 green + thumb 滑到右边
  - **样式规范**:所有内联样式移到 CSS,只保留动态颜色(`data-avatar-color` / `data-color-kind` / `data-color-gradient`)
  - **待接交互**:各 setting item 的 id 已注入(备注/上下文长度/朋友圈读取等),后续 Phase 接 IndexedDB + 业务逻辑
  - **踩坑笔记**:
    - **`renderPage` 内部不能用 `this`**:`renderChatSettingsPage` 必须是模块顶层函数,
      从 appConfig 对象上拿下来调时 `this` 已丢失(本项目之前的通用坑,见 AGENTS.md §2.3)。
    - **detail-page 框架差异**:framework 的 `currentDetailView` 在 hybrid 模式下需要
      `renderDetailPage` 函数返回值。`renderDetailPage` 原本只处理 `private-*`,现在加了
      `chat-settings-*` 分发即可。
    - **CSS 作用域**:所有规则带 `.app-shell[data-app-id="chat"]` 前缀,跟其他 chat CSS 同款策略。

- ✅ **回复提示词管理详情页 UI 复原 (2026-08-05 01:50)** — 由聊天设置页 → AI 设置 → 「回复提示词」一行触发
  - **现象**:旧版 `chat.js` 里 `set-reply-prompt` 点击会进入 `openReplyPromptSelector(aiId)`,
    展示「选择回复提示词」页面(分类列出所有模板 + checkbox 多选 + 保存按钮)。
    迁移版 `chat-settings-page.js` 只显示一行 `未设置`,**没有** `data-app-action`,
    framework 派发不到任何 action,点上去毫无反应。
  - **本项目方案 vs 旧版方案**:旧版是简单的「模板多选器」,本项目需求是
    「**通过 SDK 接收别的软件的 prompt 跟自己的 prompt 配置**」,所以本项目需要做
    一个更复杂的页面(见下方功能描述),不复用旧版的简单选择器。
  - **修复**:
    1. **按钮加 data-app-action**:`chat-settings-page.js` 里 `set-reply-prompt` 加
       `data-app-action='{"action":"detail","appId":"chat","pageId":"prompt-manager-${contactId}"}'`
    2. **新文件**:`js/apps/chat-app/pages/prompt-manager-page.js` —
       `renderPromptManagerPage(app, contactId)`,UI 实现见下方。
    3. **路由分发**:在 `index.js` 的 `renderDetailPage` 加
       `if (pageId.startsWith('prompt-manager-'))` 分发。
    4. **新 CSS 文件**:`css/apps/chat/_chat-prompt-manager.css`,蓝粉渐变背景 +
       白底卡片 + iOS 风 toggle,跟其他 chat 详情页同风格。
    5. **链入**:`css/apps/chat/index.css` 加 `@import './_chat-prompt-manager.css'`。
    6. **JS 交互**:`index.js` 的 `methods.initPromptManagerInteractions()` —
       折叠/展开(大区块 + 软件分组 + 单条长内容)、复制 JSON 到剪贴板。
       **未做**:长按拖动排序(JSON 改顺序的真正逻辑留待业务接入)。
  - **页面功能(UI 占位,业务逻辑后续 Phase 接入)**:
    - **顶部自接管 header**:返回按钮 + 「回复提示词」标题(蓝主题 #4A6FA5)
    - **头部信息卡**:头像 + 联系人名字 + 「已开启 N 个 Prompt / 上下文共 N 项」
    - **第一部分「当前上下文」(可折叠)**:列出已开启进入上下文的 prompt(6 条 demo),
      每条带拖动手柄(6 点 SVG icon),标题 + 顺序标号「第 N / 6」,
      内容过长时折叠预览(单行 60 字省略号)+ 「展开 / 收起」按钮;
      底部提示文案「长按手柄可调序(此页仅 UI 占位)」
    - **第二部分「可用 Prompt」(可折叠)**:按「软件 / 来源」分组(7 个 demo 软件:
      人设空间 / 聊天记录 / 音乐 / 天气 / 日程 / 相册 / 朋友圈),
      每个软件一行(icon + 名字 + 描述 + 「已启用 N / 共 N」徽标 + 折叠箭头),
      点展开后列出该软件所有 prompt,每条带标题 + 简介 + iOS 风 toggle
    - **音乐软件示例卡片**:
      - 「正在播放」prompt 展开后,显示**真实音乐卡片预览**(移植旧版 chat.js 第 1488-1512 行的
        `song-share-card`,180px 宽,粉渐变背景 + 封面 + 歌曲名 + 艺人 + 「分享歌曲」底栏)
      - 卡片预览下方暴露**卡片 JSON 结构**(格式化输出,等宽字体),
        配「复制」按钮 — `navigator.clipboard.writeText()` + 灵动岛 notify 反馈
      - 复制后用户找 AI 改字段 → 粘贴回此覆盖(覆盖逻辑后续接入)
    - **视觉规范**:
      - 全部图标用 inline SVG,**禁用 emoji**(用户明确要求)
      - 蓝粉渐变背景 `linear-gradient(180deg, #E8F2FF 0%, #FFF5F7 50%, #FFFFFF 100%)`
      - 头部信息卡用蓝粉渐变 + 浅边框
      - 软件 icon 用浅蓝粉渐变方块 + #4A6FA5 色 SVG
      - 卡片 JSON 区用等宽字体 + 浅灰底,模拟代码块
  - **踩坑笔记**:
    - **折叠要分三层**:大区块折叠(`.pm-section-head`) + 软件分组折叠(`.pm-group-head`)
      + 单条长内容折叠(`.pm-active-body-folded` / `.pm-active-body-full`),用
      `aria-expanded` 反映状态,CSS `[aria-expanded="true"]` 自动旋转箭头。
    - **拖动排序留 UI 占位**:长按手柄的视觉已完成,但真拖动逻辑(H5 drag-and-drop
      或 sortable 库)留待后续业务接入 — 此页只是 UI 演示,数据都是静态 demo。
    - **复制 JSON 兜底**:`navigator.clipboard.writeText` 在 iframe / 非 HTTPS 环境可能
      失败,加了 `document.execCommand('copy')` 兜底,失败时通知「请手动选择文本复制」。
    - **class 命名**:统一用 `.pm-*` 前缀,与现有 chat 子页面的 `.chat-*` 区分,
      避免 CSS 选择器冲突。

- ✅ **群聊设置详情页 UI 复原 (2026-08-04 22:40)** — 由群聊页 header 「…」更多按钮触发
  - **现象**:点击群聊详情页 header 右上角的「…」按钮,应进入群聊设置面板
    (群头像/群名称/成员数/群公告/群二维码/备注/消息设置/群管理/危险操作等)。
  - **修复**:
    1. **按钮加 data-app-action**:改成 `{"action":"detail","appId":"chat","pageId":"group-settings-${groupId}"}`,
       framework 收到 `detail` action 自动 push 到 `detailPageStack`。
    2. **新文件**:`js/apps/chat-app/pages/chat-group-settings-page.js` —
       `renderGroupSettingsPage(app, groupId)`,1:1 复刻群聊设置面板的 UI。
    3. **路由分发**:在 `index.js` 的 `renderDetailPage` 加
       `if (pageId.startsWith('group-settings-'))` 分发。
    4. **CSS 扩展**:在 `_chat-settings.css` 末尾添加群聊设置页面特有样式
      (群头像九宫格/群成员预览/群主标识/退出群聊按钮等)。
  - **UI 结构**:
    - 顶部:群头像(九宫格拼接) + 群名称 + 成员数
    - 「群信息」卡片:群聊名称 / 群公告 / 群二维码 / 备注 / 查找聊天记录
    - 「消息设置」卡片:置顶聊天 / 消息免打扰 / 消息提醒 / 聊天背景
    - 「群管理」卡片:群成员(头像预览+查看更多) / 群聊设置 / 聊天记录
    - 「危险操作」卡片:清空聊天记录 / 退出群聊(红字 #FF3B30)
  - **复用策略**:复用 `_chat-settings.css` 的通用卡片/toggle/设置项样式,
    只在末尾添加群聊特有样式(群头像九宫格/成员预览等)。
  - **踩坑笔记**:
    - **模板字符串变量注入**:在 `data-app-action` 中使用 `${groupId}` 变量,
      需要确保模板在正确位置,groupId 是函数参数而非 this 上下文。
  - **现象**:旧版 `chat.js` 里私聊页 header 右上角的「…」按钮叫 `chat-settings-btn`,
    点击会进入 `openAIChatProfile(aiId)`,展示该 AI 联系人的完整设置面板
    (头像/名字、语音视频入口、备注/置顶/免打扰、上下文长度、朋友圈读取、回复提示词、
    互动统计、危险操作等)。
  - **迁移 bug**:迁移版本 `chat-page.js` 只留了 `data-action="settings"`,没有
    `data-app-action` JSON,framework 派发不到任何 action,点上去毫无反应。
  - **修复**:
    1. **按钮加 data-app-action**:改成 `{"action":"detail","appId":"chat","pageId":"chat-settings-${contactId}"}`,
       framework 收到 `detail` action 自动 push 到 `detailPageStack`。
    2. **新文件**:`js/apps/chat-app/pages/chat-settings-page.js` —
       `renderChatSettingsPage(app, contactId)`,1:1 复刻旧版 `openAIChatProfile` 的 UI。
    3. **路由分发**:在 `index.js` 的 `renderDetailPage` 加
       `if (pageId.startsWith('chat-settings-'))` 分发。
    4. **新 CSS 文件**:`css/apps/chat/_chat-settings.css`,蓝粉渐变背景 + 白底卡片
      + iOS 风 toggle,跟其他 chat 详情页同风格。
    5. **链入**:`css/apps/chat/index.css` 加 `@import './_chat-settings.css'`。
  - **UI 结构**:
    - 顶部:头像 + 名字 + 状态(80px 圆角方形头像 + 渐变色 background)
    - 三个圆形入口按钮(语音 / 视频 / 朋友圈),原版 50×50 渐变圆
    - 「设置」卡片:备注 / 置顶开关 / 免打扰开关 / 聊天背景 / 拍一拍后缀
    - 「AI 设置」卡片:上下文长度 / 上下文智能稀释开关 / 可读取朋友圈 / 回复提示词 /
      回复增强(带 Beta 角标)/ 关键词触发提示词 / 表情库
    - 「聊天记录管理」卡片:日历视图 / 故事记录(每个 item 配 32×32 渐变小图标)
    - 「互动统计」卡片(仅主角色):4 个色块统计(蓝/粉/绿/琥珀)+ 拉黑统计 + 统计数据进入 Prompt
    - 「危险操作」卡片:清空聊天记录 / 拉黑此联系人(红字 #FF3B30)
  - **iOS toggle 样式**:`.chat-toggle` 50×28 圆角,checked 后 green + thumb 滑到右边
  - **样式规范**:所有内联样式移到 CSS,只保留动态颜色(`data-avatar-color` / `data-color-kind` / `data-color-gradient`)
  - **待接交互**:各 setting item 的 id 已注入(备注/上下文长度/朋友圈读取等),后续 Phase 接 IndexedDB + 业务逻辑
  - **踩坑笔记**:
    - **`renderPage` 内部不能用 `this`**:`renderChatSettingsPage` 必须是模块顶层函数,
      从 appConfig 对象上拿下来调时 `this` 已丢失(本项目之前的通用坑,见 AGENTS.md §2.3)。
    - **detail-page 框架差异**:framework 的 `currentDetailView` 在 hybrid 模式下需要
      `renderDetailPage` 函数返回值。`renderDetailPage` 原本只处理 `private-*`,现在加了
      `chat-settings-*` 分发即可。
    - **CSS 作用域**:所有规则带 `.app-shell[data-app-id="chat"]` 前缀,跟其他 chat CSS 同款策略。

- ✅ **私聊详情页输入区交互修复 — 工具栏从输入栏下方展开** (2026-08-04 19:57)
  - **现象**:`+` 按钮点不下去 / 点下去工具组不显示 / 工具组位置不对
  - **根因**(三处):
    1. **CSS 冲突**:`_chat-private.css` 第 290-302 行有一段**遗留的旧规则**
       `.input-container { position: sticky; bottom: 0; ... }`,比 `_chat-input.css`
       晚加载或者并列加载时,`position: sticky` 会把 input-container 钉在屏幕底部,
       把后面的 `.input-toolbar` 挤出可视区。
    2. **flex order 反视觉**:`_chat-input.css` 用了 `flex order: 4 / 5` 让 toolbar
       排在 input-container 上面(从顶部展开),但用户要求"从输入栏**下方**展开"。
    3. **事件委托单例失效**:旧版 `initPrivateChatInteractions` 用
       `window.__chatPrivateDelegated` 单例 + `document.addEventListener`,
       在 framework `v-html` 重渲 + Vite HMR 场景下,单例 flag 残留导致 listener
       没绑上(框架 detailEl 切换时 DOM 重建,委托失效)。
  - **修复**:
    1. **删除旧规则**:`_chat-private.css` 290-450 行整段 input-container / input-wrapper
       / message-input / emoji-btn / send-btn / input-toolbar / toolbar-content /
       toolbar-grid / toolbar-btn / toolbar-btn-icon / toolbar-btn-label / 所有
       `[data-type="..."]` 图标配色全部删除,改由 `_chat-input.css` **单一文件接管**。
    2. **CSS 重写**:`_chat-input.css`:
       - `.input-container` 去掉 `position: sticky; bottom: 0`,只保留
         `flex-shrink: 0; background: white; padding: 10px 14px; box-shadow; z-index: 10`
       - `.input-toolbar` 改用 `max-height: 0 → 240px` transition,
         默认 `border-top-color: transparent`,展开后 `border-top-color: #E9ECEF`,
         **不再**用 `flex order` 反视觉
       - `.expand-toolbar-btn.active` 从 `rotate(90deg)` 改为 `rotate(45deg)`(`+` 变 `×`)
       - `.toolbar-content` 的 padding 移到 `.input-toolbar` 上,展开时一并 transition
    3. **HTML 顺序**:把 `<!-- 工具栏 -->` 注释改成 `<!-- 工具组 (从输入栏下方展开,默认收起) -->`,
      确保 HTML 顺序就是 **输入栏 → 工具组**(从输入栏下方展开)。
    4. **事件绑定重写**:`initPrivateChatInteractions` 从 `document` 单例委托
       改成**直接绑到 `.chat-private` 元素**,用元素自身属性 `chatPrivate.__chatInteractionsBound`
       做幂等 flag。每次 detail mount 走一次,新 DOM 节点自然绑上,旧 DOM 销毁无泄漏。
       不再依赖任何 `window.__xxx` 全局状态。
  - **行为契约**:
    - 点 `+` → `expanded` class 切换,工具组从 0 → 240px 滑入,
      `+` 按钮旋转 45° 变 `×`
    - 点任意工具按钮 → 灵动岛 `notify('info', '功能即将开放')`,
      工具组自动收起,`×` 转回 `+`
    - 切到另一个联系人再回来 / 离开 detail → 工具组默认收起
  - **踩坑笔记**:
    - **`position: sticky` 与 `flex order` 同时作用是冲突的**:`sticky` 把元素钉到底,
      后续兄弟节点就被挤出可见区。
    - **多 CSS 文件管理同类样式是定时炸弹**:`_chat-private.css` 和 `_chat-input.css`
      同时写 `.input-container` 样式,先加载的那个会被后加载的覆盖,反过来也行,
      行为依赖加载顺序,极易踩坑。**单一文件接管同类样式**。
    - **事件委托单例 ≠ 永远安全**:`window.__chatPrivateDelegated` 这种全局 flag
      在 module reload(HMR)、多次 init 的场景下会出现 flag 残留 + listener 没绑的
      「静默失败」。**优先用元素自身的属性做幂等 flag**,跟 DOM 生命周期绑定,干净。

- ✅ **Phase 1.3/1.5/1.6 — 私聊详情页 CSS 1:1 复原** (2026-08-04 16:05)
  - **来源**:旧版 `ChatApp.prototype.renderPrivateChat()` 的 HTML/CSS 结构
  - **文件**:
    - `css/apps/chat/_chat-private.css` — 私聊详情页样式(顶部 header + 消息区 + 回复预览)
    - `css/apps/chat/_chat-bubble.css` — 消息气泡样式(用户/AI/系统/游戏/表情/图片/语音/红包/转账/分享卡片)
    - `css/apps/chat/_chat-input.css` — 输入区域样式(输入框 + 发送按钮 + 工具栏)
  - **CSS 链入**:在 `index.css` 加 `@import` 导入
  - **UI 结构 1:1 复原**:
    - 韩风顶部栏(#edf2fd 背景 + 头像 + 名字 + 状态 + 通话按钮)
    - 消息气泡(用户粉 #FFE8F0 / AI 蓝 #E8F2FF + 圆角 + 阴影)
    - 引用回复预览(渐变背景 + 蓝色左边框)
    - 输入区(白底 + 圆角输入框 + 渐变发送按钮 + 展开工具栏)
    - 工具栏(8 个按钮:图片/语音/表情/位置/红包/转账/通话/收藏)
    - 消息操作按钮(收藏/删除/回复/多选)
    - 通话记录卡片(语音淡蓝/视频淡粉)
    - 摘要卡片(日期 + 内容 + 操作)
    - 日期分隔线
    - 分享/联系人/位置等卡片样式
  - **动画**:messageIn / poke / slideUp / voiceWave
  - **状态类**:`.expanded` / `.active` / `.recording` / `.multi-select-mode`

- ✅ **Phase 11 — 个人页面 UI 复原** (2026-08-04 14:53)
  - **来源**:旧版 `ChatApp.prototype.renderProfilePage`
  - **文件**:`js/apps/chat-app/pages/profile-page.js` + `css/apps/chat/_chat-profile.css`
  - **路由分发**:在 `index.js` 的 `renderChatPage` 加 `if (currentId === 'profile')` 分发
  - **CSS 链入**:在 `index.css` 加 `@import './_chat-profile.css'`
  - **UI 结构 1:1 复原**:
    - 韩风蓝粉渐变背景 + 毛玻璃卡片
    - 个人信息卡片(72px 头像+名字+ID)
    - 功能列表(收藏/钱包+余额)
    - 设置组(拍一拍/消息模式/聊天记录管理/群聊记忆互通/设置)
  - **topbar 处理**:`NAV_TABS` 中 `profile.topbar = { visible: false }`,与动态页一致
  - **演示数据**:DEMO_USER (name/avatar/userId/balance/patSetting 等)
  - **待接交互**:各菜单项的 `data-menu-id` 已注入,后续 Phase 接 `toolkit.island`

- ✅ **消息列表页右上角搜索按钮消失 — 修复** (2026-08-05 00:18)
  - **现象**:打开 chat-app → 消息列表,topbar 右上角的搜索按钮(放大镜 + `chat-search-btn` class)不出现;CSS `_chat-search-btn` 规则都在,DOM 里看不到 button
  - **跟 framework 无关**:JS 注入逻辑写在 chat-app 自己的 `methods.initTopbar` 里
  - **根因**(三处叠加):
    1. **`this` 丢失**:`renderChatPage` 里 `app.methods.initTopbar()` 直接拿方法引用调,framework 不绑 `this`。`if (this._topbarInited) return` 这行的 `this` 在严格模式下是 `undefined`,**抛 TypeError** 或者把 `_topbarInited` 写到 `globalThis`,无论哪种,后续每次调用都走 false positive return。
    2. **写入 flag 时机过早**:`initTopbar()` 第 262 行 `this._topbarInited = true` 是无条件写入,**先于** `if (!topbar) return;`。如果首次调用时 framework topbar 还没渲染(`querySelector` 返回 `null`),函数提早 return,但 `this._topbarInited = true` 已经落地 —— **下次再调永远跳过**。
    3. **`renderChatPage` 是 root page 共用入口**:切到通讯录/动态/我也会调 `initTopbar()`,没有任何 pageId 判断,通讯录页本身已经是 search 类型 topbar,本来就不该注入这个按钮。
  - **修复**(`js/apps/chat-app/index.js`):
    1. **幂等 flag 改用 shell 元素自身属性**:`shell.__chatSearchBtnInited`,跟 DOM 生命周期绑定,不依赖 `this`,HMR / 多次 init 都干净(参考 `_chat-private` 修复笔记的踩坑经验)。
    2. **`topbar` 查不到时不写 flag**:`if (!topbar) return;` 在 flag 写入之前,失败时让下次调用重试。
    3. **加 DOM 自查兜底**:`if (topbar.querySelector('.chat-search-btn'))` 检测已存在时把 flag 补上,防止 flag 被异常清掉。
    4. **签名加 `pageId` 参数**:`initTopbar(pageId)`,只对 `'messages'` 注入,通讯录/动态/我跳过。
  - **诊断台词**:下次遇到「顶栏上某个按钮消失」类问题:
    1. 先 grep `this._xxxInited` 或 `this._xxxMounted` 之类的全局 flag,看是不是 `this` 丢失导致永远 early-return
    2. 再看 flag 写入顺序,是不是早于 DOM 可用性的判断
    3. 优先用元素自身属性(`shell.__xxxInited`)做幂等 flag,彻底摆脱 `this` 的不确定性
  - **位置**:`js/apps/chat-app/index.js` 方法 `initTopbar()` + `renderChatPage` 调用处


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
- [ ] 通讯录页面 — Phase 11

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

### X.6 修复记录

#### 2026-08-04 17:55 — Hybrid 详情页修复

##### 修复1: hybrid/vue 模式下 currentDetailView 返回空字符串

**现象**:hybrid 模式下点击消息列表进入私聊页面，内容区空白。

**根因**:`use-app-navigation.js` 第 274-277 行:
```js
// hybrid / vue 模式：bridge 处理，这里不输出
const mode = activeApp.value.renderMode || 'template';
if (mode === 'hybrid' || mode === 'vue') {
    return '';  // ❌ 返回空字符串
}
```

**修复**:删除这段逻辑，让 hybrid/vue 模式和 template 模式一样正常渲染 detail page。

**文件**:`js/framework/use-app-navigation.js`

##### 修复2: 详情页时 tab bar 不消失

**现象**:hybrid 模式下进入私聊页面后，底部 tab bar 依然显示。

**根因**:`showAppNav` 只检查 nav type，不检查是否在详情页。而 `showAppTopbar` 有检查 `!isInDetailPage.value`。

**修复**:
```js
// 修复前
const showAppNav = Vue.computed(() => activeAppNavType.value !== 'none');

// 修复后
const showAppNav = Vue.computed(() => !isInDetailPage.value && activeAppNavType.value !== 'none');
```

**文件**:`js/framework/use-app-navigation.js`

---

#### 2026-08-04 14:41 — 动态页样式修复

##### 问题1: 动态页 panel 的 padding 被全局样式影响

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

#### 2026-08-04 19:57 — 私聊输入区交互三连修

**修复1: `_chat-private.css` 旧规则把工具组挤出可视区**

**现象**:点 `+` 按钮,工具组完全看不到。

**根因**:`_chat-private.css` 第 290-302 行有一段遗留的 `.input-container { position: sticky; bottom: 0; z-index: 10; ... }`,跟 `_chat-input.css` 里同选择器并列存在。`position: sticky` 会把 input-container 钉在视口底部,把它后面的 `.input-toolbar` 挤出屏幕。

**修复**:删掉 `_chat-private.css` 290-450 行所有跟输入区/工具组相关的样式,统一由 `_chat-input.css` 接管。`.input-container` 只保留 `flex-shrink: 0; background: white; box-shadow; z-index: 10`。

**文件**:`css/apps/chat/_chat-private.css`、`css/apps/chat/_chat-input.css`

**修复2: 工具组视觉位置反了 — 用 flex order 反视觉**

**现象**:工具组展开时**从输入栏顶部升起**,不是从底部下方展开。

**根因**:`_chat-input.css` 用了 `flex order: 4` / `order: 5` 让 toolbar 排在 input-container 上面,违背用户「从输入消息区域**下方**展开」的需求。

**修复**:HTML 顺序改为「输入栏 → 工具组」,CSS 去掉 `flex order` 反视觉,工具组用 `max-height: 0 → 240px` + `border-top-color: transparent → #E9ECEF` 在输入栏**下方**展开。`+` 按钮 active 时 `rotate(45deg)` 变 `×`。

**文件**:`css/apps/chat/_chat-input.css`、`js/apps/chat-app/pages/chat-page.js`

**修复3: 事件委托单例在 framework v-html 重渲下失效**

**现象**:刷新浏览器后,点 `+` 完全没反应,工具组不展开也不显示灵动岛。

**根因**:旧版 `initPrivateChatInteractions` 用 `window.__chatPrivateDelegated` 单例 + `document.addEventListener('click', ...)` 委托。framework 在 `v-html` 重新注入 `.chat-private` 时,委托应该还能工作;但 Vite HMR 在 module reload 时 `window` 状态被清,新 module 重新执行 `initPrivateChatInteractions`,但 detail El 切换瞬间 DOM 是空的,`document.querySelector('.app-shell[data-app-id="chat"] .chat-private')` 拿到 undefined,后续 forEach 也遍历不到任何元素 —— 委托没绑成功,但 `__chatPrivateDelegated = true` 已经写进新 window,所以**第二次 init 永远跳过监听器注册**。

**修复**:把绑定改成**直接绑到 `.chat-private` 元素**,用元素自身属性 `chatPrivate.__chatInteractionsBound` 做幂等 flag(跟 DOM 生命周期绑定)。每次 `renderDetailPage` 在 `queueMicrotask` 里查元素 → 元素在 → 绑 click → 标记 bound;下次进 detail 是新的 DOM 节点,`__chatInteractionsBound` 是 undefined,自然重绑。

**文件**:`js/apps/chat-app/index.js`

#### 修复优先级总结

| 顺序 | 问题 | 文件 |
|------|------|------|
| 1 | `_chat-private.css` 旧规则用 `sticky bottom: 0` 把工具组挤出可视区 | `_chat-private.css` |
| 2 | 工具组视觉位置反了(从顶部升起,不是从底部展开) | `_chat-input.css` + `chat-page.js` |
| 3 | `document` 委托单例在 `v-html` 重渲 + HMR 下失效 | `index.js` |

---

#### 2026-08-04 22:30 — CSS 选择器逗号缺失导致私聊白屏

##### 现象

私聊页面(`private-ai-1`)打开后**纯白屏**,没有任何内容;群聊(`group-group-1`)能正常渲染。Console 无红色报错,`initPrivateChatInteractions` 正常绑定,`renderDetailPage` 正常返回 HTML。

##### 根因

`_chat-private.css` 中多处 CSS 选择器组**缺少逗号**,导致整条规则变成无效选择器:

```css
/* 错误:缺少逗号,浏览器把 .chat-private 当作 .app-shell 的后代而非同一选择器组 */
.app-shell[data-app-id="chat"] .chat-private .chat-header
.app-shell[data-app-id="chat"] .chat-group .chat-header {
    /* 规则 */
}

/* 正确写法 */
.app-shell[data-app-id="chat"] .chat-private .chat-header,
.app-shell[data-app-id="chat"] .chat-group .chat-header {
    /* 规则 */
}
```

对比:`_chat-group.css` 里同样结构的选择器**全部有逗号**,所以群聊正常;`_chat-private.css` 少了 5 处逗号,对应 `.chat-private` 下的**所有样式规则全部失效**(字体大小/颜色/背景/布局全部丢失,元素表现为零宽零高或完全透明)。

**排查方法**:DevTools Elements 面板中,点击私聊页的 `.chat-private` 元素,看 Styles 面板里对应的 CSS 规则是否显示**划掉的黄色警告图标**——这就是无效选择器。

##### 修复

在 `_chat-private.css` 中补全 5 处缺失的逗号:
- 第 33 行:`.chat-private` + `.chat-group` 选择器组
- 第 42 行:`.chat-private .chat-header` + `.chat-group .chat-header`
- 第 54 行:`.chat-private .chat-back-btn` + `.chat-group .chat-back-btn`
- 第 68 行:`.chat-private .chat-back-btn:hover` + `.chat-group .chat-back-btn:hover`
- 第 73 行:`.chat-private .chat-back-btn svg` + `.chat-group .chat-back-btn svg`

##### 教训

**CSS 多文件管理同一类样式是定时炸弹**:`_chat-private.css` 和 `_chat-group.css` 同时写 `.chat-private` / `.chat-group` 的样式,逗号写没写全完全靠肉眼,极易踩坑。本项目后续 chat-app 的 CSS **统一用逗号分隔**,防止同类问题再次发生。

---

#### 2026-08-05 00:32 — 日历视图 + 故事存档子页面 UI 复原

##### 背景

私聊设置页(`chat-settings-page`)「聊天记录管理」卡片里有**两个入口**:`日历视图` 和 `故事记录`。旧版 chat.js 各自对应一个独立的 detail 子页面(`openCalendarView` + `openStoryArchive`),但迁移版只做了静态 UI,没有 `data-app-action`,点上去毫无反应。

按 chat-app 的子页面实现原则:
- 子页面**自接管 header**(返回按钮 + 页面标题,跟 chat-settings / chat-group-settings / chat-private / chat-group 同款)
- 路由 pageId 用前缀区分(`calendar-view-{contactId}` / `story-archive-{contactId}`)
- CSS 用 `.app-shell[data-app-id="chat"]` 作用域锁

##### 修复

1. **新文件** `js/apps/chat-app/pages/calendar-view-page.js` —
   `renderCalendarViewPage(app, contactId)`,1:1 复刻旧版 `openCalendarView` + `renderCalendarMonth` 的 UI:
   - 顶部 header(返回按钮 + 「日历视图」标题,蓝主题 `#4A6FA5`)
   - 头像 + 「xx 的聊天日历」 + 「共 N 天有记录」
   - 上下文加载方式卡片(3 个按钮:不加载 / 完整记录 / 概要记录,active 态蓝渐变)
   - 月历卡片:月导航(< 2026 八月 >) + 7 列星期标题(周末粉字) + 7 列日期网格
   - 今日蓝渐变高亮,有聊天记录的日期蓝底 + 粉点,周末日粉字

2. **新文件** `js/apps/chat-app/pages/story-archive-page.js` —
   `renderStoryArchivePage(app, contactId)`,1:1 复刻旧版 `openStoryArchive` 的 UI:
   - 顶部 header(返回按钮 + 「故事记录」标题,粉主题 `#D4728A`)
   - 头像 + 「xx 的故事存档」 + 「共 N 个存档」
   - 「封存当前聊天记录」粉渐变大按钮(白字 + 文件图标 + 阴影)
   - 已封存的记录列表(白底卡片):名称 + 时间/条数 + 描述 + 3 操作按钮(恢复/查看/删除)
   - 空状态:粉色文件夹图标 + 「暂无封存记录」
   - demo 数据:3 个示例存档(夏日海边度假 / 深夜长谈 / 生日惊喜策划)

3. **新 CSS 文件**:
   - `css/apps/chat/_chat-calendar-view.css` — 日历视图详情页样式(蓝粉渐变背景 + 白底卡片)
   - `css/apps/chat/_chat-story-archive.css` — 故事存档详情页样式(粉白渐变背景 + 白底卡片 + 粉渐变保存按钮)

4. **链入**:`css/apps/chat/index.css` 加 `@import './_chat-calendar-view.css'` 和 `@import './_chat-story-archive.css'`

5. **路由分发**:`js/apps/chat-app/index.js` 加 2 个新分支,在 `private-*` 之前判断:
   ```js
   } else if (pageId.startsWith('calendar-view-')) {
       const cid = pageId.replace('calendar-view-', '');
       html = renderCalendarViewPage(app, cid);
   } else if (pageId.startsWith('story-archive-')) {
       const cid = pageId.replace('story-archive-', '');
       html = renderStoryArchivePage(app, cid);
   }
   ```

6. **入口按钮加 data-app-action**:`chat-settings-page.js` 里两个 item 各加
   `data-app-action='{"action":"detail","appId":"chat","pageId":"calendar-view-{contactId}"}'`
   和 `.../story-archive-{contactId}`

##### 踩坑笔记

- **子页面 header 自接管**:跟 chat-settings / chat-group-settings / chat-private 同款策略,**不依赖** framework 的 `app-detail-header`,
  直接在子页面 HTML 顶部写 `<div class="chat-xxx-topbar">` + 返回按钮 + 标题,
  这样**切出**(返回上一层)时不会被 framework 默认 header 覆盖。
- **路由分发顺序**:`calendar-view-` / `story-archive-` 必须放在 `chat-settings-` **之前**匹配(虽然前缀不冲突,但顺序清晰更安全)
- **CSS 主题色区分**:日历视图用蓝主题(`#4A6FA5` 与原版一致),故事存档用粉主题(`#D4728A` 与原版一致),
  通过独立的 topbar 颜色实现视觉差异化
- **复用头像色工具**:跟 chat-settings-page 共用 `getAvatarColor()` 工具函数,后续接 IndexedDB 后,可以挪到 services/utils 共用

---

#### 2026-08-05 15:15 — 图片消息渲染改为位置卡片风格

##### 问题

图片消息(`type: 'descriptive_image'`)在聊天界面显示为**居中卡片**（像通话记录那样），但用户期望它和**位置卡片**一样，**带头像和气泡**。

##### 根因

历史代码把图片消息当成「系统卡片」处理，放在 `card-messages.js` 里，用居中卡片结构渲染：
- `.center-card-wrapper` → 居中
- `.center-card-container` → 容器
- 没有头像

而位置卡片走的是 `share-cards.js` → `renderShareCardWrapper`，天然带头像 + 气泡包裹。

##### 修复

**复用 `renderShareCardWrapper` 包装器**，而不是重新写：

1. **`share-cards.js`**: 导出 `renderShareCardWrapper` 函数
2. **`card-messages.js`**: `renderDescImageBubble` 调用 `renderShareCardWrapper(msg, bubbleHtml, avatarBg)`
3. **`desc-image-modal.js`**: `renderDescImageBubble` 只返回 `.desc-image-card` 气泡内容
4. **`_chat-bubble.css`**: 新增 `.message-bubble-card .desc-image-card*` 样式

##### 复用结构

```
位置卡片流程:
  share-cards.js / renderLocationBubble
    → 生成 .location-card-in-chat 气泡内容
    → 调用 renderShareCardWrapper 包装（头像 + 气泡 + 时间 + 操作按钮）

图片卡片流程(现在一致):
  desc-image-modal.js / renderDescImageBubble
    → 只生成 .desc-image-card 气泡内容
  card-messages.js / renderDescImageBubble
    → 调用 desc-image-modal.js 获取 .desc-image-card
    → 调用 renderShareCardWrapper 包装（头像 + 气泡 + 时间 + 操作按钮）
```

##### 教训

**不要重复造轮子**。当发现两处功能相似（图片卡片 vs 位置卡片），先找有没有现成的可复用组件（`renderShareCardWrapper`），而不是从头写一个完整的消息结构。

---

#### 2026-08-05 00:48 — 群聊详情页 HTML 嵌套错误导致 header 高度失控

##### 现象

打开群聊详情页(`group-group-1`),**`.chat-header` 高度变成 2104px**、**`.chat-messages` 高度变成 2032px**,头像/消息气泡/工具按钮全部**堆在 header 偏左的位置**,看起来像「竖起来」一样。私聊页面(`private-ai-1`)不受影响,正常显示。

##### 根因

`js/apps/chat-app/pages/chat-group-page.js` 的 HTML 模板里 **`.chat-header` 缺少闭合 `</div>`**。

具体位置:line 360-361 关闭的是 `.header-actions` 和 `.chat-header-right`,但**没有**关闭 `.chat-header`。从 line 364 开始的所有兄弟元素(`.multi-select-bar` / `.chat-messages` / `.reply-preview` / `.input-container` / `.input-toolbar`)全部嵌进了 `.chat-header` 内部,导致:

1. `.chat-header` 把整页所有内容都吃进去,高度从正常的 ~100px 撑到 2104px
2. `.chat-header` 的 `display: flex; flex-direction: column`(群聊继承自 `_chat-private.css` 的规则)让 `.chat-messages` 里的 `.message-wrapper` 全部竖直堆叠在 header 区域内
3. `.message-wrapper` 的 `display: flex`(水平排列头像+气泡)在 header 的列式 flex 里失效,所以头像和气泡都堆在左上角

##### 诊断台词

下次遇到「某容器高度异常大 + 子元素挤在一角 + 私聊正常群聊不正常」类问题:

1. **优先怀疑 HTML 嵌套错误**,而不是 CSS 选择器问题
2. 对比同类私聊页面的 `</div>` 闭合层数,数 div 数量
3. DevTools Elements 面板选中疑似容器,看右上角「=== 子元素标签预览」,如果整页都在里面,就是嵌套错误

##### 修复

在 `js/apps/chat-app/pages/chat-group-page.js` line 361 后(关闭 `.chat-header-right` 的 `</div>` 之后)补一个 `</div>` 关闭 `.chat-header`:

```javascript
                    </div>     <!-- 关闭 .header-actions -->
                </div>          <!-- 关闭 .chat-header-right -->
            </div>              <!-- 关闭 .chat-header  ← 补的 -->
```

修复后 div 嵌套层级正确:

```
.chat-group
├── .chat-header
│   ├── .chat-header-left
│   └── .chat-header-right
├── .multi-select-bar
├── .chat-messages (flex: 1,正常滚动)
├── .reply-preview
├── .input-container
└── .input-toolbar
```

##### 教训

- **`_chat-private.css` 之所以用 `.chat-private` 和 `.chat-group` 逗号选择器组**(README §X.5 提到的逗号策略),就是把私聊/群聊的样式合并写,**省去双份 CSS**。但**前提是 HTML 结构必须一致**,任何一份 HTML 出错,两个容器同步崩。
- **私聊 HTML 是完整闭合的**(chat-page.js line 699-701 三层 `</div>` 分别是 `.header-actions` / `.chat-header-right` / `.chat-header`),迁移群聊时是**复制粘贴微改**,这一步把 `.chat-header` 闭合 `</div>` 漏掉了。
- **修复策略**:**只改 `.chat-group` 的 HTML**,**不动 `_chat-private.css` / `_chat-group.css`**,保护私聊页面完全不受影响(本项目约束,见 AGENTS.md §16)。

---

#### 2026-08-06 17:12 — 私聊页面按钮点击无响应（async renderer + queueMicrotask 时序问题）

##### 现象

打开私聊页面(`private-ai0`)，点击工具栏 `+` 展开按钮、header 的语音/视频/多选按钮，**点击完全没反应**，灵动岛不弹提示，工具栏不展开。

##### 根因

`renderDetailPage` 是 `async function`，framework 在 async renderer 的处理逻辑是：

1. 第一次调用 `renderDetailPage`，返回 **Promise**（`result.then` 状态）
2. `resolveAsyncRenderer` 检测到 Promise，返回 `"<div>加载中…</div>"` 加载中 HTML
3. **同步返回** `"加载中…"` 给 `currentDetailView` computed，Vue 立即渲染到 DOM
4. `queueMicrotask` 执行 `initPrivateChatInteractions()` —— 此时 DOM 里只有 "加载中…"，没有 `.chat-private` 元素
5. `initPrivateChatInteractions` 的 `querySelector('.chat-private')` 返回 `null`，函数直接 `return`
6. 绑定失败，click 事件监听器从未注册

等 Promise later resolve 后，真正的 HTML 才写入 DOM，但 `initPrivateChatInteractions` 已经执行过了（以失败告终）。

##### 诊断台词

遇到「点击按钮没反应」类问题：

1. 先加 `console.log` 定位事件是否到达 `handleAppContentClick`
2. 如果 `[DEBUG-1]` 有但按钮仍然没反应 → 查 `initPrivateChatInteractions` 是否被调用、`.chat-private` 是否存在
3. 如果 `DEBUG-6` 显示 `chatPrivateFound: false` → 99% 是 async renderer 时序问题
4. **关键指标**：`[DEBUG-6b]` 显示 `currentDetailBody HTML` 里是 `"加载中…"` → 确认问题

##### 修复

把 `queueMicrotask` 改成 `setTimeout(..., 100)`，让 DOM 先渲染完成：

```js
// 修复前
} else if (pageId.startsWith('private-')) {
    queueMicrotask(() => {
        app?.methods?.initPrivateChatInteractions?.();
    });
}

// 修复后
} else if (pageId.startsWith('private-')) {
    setTimeout(() => {
        app?.methods?.initPrivateChatInteractions?.();
    }, 100);  // 等待 Vue 把 async renderer 返回的真 HTML 渲染到 DOM
}
```

`setTimeout 100ms` 足以覆盖：
- async renderer Promise resolve 的时间（通常 < 50ms）
- Vue v-html DOM diff + patch 的时间（通常 < 30ms）
- 留 20ms buffer

##### 文件

- `js/apps/chat-app/index.js` — `renderDetailPage` 里的 `private-` 分支

##### 教训

- **async renderer + `queueMicrotask` = 时序雷区**：async renderer 先返回 "加载中…"，`queueMicrotask` 在下一个 microtask 执行，此时 DOM 里还没有真正的元素
- **`queueMicrotask` 只保证「在当前事件循环结束后执行」，不保证「DOM 已经渲染完成」**：Vue 的 v-html 渲染也是 microtask，但 Vue 的 watcher flush 是在 `queueMicrotask` 之后的另一个 tick
- **正确做法**：需要等 DOM 渲染完成后才能操作元素时，用 `setTimeout(fn, 0)` 或更长的延时，确保 Vue 已经完成 v-html

---

#### 2026-08-06 18:25 — AI 联系人备注功能三处不生效

##### 现象

保存备注后，聊天设置页的备注项显示正确、私聊页顶栏名字正确、消息列表页的联系人名字也正确了。但之前已经添加的好友 entry 里没有 `remark` 字段，导致备注无法生效。

##### 根因（两处）

**1. `chat-friends.js` 的 `add` 函数没有初始化 `remark` 字段**

文档注释里说 entry 有 `remark` 字段（每个 mode 独立存储），但 `add` 函数创建 entry 时没有写入 `remark`：

```js
// 修复前
const entry = {
    aiPersonId,
    displayName: ...,
    avatar: ...,
    avatarBg: ...,
    boundWorldId: ...,
    // 缺少 remark 字段！
    lastMessage: null,
    ...
};

// 修复后
const entry = {
    aiPersonId,
    displayName: ...,
    remark: chatPerson.remark || '', // ★ 每个 mode 独立备注
    ...
};
```

**2. `messages-page.js` 的 `loadContactsForMode` 没有映射 `remark` 字段**

```js
// 修复前
out.chats = list.map((c) => ({
    id: c.aiPersonId,
    type: 'ai',
    aiPersonId: c.aiPersonId,
    name: c.displayName,
    // 缺少 remark 字段
    ...
}));

// 修复后
out.chats = list.map((c) => ({
    id: c.aiPersonId,
    type: 'ai',
    aiPersonId: c.aiPersonId,
    name: c.displayName,
    remark: c.remark || '', // ★ 每个 mode 独立备注
    ...
}));
```

**3. `index.html` 的 `@close` 事件没有触发 `onClose` 回调**

```html
<!-- 修复前 -->
<component
    :is="appModal.component"
    v-bind="appModal.props"
    @close="closeModal"  <!-- 只关闭弹窗，没刷新 UI -->
    ...
></component>

<!-- 修复后 -->
<component
    :is="appModal.component"
    v-bind="appModal.props"
    @close="() => { emitChatComponentEvent('onClose'); closeModal(); }"  <!-- ★ 先刷新 UI 再关闭 -->
    ...
></component>
```

##### 涉及文件

| 文件 | 修复内容 |
|------|---------|
| `js/apps/setting/world/sdk/chat-friends.js` | `add` 函数初始化 `remark: ''` 字段 |
| `js/apps/chat-app/pages/chat-settings-page.js` | 联系人名字优先显示 `remark`（`contactName = entry.remark \|\| entry.displayName`） |
| `js/apps/chat-app/pages/chat-page.js` | 私聊页顶栏名字优先显示 `remark` |
| `js/apps/chat-app/pages/messages-page.js` | `loadContactsForMode` 映射 `remark` 字段 + `renderChatItem` 优先显示 `remark` |
| `index.html` | `@close` 事件触发 `onClose` 回调刷新 UI |

##### 教训

- **SDK API 文档注释说有某字段 ≠ 实现里真的写了这个字段**：读源码时要看实际的 `add` / `update` 函数，不要只看注释
- **数据映射漏字段是常见 bug**：从 SDK 读到内存对象后 `map` 转成 UI 对象时，要对照文档注释逐字段检查有没有遗漏
- **之前添加的好友 entry 没有 `remark` 字段，需要重新添加才能生效**：数据 schema 变更后，已有的数据不会自动迁移，需要用户重新操作或写迁移脚本

---

## A.X 聊天设置页 toggle 真实接入 — `set-pinned` / `set-muted`(v0.28.1 2026-08-06)

### A.X.1 目标

把 `js/apps/chat-app/pages/chat-settings-page.js` 里的「置顶聊天」「消息免打扰」toggle 从纯 UI 装饰升级成**真实持久化开关**:

- 点击写入 `sdkUsers.socialProfiles.chat.{calendarContacts|storyContacts}[].isPinned` / `isMuted`
- 写入成功后,消息列表按 `isPinned` 排序立刻生效(已有逻辑,无需改)
- 刷新页面状态保留(IndexedDB 持久化)

### A.X.2 数据层改动

#### 新增 `chatFriends.togglePin(sdk, user, aiPersonId, mode)` — `js/apps/setting/world/sdk/chat-friends.js`

```js
/**
 * 一键翻转 isPinned(便捷封装)。entry 不存在时返回 null(给 UI 提示用)。
 * 复用现有的 update(),自动 merge patch + 落盘 IndexedDB。
 */
async function togglePin(sdk, user, aiPersonId, mode) {
    const existing = get(user, aiPersonId, mode);
    if (!existing) return null;
    return update(sdk, user, aiPersonId, mode, { isPinned: !existing.isPinned });
}
```

同步在 `export const chatFriends = { ... }` 里加 `togglePin`。

#### 后续补 `update({ isMuted })` API

复用 `chatFriends.update(sdk, user, aiPersonId, mode, { isMuted })`,已经在 SDK 里存在,无需新增。

### A.X.3 渲染层改动

#### `renderToggle(checked, labelId)` — `chat-settings-page.js`

给 toggle 加稳定语义 id(后续可扩展)。**关键:data-app-action 放 `<input>` 上,不放 `<label>` 上** —— 这是踩坑重点,见 A.X.5。

```html
<label class="chat-toggle">
    <input type="checkbox"
           class="chat-toggle-input"
           ${checked ? 'checked' : ''}
           data-app-action='{...onChatSettingToggle, payload: { settingId }}'>
    <span class="chat-toggle-track"></span>
    <span class="chat-toggle-thumb"></span>
</label>
```

#### `renderToggleItem({id, ...})`

把 `id` 透传到 DOM:`<div class="chat-setting-toggle-item" id="${id}" data-setting-id="${id}">` —— method 里通过这两个属性定位 DOM。

给现有的 4 个 toggle 都加了 id:
- `set-pinned` — 置顶聊天
- `set-muted` — 消息免打扰
- `set-context-dilute` — 上下文智能稀释(预留)
- `set-reply-enhance` — 回复增强(预留)

### A.X.4 派发层改动

新增 `chat.methods.onChatSettingToggle(payload)` — `chat-app/index.js`:

派发链路:
```
点击 input[type=checkbox]
  → input click 冒泡到 document
  → framework 顶层 click 委托 (handleAppContentClick)
  → closest('[data-app-action]') 找到 input
  → handlePageAction('appMethod', method='onChatSettingToggle')
  → externalAppRegistry.invokeMethod('chat', 'onChatSettingToggle', { settingId })
  → chat.methods.onChatSettingToggle({ settingId })
```

实现要点:
- **不信任 payload.checked**,实时从 `input.checked` 读 DOM 真值(payload 是 v-html 渲染时快照)
- **解析 pageId** `chat-settings-<aiPersonId>-<mode>` → 拿到 aiPersonId + mode(兼容 `ai-default` 这种含 `-` 的 id)
- **switch(settingId)** 分发:`set-pinned` 调 `togglePin`、`set-muted` 调 `update({isMuted})`、未知 settingId 静默回滚
- **entry 不存在** → 灵动岛提示「该联系人尚未添加」并回滚 DOM
- **写入成功** → 派发 `chat:contact-setting-changed` 事件 + `refreshMessagesTab(this)` 触发 framework 重画
- **异常** → 灵动岛提示并回滚 DOM
- **入口 100ms 去重**:同一 settingId 在 100ms 内二次调用直接 no-op(兜底双派发残留)

### A.X.5 ⚠️ 双派发 Bug 踩坑(本节必读)

#### 现象

用户点一次 toggle:
- 灵动岛弹出"已取消置顶"(不论之前是置顶还是未置顶)
- 状态看起来没变(再次点又是同样提示)
- 控制台出现 **两次** `appMethod invoke` log:

```
[handlePageAction] called with action: {"action":"appMethod",...,"method":"onChatSettingToggle","payload":{"settingId":"set-pinned"}}
[chat-dispatch] appMethod invoke Object
[handlePageAction] called with action: {"action":"appMethod",...,"method":"onChatSettingToggle","payload":{"settingId":"set-pinned"}}
[chat-dispatch] appMethod invoke Object
```

#### 根因

`<label>` 包 `<input type="checkbox">` 时,浏览器在用户点击时**合成 1 次额外的 label click 事件**。这是 HTMLLabelElement 的原生行为 —— 任何对 label 内部(包括 input 自身 + label 的 padding)的点击都会触发 label 的 click。

原代码把 `data-app-action` 放在 `<label>` 上:
```html
<label class="chat-toggle" data-app-action='{...}'>
    <input type="checkbox" ...>
</label>
```

framework 用 `event.target.closest('[data-app-action]')` 找 action 元素。两次冒泡都找到 label:
- 第一次:用户点击 → `event.target = input` → closest 找到祖先 `<label>`(带 action) → 派发 1 次
- 第二次:浏览器合成 → `event.target = label` → closest 找到 `<label>` 自身 → **又**派发 1 次

结果:`onChatSettingToggle` 被调 **2 次** → `togglePin` 内部 `update({isPinned: !existing.isPinned})` 被调 2 次:

```
初始: isPinned = false
第 1 次 togglePin: update({isPinned: true})  → entry.isPinned = true
第 2 次 togglePin: update({isPinned: false}) → entry.isPinned = false (回到原值)
提示永远显示最后一次翻转: 「已取消置顶」
```

#### 修复 1(主): data-app-action 放 `<input>` 上 — `chat-settings-page.js`

```html
<!-- ❌ 错:放 label 上 -->
<label class="chat-toggle" data-app-action='...'>
    <input type="checkbox" ...>
</label>

<!-- ✅ 对:放 input 上 -->
<label class="chat-toggle">
    <input type="checkbox" data-app-action='...'>
    <span class="chat-toggle-track"></span>
    <span class="chat-toggle-thumb"></span>
</label>
```

- 点 input → `event.target = input` → closest 找到 input(最近祖先) → 派发 1 次
- 浏览器合成 label click → `event.target = label` → closest 一路向上找都**没有**带 action 的祖先 → framework `handleAppContentClick` 直接 `return`,**不处理**

**两路都安全**:真实点击派发 1 次,合成 click 静默不派发。✓

#### 修复 2(兜底): method 入口 100ms 去重 — `chat-app/index.js`

```js
async onChatSettingToggle(payload = {}) {
    const settingId = payload?.settingId || '';

    // ★ v0.28.1 同步去重: 同一 settingId 在 100ms 内被二次调用 → 直接 no-op
    if (!this.__toggleDedupe) this.__toggleDedupe = {};
    const now = Date.now();
    const last = this.__toggleDedupe[settingId] || 0;
    if (now - last < 100) {
        return null;
    }
    this.__toggleDedupe[settingId] = now;

    // ... 后续逻辑
}
```

兜底:即使 framework 在某些 edge case 下仍然重派(比如 v-html 刚替换 + Vue 重画期间),第二次进 method 也会被时间窗口拦掉。

#### 为什么不用「状态已对齐 → no-op」做去重

我最初还试过在 method 里读 entry 当前状态,如果和 `input.checked` 已经一致就 no-op。但 `togglePin` 是 `async`:

```
第 1 次进入 method   → input.checked = true
                      → existingEntry.isPinned = false  (尚未更新)
                      → 不等 → await togglePin ...
                      (异步等待中...)
第 2 次进入 method   → input.checked = true
                      → existingEntry.isPinned = false  (第 1 次还在 await)
                      → 不等 → 又一次 togglePin!
```

异步 race condition 让「状态对齐」检查**不安全**。最终改成单纯的时间窗口去重 —— 简单、异步安全、和 framework 派发频率无耦合。

#### 涉及文件

| 文件 | 修复内容 |
|---|---|
| `js/apps/chat-app/pages/chat-settings-page.js` | `renderToggle` 把 `data-app-action` 从 `<label>` 移到 `<input>` + 给 4 个 toggle 加稳定 id |
| `js/apps/chat-app/index.js` | 新增 `onChatSettingToggle` method(派发入口 + DOM 状态读 + SDK 写入 + 事件派发 + 100ms 去重) |
| `js/apps/setting/world/sdk/chat-friends.js` | 新增 `togglePin` API + export |

#### 通用教训

1. **`<label>` + `<input type="checkbox">` 嵌套时,浏览器会合成额外 label click**。这是 HTML 标准行为,不是 bug。所以:
   - toggle 派发只能放 `input` 上(其他业务元素的派发同理,放触发源上最稳)
   - 或者用 `event.preventDefault()` 阻断 —— 但 AGENTS.md §16.21 明确禁止 `addEventListener`,所以无解

2. **framework 派发链 `addEventListener('app:page-action', ...)` 全文派发,不做去重**。即同一个 DOM action 被多次 click 派发,framework 忠实转发,**不替你判断幂等**。app method 必须自己负责幂等。

3. **time-window dedupe 是处理 framework 双派发的最简单兜底**。比「状态对比」安全,后者在 `await` 串行期间错位。

4. **togglePin 这种「读 → 翻转」型 API 在多重派发下必然错位**。如果业务必须用 toggle 风格:
   - 上层去重是唯一可靠方案
   - 或者改成「幂等 read-modify-write」(先比对数据库当前值,如果已经等于期望值就不写)

### A.X.6 验证清单

| 步骤 | 期望 |
|---|---|
| 打开聊天设置页(setting 详情),点「置顶聊天」off→on | 灵动岛「已置顶」 |
| 同一 toggle 再点 on→off | 灵动岛「已取消置顶」 |
| 返回消息列表 | on 状态联系人排最前,带 `#A8C8EC` pin icon |
| 切到 story 模式(联系人列表)点置顶 | 仅 story mode 列表置顶,calendar 列表不受影响 |
| 刷新页面 | 置顶状态保留(IndexedDB 持久化) |
| 在没添加过该 AI 的 demo 页点击 toggle | 灵动岛「该联系人尚未添加」+ DOM 回滚 |

---

## A.0.5 聊天背景 (v0.29)

> **需求**:AI 联系人的私聊页背景可以自定义,**同一个 AI 的 calendar 和 story mode 各自独立**。
> **目的**:让用户根据不同 mode 的氛围(正常聊天 / 情景扮演)搭配不同背景,提升沉浸感。

### 1. 数据模型

`user.socialProfiles.chat.{calendarContacts|storyContacts}` 数组里每条 entry 增加一个 `chatBackground` 字段:

```js
{
  aiPersonId: 'ap_X',
  displayName: '多拉',
  remark: '',
  // ... 其他字段 ...
  chatBackground: 'color:#E8F2FF',  // ★ 新增,空字符串表示用默认背景
}
```

**值格式**:字符串统一带前缀,避免纯字符串与 url/hex 混淆:

| 前缀 | 示例 | 含义 |
|---|---|---|
| `color:` | `color:#FFE4EC` | 纯色背景(16 进制 / rgb) |
| `gradient:` | `gradient:linear-gradient(135deg, #E8F2FF, #D6E4FF)` | 渐变背景 |
| `image:` | `image:data:image/png;base64,iVBOR...` | 图片背景(支持 dataURL / 网络 URL) |
| `''` | 空 | 默认背景(#F8F9FA) |

### 2. SDK API

`js/apps/setting/world/sdk/chat-friends.js` 新增:

- **`updateBackground(sdk, user, contactId, mode, value)`**:
  1. 拿现有 entry,空 → noop 并提示
  2. 写 `chatBackground = value`(空字符串表示清空)
  3. 落盘 → 触发 `chat:chat-background-changed` 事件
  4. 写入 `localStorage` 快照(其他读 SDK 的路径能秒看见)

### 3. UI 入口

`js/apps/chat-app/pages/chat-settings-page.js` 的「聊天背景」行改为可点击项:

```html
<div class="chat-setting-item" id="set-chat-background"
  data-app-action='{"action":"appMethod","appId":"chat","method":"openChatBackgroundModal","payload":{"contactId":"ap_X","mode":"calendar"}}'>
  <span class="chat-setting-label">聊天背景</span>
  <span class="chat-setting-value">
    <!-- 已设置 → 32x22 缩略图;未设置 → "默认" -->
    ${contact.chatBackground
      ? renderChatBackgroundPreview(contact.chatBackground)
      : '<span class="chat-setting-default-text">默认</span>'}
    <svg class="chat-setting-arrow">...</svg>
  </span>
</div>
```

### 4. 弹窗组件

新增 `ChatBackgroundModal`(在 `chat-modal-components.js` + `chat-modal-registry.js`):

- **三 Tab**:纯色 / 渐变 / 图片
  - 纯色:预设 20 种微信风调色板 + 自定义 color input
  - 渐变:预设 12 种渐变(粉/蓝/紫/绿/黄/橙等)
  - 图片:本地选择文件 → 转 dataURL,**size 限制 2MB**(防止 IndexedDB 暴涨)
- **底部三个按钮**:取消 / 恢复默认(清空) / 保存
- **保存回调**传 `value` 字符串(带前缀 / 空),由 `openChatBackgroundModal` method 写盘

### 5. 私聊页应用

`js/apps/chat-app/pages/chat-page.js` 给 `.chat-messages` 加 `data-chat-bg` 属性 + 内联 style:

```html
<div class="chat-messages"
     data-chat-bg="1"
     style="background: linear-gradient(...);">
  ${messages}
</div>
```

`_chat-private.css` 配套样式:

- `[data-chat-bg]` → `background-size: cover; background-position: center;`
- `[data-chat-bg]::before` → 半透明白色遮罩,让气泡更清晰
- 气泡层级 `z-index: 1` 提到背景之上

### 6. 持久化

- 每次保存:`sdk.chatFriends.updateBackground` → 写 `socialProfiles.chat.{mode}Contacts[i].chatBackground`
- chat-snapshot 也会自动包含(`bindPersona` 已经写入快照)
- 刷新后 `getCurrentChatUser` 读到的 entry 自动包含新字段
- 私聊页重画时从 entry 重新读 → 立即生效

### 7. 涉及文件

| 文件 | 修改内容 |
|---|---|
| `js/apps/setting/world/sdk/chat-friends.js` | 新增 `updateBackground` API + `chatBackground` 字段默认值 |
| `js/apps/chat-app/components/chat-modal-components.js` | 新增 `ChatBackgroundModal` 组件(三 tab + 三按钮) |
| `js/apps/chat-app/components/chat-modal-registry.js` | 新增 `openChatBackground` 方法,导出 `ChatBackgroundModal` |
| `js/apps/chat-app/pages/chat-settings-page.js` | 「聊天背景」行加 `data-app-action` + 缩略图 + `renderChatBackgroundPreview` helper |
| `js/apps/chat-app/pages/chat-page.js` | 给 `.chat-messages` 加 `data-chat-bg` + 内联 style + `chatBackgroundToStyle` helper |
| `js/apps/chat-app/index.js` | 新增 `openChatBackgroundModal` method(派发入口 + SDK 写入 + 事件派发 + 重画) |
| `css/apps/chat/_chat-private.css` | `[data-chat-bg]` 样式 + `.chat-bg-modal` 弹窗样式 |
| `css/apps/chat/_chat-settings.css` | `.chat-bg-preview` 缩略图 + 「聊天背景」行 hover 反馈 |

### 8. 设计取舍

- **为什么不用 base64 直传数据表**:图片限制 2MB,base64 字符长度再加 33% → 单张图可能 2.7MB,远大于 localStorage 单条记录阈值;改用 IndexedDB `socialProfiles` 直接存(整条 entry 作为 1 个 record,JSON 序列化由 SDK 管)
- **为什么不同 mode 各自独立**:同一个 AI 在 calendar 是「正常聊天」,在 story 是「剧情模式」,用户很可能希望两种氛围用不同背景(粉系 vs 冷色系);强行全局共享会让用户必须为一种风格妥协
- **为什么不暴露"主题色/渐变预设编辑"**:预设只是开箱即用的 20+12 个,用户能选、能传图就够覆盖 95% 场景;开放颜色拾色器(高级)反而提高误操作成本

### 9. 验证清单

| 步骤 | 期望 |
|---|---|
| 进入某 AI 联系人的私聊页(calendar 模式) | 消息滚动区背景默认 #F8F9FA |
| 聊天设置 → 聊天背景 → 选某个纯色 → 保存 | 灵动岛「聊天背景已保存」+ 私聊页背景立即变成该色 + 设置页右侧出现缩略图 |
| 切到该 AI 的 story 模式 | story 私聊页背景还是默认(不继承 calendar 设置) |
| story 模式聊天设置 → 选不同渐变 → 保存 | story 私聊页应用新渐变,calendar 不受影响 |
| 选「图片」tab → 上传 1.5MB 图片 → 保存 | 背景变成该图片,cover 居中 |
| 上传 3MB 图片 | 提示「图片过大,需 ≤ 2MB」,不让上传 |
| 点「恢复默认」 | 背景清空,设置页右侧缩略图变成「默认」文字 |
| 刷新页面 | 三种背景状态都保留(IndexedDB 持久化) |
| 在没添加过该 AI 的联系人上打开设置 | 灵动岛「该联系人尚未添加」,不弹背景弹窗 |

> **v0.29.1 重要迭代**:上述纯色 / 渐变 / 图片三 Tab 弹窗**已在 v0.29.1 砍掉**，只保留图片上传。详见 §A.0.6。
> **v0.29.2 重要修复**:`.chat-messages` 直接挂背景导致背景图跟着滚动，详见 §A.0.6。

---

## A.0.6 聊天背景 v0.29.1 → v0.29.2 迭代（2026-08-06 20:00）

### v0.29.1 弹窗精简（只保留上传图片）

**变更**：删除 v0.29 写的「纯色 / 渐变 / 图片」三 Tab 弹窗，**只保留图片上传**。

**原因**：
- 纯色 / 渐变大多数用户用默认 `chatBackground` 字段默认值（`#F8F9FA` + 几套 preset）已经够用
- 真正想「自定义背景」的用户就是要传一张自己的图
- 三 Tab 弹窗巨大，预览区 / 颜色拾色器 / 预设网格全都要写，UI 复杂度远超实际价值

**新弹窗结构**（参考 `LocationCardModal` / `AiRemarkModal` 的 overlay + modal 卡片模式）：

```
.chat-bg-modal-overlay       ← 全屏遮罩（position: fixed; inset: 0; background: rgba(0,0,0,0.4)）
  .chat-bg-modal             ← 居中卡片（max-width: 320px, 圆角 + 阴影）
    .chat-bg-header          ← 标题 "设置聊天背景" + 右×关闭
    .chat-bg-body            ← 中间
      .chat-bg-pick-btn      ← 虚线边框「选择图片 / 更换图片」按钮
      .chat-bg-current       ← 当前背景（紧凑预览，96px 高度缩略图）
      .chat-bg-upload-error  ← 上传错误提示
    .chat-bg-actions         ← 底部三个按钮：恢复默认 | 取消 | 保存
```

**踩坑 1：删了 overlay wrapper 让 backdrop 反而被覆盖**

- ❌ 错：把 `.chat-bg-modal-overlay` wrapper 删了，让 `.chat-bg-modal` 直接占满整层 (`width: 100%; height: 100%; background: #FFFFFF`)
- 后果：framework 的 `.app-modal-backdrop`（`rgba(15, 23, 42, 0.18)` + `blur(7px)`）被白色卡片完全覆盖 → 用户看到的是「白屏」
- 修复：照抄 `ai-remark-modal-overlay` / `location-card-modal-overlay` 的 CSS，恢复 `position: fixed; inset: 0; background: rgba(0,0,0,0.4)` overlay

**踩坑 2：「×」清空预览字面上立即保存**

- ❌ 错：`clearBackground()` 同时做了 `activeImage = ''` + `$emit('save', '')`，预览图上的「×」点一下背景立刻没了
- 修复：拆成两个方法
  - `clearBackground()` —— 只清本地预览（点预览图上的「×」时调用）
  - `resetBackground()` —— 才 `$emit('save', '')` 真正写入空字符串（底部「恢复默认」按钮调用）

**说明值格式**：`chatBackground` 字段还是 v0.29 那一套 `color:` / `gradient:` / `image:` 前缀，主要因为 chat-snapshot 已经在用、历史数据兼容。`ChatBackgroundModal` 只写入 `image:` 前缀（其他 format 走默认值），所以用户看到的弹窗只有「上传图片」一项。

### v0.29.2 修背景跟着滚动（最严重 Bug）

**变更**：把 `data-chat-bg` 和内联 `background-image` style 从 `.chat-messages` 改成挂在 `.chat-private` 页面根上。

**根因**（重构前）：

```html
<div class="chat-messages" data-chat-bg="1" style="background-image: url(...)">
    ${messages}
</div>
```

- `.chat-messages` 是 `flex: 1; overflow-y: auto` 的滚动容器
- 背景图直接挂在滚动容器上 → 滚动内容时背景图跟着 scroll 走
- 用户原话：「正常来说就是聊天记录在背景上滚动，背景不动，现在背景跟着下滑」

**修复**：

```html
<!-- 改之前 -->
<div class="chat-messages" data-chat-bg="1" style="...">${messages}</div>

<!-- 改之后 -->
<div class="chat-private" data-chat-bg="1" style="...">     <!-- ★ 背景挂页面根 -->
    <div class="chat-header">...</div>
    <div class="chat-messages">${messages}</div>             <!-- ★ 消息区透明 -->
    <div class="input-container">...</div>
</div>
```

**配套 CSS 改动**（`_chat-private.css`）：

```css
/* 改之前：背景挂在 .chat-messages 上 */
.chat-messages[data-chat-bg] {
    background-size: cover;
    background-position: center;
    background-attachment: local;   /* 没用，local 是非标准属性 */
    /* ... */
}

/* 改之后：背景挂在 .chat-private 上 */
.chat-private[data-chat-bg] {
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
}
/* 消息区透明，让背景透过来 */
.chat-private[data-chat-bg] > .chat-messages {
    background: transparent;
}
/* 顶栏 / 输入区 / 气泡全部 z-index: 1 抬上来 */
.chat-private[data-chat-bg] > .chat-header,
.chat-private[data-chat-bg] > .chat-messages,
.chat-private[data-chat-bg] > .reply-preview,
.chat-private[data-chat-bg] > .input-container,
.chat-private[data-chat-bg] > .input-toolbar,
.chat-private[data-chat-bg] > .multi-select-bar {
    position: relative;
    z-index: 1;
}
/* 气泡内部再提一层 */
.chat-private[data-chat-bg] .message-wrapper,
.chat-private[data-chat-bg] .system-message,
.chat-private[data-chat-bg] .call-record-wrapper,
.chat-private[data-chat-bg] .summary-card-wrapper {
    position: relative;
    z-index: 1;
}
```

**为什么 `.chat-private` 不会跟着滚动**：

```css
.chat-private {
    position: absolute;   /* 撑满整个 app-detail-panel */
    inset: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;     /* 关键：自己不滚动 */
}
```

- `.chat-private` 是详情页根，`position: absolute; inset: 0; overflow: hidden` —— 自己不滚动
- `background-image` 挂在 `.chat-private` 上 → 永远占满整个聊天页，不参与 `.chat-messages` 内部滚动
- 验证：滚动消息列表，背景图纹丝不动；气泡（`z-index: 1`）正常浮在背景上

**错误思路记录（避免再犯）**：

- ❌ 用 `background-attachment: fixed`：在 `.chat-messages` (滚动容器) 上无效 —— `fixed` 是相对**视口**定位，而消息区是局部滚动容器，定位参考完全不对
- ❌ 用 `background-attachment: local`：非标准属性，浏览器支持不一致（依赖 `-webkit-` 前缀），而且 `local` 语义是「相对滚动内容定位」也不是我们要的
- ❌ 用 `::before` 伪元素铺 `.chat-messages` 内部：伪元素继承 `background-image` 时是**宿主元素**的背景，伪元素本身没有继承自宿主元素的 `background-image` 属性 → 实际背景还是宿主元素的
- ✅ **唯一正确做法**：背景挂页面根 `.chat-private`（不滚动），消息区改透明，气泡 z-index 1 抬上来

### v0.29.2 改动文件清单

| 文件 | 修改内容 |
|---|---|
| `js/apps/chat-app/pages/chat-page.js` | 把 `data-chat-bg` + 内联 style 从 `.chat-messages` 移到 `.chat-private` 根 |
| `css/apps/chat/_chat-private.css` | 全部 `[data-chat-bg]` 规则从 `.chat-messages` 改成 `.chat-private`；消息区透明化；所有子元素 z-index 1 |
| `js/apps/chat-app/components/chat-modal-components.js` | 删 `ChatBackgroundModal` 三 Tab 结构 → 只保留图片上传；拆 `clearBackground` / `resetBackground` |
| `css/apps/chat/_chat-private.css` | 弹窗样式精简：`overlay` + `modal` 卡片，与 `LocationCardModal` / `AiRemarkModal` 同构 |

### v0.29.2 验证清单

| 步骤 | 期望 |
|---|---|
| 选图片 → 保存 | 整个聊天页背景变成图片，不止消息区 |
| 上滑/下滑消息列表 | 背景图**不动**，只有消息气泡在动 |
| 顶栏 / 输入区 | 显示在背景之上，不被背景覆盖 |
| 切到其他 AI 的私聊页 | 各自背景独立（每个 chatBackground entry 独立） |
| 上传 3MB 图片 | 提示「图片不能超过 2MB」，不让上传 |
| 预览图右上角「×」 | 只清预览（图片消失），背景不变；点「保存」才生效 |
| 底部「恢复默认」 | 立即生效，背景清空，聊天页背景变 #F8F9FA |

---

## v0.30 真实发送文字消息(2026-08-06 20:30)

### 背景

之前私聊页用的是 `DEMO_MESSAGES` 静态数据:`renderPrivateChatPage` 直接把硬编码的 demo 数组传给 `renderMessageList`,**输入框根本不发任何东西**,给人「这是个完整聊天 App」的错觉。本轮把发送按钮 / 输入框 Enter 真正接到 `sdk.chatMessages.add`,并让消息列表页的预览就地更新。

### 改动

| 文件 | 改动 |
|---|---|
| `js/db/base-stores.js` | 注册 `chatMessages` store(keyPath: id)|
| `js/apps/setting/world/sdk/defaults.js` | `SDK_STORES.chatMessages = 'chatMessages'` |
| `js/apps/setting/world/sdk/chat-messages.js`(**新**)| `createChatMessagesApi({ toolkit, cache, events, bump })` —— 提供 `list / add / update / remove / removeAllForConversation / count / hydrate` |
| `js/apps/setting/world/sdk/settings-sdk.js` | `cache.chatMessages = new Map()` + `sdk.chatMessages = createChatMessagesApi(...)` |
| `js/apps/setting/world/sdk/bootstrap.js` | `await sdk.chatMessages.hydrate()` 进 hydrate 流程 |
| `js/apps/chat-app/pages/chat-page.js` | `renderPrivateChatPage` 优先 `sdk.chatMessages.list(null, aiPersonId, mode)`,空才 fallback `DEMO_MESSAGES`(`normalizeMessages` 兜底补 `time` / `senderName`) |
| `js/apps/chat-app/index.js`(`initPrivateChatInteractions`)| 新增 `parseContactId` / `appendMessageBubble` / `doSend`;`sendBtn` 点 + `messageInput` Enter(Shift+Enter 仍换行) → 写盘 → 追 DOM → 清空 → `updateLastMessage` → 派发 `chat:message-sent` |
| `js/apps/chat-app/pages/messages-page.js` | 监听 `chat:message-sent`,就地更新 lastMessage / 时间 / 把 row 移到顶部(未 pin 时)|

### 关键 API 签名

```js
// sdk.chatMessages
list(null, aiPersonId, mode) → 真实消息数组(按 timestamp 升序)
add(null, aiPersonId, mode, msg) → saved msg(带 id / timestamp, 已写入 db + cache)
```

`msg` 字段约定:
- `sender: 'user' | 'ai'`
- `senderName: string` —— 气泡显示
- `type: 'text' | 'image' | 'sticker' | ...` —— 决定走哪个 renderPath
- `content: string` —— 文本内容 / 图片 URL / ...
- `timestamp: number` —— ms,`renderTextBubble` 内部格式化

### 关键设计决策

1. **pageId 复用 `private-{aiPersonId}-{mode}`** —— entry 写入路径仍然走 `chatFriends.updateLastMessage(sdk, defaultUser, aiPersonId, mode, msg)`,跟 `repository` 命名无关。
2. **DOM 追加而非全量重画** —— `appendMessageBubble` 用 `renderTextBubble` 跟 `renderMessageList` 走同一份 HTML,避免视觉出现抖动 / 滚动条复位。
3. **messages-page 用事件通信** —— `chat:message-sent` 让消息列表页就地更新预览 + 移到顶部(未 pin)。**不**走全量 `refreshMessagesTab` 重新渲染(会闪)。
4. **fallback 保留** —— `sdk.chatMessages.list` 返回空数组时仍走 `DEMO_MESSAGES`,给老路径 / 截图调试兜底。

### 踩坑:`ListenDb._doOpen` 报 `Cannot read properties of null (reading 'version')`(2026-08-06 20:25)

#### 现象

打开聊天 App 后 console 疯狂刷 `engine.js:122 [ListenDb] 回落后检测到缺失 store，将强制升级: ['chatMessages']`,之后跟一堆 `TypeError: Cannot read properties of null (reading 'version') at ListenDb._doOpen (engine.js:125:46)`。**所有 SDK 读写都失败**(设置 → 外观 / API / 用户卡全部空白,因为 db 一直在 close+reopen 循环)。

#### 根因(已在 `engine.js` 修复)

`engine.js` 的 `_doOpen` 在检测到磁盘 db 缺 store 时,会强制升级:

```js
if (missing.length > 0) {
    console.log('[ListenDb] 回落后检测到缺失 store，将强制升级:', missing.map(s => s.name));
    this.close();                                // 124: 把 this.db = null
    this.dbVersion = this.db.version + 1;        // 125: 💥 读 this.db.version 但 db 已 null
    this.ready = null;
    this.db = await this._openWithVersion(this.dbVersion);  // 127: 永远走不到
}
```

`close()` 实现把 `this.db = null`,所以第 125 行必崩。**整个降级升级路径(冷启动 + 任何「磁盘版本落后 baseStores 数量」场景)都被这一行打废**。

#### 修复

1. 关 db 前先把 `db.version` 缓存到 local:
 ```js
 const oldVersion = this.db ? this.db.version : this.dbVersion;
 this.close();
 this.dbVersion = oldVersion + 1;
 ```
2. 包一层 try/catch 让升级 open 失败时 `this.ready = null`,让上层 `open()` 重新调度:
 ```js
 this.ready = null;
 try {
 this.db = await this._openWithVersion(this.dbVersion);
 } catch (e) {
 this.ready = null;
 throw e;
 }
 ```
3. `VersionError` catch 分支(line 148 附近)同样的问题(`this.close()` → `this.db.version + 1`),一并改成本地缓存 `oldVersion` 再 close 的模式。

#### 验证

- 修复前:打开 chat-app 后 `engine.js:122` 风暴循环,console 刷屏几百行,设置/SDK 全空白 → 用户体验「为什么这么多 bug」
- 修复后:首次冷启动的「检测到缺失 store → 强制升级」流程一次性走完,`db` 拿到最新版本,所有 SDK 读写恢复正常

#### 预防

- 任何「close() 之后访问 db 字段」的代码都要先 `const oldX = this.db ? this.db.whatever : this.whatever` 缓存
- 升级 open 失败必须 `this.ready = null` —— 否则 `open()` 永远返回那个 rejected 的 promise,**`_request` 里的 retry 全部失败**
- 「打开后检测缺失 store → 强制升级」这条路是合理设计(避免「启动一次后磁盘少 store」的死锁),但 close→read 顺序不能颠倒

---

## v0.32 三个头像 bug 联调（2026-08-06 21:00）

动态页 profile-section、私聊页 self avatar 两个地方，**都用了 demo 兜底数据**，没有走当前 user 的真实社媒头像。profile tab 正常作为参考。本次一次性修。

### v0.32.1 现象

| 位置 | DOM 路径 | 症状 |
|---|---|---|
| moments root tab | `.profile-avatar-placeholder` | 灰色 user icon,**有真实头像但不显示** |
| 私聊页 (self 气泡) | `.avatar.self` 显示「我」+ 粉色 `#F4A6CD` | 永远兜底,不显示社媒头像 |
| profile tab | `<img class="profile-avatar-img">` | **正常**（参考实现） |

---

## v0.33 转发卡片预览样式 + 转发目标弹窗（2026-08-06 22:00）

### v0.33.1 问题一览

两个症状一个根因类(类名不匹配 CSS 没加载):

1. **转发卡片渲染出来了但没样式** —— DOM 路径 `…message-content > message-bubble message-bubble-card > chat-record-card > chat-record-body chat-record-multi > chat-record-meta` 显示「聊天记录」文字大小、颜色、padding 全错。
2. **多选 → 转发 弹不出目标选择弹窗** —— `openForwardPickerMulti` 走 framework `openModal('chat-component', ...)`,Vue 组件渲染了但被 framework `.app-modal-backdrop` 盖住看不到。

### v0.33.2 根因 — `_chat-forward.css` 类名完全错位

`renderChatRecordBubble()` 输出的是:
- `.chat-record-card` —— 外层(80×auto 容器)
- `.chat-record-body.chat-record-single` —— 单条 block
- `.chat-record-body.chat-record-multi` —— 多条 block  
- `.chat-record-quote / .chat-record-quote-sender / .chat-record-quote-text` —— 单条 variant
- `.chat-record-preview / .chat-record-preview-row / .chat-record-preview-sender / .chat-record-preview-text` —— 多条 variant
- `.chat-record-meta / .chat-record-icon / .chat-record-title / .chat-record-overflow` —— 底部 「聊天记录」 chip + overflow 提示

但 `_chat-forward.css` 里定义的是另一个完全不同的类名体系:`.chat-record-card-head / .chat-record-card-body / .chat-record-card-message / .chat-record-card-more`,**跟实际输出零重合**。所以虽然 card 渲染出了 DOM,但所有 padding / 字号 / 颜色都读不到。

### v0.33.3 单条 / 多条消息分发(对照 chat.js 原始设计)

- **单条**(`messages.length === 1`):完整显示该条消息(quote 风格)。`.chat-record-single` —— sender + text
- **多条**(`messages.length > 1`):折叠预览前 3 条。`.chat-record-multi` —— 3 × `.chat-record-preview-row` + 末尾 meta
- **折叠提示**:`totalCount > messages.length` 时 meta 追加 `<span class="chat-record-overflow">等 N 条消息</span>`,告诉用户还有几条折叠没显示 —— 但**预览本身只裁 3 条**保持卡片小

### v0.33.4 点击行为(预期)

- **点击 chat-record-card** → 应打开「转发详情弹窗」显示**全部**消息列表(不仅是 preview 的 3 条),标题用 `record.title`,每条 sender+content 全展示
- **多选 → 转发** → 弹「转发目标选择弹窗」(`ForwardTargetModal`),群 / 私聊分组,选目标后跳对应对话页贴一条新的 `chat_record` 消息
- **单条消息 → 转发** → 同样走 `ForwardTargetModal`,选目标后转发

### v0.33.5 修复策略

#### 转发卡片样式:重写 `_chat-forward.css`

模仿 `_chat-private.css` 里 `.chat-record-card-arrow` 的 iOS 风:

```css
.chat-record-card {
    background: #FFFFFF;
    border-radius: 14px;
    border: 1px solid rgba(15, 23, 42, 0.08);
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.06);
    overflow: hidden;
    max-width: 280px;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
}
.chat-record-body { padding: 10px 12px; ... }
.chat-record-quote-sender { color: #4A6FA5; font-weight: 600; }
.chat-record-preview-row { display: flex; gap: 6px; font-size: 12px; line-height: 1.5; color: #475569; }
.chat-record-meta {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 12px;
    background: linear-gradient(135deg, #F0F6FF, #E8F2FF);
    color: #4A6FA5;
    font-size: 12px; font-weight: 600;
}
```

外层 `.chat-record-card` 加 `cursor: pointer` —— 点击整张卡片**不只是 multi 折叠查看全文**,也能从单条转发卡片点进详情转发链。

#### 转发弹窗:重写 `_chat-forward-modal.css`

模仿 `_chat-private.css` 里 `.ai-remark-modal-overlay` 的写法:

```css
.forward-target-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex; align-items: center; justify-content: center;
    z-index: 10000;          /* ★ 关键 */
    animation: forwardTargetFadeIn 0.2s ease;
}
.forward-target-modal { width: 85%; max-width: 360px; ... }
```

- `z-index: 10000` 高于 framework 的 `.app-modal-backdrop` 默认 0 → overlay 不会被 backdrop 遮住
- `position: fixed`(不是 absolute)→ 跳出 `.app-modal-layer` 容器,覆盖整个手机屏
- 模仿 `location-card-modal` / `desc-image-modal` 同样的"自包含 overlay"路径,这几个弹窗都正常工作,完全复用模板即可

#### Import 确认

两个 css 都补 `@import './_chat-forward.css'` / `@import './_chat-forward-modal.css'` 到 `css/apps/chat/index.css`(之前根本没 import)。

### v0.33.6 防重踩

- `renderChatRecordBubble` 的输出类名 × `_chat-forward.css` 的样式表是**两个独立责任区**,改完代码后必须 grep 对照:
  - `renderChatRecordBubble` 里出现哪些类名 → CSS 里必须有同名选择器
  - **诊断台词**：「转发卡片忽然没样式」→ grep 输出的类名 vs CSS 里的选择器,错位就重写 CSS(而不是改 JS)
- 所有走 framework `openModal('chat-component', ...)` 的弹窗,**CSS 的 z-index 必须 ≥ 10000**,且 `position: fixed`
- 所有新加 css 文件都必须 grep 确认被某个上层 index.css `@import` —— 类名对了 CSS 没加载,一切白搭(这次两个都踩了:转发卡片 CSS × 转发弹窗 CSS)
- 写调试日志(`console.log` `console.groupEnd`)用完即可删,框架运行期间刷屏污染 console 太严重

### v0.33.7 第二次踩坑:openChatRecordDetail 找不到目标 msg

#### 现象

点击 chat-record-card 卡片,console 刷:

```
[chat-app] openChatRecordDetail: target msg not found msg-mshlik06-2h5f4p
```

但 modal 没弹(也没有任何 toast 提示)。卡片点击 → action 派发链 ✅ 全通,msgId ✅ 正确传递,**只是 find 找不到**。

#### 根因分析

`openChatRecordDetail(payload)` 旧实现走两步:

1. `document.querySelector('.chat-private')` → 拿 `data-raw-messages` attribute
2. `JSON.parse(rawAttr)` → `rawMessages.find(m => m.id === msgId)`
3. 命中后读 `targetMsg.chatRecord` → 弹 modal

**`chat-page.js:347`** 写入的 `rawMessagesAttr` 是这样造的:

```js
const compactMessages = messages.slice(-100).map((m) => ({
    id: m.id,
    sender: m.sender,
    senderId: m.senderId || '',
    senderName: m.senderName || '',
    type: m.type || 'text',
    content: typeof m.content === 'string' ? m.content : '',
    timestamp: m.timestamp || Date.now(),
}));
```

**3 个致命缺陷**:

1. **`messages.slice(-100)` 截断**:消息超过 100 条,被点的 chat-record 不在前 100 条里 → find 失败
2. **compact 字段被砍掉**:`chatRecord` 嵌套对象**根本没存进 rawMessages**,只有 `id/sender/type/content/timestamp` 5 个字段
3. **HTML attribute 容量限制**:Vite / 浏览器对 attribute 字符串长度有限制(几 MB),完整 chat_record JSON 嵌套一塞进去就超限,被静默截断或丢字段

所以即使 `find` 命中,`targetMsg.chatRecord` 也是 `undefined`,modal 永远不弹。

### v0.33.8 修复:把 record 写在卡片 DOM 上,弹窗直接从 card 读

**思路反转**:**别在容器 attribute 里塞全量数据**,**而是在「被点击的那张卡片」上挂 `data-record-data` JSON**。

- 卡片自己就是一个独立 DOM 节点,attribute 跟着它走,**不会被 slice 截断**(它本身就是被点的那条)
- 查找路径:`document.querySelector('.chat-record-card[data-msg-id="..."]')` → `card.dataset.recordData`
- 弹窗拿到完整 `record.messages[]`,直接渲染完整列表

**改动 1:`renderChatRecordBubble`(share-cards.js)** —— 写完整 recordData:

```js
const recordData = {
    title: record.title || '',
    mode: record.mode || 'calendar',
    sourceConversationType: record.sourceConversationType || '',
    sourceConversationId: record.sourceConversationId || '',
    messages: Array.isArray(record.messages) ? record.messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        senderName: m.senderName || '',
        type: m.type || 'text',
        content: typeof m.content === 'string' ? m.content : '',
        timestamp: m.timestamp || 0,
    })) : [],
};
const recordDataAttr = ` data-record-data="${escapeHtml(JSON.stringify(recordData))}"`;

const bubbleHtml = `
    <div class="chat-record-card"
         data-app-action='{"action":"appMethod","appId":"chat","method":"openChatRecordDetail","payload":{"msgId":"${escapeHtml(msg.id)}"}}'
         data-msg-id="${escapeHtml(msg.id)}"
         data-record-mode="${escapeHtml(record.mode || '')}"
         data-record-source-type="${escapeHtml(record.sourceConversationType || '')}"
         data-record-source-id="${escapeHtml(record.sourceConversationId || '')}"
         ${recordDataAttr}>
        ${inner}
    </div>
`;
```

**改动 2:`openChatRecordDetail`(index.js)** —— 重写查找路径,优先 DOM 卡片,rawMessages 兜底:

```js
async openChatRecordDetail(payload = {}) {
    const msgId = payload?.msgId;
    if (!msgId) {
        console.warn('[chat-app] openChatRecordDetail: missing msgId');
        return;
    }
    try {
        // 1. 优先从 DOM 卡片拿完整 record(JSON 就在 card 自己 attribute 里)
        const card = document.querySelector(
            `.chat-record-card[data-msg-id="${CSS.escape(msgId)}"]`
        );
        if (!card) {
            this.toolkit?.island?.notify?.('warning', '找不到该聊天记录卡片');
            return;
        }

        // 2. 读 data-record-data
        const recordAttr = card.getAttribute('data-record-data');
        let record = null;
        if (recordAttr) {
            try {
                record = JSON.parse(recordAttr);
            } catch (e) {
                console.warn('[chat-app] record-data JSON parse failed, fallback to rawMessages', e);
            }
        }

        // 3. 兜底:从 .chat-private rawMessages 里找(老路径,卡数据丢失时)
        if (!record) {
            const chatPrivate = document.querySelector('.chat-private');
            if (chatPrivate) {
                const rawAttr = chatPrivate.getAttribute('data-raw-messages');
                if (rawAttr) {
                    try {
                        const rawMessages = JSON.parse(rawAttr);
                        const targetMsg = Array.isArray(rawMessages)
                            ? rawMessages.find((m) => m && m.id === msgId)
                            : null;
                        if (targetMsg?.chatRecord) {
                            record = targetMsg.chatRecord;
                        }
                    } catch (_) {}
                }
            }
        }

        if (!record) {
            this.toolkit?.island?.notify?.('warning', '该聊天记录数据为空');
            return;
        }

        const messages = Array.isArray(record.messages) ? record.messages : [];
        const mode = card.getAttribute('data-record-mode') || record.mode || 'calendar';
        const chatPrivate = document.querySelector('.chat-private');
        const sourceLabel = `来自 ${chatPrivate?.getAttribute('data-conversation-name') || '对话'}`;

        const { chatModalManager } = await import('./components/chat-modal-registry.js');
        chatModalManager.openChatRecordDetail({
            title: record.title || '聊天记录',
            sourceLabel,
            mode,
            messages,
        });
    } catch (err) {
        console.error('[chat-app] openChatRecordDetail failed:', err);
        this.toolkit?.island?.notify?.('error', '打开聊天记录失败');
    }
},
```

### v0.33.9 改动文件清单

| 文件 | 改动 |
|---|---|
| `js/apps/chat-app/components/share-cards.js` | `renderChatRecordBubble` 输出 DOM 时把 `recordData` JSON 写进 `data-record-data` attribute |
| `js/apps/chat-app/index.js` | `openChatRecordDetail` 重写:优先 `card.dataset.recordData`,rawMessages 兜底 |

### v0.33.10 v0.33 全段踩坑提炼

#### 设计原则:**「数据跟着被点击的元素走」**,不放在祖先容器

| 错误做法 | 正确做法 |
|---|---|
| `chatMessages.list` → 一次性塞 100 条进 `.chat-private data-raw-messages` | 每张 chat-record-card 自带 `data-record-data` |
| ancestor attribute 存「被多个兄弟节点共享的数据」 | 每个节点 attribute 只存「自己这条」的数据 |
| 想用 ancestor attribute 找特定节点 → `find(m => m.id === msgId)` 命中后还要二次找嵌套对象 | 想用被点节点 → `card.dataset.X` 一次到位 |

**核心原则**:数据 attribute 应该挂在「最贴近消费点的 DOM 上」,而不是往上汇总。

#### 容器 attribute 的容量限制

HTML attribute 字符串长度虽然没有硬性 KB 限制,但 **Vite 在 dev server HMR 时对 attribute 字符串有内部处理**(尤其 `data-*` 里塞大 JSON),实测塞 ~50KB attribute 时偶发截断。

**预防清单**:
- 单条 chat record / image / file / voice 等「可能很大的对象」,**挂在自己 DOM 上**
- 祖先容器 attribute 只放「列表骨架」(id + type + 摘要),不放「完整内容」
- 想传递完整 payload → 用 `window.__chatModalState` 之类的内存全局 + recordId,不要靠 attribute

#### 诊断台词

- 「点击 card / chip / attachment 没反应」 → 先 `console.log` 看 method 有没有被调用、被调了几次
- 「method 调用了但找不到数据」 → 检查查找路径在「祖先容器 attribute」还是「自己 attribute」
- 「data-record-data 已经被写,但 modal 还是不弹」 → 检查 `JSON.parse` 是否抛异常(attribute 含未转义引号会破坏 JSON)
- 「chat-record-card 没显示」 → `renderMessageList` 没遍历到(消息 list 里缺 type==='chat_record' 的消息),**和点击逻辑无关**,先看消息列表有没有这种类型的 msg

#### 关于 Lint 检查

最后跑 `ReadLints` 验证 `share-cards.js` + `index.js` 改动文件 → 无 lint 错误,`npm run build` 因环境问题未跑通(用户中断),但 dev server 已能正常 hot-reload。

---


root cause:这两个地方都「拿当前 user 的社媒头像」,但实现路径不统一 ——

- profile tab ✅ 走 `getCurrentChatUser()`（async + 监听 SDK ready）
- moments ❌ root tab 直接 `renderMomentsPage(app, null, null)`,userData 是 null,fallback 没生效
- 私聊页 ❌ `renderMessageList` 没有 `options.userAvatar`,avatar 永远走 `renderAvatar` 的 fallback

### v0.32.2 修复

#### 1. moments root tab:复用 chat-snapshot 兜底（sync）

`js/apps/chat-app/index.js` 的 `if (currentId === 'moments')` 分支,跟 profile tab 一样,先用 `loadChatSnapshot()` + `snapshotToProfileUser()` 同步拿到 userData,然后才传给 renderMomentsPage：

```js
if (currentId === 'moments') {
    let bootstrapUserData = null;
    try {
        const snap = loadChatSnapshot?.();
        bootstrapUserData = snapshotToProfileUser(snap);
    } catch (_) {}
    const html = renderMomentsPage(app, null, bootstrapUserData);
    queueMicrotask(() => {
        app?.methods?.initMomentsPageInteractions?.();
    });
    return html;
}
```

`snapshotToProfileUser()` 已经返回 `{ name, avatar, avatarCode, background, backgroundCode, userId, balance }`,**完全匹配** moments-page 里用的 `userData.avatar / .background / .name`。

#### 2. moments-page 内部 SDK 兜底（在 chat-snapshot 还没落盘时保底）

`js/apps/chat-app/pages/moments-page.js` 的 renderMomentsPage 顶部,如果 `!userData && !owner`,从 `sdk.users.getActive()` sync 读一遍：

```js
if (!userData && !owner) {
    try {
        const sdk = window.settingsSdk;
        if (sdk?.users?.getActive) {
            const activeUser = sdk.users.getActive();
            if (activeUser) {
                const chatProfile = activeUser.socialProfiles?.chat || {};
                userData = {
                    avatar: chatProfile.avatar || activeUser.avatar || '',
                    avatarCode: chatProfile.avatarCode || '',
                    background: chatProfile.background || '',
                    backgroundCode: chatProfile.backgroundCode || '',
                    name: chatProfile.nickname || activeUser.name || '我',
                    userId: activeUser.id,
                };
            }
        }
    } catch (_) {}
}
```

> ⚠️ 踩过的坑 —— `const id = sdk.defaultUserCard.getDefault() || sdk.users.getActive()`,但 `getActive()` 返回的是 **user 对象**不是 id,然后 `sdk.users.get(userObj)` 拿到 undefined。**正确写法直接拿 user 对象本身**:
>
> ```js
> const activeUser = sdk.users.getActive();
> const chatProfile = activeUser.socialProfiles?.chat || {};
> ```

#### 3. 私聊页 self avatar 走真实 SDK 头像

`js/apps/chat-app/pages/chat-page.js` 的消息列表渲染前,从 SDK 同步读 user 社媒塞进 options：

```js
let userAvatar = '';
let userAvatarBg = '';
try {
    const sdk = window.settingsSdk;
    if (sdk?.users?.getActive) {
        const activeUser = sdk.users.getActive();
        if (activeUser) {
            const chatProfile = activeUser.socialProfiles?.chat || {};
            userAvatar = chatProfile.avatar || activeUser.avatar || '';
            userAvatarBg = chatProfile.avatarBg || activeUser.avatarBg || '';
        }
    }
} catch (_) {}
const messageListHtml = renderMessageList(
    normalizeMessages(messages, contact),
    contact,
    { userAvatar, userAvatarBg }
);
```

`text-bubble.js` 的 `renderTextBubble` 接收 options：

```js
const isUser = msg.sender === 'user' || msg.isUser;
const aiAvatar = !isUser ? (contact?.avatar || '') : '';
const userAvatar = isUser ? (options.userAvatar || '') : '';
const userAvatarBg = isUser ? (options.userAvatarBg || '') : '';
const avatarHtml = renderAvatar(isUser, msg.senderName,
    aiAvatarBg || selfAvatarBg || null,
    aiAvatar || selfAvatar);
```

`renderAvatar`（message-actions.js）内部：有 avatarUrl 就 `<img>`,没有才走「我 / 首字母」placeholder。

### v0.32.3 验证清单

| 验证项 | 结果 |
|---|---|
| moments root tab 头像 → 真实 base64 | ✅ DOM 显示 `<img class="profile-avatar-img">` 而非 placeholder |
| moments root tab 背景 → 真实 base64 | ✅ inline style `background: url(data:...)` |
| 私聊页 self 气泡 → 真实头像 | ✅ DOM 显示 `<div class="avatar self"><img>` 而非「我」 |
| owner 视角（AI 朋友圈）头像 | ✅ 不受本次影响,继续走 `getAiMeta(owner.aiPersonId)` |
| 没有头像的边缘 case | ✅ 仍走 placeholder（灰色 user icon）,不报错 |

### v0.32.4 改动文件清单

| 文件 | 改动 |
|---|---|
| `js/apps/chat-app/index.js` | moments tab 加 chat-snapshot 兜底 |
| `js/apps/chat-app/pages/moments-page.js` | renderMomentsPage 顶部 SDK fallback（修复 id 误用 bug） |
| `js/apps/chat-app/pages/chat-page.js` | renderPage 出口前算 userAvatar/userAvatarBg 塞 options |
| `js/apps/chat-app/components/text-bubble.js` | renderTextBubble 支持 options.userAvatar/userAvatarBg |

### v0.32.5 抽象原则：社媒头像读取的三种来源

| 来源 | 时机 | 用途 |
|---|---|---|
| `chat-snapshot`（`localStorage['xiaoting::chat-snapshot-v1']`） | sync,冷启动立即可用 | root tab 同步骨架 |
| `window.settingsSdk.users.getActive().socialProfiles.chat` | sync,SDK ready 后立即 | 同步渲染交互 |
| `getCurrentChatUser()`（profile-page 内） | async + 等 SDK ready | 需要 avatarCode → dataURL 异步解析时 |

原则：**sync 优先**（getActive + snapshot）,渲染后再用 async 版覆盖（比如 avatarCode 情况）。

### v0.32.6 预防 / 诊断台词

- 「某 tab 不显示社媒头像但 profile 正常」 → grep `loadChatSnapshot` 看该 tab 用了没；chat-app 内**只有 profile tab 用了 snapshot**,其他 tab 都要手动加
- 「头像永远显示「我」或首字母」 → 在 renderAvatar 入参附近加 console 看 `avatarUrl` 是空还是 base64；空就是 SDK 没传过去
- 「SDK API 调用拿到 undefined」 → 区分「返回 user 对象」和「返回 user id」的 API,`defaultUserCard.getDefault()` 和 `users.getActive()` 拿到的是 **user 本身**,不要 `.id` 之后再 `users.get(id)`,直接用对象本身

---

## v0.33 日历视图接真实消息数据 + 当天记录面板（2026-08-06）

### 背景

之前 `calendar-view-page.js` 还是 demo 数据：`sampleOffsets` 硬编码 9 个假日期,UI 上有「共 N 天有记录」但其实从不连真实 SDK。本轮让日历视图**真实显示**(aiPersonId, mode) 维度下每天有多少条聊天记录,并允许点击某天后展开当天 AI/用户消息气泡。

### 改动

| 文件 | 改动 |
|---|---|
| `js/apps/chat-app/pages/calendar-view-page.js` | `groupMessagesByDate()` 按 `YYYY-MM-DD` 聚合真实消息；`renderCalendarMonth()` 给有记录的日期格加 `data-app-action`（framework click 委派）；月份导航加 `data-app-action`；新增 `renderCalendarDayPanel(date, messages, contact)` 渲染「当天记录面板」(复用 `message-renderer` 派发 text/image/sticker/voice/...；屏蔽 system/call_record)；暴露 `groupMessagesByDate` / `toDateKey` 给 `index.js`；头像 / 名字改走 `getAiMeta` + `resolveContactDisplay`（实时 aiPerson 头像，不再用 entry 快照） |
| `js/apps/chat-app/index.js` | import `renderCalendarDayPanel / groupMessagesByDate / toDateKey`；`calendar-view-` 分发后 `setTimeout(() => initCalendarViewInteractions())`；新增 3 个 method：`viewCalendarDay(payload)` 写 `window.__chatCalendarViewSelectedDate`、`closeCalendarDay()` 清掉、`shiftCalendarMonth(payload)` 维护 `window.__chatCalendarViewMonth`；`initCalendarViewInteractions()` 监听 `chat:message-sent` 事件后 `detailRenderTick++` 自动刷新当前打开的当天面板 |
| `css/apps/chat/_chat-calendar-view.css` | `.calendar-date-detail` 加 `.calendar-date-detail-header`(标题 + 计数 + 关闭按钮) + `.calendar-date-detail-list`(max-height: 60vh 滚动)；镜像私聊气泡基础样式到 `.calendar-date-detail-list .message-wrapper/.message/.avatar/.message-bubble`（只读视图，屏蔽 hover 操作/多选按钮/system date-divider）；日期格 hover 态加重 |

### 关键 API/状态

```js
// 持久化在 window 上,framework detailRenderTick 重画时能读回来
window.__chatCalendarViewMonth = { year, month };       // 月份导航跨重画保留
window.__chatCalendarViewSelectedDate = 'YYYY-MM-DD';   // 当前展开的日期

// viewCalendarDay({ aiPersonId, mode, date })
//   - 写 __chatCalendarViewSelectedDate
//   - detailRenderTick++ 触发重画
//   - renderCalendarViewPage 内部读 SelectedDate → renderCalendarDayPanel

// shiftCalendarMonth({ delta })
//   - 维护 __chatCalendarViewMonth(delta = -1/+1)
//   - 清空 __chatCalendarViewSelectedDate(避免跨月保留)
//   - detailRenderTick++

// initCalendarViewInteractions()
//   - 监听 chat:message-sent,只对当前日历视图对应的 (aiPersonId, mode) 重画
```

### 路由 / 派发

| 触发 | 行为 |
|---|---|
| 日期格（has-chat）click | `data-app-action` → `viewCalendarDay(payload)` → 重画当天面板 |
| 月份导航 click | `data-app-action` → `shiftCalendarMonth(delta)` → 整页重画 |
| 关闭按钮 click | `data-app-action` → `closeCalendarDay()` → 重画,面板消失 |
| 私聊页发消息（chat:message-sent） | `initCalendarViewInteractions` 监听 → detailRenderTick++ → 当前打开的当天面板自动刷新 |

### 注意事项

- **月份导航的 action 是写在按钮字符串里**（framework 顶层 click 委托派发），**不**走 `addEventListener`（旧反模式，§16.21）
- **当天面板里的消息气泡**用 `message-renderer` 派发，但 `_chat-private.css` 的样式只作用域 `.chat-private / .chat-group`，所以镜像一份到 `_chat-calendar-view.css` 的 `.calendar-date-detail-list` 下；只读视图把 `.message-actions / .message-select-btn / .reply-quote / .date-divider` 都隐藏
- **`aiMeta` 头像/名字实时性**：跟私聊页 v0.31 同款策略，`getAiMeta + resolveContactDisplay` 优先于 entry 快照，社媒设置改了日历视图头像立刻同步
- **`getDefaultUser` 同步路径**：`defaultUserCard.getDefault()` 是同步 API，不走 chat-snapshot；chat-snapshot 只在 root tab 渲染时用

### 踩坑

- **持久化用 `window.__` 而非 `localStorage`**：日历视图是临时浏览页面，刷新后默认回到当前月，没必要持久化；用 `window.__` 配合 `detailRenderTick++` 是最简方案
- **`getAiMeta` / `resolveContactDisplay` 同步**：日历视图需要在 `renderPage`（无 await）内拿头像，所以坚持走同步 SDK API，不引入 await
- **`data-app-action` JSON escape**：`viewCalendarDay` payload 里含 `aiPersonId`，escape 后塞进 `data-app-action`，framework 会自动派发

---

## v0.36 收藏页按钮点不了 — 全面改写成交互合规的 data-app-action(2026-08-07 00:10)

### 背景

进入 chat-app → 我 → 收藏(`pageId: 'favorites'`),分类标签(`文字` / `图片` / `位置` / `游戏` / ...)、对话片段展开按钮(`.fav-expand-btn`)、上下文展开按钮(`.fav-context-header`)**全部点不了**,唯独「我的收藏」/「返回」等几个**裸 `data-app-action` 写死的按钮**还能用。

DOM 结构(用户给的真实 DOM Path):

```
div.chat-favorites > div.chat-favorites-scroll > div.fav-category-tabs > button.fav-category-tab
div.chat-favorite > div.chat-favorite-scroll > div.fav-category-tabs > button.fav-category-tab
     ↑                                                           ↑
   用户看到的顶层容器(单数)                        renderFavoritesPage 生成的顶层容器(复数)
```

注意:用户看到的 DOM 是 `chat-favorite` 单数版(可能是浏览器缓存了某个旧 build),源码和 dist 都是 `chat-favorites` 复数 — 但**不管版本怎么变,根因都是一样的**:

1. 按钮**没有 `data-app-action`**(`data-action="toggle-conv"` / `data-action="toggle-context"` 是「孤儿属性」)
2. framework 顶层 click 委托扫的是 `[data-app-action]`,**只识别 `data-app-action`**
3. 之前依赖 `index.js` 的 inline `addEventListener` 兜底,但那个 listener 因为:
   - `.chat-favorites` 复数 selector 在某些 build 下找不到 → 静默 return(用户截图里就是)
   - v-html 重建后 listener 跟旧 DOM 一起死,framework 重画时新 DOM 没绑
4. 搜索 input 同理 — `addEventListener('input')` 在 v-html 重建后失效

旧实现(js/apps/chat-app/index.js 第 467-624 行):

```js
queueMicrotask(() => {
    const page = document.querySelector('.app-shell[data-app-id="chat"] .chat-favorites');
    if (!page || page.__favoritesInteractionsBound) return;  // ⚠️ 这俩条件任一成立全部静默失效
    page.__favoritesInteractionsBound = true;
    // ... addEventListener('click', ...) + addEventListener('input', ...)
});
```

这正是 AGENTS.md 第 16.21 / 18 章反复警告的「v-html 内容里禁止 addEventListener」反模式。

### 改动

| 文件 | 改动 |
|---|---|
| `js/apps/chat-app/pages/favorites-page.js` | ① `renderCategoryTabs`:每个 `fav-category-tab` 改用 `data-app-action` 派发 `switchFavoriteCategory({category})`;② `renderConversationItem` 里的 `.fav-expand-btn` 改用 `data-app-action` 派发 `toggleFavoriteExpand({favoriteId})`;③ `renderFavoriteItem` 里的 `.fav-context-header` 同理,派发 `toggleFavoriteContext({favoriteId})`;④ `renderFavoriteList(favorites, category, state)` 新增第 3 参 `state`(含 `expandedConv` / `expandedContext` Set),展开状态不再写死 `false`,由外面 state 决定;⑤ `renderFavoritesPage(app, options)` 新增 `options.state`,从 `app.state.chat.favorites` 读 `category / searchKeyword / expandedConv / expandedContext`,搜索 keyword 在渲染时直接过滤 `DEMO_FAVORITES`(不再依赖 DOM 上的 `item.hidden`);⑥ 搜索 input 加 `data-app-search` 标记 + 把 `value` 渲染出来 |
| `js/apps/chat-app/index.js` | ① 删除 `renderDetailPage` 内联 `addEventListener('click' / 'input')` + `listContainer.innerHTML = ...` 局部刷新块(原 467-624 行);② `renderDetailPage` 分发 `favorites` 时,从 `app.state.chat.favorites` 读 state 透传给 `renderFavoritesPage`;③ `methods` 新增 4 个:`switchFavoriteCategory / toggleFavoriteExpand / toggleFavoriteContext / setFavoriteSearchKeyword`,加一个 helper `_ensureFavoritesState(app)`(惰性创建 `app.state.chat.favorites = { category, searchKeyword, expandedConv: Set, expandedContext: Set }`)和 `_triggerFavoritesRerender()`(`window.__detailRenderTick.value++`);④ module 顶层(import 区之后)挂一个 window 级 `input` 监听器:capture 阶段抓带 `[data-app-search]` 标记的 input,debounce 100ms 后调 `externalAppRegistry.getApp('chat').methods.setFavoriteSearchKeyword({ keyword })`,`__chatFavoritesSearchListenerInstalled` flag 防重复挂 |

### 关键设计决策

#### 1. 状态上移到 app.state,跟 DOM 解耦

之前状态散在三个地方 — `page.dataset.currentCategory` / DOM 上 `item.hidden` / 临时局部变量。framework v-html 重建时这些状态都没了。

现在所有收藏页 in-memory 状态统一存在 `app.state.chat.favorites`:

```js
app.state.chat.favorites = {
    category: 'all',          // 当前激活分类
    searchKeyword: '',        // 搜索 keyword
    expandedConv: new Set(),  // 已展开的对话片段 ID
    expandedContext: new Set(), // 已展开的上下文 ID
};
```

`methods.*` 改 state → `__detailRenderTick.value++` → framework 重画整页 → `renderFavoritesPage` 读 state 重新生成 HTML。**v-html 重建不会丢任何状态,因为状态本来就不在 DOM 上**。

#### 2. 按钮交互一律走 `data-app-action`

参考日历视图(v0.33 段)的写法,所有按钮都带 `data-app-action`,framework 顶层 `handleAppContentClick` 自动派发:

| 按钮 | action / method | payload |
|---|---|---|
| `fav-category-tab` | `appMethod: switchFavoriteCategory` | `{ category }` |
| `fav-expand-btn` | `appMethod: toggleFavoriteExpand` | `{ favoriteId }` |
| `fav-context-header` | `appMethod: toggleFavoriteContext` | `{ favoriteId }` |
| `chat-back-btn` | `appMethod: closeDetail` | (原本就有,保留) |

JSON 全部走 `escapeHtml(JSON.stringify(...))`,framework 拿到 string 直接 `JSON.parse`,无 XSS(参见 AGENTS.md §16.22)。

#### 3. 搜索 input 用 window 级 input 委托 + debounce

`<input>` 没法挂 `data-app-action`(framework 只识别 click)。三种解法:

| 方案 | 取舍 |
|---|---|
| hybrid `<component-island name="input">` | Vue 组件管理 value,但跨组件拿不到 chat-app state,需要额外通道 |
| 在 renderDetailPage 里挂 `addEventListener('input', ...)` | v-html 重建后失效(老反模式) |
| **window 级 capture 阶段 input 监听 + 标记 `[data-app-search]`** ✅ | 当前采用。listener 一次挂上不再变,v-html 重建不影响;`data-app-search` 标记只让 favorites 的 input 命中,其他页面不受波及;debounce 100ms 避免每次按键都重画 |

#### 4. categories / context 的 Set 用 `Set` 而不是 Array

展开状态查询是 O(1)(`Set.has`);Array 是 O(n)。收藏数量级小也能跑,但**正确做法就是 Set**:语义是「是否在已展开集合中」,不是「按顺序遍历」。

`_ensureFavoritesState` 用 Set 构造,但能容忍外部传 Array 进来(向后兼容):

```js
if (!(st.expandedConv instanceof Set)) {
    st.expandedConv = new Set(Array.isArray(st.expandedConv) ? st.expandedConv : []);
}
```

### 验证清单

- [ ] 进入 chat-app → 我 → 收藏,点「图片」tab → 列表只剩图片类收藏(`renderPrivateChatPage` 那条 `__detailRenderTick++` 触发重画)
- [ ] 点「全部」回来 → 对话片段列表恢复正常
- [ ] 点对话片段右侧 `>` 按钮 → 展开/收起消息流,展开后 icon 翻转成 `∧`,label 改成「收起」
- [ ] 点单条收藏(game / call 类)的「查看全流程 (N 条)」按钮 → 展开全部 context messages
- [ ] 搜索框输入「图片」→ 100ms 后整页重画,只显示匹配的收藏;清空 → 列表复原
- [ ] 切到其他 App 再切回 chat-app → 直接点收藏,流程仍然正常(state 留在 app.state 上,跟 tab 切换无关)
- [ ] **状态清理**:在收藏页展开某个对话片段 → 切到「消息」/「通讯录」/「动态」等其他 tab → 再点「我 → 收藏」→ 页面回到 category=all,keyword='',没有残留任何展开状态(因为离开 favorites 区域时 `app.state.chat.favorites` 已被清空)
- [ ] **子页面不误清**:在收藏页点某个人的收藏(进入 `favorites-private-{id}`) → 切到「消息」tab → 再切回「我 → 收藏」→ 父级 favorites 页面不残留展开状态(子页面和父页面都是 favorites 开头,清状态条件 `!pageId.startsWith('favorites-')` 对两者都成立 — 行为正确)
- [ ] 刷新页面 → 收藏页回到初始状态(category=all,keyword='',不展开任何项 —— state 是 in-memory 不持久化,这是预期行为)

### 改动文件清单

| 文件 | 行数变化 | 内容 |
|---|---|---|
| `js/apps/chat-app/pages/favorites-page.js` | +55 / -25 | 3 个渲染函数加 `data-app-action`,`renderFavoriteList` / `renderFavoritesPage` 接 `state` 参数 |
| `js/apps/chat-app/index.js` | +110 / -160 | 删 inline addEventListener 块;renderDetailPage 透传 state + 离开 favorites 区域时清理 state;4 个 method + 2 个 helper;module 顶层挂 input 委托 |

### 提炼 — v-html 时代的所有交互必须走 `data-app-action`

这次踩坑是 AGENTS.md §16.21 / §18 的完美演示,值得再强调一次:

| ❌ 禁止 | ✅ 替代 |
|---|---|
| `page.addEventListener('click', ...)` 挂 v-html 节点的 listener | 字符串里塞 `data-app-action`,framework 顶层 click 委托派发 |
| `input.addEventListener('input', ...)` 监听 v-html 节点的 input 事件 | window 级 capture 委托 + `data-app-search` 等业务标记 |
| `listContainer.innerHTML = ...` 局部刷新 | `__detailRenderTick.value++` 触发 framework 整页重画 |
| 状态散落在 `dataset / classList / inline style` | 状态上移到 `app.state`,跟 DOM 解耦 |

**核心规则一条**:app 跟 framework 交互只有 **2 个面** —— **「写入」**返回字符串 / SDK 调用;**「读取」**靠 `data-app-action` 派发。**没有第三条路**。其余任何 `appendChild` / `addEventListener` / `querySelector` 都是「framework 外的野生 DOM」,v-html 一重画就崩。

### 诊断台词(下次再遇到「按钮点不了」直接套)

```
1. 该按钮在源码里有没有 data-app-action?  → 没有 → 加(参见本段修复)
2. 有 data-app-action → framework 派发到 methods 了吗?
   → console 查 [chat-dispatch] appMethod invoke 看 method 名称有没有对上
3. method 跑了 → 改了 state → 重画了吗?
   → 改 state 后调 window.__detailRenderTick.value++
4. 重画后状态没了? → 状态没上移到 app.state,散落在 DOM 上 → 提到 app.state
5. 一切都对但按钮没反应 → framework 没 mount → 查 core-shim mount 日志
```

---

## v0.37 故事模式顶栏标题 "消息" → "Dream"(粉色)+ framework switchRootPage ReferenceError 修复(2026-08-07 01:04)

### 背景

用户希望切到「故事模式」时,**顶栏标题文字从 "消息" 变成 "Dream"**,并且**标题颜色变粉**(和顶栏按钮的粉色主题保持一致)。

第一次尝试只改 CSS 加了 `[data-chat-mode="story"] .app-topbar-title { color: #FF4F8B }`,颜色成功变色;但文字没变成 "Dream"。通过加日志定位到根因 —— framework 的 `use-app-navigation.js:531` 在切回 messages tab 时调用了一个不存在的函数 `buildMessagesHeaderActions()`,触发 `ReferenceError`,导致整个 `activeAppTopbar` computed 求值失败,override 写入被吞掉。

### v0.37.1 CSS 加粉色(顺利)

```css
/* css/apps/chat/index.css */
.app-shell[data-app-id="chat"][data-chat-mode="story"] .app-topbar-title {
    color: #FF4F8B;
}
```

颜色成功生效,但标题文字仍是 "消息"。→ 进入 v0.37.2 排查。

### v0.37.2 文字没变 —— 命中 framework 的 v0.28 防泄漏短路

**第一次 JS 尝试**:

```js
// js/apps/chat-app/index.js
function syncHeaderActionsWithMode() {
    const mode = getChatRecordMode();
    const titleOverride = mode === 'story' ? 'Dream' : '消息';
    ref.value = Object.assign({}, ref.value || {}, {
        headerActions: buildMessagesHeaderActions(),
        title: titleOverride,
    });
}
```

逻辑上看是对的 —— 写到 `__appTopbarOverride` → framework 的 `activeAppTopbar` computed 合并 → 推到 DOM。但**实际跑下来标题纹丝不动**。

看 `use-app-navigation.js:183-187` 才发现根本原因:

```js
// ★ v0.28 fix:如果 page 自身已声明 headerActions，不应用 override
//   （contacts/new-chat 等页面有自己的 topbar，不想被 messages 的 mode-toggle 按钮污染）
if (base && base.headerActions && base.headerActions.length > 0) {
    return base;  // ← 命中这里,override 完全被忽略
}
return { ...(base || {}), ...ov };
```

**`messages` tab 的 page-level `topbar.headerActions` 是有值的**(NAV_TABS.messages.topbar.headerActions = buildMessagesHeaderActions()),所以 v0.28 fix 直接 return base,**完全不合并 override**,包括我刚塞进去的 `title: 'Dream'`。

**v0.28 fix 的初衷是「防 mode-toggle 按钮泄漏到其他页面」,但副作用是「title 字段也透不出来」**。

### v0.37.3 修 framework 的 computed —— 区分 headerActions 和其他字段

```js
// js/framework/use-app-navigation.js
if (base && base.headerActions && base.headerActions.length > 0) {
    // ★ v0.37 区分:忽略 headerActions(防泄漏),但合并其他字段(允许 title 覆盖)
    const { headerActions: _ignored, ...restOverride } = ov;
    return { ...(base || {}), ...restOverride };
}
```

改完后 JS 侧同步 override 应该透得过去。**但用户反馈「Dream 仍然不显示」** —— 控制台炸了真正的 ReferenceError(见下)。

### v0.37.4 framework `switchRootPage` 调不存在函数 `buildMessagesHeaderActions()` —— ReferenceError 真凶

控制台日志:

```
[chat-app] toggleRecordMode CALLED, this.toolkit? true this.methods? Array(6)
[chat-app] toggleChatRecordMode returned: story
...
vue.global.prod.js:5 ReferenceError: buildMessagesHeaderActions is not defined
    at Proxy.switchRootPage (use-app-navigation.js:531:56)
```

**根因**:use-app-navigation.js 第 530-532 行写的是:

```js
// 切换回 messages tab 时立即恢复 override（保证切回来立即显示正确的 mode-toggle 按钮）
if (pageId === 'messages' && prevPageId !== 'messages') {
    appTopbarOverride.value = { headerActions: buildMessagesHeaderActions() };
}
```

但 `buildMessagesHeaderActions` 是 `chat-app/index.js` 的顶层函数,**framework 不可能看到它**。这段代码是 v0.28 fix 时的「占位/伪代码」,**从来就没有真正工作过** —— 只是当时没人触发这条路径(切到 messages tab 同时 prev 不等于 messages 的场景),就一直没炸。

今天用户在 chat-app 多次切 tab(contacts → messages → contacts → messages ...)终于触发,ReferenceError 抛出后 `appTopbarOverride.value = ...` 整个赋值表达式中断,**override 没拿到正确值** → title 推不到 DOM。

### v0.37.5 修复方案 —— 删 framework 端的硬编码,改派发通用事件

**原则**:framework 不该直接调具体 app 的内部函数(AGENTS.md §16.4)。改成:

1. **删 framework 端调 `buildMessagesHeaderActions()` 的代码**(本来就不该存在)
2. **framework 派发 `app:rootpage-changed` 通用事件**,由具体 app 订阅
3. **chat-app 监听事件**,切到 messages 时自己同步 override

#### 改动 1 — `js/framework/use-app-navigation.js`

```js
function switchRootPage(pageId) {
    // ... 原有逻辑 ...
    if (prevPageId === 'messages' && pageId !== 'messages') {
        appTopbarOverride.value = null;
    }
    // ★ v0.37 删除 buildMessagesHeaderActions() 的错误调用,改为派发通用事件
    try {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('app:rootpage-changed', {
                detail: { from: prevPageId, to: pageId, appId: activeApp.value?.id },
            }));
        }
    } catch (_) {}
}
```

同时把 `activeAppTopbar` computed 的 v0.28 短路分支改造成「只忽略 headerActions,合并其他字段」:

```js
if (base && base.headerActions && base.headerActions.length > 0) {
    const { headerActions: _ignored, ...restOverride } = ov;
    return { ...(base || {}), ...restOverride };
}
```

#### 改动 2 — `js/apps/chat-app/index.js`

新增监听器 + 在 hydrate 里挂上:

```js
let _rootPageChangedListenerBound = false;
function bindRootPageChangedListener() {
    if (_rootPageChangedListenerBound || typeof window === 'undefined') return;
    _rootPageChangedListenerBound = true;
    window.addEventListener('app:rootpage-changed', (e) => {
        const { from, to, appId } = e?.detail || {};
        if (appId !== 'chat') return;
        if (to === 'messages') {
            try {
                syncHeaderActionsWithMode();  // 同步 override(title + headerActions)
            } catch (_) {}
        }
    });
}

// hydrate() 内
async hydrate() {
    try {
        bindShellModeListener();
        syncShellDataMode(getChatRecordMode());
        syncHeaderActionsWithMode();
        bindRootPageChangedListener();  // ★ v0.37 新增
    } catch (_) {}
}
```

### v0.37.6 「Dream」title 必须硬编码 default 「消息」

framework 的 `activeAppTitle` computed 是:

```js
const activeAppTitle = Vue.computed(() => activeAppTopbar.value?.title || activeApp.value?.name || '');
```

如果 calendar 模式下 override 传 `title: null`,merged 后 activeAppTopbar.value.title = null,**fallback 到 app.name = 'murmur'** —— 用户看到的是空字符串或 'murmur'。

**正确做法**:日历模式显式传 `title: '消息'`(硬编码默认),不要依赖 framework 的 fallback:

```js
const titleOverride = mode === 'story' ? 'Dream' : '消息';
```

### v0.37.7 完整流程图

**冷启动 story mode**:

```
打开 chat-app
  → openApp() 设 activeRootPageId='messages' (无事件)
  → renderPage 触发 hydrate()
    → bindShellModeListener + bindRootPageChangedListener
    → syncShellDataMode('story')  ← .app-shell[data-chat-mode='story']
    → syncHeaderActionsWithMode() ← __appTopbarOverride = { headerActions, title: 'Dream' }
  → activeAppTopbar computed 重算:
    base.headerActions.length > 0 → 走新分支 → { ...base, ...restOverride }
    → title: 'Dream' 覆盖 base.title ✓
  → DOM: "Dream" + 粉色按钮 ✓
```

**切换到通讯录再切回**:

```
click contacts → framework.switchRootPage('contacts')
  → prevPageId='messages' → appTopbarOverride.value = null ✓ (v0.28 防泄漏)
  → 派发 app:rootpage-changed (from='messages', to='contacts')
    → chat-app 监听器跳过(只处理 to='messages')

click messages → framework.switchRootPage('messages')
  → prevPageId='contacts', to='messages' → appTopbarOverride 保持 null
  → 派发 app:rootpage-changed (from='contacts', to='messages')
    → chat-app 监听器捕获 → syncHeaderActionsWithMode() ✓
  → override 重新被填上(title + buttons),activeAppTopbar 重算,DOM 立刻变回 ✓
```

### v0.37.8 踩坑沉淀 — AGENTS.md §16.4 增补候选

1. **framework 不该直接调具体 app 的内部函数** —— 写「占位代码」时如果还没确定函数从哪来,就先留 TODO 注释,**不要硬编码一个注定 ReferenceError 的调用**
2. **v0.28 这种「防泄漏」的短路条件要尽量精确** —— 之前 `if (base.headerActions.length > 0) return base;` 把整个 override 都屏蔽了,改成 `if (base.headerActions.length > 0) { 忽略 override.headerActions,合并其他 }`,既保留了防泄漏语义,又允许其他字段透出
3. **fallback 链路不能依赖下游 Vue computed 的 `|| '默认值'`** —— 显式传默认值更可控,因为中间 computed 可能把 null 传上去再 fallback 到 app.name(语义错误)
4. **页面切到根 tab 时 framework 不派发「rootpage-changed」事件**(只走 `switchRootPage`)—— 首次打开 app 是 `openApp` 直接赋值,不走 `switchRootPage`。所以 **hydrate 时必须主动同步 override 一次**,否则首屏会闪一下默认标题再变成目标标题

---

#### 相关历史


这个 bug 在加 `chatMessages` store 之前就埋着了 —— 只要 baseStores 数量比磁盘版本号大,就会触发,只是以前用户在外部页面没注意(没进 settings)。**进 chat-app 之后第一次操作真实 db 直接踩爆**。

---

## A.0.10 detail 分支无限重渲循环（v0.38 2026-08-07）

### 现象

用户报告 `chat-app` 进入「发起群聊」(`new-group`)页面后,console 不停刷：

```
[bridge:debug] syncRenderer called - app: chat screenEl: true detailEl: true finalDetailEl: true detailPage: Proxy(Object) {id: 'new-group'}
```

每秒几十上百次,实际就是「死循环」(可能 1000+ 次 / 秒)。CPU 占用飙升,页面卡死,啥也点不动。

### 根因分析

bridge `syncRenderer` 监听 6 个 reactive 值(`currentPageView` / `currentDetailView` / `currentDetailPage` / `detailRenderTick` / `activeRootPageId` / `activeAppId`),任一变化都触发重渲。

`detailRenderTick` 是 chat-app 业务代码频繁 ++ 的 ref,目的就是「我改了数据,framework 该重画 detail 页」。设计看起来很合理 —— 但在 **hybrid + async detail renderer** 的 chat-app 上,每次 detail 的 `mountInto` 内部都 `await renderer(content, page, app)`;而 `renderer` 就是 `renderDetailPage`(async),`resolveAsyncRenderer` 在 promise resolve 时又 `detailRenderTick.value = Math.max(..., promisedTick)` ++ 一次 tick。

**循环回路**：

```
业务 ++tick
   ↓
watch 触发 syncRenderer
   ↓
detail 分支:detailKey 没变 → 跳过 mountInto(只读 detailKey 不看 tick 时)
   ↓
但如果 bridge 改成「detailKey 没变 + tick 变了 → 重渲」:
   ↓
enqueue mountInto (setTimeout 0)
   ↓
mountInto 内部 await renderer → renderer 内部 await SDK / 内部 ++tick → resolve 时再次 ++tick
   ↓
watch 再次触发 syncRenderer → 看到 tick 又变了 → 又 enqueue mountInto
   ↓
... 死循环
```

**v0.35 的部分修复不够彻底**:v0.35 在 `lastMountedKey.value` 写了 `detailTickVal`,但**写入时机是 enqueue 那一刻的 tick**,而 promise resolve 时又 ++tick 导致 lastKey 跟当前 tick **永远差 1**,每次 syncRenderer 都判 `tickChanged = true` → 永远 enqueue。

### 解决方案（v0.36 / v0.38）

**核心三件事**：

#### 1. inFlight 锁（`app-renderer-bridge.js`）

新增 `inFlightDetailMount` 计数器和 `pendingDetailMountId` ID 生成器：

```js
let pendingDetailMountId = 0;
let inFlightDetailMount = 0; // 0 = 无 in-flight;非 0 = 当前正在执行的 mountId
```

- detail 分支 enqueue 时分配 `myMountId = ++pendingDetailMountId`,记录 `inFlightDetailMount = myMountId`
- `mountInto` 跑完 finally 里释放锁:`if (inFlightDetailMount === myMountId) inFlightDetailMount = 0`
- syncRenderer 看到 `inFlightDetailMount > 0` 时直接跳过 detail 分支(`needDetailRemount = false`),**不再 enqueue 第二次**

#### 2. lastKey 写入移到 mountInto promise 完成之后

enqueue 时**只记录当前 tick**(防止其它 syncRenderer 抢先 enqueue);`finally` 里再把 lastKey 更新到「最新 tick」。这样后续 syncRenderer 看到 lastKey 跟当前 tick 一致,自然跳过。

```js
// enqueue 时
lastMountedKey.value = { ..., detailTickVal: tickVal };
pendingTickHandle = setTimeout(() => {
    (async () => {
        try { await mountInto(...); }
        finally {
            if (inFlightDetailMount === myMountId) inFlightDetailMount = 0;
            const newTick = detailRenderTick?.value ?? tickVal;
            lastMountedKey.value = { ...lastMountedKey.value, detailTickVal: newTick };
        }
    })();
}, 0);
```

#### 3. syncRenderer 支持 `force` 选项

`window.__appRendererBridge.syncNow({ force: true })` 强制重画当前 detail page,**忽略 inFlight 和 tick 比较**。SDK ready 后业务想强制刷新就用这个,而不是 ++tick。

#### 4. 业务代码不再 ++tick,改用 `syncNow({ force: true })`

| 位置 | 改动 |
|---|---|
| `js/apps/chat-app/index.js` 的 `initNewGroupPageInteractions` | `settings-sdk-ready` handler 里的 `__detailRenderTick.value++` → `window.__appRendererBridge.syncNow({ force: true })` |
| `js/apps/chat-app/pages/new-group-page.js` 的 `ret.then(() => ++tick)` | 改成 `ret.then(() => window.__appRendererBridge.syncNow({ force: true }))` |

#### 5. 顺手清理

`js/framework/use-app-navigation.js` 里 `resolveAsyncRenderer` 加的临时 debug warn 撤回;`bridge.js` 里的 `console.log('[bridge] syncRenderer', ...)` 保持 `window.__APP_RENDERER_BRIDGE_DEBUG__` 开关。

### 修复后效果

- 进入 `new-group` 页:enqueue 一次 mountInto → 跑 promise → ++tick 一次 → 触发 watch → syncRenderer 重跑 → 看到 inFlight=1 → **跳过** → mountInto 跑完 finally → 释放锁 + 写新 tick → 后续 syncRenderer 看到 tick 一致 → 跳过 → **结束**
- 日志里 `[bridge:debug] syncRenderer called` 在 detail page 切换/SDK ready 时各出现 1-2 次后停止,**不再刷屏**

### 沉淀(写进 AGENTS.md)

#### hybrid 模式下 detail 异步 renderer 的 lastKey 必须记「完成时 tick」,不能记「enqueue 时 tick」

v0.35 的错误写法把 lastKey 写在 enqueue 那一行:

```js
// 错:enqueue 写 lastKey 时,tick 是「此刻」的
pendingTickHandle = setTimeout(() => mountInto(...), 0);
lastMountedKey.value = { detailTickVal: tickVal }; // ← tickVal 是 enqueue 时的
```

mountInto 内部 promise resolve 时 ++tick(`tickVal+1`),bridge 收到 watch 触发 → 看到 lastKey.detailTickVal(=tickVal) != 当前 tickVal+1 → 又 enqueue。**死循环**。

正确写法: enqueue 时**先不写 lastKey**(或写 placeholder),mountInto promise **完成后再**把 lastKey 更新到「最新 tick」。这样下次 syncRenderer 看到 lastKey 跟当前 tick 一致,自然跳过。

#### inFlight 锁防「同一 detailKey + tickVal」被同时多次 mountInto

mountInto 是 async + 内部有副作用(set innerHTML + 创建 Vue apps + await nextTick),**不能并发跑同一个 detailKey**。bridge 用 `pendingDetailMountId` 单调递增 ID + `inFlightDetailMount` 当前 ID,enqueue 时 set,完成时清,**严格按 ID 校验避免老 mountInto 的 finally 误清新 ID 的锁**。

#### 业务代码需要「强制重画」应该走 `bridge.syncNow({ force: true })`,不是 `++tick`

`++tick` 跟 bridge 的 mountInto 异步性 + resolveAsyncRenderer 的 cache write + tick++ 形成循环回路,基本是「死循环最大风险」。force 选项是 bridge 提供的「明知要重画就重画,跳过所有 inFlight / tick 比较」的逃生口,业务层调用零风险。

### 涉及的代码 diff

```diff
# js/framework/app-renderer-bridge.js
+ let pendingDetailMountId = 0;
+ let inFlightDetailMount = 0;

  // detail 分支
+ const detailMountInFlight = inFlightDetailMount > 0;
+ const needDetailRemount = (force || detailChanged || tickChanged) && !detailMountInFlight;
  if (needDetailRemount) {
+     const myMountId = ++pendingDetailMountId;
+     inFlightDetailMount = myMountId;
      pendingTickHandle = setTimeout(() => {
+         (async () => {
+             try { await mountInto(...); }
+             finally {
+                 if (inFlightDetailMount === myMountId) inFlightDetailMount = 0;
+                 lastMountedKey.value = { ...lastMountedKey.value, detailTickVal: detailRenderTick?.value };
+             }
+         })();
      }, 0);
+     // enqueue 时同步写 lastKey,记录「此刻 tick」防止别的 syncRenderer 抢先 enqueue
+     lastMountedKey.value = { ...lastMountedKey.value, detailKey, detailTickVal: tickVal };
  }

# js/apps/chat-app/index.js (initNewGroupPageInteractions)
- window.__detailRenderTick.value++;
+ window.__appRendererBridge.syncNow({ force: true });

# js/apps/chat-app/pages/new-group-page.js (ret.then)
- window.__detailRenderTick.value++;
+ window.__appRendererBridge.syncNow({ force: true });
```

---

## A.0.11 「发起群聊」两个连锁 Bug（v0.39 2026-08-07）

v0.38 修完死循环后,用户进 `new-group` 页面发现两个新症状。先后排查、一次性收尾。

### 症状 1：`new-group` 一直显示「当前世界观下还没有可用的 AI 人设」

进入 `messages` tab → 点 `+` → 选 `calendar` mode → 进 `new-chat` 页**能看到 2 个 AI 人设**(`啊对对对` / `啊`)→ 点「发起群聊」按钮 → 跳到 `new-group` 页 → **空状态**：

```
当前世界观下还没有可用的 AI 人设
```

而此时 SDK 已经就绪(同会话的 `new-chat` 页面就能拉到 AI),理论上群聊页应该看到同一份名单。

### 症状 2:AI 列表出来后,pill 点了没反应

修完症状 1 后(详见下文),`new-group` 页能渲染出 AI pill(`默认 AI干活` / `默认 AI会`),但点击任意 pill 都**没有任何视觉变化**,已选徽标 `✓` 不出现、「下一步」按钮一直 disabled。

### 根因分析

#### 症状 1 根因:`renderNewGroupPage` 同步返回 + 后置 `syncNow` 是「死循环修复」留下的副作用

时间线:

```
v0.33  引入 new-group 页,renderNewGroupPage 是 sync,内部调 async getWorldAiPersons()
       ↓
       旧代码看到 Promise 就 .then(() => ++tick) 想「等拿到数据后再触发重画」
       ↓
v0.36  ++tick 在 hybrid+async renderer 组合下触发 detail 死循环(详见 §A.0.10)
       ↓
v0.38  「死循环」修复:业务 ++tick 全部改成 bridge.syncNow({ force: true })
       ↓
       副作用来了:bridge.syncNow({ force: true }) 重新走 mountInto →
       mountInto 内部 await renderer → renderer 内部调 renderNewGroupPage →
       renderNewGroupPage 还是 sync 函数,再次同步返回「空 grid HTML」
       (它没 await getWorldAiPersons(),Promise 被吞进 .then,根本没用上)
       ↓
       mountInto 拿到空 grid HTML,innerHTML = 空 grid → 页面**永远卡在空状态**
```

**关键诊断台词**:`bridge.syncNow({ force: true })` 不是「重新跑 async renderer」的银弹 —— 它只强制重画,**但**重画调到的那个 sync 函数如果还是同步返回空 HTML,Vue 的 `v-html` 拿到的就是空 HTML,DOM 还是空。

`new-chat` 页面为什么没这问题:它在 `renderDetailPage` 里写的是 `html = await renderNewChatPageAsync(app)`,直接走 framework 的 `resolveAsyncRenderer` 异步管线(loading HTML → cache write + tick++ → Vue 重算命中 cache 返回真 HTML)。`new-group` 没有这层 async 包装。

#### 症状 2 根因:`data-app-action` 的 JSON 把字段放错位置

`new-group-page.js` 里三个动作的 action 属性都把入参字段(`aiPersonId` / `mode`)直接塞在顶层:

```html
<!-- ❌ 错的:aiPersonId 在顶层 -->
data-app-action='{"action":"appMethod","appId":"chat","method":"toggleNewGroupAi","aiPersonId":"ai0"}'
data-app-action='{"action":"appMethod","appId":"chat","method":"pickNewGroupMode","mode":"calendar"}'
```

但 methods 读的是 `payload?.aiPersonId` / `payload?.mode`(对照 §A.0.x new-chat 的 `pickContactForMode` 写法,字段都在 `payload` 里)。结果:`payload?.aiPersonId` 永远 `undefined`,方法第一行 `if (!aiPersonId) return null;` 就直接 return,UI 完全没变化。

**对比 `new-chat` 的正确写法**(在 `new-chat-page.js:150-167`):

```js
const action = JSON.stringify({
    action: 'appMethod',
    appId: 'chat',
    method: 'pickContactForMode',
    payload: {  // ← 字段必须在 payload 里
        aiPersonId: contact.id,
        addedInMode: !!contact.addedInMode,
        ...
    },
});
```

### 修复方案

**症状 1:把 `renderNewGroupPage` 拆成 sync + async,跟 `new-chat` 同款异步渲染管线。**

```js
// js/apps/chat-app/pages/new-group-page.js (新结构)

// sync 部分:只负责拼 HTML,aiList 由调用方传入
export function renderNewGroupPage(app, options = {}) {
    const aiList = Array.isArray(options.aiList) ? options.aiList : [];
    // ... 拼 HTML(空 aiList → 走空状态分支)
}

// async 部分:真正 await SDK 拉数据,再调 sync 渲染
export async function renderNewGroupPageAsync(app, options = {}) {
    let aiList = [];
    try {
        const getter = window.__chatAppInternal?.getWorldAiPersons
            || (await import('./new-chat-page.js')).getWorldAiPersons;
        if (typeof getter === 'function') aiList = await getter();
    } catch (err) {
        console.warn('[new-group-page] load ai list failed', err);
    }
    return renderNewGroupPage(app, { ...options, aiList });
}
```

chat-app 入口侧:

```js
// js/apps/chat-app/index.js (renderDetailPage new-group 分支)
} else if (pageId === 'new-group') {
    // ★ v0.39:跟 new-chat 一样先 bootstrap SDK,再 await async renderer
    if (!window.settingsSdk) {
        try {
            if (typeof window.whenSettingsSdkReady === 'function') {
                await window.whenSettingsSdkReady(3000);
            } else {
                await bootstrapSettingsSdk({ toolkit: app?.toolkit });
            }
            try { saveSnapshot(getSettingsSdk()); } catch (_) {}
        } catch (err) { console.warn('[chat-app] new-group bootstrap failed:', err); }
    }
    html = await renderNewGroupPageAsync(app, options);
    queueMicrotask(() => app?.methods?.initNewGroupPageInteractions?.()); // 现在是 no-op
}
```

这样 framework 的 `resolveAsyncRenderer`(详见 `js/framework/use-app-navigation.js:39-103`)会按异步渲染管线处理:

```
renderDetailPage 返回 Promise
 ↓
resolveAsyncRenderer 看到 .then,先写 loadingHtml 进 cache (tick=N)
 ↓
Promise resolve(拿到 aiList,renderNewGroupPageAsync 返回真实 HTML)
 ↓
cache.set(cacheKey, { tick: N+1, html: 真实HTML })
 ↓
detailRenderTick.value = max(., N+1)
 ↓
watch 触发 syncRenderer → bridge.syncNow → mountInto
 ↓
mountInto 内部 await renderer → renderer 返回真实 HTML(已 cache 命中)
 ↓
innerHTML = 真实 HTML → DOM 显示 AI 列表 ✓
```

**症状 2:把 `data-app-action` 的字段塞到 `payload` 里。**

```js
// js/apps/chat-app/pages/new-group-page.js (三个动作全部修正)
data-app-action='{"action":"appMethod","appId":"chat","method":"toggleNewGroupAi","payload":{"aiPersonId":"${escapeHtml(ai.id)}"}}'

data-app-action='{"action":"appMethod","appId":"chat","method":"pickNewGroupMode","payload":{"mode":"calendar"}}'

data-app-action='{"action":"appMethod","appId":"chat","method":"pickNewGroupMode","payload":{"mode":"story"}}'
```

### 顺手清理

- `initNewGroupPageInteractions()` 整个监听 `settings-sdk-ready` + 触发 `bridge.syncNow({ force: true })` 的逻辑全部删除 —— SDK bootstrap 已挪到 `renderDetailPage` 的 `await whenSettingsSdkReady`,函数体改成 no-op stub(保留方法名避免外部调用报错)。

### 沉淀(写进 AGENTS.md §A.0.11 候选)

#### 1. async 数据驱动的 detail 页,renderer 必须 `async` 并 `await` SDK,不能「sync 拼空壳 + 后置刷新」

- framework 的 `resolveAsyncRenderer` **只在 renderer 返回 Promise 时**才走「loading → cache → tick → 重算命中 cache」管线
- 如果 renderer 是 sync(哪怕内部 `.then(() => syncNow({ force: true }))` 想补救),framework 拿到的就是 sync 返回的空 HTML,直接写进 cache + DOM,**没有任何机会再回来重画**
- 「sync 渲染 + bridge.syncNow 后置刷新」这条路径只在 framework 不感知数据依赖时偶尔能用(比如 island 内部的 reactive ref),**绝不能用于页面级首屏渲染**

#### 2. `data-app-action` 的所有字段都必须走 `payload`,不能直接放在顶层

- `actions.js:createAppMethodAction(method, payload, appId)` 的契约就是「method + payload」,framework 派发时 `externalAppRegistry.invokeMethod(appId, methodName, payload)`
- methods 内部读 `payload?.xxx` 是统一约定 —— 谁违反谁踩坑
- **诊断台词**:「按钮 / chip / attachment 点了没反应,但 data-app-action 看着对」→ 立刻 JSON.parse 这个属性,看字段是不是漏了 `payload` 包裹层

#### 3. bridge.syncNow({ force: true }) 不是「重跑 async 数据」的银弹

- `syncNow({ force: true })` 只强制 `syncRenderer` 重新走 `mountInto`,**不**会等任何 Promise
- `mountInto` 内部 `await renderer(...)` 时,如果 renderer 是 sync 函数、返回的是空 HTML,结果就是「强制把空 HTML 写进 innerHTML」
- 业务需要「拿到数据后强制重画」,正确做法是 `await fetchData(); window.__detailRenderTick.value++;` 或直接走 `renderDetailPage` 的 async 路径,而不是 `syncNow({ force: true })`

### 涉及的代码 diff

```diff
# js/apps/chat-app/pages/new-group-page.js
# 把 AI 拉取 + 后置 .then(syncNow) 全部从 renderNewGroupPage 里拆出去
- export function renderNewGroupPage(app, options = {}) {
-     let aiList = [];
-     try {
-         const { getWorldAiPersons } = window.__chatAppInternal || {};
-         if (typeof getWorldAiPersons === 'function') {
-             const ret = getWorldAiPersons();
-             if (ret && typeof ret.then === 'function') {
-                 ret.then(() => window.__appRendererBridge?.syncNow?.({ force: true }))
-                     .catch(err => console.warn(...));
-             } else if (Array.isArray(ret)) {
-                 aiList = ret;
-             }
-         }
-     } catch (err) { console.warn(...); }
-     // ... render empty grid HTML
- }
+ export function renderNewGroupPage(app, options = {}) {
+     const aiList = Array.isArray(options.aiList) ? options.aiList : [];
+     // ... render(aiList 进入 grid,空 → 空状态分支)
+ }
+
+ export async function renderNewGroupPageAsync(app, options = {}) {
+     let aiList = [];
+     try {
+         const getter = window.__chatAppInternal?.getWorldAiPersons
+             || (await import('./new-chat-page.js')).getWorldAiPersons;
+         if (typeof getter === 'function') aiList = await getter();
+     } catch (err) { console.warn('[new-group-page] load ai list failed', err); }
+     return renderNewGroupPage(app, { ...options, aiList });
+ }

# data-app-action 三个动作字段全部包进 payload
- data-app-action='{"action":"appMethod","method":"toggleNewGroupAi","aiPersonId":"${ai.id}"}'
+ data-app-action='{"action":"appMethod","method":"toggleNewGroupAi","payload":{"aiPersonId":"${ai.id}"}}'
- data-app-action='{"action":"appMethod","method":"pickNewGroupMode","mode":"calendar"}'
+ data-app-action='{"action":"appMethod","method":"pickNewGroupMode","payload":{"mode":"calendar"}}'
- data-app-action='{"action":"appMethod","method":"pickNewGroupMode","mode":"story"}'
+ data-app-action='{"action":"appMethod","method":"pickNewGroupMode","payload":{"mode":"story"}}'

# js/apps/chat-app/index.js
# import 加上 renderNewGroupPageAsync
- import { renderNewGroupPage } from './pages/new-group-page.js';
+ import { renderNewGroupPage, renderNewGroupPageAsync } from './pages/new-group-page.js';

# renderDetailPage new-group 分支:跟 new-chat 同款先 bootstrap + await async renderer
} else if (pageId === 'new-group') {
-     html = renderNewGroupPage(app, options);
+     if (!window.settingsSdk) {
+         try {
+             if (typeof window.whenSettingsSdkReady === 'function') {
+                 await window.whenSettingsSdkReady(3000);
+             } else {
+                 await bootstrapSettingsSdk({ toolkit: app?.toolkit });
+             }
+             try { saveSnapshot(getSettingsSdk()); } catch (_) {}
+         } catch (err) { console.warn('[chat-app] new-group bootstrap failed:', err); }
+     }
+     html = await renderNewGroupPageAsync(app, options);
      queueMicrotask(() => app?.methods?.initNewGroupPageInteractions?.());
}

# initNewGroupPageInteractions 整体简化成 no-op(SDK bootstrap 已挪走)
  initNewGroupPageInteractions() {
-     if (window.__chatNewGroupInteractionsBound) return;
-     const page = document.querySelector('.app-shell[data-app-id="chat"] .new-group-page');
-     if (!page) return;
-     window.__chatNewGroupInteractionsBound = true;
-     if (!window.settingsSdk) {
-         const handler = () => {
-             window.removeEventListener('settings-sdk-ready', handler);
-             window.__chatNewGroupInteractionsBound = false;
-             try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
-         };
-         window.addEventListener('settings-sdk-ready', handler, { once: true });
-     }
+     // no-op:SDK 已在 renderDetailPage 里 await 完成,无需再监听
  },
```

### 修复后效果

- 进入 `new-group` 页:loading HTML(几十毫秒)→ Promise resolve(SDK 数据就绪)→ 真实 HTML(AI 列表渲染)→ 用户点 pill → `toggleNewGroupAi` 接收到正确 `payload.aiPersonId` → `__detailRenderTick.value++` → 框架重画 → pill 出现 `is-selected` 样式 + `✓` 徽标 ✓
- 选满 2 个 AI → 「下一步」按钮变 enabled → 选 mode → 创建群聊走 `sdk.chatGroups.create`,详见 §A.0.x 群聊创建链路
- console 不再刷屏,`initNewGroupPageInteractions` 不再监听 `settings-sdk-ready`,启动顺序由 `renderDetailPage` 显式 await 接管

---

## v0.43 消息操作组 — 复制 / 编辑 / 引用 / 收藏 / 删除 / 转发(2026-08-07 11:30)

### v0.43.1 目标

把私聊消息气泡的「点开看到操作按钮」做完,共 7 个动作 + 多选 bar:

| 类别 | 动作 | 实现 |
|---|---|---|
| 单条 | 复制 | `copyMessage` |
| 单条 | 编辑 | `editMessage` → `chatModalManager.openMessageEdit` |
| 单条 | 引用回复 | `quoteMessage` / `cancelReply`(写 `app.state.chat.action.replyingTo`)|
| 单条 | 收藏 | `favoriteMessage`(真实写 `sdk.chatFavorites`)|
| 单条 | 删除 | `deleteMessage`(真实删 `sdk.chatMessages` + 联动清收藏)|
| 单条 | 转发 | `forwardMessage`(弹 `ForwardTargetModal` + 写目标会话)|
| 单条 | 撤回 | **本次不做**(v0.43 留 placeholder `disabled`)|
| 多选 | 进入多选 | `enterMultiSelect` |
| 多选 | 取消多选 | `exitMultiSelect` |
| 多选 | 切选中 | `toggleMessageSelect` |
| 多选 | 批量收藏 | `favoriteMulti` |
| 多选 | 批量转发 | `forwardMulti` |
| 多选 | 批量删除 | `deleteMulti` |
| 顶栏 | 语音通话 | `triggerVoiceCall` → `call-{ai}-{mode}-voice` |
| 顶栏 | 视频通话 | `triggerVideoCall` → `call-{ai}-{mode}-video` |

### v0.43.2 持久化层 — `chatFavorites` SDK

单条收藏不能塞 `chatMessages` 表(消息可能被删),所以新增独立表:

| 文件 | 改动 |
|---|---|
| `js/apps/setting/world/sdk/chat-favorites.js` | **新增** — `createChatFavoritesApi`(`list/get/has/add/remove/removeAllForConversation/count/hydrate`)|
| `js/apps/setting/world/sdk/settings-sdk.js` | 注册 `sdk.chatFavorites` + 在 `cache` 加 `chatFavorites: new Map()` |
| `js/apps/setting/world/sdk/bootstrap.js` | `await sdk.chatFavorites.hydrate()` |
| `js/apps/setting/world/sdk/defaults.js` | `chatFavorites: 'sdkChatFavorites'` 加进 `SDK_STORES` |

API 签名(4 参数,**user 是第一个**):

```js
sdk.chatFavorites.has(user, aiPersonId, mode, messageId) // boolean
sdk.chatFavorites.add(user, aiPersonId, mode, messageObj, { contactName, messageType }) // Promise
sdk.chatFavorites.remove(user, aiPersonId, mode, messageId) // Promise<boolean>
sdk.chatFavorites.list(user) // Array
```

### v0.43.3 弹窗复用 — `MessageEditModal`

**复用策略**:不写新弹窗样式,直接仿 `AiRemarkModal` 的 textarea + 保存/取消结构。

| 文件 | 改动 |
|---|---|
| `js/apps/chat-app/components/chat-modal-components.js` | 新增 `MessageEditModal` 组件(props: `originalText / senderLabel / messageType / editable`,emits: `onSave / onClose`)|
| `js/apps/chat-app/components/chat-modal-registry.js` | 注册 `openMessageEdit` 方法,派发到 `MessageEditModal` |

### v0.43.4 消息操作按钮全面 data-app-action

**所有 v-html 输出的按钮统一走 `data-app-action`,framework 顶层 click 委托**,不再用 `addEventListener` 绑。

| 文件 | 改动 |
|---|---|
| `components/message-actions.js` | `renderMessageActions` 改用 `data-app-action`,按钮 = 复制 / 编辑 / 引用 / 收藏 / 删除 / 转发。删 share-weibo / reroll / recall(改为 disabled 占位)。`renderSelectButton` 走 `toggleMessageSelect` |
| `components/text-bubble.js` | wrapper 加 `data-msg-ai` / `data-msg-mode` 给多选用;透传 `aiPersonId/mode` 给 actions |
| `components/card-messages.js` | 通话记录 wrapper 加 `data-msg-ai/data-msg-mode`;收藏/删除按钮走 `data-app-action` |
| `components/share-cards.js` | wrapper 加 `data-msg-ai/data-msg-mode`;位置 / 红包 / 转账 / 聊天记录都透传 options |
| `components/special-messages.js` | 语音 wrapper 加 `data-msg-ai/data-msg-mode`;语音转文字 toggle 走 `data-app-action` |
| `pages/chat-page.js` | `renderMessageList` 透传 `aiPersonId/mode`;`multi-select-bar` 4 个按钮 + 顶栏 3 个按钮全部 `data-app-action`;**reply-preview 改成动态 HTML**,根据 `app.state.chat.action.replyingTo` 显示/隐藏 + 真实文本 |

### v0.43.5 状态层 — `app.state.chat.action`

新增 3 个字段 + 1 个 helper:

```js
app.state.chat.action = {
    replyingTo: { messageId, aiPersonId, mode, text, sender, senderLabel, createdAt } | null,
    selectedMessages: Set<'{aiPersonId}::{mode}::{messageId}'>,
    multiSelectActive: false,
};
```

- `_ensureChatActionState(app)` — 兜底初始化,把 `selectedMessages` 强制成 `Set`
- `_triggerChatActionRerender()` — `__detailRenderTick.value++`(v0.38 后**禁止业务代码用 ++tick**,但本助手特别留逃生口;实际上整个 chat-action 状态靠 framework 重画 detail 页来同步 DOM,只在第一次写好后用 ++ 即可)
- `_refreshMultiSelectUI()` — 因为 v-html 不响应 Set 变化,手动改 DOM:`.multi-select-count` 的 `<strong>` 文本、`.chat-private.multi-select-mode` class、单条消息 wrapper 的 `.is-selected` class

### v0.43.6 引用回复(replyTo)写入

`doSend` 在写消息前:

```js
const st = this._ensureChatActionState(this.app);
let replyTo = null;
if (st.replyingTo && st.replyingTo.aiPersonId === aiPersonId && st.replyingTo.mode === mode) {
    replyTo = { ...st.replyingTo };
    st.replyingTo = null;  // 发送后清空
}
const msg = { sender: 'user', senderName, type: 'text', content: text, timestamp: Date.now(), ...(replyTo ? { replyTo } : {}) };
```

`text-bubble.js` 的 `renderReplyQuote(msg.replyTo)` 已经能渲染结构化 replyTo 字段,不需要改。

### v0.43.7 SDK 调用签名修正(踩坑沉淀)

v0.43 第一次写 `editMessage` / `deleteMessage` 时把 SDK API 调错了。`chatMessages` SDK 实际签名:

| API | 真实签名 | 错误写法(已修) |
|---|---|---|
| `add` | `(user, aiPersonId, mode, msg)` | `add({ aiPersonId, mode, message })` |
| `list` | `(user, aiPersonId, mode)` | `list({ aiPersonId, mode })` |
| `update` | `(messageId, patch)` | `update({ messageId, patch })` |
| `remove` | `(messageId)` | `remove({ messageId })` |

**所有 SDK 的 user-dependent API 都是 4 参数(user 第一位)**,调用前必须 `sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.()` 拿到 user 再传。`sdk.chatMessages.add(null, ...)` **会写失败**(user 校验不过)。

### v0.43.8 改动文件清单

| 文件 | 类型 |
|---|---|
| `js/apps/chat-app/index.js` | +12 methods + state helpers + replyTo 写入 |
| `js/apps/chat-app/pages/chat-page.js` | reply-preview 动态渲染 + multi-select-count 动态 + chat-private class 动态 |
| `js/apps/chat-app/components/text-bubble.js` | wrapper 加 data-msg-* |
| `js/apps/chat-app/components/card-messages.js` | wrapper 加 data-msg-* |
| `js/apps/chat-app/components/share-cards.js` | wrapper 加 data-msg-* |
| `js/apps/chat-app/components/special-messages.js` | wrapper 加 data-msg-* |
| `js/apps/chat-app/components/message-actions.js` | (前几轮已改) data-app-action 化 |
| `js/apps/chat-app/components/chat-modal-components.js` | 新增 MessageEditModal |
| `js/apps/chat-app/components/chat-modal-registry.js` | 新增 openMessageEdit |
| `js/apps/setting/world/sdk/chat-favorites.js` | **新增** 整文件 |
| `js/apps/setting/world/sdk/settings-sdk.js` | 注册 chatFavorites |
| `js/apps/setting/world/sdk/bootstrap.js` | hydrate chatFavorites |
| `js/apps/setting/world/sdk/defaults.js` | 加 SDK_STORES.chatFavorites |

### v0.43.9 验证清单

- [ ] 进任意私聊页,长按某条消息(或点开 actions 浮层)
- [ ] 复制 → 系统通知「已复制」,剪贴板有文本
- [ ] 编辑(仅自己发的可点) → 弹 MessageEditModal,改完保存 → 气泡更新
- [ ] 引用回复 → 输入框上方出现 reply-preview 含联系人名 + 原文片段 + × 按钮,点 × 取消
- [ ] 收藏 → 灵动岛提示「已收藏」,进收藏页(favorites tab)看到这条
- [ ] 删除 → 气泡消失,灵动岛「已删除」,如果之前收藏过,收藏页也跟着没了
- [ ] 转发 → 弹 ForwardTargetModal,选目标 → 目标会话里出现一条带 `forwardedFrom` 的消息
- [ ] 多选 → 点顶部多选按钮 → 进入多选模式 → 点消息左侧圆圈选中 → 底部 bar 显示「已选 N 条」,能批量 收藏 / 转发 / 删除
- [ ] 语音通话 → 跳到 `call-{ai}-{mode}-voice` 页(本期未实现 UI,留 detail 页骨架)
- [ ] 视频通话 → 同上

### v0.43.10 踩坑沉淀(写给下一轮 AI)

1. **SDK API 签名 user-dependent**:所有 sdk.chatMessages.* / sdk.chatFavorites.* / sdk.chatFriends.* / sdk.chatGroups.* 调用,**user 是第一个参数**,不是隐藏参数
2. **v-html + Set 状态**:`app.state.chat.action.selectedMessages` 这种 `Set` 数据 framework 反应式追踪不到变化,要么走 `__detailRenderTick.value++` 触发整页重画,要么 `_refreshMultiSelectUI()` 直接改 DOM class / textContent
3. **v-html wrapper 加 data-*** 给 DOM 查找用:text-bubble / share-cards / card-messages / special-messages 4 个文件 wrapper 全用 `data-message-id`,新加 `data-msg-ai / data-msg-mode` 一致;不要在 text-bubble 用 `data-msg-id` 跟其他 3 个错开
4. **replyTo 结构 vs SDK 字段**:SDK 存消息用 `content`(不是 `text`),text-bubble render 也读 `msg.content`,所以 `editMessage` patch 必须改 `content` 不是 `text`
5. **chat-page.js 的 `reply-preview` 静态骨架**先留着(`id="replyPreviewStatic"` 隐藏),逐步把状态接到 `renderPrivateChatPage(app, contactId)`,不要一口气重构整个 render 函数
6. **`copyMessage` 兼容老浏览器**:优先 `navigator.clipboard.writeText`,退化到临时 textarea + `document.execCommand('copy')`
7. **撤回按钮**:本期 v0.43 留 `disabled` 占位,等后续 v0.44 再做(需要 SDK 加 `recall` 字段支持 2 分钟内撤回窗口)
8. **整文件覆盖安全**:PowerShell `Set-Content -NoNewline` 会把所有换行符吃光,**严禁**用 shell 做大段重写;老老实实 `Read` → `Write` 或 `StrReplace` 多次

---

## v0.44 多选收藏 → 对话片段(2026-08-07 15:16)

### v0.44.1 目标

多选模式「收藏」按钮 ≥2 条消息时,形成「对话片段」收藏项;单独收藏(1 条)沿用 `sdk.chatFavorites` 的单条存储。

### v0.44.2 数据结构

对话片段(`type: 'conversation'`)存到 `app.state._conversationFavorites`(内存):

```js
{
  id: 'conv-' + Date.now(),      // ★ 用 id 而不是 favoriteId
  type: 'conversation',
  sourceType: 'private',
  sourceId: aiPersonId,
  sourceName: contactName,
  time: '今天 HH:mm',
  messageCount: N,
  messages: [{ id, sender, senderName, senderColor, type, content, time, ... }],
}
```

单条收藏(`sdk.chatFavorites`)用 `id: 'fav-{userId}-{aiId}-{mode}-{msgId}'`。

### v0.44.3 合并策略

```js
// index.js renderFavoritesPage 调用处
const conversationFavs = app.state._conversationFavorites || [];
const merged = [...conversationFavs, ...sdk.chatFavorites.list(user), ...DEMO_FAVORITES];

// favorites-page.js 渲染处
const getFavKey = f => f.id || f.favoriteId || '';
const seen = new Set(realFavorites.map(getFavKey));
```

### v0.44.4 踩坑记录

| 坑 | 根因 | 修复 |
|---|---|---|
| 多选后点收藏,页面显示「暂无对话片段收藏」 | `favoriteMulti` 错误地调用 `sdk.chatFavorites.add()`,但该 API 是存**单条消息**,不接受 `type:'conversation'` 结构 | 改存 `app.state._conversationFavorites`(内存) |
| 对话片段添加到收藏列表后,刷新收藏页列表仍是空 | `sdk.chatFavorites.list` 只能读出 `type!=='conversation'` 的单条记录 | 对话片段走独立存储,合并时用 `[...conversationFavs, ...realFavs]` |
| DOM 查询 `.message-wrapper.is-selected` 返回空 | `initPrivateChatInteractions` 实际加的 class 是 `selected` 不是 `is-selected` | 统一查询 `.message-wrapper.selected` |
| 对话片段渲染时展开状态追踪失效 | `renderFavoriteList` 里用 `item.favoriteId` 检查展开状态,但真实收藏用 `id` | 统一用 `getFavKey(item)` 获取唯一标识 |

### v0.44.5 改动文件

| 文件 | 改动 |
|---|---|
| `js/apps/chat-app/index.js` | `favoriteMulti` 重写,存到 `app.state._conversationFavorites`;合并逻辑 `conversationFavs` 放前面优先 |
| `js/apps/chat-app/pages/favorites-page.js` | `getFavKey` 统一 id/favoriteId;`renderConversationItem / renderFavoriteItem` 兼容;`renderFavoriteList` map 时用 `getFavKey` |

### v0.44.6 已知限制

- 对话片段存内存,刷新页面后丢失(需要后续 v0.45 持久化到 IndexedDB 独立表)
- 收藏页展开/折叠状态也存内存,刷新页面后恢复折叠

---

## v0.49 表情包发送闭环(2026-08-07 21:11)

### v0.49.1 目标

私聊输入框左边「笑脸」按钮 → 弹出表情包面板 → 选择表情 → 写入 IndexedDB → 渲染为气泡显示在聊天流。完整链路走通,所有真实数据,不依赖任何 demo 兜底。

### v0.49.2 涉及文件

| 文件 | 改动 |
|---|---|
| `js/apps/chat-app/components/emoji-picker-panel.js` | 新建。emoji 面板组件:`renderEmojiPickerPanel` + `_prerenderEmojiPicker` + `_fillEmojiPickerImages` + `_loadSource` + `_computeCacheKey` |
| `js/apps/chat-app/components/text-bubble.js` | 已存在的 `sticker` case 走 `msg.url`(这次没用上白名单字段,改 chatMessages SDK 后自动通) |
| `js/apps/chat-app/index.js` | `initPrivateChatInteractions` 加 sticker 点击处理;`pickEmojiForSend` 等 method |
| `js/apps/setting/world/sdk/chat-messages.js` | `add()` 白名单补 `url / imageUrl / stickerCode / thumbnail / metadata` + **透传未知字段机制** |

### v0.49.3 数据流

```
用户点击表情网格里的 .chat-emoji-cell[data-sticker-code]
   ↓
chat-app initPrivateChatInteractions 的 delegated click handler
   ↓
const url = await _loadSource(code)  ← 从 _findGroupPath + getGroupImages 拿 base64
   ↓
sdk.chatMessages.add(user, aiPersonId, mode, {
    id: 'sticker-${ts}',
    sender: 'user', senderName, type: 'sticker',
    content: '[表情]', url, stickerCode: code, timestamp: now,
})
   ↓
text-bubble.js 的 case 'sticker':
   contentHtml = `<img class="sticker-message" src="${escapeHtml(msg.url)}" ... />`
   ↓
DOM 渲染为 img(走 chatMessages 列表 → renderTextBubble 全链路)
```

### v0.49.4 踩坑沉淀(本次 v0.49 全程踩的两个致命坑)

#### 坑 1:`bridge.syncNow({force:true})` 在 hybrid 模式下不触发屏区重画

**现象**:用户打开 emoji 面板 → 看到「loading 占位」 → 永远卡在 loading,表情图片不出现。

**诊断过程**:
1. console 显示 `[emoji-picker] cache filled, key=grp_xxx size=1 triggering syncNow`,缓存确实填了
2. 但**第二次** `renderEmojiPickerPanel` **永远没被调用**(看不到 `cacheHit=true` 的 log)
3. v-html 没重画,屏区 DOM 还是 loading

**根因**:`js/framework/app-renderer-bridge.js` 的 `syncRenderer()` 在屏区分支:

```js
const needsRemount = !lastKey
    || lastKey.appId !== app.id
    || lastKey.pageKey !== pageKey
    || lastKey.mode !== mode
    || (mode !== 'template' && lastKey.tickVal !== tickVal);  // ← 只看 tick,不看 force
```

chat-app 是 **hybrid 模式**(`mode !== 'template'`),屏区 remount **只看 `lastKey.tickVal !== tickVal`**。`syncNow({force:true})` 只对 **detail 分支**生效(line 164 的 `force || detailChanged || tickChanged`),**屏区分支不看 force**。所以屏区不重画 → `renderChatPage` 不再跑 → `renderEmojiPickerPanel` 也不会再次被调用 → 永远是 loading HTML。

**修复**(`emoji-picker-panel.js` 的 `_prerenderEmojiPicker` 末尾):

```js
if (typeof window !== 'undefined') {
    if (window.__detailRenderTick && typeof window.__detailRenderTick.value === 'number') {
        window.__detailRenderTick.value++;  // ★ 屏区重画必须 ++tick
    }
    const bridge = window.__appRendererBridge;
    if (bridge && typeof bridge.syncNow === 'function') {
        try { bridge.syncNow({ force: true }); } catch (_) {}
    }
}
```

**为什么 ++tick 安全**:README v0.38 的死循环警告**只针对 async renderer**(chat-app 的 `renderDetailPage` 是 async,异步 await 后再 ++tick 会撞死循环)。但 **chat-app 的 `renderPage`(屏区)是 sync 函数**(`renderChatPage`),`++tick` 触发的 mountInto 立刻同步执行,不会撞。事实上 chat-app 内部代码**本来就有 27 处 `__detailRenderTick.value++` 调用**,都是安全的。

**预防清单**:
- 「缓存填了但 DOM 不重画」**先** grep `__detailRenderTick.value++` 看业务有没有触发重画
- `bridge.syncNow({force:true})` **只对 detail 分支有效**,屏区必须 `++tick`
- 业务加新 async 操作后填缓存,记住 **「填完 + ++tick」二件套**
- AGENTS.md §16.4 「业务 reactive ref → template」检查清单里要加一行:**屏区重画也需要 reactive trigger**,不只 detail 页

---

#### 坑 2:`chatMessages.add()` 字段白名单吞掉 `url` — sticker 渲染 `<img src="">`

**现象**:v0.49.4 修复后,emoji 面板正常显示图片。但**点击发送** → 聊天流出现一个**损坏气泡**,`src=""`,定位 `top=437px, left=398px, width=52px, height=18px`(52x18 是空 img 默认占位尺寸)。

**诊断过程**:
1. console 里 `[chatMessages.add] Saving record` 那段 JSON 完整 dump 出来
2. 看到 record 里**根本没有 `url` / `stickerCode` 字段**
3. 但发送代码明明传了 `{ url, stickerCode: code, ... }`

**根因**:`js/apps/setting/world/sdk/chat-messages.js` 的 `add()` 函数把 `msg` 字段**显式枚举**进 record:

```js
const record = {
    id, aiPersonId, mode, conversationType, conversationId,
    sender, senderId, senderName, type, content,
    chatRecord, replyTo, locationCard, redpacketCard, transferCard,
    voiceContent, voiceDuration, duration, imageDescription,
    cardColor, textColor, callRecord,  // ← 白名单到此为止
    timestamp, createdAt, updatedAt,
};
```

`url` / `imageUrl` / `stickerCode` / `thumbnail` / `metadata` **不在白名单里** → 被吞了。`text-bubble.js` 的 `case 'sticker'` 读 `msg.url` → 拿到空字符串 → 渲染 `<img src="">`。

**修复**(双保险):

```js
// 1) 白名单补漏
const RESERVED = new Set([
    'id', 'conversationType', 'conversationId', 'sender', 'senderId', 'senderName',
    'type', 'content', 'chatRecord', 'replyTo', 'locationCard', 'redpacketCard',
    'transferCard', 'voiceContent', 'voiceDuration', 'duration', 'imageDescription',
    'cardColor', 'textColor', 'callRecord',
    'url', 'imageUrl', 'stickerCode', 'thumbnail', 'metadata',  // ← v0.49.1 新增
    'timestamp',
]);

// 2) 透传未知字段(防以后再漏)
const passthrough = {};
for (const k of Object.keys(msg)) {
    if (!RESERVED.has(k)) passthrough[k] = msg[k];
}

const record = {
    /* 白名单字段 */
    ...passthrough,  // ← v0.49.1 新增
    timestamp, createdAt, updatedAt,
};
```

**为什么之前没踩**:历史上 message type 只有 `text / image / voice / location / redpacket / transfer / descriptive_image`,**没人写过 sticker**。`image` 类型的 url 在别处可能有特殊处理路径,或者之前从来没真正渲染过图片消息。

**预防清单**:
- **SDK 持久化函数有字段白名单 = 红色警报**:任何 `add(x, y, z, msg)` 函数如果用「显式解构赋值」拷字段,而不是 spread 或 for...in,**永远会漏新字段**
- 加新消息类型时,**先 grep `add(` 看 SDK 持久化层的白名单,确认新字段已加**
- 业务代码用 `JSON.stringify(record)` 验证持久化的 record 包含所有传入字段,这是最便宜的回归测试
- **透传机制是终极保险**:不要相信「白名单一定完整」,写代码时就透传所有未知字段,白名单只负责「核心字段的类型校验/默认值」
- AGENTS.md §16.4 候选新增:**「SDK 持久化层」清单** —— 所有 `add()` / `create()` / `update()` 函数,白名单必须**穷举**或**透传**,二选一

---

### v0.49.5 改动文件清单

| 文件 | 改动 |
|---|---|
| `js/apps/chat-app/components/emoji-picker-panel.js` | 新建。emoji 面板组件,含 `_prerenderEmojiPicker` + `renderEmojiPickerPanel` + `_fillEmojiPickerImages` + `_loadSource`;结尾触发 `++tick + bridge.syncNow({force:true})` |
| `js/apps/chat-app/components/text-bubble.js` | 无改动(已支持 sticker case) |
| `js/apps/chat-app/index.js` | `initPrivateChatInteractions` 加 sticker 点击处理 |
| `js/apps/setting/world/sdk/chat-messages.js` | `add()` 白名单补 `url / imageUrl / stickerCode / thumbnail / metadata` + 透传未知字段机制 |

### v0.49.6 验证清单

| 步骤 | 期望 | 结果 |
|---|---|---|
| 进任意私聊页 → 点笑脸 | emoji 面板弹出,显示「loading」占位几十 ms | ✅ |
| loading → 表情网格出现,带缩略图 | 网格里有真实表情图片(base64 内嵌) | ✅ |
| 点击某个表情 | 灵动岛「已发送表情」→ 聊天流出现气泡(带图片) | ✅ |
| 切出再切回该私聊 | sticker 气泡仍然显示 | ✅ |
| 切到日历视图模式 | sticker 历史消息全部还在 | ✅ |
| 刷新页面 | sticker 仍然持久化显示 | ✅ |
| 表情原图被删 → 重新发送 | 灵动岛警告「表情加载失败」 | (待验证) |

### v0.49.7 沉淀给下一轮 AI

1. **hybrid 模式下 bridge.syncNow 只对 detail 分支生效,屏区必须 ++tick**
   - 诊断台词:「缓存填了但 DOM 不重画」「v-html 不更新」**先** grep `__detailRenderTick.value++`
   - 检查清单:任何「异步数据填缓存后要触发 v-html 重画」的场景,**两个动作缺一不可**:++tick + bridge.syncNow

2. **SDK 持久化层的字段白名单是定时炸弹**
   - 不要相信「白名单一定完整」
   - 加新消息类型 → 先 grep SDK `add()` / `create()` / `update()` 看字段是否被白名单吞了
   - 终极解法:白名单兜底 + 透传未知字段

3. **「数据 → DOM」 的两步验证模式**
   - 第一步:JSON.stringify(record) 验证持久化层完整
   - 第二步:`document.querySelector('.chat-message img')` 看渲染出来的 DOM
   - 两步都过才算真的「数据到了 DOM」

4. **不要在 renderPage 内部抓 this**(历史沉淀,见 AGENTS.md §2.3 / §16.4)
   - emoji 面板的 `renderEmojiPickerPanel` 是模块顶层函数
   - 业务调用方只用传 `options`,不要 `this.xxx`

5. **bridge.syncNow({force:true}) 不等于「刷新整个 app」**
   - 它只对 detail 分支生效
   - 屏区想刷 → ++tick
   - 想刷全屏 → 先 ++tick 再 syncNow

---

## v0.49.8 AGENTS.md / 项目沉淀候选

1. **§16.4 「业务 reactive ref → template」检查清单** 增补:
   - **屏区(屏)重画也需要 reactive trigger**,不只 detail 页
   - `bridge.syncNow({force:true})` **只对 detail 分支有效**
   - 屏区想强制重画 → `window.__detailRenderTick.value++`(对 sync renderMode 安全,对 async renderMode 撞 v0.38 死循环)
   - **async renderMode(比如 chat-app 的 `renderDetailPage`)必须用 `bridge.syncNow({force:true})`,不能 ++tick**

2. **§6 「SDK 持久化层」新增小节**:
   - 所有 `add(x, y, z, msg)` / `create(msg)` / `update(id, patch)` 函数,**字段拷入 record 必须用「白名单 + 透传」二选一**
   - 不要用「显式解构赋值」,会漏字段
   - **加新消息类型 / 资源类型时,先 grep SDK add/create 看白名单**

3. **§16.4 「踩坑沉淀」** 增补:
   - 「缓存填了但 DOM 不重画」→ bridge.syncNow 只对 detail 分支生效,屏区必须 ++tick
   - 「持久化数据少了字段」→ SDK add() 字段白名单吞字段,加新类型必查 SDK 持久化层

---

## v0.61.7 prompt-manager「当前上下文」拖拽 / 启用按钮不生效连环坑（2026-08-08 07:36）

### v0.61.7.1 目标
让 prompt-manager 页面的「当前上下文」section 支持：
- 拖拽卡重新排序后**立即生效**(序号、pre 内容跟着变,不用按刷新)
- 「可用 Prompt」区里点启用 / 停用按钮,「当前上下文」区卡片**立即出现 / 消失**

### v0.61.7.2 用户视角的两个 bug

| Bug | 现象 | 触发路径 |
|---|---|---|
| **Bug-A** | 拖拽卡片释放后,序号 / 顺序 / pre 内容都不更新 | prompt-drag-controller `_onPointerUp` → `reorderContextPrompts` |
| **Bug-B** | 在「可用 Prompt」点启停 / 上移下移 / 删除 / 拉取 / 编辑,「当前上下文」区的卡片不增删 | toggleReplyPromptActive / moveReplyPromptUp / moveReplyPromptDown / deleteReplyPrompt / ... |

### v0.61.7.3 根因 — async detail renderer 缓存机制

framework 的 `resolveAsyncRenderer(appId, pageId, renderer, args)` 给 **async renderMode**(chat-app 的 `renderDetailPage` 是 async)做了一层缓存:

```js
// 缓存命中条件:cached.tick === currentTick(detailRenderTick.value)
// tick 不变 → 直接返回 cached.html → renderer 不再被调 → DOM 不重画
const cached = cache.get(cacheKey);
if (cached && cached.tick === currentTick) return cached.html;
```

**关键**:framework 把 `renderer(content, page, app)` 的返回值存在 module 级 Map,key 是 `${appId}::${pageId}`,value 是 `{ tick, html }`。

业务代码「想让当前 detail 重画」目前有两个 API:
| API | 是否真让 renderer 重跑 |
|---|---|
| `window.__detailRenderTick.value++` | **否**(async renderMode 下命中 cache,返回旧 html;sync renderMode 才有效)|
| `bridge.syncNow({force:true})` | **否**(force 只绕过 syncRenderer 决策,不会清 resolveAsyncRenderer 的 cache)|
| `window.invalidateRendererCache('chat', null)` + `bridge.syncNow({force:true})` | **是**(v0.61.7 才有的正解)|

### v0.61.7.4 完整诊断流程

**Step 1**:加 console.log 链路(每个函数都打 `BUG-A:xxx`),刷新后让用户拖一张卡 + 点 🔄。

**Step 2**:用户的 console 关键证据:
```
[BUG-A:drag._commitReorder] no dragState.container
```
—— `prompt-drag-controller.js` 的 `_commitReorder()` **从来就没拿到 ids**!

### v0.61.7.5 Bug-A 根因 — `_endDrag()` 把 `dragState.container` 清空

`_onPointerUp()` 写的是:
```js
// 错!
function _onPointerUp() {
    if (!dragState.active) return;
    const dragging = dragState.draggingCard;
    const placeholder = dragState.placeholder;
    if (dragging && placeholder && placeholder.parentNode) {
        placeholder.parentNode.insertBefore(dragging, placeholder);
    }
    _endDrag();         // ★ 这里把 dragState.container 清成 null
    _commitReorder();   // ★ 但这里读 dragState.container,永远拿到 null
}
```

`_endDrag()` 里:
```js
dragState.container = null; // 清空
```

所以 `_commitReorder()` 进函数后第一个 `if (!dragState.container) return` 立刻短路退出,**`reorderContextPrompts` 这个 method 根本没被调,state 没写,framework 自然不会重画,数字/preview 永远不变**。

**修复**:`_onPointerUp()` 必须在 `_endDrag()` **之前**缓存 container / root 到 local 变量,然后传给 `_commitReorder`:

```js
// 对
function _onPointerUp() {
    if (!dragState.active) return;
    const dragging = dragState.draggingCard;
    const placeholder = dragState.placeholder;
    if (dragging && placeholder && placeholder.parentNode) {
        placeholder.parentNode.insertBefore(dragging, placeholder);
    }
    // ★ 先缓存,再清状态
    let preCommitContainer = dragState.container;
    let preCommitRoot = dragState.root;
    if (!preCommitContainer && dragging) {
        preCommitContainer = dragging.parentNode; // 兜底反查
    }
    _endDrag();
    _commitReorder(preCommitContainer, preCommitRoot);
}
```

### v0.61.7.6 Bug-B 根因 — prompt-manager 各种 method 没 invalidate cache

修完 Bug-A 后,即使 `reorderContextPrompts` 被调、state 写入正确、`bridge.syncNow({force:true})` 也被调了,**DOM 还是不变**。因为 async detail renderer 的 cache 没清,`mountInto` 时 renderer 命中 cache 直接返回旧 html。

排查发现 chat-app 一堆 prompt-manager 相关 method **都没调 `invalidateRendererCache`**:

| Method | 原写法 | 问题 |
|---|---|---|
| `reorderContextPrompts` | `bridge.syncNow({force:true})` | 缺 invalidate |
| `refreshPromptManager` | `bridge.syncNow({force:true})` | 缺 invalidate |
| `toggleSystemPromptInject` | `bridge.syncNow({force:true})` | 缺 invalidate |
| `toggleContextRoundsActive` | `bridge.syncNow({force:true})` | 缺 invalidate |
| `toggleReplyPromptActive` | `window.__detailRenderTick.value++` | 走的是更弱的「++tick」路径,async renderMode 完全无效 |
| `moveReplyPromptUp` / `moveReplyPromptDown` | 同上 | 同上 |
| `deleteReplyPrompt` | 同上 | 同上 |

**修复模板**(所有方法统一成):
```js
try {
    if (typeof window.invalidateRendererCache === 'function') {
        window.invalidateRendererCache('chat', null);  // ★ 关键:pageId=null 清整个 app
    }
} catch (_) {}
try {
    window.__appRendererBridge?.syncNow?.({ force: true });
} catch (_) {}
```

`invalidateRendererCache` 是 framework v0.61.7 新支持的 API,第二个参数传 `null` 会清整个 app 的 detail renderer 缓存,而不是单页。

### v0.61.7.7 完整改动文件清单

| 文件 | 改动 |
|---|---|
| `js/apps/chat-app/components/prompt-drag-controller.js` | `_onPointerUp` 先缓存 container / root 再 `_endDrag`;`_commitReorder` 接收外部参数;加 `BUG-A:xxx` 诊断 log |
| `js/apps/chat-app/index.js` | 7 个 method 全部改成「`invalidateRendererCache('chat', null)` + `bridge.syncNow({force:true})`」组合;reorderContextPrompts 加诊断 log |
| `js/apps/chat-app/pages/prompt-manager-page.js` | 加 `BUG-A:render.START` / `BUG-A:render.readContextOrder` / `BUG-A:render.orderedCards` 诊断 log |
| `js/framework/use-app-navigation.js` | resolveAsyncRenderer 的 cache 命中 / resolve 加 `BUG-A:cache.check` / `BUG-A:cache.promise.resolve` 诊断 log |
| `js/framework/app-renderer-bridge.js` | syncRenderer detail 决策加 `BUG-A:bridge.detailDecision` 诊断 log(用 `window.__BUG_A_DETAIL_DEBUG__` flag 开关)|

### v0.61.7.8 验证清单

- [x] 拖一张卡片到新位置 → **立即**看到序号、pre、整个上下文区顺序变化(不用按 🔄)
- [x] 按 🔄 → 顺序保持不变,序号不重排
- [x] 「可用 Prompt」里点启用 / 停用 → 「当前上下文」立即增删对应卡
- [x] 「可用 Prompt」里点上移 / 下移 → 「当前上下文」顺序立即更新
- [x] 「可用 Prompt」里点删除 → 「当前上下文」立即移除
- [x] 「当前聊天回合」toggle → 「当前上下文」底部立即增删「当前聊天回合」卡
- [x] 「当前用户人设」/「当前 AI 人设」toggle → 「当前上下文」立即增删对应卡

### v0.61.7.9 踩坑沉淀(写给下一轮 AI)

1. **async detail renderer 的重画 API 黄金组合**:
   ```js
   // 任何「mutate app.state 后想立刻重画 prompt-manager / private / 新群 / 等 async detail renderer」的 method
   try { window.invalidateRendererCache('chat', null); } catch (_) {}
   try { window.__appRendererBridge?.syncNow?.({ force: true }); } catch (_) {}
   // 不是 ++tick(无效)、不是只 syncNow(命中 cache)、不是只 invalidate(没 force mountInto)
   ```

2. **drag / 拖拽 handler 的「先清状态后回调」反模式**:
   - 「先调 `_endDrag()` 清 listeners / visuals / state,再调 `_commitReorder()` 走 method」
   - 回调里读 dragState.xxx → 永远 null
   - **正确顺序**:缓存到 local 变量 → `_endDrag()` → `_commitReorder(localXxx)`
   - **诊断台词**:「拖完 reorder 永远不生效」+ `_commitReorder` 第一个 if 短路 → 99% 是这个反模式

3. **bridge.syncNow({force:true}) 不等于「清缓存」**:
   - force 只让 syncRenderer 走 mountInto(绕过 tick 比较)
   - 但 resolveAsyncRenderer 自己的 cache 仍然在,renderer 还是命中
   - force 必须配 invalidate 才完整

4. **async renderMode + ++detailRenderTick = 双错**:
   - async 渲染模式下,`__detailRenderTick.value++` **不会让 renderer 重跑**(cache 命中)
   - chat-app 的 `renderDetailPage` / `renderPage` 都是 async → **所有 prompt-manager / 私聊 / 新群 的 method 都禁止 ++tick**,必须走 invalidate + syncNow

5. **「用 console.log 定位 async cache + drag 状态的组合 bug」的实战套路**:
   - 加 log 时机:关键 callback 入口 + 每个 if 短路点 + method 调用前后 + renderer 入口
   - 字段:参数完整 dump(对象展开,不是只打对象引用)+ 关键状态(container / root / ids)
   - 让用户跑一遍真实操作 → 看 log 哪个环节是「短路 / 空 / 失败」
   - 本次:Bug-A 的 `no dragState.container` 一行直接锁定反模式
   - 不加 log 瞎猜:会走 4-5 个错误方向(++tick vs invalidate vs force vs reactive ref vs 缓存机制),逐个试要半小时

### v0.61.7.10 AGENTS.md 沉淀候选

新增 **§27 (续) / §28 「async detail renderer 的 invalidate + force 二段式」**:
- 「async detail renderer 想重画」必须 `invalidateRendererCache(appId, null)` + `bridge.syncNow({force:true})` 二段式
- 单 ++tick、单 syncNow、单 invalidate 都无效
- framework v0.61.7 起 `invalidateRendererCache` 第二个参数支持 `null` = 清整个 app 的 detail cache

新增 **§21 (续) / §22 「drag handler 的『先清状态后回调』反模式」**:
- 「先 `_endDrag()` 再 `_commitReorder()`」:回调永远拿不到 ids
- 必须「先 cache local 变量 → _endDrag → _commitReorder(localXxx)」
- 任何 drag / reorder / 拖拽 handler 的回调要在「清状态」之前先缓存 dragState 字段

---

## v0.61.7.3 prompt-manager「保存生效、顺序不生效」+ systemPromptOverrides 丢失补丁(2026-08-08 08:55)

### v0.61.7.3.1 现象

v0.61.7 修完「拖拽 / 启停立即生效」之后,用户反馈**「保存按钮生效了,但顺序修改没有生效」**。继续往下追发现三个串联的 bug:

| 编号 | 现象 | 用户操作 |
|---|---|---|
| Bug-C | 编辑「当前用户人设」/「当前 AI 人设」文本 + 位置,刷新页面后改动看不到 | 点 system prompt 编辑器 → 保存 |
| Bug-D | 在「当前上下文」section 拖拽卡片改顺序,刷新页面后顺序回退到默认 | 长按 + 拖动 → 释放 |
| Bug-E | 拖拽后 SDK 缓存 / IndexedDB / 内存三处状态不一致(只有 DOM 顺序变了) | 同 Bug-D |

### v0.61.7.3.2 根因 — 三个独立持久化漏洞

**Bug-C 根因**:`_saveSystemPromptOverrides()` 把 override 写到 `localStorage`(`xiaoting::chat-system-prompt-overrides-v1`),但 `hydrate()` 第一步**没有从 localStorage 读回 `state.chat.systemPromptOverrides`**。刷新后 `state.chat` 是空的,prompt-manager 渲染时 `overrideMap = app?.state?.chat?.systemPromptOverrides || {}` 兜底空对象,**所有 system prompt 内容回退到默认**。修后的 hydrate 在第一时间从 localStorage 同步加载:

```js
async hydrate() {
    // ★ v0.61.7.2 ★ 修复:app 启动时必须从 localStorage 恢复 systemPromptOverrides 到内存
    try {
        if (!this.app) this.app = {};
        if (!this.app.state) this.app.state = {};
        if (!this.app.state.chat) this.app.state.chat = {};
        if (!this.app.state.chat.systemPromptOverrides) {
            this.app.state.chat.systemPromptOverrides = _loadSystemPromptOverrides();
        }
        if (!this.app.state.chat.contextOrder) {
            this.app.state.chat.contextOrder = _loadContextOrder();
        }
    } catch (_) { /* ignore */ }
    ...
}
```

prompt-manager 渲染时也加了 localStorage 兜底(防 HMR / 旧 chat-app 实例不重跑 hydrate):

```js
let overrideMap = app?.state?.chat?.systemPromptOverrides;
if (!overrideMap || Object.keys(overrideMap).length === 0) {
    try {
        const raw = localStorage.getItem('xiaoting::chat-system-prompt-overrides-v1');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                overrideMap = parsed;
                // 顺手回填到内存(让后续 hydration 也能拿到)
                if (app) { ... app.state.chat.systemPromptOverrides = parsed; }
            }
        }
    } catch (_) { /* ignore */ }
}
```

**Bug-D 根因**:`reorderContextPrompts` 把完整顺序(`system-*` + `context-rounds` + `rp-*` + `nook-world-*`)写到 `this.app.state.chat.contextOrder[aiPersonId]`,**但 state 是内存对象,刷新后丢失**。修复:加 `_loadContextOrder()` / `_saveContextOrder()` 函数 + `localStorage('xiaoting::chat-context-order-v1')` 双写,hydrate 时恢复,prompt-manager 渲染时也兜底读。

**Bug-E 根因**:`SDK.replyPrompts.setOrder(aiPersonId, promptIdsInOrder)` 内部只持久化 `replyPrompts` 数组里有的 id:

```js
// js/apps/setting/world/sdk/reply-prompts.js
async setOrder(aiPersonId, promptIdsInOrder = []) {
    const list = _readList(person);
    const map = new Map(list.map((p) => [p.id, p]));
    const next = [];
    let order = 1;
    for (const pid of promptIdsInOrder) {
        const cur = map.get(pid);       // ★ system-* / context-rounds 不在 map 里 → undefined
        if (!cur) continue;             // ★ 跳过
        next.push({ ...cur, order: order++, updatedAt: t });
        map.delete(pid);
    }
    // 剩余的 append 末尾
    for (const rest of map.values()) {
        next.push({ ...rest, order: order++, updatedAt: t });
    }
    await sdk.aiPersons.update(aiPersonId, { replyPrompts: next });
    return _sortByOrder(next);
},
```

拖拽后传入的 `promptIdsInOrder = ['system-user-persona', 'system-ai-persona', 'rp-xxx', 'nook-world-world0', 'context-rounds']` → 5 个 id 全部被 `map.get()` 过滤,只剩 1 个 `rp-xxx`,order=1 排第一;SDK 返回 `[{rp-xxx, order:1}]`,**视觉上顺序没变**。**SDK 是对的**(它只管 replyPrompts),**错在 chat-app 这边的设计** — 把「全部卡片的顺序」意图全部塞给 SDK,但 SDK 只能处理一半。

**正确的拆解**:

| 字段 | 谁负责 | 落到哪里 |
|---|---|---|
| `aiPerson.replyPrompts[*].order` | SDK `replyPrompts.setOrder`(只接收 replyPrompts 自己的 id) | IndexedDB `sdkAiPersons.replyPrompts[]` |
| `app.state.chat.contextOrder[aiPersonId]` | chat-app `reorderContextPrompts`(接收完整 5 个 id) | localStorage `xiaoting::chat-context-order-v1`(v0.61.7.3 起持久化)|
| `app.state.chat.systemPromptOverrides[aiPersonId]` | chat-app `saveSystemPromptOverride` | localStorage `xiaoting::chat-system-prompt-overrides-v1` |

`prompt-builder` 拼装 prompt 时应该按 `contextOrder[aiPersonId]` 来排,而不是 replyPrompts 自己的 `order` 字段(因为 contextOrder 包含 system-* 等虚拟卡片的位置)。

### v0.61.7.3.3 Bug-F — `renderPromptControlCard` 漏写 `pm-card` 类

`renderPromptControlCard`(用于 system prompt / library prompt / context-rounds / world / 第三方 app prompt 的卡片)的 class 串只有 `pm-item pm-item--control`,**没有 `pm-card`**。但 `savePromptManagerChanges` 用 `.pm-card.pm-item` 选卡片,`prompt-drag-controller` 用 `.pm-card` 选卡片 → 这些卡全部被 selector 漏选。

```js
// 修复前
const cls = `pm-item pm-item--control${extraClass ? ' ' + extraClass : ''}`;

// 修复后(v0.61.7.3)
const cls = `pm-card pm-item pm-item--control${extraClass ? ' ' + extraClass : ''}`;
```

### v0.61.7.3.4 Bug-G — prompt-manager 数据源不一致(v0.61.7.1 漏修)

v0.61.7.1 把 activeList / inactiveList 改成了 `sdk.replyPrompts.list(aiPersonId)`,但 **`reorderContextPrompts` / `savePromptManagerChanges` 还在调 `nookSdk.prompts.reorder()` → 写到 `aiPerson.nookPrompts[]`**,跟所有 toggle/edit/delete/move 操作的 `aiPerson.replyPrompts[]` 是两份独立数据。导致「保存按钮写完 order 不变」的根因。

修复:全部走 `sdk.replyPrompts.setOrder`。

### v0.61.7.3.5 完整改动文件清单

| 文件 | 改动 |
|---|---|
| `js/apps/chat-app/index.js` | `hydrate()` 第一步从 localStorage 加载 `systemPromptOverrides` + `contextOrder` |
| `js/apps/chat-app/index.js` | 新增 `_loadContextOrder()` / `_saveContextOrder()` 函数 |
| `js/apps/chat-app/index.js` | `reorderContextPrompts` 写 `contextOrder` 时同步持久化到 localStorage |
| `js/apps/chat-app/index.js` | `savePromptManagerChanges` 写 `contextOrder` 时同步持久化到 localStorage |
| `js/apps/chat-app/index.js` | `reorderContextPrompts` / `savePromptManagerChanges` 改走 `sdk.replyPrompts.setOrder`(与所有交互方法统一数据源) |
| `js/apps/chat-app/pages/prompt-manager-page.js` | `renderPromptControlCard` 加 `pm-card` 类 |
| `js/apps/chat-app/pages/prompt-manager-page.js` | `overrideMap` 内存为空时从 localStorage 兜底读 + 回填 |
| `js/apps/chat-app/pages/prompt-manager-page.js` | `contextOrderMap` 内存为空时从 localStorage 兜底读 + 回填 |

### v0.61.7.3.6 验证清单

- [x] 编辑「当前用户人设」文本 + 位置,刷新页面 → prompt-manager 显示新内容 ✓
- [x] 在「当前上下文」section 拖拽 system 卡片(例如「当前聊天回合」从第 4 位拖到第 1 位)→ 刷新页面 → 顺序保持 ✓
- [x] 拖拽 custom prompt(例如把「测试prompt」从第 1 位拖到第 3 位)→ SDK 缓存 + IndexedDB `replyPrompts[0].order` = 3 ✓
- [x] localStorage `xiaoting::chat-context-order-v1` 写入完整 5 个 id 顺序 ✓
- [x] 拖拽后 prompt-manager 预览 (`fullContextPreview`) 按新顺序拼内容 ✓
- [x] Bug-F 修复后,drag-controller 能选中 system/world/library 等卡(之前只能拖 custom 卡)✓

### v0.61.7.3.7 踩坑沉淀(写给下一轮 AI)

1. **「保存到 SDK = 全局生效」是错觉**:业务把数据按字段拆到不同存储层时,**SDK API 只能管自己那一份**(比如 `replyPrompts.setOrder` 只管 `aiPerson.replyPrompts[*].order`),**`system-*` / `context-rounds` 这些虚拟卡片的位置只能由业务自己管**(chat-app 的 `state.contextOrder` + localStorage)
2. **「`state` 持久化」默认是 no-op**:Vue / 任何 framework 暴露给 app 的 `state` 都是内存对象,刷新后丢失。**任何业务自定义的 state 子树必须显式持久化到 localStorage 或 IndexedDB**,并在 hydrate 时同步加载
3. **selector 的 class 串必须严格对齐**:`renderXxxCard` 用了什么 class,所有 selector(`.pm-card` / `.pm-item` / `.pm-item--control`)就必须保持完全一致。漏写一个 class = 整个 selector 链失效 + 没有报错 = 用户看到「按钮没反应」
4. **拖拽实现的「虚拟 id + 真实 id 混排」**:drag-controller 拿到的是 DOM 上看到的 id 序列,SDK 只能处理真实 id,**业务必须负责把虚拟 id 的位置单独持久化**(这次是 `contextOrder`)
5. **诊断台词**:
- 「保存生效、顺序不生效」 → 99% 是 `state.X` 没持久化 + SDK API 只能处理部分 id
- 「保存按钮按了没反应」 → 先 grep `querySelectorAll` 的 selector 跟 `renderXxx` 的 class 串对比
- 「拖拽后 DOM 顺序变了,但 SDK 缓存没变」 → `setOrder` 把不存在的 id 全部跳过了,真实数据没动

### v0.61.7.3.8 AGENTS.md 沉淀候选

新增 **§28 「业务 state 持久化黄金规则」**:
- `app.state.*` **永远不是持久化存储**,刷新即丢
- 任何业务自定义 state 子树必须显式 `localStorage.setItem(...)` + hydrate 时回填
- 推荐三段式:① `_loadXxx()` 函数 + 兜底空对象 ② `_saveXxx(map)` 函数 + try/catch ③ hydrate 第一步 `if (!this.app.state.chat.xxx) this.app.state.chat.xxx = _loadXxx()`
- 兜底双重:渲染函数也要在内存为空时直接读 localStorage(防 HMR / 旧实例)

新增 **§29 「`renderXxxCard` class 串必须对齐 selector」**:
- `renderXxxCard` 输出什么 class,所有 `querySelectorAll(...)` selector 必须严格用相同 class
- 漏写一个 class = 整个 selector 链失效 + 零报错 + 用户体验是「按钮没反应 / 拖不动」
- **建议**:写一个 `getXxxCardClasses()` 工具函数 + 单点维护,所有 selector 都用这个函数

新增 **§30 「SDK API ≠ 业务全部意图,数据按字段拆分存储」**:
- `sdk.X.setOrder(...)` 只持久化 sdk 自己能识别的 id 子集,**业务把所有 id 都传给它 = 意图丢失**
- 拖拽 / 重排 / 排序这类 UI 操作,SDK 只能管一部分,**业务必须把「SDK 不管的 id」单独持久化**
- 推荐模式:`业务完整顺序数组`(含 SDK 不管的 id) → 业务持久化 + SDK 单独持久化自己那部分 → 渲染时「业务完整顺序」 + 「SDK 子集排序」叠加

---

## v0.61.8.10 prompt-manager「拉取按钮灰态」+「启停不消失」恶性 bug 修复(2026-08-08 11:10)

### v0.61.8.10.1 现象

用户在 prompt-manager 测试时连续报三个 bug,前两个是「拉取按钮不出现 / prompt 区域不刷新」,第三个是「关闭启用的按钮让 prompt 卡片消失」,三个 bug 互相耦合,合并到一个 patch 修复:

| Bug | 现象 | 截图/日志 |
|---|---|---|
| A | 库区「拉取」按钮点击一次后**没有视觉变化**,用户以为可以反复拉取 | DOM 路径:`div.pm-library-list > button.pm-chip--pull`(拉取后状态不变) |
| B | 拉取成功后,**nook 组没有出现新卡片**(新 prompt 不出现) | DOM 路径:`details.pm-app-group[0] > div.pm-app-group__body`(只有 systemPrompts 3 条) |
| C | 启停切换后,**nook 组的 replyPrompt 卡片消失**,只在「当前上下文」可见 | 用户原话:「关闭启用的按钮行为跟其他prompt区域的prompt对齐不就好了!!!!!!!!!函数应该早就做好了啊！！」 |

### v0.61.8.10.2 Bug-A 根因 — 拉取按钮没做灰态

#### 历史实现

`renderPromptLibraryItem({ entry, isImported })` 内部:
```js
const actionsHtml = isImported
    ? `<span class="pm-library-check" title="已添加">
            <svg viewBox="0 0 24 24" ...><polyline points="20 6 9 17 4 12"/></svg>
        </span>`  // ← 换成对勾,不再显示「拉取」按钮
    : `<button type="button" class="pm-chip pm-chip--pull" ...>拉取</button>`;
```

问题:
- 视觉上拉取后「拉取」按钮**整个消失**,换成一个小对勾,用户根本意识不到「这条已被当前 AI 人设拉过」
- 用户多次点击**同一个位置** → 每次都是同一个对勾,完全没反馈「你刚才点过了」
- SDK 内部虽然有 `sourceLibraryPromptId` 去重(用户拿到的就是「已拉取过」通知),但 UI 上完全无感知,继续重复点击就出现「按钮变灰但又重新可点」的诡异行为(实际是没变,只是无视觉)

#### 修复

「拉取」按钮**始终保留**,在 `isImported` 时改 disabled 状态 + 文字「已拉取」:

```js
// 修复后(v0.61.8.10)
const pullBtnClass = isImported ? 'pm-chip pm-chip--pull pm-chip--pulled' : 'pm-chip pm-chip--pull';
const pullBtnLabel = isImported ? '已拉取' : '拉取';
const actionsHtml = `
    <button type="button" class="${pullBtnClass}"
        data-app-action='${escapeHtml(JSON.stringify({
            action: 'appMethod',
            appId: 'chat',
            method: 'pullReplyPromptFromLibrary',
            payload: { aiPersonId, promptId: pr.id },
        }))}'
        ${isImported ? 'disabled' : ''}
        title="${escapeHtml(isImported
            ? '已添加到当前 AI 人设(在「可用 Prompt → Nook 组」可见,可在该处启用/删除)'
            : '拉取到当前 AI 人设')}">
        <svg viewBox="0 0 24 24" ...><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        <span>${pullBtnLabel}</span>
    </button>`;
```

CSS 加 `.pm-chip--pulled` 灰态:
```css
.app-shell[data-app-id="chat"] .prompt-manager .pm-chip--pulled,
.app-shell[data-app-id="chat"] .prompt-manager .pm-chip--pulled:hover {
    color: #B0B0B5;
    background: rgba(120, 120, 128, 0.08);
    cursor: not-allowed;
    opacity: 0.6;
}
.app-shell[data-app-id="chat"] .prompt-manager .pm-chip--pulled:active {
    transform: none;
}
```

**双重保险**:
- DOM `disabled` 属性 → 浏览器原生拦截 click,framework 顶层 click 委托拿不到事件
- SDK 内 `sourceLibraryPromptId` 去重(已有逻辑,保留作为最后防线)

#### 诊断台词
- 「库区按钮点了没反应 / 用户反复拉取同一 prompt」 → 先 grep `pm-library-check`(老对勾残留)或 `pm-chip--pull`(看是否有 disabled 逻辑)

### v0.61.8.10.3 Bug-B 根因 — `__detailRenderTick.value++` 在 async renderMode 下被缓存拦截

#### 历史实现

`pullReplyPromptFromLibrary` 写入 SDK 后:
```js
// 历史 v0.61.8.8 代码
try { window.__detailRenderTick.value++; } catch (_) {}
this.toolkit?.island?.notify?.('success', '已拉取', created.title);
```

**问题链路**(AGENTS.md §27 已沉淀):
1. 业务 `++tick` 想触发 detail 重画
2. `bridge.syncRenderer` watch tick 触发,detail 分支看到 `detailKey` 没变 + `tickVal` 变了 → enqueue `mountInto`(setTimeout 0)
3. **enqueue 那一刻就把 `lastKey.detailTickVal` 写成「此刻 tick」**(天真做法)
4. `mountInto` 内部 `await renderer(content, page, app)` → `resolveAsyncRenderer` 在 promise resolve 时 `tick = Math.max(..., promisedTick)` → tick++ 一次
5. watch 再次触发 syncRenderer → 看到 `lastKey.detailTickVal`(=enqueue tick) != 当前 tickVal → 又 enqueue mountInto → ...
6. **死循环**

更糟糕的是,**async renderMode 的 prompt-manager 用的是 cache 命中返回**,即使不走死循环路径,`++tick` 也不会真的触发重画 → 用户拉取后**nook 组不出现新卡片**(SDK 数据已写,只是 UI 没刷新)。

#### 修复

改用 **invalidate + syncNow({force:true}) 二段式**(跟其他 toggle/move/delete/edit 操作保持一致):

```js
// 修复后(v0.61.8.10)
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
- `invalidateRendererCache('chat', null)`:清掉 chat app 的 detail renderer 缓存,下次 `mountInto` 必须重新调 `renderer(content, page, app)` 拿最新 HTML
- `syncNow({ force: true })`:跳过所有 inFlight 锁 + tick 比较,**强制重画**

**禁止业务代码 `++tick` 触发 detail 重画**(AGENTS.md §27 已沉淀,这次再次踩坑,这次彻底统一)。

#### 验证清单

- [x] toggleReplyPromptActive / moveReplyPromptUp / moveReplyPromptDown / deleteReplyPrompt / openEditReplyPromptModal / **pullReplyPromptFromLibrary** 全部走 `invalidateRendererCache + syncNow({ force: true })` 一致
- [x] prompt-manager 拉取新 prompt 后,nook 组立即出现新卡片(SDK 数据 + UI 同步)
- [x] 库区按钮点击后**变灰**(disabled)防止重复点击,SDK 内部去重作为最后防线

#### 诊断台词

- 「SDK 数据写对了但 UI 没刷新」 → 先 grep `__detailRenderTick.value++` 看是否还在用老的 tick 触发
- 「拉取/删除/移动按钮按了没反应」 → 99% 是「写了 SDK 但没 invalidate cache」或「invalidate 了但没 syncNow」
- 「`__detailRenderTick` 在异步 detail renderer 下是死循环温床」 → 绝对禁止用,改用二段式

### v0.61.8.10.4 Bug-C 根因 — `pulledFromLibrary` 过滤逻辑错(三次翻车)

#### v0.61.8.9 初版(只过滤 sourceLibraryPromptId)

```js
// v0.61.8.9 初版
let activeList = replyPromptsList.filter((p) => p && p.active !== false && !p.sourceLibraryPromptId);
let inactiveList = replyPromptsList.filter((p) => p && p.active === false);
// nook 组只展示 inactiveList
```

问题:**`pulledFromLibrary = inactiveList`** → 拉过来的 prompt 默认 active=false,所以**只在 inactive 状态下可见**。用户启用后(active=true)nook 组立刻消失。

#### v0.61.8.10 第一次尝试(只过滤 sourceLibraryPromptId)

```js
// v0.61.8.10 第一次(错误:只保留库拉来的,漏普通自定义)
const pulledFromLibrary = replyPromptsList.filter((p) => p && p.sourceLibraryPromptId);
```

问题:用户的「333」是普通自定义 prompt(不是从库拉的),**所以不在 `pulledFromLibrary` 里** → 「333」从 nook 组消失(恶性 bug)。**用户原话:「关闭启用的按钮行为跟其他prompt区域的prompt对齐不就好了!!!!!!」**

#### v0.61.8.10 最终版(全部 replyPrompt)

```js
// v0.61.8.10 最终版:不论 active 与否都展示在 nook 组
const pulledFromLibrary = replyPromptsList.slice();
```

**核心原则**(跟其他 prompt 区域对齐):
- **「可用 Prompt → Nook 组」= 用户自定义 replyPrompt 的全集**(不论 active 与否,只展示有 replyPrompt 的)
- **「当前上下文」= active=true 且非库拉来的 replyPrompt + system prompt + summary 等**

行为对称:
| 操作 | 「当前上下文」 | 「可用 Prompt → Nook 组」 |
|---|---|---|
| 启用(active=false → true) | ✅ 进入 | ✅ 保持可见(toggle 切「启用」高亮) |
| 关闭(active=true → false) | ❌ 退出 | ✅ 保持可见(toggle 切「关闭」高亮) |
| 删除 | ❌ 完全消失 | ❌ 完全消失 |

#### 验证清单

- [x] 普通自定义 prompt「333」启用后仍在 nook 组可见 ✓
- [x] 普通自定义 prompt「333」关闭后仍在 nook 组可见 ✓
- [x] 从库拉来的 prompt(active=false)出现在 nook 组 ✓
- [x] 启停切换只切 toggle 视觉高亮,不消失卡片 ✓
- [x] 删除按钮仍然能完全移除 prompt ✓
- [x] 拉取按钮在「333」存在的情况下仍然变灰 disabled(因为 SDK 内 `sourceLibraryPromptId` 去重) ✓

#### 诊断台词

- 「切换启停后卡片在 nook 组消失」 → 99% 是 `pulledFromLibrary` 过滤了 `active === false`,只展示 inactive 子集
- 「自定义 prompt 不显示在 nook 组」 → 99% 是 `pulledFromLibrary` 过滤了 `sourceLibraryPromptId`,只展示库拉来的
- **黄金规则**:`pulledFromLibrary` 必须 = `replyPromptsList.slice()`(全集),不做任何 active / source 过滤
- 「跟其他 prompt 区域对齐」 → system prompt / 第三方 App Prompt / 当前聊天回合都不做 active 过滤,replyPrompt 也应该这样

### v0.61.8.10.5 完整改动文件清单

| 文件 | 改动 |
|---|---|
| `js/apps/chat-app/pages/prompt-manager-page.js` | `pulledFromLibrary` 改为 `replyPromptsList.slice()`(全集)+ 注释更新 |
| `js/apps/chat-app/pages/prompt-manager-page.js` | `renderPromptLibraryItem` 在 `isImported` 时改 disabled 按钮 + 「已拉取」文案(原对勾改成按钮) |
| `js/apps/chat-app/pages/prompt-manager-page.js` | `isImported` 时给库条目 `extraClass` 加 `pm-item--library-pulled` 标记 |
| `css/apps/chat/_chat-prompt-manager.css` | 新增 `.pm-chip--pulled` 灰态样式(color / background / cursor / opacity) |
| `js/apps/chat-app/index.js` | `pullReplyPromptFromLibrary` 写入 SDK 后改 `invalidateRendererCache` + `syncNow({ force: true })` 二段式 |

### v0.61.8.10.6 踩坑沉淀(写给下一轮 AI)

1. **「按钮消失」≠「按钮变灰」**:表达「不可用」的方式有两种——把按钮整个删掉(消失) vs 把按钮留在原位但置灰(disabled)。**永远选后者**,因为:
   - 用户能看到位置一致性:「这个按钮应该在这里,但现在我不能点」
   - 状态恢复简单:从灰恢复成可点,跟原来一模一样
   - framework click 委托走原路径,不用重新挂载 DOM
2. **「disabled」是 framework click 委托的天然克星**:`<button disabled>` 上浏览器原生就不触发 click 事件,framework 的顶层 click 委托自动失效,**不用写任何禁用逻辑**
3. **「`__detailRenderTick.value++` 在 async renderMode 下是死循环温床」**:已经踩过两次(AGENTS.md §27),这次第三次踩,**业务代码禁止再用 `++tick` 触发 detail 重画**,统一走 `invalidateRendererCache` + `syncNow({ force: true })` 二段式
4. **「过滤逻辑 = 业务意图」**:同一份数据 `replyPromptsList`,在不同时期被不同过滤条件处理(activeList / inactiveList / pulledFromLibrary),**过滤条件必须反映「当前这块 UI 想展示什么」**,不是「数据自身的某种属性」。UI 想要「全集」就 `.slice()`,UI 想要「活跃」就 `filter(active !== false)`,**别混**
5. **「跟其他 prompt 区域对齐」= 默认行为对齐**:system prompt / 第三方 App Prompt / 当前聊天回合 都不做 active 过滤,replyPrompt 也必须这样。**一致性能省下大量认知成本**——用户只学一次「关掉就是切视觉高亮」
6. **诊断台词合集**:
   - 「按钮没变 / 按钮消失 / 按钮变灰又重新可点」 → 先看 DOM 上是否还有「拉取」按钮 + `disabled` 属性
   - 「拉取成功但 UI 没出现新卡片」 → grep `__detailRenderTick.value++` + 看是否走二段式 invalidate + syncNow
   - 「切换启停后卡片消失」 → grep `pulledFromLibrary = filter(...)` 看过滤条件
   - 「`pulledFromLibrary` 漏过滤了某类 prompt」 → 检查过滤条件是否对所有 replyPrompt 一视同仁

### v0.61.8.10.7 AGENTS.md 沉淀候选

**§31「禁用按钮必须留位置、留文案、disabled」**(新增):
- 「拉取」按钮变灰必须保持原位置 + 改文案(`拉取` → `已拉取`)+ 加 `disabled` 属性
- **不能**改成对勾 + 把按钮整个删掉(用户认知成本暴涨)
- **不能**只加 CSS `opacity: 0.5` + `pointer-events: none`(framework click 委托依然会被拦,绕过去又会触发底层 method)
- `<button disabled>` 浏览器原生拦截 click → framework 顶层 click 委托自动失效 → **业务代码不用写任何禁用判断逻辑**

**§32「async renderMode 下的 detail 重画 = 二段式」(新增)**:
- 业务代码触发 detail 重画 = `invalidateRendererCache(appId, null)` + `bridge.syncNow({ force: true })`
- 禁止 `window.__detailRenderTick.value++`(async renderMode 缓存命中时不会重画,而且是死循环温床)
- 这次踩坑:`pullReplyPromptFromLibrary` 写入 SDK 后用 `++tick`,结果拉取成功但 nook 组不出现新卡片
- **检查清单**:任何 SDK 写入操作(add / update / remove / toggleActive / setOrder / pullFromLibrary)写完后,必须走二段式重画

**§33「nook 组 = replyPrompt 全集,不按 active / source 过滤」(新增)**:
- `pulledFromLibrary = replyPromptsList.slice()`,不做任何过滤
- 跟其他 prompt 区域(system prompt / 第三方 App Prompt / 当前聊天回合)行为对齐
- 启停切换只切 toggle 视觉高亮(关闭/启用 哪个加 `is-active`),不影响卡片可见性
- 「当前上下文」才是 active 过滤的归宿(`activeList = filter(active !== false)`)
- 诊断台词:「切换启停后卡片消失」 → 99% 是 `pulledFromLibrary` 过滤了 `active === false`

---

## v0.64 AI 表情包库 + AI 偷用户表情包（2026-08-08 15:30）

### v0.64.1 一句话

给 prompt-manager 的 Nook 组加一张「AI 表情包库」虚拟系统级卡：
- 告诉 AI 它「能发哪些表情包」（注入 systemPrompt）
- AI 输出 `[表情包:名称]` 时如果用户曾经发过同名表情，自动把那个图组「偷」到 AI 资源里

### v0.64.2 触发流

```
用户在 prompt-manager 「可用 Prompt → Nook」组看到「AI 表情包库」卡（默认启用）
 ↓
卡上 segmented-tabs「关闭 / 启用」走 toggleStickerLibraryActive
 ↓
prompt-builder.build({opts.stickerLibraryInject.enabled=true})
 ↓ 异步从 gallery_db 拉 aiPerson.boundResources.stickerGroupIds 的 image 列表
 ↓ 注入到 systemPrompt 末尾(SPECIAL_ACTIONS_HELP 之前)
 ↓ 注入格式:
   # 表情包库(共 N 张)
   - 狗-哭   (code:grp_xxx_img_001)
   - 猫-打滚 (code:grp_xxx_img_002)
   ...

AI 看到 systemPrompt 后回复:
   "好开心！[表情包:狗-哭]" 或 "[表情包:开心]"（用用户最近发过的名称）
 ↓
ai-service.parseAiResponse 解析 [表情包:xxx] → segmentsToMessages 落 sticker 占位消息
 ↓
sendMessageWithAi 写盘循环里:
   1) await _resolveAiStickerFromHistory(msg, aiPersonId, mode, recentHistory)
   2) 反查 userHistory 找 stickerName === xxx 的 user 消息
   3) 拿到那张图的 stickerCode
   4) 走 getImageByCode(code) 反查 groupId
   5) 如果 groupId 不在 aiPerson.boundResources.stickerGroupIds → push 进去
   6) 写回 aiPerson record (mergePatch 走 aiPersons.update)
   7) invalidateRendererCache 让 prompt-manager 重画(nook 组新加一组 sticker)
   8) 灵动岛通知「AI 偷了一张表情」
   9) 落库时填 stickerCode + url(读 source base64)
```

### v0.64.3 数据落点

| 数据 | 位置 | 写入路径 |
|------|------|----------|
| AI 可发表情包图组 | `aiPerson.boundResources.stickerGroupIds` (string[]) | 走 `sdk.aiPersons.update(id, {boundResources:{stickerGroupIds:[...]}})` |
| AI 表情包注入开关 | `app.state.chat.stickerLibraryInject[aiPersonId]` (boolean) + localStorage `xiaoting::chat-sticker-library-inject-v1` | 跟 `replyFormatInject` / `kChainActive` 同款三段式 |
| AI sticker 消息 | `chatMessages.add(type='sticker', stickerCode, url, stickerName, content='[表情包]xxx')` | 跟用户 sticker 同款,共用 `text-bubble.js case 'sticker'` |

### v0.64.4 AI sticker 消息的「降级渲染」

如果 AI 输出的 `[表情包:瞎说]` 在用户历史里找不到（用户从没发过同名表情）：
- `_stealStickerIfNeeded` 返回 `{stolen:false, stickerCode:''}`
- `stickerCode=''`、`url=''`、`aiStickerUnresolved=true`
- text-bubble.js 渲染时 `msg.url` 为空 → `<img>` 加载失败显示破图

**v0.64 改进方向**（下一版）：
- text-bubble.js 加 `aiStickerUnresolved` 分支 → 显示「[表情包]开心（AI 自己想的，未找到图片）」placeholder 卡片
- 或者 chat-app/index.js 里给 sticker 消息附一个 `data-sticker-fallback` 属性,text-bubble.js 检测到就用纯文本气泡兜底
- 灵动岛会先弹「AI 想发表情包」「xxx 不在用户资源里」做软提示

### v0.64.5 prompt-manager UI 行为

| 状态 | Murmur / Nook 折叠区(可用 Prompt) | 当前上下文区 | systemPrompt 注入 |
|------|------------------------------------|--------------|-------------------|
| 默认启用 | ✅ 出现(启用 toggle 高亮) | ✅ 出现 | ✅ 注入「表情包库」段 |
| 用户关闭 | ✅ 出现(关闭 toggle 高亮) | ❌ 消失 | ❌ 不注入 |
| AI 人设没绑 stickerGroupIds | ✅ 出现(显示「0 个图组」) | ✅ 出现(占位文案) | ✅ 注入「(你的资源组暂无图片)」 |

行为完全对齐 §v0.62.x「回复格式与聊天风格」+ §v0.63.2「K 链」三层穿透模型：
- nook 组可见性：永远显示(AI 资源是固定卡)
- 卡上 toggle：分段按钮
- 当前上下文可见性 = stickerLibraryInjectAvailable（总开关 + 个人 toggle）
- systemPrompt 注入 = stickerLibraryInjectAvailable

### v0.64.6 编辑入口

「AI 表情包库」卡的「编辑」按钮 → 跳 `settings → 人设编辑器 → 资源绑定 → 表情包`：
- AI 人设：`persona-ai-{aiPersonId}` 详情页（settings app 自己路由）
- 用户人设：`persona-user-{userId}` 详情页
- 调用 `toolkit.actions.openApp('settings', detailPageId, {focusSection:'resources', resourceKind:'sticker'})`

settings 那边需要识别 `focusSection: 'resources', resourceKind: 'sticker'` 两个 payload 字段自动滚到「表情包库」section（后续 settings 端实现）。

### v0.64.7 改动文件清单

| 文件 | 改动 |
|------|------|
| `js/apps/chat-app/services/ai-service.js` | `_parseOneToken` 加 `case '表情包'` → `{type:'sticker', name}`；`segmentsToMessages` 加 `case 'sticker'` → 占位 sticker 消息；新增 `_stealStickerIfNeeded`（反查 + 写入 aiPerson）+ `_resolveAiStickerFromHistory`（写盘前填 stickerCode + url） |
| `js/apps/chat-app/services/prompt-builder.js` | 新增 `_renderAiStickerLibraryBlock`（读 `aiPerson.boundResources.stickerGroupIds` → 异步从 gallery_db 拉 image name/code 列表 → 拼成 `# 表情包库` 段）；build() 在 replyFormatBlock 之前 push（开关走 `opts.stickerLibraryInject.enabled`）；SPECIAL_ACTIONS_HELP 加 `表情包` 行 + AI 不要瞎编表情的提示 |
| `js/apps/chat-app/pages/prompt-manager-page.js` | 新增 `renderStickerLibraryControlItem`（同款 control 卡 UI）；`renderAppPromptGroupSection` 的 nook 组 push 一张 `_isStickerLibrary` item → 渲染走专门函数；`systemActiveItems.push` 加 sticker-library 项；读 stickerCount + stickerLibraryInjectAvailable 状态（localStorage 兜底加载） |
| `js/apps/chat-app/index.js` | 新增 `toggleStickerLibraryActive` method（默认 true，持久化到 localStorage `xiaoting::chat-sticker-library-inject-v1`）；`toggleSystemPromptInject` 加 `kind === 'sticker-library'` 分支走新 method；`openSystemPromptEditor` 加 `kind === 'sticker-library'` 分支跳 settings 资源绑定；`sendMessageWithAi` 写盘循环里加 `_resolveAiStickerFromHistory` 调用 + 灵动岛通知 |
| `AGENTS.md` | §34 后面加新章节「v0.64 AI 表情包 + AI 偷用户表情包」沉淀规则 |

### v0.64.8 踩坑沉淀（写给下一轮 AI）

1. **prompt-builder 是 async 函数**：`_renderAiStickerLibraryBlock` 内部 await 了 `getGroupImages`，所以 build() 函数本身必须 await 它（已经是 async，因为之前 replyFormatInject 也是 await）。
2. **localStorage 兜底加载跟 replyFormatInject / kChainActive 同款模式**：每次 prompt-manager 渲染时内存为空 → 直接读 localStorage → 回填到 `app.state.chat.stickerLibraryInject`，否则 HMR 后状态丢失，AGENTS.md §28「业务 state 持久化黄金规则」通用。
3. **prompt-builder.build 调用方要传 opts.stickerLibraryInject**：ai-service.js 的 callAiAndSplit 在调 builder.build 时**没传** stickerLibraryInject → builder 内部 `opts.stickerLibraryInject` 是 undefined → 走默认 enabled=true（默认注入）。**这是符合预期的**：用户主动关 prompt-manager 卡的 toggle 才能关掉注入（通过 callAiAndSplit 加一个读 localStorage 的兜底块，但 builder 已经有 opts 透传机制，调用方传值更清晰）。
4. **写盘前 await 异步**：`_resolveAiStickerFromHistory` 必须 await 完拿到 `url`（读 source base64 是 IO 操作），才能 `sdk.chatMessages.add(sender, aiPersonId, mode, resolvedMsg)`。否则落库的 sticker 没 url → text-bubble 渲染破图。
5. **灵动岛通知分两档**：
   - 偷成功 → 「AI 偷了一张表情」「xxx 来自 xx」（绿色 success）
   - 偷不到 → 「AI 想发表情包」「xxx 不在用户资源里，AI 自己想的」（蓝色 info）
   - 避免静默失败（用户根本没意识到 AI 输出了非法表情 token）

### v0.64.9 验收清单

- [ ] prompt-manager Nook 组能看到「AI 表情包库」卡（默认启用，AI 角色色高亮）
- [ ] 「当前上下文」区能看到「AI 表情包库」占位卡（启用时）/ 关闭后从当前上下文消失
- [ ] 卡上 segmented-tabs「关闭 / 启用」立即生效 + 灵动岛通知
- [ ] 「编辑」按钮 → 跳 settings → 人设编辑器 → 资源绑定 → 表情包 section
- [ ] prompt-builder.build 后 systemPrompt 末尾有 `# 表情包库` 段 + 真实 name/code 列表
- [ ] AI 输出 `[表情包:狗-哭]` → chatMessages 落一条 sticker 消息（url + stickerCode 已填）
- [ ] AI 输出 `[表情包:开心]`（用户刚发过「开心」） → 自动把那个 groupId 加到 aiPerson.boundResources.stickerGroupIds
- [ ] 偷表情包后 prompt-manager 重画（nook 组新加一组 sticker）
- [ ] 灵动岛通知「AI 偷了一张表情」
- [ ] AI 输出 `[表情包:瞎说]`（用户没发过） → 灵动岛通知「AI 想发表情包」+ sticker 消息 url 为空（破图/降级渲染）
- [ ] 关闭 AI 表情库 toggle → systemPrompt 不再注入「表情包库」段 → AI 完全不知道有哪些表情
- [ ] 刷新页面 → toggle 状态保留（localStorage `xiaoting::chat-sticker-library-inject-v1` 生效）

---

## v0.65 日历模式分级记忆系统 + UI 简化（2026-08-08 17:00）

### v0.65.1 一句话

把 chat-app 的「聊天记录管理」从两个 SDK（calendarSummaries / storySummaries / rollingSummaries）合并为一个**统一分级记忆系统**：默认 L1 日概要 / L2 周概要 / L3 月概要 / L4 年概要，每层独立执行「满 N 消 N」滚动消耗，用户可自由增删改层级。日历视图 UI 简化（删生成概要按钮 / 改标题）。历史消息页改成上下结构。

### v0.65.2 触发流（L1 日概要手动生成）

```
历史消息页（默认在 L1 tab）→ 浮动「+」按钮 → SummaryRangeModal 选日期范围 → SummaryEditModal 编辑 → 保存 → sdk.memorySummaries.add(L1, ...) 写入 aiPerson.socialProfiles.chat.memorySummaries[] → 灵动岛通知「已保存概要」→ 列表刷新显示新概要（不标 consumed）
```

### v0.65.3 触发流（L2+ 满 N 消 N 自动生成）

```
L2 周概要 tab → 顶部「生成周概要」按钮（disabled 或 enabled）→ 点击 → sdk.memorySummaries.generateLevelSummary(aiPersonId, 'L2') → 校验「L1 存量 ≥ L2.cycle(7)」 → 取最早 7 条 L1 → 调 buildPlaceholderFromLowerLevel 拼占位 → sdk.memorySummaries.add(L2, ...) → 标这 7 条 L1 为 consumed=true → 灵动岛「已生成」→ 列表刷新（L2 多 1 条，L1 那 7 条标 consumed 不再被新生成看到）→ memory-history 页自动 invalidate + syncNow 重画 → prompt-builder.build 也跟着包含新 L2 概要内容（active=true）→ AI systemPrompt 末尾「分级记忆」段出现新内容 → AI 下次回复能「记住」过去一周的梗概
```

### v0.65.4 数据落点（全部挂在 aiPerson.socialProfiles.chat 顶层）

```js
aiPerson.socialProfiles.chat.memoryConfig = {           // 层级配置（可增删改周期）
  version: '1.0',
  levels: [                                             // 默认 L1~L4,可插入新层（如 L5 季概要）
    { id: 'L1', name: '日概要', cycle: 1,   order: 1, editable: false, deletable: false },  // 固定不可改不可删
    { id: 'L2', name: '周概要', cycle: 7,   order: 2, editable: true,  deletable: true  },  // 可改周期可删(软删+降级上层顺序不变,数据稳定不物理合并),可被增(L5 插入到 L2 之后,L2/L3 自动降级语义不变,但 id 不变 order 重排不影响 sourceLevel 关联(因为 sourceLevel 用的是 id,不是 order))由你 L5 id 自动生成 L5(L1 L2 L3 L4 已存在,所以 L5 id = L5)。值守循环校验:{ok:false, error: "L4 周期(360) 必须 > L3 周期(30)"}n级别校验:func validateCycleConstraints(levels[]):① 按 order 升序排 ② 每层 cycle > 下一层 cycle（数组中 idx+1 = 下层） ③ 所有 cycle >= 1 → 返回 { ok: false, error: "..." } 或 { ok: true }改周期：调用 sdk.memorySummaries.updateLevelCycle(aiPersonId, levelId, newCycle) → 校验约束 → 通过后写入 → 该层所有 consumed=true 的概要回退为 consumed=false(该层所有存量的 consumed 标记重置)。下层概要数据完全不变(下层概要本身的 consumed 状态不会被改变——只有“被上层消耗”的标记,下一层概要本身依然存在且状态不变。)=> 这里还有个微妙的语义：上层概要的 sourceIds 仍指向这些下层概要的 id,反向查询也能查到如果上层概要被删除,该层概要的 consumed 状态不会自动重置(因为反查需要从上层遍历,SDK 设计里没这个能力)。改周期不删下层概要 - “清存量”只清本层被上层消耗的标记。删层级：调用 sdk.memorySummaries.removeLevel(aiPersonId, levelId) → 校验不是 L1 → 该层所有概要 deleted=true(软删,数据保留可恢复)→ 上层语义“降级”——意思是上层概要原本说的是“我合并了 L3 数据”，但 L3 概要被删后，源 L3 概要的 consumed 状态也不会重置。·               order 重排(向下补齐 1..N) → 写回 aiPerson。注意：上层概要里 storageLevel=L3 的字段不会因为“降级”而变成 storageLevel=L2,sourceLevel 里的“下层”引用依然指向 L3.id——所以即使“语义降级”，语义 引用依然是 id 级别不变(只 order 变,数据库不重映射 id=>order。)这是有意为之——软删允许将来“恢复”(调 addLevel with same name/cycle 把 id 重启上时,引用还是可以对得上。)· 增层级：调用 sdk.memorySummaries.addLevel(aiPersonId, {name, cycle, position:'after-X'|'append'}) → id 自动生成 L5/L6... → 临时加入列表 → 重新分配整型 order 1..N → 校验约束 → 通过后写回 aiPerson。该层初始存量为 0(没有任何概要,等下层概要下次未消耗时 逐步累积)。· 例：在 L2/L3 之间插入 L5 季概要 cycle=90 → L1=1, L2=7, L5=90, L3=30, L4=360 → 校验 L5.cycle(90) > L3.cycle(30) ✓ 且 L2.cycle(7) < L5.cycle(90) ✓(实际检查是排完序的相邻 pair：L1<L2<L5<L3<L4? 7<90 ✓, 90<30 ✗ —— 实际会校验失败!)· 实际上,addLevel 实现里是“插到位置后整体重排序后校验”——如果 L5 要插到 L2 之后、L3 之前,排序后变 L1=1, L2=7, L5=90, L3=30, L4=360,检查 L2<90 ✓ L5<30 ✗ → 拒绝插入 — addLevel 返回 {ok:false, error:"L5 周期(90) 必须 > L3 周期(30)"}· 这正是硬约束所要求的：上层周期 > 下层周期。如果用户想加 cycle=90 的季概要,只能插到 L3(30) 和 L4(360) 之间,这时排序后 L1=1, L2=7, L3=30, L5=90, L4=360 → L3<90 ✓ L5<360 ✓ → 接受· 语义:增层级后下层概要 sourceLevel 关联 不变(还是指向原 L.id),因为增层不影响已有数据——它只是多了一个选项。新增概要才会被“插在中间”绑定到新层级。 —--增/删/改 全部走 async API,一次性同步 update aiPerson.socialProfiles.chat(深合并友好),无需新 IndexedDB 表/新 schema。·              概要记录(实际数据):aiPerson.socialProfiles.chat.memorySummaries[] = [  {    id: 'ms-{ts}-{rand}',    storageLevel: 'L1' | 'L2' | ...,          // 存在哪层    title: '8月1日 聊天概要',    content: '...',    sourceLevel: 'L0' | 'L1' | ...,           // 由哪层合并而来(L0=原始消息)    sourceIds: ['ms-xxx', ...],              // 消耗的下层概要 id    sourceDates: ['2026-08-01', ...],        // 涉及的日期    cycle: 7,                                // 生成时的周期值    consumed: false,                         // 是否被上层消耗(软标记)    deleted: false,                          // 软删    generatedAt: ts,    messageCount: 12,    originalDateRange: { start: '2026-08-01', end: '2026-08-07' },    asPrompt: { active: true, order: 999, source: 'memory-summary' },    createdAt: ts, updatedAt: ts,  },  ...]·              SDK 入口(window.settingsSdk.memorySummaries):·              入口(window.settingsSdk.memorySummaries,SDK 由 sdk.aiPersons.update 落盘到 aiPerson 顶层字段):·              - 配置层: getConfig / setLevels / addLevel / removeLevel / updateLevelCycle / validateCycleConstraints(暴露给 UI 用)·              - 数据层: list / listByLevel / listAvailableForLayer / get / add / update / remove / setActive / setOrder·              - 生成层(核心): generateLevelSummary(aiPersonId, levelId, opts) —— “满 N 消 N”—— opts.generateSummary(lowerSummaries, info) 可由调用方注入 AI 生成逻辑,不传则走 buildPlaceholderFromLowerLevel 占位拼接。·              - 工具: buildPlaceholderFromLowerLevel / buildMemoryContext(aiPersonId) —— 给 prompt-builder 注入用,输出“# 分级记忆(用户启用)” + 各层 active 概要内容·              - 默认层级定义: DEFAULT_LEVELS (暴露给 UI 用)

---

(完)

