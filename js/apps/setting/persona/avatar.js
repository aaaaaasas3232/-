/**
 * nook 人设头像：概览 / 卡片 / 主页共用同一套字段。
 * 有 persona.avatar 就显示图，否则回退到名字首字。
 */

import { escapeHtml } from '@/src/core/escape.js';

export function getPersonaInitial(name) {
    if (!name) return '?';
    const trimmed = String(name).trim();
    if (!trimmed) return '?';
    return Array.from(trimmed)[0].toUpperCase();
}

export function renderPersonaAvatarContent(persona) {
    const avatar = typeof persona?.avatar === 'string' ? persona.avatar.trim() : '';
    if (avatar) {
        return `<img class="persona-avatar-image" src="${escapeHtml(avatar)}" alt="" />`;
    }
    return escapeHtml(getPersonaInitial(persona?.name));
}
