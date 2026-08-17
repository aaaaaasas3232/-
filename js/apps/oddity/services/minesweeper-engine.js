/**
 * 小奇怪 · 扫雷引擎(纯逻辑)
 *
 * ★ 这个文件**不碰 DOM、不碰 store、不 import 任何组件**。
 *   进来一个 state 加一次操作,出去一个新 state 加一条事件。
 *
 * ── 2026-08 重做说明 ──────────────────────────────────────────────
 *
 * 旧版是「把道具拖到格子上才算扫雷」。用户明确反悔了:
 * 「扫雷不需要拖动道具啊 就跟真实扫雷一样就好了」,还要「能拉 AI 一起玩」。
 * 所以这一版:
 *
 *   1. **点格子直接扫**(入口改叫 `sweepAt`,不再有 dropOn)
 *   2. **长按插旗 / 拔旗**(`toggleFlag`),插了旗的格子点不动 —— 真扫雷的规矩
 *   3. **第一下永远不炸**:整局第一次扫如果踩中雷,把那颗雷挪到别处重算数字
 *      (经典扫雷行为;对战计分下第一步就 -5 纯属运气惩罚,不公平)
 *   4. 座位泛化:p2 可以是本地真人,也可以是 nook 的 AI 人设
 *      (`players` 里带 kind / aiId,引擎本身不关心谁驱动,轮到谁谁扫)
 *   5. 给 AI 的两件套:`boardText()` 把可见盘面序列化成短文本,
 *      `pickSmartCell()` 是本地棋手(约束推理 + 最低风险),
 *      模型没配 Key、返回不合法时都靠它兜底
 *
 * ── 保留的规则(用户当初逐条给的)──────────────────────────────────
 *
 *   9×9 盘 / 恰好 10 颗雷 / 轮流扫(同一个人不能连扫两次)
 *   没碰到雷 +1,碰到雷 −5 / 数字 0 连锁摊开但只有点的那一格计分
 *   每一步都写日志(带坐标 / 碰到什么 / 加减分)
 */

import { MS, MS_PLAYERS } from '../constants.js';
import { createRng, ordinalCn, asArray } from '../utils.js';

export const ROWS = MS.rows;
export const COLS = MS.cols;
export const MINE_COUNT = MS.mines;
export const SCORE_SAFE = MS.scoreSafe;
export const SCORE_MINE = MS.scoreMine;

/** 八邻域偏移 */
const NEIGHBORS = Object.freeze([
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1],
]);

// ============================================================
// 布雷
// ============================================================

export function indexOf(row, col) {
    return row * COLS + col;
}

export function rowColOf(index) {
    return { row: Math.floor(index / COLS), col: index % COLS };
}

function inBoard(row, col) {
    return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

/**
 * 随机布雷。
 *
 * ★ 用「洗牌前 N 个」而不是「随机撒点,撞了重撒」:
 *   后者在雷密度高时会退化成不确定次数的循环,而且**极容易写出
 *   「撞了就跳过」的版本** —— 那样雷数会少于 10 颗,而没有任何报错。
 */
function layMines(rng) {
    const total = ROWS * COLS;
    const pool = new Array(total);
    for (let i = 0; i < total; i += 1) pool[i] = i;
    for (let i = total - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
    }
    return new Set(pool.slice(0, MINE_COUNT));
}

function countAdjacent(mineSet, row, col) {
    let count = 0;
    for (const [dr, dc] of NEIGHBORS) {
        const r = row + dr;
        const c = col + dc;
        if (!inBoard(r, c)) continue;
        if (mineSet.has(indexOf(r, c))) count += 1;
    }
    return count;
}

/** 按雷位集合重算全部格子的 mine / adj(挪雷之后要用) */
function applyMines(state, mineSet) {
    for (const cell of state.cells) {
        cell.mine = mineSet.has(cell.index);
    }
    for (const cell of state.cells) {
        cell.adj = cell.mine ? 0 : countAdjacent(mineSet, cell.row, cell.col);
    }
}

/**
 * 座位归一化。
 * 引擎只认 p1 / p2 两个 id;名字、kind、aiId 由建局方给。
 */
function normalizePlayers(raw) {
    const base = MS_PLAYERS.map((p, i) => {
        const given = asArray(raw)[i] || {};
        return {
            id: p.id,
            name: String(given.name || p.name),
            kind: given.kind === 'ai' ? 'ai' : 'user',
            aiId: String(given.aiId || ''),
            token: p.token,
        };
    });
    return base;
}

/**
 * 开一局新的。
 *
 * @param {object}  [opts]
 * @param {number}  [opts.seed]      给测试用的固定种子;不传就是真随机
 * @param {string}  [opts.firstTurn] 谁先手,默认 p1
 * @param {Array}   [opts.players]   [{ name, kind:'user'|'ai', aiId }, { ... }]
 */
export function createMatch(opts = {}) {
    const rng = createRng(opts.seed);
    const mineSet = layMines(rng);

    const cells = [];
    for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
            const index = indexOf(row, col);
            const mine = mineSet.has(index);
            cells.push({
                index,
                row,
                col,
                mine,
                adj: mine ? 0 : countAdjacent(mineSet, row, col),
                revealed: false,
                /** 是谁翻开的('' = 连锁带出来的,不归任何人) */
                by: '',
                /** 插旗了没(旗子是公共的 —— 一台手机上没有私有信息可言) */
                flag: false,
            });
        }
    }

    const first = MS_PLAYERS.some((p) => p.id === opts.firstTurn) ? opts.firstTurn : MS_PLAYERS[0].id;
    const players = normalizePlayers(opts.players);

    return {
        kind: 'minesweeper',
        rows: ROWS,
        cols: COLS,
        mineCount: MINE_COUNT,
        players,
        cells,
        scores: { p1: 0, p2: 0 },
        steps: { p1: 0, p2: 0 },
        turn: first,
        lastPlayer: '',
        moveCount: 0,
        finished: false,
        winner: '',
        log: [],
        seed: opts.seed == null ? null : Number(opts.seed),
        startedAt: Date.now(),
        finishedAt: 0,
    };
}

// ============================================================
// 查询
// ============================================================

export function playerName(state, playerId) {
    // 兼容旧签名 playerName(playerId)
    if (typeof state === 'string') {
        return MS_PLAYERS.find((p) => p.id === state)?.name || String(state || '');
    }
    const seat = asArray(state?.players).find((p) => p.id === playerId);
    return seat?.name || MS_PLAYERS.find((p) => p.id === playerId)?.name || String(playerId || '');
}

export function getPlayer(state, playerId) {
    return asArray(state?.players).find((p) => p.id === playerId) || null;
}

export function otherPlayer(playerId) {
    return playerId === MS_PLAYERS[0].id ? MS_PLAYERS[1].id : MS_PLAYERS[0].id;
}

export function allSafeRevealed(state) {
    return state.cells.every((cell) => cell.mine || cell.revealed);
}

export function remainingSafe(state) {
    return state.cells.filter((cell) => !cell.mine && !cell.revealed).length;
}

export function hitMines(state) {
    return state.cells.filter((cell) => cell.mine && cell.revealed).length;
}

export function flagCount(state) {
    return state.cells.filter((cell) => cell.flag && !cell.revealed).length;
}

// ============================================================
// 插旗
// ============================================================

/**
 * 插旗 / 拔旗。不消耗回合 —— 旗子是备忘,不是行动。
 * @returns {{ ok:boolean, reason:string, flagged:boolean }}
 */
export function toggleFlag(state, index) {
    if (!state || state.finished) return { ok: false, reason: 'finished', flagged: false };
    const cell = state.cells[Number(index)];
    if (!cell) return { ok: false, reason: 'bad-cell', flagged: false };
    if (cell.revealed) return { ok: false, reason: 'already-revealed', flagged: false };
    cell.flag = !cell.flag;
    return { ok: true, reason: '', flagged: cell.flag };
}

// ============================================================
// 扫
// ============================================================

/**
 * `playerId` 扫 `index` 这一格。**唯一**改变棋局的入口。
 *
 * @returns {{ ok:boolean, reason:string, entry:object|null, chained?:number[], hitMine?:boolean, delta?:number }}
 *   `reason`:'not-your-turn' | 'already-revealed' | 'flagged' | 'finished' | 'bad-cell'
 */
export function sweepAt(state, { index, playerId } = {}) {
    if (!state || state.finished) {
        return { ok: false, reason: 'finished', entry: null };
    }
    const cell = state.cells[Number(index)];
    if (!cell) {
        return { ok: false, reason: 'bad-cell', entry: null };
    }
    /*
     * ★ 两道闸都要留着。turn 是状态,lastPlayer 是事实 ——
     *   「同一个人不能连扫两次」是用户点名要的硬约束。
     */
    if (playerId !== state.turn) {
        return { ok: false, reason: 'not-your-turn', entry: null };
    }
    if (playerId === state.lastPlayer) {
        return { ok: false, reason: 'not-your-turn', entry: null };
    }
    if (cell.revealed) {
        return { ok: false, reason: 'already-revealed', entry: null };
    }
    if (cell.flag) {
        // 真扫雷的规矩:插了旗的格子点不动,先拔旗
        return { ok: false, reason: 'flagged', entry: null };
    }

    // ★ 第一下永远不炸:开局第一扫踩中雷就把雷挪走(经典扫雷行为)
    if (state.moveCount === 0 && cell.mine) {
        relocateMine(state, cell);
    }

    const hitMine = cell.mine;
    const delta = hitMine ? SCORE_MINE : SCORE_SAFE;

    cell.revealed = true;
    cell.by = playerId;
    cell.flag = false;

    const chained = hitMine || cell.adj !== 0 ? [] : floodFrom(state, cell);

    state.scores[playerId] = (state.scores[playerId] || 0) + delta;
    state.steps[playerId] = (state.steps[playerId] || 0) + 1;
    state.moveCount += 1;
    state.lastPlayer = playerId;
    state.turn = otherPlayer(playerId);

    const entry = makeLogEntry(state, {
        playerId,
        cell,
        hitMine,
        delta,
        chainedCount: chained.length,
    });
    state.log.push(entry);

    if (allSafeRevealed(state)) {
        finish(state);
    }

    return { ok: true, reason: '', entry, chained, hitMine, delta };
}

/**
 * 把 `cell` 上的雷挪到一个没雷、也不是它自己的格子上,并重算全部数字。
 * 只在整局第一扫时调,此时没有任何已翻开的格子,重算是安全的。
 */
function relocateMine(state, cell) {
    const free = state.cells.filter((c) => !c.mine && c.index !== cell.index);
    if (!free.length) return;
    const target = free[Math.floor(Math.random() * free.length)];
    const mineSet = new Set(state.cells.filter((c) => c.mine).map((c) => c.index));
    mineSet.delete(cell.index);
    mineSet.add(target.index);
    applyMines(state, mineSet);
    state.log.push({
        seq: state.log.length + 1,
        kind: 'system',
        playerId: '',
        text: '第一下踩中了雷 —— 按老规矩,这颗雷悄悄挪走了,第一步永远安全。',
        at: Date.now(),
    });
}

/** 从一个 0 格开始摊开(广度优先,和传统扫雷一致) */
function floodFrom(state, origin) {
    const opened = [];
    const queue = [origin];
    const seen = new Set([origin.index]);

    while (queue.length) {
        const current = queue.shift();
        for (const [dr, dc] of NEIGHBORS) {
            const r = current.row + dr;
            const c = current.col + dc;
            if (!inBoard(r, c)) continue;
            const next = state.cells[indexOf(r, c)];
            if (!next || next.revealed || next.mine || seen.has(next.index)) continue;
            seen.add(next.index);
            next.revealed = true;
            next.by = '';
            next.flag = false;
            opened.push(next.index);
            if (next.adj === 0) queue.push(next);
        }
    }
    return opened;
}

function finish(state) {
    state.finished = true;
    state.finishedAt = Date.now();
    const a = state.scores.p1 || 0;
    const b = state.scores.p2 || 0;
    state.winner = a === b ? 'draw' : (a > b ? 'p1' : 'p2');
    state.log.push({
        seq: state.log.length + 1,
        kind: 'end',
        playerId: '',
        text: state.winner === 'draw'
            ? `安全格全部翻完了,${a} : ${b},打平。`
            : `安全格全部翻完了,${playerName(state, state.winner)}以 ${Math.max(a, b)} : ${Math.min(a, b)} 获胜。`,
        at: Date.now(),
    });
}

// ============================================================
// 日志
// ============================================================

function makeLogEntry(state, { playerId, cell, hitMine, delta, chainedCount }) {
    const x = cell.col + 1;
    const y = cell.row + 1;
    const met = hitMine ? '雷' : `数字 ${cell.adj}`;
    const sign = delta > 0 ? `+${delta}` : String(delta);
    const chain = chainedCount > 0
        ? `,连带翻开 ${chainedCount} 格(连带不计分)`
        : '';
    return {
        seq: state.log.length + 1,
        kind: hitMine ? 'mine' : 'safe',
        playerId,
        index: cell.index,
        x,
        y,
        delta,
        chainedCount,
        total: state.scores[playerId] + delta,
        text: `${playerName(state, playerId)}${ordinalCn(state.steps[playerId] + 1)}:扫了坐标(${x},${y}),碰到了${met}${chain},${sign} 分,目前总分 ${state.scores[playerId] + delta}。`,
        at: Date.now(),
    };
}

/** AI 台词落进日志(不参与计分,只是气氛) */
export function pushFlavor(state, playerId, line) {
    const text = String(line || '').trim();
    if (!state || !text) return;
    state.log.push({
        seq: state.log.length + 1,
        kind: 'flavor',
        playerId: String(playerId || ''),
        text: `${playerName(state, playerId)}:${text}`,
        at: Date.now(),
    });
}

// ============================================================
// 给 AI 的两件套
// ============================================================

/**
 * 把「当前可见的盘面」序列化成短文本(给模型看的,它看不到雷)。
 *
 *   . 没翻开   F 插了旗   * 被踩出来的雷   0~8 翻开的数字
 *
 * 一行一排,前面带行号,顶上带列号 —— 模型用 (x,y) 回坐标时不容易错位。
 */
export function boardText(state) {
    const head = `   ${Array.from({ length: COLS }, (_, i) => String(i + 1)).join(' ')}`;
    const rows = [];
    for (let r = 0; r < ROWS; r += 1) {
        const line = [];
        for (let c = 0; c < COLS; c += 1) {
            const cell = state.cells[indexOf(r, c)];
            if (!cell.revealed) line.push(cell.flag ? 'F' : '.');
            else if (cell.mine) line.push('*');
            else line.push(String(cell.adj));
        }
        rows.push(`${String(r + 1).padStart(2, ' ')} ${line.join(' ')}`);
    }
    return `${head}\n${rows.join('\n')}`;
}

/**
 * 本地棋手:两步约束推理 + 风险估计。
 *
 *   1. 找「确定安全」的格子:某个数字周围的雷已经全部找齐
 *      (已翻开的雷 + 确定是雷的格子 == 数字),它剩下的未翻邻居全安全
 *   2. 找「确定是雷」的格子:某个数字周围未翻开的格子数恰好等于还缺的雷数
 *   3. 都没有就按风险挑:每个未翻格取周围数字给出的最大雷概率,挑最小的;
 *      完全没信息的格子按剩余雷数 / 剩余格数算底噪
 *
 * 返回格子 index;没有可扫的返回 -1。
 * ★ 它同时是「没配 Key 的本地模式」和「模型返回不合法」的兜底,
 *   所以必须永远能给出一个合法格。
 */
export function pickSmartCell(state, rng = Math.random) {
    const unknown = state.cells.filter((c) => !c.revealed);
    if (!unknown.length) return -1;

    const certainMines = new Set();
    const certainSafe = new Set();

    const numberCells = state.cells.filter((c) => c.revealed && !c.mine && c.adj > 0);
    // 迭代两轮就够覆盖常见局面 —— 这里不是要做求解器,是要做一个不蠢的对手
    for (let pass = 0; pass < 2; pass += 1) {
        for (const num of numberCells) {
            const around = [];
            for (const [dr, dc] of NEIGHBORS) {
                const r = num.row + dr;
                const c = num.col + dc;
                if (!inBoard(r, c)) continue;
                around.push(state.cells[indexOf(r, c)]);
            }
            const hidden = around.filter((c) => !c.revealed && !certainSafe.has(c.index));
            const knownMines = around.filter((c) => (c.revealed && c.mine) || certainMines.has(c.index)).length;
            const need = num.adj - knownMines;
            if (need <= 0) {
                for (const c of hidden) {
                    if (!certainMines.has(c.index)) certainSafe.add(c.index);
                }
            } else if (need >= hidden.filter((c) => !certainMines.has(c.index)).length) {
                for (const c of hidden) certainMines.add(c.index);
            }
        }
    }

    const safePick = unknown.filter((c) => certainSafe.has(c.index) && !c.flag);
    if (safePick.length) {
        return safePick[Math.floor(rng() * safePick.length)].index;
    }

    // 风险估计
    const totalHiddenMines = MINE_COUNT - hitMines(state) - certainMines.size;
    const plainHidden = unknown.filter((c) => !certainMines.has(c.index));
    const baseRisk = plainHidden.length ? Math.max(0, totalHiddenMines) / plainHidden.length : 1;

    let best = null;
    let bestRisk = Infinity;
    for (const cell of unknown) {
        if (cell.flag) continue;
        if (certainMines.has(cell.index)) continue;
        let risk = baseRisk;
        let touched = false;
        for (const [dr, dc] of NEIGHBORS) {
            const r = cell.row + dr;
            const c = cell.col + dc;
            if (!inBoard(r, c)) continue;
            const nb = state.cells[indexOf(r, c)];
            if (!nb.revealed || nb.mine || nb.adj === 0) continue;
            touched = true;
            const around = [];
            for (const [dr2, dc2] of NEIGHBORS) {
                const r2 = nb.row + dr2;
                const c2 = nb.col + dc2;
                if (!inBoard(r2, c2)) continue;
                around.push(state.cells[indexOf(r2, c2)]);
            }
            const hidden = around.filter((x) => !x.revealed);
            const knownMines = around.filter((x) => (x.revealed && x.mine) || certainMines.has(x.index)).length;
            const need = Math.max(0, nb.adj - knownMines);
            const localRisk = hidden.length ? need / hidden.length : 1;
            risk = Math.max(risk, localRisk);
        }
        // 没贴着任何数字的格子略优先(信息少 = 底噪风险),打破平手时加一点抖动
        const jitter = rng() * 0.01;
        const score = (touched ? risk : baseRisk * 0.96) + jitter;
        if (score < bestRisk) {
            bestRisk = score;
            best = cell;
        }
    }
    if (best) return best.index;

    // 全是旗 / 全是确定雷 —— 硬着头皮挑一个没翻的(游戏总要能进行下去)
    return unknown[Math.floor(rng() * unknown.length)].index;
}

/** 本地棋手的一句嘴(没配 Key 时日志不至于干巴巴) */
export function localLine(hitMine, rng = Math.random) {
    const ouch = ['哎。', '这运气。', '不该点这儿的。', '疼。'];
    const fine = ['稳。', '就这儿。', '我看这格顺眼。', '继续。'];
    const pool = hitMine ? ouch : fine;
    return pool[Math.floor(rng() * pool.length)];
}

// ============================================================
// 反序列化
// ============================================================

/**
 * 从 IndexedDB 读回来的东西补齐成一局。
 * 结构对不上时返回 null —— **绝不把半个棋盘当棋盘用**。
 */
export function reviveMatch(raw) {
    if (!raw || !Array.isArray(raw.cells) || raw.cells.length !== ROWS * COLS) return null;
    const cells = raw.cells.map((cell, index) => ({
        index,
        row: Math.floor(index / COLS),
        col: index % COLS,
        mine: cell?.mine === true,
        adj: Number(cell?.adj) || 0,
        revealed: cell?.revealed === true,
        by: String(cell?.by || ''),
        flag: cell?.flag === true && cell?.revealed !== true,
    }));
    if (cells.filter((cell) => cell.mine).length !== MINE_COUNT) return null;

    return {
        kind: 'minesweeper',
        rows: ROWS,
        cols: COLS,
        mineCount: MINE_COUNT,
        players: normalizePlayers(raw.players),
        cells,
        scores: {
            p1: Number(raw.scores?.p1) || 0,
            p2: Number(raw.scores?.p2) || 0,
        },
        steps: {
            p1: Number(raw.steps?.p1) || 0,
            p2: Number(raw.steps?.p2) || 0,
        },
        turn: MS_PLAYERS.some((p) => p.id === raw.turn) ? raw.turn : MS_PLAYERS[0].id,
        lastPlayer: String(raw.lastPlayer || ''),
        moveCount: Number(raw.moveCount) || 0,
        finished: raw.finished === true,
        winner: String(raw.winner || ''),
        log: Array.isArray(raw.log) ? raw.log.slice(-200) : [],
        seed: raw.seed == null ? null : Number(raw.seed),
        startedAt: Number(raw.startedAt) || Date.now(),
        finishedAt: Number(raw.finishedAt) || 0,
    };
}
