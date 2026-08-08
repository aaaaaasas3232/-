# renderer cache 命中导致 button 无反应 Bug

> 写于 2026-08-03 修复 settings app「编辑」按钮、persona 周历点击无反应后。
> 关联档案：`待办/detailRenderTick双ref重复声明Bug.md`（tick 链路本身是好的，**但 cache 把 tick 绕过了**）。

---

## 现象

设置 app 里以下按钮点击后**视图无变化**：

- 「编辑」按钮（`<button class="persona-tab" data-app-action="...userRoute...{sub:'edit'}">`）
- 人设主页周历的某一天（`<div class="phome-week__day is-today has-events" data-app-action="...personaScheduleToggleOpen...">`）
- 其他所有用 `xxxRoute({sub:'...'})` / `xxxToggleOpen({...})` 切换 detail 子视图的业务按钮

控制台无报错。DevTools 看 `app.state.user.sub` 已经从 `'list'` 变成 `'edit'`，但 `currentDetailView` 的 v-html 输出还是旧的 list 视图。

**关键信号**：切到别的 app 再切回来，视图就对了 —— 说明 state 改对了，**renderer 没被重新调用**。

---

## 根因（renderer cache 命中短路）

`use-app-navigation.js` 的 `resolveAsyncRenderer` 用 `WeakMap<renderer, Map<key, html>>` 缓存 HTML：

```12:46:js/framework/use-app-navigation.js
function resolveAsyncRenderer(renderer, content, page, app, detailRenderTick) {
    if (typeof renderer !== 'function') return '';

    const cacheKey = `${app?.id || ''}::${page?.id || ''}`;
    let cache = _resolvedCache.get(renderer);
    if (!cache) {
        cache = new Map();
        _resolvedCache.set(renderer, cache);
    }

    // 已经 resolved 过 → 同步返回缓存值
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey) || '';
    }
    // ...
}
```

业务方法（如 `userRoute` / `personaScheduleToggleOpen`）的固定 pattern：

```5:17:js/apps/setting/user/methods.js
function refresh() {
    window.refreshPhoneApps?.();
    const appsRef = typeof window !== 'undefined' ? window.__phoneAppsRef : null;
    if (appsRef && Array.isArray(appsRef.value)) {
        appsRef.value = [...appsRef.value];
    }
    const tickRef = typeof window !== 'undefined' ? window.__detailRenderTick : null;
    if (tickRef && typeof tickRef.value === 'number') {
        tickRef.value = tickRef.value + 1;
    }
}

userRoute(payload = {}) {
    const route = this.app.state.user || (this.app.state.user = {});
    route.sub = payload.sub || 'list';
    route.id = payload.id || null;
    refresh();
},
```

`refresh()` 把 `__detailRenderTick.value++`，**期望**链路：

```
state 改 → refresh() → tick++ → currentDetailView（computed）重算 →
→ resolveAsyncRenderer(...) → 调 renderer 重新拼 HTML → v-html 替换
```

但 `resolveAsyncRenderer` 第 44 行 `if (cache.has(cacheKey)) return cache.get(...)` **直接返回缓存值**，renderer 根本不被调用。**Vue computed 被 invalidate 了，但渲染管线拿到的是缓存的旧 HTML**，所以 view 看起来毫无反应。

**为什么「切出再切回」能生效**：`activeAppId.value` 变化触发 `currentDetailView` 重算的同时，`page.id` 不变但 cache key 还是相同 —— 嗯不对，重新看了一下，切出切回时 `currentDetailPage` 也可能跟着栈变化导致 `cacheKey` 不一样 / 或者 activeApp 重新触发 reactive 链……

> ⚠️ 这一段机制描述里我有点拿不准「切出再切回」到底是 cache miss 还是别的原因。**用户报告的现象是「切出切回能生效」，但 cache key 是 `appId::pageId`，理论上同样的 detail 切出去切回来 cacheKey 不变**。
>
> 更可能的原因是切出切回时 `currentDetailPage` 也变了（detail 栈被 reset），所以 cacheKey 自然变了 cache miss，renderer 被重调。或者切到别的 app 时 `activeAppId` 变化触发整个 `useAppNavigation` 重新跑一遍，cache 被新生成。不管哪种，**「切出切回能生效」都掩盖了真正的 cache 命中 bug**。

---

## 修复

`js/framework/use-app-navigation.js`：cache value 从 string 改成 `{ tick, html }`，cache 命中条件加上 `cached.tick === currentTick`。

```31:98:js/framework/use-app-navigation.js
/**
 * ★ cache 失效策略：cacheValue 是 { tick, html }，只有当 tick 不变时才算命中。
 *   tick++（window.__detailRenderTick.value++）是业务方主动通知「我改了 state，给我重渲」的信号。
 */
const _resolvedCache = new WeakMap(); // renderer -> Map<key, { tick, html }>

function resolveAsyncRenderer(renderer, content, page, app, detailRenderTick) {
    if (typeof renderer !== 'function') return '';

    const cacheKey = `${app?.id || ''}::${page?.id || ''}`;
    const currentTick = detailRenderTick && typeof detailRenderTick.value === 'number'
        ? detailRenderTick.value
        : 0;
    let cache = _resolvedCache.get(renderer);
    if (!cache) {
        cache = new Map();
        _resolvedCache.set(renderer, cache);
    }

    const cached = cache.get(cacheKey);
    if (cached && cached.tick === currentTick) {
        return cached.html || '';
    }

    let result;
    try {
        result = renderer(content, page, app);
    } catch (e) {
        console.error('[framework] renderer 抛错:', e);
        const html = `<div style="padding:16px;color:#DC2626;">渲染失败：${String(e?.message || e)}</div>`;
        cache.set(cacheKey, { tick: currentTick, html });
        return html;
    }

    if (result && typeof result.then === 'function') {
        const loadingHtml = '<div class="app-render-loading" ...>加载中…</div>';
        cache.set(cacheKey, { tick: currentTick, html: loadingHtml });

        result.then((html) => {
            const finalTick = detailRenderTick?.value ?? currentTick;
            cache.set(cacheKey, { tick: finalTick, html: typeof html === 'string' ? html : '' });
            if (detailRenderTick) detailRenderTick.value += 1;
        }).catch((e) => {
            // ...
        });
        return loadingHtml;
    }

    const str = result || '';
    cache.set(cacheKey, { tick: currentTick, html: str });
    return str;
}
```

---

## 修复后行为

| 触发 | tick 变化 | cache 命中？ | 结果 |
|---|---|---|---|
| 首次打开 detail 页 | 0 → 0 | miss | 调 renderer，缓存 `{tick:0, html}` |
| 业务方法改 state + refresh() | 0 → 1 | miss（cached.tick=0, currentTick=1）| 调 renderer，缓存 `{tick:1, html}` ✅ |
| 同一 detail 页**没有**改 state | 0 → 0 | hit | 直接返回缓存（性能优化仍在） ✅ |
| 切到别的 detail page | key 变 | miss | 调 renderer ✅ |
| 切出再切回同一 detail | 取决于 useAppNavigation 是否重新跑 | 视情况 | 仍然正常 ✅ |

---

## 教训 / 给 AI 编程助手的注意事项

- **「状态改了 + tick++ 了但 view 不更新」时，多半是渲染管线某层有缓存短路了**。这次是 `resolveAsyncRenderer` 的 cache，下次可能是别处。诊断顺序：
  1. 确认 state 真的改了（DevTools / `console.log`）
  2. 确认 `__detailRenderTick.value` 真的递增了
  3. 确认 `currentDetailView` 这个 computed 被 invalidate（加 `console.log` 进 computed 函数看是否被重新调）
  4. 如果 computed 重跑了但 v-html 不变 —— **renderer 拿到的是缓存值**，问题在 cache
- **cache key 不要只靠「业务身份」**（appId + pageId），还要带上「版本信号」（tick / 时间戳 / hash）。否则业务方任何「mutation 但不换 page」的状态变化都会被 cache 吞掉
- **业务方调 `refresh()` 时的「副作用」要可观测**：当前 settings app 的 refresh 同时改 `appsRef.value` + 改 `__detailRenderTick`，链路依赖隐式的 Vue 反应式系统，下次重构很容易把这条链路弄断。考虑把 `refresh()` 收口成一个 framework 工具函数（如 `forceRerender(appId, pageId)`），内部统一处理 cache + tick + appsRef
- **chat-app 的 `_forceRerender()` 之前因为 page id 拼错（`messages` vs `chat`）清不到 cache**，这个 bug 现在也**自动消失**了 —— 因为 tick 失效后不再依赖显式 `invalidateRendererCache`。但显式 `invalidateRendererCache` API 仍然保留，作为「快速主动清空」的兜底
- **不要轻易给 cache 加新的失效条件而不更新 key 格式**。要么彻底删除 cache（牺牲性能换正确性），要么把版本号纳入 key 格式（像这次一样）
