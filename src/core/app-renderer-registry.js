// ============================================
// App 渲染调度器内部注册表
//
// 把 island 组件的注册表 + 模式常量集中在一个文件，
// 避免 app-renderer.js 太胖。
// ============================================

export function createAppRegistryExtras() {
    return {
        // 组件岛注册表: { name: { component, defaults } }
        islands: {},
        // 当前 mounted 的 rootEl → Vue app（用于排查）
        mountedApps: new WeakMap(),
    };
}

export const RENDER_MODES = Object.freeze({
    TEMPLATE: 'template',
    HYBRID: 'hybrid',
    VUE: 'vue',
});

export const DEFAULT_RENDER_MODE = RENDER_MODES.TEMPLATE;