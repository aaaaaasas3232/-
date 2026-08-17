/**
 * 灯塔 · 工资
 *
 * ── 这是这个 App 存在的理由 ──────────────────────────────────────
 *
 * 用户要的第一件事是「给资产系统带来一个实时的增加逻辑」。所以这个文件
 * 是整个 App 里唯一往钱包里加钱的地方，三条路径：
 *
 *   月结  进 App 时算「上次发到哪天 → 今天之间跨过了几个发薪日」，一次补齐
 *   日结  演完当天的小剧场，按 AI 给的表现评级折算，**当场到账**
 *   打赏  和日结同一条路，但可能是 0
 *
 * 外加小剧场里可能发生的一次性奖金（老板临时给的）。
 *
 * ── 一分钱都不自己记 ──────────────────────────────────────────────
 *
 * 余额和流水都在 settings 的 `sdk.assetFlow` / `sdk.persona.asset` 里 ——
 * 和红包、转账、购物、定时收入是同一本账。在这里挣的钱，
 * 去 nook 的钱包页看得到，也能立刻在四叶草里花掉。
 *
 * 自己再记一份的话，两本账迟早对不上，而且对不上的时候没有任何报错。
 *
 * ── 幂等靠 sourceId，不靠「我记得发过了」──────────────────────────
 *
 * 每一笔的 `sourceId` 都带着它的唯一由头（`薪资::工作id::日期` /
 * `日结::小剧场id`）。SDK 侧有 24h 同 sourceId 去重，加上这边自己记
 * `lastPaidDay` 游标，两层都拦得住重复发放。
 *
 * 只靠游标是不够的：游标写盘失败（隐私模式 / 配额满）时会重发；
 * 只靠 SDK 去重也不够：24h 窗口之外的重复它不管。两层一起才稳。
 */

import { FLOW_SOURCE, PERFORMANCE_LEVELS } from '../constants.js';
import { fmtMoney, money, todayKey } from '../utils.js';
import { listPaydays } from './schedule-service.js';

function sdk() {
    return (typeof window !== 'undefined' && window.settingsSdk) || null;
}

/** 读余额。读不到一律当 0，不要返回 null 让调用方去判空。 */
export function getBalance(entityId) {
    const s = sdk();
    if (!s?.assetFlow?.getBalance || !entityId) return 0;
    try {
        return money(s.assetFlow.getBalance('user', entityId));
    } catch (err) {
        console.warn('[job] 读余额失败', err);
        return 0;
    }
}

/** 只读本 App 产生的流水 */
export function listJobFlow(entityId, limit = 60) {
    const s = sdk();
    if (!s?.assetFlow?.list || !entityId) return [];
    try {
        const all = s.assetFlow.list('user', entityId, { limit: 200 });
        const mine = new Set(Object.values(FLOW_SOURCE));
        return all.filter((e) => e && mine.has(e.sourceType)).slice(0, limit);
    } catch (err) {
        console.warn('[job] 读流水失败', err);
        return [];
    }
}

/** 结算定时收入，进 App 时调一次，免得用户看到的是过期余额 */
export async function settleIncome(entityId) {
    const s = sdk();
    if (!s?.assetFlow?.settleAndSync || !entityId) return;
    try {
        await s.assetFlow.settleAndSync('user', entityId);
    } catch (err) {
        console.warn('[job] 结算定时收入失败', err);
    }
}

/**
 * 往钱包里加一笔。
 *
 * ★ 这是本文件唯一真正写钱的函数，其他三个都调它。
 *   收口在一处是为了让「所有进账都有 sourceId、都能被撤回」成为结构上的保证，
 *   而不是「每个调用点都记得传」这种靠纪律维持的东西。
 *
 * @returns {Promise<{ok:boolean, amount:number, balance?:number, error?:string, duplicated?:boolean}>}
 */
async function credit(opts = {}) {
    const {
        entityId, amount, note = '', sourceType = FLOW_SOURCE.salary, sourceId = '',
        employer = '', employerId = '',
    } = opts;

    const value = money(amount);
    if (!entityId) return { ok: false, amount: 0, error: '不知道给谁发' };
    if (value <= 0) return { ok: false, amount: 0, error: '金额是 0，没发' };

    const s = sdk();
    if (!s?.assetFlow?.add) return { ok: false, amount: 0, error: '资产系统还没就绪' };

    try {
        const res = await s.assetFlow.add({
            type: 'job',
            direction: 'in',
            amount: value,
            counterpartyType: 'system',
            counterpartyId: employerId || 'job',
            counterpartyName: employer || '灯塔',
            sourceType,
            sourceId,
            note,
        }, 'user', entityId);

        if (!res?.ok) return { ok: false, amount: 0, error: res?.error || '入账失败' };
        // duplicated = SDK 认出这是 24h 内的重复，当成成功但金额算 0，
        // 否则 UI 会显示「+2000」而余额没动
        if (res.duplicated) return { ok: true, amount: 0, duplicated: true, balance: getBalance(entityId) };
        return { ok: true, amount: value, balance: money(res.balance ?? getBalance(entityId)) };
    } catch (err) {
        console.error('[job] 入账抛异常', err);
        return { ok: false, amount: 0, error: err?.message || String(err) };
    }
}

// ============================================================
// 月结
// ============================================================

/**
 * 补发一份工作欠的月薪。
 *
 * 什么时候调：每次 App 打开（`store.hydrate`）。用户可能几个月没进来，
 * 那就一次把这几个月都补上 —— 「打开网页 js 就动态计算这件事」。
 *
 * `post.pay.lastPaidDay` 是游标：上一次发到哪天。入职时初始化成入职当天，
 * 所以入职当天之前的发薪日不会被补发（不然刚入职就先领一笔上个月的）。
 *
 * @returns {Promise<{paid:number, times:number, days:string[]}>}
 */
export async function settleMonthly(entityId, post) {
    const pay = post?.pay || {};
    if (pay.mode !== 'monthly') return { paid: 0, times: 0, days: [] };
    const amount = money(pay.amount);
    if (amount <= 0) return { paid: 0, times: 0, days: [] };

    const today = todayKey();
    const since = pay.lastPaidDay || post.startDay || today;
    const days = listPaydays(pay.payDay, since, today);
    if (!days.length) return { paid: 0, times: 0, days: [] };

    let paid = 0;
    const done = [];
    for (const day of days) {
        const res = await credit({
            entityId,
            amount,
            note: `${post.title || '工作'} · ${day.slice(5)} 工资`,
            sourceType: FLOW_SOURCE.salary,
            // ★ 由头唯一：同一份工作同一个发薪日只可能发一次
            sourceId: `job-salary::${post.id}::${day}`,
            employer: post.company || post.title || '',
            employerId: post.id,
        });
        if (!res.ok) break;      // 失败就停下，游标不往前推，下次还能补
        paid += res.amount;
        done.push(day);
    }

    if (done.length) {
        // 游标推到实际发成功的最后一天，不是 today —— 中间失败时才补得回来
        pay.lastPaidDay = done[done.length - 1];
    }
    return { paid, times: done.length, days: done };
}

/** 一句人话，用在灵动岛和 toast 上 */
export function describeSettle(result, currency = '金币') {
    if (!result || result.times <= 0) return '';
    if (result.times === 1) return `发工资了，+${fmtMoney(result.paid)} ${currency}`;
    return `补发了 ${result.times} 个月，共 +${fmtMoney(result.paid)} ${currency}`;
}

// ============================================================
// 日结 / 打赏
// ============================================================

/** 表现评级 → 系数。认不出来的当「正常」，不要当 0（那等于白干一天）。 */
export function factorOf(level) {
    const hit = PERFORMANCE_LEVELS.find((l) => l.id === level);
    return hit ? hit.factor : 0.7;
}

export function labelOfLevel(level) {
    return PERFORMANCE_LEVELS.find((l) => l.id === level)?.label || '正常';
}

/**
 * 按当天表现算这一天该拿多少。
 *
 * 公式刻意简单：`base + (max - base) × 系数`，再叠上 AI 给的一次性奖金。
 * 复杂公式在这里没有价值 —— 用户看不到公式，只看到「今天拿了多少」，
 * 而他需要能预期「演得好就多拿」。
 *
 * 打赏模式没有保底：系数 0 就是真的 0，那天白站了。
 */
export function computeDaily(pay = {}, level = 'ok') {
    const factor = factorOf(level);
    const base = money(pay.mode === 'tip' ? 0 : pay.dailyBase);
    const max = Math.max(base, money(pay.dailyMax));
    return money(base + (max - base) * factor);
}

/**
 * 演完一场，结算当天的钱。
 *
 * @param {string} entityId
 * @param {object} post
 * @param {object} theater  已经存好的小剧场（要 id / day / performance）
 * @returns {Promise<{ok:boolean, amount:number, bonus:number, error?:string}>}
 */
export async function settleTheater(entityId, post, theater) {
    const pay = post?.pay || {};
    if (pay.mode === 'monthly') {
        // 月结的工作演小剧场不当天结钱，但可能有一次性奖金
        return settleBonus(entityId, post, theater);
    }

    const level = theater?.performance?.level || 'ok';
    const daily = computeDaily(pay, level);
    const bonus = money(theater?.performance?.bonus);
    const total = money(daily + bonus);
    if (total <= 0) {
        return { ok: true, amount: 0, bonus: 0 };
    }

    const label = labelOfLevel(level);
    const res = await credit({
        entityId,
        amount: total,
        note: `${post.title || '工作'} · ${theater.day} ${label}${bonus > 0 ? '（含奖金）' : ''}`,
        sourceType: pay.mode === 'tip' ? FLOW_SOURCE.tip : FLOW_SOURCE.daily,
        sourceId: `job-daily::${theater.id}`,
        employer: post.company || post.title || '',
        employerId: post.id,
    });
    return { ok: res.ok, amount: res.amount, bonus, error: res.error };
}

/** 月结工作的一次性奖金（老板临时给的那种） */
async function settleBonus(entityId, post, theater) {
    const bonus = money(theater?.performance?.bonus);
    if (bonus <= 0) return { ok: true, amount: 0, bonus: 0 };
    const res = await credit({
        entityId,
        amount: bonus,
        note: `${post.title || '工作'} · ${theater.day} 额外`,
        sourceType: FLOW_SOURCE.bonus,
        sourceId: `job-bonus::${theater.id}`,
        employer: post.company || post.title || '',
        employerId: post.id,
    });
    return { ok: res.ok, amount: res.amount, bonus, error: res.error };
}

/**
 * 撤回某一场小剧场带来的钱。
 *
 * 用户删掉小剧场 / 重 roll 时调。走 `removeBySource` 而不是「再加一笔出账」——
 * 后者会在流水里留下一进一出两条，用户看着像是发过两次。
 */
export async function revokeTheaterPay(entityId, theaterId) {
    const s = sdk();
    if (!s?.assetFlow?.removeBySource || !entityId || !theaterId) return;
    for (const [sourceType, sourceId] of [
        [FLOW_SOURCE.daily, `job-daily::${theaterId}`],
        [FLOW_SOURCE.tip, `job-daily::${theaterId}`],
        [FLOW_SOURCE.bonus, `job-bonus::${theaterId}`],
    ]) {
        try {
            await s.assetFlow.removeBySource(sourceType, sourceId, 'user', entityId);
        } catch (err) {
            console.warn('[job] 撤回当天收入失败', err);
        }
    }
}

/** 一份工作的收入口径，卡片上显示一行 */
export function describePay(pay = {}, currency = '金币') {
    const mode = pay.mode || 'monthly';
    if (mode === 'monthly') {
        return `月结 · 每月 ${pay.payDay || 1} 号 ${fmtMoney(pay.amount)} ${currency}`;
    }
    if (mode === 'tip') {
        return `打赏 · 单日最多 ${fmtMoney(pay.dailyMax)} ${currency}`;
    }
    return `日结 · ${fmtMoney(pay.dailyBase)}~${fmtMoney(pay.dailyMax)} ${currency}`;
}
