/**
 * 群聊「自定义」身份：以某个群 AI 的名义发消息。
 * 存在 localStorage，按 (groupId, mode) 分开。空字符串 = 以我自己发。
 */

const PREFIX = 'xiaoting::chat-group-as::';

export function groupSendAsStorageKey(groupId, mode) {
    return `${PREFIX}${groupId}::${mode || 'calendar'}`;
}

export function getGroupSendAsId(groupId, mode) {
    if (!groupId) return '';
    try {
        return String(localStorage.getItem(groupSendAsStorageKey(groupId, mode)) || '').trim();
    } catch (_) {
        return '';
    }
}

export function setGroupSendAsId(groupId, mode, memberId) {
    if (!groupId) return;
    try {
        const key = groupSendAsStorageKey(groupId, mode);
        const id = String(memberId || '').trim();
        if (id) localStorage.setItem(key, id);
        else localStorage.removeItem(key);
    } catch (_) { /* 隐私模式 / 配额满 */ }
}

/**
 * 当前这条群消息该写成谁。
 * 选了 AI → sender:'ai' + senderId；否则仍是用户自己。
 */
export function resolveGroupWriteIdentity(sdk, user, groupId, mode, fallbackName) {
    const userId = String(user?.id || '');
    const asId = getGroupSendAsId(groupId, mode);
    const fallback = fallbackName || user?.name || '我';
    if (!asId || asId === userId) {
        return { sender: 'user', senderName: fallback, senderId: userId };
    }
    let group = null;
    try {
        group = sdk?.chatGroups?.get?.(user, groupId, mode)
            || sdk?.chatGroups?.get?.(user, groupId, 'calendar')
            || sdk?.chatGroups?.get?.(user, groupId, 'story');
    } catch (_) {}
    let name = '';
    try {
        name = sdk?.chatGroups?.resolveMemberName?.(sdk, group, asId, userId, fallback) || '';
    } catch (_) {}
    if (!name) {
        try {
            const ai = sdk?.aiPersons?.get?.(asId);
            name = ai?.socialProfiles?.chat?.nickname || ai?.name || asId;
        } catch (_) {
            name = asId;
        }
    }
    return { sender: 'ai', senderName: name, senderId: asId };
}
