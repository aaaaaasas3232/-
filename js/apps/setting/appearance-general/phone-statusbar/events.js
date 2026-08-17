/**
 * 状态栏模块 · 事件系统
 *
 * 状态栏 UI 的交互绝大部分由 framework 处理：
 *   - 整体开关（Switch）通过 data-app-action 派发到 methods.toggleStatusBar
 *   - 颜色 picker 通过 settings:slider-change 自定义事件派发到 settings app
 *   - 5G 文案替换通过 data-settings-field 走 bindInputFieldListener
 *
 * 本文件作为占位 + 兜底：
 *   - 提供 initEventHandlers / destroyEventHandlers 入口（和 phone-case / phone-screenwallpaper 一致）
 *   - 提供 setOnChange / setOnApply 回调钩子，让 section.js 可以"切换 App / 切到详情页"时同步 reactive
 *
 * 当前实现：
 *   - onChange：用户每改一个字段（开关 / 颜色 / 文本）都会调用一次，
 *                由 settings app 拿到新值并塞到 state.ui.appearance。
 *   - onApply：applyDeviceTheme 已经把状态栏字段同步到 CSS 变量 + reactive 桥；
 *                这里不需要额外动作，仅做接口占位（未来若要加 transition / 动效 在这里加）。
 */

import { setState } from './state.js';

// ============================================
// 回调管理
// ============================================

let _onChange = null;
let _onApply = null;

export function setOnChange(callback) {
    _onChange = callback;
}

export function setOnApply(callback) {
    _onApply = callback;
}

// ============================================
// 状态恢复（从 IndexedDB / settings app state 反向同步到模块级 state）
// ============================================

/**
 * 把外部传入的字段塞进模块级 _state。
 * 必须在 initAppearanceSection 里调用一次（从 state.ui.appearance 反序列化）。
 */
export function applyExternalState(fields) {
    if (!fields || typeof fields !== 'object') return;
    setState(fields);
}

// ============================================
// 初始化（占位）
// ============================================

let _initialized = false;

export function initEventHandlers() {
    // 当前无 document 级别事件需要绑定，预留接口。
    _initialized = true;
}

export function destroyEventHandlers() {
    _initialized = false;
}

export function isInitialized() {
    return _initialized;
}