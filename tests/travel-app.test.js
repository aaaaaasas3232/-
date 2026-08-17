/**
 * 候鸟（旅游 App）· 纯函数测试
 *
 * 只测不碰 window 的部分：行程推进、提示词组装（预览 == 发送）、
 * 配色批量解析、工具函数、murmur 概要卡 spec。
 * 跑法：npm test（package.json 已挂 @ 别名 loader）。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    isFinalSlot, isTripDone, normalizeDays, slotToStage,
    stageLabel, totalSlots, tripDurationLabel, tripProgress,
} from '../js/apps/travel-app/services/trip-flow.js';
import {
    buildAiReplyPrompt, buildFeedPrompt, buildNarrationPrompt,
    buildSummaryPrompt, buildTheaterPrompt,
} from '../js/apps/travel-app/services/prompt-builder.js';
import { buildTripSummarySpec, TRAVEL_PROMPTS } from '../js/apps/travel-app/services/app-prompts.js';
import { parseColorBatch, ALL_TOKENS } from '../js/apps/travel-app/theme.js';
import { extractJson, money, safeImageUrl, uid } from '../js/apps/travel-app/utils.js';

// ============================================================
// 行程推进
// ============================================================

test('trip-flow: 天数钳制与 slot 换算', () => {
    assert.equal(normalizeDays(0), 1);
    assert.equal(normalizeDays(99), 7);
    assert.equal(normalizeDays(3), 3);

    assert.equal(totalSlots(3), 9);
    assert.deepEqual(slotToStage(0, 3), { day: 1, phase: 0 });
    assert.deepEqual(slotToStage(4, 3), { day: 2, phase: 1 });
    assert.deepEqual(slotToStage(8, 3), { day: 3, phase: 2 });
    assert.equal(stageLabel(4, 3), '第 2 天 · 午');
    assert.equal(tripDurationLabel(3), '3 天 2 晚');
});

test('trip-flow: 结束判定与进度', () => {
    assert.equal(isFinalSlot(8, 3), true);
    assert.equal(isFinalSlot(7, 3), false);
    assert.equal(isTripDone(9, 3), true);
    assert.equal(isTripDone(8, 3), false);
    assert.equal(tripProgress(0, 3), 0);
    assert.equal(tripProgress(9, 3), 1);
    // 一天三段：1 天的旅行三段就结束
    assert.equal(isTripDone(3, 1), true);
});

// ============================================================
// 提示词：预览与发送同源、关键段必在
// ============================================================

const IDENTITY = { userName: '阿听', worldName: '雾杉泽', currency: '星币' };

function feedCtx() {
    return {
        identity: IDENTITY,
        summary: '一个建在巨杉之上的世界。',
        clips: [{ id: 'c1', title: '潮汐历', content: '每月两次大潮。' }],
        prompts: [],
        taste: '想看海',
        existingGeo: [
            { id: 'p1', name: '杉顶港', summary: '', locations: [{ id: 'l1', name: '灯塔市集' }] },
        ],
        exclude: ['杉顶港·灯塔市集'],
        size: 6,
    };
}

test('feed prompt: text 与 parts 来自同一次 compose，货币与已有地点必在', () => {
    const { text, parts, stats } = buildFeedPrompt(feedCtx());
    assert.ok(text.includes('星币'), '资金映射必须进文本');
    assert.ok(text.includes('杉顶港'), '世界已有地点要喂给 AI');
    assert.ok(text.includes('placeName'), '输出格式要求两层结构');
    assert.ok(text.includes('潮汐历'), '选中的夹子要进文本');
    assert.ok(text.includes('想看海'), '旅行口味要进文本');

    // 预览与发送同源：每个 included 段的内容都在最终文本里
    for (const p of parts.filter((x) => x.included)) {
        assert.ok(text.includes(p.content.slice(0, 20)), `段「${p.title}」应在发送文本里`);
    }
    assert.ok(stats.tokens > 0);
    // 世界观与货币两段锁死
    assert.equal(parts.find((p) => p.id === 'world')?.locked, true);
    assert.equal(parts.find((p) => p.id === 'currency')?.locked, true);
});

function tripFixture() {
    return {
        id: 'tp_test',
        days: 2,
        destination: {
            placeName: '雾杉泽', locationName: '沉舟湾', kind: '海岸',
            blurb: '退潮时能走到沉船里。',
            detail: { environment: '要坐三小时的藤蔓缆车。', risks: '涨潮很快。', ticketPrice: 120 },
        },
        companions: [{ id: 'ai1', name: '阿澈' }],
        items: [{ id: 'it1', label: '防潮灯', qty: 1 }],
        extra: '慢一点走',
    };
}

test('theater prompt: 同行者 / 物品 / 意见都进文本', () => {
    const base = {
        identity: IDENTITY, summary: '世界简介', clips: [], prompts: [], taste: '',
        trip: tripFixture(),
        userDesc: '性格：慢热',
        companionDescs: [{ id: 'ai1', desc: '性格：毒舌' }],
    };

    const first = buildTheaterPrompt(base);
    assert.ok(first.text.includes('阿澈'), '同行 AI 要在 cast 里');
    assert.ok(first.text.includes('防潮灯'), '四叶草物品要进提示词');
    assert.ok(first.text.includes('慢一点走'), '附加要求要进提示词');
    assert.ok(!first.text.includes('用户对上一版的意见'), '首次生成没有意见段');

    const reroll = buildTheaterPrompt({ ...base, opinion: '开头别写下雨' });
    assert.ok(reroll.text.includes('开头别写下雨'), '重 roll 意见必须进发送文本');
    assert.ok(reroll.text.includes('用户对上一版的意见'));
});

test('narration prompt: 阶段推进与最终段收尾', () => {
    const base = {
        identity: IDENTITY, summary: '世界简介', clips: [], prompts: [], taste: '',
        trip: tripFixture(),
        messages: [
            { role: 'narration', text: '缆车缓缓降下。' },
            { role: 'user', userName: '阿听', text: '先去看沉船！' },
        ],
    };

    const first = buildNarrationPrompt({ ...base, slotIndex: 0 });
    assert.ok(first.text.includes('第 1 天早'), '第一段从第 1 天早写起');
    assert.ok(first.text.includes('从抵达目的地写起'));
    assert.ok(first.text.includes('先去看沉船'), '近期消息要进上下文');

    const final = buildNarrationPrompt({ ...base, slotIndex: 5, isFinal: true });
    assert.ok(final.text.includes('最后一段'), '最终段要求收尾');
    assert.ok(final.text.includes('归途'));

    const opinion = buildNarrationPrompt({ ...base, slotIndex: 2, opinion: '别下雨了' });
    assert.ok(opinion.text.includes('别下雨了'), '旁白重 roll 意见进文本');
});

test('AI 回复 prompt: 指定说话人与被回应的那句', () => {
    const { text } = buildAiReplyPrompt({
        identity: IDENTITY, summary: '世界简介', clips: [], prompts: [], taste: '',
        trip: tripFixture(),
        targetAi: { id: 'ai1', name: '阿澈', desc: '性格：毒舌' },
        messages: [{ role: 'narration', text: '潮水开始上涨。' }],
        replyTo: { role: 'user', speaker: '阿听', text: '我们是不是该回去了' },
    });
    assert.ok(text.includes('阿澈'));
    assert.ok(text.includes('我们是不是该回去了'), '被长按的那句要单独给出');
    assert.ok(text.includes('不要替用户或其他人说话'));
});

test('summary prompt: 全过程进料，输出要求两三句', () => {
    const { text } = buildSummaryPrompt({
        trip: tripFixture(),
        messages: [
            { role: 'narration', text: '两人抵达沉舟湾。' },
            { role: 'ai', aiName: '阿澈', text: '你走慢点。' },
        ],
    });
    assert.ok(text.includes('沉舟湾'));
    assert.ok(text.includes('阿澈'));
    assert.ok(text.includes('两到三句'));
});

// ============================================================
// murmur 概要卡
// ============================================================

test('概要卡 spec：稳定 id、注入的是概要不是全程', () => {
    const trip = { ...tripFixture(), summary: '和阿澈去了沉舟湾，回程他在缆车上睡着了。' };
    const spec = buildTripSummarySpec(trip);
    assert.equal(spec.promptId, 'trip-tp_test');
    assert.ok(spec.content.includes('沉舟湾'));
    assert.ok(spec.content.includes('回程他在缆车上睡着了'));
    assert.ok(spec.label.startsWith('旅行·'));
    // 静态卡 id 固定
    assert.equal(TRAVEL_PROMPTS[0].promptId, 'travel-shared');
});

// ============================================================
// 主题批量解析
// ============================================================

test('parseColorBatch: 认识的收下，不认识的跳过而不是整段失败', () => {
    const { colors, valid, ignored } = parseColorBatch(
        '--tv-primary: #5E97C4;\n--gg-primary: #FF0000;\n/* 注释 */\n--tv-bg: rgba(1,2,3,0.5)',
    );
    assert.equal(valid, 2);
    assert.equal(ignored, 1);
    assert.equal(colors['--tv-primary'], '#5E97C4');
    assert.equal(colors['--tv-bg'], 'rgba(1,2,3,0.5)');
    assert.ok(ALL_TOKENS.includes('--tv-primary'));
});

// ============================================================
// 工具
// ============================================================

test('utils: extractJson 抠得出带围栏 / 带解释的 JSON', () => {
    assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
    assert.deepEqual(extractJson('好的，给你：{"a":{"b":2}} 以上'), { a: { b: 2 } });
    assert.equal(extractJson('完全不是 json'), null);
});

test('utils: safeImageUrl 只放行 http(s) 和 data:image', () => {
    assert.equal(safeImageUrl('https://x.y/a.jpg'), 'https://x.y/a.jpg');
    assert.ok(safeImageUrl('data:image/png;base64,AAAA'));
    assert.equal(safeImageUrl('javascript:alert(1)'), '');
    assert.equal(safeImageUrl('file:///etc/passwd'), '');
});

test('utils: money 非负两位小数，uid 不重复', () => {
    assert.equal(money(-5), 0);
    assert.equal(money('12.345'), 12.35);
    const a = uid('t');
    const b = uid('t');
    assert.notEqual(a, b);
});
