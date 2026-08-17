/**
 * 状态栏模块 · 渲染器
 *
 * 提供状态栏设置项的 UI 渲染：
 * - renderStatusBarGroup(ui)        完整的"状态栏"分组（包含所有 row）
 * - renderRowColorPicker(opts)      内嵌的颜色选择 row（左侧 label + 描述，右侧 color + 重置）
 * - renderRowTextField(opts)        内嵌的文本输入 row（左侧 label + 描述，右侧 input）
 *
 * 设计：
 * - 颜色 input 必须有合法 hex 值；当 value 为空时显示一个 fallback（不持久化）。
 * - 颜色变更走 `settings:slider-change` 自定义事件，由 settings app 监听并调用 updateAppearanceField。
 * - 文本字段走 `data-settings-field` + settings app 的 bindInputFieldListener（见 ui-components.js）。
 *
 * 注意：所有用户输入已规范化或不需要 escape（color/hex），UI 标签描述均经过 escapeHtml。
 */

import { escapeHtml } from '@/src/core/escape.js';

import {
    renderGroup,
    renderRow,
} from '../../ui-components.js';

import { getClockMode } from '@/js/apps/setting/world/chronology-clock.js';
import { CLOCK_MODES } from '@/js/apps/setting/world/sdk/chronology/chronology-constants.js';

const COLOR_METHOD = 'updateAppearanceField';
const APP_ID = 'settings';

// 状态栏整体开关的分段选项（复用 case-type-tabs 风格）
const STATUS_BAR_TABS = [
    { id: 'show', label: '显示' },
    { id: 'hide', label: '隐藏' },
];

// 顶部时间显示模式（真实 / 世界观纪时 / 同世界不同地区的时差）
const CLOCK_MODE_TABS = [
    { id: CLOCK_MODES.REAL, label: '真实' },
    { id: CLOCK_MODES.CHRONOLOGY, label: '纪时' },
    { id: CLOCK_MODES.OFFSET, label: '时差' },
];

/**
 * 顶部时间显示模式的分段控件。
 * 走 data-app-action → methods.setStatusBarClockMode(mode)。
 * 模式本身存 localStorage（不是 IndexedDB）—— 状态栏每秒要同步读一次，
 * 详见 js/apps/setting/world/chronology-clock.js 顶部注释。
 */
function renderClockModeSegmentedTabs() {
    const active = getClockMode();
    const tabs = CLOCK_MODE_TABS.map((tab) => {
        const action = {
            action: 'appMethod',
            appId: APP_ID,
            method: 'setStatusBarClockMode',
            payload: { mode: tab.id },
        };
        const actionAttr = ` data-app-action='${escapeHtml(JSON.stringify(action))}'`;
        return `
            <button type="button"
                    class="settings-row__segmented-tab ${tab.id === active ? 'is-active' : ''}"
                    data-clock-mode-tab="${escapeHtml(tab.id)}"${actionAttr}>
                ${escapeHtml(tab.label)}
            </button>
        `;
    }).join('');
    return `<div class="settings-row__segmented-tabs">${tabs}</div>`;
}

/**
 * 渲染状态栏整体开关的分段控件（iPhone 风格）。
 * 与 case-type-tabs 视觉一致：圆角容器 + 等宽分段 + 激活态白底 + 微阴影。
 * 走 data-app-action → methods.setStatusBarVisibility(value)。
 */
function renderStatusBarSegmentedTabs(currentShow) {
    const active = currentShow !== false ? 'show' : 'hide';
    const tabs = STATUS_BAR_TABS.map(tab => {
        const action = { action: 'appMethod', method: 'setStatusBarVisibility', payload: { value: tab.id === 'show' } };
        const actionAttr = ` data-app-action='${escapeHtml(JSON.stringify({ ...action, appId: APP_ID }))}'`;
        return `
            <button type="button"
                    class="settings-row__segmented-tab ${tab.id === active ? 'is-active' : ''}"
                    data-status-bar-tab="${tab.id}"${actionAttr}>
                ${escapeHtml(tab.label)}
            </button>
        `;
    }).join('');
    return `<div class="settings-row__segmented-tabs">${tabs}</div>`;
}

// ============================================
// 主入口
// ============================================

/**
 * 渲染「状态栏」分组。包含：
 *   - 整体状态栏开关（关闭后顶部时间 / 5G / 电池全部隐藏）
 *
 * 颜色字段（时间 / 5G）和 5G 文案替换继续保留。
 * 所有颜色字段为空字符串时表示「跟随 App 默认颜色」（activeApp.statusBarColor）。
 */
export function renderStatusBarGroup(ui) {
    const overallRow = renderRow({
        label: '显示状态栏',
        trailing: renderStatusBarSegmentedTabs(ui.showStatusBar),
    });

    const clockModeRow = renderRow({
        label: '顶部时间',
        trailing: renderClockModeSegmentedTabs(),
    });

    const timeColorPicker = renderRowColorPicker({
        label: '时间颜色',
        value: (typeof ui.statusBarTimeColor === 'string') ? ui.statusBarTimeColor : '',
        field: 'statusBarTimeColor',
    });

    const fiveGColorPicker = renderRowColorPicker({
        label: '5G 颜色',
        value: (typeof ui.statusBarFiveGColor === 'string') ? ui.statusBarFiveGColor : '',
        field: 'statusBarFiveGColor',
    });
    const fiveGTextField = renderRowTextField({
        label: '替换 5G 文案',
        value: (typeof ui.statusBarFiveGLabel === 'string' && ui.statusBarFiveGLabel) ? ui.statusBarFiveGLabel : '5G',
        field: 'statusBarFiveGLabel',
        placeholder: '5G',
    });

    // 信号格已于 2026-08-13 从状态栏彻底移除，这里不再有「信号颜色」。
    const rows = [overallRow, clockModeRow, timeColorPicker, fiveGColorPicker, fiveGTextField];

    const content = rows.join('');

    return renderGroup({
        title: '状态栏',
        content,
        footer: '整体开关不影响灵动岛。颜色字段留空 = 跟随当前 App 状态栏颜色。'
            + '「顶部时间」选纪时 / 时差时，读的是当前世界观里配置的纪时系统；世界观没开纪时会自动显示真实时间。',
    });
}

// ============================================
// 颜色选择 row
// ============================================

/**
 * 一个内嵌的颜色选择 row：左侧 label + 描述，右侧 color picker + 重置按钮。
 * 复用 settings:slider-change 事件协议（见 ui-components.js 的 bindSliderChangeListener）。
 * 「重置」按钮把字段值设为空字符串 → 跟随默认颜色。
 */
function renderRowColorPicker({ label = '', description = '', value = '', field = '' }) {
    // color input 必须有合法 hex 值；当 value 为空时显示一个 fallback（不持久化）。
    const hasValue = (typeof value === 'string' && value.length > 0);
    const safeValue = hasValue && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
        ? value
        : '#111827';
    const descHtml = description
        ? `<div class="settings-row__desc">${escapeHtml(description)}</div>`
        : '';
    const fieldLit = JSON.stringify(field);
    const methodLit = JSON.stringify(COLOR_METHOD);
    const appIdLit = JSON.stringify(APP_ID);
    const onChange = `window.dispatchEvent(new CustomEvent('settings:slider-change', { detail: { field: ${fieldLit}, value: this.value, appId: ${appIdLit}, method: ${methodLit} } }))`;
    const escapedOnChange = onChange.replace(/"/g, '&quot;');

    return `
        <div class="settings-row settings-row--color-row" role="listitem">
            <div class="settings-row__label">${escapeHtml(label)}</div>
            <input class="settings-row__color-input" type="color"
                value="${escapeHtml(safeValue)}"
                onchange="${escapedOnChange}"
            />
        </div>
    `;
}

// ============================================
// 文本输入 row
// ============================================

/**
 * 一个内嵌的文本输入 row：左侧 label + 描述，右侧 text input。
 * 走 data-settings-field + 现有 bindInputFieldListener（见 ui-components.js）。
 */
function renderRowTextField({ label = '', description = '', value = '', field = '', placeholder = '' }) {
    const descHtml = description
        ? `<div class="settings-row__desc">${escapeHtml(description)}</div>`
        : '';
    return `
        <div class="settings-row settings-row--text-row" role="listitem">
            <div class="settings-row__body">
                <div class="settings-row__label">${escapeHtml(label)}</div>
                ${descHtml}
            </div>
            <div class="settings-row__textfield">
                <input class="settings-row__textinput" type="text"
                    data-settings-field="${escapeHtml(`appearance.${field}`)}"
                    value="${escapeHtml(value)}"
                    placeholder="${escapeHtml(placeholder)}"
                    spellcheck="false"
                    autocomplete="off"
                />
            </div>
        </div>
    `;
}

// ============================================
// 滑块 row（用于宽度/高度自定义）
// ============================================

/**
 * 一个内嵌的滑块 row：左侧 label + 描述，下方滑块 + 数值显示。
 * 复用 settings:slider-change 事件协议（滑块拖动时仅更新标签，松开才派发事件）。
 */
function renderRowSlider({ label = '', description = '', value = 0, field = '', min = 0, max = 100, suffix = 'px' }) {
    const numValue = Number(value) || 0;
    const descHtml = description
        ? `<div class="settings-row__desc">${escapeHtml(description)}</div>`
        : '';
    const fieldLit = JSON.stringify(field);
    const methodLit = JSON.stringify(COLOR_METHOD);
    const appIdLit = JSON.stringify(APP_ID);
    const safeValue = Math.max(min, Math.min(max, numValue));
    // 滑块百分比（用于渐变背景）
    const pct = max > min ? Math.round(((safeValue - min) / (max - min)) * 100) : 0;
    const defaultTag = numValue > 0 ? '' : '<span class="settings-row__hint-tag">默认</span>';

    // 滑块样式：渐变背景随滑块位置变化
    const sliderStyle = `background: linear-gradient(to right, var(--settings-color-primary, #007AFF) 0%, var(--settings-color-primary, #007AFF) ${pct}%, var(--settings-color-fill-secondary, #E9E9EB) ${pct}%, var(--settings-color-fill-secondary, #E9E9EB) 100%);`;

    // input 事件只更新数值标签（轻量），change 事件（松手）才派发
    const onInput = `var val=Number(this.value)||0;var max=Number(this.max)||100;var min=Number(this.min)||0;var pct=max>min?Math.round((val-min)/(max-min)*100):0;var lbl=this.parentElement.querySelector('.settings-slider__label');if(lbl){lbl.textContent=val>0?val+'${escapeHtml(suffix)}':'默认';lbl.style.color=val>0?'var(--settings-color-label, #000)':'var(--settings-color-tertiary, #8e8e93)'};this.style.background='linear-gradient(to right, var(--settings-color-primary, #007AFF) 0%, var(--settings-color-primary, #007AFF) '+pct+'%, var(--settings-color-fill-secondary, #E9E9EB) '+pct+'%, var(--settings-color-fill-secondary, #E9E9EB) 100%)';this.dataset.dragging='1'`;
    const onChange = `delete this.dataset.dragging;window.dispatchEvent(new CustomEvent('settings:slider-change', { detail: { field: ${fieldLit}, value: Number(this.value)||0, appId: ${appIdLit}, method: ${methodLit} } }))`;
    const escapedOnInput = onInput.replace(/"/g, '&quot;');
    const escapedOnChange = onChange.replace(/"/g, '&quot;');

    const resetAction = `window.dispatchEvent(new CustomEvent('settings:slider-change', { detail: { field: ${fieldLit}, value: 0, appId: ${appIdLit}, method: ${methodLit} } }))`;
    const escapedResetAction = resetAction.replace(/"/g, '&quot;');

    return `
        <div class="settings-row settings-row--slider-row" role="listitem">
            <div class="settings-row__body">
                <div class="settings-row__label">${escapeHtml(label)}${defaultTag}</div>
                ${descHtml}
            </div>
            <div class="settings-slider">
                <div class="settings-slider__row">
                    <input
                        type="range"
                        class="settings-range"
                        min="${escapeHtml(String(min))}"
                        max="${escapeHtml(String(max))}"
                        step="1"
                        value="${escapeHtml(String(safeValue))}"
                        oninput="${escapedOnInput}"
                        onchange="${escapedOnChange}"
                        style="${sliderStyle}"
                    />
                    <span class="settings-slider__label" style="color: ${numValue > 0 ? 'var(--settings-color-label, #000)' : 'var(--settings-color-tertiary, #8e8e93)'}">${numValue > 0 ? numValue + escapeHtml(suffix) : '默认'}</span>
                    <button type="button"
                        class="settings-row__color-reset"
                        title="重置为默认值"
                        aria-label="重置"
                        onclick="${escapedResetAction}">↺</button>
                </div>
            </div>
        </div>
    `;
}