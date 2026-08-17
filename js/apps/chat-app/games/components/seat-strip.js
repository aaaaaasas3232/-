/**
 * 群聊小游戏 / 座位组件
 *
 * 三个游戏对「一排玩家」的需求其实是同一个，只是显示的副标题不一样：
 *   狼人杀 —— 座位号 + 存活 + （上帝视角下）身份
 *   谁是卧底 —— 座位号 + 存活 + 当前发言人高亮
 *   大富翁 —— 名次 + 现金 + 当前回合高亮
 *
 * 所以只做一个组件，副标题由调用方传一个函数进来。
 *
 * ★ 原型三处各写了一遍座位列表，其中狼人杀那份压根没有座位图
 *   （身份只在「游戏信息」弹窗的纯文本列表里），谁是卧底那份是横滑条，
 *   大富翁那份是棋盘格里的小圆点。抽成一个之后，狼人杀白捡了座位条。
 */

import { escapeHtml, avatar, act } from './ui.js';

/**
 * 横向座位条。
 *
 * @param {Array}  players
 * @param {object} o
 * @param {string} [o.activeId]      高亮谁（当前发言 / 当前回合）
 * @param {string[]} [o.selectedIds] 已选中（连情侣这种多选场景）
 * @param {string} [o.method]        点一下调哪个 method（不传则不可点）
 * @param {object} [o.payload]       附加 payload，会并上 { playerId }
 * @param {(p)=>string} [o.sub]      副标题
 * @param {(p)=>string} [o.badge]    右上角角标
 * @param {(p)=>boolean} [o.disabled]
 * @param {number} [o.size=44]
 */
export function seatStrip(players = [], o = {}) {
    const {
        activeId = '', selectedIds = [], method = '', payload = null,
        sub = null, badge = null, disabled = null, size = 44,
    } = o;
    if (!players.length) return '';

    const items = players.map((p) => seatItem(p, {
        active: p.id === activeId,
        selected: selectedIds.includes(p.id),
        method,
        payload,
        sub,
        badge,
        disabled,
        size,
    }));
    return `<div class="cg-seats" data-cg-region-part="seats">${items.join('')}</div>`;
}

/** 网格版（人多的时候比横滑好用，比如 12 人局的投票）。 */
export function seatGrid(players = [], o = {}) {
    if (!players.length) return '';
    const items = players.map((p) => seatItem(p, {
        active: p.id === o.activeId,
        selected: (o.selectedIds || []).includes(p.id),
        method: o.method || '',
        payload: o.payload || null,
        sub: o.sub || null,
        badge: o.badge || null,
        disabled: o.disabled || null,
        size: o.size || 46,
    }));
    return `<div class="cg-seatgrid">${items.join('')}</div>`;
}

function seatItem(p, o) {
    const isDisabled = typeof o.disabled === 'function' ? !!o.disabled(p) : false;
    const clickable = !!o.method && !isDisabled;
    const action = clickable
        ? act(o.method, { ...(o.payload || {}), playerId: p.id })
        : '';
    const subText = typeof o.sub === 'function' ? (o.sub(p) || '') : '';
    const badgeText = typeof o.badge === 'function' ? (o.badge(p) || '') : '';

    const cls = [
        'cg-seat',
        p.alive === false ? 'is-out' : '',
        o.active ? 'is-active' : '',
        o.selected ? 'is-selected' : '',
        clickable ? 'is-clickable' : '',
        isDisabled ? 'is-disabled' : '',
        p.isUser ? 'is-me' : '',
    ].filter(Boolean).join(' ');

    return `
        <div class="${cls}" data-player-id="${escapeHtml(p.id)}" ${action}>
            <div class="cg-seat__av">
                ${avatar(p, o.size)}
                ${p.alive === false ? '<span class="cg-seat__out" aria-hidden="true"></span>' : ''}
                ${badgeText ? `<span class="cg-seat__badge">${escapeHtml(badgeText)}</span>` : ''}
                ${p.seat ? `<span class="cg-seat__no">${escapeHtml(String(p.seat))}</span>` : ''}
            </div>
            <div class="cg-seat__name">${escapeHtml(p.name || '')}</div>
            ${subText ? `<div class="cg-seat__sub">${escapeHtml(subText)}</div>` : ''}
        </div>
    `;
}

/**
 * 目标选择器：一句提示 + 一排可点的人。
 *
 * 夜里刀人、查验、守护、投票、开枪全是这一个形态 ——
 * 原型给这五件事各写了一份几乎一样的 HTML。
 */
export function targetPicker({
    title = '', hint = '', players = [], method = '', payload = null,
    selectedIds = [], sub = null, disabled = null, footer = '',
} = {}) {
    return `
        <div class="cg-picker">
            ${title ? `<div class="cg-picker__title">${escapeHtml(title)}</div>` : ''}
            ${hint ? `<div class="cg-picker__hint">${escapeHtml(hint)}</div>` : ''}
            ${seatGrid(players, { method, payload, selectedIds, sub, disabled })}
            ${footer ? `<div class="cg-picker__foot">${footer}</div>` : ''}
        </div>
    `;
}
