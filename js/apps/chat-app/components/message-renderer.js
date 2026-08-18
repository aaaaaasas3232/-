/**
 * chat-app / 消息主渲染器
 *
 * 统一的消息渲染入口，根据消息类型分发到各个组件
 *
 * 消息分类：
 * - 系统消息: system (日期分割线)
 * - 系统卡片消息: call_record, descriptive_image (居中卡片)
 * - 分享卡片消息: location, redpacket, transfer (带头像的卡片)
 * - 特殊消息: voice (语音消息)
 * - 普通消息: text, image, sticker (文本气泡)
 *
 * 使用方式:
 *   import { renderMessage } from './message-renderer.js';
 *   const html = renderMessage(msg, contact);
 */

import { escapeHtml } from '@/src/core/escape.js';

// 导入各个组件
import { renderTextBubble } from './text-bubble.js';
import { renderCallRecordBubble, renderCallChatBubble, renderCallEndNoticeBubble, renderDescImageBubble, renderDateDivider } from './card-messages.js';
import {
    renderLocationBubble,
    renderRedpacketBubble,
    renderTransferBubble,
    renderChatRecordBubble,
    renderMomentShareBubble,
    renderSongShareBubble,
    renderPlaylistShareBubble,
    renderListenTogetherBubble,
    renderShopItemBubble,
    renderShopGiftBubble,
    renderShopTheaterBubble,
    renderYoutubeVideoBubble,
    renderBlogPostBubble,
} from './share-cards.js';
import { renderVoiceBubble } from './special-messages.js';
import { renderGameRecordBubble } from './game-cards.js';

// ============================================
// 消息类型映射
// ============================================

/**
 * 系统卡片消息渲染器映射
 */
const cardMessageRenderers = {
    call_record: renderCallRecordBubble,
    call_chat: renderCallChatBubble,
    call_end_notice: renderCallEndNoticeBubble,
    descriptive_image: renderDescImageBubble,
    // 群聊小游戏战绩卡。写入侧在 games/core/record.js，
    // 三处（写入 type / 这张注册表 / 渲染器）必须对齐，少一处就画不出来
    game_record: renderGameRecordBubble,
};

/**
 * 分享卡片消息渲染器映射
 */
const shareCardRenderers = {
    location: renderLocationBubble,
    redpacket: renderRedpacketBubble,
    transfer: renderTransferBubble,
    chat_record: renderChatRecordBubble,
    'share-card': renderMomentShareBubble,
    // 音乐（由 music app 的 chat-bridge 或 AI 的特殊动作写入）
    song_share: renderSongShareBubble,
    playlist_share: renderPlaylistShareBubble,
    listen_together_invite: renderListenTogetherBubble,
    // 四叶草购物（由 shop app 的 gift-service 或 AI 的 [送礼:] 写入）。
    // 写入 type / 这张注册表 / 渲染器三处必须对齐，少一处就画不出来
    shop_item_share: renderShopItemBubble,
    shop_gift: renderShopGiftBubble,
    shop_theater_share: renderShopTheaterBubble,
    // 萤火视频（由 youtube app 的 chat-bridge 或 AI 的 [分享视频:] 写入）。
    // 同样三处对齐：写入 type / 这张注册表 / share-cards 渲染器
    youtube_video_share: renderYoutubeVideoBubble,
    // 氧气帖子（由 blog app 的 chat-bridge 或 AI 的 [分享帖子:] 写入）。
    // 同样三处对齐：写入 type / 这张注册表 / share-cards 渲染器
    blog_post_share: renderBlogPostBubble,
};

/**
 * 特殊消息渲染器映射
 */
const specialMessageRenderers = {
    voice: renderVoiceBubble,
};

/**
 * 普通消息渲染器
 */
const textMessageTypes = ['text', 'image', 'sticker'];

/**
 * 系统消息类型
 */
const systemMessageTypes = ['system'];

/**
 * 拍一拍消息渲染器（v0.45）
 *
 * 居中气泡，无头像，格式:「用户 拍了拍 对方」
 * 从 msg.content 直接读取文字内容
 */
function renderPatBubble(msg, contact = {}, options = {}) {
    const text = escapeHtml(msg.content || '');
    const aiPersonId = options.aiPersonId || contact?.aiPersonId || contact?.id || '';
    const mode = options.mode || 'calendar';
    return `
        <div class="message-wrapper pat-bubble" data-message-id="${escapeHtml(msg.id || '')}" data-msg-ai="${escapeHtml(aiPersonId)}" data-msg-mode="${escapeHtml(mode)}">
            <div class="pat-bubble-inner">
                <div class="pat-bubble-text">${text}</div>
            </div>
        </div>
    `;
}

/**
 * 群公告（群主 / 管理员 / 群昵称变更）
 *
 * 视觉跟「拍一拍」完全一致：居中、灰色小字、无气泡框。
 * 复用 pat-bubble 的 class 而不是另写一套 —— 两者是同一种「系统悄悄说一句」，
 * 视觉不同 ≠ 结构不同（AGENTS2 §13.6.3 的同款判断）。
 * 额外加一个 group-notice class，方便以后单独调色。
 */
function renderGroupNoticeBubble(msg, contact = {}, options = {}) {
    const text = escapeHtml(msg.content || '');
    const convId = options.aiPersonId || contact?.aiPersonId || contact?.id || '';
    const mode = options.mode || 'calendar';
    return `
        <div class="message-wrapper pat-bubble group-notice-bubble" data-message-id="${escapeHtml(msg.id || '')}" data-msg-ai="${escapeHtml(convId)}" data-msg-mode="${escapeHtml(mode)}">
            <div class="pat-bubble-inner">
                <div class="pat-bubble-text">${text}</div>
            </div>
        </div>
    `;
}

// ============================================
// 主渲染函数
// ============================================

/**
 * 渲染单条消息
 *
 * @param {Object} msg - 消息对象
 * @param {Object} contact - 联系人信息 (可选)
 * @param {Object} options - 可选配置
 * @returns {string} HTML 字符串
 */
export function renderMessage(msg, contact = {}, options = {}) {
    let { type } = msg;
    // 工具栏「图片」/ AI 段可能写成 image 且没有真实 url，按描述图卡片画
    if (type === 'image' && !(msg.url || msg.imageUrl)) {
        type = 'descriptive_image';
        msg = { ...msg, type };
    }

    // 系统消息 - 日期分割线
    if (type === 'system') {
        return renderDateDivider(msg.content);
    }

    // 系统卡片消息 - 居中卡片
    if (cardMessageRenderers[type]) {
        return cardMessageRenderers[type](msg, contact, options);
    }

    // 分享卡片消息 - 带头像的卡片
    // chat_record 用 chatRecord 字段，其他直接用对应渲染器处理
    if (type === 'chat_record' && msg.chatRecord) {
        return renderChatRecordBubble(msg, contact, options);
    }
    // ★ 修复:如果 shareCardRenderers 中有这个类型，直接调用（渲染器自己会处理空数据）
    if (shareCardRenderers[type]) {
        return shareCardRenderers[type](msg, contact, options);
    }

    // 特殊消息 - 语音等
    if (specialMessageRenderers[type]) {
        return specialMessageRenderers[type](msg, contact, options);
    }

    // 拍一拍消息（居中气泡）
    if (type === 'pat') {
        return renderPatBubble(msg, contact, options);
    }

    // 群公告（设管理员 / 改群昵称 / 转让群主），同款居中灰字
    if (type === 'group_notice') {
        return renderGroupNoticeBubble(msg, contact, options);
    }

    // 普通消息 - 文本气泡
    if (textMessageTypes.includes(type)) {
        return renderTextBubble(msg, contact, options);
    }

    // 默认: 返回空字符串（未知消息类型）
    console.warn(`[MessageRenderer] Unknown message type: ${type}`);
    return '';
}

/**
 * 渲染消息列表
 *
 * @param {Array} messages - 消息数组
 * @param {Object} contact - 联系人信息 (可选)
 * @param {Object} options - 可选配置
 * @returns {string} HTML 字符串
 */
export function renderMessageList(messages, contact = {}, options = {}) {
    return messages.map(msg => renderMessage(msg, contact, options)).join('');
}

/**
 * 按类型统计消息
 *
 * @param {Array} messages - 消息数组
 * @returns {Object} 统计结果 { text: 0, image: 0, voice: 0, ... }
 */
export function countMessagesByType(messages) {
    return messages.reduce((acc, msg) => {
        const type = msg.type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});
}

// ============================================
// 导出所有渲染器（方便直接调用）
// ============================================

export {
    // 普通消息
    renderTextBubble,
    // 系统卡片消息
    renderCallRecordBubble,
    renderDescImageBubble,
    renderDateDivider,
    // 分享卡片消息
    renderLocationBubble,
    renderRedpacketBubble,
    renderTransferBubble,
    renderChatRecordBubble,
    renderMomentShareBubble,
    // 特殊消息
    renderVoiceBubble,
    // 系统提示类
    renderPatBubble,
    renderGroupNoticeBubble,
    // 群聊小游戏
    renderGameRecordBubble,
    // 四叶草购物
    renderShopItemBubble,
    renderShopGiftBubble,
    renderShopTheaterBubble,
};
