/**
 * 屏幕墙纸模块 · 事件系统
 *
 * 屏幕墙纸支持：
 * - 图片上传（FileReader → data URL）
 * - 图片 URL 应用
 * - 模糊度（blur）滑块，0-20
 *
 * 使用事件委托，所有事件绑定到 document 一次。
 *
 * 与 phone-case 一致：input 事件只做轻量更新（不动 DOM 结构 / 不 refreshPhoneApps），
 * change 事件才走完整 apply + refreshPhoneApps，拖滑块时不丢焦。
 */

import {
    getState,
    setState,
    buildWallpaper,
} from './state.js';
import { renderImagePicker } from './renderer.js';

const BLUR_MIN = 0;
const BLUR_MAX = 20;

function clampBlur(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.min(BLUR_MAX, Math.max(BLUR_MIN, Math.round(n)));
}

function blurPercent(value) {
    const span = BLUR_MAX - BLUR_MIN;
    if (span <= 0) return 0;
    return ((clampBlur(value) - BLUR_MIN) / span) * 100;
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
// 轻量 DOM 更新（仅改 style / 进度条，不重建 DOM）
// ============================================

function updatePreviewStyle() {
    const container = document.getElementById('screen-wallpaper-preview');
    if (!container) return;
    const state = getState();
    const bg = buildWallpaper(state);

    container.style.backgroundColor = bg.startsWith('url(') ? 'transparent' : bg;
    container.style.backgroundImage = bg;
    container.style.backgroundSize = 'cover';
    container.style.backgroundPosition = 'center';
    container.style.backgroundRepeat = 'no-repeat';

    const screenEl = container.querySelector('.sw-preview__screen');
    if (screenEl) {
        if (bg.startsWith('url(')) {
            screenEl.style.backgroundImage = bg;
            screenEl.style.backgroundColor = 'transparent';
        } else {
            screenEl.style.backgroundColor = bg;
            screenEl.style.backgroundImage = 'none';
        }
        screenEl.style.filter = `blur(${clampBlur(state?.blur)}px)`;
    }
}

/**
 * 仅同步滑块轨道进度（CSS 变量 --sw-pct 由 .sw-slider 轨道线性背景消费），
 * 不重建 DOM，避免拖滑块时失焦。
 */
function updateSliderProgress(sliderEl) {
    if (!sliderEl) return;
    const pct = blurPercent(sliderEl.value);
    sliderEl.style.setProperty('--sw-pct', `${pct}%`);
}

// ============================================
// 业务事件处理
// ============================================

function triggerApply() {
    const state = getState();
    _onChange?.(state);
    _onApply?.(state);
}

/** 把 File 读成 data URL。失败 → null */
function readFileAsDataUrl(file) {
    return new Promise((resolve) => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        // 用 readAsDataURL：base64 内联到 state，自包含、跨页面持久化没问题。
        reader.readAsDataURL(file);
    });
}

async function handleImageUpload(inputEl) {
    const file = inputEl.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    if (!dataUrl) return;

    setState({
        type: 'image',
        imageUrl: dataUrl,
        imageSource: 'local',
        presetId: null,
    });

    // 结构性变化：刷新图片面板，让预览缩略图、按钮状态同步
    refreshImagePanel();
    updatePreviewStyle();
    triggerApply();
}

function handleImageUrlApply(inputEl) {
    const url = (inputEl.value || '').trim();
    if (!url) return;
    setState({
        type: 'image',
        imageUrl: url,
        imageSource: 'url',
        presetId: null,
    });
    refreshImagePanel();
    updatePreviewStyle();
    triggerApply();
}

/**
 * input 事件（拖滑块时连续派发）：仅改 state + 同步预览 filter + 滑块进度。
 * 不重建 DOM、不 refreshPhoneApps，避免失焦与重渲染抖动。
 */
function handleBlurInput(sliderEl) {
    const blur = clampBlur(sliderEl.value);
    setState({ blur });
    updateSliderProgress(sliderEl);
    updatePreviewStyle();
}

/**
 * change 事件（用户松手 / 键盘调整结束）：走完整 apply 路径，持久化 + 主题桥应用。
 */
function handleBlurChange(sliderEl) {
    const blur = clampBlur(sliderEl.value);
    setState({ blur });
    updateSliderProgress(sliderEl);
    updatePreviewStyle();
    triggerApply();
}

/**
 * 把当前 state.blur 同步到所有现有 .sw-slider[data-field="blur"] 的进度条上。
 * 用于初次挂载 / 外部重置 state 后刷新 UI。
 */
export function syncBlurSliders() {
    const state = getState();
    const blur = clampBlur(state?.blur);
    document.querySelectorAll('.sw-slider[data-field="blur"]').forEach(slider => {
        if (slider.value !== String(blur)) slider.value = String(blur);
        updateSliderProgress(slider);
    });
}

// ============================================
// 重量级 DOM 重建（结构变化）
// ============================================

function refreshImagePanel() {
    const container = document.querySelector('.sw-picker-section');
    if (container) {
        const state = getState();
        container.outerHTML = renderImagePicker(state);
    }
}

// ============================================
// 主事件处理
// ============================================

function handleClick(e) {
    const target = e.target;

    const applyUrlBtn = target.closest('[data-action="apply-url"]');
    if (applyUrlBtn) {
        const wrap = applyUrlBtn.closest('.sw-image-url-row');
        const input = wrap?.querySelector('.sw-image-url-input');
        if (input) handleImageUrlApply(input);
        return;
    }
}

function handleChange(e) {
    const target = e.target;

    if (target.matches('.sw-file-input')) {
        handleImageUpload(target);
        // 让 input 可以再次上传同一文件
        target.value = '';
        return;
    }

    if (target.matches('.sw-slider') && target.dataset?.field === 'blur') {
        handleBlurChange(target);
        return;
    }
}

function handleInput(e) {
    // 用户要求：拖动期间不渲染，只在 change 时再渲染。
    // 屏幕墙纸 blur 滑条同理——拖动时不动 state、不调 applyLightweight，避免 Vue 重渲染。
    return;
}

// ============================================
// 初始化
// ============================================

let _initialized = false;

export function initEventHandlers() {
    if (_initialized) return;
    _initialized = true;

    document.addEventListener('click', handleClick, true);
    document.addEventListener('change', handleChange, true);
    document.addEventListener('input', handleInput, true);
}

export function destroyEventHandlers() {
    if (!_initialized) return;
    _initialized = false;

    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('change', handleChange, true);
    document.removeEventListener('input', handleInput, true);
}
