/**
 * 群聊小游戏 / 结算面板
 *
 * 三个游戏的结算长得不一样，但结构一样：
 * 一行大字说谁赢了 → 一句话概述 → 玩家清单（揭身份）→ 几个按钮。
 *
 * ★ 原型的结算有个共同毛病：**身份是最后才揭的，但揭得很随便** ——
 *   狼人杀塞在一条系统消息里、卧底只在结束时发一条文本、大富翁根本没有结算。
 *   一局打了十几分钟，最想看的就是这一屏，值得单独做。
 */

import { escapeHtml, avatar, button, buttonRow } from './ui.js';

/**
 * @param {object} o
 * @param {string} o.title       「好人阵营获胜」
 * @param {string} o.summary     一句话
 * @param {'win'|'lose'|'draw'} o.outcome  从**用户视角**看的结果，决定配色
 * @param {Array}  o.players     带 role/roleLabel/word/win
 * @param {Array}  [o.stats]     [{k, v}] 额外数据
 * @param {Array}  [o.actions]   按钮
 */
export function resultPanel({
    title = '', summary = '', outcome = 'draw',
    players = [], stats = [], actions = [],
} = {}) {
    const roster = players.map((p) => `
        <div class="cg-result__row${p.win ? ' is-win' : ''}${p.isUser ? ' is-me' : ''}">
            ${avatar(p, 34)}
            <div class="cg-result__who">
                <div class="cg-result__name">${escapeHtml(p.name || '')}${p.seat ? `<span class="cg-result__seat">${escapeHtml(String(p.seat))}号</span>` : ''}</div>
                ${p.word ? `<div class="cg-result__word">词：${escapeHtml(p.word)}</div>` : ''}
            </div>
            ${p.roleLabel ? `<span class="cg-result__role" data-role="${escapeHtml(p.role || '')}">${escapeHtml(p.roleLabel)}</span>` : ''}
            <span class="cg-result__flag">${p.win ? '胜' : '负'}</span>
        </div>
    `).join('');

    const statRow = stats.length
        ? `<div class="cg-result__stats">${stats.map((s) => `
            <div class="cg-result__stat"><b>${escapeHtml(String(s.v ?? ''))}</b><span>${escapeHtml(s.k || '')}</span></div>
        `).join('')}</div>`
        : '';

    return `
        <div class="cg-result" data-outcome="${escapeHtml(outcome)}">
            <div class="cg-result__head">
                <div class="cg-result__title">${escapeHtml(title)}</div>
                ${summary ? `<div class="cg-result__summary">${escapeHtml(summary)}</div>` : ''}
            </div>
            ${statRow}
            <div class="cg-result__roster">${roster}</div>
            ${actions.length ? buttonRow(actions) : ''}
        </div>
    `;
}

/**
 * 身份卡：我是谁、我要干什么。
 *
 * 狼人杀开局和卧底发词都用它。原型里这两处是完全不同的两套 DOM，
 * 但它们表达的是同一件事 ——「只有你看得到的那张牌」。
 */
export function roleCard({
    label = '', name = '', desc = '', tone = '', extra = '', hidden = false,
} = {}) {
    if (hidden) {
        return `
            <div class="cg-rolecard is-hidden">
                <div class="cg-rolecard__label">上帝视角</div>
                <div class="cg-rolecard__name">你在旁观这一局</div>
                <div class="cg-rolecard__desc">所有人的身份和暗话你都看得到</div>
            </div>
        `;
    }
    return `
        <div class="cg-rolecard"${tone ? ` data-tone="${escapeHtml(tone)}"` : ''}>
            <div class="cg-rolecard__label">${escapeHtml(label)}</div>
            <div class="cg-rolecard__name">${escapeHtml(name)}</div>
            ${desc ? `<div class="cg-rolecard__desc">${escapeHtml(desc)}</div>` : ''}
            ${extra ? `<div class="cg-rolecard__extra">${extra}</div>` : ''}
        </div>
    `;
}

/**
 * 票型。
 *
 * @param {Array} rows [{ target:{name,seat}, voters:[{name}], count }]
 */
export function voteBoard(rows = [], opts = {}) {
    if (!rows.length) return '';
    const max = Math.max(...rows.map((r) => r.count || 0), 1);
    return `
        <div class="cg-votes">
            ${rows.map((r) => `
                <div class="cg-votes__row${r.out ? ' is-out' : ''}">
                    <span class="cg-votes__name">${escapeHtml(r.target?.name || '弃票')}</span>
                    <span class="cg-votes__bar"><i style="width:${Math.round(((r.count || 0) / max) * 100)}%"></i></span>
                    <span class="cg-votes__count">${escapeHtml(String(r.count || 0))}</span>
                </div>
                ${opts.showVoters !== false && r.voters?.length
                    ? `<div class="cg-votes__voters">${escapeHtml(r.voters.map((v) => v.name).join('、'))}</div>`
                    : ''}
            `).join('')}
        </div>
    `;
}

export { button, buttonRow };
