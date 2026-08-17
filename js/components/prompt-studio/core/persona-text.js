/**
 * prompt-studio / core / persona-text.js
 * ------------------------------------------------------------
 * 人设上下文文本 + 默认回复须知 + system prompt 拼接(阶段 1 步骤 1.4)
 *
 * 从 prompt-manager-page.js 原封不动搬过来(来源行号:319~478):
 *   - buildUserPersonaContextText(user)  —— 用户人设 → 角色卡文本
 *   - buildAiPersonaContextText(ai)      —— AI 人设 → 角色卡文本
 *   - buildPersonaPromptFromUser(user, overrides)  —— 内部
 *   - buildPersonaPromptFromAi(ai, overrides)      —— 内部
 *   - defaultReplyNote(kind)             —— chat-app addMessage 时拼提示(export)
 *   - composeSystemPrompt(ctx, note, position)     —— chat-app addMessage 时拼提示(export)
 *
 * 函数签名 / 行为 0 修改,保留 export —— chat-app 的 addMessage / index.js 都引用 defaultReplyNote + composeSystemPrompt
 */

import { escapeHtml } from '@/src/core/escape.js';

// ============================================================
// ★ v0.61.7 提示词卡片组件(当前上下文长款 = renderPromptCard)
//    与可用 Prompt 短款(renderPromptControlCard)是两个组件
// ============================================================

/**
 * 构建用户人设的完整上下文文本（与 settings app 的人设上下文格式一致）
 * 格式: # 角色卡: xxx
 *       # 1. 基本信息
 *       chineseName: xxx
 *       gender: xxx
 *       ...
 * @param {object} user
 * @returns {string}
 */
export function buildUserPersonaContextText(user) {
    if (!user) return '';
    const sections = [];
    const name = user.name || user.chineseName || '';

    // 标题
    sections.push(`# 角色卡${name ? ': ' + name : ''}`);
    sections.push('');

    // 1. 基本信息
    const basicFields = [];
    if (user.chineseName || user.name) basicFields.push(`chineseName: ${user.chineseName || user.name}`);
    if (user.gender) basicFields.push(`gender: ${user.gender}`);
    if (user.age != null) basicFields.push(`age: ${user.age}`);
    if (user.identity) basicFields.push(`identity: ${user.identity}`);
    if (user.bio) basicFields.push(`bio: ${user.bio}`);
    if (user.personality) basicFields.push(`personality: ${user.personality}`);

    if (basicFields.length > 0) {
        sections.push('# 1. 基本信息');
        sections.push(basicFields.join('\n'));
        sections.push('');
    }

    // 2. 外貌与体征
    if (user.appearance) {
        sections.push('# 2. 外貌与体征');
        sections.push(`appearance: ${user.appearance}`);
        sections.push('');
    }

    // 3. 性格特质
    if (user.personality || user.personalityTraits || user.currentOccupation) {
        sections.push('# 3. 性格特质');
        sections.push(`traits: ${user.personality || ''}`);
        sections.push('');
    }

    // 4. 背景
    if (user.bio || user.background) {
        sections.push('# 4. 背景');
        sections.push(`experience: ${user.bio || user.background || ''}`);
        sections.push('');
    }

    // 5. 偏好
    const prefMod = user.preferences || {};
    const hobbies = Array.isArray(prefMod.hobbies) ? prefMod.hobbies : [];
    const likes = Array.isArray(prefMod.likes) ? prefMod.likes : [];
    const dislikes = Array.isArray(prefMod.dislikes) ? prefMod.dislikes : [];

    if (prefMod.enabled && (hobbies.length || likes.length || dislikes.length)) {
        sections.push('# 5. 偏好');
        if (hobbies.length) sections.push(`hobbies: ${hobbies.join(', ')}`);
        if (likes.length) sections.push(`likes: ${likes.join(', ')}`);
        if (dislikes.length) sections.push(`dislikes: ${dislikes.join(', ')}`);
        sections.push('');
    }

    return sections.filter(s => s !== '').join('\n');
}

/**
 * 构建 AI 人设的完整上下文文本（与 settings app 的人设上下文格式一致）
 * @param {object} ai
 * @returns {string}
 */
export function buildAiPersonaContextText(ai) {
    if (!ai) return '';
    const sections = [];
    const name = ai.name || '';

    // 标题
    sections.push(`# 角色卡${name ? ': ' + name : ''}`);
    sections.push('');

    // 1. 基本信息
    const basicFields = [];
    if (ai.name) basicFields.push(`chineseName: ${ai.name}`);
    if (ai.gender) basicFields.push(`gender: ${ai.gender}`);
    if (ai.age != null) basicFields.push(`age: ${ai.age}`);
    if (ai.role) basicFields.push(`identity: ${ai.role}`);
    if (ai.bio) basicFields.push(`bio: ${ai.bio}`);
    if (ai.personality) basicFields.push(`personality: ${ai.personality}`);
    if (ai.tone) basicFields.push(`tone: ${ai.tone}`);

    if (basicFields.length > 0) {
        sections.push('# 1. 基本信息');
        sections.push(basicFields.join('\n'));
        sections.push('');
    }

    // 2. 外貌与体征
    if (ai.appearance) {
        sections.push('# 2. 外貌与体征');
        sections.push(`appearance: ${ai.appearance}`);
        sections.push('');
    }

    // 3. 性格特质
    if (ai.personality || ai.personalityTraits) {
        sections.push('# 3. 性格特质');
        sections.push(`traits: ${ai.personality || ''}`);
        sections.push('');
    }

    // 4. 背景
    if (ai.bio || ai.background) {
        sections.push('# 4. 背景');
        sections.push(`experience: ${ai.bio || ai.background || ''}`);
        sections.push('');
    }

    // 5. 行为规则
    if (Array.isArray(ai.rules) && ai.rules.length > 0) {
        sections.push('# 5. 行为规则');
        ai.rules.forEach((r) => sections.push(`- ${r}`));
        sections.push('');
    }

    return sections.filter(s => s !== '').join('\n');
}

/**
 * 内部 helper —— 把 user 人设包成完整 system prompt 文本
 * @param {object} user
 * @param {object|null} overrides
 * @returns {string}
 */
export function buildPersonaPromptFromUser(user, overrides = null) {
    // 使用新的上下文格式
    const contextText = buildUserPersonaContextText(user);
    if (!contextText) return '';
    const note = overrides?.note ?? defaultReplyNote('user');
    const position = overrides?.position ?? 'after';
    return composeSystemPrompt(contextText, note, position);
}

/**
 * 内部 helper —— 把 ai 人设包成完整 system prompt 文本
 * @param {object} ai
 * @param {object|null} overrides
 * @returns {string}
 */
export function buildPersonaPromptFromAi(ai, overrides = null) {
    // 使用新的上下文格式
    const contextText = buildAiPersonaContextText(ai);
    if (!contextText) return '';
    const note = overrides?.note ?? defaultReplyNote('ai');
    const position = overrides?.position ?? 'after';
    return composeSystemPrompt(contextText, note, position);
}

/**
 * 默认回复须知(用户/AI 各一份,首次未编辑时使用)
 * @param {'user'|'ai'} kind
 * @returns {string}
 */
export function defaultReplyNote(kind) {
    return kind === 'user'
        ? '请按上述人设匹配对方的身份,自然地使用对应的称谓、语气和话题范围。'
        : '请严格按上述人设(包括名字 / 性格 / 背景 / 行为规则)进行回复,保持角色一致性。';
}

/**
 * 拼接 system prompt 最终内容:人设上下文 + (位置) + 回复须知
 *  - note 为空 → 不加回复须知段落
 *  - position: 'before' 在人设前,'after' 在人设后
 * @param {string} contextText
 * @param {string} note
 * @param {'before'|'after'} position
 * @returns {string}
 */
export function composeSystemPrompt(contextText, note, position = 'after') {
    if (!note) return contextText;
    const noteLine = `【回复须知】${note}`;
    if (position === 'before') return `${noteLine}\n\n${contextText}`;
    return `${contextText}\n\n${noteLine}`;
}

// 重新 export escapeHtml(供消费方需要时 import)
export { escapeHtml };
