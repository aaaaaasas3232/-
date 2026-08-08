/**
 * settings-sdk · chat-app 「滚动摘要 K 链」SDK (v0.61.3)
 *
 *   业务含义:为长聊天上下文做「滚动摘要」—— C 窗口(最近 N 个回合原始消息)
 *   装不下时,把最早的若干回合压缩成 K(K0/K1/K2…),挂到 K 链上,后续拼 prompt 时
 *   把 K 链内容放在 C 窗口之前注入。v0.61 占位版不调真实 AI,只拼接前 N 个回合文本。
 *
 *   K 链机制(摘自规划 §3.3):
 *     C 窗口 ──┐
 *     [回合1, 回合2, ..., 回合N]     ← contextRounds 控制大小
 *              │
 *              ▼ 满了
 *         压缩最早 kMergeSize 回合 ──▶ 生成新 K
 *                                       │
 *                                       ▼
 *                                    追加到 K 链
 *                                       │
 *                                       ▼
 *                                  K 链太长(>maxChainLength)
 *                                       │
 *                                       ▼
 *                                  合并最早的 K
 *
 *   数据模型:
 *     存储在 aiPerson.socialProfiles.chat.rollingSummaries[]
 *     单条结构(K 节点):
 *       {
 *         id:           string      'rs-{ts}-{rand}'
 *         level:        number      0=K0 / 1=K1 / 2=K2 …
 *         startMsgId:   string      K 链包含的起始消息 id(对应 chatMessages.id)
 *         endMsgId:     string      K 链包含的结束消息 id
 *         messageCount: number      K 包含的消息条数
 *         content:      string      占位 = 前 N 条文本拼接 + 「[滚动摘要占位 - 待 AI 接入]」
 *         threshold:    number      C 窗口大小(contextRounds)
 *         style:        'concise' | 'detailed'
 *         generatedAt:  number
 *         asPrompt:     { active: boolean, order: number, source: 'rolling-summary' }
 *       }
 *
 *   用户配置(由 chat-settings 控制;本 SDK 只读不写):
 *     aiPerson.socialProfiles.chat.rollingConfig = {
 *       enabled:    boolean
 *       style:      'concise' | 'detailed'
 *       contextRounds:  number  // C 窗口大小,默认 20
 *       kMergeSize:    number  // 每多少个回合合并成一个 K,默认 5
 *       maxChainLength: number // K 链最多几个 K,默认 8
 *     }
 *
 *   API:
 *     list(aiPersonId)
 *     listActive(aiPersonId)
 *     get(aiPersonId, summaryId)
 *     add(aiPersonId, patch)               Promise<RollingSummary | null>
 *     update(aiPersonId, id, patch)        Promise<RollingSummary | null>
 *     remove(aiPersonId, id)               Promise<boolean>
 *     setActive(aiPersonId, id, active)    Promise<RollingSummary | null>
 *     setOrder(aiPersonId, ids[])          Promise<Array<RollingSummary>>
 *
 *     compressIfNeeded(aiPersonId, mode, messages, options?)
 *       自动判断是否需要压缩:
 *         - 计算当前 messages 里的「回合」数(1 回合 = 1 组连续 user + 1 组连续 ai,
 *           中间可能多次连续发言,直到 sender 切到另一边为止)
 *         - 若 contextRounds 超过 → 把最早 kMergeSize 个回合合并成新 K,append 到 K 链
 *         - 若 K 链太长 → 合并最早的 2 个 K(递归压缩)
 *         - 写入后返回 { compressed: boolean, newId?, removedIds, chainLength }
 *
 *     getRollingConfig(aiPersonId)         读 aiPerson.socialProfiles.chat.rollingConfig
 *     setRollingConfig(aiPersonId, patch)  写入(异步)
 *     buildKChainContext(aiPersonId)       把 K 链所有 active K 拼成一段注入文本
 *
 *     buildPlaceholderContent(rounds)      占位内容:拼接回合文本 + 占位标记
 *     hydrate()                            noop
 *
 * 依赖:
 *   - sdk.aiPersons.update
 */

const VALID_FIELDS = new Set([
    'id', 'level', 'startMsgId', 'endMsgId', 'messageCount',
    'content', 'threshold', 'style',
    'generatedAt', 'asPrompt',
    'createdAt', 'updatedAt',
]);

const DEFAULT_CONFIG = Object.freeze({
    enabled: false,
    style: 'concise',
    contextRounds: 20,
    kMergeSize: 5,
    maxChainLength: 8,
});

function _generateId() {
    return `rs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
    out.level = Number(out.level) || 0;
    out.startMsgId = String(out.startMsgId || '');
    out.endMsgId = String(out.endMsgId || '');
    out.messageCount = Number(out.messageCount) || 0;
    out.content = String(out.content || '');
    out.threshold = Number(out.threshold) || 0;
    out.style = out.style === 'detailed' ? 'detailed' : 'concise';
    out.generatedAt = Number(out.generatedAt) || _now();
    if (!out.asPrompt || typeof out.asPrompt !== 'object') {
        out.asPrompt = { active: true, order: 999, source: 'rolling-summary' };
    } else {
        out.asPrompt = {
            active: out.asPrompt.active !== false,
            order: Number(out.asPrompt.order) || 0,
            source: String(out.asPrompt.source || 'rolling-summary'),
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

function _readList(person) {
    if (!person) return [];
    const chatProfile = person.socialProfiles?.chat || {};
    return Array.isArray(chatProfile.rollingSummaries) ? chatProfile.rollingSummaries : [];
}

/**
 * 把消息按「回合」分组。
 *   - 回合定义:从最新到最旧,连续的同一侧消息归一组;
 *     当 sender 切到另一边时,新一组开始。
 *   - 输出按时间升序:[[round1Messages], [round2Messages], ...]
 *
 * @param {Array} messages  chatMessages 风格对象数组(必须有 sender, timestamp)
 * @returns {Array<Array>} rounds  回合数组,升序
 */
function _groupIntoRounds(messages) {
    const list = Array.isArray(messages) ? messages : [];
    if (list.length === 0) return [];
    // 按 timestamp 升序排(防御性:防止 messages 不是排好的)
    const sorted = list.slice().sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
    const rounds = [];
    let current = [];
    let currentSender = null;
    for (const m of sorted) {
        if (!m || m.sender == null) continue;
        if (m.sender !== currentSender && current.length > 0) {
            rounds.push(current);
            current = [];
        }
        current.push(m);
        currentSender = m.sender;
    }
    if (current.length > 0) rounds.push(current);
    return rounds;
}

/**
 * 给定回合数组,合并最早 n 个回合成一段占位文本。
 * 占位策略:按行拼每条消息的 (sender: content),末尾加占位标记。
 */
function _buildPlaceholderFromRounds(rounds, opts = {}) {
    const maxLines = Number(opts.maxLines) || 80;
    const lines = [];
    let totalMsgs = 0;
    for (const round of rounds) {
        for (const m of round) {
            totalMsgs += 1;
            if (lines.length >= maxLines) continue;
            const sender = m.sender === 'ai' ? 'AI' : '用户';
            const text = String(m.content || '').replace(/\s+/g, ' ').trim();
            if (!text) continue;
            const short = text.length > 120 ? text.slice(0, 120) + '…' : text;
            lines.push(`- ${sender}: ${short}`);
        }
    }
    const body = lines.length > 0 ? lines.join('\n') : '(空)';
    return {
        content: `${body}\n\n[滚动摘要占位 - 待 AI 接入]`,
        messageCount: totalMsgs,
        startMsgId: rounds[0]?.[0]?.id || '',
        endMsgId: rounds[rounds.length - 1]?.[rounds[rounds.length - 1].length - 1]?.id || '',
    };
}

/**
 * 给定 sdk,构造 rollingSummaries API。
 */
export function createRollingSummariesApi(sdk) {
    if (!sdk || !sdk.aiPersons) {
        console.warn('[rollingSummaries] sdk.aiPersons 缺失,API 返回空操作');
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
        if (!Array.isArray(bucket.rollingSummaries)) {
            bucket.rollingSummaries = [];
            try {
                await sdk.aiPersons.update(aiPersonId, { socialProfiles: person.socialProfiles });
            } catch (err) {
                console.warn('[rollingSummaries._ensureBucket] init failed', err);
            }
        }
        if (!bucket.rollingConfig || typeof bucket.rollingConfig !== 'object') {
            bucket.rollingConfig = { ...DEFAULT_CONFIG };
            try {
                await sdk.aiPersons.update(aiPersonId, { socialProfiles: person.socialProfiles });
            } catch (err) {
                console.warn('[rollingSummaries._ensureBucket] init config failed', err);
            }
        }
        return bucket.rollingSummaries;
    }

    return {
        list(aiPersonId) {
            const person = _getAiPerson(aiPersonId);
            const list = _readList(person);
            // 按 level 升序、generatedAt 升序
            return list.slice().sort((a, b) => {
                const al = Number(a?.level) || 0;
                const bl = Number(b?.level) || 0;
                if (al !== bl) return al - bl;
                return (Number(a?.generatedAt) || 0) - (Number(b?.generatedAt) || 0);
            });
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
                console.warn('[rollingSummaries.add] aiPerson 不存在:', aiPersonId);
                return null;
            }
            const bucket = await _ensureBucket(person, aiPersonId);
            const t = _now();
            const record = _normalize({
                id: patch.id || _generateId(),
                level: patch.level,
                startMsgId: patch.startMsgId,
                endMsgId: patch.endMsgId,
                messageCount: patch.messageCount,
                content: patch.content,
                threshold: patch.threshold,
                style: patch.style,
                generatedAt: t,
                asPrompt: patch.asPrompt || { active: true, order: 999, source: 'rolling-summary' },
                createdAt: t,
                updatedAt: t,
            });
            if (!record) return null;
            const next = bucket.concat([record]);
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), rollingSummaries: next } },
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
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), rollingSummaries: next } },
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
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), rollingSummaries: next } },
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
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), rollingSummaries: next } },
            });
            return _sortByOrder(next);
        },

        // ============================================
        // ★ v0.61.3 K 链核心 API
        // ============================================

        /**
         * 读用户的滚动摘要配置(enabled / style / contextRounds / kMergeSize / maxChainLength)
         * - 字段缺失时返回默认(DEFAULT_CONFIG)
         */
        getRollingConfig(aiPersonId) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return { ...DEFAULT_CONFIG };
            const cfg = person.socialProfiles?.chat?.rollingConfig;
            if (!cfg || typeof cfg !== 'object') return { ...DEFAULT_CONFIG };
            return {
                ...DEFAULT_CONFIG,
                ...cfg,
                style: cfg.style === 'detailed' ? 'detailed' : 'concise',
                contextRounds: Number(cfg.contextRounds) || DEFAULT_CONFIG.contextRounds,
                kMergeSize: Number(cfg.kMergeSize) || DEFAULT_CONFIG.kMergeSize,
                maxChainLength: Number(cfg.maxChainLength) || DEFAULT_CONFIG.maxChainLength,
                enabled: !!cfg.enabled,
            };
        },

        /**
         * 写入滚动摘要配置(异步,落盘到 aiPerson.socialProfiles.chat.rollingConfig)
         */
        async setRollingConfig(aiPersonId, patch = {}) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return null;
            const cur = this.getRollingConfig(aiPersonId);
            const next = { ...cur, ...patch };
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), rollingConfig: next } },
            });
            return next;
        },

        /**
         * 占位内容生成器(导出供业务代码 + 测试用)
         */
        buildPlaceholderContent(rounds, opts = {}) {
            return _buildPlaceholderFromRounds(rounds, opts);
        },

        /**
         * 核心:compressIfNeeded
         *   - options.contextRounds / kMergeSize / maxChainLength 优先取传入,
         *     否则从 rollingConfig 读,再否则 DEFAULT_CONFIG
         *   - 触发条件:rounds.length > contextRounds
         *   - 行为:压缩最早的 kMergeSize 个回合成 1 个 K,append 到 K 链;
         *     若 K 链 > maxChainLength → 合并最早 2 个 K(递归,直到 ≤ maxChainLength)
         *   - v0.63:content 字段由调用方在AI生成后填入,这里只写占位文本
         *     如果 options.generateSummary 被传入(异步函数),则自动调用并等待
         *   - 不传 messages / rounds = 0 时,什么都不做
         *
         * @param {string} aiPersonId
         * @param {string} mode
         * @param {Array} messages
         * @param {object} options
         * @param {Function} [options.generateSummary] - 可选:async function(rounds, opts) => {ok, summary}
         * @returns {Promise<{ compressed: boolean, newId?, removedIds: string[], chainLength: number, summaryContent?: string }>}
         */
        async compressIfNeeded(aiPersonId, _mode, messages = [], options = {}) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return { compressed: false, removedIds: [], chainLength: 0 };

            const cfg = this.getRollingConfig(aiPersonId);
            const contextRounds = Number(options.contextRounds ?? cfg.contextRounds) || DEFAULT_CONFIG.contextRounds;
            const kMergeSize = Number(options.kMergeSize ?? cfg.kMergeSize) || DEFAULT_CONFIG.kMergeSize;
            const maxChainLength = Number(options.maxChainLength ?? cfg.maxChainLength) || DEFAULT_CONFIG.maxChainLength;
            const style = options.style === 'detailed' ? 'detailed' : cfg.style || 'concise';
            const generateSummary = options.generateSummary; // v0.63:可选的AI生成回调

            if (!cfg.enabled && !options.force) {
                return { compressed: false, removedIds: [], chainLength: _readList(person).length };
            }

            const rounds = _groupIntoRounds(messages);
            if (rounds.length <= contextRounds) {
                return { compressed: false, removedIds: [], chainLength: _readList(person).length };
            }

            // 触发压缩:取最早的 kMergeSize 个回合
            const toCompress = rounds.slice(0, kMergeSize);
            if (toCompress.length === 0) {
                return { compressed: false, removedIds: [], chainLength: _readList(person).length };
            }

            const t = _now();
            let summaryContent = '';

            // v0.63:如果传入了generateSummary回调,则调用AI生成梗概
            if (typeof generateSummary === 'function') {
                try {
                    const result = await generateSummary(toCompress, {
                        aiPersonId,
                        mode: _mode,
                        summaryStyle: style,
                    });
                    if (result && result.ok && result.summary) {
                        summaryContent = result.summary;
                        console.log('[rollingSummaries] K链AI摘要生成成功:', summaryContent.slice(0, 50));
                    } else {
                        console.warn('[rollingSummaries] K链AI摘要生成失败:', result?.error || '未知错误');
                    }
                } catch (err) {
                    console.warn('[rollingSummaries] K链AI摘要生成异常:', err);
                }
            }

            // 如果没有生成摘要,用占位文本
            if (!summaryContent) {
                const built = _buildPlaceholderFromRounds(toCompress, options);
                summaryContent = built.content;
            }

            const newRecord = _normalize({
                id: _generateId(),
                level: 0,           // 占位版:全部 K0,真实接入 AI 后再分 K1/K2
                startMsgId: toCompress[0]?.[0]?.id || '',
                endMsgId: toCompress[toCompress.length - 1]?.[toCompress[toCompress.length - 1].length - 1]?.id || '',
                messageCount: toCompress.reduce((sum, r) => sum + (Array.isArray(r) ? r.length : 0), 0),
                content: summaryContent,
                threshold: contextRounds,
                style,
                generatedAt: t,
                asPrompt: { active: true, order: 999, source: 'rolling-summary' },
                createdAt: t,
                updatedAt: t,
            });
            if (!newRecord) return { compressed: false, removedIds: [], chainLength: 0 };

            const bucket = await _ensureBucket(person, aiPersonId);
            let next = bucket.concat([newRecord]);

            // K 链太长 → 合并最早 2 个
            const removedIds = [];
            while (next.length > maxChainLength) {
                const first = next[0];
                const second = next[1];
                if (!first) break;
                if (!second) {
                    // 只剩 1 个,但还是太长(说明 maxChainLength < 1)→ 直接删
                    removedIds.push(first.id);
                    next = next.slice(1);
                    break;
                }
                const mergedContent = `${first.content}\n\n${second.content}`;
                const merged = _normalize({
                    ...first,
                    id: _generateId(),
                    level: Math.max(Number(first.level) || 0, Number(second.level) || 0),
                    endMsgId: second.endMsgId || first.endMsgId,
                    messageCount: (Number(first.messageCount) || 0) + (Number(second.messageCount) || 0),
                    content: mergedContent,
                    generatedAt: t,
                    updatedAt: t,
                });
                removedIds.push(first.id, second.id);
                next = [merged, ...next.slice(2)];
            }

            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), rollingSummaries: next } },
            });

            return {
                compressed: true,
                newId: newRecord.id,
                removedIds,
                chainLength: next.length,
                summaryContent, // v0.63:返回生成的摘要内容供调用方参考
            };
        },

        /**
         * 拼装 K 链上下文文本(注入 prompt 用)
         *   - 顺序:按 level 升序、generatedAt 升序(老 K 在前)
         *   - 每条 active K 的 content 用 K-编号 + content 形式拼接
         */
        buildKChainContext(aiPersonId) {
            const list = this.listActive(aiPersonId);
            if (list.length === 0) return '';
            const lines = ['# 滚动摘要 K 链(用户启用,按层级/生成顺序拼到最近消息之前)'];
            list.forEach((k, i) => {
                lines.push(`\n## K${k.level ?? 0}-${i + 1}(${k.messageCount || 0} 条 · ${k.style || 'concise'})`);
                lines.push(String(k.content || ''));
            });
            return lines.join('\n');
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
            console.warn('[rollingSummaries] SDK 未就绪,所有 API 返回 null/空数组');
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
        getRollingConfig: () => ({ ...DEFAULT_CONFIG }),
        setRollingConfig: async () => ({ ...DEFAULT_CONFIG }),
        buildPlaceholderContent: () => ({ content: '[滚动摘要占位 - 待 AI 接入]', messageCount: 0, startMsgId: '', endMsgId: '' }),
        compressIfNeeded: async () => ({ compressed: false, removedIds: [], chainLength: 0 }),
        buildKChainContext: () => '',
        hydrate: async () => {},
    };
}
