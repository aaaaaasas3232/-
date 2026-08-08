# murmur 数据结构 & 功能规划整理

> 创建时间：2026-08-06
> 作者：整理自用户需求

---

## 一、当前数据结构（截止 2026-08-06）

### 1.1 用户卡 / AI 人设（persona）

存在 `listen_db.sdkUsers` / `listen_db.sdkAiPersons` 表里。

```
sdkUser / sdkAiPerson 顶级字段：
├── id              string      唯一标识
├── name            string      名字
├── gender          string      性别
├── age             number      年龄
├── avatar          string      头像 URL（直接存）
├── avatarBg        string      头像背景色
├── boundWorldId    string      绑定的世界观 ID
│
├── socialProfiles  object      ★ 社媒配置（chat / moments 等）
│   └── chat       object
│       ├── nickname        string  社媒昵称（≠ name，AI 可能有多套名字）
│       ├── avatar         string  社媒头像 URL（AI 有独立社媒头像）
│       ├── avatarBg       string  社媒头像背景色
│       ├── signature      string  签名
│       └── remark         string  备注（★ 每个 chatContacts entry 独立）
│
├── boundResources  object      ★ 绑定的资源（图组）
│   ├── avatarGroupIds   string[]  绑定的头像图组 ID 列表
│   ├── stickerGroupIds  string[]  绑定的表情包图组 ID 列表
│   ├── apiRefs          string[]  绑定的 API 配置引用
│   └── promptIds        string[]  绑定的 Prompt 引用
│
├── assetBalance      number     资产余额（资产 last settled 值）
├── incomeEvents      array      收入事件列表
├── assetLastSettledAt number     上次结算时间戳
│
└── patSetting      string      拍一拍文本（"拍了拍我"）
```

### 1.2 聊天联系人副本（chatContacts）

存在 `user.socialProfiles.chat.calendarContacts[]` / `storyContacts[]` 里。
每个 entry 是"独立副本"，同一个 AI 可以同时存在于两个数组里。

```
chatContacts entry 字段（当前，v0.28）：
├── aiPersonId       string      AI 人设 ID
├── displayName      string      显示名（= chat.nickname || aiPerson.name）
├── avatar           string      头像 URL
├── avatarBg         string      头像背景色
├── boundWorldId     string      添加时的世界观快照
├── remark           string      ★ 备注（每个 mode 独立，v0.28 新增）
├── lastMessage      object      最后一条消息预览
├── lastMessageAt    number      最后消息时间戳
├── unreadCount      number      未读数
├── isPinned         boolean     是否置顶
├── createdAt        number      创建时间戳
└── updatedAt        number      更新时间戳
```

### 1.3 世界观（world）

存在 `listen_db.sdkWorlds` 表里。

```
sdkWorld 字段：
├── id              string      唯一标识
├── name            string      世界观名称
├── places         array       ★ 世界观地点列表
│   └── { id, name, description, icon }
└── currencies     array       货币列表
    └── { id, name, unit, isBase }
```

### 1.4 图组（gallery groups）

存在 `listen_db.galleryRecords` 表里。

```
galleryGroup 字段：
├── id              string      唯一标识
├── name            string      图组名
├── type            'avatar' | 'sticker'
└── images          array      图片列表
    └── { id, code, url, name }
```

---

## 二、功能规划（按优先级）

### 功能 1：聊天背景（壁纸）

**需求**：每个 AI 联系人可以在日历模式和故事模式下分别设置不同的聊天背景。同一 AI 不同 mode 可以用不同壁纸。

**当前状态**：✅ **已实现（v0.29, 2026-08-06）**

**数据设计**：

```
chatContacts entry 字段（新增）：
├── chatBackground    string   聊天背景值(带前缀: color: | gradient: | image: / 空字符串=默认)
```

**值格式**：

| 前缀 | 示例 | 含义 |
|---|---|---|
| `color:` | `color:#FFE4EC` | 纯色背景 |
| `gradient:` | `gradient:linear-gradient(135deg, #E8F2FF, #D6E4FF)` | 渐变背景 |
| `image:` | `image:data:image/png;base64,iVBOR...` | 图片背景(dataURL / 网络 URL) |
| `''` | 空字符串 | 默认背景 #F8F9FA |

**SDK API**：

- `sdk.chatFriends.updateBackground(sdk, user, contactId, mode, value)` —— 写盘 + 触发 `chat:chat-background-changed` 事件

**UI 流程**：
1. 聊天设置页 → 「聊天背景」一行 → 点击弹出背景选择器(`ChatBackgroundModal`)
2. 选择器 3 tab：**纯色**（20 预设）/ **渐变**（12 预设）/ **图片**（本地选择 ≤2MB）
3. 底部 3 按钮：取消 / 恢复默认 / 保存
4. 保存回调 → `sdk.chatFriends.updateBackground` → 派发事件 → 私聊页 + 设置页重画

**私聊页应用**：
- `.chat-messages` 加 `data-chat-bg` 属性 + 内联 style
- CSS `[data-chat-bg]` 自动套 cover/center + 半透明白遮罩
- 气泡 z-index:1 提到背景之上

**涉及文件**：
- `js/apps/setting/world/sdk/chat-friends.js` — `add` 初始化 `chatBackground: ''` + 新增 `updateBackground` API
- `js/apps/chat-app/pages/chat-page.js` — 读 entry → 给 `.chat-messages` 加 `data-chat-bg`
- `js/apps/chat-app/pages/chat-settings-page.js` — 「聊天背景」设置项 + `renderChatBackgroundPreview` 缩略图
- `js/apps/chat-app/index.js` — `openChatBackgroundModal` method(派发入口 + SDK 写入 + 事件派发)
- `js/apps/chat-app/components/chat-modal-components.js` — `ChatBackgroundModal` 组件
- `js/apps/chat-app/components/chat-modal-registry.js` — `openChatBackground` 方法
- `css/apps/chat/_chat-private.css` — `[data-chat-bg]` + `.chat-bg-modal` 弹窗样式
- `css/apps/chat/_chat-settings.css` — `.chat-bg-preview` 缩略图样式

**与备注的区别**：备注是文字，聊天背景是视觉样式。实现逻辑完全一致(每个 mode 独立字段 + entry 级存储 + 弹窗编辑)。

**设计取舍**：
- 群聊暂不接入(用另一个数据模型,后续单独做)
- 图片限制 2MB(防止 IndexedDB 暴涨)
- 不开放颜色拾色器(20+12 预设够覆盖 95% 场景)
- 不支持主题色/渐变预设编辑(纯开箱即用)

**验证清单**：
- [x] 私聊页应用 `data-chat-bg`(calendar)
- [x] 私聊页应用 `data-chat-bg`(story, 与 calendar 独立)
- [x] 设置页右侧显示缩略图/默认
- [x] 弹窗 3 tab 切换流畅
- [x] 保存/恢复默认/取消按钮功能正确
- [x] 图片 ≤2MB 校验
- [x] 持久化(刷新保留)

---

### 功能 2：AI 网名优先级

**需求**：AI 名字有三种来源，优先级是：
1. 备注（remark）> 社媒名字（nickname）> AI 人设名字（name）

**当前状态**：
- `displayName` 目前是 `chat.nickname || aiPerson.name`
- 备注（remark）已加进来但 UI 显示优先级还没统一

**UI 显示优先级**（统一后）：

```
contactName = entry.remark || aiPerson.socialProfiles.chat.nickname || aiPerson.name
```

**涉及位置**：
| 位置 | 当前实现 | 需要改动 |
|------|---------|---------|
| 消息列表（messages-page.js） | `item.remark \|\| item.displayName` | 已 OK |
| 私聊页顶栏（chat-page.js） | `entry.displayName` | 需要加 remark 优先 |
| 聊天设置页（chat-settings-page.js） | `entry.displayName` | 需要加 remark 优先 |
| 聊天设置页「备注」项 | 显示 `entry.remark` | 已 OK |

**注意**：这里的优先级是 **备注 > 社媒名 > 人设名**，而 `displayName` 是 AI 人设被添加时快照的 "当时看到的名字"（= 添加时的 `nickname || name`）。后续改社媒名/AI 名不影响已添加的副本，除非刷新同步。

---

### 功能 3：发红包功能

**需求**：
- 用户和 AI 各自有资产
- 日历模式下发红包 → 真实计算（扣发送方，加接收方）
- 故事模式下发红包 → 仅 UI 展示，不做真实计算
- AI 也要有清晰的资产概念

**当前状态**：
- 用户资产：`user.assetBalance`（last settled）+ `user.incomeEvents`（结算历史）
- AI 资产：**没有单独存储**——`aiPerson.assetBalance` 字段存在，但 `sdk.persona.asset.snapshot()` 默认只给 user 算

**数据设计**：

```
AI 人设（sdkAiPerson）已支持：
├── assetBalance        number   AI 资产余额
├── incomeEvents        array    AI 收入事件
└── assetLastSettledAt  number   上次结算时间戳
```

**业务流程**：

```
日历模式发红包（真实计算）：
1. 用户点击红包 → 输入金额
2. 检查用户 assetBalance >= 红包金额
3. sdk.persona.asset.adjust(-amount, '发红包', 'user', userId)
4. sdk.persona.asset.adjust(+amount, '收红包', 'ai', aiPersonId)
5. 两边都扣成功才发消息

故事模式发红包（不计算）：
1. 用户点击红包 → 输入金额
2. 直接发红包消息，不动资产
3. AI 回复可以是"收到红包~"的 UI 效果
```

**注意**：故事模式不触发 `adjust`，但可以触发 `addIncome` 记录事件（如果需要统计）。

**涉及文件**：
- `chat-page.js` — 工具栏红包按钮 + 红包弹窗
- `chat-modal-components.js` — 红包金额输入弹窗 + 领取弹窗
- `chat-settings-page.js` — AI 资产显示（如果需要）
- `profile-page.js` — 用户钱包余额（已有，通过 `sdk.persona.asset.snapshot()` 读）

---

### 功能 4：AI 头像优先级

**需求**：AI 头像有两种来源，优先级是：
- 社媒头像（`aiPerson.socialProfiles.chat.avatar`）> AI 人设头像（`aiPerson.avatar`）
- 无论日历模式还是故事模式，AI 头像都是一样的

**当前状态**：
- `chatContacts` entry 的 `avatar` 字段是添加时的快照（= `chatPerson.avatar || aiPerson.avatar`）
- 后续改社媒头像不影响已添加的副本

**UI 渲染头像时**（统一后）：

```js
// 头像来源：优先取 entry 快照 > 实时社媒 > 实时人设
const avatarUrl = entry.avatar || aiPerson.socialProfiles?.chat?.avatar || aiPerson.avatar;
const avatarBg = entry.avatarBg || aiPerson.socialProfiles?.chat?.avatarBg || aiPerson.avatarBg;
```

**涉及位置**：
| 位置 | 需要改动 |
|------|---------|
| 消息列表（messages-page.js） | 可能需要刷新头像来源 |
| 私聊页（chat-page.js） | 可能需要刷新头像来源 |
| 聊天设置页（chat-settings-page.js） | 可能需要刷新头像来源 |
| 日历视图（calendar-view-page.js） | 可能需要刷新头像来源 |
| 故事存档（story-archive-page.js） | 可能需要刷新头像来源 |

**注意**：如果想支持"添加后改社媒头像，同步更新所有副本"，需要加一个「同步头像」逻辑。但当前快照设计是故意的（保持副本独立性）。

---

### 功能 5：地点卡片引入世界观地点

**需求**：发送位置卡片时，只能选世界观里已有的地点。世界观没有地点就不能发位置卡片。

**当前状态**：
- `sdkWorld.places` 包含地点列表
- 位置卡片发送目前没有校验

**UI 流程**：
1. 用户点「位置」工具按钮
2. 弹出地点选择器，列表来自 `sdk.worlds.get(boundWorldId).places`
3. 如果 `places.length === 0`，提示「当前世界观没有设置地点」
4. 选中地点 → 发送位置卡片消息

**数据设计**：无需新增字段，只需要在发送前校验。

**涉及文件**：
- `chat-page.js` — 位置工具按钮 + 位置选择弹窗
- `chat-modal-components.js` — 地点选择器弹窗组件
- `chat-settings-page.js` — 世界观地点配置入口（如果有的话）

---

### 功能 6：拍一拍

**需求**：故事模式和日历模式的拍一拍都是一样的（跟头像一样，两个 mode 共用）。

**当前状态**：
- `patSetting` 在 `user` 表的顶级字段（用户卡自己的拍一拍）
- **AI 没有拍一拍字段**

**数据设计**：

```
sdkAiPerson 字段（新增）：
└── patSetting  string   AI 的拍一拍文本
```

**UI 流程**：
1. 日历/故事模式点「拍一拍」按钮
2. 发送消息：`{ type: 'pat', from: 'user', to: 'ai', content: user.patSetting }`
3. AI 回复：`{ type: 'pat', from: 'ai', to: 'user', content: aiPerson.patSetting || '拍了拍我' }`

**涉及文件**：
- `chat-page.js` — 拍一拍按钮逻辑
- `defaults.js` — AI 默认 `patSetting`
- `chat-settings-page.js` — AI 拍一拍设置项（如果有）

---

### 功能 7：表情包库

**需求**：故事模式的 AI 表情包库跟日历模式一样，都是 nook 里设置的。

**当前状态**：
- `boundResources.stickerGroupIds` 是 AI 人设绑定的表情包图组 ID 列表
- 表情包库按图组引用
- 当前 chatContacts entry 没有存储表情包信息

**设计说明**：表情包库是 AI 人设级别的绑定（`aiPerson.boundResources.stickerGroupIds`），不是 chatContacts entry 级别的。故事模式和日历模式共用同一个 AI 的表情包库。

**涉及文件**：
- `chat-page.js` — 表情包选择器需要从 `aiPerson.boundResources.stickerGroupIds` 加载
- `chat-modal-components.js` — 表情包选择器组件
- `gallery-stores.js` — 图组数据

---

## 三、数据流总图

```
┌─────────────────────────────────────────────────────────────────┐
│                        listen_db                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  sdkUsers    │  │ sdkAiPersons │  │  sdkWorlds   │           │
│  │  ─────────── │  │  ─────────── │  │  ─────────── │           │
│  │  assetBalance│  │  assetBalance│  │  places[]    │           │
│  │  incomeEvents│  │  incomeEvents│  │  currencies[]│           │
│  │  patSetting  │  │  patSetting  │  └──────────────┘           │
│  │  boundResources│ │  boundResources│                           │
│  │  └ avatarGroupIds│  └ avatarGroupIds│                         │
│  │  └ stickerGroupIds│  └ stickerGroupIds│                        │
│  │  socialProfiles │  socialProfiles │                           │
│  │  └ chat        │  └ chat         │                            │
│  │     └ nickname │     └ nickname  │                            │
│  │     └ avatar   │     └ avatar   │                            │
│  └──────────────┘  └──────────────┘                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         user.socialProfiles.chat                         │    │
│  │  ┌─────────────────────┐  ┌─────────────────────┐       │    │
│  │  │ calendarContacts[]  │  │   storyContacts[]   │       │    │
│  │  │  ────────────────   │  │   ──────────────   │       │    │
│  │  │  entry:            │  │   entry:           │       │    │
│  │  │  ├ aiPersonId      │  │   ├ aiPersonId     │       │    │
│  │  │  ├ displayName     │  │   ├ displayName    │       │    │
│  │  │  ├ remark ★       │  │   ├ remark ★       │       │    │
│  │  │  ├ chatBackground ★│  │   ├ chatBackground★│       │    │
│  │  │  ├ avatar         │  │   ├ avatar          │       │    │
│  │  │  └ ...            │  │   └ ...             │       │    │
│  │  └─────────────────────┘  └─────────────────────┘       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

★ = 本次规划新增字段
```

---

## 四、备注 vs 其他 per-mode 字段的区别

| 字段 | 存储位置 | mode 独立？ | AI/人设共用？ |
|------|---------|------------|--------------|
| remark | chatContacts entry | ✅ 独立 | — |
| chatBackground | chatContacts entry | ✅ 独立 | — |
| displayName | chatContacts entry | ✅ 独立（快照） | — |
| avatar | chatContacts entry | ✅ 独立（快照） | — |
| patSetting | aiPerson 顶级 | ❌ 共用 | AI |
| stickerGroupIds | aiPerson.boundResources | ❌ 共用 | AI |
| avatar | aiPerson.socialProfiles.chat | ❌ 共用 | AI |
| nickname | aiPerson.socialProfiles.chat | ❌ 共用 | AI |
| assetBalance | aiPerson 顶级 | ❌ 共用（按人设） | AI |
| places | world 顶级 | ❌ 共用 | 世界 |

---

## 五、实现顺序建议

1. **聊天背景**（跟备注逻辑完全一样，快速验证）
2. **AI 网名优先级**（统一 3 处显示逻辑）
3. **AI 头像优先级**（统一头像来源）
4. **地点卡片引入世界观**（校验 places）
5. **AI 拍一拍**（新增字段 + 按钮逻辑）
6. **发红包功能**（涉及金额计算，最复杂）
7. **表情包库**（关联图组加载）
