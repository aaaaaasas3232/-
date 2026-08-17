/**
 * 日记 · 经期引擎
 *
 * ── 这个文件是整个 App 里最要紧的一块 ────────────────────────────
 *
 * 它同时是「给用户看的预测」和「给 AI 的 prompt」的**唯一来源**。
 * 两者必须来自同一次 `resolveCycle()` 调用 —— 分成两条路径的话，
 * 用户在 App 里看到「还有两天」，AI 却以为「已经来了三天」，
 * 而这种不一致用户根本无从发现（她看不到 prompt）。
 *
 * ── 预测的三条依据，优先级从高到低 ────────────────────────────────
 *
 *   1. **用户今天亲手打的卡**（`state: 'period' | 'none'`）
 *   2. **最近一次实测开始日** + 实测周期中位数
 *   3. 用户在设置里填的「每个月几号」/「周期多少天」
 *
 * 第 1 条必须压过一切推算，这是产品的硬要求：
 * 「如果用户当前记录自己没有来，那跟 AI 的交互中告诉 AI，
 *   AI 后续就算刷新页面也不能觉得用户来了」。
 *
 * 实现上这一条是**天然满足**的：打卡落在 IndexedDB 里，
 * 刷新后 hydrate 回来还是同一条记录，推算永远拿不到比它更高的优先级。
 * 需要小心的只有一处 —— prompt 里必须**显式写出**「她说了还没来」，
 * 而不是靠「不提就等于没来」。模型不会替你推断沉默的含义。
 *
 * ── 为什么周期长度取中位数不取平均 ────────────────────────────────
 *
 * 一次生病或一次熬夜就能让某个周期长出 10 天。平均数会被这一个点拽走，
 * 之后每个月的预测都偏；中位数不会。
 */

import {
    CYCLE_MODE, CYCLE_STATE, CARE_TONES,
    IRREGULAR_SPREAD_DAYS, MIN_CYCLES_FOR_JUDGEMENT,
    FLOW_LEVELS, PAIN_LEVELS, PAIN_SPOTS, SYMPTOMS, PRODUCT_TYPES,
} from '../constants.js';
import {
    todayKey, addDays, daysBetween, keyToDate, monthDayToKey,
    compareDateKey, median, clamp, formatDateLabel,
} from '../utils.js';

// ============================================================
// 实测数据
// ============================================================

/**
 * 从打卡记录里还原出「每次经期是哪天开始的」。
 *
 * `isStart` 是用户点「今天来了」时打的标记。但用户可能补记，
 * 也可能只标了 `state: 'period'` 而没标 start（比如从日历上批量涂）——
 * 所以这里额外做一次推断：一段连续 period 的第一天就是开始日。
 */
export function extractPeriodStarts(days) {
    const rows = (Array.isArray(days) ? days : [])
        .filter((d) => d?.state === CYCLE_STATE.PERIOD)
        .sort((a, b) => compareDateKey(a.date, b.date));

    const starts = [];
    let prevDate = '';
    for (const row of rows) {
        const gap = prevDate ? daysBetween(prevDate, row.date) : null;
        // 显式标了 start，或者跟上一条 period 隔了不止一天 → 这是新一次的开始
        if (row.isStart === true || gap === null || gap > 1) starts.push(row.date);
        prevDate = row.date;
    }
    return starts;
}

/** 每次经期实际持续了几天 */
export function extractPeriodLengths(days) {
    const set = new Set(
        (Array.isArray(days) ? days : [])
            .filter((d) => d?.state === CYCLE_STATE.PERIOD)
            .map((d) => d.date),
    );
    const lengths = [];
    for (const start of extractPeriodStarts(days)) {
        let n = 0;
        let cursor = start;
        while (set.has(cursor) && n < 20) {
            n += 1;
            cursor = addDays(cursor, 1);
        }
        if (n > 0) lengths.push(n);
    }
    return lengths;
}

/** 相邻两次开始日的间隔 = 实测周期长度 */
export function extractCycleLengths(starts) {
    const out = [];
    for (let i = 1; i < starts.length; i += 1) {
        const gap = daysBetween(starts[i - 1], starts[i]);
        // 15~90 天之外的当成补记错误丢掉，不然一条脏数据能把中位数带偏
        if (gap != null && gap >= 15 && gap <= 90) out.push(gap);
    }
    return out;
}

// ============================================================
// 主解析
// ============================================================

/**
 * 算出今天的经期状态。**UI 和 prompt 都只读这一个函数的返回值。**
 *
 * @param {object} space   日记空间（`space.cycle` 是设置）
 * @param {object[]} days  这个空间的全部打卡记录
 * @param {string} [today] 覆盖「今天」，测试用
 * @returns {object} 见下方 return 的字段注释
 */
export function resolveCycle(space, days = [], today = todayKey()) {
    const cfg = space?.cycle || {};
    const rows = Array.isArray(days) ? days : [];

    if (!cfg.enabled) {
        return { enabled: false, state: 'off', irregular: false, phase: 'unknown' };
    }

    const starts = extractPeriodStarts(rows);
    const observedCycles = extractCycleLengths(starts);
    const observedLengths = extractPeriodLengths(rows);

    // 实测优先，没实测过就用用户填的
    const cycleLength = observedCycles.length >= 2
        ? median(observedCycles)
        : clamp(cfg.cycleLength, 15, 90);
    const periodLength = observedLengths.length >= 2
        ? median(observedLengths)
        : clamp(cfg.periodLength, 1, 15);

    const spread = observedCycles.length
        ? Math.max(...observedCycles) - Math.min(...observedCycles)
        : 0;
    // 用户自述紊乱 → 直接认；否则要攒够样本才敢下结论
    const irregular = cfg.irregular === true
        || (observedCycles.length >= MIN_CYCLES_FOR_JUDGEMENT && spread > IRREGULAR_SPREAD_DAYS);

    const lastStart = starts.length ? starts[starts.length - 1] : (cfg.lastStart || '');
    const byDate = new Map(rows.map((r) => [r.date, r]));
    const todayRec = byDate.get(today) || null;
    /** ★ 用户今天亲手打的卡。null = 还没打，不是「没来」。 */
    const confirmedToday = todayRec && todayRec.state !== CYCLE_STATE.UNKNOWN ? todayRec.state : null;

    // ── 是否正在经期中 ─────────────────────────────
    //
    // 两条来源，优先级从高到低：
    //   1. 今天亲手打了「来了」→ 从今天往回数连续的 period 打卡
    //   2. 没打卡，但设置里填了「上一次是哪天开始的」→ 按 periodLength 推
    //
    // 第 2 条不能少。只认打卡的话，一个在设置里填了「8 号开始」、
    // 但从没逐日打过卡的用户会被判成「安全期」，而 `resolvePhase` 又按
    // elapsed 算出 'menstrual' —— 生成的文案就成了
    // 「下一次预计在 9月8日 前后，目前处于经期」这种自相矛盾的话。
    //
    // ★ 「今天明确记了没来」直接否掉第 2 条：用户亲口说的永远压过推算。
    let periodDay = 0;
    if (confirmedToday === CYCLE_STATE.PERIOD) {
        let cursor = today;
        while (byDate.get(cursor)?.state === CYCLE_STATE.PERIOD && periodDay < 20) {
            periodDay += 1;
            cursor = addDays(cursor, -1);
        }
    } else if (confirmedToday !== CYCLE_STATE.NONE && lastStart) {
        const elapsed = daysBetween(lastStart, today);
        if (elapsed != null && elapsed >= 0 && elapsed < periodLength) periodDay = elapsed + 1;
    }
    const inPeriod = periodDay > 0;

    // ── 下次预计什么时候开始 ────────────────────────
    const predictedStart = predictNextStart({ cfg, cycleLength, lastStart, today, inPeriod });
    const daysUntil = predictedStart ? daysBetween(today, predictedStart) : null;

    // ── 落成一个状态 ───────────────────────────────
    let state;
    if (inPeriod) {
        state = 'in-period';
    } else if (confirmedToday === CYCLE_STATE.NONE && daysUntil != null && daysUntil <= 0) {
        // 已经过了预计日，而且用户明确说了还没来
        state = 'late';
    } else if (daysUntil == null) {
        state = 'unknown';
    } else if (daysUntil <= 0) {
        state = 'due';                                   // 到日子了，但用户还没打卡
    } else if (daysUntil <= clamp(cfg.remindDaysBefore, 0, 10)) {
        state = 'pre';                                   // 进入提醒窗口
    } else {
        state = 'safe';
    }

    const daysLate = state === 'late' || state === 'due'
        ? Math.abs(daysUntil || 0)
        : 0;

    return {
        enabled: true,
        state,                    // 'in-period' | 'pre' | 'due' | 'late' | 'safe' | 'unknown'
        phase: resolvePhase({
            inPeriod, lastStart, today, cycleLength, periodLength, state,
            confirmedNone: confirmedToday === CYCLE_STATE.NONE,
        }),
        irregular,
        periodDay,                // 经期第几天（0 = 不在经期）
        daysUntil,                // 距离预计开始还有几天（负数 = 已经过了）
        daysLate,                 // 推迟了几天
        predictedStart,
        predictedEnd: predictedStart ? addDays(predictedStart, periodLength - 1) : '',
        lastStart,
        cycleLength,
        periodLength,
        observedCycles,
        observedLengths,
        spread,
        confirmedToday,           // ★ 'period' | 'none' | null
        todayRecord: todayRec,
        remindDaysBefore: clamp(cfg.remindDaysBefore, 0, 10),
        careTone: cfg.careTone || 'caring',
        mode: cfg.mode,
        startDay: clamp(cfg.startDay, 1, 31),
    };
}

/**
 * 推算下次开始日。
 *
 * `monthday` 模式对应用户心里的「一般每个月八号」；
 * `cycle` 模式按上次开始日 + 周期长度推。
 *
 * 两种模式下都要处理「这个月的日子已经过了」：
 * 往后顺延一个月 / 一个周期，而不是返回一个过去的日期
 * （返回过去的日期会让 daysUntil 恒为负，UI 上永远显示「推迟」）。
 */
function predictNextStart({ cfg, cycleLength, lastStart, today, inPeriod }) {
    if (cfg.mode === CYCLE_MODE.CYCLE_LENGTH) {
        if (!lastStart) return '';
        let next = addDays(lastStart, cycleLength);
        // 正在经期中时，「下一次」当然是下个周期
        let guard = 0;
        while (compareDateKey(next, today) < 0 && guard < 24) {
            next = addDays(next, cycleLength);
            guard += 1;
        }
        return next;
    }

    // monthday：本月的那一号，过了就下个月
    const d = keyToDate(today);
    if (!d) return '';
    const day = clamp(cfg.startDay, 1, 31);
    let year = d.getFullYear();
    let month = d.getMonth() + 1;
    let candidate = monthDayToKey(year, month, day);

    // 正在经期中，说明本月这次已经发生了 → 直接看下个月
    const passed = compareDateKey(candidate, today) < 0 || inPeriod;
    if (passed) {
        month += 1;
        if (month > 12) { month = 1; year += 1; }
        candidate = monthDayToKey(year, month, day);
    }
    return candidate;
}

/**
 * 落到哪个生理阶段。
 *
 * 排卵日按「下次开始日往前 14 天」估 —— 黄体期长度比卵泡期稳定得多，
 * 所以倒着推比正着推准。前后各留 2 天算排卵窗口。
 *
 * ⚠️ 这是**推算不是实测**。所有面向用户和 AI 的文案都必须带「大约」，
 *    说死了会让 AI 在聊天里给出它根本没有依据的确定性。
 */
function resolvePhase({ inPeriod, lastStart, today, cycleLength, periodLength, state, confirmedNone }) {
    if (inPeriod) return 'menstrual';
    if (state === 'late') return 'late';
    if (!lastStart) return 'unknown';

    const elapsed = daysBetween(lastStart, today);
    if (elapsed == null || elapsed < 0) return 'unknown';
    if (elapsed < periodLength) {
        // 走到这里只有一种可能：用户明确记了「今天没来」，但 lastStart 说才过了几天。
        // 数据自相矛盾（多半是 lastStart 过期了），此时**不能**报「经期」——
        // 那正是用户刚刚否认过的事。老实说不知道。
        return confirmedNone ? 'unknown' : 'menstrual';
    }

    const ovulation = cycleLength - 14;
    if (elapsed >= ovulation - 2 && elapsed <= ovulation + 2) return 'ovulation';
    if (elapsed < ovulation) return 'follicular';
    return 'luteal';
}

// ============================================================
// 给用户看的一句话
// ============================================================

export function describeState(info) {
    if (!info?.enabled) return '';
    switch (info.state) {
        case 'in-period':
            return `经期第 ${info.periodDay} 天`;
        case 'pre':
            return info.daysUntil === 1 ? '明天可能就来了' : `还有 ${info.daysUntil} 天`;
        case 'due':
            return info.daysLate > 0 ? `预计日已过 ${info.daysLate} 天` : '预计就是今天';
        case 'late':
            return `已推迟 ${info.daysLate} 天`;
        case 'safe':
            return info.daysUntil != null ? `距离下次还有 ${info.daysUntil} 天` : '';
        default:
            return '还需要几次记录才能推算';
    }
}

// ============================================================
// Prompt
// ============================================================

const TONE_LINE = {
    caring: '在聊天里可以主动关心她一句，记得提醒她别碰凉的、早点休息。',
    quiet: '不用把这件事说破，但行为上照顾着 —— 递一杯热的、把节奏放慢一点。',
    plain: '当成普通的身体状况就好，不用特别渲染，也不用刻意回避。',
    avoid: '除非她自己先提起，否则不要主动提这件事。',
};

/**
 * 生成注入 system prompt 的生理期段落。
 *
 * 文案结构（对齐产品给的例子）：
 *
 *   基础句   「用户每个月 8 号会来月经，一般持续 7 天」
 *   ↓ 加强
 *   进行句   「，还有两天时间用户就要来月经，请在聊天过程中关心她」
 *   ↓ 世界观
 *   约束句   「要注意当前世界观下对月经的理解」
 *
 * 随着日子推进，进行句会自己从「还有两天」变成「还有一天」→「就是今天」
 * →「已经来了第 N 天」。**这一段每次发送都要现算**，
 * 靠缓存快照会停在生成那一刻（AGENTS2 §4.1 一起听同款问题）。
 *
 * @param {object} space
 * @param {object} info      `resolveCycle()` 的返回值
 * @param {'user'|'self'} subject  站在谁的角度说 —— AI 读用户的情况用 'user'，
 *                                 帮用户起草她自己的日记时用 'self'
 */
export function buildCyclePrompt(space, info, subject = 'user') {
    if (!info?.enabled) return '';
    const cfg = space?.cycle || {};
    const me = subject === 'self' ? '我' : '用户';
    const her = subject === 'self' ? '我' : '她';
    const lines = [];

    // ── 1. 基础规律 ─────────────────────────────
    if (info.irregular) {
        const observed = info.observedCycles.length >= 2
            ? `（近 ${info.observedCycles.length} 次实测 ${Math.min(...info.observedCycles)}~${Math.max(...info.observedCycles)} 天）`
            : '';
        lines.push(`${me}的月经周期不规律${observed}，来的日子不固定，一般持续 ${info.periodLength} 天。不要断言具体哪一天会来。`);
    } else if (cfg.mode === CYCLE_MODE.CYCLE_LENGTH) {
        lines.push(`${me}的月经周期大约 ${info.cycleLength} 天，一般持续 ${info.periodLength} 天。`);
    } else {
        lines.push(`${me}每个月 ${info.startDay} 号会来月经，一般持续 ${info.periodLength} 天。`);
    }

    // ── 2. 当前进展 ─────────────────────────────
    // ★ 顺序很重要：先说"用户亲口记录的"，再说推算的。
    //   模型对越靠前的信息越当真，而打卡永远比推算可信。
    if (info.state === 'in-period') {
        lines.push(`${me}现在正在经期，今天是第 ${info.periodDay} 天。`);
        const rec = info.todayRecord;
        const detail = describeTodayRecord(rec);
        if (detail) lines.push(`今天${her}记录的情况：${detail}。`);
    } else if (info.confirmedToday === CYCLE_STATE.NONE) {
        // ★ 产品硬要求：用户明确说了没来，AI 就不能当成来了。
        //   必须显式写这一句 —— 模型不会把"没提到"理解成"没来"。
        lines.push(`${me}今天明确记录了**还没有来**。在${her}自己更新这条记录之前，不要认为${her}已经来了，也不要用"你现在不舒服吧"这种默认${her}在经期的说法。`);
        if (info.state === 'late') {
            lines.push(`预计日已经过去 ${info.daysLate} 天了，${her}可能有点在意，但不要反复追问。`);
        }
    } else if (info.state === 'pre') {
        const n = info.daysUntil;
        const when = n === 1 ? '还有一天' : `还有 ${n} 天`;
        lines.push(`${when}时间${me}就要来月经了。`);
    } else if (info.state === 'due') {
        lines.push(info.daysLate > 0
            ? `按推算${me}这两天就该来了（预计日已过 ${info.daysLate} 天），但${her}还没有记录。`
            : `按推算今天就是${me}的预计开始日，但${her}还没有记录，不确定来没来。`);
    } else if (info.state === 'late') {
        lines.push(`${me}的月经推迟了 ${info.daysLate} 天。`);
    } else if (info.state === 'safe' && info.predictedStart) {
        lines.push(`下一次预计在 ${formatDateLabel(info.predictedStart)} 前后，目前处于${phaseName(info.phase)}。`);
    }

    // ── 3. 态度 ─────────────────────────────────
    // 只在"值得提"的时候给行为指令，平时不必每轮都提醒 AI 关心她
    const worthCaring = ['in-period', 'pre', 'due', 'late'].includes(info.state);
    if (worthCaring && subject === 'user') {
        lines.push(TONE_LINE[info.careTone] || TONE_LINE.caring);
    }

    // ── 4. 世界观 ───────────────────────────────
    // 产品原话：「要注意当前世界观下对月经的理解」
    if (String(cfg.worldNote || '').trim()) {
        lines.push(`这个世界观下对月经的理解：${cfg.worldNote.trim()}`);
    } else if (worthCaring && subject === 'user') {
        lines.push('说这件事的时候，要符合当前世界观下对月经的理解和说法，不要用现实世界的科普口吻。');
    }

    // ── 5. 用户自己追加的 ───────────────────────
    if (String(cfg.customPrompt || '').trim()) {
        lines.push(cfg.customPrompt.trim());
    }

    return lines.join('\n');
}

function phaseName(phase) {
    return {
        menstrual: '经期',
        follicular: '卵泡期',
        ovulation: '排卵期前后（推算值，不确定）',
        luteal: '黄体期',
        late: '推迟中',
        unknown: '未知阶段',
    }[phase] || '未知阶段';
}

/** 把一天的打卡摘成一句话，进 prompt 也给 UI 用 */
export function describeTodayRecord(rec) {
    if (!rec) return '';
    const label = (list, id) => list.find((x) => x.id === id)?.name || '';
    const parts = [];

    const flow = label(FLOW_LEVELS, rec.flow);
    if (flow) parts.push(`经量${flow}`);

    const pain = label(PAIN_LEVELS, rec.pain);
    if (pain && rec.pain !== 'none') {
        const spots = (rec.painSpots || []).map((s) => label(PAIN_SPOTS, s)).filter(Boolean);
        parts.push(spots.length ? `${spots.join('、')}${pain}` : `痛经${pain}`);
    }

    const symptoms = (rec.symptoms || []).map((s) => label(SYMPTOMS, s)).filter(Boolean);
    if (symptoms.length) parts.push(symptoms.join('、'));

    if (String(rec.meds || '').trim()) parts.push(`吃了${rec.meds.trim()}`);

    const product = label(PRODUCT_TYPES, rec.product);
    if (product) {
        parts.push(rec.productChanges > 0 ? `用${product}，换了 ${rec.productChanges} 次` : `用${product}`);
    }

    if (rec.temp) parts.push(`基础体温 ${rec.temp}`);
    if (String(rec.note || '').trim()) parts.push(rec.note.trim());

    return parts.join('，');
}

// ============================================================
// 日历着色
// ============================================================

/**
 * 给日历上每一天算一个标记。
 *
 * 返回 `Map<date, kind>`，kind ∈ 'period' | 'predicted' | 'fertile' | 'none'。
 * CSS 按 kind 上色（颜色仍然在 `_theme.css` 里，这里只给语义）。
 */
export function buildCalendarMarks(space, days, monthStart, monthEnd) {
    const marks = new Map();
    const info = resolveCycle(space, days);
    if (!info.enabled) return marks;

    for (const row of days) {
        if (row.date < monthStart || row.date > monthEnd) continue;
        if (row.state === CYCLE_STATE.PERIOD) marks.set(row.date, 'period');
        else if (row.state === CYCLE_STATE.NONE) marks.set(row.date, 'none');
    }

    // 预测段：只画还没被实测覆盖的日子，实测永远盖过预测
    if (info.predictedStart) {
        for (let i = 0; i < info.periodLength; i += 1) {
            const d = addDays(info.predictedStart, i);
            if (d < monthStart || d > monthEnd) continue;
            if (!marks.has(d)) marks.set(d, 'predicted');
        }
        const ovulation = addDays(info.predictedStart, -14);
        for (let i = -2; i <= 2; i += 1) {
            const d = addDays(ovulation, i);
            if (d < monthStart || d > monthEnd) continue;
            if (!marks.has(d)) marks.set(d, 'fertile');
        }
    }

    return marks;
}

export { CARE_TONES };
