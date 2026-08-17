/**
 * chat-sender-profile.js
 *
 * ★ v0.70 抽取自 chat-app/index.js
 *   原来在 initPrivateChatInteractions / initGroupChatInteractions 里
 *   各自内联了一段 "从 sdk 拿 defaultUser + 算 senderName + 拿 userAvatar"
 *   重复 5+ 次,这里集中成工具函数。
 *
 * ★ v0.71 重构: 头像数据全权交给 aiMeta.resolveUserAvatar()
 *   本文件只保留 sender / senderName 业务字段,
 *   不再直接读 socialProfiles.chat.*(避免和 aiMeta 数据源分裂)
 *
 * 用法:
 *   import { resolveSenderProfile } from '../components/chat-sender-profile.js';
 *   const profile = resolveSenderProfile(); // { sender, senderName, userAvatar, userAvatarBg }
 */

import { resolveUserAvatar } from '../aiMeta.js';

/**
 * 解析当前默认用户卡的发送者资料
 * @returns {{ sender: object|null, senderName: string, userAvatar: string, userAvatarBg: string }}
 */
export function resolveSenderProfile() {
    const sdk = window.settingsSdk;
    const sender = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.() || null;
    if (!sender) {
        return { sender: null, senderName: '我', userAvatar: '', userAvatarBg: '' };
    }
    const chatProfile = sender.socialProfiles?.chat || {};
    const userAvatar = resolveUserAvatar();
    return {
        sender,
        senderName: chatProfile.nickname || sender.name || '我',
        userAvatar: userAvatar.url,
        userAvatarBg: userAvatar.bg,
    };
}

/**
 * 从一个 contenteditable 输入框提取纯文本
 * @param {HTMLElement|null} input
 * @returns {string}
 */
export function readInputText(input) {
    if (!input) return '';
    return (input.innerText || input.textContent || '').trim();
}
