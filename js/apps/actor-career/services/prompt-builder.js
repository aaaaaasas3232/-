/**
 * 追光 · Prompt 构建（composeContext 唯一出口）
 *
 * 发送 text 与 UI 展示 parts 来自同一次 compose —— 预览 == 实际发送。
 * 每种生成场景一个 build 函数，公共段（世界观 / 人设 / 生涯 / 时间 / 地点）复用。
 */

import { createContextComposer } from '@/src/core/context-composer.js';
import { tierSpec, SETTLEMENT_DELTA_CAP, FAST_FORWARD_DELTA_CAP } from '../constants.js';
import { attrsBrief, craftScore, asArray, truncate } from '../utils.js';
import { npcPersonaText } from './npc-engine.js';
import {
    describeUser, formatWorldClock, formatWorldDate, readWorldSummary,
} from './world-context.js';
import { virtualMs, currentSlotLabel } from './clock.js';

export const composer = createContextComposer({ namespace: 'actor-career', tokenBudget: 12000 });

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

function userPart(identity, profile) {
    const lines = [describeUser(identity.user)];
    if (profile?.stageName) lines.push(`艺名：${profile.stageName}`);
    if (profile?.agencyStatus) lines.push(`经纪状态：${profile.agencyStatus}`);
    if (asArray(profile?.genres).length) lines.push(`擅长类型：${profile.genres.join('、')}`);
    if (profile?.style) lines.push(`表演风格：${profile.style}`);
    if (profile?.goal) lines.push(`职业目标：${profile.goal}`);
    return {
        id: 'user', title: '用户（演员本人）', tag: '演员本人', group: '背景',
        content: lines.filter(Boolean).join('\n'),
        source: 'nook',
    };
}

function careerPart(save) {
    const spec = tierSpec(save.tier);
    const honors = asArray(save.honors).slice(0, 8).map((h) => h.title).join('、') || '暂无';
    return {
        id: 'career', title: '当前生涯', tag: '当前生涯', group: '生涯',
        content: [
            `线级：${spec.label}（${spec.group} —— ${spec.groupDesc}）`,
            `九维数值：${attrsBrief(save.attrs)}（声台形表均值 ${craftScore(save.attrs)}）`,
            `精力：${save.energy ?? 100}/100`,
            `已完成作品：${save.finishedWorks || 0} 部`,
            `荣誉：${honors}`,
        ].join('\n'),
        source: 'actor',
    };
}

function timePart(identity, save) {
    const ms = virtualMs(save.clock);
    return {
        id: 'time', title: '世界时间', tag: '世界时间', group: '生涯',
        content: [
            `现在是 ${formatWorldDate(ms, identity.worldId)} ${formatWorldClock(ms, identity.worldId)}（${currentSlotLabel(save.clock)}）`,
            `这是这一档人生的第 ${save.clock?.day || 1} 天。`,
            '叙事里提到时间必须与上面一致，不要用现实世界的日期。',
        ].join('\n'),
        source: 'actor',
    };
}

function recentPart(timeline = []) {
    const rows = asArray(timeline).slice(0, 8)
        .map((t) => `第${t.day}天 ${t.title}${t.detail ? `：${truncate(t.detail, 40)}` : ''}`);
    return {
        id: 'recent', title: '近期大事', tag: '近期大事', group: '生涯',
        content: rows.join('\n'),
        source: 'actor',
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
        source: 'actor',
    };
}

function compose(scope, parts, opts = {}) {
    return composer.composeAndSave(scope, parts.filter((p) => p && String(p.content || '').trim()), opts);
}

// ============================================================
// 场景：剧本生成（章节制）
// ============================================================

export function buildScriptPrompt({ identity, profile, save, timeline, clips, source, opinion }) {
    const parts = [
        worldPart(identity, clips),
        userPart(identity, profile),
        careerPart(save),
        timePart(identity, save),
        recentPart(timeline),
    ];
    if (source) {
        parts.push({
            id: 'source', title: '改编原作（梦境编织）', tag: '改编原作', group: '输入',
            content: [
                `书名：《${source.title}》`,
                source.synopsis ? `梗概：${source.synopsis}` : '',
                source.excerpt ? `选段：\n${truncate(source.excerpt, 800)}` : '',
            ].filter(Boolean).join('\n'),
            source: 'dream-weaver',
        });
    }
    parts.push(opinionPart(opinion));
    parts.push(fmtPart([
        '为这位演员生成一部适合当前线级与数值的剧。严格输出 JSON：',
        '{"title":"剧名","type":"drama|film|stage|short","synopsis":"两三句梗概",',
        ' "roleName":"给用户的角色名","roleDesc":"角色小传（为什么这个数值的演员接得到这个角色）",',
        ' "difficulty":40到85的整数,"chapters":[{"title":"章节名","summary":"一句话"}] }',
        'chapters 3~6 章。角色档位要贴合演员当前的知名度与演技，不要越级发主角。',
    ]));
    return compose(`script::${save.id}`, parts);
}

// ============================================================
// 场景：单场演出小剧场（结果已由 JS 掷定，AI 只负责演绎，不许改结果）
// ============================================================

export function buildScenePrompt({ identity, profile, save, project, scene, outcome, opinion }) {
    const parts = [
        worldPart(identity),
        userPart(identity, profile),
        careerPart(save),
        timePart(identity, save),
        {
            id: 'scene', title: '本场戏', tag: '本场戏', group: '输入',
            content: [
                `剧目：《${project.title}》（${project.roleName ? `饰演 ${project.roleName}` : '出演'}）`,
                `场次：第 ${scene.index + 1} 场「${scene.title}」`,
                scene.summary ? `内容：${scene.summary}` : '',
                `结算结果（不可更改）：${outcome.gradeLabel}（成功率 ${Math.round(outcome.result.chance * 100)}%，roll ${outcome.result.roll.toFixed(3)}）`,
            ].filter(Boolean).join('\n'),
            source: 'actor',
        },
        opinionPart(opinion),
        fmtPart([
            '写这场戏的现场过程（300 字内，第二人称，镜头感强）。',
            '结果已经由系统掷定，你只能演绎为什么是这个结果，不能翻转它。',
            `结尾用一行「◆ ${outcome.gradeLabel}」收束。不要输出 JSON。`,
        ]),
    ];
    return compose(`scene::${project.id}::${scene.index}`, parts);
}

// ============================================================
// 场景：快进 N 天
// ============================================================

export function buildFastForwardPrompt({ identity, profile, save, timeline, days, rolledEvents, opinion }) {
    const eventLines = asArray(rolledEvents).map((e) => `第${e.day}天：${e.title}`).join('\n');
    const parts = [
        worldPart(identity),
        userPart(identity, profile),
        careerPart(save),
        timePart(identity, save),
        recentPart(timeline),
        {
            id: 'skip', title: '快进区间', tag: '快进区间', group: '输入',
            content: [
                `从档内第 ${save.clock.day} 天快进 ${days} 天。`,
                eventLines ? `系统已掷定这段时间发生的事件（必须体现在叙述中）：\n${eventLines}` : '这段时间系统未掷出大事件。',
            ].join('\n'),
            source: 'actor',
        },
        opinionPart(opinion),
        fmtPart([
            '总结这段时间这位演员最合理的经历。严格输出 JSON：',
            '{"narrative":"200字内的经过","attrDeltas":{"voice":0,"diction":0,"body":0,"acting":0,"empathy":0,"camera":0,"network":0,"resilience":0,"fame":0},',
            ' "timelineEvents":[{"dayOffset":1,"title":"事件名","detail":"一句话"}] }',
            `attrDeltas 每项在 -${FAST_FORWARD_DELTA_CAP}~${FAST_FORWARD_DELTA_CAP} 之间（系统会再钳制），timelineEvents 最多 4 条。`,
        ]),
    ];
    return compose(`ff::${save.id}`, parts);
}

// ============================================================
// 场景：阶段结算（多块串行，块 id 传入）
// ============================================================

export function buildSettlementBlockPrompt({ identity, profile, save, timeline, block, previousBlocks }) {
    const prevText = asArray(previousBlocks)
        .map((b) => `【${b.label}】\n${typeof b.output === 'string' ? b.output : JSON.stringify(b.output)}`)
        .join('\n\n');
    const nextSpec = tierSpec(Math.max(1, save.tier - 1));
    const parts = [
        worldPart(identity),
        userPart(identity, profile),
        careerPart(save),
        timePart(identity, save),
        recentPart(timeline),
        prevText ? {
            id: 'prev-blocks', title: '已完成的结算块', tag: '已完成结算', group: '输入',
            content: prevText, source: 'actor',
        } : null,
        {
            id: 'goal', title: '结算目标', tag: '结算目标', group: '输入',
            content: `用户决定从 ${tierSpec(save.tier).label} 晋升到 ${nextSpec.label}（${nextSpec.group}）。本块任务：${block.label} —— ${block.desc}。`,
            source: 'actor',
        },
    ];
    if (block.type === 'json' && block.id === 'stats') {
        parts.push(fmtPart([
            '输出这段生涯对九维数值的影响。严格输出 JSON：',
            '{"attrDeltas":{"voice":0,"diction":0,"body":0,"acting":0,"empathy":0,"camera":0,"network":0,"resilience":0,"fame":0},"reasons":["理由一","理由二"]}',
            `每项在 -${SETTLEMENT_DELTA_CAP}~${SETTLEMENT_DELTA_CAP} 之间（系统会再钳制与结算）。`,
        ]));
    } else if (block.type === 'json' && block.id === 'relations') {
        parts.push(fmtPart([
            '输出人脉与关系变化。严格输出 JSON：',
            '{"summary":"两句话","relationChanges":[{"name":"某人","change":"靠近|疏远|反目|结盟","why":"一句话"}]}',
            'relationChanges 最多 4 条，只写已出场过的人物或行业泛称。',
        ]));
    } else {
        parts.push(fmtPart([
            `写「${block.label}」：${block.desc}。150~250 字，第二人称，克制、具体、不煽情。不要输出 JSON。`,
        ]));
    }
    return compose(`settle::${save.id}::${block.id}`, parts.filter(Boolean));
}

// ============================================================
// 场景：NPC 聊天（一句一调）
// ============================================================

export function buildNpcChatPrompt({ identity, profile, save, npc, history, userText }) {
    const historyText = asArray(history).slice(-12)
        .map((m) => `${m.role === 'user' ? '用户' : npc.name}：${m.text}`)
        .join('\n');
    const persona = npc.fromAi && npc.personaSnapshot ? npc.personaSnapshot : npcPersonaText(npc);
    const parts = [
        worldPart(identity),
        userPart(identity, profile),
        careerPart(save),
        timePart(identity, save),
        {
            id: 'npc', title: 'NPC 人设', tag: 'NPC人设', group: '输入',
            content: persona, source: 'actor',
        },
        historyText ? {
            id: 'history', title: '对话上文', tag: '对话上文', group: '输入',
            content: historyText, source: 'actor',
        } : null,
        {
            id: 'say', title: '用户这句话', tag: '用户这句话', group: '输入',
            content: String(userText || ''), source: 'user',
        },
        fmtPart([
            `你扮演 ${npc.name}，完全按上面的人设与态度说话。`,
            '回一段 60 字内的话（可以带一个动作描写，用括号）。不要出戏，不要解释自己是 AI。',
        ]),
    ];
    return compose(`npc::${save.id}::${npc.id}`, parts.filter(Boolean));
}

// ============================================================
// 场景：结局生成
// ============================================================

export function buildEndingPrompt({ identity, profile, save, timeline, opinion }) {
    const parts = [
        worldPart(identity),
        userPart(identity, profile),
        careerPart(save),
        timePart(identity, save),
        {
            id: 'full-timeline', title: '完整大事记', tag: '完整大事记', group: '输入',
            content: asArray(timeline).slice(0, 30)
                .map((t) => `第${t.day}天 ${t.title}${t.detail ? `：${truncate(t.detail, 30)}` : ''}`)
                .join('\n'),
            source: 'actor',
        },
        opinionPart(opinion),
        fmtPart([
            '为这一档演员人生写一篇结局（400 字内，第二人称）。',
            '从起点线写到现在，落在一个有余味的画面上。结算完用户还能继续玩日常，所以不要写死亡或退圈，除非大事记里已经如此。',
            '不要输出 JSON。',
        ]),
    ];
    return compose(`ending::${save.id}`, parts);
}

// ============================================================
// 场景：事件现场演绎（可选增强，不改数值）
// ============================================================

export function buildEventScenePrompt({ identity, profile, save, eventTitle, eventDesc, choiceLabel, resultNote }) {
    const parts = [
        worldPart(identity),
        userPart(identity, profile),
        careerPart(save),
        timePart(identity, save),
        {
            id: 'event', title: '事件', tag: '事件', group: '输入',
            content: [
                `事件：${eventTitle}`,
                eventDesc,
                choiceLabel ? `用户的处理方式：${choiceLabel}` : '',
                resultNote ? `系统结算结果（不可更改）：${resultNote}` : '',
            ].filter(Boolean).join('\n'),
            source: 'actor',
        },
        fmtPart(['把这个事件写成 150 字内的现场小段落（第二人称）。结果已定，不可翻转。不要输出 JSON。']),
    ];
    return compose(`event::${save.id}`, parts);
}

/** 提示词透明页用：最近一次各场景的 compose 结果都能被 load 出来 */
export function loadPreview(scope) {
    return composer.load(scope);
}
