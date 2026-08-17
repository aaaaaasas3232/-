/**
 * 灯塔 · 工作日期表
 *
 * 「今天上不上班」这个判断在 App 里有五个消费方（日历格子、生成按钮的
 * 可用状态、月历统计、月结补发、给 AI 的上下文）。所以它必须只有一份实现 ——
 * 同一业务口径出现第二份实现的那一刻就该抽文件，三份必错。
 *
 * ── 三种排班 ──────────────────────────────────────────────────────
 *
 *   weekly   勾周几。`shift.weekdays = [1,2,3,4,5]`
 *   custom   在日历上点。`shift.days = ['2026-08-17', ...]`
 *   free     没有休息日的概念，哪天都能演
 *
 * 三种都受同一条硬约束：**一天只能演一场**。这不是排班的一部分，
 * 是「让时间真的在走」的手段，所以写在 `canPlay()` 里而不是排班判断里。
 *
 * ── 日期一律用 `YYYY-MM-DD` 字符串 ─────────────────────────────────
 *
 * 不存时间戳。时间戳带时区，跨零点算「今天」会差一天，
 * 而这个 App 里「今天算不算工作日」「今天演过没有」全靠日期键去比。
 */

import { WEEKDAYS } from '../constants.js';
import {
    asArray, dayKey, dayDate, daysInMonth, todayKey, weekdayOf, addDays, daysBetween,
} from '../utils.js';

/** 一份工作的默认排班：周一到周五 */
export function makeShift(mode = 'weekly') {
    return {
        mode,
        weekdays: [1, 2, 3, 4, 5],
        /** custom 模式下点亮的日期键 */
        days: [],
        /** 额外请假的日子（任何模式都生效，优先级最高） */
        offDays: [],
    };
}

/**
 * 这一天上不上班。
 *
 * ★ 请假（offDays）优先级最高，连自由职业都认 —— 用户明确说了「这天不干」，
 *   就不该因为「自由职业没有休息日」而被忽略。
 */
export function isWorkday(shift, day) {
    if (!day) return false;
    const s = shift || makeShift();
    if (asArray(s.offDays).includes(day)) return false;
    if (s.mode === 'free') return true;
    if (s.mode === 'custom') return asArray(s.days).includes(day);
    const wd = weekdayOf(day);
    return wd >= 0 && asArray(s.weekdays).includes(wd);
}

/**
 * 这一天能不能演。
 *
 * 三种「不能」的原因要分得清，UI 上给的话术完全不同：
 *   future   还没到那天 —— 别让用户提前把一周演完
 *   rest     休息日 —— 这是排班的结果，不是错误
 *   done     今天演过了 —— 明天再来
 *
 * @returns {{ ok: boolean, reason: ''|'future'|'rest'|'done', text: string }}
 */
export function canPlay(shift, day, playedDays = []) {
    const today = todayKey();
    if (!day) return { ok: false, reason: 'rest', text: '选一天' };
    if (day > today) {
        return { ok: false, reason: 'future', text: '这天还没到' };
    }
    if (asArray(playedDays).includes(day)) {
        return { ok: false, reason: 'done', text: '这天已经演过了' };
    }
    if (!isWorkday(shift, day)) {
        return { ok: false, reason: 'rest', text: '这天休息' };
    }
    return { ok: true, reason: '', text: '' };
}

/** 排班的一句人话，卡片上显示 */
export function describeShift(shift) {
    const s = shift || makeShift();
    if (s.mode === 'free') return '自由安排';
    if (s.mode === 'custom') {
        const n = asArray(s.days).length;
        return n ? `自己排 · 共 ${n} 天` : '自己排 · 还没点日子';
    }
    const days = asArray(s.weekdays).slice().sort((a, b) => a - b);
    if (!days.length) return '一天都没排';
    if (days.length === 7) return '每天都上';
    const names = days.map((d) => WEEKDAYS.find((w) => w.id === d)?.short || '').filter(Boolean);
    return `每周 ${names.join('、')}`;
}

// ============================================================
// 月历
// ============================================================

/**
 * 造一个月的格子。
 *
 * 前面补空格让 1 号落在正确的星期列上 —— 不补的话整个月错位，
 * 而用户不会怀疑是日历错了，只会觉得排班怎么对不上。
 *
 * @returns {{ year:number, month:number, cells: Array }}
 *   cell = { day, num, blank, workday, played, today, future, off }
 */
export function buildMonth(year, month, opts = {}) {
    const { shift, playedDays = [] } = opts;
    const today = todayKey();
    const total = daysInMonth(year, month);
    const firstWeekday = new Date(year, month - 1, 1).getDay();

    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) {
        cells.push({ blank: true, day: '', num: 0 });
    }
    for (let d = 1; d <= total; d += 1) {
        const day = dayKey(new Date(year, month - 1, d));
        cells.push({
            blank: false,
            day,
            num: d,
            workday: isWorkday(shift, day),
            off: asArray(shift?.offDays).includes(day),
            played: asArray(playedDays).includes(day),
            today: day === today,
            future: day > today,
        });
    }
    return { year, month, cells };
}

/** 上/下一个月 */
export function shiftMonth(year, month, delta) {
    const d = new Date(year, month - 1 + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** 这个月一共几天班、演了几天 */
export function monthStats(year, month, opts = {}) {
    const { cells } = buildMonth(year, month, opts);
    let work = 0;
    let played = 0;
    for (const c of cells) {
        if (c.blank) continue;
        if (c.workday) work += 1;
        if (c.played) played += 1;
    }
    return { work, played };
}

// ============================================================
// 月结日
// ============================================================

/**
 * 从 `since`（不含）到 `until`（含）之间，一共经过了几个发薪日。
 *
 * 这就是「用户几个月没开这个 App，回来一次性补齐」的实现。
 * 按**发薪日**逐个数，而不是按「过了几个月 × 一次工资」——
 * 后者在「9 月 30 号入职、发薪日是 10 号」这种情况下会多发一次。
 *
 * @param {number} payDay  每月几号发（1~28；超过当月天数的按当月最后一天算）
 * @param {string} since   上次发到哪天（日期键；空表示从 fallbackStart 起算）
 * @param {string} until   算到哪天（一般是今天）
 * @returns {string[]} 命中的发薪日，按时间升序
 */
export function listPaydays(payDay, since, until) {
    const from = dayDate(since);
    const to = dayDate(until);
    if (!from || !to || to <= from) return [];
    // 超过 3 年不再往回补 —— 那多半是系统时间被改过，
    // 一次补 36 笔工资比少补几笔更难解释
    if (daysBetween(since, until) > 1100) return [];

    const out = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const guard = new Date(to.getFullYear(), to.getMonth() + 1, 1);
    while (cursor < guard) {
        const y = cursor.getFullYear();
        const m = cursor.getMonth() + 1;
        const num = Math.min(Math.max(1, Math.floor(payDay) || 1), daysInMonth(y, m));
        const key = dayKey(new Date(y, m - 1, num));
        if (key > since && key <= until) out.push(key);
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
}

/** 下一个发薪日是哪天（含今天） */
export function nextPayday(payDay, from = todayKey()) {
    const d = dayDate(from);
    if (!d) return '';
    for (let i = 0; i < 2; i += 1) {
        const y = d.getFullYear();
        const m = d.getMonth() + 1 + i;
        const real = new Date(y, m - 1, 1);
        const num = Math.min(
            Math.max(1, Math.floor(payDay) || 1),
            daysInMonth(real.getFullYear(), real.getMonth() + 1),
        );
        const key = dayKey(new Date(real.getFullYear(), real.getMonth(), num));
        if (key >= from) return key;
    }
    return '';
}

/** 距离下一个发薪日还有几天 */
export function daysToPayday(payDay) {
    const next = nextPayday(payDay);
    return next ? daysBetween(todayKey(), next) : -1;
}

/** 最近 n 个工作日（含今天，倒序），给「补演」入口用 */
export function recentWorkdays(shift, n = 14) {
    const out = [];
    let cursor = todayKey();
    for (let i = 0; i < 60 && out.length < n; i += 1) {
        if (isWorkday(shift, cursor)) out.push(cursor);
        cursor = addDays(cursor, -1);
    }
    return out;
}
