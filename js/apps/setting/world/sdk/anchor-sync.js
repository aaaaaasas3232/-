/**
 * 演员 / 电竞 App 的段锚点、点锚点 ↔ 世界观 anchors[]
 *
 * 演员世界：奖项 = 段锚点，节日 = 点锚点
 * 电竞世界：赛事 = 段锚点，节日 = 点锚点
 *
 * 两边改任何一边，都写回同一份 world.anchors，并用 source 标记来源，
 * 避免下次同步把用户在世界观里新建的锚点冲掉。
 */

const SOURCE_ACTOR = 'actor-career';
const SOURCE_ESPORTS = 'esports-forum';

function asArray(v) {
    return Array.isArray(v) ? v : [];
}

function monthFromCycle(cycleDays) {
    const n = Number(cycleDays) || 90;
    return Math.max(1, Math.min(12, Math.round(n / 30)));
}

export function awardsToRangeAnchors(awards, source = SOURCE_ACTOR) {
    return asArray(awards).filter((a) => a && a.id).map((a) => ({
        id: `sync-${source}-range-${a.id}`,
        type: 'range',
        label: a.name || '未命名段锚点',
        description: a.desc || '',
        start: { year: 0, month: 1, day: 0 },
        end: { year: 0, month: monthFromCycle(a.cycleDays), day: 0 },
        boundAiIds: [],
        enabled: a.enabled !== false,
        source,
        sourceId: a.id,
        payload: a,
    }));
}

export function tournamentsToRangeAnchors(list) {
    return asArray(list).filter((t) => t && t.id).map((t) => ({
        id: `sync-${SOURCE_ESPORTS}-range-${t.id}`,
        type: 'range',
        label: t.name || '未命名赛事',
        description: t.desc || '',
        start: { year: 0, month: 1, day: 0 },
        end: { year: 0, month: monthFromCycle(t.gapDays ? t.gapDays * 10 : 90), day: 0 },
        boundAiIds: [],
        enabled: t.enabled !== false,
        source: SOURCE_ESPORTS,
        sourceId: t.id,
        payload: t,
    }));
}

export function festivalsToPointAnchors(list, source) {
    return asArray(list).filter((f) => f && f.id).map((f) => ({
        id: `sync-${source}-point-${f.id}`,
        type: 'point',
        label: f.name || '未命名点锚点',
        description: f.desc || '',
        start: { year: 0, month: 1, day: Math.max(1, Math.min(28, Number(f.everyDays) % 28 || 1)) },
        end: null,
        boundAiIds: [],
        enabled: f.enabled !== false,
        source,
        sourceId: f.id,
        payload: f,
    }));
}

function mergeAnchors(existing, incoming, source) {
    const keep = asArray(existing).filter((a) => a && a.source !== source);
    const byId = new Map(keep.map((a) => [a.id, a]));
    for (const item of incoming) {
        const prev = asArray(existing).find((a) => a.id === item.id);
        byId.set(item.id, prev ? { ...item, boundAiIds: prev.boundAiIds || [] } : item);
    }
    return [...byId.values()];
}

export async function syncCareerAnchorsToWorld(sdk, worldId, { awards, festivals } = {}) {
    if (!sdk?.anchors || !worldId) return [];
    const incoming = [
        ...awardsToRangeAnchors(awards, SOURCE_ACTOR),
        ...festivalsToPointAnchors(festivals, SOURCE_ACTOR),
    ];
    const next = mergeAnchors(sdk.anchors.getAnchors(worldId), incoming, SOURCE_ACTOR);
    await replaceWorldAnchors(sdk, worldId, next);
    return next;
}

export async function syncEsportsAnchorsToWorld(sdk, worldId, { tournaments, festivals } = {}) {
    if (!sdk?.anchors || !worldId) return [];
    const incoming = [
        ...tournamentsToRangeAnchors(tournaments),
        ...festivalsToPointAnchors(festivals, SOURCE_ESPORTS),
    ];
    const next = mergeAnchors(sdk.anchors.getAnchors(worldId), incoming, SOURCE_ESPORTS);
    await replaceWorldAnchors(sdk, worldId, next);
    return next;
}

async function replaceWorldAnchors(sdk, worldId, next) {
    const world = sdk.worlds?.get?.(worldId);
    if (!world) return;
    world.anchors = next;
    await sdk.worlds.update(worldId, { anchors: next });
}

export function worldAnchorsToAwards(anchors) {
    return asArray(anchors)
        .filter((a) => a.source === SOURCE_ACTOR && a.type === 'range' && a.payload)
        .map((a) => ({
            ...a.payload,
            id: a.sourceId || a.payload.id,
            name: a.label || a.payload.name,
            desc: a.description || a.payload.desc,
            enabled: a.enabled !== false,
        }));
}

export function worldAnchorsToActorFestivals(anchors) {
    return asArray(anchors)
        .filter((a) => a.source === SOURCE_ACTOR && a.type === 'point' && a.payload)
        .map((a) => ({
            ...a.payload,
            id: a.sourceId || a.payload.id,
            name: a.label || a.payload.name,
            desc: a.description || a.payload.desc,
            enabled: a.enabled !== false,
        }));
}

export function worldAnchorsToTournaments(anchors) {
    return asArray(anchors)
        .filter((a) => a.source === SOURCE_ESPORTS && a.type === 'range' && a.payload)
        .map((a) => ({
            ...a.payload,
            id: a.sourceId || a.payload.id,
            name: a.label || a.payload.name,
            desc: a.description || a.payload.desc,
            enabled: a.enabled !== false,
        }));
}

export function worldAnchorsToEsportsFestivals(anchors) {
    return asArray(anchors)
        .filter((a) => a.source === SOURCE_ESPORTS && a.type === 'point' && a.payload)
        .map((a) => ({
            ...a.payload,
            id: a.sourceId || a.payload.id,
            name: a.label || a.payload.name,
            desc: a.description || a.payload.desc,
            enabled: a.enabled !== false,
        }));
}

export function seedAnchorsForPreset(presetId) {
    if (presetId === 'preset-actor-world') {
        return { source: SOURCE_ACTOR };
    }
    if (presetId === 'preset-esports-world') {
        return { source: SOURCE_ESPORTS };
    }
    return null;
}

export { SOURCE_ACTOR, SOURCE_ESPORTS };
