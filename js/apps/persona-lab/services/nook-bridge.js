/**
 * 人设机 · 与 nook 的唯一接口
 *
 * 本 App **不自己存人设卡**。人设卡的真理之源始终是 nook 的
 * `sdkUsers` / `sdkAiPersons` 两张表,本 App 只存「草稿 + 对话 + 修改日志」。
 *
 * 这样做的直接好处:
 *   - 在这里改完保存,murmur / 朋友圈 / 梦境编织立刻就能读到新人设
 *   - 不会出现「人设机里是新的、nook 里是旧的」这种两份真相
 *
 * ── 为什么全走 `window.settingsSdk` 而不是 import ────────────────────
 *
 * settings 是另一个 App。跨 App 直接 import 它的内部模块会把两者的生命周期
 * 绑死(settings 没起来 → 本 App 连注册都失败)。项目约定是读全局:
 * SDK 没就绪时所有方法返回空,UI 显示「正在连接 nook」,而不是白屏。
 * 梦境编织的 `resolveApiRef` 用的也是这个模式。
 */

import { cardToText, textToCardPatch, readName } from './card-schema.js';
import { UNTITLED } from '../constants.js';

// ============================================================
// SDK 取用
// ============================================================

export function sdk() {
    return typeof window !== 'undefined' ? window.settingsSdk : null;
}

export function isReady() {
    const s = sdk();
    return Boolean(s?.users?.list && s?.aiPersons?.list);
}

/**
 * 等 SDK 就绪。
 *
 * ★ 不设「只等一次」的硬闸:首次等失败后必须还能再等(AGENTS2 §9.12 天气 App
 *   踩过 —— 用 `_hydrated` 硬阻断,第一次没起来就永远不会有第二次)。
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
        // 事件可能在我们挂监听之前就派发过了,补一个轮询兜底
        const poll = setInterval(onReady, 250);
        const timer = setTimeout(() => finish(isReady()), timeout);
        onReady();
    });
}

function apiFor(scope) {
    const s = sdk();
    if (!s) return null;
    return scope === 'user' ? s.users : s.aiPersons;
}

// ============================================================
// 读:列出 nook 里已有的人设卡
// ============================================================

/**
 * @typedef {object} CardRef
 * @property {'user'|'ai'} scope
 * @property {string} id
 * @property {string} name
 * @property {string} subtitle
 * @property {boolean} isDefaultUser  是否「默认用户卡」(社媒 App 读的那张「我」)
 * @property {string} variantType     base / lifePhase / paro
 * @property {number} updatedAt
 */

/** 列出全部人设卡。变体卡(人生阶段 / parO)一起列出来,但会标出来源。 */
export function listCards() {
    const s = sdk();
    if (!s) return [];
    const defaultUserId = s.defaultUserCard?.getDefaultId?.() || '';
    const out = [];

    for (const scope of ['ai', 'user']) {
        const api = apiFor(scope);
        const list = api?.list?.() || [];
        for (const card of list) {
            if (!card?.id) continue;
            out.push({
                scope,
                id: String(card.id),
                name: String(card.name || '').trim() || UNTITLED,
                subtitle: describeCard(card),
                isDefaultUser: scope === 'user' && String(card.id) === String(defaultUserId),
                variantType: card.variantType || 'base',
                updatedAt: Number(card.updatedAt) || 0,
            });
        }
    }

    return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function describeCard(card) {
    const bits = [];
    if (card.bio) bits.push(String(card.bio).trim());
    else if (card.personality) bits.push(String(card.personality).trim());
    else if (card.summary) bits.push(String(card.summary).trim());
    const line = bits.join(' · ').replace(/\s+/g, ' ');
    return line.length > 40 ? `${line.slice(0, 40)}…` : line;
}

export function readCard(scope, id) {
    const api = apiFor(scope);
    return api?.get?.(id) || null;
}

/** 拉一张卡进来当草稿正文 */
export function cardToDraftText(scope, id) {
    const card = readCard(scope, id);
    if (!card) return '';
    return cardToText(card);
}

// ============================================================
// 写:保存回 nook
// ============================================================

/**
 * 保存草稿。
 *
 * ★ 核心规则(用户明确要求):**原来就有的卡直接覆盖,不新建。**
 *   判据是 `draft.personaId` —— 它只在「从 nook 拉过来」或「上一次保存成功」
 *   时才有值。所以同一份草稿反复保存不会在 nook 里堆出一串同名卡。
 *
 * @param {object} draft
 * @param {'user'|'ai'} draft.scope
 * @param {string} draft.personaId  空 = 新建
 * @param {string} draft.text
 * @returns {Promise<{ok:boolean, created:boolean, id?:string, name?:string, fields?:number, error?:string}>}
 */
export async function saveDraftToNook(draft) {
    if (!isReady()) {
        return { ok: false, created: false, error: 'nook 还没连上,稍等一下再保存' };
    }
    const scope = draft?.scope === 'user' ? 'user' : 'ai';
    const api = apiFor(scope);
    if (!api) return { ok: false, created: false, error: '找不到人设库' };

    const patch = textToCardPatch(draft?.text || '');
    const fieldCount = Object.keys(patch).length;
    if (fieldCount === 0) {
        return { ok: false, created: false, error: '正文里没有能识别的人设字段,先写点内容' };
    }
    if (!String(patch.name || '').trim()) {
        patch.name = readName(draft?.text) || String(draft?.title || '').trim() || UNTITLED;
    }

    try {
        const existing = draft?.personaId ? api.get(draft.personaId) : null;
        if (existing) {
            const next = await api.update(existing.id, patch);
            return { ok: true, created: false, id: existing.id, name: next?.name || patch.name, fields: fieldCount };
        }
        const created = await api.create(patch);
        if (!created?.id) return { ok: false, created: false, error: '写入没有返回记录,可能数据库还没就绪' };
        return { ok: true, created: true, id: created.id, name: created.name, fields: fieldCount };
    } catch (err) {
        console.warn('[persona-lab/nook] 保存失败', err);
        return { ok: false, created: false, error: err?.message || '写入人设库失败' };
    }
}

// ============================================================
// 上下文:世界观 / 对话对象
// ============================================================

/** 人设卡绑定的世界观,拼进 prompt 用 */
export function readWorldContext(card) {
    const worldId = card?.boundWorldId || card?.boundWorldRef;
    if (!worldId) return '';
    const world = sdk()?.worlds?.get?.(worldId);
    if (!world) return '';
    const points = Array.isArray(world.keyPoints) ? world.keyPoints.filter(Boolean) : [];
    const lines = [];
    if (world.name) lines.push(`世界: ${world.name}`);
    if (world.summary) lines.push(`概要: ${String(world.summary).trim()}`);
    if (points.length) lines.push(`要点:\n${points.map((p) => `  · ${p}`).join('\n')}`);
    return lines.join('\n');
}

/**
 * 「她在跟谁说话」。
 *
 * 用**默认用户卡**而不是当前激活用户卡 —— 默认卡才是各社媒 App 里的「我」,
 * 在人设机里试出来的口吻,换到 murmur 里才对得上。
 */
export function readPartnerContext() {
    const user = sdk()?.defaultUserCard?.getDefault?.() || sdk()?.users?.getActive?.();
    if (!user) return '';
    const lines = [];
    if (user.name) lines.push(`对方称呼: ${user.name}`);
    if (user.gender) lines.push(`性别: ${user.gender}`);
    if (user.age !== '' && user.age != null) lines.push(`年龄: ${user.age}`);
    if (user.bio) lines.push(`简介: ${String(user.bio).trim()}`);
    if (user.personality) lines.push(`性格: ${String(user.personality).trim()}`);
    return lines.join('\n');
}

// ============================================================
// API 绑定
// ============================================================

/** 列出系统里所有可用的 API 引用(单 key + 分组) */
export function listApiRefs() {
    const apiSdk = typeof window !== 'undefined' ? window.__apiSdk : null;
    if (!apiSdk) return [];
    const out = [];
    try {
        for (const group of apiSdk.apiGroupSdk?.list?.() || []) {
            if (!group?.id) continue;
            const count = Array.isArray(group.apiKeyIds) ? group.apiKeyIds.length : 0;
            out.push({
                type: 'group',
                refId: String(group.id),
                label: group.name || '未命名分组',
                sub: `分组 · ${count} 个 Key`,
            });
        }
    } catch (_) { /* 分组不可用不影响单 key */ }
    try {
        for (const key of apiSdk.apiKeySdk?.list?.() || []) {
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
 * 用户明确要求:**不在本 App 里填 API,拉「默认用户人设」绑定的那个。**
 * 优先级:
 *   1. 默认用户卡 `boundResources.apiRefs` 里的第一个
 *   2. 当前激活用户卡的 apiRefs(默认卡没绑时的兜底)
 *   3. 系统里第一个可用的 API
 *
 * 第 3 条是兜底而不是「正确路径」:没有它的话,一个从没在人设里绑过 API 的
 * 用户点「发送」只会看到「未找到 API 配置」,完全不知道该去哪儿配。
 * 所以取到之后 UI 会显示「来源:系统默认」,提醒他去绑一个。
 *
 * @returns {{type:'key'|'group', refId:string, from:'persona'|'active-user'|'fallback'}|null}
 */
export function resolveApiRef() {
    const all = listApiRefs();
    const exists = (type, refId) => all.some((r) => r.type === type && r.refId === String(refId));

    const pick = (user, from) => {
        const refs = Array.isArray(user?.boundResources?.apiRefs) ? user.boundResources.apiRefs : [];
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
    const hit = pick(s?.defaultUserCard?.getDefault?.(), 'persona')
        || pick(s?.users?.getActive?.(), 'active-user');
    if (hit) return hit;

    return all.length ? { type: all[0].type, refId: all[0].refId, from: 'fallback' } : null;
}

/** 给 UI 显示「这次会用哪个 API」 */
export function describeApiRef(ref) {
    if (!ref) return { label: '未绑定 API', sub: '去 nook →「人设」→ 资源绑定里选一个', ok: false };
    const hit = listApiRefs().find((r) => r.type === ref.type && r.refId === ref.refId);
    const fromText = {
        persona: '来自默认用户人设',
        'active-user': '来自当前用户人设',
        fallback: '系统里第一个可用的(建议去人设里绑定)',
    }[ref.from] || '';
    return { label: hit?.label || ref.refId, sub: fromText, ok: true };
}

/** 没有可用 API 时,告诉用户具体该去哪儿 */
export function describeMissingApi() {
    if (typeof window === 'undefined' || !window.__apiSdk) return 'API 模块还没加载好,稍等一下再试';
    if (listApiRefs().length === 0) return '还没有可用的 API Key。去 nook →「API 管理」添加一个,再到人设的「资源绑定」里选上';
    return '默认用户人设绑定的 API 已被删除或停用,去 nook 重新选一个';
}
