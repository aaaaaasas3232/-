# AGENTS.md — 小听启动系统说明书

> 给后续开发者 / AI 的**唯一入口**。历史踩坑与版本流水在 `docs/AGENTS2.md`。
> 读完应能：独立接入一个 App、走对资金与纪时、注册灵动岛与跨 App 通道、用单文件产物 1:1 打开。

---

## 0. 这是什么

小听启动是跑在浏览器里的 iPhone 模拟器。

- 入口：`index.html` → `src/index.js` → `js/apps/index.js` 把所有 App 注册到桌面
- 技术：Vite 5 + 浏览器全局 Vue 3（`js/vendor/vue.global.prod.js`，**不是 npm 包**）+ Tailwind + IndexedDB
- 业务 App 是纯 ESM，只通过 `registerPhoneApp` / `registerPhoneAppAsync` 一个口子接入
- 设置中心叫 **nook**（`id: settings`），聊天叫 **murmur**（`id: chat`）

```bash
npm install
npm run dev              # http://localhost:5173
npm run build            # 多文件 → dist/
npm run build:single     # 单 HTML → dist-single/index.html，file:// 应 1:1 可用
npm test
```

旧文档：`docs/README.md` 偏 murmur 实现；`docs/README2.md` / `docs/AGENTS2.md` 是补丁流水。**新 App 以本文件 + `docs/framework-总览.md` 为准。**

---

## 1. 目录与启动链

```
index.html                 Vue 外壳：状态栏 / 灵动岛 / 桌面 / App 窗
src/index.js               拼 framework + db + apps
src/core/                  给 App 用的 SDK（注册、渲染、岛、DB、逃逸）
js/framework/              桌面、灵动岛 runtime、presence-center
js/apps/index.js           ★ 所有内置 App 的 import + appFactories
js/apps/<id>/              各 App
css/apps/<id>/             各 App 样式（index.html 里要有 <link>）
js/db/                     IndexedDB 底座
src/core/db-catalog.js     全表说明书（nook「数据库」页读这里）
```

冷启动：`registerAll()` 按 `appFactories` 顺序注册 → 有 `stores` 的必须 `async: true`（先 `ensureSchema`）→ 桌面从 `listLaunchableApps` 画出图标。单个工厂抛错只跳过该 App，不中断全部。

---

## 2. 接入一个新 App（内置）

改 **三处**，不要改 `src/index.js`：

1. `js/apps/<id>/index.js` default export 工厂，返回 appConfig
2. `js/apps/index.js`：`import` + `appModules` + `appFactories`
3. `index.html`：`<link rel="stylesheet" href="/css/apps/<id>/index.css?v=1" />`
4. 若有新表：`appConfig.stores` **并且** `src/core/db-catalog.js` 登记，否则 nook 数据库页看不见、审计会报漂移

```js
{ name: 'my-app', factory: createMyApp, async: true }  // 有 stores 必须 true
```

`id` 用小写 + 连字符，发布后不要改。重名会被注册表静默跳过。

### 2.1 appConfig 必填

| 字段 | 说明 |
|---|---|
| `id` / `name` / `icon` | icon 必须是内联 `<svg...>`，否则桌面空白 |
| `pages[]` / `defaultRootPageId` | 后者必须落在 pages 里，否则打开白屏 |
| `renderPage(page, state, app)` | **没有 `this`**，用第三参 `app` |
| `renderMode` | `template` / `hybrid` / `vue` |
| `methods` | **方法简写**，禁止箭头函数（`this` 会丢，按钮点了没反应且不报错） |

### 2.2 三条运行时不报错的铁律

1. `renderPage` 被当独立函数调，内部没有 `this`
2. vue 模式框架**不会**自动 `hydrate()`，根组件 `mounted()` 里自己踢
3. 写 IndexedDB 前 `JSON.parse(JSON.stringify(x))` 剥 Proxy，否则 `DataCloneError`

### 2.3 插件（用户上传 / 粘贴）

nook → 软件管理：选文件或文本框粘贴。走 `src/core/plugin-installer.js`。

- **一行 `import` 都不能有**（blob URL，没有别名）
- 依赖从 `window.settingsSdk` / `window.__apiSdk` / `window.__listenPresets` 拿
- `methods` / `renderPage` 被包了隔离，单个插件抛错不会拖垮系统
- 有 stores 同样要能被 installer 登记；不要用 `@/` 路径

---

## 3. 跨 App 注册（最容易只做一半）

跨 App **不是** `import` 对方的 store。所有通道都是「声明 + 运行时 SDK」。少接一环的表现是开关能点、AI / 岛 / 桌面完全收不到，零报错。

### 3.1 灵动岛（两件事）

**声明**（用户才能在「灵动岛与小组件」里预览、关掉、试一下）：

```js
islandKinds: [{
    id: 'now-playing',          // 发布后不要改
    label: '正在播放',
    desc: '...',
    when: '开始播放时',
    template: 'music',          // 可选，对应 window.islandTemplates
    sizes: ['mini', 'medium', 'large'],
    previewPayload: { title: '...', message: '...' },
}],
notifyKinds: [{
    id: 'playback',
    label: '播放提示',
    type: 'info',               // success | warning | error | info | message | call | system
    title: '播放模式',
    message: '单曲循环',
    when: '切模式时',
}],
```

**弹**：

```js
this.toolkit.island.show('mini', { kind: 'now-playing', title, message, minSize: 'mini' });
this.toolkit.island.notify('success', '已保存', '深夜电台', { kind: 'playlist' });
```

- `show()` 不带 `kind` → 用户开关是摆设
- 进行中的活动必须 `minSize: 'mini'`，否则点三下岛外会把正在播放的状态点没
- **compact** 是通知/短提示尺寸（左圆标 + 标题 + 一句），不是音乐岛展开链的一环
- 左侧圆标只接受以 `<svg` 开头的字符串。canvas `ctx`、画图函数、`{{ icon }}` 文本插值都会在圆里画出源码。统一走 `src/core/island-icon.js` 的 `sanitizeIslandIcon`
- 短提示用 `notify()`（自动 compact + 3.5s）；不要 `show('compact')` 却不给模板

打开总览：任意 App 里 `<button data-presence-center="music">灵动岛与小组件</button>`。

### 3.2 桌面小组件

```js
widgets: [{
    id: 'today',
    label: '今日',
    sizes: ['S', 'M', 'L'],
    render(size, payload) { return `...`; },   // S 不能被裁空
    previewPayload: {},
}]
```

预览尺寸必须跟 `css/core/30-widgets.css` 真机一致（M 132×150，L 284×154）。

### 3.3 murmur 提示词卡

```js
setup({ toolkit }) {
    toolkit.prompts.register({
        id: 'overview',
        label: '某某 · 概况',
        content: '……',          // 快照，不是实时值
        defaultActive: false,
        order: 50,
    });
}
```

必须放 `setup()` 不是 `hydrate()`（用户可能先开 murmur）。实时状态（播到第几秒）不要写进 `content`，发送时现算。变量用 `{{aiName}}` / `{{userName}}`，实现只有 `src/core/prompt-variables.js` 一份。

### 3.4 社交形象

```js
socialProfile: {
    label: '氧气',
    fields: ['nickname', 'avatar', 'background'],
}
```

数据在 `persona.socialProfiles[appId]`。nook 人设页自动多一张卡。不要改 nook 内部。

### 3.5 世界模式可见性

```js
worldAvailability: { includeModes: ['actor'], requiresBoundWorld: true },
distribution: { requiresInstall: false },
```

演员 App 只在 actor 世界出现，电竞只在 esports。桌面可见性和 hydrate 拦截是两道闸。模式定义在 `src/core/world-profile.js` 的 `WORLD_MODES`。

### 3.6 社交影响（热搜 / 私信 / 动态）

```js
import { registerSocialInfluenceProvider } from '@/src/core/social-influence-registry.js';
setup() {
    registerSocialInfluenceProvider({
        sourceAppId: 'actor-career',
        providerId: 'hot-terms',
        targetAppIds: ['blog'],
        channels: ['hot-search'],
        getContent: () => '只读概要，不调 AI',
    });
}
```

只输出概要文本；注册放 `setup()`（内存表，刷新要重放）；禁止碰氧气值 / 小听 / 黑匣子，禁止 import 目标 App 的 store。

### 3.7 资金（同一本账）

人设钱包：`persona.assetBalance` + `assetFlow[]`。

唯一写入口：`window.settingsSdk.assetFlow.add({ type, direction, amount, sourceType, sourceId, note }, entityType, entityId)`。

- `amount` 是绝对值，方向看 `direction: 'in' | 'out'`
- 支出余额不足返回 `{ ok:false, insufficientBalance:true }`，**不要**再调 `persona.asset.adjust`
- 同一 `sourceId` 24h 内去重
- 退款：`assetFlow.removeBySource(sourceType, sourceId, entityType, entityId)`
- 读余额：`assetFlow.getBalance('user', userId)`

谁在用：murmur 红包/转账、四叶草购物、求职发薪、追光片酬/奖金、定时收入（`income-engine.js`）。**禁止**在 App 自己的 store 另存一份 `balance`。

货币名来自当前世界 `world.currencies` 里 `isBase` 那条，不要写「元」「$」。

参考：`js/apps/shop-app/services/wallet-service.js`、`js/apps/setting/world/sdk/asset-flow.js`。

### 3.8 纪时

`world.chronologySettings` + `sdk.chronology.realToWorld` / `worldToReal` / `format`。

状态栏可切真实时间 / 世界纪时。叙事日期必须来自世界钟，不要 `new Date()` 冒充。

每档独立时钟（追光 / 声浪）：`anchorMs + day + minute`，快进整档一起走，新开档归零。到 24:00 要问「进入下一天 / 明天再玩」。

锚点：段锚点（奖项/赛事）和点锚点（节日）存在 `world.anchors`，演员/电竞改自己的表时要 `sync*AnchorsToWorld`（`js/apps/setting/world/sdk/anchor-sync.js`）。

### 3.9 地点

读：`sdk.places.list({ worldRef })` / `sdk.locations.getByPlace()`。
写：只有用户确认才 `registerGeoCandidate`。打开 App 禁止批量写地图。

地标图标是预设 SVG（`landmark-icons.js`），不是 emoji。形态：描边圆球 + 内部 SVG + 旁边描边字，色 ≠ 底色。

### 3.10 AI 调用

`window.__apiSdk`（`apiKeySdk` / `apiGroupSdk` / `apiUsageSdk`）。没有 `listKeys()`。

```js
const key = window.__apiSdk?.apiKeySdk?.listEnabled?.()?.[0]
         || window.__apiSdk?.apiKeySdk?.list?.()?.[0];
```

`settingsSdk` 冷启动可能还没好：等 `settings-sdk-ready` 或每层 `?.`。

跨时空对局：每个座位用**自己的** Key，不要共用一把。

---

## 4. 现有 App 结构

工厂清单在 `js/apps/index.js`。下面按「它是什么 / 目录 / 跨 App 钩子」写。实现细节以各 `index.js` 顶部注释为准。

### 4.1 nook · `settings`

`js/apps/setting/`。人设、世界观、外观、API、软件管理、图库、数据库页。

- 对外暴露 `window.settingsSdk`（users / aiPersons / worlds / places / locations / timelines / assetFlow / chronology / persona.asset …）
- 世界观只留演员 / 电竞两套预设（`world/presets/world-presets.js`），新建先选空白或预设
- 人设「去配置货币」必须先写 `world.currentWorldId = persona.boundWorldId` 再打开 `pageId: world`（不要跳不存在的 `world:assets`）

### 4.2 murmur · `chat`

`js/apps/chat-app/`。私聊 / 群聊 / 朋友圈 / 通话 / 红包 / 提示词 / 小游戏。

- 群成员数 = `members.length + 用户`（两个 AI 的群是 3 人）
- 朋友圈卡：外收藏+分享，左滑编辑/删除
- 岛：`call`（medium/large 模板）、`incoming-call` / `new-message`（compact 通知）
- 群聊小游戏：`games/custom-games.js` 上传 JS，`import(blobURL)`，无 import 语句
- 大量历史动态 `import()`；单文件构建会把字面量动态 import 提升成静态，避免 file:// 404

### 4.3 音乐 · `music`

`js/apps/music-app/`。播放、歌单、歌词、一起听、音乐岛。

- 岛模板 `music`：mini / medium / large；**开始播放、切歌、从后台回来都停在 mini**，用户自己点才展开
- 岛底纯黑（`css/music-island.css`）
- 预设歌只留「枕边童话」
- `notifyKinds`：playback / listen-together / playlist / lyrics / share
- murmur 三种音乐卡片 + `[一起听:歌名]`

### 4.4 天气 · `weather-app`

单文件 `js/apps/weather-app.js`。城市列表、详情渐变背景。`islandKinds.weather-toast` 是 compact 短提示，运行时走 `notify()`。

### 4.5 专注 · `focus` / 商店 · `appstore` / 封面 · `cover-designer`

工具型。商店改 `distribution.installed`。封面是 vue 模式，必须自己 `hydrate`。

### 4.6 解压舞台 · `relax`

`js/apps/relax-app/`。fullscreen 自绘。`relax-toast` compact。参考实现之一。

### 4.7 梦境编织 · `dream-weaver`

书、灵感页（不是弹窗）、正则替换（`xx → HTML 片段` + 预览）、主题 mixin。弹窗只淡入不旋转。

### 4.8 四叶草购物 · `shop`

`js/apps/shop-app/`。商品 / 车 / 订单。钱包 = `wallet-service.js` → `sdk.assetFlow`。

### 4.9 求职 · `job`

`js/apps/job-app/`。职位 / 简历 / 面试 / 在职发薪。发薪同样走 assetFlow。时间用相对「X 天前」，过期不可投。

### 4.10 人设工坊 · `persona-lab`

草稿库，写入 nook 人设。读 `settingsSdk`，判空。

### 4.11 湛蓝回忆 · `galgame` / 气泡机 · `bubble-maker` / 情景 · `scene-play`

主题一律 `src/core/theme-panel-mixin.js`：实时预览、命名保存/改/删、复制变量名、粘贴全部。应用后底栏要刷 `homeIndicatorColor`（mixin 里已做）。

### 4.12 日记 · `diary` / 候鸟 · `travel` / 萤火 · `youtube` / 氧气 · `blog`

内容型，多表，async 注册。氧气吃 `social-influence` 热搜；萤火是视频。旅游读世界地点。

### 4.13 追光 · `actor-career`

演员成长。`worldAvailability.includeModes: ['actor']`。九维属性、每档时钟、加权事件、NPC 名册、片酬走 assetFlow、奖项/节日同步世界锚点。`social-influence` → 氧气/萤火。

### 4.14 声浪 · `esports-forum` / 赛点 · `esports-game`

电竞世界。`includeModes: ['esports']`。声浪是论坛+生涯事实源，赛点是对局，通过 registry 调声浪 services，不要互相 import store。赛事/节日同步世界锚点。

### 4.15 点灯 · `starlit`

`js/apps/starlit/`。用一面推理墙学语言 / 学代码。8 张表（`sl*`），async 注册。

- **不挑世界观**：老师可以是世界观里的 AI，也可以就是模型本身。没绑世界时档案键退化成 `${userId}::solo`
- 主流程：建主题 → 摸底问卷 → 水平侧写 → 定终点 → 排课 → 上课 → 结课收成卡片网 → 反转课堂
- **技能协议**：老师在正文外吐 ```` ```starlit ```` 围栏块（`kind` 区分 gloss / correct / word / concept / code / post / quiz / dict / stuck / objective / reuse / end）。只有一个围栏名，解析在 `services/skill-parser.js`，两边的 kind 列表必须对齐
- **语言模式的四个自定义维度**（2026-08）：
  - 浸没维度挂在**主题**上（`topic.immersion`：full 全外文 / gradual 按课程序号自动升档，档位表 `IMMERSION_STAGES`），建主题时选，「我的」里可改；prompt 落点在 `prompt-builder.immersionRule`
  - 一条回复拆多个短气泡（`services/bubble-split.js`：老师空行分段优先，本地按视觉宽度兜底），gloss 数组与气泡对齐 `alignGloss`
  - 翻译形态挂在**档案**上（`profile.glossMode`：meme 描边贴气泡边 / tap 微信式点开），渲染在 `lesson-page.js` 的 SlBubble
  - 长按翻译（`services/translate-service.js`）：local 用自己的词典拼、ai 只发这张卡的内容（上限 `cardTranslatableText`）；悬浮层 `meme-overlay.js` 单击关、长按拖、位置存档案
- **卡片库跨课复用**：`services/card-library.js` 判重，同一概念在推理墙上只有一张卡（`usedInLessons` 记它被哪几节用过）
- **推理墙**：`services/graph-layout.js` 自己实现的力导向 + 矩形去重叠 + 分量装箱，**纯几何不调 API**；超过 420 张卡自动退回网格
- **反转课堂**：AI 拿到的提示词里只有「你是一个 xxx 水平的学生」，**没有这节课的任何内容**；下课由 AI 决定
- **画在 App 外面的三样东西**（`services/ticker.js`，纯 DOM 单例，退出 App 照常运行）：
  - 弹幕挂 `.phone-screen`，`z-index: 200`（要 > `.app-window` 的 100，< 状态栏的 999）
  - 灵动岛模板 `starlit-dict` 运行时注册进 `window.islandTemplates`，CSS 在 `css/music-island.css`（单文件构建靠它内联）
  - 小电视挂 `#phone`，贴在 `.phone-case` 外的顶边中央；无手机壳模式下锁死，拉大时按壳上方剩余空间夹住
- 回归：`node __probe-starlit.mjs`（59 项）、`node __probe-sl-lang.mjs`（语言模式 32 项）、`node __probe-sl-overlay.mjs`（层级与越界）

### 4.16 App 制作 · `app-maker`

问卷 → 蓝图 → 提示词 / 白膜。能力项含购物、求职、世界观模拟、五子棋、贪吃蛇、跨时空回合制。生成提示词在 `survey/prompt.js`，按勾选裁剪。

### 4.17 小奇怪 · `oddity`

`js/apps/oddity/`。旧原型合集，四个 tab（玩 / 捏 / 看 / 字）。3 张表（`oqLibrary` / `oqGames` / `oqScores`），async 注册。vue 模式自绘全屏，顶栏 padding 兜底 `--app-safe-top, 50px`（这个变量全项目没人定义，fallback 必须 ≥ 状态栏的 50px）。

- **玩**：扫雷（真实玩法：点格子扫、长按插旗、第一下不炸、+1/−5 轮流计分）、五子棋（15 路、JS 判胜负）、你有我没有。前两个开局可选对手：本地真人或 nook 的 AI 人设
- **棋类 AI 座位**（`services/board-ai.js`）：模型只回 `{"x","y","line"}`；没 Key / 回不合法 → 引擎的本地棋手兜底（扫雷约束推理、五子棋连型打分），**局永远不卡死**。AI 回合由组件 watch tickKey 驱动（照「你有我没有」那套，不手动接力）
- **分享进 murmur**（`services/chat-bridge.js`）：三个游戏终局都能发 `type: 'game_record'` 消息进私聊 —— **复用** murmur 群聊小游戏那张战绩卡（渲染器 / 详情页零改动，详情按消息 id 全局查）
- **提示词库**：`library.customPrompts`（增删改在 `components/game-common.js` 的 OqPromptLib），注入所有 AI 对局（你有我没有走 `prompt-builder.buildCustomPart`，棋类走 `board-ai.customBlock`）
- **游戏数据概要**：App 内看板（OqScoreboard）+ murmur 动态提示词卡 `oddity-stats`（`app-prompts.syncStatsPrompt`，战绩变化 / hydrate 后由 `store.syncStatsToMurmur` 重放；没战绩时注销）
- 一起玩的岛播报统一 `kind: 'oq-match'`（开局 / 终局），踩雷单独 `oq-sweep`
- 回归：`node __probe-oddity.mjs`（32 项）

---

## 5. 主题、弹窗、fullscreen

主题：优先 `createThemePanelMixin`。按钮：复制变量名 / 粘贴全部 / 保存（可命名）/ 改 / 删 / 应用。应用后 `liveApplyTheme` 必须改 CSS 变量 **和** 底栏 `homeIndicatorColor`。

弹窗：同一 App 内统一；不同 App 可以不同。vue 用各 App 的 modal 组件；template 用 `src/core/presets` 的 `LP.modals.*`。不要用全局 `.ac-overlay` 当自己的类名前缀（追光撞过，全站 z9999 居中）。

fullscreen 自绘 App 必写四条（否则左右空 14px、指示条被盖、退不出 App）：

```css
.app-shell[data-app-id="YOUR_ID"] .app-content { padding: 0; }
.app-shell[data-app-id="YOUR_ID"] .app-page-stack { border-radius: 0; }
.app-shell[data-app-id="YOUR_ID"] .app-page { overflow: hidden; }
.app-shell[data-app-id="YOUR_ID"] .app-screen-panel { height: 100%; min-height: 0; padding: 0; }
```

`.app-bottom` 是 z-index 6。App 内所有层 < 6（tabbar 4，覆盖层 5）。

---

## 6. 从零生成 / HTML 转 App

完整提示词：

- `docs/提示词-从零生成App.md`
- `docs/提示词-HTML转App.md`
- 问卷生成版：`js/apps/app-maker/survey/prompt.js`（更严，按蓝图裁剪）

生成后自检（缺一条就返工）：

1. 工厂 default export，id 不冲突，`defaultRootPageId` 在 pages 里
2. `renderPage` 无 `this`；`methods` 无箭头函数
3. 用户输入 / DB 字段进 HTML 前 `escapeHtml`
4. 有 stores → `async: true` + `db-catalog.js`
5. 岛：声明了 `islandKinds`/`notifyKinds`，`show`/`notify` 带 `kind`，compact 圆标是 SVG
6. 钱只走 `assetFlow`；时间只走 `chronology` 或档内时钟
7. CSS 类名前缀全库 grep 过（禁 `ac-`）
8. 插件形态则零 import
9. `index.js` + `index.html` link 都加了
10. 打开、切页、杀进程再开，数据还在

参考实现：结构抄 `relax-app`；钱抄 `shop-app/wallet-service.js`；世界模拟抄 `actor-career`；岛抄 `music-app`。

---

## 7. 小游戏

群聊：murmur 游戏页上传 JS，规范见 `js/apps/chat-app/games/game-kit.js` / `game-prompt.js`。

独立 App（App 制作勾选；现成参考实现在小奇怪 §4.17）：

| 类型 | AI | 要点 |
|---|---|---|
| 五子棋 | 要 | JS 判胜负；AI 只回 `x,y`；解析失败**用本地棋手兜底**（别随机瞎下，抄 `oddity/services/gomoku-engine.js` 的打分法） |
| 扫雷 | 可选 | 点格子扫、长按插旗、第一下不炸；AI 座位抄 `oddity/services/board-ai.js` |
| 贪吃蛇 | 不要 | 纯本地，禁止 `__apiSdk` |
| 跨时空回合制 | 每座位一把 Key | 最多 4 人（用户+3AI）；失败跳过该座位 |

战绩想进 murmur 就写 `type: 'game_record'` 消息（复用现成渲染器，见 `oddity/services/chat-bridge.js`），不要新造卡片类型。

---

## 8. 单文件打包

`npm run build:single` → `dist-single/index.html`。

`vite.config.single.js` 做了：

1. 字面量 `import('./x.js')` 提升为静态 import，避免拆 chunk
2. `vite-plugin-singlefile` 内联 JS/CSS
3. 把 Vue vendor、favicon、残留 link 收进 HTML
4. 音乐岛 CSS 编译期打进 `island-templates.js`
5. `window.__LISTEN_SINGLE_FILE__ = true`

验收：`dist-single/` 里只该有 `index.html`（顶多 favicon）。用浏览器直接打开该 HTML，桌面、聊天、音乐岛、nook 资金与纪时都要能用。动态 `import(blob)`（插件 / 群聊游戏）保持运行时加载，这是故意的。

不要用 `define` 把 `window.__LISTEN_SINGLE_FILE__` 整个标识符替换成 `true`（会把赋值打成 `true = true`）。

---

## 9. 数据库

表的唯一说明书：`src/core/db-catalog.js`。nook 数据库页从这里画，编辑要真写回 IndexedDB。导入导出走该页现有按钮。新表不登记 = 用户以为没存。

---

## 10. 常见静默失败（先查这里）

| 现象 | 原因 |
|---|---|
| 按钮没反应 | methods 写成了箭头函数 |
| vue App 永远空/loading | 没在 `mounted` 调 hydrate |
| 打开白屏 | `defaultRootPageId` 不在 pages |
| 存了刷新没了 | 有 stores 但 `async: false`，或没剥 Proxy |
| `[AppDb:xxx] 未声明的数据表: yyy` | 表在 `js/db/base-stores.js` 有，但没写进该 App 的 `appConfig.stores`；`toolkit.db` 是按 App 声明白名单的 |
| 整套 SDK / 模块半死不活 | 串行 `await xxx.hydrate()` 里有一个抛错就把后面全带走了；逐个 try/catch |
| 岛开关没用 | `show`/`notify` 没带 `kind` |
| 岛左边圆里是 `ctx` / 源码 | icon 不是 SVG，或用了 `{{ icon }}` |
| compact 岛是空黑条 | `show('compact')` 却走了没有模板的 info；短提示请用 `notify()` |
| 音乐岛被点没 | 没设 `minSize:'mini'` |
| murmur 没有你的提示词 | register 写在 hydrate |
| 桌面有图标点进去空 | 插件已删但桌面没同步（现已会剔除） |
| 类名把别人挤爆 | 前缀撞了 `.ac-` / `.ox-` / `.wv-` |
| 退不出 App | 覆盖层 z-index ≥ 6 盖住指示条 |
| file:// 单文件聊天挂了 | 残留 chunk 还在 `import('./xxx.js')` |

历史长文与版本笔记：`docs/AGENTS2.md`。
