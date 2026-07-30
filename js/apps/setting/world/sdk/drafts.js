/**
 * settings-sdk · 草稿管理（v0.11 §11）
 *
 * 给任意编辑页提供「未保存内容」兜底：
 *   - draft.save(type, targetId, data)     保存草稿
 *   - draft.get(type, targetId)             取草稿
 *   - draft.delete(type, targetId)         删草稿
 *   - draft.has(type, targetId)             是否有草稿
 *   - draft.publish(type, targetId)         把草稿转为正式（外部接 publish 钩子）
 *
 * draft id = `draft-${type}-${targetId}`，keyPath 用 'id'。
 */

import { SDK_STORES } from './defaults.js';
import { createPersister, loadFromDb, mergePatch, mapGet, now } from './helpers.js';

// ============================================
// 工厂
// ============================================

export function createDraftsApi({ toolkit, cache, events, bump }) {
    const storeName = SDK_STORES.drafts || 'sdkDrafts';
    const cacheMap = (cache.drafts ||= new Map());
    const persist = createPersister(toolkit, storeName);

    const makeId = (type, targetId) => `draft-${type}-${targetId ?? 'new'}`;

    const list = ({ type = null } = {}) => {
        const items = Array.from(cacheMap.values());
        return type ? items.filter(d => d.targetType === type) : items;
    };

    const get = (type, targetId) => cacheMap.get(makeId(type, targetId)) || null;
    const has = (type, targetId) => cacheMap.has(makeId(type, targetId));

    const save = async (type, targetId, data) => {
        const id = makeId(type, targetId);
        const t = now();
        const existing = cacheMap.get(id);
        const draft = mergePatch(
            existing || {
                id,
                targetType: type,
                targetId: targetId ?? null,
                data: {},
                createdAt: t,
            },
            { data, lastEditedAt: t },
        );
        cacheMap.set(id, draft);
        await persist(draft);
        bump('drafts', 'save', draft);
        return draft;
    };

    const remove = async (type, targetId) => {
        const id = makeId(type, targetId);
        if (!cacheMap.has(id)) return false;
        cacheMap.delete(id);
        if (toolkit?.db) await toolkit.db.remove(storeName, id);
        bump('drafts', 'remove', { id });
        return true;
    };

    /**
     * 发布：取草稿 → 调 onPublish(draft) → 删草稿。
     */
    const publish = async (type, targetId, onPublish) => {
        const draft = get(type, targetId);
        if (!draft) return null;
        if (typeof onPublish === 'function') {
            try {
                await onPublish(draft);
            } catch (err) {
                console.warn('[settings-sdk.drafts] onPublish 报错', err);
                return null;
            }
        }
        await remove(type, targetId);
        return draft;
    };

    const hydrate = async () => {
        if (!toolkit?.db) return;
        await loadFromDb(toolkit, storeName, cacheMap);
    };

    return { list, get, has, save, remove, publish, hydrate };
}