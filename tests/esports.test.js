/**
 * 电竞双 App（声浪 esports-forum / 赛点 esports-game）· 纯函数测试
 *
 * 只测不碰 window 的部分：
 *   共享底座（游戏模型 / 每档时钟 / 段位 / 队伍强度）/
 *   起点定位表 / 确定性名册与小号改名史 /
 *   SAB 赛季引擎（单循环表 / 蛇形分组 / 系列赛掷签回放 / 全赛季推进到收官 / 积分）/
 *   论坛内容引擎（预置帖确定性 / 串子埋点 / 粉丝评分范围）/
 *   事件引擎（人气曲线 / 属性护盾 / 掷签确定性）/ 生涯引擎（加点 / 钳制 / 薪期）/
 *   提示词组装（预览 == 发送）/ providers 进场 /
 *   排位引擎（回放一致 / 强弱方向 / 饭点检测 / 他人战绩确定性）。
 * 跑法：npm test（package.json 已挂 @ 别名 loader）。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    GAME_MODELS, gameModelById, positionLabel, createClock, virtualMs,
    fastForward, advanceMinutes, nextDay, rankTierLabel, playerPower, teamPower,
    DAY_END_MINUTE,
} from '../js/apps/esports-shared/esports-kit.js';
import {
    ALLOC_KEYS, EVENT_DEFS, SAB, START_TIERS, startTierSpec,
} from '../js/apps/esports-forum/constants.js';
import {
    generateRoster, generateTeams, altStateFor, lurkerPersons, playerPersonaText,
} from '../js/apps/esports-forum/services/npc-engine.js';
import {
    roundRobinRounds, snakeGroups, simulateSeries, computeStandings,
    buildSabSeason, buildSeason, advanceSeason, applyUserSeriesResult,
    computeHeat, phaseLabel, resolvePlayoffSlot,
} from '../js/apps/esports-forum/services/season-engine.js';
import {
    boardsList, dailyBoardPosts, presetComments, fanScoreFor, presetPostBody,
} from '../js/apps/esports-forum/services/forum-engine.js';
import {
    fameCurveP, guardFactor, eventProbability, rollDailyEvents, eventDefById,
} from '../js/apps/esports-forum/services/event-engine.js';
import {
    blankAllocation, validateAllocation, suggestAllocation, settleAttrDeltas,
    salaryPeriodsDue, dueFestivals, defaultTournamentConfig, randomizeTournaments,
} from '../js/apps/esports-forum/services/career-engine.js';
import { buildRankRoastPrompt, composer } from '../js/apps/esports-forum/services/prompt-builder.js';
import { registerEsportsProviders } from '../js/apps/esports-forum/services/providers.js';
import {
    collectSocialInfluences, clearSocialInfluenceProviders,
} from '../src/core/social-influence-registry.js';
import {
    simulateRankSession, simulateTraining, planSession, isHungry, dailyRecordFor,
} from '../js/apps/esports-game/services/rank-engine.js';
import { profPowerBonus, intimacyLevelLabel, rankModeById } from '../js/apps/esports-game/constants.js';
import { buildCoopSummarySpec } from '../js/apps/esports-game/services/app-prompts.js';

const KEY_A = 'user-a::world-1';
const KEY_B = 'user-b::world-2';

// ============================================================
// 共享底座
// ============================================================

test('kit: 三个游戏模型齐全，位置表随模型变化', () => {
    assert.equal(GAME_MODELS.length, 3);
    assert.equal(gameModelById('moba').teamSize, 5);
    assert.equal(gameModelById('shooter').teamSize, 4);
    assert.equal(gameModelById('不存在的').id, 'moba', '未知模型回落 moba');
    assert.equal(positionLabel('moba', 'farm'), '发育路');
    assert.equal(positionLabel('asym', 'hunter'), '监管者');
});

test('kit: 每档时钟 —— 快进天数叠加、24:00 封顶、虚拟毫秒随天数走', () => {
    const clock = createClock(new Date('2026-08-15T10:00:00').getTime());
    assert.equal(clock.day, 1);
    const ff = fastForward(clock, 7);
    assert.equal(ff.day, 8);
    assert.ok(virtualMs(ff) - virtualMs(clock) >= 6 * 86400000, '快进 7 天虚拟毫秒至少走 6 天');
    const { clock: c2, hitMidnight } = advanceMinutes({ ...clock, minute: DAY_END_MINUTE - 30 }, 90);
    assert.ok(hitMidnight, '越过 24:00 要报封顶');
    assert.equal(c2.minute, DAY_END_MINUTE);
    assert.equal(nextDay(c2).day, 2);
});

test('kit: 段位与强度方向正确', () => {
    assert.equal(rankTierLabel(0), '荣耀黄金');
    assert.equal(rankTierLabel(2600), '传奇王者');
    const weak = { mechanics: 30, awareness: 30, comms: 30, pool: 30, mentality: 30, stamina: 30, synergy: 30 };
    const strong = { mechanics: 90, awareness: 90, comms: 90, pool: 90, mentality: 90, stamina: 90, synergy: 90 };
    assert.ok(playerPower(strong) > playerPower(weak) + 30);
    assert.ok(teamPower([strong, strong, strong, strong, strong]) > teamPower([weak, weak, weak, weak, weak]));
});

// ============================================================
// 起点定位
// ============================================================

test('forum: 起点定位表方向正确且越界钳制', () => {
    assert.equal(START_TIERS.length, 6);
    const t1 = startTierSpec(1);
    const t6 = startTierSpec(6);
    assert.ok(t6.fameBase > t1.fameBase);
    assert.ok(t6.budget > t1.budget);
    assert.ok(t6.monthSalary > t1.monthSalary * 20, '世一月薪远高于青训');
    assert.ok(t6.peakRating > t1.peakRating);
    assert.equal(startTierSpec(0).tier, 1, '越界钳制到 1');
    assert.equal(startTierSpec(99).tier, 6, '越界钳制到 6');
});

// ============================================================
// 名册（确定性 NPC）
// ============================================================

test('npc: 同档案键永远同一批人，不同档案键不同', () => {
    const a1 = generateRoster(KEY_A, 'moba', 'farm');
    const a2 = generateRoster(KEY_A, 'moba', 'farm');
    const b = generateRoster(KEY_B, 'moba', 'farm');
    assert.deepEqual(a1.teams, a2.teams, '同键战队一致');
    assert.deepEqual(a1.players, a2.players, '同键选手一致');
    assert.notDeepEqual(a1.teams.map((t) => t.defaultName), b.teams.map((t) => t.defaultName), '不同键战队名不同');
});

test('npc: 18 支战队；用户位置的首发槽留空；教练每队一位', () => {
    const roster = generateRoster(KEY_A, 'moba', 'farm');
    assert.equal(roster.teams.length, 18);
    assert.equal(roster.coaches.length, 18);
    const myStarters = roster.players.filter((p) => p.teamId === 'team-1' && !p.isSub);
    assert.equal(myStarters.length, 4, '用户占一个首发位，剩 4 位 NPC 首发');
    assert.ok(!myStarters.some((p) => p.positionId === 'farm'), '用户位置没有 NPC');
    const otherStarters = roster.players.filter((p) => p.teamId === 'team-2' && !p.isSub);
    assert.equal(otherStarters.length, 5, '他队 5 首发');
    assert.ok(playerPersonaText(roster.players[0], '测试队', gameModelById('moba')).includes('MBTI'));
});

test('npc: 串子存在；小号改名史确定性且随天数单调追加', () => {
    const roster = generateRoster(KEY_A, 'moba', 'farm');
    const lurkers = lurkerPersons(roster);
    assert.ok(lurkers.length > 0, '联盟里得有串子');
    const p = lurkers[0];
    const d30a = altStateFor(KEY_A, p.id, 30);
    const d30b = altStateFor(KEY_A, p.id, 30);
    assert.deepEqual(d30a, d30b, '同天重算一致（改名史天然持久）');
    const d200 = altStateFor(KEY_A, p.id, 200);
    assert.ok(d200.history.length >= d30a.history.length, '天数越多改名史只增不减');
    assert.equal(d30a.history[0].fromDay, 1);
});

// ============================================================
// 赛季引擎
// ============================================================

test('season: 单循环表 —— 6 队 5 轮，每对交手恰好一次', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const rounds = roundRobinRounds(ids);
    assert.equal(rounds.length, 5);
    const pairs = new Set();
    for (const round of rounds) {
        assert.equal(round.length, 3);
        for (const [x, y] of round) {
            const key = [x, y].sort().join('::');
            assert.ok(!pairs.has(key), `${key} 不能打两次`);
            pairs.add(key);
        }
    }
    assert.equal(pairs.size, 15);
});

test('season: 蛇形分组 —— 18 队分 3 组，每组 6 队且强弱交错', () => {
    const ranked = Array.from({ length: 18 }, (_, i) => `t${i + 1}`);
    const groups = snakeGroups(ranked);
    assert.equal(groups.length, 3);
    for (const g of groups) assert.equal(g.length, 6);
    assert.ok(groups[0].includes('t1') && groups[0].includes('t6'), '蛇形回折');
});

test('season: 系列赛掷签 —— 同 seed 回放一致，比分符合 BO 规则', () => {
    const home = { id: 'h', power: 60 };
    const away = { id: 'a', power: 55 };
    const r1 = simulateSeries('seed-x', 5, home, away);
    const r2 = simulateSeries('seed-x', 5, home, away);
    assert.deepEqual(r1, r2, '同 seed 同结果');
    const winScore = Math.max(r1.homeScore, r1.awayScore);
    const loseScore = Math.min(r1.homeScore, r1.awayScore);
    assert.equal(winScore, 3, 'BO5 先到 3');
    assert.ok(loseScore >= 0 && loseScore <= 2);
    const r3 = simulateSeries('seed-y', 5, home, away);
    assert.ok(r3.games.length >= 3 && r3.games.length <= 5);
});

test('season: 强弱方向 —— 大样本下强队胜率显著更高，但弱队不是零', () => {
    let strongWins = 0;
    const n = 300;
    for (let i = 0; i < n; i += 1) {
        const r = simulateSeries(`sample-${i}`, 5, { id: 's', power: 72 }, { id: 'w', power: 48 });
        if (r.winnerId === 's') strongWins += 1;
    }
    assert.ok(strongWins / n > 0.75, `强队胜率应显著（实际 ${strongWins / n}）`);
    assert.ok(strongWins < n, '弱队要有爆种空间');
});

function powerOfFactory() {
    // 确定性强度表：team-1 最强 … team-18 最弱
    return (teamId) => 75 - Number(String(teamId).split('-')[1]) * 1.5;
}

function runSeasonToEnd(seedTag) {
    const teams = generateTeams(KEY_A);
    const ranking = teams.map((t) => t.id);
    let season = buildSabSeason({
        instanceId: `save-${seedTag}::season1`,
        tournament: { id: 't-spring', name: '春霖杯', format: 'sab', prizeChampion: 1, prizeRunner: 1 },
        startDay: 3,
        ranking,
    });
    const powerOf = powerOfFactory();
    for (let day = 1; day <= 400 && !season.done; day += 1) {
        const step = advanceSeason(season, { day, userTeamId: '__nobody__', powerOf });
        season = step.season;
    }
    return season;
}

test('season: SAB 全赛季推进到收官 —— 阶段齐全、结构数量对、回放一致', () => {
    const season = runSeasonToEnd('a');
    assert.ok(season.done, '400 天内必须收官');
    assert.equal(season.phase, 'done');
    const byPhase = (p) => season.series.filter((s) => s.phase === p);
    assert.equal(byPhase('r1').length, 45, '第一轮 45 场');
    assert.equal(byPhase('r2').length, 45, '第二轮 45 场');
    assert.equal(byPhase('gate').length, 4, '卡位赛 4 场 BO7');
    assert.equal(byPhase('r3').length, 30, '第三轮 30 场');
    assert.equal(byPhase('playoffs').length, 14, '双败季后赛 14 场');
    assert.ok(byPhase('gate').every((s) => s.bo === SAB.GATE_BO));
    assert.ok(season.championId, '有冠军');
    assert.ok(season.runnerUpId && season.runnerUpId !== season.championId);
    assert.equal(new Set(season.finalRanking).size, 18, '收官排名覆盖 18 队');
    assert.equal(season.groupsR2.S.length, 6);
    assert.equal(season.groupsR3.A.length, 6);

    // 回放一致：同样的输入再推一遍，冠军与每场比分一致
    const again = runSeasonToEnd('a');
    assert.equal(again.championId, season.championId, '回放同冠军');
    assert.deepEqual(
        again.series.map((s) => `${s.id}:${s.result?.homeScore}-${s.result?.awayScore}`),
        season.series.map((s) => `${s.id}:${s.result?.homeScore}-${s.result?.awayScore}`),
        '每场比分一致',
    );
});

test('season: 用户场留给用户 —— 当天不代打，过期自动补', () => {
    const teams = generateTeams(KEY_A);
    const ranking = teams.map((t) => t.id);
    let season = buildSabSeason({
        instanceId: 'save-u::season1',
        tournament: { id: 't', name: 'T', format: 'sab', prizeChampion: 1, prizeRunner: 1 },
        startDay: 1,
        ranking,
    });
    const userTeam = season.series.find((s) => s.day === 1).homeId;
    const powerOf = powerOfFactory();
    const step1 = advanceSeason(season, { day: 1, userTeamId: userTeam, powerOf });
    assert.ok(step1.pendingUser.length >= 1, '当天用户场等用户');
    assert.ok(step1.pendingUser.every((s) => !s.result));
    // 用户打掉它
    const target = step1.pendingUser[0];
    const result = simulateSeries(target.id, target.bo, { id: target.homeId, power: 60 }, { id: target.awayId, power: 55 });
    season = applyUserSeriesResult(step1.season, target.id, result);
    assert.ok(season.series.find((s) => s.id === target.id).result.played, '用户打的标 played');
    // 快进：昨天没打的用户场自动补
    const step2 = advanceSeason(season, { day: 9, userTeamId: userTeam, powerOf });
    const past = step2.season.series.filter((s) => s.day < 9 && (s.homeId === userTeam || s.awayId === userTeam));
    assert.ok(past.every((s) => s.result), '过期用户场全部有结果');
});

test('season: 积分表 —— 赢 1 分、同分比净胜局；热度在 5~100', () => {
    const series = [
        { phase: 'x', group: '', result: { homeScore: 3, awayScore: 0, winnerId: 'a' }, homeId: 'a', awayId: 'b' },
        { phase: 'x', group: '', result: { homeScore: 3, awayScore: 2, winnerId: 'b' }, homeId: 'b', awayId: 'c' },
        { phase: 'x', group: '', result: { homeScore: 3, awayScore: 1, winnerId: 'a' }, homeId: 'a', awayId: 'c' },
    ];
    const rows = computeStandings(series, ['a', 'b', 'c'], ['a', 'b', 'c']);
    assert.equal(rows[0].teamId, 'a');
    assert.equal(rows[0].points, 2);
    assert.equal(rows[1].teamId, 'b');

    const teams = generateTeams(KEY_A);
    const heat = computeHeat(teams, null, 'team-1', {});
    for (const t of teams) {
        assert.ok(heat[t.id] >= 5 && heat[t.id] <= 100);
    }
    assert.ok(phaseLabel(null).length > 0);
    assert.equal(resolvePlayoffSlot({ playoffSeeds: ['x1'] }, 'seed1'), 'x1');
});

test('season: cup 与 showmatch 也能建起来', () => {
    const teams = generateTeams(KEY_A);
    const ranking = teams.map((t) => t.id);
    const cup = buildSeason({
        instanceId: 'i1',
        tournament: { id: 'c', name: 'C', format: 'cup', prizeChampion: 1, prizeRunner: 1 },
        startDay: 2, ranking, userTeamId: 'team-18',
    });
    assert.equal(cup.formatId, 'cup');
    assert.ok(cup.invited.includes('team-18'), '用户队保底受邀');
    assert.equal(cup.series.length, 45, '十队单循环 45 场');
    const show = buildSeason({
        instanceId: 'i2',
        tournament: { id: 's', name: 'S', format: 'showmatch', prizeChampion: 1, prizeRunner: 1 },
        startDay: 2, ranking, userTeamId: 'team-1',
    });
    assert.equal(show.series.length, 2);
});

// ============================================================
// 论坛内容引擎
// ============================================================

test('forum-engine: 预置帖确定性 —— 同天同板块同一批，串子带隐藏 altOf', () => {
    const roster = generateRoster(KEY_A, 'moba', 'farm');
    const boards = boardsList(roster.teams, (id) => id);
    assert.equal(boards.length, 20, '总版 + 赛后 + 18 队');
    const board = boards.find((b) => b.kind === 'team');
    const vars = { team: '队', opp: '对', player: 'P', user: 'U', score: '3:1', hero: 'H', pos: '发育路' };
    const a = dailyBoardPosts({ profileKey: KEY_A, day: 20, board, heat: 60, roster, vars });
    const b = dailyBoardPosts({ profileKey: KEY_A, day: 20, board, heat: 60, roster, vars });
    assert.deepEqual(a, b, '同天重算一致');
    const c = dailyBoardPosts({ profileKey: KEY_A, day: 21, board, heat: 60, roster, vars });
    assert.notDeepEqual(a.map((p) => p.id), c.map((p) => p.id), '不同天不同批');
    assert.ok(a.every((p) => !p.title.includes('{')), '模板占位符都被填掉');
    assert.ok(presetPostBody(a[0], vars).length > a[0].title.length);
    const comments = presetComments({ profileKey: KEY_A, post: a[0], page: 0, vars, roster, day: 20 });
    assert.ok(comments.length > 0 && comments.length <= 5, '一页最多 5 条');
});

test('forum-engine: 粉丝评分在 2~9.9 且强者更高', () => {
    const roster = generateRoster(KEY_A, 'moba', 'farm');
    const scores = roster.players.map((p) => fanScoreFor(KEY_A, p, 10, 0));
    assert.ok(scores.every((s) => s >= 2 && s <= 9.9));
    const strong = { id: 'ps', attrs: { mechanics: 95, awareness: 95 } };
    const weak = { id: 'pw', attrs: { mechanics: 25, awareness: 25 } };
    assert.ok(fanScoreFor(KEY_A, strong, 10, 0) > fanScoreFor(KEY_A, weak, 10, 0));
});

// ============================================================
// 事件引擎
// ============================================================

test('event: 人气曲线 —— 被喷上热搜 0 人气 2%、100 人气 55%，单调上升', () => {
    const def = eventDefById('flamed-trending');
    assert.ok(def);
    assert.ok(Math.abs(fameCurveP(def.curve, 0) - 0.02) < 1e-9);
    assert.ok(Math.abs(fameCurveP(def.curve, 100) - 0.55) < 1e-9);
    let prev = 0;
    for (let fame = 0; fame <= 100; fame += 10) {
        const p = fameCurveP(def.curve, fame);
        assert.ok(p >= prev);
        prev = p;
    }
});

test('event: 属性护盾方向正确；小号事件没小号不触发；掷签确定性且每天 ≤2', () => {
    const guards = [{ attr: 'mentality', pivot: 50, factor: 0.6 }];
    assert.ok(guardFactor(guards, { mentality: 90 }) < 1, '高心态压概率');
    assert.ok(guardFactor(guards, { mentality: 10 }) > 1, '低心态放大');

    const burner = eventDefById('burner-exposed');
    const blocked = eventProbability(burner, { attrs: { fame: 50 }, day: 5, hasAlt: false });
    assert.equal(blocked.blocked, 'no-alt');
    const open = eventProbability(burner, { attrs: { fame: 50 }, day: 5, hasAlt: true });
    assert.ok(open.p > 0);

    const ctx = { attrs: { fame: 80, mentality: 30 }, energy: 80, shieldUntilDay: 0, hasAlt: true, triggeredOnceIds: [], lastTriggeredDayById: {} };
    for (let day = 1; day <= 30; day += 1) {
        const a = rollDailyEvents('save-e', day, ctx);
        const b = rollDailyEvents('save-e', day, ctx);
        assert.deepEqual(a.map((x) => x.def.id), b.map((x) => x.def.id), `第${day}天掷签回放一致`);
        assert.ok(a.length <= 2, '每天常规 ≤2');
    }
    assert.ok(EVENT_DEFS.length >= 10, '事件库要有厚度');
});

// ============================================================
// 生涯引擎
// ============================================================

test('career: 加点预算校验与推荐加点合法', () => {
    const blank = blankAllocation(3);
    assert.equal(Object.keys(blank.attrs).length, ALLOC_KEYS.length);
    const bad = { ...blank.attrs, mechanics: 999 };
    assert.equal(validateAllocation(bad, 3).ok, false);
    const suggested = suggestAllocation(3, KEY_A, 'farm');
    const check = validateAllocation(suggested, 3);
    assert.ok(check.ok, `推荐加点必须合法：${check.error || ''}`);
    assert.ok(check.spent <= check.budget);
});

test('career: delta 钳制与 0~100 边界；薪期与节日', () => {
    const attrs = { mechanics: 98, mentality: 5, fame: 50 };
    const { attributes, changes } = settleAttrDeltas(attrs, { mechanics: 99, mentality: -99, fame: 3 }, 4);
    assert.equal(attributes.mechanics, 100, '钳到 +4 再被 100 上限截住');
    assert.equal(attributes.mentality, 1, '-99 被钳成 -4');
    assert.equal(changes.length, 3);
    assert.equal(salaryPeriodsDue(30), 0);
    assert.equal(salaryPeriodsDue(31), 1);
    assert.equal(salaryPeriodsDue(61), 2);
    const fests = [{ id: 'f', name: 'F', everyDays: 45, enabled: true }];
    assert.equal(dueFestivals(fests, 45).length, 1);
    assert.equal(dueFestivals(fests, 44).length, 0);
    const tours = randomizeTournaments('seed');
    assert.deepEqual(tours.map((t) => t.id), defaultTournamentConfig().map((t) => t.id), '随机不改 id');
});

// ============================================================
// 提示词（预览 == 发送）
// ============================================================

test('prompt: 战绩锐评 prompt —— parts 与 text 同源，事实都进正文', () => {
    const session = {
        id: 'sess-1', modeLabel: '巅峰单排', wins: 4, losses: 2,
        ratingAfter: 1622, ratingDelta: 40,
        matches: [{ win: true, hero: '破军', kdaText: '8/2/10' }],
    };
    const { text, parts } = buildRankRoastPrompt({
        identity: { userName: '我', user: null, world: null, worldId: '' },
        profile: { gameId: '野火', modelId: 'moba', positionId: 'farm', userTeamId: 'team-1', gameName: '曜世战场' },
        save: { startTier: 3, attrs: { fame: 30 }, energy: 80, clock: { day: 5, minute: 600 } },
        session,
    });
    assert.ok(text.includes('4胜2负'));
    assert.ok(text.includes('破军'));
    assert.ok(text.includes('8/2/10'));
    const included = parts.filter((p) => p.included);
    for (const part of included) {
        assert.ok(text.includes(part.content.trim().slice(0, 20)), `${part.id} 段进了正文`);
    }
    assert.equal(composer.load('rank-roast::sess-1'), text, '快照就是发送内容');
});

// ============================================================
// providers
// ============================================================

test('providers: 六个 provider 注册并能被氧气/萤火收集，社媒偏好生效', async () => {
    clearSocialInfluenceProviders();
    const unregister = registerEsportsProviders(() => ({
        profile: {
            configured: true, gameId: '野火', userTeamId: 'team-1',
            socialPrefs: { syncTeammates: true, officialBlogs: true, hiddenPlayerIds: [] },
        },
        save: {
            startTier: 3, attrs: { fame: 40 }, shieldUntilDay: 0, clock: { day: 5 },
            rankSummaries: [{ modeLabel: '巅峰单排', wins: 4, losses: 2 }],
        },
        season: { name: '春霖杯' },
        timeline: [{ title: '战胜临江猎隼', major: true }],
        heat: { 'team-1': 66 },
        teamNameOf: () => '雾川雷雀',
        teammates: [{ id: 'p1', gameId: '北桥', posLabel: '打野' }],
        visibleOthers: [],
        rankSummaries: [],
    }));

    const blogParts = await collectSocialInfluences({ targetAppId: 'blog', channel: 'feed' });
    assert.ok(blogParts.length >= 3, `blog feed 至少 3 段（实际 ${blogParts.length}）`);
    const circle = blogParts.find((p) => p.id.includes('team-circle'));
    assert.ok(circle, '战队社媒圈 provider 在场');
    assert.ok(circle.content.includes('北桥'), '互关队友写进内容');
    assert.ok(circle.content.includes('雾川雷雀官方'), '官博写进内容');

    const dmParts = await collectSocialInfluences({ targetAppId: 'youtube', channel: 'dm' });
    assert.ok(dmParts.some((p) => p.id.includes('dm-vibe')));

    const hotParts = await collectSocialInfluences({ targetAppId: 'blog', channel: 'hot-search' });
    assert.ok(hotParts.some((p) => p.content.includes('野火战胜临江猎隼')), '热搜词条带选手名');

    unregister();
    clearSocialInfluenceProviders();
});

// ============================================================
// 排位引擎（赛点）
// ============================================================

const RANK_BASE = {
    seedBase: 'save-1::rank::5::1',
    saveId: 'save-1', day: 5, sessionSeq: 1,
    count: 6, modeId: 'solo',
    userPower: 60, companions: [],
    heroName: '破军', heroProf: 70, focus: true,
    energy: 90, staminaHigh: false,
    meals: { lunch: true, dinner: true },
    startMinute: 14 * 60, rating: 1600,
    teamSize: 5,
    model: gameModelById('moba'),
};

test('rank: 同 seed 回放一致；局数与巅峰分账目对得上', () => {
    const a = simulateRankSession(RANK_BASE);
    const b = simulateRankSession(RANK_BASE);
    assert.deepEqual(a, b, '回放一致（没有重 roll 的物理基础）');
    assert.equal(a.matches.length, 6);
    assert.equal(a.wins + a.losses, 6);
    const sumDelta = a.matches.reduce((acc, m) => acc + m.ratingDelta, 0);
    assert.equal(a.ratingDelta, sumDelta, '总分变化 = 各局之和');
    assert.equal(a.ratingAfter, 1600 + sumDelta);
    assert.ok(a.minutesTotal >= 6 * 20, '6 局至少两小时上下');
    assert.ok(a.matches.every((m) => m.kdaText.length > 0));
});

test('rank: 强弱与状态方向 —— 高战力赢得多；饿着打明显吃亏', () => {
    let strongWins = 0;
    let weakWins = 0;
    let fedWins = 0;
    let hungryWins = 0;
    for (let i = 0; i < 60; i += 1) {
        strongWins += simulateRankSession({ ...RANK_BASE, seedBase: `s-${i}`, userPower: 80 }).wins;
        weakWins += simulateRankSession({ ...RANK_BASE, seedBase: `s-${i}`, userPower: 40 }).wins;
        fedWins += simulateRankSession({ ...RANK_BASE, seedBase: `h-${i}`, startMinute: 15 * 60, meals: { lunch: true, dinner: true } }).wins;
        hungryWins += simulateRankSession({ ...RANK_BASE, seedBase: `h-${i}`, startMinute: 15 * 60, meals: { lunch: false, dinner: false } }).wins;
    }
    assert.ok(strongWins > weakWins, `强弱方向（${strongWins} vs ${weakWins}）`);
    assert.ok(fedWins >= hungryWins, `吃饱的不该更差（${fedWins} vs ${hungryWins}）`);
});

test('rank: 时间规划 —— 跨过饭点会被点名；训练赛与他人战绩确定性', () => {
    const plan = planSession({ startMinute: 11 * 60, count: 6, matchMinutes: 26, meals: {} });
    assert.ok(plan.mealsNeeded.some((m) => m.key === 'lunch'), '中午开 6 局要提醒午饭');
    assert.ok(isHungry(14 * 60, {}), '过了午饭窗口没吃就是饿');
    assert.ok(!isHungry(14 * 60, { lunch: true }), '吃过就不饿');

    const t1 = simulateTraining({ seedBase: 'tr-1', myPower: 60, oppPower: 55, oppName: '临江猎隼' });
    const t2 = simulateTraining({ seedBase: 'tr-1', myPower: 60, oppPower: 55, oppName: '临江猎隼' });
    assert.deepEqual(t1, t2);
    assert.equal(t1.wins + t1.losses, 3);

    const person = { id: 'p-team-1-jungle', gameId: '北桥', attrs: { mechanics: 70, awareness: 66 } };
    const r1 = dailyRecordFor({ profileKey: KEY_A, person, day: 9, model: gameModelById('moba') });
    const r2 = dailyRecordFor({ profileKey: KEY_A, person, day: 9, model: gameModelById('moba') });
    assert.deepEqual(r1, r2, '他人战绩确定性（数据一直在，等着被发现）');
    assert.equal(r1.wins + r1.losses, r1.games);
});

test('game: 熟练度加成分档、亲密等级、同游概要卡', () => {
    assert.equal(profPowerBonus(95), 5);
    assert.equal(profPowerBonus(65), 3);
    assert.equal(profPowerBonus(10), -3);
    assert.equal(intimacyLevelLabel(85), '灵魂双排');
    assert.equal(rankModeById('five').companions, 4);

    const spec = buildCoopSummarySpec({
        saveId: 'save-1',
        gameName: '曜世战场',
        sessions: [{ day: 3, modeLabel: '双排', wins: 3, losses: 1, companionsMeta: [{ type: 'ai', name: '阿夜' }] }],
        relations: [{ targetType: 'ai', name: '阿夜', intimacy: 66, gamesTogether: 4, coupleTag: { name: '峡谷同行' } }],
    });
    assert.ok(spec, '有 AI 同游就要出卡');
    assert.ok(spec.content.includes('阿夜'));
    assert.ok(spec.content.includes('峡谷同行'));
    assert.equal(buildCoopSummarySpec({ saveId: 's', gameName: 'g', sessions: [], relations: [] }), null, '没 AI 参与不出卡');
});
