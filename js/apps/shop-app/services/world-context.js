/**
 * 四叶草 · 世界观上下文
 *
 * 这个 App 的内容全部由 AI 按世界观现生成，所以「世界观里有什么」必须有
 * **唯一一处**读取口。散在各个组件里读 `window.settingsSdk.worlds.getActive()`
 * 的话，迟早出现「首配读的是 A、生成时读的是 B」。
 *
 * ── 档案键 ────────────────────────────────────────────────────────
 *
 * 一份购物数据属于「默认用户 + 他绑的世界观」这一对。键 = `${userId}::${worldId}`。
 *
 * 用户换了默认用户卡、而新卡绑的是另一个世界观 → 键变了 → 读不到配置 → 走首配。
 * 换回来 → 键又对上 → 之前的商品、钱包、心愿单、小剧场原样回来。
 *
 * ★ 这个设计刻意**不依赖任何「用户切换了」的事件**。
 *   §15.9.5 的教训：只挂一个事件的实现等于挂在运气上 ——
 *   只要有一条切换路径不派发那个事件，行为就会变成「有时候好使有时候不好使」。
 *   现在每次读数据都现算键，事件到不到都无所谓。
 *
 * ── 资金映射 ──────────────────────────────────────────────────────
 *
 * 世界观上有 `currencyName`（默认「金币」）。这是**必须传给 AI** 的东西：
 * 规定了用金币交易，所有商品标价就得是金币，不能冒出「元」。
 */

import { asArray } from '../utils.js';
import {
    createProfileKey,
    getBoundWorld,
    getDefaultUser as readDefaultUser,
    getSettingsSdk,
    listWorldAiPersons,
    readWorldProfile,
} from '@/src/core/world-profile.js';

const FALLBACK_CURRENCY = '金币';

function sdk() {
    return getSettingsSdk();
}

// ============================================================
// 身份
// ============================================================

/**
 * 当前默认用户。
 *
 * 优先默认用户卡（murmur / 社交类 App 认的那个「我」），
 * 兜底当前激活卡 —— 用户可能从没设过默认卡。
 */
export function getDefaultUser() {
    return readDefaultUser(sdk());
}

/**
 * 这个用户所在的世界观。
 *
 * 只认用户卡上明确绑定的世界观。不能用 active world 兜底，否则未绑定用户
 * 会把商品写进另一个用户的世界档案。
 */
export function getWorld(user) {
    const s = sdk();
    return getBoundWorld(user || getDefaultUser(), s);
}

/**
 * 档案键。整个 App 的数据分档都靠它。
 *
 * SDK 还没就绪时返回空串 —— 调用方必须把空串当成「还不能读写」，
 * 而不是当成一个合法的键，否则会把数据写进一个谁也读不到的档。
 */
export function getProfileKey(user, world) {
    const u = user || getDefaultUser();
    const w = world || getWorld(u);
    return createProfileKey(u, w) || '';
}

/** 当前身份的一份只读快照，组件和 prompt 都读它 */
export function readIdentity() {
    const profile = readWorldProfile({ sdk: sdk() });
    const { user, world } = profile;
    return {
        ...profile,
        user,
        world,
        userName: user?.name || '我',
        worldName: world?.name || '',
        currency: (world?.currencyName || '').trim() || FALLBACK_CURRENCY,
        ready: profile.ready,
    };
}

// ============================================================
// 世界观内容
// ============================================================

/**
 * 夹子列表。
 *
 * 「夹子」是世界观下的碎知识 prompt 库，数据在 `world.flows`，
 * 每条 `{ id, title, content }`。settings 里那一页叫「夹子」，
 * 内部字段却叫 flows —— 这是历史命名，不改（改了老数据就读不到了）。
 */
export function listClips(world) {
    const w = world || getWorld();
    return asArray(w?.flows)
        .filter((f) => f && f.id)
        .map((f) => ({
            id: String(f.id),
            title: String(f.title || '未命名夹子'),
            content: String(f.content || ''),
        }));
}

/** 世界观要点（settings 里的 keyPoints），用于补充简介 */
export function listKeyPoints(world) {
    const w = world || getWorld();
    return asArray(w?.keyPoints).map((x) => String(x || '')).filter(Boolean);
}

/**
 * 世界观简介。**首配必传**，没有它 AI 生成的东西和世界观毫无关系。
 */
export function readSummary(world) {
    const w = world || getWorld();
    const summary = String(w?.summary || '').trim();
    const points = listKeyPoints(w);
    if (!summary && points.length === 0) return '';
    const parts = [];
    if (summary) parts.push(summary);
    if (points.length) parts.push(points.map((p) => `· ${p}`).join('\n'));
    return parts.join('\n');
}

// ============================================================
// prompt 库
// ============================================================

/**
 * 拉全部 prompt 条目 + 来源路径（库/包/组）。
 *
 * `sdk.promptLibrary` 是只读 adapter，每次拉最新（它自己不缓存，
 * 因为缓存会导致「settings 里改了、这边看不到」）。
 */
export async function listLibraryPrompts() {
    const s = sdk();
    if (!s?.promptLibrary?.listAllPrompts) return [];
    try {
        const rows = await s.promptLibrary.listAllPrompts();
        return asArray(rows).map((row) => ({
            id: String(row?.prompt?.id || ''),
            title: String(row?.prompt?.title || row?.prompt?.name || '未命名'),
            content: String(row?.prompt?.content || row?.prompt?.text || ''),
            path: [row?.library?.name, row?.package?.name, row?.group?.name]
                .filter(Boolean).join(' / '),
        })).filter((p) => p.id && p.content);
    } catch (err) {
        console.warn('[shop] 读取 prompt 库失败', err);
        return [];
    }
}

// ============================================================
// AI 人设
// ============================================================

/**
 * 这个世界观下绑定的 AI。
 *
 * 只返回明确绑定到同一世界观的 AI，避免把别的世界角色带进小剧场。
 */
export function listWorldAis(world) {
    const s = sdk();
    const w = world || getWorld();
    return listWorldAiPersons(w, s).map(toAiBrief);
}

function toAiBrief(ai) {
    return {
        id: String(ai?.id || ''),
        name: String(ai?.name || 'AI'),
        avatar: String(ai?.avatar || ''),
        avatarBg: String(ai?.avatarBg || ''),
        role: String(ai?.role || ''),
        personality: String(ai?.personality || ''),
        tone: String(ai?.tone || ''),
    };
}

/** 单个 AI 的简介，用于小剧场 prompt */
export function describeAi(aiId) {
    const s = sdk();
    const ai = s?.aiPersons?.get?.(aiId);
    if (!ai) return '';
    const bits = [
        ai.name,
        ai.role && `身份：${ai.role}`,
        ai.personality && `性格：${ai.personality}`,
        ai.tone && `说话方式：${ai.tone}`,
    ].filter(Boolean);
    return bits.join('，');
}

/** 用户自己的人设简介，小剧场里「我」要像我 */
export function describeUser(user) {
    const u = user || getDefaultUser();
    if (!u) return '';
    const bits = [
        u.name,
        u.gender && `性别：${u.gender}`,
        u.age && `年龄：${u.age}`,
        u.personality && `性格：${u.personality}`,
        u.bio && `简介：${u.bio}`,
    ].filter(Boolean);
    return bits.join('，');
}
