/**
 * settings-sdk · 人设 (Persona) 业务层
 *
 *   - 挂在 aiPersons / users 上，提供「模块开关 / 阶段 / parO / 资源绑定 / 每日计算」等
 *     人设相关操作。
 *   - 直接读写 entity 实例（已通过 createEntityApi 暴露 list / get / create / update）。
 *
 * 设计：
 *   - 所有更新都走 aiPersons.update(id, patch) / users.update(id, patch)，由 settings-sdk
 *     统一落盘 + 触发 'settings-sdk:change' 事件。
 *   - 模块开关的语义：persona[moduleKey] = { enabled, injectToPrompt, ...moduleFields }
 *   - 独立卡（人生阶段 / parO）与来源卡保存在同一个实体库，通过来源字段关联。
 *   - 旧 lifePhases / parOs 嵌套结构仅供启动迁移。
 *
 * 约定：
 *   - 'persona' scope 不会重复创建 moduleFlag = false 的字段，保底使用 defaults.js 的结构。
 */

import { now } from './helpers.js';
import { DEFAULT_AI_INSTANCE, DEFAULT_USER_INSTANCE } from './defaults.js';

const MODULE_KEYS = [
    'preferences',
    'schedule',
    'rhythm',
    'mood',
    'memory',
    'worldview',
    'mbti',
    'psychological',
    'moral',
    'skills',
    // ★ v0.22 资源绑定（独立 section，但保留模块开关语义，跟其它模块一致）
    'resources',
    // ★ 资产说明开关（控制 assetDescription 是否注入 AI 上下文）
    'assetNotes',
    // ★ v0.30+ 空间模块（人设主页的「空间」卡：绑定的世界观 / 当前所在 / 可去场所 / 今日日程）
    'space',
];

/** 根据 entityType 拿到 defaults（不依赖 aiPersons scope 来反查）。 */
function getDefaultsFor(entityType) {
    return entityType === 'user' ? DEFAULT_USER_INSTANCE : DEFAULT_AI_INSTANCE;
}

/** 取到 entity api（list / get / update）。*/
function pickEntityApi(sdk, entityType) {
    return entityType === 'user' ? sdk.users : sdk.aiPersons;
}

/** 给定 persona + moduleKey，返回具体的模块数据；缺则用 defaults。 */
export function getModule(persona, moduleKey, entityType = 'ai') {
    if (!persona) return null;
    const data = persona[moduleKey];
    if (data && typeof data === 'object') return data;
    const def = getDefaultsFor(entityType);
    return def[moduleKey] || { enabled: false, injectMode: 'none' };
}

/**
 * 切换 / 启用某个模块。会保留已有字段，只覆写 enabled 状态。
 * @returns object|null 新的模块对象
 */
export async function toggleModule(sdk, entityType, personaId, moduleKey, enabled) {
    if (!MODULE_KEYS.includes(moduleKey)) return null;
    const api = pickEntityApi(sdk, entityType);
    const persona = api.get(personaId);
    if (!persona) return null;
    const def = getDefaultsFor(entityType);
    const prev = persona[moduleKey] || def[moduleKey] || { enabled: false, injectMode: 'none' };
    const next = { ...prev, enabled: !!enabled };
    await api.update(personaId, { [moduleKey]: next });
    return next;
}

/** 切换模块 injectMode（none / current / full）。*/
export async function setModuleInject(sdk, entityType, personaId, moduleKey, injectMode) {
    if (!MODULE_KEYS.includes(moduleKey)) return null;
    const api = pickEntityApi(sdk, entityType);
    const persona = api.get(personaId);
    if (!persona) return null;
    const def = getDefaultsFor(entityType);
    const prev = persona[moduleKey] || def[moduleKey] || { enabled: false, injectMode: 'none' };
    const validModes = ['none', 'current', 'full'];
    const mode = validModes.includes(injectMode) ? injectMode : 'none';
    const next = { ...prev, injectMode: mode };
    await api.update(personaId, { [moduleKey]: next });
    return next;
}

/**
 * 通用模块字段更新。
 *   - 会根据 schema 把 listField（多行文本）由 string → 字符串数组，避免存脏数据。
 *   - 不传的字段保持旧值。
 *   - 允许更新「编辑器已经隐藏、但仍有 UI 维护」的模块字段（例如作息 schedule，
 *     只在主页卡片编辑），因此不做白名单限制。
 *   - 但模块存在必须 sanity check：必须命中 GET_PERSONA_GROUPS 里至少一个
 *     key 已知字段或默认模块（preferences / habits / memory / schedule / habitPrefs）。
 */
export async function updateModule(sdk, entityType, personaId, moduleKey, patch = {}) {
    const api = pickEntityApi(sdk, entityType);
    const persona = api.get(personaId);
    if (!persona) return null;
    const def = getDefaultsFor(entityType);
    const prev = persona[moduleKey] || def[moduleKey] || { enabled: false, injectMode: 'none' };
    const base = typeof prev === 'object' ? prev : {};

    /* 字段归一化：listField 多行 string → 数组 */
    const listFields = collectListFieldKeys(moduleKey);
    const cleaned = { ...patch };
    for (const key of listFields) {
        if (key in cleaned) {
            const v = cleaned[key];
            if (typeof v === 'string') {
                cleaned[key] = v.split('\n').map(s => s.trim()).filter(Boolean);
            } else if (v == null || v === '') {
                cleaned[key] = [];
            }
        }
    }

    const next = { ...base, ...cleaned };
    await api.update(personaId, { [moduleKey]: next });
    return next;
}

/* 拿某个模块里所有 listField 字段的 key，方便上面归一化。
   注：schema 里的 SCHEDULE_FIELDS 等没有对外 export，故这里直接按字段名硬编码
   即可；规模只有几个字段，加注释就清晰。*/
function collectListFieldKeys(moduleKey) {
    switch (moduleKey) {
        // rhythm.entries 是结构化数组，不走 listField 归一化
        default: return [];
    }
}

/* ============================================
 * 独立阶段卡 / parO 卡
 * ============================================ */

function cloneValue(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

function normalizeRootId(persona) {
    return persona?.rootPersonaId || persona?.parentPersonaId || persona?.id || '';
}

function stripCloneRuntimeFields(clone) {
    clone.lifePhases = [];
    clone.activeLifePhaseId = '';
    clone.parOs = [];
    clone.lastCalculatedDate = '';
    clone.dailyMood = '';
    clone.customContext = null;
    return clone;
}

export function listVariantCards(sdk, entityType, sourceId, variantType = '') {
    const api = pickEntityApi(sdk, entityType);
    const source = api.get(sourceId);
    if (!source) return [];
    const rootId = normalizeRootId(source);
    return api.list().filter((card) => {
        if (!card || card.id === sourceId) return false;
        if (variantType && card.variantType !== variantType) return false;
        return card.parentPersonaId === sourceId || card.rootPersonaId === rootId;
    });
}

export async function createVariantCard(sdk, entityType, sourceId, variantType, overrides = {}) {
    const api = pickEntityApi(sdk, entityType);
    const source = api.get(sourceId);
    if (!source || !['lifePhase', 'paro'].includes(variantType)) return null;

    const clone = stripCloneRuntimeFields(cloneValue(source));
    if (overrides.personaPatch && typeof overrides.personaPatch === 'object') {
        Object.assign(clone, cloneValue(overrides.personaPatch));
    }
    delete clone.id;
    delete clone.createdAt;
    delete clone.updatedAt;
    clone.variantType = variantType;
    clone.parentPersonaId = sourceId;
    clone.rootPersonaId = normalizeRootId(source);
    clone.name = overrides.name || `${source.name || source.id} · ${variantType === 'lifePhase' ? '新阶段' : 'parO'}`;
    if (variantType === 'lifePhase') {
        const ageRaw = overrides.age;
        const ageNum = ageRaw === '' || ageRaw == null ? null : Number(ageRaw);
        clone.age = Number.isFinite(ageNum) ? ageNum : (source.age ?? null);
        clone.phaseMeta = {
            name: overrides.phaseName || '',
            age: Number.isFinite(ageNum) ? ageNum : null,
            timelinePrompt: overrides.timelinePrompt || '',
        };
    } else {
        clone.phaseMeta = { name: '', age: null, timelinePrompt: overrides.timelinePrompt || '' };
    }
    clone.boundWorldId = variantType === 'lifePhase'
        ? source.boundWorldId || ''
        : overrides.boundWorldId || '';
    return api.create(clone);
}

export async function removeVariantCard(sdk, entityType, sourceId, cardId, variantType = '') {
    const api = pickEntityApi(sdk, entityType);
    const card = api.get(cardId);
    if (!card || card.id === sourceId) return false;
    if (variantType && card.variantType !== variantType) return false;
    const source = api.get(sourceId);
    const rootId = normalizeRootId(source);
    if (card.parentPersonaId !== sourceId && card.rootPersonaId !== rootId) return false;
    return api.remove(cardId);
}

export async function migrateLegacyVariantCards(sdk) {
    let migrated = 0;
    for (const entityType of ['user', 'ai']) {
        const api = pickEntityApi(sdk, entityType);
        const parents = api.list().filter(card => !card.variantType || card.variantType === 'base');
        for (const parent of parents) {
            const phases = Array.isArray(parent.lifePhases) ? parent.lifePhases : [];
            const parOs = Array.isArray(parent.parOs) ? parent.parOs : [];
            for (const phase of phases) {
                await createVariantCard(sdk, entityType, parent.id, 'lifePhase', {
                    name: `${parent.name || parent.id} · ${phase.name || '阶段'}`,
                    phaseName: phase.name || '',
                    ageRange: phase.ageRange,
                    timelinePrompt: phase.description || '',
                });
                migrated++;
            }
            for (const legacy of parOs) {
                await createVariantCard(sdk, entityType, parent.id, 'paro', {
                    ...legacy,
                    name: legacy.name || `${parent.name || parent.id} · parO`,
                    boundWorldId: legacy.boundWorldId || '',
                });
                migrated++;
            }
            if (phases.length || parOs.length) {
                await api.update(parent.id, { lifePhases: [], activeLifePhaseId: '', parOs: [] });
            }
        }
    }
    return migrated;
}

/* ============================================
 * 旧嵌套人生阶段（仅兼容历史调用）
 * ============================================ */

/** 生成阶段 ID。 */
function genPhaseId() {
    return `phase-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 列出阶段（按 order 排序）。 */
export function getLifePhases(persona) {
    if (!persona) return [];
    const list = Array.isArray(persona.lifePhases) ? persona.lifePhases : [];
    return list.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** 当前激活阶段对象（找不到则 null）。*/
export function getActiveLifePhase(persona) {
    if (!persona) return null;
    const id = persona.activeLifePhaseId;
    if (!id) return null;
    const phases = Array.isArray(persona.lifePhases) ? persona.lifePhases : [];
    return phases.find(p => p.id === id) || null;
}

/** 切换激活阶段。 */
export async function activateLifePhase(sdk, entityType, personaId, phaseId) {
    const api = pickEntityApi(sdk, entityType);
    const persona = api.get(personaId);
    if (!persona) return null;
    await api.update(personaId, { activeLifePhaseId: phaseId || '' });
    return api.get(personaId);
}

/** 增加阶段。 */
export async function addLifePhase(sdk, entityType, personaId, data = {}) {
    const api = pickEntityApi(sdk, entityType);
    const persona = api.get(personaId);
    if (!persona) return null;
    const list = Array.isArray(persona.lifePhases) ? persona.lifePhases.slice() : [];
    const order = list.length;
    const phase = {
        id: data.id || genPhaseId(),
        order,
        name: data.name || '新阶段',
        ageRange: Array.isArray(data.ageRange) ? data.ageRange : null,
        tone: data.tone || '',
        description: data.description || '',
        locationRefs: Array.isArray(data.locationRefs) ? data.locationRefs : [],
        activePlaceIds: Array.isArray(data.activePlaceIds) ? data.activePlaceIds : [],
        mood: data.mood || '',
    };
    list.push(phase);
    await api.update(personaId, { lifePhases: list });
    return phase;
}

/** 删除阶段。同时取消激活（如果是当前）。 */
export async function removeLifePhase(sdk, entityType, personaId, phaseId) {
    const api = pickEntityApi(sdk, entityType);
    const persona = api.get(personaId);
    if (!persona) return null;
    const list = (Array.isArray(persona.lifePhases) ? persona.lifePhases : [])
        .filter(p => p.id !== phaseId);
    const patch = { lifePhases: list };
    if (persona.activeLifePhaseId === phaseId) patch.activeLifePhaseId = '';
    await api.update(personaId, patch);
    return api.get(personaId);
}

/** 更新阶段字段（merged）。 */
export async function updateLifePhase(sdk, entityType, personaId, phaseId, data = {}) {
    const api = pickEntityApi(sdk, entityType);
    const persona = api.get(personaId);
    if (!persona) return null;
    const list = (Array.isArray(persona.lifePhases) ? persona.lifePhases : []).map(p => {
        if (p.id !== phaseId) return p;
        return {
            ...p,
            ...data,
            id: p.id,
            ageRange: data.ageRange !== undefined ? data.ageRange : p.ageRange,
        };
    });
    await api.update(personaId, { lifePhases: list });
    return list.find(p => p.id === phaseId) || null;
}

/* ============================================
 * parO 平行卡
 * ============================================ */

function genParOId(parentId) {
    return `${parentId}-paro-${Date.now().toString(36).slice(-4)}`;
}

/** 列出 parO（from persona.parOs）。 */
export function getParOs(persona) {
    if (!persona) return [];
    return Array.isArray(persona.parOs) ? persona.parOs : [];
}

/** 复制本体为 parO。 */
export async function cloneParO(sdk, entityType, personaId, overrides = {}) {
    const api = pickEntityApi(sdk, entityType);
    const parent = api.get(personaId);
    if (!parent) return null;
    const newId = overrides.id || genParOId(personaId);
    const parO = {
        ...JSON.parse(JSON.stringify(parent)),
        ...overrides,
        id: newId,
        isParO: true,
        parentId: personaId,
        parOCreatedAt: now(),
        name: overrides.name || `${parent.name || parent.id} (parO)`,
        createdAt: now(),
        updatedAt: now(),
    };
    const list = Array.isArray(parent.parOs) ? parent.parOs.slice() : [];
    list.push(parO);
    await api.update(personaId, { parOs: list });
    return parO;
}

/** 删除 parO。 */
export async function removeParO(sdk, entityType, personaId, parOId) {
    const api = pickEntityApi(sdk, entityType);
    const persona = api.get(personaId);
    if (!persona) return null;
    const list = (Array.isArray(persona.parOs) ? persona.parOs : []).filter(p => p.id !== parOId);
    await api.update(personaId, { parOs: list });
    return api.get(personaId);
}

/** 编辑 parO（替换）。 */
export async function updateParO(sdk, entityType, personaId, parOId, data) {
    const api = pickEntityApi(sdk, entityType);
    const persona = api.get(personaId);
    if (!persona) return null;
    const list = (Array.isArray(persona.parOs) ? persona.parOs : []).map(p =>
        p.id === parOId ? { ...p, ...data, id: parOId, updatedAt: now() } : p
    );
    await api.update(personaId, { parOs: list });
    return list.find(p => p.id === parOId) || null;
}

/* ============================================
 * 资源绑定 (bound resources)
 * ============================================ */

/** 默认的资源绑定结构（向后兼容旧字段）。 */
export function getBoundResources(persona) {
    if (!persona) {
        return {
            avatarGroupIds: [],
            stickerGroupIds: [],
            apiRefs: [],
            promptIds: [],
        };
    }
    const prev = persona.boundResources || {};
    return {
        // v0.18+ 新结构：按图组绑定
        avatarGroupIds: Array.isArray(prev.avatarGroupIds) ? prev.avatarGroupIds : [],
        stickerGroupIds: Array.isArray(prev.stickerGroupIds) ? prev.stickerGroupIds : [],
        apiRefs: Array.isArray(prev.apiRefs) ? prev.apiRefs : [],
        promptIds: Array.isArray(prev.promptIds) ? prev.promptIds : [],
        // 旧字段（avatarLibraryId / stickerLibraryId / apiAccounts）保留读，
        // 但写入时只更新新结构；旧字段不再展示。
        _legacy: {
            avatarLibraryId: typeof prev.avatarLibraryId === 'string' ? prev.avatarLibraryId : '',
            stickerLibraryId: typeof prev.stickerLibraryId === 'string' ? prev.stickerLibraryId : '',
            apiAccounts: Array.isArray(prev.apiAccounts) ? prev.apiAccounts : [],
        },
    };
}

export async function updateBoundResources(sdk, entityType, personaId, data) {
    const api = pickEntityApi(sdk, entityType);
    const persona = api.get(personaId);
    if (!persona) return null;
    const prev = getBoundResources(persona);
    // 只允许更新新结构字段
    const allowed = ['avatarGroupIds', 'stickerGroupIds', 'apiRefs', 'promptIds'];
    const next = { ...prev };
    for (const k of allowed) {
        if (k in data) next[k] = data[k];
    }
    await api.update(personaId, { boundResources: next });
    return getBoundResources(api.get(personaId));
}

/* ============================================
 * 每日计算 / 心情概率
 * ============================================ */

/** 简单加权抽卡：从 weights 里随机选一个 key。 */
function weightedPickSimple(weights = {}) {
    const entries = Object.entries(weights).filter(([, w]) => Number(w) > 0);
    if (entries.length === 0) return '';
    const total = entries.reduce((sum, [, w]) => sum + Number(w), 0);
    let r = Math.random() * total;
    for (const [key, w] of entries) {
        r -= Number(w);
        if (r <= 0) return key;
    }
    return entries[entries.length - 1][0];
}

/** 当日心情。如果今日已计算过就直接返回。 */
export async function dailyCalculate(sdk, entityType, personaId) {
    const api = pickEntityApi(sdk, entityType);
    const persona = api.get(personaId);
    if (!persona) return null;
    const today = new Date().toISOString().split('T')[0];
    if (persona.lastCalculatedDate === today && persona.dailyMood) return persona;

    const mood = persona.moodProbability?.enabled
        ? weightedPickSimple(persona.moodProbability.weights || {})
        : '';
    await api.update(personaId, {
        lastCalculatedDate: today,
        dailyMood: mood,
    });
    return api.get(personaId);
}

/** 重投今日心情。 */
export async function rollMood(sdk, entityType, personaId) {
    const api = pickEntityApi(sdk, entityType);
    const persona = api.get(personaId);
    if (!persona) return null;
    const weights = persona.moodProbability?.weights || {};
    const mood = weightedPickSimple(weights);
    await api.update(personaId, { dailyMood: mood });
    return mood;
}

/** 更新心情权重。 */
export async function setMoodWeights(sdk, entityType, personaId, weights) {
    const api = pickEntityApi(sdk, entityType);
    const persona = api.get(personaId);
    if (!persona) return null;
    const prev = persona.moodProbability || { enabled: false, weights: {} };
    await api.update(personaId, {
        moodProbability: { ...prev, weights: weights || {} },
    });
    return api.get(personaId).moodProbability;
}

/* ============================================
 * 工厂：人设 SDK（在 settings-sdk 里挂载）
 * ============================================ */

/**
 * 把人设 API 装到 settingsSdk.persona 上。
 * @param {object} sdk settingsSdk 实例
 * @returns {object} persona 对象
 */
export function bindPersona(sdk) {
    return {
        module: {
            list: MODULE_KEYS.slice(),
            get: (persona, key) => getModule(persona, key),
            toggle: (entityType, id, key, on) => toggleModule(sdk, entityType, id, key, on),
            setInject: (entityType, id, key, on) => setModuleInject(sdk, entityType, id, key, on),
            update: (entityType, id, key, patch) => updateModule(sdk, entityType, id, key, patch),
        },
        variants: {
            list: (entityType, sourceId, variantType) => listVariantCards(sdk, entityType, sourceId, variantType),
            create: (entityType, sourceId, variantType, overrides) => createVariantCard(sdk, entityType, sourceId, variantType, overrides),
            remove: (entityType, sourceId, cardId, variantType) => removeVariantCard(sdk, entityType, sourceId, cardId, variantType),
            migrateLegacy: () => migrateLegacyVariantCards(sdk),
            // TODO: 接入 API 后，将来源卡 + timelinePrompt 发送给模型并返回可合并的人设 patch。
            async generateDraft() { return null; },
        },
        phases: {
            list: getLifePhases,
            active: getActiveLifePhase,
            add: (entityType, id, data) => addLifePhase(sdk, entityType, id, data),
            update: (entityType, id, phaseId, data) => updateLifePhase(sdk, entityType, id, phaseId, data),
            remove: (entityType, id, phaseId) => removeLifePhase(sdk, entityType, id, phaseId),
            activate: (entityType, id, phaseId) => activateLifePhase(sdk, entityType, id, phaseId),
        },
        paro: {
            list: getParOs,
            clone: (entityType, id, overrides) => cloneParO(sdk, entityType, id, overrides),
            update: (entityType, id, parOId, data) => updateParO(sdk, entityType, id, parOId, data),
            remove: (entityType, id, parOId) => removeParO(sdk, entityType, id, parOId),
        },
        resources: {
            get: getBoundResources,
            update: (entityType, id, data) => updateBoundResources(sdk, entityType, id, data),
        },
        probability: {
            roll: (entityType, id) => rollMood(sdk, entityType, id),
            dailyCalculate: (entityType, id) => dailyCalculate(sdk, entityType, id),
            setWeights: (entityType, id, weights) => setMoodWeights(sdk, entityType, id, weights),
        },
    };
}
