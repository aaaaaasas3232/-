/**
 * 四叶草 · 钱包
 *
 * ── 资金真的会动 ──────────────────────────────────────────────────
 *
 * 这个 App 不自己记一本账。用户和 AI 的余额、流水都在 settings 的
 * `sdk.assetFlow` / `sdk.persona.asset` 里 —— 和红包、转账、定时收入是同一本账。
 * 在购物软件里花掉的钱，去 nook 的钱包页看得到；在聊天里收到的红包，
 * 这里也能立刻用来买东西。
 *
 * 自己再记一份的话，两本账迟早对不上，而且对不上的时候没有任何报错。
 *
 * ── 一笔交易只扣一边 ──────────────────────────────────────────────
 *
 * 用户送 AI 一件礼物：钱是付给店家的，不是付给 AI 的。
 * 所以只扣用户，不加 AI 的余额 —— AI 得到的是**东西**不是钱。
 * 反过来 AI 送用户东西也一样，只扣 AI。
 *
 * 这条看起来是废话，但很容易写成「转账」那种双边模型，
 * 然后出现「互相送礼两个人都变有钱」的荒唐结果。
 */

import { FLOW_SOURCE } from '../constants.js';
import { fmtMoney, money } from '../utils.js';

function sdk() {
    return (typeof window !== 'undefined' && window.settingsSdk) || null;
}

/** 读余额。读不到一律当 0，不要返回 null 让调用方去判空。 */
export function getBalance(entityType, entityId) {
    const s = sdk();
    if (!s?.assetFlow?.getBalance || !entityId) return 0;
    try {
        return money(s.assetFlow.getBalance(entityType, entityId));
    } catch (err) {
        console.warn('[shop] 读余额失败', err);
        return 0;
    }
}

/** 读流水，只要本 App 产生的那些 */
export function listShopFlow(entityType, entityId, limit = 50) {
    const s = sdk();
    if (!s?.assetFlow?.list || !entityId) return [];
    try {
        const all = s.assetFlow.list(entityType, entityId, { limit: 200 });
        const mine = new Set(Object.values(FLOW_SOURCE));
        return all.filter((e) => e && mine.has(e.sourceType)).slice(0, limit);
    } catch (err) {
        console.warn('[shop] 读流水失败', err);
        return [];
    }
}

/** 读全部流水（钱包页要看得到全貌，不只是购物那部分） */
export function listAllFlow(entityType, entityId, limit = 60) {
    const s = sdk();
    if (!s?.assetFlow?.list || !entityId) return [];
    try {
        return s.assetFlow.list(entityType, entityId, { limit });
    } catch (err) {
        console.warn('[shop] 读流水失败', err);
        return [];
    }
}

/**
 * 扣一笔钱。
 *
 * 余额不够时 **不扣、返回失败**。`sdk.assetFlow.add` 内部也有同样的检查
 * （那是最后一道防线），这里先查一次是为了给出更好的提示 ——
 * SDK 只会说「余额不足」，不会说差多少。
 *
 * @param {object} opts
 * @param {'user'|'ai'} opts.entityType
 * @param {string} opts.entityId
 * @param {number} opts.amount
 * @param {string} opts.note            流水备注，会显示在钱包页
 * @param {string} opts.sourceType      FLOW_SOURCE 里的一个
 * @param {string} opts.sourceId        订单 id，用于撤销和去重
 * @param {object} [opts.counterparty]  { type, id, name } 对方是谁
 * @returns {Promise<{ok:boolean, balance?:number, error?:string, short?:number}>}
 */
export async function charge(opts = {}) {
    const {
        entityType = 'user', entityId, amount, note = '',
        sourceType = FLOW_SOURCE.purchase, sourceId = '', counterparty = {},
    } = opts;

    const value = money(amount);
    if (!entityId) return { ok: false, error: '不知道扣谁的钱' };
    if (value <= 0) return { ok: false, error: '金额不对' };

    const s = sdk();
    if (!s?.assetFlow?.add) return { ok: false, error: '资产系统还没就绪' };

    const balance = getBalance(entityType, entityId);
    if (balance < value) {
        return {
            ok: false,
            error: `余额不够，还差 ${fmtMoney(value - balance)}`,
            short: money(value - balance),
            balance,
        };
    }

    try {
        const res = await s.assetFlow.add({
            type: 'shop',
            direction: 'out',
            amount: value,
            counterpartyType: counterparty.type || 'system',
            counterpartyId: counterparty.id || 'shop',
            counterpartyName: counterparty.name || '四叶草',
            sourceType,
            sourceId,
            note,
        }, entityType, entityId);

        if (!res?.ok) {
            return { ok: false, error: res?.error || '扣款失败' };
        }
        return { ok: true, balance: money(res.balance ?? getBalance(entityType, entityId)) };
    } catch (err) {
        console.error('[shop] 扣款抛异常', err);
        return { ok: false, error: err?.message || String(err) };
    }
}

/**
 * 退一笔钱（撤销订单）。
 *
 * 走 `removeBySource` 而不是「再加一笔进账」—— 后者会在流水里留下
 * 一出一进两条，用户看着像是花了两次。撤销就该当它没发生过。
 */
export async function refund(entityType, entityId, sourceType, sourceId) {
    const s = sdk();
    if (!s?.assetFlow?.removeBySource || !entityId || !sourceId) return { ok: false };
    try {
        const res = await s.assetFlow.removeBySource(sourceType, sourceId, entityType, entityId);
        return { ok: res?.ok === true, removed: res?.removed || 0 };
    } catch (err) {
        console.warn('[shop] 退款失败', err);
        return { ok: false };
    }
}

/** 结算定时收入，进 App 时调一次，免得用户看到的是过期余额 */
export async function settle(entityType, entityId) {
    const s = sdk();
    if (!s?.assetFlow?.settleAndSync || !entityId) return;
    try {
        await s.assetFlow.settleAndSync(entityType, entityId);
    } catch (err) {
        console.warn('[shop] 结算定时收入失败', err);
    }
}

/** 流水条目 → 一行人话 */
export function describeFlow(entry, currency = '金币') {
    if (!entry) return '';
    const sign = entry.direction === 'in' ? '+' : '−';
    return `${sign}${fmtMoney(entry.amount)} ${currency} · ${entry.note || entry.counterpartyName || ''}`;
}
