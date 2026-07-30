/**
 * 通用 ColorPicker 组件（v4 · 永远显示切换 + CSS 显隐 + 无 DOM 替换）
 *
 * 导出：
 *   - renderColorPickerMount(options) → string  直接渲染到 v-html 里
 *   - installColorPickerAutoMount()              启动后挂载全局事件委托
 *
 * 关键设计：
 *   - presetsByMode 时，两套 preset 都渲染进 HTML，用 CSS .is-[mode] 控制显隐
 *   - 模式切换只改 data-cp-mode + className，不 replaceWith，事件绑定不丢失
 *   - custom editor：无多余 preview span，直接是 color input + hex text
 *
 * 协议：
 *   - root: data-cp-onchange="appId:methodName" / data-cp-field / data-cp-mode / data-cp-value
 *   - 事件派发到 window.dispatchEvent(new CustomEvent('app:page-action', { detail }))
 */

const TEMPLATES = [];

// =============================================
// helpers
// =============================================

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isGradient(value) {
    return typeof value === 'string' && /^(linear-|radial-|conic-)/i.test(value.trim());
}

function parseLinearGradient(value) {
    if (typeof value !== 'string') return null;
    const m = value.match(/linear-gradient\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/i);
    if (!m) return null;
    let angle = m[1].trim();
    if (/^-?\d+(\.\d+)?(deg|rad|turn)$/i.test(angle)) {
        const deg = parseFloat(angle);
        if (/rad$/i.test(angle)) angle = `${(deg * 180 / Math.PI).toFixed(0)}deg`;
        else if (/turn$/i.test(angle)) angle = `${(deg * 360).toFixed(0)}deg`;
    } else {
        angle = '135deg';
    }
    return { angle, start: m[2].trim(), end: m[3].trim() };
}

function normalizeHex(value, fallback = '#000000') {
    if (typeof value !== 'string') return fallback;
    const v = value.trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) {
        if (/^#[0-9a-f]{3}$/i.test(v)) {
            return '#' + v.slice(1).split('').map(c => c + c).join('');
        }
        return v;
    }
    const rgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgb) {
        const hex = (n) => Number(n).toString(16).padStart(2, '0');
        return '#' + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
    }
    return fallback;
}

function buildGradient({ angle = '135deg', start = '#f6d3e0', end = '#b4d7f2' }) {
    const s = normalizeHex(start, '#f6d3e0');
    const e = normalizeHex(end, '#b4d7f2');
    return `linear-gradient(${String(angle || '135deg').trim() || '135deg'}, ${s} 0%, ${e} 100%)`;
}

function valueEquals(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

// =============================================
// HTML 渲染
// =============================================

function renderChip({ preset, active }) {
    return `
        <button type="button" class="cp-chip__btn ${active ? 'is-active' : ''}"
            data-cp-preset='${escapeHtml(JSON.stringify(preset))}'>
            <span class="cp-chip__swatch" style="background:${escapeHtml(preset.value)}"></span>
        </button>
    `;
}

/**
 * 模式切换 tab
 */
function renderModeToggle({ activeMode }) {
    return `
        <div class="cp-mode">
            <button type="button" class="cp-mode__btn ${activeMode === 'solid' ? 'is-active' : ''}"
                data-cp-set-mode="solid">单色</button>
            <button type="button" class="cp-mode__btn ${activeMode === 'gradient' ? 'is-active' : ''}"
                data-cp-set-mode="gradient">渐变</button>
        </div>
    `;
}

/**
 * 渲染模式切换按钮（供外部调用）
 * @param {object} opts
 * @param {string} opts.activeMode - 当前激活的模式：'solid' | 'gradient'
 * @param {string} [opts.field] - 关联的字段名（用于查找对应的 .cp 元素）
 * @returns {string} HTML 字符串
 */
export function renderCaseModeToggle({ activeMode = 'solid', field = '' } = {}) {
    const fieldAttr = field ? `data-cp-target-field="${escapeHtml(field)}"` : '';
    return `
        <div class="cp-mode" ${fieldAttr}>
            <button type="button" class="cp-mode__btn ${activeMode === 'solid' ? 'is-active' : ''}"
                data-cp-set-mode="solid">单色</button>
            <button type="button" class="cp-mode__btn ${activeMode === 'gradient' ? 'is-active' : ''}"
                data-cp-set-mode="gradient">渐变</button>
        </div>
    `;
}

/**
 * custom editor for solid mode
 */
function renderSolidCustom({ hex }) {
    return `
        <div class="cp-custom cp-custom--solid" data-cp-section="solid">
            <div class="cp-custom__swatch-wrap" data-cp-swatch-trigger>
                <span class="cp-custom__swatch" id="cp-swatch-solid" style="background:${escapeHtml(hex)}"></span>
                <input type="color" class="cp-custom__native-color"
                    data-cp-key="color" value="${escapeHtml(hex)}" tabindex="-1" />
            </div>
            <input type="text" class="cp-custom__hex"
                data-cp-key="hex" value="${escapeHtml(hex)}"
                spellcheck="false" maxlength="7" placeholder="#HEX" />
        </div>
    `;
}

/**
 * custom editor for gradient mode
 */
function renderGradientCustom({ value }) {
    const parsed = parseLinearGradient(value) || { angle: '135', start: '#f6d3e0', end: '#b4d7f2' };
    return `
        <div class="cp-custom cp-custom--gradient" data-cp-section="gradient">
            <div class="cp-custom__row">
                <div class="cp-custom__color-pair">
                    <span class="cp-custom__swatch cp-custom__swatch--sm" id="cp-swatch-start"
                        style="background:${escapeHtml(normalizeHex(parsed.start))}"></span>
                    <input type="color" class="cp-custom__native-color"
                        data-cp-key="start" value="${escapeHtml(normalizeHex(parsed.start))}" tabindex="-1" />
                    <input type="number" class="cp-custom__hex cp-custom__hex--sm"
                        data-cp-key="hex-start" value="${escapeHtml(normalizeHex(parsed.start))}"
                        spellcheck="false" maxlength="7" placeholder="起" />
                </div>
                <div class="cp-custom__color-pair">
                    <span class="cp-custom__swatch cp-custom__swatch--sm" id="cp-swatch-end"
                        style="background:${escapeHtml(normalizeHex(parsed.end))}"></span>
                    <input type="color" class="cp-custom__native-color"
                        data-cp-key="end" value="${escapeHtml(normalizeHex(parsed.end))}" tabindex="-1" />
                    <input type="number" class="cp-custom__hex cp-custom__hex--sm"
                        data-cp-key="hex-end" value="${escapeHtml(normalizeHex(parsed.end))}"
                        spellcheck="false" maxlength="7" placeholder="终" />
                </div>
                <div class="cp-custom__angle-wrap">
                    <input type="number" class="cp-custom__angle"
                        data-cp-key="angle" min="0" max="360" step="5"
                        value="${escapeHtml(String(parseInt(parsed.angle, 10) || 135))}" />
                    <span class="cp-custom__angle-unit">°</span>
                </div>
            </div>
            <span class="cp-custom__gradient-preview" id="cp-gradient-preview"
                style="background:${escapeHtml(value)}"></span>
        </div>
    `;
}

/**
 * 主入口
 * @param {object} opts
 * @param {string} opts.value - 当前颜色值
 * @param {string} opts.field - 字段名
 * @param {string} [opts.onchange] - onchange 字符串
 * @param {Array} [opts.presets] - 预设数组（单模式）
 * @param {object|null} [opts.presetsByMode] - 两套预设 {solid: [], gradient: []}
 * @param {string} [opts.mode] - 强制模式
 * @param {string} [opts.appId]
 * @param {string} [opts.method]
 * @param {boolean} [opts.hideModeToggle] - 隐藏模式切换（用于外置模式切换的场景）
 */
export function renderColorPickerMount({
    value = '',
    field = '',
    onchange = '',
    presets = [],
    presetsByMode = null,
    mode,
    appId = '',
    method = '',
    hideModeToggle = false,
} = {}) {
    const finalOnchange = onchange || (appId && method ? `${appId}:${method}` : '');

    // 当 presetsByMode 有值时，强制渲染 toggle；否则按 value 自动判断
    const autoMode = isGradient(value) ? 'gradient' : 'solid';
    const activeMode = presetsByMode
        ? (mode === 'solid' || mode === 'gradient' ? mode : autoMode)
        : autoMode;

    const onchangeAttr = onchangeAttrs(finalOnchange);
    const presetsAttr = presetsByMode
        ? `data-cp-presets='${escapeHtml(JSON.stringify(presetsByMode))}'`
        : '';

    // 两套 chips 都渲染
    const solidChips = presetsByMode
        ? presetsByMode.solid.map(p => renderChip({
            preset: p,
            active: activeMode === 'solid' && valueEquals(p.value, value),
        })).join('')
        : (presets || []).map(p => renderChip({
            preset: p,
            active: valueEquals(p.value, value),
        })).join('');

    const gradientChips = presetsByMode
        ? presetsByMode.gradient.map(p => renderChip({
            preset: p,
            active: activeMode === 'gradient' && valueEquals(p.value, value),
        })).join('')
        : '';

    // custom editor
    const solidCustom = renderSolidCustom({ hex: normalizeHex(value) });
    const gradientCustom = renderGradientCustom({ value });

    // 是否渲染模式切换（当 hideModeToggle=true 时不渲染，由外部接管）
    const showModeToggle = presetsByMode && !hideModeToggle;

    return `
        <div class="cp ${activeMode === 'gradient' ? 'cp--gradient' : 'cp--solid'}"
            data-cp-mount="1"
            data-cp-field="${escapeHtml(field)}"
            data-cp-mode="${escapeHtml(activeMode)}"
            data-cp-onchange="${escapeHtml(finalOnchange)}"
            data-cp-value="${escapeHtml(value)}"
            ${presetsAttr}
        >
            ${showModeToggle ? renderModeToggle({ activeMode }) : ''}

            <div class="cp-chips cp-chips--solid" data-cp-chips="solid">${solidChips}</div>
            ${gradientChips ? `<div class="cp-chips cp-chips--gradient" data-cp-chips="gradient">${gradientChips}</div>` : ''}

            <div class="cp-custom-wrap">
                <div class="cp-custom cp-custom--solid-sect" data-cp-section="solid">${solidCustom}</div>
                ${gradientChips ? `<div class="cp-custom cp-custom--gradient-sect" data-cp-section="gradient">${gradientCustom}</div>` : ''}
            </div>
        </div>
    `;
}

function onchangeAttrs(onchange) {
    return onchange ? `data-cp-onchange="${escapeHtml(onchange)}"` : '';
}

// =============================================
// 事件系统
// =============================================

let _mounted = false;

export function installColorPickerAutoMount() {
    if (_mounted) return;
    _mounted = true;
    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
}

function getCpRoot(el) {
    while (el && el !== document.body) {
        if (el instanceof Element && el.classList && el.classList.contains('cp')) return el;
        el = el.parentElement;
    }
    return null;
}

function getMode(root) {
    return root.getAttribute('data-cp-mode') || 'solid';
}

function dispatchChange(root, field, value) {
    const onchange = root.getAttribute('data-cp-onchange') || '';
    if (!onchange) return;
    const [appId, method] = onchange.split(':');
    window.dispatchEvent(new CustomEvent('app:page-action', {
        detail: { action: 'appMethod', appId, method, payload: { field, value } },
    }));
}

function handleClick(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;

    // ----- 外部模式切换按钮（section.js 渲染的 cp-mode，可能不在 .cp 内）-----
    const externalModeBtn = target.closest('.cp-mode__btn');
    if (externalModeBtn) {
        const newMode = externalModeBtn.getAttribute('data-cp-set-mode');
        if (newMode) {
            // 尝试找到对应的 .cp 元素
            const modeContainer = externalModeBtn.closest('.cp-mode');
            let root = null;

            if (modeContainer) {
                // 情况1：按钮在 .cp 内
                root = modeContainer.closest('.cp');
                if (!root) {
                    // 情况2：按钮在 .cp 外，通过 data-cp-target-field 查找
                    const field = modeContainer.getAttribute('data-cp-target-field');
                    if (field) {
                        root = document.querySelector(`.cp[data-cp-field="${field}"]`);
                    }
                }
            }

            if (root) {
                handleModeSwitch(root, newMode);
            }
        }
        return;
    }

    const root = getCpRoot(target);
    if (!root) return;

    // ----- swatch trigger（点击小方块触发 color input）-----
    const swatchWrap = target.closest('[data-cp-swatch-trigger]');
    if (swatchWrap) {
        const native = swatchWrap.querySelector('[data-cp-key="color"]');
        if (native) native.click();
        return;
    }

    // ----- preset chip -----
    const chipBtn = target.closest('.cp-chip__btn');
    if (chipBtn) {
        const presetRaw = chipBtn.getAttribute('data-cp-preset');
        if (!presetRaw) return;
        let preset;
        try { preset = JSON.parse(presetRaw); } catch { return; }
        const field = root.getAttribute('data-cp-field') || '';
        dispatchChange(root, field, preset.value);
        return;
    }

    // ----- 内部模式切换按钮 -----
    const modeBtn = target.closest('[data-cp-set-mode]');
    if (modeBtn) {
        handleModeSwitch(root, modeBtn.getAttribute('data-cp-set-mode'));
        return;
    }
}

function handleInput(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const root = getCpRoot(target);
    if (!root) return;

    const key = target.getAttribute('data-cp-key');
    const mode = getMode(root);
    const field = root.getAttribute('data-cp-field') || '';

    // ----- native color input -----
    if (key === 'color' && mode === 'solid') {
        const hex = target.value;
        syncSolidCustom(root, hex);
        root.setAttribute('data-cp-value', hex);
        dispatchChange(root, field, hex);
        return;
    }

    // ----- hex text input (solid) -----
    if (key === 'hex' && mode === 'solid') {
        const v = String(target.value || '').trim();
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) {
            const hex = normalizeHex(v);
            syncSolidCustom(root, hex);
            root.setAttribute('data-cp-value', hex);
            dispatchChange(root, field, hex);
        }
        return;
    }

    // ----- gradient: color inputs -----
    if ((key === 'start' || key === 'end') && mode === 'gradient') {
        const hex = target.value;
        const hexKey = key === 'start' ? 'hex-start' : 'hex-end';
        const swatchId = key === 'start' ? 'cp-swatch-start' : 'cp-swatch-end';
        const hexInput = root.querySelector(`[data-cp-key="${hexKey}"]`);
        const swatch = document.getElementById(swatchId);
        if (hexInput && hexInput.value !== hex) hexInput.value = hex;
        if (swatch) swatch.style.background = hex;
        rebuildGradient(root);
        return;
    }

    // ----- gradient: hex text inputs -----
    if ((key === 'hex-start' || key === 'hex-end') && mode === 'gradient') {
        const v = String(target.value || '').trim();
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) {
            const hex = normalizeHex(v);
            const colorKey = key === 'hex-start' ? 'start' : 'end';
            const hexKey = key;
            const colorInput = root.querySelector(`[data-cp-key="${colorKey}"]`);
            const swatchId = key === 'hex-start' ? 'cp-swatch-start' : 'cp-swatch-end';
            const swatch = document.getElementById(swatchId);
            if (colorInput && colorInput.value !== hex) colorInput.value = hex;
            if (swatch) swatch.style.background = hex;
            rebuildGradient(root);
        }
        return;
    }

    // ----- gradient: angle -----
    if (key === 'angle' && mode === 'gradient') {
        rebuildGradient(root);
        return;
    }
}

/** 重建渐变值并派发 */
function rebuildGradient(root) {
    const start = root.querySelector('[data-cp-key="start"]')?.value || '#f6d3e0';
    const end = root.querySelector('[data-cp-key="end"]')?.value || '#b4d7f2';
    const angleEl = root.querySelector('[data-cp-key="angle"]');
    const angle = `${Number(angleEl?.value) || 135}deg`;
    const preview = document.getElementById('cp-gradient-preview');
    const grad = buildGradient({ angle, start, end });
    if (preview) preview.style.background = grad;
    root.setAttribute('data-cp-value', grad);
    dispatchChange(root, root.getAttribute('data-cp-field') || '', grad);
}

/**
 * 处理模式切换（单色 ↔ 渐变）
 * @param {Element} root - .cp 根元素
 * @param {string} newMode - 目标模式：'solid' | 'gradient'
 */
function handleModeSwitch(root, newMode) {
    const current = root.getAttribute('data-cp-value') || '';
    const presetsByModeRaw = root.getAttribute('data-cp-presets');
    let nextValue = current;

    // 尝试从 presetsByMode 获取目标模式的预设
    let presets = null;
    if (presetsByModeRaw) {
        try {
            const parsed = JSON.parse(presetsByModeRaw);
            presets = parsed[newMode] || null;
        } catch (e) {
            // ignore
        }
    }

    // 模式切换的优先级：
    // 1. 如果目标模式有预设 → 选择第一个预设
    // 2. 否则根据当前值转换
    if (presets && presets.length > 0) {
        // 目标模式有预设，直接使用第一个预设值
        nextValue = presets[0].value;
    } else if (newMode === 'solid' && isGradient(current)) {
        // 渐变 → 单色：提取起始颜色
        const parsed = parseLinearGradient(current);
        nextValue = parsed ? normalizeHex(parsed.start) : '#888888';
    } else if (newMode === 'gradient' && !isGradient(current)) {
        // 单色 → 渐变：基于当前颜色生成双色调渐变
        const base = normalizeHex(current, '#f6d3e0');
        nextValue = buildGradient({ angle: '135deg', start: base, end: base });
    }

    root.setAttribute('data-cp-mode', newMode);
    root.setAttribute('data-cp-value', nextValue);
    applyModeSwitchCss(root, newMode);

    // 同步外部的 cp-mode 按钮状态
    syncExternalModeToggle(root, newMode);

    dispatchChange(root, root.getAttribute('data-cp-field') || '', nextValue);
}

/**
 * 同步外部 cp-mode 按钮的激活状态（当外部渲染了模式切换时）
 */
function syncExternalModeToggle(root, newMode) {
    // 查找外部的 cp-mode 容器（不在 .cp 内部）
    const allModeToggles = document.querySelectorAll('.cp-mode');
    allModeToggles.forEach(container => {
        if (container.closest('.cp')) return; // 跳过内部的
        const buttons = container.querySelectorAll('.cp-mode__btn');
        buttons.forEach(btn => {
            const mode = btn.getAttribute('data-cp-set-mode');
            btn.classList.toggle('is-active', mode === newMode);
        });
    });
}

/** 同步 solid custom editor 的 swatch + hex input */
function syncSolidCustom(root, hex) {
    const swatch = document.getElementById('cp-swatch-solid');
    const hexInput = root.querySelector('[data-cp-key="hex"]');
    if (swatch) swatch.style.background = hex;
    if (hexInput && hexInput.value !== hex) hexInput.value = hex;
}

/** 切换 mode 后更新 CSS class（两套 presets / custom 都已在 DOM，只需改 class） */
function applyModeSwitchCss(root, newMode) {
    root.classList.remove('cp--solid', 'cp--gradient');
    root.classList.add(newMode === 'gradient' ? 'cp--gradient' : 'cp--solid');
}

export default { renderColorPickerMount, installColorPickerAutoMount };
export function registerPresetLibrary(name, presets) {
    TEMPLATES.push({ name, presets });
}
