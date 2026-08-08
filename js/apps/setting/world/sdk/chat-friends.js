/**
 * settings-sdk · chat-app 「我加的好友」（v0.28）
 *
 *   业务含义：每个 User 人设都有自己的「好友名单」,按聊天记录模式
 *   分两个数组存在 user.socialProfiles.chat 下:
 *     - calendarContacts[]  日历视图模式（正常使用 / 真实社媒）
 *     - storyContacts[]     故事记录模式（暂时性情景扮演 / 游戏）
 *
 *   同一个 AI 人设可以同时出现在两个数组里 —— 每个数组里同一个 aiPersonId
 *   只允许出现一次（重复添加返回 null）。
 *
 *   每条 entry 字段：
 *     aiPersonId      绑定的 AI 人设 id
 *     displayName     显示名（chat.nickname || person.name || aiPersonId）
 *     avatar          头像 URL
 *     avatarBg        头像背景色
 *     boundWorldId    添加时的世界观快照
 *     lastMessage     { content, timestamp, senderName, type }
 *     lastMessageAt   时间戳
 *     unreadCount     未读数
 *     isPinned        是否置顶
 *     remark          备注（每个 mode 独立存储）
 *     chatBackground  聊天背景（每个 mode 独立,值可以是 'color:<hex>' /
 *                     'gradient:<css>' / 'image:<dataURL/url>' 三种前缀之一,
 *                     旧版无前缀当作 image 兼容）
 *     createdAt / updatedAt
 *
 *   id 约定（不存到 entry 里,运行时拼装）：
 *     <aiPersonId>::<mode>   例如 'ai0::calendar'
 *     同时用于 detail pageId：private-<aiPersonId>-<mode>
 *
 *   API：
 *     list(user, mode)                读某 mode 下所有 entry
 *     get(user, aiPersonId, mode)     读单条
 *     has(user, aiPersonId, mode)     是否已加
 *     add(user, aiPerson, mode)       添加(异步,落盘)
 *     update(user, aiPersonId, mode, patch)  更新
 *     updateRemark(user, aiPersonId, mode, remark)  更新备注
 *     updateBackground(user, aiPersonId, mode, value)  更新聊天背景
 *     togglePin(user, aiPersonId, mode)     翻转置顶(isPinned 取反)
 *     remove(user, aiPersonId, mode)  删除
 *     updateLastMessage(user, aiPersonId, mode, msg)
 */

const CAL_KEY = 'calendarContacts';
const STO_KEY = 'storyContacts';

const VALID_MODES = new Set(['calendar', 'story']);

function arrayKey(mode) {
    return mode === 'story' ? STO_KEY : CAL_KEY;
}

function ensureChatProfile(user) {
    if (!user.socialProfiles) user.socialProfiles = {};
    if (!user.socialProfiles.chat) user.socialProfiles.chat = {};
    return user.socialProfiles.chat;
}

function ensureContactArray(chatProfile, mode) {
    const key = arrayKey(mode);
    if (!Array.isArray(chatProfile[key])) chatProfile[key] = [];
    return chatProfile[key];
}

function findIndex(arr, aiPersonId) {
    return arr.findIndex((c) => c && c.aiPersonId === aiPersonId);
}

/**
 * 读某 user + mode 下所有联系人副本
 */
function list(user, mode) {
    if (!user) return [];
    const chatProfile = user.socialProfiles?.chat;
    const arr = chatProfile?.[arrayKey(mode)];
    return Array.isArray(arr) ? arr.slice() : [];
}

/**
 * 读某 user + aiPersonId + mode 下单条 entry
 */
function get(user, aiPersonId, mode) {
    if (!user || !aiPersonId) return null;
    const arr = list(user, mode);
    return arr.find((c) => c.aiPersonId === aiPersonId) || null;
}

/**
 * 是否已加(同 AI 同 mode)
 */
function has(user, aiPersonId, mode) {
    return !!get(user, aiPersonId, mode);
}

/**
 * 拼装 / 解析 entry id
 */
export function contactId(aiPersonId, mode) {
    return `${aiPersonId}::${mode}`;
}

export function parseContactId(id) {
    if (!id || typeof id !== 'string') return null;
    const idx = id.lastIndexOf('::');
    if (idx < 0) return null;
    return {
        aiPersonId: id.slice(0, idx),
        mode: id.slice(idx + 2),
    };
}

/**
 * 给 user 添加一条好友 entry。
 *
 * @param {Object} sdk             window.settingsSdk
 * @param {Object} user            user 实例(从 sdk.users.getActive() / defaultUserCard.getDefault() 来)
 * @param {Object} aiPerson        aiPerson 实例(整条 record)
 * @param {string} mode            'calendar' | 'story'
 * @returns {Promise<Object|null>} 新 entry;同 AI 同 mode 已存在返回 null
 */
async function add(sdk, user, aiPerson, mode) {
    if (!sdk?.users || !user || !aiPerson) return null;
    if (!VALID_MODES.has(mode)) return null;

    const aiPersonId = aiPerson.id;
    if (!aiPersonId) return null;

    const chatProfile = ensureChatProfile(user);
    const arr = ensureContactArray(chatProfile, mode);

    if (findIndex(arr, aiPersonId) >= 0) {
        // 同 AI 同 mode 已存在 → 拒绝重复添加
        return null;
    }

    const chatPerson = aiPerson.socialProfiles?.chat || {};
    const t = Date.now();
    const entry = {
        aiPersonId,
        displayName: chatPerson.nickname || aiPerson.name || aiPersonId,
        avatar: chatPerson.avatar || '',
        avatarBg: chatPerson.avatarBg || '',
        boundWorldId: aiPerson.boundWorldId || '',
        remark: chatPerson.remark || '', // 备注（每个 mode 独立存储）
        chatBackground: '', // 聊天背景（每个 mode 独立存储,前缀格式: color:|gradient:|image:）
        lastMessage: null,
        lastMessageAt: 0,
        unreadCount: 0,
        isPinned: false,
        createdAt: t,
        updatedAt: t,
    };

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
async function update(sdk, user, aiPersonId, mode, patch = {}) {
    if (!sdk?.users || !user || !aiPersonId || !VALID_MODES.has(mode)) return null;
    const arr = ensureContactArray(ensureChatProfile(user), mode);
    const idx = findIndex(arr, aiPersonId);
    if (idx < 0) return null;

    const next = { ...arr[idx], ...patch, aiPersonId, updatedAt: Date.now() };
    arr[idx] = next;
    await sdk.users.update(user.id, {
        socialProfiles: user.socialProfiles,
        updatedAt: next.updatedAt,
    });
    return next;
}

/**
 * 更新某条 entry 的备注
 * @param {Object} sdk
 * @param {Object} user
 * @param {string} aiPersonId
 * @param {string} mode 'calendar' | 'story'
 * @param {string} remark 备注文本
 * @returns {Promise<Object|null>}
 */
async function updateRemark(sdk, user, aiPersonId, mode, remark = '') {
    return update(sdk, user, aiPersonId, mode, { remark: remark });
}

/**
 * 更新某条 entry 的聊天背景（v0.29）
 * 传入值可以是:
 *   - '' / null            → 清空背景
 *   - 'color:<hex>'        → 纯色,例如 'color:#E8F2FF'
 *   - 'gradient:<css>'     → 渐变,例如 'gradient:linear-gradient(135deg,#A8C8EC,#FFE8F0)'
 *   - 'image:<url|dataURL>'→ 图片,例如 'image:data:image/png;base64,...'
 *
 * @param {Object} sdk
 * @param {Object} user
 * @param {string} aiPersonId
 * @param {string} mode
 * @param {string} value
 * @returns {Promise<Object|null>}
 */
async function updateBackground(sdk, user, aiPersonId, mode, value = '') {
    return update(sdk, user, aiPersonId, mode, { chatBackground: value || '' });
}

/**
 * 翻转某条 entry 的 isPinned(true → false / false → true)。
 * 聊天设置页的「置顶聊天」开关专用 —— 复用通用 update 接口。
 * 返回更新后的 entry；entry 不存在返回 null。
 */
async function togglePin(sdk, user, aiPersonId, mode) {
    const existing = get(user, aiPersonId, mode);
    if (!existing) return null;
    return update(sdk, user, aiPersonId, mode, { isPinned: !existing.isPinned });
}

/**
 * 删除某条 entry
 */
async function remove(sdk, user, aiPersonId, mode) {
    if (!sdk?.users || !user || !aiPersonId || !VALID_MODES.has(mode)) return false;
    const arr = ensureContactArray(ensureChatProfile(user), mode);
    const idx = findIndex(arr, aiPersonId);
    if (idx < 0) return false;

    arr.splice(idx, 1);
    await sdk.users.update(user.id, {
        socialProfiles: user.socialProfiles,
        updatedAt: Date.now(),
    });
    return true;
}

/**
 * 更新 lastMessage(给 chat-page 发消息时调用)
 */
async function updateLastMessage(sdk, user, aiPersonId, mode, msg = {}) {
    return update(sdk, user, aiPersonId, mode, {
        lastMessage: msg,
        lastMessageAt: msg.timestamp || Date.now(),
    });
}

export const chatFriends = {
    list,
    get,
    has,
    add,
    update,
    updateRemark,
    updateBackground,
    togglePin,
    remove,
    updateLastMessage,
    contactId,
    parseContactId,
    MODES: { CALENDAR: 'calendar', STORY: 'story' },
};