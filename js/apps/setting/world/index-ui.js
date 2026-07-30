/**
 * 世界观模块 · UI 层入口
 *
 * 整合了原来的 library.js 和 methods.js，
 * 提供完整的渲染和方法。
 */

import { bootstrapWorldSdk } from './bootstrap.js';
import { renderWorldLibrary } from './library.js';
import { buildWorldMethods } from './methods.js';
import { initWorldEventHandlers, destroyWorldEventHandlers } from './events.js';

export {
    bootstrapWorldSdk,
    renderWorldLibrary,
    buildWorldMethods,
    initWorldEventHandlers,
    destroyWorldEventHandlers,
};
