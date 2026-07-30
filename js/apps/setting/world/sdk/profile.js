/**
 * settings-sdk · 实体档案 Profile（思路.txt §0.2）
 *
 *   - 全局默认 level（'minimal' | 'detailed'）
 *   - 按实体单独覆盖（profileOverrides: { 'user0': 'detailed' })
 *   - getInstance(entityType, id, { level }) → 按 level 过滤字段后的对象
 *
 *   模式只过滤 UI 视图，不删数据；写入永远生效。
 */

import { filterSchemaByMode, getSchema, getRequiredKeys } from './profile-schema.js';

const PROFILE_LEVELS = Object.freeze(['minimal', 'detailed']);
const overrideKey = (entityType, id) => `${entityType}:${id}`;

// ============================================
// 内部：根据 entityType 找对应 cache Map
// ============================================

const CACHE_KEY_BY_ENTITY = Object.freeze({
    user: 'users',
    ai: 'aiPersons',
    world: 'worlds',
});

// ============================================
// 工厂
// ============================================

export function createProfileApi({ cache, events, bump }) {
    const getLevel = () => cache.profileLevel || 'minimal';

    const setLevel = async (level) => {
        if (!PROFILE_LEVELS.includes(level)) return null;
        cache.profileLevel = level;
        if (typeof window !== 'undefined' && window.myDb) {
            try {
                await window.myDb.put('sdkActive', { key: 'profileLevel', value: level });
            } catch (err) {
                console.warn('[settings-sdk.profile] persist level 失败', err);
            }
        }
        bump('profile', 'setLevel', { level });
        return level;
    };

    const getLevelFor = (entityType, id) => {
        if (id) {
            const override = cache.profileOverrides?.[overrideKey(entityType, id)];
            if (override) return override;
        }
        return getLevel();
    };

    const setLevelFor = async (entityType, id, level) => {
        if (!PROFILE_LEVELS.includes(level)) return null;
        cache.profileOverrides[overrideKey(entityType, id)] = level;
        if (typeof window !== 'undefined' && window.myDb) {
            try {
                await window.myDb.put('sdkActive', {
                    key: `profileOverride:${entityType}:${id}`,
                    value: level,
                });
            } catch (err) {
                console.warn('[settings-sdk.profile] persist override 失败', err);
            }
        }
        bump('profile', 'setLevelFor', { entityType, id, level });
        return level;
    };

    const clearLevelFor = async (entityType, id) => {
        delete cache.profileOverrides[overrideKey(entityType, id)];
        if (typeof window !== 'undefined' && window.myDb) {
            try {
                await window.myDb.remove('sdkActive', `profileOverride:${entityType}:${id}`);
            } catch (err) {
                console.warn('[settings-sdk.profile] clear override 失败', err);
            }
        }
        bump('profile', 'clearLevelFor', { entityType, id });
    };

    /**
     * 取某个实体实例，按 level 过滤字段。
     */
    const getInstance = (entityType, id, options = {}) => {
        const level = options.level || getLevelFor(entityType, id);
        const schema = getSchema(entityType);
        if (!schema.length) return null;
        const cacheMap = cache[CACHE_KEY_BY_ENTITY[entityType]];
        if (!cacheMap) return null;
        const instance = cacheMap.get(id);
        if (!instance) return null;
        if (level === 'detailed') return { ...instance };

        const allowed = new Set(filterSchemaByMode(schema, 'minimal').map(f => f.key));
        const out = {};
        for (const [k, v] of Object.entries(instance)) {
            if (allowed.has(k) || k === 'id' || k === 'createdAt' || k === 'updatedAt') out[k] = v;
        }
        return out;
    };

    const getFieldSchema = (entityType) => getSchema(entityType).slice();

    /**
     * 必填但为空的字段 key 列表（思路.txt §8.12）。
     */
    const getIncompleteFields = (entityType, instance) => {
        if (!instance) return [];
        return getRequiredKeys(entityType).filter(key => {
            const v = instance[key];
            if (v == null) return true;
            if (typeof v === 'string') return v.trim() === '';
            if (Array.isArray(v)) return v.length === 0;
            return false;
        });
    };

    const hydrate = async () => {
        if (typeof window === 'undefined' || !window.myDb) return;
        try {
            const levelRecord = await window.myDb.get('sdkActive', 'profileLevel');
            if (levelRecord?.value && PROFILE_LEVELS.includes(levelRecord.value)) {
                cache.profileLevel = levelRecord.value;
            }
        } catch (err) {
            console.warn('[settings-sdk.profile] hydrate 失败', err);
        }
    };

    return {
        getLevel, setLevel,
        getLevelFor, setLevelFor, clearLevelFor,
        getInstance, getFieldSchema, getIncompleteFields,
        hydrate,
        LEVELS: PROFILE_LEVELS,
    };
}