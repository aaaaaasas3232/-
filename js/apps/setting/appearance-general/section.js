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
    // 序列化
    serialize as serializeCaseState,
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

import { applyDeviceTheme } from './theme-bridge.js';

const COLOR_METHOD = 'updateAppearanceField';
const APP_ID = 'settings';

function pct(value) {
    return Math.round((Number(value) || 0) * 100);
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
    const capacityPct = pct(ui.batteryCapacity);
    const capacitySlider = renderSlider({
        min: 0,
        max: 100,
        step: 5,
        value: capacityPct,
        field: 'batteryCapacity',
        method: COLOR_METHOD,
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
                title: '显示',
                content: hideCaseRow,
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
        statusBarSignalColor: app.state.ui.appearance.statusBarSignalColor,
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
