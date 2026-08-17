/**
 * Settings App · 人设主页 · 社媒形象配置
 *
 * 用于配置 AI 在各社交软件里的形象展示（网名、头像、背景……）
 *
 * 有哪几个软件不写死在这里 —— 由 App 自己在 appConfig 里声明
 * socialProfile，框架收进 src/core/social-app-registry.js。
 * 每个 App 配哪几样也由它的 fields 决定（signature / patSetting
 * 目前只有 murmur 有消费方）。
 *
 * 数据结构：
 * persona.socialProfiles = {
 *   chat: { nickname, signature, patSetting, avatarCode, backgroundCode },
 *   blog: { nickname, avatarCode, backgroundCode },
 *   youtube: { nickname, avatarCode, backgroundCode },
 * }
 *
 * ★ 已删除:onlineHours 字段。chat-app 不再展示"在线/离线"。
 *   isOnline / formatOnlineHours / getContactOnlineStatus / getContactOnlineStatusSync
 *   仍作为兼容层保留导出(返回 false / 空字符串),但 chat-app 不再调用。
 */

import { getImageSrcByCode } from '../gallery/gallery-db.js';

// ============================================
// 在线状态判断(已废弃 — 保留仅为兼容旧调用)
// ============================================

/**
 * @deprecated chat-app 不再展示在线/离线。保留导出以兼容可能的旧代码,
 *              始终返回 false。
 */
export function isOnline(_onlineHours) {
    return false;
}

// ============================================
// 统一配置存取 API
// ============================================

/**
 * 获取社媒形象配置
 * @param {Object} persona - persona 对象
 * @param {string} appId - 'chat' | 'blog' | 'diary'
 * @returns {Object} 配置对象
 */
export function getSocialProfile(persona, appId = 'chat') {
    const profiles = persona?.socialProfiles || {};
    return profiles[appId] || {};
}

/**
 * 格式化在线时间段显示
 * @deprecated chat-app 不再展示在线时间。保留导出以兼容,返回空字符串。
 */
export function formatOnlineHours(_onlineHours) {
    return '';
}

// ============================================
// 获取头像 URL
// ============================================

/**
 * 获取社媒形象配置的头像 URL
 * 优先从 socialProfiles.chat.avatarCode 解析，回退到 persona.avatar
 */
export async function getSocialAvatarSrc(persona, appId = 'chat') {
    const profile = getSocialProfile(persona, appId);
    const avatarCode = profile.avatarCode || persona?.avatarCode;

    if (avatarCode) {
        try {
            const src = await getImageSrcByCode(avatarCode);
            if (src) return src;
        } catch (_) {}
    }

    return persona?.avatar || '';
}

// ============================================
// Chat-app 专用：获取联系人在线状态(已废弃)
// ============================================

/**
 * @deprecated chat-app 不再展示"在线/离线"。保留为 noop。
 */
export async function getContactOnlineStatus(_contactId) {
    return { isOnline: false, profile: {} };
}

/**
 * @deprecated chat-app 不再展示"在线/离线"。保留为 noop。
 */
export function getContactOnlineStatusSync(_contactId) {
    return { isOnline: false, profile: {} };
}

/**
 * @deprecated 保留为 noop(原缓存逻辑已不需要)。
 */
export function clearOnlineStatusCache() {
    // noop
}

// ============================================
// 挂到 window 供其他 app（如 chat-app）使用
// ============================================

if (typeof window !== 'undefined') {
    window.__socialProfile = {
        isOnline,
        getSocialProfile,
        getSocialAvatarSrc,
        getContactOnlineStatus,
        getContactOnlineStatusSync,
        clearOnlineStatusCache,
    };
}
