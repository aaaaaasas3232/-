/**
 * 大富翁 / 引擎
 *
 * 步骤图：
 *
 *   beginTurn ──> (等用户点掷骰 / AI 自动) ──> roll ──> settleRoll
 *                                                          │
 *                                                    walk(剩余步数)
 *                                                          │
 *                                                        land
 *                                                          │
 *                                    ┌────── 买地/加房 决策 ──────┐
 *                                    │                            │
 *                                 endTurn ←───── 事件结算 ────────┘
 *                                    │
 *                                 checkEnd ──> beginTurn(下一位)
 *
 * ★ 时序上有一处必须对齐：`settleRoll` 排在 `ROLL_SPIN + ROLL_SETTLE`
 *   之后，正好是骰子翻滚 1.5s + 停稳 0.8s —— 跟原型一模一样。
 *   但这里跟动画是**解耦**的：动画由 `dice-3d.js` 自己看 `startedAt` 算，
 *   引擎只管到点推进。所以用户切出去时骰子不转了，回来直接看到结果，
 *   而流程一步没落下。
 */

import { addLog, addEvent, setPhase, settleSession, notifyTurn } from '../core/engine.js';
import { writeSession } from '../core/store.js';
import { scheduleStep, awaitUser, clearPending, withBusy } from '../core/clock.js';
import { askAi, cleanSpeech, parseJson } from '../core/ai.js';
import { getPlayer, userPlayer, pickRandom } from '../core/players.js';
import { MONOPOLY_TIMING as T } from '../core/constants.js';
import { rollDice } from '../components/dice-3d.js';
import {
    BOARD, BOARD_SIZE, TILE_TYPES, JAIL_INDEX, tileAt, drawCard,
} from './board.js';
import {
    START_MONEY, PASS_GO_BONUS, JAIL_FINE, MAX_HOUSES, MAX_ROUNDS,
    houseCost, rentOf, canUpgrade, estatesOf, netWorth, liquidValue,
    activePlayers, checkWin, formatMoney, ownsWholeGroup,
} from './rules.js';
import * as P from './prompts.js';

export const PHASES = Object.freeze({
    TURN: 'turn',
    MOVING: 'moving',
    DECIDE: 'decide',
    REVIEW: 'review',
});

export const ACTIONS = Object.freeze({
    ROLL: 'roll',
    BUY: 'buy',
    UPGRADE: 'upgrade',
    JAIL: 'jail',
    RAISE: 'raise_cash',
    REVIEW: 'review_chat',
});

// ---------------------------------------------------------------------------

export function setup(session) {
    for (const p of session.players) {
        p.money = START_MONEY;
        p.pos = 0;
        p.laps = 0;
        p.jailTurns = 0;
        p.pardon = false;
        p.skipNext = false;
        p.bankrupt = false;
        p.roleLabel = '';
    }
    session.estates = {};       // index → { index, ownerId, houses }
    session.turnIndex = 0;
    session.maxRounds = MAX_ROUNDS;
    session.dice = null;
    session.lastCard = null;
    session.round = 1;

    addLog(session, { kind: 'system', text: `每人起始资金 ${formatMoney(START_MONEY)}，经过起点领 ${formatMoney(PASS_GO_BONUS)}` });
    addLog(session, { kind: 'system', text: `最多 ${MAX_ROUNDS} 轮，到时按净资产排名` });
    scheduleStep(session, 'beginTurn', 600);
    return session;
}

export async function runStep(session, step, payload) {
    const handler = STEPS[step];
    if (!handler) {
        console.warn('[monopoly] 未知步骤', step);
        return;
    }
    await handler(session, payload || {});
}

const STEPS = {
    beginTurn, roll, settleRoll, walk, land, resolveTile, applyCard,
    askBuy, askUpgrade, endTurn, checkEnd, beginReview, reviewLine,
};

// ---------------------------------------------------------------------------
// 回合
// ---------------------------------------------------------------------------

/**
 * 轮到谁。
 *
 * ★ `turnIndex` 是**玩家数组**的下标，不是「还活着的人」里的下标。
 *   按存活列表算的话，有人破产时列表一缩，剩下的人就会跟着往前挪一位 ——
 *   表现是某个人莫名其妙被跳过一轮，而且很难复现。
 */
function currentPlayer(session) {
    const all = session.players || [];
    if (!all.length) return null;
    const start = ((Number(session.turnIndex) || 0) % all.length + all.length) % all.length;
    for (let k = 0; k < all.length; k++) {
        const p = all[(start + k) % all.length];
        if (!p.bankrupt) return p;
    }
    return null;
}

function beginTurn(session) {
    const player = currentPlayer(session);
    if (!player) {
        writeSession(session, (s) => scheduleStep(s, 'checkEnd', 200));
        return;
    }

    writeSession(session, (s) => {
        setPhase(s, PHASES.TURN, `第 ${s.round} 轮 · ${player.name} 的回合`, { silent: true });
        s.currentId = player.id;
        // turnIndex 对齐到真正行动的这个人（前面可能跳过了破产的）
        s.turnIndex = (s.players || []).findIndex((p) => p.id === player.id);
        s.dice = null;
        s.turnExtra = false;
    });

    const p = getPlayer(session, player.id);

    // 休息一回合
    if (p.skipNext) {
        writeSession(session, (s) => {
            getPlayer(s, p.id).skipNext = false;
            addLog(s, { kind: 'system', text: `${p.name} 这回合休息` });
            scheduleStep(s, 'endTurn', T.NEXT_TURN);
        });
        return;
    }

    // 在监狱里
    if (p.jailTurns > 0) {
        if (p.pardon) {
            writeSession(session, (s) => {
                const me = getPlayer(s, p.id);
                me.pardon = false;
                me.jailTurns = 0;
                addLog(s, { kind: 'system', text: `${p.name} 用掉免罪金牌，直接出狱` });
            });
        } else if (p.isUser) {
            writeSession(session, (s) => {
                awaitUser(s, ACTIONS.JAIL, {});
                notifyTurn(s, '你在监狱里，选择交罚金还是掷骰');
            });
            return;
        } else {
            // AI 的策略很简单：钱多就交罚金，钱少就赌掷出对子
            const payFine = p.money > JAIL_FINE * 6;
            applyJailChoice(session, p.id, payFine ? 'pay' : 'roll');
            return;
        }
    }

    if (p.isUser) {
        writeSession(session, (s) => {
            awaitUser(s, ACTIONS.ROLL, {});
            notifyTurn(s, '轮到你掷骰了');
        });
        return;
    }
    writeSession(session, (s) => scheduleStep(s, 'roll', T.AI_ROLL));
}

/** 用户在监狱里选了怎么办。 */
export function applyJailChoice(session, playerId, choice) {
    const p = getPlayer(session, playerId);
    if (!p) return;
    if (choice === 'pay') {
        if (p.money < JAIL_FINE) {
            writeSession(session, (s) => {
                addLog(s, { kind: 'system', text: `${p.name} 交不起罚金，只能继续蹲着` });
                const me = getPlayer(s, playerId);
                me.jailTurns -= 1;
                clearPending(s);
                scheduleStep(s, 'endTurn', T.NEXT_TURN);
            });
            return;
        }
        writeSession(session, (s) => {
            const me = getPlayer(s, playerId);
            me.money -= JAIL_FINE;
            me.jailTurns = 0;
            addLog(s, { kind: 'system', text: `${p.name} 交了 ${formatMoney(JAIL_FINE)} 罚金出狱` });
            clearPending(s);
            scheduleStep(s, 'roll', 400);
        });
        return;
    }
    writeSession(session, (s) => {
        clearPending(s);
        s.jailRoll = playerId;
        scheduleStep(s, 'roll', 300);
    });
}

// ---------------------------------------------------------------------------
// 掷骰
// ---------------------------------------------------------------------------

function roll(session) {
    const player = getPlayer(session, session.currentId);
    if (!player) return;
    const result = rollDice(2);
    writeSession(session, (s) => {
        s.dice = result;
        setPhase(s, PHASES.MOVING, `${player.name} 掷出 ${result.total} 点`, { silent: true });
        addLog(s, {
            kind: 'action',
            text: `${player.name} 掷出 ${result.dice.map((d) => d.value).join(' + ')} = ${result.total}`,
        });
        // ★ 跟骰子动画对齐：翻滚 1.5s + 停稳 0.8s（原型的 1500 / 800）
        scheduleStep(s, 'settleRoll', T.ROLL_SPIN + T.ROLL_SETTLE);
    });
}

function settleRoll(session) {
    const player = getPlayer(session, session.currentId);
    const dice = session.dice;
    if (!player || !dice) return;
    const isDouble = dice.dice.length === 2 && dice.dice[0].value === dice.dice[1].value;

    // 在狱中掷对子才能出来
    if (session.jailRoll === player.id) {
        writeSession(session, (s) => {
            s.jailRoll = '';
            const me = getPlayer(s, player.id);
            if (isDouble) {
                me.jailTurns = 0;
                addLog(s, { kind: 'system', text: `${player.name} 掷出对子，出狱！` });
                scheduleStep(s, 'walk', 400, { remain: dice.total });
            } else {
                me.jailTurns -= 1;
                addLog(s, {
                    kind: 'system',
                    text: me.jailTurns > 0
                        ? `${player.name} 没掷出对子，还要蹲 ${me.jailTurns} 回合`
                        : `${player.name} 刑满释放，下回合可以走了`,
                });
                scheduleStep(s, 'endTurn', T.NEXT_TURN);
            }
        });
        return;
    }

    writeSession(session, (s) => {
        s.turnExtra = isDouble;
        if (isDouble) addLog(s, { kind: 'system', text: `${player.name} 掷出对子，走完可以再掷一次` });
        scheduleStep(s, 'walk', 200, { remain: dice.total });
    });
}

/**
 * 一格一格地走。
 *
 * ★ 原型是「算好终点直接改 position 然后整块重画棋盘」—— 没有移动感，
 *   而且经过起点的判断只靠 `newPos < oldPos`，被卡牌传送时会误判成过了起点。
 *   逐格走之后，「经过起点」是走到 0 那一格时真的发生的事件，不用再猜。
 */
function walk(session, { remain = 0 }) {
    if (remain <= 0) {
        writeSession(session, (s) => scheduleStep(s, 'land', T.LAND));
        return;
    }
    writeSession(session, (s) => {
        const me = getPlayer(s, s.currentId);
        if (!me) return;
        me.pos = (me.pos + 1) % BOARD_SIZE;
        if (me.pos === 0) {
            me.laps += 1;
            me.money += PASS_GO_BONUS;
            addLog(s, { kind: 'system', text: `${me.name} 经过起点，领 ${formatMoney(PASS_GO_BONUS)}`, tone: 'good' });
        }
        scheduleStep(s, 'walk', T.STEP, { remain: remain - 1 });
    });
}

function land(session) {
    const player = getPlayer(session, session.currentId);
    if (!player) return;
    const tile = tileAt(player.pos);
    writeSession(session, (s) => {
        addLog(s, { kind: 'action', text: `${player.name} 走到「${tile.name}」` });
        scheduleStep(s, 'resolveTile', 300);
    });
}

// ---------------------------------------------------------------------------
// 格子结算
// ---------------------------------------------------------------------------

async function resolveTile(session) {
    const player = getPlayer(session, session.currentId);
    if (!player) return;
    const tile = tileAt(player.pos);

    if (tile.type === TILE_TYPES.GO || tile.type === TILE_TYPES.PARKING || tile.type === TILE_TYPES.JAIL) {
        writeSession(session, (s) => scheduleStep(s, 'endTurn', T.EVENT));
        return;
    }

    if (tile.type === TILE_TYPES.GOTO_JAIL) {
        writeSession(session, (s) => {
            sendToJail(s, player.id);
            scheduleStep(s, 'endTurn', T.EVENT);
        });
        return;
    }

    if (tile.type === TILE_TYPES.TAX) {
        writeSession(session, (s) => {
            addLog(s, { kind: 'system', text: `${player.name} 缴纳${tile.name} ${formatMoney(tile.amount)}`, tone: 'bad' });
            chargeMoney(s, player.id, tile.amount, '');
            scheduleStep(s, 'endTurn', T.EVENT);
        });
        return;
    }

    if (tile.type === TILE_TYPES.CHANCE || tile.type === TILE_TYPES.FATE) {
        const card = drawCard(tile.type);
        writeSession(session, (s) => {
            s.lastCard = { ...card, tileType: tile.type, at: Date.now() };
            addLog(s, { kind: 'system', text: `${player.name} 抽到「${tile.name}」：${card.text}` });
            scheduleStep(s, 'applyCard', T.EVENT, { cardId: card.id });
        });
        return;
    }

    // 地产 / 公用
    const estate = session.estates?.[tile.i];
    if (estate && estate.ownerId && estate.ownerId !== player.id) {
        const owner = getPlayer(session, estate.ownerId);
        const rent = rentOf(session, tile, session.dice?.total || 2);
        writeSession(session, (s) => {
            addLog(s, {
                kind: 'system',
                text: `${player.name} 付给 ${owner?.name} 租金 ${formatMoney(rent)}`,
                tone: 'bad',
            });
            chargeMoney(s, player.id, rent, estate.ownerId);
            scheduleStep(s, 'endTurn', T.EVENT);
        });
        return;
    }

    if (estate && estate.ownerId === player.id) {
        if (canUpgrade(session, player.id, tile)) {
            await askUpgrade(session, { tileIndex: tile.i });
            return;
        }
        writeSession(session, (s) => scheduleStep(s, 'endTurn', T.EVENT));
        return;
    }

    await askBuy(session, { tileIndex: tile.i });
}

function applyCard(session, { cardId }) {
    const card = session.lastCard;
    if (!card || card.id !== cardId) {
        writeSession(session, (s) => scheduleStep(s, 'endTurn', T.EVENT));
        return;
    }
    const player = getPlayer(session, session.currentId);
    const e = card.effect || {};

    writeSession(session, (s) => {
        const me = getPlayer(s, s.currentId);
        if (!me) return;
        switch (e.kind) {
            case 'money':
                if (e.amount >= 0) me.money += e.amount;
                else chargeMoney(s, me.id, -e.amount, '');
                break;
            case 'collect':
                for (const other of activePlayers(s)) {
                    if (other.id === me.id) continue;
                    chargeMoney(s, other.id, e.amount, me.id);
                }
                break;
            case 'pay':
                for (const other of activePlayers(s)) {
                    if (other.id === me.id) continue;
                    chargeMoney(s, me.id, e.amount, other.id);
                }
                break;
            case 'repair': {
                const houses = estatesOf(s, me.id).reduce((n, x) => n + (Number(x.houses) || 0), 0);
                if (houses) chargeMoney(s, me.id, houses * e.perHouse, '');
                else addLog(s, { kind: 'system', text: `${me.name} 名下没有房子，免了这一笔` });
                break;
            }
            case 'jail':
                sendToJail(s, me.id);
                break;
            case 'pardon':
                me.pardon = true;
                break;
            case 'skip':
                me.skipNext = true;
                break;
            case 'moveTo': {
                const target = ((Number(e.index) || 0) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE;
                if (target <= me.pos) {
                    me.laps += 1;
                    me.money += PASS_GO_BONUS;
                    addLog(s, { kind: 'system', text: `${me.name} 经过起点，领 ${formatMoney(PASS_GO_BONUS)}`, tone: 'good' });
                }
                me.pos = target;
                // ★ 传送之后要**重新结算落点**。原型的额外移动不触发新格子事件
                //   （「加速」走到陷阱上什么都不会发生），是它最明显的规则漏洞之一。
                scheduleStep(s, 'land', T.EVENT);
                return;
            }
            case 'move': {
                const steps = Number(e.steps) || 0;
                if (steps > 0) {
                    scheduleStep(s, 'walk', T.EVENT, { remain: steps });
                } else {
                    me.pos = ((me.pos + steps) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE;
                    scheduleStep(s, 'land', T.EVENT);
                }
                return;
            }
            default:
                break;
        }
        scheduleStep(s, 'endTurn', T.EVENT);
    });
}

// ---------------------------------------------------------------------------
// 买地 / 加房
// ---------------------------------------------------------------------------

async function askBuy(session, { tileIndex }) {
    const tile = tileAt(tileIndex);
    const player = getPlayer(session, session.currentId);
    if (!player) return;

    if (player.money < tile.price) {
        writeSession(session, (s) => {
            addLog(s, { kind: 'system', text: `${player.name} 买不起「${tile.name}」` });
            scheduleStep(s, 'endTurn', T.EVENT);
        });
        return;
    }

    if (player.isUser) {
        writeSession(session, (s) => {
            setPhase(s, PHASES.DECIDE, `要不要买下「${tile.name}」`, { silent: true });
            awaitUser(s, ACTIONS.BUY, { tileIndex });
            notifyTurn(s, `要不要买下「${tile.name}」`);
        });
        return;
    }

    const res = await withBusy(session, 'askBuy', `${player.name}正在盘算`, () => askAi({
        session, aiPersonId: player.id, maxTokens: 100, temperature: 0.7,
        ...P.buyPrompt(session, player, tile),
    }), { tileIndex });

    const json = res.ok ? parseJson(res.text) : null;
    // 解析不出来就走启发式，绝不把乱码当决定（AGENTS2 §13.6.2）
    const buy = typeof json?.buy === 'boolean'
        ? json.buy
        : player.money > tile.price * 2.5;
    const say = cleanSpeech(json?.say || '', 30);

    if (say) writeSession(session, (s) => addLog(s, { kind: 'speech', playerId: player.id, text: say }));
    applyBuy(session, player.id, tileIndex, buy);
}

export function applyBuy(session, playerId, tileIndex, buy) {
    const tile = tileAt(tileIndex);
    writeSession(session, (s) => {
        clearPending(s);
        const me = getPlayer(s, playerId);
        if (buy && me && me.money >= tile.price) {
            me.money -= tile.price;
            s.estates[tile.i] = { index: tile.i, ownerId: playerId, houses: 0 };
            addLog(s, { kind: 'system', text: `${me.name} 买下了「${tile.name}」，花了 ${formatMoney(tile.price)}`, tone: 'good' });
            addEvent(s, { type: 'buy', playerId, tile: tile.name, price: tile.price });
            if (tile.group && ownsWholeGroup(s, playerId, tile.group)) {
                addLog(s, { kind: 'system', text: `${me.name} 集齐了整组，这一组租金翻倍！`, tone: 'good' });
            }
        } else {
            addLog(s, { kind: 'system', text: `${me?.name} 放弃了「${tile.name}」` });
        }
        scheduleStep(s, 'endTurn', T.EVENT);
    });
}

async function askUpgrade(session, { tileIndex }) {
    const tile = tileAt(tileIndex);
    const player = getPlayer(session, session.currentId);
    const cost = houseCost(tile);
    if (!player) return;

    if (player.money < cost) {
        writeSession(session, (s) => scheduleStep(s, 'endTurn', T.EVENT));
        return;
    }

    if (player.isUser) {
        writeSession(session, (s) => {
            setPhase(s, PHASES.DECIDE, `要不要在「${tile.name}」加一栋房`, { silent: true });
            awaitUser(s, ACTIONS.UPGRADE, { tileIndex });
            notifyTurn(s, `可以在「${tile.name}」加房`);
        });
        return;
    }

    const res = await withBusy(session, 'askUpgrade', `${player.name}正在盘算`, () => askAi({
        session, aiPersonId: player.id, maxTokens: 100, temperature: 0.7,
        ...P.upgradePrompt(session, player, tile, cost),
    }), { tileIndex });
    const json = res.ok ? parseJson(res.text) : null;
    const up = typeof json?.upgrade === 'boolean' ? json.upgrade : player.money > cost * 3;
    const say = cleanSpeech(json?.say || '', 30);
    if (say) writeSession(session, (s) => addLog(s, { kind: 'speech', playerId: player.id, text: say }));
    applyUpgrade(session, player.id, tileIndex, up);
}

export function applyUpgrade(session, playerId, tileIndex, up) {
    const tile = tileAt(tileIndex);
    const cost = houseCost(tile);
    writeSession(session, (s) => {
        clearPending(s);
        const me = getPlayer(s, playerId);
        const estate = s.estates?.[tile.i];
        if (up && me && estate && me.money >= cost && (estate.houses || 0) < MAX_HOUSES) {
            me.money -= cost;
            estate.houses = (Number(estate.houses) || 0) + 1;
            addLog(s, {
                kind: 'system',
                text: `${me.name} 在「${tile.name}」盖到了 ${estate.houses} 级，花了 ${formatMoney(cost)}`,
                tone: 'good',
            });
        }
        scheduleStep(s, 'endTurn', T.EVENT);
    });
}

// ---------------------------------------------------------------------------
// 钱 / 破产
// ---------------------------------------------------------------------------

/**
 * 收钱。付不起就自动变卖地产；还不够就破产。
 *
 * ★ 变卖是自动的，不让用户手动挑 —— 手动挑要再加一层交互，而这一步
 *   通常发生在「已经输定了」的时候，多按几下只是拖时间。
 */
function chargeMoney(s, payerId, amount, receiverId) {
    const payer = getPlayer(s, payerId);
    if (!payer || payer.bankrupt) return;
    let owed = Math.max(0, Math.round(Number(amount) || 0));
    if (!owed) return;

    if (payer.money < owed) {
        const sellable = liquidValue(s, payer);
        if (payer.money + sellable >= owed) {
            // 从最便宜的开始卖，尽量保住贵地
            const mine = estatesOf(s, payer.id)
                .sort((a, b) => (tileAt(a.index).price || 0) - (tileAt(b.index).price || 0));
            for (const e of mine) {
                if (payer.money >= owed) break;
                const tile = tileAt(e.index);
                const back = Math.round((tile.price || 0) * 0.5)
                    + (Number(e.houses) || 0) * Math.round(houseCost(tile) * 0.5);
                payer.money += back;
                delete s.estates[e.index];
                addLog(s, { kind: 'system', text: `${payer.name} 变卖「${tile.name}」换 ${formatMoney(back)}` });
            }
        }
    }

    const paid = Math.min(payer.money, owed);
    payer.money -= paid;
    if (receiverId) {
        const receiver = getPlayer(s, receiverId);
        if (receiver) receiver.money += paid;
    }

    if (payer.money <= 0 && paid < owed) {
        payer.money = 0;
        payer.bankrupt = true;
        payer.bankruptRound = s.round;
        // 破产者的地全部回到市场（不给债主 —— 给了会让局势雪崩得太快）
        for (const e of estatesOf(s, payer.id)) delete s.estates[e.index];
        addLog(s, { kind: 'system', text: `${payer.name} 破产出局`, tone: 'death' });
        addEvent(s, { type: 'bankrupt', playerId: payer.id, playerName: payer.name });
    }
}

function sendToJail(s, playerId) {
    const me = getPlayer(s, playerId);
    if (!me) return;
    me.pos = JAIL_INDEX;
    me.jailTurns = 3;
    addLog(s, { kind: 'system', text: `${me.name} 被送进监狱，最多蹲 3 回合`, tone: 'bad' });
}

// ---------------------------------------------------------------------------
// 回合流转
// ---------------------------------------------------------------------------

function endTurn(session) {
    writeSession(session, (s) => {
        clearPending(s);
        // 掷出对子再来一次（但在监狱里出来的那次不给额外回合）
        if (s.turnExtra && !getPlayer(s, s.currentId)?.bankrupt) {
            s.turnExtra = false;
            addLog(s, { kind: 'system', text: `${getPlayer(s, s.currentId)?.name} 再掷一次` });
            scheduleStep(s, 'beginTurn', T.NEXT_TURN);
            return;
        }
        // 走到玩家数组的下一位；绕回开头就是新的一轮
        const total = (s.players || []).length || 1;
        s.turnIndex += 1;
        if (s.turnIndex >= total) {
            s.turnIndex = 0;
            s.round += 1;
        }
        scheduleStep(s, 'checkEnd', 200);
    });
}

function checkEnd(session) {
    const win = checkWin(session);
    if (!win) {
        writeSession(session, (s) => scheduleStep(s, 'beginTurn', T.NEXT_TURN));
        return;
    }
    writeSession(session, (s) => {
        const ranked = [...s.players].sort((a, b) => netWorth(s, b) - netWorth(s, a));
        for (const p of s.players) {
            p.win = p.id === win.winnerId;
            p.roleLabel = `净资产 ${formatMoney(netWorth(s, p))}`;
        }
        settleSession(s, win.winnerId || 'none', win.label, win.label);
        s.result.highlights = ranked.map((p, i) => `${i + 1}. ${p.name} ${formatMoney(netWorth(s, p))}`);
        scheduleStep(s, 'beginReview', 900);
    });
}

function beginReview(session) {
    writeSession(session, (s) => {
        setPhase(s, PHASES.REVIEW, '复盘时间');
        scheduleStep(s, 'reviewLine', 900, { index: 0 });
    });
}

async function reviewLine(session, { index = 0, userSaid = '' }) {
    const speakers = (session.players || []).filter((p) => !p.isUser);
    const speaker = userSaid ? pickRandom(speakers) : speakers[index];
    if (!speaker) {
        writeSession(session, (s) => awaitUser(s, ACTIONS.REVIEW, {}));
        return;
    }
    const res = await withBusy(session, 'reviewLine', `${speaker.name}正在复盘`, () => askAi({
        session, aiPersonId: speaker.id, maxTokens: 100,
        ...P.reviewPrompt(session, speaker, userSaid),
    }), { index, userSaid });
    writeSession(session, (s) => {
        if (res.ok) {
            const line = cleanSpeech(res.text, 80);
            if (line) addLog(s, { kind: 'speech', playerId: speaker.id, text: line });
        }
        if (!userSaid && index + 1 < Math.min(speakers.length, 2)) {
            scheduleStep(s, 'reviewLine', 1000, { index: index + 1 });
        } else {
            awaitUser(s, ACTIONS.REVIEW, {});
        }
    });
}

// ---------------------------------------------------------------------------

export async function handleUserAction(session, action, payload = {}) {
    const pending = session.pending;
    if (!pending || pending.action !== action) return;
    const me = userPlayer(session);
    const data = pending.data || {};

    if (action === ACTIONS.ROLL) {
        writeSession(session, (s) => {
            clearPending(s);
            scheduleStep(s, 'roll', 0);
        });
        return;
    }
    if (action === ACTIONS.JAIL) {
        applyJailChoice(session, me.id, payload.choice === 'pay' ? 'pay' : 'roll');
        return;
    }
    if (action === ACTIONS.BUY) {
        applyBuy(session, me.id, data.tileIndex, payload.buy === true);
        return;
    }
    if (action === ACTIONS.UPGRADE) {
        applyUpgrade(session, me.id, data.tileIndex, payload.upgrade === true);
        return;
    }
    if (action === ACTIONS.REVIEW) {
        const text = cleanSpeech(payload.text, 120);
        if (!text) return;
        writeSession(session, (s) => {
            clearPending(s);
            addLog(s, { kind: 'speech', playerId: me.id, text });
            scheduleStep(s, 'reviewLine', 600, { userSaid: text });
        });
    }
}

export { BOARD, tileAt, formatMoney, netWorth, estatesOf, activePlayers, MAX_HOUSES, houseCost };
