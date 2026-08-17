/**
 * 群聊小游戏 / 对外唯一出口
 *
 * chat-app 只 import 这一个文件。它负责：
 *   - 启动调度器（模块加载时就跑，跟界面无关）
 *   - 开局 / 用户操作 / 结束 / 放弃
 *   - 把对局页渲染成 HTML
 *
 * ★ 「切出游戏界面不会断」这件事的完整链路在这里可以一眼看全：
 *     startClock()        —— 模块级 ticker，跟 DOM 无关
 *     loadSessions()      —— 刷新页面也能把对局捡回来
 *     引擎只写 store       —— 界面在不在都能往下走
 *     live-view 只订阅     —— 界面回来时按当前状态重画
 *   四条缺一条这个需求就不成立。
 */

import { startClock, runNow } from './core/clock.js';
import {
    loadSessions, getSession, getLiveSession, updateSession,
    dropSession, flushSessions, listLiveSessions,
} from './core/store.js';
import {
    createSession, startSession, endSession, abortSession, markSeen,
} from './core/engine.js';
import { buildRoster, checkPlayerCount, listCandidates, USER_PLAYER_ID } from './core/players.js';
import { postGameRecord, recordResult, buildLeaderboard, loadStats } from './core/record.js';
import { listAvailableApis } from './core/ai.js';
import { getGame, listGames, isCustomGame, GAME_IDS, GAME_META } from './registry.js';
import {
    installAndPersistGame, removeCustomGame, restoreCustomGames,
    listCustomGames, validateGameCode, downloadGameJs,
} from './custom-games.js';
import { buildGamePrompt, buildSampleGameCode, createDefaultGameAnswers, slugifyGameId, GAME_FLOW_PRESETS, GAME_WIN_PRESETS } from './game-prompt.js';
import { generateWordPair } from './undercover/engine.js';
import { renderGameShell } from './components/game-shell.js';
// live-view 模块顶层会装 MutationObserver 和回车监听（import 即生效）
import { refreshGameView, readGameInput, clearGameInput } from './live-view.js';
import { SESSION_STATUS } from './core/constants.js';

// 调度器在模块加载时就起来 —— 用户可能上次退出时留了一局在跑
loadSessions();
startClock();

// 用户上传过的玩法在这里装回来。异步的，不 await ——
// 大厅列表是每次渲染现读 listGames()，装好之后自然就出现了。
void restoreCustomGames();

// ---------------------------------------------------------------------------
// 开局
// ---------------------------------------------------------------------------

/**
 * @param {object} opts
 * @param {string} opts.gameId
 * @param {string} opts.groupId
 * @param {string[]} opts.aiIds
 * @param {boolean} opts.userPlays
 * @param {object} [opts.apiRef]
 * @param {object} [opts.setup]
 * @returns {{ok:boolean, session?:object, error?:string}}
 */
export function startGame({ gameId, groupId, aiIds = [], userPlays = true, apiRef = null, setup = {} }) {
    const game = getGame(gameId);
    if (!game) return { ok: false, error: '没有这个游戏' };

    const players = buildRoster({ groupId, aiIds, userPlays });
    // 上传的玩法人数限制在它自己的 meta 里
    const check = checkPlayerCount(gameId, players.length, game.meta);
    if (!check.ok) return { ok: false, error: check.reason };

    // AI 至少要有一个，否则「多人游戏」只剩自己
    if (!players.some((p) => !p.isUser)) return { ok: false, error: '至少要选一个群成员一起玩' };

    const session = createSession({
        gameId, groupId, players,
        godMode: !userPlays,
        apiRef,
        setup,
    });
    game.setup(session);
    startSession(session);
    return { ok: true, session };
}

/** 这个群现在有没有在打的局。 */
export function getRunningGame(groupId) {
    return getLiveSession(groupId);
}

/** 全局有没有在打的局（消息列表页上挂个小红点用）。 */
export function listRunningGames() {
    return listLiveSessions();
}

// ---------------------------------------------------------------------------
// 用户操作
// ---------------------------------------------------------------------------

/**
 * 用户点了操作区里的某个按钮。
 *
 * `text` 字段特殊处理：输入框里的内容不在 payload 里（`data-app-action`
 * 是渲染时就写死的字符串，读不到用户后来打的字），所以在这里现读。
 */
export async function submitUserAction(groupId, payload = {}) {
    const session = getSession(groupId);
    if (!session || session.status !== SESSION_STATUS.RUNNING) return;
    const game = getGame(session.gameId);
    if (!game) return;

    const action = payload.action || '';
    const finalPayload = { ...payload };
    if (needsText(action, payload)) {
        finalPayload.text = readGameInput();
        clearGameInput();
    }
    await game.handleUserAction(session, action, finalPayload);
}

/** 哪些动作要现读输入框。payload 里已经明确给了 text 的（比如「过」）不读。 */
function needsText(action, payload) {
    if (typeof payload.text === 'string') return false;
    return ['speech', 'last_words', 'describe', 'discuss', 'review_chat'].includes(action)
        && payload.go !== 'vote';
}

/** 多选（丘比特连情侣）。选中状态只是界面态，跟着 session 存但不影响规则。 */
export function togglePlayerSelection(groupId, playerId, max = 2) {
    updateSession(groupId, (s) => {
        const cur = Array.isArray(s.uiSelection) ? [...s.uiSelection] : [];
        const at = cur.indexOf(playerId);
        if (at >= 0) cur.splice(at, 1);
        else {
            cur.push(playerId);
            while (cur.length > max) cur.shift();
        }
        s.uiSelection = cur;
    });
}

/** 女巫面板在「用药」和「选毒谁」两屏之间切。 */
export function setWitchMode(groupId, mode) {
    updateSession(groupId, (s) => { s.uiWitchMode = mode || ''; });
}

/** 出错之后重试那一步。 */
export function retryStep(groupId) {
    const session = getSession(groupId);
    if (!session?.error) return;
    const step = session.error.step;
    updateSession(groupId, (s) => { s.error = null; });
    if (step) runNow(groupId, step, null);
}

// ---------------------------------------------------------------------------
// 收尾
// ---------------------------------------------------------------------------

/**
 * 正常结束：写战绩卡 + 记排行榜。
 *
 * ★ 只有走到这里的对局才进战绩。原型的「退出」也会记一笔，
 *   于是排行榜里全是没打完的局（见 core/record.js 顶部说明）。
 */
export async function finishGame(groupId) {
    const session = getSession(groupId);
    if (!session) return null;
    const game = getGame(session.gameId);

    endSession(session, session.winner, session.result?.summary || '');
    updateSession(groupId, () => {});
    flushSessions();

    try {
        recordResult(session, game?.statFields);
    } catch (err) {
        console.warn('[chat-games] 记录战绩失败', err);
    }
    try {
        await postGameRecord(session);
    } catch (err) {
        console.warn('[chat-games] 写战绩卡失败', err);
    }
    return session;
}

/**
 * 放弃这一局。
 *
 * 不写战绩、不发卡片。调度器立刻不再管它 ——
 * 原型这里只是关了页面，timer 和 AI 回调还在后台把这局打完
 * 并继续烧 API 额度。
 */
export function abortGame(groupId) {
    const session = getSession(groupId);
    if (!session) return;
    abortSession(session);
    updateSession(groupId, () => {});
    dropSession(groupId);
}

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

/**
 * 对局页 HTML（chat-app 的 renderDetailPage 调它）。
 *
 * 已经结束的对局显示结算屏；进行中的显示对局界面。
 */
export function renderGamePage(groupId) {
    const session = getSession(groupId);
    if (!session) {
        return `<div class="cg-page cg-page--empty"><div class="cg-empty"><div class="cg-empty__text">这一局已经不在了</div></div></div>`;
    }
    const game = getGame(session.gameId);
    if (!game) return '';

    if (session.status === SESSION_STATUS.ENDED) {
        return `
            <div class="cg-page" data-cg-game="${session.gameId}" data-cg-tone="${GAME_META[session.gameId]?.tone || 'blue'}">
                <div class="cg-body cg-body--result">${game.buildResult(session)}</div>
            </div>
        `;
    }

    let view;
    try {
        view = game.buildView(session);
    } catch (err) {
        console.error('[chat-games] 渲染对局页失败', err);
        return `<div class="cg-page cg-page--empty"><div class="cg-empty"><div class="cg-empty__text">这一局画不出来</div><div class="cg-empty__sub">${String(err?.message || '')}</div></div></div>`;
    }
    return renderGameShell(session, view);
}

/**
 * 让 AI 出一对词（谁是卧底的可选开局路径）。
 *
 * 挂在这里而不是让调用方去 import `undercover/engine.js` ——
 * chat-app 只认这一个出口，不该知道有哪些玩法文件。
 */
export async function prepareUndercoverWords(apiRef, groupId, wordType) {
    return generateWordPair({ apiRef, groupId }, wordType);
}

export {
    // 数据
    listCandidates, listAvailableApis, listGames, buildLeaderboard, loadStats,
    getSession, markSeen, refreshGameView, flushSessions,
    GAME_IDS, GAME_META, USER_PLAYER_ID,
    // 自己做的游戏
    isCustomGame, listCustomGames, installAndPersistGame, removeCustomGame,
    validateGameCode, downloadGameJs,
    buildGamePrompt, buildSampleGameCode, createDefaultGameAnswers, slugifyGameId,
    GAME_FLOW_PRESETS, GAME_WIN_PRESETS,
};
