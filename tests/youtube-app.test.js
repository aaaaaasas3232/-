/**
 * 萤火（视频 App）· 纯函数测试
 *
 * 只测不碰 window 的部分：数据计算（粉丝 → 评论量 / 99+）、头像池分配、
 * 直播间纯逻辑（离线合成 / 弹幕调度取数）、提示词组装（预览 == 发送）、
 * 配色批量解析、工具函数。
 * 跑法：npm test（package.json 已挂 @ 别名 loader）。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    computeUploadStats, coverHue, fmtCap, fmtCount, isLiveNow,
    liveViewers, publishedLabel, remainingComments,
} from '../js/apps/youtube-app/services/stats.js';
import { fallbackSlot, pickAvatarCode } from '../js/apps/youtube-app/services/avatar-logic.js';
import {
    danmakuVisual, dueItems, makeOfflineRoom, poolDurationMs,
} from '../js/apps/youtube-app/services/live-room.js';
import {
    buildAiVideoPrompt, buildChatReplyPrompt, buildDmPrompt, buildFeedPrompt,
    buildLivePrompt, buildMoreCommentsPrompt, buildPersonPrompt,
    buildUserCommentsPrompt, buildVideoDetailPrompt,
} from '../js/apps/youtube-app/services/prompt-builder.js';
import { YOUTUBE_PROMPTS } from '../js/apps/youtube-app/services/app-prompts.js';
import { parseColorBatch, ALL_TOKENS } from '../js/apps/youtube-app/theme.js';
import {
    extractJson, fmtDuration, hashString, safeImageUrl, seededRandom, uid,
} from '../js/apps/youtube-app/utils.js';

// ============================================================
// 数据计算：粉丝 → 播放 / 评论；99+；直播判定可复现
// ============================================================

test('stats: 同一条视频算出的数据永远一样，粉丝多互动多', () => {
    const a1 = computeUploadStats(1000, 'vid-a');
    const a2 = computeUploadStats(1000, 'vid-a');
    assert.deepEqual(a1, a2, '同 seed 必须得到同一组数');

    const zero = computeUploadStats(0, 'vid-z');
    assert.ok(zero.views >= 0 && zero.comments >= 0, '零粉也不出负数');

    // 大频道播放显著高于小频道（同一个视频 id 排除随机差）
    const small = computeUploadStats(100, 'vid-cmp');
    const big = computeUploadStats(1000000, 'vid-cmp');
    assert.ok(big.views > small.views * 50, '粉丝量要真实反映在播放上');
    assert.ok(big.comments > small.comments, '评论也要跟着涨');
});

test('stats: 99+ 截断只在展示层，真实数值保留', () => {
    assert.equal(fmtCap(3), '3');
    assert.equal(fmtCap(99), '99');
    assert.equal(fmtCap(100), '99+');
    assert.equal(fmtCap(12345), '99+');
    assert.equal(remainingComments(12, 5), 7);
    assert.equal(remainingComments(5, 12), 0, '生成数超过总数时不出负数');
});

test('stats: 大数缩写与发布标签稳定', () => {
    assert.equal(fmtCount(999), '999');
    assert.equal(fmtCount(12000), '1.2万');
    assert.equal(fmtCount(230000000), '2.3亿');
    assert.equal(publishedLabel('v1'), publishedLabel('v1'), '同视频标签不跳变');
    assert.ok(publishedLabel('v1').length > 0);
    assert.equal(coverHue('v1', 8), coverHue('v1', 8), '封面色槽稳定');
    assert.ok(coverHue('v2', 8) >= 0 && coverHue('v2', 8) < 8);
});

test('stats: 直播判定同窗口可复现，不同窗口会变化', () => {
    assert.equal(isLiveNow('cr1', 100, 0.4), isLiveNow('cr1', 100, 0.4), '同主播同窗口结果一致');
    // 概率 1 必开播、0 必不开播
    assert.equal(isLiveNow('cr1', 100, 1), true);
    assert.equal(isLiveNow('cr1', 100, 0), false);
    // 大样本频率大致贴近设定概率
    let hits = 0;
    for (let w = 0; w < 800; w += 1) {
        if (isLiveNow('cr-freq', w, 0.38)) hits += 1;
    }
    const rate = hits / 800;
    assert.ok(rate > 0.28 && rate < 0.48, `开播频率 ${rate} 应接近 0.38`);
    assert.ok(liveViewers(10000, 'cr1', 100) >= 3);
});

// ============================================================
// 头像池：确定性分配、避让已用、salt 换脸
// ============================================================

test('avatar-pool: 同 externalId 永远同一张，优先挑没人用的', () => {
    const images = [{ code: 'A' }, { code: 'B' }, { code: 'C' }];
    const first = pickAvatarCode('user-1', images, {});
    assert.equal(pickAvatarCode('user-1', images, {}), first, '分配是确定性的');

    // 已用的被避让：把 first 标记为已用后，user-2 不该再拿到它
    const map = { 'user-1': { code: first } };
    const second = pickAvatarCode('user-2', images, map);
    assert.notEqual(second, first, '还有空余时不共用');

    // 全用光时回落到哈希位（不报错、不返回空）
    const full = { a: { code: 'A' }, b: { code: 'B' }, c: { code: 'C' } };
    assert.ok(['A', 'B', 'C'].includes(pickAvatarCode('user-3', images, full)));

    // 换 salt = 全员换脸的基础：同 id 不同 salt 起点不同（多数情况下）
    const s1 = pickAvatarCode('user-x', [...Array(20)].map((_, i) => ({ code: `i${i}` })), {}, 'salt1');
    const s2 = pickAvatarCode('user-x', [...Array(20)].map((_, i) => ({ code: `i${i}` })), {}, 'salt2');
    assert.notEqual(s1, s2, '不同 salt 应换到不同图（20 张图撞车概率可忽略）');

    assert.equal(pickAvatarCode('user-1', [], {}), '', '图组为空返回空串');
    assert.equal(fallbackSlot('user-1'), fallbackSlot('user-1'), '占位色槽稳定');
});

// ============================================================
// 直播间纯逻辑
// ============================================================

test('live-room: 离线房间确定性合成，不调 AI 也有内容', () => {
    const creator = { creatorId: 'cr1', name: '阿灯', works: [{ title: '夜航记录' }] };
    const room1 = makeOfflineRoom(creator);
    const room2 = makeOfflineRoom(creator);
    assert.deepEqual(room1, room2, '同主播的离线房间不跳变');
    assert.ok(room1.notice.includes('阿灯'));
    assert.ok(room1.messages.length >= 3, '至少几条留言撑起房间');
    assert.ok(room1.messages[0].text.includes('夜航记录'), '回放提示用真实作品名');
});

test('live-room: dueItems 按 [from, to) 取数，atSec 0 第一拍必须出现', () => {
    const pool = [
        { atSec: 0, text: 'a' }, { atSec: 1, text: 'b' },
        { atSec: 2, text: 'c' }, { atSec: 10, text: 'd' },
    ];
    // ★ 回归：第一拍（from=0）必须能捞到 atSec 0，否则池子开头整批不飘
    assert.deepEqual(dueItems(pool, 0, 250).map((x) => x.text), ['a']);
    assert.deepEqual(dueItems(pool, 250, 2000).map((x) => x.text), ['b']);
    assert.deepEqual(dueItems(pool, 2000, 9000).map((x) => x.text), ['c']);
    assert.deepEqual(dueItems(pool, 9000, 10001).map((x) => x.text), ['d']);
    // 边界不重不漏：正好压在 to 上的条目归下一拍
    assert.deepEqual(dueItems(pool, 0, 1000).map((x) => x.text), ['a']);
    assert.deepEqual(dueItems(pool, 1000, 2000).map((x) => x.text), ['b']);

    const live = { hostLines: [{ atSec: 5 }], danmaku: [{ atSec: 170 }] };
    assert.equal(poolDurationMs(live), 174000, '总时长 = 最后一条 + 4s 收尾');

    const v1 = danmakuVisual({ text: '哈哈哈' }, 3);
    const v2 = danmakuVisual({ text: '哈哈哈' }, 3);
    assert.deepEqual(v1, v2, '同一条弹幕的轨道 / 速度不跳变');
    assert.ok(v1.top >= 6 && v1.top <= 80);
});

// ============================================================
// 提示词：预览与发送同源、关键段必在、影响 provider 能进场
// ============================================================

const IDENTITY = { userName: '阿听', worldName: '雾杉泽' };

function baseCtx() {
    return {
        identity: IDENTITY,
        summary: '一个建在巨杉之上的世界。',
        clips: [{ id: 'c1', title: '潮汐历', content: '每月两次大潮。' }],
        prompts: [],
        taste: '想看手艺人',
        influenceParts: [],
    };
}

test('feed prompt: text 与 parts 同源，世界观 / 口味 / 排除名单必在', () => {
    const { text, parts, stats } = buildFeedPrompt({
        ...baseCtx(),
        knownCreators: [{ name: '雾中灯塔' }],
        exclude: ['旧标题一'],
        size: 8,
    });
    assert.ok(text.includes('雾杉泽'), '世界观名必须进文本');
    assert.ok(text.includes('潮汐历'), '选中的夹子要进文本');
    assert.ok(text.includes('想看手艺人'), '口味要进文本');
    assert.ok(text.includes('雾中灯塔'), '已认识的频道主要喂给 AI（复用身份）');
    assert.ok(text.includes('旧标题一'), '排除名单要进文本');
    assert.ok(text.includes('coverText'), '输出格式必须要求封面大字');

    for (const p of parts.filter((x) => x.included)) {
        assert.ok(text.includes(p.content.slice(0, 20)), `段「${p.title}」应在发送文本里`);
    }
    assert.ok(stats.tokens > 0);
    assert.equal(parts.find((p) => p.id === 'world')?.locked, true);
    assert.equal(parts.find((p) => p.id === 'role')?.locked, true);
});

test('detail prompt: 视频信息与首批评论条数要求必在', () => {
    const { text } = buildVideoDetailPrompt({
        ...baseCtx(),
        video: { title: '杉顶采露记', coverText: '采露', creatorName: '雾中灯塔', kind: '日常', blurb: '凌晨四点的杉顶', views: 3200 },
        creator: { bio: '住在灯塔里的记录者' },
    });
    assert.ok(text.includes('杉顶采露记'));
    assert.ok(text.includes('住在灯塔里的记录者'), '作者简介要带上');
    assert.ok(text.includes('正好 5 条'), '首批评论固定 5 条');
    assert.ok(text.includes('commentCount'), '要求返回评论总数');
});

test('more comments prompt: 已有评论进排除区，楼层递减要求在', () => {
    const { text } = buildMoreCommentsPrompt({
        ...baseCtx(),
        video: { title: '杉顶采露记', creatorName: '雾中灯塔', blurb: '' },
        existing: [{ authorName: '早起的鸟', text: '前排！' }],
        count: 5,
    });
    assert.ok(text.includes('早起的鸟'), '已有评论人要注入避免重复');
    assert.ok(text.includes('再生成 5 条'));
});

test('person prompt: 频道主和观众的任务描述不同', () => {
    const creatorPrompt = buildPersonPrompt({
        ...baseCtx(),
        person: { name: '雾中灯塔', kind: 'creator' },
        knownWorks: ['杉顶采露记'],
    }).text;
    const viewerPrompt = buildPersonPrompt({
        ...baseCtx(),
        person: { name: '早起的鸟', kind: 'viewer' },
        knownWorks: [],
    }).text;
    assert.ok(creatorPrompt.includes('3~5 条代表作'));
    assert.ok(creatorPrompt.includes('杉顶采露记'), '已知作品必须保留');
    assert.ok(viewerPrompt.includes('普通观众'));
    assert.ok(viewerPrompt.includes('0~2 条'));
});

test('live prompt: 弹幕池一次拿完，条数与时间轴写死在要求里', () => {
    const { text } = buildLivePrompt({
        ...baseCtx(),
        creator: { name: '雾中灯塔', bio: '', personality: '慢声细语', works: [{ title: '夜航' }] },
        viewers: 88,
        danmakuCount: 28,
    });
    assert.ok(text.includes('正好 28 条'), '弹幕条数由 JS 决定');
    assert.ok(text.includes('atSec'), '必须带时间偏移，JS 才能分发');
    assert.ok(text.includes('慢声细语'), '主播说话方式要带上');
});

test('chat reply prompt: 相识缘由与聊天记录必在，禁替用户说话', () => {
    const { text } = buildChatReplyPrompt({
        ...baseCtx(),
        peer: { name: '早起的鸟', bio: '爱蹲首页', personality: '话痨' },
        metVia: '因为 TA 的视频《杉顶采露记》认识的',
        messages: [
            { role: 'user', text: '你也看灯塔的视频？' },
            { role: 'peer', text: '每期都看！' },
        ],
        userName: '阿听',
        userDesc: '',
    });
    assert.ok(text.includes('杉顶采露记'), '相识缘由要进 prompt');
    assert.ok(text.includes('每期都看'), '聊天记录要进 prompt');
    assert.ok(text.includes('不要替用户说话'));
});

test('ai video prompt: 意见重 roll 必须逐字进场，旧作品要避让', () => {
    const { text, parts } = buildAiVideoPrompt({
        ...baseCtx(),
        ai: { name: '阿澈', desc: '身份：船工' },
        previousTitles: ['修船日记'],
        opinion: '别再拍修船了，来点吃的',
    });
    assert.ok(text.includes('别再拍修船了，来点吃的'), '重 roll 意见必须进文本');
    assert.ok(text.includes('修船日记'), '已发过的要注入避免撞题');
    assert.equal(parts.find((p) => p.id === 'opinion')?.locked, true);
});

test('user comments prompt: 频道体量与已生成数据进场', () => {
    const { text } = buildUserCommentsPrompt({
        ...baseCtx(),
        upload: { title: '我的第一条视频', intro: '随便拍拍' },
        channel: { nickname: '阿听', followers: 40 },
        stats: { views: 18, likes: 2, comments: 3 },
        existing: [],
        count: 3,
    });
    assert.ok(text.includes('粉丝 40'));
    assert.ok(text.includes('评论总数 3'), 'JS 算好的总数要告诉 AI');
    assert.ok(text.includes('3 条评论'));
});

test('dm prompt: provider 内容（跨 App 经历）要能进场', () => {
    const { text, parts } = buildDmPrompt({
        ...baseCtx(),
        influenceParts: [{
            id: 'social-influence:actor::recent',
            title: '近期演艺经历',
            content: '刚拿到人生第一个配角。',
            source: 'actor-career',
            group: '跨 App 经历',
            active: true,
        }],
        channel: { nickname: '阿听', followers: 1200, bio: '' },
        uploadsBrief: ['《我的第一条视频》'],
        count: 4,
    });
    assert.ok(text.includes('刚拿到人生第一个配角'), 'provider 内容必须真的进文本');
    assert.ok(text.includes('4 封私信'));
    assert.ok(text.includes('《我的第一条视频》'));
    assert.ok(parts.some((p) => p.id.startsWith('social-influence:')), 'provider 段要出现在预览里');
});

// ============================================================
// murmur 注册卡：动作格式和 chat parser 逐字一致
// ============================================================

test('murmur 动作卡：格式与 chat-app 解析器一致（[分享视频:标题:介绍]）', () => {
    const action = YOUTUBE_PROMPTS.find((p) => p.promptId === 'youtube-share-action');
    assert.ok(action, '动作卡必须存在');
    assert.ok(action.content.includes('[分享视频:视频标题:一句话介绍]'), '注册的格式说明必须和 parser 的 [分享视频:] 对齐');
    const shared = YOUTUBE_PROMPTS.find((p) => p.promptId === 'youtube-shared');
    assert.ok(shared.content.includes('萤火'), '行为边界卡要点名 App');
});

// ============================================================
// 主题与工具
// ============================================================

test('parseColorBatch: 认识的收下，不认识的跳过而不是整段失败', () => {
    const { colors, valid, ignored } = parseColorBatch(
        '--yt-primary: #123456;\n--tv-primary: #654321;\n/* 注释 */\n--yt-bg: rgba(1,2,3,0.5)',
    );
    assert.equal(valid, 2);
    assert.equal(ignored, 1, '别的 App 的变量跳过');
    assert.equal(colors['--yt-primary'], '#123456');
    assert.ok(ALL_TOKENS.includes('--yt-cover-0'), '封面色板是可调 token');
});

test('utils: extractJson / fmtDuration / seeded 随机可复现', () => {
    assert.deepEqual(extractJson('前置解释 {"a":1} 后置'), { a: 1 });
    assert.equal(extractJson('不是 json'), null);
    assert.equal(fmtDuration(75), '1:15');
    assert.equal(fmtDuration(3675), '1:01:15');
    assert.equal(fmtDuration(0, 'seed'), fmtDuration(0, 'seed'), '假时长也要稳定');
    assert.equal(hashString('abc'), hashString('abc'));
    const r1 = seededRandom(42);
    const r2 = seededRandom(42);
    assert.equal(r1(), r2(), '同 seed 同序列');
    assert.equal(safeImageUrl('javascript:alert(1)'), '');
    assert.ok(safeImageUrl('data:image/png;base64,xxxx').length > 0);
    assert.notEqual(uid('a'), uid('a'));
});
