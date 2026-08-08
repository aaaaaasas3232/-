# Framework 渲染管线 —— 三种模式完整梳理

> 排查日期:2026-08-04
> 目标:理解主页 (`activeApp` 当前 root page) 和 detail 页 (`currentDetailPage`) 的渲染流程,
>      以及「主页文字透到 detail 上」问题的所有可能原因。

---

## 1. 入口 → Mount

`index.html` 顶部:
```html
<script src="/js/vendor/vue.global.prod.js"></script>
...
<script type="module" src="/src/index.js"></script>
```

`src/index.js` → `js/framework/core-shim.js`:
```js
const systemData = Vue.createApp({ setup() { ... } });
systemData.mount('#phone');
```

**关键**:Vue 拿到 `#phone` 容器里的 HTML 当模板(template 字符串内嵌在 index.html 里),渲染出真实 DOM。

---

## 2. Template 结构(节选自 index.html)

```html
<div id="phone">
  ...
  <div class="app-window">
    <div v-show="activeApp" class="app-shell">
      ...
      <div class="app-content" :class="{ 'detail-active': !!currentDetailView }">
        <div class="app-page-stack" :class="{ 'detail-active': !!currentDetailPage }">

          <!-- ★ 主页 -->
          <div class="app-page" :class="{ 'page-hidden': !!currentDetailPage }">
            <div v-if="activeApp" class="app-screen-panel"
                 ref="appScreenPanel"
                 v-html="currentPageView"></div>
          </div>

          <!-- ★ Detail 详情页 -->
          <div v-if="currentDetailPage || currentDetailView"
               class="app-detail-page"
               :data-app-id="activeApp?.id">
            <div class="app-detail-surface">
              <div class="app-detail-header">
                <button @click.stop="closeDetailPage">
                  <span>‹</span><span>返回</span>
                </button>
                <div class="app-detail-header-copy">
                  <div class="app-detail-title">{{ currentDetailTitle }}</div>
                </div>
              </div>
              <div class="app-detail-body">
                <div class="app-detail-panel" ref="appDetailPanel"
                     v-html="currentDetailView"></div>
              </div>
            </div>
          </div>

        </div>
      </div>
      ...
    </div>
  </div>
</div>
```

`currentPageView` / `currentDetailView` 是 framework 里两个 computed,
内容来自当前 `activeApp` 调 `renderPage` / `renderDetailPage` 返回的字符串。

---

## 3. 三种渲染模式(template / hybrid / vue)

**所有模式的唯一入口**:`js/framework/app-renderer-bridge.js`
它监听 `currentPageView` / `currentDetailView` / `activeRootPageId` /
`activeAppId` / `detailRenderTick` 的变化,按 `app.renderMode` 分发。

| 模式 | `renderPage` / `renderDetailPage` 返回 | 处理位置 | 适用 |
|---|---|---|---|
| **template**(默认) | **HTML 字符串** | framework 直接 `v-html` 注入到 `.app-screen-panel` / `.app-detail-panel` | 旧 App / 纯静态 App / 用内置模板拼装 |
| **hybrid** | HTML 字符串 + `<component-island name="..." />` | framework 先 `v-html` 注入,然后扫描 `<component-island>` 标签,替换成 `<div class="island-mount" />`,再用 `Vue.createApp()` 挂载真组件 | 半交互 App(80% 的业务场景) |
| **vue** | **完整的 Vue 组件配置** | framework 调用 `app-renderer.mountInto(rootEl, app, content, page, key)` —— 把这块面板**单独再 mount 一个 Vue 子 app** | 状态复杂、需要响应式交互 |

**所有三种模式最终产物都是字符串 / config,被 framework 注入到 DOM**,
所以**主页 / detail 可见性跟渲染模式无关**,由 `.app-page` / `.app-detail-page` 的 CSS 决定。

---

## 4. 主页 ↔ Detail 切换的状态机

| 状态 | `activeAppId` | `detailPageStack` | `currentDetailPage` | `currentPageView` | `currentDetailView` |
|---|---|---|---|---|---|
| 没开 app | null | `[]` | null | `''` | `''` |
| 开 app,在主页 | `'weather-app'` | `[]` | null | weather 主页 HTML | `''` |
| 点卡片进 detail | `'weather-app'` | `[{id:'city-detail'}]` | `{id:'city-detail'}` | weather 主页 HTML | weather detail HTML |
| 返回 | `'weather-app'` | `[]` | null | weather 主页 HTML | `''` |

Detail 入口:`useAppNavigation.openDetailPage(pageId, payload)`
退出:`closeDetailPage()`

`detailPageStack` 支持 push / pop。

---

## 5. 「主页文字透到 detail 上」—— 所有可能原因清单

按可能性排序:

### ★ 可能 A:Vue mount 了两次(我们当前的怀疑方向)
- `systemData.mount('#phone')` 被调用两次
- `#phone` 容器下生成**两份** `.app-page-stack` 副本
- `currentDetailPage` 触发 re-render 时,Vue 只 patch 自己 mount 的那一组 DOM,
  **另一组永远是 plain `.app-page-stack`、`.app-page`** → 永远可见
- 检查:F12 Elements 面板数 `#phone > .app-window > .app-shell > .app-content > .app-page-stack` 的节点数

### 可能 B:`.app-page` / `.app-detail-page` CSS 层级错(z-index / position)
- `.app-page` 默认 `position: absolute; inset: 0;`
- `.app-detail-page` 默认 `opacity: 0; transform: translateX(100%)`
- `.app-detail-page[show / active]` 才 `transform: translateX(0); opacity: 1`
- 如果 `.app-detail-page` 永远停留在 translateX(100%) / opacity:0,
  那个状态的 CSS 类永远没生效
- 检查:看 `.app-detail-page` 真实 computed style(`transform` / `opacity`)

### 可能 C:`.app-page` 的 `page-hidden` CSS 根本没生效
- `:class="{ 'page-hidden': !!currentDetailPage }"` 已经 patch 上去,
  但 `.app-page.page-hidden` 选中的样式不够强 —— 比如 `opacity:0` 但 `visibility:visible`、
  或者父元素 `.app-page-stack` 没建立层叠上下文
- 检查:选中 `.app-page.page-hidden`,看 computed `display` / `visibility` / `opacity`

### 可能 D:`detailPageStack` 被 leak(没被 reset)
- 上次打开 detail 没正确关闭,`detailPageStack.value.length === 0` 不成立
- 但 `currentDetailPage` 又被某些逻辑强制清空 → `:class` 失效,但 `currentDetailView` 还渲染
- 检查:在 detail 里看 Vue Devtools 的 `detailPageStack`

### 可能 E:天气 app 的 `renderDetailPage` 返回的 HTML 意外渲染了主页内容
- 比如 `renderDetailPage` 内部错误地复用了主页的 HTML,或者 `renderPage` 被误调两次
- 检查:F12 在 `.app-detail-panel` 里看 HTML,应该是 detail 而不是主页

### 可能 F:Vue 模板里 `.app-page` 和 `.app-detail-page` 用了 `v-if` 而非 `v-show` 互相干扰
- 当前 `.app-page` 是 `v-show`,`.app-detail-page` 是 `v-if`
- 如果父级 `.app-page-stack` 有 `overflow: hidden`,两个 div 在堆叠时互不影响
- 但如果 `.app-detail-page` 的高度/定位有偏差,可能在视觉上盖不到 `.app-page`

---

## 6. 排查顺序(接下来做)

1. **确认 `#phone` 下有几份 `.app-page-stack`** —— 如果 > 1,问题在 A(本次修复)
2. **看 `.app-page.page-hidden` 的真实 computed style** —— 如果 `display: none` 生效 → B / C 都不是
3. **看 `.app-detail-page` 的 computed style** —— 是不是真的 `transform: translateX(0); opacity: 1`
4. **看 `.app-detail-panel` 里的 HTML** —— 是不是真的是 detail 主页内容

---

## 7. 当前已做的修复

- **2026-08-04**:删除 `<head>` 里重复 `<script type="module" src="/src/index.js"></script>`(A 方向)
  → 假设是 mount 两次。**用户反馈修复无效 → 说明不是 A 方向,** 继续下一步排查。
- **2026-08-04**:`.app-page-stack.detail-active > .app-page { display: none !important; }`(C 方向)
  → 用户反馈修复无效 → 说明不是简单 CSS 问题。
