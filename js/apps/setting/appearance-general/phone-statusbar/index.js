/**
 * 状态栏模块 · 主入口
 *
 * 统一对外接口：
 *   state.js     状态管理（getState / setState / serialize / deserialize / DEFAULT_STATUS_BAR_STATE）
 *   renderer.js  渲染器（renderStatusBarGroup / 内部 color/text row）
 *   events.js    事件系统（占位 + 回调钩子 + applyExternalState）
 *
 * 注：本模块不直接绑定任何 document 级事件，所有交互都通过：
 *   - data-app-action（开关） → framework 派发到 methods.toggleXxx
 *   - settings:slider-change（颜色） → settings app 监听后调 updateAppearanceField
 *   - data-settings-field（5G 文案） → bindInputFieldListener 自动处理
 *
 * 主题应用、CSS 变量注入、reactive 桥（window.__phoneStatusBarConfig）由 theme-bridge.js 统一负责。
 */

// 状态管理
export {
    DEFAULT_STATUS_BAR_STATE,
    getState,
    setState,
    resetState,
    isColorEmpty,
    normalizeBool,
    serialize,
    deserialize,
} from './state.js';

// 渲染器
export { renderStatusBarGroup } from './renderer.js';

// 业务方法（toggleStatusBar / Time / Signal / FiveG）
export { buildStatusBarMethods } from './methods.js';

// 事件系统
export {
    initEventHandlers,
    destroyEventHandlers,
    isInitialized,
    setOnChange,
    setOnApply,
    applyExternalState,
} from './events.js';