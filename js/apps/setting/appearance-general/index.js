/**
 * 设置 App · 外观与通用（Appearance & General）· 子模块入口
 *
 * 把「外观与通用」detail 页相关的所有代码集中在此，方便后续查找：
 *
 *   presets.js      CASE_PRESETS / BATTERY_PRESETS / SCREEN_RADIUS_PRESETS 等
 *   defaults.js     initialAppearance + DB_KEY/STORE_NAME.appearance
 *   theme-bridge.js applyDeviceTheme · getDefaultDeviceTheme
 *   methods.js      buildAppearanceMethods（updateAppearanceField / save / reset / toggle）
 *   section.js     renderAppearanceSection（detail 页 HTML）
 *
 *   ---- 手机壳模块（新版）----
 *   phone-case/    手机壳完整模块（状态 + 预设 + 渲染 + 事件）
 *     ├── presets.js   预设配置
 *     ├── state.js    状态管理
 *     ├── renderer.js 渲染器
 *     ├── events.js   事件系统
 *     └── index.js    统一导出
 *
 *   ---- 屏幕墙纸模块（新增）----
 *   phone-screenwallpaper/   桌面屏幕壁纸（上传 / URL / 模糊）
 *     ├── presets.js   预设配置
 *     ├── state.js    状态管理
 *     ├── renderer.js 渲染器
 *     ├── events.js   事件系统
 *     └── index.js    统一导出
 *
 *   ---- 状态栏模块（新增）----
 *   phone-statusbar/        顶部状态栏（整体开关 / 时间 / 信号 / 5G）
 *     ├── state.js    状态管理（DEFAULT_STATUS_BAR_STATE / serialize / deserialize）
 *     ├── renderer.js 渲染器（renderStatusBarGroup）
 *     ├── methods.js  业务方法（toggleStatusBar / Time / Signal / FiveG）
 *     ├── events.js   事件占位（由 framework action + settings:slider-change 处理）
 *     └── index.js    统一导出
 *
 *   index.js        本文件：统一对外 re-export
 */

export {
    CASE_PRESETS,
    BATTERY_PRESETS,
} from './presets.js';

export {
    APPEARANCE_DB_KEY,
    APPEARANCE_STORE_NAME,
    initialAppearance,
} from './defaults.js';

export {
    applyDeviceTheme,
    getDefaultDeviceTheme,
    applyAppearanceFields,
    initThemeSystem,
    syncStatusBarConfig,
    syncDesktopGridConfig,
    DESKTOP_GRID_ROWS_OPTIONS,
    DESKTOP_GRID_ROWS_DEFAULT,
    DESKTOP_GRID_COLUMNS,
    clampDesktopGridRows,
} from './theme-bridge.js';

export { buildAppearanceMethods } from './methods.js';

export { renderAppearanceSection } from './section.js';

// ---- 手机壳模块（新版）----
export * from './phone-case/index.js';

// ---- 屏幕墙纸模块（新增）----
export * from './phone-screenwallpaper/index.js';

// ---- 状态栏模块（新增）----
export * from './phone-statusbar/index.js';