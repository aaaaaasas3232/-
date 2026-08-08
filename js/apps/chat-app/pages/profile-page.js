/**
 * chat-app / 个人页面 (我)
 *
 * Phase 11 — UI 复原
 *
 * 旧版:ChatApp.prototype.renderProfilePage
 * 风格:韩风蓝粉渐变背景 + 毛玻璃卡片
 *
 * 结构:
 * - 个人信息卡片(头像+名字+ID)
 * - 功能列表(收藏/钱包)
 * - 设置组(拍一拍/消息模式/聊天记录管理/群聊记忆互通/设置)
 *
 * 样式规范:
 *   - 所有样式写到 css/apps/chat/_chat-profile.css
 *   - JS 只放动态数据属性(data-*)和无法预知的动态颜色
 *   - 不允许 style="" 内联非颜色类的样式
 */

import { escapeHtml } from '@/src/core/escape.js';
import { getImageSrcByCode } from '../../setting/gallery/gallery-db.js';

// ─── 演示数据（兜底用）────────────────────────────────────

const DEMO_USER = {
    name: '小听用户',
    avatar: '',
    userId: 'user_a1b2c3d4',
    balance: 128.50,
    patSetting: '拍了拍我',
    messageMode: '即时回复',
    chatRecordMode: '时间日期',
    memorySync: '已关闭',
};

// ─── 当前用户数据获取 ─────────────────────────────────────

/**
 * 获取当前用户（人设）的社媒配置数据
 * @returns {Promise<{name, avatar, avatarCode, background, backgroundCode, userId, balance}>}
 */
export async function getCurrentChatUser() {
    const sdk = window.settingsSdk;

    // 如果 SDK 未就绪，等待它就绪
    if (!sdk?.users) {
        await _waitForSdk();
    }

    const sdk2 = window.settingsSdk;
    if (!sdk2?.users) {
        return DEMO_USER;
    }

    try {
        // 获取当前活跃用户
        const currentUser = sdk2.users.getActive();
        if (!currentUser) {
            return DEMO_USER;
        }

        // 获取社媒配置中的 chat 配置
        const chatProfile = currentUser.socialProfiles?.chat || {};

        // 获取头像 URL
        let avatarUrl = '';
        if (chatProfile.avatarCode) {
            try {
                avatarUrl = await getImageSrcByCode(chatProfile.avatarCode) || '';
            } catch (_) {}
        }
        if (!avatarUrl && chatProfile.avatar) {
            avatarUrl = chatProfile.avatar;
        }

        // 获取背景 URL
        let backgroundUrl = '';
        if (chatProfile.backgroundCode) {
            try {
                backgroundUrl = await getImageSrcByCode(chatProfile.backgroundCode) || '';
            } catch (_) {}
        }
        if (!backgroundUrl && chatProfile.background) {
            backgroundUrl = chatProfile.background;
        }

        // 获取余额（从资产系统）
        let balance = 0;
        if (typeof sdk2.persona?.asset?.snapshot === 'function') {
            const assetSnap = sdk2.persona.asset.snapshot('user', currentUser.id);
            if (assetSnap) {
                balance = assetSnap.balance || 0;
            }
        }

        return {
            name: chatProfile.nickname || currentUser.name || '未设置身份',
            avatar: avatarUrl,
            avatarCode: chatProfile.avatarCode || '',
            background: backgroundUrl,
            backgroundCode: chatProfile.backgroundCode || '',
            userId: currentUser.id || 'user_unknown',
            balance,
            patSetting: chatProfile.patSetting || '拍了拍我',
            messageMode: currentUser.messageMode || '即时回复',
            chatRecordMode: currentUser.chatRecordMode || '时间日期',
            memorySync: currentUser.memorySync || '已关闭',
            // 原始 persona 供其他地方使用
            _persona: currentUser,
        };
    } catch (err) {
        console.warn('[chat-app] getCurrentChatUser failed:', err);
        return DEMO_USER;
    }
}

/** 等待 settings-sdk 就绪(v0.28:走顶层预热入口,自动 fire-and-forget) */
function _waitForSdk() {
    if (typeof window.whenSettingsSdkReady === 'function') {
        return window.whenSettingsSdkReady(2000);
    }
    return new Promise((resolve) => {
        if (window.settingsSdk?.users) {
            resolve();
            return;
        }
        const handler = () => {
            window.removeEventListener('settings-sdk-ready', handler);
            resolve();
        };
        window.addEventListener('settings-sdk-ready', handler);
    });
}

/**
 * 同步版本：返回缓存的当前用户数据（首次调用返回 null，之后返回缓存）
 */
let _cachedUser = null;
let _userPromise = null;

export function getCurrentChatUserSync() {
    if (_cachedUser) return _cachedUser;
    if (!_userPromise) {
        _userPromise = getCurrentChatUser().then(user => {
            _cachedUser = user;
            return user;
        }).catch(err => {
            console.warn('[chat-app] getCurrentChatUserSync failed:', err);
            _cachedUser = DEMO_USER;
            return DEMO_USER;
        });
    }
    return null; // 表示还在加载中
}

/**
 * 清除用户缓存（当用户切换时调用）
 */
export function clearUserCache() {
    _cachedUser = null;
    _userPromise = null;
}

// ─── 图标 SVG ─────────────────────────────────────────────

const ICON_STAR = `<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="white"/></svg>`;

const ICON_WALLET = `<svg viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="white"/></svg>`;

const ICON_PAT = `<svg viewBox="0 0 24 24"><path d="M7 11.5V14h1v-2.5c0-.55.45-1 1-1s1 .45 1 1V14h1v-2.5c0-.55.45-1 1-1s1 .45 1 1V14h1v-2.5c0-.83-.67-1.5-1.5-1.5-.43 0-.81.18-1.09.47-.27-.47-.79-.79-1.39-.79-.32 0-.62.1-.87.26-.28-.46-.79-.78-1.37-.78-1.1 0-2 .9-2 2H5c-.55 0-1 .45-1 1v4c0 2.21 1.79 4 4 4h5c2.21 0 4-1.79 4-4v-2.5c0-1.93-1.57-3.5-3.5-3.5-.43 0-.84.09-1.22.24-.28-.83-1.04-1.43-1.94-1.5V5c0-1.1-.9-2-2-2s-2 .9-2 2v6.5z" fill="white"/></svg>`;

const ICON_MESSAGE = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" fill="white"/></svg>`;

const ICON_HISTORY = `<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" fill="white"/></svg>`;

const ICON_GROUP = `<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="white"/></svg>`;

const ICON_SETTINGS = `<svg viewBox="0 0 24 24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" fill="white"/></svg>`;

const ICON_ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`;

const ICON_USER_AVATAR = `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="#ADB5BD"/><path d="M4 20v-2c0-2.21 3.58-4 8-4s8 1.79 8 4v2" fill="#ADB5BD"/></svg>`;

// ─── 头像渲染 ─────────────────────────────────────────────

function renderProfileAvatar(user) {
    if (user.avatar) {
        return `<img src="${escapeHtml(user.avatar)}" class="profile-avatar-img" alt="">`;
    }
    return `<div class="profile-avatar-placeholder">${ICON_USER_AVATAR}</div>`;
}

// ─── 菜单项 ───────────────────────────────────────────────

function renderMenuItem(icon, label, sub, subClass = 'gray', id = '') {
    const idAttr = id ? ` data-menu-id="${escapeHtml(id)}"` : '';
    const actionAttr = id === 'favorites'
        ? ` data-app-action='{"action":"detail","appId":"chat","pageId":"favorites"}'`
        : '';
    return `
        <div class="profile-menu-item"${idAttr}${actionAttr}>
            <div class="profile-menu-icon">${icon}</div>
            <span class="profile-menu-label">${escapeHtml(label)}</span>
            ${sub ? `<span class="profile-menu-sub ${subClass}">${escapeHtml(sub)}</span>` : ''}
            <div class="card-arrow">${ICON_ARROW}</div>
        </div>
    `;
}

// ─── 主渲染函数 ───────────────────────────────────────────

/**
 * 渲染个人页面 (我)
 *
 * 旧版:ChatApp.prototype.renderProfilePage
 * 本版:纯 UI 复原,数据来源 DEMO_USER(后续 Phase 接 IndexedDB)
 *
 * @param {Object} app
 * @param {Object} user  用户数据(默认演示数据)
 */
export function renderProfilePage(app, user = DEMO_USER) {
    const safeName = escapeHtml(user.name || '未设置身份');
    const safeId = escapeHtml(user.userId || '');
    const safeBalance = typeof user.balance === 'number' ? user.balance.toFixed(2) : '0.00';

    return `
        <div class="profile-page">

            <!-- 个人信息卡片 -->
            <div class="profile-info-card">
                <div class="profile-avatar-wrap">
                    <div class="profile-avatar-inner">
                        ${renderProfileAvatar(user)}
                    </div>
                </div>
                <div class="profile-user-info">
                    <div class="profile-user-name">${safeName}</div>
                    <div class="profile-user-id">ID: ${safeId}</div>
                </div>
                <div class="card-arrow">${ICON_ARROW}</div>
            </div>

            <!-- 功能列表 -->
            <div class="profile-group-card">
                ${renderMenuItem(ICON_STAR, '收藏', '', 'gray', 'favorites')}
                ${renderMenuItem(ICON_WALLET, '钱包', '¥' + safeBalance, 'green', 'wallet')}
            </div>

            <!-- 设置组 -->
            <div class="profile-group-card">
                ${renderMenuItem(ICON_PAT, '拍一拍', user.patSetting || '未设置', 'purple', 'pat-setting')}
                ${renderMenuItem(ICON_MESSAGE, '消息模式', user.messageMode || '即时回复', 'pink', 'message-mode')}
                ${renderMenuItem(ICON_HISTORY, '聊天记录管理', user.chatRecordMode || '时间日期', 'blue', 'chat-record-mode')}
                ${renderMenuItem(ICON_GROUP, '群聊记忆互通', user.memorySync || '已关闭', 'gray', 'group-memory-sync')}
            </div>

            <!-- 设置 -->
            <div class="profile-group-card">
                ${renderMenuItem(ICON_SETTINGS, '设置', '', 'gray', 'app-settings')}
            </div>

        </div>
    `;
}

export default renderProfilePage;
