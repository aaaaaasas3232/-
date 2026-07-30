/**
 * 手机壳模块 · 事件系统
 *
 * 统一处理所有手机壳相关的 DOM 事件：
 * - 类型切换
 * - 颜色选择
 * - 预设应用
 * - 角度调整
 * - 多色管理（添加/删除）
 *
 * 使用事件委托，所有事件绑定到 document 一次
 *
 * 重要：颜色 input / 角度滑块在拖动过程中会持续派发 `input` 事件。
 * 若每次 input 都重建面板或 refreshPhoneApps()，会：
 *   1) 让 <input type="color"> 被销毁重建 → 浏览器原生调色板关闭
 *   2) 让 range 滑块失焦 → 拖不动
 * 因此 input 事件只做「轻量更新」（改 state + 改预览 style），
 * change 事件（用户松手 / 关闭调色板时触发）才走完整 apply + refreshPhoneApps。
 */

import {
    getState,
    setState,
    buildBackground,
    normalizeHex,
    parseGradient,
} from './state.js';
import { buildGradient, buildMultiGradient } from './state.js';
import { renderPreview, renderTypeToggle, renderColorPanel } from './renderer.js';

// ============================================
// 防抖工具
// ============================================

const _timers = {};

function debounce(key, fn, delay = 16) {
    if (_timers[key]) clearTimeout(_timers[key]);
    _timers[key] = setTimeout(() => {
        fn();
        delete _timers[key];
    }, delay);
}

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
// DOM 更新（轻量：仅改 style，不重建 DOM）
// ============================================

/**
 * 仅更新预览框的 background，避免重建 DOM 打断 input[type=color] / range。
 */
function updatePreviewStyle() {
    const container = document.getElementById('case-preview');
    if (!container) return;
    container.style.background = buildBackground(getState());
}

/**
 * 轻量更新：state 变更 → 同步预览 + 通知外部 onChange。
 * 不会触发面板重建 / refreshPhoneApps，专用于 input 事件。
 */
function applyLightweight() {
    updatePreviewStyle();
    _onChange?.(getState());
}

/**
 * 更新颜色面板内单个 color preview 小色块（不重建 input）。
 */
function updateColorSwatch(index, color) {
    // 双色 / 多色面板里的色块
    const wrapper = document.querySelector(
        `.case-color-input[data-color-index="${index}"]`
    );
    if (wrapper) {
        const swatch = wrapper.parentElement?.querySelector('.case-color-preview');
        if (swatch) swatch.style.background = color;
    }
    // 纯色面板：自定义色块跟着变（如果存在）
    const customInput = document.querySelector('.case-color-input[data-field="customColor"]');
    if (customInput && index === 0) {
        const swatch = customInput.parentElement?.querySelector('.case-color-preview');
        if (swatch) swatch.style.background = color;
    }
}

/**
 * 更新多色面板的整体预览条。
 */
function updateMultiPreviewStyle() {
    const preview = document.querySelector('.case-multi-preview');
    if (!preview) return;
    const state = getState();
    preview.style.background = `linear-gradient(${state.angle || 135}deg, ${state.colors.map(normalizeHex).join(', ')})`;
}

/**
 * 更新角度按钮高亮。
 */
function updateAngleButtons() {
    const state = getState();
    document.querySelectorAll('.case-angle-btn').forEach(btn => {
        const v = parseInt(btn.dataset.angle, 10);
        btn.classList.toggle('is-active', v === state.angle);
    });
}

// ============================================
// DOM 更新（重量：重建面板，仅用于结构性变化）
// ============================================

function refreshUI() {
    updatePreview();
    updateTypeToggle();
    updateColorPanel();
    _onChange?.(getState());
}

function triggerApply() {
    const state = getState();
    _onChange?.(state);
    _onApply?.(state);
}

// ============================================
// 事件处理
// ============================================

function handleTypeChange(newType) {
    const state = getState();

    if (newType === 'solid') {
        setState({
            type: 'solid',
            colors: [state.colors[0] || '#f6d3e0'],
        });
    } else if (newType === 'gradient') {
        const colors = [...state.colors];
        while (colors.length < 2) colors.push('#b4d7f2');
        setState({
            type: 'gradient',
            colors: colors.slice(0, 2),
        });
    } else if (newType === 'multi') {
        const colors = [...state.colors];
        while (colors.length < 3) colors.push(generateRandomColor());
        setState({
            type: 'multi',
            colors: colors.slice(0, 8),
        });
    }

    // 结构性变化 → 完整刷新
    refreshUI();
    triggerApply();
}

function handleColorSelect(color, index = null, options = {}) {
    const { lightweight = false } = options;
    const state = getState();
    const normalizedColor = normalizeHex(color);

    if (index !== null && Array.isArray(state.colors)) {
        const newColors = [...state.colors];
        newColors[index] = normalizedColor;
        setState({ colors: newColors });
    } else {
        setState({ colors: [normalizedColor] });
    }

    if (lightweight) {
        // 拖调色板过程中：仅改预览 + 通知 onChange，不重建 DOM
        applyLightweight();
        // 同步小色块（双色 / 多色面板里有 color-preview 色块）
        if (index !== null) {
            updateColorSwatch(index, normalizedColor);
            updateMultiPreviewStyle();
        }
    } else {
        debounce('ui-update', refreshUI, 16);
        triggerApply();
    }
}

function handlePresetApply(preset) {
    if (preset.type === 'solid') {
        setState({
            type: 'solid',
            colors: [preset.value],
            presetId: preset.id,
        });
    } else if (preset.type === 'gradient') {
        const parsed = parseGradient(preset.value);
        if (parsed) {
            setState({
                type: 'gradient',
                colors: parsed.colors.map(normalizeHex),
                angle: parsed.angle,
                presetId: preset.id,
            });
        }
    } else if (preset.type === 'multi') {
        setState({
            type: 'multi',
            colors: preset.colors.map(normalizeHex),
            angle: preset.angle,
            presetId: preset.id,
        });
    }

    refreshUI();
    triggerApply();
}

function handleAngleChange(angle, options = {}) {
    const { lightweight = false } = options;
    const clampedAngle = Math.max(0, Math.min(360, parseInt(angle, 10) || 0));
    setState({ angle: clampedAngle });

    if (lightweight) {
        // 拖动滑块时只更新预览 / 多色预览条 / 角度按钮高亮
        applyLightweight();
        updateMultiPreviewStyle();
        updateAngleButtons();
    } else {
        debounce('ui-update', refreshUI, 16);
        triggerApply();
    }
}

function handleAddColor() {
    const state = getState();
    if (state.colors.length >= 8) return;

    const newColors = [...state.colors, generateRandomColor()];
    setState({ colors: newColors });

    refreshUI();
    triggerApply();
}

function handleRemoveColor(index) {
    const state = getState();
    if (state.colors.length <= 2) return;

    const newColors = state.colors.filter((_, i) => i !== index);
    setState({ colors: newColors });

    refreshUI();
    triggerApply();
}

// ============================================
// 主事件处理
// ============================================

function handleClick(e) {
    const target = e.target;

    const typeTab = target.closest('.case-type-tab');
    if (typeTab) {
        const newType = typeTab.dataset.caseType;
        if (newType) handleTypeChange(newType);
        return;
    }

    const presetBtn = target.closest('.case-preset-btn, .case-palette__cell');
    if (presetBtn) {
        handleColorSelect(presetBtn.dataset.color);
        return;
    }

    const gradPreset = target.closest('.case-gradient-preset');
    if (gradPreset) {
        const value = gradPreset.dataset.gradient;
        const parsed = parseGradient(value);
        if (parsed) {
            handlePresetApply({
                type: 'gradient',
                value,
                colors: parsed.colors,
                angle: parsed.angle,
                id: gradPreset.dataset.presetId,
            });
        }
        return;
    }

    const multiPreset = target.closest('.case-multi-preset');
    if (multiPreset) {
        const colors = multiPreset.dataset.colors.split('|');
        const angle = parseInt(multiPreset.dataset.angle, 10) || 135;
        handlePresetApply({
            type: 'multi',
            colors,
            angle,
            id: multiPreset.dataset.presetId,
        });
        return;
    }

    const angleBtn = target.closest('.case-angle-btn');
    if (angleBtn) {
        // 角度预设按钮是离散点击，走完整 apply
        handleAngleChange(angleBtn.dataset.angle);
        return;
    }

    const addColorBtn = target.closest('.case-multi-color-add');
    if (addColorBtn) {
        handleAddColor();
        return;
    }

    const removeColorBtn = target.closest('.case-multi-color-remove');
    if (removeColorBtn && !removeColorBtn.disabled) {
        handleRemoveColor(parseInt(removeColorBtn.dataset.colorIndex, 10));
        return;
    }
}

/**
 * input 事件：用户正在拖动 / 调色时。
 * 只做轻量更新，不重建 DOM、不 refreshPhoneApps。
 */
function handleInput(e) {
    const target = e.target;

    if (target.matches('.case-color-input')) {
        const index = target.dataset.colorIndex !== undefined
            ? parseInt(target.dataset.colorIndex, 10)
            : null;
        handleColorSelect(target.value, index, { lightweight: true });
        return;
    }

    if (target.matches('.case-angle-slider')) {
        handleAngleChange(target.value, { lightweight: true });
        return;
    }
}

/**
 * change 事件：用户松手 / 关闭原生调色板时。
 * 此时才走完整 apply + refreshPhoneApps。
 *
 * 注意：原生 <input type="color"> 的 change 在用户点确定（或拖动松开）时触发，
 * ESC 取消也会触发 change（值为取消前的值）。这正是我们想要的「最终提交」语义。
 */
function handleChange(e) {
    const target = e.target;

    if (target.matches('.case-color-input')) {
        const index = target.dataset.colorIndex !== undefined
            ? parseInt(target.dataset.colorIndex, 10)
            : null;
        // 用最新的 value 再 apply 一次，走完整路径
        handleColorSelect(target.value, index);
        return;
    }

    if (target.matches('.case-angle-slider')) {
        handleAngleChange(target.value);
        return;
    }
}

// ============================================
// 初始化
// ============================================

let _initialized = false;

export function initEventHandlers() {
    if (_initialized) return;
    _initialized = true;

    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleChange, true);
}

export function destroyEventHandlers() {
    if (!_initialized) return;
    _initialized = false;

    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('input', handleInput, true);
    document.removeEventListener('change', handleChange, true);

    Object.keys(_timers).forEach(key => {
        clearTimeout(_timers[key]);
        delete _timers[key];
    });
}

// ============================================
// 工具函数
// ============================================

function generateRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// ============================================
// 重量级 DOM 更新（仅用于结构性变化）
// ============================================

function updatePreview() {
    const container = document.getElementById('case-preview');
    if (!container) return;

    const state = getState();
    const previewHtml = renderPreview(state);
    container.outerHTML = previewHtml;
}

function updateTypeToggle() {
    const container = document.querySelector('.case-type-tabs');
    if (!container) return;

    const state = getState();
    const html = renderTypeToggle(state);
    container.outerHTML = html;
}

function updateColorPanel() {
    const container = document.querySelector('.case-picker-section');
    if (!container) return;

    const state = getState();
    const html = renderColorPanel(state);
    container.outerHTML = html;
}