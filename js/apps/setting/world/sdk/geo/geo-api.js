/**
 * settings-sdk · 地理系统 API（Places / Locations）
 *
 * 组织结构：
 *   - Place：地点（箱庭地图容器）
 *   - Location：场所（地点下的 pin，关联到 Place）
 *
 * 坐标系统 v2：
 *   所有位置都使用「相对主地点」的坐标 (x, y)
 *   世界坐标范围 X / Y 都 ∈ [-100, 100]
 *   主地点始终为 (0, 0)
 */

import { SDK_STORES, nextIndexedId } from '../defaults.js';
import {
    createPersister,
    loadFromDb,
    mergePatch,
    sortByName,
    mapGet,
    sequential,
    now,
} from '../helpers.js';
import {
    DEFAULT_PLACE,
    DEFAULT_LOCATION,
} from './geo-constants.js';

// ============================================
// 通用工厂：按 worldRef 过滤的 CRUD
// ============================================

const createWorldScopedApi = ({
    toolkit, cache, bump, scope,
    storeName,
    cacheMap,
    idPrefix,
    build,
    hydrateExtra = () => {},
}) => {
    const persist = createPersister(toolkit, storeName);

    const list = ({ worldRef = null } = {}) => {
        const items = Array.from(cacheMap.values());
        return (worldRef ? items.filter(it => it.worldRef === worldRef) : items)
            .slice()
            .sort(sortByName);
    };

    return {
        list,
        get: (id) => mapGet(cacheMap, id),

        create: async (patch = {}) => {
            const id = patch.id && !cacheMap.has(patch.id)
                ? patch.id
                : nextIndexedId(idPrefix, cacheMap.keys());
            const t = now();
            const instance = build(patch, id, t);
            cacheMap.set(id, instance);
            await persist(instance);
            bump(scope, 'create', instance);
            return instance;
        },

        update: async (id, patch = {}) => {
            const existing = mapGet(cacheMap, id);
            if (!existing) return null;
            const next = mergePatch(existing, { ...patch, id });
            cacheMap.set(id, next);
            await persist(next);
            bump(scope, 'update', next);
            return next;
        },

        remove: async (id) => {
            const existing = mapGet(cacheMap, id);
            if (!existing) return false;
            cacheMap.delete(id);
            if (toolkit?.db) await toolkit.db.remove(storeName, id);
            bump(scope, 'remove', { id });
            return true;
        },

        removeByWorld: async (worldRef) => {
            const ids = list({ worldRef }).map(it => it.id);
            await sequential(ids, (id) => {
                cacheMap.delete(id);
                if (toolkit?.db) toolkit.db.remove(storeName, id);
            });
            return ids.length;
        },

        hydrate: async () => {
            await loadFromDb(toolkit, storeName, cacheMap);
            await hydrateExtra();
        },
    };
};

// ============================================
// 地点 API（Place：箱庭地图容器）
// ============================================

export function createPlacesApi({ toolkit, cache, events, bump }) {
    return createWorldScopedApi({
        toolkit, cache, bump,
        scope: 'places',
        storeName: SDK_STORES.places,
        cacheMap: cache.places,
        idPrefix: 'place-',
        build: (patch, id, t) => ({
            ...DEFAULT_PLACE,
            id,
            worldRef: patch.worldRef || '',
            name: patch.name || '新地点',
            icon: patch.icon || '',
            summary: patch.summary || '',
            mapImageUrl: patch.mapImageUrl || '',
            mapImageWidth: Number(patch.mapImageWidth) || 800,
            mapImageHeight: Number(patch.mapImageHeight) || 600,
            defaultZoom: Number(patch.defaultZoom) || 1,
            mapOffsetX: Number(patch.mapOffsetX) || 0,
            mapOffsetY: Number(patch.mapOffsetY) || 0,
            // 映射真实城市（天气系统）
            realCityRef: patch.realCityRef || null,
            createdAt: t,
            updatedAt: t,
        }),
    });
}

// ============================================
// 场所 API（Location：地点下的 pin）
// ============================================

export function createLocationsApi({ toolkit, cache, events, bump }) {
    const persist = createPersister(toolkit, SDK_STORES.locations);

    const base = createWorldScopedApi({
        toolkit, cache, bump,
        scope: 'locations',
        storeName: SDK_STORES.locations,
        cacheMap: cache.locations,
        idPrefix: 'loc-',
        build: (patch, id, t) => ({
            id,
            worldRef: patch.worldRef || '',
            name: patch.name || '新地点',
            isCenter: !!patch.isCenter,
            position: clampPosition(patch.position),
            _v2: true,
            placeRef: patch.placeRef || null,
            realCityRef: patch.realCityRef || null,
            occupants: Array.isArray(patch.occupants) ? patch.occupants.slice() : [],
            tagRefs: Array.isArray(patch.tagRefs) ? patch.tagRefs.slice() : [],
            summary: patch.summary || '',
            icon: patch.icon || '',
            allowedPhases: Array.isArray(patch.allowedPhases) ? patch.allowedPhases.slice() : null,
            allowedRoles: Array.isArray(patch.allowedRoles) ? patch.allowedRoles.slice() : ['user', 'ai'],
            accessType: patch.accessType || 'open',
            // v0.24: accessNotes 升级为 per-persona 配置结构
            accessNotes: patch.accessNotes && typeof patch.accessNotes === 'object'
                ? { visitors: patch.accessNotes.visitors || {} }
                : { visitors: {} },
            createdAt: t,
            updatedAt: t,
        }),
        hydrateExtra: () => migrateLegacyPositions(),
    });

    // 坐标钳制
    function clampPosition(raw) {
        if (raw && typeof raw === 'object') {
            const x = Number(raw.x), y = Number(raw.y);
            if (Number.isFinite(x) && Number.isFinite(y)) {
                return { x: clampCoord(x), y: clampCoord(y) };
            }
        }
        return { x: 0, y: 0 };
    }

    function clampCoord(v) {
        return Number.isFinite(v) ? Math.max(-100, Math.min(100, v)) : 0;
    }

    // 旧坐标迁移（0..100 → -100..+100）
    async function migrateLegacyPositions() {
        let migrated = 0;
        for (const [id, loc] of cache.locations.entries()) {
            if (loc?._v2 === true) continue;
            const p = loc?.position;
            if (!p || typeof p !== 'object') continue;
            const x = Number(p.x), y = Number(p.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            if (!(x >= 0 && x <= 100 && y >= 0 && y <= 100)) continue;
            const next = { x: clampCoord((x - 50) * 2), y: clampCoord((y - 50) * 2) };
            if (next.x === x && next.y === y) continue;
            const persisted = { ...loc, position: next, _v2: true, updatedAt: now() };
            cache.locations.set(id, persisted);
            await persist(persisted);
            migrated++;
        }
        return migrated;
    }

    // ============================================
    // 空间地图扩展
    // ============================================

    const getCenter = (worldId) => {
        const all = base.list({ worldRef: worldId });
        return all.find(l => l.isCenter) || all[0] || null;
    };

    const getMapData = (worldId) => {
        const all = base.list({ worldRef: worldId });
        const center = all.find(l => l.isCenter) || all[0] || null;
        return {
            center,
            locations: all.map(l => ({ ...l, position: clampPosition(l.position) })),
        };
    };

    const setCenterLocation = async (worldId, locId) => {
        const all = base.list({ worldRef: worldId });
        const newCenter = all.find(it => it.id === locId);
        if (!newCenter) return null;
        const cur = clampPosition(newCenter.position);

        for (const it of all) {
            const isNowCenter = it.id === locId;
            if (isNowCenter) {
                if (!it.isCenter || cur.x !== 0 || cur.y !== 0) {
                    await base.update(it.id, { isCenter: true, position: { x: 0, y: 0 } });
                }
                continue;
            }
            const p = clampPosition(it.position);
            const next = { x: clampCoord(p.x - cur.x), y: clampCoord(p.y - cur.y) };
            if (it.isCenter || p.x !== next.x || p.y !== next.y) {
                await base.update(it.id, { isCenter: false, position: next });
            }
        }
        return base.get(locId);
    };

    const getAccessibleLocations = (worldId, roleType, phaseId) =>
        base.list({ worldRef: worldId }).filter(loc => {
            if (Array.isArray(loc.allowedRoles) && !loc.allowedRoles.includes(roleType)) return false;
            if (Array.isArray(loc.allowedPhases) && loc.allowedPhases.length > 0) {
                if (!phaseId || !loc.allowedPhases.includes(phaseId)) return false;
            }
            return true;
        });

    const getLocationsAtPhase = (worldId, phaseId) =>
        base.list({ worldRef: worldId }).filter(loc => {
            if (Array.isArray(loc.allowedPhases) && loc.allowedPhases.length > 0) {
                if (!phaseId || !loc.allowedPhases.includes(phaseId)) return false;
            }
            return true;
        });

    const getLocationsForAi = (worldId) =>
        base.list({ worldRef: worldId }).filter(loc => {
            if (Array.isArray(loc.allowedRoles) && !loc.allowedRoles.includes('ai')) return false;
            return true;
        });

    const validateAiLocations = (aiId, worldId) => {
        const all = base.list({ worldRef: worldId });
        const idSet = new Set(all.map(l => l.id));
        const refs = [];
        const ai = cache.aiPersons.get(aiId);
        if (ai?.boundLocationRefs) refs.push(...ai.boundLocationRefs);
        const missing = refs.filter(id => !idSet.has(id));
        return { ok: missing.length === 0, missing };
    };

    const getByPlace = (worldId, placeId) =>
        base.list({ worldRef: worldId }).filter(loc => loc.placeRef === placeId);

    const getCenterByPlace = (worldId, placeId) =>
        getByPlace(worldId, placeId).find(l => l.isCenter) || null;

    const getMapDataByPlace = (worldId, placeId) => {
        const all = getByPlace(worldId, placeId);
        const center = all.find(l => l.isCenter) || all[0] || null;
        return { center, locations: all };
    };

    // 包装 update：钳制坐标
    const wrappedUpdate = async (id, patch = {}) => {
        const sanitized = { ...patch };
        if (sanitized.position && typeof sanitized.position === 'object') {
            sanitized.position = clampPosition(sanitized.position);
        }
        return base.update(id, sanitized);
    };

    return {
        ...base,
        update: wrappedUpdate,
        getCenter,
        getMapData,
        setCenterLocation,
        getAccessibleLocations,
        getLocationsAtPhase,
        getLocationsForAi,
        validateAiLocations,
        getByPlace,
        getCenterByPlace,
        getMapDataByPlace,
    };
}
