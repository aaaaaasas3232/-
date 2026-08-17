/**
 * 大富翁 / 经济规则
 *
 * 这一整个文件都是**新写的** —— 原型没有钱、没有地产、没有租金，
 * 自然也没有这一层。数值是按「一局 15~25 分钟结束」调的：
 * 起始资金够走两三圈，但只要有人集齐一组地并起两级房，对手就会开始吃紧。
 */

import { BOARD, BOARD_SIZE, TILE_TYPES, tileAt, groupSize, tilesOfGroup } from './board.js';

export const START_MONEY = 15000;
export const PASS_GO_BONUS = 2000;
export const JAIL_FINE = 500;
export const MAX_HOUSES = 3;
/** 超过这个轮数就按净资产结算 —— 不设上限的话两个都不肯买地的 AI 能磨一整天。 */
export const MAX_ROUNDS = 24;

/** 建一栋房要多少钱。 */
export function houseCost(tile) {
    return Math.round((tile.price || 0) * 0.5);
}

/** 地产基础租金。 */
export function baseRent(tile) {
    return Math.round((tile.price || 0) * 0.1);
}

/**
 * 停在这块地要付多少。
 *
 *   地产：基础租金 ×（集齐整组 ? 2 : 1）×（1 + 房子数 × 0.75）
 *   公用：骰子点数 × 100 ×（两家都有 ? 2 : 1）
 */
export function rentOf(session, tile, diceTotal) {
    const owned = session.estates?.[tile.i];
    if (!owned || !owned.ownerId) return 0;

    if (tile.type === TILE_TYPES.UTILITY) {
        const both = BOARD
            .filter((t) => t.type === TILE_TYPES.UTILITY)
            .every((t) => session.estates?.[t.i]?.ownerId === owned.ownerId);
        return (Number(diceTotal) || 2) * 100 * (both ? 2 : 1);
    }

    const full = ownsWholeGroup(session, owned.ownerId, tile.group);
    const houses = Number(owned.houses) || 0;
    return Math.round(baseRent(tile) * (full ? 2 : 1) * (1 + houses * 0.75));
}

export function ownsWholeGroup(session, ownerId, groupKey) {
    if (!groupKey) return false;
    const tiles = tilesOfGroup(groupKey);
    if (!tiles.length) return false;
    return tiles.every((t) => session.estates?.[t.i]?.ownerId === ownerId);
}

/** 能不能在这块地上加房：得是自己的、得集齐整组、得没满级。 */
export function canUpgrade(session, playerId, tile) {
    if (!tile || tile.type !== TILE_TYPES.PROPERTY) return false;
    const owned = session.estates?.[tile.i];
    if (!owned || owned.ownerId !== playerId) return false;
    if ((Number(owned.houses) || 0) >= MAX_HOUSES) return false;
    return ownsWholeGroup(session, playerId, tile.group);
}

/** 一个玩家名下的地。 */
export function estatesOf(session, playerId) {
    return Object.values(session.estates || {}).filter((e) => e.ownerId === playerId);
}

/** 净资产 = 现金 + 地价 + 房子造价。用于超时结算和排名。 */
export function netWorth(session, player) {
    let total = Number(player.money) || 0;
    for (const e of estatesOf(session, player.id)) {
        const tile = tileAt(e.index);
        total += Number(tile.price) || 0;
        total += (Number(e.houses) || 0) * houseCost(tile);
    }
    return total;
}

/** 现金不够时能不能靠卖房卖地补上。 */
export function liquidValue(session, player) {
    let total = 0;
    for (const e of estatesOf(session, player.id)) {
        const tile = tileAt(e.index);
        // 卖回半价 —— 全额回收的话破产就几乎不可能发生了
        total += Math.round((Number(tile.price) || 0) * 0.5);
        total += (Number(e.houses) || 0) * Math.round(houseCost(tile) * 0.5);
    }
    return total;
}

/** 还在场上的玩家。 */
export function activePlayers(session) {
    return (session.players || []).filter((p) => !p.bankrupt);
}

/**
 * 胜负。
 *
 * 两条：只剩一个人没破产，或者到了轮数上限按净资产比。
 */
export function checkWin(session) {
    const alive = activePlayers(session);
    if (alive.length <= 1) {
        return { winnerId: alive[0]?.id || '', label: alive[0] ? `${alive[0].name} 获胜` : '全员破产', reason: 'bankrupt' };
    }
    if (session.round > MAX_ROUNDS) {
        const ranked = [...alive].sort((a, b) => netWorth(session, b) - netWorth(session, a));
        return { winnerId: ranked[0].id, label: `${ranked[0].name} 以净资产第一获胜`, reason: 'timeup' };
    }
    return null;
}

export function formatMoney(n) {
    const v = Math.round(Number(n) || 0);
    return v.toLocaleString('zh-CN');
}

export { BOARD, BOARD_SIZE, TILE_TYPES, tileAt, groupSize };
