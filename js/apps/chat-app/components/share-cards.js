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

import { renderMessageActions, renderSelectButton, renderTime } from './message-actions.js';
import { DEFAULT_AI_AVATAR_BG, DEFAULT_USER_AVATAR_BG } from '../aiMeta.js';
import { createContentCardAction } from '@/src/core/actions.js';
import { escapeHtml } from '@/src/core/escape.js';

// ============================================
// SVG 图标
// ============================================
const ICONS = {
    mapPin: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
    arrow: `<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" fill="currentColor"/></svg>`,
    musicNote: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>`,
    playlist: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h12v2H3V6zm0 5h12v2H3v-2zm0 5h8v2H3v-2zm14-7v6.55A3 3 0 1 0 19 18V10h3V8h-5z"/></svg>`,
    headphones: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 0-9 9v6a3 3 0 0 0 3 3h2v-8H5v-1a7 7 0 1 1 14 0v1h-3v8h2a3 3 0 0 0 3-3v-6a9 9 0 0 0-9-9z"/></svg>`,
};

// ============================================
// 卡片本体（唯一真相）
// --------------------------------------------
// 「卡片长什么样」只在这一节里定义一次。下面各 render*Bubble 拿它套上头像、
// 时间和操作栏；murmur 的提示词预览（app-prompt-card.js /
// app-prompt-preview-island.js）也拿它 —— 于是**预览和真实发出去的卡片
// 一定是同一个东西**。
//
// 以前预览那边自己写了一套 `.pm-preview-card--*` 的近似 HTML：类名不同、
// 结构不同、连图标都不一样。用户照着预览调好样式，发到聊天里完全是另一副面孔，
// 而且自定义 CSS 只对其中一边生效。
// ============================================

/**
 * 画一张卡片的本体（不含头像 / 时间 / 操作栏）。
 *
 * @param {string} kind  location | redpacket | transfer | song | playlist | listen-together
 * @param {object} data  该类卡片的数据（字段见各分支）
 * @param {object} [opts]
 * @param {string} [opts.msgId]        真实消息才有，预览留空
 * @param {boolean} [opts.interactive] false = 去掉 data-app-action（预览里点了不该真跳）
 * @returns {string} HTML
 */
export function renderShareCardBody(kind, data = {}, opts = {}) {
    const d = data || {};
    const msgId = escapeHtml(opts.msgId || '');
    const interactive = opts.interactive !== false;
    const act = (method, appId, payload) => (interactive
        ? ` data-app-action='${escapeHtml(JSON.stringify({ action: 'appMethod', appId, method, payload }))}'`
        : '');

    switch (kind) {
        case 'location': {
            const name = escapeHtml(d.name || d.title || '位置');
            const address = escapeHtml(d.address || '');
            return `
        <div class="location-card-in-chat" data-msg-id="${msgId}" data-location-name="${escapeHtml(d.name || '位置')}" data-location-address="${escapeHtml(d.address || '')}">
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
        }

        case 'redpacket': {
            const style = d.style || 'normal';
            const message = escapeHtml(d.message || d.title || '恭喜发财');
            const senderName = escapeHtml(String(d.senderName || d.sender || '对方').trim() || '对方');
            const iconFill = style === 'expired' ? '#999' : '#FF6B8A';
            const rpIconSvg = `<svg width="17" height="17" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="8"/><text x="12" y="16" text-anchor="middle" font-size="10" fill="${iconFill}" font-weight="bold">¥</text></svg>`;

            if (style === 'cover') {
                const coverTitle = escapeHtml(d.coverTitle || '口令红包');
                const coverSubtitle = escapeHtml(d.coverSubtitle || '发送口令领取');
                return `
        <div class="redpacket-card cover" data-msg-id="${msgId}">
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

            const subline = style === 'opened' ? `${senderName} 的红包`
                : style === 'expired' ? '红包已过期'
                : `${senderName} 给你发了一个红包`;
            const amount = Number(d.amount);
            const cta = style === 'opened'
                ? `<span class="redpacket-cta" style="color:#999;">${Number.isFinite(amount) && amount > 0 ? `已领取 ¥${amount.toFixed(2)}` : '已领取'}</span>`
                : style === 'expired'
                    ? '<span class="redpacket-cta" style="color:#999;">点击领取红包</span>'
                    : '<span class="redpacket-cta">点击领取红包</span>';
            const headerStyle = style === 'expired' ? ' style="background:linear-gradient(135deg,#999,#777);"' : '';
            const cls = style === 'normal' ? 'redpacket-card' : `redpacket-card ${escapeHtml(style)}`;
            return `
        <div class="${cls}" data-msg-id="${msgId}">
            <div class="redpacket-header"${headerStyle}>
                <div class="redpacket-icon">${rpIconSvg}</div>
                <div class="redpacket-text">
                    <div class="redpacket-title">${message}</div>
                    <div class="redpacket-sender">${subline}</div>
                </div>
            </div>
            <div class="redpacket-footer">${cta}</div>
        </div>
    `;
        }

        case 'transfer': {
            const received = !!d.received;
            const note = escapeHtml(d.note || '转账');
            const amount = Number(d.amount);
            const amountText = Number.isFinite(amount) ? `¥${amount.toFixed(2)}` : '¥0.00';
            const statusText = received ? '已收款' : '待收款';
            const statusColor = received ? '#52c41a' : '#FF6B8A';
            return `
        <div class="transfer-card" data-msg-id="${msgId}">
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
                ${received ? '<span class="transfer-check">已收</span>' : ''}
            </div>
        </div>
    `;
        }

        case 'song': {
            const color = escapeHtml(d.color || '#fb7299');
            return `
        <div class="song-share-card" style="background:linear-gradient(135deg, ${color} 0%, rgba(0,0,0,0.25) 160%);"
             data-msg-id="${msgId}"
             data-song-id="${escapeHtml(String(d.songId ?? ''))}"${act('playSharedSong', 'music', { songId: d.songId, title: d.title, artist: d.artist })}>
            <div class="song-share-header">
                <div class="song-share-title-row">
                    <div class="song-share-icon">${ICONS.musicNote}</div>
                    <div class="song-share-title">
                        <div>${escapeHtml(d.title || d.song || '未知歌曲')}</div>
                        <div class="song-share-subtitle">${escapeHtml(d.artist || d.singer || '未知歌手')}</div>
                    </div>
                </div>
            </div>
            <div class="song-share-footer">
                <span>${ICONS.musicNote}分享歌曲</span>
                <span>点击播放</span>
            </div>
        </div>
    `;
        }

        case 'playlist': {
            const color = escapeHtml(d.color || '#fb7299');
            const names = Array.isArray(d.songNames) ? d.songNames.slice(0, 3) : [];
            return `
        <div class="playlist-share-card" style="background:linear-gradient(135deg, ${color} 0%, rgba(0,0,0,0.25) 160%);"
             data-msg-id="${msgId}"
             data-playlist-id="${escapeHtml(String(d.playlistId ?? ''))}"${act('openSharedPlaylist', 'music', { playlistId: d.playlistId })}>
            <div class="playlist-share-header">
                <div class="playlist-share-title-row">
                    <div class="playlist-share-icon">${ICONS.playlist}</div>
                    <div class="playlist-share-title">
                        <div>${escapeHtml(d.name || '歌单')}</div>
                        <div class="playlist-share-subtitle">${escapeHtml(String(d.songCount || 0))} 首歌</div>
                    </div>
                </div>
                ${names.length ? `
                    <div class="playlist-share-songs">
                        ${names.map((n) => `<div class="playlist-share-song">${escapeHtml(n)}</div>`).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="playlist-share-footer">
                <span>${ICONS.playlist}分享歌单</span>
                <span>点击查看</span>
            </div>
        </div>
    `;
        }

        case 'listen-together': {
            // 背景色根据歌曲封面颜色动态生成渐变
            const color = escapeHtml(d.color || '#7c5cff');
            const colorFade = color + 'cc'; // 带透明度版本的颜色
            return `
        <div class="listen-together-card" style="background:linear-gradient(135deg,${color},${colorFade});border-radius:10px;overflow:hidden;cursor:pointer;width:180px;"
             data-msg-id="${msgId}"${act('openListenTogetherFromChat', 'music', { aiId: d.aiId || '', songId: d.songId })}>
            <div style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.15);">
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="width:28px;height:28px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                        <svg width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"></path></svg>
                    </div>
                    <div style="flex:1;">
                        <div style="color:white;font-weight:600;font-size:13px;">邀请你一起听</div>
                        <div style="color:rgba(255,255,255,0.8);font-size:11px;margin-top:1px;">${
                            d.title
                                ? `${escapeHtml(d.title)} - ${escapeHtml(d.artist || '')}`
                                : '来挑一首歌吧'
                        }</div>
                    </div>
                </div>
            </div>
            <div style="padding:8px 12px;background:rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:space-between;">
                <span style="color:rgba(255,255,255,0.9);font-size:10px;display:flex;align-items:center;gap:4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h2v-8H5v-1a7 7 0 0 1 14 0v1h-2v8h2c1.1 0 2-.9 2-2v-7a9 9 0 0 0-9-9z"></path></svg>
                    一起听音乐
                </span>
                <span style="color:rgba(255,255,255,0.7);font-size:10px;">点击加入</span>
            </div>
        </div>
    `;
        }

        default:
            return '';
    }
}

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
    const isUser = msg.sender === 'user';

    // ★ v0.45 头像支持真实社媒头像:优先从 options 拿,fallback 到 contact/msg 字段
    const userAvatarBg = options.userAvatarBg || '';
    const userAvatar = options.userAvatar || '';
    const aiAvatarBg = contact?.avatarBg || '';
    const aiAvatar = contact?.avatar || '';
    const avatarBg = isUser
        ? (userAvatarBg || DEFAULT_USER_AVATAR_BG)
        : (aiAvatarBg || DEFAULT_AI_AVATAR_BG);
    const avatarUrl = isUser ? userAvatar : aiAvatar;

    const bubbleHtml = renderShareCardBody('location', lc, { msgId: msg.id });

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
        ? (userAvatarBg || DEFAULT_USER_AVATAR_BG)
        : (aiAvatarBg || DEFAULT_AI_AVATAR_BG);
    const avatarUrl = isUser ? userAvatar : aiAvatar;

    // ★ v0.67.x 显示真实发送者名字(代替原来写死的「对方发来红包」)
    //   - 优先用 msg.senderName(聊天消息里有这个字段)
    //   - fallback 用 contact.name(主被动关系:AI 消息时 contact 是 AI 人设)
    //   - 再 fallback 用「对方发来红包」/「红包已发出」
    const senderName = String(msg.senderName || contact?.name || (isUser ? '我' : '对方'))
        .trim() || (isUser ? '我' : '对方');

    // 四种样式（normal / opened / expired / cover）都在 renderShareCardBody 里，
    // murmur 的提示词预览拿的是同一份
    const bubbleHtml = renderShareCardBody('redpacket', { ...rp, style, senderName }, { msgId: msg.id });

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
        ? (userAvatarBg || DEFAULT_USER_AVATAR_BG)
        : (aiAvatarBg || DEFAULT_AI_AVATAR_BG);
    const avatarUrl = isUser ? userAvatar : aiAvatar;

    const bubbleHtml = renderShareCardBody('transfer', tc, { msgId: msg.id });

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
        // ★ v0.72 透传 conversationType + senderId,让重roll 按钮能识别群聊
        conversationType: options.conversationType || msg.conversationType || 'private',
        senderId: msg.senderId || '',
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
        ? (userAvatarBg || DEFAULT_USER_AVATAR_BG)
        : (aiAvatarBg || DEFAULT_AI_AVATAR_BG);
    const avatarUrl = isUser ? userAvatar : aiAvatar;

    const isSingle = messages.length === 1;
    const title = escapeHtml(record.title || '聊天记录');
    const totalCount = record.totalCount || messages.length;
    const overflowNote = totalCount > messages.length
        ? `<span class="chat-record-overflow">等 ${totalCount} 条消息</span>`
        : '';

    // ★ v0.85:AI 名字兜底链 - senderName > contact.name > 'AI'
    const aiName = escapeHtml(contact?.name || 'AI');
    const resolveAiSender = (m) => {
        if (m.sender === 'user') return '我';
        const stored = (m.senderName || '').trim();
        if (stored && stored !== 'AI') return escapeHtml(stored);
        return aiName;
    };

    let inner;
    if (isSingle) {
        // 单条消息：完整显示
        const m = messages[0];
        const mSender = resolveAiSender(m);
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
            const mSender = resolveAiSender(m);
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

    // ★ v0.85 把 contactName 也保存进来,让详情弹窗能显示正确的 AI 名字
    const recordData = {
        title: record.title || '',
        mode: record.mode || 'calendar',
        sourceConversationType: record.sourceConversationType || '',
        sourceConversationId: record.sourceConversationId || '',
        contactName: contact?.name || '',
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
// 朋友圈分享卡片
// ============================================

/**
 * 朋友圈分享卡片气泡
 *
 * 样式对齐 chat.js 现有朋友圈卡片:
 *   - 圆角 12px + 渐变背景 + 粉色阴影
 *   - 顶部头像 + 用户名 + "的动态"
 *   - 中部文字 + 缩略图
 *   - 底部"朋友圈动态" + "查看详情 ›"
 *
 * 数据存储在 msg.shareType / msg.momentId / msg.authorName / msg.content / msg.aiImages
 *
 * @param {Object} msg - 消息对象
 * @param {Object} contact - 联系人信息
 * @param {Object} options
 */
export function renderMomentShareBubble(msg, contact = {}, options = {}) {
    const author = msg.authorName || '匿名';
    const authorText = escapeHtml(author);
    const content = escapeHtml(msg.content || '');
    const images = Array.isArray(msg.aiImages) ? msg.aiImages.filter(Boolean) : [];
    const isUser = msg.sender === 'user';
    const avatarText = author.charAt(0).toUpperCase() || '我';

    // ★ 头部头像优先用作者真实头像,没有则用首字母 placeholder
    // 用户分享时作者是用户自己,所以可以用 userAvatar;AI 分享时作者是 AI
    let avatarInner;
    if (isUser && options.userAvatar) {
        avatarInner = `<img src="${escapeHtml(options.userAvatar)}" alt="" />`;
    } else {
        avatarInner = escapeHtml(avatarText === '匿' ? '我' : avatarText);
    }

    // ★ 缩略图:最多展示 3 张 40px,有图片才渲染整个 image 区
    const imageList = images.slice(0, 3);
    const imagesBlock = imageList.length > 0
        ? `<div class="moment-share-card-images">${imageList.map((url) => `
            <div class="moment-share-card-thumb">
                <img src="${escapeHtml(url)}" alt="" loading="lazy" />
            </div>
        `).join('')}</div>`
        : '';

    const bubbleHtml = `
        <div class="moment-share-card-msg" data-msg-id="${escapeHtml(msg.id)}" data-share-type="moment" data-moment-id="${escapeHtml(msg.momentId || '')}" data-owner-id="${escapeHtml(msg.sender || 'user')}">
            <div class="moment-share-card-header">
                <div class="moment-share-card-avatar">
                    <div class="moment-share-card-avatar-inner">${avatarInner}</div>
                </div>
                <div class="moment-share-card-author">
                    <div class="moment-share-card-name">${authorText}</div>
                    <div class="moment-share-card-sub">的动态</div>
                </div>
            </div>
            <div class="moment-share-card-body">
                ${content ? `<div class="moment-share-card-content">${content}</div>` : ''}
                ${imagesBlock}
            </div>
            <div class="moment-share-card-footer">
                <span class="moment-share-card-footer-left">
                    <svg viewBox="0 0 24 24">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                    朋友圈动态
                </span>
            </div>
        </div>
    `;

    // ★ 朋友圈卡片没有 message-bubble 包装,需要走普通气泡容器
    // 但要保留头像和时间戳,所以直接 return bubbleHtml(由调用方包装或自己渲染)
    // 这里返回带完整 message-wrapper 的 HTML,与 renderShareCardWrapper 行为一致
    const userAvatarBg = options.userAvatarBg || '';
    const userAvatar = options.userAvatar || '';
    const aiAvatarBg = contact?.avatarBg || '';
    const aiAvatar = contact?.avatar || '';
    const avatarBg = isUser
        ? (userAvatarBg || DEFAULT_USER_AVATAR_BG)
        : (aiAvatarBg || DEFAULT_AI_AVATAR_BG);
    const avatarUrl = isUser ? userAvatar : aiAvatar;

    return renderShareCardWrapper(msg, bubbleHtml, avatarBg, contact, options, avatarUrl);
}

// ============================================
// 音乐:歌曲 / 歌单 / 一起听邀请
// 样式已在 css/apps/chat/_chat-bubble.css 里（.song-share-card / .playlist-share-card /
// .listen-together-card），这里只补渲染。卡片由 music app 通过 chat-bridge 写入。
// ============================================

function _musicAvatar(msg, contact, options) {
    const isUser = msg.sender === 'user';
    const avatarBg = isUser
        ? (options.userAvatarBg || DEFAULT_USER_AVATAR_BG)
        : (contact?.avatarBg || DEFAULT_AI_AVATAR_BG);
    const avatarUrl = isUser ? (options.userAvatar || '') : (contact?.avatar || '');
    return { avatarBg, avatarUrl };
}

function _musicAction(method, payload) {
    return escapeHtml(JSON.stringify({ action: 'appMethod', appId: 'music', method, payload }));
}

/** 歌曲分享卡：点一下让音乐 App 播这首 */
export function renderSongShareBubble(msg, contact = {}, options = {}) {
    const card = msg.songCard || {};
    const { avatarBg, avatarUrl } = _musicAvatar(msg, contact, options);
    const bubbleHtml = renderShareCardBody('song', card, { msgId: msg.id });
    return renderShareCardWrapper(msg, bubbleHtml, avatarBg, contact, options, avatarUrl);
}

/** 歌单分享卡：点一下打开音乐 App 的歌单详情 */
export function renderPlaylistShareBubble(msg, contact = {}, options = {}) {
    const card = msg.playlistCard || {};
    const { avatarBg, avatarUrl } = _musicAvatar(msg, contact, options);
    const bubbleHtml = renderShareCardBody('playlist', card, { msgId: msg.id });
    return renderShareCardWrapper(msg, bubbleHtml, avatarBg, contact, options, avatarUrl);
}

/** 一起听邀请卡：点一下跳到音乐 App 的一起听 Tab */
export function renderListenTogetherBubble(msg, contact = {}, options = {}) {
    const card = msg.inviteCard || {};
    const { avatarBg, avatarUrl } = _musicAvatar(msg, contact, options);
    const aiPersonId = options.aiPersonId || msg.aiPersonId || '';
    const bubbleHtml = renderShareCardBody('listen-together', { ...card, aiId: aiPersonId }, { msgId: msg.id });
    return renderShareCardWrapper(msg, bubbleHtml, avatarBg, contact, options, avatarUrl);
}

// ============================================
// 四叶草购物（shop app）
// ============================================
//
// 三种卡：商品/店铺分享、礼物、小剧场概要。写入侧在
// `js/apps/shop-app/services/gift-service.js`。
//
// ★ 三处必须对齐，少一处就画不出来：
//   1. 写入侧的 `msg.type`
//   2. `message-renderer.js` 的 `shareCardRenderers` 注册表（只按 type 分发）
//   3. 这里的渲染函数
//
// 和音乐卡的一个区别：这几张**不做彩色渐变底**。
// 商品卡在聊天里会连着出现好几张，高饱和渐变会把聊天页搅得很花；
// 而且四叶草那边是韩系清新的调子，跳到聊天里变成撞色卡会很怪。

function _shopAction(method, payload) {
    return escapeHtml(JSON.stringify({ action: 'appMethod', appId: 'shop', method, payload }));
}

function _shopItemAction(card) {
    return escapeHtml(JSON.stringify(createContentCardAction(
        'shop',
        'shop-item',
        card.itemId,
        {
            title: card.name || '',
            confirmTitle: '查看这件内容？',
            confirmMessage: `将打开四叶草查看「${card.name || '这件内容'}」的详情。`,
            confirmLabel: '打开四叶草',
            pageId: 'home',
            pageType: 'root',
            card: { ...card },
        },
    )));
}

/** 商品 / 店铺分享卡 */
export function renderShopItemBubble(msg, contact = {}, options = {}) {
    const card = msg.shopCard || {};
    const { avatarBg, avatarUrl } = _musicAvatar(msg, contact, options);
    const tags = Array.isArray(card.tags) ? card.tags.slice(0, 3) : [];
    const isStore = card.kind === 'store';

    const bubbleHtml = `
        <div class="shop-item-card" data-msg-id="${escapeHtml(msg.id)}"
             data-app-action='${_shopItemAction(card)}'>
            <div class="shop-card-kind">${isStore ? '店铺' : '商品'}</div>
            <div class="shop-card-name">${escapeHtml(card.name || '')}</div>
            ${card.sub ? `<div class="shop-card-sub">${escapeHtml(card.sub)}</div>` : ''}
            ${card.blurb ? `<div class="shop-card-blurb">${escapeHtml(card.blurb)}</div>` : ''}
            ${tags.length ? `<div class="shop-card-tags">${tags.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : ''}
            <div class="shop-card-foot">
                <span class="shop-card-price">
                    ${card.priceLabel ? `<i>${escapeHtml(card.priceLabel)}</i>` : ''}
                    ${escapeHtml(String(card.price ?? 0))}
                    <em>${escapeHtml(card.currency || '')}</em>
                </span>
                <span class="shop-card-brand">四叶草</span>
            </div>
            ${card.note ? `<div class="shop-card-note">${escapeHtml(card.note)}</div>` : ''}
        </div>
    `;
    return renderShareCardWrapper(msg, bubbleHtml, avatarBg, contact, options, avatarUrl);
}

/**
 * 礼物卡。
 *
 * 匿名时**不显示送礼人** —— 这是用户明确要的：匿名要真的看不出来。
 * 但送的那个 AI 自己记得（它的实时上下文里写着「你匿名给她买了 X」），
 * 所以用户去问他，他是可以承认的。
 */
export function renderShopGiftBubble(msg, contact = {}, options = {}) {
    const card = msg.giftCard || {};
    const { avatarBg, avatarUrl } = _musicAvatar(msg, contact, options);
    const isIn = card.direction === 'in';
    const who = isIn
        ? (card.anonymous ? '有人送你' : `${card.fromName || 'TA'} 送你`)
        : `送给 ${card.toName || 'TA'}`;

    const bubbleHtml = `
        <div class="shop-gift-card ${isIn ? 'is-in' : 'is-out'}" data-msg-id="${escapeHtml(msg.id)}">
            <div class="shop-gift-ribbon"></div>
            <div class="shop-gift-who">${escapeHtml(who)}</div>
            <div class="shop-gift-name">${escapeHtml(card.name || '一份礼物')}</div>
            ${card.message ? `<div class="shop-gift-msg">「${escapeHtml(card.message)}」</div>` : ''}
            <div class="shop-gift-foot">
                <span class="shop-gift-price">${escapeHtml(String(card.price ?? 0))} ${escapeHtml(card.currency || '')}</span>
                ${card.fromWish ? '<span class="shop-gift-wish">来自心愿单</span>' : ''}
            </div>
        </div>
    `;
    return renderShareCardWrapper(msg, bubbleHtml, avatarBg, contact, options, avatarUrl);
}

/**
 * 小剧场概要卡。
 *
 * 只带概要不带全文：全文几百上千字，进了聊天记录之后每一轮都会
 * 作为上下文重新发一遍，成本高得离谱，而且 AI 会开始复述它。
 * 点一下跳回四叶草看完整那一场。
 */
export function renderShopTheaterBubble(msg, contact = {}, options = {}) {
    const card = msg.theaterCard || {};
    const { avatarBg, avatarUrl } = _musicAvatar(msg, contact, options);
    const cast = Array.isArray(card.cast) ? card.cast.join('、') : '';

    const bubbleHtml = `
        <div class="shop-theater-card" data-msg-id="${escapeHtml(msg.id)}"
             data-app-action='${_shopAction('openTheaterFromChat', { theaterId: card.theaterId })}'>
            <div class="shop-card-kind">小剧场</div>
            <div class="shop-card-name">${escapeHtml(card.title || '一段小插曲')}</div>
            ${cast ? `<div class="shop-card-sub">${escapeHtml(cast)}</div>` : ''}
            ${card.summary ? `<div class="shop-theater-summary">${escapeHtml(card.summary)}</div>` : ''}
            <div class="shop-card-foot">
                <span class="shop-card-brand">共 ${escapeHtml(String(card.sceneCount || 0))} 场</span>
                <span class="shop-card-brand">点击查看</span>
            </div>
        </div>
    `;
    return renderShareCardWrapper(msg, bubbleHtml, avatarBg, contact, options, avatarUrl);
}

// ============================================
// 萤火视频（youtube app）
// ============================================
//
// 一种卡：视频分享。写入侧在 `js/apps/youtube-app/services/chat-bridge.js`
// （用户分享）和本目录 services/ai-service.js 的 [分享视频:] 解析（AI 分享）。
// 点击走 contentCard 确认协议：取消不调 AI；确认后由萤火的
// services.contentCards 恢复 / 生成详情再跳转。
// 样式在 css/apps/chat/_chat-youtube-card.css（封面是色块 + 大字，禁 emoji）。

function _youtubeCardAction(card) {
    return escapeHtml(JSON.stringify(createContentCardAction(
        'youtube',
        'youtube-video',
        card.videoId,
        {
            title: card.title || '',
            confirmTitle: '打开这条视频？',
            confirmMessage: `将打开萤火查看「${card.title || '这条视频'}」。详情不存在时会按当前世界观生成一次。`,
            confirmLabel: '打开萤火',
            pageId: 'home',
            pageType: 'root',
            card: { ...card },
        },
    )));
}

/** 萤火视频分享卡 */
export function renderYoutubeVideoBubble(msg, contact = {}, options = {}) {
    const card = msg.youtubeCard || {};
    const { avatarBg, avatarUrl } = _musicAvatar(msg, contact, options);
    const hue = ((Number(card.coverHue) || 0) % 8 + 8) % 8;
    const views = Number(card.views) || 0;
    const viewsLabel = views >= 10000 ? `${(views / 10000).toFixed(1).replace(/\.0$/, '')}万` : String(views);

    const bubbleHtml = `
        <div class="ytc-card" data-msg-id="${escapeHtml(msg.id)}"
             data-app-action='${_youtubeCardAction(card)}'>
            <div class="ytc-cover ytc-cover--h${hue}">
                <span class="ytc-cover__text">${escapeHtml(card.coverText || card.title || '视频')}</span>
                <span class="ytc-cover__play"></span>
            </div>
            <div class="ytc-body">
                <div class="ytc-title">${escapeHtml(card.title || '未命名视频')}</div>
                ${card.blurb ? `<div class="ytc-blurb">${escapeHtml(card.blurb)}</div>` : ''}
                <div class="ytc-foot">
                    <span>${escapeHtml(card.creatorName || '萤火')}</span>
                    ${views ? `<span>${escapeHtml(viewsLabel)} 次观看</span>` : '<span>点击查看</span>'}
                </div>
                ${card.note ? `<div class="ytc-note">${escapeHtml(card.note)}</div>` : ''}
            </div>
        </div>
    `;
    return renderShareCardWrapper(msg, bubbleHtml, avatarBg, contact, options, avatarUrl);
}

// ============================================
// 氧气帖子（blog app）
// ============================================
//
// 一种卡：帖子分享。写入侧在 `js/apps/blog-app/services/chat-bridge.js`
// （用户分享）和本目录 services/ai-service.js 的 [分享帖子:] 解析（AI 分享）。
// 氧气是「标签优先」的博客：卡片只显示标签和一句预感，没有正文 ——
// 点击走 contentCard 确认协议：取消不调 AI；确认后由氧气的
// services.contentCards 恢复 / 按快照生成正文再跳转。
// 样式在 css/apps/chat/_chat-blog-card.css（白底黑字，禁 emoji 禁渐变）。

function _blogCardAction(card) {
    return escapeHtml(JSON.stringify(createContentCardAction(
        'blog',
        'blog-post',
        card.postId,
        {
            confirmTitle: '打开这条帖子？',
            confirmMessage: '确认后氧气会展开它的正文（可能需要生成一次）。',
            confirmLabel: '打开氧气',
            pageId: 'home',
            pageType: 'root',
            card: { ...card },
        },
    )));
}

/** 氧气帖子分享卡（标签优先：只有标签和一句预感，没有正文） */
export function renderBlogPostBubble(msg, contact = {}, options = {}) {
    const card = msg.blogCard || {};
    const { avatarBg, avatarUrl } = _musicAvatar(msg, contact, options);
    const tags = Array.isArray(card.tags) ? card.tags.slice(0, 4) : [];
    const typeLabel = ({ long: '长文', short: '短文', murmur: '碎碎念' })[card.type] || '帖子';

    const bubbleHtml = `
        <div class="oxc-card" data-msg-id="${escapeHtml(msg.id)}"
             data-app-action='${_blogCardAction(card)}'>
            <div class="oxc-tags">
                ${tags.map((t) => `<span class="oxc-tag">${escapeHtml(t)}</span>`).join('')}
            </div>
            ${card.blurb ? `<div class="oxc-blurb">${escapeHtml(card.blurb)}</div>` : ''}
            <div class="oxc-foot">
                <span class="oxc-mark"></span>
                <span>氧气 · ${escapeHtml(typeLabel)}</span>
                ${card.authorName ? `<span>${escapeHtml(card.authorName)}</span>` : ''}
                <span class="oxc-open">点开呼吸</span>
            </div>
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
    momentShare: renderMomentShareBubble,
    songShare: renderSongShareBubble,
    playlistShare: renderPlaylistShareBubble,
    listenTogether: renderListenTogetherBubble,
    shopItem: renderShopItemBubble,
    shopGift: renderShopGiftBubble,
    shopTheater: renderShopTheaterBubble,
    youtubeVideo: renderYoutubeVideoBubble,
    blogPost: renderBlogPostBubble,
};
