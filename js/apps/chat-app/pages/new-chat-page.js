/**
 * chat-app / 发起聊天页面（v0.23 接入联系人独立副本 + 模式过滤）
 *
 * 入口:
 *   - 消息列表 → 「+」 → 先 push record-mode-selector → 选定 mode 后再 push 本页
 *   - 选 mode 时把 pendingMode 写到 app.state.chatPage.pendingMode
 *
 * 渲染:
 *   - 联系人列表 = 当前世界观下的 AI 人设 - 已加进当前 mode 的
 *   - 点联系人 → 创建 chatContacts entry（独立副本） → push 私聊
 */

import { escapeHtml } from '@/src/core/escape.js';
import { getImageSrcByCode } from '../../setting/gallery/gallery-db.js';
import { loadSnapshot as loadChatSnapshot } from '../../setting/world/sdk/chat-snapshot.js';

// 兜底联系人（SDK 完全空时）
export const DEMO_CONTACTS = [
    { id: 'ai-demo-1', name: '示例角色', type: 'ai', status: 'online', boundWorldId: '' },
];

/**
 * 头像背景色（按 id 散列）
 */
export function getAvatarColor(id) {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F8B500', '#6C5CE7', '#A29BFE'];
    let index = 0;
    for (let i = 0; i < id.length; i++) {
        index += id.charCodeAt(i);
    }
    return colors[index % colors.length];
}

/**
 * 当前世界观下的 AI 人设列表（带头像 URL）
 *
 * v0.27 改造:
 *   - 「已加」判定走 user.socialProfiles.chat.calendarContacts / storyContacts
 *   - 用 `addedInMode` + `addedInOtherMode` 两个字段标记,而不是直接过滤掉
 *     (用户要求:同 AI 同 mode 已加 → 显示但 disabled;同 AI 异 mode → 仍可加)
 *
 * v0.27 二次改造:
 *   - 默认用户卡若没绑世界,**fallback 到 active user 的 boundWorldId**
 *     (否则 default user 永远没绑,通讯录永远空)
 */
/**
 * 当前世界观下的 AI 人设列表（带头像 URL）
 *
 * v0.27 改造:
 *   - 「已加」判定走 user.socialProfiles.chat.calendarContacts / storyContacts
 *   - 用 `addedInMode` + `addedInOtherMode` 两个字段标记,而不是直接过滤掉
 *     (用户要求:同 AI 同 mode 已加 → 显示但 disabled;同 AI 异 mode → 仍可加)
 *
 * 世界观解析(strict,按用户要求):
 *   - 默认用户卡的 boundWorldId 没设 → 返回 []
 *   - 都会显示「引导绑世界」的 UI,不偷偷用 active fallback
 */
export async function getWorldAiPersons() {
    const sdk = window.settingsSdk;
    if (!sdk?.aiPersons) return [];

    try {
        const defaultUser = sdk.defaultUserCard?.getDefault?.() || sdk.users.getActive();
        if (!defaultUser) return [];

        // 默认用户卡(没绑世界→按用户要求不拉 AI 人设)
        const defaultBound = defaultUser.boundWorldId || '';
        if (!defaultBound) return [];

        const currentWorld = sdk.worlds?.get(defaultBound);
        if (!currentWorld) return [];

        const allAiPersons = sdk.aiPersons.list?.() || [];
        const currentMode = window.__pendingRecordMode || 'calendar';

        const personsWithAvatars = await Promise.all(allAiPersons.map(async (person) => {
            const chatProfile = person.socialProfiles?.chat || {};
            let avatarUrl = '';
            if (chatProfile.avatarCode) {
                try { avatarUrl = await getImageSrcByCode(chatProfile.avatarCode) || ''; } catch (_) {}
            }
            if (!avatarUrl && chatProfile.avatar) avatarUrl = chatProfile.avatar;

            // ★ v0.27 检查 user 字段下的两个 list
            const addedInMode = sdk.chatFriends?.has?.(defaultUser, person.id, currentMode) || false;
            const otherMode = currentMode === 'calendar' ? 'story' : 'calendar';
            const addedInOtherMode = sdk.chatFriends?.has?.(defaultUser, person.id, otherMode) || false;

            return {
                id: person.id,
                name: chatProfile.nickname || person.name || 'AI',
                avatar: avatarUrl,
                avatarBg: chatProfile.avatarBg || '',
                boundWorldId: person.boundWorldId || '',
                boundWorldName: currentWorld.name || currentWorld.id,
                status: 'online',
                persona: person,
                addedInMode,
                addedInOtherMode,
                otherMode,
            };
        }));

        // 过滤:同 worldview + 排除自己
        return personsWithAvatars.filter((p) => p.boundWorldId === currentWorld.id && p.id !== defaultUser.id);
    } catch (err) {
        console.warn('[chat-app] getWorldAiPersons failed:', err);
        return [];
    }
}

// ★ v0.33 暴露给 new-group-page 调用(避免重复实现 AI 拉取逻辑)
if (typeof window !== 'undefined') {
    window.__chatAppInternal = window.__chatAppInternal || {};
    window.__chatAppInternal.getWorldAiPersons = getWorldAiPersons;
}

/**
 * 渲染联系人项 — 点击后由 chat-app method `pickContactForMode` 弹模式选择,
 *   选定后由 `pickContactAndCreate` 写入 user.socialProfiles.chat[mode] 数组里
 *
 * v0.27 状态:
 *   - addedInMode (同 mode 已加) → 按钮 disabled + "已添加(日历)" 标签
 *   - addedInOtherMode (异 mode 已加) → 仍可点,但显示 "已加(故事)" 提示
 *   - 都没加 → 正常
 */
export function renderContactItem(contact) {
    const avatarBg = contact.avatarBg || getAvatarColor(contact.id);
    const statusDot = contact.status === 'online' ? '<div class="contact-online-dot"></div>' : '';
    const avatarContent = contact.avatar
        ? `<img src="${escapeHtml(contact.avatar)}" alt="" class="contact-avatar-img">`
        : escapeHtml((contact.name || '?').charAt(0));

    // ★ v0.28:只有 calendar+story 两种模式都添加了才禁用
    const currentMode = window.__pendingRecordMode || 'calendar';
    const otherMode = currentMode === 'calendar' ? 'story' : 'calendar';
    const isDisabled = contact.addedInMode && contact.addedInOtherMode;
    const itemClass = `contact-select-item${isDisabled ? ' contact-select-item--disabled' : ''}`;

    // 已添加徽标（只在该模式已添加时显示）
    let badgeHtml = '';
    if (contact.addedInMode) {
        badgeHtml = `<span class="contact-added-badge">已添加(${escapeHtml(currentMode === 'calendar' ? '日历' : '故事')})</span>`;
    } else if (contact.addedInOtherMode) {
        badgeHtml = `<span class="contact-added-badge contact-added-badge--other">已加(${escapeHtml(otherMode === 'story' ? '故事' : '日历')}模式)</span>`;
    }

    // v0.27 data-app-action 走 pickContactForMode:先弹模式选择弹窗,选定后由 chat-app method `pickContactAndCreate` 创建
    //   contactId 字段保留为 aiPersonId,但 payload 里封装完整 snapshot
    const action = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'pickContactForMode',
        payload: {
            aiPersonId: contact.id,
            addedInMode: !!contact.addedInMode,
            addedInOtherMode: !!contact.addedInOtherMode,
            aiPersonSnapshot: {
                id: contact.id,
                name: contact.name,
                avatar: contact.avatar,
                avatarBg: contact.avatarBg,
                boundWorldId: contact.boundWorldId,
            },
        },
    });
    const actionAttr = isDisabled ? '' : `data-app-action='${escapeHtml(action)}'`;

    return `
        <div class="${itemClass}" data-contact-id="${escapeHtml(contact.id)}" ${actionAttr}>
            <div class="contact-avatar" style="background: ${avatarBg};">
                ${avatarContent}
            </div>
            <div class="contact-info">
                <div class="contact-name">${escapeHtml(contact.name)}</div>
                <div class="contact-type">来自「${escapeHtml(contact.boundWorldName || '')}」的 AI</div>
            </div>
            <div class="contact-meta">
                ${badgeHtml}
                ${statusDot}
            </div>
        </div>
    `;
}

/**
 * 异步渲染（真实数据）
 */
export async function renderNewChatPageAsync(app) {
    const aiPersons = await getWorldAiPersons();
    const contacts = aiPersons.length > 0 ? aiPersons : DEMO_CONTACTS;
    const showEmptyState = aiPersons.length === 0;
    const mode = window.__pendingRecordMode || 'calendar';
    const modeLabel = mode === 'story' ? '故事记录模式' : '日历视图模式';

    // ★ 当前世界名 chip
    let chipHtml;
    try {
        const sdk = window.settingsSdk;
        const def = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
        const wid = def?.boundWorldId || '';
        const world = wid ? sdk?.worlds?.get?.(wid) : null;
        const worldName = world?.name || world?.id || '';
        if (worldName) {
            chipHtml = `<div class="new-chat-world-chip" title="当前世界观">${escapeHtml(worldName)}</div>`;
        }
    } catch (_) {}
    if (!chipHtml) {
        chipHtml = `<div class="new-chat-mode-chip new-chat-mode-chip--${escapeHtml(mode)}">${escapeHtml(modeLabel)}</div>`;
    }

    const contactItems = contacts.map(renderContactItem).join('');

    return `
        <div class="new-chat-page">
            <div class="new-chat-header">
                <button class="new-chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                    <svg viewBox="0 0 24 24">
                        <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <div class="new-chat-title">添加新朋友</div>
                ${chipHtml}
            </div>

            <div class="new-chat-content">
                <div class="new-chat-search">
                    <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" id="newChatSearchInput" placeholder="搜索联系人" class="search-input" />
                </div>

                <button type="button" class="new-chat-create-group-btn" id="createGroupBtn"
                    data-app-action='{"action":"appMethod","appId":"chat","method":"openNewGroup"}'>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                    </svg>
                    <span>发起群聊</span>
                </button>

                <div class="contacts-title">${showEmptyState ? '当前世界观暂无 AI 人设可添加' : '可添加的 AI 人设（按当前模式筛选）'}</div>
                <div class="contacts-list" id="newChatContactsList">
                    ${contactItems}
                </div>
            </div>
        </div>
    `;
}

/**
 * 同步兜底(SDK 未就绪时优先用 localStorage 快照渲染,空快照才显示加载中)
 * ★ v0.28 引入 chat-snapshot.js 让 chat-app 冷启动即可秒渲染。
 */
export function renderNewChatPage(app) {
    const mode = window.__pendingRecordMode || 'calendar';
    const modeLabel = mode === 'story' ? '故事记录模式' : '日历视图模式';
    const gotoAction = JSON.stringify({ action: 'openApp', targetAppId: 'settings', pageId: 'user' });

    // ★ 同步读快照:即便 SDK 还没 bootstrap,也能拿到上一会话缓存的 AI 名单
    const snap = loadChatSnapshot();
    const snapAiPersons = Array.isArray(snap?.aiPersons) ? snap.aiPersons : [];
    const snapWorld = snap?.world || null;
    const snapDefaultBound = snap?.defaultUserBoundWorldId || snap?.activeUserBoundWorldId || '';

    let contactsListHtml;
    let contactsTitleText;
    if (snapAiPersons.length > 0 && snapWorld) {
        // 有快照 → 直接渲染快照里的 AI 名单
        contactsTitleText = '可添加的 AI 人设（按当前模式筛选）';
        contactsListHtml = snapAiPersons.map(renderContactItem).join('');
    } else if (snapDefaultBound && snapWorld && snapAiPersons.length === 0) {
        // 有快照世界但没 AI → 显示「该世界下暂无 AI 人设」
        const gotoSettings = JSON.stringify({
            action: 'appMethod', appId: 'chat', method: 'gotoSettingsBindWorld',
        });
        contactsTitleText = '当前默认用户卡未绑定世界观';
        contactsListHtml = `
            <div class="new-chat-empty-state" data-app-action='${escapeHtml(gotoSettings)}' style="cursor: pointer;">
                <div class="new-chat-empty-icon">🌐</div>
                <div class="new-chat-empty-text">「${escapeHtml(snapWorld.name || snapWorld.id)}」下还没有 AI 人设</div>
                <div class="new-chat-empty-hint">
                    前往「设置 → AI 人设」创建新 AI,并将其绑定到「${escapeHtml(snapWorld.name || snapWorld.id)}」。<br/>
                    <span class="new-chat-empty-link">→ 前往设置</span>
                </div>
            </div>
        `;
    } else {
        // 完全没快照 → 才显示加载中
        contactsTitleText = '正在加载…';
        contactsListHtml = `
            <div class="new-chat-loading">
                <div class="new-chat-loading-spinner"></div>
                <div class="new-chat-loading-text">读取世界观数据中</div>
            </div>
        `;
    }

    // ★ 当前世界名 chip(快照里有就用,没有就回退显示 mode)
    const worldName = snapWorld?.name || '';
    let chipHtml;
        if (worldName) {
            chipHtml = `<div class="new-chat-world-chip" title="当前世界观">${escapeHtml(worldName)}</div>`;
    } else {
        chipHtml = `<div class="new-chat-mode-chip new-chat-mode-chip--${escapeHtml(mode)}">${escapeHtml(modeLabel)}</div>`;
    }

    return `
        <div class="new-chat-page">
            <div class="new-chat-header">
                <button class="new-chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                    <svg viewBox="0 0 24 24">
                        <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <div class="new-chat-title">添加新朋友</div>
                ${chipHtml}
            </div>
            <div class="new-chat-content">
                <div class="new-chat-search">
                    <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" id="newChatSearchInput" placeholder="搜索联系人" class="search-input" />
                </div>

                <button type="button" class="new-chat-create-group-btn" id="createGroupBtn"
                    data-app-action='{"action":"appMethod","appId":"chat","method":"openNewGroup"}'>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                    </svg>
                    <span>发起群聊</span>
                </button>

                <div class="contacts-title">${escapeHtml(contactsTitleText)}</div>
                <div class="contacts-list" id="newChatContactsList">
                    ${contactsListHtml}
                </div>
            </div>
        </div>
    `;
}

export default renderNewChatPage;
