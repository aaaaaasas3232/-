/**
 * 设置 App · 外观与通用 · 主题桥（Theme Bridge）
 *
 * 负责把"外观设置"中的字段同步成真实的 DOM 状态。
 *
 * 重构设计理念：
 * 1. CSS 变量驱动：所有外观属性通过 CSS 变量控制
 * 2. 单一数据源：所有状态集中在 state.ui.appearance
 * 3. 分层更新：case / battery / statusBar 独立更新
 * 4. 防抖渲染：避免频繁的 DOM 操作
 *
 * CSS 变量映射：
 *   --case-bg: 手机壳背景（纯色或渐变）
 *   --case-radius: 手机壳圆角
 *   --case-shadow: 手机壳阴影
 *   --case-hidden: 是否隐藏手机壳（0/1）
 *   --screen-radius: 屏幕圆角
 *   --battery-color: 电池颜色
 *   --battery-capacity: 电池电量（0-1）
 */

import {
    DEFAULT_CASE_STATE,
    getCaseBackground,
    normalizeHex,
} from './case-state.js';

import {
    DEFAULT_SCREEN_WALLPAPER_STATE,
    deserialize as deserializeScreenWallpaper,
    serialize as serializeScreenWallpaper,
} from './phone-screenwallpaper/index.js';

import {
    DEFAULT_STATUS_BAR_STATE,
} from './phone-statusbar/index.js';

export const PHONE_HEIGHT_MIN = 450;
export const PHONE_HEIGHT_MAX = 720;
export const PHONE_HEIGHT_DEFAULT = 590;
export const PHONE_Y_OFFSET_MIN = -100;
export const PHONE_Y_OFFSET_MAX = 100;
export const PHONE_Y_OFFSET_DEFAULT = 0;

// 桌面网格（行数）—— 用户可在设置里调整 3~8；
// 列数固定为 4，不再开放自定义。
// 默认与历史一致（4 × 4），升级旧 DB 时通过 DEFAULT_THEME 自动补齐。
export const DESKTOP_GRID_ROWS_MIN = 3;
export const DESKTOP_GRID_ROWS_MAX = 8;
export const DESKTOP_GRID_ROWS_DEFAULT = 4;
export const DESKTOP_GRID_ROWS_OPTIONS = [3, 4, 5, 6, 7, 8];

// 列数固定常量（4）—— 保留只读访问，不再让用户改。
export const DESKTOP_GRID_COLUMNS = 4;

function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const rounded = Math.round(n);
    if (rounded < min) return min;
    if (rounded > max) return max;
    return rounded;
}

export function clampDesktopGridRows(value) {
    return clampInt(value, DESKTOP_GRID_ROWS_MIN, DESKTOP_GRID_ROWS_MAX, DESKTOP_GRID_ROWS_DEFAULT);
}

const DEFAULT_THEME = Object.freeze({
    batteryColor: '#73AE52',
    batteryCapacity: 0.6,
    caseColor: 'linear-gradient(135deg, #f6d3e0 0%, #b4d7f2 100%)',
    caseRadius: 50,
    caseShadow: '0 20px 45px rgba(0, 0, 0, 0.25)',
    hideCase: false,
    screenCornerRadius: 40,
    // 手机高度（px），450-720 之间可调；保持 390 宽不变，按比例放大
    phoneHeight: 590,
    // 手机垂直偏移（px），负数上移、正数下移，范围 -100 ~ +100
    phoneYOffset: 0,
    // 桌面网格 行数（3~8）—— 列数固定为 4，由 DESKTOP_GRID_COLUMNS 常量提供
    desktopGridRows: DESKTOP_GRID_ROWS_DEFAULT,
    // 整体状态栏开关（不影响灵动岛）— 字段定义集中在 phone-statusbar 模块
    ...DEFAULT_STATUS_BAR_STATE,
    // 桌面屏幕壁纸（持久化字段「screenWallpaper」是序列化后的 JSON 字符串）
    screenWallpaper: serializeScreenWallpaper(DEFAULT_SCREEN_WALLPAPER_STATE),
});

// ============================================
// 防抖工具
// ============================================

let _updateFrame = null;
let _pendingTheme = null;

/**
 * 防抖更新：合并多个变更，在下一帧统一应用
 */
function scheduleUpdate(theme) {
    _pendingTheme = { ..._pendingTheme, ...theme };
    if (_updateFrame) return;
    _updateFrame = requestAnimationFrame(() => {
        if (_pendingTheme) {
            applyThemeToCssVars(_pendingTheme);
            _updateFrame = null;
            _pendingTheme = null;
        }
    });
}

// ============================================
// CSS 变量应用
// ============================================

function clamp(value, min, max) {
    const num = Number(value);
    if (Number.isNaN(num)) return min;
    return Math.min(max, Math.max(min, num));
}

/**
 * 应用主题到 CSS 变量
 */
function applyThemeToCssVars(theme) {
    const root = document.documentElement;

    // 手机壳背景
    const bg = getEffectiveBackground(theme);
    root.style.setProperty('--case-bg', bg || 'transparent');

    // 手机壳圆角
    const caseRadius = clamp(theme?.caseRadius ?? DEFAULT_THEME.caseRadius, 0, 80);
    root.style.setProperty('--case-radius', `${caseRadius}px`);

    // 手机壳阴影
    const shadow = theme?.caseShadow || DEFAULT_THEME.caseShadow;
    root.style.setProperty('--case-shadow', shadow);

    // 手机壳可见性
    const hidden = theme?.hideCase === true ? 1 : 0;
    root.style.setProperty('--case-hidden', String(hidden));

    // 屏幕圆角
    const screenRadius = clamp(theme?.screenCornerRadius ?? DEFAULT_THEME.screenCornerRadius, 0, 80);
    root.style.setProperty('--screen-radius', `${screenRadius}px`);

    // 电池颜色
    const batteryColor = theme?.batteryColor || DEFAULT_THEME.batteryColor;
    root.style.setProperty('--battery-color', batteryColor);

    // 电池电量
    const batteryCapacity = clamp(theme?.batteryCapacity ?? DEFAULT_THEME.batteryCapacity, 0, 1);
    root.style.setProperty('--battery-capacity', String(batteryCapacity));

    // 状态栏可见性
    const statusBarHidden = theme?.showStatusBar === false ? 1 : 0;
    root.style.setProperty('--status-bar-hidden', String(statusBarHidden));

    // 状态栏细分字段（CSS 变量兜底，Vue 模板里优先用 reactive）
    // 时间 / 信号 / 5G 的显隐已统一到 showStatusBar 一个开关，不再单独写变量。
    if (typeof theme?.statusBarTimeColor === 'string' && theme.statusBarTimeColor) {
        root.style.setProperty('--status-bar-time-color', theme.statusBarTimeColor);
    } else {
        root.style.removeProperty('--status-bar-time-color');
    }
    if (typeof theme?.statusBarSignalColor === 'string' && theme.statusBarSignalColor) {
        root.style.setProperty('--status-bar-signal-color', theme.statusBarSignalColor);
    } else {
        root.style.removeProperty('--status-bar-signal-color');
    }
    if (typeof theme?.statusBarFiveGColor === 'string' && theme.statusBarFiveGColor) {
        root.style.setProperty('--status-bar-fivg-color', theme.statusBarFiveGColor);
    } else {
        root.style.removeProperty('--status-bar-fivg-color');
    }
    if (typeof theme?.statusBarFiveGLabel === 'string' && theme.statusBarFiveGLabel) {
        root.style.setProperty('--status-bar-fivg-label', `"${theme.statusBarFiveGLabel.replace(/"/g, '\\"')}"`);
    } else {
        root.style.removeProperty('--status-bar-fivg-label');
    }

    // 桌面屏幕壁纸
    const wp = deserializeScreenWallpaper(theme?.screenWallpaper);

    // 桌面网格（列数固定 4，行数 3~8）—— 写到 CSS 变量，CSS / Vue 模板都从同一处读
    const gridColumns = DESKTOP_GRID_COLUMNS;
    const gridRows = clamp(
        theme?.desktopGridRows ?? DEFAULT_THEME.desktopGridRows,
        DESKTOP_GRID_ROWS_MIN,
        DESKTOP_GRID_ROWS_MAX
    );
    root.style.setProperty('--desktop-grid-columns', String(gridColumns));
    root.style.setProperty('--desktop-grid-rows', String(gridRows));
}

/**
 * 获取有效的背景值
 */
function getEffectiveBackground(theme) {
    if (!theme) return DEFAULT_THEME.caseColor;
    const value = String(theme.caseColor || '').trim();
    if (!value) return DEFAULT_THEME.caseColor;
    return value;
}

// ============================================
// DOM 应用
// ============================================

/**
 * 应用电池样式
 */
function applyBatteryToDOM(theme) {
    const phoneScreen = document.querySelector('.phone-screen');
    if (!phoneScreen) return;

    const batteryFill = phoneScreen.querySelector('.status-battery-fill');
    const batteryCap = phoneScreen.querySelector('.status-battery-cap');
    const batteryShell = phoneScreen.querySelector('.status-battery');
    if (!batteryFill || !batteryShell) return;

    const color = theme?.batteryColor || DEFAULT_THEME.batteryColor;
    const capacity = clamp(theme?.batteryCapacity ?? DEFAULT_THEME.batteryCapacity, 0, 1);

    const shellWidth = batteryShell.getBoundingClientRect().width || 26;
    const usableWidth = shellWidth - 2;
    const fillWidth = Math.max(2, Math.round(usableWidth * capacity));

    batteryFill.style.background = color;
    batteryFill.style.width = `${fillWidth}px`;
    if (batteryCap) {
        batteryCap.style.background = color;
    }

    // CSS 变量已经在 applyThemeToCssVars 设置
}

/**
 * 应用手机壳样式
 */
function applyCaseToDOM(theme) {
    const phoneCase = document.querySelector('.phone-case');
    const phoneEl = document.getElementById('phone');

    if (!phoneCase) return;

    const hideCase = theme?.hideCase === true;
    phoneCase.classList.toggle('phone-case--hidden', hideCase);

    if (phoneEl) {
        phoneEl.classList.toggle('phone--fullscreen', hideCase);
    }

    // 手机高度：仅在显示手机壳（非全屏）时使用用户配置；
    // 全屏模式下由 .phone--fullscreen 的 CSS 公式接管高度
    const phoneHeight = clamp(
        theme?.phoneHeight ?? DEFAULT_THEME.phoneHeight,
        PHONE_HEIGHT_MIN,
        PHONE_HEIGHT_MAX
    );

    // 垂直偏移（px）：用 transform: translateY 上/下平移 #phone；
    // 必须和 CSS 上的 scale(var(--phone-scale)) 共存，所以组合写成同一 transform
    const phoneYOffset = clamp(
        theme?.phoneYOffset ?? DEFAULT_THEME.phoneYOffset,
        PHONE_Y_OFFSET_MIN,
        PHONE_Y_OFFSET_MAX
    );

    if (!hideCase) {
        // 显示手机壳：写入自定义高度
        if (phoneEl) {
            phoneEl.style.width = '';
            phoneEl.style.height = `${phoneHeight}px`;
        }
        phoneCase.style.width = '';
        phoneCase.style.height = `${phoneHeight}px`;

        if (phoneEl) {
            // 合并 CSS 上的 scale(var(--phone-scale)) + 用户的 translateY：
            // 直接复用同一个 CSS 变量，让浏览器自己解析，避开反推 matrix 易错的坑
            // （matrix(a,b,c,d,e,f) 里 a/d 才是 scaleX/scaleY，反推易混）
            phoneEl.style.transform = `translateY(${phoneYOffset}px) scale(var(--phone-scale, 1))`;
        }

        const bg = getEffectiveBackground(theme);
        const radius = clamp(theme?.caseRadius ?? DEFAULT_THEME.caseRadius, 0, 80);
        const shadow = theme?.caseShadow || DEFAULT_THEME.caseShadow;

        // 清除之前的背景
        phoneCase.style.background = '';
        phoneCase.style.backgroundImage = '';
        phoneCase.style.backgroundColor = '';
        phoneCase.style.backgroundSize = '';
        phoneCase.style.backgroundPosition = '';
        phoneCase.style.backgroundRepeat = '';

        // 根据背景类型应用
        // 注意：CSS 简写 `background:` 会重置所有子属性（含 background-image / background-color），
        // 而 inline style 单独设 background-color 时优先级虽然更高，但与 CSS 规则中的 background 简写并存
        // 会触发渲染异常。因此这里统一把"纯色 / 渐变 / 多色 / 图片"都映射到 background-image：
        //   - 纯色：伪装成 linear-gradient(hex, hex)（两同色 = 平涂，无视觉差）
        //   - 渐变/多色：直接用 linear-gradient(...) 字符串
        //   - 图片：用 url(...) 时也走 background-image 路径
        const trimmed = (bg || '').trim();
        if (/^url\(/i.test(trimmed)) {
            // 图片填充：留给后续图片上传功能使用
            phoneCase.style.backgroundImage = trimmed;
            phoneCase.style.backgroundSize = 'cover';
            phoneCase.style.backgroundPosition = 'center';
            phoneCase.style.backgroundRepeat = 'no-repeat';
            phoneCase.style.backgroundColor = '';
        } else if (/^(linear-|radial-|conic-)/i.test(trimmed)) {
            phoneCase.style.backgroundImage = trimmed;
        } else {
            // 纯色（hex / rgb / rgba）：伪装成同色渐变，避开 background 简写优先级冲突
            phoneCase.style.backgroundImage = `linear-gradient(${trimmed}, ${trimmed})`;
            phoneCase.style.backgroundColor = '';
        }
        phoneCase.style.borderRadius = `${radius}px`;
        phoneCase.style.boxShadow = shadow;
    } else {
        phoneCase.style.background = 'transparent';
        phoneCase.style.backgroundImage = 'none';
        phoneCase.style.backgroundColor = 'transparent';
        phoneCase.style.backgroundSize = '';
        phoneCase.style.backgroundPosition = '';
        phoneCase.style.backgroundRepeat = '';
        phoneCase.style.boxShadow = 'none';
        phoneCase.style.borderRadius = '0';
    }

    // 屏幕圆角
    const screenRadius = clamp(
        theme?.screenCornerRadius ?? DEFAULT_THEME.screenCornerRadius,
        0,
        80
    );
    const phoneScreen = document.querySelector('.phone-screen');
    if (phoneScreen) {
        phoneScreen.style.borderRadius = `${screenRadius}px`;
    }
}

/**
 * 应用状态栏样式
 *
 * 注意：状态栏的「整体可见性」由 index.html 的 v-if="statusBarVisible" 控制（reactive 驱动），
 * 这里仅作为兜底：万一 framework 模板还没接管，至少保证状态栏不会"看不见但占位"。
 * 因此不主动写 container.style.display —— 由 Vue 模板统一决定。
 */
function applyStatusBarToDOM(theme) {
    const container = document.querySelector('.statusBarContainer');
    if (!container) return;
    const show = theme?.showStatusBar !== false;
    // 不主动写 display：v-if 是主控。
    // 但若之前残留了 inline style.display='none'（旧逻辑），当 show=true 时清掉，避免「双控打架」。
    if (show && container.style.display === 'none') {
        container.style.removeProperty('display');
    }
}

// ============================================
// 屏幕墙纸 DOM 应用
// ============================================

/**
 * 把屏幕墙纸应用到 .desktop-wallpaper 元素。
 * 支持三种类型：纯色 / 渐变 / 图片。
 * 同时根据 blur 设置实际 CSS 滤镜。
 */
function applyScreenWallpaperToDOM(theme) {
    const el = document.querySelector('.desktop-wallpaper');
    if (!el) return;

    const wp = deserializeScreenWallpaper(theme?.screenWallpaper);
    const { type, colors, angle, imageUrl, blur } = wp;

    // 1. 计算背景值
    let bgValue = '';
    if (type === 'image' && imageUrl) {
        bgValue = `url("${escapeCssUrl(imageUrl)}")`;
    } else if (type === 'solid') {
        bgValue = normalizeHex(colors?.[0] || '#ffe2ef');
    } else {
        // gradient
        const safeColors = Array.isArray(colors) && colors.length
            ? colors.map(normalizeHex)
            : ['#ffe2ef', '#d6e8ff'];
        bgValue = `linear-gradient(${Number(angle) || 160}deg, ${safeColors.join(', ')})`;
    }

    // 2. 应用背景
    //   图片走 background-image；色 / 渐变：纯色 → background-color，渐变 → background-image
    if (type === 'image' && imageUrl) {
        el.style.backgroundColor = 'transparent';
        el.style.backgroundImage = bgValue;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.backgroundRepeat = 'no-repeat';
    } else if (type === 'solid') {
        el.style.backgroundImage = 'none';
        el.style.backgroundColor = bgValue;
    } else {
        el.style.backgroundImage = bgValue;
        el.style.backgroundColor = 'transparent';
        el.style.backgroundSize = '';
        el.style.backgroundPosition = '';
        el.style.backgroundRepeat = '';
    }

    // 3. 应用模糊度（blur）：写到 .desktop-wallpaper 的 filter 上，让桌面壁纸实时模糊。
    const blurPx = clampBlur(wp.blur);
    el.style.filter = blurPx > 0 ? `blur(${blurPx}px)` : '';

    // 4. 移除磨砂蒙层元素（如果存在）。
    const frostEl = el.querySelector(':scope > .desktop-wallpaper__frost');
    if (frostEl) frostEl.remove();
}

function clampBlur(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.min(20, Math.max(0, Math.round(n)));
}

function escapeCssUrl(url) {
    if (!url) return '';
    return String(url).replace(/"/g, '\\"').replace(/\\/g, '\\\\');
}

// ============================================
// 主入口
// ============================================

/**
 * 把主题应用到全局 DOM + CSS 变量
 * @param {Partial<typeof DEFAULT_THEME>} theme
 */
export function applyDeviceTheme(theme = {}) {
    // CSS 变量更新（防抖）
    scheduleUpdate(theme);

    // DOM 更新（立即）
    applyCaseToDOM(theme);
    applyBatteryToDOM(theme);
    applyStatusBarToDOM(theme);
    applyScreenWallpaperToDOM(theme);

    // 把状态栏字段同步到 reactive 容器，供 Vue 状态栏模板订阅
    syncStatusBarConfig(theme);

    // 把桌面网格字段同步到 reactive 容器，供 framework useDesktopEdit 订阅
    syncDesktopGridConfig(theme);

    // 电池宽度需要在布局后重新计算
    requestAnimationFrame(() => {
        applyBatteryToDOM(theme);
    });
}

/**
 * 获取默认设备主题
 */
export function getDefaultDeviceTheme() {
    return { ...DEFAULT_THEME };
}

/**
 * 获取默认手机壳状态
 */
export function getDefaultCaseState() {
    return { ...DEFAULT_CASE_STATE };
}

/**
 * 批量应用多个外观字段
 */
export function applyAppearanceFields(fields) {
    applyDeviceTheme(fields);
}

// ============================================
// 状态栏字段桥（供 Vue 状态栏模板订阅）
// ============================================

/**
 * 当前状态栏字段的「reactive 视图」。
 * framework（use-app-navigation）在 computed 里读它 → 状态栏颜色 / 显隐 / 文本实时刷新。
 *
 * 设计：
 *   - 仅暴露给状态栏关心的字段，避免把整个 theme 引用进 framework。
 *   - 由 settings app 在 hydrate / updateAppearanceField / saveAppearance / resetAppearance 后
 *     通过 syncStatusBarConfig(theme) 写一次；framework 自己 watch 这个对象即可。
 *
 * 【修复要点】
 *   - 用一个数组 holder（_statusBarConfigRef）持有真正的 reactive 对象。
 *     这样 const 不能 reassign 的限制被规避。
 *   - syncStatusBarConfig 调用时如果 reactive 还没创建，会即时创建并 dispatch
 *     一个 `settings:statusbar-updated` 事件，让 framework 的 computed 能感知到 cfg ready。
 *
 * 延迟初始化：模块 top-level 时 window.Vue 可能尚未挂载（少见，但 vue 是独立 <script>，
 * 而 framework bootstrap 走 DOMContentLoaded，理论 window.Vue 在 module 求值时已就绪；
 * 这里仍做兜底）。
 */
const _statusBarConfigRef = { value: null };
function getStatusBarConfig() {
    if (!_statusBarConfigRef.value && typeof window !== 'undefined' && window.Vue) {
        _statusBarConfigRef.value = window.Vue.reactive({ ...DEFAULT_STATUS_BAR_STATE });
    }
    return _statusBarConfigRef.value;
}
// 模块顶层立即尝试创建（如果 Vue 已就绪）
getStatusBarConfig();
if (typeof window !== 'undefined') {
    window.__phoneStatusBarConfig = _statusBarConfigRef.value;
}

/**
 * 把 theme 上的状态栏相关字段同步到 reactive 配置。
 * 即使没有 Vue（极早阶段调用），也安全返回。
 *
 * 【关键】同步后会派发 `settings:statusbar-updated` 自定义事件。
 * 这是给 framework 的 use-app-navigation.js 用的「急救通道」——
 * 当 reactive 桥在 framework bootstrap 之后才被创建时，computed 第一次求值
 * 会因为 cfg=null 而丢失响应式依赖（Vue 不会再去监听 cfg）。
 *   * settings:statusbar-updated 每次 cfg 内容变化时触发
 *   * framework 侧 listen 这个事件 + 用一个 ref 计数，让相关 computed 重算
 */
export function syncStatusBarConfig(theme = {}) {
    // 懒初始化：如果 reactive 桥还没创建（即 vue 当时未就绪），即时创建。
    const target = getStatusBarConfig();
    if (!target) return;
    if (target === _statusBarConfigRef.value && !window.__phoneStatusBarConfig) {
        // eslint-disable-next-line no-console
        console.warn('[theme-bridge] syncStatusBarConfig 兜底初始化（通常不应走到）');
        window.__phoneStatusBarConfig = target;
    }
    applyStatusBarConfigTo(target, theme);
    // 通知 framework，让依赖状态栏 reactive 桥的 computed 重算。
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('settings:statusbar-updated'));
    }
}

function applyStatusBarConfigTo(target, theme) {
    if (!target) return;
    target.showStatusBar = theme?.showStatusBar !== false;
    target.statusBarTimeColor = (typeof theme?.statusBarTimeColor === 'string') ? theme.statusBarTimeColor : DEFAULT_STATUS_BAR_STATE.statusBarTimeColor;
    target.statusBarSignalColor = (typeof theme?.statusBarSignalColor === 'string') ? theme.statusBarSignalColor : DEFAULT_STATUS_BAR_STATE.statusBarSignalColor;
    target.statusBarFiveGColor = (typeof theme?.statusBarFiveGColor === 'string') ? theme.statusBarFiveGColor : DEFAULT_STATUS_BAR_STATE.statusBarFiveGColor;
    target.statusBarFiveGLabel = (typeof theme?.statusBarFiveGLabel === 'string' && theme.statusBarFiveGLabel)
        ? theme.statusBarFiveGLabel
        : DEFAULT_STATUS_BAR_STATE.statusBarFiveGLabel;
}

// ============================================
// 桌面网格字段桥（供 framework useDesktopEdit 订阅）
// ============================================
/**
 * 当前桌面网格（列数 / 行数）的「reactive 视图」。
 * framework（use-desktop-edit.js）在 computed 里读它 → 拖拽算法 / 分页算法跟着重算。
 *
 * 设计：与 _statusBarConfigRef 平行的一套桥，存的是数值（4/5 与 3~8）。
 *
 * 派发事件 `settings:desktop-grid-updated`：让 framework 兜底触发重算，
 * 防止 reactive 在 framework bootstrap 之后才被创建时丢失依赖。
 */
const _desktopGridConfigRef = { value: null };
function getDesktopGridConfig() {
    if (!_desktopGridConfigRef.value && typeof window !== 'undefined' && window.Vue) {
        _desktopGridConfigRef.value = window.Vue.reactive({
            columns: DESKTOP_GRID_COLUMNS,
            rows: DESKTOP_GRID_ROWS_DEFAULT,
        });
    }
    return _desktopGridConfigRef.value;
}
// 模块顶层立即尝试创建（如果 Vue 已就绪）
getDesktopGridConfig();
if (typeof window !== 'undefined') {
    window.__phoneDesktopGridConfig = _desktopGridConfigRef.value;
    // ★ 关键：模块刚 evaluate 时，useDesktopEdit 的 desktopGridConfigVersion
    // 监听器已经注册（core-shim 跑得比 settings app 早）。如果在创建 reactive 后
    // 不 bump 一次，computed 不会重算，仍然返回早先 fallback 的 4×4。
    // 派发一次 settings:desktop-grid-updated，触发 framework 兜底重算。
    window.dispatchEvent(new CustomEvent('settings:desktop-grid-updated'));
}

/**
 * 把 theme 上的桌面网格字段同步到 reactive 配置。
 */
export function syncDesktopGridConfig(theme = {}) {
    const target = getDesktopGridConfig();
    if (!target) return;
    // 列数固定为 4，不再写入从 theme 来的 desktopGridColumns（如有遗留值也归一）。
    target.columns = DESKTOP_GRID_COLUMNS;
    target.rows = clamp(
        theme?.desktopGridRows ?? DEFAULT_THEME.desktopGridRows,
        DESKTOP_GRID_ROWS_MIN,
        DESKTOP_GRID_ROWS_MAX
    );
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('settings:desktop-grid-updated'));
    }
}

/**
 * 同步当前 DOM 状态到 CSS 变量
 * 用于在 DOM 变化后重新同步变量
 */
export function syncThemeFromDOM() {
    const phoneCase = document.querySelector('.phone-case');
    const phoneScreen = document.querySelector('.phone-screen');
    const phoneEl = document.getElementById('phone');
    const batteryFill = phoneScreen?.querySelector('.status-battery-fill');
    const statusBar = document.querySelector('.statusBarContainer');

    if (!phoneCase) return;

    const theme = {
        hideCase: phoneCase.classList.contains('phone-case--hidden'),
        showStatusBar: statusBar ? statusBar.style.display !== 'none' : true,
        screenCornerRadius: phoneScreen ? parseFloat(phoneScreen.style.borderRadius) || 40 : 40,
        caseRadius: parseFloat(phoneCase.style.borderRadius) || 50,
        // 从 #phone / .phone-case 的 inline height 读回当前值（去掉 px）
        phoneHeight: parseFloat(phoneEl?.style.height) || DEFAULT_THEME.phoneHeight,
        // 从 #phone 的 inline transform 提取 translateY
        phoneYOffset: parseTranslateY(phoneEl?.style.transform) ?? DEFAULT_THEME.phoneYOffset,
    };

    // 从样式获取背景
    const bg = phoneCase.style.backgroundColor || phoneCase.style.backgroundImage;
    if (bg) {
        theme.caseColor = bg.startsWith('linear') || bg.startsWith('radial')
            ? bg
            : normalizeHex(bg);
    }

    if (batteryFill) {
        theme.batteryColor = batteryFill.style.background || '#73AE52';
    }

    applyThemeToCssVars(theme);
}

// 从 "translateY(50px) scale(1, 1)" 这类 transform 字符串里抽 translateY
function parseTranslateY(transformStr) {
    if (!transformStr || transformStr === 'none') return 0;
    const m = /translateY\(\s*(-?\d+(?:\.\d+)?)\s*px\s*\)/.exec(transformStr);
    if (!m) return 0;
    const v = parseFloat(m[1]);
    return Number.isFinite(v) ? v : 0;
}

// ============================================
// 初始化
// ============================================

let _initialized = false;

/**
 * 初始化主题系统
 * 注入 CSS 变量定义
 */
export function initThemeSystem() {
    if (_initialized) return;
    _initialized = true;

    // 在 head 中注入 CSS 变量定义
    const style = document.createElement('style');
    style.id = 'theme-system-vars';
    style.textContent = `
        :root {
            --case-bg: ${DEFAULT_THEME.caseColor};
            --case-radius: ${DEFAULT_THEME.caseRadius}px;
            --case-shadow: ${DEFAULT_THEME.caseShadow};
            --case-hidden: 0;
            --screen-radius: ${DEFAULT_THEME.screenCornerRadius}px;
            --battery-color: ${DEFAULT_THEME.batteryColor};
            --battery-capacity: ${DEFAULT_THEME.batteryCapacity};
            --status-bar-hidden: 0;
            --desktop-grid-columns: ${DESKTOP_GRID_COLUMNS};
            --desktop-grid-rows: ${DEFAULT_THEME.desktopGridRows};
        }
    `;
    document.head.appendChild(style);

    // 即便没有任何 settings 调用 applyDeviceTheme，也确保 reactive 容器至少有默认值
    syncStatusBarConfig(DEFAULT_THEME);
    syncDesktopGridConfig(DEFAULT_THEME);
}

/**
 * ★ 新增：框架早期主题应用（core-shim 在 settings app hydrate 前调用）
 * 在桌面渲染之前就从 IndexedDB 读取保存的外观设置并应用到 DOM。
 * 这样用户不需要先打开 settings app 就能看到之前保存的外观状态。
 */
if (typeof window !== 'undefined') {
    window.__applyEarlyTheme = function(themeRaw) {
        console.log('[theme-bridge] __applyEarlyTheme 应用主题:', JSON.stringify(themeRaw));
        if (!themeRaw) return;

        const root = document.documentElement;

        // 手机壳背景
        const bg = getEffectiveBackground(themeRaw);
        root.style.setProperty('--case-bg', bg || 'transparent');

        // 手机壳圆角
        const caseRadius = clamp(themeRaw?.caseRadius ?? DEFAULT_THEME.caseRadius, 0, 80);
        root.style.setProperty('--case-radius', `${caseRadius}px`);

        // 手机壳阴影
        const shadow = themeRaw?.caseShadow || DEFAULT_THEME.caseShadow;
        root.style.setProperty('--case-shadow', shadow);

        // 手机壳可见性
        const hidden = themeRaw?.hideCase === true ? 1 : 0;
        root.style.setProperty('--case-hidden', String(hidden));

        // 屏幕圆角
        const screenRadius = clamp(themeRaw?.screenCornerRadius ?? DEFAULT_THEME.screenCornerRadius, 0, 80);
        root.style.setProperty('--screen-radius', `${screenRadius}px`);

        // 电池颜色
        const batteryColor = themeRaw?.batteryColor || DEFAULT_THEME.batteryColor;
        root.style.setProperty('--battery-color', batteryColor);

        // 电池电量
        const batteryCapacity = clamp(themeRaw?.batteryCapacity ?? DEFAULT_THEME.batteryCapacity, 0, 1);
        root.style.setProperty('--battery-capacity', String(batteryCapacity));

        // 状态栏可见性
        const statusBarHidden = themeRaw?.showStatusBar === false ? 1 : 0;
        root.style.setProperty('--status-bar-hidden', String(statusBarHidden));

        // 状态栏细分字段
        if (typeof themeRaw?.statusBarTimeColor === 'string' && themeRaw.statusBarTimeColor) {
            root.style.setProperty('--status-bar-time-color', themeRaw.statusBarTimeColor);
        }
        if (typeof themeRaw?.statusBarSignalColor === 'string' && themeRaw.statusBarSignalColor) {
            root.style.setProperty('--status-bar-signal-color', themeRaw.statusBarSignalColor);
        }
        if (typeof themeRaw?.statusBarFiveGColor === 'string' && themeRaw.statusBarFiveGColor) {
            root.style.setProperty('--status-bar-fivg-color', themeRaw.statusBarFiveGColor);
        }
        if (typeof themeRaw?.statusBarFiveGLabel === 'string' && themeRaw.statusBarFiveGLabel) {
            root.style.setProperty('--status-bar-fivg-label', `"${themeRaw.statusBarFiveGLabel.replace(/"/g, '\\"')}"`);
        }

        // 桌面网格（列数固定 4，行数 3~8）
        const earlyGridCols = DESKTOP_GRID_COLUMNS;
        const earlyGridRows = clamp(
            themeRaw?.desktopGridRows ?? DEFAULT_THEME.desktopGridRows,
            DESKTOP_GRID_ROWS_MIN,
            DESKTOP_GRID_ROWS_MAX
        );
        root.style.setProperty('--desktop-grid-columns', String(earlyGridCols));
        root.style.setProperty('--desktop-grid-rows', String(earlyGridRows));

        // 把保存的桌面网格行数同步到 reactive 桥 __phoneDesktopGridConfig，
        // 让 useDesktopEdit 的 computed 在用户进 settings 前就读到正确的行数
        // （没有这一步的话，模板 :style 仍按 reactive 的默认值 4 行渲染）。
        syncDesktopGridConfig({
            desktopGridRows: earlyGridRows,
        });

        // 应用到 DOM（手机壳）
        const phoneCase = document.querySelector('.phone-case');
        const phoneEl = document.getElementById('phone');
        if (phoneCase) {
            const hideCase = themeRaw?.hideCase === true;
            phoneCase.classList.toggle('phone-case--hidden', hideCase);

            if (phoneEl) {
                phoneEl.classList.toggle('phone--fullscreen', hideCase);
            }

            if (!hideCase) {
                const phoneHeight = clamp(
                    themeRaw?.phoneHeight ?? DEFAULT_THEME.phoneHeight,
                    PHONE_HEIGHT_MIN,
                    PHONE_HEIGHT_MAX
                );
                if (phoneEl) {
                    phoneEl.style.width = '';
                    phoneEl.style.height = `${phoneHeight}px`;
                }
                phoneCase.style.width = '';
                phoneCase.style.height = `${phoneHeight}px`;

                const phoneYOffset = clamp(
                    themeRaw?.phoneYOffset ?? DEFAULT_THEME.phoneYOffset,
                    PHONE_Y_OFFSET_MIN,
                    PHONE_Y_OFFSET_MAX
                );
                if (phoneEl) {
                    phoneEl.style.transform = `translateY(${phoneYOffset}px) scale(var(--phone-scale, 1))`;
                }

                // 应用背景
                const trimmed = (bg || '').trim();
                if (/^url\(/i.test(trimmed)) {
                    phoneCase.style.backgroundImage = trimmed;
                    phoneCase.style.backgroundSize = 'cover';
                    phoneCase.style.backgroundPosition = 'center';
                    phoneCase.style.backgroundRepeat = 'no-repeat';
                    phoneCase.style.backgroundColor = '';
                } else if (/^(linear-|radial-|conic-)/i.test(trimmed)) {
                    phoneCase.style.backgroundImage = trimmed;
                } else {
                    phoneCase.style.backgroundImage = `linear-gradient(${trimmed}, ${trimmed})`;
                    phoneCase.style.backgroundColor = '';
                }
                phoneCase.style.borderRadius = `${caseRadius}px`;
                phoneCase.style.boxShadow = shadow;
            } else {
                phoneCase.style.background = 'transparent';
                phoneCase.style.backgroundImage = 'none';
                phoneCase.style.backgroundColor = 'transparent';
                phoneCase.style.backgroundSize = '';
                phoneCase.style.backgroundPosition = '';
                phoneCase.style.backgroundRepeat = '';
                phoneCase.style.boxShadow = 'none';
                phoneCase.style.borderRadius = '0';
            }
        }

        // 屏幕圆角
        const phoneScreen = document.querySelector('.phone-screen');
        if (phoneScreen) {
            phoneScreen.style.borderRadius = `${screenRadius}px`;
        }

        // 桌面壁纸
        applyScreenWallpaperToDOM(themeRaw);

        console.log('[theme-bridge] __applyEarlyTheme 完成');
    };
}
