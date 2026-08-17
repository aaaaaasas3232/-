/**
 * chat-app / 系统卡片消息组件
 *
 * 系统卡片消息：左右居中显示，中间带消息操作组
 * 适用于：通话记录卡片、图片描述卡片等
 *
 * 特点：
 * - 整张卡片居中显示
 * - 底部有专属操作组
 *
 * 使用方式:
 *   import { renderCallRecordBubble, renderDescImageBubble } from './card-messages.js';
 */

import { escapeHtml } from '@/src/core/escape.js';
import { renderSelectButton, renderTime } from './message-actions.js';
import { renderShareCardWrapper } from './share-cards.js';
import { DEFAULT_AI_AVATAR_BG, DEFAULT_USER_AVATAR_BG } from '../aiMeta.js';

/**
 * 格式化通话时长(秒 → "x分y秒" / "x秒")
 */
export function formatCallDuration(seconds) {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins + '分' + (secs > 0 ? `${secs}秒` : '');
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours + '小时' + (mins > 0 ? `${mins}分` : '');
}

// ============================================
// 通话记录卡片
// ============================================

/**
 * 通话记录卡片 — 系统卡片消息
 *
 * 与普通 .message-bubble 的区别:
 *   - 没用头像 + 气泡组,而是 .call-record-card(整张卡片)
 *   - 工具组只在 hover 时显示,位置在卡片底部下方
 *
 * data-call-type="voice" / "video" 走 CSS 主题色切换
 */
export function renderCallRecordBubble(msg, contact = {}, options = {}) {
    const cr = msg.callRecord || {};
    const isVideo = cr.callType === 'video';
    const wasConnected = cr.wasConnected;
    const durationText = wasConnected ? formatCallDuration(cr.duration) : '未接通';

    // 通话图标
    const voiceIconSvg = `<svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
    const videoIconSvg = `<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;

    const arrowSvg = `<svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill="currentColor"/></svg>`;

    const iconSvg = isVideo ? videoIconSvg : voiceIconSvg;
    const titleText = isVideo ? '视频通话' : '语音通话';
    const msgCount = (cr.messages && cr.messages.length) || 0;

    // 摘要优先,否则显示消息数
    let summaryHtml = '';
    if (cr.summary) {
        summaryHtml = `<div class="call-record-summary">${escapeHtml(cr.summary)}</div>`;
    } else if (msgCount > 0) {
        summaryHtml = `<div class="call-record-msg-count">共 ${msgCount} 条消息</div>`;
    }

    // 卡片整体用 data-app-action 走 framework detail action
    // ★ v0.68 fix:cr.id 永远 undefined(callRecord 没有 id 字段)
    //   真实通话记录的唯一标识是外层 chatMessage.id
    const actionJson = JSON.stringify({
        action: 'detail',
        appId: 'chat',
        pageId: `call-record-${msg.id}`,
    });

    // 通话记录专属操作组(收藏/删除) — 全部走 data-app-action (v0.43)
    const actionsCtx = {
        sender: msg.sender || 'user',
        aiPersonId: options.aiPersonId || contact?.aiPersonId || contact?.id || '',
        mode: options.mode || 'calendar',
    };
    const favActionJson = escapeHtml(JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'favoriteMessage',
        payload: {
            messageId: msg.id,
            aiPersonId: actionsCtx.aiPersonId,
            mode: actionsCtx.mode,
            sender: actionsCtx.sender,
        },
    }));
    const delActionJson = escapeHtml(JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'deleteMessage',
        payload: {
            messageId: msg.id,
            aiPersonId: actionsCtx.aiPersonId,
            mode: actionsCtx.mode,
            sender: actionsCtx.sender,
        },
    }));
    const callRecordActions = `
        <div class="call-record-actions">
            <button class="action-btn" data-app-action="${favActionJson}" title="收藏">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="none" stroke="#FF6B9D" stroke-width="2"/></svg>
            </button>
            <button class="action-btn" data-app-action="${delActionJson}" title="删除">
                <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="#FF6B9D" stroke-width="2"/></svg>
            </button>
        </div>
    `;

    const selectBtnHtml = renderSelectButton(msg.id, actionsCtx);
    const timeHtml = renderTime(msg.time);

    return `
        <div class="message-wrapper special-msg-wrapper call-record-wrapper" data-message-id="${escapeHtml(msg.id)}" data-call-type="${escapeHtml(cr.callType)}" data-connected="${wasConnected ? 'true' : 'false'}" data-msg-ai="${escapeHtml(actionsCtx.aiPersonId || '')}" data-msg-mode="${escapeHtml(actionsCtx.mode || 'calendar')}">
            ${selectBtnHtml}
            <div class="call-record-card"
                 data-call-type="${escapeHtml(cr.callType)}"
                 data-connected="${wasConnected ? 'true' : 'false'}"
                 data-call-record-id="${escapeHtml(msg.id)}"
                 data-app-action='${escapeHtml(actionJson)}'>
                <div class="call-record-header">
                    <div class="call-record-icon">${iconSvg}</div>
                    <div class="call-record-text">
                        <div class="call-record-title">${escapeHtml(titleText)}</div>
                        <div class="call-record-duration">${escapeHtml(durationText)}</div>
                    </div>
                    <div class="call-record-arrow">${arrowSvg}</div>
                </div>
                ${summaryHtml}
            </div>
            ${callRecordActions}
            ${timeHtml}
        </div>
    `;
}

// ============================================
// 图片描述卡片
// ============================================

/**
 * 图片描述气泡 — 位置卡片风格
 *
 * 复用 renderShareCardWrapper 包装器
 */
export function renderDescImageBubble(msg, contact = {}, options = {}) {
    const desc = msg.imageDescription || msg.desc || '';
    const cardColor = msg.cardColor || '#FFE4EC';
    const textColor = msg.textColor || '#D4728A';
    const isUser = msg.sender === 'user';

    // 短描述（超过20字截断）
    const shortDesc = desc.length > 20 ? desc.substring(0, 20) + '...' : desc;

    // JSON 序列化 data 属性
    const dataDesc = escapeHtml(desc);
    const dataColor = escapeHtml(cardColor);
    const dataTextColor = escapeHtml(textColor);

    // 图片卡片气泡内容
    const bubbleHtml = `
        <div class="desc-image-card"
             data-desc="${dataDesc}"
             data-color="${dataColor}"
             data-text-color="${dataTextColor}">
            <div class="desc-image-card-inner" style="background: ${escapeHtml(cardColor)};">
                <div class="desc-image-card-icon" style="color: ${escapeHtml(textColor)};">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.7;">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                </div>
                <div class="desc-image-card-text-group">
                    <div class="desc-image-card-text" style="color: ${escapeHtml(textColor)}; font-size: 12px;">${escapeHtml(shortDesc)}</div>
                </div>
            </div>
        </div>
    `;

    const avatarBg = isUser ? DEFAULT_USER_AVATAR_BG : DEFAULT_AI_AVATAR_BG;
    // ★ v0.45:透传 userAvatar/userAvatarBg 用于真实社媒头像
    const userAvatarBg = options.userAvatarBg || '';
    const userAvatar = options.userAvatar || '';
    const aiAvatarBg = contact?.avatarBg || '';
    const aiAvatar = contact?.avatar || '';
    const finalAvatarBg = isUser ? (userAvatarBg || avatarBg) : (aiAvatarBg || avatarBg);
    const avatarUrl = isUser ? userAvatar : aiAvatar;
    return renderShareCardWrapper(msg, bubbleHtml, finalAvatarBg, options, avatarUrl);
}

// ============================================
// 通话消息气泡(call_chat)
// ============================================

/**
 * 通话中消息气泡 — 语音通话 / 视频通话 期间的文字消息
 *   - type='call_chat', sender='user'|'ai', content='...', callType='voice'|'video'
 *   - 左侧「📞」图标标识这是通话消息
 *   - 跟普通消息类似布局,只是加一个 type 标识符
 */
export function renderCallChatBubble(msg, contact = {}, options = {}) {
    const isUser = msg.sender === 'user';
    const content = String(msg.content || '').trim();
    if (!content) return '';
    const isVideo = msg.callType === 'video';
    const icon = isVideo ? '📹' : '📞';

    const actionsCtx = {
        sender: msg.sender || 'user',
        aiPersonId: options.aiPersonId || contact?.aiPersonId || contact?.id || '',
        mode: options.mode || 'calendar',
    };
    const selectBtnHtml = renderSelectButton(msg.id, actionsCtx);
    const timeHtml = renderTime(msg.time);

    const userAvatarBg = options.userAvatarBg || '';
    const userAvatar = options.userAvatar || '';
    const aiAvatarBg = contact?.avatarBg || '';
    const aiAvatar = contact?.avatar || '';
    const avatarBg = isUser ? (userAvatarBg || DEFAULT_USER_AVATAR_BG) : (aiAvatarBg || DEFAULT_AI_AVATAR_BG);
    const avatarUrl = isUser ? userAvatar : aiAvatar;
    const avatarChar = (content || '?').charAt(0);

    const avatarHtml = avatarUrl
        ? `<img src="${escapeHtml(avatarUrl)}" alt="" class="message-avatar-img" />`
        : `<div class="message-avatar" style="background:${escapeHtml(avatarBg)};">${escapeHtml(avatarChar)}</div>`;

    const wrapperClass = isUser ? 'message-wrapper message-user' : 'message-wrapper message-ai';

    return `
        <div class="${wrapperClass} call-chat-wrapper" data-message-id="${escapeHtml(msg.id)}" data-call-type="${escapeHtml(msg.callType || 'voice')}" data-msg-ai="${escapeHtml(actionsCtx.aiPersonId || '')}" data-msg-mode="${escapeHtml(actionsCtx.mode || 'calendar')}">
            ${selectBtnHtml}
            <div class="call-chat-tag">${icon} 通话中</div>
            <div class="message-content">
                <div class="message-avatar-wrap">${avatarHtml}</div>
                <div class="message-bubble call-chat-bubble">
                    <div class="message-bubble-text">${escapeHtml(content)}</div>
                </div>
            </div>
            ${timeHtml}
        </div>
    `;
}

// ============================================
// 通话结束系统提示(call_end_notice)
// ============================================

/**
 * 通话结束系统提示 — 居中显示的小条
 *   - type='call_end_notice', sender='system', content='[系统提示]...'
 *   - 用来让 AI 在下次聊天时知道「刚才的通话已结束」
 *   - 视觉:居中灰底小条
 */
export function renderCallEndNoticeBubble(msg, contact = {}, options = {}) {
    const content = String(msg.content || '[系统提示]通话已结束').trim();
    return `
        <div class="message-wrapper call-end-notice-wrapper" data-message-id="${escapeHtml(msg.id)}" data-msg-ai="${escapeHtml(options.aiPersonId || contact?.aiPersonId || contact?.id || '')}" data-msg-mode="${escapeHtml(options.mode || 'calendar')}">
            <div class="call-end-notice-bubble">
                <span class="call-end-notice-icon">📴</span>
                <span class="call-end-notice-text">${escapeHtml(content)}</span>
            </div>
        </div>
    `;
}

// ============================================
// 日期分割线
// ============================================

/**
 * 日期分割线 — 系统消息
 */
export function renderDateDivider(content) {
    return `
        <div class="date-divider">
            <span>${escapeHtml(content)}</span>
        </div>
    `;
}

// 导出所有系统卡片消息渲染函数
export const cardMessageRenderers = {
    call_record: renderCallRecordBubble,
    call_chat: renderCallChatBubble,
    call_end_notice: renderCallEndNoticeBubble,
    descriptive_image: renderDescImageBubble,
    date_divider: renderDateDivider,
};
