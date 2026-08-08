/**
 * chat-app / 分享卡片消息组件
 *
 * 分享卡片消息：带头像的气泡卡片
 * 适用于：位置卡片、红包卡片、转账卡片
 *
 * 结构跟普通文本气泡一样(avatar + bubble + time + actions)，
 * 只是 .message-bubble 内部塞的是卡片本身
 *
 * 使用方式:
 *   import { renderLocationBubble, renderRedpacketBubble, renderTransferBubble } from './share-cards.js';
 */

import { escapeHtml } from '@/src/core/escape.js';
import { renderMessageActions, renderSelectButton, renderAvatar, renderTime } from './message-actions.js';

// ============================================
// SVG 图标
// ============================================
const ICONS = {
    mapPin: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
    arrow: `<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" fill="currentColor"/></svg>`,
};

// ============================================
// 位置卡片
// ============================================

/**
 * 位置卡片气泡
 *
 * 1:1 复原 chat.js 位置卡片样式
 * 卡片本体放进 .message-bubble 内部
 *
 * @param {Object} msg - 消息对象
 * @param {Object} contact - 联系人信息
 * @param {Object} options - { userAvatar, userAvatarBg, aiPersonId, mode, ... }
 */
export function renderLocationBubble(msg, contact = {}, options = {}) {
    const lc = msg.locationCard || {};
    const name = escapeHtml(lc.name || '位置');
    const address = escapeHtml(lc.address || '');
    const isUser = msg.sender === 'user';

    // ★ v0.45 头像支持真实社媒头像:优先从 options 拿,fallback 到 contact/msg 字段
    const userAvatarBg = options.userAvatarBg || '';
    const userAvatar = options.userAvatar || '';
    const aiAvatarBg = contact?.avatarBg || '';
    const aiAvatar = contact?.avatar || '';
    const avatarBg = isUser
        ? (userAvatarBg || '#F4A6CD')
        : (aiAvatarBg || '#A8C8EC');
    const avatarUrl = isUser ? userAvatar : aiAvatar;

    const bubbleHtml = `
        <div class="location-card-in-chat" data-msg-id="${escapeHtml(msg.id)}" data-location-name="${escapeHtml(lc.name || '位置')}" data-location-address="${escapeHtml(lc.address || '')}">
            <div class="location-card-map">
                <div class="location-card-map-grid"></div>
                <div class="location-card-map-icon">${ICONS.mapPin}</div>
            </div>
            <div class="location-card-info">
                <div class="location-card-name">${name}</div>
                ${address ? `<div class="location-card-address">${address}</div>` : ''}
            </div>
        </div>
    `;

    // renderShareCardWrapper 参数顺序: msg, bubbleHtml, avatarBg, contact, options
    return renderShareCardWrapper(msg, bubbleHtml, avatarBg, contact, options, avatarUrl);
}

// ============================================
// 红包卡片
// ============================================

/**
 * 红包卡片气泡
 *
 * 4 种样式:
 * - normal: 普通红包-未拆
 * - opened: 已领取红包
 * - expired: 已过期/被拒绝
 * - cover: 口令红包封面
 *
 * @param {Object} msg - 消息对象
 * @param {Object} contact - 联系人信息
 * @param {Object} options - { userAvatar, userAvatarBg, aiPersonId, mode, ... }
 */
export function renderRedpacketBubble(msg, contact = {}, options = {}) {
    const rp = msg.redpacketCard || {};
    const style = rp.style || 'normal';
    const isUser = msg.sender === 'user';

    // ★ v0.45 头像支持真实社媒头像
    const userAvatarBg = options.userAvatarBg || '';
    const userAvatar = options.userAvatar || '';
    const aiAvatarBg = contact?.avatarBg || '';
    const aiAvatar = contact?.avatar || '';
    const avatarBg = isUser
        ? (userAvatarBg || '#F4A6CD')
        : (aiAvatarBg || '#A8C8EC');
    const avatarUrl = isUser ? userAvatar : aiAvatar;

    let bubbleHtml = '';

    // ===== 样式1: normal 普通红包-未拆 =====
    if (style === 'normal' || !rp.style) {
        const rpIconSvg = `<svg width="17" height="17" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="8"/><text x="12" y="16" text-anchor="middle" font-size="10" fill="#FF6B8A" font-weight="bold">¥</text></svg>`;
        const message = escapeHtml(rp.message || '恭喜发财');
        bubbleHtml = `
            <div class="redpacket-card" data-msg-id="${escapeHtml(msg.id)}">
                <div class="redpacket-header">
                    <div class="redpacket-icon">${rpIconSvg}</div>
                    <div class="redpacket-text">
                        <div class="redpacket-title">${message}</div>
                        <div class="redpacket-sender">对方发来红包</div>
                    </div>
                </div>
                <div class="redpacket-footer">
                    <span class="redpacket-cta">点击领取红包</span>
                </div>
            </div>
        `;
    }
    // ===== 样式2: opened 已领取 =====
    else if (style === 'opened') {
        const rpIconSvg = `<svg width="17" height="17" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="8"/><text x="12" y="16" text-anchor="middle" font-size="10" fill="#FF6B8A" font-weight="bold">¥</text></svg>`;
        const message = escapeHtml(rp.message || '恭喜发财');
        const amountText = rp.amount ? `已领取 ¥${rp.amount.toFixed(2)}` : '已领取';
        bubbleHtml = `
            <div class="redpacket-card opened" data-msg-id="${escapeHtml(msg.id)}">
                <div class="redpacket-header">
                    <div class="redpacket-icon">${rpIconSvg}</div>
                    <div class="redpacket-text">
                        <div class="redpacket-title">${message}</div>
                        <div class="redpacket-sender">对方发来红包</div>
                    </div>
                </div>
                <div class="redpacket-footer">
                    <span class="redpacket-cta" style="color:#999;">${amountText}</span>
                </div>
            </div>
        `;
    }
    // ===== 样式3: expired 已过期/被拒绝 =====
    else if (style === 'expired') {
        const rpIconSvg = `<svg width="17" height="17" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="8"/><text x="12" y="16" text-anchor="middle" font-size="10" fill="#999" font-weight="bold">¥</text></svg>`;
        const message = escapeHtml(rp.message || '恭喜发财');
        bubbleHtml = `
            <div class="redpacket-card expired" data-msg-id="${escapeHtml(msg.id)}">
                <div class="redpacket-header" style="background:linear-gradient(135deg,#999,#777);">
                    <div class="redpacket-icon">${rpIconSvg}</div>
                    <div class="redpacket-text">
                        <div class="redpacket-title">${message}</div>
                        <div class="redpacket-sender">红包已过期</div>
                    </div>
                </div>
                <div class="redpacket-footer">
                    <span class="redpacket-cta" style="color:#999;">点击领取红包</span>
                </div>
            </div>
        `;
    }
    // ===== 样式4: cover 口令红包封面 =====
    else if (style === 'cover') {
        const coverTitle = escapeHtml(rp.coverTitle || '口令红包');
        const coverSubtitle = escapeHtml(rp.coverSubtitle || '发送口令领取');
        bubbleHtml = `
            <div class="redpacket-card cover" data-msg-id="${escapeHtml(msg.id)}">
                <div class="redpacket-cover-bg">
                    <div class="redpacket-cover-title">${coverTitle}</div>
                    <div class="redpacket-cover-subtitle">${coverSubtitle}</div>
                </div>
                <div class="redpacket-footer">
                    <span class="redpacket-cta">口令红包</span>
                </div>
            </div>
        `;
    }

    return renderShareCardWrapper(msg, bubbleHtml, avatarBg, contact, options, avatarUrl);
}

// ============================================
// 转账卡片
// ============================================

/**
 * 转账卡片气泡
 *
 * 2 种状态:
 * - received: false: 待收款
 * - received: true: 已收款
 *
 * @param {Object} msg - 消息对象
 * @param {Object} contact - 联系人信息
 * @param {Object} options - { userAvatar, userAvatarBg, aiPersonId, mode, ... }
 */
export function renderTransferBubble(msg, contact = {}, options = {}) {
    const tc = msg.transferCard || {};
    const isUser = msg.sender === 'user';

    // ★ v0.45 头像支持真实社媒头像
    const userAvatarBg = options.userAvatarBg || '';
    const userAvatar = options.userAvatar || '';
    const aiAvatarBg = contact?.avatarBg || '';
    const aiAvatar = contact?.avatar || '';
    const avatarBg = isUser
        ? (userAvatarBg || '#F4A6CD')
        : (aiAvatarBg || '#A8C8EC');
    const avatarUrl = isUser ? userAvatar : aiAvatar;
    const received = !!tc.received;

    const note = escapeHtml(tc.note || '转账');
    const amountText = tc.amount ? `¥${tc.amount.toFixed(2)}` : '¥0.00';
    const statusText = received ? '已收款' : '待收款';
    const statusColor = received ? '#52c41a' : '#FF6B8A';

    const bubbleHtml = `
        <div class="transfer-card" data-msg-id="${escapeHtml(msg.id)}">
            <div class="transfer-header">
                <div class="transfer-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="transfer-info">
                    <div class="transfer-amount">${amountText}</div>
                    <div class="transfer-note">${note}</div>
                </div>
            </div>
            <div class="transfer-footer">
                <span class="transfer-status" style="color:${statusColor};">${statusText}</span>
                ${received ? '<span class="transfer-check">✓</span>' : ''}
            </div>
        </div>
    `;

    return renderShareCardWrapper(msg, bubbleHtml, avatarBg, contact, options, avatarUrl);
}

// ============================================
// 通用包装器
// ============================================

/**
 * 分享卡片包装器
 *
 * 复用普通气泡的结构(avatar + content + bubble + time + actions)
 *
 * @param {Object} msg
 * @param {string} bubbleHtml
 * @param {string} avatarBg
 * @param {Object} [contact]
 * @param {Object} [options]
 * @param {string} [avatarUrl] - ★ v0.45 真实头像 URL，有则渲染 img，无则 fallback 首字母
 */
export function renderShareCardWrapper(msg, bubbleHtml, avatarBg, contact = {}, options = {}, avatarUrl = '') {
    const isUser = msg.sender === 'user';
    const avatarText = isUser ? '我' : (msg.senderName?.charAt(0) || '?');

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

    // ★ v0.43 把 aiPersonId/mode 透传到操作按钮,确保 data-app-action 的 payload 完整
    // ★ v0.44 同时透传 text/senderLabel 用于引用回复预览
    const senderLabel = msg.senderName || (msg.sender === 'user' ? '我' : (contact?.name || ''));
    // 提取卡片摘要文本用于引用回复预览
    let cardText = '';
    if (msg.locationCard) {
        cardText = msg.locationCard.name || msg.locationCard.address || '';
    } else if (msg.redpacketCard) {
        cardText = msg.redpacketCard.message || '[红包]';
    } else if (msg.transferCard) {
        cardText = `${msg.transferCard.note || '[转账]'} ¥${msg.transferCard.amount}`;
    }
    const actionsCtx = {
        sender: msg.sender || 'user',
        aiPersonId: options.aiPersonId || contact?.aiPersonId || contact?.id || '',
        mode: options.mode || 'calendar',
        text: cardText,
        senderLabel,
    };
    const actionsHtml = renderMessageActions(msg.id, actionsCtx, options);
    const selectBtnHtml = renderSelectButton(msg.id, actionsCtx);
    const timeHtml = renderTime(msg.time);

    return `
        <div class="message-wrapper ${msg.sender}" data-message-id="${escapeHtml(msg.id)}" data-msg-ai="${escapeHtml(actionsCtx.aiPersonId || '')}" data-msg-mode="${escapeHtml(actionsCtx.mode || 'calendar')}">
            ${selectBtnHtml}
            <div class="message ${isUser ? 'sent' : 'received'}">
                ${avatarHtml}
                <div class="message-content">
                    <div class="message-bubble message-bubble-card">
                        ${bubbleHtml}
                    </div>
                    ${timeHtml}
                    ${actionsHtml}
                </div>
            </div>
        </div>
    `;
}

/**
 * 转发消息卡片气泡（v0.33）
 *
 * 两种渲染形态:
 *   - 单条消息转发:取 messages[0] 完整显示(avatar + text + 简短 quote)
 *   - 多条消息合并转发:展示 title + 折叠预览列表,可点击展开
 *
 * 数据结构 (msg.chatRecord):
 *   {
 *     title: "聊天记录",                    // 卡片标题
 *     mode: 'calendar' | 'story',           // 来源模式
 *     sourceConversationType: 'private' | 'group',
 *     sourceConversationId: string,         // 群聊或私聊的 id
 *     sourceConversationName: string,       // 群聊/私聊显示名
 *     participants: string[],               // 参与人(用户 + AI)
 *     messages: [{                           // 包含的消息
 *       sender: 'user' | 'ai',
 *       senderName: string,
 *       senderId: string,
 *       type: 'text' | 'image' | ...,
 *       content: string,
 *       timestamp: number,
 *     }],
 *     totalCount: number,                    // 原始消息总数(可能 > messages.length)
 *     createdAt: number,                     // 转发时间戳
 *   }
 */
export function renderChatRecordBubble(msg, contact = {}, options = {}) {
    const record = msg.chatRecord || {};
    const messages = Array.isArray(record.messages) ? record.messages : [];
    const isUser = msg.sender === 'user';

    // ★ v0.45 头像支持真实社媒头像
    const userAvatarBg = options.userAvatarBg || '';
    const userAvatar = options.userAvatar || '';
    const aiAvatarBg = contact?.avatarBg || '';
    const aiAvatar = contact?.avatar || '';
    const avatarBg = isUser
        ? (userAvatarBg || '#F4A6CD')
        : (aiAvatarBg || '#A8C8EC');
    const avatarUrl = isUser ? userAvatar : aiAvatar;

    const isSingle = messages.length === 1;
    const title = escapeHtml(record.title || '聊天记录');
    const totalCount = record.totalCount || messages.length;
    const overflowNote = totalCount > messages.length
        ? `<span class="chat-record-overflow">等 ${totalCount} 条消息</span>`
        : '';

    let inner;
    if (isSingle) {
        // 单条消息：完整显示
        const m = messages[0];
        const mSender = m.sender === 'user' ? '我' : escapeHtml(m.senderName || '?');
        const mText = escapeHtml(m.content || `[${m.type || '消息'}]`);
        inner = `
            <div class="chat-record-header">
                <svg class="chat-record-header-icon" viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"></path>
                </svg>
                <span class="chat-record-header-title"><span class="chat-record-label">[聊天记录]</span></span>
            </div>
            <div class="chat-record-body chat-record-single">
                <div class="chat-record-quote">
                    <span class="chat-record-quote-sender">${mSender}:</span>
                    <span class="chat-record-quote-text">${mText}</span>
                </div>
            </div>
        `;
    } else {
        // 多条：折叠预览 3 条
        const preview = messages.slice(0, 3).map((m) => {
            const mSender = m.sender === 'user' ? '我' : escapeHtml(m.senderName || '?');
            const mText = escapeHtml(m.content || `[${m.type || '消息'}]`);
            return `
                <div class="chat-record-preview-row">
                    <span class="chat-record-preview-sender">${mSender}:</span>
                    <span class="chat-record-preview-text">${mText}</span>
                </div>
            `;
        }).join('');
        inner = `
            <div class="chat-record-header">
                <svg class="chat-record-header-icon" viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"></path>
                </svg>
                <span class="chat-record-header-title"><span class="chat-record-label">[聊天记录]</span></span>
            </div>
            <div class="chat-record-body chat-record-multi">
                ${preview}
            </div>
            <div class="chat-record-footer">
                <span class="chat-record-count">共${totalCount}条消息</span>
                <span class="chat-record-view-detail">查看详情</span>
            </div>
        `;
    }

    // ★ v0.33 把完整 record JSON 写到 dataset,弹窗直接从 card DOM 拿,
    //   避免被 rawMessages slice(-100) 截断后找不到
    const recordData = {
        title: record.title || '',
        mode: record.mode || 'calendar',
        sourceConversationType: record.sourceConversationType || '',
        sourceConversationId: record.sourceConversationId || '',
        messages: Array.isArray(record.messages) ? record.messages.map((m) => ({
            id: m.id,
            sender: m.sender,
            senderName: m.senderName || '',
            type: m.type || 'text',
            content: typeof m.content === 'string' ? m.content : '',
            timestamp: m.timestamp || 0,
        })) : [],
    };
    const recordDataAttr = ` data-record-data="${escapeHtml(JSON.stringify(recordData))}"`;

    const bubbleHtml = `
        <div class="chat-record-card" data-app-action='{"action":"appMethod","appId":"chat","method":"openChatRecordDetail","payload":{"msgId":"${escapeHtml(msg.id)}"}}' data-msg-id="${escapeHtml(msg.id)}" data-record-mode="${escapeHtml(record.mode || '')}" data-record-source-type="${escapeHtml(record.sourceConversationType || '')}" data-record-source-id="${escapeHtml(record.sourceConversationId || '')}"${recordDataAttr}>
            ${inner}
        </div>
    `;

    return renderShareCardWrapper(msg, bubbleHtml, avatarBg, contact, options, avatarUrl);
}

// ============================================
// 导出
// ============================================

export const shareCardRenderers = {
    location: renderLocationBubble,
    redpacket: renderRedpacketBubble,
    transfer: renderTransferBubble,
    chatRecord: renderChatRecordBubble,
};
