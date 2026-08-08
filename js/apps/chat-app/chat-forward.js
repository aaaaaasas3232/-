/**
 * chat-app / 转发消息（v0.33）
 *
 * 业务：
 *   - 单条消息 / 多条消息被选中 → 弹「转发目标」弹窗
 *   - 目标范围 = 当前会话 mode (calendar/story) 下的所有「私聊」 + 「群聊」
 *   - 私聊 / 群聊可互通转发
 *   - 不同 mode 不互通(calendar 只能转发到 calendar 的会话,story 同理)
 *
 * 数据流：
 *   1. 调用 `openForwardTargetSelection({ mode, messageIds, sourceMessages, sourceMeta })`
 *      - messageIds: 被选消息 id 列表
 *      - sourceMessages: 消息对象列表(从当前会话渲染时的 raw messages 中筛选)
 *      - sourceMeta: { conversationType, conversationId, conversationName, participants }
 *   2. 内部组装 chatRecord 字段,弹 ForwardTargetModal
 *   3. 用户选目标 → 调 sdk.chatMessages.add 添加 type='chat_record' 消息
 *   4. 同步更新目标会话的 lastMessage(by sdk.chatFriends / chatGroups)
 */

import { escapeHtml } from '@/src/core/escape.js';
import { chatModalManager } from './components/chat-modal-registry.js';

/**
 * 合并多条消息 → 单条 chat_record 消息
 * 字段:
 *   messages          全部消息(用于展开)
 *   participants      参与人(senderName + senderId)
 *   sourceConversationType/Id/Name  来源会话信息
 *   totalCount        原始条数
 */
function buildChatRecord({ messageIds, sourceMessages, sourceMeta }) {
    const lookup = new Map(sourceMessages.map((m) => [m.id, m]));
    const ordered = messageIds.map((id) => lookup.get(id)).filter(Boolean);
    const participants = [];
    const seen = new Set();
    for (const m of ordered) {
        const key = `${m.sender}:${m.senderId || m.senderName || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        participants.push({
            sender: m.sender,
            senderId: m.senderId || '',
            senderName: m.senderName || (m.sender === 'user' ? '我' : 'AI'),
        });
    }
    return {
        title: '聊天记录',
        mode: sourceMeta?.mode || 'calendar',
        sourceConversationType: sourceMeta?.conversationType || 'private',
        sourceConversationId: sourceMeta?.conversationId || '',
        sourceConversationName: sourceMeta?.conversationName || '',
        participants,
        messages: ordered.map((m) => ({
            sender: m.sender,
            senderId: m.senderId || '',
            senderName: m.senderName || (m.sender === 'user' ? '我' : 'AI'),
            type: m.type || 'text',
            content: m.content || '',
            timestamp: m.timestamp || Date.now(),
        })),
        totalCount: ordered.length,
        createdAt: Date.now(),
    };
}

/**
 * 收集目标会话列表(供 ForwardTargetModal 渲染)
 *   - 当前 mode 下的所有私聊(sdk.chatFriends.list)
 *   - 当前 mode 下的所有群聊(sdk.chatGroups.list)
 *   - 排除当前会话本身(转发给自己通常没意义)
 *
 * @param {Object} sdk
 * @param {Object} user
 * @param {string} mode 'calendar' | 'story'
 * @param {Object} sourceMeta { conversationType, conversationId }
 * @returns { { privateChats: Array, groupChats: Array } }
 */
function collectForwardTargets(sdk, user, mode, sourceMeta) {
    const privateChats = [];
    const groupChats = [];

    if (!sdk || !user) return { privateChats, groupChats };

    // 私聊 = chatFriends.list(user, mode)
    try {
        const friendList = sdk.chatFriends?.list?.(user, mode) || [];
        for (const entry of friendList) {
            // 跳过当前消息所在的会话
            if (sourceMeta?.conversationType === 'private' &&
                entry.aiPersonId === sourceMeta.conversationId) continue;
            const ai = sdk.aiPersons?.get?.(entry.aiPersonId);
            const chatProfile = ai?.socialProfiles?.chat || {};
            const name = entry.remark || chatProfile.nickname || ai?.name || entry.aiPersonId;
            privateChats.push({
                id: entry.aiPersonId,
                name,
                avatar: chatProfile.avatar || ai?.avatar || '',
                avatarBg: entry.avatarBg || chatProfile.avatarBg || ai?.avatarBg || '#A8C8EC',
                subtitle: entry.lastMessage?.content ? truncate(entry.lastMessage.content, 24) : '',
            });
        }
    } catch (err) {
        console.warn('[chat-forward] collect private chats failed', err);
    }

    // 群聊 = chatGroups.list(user, mode)
    try {
        const groupList = sdk.chatGroups?.list?.(user, mode) || [];
        for (const g of groupList) {
            if (sourceMeta?.conversationType === 'group' && g.id === sourceMeta.conversationId) continue;
            groupChats.push({
                id: g.id,
                name: g.name || '群聊',
                members: g.members || [],
                avatar: g.avatar || '',
            });
        }
    } catch (err) {
        console.warn('[chat-forward] collect group chats failed', err);
    }

    return { privateChats, groupChats };
}

function truncate(text, max) {
    if (!text) return '';
    if (text.length <= max) return text;
    return text.slice(0, max) + '…';
}

/**
 * 写入一条 chat_record 消息到目标会话
 * @param {Object} sdk
 * @param {Object} user
 * @param {Object} target { type: 'private'|'group', id }
 * @param {string} mode
 * @param {Object} chatRecord
 * @returns {Promise<boolean>}
 */
async function dispatchForwardToTarget(sdk, user, target, mode, chatRecord) {
    if (!sdk?.chatMessages?.add) return false;
    const conversationId = target.id;
    const conversationType = target.type; // 'private' | 'group'
    const isUser = true; // 用户转发的消息一定是 user 发出
    const senderId = user?.id || '';
    const senderName = user?.socialProfiles?.chat?.nickname || user?.name || '我';

    const lastMsgSummary = chatRecord.messages.length === 1
        ? (chatRecord.messages[0].content || `[${chatRecord.messages[0].type}]`)
        : `[聊天记录] ${chatRecord.messages.length} 条消息`;

    try {
        await sdk.chatMessages.add(user, conversationId, mode, {
            sender: 'user',
            senderId,
            senderName,
            type: 'chat_record',
            content: '',
            chatRecord,
            conversationType,
            conversationId,
            timestamp: Date.now(),
        });
    } catch (err) {
        console.error('[chat-forward] write chatMessages failed', err);
        return false;
    }

    // 同步更新 lastMessage
    try {
        if (conversationType === 'private') {
            await sdk.chatFriends?.updateLastMessage?.(sdk, user, conversationId, mode, {
                content: lastMsgSummary,
                type: 'chat_record',
                senderName,
                timestamp: Date.now(),
            });
        } else if (conversationType === 'group') {
            await sdk.chatGroups?.updateLastMessage?.(sdk, user, conversationId, mode, {
                content: lastMsgSummary,
                type: 'chat_record',
                senderName,
                timestamp: Date.now(),
            });
        }
    } catch (err) {
        console.warn('[chat-forward] update lastMessage failed', err);
    }

    return true;
}

/**
 * 主动入口:被多个 UI 入口(单条 / 多选)调用
 * @param {Object} opts
 *   @prop {string} opts.mode                                    当前消息的模式
 *   @prop {string[]} opts.messageIds                            被选中的消息 id
 *   @prop {Array}  opts.sourceMessages                          原始消息列表(用于按 id 反查内容)
 *   @prop {Object} opts.sourceMeta                              { conversationType, conversationId, conversationName }
 *   @prop {Object} [opts.app]                                   app 实例(用于读 toolkit.island)
 *   @returns {Promise<{ success: boolean, targets?: number }>}
 */
export async function openForwardTargetSelection(opts = {}) {
    const mode = opts.mode === 'story' ? 'story' : 'calendar';
    const messageIds = Array.isArray(opts.messageIds) ? opts.messageIds.filter(Boolean) : [];
    const sourceMessages = Array.isArray(opts.sourceMessages) ? opts.sourceMessages : [];
    const sourceMeta = opts.sourceMeta || {};

    if (messageIds.length === 0) {
        if (typeof window !== 'undefined') {
            window.__phoneIsland?.notify?.('info', '请先选择消息', '点击消息左侧的圆圈进行选择');
        }
        return { success: false };
    }

    // 收集当前 mode 下的所有可转发目标
    const sdk = window.settingsSdk;
    const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
    if (!sdk || !user) {
        if (typeof window !== 'undefined') {
            window.__phoneIsland?.notify?.('error', 'SDK 未就绪', '请稍后再试');
        }
        return { success: false };
    }

    const targets = collectForwardTargets(sdk, user, mode, sourceMeta);
    if (targets.privateChats.length === 0 && targets.groupChats.length === 0) {
        if (typeof window !== 'undefined') {
            window.__phoneIsland?.notify?.(
                'info',
                '暂无可转发的会话',
                `当前模式(${mode === 'story' ? '故事' : '日历'})下还没有其他好友或群聊`
            );
        }
        return { success: false };
    }

    // 预构建 chatRecord(用户选目标后直接复用)
    const chatRecord = buildChatRecord({ messageIds, sourceMessages, sourceMeta });

    return new Promise((resolve) => {
        chatModalManager.openForwardTarget({
            mode,
            privateChats: targets.privateChats,
            groupChats: targets.groupChats,
            onSelect: async (sel) => {
                const ok = await dispatchForwardToTarget(sdk, user, sel, mode, chatRecord);
                if (ok) {
                    const targetName = sel.target?.name || sel.id;
                    if (typeof window !== 'undefined') {
                        window.__phoneIsland?.notify?.(
                            'success',
                            '已转发',
                            `消息已发送到「${targetName}」`
                        );
                    }
                    resolve({ success: true, target: sel, count: messageIds.length });
                } else {
                    if (typeof window !== 'undefined') {
                        window.__phoneIsland?.notify?.('error', '转发失败', '请重试');
                    }
                    resolve({ success: false });
                }
            },
            onClose: () => {
                resolve({ success: false, cancelled: true });
            },
        });
    });
}

/**
 * 工具:从当前聊天页 / 群聊页 DOM 抓取「可用消息列表」,以 id → msg 形式返回。
 * 由于 renderChatPage 输出的是 v-html,业务侧不能直接 hook DOM 来重建 msg 数组,
 * 所以提供一个「在 render 时把当前 messages 挂到 DOM 元素属性」的标准做法 + 本函数读取。
 *
 * 用法:
 *   render...() {
 *     container.dataset.rawMessages = JSON.stringify(currentMessages);
 *     // ...
 *   }
 *
 *   const sourceMessages = readMessagesFromContainer(container);
 *
 * @param {HTMLElement} container
 * @returns {Array}
 */
export function readMessagesFromContainer(container) {
    if (!container) return [];
    try {
        const raw = container.dataset?.rawMessages;
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}
