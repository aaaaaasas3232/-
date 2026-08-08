/**
 * chat-app / 普通文本消息气泡组件
 *
 * 可复用的文本消息气泡，支持：
 * - 文本消息
 * - 图片消息
 * - 表情包消息
 * - 引用回复
 *
 * 使用方式:
 *   import { renderTextBubble } from './text-bubble.js';
 *   const bubbleHtml = renderTextBubble(msg);
 */

import { escapeHtml } from '@/src/core/escape.js';
import { renderMessageActions, renderSelectButton, renderAvatar, renderReplyQuote, renderTime } from './message-actions.js';

/**
 * 渲染消息内容
 *
 * @param {Object} msg - 消息对象
 * @returns {string} HTML 字符串
 */
function renderMessageContent(msg) {
    let contentHtml = '';

    switch (msg.type) {
        case 'text':
            contentHtml = escapeHtml(msg.content).replace(/\n/g, '<br>');
            break;
        case 'image':
            contentHtml = `<img class="image-message" src="${escapeHtml(msg.url)}" alt="图片" loading="lazy" />`;
            break;
        case 'sticker':
            contentHtml = `<img class="sticker-message" src="${escapeHtml(msg.url)}" alt="表情包" loading="lazy" />`;
            break;
        default:
            contentHtml = escapeHtml(msg.content || '');
    }

    return contentHtml;
}

/**
 * 渲染普通文本消息气泡
 *
 * @param {Object} msg - 消息对象
 * @param {Object} contact - 联系人信息 (可选)
 * @param {Object} options - 可选配置
 * @param {string} options.aiPersonId   会话 AI 人设 id (用于 data-app-action 派发)
 * @param {string} options.mode         'calendar' | 'story'
 * @param {boolean} options.showEdit    是否显示编辑按钮 (默认 true)
 * @returns {string} HTML 字符串
 */
export function renderTextBubble(msg, contact = {}, options = {}) {
    const isUser = msg.sender === 'user';
    const isAi = msg.sender === 'ai';

    const contentHtml = renderMessageContent(msg);
    const replyHtml = renderReplyQuote(msg.replyTo);
    // ★ v0.43 把 aiPersonId/mode 透传到操作按钮,确保 data-app-action 的 payload 完整
    // ★ v0.44 同时透传 text/senderLabel 用于引用回复预览
    const senderLabel = msg.senderName || (msg.sender === 'user' ? '我' : (contact?.name || ''));
    const actionsCtx = {
        sender: msg.sender || 'user',
        aiPersonId: options.aiPersonId || contact?.aiPersonId || contact?.id || '',
        mode: options.mode || 'calendar',
        text: msg.content || '',
        senderLabel,
    };
    const actionsHtml = renderMessageActions(msg.id, actionsCtx, options);
    const selectBtnHtml = renderSelectButton(msg.id, actionsCtx);
    // ★ v0.31 chat-page 把 ai 实时 avatar / avatarBg 塞进 contact,
    //   用实时社媒头像替换旧的「派生首字母 + fallback 色」逻辑
    // ★ v0.32 self 也支持:userAvatar / userAvatarBg 从 options 传入
    //   (chat-page 计算 user 的 socialProfiles.chat.avatar 后塞 options)
    const aiAvatar = !isUser ? (contact?.avatar || '') : '';
    const aiAvatarBg = !isUser ? (contact?.avatarBg || '') : '';
    const userAvatar = isUser ? (options.userAvatar || '') : '';
    const userAvatarBg = isUser ? (options.userAvatarBg || '') : '';
    const selfAvatar = userAvatar;
    const selfAvatarBg = userAvatarBg;
    const avatarHtml = renderAvatar(isUser, msg.senderName, aiAvatarBg || selfAvatarBg || null, aiAvatar || selfAvatar);
    const timeHtml = renderTime(msg.time);

    return `
        <div class="message-wrapper ${msg.sender}" data-message-id="${escapeHtml(msg.id)}" data-msg-ai="${escapeHtml(actionsCtx.aiPersonId)}" data-msg-mode="${escapeHtml(actionsCtx.mode)}">
            ${selectBtnHtml}
            <div class="message ${isUser ? 'sent' : 'received'}">
                ${avatarHtml}
                <div class="message-content">
                    ${replyHtml}
                    <div class="message-bubble">
                        ${contentHtml}
                    </div>
                    ${timeHtml}
                    ${actionsHtml}
                </div>
            </div>
        </div>
    `;
}

/**
 * 快速渲染文本消息（用于批量渲染）
 *
 * @param {Array} messages - 消息数组
 * @param {Object} contact - 联系人信息 (可选)
 * @param {Object} options - 可选配置
 * @returns {string} HTML 字符串
 */
export function renderTextBubbles(messages, contact = {}, options = {}) {
    return messages
        .filter(msg => msg.type === 'text' || msg.type === 'image' || msg.type === 'sticker')
        .map(msg => renderTextBubble(msg, contact, options))
        .join('');
}
