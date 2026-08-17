/**
 * 小奇怪 · 与 nook 的唯一接口
 *
 * ── 为什么要有这个文件 ────────────────────────────────────────────
 *
 * 「你有我没有」的 AI 座位**不是写死的角色**。原型
 * (`QAQ/小奇怪/小游戏你又我`)把「路星河」「顾漾」两个人设连同他们的
 * prompt 一起硬编码在 HTML 里,想换个人得改源码。
 * 本项目里人设的真理之源是 nook(`sdkAiPersons`),API Key 的真理之源是
 * nook 的 API 管理 —— 这个 App **不自己存人设、不自己填 Key**。
 *
 * 但读法必须**收在一处**。散在各组件里各读各的,迟早出现
 * 「选座位时读的是 A、发请求时读的是 B」。
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
 *   (AGENTS2 §9.12 天气 App 用 `_hydrated` 硬阻断,
 *   第一次没起来就永远不会有第二次)。
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

/** 玩家人设卡:指定的那张 → 默认用户卡 → 当前激活卡 */
export function getPlayerCard(userPersonaId) {
    const s = sdk();
    if (!s) return null;
    if (userPersonaId) {
        const hit = s.users?.get?.(userPersonaId);
        if (hit) return hit;
    }
    return s.defaultUserCard?.getDefault?.() || s.users?.getActive?.() || null;
}

/** 当前世界观:指定的 → 玩家卡上绑的 → 当前激活的 */
export function getWorld(worldId, playerCard) {
    const s = sdk();
    if (!s) return null;
    if (worldId) {
        const hit = s.worlds?.get?.(worldId);
        if (hit) return hit;
    }
    const bound = playerCard?.boundWorldId;
    if (bound) {
        const hit = s.worlds?.get?.(bound);
        if (hit) return hit;
    }
    return s.worlds?.getActive?.() || null;
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
        /** 座位要用自己的 Key,所以把绑定资源也带出来(见 resolveApiRefFor) */
        boundResources: ai?.boundResources || null,
    };
}

/**
 * 能坐上牌桌的 AI 人设。
 *
 * 世界观下一个都没绑时返回全部 —— 空列表会让「选座位」这一步变成死路,
 * 而用户多半只是没给 AI 卡填 boundWorldId。
 */
export function listSeatCandidates(world) {
    const s = sdk();
    if (!s?.aiPersons?.list) return [];
    const all = asArray(s.aiPersons.list());
    if (!world?.id) return all.map(toAiBrief);
    const bound = all.filter((a) => String(a?.boundWorldId || a?.boundWorldRef || '') === String(world.id));
    return (bound.length ? bound : all).map(toAiBrief);
}

/**
 * 当前世界观下的 AI 名单。
 *
 * ★ 组件里以前写的是 `listSeatCandidates()` —— **不传 world**,
 *   于是那个函数走 `if (!world?.id) return all`,把系统里所有世界观的
 *   AI 全端出来了。用户在 A 世界观里捏果冻心,人设列表里混着 B 世界观的角色,
 *   而且完全不报错。所有「按世界观取人」的地方一律走这个入口。
 */
export function listWorldAis() {
    return listSeatCandidates(getWorld('', getPlayerCard('')));
}

export function getAi(aiId) {
    const s = sdk();
    const ai = s?.aiPersons?.get?.(aiId);
    return ai ? toAiBrief(ai) : null;
}

// ============================================================
// 世界观内容
// ============================================================

/** 世界观简介 + 要点。没有它 AI 说出来的东西和这个世界毫无关系。 */
export function describeWorld(world) {
    if (!world) return '';
    const points = asArray(world.keyPoints).map((p) => String(p || '')).filter(Boolean);
    return kvBlock([
        ['世界', world.name],
        ['概要', truncate(world.summary, 220)],
        ['要点', points.length ? points.slice(0, 6).map((p) => `· ${p}`).join('\n') : ''],
    ]);
}

/** 人设简介(玩家侧) */
export function describePlayer(card) {
    if (!card) return '';
    return kvBlock([
        ['姓名', card.name],
        ['性别', card.gender],
        ['年龄', card.age],
        ['性格', truncate(card.personality, 120)],
        ['简介', truncate(card.bio, 160)],
        ['当前职业', card.currentOccupation],
    ]);
}

/** 人设简介(座位侧) */
export function describeAi(ai) {
    if (!ai) return '';
    return kvBlock([
        ['性别', ai.gender],
        ['年龄', ai.age],
        ['性格', truncate(ai.personality, 140)],
        ['简介', truncate(ai.bio, 180)],
        ['身份', ai.occupation],
    ]);
}

// ============================================================
// API 绑定
// ============================================================

/**
 * 系统里所有可用的 API 引用(单 key + 分组)。
 *
 * ★ `window.__apiSdk` 没有 `listKeys()`(AGENTS.md §3.10),
 *   只有 `apiKeySdk.list()` / `listEnabled()`。写错了不会报错,
 *   只会永远拿到空数组,表现是「明明配了 Key 却说没有 Key」。
 */
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
        const keys = apiSdk.apiKeySdk?.listEnabled?.() || apiSdk.apiKeySdk?.list?.();
        for (const key of asArray(keys)) {
            if (!key?.id || key.enabled === false) continue;
            out.push({ type: 'key', refId: String(key.id), label: key.label || key.model || '未命名 Key', sub: key.model || key.provider || '' });
        }
    } catch (_) { /* ignore */ }
    return out;
}

function pickBound(card, from, all) {
    const exists = (type, refId) => all.some((r) => r.type === type && r.refId === String(refId));
    for (const ref of asArray(card?.boundResources?.apiRefs)) {
        const type = (ref?.refType || ref?.type) === 'group' ? 'group' : 'key';
        const refId = ref?.refId || ref?.id;
        if (!refId) continue;
        if (!exists(type, refId)) continue;   // 绑的 key 已被删掉,跳过而不是硬用
        return { type, refId: String(refId), from };
    }
    return null;
}

/**
 * 给**一个座位**挑 API。
 *
 * ★ AGENTS.md §3.10 / §7:跨时空对局里「每个座位用自己的 Key,不要共用一把」。
 *   顺序:
 *     1) 这个 AI 人设自己绑的
 *     2) 按座位序号在系统可用列表里轮转(seatIndex % 总数)
 *   第 2 条是关键 —— 三个座位都没绑的时候,轮转至少能把请求摊到不同 Key 上,
 *   而不是三个座位排队打同一把 Key 的限流。
 *
 * @param {object} aiCard   nook 人设简报(toAiBrief 的产物)
 * @param {number} seatIndex 座位序号,从 0 起
 * @returns {{type:'key'|'group', refId:string, from:string}|null}
 */
export function resolveApiRefFor(aiCard, seatIndex = 0) {
    const all = listApiRefs();
    if (!all.length) return null;

    const bound = pickBound(aiCard, 'persona', all);
    if (bound) return bound;

    const index = Math.abs(Number(seatIndex) || 0) % all.length;
    const pick = all[index];
    return { type: pick.type, refId: pick.refId, from: all.length > 1 ? 'rotate' : 'fallback' };
}

/** 给 UI 显示「这个座位会用哪个 API」 */
export function describeApiRef(ref) {
    if (!ref) return { label: '没有可用 API', sub: '本地模式照样能玩', ok: false };
    const hit = listApiRefs().find((r) => r.type === ref.type && r.refId === ref.refId);
    const fromText = {
        persona: '这个人设自己绑的',
        rotate: '系统里轮到的这一把',
        fallback: '系统里唯一可用的那把',
    }[ref.from] || '';
    return { label: hit?.label || ref.refId, sub: fromText, ok: true };
}

/** 没有可用 API 时,告诉用户具体该去哪儿 */
export function describeMissingApi() {
    if (typeof window === 'undefined' || !window.__apiSdk) return 'API 模块还没加载好,先用本地模式';
    if (listApiRefs().length === 0) return '还没有可用的 API Key。去 nook →「API 管理」添加一个;不加也行,本地模式一样能玩';
    return '人设绑定的 API 已被删除或停用,去 nook 重新选一个';
}
