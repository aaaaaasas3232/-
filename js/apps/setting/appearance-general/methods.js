/**
 * 设置 App · 外观与通用 · 业务方法
 *
 * 把「外观」detail 页用到的所有 methods 集中在这里：
 *   - updateAppearanceField({field, value})：改一个字段，立刻应用主题 + 刷新
 *   - toggleCaseHidden()：隐藏 / 显示手机壳（开关行）
 *   - toggleStatusBar()：状态栏整体开关（实现已抽到 phone-statusbar 模块，便于维护）
 *   - saveAppearance()：把 state.ui.appearance 写到 IndexedDB，标记 savedAt
 *   - resetAppearance()：恢复成默认外观
 *
 * this 上下文由 app-registry 注入 { app, toolkit, methods, services, ... }。
 */

import {
    applyDeviceTheme,
    getDefaultDeviceTheme,
    PHONE_HEIGHT_MIN,
    PHONE_HEIGHT_MAX,
    PHONE_Y_OFFSET_MIN,
    PHONE_Y_OFFSET_MAX,
    clampDesktopGridRows,
} from './theme-bridge.js';
import { APPEARANCE_DB_KEY, APPEARANCE_STORE_NAME, initialAppearance } from './defaults.js';
import { buildStatusBarMethods } from './phone-statusbar/index.js';

function notify(toolkit, kind, title, message) {
    toolkit.island.notify(kind, title, message);
}

function refresh() {
    window.refreshPhoneApps?.();
    // 强制让 Vue 重新评估 activeApp / currentDetailView 这一条 computed 链，
    // 这样 toggling hideCase / showStatusBar 后 switch 的 `is-on` 类才会刷新。
    // 见 js/framework/core-shim.js: window.__phoneAppsRef 的赋值。
    const appsRef = typeof window !== 'undefined' ? window.__phoneAppsRef : null;
    if (appsRef && Array.isArray(appsRef.value)) {
        appsRef.value = [...appsRef.value];
    }
    // 给 framework 的 detailRenderTick 也递增一次 ——
    // apps.value 重赋值对 activeApp 来说引用还是同一个对象（find 同引用），
    // 所以 currentDetailView 的 reactive 依赖不会触发；用 tick 强制它重跑 renderDetailPage。
    // 见 js/framework/use-app-navigation.js。
    const tickRef = typeof window !== 'undefined' ? window.__detailRenderTick : null;
    if (tickRef && typeof tickRef.value === 'number') {
        tickRef.value = tickRef.value + 1;
    }
}

/**
 * 通用：把当前 app.state.ui.appearance 写入 IndexedDB（deviceSettings::device-theme）。
 * 任何字段变更都自动触发，不再依赖用户手动按"保存"按钮。
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
        console.warn('[settings] 外观自动保存失败', err);
    });
}

export function buildAppearanceMethods() {
    return {
        updateAppearanceField(payload = {}) {
            const { field, value } = payload;
            const ui = this.app.state.ui.appearance;
            if (!field) return;
            if (field === 'batteryCapacity') {
                // ★ 电量绑定给氧气（blog）期间，氧气是电量唯一写入方：
                //   滑条 UI 本来就被隐藏了，这里再拦一道防「整组粘贴 / 旧引用」写进来。
                if (ui.batteryBoundByOxygen === true) {
                    notify(this.toolkit, 'info', '电量已交给氧气', '想手动调节先去氧气里解除绑定');
                    return;
                }
                // 滑条传的是 0-100，需要转成 0-1 存储
                const pctValue = Number(value) || 0;
                ui.batteryCapacity = Math.max(0, Math.min(1, pctValue / 100));
            } else if (field === 'hideCase') {
                ui.hideCase = Boolean(value);
            } else if (field === 'phoneHeight') {
                // 滑条传的是 px 整数（450-720），clamp 一下防越界
                const px = Number(value);
                if (Number.isFinite(px)) {
                    ui.phoneHeight = Math.max(
                        PHONE_HEIGHT_MIN,
                        Math.min(PHONE_HEIGHT_MAX, Math.round(px))
                    );
                }
            } else if (field === 'phoneYOffset') {
                // 滑条传的是 px 整数（-100 ~ +100），负数上移、正数下移
                const px = Number(value);
                if (Number.isFinite(px)) {
                    ui.phoneYOffset = Math.max(
                        PHONE_Y_OFFSET_MIN,
                        Math.min(PHONE_Y_OFFSET_MAX, Math.round(px))
                    );
                }
            } else if (field === 'desktopGridRows') {
                // 桌面网格行数：3 ~ 8，clamp
                ui.desktopGridRows = clampDesktopGridRows(value);
            } else if (field === 'showStatusBar') {
                // 状态栏整体布尔字段：缺省 = true（即显示）；只有显式 false 才隐藏
                ui.showStatusBar = value !== false;
            } else if (
                field === 'caseColor'
                || field === 'batteryColor'
                || field === 'statusBarTimeColor'
                || field === 'statusBarFiveGColor'
            ) {
                // 颜色字段：接受 hex / rgb / linear-gradient / 等任意 CSS 颜色 / 渐变
                ui[field] = String(value ?? '');
            } else if (field === 'statusBarFiveGLabel') {
                // 5G 文本替换：用户输入的字符串（可含 emoji / 文字 / 数字），允许空白 → 不持久化空字符串
                const next = String(value ?? '').trim();
                ui.statusBarFiveGLabel = next || '5G';
                // 输入期间只更新状态栏的 reactive 配置，不刷新详情页。
                // 否则 v-html 会替换 input 节点，导致焦点和输入法组合状态在每个字符后丢失。
                applyDeviceTheme(ui);
                persistAppearance(this.app);
                return;
            } else {
                ui[field] = value;
            }
            applyDeviceTheme(ui);
            refresh();
            persistAppearance(this.app);
        },

        toggleCaseHidden() {
            const ui = this.app.state.ui.appearance;
            ui.hideCase = !ui.hideCase;
            applyDeviceTheme(ui);
            refresh();
            notify(
                this.toolkit,
                ui.hideCase ? 'success' : 'info',
                ui.hideCase ? '已隐藏手机壳' : '已显示手机壳',
                ui.hideCase ? '网页将铺满到屏幕宽度' : '已恢复 iPhone 外壳'
            );
            persistAppearance(this.app);
        },

        // 状态栏相关的 4 个 toggle 方法委托给 phone-statusbar 模块
        ...buildStatusBarMethods(),

        async saveAppearance() {
            const ui = { ...this.app.state.ui.appearance };
            try {
                await this.toolkit.db.put(APPEARANCE_STORE_NAME, {
                    key: APPEARANCE_DB_KEY,
                    ...ui,
                    updatedAt: Date.now(),
                });
                this.app.state.savedAt.appearance = Date.now();
                applyDeviceTheme(ui);
                refresh();
                notify(this.toolkit, 'success', '外观已保存', '实时生效已应用');
            } catch (err) {
                console.error('[settings/appearance] saveAppearance 失败', err);
                notify(this.toolkit, 'error', '保存失败', '请稍后再试');
            }
        },

        async resetAppearance() {
            const base = initialAppearance();
            // 兼容：保留 getDefaultDeviceTheme 的字段
            const merged = { ...getDefaultDeviceTheme(), ...base };
            this.app.state.ui.appearance = merged;
            applyDeviceTheme(merged);
            try {
                await this.toolkit.db.put(APPEARANCE_STORE_NAME, {
                    key: APPEARANCE_DB_KEY,
                    ...merged,
                    updatedAt: Date.now(),
                });
            } catch (err) {
                console.warn('[settings/appearance] resetAppearance 持久化失败', err);
            }
            refresh();
            notify(this.toolkit, 'success', '已恢复默认外观', '');
        },
    };
}