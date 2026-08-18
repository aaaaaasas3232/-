/**
 * chat-emoji-panel.js
 *
 * ★ v0.70 抽取自 chat-app/index.js
 *   原来 initPrivateChatInteractions(5725 起) 和 initGroupChatInteractions(9630 起)
 *   各自内联了:
 *     - #emojiBtn toggle 表情面板
 *     - .chat-emoji-picker__close 关闭按钮
 *     - .chat-emoji-cell[data-sticker-code] 发送 sticker 消息
 *   私聊/群聊差异仅在 sticker 写入时是否带 conversationType/conversationId 字段
 *   (群聊 SDK 需要 conversationType='group' + conversationId=groupId 才能写对位置)
 *
 * 用法:
 *   import { bindEmojiPanelInteractions } from '../components/chat-emoji-panel.js';
 *   bindEmojiPanelInteractions(chatRoot, { conversationType: 'private' | 'group' });
 */

import { scrollToBottomWithRetry } from './chat-scroll.js';

/**
 * 把 emoji panel 的三个交互绑到 chatRoot 上(emojiBtn 切换、close 按钮、sticker 点击)
 *
 * @param {HTMLElement} chatRoot .chat-private 或 .chat-group
 * @param {{
 *   conversationType: 'private'|'group',
 * }} opts
 */
export function bindEmojiPanelInteractions(chatRoot, opts = {}) {
    if (!chatRoot) return;
    const { conversationType = 'private', chatApp = null } = opts;
    chatRoot.addEventListener('click', async (event) => {
        // ★ v0.70:外部传入 chatApp 引用,避免依赖 window.externalAppRegistry(它没挂到 window)
        const appRef = chatApp || window.__chatAppSingleton || null;

        // 1) #emojiBtn 切换表情面板
        const emojiBtn = event.target.closest('#emojiBtn');
        if (emojiBtn) {
            const isOpen = chatRoot.getAttribute('data-emoji-open') === '1';
            if (isOpen) {
                chatRoot.removeAttribute('data-emoji-open');
                if (appRef?.state?.chat) chatApp.state.chat.emojiOpen = false;
            } else {
                chatRoot.setAttribute('data-emoji-open', '1');
                if (appRef?.state?.chat) chatApp.state.chat.emojiOpen = true;
                try {
                    const sdk = window.settingsSdk;
                    const activeUser = sdk?.users?.getActive?.();
                    const ids = activeUser?.boundResources?.stickerGroupIds || [];
                    const { _prerenderEmojiPicker } = await import('./emoji-picker-panel.js');
                    _prerenderEmojiPicker(ids, chatRoot).catch((err) => {
                        console.warn('[chat-app] prerender emoji picker failed', err);
                    });
                } catch (err) {
                    console.warn('[chat-app] prerender emoji picker (toggle) failed', err);
                }
            }
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        // 2) 关闭按钮
        const emojiClose = event.target.closest('.chat-emoji-picker__close');
        if (emojiClose) {
            chatRoot.removeAttribute('data-emoji-open');
            if (appRef?.state?.chat) chatApp.state.chat.emojiOpen = false;
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        // 3) 表情图片 → 发送 sticker 消息
        const stickerCell = event.target.closest('.chat-emoji-cell[data-sticker-code]');
        if (stickerCell) {
            const code = stickerCell.getAttribute('data-sticker-code');
            const targetId = chatRoot.dataset.conversationId || chatRoot.dataset.groupId || '';
            const mode = chatRoot.dataset.mode || 'calendar';
            try {
                const sdk = window.settingsSdk;
                const sender = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
                if (!sender) {
                    window.__phoneIsland?.notify?.('warning', '发送失败', '未找到默认用户');
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                const { _loadSource } = await import('./emoji-picker-panel.js');
                const url = await _loadSource(code);
                if (!url) {
                    window.__phoneIsland?.notify?.('warning', '表情加载失败', '原图不存在');
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                const now = Date.now();
                const msgId = `sticker-${now}`;
                // 私聊 swap / 群聊自定义身份：用所选人的名字 + sender='ai'
                const swapOn = chatRoot.getAttribute('data-swap-active') === '1';
                const userSenderName = sender?.socialProfiles?.chat?.nickname || sender?.name || '我';
                const groupAsId = conversationType === 'group'
                    ? String(chatRoot.dataset.sendAsId || '').trim()
                    : '';
                const aiSenderName = (conversationType === 'group' && groupAsId)
                    ? (chatRoot.dataset.sendAsName || 'AI')
                    : (chatRoot.dataset.conversationName || 'AI');
                const writeSenderName = swapOn ? aiSenderName : userSenderName;
                const writeSenderId = swapOn
                    ? (groupAsId || (conversationType === 'group' ? '' : targetId))
                    : String(sender?.id || '');
                let saved = null;
                if (sdk?.chatMessages?.add) {
                    const msgPayload = {
                        id: msgId,
                        sender: swapOn ? 'ai' : 'user',
                        senderName: writeSenderName,
                        senderId: writeSenderId,
                        type: 'sticker',
                        content: '[表情]',
                        url,
                        stickerCode: code,
                        timestamp: now,
                    };
                    // 群聊 SDK 需要显式 conversationType / conversationId
                    if (conversationType === 'group') {
                        msgPayload.conversationType = 'group';
                        msgPayload.conversationId = targetId;
                    }
                    saved = await sdk.chatMessages.add(sender, targetId, mode, msgPayload);
                }
                if (saved) {
                    const cacheKey = conversationType === 'group'
                        ? chatRoot.dataset.groupId
                        : chatRoot.dataset.contactId;
                    try { window.invalidateRendererCache?.('chat', cacheKey); } catch (_) {}
                    const messagesContainer = chatRoot.querySelector('.chat-messages');
                    if (messagesContainer) {
                        const { renderTextBubble } = await import('./text-bubble.js');
                        const tempDiv = document.createElement('div');
                        // ★ v1.0 swap 模式:className 跟 sender 保持一致,让 CSS 走 received 样式
                        tempDiv.className = `message-wrapper ${swapOn ? 'ai' : 'user'}`;
                        tempDiv.dataset.messageId = msgId;
                        // swap 模式:contact 传 AI 头像,让 sticker 气泡左侧显示 AI 头像
                        let renderContact = null;
                        if (swapOn) {
                            try {
                                const { resolveAiAvatar } = await import('../aiMeta.js');
                                const avatarId = groupAsId || targetId;
                                const aiAv = resolveAiAvatar(avatarId);
                                renderContact = {
                                    name: writeSenderName,
                                    senderName: writeSenderName,
                                    avatar: aiAv.url,
                                    avatarBg: aiAv.bg,
                                };
                            } catch (_) {}
                        }
                        tempDiv.innerHTML = renderTextBubble(saved, renderContact, { aiPersonId: targetId, mode });
                        messagesContainer.appendChild(tempDiv);
                        scrollToBottomWithRetry(messagesContainer);
                    }
                    chatRoot.removeAttribute('data-emoji-open');
                    if (appRef?.state?.chat) chatApp.state.chat.emojiOpen = false;
                    window.__phoneIsland?.notify?.('success', '已发送表情');
                } else {
                    window.__phoneIsland?.notify?.('warning', '发送失败', '消息未保存');
                }
            } catch (err) {
                console.error('[chat-app] send sticker failed', err);
                window.__phoneIsland?.notify?.('error', '发送失败', err?.message || '');
            }
            event.preventDefault();
            event.stopPropagation();
        }
    });
}

/**
 * 初始化时预渲染 emoji picker(进聊天页时调用)
 * @param {HTMLElement} chatRoot
 */
export async function prerenderEmojiPickerOnInit(chatRoot) {
    if (!chatRoot) return;
    try {
        const sdk = window.settingsSdk;
        const activeUser = sdk?.users?.getActive?.();
        const ids = activeUser?.boundResources?.stickerGroupIds || [];
        if (ids.length > 0) {
            const { _prerenderEmojiPicker } = await import('./emoji-picker-panel.js');
            _prerenderEmojiPicker(ids, chatRoot).catch((err) => {
                console.warn('[chat-app] prerender emoji picker (init) failed', err);
            });
        }
    } catch (err) {
        console.warn('[chat-app] init emoji picker failed', err);
    }
}

/**
 * 进入聊天页即滚到底(私聊/群聊共用)
 */
export function scrollChatToBottomOnInit(chatRoot) {
    if (!chatRoot) return;
    try {
        const container = chatRoot.querySelector('.chat-messages');
        scrollToBottomWithRetry(container);
    } catch (_) { /* ignore */ }
}
