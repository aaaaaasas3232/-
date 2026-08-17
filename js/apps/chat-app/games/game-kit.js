/**
 * 群聊小游戏 / 给上传玩法用的工具箱
 *
 * 上传的玩法是**运行时** `import(blobURL)` 加载的：没有构建、没有 importmap，
 * 任何 `import './core/clock.js'` 都会抛「Failed to resolve module specifier」。
 * 所以内置玩法能直接 import 的那些东西，在这里统一挂到
 * `window.__chatGameKit` 上给它们用。
 *
 * 提示词生成器（game-prompt.js）里列的 API 清单必须和这里一致 ——
 * 少列一个，AI 就会自己发明一个不存在的函数名。
 */

import { scheduleStep, awaitUser, clearPending, withBusy, runNow } from './core/clock.js';
import { askAi, cleanSpeech, parseTarget, parseJson, splitLines, resolveGameApiRef } from './core/ai.js';
import {
    addLog, addEvent, setPhase, notifyTurn, settleSession, endSession,
    describeRoster, describeRecentSpeech, describeSelf,
} from './core/engine.js';
import {
    getPlayer, alivePlayers, aliveExcept, userPlayer, isUserPlaying,
    shuffle, pickRandom, USER_PLAYER_ID,
} from './core/players.js';
import { updateSession, getSession } from './core/store.js';
import { SESSION_STATUS, TIMING } from './core/constants.js';
import { escapeHtml } from '@/src/core/escape.js';
import * as ui from './components/ui.js';
import { seatStrip, seatGrid, targetPicker } from './components/seat-strip.js';
import { renderFeed, renderEntry } from './components/log-feed.js';
import { resultPanel, roleCard, voteBoard } from './components/result-panel.js';
import { phaseBar } from './components/game-shell.js';

/**
 * 工具箱。字段一旦发布就别改名 —— 用户存着的玩法代码是照这个写的。
 */
export const gameKit = Object.freeze({
    // ── 流程 ────────────────────────────────
    /** 排下一步。**不要用 setTimeout** —— 那是闭包，切出界面就断。 */
    schedule: scheduleStep,
    /** 把球交给用户，等他点按钮。不设超时（他可能去别的 App 聊二十分钟）。 */
    awaitUser,
    clearPending,
    /** 包一段异步活儿：自动加 busy 锁 + 超时自愈 */
    withBusy,
    /** 立刻跑某一步（重试用） */
    runNow,

    // ── AI ──────────────────────────────────
    askAi,
    resolveGameApiRef,
    cleanSpeech,
    parseTarget,
    parseJson,
    splitLines,

    // ── 对局状态 ────────────────────────────
    addLog,
    addEvent,
    setPhase,
    notifyTurn,
    /** 分出胜负，但先停在结算屏（用户点「完成」才写战绩） */
    settle: settleSession,
    endGame: endSession,
    updateSession,
    getSession,

    // ── 玩家 ────────────────────────────────
    getPlayer,
    alivePlayers,
    aliveExcept,
    userPlayer,
    isUserPlaying,
    shuffle,
    pickRandom,
    USER_PLAYER_ID,

    // ── 给 AI 看的上下文 ────────────────────
    describeRoster,
    describeRecentSpeech,
    describeSelf,

    // ── 界面 ────────────────────────────────
    // ui.act / ui.button / ui.panel / ui.textInput / ui.thinking …
    // 加上座位条、日志流、结算面板这三块大件
    ui: Object.freeze({
        ...ui,
        seatStrip, seatGrid, targetPicker,
        renderFeed, renderEntry,
        resultPanel, roleCard, voteBoard,
        phaseBar,
    }),
    escapeHtml,

    // ── 常量 ────────────────────────────────
    SESSION_STATUS,
    TIMING,
});

if (typeof window !== 'undefined') {
    window.__chatGameKit = gameKit;
}

export default gameKit;
