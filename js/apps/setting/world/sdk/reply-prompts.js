/**
 * settings-sdk · chat-app 回复提示词 SDK（v0.50）
 *
 * 业务含义:
 *   每个 AI 人设可以挂 0~N 条「回复提示词」—— 用于 AI SDK 在生成回复前注入到
 *   system prompt,告诉 AI「用这个风格回 / 这样分句 / 别说某某话题 / 优先调用
 *   特殊动作」等等。回复提示词与「人设本体(8字段)」不同,人设本体描述「是谁」,
 *   回复提示词描述「这次怎么回」。
 *
 * 数据模型:
 *   - 存储在 aiPerson.replyPrompts 顶层字段(深合并友好)
 *   - 单条结构: { id, title, content, source, active, order, longBody?, createdAt, updatedAt }
 *       id        string    唯一 id(rp-{ts}-{rand})
 *       title     string    短标题(列表显示用)
 *       content   string    完整 prompt 正文(注入 system prompt 用)
 *       source    string    来源软件 id(人设空间/聊天记录/天气/日程/朋友圈/相册/音乐/自定义)
 *       active    boolean   是否进入当前上下文(true = 注入 prompt / false = 仅作备份)
 *       order     number    注入顺序(越小越靠前,prompt builder 按此排序)
 *       longBody  boolean?  列表渲染时是否默认折叠(content 较长时 UI 折叠,后续接)
 *       createdAt number
 *       updatedAt number
 *
 * API:
 *   list(aiPersonId)                          → Array<ReplyPrompt>            按 order 升序
 *   listActive(aiPersonId)                    → Array<ReplyPrompt>            仅 active=true,按 order
 *   get(aiPersonId, promptId)                 → ReplyPrompt | null
 *   add(aiPersonId, patch)                    → ReplyPrompt(已写入磁盘)
 *   update(aiPersonId, promptId, patch)       → ReplyPrompt | null
 *   remove(aiPersonId, promptId)              → boolean
 *   toggleActive(aiPersonId, promptId)        → ReplyPrompt | null
 *   setOrder(aiPersonId, promptIdsInOrder)    → Array<ReplyPrompt>            按传入顺序重排
 *   hydrate()                                 → void(预热时由 settings app 调)
 *
 * 设计要点:
 *   - 挂在 aiPerson 顶层 → mergePatch 自动深合并,无需新表/新 store
 *   - 复用 aiPersons.update 写盘,自带 bump('aiPersons', 'update', payload)
 *   - 不抛异常:不存在返回 null,传入非法 aiPersonId 也只 warn
 *   - 工具函数 `_nextOrder(list)` 保证新增条目 order 不撞
 *   - 与 prompt-db(prompt_db 独立库)完全独立——chat-app 这条链路是「AI 人设自己的
 *     prompt 列表」,不进 prompt Library 编辑器。后续 v0.51 可加 promptLibrary 联动:
 *     把 promptLibrary 条目「绑定」进 aiPerson.replyPrompts(只读副本)。
 *
 * 依赖:
 *   - toolkit.db.put(SDK_STORES.aiPersons, record)  间接通过 aiPersons.update
 *   - 不需要 toolkit.db 直接调用,全部走 sdk.aiPersons.update
 */

import { SDK_STORES } from './defaults.js';

// ============================================
// 字段白名单:防止 add/update 时把垃圾字段塞进 aiPerson
// ============================================
const PROMPT_FIELDS = new Set([
    'id', 'title', 'content', 'source', 'active', 'order', 'longBody',
    'sourceLibraryPromptId', 'sourcePath',
    'createdAt', 'updatedAt',
]);

function _generateId() {
    return `rp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function _now() {
    return Date.now();
}

function _nextOrder(list) {
    if (!Array.isArray(list) || list.length === 0) return 1;
    let max = 0;
    for (const p of list) {
        const o = Number(p && p.order);
        if (Number.isFinite(o) && o > max) max = o;
    }
    return max + 1;
}

function _normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    for (const k of PROMPT_FIELDS) {
        if (raw[k] !== undefined) out[k] = raw[k];
    }
    // 必填字段兜底
    out.id = String(out.id || '');
    out.title = String(out.title || '未命名提示词');
    out.content = String(out.content || '');
    out.source = String(out.source || 'custom');
    out.active = out.active !== false;
    out.order = Number(out.order) || 1;
    if (typeof out.longBody === 'boolean') out.longBody = out.longBody;
    out.createdAt = Number(out.createdAt) || _now();
    out.updatedAt = Number(out.updatedAt) || out.createdAt;
    return out;
}

function _sortByOrder(list) {
    return list.slice().sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

// ============================================
// 工厂
// ============================================

/**
 * 给定 sdk,构造 replyPrompts API。
 *
 * @param {object} sdk  window.settingsSdk 实例
 * @returns {object} replyPrompts API
 */
export function createReplyPromptsApi(sdk) {
    if (!sdk || !sdk.aiPersons) {
        console.warn('[replyPrompts] sdk.aiPersons 缺失,API 返回空操作');
        return _emptyApi();
    }

    const _getAiPerson = (aiPersonId) => {
        if (!aiPersonId) return null;
        const person = sdk.aiPersons.get(aiPersonId);
        return person || null;
    };

    const _readList = (person) => {
        if (!person) return [];
        const list = person.replyPrompts;
        return Array.isArray(list) ? list : [];
    };

    return {
        /** 读某 AI 人设的全部 replyPrompts(按 order 升序) */
        list(aiPersonId) {
            const person = _getAiPerson(aiPersonId);
            return _sortByOrder(_readList(person));
        },

        /** 仅读 active=true 的子集(注入 prompt 用,直接按 order 拿) */
        listActive(aiPersonId) {
            return this.list(aiPersonId).filter((p) => p && p.active !== false);
        },

        /** 读单条 */
        get(aiPersonId, promptId) {
            const person = _getAiPerson(aiPersonId);
            const list = _readList(person);
            return list.find((p) => p && p.id === promptId) || null;
        },

        /**
         * 新增一条 replyPrompt。
         * @param {string} aiPersonId
         * @param {object} patch  至少需要 title/content;可选 source/active/longBody
         * @returns {Promise<object|null>} 新写入的 record
         */
        async add(aiPersonId, patch = {}) {
            const person = _getAiPerson(aiPersonId);
            if (!person) {
                console.warn('[replyPrompts.add] aiPerson 不存在:', aiPersonId);
                return null;
            }
            if (!patch || !patch.title) {
                console.warn('[replyPrompts.add] 缺少 title 字段');
                return null;
            }
            const t = _now();
            const list = _readList(person);
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
            await sdk.aiPersons.update(aiPersonId, { replyPrompts: nextList });
            return record;
        },

        /**
         * 更新一条 replyPrompt。
         * @param {string} aiPersonId
         * @param {string} promptId
         * @param {object} patch    支持 title/content/source/active/order/longBody
         * @returns {Promise<object|null>}
         */
        async update(aiPersonId, promptId, patch = {}) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return null;
            const list = _readList(person);
            const idx = list.findIndex((p) => p && p.id === promptId);
            if (idx < 0) return null;
            const prev = list[idx];
            // 字段级合并,只覆盖传入的字段
            const merged = _normalize({
                ...prev,
                ...patch,
                id: prev.id,
                createdAt: prev.createdAt,
                updatedAt: _now(),
            });
            const nextList = list.slice();
            nextList[idx] = merged;
            await sdk.aiPersons.update(aiPersonId, { replyPrompts: nextList });
            return merged;
        },

        /**
         * 切换 active 状态(单独 API 方便 UI 调用)
         */
        async toggleActive(aiPersonId, promptId) {
            const cur = this.get(aiPersonId, promptId);
            if (!cur) return null;
            return this.update(aiPersonId, promptId, { active: !cur.active });
        },

        /**
         * 删除一条 replyPrompt
         */
        async remove(aiPersonId, promptId) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return false;
            const list = _readList(person);
            const next = list.filter((p) => p && p.id !== promptId);
            if (next.length === list.length) return false;
            await sdk.aiPersons.update(aiPersonId, { replyPrompts: next });
            return true;
        },

        /**
         * 批量重排:按传入的 promptId 顺序写入 order。
         * 不在传入列表里的条目 order 不动,append 到末尾。
         */
        async setOrder(aiPersonId, promptIdsInOrder = []) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return [];
            const list = _readList(person);
            const t = _now();
            const map = new Map(list.map((p) => [p.id, p]));
            const next = [];
            let order = 1;
            for (const pid of promptIdsInOrder) {
                const cur = map.get(pid);
                if (!cur) continue;
                next.push({ ...cur, order: order++, updatedAt: t });
                map.delete(pid);
            }
            // 剩余的 append 末尾
            for (const rest of map.values()) {
                next.push({ ...rest, order: order++, updatedAt: t });
            }
            await sdk.aiPersons.update(aiPersonId, { replyPrompts: next });
            return _sortByOrder(next);
        },

        /**
         * 给 AI 人设写入「当前激活的 promptIds 数组」(兼容旧 replyPromptIds 字段)。
         * 留作迁移用,新代码应优先用 add/update。
         */
        async setActiveIds(aiPersonId, activeIds = []) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return;
            const list = _readList(person);
            const idSet = new Set(activeIds);
            const next = list.map((p) => ({ ...p, active: idSet.has(p.id) }));
            await sdk.aiPersons.update(aiPersonId, {
                replyPrompts: next,
                replyPromptIds: activeIds.slice(),
            });
        },

        /**
         * 预热钩子(目前不做事,数据挂在 aiPerson 顶层跟着 aiPersons 一起 hydrate)
         */
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
            console.warn('[replyPrompts] SDK 未就绪,所有 API 返回 null/空数组');
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
        setActiveIds: async () => {},
        hydrate: async () => {},
    };
}

// 显式导出 SDK_STORES 让外面能看到依赖(后续诊断用)
export { SDK_STORES };
