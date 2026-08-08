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
 *     createdAt / updatedAt
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
    MODES: { CALENDAR: 'calendar', STORY: 'story' },
    ARRAY_KEYS: { calendar: CAL_KEY, story: STO_KEY },
};
