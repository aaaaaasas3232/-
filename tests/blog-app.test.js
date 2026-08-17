/**
 * 氧气（博客 App）· 纯函数测试
 *
 * 只测不碰 window 的部分：氧气值规则（增益递减 / 日衰减 / 上限）、
 * 小听机制（出现概率方向 / 颜色漂移 / 记忆淘汰 / 恶作剧频控 / 几何体白名单）、
 * 提示词组装（预览 == 发送 / 标签优先 / provider 进场）、配色批量解析、
 * 关机彩蛋台词（记忆插槽）、共享工具函数。
 * 跑法：npm test（package.json 已挂 @ 别名 loader）。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    baseGain, gainFor, decayFor, clampOxygen, isLow, ledgerEntry, capLedger,
} from '../js/apps/blog-app/services/oxygen-rules.js';
import {
    appearProbability, canPrank, capMemories, driftAfterSession, parseGiftSpec, shouldGift,
} from '../js/apps/blog-app/services/xiaoting-rules.js';
import {
    buildFeedPrompt, buildPostDetailPrompt, buildHotPrompt, buildDmPrompt,
    buildOrganizePrompt, buildPersonaPrompt, buildGiftPrompt, buildXiaotingChatPrompt,
    XIAOTING_PERSONA,
} from '../js/apps/blog-app/services/prompt-builder.js';
import { BLOG_PROMPTS } from '../js/apps/blog-app/services/app-prompts.js';
import { buildShutdownScript } from '../js/apps/blog-app/services/shutdown.js';
import { parseColorBatch, ALL_TOKENS } from '../js/apps/blog-app/theme.js';
import { OXYGEN, XIAOTING, SHAPE_IDS } from '../js/apps/blog-app/constants.js';
import {
    computePostStats, hotHeat, geometryColor,
} from '../js/apps/blog-app/utils.js';
import {
    fmtCap, fmtCount, daysBetween, dayKey, hashString,
} from '../js/apps/social-shared/social-kit.js';

// ============================================================
// 氧气值规则
// ============================================================

test('oxygen: 增益按类型给，同日第 4 次起减半', () => {
    assert.equal(baseGain('long'), OXYGEN.GAIN.long);
    assert.equal(gainFor('long', 0), OXYGEN.GAIN.long);
    assert.equal(gainFor('long', OXYGEN.DIMINISH_AFTER - 1), OXYGEN.GAIN.long, '第 3 次还是全额');
    assert.equal(gainFor('long', OXYGEN.DIMINISH_AFTER), Math.round(OXYGEN.GAIN.long / 2), '第 4 次减半');
    assert.equal(gainFor('murmur', 10), Math.max(1, Math.round(OXYGEN.GAIN.murmur / 2)), '减半后至少 +1');
    assert.equal(gainFor('unknown-kind', 0), 0, '未知类型不加');
});

test('oxygen: 日衰减按天数算并有单次上限，同日不扣', () => {
    assert.deepEqual(decayFor('2026-08-15', '2026-08-15'), { decay: 0, days: 0 }, '同一天不扣');
    assert.deepEqual(decayFor('2026-08-14', '2026-08-15'), { decay: OXYGEN.DAILY_DECAY, days: 1 });
    const twoDays = decayFor('2026-08-13', '2026-08-15');
    assert.equal(twoDays.decay, OXYGEN.DAILY_DECAY * 2);
    const longGap = decayFor('2026-01-01', '2026-08-15');
    assert.equal(longGap.decay, OXYGEN.DECAY_CAP, '离开很多天也不会一口气扣穿');
    assert.deepEqual(decayFor('', '2026-08-15'), { decay: 0, days: 0 }, '没有起点不扣');
});

test('oxygen: clamp 与低氧判定与流水', () => {
    assert.equal(clampOxygen(120), 100);
    assert.equal(clampOxygen(-5), 0);
    assert.equal(isLow(OXYGEN.LOW_THRESHOLD), true);
    assert.equal(isLow(OXYGEN.LOW_THRESHOLD + 1), false);
    const entry = ledgerEntry('发了长文', 50, 58);
    assert.equal(entry.delta, 8);
    assert.equal(entry.before, 50);
    assert.equal(entry.after, 58);
    const capped = capLedger(Array.from({ length: OXYGEN.LEDGER_CAP + 40 }, (_, i) => ({ at: i })));
    assert.equal(capped.length, OXYGEN.LEDGER_CAP, '流水有上限');
    assert.equal(capped[0].at, 40, '截断丢的是最旧的');
});

// ============================================================
// 小听：出现概率 / 颜色 / 记忆 / 恶作剧 / 几何体
// ============================================================

test('xiaoting: 前 2 次整理永不出现；连续低落概率上升；极低落有保底；好转下降', () => {
    assert.equal(appearProbability({ sessionsCount: 0 }), 0);
    assert.equal(appearProbability({ sessionsCount: XIAOTING.APPEAR_FREE_SESSIONS - 1 }), 0);

    const calm = appearProbability({ sessionsCount: 5, negativeStreak: 0, positiveStreak: 0 });
    const sad1 = appearProbability({ sessionsCount: 5, negativeStreak: 1, positiveStreak: 0 });
    const sad3 = appearProbability({ sessionsCount: 5, negativeStreak: 3, positiveStreak: 0 });
    assert.ok(sad1 > calm, '低落一场概率要涨');
    assert.ok(sad3 > sad1, '连续低落概率继续涨');
    assert.ok(sad3 <= XIAOTING.APPEAR_CAP, '封顶');

    const veryLow = appearProbability({ sessionsCount: 5, negativeStreak: 0, lastMood: -2 });
    assert.ok(veryLow >= XIAOTING.APPEAR_MIN_WHEN_VERY_LOW, '单次 mood ≤ -2 有保底');

    const happy = appearProbability({ sessionsCount: 5, negativeStreak: 0, positiveStreak: 3 });
    assert.ok(happy <= calm, '好转概率下降');

    const stayedLow = appearProbability({ sessionsCount: 9, appearedOnce: true, lastMood: -1 });
    const stayedFine = appearProbability({ sessionsCount: 9, appearedOnce: true, lastMood: 1, negativeStreak: 0 });
    assert.equal(stayedLow, XIAOTING.STAY_WHEN_LOW, '出现过之后低落时几乎总在');
    assert.equal(stayedFine, XIAOTING.STAY_WHEN_FINE, '状态好时常常不在');
});

test('xiaoting: 负面情绪让颜色变深，正向缓慢变浅，且有上下限', () => {
    const fixedRand = () => 0.5;
    const dark = driftAfterSession({ colorL: 60 }, -2, fixedRand);
    assert.ok(dark.colorL < 60, '负面变深');
    assert.equal(dark.negativeStreak, 1);
    assert.equal(dark.positiveStreak, 0);

    const light = driftAfterSession({ colorL: 60 }, 2, fixedRand);
    assert.ok(light.colorL > 60, '正向变浅');

    const floor = driftAfterSession({ colorL: XIAOTING.COLOR_MIN }, -2, fixedRand);
    assert.ok(floor.colorL >= XIAOTING.COLOR_MIN, '不越下限');
    const ceil = driftAfterSession({ colorL: XIAOTING.COLOR_MAX }, 2, fixedRand);
    assert.ok(ceil.colorL <= XIAOTING.COLOR_MAX, '不越上限');
});

test('xiaoting: 记忆淘汰先丢普通碎片，关机输入优先保留', () => {
    const list = [];
    for (let i = 0; i < XIAOTING.MEMORY_CAP + 10; i += 1) {
        list.push({ text: `m${i}`, source: i < 5 ? 'shutdown' : 'meditation', at: i });
    }
    const kept = capMemories(list);
    assert.equal(kept.length, XIAOTING.MEMORY_CAP);
    for (let i = 0; i < 5; i += 1) {
        assert.ok(kept.some((f) => f.text === `m${i}`), `关机碎片 m${i} 必须还在`);
    }
    assert.ok(!kept.some((f) => f.text === 'm5'), '最旧的普通碎片被淘汰');
});

test('xiaoting: 恶作剧频控 —— 没出现过 / 关掉 / 72h 内 / 深夜都不触发', () => {
    const now = Date.now();
    const hit = () => 0;      // rand=0 → 必中概率
    const base = { appearedOnce: true, pranksEnabled: true, lastPrankAt: 0 };

    assert.equal(canPrank({ ...base, appearedOnce: false }, now, 12, hit), false, '没出现过不恶作剧');
    assert.equal(canPrank({ ...base, pranksEnabled: false }, now, 12, hit), false, '开关关了不恶作剧');
    assert.equal(canPrank({ ...base, lastPrankAt: now - 1000 }, now, 12, hit), false, '72 小时内不二次触发');
    assert.equal(canPrank(base, now, 23, hit), false, '23 点后不触发');
    assert.equal(canPrank(base, now, 3, hit), false, '凌晨不触发');
    assert.equal(canPrank(base, now, 12, hit), true, '白天 + 冷却过了 + 掷中才触发');
    assert.equal(canPrank(base, now, 12, () => 0.99), false, '没掷中不触发');
});

test('xiaoting: 几何体白名单解析 —— 非法字段丢弃，绝不执行任何代码', () => {
    const ok = parseGiftSpec({ shape: 'cube', sealedQuote: '今天也有好好呼吸', sizeHint: '小' });
    assert.deepEqual(ok, { shape: 'cube', sealedQuote: '今天也有好好呼吸', sizeHint: '小' });

    assert.equal(parseGiftSpec({ shape: 'dragon', sealedQuote: 'x' }), null, '形状不在白名单直接拒绝');
    assert.equal(parseGiftSpec({ shape: 'cube', sealedQuote: '' }), null, '没有封存句拒绝');
    assert.equal(parseGiftSpec(null), null);

    const fixed = parseGiftSpec({ shape: 'ring', sealedQuote: 'q', sizeHint: '超大' });
    assert.equal(fixed.sizeHint, '中', '非法尺寸回落到中');
    assert.ok(SHAPE_IDS.includes(fixed.shape));

    // 送礼概率方向：越低落越倾向送
    let sadGifts = 0;
    let happyGifts = 0;
    for (let i = 0; i < 400; i += 1) {
        const r = () => (i % 100) / 100;
        if (shouldGift(-2, r)) sadGifts += 1;
        if (shouldGift(2, r)) happyGifts += 1;
    }
    assert.ok(sadGifts > happyGifts, '低落时更容易收到礼物');
});

// ============================================================
// 提示词：预览与发送同源、标签优先、provider 进场
// ============================================================

const CTX = {
    identity: { worldName: '雾岛', userName: '阿澈' },
    summary: '一座常年起雾的海岛。',
    clips: [{ id: 'c1', title: '灯塔', content: '岛上有一座旧灯塔。' }],
    prompts: [],
    interests: ['夜航', '旧书店'],
};

test('prompt: 广场列表只出标签级数据，seed 说明「用户永远看不到」', () => {
    const { text, parts, stats } = buildFeedPrompt({ ...CTX, size: 10 });
    assert.ok(text.includes('雾岛'), '世界名进正文');
    assert.ok(text.includes('标签级列表'), '任务是标签级列表');
    assert.ok(text.includes('不写正文'), '明确不出正文');
    assert.ok(text.includes('用户永远看不到'), 'seed 是内部线索');
    assert.ok(parts.some((p) => p.locked && p.id === 'world'), '世界观段锁定');
    assert.ok(stats.included > 0);
    // 预览 == 发送：parts 里 included 的内容必须都在 text 里
    for (const p of parts.filter((x) => x.included)) {
        assert.ok(text.includes(p.content.slice(0, 20)), `${p.id} 段应在发送文本里`);
    }
});

test('prompt: 帖子详情兑现标签，评论首批 5 条', () => {
    const { text } = buildPostDetailPrompt({
        ...CTX,
        stub: { authorName: '海雾', type: 'long', tags: ['夜航', '想家'], seed: '写夜里开船回家' },
    });
    assert.ok(text.includes('夜航'));
    assert.ok(text.includes('内容线索'));
    assert.ok(text.includes('5 条'), '首批评论数量写死在任务里');
});

test('prompt: provider 内容能进热搜和私信的 prompt', () => {
    const influenceParts = [{
        id: 'social-influence:actor::hot',
        title: '近期演艺经历',
        content: '刚拿到一个重要角色的试镜机会',
        source: 'actor-career',
        active: true,
    }];
    const hot = buildHotPrompt({ ...CTX, influenceParts, size: 10 });
    assert.ok(hot.text.includes('试镜机会'), 'provider 概要进热搜 prompt');
    const dm = buildDmPrompt({ ...CTX, influenceParts, nickname: '阿澈', followers: 100, count: 4 });
    assert.ok(dm.text.includes('试镜机会'), 'provider 概要进私信 prompt');
    assert.ok(dm.text.includes('跨 App 经历'), '私信任务明确要求体现风向');
});

test('prompt: 整理三步各就其位，她的身份永远保密', () => {
    const org = buildOrganizePrompt({ notes: [{ id: 'n1', kind: 'note', text: '好累' }] });
    assert.ok(org.text.includes('[n1]'), '纸条 id 进 prompt');
    assert.ok(org.text.includes('mood'), '要 mood 分');
    assert.ok(!org.text.includes('小听'), '第 1 步与她无关');

    const persona = buildPersonaPrompt({ notesBrief: '- 好累', mood: -1, existingMemories: ['上次说想去海边'] });
    assert.ok(persona.text.includes(XIAOTING_PERSONA.slice(0, 12)), '默认人设进场');
    assert.ok(persona.text.includes('上次说想去海边'), '既有记忆进场');
    assert.ok(persona.text.includes('永远不会看到'), '输出不给用户看');

    const gift = buildGiftPrompt({ notesBrief: '- 好累', sealQuote: '好累' });
    assert.ok(gift.text.includes('cube'), '形状白名单写进规则');
    assert.ok(gift.text.includes('不能决定颜色'), '颜色不由 AI 定');

    const chat = buildXiaotingChatPrompt({ name: '球球', userText: '你是谁' });
    assert.ok(chat.text.includes('你叫我球球'), '取名后的自称规则');
    assert.ok(chat.text.includes('绝对不会自称「小听」'), '身份保密是底稿的一部分');
});

test('prompt: murmur 卡注册表 —— 黑匣子默认关、动作格式与 parser 一致', () => {
    const blackbox = BLOG_PROMPTS.find((p) => p.promptId === 'blackbox');
    assert.ok(blackbox, '黑匣子卡存在');
    assert.equal(blackbox.defaultActive, false, '默认关');
    assert.ok(blackbox.content.includes('[黑匣子:'), '卡正文带字面量（chat 侧以它做注入门闸）');
    assert.ok(blackbox.content.includes('不强制'), '不是每次都要说');

    const share = BLOG_PROMPTS.find((p) => p.promptId === 'blog-share-action');
    assert.ok(share.content.includes('[分享帖子:'), '分享动作格式与 ai-service parser 逐字一致');
});

// ============================================================
// 关机彩蛋台词：记忆插槽让每次不一样
// ============================================================

test('shutdown: 无记忆走默认句，有记忆时她记住的话会出现', () => {
    const bare = buildShutdownScript(1, []);
    assert.ok(bare.length >= 6, '完整的一段话');
    assert.ok(bare.some((l) => l.input), '有一处输入');
    assert.ok(bare.some((l) => l.text && l.text.includes('朋友')), '小听只是朋友不是全部');
    assert.ok(!bare.some((l) => l.text && l.text.includes('undefined')));

    const withMemory = buildShutdownScript(2, ['想去海边看一次日出']);
    assert.ok(
        withMemory.some((l) => l.text && l.text.includes('想去海边看一次日出')),
        '记忆碎片进台词',
    );
    // 台词随关机次数变化（句库挑选按 count 轮转）
    const a = buildShutdownScript(1, []).map((l) => l.text || '').join('|');
    const b = buildShutdownScript(2, []).map((l) => l.text || '').join('|');
    assert.notEqual(a, b, '两次关机说的不完全一样');
});

// ============================================================
// 配色 / 工具
// ============================================================

test('theme: 批量粘贴只认白名单变量', () => {
    const { colors, valid, ignored } = parseColorBatch(
        '--ox-ink: #222222;\n--yt-primary: #FF0000;\n--ox-bg: #FAFAFA',
    );
    assert.equal(valid, 2);
    assert.equal(ignored, 1, '别的 App 的变量被忽略而不是报错');
    assert.equal(colors['--ox-ink'], '#222222');
    assert.ok(ALL_TOKENS.includes('--ox-ink'));
});

test('utils: 帖子互动数确定性 + 粉丝规模方向正确', () => {
    const a1 = computePostStats(1000, 'post-a');
    const a2 = computePostStats(1000, 'post-a');
    assert.deepEqual(a1, a2, '同 seed 必须得到同一组数');
    const zero = computePostStats(0, 'post-z');
    assert.ok(zero.reach >= 0 && zero.likes >= 0 && zero.comments >= 0, '零粉不出负数');
    const small = computePostStats(100, 'post-cmp');
    const big = computePostStats(1000000, 'post-cmp');
    assert.ok(big.reach > small.reach * 50, '关注量要真实反映在触达上');
});

test('utils: 热度波动确定性（同小时窗不跳变），几何体颜色跟随小听深浅', () => {
    assert.equal(hotHeat(50000, 'h1', 100), hotHeat(50000, 'h1', 100), '同窗口热度不变');
    assert.notEqual(hotHeat(50000, 'h1', 100), hotHeat(50000, 'h1', 101), '换窗口会呼吸');

    const light = geometryColor(90, 'cube::g1');
    const dark = geometryColor(30, 'cube::g1');
    assert.ok(light.includes('90%'), '小听浅几何体浅');
    assert.ok(dark.includes('30%'), '小听深几何体深');
});

test('social-kit: 99+ / 大数缩写 / 日期差', () => {
    assert.equal(fmtCap(99), '99');
    assert.equal(fmtCap(100), '99+');
    assert.equal(fmtCount(12000), '1.2万');
    assert.equal(daysBetween('2026-08-13', '2026-08-15'), 2);
    assert.equal(daysBetween('2026-08-15', '2026-08-15'), 0);
    assert.match(dayKey(Date.UTC(2026, 7, 15, 12)), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(hashString('same'), hashString('same'));
});
