/**
 * chat-app / 消息操作组组件 (v0.43 重写)
 *
 * 全部走 framework 派发链:每个按钮 data-app-action
 *  - 单条动作(method): copyMessage / editMessage / quoteMessage / favoriteMessage / deleteMessage / forwardMessage
 *  - payload: { messageId, aiPersonId, mode, sender } 全部走 payload,不要写到顶层
 *
 *  v0.72:
 *   - AI 消息新增「重roll」按钮(派发 method: rerollMessage):
 *       · 删除该消息之后的所有消息(含后续 user/ai)
 *       · 重生当前 AI 回复
 *       · 重写 prompt 上下文(= 不含后续消息的 history)
 *       · 私聊/群聊都生效
 *   - 撤回按钮本次仍保留占位但不挂派发(后续单独实现)
 *
 * 使用方式:
 *   import { renderMessageActions } from './message-actions.js';
 *   const actionsHtml = renderMessageActions(msgId, ctx, options);
 *
 *   ctx.sender: 'user' | 'ai'  (决定是显示「重roll」按钮)
 *   ctx.mode:   'calendar' | 'story'
 *   ctx.conversationType: 'private' | 'group' (群聊时 aiPersonId 字段就是 groupId)
 */

import { escapeHtml } from '@/src/core/escape.js';
import { DEFAULT_AI_AVATAR_BG, DEFAULT_USER_AVATAR_BG } from '../aiMeta.js';

// ============================================
// SVG 图标定义
// ============================================
const ICONS = {
    copy: `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
    edit: `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
    reply: `<svg viewBox="0 0 24 24"><path d="M9 17l-5-5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 18v-2a4 4 0 0 0-4-4H4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    favorite: `<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
    delete: `<svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
    forward: `<svg viewBox="0 0 24 24"><path d="M15 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 18v-2a4 4 0 0 1 4-4h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    sendToAi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
};

/**
 * 构造单条消息操作按钮的 data-app-action attr(JSON 字符串)
 *  - payload 包含消息身份信息(messageId + aiPersonId + mode + sender)
 *  - framework 通过顶层 click 委托派发,无需在 v-html 内 addEventListener
 */
function buildActionAttr(method, ctx) {
    return escapeHtml(JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method,
        payload: {
            messageId: ctx.messageId,
            aiPersonId: ctx.aiPersonId,
            mode: ctx.mode,
            sender: ctx.sender,
            // ★ v0.44 透传 text 用于引用回复预览
            text: ctx.text || '',
            senderLabel: ctx.senderLabel || '',
        },
    }));
}

/**
 * 全局已收藏 messageId 注册表（用于渲染时高亮按钮）
 * key = `${aiPersonId}|${mode}|${messageId}`
 */
if (typeof window !== 'undefined') {
    window.__chatFavoritedIds = new Set();
}

/**
 * 注册/注销已收藏的 messageId
 * @param {string} aiPersonId
 * @param {string} mode
 * @param {string} messageId
 * @param {boolean} added - true=添加, false=移除
 */
export function registerFavoritedId(aiPersonId, mode, messageId, added) {
    if (typeof window !== 'undefined') {
        const key = `${aiPersonId}|${mode}|${messageId}`;
        if (added) {
            window.__chatFavoritedIds.add(key);
        } else {
            window.__chatFavoritedIds.delete(key);
        }
    }
}

/**
 * 检查某个 messageId 是否已收藏
 * ★ v0.44:同时检查内存 Set 和 SDK 真实收藏(页面刷新后 Set 被清空,需要从 IndexedDB 读取)
 */
export function isMessageFavorited(aiPersonId, mode, messageId) {
    const key = `${aiPersonId}|${mode}|${messageId}`;
    // 1. 先检查内存 Set(当前会话新收藏的)
    if (window.__chatFavoritedIds?.has(key)) {
        return true;
    }
    // 2. 检查 SDK 真实收藏(页面刷新后 Set 被清空,从 IndexedDB 读取)
    try {
        const sdk = window.settingsSdk;
        if (sdk?.chatFavorites) {
            const user = sdk.defaultUserCard?.getDefault?.() || sdk.users?.getActive?.();
            if (user) {
                return sdk.chatFavorites.has(user, aiPersonId, mode, messageId);
            }
        }
    } catch (_) {}
    return false;
}

/**
 * 渲染通用操作按钮(全部走 data-app-action)
 * @param {object} ctx - { messageId, aiPersonId, mode, sender }
 */
function renderCommonButtons(ctx) {
    const isFav = isMessageFavorited(ctx.aiPersonId, ctx.mode, ctx.messageId);
    const actions = [
        { className: 'copy', method: 'copyMessage', title: '复制', icon: ICONS.copy },
        { className: 'edit', method: 'editMessage', title: '编辑', icon: ICONS.edit },
        { className: 'reply', method: 'quoteMessage', title: '回复', icon: ICONS.reply },
        { className: 'favorite' + (isFav ? ' favorited' : ''), method: 'favoriteMessage', title: isFav ? '已收藏' : '收藏', icon: ICONS.favorite },
        { className: 'delete', method: 'deleteMessage', title: '删除', icon: ICONS.delete },
        { className: 'forward', method: 'forwardMessage', title: '转发', icon: ICONS.forward },
    ];
    return actions.map((a) => `
        <button class="action-btn ${a.className}"
                data-app-action="${buildActionAttr(a.method, ctx)}"
                title="${escapeHtml(a.title)}"
                type="button">${a.icon}</button>
    `).join('');
}

/**
 * 渲染用户专属操作按钮 — v0.72 启用「重roll」
 *  - 用户点重roll = 删除该消息之后的所有消息,然后重新触发 AI 回复(找之前最后一条 AI 消息的发送者)
 *  - 派发 method: rerollMessage，payload 里 sender 字段区分来源
 */
function renderUserOnlyButtons(ctx) {
    const action = escapeHtml(JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'rerollMessage',
        payload: {
            messageId: ctx.messageId,
            aiPersonId: ctx.aiPersonId,
            mode: ctx.mode,
            sender: 'user',
            conversationType: ctx.conversationType || 'private',
            senderId: ctx.senderId || '',
        },
    }));
    return `<button class="action-btn reroll"
                    title="重roll"
                    type="button"
                    data-app-action="${action}">${ICONS_NOT_IMPLEMENTED.reroll}</button>`;
}

/**
 * 渲染 AI 专属操作按钮 — v0.72 启用「重roll」派发
 *  - data-app-action → method: rerollMessage
 *  - payload: { messageId, aiPersonId, mode, sender:'ai', conversationType, senderId }
 *    (群聊时 aiPersonId=groupId, senderId=具体的 AI 成员 ID)
 */
function renderAiOnlyButtons(ctx) {
    const action = escapeHtml(JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'rerollMessage',
        payload: {
            messageId: ctx.messageId,
            aiPersonId: ctx.aiPersonId,
            mode: ctx.mode,
            sender: 'ai',
            conversationType: ctx.conversationType || 'private',
            // 群聊里 senderId = 具体的 AI 人设 ID,AI 重生时按它调 AI
            senderId: ctx.senderId || '',
        },
    }));
    return `<button class="action-btn reroll"
                    title="重roll"
                    type="button"
                    data-app-action="${action}">${ICONS_NOT_IMPLEMENTED.reroll}</button>`;
}

// 占位 SVG(未实现的撤回 / 重roll,样式保留但不派发)
const ICONS_NOT_IMPLEMENTED = {
    recall: `<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M21 3v5h-5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
    reroll: `<svg viewBox="0 0 24 24"><path d="M1 4v6h6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M23 20v-6h-6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
};

/**
 * 渲染消息操作组
 *
 * @param {string} msgId          消息 ID
 * @param {object} ctx            { sender, aiPersonId, mode }
 * @param {object} options
 *   showEdit         boolean   是否显示编辑按钮(默认 true)
 *   showForward      boolean   是否显示转发按钮(默认 true)
 *   showSendToAi    boolean   是否显示"发送给AI"按钮(仅群聊时显示,默认 false)
 * @returns {string} HTML 字符串
 */
export function renderMessageActions(msgId, ctx, options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};
    const {
        showEdit = true,
        showForward = true,
        showSendToAi = false, // ★ v0.85:默认不显示,群聊页面传 true
    } = opts;

    let buttons = renderCommonButtons({ ...ctx, messageId: msgId });

    // 移除不需要的按钮
    if (!showEdit) {
        buttons = buttons.replace(/<button class="action-btn edit"[\s\S]*?<\/button>/, '');
    }
    if (!showForward) {
        buttons = buttons.replace(/<button class="action-btn forward"[\s\S]*?<\/button>/, '');
    }

    const senderButton = (ctx.sender === 'user' ? renderUserOnlyButtons : renderAiOnlyButtons)({
        ...ctx,
        messageId: msgId,
    });

    // ★ v0.85:群聊时显示"发送给AI"按钮(所有消息都显示)
    const sendToAiButton = showSendToAi ? renderSendToAiButton({ ...ctx, messageId: msgId }) : '';

    return `
        <div class="message-actions" data-message-id="${escapeHtml(msgId)}">
            ${buttons}
            ${senderButton}
            ${sendToAiButton}
        </div>
    `;
}

/**
 * ★ v0.85 渲染"发送给AI"按钮
 * 群聊时可用:将消息内容发送给AI处理
 */
function renderSendToAiButton(ctx) {
    const action = escapeHtml(JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'sendMessageToAi',
        payload: {
            messageId: ctx.messageId,
            aiPersonId: ctx.aiPersonId,
            mode: ctx.mode,
            sender: ctx.sender,
            conversationType: ctx.conversationType || 'group',
            text: ctx.text || '',
            senderLabel: ctx.senderLabel || '',
        },
    }));
    return `<button class="action-btn send-to-ai"
                    title="发送给AI"
                    type="button"
                    data-app-action="${action}">${ICONS.sendToAi}</button>`;
}

/**
 * 渲染选择按钮(多选模式专用)
 * - 走 data-app-action (method: toggleMessageSelect)
 */
export function renderSelectButton(msgId, ctx) {
    const payload = escapeHtml(JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'toggleMessageSelect',
        payload: {
            messageId: msgId,
            aiPersonId: ctx?.aiPersonId || '',
            mode: ctx?.mode || 'calendar',
        },
    }));
    return `
        <button class="message-select-button"
                type="button"
                aria-label="选择消息"
                data-message-select="${escapeHtml(msgId)}"
                data-app-action="${payload}">
            <span class="message-select-check"></span>
        </button>
    `;
}

/**
 * 渲染头像
 *
 * @param {boolean} isUser - 是否为用户消息
 * @param {string} senderName - 发送者名称
 * @param {string} avatarBg - 头像背景色 (可选)
 * @param {string} avatarUrl - 头像图片 URL (可选,v0.31+) — 有就渲染 <img>,无就回退首字母
 * @returns {string} HTML 字符串
 */
export function renderAvatar(isUser, senderName = '', avatarBg = null, avatarUrl = '') {
    const bg = avatarBg || (isUser ? DEFAULT_USER_AVATAR_BG : DEFAULT_AI_AVATAR_BG);
    const text = isUser ? '我' : (senderName?.charAt(0) || '?');

    // v0.31:有 avatarUrl 就渲染 img,没有就走首字母 placeholder
    let inner;
    if (avatarUrl && typeof avatarUrl === 'string') {
        inner = `<img src="${escapeHtml(avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`;
    } else {
        inner = escapeHtml(text);
    }

    return `
        <div class="avatar ${isUser ? 'self' : 'other'}" data-poke="${isUser ? 'self' : 'other'}" style="background: ${bg};">
            ${inner}
        </div>
    `;
}

/**
 * 渲染引用回复
 *
 * @param {object|string} replyTo  引用对象 { senderName, content, type } 或纯文本
 *   兼容两种存储格式:
 *   - 新格式: { text, senderLabel } (quoteMessage 存储的格式)
 *   - 旧格式: { content, senderName } (renderReplyQuote 期望的格式)
 * @returns {string} HTML 字符串
 */
export function renderReplyQuote(replyTo) {
    if (!replyTo) return '';
    if (typeof replyTo === 'string') {
        return `
            <div class="reply-quote" style="display:flex;align-items:center;padding:6px 10px;background:rgba(168,200,236,0.2);border-left:3px solid #A8C8EC;border-radius:0 8px 8px 0;margin-bottom:8px;font-size:12px;color:#666;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A8C8EC" stroke-width="2" style="flex-shrink:0;margin-right:4px;">
                    <path d="M9 17l-5-5 5-5"/><path d="M20 18v-2a4 4 0 00-4-4H4"/>
                </svg>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(replyTo)}</span>
            </div>
        `;
    }
    // ★ v0.44 兼容两种格式:新格式(text/senderLabel) 和旧格式(content/senderName)
    const sender = replyTo.senderName || replyTo.senderLabel || (replyTo.sender === 'user' ? '我' : '');
    const text = replyTo.content || replyTo.text || replyTo.summary || '';
    const senderLabel = sender ? `${sender}: ` : '';
    return `
        <div class="reply-quote" style="display:flex;align-items:center;padding:6px 10px;background:rgba(168,200,236,0.2);border-left:3px solid #A8C8EC;border-radius:0 8px 8px 0;margin-bottom:8px;font-size:12px;color:#666;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A8C8EC" stroke-width="2" style="flex-shrink:0;margin-right:4px;">
                <path d="M9 17l-5-5 5-5"/><path d="M20 18v-2a4 4 0 00-4-4H4"/>
            </svg>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(senderLabel + text)}</span>
        </div>
    `;
}

/**
 * 渲染时间戳
 *
 * @param {string} time - 时间字符串
 * @returns {string} HTML 字符串
 */
export function renderTime(time) {
    return `<div class="message-time">${escapeHtml(time)}</div>`;
}

// 导出所有图标（供外部使用）
export { ICONS };