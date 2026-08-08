/**
 * Settings App · 人设主页 · 社媒形象配置
 *
 * 用于配置 AI 在各社交软件（murmur/博客/日记）里的形象展示
 * 包括：网名、头像、背景、在线时间段
 *
 * 数据结构：
 * persona.socialProfiles = {
 *   chat: { nickname, avatarCode, backgroundCode, onlineHours: { start: 'HH:mm', end: 'HH:mm' } },
 *   blog: { nickname, avatarCode, backgroundCode },
 *   diary: { nickname, avatarCode, backgroundCode }
 * }
 *
 * 在线状态判断：isOnline(onlineHours) -> boolean
 */

import { escapeHtml } from '@/src/core/escape.js';
import { getGroupImages, getImageSrcByCode } from '../gallery/gallery-db.js';

// ============================================
// 在线状态判断
// ============================================

/**
 * 判断当前时间是否在在线时间段内
 * @param {Object} onlineHours - { start: 'HH:mm', end: 'HH:mm' } 或 null
 * @returns {boolean} true=在线, false=离线
 */
export function isOnline(onlineHours) {
    if (!onlineHours) return true; // 没设置时间默认在线

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const parseTime = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string') return null;
        const [h, m] = timeStr.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    };

    const startMinutes = parseTime(onlineHours.start);
    const endMinutes = parseTime(onlineHours.end);

    // 无效时间默认在线
    if (startMinutes === null || endMinutes === null) return true;

    // 跨天情况（如 22:00 - 06:00）
    if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
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
 * @param {Object} onlineHours
 * @returns {string}
 */
export function formatOnlineHours(onlineHours) {
    if (!onlineHours?.start && !onlineHours?.end) {
        return '24 小时在线';
    }
    const start = onlineHours.start || '00:00';
    const end = onlineHours.end || '23:59';
    return `${start} - ${end}`;
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
// Chat-app 专用：获取联系人在线状态
// ============================================

/**
 * 获取 AI 联系人的在线状态
 * @param {string} contactId - 联系人 ID（如 'ai-1', 'ai-4' 等）
 * @returns {Promise<{isOnline: boolean, profile: Object}>}
 */
export async function getContactOnlineStatus(contactId) {
    const sdk = window.settingsSdk;
    if (!sdk?.aiPersons) {
        return { isOnline: true, profile: {} }; // 默认在线
    }

    // 从 aiPersons 里找匹配的 persona
    // contactId 格式: 'ai-1' -> persona id 可能是 'ai1' 或通过映射找
    const persons = sdk.aiPersons.list?.() || [];

    // 尝试多种匹配方式
    let persona = null;

    // 1. 直接匹配
    persona = persons.find(p => p.id === contactId || p.id === contactId.replace('ai-', 'ai'));

    // 2. 如果没找到，尝试按顺序匹配（ai-1 对应列表第一个，以此类推）
    if (!persona) {
        const match = contactId.match(/^ai-(\d+)$/);
        if (match) {
            const index = parseInt(match[1], 10) - 1;
            if (index >= 0 && index < persons.length) {
                persona = persons[index];
            }
        }
    }

    if (!persona) {
        return { isOnline: true, profile: {} }; // 找不到默认在线
    }

    const profile = persona.socialProfiles?.chat || {};
    return {
        isOnline: isOnline(profile.onlineHours),
        profile,
    };
}

/**
 * 同步版本：获取联系人在线状态（使用缓存）
 * 首次调用会发起异步加载，之后返回缓存值
 */
const _onlineStatusCache = new Map();
const _pendingLoads = new Map();

export function getContactOnlineStatusSync(contactId) {
    if (_onlineStatusCache.has(contactId)) {
        return _onlineStatusCache.get(contactId);
    }

    // 还没加载过，发起异步加载
    if (!_pendingLoads.has(contactId)) {
        const promise = getContactOnlineStatus(contactId).then(result => {
            _onlineStatusCache.set(contactId, result);
            _pendingLoads.delete(contactId);
            // 通知 UI 刷新
            window.dispatchEvent(new CustomEvent('chat:online-status-updated', {
                detail: { contactId, ...result }
            }));
            return result;
        });
        _pendingLoads.set(contactId, promise);
    }

    return { isOnline: true, profile: {} }; // 加载中默认在线
}

/**
 * 清除缓存（当 persona 配置变更时调用）
 */
export function clearOnlineStatusCache() {
    _onlineStatusCache.clear();
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
