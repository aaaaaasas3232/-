/**
 * 屏幕墙纸模块 · 主入口
 *
 * 统一对外接口：
 *   state.js     状态管理（getState / setState / buildWallpaper / serialize / deserialize）
 *   renderer.js  渲染器（preview / image picker / diy panel）
 *   events.js    事件系统（图片上传 / URL 应用 / 模糊度滑块）
 *
 * 注：屏幕墙纸模块现在仅支持「图片」模式（type=image）。
 *     图片来源：本地上传 / 用户填 URL。
 *     模糊度（blur, 0-20px）支持滑块调整并应用到桌面壁纸 filter。
 *     状态结构中保留 colors/angle 字段仅为向后兼容旧持久化数据。
 */

// 状态管理
export {
    DEFAULT_SCREEN_WALLPAPER_STATE,
    getState,
    setState,
    resetState,
    buildWallpaper,
    normalizeHex,
    isImageUrl,
    serialize,
    deserialize,
} from './state.js';

// 渲染器
export {
    renderPreview,
    renderImagePicker,
    renderDiyPanel,
} from './renderer.js';

// 事件系统
export {
    initEventHandlers,
    destroyEventHandlers,
    setOnChange,
    setOnApply,
    syncBlurSliders,
} from './events.js';
