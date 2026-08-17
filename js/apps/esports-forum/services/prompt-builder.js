/**
 * 声浪 · Prompt 构建（composeContext 唯一出口）
 *
 * 发送 text 与 UI 展示 parts 来自同一次 compose —— 预览 == 实际发送。
 * 每种生成场景一个 build 函数，公共段（世界观 / 选手身份 / 赛季局势 / 时间）复用。
 */

import { createContextComposer } from '@/src/core/context-composer.js';
import { startTierSpec } from '../constants.js';
import { asArray, attrsBrief, skillScore, truncate } from '../utils.js';
import {
    describeUser, formatWorldClock, formatWorldDate, readWorldSummary,
} from './world-context.js';
import { phaseLabel } from './season-engine.js';
import { currentSlotLabel, gameModelById, positionLabel, virtualMs } from '../../esports-shared/esports-kit.js';

export const composer = createContextComposer({ namespace: 'esports-forum', tokenBudget: 12000 });

// ============================================================
// 公共段
// ============================================================

function worldPart(identity, clips = []) {
    const summary = readWorldSummary(identity.world);
    const clipText = asArray(clips).map((c) => `【${c.title}】${c.content}`).join('\n');
    return {
        id: 'world', title: '世界观', tag: '世界观', group: '背景',
        content: [summary, clipText].filter(Boolean).join('\n\n'),
        source: 'nook',
    };
}

function playerPart(identity, profile, save) {
    const model = gameModelById(profile?.modelId);
    const spec = startTierSpec(save?.startTier ?? profile?.startTier);
    const lines = [
        describeUser(identity.user),
        `选手 ID：${profile?.gameId || identity.userName}（${spec.label}出身）`,
        `位置：${positionLabel(model, profile?.positionId)} · 项目：${profile?.gameName || model.defaultGameName}（${model.label}）`,
        profile?.motto ? `赛场宣言：${profile.motto}` : '',
        profile?.honorsInit ? `入行前荣誉：${profile.honorsInit}` : '',
        save ? `七维数值：${attrsBrief(save.attrs)}（综合战力 ${skillScore(save.attrs)}）` : '',
        save ? `人气：${Math.round(save.attrs?.fame ?? 0)}/100 · 精力：${save.energy ?? 100}/100` : '',
    ];
    return {
        id: 'player', title: '用户（职业选手本人）', tag: '选手本人', group: '背景',
        content: lines.filter(Boolean).join('\n'),
        source: 'nook',
    };
}

function seasonPart({ season, teamNameOf, userTeamId, standingsBrief }) {
    if (!season) {
        return {
            id: 'season', title: '赛季局势', tag: '赛季局势', group: '生涯',
            content: '当前处于休赛期，联赛没有进行中的比赛。', source: 'esports',
        };
    }
    const lines = [
        `当前赛事：${season.name}（${phaseLabel(season)}）`,
        `用户战队：${teamNameOf(userTeamId)}`,
    ];
    if (standingsBrief) lines.push(`积分形势：${standingsBrief}`);
    if (season.championId) lines.push(`冠军已产生：${teamNameOf(season.championId)}`);
    return {
        id: 'season', title: '赛季局势', tag: '赛季局势', group: '生涯',
        content: lines.join('\n'),
        source: 'esports',
    };
}

function timePart(identity, save) {
    const ms = virtualMs(save.clock);
    return {
        id: 'time', title: '世界时间', tag: '世界时间', group: '生涯',
        content: [
            `现在是 ${formatWorldDate(ms, identity.worldId)} ${formatWorldClock(ms, identity.worldId)}（${currentSlotLabel(save.clock)}）`,
            `这是这一档生涯的第 ${save.clock?.day || 1} 天。`,
            '叙事里提到时间必须与上面一致，不要用现实世界的日期。',
        ].join('\n'),
        source: 'esports',
    };
}

function recentPart(timeline = []) {
    const rows = asArray(timeline).slice(0, 8)
        .map((t) => `第${t.day}天 ${t.title}${t.detail ? `：${truncate(t.detail, 40)}` : ''}`);
    return {
        id: 'recent', title: '近期大事', tag: '近期大事', group: '生涯',
        content: rows.join('\n'),
        source: 'esports',
    };
}

function opinionPart(opinion) {
    return {
        id: 'opinion', title: '用户意见', tag: '用户意见', group: '输入',
        content: String(opinion || '').trim(),
        source: 'user',
    };
}

function fmtPart(lines) {
    return {
        id: 'format', title: '输出格式', tag: '输出格式', group: '约束',
        content: lines.join('\n'),
        locked: true,
        source: 'esports',
    };
}

function compose(scope, parts, opts = {}) {
    return composer.composeAndSave(scope, parts.filter((p) => p && String(p.content || '').trim()), opts);
}

// ============================================================
// 场景：板块 AI 帖批量生成（用户点「让论坛热闹一下」）
// ============================================================

export function buildBoardBatchPrompt({ identity, profile, save, season, teamNameOf, board, heat, clips, opinion, standingsBrief }) {
    const parts = [
        worldPart(identity, clips),
        playerPart(identity, profile, save),
        seasonPart({ season, teamNameOf, userTeamId: profile.userTeamId, standingsBrief }),
        timePart(identity, save),
        {
            id: 'board', title: '目标板块', tag: '目标板块', group: '输入',
            content: [
                `板块：${board.name}（${board.desc}）`,
                `板块热度：${heat}/100 —— 热度越高，帖子越多、立场越极端`,
                '论坛里粉丝、黑子、路人、分析帖、乐子人五种立场并存，不能全员吹用户。',
                '发帖人是这个世界里的路人网友，绝不知道屏幕外有「玩家」存在。',
            ].join('\n'),
            source: 'esports',
        },
        opinionPart(opinion),
        fmtPart([
            '为这个板块生成 5 条论坛帖。严格输出 JSON：',
            '{"posts":[{"handle":"发帖人网名","stance":"fan|anti|passerby|analyst|memer",',
            ' "title":"帖子标题","body":"帖子正文（80~200字，口语化，像真实论坛）"}]}',
            '五条立场要有差异；至少一条与用户或其战队无关（联赛别的话题）。',
        ]),
    ];
    return compose(`board::${board.id}`, parts);
}

// ============================================================
// 场景：用户发帖后的评论生成（匿名身份，评论者不知道发帖的是用户本人）
// ============================================================

export function buildUserPostCommentsPrompt({ identity, profile, save, season, teamNameOf, post, identityName, clips, standingsBrief }) {
    const parts = [
        worldPart(identity, clips),
        playerPart(identity, profile, save),
        seasonPart({ season, teamNameOf, userTeamId: profile.userTeamId, standingsBrief }),
        {
            id: 'post', title: '被评论的帖子', tag: '被评论的帖子', group: '输入',
            content: [
                `发帖人（论坛显示名）：${identityName}`,
                `标题：${post.title}`,
                `正文：${truncate(post.body, 600)}`,
                '',
                '★ 重要：这个帖子是用户用匿名马甲发的。评论的网友只看得到马甲名，',
                '完全不知道、也不可能猜到发帖人是职业选手本人。评论必须把 TA 当普通网友对待。',
            ].join('\n'),
            source: 'esports',
        },
        fmtPart([
            '为这个帖子生成 6 条楼层评论。严格输出 JSON：',
            '{"comments":[{"handle":"评论人网名","stance":"fan|anti|passerby|analyst|memer","text":"评论内容（15~60字）"}]}',
            '立场要分化：有人赞同、有人抬杠、有人跑题。禁止出现「楼主是选手」之类的破译。',
        ]),
    ];
    return compose(`post-comments::${post.id}`, parts);
}

// ============================================================
// 场景：战绩围观楼锐评（论坛看 rank 记录）
// ============================================================

export function buildRankRoastPrompt({ identity, profile, save, session, clips }) {
    const model = gameModelById(profile?.modelId);
    const parts = [
        worldPart(identity, clips),
        playerPart(identity, profile, save),
        {
            id: 'session', title: '被围观的战绩', tag: '被围观的战绩', group: '输入',
            content: [
                `选手 ${profile.gameId} 今天的${session.modeLabel}战绩：${session.wins}胜${session.losses}负`,
                `巅峰分：${session.ratingAfter}（${session.ratingDelta >= 0 ? '+' : ''}${session.ratingDelta}）`,
                asArray(session.matches).slice(0, 6).map((m, i) => (
                    `第${i + 1}局 ${m.win ? '胜' : '负'} · ${m.hero}（${m.kdaText}）`
                )).join('\n'),
                `注：${model.heroNoun}名与数据都是真实战绩，评论要贴着数据说话。`,
            ].join('\n'),
            source: 'esports',
        },
        fmtPart([
            '生成 6 条论坛网友对这份战绩的锐评。严格输出 JSON：',
            '{"comments":[{"handle":"网名","stance":"fan|anti|passerby|analyst|memer","text":"评论（15~60字）"}]}',
            '赢多了有人吹有人酸；输多了有人心疼有人嘲。禁止全员一个口径。',
        ]),
    ];
    return compose(`rank-roast::${session.id}`, parts);
}

// ============================================================
// 场景：赛报（用户出战的系列赛，结果已由 JS 掷定，AI 只演绎不改结果）
// ============================================================

export function buildMatchReportPrompt({ identity, profile, save, season, teamNameOf, series, clips, opinion }) {
    const oppId = series.homeId === profile.userTeamId ? series.awayId : series.homeId;
    const myScore = series.homeId === profile.userTeamId ? series.result.homeScore : series.result.awayScore;
    const oppScore = series.homeId === profile.userTeamId ? series.result.awayScore : series.result.homeScore;
    const won = series.result.winnerId === profile.userTeamId;
    const parts = [
        worldPart(identity, clips),
        playerPart(identity, profile, save),
        seasonPart({ season, teamNameOf, userTeamId: profile.userTeamId }),
        timePart(identity, save),
        {
            id: 'series', title: '这场比赛（结果已定，不许改）', tag: '这场比赛', group: '输入',
            content: [
                `${series.label || `BO${series.bo}`}：${teamNameOf(profile.userTeamId)} ${myScore}:${oppScore} ${teamNameOf(oppId)} —— ${won ? '胜' : '负'}`,
                `逐局：${asArray(series.result.games).map((g) => `第${g.no}局${g.winner === profile.userTeamId ? '胜' : '负'}${g.peak ? '（巅峰对决·盲选）' : ''}`).join('，')}`,
                series.result.mvpName ? `系列赛 MVP：${series.result.mvpName}` : '',
                '比分、每局胜负、MVP 都是既定事实，叙事只能演绎过程，禁止翻案。',
            ].filter(Boolean).join('\n'),
            source: 'esports',
        },
        opinionPart(opinion),
        fmtPart([
            '写一篇这场比赛的赛报（250~400字），像专业电竞媒体的赛后稿：',
            '有开局节奏、有转折点、有关键选手表现，收尾一句展望。',
            '直接输出正文，不要 JSON，不要标题符号堆砌。',
        ]),
    ];
    return compose(`report::${series.id}`, parts);
}

// ============================================================
// 场景：快进叙事
// ============================================================

export function buildFastForwardPrompt({ identity, profile, save, season, teamNameOf, timeline, days, rolledEvents, autoResults, opinion }) {
    const parts = [
        worldPart(identity),
        playerPart(identity, profile, save),
        seasonPart({ season, teamNameOf, userTeamId: profile.userTeamId }),
        timePart(identity, save),
        recentPart(timeline),
        {
            id: 'skip', title: '这段时间发生的既定事实', tag: '既定事实', group: '输入',
            content: [
                `即将快进 ${days} 天。`,
                rolledEvents.length
                    ? `突发事件（已掷定）：${rolledEvents.map((e) => `第${e.day}天「${e.title}」`).join('；')}`
                    : '这段时间没有突发事件。',
                autoResults?.length
                    ? `比赛结果（已掷定）：${autoResults.slice(0, 6).map((r) => r.text).join('；')}`
                    : '',
                '以上是系统已经掷定的事实，叙事必须与之一致。',
            ].filter(Boolean).join('\n'),
            source: 'esports',
        },
        opinionPart(opinion),
        fmtPart([
            '概括这段时间的生涯经历。严格输出 JSON：',
            '{"narrative":"150~250字的经过","attrDeltas":{"mechanics":0,"awareness":0,"comms":0,"pool":0,"mentality":0,"stamina":0,"synergy":0,"fame":0},',
            ' "timelineEvents":[{"dayOffset":1,"title":"事件名","detail":"一句话"}]}',
            'attrDeltas 每项 -6~6 的整数；timelineEvents 最多 3 条。',
        ]),
    ];
    return compose(`skip::${save.id}`, parts);
}

// ============================================================
// 场景：生涯结局
// ============================================================

export function buildEndingPrompt({ identity, profile, save, timeline, honors, opinion }) {
    const parts = [
        worldPart(identity),
        playerPart(identity, profile, save),
        {
            id: 'career-log', title: '这一档生涯全记录', tag: '生涯全记录', group: '输入',
            content: [
                asArray(honors).length ? `荣誉：${honors.map((h) => h.title).join('、')}` : '荣誉：无',
                asArray(timeline).slice(0, 24).reverse()
                    .map((t) => `第${t.day}天 ${t.title}`).join('\n'),
            ].join('\n'),
            source: 'esports',
        },
        opinionPart(opinion),
        fmtPart([
            '为这段电竞生涯写一篇结局（300~500字）。',
            '基于真实发生过的事，不虚构冠军；语气克制而有余味。直接输出正文。',
        ]),
    ];
    return compose(`ending::${save.id}`, parts);
}
