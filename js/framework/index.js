/**
 * 小听 - 框架入口（ESM 版）
 *
 * 这个文件仅做 re-export，让 src/index.js 可以一次性 import 所有 framework 模块。
 * 加载顺序由 ESM 的 import 图自动决定：utils 最先被依赖，其余按调用关系自然排好。
 */

export {
    UI_CONSTANTS,
    ISLAND_CLOSE_REASONS,
    ISLAND_RESTORE_DELAY_MS,
    getTime,
    createEmptyIslandContent,
    createModalState,
    createPressState,
    resetPressState,
    createIndicatorGestureState,
    createCardDragState,
} from './utils.js';

export { useSystemClock } from './use-system-clock.js';
export { useDynamicIsland, exposeDynamicIsland } from './use-dynamic-island.js';
export { useAppNavigation } from './use-app-navigation.js';
export { useDesktopEdit } from './use-desktop-edit.js';
export { useCardMode } from './use-card-mode.js';
export { useWidgetPicker } from './use-widget-picker.js';
export { bootstrapSystemData } from './core-shim.js';

// ★ v0.28 顶层预热:fire-and-forget 启动 settings-sdk
//  import 副作用会让 settingsSdk 在 framework mount 之前就开始 hydrate,
//  业务 app 打开 detail 时大概率已经就绪
import { prewarmSettingsSdk, whenSettingsSdkReady } from './prewarm.js';

// 兼容层：把 ESM 暴露的 framework 函数挂到 window，让"非 ESM 老代码"继续能用
// （理想情况下未来会逐步移除这些挂载，目前是过渡期保留）
import { UI_CONSTANTS as _UI_CONSTANTS } from './utils.js';
import { useSystemClock as _useSystemClock } from './use-system-clock.js';
import { useDynamicIsland as _useDynamicIsland, exposeDynamicIsland as _exposeDynamicIsland } from './use-dynamic-island.js';
import { useAppNavigation as _useAppNavigation } from './use-app-navigation.js';
import { useDesktopEdit as _useDesktopEdit } from './use-desktop-edit.js';
import { useCardMode as _useCardMode } from './use-card-mode.js';
import { useWidgetPicker as _useWidgetPicker } from './use-widget-picker.js';

if (typeof window !== 'undefined') {
    Object.assign(window, {
        UI_CONSTANTS: _UI_CONSTANTS,
        useSystemClock: _useSystemClock,
        useDynamicIsland: _useDynamicIsland,
        exposeDynamicIsland: _exposeDynamicIsland,
        useAppNavigation: _useAppNavigation,
        useDesktopEdit: _useDesktopEdit,
        useCardMode: _useCardMode,
        useWidgetPicker: _useWidgetPicker,
        // ★ v0.28 顶层 SDK 预热入口(暴露给业务 app)
        whenSettingsSdkReady,
        prewarmSettingsSdk,
    });
}