/**
 * settings-sdk · 时间系统模块（Chronology Module）v0.16
 *
 * 导出：
 *   - createChronologyApi: 纪时系统工厂
 *   - 所有常量（已移除阶段/转折点/分支相关）
 */

// 纪时系统 API
export { createChronologyApi } from './chronology-api.js';

// 常量
export {
    ANCHOR_TYPES,
    TIMELINE_CATEGORIES,
    TIMELINE_TYPES,
    DEFAULT_ANCHOR,
    DEFAULT_TIMELINE_EVENT,
    DEFAULT_CHRONOLOGY_FALLBACK,
    DEFAULT_DIVISIONS,
    DEFAULT_12_HOURS,
    DEFAULT_24_HOURS,
} from './chronology-constants.js';