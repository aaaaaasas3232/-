/**
 * settings-sdk · 时间锚点（Chronology Anchors）v0.16
 *
 * 概念：
 *   - 「段锚点」按「中周期级」定义一段范围（例：11月-2月 春季赛）。
 *   - 「点锚点」按「基周期级」定义一个具体日期（例：2021.2.5 往后所有 2.5 是 [xx 的纪念日]）。
 *   - 锚点可绑定 AI，用于后续给 AI 注入提示（待开发）。
 *
 * 数据模型：
 *   - 存在每个 world 实例的 `anchors` 数组里，切世界时跟着走。
 *   - 每条 anchor：
 *       { id, worldRef, type: 'range' | 'point', label, description,
 *         start: { year, month, day },    // 段锚点 + 点锚点都用
 *         end:   { year, month, day },    // 仅段锚点用，点锚点为 null
 *         boundAiIds: [aiId, ...],         // 绑定的 AI（待开发占位字段）
 *         createdAt, updatedAt }
 *
 * 关键 API：
 *   - getAnchors(worldId, type?)
 *   - createAnchor(worldId, data)
 *   - updateAnchor(worldId, anchorId, patch)
 *   - deleteAnchor(worldId, anchorId)
 *   - bindAnchorToAi(worldId, anchorId, aiId)         // 待开发占位
 *   - unbindAnchorFromAi(worldId, anchorId, aiId)
 */

import { uniqueId } from './defaults.js';
import { mapGet, now } from './helpers.js';

const SDK_STORES_WORLD = 'sdkWorlds';

const ensureWorld = (cache, worldId) => mapGet(cache.worlds, worldId);
const ensureAnchorList = (world) => (world.anchors ||= []);

const persistWorld = async (toolkit, world) => {
    if (!toolkit?.db) return;
    await toolkit.db.put(SDK_STORES_WORLD, world);
};

const commitWorld = async (toolkit, cache, world) => {
    world.updatedAt = now();
    cache.worlds.set(world.id, world);
    await persistWorld(toolkit, world);
    return world;
};

const sanitizeTimeField = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const y = Number(raw.year) || 0;
    const m = Number(raw.month) || 0;
    const d = Number(raw.day) || 0;
    return { year: y, month: m, day: d };
};

export function createAnchorsApi({ toolkit, cache, events, bump }) {
    const getAnchors = (worldId, type = null) => {
        const world = ensureWorld(cache, worldId);
        if (!world) return [];
        const list = ensureAnchorList(world);
        return type ? list.filter(a => a.type === type) : list.slice();
    };

    const getAnchorById = (worldId, anchorId) => {
        const world = ensureWorld(cache, worldId);
        if (!world) return null;
        return ensureAnchorList(world).find(a => a.id === anchorId) || null;
    };

    const createAnchor = async (worldId, data = {}) => {
        const world = ensureWorld(cache, worldId);
        if (!world) return null;
        const list = ensureAnchorList(world);
        const t = now();
        const anchor = {
            id: data.id || uniqueId('anchor'),
            worldRef: worldId,
            type: data.type === 'point' ? 'point' : 'range',
            label: data.label || (data.type === 'point' ? '新点锚点' : '新段锚点'),
            description: data.description || '',
            start: sanitizeTimeField(data.start) || { year: 0, month: 0, day: 0 },
            end: data.type === 'point' ? null : (sanitizeTimeField(data.end) || { year: 0, month: 0, day: 0 }),
            boundAiIds: Array.isArray(data.boundAiIds) ? data.boundAiIds.slice() : [],
            enabled: data.enabled !== false,    // 默认启用
            createdAt: t,
            updatedAt: t,
        };
        list.push(anchor);
        await commitWorld(toolkit, cache, world);
        bump('anchors', 'create', anchor);
        return anchor;
    };

    const updateAnchor = async (worldId, anchorId, patch = {}) => {
        const world = ensureWorld(cache, worldId);
        const anchor = getAnchorById(worldId, anchorId);
        if (!world || !anchor) return null;
        // 仅放白名单字段
        const next = { ...anchor };
        if (typeof patch.label === 'string') next.label = patch.label;
        if (typeof patch.description === 'string') next.description = patch.description;
        if (patch.start) next.start = sanitizeTimeField(patch.start);
        if (anchor.type === 'range' && patch.end) next.end = sanitizeTimeField(patch.end);
        if (Array.isArray(patch.boundAiIds)) next.boundAiIds = patch.boundAiIds.slice();
        if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;
        next.id = anchor.id;
        next.worldRef = anchor.worldRef;
        next.type = anchor.type;
        next.updatedAt = now();

        // 替换数组里的对象
        const list = ensureAnchorList(world);
        const idx = list.findIndex(a => a.id === anchorId);
        if (idx >= 0) list[idx] = next;

        await commitWorld(toolkit, cache, world);
        bump('anchors', 'update', next);
        return next;
    };

    const deleteAnchor = async (worldId, anchorId) => {
        const world = ensureWorld(cache, worldId);
        if (!world) return false;
        const list = ensureAnchorList(world);
        const idx = list.findIndex(a => a.id === anchorId);
        if (idx < 0) return false;
        list.splice(idx, 1);
        await commitWorld(toolkit, cache, world);
        bump('anchors', 'remove', { id: anchorId });
        return true;
    };

    // ★ 段锚点（type=range）：按中周期（月）级定义一段范围。
    //   start / end 形如 { year, month }，day 字段忽略。
    const createRangeAnchor = async (worldId, data = {}) =>
        createAnchor(worldId, { ...data, type: 'range' });

    // ★ 点锚点（type=point）：按基周期（日）级定义一个具体日期。
    //   start 形如 { year, month, day }。
    const createPointAnchor = async (worldId, data = {}) =>
        createAnchor(worldId, { ...data, type: 'point', end: null });

    // ★ 后续开发：绑定 AI 到锚点（用于给 AI 提醒/上下文）
    const bindAnchorToAi = async (worldId, anchorId, aiId) => {
        const anchor = getAnchorById(worldId, anchorId);
        if (!anchor) return null;
        const set = new Set(anchor.boundAiIds || []);
        set.add(aiId);
        return updateAnchor(worldId, anchorId, { boundAiIds: Array.from(set) });
    };

    const unbindAnchorFromAi = async (worldId, anchorId, aiId) => {
        const anchor = getAnchorById(worldId, anchorId);
        if (!anchor) return null;
        const next = (anchor.boundAiIds || []).filter(id => id !== aiId);
        return updateAnchor(worldId, anchorId, { boundAiIds: next });
    };

    return {
        // 主入口
        getAnchors, getAnchorById,
        createAnchor, updateAnchor,
        // v0.16：兼容 library.js / methods.js 习惯用的别名
        //   remove = delete, toggle = 翻转 enabled, create = createAnchor
        deleteAnchor,
        remove: deleteAnchor,          // 别名
        toggle: async (worldId, anchorId) => {
            const cur = getAnchorById(worldId, anchorId);
            if (!cur) return null;
            return updateAnchor(worldId, anchorId, { enabled: !cur.enabled });
        },
        // 便捷类型
        create: createAnchor,
        createRangeAnchor, createPointAnchor,
        // AI 绑定
        bindAnchorToAi, unbindAnchorFromAi,
        bindAi: bindAnchorToAi,        // 别名
        unbindAi: unbindAnchorFromAi,  // 别名
    };
}