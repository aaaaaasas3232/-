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
import { getAiMeta, resolveAiAvatar, resolveUserAvatar, DEFAULT_AI_AVATAR_BG } from '../aiMeta.js';
import { getRunningGame, GAME_META } from '../games/index.js';

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
    // ★ v0.71 统一 AI 头像来源:走 aiMeta.resolveAiAvatar(数据源唯一)
    const av = resolveAiAvatar(aiPersonId);
    const full = getAiMeta(aiPersonId);
    if (full.exists) {
        return { ...full, avatar: av.url, avatarBg: av.bg };
    }
    // 兜底:从 group.members 找名字
    const fb = (fallbackMembers || []).find((m) => (m.id || m.aiPersonId) === aiPersonId);
    if (fb) {
        return {
            exists: false,
            nickname: fb.name || fb.displayName || aiPersonId,
            avatar: fb.avatar || av.url,
            avatarBg: fb.avatarBg || av.bg,
            background: '',
            patSetting: '',
            initial: (fb.name || fb.displayName || aiPersonId || '?').charAt(0),
        };
    }
    return {
        exists: false,
        nickname: aiPersonId,
        avatar: av.url,
        avatarBg: av.bg,
        background: '',
        patSetting: '',
        initial: (aiPersonId || '?').charAt(0),
    };
}

/**
 * 「这个群里有一局在打」的回条。
 *
 * ★ 这一条是「切出游戏界面不会断」这件事在用户侧的另一半。
 *   引擎在后台照跑没问题，但用户回到群聊时如果看不到任何痕迹，
 *   他会以为那一局已经没了 —— 得先想起来去点工具栏的「游戏」，
 *   再从大厅点「继续」，两步之后才回得去。
 *   直接在群聊顶部挂一条，一点就回对局。
 */
function renderRunningGameBar(groupId) {
    const session = getRunningGame(groupId);
    if (!session) return '';
    const meta = GAME_META[session.gameId] || {};
    const waiting = !!session.pending;
    return `
        <button type="button" class="chat-game-bar" data-tone="${escapeHtml(meta.tone || 'blue')}"
                ${waiting ? 'data-waiting="1"' : ''}
                data-app-action='{"action":"detail","appId":"chat","pageId":"game-play-${escapeHtml(groupId)}"}'>
            <span class="chat-game-bar__dot" aria-hidden="true"></span>
            <span class="chat-game-bar__text">
                <b>${escapeHtml(meta.name || '小游戏')}</b>
                ${escapeHtml(session.phaseLabel || '进行中')}
            </span>
            <span class="chat-game-bar__cta">${waiting ? '轮到你了' : '回到对局'}</span>
        </button>
    `;
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
            const bg = meta.avatarBg || DEFAULT_AI_AVATAR_BG;
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
        avatarBg: memberMeta?.avatarBg || DEFAULT_AI_AVATAR_BG,
        aiPersonId,
    }, {
        aiPersonId,
        mode: msg.mode || ctx.mode || 'calendar',
        userAvatar: ctx.userAvatar,
        userAvatarBg: ctx.userAvatarBg,
        // ★ v0.72 群聊标识:让重roll 按钮 action 知道是 group,重roll 时走对应分支
        conversationType: 'group',
        // ★ v0.85 群聊时显示"发送给AI"按钮
        showSendToAi: true,
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
        // ★ v0.85 移除群聊空消息欢迎卡片(欢迎来到群聊 / 发送第一条消息 / 群聊使用长按发送模式)
        //   - 用户反馈:不需要这种引导文案,空状态保持空白即可
        return '';
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
                avatarBg: memberMeta?.avatarBg || DEFAULT_AI_AVATAR_BG,
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
function renderGroupToolbarButton(action, label, iconSvg) {
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
 * ★ v0.85 群聊当日过滤：和私聊保持一致，只显示当天消息和当天的日期分割线
 *   - 与私聊 filterTodayMessages 同款,避免群聊显示 8.7 及更早的旧消息
 *   - 配合 sdk.chatArchive.archive 自动归档旧消息
 */
function isTodayMessage(msg) {
    if (!msg) return false;

    if (msg.timestamp) {
        const msgDate = new Date(Number(msg.timestamp));
        const today = new Date();
        return msgDate.toDateString() === today.toDateString();
    }

    if (msg.type === 'system' && msg.content) {
        const content = msg.content;
        if (content.startsWith('今天')) return true;
        if (content.startsWith('昨天')) return false;
        if (/^\d+天前/.test(content)) return false;
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

function filterTodayMessages(messages) {
    if (!Array.isArray(messages)) return [];

    const result = [];
    let seenTodayDivider = false;

    for (const msg of messages) {
        if (msg.type === 'system') {
            const content = msg.content || '';
            if (content.startsWith('今天') && !seenTodayDivider) {
                result.push(msg);
                seenTodayDivider = true;
            } else {
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
                }
            }
        } else if (isTodayMessage(msg)) {
            if (!seenTodayDivider) {
                result.push({
                    id: 'today-divider-' + Date.now(),
                    type: 'system',
                    content: '今天',
                });
                seenTodayDivider = true;
            }
            result.push(msg);
        }
    }

    return result;
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

    // ★ v0.80 移除 demo fallback — 没有真实群聊就直接空消息,不展示占位示例
    let displayMessages = realMessages || [];

    // ★ v0.85 跟私聊保持一致:只显示当天消息,隐藏 8.7 及之前的旧消息
    //   - 过滤规则复用私聊的 filterTodayMessages
    //   - 配合下方自动归档,把旧消息搬到 chatArchiveMessages
    displayMessages = filterTodayMessages(displayMessages);

    // ★ v0.85 群聊也接入自动归档:把当天以前的消息搬到 chatArchiveMessages
    //   - 跟私聊一致,fire-and-forget 不阻塞 renderPage
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
                            `群聊已归档 ${res.archivedCount} 条历史消息`,
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

    // ★ 读 user 头像(给 user 消息用)
    // ★ v0.62 读 user 头像(给 user 消息气泡用)
    // ★ v0.71 统一改成走 aiMeta.resolveUserAvatar()
    const userAv = resolveUserAvatar();
    const userAvatar = userAv.url;
    const userAvatarBg = userAv.bg;

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

    // 群昵称：渲染时现查，**覆盖**消息里存着的 senderName。
    //
    // 消息里的 senderName 是发送那一刻的快照。群昵称是「这个人在这个群里现在叫什么」，
    // 改了昵称之后整段历史都该跟着改口 —— 否则同一个人在上半屏叫本名、
    // 下半屏叫新昵称，看起来像两个人。
    const sdkForNick = window.settingsSdk;
    const nickUser = sdkForNick?.defaultUserCard?.getDefault?.() || sdkForNick?.users?.getActive?.();
    const resolveGroupNick = (memberId) => {
        if (!realGroup || !sdkForNick?.chatGroups?.getNickname) return '';
        return sdkForNick.chatGroups.getNickname(realGroup, memberId) || '';
    };

    // ★ v0.62 把消息做 normalize(补 time / senderName,跟私聊一致)
    const normalizedMessages = (displayMessages || []).map((m) => {
        if (!m) return m;
        const ts = Number(m.timestamp) || Date.now();
        const nick = resolveGroupNick(m.sender === 'user' ? (nickUser?.id || '') : (m.senderId || ''));
        let senderName = nick || m.senderName || '';
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

    // ★ v0.69 群聊工具栏 — 与私聊对齐(2 行 × 4 列,左右切换页)
    //   Page 1: 图片 / 语音 / 自定义 / 位置 / 红包 / 转账 / 通话 / 收藏
    //   Page 2: @成员 / 公告 / 成员 / 名片 / 拍一拍 / 游戏 / 留空 / 留空
    //   跟私聊完全对齐可发送的 8 种特殊消息类型,群聊独有功能在第二页
    const page1 = `
        ${renderGroupToolbarButton('image', '图片', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><polyline points="21 15 16 10 5 21"/></svg>')}
        ${renderGroupToolbarButton('voice', '语音', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>')}
        ${renderGroupToolbarButton('custom', '自定义', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11h.01"/><path d="M14 6h.01"/><path d="M18 6h.01"/><path d="M6.5 13.1h.01"/><path d="M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3"/><path d="M17.4 9.9c-.8.8-2 .8-2.8 0"/><path d="M10.1 7.1C9 7.2 7.7 7.7 6 8.6c-3.5 2-4.7 3.9-3.7 5.6 4.5 7.8 9.5 8.4 11.2 7.4.9-.5 1.9-2.1 1.9-4.7"/><path d="M9.1 16.5c.3-1.1 1.4-1.7 2.4-1.4"/></svg>')}
        ${renderGroupToolbarButton('location', '位置', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>')}
        ${renderGroupToolbarButton('redpacket', '红包', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z"/><path d="M16 10h.01"/><path d="M2 8v1a2 2 0 0 0 2 2h1"/></svg>')}
        ${renderGroupToolbarButton('transfer', '转账', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>')}
        ${renderGroupToolbarButton('call', '通话', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>')}
        ${renderGroupToolbarButton('favorite', '收藏', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>')}
    `;
    const page2 = `
        ${renderGroupToolbarButton('mention', '@成员', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/><path d="M12 14v8M8 18h8"/></svg>')}
        ${renderGroupToolbarButton('announcement', '公告', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>')}
        ${renderGroupToolbarButton('members', '成员', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>')}
        ${renderGroupToolbarButton('card', '名片', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><line x1="14" y1="10" x2="18" y2="10" stroke-linecap="round"/><line x1="14" y1="13" x2="18" y2="13" stroke-linecap="round"/></svg>')}
        ${renderGroupToolbarButton('pat', '拍一拍', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12V6a2 2 0 0 1 2-2h2v8M9 8l8 4-2 6-8-2z"/><path d="M11 8L7 4" stroke-linecap="round"/></svg>')}
        ${renderGroupToolbarButton('game', '游戏', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 6v12M7 10v4M17 10v4" stroke-linecap="round"/></svg>')}
        <div class="toolbar-btn toolbar-btn--placeholder"></div>
        <div class="toolbar-btn toolbar-btn--placeholder"></div>
    `;
    const toolbarButtons = `
        <div class="toolbar-pages">
            <div class="toolbar-page toolbar-page--active" data-page="0">
                <div class="toolbar-grid">${page1}</div>
            </div>
            <div class="toolbar-page" data-page="1">
                <div class="toolbar-grid">${page2}</div>
            </div>
        </div>
        <div class="toolbar-page-indicator">
            <span class="toolbar-dot toolbar-dot--active" data-page-target="0"></span>
            <span class="toolbar-dot" data-page-target="1"></span>
        </div>
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
                        <!-- ★ chat-header-status → chat-header-subtitle:原"长按发送触发回复"提示 -->
                        <div class="chat-header-subtitle">
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

            ${renderRunningGameBar(groupId)}

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
            <!-- ★ FIX:不要在外层再套一个 .toolbar-grid -->
            <!--   .toolbar-pages 内部每页已经自带 .toolbar-grid(4列 × 2行) -->
            <!--   外层如果再套 .toolbar-grid,会把 .toolbar-pages / .toolbar-page-indicator 拆成两个 cell -->
            <!--   → 整个分页结构被压成 4 列 grid 的第 1 个 cell,按钮全被挤扁 -->
            <!--   ★ v0.69 群聊工具栏 — 2 行 × 4 列 + 左右翻页(8 + 6 按钮分两页) -->
            <div class="input-toolbar" id="inputToolbar">
                <div class="toolbar-content">
                    ${toolbarButtons}
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
