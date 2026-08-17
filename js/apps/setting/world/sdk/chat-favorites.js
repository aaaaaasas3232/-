/**
 * settings-sdk · chat-app 「单条收藏」(v0.43 2026-08-07)
 *
 *   业务含义:用户在私聊/群聊里点某条消息的「收藏」按钮,
 *   把这条消息的快照持久化到 sdkChatFavorites 表。
 *   跟「对话片段收藏」(type='conversation' 走 window.__chatDemoFavorites 内存 demo)不同,
 *   单条收藏是真的写盘,刷新页面后仍能看到。
 *
 *   id 约定 (id 是 keyPath,必须稳定):
 *     fav-${userId}-${aiPersonId}-${mode}-${messageId}
 *     例: fav-user0-ai0-calendar-msg-xxx
 *
 *   同一个 user 在同一个会话的同一条消息只能收藏一次 (id 唯一约束);
 *   重复点收藏 → no-op 返回已存在 entry。
 *
 *   字段(只存「展示所需」的快照):
 *     id              string      keyPath
 *     userId          string
 *     aiPersonId      string      私聊=AI人设id / 群聊=群聊id
 *     mode            'calendar' | 'story'
 *     sourceType      'private' | 'group'
 *     conversationId  string
 *     messageId       string
 *     type            string      text / image / location / voice_call / video_call / game / chat_record ...
 *     sender          'user' | 'ai' | 'system'
 *     senderName      string
 *     content         string
 *     // image 类
 *     imageDescription  string
 *     imagePreview      string
 *     cardColor         string
 *     textColor         string
 *     // location 类
 *     locationName      string
 *     locationAddress   string
 *     // 通话类
 *     callType          'voice' | 'video'
 *     duration          number
 *     summary           string
 *     // game 类
 *     gameType          string
 *     gameTitle         string
 *     // chat_record (转发卡片)
 *     chatRecord        object|null
 *     // 元数据
 *     createdAt         number
 *     updatedAt         number
 *
 *   API:
 *     list(user, aiPersonId, mode?)                          按 (user, aiPersonId, mode?) 拉取
 *     get(id)                                                 单条
 *     has(user, aiPersonId, mode, messageId)                  是否已收藏
 *     add(user, aiPersonId, mode, message, options?)          新增(自动去重)
 *     remove(user, aiPersonId, mode, messageId)               删除
 *     removeById(id)                                          按收藏记录自己的 id 删（收藏页用）
 *     updateById(id, patch)                                   按 id 局部更新（收藏页「编辑」用）
 *     removeAllForConversation(user, aiPersonId, mode?)       清空某会话全部单条收藏
 *     count(user, aiPersonId, mode?)                          统计
 *     hydrate()                                                从 db 加载到 cache
 *
 *   设计要点:
 *   - 跟 chatMessages 解耦:消息被删后收藏快照还在(快照是只读)
 *   - 跟 chatFriends 解耦:好友 entry 删了,收藏仍能看
 *   - 跟 storyArchives 平行:storyArchives 存「会话整体快照」,chatFavorites 存「单条消息快照」
 */

import { SDK_STORES } from './defaults.js';
import { createPersister, loadFromDb, mapGet, now } from './helpers.js';

const VALID_MODES = new Set(['calendar', 'story']);
const VALID_SOURCE_TYPES = new Set(['private', 'group']);

/**
 * 生成单条收藏 id
 */
function buildFavoriteId(userId, aiPersonId, mode, messageId) {
    const safe = (s) => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `fav-${safe(userId)}-${safe(aiPersonId)}-${safe(mode)}-${safe(messageId)}`;
}

/**
 * 把消息对象 compact 成收藏快照字段
 */
function compactMessageForFavorite(message) {
    if (!message || typeof message !== 'object') return null;
    const type = message.type || 'text';
    const sender = message.sender === 'ai' ? 'ai' : (message.sender === 'system' ? 'system' : 'user');

    const base = {
        type,
        sender,
        senderName: message.senderName || '',
        content: typeof message.content === 'string' ? message.content : '',
    };

    if (type === 'descriptive_image' || type === 'image') {
        base.imageDescription = message.imageDescription || message.content || '';
        base.imagePreview = message.imagePreview || '';
        base.cardColor = message.cardColor || '';
        base.textColor = message.textColor || '';
    } else if (type === 'location') {
        base.locationName = message.locationCard?.name || message.locationName || message.content || '';
        base.locationAddress = message.locationCard?.address || message.locationAddress || '';
    } else if (type === 'call_record' || type === 'voice_call' || type === 'video_call') {
        const cr = message.callRecord || null;
        base.callType = cr?.callType || (type === 'video_call' ? 'video' : 'voice');
        base.duration = typeof cr?.duration === 'number' ? cr.duration : 0;
        base.summary = cr?.summary || message.summary || '';
    } else if (type === 'game') {
        base.gameType = message.gameType || '';
        base.gameTitle = message.gameTitle || message.content || '';
    } else if (type === 'chat_record') {
        base.chatRecord = message.chatRecord || null;
    } else if (type === 'moments') {
        // ★ v0.87 朋友圈收藏。收的不是聊天消息而是一条动态,
        //   所以要单独保留 momentId(点回原动态)和图片/位置(卡片要画出来)。
        base.momentId = String(message.momentId || '');
        base.momentAuthorId = String(message.momentAuthorId || '');
        base.momentIsUser = !!message.momentIsUser;
        base.momentImages = Array.isArray(message.momentImages) ? message.momentImages : [];
        base.momentAiImages = Array.isArray(message.momentAiImages) ? message.momentAiImages : [];
        base.momentLocation = String(message.momentLocation || '');
        base.momentTimestamp = Number(message.momentTimestamp) || 0;
    }

    return base;
}

/**
 * 给定 toolkit / cache 上下文,构造 chatFavorites API。
 *
 * @param {object} ctx
 * @param {object} ctx.toolkit    App toolkit,提供 db.put/get/getAll/remove
 * @param {object} ctx.cache      cache.chatFavorites (Map 实例)
 * @param {object} [ctx.events]   可选:event bus
 * @param {Function} [ctx.bump]   可选:scope 变更通知
 */
export function createChatFavoritesApi({ toolkit, cache, events, bump }) {
    const cacheMap = cache?.chatFavorites instanceof Map
        ? cache.chatFavorites
        : new Map();
    if (cache && cache.chatFavorites !== cacheMap) {
        cache.chatFavorites = cacheMap;
    }
    const persist = createPersister(toolkit, SDK_STORES.chatFavorites);

    const filterByOwner = (user, aiPersonId, mode) => {
        if (!user) return [];
        const userId = typeof user === 'string' ? user : user.id;
        if (!userId) return [];
        const out = [];
        for (const rec of cacheMap.values()) {
            if (!rec || rec.userId !== userId) continue;
            if (aiPersonId && rec.aiPersonId !== aiPersonId) continue;
            if (mode && rec.mode !== mode) continue;
            out.push(rec);
        }
        // 按 createdAt 倒序
        return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    };

    // ============================
    // 公开 API
    // ============================

    /**
     * 列出某 user 下所有单条收藏
     * @param {object|string} user
     * @param {string} [aiPersonId]   可选:只列某会话
     * @param {string} [mode]         可选:只列某模式
     */
    const list = (user, aiPersonId, mode) => {
        return filterByOwner(user, aiPersonId, mode);
    };

    const get = (id) => mapGet(cacheMap, id);

    /**
     * 是否已收藏
     */
    const has = (user, aiPersonId, mode, messageId) => {
        if (!user || !aiPersonId || !messageId) return false;
        const userId = typeof user === 'string' ? user : user.id;
        const id = buildFavoriteId(userId, aiPersonId, mode || 'calendar', messageId);
        return cacheMap.has(id);
    };

    /**
     * 新增一条收藏(已存在则返回已存在的 entry,idempotent)
     * @param {object|string} user
     * @param {string} aiPersonId
     * @param {string} mode
     * @param {object} message          原始消息对象
     * @param {object} [options]
     * @param {string} [options.sourceType]      'private' | 'group',默认 'private'
     * @param {string} [options.conversationId] 默认 = aiPersonId
     * @returns {Promise<{...}|null>}
     */
    const add = async (user, aiPersonId, mode, message, options = {}) => {
        if (!toolkit?.db) return null;
        if (!user || !aiPersonId || !message) return null;
        if (mode && !VALID_MODES.has(mode)) return null;
        const userId = typeof user === 'string' ? user : user.id;
        if (!userId) return null;
        if (!message.id) return null;

        const id = buildFavoriteId(userId, aiPersonId, mode || 'calendar', message.id);
        // 幂等:已存在直接返回
        if (cacheMap.has(id)) {
            return mapGet(cacheMap, id);
        }

        const compact = compactMessageForFavorite(message);
        if (!compact) return null;

        const sourceType = VALID_SOURCE_TYPES.has(options.sourceType) ? options.sourceType : 'private';
        const conversationId = options.conversationId || aiPersonId;

        const t = now();
        const record = {
            id,
            userId,
            aiPersonId,
            mode: mode || 'calendar',
            sourceType,
            conversationId,
            messageId: message.id,
            ...compact,
            createdAt: t,
            updatedAt: t,
        };
        cacheMap.set(id, record);
        await persist(record);
        try { bump && bump('chatFavorites', 'add', record); } catch (_) {}
        return record;
    };

    /**
     * 删除一条收藏
     */
    const remove = async (user, aiPersonId, mode, messageId) => {
        if (!toolkit?.db) return false;
        if (!user || !aiPersonId || !messageId) return false;
        const userId = typeof user === 'string' ? user : user.id;
        if (!userId) return false;
        const id = buildFavoriteId(userId, aiPersonId, mode || 'calendar', messageId);
        const existing = mapGet(cacheMap, id);
        if (!existing) return false;
        cacheMap.delete(id);
        await toolkit.db.remove(SDK_STORES.chatFavorites, id);
        try { bump && bump('chatFavorites', 'remove', { id }); } catch (_) {}
        return true;
    };

    /**
     * 按收藏记录自己的 id 删除。
     *
     * 为什么需要它：收藏页拿到的是一条**收藏记录**（它自己的 id），
     * 而不是「user + aiPersonId + mode + messageId」这四元组。
     * 让 UI 去反推那四个字段既啰嗦又容易错（mode 拼错就静默删不掉），
     * 所以直接给一个按 id 删的入口。
     */
    const removeById = async (id) => {
        if (!toolkit?.db) return false;
        const key = String(id || '');
        if (!key) return false;
        if (!cacheMap.has(key)) return false;
        cacheMap.delete(key);
        await toolkit.db.remove(SDK_STORES.chatFavorites, key);
        try { bump && bump('chatFavorites', 'remove', { id: key }); } catch (_) {}
        return true;
    };

    /**
     * 按 id 局部更新一条收藏（目前用于收藏页的「编辑」）。
     *
     * 只允许改「用户自己写的那些字段」—— id / userId / messageId / createdAt
     * 这些是身份和溯源信息，改了会让这条收藏跟原消息对不上。
     */
    const ALLOWED_PATCH_KEYS = new Set([
        'content', 'summary', 'senderName',
        'locationName', 'locationAddress',
        'imageDescription', 'gameTitle', 'note',
    ]);

    const updateById = async (id, patch = {}) => {
        if (!toolkit?.db) return null;
        const key = String(id || '');
        const existing = mapGet(cacheMap, key);
        if (!existing) return null;
        const next = { ...existing };
        let changed = false;
        for (const [k, v] of Object.entries(patch || {})) {
            if (!ALLOWED_PATCH_KEYS.has(k)) continue;
            if (next[k] === v) continue;
            next[k] = v;
            changed = true;
        }
        if (!changed) return existing;
        next.updatedAt = now();
        cacheMap.set(key, next);
        await persist(next);
        try { bump && bump('chatFavorites', 'update', next); } catch (_) {}
        return next;
    };

    /**
     * 清空某会话的全部单条收藏
     */
    const removeAllForConversation = async (user, aiPersonId, mode) => {
        if (!toolkit?.db) return 0;
        const list2 = filterByOwner(user, aiPersonId, mode);
        for (const rec of list2) {
            cacheMap.delete(rec.id);
            await toolkit.db.remove(SDK_STORES.chatFavorites, rec.id);
        }
        try { bump && bump('chatFavorites', 'clear', { count: list2.length }); } catch (_) {}
        return list2.length;
    };

    const count = (user, aiPersonId, mode) => {
        return filterByOwner(user, aiPersonId, mode).length;
    };

    const hydrate = async () => {
        if (!toolkit?.db) return;
        await loadFromDb(toolkit, SDK_STORES.chatFavorites, cacheMap);
    };

    return {
        list,
        get,
        has,
        add,
        remove,
        removeById,
        updateById,
        removeAllForConversation,
        count,
        hydrate,
        // 暴露给外部用(比如按 id 解析)
        _buildFavoriteId: buildFavoriteId,
    };
}
