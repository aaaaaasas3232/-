/**
 * ★ v0.61.3+ chat-app 上下文长度配置 SDK
 *   (前身是 rollingSummaries,但 K 链相关 API 已于 2026-08-09 全部移除;
 *    字段名保留 "rollingConfig" 是因为已存储在 aiPerson.socialProfiles.chat.rollingConfig 里,
 *    改字段名要写迁移代码,不划算)
 *
 * 数据挂载位置:
 *   aiPerson.socialProfiles.chat.rollingConfig
 *
 *   {
 *     contextRounds: number  // C 窗口大小(单位:回合),默认 20
 *                         // 1 回合 = 1 组用户消息 + 1 组 AI 消息
 *     // (K 链时代还有 enabled / style / kMergeSize / maxChainLength,
 *     //  K 链移除后只有 contextRounds 还在用;老字段写入仍容忍,读出来直接丢弃)
 *   }
 *
 * API:
 *   getRollingConfig(aiPersonId) -> { contextRounds, ...默认 }
 *   setRollingConfig(aiPersonId, patch) -> Promise<{contextRounds, ...}>
 *
 * 设计意图:
 *   - 不再有「K 链」这种周期性压缩归纳机制
 *   - 想控制「当前上下文最多能塞多少回合」,UI 改 contextRounds 即可
 *   - 后续如果再加类似机制,会起新 SDK 文件,不再依赖本文件
 */

const DEFAULT_CONFIG = Object.freeze({
    contextRounds: 20,
});

/**
 * 给定 sdk,构造极简版 chat-window-config API。
 *   - 仅暴露 getRollingConfig / setRollingConfig
 *   - 内部走 sdk.aiPersons.update 落盘(沿用原 rollingSummaries 的写法)
 *
 * @param {object} sdk   settingsSdk 实例
 * @returns {object}     { getRollingConfig, setRollingConfig }
 */
export function createChatWindowConfigApi(sdk) {
    if (!sdk || !sdk.aiPersons) {
        console.warn('[chat-window-config] sdk.aiPersons 缺失,API 返回空操作');
        return {
            getRollingConfig: () => ({ ...DEFAULT_CONFIG }),
            setRollingConfig: async () => ({ ...DEFAULT_CONFIG }),
        };
    }

    const _getAiPerson = (aiPersonId) => {
        if (!aiPersonId) return null;
        return sdk.aiPersons.get(aiPersonId) || null;
    };

    return {
        /**
         * 读当前 AI 人设的上下文长度配置
         *   - 字段缺失时返回 DEFAULT_CONFIG(contextRounds: 20)
         *   - 老字段(enabled / style / kMergeSize / maxChainLength)仍在 JSON 里,
         *     这里读出来直接丢弃,不影响 contextRounds
         */
        getRollingConfig(aiPersonId) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return { ...DEFAULT_CONFIG };
            const cfg = person.socialProfiles?.chat?.rollingConfig;
            if (!cfg || typeof cfg !== 'object') return { ...DEFAULT_CONFIG };
            return {
                ...DEFAULT_CONFIG,
                contextRounds: Number(cfg.contextRounds) || DEFAULT_CONFIG.contextRounds,
            };
        },

        /**
         * 写入上下文长度配置(异步,落盘到 aiPerson.socialProfiles.chat.rollingConfig)
         *   - 走 sdk.aiPersons.update + mergePatch 深合并,保留老字段
         *   - patch 里只支持 contextRounds(其它字段会被静默忽略,避免误启用 K 链老字段)
         */
        async setRollingConfig(aiPersonId, patch = {}) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return null;
            const cur = this.getRollingConfig(aiPersonId);
            const next = {
                ...cur,
                ...(Number.isFinite(Number(patch?.contextRounds))
                    ? { contextRounds: Number(patch.contextRounds) }
                    : {}),
            };
            await sdk.aiPersons.update(aiPersonId, {
                socialProfiles: {
                    ...person.socialProfiles,
                    chat: {
                        ...(person.socialProfiles?.chat || {}),
                        rollingConfig: next,
                    },
                },
            });
            return next;
        },
    };
}
