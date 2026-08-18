/**
 * Nook prompt SDK (v0.61).
 * Virtual context prompts are derived from settings entities; custom nook prompts
 * are persisted on the active AI person's top-level `nookPrompts` field.
 *
 * ★ 这里只做轻量占位。完整人设卡由 murmur 的 prompt-manager 用
 *   `resolvePersonaContextText` 覆盖 content —— 不要在这里 import 人设生成，
 *   否则 settings-sdk 热更新会重建实例，内存里的 appPrompts 注册表会被清空。
 */

const now = () => Date.now();
const idOf = (value, fallback) => String(value?.id || fallback || '');
const text = (value, fallback = '') => value == null ? fallback : String(value);

function personaContent(label, person) {
    if (!person) return '';
    const lines = [`# ${label}`];
    for (const [key, title] of [['name', '姓名'], ['gender', '性别'], ['age', '年龄'], ['appearance', '外貌'], ['personality', '性格'], ['bio', '简介'], ['experience', '经历']]) {
        if (person[key]) lines.push(`- ${title}: ${person[key]}`);
    }
    return lines.length > 1 ? lines.join('\n') : '';
}

function worldContent(world) {
    if (!world) return '';
    const lines = [`# 世界观: ${world.name || world.id}`];
    if (world.summary) lines.push(`- 摘要: ${world.summary}`);
    if (world.description) lines.push(`- 设定: ${world.description}`);
    return lines.join('\n');
}

export function createNookPromptsApi(sdk) {
    const getUser = () => sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.() || null;
    const getAi = (aiPersonId) => sdk?.aiPersons?.get?.(aiPersonId) || sdk?.aiPersons?.getActive?.() || null;
    const getWorld = (ai) => ai?.boundWorldId ? sdk?.worlds?.get?.(ai.boundWorldId) : null;

    const virtual = (aiPersonId) => {
        const ai = getAi(aiPersonId);
        const user = getUser();
        const state = ai?.nookPromptState || {};
        const result = [];
        if (user) result.push({ id: 'system-user-persona', kind: 'persona', label: '当前用户人设', title: '当前用户人设', content: personaContent('当前用户人设', user), source: 'nook', active: state.user !== false, order: -100, locked: true, system: true, systemKind: 'user' });
        if (ai) result.push({ id: 'system-ai-persona', kind: 'persona', label: '当前 AI 人设', title: '当前 AI 人设', content: personaContent('当前 AI 人设', ai), source: 'nook', active: state.ai !== false, order: -99, locked: true, system: true, systemKind: 'ai' });
        const world = getWorld(ai);
        if (world) result.push({ id: `nook-world-${world.id}`, kind: 'worldview', label: world.name || '当前世界观', title: world.name || '当前世界观', content: worldContent(world), source: 'nook', active: state.world !== false, order: -98, locked: false });
        return result;
    };

    const list = (aiPersonId) => {
        const ai = getAi(aiPersonId);
        const custom = Array.isArray(ai?.nookPrompts) ? ai.nookPrompts : [];
        return [...virtual(aiPersonId), ...custom].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    };
    const persist = async (aiPersonId, prompts) => sdk?.aiPersons?.update?.(aiPersonId, { nookPrompts: prompts });

    return {
        list,
        get: (aiPersonId, promptId) => list(aiPersonId).find((p) => p.id === promptId) || null,
        async toggle(aiPersonId, promptId) {
            const item = list(aiPersonId).find((p) => p.id === promptId);
            if (!item || item.locked && !['system-user-persona', 'system-ai-persona'].includes(promptId)) return null;
            if (item.system) return persist(aiPersonId, { ...(getAi(aiPersonId)?.nookPromptState || {}), [item.systemKind]: !item.active }).then(() => ({ ...item, active: !item.active }));
            return this.update(aiPersonId, promptId, { active: !item.active });
        },
        async reorder(aiPersonId, ids = []) {
            const ai = getAi(aiPersonId); const custom = Array.isArray(ai?.nookPrompts) ? ai.nookPrompts : [];
            const map = new Map(custom.map((p) => [p.id, p])); let order = 0;
            const next = [];
            for (const id of ids) if (map.has(id)) { next.push({ ...map.get(id), order: order++ }); map.delete(id); }
            next.push(...map.values().map((p) => ({ ...p, order: order++ })));
            await persist(aiPersonId, next); return list(aiPersonId);
        },
        async add(aiPersonId, patch = {}) {
            const ai = getAi(aiPersonId); if (!ai || !patch.title) return null;
            const record = { id: patch.id || `nook-${now().toString(36)}`, kind: patch.kind || 'custom', label: text(patch.label || patch.title), title: text(patch.title), content: text(patch.content), source: text(patch.source, 'nook'), active: patch.active !== false, order: list(aiPersonId).length, createdAt: now(), updatedAt: now() };
            await persist(aiPersonId, [...(ai.nookPrompts || []), record]); return record;
        },
        async update(aiPersonId, promptId, patch = {}) {
            const ai = getAi(aiPersonId); const current = (ai?.nookPrompts || []).find((p) => p.id === promptId); if (!current) return null;
            const updated = { ...current, ...patch, id: current.id, updatedAt: now() }; await persist(aiPersonId, (ai.nookPrompts || []).map((p) => p.id === promptId ? updated : p)); return updated;
        },
    };
}
