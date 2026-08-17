/**
 * settings-sdk · 通用 CRUD（user / ai / world 共用）
 *
 * 三个实体库的 schema 略有不同，但 CRUD 形状完全一致：
 *   - id 用 `${prefix}${n}`，从 0 开始递增
 *   - 实例对象都带 createdAt / updatedAt
 *   - 默认值在 defaults.js 里集中维护
 *   - 「当前选中」通过 SDK_STORES.active 表里以 'activeUser' / 'activeAi' / 'activeWorld' 为 key 存
 *
 * createEntityApi({ scope: 'users' | 'aiPersons' | 'worlds' }) 返回
 *   { list, get, create, update, remove, getActive, setActive, count, hydrate, ensureSeed }
 */

import {
    DEFAULT_ACTIVE_USER_ID,
    DEFAULT_ACTIVE_AI_ID,
    DEFAULT_ACTIVE_WORLD_ID,
    DEFAULT_USER_INSTANCE,
    DEFAULT_AI_INSTANCE,
    DEFAULT_WORLD_INSTANCE,
    SDK_STORES,
    nextIndexedId,
} from './defaults.js';
import { resolveWorldMode } from '@/src/core/world-profile.js';
import {
    createPersister,
    loadFromDb,
    mergePatch,
    sortById,
    mapGet,
    now,
} from './helpers.js';

// ============================================
// scope → 配置映射（一次查表，避免 switch 重复）
// ============================================

const SCOPE_CONFIG = {
    users: {
        store: SDK_STORES.users,
        defaults: DEFAULT_USER_INSTANCE,
        activeKey: 'activeUser',
        activeDefault: DEFAULT_ACTIVE_USER_ID,
    },
    aiPersons: {
        store: SDK_STORES.aiPersons,
        defaults: DEFAULT_AI_INSTANCE,
        activeKey: 'activeAi',
        activeDefault: DEFAULT_ACTIVE_AI_ID,
    },
    worlds: {
        store: SDK_STORES.worlds,
        defaults: DEFAULT_WORLD_INSTANCE,
        activeKey: 'activeWorld',
        activeDefault: DEFAULT_ACTIVE_WORLD_ID,
    },
};

const getScopeConfig = (scope) => SCOPE_CONFIG[scope] ?? SCOPE_CONFIG.users;

// ============================================
// 工厂
// ============================================

/**
 * 给定 toolkit / cache / events 上下文，构造一个 CRUD 集合。
 *
 * @param {object} ctx
 * @param {object} ctx.toolkit
 * @param {object} ctx.cache          cache.users / cache.aiPersons / cache.worlds
 * @param {object} ctx.events        event bus
 * @param {Function} ctx.bump
 * @param {'users'|'aiPersons'|'worlds'} ctx.scope
 */
export function createEntityApi({ toolkit, cache, events, bump, scope = 'users' }) {
    const { store: storeName, defaults: defaultInstance, activeKey, activeDefault } = getScopeConfig(scope);
    const cacheMap = cache[scope];
    const persist = createPersister(toolkit, storeName);
    const idPrefix = defaultInstance.id.replace(/\d+$/, '');

    // ---- 私有：落盘 active id ----
    const persistActive = async (id) => {
        if (!toolkit?.db) return;
        await toolkit.db.put(SDK_STORES.active, { key: activeKey, value: id });
    };

    // ---- 私有：保证种子数据 ----
    // 注意：worlds 不创建种子——用户自己创建世界，避免「默认世界观」占位。
    const ensureSeed = async () => {
        if (scope !== 'worlds' && cacheMap.size === 0) {
            const t = now();
            const seed = { ...defaultInstance, id: defaultInstance.id, createdAt: t, updatedAt: t };
            cacheMap.set(seed.id, seed);
            await persist(seed);
            if (!cache[activeKey]) {
                cache[activeKey] = activeDefault;
                await persistActive(activeDefault);
            }
        }
    };

    // ============================================
    // 公共 API
    // ============================================

    const list = () => Array.from(cacheMap.values()).sort(sortById);

    const get = (id) => mapGet(cacheMap, id);

    const create = async (patch = {}) => {
        const id = patch.id && !cacheMap.has(patch.id)
            ? patch.id
            : nextIndexedId(idPrefix, cacheMap.keys());
        const t = now();
        const instance = mergePatch({ ...defaultInstance, id, createdAt: t, updatedAt: t }, patch);
        cacheMap.set(id, instance);
        await persist(instance);

        if (!cache[activeKey]) {
            cache[activeKey] = id;
            await persistActive(id);
        }

        bump(scope, 'create', instance);
        return instance;
    };

    const update = async (id, patch = {}) => {
        const existing = mapGet(cacheMap, id);
        if (!existing) return null;
        const next = mergePatch(existing, patch);
        cacheMap.set(id, next);
        await persist(next);
        bump(scope, 'update', next);
        return next;
    };

    const remove = async (id) => {
        const existing = mapGet(cacheMap, id);
        if (!existing) return false;
        cacheMap.delete(id);
        if (toolkit?.db) await toolkit.db.remove(storeName, id);

        // 若是 active，回退到下一个
        if (cache[activeKey] === id) {
            const nextId = list()[0]?.id ?? null;
            cache[activeKey] = nextId;
            await persistActive(nextId ?? '');
        }
        bump(scope, 'remove', { id });
        return true;
    };

    const getActive = () => mapGet(cacheMap, cache[activeKey]);

    const setActive = async (id) => {
        if (!cacheMap.has(id)) return null;
        cache[activeKey] = id;
        await persistActive(id);
        bump(scope, 'setActive', { id });
        return cacheMap.get(id);
    };

    const count = () => cacheMap.size;

    const hydrate = async () => {
        if (!toolkit?.db) {
            await ensureSeed();
            return;
        }
        await loadFromDb(toolkit, storeName, cacheMap);

        // ★ schema 迁移兜底：cache 里每个 entity merge 上 defaults 的字段，
        // 防止旧 DB 记录缺字段（典型如 chronologySettings）渲染时拿不到。
        for (const [id, rec] of cacheMap) {
            const defaultsCopy = JSON.parse(JSON.stringify(defaultInstance));
            const inferredWorldMode = scope === 'worlds'
                && !String(rec?.experienceMode || '').trim()
                ? resolveWorldMode(rec)
                : '';
            // 浅合并（顶层字段）
            const merged = { ...defaultsCopy, ...rec };
            if (inferredWorldMode) merged.experienceMode = inferredWorldMode;
            // 嵌套字段：缺则用 defaults，否则把 defaults 的子字段补进去
            for (const subKey of ['chronologySettings', 'eventAggregator', 'timelines']) {
                if (!defaultsCopy[subKey]) continue;
                if (merged[subKey] == null || typeof merged[subKey] !== 'object') {
                    merged[subKey] = defaultsCopy[subKey];
                } else {
                    merged[subKey] = { ...defaultsCopy[subKey], ...merged[subKey] };
                }
            }
            if (JSON.stringify(merged) !== JSON.stringify(rec)) {
                cacheMap.set(id, merged);
                await persist(merged);
                console.log('[hydrate] migrated', scope, id, 'added missing fields');
            }
        }

        const activeRecord = await toolkit.db.get(SDK_STORES.active, activeKey);
        if (activeRecord?.value && cacheMap.has(activeRecord.value)) {
            cache[activeKey] = activeRecord.value;
        } else {
            await ensureSeed();
        }
    };

    return {
        list, get, create, update, remove,
        getActive, setActive, count,
        hydrate, ensureSeed,
    };
}

// 兼容旧名字导出（避免破坏既有调用）
export const createUsersApi = createEntityApi;