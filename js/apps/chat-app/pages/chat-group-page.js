/**
 * chat-app / 群聊详情页
 *
 * 群聊与私聊共享同一套消息渲染管线(message-renderer.js):
 *   - text / image / sticker / voice / descriptive_image / location / redpacket
 *   - transfer / call_record / chat_record / pat / system 全部复用
 *
 * 群聊特有差异:
 *   - 群头像(九宫格拼接)
 *   - 非用户消息显示「发送者名字」(在 bubble 上方)
 *   - 连续气泡合并:同一个 AI 连发的两条消息,第二条隐藏头像 / 名字(对齐微信/QQ 习惯)
 *   - 工具栏为 6 个按钮(图片/语音/@成员/公告/成员/游戏)
 *   - 发送消息走 sdk.chatMessages.add(标 conversationType='group') + sdk.chatGroups.updateLastMessage
 *
 * v0.49 表情包库绑定贯通:
 *   - 群聊也支持 #emojiBtn 笑脸 → 切换表情面板
 *   - picker 数据源:当前 user persona 的 boundResources.stickerGroupIds (跟私聊一致)
 *
 * v0.62 重写:复用 message-renderer,补完整发送/动作/转发/收藏链路。
 *
 * 参考: 参考/chat.js openGroupChatDetail() + renderGroupMessages()
 */

import { escapeHtml } from '@/src/core/escape.js';
import { renderMessage } from '../components/message-renderer.js';
import { renderTextBubble } from '../components/text-bubble.js';
import { renderEmojiPickerPanel } from '../components/emoji-picker-panel.js';
import { getAiMeta } from '../aiMeta.js';

/**
 * 解析 SDK chatMessages.add 期望的 aiPersonId / mode / conversationType 字段。
 * 群聊跟私聊共用 chatMessages 表,以 aiPersonId(= groupId)做主键,
 * 同时 conversationType='group' / conversationId=groupId 用于 SDK 兼容。
 */
function parseConvId(groupId) {
    return {
        aiPersonId: groupId,
        conversationType: 'group',
        conversationId: groupId,
    };
}

/**
 * 从 SDK 实时读 AI 成员 meta(优先 aiPersons.get,失败走 group.members 快照)
 */
function getMemberMeta(aiPersonId, fallbackMembers = []) {
    const meta = getAiMeta(aiPersonId);
    if (meta.exists) return meta;
    // 兜底:从 group.members 找名字
    const fb = (fallbackMembers || []).find((m) => (m.id || m.aiPersonId) === aiPersonId);
    if (fb) {
        return {
            exists: false,
            nickname: fb.name || fb.displayName || aiPersonId,
            avatar: fb.avatar || '',
            avatarBg: fb.avatarBg || '#A8C8EC',
            background: '',
            patSetting: '',
            initial: (fb.name || fb.displayName || aiPersonId || '?').charAt(0),
        };
    }
    return {
        exists: false,
        nickname: aiPersonId,
        avatar: '',
        avatarBg: '#A8C8EC',
        background: '',
        patSetting: '',
        initial: (aiPersonId || '?').charAt(0),
    };
}

/**
 * 渲染群头像 (九宫格拼接)
 */
function renderGroupAvatar(members, size = 42) {
    const gridSize = Math.min(members.length, 4);
    const cellSize = size / 2;
    const gap = 1;

    let cellsHtml = '';
    for (let i = 0; i < 4; i++) {
        if (i < gridSize) {
            const member = members[i];
            const meta = getMemberMeta(member.id || member.aiPersonId, members);
            const char = (meta.nickname || '?').charAt(0);
            const bg = meta.avatarBg || '#E8E8E8';
            const inner = meta.avatar
                ? `<img src="${escapeHtml(meta.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;" />`
                : escapeHtml(char);
            cellsHtml += `<div style="background:${bg};display:flex;align-items:center;justify-content:center;font-size:${size * 0.24}px;color:white;font-weight:500;">${inner}</div>`;
        } else {
            cellsHtml += `<div style="background:#E8E8E8;"></div>`;
        }
    }

    return `
        <div class="group-avatar" style="width:${size}px;height:${size}px;border-radius:10px;overflow:hidden;border:2px solid #D6E4FF;background:#fff;display:grid;grid-template-columns:repeat(2,1fr);gap:${gap}px;cursor:pointer;">
            ${cellsHtml}
        </div>
    `;
}

/**
 * 群聊文本消息气泡:
 *   - 跟私聊 text-bubble 同结构(复用 message-renderer 体系)
 *   - 群聊额外:非 user 消息上方显示 sender-name
 *   - 群聊额外:连续消息合并头像/名字(由 CSS class .consecutive 控制)
 *
 * 直接 renderTextBubble 即可,再加 senderName 顶部 + consecutive class。
 */
function renderGroupTextBubble(msg, ctx = {}) {
    const isUser = msg.sender === 'user';
    const memberMeta = !isUser ? getMemberMeta(msg.senderId, ctx.fallbackMembers || []) : null;
    const senderLabel = isUser ? '我' : (msg.senderName || memberMeta?.nickname || msg.senderId || '未知');

    // ★ 决定是否需要「发送者名字条」
    //   showSenderName: true 表示「这是新一段对话的第一条」,需要显示名字 + 头像
    //   false: 上一条是同一发送者,合并
    const showSenderName = ctx.showSenderName !== false;
    const senderNameHtml = showSenderName && !isUser
        ? `<div class="sender-name">${escapeHtml(senderLabel)}</div>`
        : '';

    // ★ 用 renderTextBubble 渲染主体(复用私聊渲染器,保证一致性)
    //   注意:群聊场景下 aiPersonId 必须传 groupId(不是 senderId),action 按钮的 payload 才能正确定位会话
    const aiPersonId = ctx.groupId || msg.conversationId || '';
    const inner = renderTextBubble(msg, {
        name: senderLabel,
        avatar: memberMeta?.avatar || '',
        avatarBg: memberMeta?.avatarBg || '#A8C8EC',
        aiPersonId,
    }, {
        aiPersonId,
        mode: msg.mode || ctx.mode || 'calendar',
        userAvatar: ctx.userAvatar,
        userAvatarBg: ctx.userAvatarBg,
    });

    // ★ 注入 group 上下文:
    //   1. 添加 senderNameHtml(在 message-content 之前)
    //   2. 给 message-wrapper 加 .consecutive(隐藏头像/名字)
    //   3. 加 data-sender-id 让 CSS / JS 都能定位发送者
    let wrapped = inner;
    if (senderNameHtml) {
        // 把 senderNameHtml 插入到 .message-content 内的 .reply-quote 之前
        wrapped = wrapped.replace(
            /<div class="message-content">\s*<div class="reply-quote">/,
            `<div class="message-content">${senderNameHtml}<div class="reply-quote">`
        );
        // 没有 reply-quote 时(更常见),直接在 .message-content 内顶部塞 senderName
        if (wrapped.indexOf(senderNameHtml) === -1) {
            wrapped = wrapped.replace(
                /<div class="message-content">/,
                `<div class="message-content">${senderNameHtml}`
            );
        }
    }
    if (!showSenderName) {
        wrapped = wrapped.replace(
            /class="message-wrapper (\w+)"/,
            `class="message-wrapper $1 consecutive"`
        );
    }
    return wrapped;
}

/**
 * 渲染群聊消息列表
 *   - 跟私聊共用 renderMessageList
 *   - 文本/图片/sticker 用 renderGroupTextBubble 加 senderName
 *   - 其他类型直接复用私聊渲染器
 *   - 连续气泡合并:遍历时检查上一条同 sender + 时间间隔 < 60s → 隐藏头像/名字
 */
function renderGroupMessageList(messages, ctx = {}) {
    if (!messages || messages.length === 0) {
        return `
            <div class="group-welcome">
                <div class="group-welcome-icon">
                    <svg viewBox="0 0 24 24">
                        <circle cx="9" cy="7" r="4"/>
                        <circle cx="15" cy="7" r="4"/>
                        <path d="M3 21v-2c0-2.21 3.58-4 8-4s8 1.79 8 4v2"/>
                    </svg>
                </div>
                <div class="group-welcome-title">欢迎来到群聊</div>
                <div class="group-welcome-subtitle">发送第一条消息开始聊天</div>
                <div class="group-welcome-hint">
                    <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                        <circle cx="12" cy="12" r="1" fill="currentColor"/>
                        <circle cx="12" cy="6" r="1" fill="currentColor"/>
                        <circle cx="12" cy="18" r="1" fill="currentColor"/>
                    </svg>
                    <span>群聊使用长按发送模式</span>
                </div>
            </div>
        `;
    }

    const out = [];
    let prev = null;
    for (let i = 0; i < messages.length; i++) {
        const m = messages[i];
        // system 类型不参与合并,也不被前一帧「consecutive」
        if (m.type === 'system') {
            out.push(renderMessage(m, ctx.contact || {}, {
                aiPersonId: ctx.groupId,
                mode: ctx.mode,
            }));
            prev = null;
            continue;
        }

        const ts = m.timestamp || 0;
        const sameAsPrev = prev
            && prev.sender === m.sender
            && (ts - (prev.timestamp || 0)) < 60_000
            && prev.type === m.type;

        // 文本/图片/sticker 走群聊文本渲染(支持 senderName + consecutive)
        if (m.type === 'text' || m.type === 'image' || m.type === 'sticker') {
            out.push(renderGroupTextBubble(m, {
                ...ctx,
                showSenderName: !sameAsPrev,
            }));
        } else {
            // 其他类型(voice / location / redpacket / transfer / call_record / chat_record / pat / descriptive_image)
            // 全部复用 message-renderer,但 contact 需要带 AI 头像信息
            const aiPersonId = m.sender === 'user' ? '' : (m.senderId || '');
            const memberMeta = m.sender !== 'user' ? getMemberMeta(m.senderId, ctx.fallbackMembers || []) : null;
            const bubbleContact = {
                name: m.senderName || (memberMeta?.nickname || aiPersonId || '未知'),
                avatar: memberMeta?.avatar || '',
                avatarBg: memberMeta?.avatarBg || '#A8C8EC',
                aiPersonId,
            };
            const bubbleHtml = renderMessage(m, bubbleContact, {
                aiPersonId: ctx.groupId,
                mode: ctx.mode,
                userAvatar: ctx.userAvatar,
                userAvatarBg: ctx.userAvatarBg,
                isGroup: true,
            });
            // 加 sender-name + consecutive
            let wrapped = bubbleHtml;
            if (!sameAsPrev && m.sender !== 'user' && (m.senderName || memberMeta?.nickname)) {
                const label = escapeHtml(m.senderName || memberMeta?.nickname || '');
                wrapped = wrapped.replace(
                    /<div class="message-content">/,
                    `<div class="message-content"><div class="sender-name">${label}</div>`
                );
            }
            if (sameAsPrev) {
                wrapped = wrapped.replace(
                    /class="message-wrapper (\w+)"/,
                    `class="message-wrapper $1 consecutive"`
                );
            }
            out.push(wrapped);
        }
        prev = m;
    }
    return out.join('');
}

/**
 * 渲染群聊工具栏按钮
 */
function renderGroupToolbarButton(action, label, iconSvg, iconBg) {
    return `
        <button class="group-toolbar-btn" data-action="${escapeHtml(action)}">
            <div class="group-toolbar-btn-icon" style="background: ${iconBg};">
                ${iconSvg}
            </div>
            <span class="group-toolbar-btn-label">${escapeHtml(label)}</span>
        </button>
    `;
}

/**
 * 渲染群聊详情页
 */
export function renderGroupChatPage(app, groupId) {
    // ★ v0.62 真实群聊:从 sdk.chatGroups + sdk.chatMessages 读真实数据
    let realGroup = null;
    let realMembers = [];
    let realMessages = [];
    let mode = 'calendar';
    try {
        const sdk = window.settingsSdk;
        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
        if (sdk?.chatGroups && defaultUser) {
            // 优先在两个 mode 都找一遍:history 模式 / 旧 pageId 兼容
            for (const m of ['calendar', 'story']) {
                const g = sdk.chatGroups.get(defaultUser, groupId, m);
                if (g) {
                    realGroup = g;
                    mode = m;
                    realMembers = sdk.chatGroups.resolveMembers(sdk, defaultUser, g);
                    if (sdk.chatMessages?.list) {
                        realMessages = sdk.chatMessages.list(defaultUser, groupId, m);
                    }
                    break;
                }
            }
        }
    } catch (err) {
        console.warn('[chat-group-page] read real group failed', err);
    }

    const useReal = !!realGroup;
    const displayGroup = realGroup || { id: groupId, name: '未知群聊', members: [] };
    const displayMembers = useReal ? realMembers : [];
    const displayName = displayGroup.name || '未知群聊';
    const displayMemberCount = (displayGroup.members || displayMembers || []).length;

    // ★ v0.62 群聊 SDK 写盘后,fallback 也要兼容老 groupId (demo 群)
    let displayMessages = realMessages;
    if (!useReal && (!displayMessages || displayMessages.length === 0)) {
        // demo 群:用 DEMO_GROUP_MESSAGES(老路径)
        const demoGroup = DEMO_GROUPS[groupId];
        if (demoGroup) {
            displayMessages = DEMO_GROUP_MESSAGES;
            displayMembers.push(...demoGroup.members);
        }
    }
    displayMessages = displayMessages || [];

    // ★ 读 user 头像(给 user 消息用)
    let userAvatar = '';
    let userAvatarBg = '';
    try {
        const sdk = window.settingsSdk;
        const activeUser = sdk?.users?.getActive?.();
        if (activeUser) {
            const chatProfile = activeUser.socialProfiles?.chat || {};
            userAvatar = chatProfile.avatar || activeUser.avatar || '';
            userAvatarBg = chatProfile.avatarBg || activeUser.avatarBg || '';
        }
    } catch (_) {}

    // ★ v0.62 跟私聊对齐:读 chat action state(replyingTo)用于动态渲染 reply-preview
    let replyingTo = null;
    let multiSelectActive = false;
    let selectedCount = 0;
    try {
        const state = app?.state?.chat?.action;
        if (state) {
            replyingTo = state.replyingTo || null;
            multiSelectActive = !!state.multiSelectActive;
            if (state.selectedMessages && state.selectedMessages.size) {
                const prefix = `${groupId}::${mode}::`;
                state.selectedMessages.forEach((k) => { if (k.startsWith(prefix)) selectedCount++; });
            }
        }
    } catch (_) {}

    // ★ v0.62 把消息做 normalize(补 time / senderName,跟私聊一致)
    const normalizedMessages = (displayMessages || []).map((m) => {
        if (!m) return m;
        const ts = Number(m.timestamp) || Date.now();
        let senderName = m.senderName || '';
        if (!senderName && m.sender !== 'user') {
            const meta = getMemberMeta(m.senderId, displayMembers);
            senderName = meta.nickname || m.senderId || 'AI';
        } else if (!senderName && m.sender === 'user') {
            senderName = '我';
        }
        const timeStr = m.time || formatTime(ts);
        return {
            ...m,
            sender: m.sender || 'user',
            type: m.type || 'text',
            content: m.content || '',
            timestamp: ts,
            time: timeStr,
            senderName,
            senderId: m.senderId || '',
            mode: m.mode || mode,
            conversationType: m.conversationType || 'group',
            conversationId: m.conversationId || groupId,
        };
    });

    // ★ v0.61.4 自动归档(跟私聊同款)
    try {
        const sdk = window.settingsSdk;
        if (sdk?.chatArchive?.archive) {
            sdk.chatArchive.archive(groupId, mode, {
                now: Date.now(),
                conversationType: 'group',
            }).then((res) => {
                if (res && res.archivedCount > 0) {
                    const daySummary = Object.entries(res.byDay || {})
                        .map(([d, n]) => `${d} ${n}条`).join('、');
                    try {
                        window.__phoneIsland?.notify?.('info',
                            `已归档 ${res.archivedCount} 条历史消息`,
                            daySummary || '');
                    } catch (_) {}
                    try {
                        window.__appRendererBridge?.syncNow?.({ force: true });
                    } catch (_) {}
                }
            }).catch((err) => {
                console.warn('[chat-group-page] archive pass failed', err);
            });
        }
    } catch (_) {}

    // 渲染群头像
    const groupAvatarHtml = renderGroupAvatar(displayMembers, 42);

    // 渲染消息列表
    const messageListHtml = renderGroupMessageList(normalizedMessages, {
        groupId,
        mode,
        fallbackMembers: displayMembers,
        userAvatar,
        userAvatarBg,
    });

    // ★ rawMessages 数据:转发消息时要从 DOM 还原
    const compactMessages = (normalizedMessages || []).slice(-100).map((m) => ({
        id: m.id,
        sender: m.sender,
        senderId: m.senderId || '',
        senderName: m.senderName || '',
        type: m.type || 'text',
        content: typeof m.content === 'string' ? m.content : '',
        timestamp: m.timestamp || Date.now(),
    }));
    const rawMessagesAttr = ` data-raw-messages="${escapeHtml(JSON.stringify(compactMessages))}"`;

    // ★ emojiOpen 状态(与私聊共享)
    let emojiOpen = false;
    try {
        emojiOpen = !!(app?.state?.chat?.emojiOpen);
    } catch (_) {}
    const chatGroupDataEmoji = emojiOpen ? ' data-emoji-open="1"' : '';

    // ★ 多选模式浮层 (跟私聊同款)
    const multiSelectBarStyle = multiSelectActive ? '' : ' style="display:none"';

    // ★ reply-preview 动态
    const replyPreviewHtml = replyingTo
        ? (() => {
            const label = replyingTo.senderLabel || (replyingTo.sender === 'user' ? '我' : (replyingTo.senderId || 'AI'));
            const txt = String(replyingTo.text || '').slice(0, 60);
            return `
            <div class="reply-preview active" id="replyPreview">
                <div class="reply-preview-content">
                    <svg class="reply-quote-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A8C8EC" stroke-width="2" style="vertical-align:middle;margin-right:4px;flex-shrink:0;">
                        <path d="M9 17l-5-5 5-5"/><path d="M20 18v-2a4 4 0 00-4-4H4"/>
                    </svg>
                    <span class="reply-preview-text" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">回复 <strong>${escapeHtml(label)}</strong>:${escapeHtml(txt)}</span>
                    <button class="cancel-reply-btn" type="button"
                        data-app-action='{"action":"appMethod","appId":"chat","method":"cancelReply"}'
                        style="width:20px;height:20px;background:#F0F0F0;border:none;color:#8E8E8E;cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:8px;font-size:12px;">×</button>
                </div>
            </div>`;
        })()
        : '';
    const replyPreviewStyle = replyingTo ? '' : ' style="display:none"';

    // 群聊工具栏 (6个按钮)
    const toolbarButtons = `
        ${renderGroupToolbarButton('image', '图片', '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="#5A6B7D" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="#5A6B7D"/><polyline points="21 15 16 10 5 21" fill="none" stroke="#5A6B7D" stroke-width="2"/></svg>', '#E4E8ED')}
        ${renderGroupToolbarButton('voice', '语音', '<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="none" stroke="#5A6B7D" stroke-width="2"/><path d="M17 10v2c0 2.76-2.24 5-5 5s-5-2.24-5-5v-2" fill="none" stroke="#5A6B7D" stroke-width="2"/><line x1="12" y1="19" x2="12" y2="23" stroke="#5A6B7D" stroke-width="2"/><line x1="8" y1="23" x2="16" y2="23" stroke="#5A6B7D" stroke-width="2"/></svg>', '#E4E8ED')}
        ${renderGroupToolbarButton('mention', '@成员', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#4A6FA5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2" stroke="#4A6FA5" stroke-width="2"/><path d="M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="#4A6FA5" stroke-width="2"/></svg>', '#D6E4FF')}
        ${renderGroupToolbarButton('announcement', '公告', '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill="none" stroke="#D97706" stroke-width="2"/><path d="M13.73 21a2 2 0 0 1-3.46 0" fill="none" stroke="#D97706" stroke-width="2"/></svg>', '#FEF3C7')}
        ${renderGroupToolbarButton('members', '成员', '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="#5A6B7D" stroke-width="2"/><circle cx="9" cy="7" r="4" fill="none" stroke="#5A6B7D" stroke-width="2"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" fill="none" stroke="#5A6B7D" stroke-width="2"/><path d="M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="#5A6B7D" stroke-width="2"/></svg>', '#E4E8ED')}
        ${renderGroupToolbarButton('game', '游戏', '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="#4A6FA5" stroke-width="2"/><path d="M12 6v12M7 10v4M17 10v4" stroke="#4A6FA5" stroke-width="2" stroke-linecap="round"/></svg>', '#D6E4FF')}
    `;

    return `
        <div class="chat-group chat-${mode}${multiSelectActive ? ' multi-select-mode' : ''}" data-group-id="${escapeHtml(groupId)}" data-mode="${escapeHtml(mode)}" data-conversation-type="group" data-conversation-id="${escapeHtml(groupId)}" data-conversation-name="${escapeHtml(displayName)}"${rawMessagesAttr}${chatGroupDataEmoji}>
            <!-- 顶部栏 -->
            <div class="chat-header">
                <div class="chat-header-left">
                    <button class="chat-back-btn" id="chatBackBtn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                        <svg viewBox="0 0 24 24">
                            <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    ${groupAvatarHtml}
                    <div class="chat-header-info">
                        <div class="chat-header-name">${escapeHtml(displayName)} (${displayMemberCount})</div>
                        <div class="chat-header-status" data-status="trigger">
                            <span class="status-hint">长按发送触发回复</span>
                        </div>
                    </div>
                </div>
                <div class="chat-header-right">
                    <div class="header-actions">
                        <button class="header-btn" data-action="multiselect" title="多选">
                            <svg viewBox="0 0 24 24">
                                <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
                                <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                        <button class="header-btn" data-action="group-settings" title="更多"
                            data-app-action='{"action":"detail","appId":"chat","pageId":"group-settings-${escapeHtml(groupId)}"}'>
                            <svg viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="1"/>
                                <circle cx="19" cy="12" r="1"/>
                                <circle cx="5" cy="12" r="1"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- 多选模式浮层 -->
            <div class="multi-select-bar" aria-label="多选操作"${multiSelectBarStyle}>
                <span class="multi-select-count">已选 <strong data-selected-count>${selectedCount}</strong> 条</span>
                <div class="multi-select-actions">
                    <button class="multi-select-action" type="button"
                        data-app-action='{"action":"appMethod","appId":"chat","method":"favoriteMulti","payload":{"groupId":"${escapeHtml(groupId)}","mode":"${escapeHtml(mode)}"}}'
                        title="收藏">收藏</button>
                    <button class="multi-select-action" type="button"
                        data-app-action='{"action":"appMethod","appId":"chat","method":"forwardMulti","payload":{"groupId":"${escapeHtml(groupId)}","mode":"${escapeHtml(mode)}"}}'
                        title="转发">转发</button>
                    <button class="multi-select-action multi-select-action--danger" type="button"
                        data-app-action='{"action":"appMethod","appId":"chat","method":"deleteMulti","payload":{"groupId":"${escapeHtml(groupId)}","mode":"${escapeHtml(mode)}"}}'
                        title="删除">删除</button>
                    <button class="multi-select-cancel" type="button"
                        data-app-action='{"action":"appMethod","appId":"chat","method":"exitMultiSelect"}'>取消</button>
                </div>
            </div>

            <!-- 消息列表 -->
            <div class="chat-messages">
                ${messageListHtml}
            </div>

            <!-- 回复预览 -->
            ${replyPreviewHtml}
            <div id="replyPreviewStatic"${replyPreviewStyle} hidden></div>

            <!-- 输入区域 -->
            <div class="input-container">
                <button class="expand-toolbar-btn" id="expandToolbarBtn" type="button" aria-label="展开聊天工具" aria-expanded="false">
                    <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                        <circle cx="12" cy="6" r="1.5" fill="currentColor"/>
                        <circle cx="12" cy="18" r="1.5" fill="currentColor"/>
                    </svg>
                </button>

                <div class="input-wrapper">
                    <div class="message-input" contenteditable="true" data-placeholder="发送消息到群聊..." id="messageInput"></div>
                    <button class="emoji-btn" id="emojiBtn">
                        <svg viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            <line x1="9" y1="9" x2="9.01" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="15" y1="9" x2="15.01" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>

                <!-- 群聊发送按钮 -->
                <button class="send-btn group-send-btn" id="sendBtn">
                    <svg viewBox="0 0 24 24">
                        <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor"/>
                    </svg>
                </button>
            </div>

            <!-- 工具组 (从输入栏下方展开,默认收起) -->
            <div class="input-toolbar" id="inputToolbar">
                <div class="toolbar-content">
                    <div class="group-toolbar-grid">
                        ${toolbarButtons}
                    </div>
                </div>
            </div>

            <!-- ★ v0.49 表情选择器面板 (群聊同款,与工具组同级,data-emoji-open 切显隐) -->
            ${renderGroupEmojiPickerHtml(groupId)}
        </div>
    `;
}

/**
 * 把 timestamp 转成 HH:MM 显示字符串
 */
function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

// Demo 群聊数据(老路径兼容)
const DEMO_GROUPS = {
    'group-1': {
        id: 'group-1',
        name: '游戏群',
        memberCount: 4,
        members: [
            { id: 'ai-1', name: '小美', avatarBg: '#FF9ECD' },
            { id: 'ai-2', name: '小明', avatarBg: '#A8C8EC' },
            { id: 'ai-3', name: '小蓝', avatarBg: '#B8E6CF' },
        ]
    },
    'group-2': {
        id: 'group-2',
        name: '学习小组',
        memberCount: 3,
        members: [
            { id: 'ai-1', name: '小美', avatarBg: '#FF9ECD' },
            { id: 'ai-2', name: '小明', avatarBg: '#A8C8EC' },
        ]
    },
};

// Demo 群聊消息数据
const DEMO_GROUP_MESSAGES = [
    {
        id: 'gm1',
        senderId: 'ai-1',
        senderName: '小美',
        sender: 'ai',
        type: 'text',
        content: '大家好！今天我们一起玩狼人杀吧～',
        time: '14:00',
        timestamp: Date.now() - 7 * 60 * 1000,
    },
    {
        id: 'gm2',
        sender: 'user',
        type: 'text',
        content: '好呀好呀！我要当预言家！',
        time: '14:01',
        timestamp: Date.now() - 6 * 60 * 1000,
    },
    {
        id: 'gm3',
        senderId: 'ai-2',
        senderName: '小明',
        sender: 'ai',
        type: 'text',
        content: '那我当猎人好了，你们别冤枉我',
        time: '14:02',
        timestamp: Date.now() - 5 * 60 * 1000,
    },
    {
        id: 'gm4',
        senderId: 'ai-3',
        senderName: '小蓝',
        sender: 'ai',
        type: 'text',
        content: '哈哈哈，那我当平民吧～',
        time: '14:03',
        timestamp: Date.now() - 4 * 60 * 1000,
    },
    {
        id: 'gm5',
        sender: 'system',
        type: 'system',
        content: '今天 14:05',
        timestamp: Date.now() - 2 * 60 * 1000,
    },
    {
        id: 'gm6',
        sender: 'user',
        type: 'text',
        content: '开始吧！第一晚谁睁眼？',
        time: '14:05',
        timestamp: Date.now() - 1 * 60 * 1000,
    },
    {
        id: 'gm7',
        senderId: 'ai-1',
        senderName: '小美',
        sender: 'ai',
        type: 'text',
        content: '预言家请睁眼～ @小明 你想验谁？',
        time: '14:06',
        timestamp: Date.now() - 30 * 1000,
    },
    {
        id: 'gm8',
        senderId: 'ai-2',
        senderName: '小明',
        sender: 'ai',
        type: 'text',
        content: '验一下小蓝吧',
        time: '14:07',
        timestamp: Date.now() - 10 * 1000,
    },
];

/**
 * ★ v0.49 渲染群聊表情选择器 HTML
 *   数据源:当前 user persona 的 boundResources.stickerGroupIds
 */
function renderGroupEmojiPickerHtml(groupId) {
    let stickerGroupIds = [];
    try {
        const sdk = window.settingsSdk;
        const activeUser = sdk?.users?.getActive?.();
        if (activeUser) {
            const bound = activeUser.boundResources || {};
            stickerGroupIds = Array.isArray(bound.stickerGroupIds) ? bound.stickerGroupIds : [];
        }
    } catch (_) {}
    return `<div class="chat-emoji-picker" data-picker-target="${escapeHtml(groupId)}">${renderEmojiPickerPanel({ stickerGroupIds })}</div>`;
}

// 导出内部函数供 chat-app/index.js initGroupChatInteractions 复用
export { parseConvId, getMemberMeta };

export default renderGroupChatPage;
