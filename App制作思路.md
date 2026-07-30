# App 制作思路

> 本文档记录「小听启动」项目中 **App** 的完整设计：**通用模板规范、跨 App 通信协议、与设置 App 的系统级接口约定**，以及**与世界观 / 人设 / 图库三大数据底座的接入方式**。

> **前置必读**：
> - `AGENTS.md`：项目骨架、ESM、App 原型、actions
> - 「世界观制作思路.md」：地图 / 标签 / 地点 / 时间 / 纪时
> - 「人设制作思路.md」：本体 / 7 模块 / 阶段 / parO / 心情 / 日记

> **版本**：v2.0（对齐实际代码 v0.19）

## 更新日志

| 版本 | 说明 |
|------|------|
| **v2.0** | **本版：完全基于真实代码重写**。清理所有不存在的 `toolkit.world`/`toolkit.persona`/`toolkit.social`；统一为 `window.settingsSdk` + `settingsSdk.persona` + `settingsSdk.diary`；补充 `schedule` scope；prompt SDK 已独立 `prompt-db.js`，待接入 settings-sdk.js；清理文件结构。 |

*最后更新：2026-07-30 v2.0*

---

## 0. 一句话总览

「小听启动」是一个 **App 生态系统**，App 装在桌面 / Dock 上，每个 App：

- **注册到系统**：声明自己能提供什么数据、接收什么命令（§2）
- **通过 `window.settingsSdk` 读系统事实**：世界观、地点场所、标签、用户、AI 人设、时间线、草稿、心情、日记（§3）
- **暴露 services**：让其他 App 通过 `externalAppRegistry.invokeService(appId, method, payload)` 调用（§4.1）
- **使用系统能力**：通过 `toolkit` 访问 IndexedDB、灵动岛、共享记录、动作派发（§4.2）
- **参与跨 App 通信**：通过 Deep Link、shareRecord、services、sharedRecords 协作（§4）
- **提供小组件**：把自己的核心数据以 widget 形态贴到桌面（§5）
- **挂载灵动岛**：用 `toolkit.island` 实时反馈播放 / 下载 / 进度 / 通知（§6）

> **v2.0 重要提醒**：`toolkit.world`、`toolkit.persona`、`toolkit.social` **不存在**。所有系统级 API 统一通过 `window.settingsSdk` 访问。

---

## 1. App 通用模板

### 1.1 最小 App 结构

每个 App 都是一个**默认导出的工厂函数**，返回 `appConfig`：

```js
// js/apps/my-app.js
import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';

export default function createMyApp() {
    return {
        id: 'my-app',                              // ★ 全局唯一
        name: '我的应用',
        icon: `<svg viewBox="0 0 60 60">...</svg>`, // 内联 SVG
        iconBg: 'linear-gradient(145deg, #6366f1, #a855f7)',

        // ===== 可选 =====
        background: 'linear-gradient(180deg, #f8f5ff, #ffffff)',
        statusBarColor: '#3b1d75',
        homeIndicatorColor: 'rgba(59,29,117,0.28)',
        dock: { visible: true, order: 0 },
        topbar: { visible: true, title: '...', subtitle: '...' },

        // ===== 页面 =====
        pages: [
            { id: 'main', label: '主页', icon: '◦', nav: true },
        ],
        defaultRootPageId: 'main',
        detailContent: {
            'about': { title: '关于', subtitle: '...', blocks: [...] },
        },

        // ===== 数据表声明 =====
        stores: [
            { name: 'myItems', keyPath: 'id' },
        ],

        // ===== 初始 state =====
        setup({ toolkit, app }) {
            return { items: [], loading: false };
        },

        // ===== 业务方法 =====
        methods: {
            async addItem(text) {
                await this.toolkit.db.add('myItems', { id: `item-${Date.now()}`, text, createdAt: Date.now() });
                this.toolkit.island.notify('success', '已添加', text);
            },
        },

        // ===== 对外接口 =====
        services: {
            async getItems() {
                return this.app.state.items;
            },
        },

        // ===== 渲染 =====
        renderPage(content, page, app) {
            return `<div class="app-card">Hello</div>`;
        },

        // ===== 小组件（可选）=====
        widgets: [
            {
                id: 'quick-counter',
                label: '计数器',
                icon: '<svg viewBox="0 0 24 24">...</svg>',
                iconBg: '#222',
                defaultSize: 'S',
                defaultOrientation: 'h',
                render(size, payload) { return `<div>...</div>`; },
                onTap() { this.toolkit.actions.openApp('my-app'); },
            },
        ],
    };
}
```

> 字段意义、`renderPage / methods / services` 里的 `this` 上下文、ESM 加载顺序等详见 `AGENTS.md §2`。

### 1.2 App 必须声明的信息

| 信息 | 字段 | 是否必须 |
|------|------|----------|
| 基础信息 | `id`, `name`, `icon`, `iconBg` | ✅ |
| 数据存储 | `stores` | ✅（用 `toolkit.db` 时） |
| 页面路由 | `pages`, `defaultRootPageId` | ✅ |
| 页面渲染 | `renderPage` | ✅ |
| 对外接口 | `services` | ⚠️ 强烈推荐 |
| 小组件 | `widgets` | ⚠️ 可选 |
| 灵动岛模板 | `window.islandTemplates[name] = { render, bind }` | ⚠️ 可选 |
| Deep Link 入口 | `services.handleDeepLink` | ⚠️ 接收外部 deepLink 时需要 |

### 1.3 现实存在的 App 清单

| id | 文件 | 说明 |
|----|------|------|
| `prompt-survey` | `js/apps/prompt-survey.js` | Prompt 调研问卷 |
| `framework-test-app` | `js/apps/framework-test-app.js` | 框架联调测试 |
| `placeholder-apps` | `js/apps/placeholder-apps.js` | 占位空壳（调试翻页） |
| `settings` | `js/apps/setting/main.js` | 设置 App（系统大头） |

**「设置 App」是当前 SDK 与数据底座的承载者**，其他 App 通过 `window.settingsSdk` 拿到世界观 / 人设 / 图库数据。

---

## 2. App 的系统接口（toolkit）

### 2.1 toolkit 完整 API（已实现）

每个 App 通过 `this.toolkit` 访问系统能力，由 `src/core/app-toolkit.js` 构造：

| 字段 | 用途 | 来源 |
|------|------|------|
| `toolkit.island` | 灵动岛：`show / notify / close / toggle / dismiss` | `src/core/island-helper.js` |
| `toolkit.db` | IndexedDB：`add / get / getAll / put / remove / clear / count / find` | `src/core/store-api.js` |
| `toolkit.shared` | 跨 App 共享记录：`put / get / getAll / listByTarget` | `src/core/store-api.js` |
| `toolkit.actions.*` | `detail / modal / method / openApp / deepLink / share` | `src/core/actions.js` |
| `toolkit.builders.settings` | 设置页构建器 | `src/core/icon-library.js` |
| `toolkit.renderers.*` | 通用渲染器（`renderActionButton` 等） | `src/core/renderers.js` |
| `toolkit.templates` | `appTemplates.render(template, payload)` | `src/core/templates.js` |
| `toolkit.icons / uiIcons / uiSymbols / iconLibrary / tokens` | 内置图标 / 符号 / 设计 token | `src/core/icons.js` |
| `toolkit.app` | 当前 App 配置本身（循环引用） | `app-toolkit.js` |

### 2.2 核心操作速查

```js
// ── 灵动岛 ──
toolkit.island.notify(type, title, message, options?)   // 弹通知（默认 3.5s 自动消失）
toolkit.island.show(size, content)                       // 显示持续态
toolkit.island.toggle(size, content)                     // 同视图第二次关
toolkit.island.close(reason)                             // 关闭

// ── IndexedDB ──
await toolkit.db.add('tableName', record)
await toolkit.db.put('tableName', record)
await toolkit.db.get('tableName', id)
await toolkit.db.getAll('tableName')
await toolkit.db.find('tableName', record => record.x === y)
await toolkit.db.remove('tableName', id)

// ── 共享记录 ──
await toolkit.shared.put(record)
await toolkit.shared.get(id)
await toolkit.shared.listByTarget('chat')   // 拿发给 chat 的所有记录

// ── 动作派发 ──
toolkit.actions.detail(pageId)                          // 跳本 App 详情页
toolkit.actions.modal(type, payload)                     // 拉全局 modal
toolkit.actions.method(name, payload)                    // 调自己 methods
toolkit.actions.openApp(appId, pageId, payload)          // 跳别的 App
toolkit.actions.deepLink(target, payload)                // 发 deep link
toolkit.actions.share(record)                            // 广播一条记录
```

---

## 3. ★ settingsSdk：跨 App 实体数据中介

> **本文档最重要的章节**。`window.settingsSdk` 是设置 App 在 bootstrap 时挂载到全局的对象，是**所有 App 拿系统事实数据（世界观 / 人设 / 地点 / 标签 / 时间线 / 日记 / 日程）的统一入口**。

> 来源：`js/apps/setting/world/sdk/settings-sdk.js`（由 `setting/main.js` 的 `_bootstrapSettingsSdk()` 在 hydrate 后调用）

### 3.1 完整 surface

| scope | API 形态 | 典型用途 |
|-------|---------|---------|
| **`users`** | `list/get/create/update/remove/getActive/setActive` | 用户人设实例（user0 / user1...） |
| **`aiPersons`** | `list/get/create/update/remove/getActive/setActive` | AI 人设实例（ai0 / ai-xiaohuang...） |
| **`worlds`** | `list/get/create/update/remove/getActive/setActive` | 世界观 |
| **`worldGroups`** | `list/create/update/remove` | 世界观组（用于侧栏分组） |
| **`tagGroups`** | `list/create/update/remove` | 标签组 |
| **`tags`** | `list/create/update/remove` | 标签（附属于 tagGroup） |
| **`places`** ★ | `list/get/create/update/remove/removeByWorld` | 地点（地图容器，主地点固定为 (0,0)） |
| **`locations`** ★ | `list/get/create/update/remove/removeByWorld` | 场所（地点下的 pin，坐标 `-100~100`） |
| **`snapshot`** | `get/set/getWeightedPick` | 每日快照 + 加权随机抽卡 |
| **`profile`** | `getOverrides/setMode/getLevel` | profile 模式（minimal / full / custom） |
| **`timelines`** | `list/create/update/remove/addEvent` | 时间线（事件 + 标签） |
| **`drafts`** | `list/get/create/update/remove/publish` | 草稿 |
| **`anchors`** | `list/create/update/remove` | 时间锚点（段/点） |
| **`chronology`** | `getConfig/update/realToWorld/worldToReal/format/getHourNames` | 纪时系统 |
| **`persona`** ★ | 见 §3.3 | 人设业务（模块 / 阶段 / parO / 资源 / 概率 / 资产 v4.1） |
| **`persona.asset`** ★ | 见 §3.8 | **v4.1**：其他 App 调人设资产的统一入口（`snapshot / adjust / setBalance / addIncome / settle`） |
| **`diary`** ★ | `getToday/listByDate/getById/upsert/addSegment/removeSegment` | 人设日记 |
| **`schedule`** | `getForEntity/updateForEntity` | 人设日程 |
| **`events`** | `.on / .emit` | 事件总线（`settings-sdk:change`） |
| `weightedPick` | 直接调 `weightedPick(items, weights, n)` | 加权随机抽卡 |
| `escape(value)` | 等价 `escapeHtml` | HTML escape |
| `cache` | 内存 cache 直接读 | 调试用 |

> **注意**：`toolkit.world`、`toolkit.persona`、`toolkit.social` **不存在**。所有系统 API 通过 `window.settingsSdk` 访问。

### 3.2 通用 CRUD 形态

除 timeline / draft / anchor / chronology / persona / diary / schedule 外，每个 scope 都是同一个 `createEntityApi` 工厂出来的，形状统一：

```js
const list  = sdk.users.list();                          // 全部
const user0 = sdk.users.get('user0');                     // 单个
const users = sdk.users.list({ worldRef: 'world-xxx' });  // 部分 scope 支持筛选

const created = await sdk.users.create({ name: '小张', boundWorldId: 'world-xxx' });
const updated = await sdk.users.update('user0', { name: '小张' });
await sdk.users.remove('user0');

const active = sdk.users.getActive();                     // 当前激活
await sdk.users.setActive('user0');
```

**所有 API 都是同步返回内存 cache，写入异步落盘**。

### 3.3 `settingsSdk.persona`（人设业务）

来源：`js/apps/setting/world/sdk/persona.js` 的 `bindPersona(sdk)`。

```js
sdk.persona.module.list                                  // 模块 key 列表
sdk.persona.module.get(persona, 'preferences')           // 取模块数据（缺则用 defaults）
sdk.persona.module.toggle(entityType, id, 'preferences', true)
sdk.persona.module.setInject(entityType, id, 'habits', 'current')
sdk.persona.module.update(entityType, id, moduleKey, patch)

sdk.persona.phases.list(persona)
sdk.persona.phases.active(persona)
sdk.persona.phases.add('ai', 'ai0', { name: '大学阶段', ageRange: [18, 22] })
sdk.persona.phases.update('ai', 'ai0', phaseId, { name: '...' })
sdk.persona.phases.remove('ai', 'ai0', phaseId)
sdk.persona.phases.activate('ai', 'ai0', phaseId)

sdk.persona.paro.list(persona)
sdk.persona.paro.clone('ai', 'ai0', { name: '小黄-童年', age: 8 })
sdk.persona.paro.update('ai', 'ai0', parOId, { ... })
sdk.persona.paro.remove('ai', 'ai0', parOId)

sdk.persona.probability.roll('ai', 'ai0')                 // 重抽今日心情
sdk.persona.probability.dailyCalculate('ai', 'ai0')         // 每日计算（含情绪）
sdk.persona.probability.setWeights('ai', 'ai0', { '开心': 40, '平静': 30 })
```

### 3.4 `settingsSdk.diary`（人设日记）

来源：`js/apps/setting/world/sdk/diary.js`。

```js
sdk.diary.getToday(entityType, entityId)                  // 今日日记（含 mood / segments）
sdk.diary.getById(entityType, entityId, date)             // 某日日记
sdk.diary.upsert(entityType, entityId, { mood, segments })  // 写或更新
sdk.diary.addSegment(entityType, entityId, date, { text, source })
sdk.diary.removeSegment(entityType, entityId, date, segmentId)
sdk.diary.regenerate(entityType, entityId, { generator })
sdk.diary.MOOD_PRESETS                                    // 心情预设（['开心','平静',...]）
```

**日记段结构**：

```js
{
    id: 'seg-...',
    text: '今天天气真好',
    source: 'manual' | 'generated',                        // 手动 / 自动生成
    createdAt: Date.now(),
}
```

### 3.5 监听变更（事件总线）

```js
// 方式 A：通过 sdk.events
sdk.events.on('settings-sdk:change', (e) => {
    if (e.scope === 'aiPersons' && e.action === 'update') {
        // 某人设被改了
    }
});

// 方式 B：直接监听 window
window.addEventListener('settings-sdk:change', (e) => { ... });
```

**event detail 结构**：`{ scope, action, payload }`，scope 是上面 17 个之一，action 是 `'create' | 'update' | 'remove' | ...`。

### 3.6 准备就绪：异步等待

设置 App 启动可能晚于你的 App hydrate，所以**不要直接 `window.settingsSdk.xxx.list()`**。

```js
// 方式 A：监听 ready 事件
window.addEventListener('settings-sdk-ready', () => {
    const aiList = window.settingsSdk.aiPersons.list();
}, { once: true });

// 方式 B：从 setting/world/sdk/settings-sdk.js 导入
import { whenSettingsSdkReady } from '@/js/apps/setting/world/sdk/settings-sdk.js';
whenSettingsSdkReady().then(sdk => {
    const aiList = sdk.aiPersons.list();
});
```

### 3.7 缓存快照（cache 直接访问）

```js
// 调试 / 高频读时用
sdk.cache.aiPersons          // Map<id, instance>
sdk.cache.worlds             // Map<id, instance>
sdk.cache.activeAiId         // 当前激活 AI
```

> cache 是**只读的引用**，不要直接修改；改请走 `update()` / `create()`。

### 3.8 ★ `settingsSdk.persona.asset`（v4.1 资产桥）

> 来源：`js/apps/setting/persona/persona-bridge.js`，由 settings App 在 bootstrap 后挂到 `toolkit.persona.asset`。

**为什么需要这层桥**：人设的资产（`assetBalance + incomeEvents[]`）存在人设记录里，但商城/聊天/工作等 App 要读/扣别人的钱。直接 `sdk.aiPersons.update(id, { assetBalance: ... })` 不可取，会绕过「先把 accrued 结算进去再扣」的语义。

```js
// ── 入口 ──
toolkit.persona.asset.snapshot(entityType, entityId)
//   → { balance, accrued, baseBalance, currency: { name, unit }, events: [...] }

toolkit.persona.asset.adjust(delta, note, entityType, entityId)
//   delta: number（正=加，负=扣）
//   note : string（灵动岛显示，如「买奶茶」）
//   entityType: 'ai' | 'user'
//   → 新余额（number）

toolkit.persona.asset.setBalance(value, entityType, entityId)
//   → 强制设置 assetBalance（覆盖式）

toolkit.persona.asset.addIncome(event, entityType, entityId)
//   event: { name, amount, frequency, startDate, dayOfMonth?, dayOfWeek? }
//   frequency: 'monthly' | 'weekly' | 'daily' | 'once'

toolkit.persona.asset.updateIncome(eventId, patch, entityType, entityId)
toolkit.persona.asset.removeIncome(eventId, entityType, entityId)

toolkit.persona.asset.settle(entityType, entityId)
//   → 强制结算：把 accrued 合到 assetBalance，推进 assetLastSettledAt
```

**典型调用**（商城 App）：

```js
// 扣买家侧的钱
async checkout(buyerId, totalPrice, note) {
    const entityType = buyerId.startsWith('ai') ? 'ai' : 'user';
    const newBalance = await toolkit.persona.asset.adjust(
        -totalPrice, note, entityType, buyerId,
    );
    if (newBalance < 0) {
        // 撤销（实际由 adjust 内部钳制在 ≥0）
    }
    return newBalance;
}
```

### 3.9 ★ 新增人设模块的三处同步（v1.3 共识）

新增一个动态模块时，**必须三处同步**，缺一处就会「看不见 / 没法 toggle / 保存失败」：

1. **`js/apps/setting/world/sdk/persona.js` → `MODULE_KEYS`** 白名单
2. **`profile-schema.js` → `AI_PERSONA_GROUPS` / `USER_PERSONA_GROUPS`** 一个 group 项
3. **`profile-schema.js` → `*_FIELDS` 常量** + **`defaults.js`** 里 `users / ai` 实例默认值

**调试对照表**：

| 现象 | 缺哪一步 |
|------|----------|
| UI 看不到该模块开关（连 toggle 都没有） | 缺 `AI_PERSONA_GROUPS` |
| UI 看到开关但点击无反应 | 缺 `MODULE_KEYS` |
| 字段被渲染（toggle 开了），输入完点保存再切回来发现没了 | 缺 `defaults.js` |
| 保存后 `enabled` 被错误重置为 `false` | 用了 `api.update` 整体覆盖而不是字段级 patch |

---

## 4. ★ 跨 App 数据协议

> **核心结论**：跨 App 数据只有 **5 条主通道**。

### 4.1 通道 1：`services` —— 「方法调用」

A App 写 `services`，B App 通过 `externalAppRegistry.invokeService(appId, method, payload)` 调。

```js
// 我的 App 暴露
services: {
    async getCurrentState() {
        return this.app.state;
    },
    async handleDeepLink(payload) {
        // 接收 deep link（见 §4.3）
    },
}

// 别的 App 调用
const result = await externalAppRegistry.invokeService('my-app', 'getCurrentState');
```

### 4.2 通道 2：`sharedRecords` —— 「共享记录」

把"一条东西"丢进 `sharedRecords` 表（IndexedDB），任何 App 可以 `listByTarget(targetApp)` 拿。

```js
// 音乐 App 发一起听邀请给聊天 App
await toolkit.shared.put({
    targetApp: 'chat',
    entityType: 'listenTogetherInvite',
    entityId: `invite-${Date.now()}`,
    title: '一起听「晴天」',
    summary: '点开进入音乐 App',
    payload: { songId, inviteeAiId },
});

// 聊天 App 读发给自己的邀请
const records = await toolkit.shared.listByTarget('chat');
```

### 4.3 通道 3：`deepLink` —— 「派去做一件事」

A App 给 B App 发一条 `{ targetAppId, pageId, payload }`，framework 打开 B App、跳到对应 page、并调用 `B.services.handleDeepLink(payload)`。

```js
// 音乐 App：结束一起听，通知设置 App 写人设
await toolkit.actions.deepLink(
    'setting',
    'personaHome',
    { action: 'recordListenTime', aiId: 'ai0', sessionId, durationMs }
);
```

### 4.4 通道 4：`settingsSdk` —— 「系统事实表」

**最高频、最重要**。详见 §3。

### 4.5 通道 5：`shareRecord` —— 「广播」

```js
toolkit.actions.share({
    targetAppId: 'chat',
    entityType: 'post',
    entityId: 'post-123',
    payload: {...},
});
```

### 4.6 通道选择速查表

| 场景 | 用哪个 | 为什么 |
|------|--------|--------|
| 想知道当前播放的歌曲 | `services.getCurrentState()` | 实时，不需要持久化 |
| 一起听时长写进小黄人设 | `deepLink('setting', 'personaHome', ...)` + settingsSdk.diary | 单向事件 |
| 给聊天 App 显示一起听卡片 | `sharedRecords.put(...)` | 卡片要持久化、跨会话 |
| 博客发了新博文广播给所有 App | `shareRecord(...)` | 全局广播 |
| 聊天 App 显示 AI 列表 | `settingsSdk.aiPersons.list()` | 系统事实表 |
| 任何 App 读世界观当前时间 | `settingsSdk.chronology.format(...)` | 系统事实表 |
| **商城扣买家钱** | **`toolkit.persona.asset.adjust(-price, note, type, id)`** | 走桥，自动 settle |

---

## 5. ★ 小组件（Widget）

App 在 `appConfig.widgets` 挂一组 widget → 系统自动注册到 `window.APP_WIDGETS` → 桌面长按进入编辑模式 → 点灵动岛呼出 widget picker → 选一个 widget → 落桌面。

### 5.1 widget 字段定义

```js
widgets: [
    {
        id: 'quick-counter',
        label: '计数器',
        icon: '<svg viewBox="0 0 24 24">...</svg>',
        iconBg: 'linear-gradient(145deg, #6366f1, #8b5cf6)',
        defaultSize: 'S',                                 // 'S'(2x1) | 'M'(2x2) | 'L'(4x2)
        defaultOrientation: 'h',                          // S 才有意义

        render(size, payload) {
            const safe = escapeHtml(payload.label || '');
            return `<div class="p-2">${safe}</div>`;
        },
        renderItem(size, payload) { return this.render(size, payload); },
        onTap() {
            this.toolkit.actions.openApp('my-app', 'main');
        },
    },
],
```

### 5.2 widget payload

`render(size, payload)` 收到的 payload：

```js
{
    size: 'S',
    orientation: 'h',
    label: '...',
    icon: '...',
    iconBg: '...',
    qualifiedId: 'my-app::quick-counter',
    instanceId: 'wb-xxxxxxxx',                           // 桌面唯一
}
```

---

## 6. ★ 灵动岛（Dynamic Island）

通过 `toolkit.island` 控制。

### 6.1 size 形态

| size | 形态 | 何时用 |
|------|------|--------|
| `mini` | 单行药丸 | 轻提醒、后台歌 |
| `medium` | 圆角矩形 + 图标 + 标题 + 副标题 | 任务进行中 |
| `large` | 大面板 | 复杂状态 |

### 6.2 弹通知（自动 3.5s 消失）

```js
toolkit.island.notify(
    'success',                                           // success | warning | error | info | message | call | system
    '已保存',
    '草稿已自动保存',
    { duration: 5000, icon: '<svg>...</svg>' }
);
```

### 6.3 显示持续态（直到主动 dismiss）

```js
toolkit.island.show('medium', {
    type: 'info',
    title: '下载中',
    message: 'episode-03.mp3',
    detail: '38% · 1.2MB/s',
    lifecycle: 'manual',
    maxSize: 'large',
    onClosed: ({ reason }) => { ... },
});
```

---

## 7. ★ App 使用图库

> **真实结构**：「图库 (Library) → 图包 (Album) → 图组 (Group) → 图片 (Image)」4 层，**独立 IndexedDB `gallery_db`**（不在 settingsSdk 里）。

### 7.1 通过 settings.services 调用图库

```js
// 方式：通过 externalAppRegistry.invokeService
const url = await externalAppRegistry.invokeService('settings', 'galleryGetImageUrl', {
    code: '030101'
});

const images = await externalAppRegistry.invokeService('settings', 'galleryListGroupImages', {
    groupId: 'grp_xxx'
});
// → [{ code, name, thumbnail, originalSize }]
```

### 7.2 XSS 与图库 URL

**⚠️ 图库 URL 由 IndexedDB 读出，是不可信源**。

```js
// ✅ 安全
return `<img src="${escapeHtml(url)}" />`;

// ❌ 危险
return `<img src="${url}" />`;           // 如果 url 含 " onerror=... 会炸
```

---

## 8. ★ App 使用世界观

### 8.1 读世界观基础数据

```js
const sdk = window.settingsSdk;
const activeWorld = sdk.worlds.getActive();               // 当前激活世界观
const allWorlds = sdk.worlds.list();                      // 全部

// 时间
const chrono = sdk.chronology.getConfig(activeWorld.id);
const nowStr = sdk.chronology.format(Date.now(), 'full', activeWorld.id);
// → "纪5/章3/日14 子时"

// 事件 / 时间线
const events = sdk.timelines.list({ worldRef: activeWorld.id });
```

### 8.2 读地点 / 场所

```js
// 列出某世界观下的地点
const places = sdk.places.list({ worldRef: worldId });

// 列出某地点下的场所
const locations = sdk.locations.list({ worldRef: worldId });
const locsOfPlace = locations.filter(l => l.placeRef === placeId);

// 拿单个
const place = sdk.places.get('place_a-city');
const loc = sdk.locations.get('loc-school');
```

### 8.3 读纪时

```js
sdk.chronology.realToWorld(realDate, worldId)             // → { year, month, day, hour, minute }
sdk.chronology.worldToReal({ year, month, day, hour, minute }, worldId)
sdk.chronology.format(timestamp, 'full'|'date'|'time'|'verbose', worldId)
sdk.chronology.getHourName(hour, worldId)                 // '子时' 或 '00时'
```

---

## 9. ★ App 使用人设

### 9.1 读人设数据

```js
const sdk = window.settingsSdk;
const aiList = sdk.aiPersons.list();                      // AI 人设列表
const userList = sdk.users.list();                        // 用户人设列表
const activeAi = sdk.aiPersons.getActive();              // 当前激活 AI
```

### 9.2 读日记

```js
const today = sdk.diary.getToday('ai', 'ai0');
// → { date, mood, segments: [...] }

await sdk.diary.addSegment('ai', 'ai0', '2026-07-30', {
    text: '一起听《晴天》30 分钟',
    source: 'manual',
});
```

### 9.3 读资产

```js
const snap = toolkit.persona.asset.snapshot('ai', 'ai0');
// → { balance, accrued, baseBalance, currency: { name, unit }, events: [...] }
```

---

## 10. App 的"轻量 vs 重量"分层

| 档位 | 接入工作量 | 需要的能力 | 代表 |
|------|-----------|-----------|------|
| **轻量** | < 50 行 | `toolkit` + IndexedDB + 灵动岛 | prompt-survey、framework-test-app |
| **中量** | 200-500 行 | + settingsSdk 读人设 / 世界观 | 假想的「聊天 App」 |
| **重量** | 1000+ 行 | + 图库 + 多人设切换 + 阶段感知 + 跨 App deepLink | 「博客 App」「商城 App」 |

---

## 11. 给新 App 作者的最短路径

1. **读 `AGENTS.md`**：项目骨架、ESM、App 原型、actions
2. **读本文档 §1 ~ §3**：appConfig 字段 + settingsSdk 速查
3. **看 `prompt-survey.js`**：最小 App 范例
4. **看 `setting/main.js`**：系统级 App 范例（含 hydrate / services / detail pages）
5. **读本文档 §5 ~ §9**：widget / island / 图库 / 世界观 / 人设

---

## 12. 文件结构（已实现）

```
js/apps/
├── prompt-survey.js                  # Prompt 调研
├── framework-test-app.js             # 框架联调测试
├── placeholder-apps.js               # 占位 App（仅供翻页调试）
├── index.js                          # 静态 import + registerPhoneApp
└── setting/                          # ★ 设置 App（系统大头）
    ├── main.js                       # 主入口（appConfig 装配）
    ├── defaults.js                   # UI / 数据默认值
    ├── tokens.js                     # 设计 token
    ├── ui-components.js              # renderRow / renderGroup
    ├── ui-helpers.js
    │
    ├── state/                        # App 自身 state
    │   ├── methods.js
    │   ├── services.js               # ★ 对外 services（含 gallery*）
    │   ├── hydrate.js
    │   └── normalize.js
    │
    ├── appearance-general/           # 外观与通用
    │
    ├── user/                        # 用户人设编辑器
    │
    ├── ai/                          # AI 人设编辑器
    │
    ├── persona/                      # ★ 人设主页
    │   ├── index.js
    │   ├── home-section.js
    │   ├── home-methods.js
    │   ├── section.js
    │   ├── methods.js
    │   ├── renderer.js
    │   ├── income-engine.js        # ★ v4.1 资产计算
    │   ├── persona-bridge.js        # ★ toolkit.persona.asset 桥
    │   ├── diary-generator.js
    │   └── resources-section.js     # ★ 资源绑定（含 prompt picker）
    │
    ├── world/                       # 世界观编辑器
    │   ├── bootstrap.js
    │   ├── library.js
    │   └── sdk/                    # ★ settingsSdk 实现
    │       ├── settings-sdk.js    # 总入口
    │       ├── crud.js             # 通用 CRUD 工厂
    │       ├── groups.js           # 世界观组
    │       ├── tags.js             # 标签组 / 标签
    │       ├── geo/                # ★ 地点 + 场所
    │       ├── snapshots.js        # 每日快照 + 加权随机
    │       ├── profile.js          # profile 模式
    │       ├── timelines.js        # 时间线
    │       ├── drafts.js           # 草稿
    │       ├── anchors.js           # 时间锚点
    │       ├── chronology/          # 纪时
    │       ├── bus.js              # 事件总线
    │       ├── defaults.js
    │       ├── profile-schema.js
    │       ├── persona.js          # ★ persona SDK
    │       ├── diary.js           # ★ diary SDK
    │       └── schedule.js         # ★ schedule SDK
    │
    ├── gallery/                    # ★ 图库（独立 DB）
    │   ├── index.js
    │   ├── section.js
    │   ├── gallery-db.js
    │   ├── gallery-methods.js
    │   └── gallery-events.js
    │
    ├── prompt/                      # ★ Prompt 工程（独立 DB）
    │   ├── index.js
    │   ├── section.js
    │   ├── prompt-db.js           # ★ IndexedDB CRUD
    │   ├── prompt-methods.js
    │   └── sdk/
    │       └── prompts.js         # ★ prompts SDK（待接入 settings-sdk.js）
    │
    └── sections/                   # 通用 section
```

---

## 13. 文档关联图

```
┌─────────────────────┐      ┌─────────────────────┐
│  世界观制作思路.md   │◄────►│  人设制作思路.md     │
│                     │      │                     │
│  places / locations │◄────►│  lifePhases         │
│  chronology         │      │  (阶段引用世界观地点)│
│  timelines          │      │  preferences / habits│
│  worldGroups / tags │      │  paro / probability │
└──────────┬──────────┘      └──────────┬──────────┘
           │                            │
           ▼                            ▼
┌─────────────────────────────────────────────────────┐
│                settingsSdk (window.settingsSdk)      │
│  users / aiPersons / worlds / places / locations /  │
│  tags / timelines / drafts / chronology /            │
│  persona.* / persona.asset.* / diary / schedule /   │
│  events / cache                                   │
└─────────────────────────────────────────────────────┘
           ▲                            ▲
           │                            │
           │         ┌──────────────────┘
           │         │
           │   ┌─────┴─────────┐
           │   │ toolkit.persona │
           │   │ .asset.*       │ ← persona-bridge.js
           │   └───────────────┘
           │
┌──────────┴──────────┐
│  settings.services    │
│  galleryGetImageUrl │
│  galleryGetGroupPath│
└─────────────────────┘
```

---

## 附录 A：完整最小 App 模板

```js
// js/apps/hello.js
import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';

export default function createHelloApp() {
    return {
        id: 'hello',
        name: '你好',
        icon: `<svg viewBox="0 0 60 60" width="60" height="60" xmlns="http://www.w3.org/2000/svg">
            <rect width="60" height="60" rx="14" fill="#10b981" />
            <text x="30" y="38" font-size="24" text-anchor="middle" fill="white"
                  font-family="-apple-system">Hi</text>
        </svg>`,
        iconBg: 'linear-gradient(145deg, #10b981, #06b6d4)',
        background: 'linear-gradient(180deg, #ecfeff, #ffffff)',
        statusBarColor: '#064e3b',
        dock: { visible: true, order: 99 },
        topbar: { visible: true, title: '你好 App', subtitle: '最小范例' },

        pages: [{ id: 'main', label: '主页', icon: '◦', nav: true }],
        defaultRootPageId: 'main',

        setup() {
            return { counter: 0, message: 'Hello, world!' };
        },

        methods: {
            async bumpCounter() {
                this.app.state.counter = (this.app.state.counter || 0) + 1;
                this.app.state.message = `点击次数：${this.app.state.counter}`;
                this.toolkit.island.notify('success', '已更新', this.app.state.message);
                window.refreshPhoneApps?.();
            },

            async loadAIList() {
                const sdk = window.settingsSdk;
                if (!sdk) return [];
                return sdk.aiPersons.list().map(p => ({
                    id: p.id, name: p.name, avatar: p.avatar,
                }));
            },
        },

        services: {
            async getCounter() { return this.app.state.counter; },
        },

        widgets: [
            {
                id: 'hello-counter',
                label: '计数器',
                icon: '<svg viewBox="0 0 24 24"><text x="12" y="18" text-anchor="middle">★</text></svg>',
                iconBg: '#10b981',
                defaultSize: 'S',
                defaultOrientation: 'h',
                render(size, payload) {
                    return `<div class="p-2 text-slate-900">${escapeHtml(payload.label || '点击我')}</div>`;
                },
                onTap() {
                    this.methods.bumpCounter();
                },
            },
        ],

        renderPage(content, page, app) {
            const msg = escapeHtml(app.state?.message || '');
            const action = createActionAttr({ action: 'appMethod', method: 'bumpCounter' }, app.id);
            return `
                <div class="space-y-3">
                    <section class="app-card bg-white/76">
                        <div class="text-[20px] font-bold text-slate-900">${msg}</div>
                        <div class="mt-2 text-sm text-slate-600">点击按钮调用 methods.bumpCounter()</div>
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

const appFactories = [
    { name: 'prompt-survey',     factory: createPromptSurveyApp },
    { name: 'framework-test-app', factory: createFrameworkTestApp },
    { name: 'placeholder-apps',  factory: createPlaceholderApps },
    { name: 'settings',           factory: createSettingApp },
    { name: 'hello',              factory: createHelloApp },           // ← 新增
];
```

刷新浏览器，桌面上就有「你好」图标了。

---

*最后更新：2026-07-30 v2.0（清理过时 SDK 接口，统一为 window.settingsSdk）*
