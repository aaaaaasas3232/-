/**
 * 群聊小游戏 / 注册表
 *
 * 加一个新游戏 = 在这里加一行。三个玩法必须实现同一组接口：
 *
 *   setup(session)                     发牌 / 铺棋盘，并排出第一步
 *   runStep(session, step, payload)    步骤执行器（给调度器用）
 *   handleUserAction(session, a, p)    用户操作入口
 *   buildView(session)                 → { tone, title, subtitle, right, head, action, viewerId }
 *   buildResult(session)               → 结算屏 HTML
 *
 * ★ 原型的 `GameCore.games` 只是一张卡片元数据表，真正的逻辑全挂在
 *   `ChatApp.prototype` 上，三个游戏各自定义了三十多个方法名互不相干
 *   （`openWerewolfSetup` / `openUndercoverSetup` / `openMonopolySetup`…）。
 *   于是「游戏大厅点一张卡」这件事在 chat.js 里是一串写死的 if。
 *   收成接口之后，chat-app 侧只认这五个函数，不认识任何具体玩法。
 */

import { GAME_IDS, GAME_META } from './core/constants.js';
import { registerRunner } from './core/clock.js';
import { getCustomGame, listCustomGameMetas } from './custom-games.js';
// 上传的玩法从 window.__chatGameKit 取依赖，import 一下让它挂上去
import './game-kit.js';

import * as werewolfEngine from './werewolf/engine.js';
import * as werewolfView from './werewolf/view.js';
import * as undercoverEngine from './undercover/engine.js';
import * as undercoverView from './undercover/view.js';
import * as monopolyEngine from './monopoly/engine.js';
import * as monopolyView from './monopoly/view.js';

const GAMES = {
    [GAME_IDS.WEREWOLF]: {
        meta: GAME_META[GAME_IDS.WEREWOLF],
        setup: werewolfEngine.setup,
        runStep: werewolfEngine.runStep,
        handleUserAction: werewolfEngine.handleUserAction,
        buildView: werewolfView.buildView,
        buildResult: werewolfView.buildResult,
        /** 战绩里额外记的字段（排行榜细项）。 */
        statFields: (p) => ({
            [p.team === 'wolf' ? 'wolfGames' : 'villageGames']: 1,
            [p.team === 'wolf' ? 'wolfWins' : 'villageWins']: p.win ? 1 : 0,
            survived: p.alive ? 1 : 0,
        }),
    },
    [GAME_IDS.UNDERCOVER]: {
        meta: GAME_META[GAME_IDS.UNDERCOVER],
        setup: undercoverEngine.setup,
        runStep: undercoverEngine.runStep,
        handleUserAction: undercoverEngine.handleUserAction,
        buildView: undercoverView.buildView,
        buildResult: undercoverView.buildResult,
        statFields: (p) => ({
            [p.role === 'undercover' ? 'spyGames' : 'civilGames']: 1,
            [p.role === 'undercover' ? 'spyWins' : 'civilWins']: p.win ? 1 : 0,
            survived: p.alive ? 1 : 0,
        }),
    },
    [GAME_IDS.MONOPOLY]: {
        meta: GAME_META[GAME_IDS.MONOPOLY],
        setup: monopolyEngine.setup,
        runStep: monopolyEngine.runStep,
        handleUserAction: monopolyEngine.handleUserAction,
        buildView: monopolyView.buildView,
        buildResult: monopolyView.buildResult,
        statFields: (p) => ({ bankrupt: p.bankrupt ? 1 : 0 }),
    },
};

// 注册到调度器。模块加载时跑一次就够了。
for (const [id, game] of Object.entries(GAMES)) {
    registerRunner(id, { runStep: game.runStep });
}

/**
 * 内置三个 + 用户上传的。
 * 上传的玩法走 custom-games.js 装进来，接口和内置的完全一样 ——
 * chat-app 侧不需要知道一个游戏是内置还是上传的。
 */
export function getGame(gameId) {
    return GAMES[gameId] || getCustomGame(gameId) || null;
}

export function listGames() {
    return [...Object.values(GAMES).map((g) => g.meta), ...listCustomGameMetas()];
}

/** 某个游戏是不是用户自己装的（大厅上要标一下，也才给删除入口） */
export function isCustomGame(gameId) {
    return !GAMES[gameId] && !!getCustomGame(gameId);
}

export { GAME_IDS, GAME_META };
