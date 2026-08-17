/**
 * 跨 App 资产流水入口。
 *
 * 购物、旅游机票和以后专属 App 的消费都必须写 settingsSdk.assetFlow，
 * 不能各自维护余额。sourceType + sourceId 是幂等/撤销凭据，业务 App 应保存它们。
 */

export function normalizeMoney(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;
}

function resolveSdk(explicit) {
    return explicit || ((typeof window !== 'undefined' && window.settingsSdk) || null);
}

export function getAssetBalance(entityType, entityId, options = {}) {
    const sdk = resolveSdk(options.sdk);
    if (!sdk?.assetFlow?.getBalance || !entityId) return 0;
    try {
        return normalizeMoney(sdk.assetFlow.getBalance(entityType, entityId));
    } catch (err) {
        console.warn('[asset-ledger] 读取余额失败', err);
        return 0;
    }
}

export async function chargeAsset(options = {}) {
    const {
        entityType = 'user',
        entityId = '',
        amount,
        sourceType = 'purchase',
        sourceId = '',
        note = '',
        ledgerType = 'app',
        counterparty = {},
    } = options;
    const value = normalizeMoney(amount);
    if (!entityId) return { ok: false, error: '缺少付款人' };
    if (value <= 0) return { ok: false, error: '金额必须大于 0' };
    if (!sourceType || !sourceId) {
        return { ok: false, error: '交易必须提供稳定的 sourceType 和 sourceId' };
    }

    const sdk = resolveSdk(options.sdk);
    if (!sdk?.assetFlow?.add) return { ok: false, error: '资产系统还没就绪' };

    if (typeof sdk.assetFlow.listBySource === 'function') {
        const existing = sdk.assetFlow.listBySource(sourceType, sourceId, {
            entityType,
            entityId,
        }).find((entry) => entry?.direction === 'out');
        if (existing) {
            return {
                ok: true,
                duplicated: true,
                entry: existing,
                balance: getAssetBalance(entityType, entityId, { sdk }),
            };
        }
    }

    const balance = getAssetBalance(entityType, entityId, { sdk });
    if (balance < value) {
        return {
            ok: false,
            error: '余额不足',
            balance,
            short: normalizeMoney(value - balance),
        };
    }

    try {
        const result = await sdk.assetFlow.add({
            type: String(ledgerType || 'app'),
            direction: 'out',
            amount: value,
            counterpartyType: counterparty.type || 'system',
            counterpartyId: counterparty.id || String(ledgerType || 'app'),
            counterpartyName: counterparty.name || '系统',
            sourceType: String(sourceType),
            sourceId: String(sourceId),
            note: String(note || ''),
        }, entityType, entityId);
        if (!result?.ok) return { ok: false, error: result?.error || '扣款失败' };
        return {
            ok: true,
                    duplicated: result.duplicated === true,
            entry: result.entry || null,
            balance: normalizeMoney(result.balance ?? getAssetBalance(entityType, entityId, { sdk })),
        };
    } catch (err) {
        console.error('[asset-ledger] 扣款失败', err);
        return { ok: false, error: err?.message || String(err) };
    }
}

export async function refundAsset(options = {}) {
    const {
        entityType = 'user',
        entityId = '',
        sourceType = '',
        sourceId = '',
    } = options;
    const sdk = resolveSdk(options.sdk);
    if (!sdk?.assetFlow?.removeBySource || !entityId || !sourceType || !sourceId) {
        return { ok: false, error: '缺少退款凭据' };
    }
    try {
        const result = await sdk.assetFlow.removeBySource(
            sourceType,
            sourceId,
            entityType,
            entityId,
        );
        return {
            ok: result?.ok === true,
            removed: Number(result?.removed) || 0,
            balance: getAssetBalance(entityType, entityId, { sdk }),
        };
    } catch (err) {
        console.warn('[asset-ledger] 退款失败', err);
        return { ok: false, error: err?.message || String(err) };
    }
}

export async function settleAssetIncome(entityType, entityId, options = {}) {
    const sdk = resolveSdk(options.sdk);
    if (!sdk?.assetFlow?.settleAndSync || !entityId) return { ok: false };
    try {
        const result = await sdk.assetFlow.settleAndSync(entityType, entityId);
        return {
            ok: true,
            result,
            balance: getAssetBalance(entityType, entityId, { sdk }),
        };
    } catch (err) {
        console.warn('[asset-ledger] 结算定时收入失败', err);
        return { ok: false, error: err?.message || String(err) };
    }
}

export default {
    normalizeMoney,
    getAssetBalance,
    chargeAsset,
    refundAsset,
    settleAssetIncome,
};
