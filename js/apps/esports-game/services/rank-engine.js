/**
 * 赛点 · 排位引擎（纯函数）
 *
 * 一次排位 = 一批局。每局：
 *   我方战力 = 用户战力 × 权重 + 同行者均值 × 权重 + 熟练度加成 - 疲劳/饥饿惩罚
 *   对手战力 = 匹配基准 + 会内连胜压力（赢得越多遇到越强）
 *   resolveContest 掷定（seed = `${saveId}::rank::${day}::${session}::${i}`，回放一致）
 *   KDA / 巅峰分变化 / 熟练度成长按 grade 派生
 *
 * 路人队友与对手由素材池 seeded 现拼，不落任何身份表（他们只活在这一局里）。
 * 时间照 model.matchMinutes + 排队时间推进，跨过饭点没吃饭 → 饥饿惩罚。
 */

import { resolveContest } from '@/src/core/experience-system.js';
import {
    ENERGY_PER_GAME, HUNGER_POWER_PENALTY, MEAL_WINDOWS, PROF_MAX,
    PROF_PER_FOCUS_GAME, PROF_PER_GAME, QUEUE_MINUTES, RATING_LOSE_BASE,
    RATING_WIN_BASE, TRAINING_GAMES, rankModeById,
} from '../constants.js';
import { profPowerBonus } from '../constants.js';
import { clamp, hashString, seededRandom } from '../utils.js';

/** 路人 ID 池（不落盘 —— 他们只活在对局记录的字符串里） */
export const PASSERBY_POOL = Object.freeze([
    '你的野区我做主', '对面中单是我爹', '禁言局玩家', '净化型辅助', '零封评论区',
    '巅峰两千三的鱼', '代打勿扰', '省一打野(自封)', '深夜上分怪', '不许骂我妹妹',
    '一秒三喷', '心态好到爆炸', '闪现撞墙', '蹲草一小时', '经济第一战犯',
    '让一手再赢', '开局送三个', '决赛圈舞王', '人机都比我强', '别催我出装',
]);

export function passerbyName(seedText) {
    return PASSERBY_POOL[hashString(seedText) % PASSERBY_POOL.length];
}

/** 会话的时间预估：总分钟（含排队）+ 需要的吃饭停顿 */
export function planSession({ startMinute, count, matchMinutes, meals = {} }) {
    const perGame = matchMinutes + QUEUE_MINUTES;
    const total = perGame * count;
    const endMinute = startMinute + total;
    const mealsNeeded = [];
    for (const [key, win] of Object.entries(MEAL_WINDOWS)) {
        if (meals[key]) continue;
        // 会话会跨过这个饭点窗口的中点 → 建议先吃/中途吃
        const mid = (win.from + win.to) / 2;
        if (startMinute <= mid && endMinute >= win.from) {
            mealsNeeded.push({ key, label: win.label });
        }
    }
    return { totalMinutes: total, perGame, endMinute, mealsNeeded };
}

/** 跨过饭点没吃 → 饿 */
export function isHungry(minute, meals = {}) {
    for (const [key, win] of Object.entries(MEAL_WINDOWS)) {
        if (!meals[key] && minute > win.to) return true;
    }
    return false;
}

function kdaByGrade(rand, win, style) {
    if (style === 'asym') {
        // 求生者/监管者：救人 / 破译 / 击倒
        const big = Math.floor(rand() * 4) + (win ? 2 : 0);
        const small = Math.floor(rand() * 3);
        return {
            k: big, d: small, a: Math.floor(rand() * 3) + 1,
            text: win ? `${big}次关键操作` : `${big}次挣扎`,
        };
    }
    if (style === 'br') {
        const kills = Math.floor(rand() * 6) + (win ? 3 : 0);
        const place = win ? 1 + Math.floor(rand() * 2) : 4 + Math.floor(rand() * 14);
        return { k: kills, d: place, a: 0, text: `${kills}淘汰 · 第${place}名` };
    }
    const k = Math.floor(rand() * 8) + (win ? 4 : 1);
    const d = Math.floor(rand() * 5) + (win ? 0 : 3);
    const a = Math.floor(rand() * 10) + (win ? 5 : 2);
    return { k, d, a, text: `${k}/${d}/${a}` };
}

/**
 * 模拟一次排位（一批局，确定性）。
 *
 * @param {object} opts {
 *   seedBase, saveId, day, sessionSeq, count, modeId,
 *   userPower, companions: [{ id, name, power, type }],
 *   heroName, heroProf, focus (bool 本命练习),
 *   energy, meals, startMinute, rating,
 *   model: { matchMinutes, kdaStyle, heroNoun },
 * }
 */
export function simulateRankSession(opts) {
    const mode = rankModeById(opts.modeId);
    const model = opts.model || { matchMinutes: 26, kdaStyle: 'kda', heroNoun: '英雄' };
    const companions = Array.isArray(opts.companions) ? opts.companions : [];
    const matches = [];

    let minute = opts.startMinute;
    let energy = opts.energy;
    let rating = opts.rating;
    let wins = 0;
    let losses = 0;
    let streak = 0;
    let profGain = 0;

    for (let i = 1; i <= opts.count; i += 1) {
        const seed = `${opts.seedBase}::g${i}`;
        const rand = seededRandom(hashString(seed));

        // 我方：用户为主，同行者按人数稀释
        const compAvg = companions.length
            ? companions.reduce((acc, c) => acc + (Number(c.power) || 50), 0) / companions.length
            : opts.userPower;
        const userWeight = companions.length ? 0.55 : 1;
        let myPower = opts.userPower * userWeight + compAvg * (1 - userWeight);
        myPower += profPowerBonus(opts.heroProf);
        if (energy < 40) myPower -= 3;
        if (energy < 20) myPower -= 3;
        if (isHungry(minute, opts.meals)) myPower -= HUNGER_POWER_PENALTY;

        // 对手：按巅峰分匹配（不是按用户战力！）—— 属性高于当前分段就该赢得多，
        // 分涨上去后对手随之变硬，这才是「爬分」的物理学
        const ladder = clamp(52 + (rating - 1500) / 40, 30, 92);
        const oppPower = ladder + streak * 2 + (rand() - 0.5) * 10;

        const contest = resolveContest({
            playerScore: Math.max(1, myPower),
            opponentScore: Math.max(1, oppPower),
            upsetChance: 0.06,
            volatility: 0.22,
            random: seededRandom(hashString(`${seed}::roll`)),
        });
        const win = contest.success;
        if (win) { wins += 1; streak = Math.max(1, streak + 1); } else { losses += 1; streak = Math.min(-1, streak - 1); }

        const kda = kdaByGrade(seededRandom(hashString(`${seed}::kda`)), win, model.kdaStyle);
        const factor = mode.ratingFactor;
        const gradeBonus = contest.grade === 'miracle-win' ? 7 : contest.grade === 'decisive-win' ? 2 : 0;
        const gradePenalty = contest.grade === 'collapse' ? 6 : contest.grade === 'heavy-loss' ? 3 : 0;
        const delta = Math.round(
            (win ? (RATING_WIN_BASE + gradeBonus + Math.floor(rand() * 5)) : -(RATING_LOSE_BASE + gradePenalty + Math.floor(rand() * 5))) * factor,
        );
        rating = Math.max(0, rating + delta);

        const duration = model.matchMinutes + Math.floor(rand() * 8) - 3;
        minute += duration + QUEUE_MINUTES;
        energy = clamp(energy - (ENERGY_PER_GAME - (opts.staminaHigh ? 1 : 0)), 0, 100);
        profGain += opts.focus ? PROF_PER_FOCUS_GAME : PROF_PER_GAME;

        // 路人队友（不落盘）：补足我方空位
        const fillCount = Math.max(0, (opts.teamSize || 5) - 1 - companions.length);
        const passerbys = Array.from({ length: fillCount }, (_, x) => passerbyName(`${seed}::p${x}`));

        matches.push({
            seq: i,
            seed,
            win,
            grade: contest.grade,
            chance: Math.round(contest.chance * 1000) / 1000,
            roll: Math.round(contest.roll * 1000) / 1000,
            hero: opts.heroName,
            kda,
            kdaText: kda.text,
            ratingDelta: delta,
            ratingAfter: rating,
            duration,
            endMinute: minute,
            hungry: isHungry(minute, opts.meals),
            companions: companions.map((c) => ({ id: c.id, name: c.name, type: c.type })),
            passerbys,
            mvp: win && contest.grade !== 'close-win' && rand() < 0.55,
        });
    }

    // 属性微调建议（钳制交给声浪的 applyRankOutcome）
    const attrDeltas = {};
    if (opts.count >= 6) attrDeltas.mechanics = 1;
    if (wins >= 4 && wins > losses) attrDeltas.awareness = 1;
    if (opts.count >= 8) attrDeltas.stamina = 1;

    return {
        modeId: mode.id,
        modeLabel: mode.label,
        wins,
        losses,
        ratingBefore: opts.rating,
        ratingAfter: rating,
        ratingDelta: rating - opts.rating,
        minutesTotal: minute - opts.startMinute,
        energyAfter: energy,
        energyDelta: energy - opts.energy,
        profGain: Math.min(profGain, PROF_MAX),
        attrDeltas,
        matches,
    };
}

/** 训练赛：3 局 vs 联盟对手，不动巅峰分，可能小涨默契 */
export function simulateTraining({ seedBase, myPower, oppPower, oppName }) {
    const games = [];
    let wins = 0;
    for (let i = 1; i <= TRAINING_GAMES; i += 1) {
        const contest = resolveContest({
            playerScore: myPower,
            opponentScore: oppPower,
            upsetChance: 0.08,
            volatility: 0.2,
            random: seededRandom(hashString(`${seedBase}::t${i}`)),
        });
        if (contest.success) wins += 1;
        games.push({ no: i, win: contest.success, grade: contest.grade });
    }
    return {
        oppName,
        wins,
        losses: TRAINING_GAMES - wins,
        games,
        attrDeltas: wins >= 2 ? { synergy: 1 } : { synergy: 0, comms: 1 },
    };
}

/**
 * 某人某天的排位战绩（确定性现算，零 token）。
 * 用户「生成 TA 今日战绩」按钮只是揭示它 —— 具体对局内容看不到，
 * 但概要可以分享到 murmur 去八卦。
 */
export function dailyRecordFor({ profileKey, person, day, model }) {
    const seedBase = `record::${profileKey}::${person.id}::${day}`;
    const rand = seededRandom(hashString(seedBase));
    const games = 2 + Math.floor(rand() * 7);
    const skill = clamp(((person.attrs?.mechanics ?? 55) + (person.attrs?.awareness ?? 55)) / 2, 20, 95);
    const rows = [];
    let wins = 0;
    for (let i = 1; i <= games; i += 1) {
        const win = rand() < clamp(0.35 + (skill - 50) / 120, 0.25, 0.75);
        if (win) wins += 1;
        const hero = model.heroPool[hashString(`${seedBase}::h${i}`) % model.heroPool.length];
        rows.push({ no: i, win, hero });
    }
    const lateNight = rand() < 0.3;
    return {
        personId: person.id,
        name: person.gameId || person.realName,
        day,
        games,
        wins,
        losses: games - wins,
        heroes: [...new Set(rows.map((r) => r.hero))].slice(0, 3),
        lateNight,
        rows,
    };
}
