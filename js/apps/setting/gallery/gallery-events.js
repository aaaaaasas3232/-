/**
 * 图库模块 · 事件处理层
 *
 * 裁剪交互（拖动/缩放图片）需要原生事件监听，
 * 已在 bootstrapGallery 时统一初始化。
 */

import { getGalleryCache } from './gallery-methods.js';
import { _handleFileInputChange } from './gallery-methods.js';

// ============================================
// 裁剪器（拖动 / 缩放图片）
// ============================================

let _cropDrag = null;

export function initCropperEvents() {
    document.addEventListener('mousedown', _onCropMouseDown);
    document.addEventListener('mousemove', _onCropMouseMove);
    document.addEventListener('mouseup', _onCropMouseUp);
    document.addEventListener('touchstart', _onCropTouchStart, { passive: false });
    document.addEventListener('touchmove', _onCropTouchMove, { passive: false });
    document.addEventListener('touchend', _onCropTouchEnd);
    document.addEventListener('wheel', _onCropWheel, { passive: false });

    // 上传区点击 → 触发文件选择（capture phase，绕过 Vue 的 click 阻止）
    document.addEventListener('click', (e) => {
        const zone = e.target.closest('.gallery-upload-zone');
        if (!zone) return;
        const fileInput = document.getElementById('gallery-file-input');
        if (fileInput) fileInput.click();
    }, true); // capture: true

    // 文件选择变化 → 触发上传准备流程
    document.addEventListener('change', (e) => {
        const fileInput = e.target.closest('#gallery-file-input');
        if (!fileInput) return;
        _handleFileInputChange(e);
    }, true); // capture: true
}

function _onCropMouseDown(event) {
    const stage = event.target.closest('.gallery-cropper__stage');
    if (!stage) return;
    const shell = stage.closest('.app-shell');
    if (!shell) return;

    _cropDrag = {
        startX: event.clientX,
        startY: event.clientY,
        offsetX: getGalleryCache().cropState?.offsetX || 0,
        offsetY: getGalleryCache().cropState?.offsetY || 0,
    };
    event.preventDefault();
}

function _onCropMouseMove(event) {
    if (!_cropDrag) return;
    const cache = getGalleryCache();
    if (!cache.cropState) return;

    cache.cropState.offsetX = _cropDrag.offsetX + (event.clientX - _cropDrag.startX);
    cache.cropState.offsetY = _cropDrag.offsetY + (event.clientY - _cropDrag.startY);
    _updateCropImageStyle();
}

function _onCropMouseUp() {
    _cropDrag = null;
}

function _onCropTouchStart(event) {
    const stage = event.target.closest('.gallery-cropper__stage');
    if (!stage) return;
    const shell = stage.closest('.app-shell');
    if (!shell) return;

    const touch = event.touches?.[0];
    if (!touch) return;

    _cropDrag = {
        startX: touch.clientX,
        startY: touch.clientY,
        offsetX: getGalleryCache().cropState?.offsetX || 0,
        offsetY: getGalleryCache().cropState?.offsetY || 0,
    };
    event.preventDefault();
}

function _onCropTouchMove(event) {
    if (!_cropDrag) return;
    const touch = event.touches?.[0];
    if (!touch) return;

    const cache = getGalleryCache();
    if (!cache.cropState) return;

    cache.cropState.offsetX = _cropDrag.offsetX + (touch.clientX - _cropDrag.startX);
    cache.cropState.offsetY = _cropDrag.offsetY + (touch.clientY - _cropDrag.startY);
    _updateCropImageStyle();
    event.preventDefault();
}

function _onCropTouchEnd() {
    _cropDrag = null;
}

function _onCropWheel(event) {
    const stage = event.target.closest('.gallery-cropper__stage');
    if (!stage) return;
    const shell = stage.closest('.app-shell');
    if (!shell) return;

    const cache = getGalleryCache();
    if (!cache.cropState) return;

    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    cache.cropState.scale = Math.max(0.5, Math.min(4, cache.cropState.scale * delta));
    _updateCropImageStyle();
    event.preventDefault();
}

function _updateCropImageStyle() {
    const img = document.getElementById('crop-image');
    if (!img) return;

    const cache = getGalleryCache();
    const cs = cache.cropState || {};
    const scale = cs.scale || 1;
    const ox = cs.offsetX || 0;
    const oy = cs.offsetY || 0;

    img.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
    img.style.transformOrigin = 'center center';
    img.style.width = '280px';
    img.style.height = '280px';
    img.style.objectFit = 'contain';
}