/**
 * settings-sdk · chat-app 朋友圈 SDK (v0.79)
 *
 * 业务含义:
 *   每个 AI 人设可以维护一份「自己发过的朋友圈」列表,以及为每条朋友圈附带一段概要。
 *   - 朋友圈原文(完整内容) → 用来在朋友圈列表页展示
 *   - 概要(AI 自动生成的简短描述) → 注入到 AI 的 systemPrompt,防止重复发相同主题,
 *     也节省 token 负担
 *
 * 数据模型(挂在 aiPerson 顶层):
 *   aiPerson.moments: Array<{
 *       id           string   唯一 id (mom-{ts}-{rand})
 *       content      string   朋友圈正文
 *       images       string[] 图片 URL/描述数组(可选)
 *       location     string   位置(可选)
 *       aiImages     Array<{description, cardColor, textColor}> AI 描述图(可选)
 *       timestamp    number   发布时间
 *       summary      string   概要(AI 自动生成,可能为空 — 表示尚未生成)
 *       summaryGeneratedAt number  概要生成时间
 *   }>
 *
 * 数据流:
 *   1) AI 在回复中输出 [发朋友圈:内容] token
 *   2) chat-asset-service.aiSendMoment 解析 token → 写完整朋友圈到 aiPerson.moments[]
 *      → 立即生成一条空 summary(待 LLM 生成)
 *   3) 后台异步 LLM 生成概要,填到 summary 字段
 *   4) prompt-builder 读 summary 注入到 systemPrompt
 *
 * 摘要生成策略:
 *   - 默认同步生成(避免延迟),失败回退到「空 summary」
 *   - 不读 aiPerson.moments[].content 全文(节省 token),只把最近 N 条的 summary 拼成「近期朋友圈概要」
 *   - 用户在 ai 设置页「可读取朋友圈」配置 N(默认 3)
 *
 * API:
 *   list(aiPersonId)                       → Array<MomentRecord>   全部朋友圈(按时间倒序)
 *   get(aiPersonId, momentId)              → MomentRecord | null
 *   add(aiPersonId, patch)                 → MomentRecord(已写入磁盘)
 *   update(aiPersonId, momentId, patch)    → MomentRecord | null
 *   remove(aiPersonId, momentId)           → boolean
 *   setSummary(aiPersonId, momentId, summary) → MomentRecord | null  写概要
 *   buildMomentsContext(aiPersonId, opts?) → string                 注入 prompt-builder 用
 *                                                opts.readCount       取最近 N 条
 *
 * 设计要点(参考 AGENTS.md §21/§37):
 *   - 挂在 aiPerson 顶层 → mergePatch 自动深合并,无需新表/新 store
 *   - 复用 aiPersons.update 写盘
 *   - 不抛异常,SDK 未就绪时返回空数组 / null
 *   - 用户朋友圈不归这里管,UI 侧存到 localStorage('xiaoting::user-moments-v1')
 */

import { SDK_STORES } from './defaults.js';

// ============================================================
// 字段白名单
// ============================================================
const MOMENT_FIELDS = new Set([
    'id',
    'content',
    'images',
    'location',
    'aiImages',
    'timestamp',
    'summary',
    'summaryGeneratedAt',
]);

function _generateId() {
    return `mom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function _now() {
    return Date.now();
}

function _normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    for (const k of MOMENT_FIELDS) {
        if (raw[k] !== undefined) out[k] = raw[k];
    }
    out.id = String(out.id || '');
    out.content = String(out.content || '');
    out.timestamp = Number(out.timestamp) || _now();
    if (!Array.isArray(out.images)) out.images = [];
    if (!Array.isArray(out.aiImages)) out.aiImages = [];
    out.summary = String(out.summary || '');
    out.summaryGeneratedAt = Number(out.summaryGeneratedAt) || 0;
    return out;
}

function _sortByTimeDesc(list) {
    return list.slice().sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
}

/**
 * 格式化相对时间(类似朋友圈本身的「几分钟前/几小时前」)
 */
function _formatRelative(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - Number(timestamp);
    if (diff < 0) return '刚刚';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(diff / 86400000);
    if (days < 7) return `${days} 天前`;
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// ============================================================
// 工厂
// ============================================================

/**
 * 给定 sdk,构造 moments API
 * @param {object} sdk  window.settingsSdk 实例
 */
export function createMomentsApi(sdk) {
    if (!sdk || !sdk.aiPersons) {
        console.warn('[moments] sdk.aiPersons 缺失,API 返回空操作');
        return _emptyApi();
    }

    const _getAiPerson = (aiPersonId) => {
        if (!aiPersonId) return null;
        return sdk.aiPersons.get(aiPersonId) || null;
    };

    const _readList = (person) => {
        if (!person) return [];
        const list = person.moments;
        return Array.isArray(list) ? list : [];
    };

    return {
        /** 读全部朋友圈(按时间倒序 — 最新的在前) */
        list(aiPersonId) {
            const person = _getAiPerson(aiPersonId);
            return _sortByTimeDesc(_readList(person));
        },

        /** 读单条 */
        get(aiPersonId, momentId) {
            const list = this.list(aiPersonId);
            return list.find((m) => m && m.id === momentId) || null;
        },

        /**
         * 新增一条朋友圈(用于 chat-asset-service.aiSendMoment)
         * @param {string} aiPersonId
         * @param {object} patch 至少需要 content,可选 images/location/aiImages/timestamp
         */
        async add(aiPersonId, patch = {}) {
            const person = _getAiPerson(aiPersonId);
            if (!person) {
                console.warn('[moments.add] aiPerson 不存在:', aiPersonId);
                return null;
            }
            if (!patch || !patch.content) {
                console.warn('[moments.add] 缺少 content 字段');
                return null;
            }
            const t = _now();
            const list = _readList(person);
            const record = _normalize({
                id: patch.id || _generateId(),
                content: patch.content,
                images: Array.isArray(patch.images) ? patch.images : [],
                location: patch.location || '',
                aiImages: Array.isArray(patch.aiImages) ? patch.aiImages : [],
                timestamp: patch.timestamp != null ? Number(patch.timestamp) : t,
                summary: '',
                summaryGeneratedAt: 0,
            });
            const nextList = list.concat([record]);
            await sdk.aiPersons.update(aiPersonId, { moments: nextList });
            return record;
        },

        /**
         * 更新朋友圈(全文编辑或图片增删)
         */
        async update(aiPersonId, momentId, patch = {}) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return null;
            const list = _readList(person);
            const idx = list.findIndex((m) => m && m.id === momentId);
            if (idx < 0) return null;
            const prev = list[idx];
            const merged = _normalize({
                ...prev,
                ...patch,
                id: prev.id,
            });
            const nextList = list.slice();
            nextList[idx] = merged;
            await sdk.aiPersons.update(aiPersonId, { moments: nextList });
            return merged;
        },

        /**
         * 删除一条朋友圈(用户从朋友圈列表里手动删)
         */
        async remove(aiPersonId, momentId) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return false;
            const list = _readList(person);
            const next = list.filter((m) => m && m.id !== momentId);
            if (next.length === list.length) return false;
            await sdk.aiPersons.update(aiPersonId, { moments: next });
            return true;
        },

        /**
         * 写入概要(由 chat-asset-service 在 AI 生成概要后回调)
         * - 不变更 timestamp / content(只填 summary 字段)
         */
        async setSummary(aiPersonId, momentId, summary) {
            return this.update(aiPersonId, momentId, {
                summary: String(summary || ''),
                summaryGeneratedAt: _now(),
            });
        },

        /**
         * ★ 拼装 AI 朋友圈概要上下文(给 prompt-builder 注入用)
         * @param {string} aiPersonId
         * @param {object} [opts]
         * @param {number} [opts.readCount=3] 取最近 N 条概要
         * @returns {string} 注入文本(空字符串表示没有概要可注入)
         */
        buildMomentsContext(aiPersonId, opts = {}) {
            const person = _getAiPerson(aiPersonId);
            if (!person) return '';
            const list = _sortByTimeDesc(_readList(person));
            // 只取有概要的(AI 异步生成的,可能为空)
            const withSummary = list.filter((m) => m && m.summary);
            if (withSummary.length === 0) return '';
            const readCount = Math.max(0, Number(opts.readCount) || 3);
            const picked = withSummary.slice(0, readCount);
            if (picked.length === 0) return '';
            const lines = [
                `# AI 朋友圈概要(最近 ${picked.length} 条,你在生成回复时可以参考)`,
                '',
                '> 每条概要包含发布时间(相对时间)+ 概要正文。系统会**自动生成**概要,你看不到用户看到的完整朋友圈原文。',
                '> 用途:防止重复主题 + 维持人设一致性。',
                '',
            ];
            picked.forEach((m, i) => {
                const t = _formatRelative(m.timestamp);
                const imgHint = m.images && m.images.length > 0
                    ? ` [配图 ${m.images.length} 张]`
                    : (m.aiImages && m.aiImages.length > 0 ? ` [AI 描述图 ${m.aiImages.length} 张]` : '');
                lines.push(`[${i + 1}] (${t})${imgHint} ${m.summary}`);
            });
            return lines.join('\n');
        },

        /**
         * 预热钩子(目前不做事,数据挂在 aiPerson 顶层跟着 aiPersons 一起 hydrate)
         */
        async hydrate() { /* no-op */ },
    };
}

// ============================================================
// 兜底 API:sdk 缺失时返回空操作
// ============================================================
function _emptyApi() {
    const _warnOnce = (() => {
        let done = false;
        return () => {
            if (done) return;
            done = true;
            console.warn('[moments] SDK 未就绪,所有 API 返回 null/空数组');
        };
    })();
    return {
        list: () => { _warnOnce(); return []; },
        get: () => { _warnOnce(); return null; },
        add: async () => { _warnOnce(); return null; },
        update: async () => { _warnOnce(); return null; },
        remove: async () => { return false; },
        setSummary: async () => { _warnOnce(); return null; },
        buildMomentsContext: () => '',
        hydrate: async () => {},
    };
}

// 暴露格式化函数给上层用(朋友圈详情/概要预览)
export { _formatRelative as formatRelativeMoment };

export { SDK_STORES };