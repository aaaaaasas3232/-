/**
 * chat-app / 私聊详情页
 *
 * Phase 11 页面 UI 复原
 *
 * 功能:
 *   - 顶部 header (返回 + 头像 + 名字 + 状态 + 更多)
 *   - 消息气泡列表 (用户/AI/系统消息)
 *   - 回复预览区
 *   - 输入区域 (输入框 + 工具栏)
 *
 *  v0.49 表情包库绑定贯通:
 *   - renderEmojiPickerPanel 渲染 picker DOM 到 chat-private 末尾
 *   - data-emoji-open="1" 切显隐(emojiBtn toggle)
 *   - 工具栏「表情」按钮删除,替换为「自定义」占位
 *
 *  v1.0 身份转换模式:
 *   - 工具栏「自定义」按钮改名为「身份」,点击切换 swap 模式
 *   - 状态挂到 .chat-private[data-swap-active="1"]
 *   - 状态值存 app.state.chat.swapMode[`<aiPersonId>::<mode>`]
 *   - swap 模式开启后,用户发出去的消息(文字 + 图片/语音/位置/红包/转账)全部以 AI 身份显示
 */

import { escapeHtml } from '@/src/core/escape.js';
import { renderMessage, renderMessageList, renderVoiceBubble } from '../components/message-renderer.js';
import { renderEmojiPickerPanel } from '../components/emoji-picker-panel.js';
import { chatModalManager } from '../components/chat-modal-registry.js';
import {
    resolveContactDisplay,
    resolveAiAvatar,
    resolveAiAvatarAsync,
    resolveUserAvatar,
    resolveUserAvatarAsync,
    renderAvatarHtml,
} from '../aiMeta.js';

/**
 * 把带前缀的 chatBackground 值转成 CSS 值（chat-page 私聊页专用）
 * 输入: 'color:#E8F2FF' / 'gradient:linear-gradient(...)' / 'image:url/dataURL' / ''
 * 输出: 可直接塞进 style="background: ...; background-image: ..." 的字符串
 *
 * 注意:对 url(...)里的引号做转义,避免破坏外层 style 属性
 */
function chatBackgroundToStyle(value) {
    if (!value) return '';
    if (value.startsWith('color:')) {
        const hex = value.slice('color:'.length);
        return `background-color: ${hex}; background-image: none;`;
    }
    if (value.startsWith('gradient:')) {
        const grad = value.slice('gradient:'.length);
        return `background: ${grad}; background-image: ${grad};`;
    }
    if (value.startsWith('image:')) {
        const url = value.slice('image:'.length);
        // 把 url 里的 " 转义掉
        const safeUrl = url.replace(/"/g, '\\"');
        return `background-image: url("${safeUrl}"); background-color: #F8F9FA; background-size: cover; background-position: center; background-repeat: no-repeat;`;
    }
    // 兼容旧版无前缀 = 当 image 处理
    const safeUrl = value.replace(/"/g, '\\"');
    return `background-image: url("${safeUrl}"); background-color: #F8F9FA; background-size: cover; background-position: center; background-repeat: no-repeat;`;
}

/**
 * 判断消息是否为今天的消息
 * @param {Object} msg - 消息对象
 * @returns {boolean}
 */
function isTodayMessage(msg) {
    if (!msg) return false;
    
    // 有时间戳的消息
    if (msg.timestamp) {
        const msgDate = new Date(Number(msg.timestamp));
        const today = new Date();
        return msgDate.toDateString() === today.toDateString();
    }
    
    // 对于 system 类型的日期分割线，通过内容判断
    if (msg.type === 'system' && msg.content) {
        const content = msg.content;
        // 格式: "今天 HH:MM" / "昨天 HH:MM" / "MM/DD HH:MM" / "1天前" 等
        if (content.startsWith('今天')) return true;
        if (content.startsWith('昨天')) return false;
        // "1天前" / "2天前" 等表示非今天
        if (/^\d+天前/.test(content)) return false;
        // 尝试解析日期
        const match = content.match(/^(\d{1,2})\/(\d{1,2})/);
        if (match) {
            const month = parseInt(match[1]);
            const day = parseInt(match[2]);
            const today = new Date();
            return month === today.getMonth() + 1 && day === today.getDate();
        }
    }
    
    return false;
}

/**
 * 过滤消息列表，只保留当天的消息和当天的日期分割线
 * ★ v0.85 修复:移除"昨天"分割线的保留,避免用户看到"昨天"但下面只有今天消息的混乱情况
 * @param {Array} messages - 原始消息数组
 * @returns {Array} 过滤后的消息数组
 */
function filterTodayMessages(messages) {
    if (!Array.isArray(messages)) return [];

    const result = [];
    let seenTodayDivider = false;

    for (const msg of messages) {
        // 日期分割线(system 类型)
        if (msg.type === 'system') {
            const content = msg.content || '';

            // 如果是当天的分割线，保留并标记
            if (content.startsWith('今天') && !seenTodayDivider) {
                result.push(msg);
                seenTodayDivider = true;
            }
            // ★ v0.85 修复:不再保留"昨天"或"X天前"的分割线,
            //   日历模式下每天只能看到当天的消息,不需要显示昨天的日期分割线
            // 原代码:else if (content.startsWith('昨天') || /^\d+天前/.test(content)) { result.push(msg); }
            // 尝试解析日期格式 "MM/DD HH:MM"
            else {
                const match = content.match(/^(\d{1,2})\/(\d{1,2})/);
                if (match) {
                    const month = parseInt(match[1]);
                    const day = parseInt(match[2]);
                    const today = new Date();
                    if (month === today.getMonth() + 1 && day === today.getDate()) {
                        if (!seenTodayDivider) {
                            result.push(msg);
                            seenTodayDivider = true;
                        }
                    }
                    // ★ v0.85:非今天的日期分割线不保留
                }
            }
        }
        // 普通消息，如果是当天的就保留
        else if (isTodayMessage(msg)) {
            // 如果还没见过当天的分割线，但消息是今天的，可能消息比分割线更早出现
            // 此时在消息前插入一个"今天"的分割线
            if (!seenTodayDivider) {
                result.push({
                    id: 'today-divider-' + Date.now(),
                    type: 'system',
                    content: '今天'
                });
                seenTodayDivider = true;
            }
            result.push(msg);
        }
        // 非今天的普通消息不保留
    }

    return result;
}

/**
 * 把 timestamp 转成 HH:MM 格式的显示字符串。
 *  - 今天的: HH:MM
 *  - 昨天的: "昨天 HH:MM"
 *  - 早于昨天的: "MM/DD HH:MM"
 * 用来补 msg.time 字段(text-bubble.js / renderMessageActions 都读 msg.time)。
 */
function formatMessageTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (sameDay) return `${hh}:${mm}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hh}:${mm}`;
    return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

/**
 * 把 SDK 消息记录规范成 renderMessageList 期望的形状:
 *  - 补 time 字段(从 timestamp 算出)
 *  - 补 senderName(AI 消息用 aiPerson.name,user 消息用 defaultUser.name)
 */
function normalizeMessages(messages, contact) {
    if (!Array.isArray(messages)) return [];
    return messages.map((m) => {
        if (!m) return m;
        if (m.time && !m.timestamp) return m;
        const ts = Number(m.timestamp) || Date.now();
        const senderName = m.senderName || (
            m.sender === 'user'
                ? (contact?.senderName || '我')
                : (contact?.name || 'AI')
        );
        return {
            ...m,
            id: m.id,
            sender: m.sender || 'user',
            type: m.type || 'text',
            content: m.content || '',
            timestamp: ts,
            time: m.time || formatMessageTime(ts),
            senderName,
        };
    });
}

// 渲染工具栏按钮
function renderToolbarButton(action, label, iconSvg) {
    return `
        <button class="toolbar-btn" data-action="${escapeHtml(action)}">
            <div class="toolbar-btn-icon">
                ${iconSvg}
            </div>
            <span class="toolbar-btn-label">${escapeHtml(label)}</span>
        </button>
    `;
}

/**
 * 渲染私聊详情页（v0.27 user 字段存储）
 *
 *   pageId 格式: `private-<aiPersonId>-<mode>`
 *   contactId 参数 = `private-<aiPersonId>-${mode}` 拦截剩下的部分
 *   解析得到 aiPersonId + mode,从 sdk.chatFriends 读取对应 entry。
 */
export async function renderPrivateChatPage(app, contactId) {
    let contact = { id: contactId, name: '未知联系人', status: 'offline', type: 'ai' };

    // v0.28 解析 pageId: 'private-{aiPersonId}-{mode}'
    let aiPersonId = contactId;
    let mode = 'calendar';
    // 先去掉 private- 前缀
    const withoutPrivate = contactId.startsWith('private-')
        ? contactId.slice('private-'.length)
        : contactId;
    const lastDash = withoutPrivate.lastIndexOf('-');
    if (lastDash > 0) {
        const tail = withoutPrivate.slice(lastDash + 1);
        if (tail === 'calendar' || tail === 'story') {
            mode = tail;
            aiPersonId = withoutPrivate.slice(0, lastDash);
        }
    }

    await Promise.all([
        resolveAiAvatarAsync(aiPersonId),
        resolveUserAvatarAsync(),
    ]);
    try {
        const sdk = window.settingsSdk;
        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive();
        const entry = (sdk && defaultUser)
            ? sdk.chatFriends?.get?.(defaultUser, aiPersonId, mode)
            : null;
        const display = resolveContactDisplay(entry, aiPersonId);
        contact = {
            ...contact,
            id: aiPersonId,
            name: display.nickname || contact.name,
            avatar: display.avatar,
            avatarBg: display.avatarBg,
            aiPersonId: entry?.aiPersonId || aiPersonId,
            recordMode: entry?.recordMode || mode,
            remark: entry?.remark || '',
            chatBackground: entry?.chatBackground || '',
            status: entry ? 'online' : contact.status,
        };
    } catch (_) {}

    // ★ 已删除:statusText / statusColor(原用于 chat-header-status「在线」展示)

    // ★ v0.30 加载真实消息:SDK 就绪时从 chatMessages 拉消息
    //   - 真实消息需要补 time / senderName 字段
    //   ★ v0.71 fix:不要用预设 DEMO 兜底,否则 SDK 加载完后会再渲染一遍假数据,
    //     表现为"清空聊天记录后界面又出现假数据"。
    //   ★ v0.80 fix:也不要在 SDK 未就绪时回退占位消息 — 统一用空数组兜底,
    //     等待 chat:message-sent / syncNow 渲染真实数据。
    let messages = [];
    try {
        const sdk = window.settingsSdk;
        if (sdk?.chatMessages?.list) {
            const realMessages = sdk.chatMessages.list(null, aiPersonId, mode);
            if (Array.isArray(realMessages) && realMessages.length > 0) {
                // ★ v0.68 过滤:通话系统提示(call_end_notice)和通话中消息(call_chat)
                //   不渲染在普通聊天界面里 — 它们属于通话页内的内容
                //   call_record 卡片保留(用户在私聊页能看到通话记录入口)
                messages = realMessages.filter((m) => {
                    if (!m) return false;
                    if (m.type === 'call_end_notice') return false;
                    if (m.type === 'call_chat') return false;
                    return true;
                });
            }
        }
    } catch (err) {
        console.warn('[chat-page] load real messages failed:', err);
    }

    // ★ v0.61.8 过滤消息列表:只显示当天的消息,隐藏之前的聊天记录
    //   - 按日期过滤，保留当天的消息和日期分割线
    //   - 让用户只能看到今天的聊天内容
    messages = filterTodayMessages(messages);

    // ★ v0.61.4 自动归档:fire-and-forget 把当天以前的消息搬到 chatArchiveMessages
    //   - 不阻塞 renderPage 返回(archive 是 async,后台执行)
    //   - archive() 内部已经从 chatMessages.cache / db 删掉旧消息
    //   - 完成后只通知灵动岛提示,不触发 tick++(v0.38 syncRenderer 死循环温床)
    //     改用 framework 暴露的 syncNow({ force: true }) 触发整页重画
    try {
        const sdk = window.settingsSdk;
        if (sdk?.chatArchive?.archive) {
            sdk.chatArchive.archive(aiPersonId, mode, {
                now: Date.now(),
                conversationType: 'private',
            }).then((res) => {
                if (res && res.archivedCount > 0) {
                    const daySummary = Object.entries(res.byDay || {})
                        .map(([d, n]) => `${d} ${n}条`).join('、');
                    try {
                        window.__phoneIsland?.notify?.('info',
                            `已归档 ${res.archivedCount} 条历史消息`,
                            daySummary || '');
                    } catch (_) {}
                    // ★ 不用 ++tick / invalidateRendererCache(走 v0.38 syncRenderer 死循环温床),
                    //   改用 framework 暴露的 syncNow({ force: true }) 触发整页重画
                    try {
                        window.__appRendererBridge?.syncNow?.({ force: true });
                    } catch (_) {}
                }
            }).catch((err) => {
                console.warn('[chat-page] archive pass failed', err);
            });
        }
    } catch (_) {}

    // 使用组件系统渲染消息列表
    // ★ v0.32 userAvatar / userAvatarBg:从 SDK 拿当前 user 社媒头像,
    //   让用户消息气泡(self avatar)也用真实头像,不再是固定「我」+ #F4A6CD
    // ★ v0.71 统一头像来源:走 aiMeta.resolveUserAvatar()
    const userAv = resolveUserAvatar();
    const userAvatar = userAv.url;
    const userAvatarBg = userAv.bg;
    const messageListHtml = renderMessageList(
        normalizeMessages(messages, contact),
        contact,
        { userAvatar, userAvatarBg, aiPersonId, mode }
    );

    // ★ v0.43 读取 chat action state(replyingTo / multiSelectActive / selectedMessages)
    //   用于动态渲染 reply-preview + 多选 toolbar 激活态
    let replyingTo = null;
    let multiSelectActive = false;
    let selectedCount = 0;
    try {
        const state = app?.state?.chat?.action;
        if (state) {
            replyingTo = state.replyingTo || null;
            multiSelectActive = !!state.multiSelectActive;
            if (state.selectedMessages && state.selectedMessages.size) {
                // 只算当前 (aiPersonId, mode) 对应的 key
                const prefix = `${aiPersonId}::${mode}::`;
                state.selectedMessages.forEach((k) => { if (k.startsWith(prefix)) selectedCount++; });
            }
        }
    } catch (_) {}
    const replyPreviewHtml = replyingTo
        ? (() => {
            const label = replyingTo.senderLabel || (replyingTo.sender === 'user' ? '我' : contact.name || aiPersonId);
            const txt = String(replyingTo.text || '').slice(0, 60);
            // ★ v0.44 修复:添加 active 类让 CSS 显示块生效(默认 .reply-preview 是 display:none)
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
    const multiSelectBarStyle = multiSelectActive ? '' : ' style="display:none"';

    // ★ v0.49 表情面板开关:读取 app.state.chat.emojiOpen,挂到 .chat-private 的 data-emoji-open 属性
    //   CSS 选择器 [data-emoji-open="1"] 切显隐 — 不靠 v-html 重画
    let emojiOpen = false;
    try {
        emojiOpen = !!(app?.state?.chat?.emojiOpen);
    } catch (_) {}

    // ★ v1.0 身份转换模式开关:读取 app.state.chat.swapMode[`<aiPersonId>::<mode>`]
    //   - true → data-swap-active="1"(CSS 切到粉色 + 工具栏底显示提示条)
    //   - 切换在 index.js 的 toolBtn click handler / toggleSwapMode() 完成
    let swapActive = false;
    try {
        const key = `${aiPersonId}::${mode}`;
        swapActive = !!(app?.state?.chat?.swapMode?.[key]);
    } catch (_) {}
    const chatPrivateClass = `chat-private chat-${mode}${multiSelectActive ? ' multi-select-mode' : ''}`;
    const chatPrivateDataEmoji = emojiOpen ? ' data-emoji-open="1"' : '';
    const chatPrivateDataSwap = swapActive ? ' data-swap-active="1"' : '';

    // 工具栏按钮 SVG
    const toolbarButtons = `
        ${renderToolbarButton('image', '图片', '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21 15 16 10 5 21" fill="none" stroke="currentColor" stroke-width="2"/></svg>')}
        ${renderToolbarButton('voice', '语音', '<svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="2"/><line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" stroke-width="2"/></svg>')}
        ${renderToolbarButton('custom', '身份', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11h.01"/><path d="M14 6h.01"/><path d="M18 6h.01"/><path d="M6.5 13.1h.01"/><path d="M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3"/><path d="M17.4 9.9c-.8.8-2 .8-2.8 0"/><path d="M10.1 7.1C9 7.2 7.7 7.7 6 8.6c-3.5 2-4.7 3.9-3.7 5.6 4.5 7.8 9.5 8.4 11.2 7.4.9-.5 1.9-2.1 1.9-4.7"/><path d="M9.1 16.5c.3-1.1 1.4-1.7 2.4-1.4"/></svg>')}
        ${renderToolbarButton('location', '位置', '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>')}
        ${renderToolbarButton('redpacket', '红包', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z"/><path d="M16 10h.01"/><path d="M2 8v1a2 2 0 0 0 2 2h1"/></svg>')}
        ${renderToolbarButton('transfer', '转账', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>')}
        ${renderToolbarButton('call', '通话', '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" fill="none" stroke="currentColor" stroke-width="2"/></svg>')}
        ${renderToolbarButton('favorite', '收藏', '<svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="2"/></svg>')}
    `;

    const bgAttr = contact.chatBackground
        ? ` data-chat-bg="1" style="${chatBackgroundToStyle(contact.chatBackground).replace(/"/g, '&quot;')}"`
        : '';

    // ★ v0.33 把当前消息列表写到 dataset.rawMessages(JSON 字符串),
    //   让 chat-forward.js 能从 DOM 抓出来作为「被转发消息」的原始数据。
    //   容量有限(消息很多会让 attribute 变大),只存最近 100 条 + 关键字段。
    // ★ v0.67 扩 compact 字段:保留 redpacketCard / transferCard 字段,
    //   让 .redpacket-card / .transfer-card 点击 handler 能从 DOM 拿完整信息。
    const compactMessages = messages.slice(-100).map((m) => ({
        id: m.id,
        sender: m.sender,
        senderId: m.senderId || '',
        senderName: m.senderName || '',
        type: m.type || 'text',
        content: typeof m.content === 'string' ? m.content : '',
        timestamp: m.timestamp || Date.now(),
        redpacketCard: m.redpacketCard || null,
        transferCard: m.transferCard || null,
    }));
    const rawMessagesAttr = ` data-raw-messages="${escapeHtml(JSON.stringify(compactMessages))}"`;

    return `
        <div class="${chatPrivateClass}" data-contact-id="${escapeHtml(contactId)}" data-mode="${escapeHtml(mode)}" data-conversation-type="private" data-conversation-id="${escapeHtml(aiPersonId)}" data-conversation-name="${escapeHtml(contact.name)}"${bgAttr}${rawMessagesAttr}${chatPrivateDataEmoji}${chatPrivateDataSwap}>
            <!-- 顶部栏 -->
            <div class="chat-header">
                <div class="chat-header-left">
                    <button class="chat-back-btn" id="chatBackBtn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                        <svg viewBox="0 0 24 24">
                            <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    ${renderAvatarHtml(resolveAiAvatar(aiPersonId), 'chat-header-avatar')}
                    <div class="chat-header-info">
                        <div class="chat-header-name">${escapeHtml(contact.name)}</div>
                        <!-- ★ 已删除:chat-header-status「在线」标签不再展示 -->
                    </div>
                </div>
            <div class="chat-header-right">
                    <div class="header-actions">
                        <!-- ★ v0.67.x 修复:补 payload { aiPersonId, mode },触发后 triggerVoiceCall 才能拿到联系人上下文 -->
                        <button class="header-btn"
                            data-app-action='${escapeHtml(JSON.stringify({ action: 'appMethod', appId: 'chat', method: 'triggerVoiceCall', payload: { aiPersonId, mode } }))}'
                            title="语音通话">
                            <svg viewBox="0 0 24 24">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" fill="none" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                        <button class="header-btn"
                            data-app-action='${escapeHtml(JSON.stringify({ action: 'appMethod', appId: 'chat', method: 'triggerVideoCall', payload: { aiPersonId, mode } }))}'
                            title="视频通话">
                            <svg viewBox="0 0 24 24">
                                <polygon points="23 7 16 12 23 17 23 7" fill="none" stroke="currentColor" stroke-width="2"/>
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                        <button class="header-btn"
                            data-app-action='{"action":"appMethod","appId":"chat","method":"toggleMultiSelect","payload":{"aiPersonId":"${escapeHtml(aiPersonId)}","mode":"${escapeHtml(mode)}"}}'
                            title="多选">
                            <svg viewBox="0 0 24 24">
                                <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
                                <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                        <button class="header-btn" data-app-action='{"action":"detail","appId":"chat","pageId":"chat-settings-${escapeHtml(aiPersonId)}-${escapeHtml(mode)}"}' title="更多">
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
                        data-app-action="${escapeHtml(JSON.stringify({ action: 'appMethod', appId: 'chat', method: 'favoriteMulti', payload: { aiPersonId, mode } }))}"
                        title="收藏">收藏</button>
                    <button class="multi-select-action" type="button"
                        data-app-action="${escapeHtml(JSON.stringify({ action: 'appMethod', appId: 'chat', method: 'forwardMulti', payload: { aiPersonId, mode } }))}"
                        title="转发">转发</button>
                    <button class="multi-select-action multi-select-action--danger" type="button"
                        data-app-action="${escapeHtml(JSON.stringify({ action: 'appMethod', appId: 'chat', method: 'deleteMulti', payload: { aiPersonId, mode } }))}"
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
            <!-- /reply-preview 静态占位(v0.43 已改为动态 ${replyPreviewHtml}) -->
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
                    <div class="message-input" contenteditable="true" data-placeholder="输入消息..." id="messageInput"></div>
                    <button class="emoji-btn" id="emojiBtn">
                        <svg viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            <line x1="9" y1="9" x2="9.01" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <line x1="15" y1="9" x2="15.01" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>

                <button class="send-btn" id="sendBtn">
                    <svg viewBox="0 0 24 24">
                        <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor"/>
                    </svg>
                </button>
            </div>

            <!-- 工具组 -->
            <div class="input-toolbar" id="inputToolbar">
                <div class="toolbar-content">
                    <div class="toolbar-grid">
                        ${toolbarButtons}
                    </div>
                </div>
            </div>

            <!-- ★ v0.49 表情选择器面板 (与工具组同级,data-emoji-open 控制显隐) -->
            ${renderEmojiPickerHtml(aiPersonId)}
        </div>
    `;
}

/**
 * ★ v0.49 渲染表情选择器面板 HTML
 *   - 同步返回字符串(v-html 上下文)
 *   - 缩略图异步填充:由 initPrivateChatInteractions 在 DOM 出现后调 _fillEmojiPickerImages
 *
 * @param {string} aiPersonId 当前对话 AI 人设 id (仅用于调试,实际读 user persona 的 stickerGroupIds)
 */
function renderEmojiPickerHtml(aiPersonId) {
    let stickerGroupIds = [];
    try {
        const sdk = window.settingsSdk;
        const activeUser = sdk?.users?.getActive?.();
        if (activeUser) {
            const bound = activeUser.boundResources || {};
            stickerGroupIds = Array.isArray(bound.stickerGroupIds) ? bound.stickerGroupIds : [];
        }
    } catch (_) {}
    return `<div class="chat-emoji-picker" data-picker-target="${escapeHtml(aiPersonId)}">${renderEmojiPickerPanel({ stickerGroupIds })}</div>`;
}

export default renderPrivateChatPage;

/**
 * 处理私聊页顶栏按钮点击（语音/视频/多选/备注等）
 * @param {string} action - 按钮 action 类型
 * @param {Object} data - 按钮 data 属性数据
 * @param {Object} app - app 实例
 */
export function handlePrivateChatAction(action, data, app) {
    switch (action) {
        case 'remark':
            // 打开备注弹窗
            if (data && data.contactId && data.mode) {
                openAiRemarkModal(data.contactId, data.mode, app);
            }
            break;
        case 'voice-call':
            window.__phoneIsland?.notify?.('info', '语音通话', '即将开放');
            break;
        case 'video-call':
            window.__phoneIsland?.notify?.('info', '视频通话', '即将开放');
            break;
        case 'multiselect':
            window.__phoneIsland?.notify?.('info', '多选模式', '即将开放');
            break;
        default:
            console.warn('[chat] unknown private action:', action);
    }
}

/**
 * 打开 AI 备注弹窗
 * @param {string} contactId - 联系人 ID (aiPersonId)
 * @param {string} mode - 当前模式 'calendar' | 'story'
 * @param {Object} app - app 实例
 */
export function openAiRemarkModal(contactId, mode) {
    const sdk = window.settingsSdk;

    // 解析 contactId: 可能是 'ai0' 或 'ai0::calendar' 格式
    let aiPersonId = contactId;
    let effectiveMode = mode;
    if (contactId && contactId.includes('::')) {
        const parts = contactId.split('::');
        aiPersonId = parts[0];
        effectiveMode = parts[1] || mode || 'calendar';
    }

    const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive();
    const entry = (sdk && defaultUser)
        ? sdk.chatFriends?.get?.(defaultUser, aiPersonId, effectiveMode)
        : null;

    const name = entry?.displayName || aiPersonId || '未知联系人';
    const avatarBg = resolveAiAvatar(aiPersonId).bg;
    const currentRemark = entry?.remark || '';

    chatModalManager.openAiRemark({
        name,
        avatarBg,
        remark: currentRemark,
        mode: effectiveMode,
        onSave: async (remarkText) => {
            // 保存备注到 SDK
            if (sdk && defaultUser) {
                try {
                    await sdk.chatFriends?.updateRemark?.(sdk, defaultUser, aiPersonId, effectiveMode, remarkText);
                    window.__phoneIsland?.notify?.('success', '备注已保存', remarkText ? `「${remarkText.slice(0, 20)}...」` : '已清空备注');
                } catch (err) {
                    console.error('[chat] save remark failed:', err);
                    window.__phoneIsland?.notify?.('error', '保存失败', '请重试');
                }
            } else {
                window.__phoneIsland?.notify?.('success', '备注已保存', '（Demo 模式）');
            }
        },
        onClose: () => {
            // 关闭后刷新聊天设置页和私聊页显示最新备注名
            setTimeout(() => {
                // 刷新聊天设置页
                if (typeof window.__detailRenderTick !== 'undefined') {
                    window.__detailRenderTick.value++;
                }
                // 通知聊天页刷新联系人名称
                document.dispatchEvent(new CustomEvent('chat:remark-updated', {
                    detail: { contactId: aiPersonId, mode: effectiveMode }
                }));
            }, 100);
        },
    });
}

/**
 * 根据 callRecordId 反查一条通话记录
 *   - 优先从当前渲染的消息列表(已包含 call_record 类型)里反查
 *   - 找不到再回退到 SDK 的 callRecords API
 *   - 找不到就返回 null,调用方自己处理空态
 */
export function findDemoCallRecordById(callRecordId) {
    if (!callRecordId) return null;
    try {
        const sdk = window.settingsSdk;
        if (sdk?.callRecords?.get) {
            const rec = sdk.callRecords.get(callRecordId);
            if (rec) return rec;
        }
    } catch (_) {}
    return null;
}

/**
 * 拍一拍:在私聊页注入一条居中提示气泡
 *
 *  - 文案来源:user/AI 的 patSetting(socialProfiles.chat.patSetting)
 *  - 由 chat-page 内部维护一段「拍一拍」气泡模板(没有边框和底色,也没有头像占位),
 *    后续注入 DOM 直接 append 到 .chat-messages
 *  - 仅针对「私聊页」(chatPrivate)有效;群聊目前不做
 *
 * @param {HTMLElement} chatPrivate - 私聊容器 .chat-private
 * @param {string} [from] - 谁发起拍一拍:'user' = 用户拍 AI;'ai' = AI 拍用户。默认 'user'(双击 AI 头像)
 * @returns {boolean} - true 表示成功注入,false 表示环境不满足
 *
 * ★ v0.45:改为 async，持久化拍一拍消息到 IndexedDB
 * ★ v0.61.9:from 参数区分双击用户头像/双击 AI 头像,只生成对应方向的 1 条气泡
 */
export async function triggerPatAction(chatPrivate, from = 'user') {
    if (!chatPrivate) return false;
    try {
        const sdk = window.settingsSdk;
        const contactId = chatPrivate.dataset.contactId || '';
        const mode = chatPrivate.dataset.mode || 'calendar';

        // 解析 aiPersonId（contactId 可能是 ai0 或旧格式 ai-1 或 private-xxx-mode）
        let aiPersonId = contactId;
        const withoutPrivate = contactId.startsWith('private-')
            ? contactId.slice('private-'.length)
            : contactId;
        const lastDash = withoutPrivate.lastIndexOf('-');
        if (lastDash > 0 && (withoutPrivate.slice(lastDash + 1) === 'calendar' || withoutPrivate.slice(lastDash + 1) === 'story')) {
            aiPersonId = withoutPrivate.slice(0, lastDash);
        }

        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
        const userPat = defaultUser?.patSetting
            || sdk?.users?.get?.(defaultUser?.id)?.patSetting
            || '拍了拍我';
        let aiPerson = null;
        try {
            aiPerson = sdk?.aiPersons?.get?.(aiPersonId);
            if (!aiPerson && sdk?.aiPersons?.list) {
                aiPerson = sdk.aiPersons.list().find((p) => p.id === aiPersonId) || null;
            }
        } catch (_) {}
        const aiPat = aiPerson?.socialProfiles?.chat?.patSetting
            || aiPerson?.patSetting
            || '拍了拍我';

        const messagesContainer = chatPrivate.querySelector('.chat-messages');
        if (!messagesContainer) return false;

        const now = Date.now();
        const userNick = escapeHtml(defaultUser?.socialProfiles?.chat?.nickname || defaultUser?.name || '我');
        const aiNick = escapeHtml(aiPerson?.socialProfiles?.chat?.nickname || aiPerson?.name || aiPersonId || '对方');
        const userPatText = escapeHtml(userPat);
        const aiPatText = escapeHtml(aiPat);

        if (from === 'ai') {
            // AI 拍用户
            const aiMsgId = `pat-ai-${now}`;
            if (sdk?.chatMessages?.add && defaultUser) {
                await sdk.chatMessages.add(defaultUser, aiPersonId, mode, {
                    id: aiMsgId,
                    sender: 'ai',
                    senderName: aiNick,
                    type: 'pat',
                    content: `${aiNick} ${aiPatText} ${userNick}`,
                    timestamp: now,
                });
            }
            const aiPatMsg = document.createElement('div');
            aiPatMsg.className = 'message-wrapper pat-bubble pat-from-ai';
            aiPatMsg.innerHTML = `
                <div class="pat-bubble-inner">
                    <div class="pat-bubble-text">
                        <span class="pat-bubble-actor">${aiNick}</span>
                        <span class="pat-bubble-action"> ${aiPatText}</span>
                        <span class="pat-bubble-target"> ${userNick}</span>
                    </div>
                </div>
            `;
            messagesContainer.appendChild(aiPatMsg);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            return true;
        }

        // 默认:用户拍 AI
        const userMsgId = `pat-user-${now}`;
        if (sdk?.chatMessages?.add && defaultUser) {
            await sdk.chatMessages.add(defaultUser, aiPersonId, mode, {
                id: userMsgId,
                sender: 'user',
                senderName: userNick,
                type: 'pat',
                content: `${userNick} ${userPatText} ${aiNick}`,
                timestamp: now,
            });
        }

        const userPatMsg = document.createElement('div');
        userPatMsg.className = 'message-wrapper pat-bubble pat-from-user';
        userPatMsg.innerHTML = `
            <div class="pat-bubble-inner">
                <div class="pat-bubble-text">
                    <span class="pat-bubble-actor">${userNick}</span>
                    <span class="pat-bubble-action"> ${userPatText}</span>
                    <span class="pat-bubble-target"> ${aiNick}</span>
                </div>
            </div>
        `;
        messagesContainer.appendChild(userPatMsg);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return true;
    } catch (err) {
        console.warn('[chat-page] triggerPatAction failed:', err);
        return false;
    }
}

// 导出组件引用供外部使用
export { renderMessage, renderVoiceBubble as renderVoiceMessageBubble };
