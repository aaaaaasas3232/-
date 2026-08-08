/**
 * chat-app / 「第三方 App Prompt 特殊卡片预览」组件（v0.61.5）
 *
 *   业务含义：当 App 注册 prompt 时带了 previewType（music-card / red-packet-card /
 *   location-card / text），prompt-manager 页要把它渲染成可视化预览，让用户看到
 *   "这条 prompt 注入 AI 后，AI 会用这种卡片跟用户互动"。
 *
 *   模块导出：
 *     renderAppPromptCardPreview({ previewType, previewData, label })  → HTML 字符串
 *     getPreviewTypeLabel(previewType)                                 → '音乐卡片' / '红包卡片' / ...
 *
 *   设计要点：
 *     - 纯字符串返回（与 .pm-* 兄弟组件保持一致）
 *     - 用户输入 / previewData 字段全部 escapeHtml
 *     - music-card / red-packet-card / location-card 复用了与 chat bubble 相同样式名
 *       （.music-card-mini / .redpacket-card-mini / .location-card-mini），避免另起炉灶
 *     - text 类型仅显示一个简短的文本框
 *
 *   调用方：prompt-manager-page.js（"第三方 App Prompt"子组里每条展示）。
 */

import { escapeHtml } from '@/src/core/escape.js';

const PREVIEW_TYPE_LABELS = Object.freeze({
    'text': '文本预览',
    'music-card': '音乐卡片',
    'red-packet-card': '红包卡片',
    'location-card': '位置卡片',
});

/**
 * 预览类型 → 显示标签。
 * @param {string} previewType
 * @returns {string}
 */
export function getPreviewTypeLabel(previewType) {
    return PREVIEW_TYPE_LABELS[previewType] || '其他';
}

// ============================================================
// music-card 预览（简易音乐卡片：缩略图占位 + 标题 + 歌手）
// ============================================================
function renderMusicCardPreview(previewData, label) {
    const song = String(previewData?.song || previewData?.title || label || '未命名歌曲');
    const artist = String(previewData?.artist || previewData?.singer || '未知歌手');
    const cover = String(previewData?.cover || '');
    const coverHtml = cover
        ? `<div class="pm-preview-card__cover" style="background-image:url('${escapeHtml(cover)}')"></div>`
        : `<div class="pm-preview-card__cover pm-preview-card__cover--placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                </svg>
            </div>`;
    return `
        <div class="pm-preview-card pm-preview-card--music">
            ${coverHtml}
            <div class="pm-preview-card__meta">
                <div class="pm-preview-card__title">${escapeHtml(song)}</div>
                <div class="pm-preview-card__sub">${escapeHtml(artist)}</div>
            </div>
        </div>
    `;
}

// ============================================================
// red-packet-card 预览（简易红包卡片）
// ============================================================
function renderRedPacketCardPreview(previewData, label) {
    const message = String(previewData?.message || previewData?.title || label || '恭喜发财');
    const sender = String(previewData?.sender || '对方发来红包');
    return `
        <div class="pm-preview-card pm-preview-card--red-packet">
            <div class="pm-preview-card__redpacket-header">
                <div class="pm-preview-card__redpacket-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="8" width="18" height="12" rx="2"/>
                        <circle cx="12" cy="14" r="2.5"/>
                    </svg>
                </div>
                <div class="pm-preview-card__redpacket-text">
                    <div class="pm-preview-card__redpacket-title">${escapeHtml(message)}</div>
                    <div class="pm-preview-card__redpacket-sender">${escapeHtml(sender)}</div>
                </div>
            </div>
            <div class="pm-preview-card__redpacket-footer">
                <span class="pm-preview-card__redpacket-cta">点击领取红包</span>
            </div>
        </div>
    `;
}

// ============================================================
// location-card 预览（简易位置卡片）
// ============================================================
function renderLocationCardPreview(previewData, label) {
    const name = String(previewData?.name || previewData?.title || label || '位置');
    const address = String(previewData?.address || '');
    return `
        <div class="pm-preview-card pm-preview-card--location">
            <div class="pm-preview-card__location-map">
                <div class="pm-preview-card__location-grid"></div>
                <div class="pm-preview-card__location-pin">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                </div>
            </div>
            <div class="pm-preview-card__location-info">
                <div class="pm-preview-card__location-name">${escapeHtml(name)}</div>
                ${address ? `<div class="pm-preview-card__location-address">${escapeHtml(address)}</div>` : ''}
            </div>
        </div>
    `;
}

// ============================================================
// text 预览（纯文本框）
// ============================================================
function renderTextPreview(previewData, label) {
    const text = String(previewData?.text || previewData?.preview || label || '(空文本)');
    return `
        <div class="pm-preview-card pm-preview-card--text">
            <div class="pm-preview-card__text">${escapeHtml(text)}</div>
        </div>
    `;
}

// ============================================================
// 主入口
// ============================================================
/**
 * 渲染第三方 App Prompt 特殊卡片预览。
 * @param {object} opts
 * @param {string} opts.previewType  'text' | 'music-card' | 'red-packet-card' | 'location-card'
 * @param {object} [opts.previewData]
 * @param {string} [opts.label]
 * @returns {string} HTML 字符串
 */
export function renderAppPromptCardPreview({ previewType, previewData, label } = {}) {
    const data = previewData && typeof previewData === 'object' ? previewData : {};
    switch (previewType) {
        case 'music-card':
            return renderMusicCardPreview(data, label);
        case 'red-packet-card':
            return renderRedPacketCardPreview(data, label);
        case 'location-card':
            return renderLocationCardPreview(data, label);
        case 'text':
        default:
            return renderTextPreview(data, label);
    }
}

export default renderAppPromptCardPreview;