/**
 * 日记 · 与 nook 的唯一接口
 *
 * ── 为什么收在一个文件里 ──────────────────────────────────────────
 *
 * 人设 / 世界观 / API Key 的真理之源是 nook（settings App）的
 * `sdkUsers` / `sdkAiPersons` / `sdkWorlds` / API 管理。本 App **不自己存这些**。
 *
 * 读法必须收在一处：散在各组件里各读各的，迟早出现「配置页读的是 A、
 * 生成时读的是 B」（灯塔求职踩过，AGENTS2 §17）。结论是「每次读都现算，
 * 不依赖任何『用户切换了』的事件」—— 这里照办。
 *
 * ── 本 App 的身份规则 ────────────────────────────────────────────
 *
 * 产品要求：「记日记时，用户身份是默认的用户人设身份，所以能拉取到的 AI
 * 也是默认用户人设绑定的世界观下的 AI 人设」。
 *
 * 所以这里只认**默认用户卡**（`defaultUserCard.getDefault()`），
 * 不认「当前激活卡」—— 后者是人设编辑器在用的，跟着用户在 nook 里点来点去变，
 * 拿它当日记的「我」会导致今天和明天的日记属于不同的人。
 *
 * ── 为什么全走 window.settingsSdk 而不是 import ─────────────────────
 *
 * settings 是另一个 App。直接 import 会把两者生命周期绑死（settings 没起来
 * → 本 App 连注册都失败）。项目约定是读全局：SDK 没就绪时所有方法返回空，
 * UI 显示「正在连接 nook」，而不是白屏。
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
 * ★ 不设「只等一次」的硬闸：首次等失败后必须还能再等
 *   （AGENTS2 §9.12 天气 App 踩过 —— 用 `_hydrated` 硬阻断，
 *   第一次没起来就永远不会有第二次）。
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
        // 事件可能在挂监听之前就派发过了，补一个轮询兜底
        const poll = setInterval(onReady, 250);
        const timer = setTimeout(() => finish(isReady()), timeout);
        onReady();
    });
}

// ============================================================
// 身份
// ============================================================

/**
 * 「我」是谁 —— 默认用户人设卡。
 *
 * 兜底到 activeUser 只是为了新装用户还没设过默认卡时不至于空白；
 * 正常路径下永远走默认卡。
 */
export function getDefaultUser() {
    const s = sdk();
    if (!s) return null;
    return s.defaultUserCard?.getDefault?.() || s.users?.getActive?.() || null;
}

export function getUser(userId) {
    const s = sdk();
    if (!s) return null;
    if (userId) {
        const hit = s.users?.get?.(userId);
        if (hit) return hit;
    }
    return getDefaultUser();
}

/**
 * 默认用户人设绑定的世界观。
 *
 * 三级兜底：卡上绑的 → 当前激活的 → 第一个。
 * 没有世界观的话，AI 写出来的日记和整个系统毫无关系，所以宁可兜底也不返回空。
 */
export function getBoundWorld(userCard) {
    const s = sdk();
    if (!s) return null;
    const card = userCard || getDefaultUser();
    const bound = card?.boundWorldId;
    if (bound) {
        const hit = s.worlds?.get?.(bound);
        if (hit) return hit;
    }
    return s.worlds?.getActive?.() || asArray(s.worlds?.list?.())[0] || null;
}

/**
 * 这个世界观下的 AI 人设 —— 也就是「我能翻开谁的日记本」。
 *
 * 世界观下一个都没绑时返回全部：空列表会让「看 AI 日记」变成死路，
 * 而用户多半只是没给 AI 卡填 boundWorldId。
 */
export function listWorldAis(world) {
    const s = sdk();
    if (!s?.aiPersons?.list) return [];
    const all = asArray(s.aiPersons.list());
    if (!world?.id) return all.map(toAiBrief);
    const bound = all.filter(
        (a) => String(a?.boundWorldId || a?.boundWorldRef || '') === String(world.id),
    );
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
        experience: String(ai?.experience || ''),
        occupation: String(ai?.currentOccupation || ''),
    };
}

export function getAi(aiId) {
    const s = sdk();
    const ai = s?.aiPersons?.get?.(aiId);
    return ai ? toAiBrief(ai) : null;
}

// ============================================================
// 描述（拼 prompt 用）
// ============================================================

/** 用户人设 8 字段 */
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

/** AI 人设 */
export function describeAi(ai) {
    if (!ai) return '';
    return kvBlock([
        ['姓名', ai.name],
        ['性别', ai.gender],
        ['年龄', ai.age],
        ['外貌', ai.appearance],
        ['性格', ai.personality],
        ['简介', ai.bio],
        ['经历', ai.experience],
        ['身份', ai.occupation],
    ]);
}

/**
 * 世界观简介 + 要点。
 *
 * 这段对本 App 特别重要：产品明确要求「要注意当前世界观下对月经的理解」——
 * 没有世界观，AI 只会用现代都市的默认认知去接话。
 */
export function describeWorld(world) {
    if (!world) return '';
    const points = asArray(world.keyPoints).map((p) => String(p || '')).filter(Boolean);
    return kvBlock([
        ['世界', world.name],
        ['概要', world.summary || world.description],
        ['要点', points.length ? points.map((p) => `· ${p}`).join('\n') : ''],
        ['补充', world.notes],
    ]);
}

export function listWorlds() {
    const s = sdk();
    return asArray(s?.worlds?.list?.()).map((w) => ({
        id: String(w.id),
        name: String(w.name || '未命名世界观'),
        summary: truncate(w.summary || '', 40),
    }));
}

// ============================================================
// API 绑定
// ============================================================

/** 系统里所有可用的 API 引用（单 key + 分组） */
export function listApiRefs() {
    const apiSdk = typeof window !== 'undefined' ? window.__apiSdk : null;
    if (!apiSdk) return [];
    const out = [];
    try {
        for (const group of asArray(apiSdk.apiGroupSdk?.list?.())) {
            if (!group?.id) continue;
            const count = asArray(group.apiKeyIds).length;
            out.push({
                type: 'group',
                refId: String(group.id),
                label: group.name || '未命名分组',
                sub: `分组 · ${count} 个 Key`,
            });
        }
    } catch (_) { /* 分组不可用不影响单 key */ }
    try {
        for (const key of asArray(apiSdk.apiKeySdk?.list?.())) {
            if (!key?.id || key.enabled === false) continue;
            out.push({
                type: 'key',
                refId: String(key.id),
                label: key.label || key.model || '未命名 Key',
                sub: key.model || key.provider || '',
            });
        }
    } catch (_) { /* ignore */ }
    return out;
}

/**
 * 这次请求用哪个 API。
 *
 * 产品要求「从 nook 中拉取 AI 绑定的 api」，所以本 App **没有 API 设置界面**。
 *
 * 优先级：
 *   1. 这个日记空间自己绑的（用户在空间设置里选过）
 *   2. 空间主人的人设卡上绑的 —— AI 空间就是那张 AI 卡，用户空间就是默认用户卡
 *   3. 默认用户卡绑的
 *   4. 系统里第一个可用的
 *
 * 第 4 条是兜底不是正路：没有它，一个从没在人设里绑过 API 的用户点「让 TA 写」
 * 只会看到「未找到 API 配置」，完全不知道该去哪儿配。取到之后 UI 会标
 * 「来源：系统默认」提醒他去绑。
 *
 * @returns {{type:'key'|'group', refId:string, from:string}|null}
 */
export function resolveApiRef({ space, ownerCard } = {}) {
    const all = listApiRefs();
    const exists = (type, refId) => all.some((r) => r.type === type && r.refId === String(refId));

    if (space?.apiRef?.refId && exists(space.apiRef.type, space.apiRef.refId)) {
        return { type: space.apiRef.type, refId: String(space.apiRef.refId), from: 'space' };
    }

    const pick = (card, from) => {
        for (const ref of asArray(card?.boundResources?.apiRefs)) {
            const type = (ref?.refType || ref?.type) === 'group' ? 'group' : 'key';
            const refId = ref?.refId || ref?.id;
            if (!refId) continue;
            if (!exists(type, refId)) continue;   // 绑的 key 已被删掉，跳过而不是硬用
            return { type, refId: String(refId), from };
        }
        return null;
    };

    const hit = pick(ownerCard, 'owner') || pick(getDefaultUser(), 'default-user');
    if (hit) return hit;
    return all.length ? { type: all[0].type, refId: all[0].refId, from: 'fallback' } : null;
}

const FROM_TEXT = {
    space: '这个日记本单独绑的',
    owner: '来自本人的人设卡',
    'default-user': '来自默认用户人设',
    fallback: '系统里第一个可用的（建议去人设里绑定）',
};

/** 给 UI 显示「这次会用哪个 API」 */
export function describeApiRef(ref) {
    if (!ref) return { label: '未绑定 API', sub: '去 nook →「人设」→ 资源绑定里选一个', ok: false };
    const hit = listApiRefs().find((r) => r.type === ref.type && r.refId === ref.refId);
    return { label: hit?.label || ref.refId, sub: FROM_TEXT[ref.from] || '', ok: true };
}

/** 没有可用 API 时，告诉用户具体该去哪儿 —— 只说「失败」等于没说 */
export function describeMissingApi() {
    if (typeof window === 'undefined' || !window.__apiSdk) return 'API 模块还没加载好，稍等一下再试';
    if (listApiRefs().length === 0) {
        return '还没有可用的 API Key。去 nook →「API 管理」添加一个，再到人设的「资源绑定」里选上';
    }
    return '人设绑定的 API 已被删除或停用，去 nook 重新选一个';
}
