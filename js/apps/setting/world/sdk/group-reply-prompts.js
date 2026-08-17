/**
 * settings-sdk · chat-app 群聊回复提示词 SDK（v0.82）
 *
 * 业务含义:
 *   群聊是「多 AI 同台扮演」—— 同一个群聊下可能挂着 3~5 个 AI 人设,
 *   每个 AI 扮演不同角色。为了让群聊的回复也有「rpg 副本 / 角色设定 / 群氛围」
 *   这类定制,群聊需要单独的「回复提示词」池:挂群聊自己,所有 AI 共享。
 *
 *   与「私聊 replyPrompts」(挂在 aiPerson 顶层)对齐:
 *     - 私聊 → aiPerson.replyPrompts[]               → 只有 1 个 AI,挂在 AI 上够用
 *     - 群聊 → chatGroup.prompts[]                   → N 个 AI 共享,挂在群聊上
 *
 *   注入规则:群聊中所有启用的 prompt 全部注入,群内每个 AI 都看到同一份 pool
 *   (在 prompt-builder 里通过 sdk.groupReplyPrompts.listActive(groupId, mode) 拉取)。
 *
 * 数据模型:
 *   - 存储在 chatGroup.prompts[] 顶层字段(深合并友好)
 *   - 单条结构: { id, title, content, source, active, order, longBody?
 *                  sourceLibraryPromptId?, sourceStorySummaryId?, sourceStoryArchiveId?
 *                  createdAt, updatedAt }
 *     - 字段白名单完全复用 replyPrompts.js 的 PROMPT_FIELDS(同一种数据)
 *
 * API:
 *   list(user, groupId, mode)                                → Array<ReplyPrompt>            按 order 升序
 *   listActive(user, groupId, mode)                          → Array<ReplyPrompt>            仅 active=true
 *   get(user, groupId, mode, promptId)                       → ReplyPrompt | null
 *   add(user, groupId, mode, patch)                          → ReplyPrompt | null
 *   update(user, groupId, mode, promptId, patch)             → ReplyPrompt | null
 *   remove(user, groupId, mode, promptId)                    → boolean
 *   toggleActive(user, groupId, mode, promptId)              → ReplyPrompt | null
 *   setOrder(user, groupId, mode, promptIdsInOrder)         → Array<ReplyPrompt>
 *   hydrate()                                                → void(预热时由 settings app 调)
 *
 * 设计要点:
 *   - 挂在 chatGroup 顶层 → mergePatch 自动深合并,无需新表/新 store
 *   - 复用 sdk.chatGroups.update(user, groupId, mode, patch) 写盘
 *   - 不抛异常:不存在返回 null,传入非法 groupId/mode 只 warn
 *   - 字段白名单 = replyPrompts.js PROMPT_FIELDS(同一种业务对象,
 *     复用 replyPrompts.js 的 _normalize / _nextOrder 实现)。
 *   - 工具函数 + 接口命名风格 100% 对齐 replyPrompts.js,降低学习成本。
 *
 * 依赖:
 *   - sdk.chatGroups.get(user, groupId, mode)  读 + 校验
 *   - sdk.chatGroups.update(user, groupId, mode, patch)  写盘
 *   - 字段白名单 / _normalize / _nextOrder / _generateId 复用 reply-prompts.js
 */

import { _normalize, _nextOrder, _generateId, _sortByOrder } from './reply-prompts.js';

const _PROMPT_FIELDS_LIST = [
    'id', 'title', 'content', 'source', 'active', 'order', 'longBody',
    'sourceLibraryPromptId', 'sourcePath',
    'sourceStorySummaryId', 'sourceStoryArchiveId',
    'createdAt', 'updatedAt',
];

function _readList(group) {
    if (!group) return [];
    return Array.isArray(group.prompts) ? group.prompts : [];
}

/**
 * 给定 sdk,构造 groupReplyPrompts API。
 *
 * @param {object} sdk  window.settingsSdk 实例
 * @returns {object} groupReplyPrompts API
 */
export function createGroupReplyPromptsApi(sdk) {
    if (!sdk || !sdk.chatGroups) {
        console.warn('[groupReplyPrompts] sdk.chatGroups 缺失,API 返回空操作');
        return _emptyApi();
    }

    const _getGroup = (user, groupId, mode) => {
        if (!user || !groupId || !mode) return null;
        return sdk.chatGroups.get(user, groupId, mode) || null;
    };

    return {
        /** 读某群聊全部 prompts(按 order 升序) */
        list(user, groupId, mode) {
            const group = _getGroup(user, groupId, mode);
            return _sortByOrder(_readList(group));
        },

        /** 仅读 active=true 的子集(注入 prompt 用,直接按 order 拿) */
        listActive(user, groupId, mode) {
            return this.list(user, groupId, mode).filter((p) => p && p.active !== false);
        },

        /** 读单条 */
        get(user, groupId, mode, promptId) {
            const group = _getGroup(user, groupId, mode);
            const list = _readList(group);
            return list.find((p) => p && p.id === promptId) || null;
        },

        /**
         * 新增一条 prompt。
         * @param {object} user
         * @param {string} groupId
         * @param {'calendar'|'story'} mode
         * @param {object} patch  至少需要 title/content;可选 source/active/longBody
         * @returns {Promise<object|null>}
         */
        async add(user, groupId, mode, patch = {}) {
            const group = _getGroup(user, groupId, mode);
            if (!group) {
                console.warn('[groupReplyPrompts.add] 群聊不存在:', groupId, mode);
                return null;
            }
            if (!patch || !patch.title) {
                console.warn('[groupReplyPrompts.add] 缺少 title 字段');
                return null;
            }
            const t = Date.now();
            const list = _readList(group);
            const record = _normalize({
                id: patch.id || _generateId(),
                title: patch.title,
                content: patch.content || '',
                source: patch.source || 'custom',
                active: patch.active !== false,
                order: patch.order != null ? Number(patch.order) : _nextOrder(list),
                longBody: typeof patch.longBody === 'boolean' ? patch.longBody : undefined,
                createdAt: t,
                updatedAt: t,
            });
            const nextList = list.concat([record]);
            await sdk.chatGroups.update(user, groupId, mode, { prompts: nextList });
            return record;
        },

        /**
         * 更新一条 prompt。
         * @param {object} user
         * @param {string} groupId
         * @param {'calendar'|'story'} mode
         * @param {string} promptId
         * @param {object} patch
         * @returns {Promise<object|null>}
         */
        async update(user, groupId, mode, promptId, patch = {}) {
            const group = _getGroup(user, groupId, mode);
            if (!group) return null;
            const list = _readList(group);
            const idx = list.findIndex((p) => p && p.id === promptId);
            if (idx < 0) return null;
            const prev = list[idx];
            const merged = _normalize({
                ...prev,
                ...patch,
                id: prev.id,
                createdAt: prev.createdAt,
                updatedAt: Date.now(),
            });
            const nextList = list.slice();
            nextList[idx] = merged;
            await sdk.chatGroups.update(user, groupId, mode, { prompts: nextList });
            return merged;
        },

        /** 切换 active 状态 */
        async toggleActive(user, groupId, mode, promptId) {
            const cur = this.get(user, groupId, mode, promptId);
            if (!cur) return null;
            return this.update(user, groupId, mode, promptId, { active: !cur.active });
        },

        /**
         * 删除一条 prompt
         */
        async remove(user, groupId, mode, promptId) {
            const group = _getGroup(user, groupId, mode);
            if (!group) return false;
            const list = _readList(group);
            const next = list.filter((p) => p && p.id !== promptId);
            if (next.length === list.length) return false;
            await sdk.chatGroups.update(user, groupId, mode, { prompts: next });
            return true;
        },

        /**
         * 批量重排:按传入的 promptId 顺序写入 order。
         * 不在传入列表里的条目 order 不动,append 到末尾。
         */
        async setOrder(user, groupId, mode, promptIdsInOrder = []) {
            const group = _getGroup(user, groupId, mode);
            if (!group) return [];
            const list = _readList(group);
            const t = Date.now();
            const map = new Map(list.map((p) => [p.id, p]));
            const next = [];
            let order = 1;
            for (const pid of promptIdsInOrder) {
                const cur = map.get(pid);
                if (!cur) continue;
                next.push({ ...cur, order: order++, updatedAt: t });
                map.delete(pid);
            }
            for (const rest of map.values()) {
                next.push({ ...rest, order: order++, updatedAt: t });
            }
            await sdk.chatGroups.update(user, groupId, mode, { prompts: next });
            return _sortByOrder(next);
        },

        /** 预热钩子(数据挂在 chatGroup 顶层,跟着 chatGroups 一起 hydrate) */
        async hydrate() { /* no-op */ },
    };
}

// ============================================
// 兜底 API:sdk 缺失时返回空操作(避免业务代码因 SDK 未就绪而崩)
// ============================================
function _emptyApi() {
    const _warnOnce = (() => {
        let done = false;
        return () => {
            if (done) return;
            done = true;
            console.warn('[groupReplyPrompts] SDK 未就绪,所有 API 返回 null/空数组');
        };
    })();
    return {
        list: () => { _warnOnce(); return []; },
        listActive: () => { _warnOnce(); return []; },
        get: () => { _warnOnce(); return null; },
        add: async () => { _warnOnce(); return null; },
        update: async () => { _warnOnce(); return null; },
        toggleActive: async () => { _warnOnce(); return null; },
        remove: async () => { return false; },
        setOrder: async () => { _warnOnce(); return []; },
        hydrate: async () => {},
    };
}

// 显式导出字段白名单,供外面诊断 / 复用
export { _PROMPT_FIELDS_LIST };
