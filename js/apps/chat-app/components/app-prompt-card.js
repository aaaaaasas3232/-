/**
 * 第三方 App Prompt 特殊卡片预览
 *
 *   业务含义：App 注册 prompt 时带了 previewType（music-card / red-packet-card /
 *   location-card / …），murmur 的「回复提示词」页要把它画出来，让用户看到
 *   「这条 prompt 注入 AI 之后，AI 会用哪种卡片跟我互动」。
 *
 * ── 一条原则：预览就是真卡片 ──────────────────────────────────────
 *
 * 这个文件以前自己写了一套 `.pm-preview-card--*` 的 HTML：类名、结构、图标
 * 全都跟聊天里真正发出来的卡片不一样。用户照着预览调好，发到聊天里是另一副
 * 面孔；想自定义样式还得写两套 CSS，改一边另一边不动。
 *
 * 现在直接调 `share-cards.js` 的 `renderShareCardBody()` —— 和聊天气泡用的
 * 是同一个函数、同一套 class。预览和真实卡片不可能再对不上，用户覆盖
 * `.redpacket-card` 这类真实类名时两边一起变。
 *
 *   模块导出：
 *     renderAppPromptCardPreview({ previewType, previewData, label })  → HTML 字符串
 *     getPreviewTypeLabel(previewType)                                 → '音乐卡片' / …
 *     PREVIEW_TYPE_TO_CARD                                              previewType → 卡片种类
 */

import { escapeHtml } from '@/src/core/escape.js';
import { renderShareCardBody } from './share-cards.js';

const PREVIEW_TYPE_LABELS = Object.freeze({
    'text': '文本预览',
    'music-card': '音乐卡片',
    'playlist-card': '歌单卡片',
    'listen-together-card': '一起听卡片',
    'red-packet-card': '红包卡片',
    'transfer-card': '转账卡片',
    'location-card': '位置卡片',
});

/**
 * previewType → share-cards 的卡片种类。
 * 加新卡片时这里和 share-cards.renderShareCardBody 的 switch 要一起改。
 */
export const PREVIEW_TYPE_TO_CARD = Object.freeze({
    'music-card': 'song',
    'playlist-card': 'playlist',
    'listen-together-card': 'listen-together',
    'red-packet-card': 'redpacket',
    'transfer-card': 'transfer',
    'location-card': 'location',
});

export const PREVIEW_TYPES = Object.freeze(['text', ...Object.keys(PREVIEW_TYPE_TO_CARD)]);

// [@param {string} previewType]接收一个字符串类型的previewType，返回一个字符串类型的标签文案[@returns {string}]
export function getPreviewTypeLabel(previewType) {
    return PREVIEW_TYPE_LABELS[previewType] || '其他';
}

/**
 * 把 prompt 的 previewData 补成对应卡片要的字段。
 *
 * previewData 是 App 作者随手写的，字段名不一定跟卡片内部一致
 * （写 song 的比写 title 的多、写 sender 的比写 senderName 的多）。
 * 这里做一次宽松映射，别让作者为了预览去背字段名。
 */
function normalizeCardData(kind, data = {}, label = '') {
    const d = data || {};
    switch (kind) {
        case 'song':
            return {
                title: d.title || d.song || d.name || label || '未命名歌曲',
                artist: d.artist || d.singer || '未知歌手',
                color: d.color || '#fb7299',
                songId: d.songId,
            };
        case 'playlist':
            return {
                name: d.name || d.title || label || '歌单',
                songCount: d.songCount ?? (Array.isArray(d.songNames) ? d.songNames.length : 0),
                songNames: d.songNames,
                color: d.color || '#fb7299',
                playlistId: d.playlistId,
            };
        case 'listen-together':
            return {
                title: d.title || d.song || '',
                artist: d.artist || d.singer || '',
                color: d.color || '#7c5cff',
                songId: d.songId,
            };
        case 'redpacket':
            return {
                style: d.style || 'normal',
                message: d.message || d.title || label || '恭喜发财',
                senderName: d.senderName || d.sender || '对方',
                amount: d.amount,
                coverTitle: d.coverTitle,
                coverSubtitle: d.coverSubtitle,
            };
        case 'transfer':
            return {
                amount: d.amount,
                note: d.note || d.message || d.title || label || '转账',
                received: !!d.received,
            };
        case 'location':
            return {
                name: d.name || d.title || label || '位置',
                address: d.address || '',
            };
        default:
            return d;
    }
}

// text 预览（纯文本框）—— 这一种在聊天里就是普通气泡，没有对应的卡片本体
function renderTextPreview(previewData, label) {
    const text = String(previewData?.text || previewData?.preview || label || '(空文本)');
    return `
        <div class="pm-preview-card pm-preview-card--text">
            <div class="pm-preview-card__text">${escapeHtml(text)}</div>
        </div>
    `;
}

/**
 * 渲染第三方 App Prompt 的卡片预览。
 * @param {object} opts
 * @param {string} opts.previewType  见 PREVIEW_TYPES
 * @param {object} [opts.previewData]
 * @param {string} [opts.label]
 * @returns {string} HTML 字符串
 */
export function renderAppPromptCardPreview({ previewType, previewData, label } = {}) {
    const data = previewData && typeof previewData === 'object' ? previewData : {};
    const kind = PREVIEW_TYPE_TO_CARD[previewType];
    if (!kind) return renderTextPreview(data, label);
    // interactive: false —— 预览里点卡片不该真的跳去播歌 / 开歌单
    const body = renderShareCardBody(kind, normalizeCardData(kind, data, label), { interactive: false });
    return body
        ? `<div class="pm-preview-card pm-preview-card--real">${body}</div>`
        : renderTextPreview(data, label);
}

export default renderAppPromptCardPreview;
