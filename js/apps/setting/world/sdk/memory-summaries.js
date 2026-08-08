/**
 * settings-sdk · chat-app 「分级记忆系统」SDK (v0.65, 2026-08-08)
 *
 *   业务含义:把聊天记录按「层级」自动压缩,每层独立执行「满 N 消 N」滚动消耗机制。
 *   用户可自由配置层级(L1 固定 / L2~Ln 可增删改周期)。
 *
 *   默认层级结构:
 *     ┌──────┬─────────┬─────────┬──────────┬──────────┐
 *     │ 层级  │ 默认名称 │ 默认周期 │ 可改周期 │ 可删除   │
 *     ├──────┼─────────┼─────────┼──────────┼──────────┤
 *     │ L1   │ 日概要   │ 1   天   │ ❌       │ ❌       │
 *     │ L2   │ 周概要   │ 7   天   │ ✅       │ ✅       │
 *     │ L3   │ 月概要   │ 30  天   │ ✅       │ ✅       │
 *     │ L4   │ 年概要   │ 360 天   │ ✅       │ ✅       │
 *     └──────┴─────────┴─────────┴──────────┴──────────┘
 *
 *   硬约束: 上层周期 > 下层周期
 *     - L4.cycle > L3.cycle > L2.cycle > L1.cycle
 *     - 用户改 / 增 / 删层级时实时校验
 *
 *   数据模型(全部挂 aiPerson.socialProfiles.chat 顶层,深合并友好):
 *     aiPerson.socialProfiles.chat.memoryConfig = {
 *       version: '1.0',
 *       levels: [ { id, name, cycle, order, editable, deletable } ]
 *     }
 *     aiPerson.socialProfiles.chat.memorySummaries[] = [
 *       {
 *         id, storageLevel(L1/L2/...), title, content,
 *         sourceLevel(L0=原始消息/L1/L2/...), sourceIds[], sourceDates[],
 *         cycle, consumed(false=待消耗), deleted(false=软删), generatedAt,
 *         asPrompt: { active, order, source: 'memory-summary' }
 *       }
 *     ]
 *     aiPerson.socialProfiles.chat.memoryStats = {
 *       lastModified: ts,
 *       totalGenerated: number,
 *       totalConsumed: number,
 *     }
 *
 *   核心 API:
 *     - getConfig / setLevels / addLevel / removeLevel / updateLevelCycle
 *     - list / listByLevel / listByLevelId / listAvailableForLayer / get
 *     - add / update / remove(软删) / setActive / setOrder
 *     - generateLevelSummary(aiPersonId, levelId, opts)  ★ 满 N 消 N
 *     - buildMemoryContext(aiPersonId) → 给 prompt-builder 用
 *     - validateCycleConstraints(levels) / buildPlaceholderFromLowerLevel
 *
 * 依赖:
 *   - sdk.aiPersons.update / get
 *   - 不需要新 IndexedDB 表(数据挂在 aiPerson 顶层)
 *   - 占位生成: 拼接下层概要 content + 加占位标记
 *   - 真实 AI 生成: 调用方传入 opts.generateSummary(lowerSummaries, opts) → {ok, summary, title}
 *
 * 设计原则:
 *   - 软删除: deleted=true 标记,数据保留可恢复(管理员 API 或未来"已删除"页)
 *   - 改周期: 清存量 = 把该层所有 consumed 标记重置为 false(下一层数据不变)
 *   - 删层级: 标记该层所有 deleted=true,order 重排(上层降级不需要合并数据)
 *   - 增层级: order 自动插入,下层数据自然变成"新上一层"的下层
 */

const VALID_FIELDS = new Set([
    'id', 'storageLevel', 'title', 'content',
    'sourceLevel', 'sourceIds', 'sourceDates',
    'cycle', 'consumed', 'deleted',
    'generatedAt', 'asPrompt',
    'createdAt', 'updatedAt',
    'messageCount', 'originalDateRange',
]);

const DEFAULT_LEVELS = Object.freeze([
    Object.freeze({ id: 'L1', name: '日概要', cycle: 1,   order: 1, editable: false, deletable: false }),
    Object.freeze({ id: 'L2', name: '周概要', cycle: 7,   order: 2, editable: true,  deletable: true  }),
    Object.freeze({ id: 'L3', name: '月概要', cycle: 30,  order: 3, editable: true,  deletable: true  }),
    Object.freeze({ id: 'L4', name: '年概要', cycle: 360, order: 4, editable: true,  deletable: true  }),
]);

const CONFIG_VERSION = '1.0';

function _generateId() {
    return `ms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function _now() {
    return Date.now();
}

/**
 * 生成下一个可用的层级 id(用户添加层级时用)
 * 默认 L1~L4,用户加的层级从 L5 开始
 */
function _generateLevelId(existingLevels) {
    const used = new Set((existingLevels || []).map((l) => String(l.id || '')));
    let i = 5;
    while (used.has(`L${i}`)) i++;
    return `L${i}`;
}

/**
 * 规范化单条概要记录
 */
function _normalizeSummary(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    for (const k of VALID_FIELDS) {
        if (raw[k] !== undefined) out[k] = raw[k];
    }
    out.id = String(out.id || '');
    out.storageLevel = String(out.storageLevel || 'L1');
    out.title = String(out.title || '未命名概要');
    out.content = String(out.content || '');
    out.sourceLevel = String(out.sourceLevel || 'L0');
    out.sourceIds = Array.isArray(out.sourceIds) ? out.sourceIds.slice() : [];
    out.sourceDates = Array.isArray(out.sourceDates) ? out.sourceDates.slice() : [];
    out.cycle = Number(out.cycle) || 1;
    out.consumed = !!out.consumed;
    out.deleted = !!out.deleted;
    out.generatedAt = Number(out.generatedAt) || _now();
    out.messageCount = Number(out.messageCount) || 0;
    if (!out.originalDateRange || typeof out.originalDateRange !== 'object') {
        out.originalDateRange = { start: '', end: '' };
    } else {
        out.originalDateRange = {
            start: String(out.originalDateRange.start || ''),
            end: String(out.originalDateRange.end || ''),
        };
    }
    if (!out.asPrompt || typeof out.asPrompt !== 'object') {
        out.asPrompt = { active: true, order: 999, source: 'memory-summary' };
    } else {
        out.asPrompt = {
            active: out.asPrompt.active !== false,
            order: Number(out.asPrompt.order) || 0,
            source: String(out.asPrompt.source || 'memory-summary'),
        };
    }
    out.createdAt = Number(out.createdAt) || out.generatedAt;
    out.updatedAt = Number(out.updatedAt) || out.generatedAt;
    return out;
}

/**
 * 规范化层级配置项
 */
function _normalizeLevel(raw, fallbackOrder = 0) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {
        id: String(raw.id || ''),
        name: String(raw.name || '未命名层级'),
        cycle: Math.max(1, Number(raw.cycle) || 1),
        order: Number(raw.order) || fallbackOrder,
        editable: raw.editable !== false,
        deletable: raw.deletable !== false,
    };
    if (!out.id) return null;
    // L1 永远是固定的
    if (out.id === 'L1') {
        out.editable = false;
        out.deletable = false;
    }
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

function _sortLevels(levels) {
    return levels.slice().sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

function _readConfig(person) {
    if (!person) return { version: CONFIG_VERSION, levels: _sortLevels(DEFAULT_LEVELS.map((l) => ({ ...l }))) };
    const cfg = person.socialProfiles?.chat?.memoryConfig;
    if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.levels)) {
        return { version: CONFIG_VERSION, levels: _sortLevels(DEFAULT_LEVELS.map((l) => ({ ...l }))) };
    }
    const normalizedLevels = cfg.levels
        .map((l, idx) => _normalizeLevel(l, idx + 1))
        .filter(Boolean);
    if (normalizedLevels.length === 0) {
        return { version: CONFIG_VERSION, levels: _sortLevels(DEFAULT_LEVELS.map((l) => ({ ...l }))) };
    }
    return { version: String(cfg.version || CONFIG_VERSION), levels: _sortLevels(normalizedLevels) };
}

function _readSummaryList(person) {
    if (!person) return [];
    const chatProfile = person.socialProfiles?.chat || {};
    return Array.isArray(chatProfile.memorySummaries) ? chatProfile.memorySummaries : [];
}

/**
 * 校验层级周期约束:
 *   - 按 order 升序排列
 *   - 每层 cycle > 下一层 cycle(数组中索引小的是上层)
 *   - 所有 cycle >= 1
 *
 * @param {Array} levels - 层级数组
 * @returns {{ ok: boolean, error?: string }}
 */
function validateCycleConstraints(levels) {
    if (!Array.isArray(levels) || levels.length === 0) {
        return { ok: false, error: '层级数组不能为空' };
    }
    const sorted = _sortLevels(levels);
    for (let i = 0; i < sorted.length; i++) {
        const cur = sorted[i];
        if (!cur || !cur.id) {
            return { ok: false, error: '存在无效层级(缺少 id)' };
        }
        if (!Number.isFinite(cur.cycle) || cur.cycle < 1) {
            return { ok: false, error: `${cur.id} 的周期必须 ≥ 1` };
        }
        const next = sorted[i + 1];
        if (next) {
            // 上层 = i,下层 = i+1,要求 上层 > 下层
            if (cur.cycle <= next.cycle) {
                return { ok: false, error: `${cur.id} 周期(${cur.cycle}) 必须 > ${next.id} 周期(${next.cycle})` };
            }
        }
    }
    return { ok: true };
}

/**
 * 给定 sdk,构造 memorySummaries API。
 *
 * @param {object} sdk  window.settingsSdk 实例
 * @returns {object} memorySummaries API
 */
export function createMemorySummariesApi(sdk) {
    if (!sdk || !sdk.aiPersons) {
        console.warn('[memorySummaries] sdk.aiPersons 缺失,API 返回空操作');
        return _emptyApi();
    }

    const _getAiPerson = (aiPersonId) => {
        if (!aiPersonId) return null;
        return sdk.aiPersons.get(aiPersonId) || null;
    };

    /**
     * 兜底初始化 aiPerson.socialProfiles.chat.memoryConfig / memorySummaries = []
     * (用户的旧 aiPerson 数据里没有这字段)
     */
    async function _ensureBucket(person, aiPersonId) {
        if (!person) return { config: null, summaries: [] };
        const chatProfile = person.socialProfiles || (person.socialProfiles = { chat: {} });
        const bucket = chatProfile.chat || (chatProfile.chat = {});
        let dirty = false;
        if (!bucket.memoryConfig || typeof bucket.memoryConfig !== 'object' || !Array.isArray(bucket.memoryConfig.levels)) {
            bucket.memoryConfig = { version: CONFIG_VERSION, levels: _sortLevels(DEFAULT_LEVELS.map((l) => ({ ...l }))) };
            dirty = true;
        }
        if (!Array.isArray(bucket.memorySummaries)) {
            bucket.memorySummaries = [];
            dirty = true;
        }
        if (dirty) {
            try {
                await sdk.aiPersons.update(aiPersonId, { socialProfiles: person.socialProfiles });
            } catch (err) {
                console.warn('[memorySummaries._ensureBucket] init failed', err);
            }
        }
        return { config: bucket.memoryConfig, summaries: bucket.memorySummaries };
    }

    /**
     * 找出指定层级在数组中的下一个层级(order 更大 = 下层)
     */
    function _findNextLevel(config, levelId) {
        const levels = _sortLevels(config.levels);
        const cur = levels.find((l) => l.id === levelId);
        if (!cur) return null;
        return levels.find((l) => (Number(l.order) || 0) > (Number(cur.order) || 0)) || null;
    }

    /**
     * 找出指定层级在数组中的上一个层级(order 更小 = 上层)
     */
    function _findPrevLevel(config, levelId) {
        const levels = _sortLevels(config.levels);
        const cur = levels.find((l) => l.id === levelId);
        if (!cur) return null;
        return levels.slice().reverse().find((l) => (Number(l.order) || 0) < (Number(cur.order) || 0)) || null;
    }

    return {
        // ============================================
        // 1. 配置层
        // ============================================

        /** 读某 AI 人设的层级配置 */
        getConfig(aiPersonId) {
            const person = _getAiPerson(aiPersonId);
            return _readConfig(person);
        },

        /**
         * 整体替换层级配置(高级 API,内部仍会校验周期约束)
         * @returns {Promise<{ok: boolean, error?: string, levels?: Array}>}
         */
        async setLevels(aiPersonId, levels) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return { ok: false, error: 'aiPerson 不存在' };
            if (!Array.isArray(levels)) return { ok: false, error: 'levels 必须是数组' };
            // 保证 L1 永远存在 + 永远是第一个(order 最小)
            const normalized = levels
                .map((l, idx) => _normalizeLevel(l, idx + 1))
                .filter(Boolean);
            if (!normalized.some((l) => l.id === 'L1')) {
                const l1Default = DEFAULT_LEVELS[0];
                normalized.unshift({ ...l1Default, order: 1 });
            } else {
                // 强制 L1.editable = L1.deletable = false
                const l1 = normalized.find((l) => l.id === 'L1');
                if (l1) {
                    l1.editable = false;
                    l1.deletable = false;
                    l1.cycle = 1;
                    l1.order = 1;
                }
            }
            const check = validateCycleConstraints(normalized);
            if (!check.ok) return { ok: false, error: check.error };
            const sorted = _sortLevels(normalized);
            const { config } = await _ensureBucket(person, aiPersonId);
            config.levels = sorted;
            config.version = CONFIG_VERSION;
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), memoryConfig: config } },
            });
            return { ok: true, levels: sorted };
        },

        /**
         * 添加新层级
         * @param {string} aiPersonId
         * @param {object} spec  { name, cycle, position: 'after-L2' | 'before-L3' | 'append' }
         * @returns {Promise<{ok: boolean, error?: string, level?: object}>}
         */
        async addLevel(aiPersonId, spec = {}) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return { ok: false, error: 'aiPerson 不存在' };
            const config = _readConfig(person);
            const newId = _generateLevelId(config.levels);
            const name = String(spec.name || `${newId} 概要`).trim() || `${newId} 概要`;
            const cycle = Math.max(1, Number(spec.cycle) || 1);
            // 计算 order
            let order;
            const position = spec.position || 'append';
            if (position === 'append') {
                const maxOrder = Math.max(...config.levels.map((l) => Number(l.order) || 0), 0);
                order = maxOrder + 1;
            } else {
                const m = String(position).match(/^(after|before)-(.+)$/);
                if (!m) return { ok: false, error: 'position 格式错误(after-X / before-X / append)' };
                const anchorLevel = config.levels.find((l) => l.id === m[2]);
                if (!anchorLevel) return { ok: false, error: `锚点层级 ${m[2]} 不存在` };
                order = (Number(anchorLevel.order) || 0) + (m[1] === 'after' ? 0.5 : -0.5);
            }
            const newLevel = {
                id: newId,
                name,
                cycle,
                order,
                editable: true,
                deletable: true,
            };
            // 临时构建完整列表(给新层级一个整型 order)
            const tmp = config.levels.map((l) => ({ ...l }));
            const anchorIdx = order !== Math.floor(order) && position.startsWith('after')
                ? tmp.findIndex((l) => (Number(l.order) || 0) >= Math.floor(order)) + 0
                : tmp.findIndex((l) => (Number(l.order) || 0) > Math.floor(order)) + 0;
            // 简化:直接插到锚点旁边,然后整体重新分配 order 1..N
            tmp.push(newLevel);
            tmp.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
            // 重新分配整型 order
            tmp.forEach((l, idx) => { l.order = idx + 1; });
            const check = validateCycleConstraints(tmp);
            if (!check.ok) return { ok: false, error: check.error };
            // 写入
            const { config: bucketConfig } = await _ensureBucket(person, aiPersonId);
            bucketConfig.levels = tmp;
            bucketConfig.version = CONFIG_VERSION;
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), memoryConfig: bucketConfig } },
            });
            return { ok: true, level: newLevel };
        },

        /**
         * 删除层级(软删:标记 deleted=true + order 重排)
         * - L1 不能删
         * - 该层已有概要全部标 deleted=true(数据保留可恢复)
         * - 上层层级自动降级(order 不变,数据语义不变)
         *
         * @returns {Promise<{ok: boolean, error?: string}>}
         */
        async removeLevel(aiPersonId, levelId) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return { ok: false, error: 'aiPerson 不存在' };
            if (levelId === 'L1') return { ok: false, error: 'L1 是固定层级,不可删除' };
            const config = _readConfig(person);
            const target = config.levels.find((l) => l.id === levelId);
            if (!target) return { ok: false, error: `层级 ${levelId} 不存在` };
            if (!target.deletable) return { ok: false, error: `${levelId} 不可删除` };

            // 从配置中移除该层级 + 重新分配 order
            const newLevels = config.levels
                .filter((l) => l.id !== levelId)
                .map((l, idx) => ({ ...l, order: idx + 1 }));
            const check = validateCycleConstraints(newLevels);
            if (!check.ok) return { ok: false, error: check.error };

            // 该层所有概要软删
            const summaries = _readSummaryList(person).map((s) => {
                const n = _normalizeSummary(s);
                if (n && n.storageLevel === levelId && !n.deleted) {
                    n.deleted = true;
                    n.updatedAt = _now();
                }
                return n;
            }).filter(Boolean);

            const { config: bucketConfig, summaries: bucketSummaries } = await _ensureBucket(person, aiPersonId);
            bucketConfig.levels = newLevels;
            bucketConfig.version = CONFIG_VERSION;
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: {
                    ...person.socialProfiles,
                    chat: {
                        ...(person.socialProfiles?.chat || {}),
                        memoryConfig: bucketConfig,
                        memorySummaries: summaries,
                    },
                },
            });
            return { ok: true };
        },

        /**
         * 修改层级周期
         * - L1 不能改
         * - 改后该层所有 consumed 标记重置为 false(存量清零)
         * - 下一层数据不变(下次生成时按新 cycle 重新挑选)
         *
         * @returns {Promise<{ok: boolean, error?: string, clearedCount?: number}>}
         */
        async updateLevelCycle(aiPersonId, levelId, newCycle) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return { ok: false, error: 'aiPerson 不存在' };
            if (levelId === 'L1') return { ok: false, error: 'L1 周期固定为 1 天,不可修改' };
            const cycle = Math.max(1, Math.floor(Number(newCycle) || 1));
            const config = _readConfig(person);
            const target = config.levels.find((l) => l.id === levelId);
            if (!target) return { ok: false, error: `层级 ${levelId} 不存在` };
            if (!target.editable) return { ok: false, error: `${levelId} 不可编辑` };

            // 校验周期约束(模拟修改后)
            const tmp = config.levels.map((l) => ({ ...l }));
            const t = tmp.find((l) => l.id === levelId);
            t.cycle = cycle;
            const check = validateCycleConstraints(tmp);
            if (!check.ok) return { ok: false, error: check.error };

            // 该层所有 consumed 回退为 false
            let cleared = 0;
            const summaries = _readSummaryList(person).map((s) => {
                const n = _normalizeSummary(s);
                if (!n) return null;
                if (n.storageLevel === levelId && !n.deleted && n.consumed) {
                    n.consumed = false;
                    n.updatedAt = _now();
                    cleared++;
                }
                return n;
            }).filter(Boolean);

            const { config: bucketConfig, summaries: bucketSummaries } = await _ensureBucket(person, aiPersonId);
            bucketConfig.levels = tmp;
            bucketConfig.version = CONFIG_VERSION;
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: {
                    ...person.socialProfiles,
                    chat: {
                        ...(person.socialProfiles?.chat || {}),
                        memoryConfig: bucketConfig,
                        memorySummaries: summaries,
                    },
                },
            });
            return { ok: true, clearedCount: cleared };
        },

        // ============================================
        // 2. 数据层
        // ============================================

        /** 读某 AI 人设某层所有未删概要(按 generatedAt 降序) */
        list(aiPersonId, levelId) {
            const person = _getAiPerson(aiPersonId);
            const all = _sortByGeneratedAt(_readSummaryList(person));
            const list = all.filter((s) => s && !s.deleted && (!levelId || s.storageLevel === levelId));
            return list.map((s) => _normalizeSummary(s)).filter(Boolean);
        },

        /** 读全部概要(未删),按层分组 */
        listByLevel(aiPersonId) {
            const config = this.getConfig(aiPersonId);
            const person = _getAiPerson(aiPersonId);
            const all = _readSummaryList(person)
                .map((s) => _normalizeSummary(s))
                .filter(Boolean)
                .filter((s) => !s.deleted);
            const grouped = {};
            config.levels.forEach((l) => { grouped[l.id] = []; });
            all.forEach((s) => {
                if (!grouped[s.storageLevel]) grouped[s.storageLevel] = [];
                grouped[s.storageLevel].push(s);
            });
            // 每个组内按 generatedAt 降序
            Object.keys(grouped).forEach((k) => {
                grouped[k].sort((a, b) => (Number(b.generatedAt) || 0) - (Number(a.generatedAt) || 0));
            });
            return grouped;
        },

        /** 读单条 */
        get(aiPersonId, summaryId) {
            const person = _getAiPerson(aiPersonId);
            const list = _readSummaryList(person);
            const found = list.find((s) => s && s.id === summaryId);
            return found ? _normalizeSummary(found) : null;
        },

        /**
         * 新增一条概要(直接新增,不走 generateLevelSummary)
         * 一般用于 L1 手动生成的入口
         */
        async add(aiPersonId, patch = {}) {
            const person = _getAiPerson(aiPersonId);
            if (!person) {
                console.warn('[memorySummaries.add] aiPerson 不存在:', aiPersonId);
                return null;
            }
            const { config, summaries } = await _ensureBucket(person, aiPersonId);
            const t = _now();
            const record = _normalizeSummary({
                id: patch.id || _generateId(),
                storageLevel: patch.storageLevel || 'L1',
                title: patch.title || '聊天概要',
                content: patch.content || '',
                sourceLevel: patch.sourceLevel || 'L0',
                sourceIds: patch.sourceIds || [],
                sourceDates: patch.sourceDates || [],
                cycle: patch.cycle || 1,
                consumed: !!patch.consumed,
                deleted: false,
                generatedAt: t,
                messageCount: Number(patch.messageCount) || 0,
                originalDateRange: patch.originalDateRange || { start: '', end: '' },
                asPrompt: patch.asPrompt || { active: true, order: 999, source: 'memory-summary' },
                createdAt: t,
                updatedAt: t,
            });
            if (!record) return null;
            const next = summaries.concat([record]);
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), memorySummaries: next } },
            });
            return record;
        },

        /**
         * 更新一条概要
         */
        async update(aiPersonId, summaryId, patch = {}) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return null;
            const { summaries } = await _ensureBucket(person, aiPersonId);
            const idx = summaries.findIndex((s) => s && s.id === summaryId);
            if (idx < 0) return null;
            const prev = summaries[idx];
            const merged = _normalizeSummary({
                ...prev,
                ...patch,
                id: prev.id,
                deleted: patch.deleted !== undefined ? !!patch.deleted : prev.deleted,
                generatedAt: prev.generatedAt,
                createdAt: prev.createdAt,
                updatedAt: _now(),
            });
            if (!merged) return null;
            const next = summaries.slice();
            next[idx] = merged;
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), memorySummaries: next } },
            });
            return merged;
        },

        /**
         * 软删除一条概要(deleted=true)
         * 数据保留,可未来"已删除"页恢复
         */
        async remove(aiPersonId, summaryId) {
            return this.update(aiPersonId, summaryId, { deleted: true });
        },

        /**
         * 切换 active(独立 API 方便 UI 调用)
         */
        async setActive(aiPersonId, summaryId, active) {
            const cur = this.get(aiPersonId, summaryId);
            if (!cur) return null;
            return this.update(aiPersonId, summaryId, {
                asPrompt: { ...cur.asPrompt, active: !!active },
            });
        },

        /**
         * 批量重排
         */
        async setOrder(aiPersonId, summaryIdsInOrder = []) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return [];
            const { summaries } = await _ensureBucket(person, aiPersonId);
            const t = _now();
            const map = new Map(summaries.map((s) => [s.id, s]));
            const next = [];
            let order = 1;
            for (const sid of summaryIdsInOrder) {
                const cur = map.get(sid);
                if (!cur) continue;
                next.push({ ...cur, asPrompt: { ...cur.asPrompt, order: order++ }, updatedAt: t });
                map.delete(sid);
            }
            for (const rest of map.values()) {
                next.push({ ...rest, asPrompt: { ...rest.asPrompt, order: order++ }, updatedAt: t });
            }
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), memorySummaries: next } },
            });
            return _sortByOrder(next);
        },

        /**
         * 列出某层「可用于上一层生成」的概要(未消耗 + 未删除)
         * 按 generatedAt 升序(老的在前,新的在后)
         */
        listAvailableForLayer(aiPersonId, levelId) {
            const config = this.getConfig(aiPersonId);
            const targetLevel = config.levels.find((l) => l.id === levelId);
            if (!targetLevel) return [];
            // 上一层 = order 更小 = 数字更小
            const prevLevel = _findPrevLevel(config, levelId);
            if (!prevLevel) return [];
            const person = _getAiPerson(aiPersonId);
            const all = _readSummaryList(person)
                .map((s) => _normalizeSummary(s))
                .filter(Boolean)
                .filter((s) => !s.deleted && s.storageLevel === prevLevel.id && !s.consumed);
            return all.sort((a, b) => (Number(a.generatedAt) || 0) - (Number(b.generatedAt) || 0));
        },

        // ============================================
        // 3. 生成层(核心:满 N 消 N)
        // ============================================

        /**
         * 生成某层的概要
         *   - 从该层的下层概要里取 cycle 条「未消耗」的(按 generatedAt 升序取最早的)
         *   - 调 opts.generateSummary(lowerSummaries, opts) → {ok, summary, title}
         *     或 fallback 到 buildPlaceholderFromLowerLevel
         *   - 写入一条新概要 + 标记这 cycle 条下层概要为 consumed=true
         *   - 不传 opts.generateSummary = 占位生成
         *
         * @param {string} aiPersonId
         * @param {string} levelId   要生成哪层(L2/L3/L4/...)
         * @param {object} opts
         *   - generateSummary?: async function(lowerSummaries, info) => {ok, summary, title}
         *   - force?: boolean   即使存量不足也强行生成(用所有可用)
         * @returns {Promise<{ok: boolean, error?: string, summary?: object, consumedIds?: string[]}>}
         */
        async generateLevelSummary(aiPersonId, levelId, opts = {}) {
            const config = this.getConfig(aiPersonId);
            const targetLevel = config.levels.find((l) => l.id === levelId);
            if (!targetLevel) return { ok: false, error: `层级 ${levelId} 不存在` };
            const cycle = targetLevel.cycle;
            const prevLevel = _findPrevLevel(config, levelId);
            if (!prevLevel) return { ok: false, error: `${levelId} 是最底层,无法生成` };

            const available = this.listAvailableForLayer(aiPersonId, levelId);
            if (available.length === 0 && !opts.force) {
                return { ok: false, error: `下层 ${prevLevel.id} 没有可消耗的概要,请先生成 ${prevLevel.id}` };
            }
            if (available.length < cycle && !opts.force) {
                return { ok: false, error: `下层概要不足 ${cycle} 条(当前 ${available.length} 条)` };
            }

            // 取 cycle 条最早的(数组是升序)
            const toConsume = available.slice(0, cycle);
            const consumedIds = toConsume.map((s) => s.id);

            // 调 AI 生成 / fallback 占位
            let generated;
            try {
                if (typeof opts.generateSummary === 'function') {
                    const result = await opts.generateSummary(toConsume, {
                        aiPersonId,
                        levelId,
                        sourceLevelId: prevLevel.id,
                        cycle,
                    });
                    if (result && result.ok && result.summary) {
                        generated = {
                            title: String(result.title || `${targetLevel.name} - ${_formatRange(toConsume)}`),
                            content: String(result.summary),
                        };
                    } else {
                        console.warn('[memorySummaries.generateLevelSummary] AI 生成失败:', result?.error || '未知');
                    }
                }
            } catch (err) {
                console.warn('[memorySummaries.generateLevelSummary] AI 生成异常:', err);
            }
            if (!generated) {
                const placeholder = this.buildPlaceholderFromLowerLevel(toConsume);
                generated = placeholder;
            }

            // 写入新概要
            const person = _getAiPerson(aiPersonId);
            if (!person) return { ok: false, error: 'aiPerson 不存在' };
            const { summaries } = await _ensureBucket(person, aiPersonId);
            const t = _now();

            const dateRange = _extractDateRange(toConsume);
            const newRecord = _normalizeSummary({
                id: _generateId(),
                storageLevel: levelId,
                title: generated.title,
                content: generated.content,
                sourceLevel: prevLevel.id,
                sourceIds: consumedIds,
                sourceDates: dateRange.dates,
                cycle,
                consumed: false,
                deleted: false,
                generatedAt: t,
                messageCount: toConsume.reduce((sum, s) => sum + (Number(s.messageCount) || 0), 0),
                originalDateRange: dateRange.range,
                asPrompt: { active: true, order: 999, source: 'memory-summary' },
                createdAt: t,
                updatedAt: t,
            });

            // 标记下层 consumed
            const next = summaries.map((s) => {
                const n = _normalizeSummary(s);
                if (!n) return s;
                if (consumedIds.includes(n.id)) {
                    n.consumed = true;
                    n.updatedAt = t;
                }
                return n;
            });
            next.push(newRecord);

            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: { ...person.socialProfiles, chat: { ...(person.socialProfiles?.chat || {}), memorySummaries: next } },
            });

            // 派发事件(让 chat-app 监听刷新 UI)
            try {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('chat:memory-summary-updated', {
                        detail: { aiPersonId, levelId, summaryId: newRecord.id, consumedIds, source: 'memory-summaries' },
                    }));
                }
            } catch (_) {}

            return { ok: true, summary: newRecord, consumedIds };
        },

        // ============================================
        // 4. 工具
        // ============================================

        /** 占位生成: 拼接下层概要内容 */
        buildPlaceholderFromLowerLevel(lowerSummaries = [], opts = {}) {
            const list = Array.isArray(lowerSummaries) ? lowerSummaries : [];
            const maxLines = Number(opts.maxLines) || 30;
            const lines = [];
            for (let i = 0; i < list.length && lines.length < maxLines; i++) {
                const s = list[i];
                const title = String(s?.title || '').trim();
                const content = String(s?.content || '').trim();
                const dateRange = s?.originalDateRange || {};
                const dateText = (dateRange.start && dateRange.end)
                    ? `${dateRange.start} ~ ${dateRange.end}`
                    : (dateRange.start || dateRange.end || '');
                if (title) lines.push(`## ${dateText} ${title}`.trim());
                if (content) {
                    const short = content.length > 200 ? content.slice(0, 200) + '…' : content;
                    lines.push(short);
                }
                lines.push('');
            }
            const content = lines.length > 0
                ? `${lines.join('\n').trim()}\n\n[分级概要占位 - 待 AI 接入]`
                : '[无内容]';
            const title = opts.title || `${list.length} 条下层概要合并`;
            const dateRange = _extractDateRange(list);
            return {
                title,
                content,
                messageCount: list.reduce((sum, s) => sum + (Number(s?.messageCount) || 0), 0),
                dateRange: dateRange.range,
            };
        },

        /**
         * 给 prompt-builder 用的: 把所有 active=true 的概要拼成一段注入文本
         * 按层级从大到小(L4 → L3 → L2 → L1)排序,L1 内容最详细
         * 输出示例:
         *   # 分级记忆
         *   ## 年概要
         *   - 2025 年概要 ...
         *   ## 月概要
         *   - 2025年8月概要 ...
         *   ...
         */
        buildMemoryContext(aiPersonId) {
            const config = this.getConfig(aiPersonId);
            const grouped = this.listByLevel(aiPersonId);
            const activeByLevel = {};
            config.levels.forEach((l) => {
                activeByLevel[l.id] = (grouped[l.id] || []).filter((s) => s.asPrompt && s.asPrompt.active !== false);
            });

            const lines = ['# 分级记忆(用户启用)'];
            // 从大到小排序(upper first)
            const sortedLevels = _sortLevels(config.levels).slice().reverse();
            let hasAny = false;
            sortedLevels.forEach((l) => {
                const items = activeByLevel[l.id] || [];
                if (items.length === 0) return;
                hasAny = true;
                lines.push(`\n## ${l.name}(共 ${items.length} 条)`);
                items.forEach((s, idx) => {
                    const dateText = s.originalDateRange?.start
                        ? ` ${s.originalDateRange.start}${s.originalDateRange.end && s.originalDateRange.end !== s.originalDateRange.start ? ` ~ ${s.originalDateRange.end}` : ''}`
                        : '';
                    lines.push(`\n### ${idx + 1}. ${s.title}${dateText}`);
                    lines.push(String(s.content || '').trim());
                });
            });
            return hasAny ? lines.join('\n') : '';
        },

        /** 校验层级周期约束(暴露给 UI 用) */
        validateCycleConstraints,

        /** 默认层级定义(暴露给 UI 用) */
        DEFAULT_LEVELS,

        /** 预热钩子(目前 noop) */
        async hydrate() { /* no-op */ },
    };
}

/**
 * 从概要数组里提取日期范围(取最早 generatedAt 和最晚 generatedAt,转 YYYY-MM-DD)
 */
function _extractDateRange(summaries) {
    const list = Array.isArray(summaries) ? summaries : [];
    if (list.length === 0) return { range: { start: '', end: '' }, dates: [] };
    const tsList = list.map((s) => Number(s.generatedAt) || 0).filter((t) => t > 0).sort((a, b) => a - b);
    const startTs = tsList[0] || 0;
    const endTs = tsList[tsList.length - 1] || 0;
    const toDateKey = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    return {
        range: { start: toDateKey(startTs), end: toDateKey(endTs) },
        dates: list.map((s) => toDateKey(Number(s.generatedAt) || 0)).filter(Boolean),
    };
}

/**
 * 格式化日期范围做标题后缀
 */
function _formatRange(summaries) {
    const { range } = _extractDateRange(summaries || []);
    if (!range.start) return '';
    if (range.start === range.end) return range.start;
    return `${range.start} ~ ${range.end}`;
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
            console.warn('[memorySummaries] SDK 未就绪,所有 API 返回 null/空数组');
        };
    })();
    return {
        getConfig: () => ({ version: CONFIG_VERSION, levels: _sortLevels(DEFAULT_LEVELS.map((l) => ({ ...l }))) }),
        setLevels: async () => ({ ok: false, error: 'SDK 未就绪' }),
        addLevel: async () => ({ ok: false, error: 'SDK 未就绪' }),
        removeLevel: async () => ({ ok: false, error: 'SDK 未就绪' }),
        updateLevelCycle: async () => ({ ok: false, error: 'SDK 未就绪' }),
        list: () => { _warnOnce(); return []; },
        listByLevel: () => { _warnOnce(); return { L1: [], L2: [], L3: [], L4: [] }; },
        listAvailableForLayer: () => { _warnOnce(); return []; },
        get: () => { _warnOnce(); return null; },
        add: async () => { _warnOnce(); return null; },
        update: async () => { _warnOnce(); return null; },
        remove: async () => false,
        setActive: async () => { _warnOnce(); return null; },
        setOrder: async () => { _warnOnce(); return []; },
        generateLevelSummary: async () => ({ ok: false, error: 'SDK 未就绪' }),
        buildPlaceholderFromLowerLevel: () => ({ title: '占位', content: '[占位]', messageCount: 0, dateRange: { start: '', end: '' } }),
        buildMemoryContext: () => '',
        validateCycleConstraints,
        DEFAULT_LEVELS,
        hydrate: async () => {},
    };
}