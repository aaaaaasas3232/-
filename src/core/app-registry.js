// ============================================
// App 注册表
// 从 apps.js 第 1219-1399 行提取
// ============================================

import { normalizeStoreConfig, SHARED_STORES } from './store-api.js';
import { createAppToolkit } from './app-toolkit.js';

export const APP_PAGE_CONTENT = {};
export const DETAIL_PAGE_CONTENT = {};

function normalizeAppConfig(appConfig) {
    const stores = normalizeStoreConfig(appConfig.stores);
    const sharedStores = SHARED_STORES.filter(sharedStore => !stores.some(store => store.name === sharedStore.name));
    const declaredStores = [...stores, ...sharedStores];
    const normalizedPageContent = appConfig.pageContent || {};
    const normalizedDetailContent = appConfig.detailContent || {};
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

    appConfig.state = {
        ...(appConfig.state || {}),
        ...initialState,
    };

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

            if (window.myDb) {
                normalizedApp.stores.forEach(store => {
                    window.myDb.registerStore(store.name, store.keyPath);
                });
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
