# Prompt 模块 · 设计方案（v0.1 草案）

> 起稿日：2026-07-30
> 前置：用户已确认 prompt 模块要走「**p 库 / p 包 / p 组 / prompt**」4 层结构，对齐现有图库的「Library / Album / Group / Image」4 层。
> 本文档回答三件事：
> 1. **4 层结构怎么对齐图库**
> 2. **是否与人设 / 世界观 / App 制作思路冲突**
> 3. **优先级怎么拼、时间窗怎么拼、变量怎么替换**
>
> 待办速记见 `待办/prompt`（那份是 todo，这篇是方案）。

---

## 📑 速查表（grep 这一段就能定位章节）

| 想做的事 | 跳到 |
|---|---|
| 看 4 层数据模型长啥样 | §1.2 |
| 看 prompt ID 编号规则 | §1.3 |
| 看 4 个 priority 数字怎么定 | §3.1 |
| 想让某条 prompt 比组里其它 prompt 优先级高 | §3.1a |
| 想让 prompt 只在某个时间段生效 | §3.2 |
| 想在 prompt 里用 `{{user.xxx}}` / `{{ai.name}}` 之类的变量 | §3.3 |
| 想让 prompt 在用户提到「吃饭」时才触发 | §3.6 |
| 想用「意思相近」兜底（用户没字面提到也能触发）| §3.6.6 |
| 想让聊久了自动压缩历史、变成 K0 / K1 / K2 | §3.7 |
| 想在 prompt 里写 `{{repeat:last10}}` | §3.8 |
| 看拼装器的伪代码 | §3.4 |
| 看 SDK 完整接口（`settingsSdk.prompts.xxx`）| §5 |
| 看我还没做但写下了的事（snippet / 向量 / 日历...）| §3.9 / §8 v0.2+ |

---

## 0. 现状速记

- `js/apps/setting/prompt/{section.js,index.js}` 仍是占位（"Prompt 工程开发中"）
- `window.settingsSdk` 还没有 `prompt` / `prompts` scope
- 人设侧的 `persona.injectToPrompt` 已经在等一个可被拼接的 prompt 源
- 世界观侧的 `toolkit.world.getKnowledgeAsPrompt(worldId, ids)` 已经预留了「碎知识 → prompt」接口，但是**单层、不分优先级、不带时间窗**
- App 制作思路 §3.1 已经把 `settingsSdk.prompt` 列进了 surface 表，但还没实现

> **结论**：prompt 模块的「位置」已经留好（`setting/prompt`、settingsSdk 入口），这次只需要：
> 1. 把数据层 + UI + SDK 补全；
> 2. 顺便补「优先级 / 时间窗 / 变量替换」三块拼装语义。

---

## 1. ★ 4 层结构 · 对齐图库

### 1.1 名称对照表

| 图库层 | Prompt 层（建议） | 类比含义 | 编号 |
|---|---|---|---|
| Library（图库） | **Prompt 库**（p 库） | 同一类 prompt 的集合，如「人设通用」「聊天语气」「工具类」 | `_num 0..9`（≤9 个） |
| Album（图包） | **Prompt 包**（p 包） | 一个具体主题的 prompt 集合，如「上班族的早晨」「深夜聊天」 | `_num 0..9`（≤9 个） |
| Group（图组） | **Prompt 组**（p 组） | 一个具体的「场景 / 角色 / 阶段」，组里只有 prompt 文本条目 | `_num 0..9`（≤9 个） |
| Image（图片） | **Prompt 条目**（prompt） | 一段纯文本（可含 `{{ai.name}}` 等变量），可被拼装进上下文 | 无独立编号（属于某个组） |

> **命名约定**：为和图库（p 库/p 包/p 组/prompt）的层级感保持一致，**Prompt 库 / 包 / 组** 在 UI 上仍可写作「Prompt 库 / 包 / 组」（"p 库/p 包/p 组" 是你的口语习惯，文档内部统一用全称；只有聊天里偷懒才用缩写）。

### 1.2 4 层数据结构

```js
// ===== Layer 1 · Prompt 库 =====
{
    id: 'plib_xxx',
    name: '人设通用',
    icon: '📚',
    color: '#7c3aed',
    _num: 0,                       // 0..9，全局唯一
    description: '适用于所有 AI 人设的基础 prompt',
    order: 0,
    createdAt, updatedAt,
}

// ===== Layer 2 · Prompt 包 =====
{
    id: 'ppkg_xxx',
    libraryId: 'plib_xxx',
    name: '聊天语气',
    _num: 0,                       // 同 library 内 0..9
    description: '控制 AI 在不同对话语境下的语气',
    order: 0,
    createdAt, updatedAt,
}

// ===== Layer 3 · Prompt 组 =====
{
    id: 'pgrp_xxx',
    packageId: 'ppkg_xxx',
    libraryId: 'plib_xxx',         // ★ 冗余，方便查询
    name: '深夜聊天',
    _num: 0,                       // 同 package 内 0..9

    // ★★★ 拼装相关字段 ★★★
    priority: 10,                  // 拼装顺序（数字越小越靠前 / 越优先），
                                  // 详见 §3.1
    injectionDepth: 0,            // ★ 注入深度（数字越小越靠底 / 越晚拼）
                                  //   详见 §3.1
                                  //   0 = 拼在上下文最底
                                  //   1 = 倒数第二
                                  //   2 = 倒数第三 ...类推
                                  //   默认 0
    timeWindow: {                  // ★ 时间窗：只有当前时间落在窗内才参与拼装
        enabled: false,
        start: '02:00',            // HH:MM
        end:   '03:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],  // 0=周日，可省略 = 每天
    },
    conditions: {                  // ★ 条件触发（v0.1 仅占位，预留）
        enabled: false,
        // 例：{ appId: 'calendar', match: { eventTitle: '考试' } }
        // v0.1 不实现，只留 schema
    },

    // ★★★ 关键词触发 · 组级配置 ★★★
    // 组内任何 prompt 项声明了 keywords[] 时，组级 historyDepth 控制扫描范围
    historyDepth: 1,               // ★ 关键词扫描深度（1-5）
                                   //   1 = 只扫描「最后 1 条历史消息」
                                   //   2 = 扫描最后 2 条
                                   //   ... 最深 5
                                   //   默认 1（用户可在 UI 自选，详见 §3.6）
                                   //   仅当组内 prompt 声明了 keywords[] 时才有意义

    enabled: true,                 // 整组开关（不开就不参与拼装，也不渲染给 AI）
    order: 0,
    createdAt, updatedAt,
}

// ===== Layer 4 · Prompt 条目 =====
{
    id: 'prompt_xxx',
    groupId: 'pgrp_xxx',
    packageId: 'ppkg_xxx',
    libraryId: 'plib_xxx',         // ★ 冗余
    order: 0,                      // 组内顺序

    // ===== ★★★ 个体覆盖字段（prompt 自己的 > 组的） ★★★ =====
    // 每个字段都是 { enabled, value } 形态：
    //   enabled = false → 不覆盖，沿用组（默认）
    //   enabled = true  → 用 value 覆盖组对应的字段
    priority: {
        enabled: false,             // true 时本条覆盖组的 priority
        value: 10,
    },
    timeWindow: {
        enabled: false,             // true 时本条覆盖组的时间窗
        start: '02:00',
        end:   '03:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    },
    injectionDepth: {
        enabled: false,             // true 时本条覆盖组的注入深度
        value: 0,                   // ★ 详见 §3.1
                                   //   0 = 永远在最底
                                   //   1 = 倒数第二
                                   //   2 = 倒数第三 ...类推
                                   //   null/undefined = 不用（跟着组走）
    },

    // ★★★ 关键词触发 · 条目级配置 ★★★
    // 声明本条 prompt 关心哪些关键词；拼装时扫描最近 N 条历史（由组级 historyDepth 控制），
    // 命中关键词 → 把那条历史消息整段注入到 prompt 上下文。
    // 详见 §3.6
    keywords: [],                   // 字符串数组，空数组 = 不启用关键词触发
                                   // 例：['吃饭', '餐厅', '外卖']
                                   // 匹配规则：v0.1 用 includes()（不分大小写），
                                   //          v0.2+ 升级正则（不破坏 schema）

    text: '你是 {{ai.name}}，当前时间 {{now}}，请用 {{user.tone}} 风格回应。',
    // ★ 文本支持 {{...}} 变量替换，详见 §3.3
    variables: [                   // ★ 可选：声明本条 prompt 用了哪些变量（用于 UI 提示 / 校验）
        'ai.name',
        'now',
        'user.tone',
    ],

    createdAt, updatedAt,
}
```

> **为什么不只做 1 层（直接 prompt 数组）**：
> 1. 跟图库保持一致 → 用户认知成本为 0；
> 2. **优先级 / 时间窗挂在「组」上**，不是单条 prompt 上 —— 一个组（场景）是一个语义单元，"凌晨 2-3 点的语气组"是一个整体概念；
> 3. 库的层级天然支持批量启用 / 整库 import-export。

### 1.3 编号与 ID 体系（完全照搬图库）

- p 库、p 包、p 组各自维护 `_num 0..9`，UI 上展示「`{{lib._num}}{{pkg._num}}{{grp._num}}`」三位编号（如 `002` = lib 0 / pkg 0 / grp 2）
- prompt 条目**没有 `_num`**，因为它的语义是「一组里的几条并列文本」，不是「一个独立可寻址的资产」
- ID 前缀：`plib_` / `ppkg_` / `pgrp_` / `prompt_`，绝不和图库（`lib_` / `alb_` / `grp_`）撞

### 1.4 IndexedDB 选型

**完全独立一个 DB**（参考图库 `gallery_db`）：

```js
// js/apps/setting/prompt/prompt-db.js
new ListenDb({
    dbName: 'prompt_db',          // ★ 跟 gallery_db 同级
    dbVersion: 1,
}).registerStore('libraries', 'id')
 .registerStore('packages',  'id')
 .registerStore('groups',    'id')
 .registerStore('prompts',   'id');
```

**理由**（直接抄图库的理由）：

1. prompt 数据可能很大（多库 / 多包 / 几百组 / 几千条），跟 settings 主 DB（users / aiPersons / worlds / diary）放一起会污染主 cache
2. 导入导出场景天然适合独立 DB
3. 图库已经验证过这条路，不会有新坑

### 1.5 文件结构（对照图库）

```
js/apps/setting/
├── prompt/
│   ├── index.js                 # 注册入口（re-export）
│   ├── section.js               # 渲染层（占位 → 4 层 UI）
│   ├── prompt-db.js             # ★ IndexedDB CRUD（照 gallery-db.js 抄）
│   ├── prompt-methods.js        # ★ 业务方法（照 gallery-methods.js 抄）
│   ├── prompt-events.js         # （可选）事件总线
│   ├── prompt-utils.js          # 工具：变量替换 / 时间窗判断 / 优先级排序
│   ├── prompt-builder.js        # ★ ★ 核心：buildPromptStack(context) → string[]
│   │
│   └── sdk/
│       ├── prompts.js           # ★ settingsSdk.prompts 的实现（照 gallery/services.js 抄）
│       └── ...                  # 预留：未来每层一个文件
```

---

## 2. 是否与人设 / 世界观 / App 制作思路冲突？

**结论：没有任何冲突，但有 3 个地方需要同步更新。**

### 2.1 冲突检测

| 检查项 | 人设 v4.3 | 世界观 v3.2 | App 制作思路 v1.3 | 是否有冲突？ |
|---|---|---|---|---|
| `persona.injectToPrompt` 字段 | 7 模块都有 | — | — | ❌ 不冲突，本方案新增的 prompt 库**默认全 persona 共享**，未来如需「某 persona 专属」再扩字段 |
| `world.clip.knowledge`（碎知识） | `knowledgeRefs` 引用 | ✅ 已经在 | — | ❌ 不冲突，**碎知识仍是世界观**；prompt 库是**更高一层的"跨库"机制**。两者的关系是：碎知识是「素材」，prompt 组是「场景化组装」 |
| `toolkit.world.getKnowledgeAsPrompt()` | — | ✅ 已预留 | — | ❌ 不冲突，本方案不动世界观的 SDK；prompt 库走自己的 `settingsSdk.prompts.buildStack()` |
| `settingsSdk.prompt` 入口 | — | — | ✅ §3.1 已列 | ❌ 不冲突，正中下怀，文档已经留好位 |
| 模块白名单机制 | §3.10 三处同步 | — | — | ⚠️ **部分相关**：prompt 组不挂人设，所以不走 MODULE_KEYS；但要避免「在 persona 里加 prompt 字段」的诱惑 |

### 2.2 需要同步更新的 3 处

1. **`App制作思路.md` §3.1 surface 表**
   - 把 `prompts` 行从「◆ 未实现」改成「✅ v0.x」
   - 列出 `prompts.{list, get, create, update, remove, buildStack}` 6 个方法

2. **`App制作思路.md` §3.2 CRUD 形态**
   - prompt 库 / 包 / 组都不是单一 `createEntityApi` 形态，需要单独文档说明

3. **`人设制作思路.md` §18 待办**
   - 「**Prompt 模块（v0.x 完成）**」追加条目
   - 说明：`persona.injectToPrompt` 现在可选「prompt 库」作为 prompt 源（具体形式见 §3.4）

### 2.3 一个**潜在的坑**（提前避雷）

> 人设 v4.3 现在的「AI 上下文拼装路径」是 `home-section.js §9`，从 `persona` 各字段直接拼。
>
> 引入 prompt 库后，**两条路必须明确分工**：
> - **人设字段 → 上下文**：硬编码在 `home-section.js §9`，负责「我是谁 / 我有什么」
> - **prompt 库 → 上下文**：由 `settingsSdk.prompts.buildStack()` 出，**不通过 persona 字段**，负责「场景怎么说话 / 什么时间怎么回应」
>
> ❌ **不要**把人设里加一个 `extraPrompts: string[]` 字段。理由：
> 1. prompt 库有自己的「组 / 优先级 / 时间窗」语义，扁平 string[] 塞不进去；
> 2. 库可以跨 persona 共享，塞到 persona 里就破坏了「库」的概念；
> 3. 跟现有「库 → 包 → 组」架构断层。

---

## 3. ★ 核心：拼装语义（最重要的一节）

用户原话：
> - "比如我设置一个每天 2:00-3:00 跟 AI 聊天的时候会启用的 prompt，在其他时间段，这个 prompt 就不会拼入上下文"
> - "AI 自己当前人设优先级就是 0，用户的人设优先级就是 1，聊天记录的优先级就是 2"
> - "prompt 可以根据时间拼接 …… 以后日历里的内容也是一种 prompt"
> - **"优先级管顶，注入深度管底；priority 决定谁在最上面，injectionDepth 决定谁在最底部"**

拼装结果不是单维排序，而是**两个独立轴**：

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   ★ 由 priority 决定顺序（从小到大，从顶往下排）             │
│   ┌──────────────────────────────────────────────────────┐   │
│   │  priority = 0 的人设段（系统 prompt 等）              │   │
│   │  priority = 1 的人设段                                │   │
│   │  ...                                                  │   │
│   │  priority = N 的普通 prompt 段                       │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                              │
│   ★ 由 injectionDepth 决定"挤在底部"的顺序（从小到大）      │
│   ┌──────────────────────────────────────────────────────┐   │
│   │  injectionDepth = 2 的 prompt（倒数第三）            │   │
│   │  injectionDepth = 1 的 prompt（倒数第二）            │   │
│   │  injectionDepth = 0 的 prompt（永远最底）            │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.1 ★ 两个轴：优先级 vs 注入深度

| 字段 | 控制 | 取值 | 默认 | 视觉位置 |
|---|---|---|---|---|
| **`priority`** | 谁**在顶** | number，越小越靠前 | 10 | 上方主区 |
| **`injectionDepth`** | 谁**在底** | number，越小越靠底 | 0（最底） | 底部固定区 |

**两个轴相互独立**：

- **普通 prompt 组**：只设 `priority`，`injectionDepth` 通常不设（或留 0 但不"挤底"）
- **特殊 prompt**（如"今晚挂个安全护栏"）：设 `injectionDepth = 0`，无论 priority 多高，最后都被挤到最底
- **重要 prompt**（如"今天是大结局"）：设 `priority = 0`，抢顶

**两轴的应用场景**：

| 轴 | 用途 |
|---|---|
| `priority` | **"系统 prompt 一样的东西"** —— 强制钉在顶部的硬指令（人设定义、聊天规则、安全护栏） |
| `injectionDepth` | **"护栏型 prompt"** —— 任何情况下都贴底附在上下文最后（兜底说明、最稳定的事实引用、收尾指令） |

**用户场景映射**（priority 列）：

| 来源 | priority | 备注 |
|---|---|---|
| AI 自己的人设（persona 本体 + 启用的模块） | **0** | 必须最先拼，定义「我是谁」 |
| 用户的人设（user persona） | **1** | 定义「你跟谁说话」 |
| 聊天记录 / 日记 / 历史 | **2** | 上下文记忆 |
| 世界观碎知识 | **3** | 背景设定 |
| 普通 prompt 组（默认） | **10** | 用户自定义的常规 prompt |
| 时间窗 prompt（深夜聊天） | **15** | 较高 priority 避免被覆盖 |
| 日历事件作为 prompt（未来） | **TBD** | 见 §3.5 |

**用户场景映射**（injectionDepth 列，**与 priority 正交**）：

| 来源 | injectionDepth | 备注 |
|---|---|---|
| 偶尔的"兜底说明 / 永远不会变的事实" | **0** | 永远在最底 |
| 偶尔的"次兜底" | **1** | 倒数第二 |
| 通常情况 | **null / 不设** | 跟组走，不挤底 |

> **关键点**：**priority 高 ≠ 挤底，priority 低 ≠ 抢顶**。两个轴**不要混用**：
> - 想抢顶 → 用 `priority`
> - 想挤底 → 用 `injectionDepth`
>
> 例外：**`injectionDepth` 启用时（无论是组还是 prompt），无视 priority 顺序，最终排在 mainStack 末尾**（详见 §3.4）。

### 3.1a ★ 个体覆盖组（自己的 > 组的）

**核心规则**：**prompt 自己的覆盖字段 > 组对应的字段**（个体粒度更细）。

每个覆盖字段都是 `{ enabled, value }` 形态：

```js
prompt = {
    text: '...',
    priority:        { enabled: false, value: 10 },     // 默认 false = 不覆盖 = 跟着组走
    timeWindow:      { enabled: false, start: '...', end: '...', daysOfWeek: [...] },
    injectionDepth:  { enabled: false, value: 0 },
}
```

**语义**：

- `enabled = false`（默认）→ 不覆盖，拼装时**沿用组的字段**
- `enabled = true` → 用 `value` 覆盖组的字段

**组的同名字段永远是"裸值"**（不带 enabled），由 prompt 决定要不要覆盖：

```js
group = {
    priority: 10,                    // 裸值
    injectionDepth: 0,               // 裸值
    timeWindow: { start: '02:00', end: '03:00' },   // 裸值（启用与否看 prompt）
}
```

**注意**：**timeWindow 跟 priority / injectionDepth 不一样**——它没有 `enabled` 在组上，组的时间窗**始终生效**（逻辑上是"组设定了一个时间规则，prompt 可继承或覆盖"）。详见 §3.2。

**拼装时的"取最终值"算法**：

```js
function resolveField(field, groupValue) {
    // field 是 prompt 上的 { enabled, value }
    return field?.enabled ? field.value : groupValue;
}

// 例
const finalPriority = resolveField(prompt.priority, group.priority);          // → number
const finalDepth    = resolveField(prompt.injectionDepth, group.injectionDepth);
const finalTW       = resolveField(prompt.timeWindow, group.timeWindow);       // → { start, end, daysOfWeek }
```

### 3.2 时间窗（timeWindow）

```js
timeWindow: {                       // ★ 用法是「布尔数组 + 时段」
    enabled: true,                  // 启用时间窗（只控制当前条是否被选中）
    start: '02:00',
    end:   '03:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],   // 可选，省略 = 每天
}
```

**判断逻辑**（`prompt-utils.js` 里实现）：

```js
function isInTimeWindow(tw, now = new Date()) {
    if (!tw?.enabled) return true;       // ★ 不启用 = 不限制（永远在窗内）
    const cur = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = tw.start.split(':').map(Number);
    const [eh, em] = tw.end.split(':').map(Number);
    const start = sh * 60 + sm;
    const end   = eh * 60 + em;
    // 支持跨午夜：22:00 - 02:00 也能算
    const inRange = start <= end
        ? cur >= start && cur < end
        : cur >= start || cur < end;
    if (!inRange) return false;
    if (Array.isArray(tw.daysOfWeek) && tw.daysOfWeek.length < 7) {
        return tw.daysOfWeek.includes(now.getDay());
    }
    return true;
}
```

**用户的「凌晨 2-3 点聊天 prompt」**直接套这个字段：
- enabled = true
- start = '02:00', end = '03:00'
- daysOfWeek = 全选

**关键点**：
- **时间窗只在拼装阶段生效**，不影响 UI 编辑；UI 上要明显标注「⚠️ 仅 X-Y 时间生效」。
- 组设了 timeWindow 后，组内 prompt 都可以**单独再覆盖**一组时间窗（详见 §3.1a）。
- **不启用 = 永远参与**：`enabled = false` 的 timeWindow 不会过滤掉 prompt，是"无窗"状态。
- **不指定 daysOfWeek** 等价于 `[0,1,2,3,4,5,6]`（每天）。

### 3.3 变量替换（`{{...}}` 语法）

**支持的变量命名空间**（v0.1）：

| 变量 | 含义 | 来源 |
|---|---|---|
| `{{ai.name}}` | 当前 AI 名字 | persona.name |
| `{{ai.personality}}` | AI 性格 | persona.personality |
| `{{ai.bio}}` | AI 一句话简介 | persona.bio |
| `{{user.name}}` | 用户名 | user persona.name |
| `{{user.tone}}` | 用户偏好语气 | （v0.1 不存，预留） |
| `{{now}}` | 当前时间，格式由拼装器决定 | Date.now() |
| `{{today}}` | YYYY-MM-DD | Date |
| `{{world.name}}` | 当前世界名 | world.name |
| `{{history.hits}}` | **本次拼装命中的历史消息数** | 关键词触发结果（详见 §3.6） |
| `{{history.keywords}}` | **本次拼装命中的所有关键词** | 关键词触发结果，逗号分隔 |

**不支持嵌套、函数、表达式**（避免 prompt injection 风险）。

**实现位置**：

```js
// prompt-utils.js
function fillVariables(text, ctx) {
    return text.replace(/\{\{([\w.]+)\}\}/g, (m, key) => {
        const v = _resolve(ctx, key);
        return v == null ? '' : String(v);
    });
}
```

**ctx 结构**（拼装器传入）：

```js
{
    ai:     { id, name, personality, bio, ... },
    user:   { id, name, ... },
    world:  { id, name, ... },
    now:    Date.now(),
    today:  '2026-07-30',

    // ★★★ 关键词触发上下文（v0.1） ★★★
    recentHistory: [                 // 最近 N 条聊天记录，按时间从新到旧
        { id, role: 'user' | 'ai', text, createdAt },
        // ...
    ],
    historyHits: [],                 // 关键词触发后填入，元素 = {
                                     //   messageId, messageIndex,
                                     //   keywords: [命中的 kw...],
                                     //   originPromptId,
                                     // }
    historyKeywords: new Set(),      // 本次拼装命中的所有关键词（去重）

    // ★★★ 滚动摘要上下文（v0.1，§3.7） ★★★
    rollingSummaries: [],            // 聊天 App 在调用 buildStack 前塞进来
                                     // 元素 = RollingSummary 实体
                                     // 一般只塞"当前 aiId 的最新一份 K"
                                     // 也可以传整条链 K0+K1+...
}
```

### 3.4 拼装器主入口

```js
// prompt-builder.js

/**
 * ★ 双轴拼装：priority 控顶、injectionDepth 控底
 * 流程：
 *   1. 遍历 enabled 组 + 展开 enabled 的 prompt 条目
 *   2. 解析每个条目的「最终 priority / injectionDepth / timeWindow」
 *      （prompt 自己的 enabled 字段覆盖组的）
 *   3. timeWindow 过滤（在窗内才参与拼装）
 *   4. 拆成两个池：mainStack（按 priority 排）+ depthStack（按 injectionDepth 排）
 *   5. ★ 关键词触发扫描（v0.1）：
 *      遍历所有 prompt.keywords[] 不为空的条目，
 *      在 ctx.recentHistory 的最后 historyDepth 条里查命中，
 *      命中则生成「动态注入 prompt」按原 prompt 的双轴参数推入 stack
 *   5a. ★ 滚动摘要注入（v0.1，§3.7）：
 *      读取 ctx.rollingSummaries[]（聊天 App 在拼装前塞进来），
 *      每条按 (priority=2 默认, injectionDepth=null 默认) 推入对应 stack
 *   6. 最终 stack = mainStack ++ depthStack（depthStack 永远在最底）
 *   7. 跑 {{...}} 变量替换
 */
export function buildPromptStack(ctx) {
    const groups = sdk.prompts.groups.list({ enabled: true });

    // ★ 关键词触发的中间结果
    ctx.historyHits = [];
    ctx.historyKeywords = new Set();

    const mainStack = [];     // 按 priority 排，priority 小的在前
    const depthStack = [];    // 按 injectionDepth 排，永远追加在 mainStack 末尾

    // ─── 第一遍：收集所有「原始 prompt」+ 跑 timeWindow 过滤 ───
    const candidates = [];   // [{ priority, injectionDepth, groupId, promptId, text, rawPrompt }]

    for (const group of groups) {
        // 组级 conditions（v0.1 永远 true）
        if (group.conditions?.enabled) continue;

        const prompts = sdk.prompts.prompts.list({ groupId: group.id })
                                          .sort((a, b) => (a.order || 0) - (b.order || 0));

        for (const p of prompts) {
            // ★ 解析最终值（自己的 > 组的）
            const finalPriority       = resolveField(p.priority,       group.priority);
            const finalInjectionDepth = resolveField(p.injectionDepth, group.injectionDepth);
            const finalTimeWindow     = resolveField(p.timeWindow,     group.timeWindow);

            // ★ 时间窗过滤
            if (!isInTimeWindow(finalTimeWindow, ctx.nowDate)) continue;

            candidates.push({
                priority:       finalPriority,
                injectionDepth: finalInjectionDepth,
                groupId:        group.id,
                promptId:       p.id,
                keywords:       p.keywords || [],
                historyDepth:   Math.min(Math.max(group.historyDepth || 1, 1), 5),  // 1-5 钳制
                text:           fillVariables(p.text, ctx),
                rawPrompt:      p,                                  // 留原始，给关键词触发用
            });
        }
    }

    // ─── 第二遍：把非关键词触发的直接入对应 stack ───
    for (const c of candidates) {
        const item = {
            priority:       c.priority,
            injectionDepth: c.injectionDepth,
            groupId:        c.groupId,
            promptId:       c.promptId,
            text:           c.text,
            source:         'prompt',                              // ★ 区分来源
        };

        if (c.injectionDepth != null && c.injectionDepth >= 0) {
            depthStack.push(item);
        } else {
            mainStack.push(item);
        }
    }

    // ─── 第三遍：★ 关键词触发 → 生成动态 prompt ───
    if (Array.isArray(ctx.recentHistory) && ctx.recentHistory.length > 0) {
        for (const c of candidates) {
            if (!c.keywords || c.keywords.length === 0) continue;

            const tail = ctx.recentHistory.slice(0, c.historyDepth);  // 最近 historyDepth 条

            for (const kw of c.keywords) {
                const kwLower = String(kw).toLowerCase();

                for (let i = 0; i < tail.length; i++) {
                    const msg = tail[i];
                    const text = String(msg.text || '');
                    if (!text.toLowerCase().includes(kwLower)) continue;

                    // ★ 命中！生成动态 prompt
                    ctx.historyHits.push({
                        messageId:    msg.id,
                        messageIndex: i,
                        keyword:      kw,
                        originPromptId: c.promptId,
                    });
                    ctx.historyKeywords.add(kw);

                    const dynamicText = renderKeywordHitPrompt(msg, kw, c.rawPrompt);

                    const item = {
                        priority:       c.priority,           // ★ 继承
                        injectionDepth: c.injectionDepth,     // ★ 继承
                        groupId:        c.groupId,
                        promptId:       `${c.promptId}::kw::${kw}::${msg.id}`,  // ★ 虚拟 id
                        text:           dynamicText,
                        source:         'keywordHit',          // ★ 标记，方便调试 / 调试 UI
                    };

                    if (c.injectionDepth != null && c.injectionDepth >= 0) {
                        depthStack.push(item);
                    } else {
                        mainStack.push(item);
                    }
                }
            }
        }
    }

    // ─── 第三点五遍：★ 滚动摘要注入（v0.1，§3.7） ───
    // 聊天 App 在调用 buildStack(ctx) 前，会把「当前 aiId 的最新摘要」
    // 放进 ctx.rollingSummaries[]。拼装器只读、按双轴参数推入对应 stack。
    if (Array.isArray(ctx.rollingSummaries) && ctx.rollingSummaries.length > 0) {
        for (const sum of ctx.rollingSummaries) {
            // ★ 默认 priority=2（紧跟聊天记录）、injectionDepth=null（走 mainStack）
            //   聊天 App 可以在 RollingSummary.config 里覆盖：
            //     sum.config.summaryPriority       —— 覆盖 priority
            //     sum.config.summaryInjectionDepth —— 覆盖 injectionDepth
            const sumPriority       = sum.config?.summaryPriority       ?? 2;
            const sumInjectionDepth = sum.config?.summaryInjectionDepth ?? null;

            const item = {
                priority:       sumPriority,
                injectionDepth: sumInjectionDepth,
                groupId:        '__rollingSummary__',         // ★ 标记组（不属于 prompt 库）
                promptId:       sum.id,
                text:           buildSummaryPromptText(sum),  // ★ 详见 §3.7.6
                source:         'rollingSummary',
            };

            if (sumInjectionDepth != null && sumInjectionDepth >= 0) {
                depthStack.push(item);
            } else {
                mainStack.push(item);
            }
        }
    }

    // ─── mainStack: priority asc ───
    mainStack.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return 0;
    });

    // ─── depthStack: injectionDepth asc → priority asc ───
    //   depth 小的先入栈 = 越靠底（最底 = 永远追加在最后）
    depthStack.sort((a, b) => {
        if (a.injectionDepth !== b.injectionDepth) return a.injectionDepth - b.injectionDepth;
        if (a.priority !== b.priority) return a.priority - b.priority;
        return 0;
    });

    // 把 Set 转成数组（方便 fillVariables 用）
    const hitsCount = ctx.historyHits.length;
    const keywordsCsv = Array.from(ctx.historyKeywords).join('、');

    // ★ 把 historyHits / keywordsCsv 暴露到 ctx，方便 prompt 文本里用
    ctx.history.hits = hitsCount;       // 仅作为示例：实际 fillVariables 走 _resolve 链
    ctx.history.keywords = keywordsCsv;

    return [...mainStack, ...depthStack];
}

/**
 * ★ 生成「关键词命中提示」动态 prompt 的文案
 * v0.1：永远塞整条历史原文（用户原话：「触发了就把人家都加进去呀」）
 */
function renderKeywordHitPrompt(msg, kw, originPrompt) {
    const time = msg.createdAt ? new Date(msg.createdAt).toLocaleString('zh-CN') : '未知时间';
    const safeText = String(msg.text || '');
    return [
        `【关键词命中提示】用户在 ${time} 的消息中提到了关键词「${kw}」。`,
        `原始 prompt（参考）：${originPrompt.text}`,
        '',
        '完整历史原文：',
        safeText,
    ].join('\n');
}
```

**组装成给 LLM 的 prompt（典型做法）**：

```js
function assembleForLLM(stack, llmSystemPrompt) {
    const text = stack.map(item => item.text).join('\n');
    // LLM 系统 prompt 在最前，stack 紧跟其后（自带 main + depth 顺序）
    return [llmSystemPrompt, text].filter(Boolean).join('\n\n---\n\n');
}
```

**几个具体例子**（方便对照）：

| prompt | 组的 priority | 组的 injectionDepth | prompt 自己的 priority | prompt 自己的 injectionDepth | 拼装位置 |
|---|---|---|---|---|---|
| 系统级"我是谁" | — | — | — | — | priority=0 段（第 1 行） |
| 用户人设 | — | — | — | — | priority=1 段（第 2 行） |
| 普通 chat 规则 | 10 | 0（不挤底） | `{enabled:false}` | `{enabled:false}` | priority=10 段（mainStack 末尾） |
| 深夜聊天 prompt | 15 | 0 | — | `{enabled:true, value:0}` | 永远最底 |
| 兜底"不要输出 x" | 10 | 0 | `{enabled:true, value:0}` | — | priority=0 段（抢顶） |
| 时间窗只在 02-03 点生效 | 15 | 0 | — | — | 仅 02-03 点出现，否则被过滤 |

### 3.6 ★ 关键词触发（dynamic injection）

> **用户原话**：
> - "我给 AI 发上下文，假设我发过去的上下文是 A，里面提到一个关键词「吃饭」是我最新的一条聊天记录里提到的。然后我一共聊天记录会进入上下文的有 10 条，当我开始发第 21 条消息的时候，那个「吃饭」关键词在的对话信息不就没有了吗？那我发给 AI 的上下文就没有「吃饭」这个关键词了，那我再把相关的 prompt 放进去，很浪费啊。所以需要一个搜索内容关键词然后再去添加 prompt 的功能。检索多少条历史消息可以让用户选，最多检索 5 条吧？可以自选。"

#### 3.6.1 设计目标

让「**已经不在线上窗口的历史消息里的关键词**」能**自动**触发相关 prompt 注入到当前上下文，**不需要用户提前把 prompt 硬塞在系统层**。

#### 3.6.2 字段位置

| 字段 | 放在哪 | 形态 | 含义 |
|---|---|---|---|
| **`keywords[]`** | **prompt 项**（Layer 4） | `string[]` | 「我这条 prompt 关心哪些关键词」，命中就触发注入 |
| **`historyDepth`** | **组**（Layer 3） | `number`（1-5） | 「这个组最多往前翻几条历史」，仅在组内 prompt 有 keywords 时才生效 |

**为什么不把 historyDepth 放在 prompt 项上**：
- 同一个组内的 prompt 通常共享同一个检索深度需求
- UI 上「组级」+「项级关键词」已经够直观；再加项级 depth 会让单条 prompt 配置过重

#### 3.6.3 触发流程

```
用户发第 21 条消息时：
    │
    ▼
1. 拼装器拿到 ctx（含 ctx.recentHistory = 最近 N 条历史消息原文，
                   其中 N = 当前上下文窗口大小，例如 10）
    │
    ▼
2. 遍历所有 enabled 组，每组：
    2.1 取 historyDepth（默认 1，最深 5）
    2.2 取 ctx.historyTail = ctx.recentHistory.slice(-historyDepth)
                                   （取最后 historyDepth 条 = 「在窗外」的候选）
       ★ 这里有个设计选择：
         - 选 a：取"已经在上下文里的最后 historyDepth 条"（用户答的 a）
         - 选 b：取"已经在上下文里的全部"——但 prompt 命中后注入的是该条原文
                 而该条已经在窗口里了，注入重复
         - 选 c：取"最近 N 条全部"（包括窗口内的），注入去重
         ▼
       **v0.1 选 a 的语义扩展**：扫描「最近 historyDepth 条历史」（无论在不在当前窗口），
       因为关键词触发主要是为了**找回窗外的信息**，所以 v0.1 默认扫描「最近 historyDepth 条」
       （覆盖窗外 + 窗内最后一条）。详见 §3.6.5 边界情况。
    │
    2.3 组内每条 prompt：
        - 取 keywords[]（空数组 = 跳过，不参与触发）
        - 对 keywords 中每个 kw，扫描 historyTail 任一条是否包含
          （v0.1 = includes() 不分大小写，v0.2+ = 正则）
        - 命中 → 生成一条「动态注入 prompt」推入 stack
    │
    ▼
3. 动态注入的 prompt 内容形态（v0.1）：
    ┌──────────────────────────────────────────────────┐
    │ 【关键词命中提示】用户在 [历史消息时间] 提到过 "吃饭"。 │
    │ 完整原文：                                         │
    │ [那段历史消息完整原文]                              │
    └──────────────────────────────────────────────────┘
    *
    * v0.1 永远塞整条（用户原话：「触发了就把人家都加进去呀」）
    * v0.2+ 可配置「只塞命中的句子」

4. 动态 prompt 走正常的 priority / injectionDepth 双轴拼装
    - 默认 priority 跟所属 prompt 一致（继承）
    - 默认 injectionDepth = 0（最底）
    * 用户可在 prompt 上显式覆盖
```

#### 3.6.4 示例

**场景**：用户在 prompt 项配置：

```js
{
    text: '用户最近提到过关于【吃饭】的偏好，请记得这点。',
    keywords: ['吃饭', '餐厅', '外卖'],
    priority: { enabled: false, value: 10 },        // 跟组走
    injectionDepth: { enabled: false, value: 0 },   // 跟组走（最底）
}
```

组配置：

```js
{
    priority: 10,
    historyDepth: 3,                                 // 扫描最近 3 条历史
}
```

**拼装时**：
- 历史消息（最新→最旧）：[m1, m2, m3, ..., m10（在窗内）, m11, m12, m13, m14, m15, m16, m17, m18, m19, m20（窗外）]
- 取 ctx.historyTail = [m1, m2, m3]（最近 3 条）
- m15 里提到「我想吃火锅」（命中「吃饭」/「餐厅」模糊匹配）→ **不命中**（m15 不在 tail）
- m3 里提到「中午吃的外卖不好吃」→ **命中**「外卖」
- 生成动态注入 prompt → 推入 stack（priority=10, depth=0）→ 拼在底部

#### 3.6.5 边界情况 & FAQ

| 问题 | 答案 |
|---|---|
| historyDepth > 5 行不行？ | **不行**，UI 上限 5。超过 5 的需求 v0.1 拒绝（避免误用，浪费 token） |
| keywords 命中后，会重复触发吗？ | **不会去重**（v0.1）：每个 keywords 命中都生成一条独立 prompt。例 `keywords: ['吃', '饭']` 同一条历史都命中 → 生成 2 条 |
| 多个组都声明了同一个 keyword？ | **都触发**，每个组各自独立（跟 priority / depth 一样） |
| 动态生成的 prompt 走哪个轴？ | **继承**所属 prompt 的 priority / injectionDepth（参见 §3.4） |
| 不想每次都触发？ | 把 keywords 留空 `[]` = 完全不启用 |
| 历史消息不够 historyDepth 条？ | 实际扫多少算多少，**不会报错** |
| 历史消息里包含 prompt injection 文本（比如「忽略上面的指令」）？ | **不防御**（纯前端 + 用户自己玩，无攻击者） |
| 组没有 keywords 但设了 historyDepth？ | historyDepth **不生效**（组里没人用） |
| prompt 有 keywords 但组 historyDepth=0？ | 不会触发（深度=0 = 不扫描），UI 应该把 0 视作「不启用」 |

#### 3.6.6 ★ 向量兜底（v0.1.1 增强）— 关键词命中不到时用「意思相近」兜底

> **设计目标**：用户字面没提到关键词，但意思相近时，也能触发。
> **关键不破坏**：关键词 fast-path 保留，向量只在兜底跑（不影响性能基线）。
> **重要**：v0.1.1 SDK 只暴露**插槽 API**，**不内置 embedding 实现、不下载任何模型**。用户想用时自己接。

**大白话**：

```
用户说："我好饿，想嗦个粉"
关键词白名单: ['吃饭', '外卖']  → 不命中（没字面"吃饭"）
向量兜底:    这句的"意思向量" 跟 prompt 里关键词算出的"意思向量"
             → 相似度 0.78（> 阈值 0.6）→ ✅ 触发
```

**触发流程（v0.1.1）**：

```
ctx.recentHistory
        ↓
   取 historyDepth 条
        ↓
   对每条历史: 用 keywords[] 跑 fast-path (字面包含)  ──命中──→ 直接生成 dynamic prompt
        ↓ 未命中
   检查 sdk.embedding.isReady() ──未就绪──→ 不触发（默认就是未就绪）
        ↓ 就绪
   兜底: 用「该条历史的 embedding」跟「prompt 关键词算出的平均 embedding」比相似度
        ↓
   相似度 ≥ 阈值（默认 0.6）→ 生成 dynamic prompt
        ↓ < 0.6
   不触发
```

**插槽 API（v0.1.1 SDK 暴露，**SDK 不自带实现**）**：

```js
// 默认 sdk.embedding 全是 no-op：embed() 返回 null，isReady() 返回 false
// 所以 v0.1.1 默认行为 = 纯关键词触发，跟 v0.1 完全一样，无任何额外开销

sdk.embedding = {
    isReady: () => boolean,        // 用户有没有注入实现？
    embed: async (text) => number[] | null,   // 算一段文字的"意思向量"；null = 不可用
    cosine: (a, b) => number,      // 余弦相似度 0~1（纯数学，SDK 自带）
    register: (impl) => void,      // 用户注入自己的实现（详见下方）
    reset: () => void,             // 卸载（调试 / 换实现用）
};
```

**用户如何注入实现（v0.1.1 之后任何时候都可）**：

```js
// 方式 A：本地 embedding（推荐有动手能力的用户）
// 自己写个 App 或脚本：
import { pipeline } from '@xenova/transformers';

let extractor = null;
sdk.embedding.register({
    init: async () => {
        extractor = await pipeline('feature-extraction', 'Xenova/bge-small-zh-v1.5');
    },
    embed: async (text) => {
        if (!extractor) return null;
        const out = await extractor(text, { pooling: 'mean', normalize: true });
        return Array.from(out.data);
    },
});

// 方式 B：调远程 embedding API（不想本地跑模型）
sdk.embedding.register({
    embed: async (text) => {
        const res = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ input: text, model: 'text-embedding-3-small' }),
        });
        const { data } = await res.json();
        return data[0].embedding;
    },
});

// 方式 C：no-op（默认）— 啥都不注入，关键词 fast-path 仍然能用
//         sdk.embedding.isReady() === false → §3.6.6 自动跳过
```

**schema 新增字段**（每个 prompt 项 / 组）：

| 字段 | 类型 | 默认 | 含义 |
|---|---|---|---|
| `vectorFallback` | `boolean` | `false`（v0.1.1 默认关，避免歧义）| 是否启用向量兜底；**前提**是 `sdk.embedding.isReady()` 必须为 true |
| `vectorThreshold` | `number` | `0.6` | 相似度阈值（0~1，越高越严格） |

**v0.1.1 真正做到的 / 没做到的**：

| 项 | 状态 |
|---|---|
| 插槽 API（`embed` / `cosine` / `register` / `isReady`）| ✅ v0.1.1 必做 |
| `cosine(a, b)` 纯数学实现 | ✅ v0.1.1 必做 |
| `promptEmbeddings` IndexedDB 表（缓存 keywords 向量）| ✅ v0.1.1 必做（用户注入实现后才写入）|
| 默认 embedding 实现（bge-small / OpenAI / Coze）| ❌ **不做**。用户自己挑、自己接、自己承担下载 / API 费用 |
| `@xenova/transformers` 依赖进 package.json | ❌ **不进**。用户引入自己负责 |
| 模型下载脚本 | ❌ **不写** |
| 阈值 UI | ⚠️ v0.1.1 schema 字段支持，UI 控件 v0.2 再做 |

**FAQ**：

| 问题 | 答案 |
|---|---|
| 用户没注入实现，向量兜底会报错吗？ | **不会**：`isReady() === false` → §3.6.6 自动跳过，跟 v0.1 完全等价 |
| 关键词 fast-path 和向量兜底会重复触发吗？ | **不会**：fast-path 命中即返回，向量只对未命中的历史跑 |
| 关键词空数组 `[]` 时向量兜底生效吗？ | **不生效**：向量兜底依赖 keywords 算"目标向量"，空就没目标 |
| 阈值多少合适？ | v0.1.1 默认 **0.6**。低于 0.5 容易误触发；高于 0.7 中文场景容易漏 |
| 用户能不能换实现？ | **能**：`sdk.embedding.register(...)` 随时换；旧缓存的 `promptEmbeddings` 表不会被自动清，UI 给个"重建向量"按钮即可 |
| 用户用本地模型要不要联网？ | **首次要**（下模型），之后离线可用；用远程 API 每次都要 |
| embedding 存哪里？ | IndexedDB 新表 `promptEmbeddings`（key = promptId，仅在用户注入实现后才会写入）|
| v0.1.1 单 HTML 整合（`vite-plugin-singlefile`）能用吗？ | **能**：SDK 不带 embedding 实现，integration 完全干净；用户想用本地 embedding 自己写外挂 |

---

### 3.7 ★ 滚动摘要（rolling memory）

> **用户原话**：
> - "AI 人设是 A，用户人设是 B，聊天记录是 C，零散 prompt 是 D。发出去上下文是 AB CD。"
> - "C 里面默认存当前 10 条聊天信息。我给 AI 发了 3 条，AI 给我回了 7 条。"
> - "一旦 C 装满 10 条信息，就去发一个指令，通过一个 prompt 压缩这十条的信息量，把他们压缩成一个新的 prompt K。"
> - "接下去就是 ABKCD。C 里面就不包含上面十条的聊天记录了。"
> - "因为 AI 回复条数有不可控性，所以可能不是十条——是我跟 AI 来来往往十个回合。"
> - "已被总结成 K 后，C 就清空了。继续聊，C 又出现内容。又聊完十轮，又调用指令，跟 K 一起再总结一次，记为 K1。K0 是第一次的 K。"
> - "K 每次算作一种动态产生的 prompt 算记忆吗？放人设页吗？但又是 prompt。"
> - "我主要想让你实现的是这种摘要实际运行的 js 代码，能不能在 prompt 相关的这个里面直接实现，后续其他 App 通过调用函数去借用。"

#### 3.7.1 设计目标

把「聊天记录 C 满了 → 触发 AI 压缩 → 落盘 → 下次拼装时作为一条 prompt 注入」做成 **聊天 App 一行函数调用就能用**的能力，**不污染 prompt schema**。

**关键决定**：
- ❌ **不** 在 prompt 条目上加 `isRollUp: true` 这种字段
- ❌ **不** 在 prompt 组上加 `rollUpThreshold: 10` 这种字段
- ✅ 滚动摘要**完全**由 **SDK 函数** 驱动：`sdk.prompts.summarize(aiId, messages)` → 自动落盘 → 拼装器自动读
- ✅ 聊天 App 自己监听「C 满了 N 轮」→ 调一次 `summarize()` → 完事
- ✅ K 是「**动态生成**的 prompt」（跟 §3.6 关键词触发同级），不是 prompt 库里的实体

#### 3.7.2 形态对照表

| 维度 | 关键词触发 (§3.6) | 滚动摘要 (§3.7) |
|---|---|---|
| 触发方 | 拼装器自己 | 聊天 App 主动调 SDK |
| 落盘位置 | 不落盘（拼装完就丢） | 落盘到 `chatSummaries` 表（IndexedDB） |
| prompt 库 | 不涉及 | 不涉及（运行时动态生成） |
| 数据形态 | 临时 `ctx.historyHits` | 持久化 `RollingSummary` 实体 |
| 拼装器读 | `ctx.recentHistory` 扫描 | `ctx.rollingSummaries[]` 一次拿全部（一般只取最新一份） |

#### 3.7.3 数据模型

```js
// ===== IndexedDB：聊天摘要表（每角色独立一份，不进 prompt 库） =====
// store: 'chatSummaries'
// keyPath: 'id'

{
    id: 'sum_xxx',                     // 'sum_' 前缀（参考 persona/world 的 ID 体系）
    aiId: 'ai_xxx',                    // ★ 所属 AI / 角色 ID（一人一份摘要链）

    level: 0,                          // ★ 摘要层级：0 = 第一份（K0）
                                       //         1 = 在 K0 之上又压一份（K1）
                                       //         2 = ... 嵌套深度
    parentId: null,                    // 上一级摘要 ID（K1.parentId = K0.id）
                                       //   null = 顶层（K0）

    sourceMessageIds: [m1, m2, ...],   // 这次压缩包含的原始消息 ID 列表
    summaryText: '...',                // ★ AI 生成的摘要原文
    tokenEstimate: 312,                // 估算 token（可选，用于 UI 提示）

    createdAt: Date.now(),
    updatedAt: Date.now(),

    // 元数据
    config: {                          // 触发这次压缩的配置（可空）
        threshold: 10,                 // 用户在 SDK 调用时传的阈值
        style: 'concise',              // 摘要风格，详见 §3.7.6
        language: 'zh-CN',
    },
}
```

**索引**：
- `by_aiId`：根据 `aiId` 查所有摘要
- `by_aiId_level`：根据 `(aiId, level)` 查某一层摘要（一条链）

#### 3.7.4 核心 SDK 接口

```js
// sdk.prompts.summarize 模块（独立子模块，不是 sdk.prompts.buildStack）

/**
 * ★ 让聊天 App 调一行就能压缩
 * 内部流程：
 *   1. 拼装一个「压缩指令 prompt」（下面 §3.7.6）
 *   2. 调 AI 拿回 summary 文本
 *   3. 落盘到 chatSummaries 表
 *   4. 返回新摘要的 id
 */
async function summarize(aiId, options = {}) {
    const {
        messages,           // 要压缩的消息数组 [{ id, role, text, createdAt }]
        level,              // 这次要生成第几层；不传则自动 = 当前最高层 + 1
        parentId,           // 不传则自动取 (aiId, level-1) 最新一条
        style = 'concise',  // 'concise' | 'detailed' | 'chronological'
        language = 'zh-CN',
        apiKey,             // AI 调用所需的 key，参考 api-manager 模块
        onProgress,         // 可选：进度回调 (stage, percent)
    } = options;

    // 1. 准备压缩 prompt
    const compressPrompt = buildCompressPrompt(messages, { style, language });

    // 2. 调 AI
    const summaryText = await callLLM(compressPrompt, { apiKey });

    // 3. 落盘
    const id = `sum_${uuid()}`;
    await db.add('chatSummaries', {
        id, aiId,
        level: level ?? await _nextLevel(aiId),
        parentId: parentId ?? await _latestId(aiId, (level ?? 0) - 1),
        sourceMessageIds: messages.map(m => m.id),
        summaryText,
        config: { threshold: messages.length, style, language },
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });

    return id;
}

/**
 * ★ 拼装器 / 调试工具 / 人设页都从这个 API 读
 * 默认只返回「最新一份」（绝大多数情况够用）
 */
async function getLatest(aiId, level = null) {
    // level = null → 全层取最新一份（任意层）
    // level = N → 取第 N 层最新一份
    // 一般人设页 / 拼装器传 null 即可
    return db.getFromIndex('chatSummaries', 'by_aiId_level', [aiId, level ?? 0])  // 简化：v0.1 只看 level 0
        ?? null;
}

async function getChain(aiId) {
    // ★ 返回一条完整链：K0 → K1 → K2 → ...
    //   按 level 升序，每层取最新一份
    return db.getAllFromIndex('chatSummaries', 'by_aiId', aiId)
        .then(arr => arr.sort((a, b) => a.level - b.level));
}

async function listSummaries(aiId) {
    // ★ 人设页 / 调试用：列所有摘要
    return db.getAllFromIndex('chatSummaries', 'by_aiId', aiId);
}

async function deleteSummary(id) {
    return db.remove('chatSummaries', id);
}
```

#### 3.7.5 拼装器 ctx 扩展 + 接入方式

**ctx 增加字段**：

```js
{
    // ... 原有字段 ...
    rollingSummaries: [],    // ★ 新增：聊天 App 在拼装前塞进来
                             //   元素 = RollingSummary 实体（参见 §3.7.3）
                             //   一般聊天 App 只塞「当前 aiId 的最新一份 K」
                             //   也可以传整条链 K0+K1+... → 见下方 FAQ
}
```

**拼装器多走一步**（§3.4 流程插入）：

```js
// 在 §3.4 流程的「第三遍：关键词触发」之前 + 之后，插入「滚动摘要」步骤：

// ─── 第三遍：滚动摘要注入（v0.1） ───
if (Array.isArray(ctx.rollingSummaries) && ctx.rollingSummaries.length > 0) {
    for (const sum of ctx.rollingSummaries) {
        // ★ 摘要默认走 priority = 2（紧跟聊天记录，跟 §3.1 的「聊天=2」同级）
        //   走 injectionDepth = null（走 mainStack，不挤底）
        const item = {
            priority:       sum.config?.summaryPriority ?? 2,   // 可让聊天 App 注入时覆盖
            injectionDepth: sum.config?.summaryInjectionDepth ?? null,
            groupId:        '__rollingSummary__',                 // ★ 标记组（不属于 prompt 库）
            promptId:       sum.id,
            text:           buildSummaryPromptText(sum),          // 详见 §3.7.6
            source:         'rollingSummary',
        };
        if (item.injectionDepth != null && item.injectionDepth >= 0) {
            depthStack.push(item);
        } else {
            mainStack.push(item);
        }
    }
}
```

#### 3.7.6 摘要 prompt 文案模板

**两个 prompt 模板**：

```js
// ① 用于「调 AI 生成 K」时发给 AI 的压缩指令
function buildCompressPrompt(messages, { style, language }) {
    const conv = messages.map(m =>
        `${m.role === 'user' ? '用户' : 'AI'}：${m.text}`
    ).join('\n');

    const styleGuide = {
        concise:       '压缩到 100-200 字，保留关键事实、偏好、决定、未解决问题。',
        detailed:      '压缩到 300-500 字，保留细节、对话情绪、隐含信息。',
        chronological: '按时间顺序整理事件，每条对话给一句话总结。',
    }[style] ?? '压缩到 100-200 字。';

    return [
        `请把以下聊天记录压缩成一段精炼摘要。${styleGuide}`,
        `输出语言：${language}。`,
        '',
        '【聊天记录】',
        conv,
        '',
        '【输出格式】',
        '- 直接输出摘要正文，不要任何解释、前后缀、标题。',
        '- 用第三人称（"用户提到…"、"AI 表示…"）。',
        '- 保留专有名词、数字、时间、人物。',
    ].join('\n');
}

// ② 用于「拼装时把 K 渲染回 prompt 文本」——塞进 AI 上下文
function buildSummaryPromptText(sum) {
    const time = new Date(sum.createdAt).toLocaleString('zh-CN');
    const range = sum.sourceMessageIds.length > 0
        ? `压缩自 ${sum.sourceMessageIds.length} 条历史消息`
        : `压缩自之前摘要链`;

    return [
        `【${range} · ${time} · 摘要层级 K${sum.level}】`,
        sum.summaryText,
    ].join('\n');
}
```

#### 3.7.7 聊天 App 集成示例

```js
// 聊天 App 里（伪代码）
import { sdk } from '@/js/sdk/index.js';

const RECENT_MESSAGES_CAPACITY = 10;   // ★ 跟用户答的 b 一致：可配

// 监听消息变化
async function onMessagesChanged(aiId, messages) {
    if (messages.length >= RECENT_MESSAGES_CAPACITY) {
        // ★ 满了 → 压缩
        const id = await sdk.prompts.summarize(aiId, {
            messages,
            style: 'concise',
        });

        // ★ 压缩后清空当前 C（业务自己管，sdk 不管）
        await clearRecentMessages(aiId);

        // ★ 通知用户
        toolkit.island.notify('success', '已自动生成摘要', `K${await _getNextLevel(aiId) - 1} 落盘`);
    }
}

// 发消息前拼装上下文
async function buildContextForLLM(aiId) {
    const messages = await loadRecentMessages(aiId);   // 当前 10 条（不满就是不满）
    const latestSummary = await sdk.prompts.getLatest(aiId);

    return sdk.prompts.buildStack({
        ai:     ai,
        user:   user,
        world:  world,
        now:    Date.now(),
        today:  new Date().toISOString().slice(0, 10),

        recentHistory:      messages,           // §3.6 关键词触发要用
        rollingSummaries:   latestSummary ? [latestSummary] : [],  // ★ K 注入
    });
}
```

#### 3.7.8 FAQ & 边界

| 问题 | 答案 |
|---|---|
| K 应该在什么位置？ | `priority = 2`（紧跟聊天记录）；`injectionDepth = null`（走 mainStack，不挤底） |
| 压 K 的时候 C 满了 10 条，AI 还没回完怎么办？ | **只看入栈的消息**（C 入栈 = 用户 + AI 回复都进栈），不管"用户发了几条 / AI 回了几条"。SDK 不强制 10，由聊天 App 传 `messages.length` |
| 用户发 3 条，AI 回 7 条 = C 里 10 条。下一轮用户发第 4 条，触发压缩？ | **是**，C 满了就压（不区分谁发的） |
| K0 / K1 / K2 怎么决定层？ | `summarize(aiId, { messages, level: N })` 不传则自动算「当前最大 level + 1」 |
| 一次压 2 层（K0 + K1）行不行？ | 可以：传 `level = currentMax + 1`，传 `parentId = currentMaxId` |
| 压 K 时要不要把已存在的 K 也喂给 AI？ | **不喂**（v0.1）。只在拼装时用 K。压 K 时只看 `messages`。 |
| K 太多了拼装时要不要全部塞进去？ | **v0.1 只塞最新一份 K**（用户答的 c 默认选项 a）。人设页可让用户选「整条链塞进去」 |
| 压坏的 K 怎么办？ | 删：`sdk.prompts.deleteSummary(id)`。人设页加个「摘要历史」面板 |
| K 是否进 prompt 库？ | **不进**。K 是运行时动态生成，跟 prompt 库完全分离 |
| 用户没设压缩时，怎么跑？ | `sdk.prompts.getLatest(aiId)` 返回 null → 拼装器跳过 |
| 压缩失败怎么办？ | 抛出错误让聊天 App 处理（v0.1 不重试） |
| 摘要风格可配吗？ | `style: 'concise' \| 'detailed' \| 'chronological'`（v0.1 三种） |
| 摘要是否参与 §3.6 的关键词触发？ | **不参与**。K 是摘要不是原文 |

> **v0.1 不做**（用户确认）：
> - prompt 嵌入 / 向量检索（用户本地纯前端玩，不需要）
> - prompt 多媒体（用户无此需求）
> - 跨聊天语义检索（v0.1 关键词触发 §3.6 已够用）

#### 3.7.9 为什么不污染 prompt schema

**原则**：prompt 库是**用户手工维护的资产**；滚动摘要是**运行时自动生成的产物**。两者语义不同：

| 维度 | prompt 库 | 滚动摘要 |
|---|---|---|
| 编辑入口 | prompt 编辑页 | 聊天 App「自动」 |
| 持久化 | IndexedDB（库 → 包 → 组 → 条目） | IndexedDB（chatSummaries） |
| 用户感知 | 「我写了一条 prompt」 | 「聊天压缩了，K 落盘了」 |
| 删除路径 | prompt 删除按钮 | 摘要历史页 |

**设计取舍**：把 K 完全放在「动态 prompt」（与关键词触发、日历事件同级）的轨道上，**不进 prompt schema**。拼装器只读 `ctx.rollingSummaries[]` 即可。

---

### 3.8 ★ 预设循环语法（fixed snippets/macros）

> **用户原话**：
> - "我预设写好一些循环函数，后续让使用者调用，是不是可以规避 [prompt injection 风险]"

**设计结论**：
- ✅ **可以做**——但**只做写死的固定语法**，使用者只能填参数，**不允许**自己定义新语法
- ✅ 这样既给使用者「循环 / 引用 / 条件」的便利，又规避 prompt injection 风险
- ❌ 不允许使用者在 prompt text 里写 `{{define:xxx}}` / `{{func:xxx}}` 这种元语法

#### 3.8.1 v0.1 预定义语法清单

| 语法 | 含义 | 参数 | v0.1 是否做 |
|---|---|---|---|
| `{{repeat:lastN}}` | 重复最近 N 条聊天记录（自动从 `ctx.recentHistory` 拿）| N = 整数（1-50）| ✅ |
| `{{history.hits}}` | §3.6 命中摘要（已有）| 无 | ✅ |
| `{{history.keywords}}` | §3.6 命中关键词列表（已有）| 无 | ✅ |
| `{{date:format}}` | 当前日期格式化（如 `{{date:YYYY-MM-DD HH:mm}}`）| format 字符串 | ✅ |
| `{{weekday}}` | 今天星期几（中文/英文）| 可选：`zh` / `en` | ✅ |
| `{{if:cond:then:else}}` | 简单三元判断（条件 = 上下文键值比较）| 固定语法 | ⏳ v0.2 |
| `{{count:source}}` | 统计数量（如 `{{count:history}}` = 当前历史条数）| source 关键字 | ⏳ v0.2 |

> **v0.1 范围**：只做上面 ✅ 标记的 5 个写死语法。`{{if}}` / `{{count}}` 留 v0.2+。

#### 3.8.2 安全约束

- **写死在拼装器代码里**，使用者在 prompt text 里只能**调用**这些固定语法，**不能**写 `{{user.evil_func}}` 之类注入
- **白名单机制**：`buildStack` 在做 `{{...}}` 替换时，只识别白名单内的语法，其余原样保留（不报错）
- **语法解析失败不抛错**：原样保留 `{{...}}` 让用户自己看到改

#### 3.8.3 拼装器集成示例

```js
// prompt-builder.js
const FIXED_SNIPPETS = {
    'repeat:lastN': (ctx, N) => {
        const n = Math.min(Math.max(parseInt(N, 10) || 0, 0), 50);
        return ctx.recentHistory.slice(0, n).map(m => `${m.role}: ${m.text}`).join('\n');
    },
    'date:format': (ctx, fmt) => {
        return formatDate(new Date(ctx.now), fmt);
    },
    'weekday': (ctx, lang = 'zh') => {
        const names = { zh: ['日','一','二','三','四','五','六'], en: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] };
        return names[lang]?.[new Date(ctx.now).getDay()] ?? '';
    },
    // 已有
    'history.hits': (ctx) => JSON.stringify(ctx.historyHits ?? []),
    'history.keywords': (ctx) => Array.from(ctx.historyKeywords ?? []).join('、'),
};

function fillFixedSnippets(text, ctx) {
    return text.replace(/\{\{([a-zA-Z0-9_.:]+)(?::([^}]+))?\}\}/g, (m, name, arg) => {
        const fn = FIXED_SNIPPETS[name];
        if (!fn) return m;   // 未识别原样保留
        try {
            return String(fn(ctx, arg));
        } catch {
            return m;
        }
    });
}
```

#### 3.8.4 FAQ

| 问题 | 答案 |
|---|---|
| 我能自己加语法吗？ | **不能**。v0.1 只用写死的 5 个 |
| 为什么不让用户自定义？ | 避免 prompt injection + 调试黑盒 + 语法爆炸 |
| `{{repeat:last10}}` 跟 §3.6 的 `recentHistory` 什么区别？ | §3.6 是给**拼装器**扫描用的内部数据；`{{repeat:lastN}}` 是给**prompt text 文本替换**用的——给 LLM 看 |
| 用 `{{date:format}}` 是不是太程序员？ | 简单好用就行。format 字符串支持 YYYY / MM / DD / HH / mm / ss 这几个固定 token |

### 3.9 未来扩展（v0.x+ 预留，**不实现**）

> 注：**向量检索**已在 §3.6.6 升级为 v0.1.1 必做（**插槽式**，SDK 不自带实现）。下面这些是"想用了再说"。

| 扩展 | 触发条件 | priority 处理 |
|---|---|---|
| 日历事件 → prompt | 「日历 App 渲染当天日程时」注入 | 优先级待定（建议 8-12，看事件重要性） |
| 商城浏览历史 → prompt | 「最近买过 X」 | 优先级低（20+） |
| 天气 → prompt | 「今天下雨」 | 优先级 18 |
| 当前世界事件 → prompt | 从 `world.timeLine` 拉今日事件 | 优先级 3（紧跟聊天记录） |
| snippet 片段库（prompt 文本复用） | prompt 里写 `@snippet:xxx` | 独立库结构，类似 p 库的"包"维度 |
| 跨语言 embedding | 用更大的多语言模型替换（用户在 register 时换） | 不影响 SDK，只影响具体 impl |
| 用户调阈值 UI | settings App 加个 slider | SDK 字段已支持（`vectorThreshold`），只缺 UI |
| 官方 embedding impl 包 | 仓库单独 `examples/embedding-bge/` 给一份样板 | 用户自己复制，不进 SDK |
| 重建向量 UI 按钮 | 用户换实现后清 `promptEmbeddings` 重建 | v0.2 |

**接入方式**：v0.1 在 `prompt-builder.js` 里只读「prompt 库」；后续在同一个函数里**叠加**「动态源」（日历、天气等），按 priority 一起排序。这块不破坏现有 schema，只往 `buildPromptStack(ctx)` 里多塞几条 `{ priority, source, text }`。

---

## 4. UI 草图（4 层 + 拼装预览）

### 4.1 主页面（替换现有占位）

```
┌────────────────────────────────────────────┐
│  Prompt 工程                                 │
│                                             │
│  [新建 Prompt 库]                            │
│                                             │
│  ┌─ Prompt 库 列表 ──────────────────────┐ │
│  │ 0  📚 人设通用          [编辑] [删除]   │ │
│  │     0 · 聊天语气                        │ │
│  │     0 · 工具指令                        │ │
│  │                                        │ │
│  │ 1  🌙 时段语气          [编辑] [删除]   │ │
│  │     0 · 深夜聊天                        │ │
│  │     1 · 早晨提醒                        │ │
│  └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

### 4.2 库详情（包列表）+ 组详情（条目列表）+ 拼装预览

组详情页是核心：

```
┌────────────────────────────────────────────┐
│  ← 返回                                     │
│  Prompt 组 · 深夜聊天                        │
│                                             │
│  优先级 [15 ▼]    启用 [✓]                  │
│  时间窗 [✓]    02:00 - 03:00  [每天]        │
│                                             │
│  ─── Prompt 条目 ───                        │
│  ┌────────────────────────────────────┐    │
│  │ 1. 你是 {{ai.name}}，深夜聊天风格：  │    │
│  │    {{user.name}}，语气温柔，简短回复。 │    │
│  │                              [删除]  │    │
│  └────────────────────────────────────┘    │
│  [+ 新增条目]                                │
│                                             │
│  ─── 拼装预览 ───                            │
│  预览时间：当前 14:30  →  ⚠️ 不在时间窗内    │
│  假如时间是 02:30 →                          │
│  ┌────────────────────────────────────┐    │
│  │ [priority=15] 你叫小黄，深夜聊天...  │    │
│  └────────────────────────────────────┘    │
│                                             │
│              [保存]                          │
└────────────────────────────────────────────┘
```

**预览功能** = UI 自带一个滑块 / 输入框，让用户**手动改时间**来验证 timeWindow 的拼装结果。这是这功能的核心 UX。

---

## 5. settingsSdk.prompts · 完整接口

```js
// ===== 库 =====
sdk.prompts.libraries.list()
sdk.prompts.libraries.get(id)
sdk.prompts.libraries.create(data)
sdk.prompts.libraries.update(id, data)
sdk.prompts.libraries.remove(id)
sdk.prompts.libraries.listPackages(libraryId)

// ===== 包 =====
sdk.prompts.packages.list({ libraryId })
sdk.prompts.packages.get(id)
sdk.prompts.packages.create(data)
sdk.prompts.packages.update(id, data)
sdk.prompts.packages.remove(id)
sdk.prompts.packages.listGroups(packageId)

// ===== 组 =====
sdk.prompts.groups.list({ libraryId?, packageId?, enabled? })
sdk.prompts.groups.get(id)
sdk.prompts.groups.create(data)
sdk.prompts.groups.update(id, data)
sdk.prompts.groups.remove(id)        // 级联删 prompts

// ★★★ 核心 ★★★
sdk.prompts.groups.previewStack(partialGroup, ctx)
//   不实际跑数据库，只用传入的 partialGroup 模拟拼装，
//   用于 UI 「预览」按钮。

// ===== prompt 条目 =====
sdk.prompts.prompts.list({ groupId })
sdk.prompts.prompts.get(id)
sdk.prompts.prompts.create(data)
sdk.prompts.prompts.update(id, data)
sdk.prompts.prompts.remove(id)

// ===== ★ 跨层 buildStack =====
sdk.prompts.buildStack(ctx)
//   ctx = { ai, user, world, now, today }
//   → [{ priority, groupId, text }]

sdk.prompts.assembleForLLM(stack, llmSystemPrompt)
//   把 stack 拼成最终发给 LLM 的字符串
```

---

## 6. 与 App 制作思路的同步更新建议

| 位置 | 原状态 | 新状态 |
|---|---|---|
| §3.1 surface 表 | `prompts` 行已列但标 ◆ | 改成 ✅，列出 4 层 + `buildStack` + `assembleForLLM` |
| §3.2 CRUD 形态 | "通用 createEntityApi 工厂" | 补注：「prompts 是 4 层结构，不走通用工厂」 |
| §13 TODO | `Prompt 模块本体 ⏳` | 改成 ✅ v0.x 完成 |

---

## 7. 实施切片（建议顺序）

1. **数据层 + SDK 入口**（prompt-db.js + sdk/prompts.js）—— 1 个文件
2. **业务方法 + UI（库的列表 / 增删改）** —— 1 个文件
3. **业务方法 + UI（包 / 组 / 条目）** —— 1-2 个文件
4. **拼装器**（prompt-builder.js + prompt-utils.js） —— 2 个文件
5. **组详情页的「预览」功能** —— UI 内嵌
6. **settingsSdk.prompts 暴露** —— 在 `bootstrapSettingsSdk()` 里挂载
7. **App制作思路 §3 / §13 / §6.5 surface 更新** —— 纯文档
8. **人设 v4.3 §18 待办补一行** —— 纯文档

预计总代码量 ≈ 800-1200 行（参考 `gallery/` 整体 ~800 行）。

---

## 8. 待办 · TODO

> 按阶段分组。**已确认** ✅；未做的按"v0.1 SDK / v0.1 UI / v0.2+"分类。里程碑加粗。

### ✅ 已确认（不动）

- [x] §3.1 优先级映射表（人设=0 / 用户=1 / 聊天=2 / 碎知识=3）
- [x] §3.3 变量白名单够用（不需要加 `{{user.mood}}`）
- [x] v0.1 做库的 priority（中等改动，见 §8 v0.1 SDK）
- [x] v0.1 已做条目覆盖组（§3.1a）
- [x] v0.1 不做白名单历史（纯前端无攻击者）
- [x] v0.1.1 **做**向量检索 §3.6.6 — **插槽式**，SDK 只暴露 API，**不带 embedding 实现、不下载模型**
- [x] v0.1 不做 snippet 库（v0.2+，见 §3.9）
- [x] §3.6 默认行为：v0.1.1 默认 = 纯关键词触发；`vectorFallback` 字段默认 `false`；`sdk.embedding.isReady()` 默认 `false` → 跟 v0.1 完全等价

### 🔨 v0.1 SDK（先做）

- [ ] **里程碑 1**：`prompt-builder.js` 主入口 `buildPromptStack(ctx)` 全链路跑通（§3.1 / 3.1a / 3.2 / 3.3 / 3.4 / 3.6 / 3.7）
- [ ] §3.1 同 priority 内排序规则 `_num asc + order asc`（v0.1 写死，v0.2+ 可配）
- [ ] **库的 priority（v0.1 中等改动）**：library schema 加 priority 字段（默认 null = 走内部 max）+ 拼装器合并 priority 时优先读库（不读组）
- [ ] §3.6 关键词扫描：ctx.recentHistory 按 historyDepth 截尾 + keywords[] 命中
- [ ] **§3.6.6 向量兜底插槽（v0.1.1 插槽式，不内置实现）**：
  - [ ] SDK 暴露 `sdk.embedding = { isReady, embed, cosine, register, reset }` —— 默认全部 no-op
  - [ ] `sdk.embedding.cosine(a, b)` 纯数学实现
  - [ ] `promptEmbeddings` IndexedDB 表注册（key = promptId）
  - [ ] `vectorFallback` / `vectorThreshold` schema 字段支持（默认 `false` / `0.6`）
  - [ ] 拼装器集成：fast-path 命中 → 直接生成；未命中且 `vectorFallback === true && sdk.embedding.isReady()` → 走兜底
  - [ ] **不**引入 `@xenova/transformers` 依赖、**不**下载 bge 模型——用户想用自己接
  - [ ] 文档写一份"如何接 bge / OpenAI embedding"的样板（放在 `examples/embedding/` 目录外，README 链一下）
- [ ] §3.7 `sdk.prompts.summarize(aiId, options)` 真实实现（拼压缩 prompt + 调 LLM + 落盘）
- [ ] §3.7 `sdk.prompts.getLatestSummary` / `getSummaryChain` / `listSummaries` / `deleteSummary` CRUD
- [ ] §3.7 `chatSummaries` IndexedDB 表注册 + 索引 `by_aiId` / `by_aiId_level`
- [ ] §3.7 拼装器真实接入 ctx.rollingSummaries
- [ ] §3.8 `FIXED_SNIPPETS` 白名单 5 个写死语法：`repeat:lastN` / `date:format` / `weekday` / `history.hits` / `history.keywords`
- [ ] §3.8 `fillFixedSnippets` 替换函数（未识别原样保留，不抛错）
- [ ] settingsSdk.prompts 入口（§5 全部接口）

### 🎨 v0.1 UI（SDK 之后）

- [ ] **里程碑 2**：§4 主页面 + 库详情 + 组详情 + prompt 详情 + 拼装预览
- [ ] §3.6 组详情页加「historyDepth」滑块（1-5）
- [ ] §3.6 prompt 编辑页加「keywords[]」标签输入
- [ ] §3.6 prompt 编辑页加「vectorFallback」开关 + 「vectorThreshold」数字输入（默认 false / 0.6）
- [ ] §3.6 prompt 详情页显示「上次拼装命中了 N 次 / 关键词是 X、Y、Z」
- [ ] §3.6 预览面板里区分 `source: 'prompt'` / `source: 'keywordHit'` / `source: 'vectorHit'`
- [ ] §3.7 人设主页加「摘要历史」面板（K0 / K1 / K2 列表 + 删除按钮）
- [ ] §3.7 聊天 App 监听 C 满了 → 调 summarize → 自动清空当前 C
- [ ] §3.7 聊天 App 设置里加「阈值」可配（默认 10）
- [ ] §3.7 聊天 App 设置里加「摘要风格」可配（concise / detailed / chronological）
- [ ] §3.8 prompt 编辑页加「语法帮助」提示（告诉用户哪些 {{...}} 可用）

### 🚧 v0.2+（待定，先不做）

- [ ] §3.6 v0.2 是否要把整段原文改成"命中那一段"？
- [ ] §3.6 v0.2 重建向量 UI 按钮（用户换 impl 后清 `promptEmbeddings`）
- [ ] §3.7 是否要"整条链 K0+K1+... 塞进 prompt"的可选项？
- [ ] §3.7 压缩失败是否要重试 / 降级？
- [ ] §3.7 摘要的 token 估算是否要持久化？UI 显示"节省了多少 token"？
- [ ] §3.8 加 `{{if:cond:then:else}}` / `{{count:source}}` 写死语法
- [ ] §3.9 接日历 / 商城 / 天气 / 世界事件到拼装器
- [ ] 多触发器合并（trigger union / intersection）
- [ ] snippet 片段库（prompt 文本复用）
- [ ] 跨语言 embedding（用户在 register 时换更大的多语言模型）
- [ ] 官方 embedding impl 包（仓库 `examples/embedding-bge/` 给一份样板）