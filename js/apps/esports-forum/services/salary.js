/**
 * 声浪 · 资产联动
 *
 * 所有钱都走 settingsSdk.assetFlow（src/core/asset-ledger.js 的同一本账）：
 *   收入：月薪（esports-salary）、赢场奖金（esports-bonus）、夺冠/亚军奖金（esports-prize）、
 *         代言（esports-brand）、开档安家费（esports-start）、MVP 追加（esports-mvp）
 *   支出：公关买断黑料（esports-pr）、事件大额支出（esports-event）
 *
 * sourceType + sourceId 是幂等键：同一个月的月薪、同一场的奖金只入账一次。
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
            counterpartyId: 'esports-forum',
            counterpartyName: counterpartyName || '俱乐部财务',
            sourceType: String(sourceType),
            sourceId: String(sourceId),
            note: String(note || ''),
        }, 'user', userId);
        if (!result?.ok) return { ok: false, error: result?.error || '入账失败' };
        return { ok: true, duplicated: result.duplicated === true, balance: userBalance(userId) };
    } catch (err) {
        console.error('[esports-forum] 入账失败', err);
        return { ok: false, error: err?.message || String(err) };
    }
}

/** 公关买断黑料（幂等扣款） */
export async function chargePr({ userId, amount, sourceId, note }) {
    return chargeAsset({
        entityType: 'user',
        entityId: userId,
        amount,
        sourceType: 'esports-pr',
        sourceId,
        note: note || '公关费用：压热搜',
        ledgerType: 'app',
        counterparty: { type: 'system', id: 'esports-forum', name: '俱乐部公关部' },
    });
}

/** 事件里的大额支出 */
export async function chargeEventCost({ userId, amount, sourceId, note }) {
    return chargeAsset({
        entityType: 'user',
        entityId: userId,
        amount,
        sourceType: 'esports-event',
        sourceId,
        note: note || '突发事件支出',
        ledgerType: 'app',
        counterparty: { type: 'system', id: 'esports-forum', name: '突发事件' },
    });
}
