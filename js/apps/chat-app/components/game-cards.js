/**
 * chat-app / 战绩卡片消息
 *
 * 一局打完之后往群聊里落的那张卡（`msg.type === 'game_record'`）。
 *
 * ★ 原型这条链是断的：大富翁写了 `renderMonopolyRecordCard`，
 *   但**全文件没有任何地方产生 `msg.gameRecord`** —— 渲染器是个孤儿。
 *   狼人杀和卧底虽然会写记录，但新的 `message-renderer` 里没有登记
 *   `game_record` 这个类型，所以即便写进去了也画不出来（只会
 *   `console.warn: Unknown message type`）。
 *
 *   这次三处一起接上（写入侧 / 注册表 / 渲染器），
 *   少一处就是静默失效（AGENTS2 §5.1）。
 */

import { escapeHtml } from '@/src/core/escape.js';
import { createActionAttr } from '@/src/core/actions.js';

const OUTCOME_LABEL = {
    win: '你赢了',
    lose: '你输了',
    watch: '你在旁观',
};

/**
 * 群聊里的战绩卡。
 *
 * 居中卡片形态（跟通话记录、拍一拍同一族），不带头像 ——
 * 它是「这个群里发生了一件事」，不是某个人说的话。
 */
export function renderGameRecordBubble(msg, contact = {}, options = {}) {
    const r = msg?.gameRecord;
    if (!r) return '';

    const me = (r.players || []).find((p) => p.isUser);
    const outcome = r.godMode ? 'watch' : (me ? (me.win ? 'win' : 'lose') : 'watch');

    const roster = (r.players || []).slice(0, 12).map((p) => `
        <span class="game-record-card__player${p.win ? ' is-win' : ''}${p.isUser ? ' is-me' : ''}">
            <b>${escapeHtml(p.name || '')}</b>${p.roleLabel ? `<i>${escapeHtml(p.roleLabel)}</i>` : ''}
        </span>
    `).join('');

    const openAction = createActionAttr({
        action: 'appMethod',
        appId: 'chat',
        method: 'openGameRecordDetail',
        payload: { messageId: msg.id || '' },
    }, 'chat');

    return `
        <div class="message-wrapper game-record-wrapper" data-message-id="${escapeHtml(msg.id || '')}">
            <div class="game-record-card" data-tone="${escapeHtml(r.tone || 'blue')}" data-outcome="${escapeHtml(outcome)}" ${openAction}>
                <div class="game-record-card__head">
                    <span class="game-record-card__game">${escapeHtml(r.gameName || '小游戏')}</span>
                    <span class="game-record-card__outcome">${escapeHtml(OUTCOME_LABEL[outcome] || '')}</span>
                </div>
                <div class="game-record-card__title">${escapeHtml(r.winnerLabel || '对局结束')}</div>
                ${r.summary ? `<div class="game-record-card__summary">${escapeHtml(r.summary)}</div>` : ''}
                <div class="game-record-card__roster">${roster}</div>
                <div class="game-record-card__meta">
                    <span>${escapeHtml(String(r.rounds || 0))} 轮</span>
                    <span>${escapeHtml(String(Math.max(1, Math.round((r.durationMs || 0) / 60000))))} 分钟</span>
                    <span>${escapeHtml(String((r.players || []).length))} 人</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * 战绩详情页。
 *
 * ⚠️ 必须自己画返回按钮：chat-app 全局把框架的 `.app-detail-header` 藏掉了
 *    （`_chat-private.css` 第 16 行），不自绘的话这一页出不去。
 */
export function renderGameRecordDetail(record) {
    const back = createActionAttr({ action: 'appMethod', appId: 'chat', method: 'closeDetail' }, 'chat');
    const backBtn = `
        <button type="button" class="cg-recorddetail__back" aria-label="返回" ${back}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6" />
            </svg>
        </button>
    `;
    if (!record) {
        return `<div class="cg-recorddetail">${backBtn}<div class="cg-empty"><div class="cg-empty__text">这条战绩已经不在了</div></div></div>`;
    }
    const roster = (record.players || []).map((p) => `
        <div class="cg-result__row${p.win ? ' is-win' : ''}${p.isUser ? ' is-me' : ''}">
            <div class="cg-result__who">
                <div class="cg-result__name">${escapeHtml(p.name || '')}${p.seat ? `<span class="cg-result__seat">${escapeHtml(String(p.seat))}号</span>` : ''}</div>
                ${p.word ? `<div class="cg-result__word">词：${escapeHtml(p.word)}</div>` : ''}
            </div>
            ${p.roleLabel ? `<span class="cg-result__role">${escapeHtml(p.roleLabel)}</span>` : ''}
            <span class="cg-result__flag">${p.win ? '胜' : '负'}</span>
        </div>
    `).join('');

    return `
        <div class="cg-recorddetail">
            ${backBtn}
            <div class="cg-recorddetail__head" data-tone="${escapeHtml(record.tone || 'blue')}">
                <div class="cg-recorddetail__game">${escapeHtml(record.gameName || '')}</div>
                <div class="cg-recorddetail__title">${escapeHtml(record.winnerLabel || '对局结束')}</div>
                ${record.summary ? `<div class="cg-recorddetail__summary">${escapeHtml(record.summary)}</div>` : ''}
            </div>
            ${record.highlights?.length ? `
                <div class="cg-recorddetail__highlights">
                    ${record.highlights.map((h) => `<div>${escapeHtml(h)}</div>`).join('')}
                </div>` : ''}
            <div class="cg-result__roster">${roster}</div>
        </div>
    `;
}
