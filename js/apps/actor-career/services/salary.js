/**
 * 追光 · 资产联动
 *
 * 所有钱都走 settingsSdk.assetFlow（src/core/asset-ledger.js 的同一本账）：
 *   收入：片酬（actor-salary）、综艺通告（actor-variety）、代言（actor-brand）、
 *         奖金（actor-award）、开档安家费（actor-start）
 *   支出：公关买断黑料（actor-pr）、事件里的大额支出（actor-event）
 *
 * sourceType + sourceId 是幂等键：同一部剧的片酬点十次也只入账一次。
 */

import { chargeAsset, getAssetBalance, normalizeMoney } from '@/src/core/asset-ledger.js';

function sdk() {
    return (typeof window !== 'undefined' && window.settingsSdk) || null;
}

export function userBalance(userId) {
    return getAssetBalance('user', userId);
}

/**
 * 幂等入账。
 * @returns {{ok:boolean, duplicated?:boolean, balance?:number, error?:string}}
 */
export async function grantIncome({ userId, amount, sourceType, sourceId, note, counterpartyName }) {
    const value = normalizeMoney(amount);
    const s = sdk();
    if (!s?.assetFlow?.add || !userId) return { ok: false, error: '资产系统还没就绪' };
    if (value <= 0) return { ok: false, error: '金额必须大于 0' };
    if (!sourceType || !sourceId) return { ok: false, error: '入账必须提供稳定凭据' };

    try {
        if (typeof s.assetFlow.listBySource === 'function') {
            const existing = s.assetFlow.listBySource(sourceType, sourceId, {
                entityType: 'user', entityId: userId,
            }).find((entry) => entry?.direction === 'in');
            if (existing) {
                return { ok: true, duplicated: true, balance: userBalance(userId) };
            }
        }
        const result = await s.assetFlow.add({
            type: 'app',
            direction: 'in',
            amount: value,
            counterpartyType: 'system',
            counterpartyId: 'actor-career',
            counterpartyName: counterpartyName || '剧组制片',
            sourceType: String(sourceType),
            sourceId: String(sourceId),
            note: String(note || ''),
        }, 'user', userId);
        if (!result?.ok) return { ok: false, error: result?.error || '入账失败' };
        return { ok: true, duplicated: result.duplicated === true, balance: userBalance(userId) };
    } catch (err) {
        console.error('[actor] 入账失败', err);
        return { ok: false, error: err?.message || String(err) };
    }
}

/** 公关买断黑料（幂等扣款） */
export async function chargePr({ userId, amount, sourceId, note }) {
    return chargeAsset({
        entityType: 'user',
        entityId: userId,
        amount,
        sourceType: 'actor-pr',
        sourceId,
        note: note || '公关费用：买断黑料',
        ledgerType: 'app',
        counterparty: { type: 'system', id: 'actor-career', name: '公关团队' },
    });
}

/** 事件里的大额支出（补税这类） */
export async function chargeEventCost({ userId, amount, sourceId, note }) {
    return chargeAsset({
        entityType: 'user',
        entityId: userId,
        amount,
        sourceType: 'actor-event',
        sourceId,
        note: note || '突发事件支出',
        ledgerType: 'app',
        counterparty: { type: 'system', id: 'actor-career', name: '突发事件' },
    });
}
