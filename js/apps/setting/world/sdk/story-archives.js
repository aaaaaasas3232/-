/**
 * settings-sdk · chat-app 「故事存档」(v0.42)
 *
 *   业务含义：故事模式（mode === 'story'）下，把当前会话的完整消息快照
 *   持久化成一条「存档」。用户可在「故事存档页」查看 / 恢复 / 删除。
 *
 *   每条 archive 字段:
 *     id              string      存档 ID(archive-${ts}-${rand})
 *     userId          string      哪个 user 封存的（每 user 各自管各自的存档）
 *     aiPersonId      string      跟哪个 AI 的故事
 *     mode            'story'     固定（故事模式才有存档）
 *     name            string      封存标题
 *     description     string      封存简介
 *     messages        array       完整消息快照（每条消息存原始对象的「深拷贝浅层」字段）
 *     messageCount    number      消息条数
 *     createdAt       number      封存时间戳
 *     updatedAt       number      更新时间戳
 *
 *   API:
 *     list(user, aiPersonId)      读某 user + aiPersonId 下所有存档（按 createdAt 倒序）
 *     get(id)                     读单条
 *     add(user, aiPersonId, payload)   把当前消息快照写入存档
 *     remove(id)                  删除
 *     removeAllForUser(user)      清空某 user 全部存档
 *     count(user, aiPersonId)     统计
 *     hydrate()                   从 db 加载到 cache
 *
 *   设计要点:
 *   - 按 (userId, aiPersonId) 维度存：每个 user 各自的存档名单
 *   - 存档的消息是从 chatMessages.list 拉取的真实快照，
 *     跟 chatMessages 表解耦（即使原消息被后续操作改了/删了，存档依旧保留当时的快照）
 *   - 不与 chatFriends 耦合：chatFriends 删了 entry 也能查存档
 *   - mode 字段固定 'story'（v0.42 阶段，日历模式暂不开放存档）
 */

import { SDK_STORES } from './defaults.js';
import { createPersister, loadFromDb, mapGet, now } from './helpers.js';

const VALID_MODES = new Set(['calendar', 'story']);

function generateArchiveId() {
    return `archive-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 把真实消息列表 compact 成快照 —— 只保留必要的可展示字段，省 IndexedDB 字节。
 * - 跳过 chatRecord 内嵌消息对象（多带一份）—— 这里只取单层字段
 * - 数字 / 字符串 / 布尔 / 简单对象 都保留
 * - 不可 JSON 化的字段（function / undefined）会被 JSON.parse(JSON.stringify(...)) 干掉
 *
 * @param {Array} messages
 * @returns {Array}
 */
function compactMessagesForSnapshot(messages) {
    if (!Array.isArray(messages)) return [];
    return messages.map((m) => ({
        id: m.id || '',
        sender: m.sender === 'ai' ? 'ai' : 'user',
        senderId: m.senderId || '',
        senderName: m.senderName || '',
        type: m.type || 'text',
        content: typeof m.content === 'string' ? m.content : '',
        // chatRecord 卡片（转发消息）整段保留，便于查看时还原原转发快照
        chatRecord: m.chatRecord || null,
        // 位置 / 红包 / 转账 / 表情 等字段
        imageUrl: m.imageUrl || '',
        imageDescription: m.imageDescription || '',
        stickerUrl: m.stickerUrl || '',
        locationCard: m.locationCard || null,
        redpacketCard: m.redpacketCard || null,
        transferCard: m.transferCard || null,
        voiceUrl: m.voiceUrl || '',
        voiceDuration: typeof m.voiceDuration === 'number' ? m.voiceDuration : null,
        replyTo: m.replyTo || null,
        timestamp: typeof m.timestamp === 'number' ? m.timestamp : Date.now(),
    }));
}

/**
 * 给定 toolkit / cache 上下文，构造 storyArchives API。
 *
 * @param {object} ctx
 * @param {object} ctx.toolkit    App toolkit,提供 db.put/get/getAll/remove
 * @param {object} ctx.cache      cache.storyArchives (Map 实例)
 * @param {object} [ctx.events]   可选:event bus
 * @param {Function} [ctx.bump]   可选:scope 变更通知
 */
export function createStoryArchivesApi({ toolkit, cache, events, bump }) {
    const cacheMap = cache?.storyArchives instanceof Map
        ? cache.storyArchives
        : new Map();
    if (cache && cache.storyArchives !== cacheMap) {
        cache.storyArchives = cacheMap;
    }
    const persist = createPersister(toolkit, SDK_STORES.storyArchives);

    const filterByOwner = (user, aiPersonId) => {
        if (!user) return [];
        const out = [];
        const userId = typeof user === 'string' ? user : user.id;
        if (!userId) return [];
        for (const rec of cacheMap.values()) {
            if (!rec || rec.userId !== userId) continue;
            if (aiPersonId && rec.aiPersonId !== aiPersonId) continue;
            out.push(rec);
        }
        return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    };

    // ============================
    // 公开 API
    // ============================

    /**
     * 列出某 user + aiPersonId 下所有存档
     *   - 不传 aiPersonId 则列该 user 全部存档
     *   - 按 createdAt 倒序
     */
    const list = (user, aiPersonId) => {
        return filterByOwner(user, aiPersonId);
    };

    const get = (id) => mapGet(cacheMap, id);

    /**
     * 新增一条存档
     * @param {object} user         user 实体或 user.id
     * @param {string} aiPersonId
     * @param {object} payload
     *   - name           string  必填
     *   - description    string  可选
     *   - messages       array   必填:当前消息快照
     *   - mode           string  默认 'story'
     * @returns {Promise<{...}|null>}
     */
    const add = async (user, aiPersonId, payload = {}) => {
        if (!toolkit?.db) return null;
        const userId = typeof user === 'string' ? user : user?.id;
        if (!userId || !aiPersonId) return null;
        const name = String(payload.name || '').trim();
        if (!name) return null;
        const mode = (payload.mode === 'calendar' || payload.mode === 'story')
            ? payload.mode
            : 'story';
        if (!VALID_MODES.has(mode)) return null;
        const messages = compactMessagesForSnapshot(payload.messages || []);

        const t = now();
        const record = {
            id: payload.id || generateArchiveId(),
            userId,
            aiPersonId,
            mode,
            name,
            description: String(payload.description || '').trim(),
            messages,
            messageCount: messages.length,
            createdAt: payload.createdAt || t,
            updatedAt: t,
        };
        cacheMap.set(record.id, record);
        await persist(record);
        try { bump && bump('storyArchives', 'add', record); } catch (_) {}
        return record;
    };

    const remove = async (id) => {
        if (!toolkit?.db) return false;
        const existing = mapGet(cacheMap, id);
        if (!existing) return false;
        cacheMap.delete(id);
        await toolkit.db.remove(SDK_STORES.storyArchives, id);
        try { bump && bump('storyArchives', 'remove', { id }); } catch (_) {}
        return true;
    };

    const removeAllForUser = async (user) => {
        if (!toolkit?.db) return 0;
        const userId = typeof user === 'string' ? user : user?.id;
        if (!userId) return 0;
        const toDelete = [];
        for (const rec of cacheMap.values()) {
            if (rec?.userId === userId) toDelete.push(rec);
        }
        for (const rec of toDelete) {
            cacheMap.delete(rec.id);
            await toolkit.db.remove(SDK_STORES.storyArchives, rec.id);
        }
        try { bump && bump('storyArchives', 'clear', { userId, count: toDelete.length }); } catch (_) {}
        return toDelete.length;
    };

    const count = (user, aiPersonId) => {
        return filterByOwner(user, aiPersonId).length;
    };

    const hydrate = async () => {
        if (!toolkit?.db) return;
        await loadFromDb(toolkit, SDK_STORES.storyArchives, cacheMap);
    };

    return {
        list,
        get,
        add,
        remove,
        removeAllForUser,
        count,
        hydrate,
    };
}
