# 聊天 App 打开卡在「加载中」Bug

> 写于 2026-08-04 修复聊天 App 打开后只显示「加载中三字」/控制台无限刷屏之后。
> 关联档案:
> - `待办/detailRenderTick双ref重复声明Bug.md` — 历史上 framework core-shim 重复声明了同名 ref
> - `待办/rendererCache命中导致button无反应Bug.md` — 历史上 cache key 只用 appId+pageId 时被业务状态变更绕过
>
> 这份是同一个「renderer cache × tick 同步」赛道的**第三个坑** — 这一次是 async 渲染路径下 cache tick 永远落后 currentTick 一拍,造成「加载中」死循环。

---

## 现象

打开聊天 App 后,主 tab 区域只显示「加载中」三个字,**永远不渲染真页面**。

副症状:

- 控制台 `[ListenDb.ensureSchema] 缺 store` 这类日志在第一次启动后**只刷一遍**(修过的),但**聊天 app 的 "加载中" 显示之后没有别的新日志输出**
- 切换到其它 app 再切回聊天 app,**依然显示「加载中」**(这意味着不是「首次渲染卡一下」而是「永远卡死」)
- 其它用了 async renderer 的 app 也可能有同样症状,但聊天 app 第一个暴露出来是因为它唯一一个路由用 template 模式 + 全部 renderPage 是 async 的设计

---

## 调试流程

### 第一阶段: 确保 db 索引能建上(已修)

- `engine.js` 之前不识别 `indexes` 字段,chat-store 声明的 7 条索引从来没建过
- `ensureSchema` 反复打 console.debug 喷日志
- 修法参见下方「衍生修复(1)+(2)」
- **修完后 db version 从 36 升到 38,索引齐了** — 但聊天 app 还是卡在加载中,所以根因不在这

### 第二阶段: 升级窗口期同步读 API 报错(已修)

`ensureSchema` 升级路径中会 close() + reopen(),期间 `this.db` 短暂为 null,同步读 API(外观设置 / widget 桌面 / api-manager 缓存)会抛「数据库未初始化」错误。

- 修法: `_request()` 里加 `if (!this.db) this.open().then(run, reject)` 兜底
- 修法: `ensureSchema()` 加日志防抖(避免每次调用都喷一行)
- 修法: 给 `ensureSchema` 加索引一致性检查(对比 store 上的 `indexNames` 与 wanted indexes)

### 第三阶段: 真凶 — cache tick 失同步死循环(本 bug)

读了 `待办/detailRenderTick双ref重复声明Bug.md` 和 `待办/rendererCache命中导致button无反应Bug.md` 两份历史 debug 文档,锁定了「renderer cache × tick」的赛道。

手算了一遍 `resolveAsyncRenderer` 在 async 路径下的 cache.tick 与 currentTick 流转,发现**cache tick 永远落后 currentTick 一拍**。

---

## 根因(cache tick 失同步死循环)

`use-app-navigation.js` 的 `resolveAsyncRenderer` 在异步渲染路径下的 cache 与 tick 流转:

### 第一次同步调用(currentTick = 0)

```
const currentTick = detailRenderTick.value  // = 0
// cache miss
result = renderer(content, page, app)       // 返回 Promise (chat-app 的 renderPage 是 async)
cache.set(key, { tick: 0, html: loadingHtml })   // ① loadingHtml 进 cache, tick=0
return loadingHtml                              // ② 屏幕显示「加载中」
```

### Promise resolve(异步,同一 microtask)

```
result.then((html) => {
    const finalTick = detailRenderTick.value     // = 0 (同步代码,ref 还没被改)
    cache.set(key, { tick: finalTick, html })    // ③ 真 html 进 cache, tick=0  ⚠️
    detailRenderTick.value = max(0, 1) = 1       // ④ 自增 → 触发 Vue 重算
})
```

### Vue 第一次重算(currentTick = 1)

```
const currentTick = detailRenderTick.value  // = 1
const cached = cache.get(key)              // { tick: 0, html: realHtml }
cached.tick (0) !== currentTick (1)        // ⑤ miss!
result = renderer(...)                     // 又调 renderer, 又返回 Promise
cache.set(key, { tick: 1, html: loadingHtml })  // ⑥ loadingHtml 再次进 cache
return loadingHtml                              // ⑦ 屏幕又显示「加载中」
```

### Promise resolve(异步)

```
cache.set(key, { tick: 1, html: realHtml })    // tick 还是比 currentTick 落后一拍
detailRenderTick.value = max(?, 2) = 2
```

### 循环…

**核心问题**:`cache.set` 的 tick 写的是 **「resolve 那一刻」的 detailRenderTick.value**(还没自增,所以是当前 currentTick = N),而 `detailRenderTick.value++` 又把 ref 推到 **N+1**。**Vue 的下一次重算拿 currentTick = N+1,看到 cache.tick = N ≠ N+1 → 又判 miss → 又调 renderer → 又加载中 → 永远循环**。

流程图:

```
sync 1 → loadingHtml (cache tick=0) → promise → realHtml (cache tick=0) → tick=1
   ↑                                                                      ↓
   └── Vue tick=1 → miss → loadingHtml (cache tick=1) → promise → realHtml (cache tick=1) → tick=2
                                                                              ↑
            ← ← ← Vue tick=2 → miss → ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ┘
```

**每次重算 currentTick 都比 cache tick 大 1 — 永远 miss**,renderer 一直被反复调用,但 `v-html` 的新值还是「加载中」(因为 Promise 还 pending),看起来就是**永远卡在加载中**。

### 为什么 settings app 不卡

settings app 的 detail 页大多用 **sync renderer**(返回字符串不是 Promise),走的是 `resolveAsyncRenderer` 的 sync 分支(line 102 `const str = result || ''`),直接 `cache.set({ tick: currentTick, html: str })` — cache tick 与 currentTick **同步对齐**,不会失一拍。

只有 **async renderer**(Promise 路径)才有这个 bug。聊天 app 的 `renderMessagesPage` / `renderContactsDetailPage` 等都是 async,所以全挂。

---

## 修复

`js/framework/use-app-navigation.js` 的 `resolveAsyncRenderer` — Promise resolve 时**直接写 promisedTick**(就是会被 ++ 的那个值),而不是当时的 detailRenderTick.value:

```105:99:js/framework/use-app-navigation.js
if (result && typeof result.then === 'function') {
    const loadingHtml = '<div class="app-render-loading" ...>加载中…</div>';
    cache.set(cacheKey, { tick: currentTick, html: loadingHtml });

    // ★ 关键：Promise resolve 时把 cache 的 tick 预写到 promisedTick (= currentTick + 1)，
    // 这样随后 ++detailRenderTick 触发 Vue 重算时，currentTick 与 cache.tick
    // 才能对齐、命中缓存返回真正的 html，避免死循环（每次重算都看到缓存失效、
    // 再调 renderer → 再 Promise → 再加载中 → 再 ++tick → 永远停在加载中）。
    const promisedTick = currentTick + 1;
    result.then((html) => {
        // ★ cache 用 promisedTick 对齐未来 currentTick，保证下次 Vue 重算时
        // currentTick === promisedTick === cache.tick,命中缓存返回真 html。
        // (之前用 detailRenderTick.value 会有「cache.tick 落后 currentTick 一拍」
        // 的问题 —— 当前代码执行时 detailRenderTick.value 还是 currentTick 旧值，
        // 写进去 cache 后 +1 才让 Vue 重算，结果 cache tick < currentTick,
        // 永远 miss,触发「加载中」死循环)
        cache.set(cacheKey, { tick: promisedTick, html: typeof html === 'string' ? html : '' });
        if (detailRenderTick && typeof detailRenderTick.value === 'number') {
            detailRenderTick.value = Math.max(detailRenderTick.value, promisedTick);
        }
    }).catch((e) => {
        console.error('[framework] async renderer 失败:', e);
        cache.set(cacheKey, { tick: promisedTick, html: '<div …加载失败…' });
        if (detailRenderTick && typeof detailRenderTick.value === 'number') {
            detailRenderTick.value = Math.max(detailRenderTick.value, promisedTick);
        }
    });

    return loadingHtml;
}
```

---

## 同时修复的衍生问题(同一调试任务里)

修「加载中」时一并把相关问题修了,免得留下雷:

| 文件 | 改动 | 目的 |
|---|---|---|
| `js/db/engine.js` | `appendBaseStore` / `registerStore` 支持 `{ keyPath, indexes }` 形式;`onupgradeneeded` 创建索引(已存在的 store 也补索引) | 让 chat 表声明的索引真的能建出来 |
| `js/db/engine.js` | 新增 `getAllFromIndex(storeName, indexName, query?)` 方法 | 让 chat-store 的索引查询真的命中索引,而不是 fallback 到 getAll + filter |
| `js/db/engine.js` | `ensureSchema()` 加日志防抖 `_lastSchemaLogKey` + 索引一致性检查 | 同一个 db 状态只喷一行日志,避免 console 疯涨;升级期间即使 store 都在也能发现索引缺失 |
| `js/db/engine.js` | `_request()` 在 `this.db` 为 null 时自动 `await open()` 再读 | 升级窗口期同步读 API 不抛「数据库未初始化」 |
| `js/db/base-stores.js` | 把 chat 相关 stores 的 indexes 字段也包到 store 定义里,启动时 `open().then(() => ensureSchema())` | 主动补索引,避免依赖每个 app 自己 ensureSchema |
| `js/apps/chat-app/store/chat-store.js` | `ensureReady()` 加 `_ready` / `_readyPromise` 缓存 | db 已 ready 后秒返回,避免每次切到聊天 app 都重跑 schema 检查 |

---

## 中间撤回的错误修改(留档)

调试过程中**误以为可以避免 close+open**:

```js
// ❌ 这是错的 IndexedDB API,已撤回
async _upgradeSchema(nextVersion) {
    const tx = db.transaction(allNames, 'versionchange');  // ← 普通代码不能开 versionchange 事务
    ...
    tx.createObjectStore(storeDef.name, { keyPath: ... });
}
```

IndexedDB 规定:**只有 `indexedDB.open()` 的 `onupgradeneeded` 回调内**才能改 schema(createObjectStore / createIndex / deleteObjectStore)。普通事务(包括 versionchange 模式)**无权改 schema**。

`close() + open(version+1)` 是唯一正确的升级路径,我之前改的兜底(`_request` 里 `if (!this.db) await open()`)足够处理窗口期,撤回那次改动是最干净的状态。

---

## 修复后行为

| 触发 | tick 变化 | cache 命中？ | 结果 |
|---|---|---|---|
| 首次打开 detail / 聊天 app root page | 0 → 0 | miss | 调 renderer,缓存 `{tick:0, html:loading}` |
| async renderer Promise resolve | 0 → 1 | 写入 `{tick:1, html:real}` | — |
| Vue 重算(tick=1) | 1 → 1 | **hit (tick=1)** | 直接返回真实 HTML ✅ |
| 业务方法改 state + refresh() | 1 → 2 | miss(tick=1 ≠ 2) | 重新调 renderer ✅ |
| 同一页没改 state 但 Vue 因为别的原因重算 | 1 → 1 | hit | 返回缓存 ✅ |
| 切到别的 detail page | key 变 | miss | 调 renderer ✅ |

---

## 教训 / 给 AI 编程助手的注意事项

- **async 路径下,cache 与 tick 的「先后顺序」必须明确**。cache 写入时拿到的 tick 值,必须等于 **Vue 下一次重算时**会读到的 currentTick,否则永远失一拍。简单口诀:**「写 cache 时,先想 Vue 下次会读到几」**
- **`detailRenderTick.value++` 与「读写 currentTick」必须在同一个 microtask 里算清楚**。`promise.then()` 里的 `detailRenderTick.value` 拿到的是「++ 之前」的旧值,不能直接拿来当 cache key
- **IndexedDB schema 升级只能 `close + open(version+1)`**。普通代码不能 `transaction('versionchange')` 改 schema;没有「原地升级」这条路。任何号称可以原地改 schema 的方案都是错的或依赖过时的 `setVersion()` API(已废弃)
- **「永远卡死」几乎都是 cache 的回流问题**。「加载中」本质是「frame 1: loading → frame 2: realHtml → frame 3: 又 loading」,回流循环在 cache 不命中后再次进入 renderer,renderer 又返回 Promise 又 loading。诊断时直接手算 cache.tick 与 currentTick 的流转
- **衍生修复优先合并到同一改动里**。这次为了修真根因,顺手把 db 索引(logically 同一个「异步 db 系统」)、chat-store 缓存、合在一起修,避免分多个 commit 让人搞不清先后顺序
- **历史 debug 文档是非常宝贵的上下文**。`待办/` 里的 `detailRenderTick双ref重复声明Bug.md` 和 `rendererCache命中导致button无反应Bug.md` 直接给了「renderer cache × tick」赛道的入口,**花 2 分钟读它们比凭直觉瞎调省 1 小时**
- **撤回错误的中间修改时,在新文件里写「中间撤回的错误修改」section** 留档,防止下次调试时又被引入。一个错的方案如果没有留档,大概率会被反复踩
