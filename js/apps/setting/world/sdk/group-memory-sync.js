/**
 * settings-sdk · chat-app 「群聊记忆互通」SDK (v0.87)
 *
 *   业务含义:
 *     用户在「我的 → 群聊记忆互通」开关 + 选择互通的 AI 名单 + 给每个 AI 配置
 *     「读几条今天的群聊回合 + 读几条往期群聊概要」。开启时,该 AI 的私聊回复
 *     提示词区域会出现群聊的记忆(类似旧 chat.js 的 `groupMemorySync` 行为)。
 *
 *   数据模型(双层):
 *     - user.groupMemorySync 顶层字段(挂在 user 上,所有 AI 共享的总开关 + 默认名单)
 *       {
 *         enabled: boolean            // 总开关
 *         aiIds: string[]             // 选定的 AI 人设 id 列表
 *       }
 *     - aiPerson.groupMemorySyncConfig 顶层字段(每个 AI 单独的配置)
 *       {
 *         enabled: boolean            // 单 AI 是否参与(必须总开关 + 这个开关都开才注入)
 *         contextRounds: number       // 读几条今天的群聊回合(0~50,默认 8)
 *         summaryReadCount: number    // 读几条往期群聊概要(0~10,默认 3)
 *         updatedAt: number
 *       }
 *
 *   API:
 *     getGlobalConfig(user)                          -> { enabled, aiIds }
 *     setGlobalConfig(user, patch)                   -> Promise<cfg>
 *     toggleGlobal(user)                             -> Promise<cfg>
 *     addAi(user, aiPersonId)                        -> Promise<cfg>
 *     removeAi(user, aiPersonId)                     -> Promise<cfg>
 *
 *     getAiConfig(aiPersonId)                        -> { enabled, contextRounds, summaryReadCount }
 *     setAiConfig(aiPersonId, patch)                 -> Promise<cfg>
 *     toggleAi(aiPersonId)                           -> Promise<cfg>
 *     setAiContextRounds(aiPersonId, rounds)         -> Promise<cfg>
 *     setAiSummaryReadCount(aiPersonId, count)       -> Promise<cfg>
 *
 *     isAiEnabled(user, aiPersonId)                  -> boolean
 *     listEnabledAiIds(user)                         -> string[]
 *
 *   集成:
 *     - prompt-builder 调用 `sdk.groupMemorySync.listEnabledAiIds(user)` + 对每个
 *       启用的 AI 调 `getAiConfig(aiPersonId)`,渲染「[群聊记忆] xxx 群最近 N 条
 *       + M 条概要」段,拼到 systemPrompt。
 *
 *   关闭路径:
 *     - 总开关 enabled=false → listEnabledAiIds 返回空 → 不渲染
 *     - 单 AI enabled=false → 该 AI 不出现在 listEnabledAiIds → 不注入
 *     - 故事模式 → 不调用(对应旧 chat.js 也是 story 模式不注入)
 *
 *   设计要点:
 *     - 跟其他 SDK 保持一致:无新表/新 store,数据挂在 user / aiPerson 顶层,
 *       走 mergePatch 自动深合并
 *     - 不抛异常:user/aiPerson 缺失只 warn,API 返回空
 *     - hydrate 是 no-op(数据已在 users/aiPersons hydrate 时一起加载)
 */
import { SDK_STORES } from './defaults.js';

const DEFAULT_GLOBAL = Object.freeze({
    enabled: false,
    aiIds: [],
});

const DEFAULT_AI = Object.freeze({
    enabled: true,
    contextRounds: 8,
    summaryReadCount: 3,
});

function _now() {
    return Date.now();
}

function _normalizeGlobal(raw) {
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_GLOBAL };
    return {
        enabled: !!raw.enabled,
        aiIds: Array.isArray(raw.aiIds) ? raw.aiIds.slice() : [],
    };
}

function _normalizeAi(raw) {
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_AI };
    const cr = Number(raw.contextRounds);
    const sr = Number(raw.summaryReadCount);
    return {
        enabled: raw.enabled !== false,
        contextRounds: Number.isFinite(cr) && cr >= 0 && cr <= 50 ? Math.floor(cr) : DEFAULT_AI.contextRounds,
        summaryReadCount: Number.isFinite(sr) && sr >= 0 && sr <= 10 ? Math.floor(sr) : DEFAULT_AI.summaryReadCount,
    };
}

/**
 * 给定 sdk,构造 groupMemorySync API。
 * @param {object} sdk settingsSdk 实例
 * @returns {object}
 */
export function createGroupMemorySyncApi(sdk) {
    if (!sdk || !sdk.users || !sdk.aiPersons) {
        console.warn('[groupMemorySync] sdk.users/aiPersons 缺失,API 返回空操作');
        return _emptyApi();
    }

    const _getUser = (userId) => {
        if (!userId) return null;
        if (typeof userId === 'object') return userId;
        return sdk.users.get(userId) || null;
    };

    const _readGlobal = (user) => {
        if (!user) return { ...DEFAULT_GLOBAL };
        return _normalizeGlobal(user.groupMemorySync);
    };

    const _getAi = (aiPersonId) => {
        if (!aiPersonId) return null;
        return sdk.aiPersons.get(aiPersonId) || null;
    };

    const _readAi = (ai) => {
        if (!ai) return { ...DEFAULT_AI };
        return _normalizeAi(ai.groupMemorySyncConfig);
    };

    return {
        /**
         * 读全局配置(总开关 + 选定的 AI 名单)
         * @param {object|string} user
         * @returns {{ enabled: boolean, aiIds: string[] }}
         */
        getGlobalConfig(user) {
            return _readGlobal(_getUser(user));
        },

        /**
         * 写全局配置(merge patch)。支持 enabled / aiIds / 任意子字段。
         * @param {object|string} user
         * @param {object} patch
         */
        async setGlobalConfig(user, patch = {}) {
            const u = _getUser(user);
            if (!u) {
                console.warn('[groupMemorySync.setGlobalConfig] user 不存在');
                return { ...DEFAULT_GLOBAL };
            }
            const cur = _readGlobal(u);
            const next = {
                enabled: patch.enabled !== undefined ? !!patch.enabled : cur.enabled,
                aiIds: Array.isArray(patch.aiIds) ? patch.aiIds.slice() : cur.aiIds,
            };
            await sdk.users.update(u.id, {
                groupMemorySync: next,
            });
            return next;
        },

        /**
         * 切换总开关(并自动保 aiIds 不变)
         */
        async toggleGlobal(user) {
            const u = _getUser(user);
            if (!u) return { ...DEFAULT_GLOBAL };
            const cur = _readGlobal(u);
            return this.setGlobalConfig(u, { enabled: !cur.enabled });
        },

        /**
         * 把某个 AI 加入互通名单(去重)
         */
        async addAi(user, aiPersonId) {
            const u = _getUser(user);
            if (!u || !aiPersonId) return _readGlobal(u);
            const cur = _readGlobal(u);
            if (cur.aiIds.includes(aiPersonId)) return cur;
            return this.setGlobalConfig(u, { aiIds: [...cur.aiIds, aiPersonId] });
        },

        /**
         * 从互通名单里移除某个 AI
         */
        async removeAi(user, aiPersonId) {
            const u = _getUser(user);
            if (!u || !aiPersonId) return _readGlobal(u);
            const cur = _readGlobal(u);
            const next = cur.aiIds.filter((id) => id !== aiPersonId);
            if (next.length === cur.aiIds.length) return cur;
            return this.setGlobalConfig(u, { aiIds: next });
        },

        /**
         * 读某个 AI 的单 AI 配置
         */
        getAiConfig(aiPersonId) {
            return _readAi(_getAi(aiPersonId));
        },

        /**
         * 写某个 AI 的配置(merge patch)
         * @param {string} aiPersonId
         * @param {object} patch   { enabled?, contextRounds?, summaryReadCount? }
         */
        async setAiConfig(aiPersonId, patch = {}) {
            const ai = _getAi(aiPersonId);
            if (!ai) {
                console.warn('[groupMemorySync.setAiConfig] aiPerson 不存在:', aiPersonId);
                return { ...DEFAULT_AI };
            }
            const cur = _readAi(ai);
            const nextPatch = {};
            if (patch.enabled !== undefined) nextPatch.enabled = !!patch.enabled;
            if (patch.contextRounds !== undefined) {
                const cr = Number(patch.contextRounds);
                nextPatch.contextRounds = Number.isFinite(cr) && cr >= 0 && cr <= 50
                    ? Math.floor(cr) : cur.contextRounds;
            }
            if (patch.summaryReadCount !== undefined) {
                const sr = Number(patch.summaryReadCount);
                nextPatch.summaryReadCount = Number.isFinite(sr) && sr >= 0 && sr <= 10
                    ? Math.floor(sr) : cur.summaryReadCount;
            }
            const next = { ...cur, ...nextPatch, updatedAt: _now() };
            await sdk.aiPersons.update(aiPersonId, {
                groupMemorySyncConfig: next,
            });
            return next;
        },

        /**
         * 切换某个 AI 的 enabled 开关
         */
        async toggleAi(aiPersonId) {
            const ai = _getAi(aiPersonId);
            if (!ai) return { ...DEFAULT_AI };
            const cur = _readAi(ai);
            return this.setAiConfig(aiPersonId, { enabled: !cur.enabled });
        },

        /**
         * 单独更新 contextRounds
         */
        async setAiContextRounds(aiPersonId, rounds) {
            return this.setAiConfig(aiPersonId, { contextRounds: rounds });
        },

        /**
         * 单独更新 summaryReadCount
         */
        async setAiSummaryReadCount(aiPersonId, count) {
            return this.setAiConfig(aiPersonId, { summaryReadCount: count });
        },

        /**
         * 判断某个 AI 是否应该被注入群聊记忆(总开关 + 单 AI 都开才 true)
         */
        isAiEnabled(user, aiPersonId) {
            const u = _getUser(user);
            if (!u || !aiPersonId) return false;
            const g = _readGlobal(u);
            if (!g.enabled) return false;
            if (!g.aiIds.includes(aiPersonId)) return false;
            const aiCfg = _readAi(_getAi(aiPersonId));
            return aiCfg.enabled !== false;
        },

        /**
         * 列出所有应当被注入群聊记忆的 AI id 列表
         */
        listEnabledAiIds(user) {
            const u = _getUser(user);
            if (!u) return [];
            const g = _readGlobal(u);
            if (!g.enabled) return [];
            const out = [];
            for (const aiId of g.aiIds) {
                const aiCfg = _readAi(_getAi(aiId));
                if (aiCfg.enabled !== false) out.push(aiId);
            }
            return out;
        },

        /**
         * 预热钩子(数据挂在 user/aiPerson 顶层,跟着 users/aiPersons 一起 hydrate)
         */
        async hydrate() { /* no-op */ },
    };
}

// ============================================================
// 兜底 API
// ============================================================
function _emptyApi() {
    const noop = async () => null;
    return {
        getGlobalConfig: () => ({ ...DEFAULT_GLOBAL }),
        setGlobalConfig: noop,
        toggleGlobal: noop,
        addAi: noop,
        removeAi: noop,
        getAiConfig: () => ({ ...DEFAULT_AI }),
        setAiConfig: noop,
        toggleAi: noop,
        setAiContextRounds: noop,
        setAiSummaryReadCount: noop,
        isAiEnabled: () => false,
        listEnabledAiIds: () => [],
        hydrate: async () => {},
    };
}

export { DEFAULT_GLOBAL, DEFAULT_AI, _normalizeGlobal, _normalizeAi };
export { SDK_STORES };