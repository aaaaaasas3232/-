/**
 * 状态栏模块 · 业务方法
 *
 * 提供 settings app 在 detail 页里能调用的 1 个 toggle 方法：
 *   - toggleStatusBar()
 *
 * 注意：之前还有 toggleStatusBarTime / Signal / FiveG 用于单独控制时间 / 信号 / 5G 显隐，
 *       现已删除 —— 状态栏元素整体显示/隐藏由 `showStatusBar` 一个开关决定。
 *
 * 调用上下文（由 framework 注入）：
 *   {
 *     app: App 实例,
 *     toolkit: App toolkit,
 *     methods: 所有 methods 的合并对象,
 *     services: ...,
 *     ...所有其它 method
 *   }
 *
 * 注意：本文件是「统一外观 methods」的一部分，但状态栏相关的 toggle
 *       集中在这里方便后续把状态栏 UI / 状态 / 业务打包成独立模块。
 */

import { applyDeviceTheme } from '../theme-bridge.js';
import {
    APPEARANCE_STORE_NAME,
    APPEARANCE_DB_KEY,
} from '../defaults.js';

/**
 * 通用：把当前 app.state.ui.appearance 写入 IndexedDB（deviceSettings::device-theme）。
 */
function persistAppearance(app) {
    if (!app || !app.state || !app.state.ui || !app.state.ui.appearance) return;
    const ui = { ...app.state.ui.appearance };
    const db = app.toolkit && app.toolkit.db;
    if (!db || !db.put) return;
    db.put(APPEARANCE_STORE_NAME, {
        key: APPEARANCE_DB_KEY,
        ...ui,
        updatedAt: Date.now(),
    }).catch((err) => {
        console.warn('[settings] 状态栏外观自动保存失败', err);
    });
}

/**
 * 通知 framework「app 内部 state 已变化，需要重跑 computed」。
 * 见 theme-bridge.js / methods.js 的 refresh()。
 */
function refreshPhoneSystem() {
    window.refreshPhoneApps?.();
    // 强制让 Vue 重新评估 currentDetailView 等 reactive 链，
    // 这样 toggling 后 switch 的 `is-on` 类才会刷新。
    const appsRef = typeof window !== 'undefined' ? window.__phoneAppsRef : null;
    if (appsRef && Array.isArray(appsRef.value)) {
        appsRef.value = [...appsRef.value];
    }
    const tickRef = typeof window !== 'undefined' ? window.__detailRenderTick : null;
    if (tickRef && typeof tickRef.value === 'number') {
        tickRef.value = tickRef.value + 1;
    }
}

/**
 * 构造状态栏专属 methods（被 settings/appearance-general/methods.js merge 进去）。
 */
export function buildStatusBarMethods() {
    return {
        /**
         * 显隐切换（保留：旧 switch 风格 / 其他代码可能仍引用）。
         */
        toggleStatusBar() {
            const ui = this.app.state.ui.appearance;
            ui.showStatusBar = !ui.showStatusBar;
            applyDeviceTheme(ui);
            refreshPhoneSystem();
            persistAppearance(this.app);
        },

        /**
         * 设置状态栏显隐（与 segmented tabs 一一对应）。
         * 接受 {value: boolean} 或裸 boolean。
         * 若目标值与当前值相同则 no-op，避免不必要的 refresh。
         */
        setStatusBarVisibility(payload) {
            const next = (payload && typeof payload === 'object')
                ? Boolean(payload.value)
                : Boolean(payload);
            const ui = this.app.state.ui.appearance;
            if (ui.showStatusBar === next) return;
            ui.showStatusBar = next;
            applyDeviceTheme(ui);
            refreshPhoneSystem();
            persistAppearance(this.app);
        },
    };
}