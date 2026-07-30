# 待办 / TODO（综合）

> 本文档把 **「App 制作思路.md / 世界观制作思路.md / 人设制作思路.md」** 三份文档里提到的「尚未实现」或「设计愿景 vs 当前现状」的缺口整合成一份**总待办清单**，并按优先级排序。
>
> **版本**：v1.0（综合 v0.18 代码 + 三份文档 v1.0 / v3.0 / v4.0）
> **最后更新**：2026-07-17

---

## 0. 速览

按优先级分四级：

| 等级 | 含义 | 数量（粗估） |
|------|------|-------------|
| 🔴 **P0** | 阻塞整个 App 生态的"基础设施"缺口 | ~5 项 |
| 🟠 **P1** | 影响 80% App 接入体验的核心功能缺口 | ~12 项 |
| 🟡 **P2** | 重要但可分阶段推进的体验/联动缺口 | ~15 项 |
| 🟢 **P3** | 远期愿景 / 文档 / 工程优化 | ~10 项 |

---

## 1. 🔴 P0 — 阻塞项（先做这些，否则其他都跑不起来）

### 1.1 三份文档 ↔ 当前实现的根本性差距

| # | 缺口 | 现状 | 来源 |
|---|------|------|------|
| P0-1 | `settingsSdk.persona` 的 7 模块只暴露 `get / toggle / setInject`，**没有 addItem / updateItem / removeItem** | 业务 App 想加 likes / hobbies 只能 patch 整个模块 | App 制作思路 §13 |
| P0-2 | `actions.deepLink('setting', 'personaHome', payload)` 时 **payload 参数丢失** | 音乐 App 一起听 → 设置 App 写日记流程跑不通 | App 制作思路 §13 + 人设 v4 §11 |
| P0-3 | `toolkit.callService(appId, method, payload)` 没挂在 `app-toolkit.js` | 业务 App 调别的 App 只能走 `externalAppRegistry.invokeService`，繁琐 | App 制作思路 §13 |
| P0-4 | **图库没有 SDK 直接入口**，只有 `settings.services.galleryGetImageUrl / galleryGetGroupPath / galleryListGroupImages` | 任何 App 用图库都得 invokeService，类型也不友好 | App 制作思路 §13 |
| P0-5 | `boundResources.avatarLibraryId → 图组 id` 的**自动映射表没建** | 头像轮换必须手动绑，死板 | App 制作思路 §13 |

> **这 5 个修完**，v0.18 → v0.19 就能发布，业务 App 可以开始接入 settingsSdk 之外的扩展。

---

## 2. 🟠 P1 — 核心 App 缺口（没有这些业务就跑不起来）

### 2.1 缺整个 App

| App 名 | 引用方 | 现状 |
|--------|-------|------|
| 聊天 App（`chat`） | 音乐一起听接收方、`openChatWith` / `aiNotify` deep link 目标、社媒展示的载体 | **未实现** |
| 音乐 App + 一起听 | P0-2 deep link 流程的发送方 | **未实现** |
| 博客 App | 社媒展示的博文来源、`shareRecord` 广播的发送方 | **未实现** |
| 日记浏览 / 编辑 App | 当前日记完全在设置 App 里，没有独立 App | **未实现**（数据在 `settingsSdk.diary`，但无独立浏览 UI） |
| 商城 App | 资产系统的消费侧（人设 v4 §18 TODO 之一） | **未实现** |
| 日历 / 课表 App | 人设 `schedule` + 世界 `routines` + 时间表视图的消费侧 | **未实现** |
| 相册 App | 人设 v4 §17.2 "相册 App 给照片打 location tag" | **未实现** |
| 地图 App | 世界 `places` 可视化、场所与地图联动 | **未实现** |
| 天气 App | 人设 `moodProbability.affectedBy` 依赖 | **未实现** |
| 头像编辑器 App | avatar 轮换策略 UI | **未实现** |

> 上面这些 App 是三份文档里**反复引用但目前不存在的目标接收方**。先有的，后补。这是文档 → 现实的"主要负债"。

### 2.2 settingsSdk 还要补的二级 API

| API | 用途 | 来源 |
|-----|------|------|
| `sdk.persona.module.addItem(persona, name, item)` | 7 模块加一条 | P0-1 |
| `sdk.persona.module.updateItem(persona, name, id, data)` | 7 模块改一条 | P0-1 |
| `sdk.persona.module.removeItem(persona, name, id)` | 7 模块删一条 | P0-1 |
| `sdk.gallery.listAlbums(libId)` | 图库 4 层结构顶层 | App §8 |
| `sdk.gallery.listGroups(albumId)` | 4 层第二层 | App §8 |
| `sdk.gallery.listImages(groupId)` | 4 层第三层（已有 services 等价） | App §8 |
| `sdk.gallery.getImageUrl(code)` | 拿图片 URL（已有 services 等价） | App §8 |
| `sdk.avatarGroupMap` | 自动把 avatarLibraryId 映射到图组 | P0-5 |

### 2.3 跨层联动基础（要先把钩子做出来）

| # | 缺口 | 影响 |
|---|------|------|
| P1-3 | **记忆自动同步到时间轴**：`persona.memory.syncToTimeline=true` 时，加 `important` 自动建 `world.timeLine` 事件 | 人设 v4 §18 + §11.3 |
| P1-4 | **作息自动回流**：schedule 更新时按 `syncToWorldRoutines` 写到 `world.routines[]` | 人设 v4 §18 + §11.4 |
| P1-5 | **资产持有按 defaultValue 初始化**：人设创建时按绑定的世界 `world.assets[].defaultValue` 自动建 `holdings[]` | 人设 v4 §18 + §11.5 |
| P1-6 | **`settingsSdk.drafts` 草稿持久化**：UI 触发点 + `beforeunload` 保存 | 三份文档都列了，但实现细节少 |

---

## 3. 🟡 P2 — 世界观 v3 新模块缺口

> 世界观 v3.0 把模块切成"**空间 / 时间 / 资产 / 夹子**"四大块。当前实现：
> - 空间（places/locations）✅
> - 时间（chronology + timelines + anchors）⚠️ 部分
> - 资产（assets）❌ **v3 全新未做**
> - 夹子（clip）❌ **v3 全新未做**

### 3.1 资产系统（v3 新增）

| # | 缺口 | 工作量 |
|---|------|--------|
| P2-1 | `world.assets[]` 数据结构 + IndexedDB `assets` 表 | 中 |
| P2-2 | SDK CRUD：`getAssets / getAssetById / createAsset / updateAsset / deleteAsset / getAssetsByCategory / searchAssets / getAssetUnitMap` | 中 |
| P2-3 | 设置 App 内"资产 Tab" UI（列表 / 表单 / 默认值） | 中 |
| P2-4 | 资产类型预设（电竞 / 修仙 / 现代校园 3 套示例） | 小 |
| P2-5 | 商城 App（消费侧） | 大（见 §2.1） |

### 3.2 夹子系统（v3 新增）

| # | 缺口 | 工作量 |
|---|------|--------|
| P2-6 | `world.clip.knowledge[]` 碎知识 prompt 库 UI（列表 / 表单 / 引用追踪） | 中 |
| P2-7 | `world.clip.presets[]` 预设模板 UI（创建 / 应用 / 列表） | 中 |
| P2-8 | 导入导出：包结构、manifest、冲突解决、版本管理 | 大 |
| P2-9 | 草稿保存：UI + IndexedDB `worldDrafts` | 中 |
| P2-10 | `toolkit.world.getKnowledgeAsPrompt(worldId, knowledgeIds)` prompt 拼接器 | 小 |

### 3.3 时间系统缺口

| # | 缺口 | 来源 |
|---|------|------|
| P2-11 | `mapToSystem = true` 后**所有 App 的时间字段自动换算**（状态栏、灵动岛、日记、聊天、日历） | 世界观 §11 + §4.7 |
| P2-12 | 事件触发器跑通：`avatarChange / stickerChange / aiNotify / appRecord / phaseAdvance` 5 类 | 世界观 §4.9 |
| P2-13 | 三视图 UI：时间轴、时间锚点、时间表的完整 UI（部分实现） | 世界观 §4.8 |
| P2-14 | `world.routines[]` 数据来源：当前只能手填，缺 P1-4 的回流钩子 | 世界观 §11 |
| P2-15 | 预设模板市场（分享 / 下载中心） | 世界观 §11 |

### 3.4 空间系统缺口

| # | 缺口 | 来源 |
|---|------|------|
| P2-16 | 地图视图 UI（`mapConfig.backgroundImage` 渲染、坐标点位 hover） | 世界观 §11 |
| P2-17 | 地点图片上传（场所详情页配图） | 世界观 §11 |
| P2-18 | 场所与地图联动视图（点地图 → 展场所列表） | 世界观 §11 |

---

## 4. 🟡 P2 — 人设层缺口

| # | 缺口 | 优先级 | 来源 |
|---|------|--------|------|
| P2-19 | parO 运行时合并：`getEffectivePersona(parOId)`（parO 字段 + parent 字段 + default 三段合并） | 高 | 人设 §4.3 |
| P2-20 | parO `syncFromParent(parOId, fields)` 选择性同步 | 中 | 人设 §4 |
| P2-21 | 人生阶段**自动推进**（达到 `ageRange` 上限自动切） | 中 | 人设 §5.4 |
| P2-22 | `moodProbability.affectedBy` 实际拉取（recentEvents / weather / relationshipChanges） | 中 | 人设 §8.2 |
| P2-23 | 每日计算 `dailyCalculate` 的触发入口（首聊、定时器、设置页"重算"按钮） | 中 | 人设 §9 |
| P2-24 | `boundResources.avatarLibrary.autoRotate` 跑通（头像轮换依赖 P0-5） | 高 | 人设 §6 |
| P2-25 | `boundResources.stickerLibrary` 表情包轮换（依赖相册 / 图库 App） | 中 | 人设 §6 |
| P2-26 | `boundResources.apiAccounts[]` 第三方 API（weibo / discord）实操，目前是空架 | 低 | 人设 §6 |
| P2-27 | 双向关系好感度同步：`boundPersonaId` 互绑后双方 affection 一起变 | 中 | 人设 §3.6 |
| P2-28 | `affectionLog` 自动维护（每次好感度变都 append） | 中 | 人设 §3.6 |
| P2-29 | `social.relations[].type` 扩展支持 `family / colleague / rival / stranger` 全套 UI | 中 | 人设 §3.6 |
| P2-30 | parO 列表 UI、选择器、parO 字段编辑器（**目前 UI 简化得厉害**） | 中 | 人设 §4.4 |

---

## 5. 🟡 P2 — 文档冲突 / 待澄清

三份文档互相冲突的点，**写代码前先决策**：

| # | 议题 | 冲突点 | 现状 |
|---|------|--------|------|
| P2-31 | **社媒系统归属** | 人设 v4 §7 保留 `toolkit.social.recordContext / cleanupExpired`；App v1 §10 说"v0.18 移除独立社媒，归并到 diary" | 需要决策：复活独立社媒 vs 完全用 diary |
| P2-32 | **记忆 vs 日记合并** | 记忆三段（named / daily / important）vs 日记（mood + segments）都在写"今天发生的事" | 需要明确两者关系 / 重叠策略 |
| P2-33 | **API 命名一致性** | 世界观文档用 `toolkit.world.*`，代码用 `settingsSdk.places.* / settingsSdk.locations.* / settingsSdk.timelines.*` | 文档 vs 代码命名分裂，要统一 |
| P2-34 | **人设 SDK 入口** | 人设文档 `toolkit.persona.*`，代码 `settingsSdk.persona.*`（由 `bindPersona(sdk)` 挂载） | 同样分裂 |
| P2-35 | **阶段系统归属** | 世界观 v3 §10.2 "阶段全部下放到人设侧，废除世界级 phase 接口"；人设 v4 §5 还在用 | 代码里是否真的清除了世界级阶段 API？ |
| P2-36 | 老代码 migration | 老代码 `window.myDb / window.musicDb`，新代码 `window.settingsSdk` | 兼容层是否清理掉 |

---

## 6. 🟢 P3 — 文档 / 工程 / 体验

### 6.1 文档缺口

| # | 缺口 |
|---|------|
| P3-1 | **README** 没写（项目根需要一份 1 页能跑通的上手指南） |
| P3-2 | 三份文档里的 "✅ 完成" 状态需要跟代码 v0.18 对账，更新不一致项 |
| P3-3 | `CHANGELOG.md` 没有，每次大版本没有历史 |
| P3-4 | "App 作者快速上手" 指南：把三份设计文档压成 1 页流程 |
| P3-5 | widget / 灵动岛 / Deep Link 的 recipe 集合 |
| P3-6 | settingsSdk 内每个 scope 的字段说明（现在散在各处） |

### 6.2 工程 / 性能

| # | 缺口 |
|---|------|
| P3-7 | settingsSdk hydrate 后 `list()` 缓存与失效策略文档化 |
| P3-8 | IndexedDB 索引补全（按 `worldRef` / `personaId` / `ownerId` 查） |
| P3-9 | 大数据量渲染（百级世界观 + 千级人设 + 万级日记段）性能 |
| P3-10 | 单文件 build（`build:single`）对 IndexedDB / 图库资源的边界测试 |
| P3-11 | 离线测试（无网络）是否完整可用 |

### 6.3 体验细节

| # | 缺口 |
|---|------|
| P3-12 | 桌面 widget picker 当前可选项极少（只有 prompt-survey 等几个） |
| P3-13 | 灵动岛自定义模板对业务 App 的"开箱即用"流程 |
| P3-14 | 设置 App 内"夹子 Tab"、"资产 Tab" 整体 UI |
| P3-15 | XSS 警告 lint 规则：模板字符串里出现 `${userInput}` 时编辑器告警 |

---

## 7. 三类缺口之间的依赖关系（执行顺序建议）

```
[1] P0-1~P0-5                    // SDK 基础，修完才能"接业务"
   │
   ▼
[2] P2-1~P2-2（资产 SDK CRUD）  // 为商城 App / 人设 holdings 铺路
[3] P1-3~P1-5（数据回流钩子）    // 让联动跑起来
   │
   ▼
[4] §2.1 列的 10 个 App           // 第一个是聊天（接 music deep link）+ 商城（接 asset）
   │
   ▼
[5] §3.2 夹子 + §3.3 P2-11（时间映射） // 动手机制完整
[6] §4 人设剩余缺口（parO / 阶段自动推进 / mood affectedBy）
[7] §5 文档冲突（P2-31~P2-36）        // 下一个大版本前必须澄清
[8] §6 P3 长尾                          // 持续打磨
```

---

## 8. 已完成项（从三份文档抽出来做对账基线）

> 防止新版本回退到未实现状态。

| 模块 | v0.18 状态 | 来源 |
|------|-----------|------|
| 框架：registerPhoneApp / actions / 灵动岛 / widget | ✅ | AGENTS.md |
| IndexedDB：myDb / musicDb 封装 | ✅ | App §2 |
| settingsSdk：users / aiPersons / worlds / worldGroups / tagGroups / tags / places / locations / snapshot / profile / timelines / drafts / anchors / chronology | ✅ | App §3 |
| settingsSdk.diary（v0.18 新） | ✅ | App §3.4 |
| settingsSdk.events 事件总线 | ✅ | App §3.5 |
| settingsSdk.weightedPick / escape / cache | ✅ | App §3 |
| settingsSdk.persona.module.get / toggle / setInject | ✅ | App §3.3 |
| settingsSdk.persona.phases.list / add / update / remove / activate / active | ✅ | App §3.3 |
| settingsSdk.persona.paro.list / clone / update / remove | ✅ | App §3.3 |
| settingsSdk.persona.probability.roll / dailyCalculate / setWeights | ✅ | App §3.3 |
| settingsSdk.persona.resources.get / update | ✅ | App §3.3 |
| 人设：本体 8 字段 | ✅ | 人设 §2 |
| 人设：7 个动态模块（含 injectToPrompt / enabled） | ✅ | 人设 §3 |
| 人设：人生阶段（去关系阶段 / 双轨制 / 转折 / 阶段记忆） | ✅ | 人设 §5 |
| 人设：parO 平行卡（clone / list / parent 引用） | ✅ | 人设 §4 |
| 人设：boundResources 接口 | ✅ | 人设 §6 |
| 人设：moodProbability / dailyCalculate / 每日快照 | ✅ | 人设 §8 / §9 |
| 人设：drafts 接口 | ✅ | 人设 §12（表面） |
| 人设：import / export（包 + manifest + 冲突策略） | ✅ | 人设 §13（表面） |
| 世界观 v3：places + locations（**places 在 v0.18 重做**） | ✅ | 世界观 §3 + App §9.2 |
| 世界观 v3：chronoSettings + 转换算法 | ✅ | 世界观 §4 |
| 世界观 v3：timeLine / anchors | ✅ | 世界观 §4.8（部分） |
| 世界观 v3：assets | ❌ | 世界观 §5 + §11 |
| 世界观 v3：clip.knowledge / presets / drafts | ❌ | 世界观 §6 + §11 |
| 世界观 v3：`mapToSystem` 模拟手机时间映射 | ❌ | 世界观 §4.7 + §11 |
| 世界观 v3：事件 triggers 跑通 | ❌ | 世界观 §4.9 |

---

## 9. 待办来源汇总

- **App 制作思路** §13（v0.18 → v0.19+ TODO 清单）—— 8 项已收入本文档 §1
- **App 制作思路** §1.3 现实存在的 App 清单（仅 4 个）—— 缺的 10 个 App 收入 §2.1
- **世界观 v3** §11 TODO 表 —— 12 项全部收入 §3 + §2.1
- **人设 v4** §18 TODO 表 —— 4 项全部收入 §1 / §2.2 / §4
- **隐含缺口**（三份文档反复引用但不存在的 App / 系统）—— 收入 §2.1

---

*最后更新：2026-07-17 v1.0*
