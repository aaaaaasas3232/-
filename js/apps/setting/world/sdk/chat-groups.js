/**
 * settings-sdk · chat-app 「我创建的群聊」（v0.33）
 *
 *   业务含义：每个 User 人设都有自己的「群聊列表」，按聊天记录模式分两数组存在
 *   user.socialProfiles.chat 下:
 *     - calendarGroups[]  日历视图模式下的群聊
 *     - storyGroups[]     故事记录模式下的群聊
 *
 *   同一个 AI 群可以在两个 mode 同时存在 —— 但消息独立存储（chatMessages 走
 *   conversationId 维度，conversationType='group'）。
 *
 *   每条 entry 字段:
 *     id                string  群聊 entry id（ui 使用，比如 group-${ts}-${rand}）
 *     name              string  群聊显示名
 *     members           string[] 成员 aiPersonId 列表(至少 2 个 AI + 用户本人)
 *     mode              'calendar' | 'story'  入哪个数组
 *     boundWorldId      添加时的世界观快照
 *     lastMessage        { content, timestamp, senderName, type }
 *     lastMessageAt     timestamp
 *     unreadCount       number
 *     isPinned          boolean
 *     avatar            string  群头像(默认渐变色 + 字母)
 *     remark            string  群备注(每个 mode 独立)
 *     ownerId           string  群主 memberId。缺省 = 建群的那个 user.id
 *     adminIds          string[] 管理员 memberId 列表(不含群主 —— 群主权限本来就更大)
 *     memberNicknames   object  { [memberId]: string } 群昵称,空/缺失就用本名
 *     createdAt / updatedAt
 *
 *   ── memberId 约定 ─────────────────────────────────────
 *   群里成员有两种:用户本人和各个 AI。「群主 / 管理员 / 群昵称」三套数据
 *   都用同一个键索引:
 *       用户本人 → user.id（如 'user0'）
 *       AI 成员  → 它的 aiPersonId
 *   ⚠️ 这三个字段名(ownerId / adminIds / memberNicknames)是 v0.81
 *      群成员管理页就定下来的,SDK 后补的 helper 必须沿用同一套 ——
 *      再起一套 ownerKey / adminKeys / nicknames 就会变成「同一份数据
 *      两个字段名」,而那是本项目最高频的一类 bug(AGENTS2 §3.4)。
 *
 *   API:
 *     list(user, mode)                          读某 mode 下所有群聊
 *     get(user, groupId, mode)                  读单条
 *     has(user, groupId, mode)                  是否存在
 *     create(sdk, user, { name, memberIds, mode, boundWorldId? })
 *     update(user, groupId, mode, patch)
 *     remove(user, groupId, mode)
 *     updateLastMessage(user, groupId, mode, msg)
 *     addMember(user, groupId, mode, aiPersonId)
 *     removeMember(user, groupId, mode, aiPersonId)
 *     resolveMembers(sdk, user, group)          解析成员为 aiPerson 对象数组
 *     ── 群管理 helper(2026-08-13 新增,字段沿用 v0.81 的三个)──
 *     getOwnerId(group, fallbackUserId)         群主 memberId
 *     isOwner(group, memberId, fallbackUserId)
 *     isAdmin(group, memberId, fallbackUserId)  群主也算(权限是包含关系)
 *     listMemberIds(group, userId)              [userId, ...members]
 *     countMembers(group)                       群里几个人 = AI 数 + 1(用户本人)
 *     setOwner(sdk, user, groupId, mode, memberId)
 *     setAdmin(sdk, user, groupId, mode, memberId, on)
 *     setNickname(sdk, user, groupId, mode, memberId, nickname)
 *     getNickname(group, memberId)
 *     resolveMemberName(sdk, group, memberId, userId, fallbackUserName)  群昵称优先的显示名
 *     MODES                                         常量
 *
 *   设计要点:
 *   - 与 chatFriends 完全平行（数据结构 / API 风格都对齐）
 *   - 群聊不依赖 aiPerson 本身存在（即 AI 被删后群聊 metadata 仍保留，消息不丢）
 *   - 解析成员时缺失的 AI 用 fallback placeholder
 */

const CAL_KEY = 'calendarGroups';
const STO_KEY = 'storyGroups';

const VALID_MODES = new Set(['calendar', 'story']);

function arrayKey(mode) {
    return mode === 'story' ? STO_KEY : CAL_KEY;
}

function ensureChatProfile(user) {
    if (!user.socialProfiles) user.socialProfiles = {};
    if (!user.socialProfiles.chat) user.socialProfiles.chat = {};
    return user.socialProfiles.chat;
}

function ensureGroupArray(chatProfile, mode) {
    const key = arrayKey(mode);
    if (!Array.isArray(chatProfile[key])) chatProfile[key] = [];
    return chatProfile[key];
}

function findIndex(arr, groupId) {
    return arr.findIndex((g) => g && g.id === groupId);
}

function generateGroupId() {
    return `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 读某 user + mode 下所有群聊副本
 */
function list(user, mode) {
    if (!user) return [];
    const chatProfile = user.socialProfiles?.chat;
    const arr = chatProfile?.[arrayKey(mode)];
    return Array.isArray(arr) ? arr.slice() : [];
}

/**
 * 读某 user + groupId + mode 下单条 entry
 */
function get(user, groupId, mode) {
    if (!user || !groupId) return null;
    const arr = list(user, mode);
    return arr.find((g) => g.id === groupId) || null;
}

/**
 * 是否存在(同 groupId 同 mode)
 */
function has(user, groupId, mode) {
    return !!get(user, groupId, mode);
}

/**
 * 创建群聊。需要至少 2 个 AI 成员。
 * @param {Object} sdk
 * @param {Object} user
 * @param {Object} opts
 *   @prop {string} opts.name              群名
 *   @prop {string[]} opts.memberIds       AI 人设 id 列表(>= 2)
 *   @prop {'calendar'|'story'} opts.mode
 *   @prop {string} [opts.boundWorldId]    世界观快照
 * @returns {Promise<Object|null>}
 */
async function create(sdk, user, opts = {}) {
    if (!sdk?.users || !user) return null;
    const mode = opts.mode;
    if (!VALID_MODES.has(mode)) return null;
    const memberIds = Array.isArray(opts.memberIds) ? opts.memberIds.filter(Boolean) : [];
    if (memberIds.length < 2) return null;

    const t = Date.now();
    const entry = {
        id: generateGroupId(),
        name: opts.name || memberIds.map((id) => id).join('、').slice(0, 12) || '群聊',
        members: memberIds.slice(),
        mode,
        boundWorldId: opts.boundWorldId || '',
        lastMessage: null,
        lastMessageAt: 0,
        unreadCount: 0,
        isPinned: false,
        avatar: '',
        remark: '',
        // 群是用户建的，所以用户默认就是群主。
        // 之后可以在群成员管理页把群主转给某个 AI —— 那之后「谁当管理员、
        // 谁叫什么群昵称」就归 AI 管，用户只能按一个按钮请 AI 去安排。
        ownerId: user?.id || '',
        adminIds: [],
        memberNicknames: {},
        createdAt: t,
        updatedAt: t,
    };

    const chatProfile = ensureChatProfile(user);
    const arr = ensureGroupArray(chatProfile, mode);
    arr.push(entry);
    await sdk.users.update(user.id, {
        socialProfiles: user.socialProfiles,
        updatedAt: t,
    });
    return entry;
}

/**
 * 更新某条 entry(merge patch)
 */
async function update(sdk, user, groupId, mode, patch = {}) {
    if (!sdk?.users || !user || !groupId || !VALID_MODES.has(mode)) return null;
    const arr = ensureGroupArray(ensureChatProfile(user), mode);
    const idx = findIndex(arr, groupId);
    if (idx < 0) return null;

    const next = { ...arr[idx], ...patch, id: groupId, mode, updatedAt: Date.now() };
    arr[idx] = next;
    await sdk.users.update(user.id, {
        socialProfiles: user.socialProfiles,
        updatedAt: next.updatedAt,
    });
    return next;
}

/**
 * 删除某群聊
 */
async function remove(sdk, user, groupId, mode) {
    if (!sdk?.users || !user || !groupId || !VALID_MODES.has(mode)) return false;
    const arr = ensureGroupArray(ensureChatProfile(user), mode);
    const idx = findIndex(arr, groupId);
    if (idx < 0) return false;

    arr.splice(idx, 1);
    await sdk.users.update(user.id, {
        socialProfiles: user.socialProfiles,
        updatedAt: Date.now(),
    });
    return true;
}

/**
 * 更新 lastMessage(给 group-page 发消息时调用)
 */
async function updateLastMessage(sdk, user, groupId, mode, msg = {}) {
    return update(sdk, user, groupId, mode, {
        lastMessage: msg,
        lastMessageAt: msg.timestamp || Date.now(),
    });
}

/**
 * 添加成员
 */
async function addMember(sdk, user, groupId, mode, aiPersonId) {
    const existing = get(user, groupId, mode);
    if (!existing) return null;
    if (existing.members.includes(aiPersonId)) return existing;
    return update(sdk, user, groupId, mode, { members: [...existing.members, aiPersonId] });
}

/**
 * 移除成员
 */
async function removeMember(sdk, user, groupId, mode, aiPersonId) {
    const existing = get(user, groupId, mode);
    if (!existing) return null;
    if (!existing.members.includes(aiPersonId)) return existing;
    const nextMembers = existing.members.filter((id) => id !== aiPersonId);
    if (nextMembers.length < 2) return null; // 群聊至少 2 AI
    return update(sdk, user, groupId, mode, { members: nextMembers });
}

/**
 * 解析成员为 aiPerson 对象数组，找不到的 AI 走 placeholder fallback
 */
function resolveMembers(sdk, user, group) {
    if (!group || !Array.isArray(group.members)) return [];
    const out = [];
    for (const aiPersonId of group.members) {
        const ai = sdk?.aiPersons?.get?.(aiPersonId);
        if (ai) {
            out.push(ai);
        } else {
            out.push({
                id: aiPersonId,
                name: aiPersonId,
                avatar: '',
                avatarBg: '#A8C8EC',
                socialProfiles: { chat: { nickname: '' } },
            });
        }
    }
    return out;
}

// ============================================================
// 群管理 helper：群主 / 管理员 / 群昵称（2026-08-13）
// ------------------------------------------------------------
// 字段沿用 v0.81 群成员管理页定下来的 ownerId / adminIds / memberNicknames，
// 不另起一套（见文件头的 ⚠️）。
//
// 这些 helper 的意义是：把「谁是群主」「显示名该用昵称还是本名」这两个判断
// 收敛到一处。之前散在页面、methods、prompt-builder 三处各写一遍，
// 结果是同一个人在成员管理页显示群昵称、在聊天气泡上显示本名。
//
// 所有写操作都走 update() 落盘，不直接改 arr[idx] —— 那样只改内存，刷新回滚。
// ============================================================

/** 群主 memberId。老群聊没有这个字段，视为建群的那个用户是群主。 */
function getOwnerId(group, fallbackUserId = '') {
    return String(group?.ownerId || fallbackUserId || '');
}

function isOwner(group, memberId, fallbackUserId = '') {
    const owner = getOwnerId(group, fallbackUserId);
    return !!owner && owner === String(memberId || '');
}

/**
 * 是否有管理权限。
 * 群主也返回 true —— 权限是包含关系，判断「能不能改群设置」时问这一句就够，
 * 不用每处都写 `isOwner || isAdmin`（写着写着就会漏一处）。
 */
function isAdmin(group, memberId, fallbackUserId = '') {
    const key = String(memberId || '');
    if (!key) return false;
    if (isOwner(group, key, fallbackUserId)) return true;
    const admins = Array.isArray(group?.adminIds) ? group.adminIds : [];
    return admins.map(String).includes(key);
}

/** 群里所有成员的 memberId：用户本人 + 各个 AI */
function listMemberIds(group, userId = '') {
    const members = Array.isArray(group?.members) ? group.members.map(String) : [];
    return userId ? [String(userId), ...members] : members;
}

/**
 * 群里一共几个人 —— **算上用户本人**。
 *
 * `group.members` 存的只有 AI 的 aiPersonId，用户不在里面（用户是「这个群的拥有者」，
 * 不需要存 id 也能确定）。所以直接拿 members.length 去显示，两个 AI 的群会写成
 * 「2 人」，但用户明明也在群里聊天，正确的说法是 3 位成员。
 * 凡是要把人数画到界面上的地方都走这里，别再各自 .length。
 */
function countMembers(group) {
    const aiCount = Array.isArray(group?.members) ? group.members.length : 0;
    return aiCount + 1;
}

/** 转让群主。新群主如果原本挂在管理员名单里，顺手摘掉（群主不占管理员名额）。 */
async function setOwner(sdk, user, groupId, mode, memberId) {
    const group = get(user, groupId, mode);
    if (!group) return null;
    const key = String(memberId || '');
    if (!listMemberIds(group, user?.id).includes(key)) return null;
    const adminIds = (Array.isArray(group.adminIds) ? group.adminIds : [])
        .map(String).filter((k) => k !== key);
    return update(sdk, user, groupId, mode, { ownerId: key, adminIds });
}

/** 设 / 撤管理员。群主不能被设成管理员（它已经比管理员大了）。 */
async function setAdmin(sdk, user, groupId, mode, memberId, on) {
    const group = get(user, groupId, mode);
    if (!group) return null;
    const key = String(memberId || '');
    if (!listMemberIds(group, user?.id).includes(key)) return null;
    if (isOwner(group, key, user?.id)) return group;
    const cur = (Array.isArray(group.adminIds) ? group.adminIds : []).map(String);
    const already = cur.includes(key);
    if (on === already) return group;
    const next = on ? [...cur, key] : cur.filter((k) => k !== key);
    return update(sdk, user, groupId, mode, { adminIds: next });
}

/** 设群昵称。传空串 = 清掉，回落到本名（而不是存一个空串当昵称）。 */
async function setNickname(sdk, user, groupId, mode, memberId, nickname) {
    const group = get(user, groupId, mode);
    if (!group) return null;
    const key = String(memberId || '');
    if (!listMemberIds(group, user?.id).includes(key)) return null;
    const map = { ...(group.memberNicknames || {}) };
    const value = String(nickname || '').trim();
    if (value) map[key] = value;
    else delete map[key];
    return update(sdk, user, groupId, mode, { memberNicknames: map });
}

function getNickname(group, memberId) {
    const map = group?.memberNicknames || {};
    const v = map[String(memberId || '')];
    return (typeof v === 'string' && v.trim()) ? v.trim() : '';
}

/**
 * 群里的显示名：群昵称优先，没有就用本名。
 * 所有「要把成员名字画到屏幕上 / 写进 prompt」的地方都该走这里，
 * 否则某个页面显示群昵称、另一个显示本名，用户会以为是两个人。
 */
function resolveMemberName(sdk, group, memberId, userId = '', fallbackUserName = '我') {
    const key = String(memberId || '');
    const nick = getNickname(group, key);
    if (nick) return nick;
    if (userId && key === String(userId)) return fallbackUserName || '我';
    const ai = sdk?.aiPersons?.get?.(key);
    return ai?.socialProfiles?.chat?.nickname || ai?.name || key;
}

export const chatGroups = {
    list,
    get,
    has,
    create,
    update,
    remove,
    updateLastMessage,
    addMember,
    removeMember,
    resolveMembers,
    // 群管理
    getOwnerId,
    isOwner,
    isAdmin,
    listMemberIds,
    countMembers,
    setOwner,
    setAdmin,
    setNickname,
    getNickname,
    resolveMemberName,
    MODES: { CALENDAR: 'calendar', STORY: 'story' },
    ARRAY_KEYS: { calendar: CAL_KEY, story: STO_KEY },
};
