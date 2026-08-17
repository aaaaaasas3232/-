/**
 * settings-sdk · 当日快照（Daily Snapshot） + 加权随机工具
 *
 * 思路（思路.txt §3.14 / §3.15）：
 *   - ai 实例上挂 locationDistribution / moodDistribution（加权分布）
 *   - dailySnapshot 缓存今天的 location / mood，写到 IndexedDB，跨 App 共享
 *   - getOrCompute(aiId)：今天没算就调 onCompute 算一次，写缓存，返回结果
 *   - key = `aiId|YYYY-MM-DD`（本机本地日期，不处理跨时区）
 */

import { SDK_STORES } from './defaults.js';
import { createPersister, now } from './helpers.js';

// ============================================
// 纯函数：加权随机 + 日期
// ============================================

/**
 * 加权随机：从 distribution 数组里按 weight 抽取一项。
 *   distribution: [{ key: 'loc-xxx', weight: 90 }, { key: 'loc-yyy', weight: 10 }]
 */
export function weightedPick(distribution = [], rng = Math.random) {
    if (!Array.isArray(distribution) || distribution.length === 0) return null;
    const total = distribution.reduce((sum, d) => sum + (Number(d.weight) || 0), 0);
    if (total <= 0) return distribution[0];
    let r = rng() * total;
    for (const item of distribution) {
        r -= (Number(item.weight) || 0);
        if (r <= 0) return item;
    }
    return distribution[distribution.length - 1];
}

/** 本机本地日期（YYYY-MM-DD）。 */
export const localDateKey = (date = new Date()) => date.toLocaleDateString('en-CA');

/**
 * 把 ai 上的 distribution 转成可 pick 的形状。
 *   ai.locationDistribution: [{ locationRef, weight }]
 *   ai.moodDistribution:     [{ mood, weight }]
 */
const pickFromAiDistribution = (ai, kind) => {
    if (!ai) return null;
    const dist = ai[kind === 'mood' ? 'moodDistribution' : 'locationDistribution'] || [];
    if (!dist.length) return null;
    const picked = weightedPick(dist);
    if (!picked) return null;
    return kind === 'mood' ? { mood: picked.mood } : { locationRef: picked.locationRef };
};

// ============================================
// 工厂
// ============================================

export function createSnapshotApi({ toolkit, cache, events, bump }) {
    const storeName = SDK_STORES.snapshots;
    const cacheMap = cache.snapshots;
    const persist = createPersister(toolkit, storeName);

    const makeKey = (aiId, dateKey) => `${aiId}|${dateKey}`;

    const list = () => Array.from(cacheMap.values());

    const listForAi = (aiId, { from = null, to = null } = {}) =>
        list().filter(s => {
            if (s.aiId !== aiId) return false;
            if (from && s.date < from) return false;
            if (to && s.date > to) return false;
            return true;
        });

    const get = (aiId, dateKey = localDateKey()) => cacheMap.get(makeKey(aiId, dateKey)) || null;
    const getToday = (aiId) => get(aiId, localDateKey());

    /**
     * 强制重算：删今天快照后下次 getOrCompute 会重新算。
     */
    const recompute = async (aiId) => {
        const dateKey = localDateKey();
        const key = makeKey(aiId, dateKey);
        if (cacheMap.has(key) && toolkit?.db) {
            await toolkit.db.remove(storeName, key);
        }
        cacheMap.delete(key);
        bump('snapshots', 'recompute', { aiId, dateKey });
        return getOrCompute(aiId);
    };

    /**
     * 拿今天的快照；没有就算 + 写一次。
     * options.onCompute: (ai, computed) => ({ location, mood }) 可选
     */
    const getOrCompute = async (aiId, options = {}) => {
        const dateKey = localDateKey();
        const key = makeKey(aiId, dateKey);
        const existing = cacheMap.get(key);
        if (existing) return existing;

        const ai = cache.aiPersons.get(aiId);
        if (!ai) return null;

        let computed = null;
        let source = 'computed';

        // override 优先
        if (ai.locationOverride) {
            computed = { ...(computed || {}), location: { ref: ai.locationOverride, label: ai.locationOverride } };
            source = 'override';
        }
        if (ai.moodOverride) {
            computed = { ...(computed || {}), mood: ai.moodOverride };
            source = 'override';
        }

        if (!computed?.location) {
            const picked = pickFromAiDistribution(ai, 'location');
            if (picked?.locationRef) {
                const loc = cache.locations.get(picked.locationRef);
                computed = {
                    ...(computed || {}),
                    location: { ref: picked.locationRef, label: loc?.name || picked.locationRef },
                };
            }
        }
        if (!computed?.mood) {
            const picked = pickFromAiDistribution(ai, 'mood');
            if (picked?.mood) computed = { ...(computed || {}), mood: picked.mood };
        }

        // 注入点
        if (typeof options.onCompute === 'function') {
            try {
                const override = await options.onCompute(ai, computed || {});
                if (override) computed = { ...computed, ...override };
            } catch (err) {
                console.warn('[settings-sdk.snapshot] onCompute 报错', err);
            }
        }

        const snapshot = {
            key,
            aiId,
            date: dateKey,
            location: computed?.location || null,
            mood: computed?.mood || null,
            weather: null,
            holidayHits: [],
            derivedAt: now(),
            source,
        };
        cacheMap.set(key, snapshot);
        await persist(snapshot);
        bump('snapshots', 'compute', snapshot);
        return snapshot;
    };

    /**
     * GC：清理 N 天前的快照。
     */
    const gc = async ({ keepDays = 90 } = {}) => {
        const cutoff = now() - keepDays * 86400_000;
        let removed = 0;
        for (const [key, snap] of cacheMap.entries()) {
            if ((snap.derivedAt || 0) >= cutoff) continue;
            cacheMap.delete(key);
            if (toolkit?.db) await toolkit.db.remove(storeName, key);
            removed++;
        }
        if (removed > 0) bump('snapshots', 'gc', { removed });
        return removed;
    };

    const hydrate = async () => {
        if (!toolkit?.db) return;
        const records = await toolkit.db.getAll(storeName);
        cacheMap.clear();
        for (const r of records || []) if (r?.key) cacheMap.set(r.key, r);
    };

    return {
        list, listForAi, get, getToday,
        getOrCompute, recompute, gc, hydrate,
    };
}