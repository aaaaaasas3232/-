/**
 * chat-app / 特殊消息组件
 *
 * 特殊消息：带头像的气泡消息，但内容特殊
 * 适用于：语音消息
 *
 * 使用方式:
 *   import { renderVoiceBubble } from './special-messages.js';
 */

import { escapeHtml } from '@/src/core/escape.js';
import { renderMessageActions, renderSelectButton, renderTime } from './message-actions.js';
import { DEFAULT_AI_AVATAR_BG, DEFAULT_USER_AVATAR_BG, resolveBubbleAvatar } from '../aiMeta.js';

// ============================================
// SVG 图标
// ============================================
const ICONS = {
    voice: `<svg width="12" height="12" viewBox="0 0 24 24" fill="white">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>`,
    arrowDown: `<svg width="10" height="10" viewBox="0 0 24 24" fill="#A8C8EC"><path d="M9 17l-5-5 5-5v10zm5 0V7l5 5-5 5z"/></svg>`,
};

// ============================================
// 语音消息
// ============================================

/**
 * 渲染波形条
 */
function generateWaveBars(count = 8) {
    const bars = [];
    for (let i = 0; i < count; i++) {
        bars.push(6 + Math.random() * 10);
    }
    return bars;
}

/**
 * 语音消息气泡
 *
 * 结构:头像 + 气泡(语音图标 + 波形 + 时长) + 转文字(点击展开) + 时间 + 工具组
 *
 * @param {Object} msg - 消息对象
 * @param {Object} contact - 联系人信息
 * @param {Object} options - { userAvatar, userAvatarBg, aiPersonId, mode, ... }
 */
export function renderVoiceBubble(msg, contact = {}, options = {}) {
    const isUser = msg.sender === 'user';

    const bubbleAv = resolveBubbleAvatar(msg, contact, options);
    const avatarBg = bubbleAv.bg || (isUser ? DEFAULT_USER_AVATAR_BG : DEFAULT_AI_AVATAR_BG);
    const avatarUrl = bubbleAv.url;
    const avatarText = isUser ? '我' : (msg.senderName?.charAt(0) || '?');
    const duration = msg.duration || msg.voiceDuration || 5;
    const voiceContent = msg.voiceContent || '';
    const showTranscribe = !!voiceContent;

    // 根据时长计算气泡宽度
    const voiceWidth = Math.min(50 + duration * 8, 180);
    const bubbleColor = isUser ? '#FFE8F0' : '#E8F2FF';
    const waveColor = isUser ? DEFAULT_USER_AVATAR_BG : DEFAULT_AI_AVATAR_BG;

    // 波形条
    const waveBars = generateWaveBars(8);

    // ★ v0.43 voice toggle 改成 data-app-action,framework 派发
    const toggleActionJson = escapeHtml(JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'toggleVoiceTranscribe',
        payload: { messageId: msg.id },
    }));
    // 转文字区域(默认隐藏,点击展开)
    const transcribeHtml = showTranscribe ? `
        <div class="voice-transcribe" data-voice-id="${escapeHtml(msg.id)}">
            <div class="voice-transcribe-toggle" data-app-action="${toggleActionJson}">
                ${ICONS.arrowDown}
                <span>转文字</span>
            </div>
            <div class="voice-transcribe-content">${escapeHtml(voiceContent)}</div>
        </div>
    ` : '';

    // 气泡内容:语音图标 + 波形 + 时长
    const bubbleContent = `
        <div class="voice-msg" style="min-width:${voiceWidth}px;cursor:pointer;" data-duration="${duration}" data-msg-id="${escapeHtml(msg.id)}">
            <div class="voice-msg-row">
                <div class="voice-icon" style="background:linear-gradient(135deg,${waveColor},${isUser ? '#E090B0' : '#7BA3D8'});">
                    ${ICONS.voice}
                </div>
                <div class="voice-wave">
                    ${waveBars.map((h, i) => `<span style="height:${h}px;"></span>`).join('')}
                </div>
                <span class="voice-duration-text">${duration}″</span>
            </div>
            ${transcribeHtml}
        </div>
    `;

    // ★ v0.43 把 aiPersonId/mode 透传到操作按钮
    // ★ v0.44 同时透传 text/senderLabel 用于引用回复预览
    const senderLabel = msg.senderName || (msg.sender === 'user' ? '我' : (contact?.name || ''));
    const actionsCtx = {
        sender: msg.sender || 'user',
        aiPersonId: options.aiPersonId || contact?.aiPersonId || contact?.id || '',
        mode: options.mode || 'calendar',
        text: voiceContent || '',
        senderLabel,
        // ★ v0.72 透传 conversationType + senderId,让重roll 按钮能识别群聊
        conversationType: options.conversationType || msg.conversationType || 'private',
        senderId: msg.senderId || '',
    };
    const actionsHtml = renderMessageActions(msg.id, actionsCtx, {
        ...options,
        showEdit: false,
        showForward: false,
    });
    const selectBtnHtml = renderSelectButton(msg.id, actionsCtx);
    const timeHtml = renderTime(msg.time);

    // ★ v0.45:有 avatarUrl 就渲染 img,没有就走首字母 placeholder
    let avatarInner;
    if (avatarUrl && typeof avatarUrl === 'string') {
        avatarInner = `<img src="${escapeHtml(avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`;
    } else {
        avatarInner = escapeHtml(avatarText);
    }
    const avatarHtml = `
        <div class="avatar ${isUser ? 'self' : 'other'}" data-poke="${isUser ? 'self' : 'other'}" style="background: ${avatarBg};">
            ${avatarInner}
        </div>
    `;

    return `
        <div class="message-wrapper ${msg.sender}" data-message-id="${escapeHtml(msg.id)}" data-msg-type="voice" data-msg-ai="${escapeHtml(actionsCtx.aiPersonId || '')}" data-msg-mode="${escapeHtml(actionsCtx.mode || 'calendar')}">
            ${selectBtnHtml}
            <div class="message ${isUser ? 'sent' : 'received'}">
                ${avatarHtml}
                <div class="message-content">
                    <div class="message-bubble voice-bubble" style="background:${bubbleColor};">
                        ${bubbleContent}
                    </div>
                    ${timeHtml}
                    ${actionsHtml}
                </div>
            </div>
        </div>
    `;
}

// ============================================
// 导出
// ============================================

export const specialMessageRenderers = {
    voice: renderVoiceBubble,
};
