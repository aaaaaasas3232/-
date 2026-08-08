/**
 * settings-sdk · chat-app 真实消息存储 (v0.30)
 *
 *   之前私聊页 (chat-page.js) 永远读 DEMO_MESSAGES 静态数据,
 *   现在按 (aiPersonId, mode) 维度真实持久化到 listen_db.chatMessages 表。
 *
 *   v0.33 扩展群聊:每条消息加 conversationType / conversationId
 *     - private(默认):aiPersonId 字段即 conversationId
 *     - group:aiPersonId 字段写群聊 id(groupXxx),会话 id = conversationId
 *   保持向后兼容(老消息没 conversationType,默认 private)
 *
 *   每条消息字段:
 *     id              string      唯一 ID (format: msg-${ts}-${rand})
 *     aiPersonId      string      私聊=AI人设id / 群聊=群聊id
 *     mode            'calendar' | 'story'
 *     conversationType 'private' | 'group'  (v0.33+; 旧消息默认 'private')
 *     conversationId  string      同 aiPersonId(便于通用读取)
 *     sender          'user' | 'ai'
 *     senderName      string      发送者显示名
 *     senderId        string      发送者 id(私聊=user.id / 群聊=user.id 或 aiPerson.id)
 *     type            'text' | 'chat_record' | 其他(图片/语音/位置)
 *     content         string      消息正文(text 类型)
 *     chatRecord      object|null 转发消息卡片数据({ title, messages, participants, mode })
 *     replyTo         string|null 引用回复的引文
 *     timestamp       number      发送时间戳
 *     createdAt       number      落盘时间戳
 *     updatedAt       number      更新时间戳
 *
 *   API:
 *     list(user, aiPersonId, mode)                                          读某会话全部消息
 *     listSince(user, aiPersonId, mode, sinceTs)                            增量同步
 *     get(id)                                                               读单条
 *     add(user, aiPersonId, mode, msg)                                      添加
 *     update(id, patch)                                                     更新
 *     remove(id)                                                            删除
 *     removeAllForConversation(user, aiPersonId, mode, type?)               清空某会话全部消息
 *     count(user, aiPersonId, mode)                                         统计条数
 *     hydrate()                                                             从 db 加载到 cache
 *
 *   设计要点:
 *   - 私聊 / 群聊共享同一张表,以 aiPersonId (= conversationId) 区分
 *   - 不依赖 entry 是否存在(联系人副本被删后消息保留,以便恢复)
 *   - 入参 user 暂无强依赖,先保留签名与 chatFriends 对齐
 */

import { SDK_STORES } from './defaults.js';
import { createPersister, loadFromDb, mapGet, now } from './helpers.js';

const VALID_MODES = new Set(['calendar', 'story']);

function generateMessageId() {
    return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 给定 toolkit / cache 上下文,构造 chatMessages API。
 *
 * @param {object} ctx
 * @param {object} ctx.toolkit    App toolkit,提供 db.put/get/getAll/remove
 * @param {object} ctx.cache      cache.chatMessages (Map 实例)
 * @param {object} [ctx.events]   可选:event bus,用于自定义事件
 * @param {Function} [ctx.bump]   可选:scope 变更通知
 */
export function createChatMessagesApi({ toolkit, cache, events, bump }) {
    const cacheMap = cache?.chatMessages instanceof Map
        ? cache.chatMessages
        : new Map();
    if (cache && cache.chatMessages !== cacheMap) {
        cache.chatMessages = cacheMap;
    }
    const persist = createPersister(toolkit, SDK_STORES.chatMessages);

    const filterByConversation = (aiPersonId, mode, sinceTs) => {
        if (!aiPersonId) return [];
        const out = [];
        for (const rec of cacheMap.values()) {
            if (!rec || rec.aiPersonId !== aiPersonId) continue;
            if (mode && rec.mode !== mode) continue;
            if (typeof sinceTs === 'number' && rec.timestamp <= sinceTs) continue;
            out.push(rec);
        }
        return out.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    };

    // ============================
    // 公开 API
    // ============================

    /**
     * 列出某会话全部消息
     * @param {object} user 暂未使用,保留签名与 chatFriends 对齐
     * @param {string} aiPersonId
     * @param {'calendar'|'story'} mode
     */
    const list = (user, aiPersonId, mode) => {
        if (!aiPersonId) return [];
        if (mode && !VALID_MODES.has(mode)) return [];
        const results = filterByConversation(aiPersonId, mode);
        return results;
    };

    /**
     * 增量拉取(用于刷新 / 续接)
     */
    const listSince = (user, aiPersonId, mode, sinceTs) => {
        if (!aiPersonId) return [];
        if (mode && !VALID_MODES.has(mode)) return [];
        return filterByConversation(aiPersonId, mode, sinceTs);
    };

    const get = (id) => mapGet(cacheMap, id);

    /**
     * 写入一条消息(自动补 id / createdAt / updatedAt)
     * @returns {Promise<{...}>}
     */
    const add = async (user, aiPersonId, mode, msg = {}) => {
        if (!toolkit?.db) {
            console.warn('[chatMessages.add] toolkit.db is null, cannot save');
            return null;
        }
        if (!aiPersonId) {
            console.warn('[chatMessages.add] aiPersonId is null');
            return null;
        }
        if (mode && !VALID_MODES.has(mode)) {
            console.warn('[chatMessages.add] invalid mode:', mode);
            return null;
        }
        const t = now();
        const convType = msg.conversationType === 'group' ? 'group' : 'private';
        // ★ v0.45:保留所有扩展字段(locationCard/redpacketCard/transferCard/voiceContent/voiceDuration/imageDescription/cardColor/textColor等)
        // ★ v0.49.1:加 url/stickerCode/thumbnail 等 sticker / image 消息字段
        // ★ v0.49.1 透传未知字段:防止以后新加消息类型又漏字段
        const RESERVED = new Set([
            'id', 'conversationType', 'conversationId', 'sender', 'senderId', 'senderName',
            'type', 'content', 'chatRecord', 'replyTo', 'locationCard', 'redpacketCard',
            'transferCard', 'voiceContent', 'voiceDuration', 'duration', 'imageDescription',
            'cardColor', 'textColor', 'callRecord', 'url', 'imageUrl', 'stickerCode',
            'thumbnail', 'metadata', 'timestamp',
        ]);
        const passthrough = {};
        for (const k of Object.keys(msg)) {
            if (!RESERVED.has(k)) passthrough[k] = msg[k];
        }
        const record = {
            id: msg.id || generateMessageId(),
            aiPersonId,
            mode: mode || 'calendar',
            conversationType: convType,
            conversationId: msg.conversationId || aiPersonId,
            sender: msg.sender === 'ai' ? 'ai' : 'user',
            senderId: msg.senderId || '',
            senderName: msg.senderName || '',
            type: msg.type || 'text',
            content: typeof msg.content === 'string' ? msg.content : '',
            // ★ v0.45 扩展字段:全部透传
            chatRecord: msg.chatRecord || null,
            replyTo: msg.replyTo || null,
            locationCard: msg.locationCard || null,
            redpacketCard: msg.redpacketCard || null,
            transferCard: msg.transferCard || null,
            voiceContent: msg.voiceContent || '',
            voiceDuration: msg.voiceDuration || null,
            duration: msg.duration || null,
            imageDescription: msg.imageDescription || '',
            cardColor: msg.cardColor || '',
            textColor: msg.textColor || '',
            callRecord: msg.callRecord || null,
            // ★ v0.49.1 sticker / image 消息字段(原代码漏了这几个,导致 sticker 渲染 src='')
            url: typeof msg.url === 'string' ? msg.url : '',
            imageUrl: typeof msg.imageUrl === 'string' ? msg.imageUrl : '',
            stickerCode: msg.stickerCode || '',
            thumbnail: typeof msg.thumbnail === 'string' ? msg.thumbnail : '',
            metadata: (msg.metadata && typeof msg.metadata === 'object') ? msg.metadata : null,
            // ★ v0.49.1 透传其他白名单外的字段(保险:防止以后新增类型又漏字段)
            ...passthrough,
            timestamp: Number(msg.timestamp) || t,
            createdAt: t,
            updatedAt: t,
        };
        console.log('[chatMessages.add] Saving record:', JSON.stringify(record));
        console.log('[chatMessages.add] BEFORE set, cacheMap size=', cacheMap.size, 'this cacheMap===', cacheMap);
        cacheMap.set(record.id, record);
        console.log('[chatMessages.add] AFTER set, cacheMap size=', cacheMap.size, 'aiPersonId=', aiPersonId, 'mode=', mode);
        await persist(record);
        console.log('[chatMessages.add] AFTER persist, cacheMap size=', cacheMap.size, 'has id?', cacheMap.has(record.id));
        try { bump && bump('chatMessages', 'add', record); } catch (_) {}
        return record;
    };

    const update = async (id, patch = {}) => {
        if (!toolkit?.db) return null;
        const existing = mapGet(cacheMap, id);
        if (!existing) return null;
        const next = {
            ...existing,
            ...patch,
            id: existing.id,
            aiPersonId: existing.aiPersonId,
            mode: existing.mode,
            updatedAt: now(),
        };
        cacheMap.set(id, next);
        await persist(next);
        try { bump && bump('chatMessages', 'update', next); } catch (_) {}
        return next;
    };

    const remove = async (id) => {
        if (!toolkit?.db) return false;
        const existing = mapGet(cacheMap, id);
        if (!existing) return false;
        cacheMap.delete(id);
        await toolkit.db.remove(SDK_STORES.chatMessages, id);
        try { bump && bump('chatMessages', 'remove', { id }); } catch (_) {}
        return true;
    };

    /**
     * 清空某会话全部消息
     */
    const removeAllForConversation = async (user, aiPersonId, mode) => {
        if (!toolkit?.db) return 0;
        if (!aiPersonId) return 0;
        if (mode && !VALID_MODES.has(mode)) return 0;
        const toDelete = filterByConversation(aiPersonId, mode);
        for (const rec of toDelete) {
            cacheMap.delete(rec.id);
            await toolkit.db.remove(SDK_STORES.chatMessages, rec.id);
        }
        try { bump && bump('chatMessages', 'clear', { aiPersonId, mode, count: toDelete.length }); } catch (_) {}
        return toDelete.length;
    };

    const count = (user, aiPersonId, mode) => {
        if (!aiPersonId) return 0;
        if (mode && !VALID_MODES.has(mode)) return 0;
        return filterByConversation(aiPersonId, mode).length;
    };

    const hydrate = async () => {
        if (!toolkit?.db) return;
        const before = cacheMap.size;
        await loadFromDb(toolkit, SDK_STORES.chatMessages, cacheMap);
        console.log(`[chatMessages.hydrate] before=${before} after=${cacheMap.size}`, new Error('').stack.split('\n').slice(1,4).join(' | '));
    };

    return {
        list,
        listSince,
        get,
        add,
        update,
        remove,
        removeAllForConversation,
        count,
        hydrate,
    };
}
