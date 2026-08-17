/**
 * 点灯 · 记忆调度
 *
 * 单词机的四个自评档（不记得 / 模糊 / 记错了 / 完全记得）驱动一个
 * 极简的间隔重复：答得好就往后推一档，答砸了就退回去。
 *
 * 刻意没做成 SM-2/Anki 那套带 easeFactor 的算法 ——
 * 这里的条目大多是老师随手塞进来的短句，用户也不会天天来打卡，
 * 一套「梯度 + 分区权重」比一套假装很科学的公式更好预测。
 *
 * 纯函数，不碰 DB，不碰时间以外的任何环境。
 */

import { DICT_BUCKETS, RECALL_GRADES, SRS_STEPS } from '../constants.js';
import { asArray, clamp } from '../utils.js';

const HOUR = 3600 * 1000;

const GRADE_MAP = new Map(RECALL_GRADES.map((g) => [g.id, g]));
const BUCKET_IDS = new Set(DICT_BUCKETS.map((b) => b.id));

/** 分区对出现频率的加权：不深刻的更容易被抽到 */
const BUCKET_WEIGHT = Object.freeze({
    weak: 3.2,
    normal: 1,
    mastered: 0.12,
});

/** 分区对间隔的缩放：标了「已记住」的间隔直接拉长 */
const BUCKET_INTERVAL = Object.freeze({
    weak: 0.45,
    normal: 1,
    mastered: 3.5,
});

/**
 * 用户自评之后，算出这条的下一次出现时间。
 * 只返回要改的字段，调用方自己合并。
 */
export function grade(entry, gradeId, now = Date.now()) {
    const g = GRADE_MAP.get(gradeId) || GRADE_MAP.get('fuzzy');
    const bucket = BUCKET_IDS.has(entry?.bucket) ? entry.bucket : 'normal';
    const step = clamp(Number(entry?.step) || 0, 0, SRS_STEPS.length - 1);

    let nextStep;
    if (g.id === 'known') nextStep = Math.min(step + 1, SRS_STEPS.length - 1);
    else if (g.id === 'fuzzy') nextStep = step;                      // 原地踏步，再见一次
    else if (g.id === 'wrong') nextStep = Math.max(0, step - 2);     // 记错了退两档，比忘了更该重来
    else nextStep = 0;                                               // 完全不记得，从头

    const hours = SRS_STEPS[nextStep] * (BUCKET_INTERVAL[bucket] || 1);
    const lapsed = g.id === 'forgot' || g.id === 'wrong';

    return {
        step: nextStep,
        dueAt: now + hours * HOUR,
        reps: (Number(entry?.reps) || 0) + 1,
        lapses: (Number(entry?.lapses) || 0) + (lapsed ? 1 : 0),
        lastGrade: g.id,
        lastSeenAt: now,
        // 连着栽三次就自动降到「不深刻」区，不用等用户手动标
        bucket: (!lapsed || bucket === 'mastered')
            ? bucket
            : (((Number(entry?.lapses) || 0) + 1) >= 3 ? 'weak' : bucket),
    };
}

/** 到点该复习的 */
export function isDue(entry, now = Date.now()) {
    if (!entry || entry.muted) return false;
    return (Number(entry.dueAt) || 0) <= now;
}

/**
 * 抽一条来播。
 *
 * 规则：
 *   1. 先从「到点了」的里面按权重抽
 *   2. 一条都没到点就从全部里按权重抽（弹幕不能停下来干等）
 *   3. 刚播过的尽量不连着再播（recent 是最近播过的 id）
 */
export function pickNext(entries, { now = Date.now(), recent = [], includeMastered = true } = {}) {
    const pool = asArray(entries).filter((e) => (
        e && !e.muted && e.front && (includeMastered || e.bucket !== 'mastered')
    ));
    if (pool.length === 0) return null;

    const recentSet = new Set(asArray(recent).map(String));
    const due = pool.filter((e) => isDue(e, now));
    let candidates = due.length ? due : pool;

    // 排掉刚播过的，但别把池子排空
    const fresh = candidates.filter((e) => !recentSet.has(String(e.id)));
    if (fresh.length > 0) candidates = fresh;

    let total = 0;
    const weights = candidates.map((e) => {
        const w = (BUCKET_WEIGHT[e.bucket] || 1)
            // 越过期越优先
            * (1 + clamp((now - (Number(e.dueAt) || now)) / (24 * HOUR), 0, 4) * 0.4);
        total += w;
        return w;
    });

    let roll = Math.random() * total;
    for (let i = 0; i < candidates.length; i += 1) {
        roll -= weights[i];
        if (roll <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
}

/** 一次抽一批（弹幕预填队列用，避免每条都跑一次加权） */
export function pickBatch(entries, count = 12, options = {}) {
    const out = [];
    const recent = [...asArray(options.recent).map(String)];
    for (let i = 0; i < count; i += 1) {
        const hit = pickNext(entries, { ...options, recent });
        if (!hit) break;
        out.push(hit);
        recent.push(String(hit.id));
        if (recent.length > 24) recent.shift();
    }
    return out;
}

/** 统计，给词典页的头部用 */
export function stats(entries, now = Date.now()) {
    const list = asArray(entries).filter(Boolean);
    const out = {
        total: list.length,
        due: 0,
        weak: 0,
        normal: 0,
        mastered: 0,
        muted: 0,
        neverSeen: 0,
    };
    for (const e of list) {
        if (e.muted) out.muted += 1;
        if (isDue(e, now)) out.due += 1;
        if (!e.reps) out.neverSeen += 1;
        const bucket = BUCKET_IDS.has(e.bucket) ? e.bucket : 'normal';
        out[bucket] += 1;
    }
    return out;
}

/** 下次该出现的时间说成人话 */
export function describeDue(entry, now = Date.now()) {
    if (!entry) return '';
    if (entry.muted) return '已静音';
    const delta = (Number(entry.dueAt) || 0) - now;
    if (delta <= 0) return '待复习';
    const hours = delta / HOUR;
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} 分钟后`;
    if (hours < 24) return `${Math.round(hours)} 小时后`;
    return `${Math.round(hours / 24)} 天后`;
}
