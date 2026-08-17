/**
 * 手机壳模块 · 渲染器
 *
 * 提供所有 UI 组件的渲染函数：
 * - renderPreview(state) - 手机壳预览
 * - renderTypeToggle(state) - 类型切换标签
 * - renderSolidPicker(state) - 单色选择器
 * - renderGradientPicker(state) - 双色渐变选择器
 * - renderMultiPicker(state) - 多色渐变选择器
 * - renderColorPanel(state) - 根据类型自动选择面板
 * - renderAngleSlider(state) - 角度滑块
 * - renderPresetsGrid(presets, activeId) - 预设网格
 */

import { escapeHtml } from '@/src/core/escape.js';
import { buildBackground, normalizeHex } from './state.js';
import {
    SOLID_PRESETS,
    GRADIENT_PRESETS,
    MULTI_PRESETS,
} from './presets.js';

// ============================================
// 预览
// ============================================

const PREVIEW_SIZE = { width: 88, height: 136, radius: 10 };

/**
 * 渲染手机壳预览
 * @param {Object} state - 手机壳状态
 * @param {string} [id] - 容器ID
 */
export function renderPreview(state, id = 'case-preview') {
    const bg = buildBackground(state);

    return `
        <div id="${escapeHtml(id)}" class="case-preview"
             style="width:${PREVIEW_SIZE.width}px;height:${PREVIEW_SIZE.height}px;border-radius:${PREVIEW_SIZE.radius}px;background:${escapeHtml(bg)};box-shadow:0 4px 12px rgba(0,0,0,0.15),inset 0 1px 0 rgba(255,255,255,0.2);">
        </div>
    `;
}

// ============================================
// 类型切换
// ============================================

const TYPE_TABS = [
    { id: 'solid', label: '纯色' },
    { id: 'gradient', label: '渐变' },
    { id: 'multi', label: '多色' },
];

/**
 * 渲染类型切换标签
 */
export function renderTypeToggle(state) {
    const activeType = state?.type || 'gradient';
    return `
        <div class="case-type-tabs">
            ${TYPE_TABS.map(tab => `
                <button type="button"
                        class="case-type-tab ${tab.id === activeType ? 'is-active' : ''}"
                        data-case-type="${tab.id}">
                    ${escapeHtml(tab.label)}
                </button>
            `).join('')}
        </div>
    `;
}

// ============================================
// 单色选择器
// ============================================

/**
 * 渲染单色选择器 - 紧凑色板（无文字 / 无灰底 / 16 色占两排）
 */
export function renderSolidPicker(state) {
    const currentColor = normalizeHex(state?.colors?.[0] || '#f6d3e0');
    const activePreset = findActivePreset(currentColor, SOLID_PRESETS);

    return `
        <div class="case-picker-section" data-picker-type="solid">
            <div class="case-palette-row">
                <div class="case-palette">
                    <div class="case-palette__grid">
                        ${SOLID_PRESETS.map(preset => {
                            const isActive = preset.value === currentColor;
                            return `
                                <button type="button"
                                        class="case-palette__cell ${isActive ? 'is-active' : ''}"
                                        data-preset-id="${preset.id}"
                                        data-color="${preset.value}"
                                        style="--swatch:${preset.value};"
                                        aria-label="${preset.id}">
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
            <div class="case-custom-row">
                <label class="case-custom-picker">
                    <span class="case-custom-picker__label">自定义</span>
                    <input type="color"
                           class="case-color-input"
                           value="${currentColor}"
                           data-field="customColor" />
                </label>
            </div>
        </div>
    `;
}

// ============================================
// 双色渐变选择器
// ============================================

/**
 * 渲染双色渐变选择器
 */
export function renderGradientPicker(state) {
    const colors = state?.colors?.length >= 2 ? state.colors : ['#f6d3e0', '#b4d7f2'];
    const angle = state?.angle || 135;
    const previewBg = `linear-gradient(${angle}deg, ${colors[0]}, ${colors[1]})`;

    return `
        <div class="case-picker-section" data-picker-type="gradient">
            <div class="case-section-row">
                <div class="case-section-row__control case-section-row__control--colors">
                    <span class="case-section-row__label case-section-row__label--inline">颜色</span>
                    <div class="case-gradient-color-item">
                        <div class="case-color-wrapper">
                            <span class="case-color-preview" style="background:${colors[0]};"></span>
                            <input type="color"
                                   class="case-color-input"
                                   value="${normalizeHex(colors[0])}"
                                   data-color-index="0" />
                        </div>
                    </div>
                    <div class="case-gradient-color-item">
                        <div class="case-color-wrapper">
                            <span class="case-color-preview" style="background:${colors[1]};"></span>
                            <input type="color"
                                   class="case-color-input"
                                   value="${normalizeHex(colors[1])}"
                                   data-color-index="1" />
                        </div>
                    </div>
                </div>
            </div>

            <div class="case-angle-slider-row">
                <input type="range"
                       class="case-angle-slider"
                       min="0" max="360" step="5"
                       value="${angle}"
                       data-field="angle" />
            </div>

            <div class="case-presets-grid case-presets-grid--gradient">
                ${GRADIENT_PRESETS.map(preset => {
                    const isActive = preset.value === state?.presetId ||
                        isActiveGradientPreset(preset, colors, angle);
                    return `
                        <button type="button"
                                class="case-gradient-preset ${isActive ? 'is-active' : ''}"
                                data-gradient="${preset.value}"
                                data-preset-id="${preset.id}"
                                style="--c1:${preset.startColor};--c2:${preset.endColor};">
                            <span class="sr-only">${escapeHtml(preset.label)}</span>
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// ============================================
// 多色渐变选择器
// ============================================

/**
 * 渲染多色渐变选择器
 */
export function renderMultiPicker(state) {
    const colors = state?.colors?.length >= 2 ? state.colors : ['#f6d3e0', '#ffd4a3', '#b4d7f2'];
    const angle = state?.angle || 135;
    const previewBg = `linear-gradient(${angle}deg, ${colors.join(', ')})`;

    return `
        <div class="case-picker-section" data-picker-type="multi">
            <div class="case-multi-colors">
                ${colors.map((color, idx) => `
                    <div class="case-multi-color-item">
                        <input type="color"
                               class="case-color-input case-multi-color-input"
                               value="${normalizeHex(color)}"
                               data-color-index="${idx}" />
                        <button type="button"
                                class="case-multi-color-remove ${idx < 2 ? 'is-disabled' : ''}"
                                data-color-index="${idx}"
                                ${idx < 2 ? 'disabled' : ''}
                                title="删除">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                `).join('')}
                ${colors.length < 8 ? `
                    <button type="button" class="case-multi-color-add" data-action="add-color" title="添加颜色">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                ` : ''}
            </div>
            <div class="case-multi-preview" style="background:${previewBg};"></div>

            <div class="case-angle-slider-row">
                <input type="range"
                       class="case-angle-slider"
                       min="0" max="360" step="5"
                       value="${angle}"
                       data-field="angle" />
            </div>

            <div class="case-presets-grid case-presets-grid--multi">
                <span class="case-presets-grid__label">预设</span>
                ${MULTI_PRESETS.map(preset => {
                    const isActive = isActiveMultiPreset(preset, colors, angle);
                    return `
                        <button type="button"
                                class="case-multi-preset ${isActive ? 'is-active' : ''}"
                                data-colors="${preset.colors.join('|')}"
                                data-angle="${preset.angle}"
                                data-preset-id="${preset.id}"
                                style="background:linear-gradient(${preset.angle}deg, ${preset.colors.join(', ')});"
                                title="${escapeHtml(preset.label)}">
                            <span class="sr-only">${escapeHtml(preset.label)}</span>
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// ============================================
// 颜色面板（根据类型自动选择）
// ============================================

/**
 * 渲染颜色面板（根据当前类型）
 */
export function renderColorPanel(state) {
    const type = state?.type || 'gradient';
    switch (type) {
        case 'solid':
            return renderSolidPicker(state);
        case 'gradient':
            return renderGradientPicker(state);
        case 'multi':
            return renderMultiPicker(state);
        default:
            return renderGradientPicker(state);
    }
}

// ============================================
// 完整 DIY 面板
// ============================================

/**
 * 渲染完整的手机壳 DIY 面板
 */
export function renderDIYPanel(state) {
    const preview = renderPreview(state);
    const typeToggle = renderTypeToggle(state);
    const colorPanel = renderColorPanel(state);

    return `
        <div class="case-diy">
            <div class="case-diy__layout">
                <div class="case-diy__preview">
                    ${preview}
                </div>
                <div class="case-diy__controls">
                    ${typeToggle}
                    <div class="case-diy__panel">
                        ${colorPanel}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// 辅助函数
// ============================================

function findActivePreset(color, presets) {
    return presets.find(p => p.value === color);
}

function isActiveGradientPreset(preset, colors, angle) {
    if (!preset.value.includes('linear-gradient')) return false;
    const match = preset.value.match(/linear-gradient\((\d+)deg,\s*([^,]+),\s*([^)]+)\)/);
    if (!match) return false;
    const presetAngle = parseInt(match[1], 10);
    const presetColors = [match[2].trim(), match[3].trim()];
    return presetAngle === angle &&
        presetColors.every((c, i) => normalizeHex(c) === normalizeHex(colors[i]));
}

function isActiveMultiPreset(preset, colors, angle) {
    if (preset.angle !== angle) return false;
    if (preset.colors.length !== colors.length) return false;
    return preset.colors.every((c, i) => normalizeHex(c) === normalizeHex(colors[i]));
}
