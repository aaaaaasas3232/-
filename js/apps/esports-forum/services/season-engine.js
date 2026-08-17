/**
 * 声浪 · 赛季引擎（纯函数）
 *
 * ── SAB（KPL 2026 现行版）────────────────────────────────────────
 *   第一轮：按上季排名蛇形分 3 个初始组（每组 6），组内 BO5 单循环（45 场）
 *     → 每组 1/2 名进 S、3/4 名进 A、5/6 名进 B
 *   第二轮：S/A/B 各自 BO5 单循环（45 场）；B 组只有前二能打卡位赛
 *   卡位赛：BO7 ——「S5 vs A2」「S6 vs A1」定 S 组；「A5 vs B2」「A6 vs B1」定 A 组，
 *     败者（A/B 侧）赛季结束；B 组其余直接淘汰
 *   第三轮：S+A 两组 BO5 单循环（30 场）；S 全员直通季后赛，A 取前四
 *   季后赛：10 队双败 BO7（固定对阵 DAG，M1..M14），冠军从这里加冕
 *
 * ── 积分与排名 ──────────────────────────────────────────────────
 *   赢一大场积 1 分；同分先比净胜小分，再比交手胜负，最后比种子位。
 *
 * ── 确定性 ──────────────────────────────────────────────────────
 *   每场系列赛 seed = `${saveId}::${seriesId}`，每一小局再加局号。
 *   同一档同一天推进两遍，结果 deepEqual —— 回档重放一致，不存在刷赛果。
 *
 * 全部纯函数：传入 season 返回新 season，不碰存储、不碰 DOM。
 */

import { resolveContest } from '@/src/core/experience-system.js';
import { CUP, SAB, SHOWMATCH_DAYS } from '../constants.js';
import { asArray, clamp, hashString, seededRandom } from '../utils.js';

// ============================================================
// 单循环轮次表（circle method：6 队 = 5 轮 × 3 场）
// ============================================================

/** n 队单循环轮次表：返回 rounds[roundIdx] = [[a,b], ...] */
export function roundRobinRounds(teamIds) {
    const ids = [...teamIds];
    if (ids.length % 2 === 1) ids.push(null);
    const n = ids.length;
    const rounds = [];
    const rotating = ids.slice(1);
    for (let r = 0; r < n - 1; r += 1) {
        const lineup = [ids[0], ...rotating];
        const pairs = [];
        for (let i = 0; i < n / 2; i += 1) {
            const a = lineup[i];
            const b = lineup[n - 1 - i];
            if (a != null && b != null) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
        }
        rounds.push(pairs);
        rotating.unshift(rotating.pop());
    }
    return rounds;
}

/** 蛇形分组：按 ranking 顺序把 18 队分进 3 个初始组 */
export function snakeGroups(rankedTeamIds, groupCount = SAB.GROUPS) {
    const groups = Array.from({ length: groupCount }, () => []);
    rankedTeamIds.forEach((id, i) => {
        const round = Math.floor(i / groupCount);
        const pos = i % groupCount;
        const g = round % 2 === 0 ? pos : groupCount - 1 - pos;
        groups[g].push(id);
    });
    return groups;
}

// ============================================================
// 系列赛模拟（确定性）
// ============================================================

/**
 * 模拟一场 BO 系列赛。
 * @param {string} seedText  确定性种子
 * @param {number} bo        5 / 7
 * @param {{id:string,power:number}} home
 * @param {{id:string,power:number}} away
 * @param {Array} modifiers  额外修正（用户出战时由界面传入，可解释）
 */
export function simulateSeries(seedText, bo, home, away, modifiers = []) {
    const need = Math.ceil(bo / 2);
    let homeScore = 0;
    let awayScore = 0;
    const games = [];
    for (let g = 1; g <= bo; g += 1) {
        const contest = resolveContest({
            playerScore: home.power,
            opponentScore: away.power,
            modifiers,
            upsetChance: 0.08,
            volatility: 0.2,
            random: seededRandom(hashString(`${seedText}::g${g}`)),
        });
        const homeWin = contest.success;
        if (homeWin) homeScore += 1; else awayScore += 1;
        games.push({
            no: g,
            winner: homeWin ? home.id : away.id,
            chance: Math.round(contest.chance * 1000) / 1000,
            roll: Math.round(contest.roll * 1000) / 1000,
            grade: contest.grade,
            peak: bo === 7 && g === 7,   // 第七局巅峰对决（双方盲选）
        });
        if (homeScore === need || awayScore === need) break;
    }
    const winnerId = homeScore > awayScore ? home.id : away.id;
    return {
        homeScore, awayScore, winnerId,
        loserId: winnerId === home.id ? away.id : home.id,
        games,
        seed: seedText,
    };
}

/** 系列赛 MVP：胜方首发里按操作加权确定性抽一个（用户队赢则用户有权重加成） */
export function pickSeriesMvp(seedText, winnerStarters, userEntry = null) {
    const pool = winnerStarters.map((p) => ({
        id: p.id,
        weight: Math.max(1, Math.round((p.attrs?.mechanics ?? 50) + (p.attrs?.awareness ?? 50) / 2)),
    }));
    if (userEntry) pool.push({ id: userEntry.id, weight: Math.max(1, userEntry.weight) });
    const total = pool.reduce((acc, x) => acc + x.weight, 0);
    let roll = seededRandom(hashString(`${seedText}::mvp`))() * total;
    for (const item of pool) {
        roll -= item.weight;
        if (roll <= 0) return item.id;
    }
    return pool[pool.length - 1]?.id || '';
}

// ============================================================
// 积分与排名
// ============================================================

/**
 * 组内积分排名。
 * @param {Array} seriesList 该组已完成的系列赛
 * @param {Array} teamIds    组内队伍
 * @param {Array} seedOrder  兜底排序（种子位）
 */
export function computeStandings(seriesList, teamIds, seedOrder = []) {
    const rows = new Map(teamIds.map((id) => [id, {
        teamId: id, played: 0, wins: 0, losses: 0, points: 0, gameWin: 0, gameLose: 0,
    }]));
    const h2h = new Map(); // `${a}::${b}` -> a 对 b 的大场胜负差

    for (const s of seriesList) {
        if (!s?.result) continue;
        const home = rows.get(s.homeId);
        const away = rows.get(s.awayId);
        if (!home || !away) continue;
        home.played += 1; away.played += 1;
        home.gameWin += s.result.homeScore; home.gameLose += s.result.awayScore;
        away.gameWin += s.result.awayScore; away.gameLose += s.result.homeScore;
        const winner = s.result.winnerId;
        const loser = winner === s.homeId ? s.awayId : s.homeId;
        rows.get(winner).wins += 1;
        rows.get(winner).points += SAB.POINTS_WIN;
        rows.get(loser).losses += 1;
        h2h.set(`${winner}::${loser}`, (h2h.get(`${winner}::${loser}`) || 0) + 1);
    }

    const seedRank = new Map(seedOrder.map((id, i) => [id, i]));
    return [...rows.values()].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const diffA = a.gameWin - a.gameLose;
        const diffB = b.gameWin - b.gameLose;
        if (diffB !== diffA) return diffB - diffA;
        const ab = h2h.get(`${a.teamId}::${b.teamId}`) || 0;
        const ba = h2h.get(`${b.teamId}::${a.teamId}`) || 0;
        if (ab !== ba) return ab > ba ? -1 : 1;
        return (seedRank.get(a.teamId) ?? 99) - (seedRank.get(b.teamId) ?? 99);
    });
}

// ============================================================
// 赛季构建
// ============================================================

/**
 * 系列赛 id 必须由内容推导（instanceId + 阶段 + 对阵/槽位）。
 * ★ 不能用自增计数器：id 进掷签 seed，计数器跨赛季/跨次构建会漂移，
 *   「回放同冠军」直接破功（tests/esports.test.js 抓过这个 bug）。
 */
function makeSeries(instanceId, { day, phase, group = '', bo, homeId, awayId, label = '', key }) {
    return {
        id: `${instanceId}::${key}`,
        day, phase, group, bo, homeId, awayId, label,
        result: null,
    };
}

/** 第一轮日程：每天 3 场 = 三个组各出一轮里的一场；轮换排布，15 个比赛日 */
function scheduleGroupRound(instanceId, phase, groups, groupNames, bo, startDay) {
    const perGroupRounds = groups.map((ids) => roundRobinRounds(ids)); // 每组 5 轮 × 3 场
    const series = [];
    let day = startDay;
    const roundCount = perGroupRounds[0]?.length || 0;
    for (let r = 0; r < roundCount; r += 1) {
        for (let g = 0; g < groups.length; g += 1) {
            const pairs = perGroupRounds[g][r] || [];
            for (const [homeId, awayId] of pairs) {
                series.push(makeSeries(instanceId, {
                    day, phase, group: groupNames[g], bo, homeId, awayId,
                    key: `${phase}::${homeId}v${awayId}`,
                }));
            }
            day += 1;
        }
    }
    return { series, endDay: day - 1 };
}

/**
 * 开一个 SAB 赛季。
 * @param {object} opts { instanceId, tournament, startDay, ranking(18 teamIds 按上季名次) }
 */
export function buildSabSeason({ instanceId, tournament, startDay, ranking }) {
    const groups = snakeGroups(ranking);
    const { series, endDay } = scheduleGroupRound(
        instanceId, 'r1', groups, ['一组', '二组', '三组'], SAB.R1_BO, startDay,
    );
    return {
        instanceId,
        tournamentId: tournament.id,
        name: tournament.name,
        formatId: 'sab',
        prizeChampion: tournament.prizeChampion,
        prizeRunner: tournament.prizeRunner,
        startDay,
        phase: 'r1',
        groupsR1: groups,
        groupsR2: null,
        gatePairs: null,
        groupsR3: null,
        playoffSeeds: null,
        series,
        ranking: [...ranking],
        finalRanking: null,
        championId: '',
        runnerUpId: '',
        phaseEndDay: endDay,
        done: false,
    };
}

/** 十强杯：单循环（每天一轮 5 场）+ 四强单败 */
export function buildCupSeason({ instanceId, tournament, startDay, ranking, userTeamId }) {
    let invited = ranking.slice(0, CUP.TEAMS);
    if (userTeamId && !invited.includes(userTeamId)) {
        invited = [...invited.slice(0, CUP.TEAMS - 1), userTeamId];
    }
    const rounds = roundRobinRounds(invited);
    const series = [];
    let day = startDay;
    for (const pairs of rounds) {
        for (const [homeId, awayId] of pairs) {
            series.push(makeSeries(instanceId, {
                day, phase: 'rr', bo: CUP.RR_BO, homeId, awayId,
                key: `rr::${homeId}v${awayId}`,
            }));
        }
        day += 1;
    }
    return {
        instanceId,
        tournamentId: tournament.id,
        name: tournament.name,
        formatId: 'cup',
        prizeChampion: tournament.prizeChampion,
        prizeRunner: tournament.prizeRunner,
        startDay,
        phase: 'rr',
        invited,
        series,
        ranking: [...ranking],
        finalRanking: null,
        championId: '',
        runnerUpId: '',
        phaseEndDay: day - 1,
        done: false,
    };
}

/** 娱乐表演赛：固定两天节目单，不进积分，只涨热度 */
export function buildShowmatch({ instanceId, tournament, startDay, ranking, userTeamId }) {
    const stars = ranking.slice(0, 4).filter((id) => id !== userTeamId);
    const series = [
        makeSeries(instanceId, {
            day: startDay, phase: 'show', bo: 3,
            homeId: stars[0], awayId: stars[1], label: '全明星表演赛 · 上半场',
            key: 'show::1',
        }),
        makeSeries(instanceId, {
            day: startDay + SHOWMATCH_DAYS - 1, phase: 'show', bo: 3,
            homeId: userTeamId, awayId: stars[2] || stars[0], label: '全明星表演赛 · 压轴场',
            key: 'show::2',
        }),
    ];
    return {
        instanceId,
        tournamentId: tournament.id,
        name: tournament.name,
        formatId: 'showmatch',
        prizeChampion: tournament.prizeChampion,
        prizeRunner: tournament.prizeRunner,
        startDay,
        phase: 'show',
        series,
        ranking: [...ranking],
        finalRanking: null,
        championId: '',
        runnerUpId: '',
        phaseEndDay: startDay + SHOWMATCH_DAYS - 1,
        done: false,
    };
}

export function buildSeason(opts) {
    const format = opts?.tournament?.format || 'sab';
    if (format === 'cup') return buildCupSeason(opts);
    if (format === 'showmatch') return buildShowmatch(opts);
    return buildSabSeason(opts);
}

// ============================================================
// 阶段推进（r1 → r2 → gate → r3 → playoffs → done）
// ============================================================

function phaseSeries(season, phase) {
    return season.series.filter((s) => s.phase === phase);
}

function phaseFinished(season, phase) {
    const list = phaseSeries(season, phase);
    return list.length > 0 && list.every((s) => s.result);
}

/** 三个初始组各自的排名 → S/A/B */
function regroupAfterR1(season) {
    const groupsR2 = { S: [], A: [], B: [] };
    ['一组', '二组', '三组'].forEach((gName, gi) => {
        const ids = season.groupsR1[gi];
        const rows = computeStandings(
            phaseSeries(season, 'r1').filter((s) => s.group === gName), ids, season.ranking,
        );
        groupsR2.S.push(rows[0].teamId, rows[1].teamId);
        groupsR2.A.push(rows[2].teamId, rows[3].teamId);
        groupsR2.B.push(rows[4].teamId, rows[5].teamId);
    });
    return groupsR2;
}

/** 第二轮各组排名 → 卡位赛对阵 */
function buildGate(season) {
    const standings = {};
    for (const g of ['S', 'A', 'B']) {
        standings[g] = computeStandings(
            phaseSeries(season, 'r2').filter((s) => s.group === g), season.groupsR2[g], season.ranking,
        ).map((r) => r.teamId);
    }
    const day = season.phaseEndDay + SAB.REST_DAYS + 1;
    const pairs = [
        { label: 'S/A 卡位赛 · S5 对 A2', homeId: standings.S[4], awayId: standings.A[1], gate: 'SA' },
        { label: 'S/A 卡位赛 · S6 对 A1', homeId: standings.S[5], awayId: standings.A[0], gate: 'SA' },
        { label: 'A/B 卡位赛 · A5 对 B2', homeId: standings.A[4], awayId: standings.B[1], gate: 'AB' },
        { label: 'A/B 卡位赛 · A6 对 B1', homeId: standings.A[5], awayId: standings.B[0], gate: 'AB' },
    ];
    const series = pairs.map((p, i) => makeSeries(season.instanceId, {
        day: day + Math.floor(i / SAB.GATE_PER_DAY),
        phase: 'gate', bo: SAB.GATE_BO, homeId: p.homeId, awayId: p.awayId, label: p.label,
        key: `gate::${i + 1}`,
    }));
    return { series, standingsR2: standings, endDay: day + 1 };
}

/** 卡位赛结果 → 第三轮 S/A 组 */
function regroupAfterGate(season) {
    const gate = phaseSeries(season, 'gate');
    const st = season.standingsR2;
    const S = [st.S[0], st.S[1], st.S[2], st.S[3]];
    const A = [st.A[2], st.A[3]];
    for (const g of gate) {
        const winner = g.result.winnerId;
        const loser = g.result.winnerId === g.homeId ? g.awayId : g.homeId;
        if (g.label.startsWith('S/A')) {
            S.push(winner);
            A.push(loser);
        } else {
            A.push(winner);
            // A/B 卡位赛败者：赛季结束（不进第三轮）
        }
    }
    return { S: S.slice(0, 6), A: A.slice(0, 6) };
}

/** 第三轮排名 → 季后赛种子（S 全员 + A 前四） */
function buildPlayoffs(season) {
    const stS = computeStandings(
        phaseSeries(season, 'r3').filter((s) => s.group === 'S'), season.groupsR3.S, season.ranking,
    ).map((r) => r.teamId);
    const stA = computeStandings(
        phaseSeries(season, 'r3').filter((s) => s.group === 'A'), season.groupsR3.A, season.ranking,
    ).map((r) => r.teamId);
    const seeds = [...stS, ...stA.slice(0, 4)];   // 1..10
    const day0 = season.phaseEndDay + SAB.REST_DAYS + 1;

    // 双败 DAG：slot 引用 'seedN' / 'W(Mx)' / 'L(Mx)'
    const defs = [
        { m: 1, round: '胜者组首轮', home: 'seed7', away: 'seed10' },
        { m: 2, round: '胜者组首轮', home: 'seed8', away: 'seed9' },
        { m: 3, round: '胜者组四强', home: 'seed3', away: 'W1' },
        { m: 4, round: '胜者组四强', home: 'seed4', away: 'W2' },
        { m: 5, round: '胜者组半决赛', home: 'seed1', away: 'W3' },
        { m: 6, round: '胜者组半决赛', home: 'seed2', away: 'W4' },
        { m: 7, round: '败者组首轮', home: 'L1', away: 'L4' },
        { m: 8, round: '败者组首轮', home: 'L2', away: 'L3' },
        { m: 9, round: '败者组次轮', home: 'L5', away: 'W7' },
        { m: 10, round: '败者组次轮', home: 'L6', away: 'W8' },
        { m: 11, round: '胜者组决赛', home: 'W5', away: 'W6' },
        { m: 12, round: '败者组四强', home: 'W9', away: 'W10' },
        { m: 13, round: '败者组决赛', home: 'L11', away: 'W12' },
        { m: 14, round: '总决赛', home: 'W11', away: 'W13' },
    ];
    const series = defs.map((d, i) => ({
        ...makeSeries(season.instanceId, {
            day: day0 + i, phase: 'playoffs', bo: SAB.PLAYOFF_BO,
            homeId: '', awayId: '', label: `${d.round}（M${d.m}）`,
            key: `po::m${d.m}`,
        }),
        m: d.m, homeSlot: d.home, awaySlot: d.away,
    }));
    return { seeds, series, endDay: day0 + defs.length - 1 };
}

/** 解析季后赛 slot（seedN / Wx / Lx）→ teamId；未就绪返回 '' */
export function resolvePlayoffSlot(season, slot) {
    if (!slot) return '';
    if (slot.startsWith('seed')) {
        return season.playoffSeeds?.[Number(slot.slice(4)) - 1] || '';
    }
    const m = Number(slot.slice(1));
    const match = season.series.find((s) => s.phase === 'playoffs' && s.m === m);
    if (!match?.result) return '';
    if (slot.startsWith('W')) return match.result.winnerId;
    return match.result.winnerId === match.homeId ? match.awayId : match.homeId;
}

/** 十强杯：单循环打完 → 四强单败（1v4、2v3 → 决赛 + 季军战） */
function buildCupKo(season) {
    const rows = computeStandings(phaseSeries(season, 'rr'), season.invited, season.ranking)
        .map((r) => r.teamId);
    const day0 = season.phaseEndDay + CUP.REST_DAYS + 1;
    const series = [
        { ...makeSeries(season.instanceId, { day: day0, phase: 'ko', bo: CUP.KO_BO, homeId: rows[0], awayId: rows[3], label: '半决赛一', key: 'ko::m101' }), m: 101 },
        { ...makeSeries(season.instanceId, { day: day0 + 1, phase: 'ko', bo: CUP.KO_BO, homeId: rows[1], awayId: rows[2], label: '半决赛二', key: 'ko::m102' }), m: 102 },
        { ...makeSeries(season.instanceId, { day: day0 + 2, phase: 'ko', bo: CUP.KO_BO, homeId: '', awayId: '', label: '总决赛', key: 'ko::m103' }), m: 103, homeSlot: 'W101', awaySlot: 'W102' },
    ];
    return { series, rrTop: rows, endDay: day0 + 2 };
}

/**
 * 阶段闸门：当前阶段全部打完时，建下一阶段（返回新 season）。
 * 不模拟任何比赛 —— 模拟由 advanceSeason 决定谁来打。
 */
export function progressPhase(season) {
    const s = { ...season, series: [...season.series] };
    if (s.formatId === 'sab') {
        if (s.phase === 'r1' && phaseFinished(s, 'r1')) {
            s.groupsR2 = regroupAfterR1(s);
            const built = scheduleGroupRound(
                s.instanceId, 'r2', [s.groupsR2.S, s.groupsR2.A, s.groupsR2.B],
                ['S', 'A', 'B'], SAB.R2_BO, s.phaseEndDay + SAB.REST_DAYS + 1,
            );
            s.series = [...s.series, ...built.series];
            s.phase = 'r2';
            s.phaseEndDay = built.endDay;
            return s;
        }
        if (s.phase === 'r2' && phaseFinished(s, 'r2')) {
            const gate = buildGate(s);
            s.standingsR2 = gate.standingsR2;
            s.series = [...s.series, ...gate.series];
            s.phase = 'gate';
            s.phaseEndDay = gate.endDay;
            return s;
        }
        if (s.phase === 'gate' && phaseFinished(s, 'gate')) {
            s.groupsR3 = regroupAfterGate(s);
            const built = scheduleGroupRound(
                s.instanceId, 'r3', [s.groupsR3.S, s.groupsR3.A],
                ['S', 'A'], SAB.R3_BO, s.phaseEndDay + SAB.REST_DAYS + 1,
            );
            s.series = [...s.series, ...built.series];
            s.phase = 'r3';
            s.phaseEndDay = built.endDay;
            return s;
        }
        if (s.phase === 'r3' && phaseFinished(s, 'r3')) {
            const po = buildPlayoffs(s);
            s.playoffSeeds = po.seeds;
            s.series = [...s.series, ...po.series];
            s.phase = 'playoffs';
            s.phaseEndDay = po.endDay;
            return s;
        }
        if (s.phase === 'playoffs' && phaseFinished(s, 'playoffs')) {
            const gf = s.series.find((x) => x.m === 14);
            s.championId = gf?.result?.winnerId || '';
            s.runnerUpId = gf ? (gf.result.winnerId === gf.homeId ? gf.awayId : gf.homeId) : '';
            s.finalRanking = computeFinalRankingSab(s);
            s.phase = 'done';
            s.done = true;
            return s;
        }
    } else if (s.formatId === 'cup') {
        if (s.phase === 'rr' && phaseFinished(s, 'rr')) {
            const ko = buildCupKo(s);
            s.rrTop = ko.rrTop;
            s.series = [...s.series, ...ko.series];
            s.phase = 'ko';
            s.phaseEndDay = ko.endDay;
            return s;
        }
        if (s.phase === 'ko' && phaseFinished(s, 'ko')) {
            const gf = s.series.find((x) => x.m === 103);
            s.championId = gf?.result?.winnerId || '';
            s.runnerUpId = gf ? (gf.result.winnerId === gf.homeId ? gf.awayId : gf.homeId) : '';
            s.finalRanking = [...new Set([s.championId, s.runnerUpId, ...(s.rrTop || []), ...s.ranking])];
            s.phase = 'done';
            s.done = true;
            return s;
        }
    } else if (s.formatId === 'showmatch') {
        if (phaseFinished(s, 'show')) {
            const last = s.series[s.series.length - 1];
            s.championId = last?.result?.winnerId || '';
            s.runnerUpId = last ? (last.result.winnerId === last.homeId ? last.awayId : last.homeId) : '';
            s.finalRanking = [...s.ranking];
            s.phase = 'done';
            s.done = true;
            return s;
        }
    }
    return s;
}

/** SAB 最终 18 名排序（供下赛季蛇形分组与荣誉展示） */
export function computeFinalRankingSab(season) {
    const out = [];
    const pushed = new Set();
    const push = (id) => { if (id && !pushed.has(id)) { pushed.add(id); out.push(id); } };

    push(season.championId);
    push(season.runnerUpId);
    const m13 = season.series.find((x) => x.m === 13);
    if (m13?.result) push(m13.result.winnerId === m13.homeId ? m13.awayId : m13.homeId);
    const m12 = season.series.find((x) => x.m === 12);
    if (m12?.result) push(m12.result.winnerId === m12.homeId ? m12.awayId : m12.homeId);
    for (const m of [10, 9, 8, 7]) {
        const match = season.series.find((x) => x.m === m);
        if (match?.result) push(match.result.winnerId === match.homeId ? match.awayId : match.homeId);
    }
    for (const id of asArray(season.playoffSeeds)) push(id);
    // 第三轮 A 组后两名
    if (season.groupsR3) {
        for (const id of season.groupsR3.A) push(id);
    }
    // 卡位赛淘汰与 B 组
    if (season.standingsR2) {
        for (const id of season.standingsR2.B) push(id);
        for (const id of season.standingsR2.A) push(id);
        for (const id of season.standingsR2.S) push(id);
    }
    for (const id of asArray(season.ranking)) push(id);
    return out;
}

// ============================================================
// 推进到某一天：NPC 场自动打，用户场留给用户（过期自动补）
// ============================================================

/**
 * @param {object} season
 * @param {object} ctx {
 *   day, userTeamId,
 *   powerOf: (teamId, day) => number,   // 队伍强度（用户队含用户属性）
 * }
 * @returns {{season:object, resolved:Array, pendingUser:Array}}
 *   resolved     本次自动打掉的系列赛
 *   pendingUser  等用户出战的系列赛（今天到点、还没打）
 */
export function advanceSeason(season, ctx) {
    let s = { ...season, series: season.series.map((x) => ({ ...x })) };
    const resolved = [];

    let guard = 0;
    let moved = true;
    while (moved && guard < 12) {
        moved = false;
        guard += 1;
        for (const series of s.series) {
            if (series.result || series.day > ctx.day) continue;
            // 季后赛/淘汰赛槽位到点再解析
            if (series.homeSlot && !series.homeId) {
                series.homeId = resolvePlayoffSlot(s, series.homeSlot);
            }
            if (series.awaySlot && !series.awayId) {
                series.awayId = resolvePlayoffSlot(s, series.awaySlot);
            }
            if (!series.homeId || !series.awayId) continue;

            const isUserSeries = series.homeId === ctx.userTeamId || series.awayId === ctx.userTeamId;
            if (isUserSeries && series.day >= ctx.day) continue;   // 今天的用户场留给用户

            const result = simulateSeries(
                series.id, series.bo,
                { id: series.homeId, power: ctx.powerOf(series.homeId, series.day) },
                { id: series.awayId, power: ctx.powerOf(series.awayId, series.day) },
            );
            series.result = { ...result, auto: true, played: false };
            resolved.push({ ...series });
            moved = true;
        }
        const next = progressPhase(s);
        if (next.phase !== s.phase) moved = true;
        s = next;
    }

    const pendingUser = s.series.filter((x) => {
        if (x.result || x.day !== ctx.day) return false;
        const home = x.homeSlot && !x.homeId ? resolvePlayoffSlot(s, x.homeSlot) : x.homeId;
        const away = x.awaySlot && !x.awayId ? resolvePlayoffSlot(s, x.awaySlot) : x.awayId;
        return home === ctx.userTeamId || away === ctx.userTeamId;
    });

    return { season: s, resolved, pendingUser };
}

/** 用户主动出战某场（结果由调用方拿 simulateSeries 算好传进来） */
export function applyUserSeriesResult(season, seriesId, result) {
    let s = {
        ...season,
        series: season.series.map((x) => (
            x.id === seriesId ? { ...x, result: { ...result, auto: false, played: true } } : { ...x }
        )),
    };
    let guard = 0;
    let prevPhase = '';
    while (prevPhase !== s.phase && guard < 8) {
        prevPhase = s.phase;
        s = progressPhase(s);
        guard += 1;
    }
    return s;
}

// ============================================================
// 查询辅助
// ============================================================

export function seriesOfDay(season, day) {
    return asArray(season?.series).filter((s) => s.day === day);
}

export function upcomingUserSeries(season, userTeamId, day, limit = 3) {
    return asArray(season?.series)
        .filter((s) => !s.result && (s.homeId === userTeamId || s.awayId === userTeamId) && s.day >= day)
        .sort((a, b) => a.day - b.day)
        .slice(0, limit);
}

export function phaseLabel(season) {
    if (!season) return '休赛期';
    const map = {
        r1: '第一轮常规赛', r2: '第二轮常规赛', gate: '卡位赛', r3: '第三轮常规赛',
        playoffs: '季后赛', rr: '小组循环', ko: '淘汰赛', show: '表演赛', done: '已收官',
    };
    return map[season.phase] || season.phase;
}

/** 组内积分表（给 UI）：phase r1 给三组，r2 给 SAB，r3 给 SA */
export function standingsBoards(season) {
    if (!season) return [];
    const boards = [];
    const pushBoard = (name, ids, phase, group) => {
        boards.push({
            name,
            rows: computeStandings(
                asArray(season.series).filter((s) => s.phase === phase && s.group === group && s.result),
                ids, season.ranking,
            ),
        });
    };
    if (season.formatId === 'sab') {
        if (season.phase === 'r1') {
            ['一组', '二组', '三组'].forEach((g, i) => pushBoard(`第一轮 · ${g}`, season.groupsR1[i], 'r1', g));
        } else if (season.phase === 'r2' || season.phase === 'gate') {
            ['S', 'A', 'B'].forEach((g) => pushBoard(`第二轮 · ${g} 组`, season.groupsR2[g], 'r2', g));
        } else if (season.groupsR3) {
            ['S', 'A'].forEach((g) => pushBoard(`第三轮 · ${g} 组`, season.groupsR3[g], 'r3', g));
        }
    } else if (season.formatId === 'cup' && season.invited) {
        boards.push({
            name: '十强循环圈',
            rows: computeStandings(
                asArray(season.series).filter((s) => s.phase === 'rr' && s.result),
                season.invited, season.ranking,
            ),
        });
    }
    return boards;
}

// ============================================================
// 热度引擎（论坛内容量 / 官博评论数的燃料）
// ============================================================

/**
 * 队伍热度 0~100：底子 + 最近战绩动量 + 用户队加成 + 事件偏移。
 * 纯函数，按当前 season 现算，不落盘。
 */
export function computeHeat(teams, season, userTeamId, shifts = {}) {
    const heat = {};
    for (const team of teams) {
        let h = clamp((team.powerBase - 40) * 1.6 + 20, 10, 78);
        if (season) {
            const recent = asArray(season.series)
                .filter((s) => s.result && (s.homeId === team.id || s.awayId === team.id))
                .slice(-6);
            for (const s of recent) {
                h += s.result.winnerId === team.id ? 3.5 : -1.5;
            }
            if (season.championId === team.id) h += 15;
            if (season.playoffSeeds?.includes(team.id)) h += 5;
        }
        if (team.id === userTeamId) h += 8;
        h += Number(shifts[team.id]) || 0;
        heat[team.id] = Math.round(clamp(h, 5, 100));
    }
    return heat;
}
