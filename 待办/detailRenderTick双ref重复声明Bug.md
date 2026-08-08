# detailRenderTick 双 ref 重复声明 Bug

## 现象

设置 app（以及人设、AI、世界等所有 `xxxRoute({ sub: 'edit' })` 类业务方法）切换子页 / 修改 state 后，**当前 detail 页不会立即重渲**，必须「切到别的 app 再切回来」或者「关闭再打开 detail」才能看到变化。

App 端写了「强制重渲」逻辑（自增 `window.__detailRenderTick.value` + 把 `window.__phoneAppsRef.value = [...apps.value]`），但**不生效**。

## 根因（双 ref 重复声明）

`core-shim.js` 里**自己**声明了一个 `detailRenderTick` ref：

```js
// core-shim.js  line 158（已删除）
const detailRenderTick = Vue.ref(0);
window.__detailRenderTick = detailRenderTick;
```

而 `useAppNavigation.js` 里**也**声明了一个同名的 `detailRenderTick` ref：

```js
// use-app-navigation.js line 29
const detailRenderTick = Vue.ref(0);
window.__detailRenderTick = detailRenderTick;
```

**关键：`currentDetailView` 这个 computed（line 95）依赖的是 `useAppNavigation` 内部那个 ref**——因为它在自己闭包内读 `detailRenderTick.value`。

**而 `core-shim.js` 的 `syncRegisteredApps` 函数（line 235）自增的是 core-shim 自己的那个 ref**——因为同名局部变量遮蔽了外层引用。

而 `window.__detailRenderTick` 经过多次赋值（`useAppNavigation` 内部赋一次 → `core-shim.syncRegisteredApps` 末尾赋一次），最终指向 core-shim 自己的 ref（被 `syncRegisteredApps` 末尾的赋值覆盖了）。

App 端调用 `window.__detailRenderTick.value++` 增加的是 **core-shim 的 ref**，而 `currentDetailView` 依赖的是 **useAppNavigation 的 ref**——**两个 ref 不是同一个对象**。所以 `currentDetailView` 永远收不到通知。

**为什么「切出再切回」能生效**：`activeAppId.value` 或 `currentDetailPage.value` 变化时，`currentDetailView` 被强制重算（computed 的依赖之一变了），不靠 tick 也能重新读 state。

## 修复

1. **`use-app-navigation.js`**：在 return 里加上 `detailRenderTick`，把内部的 ref 通过返回值暴露出去
2. **`core-shim.js`**：
   - 删掉自己声明的 `detailRenderTick` ref（line 158-161 旧版）
   - 把 `useAppNavigation` 的调用提前到 `syncRegisteredApps` 之前
   - `syncRegisteredApps` 里用 `navigation.detailRenderTick.value++`（统一引用）
   - `appConfig` bridge 里 line 498 也从 `detailRenderTick` 改成 `detailRenderTick: navigation.detailRenderTick`

**修复后只有一份 `detailRenderTick` ref**——app 端 `__detailRenderTick.value++` 通知的就是 `currentDetailView` 真正依赖的那个，detail 页切换立刻重渲。

## 教训 / 给 AI 编程助手的注意事项

- **全局 ref 只有一个**：用 `window.__xxx` 暴露 ref 时，确保整个项目里只有一处 `Vue.ref(0)`，别在多个文件各自声明同名 ref
- **Vue computed 的依赖追踪靠闭包**：computed 函数内读的是自己作用域里的 ref 变量名，不是 ref 引用本身。同名变量遮蔽 = 依赖丢失
- **诊断信号**：如果 `_tick.value++` 看起来跑了但 computed 不重算，多半就是「tick 的 ref 跟 computed 依赖的不是同一个 ref」
- **优先通过 return 暴露而不是全局**：本来应该让 `useAppNavigation` 把 `detailRenderTick` 通过 return 暴露给 setup 调用方，调用方需要时从 return 取。`window.__xxx` 是最后手段，且需要中央登记避免重复声明
