/**
 * Settings App · 人设主页 · 资产 / 收入事件引擎
 *
 * 数据模型（persona 上）：
 *   assetBalance: number        当前持有的金币数（基准货币单位）
 *   assetLastSettledAt: number  上次结算时间戳（ms）
 *   incomeEvents: [{
 *     id, name, amount, frequency: 'monthly'|'weekly'|'daily'|'once',
 *     startDate: 'YYYY-MM-DD',
 *     dayOfMonth?: 1..31,        // frequency='monthly' 时使用（> 当月最大天数按当月最大）
 *     dayOfWeek?: 0..6,          // frequency='weekly' 时使用（0=周日）
 *     enabled: boolean,
 *     createdBy: 'settings'|'external',
 *     source?: string,           // 来源 app 标识（如 'job-app:streamer-job'）
 *     createdAt, updatedAt,
 *   }]
 *
 * 周期模型：
 *   - 从 startDate（含）开始，每个周期发放 amount。
 *   - 累计次数 = 区间 [from, to] 内该事件应发放的次数。
 *   - assetLastSettledAt 既是结算锚点，也是「已发放到」的时间戳。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** 把 Date 截到当地 00:00:00。 */
function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

/** 'YYYY-MM-DD' -> 当天 00:00 Date。 */
function parseYmd(s) {
    if (!s || typeof s !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Date -> 'YYYY-MM-DD'（本地时区）。 */
export function formatYmd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** 判断 ts 是不是有效数字时间戳。 */
function safeTs(ts) {
    return typeof ts === 'number' && Number.isFinite(ts) && ts > 0;
}

/**
 * 把任意日期 clamp 到「本地 00:00」。
 */
function ymdOf(d) {
    return formatYmd(startOfDay(d));
}

/**
 * 在 [from, to] 内对一个事件计算「应发放的累计金额」。
 * from/to 用时间戳；startDate 用 'YYYY-MM-DD'。
 */
export function computeAccrued(event, fromTs, toTs) {
    if (!event || event.enabled === false) return 0;
    const amount = Number(event.amount) || 0;
    if (!amount) return 0;
    const start = parseYmd(event.startDate);
    if (!start) return 0;
    // 锚点：取 max(结算时间, 开始时间)
    const anchorMs = Math.max(start.getTime(), safeTs(fromTs) ? fromTs : start.getTime());
    if (toTs <= anchorMs) return 0;

    const freq = event.frequency || 'monthly';
    if (freq === 'once') {
        // 一次性：只在 start 当天（或之后第一次打开）发放一次。
        // 简化：锚点在 start 当天 00:00 之后才视为可发。
        if (anchorMs >= start.getTime()) return amount;
        return 0;
    }
    if (freq === 'daily') {
        // 从 anchor 那天的 00:00 开始，每过一天算一次。
        // 直接按天数算：floor((toDay - anchorDay) / 1day) + 1
        const anchorDay = startOfDay(new Date(anchorMs));
        const toDay = startOfDay(new Date(toTs));
        const diffDays = Math.floor((toDay.getTime() - anchorDay.getTime()) / DAY_MS);
        return Math.max(0, diffDays + 1) * amount;
    }
    if (freq === 'weekly') {
        const dow = typeof event.dayOfWeek === 'number' ? event.dayOfWeek : 0;
        // 找 anchor 之后第一个 dayOfWeek（包括 anchor 当天如果是该 weekday）
        const anchorDay = startOfDay(new Date(anchorMs));
        const toDay = startOfDay(new Date(toTs));
        let count = 0;
        // cursor 从 anchorDay 开始
        let cursor = new Date(anchorDay);
        // 如果 anchor 当天不是目标 weekday，回退到上一个目标 weekday（不计入）
        // 实际上我们想要「anchor 之后（含）的每个目标 weekday 都算一次」
        // 所以从 anchorDay 开始遍历直到 toDay
        while (cursor.getTime() <= toDay.getTime()) {
            if (cursor.getDay() === dow) count++;
            cursor = new Date(cursor.getTime() + DAY_MS);
        }
        return count * amount;
    }
    // monthly: 每月 dayOfMonth（缺省 1）
    const dom = Math.min(31, Math.max(1, Number(event.dayOfMonth) || 1));
    // 锚点所在月内，先找锚点之后第一个有效 dom
    let cursor = new Date(startOfDay(new Date(anchorMs)));
    // 把 cursor 调整到本月（或下一月）的 dom
    cursor = clampToMonthDay(cursor, dom);
    if (cursor.getTime() < anchorMs) {
        // 还没到本月 dom，进到下月
        cursor = addMonths(cursor, 1);
        cursor = clampToMonthDay(cursor, dom);
    }
    let count = 0;
    while (cursor.getTime() <= toTs) {
        count++;
        cursor = addMonths(cursor, 1);
        cursor = clampToMonthDay(cursor, dom);
    }
    return count * amount;
}

/** 给定一个 Date 和 dom（1..31），返回该 Date 所在月份的第 dom 天，Date 对象。 */
function clampToMonthDay(d, dom) {
    const year = d.getFullYear();
    const month = d.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const day = Math.min(dom, lastDay);
    return new Date(year, month, day);
}

/** Date 加 n 个月（保留 dayOfMonth，溢出时压到当月最大）。 */
function addMonths(d, n) {
    const year = d.getFullYear();
    const month = d.getMonth() + n;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const day = Math.min(d.getDate(), lastDay);
    return new Date(year, month, day);
}

/**
 * 给一个 persona 对象和当前时间，返回
 *   { balance, accrued, settledAt }
 *   balance  = 当前实际余额（assetBalance + 未结算的累计 income）
 *   accrued  = 未结算的累计 income（应补发的金额）
 */
export function computePersonaBalance(persona, now = Date.now()) {
    if (!persona) return { balance: 0, accrued: 0, settledAt: 0 };
    const base = Number(persona.assetBalance) || 0;
    const settledAt = safeTs(persona.assetLastSettledAt) ? persona.assetLastSettledAt : 0;
    const events = Array.isArray(persona.incomeEvents) ? persona.incomeEvents : [];
    let accrued = 0;
    for (const ev of events) {
        accrued += computeAccrued(ev, settledAt, now);
    }
    return { balance: base + accrued, accrued, settledAt };
}

/**
 * 把 accrued 实际合到 assetBalance，并推进 assetLastSettledAt = now。
 * 不持久化，由调用方负责 await api.update(...)。
 */
export function settlePersona(persona, now = Date.now()) {
    const { accrued } = computePersonaBalance(persona, now);
    const base = Number(persona.assetBalance) || 0;
    const next = {
        ...persona,
        assetBalance: base + accrued,
        assetLastSettledAt: now,
    };
    return { next, accrued };
}

/**
 * 计算下次发放日期（粗略到天，不含时分）。
 * 返回 'YYYY-MM-DD' 或 null。
 */
export function nextOccurrence(event, now = Date.now()) {
    if (!event || event.enabled === false) return null;
    const start = parseYmd(event.startDate);
    if (!start) return null;
    const today = startOfDay(new Date(now));
    const freq = event.frequency || 'monthly';
    if (freq === 'once') {
        return start.getTime() >= today.getTime() ? formatYmd(start) : null;
    }
    if (freq === 'daily') {
        return formatYmd(today);
    }
    if (freq === 'weekly') {
        const dow = typeof event.dayOfWeek === 'number' ? event.dayOfWeek : 0;
        const diff = (dow - today.getDay() + 7) % 7;
        const next = new Date(today.getTime() + diff * DAY_MS);
        return formatYmd(next);
    }
    // monthly
    const dom = Math.min(31, Math.max(1, Number(event.dayOfMonth) || 1));
    const thisMonth = clampToMonthDay(today, dom);
    if (thisMonth.getTime() >= today.getTime()) return formatYmd(thisMonth);
    const next = clampToMonthDay(addMonths(today, 1), dom);
    return formatYmd(next);
}

/**
 * 把旧 data.assets[]（v0.20 之前的格式）迁移成新结构。
 *   - 把每个 account 的 balance 加起来作为 assetBalance
 *   - 把所有 scheduleRules 拍平去重进 incomeEvents
 *   - 删掉 assets 字段
 * 返回 { changed, patch }，patch 是要 spread 进 persona 的字段；
 * 调用方需要自行确保旧 assets 字段不再出现（例如 update 时不要把它写回去）。
 */
export function migrateLegacyAssets(persona) {
    if (!persona) return { changed: false, patch: {} };
    if (!Array.isArray(persona.assets) || persona.assets.length === 0) {
        return { changed: false, patch: {} };
    }
    const sumBalance = persona.assets.reduce(
        (s, a) => s + (Number(a.balance) || 0),
        0,
    );
    const existingEvents = Array.isArray(persona.incomeEvents) ? persona.incomeEvents : [];
    const incoming = [];
    const seen = new Set();
    for (const a of persona.assets) {
        const rules = Array.isArray(a.scheduleRules) ? a.scheduleRules : [];
        for (const r of rules) {
            const key = `${r.name || a.name || '收入'}|${r.amount || 0}|${r.frequency || 'monthly'}|${r.dayOfMonth || ''}|${r.dayOfWeek || ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            incoming.push({
                id: r.id || `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                name: r.name || a.name || '收入',
                amount: Number(r.amount) || 0,
                frequency: r.frequency || 'monthly',
                startDate: r.startDate || formatYmd(new Date()),
                dayOfMonth: r.dayOfMonth || null,
                dayOfWeek: r.dayOfWeek || null,
                enabled: r.enabled !== false,
                createdBy: 'settings',
                source: '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
        }
    }
    // patch 不带 assets 字段；调用方在更新前要从 persona 里 delete 掉 assets。
    const patch = {
        assetBalance: (Number(persona.assetBalance) || 0) + sumBalance,
        assetLastSettledAt: Date.now(),
        incomeEvents: [...existingEvents, ...incoming],
    };
    return { changed: true, patch, dropFields: ['assets'] };
}

/** 格式化金额（每三位加逗号，2 位小数）。 */
export function formatAmount(n) {
    const num = typeof n === 'number' ? n : parseFloat(n) || 0;
    return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 周期显示名。 */
export function frequencyLabel(freq) {
    if (freq === 'weekly') return '周';
    if (freq === 'daily') return '日';
    if (freq === 'once') return '一次性';
    return '月';
}