/**
 * chat-app / 通讯录页面
 *
 * 来源:旧版 ChatApp.prototype.renderContactsPage + renderContactItem
 * 样式:蓝粉渐变背景 + 韩风卡片设计
 *
 * 样式规范:
 *   - 所有样式写到 css/apps/chat/_chat-contacts.css
 *   - JS 只放动态数据属性(data-*)和无法预知的动态颜色
 *   - 不允许 style="" 内联非颜色类的样式
 */

import { escapeHtml } from '@/src/core/escape.js';
import { getChatRecordMode } from '../chat-mode.js';
import { ensureSdkReadyThenRefresh } from './messages-page.js';

// 默认联系人数据(只在 SDK 完全空时兜底)
const DEMO_CONTACTS = [
    {
        id: 'demo-main-1',
        type: 'main',
        name: '示例角色',
        remark: '示例',
        personality: '用于演示的占位角色 — 添加新朋友后会看到真实 AI 卡',
        avatar: null,
        status: 'online',
    },
];

// 好友申请数据(演示用)
const DEMO_PENDING_REQUESTS = [
    {
        id: 'req-1',
        aiId: 'ai-pending-1',
        aiName: '小明',
        aiAvatar: null,
        message: '想和你成为好友~',
        timestamp: Date.now() - 86400000,
    },
];

function getAvatarColor(id) {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F8B500', '#6C5CE7', '#A29BFE'];
    let index = 0;
    for (let i = 0; i < id.length; i++) {
        index += id.charCodeAt(i);
    }
    return colors[index % colors.length];
}

function renderCategoryLabel(type) {
    const configs = {
        main: {
            label: '主角色',
            icon: '<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="white"/></svg>',
            bgClass: 'category-icon--main',
        },
        supporting: {
            label: '配角',
            icon: '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="white"/></svg>',
            bgClass: 'category-icon--supporting',
        },
        npc: {
            label: 'NPC',
            icon: '<span class="category-icon-emoji">&#x1F3AD;</span>',
            bgClass: 'category-icon--npc',
        },
    };
    const cfg = configs[type] || configs.npc;
    return `
        <div class="contacts-category-label">
            <span class="contacts-category-icon ${cfg.bgClass}">
                ${cfg.icon}
            </span>
            <span>${cfg.label}</span>
        </div>
    `;
}

function renderContactItem(contact, index) {
    const bgColor = getAvatarColor(contact.id);
    const avatarContent = contact.avatar
        ? `<img src="${escapeHtml(contact.avatar)}" alt="" class="contact-avatar-img">`
        : escapeHtml((contact.name || '?').charAt(0));
    // ★ v0.27 contact-item 点击进入私聊副本
    //   pageId = private-<aiPersonId>-<mode>,因为同 AI 可能在日历+故事下各有副本
    const detailAction = `data-app-action='${escapeHtml(JSON.stringify({
        action: 'detail',
        appId: 'chat',
        pageId: `private-${contact.aiPersonId || contact.id}-${contact.recordMode || 'calendar'}`,
    }))}'`;
    return `
        <div class="contact-item" data-ai-id="${escapeHtml(contact.id)}" ${detailAction}>
            <div class="contact-avatar" data-color="${bgColor}">
                ${avatarContent}
            </div>
            <div class="contact-info">
                <div class="contact-name">
                    ${escapeHtml(contact.name)}
                    ${contact.remark ? `<span class="contact-remark">(${escapeHtml(contact.remark)})</span>` : ''}
                </div>
                <div class="contact-signature">${escapeHtml((contact.personality || '暂无个性签名').substring(0, 25))}</div>
            </div>
            <div class="contact-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m9 18 6-6-6-6"/>
                </svg>
            </div>
        </div>
    `;
}

function renderFriendRequestEntry(requests) {
    if (!requests || requests.length === 0) return '';

    const count = requests.length;
    const firstReq = requests[0];
    const desc = count === 1
        ? `${escapeHtml(firstReq.aiName)}请求恢复聊天`
        : `${escapeHtml(firstReq.aiName)}等${count}人请求恢复聊天`;

    return `
        <div class="friend-request-entry">
            <div class="friend-request-avatar-stack">
                ${requests.slice(0, 3).map((req) => {
                    const color = getAvatarColor(req.aiId || req.id);
                    return `
                        <div class="friend-request-avatar">
                            ${req.aiAvatar
                                ? `<img src="${escapeHtml(req.aiAvatar)}" alt="" />`
                                : `<div class="friend-request-avatar-inner" data-color="${color}">${escapeHtml(req.aiName.charAt(0))}</div>`
                            }
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="friend-request-info">
                <div class="friend-request-title">好友申请</div>
                <div class="friend-request-desc">${desc}</div>
            </div>
            <div class="friend-request-action">
                <div class="friend-request-badge">${count}</div>
                <svg class="friend-request-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m9 18 6-6-6-6"/>
                </svg>
            </div>
        </div>
    `;
}

function renderEmptyState() {
    return `
        <div class="contacts-empty">
            <div class="contacts-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
            </div>
            <div class="contacts-empty-title">暂无联系人</div>
            <div class="contacts-empty-sub">在系统配置中添加AI角色</div>
        </div>
    `;
}

/**
 * v0.27 从当前默认 user 人设的 socialProfiles.chat.calendarContacts / storyContacts
 * 读取当前 mode 下的所有联系人 entry（不走 chatContacts 那张表）。
 */
function loadContactsForMode(mode) {
    const sdk = window.settingsSdk;
    const out = { contacts: [], isEmptyWorld: false, isEmptySdk: false };

    if (!sdk) {
        out.isEmptySdk = true;
        return out;
    }

    const defaultUser = sdk.defaultUserCard?.getDefault?.();
    const currentUser = defaultUser || sdk.users.getActive();
    if (!currentUser?.boundWorldId) {
        out.isEmptyWorld = true;
        return out;
    }

    const list = (typeof sdk.chatFriends?.list === 'function')
        ? sdk.chatFriends.list(currentUser, mode)
        : [];

    out.contacts = list.map((c) => ({
        id: c.aiPersonId,                // ★ v0.27:pageId 用 aiPersonId 而非副本 id
        aiPersonId: c.aiPersonId,
        recordMode: mode,
        type: 'main',
        name: c.displayName || c.aiPersonId,
        remark: c.recordMode === 'story' ? '故事模式' : '',
        personality: '',
        avatar: c.avatar || '',
        avatarBg: c.avatarBg || '',
        status: 'online',
    }));

    if (out.contacts.length === 0) out.contacts = DEMO_CONTACTS;
    return out;
}

export function renderContactsPage(app) {
    const mode = getChatRecordMode();
    const { contacts, isEmptyWorld, isEmptySdk } = loadContactsForMode(mode);

    if (isEmptySdk) ensureSdkReadyThenRefresh(app);

    let bodyHtml;
    if (isEmptySdk) {
        // ★ v0.23 SDK 还没 bootstrap,显示通用空状态 + 等 ready 后自动重画
        bodyHtml = renderEmptyState();
    } else if (isEmptyWorld) {
        bodyHtml = `
            <div class="contacts-empty">
                <div class="contacts-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="16"/>
                    </svg>
                </div>
                <div class="contacts-empty-title">默认用户卡未绑定世界观</div>
                <div class="contacts-empty-sub">请先去「设置 → 人设」给默认用户卡绑定世界观，通讯录才会显示可添加的 AI 人设</div>
            </div>
        `;
    } else {
        bodyHtml = renderCategoryLabel('main') +
            contacts.map((c) => renderContactItem(c)).join('');
    }

    return `
        <div class="chat-contacts" data-chat-mode="${escapeHtml(mode)}">
            <div class="contacts-container">
                ${bodyHtml}
            </div>
        </div>
    `;
}

export default renderContactsPage;
