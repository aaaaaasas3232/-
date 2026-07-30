/**
 * 设置 App · 外观与通用 · 默认值 + IndexedDB key/store
 *
 *  - initialAppearance：state.ui.appearance 的初始形状
 *  - APPEARANCE_DB_KEY / APPEARANCE_STORE_NAME：IndexedDB 表名 + 主键
 *
 * 把"设备外观"相关默认值集中在这里：
 *   - 颜色 / 圆角默认值在 theme-bridge.js 的 DEFAULT_THEME；
 *   - 这里只是把 DEFAULT_THEME 包装成 state.ui.appearance 的"完整形状"
 *     （多一个开关：hideCase）；
 *   - 状态栏字段定义集中在 phone-statusbar 模块（DEFAULT_STATUS_BAR_STATE），
 *     已在 DEFAULT_THEME 中 spread，这里也再 spread 一次以便旧 DB 记录补齐这些键。
 */

import { getDefaultDeviceTheme } from './theme-bridge.js';
import { DEFAULT_STATUS_BAR_STATE } from './phone-statusbar/index.js';

export const APPEARANCE_STORE_NAME = 'deviceSettings';
export const APPEARANCE_DB_KEY = 'device-theme';

export function initialAppearance() {
    const base = getDefaultDeviceTheme();
    return {
        ...base,
        hideCase: false,
        // 状态栏细分字段：定义集中在 phone-statusbar 模块，这里再 spread 一次确保 hydrate 后字段不缺失
        ...DEFAULT_STATUS_BAR_STATE,
    };
}