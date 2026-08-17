/**
 * 追光（演员成长之路）· 纯函数测试
 *
 * 只测不碰 window 的部分：
 *   分线表 / 事件加权概率（分线曲线、属性护盾、公关护盾、确定性掷签）/
 *   每档时钟（快进、跨日、虚拟毫秒）/ NPC 确定性名册 /
 *   生涯引擎（加点校验、试镜 seed 回放、奖项条件与周期）/
 *   提示词组装（预览 == 发送）/ providers 进场 / 演员世界预设。
 * 跑法：npm test（package.json 已挂 @ 别名 loader）。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    tierSpec, TIERS, EVENT_DEFS, NPC_ROSTER_SIZE, NPC_HIDDEN_COUNT,
    AWARD_PRESETS, ATTR_MAX,
} from '../js/apps/actor-career/constants.js';
import {
    tierCurveP, guardFactor, eventProbability, rollDailyEvents, eventDefById,
} from '../js/apps/actor-career/services/event-engine.js';
import {
    createClock, virtualMs, fastForward, advanceMinutes, nextDay, setSlot,
    currentSlotId, offsetSummary,
} from '../js/apps/actor-career/services/clock.js';
import {
    generateRoster, defaultActiveIds, npcPersonaText, wrapAiAsNpc,
} from '../js/apps/actor-career/services/npc-engine.js';
import {
    blankAllocation, validateAllocation, suggestAllocation, settleAttrDeltas,
    audition, dueAwards, randomizeAwards, checkAwardConditions, defaultAwardConfig,
    defaultFestivalConfig, upcomingAnchors, projectPay,
} from '../js/apps/actor-career/services/career-engine.js';
import { craftScore, performScore, attrsBrief, minuteToHm } from '../js/apps/actor-career/utils.js';
import { buildScriptPrompt, buildSettlementBlockPrompt } from '../js/apps/actor-career/services/prompt-builder.js';
import { registerActorProviders } from '../js/apps/actor-career/services/providers.js';
import {
    collectSocialInfluences, clearSocialInfluenceProviders,
} from '../src/core/social-influence-registry.js';
import { createWorldFromPreset } from '../js/apps/setting/world/presets/world-presets.js';
import {
    awardsToRangeAnchors, festivalsToPointAnchors, tournamentsToRangeAnchors,
    syncCareerAnchorsToWorld, worldAnchorsToAwards, worldAnchorsToActorFestivals,
    SOURCE_ACTOR,
} from '../js/apps/setting/world/sdk/anchor-sync.js';
import { buildBlueprint, reviewBlueprint } from '../js/apps/app-maker/survey/blueprint.js';
import { buildPrompt } from '../js/apps/app-maker/survey/prompt.js';

// ============================================================
// 分线表
// ============================================================

test('tier: 18 线到 1 线的数值方向正确', () => {
    assert.equal(TIERS.length, 18);
    const t18 = tierSpec(18);
    const t1 = tierSpec(1);
    assert.equal(t18.fameBase, 2, '18 线知名度基准 2');
    assert.equal(t1.fameBase, 92, '1 线知名度基准 92');
    assert.ok(t1.budget > t18.budget, '线越高加点预算越高');
    assert.ok(t1.dayPay > t18.dayPay * 50, '顶流日薪远高于糊咖');
    assert.ok(t1.prCost > t18.prCost, '顶流公关更贵');
    assert.equal(tierSpec(99).tier, 18, '越界钳制');
    assert.equal(tierSpec(0).tier, 1, '越界钳制');
});

// ============================================================
// 事件加权概率（用户点名的核心系统）
// ============================================================

test('event: 分线曲线 —— 被全网黑 18 线 5%，1 线 80%，指数插值单调上升', () => {
    const def = eventDefById('all-net-black');
    assert.ok(def, '事件库里有「被全网黑」');
    assert.ok(Math.abs(tierCurveP(def.curve, 18) - 0.05) < 1e-9, '18 线正好 5%');
    assert.ok(Math.abs(tierCurveP(def.curve, 1) - 0.80) < 1e-9, '1 线正好 80%');
    let prev = 0;
    for (let tier = 18; tier >= 1; tier -= 1) {
        const p = tierCurveP(def.curve, tier);
        assert.ok(p > prev, `${tier} 线概率高于 ${tier + 1} 线`);
        prev = p;
    }
    // 指数插值：中段（10 线附近）应显著低于线性插值的中点
    const mid = tierCurveP(def.curve, 10);
    assert.ok(mid < (0.05 + 0.80) / 2, '中段低于线性中点（越接近顶流涨得越快）');
});

test('event: 属性护盾 —— 数值特别好能把概率压下来，数值差反向放大', () => {
    const def = eventDefById('all-net-black');
    const base = { tier: 1, day: 10, shieldUntilDay: 0, energy: 80, hasProject: false, triggeredOnceIds: [], lastTriggeredDayById: {} };
    const good = eventProbability(def, { ...base, attrs: { resilience: 95, network: 95, empathy: 95, fame: 92 } });
    const avg = eventProbability(def, { ...base, attrs: { resilience: 55, network: 55, empathy: 55, fame: 92 } });
    const bad = eventProbability(def, { ...base, attrs: { resilience: 15, network: 15, empathy: 15, fame: 92 } });
    assert.ok(good.p < avg.p, '好数值 < 平均数值');
    assert.ok(avg.p < bad.p, '平均数值 < 差数值');
    assert.ok(good.p < 0.45, `顶流满防概率应明显低于 80%（实际 ${good.p.toFixed(3)}）`);
    assert.ok(bad.p >= 0.9, '差数值顶流逼近 cap');
    // 护盾因子方向
    assert.ok(guardFactor(def.guards, { resilience: 100, network: 100, empathy: 100 }) < 1);
    assert.ok(guardFactor(def.guards, { resilience: 0, network: 0, empathy: 0 }) > 1);
});

test('event: 公关护盾把舆情概率 ×0.15；冷却与 once 排除生效', () => {
    const def = eventDefById('all-net-black');
    const ctx = { tier: 1, attrs: { resilience: 55, network: 55, empathy: 55, fame: 92 }, day: 10, energy: 80, hasProject: false, triggeredOnceIds: [], lastTriggeredDayById: {} };
    const open = eventProbability(def, { ...ctx, shieldUntilDay: 0 });
    const shielded = eventProbability(def, { ...ctx, shieldUntilDay: 12 });
    assert.ok(shielded.p < open.p * 0.25, '护盾期概率大幅下降');
    // 冷却
    const cooled = eventProbability(def, { ...ctx, shieldUntilDay: 0, lastTriggeredDayById: { 'all-net-black': 8 } });
    assert.equal(cooled.p, 0, '冷却期内不再触发');
    // once
    const tax = eventDefById('tax-storm');
    const once = eventProbability(tax, { ...ctx, attrs: { ...ctx.attrs, fame: 92 }, triggeredOnceIds: ['tax-storm'] });
    assert.equal(once.p, 0, 'once 事件只出一次');
});

test('event: 掷签确定性 —— 同档同天永远同一批（回档重放一致）', () => {
    const ctx = {
        tier: 3, attrs: { resilience: 40, network: 40, empathy: 40, fame: 80 },
        shieldUntilDay: 0, energy: 50, hasProject: true,
        triggeredOnceIds: [], lastTriggeredDayById: {},
    };
    for (let day = 1; day <= 30; day += 1) {
        const a = rollDailyEvents('save-x', day, { ...ctx, day }).map((r) => r.def.id);
        const b = rollDailyEvents('save-x', day, { ...ctx, day }).map((r) => r.def.id);
        assert.deepEqual(a, b, `第 ${day} 天两次掷签一致`);
    }
    // 不同档同一天可以不同（seed 里带 saveId）
    const days = [];
    for (let day = 1; day <= 60; day += 1) {
        const a = rollDailyEvents('save-a', day, { ...ctx, day }).map((r) => r.def.id).join(',');
        const b = rollDailyEvents('save-b', day, { ...ctx, day }).map((r) => r.def.id).join(',');
        if (a !== b) days.push(day);
    }
    assert.ok(days.length > 0, '不同档的事件流不完全相同');
});

test('event: 每天常规事件最多 2 件', () => {
    const ctx = {
        tier: 1, attrs: { resilience: 5, network: 5, empathy: 5, fame: 92 },
        shieldUntilDay: 0, energy: 10, hasProject: true,
        triggeredOnceIds: [], lastTriggeredDayById: {},
    };
    for (let day = 1; day <= 40; day += 1) {
        const rolled = rollDailyEvents('save-cap', day, { ...ctx, day });
        const normal = rolled.filter((r) => r.def.kind !== 'hidden');
        assert.ok(normal.length <= 2, `第 ${day} 天常规事件 ${normal.length} ≤ 2`);
    }
});

// ============================================================
// 每档时钟
// ============================================================

test('clock: 虚拟毫秒 / 快进 / 跨日 / 槽位', () => {
    const now = new Date(2026, 7, 15, 20, 30).getTime();
    const clock = createClock(now);
    assert.equal(clock.day, 1);
    assert.ok(clock.syncReal, '开档默认与现实同步');

    // 快进 7 天：整档时间一起走
    const ff = fastForward(clock, 7);
    assert.equal(ff.day, 8);
    assert.ok(!ff.syncReal, '快进后切手动');
    const diffDays = Math.round((virtualMs(ff) - virtualMs({ ...clock, minute: ff.minute })) / 86400000);
    assert.equal(diffDays, 7, '虚拟毫秒轴前进了 7 天');
    assert.ok(offsetSummary(ff, now).includes('快'), '偏移说明显示比现实快');

    // 24:00 封顶
    const { clock: c2, hitMidnight } = advanceMinutes({ ...clock, minute: 23 * 60, syncReal: false }, 120);
    assert.ok(hitMidnight, '过 24 点要问用户');
    assert.equal(c2.minute, 24 * 60, '封顶在 24:00');

    // 跨日
    const c3 = nextDay(c2, now);
    assert.equal(c3.day, 2);
    assert.equal(c3.minute, 7 * 60, '新的一天从 7:00 开始');

    // 槽位
    const morning = setSlot(clock, 'morning');
    assert.equal(currentSlotId(morning), 'morning');
    assert.ok(!morning.syncReal, '手动调时段后不再同步现实');
    const night = setSlot(clock, 'night');
    assert.equal(currentSlotId(night), 'night');
    assert.equal(minuteToHm(night.minute), '22:30');
});

// ============================================================
// NPC 确定性名册
// ============================================================

test('npc: 同档案键永远同一批 30 人，不同档案键不同', () => {
    const a1 = generateRoster('user0::world0');
    const a2 = generateRoster('user0::world0');
    const b = generateRoster('user1::world0');

    assert.equal(a1.length, NPC_ROSTER_SIZE);
    assert.deepEqual(a1, a2, '同 key 两次生成完全一致');
    assert.notDeepEqual(a1.map((n) => n.name), b.map((n) => n.name), '不同 key 的名册不同');

    const hidden = a1.filter((n) => n.hidden);
    assert.equal(hidden.length, NPC_HIDDEN_COUNT, '固定 2 个隐藏 NPC');
    assert.ok(hidden.every((n) => n.revealed === false), '隐藏 NPC 初始未揭示');

    const active = defaultActiveIds(a1);
    assert.equal(active.length, 15, '每档默认启用 15 人');
    assert.ok(active.every((id) => !a1.find((n) => n.id === id).hidden), '默认启用的都不是隐藏 NPC');

    const names = new Set(a1.map((n) => n.name));
    assert.equal(names.size, a1.length, '名字不重复');

    const text = npcPersonaText(a1[0]);
    assert.ok(text.includes('MBTI'), '人设文本含 MBTI');
    assert.ok(text.includes(a1[0].name), '人设文本含名字');
});

test('npc: AI 包装成 NPC 带人设快照与哈希', () => {
    const npc = wrapAiAsNpc({ id: 'ai7', name: '阿澈', role: '经纪人', personality: '毒舌' }, '阿澈的完整人设');
    assert.equal(npc.id, 'ai::ai7');
    assert.ok(npc.fromAi);
    assert.equal(npc.personaSnapshot, '阿澈的完整人设');
    assert.ok(Number.isFinite(npc.personaHash));
});

// ============================================================
// 生涯引擎
// ============================================================

test('career: 初始加点 —— 预算校验与推荐分配', () => {
    const { attrs, budget } = blankAllocation(18);
    assert.equal(attrs.fame, 2, '18 线知名度锁定 2');
    assert.equal(budget, 140);

    const over = validateAllocation({ voice: 100, diction: 100 }, 18);
    assert.ok(!over.ok, '超预算不通过');

    const suggested = suggestAllocation(10, 'seed');
    const check = validateAllocation(suggested, 10);
    assert.ok(check.ok, '推荐加点不超预算');
    assert.equal(suggested.fame, tierSpec(10).fameBase, '推荐加点不动知名度');
    assert.deepEqual(suggestAllocation(10, 'seed'), suggested, '同 seed 推荐一致');
});

test('career: 属性结算钳制与留痕', () => {
    const { attributes, changes } = settleAttrDeltas({ acting: 50, fame: 90 }, { acting: 30, fame: 30 }, 8);
    assert.equal(attributes.acting, 58, '单项钳制在 ±8');
    assert.equal(attributes.fame, 98, '钳制后仍受 0~100 上限保护');
    assert.ok(changes.every((c) => 'before' in c && 'after' in c && 'applied' in c), '留痕字段齐全');
    const capped = settleAttrDeltas({ acting: 99 }, { acting: 8 }, 8);
    assert.equal(capped.attributes.acting, ATTR_MAX, '不超过 100');
});

test('career: 试镜 seed 回放一致，档位越高越难', () => {
    const save = {
        id: 'save-audition', tier: 12, energy: 80, auditionCount: 0,
        clock: { day: 5 },
        attrs: { voice: 50, diction: 50, body: 50, acting: 50, empathy: 50, camera: 50, network: 40, resilience: 40, fame: 30 },
    };
    const a = audition(save, 'support', 55);
    const b = audition(save, 'support', 55);
    assert.equal(a.seed, b.seed, '同状态同 seed');
    assert.equal(a.result.roll, b.result.roll, '同 seed 同 roll —— 不存在重 roll');
    assert.equal(a.result.success, b.result.success);

    const lead = audition(save, 'lead', 55);
    assert.ok(lead.result.chance < a.result.chance, '越级试主角成功率更低');
});

test('career: 奖项周期与条件', () => {
    const awards = defaultAwardConfig();
    assert.equal(awards.length, AWARD_PRESETS.length);
    const due90 = dueAwards(awards, 90);
    assert.ok(due90.some((a) => a.id === 'award-newcomer'), '第 90 天新人奖开奖');
    assert.equal(dueAwards(awards, 91).length, 0, '非周期日不开奖');

    const weak = checkAwardConditions(awards.find((a) => a.id === 'award-goldwood'), {
        tier: 10, attrs: { fame: 10, voice: 10, diction: 10, body: 10, acting: 10 }, finishedWorks: 0,
    });
    assert.ok(!weak.ok, '条件不够连提名都没有');
    assert.ok(weak.fails.length >= 2);

    const randomized = randomizeAwards('seed-1');
    assert.equal(randomized.length, awards.length, '随机保持数量');
    assert.deepEqual(randomized.map((a) => a.id), awards.map((a) => a.id), '随机不改 id（存档启停按 id）');
    assert.deepEqual(randomizeAwards('seed-1'), randomized, '同 seed 随机一致');

    const anchors = upcomingAnchors(awards, defaultFestivalConfig(), 44, 20);
    assert.ok(anchors.some((row) => row.kind === 'festival' && row.day === 45), '影迷嘉年华在第 45 天');
});

test('career: 片酬随线级与角色档位放大', () => {
    const base = {
        id: 's', tier: 15, clock: { day: 1 },
        attrs: { fame: 10 },
    };
    const small = projectPay(base, { type: 'short', roleLevel: 'extra', scenes: [{}, {}, {}] });
    const big = projectPay({ ...base, tier: 2 }, { type: 'film', roleLevel: 'lead', scenes: [{}, {}, {}, {}, {}] });
    assert.ok(big > small * 50, '顶流电影主角片酬远超糊咖短剧龙套');
});

// ============================================================
// 综合分
// ============================================================

test('utils: 声台形表均值与演出综合分', () => {
    const attrs = { voice: 80, diction: 60, body: 70, acting: 90, empathy: 50, camera: 60, network: 30, resilience: 40, fame: 20 };
    assert.equal(craftScore(attrs), 75);
    assert.ok(performScore(attrs) > 0);
    assert.ok(attrsBrief(attrs).includes('声80'));
});

// ============================================================
// 提示词组装（预览 == 发送）
// ============================================================

const FAKE_STATE = {
    identity: { userId: 'u', userName: '阿真', worldId: 'w', worldName: '演员世界', profileKey: 'u::w', currency: '元' },
    profile: { stageName: '沈追光', agencyStatus: '独立艺人', genres: ['正剧'], style: '体验派', goal: '拿金梧桐' },
    save: {
        id: 'save-p', tier: 12, energy: 70, finishedWorks: 1,
        honors: [{ title: '新人风采奖' }],
        clock: { anchorMs: new Date(2026, 0, 1).getTime(), day: 15, minute: 600, syncReal: false },
        attrs: { voice: 40, diction: 50, body: 45, acting: 60, empathy: 50, camera: 45, network: 30, resilience: 35, fame: 32 },
    },
    timeline: [{ day: 12, title: '试镜《长夜》拿下重要配角', detail: '', major: true }],
};

test('prompt: 剧本生成 —— text 与 parts 同源，包含生涯与格式约束', () => {
    const { text, parts, stats } = buildScriptPrompt({
        ...FAKE_STATE, clips: [], source: null, opinion: '想演反派',
    });
    assert.ok(text.includes('12线'), '提示词含当前线级');
    assert.ok(text.includes('想演反派'), '用户意见进了 prompt');
    assert.ok(text.includes('严格输出 JSON'), '带输出格式约束');
    assert.ok(text.includes('第 15 天'), '档内时间进了 prompt');
    const included = parts.filter((p) => p.included);
    assert.ok(included.length >= 4, '至少四段进场');
    assert.ok(stats.tokens > 0);
    for (const part of included) {
        assert.ok(text.includes(part.content.trim().slice(0, 20)), `${part.title} 的内容在最终文本里`);
    }
});

test('prompt: 阶段结算块 —— 数值块要 JSON、叙事块不要，且带前块上下文', () => {
    const statsBlock = buildSettlementBlockPrompt({
        ...FAKE_STATE,
        block: { id: 'stats', label: '数值结算', type: 'json', desc: '九维属性的增减与理由' },
        previousBlocks: [{ label: '阶段回顾', output: '这一年你把台词磨了三遍。' }],
    });
    assert.ok(statsBlock.text.includes('attrDeltas'), '数值块要求 JSON');
    assert.ok(statsBlock.text.includes('这一年你把台词磨了三遍'), '前块输出进上下文');
    assert.ok(statsBlock.text.includes('11线'), '目标线级正确（12 → 11）');

    const recapBlock = buildSettlementBlockPrompt({
        ...FAKE_STATE,
        block: { id: 'recap', label: '阶段回顾', type: 'text', desc: '这段路怎么走过来的' },
        previousBlocks: [],
    });
    assert.ok(!recapBlock.text.includes('attrDeltas'), '叙事块不要 JSON');
});

// ============================================================
// providers（生涯 → 氧气/萤火）
// ============================================================

test('providers: 热搜词条只出概要文本，档没了就沉默', async () => {
    clearSocialInfluenceProviders();
    let current = { ...FAKE_STATE, projects: [] };
    const unregister = registerActorProviders(() => current);

    const parts = await collectSocialInfluences({ targetAppId: 'blog', channel: 'hot-search' });
    const hot = parts.find((p) => p.id.includes('hot-terms'));
    assert.ok(hot, '热搜 provider 进场');
    assert.ok(hot.content.includes('沈追光'), '词条带艺名');
    assert.ok(hot.content.includes('试镜《长夜》'), '词条来自大事记');

    const dm = await collectSocialInfluences({ targetAppId: 'blog', channel: 'dm' });
    assert.ok(dm.some((p) => p.id.includes('dm-vibe')), '私信风向进场');

    current = { save: null, timeline: [], projects: [], profile: null };
    const empty = await collectSocialInfluences({ targetAppId: 'blog', channel: 'hot-search' });
    assert.equal(empty.filter((p) => p.source === 'actor-career').length, 0, '没档时 provider 输出为空');

    unregister();
    clearSocialInfluenceProviders();
});

// ============================================================
// 演员世界预设
// ============================================================

test('preset: 演员世界预设带夹子与分线设定', () => {
    const world = createWorldFromPreset('preset-actor-world');
    assert.equal(world.experienceMode, 'actor');
    assert.ok(world.keyPoints.some((p) => p.includes('18 线')), '关键设定写了分线体系');
    assert.equal(world.flows.length, 3, '三条行业夹子');
    assert.ok(world.flows.every((f) => f.id && f.title && f.content), '夹子结构完整');
    assert.ok(world.anchors.length > 0, '演员预设带奖项/节日锚点');
    // 预设只剩演员/电竞两套：删掉的 id 一律返回 null
    assert.equal(createWorldFromPreset('preset-idol-world'), null, '已删除的预设返回 null');
    const esports = createWorldFromPreset('preset-esports-world');
    assert.equal(esports.experienceMode, 'esports');
    assert.ok(esports.anchors.length > 0, '电竞预设带赛事/节日锚点');
});

// ============================================================
// 时间锚点 ↔ 世界观预设 App 的联动
// ============================================================

/** 一个够用的假 sdk：anchors 读写都落在 world.anchors 上，和真实现一致 */
function makeAnchorSdk(world) {
    return {
        anchors: {
            getAnchors: () => (Array.isArray(world.anchors) ? world.anchors.slice() : []),
        },
        worlds: {
            get: () => world,
            update: async (_id, patch) => { Object.assign(world, patch); return world; },
        },
    };
}

test('anchor: 奖项→段锚点 / 节日→点锚点，结构完整且带来源标记', () => {
    const awards = defaultAwardConfig();
    const festivals = defaultFestivalConfig();

    const ranges = awardsToRangeAnchors(awards, SOURCE_ACTOR);
    assert.ok(ranges.length > 0, '奖项能转出段锚点');
    for (const a of ranges) {
        assert.equal(a.type, 'range');
        assert.equal(a.source, SOURCE_ACTOR, '带来源，才能在同步时只覆盖自己那批');
        assert.ok(a.sourceId, '记住原始 id 才能回写');
        assert.ok(a.label, '有标签');
        assert.ok(a.start && a.end, '段锚点必须有起止');
        assert.ok(a.end.month >= 1 && a.end.month <= 12, '止月在 1~12');
    }

    const points = festivalsToPointAnchors(festivals, SOURCE_ACTOR);
    assert.ok(points.length > 0, '节日能转出点锚点');
    for (const p of points) {
        assert.equal(p.type, 'point');
        assert.equal(p.end, null, '点锚点没有止');
        assert.ok(p.start.day >= 1 && p.start.day <= 28, '日在 1~28，避免跨月歧义');
    }

    // 电竞侧走同一套结构
    const espRanges = tournamentsToRangeAnchors([{ id: 't1', name: '春霖杯', gapDays: 9 }]);
    assert.equal(espRanges.length, 1);
    assert.equal(espRanges[0].type, 'range');
    assert.equal(espRanges[0].source, 'esports-forum');
});

test('anchor: 同步不会冲掉用户自建锚点，重复同步不产生重复项', async () => {
    // 用户在世界观里自己建的锚点没有 source 字段
    const mine = {
        id: 'anchor-mine', type: 'point', label: '我的纪念日',
        start: { year: 0, month: 2, day: 5 }, end: null,
        boundAiIds: ['ai-1'], enabled: true,
    };
    const world = { id: 'w1', anchors: [mine] };
    const sdk = makeAnchorSdk(world);

    const awards = defaultAwardConfig();
    const festivals = defaultFestivalConfig();

    await syncCareerAnchorsToWorld(sdk, 'w1', { awards, festivals });
    const first = world.anchors.slice();
    assert.ok(first.some((a) => a.id === 'anchor-mine'), '自建锚点还在');
    assert.ok(first.some((a) => a.source === SOURCE_ACTOR), '同步进来的锚点也在');

    // 再同步一次：数量不变（按 id 覆盖，不是不断追加）
    await syncCareerAnchorsToWorld(sdk, 'w1', { awards, festivals });
    assert.equal(world.anchors.length, first.length, '重复同步不产生重复锚点');

    // 用户给同步来的锚点绑过 AI，再同步不能被清掉
    const synced = world.anchors.find((a) => a.source === SOURCE_ACTOR);
    synced.boundAiIds = ['ai-9'];
    await syncCareerAnchorsToWorld(sdk, 'w1', { awards, festivals });
    const after = world.anchors.find((a) => a.id === synced.id);
    assert.deepEqual(after.boundAiIds, ['ai-9'], '绑定的 AI 在再次同步后保留');

    // 关掉某个奖项 → 同步后锚点也停用
    const off = awards.map((a, i) => (i === 0 ? { ...a, enabled: false } : a));
    await syncCareerAnchorsToWorld(sdk, 'w1', { awards: off, festivals });
    const offAnchor = world.anchors.find((a) => a.sourceId === awards[0].id);
    assert.equal(offAnchor.enabled, false, '奖项停用会同步成锚点停用');
});

test('anchor: 世界观锚点能反向还原成演员 App 的奖项与节日', async () => {
    const world = { id: 'w2', anchors: [] };
    const sdk = makeAnchorSdk(world);
    const awards = defaultAwardConfig();
    const festivals = defaultFestivalConfig();
    await syncCareerAnchorsToWorld(sdk, 'w2', { awards, festivals });

    const backAwards = worldAnchorsToAwards(world.anchors);
    const backFestivals = worldAnchorsToActorFestivals(world.anchors);
    assert.equal(backAwards.length, awards.length, '奖项数量还原');
    assert.equal(backFestivals.length, festivals.length, '节日数量还原');
    assert.deepEqual(
        backAwards.map((a) => a.id).sort(),
        awards.map((a) => a.id).sort(),
        '奖项 id 一一对应，不会串',
    );
});

test('preset: 演员 / 电竞预设导入后世界观里就有锚点', () => {
    const actor = createWorldFromPreset('preset-actor-world');
    assert.ok(actor.anchors.some((a) => a.type === 'range'), '演员预设自带段锚点');
    assert.ok(actor.anchors.some((a) => a.type === 'point'), '演员预设自带点锚点');
    assert.ok(actor.anchors.every((a) => a.source === SOURCE_ACTOR), '来源都是演员 App');

    const esports = createWorldFromPreset('preset-esports-world');
    assert.ok(esports.anchors.some((a) => a.type === 'range'), '电竞预设自带赛事段锚点');
    assert.ok(esports.anchors.some((a) => a.type === 'point'), '电竞预设自带节日点锚点');
});

// ============================================================
// app-maker 世界观模拟升级
// ============================================================

test('app-maker: 勾世界观模拟能力 → 蓝图与提示词带出整套地基', () => {
    const bp = buildBlueprint({
        appName: '爱豆养成',
        capabilities: ['db', 'ai', 'worldContent', 'worldAsset', 'worldTime', 'statSystem', 'eventSystem', 'saveSystem', 'npcSystem'],
        stores: ['items'],
        pages: [{ name: '首页', desc: '', layout: 'column', cards: ['info'], cardFields: ['title'], subpages: [] }],
        crossApp: ['socialInfluence', 'worldMode'],
        systemReads: ['world'],
        renderMode: 'vue',
    });
    assert.ok(bp.worldSim.any);
    assert.ok(bp.worldSim.asset && bp.worldSim.time && bp.worldSim.events && bp.worldSim.saves && bp.worldSim.npcs);

    const prompt = buildPrompt(bp);
    assert.ok(prompt.includes('actor-career'), '提示词指向追光参考实现');
    assert.ok(prompt.includes('asset-ledger'), '资产章节存在');
    assert.ok(prompt.includes('anchorMs'), '每档时钟设计存在');
    assert.ok(prompt.includes('阶段曲线 × 属性护盾'), '加权事件公式存在');
    assert.ok(prompt.includes('resolveContest'), '数值系统章节存在');
    assert.ok(prompt.includes('registerSocialInfluenceProvider'), '社交影响通道存在');
    assert.ok(prompt.includes('worldAvailability'), '专属世界模式存在');
    assert.ok(prompt.includes('重开新档：时间归零'), '存档语义进自查清单');
});

test('app-maker: 世界观模拟不勾存储是 blocker，事件缺数值给 warning', () => {
    const noDb = reviewBlueprint(buildBlueprint({
        appName: 'x', capabilities: ['worldTime'], pages: [], crossApp: [], systemReads: [],
    }));
    assert.ok(!noDb.ok, '没勾存储直接拦下');

    const noStats = reviewBlueprint(buildBlueprint({
        appName: 'x', capabilities: ['db', 'eventSystem'], stores: ['items'], pages: [], crossApp: [], systemReads: [],
    }));
    assert.ok(noStats.ok, '只是 warning 不拦');
    assert.ok(noStats.warnings.some((w) => w.includes('属性护盾')), '提醒事件缺数值系统');
});
