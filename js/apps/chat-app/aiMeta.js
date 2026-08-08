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

/**
 * 从 SDK 实时读 aiPerson 的社媒 display 信息。
 *
 * @param {string} aiPersonId - AI 人设 id
 * @returns {{
 *   exists: boolean,
 *   nickname: string,
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
        avatar: '',
        avatarBg: '#A8C8EC',
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
        const avatar = chatProfile.avatar || person.avatar || '';
        const avatarBg = chatProfile.avatarBg || person.avatarBg || '#A8C8EC';
        const background = chatProfile.background || person.background || '';
        const patSetting = chatProfile.patSetting || '';

        return {
            exists: true,
            nickname,
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
 * 把 avatar meta 渲染成一个圆形头像 DOM 字符串。
 *   - 有 avatar URL: <img src=.../>
 *   - 无 avatar URL: <span class="initial">首字母</span>
 *   - 落在容器背景从 avatarBg 走,color 由调用方传入的 extraClass 决定
 *
 * @param {Object} display - resolveContactDisplay 返回
 * @param {string} extraClass - 头像容器额外的 class(比如 'chat-header-avatar')
 * @returns {string} HTML 字符串
 */
export function renderAvatarHtml(display, extraClass = '') {
    const bg = display.avatarBg || '#A8C8EC';
    const classAttr = extraClass ? ` class="${extraClass}"` : '';
    if (display.avatar) {
        // 转义 src,XSS 防护
        const safeSrc = String(display.avatar)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return `<div${classAttr} style="background: ${bg};"><img src="${safeSrc}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"></div>`;
    }
    return `<div${classAttr} style="background: ${bg};">${(display.initial || '?').toString().replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</div>`;
}
