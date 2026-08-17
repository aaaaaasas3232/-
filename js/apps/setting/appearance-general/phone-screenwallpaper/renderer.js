/**
 * 屏幕墙纸模块 · 渲染器
 *
 * 提供所有 UI 组件的渲染函数：
 * - renderPreview(state)           屏幕壁纸预览（贴合 iPhone 屏幕比例）
 * - renderImagePicker(state)       图片选择器（当前图 / 上传 / URL / 预设）
 * - renderBlurControl(state)       模糊度滑块
 * - renderDiyPanel(state)          完整面板（左右结构：左预览 / 右调整）
 *
 * 注意：所有用户输入（图片 URL、文件名）都先用 escapeHtml 包裹，
 *       任何拼到 style 里的字符串都用 escapeHtml(value)。
 */

import { escapeHtml } from '@/src/core/escape.js';
import {
    buildWallpaper,
} from './state.js';

// ============================================
// 预览
// ============================================

const PREVIEW_SIZE = { width: 66, height: 102, radius: 8 };

/** 渲染屏幕墙纸预览（一个迷你手机屏幕比例的卡片） */
export function renderPreview(state, id = 'screen-wallpaper-preview') {
    const bg = buildWallpaper(state);
    const blur = Number(state?.blur) || 0;
    const radius = PREVIEW_SIZE.radius;

    return `
        <div id="${escapeHtml(id)}"
             class="sw-preview"
             style="width:${PREVIEW_SIZE.width}px;height:${PREVIEW_SIZE.height}px;border-radius:${radius}px;background-color:${escapeHtml(bg)};background-image:${escapeHtml(bg)};background-size:cover;background-position:center;background-repeat:no-repeat;">
            <div class="sw-preview__screen" style="filter:blur(${blur}px);background-color:${escapeHtml(bg)};background-image:${escapeHtml(bg.startsWith('linear-gradient') || bg.startsWith('url(') ? bg : 'none')};"></div>
            <div class="sw-preview__overlay"></div>
            <div class="sw-preview__dots">
                <span></span><span class="is-active"></span><span></span>
            </div>
        </div>
    `;
}

// ============================================
// 图片
// ============================================

/** 渲染图片选择器：当前图 / 上传 / URL */
export function renderImagePicker(state) {
    return `
        <div class="sw-picker-section" data-picker-type="image">
            <div class="sw-image-actions">
                <label class="sw-upload-btn" title="本地上传">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rose" aria-hidden="true">
                        <path d="M17 10h-1a4 4 0 1 1 4-4v.534"/>
                        <path d="M17 6h1a4 4 0 0 1 1.42 7.74l-2.29.87a6 6 0 0 1-5.339-10.68l2.069-1.31"/>
                        <path d="M4.5 17c2.8-.5 4.4 0 5.5.8s1.8 2.2 2.3 3.7c-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2"/>
                        <path d="M9.77 12C4 15 2 22 2 22"/>
                        <circle cx="17" cy="8" r="2"/>
                    </svg>
                    <input type="file"
                           accept="image/*"
                           class="sw-file-input"
                           data-field="uploadImage" />
                </label>
            </div>

            <div class="sw-image-url-row">
                <input type="text"
                       class="sw-image-url-input"
                       value="${escapeHtml(state?.imageUrl || '')}"
                       placeholder="或输入图片 URL，例如 https://…"
                       spellcheck="false"
                       autocomplete="off"
                       data-field="imageUrl" />
                <button type="button"
                        class="sw-image-url-apply"
                        data-action="apply-url">应用</button>
            </div>
        </div>
    `;
}

// ============================================
// 模糊度
// ============================================

/**
 * 渲染模糊度滑块（极简版：无 header，仅保留 range input）。
 * 标签/数值显示由调用方决定是否需要（当前 UI 直接删除 header，仅留滑块）。
 *
 * 内联 style="--sw-pct: X%" 让轨道初始进度就反映当前 blur，
 * 避免「thumb 在位置 X 但轨道是灰色全空」的视觉割裂。
 */
export function renderBlurControl(state) {
    const value = Number(state?.blur) || 0;
    const max = 20;
    const pct = Math.max(0, Math.min(100, (value / max) * 100));

    return `
        <div class="sw-control" data-control="blur">
            <input type="range"
                   class="sw-slider"
                   min="0" max="${max}" step="1"
                   value="${value}"
                   data-field="blur"
                   style="--sw-pct: ${pct}%;"
                   aria-label="模糊度" />
        </div>
    `;
}

// ============================================
// 完整面板（左右结构）
// ============================================

/**
 * 渲染完整的屏幕墙纸 DIY 面板。
 * 左：预览（mini 屏幕）；右：图片选择器 + 模糊度。
 */
export function renderDiyPanel(state) {
    const preview = renderPreview(state);
    const imagePicker = renderImagePicker(state);
    const blurControl = renderBlurControl(state);

    return `
        <div class="sw-diy">
            <div class="sw-diy__layout">
                <div class="sw-diy__preview">${preview}</div>
                <div class="sw-diy__controls">
                    <div class="sw-diy__panel">${imagePicker}</div>
                    <div class="sw-diy__extras">
                        ${blurControl}
                    </div>
                </div>
            </div>
        </div>
    `;
}
