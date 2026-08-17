/**
 * 小奇怪 · 棋类 AI 座位(扫雷 / 五子棋共用)
 *
 * ── 分工 ──────────────────────────────────────────────────────────
 *
 *   引擎(minesweeper-engine / gomoku-engine)   规则、判定、本地棋手
 *   本文件                                       给模型拼 prompt、抠坐标、兜底
 *   组件                                         什么时候该轮到 AI(watch → tick)
 *
 * ── 铁律(AGENTS.md §7)────────────────────────────────────────────
 *
 *   JS 判胜负;AI 只回坐标;解析失败不掐局 —— 回落到引擎的本地棋手。
 *   所以这里的返回值永远是一个**合法**的格子,调用方不需要再兜。
 *
 * ── 台词 ──────────────────────────────────────────────────────────
 *
 *   坐标和台词在同一次请求里要(`{"x":..,"y":..,"line":".."}`),
 *   不为台词单独多花一次调用。人设、世界观、自定义提示词都进 system,
 *   让 AI 的嘴像 nook 里那个人。
 */

import { asArray, parseLooseJson, truncate } from '../utils.js';
import * as nook from './nook-bridge.js';
import * as ai from './ai-service.js';
import * as ms from './minesweeper-engine.js';
import * as go from './gomoku-engine.js';

// ============================================================
// 共用的 system 头
// ============================================================

function personaBlock(aiCard, seatName) {
    const detail = nook.describeAi(aiCard);
    const parts = [`你在一台手机上和用户面对面玩游戏,你扮演「${seatName || 'AI'}」。`];
    if (detail) parts.push(detail);
    const world = nook.getWorld('', nook.getPlayerCard(''));
    const worldText = nook.describeWorld(world);
    if (worldText) parts.push(worldText);
    return parts.join('\n');
}

function customBlock(customPrompts) {
    const list = asArray(customPrompts).filter((p) => p.enabled && String(p.content || '').trim());
    if (!list.length) return '';
    return `玩家的自定义提示词:\n${list.map((p) => (p.title ? `【${p.title}】${p.content.trim()}` : p.content.trim())).join('\n')}`;
}

const LINE_RULE = '- line 是你落子时说的一句话,15 字以内,用你自己的口吻。可以调侃、可以嘴硬,不要复述规则,不要提「AI」「模型」。';

// ============================================================
// 扫雷
// ============================================================

/**
 * 让 AI 座位扫一格。
 *
 * @param {object} opts { state, seat:{name,aiId,order}, customPrompts, signal }
 * @returns {Promise<{ index:number, line:string, source:'model'|'local' }>}
 *   index 一定合法;没有可扫格子时 index = -1。
 */
export async function minesweeperMove({ state, seat, customPrompts, signal } = {}) {
    const fallback = () => ({
        index: ms.pickSmartCell(state),
        line: ms.localLine(false),
        source: 'local',
    });

    const aiCard = seat?.aiId ? nook.getAi(seat.aiId) : null;
    const apiRef = nook.resolveApiRefFor(aiCard, seat?.order || 1);
    if (!apiRef) return fallback();

    const system = [
        personaBlock(aiCard, seat?.name),
        `你们在玩「双人计分扫雷」:9×9 的盘里藏 10 颗雷,轮流选一格翻开。
没碰到雷 +1 分,碰到雷 -5 分;数字表示周围八格的雷数;安全格全部翻完后分高者胜。
盘面符号:. 没翻开 / F 旗子(有人怀疑有雷) / 数字 已翻开 / * 被踩出来的雷。`,
        customBlock(customPrompts),
        `输出格式:只输出一个 JSON 对象,不要围栏、不要解释:
{"x": 列号, "y": 行号, "line": "一句话"}
- x 和 y 都从 1 开始,必须选**没翻开且没插旗**的格子
- 先看数字推理哪些格子安全,拿不准就挑风险小的
${LINE_RULE}`,
    ].filter(Boolean).join('\n\n');

    const user = `当前盘面:\n${ms.boardText(state)}\n\n比分:你 ${state.scores[state.turn] || 0} 分。轮到你扫了,只输出 JSON。`;

    const res = await ai.generate({
        apiRef,
        systemPrompt: system,
        userTurn: user,
        temperature: 0.6,
        signal,
    });

    if (!res.ok) return fallback();
    const data = parseLooseJson(res.text);
    const col = Number(data?.x) - 1;
    const row = Number(data?.y) - 1;
    const line = truncate(String(data?.line || ''), 30);

    if (Number.isInteger(row) && Number.isInteger(col)
        && row >= 0 && row < ms.ROWS && col >= 0 && col < ms.COLS) {
        const cell = state.cells[ms.indexOf(row, col)];
        if (cell && !cell.revealed && !cell.flag) {
            return { index: cell.index, line, source: 'model' };
        }
    }
    // 模型选了不合法的格子 —— 落回本地棋手,但嘴还是它的嘴
    const local = fallback();
    return { ...local, line: line || local.line };
}

// ============================================================
// 五子棋
// ============================================================

/**
 * 让 AI 座位落一子。
 * @param {object} opts { state, seat:{name,aiId,order,stone}, customPrompts, signal }
 * @returns {Promise<{ index:number, line:string, source:'model'|'local' }>}
 */
export async function gomokuMove({ state, seat, customPrompts, signal } = {}) {
    const stone = seat?.stone || state.turn;
    const fallback = () => ({
        index: go.pickSmartCell(state, stone),
        line: go.localLine(),
        source: 'local',
    });

    const aiCard = seat?.aiId ? nook.getAi(seat.aiId) : null;
    const apiRef = nook.resolveApiRefFor(aiCard, seat?.order || 1);
    if (!apiRef) return fallback();

    const mySymbol = stone === 'black' ? 'X(黑)' : 'O(白)';
    const system = [
        personaBlock(aiCard, seat?.name),
        `你们在下五子棋:15×15,横竖斜任意方向先连成五子者胜,没有禁手。
盘面符号:. 空 / X 黑 / O 白。你执 ${mySymbol}。`,
        customBlock(customPrompts),
        `输出格式:只输出一个 JSON 对象,不要围栏、不要解释:
{"x": 列号, "y": 行号, "line": "一句话"}
- x 和 y 都从 1 开始,必须选**空**的交叉点
- 优先级:自己能连五 > 堵对面的四 > 做自己的活三活四 > 堵对面的活三
${LINE_RULE}`,
    ].filter(Boolean).join('\n\n');

    const user = `当前棋盘:\n${go.boardText(state)}\n\n已下 ${state.moveCount} 手,轮到你(${mySymbol})。只输出 JSON。`;

    const res = await ai.generate({
        apiRef,
        systemPrompt: system,
        userTurn: user,
        temperature: 0.5,
        signal,
    });

    if (!res.ok) return fallback();
    const data = parseLooseJson(res.text);
    const col = Number(data?.x) - 1;
    const row = Number(data?.y) - 1;
    const line = truncate(String(data?.line || ''), 30);

    if (Number.isInteger(row) && Number.isInteger(col)
        && row >= 0 && row < go.SIZE && col >= 0 && col < go.SIZE) {
        const index = go.indexOf(row, col);
        if (!state.board[index]) {
            return { index, line, source: 'model' };
        }
    }
    const local = fallback();
    return { ...local, line: line || local.line };
}

/** 有没有可用 API(组件用来标「本地模式」) */
export function hasUsableApi() {
    return nook.listApiRefs().length > 0;
}
