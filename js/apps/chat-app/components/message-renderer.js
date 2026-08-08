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
import { renderCallRecordBubble, renderDescImageBubble, renderDateDivider } from './card-messages.js';
import { renderLocationBubble, renderRedpacketBubble, renderTransferBubble, renderChatRecordBubble } from './share-cards.js';
import { renderVoiceBubble } from './special-messages.js';

// ============================================
// 消息类型映射
// ============================================

/**
 * 系统卡片消息渲染器映射
 */
const cardMessageRenderers = {
    call_record: renderCallRecordBubble,
    descriptive_image: renderDescImageBubble,
};

/**
 * 分享卡片消息渲染器映射
 */
const shareCardRenderers = {
    location: renderLocationBubble,
    redpacket: renderRedpacketBubble,
    transfer: renderTransferBubble,
    chat_record: renderChatRecordBubble,
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
    const { type, sender } = msg;

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
    // 特殊消息
    renderVoiceBubble,
};
