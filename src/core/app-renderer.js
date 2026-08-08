// ============================================
// App 渲染调度器（三模式分发）
//
// 每种模式走不同路径：
//   - 'template' : renderPage() 返回字符串 → 原样 v-html（保留旧行为，零侵入）
//   - 'hybrid'   : renderPage() 返回字符串 + <component-island /> 标签
//                  → 先 v-html，再扫描 island 替换为真 Vue 组件
//   - 'vue'      : renderPage() 返回 Vue 组件配置
//                  → Vue.createApp() 整块挂载，整个 App 是活的
//
// 核心 API：
//   mountInto(rootEl, app, content, page)
//   unmountFrom(rootEl)
//   notifyChange(rootEl, app)         // app.state 变了，通知 island 重画（hybrid 兜底）
//
// App 自己只需要在 rootEl 上调用 mount / unmount；framework 自动按 renderMode 分发。
// ============================================

import { createAppRegistryExtras } from './app-renderer-registry.js';

const REGISTRY = createAppRegistryExtras();

/**
 * 注册一个 component-island 组件。
 *
 * @param {string} name          island 标签的 name 属性值（例: 'toggle'）
 * @param {object} component     Vue 组件配置（{ template, data, methods, ... }）
 * @param {object} [defaults]    默认 props
 */
export function registerIslandComponent(name, component, defaults = {}) {
    REGISTRY.islands[name] = { component, defaults };
}

/**
 * 列出所有已注册的 island 组件（调试用）
 */
export function listIslandComponents() {
    return Object.keys(REGISTRY.islands);
}

/**
 * 把渲染产物（字符串 or Vue 组件）挂到 rootEl。
 *
 * 关键设计：
 *   - mount 前会调用 unmountFrom() 清理上一个 app 的 vue instance（避免泄漏）
 *   - template 模式：什么都不用做，只把字符串塞 rootEl.innerHTML
 *   - hybrid 模式：v-html 完，nextTick 扫描 component-island 替换
 *   - vue 模式：直接 Vue.createApp() 挂载，renderPage 返回的就是组件
 */
export async function mountInto(rootEl, app, content, page, detailOrPageKey) {
    if (!rootEl) {
        return;
    }
    // 关键：挂新 app 之前清掉旧的 Vue 实例 / island 标记
    unmountFrom(rootEl);

    const mode = app?.renderMode || 'template';
    const renderer = detailOrPageKey === 'detail'
        ? (app?.renderDetailPage || app?.renderPage)
        : (app?.renderPage || app?.renderDetailPage);

    if (!renderer) {
        rootEl.innerHTML = '';
        return;
    }

    // 防御：framework 调用路径上 page 可能是 undefined（activeRootPageId 初值 '' 时），
    // 给个空 page 占位，避免 renderPage 里访问 page.id 崩溃
    const safePage = page || { id: detailOrPageKey || 'unknown' };
    const safeApp = app || { id: 'unknown', renderMode: mode };

    let result;
    try {
        result = await renderer(content, safePage, safeApp);
    } catch (err) {
        console.error(`[app-renderer] ${app?.id}::${detailOrPageKey} 渲染失败`, err);
        rootEl.innerHTML = `<div class="app-render-error">渲染失败：${escapeInline(err?.message || String(err))}</div>`;
        return;
    }

    if (mode === 'vue') {
        // 整块 Vue 组件
        const compResult = typeof result === 'object' ? result : null;
        mountVueMode(rootEl, compResult, app, detailOrPageKey);
        return;
    }

    // template / hybrid 都要先 v-html 字符串
    if (typeof result !== 'string') {
        result = String(result ?? '');
    }
    rootEl.innerHTML = result;

    if (mode === 'hybrid') {
        // 等 v-html 渲染完
        if (typeof Vue !== 'undefined' && Vue.nextTick) {
            await Vue.nextTick();
        } else {
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        mountHybridIslands(rootEl, app);
    }
}

/**
 * 清掉 rootEl 上挂载的 vue instance（如果有）。
 * 同时删掉 hybrid 模式下扫描时打的标记属性。
 */
export function unmountFrom(rootEl) {
    if (!rootEl) return;
    if (rootEl.__vueApp && typeof rootEl.__vueApp.unmount === 'function') {
        try {
            rootEl.__vueApp.unmount();
        } catch (err) {
            // 不抛错，UI 不能因为卸载失败就崩
        }
        rootEl.__vueApp = null;
    }
    // 清掉 hybrid island 标记（不删 DOM，因为 outerHTML 重写时整段会被替换）
    rootEl.querySelectorAll('[data-island-mounted]').forEach(el => {
        el.removeAttribute('data-island-mounted');
    });
}

/**
 * hybrid 模式：扫描 rootEl 下的所有 <component-island /> 标签，
 * 把它们替换成真 Vue 组件挂载点。
 *
 * island 标签写法：
 *   <component-island name="toggle" value="true"></component-island>
 *
 * 支持的属性：
 *   - name     必填，组件名（在 registerIslandComponent 里注册的）
 *   - value    当前值（boolean / number / string）
 *   - label    显示文本
 *   - :value   同 value（带 : 表示用 parseAttr 处理 JSON-like）
 *   - 其它自定义属性会被作为 data-* 透传给组件
 */
function mountHybridIslands(rootEl, app) {
    if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return;
    const islands = rootEl.querySelectorAll('component-island');
    if (!islands.length) return;

    islands.forEach(islandEl => {
        const name = islandEl.getAttribute('name') || '';
        const entry = REGISTRY.islands[name];
        if (!entry) {
            console.warn(`[app-renderer] 未注册的 island 组件: ${name}`);
            islandEl.outerHTML = `<div class="island-missing">未知组件: ${escapeInline(name)}</div>`;
            return;
        }

        // 解析 props
        const props = {};
        for (const attr of islandEl.attributes) {
            const attrName = attr.name;
            if (attrName === 'name') continue;
            // 兼容 :value 这种带前缀的写法
            const propName = attrName.startsWith(':') ? attrName.slice(1) : attrName;
            props[propName] = parseAttrValue(attr.value);
        }
        // 默认值兜底
        for (const [k, v] of Object.entries(entry.defaults || {})) {
            if (props[k] === undefined) props[k] = v;
        }

        // 透传 app 引用，组件里 this.$root.__app 拿不到，但可以用 @change 回调
        // 我们这里把 app 和 instanceKey 塞进 props（约定 __app 是非 props attribute）
        const __app = app;
        const __island = {
            name,
            update(nextProps) {
                // 给 app 的 methods 一个更新本 island 的口子
                // 例：this.toolkit.actions.method('updateIsland', { qualifiedId, props })
                Object.assign(props, nextProps);
            },
        };
        // 通过 props.__islandMeta 暴露（业务组件如果需要能拿到）
        props.__app = __app;
        props.__islandMeta = __island;

        // 把 <component-island> 替换成 <div class="island-mount" data-island-name="..." />
        const mountPoint = document.createElement('div');
        mountPoint.className = `island-mount island-mount--${name}`;
        mountPoint.setAttribute('data-island-name', name);
        mountPoint.setAttribute('data-island-mounted', '1');
        islandEl.replaceWith(mountPoint);

        // 包装组件配置：给原始 setup 注入 bridged emit，把所有事件转发到 app.onIslandChange
        const origSetup = entry.component.setup;
        const origEmit = entry.component.emits;
        const wrappedComponent = {
            name: entry.component.name || `Island_${name}`,
            props: entry.component.props || {},
            emits: origEmit,
            setup(compProps, compCtx) {
                const bridgedEmit = (event, ...args) => {
                    compCtx.emit(event, ...args);
                    const suffix = event.startsWith('update:')
                        ? 'Change'
                        : (event === 'change' ? 'Change' : capitalize(event));
                    const methodName = `on${capitalize(name)}${suffix}`;
                    if (typeof compProps.__app?.methods?.onIslandChange === 'function') {
                        compProps.__app.methods.onIslandChange(methodName, args[0]);
                    }
                };
                const bridgedCtx = { ...compCtx, emit: bridgedEmit };
                if (typeof origSetup === 'function') {
                    return origSetup(compProps, bridgedCtx);
                }
                return {};
            },
            render: entry.component.render,
            template: entry.component.template,
            data: entry.component.data,
            methods: entry.component.methods,
            computed: entry.component.computed,
            watch: entry.component.watch,
            mounted: entry.component.mounted,
            beforeUnmount: entry.component.beforeUnmount,
        };

        try {
            const subApp = Vue.createApp(wrappedComponent, props);
            subApp.config.errorHandler = (err) => {
                console.error(`[island ${name}] 渲染错误:`, err);
            };
            subApp.mount(mountPoint);
            mountPoint.__vueApp = subApp;
            mountPoint.__islandMeta = __island;
        } catch (err) {
            console.error(`[app-renderer] island ${name} 挂载失败`, err);
            mountPoint.innerHTML = `<div class="island-error">组件挂载失败</div>`;
        }
    });
}

/**
 * vue 模式：把整块 rootEl 给 Vue.createApp() 管理。
 *
 * renderPage 返回两种合法形式：
 *   1. { template, data, methods, ... }          标准 Vue 组件配置
 *   2. 已经 setup() 过的渲染函数（返回 VNode）     高级用法
 */
function mountVueMode(rootEl, result, app, detailOrPageKey) {
    if (!result || typeof result !== 'object') {
        rootEl.innerHTML = `<div class="app-render-error">vue 模式：renderPage 必须返回组件配置</div>`;
        return;
    }

    try {
        const propsConfig = result.props || {};
        const userMounted = result.mounted;
        const userBeforeUnmount = result.beforeUnmount;

        const component = {
            ...result,
            props: propsConfig,
        };
        if (userMounted || userBeforeUnmount) {
            component.mounted = function () {
                if (typeof userMounted === 'function') {
                    try { userMounted.call(this); } catch (e) { console.error('[vue-mode mounted 用户钩子失败]', e); }
                }
            };
            component.beforeUnmount = function () {
                if (typeof userBeforeUnmount === 'function') {
                    try { userBeforeUnmount.call(this); } catch (e) { console.error('[vue-mode beforeUnmount 用户钩子失败]', e); }
                }
            };
        }
        const subApp = Vue.createApp(component, { app, page: detailOrPageKey, __app: app });
        subApp.config.errorHandler = (err) => {
            console.error(`[vue-mode ${app.id}] 渲染错误:`, err);
        };
        subApp.mount(rootEl);
        rootEl.__vueApp = subApp;
    } catch (err) {
        console.error(`[app-renderer] vue 模式挂载失败 (${app.id})`, err);
        rootEl.innerHTML = `<div class="app-render-error">vue 模式挂载失败：${escapeInline(err?.message || String(err))}</div>`;
    }
}

/**
 * 把字符串化的属性值还原成 js 值。
 *   - "true" / "false" → boolean
 *   - 数字 → number
 *   - 'null' / 'undefined' / 'NaN' → 对应特殊值
 *   - 其它 → 原样字符串
 */
function parseAttrValue(raw) {
    if (raw == null) return raw;
    const v = String(raw).trim();
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v === 'null') return null;
    if (v === 'undefined') return undefined;
    if (v === 'NaN') return NaN;
    if (v === '') return '';
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (/^-?\.\d+$/.test(v)) return Number(v);
    return raw;
}

function escapeInline(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// 暴露 registry 给 framework（用于调试 + 在 framework 里统一注册内置组件）
export function getInternalRegistry() {
    return REGISTRY;
}