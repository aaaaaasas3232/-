/**
 * settings-sdk · 第三方 App Prompt 注册 SDK（v0.61.5）
 *
 *   业务含义：其他 App（音乐 / 天气 / 未来 N 个 App）可以通过这套 SDK
 *   把自家的"特殊卡片提示词"注册到 chat-app，让用户在 prompt-manager
 *   详情页里看到、启用、编辑、预览。
 *
 *   数据模型（混合方案）：
 *     - **注册表**：内存 Map（settingsSdk._appPromptRegistry）
 *         - 卸载 App → 内存注册清空
 *         - 重装 App → App 启动时重新调 `register()`
 *     - **用户状态**：IndexedDB 新表 `appPromptStates`（永久持久化）
 *         - 用户编辑过的 content / 启停状态 / order 永久保留
 *         - app 重装后 register() 自动从 appPromptStates 恢复
 *
 *   单条 state 字段：
 *     key             string    `${appId}::${promptId}`，IndexedDB keyPath
 *     appId           string
 *     promptId        string
 *     active          boolean   是否注入到 AI prompt（默认从 register.defaultActive 取）
 *     content         string    用户编辑后的 content（默认从 register.content 取）
 *     order           number    注入顺序（默认从 register.defaultOrder 取）
 *     customPreviewData object|null 用户自定义预览数据（默认 null = 用 register.previewData）
 *     updatedAt       number
 *
 *   API：
 *     register(spec)                 注册一条（memory only，同 appId+promptId 覆盖）
 *     unregister(appId, promptId)    注销一条（仅清内存注册表，不删 state）
 *     list()                         所有已注册条目（含 state）
 *     listByApp(appId)               按 appId 过滤
 *     get(appId, promptId)           单条（含合并后的 state）
 *     getState(appId, promptId)      仅读 IndexedDB state（无则 null）
 *     setState(appId, promptId, patch) 更新 state（async，落盘）
 *     removeState(appId, promptId)   清掉 state（不影响 register 表）
 *     hydrate()                       从 db 加载 state 到内存 cache
 *
 *   设计要点：
 *     - register 同步写内存（不阻塞），后续 setState 异步落盘
 *     - fire-and-forget：调用 register 的 App 不需要 await
 *     - 写入失败不影响渲染，state 缺失时回退到 register 默认值
 *     - 不抛异常：参数缺失 / SDK 未就绪都静默跳过（业务代码 race 安全）
 *
 * 依赖：
 *   - toolkit.db.put/getAll/remove（间接通过 createPersister）
 *   - 不依赖其他 SDK API
 */

import { SDK_STORES } from './defaults.js';
import { createPersister, loadFromDb } from './helpers.js';

// ============================================
// 内部：state 合并（register defaults → IndexedDB state 覆盖）
// ============================================
function _mergeState(registration, state) {
    if (!registration) return null;
    const out = { ...registration };
    if (state) {
        if (state.active !== undefined) out.active = !!state.active;
        if (state.content !== undefined) out.content = String(state.content || '');
        if (state.order !== undefined && Number.isFinite(Number(state.order))) {
            out.order = Number(state.order);
        }
        if (state.customPreviewData !== undefined) {
            out.customPreviewData = state.customPreviewData;
        }
        if (state.updatedAt) out.updatedAt = state.updatedAt;
    }
    return out;
}

function _now() {
    return Date.now();
}

function _normalizeRegistration(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const appId = String(raw.appId || '').trim();
    const promptId = String(raw.promptId || '').trim();
    if (!appId || !promptId) return null;
    const t = _now();
    return {
        appId,
        promptId,
        label: String(raw.label || promptId),
        content: String(raw.content || ''),
        category: String(raw.category || 'special-action'),
        previewType: ['text', 'music-card', 'red-packet-card', 'location-card'].includes(raw.previewType)
            ? raw.previewType
            : 'text',
        previewData: raw.previewData && typeof raw.previewData === 'object' ? raw.previewData : null,
        active: raw.defaultActive !== false,
        order: Number.isFinite(Number(raw.defaultOrder)) ? Number(raw.defaultOrder) : 100,
        registeredAt: t,
        updatedAt: t,
    };
}

function _keyOf(appId, promptId) {
    return `${appId}::${promptId}`;
}

/**
 * 给定上下文构造 appPrompts API。
 *
 * @param {object} ctx
 * @param {object} ctx.toolkit    App toolkit（提供 db.put/get/getAll/remove）
 * @param {object} ctx.cache      cache.appPromptStates（Map 实例，可选）
 * @param {object} [ctx.events]   可选：event bus
 * @param {Function} [ctx.bump]   可选：scope 变更通知（bump(scope, action, payload)）
 * @returns {object} appPrompts API（含内存注册表挂在 _registry）
 */
export function createAppPromptsApi({ toolkit, cache, events, bump }) {
    // 内存注册表（不持久化，app 卸载清空，app 重启时重新 register）
    const registry = new Map();   // key: `${appId}::${promptId}`  value: registration
    // state cache（IndexedDB 的内存镜像）
    const stateCache = cache?.appPromptStates instanceof Map
        ? cache.appPromptStates
        : new Map();
    if (cache && cache.appPromptStates !== stateCache) {
        cache.appPromptStates = stateCache;
    }
    const persist = createPersister(toolkit, SDK_STORES.appPromptStates);

    const _compose = (appId, promptId) => {
        const key = _keyOf(appId, promptId);
        const reg = registry.get(key);
        if (!reg) return null;
        const state = stateCache.get(key) || null;
        return _mergeState(reg, state);
    };

    return {
        /** ★ 暴露给 framework / 测试入口：app 注册表（key → registration） */
        _registry: registry,
        _stateCache: stateCache,

        /**
         * 注册一条 prompt（同步写入内存）。
         * 重复注册同 (appId, promptId) 会覆盖旧值（保留 registeredAt）。
         * @param {object} spec  register() 参数
         * @returns {object|null} 注册后的 registration
         */
        register(spec) {
            const reg = _normalizeRegistration(spec);
            if (!reg) return null;
            const key = _keyOf(reg.appId, reg.promptId);
            const prev = registry.get(key);
            if (prev) reg.registeredAt = prev.registeredAt;
            registry.set(key, reg);
            try { bump && bump('appPrompts', 'register', { appId: reg.appId, promptId: reg.promptId }); } catch (_) {}
            return reg;
        },

        /**
         * 注销一条 prompt（仅清内存注册表，**不删 IndexedDB state**）。
         * app 卸载时调：用户编辑过的内容在 state 表里，下次重装后 register() 自动恢复。
         * @returns {boolean} 是否真有注册项被清掉
         */
        unregister(appId, promptId) {
            const key = _keyOf(appId, promptId);
            if (!registry.has(key)) return false;
            registry.delete(key);
            try { bump && bump('appPrompts', 'unregister', { appId, promptId }); } catch (_) {}
            return true;
        },

        /**
         * 列所有已注册条目（按 appId + order 升序），已合并 state。
         * 卸载 app 的条目（registry 里没有）**不**在这里出现。
         * @returns {Array<object>}
         */
        list() {
            const out = [];
            for (const reg of registry.values()) {
                const composed = _compose(reg.appId, reg.promptId);
                if (composed) out.push(composed);
            }
            out.sort((a, b) => {
                const ai = String(a.appId).localeCompare(String(b.appId));
                if (ai !== 0) return ai;
                return (Number(a.order) || 0) - (Number(b.order) || 0);
            });
            return out;
        },

        /**
         * 按 appId 过滤。
         */
        listByApp(appId) {
            if (!appId) return [];
            return this.list().filter((p) => p && p.appId === appId);
        },

        /**
         * 读单条（合并 state）。
         * @returns {object|null}
         */
        get(appId, promptId) {
            return _compose(appId, promptId);
        },

        /**
         * 仅读 IndexedDB state（不依赖内存注册表）。
         * 注册项被卸载后，仍能拿到 state（用于"用户编辑过的内容保留"）。
         * @returns {object|null}
         */
        getState(appId, promptId) {
            if (!appId || !promptId) return null;
            const key = _keyOf(appId, promptId);
            const state = stateCache.get(key);
            return state ? { ...state } : null;
        },

        /**
         * 写入 / 更新 state（async，落盘到 IndexedDB）。
         * patch 支持字段：active / content / order / customPreviewData
         * @returns {Promise<object|null>}  写入后的完整 state
         */
        async setState(appId, promptId, patch = {}) {
            if (!appId || !promptId) return null;
            const key = _keyOf(appId, promptId);
            const prev = stateCache.get(key) || {
                key, appId, promptId,
                active: true,
                content: '',
                order: 100,
                customPreviewData: null,
                updatedAt: _now(),
            };
            const next = { ...prev };
            if (patch && patch.active !== undefined) next.active = !!patch.active;
            if (patch && patch.content !== undefined) next.content = String(patch.content || '');
            if (patch && patch.order !== undefined && Number.isFinite(Number(patch.order))) {
                next.order = Number(patch.order);
            }
            if (patch && patch.customPreviewData !== undefined) {
                next.customPreviewData = patch.customPreviewData;
            }
            next.key = key;
            next.appId = appId;
            next.promptId = promptId;
            next.updatedAt = _now();
            stateCache.set(key, next);
            await persist(next);
            try { bump && bump('appPrompts', 'setState', { appId, promptId }); } catch (_) {}
            return { ...next };
        },

        /**
         * 清掉一条 state（不影响 register 表）。
         * 卸载 app 后用户主动"重置"用，下次 register 仍可恢复。
         * @returns {Promise<boolean>}
         */
        async removeState(appId, promptId) {
            if (!appId || !promptId) return false;
            const key = _keyOf(appId, promptId);
            if (!stateCache.has(key)) return false;
            stateCache.delete(key);
            try {
                if (toolkit?.db) {
                    await toolkit.db.remove(SDK_STORES.appPromptStates, key);
                }
            } catch (err) {
                console.warn('[appPrompts.removeState] db.remove failed', err);
            }
            try { bump && bump('appPrompts', 'removeState', { appId, promptId }); } catch (_) {}
            return true;
        },

        /**
         * 预热钩子（启动时由 settings app 调）。
         * 把 IndexedDB 里的 appPromptStates 加载到内存 cache（不影响 register）。
         */
        async hydrate() {
            if (!toolkit?.db) return;
            await loadFromDb(toolkit, SDK_STORES.appPromptStates, stateCache, 'key');
        },
    };
}