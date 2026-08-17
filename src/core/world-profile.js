/**
 * 世界档案与跨 App 世界观能力。
 *
 * 这是业务 App 读取「默认用户 + 绑定世界观」的唯一推荐入口。过去求职、购物
 * 各自复制了一份读取逻辑，细节已经开始分叉；旅游、博客、视频和专属世界 App
 * 再继续复制，只会让切换用户后的分档行为越来越不一致。
 */

export const WORLD_MODES = Object.freeze({
    GENERAL: 'general',
    CULTIVATION: 'cultivation',
    APOCALYPSE: 'apocalypse',
    ESPORTS: 'esports',
    ACTOR: 'actor',
    IDOL: 'idol',
});

export const WORLD_MODE_SPECS = Object.freeze({
    [WORLD_MODES.GENERAL]: Object.freeze({
        label: '通用世界',
        defaultOccupation: '',
        exclusiveAppIds: Object.freeze([]),
        replacesAppIds: Object.freeze([]),
    }),
    [WORLD_MODES.CULTIVATION]: Object.freeze({
        label: '修仙',
        defaultOccupation: '修行者',
        exclusiveAppIds: Object.freeze(['cultivation']),
        replacesAppIds: Object.freeze([]),
    }),
    [WORLD_MODES.APOCALYPSE]: Object.freeze({
        label: '末日',
        defaultOccupation: '幸存者',
        exclusiveAppIds: Object.freeze(['apocalypse']),
        replacesAppIds: Object.freeze([]),
    }),
    [WORLD_MODES.ESPORTS]: Object.freeze({
        label: '电竞',
        defaultOccupation: '电竞选手',
        exclusiveAppIds: Object.freeze(['esports-forum', 'esports-game']),
        replacesAppIds: Object.freeze(['job']),
    }),
    [WORLD_MODES.ACTOR]: Object.freeze({
        label: '演员',
        defaultOccupation: '演员',
        exclusiveAppIds: Object.freeze(['actor-career']),
        replacesAppIds: Object.freeze(['job']),
    }),
    [WORLD_MODES.IDOL]: Object.freeze({
        label: '爱豆',
        defaultOccupation: '爱豆',
        exclusiveAppIds: Object.freeze(['idol-career']),
        replacesAppIds: Object.freeze(['job']),
    }),
});

const MODE_ALIASES = new Map([
    ['general', WORLD_MODES.GENERAL],
    ['通用', WORLD_MODES.GENERAL],
    ['普通', WORLD_MODES.GENERAL],
    ['cultivation', WORLD_MODES.CULTIVATION],
    ['xianxia', WORLD_MODES.CULTIVATION],
    ['修仙', WORLD_MODES.CULTIVATION],
    ['仙侠', WORLD_MODES.CULTIVATION],
    ['apocalypse', WORLD_MODES.APOCALYPSE],
    ['postapocalypse', WORLD_MODES.APOCALYPSE],
    ['末日', WORLD_MODES.APOCALYPSE],
    ['末世', WORLD_MODES.APOCALYPSE],
    ['esports', WORLD_MODES.ESPORTS],
    ['电竞', WORLD_MODES.ESPORTS],
    ['actor', WORLD_MODES.ACTOR],
    ['acting', WORLD_MODES.ACTOR],
    ['演员', WORLD_MODES.ACTOR],
    ['演艺', WORLD_MODES.ACTOR],
    ['idol', WORLD_MODES.IDOL],
    ['爱豆', WORLD_MODES.IDOL],
    ['偶像', WORLD_MODES.IDOL],
]);

const PRESET_MODE_BY_ID = Object.freeze({
    'preset-cultivation': WORLD_MODES.CULTIVATION,
    'preset-cultivation-world': WORLD_MODES.CULTIVATION,
    'preset-apocalypse': WORLD_MODES.APOCALYPSE,
    'preset-apocalypse-world': WORLD_MODES.APOCALYPSE,
    'preset-esports': WORLD_MODES.ESPORTS,
    'preset-esports-world': WORLD_MODES.ESPORTS,
    'preset-actor': WORLD_MODES.ACTOR,
    'preset-actor-world': WORLD_MODES.ACTOR,
    'preset-idol': WORLD_MODES.IDOL,
    'preset-idol-world': WORLD_MODES.IDOL,
});

function cleanText(value) {
    return String(value ?? '').trim();
}

function normalizedToken(value) {
    return cleanText(value)
        .toLowerCase()
        .replace(/[\s_-]+/g, '')
        .replace(/世界观|世界|模式/g, '');
}

export function normalizeWorldMode(value, fallback = WORLD_MODES.GENERAL) {
    const token = normalizedToken(value);
    if (!token) return fallback;
    return MODE_ALIASES.get(token) || fallback;
}

export function listWorldTags(world) {
    const raw = Array.isArray(world?.tagRefs)
        ? world.tagRefs
        : (Array.isArray(world?.tags) ? world.tags : []);
    return raw
        .map((item) => cleanText(item?.name || item?.label || item?.id || item))
        .filter(Boolean);
}

/**
 * 解析世界体验模式。
 *
 * 新数据优先读显式的 experienceMode；旧数据兼容 presetSource、标签和名称。
 * 名称只作最后兜底，避免普通世界里偶然提到「演员」就误切成专属模式。
 */
export function resolveWorldMode(world) {
    if (!world) return WORLD_MODES.GENERAL;

    const explicit = world.experienceMode || world.worldMode;
    if (cleanText(explicit)) return normalizeWorldMode(explicit);

    const presetId = cleanText(
        world.presetSource?.id
        || world.presetSource
        || world.presetId
        || world._fromPreset,
    );
    if (PRESET_MODE_BY_ID[presetId]) return PRESET_MODE_BY_ID[presetId];

    for (const tag of listWorldTags(world)) {
        const token = normalizedToken(tag);
        if (MODE_ALIASES.has(token) && MODE_ALIASES.get(token) !== WORLD_MODES.GENERAL) {
            return MODE_ALIASES.get(token);
        }
    }

    const name = normalizedToken(world.name);
    for (const [alias, mode] of MODE_ALIASES) {
        if (alias.length >= 2 && name.includes(alias) && mode !== WORLD_MODES.GENERAL) {
            return mode;
        }
    }
    return WORLD_MODES.GENERAL;
}

export function getWorldModeSpec(modeOrWorld) {
    const mode = typeof modeOrWorld === 'object'
        ? resolveWorldMode(modeOrWorld)
        : normalizeWorldMode(modeOrWorld);
    return WORLD_MODE_SPECS[mode] || WORLD_MODE_SPECS[WORLD_MODES.GENERAL];
}

export function getSettingsSdk() {
    return (typeof window !== 'undefined' && window.settingsSdk) || null;
}

export async function waitForSettingsSdk() {
    if (typeof window === 'undefined') return null;
    if (window.settingsSdk) return window.settingsSdk;
    if (typeof window.whenSettingsSdkReady === 'function') {
        try {
            await window.whenSettingsSdkReady();
        } catch (_) {
            return window.settingsSdk || null;
        }
    }
    return window.settingsSdk || null;
}

export function getDefaultUser(sdk = getSettingsSdk(), { allowActiveFallback = true } = {}) {
    if (!sdk) return null;
    const selected = sdk.defaultUserCard?.getDefault?.();
    if (selected) return selected;
    return allowActiveFallback ? (sdk.users?.getActive?.() || null) : null;
}

export function getBoundWorld(user, sdk = getSettingsSdk(), { allowActiveFallback = false } = {}) {
    if (!sdk) return null;
    const worldId = cleanText(user?.boundWorldId || user?.boundWorldRef);
    if (worldId) return sdk.worlds?.get?.(worldId) || null;
    return allowActiveFallback ? (sdk.worlds?.getActive?.() || null) : null;
}

export function createProfileKey(userOrId, worldOrId) {
    const userId = cleanText(userOrId?.id || userOrId);
    const worldId = cleanText(worldOrId?.id || worldOrId);
    return userId && worldId ? `${userId}::${worldId}` : null;
}

export function readWorldProfile(options = {}) {
    const {
        sdk = getSettingsSdk(),
        allowActiveUserFallback = true,
        allowActiveWorldFallback = false,
    } = options;
    const user = getDefaultUser(sdk, { allowActiveFallback: allowActiveUserFallback });
    const world = getBoundWorld(user, sdk, { allowActiveFallback: allowActiveWorldFallback });
    const profileKey = createProfileKey(user, world);
    const mode = resolveWorldMode(world);
    return {
        ready: Boolean(user && world && profileKey),
        sdk,
        user,
        world,
        userId: user?.id || '',
        userName: user?.name || '我',
        worldId: world?.id || '',
        worldName: world?.name || '',
        profileKey,
        mode,
        modeSpec: getWorldModeSpec(mode),
    };
}

export function listWorldAiPersons(worldOrId, sdk = getSettingsSdk()) {
    const worldId = cleanText(worldOrId?.id || worldOrId);
    if (!worldId || !sdk?.aiPersons?.list) return [];
    return sdk.aiPersons.list().filter((person) => (
        cleanText(person?.boundWorldId || person?.boundWorldRef) === worldId
    ));
}

/**
 * App 世界观可见性协议。
 *
 * appConfig:
 *   worldAvailability: {
 *     includeModes?: ['actor'],
 *     excludeModes?: ['actor', 'idol'],
 *     requiresBoundWorld?: true,
 *     allowWithoutWorld?: false,
 *   }
 */
export function isAppAvailableForWorld(app, profile = readWorldProfile()) {
    const rule = app?.worldAvailability || app?.availability?.world;
    if (!rule || typeof rule !== 'object') return true;

    const hasWorld = Boolean(profile?.world);
    if (!hasWorld && rule.allowWithoutWorld === true) return true;
    if (!hasWorld && (rule.requiresBoundWorld === true || Array.isArray(rule.includeModes))) return false;

    const mode = profile?.mode || resolveWorldMode(profile?.world);
    const include = Array.isArray(rule.includeModes)
        ? rule.includeModes.map((item) => normalizeWorldMode(item))
        : [];
    const exclude = Array.isArray(rule.excludeModes)
        ? rule.excludeModes.map((item) => normalizeWorldMode(item))
        : [];

    if (include.length && !include.includes(mode)) return false;
    if (exclude.includes(mode)) return false;
    if (typeof rule.when === 'function') {
        try {
            return rule.when(profile, app) !== false;
        } catch (err) {
            console.warn(`[world-profile] ${app?.id || 'unknown'} 可见性判断失败`, err);
            return false;
        }
    }
    return true;
}

function sameName(a, b) {
    return cleanText(a).toLocaleLowerCase() === cleanText(b).toLocaleLowerCase();
}

/**
 * 把旅游 App 生成的「地点 + 场所」幂等注册进 nook。
 * 已存在同名地点/场所时默认复用，不制造重复地图或重复 pin。
 */
export async function registerGeoCandidate(candidate = {}, options = {}) {
    const sdk = options.sdk || await waitForSettingsSdk();
    const profile = options.profile || readWorldProfile({ sdk });
    const worldId = cleanText(options.worldId || candidate.worldId || profile.worldId);
    if (!sdk?.places?.create || !sdk?.locations?.create || !worldId) {
        return { ok: false, error: '世界观或地理系统还没就绪' };
    }

    const placeInput = candidate.place || {};
    const locationInput = candidate.location || {};
    const placeName = cleanText(placeInput.name || candidate.placeName);
    const locationName = cleanText(locationInput.name || candidate.locationName);
    if (!placeName || !locationName) {
        return { ok: false, error: '地点和场所名称都不能为空' };
    }

    const places = sdk.places.list?.({ worldRef: worldId }) || [];
    let place = (placeInput.id && sdk.places.get?.(placeInput.id))
        || places.find((item) => sameName(item?.name, placeName))
        || null;
    let createdPlace = false;

    if (!place) {
        place = await sdk.places.create({
            worldRef: worldId,
            name: placeName,
            summary: cleanText(placeInput.summary || candidate.placeSummary),
            mapImageUrl: cleanText(placeInput.mapImageUrl),
            realCityRef: placeInput.realCityRef || null,
        });
        createdPlace = true;
    } else if (options.updateExisting === true) {
        place = await sdk.places.update(place.id, {
            summary: cleanText(placeInput.summary || place.summary),
            mapImageUrl: cleanText(placeInput.mapImageUrl || place.mapImageUrl),
            realCityRef: placeInput.realCityRef || place.realCityRef || null,
        });
    }

    const locations = sdk.locations.getByPlace?.(worldId, place.id)
        || (sdk.locations.list?.({ worldRef: worldId }) || []).filter((item) => item.placeRef === place.id);
    let location = (locationInput.id && sdk.locations.get?.(locationInput.id))
        || locations.find((item) => sameName(item?.name, locationName))
        || null;
    let createdLocation = false;

    if (!location) {
        location = await sdk.locations.create({
            worldRef: worldId,
            placeRef: place.id,
            name: locationName,
            summary: cleanText(locationInput.summary || candidate.locationSummary),
            icon: cleanText(locationInput.icon),
            position: locationInput.position || { x: 0, y: 0 },
            tagRefs: Array.isArray(locationInput.tagRefs) ? locationInput.tagRefs : [],
            allowedRoles: Array.isArray(locationInput.allowedRoles) ? locationInput.allowedRoles : ['user', 'ai'],
            accessType: locationInput.accessType || 'open',
        });
        createdLocation = true;
    } else if (options.updateExisting === true) {
        location = await sdk.locations.update(location.id, {
            summary: cleanText(locationInput.summary || location.summary),
            position: locationInput.position || location.position,
            tagRefs: Array.isArray(locationInput.tagRefs) ? locationInput.tagRefs : location.tagRefs,
        });
    }

    return { ok: true, place, location, createdPlace, createdLocation };
}

/**
 * 把视频/博客里认识的陌生人注册为当前世界观 AI 人设。
 * 相识缘由写入 experience，并另存 externalOrigin，后续聊天构建提示词时可追溯。
 */
export async function registerEncounteredCharacter(candidate = {}, options = {}) {
    const sdk = options.sdk || await waitForSettingsSdk();
    const profile = options.profile || readWorldProfile({ sdk });
    if (!sdk?.aiPersons?.create || !profile.worldId) {
        return { ok: false, error: '世界观或角色库还没就绪' };
    }

    const name = cleanText(candidate.name);
    if (!name) return { ok: false, error: '角色名称不能为空' };

    const sourceApp = cleanText(options.sourceApp || candidate.sourceApp || '社交应用');
    const encounter = cleanText(options.encounter || candidate.encounter || candidate.metVia);
    const externalId = cleanText(candidate.externalId || candidate.id);
    const encounterLine = encounter
        ? `与用户在${sourceApp}相识：${encounter}`
        : `与用户通过${sourceApp}相识。`;
    const previousExperience = cleanText(candidate.experience);
    const experience = [previousExperience, encounterLine].filter(Boolean).join('\n');

    const existing = externalId
        ? listWorldAiPersons(profile.worldId, sdk).find((person) => (
            cleanText(person?.externalOrigin?.appId) === sourceApp
            && cleanText(person?.externalOrigin?.externalId) === externalId
        ))
        : null;
    if (existing) {
        if (options.updateExisting === true && sdk.aiPersons?.update) {
            const person = await sdk.aiPersons.update(existing.id, {
                name,
                bio: cleanText(candidate.bio || candidate.summary || existing.bio),
                avatar: cleanText(candidate.avatar || existing.avatar),
                avatarBg: cleanText(candidate.avatarBg || existing.avatarBg),
                experience: cleanText(existing.experience || experience),
            });
            return { ok: Boolean(person), person, created: false };
        }
        return { ok: true, person: existing, created: false };
    }

    const person = await sdk.aiPersons.create({
        name,
        bio: cleanText(candidate.bio || candidate.summary),
        experience,
        avatar: cleanText(candidate.avatar),
        avatarBg: cleanText(candidate.avatarBg),
        boundWorldId: profile.worldId,
        externalOrigin: {
            appId: sourceApp,
            externalId,
            encounter,
            registeredAt: Date.now(),
        },
    });
    return { ok: Boolean(person), person, created: Boolean(person) };
}

export default {
    WORLD_MODES,
    WORLD_MODE_SPECS,
    normalizeWorldMode,
    resolveWorldMode,
    getWorldModeSpec,
    getDefaultUser,
    getBoundWorld,
    createProfileKey,
    readWorldProfile,
    listWorldTags,
    listWorldAiPersons,
    isAppAvailableForWorld,
    registerGeoCandidate,
    registerEncounteredCharacter,
};
