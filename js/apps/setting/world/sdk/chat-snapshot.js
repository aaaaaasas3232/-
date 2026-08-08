/**
 * settings-sdk · chat-app 「顶层快照」(v0.28)
 *
 *   业务含义:chat-app 冷启动时不应该等 SDK async hydrate 完才看到内容。
 *   在 SDK 任意数据变化时,把 chat-app 关心的「默认用户卡 / 当前用户 / 当前世界
 *   / 同世界 AI 人设名单」快照到 localStorage,chat-app 启动**同步**读这份快照
 *   即可秒渲染。
 *
 *   localStorage key: `xiaoting::chat-snapshot-v1`
 *
 *   字段:
 *     ts                  时间戳(用作缓存版本)
 *     defaultUserId       sdk.defaultUserCard.getDefault()?.id
 *     activeUserId        sdk.users.getActive()?.id
 *     defaultUserBoundWorldId    默认用户卡绑的世界观
 *     activeUserBoundWorldId     当前活跃用户绑的世界观
 *     defaultUser         默认用户卡缩略(头像/昵称/avatarBg/socialProfiles.chat)
 *     activeUser          当前活跃用户缩略
 *     world               当前世界缩略(id/name)
 *     aiPersons           默认用户卡绑的世界下所有 AI 人设缩略
 *                         (含 socialProfiles.chat 必要字段 + replyPromptsActive
 *                          激活的 replyPrompt id 列表,供冷启动 fallback)
 *
 *   API:
 *     loadSnapshot()                              读 localStorage 快照(同步)
 *     saveSnapshot(sdk)                           把 sdk 当前状态写入快照
 *     clearSnapshot()                             清掉(用户数据全清时用)
 *
 *   写入时机(SDK 侧):
 *     - users.create / update / remove
 *     - aiPersons.create / update / remove
 *     - worlds.create / update / remove
 *     - defaultUserCard.setDefault
 *     - 用户切换(settings:user-switched)
 *
 *   读取时机(chat-app 侧):
 *     - chat-app hydrate() 里**同步**调 loadSnapshot,先渲染列表骨架
 *     - SDK ready 后异步调 refreshNewChatContacts / refreshProfileTab,再校准
 *
 *   v0.50 扩展:aiPersons 摘要里加 replyPromptsActive 字段
 *     - 形态: string[] = 激活的 replyPrompt id 列表(按 order)
 *     - chat-app 冷启动时,先从 snapshot 拿 id 列表 + 渲染 prompt-manager 计数等
 *     - SDK ready 后,prompt-manager-page 用 sdk.replyPrompts.list() 拿完整数据再重画
 */

const STORAGE_KEY = 'xiaoting::chat-snapshot-v1';

const SAFE_AVATAR_FIELDS = ['nickname', 'avatar', 'avatarCode', 'avatarBg', 'signature'];

function pickChatProfile(person) {
    if (!person) return null;
    const c = person.socialProfiles?.chat || {};
    const picked = {};
    for (const k of SAFE_AVATAR_FIELDS) {
        if (c[k] !== undefined) picked[k] = c[k];
    }
    return picked;
}

function pickPersonSummary(person) {
    if (!person) return null;
    const summary = {
        id: person.id,
        name: person.name,
        boundWorldId: person.boundWorldId || '',
        avatar: person.avatar || '',
        avatarBg: person.avatarBg || '',
        chat: pickChatProfile(person),
    };
    // ★ v0.50:快照里加 replyPromptsActive 字段(只取 id,避免膨胀 localStorage)
    //   SDK ready 后 chat-app 会调 sdk.replyPrompts.list() 拿完整数据
    if (Array.isArray(person.replyPrompts) && person.replyPrompts.length > 0) {
        summary.replyPromptsActive = person.replyPrompts
            .filter((p) => p && p.active !== false)
            .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
            .map((p) => p.id)
            .filter((id) => typeof id === 'string' && id);
    }
    return summary;
}

/**
 * 从 sdk 构造一份快照对象(纯内存,不写 localStorage)
 */
export function buildSnapshot(sdk) {
    if (!sdk) return null;
    try {
        const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
        const activeUser = sdk.users.getActive();
        const defaultBound = defaultUser?.boundWorldId || '';
        const activeBound = activeUser?.boundWorldId || '';
        // 决定「当前世界」:default 优先(activeBound 兜底,但 snapshot 不允许悄悄用)
        const effectiveWorldId = defaultBound || activeBound;
        const world = effectiveWorldId ? sdk.worlds?.get?.(effectiveWorldId) : null;

        const allAiPersons = sdk.aiPersons?.list?.() || [];
        const aiPersons = allAiPersons
            .filter((p) => effectiveWorldId && p.boundWorldId === effectiveWorldId && p.id !== defaultUser?.id)
            .map((p) => {
                const summary = pickPersonSummary(p);
                summary.boundWorldName = world?.name || p.boundWorldId || '';
                return summary;
            });

        return {
            ts: Date.now(),
            defaultUserId: defaultUser?.id || '',
            activeUserId: activeUser?.id || '',
            defaultUserBoundWorldId: defaultBound,
            activeUserBoundWorldId: activeBound,
            defaultUser: pickPersonSummary(defaultUser),
            activeUser: pickPersonSummary(activeUser),
            world: world ? { id: world.id, name: world.name || world.id } : null,
            aiPersons,
        };
    } catch (err) {
        console.warn('[chat-snapshot] buildSnapshot failed:', err);
        return null;
    }
}

/**
 * 同步读 localStorage 快照(失败返回 null)
 */
export function loadSnapshot() {
    if (typeof localStorage === 'undefined') return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return null;
        return obj;
    } catch (err) {
        console.warn('[chat-snapshot] loadSnapshot parse failed:', err);
        return null;
    }
}

/**
 * 把 sdk 当前状态写入 localStorage
 */
export function saveSnapshot(sdk) {
    if (typeof localStorage === 'undefined') return;
    const obj = buildSnapshot(sdk);
    if (!obj) return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (err) {
        console.warn('[chat-snapshot] saveSnapshot failed:', err);
    }
}

export function clearSnapshot() {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
}

export const SNAPSHOT_STORAGE_KEY = STORAGE_KEY;
