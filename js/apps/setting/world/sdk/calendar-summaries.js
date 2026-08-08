/**
 * settings-sdk · chat-app 「日历概要」SDK (v0.61.3)
 *
 *   业务含义:每个 AI 人设可挂 0~N 条「日历概要」—— 由用户在「历史消息页」
 *   (chat-history-{aiPersonId}) 选日期范围生成,把一段时间内的聊天消息合并
 *   成一段概要文本,可选择性作为「回复提示词」注入到 AI system prompt。
 *
 *   数据模型:
 *     存储在 aiPerson.socialProfiles.chat.calendarSummaries[] (顶层字段路径下)
 *       - 跟 replyPrompts 平级,都是 aiPerson 顶层数组字段
 *       - mergePatch 深合并,新增字段无需新 IndexedDB 表
 *     单条结构:
 *       {
 *         id:           string     'cs-{ts}-{rand}'
 *         title:        string     概要标题(默认:「YYYY-MM-DD ~ YYYY-MM-DD 聊天概要」)
 *         dateRange:    { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 *         messageCount: number     该范围里包含的消息条数
 *         content:      string     概要正文(占位版 = 拼接前 N 条消息文本)
 *         generatedAt:  number     生成时间戳
 *         asPrompt:     { active: boolean, order: number, source: 'calendar-summary' }
 *                       — 作为 prompt 注入的开关(由 prompt-builder 读)
 *       }
 *
 *   API:
 *     list(aiPersonId)            → Array<CalendarSummary>   按 generatedAt 降序
 *     listActive(aiPersonId)      → Array<CalendarSummary>   active=true 子集,按 order
 *     get(aiPersonId, summaryId)  → CalendarSummary | null
 *     add(aiPersonId, patch)      → Promise<CalendarSummary | null>  (自动写入 aiPerson)
 *     update(aiPersonId, id, patch) → Promise<CalendarSummary | null>
 *     remove(aiPersonId, id)      → Promise<boolean>
 *     setActive(aiPersonId, id, active) → Promise<CalendarSummary | null>
 *     setOrder(aiPersonId, ids[]) → Promise<Array<CalendarSummary>>
 *     hydrate()                   → noop(数据挂在 aiPerson 顶层,跟 aiPersons 一起 hydrate)
 *
 *   设计要点:
 *     - 字段都挂在 socialProfiles.chat.calendarSummaries[],深合并友好
 *     - 复用 aiPersons.update 落盘,自动派发 events('aiPersons','update', payload)
 *     - SDK 缺失或 aiPerson 不存在时所有 API 不抛异常,返回兜底值
 *     - 占位 AI 内容:把前 N 条消息(content)拼成一个简单摘要,v0.61 不调 AI 接口
 *
 * 依赖:
 *   - sdk.aiPersons.update(aiPersonId, patch) → 写盘
 *   - 不需要 toolkit.db 直接调用
 */

const VALID_FIELDS = new Set([
    'id', 'title', 'dateRange', 'messageCount', 'content',
    'generatedAt', 'asPrompt',
    'createdAt', 'updatedAt',
]);

function _generateId() {
    return `cs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function _now() {
    return Date.now();
}

function _normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    for (const k of VALID_FIELDS) {
        if (raw[k] !== undefined) out[k] = raw[k];
    }
    out.id = String(out.id || '');
    out.title = String(out.title || '未命名概要');
    if (!out.dateRange || typeof out.dateRange !== 'object') {
        out.dateRange = { start: '', end: '' };
    } else {
        out.dateRange = {
            start: String(out.dateRange.start || ''),
            end: String(out.dateRange.end || ''),
        };
    }
    out.messageCount = Number(out.messageCount) || 0;
    out.content = String(out.content || '');
    out.generatedAt = Number(out.generatedAt) || _now();
    if (!out.asPrompt || typeof out.asPrompt !== 'object') {
        out.asPrompt = { active: false, order: 0, source: 'calendar-summary' };
    } else {
        out.asPrompt = {
            active: out.asPrompt.active !== false,
            order: Number(out.asPrompt.order) || 0,
            source: String(out.asPrompt.source || 'calendar-summary'),
        };
    }
    out.createdAt = Number(out.createdAt) || out.generatedAt;
    out.updatedAt = Number(out.updatedAt) || out.generatedAt;
    return out;
}

function _sortByOrder(list) {
    return list.slice().sort((a, b) => {
        const ao = Number(a?.asPrompt?.order) || 0;
        const bo = Number(b?.asPrompt?.order) || 0;
        return ao - bo;
    });
}

function _sortByGeneratedAt(list) {
    return list.slice().sort((a, b) => (Number(b?.generatedAt) || 0) - (Number(a?.generatedAt) || 0));
}

/**
 * 读取 aiPerson.socialProfiles.chat.calendarSummaries,自动兜底初始化为 []
 */
function _readList(person) {
    if (!person) return [];
    const chatProfile = person.socialProfiles?.chat || {};
    return Array.isArray(chatProfile.calendarSummaries) ? chatProfile.calendarSummaries : [];
}

/**
 * 给定 sdk,构造 calendarSummaries API。
 *
 * @param {object} sdk  window.settingsSdk 实例
 * @returns {object} calendarSummaries API
 */
export function createCalendarSummariesApi(sdk) {
    if (!sdk || !sdk.aiPersons) {
        console.warn('[calendarSummaries] sdk.aiPersons 缺失,API 返回空操作');
        return _emptyApi();
    }

    const _getAiPerson = (aiPersonId) => {
        if (!aiPersonId) return null;
        return sdk.aiPersons.get(aiPersonId) || null;
    };

    /**
     * 兜底初始化 aiPerson.socialProfiles.chat.calendarSummaries = []
     * (用户的旧 aiPerson 数据里没有这字段)
     */
    async function _ensureBucket(person, aiPersonId) {
        if (!person) return [];
        const chatProfile = person.socialProfiles || (person.socialProfiles = { chat: {} });
        const bucket = chatProfile.chat || (chatProfile.chat = {});
        if (!Array.isArray(bucket.calendarSummaries)) {
            bucket.calendarSummaries = [];
            try {
                await sdk.aiPersons.update(aiPersonId, { socialProfiles: person.socialProfiles });
            } catch (err) {
                console.warn('[calendarSummaries._ensureBucket] init failed', err);
            }
        }
        return bucket.calendarSummaries;
    }

    return {
        /** 读某 AI 人设全部 calendarSummaries(按 generatedAt 降序) */
        list(aiPersonId) {
            const person = _getAiPerson(aiPersonId);
            return _sortByGeneratedAt(_readList(person));
        },

        /** 仅读 active=true 子集(注入 prompt 用,按 asPrompt.order) */
        listActive(aiPersonId) {
            return this.list(aiPersonId).filter((s) => s && s.asPrompt && s.asPrompt.active !== false);
        },

        /** 读单条 */
        get(aiPersonId, summaryId) {
            const list = _readList(_getAiPerson(aiPersonId));
            return list.find((s) => s && s.id === summaryId) || null;
        },

        /**
         * 新增一条 calendarSummary。
         * 自动落盘到 aiPerson.socialProfiles.chat.calendarSummaries
         * @param {string} aiPersonId
         * @param {object} patch  至少需要 title/content;可选 dateRange/messageCount/asPrompt
         * @returns {Promise<object|null>}
         */
        async add(aiPersonId, patch = {}) {
            const person = _getAiPerson(aiPersonId);
            if (!person) {
                console.warn('[calendarSummaries.add] aiPerson 不存在:', aiPersonId);
                return null;
            }
            const bucket = await _ensureBucket(person, aiPersonId);
            const t = _now();
            const record = _normalize({
                id: patch.id || _generateId(),
                title: patch.title,
                content: patch.content || '',
                dateRange: patch.dateRange || { start: '', end: '' },
                messageCount: Number(patch.messageCount) || 0,
                generatedAt: t,
                asPrompt: patch.asPrompt || { active: false, order: 0, source: 'calendar-summary' },
                createdAt: t,
                updatedAt: t,
            });
            if (!record) return null;
            const next = bucket.concat([record]);
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), calendarSummaries: next } },
            });
            return record;
        },

        /**
         * 更新一条 calendarSummary
         * @param {string} aiPersonId
         * @param {string} summaryId
         * @param {object} patch
         * @returns {Promise<object|null>}
         */
        async update(aiPersonId, summaryId, patch = {}) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return null;
            const bucket = await _ensureBucket(person, aiPersonId);
            const idx = bucket.findIndex((s) => s && s.id === summaryId);
            if (idx < 0) return null;
            const prev = bucket[idx];
            const merged = _normalize({
                ...prev,
                ...patch,
                id: prev.id,
                generatedAt: prev.generatedAt,
                createdAt: prev.createdAt,
                updatedAt: _now(),
            });
            if (!merged) return null;
            const next = bucket.slice();
            next[idx] = merged;
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), calendarSummaries: next } },
            });
            return merged;
        },

        /**
         * 删除一条 calendarSummary
         */
        async remove(aiPersonId, summaryId) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return false;
            const bucket = await _ensureBucket(person, aiPersonId);
            const next = bucket.filter((s) => s && s.id !== summaryId);
            if (next.length === bucket.length) return false;
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), calendarSummaries: next } },
            });
            return true;
        },

        /**
         * 切换 active 状态(独立 API 方便 UI 调用)
         */
        async setActive(aiPersonId, summaryId, active) {
            const cur = this.get(aiPersonId, summaryId);
            if (!cur) return null;
            return this.update(aiPersonId, summaryId, {
                asPrompt: { ...cur.asPrompt, active: !!active },
            });
        },

        /**
         * 批量重排:按传入 summaryId 顺序写入 asPrompt.order
         */
        async setOrder(aiPersonId, summaryIdsInOrder = []) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return [];
            const bucket = await _ensureBucket(person, aiPersonId);
            const t = _now();
            const map = new Map(bucket.map((s) => [s.id, s]));
            const next = [];
            let order = 1;
            for (const sid of summaryIdsInOrder) {
                const cur = map.get(sid);
                if (!cur) continue;
                next.push({
                    ...cur,
                    asPrompt: { ...cur.asPrompt, order: order++ },
                    updatedAt: t,
                });
                map.delete(sid);
            }
            // 剩余 append 到末尾
            for (const rest of map.values()) {
                next.push({
                    ...rest,
                    asPrompt: { ...rest.asPrompt, order: order++ },
                    updatedAt: t,
                });
            }
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), calendarSummaries: next } },
            });
            return _sortByOrder(next);
        },

        /**
         * 占位 AI 生成:把 N 条消息按行拼接,末尾加占位标记
         *  - v0.61 不调真实 AI 接口
         *  - messages: [{ sender, content, timestamp }]
         *  - 返回 { title, content, messageCount, dateRange }
         */
        buildPlaceholderFromMessages(messages = [], opts = {}) {
            const list = Array.isArray(messages) ? messages : [];
            const maxLines = Number(opts.maxLines) || Math.min(50, list.length);
            const startTs = list.length > 0 ? Number(list[0].timestamp) || 0 : 0;
            const endTs = list.length > 0 ? Number(list[list.length - 1].timestamp) || 0 : 0;
            const lines = [];
            for (let i = 0; i < Math.min(maxLines, list.length); i++) {
                const m = list[i];
                const sender = m.sender === 'ai' ? 'AI' : '用户';
                const text = String(m.content || '').replace(/\s+/g, ' ').trim();
                if (!text) continue;
                const short = text.length > 120 ? text.slice(0, 120) + '…' : text;
                lines.push(`- ${sender}: ${short}`);
            }
            const content = lines.length > 0
                ? `${lines.join('\n')}\n\n[概要占位 - 待 AI 接入]`
                : '[无消息内容]';
            const title = opts.title || '聊天概要(占位)';
            const toDateKey = (ts) => {
                if (!ts) return '';
                const d = new Date(ts);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };
            return {
                title,
                content,
                messageCount: list.length,
                dateRange: { start: toDateKey(startTs), end: toDateKey(endTs) },
            };
        },

        /**
         * 预热钩子(目前 noop,数据挂在 aiPerson 顶层跟 aiPersons 一起 hydrate)
         */
        async hydrate() { /* no-op */ },
    };
}

// ============================================
// 兜底 API:sdk 缺失时返回空操作
// ============================================
function _emptyApi() {
    const _warnOnce = (() => {
        let done = false;
        return () => {
            if (done) return;
            done = true;
            console.warn('[calendarSummaries] SDK 未就绪,所有 API 返回 null/空数组');
        };
    })();
    return {
        list: () => { _warnOnce(); return []; },
        listActive: () => { _warnOnce(); return []; },
        get: () => { _warnOnce(); return null; },
        add: async () => { _warnOnce(); return null; },
        update: async () => { _warnOnce(); return null; },
        remove: async () => { return false; },
        setActive: async () => { _warnOnce(); return null; },
        setOrder: async () => { _warnOnce(); return []; },
        buildPlaceholderFromMessages: (messages = [], opts = {}) => ({
            title: opts.title || '聊天概要(占位)',
            content: '[概要占位 - 待 AI 接入]',
            messageCount: Array.isArray(messages) ? messages.length : 0,
            dateRange: { start: '', end: '' },
        }),
        hydrate: async () => {},
    };
}
