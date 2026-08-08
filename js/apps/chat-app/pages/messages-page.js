/**
 * chat-app / 消息列表页
 *
 * 仿妆原则: 用 framework 的脸，画 chat.js 的妆
 * - 容器结构: 交给 framework (.app-screen-panel 提供 padding 和滚动)
 * - 视觉效果: CSS 实现 chat.js 的 UI 效果
 *
 * 样式规范:
 *   - 所有样式写到 css/apps/chat/_chat-messages.css
 *   - JS 只放动态数据属性(data-*)和无法预知的动态颜色
 *   - 不允许 style="" 内联非颜色类的样式
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createDetailAction, createActionAttr } from '@/src/core/actions.js';
import { getChatRecordMode, getModeConfig } from '../chat-mode.js';
import { getAiMeta, resolveContactDisplay } from '../aiMeta.js';

/**
 * 当 settingsSdk 未就绪时,订阅 settings-sdk-ready 事件,SDK 一就绪就触发 framework 重画。
 * 跟 chat-app 其它地方同款「先 ready 后渲染」策略。
 * 幂等:多次调用也只挂一次监听。
 */
let _sdkReadyListenerBound = false;
export function ensureSdkReadyThenRefresh(app) {
    if (_sdkReadyListenerBound) return;
    _sdkReadyListenerBound = true;
    if (window.settingsSdk) return; // 已经就绪,直接返回(下次 render 自然能拿到)
    const handler = () => {
        window.removeEventListener('settings-sdk-ready', handler);
        _sdkReadyListenerBound = false;
        // 触发 framework 重画当前 chat-app 的 messages tab
        try {
            const tickRef = typeof window !== 'undefined' ? window.__detailRenderTick : null;
            if (tickRef && typeof tickRef.value === 'number') tickRef.value++;
        } catch (_) {}
    };
    window.addEventListener('settings-sdk-ready', handler, { once: true });
}

// 在线状态管理
let _chatsStatusMap = new Map();
let _statusListenerBound = false;

/**
 * 绑定在线状态监听（仅执行一次）
 */
function bindStatusListener() {
    if (_statusListenerBound) return;
    _statusListenerBound = true;

    window.addEventListener('chat:online-status-updated', (e) => {
        const { contactId, isOnline } = e.detail || {};
        if (contactId !== undefined) {
            _chatsStatusMap.set(contactId, isOnline);
            // 触发 UI 刷新
            const container = document.querySelector('.app-shell[data-app-id="chat"] .chat-messages');
            if (container) {
                const item = container.querySelector(`[data-chat-id="${escapeHtml(contactId)}"]`);
                if (item) {
                    const dot = item.querySelector('.chat-online-dot');
                    if (isOnline) {
                        if (!dot) {
                            const avatarWrap = item.querySelector('.chat-avatar-wrap');
                            if (avatarWrap) avatarWrap.insertAdjacentHTML('beforeend', '<div class="chat-online-dot"></div>');
                        }
                    } else {
                        dot?.remove();
                    }
                }
            }
        }
    });

    // ★ v0.30 监听聊天消息发送事件,在消息列表原地更新该联系人的预览/时间
    //   不走 framework 整体重画(会闪),只动这一行 DOM
    window.addEventListener('chat:message-sent', (e) => {
        const { aiPersonId, mode: evtMode, message } = e.detail || {};
        if (!aiPersonId || !message) return;
        const currentMode = getChatRecordMode();
        // 只在同 mode 下更新预览
        if (evtMode && evtMode !== currentMode) return;

        const container = document.querySelector('.app-shell[data-app-id="chat"] .chat-messages-list-page .chat-messages');
        if (!container) return;
        const item = container.querySelector(`[data-chat-id="${escapeHtml(aiPersonId)}"]`);
        if (!item) return;

        // 1. 更新预览文字
        const previewEl = item.querySelector('.chat-preview-text, .chat-preview-default');
        if (previewEl) {
            const senderLabel = (message.senderName || (message.sender === 'user' ? '我' : '')) + ': ';
            const safeContent = String(message.content || '').slice(0, 25);
            previewEl.textContent = senderLabel + safeContent;
            previewEl.classList.remove('chat-preview-default');
            previewEl.classList.add('chat-preview-text');
        }

        // 2. 更新时间戳
        const timeEl = item.querySelector('.chat-time');
        if (timeEl) {
            const m = message.timestamp ? new Date(message.timestamp) : new Date();
            const diff = Date.now() - m.getTime();
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);
            if (minutes < 1) timeEl.textContent = '刚刚';
            else if (minutes < 60) timeEl.textContent = `${minutes}分钟前`;
            else if (hours < 24) timeEl.textContent = `${hours}小时前`;
            else if (days < 7) timeEl.textContent = `${days}天前`;
            else timeEl.textContent = m.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        }

        // 3. 把这条 row 顶到最前(如果不是置顶状态)
        if (!item.classList.contains('chat-item--pinned')) {
            // 把所有非置顶的同类 row 先收集起来,把这条放最前
            const allUnpinned = Array.from(container.querySelectorAll('.chat-item:not(.chat-item--pinned)'));
            // 移除其它不置顶项,再 append 当前项到容器末尾前置
            // 简单做法: 直接 prepend
            container.insertBefore(item, container.firstChild);
        }
    });
}

/**
 * 获取联系人在线状态
 */
function getContactOnlineStatus(contactId) {
    // 先尝试从缓存获取
    if (_chatsStatusMap.has(contactId)) {
        return _chatsStatusMap.get(contactId);
    }

    // 尝试从 window.__socialProfile 获取
    const socialProfile = window.__socialProfile;
    if (socialProfile?.getContactOnlineStatusSync) {
        const result = socialProfile.getContactOnlineStatusSync(contactId);
        _chatsStatusMap.set(contactId, result.isOnline);
        return result.isOnline;
    }

    // 默认在线
    return true;
}

// 默认聊天数据（仅在 sdk.chatContacts 完全没数据时兜底）
// 注意：v0.23 之后所有联系人都是「独立副本」存放在 chatContacts 表
const DEMO_CHATS_FALLBACK = [
    {
        id: 'demo-1',
        type: 'ai',
        aiPersonId: 'ai-1',
        displayName: '小美（示例）',
        lastMessage: { content: '今天天气真好呀~', timestamp: Date.now() - 300000 },
        unreadCount: 2,
        isPinned: true,
        status: 'online',
    },
];

// 头像颜色数组
const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F8B500', '#6C5CE7', '#A29BFE'];

function getAvatarColor(id) {
    let index = 0;
    for (let i = 0; i < id.length; i++) {
        index += id.charCodeAt(i);
    }
    return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

/**
 * 渲染群聊头像 (2x2 网格拼接)
 * 与 chat-group-page.js 的 renderGroupAvatar 保持一致
 */
function renderGroupListAvatar(members, size = 44) {
    const gridSize = Math.min(members.length, 4);
    const gap = 1;

    let cellsHtml = '';
    for (let i = 0; i < 4; i++) {
        if (i < gridSize) {
            const member = members[i];
            const char = member.name?.charAt(0) || '?';
            const bg = member.avatarBg || getAvatarColor(member.id || member.name || i);
            const fontSize = Math.round(size * 0.28);
            cellsHtml += `<div style="background:${bg};display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;color:white;font-weight:500;">${escapeHtml(char)}</div>`;
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

function formatTime(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function renderChatItem(item, index) {
    // ★ v0.23 contact 是 chatContacts 里的独立副本
    //   - aiPersonId  → 绑定的 AI 人设
    //   - id (item.id) → 联系人副本 id（不是 ai id）
    //   - recordMode  → 'calendar' / 'story'
    const isGroup = item.type === 'group';
    const isPinned = item.isPinned;
    // ★ v0.31 实时读 aiPerson.socialProfiles.chat.*(网名/头像/背景),
    //   故事模式和日历模式都用同一个 aiPerson 数据。备注仍 per-mode 优先。
    const display = !isGroup ? resolveContactDisplay(item, item.aiPersonId || item.id) : null;
    const bgColor = (display?.avatarBg) || getAvatarColor(item.id);
    // ★ v0.31 联系人名字优先显示备注(每个 mode 独立备注),
    //   否则走 aiPerson.socialProfiles.chat.nickname(实时)
    const displayName = display?.nickname || item.displayName || item.name || item.id;

    // 消息预览
    let preview = '开始聊天吧~';
    let previewClass = 'chat-preview-default';
    if (item.lastMessage) {
        const msg = item.lastMessage;
        if (msg.type === 'sticker') preview = '[表情]';
        else if (msg.type === 'image') preview = '[图片]';
        else if (msg.type === 'voice') preview = '[语音]';
        else if (msg.content) {
            preview = escapeHtml(msg.content.substring(0, 25));
            previewClass = 'chat-preview-text';
        }
    }

    const timeText = item.lastMessage ? formatTime(item.lastMessage.timestamp) : '';
    const unreadCount = item.unreadCount || 0;
    const unreadDisplay = unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : '';

    // 动态 class
    const currentMode = getChatRecordMode();
    const itemClass = [
        'chat-item',
        `chat-${currentMode}`,
        isGroup ? 'chat-item--group' : '',
        isPinned ? 'chat-item--pinned' : '',
    ].filter(Boolean).join(' ');

    // 置顶图标
    const pinIcon = isPinned
        ? `<svg class="chat-pin-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z"/>
           </svg>`
        : '';

    // 在线状态 - 从配置读取
    const onlineStatus = !isGroup ? getContactOnlineStatus(item.id) : false;
    const onlineDot = !isGroup && onlineStatus
        ? `<div class="chat-online-dot"></div>`
        : '';

    // 未读角标
    const unreadBadge = unreadCount > 0
        ? `<div class="chat-unread-badge">${unreadDisplay}</div>`
        : '';

    // 点击进入私聊详情页
    // ★ v0.28:带上当前 mode 后缀,settings 页才知道在哪个模式下操作
    const detailPageId = isGroup ? `group-${item.id}` : `private-${item.aiPersonId || item.id}-${currentMode}`;
    const detailAction = createDetailAction(detailPageId, 'chat');
    const actionAttr = createActionAttr(detailAction, 'chat');

    // 头像
    let avatarHtml;
    if (isGroup) {
        // 群聊:使用 2x2 网格头像
        const groupMembers = item.members || [];
        const avatarMembers = groupMembers.map((id, i) => ({
            id,
            name: id.replace('ai-', '小').replace(/(\d+)/, (n) => '零一二三四五六七八九'[parseInt(n)] || n),
            avatarBg: getAvatarColor(id)
        }));
        avatarHtml = renderGroupListAvatar(avatarMembers, 52);
    } else {
        // 私聊:使用圆形头像
        const aiAvatarUrl = display?.avatar || '';
        const avatarInner = aiAvatarUrl
            ? `<img src="${escapeHtml(aiAvatarUrl)}" alt="" class="chat-avatar-img" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`
            : escapeHtml((displayName || '?').charAt(0));
        avatarHtml = `
            <div class="chat-avatar" data-color="${bgColor}">
                ${avatarInner}
            </div>
        `;
    }

    return `
        <div class="${itemClass}" data-chat-id="${escapeHtml(item.id)}" ${actionAttr}>
            <div class="chat-avatar-wrap">
                ${avatarHtml}
                ${onlineDot}
                ${unreadBadge}
            </div>
            <div class="chat-content">
                <div class="chat-row">
                    <div class="chat-name-row">
                        ${pinIcon}
                        <span class="chat-name">${escapeHtml(displayName)}</span>
                        ${isGroup ? `<span class="chat-tag">${item.members.length}人</span>` : ''}
                    </div>
                    <span class="chat-time">${timeText}</span>
                </div>
                <div class="chat-row">
                    <span class="${previewClass}">${item.lastMessage?.senderName ? escapeHtml(item.lastMessage.senderName) + ': ' : ''}${preview}</span>
                </div>
            </div>
            <div class="chat-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m9 18 6-6-6-6"/>
                </svg>
            </div>
        </div>
    `;
}

function renderEmptyState() {
    return `
        <div class="chat-empty">
            <div class="chat-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
            </div>
            <div class="chat-empty-title">暂无聊天</div>
            <div class="chat-empty-sub">点击右下角按钮开始聊天</div>
        </div>
    `;
}

/**
 * v0.27 从当前默认 user 人设的 socialProfiles.chat.calendarContacts / storyContacts
 * 读取当前 mode 下的所有联系人 entry。
 * 返回 SDK 未就绪 / user 未绑世界 / 列表为空三类状态。
 * v0.33 同时加载私聊(chatFriends)和群聊(chatGroups)。
 */
function loadContactsForMode(mode) {
    const sdk = window.settingsSdk;
    const out = { chats: [], isEmptyWorld: false, isEmptySdk: false };

    if (!sdk) {
        out.isEmptySdk = true;
        return out;
    }

    const defaultUser = sdk.defaultUserCard?.getDefault?.();
    const currentUser = defaultUser || sdk.users.getActive();
    if (!currentUser?.boundWorldId) {
        out.isEmptyWorld = true;
        return out;
    }

    // 加载私聊
    const contactList = (typeof sdk.chatFriends?.list === 'function')
        ? sdk.chatFriends.list(currentUser, mode)
        : [];

    const chats = contactList.map((c) => ({
        id: c.aiPersonId,
        type: 'ai',
        aiPersonId: c.aiPersonId,
        name: c.displayName,
        remark: c.remark || '', // ★ 每个 mode 独立备注
        recordMode: mode,
        avatar: c.avatar,
        avatarBg: c.avatarBg,
        lastMessage: c.lastMessage,
        unreadCount: c.unreadCount || 0,
        isPinned: !!c.isPinned,
        lastMessageAt: c.lastMessageAt || c.updatedAt || 0,
    }));

    // ★ v0.38 加载群聊
    const groupList = (typeof sdk.chatGroups?.list === 'function')
        ? sdk.chatGroups.list(currentUser, mode)
        : [];

    const groupChats = groupList.map((g) => ({
        id: g.id,
        type: 'group',
        aiPersonId: '', // 群聊没有 aiPersonId
        name: g.name || g.id,
        remark: g.remark || '',
        recordMode: mode,
        avatar: g.avatar || '',
        avatarBg: '',
        members: g.members || [],
        lastMessage: g.lastMessage,
        unreadCount: g.unreadCount || 0,
        isPinned: !!g.isPinned,
        lastMessageAt: g.lastMessageAt || g.updatedAt || 0,
    }));

    // 合并私聊和群聊
    out.chats = [...chats, ...groupChats];

    if (out.chats.length === 0) {
        out.chats = DEMO_CHATS_FALLBACK;
    }
    return out;
}

export function renderMessagesPage(app) {
    // 绑定在线状态监听
    bindStatusListener();

    const mode = getChatRecordMode();
    const modeCfg = getModeConfig(mode);
    const { chats, isEmptyWorld, isEmptySdk } = loadContactsForMode(mode);

    // ★ v0.23 SDK 未就绪时,订阅 settings-sdk-ready 事件,SDK 一就绪就触发重画
    //   不显示「SDK 未初始化」提示(那是给开发者看的,不是给用户看的)
    if (isEmptySdk) {
        ensureSdkReadyThenRefresh(app);
    }

    const pinned = chats.filter(c => c.isPinned);
    const unpinned = chats.filter(c => !c.isPinned);
    const sorted = [...pinned, ...unpinned];

    let bodyHtml;
    if (isEmptySdk) {
        // ★ v0.23 SDK 还没 bootstrap,显示「暂无聊天」占位(同真正空状态)
        //   等 settings-sdk-ready 事件触发后,framework 重画时会自动渲染真数据
        bodyHtml = renderEmptyState();
    } else if (isEmptyWorld) {
        bodyHtml = `
            <div class="chat-empty">
                <div class="chat-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="16"/>
                    </svg>
                </div>
                <div class="chat-empty-title">尚未绑定世界观</div>
                <div class="chat-empty-sub">请先去「设置 → 人设」给默认用户卡绑定世界观，再添加联系人</div>
            </div>
        `;
    } else {
        bodyHtml = sorted.length > 0
            ? sorted.map((item, i) => renderChatItem(item, i)).join('')
            : renderEmptyState();
    }

    // 发起聊天按钮
    const newChatButton = `
        <div class="chat-new-chat-btn" id="newChatBtn" data-app-action='{"action":"appMethod","appId":"chat","method":"openNewChat"}'>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                <path d="M12 5v14M5 12h14"/>
            </svg>
        </div>
    `;

    // ★ v0.25 顶栏右侧按钮由 framework 的 headerActions 渲染(走 .app-topbar-action),
    //   不再需要 initTopbar/MutationObserver 那套 DOM 注入逻辑(之前会与 framework 的 v-html
    //   重渲染产生无限循环 → 关闭 app 时控制台死循环刷日志)。

    // ★ v0.25 当前 mode 类名挂到 .chat-messages-list-page 上（仅这一页变背景）
    return `
        <div class="chat-messages-list-page ${modeCfg.bgClass}" data-chat-mode="${escapeHtml(mode)}">
            <div class="chat-messages">
                ${bodyHtml}
            </div>
            ${newChatButton}
        </div>
    `;
}

export default renderMessagesPage;
