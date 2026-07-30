/**
 * settings-sdk · 时间线系统（v0.11 简化为 2 类）
 *
 *   - personal：每个角色一份（user / ai-xxx）。
 *   - world：   世界观共享（春季赛、世界级纪念日等）。
 *
 * 存储位置：每个 world 实例的 `timelines: { personal: { user: [...] }, world: [...] }`。
 */

import { TIMELINE_TYPES, TIMELINE_CATEGORIES, uniqueId } from './defaults.js';
import { mapGet, now } from './helpers.js';

const SDK_STORES_WORLD = 'sdkWorlds';

// ============================================
// 工厂
// ============================================

export function createTimelinesApi({ toolkit, cache, events, bump }) {
    const ensureWorld = (worldId) => mapGet(cache.worlds, worldId);

    const ensureTimelines = (world) => {
        world.timelines ||= {
            personal: { user: [] },
            world: [],
        };
        return world.timelines;
    };

    const persistWorld = async (world) => {
        world.updatedAt = now();
        cache.worlds.set(world.id, world);
        if (toolkit?.db) await toolkit.db.put(SDK_STORES_WORLD, world);
        return world;
    };

    // ============================================
    // 读
    // ============================================

    const getTimeline = (worldId, type = TIMELINE_TYPES.PERSONAL) => {
        const world = ensureWorld(worldId);
        if (!world) return [];
        const timelines = ensureTimelines(world);
        return timelines[type] || [];
    };

    const getPersonalTimeline = (worldId, ownerKey = 'user') => {
        const world = ensureWorld(worldId);
        if (!world) return [];
        const timelines = ensureTimelines(world);
        return timelines.personal?.[ownerKey] || [];
    };

    const getWorldTimeline = (worldId) => getTimeline(worldId, TIMELINE_TYPES.WORLD);

    // ============================================
    // 增删改
    // ============================================

    const addTimelineEvent = async (worldId, type, data = {}) => {
        const world = ensureWorld(worldId);
        if (!world) return null;
        const timelines = ensureTimelines(world);
        const t = now();
        const event = {
            id: data.id || uniqueId('tlevt'),
            type,
            ownerKey: data.ownerKey || (type === TIMELINE_TYPES.WORLD ? 'world' : 'user'),
            title: data.title || '',
            date: data.date || '',
            category: data.category || TIMELINE_CATEGORIES.ROUTINE,
            description: data.description || '',
            createdAt: t,
            updatedAt: t,
        };

        if (type === TIMELINE_TYPES.WORLD) {
            timelines.world.push(event);
        } else {
            timelines.personal ||= {};
            const owner = event.ownerKey;
            timelines.personal[owner] ||= [];
            timelines.personal[owner].push(event);
        }

        await persistWorld(world);
        bump('timelines', 'add', event);
        return event;
    };

    const updateTimelineEvent = async (worldId, eventId, patch = {}) => {
        const world = ensureWorld(worldId);
        if (!world) return null;
        const timelines = ensureTimelines(world);
        const target =
            timelines.world.find(e => e.id === eventId)
            || Object.values(timelines.personal || {}).flat().find(e => e.id === eventId);
        if (!target) return null;
        Object.assign(target, patch, { id: target.id, updatedAt: now() });
        await persistWorld(world);
        bump('timelines', 'update', target);
        return target;
    };

    const deleteTimelineEvent = async (worldId, eventId) => {
        const world = ensureWorld(worldId);
        if (!world) return false;
        const timelines = ensureTimelines(world);

        // 在 world 里删
        const wi = timelines.world.findIndex(e => e.id === eventId);
        if (wi >= 0) {
            timelines.world.splice(wi, 1);
            await persistWorld(world);
            bump('timelines', 'remove', { id: eventId });
            return true;
        }
        // 在 personal 里删
        for (const list of Object.values(timelines.personal || {})) {
            const pi = list.findIndex(e => e.id === eventId);
            if (pi >= 0) {
                list.splice(pi, 1);
                await persistWorld(world);
                bump('timelines', 'remove', { id: eventId });
                return true;
            }
        }
        return false;
    };

    return {
        getTimeline, getPersonalTimeline, getWorldTimeline,
        addTimelineEvent, updateTimelineEvent, deleteTimelineEvent,
    };
}