/**
 * 候鸟 · 机票钱包
 *
 * 一分钱都不自己记，全走 `src/core/asset-ledger.js`（settings 的 assetFlow）——
 * 和红包、转账、四叶草购物同一本账。
 *
 * 幂等 / 退款凭据：sourceType = 'travel-ticket'，sourceId = 行程 id。
 * 重复提交同一张票 `chargeAsset` 会返回 duplicated: true，不会二次扣款。
 */

import {
    chargeAsset,
    getAssetBalance,
    refundAsset,
    settleAssetIncome,
} from '@/src/core/asset-ledger.js';
import { FLOW_SOURCE } from '../constants.js';
import { money } from '../utils.js';

/** 读用户余额。读不到一律当 0。 */
export function getBalance(userId) {
    if (!userId) return 0;
    return money(getAssetBalance('user', userId));
}

/** 进 App 时结算一次定时收入，免得用户看到过期余额 */
export async function settle(userId) {
    if (!userId) return;
    await settleAssetIncome('user', userId);
}

/**
 * 买票。原子扣款：失败 / 余额不足时不产生任何票据。
 *
 * @param {object} opts { userId, tripId, amount, note }
 * @returns {Promise<{ok:boolean, duplicated?:boolean, balance?:number, error?:string, short?:number}>}
 */
export async function buyTicket({ userId, tripId, amount, note = '' } = {}) {
    return chargeAsset({
        entityType: 'user',
        entityId: String(userId || ''),
        amount: money(amount),
        sourceType: FLOW_SOURCE.ticket,
        sourceId: String(tripId || ''),
        note,
        ledgerType: 'travel',
        counterparty: { type: 'system', id: 'travel', name: '候鸟' },
    });
}

/**
 * 退票（删除未出发行程时用）。
 * 走 removeBySource 当这笔没发生过，不在流水里留一进一出两条。
 */
export async function refundTicket({ userId, tripId } = {}) {
    return refundAsset({
        entityType: 'user',
        entityId: String(userId || ''),
        sourceType: FLOW_SOURCE.ticket,
        sourceId: String(tripId || ''),
    });
}
