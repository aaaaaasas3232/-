/**
 * 群聊小游戏 / UI 原子
 *
 * 三个游戏共用的一小撮东西：动作属性、按钮、面板、头像、空态。
 *
 * 约定：
 *   - 这里的函数全是**纯函数**：state 进，HTML 字符串出，不碰 DOM
 *   - 一律 `escapeHtml`，玩家名和 AI 发言都是不可信输入
 *   - **JS 里不写颜色**。想区分视觉就给 `data-tone` / `data-kind`，
 *     具体色值在 `_chat-game.css` 里按属性选择器给
 *     （AGENTS2 §11.4 ⑦：JS 里还有 hex，换主题就是换了个寂寞）
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';

/**
 * 生成一个走 chat-app method 的动作属性。
 *
 * ⚠️ 返回的**已经是完整属性串** `data-app-action='{...}'`，
 *    模板里直接 `${act(...)}` 展开，不要再套一层 `data-app-action='...'`
 *    —— 这个坑本项目踩过两次（AGENTS2 §3.1 / §11.5）。
 */
export function act(method, payload = null) {
    return createActionAttr({
        action: 'appMethod',
        appId: 'chat',
        method,
        ...(payload ? { payload } : {}),
    }, 'chat');
}

/** 打开一个 detail 页。 */
export function detailAct(pageId) {
    return createActionAttr({ action: 'detail', appId: 'chat', pageId }, 'chat');
}

/**
 * 按钮。
 *
 * @param {object} o
 * @param {string} o.label
 * @param {string} [o.method]   点了调哪个 chat method
 * @param {object} [o.payload]
 * @param {'primary'|'ghost'|'danger'|'soft'} [o.tone='soft']
 * @param {boolean} [o.disabled]
 * @param {boolean} [o.block]   占满一行
 * @param {string} [o.icon]     内联 SVG
 * @param {string} [o.sub]      副标题（第二行小字）
 */
export function button(o = {}) {
    const {
        label = '', method = '', payload = null, tone = 'soft',
        disabled = false, block = false, icon = '', sub = '',
    } = o;
    const action = disabled || !method ? '' : act(method, payload);
    return `
        <button type="button" class="cg-btn${block ? ' is-block' : ''}" data-tone="${escapeHtml(tone)}"
                ${disabled ? 'disabled' : ''} ${action}>
            ${icon ? `<span class="cg-btn__icon">${icon}</span>` : ''}
            <span class="cg-btn__body">
                <span class="cg-btn__label">${escapeHtml(label)}</span>
                ${sub ? `<span class="cg-btn__sub">${escapeHtml(sub)}</span>` : ''}
            </span>
        </button>
    `;
}

/** 一排按钮。 */
export function buttonRow(buttons = [], opts = {}) {
    const list = buttons.filter(Boolean);
    if (!list.length) return '';
    return `<div class="cg-btn-row${opts.wrap ? ' is-wrap' : ''}">${list.map(button).join('')}</div>`;
}

/** 小标签。 */
export function chip(text, tone = '') {
    if (!text) return '';
    return `<span class="cg-chip"${tone ? ` data-tone="${escapeHtml(tone)}"` : ''}>${escapeHtml(text)}</span>`;
}

/** 面板：带标题的一块。 */
export function panel({ title = '', hint = '', body = '', tone = '', compact = false } = {}) {
    return `
        <section class="cg-panel${compact ? ' is-compact' : ''}"${tone ? ` data-tone="${escapeHtml(tone)}"` : ''}>
            ${title ? `<header class="cg-panel__head">
                <span class="cg-panel__title">${escapeHtml(title)}</span>
                ${hint ? `<span class="cg-panel__hint">${escapeHtml(hint)}</span>` : ''}
            </header>` : ''}
            <div class="cg-panel__body">${body}</div>
        </section>
    `;
}

/**
 * 头像。
 *
 * 没有图就用名字首字。底色走 `data-hue`（按 id 算一个 0-11 的槽），
 * 具体颜色在 CSS 里给 —— 这样换主题时头像色系跟着走。
 */
export function avatar(player, size = 40) {
    if (!player) return '';
    const initial = escapeHtml((player.name || '?').charAt(0));
    const hue = hueOf(player.id || player.name || '');
    const inner = player.avatar
        ? `<img src="${escapeHtml(player.avatar)}" alt="" />`
        : `<span class="cg-avatar__txt">${initial}</span>`;
    return `<span class="cg-avatar" data-hue="${hue}" style="--cg-avatar-size:${Number(size) || 40}px">${inner}</span>`;
}

/** 把任意 id 稳定映射到 12 个色槽之一。 */
export function hueOf(seed) {
    const s = String(seed || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
    return h % 12;
}

/** 空态。 */
export function empty(text, sub = '') {
    return `
        <div class="cg-empty">
            <div class="cg-empty__text">${escapeHtml(text)}</div>
            ${sub ? `<div class="cg-empty__sub">${escapeHtml(sub)}</div>` : ''}
        </div>
    `;
}

/** 一行「名字 — 值」。 */
export function keyValue(rows = []) {
    const items = rows.filter((r) => r && r.k).map((r) => `
        <div class="cg-kv__row">
            <span class="cg-kv__k">${escapeHtml(r.k)}</span>
            <span class="cg-kv__v"${r.tone ? ` data-tone="${escapeHtml(r.tone)}"` : ''}>${escapeHtml(String(r.v ?? ''))}</span>
        </div>
    `);
    if (!items.length) return '';
    return `<div class="cg-kv">${items.join('')}</div>`;
}

/**
 * 「正在思考」。
 *
 * 反馈长在用户正在看的地方，不弹岛（AGENTS2 §15.7）。
 */
export function thinking(label) {
    return `
        <div class="cg-thinking">
            <span class="cg-thinking__dots"><i></i><i></i><i></i></span>
            <span class="cg-thinking__text">${escapeHtml(label || '正在思考')}</span>
        </div>
    `;
}

/**
 * 文本输入 + 发送。
 *
 * 框架只代理 click，所以：
 *   - 发送按钮走 `data-app-action`
 *   - 回车由 `live-view.js` 里一个作用域限定在 chat shell 的 keydown 委托处理
 *
 * `data-cg-input` 是两边约定的锚点，method 靠它取值。
 */
export function textInput({
    placeholder = '', method = '', payload = null, sendLabel = '发送',
    value = '', multiline = false, maxlength = 200, disabled = false,
} = {}) {
    const action = disabled || !method ? '' : act(method, payload);
    const field = multiline
        ? `<textarea class="cg-input" data-cg-input="1" rows="2" maxlength="${Number(maxlength) || 200}"
                     placeholder="${escapeHtml(placeholder)}" ${disabled ? 'disabled' : ''}>${escapeHtml(value)}</textarea>`
        : `<input class="cg-input" data-cg-input="1" type="text" maxlength="${Number(maxlength) || 200}"
                  placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}" ${disabled ? 'disabled' : ''} />`;
    return `
        <div class="cg-inputbar" data-cg-send-method="${escapeHtml(method)}">
            ${field}
            <button type="button" class="cg-btn is-send" data-tone="primary" ${disabled ? 'disabled' : ''} ${action}>
                ${escapeHtml(sendLabel)}
            </button>
        </div>
    `;
}

/** 顶部返回条。游戏页自绘顶栏（框架顶栏关了）。 */
export function topbar({ title = '', subtitle = '', right = '' } = {}) {
    return `
        <header class="cg-topbar">
            <button type="button" class="cg-topbar__back" aria-label="返回" ${act('closeGamePage')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
            </button>
            <div class="cg-topbar__copy">
                <div class="cg-topbar__title">${escapeHtml(title)}</div>
                ${subtitle ? `<div class="cg-topbar__sub">${escapeHtml(subtitle)}</div>` : ''}
            </div>
            <div class="cg-topbar__right">${right}</div>
        </header>
    `;
}

export { escapeHtml };
