/**
 * settings-sdk · chat-app 「故事概要」SDK (v0.61.3)
 *
 *   业务含义:每个 AI 人设可挂 0~N 条「故事概要」—— 由用户在「故事存档页」
 *   (story-archive-{aiPersonId}) 点「故事概要」按钮生成,把整个故事的聊天
 *   记录合并成一段概要文本,可选择性作为「回复提示词」注入。
 *
 *   数据模型:
 *     存储在 aiPerson.socialProfiles.chat.storySummaries[]
 *     单条结构:
 *       {
 *         id:           string     'ss-{ts}-{rand}'
 *         storyId:      string     关联的 storyArchive id(可选;空 = 当前故事会话)
 *         title:        string     故事概要标题
 *         content:      string     概要正文
 *         messageCount: number     包含的消息条数
 *         generatedAt:  number
 *         asPrompt:     { active: boolean, order: number, source: 'story-summary' }
 *       }
 *
 *   API:
 *     list(aiPersonId)
 *     listActive(aiPersonId)
 *     get(aiPersonId, summaryId)
 *     add(aiPersonId, patch)          Promise<StorySummary | null>
 *     update(aiPersonId, id, patch)   Promise<StorySummary | null>
 *     remove(aiPersonId, id)          Promise<boolean>
 *     setActive(aiPersonId, id, active) Promise<StorySummary | null>
 *     setOrder(aiPersonId, ids[])     Promise<Array<StorySummary>>
 *     buildPlaceholderFromMessages(messages, opts)  返回占位 { title, content, messageCount }
 *     hydrate()                       noop
 *
 * 依赖:
 *   - sdk.aiPersons.update(aiPersonId, patch)
 */

const VALID_FIELDS = new Set([
    'id', 'storyId', 'title', 'content', 'messageCount',
    'generatedAt', 'asPrompt',
    'createdAt', 'updatedAt',
]);

function _generateId() {
    return `ss-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
    out.storyId = String(out.storyId || '');
    out.title = String(out.title || '未命名概要');
    out.content = String(out.content || '');
    out.messageCount = Number(out.messageCount) || 0;
    out.generatedAt = Number(out.generatedAt) || _now();
    if (!out.asPrompt || typeof out.asPrompt !== 'object') {
        out.asPrompt = { active: false, order: 0, source: 'story-summary' };
    } else {
        out.asPrompt = {
            active: out.asPrompt.active !== false,
            order: Number(out.asPrompt.order) || 0,
            source: String(out.asPrompt.source || 'story-summary'),
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

function _readList(person) {
    if (!person) return [];
    const chatProfile = person.socialProfiles?.chat || {};
    return Array.isArray(chatProfile.storySummaries) ? chatProfile.storySummaries : [];
}

/**
 * 给定 sdk,构造 storySummaries API。
 *
 * @param {object} sdk  window.settingsSdk 实例
 * @returns {object} storySummaries API
 */
export function createStorySummariesApi(sdk) {
    if (!sdk || !sdk.aiPersons) {
        console.warn('[storySummaries] sdk.aiPersons 缺失,API 返回空操作');
        return _emptyApi();
    }

    const _getAiPerson = (aiPersonId) => {
        if (!aiPersonId) return null;
        return sdk.aiPersons.get(aiPersonId) || null;
    };

    async function _ensureBucket(person, aiPersonId) {
        if (!person) return [];
        const chatProfile = person.socialProfiles || (person.socialProfiles = { chat: {} });
        const bucket = chatProfile.chat || (chatProfile.chat = {});
        if (!Array.isArray(bucket.storySummaries)) {
            bucket.storySummaries = [];
            try {
                await sdk.aiPersons.update(aiPersonId, { socialProfiles: person.socialProfiles });
            } catch (err) {
                console.warn('[storySummaries._ensureBucket] init failed', err);
            }
        }
        return bucket.storySummaries;
    }

    return {
        list(aiPersonId) {
            const person = _getAiPerson(aiPersonId);
            return _sortByGeneratedAt(_readList(person));
        },

        listActive(aiPersonId) {
            return this.list(aiPersonId).filter((s) => s && s.asPrompt && s.asPrompt.active !== false);
        },

        get(aiPersonId, summaryId) {
            const list = _readList(_getAiPerson(aiPersonId));
            return list.find((s) => s && s.id === summaryId) || null;
        },

        async add(aiPersonId, patch = {}) {
            const person = _getAiPerson(aiPersonId);
            if (!person) {
                console.warn('[storySummaries.add] aiPerson 不存在:', aiPersonId);
                return null;
            }
            const bucket = await _ensureBucket(person, aiPersonId);
            const t = _now();
            const record = _normalize({
                id: patch.id || _generateId(),
                storyId: patch.storyId || '',
                title: patch.title,
                content: patch.content || '',
                messageCount: Number(patch.messageCount) || 0,
                generatedAt: t,
                asPrompt: patch.asPrompt || { active: false, order: 0, source: 'story-summary' },
                createdAt: t,
                updatedAt: t,
            });
            if (!record) return null;
            const next = bucket.concat([record]);
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), storySummaries: next } },
            });
            return record;
        },

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
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), storySummaries: next } },
            });
            return merged;
        },

        async remove(aiPersonId, summaryId) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return false;
            const bucket = await _ensureBucket(person, aiPersonId);
            const next = bucket.filter((s) => s && s.id !== summaryId);
            if (next.length === bucket.length) return false;
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), storySummaries: next } },
            });
            return true;
        },

        async setActive(aiPersonId, summaryId, active) {
            const cur = this.get(aiPersonId, summaryId);
            if (!cur) return null;
            return this.update(aiPersonId, summaryId, {
                asPrompt: { ...cur.asPrompt, active: !!active },
            });
        },

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
            for (const rest of map.values()) {
                next.push({
                    ...rest,
                    asPrompt: { ...rest.asPrompt, order: order++ },
                    updatedAt: t,
                });
            }
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), storySummaries: next } },
            });
            return _sortByOrder(next);
        },

        /**
         * 占位 AI 生成:把故事会话全部消息按行拼接 + 占位标记
         */
        buildPlaceholderFromMessages(messages = [], opts = {}) {
            const list = Array.isArray(messages) ? messages : [];
            const maxLines = Number(opts.maxLines) || Math.min(80, list.length);
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
                ? `${lines.join('\n')}\n\n[故事概要占位 - 待 AI 接入]`
                : '[无消息内容]';
            return {
                title: opts.title || '故事概要(占位)',
                content,
                messageCount: list.length,
            };
        },

        async hydrate() { /* no-op */ },
    };
}

function _emptyApi() {
    const _warnOnce = (() => {
        let done = false;
        return () => {
            if (done) return;
            done = true;
            console.warn('[storySummaries] SDK 未就绪,所有 API 返回 null/空数组');
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
            title: opts.title || '故事概要(占位)',
            content: '[故事概要占位 - 待 AI 接入]',
            messageCount: Array.isArray(messages) ? messages.length : 0,
        }),
        hydrate: async () => {},
    };
}
