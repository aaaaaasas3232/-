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
 * - 设置组(拍一拍/群聊记忆互通/灵动岛)
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

/**
 * ★ v0.87 群聊记忆互通:读取真实状态(优先 SDK,空时 fallback 默认文案)
 *   - 走 sdk.groupMemorySync.getGlobalConfig(userId)
 *   - enabled=false → 「已关闭」
 *   - enabled=true + aiIds 空 → 「已开启 · 暂未选 AI」
 *   - enabled=true + aiIds N 个 → 「已开启 · N 个 AI」
 *   - SDK 不存在 → '已关闭'(demo 兜底)
 */
function _resolveMemorySyncLabel(sdk, userId) {
    try {
        if (!sdk?.groupMemorySync || !userId) return '已关闭';
        const cfg = sdk.groupMemorySync.getGlobalConfig(userId) || { enabled: false, aiIds: [] };
        if (!cfg.enabled) return '已关闭';
        const n = Array.isArray(cfg.aiIds) ? cfg.aiIds.length : 0;
        if (n === 0) return '已开启 · 暂未选 AI';
        return `已开启 · ${n} 个 AI`;
    } catch (_) {
        return '已关闭';
    }
}

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

const ICON_STAR = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg>`;

const ICON_WALLET = `<svg viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="white"/></svg>`;

const ICON_PAT = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>`;

const ICON_MESSAGE = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" fill="white"/></svg>`;

const ICON_HISTORY = `<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" fill="white"/></svg>`;

const ICON_GROUP = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M7 14c3.22-2.91 4.29-8.75 5-12 1.66 2.38 4.94 9 5 12"/><path d="M22 9c-4.29 0-7.14-2.33-10-7 5.71 0 10 4.67 10 7Z"/></svg>`;

const ICON_ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`;

const ICON_ISLAND = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="8" cy="12" r="1.4" fill="white" stroke="none"/></svg>`;

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
    // ★ 派发 action:framework 顶层 click 委托会自动扫 [data-app-action]
    //   - 所有 chat 内的 detail page(action=detail + appId='chat')渲染在 chat app 的 detail 容器,
    //     返回按钮自动 closeDetailPage → 回到 chat 当前 root page(profile / messages / ...),
    //     不会跨 app 切换。避免出现「钱包流水返回到 settings main」这种跳出感。
    let actionAttr = '';
    if (id === 'favorites') {
        // 收藏详情页在 chat-app 内
        actionAttr = ` data-app-action='{"action":"detail","appId":"chat","pageId":"favorites"}'`;
    } else if (id === 'wallet') {
        // ★ v0.67.x 钱包流水:渲染在 chat app 自己的 detail 容器里(复用 settings 的
        //   renderTransactionHistory)。chat-app 的 renderDetailPage 加 'transaction-history' 分支。
        //   返回 = 退出 chat detail,直接回 chat profile,不会跳 settings。
        actionAttr = ` data-app-action='{"action":"detail","appId":"chat","pageId":"transaction-history"}'`;
    } else if (id === 'group-memory-sync') {
        // ★ v0.87 群聊记忆互通设置详情页
        actionAttr = ` data-app-action='{"action":"detail","appId":"chat","pageId":"group-memory-sync"}'`;
    } else if (id === 'presence-center') {
        // ★ v0.87 「灵动岛与小组件」走 framework 的全局委托，不占 chat 的 detail 路由
        actionAttr = ` data-presence-center="chat"`;
    }
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

    // ★ v0.87 群聊记忆互通:从 SDK 读真实状态(sdk 不存在/未就绪 → fallback 文案)
    //   profile 页是 sync 渲染,SDK 可能还没 hydrate → 即使读不到也展示默认「已关闭」,
    //   detail 详情页打开时再 async 读真实数据。
    const memorySyncLabel = (() => {
        try {
            const sdk = window.settingsSdk;
            const userId = sdk?.defaultUserCard?.getDefault?.()?.id
                || sdk?.users?.getActive?.()?.id
                || user.userId
                || '';
            return _resolveMemorySyncLabel(sdk, userId);
        } catch (_) {
            return '已关闭';
        }
    })();

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
                ${renderMenuItem(ICON_GROUP, '群聊记忆互通', memorySyncLabel, memorySyncLabel.includes('已开启') ? 'green' : 'gray', 'group-memory-sync')}
            </div>

            <!-- 设置 -->
            <div class="profile-group-card">
                ${renderMenuItem(ICON_ISLAND, '灵动岛与小组件', '', 'gray', 'presence-center')}
            </div>

        </div>
    `;
}

export default renderProfilePage;
