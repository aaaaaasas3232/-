/**
 * settings-sdk · chat-app 「消息归档」(v0.61.4)
 *
 *   业务含义:私聊/群聊详情页 `.chat-messages` 只显示「当天」消息,
 *   昨天及更早的消息进入归档表(chatArchiveMessages)。
 *
 *   与 chatMessages 的关系:
 *     - chatMessages:保留「今天 0:00 及之后」的消息(私聊/群聊共用,靠 aiPersonId(=conversationId) 区分)
 *     - chatArchiveMessages:保留「今天 0:00 之前」的消息(同表,跨会话,靠 archivedDay 区分日期)
 *
 *   触发时机:
 *     - 私聊页 chat-page.js 渲染入口「自动归档当天以前的消息」(fire-and-forget)
 *     - 群聊页 chat-group-page.js 同款
 *
 *   与 storyArchives(sdkStoryArchives 表)的边界:
 *     - storyArchives 是「故事会话的整体快照封存」(用户主动按钮 → 弹窗填标题 → 一次性写入),
 *       跟 chatMessages 完全解耦,继续保留旧逻辑不动
 *     - chatArchiveMessages 是「自动按日滚动归档」(每次进入私聊/群聊页静默触发),
 *       跟 storyArchives 互不干扰
 *
 *   每条 archive 字段:
 *     id                  string      与原消息 id 一致(便于去重 + 反查)
 *     aiPersonId          string      私聊=AI人设id / 群聊=群聊id
 *     mode                'calendar' | 'story'
 *     conversationType    'private' | 'group'
 *     conversationId      string
 *     sender / senderId / senderName
 *     type / content
 *     chatRecord / replyTo / locationCard / redpacketCard / transferCard / voiceContent / voiceDuration
 *     callRecord / imageUrl / imageDescription / cardColor / textColor / url / stickerCode / thumbnail
 *     timestamp           number      原发送时间戳(不变,前端按 timestamp 排序展示)
 *     archivedAt          number      归档时间戳
 *     archivedDay         string      'YYYY-MM-DD' 归档当日(按本地时区)
 *
 *   API:
 *     list(aiPersonId, mode, options?)
 *         options: { sinceDay?, untilDay?, conversationType? }
 *     listByDate(aiPersonId, mode, day)        // 'YYYY-MM-DD'
 *     listByRange(aiPersonId, mode, startDay, endDay)
 *     count(aiPersonId, mode)
 *     archive(aiPersonId, mode, options?)      // 手动触发归档
 *         options: { now? (number), conversationType? }
 *     hydrate()                                 // 从 db 加载到 cache
 */

import { SDK_STORES } from './defaults.js';
import { createPersister, loadFromDb } from './helpers.js';

const VALID_MODES = new Set(['calendar', 'story']);
const VALID_CONVERSATION_TYPES = new Set(['private', 'group']);

/**
 * 把 timestamp 转成 'YYYY-MM-DD'(本地时区)。
 * 与 calendar-view-page.js 的 toDateKey 语义一致。
 */
function toLocalDayKey(timestamp) {
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return '';
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * 给定参考时间,算出「今天 0:00」的时间戳(本地时区)。
 */
function startOfToday(referenceTs) {
    const d = new Date(referenceTs);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/**
 * 给定 toolkit / cache 上下文,构造 chatArchive API。
 *
 * @param {object} ctx
 * @param {object} ctx.toolkit    App toolkit,提供 db.put/get/getAll/remove
 * @param {object} ctx.cache      cache.chatArchiveMessages (Map 实例)
 * @param {object} [ctx.events]   可选:event bus
 * @param {Function} [ctx.bump]   可选:scope 变更通知
 * @param {object} [ctx.chatMessages] chatMessages SDK 实例(用于 archive 时从 chatMessages 删旧)
 */
export function createChatArchiveApi({ toolkit, cache, events, bump, chatMessages }) {
    const cacheMap = cache?.chatArchiveMessages instanceof Map
        ? cache.chatArchiveMessages
        : new Map();
    if (cache && cache.chatArchiveMessages !== cacheMap) {
        cache.chatArchiveMessages = cacheMap;
    }
    const persist = createPersister(toolkit, SDK_STORES.chatArchiveMessages);

    /**
     * 命中检查:同 (aiPersonId, mode, conversationType) 的消息按 timestamp 升序过滤。
     */
    const filterByConversation = (aiPersonId, mode, conversationType) => {
        if (!aiPersonId) return [];
        const out = [];
        for (const rec of cacheMap.values()) {
            if (!rec || rec.aiPersonId !== aiPersonId) continue;
            if (mode && rec.mode !== mode) continue;
            if (conversationType && rec.conversationType !== conversationType) continue;
            out.push(rec);
        }
        return out.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    };

    /**
     * 列出某会话的归档消息
     * @param {string} aiPersonId
     * @param {'calendar'|'story'} mode
     * @param {object} [options]
     * @param {string} [options.conversationType] 'private' | 'group' — 不传则不过滤
     * @param {string} [options.sinceDay]        'YYYY-MM-DD' 起日(含)
     * @param {string} [options.untilDay]        'YYYY-MM-DD' 止日(含)
     */
    const list = (aiPersonId, mode, options = {}) => {
        if (!aiPersonId) return [];
        if (mode && !VALID_MODES.has(mode)) return [];
        const convType = options?.conversationType;
        if (convType && !VALID_CONVERSATION_TYPES.has(convType)) return [];
        const since = options?.sinceDay || '';
        const until = options?.untilDay || '';
        const list2 = filterByConversation(aiPersonId, mode, convType);
        if (!since && !until) return list2;
        return list2.filter((m) => {
            const day = m.archivedDay || toLocalDayKey(m.timestamp);
            if (since && day < since) return false;
            if (until && day > until) return false;
            return true;
        });
    };

    /**
     * 按天读取某会话当天的归档消息(YYYY-MM-DD)
     */
    const listByDate = (aiPersonId, mode, day) => {
        if (!aiPersonId || !day) return [];
        if (mode && !VALID_MODES.has(mode)) return [];
        const out = [];
        for (const rec of cacheMap.values()) {
            if (!rec || rec.aiPersonId !== aiPersonId) continue;
            if (mode && rec.mode !== mode) continue;
            const dayKey = rec.archivedDay || toLocalDayKey(rec.timestamp);
            if (dayKey !== day) continue;
            out.push(rec);
        }
        return out.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    };

    /**
     * 按日范围读取[startDay, endDay]两端都含
     */
    const listByRange = (aiPersonId, mode, startDay, endDay) => {
        if (!aiPersonId) return [];
        if (!startDay || !endDay) return [];
        const lo = startDay <= endDay ? startDay : endDay;
        const hi = startDay <= endDay ? endDay : startDay;
        const out = [];
        for (const rec of cacheMap.values()) {
            if (!rec || rec.aiPersonId !== aiPersonId) continue;
            if (mode && rec.mode !== mode) continue;
            const dayKey = rec.archivedDay || toLocalDayKey(rec.timestamp);
            if (dayKey < lo || dayKey > hi) continue;
            out.push(rec);
        }
        return out.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    };

    const count = (aiPersonId, mode) => {
        if (!aiPersonId) return 0;
        if (mode && !VALID_MODES.has(mode)) return 0;
        let n = 0;
        for (const rec of cacheMap.values()) {
            if (!rec || rec.aiPersonId !== aiPersonId) continue;
            if (mode && rec.mode !== mode) continue;
            n += 1;
        }
        return n;
    };

    /**
     * 手动触发归档:把 chatMessages 里 timestamp < todayStart 的消息搬到 chatArchiveMessages。
     *
     *  - 不依赖 chatMessages SDK 实例(传入即可),只在 cache 上读取 + 写盘;
     *    真正的删除依赖调用方在 archive() 之后对 chatMessages.cache / db 做 remove
     *  - 返回 { archivedCount, byDay: { 'YYYY-MM-DD': count } }
     *  - 调用方负责后续:window.invalidateRendererCache?.(...) + window.__appRendererBridge?.syncNow?.({ force: true })
     *
     * @param {string} aiPersonId
     * @param {'calendar'|'story'} mode
     * @param {object} [options]
     * @param {number} [options.now]                参考时间戳(默认 Date.now())
     * @param {string} [options.conversationType]   'private' | 'group' — 不传则尝试用 chatMessages 拿到
     */
    const archive = async (aiPersonId, mode, options = {}) => {
        if (!toolkit?.db) return { archivedCount: 0, byDay: {} };
        if (!aiPersonId) return { archivedCount: 0, byDay: {} };
        if (!mode || !VALID_MODES.has(mode)) return { archivedCount: 0, byDay: {} };

        const refTs = Number(options.now) || Date.now();
        const todayStart = startOfToday(refTs);
        const convType = options?.conversationType
            || chatMessages?.cache?.chatMessages?.values?.()
            ? null
            : null;

        // 取 chatMessages 的 cache,过滤属于本会话且 timestamp < todayStart 的消息
        const srcMap = chatMessages?.cache?.chatMessages;
        if (!srcMap || typeof srcMap.values !== 'function') {
            return { archivedCount: 0, byDay: {} };
        }
        const toMove = [];
        for (const rec of srcMap.values()) {
            if (!rec || rec.aiPersonId !== aiPersonId) continue;
            if (rec.mode !== mode) continue;
            if (typeof rec.timestamp !== 'number') continue;
            if (rec.timestamp >= todayStart) continue;
            // 归档到 chatArchiveMessages 后,主表里就删掉
            toMove.push(rec);
        }
        if (toMove.length === 0) return { archivedCount: 0, byDay: {} };

        const archiveTs = refTs;
        const byDay = {};
        const movedIds = [];
        for (const rec of toMove) {
            const archiveRec = {
                ...rec,
                archivedAt: archiveTs,
                archivedDay: toLocalDayKey(rec.timestamp),
            };
            cacheMap.set(rec.id, archiveRec);
            await persist(archiveRec);
            byDay[archiveRec.archivedDay] = (byDay[archiveRec.archivedDay] || 0) + 1;
            movedIds.push(rec.id);
        }

        // 从 chatMessages.cache 删除已归档的 + 调 db.remove
        for (const id of movedIds) {
            srcMap.delete(id);
            try {
                await toolkit.db.remove(SDK_STORES.chatMessages, id);
            } catch (err) {
                console.warn('[chatArchive.archive] remove from chatMessages failed', id, err);
            }
        }

        try { bump && bump('chatArchiveMessages', 'archive', { aiPersonId, mode, count: movedIds.length }); } catch (_) {}
        return { archivedCount: movedIds.length, byDay };
    };

    const hydrate = async () => {
        if (!toolkit?.db) return;
        await loadFromDb(toolkit, SDK_STORES.chatArchiveMessages, cacheMap);
    };

    return {
        list,
        listByDate,
        listByRange,
        count,
        archive,
        hydrate,
        // 暴露内部工具,calendar-view-page 需要 toLocalDayKey 复用
        _toLocalDayKey: toLocalDayKey,
        _startOfToday: startOfToday,
    };
}