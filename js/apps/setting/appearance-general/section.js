/**
 * 设置 App · 外观与通用 · 渲染 detail 页
 *
 * 重构设计理念：
 * 1. 手机壳 DIY 作为独立模块：状态 + 预设 + 预览 + 交互
 * 2. 清晰的分组结构：手机壳 / 屏幕 / 电池 / 显示
 * 3. 实时预览：手机壳编辑时即时看到效果
 * 4. 响应式交互：所有操作实时反馈
 *
 * 手机壳 UI 设计：
 * - 紧凑横向标签切换（纯色 | 渐变 | 多色）
 * - 颜色选择用小圆点/药丸条，精致不占空间
 * - 所有颜色模式都在同一个面板内切换，无需重新渲染整个 section
 *
 * 状态栏（phone-statusbar）相关渲染已抽到独立模块，本文件只负责组装。
 */

import { escapeHtml } from '@/src/core/escape.js';

import {
    renderGroup,
    renderChipGroup,
    renderSlider,
    renderRow,
    renderSwitch,
    renderSaveBar,
} from '../ui-components.js';

import {
    APPEARANCE_STORE_NAME,
    APPEARANCE_DB_KEY,
} from './defaults.js';

import {
    DESKTOP_GRID_ROWS_OPTIONS,
    clampDesktopGridRows,
} from './theme-bridge.js';

// 手机壳模块（新版）
import {
    // 状态
    getState,
    setState,
    buildBackground,
    deserialize,
    // 渲染
    renderDIYPanel,
    // 事件
    initEventHandlers,
    setOnChange,
    setOnApply,
} from './phone-case/index.js';

// 屏幕墙纸模块（新增）
import {
    getState as getScreenWallpaperState,
    setState as setScreenWallpaperState,
    deserialize as deserializeScreenWallpaper,
    serialize as serializeScreenWallpaperState,
    renderDiyPanel as renderScreenWallpaperPanel,
    initEventHandlers as initScreenWallpaperEventHandlers,
    setOnChange as setScreenWallpaperOnChange,
    setOnApply as setScreenWallpaperOnApply,
    syncBlurSliders as syncScreenWallpaperBlurSliders,
} from './phone-screenwallpaper/index.js';

// 状态栏模块（新增）
import {
    renderStatusBarGroup,
    initEventHandlers as initStatusBarEventHandlers,
    applyExternalState as applyStatusBarExternalState,
} from './phone-statusbar/index.js';

import {
    applyDeviceTheme,
    PHONE_HEIGHT_MIN,
    PHONE_HEIGHT_MAX,
    PHONE_HEIGHT_DEFAULT,
    PHONE_Y_OFFSET_MIN,
    PHONE_Y_OFFSET_MAX,
    PHONE_Y_OFFSET_DEFAULT,
} from './theme-bridge.js';

const COLOR_METHOD = 'updateAppearanceField';
const APP_ID = 'settings';

function pct(value) {
    return Math.round((Number(value) || 0) * 100);
}

/**
 * 把当前 app.state.ui.appearance 写入 IndexedDB（deviceSettings::device-theme）。
 * 之前只有用户主动点保存按钮才会写，导致外观设置在手机端不持久化。
 * 现在所有 onApply 回调都不再依赖手动保存。
 */
function persistAppearance(app) {
    if (!app || !app.state || !app.state.ui || !app.state.ui.appearance) return;
    const ui = { ...app.state.ui.appearance };
    const db = app.toolkit && app.toolkit.db;
    if (!db || !db.put) return;
    db.put(APPEARANCE_STORE_NAME, {
        key: APPEARANCE_DB_KEY,
        ...ui,
        updatedAt: Date.now(),
    }).catch((err) => {
        console.warn('[settings] 外观设置自动保存失败', err);
    });
}

// ============================================
// 手机壳渲染
// ============================================

/**
 * 渲染手机壳 DIY 区域
 */
function renderPhoneCaseDIY() {
    const state = getState();
    return renderDIYPanel(state);
}

/**
 * 渲染屏幕墙纸 DIY 区域（精致紧凑版，与手机壳视觉风格保持一致）
 */
function renderScreenWallpaperDIY() {
    const state = getScreenWallpaperState();
    return renderScreenWallpaperPanel(state);
}

// ============================================
// 桌面网格选择（列数 / 行数）
// ============================================

/**
 * 渲染「桌面网格」分组：只暴露「行数」（3~8）的数字按钮选择器。
 * 列数固定为 4，不再开放自定义 —— 用户说「去掉列的自定义」。
 * 每个按钮都是一个独立 appMethod 调用 —— 不会因为 slider 拖动产生高频更新。
 */
function renderDesktopGridPicker(ui) {
    const currentRows = clampDesktopGridRows(ui.desktopGridRows);

    const rowsChips = DESKTOP_GRID_ROWS_OPTIONS.map(value => ({
        label: String(value),
        value,
    }));

    const rowsRow = renderRow({
        label: '行数',
        trailing: renderChipGroup({
            presets: rowsChips,
            currentValue: currentRows,
            mod: 'square',
            toAction: (preset) => ({
                action: 'appMethod',
                method: 'updateAppearanceField',
                payload: { field: 'desktopGridRows', value: preset.value },
            }),
        }),
    });

    return `
        <div class="settings-stack">
            ${rowsRow}
        </div>
    `;
}

// ============================================
// 主渲染函数
// ============================================

export function renderAppearanceSection(app) {
    const ui = app.state.ui.appearance;
    const savedAt = app.state.savedAt.appearance;

    // 初始化手机壳模块
    initAppearanceSection(app);

    // ---- 手机壳 ----
    const phoneCaseContent = renderPhoneCaseDIY();

    // ---- 屏幕墙纸 ----
    const screenWallpaperContent = renderScreenWallpaperDIY();

    // ---- 电池颜色 ----（只保留自定义颜色输入，不显示预设）
    const batteryColorPicker = renderBatteryColorPicker({
        value: (typeof ui.batteryColor === 'string' && ui.batteryColor) ? ui.batteryColor : '#73AE52',
        field: 'batteryColor',
    });

    // ---- 电量 ----
    // ★ 电量绑定给氧气（blog）期间，整个调节条 div 消失，换成一行说明；
    //   解除绑定后（batteryUnbind）调节条原样恢复。绑定状态由氧气通过
    //   settings 的 batteryBridge 服务写入 device-theme 记录。
    const batteryBoundByOxygen = ui.batteryBoundByOxygen === true;
    const capacityPct = pct(ui.batteryCapacity);
    const capacitySlider = batteryBoundByOxygen
        ? '<div class="battery-oxygen-note">电量已交给氧气。解除绑定后可手动调节。</div>'
        : renderSlider({
            min: 0,
            max: 100,
            step: 5,
            value: capacityPct,
            field: 'batteryCapacity',
            method: COLOR_METHOD,
        });

    // ---- 高度拉条（始终可调，450-720）----
    const phoneHeightPx = Math.max(
        PHONE_HEIGHT_MIN,
        Math.min(
            PHONE_HEIGHT_MAX,
            Number.isFinite(Number(ui.phoneHeight)) ? Math.round(Number(ui.phoneHeight)) : PHONE_HEIGHT_DEFAULT
        )
    );
    const phoneHeightRow = renderRow({
        label: '手机高度',
        trailing: renderSlider({
            min: PHONE_HEIGHT_MIN,
            max: PHONE_HEIGHT_MAX,
            step: 1,
            value: phoneHeightPx,
            field: 'phoneHeight',
            method: COLOR_METHOD,
        }),
    });

    // ---- 桌面网格（列数 4/5，行数 3~8）—— 紧贴「手机高度」下方，方便一起调节整体比例
    const desktopGridPicker = renderDesktopGridPicker(ui);

    // ---- 垂直位置拉条（始终可调，-100 ~ +100）----
    const phoneYOffsetPx = Math.max(
        PHONE_Y_OFFSET_MIN,
        Math.min(
            PHONE_Y_OFFSET_MAX,
            Number.isFinite(Number(ui.phoneYOffset)) ? Math.round(Number(ui.phoneYOffset)) : PHONE_Y_OFFSET_DEFAULT
        )
    );
    const phoneYOffsetRow = renderRow({
        label: '垂直位置',
        trailing: renderSlider({
            min: PHONE_Y_OFFSET_MIN,
            max: PHONE_Y_OFFSET_MAX,
            step: 1,
            value: phoneYOffsetPx,
            field: 'phoneYOffset',
            method: COLOR_METHOD,
        }),
    });

    // ---- 开关行 ----
    const hideCaseRow = renderRow({
        label: '隐藏手机壳',
        trailing: renderSwitch({
            on: ui.hideCase,
            action: { action: 'appMethod', method: 'toggleCaseHidden' },
        }),
    });

    // ---- 状态栏（独立模块）----
    const statusBarSection = renderStatusBarGroup(ui);

    return `
        <div class="settings-appearance">
            ${renderGroup({
                title: '手机壳',
                content: phoneCaseContent,
                footer: '点击颜色即时应用。',
            })}

            ${renderGroup({
                title: '屏幕墙纸',
                content: screenWallpaperContent,
                footer: '点击颜色即时应用。',
            })}

            ${renderGroup({
                title: '电池',
                content: `
                    <div class="settings-stack">
                        ${batteryColorPicker}
                        ${capacitySlider}
                    </div>
                `,
                footer: '电池颜色同时影响顶部状态栏电池填充。',
            })}

            ${statusBarSection}

            ${renderGroup({
                content: phoneHeightRow,
                footer: `当前 ${phoneHeightPx}px（${PHONE_HEIGHT_MIN}-${PHONE_HEIGHT_MAX}）`,
            })}

            ${renderGroup({
                content: phoneYOffsetRow,
                footer: `当前偏移 ${phoneYOffsetPx}px（${PHONE_Y_OFFSET_MIN}~${PHONE_Y_OFFSET_MAX}，负数上移）`,
            })}

            ${renderGroup({
                title: '桌面网格',
                content: desktopGridPicker,
                footer: '行数可在 3~8 之间任选；只改排布，不会重置你的桌面图标和小组件。',
            })}

            ${renderGroup({
                content: hideCaseRow,
                footer: '隐藏后由全屏模式接管高度。',
            })}

            ${renderSaveBar({
                saveMethod: 'saveAppearance',
                resetMethod: 'resetAppearance',
                saveLabel: '保存外观',
                resetLabel: '恢复默认',
                savedAt,
            })}
        </div>
    `;
}

// ============================================
// 初始化
// ============================================

let _sectionInitialized = false;

function initAppearanceSection(app) {
    if (_sectionInitialized) return;
    _sectionInitialized = true;

    // 初始化手机壳事件处理
    initEventHandlers();

    // 设置变更回调（UI 变化时）
    setOnChange((state) => {
        // 同步到 app state
        if (app && app.state && app.state.ui) {
            app.state.ui.appearance.caseColor = buildBackground(state);
            app.state.ui.appearance.caseRadius = 50; // 可以后续添加圆角控制
            app.state.ui.appearance.caseShadow = '0 20px 45px rgba(0, 0, 0, 0.25)';
        }
    });

    // 设置应用回调（需要应用主题时）
    setOnApply((state) => {
        const bg = buildBackground(state);
        if (app && app.state && app.state.ui) {
            app.state.ui.appearance.caseColor = bg;
        }
        // 实时应用主题
        if (app) {
            applyDeviceTheme(app.state.ui.appearance);
            window.refreshPhoneApps?.();
            persistAppearance(app);
        }
    });

    // 从 appearance 状态恢复手机壳状态
    if (app.state.ui.appearance.caseColor) {
        const caseColor = app.state.ui.appearance.caseColor;
        const parsed = deserialize(caseColor);
        setState(parsed);
    }

    // ---- 屏幕墙纸模块 ----
    initScreenWallpaperEventHandlers();

    setScreenWallpaperOnChange((wpState) => {
        if (app && app.state && app.state.ui) {
            app.state.ui.appearance.screenWallpaper = serializeScreenWallpaperState(wpState);
        }
    });

    setScreenWallpaperOnApply((wpState) => {
        if (app && app.state && app.state.ui) {
            app.state.ui.appearance.screenWallpaper = serializeScreenWallpaperState(wpState);
            applyDeviceTheme(app.state.ui.appearance);
            window.refreshPhoneApps?.();
            persistAppearance(app);
        }
    });

    // 从 appearance 状态恢复屏幕墙纸状态
    if (app.state.ui.appearance.screenWallpaper) {
        setScreenWallpaperState(
            deserializeScreenWallpaper(app.state.ui.appearance.screenWallpaper)
        );
    } else {
        setScreenWallpaperState(deserializeScreenWallpaper(null));
    }
    // 同步滑块进度条到当前 state.blur（v-html 注入需在下一帧才完成）
    requestAnimationFrame(() => syncScreenWallpaperBlurSliders());

    // ---- 状态栏模块（无事件，仅恢复 state）----
    initStatusBarEventHandlers();
    applyStatusBarExternalState({
        showStatusBar: app.state.ui.appearance.showStatusBar,
        statusBarTimeColor: app.state.ui.appearance.statusBarTimeColor,
        statusBarFiveGColor: app.state.ui.appearance.statusBarFiveGColor,
        statusBarFiveGLabel: app.state.ui.appearance.statusBarFiveGLabel,
    });
}

// ============================================
// 辅助函数
// ============================================

/**
 * 渲染电池颜色选择器（只保留自定义颜色输入框，无预设）
 */
function renderBatteryColorPicker({ value }) {
    const safeValue = (typeof value === 'string' && value) ? value : '#73AE52';
    const fieldLit = JSON.stringify('batteryColor');
    const methodLit = JSON.stringify(COLOR_METHOD);
    const appIdLit = JSON.stringify(APP_ID);
    // 使用单引号包裹 JavaScript 字符串，对 HTML 属性中的双引号用实体转义
    // 注意：不要用 escapeHtml 处理代码字符串，否则括号会被转义导致代码无法执行
    // 重要：原生 <input type="color"> 在拖动调色板过程中会持续派发 input 事件，
    // 若每次都 dispatch settings:slider-change → updateAppearanceField → applyDeviceTheme + refreshPhoneApps()，
    // 会 (1) 让色板失焦/关闭，(2) 整个 App 重新 mount，体验极差。
    // 因此 input 事件只更新本地预览色块（轻量），change 事件才真正派发 slider-change。
    const onInput = `if(this.style){this.dataset.dragging='1'}`;
    const onChange = `delete this.dataset.dragging;window.dispatchEvent(new CustomEvent('settings:slider-change', { detail: { field: ${fieldLit}, value: this.value, appId: ${appIdLit}, method: ${methodLit} } }))`;
    // HTML 属性用单引号包裹，属性值中的双引号用 &quot; 转义
    const escapedOnInput = onInput.replace(/"/g, '&quot;');
    const escapedOnChange = onChange.replace(/"/g, '&quot;');

    return `
        <div class="settings-colorpicker">
            <span class="settings-colorpicker__label">自定义</span>
            <input class="settings-colorpicker__input" type="color"
                value="${escapeHtml(safeValue)}"
                oninput="${escapedOnInput}"
                onchange="${escapedOnChange}"
            />
        </div>
    `;
}
