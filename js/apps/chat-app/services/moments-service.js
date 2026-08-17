/**
 * chat-app · services/moments-service.js
 *
 * 朋友圈的数据层。把「用户自己发的」和「AI 发的」两套完全不同的存储抹平成一份列表，
 * 并提供收藏 / 编辑 / 删除的统一入口。
 *
 * 两套存储（这是历史包袱，短期内不打算合并）：
 *   - 用户朋友圈：localStorage['xiaoting::chat-user-moments']，chat-post 页写入
 *   - AI 朋友圈：挂在 aiPerson.moments[]，走 `sdk.moments.*`，由 [发朋友圈:] token 写入
 *
 * v0.87 修掉的几件事：
 *   1. 朋友圈 tab **只显示用户自己的动态** —— AI 发的朋友圈只能在设置里的概要弹窗看到，
 *      主 feed 里根本不出现。现在两边合并按时间倒序。
 *   2. 「收藏」写的是 `xiaoting::chat-moment-favorites` 这个**孤儿 key**，
 *      跟真正的收藏系统（`sdk.chatFavorites`）毫无关系 —— 用户点了收藏，
 *      收藏页里永远看不到。现在统一写 `sdk.chatFavorites`（type='moments'），
 *      localStorage 只作为「按钮高亮」的同步镜像。
 *   3. 收藏状态不持久：只加了个 CSS class，重渲染就没了。现在渲染时读镜像回填。
 */

const USER_MOMENTS_KEY = 'xiaoting::chat-user-moments';
const LEGACY_USER_MOMENTS_KEY = 'xiaoting::user-moments-v1';
/** 收藏镜像：只存 momentId，用来给按钮打高亮；真身在 sdk.chatFavorites */
const FAVORITE_MIRROR_KEY = 'xiaoting::chat-moment-favorite-ids-v1';
/** 用户自己的朋友圈在 chatFavorites 里挂的会话 id（不是真的 AI） */
export const USER_MOMENT_OWNER = 'self-moments';

// ---------------------------------------------------------------------------
// 用户朋友圈（localStorage）
// ---------------------------------------------------------------------------

export function loadUserMoments() {
    const merged = new Map();
    const collect = (raw) => {
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return;
            for (const m of parsed) {
                if (!m || !m.id) continue;
                if (!merged.has(String(m.id))) merged.set(String(m.id), m);
            }
        } catch (_) { /* 坏数据跳过 */ }
    };
    try { collect(localStorage.getItem(USER_MOMENTS_KEY)); } catch (_) {}
    // 历史 key：早期版本写在这里，读的时候一起合进来
    try { collect(localStorage.getItem(LEGACY_USER_MOMENTS_KEY)); } catch (_) {}
    return Array.from(merged.values()).map((m) => ({ ...m, isUser: true }));
}

export function saveUserMoments(list) {
    try {
        localStorage.setItem(USER_MOMENTS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
        return true;
    } catch (err) {
        console.warn('[moments] 保存用户朋友圈失败', err);
        return false;
    }
}

// ---------------------------------------------------------------------------
// AI 朋友圈（aiPerson.moments[]）
// ---------------------------------------------------------------------------

/** 列出所有 AI 人设发过的朋友圈，归一成跟用户动态同一个形状 */
export function loadAiMoments() {
    const out = [];
    try {
        const sdk = window.settingsSdk;
        if (!sdk?.moments?.list || !sdk?.aiPersons?.list) return out;
        const persons = sdk.aiPersons.list() || [];
        for (const p of persons) {
            if (!p?.id) continue;
            const list = sdk.moments.list(p.id) || [];
            for (const m of list) {
                if (!m?.id) continue;
                out.push({
                    id: m.id,
                    authorId: p.id,
                    authorName: p.socialProfiles?.chat?.nickname || p.name || p.id,
                    isUser: false,
                    content: m.content || '',
                    images: Array.isArray(m.images) ? m.images : [],
                    aiImages: Array.isArray(m.aiImages) ? m.aiImages : [],
                    location: m.location || '',
                    timestamp: Number(m.timestamp) || 0,
                    summary: m.summary || '',
                });
            }
        }
    } catch (err) {
        console.warn('[moments] 读取 AI 朋友圈失败', err);
    }
    return out;
}

/** 用户 + AI 全部动态，按时间倒序 */
export function loadAllMoments() {
    return [...loadUserMoments(), ...loadAiMoments()]
        .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
}

// ---------------------------------------------------------------------------
// 编辑 / 删除
// ---------------------------------------------------------------------------

/**
 * 改一条动态的正文（用户的和 AI 的都支持）。
 * @returns {Promise<boolean>}
 */
export async function updateMomentContent(moment, nextContent) {
    const text = String(nextContent || '').trim();
    if (!moment?.id) return false;
    if (moment.isUser) {
        const list = loadUserMoments();
        const idx = list.findIndex((m) => String(m.id) === String(moment.id));
        if (idx < 0) return false;
        list[idx] = { ...list[idx], content: text, editedAt: Date.now() };
        return saveUserMoments(list);
    }
    try {
        const sdk = window.settingsSdk;
        if (!sdk?.moments?.update || !moment.authorId) return false;
        // 正文改了，原来那条 summary 就对不上了 —— 清掉等下次重新生成，
        // 否则注入给 AI 的概要会跟用户看到的内容不一致。
        const res = await sdk.moments.update(moment.authorId, moment.id, {
            content: text,
            summary: '',
            summaryGeneratedAt: 0,
        });
        return !!res;
    } catch (err) {
        console.warn('[moments] 更新 AI 朋友圈失败', err);
        return false;
    }
}

/** 删一条动态（用户的和 AI 的都支持） */
export async function deleteMoment(moment) {
    if (!moment?.id) return false;
    if (moment.isUser) {
        const list = loadUserMoments().filter((m) => String(m.id) !== String(moment.id));
        return saveUserMoments(list);
    }
    try {
        const sdk = window.settingsSdk;
        if (!sdk?.moments?.remove || !moment.authorId) return false;
        return await sdk.moments.remove(moment.authorId, moment.id);
    } catch (err) {
        console.warn('[moments] 删除 AI 朋友圈失败', err);
        return false;
    }
}

// ---------------------------------------------------------------------------
// 收藏
// ---------------------------------------------------------------------------

function readMirror() {
    try {
        const raw = localStorage.getItem(FAVORITE_MIRROR_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch (_) {
        return new Set();
    }
}

function writeMirror(set) {
    try {
        localStorage.setItem(FAVORITE_MIRROR_KEY, JSON.stringify(Array.from(set)));
    } catch (_) { /* 配额满了只影响高亮 */ }
}

/** 当前已收藏的 momentId 集合（渲染时用来给心形按钮打高亮） */
export function getFavoritedMomentIds() {
    const mirror = readMirror();
    // 以 sdk 为准补一次：用户可能在收藏页里删过
    try {
        const sdk = window.settingsSdk;
        const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
        if (sdk?.chatFavorites?.list && user) {
            const real = new Set(
                (sdk.chatFavorites.list(user) || [])
                    .filter((f) => f && f.type === 'moments' && f.momentId)
                    .map((f) => String(f.momentId)),
            );
            if (real.size > 0 || mirror.size > 0) {
                writeMirror(real);
                return real;
            }
        }
    } catch (_) { /* SDK 没就绪就用镜像 */ }
    return mirror;
}

/**
 * 收藏 / 取消收藏一条动态。写真正的收藏系统（`sdk.chatFavorites`），
 * 这样「收藏 → 朋友圈」分类里才看得到。
 *
 * @returns {Promise<{ok:boolean, favorited:boolean, error?:string}>}
 */
export async function toggleFavoriteMoment(moment) {
    if (!moment?.id) return { ok: false, favorited: false, error: '缺少动态 id' };
    const sdk = window.settingsSdk;
    const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
    if (!sdk?.chatFavorites || !user) {
        return { ok: false, favorited: false, error: '收藏服务未就绪' };
    }
    // 用户自己的动态没有 AI 会话可挂，用一个固定的伪会话 id
    const ownerId = moment.isUser ? USER_MOMENT_OWNER : (moment.authorId || USER_MOMENT_OWNER);
    const mode = 'calendar';
    const messageId = `moment-${moment.id}`;

    try {
        if (sdk.chatFavorites.has(user, ownerId, mode, messageId)) {
            await sdk.chatFavorites.remove(user, ownerId, mode, messageId);
            const mirror = readMirror();
            mirror.delete(String(moment.id));
            writeMirror(mirror);
            return { ok: true, favorited: false };
        }
        await sdk.chatFavorites.add(user, ownerId, mode, {
            id: messageId,
            type: 'moments',
            sender: moment.isUser ? 'user' : 'ai',
            senderName: moment.authorName || (moment.isUser ? '我' : 'AI'),
            content: moment.content || '',
            momentId: String(moment.id),
            momentAuthorId: moment.authorId || '',
            momentIsUser: !!moment.isUser,
            momentImages: Array.isArray(moment.images) ? moment.images : [],
            momentAiImages: Array.isArray(moment.aiImages) ? moment.aiImages : [],
            momentLocation: moment.location || '',
            momentTimestamp: Number(moment.timestamp) || Date.now(),
        }, {
            sourceType: 'private',
            conversationId: ownerId,
        });
        const mirror = readMirror();
        mirror.add(String(moment.id));
        writeMirror(mirror);
        return { ok: true, favorited: true };
    } catch (err) {
        console.warn('[moments] 收藏失败', err);
        return { ok: false, favorited: false, error: err?.message || '' };
    }
}
