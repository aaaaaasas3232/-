/**
 * settings-sdk · 标签组 (TagGroup) + 标签 (Tag)
 *
 * 数据模型（思路.txt §3.2）：
 *   tagGroups: id, scope ('global' | 'world:<worldId>'), name, description, color, icon,
 *              isSystem, visibility, createdAt, updatedAt
 *   tags:      id, groupId, scope, name, displayName, aliases[], color, icon, notes,
 *              visibility, createdAt, updatedAt
 *
 * tag id 命名空间：用户自定义 tag 用 'tag-' 前缀；系统推荐 tag 用 'tag-sys-' 前缀。
 */

import { SDK_STORES, SYSTEM_TAG_GROUPS, nextIndexedId } from './defaults.js';
import {
    createPersister,
    loadFromDb,
    mergePatch,
    sortByName,
    matchesScope,
    normalizeScope,
    mapGet,
    now,
} from './helpers.js';

const DEFAULT_VISIBILITY = () => ({ default: 'private', allowedAiRefs: [], allowedUserRefs: [] });

// ============================================
// 通用 scope 过滤：tag vs tagGroup
// ============================================

const groupMatchesScope = (group, scope) => {
    if (scope === 'all') return true;
    if (scope === 'global') return group.scope === 'global';
    return group.scope === (scope.startsWith('world:') ? scope : `world:${scope}`);
};

// ============================================
// 标签组 API
// ============================================

export function createTagGroupsApi({ toolkit, cache, events, bump }) {
    const storeName = SDK_STORES.tagGroups;
    const cacheMap = cache.tagGroups;
    const persist = createPersister(toolkit, storeName);

    // ---- 私有：保证系统预设就位 ----
    const ensureSeed = async () => {
        const t = now();
        let inserted = 0;
        for (const sysGroup of SYSTEM_TAG_GROUPS) {
            if (cacheMap.has(sysGroup.id)) continue;
            const group = {
                ...sysGroup,
                displayName: sysGroup.displayName || sysGroup.name,
                visibility: sysGroup.visibility || DEFAULT_VISIBILITY(),
                createdAt: t,
                updatedAt: t,
            };
            cacheMap.set(group.id, group);
            await persist(group);
            inserted++;
        }
        if (inserted > 0) bump('tagGroups', 'seed', { count: inserted });
    };

    const list = ({ scope = 'all' } = {}) => {
        const items = Array.from(cacheMap.values());
        return scope === 'all' ? items.slice() : items.filter(g => groupMatchesScope(g, scope));
    };

    const get = (id) => mapGet(cacheMap, id);

    const create = async (patch = {}) => {
        const id = patch.id && !cacheMap.has(patch.id)
            ? patch.id
            : nextIndexedId('tgroup-user-', cacheMap.keys());
        const t = now();
        const group = {
            id,
            scope: normalizeScope(patch.scope || 'global'),
            name: patch.name || '新标签组',
            displayName: patch.displayName || patch.name || '新标签组',
            description: patch.description || '',
            color: patch.color || '#8E8E93',
            icon: patch.icon || '',
            isSystem: false,
            visibility: patch.visibility || DEFAULT_VISIBILITY(),
            createdAt: t,
            updatedAt: t,
        };
        cacheMap.set(id, group);
        await persist(group);
        bump('tagGroups', 'create', group);
        return group;
    };

    const update = async (id, patch = {}) => {
        const existing = mapGet(cacheMap, id);
        if (!existing) return null;
        if (existing.isSystem && (patch.scope || patch.isSystem === false)) {
            console.warn('[settings-sdk] 系统预设组不能改 scope / isSystem');
        }
        const next = mergePatch(existing, { ...patch, id });
        cacheMap.set(id, next);
        await persist(next);
        bump('tagGroups', 'update', next);
        return next;
    };

    const remove = async (id) => {
        const existing = mapGet(cacheMap, id);
        if (!existing) return false;
        if (existing.isSystem) {
            console.warn('[settings-sdk] 系统预设组不能删除');
            return false;
        }
        cacheMap.delete(id);
        if (toolkit?.db) await toolkit.db.remove(storeName, id);

        // 级联删除组内 tag
        const orphanTagIds = Array.from(cache.tags.values())
            .filter(tag => tag.groupId === id)
            .map(tag => tag.id);
        for (const tagId of orphanTagIds) {
            cache.tags.delete(tagId);
            if (toolkit?.db) await toolkit.db.remove(SDK_STORES.tags, tagId);
        }
        bump('tagGroups', 'remove', { id });
        return true;
    };

    const hydrate = async () => {
        await loadFromDb(toolkit, storeName, cacheMap);
        await ensureSeed();
    };

    return { list, get, create, update, remove, hydrate, ensureSeed };
}

// ============================================
// 标签 API
// ============================================

export function createTagsApi({ toolkit, cache, events, bump }) {
    const storeName = SDK_STORES.tags;
    const cacheMap = cache.tags;
    const persist = createPersister(toolkit, storeName);

    const list = ({ scope = 'all', groupId = null } = {}) => {
        let items = Array.from(cacheMap.values());
        if (groupId) items = items.filter(tag => tag.groupId === groupId);
        if (scope !== 'all') items = items.filter(tag => matchesScope(tag, scope));
        return items.slice().sort(sortByName);
    };

    const get = (id) => mapGet(cacheMap, id);

    const create = async (patch = {}) => {
        if (!patch.groupId) {
            console.warn('[settings-sdk] tag 缺少 groupId，自动丢弃');
            return null;
        }
        const id = patch.id && !cacheMap.has(patch.id)
            ? patch.id
            : nextIndexedId('tag-user-', cacheMap.keys());
        const group = cache.tagGroups.get(patch.groupId);
        const t = now();
        const tag = {
            id,
            groupId: patch.groupId,
            scope: normalizeScope(group?.scope || patch.scope || 'global'),
            name: patch.name || '新标签',
            displayName: patch.displayName || patch.name || '新标签',
            aliases: Array.isArray(patch.aliases) ? patch.aliases.slice() : [],
            color: patch.color || group?.color || '#8E8E93',
            icon: patch.icon || '',
            notes: patch.notes || '',
            visibility: patch.visibility || DEFAULT_VISIBILITY(),
            createdAt: t,
            updatedAt: t,
        };
        cacheMap.set(id, tag);
        await persist(tag);
        bump('tags', 'create', tag);
        return tag;
    };

    const update = async (id, patch = {}) => {
        const existing = mapGet(cacheMap, id);
        if (!existing) return null;
        const next = mergePatch(existing, { ...patch, id });
        cacheMap.set(id, next);
        await persist(next);
        bump('tags', 'update', next);
        return next;
    };

    const remove = async (id) => {
        const existing = mapGet(cacheMap, id);
        if (!existing) return false;
        cacheMap.delete(id);
        if (toolkit?.db) await toolkit.db.remove(storeName, id);
        bump('tags', 'remove', { id });
        return true;
    };

    /**
     * 把 refs 数组展开成完整 tag 实例数组。
     */
    const expandRefs = (refs = []) =>
        refs.map(ref => mapGet(cacheMap, ref)).filter(Boolean);

    /**
     * 找贴了某 tag 的所有对象（按 refsMaps 索引）。
     * refsMaps 形如 { user: [...], ai: [...], world: [...] }。
     */
    const findObjectsByTag = (tagId, refsMaps = {}) => {
        const found = { users: [], aiPersons: [], worlds: [] };
        for (const [entityType, list] of Object.entries(refsMaps)) {
            const mapKey = entityType === 'user' ? 'users'
                : entityType === 'ai' ? 'aiPersons'
                : entityType === 'world' ? 'worlds'
                : null;
            if (!mapKey || !list) continue;
            for (const instance of list) {
                if ((instance.tagRefs || []).includes(tagId)) found[mapKey].push(instance);
            }
        }
        return found;
    };

    /**
     * 找贴了某组内任意 tag 的对象。
     */
    const findObjectsByGroup = (groupId, refsMaps = {}) => {
        const tagIds = list({ groupId }).map(t => t.id);
        if (!tagIds.length) return { users: [], aiPersons: [], worlds: [] };
        const out = { users: [], aiPersons: [], worlds: [] };
        for (const [entityType, list] of Object.entries(refsMaps)) {
            const mapKey = entityType === 'user' ? 'users'
                : entityType === 'ai' ? 'aiPersons'
                : entityType === 'world' ? 'worlds'
                : null;
            if (!mapKey || !list) continue;
            for (const instance of list) {
                if ((instance.tagRefs || []).some(ref => tagIds.includes(ref))) out[mapKey].push(instance);
            }
        }
        return out;
    };

    const hydrate = async () => {
        await loadFromDb(toolkit, storeName, cacheMap);
    };

    return {
        list, get, create, update, remove,
        expandRefs, findObjectsByTag, findObjectsByGroup,
        hydrate,
    };
}