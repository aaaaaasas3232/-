/**
 * chat-app / 回复提示词管理详情页（v0.50 真实数据驱动版）
 *
 * 数据源:
 *   - sdk.replyPrompts.list(aiPersonId)        全部 replyPrompts(按 order 升序)
 *   - sdk.replyPrompts.listActive(aiPersonId)  仅 active=true 子集
 *   - 数据落在 aiPerson.replyPrompts 顶层(深合并友好,mergePatch 自动)
 *
 * 触发:聊天设置页 → AI 设置卡片 → 「回复提示词」一行
 *
 * UI 结构:
 *   第一部分「当前上下文」
 *     - 列出 sdk.replyPrompts.listActive(aiPersonId)
 *     - 每条带:序号 + 标题 + 内容预览 + 启/停 toggle + 上移 + 下移 + 编辑 + 删除
 *     - 空状态:友好提示(「暂未添加提示词,请在下方启用或新增」)
 *   第二部分「可用 Prompt」
 *     - 列出 sdk.replyPrompts.list(aiPersonId) 中 active=false 的子集
 *     - 每条带:标题 + 内容预览 + 启/停 toggle + 上移 + 下移 + 编辑 + 删除
 *     - 空状态:「尚未创建任何提示词,点下方 + 新增」 + 「新增」按钮
 *
 * 所有交互按钮走 framework `data-app-action`:
 *   - 启/停 → method: toggleReplyPromptActive  payload: { aiPersonId, promptId }
 *   - 上移 → method: moveReplyPromptUp        payload: { aiPersonId, promptId }
 *   - 下移 → method: moveReplyPromptDown      payload: { aiPersonId, promptId }
 *   - 删除 → method: deleteReplyPrompt        payload: { aiPersonId, promptId }
 *   - 编辑 → method: openEditReplyPromptModal payload: { aiPersonId, promptId }
 *   - 新增 → method: openCreateReplyPromptModal payload: { aiPersonId }
 *
 * 视觉风格:与 chat-settings / calendar-view 同款
 *   - 蓝粉渐变背景 + 白底卡片 + iOS 圆角 toggle
 *   - 列表项用 .pm-active-item 样式(顶部) / .pm-available-item 样式(底部)
 *   - icon 全部 inline SVG
 *
 * ★ 不依赖 demo 数据,全部走 SDK
 */

import { escapeHtml } from '@/src/core/escape.js';
import { renderAppPromptCardPreview, getPreviewTypeLabel } from '@/js/apps/chat-app/components/app-prompt-card.js'; // ★ v0.61.5 第三方 App Prompt 卡片预览
import { SPECIAL_ACTIONS_HELP, REPLY_STYLE_INSTRUCTIONS } from '@/js/apps/chat-app/services/prompt-builder.js'; // ★ v0.62.x 「回复格式 + 短句风格」注入块

// ============================================================
// 工具函数
// ============================================================

/**
 * 头像背景色工具(与 chat-settings / calendar-view 同款)
 */
function getAvatarColor(id) {
    const palette = ['#A8C8EC', '#F4A6CD', '#B8D4F0', '#FFD4E5', '#C8E6F4', '#FFC8DD', '#B8E6CF', '#D4B8F0'];
    let hash = 0;
    for (let i = 0; i < (id || '').length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
    }
    return palette[Math.abs(hash) % palette.length];
}

/**
 * 内容预览(超过 limit 字符就截断 + …)
 */
function previewText(text, limit = 80) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (s.length <= limit) return s || '(空内容)';
    return s.slice(0, limit) + '…';
}

/**
 * 把 pageId 解析成 aiPersonId + mode。
 *   - 'ai0'                          → { aiPersonId: 'ai0', mode: 'calendar' }
 *   - 'ai0-calendar' / 'ai0-story'   → 标准形态
 *   - 'private-ai0-calendar'         → 切掉 private- 前缀后同标准形态
 */
function parseContactId(contactId) {
    let id = String(contactId || '');
    if (id.startsWith('private-')) id = id.slice('private-'.length);
    const lastDash = id.lastIndexOf('-');
    if (lastDash > 0) {
        const tail = id.slice(lastDash + 1);
        if (tail === 'calendar' || tail === 'story') {
            return { aiPersonId: id.slice(0, lastDash), mode: tail };
        }
    }
    return { aiPersonId: id, mode: 'calendar' };
}

// ============================================================
// ★ v0.61.8.6 App Prompt 卡片 CSS 编辑器工具函数
//   - textarea 内容是 CSS 字符串(不是 JSON)
//   - 改了 CSS 实时注入到 <style> 标签,覆盖预览卡片样式
//   - 保存到 localStorage(不依赖 SDK,简单直接)
// ============================================================
const _CARD_CSS_PREFIX = 'xiaoting::prompt-card-css-';
const _DEFAULT_CARD_CSS_MAP = {
    'music-card': `/* 音乐卡片样式 —— 改这里实时影响预览卡片 */
.app-shell[data-app-id="chat"] .prompt-manager .pm-preview-card--music {
    background: #FFFFFF;
    border: 1px solid rgba(196, 130, 220, 0.32);
    border-radius: 10px;
    padding: 8px 12px;
}
.app-shell[data-app-id="chat"] .prompt-manager .pm-preview-card--music .pm-preview-card__cover {
    width: 36px;
    height: 36px;
    border-radius: 8px;
}
.app-shell[data-app-id="chat"] .prompt-manager .pm-preview-card--music .pm-preview-card__title {
    font-size: 13px;
    font-weight: 600;
    color: #222;
}
.app-shell[data-app-id="chat"] .prompt-manager .pm-preview-card--music .pm-preview-card__sub {
    font-size: 11px;
    color: #8E8E93;
    margin-top: 2px;
}`,
    'red-packet-card': `/* 红包卡片样式 —— 改这里实时影响预览卡片 */
.app-shell[data-app-id="chat"] .prompt-manager .pm-preview-card--red-packet {
    background: linear-gradient(135deg, #E94560 0%, #C0394B 100%);
    border-radius: 10px;
    padding: 10px 14px;
    color: #FFFFFF;
}
.app-shell[data-app-id="chat"] .prompt-manager .pm-preview-card__redpacket-title {
    font-size: 13px;
    font-weight: 600;
}
.app-shell[data-app-id="chat"] .prompt-manager .pm-preview-card__redpacket-sender {
    font-size: 11px;
    opacity: 0.84;
    margin-top: 2px;
}`,
    'location-card': `/* 位置卡片样式 —— 改这里实时影响预览卡片 */
.app-shell[data-app-id="chat"] .prompt-manager .pm-preview-card--location {
    background: #FFFFFF;
    border: 1px solid rgba(168, 200, 236, 0.32);
    border-radius: 10px;
    padding: 8px 12px;
}
.app-shell[data-app-id="chat"] .prompt-manager .pm-preview-card__location-name {
    font-size: 13px;
    font-weight: 600;
    color: #222;
}
.app-shell[data-app-id="chat"] .prompt-manager .pm-preview-card__location-address {
    font-size: 11px;
    color: #8E8E93;
    margin-top: 2px;
}`,
    'text': `/* 文本卡片样式 —— 改这里实时影响预览卡片 */
.app-shell[data-app-id="chat"] .prompt-manager .pm-preview-card--text {
    background: #FFFFFF;
    border: 1px solid rgba(168, 200, 236, 0.32);
    border-radius: 10px;
    padding: 8px 12px;
}
.app-shell[data-app-id="chat"] .prompt-manager .pm-preview-card__text {
    font-size: 13px;
    color: #222;
    line-height: 1.5;
}`,
};

function getDefaultCardCss(previewType) {
    return _DEFAULT_CARD_CSS_MAP[previewType] || _DEFAULT_CARD_CSS_MAP.text;
}

function loadSavedCardCss(appId, promptId) {
    if (typeof localStorage === 'undefined') return '';
    try {
        const raw = localStorage.getItem(_CARD_CSS_PREFIX + `${appId}::${promptId}`);
        if (!raw) return '';
        return String(raw);
    } catch (_) {
        return '';
    }
}

function saveSavedCardCss(appId, promptId, css) {
    if (typeof localStorage === 'undefined') return false;
    try {
        localStorage.setItem(_CARD_CSS_PREFIX + `${appId}::${promptId}`, String(css || ''));
        return true;
    } catch (_) {
        return false;
    }
}

// 把 CSS 字符串注入到预览卡片的 <style> 标签里(实时生效)
//   - 在 .pm-special-card-preview[data-preview-card="..."] 内放/更新 <style>
//   - 移除旧标签,加新标签(简单粗暴但稳定)
function injectCardCss(compositeId, css) {
    const card = document.querySelector(
        `.pm-special-card-preview[data-preview-card="${compositeId}"]`
    );
    if (!card) return;
    // 找到或创建 style 标签
    let styleEl = card.querySelector(':scope > style.pm-preview-card-css-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.className = 'pm-preview-card-css-style';
        card.insertBefore(styleEl, card.firstChild);
    }
    styleEl.textContent = String(css || '');
}

// 暴露到 window,供 chat-app/index.js 的 module-level input 监听器调用
if (typeof window !== 'undefined') {
    window.__injectCardCss = injectCardCss;
    window.__getDefaultCardCss = getDefaultCardCss;
}

// ============================================================
// 渲染组件
// ============================================================

/**
 * 操作按钮组:优先级 / 注入深度 / 编辑 / 启停 tab(单行)
 *
 * @param {object} opts
 * @param {string} opts.aiPersonId
 * @param {string} opts.promptId
 * @param {boolean} [opts.isActive=true]
 * @param {boolean} [opts.locked=false]  true = 系统虚拟 prompt,锁定不可停用
 *                                      → 不渲染 segmented-tabs,改渲染锁定徽标
 */
function renderRowActions({ aiPersonId, promptId, isActive = true, locked = false, systemControl = null }) {
    const mk = (method, extra = {}) => {
        const payload = { aiPersonId, promptId, ...extra };
        return JSON.stringify({ action: 'appMethod', appId: 'chat', method, payload });
    };
    const toggleAction = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'toggleReplyPromptActive',
        payload: { aiPersonId, promptId },
    });
    // ★ v0.57 系统 prompt 控制卡 → toggle / 编辑 走不同 method
    const systemToggleAction = systemControl
        ? JSON.stringify({
            action: 'appMethod',
            appId: 'chat',
            method: 'toggleSystemPromptInject',
            payload: { aiPersonId, kind: systemControl.kind },
        })
        : toggleAction;
    const systemEditAction = systemControl
        ? JSON.stringify({
            action: 'appMethod',
            appId: 'chat',
            method: 'openSystemPromptEditor',
            payload: { aiPersonId, kind: systemControl.kind },
        })
        : mk('openEditReplyPromptModal');

    // ★ 系统虚拟 prompt 且未配置 systemControl → 只显示锁标,完全不可点
    if (locked && !systemControl) {
        return `
            <div class="pm-row-actions pm-row-actions--locked">
                <span class="pm-lock-badge" title="系统虚拟提示词,自动注入,不可关闭">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="11" width="14" height="9" rx="2"/>
                        <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                    </svg>
                </span>
            </div>
        `;
    }

    return `
        <div class="pm-row-actions ${systemControl ? 'pm-row-actions--system' : ''}">
            ${systemControl ? '' : `<button type="button" class="pm-chip pm-chip--delete"
                data-app-action='${escapeHtml(mk('deleteReplyPrompt'))}'
                title="删除">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
            </button>`}
            <button type="button" class="pm-chip pm-chip--edit"
                data-app-action='${escapeHtml(systemEditAction)}'
                title="编辑">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>
                </svg>
            </button>
            <div class="pm-segmented-tabs" data-prompt-id="${escapeHtml(promptId)}">
                <button type="button" class="pm-segmented-tab ${isActive ? '' : 'is-active'}"
                    data-app-action='${escapeHtml(systemToggleAction)}'
                    data-target="close">关闭</button>
                <button type="button" class="pm-segmented-tab ${isActive ? 'is-active' : ''}"
                    data-app-action='${escapeHtml(systemToggleAction)}'
                    data-target="enable">启用</button>
            </div>
        </div>
    `;
}

// ============================================================
// 系统虚拟 prompt helpers
//   - 把「用户人设」「AI 人设」自动转成 2 条虚拟 prompt,作为回复提示词的一部分
//   - 这 2 条永远 enabled,UI 锁住不让关 / 删 / 改
// ============================================================

/**
 * 构建用户人设的完整上下文文本（与 settings app 的人设上下文格式一致）
 * 格式: # 角色卡: xxx
 *       # 1. 基本信息
 *       chineseName: xxx
 *       gender: xxx
 *       ...
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

function buildPersonaPromptFromUser(user, overrides = null) {
    // 使用新的上下文格式
    const contextText = buildUserPersonaContextText(user);
    if (!contextText) return '';
    const note = overrides?.note ?? defaultReplyNote('user');
    const position = overrides?.position ?? 'after';
    return composeSystemPrompt(contextText, note, position);
}

function buildPersonaPromptFromAi(ai, overrides = null) {
    // 使用新的上下文格式
    const contextText = buildAiPersonaContextText(ai);
    if (!contextText) return '';
    const note = overrides?.note ?? defaultReplyNote('ai');
    const position = overrides?.position ?? 'after';
    return composeSystemPrompt(contextText, note, position);
}

/**
 * 默认回复须知(用户/AI 各一份,首次未编辑时使用)
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
 */
export function composeSystemPrompt(contextText, note, position = 'after') {
    if (!note) return contextText;
    const noteLine = `【回复须知】${note}`;
    if (position === 'before') return `${noteLine}\n\n${contextText}`;
    return `${contextText}\n\n${noteLine}`;
}

// ============================================================
// ★ v0.61.7 提示词卡片组件(当前上下文长款 = renderPromptCard)
//    与可用 Prompt 短款(renderPromptControlCard)是两个组件
// ============================================================

/**
 * 渲染「当前上下文 Prompt」长款卡片(序号 + 标题 + source + preview)
 *   - 序号 + 长 preview 是「当前上下文」特有,「可用 Prompt」没有
 *   - body 内只有正文(各业务可往 body 后追加额外 block)
 *   - 右侧按钮框放在 <summary> 之外,在 <details> 容器里通过 CSS 浮在右上
 *     → 修 a11y 问题(summary 内嵌 button 抢焦点 / 风格按钮难命中)
 */
function renderPromptCard({
    renderId,
    promptId,
    title,
    source,
    preview,
    fullContent,
    order,
    draggable = true,
    omitActions = false,
    actionsHtml = '',
    extraClass = '',
    extraBody = '',
}) {
    const indexHtml = renderId
        ? `<span class="pm-card-index">${escapeHtml(String(renderId))}</span>`
        : '';
    const sourceHtml = source
        ? `<span class="pm-item-source">${escapeHtml(source)}</span>`
        : '';
    const previewHtml = preview
        ? `<div class="pm-item-preview">${escapeHtml(preview)}</div>`
        : '';
    const rightHtml = omitActions ? '' : `
                <div class="pm-item-right">
                    ${actionsHtml}
                </div>`;
    const extraAttrs = draggable ? `data-pm-draggable="true"` : '';
    // ★ v0.61.8.7 作用域 class:仅用于 DOM 区分「当前上下文区」,不改样式
    const cls = `pm-card pm-item pm-item--in-context${extraClass ? ' ' + extraClass : ''}`;
    return `
        <details class="${cls}" data-prompt-id="${escapeHtml(promptId)}" data-order="${escapeHtml(String(order ?? ''))}" ${extraAttrs}>
            <summary class="pm-item-summary">
                ${indexHtml}
                <div class="pm-item-main">
                    <div class="pm-item-head">
                        <span class="pm-item-title">${escapeHtml(title)}</span>
                        ${sourceHtml}
                    </div>
                    ${previewHtml}
                </div>${rightHtml}
            </summary>
            <div class="pm-item-body">
                <div class="pm-item-content">${escapeHtml(fullContent || '')}</div>
                ${extraBody}
            </div>
        </details>
    `;
}

/**
 * 渲染「可用 Prompt」短款卡片(只有标题 + 右侧按钮)
 *   - 与「当前上下文」的结构区别:
 *     · 无序号、无 preview 行、无 source 角标
 *     · 主体更短(高度一致)
 *   - body 内只放正文
 *   - 右侧按钮同样在 summary 之外,CSS 浮在右上
 */
function renderPromptControlCard({
    promptId,
    title,
    fullContent,
    dataKind = '',
    extraClass = '',
    actionsHtml = '',
    extraBody = '',
    skipDefaultContent = false,
}) {
    const dataKindAttr = dataKind ? `data-kind="${escapeHtml(dataKind)}"` : '';
    // ★ v0.61.7.2 加上 pm-card 类(与 renderPromptCard 对齐),
    //   这样 savePromptManagerChanges / drag-controller 才能同时收集到
    //   「当前上下文」section 和「可用 Prompt」section 的卡片
    // ★ v0.61.8.7 作用域 class:仅用于 DOM 区分「可用 Prompt 区」,不改样式
    const cls = `pm-card pm-item pm-item--control pm-item--in-available${extraClass ? ' ' + extraClass : ''}`;
    const rightHtml = actionsHtml
        ? `<div class="pm-item-right">${actionsHtml}</div>`
        : '';
    // ★ v0.61.8.2 App Prompt 三段式布局:content 已经包在 extraBody 内的视图容器里,
    //   这里跳过默认 content 防止重复
    const defaultContentHtml = skipDefaultContent
        ? ''
        : `<div class="pm-item-content">${escapeHtml(fullContent || '')}</div>`;
    return `
        <details class="${cls}" data-prompt-id="${escapeHtml(promptId)}" ${dataKindAttr}>
            <summary class="pm-item-summary">
                <div class="pm-item-main">
                    <div class="pm-item-head">
                        <span class="pm-item-title">${escapeHtml(title)}</span>
                    </div>
                </div>${rightHtml}
            </summary>
            <div class="pm-item-body">
                ${defaultContentHtml}
                ${extraBody}
            </div>
        </details>
    `;
}


/**
 * ★ v0.61.7 渲染「当前上下文 Prompt」长款卡片
 *   - 序号 + title + source + preview(当前上下文独有)
 *   - 右侧按钮组放在 <summary> 之外,CSS 浮在右上(a11y)
 */
function renderActivePromptItem(prompt, index, total, aiPersonId, opts = {}) {
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const isActive = prompt.active !== false;
    const omitActions = !!opts.omitActions;
    const actionsHtml = omitActions ? '' : renderRowActions({
        aiPersonId,
        promptId: prompt.id,
        isFirst,
        isLast,
        isActive,
    });
    return renderPromptCard({
        renderId: index + 1,
        promptId: prompt.id,
        title: prompt.title,
        source: omitActions ? '' : (prompt.source || 'custom'),
        preview: previewText(prompt.content, 120),
        fullContent: prompt.content,
        order: prompt.order,
        draggable: true,
        omitActions,
        actionsHtml,
        extraClass: omitActions ? 'pm-item--system-context' : '',
    });
}

/**
 * ★ v0.61.7 渲染「可用 Prompt」短款卡片(只有标题 + 右侧按钮)
 *   - 与当前上下文长款是两个组件
 *   - 按钮组放在 <summary> 之外 → 修 a11y 问题
 */
function renderPromptControlPromptItem(prompt, aiPersonId) {
    const isActive = prompt.active !== false;
    const actionsHtml = renderRowActions({
        aiPersonId,
        promptId: prompt.id,
        isActive,
    });
    return renderPromptControlCard({
        promptId: prompt.id,
        title: prompt.title,
        fullContent: prompt.content,
        actionsHtml,
    });
}

/**
 * 渲染「系统 Prompt 控制卡」(用于「可用 Prompt」section 顶部)
 *   - 跟真实 prompt 同款 UI(可展开正文 + 完整按钮组)
 *   - 「优先级 / 注入深度 / 编辑」+「关闭 / 启用」toggle
 *   - 编辑跳 settings → personaHome
 *   - toggle 走 toggleSystemPromptInject
 *   - 启用状态从 injectMap[aiPersonId][kind] 读取,实时反映
 */
function renderSystemPromptControlItem(systemPrompt, aiPersonId, injectMap) {
    const kind = systemPrompt.systemKind === 'ai' ? 'ai' : 'user';
    const roleClass = kind === 'user' ? 'pm-item--system-user' : 'pm-item--system-ai';
    const inject = injectMap?.[aiPersonId] || { user: true, ai: true };
    const isActive = inject[kind] !== false;
    const actionsHtml = renderRowActions({
        aiPersonId,
        promptId: systemPrompt.id,
        isActive,
        systemControl: { kind },
    });
    return renderPromptControlCard({
        promptId: systemPrompt.id,
        title: systemPrompt.title,
        fullContent: systemPrompt.content,
        dataKind: kind,
        extraClass: roleClass,
        actionsHtml,
    });
}

/**
 * ★ v0.64 渲染「AI 表情包库」nook 控制卡
 *
 * 业务背景:
 *   - 这张卡代表「AI 可以用哪些表情包」,数据源是 aiPerson.boundResources.stickerGroupIds
 *   - 用户在 settings → 人设编辑器 → 资源绑定 → 表情包库 绑定图组后,
 *     这张卡里的「可发表情包」列表会自动更新
 *   - 关闭后 prompt-builder 不注入「表情包库」段,AI 完全不知道哪些表情可用
 *
 * 视觉风格:
 *   - 跟系统人设控制卡一致(.pm-card .pm-item .pm-item--control .pm-item--in-available)
 *   - data-kind="sticker-library"(供 CSS 锁样式 / 调试)
 *   - extraClass: pm-item--system-ai(用 AI 主角色色)
 *
 * 内容:
 *   - 标题:"AI 表情包库"
 *   - 简介动态渲染:读 aiPerson.boundResources.stickerGroupIds + 异步加载 group image names
 *     默认简版:「N 张表情」,展开后才读 group 详情(name 列表)
 *   - fullContent 是占位简版,真正详细的 names 列表在 systemPrompt 拼接时已经注入,
 *     这卡只展示开关状态
 */
function renderStickerLibraryControlItem({ aiPersonId, stickerCount, isActive }) {
    const roleClass = 'pm-item--system-ai';
    const actionsHtml = renderRowActions({
        aiPersonId,
        promptId: 'sticker-library',
        isActive,
        systemControl: { kind: 'sticker-library' },
    });
    // fullContent 给 <details> 展开看(简版,真实名称列表在 prompt 里)
    const fullContent = stickerCount > 0
        ? `# AI 表情包库\n\n当前已绑定 ${stickerCount} 张可发表情包。\n\n详细名称列表已注入到系统 prompt,AI 回复时会自动遵守 [表情包:名称] 格式。`
        : `# AI 表情包库\n\n你还没绑定表情包资源 — 去「设置 → 人设 → 资源绑定 → 表情包」绑定图组。`;
    return renderPromptControlCard({
        promptId: 'sticker-library',
        title: 'AI 表情包库',
        fullContent,
        dataKind: 'sticker-library',
        extraClass: roleClass,
        actionsHtml,
    });
}

// ============================================================
// 主渲染函数
// ============================================================

/**
 * ★ v0.61.3 渲染单条 summary item(calendarSummaries / storySummaries 共用)
 *   - 视觉风格:和 pm-card 接近,但标题前加小图标
 *   - 显示:标题 + dateRange / messageCount + 预览前 80 字
 */
function renderSummaryItem(s, index, kind) {
    const preview = escapeHtml(previewText(s.content || '', 80));
    const meta = (s.dateRange && (s.dateRange.start || s.dateRange.end))
        ? `${escapeHtml(s.dateRange.start || '')} ~ ${escapeHtml(s.dateRange.end || '')}`
        : '';
    const msgCount = Number(s.messageCount) || 0;
    const iconHtml = kind === 'story'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="#D4728A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5l2.4 5 5.5.8-4 3.9.9 5.5L12 15.4 7.2 17.7l.9-5.5-4-3.9 5.5-.8L12 2.5z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="#4A6FA5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>';
    return `
        <div class="pm-summary-item pm-summary-item--${escapeHtml(kind)}" data-summary-id="${escapeHtml(s.id)}">
            <div class="pm-summary-item-head">
                <div class="pm-summary-item-icon">${iconHtml}</div>
                <div class="pm-summary-item-main">
                    <div class="pm-summary-item-title">${escapeHtml(s.title || '未命名概要')}</div>
                    <div class="pm-summary-item-meta">
                        ${meta ? `<span class="pm-summary-item-range">${meta}</span>` : ''}
                        ${msgCount > 0 ? `<span class="pm-summary-item-count">${msgCount} 条</span>` : ''}
                        <span class="pm-summary-item-badge">${kind === 'story' ? '故事' : '日历'}</span>
                    </div>
                </div>
                <div class="pm-summary-item-source">[${index + 1}]</div>
            </div>
            <div class="pm-summary-item-preview">${preview}</div>
        </div>
    `;
}

/**
 * ★ v0.61.7 渲染「Prompt 库」单条(底部拉取区)
 *   - 复用 .pm-item 主结构(对齐当前用户人设)
 *   - 右侧按钮:拉取(把库条目复制成当前 AI 人设的 replyPrompt)
 *   - 来源面包屑:.pm-item-source 角标
 *   - active=true 状态显示「已添加」徽标(已拉取过)
 */
/**
 * ★ v0.61.7 渲染「Prompt 库」单条(底部拉取区)
 *   - 复用 .pm-item 主结构(与当前用户人设 / 当前 AI 人设一致)
 *   - 标题前用 [库] / [已添加] 标签代替 state-badge
 *   - 来源面包屑:.pm-item-source 角标
 *   - 右侧按钮:拉取(把库条目复制成当前 AI 人设的 replyPrompt)
 *   - 已拉取:按钮 disabled + 灰态 + 文字改「已拉取」(v0.61.8.10 防止反复拉取)
 *     ★ isImported 时按钮仍然存在但 disabled,而不是换成对勾 —— 用户一眼就知道
 *       这条已经被当前 AI 人设拉取过,无法再操作;视觉上「拉取」位置不变,只是变灰
 */
function renderPromptLibraryItem({ entry, isImported, aiPersonId }) {
    const pr = entry.prompt || {};
    const title = escapeHtml(pr.text?.split('\n')[0]?.slice(0, 24) || pr.id || '未命名');
    const fullText = escapeHtml(pr.text || '');
    // ★ v0.61.8.10 拉取按钮:已拉取时禁用(灰态 + 文字「已拉取」),不换成对勾
    //   防止用户重复点击拉取(SDK 内部已有 sourceLibraryPromptId 去重,但 UI 上要明确反馈)
    const pullBtnClass = isImported ? 'pm-chip pm-chip--pull pm-chip--pulled' : 'pm-chip pm-chip--pull';
    const pullBtnLabel = isImported ? '已拉取' : '拉取';
    const pullBtnTitle = isImported
        ? '已添加到当前 AI 人设(在「可用 Prompt → Nook 组」可见,可在该处启用/删除)'
        : '拉取到当前 AI 人设';
    const actionsHtml = `
        <button type="button" class="${pullBtnClass}"
            data-app-action='${escapeHtml(JSON.stringify({
                action: 'appMethod',
                appId: 'chat',
                method: 'pullReplyPromptFromLibrary',
                payload: { aiPersonId, promptId: pr.id },
            }))}'
            ${isImported ? 'disabled' : ''}
            title="${escapeHtml(pullBtnTitle)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
            <span>${pullBtnLabel}</span>
        </button>`;
    return renderPromptControlCard({
        promptId: pr.id || '',
        title: title,
        fullContent: fullText,
        dataKind: 'library',
        extraClass: isImported ? 'pm-item--library pm-item--library-pulled' : 'pm-item--library',
        actionsHtml,
    });
}

/**
 * @param {object} app  chat-app 实例(从 externalAppRegistry.getApp('chat') 拿)
 * @param {string} contactId  pageId 去掉 'prompt-manager-' 前缀后的部分
 *                           形态可能是 ai0 / ai0-calendar / ai0-story
 */
export async function renderPromptManagerPage(app, contactId) {
    const { aiPersonId, mode } = parseContactId(contactId);

    // ===== 1. 读联系人 / 用户 / AI 人设 =====
    let displayName = aiPersonId;
    let avatarUrl = '';
    let userPersona = null;   // 当前用户人设
    let aiPersonObj = null;   // 当前 AI 人设完整对象
    try {
        const sdk = window.settingsSdk;
        const defaultUser = sdk?.defaultUserCard?.getDefault?.() || sdk?.users?.getActive?.();
        if (defaultUser) userPersona = defaultUser;
        const entry = (sdk && defaultUser)
            ? sdk.chatFriends?.get?.(defaultUser, aiPersonId, mode)
            : null;
        if (entry) {
            displayName = entry.displayName || entry.remark || displayName;
            avatarUrl = entry.avatar || '';
        }
        const aiPerson = sdk?.aiPersons?.get?.(aiPersonId);
        if (aiPerson) {
            aiPersonObj = aiPerson;
            const chatProfile = aiPerson.socialProfiles?.chat || {};
            if (!avatarUrl) avatarUrl = chatProfile.avatar || aiPerson.avatar || '';
            if (displayName === aiPersonId) {
                displayName = chatProfile.nickname || aiPerson.name || aiPersonId;
            }
        }
    } catch (_) { /* 静默兜底 */ }
    const avatarColor = getAvatarColor(aiPersonId);
    const avatarText = String(displayName || '?').charAt(0);

    // ★ v0.61.7.2 ★ 修复:overrideMap 必须从 localStorage 兜底加载
    //   - 历史 bug:_saveSystemPromptOverrides 写 localStorage,但 hydrate 只在 app 注册时跑一次
    //     (HMR / chat-app 已注册后修改文件 不会重新 hydrate),内存里的 systemPromptOverrides 永远空
    //   - 解决:内存为空时直接从 localStorage 读(同步、零成本、命中即返回)
    let overrideMap = app?.state?.chat?.systemPromptOverrides;
    if (!overrideMap || Object.keys(overrideMap).length === 0) {
        try {
            const raw = localStorage.getItem('xiaoting::chat-system-prompt-overrides-v1');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    overrideMap = parsed;
                    // 顺便回填到内存(让后续 hydration 也能拿到)
                    if (app) {
                        if (!app.state) app.state = {};
                        if (!app.state.chat) app.state.chat = {};
                        app.state.chat.systemPromptOverrides = parsed;
                    }
                }
            }
        } catch (_) { /* ignore */ }
    }
    overrideMap = overrideMap || {};
    const getOverride = (kind) => overrideMap[aiPersonId]?.[kind] || null;
    // ===== 2. ★ v0.61.7.1 prompt 数据源统一为 sdk.replyPrompts(与所有 toggle/move/delete/create/edit/save 方法保持一致)
    //   - 历史:nookSdk.prompts.list 是一份独立的 aiPerson.nookPrompts[] 字段,
    //     跟 toggleReplyPromptActive 等方法操作的 sdk.replyPrompts 是两套数据,
    //     导致「保存按钮写完,prompt-builder 拼出的 prompt 不变」的 bug
    //   - 现在:用户自定义 prompt 全部走 sdk.replyPrompts(aiPerson.replyPrompts[]),
    //     prompt-manager 渲染 / 所有交互方法 / prompt-builder.buildPreview / savePromptManagerChanges 全部读这一份
    const replyPromptsList = window.settingsSdk?.replyPrompts?.list?.(aiPersonId) || [];
    // system prompt / 世界 / 当前聊天回合仍然走 nookSdk(保持 v0.61.7 引入的 system prompt 控制卡)
    const nookAll = window.settingsSdk?.nookSdk?.prompts?.list?.(aiPersonId) || [];
    const nookSystem = nookAll.filter((p) => p && p.system).map((p) => {
        const kind = p.systemKind === 'ai' ? 'ai' : 'user';
        const override = getOverride(kind);
        return { ...p, content: kind === 'ai' ? buildPersonaPromptFromAi(aiPersonObj, override) : buildPersonaPromptFromUser(userPersona, override), locked: true };
    });
    const systemPrompts = nookSystem;

    // 世界观 prompt 单独处理（它有 kind:'worldview' 但没有 system:true）
    const worldPrompt = nookAll.find((p) => p && p.kind === 'worldview') || null;

    // ★ v0.64 「AI 表情包库」状态(默认 true)— 从 localStorage 兜底加载,跟 replyFormatInject / kChainActive 同款
    let stickerLibraryInjectMap = app?.state?.chat?.stickerLibraryInject;
    if (!stickerLibraryInjectMap || Object.keys(stickerLibraryInjectMap).length === 0) {
        try {
            const raw = localStorage.getItem('xiaoting::chat-sticker-library-inject-v1');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    stickerLibraryInjectMap = parsed;
                    if (app) {
                        if (!app.state) app.state = {};
                        if (!app.state.chat) app.state.chat = {};
                        app.state.chat.stickerLibraryInject = parsed;
                    }
                }
            }
        } catch (_) { /* ignore */ }
    }
    stickerLibraryInjectMap = stickerLibraryInjectMap || {};
    const stickerLibraryInjectAvailable = stickerLibraryInjectMap[aiPersonId] !== false;

    // ★ v0.64 算 AI 当前绑定表情包张数(只读 aiPerson.boundResources.stickerGroupIds 数量,
    //   真实 names 列表由 prompt-builder 注入到 systemPrompt;这张卡只展示「N 张」)
    let stickerCount = 0;
    try {
        const aiStickerIds = Array.isArray(aiPersonObj?.boundResources?.stickerGroupIds)
            ? aiPersonObj.boundResources.stickerGroupIds
            : [];
        // 这里不异步查 db 拿每个 group 的 image 数(会阻塞 render),只展示「绑了 N 个图组」,
        // 实际张数由 prompt-builder 注入的 systemPrompt 显示。这里保留 group 数量已足够区分「有 / 没有」。
        stickerCount = aiStickerIds.length;
    } catch (_) { stickerCount = 0; }

    // ★ v0.61.7.1 当前上下文只显示用户自定义的 prompt(来自 replyPrompts SDK)
    //   ★ v0.61.8.8 防御性:从 prompt 库拉过来的条目(sourceLibraryPromptId 存在)
    //     永远不进「当前上下文」,只在「可用 Prompt」区展示,即使 active=true 也过滤掉
    //   ★ v0.61.8.10 ★ 修复「可用 Prompt 区启停后卡片消失」恶性 bug:
    //     用户原话:「关闭启用的按钮行为跟其他prompt区域的prompt对齐不就好了!!!!!」
    //     → 所有 replyPrompt(active=true 和 active=false)都要在「可用 Prompt → Nook 组」
    //       持续可见,启停切换不影响「可用 Prompt」区显示,跟其他 prompt 区域行为对齐
    //     → 关闭按钮 = 让 prompt 从「当前上下文」消失,但「可用 Prompt」区继续显示(状态切「关闭」)
    //     → 启用按钮 = 让 prompt 进「当前上下文」,「可用 Prompt」区继续显示(状态切「启用」)
    //     → 删除 = 完全消失(从 replyPrompts 数组移除)
    let activeList = replyPromptsList.filter((p) => p && p.active !== false && !p.sourceLibraryPromptId);
    let inactiveList = replyPromptsList.filter((p) => p && p.active === false);
    // ★ v0.61.8.10 nook 组展示所有 replyPrompt(active 和 inactive 全部),保证用户切换启停时
    //   卡片始终可见于「可用 Prompt」区,只在 toggle 视觉上反映状态变化(关闭/启用 哪个高亮)
    //   历史 v0.61.8.9 漏 active=true 的 → active=true 时 nook 组卡片消失(恶性 bug)
    //   历史 v0.61.8.10 第一次尝试只保留 sourceLibraryPromptId → 漏掉普通自定义 prompt
    const pulledFromLibrary = replyPromptsList.slice();

    // 计算 injectMap
    const injectMap = (app?.state?.chat?.systemPromptInject) || {};
    const isInjected = (sp) => {
        if (!sp?.system) return true;
        const kind = sp.systemKind === 'ai' ? 'ai' : 'user';
        const v = injectMap[aiPersonId]?.[kind];
        return v !== false;
    };
    const visibleSystemPrompts = systemPrompts.filter(isInjected);
    const worldPromptActive = worldPrompt ? (worldPrompt.active !== false) : false;

    // ★ v0.61.3 概要系统读取(active=true 才渲染)
    //   - calendarSummaries(active) - 日历概要
    //   - storySummaries(active)    - 故事概要
    //   - rollingSummaries(active)  - 滚动摘要 K 链(用 buildKChainContext 拼成单条文本)
    //   - contextRounds 文本(用 computeContextRoundsPrompt 实时算)
    const summarySdk = window.settingsSdk;
    const activeCalSummaries = summarySdk?.calendarSummaries?.listActive?.(aiPersonId) || [];
    const activeStorySummaries = summarySdk?.storySummaries?.listActive?.(aiPersonId) || [];
    const kChainText = summarySdk?.rollingSummaries?.buildKChainContext?.(aiPersonId) || '';
    const rollingCfg = summarySdk?.rollingSummaries?.getRollingConfig?.(aiPersonId) || null;
    // ★ v0.61.5 第三方 App Prompt 列表(从注册 SDK 读)
    const appPromptsList = summarySdk?.appPrompts?.list?.() || [];
    // 读 messages 用于实时算 contextRounds
    let liveMessages = [];
    try {
        const user = summarySdk?.defaultUserCard?.getDefault?.() || summarySdk?.users?.getActive?.();
        liveMessages = summarySdk?.chatMessages?.list
            ? (summarySdk.chatMessages.list(user, aiPersonId, 'calendar') || [])
            : [];
    } catch (_) { liveMessages = []; }
    const contextRoundsText = app?.methods?.computeContextRoundsPrompt
        ? app.methods.computeContextRoundsPrompt(aiPersonId, liveMessages, Number(rollingCfg?.contextRounds) || 20)
        : '';
    // contextRounds 启用状态（默认 true）
    const contextRoundsActive = (app?.state?.chat?.contextRoundsActive?.[aiPersonId]) !== false;

    // ★ v0.62.x 「回复格式与聊天风格」启用状态(默认 true)
    //   - 状态存储:app.state.chat.replyFormatInject[aiPersonId](boolean)
    //   - 持久化:localStorage 'xiaoting::chat-reply-format-inject-v1'(跟 systemPromptOverrides 同样模式)
    //   - 渲染兜底:内存为空时同步读 localStorage(防 HMR / 旧实例不重跑 hydrate)
    let replyFormatInjectMap = app?.state?.chat?.replyFormatInject;
    if (!replyFormatInjectMap || Object.keys(replyFormatInjectMap).length === 0) {
        try {
            const raw = localStorage.getItem('xiaoting::chat-reply-format-inject-v1');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    replyFormatInjectMap = parsed;
                    if (app) {
                        if (!app.state) app.state = {};
                        if (!app.state.chat) app.state.chat = {};
                        app.state.chat.replyFormatInject = parsed;
                    }
                }
            }
        } catch (_) { /* ignore */ }
    }
    replyFormatInjectMap = replyFormatInjectMap || {};
    // 默认 true,用户切到 false 才显示「关闭」高亮
    const replyFormatInjectAvailable = replyFormatInjectMap[aiPersonId] !== false;

    // ★ v0.63 「K 链摘要」启用状态(默认 true)
    //   - 状态存储:app.state.chat.kChainActive[aiPersonId](boolean)
    //   - 持久化:localStorage 'xiaoting::chat-k-chain-active-v1'
    //   - 渲染兜底:内存为空时同步读 localStorage(防 HMR / 旧实例不重跑 hydrate)
    let kChainActiveMap = app?.state?.chat?.kChainActive;
    if (!kChainActiveMap || Object.keys(kChainActiveMap).length === 0) {
        try {
            const raw = localStorage.getItem('xiaoting::chat-k-chain-active-v1');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    kChainActiveMap = parsed;
                    if (app) {
                        if (!app.state) app.state = {};
                        if (!app.state.chat) app.state.chat = {};
                        app.state.chat.kChainActive = parsed;
                    }
                }
            }
        } catch (_) { /* ignore */ }
    }
    kChainActiveMap = kChainActiveMap || {};
    // ★ v0.63.2 拆分两个语义(基于用户 8/8 反馈):
    //   - kChainVisible: K 链卡片是否在 murmur 折叠区显示
    //     只受总开关(rollingConfig.enabled)控制,个人 toggle 不影响可见性
    //     用户原话:「K 链的启用并不影响 K 链卡片停留在 murmur 折叠区」+
    //              「前面设置页的滚动摘要是否开启才会影响 K 链卡片是否出现在 murmur 折叠区」
    //   - kChainInjected: K 链内容是否注入到当前上下文区(和 AI systemPrompt)
    //     = 总开关 && 个人启用 toggle,这是 K 链卡上「关闭/启用」按钮实际控制的
    //   - kChainActive 保留旧名,语义 = kChainInjected(下游太多地方用了,改名成本大)
    //     · 「murmur 折叠区可见性」语境 → 必须用 kChainVisible
    //     · 「是否注入到上下文」语境   → 用 kChainActive = kChainInjected
    const rollingEnabledGlobal = !!(rollingCfg && rollingCfg.enabled);
    const kChainVisible = rollingEnabledGlobal;
    const kChainInjected = rollingEnabledGlobal && kChainActiveMap[aiPersonId] !== false;
    const kChainActive = kChainInjected;

    // ★ v0.66 「记忆概要」状态(默认 true)
    //   - 状态存储:app.state.chat.memorySummaryInject[aiPersonId](boolean,默认 true)
    //   - 持久化:localStorage 'xiaoting::chat-memory-summary-inject-v1'
    //   - 渲染兜底:同 §28 三段式
    //   - 行为:
    //     · 关闭某条 → 该条从 murmur 卡片消失(实际不删数据),prompt-builder.buildMemoryContext 输出时排除该条
    //     · 删除某条 → sdk.memorySummaries.remove(soft delete),从 murmur 消失
    let memorySummaryInjectMap = app?.state?.chat?.memorySummaryInject;
    if (!memorySummaryInjectMap || Object.keys(memorySummaryInjectMap).length === 0) {
        try {
            const raw = localStorage.getItem('xiaoting::chat-memory-summary-inject-v1');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    memorySummaryInjectMap = parsed;
                    if (app) {
                        if (!app.state) app.state = {};
                        if (!app.state.chat) app.state.chat = {};
                        app.state.chat.memorySummaryInject = parsed;
                    }
                }
            }
        } catch (_) { /* ignore */ }
    }
    memorySummaryInjectMap = memorySummaryInjectMap || {};
    // ★ 读取所有 L1~L4 未删概要,作为 murmur 组的虚拟卡片来源
    let memorySummariesList = [];
    try {
        const sdk = window.settingsSdk;
        if (sdk?.memorySummaries?.list) {
            // 合并各层
            const all = [];
            for (const lvl of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']) {
                const list = sdk.memorySummaries.list(aiPersonId, lvl) || [];
                for (const s of list) all.push(s);
            }
            memorySummariesList = all;
        }
    } catch (_) { memorySummariesList = []; }
    // 过滤掉已软删的(deleted=true)。不按 active / memorySummaryInjectMap 过滤,
    //   让「可用 Prompt → Murmur」永远展示全集(跟 §33「nook 组 = replyPrompt 全集」对齐:
    //   关闭按钮只切 toggle 视觉高亮,不让卡片从可用区消失)。
    memorySummariesList = memorySummariesList.filter((s) => {
        if (!s || !s.id) return false;
        if (s.deleted) return false;
        return true;
    });
    // 按 generatedAt 倒序:新的在前
    memorySummariesList.sort((a, b) => (Number(b?.generatedAt) || 0) - (Number(a?.generatedAt) || 0));

    // ===== 4. 渲染顶部 bar / 头部 =====
    const headerBarHtml = `
        <div class="pm-topbar">
            <button class="chat-back-btn" data-app-action='{"action":"appMethod","appId":"chat","method":"closeDetail"}'>
                <svg viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="pm-topbar-title">回复提示词</div>
            <div class="pm-topbar-spacer"></div>
        </div>
    `;

    // ★ 统计:只数「当前上下文」section 里实际显示的条目
    //   = activeList + active summaries + k chain(若有) + context rounds(若有)
    //   ★ v0.63.2:K 链卡在「当前上下文区」是否显示 = kChainVisible(总开关)
    //     个人 toggle(kChainActive)不影响可见性,只影响是否注入到 AI 上下文
    //   ★ v0.66.x:记忆概要 active=未关掉的部分(注入 injectMap = !false)
    const activeMemorySummaryCount = Array.isArray(memorySummariesList)
        ? memorySummariesList.filter((s) => {
            if (!s || !s.id) return false;
            const aiMap = memorySummaryInjectMap[aiPersonId] || {};
            return aiMap[s.id] !== false;
        }).length
        : 0;
    const _summaryItemCount =
        activeCalSummaries.length +
        activeStorySummaries.length +
        (kChainVisible ? 1 : 0) + // ★ v0.63.2 总开关开就计数
        (contextRoundsText && contextRoundsActive ? 1 : 0) +
        activeMemorySummaryCount; // ★ v0.66.x 记忆概要 active 部分
    const activeTotal = activeList.length + _summaryItemCount;
    const totalCount = activeList.length + inactiveList.length;

    // 头部信息卡
    const headerInfo = `
        <div class="pm-header-info">
            <div class="pm-header-avatar" data-avatar-color="${escapeHtml(avatarColor)}">
                ${avatarUrl
                    ? `<img src="${escapeHtml(avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`
                    : `<span class="pm-header-avatar-text">${escapeHtml(avatarText)}</span>`}
            </div>
            <div class="pm-header-text">
                <div class="pm-header-name">${escapeHtml(displayName)}</div>
                <div class="pm-header-stat">已启用 ${activeTotal} / 共 ${totalCount} 条</div>
            </div>
            <button type="button" class="pm-add-btn"
                data-app-action='${escapeHtml(JSON.stringify({ action: 'appMethod', appId: 'chat', method: 'openCreateReplyPromptModal', payload: { aiPersonId } }))}'>
                <span>新增</span>
            </button>
        </div>
    `;

    // ===== 3.5 injectMap 已在前面计算 =====
    // 注意: activeTotal / totalCount 已在 headerInfo 上方声明

    // ===== 5. 第一部分:当前上下文(用户自定义 active real prompts + 概要 + context rounds) =====

// 构建完整的上下文预览文本:
//   = 按「当前上下文」section 实际显示顺序拼接(active real prompts + 概要 + context rounds)
//   - 真实 prompt 的 content 直接拼
//   - 概要项 prepend 「# 标题」+ content
//   - context rounds 同理
//   pre 用的就是这里的内容,跟用户展开 details 后看到的一致
//   ★ v0.61.7 previewParts 在 orderedCards 之后构建(见下面);这里先声明空占位避免 TDZ

    // ★ v0.63.2 移除 K 链的独立概要卡(pm-summary-item)
    //   - 用户原话:「不要在当前上下文 div 里增加没必要的内容」
    //   - 当前上下文区里已经有一张「K 链摘要」折叠卡(来自 systemActiveItems.push 的
    //     _isKChain item,渲染成 details.pm-item-system-context[6] summary="K 链摘要 (空内容)")
    //   - 上面再画一张独立概要卡(pm-summary-item pm-summary-item--rolling)是重复
    //   - 简洁样式:K 链只在「当前上下文区」显示折叠卡,不画第二张独立卡
    const summarySubItemsHtml = `
    ${activeCalSummaries.map((s, i) => renderSummaryItem(s, i, 'calendar')).join('')}
    ${activeStorySummaries.map((s, i) => renderSummaryItem(s, i, 'story')).join('')}
`;

function buildActiveSection({ fullContextPreview, activeHtml, summarySubItemsHtml, activeCalSummaries, activeStorySummaries, kChainText, contextRoundsText, contextRoundsActive, totalActiveCount, aiPersonId }) {
    return `
        <div class="pm-card pm-card-section">
            ${fullContextPreview ? `
            <div class="pm-context-preview">
                <pre class="pm-context-preview__raw">${escapeHtml(fullContextPreview)}</pre>
            </div>
            ` : ''}
            <div class="pm-section-head">
                <div class="pm-section-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h16"/>
                    </svg>
                </div>
                <div class="pm-section-info">
                    <div class="pm-section-title">当前上下文</div>
                </div>
                <button type="button" class="pm-section-save"
                    data-app-action='${JSON.stringify({ action: 'appMethod', appId: 'chat', method: 'savePromptManagerChanges' })}'
                    title="保存当前上下文的更改（顺序、预览等）">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                    </svg>
                </button>
            </div>
            <div class="pm-section-body">
                ${totalActiveCount === 0
                    ? `<div class="pm-empty">
                            <div class="pm-empty-title">还没有可注入的提示词</div>
                            <div class="pm-empty-desc">从下方「可用 Prompt」启用，或点右上方「新增」创建一条</div>
                        </div>`
                    : `<div class="pm-active-list">
                            ${activeHtml}
                            ${summarySubItemsHtml}
                        </div>`
                }
            </div>
        </div>
    `;
}

    // ★ v0.61.7 第二部分:已启用的「系统级」控制卡(用户/AI 人设、世界观、当前聊天回合)
    //   - 这些来自「可用 Prompt」区域的 nook + murmur 组的开关控制
    //   - 启用后,要在「当前上下文」底部单独显示,跟用户自定义 prompt 平级
    //   - 预览 (fullContextPreview) 也要包含它们
    const systemActiveItems = [];
    // 1) 系统人设 prompt(用户/AI)
    visibleSystemPrompts.forEach((sp) => {
        if (sp?.content) {
            systemActiveItems.push({
                id: sp.id,
                title: sp.title || (sp.systemKind === 'ai' ? '当前 AI 人设' : '当前用户人设'),
                content: sp.content,
                source: sp.systemKind === 'ai' ? 'nook-ai' : 'nook-user',
            });
        }
    });
    // 2) 世界观 prompt
    if (worldPrompt && worldPromptActive && worldPrompt.content) {
        systemActiveItems.push({
            id: worldPrompt.id || 'world',
            title: worldPrompt.title || '当前世界观',
            content: worldPrompt.content,
            source: 'nook-world',
        });
    }
    // 3) 当前聊天回合
    if (contextRoundsText && contextRoundsActive) {
        systemActiveItems.push({
            id: 'context-rounds',
            title: '当前聊天回合',
            content: contextRoundsText,
            source: 'murmur',
        });
    }
    // 3.5) ★ v0.63.2 K 链摘要(由 kChainActive 个人 toggle 控制是否出现在当前上下文区)
    //   - 用户原话:「关闭按钮按了,卡片要消失」 → 「关闭」=从当前上下文区移除
    //   - 可见性 = kChainActive(总开关 && 个人 toggle 都为 true 才显示)
    //   - 总开关 rollingEnabledGlobal 关闭 → 卡片消失 + 无 toggle(总开关就是 false)
    //   - 个人 toggle 关闭 → 卡片消失 + 切回启用时重新出现
    if (kChainActive) {
        systemActiveItems.push({
            id: 'k-chain',
            title: 'K 链摘要',
            content: kChainText || '', // 空字符串也能 push,context 区显示一个空行卡(等同「占位」)
            source: 'k-chain',
        });
    }
    // 4) ★ v0.62.x 回复格式与聊天风格(虚拟卡片,只在「可用 Prompt → Murmur」启用时出现)
    //   - 内容 = SPECIAL_ACTIONS_HELP + REPLY_STYLE_INSTRUCTIONS(从 prompt-builder 导入)
    //   - 头像/source 标记「reply-format」,跟「当前聊天回合」区分
    //   - 拖拽后会进 contextOrder 列表(被 _endDrag() → reorderContextPrompts 写入)
    if (replyFormatInjectAvailable) {
        systemActiveItems.push({
            id: 'reply-format',
            title: '回复格式与聊天风格',
            content: [SPECIAL_ACTIONS_HELP, REPLY_STYLE_INSTRUCTIONS].join('\n\n'),
            source: 'reply-format',
        });
    }
    // 5) ★ v0.64 「AI 表情包库」 — 跟「回复格式」并列的虚拟系统级卡
    //   - 在「可用 Prompt → Nook」用 segmented-tabs 控制是否注入 prompt-builder
    //   - 启用后这里 push 占位 summary(用户能看到「AI 表情包库」出现在「当前上下文」)
    //   - 真实 names 列表在 prompt-builder 已经注入到 systemPrompt,这张卡只展示「N 个图组」元信息
    //   - ★ 注意:这里的 content 是「占位」,跟 systemPrompt 实际内容可能有微小差别(只展示开关)
    //     AGENTS.md §34 同样规则:不要在 previewParts 末尾再兜底 push(否则 pre 重复)
    if (stickerLibraryInjectAvailable) {
        systemActiveItems.push({
            id: 'sticker-library',
            title: 'AI 表情包库',
            content: stickerCount > 0
                ? `# AI 表情包库\n\n当前已绑定 ${stickerCount} 个表情图组。AI 可使用 [表情包:名称] 格式发送表情。详细名称列表已注入到 systemPrompt(不在预览中完整展开)。`
                : `# AI 表情包库\n\n尚未绑定任何表情图组。AI 可用表情包为空,可在「设置 → 人设 → 资源绑定」添加。`,
            source: 'sticker-library',
        });
    }
    // 6) ★ v0.66.x 「记忆概要」虚拟系统级卡(每条未删概要一张)
    //   - 跟 §34「新增虚拟卡 = 三处必改」+ §36「K 链三层穿透」完全对齐:
    //     ① 可用 Prompt → Murmur 组:全集显示,active 反映 injectMap(渲染层已改)
    //     ② 当前上下文 systemActiveItems.push:只 push active(用户没关的)
    //     ③ prompt preview:由 orderedCards 统一拼(下面 previewParts 已自动包含)
    //   - 关闭某条 → 不进当前上下文 + toggle 视觉切到「关闭」 + prompt-builder.buildMemoryContext 排除该条
    //   - 删除某条 → 从 list 移除(已软删) → 三个区域都消失
    if (Array.isArray(memorySummariesList) && memorySummariesList.length > 0) {
        const aiInjectMap = memorySummaryInjectMap[aiPersonId] || {};
        memorySummariesList.forEach((s) => {
            if (!s || !s.id) return;
            // active 用 injectMap 计算(默认 true,被关掉才 false)
            if (aiInjectMap[s.id] === false) return;
            const content = String(s.content || '').trim();
            systemActiveItems.push({
                id: s.id,
                title: `记忆概要 · ${s.title || '未命名'}`,
                content: content || '(空概要)',
                source: `memory-summary-${s.storageLevel || 'L1'}`,
            });
        });
    }

    // ★ v0.61.7 合并 activeList(用户自定义) + systemActiveItems(系统级) → orderedCards
    //   - 拖拽换位后,顺序存到 app.state.chat.contextOrder[aiPersonId]
    //   - 渲染按 contextOrder 排序;序号 = 在有序数组中的真实位置 + 1
    //   - 顺序直接影响 prompt 拼装顺序(详见 prompt-builder contextOrder 参数)
    const customActive = activeList.map((p) => ({ ...p, _kind: 'custom' }));
    const systemActive = systemActiveItems.map((p) => ({ ...p, _kind: 'system' }));
    const allCards = [...customActive, ...systemActive];
    // ★ v0.61.7.3 ★ contextOrder 也要从 localStorage 兜底加载
    //   - 历史 bug:reorderContextPrompts 只写内存,刷新后 state.chat.contextOrder 空
    //   - 解决:内存为空时直接读 localStorage,跟 systemPromptOverrides 同样的兜底
    let contextOrderMap = app?.state?.chat?.contextOrder;
    if (!contextOrderMap || Object.keys(contextOrderMap).length === 0) {
        try {
            const raw = localStorage.getItem('xiaoting::chat-context-order-v1');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    contextOrderMap = parsed;
                    if (app) {
                        if (!app.state) app.state = {};
                        if (!app.state.chat) app.state.chat = {};
                        app.state.chat.contextOrder = parsed;
                    }
                }
            }
        } catch (_) { /* ignore */ }
    }
    contextOrderMap = contextOrderMap || {};
    const contextOrder = contextOrderMap[aiPersonId]; // string[] of id, optional
    let orderedCards = allCards;
    if (Array.isArray(contextOrder) && contextOrder.length > 0) {
        // 按 contextOrder 排,contextOrder 里没有的卡片追加到末尾,顺序保留
        const orderIndex = new Map(contextOrder.map((id, i) => [id, i]));
        orderedCards = allCards.slice().sort((a, b) => {
            const ai = orderIndex.has(a.id) ? orderIndex.get(a.id) : Number.MAX_SAFE_INTEGER;
            const bi = orderIndex.has(b.id) ? orderIndex.get(b.id) : Number.MAX_SAFE_INTEGER;
            if (ai !== bi) return ai - bi;
            // 都没在 order 里,保持原顺序(custom 在前 system 在后)
            return allCards.indexOf(a) - allCards.indexOf(b);
        });
    }
    const totalCards = orderedCards.length;
    // ★ omitActions: true → 卡片只显示标题+预览,点开展开,长按拖拽;不显示按钮组
    // ★ v0.61.8.9 当前上下文区域只展示 + 拖拽排序,不显示任何按钮组
    //   所有按钮(启停/编辑/删除)统一在「可用 Prompt」区的卡片里操作
    const activeHtml = orderedCards.map((p, i) =>
        renderActivePromptItem(p, i, totalCards, aiPersonId, { omitActions: true }),
    ).join('');

    // ★ v0.61.7 构建预览文案(放在 orderedCards 之后,避免 TDZ;顺序 == 视觉顺序)
    const previewParts = [];
    orderedCards.forEach((p) => {
        if (p.content) previewParts.push(p.content);
    });
    activeCalSummaries.forEach((s) => {
        if (s.content) previewParts.push(`# ${s.title || '日历概要'}\n${s.content}`);
    });
    activeStorySummaries.forEach((s) => {
        if (s.content) previewParts.push(`# ${s.title || '故事概要'}\n${s.content}`);
    });
    if (kChainText) previewParts.push(kChainText);
    // ★ v0.62.x 「回复格式 + 短句风格」不再额外 push:
    //   orderedCards → systemActiveItems 已经把 reply-format 卡的 content
    //   (=[SPECIAL_ACTIONS_HELP, REPLY_STYLE_INSTRUCTIONS].join('\n\n'))
    //   推到 previewParts 里,这里再 push 一次会重复出现两次。
    //   之前 v0.62.x 升级时为了「AI 看到的 = 预览看到的」一致性而保留兜底,
    //   但现在 orderedCards 已经包含 reply-format,留兜底反而是双重拼接。
    const fullContextPreview = previewParts.join('\n\n').trim();

    // 把已启用的系统级控制卡内容也拼到预览(已在 fullContextPreview 中,这里不再重复)
    const finalContextPreview = fullContextPreview;

    // ★ v0.61.7 可用 Prompt 区域：按 App 分组折叠
    //   - nook 组：当前用户人设、当前 AI 人设、世界观 + 从 prompt 库拉取过来的用户 prompt
    //   - murmur 组：当前聊天回合 + 回复格式与聊天风格(★ v0.62.x 新增)
    //   - 第三方 App Prompt（音乐/天气等）
    const groupedPromptsHtml = renderAppPromptGroupSection({
        systemPrompts,
        worldPrompt,
        contextRoundsText,
        contextRoundsActive,
        replyFormatInjectAvailable, // ★ v0.62.x 新增
        kChainText,                // ★ v0.63 新增
        kChainVisible,             // ★ v0.63.2 新增:K 链卡可见性(只看总开关)
        kChainActive,              // ★ v0.63 新增:K 链注入状态(总开关 && 个人 toggle)
        appPromptsList,
        injectMap,
        aiPersonId,
        // ★ v0.61.8.10 修复:从库拉过来的 prompt 必须包含 active 和 inactive 两部分,
        //   否则启停切换会让卡片从「可用 Prompt」区凭空消失(用户原话恶性 bug)
        //   行为对齐:跟其他 prompt 区域的 prompt 一样,关闭后留在「可用 Prompt」区,
        //   只是 segmented-tabs 切到「关闭」状态,可以再点「启用」把它带回来
        pulledFromLibrary,
        // ★ v0.64 「AI 表情包库」状态 — 必须透传过去,跨函数不能读上层闭包
        stickerLibraryInjectAvailable,
        stickerCount,
        // ★ v0.66 「记忆概要」列表(murmur 组内的虚拟系统级卡)
        memorySummariesList,
        // ★ v0.66.x injectMap(用于记忆概要 toggle 视觉状态计算)
        memorySummaryInjectMap,
    });

    const availableSection = `
        <div class="pm-card pm-card-section">
            <div class="pm-section-head">
                <div class="pm-section-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                        stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="7" height="7"/>
                        <rect x="14" y="3" width="7" height="7"/>
                        <rect x="14" y="14" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/>
                    </svg>
                </div>
                <div class="pm-section-info">
                    <div class="pm-section-title">可用 Prompt</div>
                    <div class="pm-section-desc">按 App 分组，点开折叠查看各 App 下的提示词</div>
                </div>
            </div>
            <div class="pm-section-body">
                ${groupedPromptsHtml}
            </div>
        </div>
    `;

    // ===== ★ v0.58 第三部分:Prompt 库(底部) =====
    //   - 异步加载 sdk.promptLibrary.listAllPrompts()(settings app 的 prompt_db)
    //   - 展示全部库条目,标记哪些已经被当前 AI 人设拉取过(replyPromptIds 对比)
    //   - 点「拉取」按钮 → 复制到 aiPerson.replyPrompts(自动 active=true)
    //   - 空状态:引导用户去 settings app 的 Prompt 工程建库
    const libraryEntries = (await _loadPromptLibrarySafely()) || [];
    // ★ v0.61.8.9 修复:importedIds 必须从「全部」replyPrompts 算,
    //   不能用 activeList(activeList 已经过滤掉了 active=false 和 sourceLibraryPromptId),
    //   导致拉过来(active=false)的 prompt 永远不被识别为「已拉取」,
    //   库的「拉取」按钮一直可点 → 重复拉取
    const importedIds = new Set(
        replyPromptsList.map((p) => p?.sourceLibraryPromptId).filter(Boolean),
    );
    const libraryHtml = libraryEntries.length === 0
        ? `<div class="pm-empty">
                <div class="pm-empty-title">Prompt 库暂无条目</div>
                <div class="pm-empty-desc">去「设置 → Prompt 工程」建库 / 包 / 组,然后回到这里拉取</div>
            </div>`
        : `<div class="pm-library-list">
                ${libraryEntries.map((entry) => {
                    const pid = entry?.prompt?.id;
                    const isImported = pid && importedIds.has(pid);
                    return renderPromptLibraryItem({ entry, isImported, aiPersonId });
                }).join('')}
            </div>`;

    const promptLibrarySection = `
        <div class="pm-card pm-card-section pm-card-section--library">
            <div class="pm-section-divider">
                <span class="pm-section-divider-text">Prompt 库</span>
                <span class="pm-section-divider-line"></span>
            </div>
            <div class="pm-section-head">
                <div class="pm-section-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                </div>
                <div class="pm-section-info">
                    <div class="pm-section-title">从 Prompt 库拉取</div>
                    <div class="pm-section-desc">来自「设置 → Prompt 工程」的库条目,点右侧「拉取」复制到当前 AI 人设</div>
                </div>
            </div>
            <div class="pm-section-body">
                ${libraryHtml}
            </div>
        </div>
    `;

    // ===== 4. 拼装 =====
    return `
        <div class="prompt-manager" data-contact-id="${escapeHtml(contactId)}" data-ai-person-id="${escapeHtml(aiPersonId)}">
            ${headerBarHtml}
            <div class="pm-page">
                ${headerInfo}
                ${buildActiveSection({
                    fullContextPreview,
                    activeHtml,
                    summarySubItemsHtml,
                    activeCalSummaries,
                    activeStorySummaries,
                    kChainText,
                    contextRoundsText,
                    contextRoundsActive,
                    totalActiveCount: totalCards + (activeCalSummaries.length + activeStorySummaries.length + (kChainVisible ? 1 : 0)),
                    aiPersonId,
                })}
                ${availableSection}
                ${promptLibrarySection}
            </div>
        </div>
    `;
}

/**
 * ★ v0.58 内部 helper:加载 prompt 库条目(SDK 异步 API)
 *   - 任何异常都返回空数组(不影响主流程渲染)
 *   - SDK 未就绪时也返回空(上层会显示「暂无条目」+ 引导文案)
 */
async function _loadPromptLibrarySafely() {
    try {
        const sdk = window.settingsSdk;
        if (!sdk?.promptLibrary) return [];
        const list = await sdk.promptLibrary.listAllPrompts();
        return Array.isArray(list) ? list : [];
    } catch (err) {
        console.warn('[prompt-manager] loadPromptLibrary failed', err);
        return [];
    }
}

// ============================================================
// ★ v0.61.7 按 App 分组折叠的 Prompt 列表（可用 Prompt 区域）
//   - 所有 prompt 按 appId/source 分组
//   - 每个 App 一个折叠项，点开显示该 App 下的所有 prompt
//   - 分组包含:
//     - nook: 当前用户人设、当前 AI 人设、世界观（控制卡）
//     - murmur (chat): 当前聊天回合（实时计算）
//     - music/weather: 第三方 App Prompt
//   - 用户自定义的真实 prompt 单独显示在「当前上下文」区域
// ============================================================

const APP_GROUP_LABELS = {
    'nook': { name: 'Nook', icon: '🌿', color: '#7CB342', desc: '当前用户人设 / AI 人设 / 世界观' },
    'murmur': { name: 'Murmur', icon: '💬', color: '#4A6FA5', desc: '当前聊天回合等实时计算内容' },
    'chat': { name: 'Murmur', icon: '💬', color: '#4A6FA5', desc: '当前聊天回合等实时计算内容' },
    'music': { name: '音乐', icon: '🎵', color: '#E91E63', desc: '音乐 App 提供的提示词' },
    'weather': { name: '天气', icon: '☀️', color: '#FF9800', desc: '天气 App 提供的提示词' },
    'focus': { name: '专注', icon: '⏱️', color: '#9C27B0', desc: '专注 App 提供的提示词' },
    'gallery': { name: '图库', icon: '🖼️', color: '#2196F3', desc: '图库 App 提供的提示词' },
    'default': { name: '其他', icon: '📦', color: '#607D8B', desc: '其他 App' },
};

function getAppGroupInfo(source) {
    return APP_GROUP_LABELS[source] || { ...APP_GROUP_LABELS['default'], name: source || '其他' };
}

/**
 * 渲染「K 链摘要」item（murmur 组内） — v0.63 (双面板:点 summary 看实际拼接 / 点小眼睛看 K 组内全部 K)
 *   - 来自 aiPerson.socialProfiles.chat.rollingSummaries[]
 *   - 内容：buildKChainContext() 拼出来的多 K 文本
 *   - 开关控制是否注入到上下文
 *   - ★ 跟「当前聊天回合」/「回复格式」同款 UI（.pm-card.pm-item.pm-item--control.pm-item--in-available）
 *   - ★ v0.63.1 加小眼睛预览(跟 App Prompt 同款):
 *     · 点卡片本体 → 显示真实注入文本(text-panel)
 *     · 点小眼睛   → 显示 K 组里所有 K 原文(preview-panel,实时刷新)
 *   - 状态存 app.state.chat.kChainActive[aiPersonId]（默认 true）
 *   - 持久化：localStorage 'xiaoting::chat-k-chain-active-v1'
 *   - ★ v0.63.1 卡片始终显示(只要 K 链总开关开启),不再要求 kChainText 非空
 */
function renderKChainGroupItem({ text, aiPersonId, active = true }) {
    const isActive = active;
    const hasContent = !!(text && text.trim());
    const emptyHintText = '（暂无 K 链内容 — 开启滚动摘要并积累足够回合后,会自动生成 K0、K1… 并在这里显示实际拼接到上下文的文本）';
    const textForPanel = text && text.trim() ? text : emptyHintText;
    // 小眼睛按钮的 action(走 previewKChainCard method,跟 previewAppPrompt 同样的状态机)
    const eyeActionPayload = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'previewKChainCard',
        payload: { aiPersonId },
    });
    const toggleActionPayload = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'toggleKChainActive',
        payload: { aiPersonId },
    });
    // 算 K 列表(给小眼睛预览用)
    const allKList = (() => {
        try {
            const sdk = window.settingsSdk;
            return (sdk?.rollingSummaries?.list?.(aiPersonId) || []);
        } catch (_) { return []; }
    })();
    const kCount = allKList.length;
    // 小眼睛按钮的 badge(K 数量)
    const eyeBadgeHtml = kCount > 0
        ? `<span class="pm-chip__badge">${kCount}</span>`
        : '';
    const actionsHtml = `
        <button type="button" class="pm-chip pm-chip--preview pm-chip--kchain-eye"
            data-app-action='${escapeHtml(eyeActionPayload)}'
            data-prompt-id="${escapeHtml('k-chain::' + aiPersonId)}"
            title="预览 K 组所有 K 原文（实时）">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
            ${eyeBadgeHtml}
        </button>
        <div class="pm-segmented-tabs" data-prompt-id="k-chain">
            <button type="button" class="pm-segmented-tab ${isActive ? '' : 'is-active'}"
                data-app-action='${escapeHtml(toggleActionPayload)}'
                data-target="close">关闭</button>
            <button type="button" class="pm-segmented-tab ${isActive ? 'is-active' : ''}"
                data-app-action='${escapeHtml(toggleActionPayload)}'
                data-target="enable">启用</button>
        </div>`;
    // ★ 拼 preview-panel:K 组全部 K(原文列表,实时)
    //   - 空 K 时显示「等待 K0 生成中…」占位
    //   - 每条带 K 编号 + 时间 + 消息数 + 完整原文
    const kListHtml = (() => {
        if (kCount === 0) {
            return `<div class="pm-kchain-empty">
                <div class="pm-kchain-empty__title">K 组为空</div>
                <div class="pm-kchain-empty__desc">开启滚动摘要后,每攒满「合并粒度」回合会自动生成 K0、K1 …</div>
            </div>`;
        }
        return allKList.map((k, idx) => {
            const kLevel = k?.level ?? 0;
            const kIdx = idx + 1;
            const kContent = String(k?.content || '(空内容)');
            const kMsgCount = Number(k?.messageCount) || 0;
            const kStyle = k?.style || 'concise';
            const kGenAt = k?.generatedAt ? new Date(k.generatedAt).toLocaleString('zh-CN', { hour12: false }) : '';
            const kActive = k?.asPrompt?.active !== false;
            const kActiveBadge = kActive
                ? `<span class="pm-kchain-item__badge pm-kchain-item__badge--on">启用</span>`
                : `<span class="pm-kchain-item__badge pm-kchain-item__badge--off">停用</span>`;
            return `
                <div class="pm-kchain-item ${kActive ? '' : 'is-disabled'}">
                    <div class="pm-kchain-item__head">
                        <div class="pm-kchain-item__title">
                            <span class="pm-kchain-item__tag">K${kLevel}-${kIdx}</span>
                            <span class="pm-kchain-item__count">${kMsgCount} 条 · ${escapeHtml(kStyle)}</span>
                            ${kActiveBadge}
                        </div>
                        <div class="pm-kchain-item__time">${escapeHtml(kGenAt)}</div>
                    </div>
                    <div class="pm-kchain-item__body">${escapeHtml(kContent)}</div>
                </div>`;
        }).join('');
    })();
    // ★ 双面板(互斥):点 summary → 显示 text-panel(实际拼接到上下文的内容);
    //   点小眼睛 → 显示 preview-panel(K 组全部 K 原文,实时)
    //   - 跟 renderAppPromptItem 同样的 .pm-app-prompt-views 容器 + data-active 状态机
    //   - data-active 不存在或 === 'text' → text-panel
    //   - data-active === 'preview' → preview-panel
    const extraBody = `
        <div class="pm-app-prompt-views pm-kchain-views"
             data-prompt-id="${escapeHtml('k-chain::' + aiPersonId)}">
            <div class="pm-app-prompt-panel pm-app-prompt-text-panel pm-kchain-text-panel"
                data-panel="text">
                ${hasContent
                    ? `<div class="pm-item-content">${escapeHtml(text)}</div>`
                    : `<div class="pm-kchain-text-empty">${escapeHtml(textForPanel)}</div>`}
            </div>
            <div class="pm-app-prompt-panel pm-app-prompt-preview-panel pm-kchain-preview-panel"
                data-panel="preview">
                <div class="pm-kchain-preview-head">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <span>K 组内容 · ${kCount} 条</span>
                </div>
                <div class="pm-kchain-list">${kListHtml}</div>
            </div>
        </div>`;
    // title 显示 K 数量(让用户一眼看到 K 组进度)
    const titleWithCount = kCount > 0 ? `K 链摘要（${kCount}）` : 'K 链摘要';
    return renderPromptControlCard({
        promptId: 'k-chain',
        title: titleWithCount,
        fullContent: textForPanel,
        dataKind: 'k-chain',
        extraClass: hasContent ? 'pm-item--kchain' : 'pm-item--kchain pm-item--kchain-empty',
        actionsHtml,
        extraBody,
        skipDefaultContent: true, // content 由 extraBody 内的视图容器管理
    });
}

/**
 * 渲染「当前聊天回合」item（murmur 组内）
 *   - 实时计算的内容
 *   - 开关控制是否注入到上下文
 *   - ★ v0.61.7 复用 .pm-item 主结构(对齐当前用户人设)
 */
function renderContextRoundsGroupItem({ text, aiPersonId, active = true }) {
    const fullContent = escapeHtml(text);
    const isActive = active;
    const actionPayload = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'toggleContextRoundsActive',
        payload: { aiPersonId },
    });
    const actionsHtml = `
        <div class="pm-segmented-tabs" data-prompt-id="context-rounds">
            <button type="button" class="pm-segmented-tab ${isActive ? '' : 'is-active'}"
                data-app-action='${escapeHtml(actionPayload)}'
                data-target="close">关闭</button>
            <button type="button" class="pm-segmented-tab ${isActive ? 'is-active' : ''}"
                data-app-action='${escapeHtml(actionPayload)}'
                data-target="enable">启用</button>
        </div>`;
    return renderPromptControlCard({
        promptId: 'context-rounds',
        title: '当前聊天回合',
        fullContent,
        dataKind: 'context-rounds',
        actionsHtml,
    });
}

/**
 * ★ v0.62.x 渲染「回复格式与聊天风格」item（murmur 组内）
 *   - 同款 UI:跟「当前聊天回合」一致(.pm-card .pm-item .pm-item--control .pm-item--in-available)
 *   - 内容:从 prompt-builder 导出 SPECIAL_ACTIONS_HELP + REPLY_STYLE_INSTRUCTIONS 拼接
 *   - 启停 toggle 走 method: toggleReplyFormatActive
 *   - 状态: app.state.chat.replyFormatInject[aiPersonId](默认 true)
 *   - 关闭时 prompt-builder 不注入这段;开启时注入到 systemPrompt 末尾
 */
function renderReplyFormatInstructionsGroupItem({ aiPersonId, active = true }) {
    const fullContent = escapeHtml([SPECIAL_ACTIONS_HELP, REPLY_STYLE_INSTRUCTIONS].join('\n\n'));
    const isActive = active;
    const actionPayload = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'toggleReplyFormatActive',
        payload: { aiPersonId },
    });
    const actionsHtml = `
        <div class="pm-segmented-tabs" data-prompt-id="reply-format">
            <button type="button" class="pm-segmented-tab ${isActive ? '' : 'is-active'}"
                data-app-action='${escapeHtml(actionPayload)}'
                data-target="close">关闭</button>
            <button type="button" class="pm-segmented-tab ${isActive ? 'is-active' : ''}"
                data-app-action='${escapeHtml(actionPayload)}'
                data-target="enable">启用</button>
        </div>`;
    return renderPromptControlCard({
        promptId: 'reply-format',
        title: '回复格式与聊天风格',
        fullContent,
        dataKind: 'reply-format',
        actionsHtml,
    });
}

/**
 * ★ v0.66 渲染「记忆概要」虚拟系统级卡(murmur 组内)
 *   - 数据源:sdk.memorySummaries.list(aiPersonId) — 全部 L1~L4 未删概要
 *   - 启停 toggle 走 method: toggleMemorySummaryInject
 *   - 状态:app.state.chat.memorySummaryInject[aiPersonId](默认 true)
 *   - 关闭 → prompt-builder 不调用 sdk.memorySummaries.buildMemoryContext()
 *   - 删除按钮:从 card 里移除(实际是 sdk.memorySummaries.remove = 软删)
 *     跟 replyPrompts 行为一致:删除只是从 murmur 折叠区消失 + 数据库标 deleted=true
 *   - 顺序:跟其他 replyPrompt 同级,contextOrder 持久化时按 id
 */
function renderMemorySummaryGroupItem({ aiPersonId, summary, active = true }) {
    const isActive = active;
    const content = String(summary.content || '').trim();
    const fullContent = escapeHtml(content || '(空概要内容)');
    const preview = content.length > 120 ? content.slice(0, 120) + '…' : content;
    // ★ 概要 id 是真实 sdk.memorySummaries 记录的 id(summary.id),不是 'memory-summary' 这种虚拟 id
    const actionPayload = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'toggleMemorySummaryInject',
        payload: { aiPersonId, summaryId: summary.id },
    });
    const deletePayload = JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method: 'deleteMemorySummaryFromMurmur',
        payload: { aiPersonId, summaryId: summary.id },
    });
    const actionsHtml = `
        <button type="button" class="pm-chip pm-chip--delete"
            data-app-action='${escapeHtml(deletePayload)}'
            title="删除(从 murmur 移除并软删)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
        </button>
        <div class="pm-segmented-tabs" data-prompt-id="${escapeHtml(summary.id)}">
            <button type="button" class="pm-segmented-tab ${isActive ? '' : 'is-active'}"
                data-app-action='${escapeHtml(actionPayload)}'
                data-target="close">关闭</button>
            <button type="button" class="pm-segmented-tab ${isActive ? 'is-active' : ''}"
                data-app-action='${escapeHtml(actionPayload)}'
                data-target="enable">启用</button>
        </div>`;
    // ★ dataKind 用 'memory-summary-{level}' 区分层级
    return renderPromptControlCard({
        promptId: summary.id,
        title: `记忆概要 · ${summary.title || '未命名'}`,
        fullContent,
        dataKind: `memory-summary-${summary.storageLevel || 'L1'}`,
        extraClass: 'pm-item--memory-summary',
        actionsHtml,
    });
}

/**
 * 渲染按 App 分组的折叠列表（可用 Prompt 区域）
 * @param {object} ctx 包含所有需要渲染的分组数据
 *   - systemPrompts: nook 系统 prompt（用户人设 + AI 人设）
 *   - worldPrompt: 世界观 prompt（可选）
 *   - contextRoundsText: 当前聊天回合文本
 *   - contextRoundsActive: 当前聊天回合是否启用
 *   - appPromptsList: 第三方 App Prompt 列表
 *   - injectMap: 系统 prompt 注入开关
 *   - aiPersonId: AI 人设 ID
 * @returns {string}
 */
function renderAppPromptGroupSection(ctx) {
    const {
        systemPrompts = [],
        worldPrompt = null,
        contextRoundsText = '',
        contextRoundsActive = true,
        replyFormatInjectAvailable = true, // ★ v0.62.x 新增(「回复格式与聊天风格」启用状态)
        // ★ v0.63 新增：K 链摘要(仅在聊天设置→K 链开关开启时显示)
        kChainText = '',
        // ★ v0.63.2 kChainVisible = 总开关(只决定 murmur 折叠区是否显示 K 链卡)
        //   kChainActive (传进来) = kChainInjected(总开关 && 个人 toggle),卡上 toggle 反映这个
        kChainVisible = true,
        kChainActive = true,
        appPromptsList = [],
        injectMap = {},
        aiPersonId = '',
        // ★ v0.61.8.9 从 prompt 库拉过来的 user prompt(默认 active=false)→ 进 nook 组
        pulledFromLibrary = [],
        // ★ v0.64 「AI 表情包库」状态 — 必须从 renderPromptManagerPage 透传进来,
        //   跨函数不能直接读上层闭包变量(否则 ReferenceError: stickerLibraryInjectAvailable is not defined)
        stickerLibraryInjectAvailable = true,
        stickerCount = 0,
        // ★ v0.66 「记忆概要」列表(murmur 组内的虚拟系统级卡)
        memorySummariesList = [],
        // ★ v0.66.x 记忆概要 injectMap(用于计算 active 视觉状态,
        //   全集进 murmur,但 toggle 高亮跟 user 关停同步)
        memorySummaryInjectMap = {},
    } = ctx;

    // 收集所有分组
    const groups = [];

    // 1. nook 组：当前用户人设 + 当前 AI 人设 + 世界观 + 从库拉取过来的 user prompt
    const nookItems = [...systemPrompts];
    if (worldPrompt) nookItems.push(worldPrompt);
    // ★ v0.61.8.9 拉过来的 user prompt 也放 nook 组,作为「开关卡」展示
    pulledFromLibrary.forEach((p) => {
        if (p && p.id) {
            nookItems.push({
                id: p.id,
                title: p.title || '来自 Prompt 库',
                content: p.content || '',
                // 标记这是 user-from-library,渲染时走 renderPromptControlPromptItem
                _isUserLibraryPrompt: true,
                _userLibraryPrompt: p,
            });
        }
    });
    // ★ v0.64 「AI 表情包库」也归 nook 组 — 数据语义是「AI 资源」,跟人设/世界观同级
    nookItems.push({
        id: 'sticker-library',
        title: 'AI 表情包库',
        // 占位 content — 真实长文本由 prompt-builder 注入到 systemPrompt,这张卡只展示开关状态
        content: stickerLibraryInjectAvailable
            ? `# AI 表情包库（共 ${stickerCount} 个图组）\n\n告诉 AI 它可以发送哪些表情包。关闭后 AI 完全不知道有哪些表情,也不会自己瞎编。`
            : `# AI 表情包库（已停用）\n\n当前不告诉 AI 任何表情包信息。`,
        _isStickerLibrary: true,
        _stickerCount: stickerCount,
        _stickerActive: stickerLibraryInjectAvailable,
    });
    if (nookItems.length > 0) {
        groups.push({
            source: 'nook',
            items: nookItems,
            renderItem: (item) => {
                if (item._isStickerLibrary) {
                    return renderStickerLibraryControlItem({
                        aiPersonId,
                        stickerCount: item._stickerCount,
                        isActive: item._stickerActive,
                    });
                }
                if (item._isUserLibraryPrompt) {
                    return renderPromptControlPromptItem(item._userLibraryPrompt, aiPersonId);
                }
                return renderSystemPromptControlItem(item, aiPersonId, injectMap);
            },
        });
    }

    // 2. murmur 组：当前聊天回合 + K 链摘要(★ v0.63) + 回复格式与聊天风格(★ v0.62.x) + 记忆概要(★ v0.66)
    //   - 多张同款卡(.pm-card .pm-item .pm-item--control .pm-item--in-available)
    //   - 第一张:实时计算的聊天回合(注入 prompt-builder 的「当前聊天回合」段)
    //   - 第二张:K 链摘要(★ v0.63.2 始终显示,只要 K 链总开关开启;K 组空时显示「等待 K0」占位)
    //   - 第三张:回复格式 + 短句风格(注入 prompt-builder 末尾,默认启用)
    //   - ★ v0.66 第四张往后:每条「记忆概要」一张虚拟卡(L1~L4 未删)
    //   - 顺序固定:聊天回合 → K 链 → 风格 → 记忆概要(按 generatedAt 倒序)
    //   - ★ v0.63.2 murmur 组显示条件:contextRounds / kChainVisible(只看总开关) / replyFormat / memorySummaries 四个任一就显示
    if (contextRoundsText || kChainVisible || replyFormatInjectAvailable || (Array.isArray(memorySummariesList) && memorySummariesList.length > 0)) {
        const items = [];
        // 第一张:当前聊天回合(只在实时计算文本非空时出现)
        if (contextRoundsText) {
            items.push({
                id: 'context-rounds',
                title: '当前聊天回合',
                content: contextRoundsText,
                active: contextRoundsActive,
                _isContextRounds: true,
            });
        }
        // 第二张:★ v0.63.2 K 链摘要(Murmur 折叠区可见性只跟总开关 kChainVisible 有关)
        //   - 用户原话:「K 链的启用并不影响 K 链卡片停留在 murmur 折叠区」
        //     → Murmur 折叠区可见性只看 kChainVisible(总开关),个人 toggle 不能让卡片从 murmur 消失
        //   - 个人 toggle(kChainActive)控制两件事:
        //       ① 卡上 segmented-tabs 的高亮状态(关闭 / 启用 哪个亮)
        //       ② K 链卡是否进入「当前上下文」区(见 §3.5 的 if (kChainActive) push)
        if (kChainVisible) {
            items.push({
                id: 'k-chain',
                title: 'K 链摘要',
                content: kChainText || '', // 空字符串,renderKChainGroupItem 里走占位文案
                active: kChainActive,     // ★ v0.63.2 卡上 segmented-tabs 反映 kChainActive
                _isKChain: true,
            });
        }
        // 第三张:回复格式 + 短句风格(总是显示,无前置条件)
        items.push({
            id: 'reply-format',
            title: '回复格式与聊天风格',
            content: '', // 内容是 prompt-builder 的 SPECIAL_ACTIONS_HELP + REPLY_STYLE_INSTRUCTIONS,renderItem 里直接拼接
            active: replyFormatInjectAvailable, // 总是显示,active 状态由 toggle 控制
            _isReplyFormat: true,
        });
        // ★ v0.66 第四张往后:每条「记忆概要」一张虚拟卡
        //   - 顺序:按 generatedAt 倒序(新的在前)
        //   - 每条卡带 _isMemorySummary + 真实 summary 对象
        //   - active 字段:用 memorySummaryInjectMap[aiPersonId][summaryId] 计算(默认 true = 启用),
        //     跟 §33「nook 组全集」对齐 — 关闭的卡片仍展示在 murmur,只是 toggle 高亮切到「关闭」
        if (Array.isArray(memorySummariesList)) {
            const aiInjectMap = memorySummaryInjectMap?.[aiPersonId] || {};
            memorySummariesList.forEach((s) => {
                if (!s || !s.id) return;
                const isInjected = aiInjectMap[s.id] !== false;
                items.push({
                    id: s.id,
                    title: `记忆概要 · ${s.title || '未命名'}`,
                    content: String(s.content || '').trim(),
                    active: isInjected,
                    _isMemorySummary: true,
                    _memorySummary: s,
                });
            });
        }
        groups.push({
            source: 'murmur',
            items,
            renderItem: (item) => {
                if (item._isReplyFormat) {
                    return renderReplyFormatInstructionsGroupItem({ aiPersonId, active: item.active });
                }
                if (item._isKChain) {
                    return renderKChainGroupItem({ text: item.content, aiPersonId, active: item.active });
                }
                if (item._isMemorySummary) {
                    return renderMemorySummaryGroupItem({ aiPersonId, summary: item._memorySummary, active: item.active });
                }
                return renderContextRoundsGroupItem({ text: item.content, aiPersonId, active: item.active });
            },
        });
    }

    // 3. 第三方 App Prompt（按 appId 分组）
    const appPromptsByApp = {};
    for (const p of appPromptsList) {
        const appId = p.appId || 'other';
        if (!appPromptsByApp[appId]) appPromptsByApp[appId] = [];
        appPromptsByApp[appId].push(p);
    }
    for (const [appId, items] of Object.entries(appPromptsByApp)) {
        groups.push({
            source: appId,
            items,
            renderItem: (item) => renderAppPromptItem(item),
        });
    }

    if (groups.length === 0) {
        return `<div class="pm-empty">
            <div class="pm-empty-title">暂无可用 Prompt</div>
            <div class="pm-empty-desc">启动音乐/天气等 App 后会自动注册 Prompts</div>
        </div>`;
    }

    // 按优先级排序
    const groupOrder = ['nook', 'murmur', 'chat', 'music', 'weather', 'focus', 'gallery'];
    groups.sort((a, b) => {
        const ai = groupOrder.indexOf(a.source);
        const bi = groupOrder.indexOf(b.source);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.source.localeCompare(b.source);
    });

    const groupHtmls = groups.map((group) => {
        const info = getAppGroupInfo(group.source);
        const count = group.items.length;
        const activeCount = group.items.filter(p => p.active !== false).length;
        const itemsHtml = group.items.map((p, i) => group.renderItem(p, i, group.items.length)).join('');

        return `
            <details class="pm-app-group" data-source="${escapeHtml(group.source)}" open>
                <summary class="pm-app-group__summary">
                    <div class="pm-app-group__header">
                        <div class="pm-app-group__text">
                            <span class="pm-app-group__name">${escapeHtml(info.name)}</span>
                            <span class="pm-app-group__desc">${escapeHtml(info.desc || '')}</span>
                        </div>
                    </div>
                    <span class="pm-app-group__count">${activeCount}/${count}</span>
                    <svg class="pm-app-group__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </summary>
                <div class="pm-app-group__body">
                    ${itemsHtml}
                </div>
            </details>
        `;
    });

    return `<div class="pm-app-group-list">${groupHtmls.join('')}</div>`;
}

// ============================================================
// ★ v0.61.5 第三方 App Prompt 子组（注册 SDK 数据驱动）
//   - 读 sdk.appPrompts.list() 拿所有注册条目
//   - 每条带 [音乐]/[天气] app 标签 + previewType 标签 + 启停 toggle + 编辑 + 预览 + 删除
//   - 删除走 framework 顶层确认弹窗 + sdk.appPrompts.removeState（保留注册表）
//   - 编辑复用 EditReplyPromptModal
// ============================================================

/**
 * 单条 App Prompt 渲染（复用 .pm-item 主结构，对齐当前用户人设）
 * @param {object} prompt  sdk.appPrompts.list() 返回的单条
 * @returns {string}
 */
function renderAppPromptItem(prompt) {
    const appId = String(prompt?.appId || '');
    const promptId = String(prompt?.promptId || '');
    const label = String(prompt?.label || promptId || '未命名');
    const previewType = String(prompt?.previewType || 'text');
    const isActive = prompt?.active !== false;
    const contentPreview = escapeHtml(previewText(prompt?.content || '(空内容)', 120));
    const cardPreviewHtml = renderAppPromptCardPreview({
        previewType,
        previewData: prompt?.customPreviewData || prompt?.previewData,
        label,
    });
    const actionPayload = (method, extra = {}) => JSON.stringify({
        action: 'appMethod',
        appId: 'chat',
        method,
        payload: { appId, promptId, ...extra },
    });
    const actionsHtml = `
        <button type="button" class="pm-chip pm-chip--preview"
            data-app-action='${escapeHtml(actionPayload('previewAppPrompt'))}'
            data-prompt-id="${escapeHtml(appId + '::' + promptId)}"
            title="预览卡片">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
        </button>
        <button type="button" class="pm-chip pm-chip--edit"
            data-app-action='${escapeHtml(actionPayload('openEditAppPromptModal'))}'
            title="编辑">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>
            </svg>
        </button>
        <div class="pm-segmented-tabs pm-segmented-tabs--app" data-prompt-id="${escapeHtml(promptId)}">
            <button type="button" class="pm-segmented-tab ${isActive ? '' : 'is-active'}"
                data-app-action='${escapeHtml(actionPayload('toggleAppPromptActive'))}'
                data-target="close">关闭</button>
            <button type="button" class="pm-segmented-tab ${isActive ? 'is-active' : ''}"
                data-app-action='${escapeHtml(actionPayload('toggleAppPromptActive'))}'
                data-target="enable">启用</button>
        </div>`;
    // ★ v0.61.8.4 两套独立视图(基于用户 8/8 反馈「互斥」原则)
    //   - 数据容器拆成两个 data-panel:
    //     · pm-app-prompt-text-panel:点 summary(卡片本身)显示 → 只显示正文
    //     · pm-app-prompt-preview-panel:点小眼睛显示 → 显示预览卡片 + 编辑器
    //   - 两个 panel 互斥显示:
    //     · 点 summary → details 展开(text-panel 出现,preview-panel 强制隐藏)
    //     · 点小眼睛  → text-panel 强制隐藏,preview-panel 显示,且 details 也展开
    //     · 两个面板的状态机完全独立
    //   - 默认 details 不开,两个 panel 都隐藏
    const previewPayload = escapeHtml(actionPayload('previewAppPrompt'));
    const currentPreviewData = prompt?.customPreviewData || prompt?.previewData || {};
    const originalPreviewData = prompt?.previewData || {};
    const previewTypeLabelMap = {
        'music-card': '音乐卡片',
        'red-packet-card': '红包卡片',
        'location-card': '位置卡片',
        'text': '文本',
    };
    const typeLabel = previewTypeLabelMap[previewType] || '卡片';
    // ★ v0.61.8.4 extraBody 用两套独立 panel(互斥显示)
    //   - pm-app-prompt-text-panel    : summary 展开时显示,只显示正文
    //   - pm-app-prompt-preview-panel : 小眼睛触发时显示,显示预览卡片 + 编辑器
    //   - 容器仍带 data-prompt-id 供 method 精确定位
    // ★ v0.61.8.5 component-island 在 chat-app detail 渲染时未生效(framework 扫描时机问题),
    //   直接内联编辑器 DOM(textarea + 3 个 SVG 按钮),交互全部走 data-app-action
    //   - textarea 实时 input 由 chat-app/index.js 模块层 _initAppPromptPreviewInputObserver 监听
    //   - 实时把 CSS 注入到 <style> 标签,覆盖默认 .pm-preview-card 样式(用户改 CSS → 卡片实时变化)
    //   - 按钮点击 → framework 顶层 click 委托 → appMethod action
    //   - 复制按钮走 method,navigator.clipboard
    // ★ v0.61.8.6 textarea 内容是 CSS 字符串(不是 JSON),保存后实时影响预览卡片样式
    //   - 用户改 CSS → 卡片实时变化(所见即所得)
    //   - 保存到 localStorage(不依赖 SDK,简单直接)
    //   - 复原按钮把 CSS 重置为 defaultCardCss
    const previewDataJson = JSON.stringify(currentPreviewData || {}, null, 2); // 保留变量,后续可能用于兼容
    const originalDataJson = JSON.stringify(originalPreviewData || {}, null, 2);
    const defaultCardCss = getDefaultCardCss(previewType);
    // 读取已保存的 CSS 覆盖(localStorage),没有则用默认 CSS
    const savedCss = loadSavedCardCss(appId, promptId);
    const initialCardCss = savedCss || defaultCardCss;
    // ★ data-* 标记(input 委托靠它找到正确的 card)
    const cardSelector = `pm-app-prompt-views[data-prompt-id="${escapeHtml(appId + '::' + promptId)}"]`;
    // ★ 复制按钮额外走一个独立 method:appPromptCopyPreview(由 module 层 input 委托响应时调)
    //   - 这里不复制到剪贴板(避免 inline addEventListener),剪贴板动作放到 chat-app/index.js
    //     的方法里;此处的 data-app-action 只触发 method 通知
    const extraBody = `
        <div class="pm-app-prompt-views"
             data-prompt-id="${escapeHtml(appId + '::' + promptId)}">
            <div class="pm-app-prompt-panel pm-app-prompt-text-panel"
                data-panel="text">
                <div class="pm-item-content">${escapeHtml(contentPreview || '')}</div>
            </div>
            <div class="pm-app-prompt-panel pm-app-prompt-preview-panel"
                data-panel="preview">
                <div class="pm-special-card-preview"
                     data-preview-card="${escapeHtml(appId + '::' + promptId)}">${cardPreviewHtml}</div>
                <div class="pm-app-prompt-editor-wrap"
                    data-editor-prompt-id="${escapeHtml(promptId)}"
                    data-editor-app-id="${escapeHtml(appId)}"
                    data-preview-type="${escapeHtml(previewType)}"
                    data-label="${escapeHtml(label)}"
                    data-original-preview-data='${escapeHtml(originalDataJson)}'
                    data-default-card-css='${escapeHtml(defaultCardCss)}'>
                    <div class="pm-app-prompt-editor-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        <span>预览 / 编辑${escapeHtml(typeLabel)}</span>
                    </div>
                    <div class="app-prompt-preview-island-static">
                        <div class="app-prompt-preview-field">
                            <label class="app-prompt-preview-label">
                                <span>${escapeHtml(typeLabel)}样式(CSS)</span>
                            </label>
                            <textarea
                                class="app-prompt-preview-textarea"
                                data-app-prompt-textarea="${escapeHtml(appId + '::' + promptId)}"
                                data-initial-value='${escapeHtml(initialCardCss)}'
                                spellcheck="false"
                                rows="10">${escapeHtml(initialCardCss)}</textarea>
                        </div>
                        <div class="app-prompt-preview-actions">
                            <button type="button" class="app-prompt-preview-btn app-prompt-preview-btn--secondary"
                                title="复制 CSS"
                                data-app-action='${escapeHtml(actionPayload('appPromptCopyJson', { appId, promptId }))}'>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                            </button>
                            <button type="button" class="app-prompt-preview-btn app-prompt-preview-btn--secondary"
                                title="复原"
                                data-app-action='${escapeHtml(actionPayload('appPromptRestore', { appId, promptId }))}'>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 12a9 9 0 1 0 3-6.7"/>
                                    <polyline points="3 4 3 10 9 10"/>
                                </svg>
                            </button>
                            <button type="button" class="app-prompt-preview-btn app-prompt-preview-btn--primary"
                                title="保存"
                                data-app-action='${escapeHtml(actionPayload('appPromptSave', { appId, promptId }))}'>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                    <polyline points="17 21 17 13 7 13 7 21"/>
                                    <polyline points="7 3 7 8 15 8"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    return renderPromptControlCard({
        promptId,
        title: label,
        fullContent: contentPreview,
        extraClass: 'pm-item--app-prompt',
        actionsHtml,
        extraBody,
        skipDefaultContent: true, // ★ v0.61.8.2 content 由 extraBody 内的视图容器管理
    });
}

export default renderPromptManagerPage;
