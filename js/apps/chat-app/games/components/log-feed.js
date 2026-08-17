/**
 * 群聊小游戏 / 消息流
 *
 * 对局里发生的一切都往这里流：阶段分隔、系统播报、玩家发言、唱票、结算。
 *
 * ★ 这个组件是**增量渲染**的，跟本项目其他 HTML 字符串组件不太一样。
 *   原因：一局狼人杀会有两三百条，每次状态变化都整块重画有两个问题 ——
 *   滚动位置会跳，以及正在播的入场动画会重来一遍。
 *   所以 `patchFeed()` 按 `data-log-id` 只补新增的那几条。
 *
 *   整块重画的路径仍然保留（`renderFeed`），框架重画详情页时走它 ——
 *   两条路径产出的 HTML 必须一致，所以单条渲染只有 `renderEntry` 一个实现。
 */

import { escapeHtml, avatar } from './ui.js';

/**
 * 这一条该不该给当前观看者看。
 *
 * 狼人夜话、女巫的心理活动这类 `secret` 条目：
 *   - 上帝视角：全看得见
 *   - 玩家视角：只看得见跟自己有关的那些
 */
function visible(entry, session, viewerId) {
    if (!entry.secret) return true;
    if (session.godMode) return true;
    if (!viewerId) return false;
    const audience = entry.data?.audience;
    if (Array.isArray(audience)) return audience.includes(viewerId);
    return entry.playerId === viewerId;
}

/** 整块渲染（框架重画详情页时走这条）。 */
export function renderFeed(session, opts = {}) {
    const viewerId = opts.viewerId || '';
    const list = (session.log || []).filter((e) => visible(e, session, viewerId));
    if (!list.length) {
        return `<div class="cg-feed__list" data-cg-feed="1"></div>`;
    }
    return `<div class="cg-feed__list" data-cg-feed="1">${list.map((e) => renderEntry(e, session, opts)).join('')}</div>`;
}

/**
 * 增量补丁。
 *
 * @param {HTMLElement} feedEl `.cg-feed__list`
 * @returns {boolean} 有没有真的加东西（调用方据此决定要不要滚到底）
 */
export function patchFeed(feedEl, session, opts = {}) {
    if (!feedEl) return false;
    const viewerId = opts.viewerId || '';
    const have = new Set();
    for (const el of feedEl.children) {
        const id = el.getAttribute('data-log-id');
        if (id) have.add(id);
    }
    const missing = (session.log || [])
        .filter((e) => visible(e, session, viewerId))
        .filter((e) => !have.has(e.id));
    if (!missing.length) return false;

    // 一次性拼好再插入：逐条 insertAdjacentHTML 在补几十条时会触发几十次重排
    const html = missing.map((e) => renderEntry(e, session, opts)).join('');
    feedEl.insertAdjacentHTML('beforeend', html);

    // 上限跟 store 里的一致，避免 DOM 无限长
    while (feedEl.children.length > 400) feedEl.removeChild(feedEl.firstChild);
    return true;
}

/**
 * 单条。
 *
 * 五种形态两套骨架：
 *   居中条（phase / system / result）和 气泡（speech / narrate）。
 *   视觉不同 ≠ 结构不同（AGENTS2 §13.6.3）。
 */
export function renderEntry(entry, session, opts = {}) {
    const base = `data-log-id="${escapeHtml(entry.id)}"`;

    if (entry.kind === 'phase') {
        return `<div class="cg-line is-phase" ${base}><span>${escapeHtml(entry.text)}</span></div>`;
    }
    if (entry.kind === 'result') {
        return `<div class="cg-line is-result" ${base}><span>${escapeHtml(entry.text)}</span></div>`;
    }
    if (entry.kind === 'system' || entry.kind === 'action' || entry.kind === 'vote') {
        const tone = entry.tone ? ` data-tone="${escapeHtml(entry.tone)}"` : '';
        return `<div class="cg-line is-system"${tone} ${base}><span>${escapeHtml(entry.text)}</span></div>`;
    }

    // 气泡
    const player = (session.players || []).find((p) => p.id === entry.playerId);
    const isMe = !!player?.isUser;
    const cls = [
        'cg-bubble',
        isMe ? 'is-me' : 'is-other',
        entry.kind === 'narrate' ? 'is-narrate' : '',
        entry.secret ? 'is-secret' : '',
    ].filter(Boolean).join(' ');

    const nameLine = entry.kind === 'narrate'
        ? (entry.playerName ? `${entry.playerName}（心理）` : '旁白')
        : (entry.playerName || '');

    return `
        <div class="${cls}" ${base}>
            ${!isMe && player ? `<div class="cg-bubble__av">${avatar(player, 30)}</div>` : ''}
            <div class="cg-bubble__main">
                ${nameLine ? `<div class="cg-bubble__name">${escapeHtml(nameLine)}${player?.seat ? ` · ${player.seat}号` : ''}</div>` : ''}
                <div class="cg-bubble__text">${escapeHtml(entry.text)}</div>
            </div>
            ${isMe && player ? `<div class="cg-bubble__av">${avatar(player, 30)}</div>` : ''}
        </div>
    `;
}
