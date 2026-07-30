/**
 * settings-sdk · 世界观组 (WorldGroup)
 *
 * 数据模型（思路.txt §1）：
 *   {
 *     id: 'group-modern',
 *     name: '现代世界观',
 *     icon: '🏙️',                  // emoji 或字符
 *     color: '#3b82f6',
 *     description: '',
 *     order: 0,
 *     createdAt, updatedAt
 *   }
 *
 * 与 world 的关系：
 *   - world.groupRef = 'group-xxx'（可选，未归属组的 world 显示在"未分组"区域）
 *   - 删除 group 时只允许库内没有 world
 *   - 工具：listWorldsByGroup(groupId) → 列出归属该 group 的所有 world
 *          listUngroupedWorlds()      → 列出 groupRef 为空的 world
 */

import { SDK_STORES } from './defaults.js';
import {
    createPersister,
    loadFromDb,
    mergePatch,
    sortByName,
    mapGet,
    now,
} from './helpers.js';

// ============================================
// 工厂
// ============================================

export function createWorldGroupsApi({ toolkit, cache, events, bump }) {
    const storeName = SDK_STORES.worldGroups;
    const cacheMap = cache.worldGroups;
    const persist = createPersister(toolkit, storeName);

    // ============================================
    // 公共 API：组本身
    // ============================================

    const list = () => Array.from(cacheMap.values())
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || sortByName(a, b));

    const get = (id) => mapGet(cacheMap, id);

    const create = async (patch = {}) => {
        const id = patch.id && !cacheMap.has(patch.id)
            ? patch.id
            : `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const t = now();
        const order = patch.order ?? cacheMap.size;
        const group = {
            id,
            name: patch.name || '新世界观库',
            icon: patch.icon || '📁',
            color: patch.color || '#8E8E93',
            description: patch.description || '',
            order,
            createdAt: t,
            updatedAt: t,
        };
        cacheMap.set(id, group);
        await persist(group);
        bump('worldGroups', 'create', group);
        return group;
    };

    const update = async (id, patch = {}) => {
        const existing = mapGet(cacheMap, id);
        if (!existing) return null;
        const next = mergePatch(existing, { ...patch, id });
        cacheMap.set(id, next);
        await persist(next);
        bump('worldGroups', 'update', next);
        return next;
    };

    const remove = async (id) => {
    if (!cacheMap.has(id)) return false;
    const existing = mapGet(cacheMap, id);
    if (!existing) return false;
        if (listWorldsByGroup(id).length > 0) return false;
        cacheMap.delete(id);
        if (toolkit?.db) await toolkit.db.remove(storeName, id);
        bump('worldGroups', 'remove', { id });
        return true;
    };
    // ============================================
    // 公共 API：组 ↔ world 关联
    // ============================================

    /**
     * 列出归属指定 group 的所有 world。
     *   - groupId === null → 未分组的世界（groupRef 为空/null/undefined）
     */
    const listWorldsByGroup = (groupId = null) => {
        const all = Array.from(cache.worlds.values());
        if (groupId === null) {
            return all.filter(w => !w.groupRef);
        }
        return all.filter(w => w.groupRef === groupId);
    };

    /** 把指定 world 挂到 group 下；传 null 表示移到「未分组」。 */
    const assignWorld = async (worldId, groupId) => {
        const world = mapGet(cache.worlds, worldId);
        if (!world) return null;
        if (groupId !== null && !cacheMap.has(groupId)) return null;
        const next = { ...world, groupRef: groupId, updatedAt: now() };
        cache.worlds.set(worldId, next);
        if (toolkit?.db) await toolkit.db.put(SDK_STORES.worlds, next);
        bump('worldGroups', 'assign', { worldId, groupId });
        return next;
    };

    const hydrate = async () => {
        await loadFromDb(toolkit, storeName, cacheMap);
    };

    return {
        list, get, create, update, remove,
        listWorldsByGroup, assignWorld,
        hydrate,
    };
}