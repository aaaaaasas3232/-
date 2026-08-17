/**
 * chat-app · AI 人设信息实时读取工具（v0.31 2026-08-06）
 *
 * 业务背景:
 *   旧实现里,chat-app 拿 AI 的名字/头像/背景优先用 chatContacts entry 快照里的
 *   `displayName` / `avatar` / `avatarBg`。但这些字段是「添加时快照」,改社媒配置后
 *   已添加的联系人副本不会同步刷新。
 *
 *   用户要求统一语义:
 *     - AI 的「网名 / 头像 / 背景」在日历模式和故事模式下都一样,来自
 *       aiPerson.socialProfiles.chat.* 实时读取,不再走 entry 快照。
 *     - 备注(remark)仍然是 per-mode 字段,优先于社媒名(已在 chat-settings-page.js
 *       实现)。
 *     - 拍一拍后缀(patSetting)来自 aiPerson.socialProfiles.chat.patSetting,
 *       模式无关。
 *
 * 设计:
 *   - 单文件模块,所有读法统一走这一处
 *   - 不依赖 this,framework 调 renderPage 时可用
 *   - 缓存:同一会话内同一 AI 不会再读多次(sdk.aiPersons.get 是同步,缓存冗余但
 *     让第三方 caller 不用关心 SDK 形态)
 *   - 失败兜底:返回空字符串 / '#A8C8EC'(跟旧版一致)
 *
 * 用法:
 *   import { getAiMeta } from '../aiMeta.js';
 *   const meta = getAiMeta(aiPersonId);
 *   // meta = { nickname, avatar, avatarBg, background, patSetting, initial, exists }
 */

import { getImageSrcByCode } from '../setting/gallery/gallery-db.js';

/**
 * 从 SDK 实时读 aiPerson 的社媒 display 信息。
 *
 * @param {string} aiPersonId - AI 人设 id
 * @returns {{
 *   exists: boolean,
 *   nickname: string,
 *   signature: string,
 *   avatar: string,
 *   avatarBg: string,
 *   background: string,
 *   patSetting: string,
 *   initial: string,
 * }}
 */
export function getAiMeta(aiPersonId) {
    const fallback = {
        exists: false,
        nickname: '',
        signature: '',
        avatar: '',
        avatarBg: DEFAULT_AI_AVATAR_BG,
        background: '',
        patSetting: '',
        initial: '?',
    };
    if (!aiPersonId) return fallback;

    try {
        const sdk = window.settingsSdk;
        const person = sdk?.aiPersons?.get?.(aiPersonId);
        if (!person) return fallback;

        const chatProfile = person.socialProfiles?.chat || {};
        const nickname = chatProfile.nickname || person.name || aiPersonId;
        // ★ v0.71 头像 url 走"直 url > avatarCode 缓存 > 空"三层
        const avatar = chatProfile.avatar || person.avatar || '';
        const avatarBg = chatProfile.avatarBg || person.avatarBg || DEFAULT_AI_AVATAR_BG;
        const background = chatProfile.background || person.background || '';
        const patSetting = chatProfile.patSetting || '';
        const signature = chatProfile.signature || '';

        return {
            exists: true,
            nickname,
            signature,
            avatar,
            avatarBg,
            background,
            patSetting,
            initial: (nickname || '?').charAt(0),
        };
    } catch (err) {
        console.warn('[chat-app] getAiMeta failed:', err);
        return fallback;
    }
}

// ★ v0.71 avatarCode → data url 缓存(避免重复 IO)
const _avatarCodeCache = new Map();
async function _resolveAvatarCodeUrl(code) {
    if (!code) return '';
    if (_avatarCodeCache.has(code)) return _avatarCodeCache.get(code);
    try {
        const url = (await getImageSrcByCode(code)) || '';
        _avatarCodeCache.set(code, url);
        return url;
    } catch (_) {
        return '';
    }
}

/**
 * ★ v0.71 异步版 resolveAiAvatar — 支持 avatarCode 图床代码解析
 *   new-chat-page 等需要异步构造列表的页面用这个
 *   其他同步渲染(messages / contacts / header)继续用同步版
 */
export async function resolveAiAvatarAsync(aiPersonId) {
    const sync = resolveAiAvatar(aiPersonId);
    // 即使 sync.url 已有,也尝试覆盖 bg(用户可能改过 avatarBg 但没改 url)
    try {
        const sdk = window.settingsSdk;
        const person = sdk?.aiPersons?.get?.(aiPersonId);
        if (person) {
            const chatProfile = person.socialProfiles?.chat || {};
            if (chatProfile.avatarBg) sync.bg = chatProfile.avatarBg;
            if (chatProfile.avatar && !sync.url) sync.url = chatProfile.avatar;
            const code = chatProfile.avatarCode || '';
            if (!sync.url && code) {
                const url = await _resolveAvatarCodeUrl(code);
                if (url) sync.url = url;
            }
        }
    } catch (_) {}
    return sync;
}

/**
 * 给联系人副本 + AI id 合并「显示所需的信息」:
 *   - 名字: entry.remark > aiMeta.nickname > entry.displayName > aiPersonId
 *   - 头像: aiMeta.avatar(社媒头像优先,无需回退 entry 快照)
 *   - 头像背景: aiMeta.avatarBg
 *   - 拍一拍: aiMeta.patSetting
 *
 * 注意: 头像 / 头像背景 / 拍一拍 三个字段不用 entry 快照,统一走实时 aiPerson。
 *       名字走"备注 > 社媒名 > 人设名 > 副本快照"优先级。
 *
 * @param {Object} entry - chatContacts entry(可空)
 * @param {string} aiPersonId
 * @returns {Object} 统一 display 字段
 */
export function resolveContactDisplay(entry, aiPersonId) {
    const meta = getAiMeta(aiPersonId);
    const remark = entry?.remark || '';
    const fallbackName = entry?.displayName || aiPersonId || '未知联系人';
    const nickname = remark || meta.nickname || fallbackName;
    return {
        exists: meta.exists,
        nickname,
        signature: meta.signature,
        avatar: meta.avatar,
        avatarBg: meta.avatarBg,
        background: meta.background,
        patSetting: meta.patSetting,
        initial: (nickname || '?').charAt(0),
        // 透传部分字段给页面用
        boundWorldId: entry?.boundWorldId || '',
        recordMode: entry?.recordMode || '',
        chatBackground: entry?.chatBackground || '', // 聊天背景仍然是 per-mode
        isPinned: !!entry?.isPinned,
    };
}

/**
 * chat-app · AI 头像本地默认背景色。
 *   - 没有社媒头像背景 → 用这个
 *   - 历史 demo 数据兜底 → 用这个
 *   - 散落在各 page 的 '或 '#A8C8EC' 硬编码 → 全部改用这个常量
 */
export const DEFAULT_AI_AVATAR_BG = '#A8C8EC';

/**
 * chat-app · 用户头像本地默认背景色。
 *   - 没有社媒头像背景 → 用这个
 *   - 散落在各 page 的 '或 '#F4A6CD' 硬编码 → 全部改用这个常量
 */
export const DEFAULT_USER_AVATAR_BG = '#F4A6CD';

/**
 * chat-app · 头像相关变量统一从这里取。
 *
 * 业务背景: 之前 chat-app 各 page 各自为政:
 *   - 散落 12+ 份 getAvatarColor(id) 哈希函数
 *   - 散落 15+ 处 '#A8C8EC' / '#F4A6CD' 硬编码
 *   - 朋友圈/收藏/详情页传的 aiProfile/userProfile 字段名各不一样
 *
 * 设计原则:
 *   - AI 头像数据集中 → resolveAiAvatar(aiPersonId)
 *   - 用户头像数据集中 → resolveUserAvatar()
 *   - 任何 page 想拿"AI 头像 → {url, bg, text}"一律走 resolveAiAvatar
 *   - 任何 page 想拿"用户头像 → {url, bg, text}"一律走 resolveUserAvatar
 *   - 不要在 page 内再读 activeUser.socialProfiles.chat.*
 *
 * 返回类型统一:
 *   {
 *     url: string,   // 头像 URL,空 = 走首字母 fallback
 *     bg:  string,   // 头像背景色,必定有值(默认色兜底)
 *     text: string,  // 没有 url 时显示的首字母或「我」
 *   }
 *
 * @param {string} aiPersonId
 * @returns {{ url: string, bg: string, text: string }}
 */
export function resolveAiAvatar(aiPersonId) {
    const meta = getAiMeta(aiPersonId);
    const fallbackName = meta.nickname || meta.initial || aiPersonId || '?';
    return {
        url: meta.avatar || '',
        bg: meta.avatarBg || DEFAULT_AI_AVATAR_BG,
        text: fallbackName.charAt(0) || '?',
    };
}

/**
 * 用户头像统一入口。
 *  - 从 sdk.defaultUserCard.getDefault() / sdk.users.getActive() 拿当前用户
 *  - 读 socialProfiles.chat.{avatar,avatarBg} 实时
 *  - 缺失就 fallback DEFAULT_USER_AVATAR_BG
 *  - 用户文本固定「我」(v0.45 之前是 placeholder,现在统一)
 *
 * @returns {{ url: string, bg: string, text: string }}
 */
export function resolveUserAvatar() {
    try {
        const sdk = window.settingsSdk;
        const user = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
        if (!user) {
            return { url: '', bg: DEFAULT_USER_AVATAR_BG, text: '我' };
        }
        const chatProfile = user.socialProfiles?.chat || {};
        return {
            url: chatProfile.avatar || user.avatar || '',
            bg: chatProfile.avatarBg || user.avatarBg || DEFAULT_USER_AVATAR_BG,
            text: '我',
        };
    } catch (_) {
        return { url: '', bg: DEFAULT_USER_AVATAR_BG, text: '我' };
    }
}

/**
 * 把 resolveAiAvatar / resolveUserAvatar 返回的 avatar meta 渲染成一个圆形头像 DOM 字符串。
 *   - 有 url: <img src=.../>
 *   - 无 url: <span class="initial">首字符</span>
 *   - 容器背景从 bg 走,class 由调用方传入的 extraClass 决定
 *
 * @param {{ url: string, bg: string, text: string }} avatar
 * @param {string} extraClass - 头像容器额外的 class(比如 'chat-header-avatar')
 * @returns {string} HTML 字符串
 */
export function renderAvatarHtml(avatar, extraClass = '') {
    const classAttr = extraClass ? ` class="${extraClass}"` : '';
    if (avatar.url) {
        const safeSrc = String(avatar.url)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return `<div${classAttr} style="background: ${avatar.bg};"><img src="${safeSrc}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"></div>`;
    }
    const safeText = String(avatar.text || '?').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
    return `<div${classAttr} style="background: ${avatar.bg};">${safeText}</div>`;
}

/**
 * 把 avatar meta 渲染成一个圆形头像 DOM 字符串。
 *   - 有 avatar URL: <img src=.../>
 *   - 无 avatar URL: <span class="initial">首字母</span>
 *   - 落在容器背景从 avatarBg 走,color 由调用方传入的 extraClass 决定
 *
 * @param {Object} display - resolveContactDisplay 返回
 * @param {string} extraClass - 头像容器额外的 class(比如 'chat-header-avatar')
 * @returns {string} HTML 字符串
 */
export function renderAvatarHtmlLegacy(display, extraClass = '') {
    const bg = display.avatarBg || DEFAULT_AI_AVATAR_BG;
    const avatar = {
        url: display.avatar || '',
        bg,
        text: display.initial || '?',
    };
    return renderAvatarHtml(avatar, extraClass);
}
