/**
 * 情景聊天 · 与 nook 的唯一接口
 *
 * ── 为什么要有这个文件 ────────────────────────────────────────────
 *
 * 人设、世界观、场所、API Key 的真理之源是 nook(settings App),
 * 这个 App **不自己存这些东西**。但读法必须**收在一处** ——
 * 散在各个组件里各读各的,迟早出现「配置页读的是 A、发送时读的是 B」。
 *
 * ── 为什么全走 window.settingsSdk 而不是 import ─────────────────────
 *
 * settings 是另一个 App。直接 import 它的内部模块会把两者生命周期绑死
 * (settings 没起来 → 本 App 连注册都失败)。项目约定是读全局:
 * SDK 没就绪时所有方法返回空,UI 显示「正在连接 nook」,而不是白屏。
 */

import { asArray, kvBlock, truncate } from '../utils.js';

// ============================================================
// SDK 取用
// ============================================================

export function sdk() {
    return typeof window !== 'undefined' ? window.settingsSdk : null;
}

export function isReady() {
    const s = sdk();
    return Boolean(s?.users?.list && s?.aiPersons?.list && s?.worlds?.list);
}

/**
 * 等 SDK 就绪。
 *
 * ★ 不设「只等一次」的硬闸:首次等失败后必须还能再等
 *   (天气 App 踩过 —— 用 `_hydrated` 硬阻断,第一次没起来就永远没有第二次)。
 */
export function whenReady(timeout = 8000) {
    if (isReady()) return Promise.resolve(true);
    if (typeof window === 'undefined') return Promise.resolve(false);
    return new Promise((resolve) => {
        let done = false;
        const finish = (ok) => {
            if (done) return;
            done = true;
            window.removeEventListener('settings-sdk-ready', onReady);
            clearInterval(poll);
            clearTimeout(timer);
            resolve(ok);
        };
        const onReady = () => { if (isReady()) finish(true); };
        window.addEventListener('settings-sdk-ready', onReady);
        // 事件可能在挂监听之前就派发过了,补一个轮询兜底
        const poll = setInterval(onReady, 250);
        const timer = setTimeout(() => finish(isReady()), timeout);
        onReady();
    });
}

// ============================================================
// 身份
// ============================================================

/** 用户人设卡:情景里指定的 → 默认用户卡 → 当前激活卡 */
export function getUserCard(userPersonaId) {
    const s = sdk();
    if (!s) return null;
    if (userPersonaId) {
        const hit = s.users?.get?.(userPersonaId);
        if (hit) return hit;
    }
    return s.defaultUserCard?.getDefault?.() || s.users?.getActive?.() || null;
}

/**
 * 这个情景绑的世界观。
 *
 * 优先情景里指定的 → 用户卡上绑的 → 当前激活的。
 * 三级兜底是必要的:新建情景时用户多半没选世界观,而没有世界观的话
 * AI 生成出来的东西和整个系统毫无关系。
 */
export function getWorld(worldId, userCard) {
    const s = sdk();
    if (!s) return null;
    if (worldId) {
        const hit = s.worlds?.get?.(worldId);
        if (hit) return hit;
    }
    const bound = userCard?.boundWorldId;
    if (bound) {
        const hit = s.worlds?.get?.(bound);
        if (hit) return hit;
    }
    return s.worlds?.getActive?.() || null;
}

export function listWorlds() {
    const s = sdk();
    return asArray(s?.worlds?.list?.()).map((w) => ({
        id: String(w.id),
        name: String(w.name || '未命名世界观'),
        summary: truncate(w.summary || '', 40),
    }));
}

export function listUserCards() {
    const s = sdk();
    const defaultId = s?.defaultUserCard?.getDefaultId?.() || '';
    return asArray(s?.users?.list?.()).map((u) => ({
        id: String(u.id),
        name: String(u.name || '未命名'),
        avatar: String(u.avatar || ''),
        subtitle: truncate(u.bio || u.personality || '', 30),
        isDefault: String(u.id) === String(defaultId),
    }));
}

/**
 * 这个世界观下的 AI 人设。
 *
 * 世界观下一个都没绑时返回全部 —— 空列表会让「谁出场」这一步变成死路,
 * 而用户多半只是没给 AI 卡填 boundWorldId。
 */
export function listWorldAis(world) {
    const s = sdk();
    if (!s?.aiPersons?.list) return [];
    const all = asArray(s.aiPersons.list());
    if (!world?.id) return all.map(toAiBrief);
    const bound = all.filter((a) => String(a?.boundWorldId || a?.boundWorldRef || '') === String(world.id));
    return (bound.length ? bound : all).map(toAiBrief);
}

function toAiBrief(ai) {
    return {
        id: String(ai?.id || ''),
        name: String(ai?.name || 'AI'),
        avatar: String(ai?.avatar || ''),
        gender: String(ai?.gender || ''),
        age: ai?.age === '' || ai?.age == null ? '' : String(ai.age),
        appearance: String(ai?.appearance || ''),
        personality: String(ai?.personality || ''),
        bio: String(ai?.bio || ''),
        occupation: String(ai?.currentOccupation || ''),
    };
}

export function getAi(aiId) {
    const s = sdk();
    const ai = s?.aiPersons?.get?.(aiId);
    return ai ? toAiBrief(ai) : null;
}

// ============================================================
// 世界观内容
// ============================================================

/** 世界观简介 + 要点。**没有它 AI 写出来的东西和这个世界毫无关系。** */
export function describeWorld(world) {
    if (!world) return '';
    const points = asArray(world.keyPoints).map((p) => String(p || '')).filter(Boolean);
    return kvBlock([
        ['世界', world.name],
        ['概要', world.summary],
        ['要点', points.length ? points.map((p) => `· ${p}`).join('\n') : ''],
        ['补充', world.notes],
    ]);
}

/**
 * 夹子 —— 世界观下的碎知识 prompt 库。
 *
 * 数据在 `world.flows`,settings 界面上那一页叫「夹子」,内部字段却叫 flows。
 * 这是历史命名,不改(改了老数据就读不到了)。
 */
export function listWorldClips(world) {
    return asArray(world?.flows)
        .filter((f) => f && f.id)
        .map((f) => ({
            id: String(f.id),
            title: String(f.title || '未命名夹子'),
            content: String(f.content || ''),
        }));
}

/** nook 的「场所」—— 情景可以挂在某个地点上 */
export function listWorldLocations(world) {
    const s = sdk();
    if (!s?.locations?.list || !world?.id) return [];
    try {
        return asArray(s.locations.list({ worldRef: world.id })).map((loc) => ({
            id: String(loc.id),
            name: String(loc.name || '未命名场所'),
            summary: String(loc.summary || ''),
        }));
    } catch (err) {
        console.warn('[scene-play/nook] 读取场所失败', err);
        return [];
    }
}

export function describeUser(card) {
    if (!card) return '';
    return kvBlock([
        ['姓名', card.name],
        ['性别', card.gender],
        ['年龄', card.age],
        ['外貌', card.appearance],
        ['性格', card.personality],
        ['简介', card.bio],
        ['经历', card.experience],
        ['当前职业', card.currentOccupation],
    ]);
}

export function describeAi(ai) {
    if (!ai) return '';
    return kvBlock([
        ['性别', ai.gender],
        ['年龄', ai.age],
        ['外貌', ai.appearance],
        ['性格', ai.personality],
        ['简介', ai.bio],
        ['身份', ai.occupation],
    ]);
}

// ============================================================
// API 绑定
// ============================================================

/** 系统里所有可用的 API 引用(单 key + 分组) */
export function listApiRefs() {
    const apiSdk = typeof window !== 'undefined' ? window.__apiSdk : null;
    if (!apiSdk) return [];
    const out = [];
    try {
        for (const group of asArray(apiSdk.apiGroupSdk?.list?.())) {
            if (!group?.id) continue;
            const count = asArray(group.apiKeyIds).length;
            out.push({ type: 'group', refId: String(group.id), label: group.name || '未命名分组', sub: `分组 · ${count} 个 Key` });
        }
    } catch (_) { /* 分组不可用不影响单 key */ }
    try {
        for (const key of asArray(apiSdk.apiKeySdk?.list?.())) {
            if (!key?.id || key.enabled === false) continue;
            out.push({ type: 'key', refId: String(key.id), label: key.label || key.model || '未命名 Key', sub: key.model || key.provider || '' });
        }
    } catch (_) { /* ignore */ }
    return out;
}

/**
 * 这次请求用哪个 API。
 *
 * 本 App **没有 API 设置界面** —— Key 统一在 nook 的「API 管理」里配。
 *
 * 优先级:用户人设卡绑的 → 默认用户卡绑的 → 系统里第一个可用的。
 * 第三条是兜底不是正路:没有它,一个从没在人设里绑过 API 的用户点「发送」
 * 只会看到「未找到 API 配置」,完全不知道该去哪儿配。
 *
 * @returns {{type:'key'|'group', refId:string, from:'persona'|'default-user'|'fallback'}|null}
 */
export function resolveApiRef(userCard) {
    const all = listApiRefs();
    const exists = (type, refId) => all.some((r) => r.type === type && r.refId === String(refId));

    const pick = (card, from) => {
        const refs = asArray(card?.boundResources?.apiRefs);
        for (const ref of refs) {
            const type = (ref?.refType || ref?.type) === 'group' ? 'group' : 'key';
            const refId = ref?.refId || ref?.id;
            if (!refId) continue;
            if (!exists(type, refId)) continue;   // 绑的 key 已被删掉,跳过而不是硬用
            return { type, refId: String(refId), from };
        }
        return null;
    };

    const s = sdk();
    const hit = pick(userCard, 'persona') || pick(s?.defaultUserCard?.getDefault?.(), 'default-user');
    if (hit) return hit;
    return all.length ? { type: all[0].type, refId: all[0].refId, from: 'fallback' } : null;
}

/** 给 UI 显示「这次会用哪个 API」 */
export function describeApiRef(ref) {
    if (!ref) return { label: '未绑定 API', sub: '去 nook →「人设」→ 资源绑定里选一个', ok: false };
    const hit = listApiRefs().find((r) => r.type === ref.type && r.refId === ref.refId);
    const fromText = {
        persona: '来自当前人设',
        'default-user': '来自默认用户人设',
        fallback: '系统里第一个可用的(建议去人设里绑定)',
    }[ref.from] || '';
    return { label: hit?.label || ref.refId, sub: fromText, ok: true };
}

/** 没有可用 API 时,告诉用户具体该去哪儿 */
export function describeMissingApi() {
    if (typeof window === 'undefined' || !window.__apiSdk) return 'API 模块还没加载好,稍等一下再试';
    if (listApiRefs().length === 0) return '还没有可用的 API Key。去 nook →「API 管理」添加一个,再到人设的「资源绑定」里选上';
    return '人设绑定的 API 已被删除或停用,去 nook 重新选一个';
}
