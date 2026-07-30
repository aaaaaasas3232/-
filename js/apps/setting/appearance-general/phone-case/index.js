/**
 * 手机壳模块 · 主入口
 *
 * 导出所有子模块，统一对外接口
 */

// 预设配置
export {
    SOLID_PRESETS,
    GRADIENT_PRESETS,
    MULTI_PRESETS,
    ANGLE_PRESETS,
    CASE_PRESETS,
} from './presets.js';

// 状态管理
export {
    DEFAULT_CASE_STATE,
    getState,
    setState,
    resetState,
    buildBackground,
    normalizeHex,
    isGradient,
    parseGradient,
    buildGradient,
    buildMultiGradient,
    serialize,
    deserialize,
} from './state.js';

// 渲染器
export {
    renderPreview,
    renderTypeToggle,
    renderSolidPicker,
    renderGradientPicker,
    renderMultiPicker,
    renderColorPanel,
    renderDIYPanel,
} from './renderer.js';

// 事件系统
export {
    initEventHandlers,
    destroyEventHandlers,
    setOnChange,
    setOnApply,
} from './events.js';
