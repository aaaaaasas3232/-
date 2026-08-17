/**
 * 小奇怪 · 五子棋引擎(纯逻辑)
 *
 * ★ 不碰 DOM、不碰 store、不调 AI。API 调用在组件里,拿到坐标再喂给本文件。
 *
 * ── 和原型的关系 ──────────────────────────────────────────────────
 *
 * 玩法来自 `QAQ/小奇怪/555`(五子棋 AI 对战原型)。原型把「AI 怎么想」
 * 交给模型自由发挥、正则抠坐标,失败就整局停摆。这里按 AGENTS.md §7 的规矩:
 *
 *   **JS 判胜负;AI 只回坐标;解析失败随机(其实是启发式)合法格。**
 *
 * 所以引擎里有一个 `pickSmartCell()` 本地棋手:
 * 它同时是「没配 Key 的本地模式」和「模型回了废话」的兜底 ——
 * 两条路走的是同一个函数,不存在「兜底比正主还强 / 还弱得离谱」的错位。
 *
 * ── 规则 ──────────────────────────────────────────────────────────
 *
 *   15×15,黑先。落子无悔,五连(横 / 竖 / 两条斜)即胜,下满算平。
 *   没有禁手 —— 这是茶余饭后的一盘棋,不是段位赛。
 */

import { GO } from '../constants.js';
import { asArray, createRng } from '../utils.js';

export const SIZE = GO.size;
export const WIN_LEN = GO.winLen;

/** 四个检查方向:横、竖、撇、捺 */
const DIRS = Object.freeze([[0, 1], [1, 0], [1, 1], [1, -1]]);

export function indexOf(row, col) {
    return row * SIZE + col;
}

export function rowColOf(index) {
    return { row: Math.floor(index / SIZE), col: index % SIZE };
}

function inBoard(row, col) {
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

// ============================================================
// 建局
// ============================================================

/**
 * @param {object} opts
 * @param {Array}  [opts.players] [{ name, kind:'user'|'ai', aiId }, { ... }]
 *                 第一个执黑先手,第二个执白。
 */
export function createMatch(opts = {}) {
    const given = asArray(opts.players);
    const players = [
        {
            id: 'black',
            stone: 'black',
            name: String(given[0]?.name || '执黑'),
            kind: given[0]?.kind === 'ai' ? 'ai' : 'user',
            aiId: String(given[0]?.aiId || ''),
        },
        {
            id: 'white',
            stone: 'white',
            name: String(given[1]?.name || '执白'),
            kind: given[1]?.kind === 'ai' ? 'ai' : 'user',
            aiId: String(given[1]?.aiId || ''),
        },
    ];

    return {
        kind: 'gomoku',
        size: SIZE,
        players,
        /** 0 空 / 'black' / 'white',一维数组 */
        board: new Array(SIZE * SIZE).fill(0),
        turn: 'black',
        moveCount: 0,
        /** 最后一手(高亮用) */
        lastIndex: -1,
        /** 赢家连成的那五个点(高亮用) */
        winLine: [],
        finished: false,
        winner: '',      // 'black' | 'white' | 'draw'
        log: [],
        startedAt: Date.now(),
        finishedAt: 0,
    };
}

function pushLog(state, kind, text, playerId = '') {
    state.log.push({
        seq: state.log.length + 1,
        kind,
        playerId: String(playerId || ''),
        text: String(text || ''),
        at: Date.now(),
    });
    if (state.log.length > 240) state.log.splice(0, state.log.length - 240);
}

// ============================================================
// 查询
// ============================================================

export function getPlayer(state, playerId) {
    return asArray(state?.players).find((p) => p.id === playerId) || null;
}

export function playerName(state, playerId) {
    return getPlayer(state, playerId)?.name || (playerId === 'black' ? '执黑' : '执白');
}

export function currentPlayer(state) {
    if (!state || state.finished) return null;
    return getPlayer(state, state.turn);
}

export function otherStone(stone) {
    return stone === 'black' ? 'white' : 'black';
}

// ============================================================
// 落子
// ============================================================

/**
 * `playerId`(= 'black' | 'white')在 `index` 落一子。唯一入口。
 * @returns {{ ok:boolean, reason:string, win:boolean }}
 *   `reason`:'finished' | 'bad-cell' | 'occupied' | 'not-your-turn'
 */
export function place(state, { index, playerId } = {}) {
    if (!state || state.finished) return { ok: false, reason: 'finished', win: false };
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= SIZE * SIZE) {
        return { ok: false, reason: 'bad-cell', win: false };
    }
    if (playerId !== state.turn) return { ok: false, reason: 'not-your-turn', win: false };
    if (state.board[i]) return { ok: false, reason: 'occupied', win: false };

    state.board[i] = playerId;
    state.moveCount += 1;
    state.lastIndex = i;

    const { row, col } = rowColOf(i);
    pushLog(state, 'move', `${playerName(state, playerId)}落子 (${col + 1},${row + 1})。`, playerId);

    const line = findWinLine(state.board, i);
    if (line) {
        state.finished = true;
        state.winner = playerId;
        state.winLine = line;
        state.finishedAt = Date.now();
        pushLog(state, 'end', `${playerName(state, playerId)}五连成型,这盘是他的。`, playerId);
        return { ok: true, reason: '', win: true };
    }

    if (state.moveCount >= SIZE * SIZE) {
        state.finished = true;
        state.winner = 'draw';
        state.finishedAt = Date.now();
        pushLog(state, 'end', '下满了,谁也没连成五,平局。');
        return { ok: true, reason: '', win: false };
    }

    state.turn = otherStone(playerId);
    return { ok: true, reason: '', win: false };
}

/**
 * 以 `index` 为端点找五连。
 * 只查最后一手所在的四条线 —— 全盘扫是 O(n²),这里是 O(1)。
 * @returns {number[]|null} 连成的那(至少)五个 index
 */
export function findWinLine(board, index) {
    const stone = board[index];
    if (!stone) return null;
    const { row, col } = rowColOf(index);

    for (const [dr, dc] of DIRS) {
        const line = [index];
        // 正方向
        for (let k = 1; k < WIN_LEN; k += 1) {
            const r = row + dr * k;
            const c = col + dc * k;
            if (!inBoard(r, c) || board[indexOf(r, c)] !== stone) break;
            line.push(indexOf(r, c));
        }
        // 反方向
        for (let k = 1; k < WIN_LEN; k += 1) {
            const r = row - dr * k;
            const c = col - dc * k;
            if (!inBoard(r, c) || board[indexOf(r, c)] !== stone) break;
            line.unshift(indexOf(r, c));
        }
        if (line.length >= WIN_LEN) return line.slice(0, Math.max(WIN_LEN, line.length));
    }
    return null;
}

/** AI 台词落进日志 */
export function pushFlavor(state, playerId, line) {
    const text = String(line || '').trim();
    if (!state || !text) return;
    pushLog(state, 'flavor', `${playerName(state, playerId)}:${text}`, playerId);
}

// ============================================================
// 给 AI 的两件套
// ============================================================

/**
 * 盘面序列化(给模型看)。`.` 空 `X` 黑 `O` 白,带行列号。
 * 15×15 带坐标约 500 字符,一次请求完全塞得下。
 */
export function boardText(state) {
    const head = `   ${Array.from({ length: SIZE }, (_, i) => String(i + 1).padStart(2, ' ')).join('')}`;
    const rows = [];
    for (let r = 0; r < SIZE; r += 1) {
        const line = [];
        for (let c = 0; c < SIZE; c += 1) {
            const v = state.board[indexOf(r, c)];
            line.push(v === 'black' ? ' X' : v === 'white' ? ' O' : ' .');
        }
        rows.push(`${String(r + 1).padStart(2, ' ')} ${line.join('')}`);
    }
    return `${head}\n${rows.join('\n')}`;
}

/**
 * 本地棋手:经典打分法。
 *
 * 对每个空点,分别算「我下这儿」和「对面下这儿」两个方向的连型分,
 * 取和作为该点价值(进攻 + 防守一体),挑最高分。
 * 能成五必下,对面要成五必堵 —— 这两条从打分表的量级差里自然涌现。
 *
 * 它同时是「没配 Key」和「模型返回不合法」的兜底,必须永远给出合法格。
 */
export function pickSmartCell(state, stone, rng = Math.random) {
    const board = state.board;
    const empty = [];
    for (let i = 0; i < board.length; i += 1) {
        if (!board[i]) empty.push(i);
    }
    if (!empty.length) return -1;

    // 开局:直接下天元附近
    if (state.moveCount === 0) {
        const mid = indexOf(Math.floor(SIZE / 2), Math.floor(SIZE / 2));
        return board[mid] ? empty[0] : mid;
    }

    // 只考虑已有棋子附近两格内的空点 —— 远处的点没有价值,全算是浪费
    const near = new Set();
    for (let i = 0; i < board.length; i += 1) {
        if (!board[i]) continue;
        const { row, col } = rowColOf(i);
        for (let dr = -2; dr <= 2; dr += 1) {
            for (let dc = -2; dc <= 2; dc += 1) {
                const r = row + dr;
                const c = col + dc;
                if (!inBoard(r, c)) continue;
                const idx = indexOf(r, c);
                if (!board[idx]) near.add(idx);
            }
        }
    }
    const candidates = near.size ? [...near] : empty;

    const enemy = otherStone(stone);
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const idx of candidates) {
        const score = scoreAt(board, idx, stone) + scoreAt(board, idx, enemy) * 0.92 + rng() * 2;
        if (score > bestScore) {
            bestScore = score;
            best = idx;
        }
    }
    return best;
}

/**
 * `stone` 下在 `index` 后,四条线的连型分之和。
 *
 * 打分表(数量级才是重点,具体数值不敏感):
 *   成五 1e7 / 活四 1e6 / 冲四 1e5 / 活三 1e4 / 眠三 1e3 / 活二 1e2 / 眠二 10
 */
function scoreAt(board, index, stone) {
    const { row, col } = rowColOf(index);
    let total = 0;

    for (const [dr, dc] of DIRS) {
        let count = 1;      // 含落点自己
        let openEnds = 0;

        for (const sign of [1, -1]) {
            let steps = 0;
            let r = row + dr * sign;
            let c = col + dc * sign;
            while (inBoard(r, c) && board[indexOf(r, c)] === stone && steps < WIN_LEN) {
                count += 1;
                steps += 1;
                r += dr * sign;
                c += dc * sign;
            }
            if (inBoard(r, c) && !board[indexOf(r, c)]) openEnds += 1;
        }

        if (count >= WIN_LEN) total += 1e7;
        else if (count === 4 && openEnds === 2) total += 1e6;
        else if (count === 4 && openEnds === 1) total += 1e5;
        else if (count === 3 && openEnds === 2) total += 1e4;
        else if (count === 3 && openEnds === 1) total += 1e3;
        else if (count === 2 && openEnds === 2) total += 1e2;
        else if (count === 2 && openEnds === 1) total += 10;
        else if (openEnds > 0) total += 1;
    }
    return total;
}

/** 本地棋手的一句嘴 */
export function localLine(rng = Math.random) {
    const pool = ['该我了。', '这手不错吧。', '嗯……就这儿。', '看你怎么接。', '稳一手。'];
    return pool[Math.floor(rng() * pool.length)];
}

export function localRng(seed) {
    return createRng(seed);
}

// ============================================================
// 反序列化
// ============================================================

export function reviveMatch(raw) {
    if (!raw || !Array.isArray(raw.board) || raw.board.length !== SIZE * SIZE) return null;
    const board = raw.board.map((v) => (v === 'black' || v === 'white' ? v : 0));
    const given = asArray(raw.players);

    return {
        kind: 'gomoku',
        size: SIZE,
        players: [
            {
                id: 'black',
                stone: 'black',
                name: String(given[0]?.name || '执黑'),
                kind: given[0]?.kind === 'ai' ? 'ai' : 'user',
                aiId: String(given[0]?.aiId || ''),
            },
            {
                id: 'white',
                stone: 'white',
                name: String(given[1]?.name || '执白'),
                kind: given[1]?.kind === 'ai' ? 'ai' : 'user',
                aiId: String(given[1]?.aiId || ''),
            },
        ],
        board,
        turn: raw.turn === 'white' ? 'white' : 'black',
        moveCount: board.filter(Boolean).length,
        lastIndex: Number.isInteger(raw.lastIndex) ? raw.lastIndex : -1,
        winLine: asArray(raw.winLine).map(Number).filter(Number.isInteger),
        finished: raw.finished === true,
        winner: ['black', 'white', 'draw'].includes(raw.winner) ? raw.winner : '',
        log: asArray(raw.log).slice(-240),
        startedAt: Number(raw.startedAt) || Date.now(),
        finishedAt: Number(raw.finishedAt) || 0,
    };
}
