/**
 * chat-app / 收藏详情页
 *
 * Phase 11+ 收藏功能重构
 *
 * 功能:
 *   - 分类标签页: 全部 / 文字 / 图片 / 位置 / 游戏 / 视频通话
 *   - "全部": 对话片段收藏(多选消息合并为一个收藏项)
 *   - "文字/图片/位置/游戏/通话": 单独收藏的消息
 *   - 对话片段支持折叠/展开,展示完整消息流
 *   - 每条收藏显示: 发送者头像/名字、时间、收藏来源
 *
 * 数据结构:
 *   type='conversation': 对话片段(多选消息收藏)
 *     - favoriteId: 收藏唯一ID
 *     - type: 'conversation'
 *     - sourceType: 'private' | 'group'
 *     - sourceId: 联系人ID或群ID
 *     - sourceName: 联系人或群名称
 *     - messages: 消息数组 [{id, sender, senderName, type, content, time, ...}]
 *     - time: 收藏时间
 *     - messageCount: 消息数量
 *     - firstMessage: 第一条消息摘要
 *
 *   type='text'/'image'/'location'/'game'/'voice_call'/'video_call': 单条收藏
 *     - favoriteId: 收藏唯一ID
 *     - type: 消息类型
 *     - content: 收藏内容摘要
 *     - sender: 发送者
 *     - senderName: 发送者名字
 *     - time: 收藏时间
 *     - sourceType: 'private' | 'group'
 *     - sourceId: 联系人ID或群ID
 *     - sourceName: 联系人或群名称
 */

import { escapeHtml } from '@/src/core/escape.js';
// 框架级「左滑露出操作」：结构 + 手势都在这里，收藏页只提供按钮内容
import { renderSwipeRow } from '@/src/core/components/swipe-actions.js';

// ─── SVG 图标 ─────────────────────────────────────────────

const ICON_BACK = `<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_STAR = `<svg viewBox="0 0 24 24"><path d="m12 2.8 2.85 5.77 6.37.93-4.61 4.49 1.09 6.34L12 17.34l-5.7 2.99 1.09-6.34-4.61-4.49 6.37-.93L12 2.8Z" fill="currentColor"/></svg>`;
const ICON_STAR_OUTLINE = `<svg viewBox="0 0 24 24"><path d="m12 2.8 2.85 5.77 6.37.93-4.61 4.49 1.09 6.34L12 17.34l-5.7 2.99 1.09-6.34-4.61-4.49 6.37-.93L12 2.8Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m16.5 16.5 4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const ICON_ARROW = `<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_IMAGE = `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21 15 16 10 5 21" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_LOCATION = `<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="3" fill="currentColor"/></svg>`;
const ICON_GAME = `<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="6" y1="12" x2="10" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="10" x2="8" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_VIDEO = `<svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_VOICE = `<svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_TEXT = `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_EXPAND = `<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_COLLAPSE = `<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_PRIVATE = `<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_GROUP = `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_SHARE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/></svg>`;
const ICON_EDIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

/**
 * 一条收藏左滑露出的三个按钮：分享 / 编辑 / 删除。
 * 三个都走 data-app-action，由 framework 派发到 chat-app 的 methods。
 * 结构（外壳 / 层叠 / 手势）来自框架级 swipe-actions 组件，这里只给内容。
 */
function renderFavoriteSwipeActions(favId, favType) {
    const mk = (method) => escapeHtml(JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method,
        payload: { favoriteId: favId, type: favType },
    }));
    return `
        <button type="button" class="swipe-row__action fav-swipe-action--share"
            data-app-action='${mk('shareFavorite')}' aria-label="分享">
            ${ICON_SHARE}<span>分享</span>
        </button>
        <button type="button" class="swipe-row__action fav-swipe-action--edit"
            data-app-action='${mk('editFavorite')}' aria-label="编辑">
            ${ICON_EDIT}<span>编辑</span>
        </button>
        <button type="button" class="swipe-row__action fav-swipe-action--delete"
            data-app-action='${mk('deleteFavorite')}' aria-label="删除">
            ${ICON_TRASH}<span>删除</span>
        </button>
    `;
}

// ─── 分类配置 ─────────────────────────────────────────────
// 注意:全部(showConversation=true)显示对话片段,其他显示单条收藏

const CATEGORIES = [
    { id: 'all', label: '全部', icon: ICON_STAR_OUTLINE, showConversation: true },
    { id: 'text', label: '文字', icon: ICON_TEXT, showConversation: false },
    { id: 'image', label: '图片', icon: ICON_IMAGE, showConversation: false },
    { id: 'location', label: '位置', icon: ICON_LOCATION, showConversation: false },
    { id: 'game', label: '游戏', icon: ICON_GAME, showConversation: false },
    { id: 'video_call', label: '视频通话', icon: ICON_VIDEO, showConversation: false },
    { id: 'voice_call', label: '语音通话', icon: ICON_VOICE, showConversation: false },
    { id: 'moments', label: '朋友圈', icon: `<svg viewBox="0 0 24 24" width="16" height="16"><rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 20.5c0-2.5 2-4.5 5-4.5s5 2 5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`, showConversation: false },
];

// ─── 演示数据 ─────────────────────────────────────────────
// ★ v0.80 移除 DEMO_FAVORITES 占位收藏 — 收藏数据全部从 SDK chatFavorites 读,
//   对话片段收藏从内存 + localStorage 读,没有就展示「还没有收藏」空状态。
const DEMO_FAVORITES = [];

// ─── 导出到全局（供交互逻辑使用）─────────────────────────────

// ★ v0.80 不再导出 demo favorites(已无数据)
if (typeof window !== 'undefined') {
    window.__chatDemoFavorites = DEMO_FAVORITES;
    window.__chatFavoritesRenderer = {
        renderFavoriteList,
        renderContextMessagesPreview,
        renderContextMessagesFull,
    };
}

// ─── 工具函数 ─────────────────────────────────────────────

/**
 * 格式化通话时长
 */
function formatCallDuration(seconds) {
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

/**
 * ★ v0.44 格式化相对时间(createdAt → "今天 14:26")
 * @param {number} ts - 毫秒时间戳
 */
function formatRelativeTime(ts) {
    if (!ts || typeof ts !== 'number') return '最近';
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    if (isToday) return `今天 ${h}:${m}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `昨天 ${h}:${m}`;
    const mo = d.getMonth() + 1;
    const day = d.getDate();
    return `${mo}月${day}日 ${h}:${m}`;
}

/**
 * 获取来源图标
 */
function getSourceIcon(sourceType) {
    return sourceType === 'group' ? ICON_GROUP : ICON_PRIVATE;
}

/**
 * 获取类型图标
 */
function normalizeFavType(type) {
    if (type === 'descriptive_image') return 'image';
    return type || 'text';
}

function getTypeIcon(type) {
    const cat = CATEGORIES.find(c => c.id === normalizeFavType(type));
    return cat ? cat.icon : ICON_TEXT;
}

/**
 * 获取类型标签
 */
function getTypeLabel(type) {
    const cat = CATEGORIES.find(c => c.id === normalizeFavType(type));
    return cat ? cat.label : '文字';
}

/**
 * 获取头像背景渐变
 */
function getAvatarBg(senderColor) {
    if (senderColor === 'pink') {
        return 'linear-gradient(135deg, #f2aacb, #ffcbdc)';
    } else if (senderColor === 'purple') {
        return 'linear-gradient(135deg, #c4b5fd, #ddd6fe)';
    } else if (senderColor === 'gray') {
        return 'linear-gradient(135deg, #c0c0c0, #d8d8d8)';
    }
    return 'linear-gradient(135deg, #9fc8ed, #c9dfff)';
}

/**
 * 渲染单条消息(用于对话片段内的消息流)
 */
function renderConversationMessage(msg) {
    const { id, sender, senderName, senderColor, type, content, time, imagePreview, cardColor, locationName, locationAddress } = msg;

    if (type === 'system') {
        return `<div class="conv-msg conv-msg--system">${escapeHtml(content)}</div>`;
    }

    const isUser = sender === 'user';
    const align = isUser ? 'flex-end' : 'flex-start';
    const bg = isUser ? '#FFE4EC' : '#E8F2FF';
    const avatarBg = getAvatarBg(senderColor || (isUser ? 'pink' : 'blue'));
    const name = escapeHtml(senderName || (isUser ? '我' : 'AI'));

    let contentHtml = '';
    if (type === 'descriptive_image' || type === 'image') {
        contentHtml = `
            <div class="conv-msg-content conv-msg-content--image">
                <div class="conv-image-preview" style="background: ${escapeHtml(cardColor || '#FFE4EC')};">
                    <div class="conv-image-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                        </svg>
                    </div>
                    <div class="conv-image-text">${escapeHtml(imagePreview || '图片')}</div>
                </div>
            </div>
        `;
    } else if (type === 'location') {
        contentHtml = `
            <div class="conv-msg-content conv-msg-content--location">
                <div class="conv-location">
                    <div class="conv-location-icon">${ICON_LOCATION}</div>
                    <div class="conv-location-info">
                        <div class="conv-location-name">${escapeHtml(locationName || content)}</div>
                        ${locationAddress ? `<div class="conv-location-addr">${escapeHtml(locationAddress)}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    } else {
        contentHtml = `<div class="conv-msg-content conv-msg-content--text">${escapeHtml(content)}</div>`;
    }

    return `
        <div class="conv-msg" style="justify-content: ${align};">
            ${!isUser ? `
                <div class="conv-avatar" style="background: ${avatarBg};">
                    ${name.charAt(0)}
                </div>
            ` : ''}
            <div class="conv-bubble" style="background: ${bg};">
                <div class="conv-bubble-header">
                    <span class="conv-sender">${name}</span>
                    <span class="conv-time">${escapeHtml(time)}</span>
                </div>
                ${contentHtml}
            </div>
            ${isUser ? `
                <div class="conv-avatar" style="background: ${avatarBg};">
                    ${name.charAt(0)}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * 渲染对话片段项
 */
function renderConversationItem(item, isExpanded = false) {
    // ★ v0.44 兼容:真实收藏用 id,DEMO 用 favoriteId
    const favId = item.id || item.favoriteId;
    const { sourceType, sourceName, time, messageCount, messages } = item;

    const sourceIcon = getSourceIcon(sourceType);
    const firstMsg = messages[0];
    const firstMsgPreview = firstMsg
        ? (firstMsg.content?.substring(0, 50) + (firstMsg.content?.length > 50 ? '...' : ''))
        : '对话片段';

    // 收集消息类型统计
    const typeStats = {};
    messages.forEach(msg => {
        const t = msg.type === 'descriptive_image' ? 'image' : (msg.type || 'text');
        typeStats[t] = (typeStats[t] || 0) + 1;
    });
    const typeIcons = Object.entries(typeStats)
        .map(([t, count]) => {
            const icon = getTypeIcon(t);
            return `<span class="conv-type-stat" title="${getTypeLabel(t)}">${icon}<span>${count}</span></span>`;
        }).join('');

    return `
        <div class="chat-favorite-item chat-favorite-item--conversation"
             data-favorite-id="${escapeHtml(favId)}"
             data-type="conversation"
             data-expanded="${isExpanded}">
            <div class="fav-item-header">
                <div class="chat-favorite-avatar" style="background: linear-gradient(135deg, #f2aacb, #ffcbdc);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                    </svg>
                </div>
                <div class="fav-item-meta">
                    <div class="fav-item-sender">
                        <span>${escapeHtml(sourceName)}</span>
                        <span class="fav-item-time">${escapeHtml(time)}</span>
                    </div>
                    <div class="fav-item-source">
                        <span class="fav-source-icon">${sourceIcon}</span>
                        <span>${escapeHtml(sourceName)}</span>
                        <span class="fav-type-badge fav-type-badge--conversation">
                            <span class="conv-type-icons">${typeIcons}</span>
                            <span>${messageCount} 条消息</span>
                        </span>
                    </div>
                </div>
                <button class="fav-expand-btn ${isExpanded ? 'expanded' : ''}"
                        ${`data-app-action='${escapeHtml(JSON.stringify({
                            action: 'appMethod',
                            appId: 'chat',
                            method: 'toggleFavoriteExpand',
                            payload: { favoriteId: favId },
                        }))}'`}
                        aria-label="${isExpanded ? '收起' : '展开'}">
                    ${isExpanded ? ICON_COLLAPSE : ICON_EXPAND}
                </button>
            </div>

            <div class="conv-preview">
                <div class="conv-preview-text">${escapeHtml(firstMsgPreview)}</div>
            </div>

            <div class="conv-messages" ${!isExpanded ? 'style="display:none;"' : ''}>
                ${messages.map(msg => renderConversationMessage(msg)).join('')}
            </div>
        </div>
    `;
}

/**
 * 渲染收藏项(单条收藏)
 */
function renderFavoriteItem(item, isExpanded = false) {
    // ★ v0.44 兼容:真实收藏用 id,DEMO 用 favoriteId
    const favId = item.id || item.favoriteId;
    const {
        type,
        sender,
        senderName,
        senderColor,
        content,
        time,
        sourceType,
        sourceName,
        imagePreview,
        cardColor,
        locationName,
        locationAddress,
        duration,
        summary,
        contextMessages,
        gameType,
        gameTitle,
        createdAt,
    } = item;

    const avatarBg = getAvatarBg(senderColor);
    const typeIcon = getTypeIcon(type);
    const sourceIcon = getSourceIcon(sourceType);
    const typeLabel = getTypeLabel(type);

    // ★ v0.44:真实收藏没有 time 字段,需要从 createdAt 格式化
    const displayTime = time || (createdAt ? formatRelativeTime(createdAt) : '最近');

    // 根据类型渲染不同内容
    let contentHtml = '';
    if (normalizeFavType(type) === 'image') {
        contentHtml = `
            <div class="fav-image-preview" style="background: ${escapeHtml(cardColor || '#FFE4EC')};">
                <div class="fav-image-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                </div>
                <div class="fav-image-text">${escapeHtml(imagePreview || item.imageDescription || content || '图片')}</div>
            </div>
        `;
    } else if (type === 'location') {
        contentHtml = `
            <div class="fav-location-preview">
                <div class="fav-location-icon">${ICON_LOCATION}</div>
                <div class="fav-location-info">
                    <div class="fav-location-name">${escapeHtml(locationName || content)}</div>
                    ${locationAddress ? `<div class="fav-location-addr">${escapeHtml(locationAddress)}</div>` : ''}
                </div>
            </div>
        `;
    } else if (type === 'voice_call' || type === 'video_call') {
        const callIcon = type === 'video_call' ? ICON_VIDEO : ICON_VOICE;
        const durationText = duration ? formatCallDuration(duration) : '';
        contentHtml = `
            <div class="fav-call-preview">
                <div class="fav-call-icon">${callIcon}</div>
                <div class="fav-call-info">
                    <div class="fav-call-title">${escapeHtml(getTypeLabel(type))}</div>
                    <div class="fav-call-duration">${durationText}</div>
                    ${summary ? `<div class="fav-call-summary">${escapeHtml(summary)}</div>` : ''}
                </div>
            </div>
        `;
    } else if (type === 'game') {
        contentHtml = `
            <div class="fav-game-preview">
                <div class="fav-game-icon">${ICON_GAME}</div>
                <div class="fav-game-info">
                    <div class="fav-game-title">${escapeHtml(gameTitle || '游戏')}</div>
                    ${summary ? `<div class="fav-game-summary">${escapeHtml(summary)}</div>` : ''}
                </div>
            </div>
        `;
    } else if (type === 'moments') {
        // ★ v0.87 朋友圈收藏：正文 + 图片数量 + 位置。
        //   图片本身不在这里画（收藏卡片高度要可控），只给个计数提示。
        const imgCount = (item.momentImages?.length || 0) + (item.momentAiImages?.length || 0);
        const metaBits = [];
        if (imgCount > 0) metaBits.push(`${imgCount} 张图`);
        if (item.momentLocation) metaBits.push(item.momentLocation);
        contentHtml = `
            <div class="fav-moment-preview">
                <div class="fav-moment-text">${escapeHtml(content || '(空动态)')}</div>
                ${metaBits.length > 0
                    ? `<div class="fav-moment-meta">${metaBits.map(b => `<span>${escapeHtml(b)}</span>`).join('')}</div>`
                    : ''}
            </div>
        `;
    } else {
        contentHtml = `<div class="fav-text-content">${escapeHtml(content)}</div>`;
    }

    // 渲染上下文消息(用于游戏/通话等需要展示完整流程的情况)
    let contextHtml = '';
    if (contextMessages && contextMessages.length > 0) {
        contextHtml = `
            <div class="fav-context ${isExpanded ? 'expanded' : ''}" data-context="${escapeHtml(favId)}">
                <button class="fav-context-header" ${`data-app-action='${escapeHtml(JSON.stringify({
                    action: 'appMethod',
                    appId: 'chat',
                    method: 'toggleFavoriteContext',
                    payload: { favoriteId: favId },
                }))}'`} type="button">
                    <span class="fav-context-label">${isExpanded ? '收起' : `查看全流程 (${contextMessages.length} 条)`}</span>
                    ${isExpanded ? ICON_COLLAPSE : ICON_EXPAND}
                </button>
                <div class="fav-context-messages">
                    ${isExpanded ? renderContextMessagesFull(contextMessages) : renderContextMessagesPreview(contextMessages, 3)}
                </div>
            </div>
        `;
    }

    return `
        <div class="chat-favorite-item"
             data-favorite-id="${escapeHtml(favId)}"
             data-type="${escapeHtml(type)}"
             data-searchable="${escapeHtml(`${senderName} ${content} ${sourceName}`)}">
            <div class="fav-item-header">
                <div class="chat-favorite-avatar" style="background: ${avatarBg};">
                    ${escapeHtml(senderName?.charAt(0) || '?')}
                </div>
                <div class="fav-item-meta">
                    <div class="fav-item-sender">
                        <span>${escapeHtml(senderName)}</span>
                        <span class="fav-item-time">${escapeHtml(displayTime)}</span>
                    </div>
                    <div class="fav-item-source">
                        <span class="fav-source-icon">${sourceIcon}</span>
                        <span>${escapeHtml(sourceName)}</span>
                        <span class="fav-type-badge">
                            <span class="fav-type-icon">${typeIcon}</span>
                            <span>${typeLabel}</span>
                        </span>
                    </div>
                </div>
            </div>
            <div class="fav-item-content">
                ${contentHtml}
            </div>
            ${contextHtml}
        </div>
    `;
}

/**
 * 渲染上下文消息预览(前N条)
 */
function renderContextMessagesPreview(messages, limit = 3) {
    const visibleMessages = messages.slice(0, limit);
    const hasMore = messages.length > limit;

    return `
        ${visibleMessages.map(msg => renderContextMessageItem(msg)).join('')}
        ${hasMore ? `<div class="fav-ctx-more">+ 还有 ${messages.length - limit} 条消息</div>` : ''}
    `;
}

/**
 * 渲染完整上下文消息
 */
function renderContextMessagesFull(messages) {
    return messages.map(msg => renderContextMessageItem(msg)).join('');
}

/**
 * 渲染单条上下文消息
 */
function renderContextMessageItem(msg) {
    if (msg.role === 'system' || msg.type === 'system') {
        return `<div class="fav-ctx-system">${escapeHtml(msg.content)}</div>`;
    }
    const isUser = msg.role === 'user';
    const bg = isUser ? '#FFE4EC' : '#E8F2FF';
    const align = isUser ? 'flex-end' : 'flex-start';
    return `
        <div class="fav-ctx-msg" style="justify-content: ${align};">
            <div class="fav-ctx-bubble" style="background: ${bg};">
                <span class="fav-ctx-sender">${escapeHtml(msg.senderName || (isUser ? '我' : 'AI'))}</span>
                <span class="fav-ctx-content">${escapeHtml(msg.content)}</span>
            </div>
        </div>
    `;
}

/**
 * 渲染分类标签
 *
 * ★ v0.36 改造:从 data-action 属性改成 data-app-action 走 framework 派发
 * (此前 data-action 是「孤儿属性」,framework click 委托不识别,只能依赖
 *  index.js 里 inline addEventListener — 那个 listener 在 v-html 重建后
 *  会失效,导致按钮点不了。改走 data-app-action 后由 framework 顶层委托
 *  统一派发,跟 v-html 重建解耦)
 */
function renderCategoryTabs(activeCategory = 'all') {
    return CATEGORIES.map(cat => {
        const isActive = cat.id === activeCategory;
        const actionAttr = `data-app-action='${escapeHtml(JSON.stringify({
            action: 'appMethod',
            appId: 'chat',
            method: 'switchFavoriteCategory',
            payload: { category: cat.id },
        }))}'`;
        return `
            <button class="fav-category-tab ${isActive ? 'active' : ''}"
                    data-category="${escapeHtml(cat.id)}"
                    ${actionAttr}>
                <span class="fav-tab-icon">${cat.icon}</span>
                <span class="fav-tab-label">${escapeHtml(cat.label)}</span>
            </button>
        `;
    }).join('');
}

/**
 * 渲染收藏列表
 *
 * ★ v0.36 改造:展开状态从外部传入(由 index.js 维护 in-memory state),
 * 避免依赖 inline addEventListener + innerHTML 局部刷新。
 * 切分类时整个 page 重画由 framework detailRenderTick 触发,
 * 这样 v-html 重建不会丢失任何状态(状态在 app 侧,不在 DOM 节点上)。
 *
 * @param {Array} favorites - 收藏列表
 * @param {string} category - 当前分类
 * @param {Object} state - 展开状态 { expandedConv: Set, expandedContext: Set }
 */
function renderFavoriteList(favorites, category = 'all', state = {}) {
    const expandedConv = state.expandedConv instanceof Set
        ? state.expandedConv
        : new Set(Array.isArray(state.expandedConv) ? state.expandedConv : []);
    const expandedContext = state.expandedContext instanceof Set
        ? state.expandedContext
        : new Set(Array.isArray(state.expandedContext) ? state.expandedContext : []);
    if (favorites.length === 0) {
        const label = category === 'all' ? '' : getTypeLabel(category);
        return `
            <div class="fav-empty">
                <div class="fav-empty-icon">${ICON_STAR_OUTLINE}</div>
                <div class="fav-empty-text">暂无${label}收藏</div>
            </div>
        `;
    }

    return favorites.map(item => {
        const favId = item.id || item.favoriteId;
        const contentHtml = item.type === 'conversation'
            ? renderConversationItem(item, expandedConv.has(favId))
            : renderFavoriteItem(item, expandedContext.has(favId));
        // 每条都包一层「左滑露出分享/编辑/删除」的外壳。
        // 手势由 src/core/components/swipe-actions.js 统一处理，
        // chat-app 侧只在 initFavoritesInteractions 里 attach 一次。
        return renderSwipeRow({
            extraClass: 'fav-swipe-row',
            dataAttrs: `data-favorite-id="${escapeHtml(favId)}" data-favorite-type="${escapeHtml(item.type || '')}"`,
            actionsHtml: renderFavoriteSwipeActions(favId, item.type || ''),
            contentHtml,
        });
    }).join('');
}

/**
 * 统计各分类数量
 * @param {Array} favorites - 所有收藏
 * @param {Object} options - 选项
 * @param {string} options.contactId - 可选,筛选特定联系人
 * @param {string} options.sourceType - 可选,'private' 或 'group'
 */
function countByCategory(favorites, options = {}) {
    const { contactId, sourceType } = options;

    // 先过滤
    let filtered = favorites;
    if (contactId && sourceType) {
        filtered = favorites.filter(f =>
            f.sourceType === sourceType && (
                f.sourceId === contactId ||
                f.aiPersonId === contactId
            )
        );
    }

    const conversationCount = filtered.filter(f => f.type === 'conversation').length;
    const singleCounts = { all: filtered.length };
    CATEGORIES.forEach(cat => {
        if (cat.id !== 'all') {
            singleCounts[cat.id] = filtered.filter(f => normalizeFavType(f.type) === cat.id).length;
        }
    });
    singleCounts._conversation = conversationCount;

    return singleCounts;
}

// ─── 主渲染函数 ───────────────────────────────────────────

/**
 * 渲染收藏详情页
 *
 * ★ v0.36 改造:state 参数(分类 / 搜索 keyword / 展开状态)从外部传入,
 * 而不是依赖 inline addEventListener。methods 改 state 后通过
 * __detailRenderTick.value++ 触发 framework 重画整页,
 * 这样 v-html 重建不会丢失任何状态(状态在 app 侧,不在 DOM 节点上)。
 *
 * @param {Object} app
 * @param {Object} options - 可选配置
 * @param {string} options.initialCategory - 初始显示的分类
 * @param {string} options.contactId - 可选，筛选特定联系人的收藏
 * @param {string} options.sourceType - 可选，'private' 或 'group'
 * @param {string} options.sourceName - 可选，联系人或群名称
 * @param {Array} [options.realFavorites] - 真实收藏数据(sdk.chatFavorites.list),会与 DEMO_FAVORITES 合并
 * @param {Object} [options.state] - 当前 in-memory 状态(由 chat-app methods 维护)
 * @param {string} [options.state.category] - 当前激活分类
 * @param {string} [options.state.searchKeyword] - 搜索关键词
 * @param {Set|Array} [options.state.expandedConv] - 已展开的对话片段 ID
 * @param {Set|Array} [options.state.expandedContext] - 已展开的上下文 ID
 */
export function renderFavoritesPage(app, options = {}) {
    const state = options.state || {};
    const initialCategory = state.category || options?.initialCategory || 'all';
    const searchKeyword = state.searchKeyword || '';
    const contactId = options?.contactId;
    const sourceType = options?.sourceType;
    const sourceName = options?.sourceName;
    const realFavorites = Array.isArray(options.realFavorites) ? options.realFavorites : [];

    // ★ v0.44 收藏数据来源:
    //   favoriteMessage 写入 sdk.chatFavorites(单条收藏,id=fav-xxx),
    //   favoriteMulti 写入 app.state._conversationFavorites(对话片段,id=conv-xxx)
    // ★ v0.80 不再合并 DEMO_FAVORITES 兜底数据,没真实收藏就展示空状态
    let filteredFavorites = realFavorites;
    if (contactId && sourceType) {
        filteredFavorites = realFavorites.filter(f =>
            f.sourceType === sourceType && (
                f.sourceId === contactId ||
                f.aiPersonId === contactId
            )
        );
    }

    // ★ v0.36 应用搜索 keyword(本地 in-memory,跟 db 解耦)
    if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        filteredFavorites = filteredFavorites.filter(f => {
            const haystack = [
                f.sourceName,
                f.senderName,
                f.content,
                f.summary,
                f.locationName,
                f.locationAddress,
                f.gameTitle,
                f.firstMessage,
                ...(Array.isArray(f.messages) ? f.messages.map(m => m.content) : []),
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(kw);
        });
    }

    const categoryCounts = countByCategory(filteredFavorites, { contactId, sourceType });
    const totalCount = categoryCounts.all;

    const categoryTabsHtml = renderCategoryTabs(initialCategory);

    // 根据分类过滤
    let filteredByCategory;
    if (initialCategory === 'all') {
        filteredByCategory = filteredFavorites;
    } else {
        filteredByCategory = filteredFavorites.filter(f => normalizeFavType(f.type) === initialCategory);
    }

    const favoriteListHtml = renderFavoriteList(filteredByCategory, initialCategory, state);

    // 页面标题
    const pageTitle = sourceName
        ? `${escapeHtml(sourceName)}的收藏`
        : '收藏';

    // 如果是特定联系人的收藏,显示来源提示
    const sourceHint = sourceName
        ? `<div class="fav-source-hint">
            <span class="fav-source-icon">${sourceType === 'group' ? ICON_GROUP : ICON_PRIVATE}</span>
            <span>查看 ${escapeHtml(sourceName)} 的收藏</span>
           </div>`
        : '';

    return `
        <div class="chat-favorites" data-current-category="${escapeHtml(initialCategory)}" data-contact-id="${escapeHtml(contactId || '')}" data-source-type="${escapeHtml(sourceType || '')}">
            <div class="chat-favorites-topbar">
                <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}' aria-label="返回">
                    ${ICON_BACK}
                </button>
                <h1>${pageTitle}</h1>
                <span class="chat-favorites-topbar-spacer"></span>
            </div>

            <div class="chat-favorites-scroll">
                ${sourceHint}

                <!-- 搜索框(input 事件由 window 级委托捕获,见 chat-app/index.js) -->
                <div class="chat-favorites-search">
                    ${ICON_SEARCH}
                    <input type="search" placeholder="搜索收藏内容" aria-label="搜索收藏内容"
                           data-favorites-search
                           data-app-search
                           value="${escapeHtml(searchKeyword)}">
                </div>

                <!-- 收藏统计 -->
                <div class="chat-favorites-summary">
                    <div class="chat-favorites-summary-icon">${ICON_STAR}</div>
                    <div>
                        <strong>我的收藏</strong>
                        <span>${totalCount} 个对话片段 · ${filteredFavorites.filter(f => f.type !== 'conversation').length} 条单项收藏</span>
                    </div>
                </div>

                <!-- 分类标签 -->
                <div class="fav-category-tabs" data-favorites-tabs>
                    ${categoryTabsHtml}
                </div>

                <!-- 列表标题 -->
                <div class="chat-favorites-section-title">
                    ${initialCategory === 'all' ? '全部收藏' : `${getTypeLabel(initialCategory)}收藏`}
                </div>

                <!-- 收藏列表 -->
                <div class="chat-favorites-list">
                    ${favoriteListHtml}
                </div>
            </div>
        </div>
    `;
}

export default renderFavoritesPage;
