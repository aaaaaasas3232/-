// ============================================
// App 注册表
// 从 apps.js 第 1219-1399 行提取
// ============================================

import { normalizeStoreConfig, SHARED_STORES } from './store-api.js';
import { createAppToolkit } from './app-toolkit.js';

export const APP_PAGE_CONTENT = {};
export const DETAIL_PAGE_CONTENT = {};

// 合法 renderMode 取值
//   - 'template' : renderPage() 返回 HTML 字符串，框架原样 v-html。
//                 现状唯一支持的模式，所有旧 App 走这个。
//   - 'hybrid'   : renderPage() 返回 HTML 字符串 + <component-island /> 标签。
//                 框架在 v-html 完成后扫描 island 并替换为真 Vue 组件。
//   - 'vue'      : renderPage() 返回 Vue 组件配置（template / data / methods ...）。
//                 框架用 Vue.createApp() 挂载，组件内部完全响应式。
const VALID_RENDER_MODES = ['template', 'hybrid', 'vue'];

function normalizeAppConfig(appConfig) {
    const stores = normalizeStoreConfig(appConfig.stores);
    const sharedStores = SHARED_STORES.filter(sharedStore => !stores.some(store => store.name === sharedStore.name));
    const declaredStores = [...stores, ...sharedStores];
    const normalizedPageContent = appConfig.pageContent || {};
    const normalizedDetailContent = appConfig.detailContent || {};
    // ★ 新增：renderMode 默认 'template'，保证旧 App 的零侵入升级
    const rawRenderMode = typeof appConfig.renderMode === 'string' ? appConfig.renderMode.trim().toLowerCase() : '';
    const normalizedRenderMode = VALID_RENDER_MODES.includes(rawRenderMode) ? rawRenderMode : 'template';
    // widgets：app 可选注册它"提供"的小组件。
    // 每个 widget 形如：
    //   { id, label, icon, iconBg, defaultSize, render(size, payload) -> html, renderDesktop(item) -> html }
    // 注意 id 全局唯一（不同 app 撞 id 会被 later 覆盖），按 appId 命名空间保险。
    const normalizedWidgets = (appConfig.widgets || []).map(widget => ({
        ...widget,
        appId: appConfig.id,
        widgetId: widget.id,
        qualifiedId: `${appConfig.id}::${widget.id}`,
    }));
    const toolkit = createAppToolkit(appConfig, declaredStores);
    const initialState = typeof appConfig.setup === 'function'
        ? (appConfig.setup({ toolkit, app: appConfig }) || {})
        : {};

    // 注意：appConfig.state 可能已经被 setup() 用 Vue.reactive 包过。
    // spread 会丢掉 reactivity，所以必须优先保留 initialState 本身的引用，
    // 只在它和现有 state 都是 plain object 时才走 spread 合并。
    const existingState = appConfig.state;
    if (existingState && typeof existingState === 'object' && !Array.isArray(existingState)) {
        const existingIsReactive = !!(existingState.__v_isReactive || existingState.__v_raw);
        const initialIsReactive = !!(initialState && (initialState.__v_isReactive || initialState.__v_raw));
        if (existingIsReactive || initialIsReactive) {
            // 至少有一边是 reactive：把它当 base，把另一边的字段按需 attach
            const base = initialIsReactive ? initialState : existingState;
            const extras = initialIsReactive ? existingState : initialState;
            if (extras && typeof extras === 'object' && Array.isArray(extras) === false) {
                for (const key of Object.keys(extras)) {
                    if (base[key] === undefined) {
                        base[key] = extras[key];
                    }
                }
            }
            appConfig.state = base;
        } else {
            appConfig.state = {
                ...existingState,
                ...initialState,
            };
        }
    } else {
        appConfig.state = initialState;
    }

    const normalizedMethods = {};
    const methodContext = {
        app: appConfig,
        toolkit,
    };
    // ★ 把 toolkit 挂到 appConfig 上，确保 this.app.toolkit.* 可用
    appConfig.toolkit = toolkit;
    for (const [methodName, method] of Object.entries(appConfig.methods || {})) {
        if (typeof method !== 'function') {
            continue;
        }
        normalizedMethods[methodName] = (...args) => method.apply(methodContext, args);
    }
    const services = createAppServices(appConfig, toolkit, normalizedMethods);
    methodContext.methods = normalizedMethods;
    methodContext.services = services;
    Object.assign(methodContext, normalizedMethods);

    return {
        ...appConfig,
        renderMode: normalizedRenderMode,
        stores: declaredStores,
        pageContent: normalizedPageContent,
        detailContent: normalizedDetailContent,
        methods: normalizedMethods,
        services,
        toolkit,
        widgets: normalizedWidgets,
    };
}

function createAppServices(appConfig, toolkit, normalizedMethods) {
    const rawServices = appConfig.services || appConfig.exports || {};
    const normalizedServices = {};
    const serviceContext = {
        app: appConfig,
        toolkit,
        methods: normalizedMethods,
    };

    for (const [serviceName, service] of Object.entries(rawServices)) {
        if (typeof service !== 'function') {
            continue;
        }
        normalizedServices[serviceName] = (...args) => service.apply(serviceContext, args);
    }

    return normalizedServices;
}

function mergeAppContent(appConfig) {
    if (typeof window !== 'undefined') {
        window.APP_PAGE_CONTENT = APP_PAGE_CONTENT;
        window.DETAIL_PAGE_CONTENT = DETAIL_PAGE_CONTENT;
    }

    if (!APP_PAGE_CONTENT[appConfig.id]) {
        APP_PAGE_CONTENT[appConfig.id] = {};
    }
    Object.assign(APP_PAGE_CONTENT[appConfig.id], appConfig.pageContent || {});

    if (appConfig.detailContent) {
        Object.assign(DETAIL_PAGE_CONTENT, appConfig.detailContent);
    }

    // 把 widgets 同步到全局注册表，让 framework 能枚举所有 app 注册的小组件
    if (Array.isArray(appConfig.widgets) && appConfig.widgets.length) {
        if (!window.APP_WIDGETS) {
            window.APP_WIDGETS = {};
        }
        for (const widget of appConfig.widgets) {
            const qualifiedId = `${appConfig.id}::${widget.id}`;
            window.APP_WIDGETS[qualifiedId] = {
                ...widget,
                appId: appConfig.id,
                widgetId: widget.id,
                qualifiedId,
                appName: appConfig.name,
                appIcon: appConfig.icon,
                appIconBg: appConfig.iconBg,
            };
        }
    }
}

// 全局 widget 注册表（按 qualifiedId 索引）。所有 app 的 widget 都被集中到 window.APP_WIDGETS。
// 注意：app-registry 在 initialize 时需要调用一次这个函数来确保 window.APP_WIDGETS 存在。
export function ensureWidgetRegistry() {
    if (!window.APP_WIDGETS) {
        window.APP_WIDGETS = {};
    }
    return window.APP_WIDGETS;
}

// 获取所有已注册的 widgets（顺序按注册时间）
export function listRegisteredWidgets() {
    const registry = ensureWidgetRegistry();
    return Object.values(registry);
}

export function createAppRegistry() {
    return {
        apps: [],
        appMap: {},
        registerApp(appConfig) {
            if (!appConfig?.id) {
                return null;
            }

            if (this.appMap[appConfig.id]) {
                return this.appMap[appConfig.id];
            }

            const normalizedApp = normalizeAppConfig(appConfig);
            mergeAppContent(normalizedApp);

            this.apps.push(normalizedApp);
            this.appMap[normalizedApp.id] = normalizedApp;
            return normalizedApp;
        },
        async registerAppAsync(appConfig) {
            if (!appConfig?.id) {
                return null;
            }

            if (this.appMap[appConfig.id]) {
                return this.appMap[appConfig.id];
            }

            const normalizedApp = normalizeAppConfig(appConfig);
            mergeAppContent(normalizedApp);

            if (window.myDb) {
                try {
                    await window.myDb.ensureSchema();
                    for (const store of normalizedApp.stores) {
                        if (window.myDb._hasOpenStore(store.name)) continue;
                        window.myDb.registerStore(store.name, store.keyPath);
                    }
                } catch (e) {
                    console.warn('[app-registry] ensureSchema 失败', e);
                }
            }

            this.apps.push(normalizedApp);
            this.appMap[normalizedApp.id] = normalizedApp;
            return normalizedApp;
        },
        getApp(appId) {
            return this.appMap[appId] || null;
        },
        invokeMethod(appId, methodName, payload) {
            const app = this.getApp(appId);
            const method = app?.methods?.[methodName];
            if (typeof method !== 'function') {
                return Promise.resolve(null);
            }
            return method(payload);
        },
        invokeService(appId, serviceName, payload) {
            const app = this.getApp(appId);
            const service = app?.services?.[serviceName];
            if (typeof service !== 'function') {
                return Promise.resolve(null);
            }
            return service(payload);
        },
        async openDeepLink(targetAppId, pageId, payload = {}) {
            if (!targetAppId) {
                return null;
            }
            const app = this.getApp(targetAppId);
            if (!app) {
                return null;
            }

            const detail = {
                action: 'openApp',
                appId: targetAppId,
                pageId,
                payload,
            };

            window.dispatchEvent(new CustomEvent('app:page-action', { detail }));
            return detail;
        },
        async shareRecord(sourceAppId, record = {}) {
            const app = this.getApp(sourceAppId);
            const sharedApi = app?.toolkit?.shared;
            if (!sharedApi) {
                return null;
            }

            const normalizedRecord = await sharedApi.put({
                sourceApp: sourceAppId,
                ...record,
            });

            window.dispatchEvent(new CustomEvent('app:record-shared', {
                detail: normalizedRecord,
            }));

            return normalizedRecord;
        },
        async listSharedRecords(targetAppId = '') {
            const sharedApi = this.apps[0]?.toolkit?.shared;
            if (!sharedApi) {
                return [];
            }
            return sharedApi.listByTarget(targetAppId);
        }
    };
}

export const externalAppRegistry = createAppRegistry();

export function registerPhoneApp(appConfig) {
    const app = externalAppRegistry.registerApp(appConfig);
    if (app) {
        window.refreshPhoneApps?.();
        // 通知桌面组件，widget pool 可能扩展了
        window.refreshPhoneWidgets?.();
    }
    return app;
}

// ★ 异步版本：会在 store 升级到 IndexedDB 之后才 resolve。
// 业务代码对「添加后立刻要从 db 读回来」要求严格时用这个。
export async function registerPhoneAppAsync(appConfig) {
    const app = await externalAppRegistry.registerAppAsync(appConfig);
    if (app) {
        window.refreshPhoneApps?.();
        window.refreshPhoneWidgets?.();
    }
    return app;
}

export async function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-app-src="${src}"]`);
        if (existing) {
            resolve(existing);
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.defer = true;
        script.dataset.appSrc = src;
        script.onload = () => resolve(script);
        script.onerror = () => reject(new Error(`外部 App 加载失败: ${src}`));
        document.body.appendChild(script);
    });
}

export async function loadExternalApps(appFiles = []) {
    for (const file of appFiles) {
        await loadScript(file);
    }
}
