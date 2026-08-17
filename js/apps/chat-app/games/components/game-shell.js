/**
 * 群聊小游戏 / 对局页骨架
 *
 * 三个游戏共用同一副骨架，各自只填四个区域：
 *
 *   ┌─ cg-topbar ─────────────┐  返回 / 标题 / 右上角
 *   ├─ region:head ───────────┤  阶段条、身份卡、座位条、棋盘、骰子
 *   ├─ region:feed ───────────┤  消息流（唯一会滚的地方）
 *   ├─ region:action ─────────┤  当前该干什么
 *   └─────────────────────────┘
 *
 * ★ 为什么要划「区域」
 *   界面是订阅 store 重画的，而对局里状态变化非常频繁（一局几百次）。
 *   整页重画会有三个后果：消息流滚回顶部、输入框里打了一半的字没了、
 *   骰子动画重头再来。
 *   划成四块之后，`live-view.js` 只替换**字符串真的变了**的那一块，
 *   上面三件事自然就不会发生了。
 *
 *   区域内部一律**无状态**（除了 feed 是增量追加、骰子自己管动画），
 *   所以「整块替换」永远是安全的 —— 这条是这套渲染方式能成立的前提。
 */

import { escapeHtml, topbar } from './ui.js';
import { renderFeed } from './log-feed.js';

/**
 * 渲染整页（框架第一次画 / 重画详情页时走这里）。
 *
 * @param {object} session
 * @param {object} view  各游戏的 view 模块产出：{ title, subtitle, right, head, action }
 */
export function renderGameShell(session, view = {}) {
    const viewerId = view.viewerId || '';
    return `
        <div class="cg-page" data-cg-game="${escapeHtml(session.gameId)}"
             data-cg-group="${escapeHtml(session.groupId)}"
             data-cg-tone="${escapeHtml(view.tone || 'blue')}"
             data-cg-status="${escapeHtml(session.status)}">
            ${topbar({ title: view.title || '', subtitle: view.subtitle || '', right: view.right || '' })}
            <div class="cg-body">
                <div class="cg-region" data-cg-region="head">${view.head || ''}</div>
                <div class="cg-region cg-feed" data-cg-region="feed">${renderFeed(session, { viewerId })}</div>
            </div>
            <div class="cg-region cg-action" data-cg-region="action">${view.action || ''}</div>
        </div>
    `;
}

/**
 * 只算区域内容（订阅重画时走这里）。
 * 跟 `renderGameShell` 用的是同一批函数，所以两条路径不可能画出不一样的东西。
 */
export function renderRegions(session, view = {}) {
    return {
        head: view.head || '',
        action: view.action || '',
        // feed 走增量，这里不产出字符串（见 log-feed.patchFeed）
    };
}

/**
 * 阶段条：第几轮 / 现在什么阶段 / 还剩几个人。
 * 三个游戏的顶部信息其实是同一个形状，只有第三格的文案不同。
 */
export function phaseBar({ round = 0, phase = '', extra = '', tone = '' } = {}) {
    return `
        <div class="cg-phasebar"${tone ? ` data-tone="${escapeHtml(tone)}"` : ''}>
            ${round ? `<span class="cg-phasebar__round">第 ${escapeHtml(String(round))} 轮</span>` : ''}
            <span class="cg-phasebar__phase">${escapeHtml(phase)}</span>
            ${extra ? `<span class="cg-phasebar__extra">${escapeHtml(extra)}</span>` : ''}
        </div>
    `;
}

/**
 * 出错横幅。
 *
 * ★ 原型出错时只 `console.warn`，界面上什么都不显示 ——
 *   用户看到的是「AI 不动了」，而「AI 不动了」有一百种可能的原因
 *   （没配 API、余额没了、网断了），第一反应绝不会是「代码抛异常了」
 *   （AGENTS2 §15.6）。所以错误必须长在用户看得见的地方，
 *   而且要给一个「再试一次」的出口。
 */
export function errorBanner(session) {
    if (!session?.error) return '';
    return `
        <div class="cg-error">
            <div class="cg-error__title">这一步没能走下去</div>
            <div class="cg-error__msg">${escapeHtml(session.error.message || '')}</div>
            <div class="cg-error__hint">多半是 API 没配好或者网络不通。可以点下面的按钮重试这一步。</div>
        </div>
    `;
}
