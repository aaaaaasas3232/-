/**
 * 赛点 · Prompt 构建（composeContext 唯一出口）
 *
 * 发送 text 与 UI 展示 parts 来自同一次 compose —— 预览 == 实际发送。
 * 场景：对局文字回放（云端回放）/ 群聊回话 / 复盘。
 */

import { createContextComposer } from '@/src/core/context-composer.js';
import { asArray, truncate } from '../utils.js';

export const composer = createContextComposer({ namespace: 'esports-game', tokenBudget: 10000 });

function worldPart(career) {
    return {
        id: 'world', title: '世界背景', tag: '世界背景', group: '背景',
        content: [
            `这是一个电竞世界观。用户是职业选手「${career.gameId}」，效力于${career.teamName}，位置 ${career.posLabel}。`,
            `项目：《${career.gameName}》。`,
            career.season ? `当前赛事：${career.season.name}（${career.season.phaseLabel}）。` : '当前是休赛期。',
        ].join('\n'),
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
// 场景：对局文字回放（「正在从云端获取对局回放」）
// ============================================================

export function buildReplayPrompt({ career, match, session, companionsDesc }) {
    const parts = [
        worldPart(career),
        {
            id: 'match', title: '这一局的事实（已掷定，不许改）', tag: '对局事实', group: '输入',
            content: [
                `模式：${session.modeLabel} · 第 ${match.seq} 局 · ${match.win ? '胜利' : '失败'}（${match.grade}）`,
                `用户使用：${match.hero}，战绩 ${match.kdaText}，用时 ${match.duration} 分钟`,
                companionsDesc ? `同行者：${companionsDesc}` : '本局单排',
                asArray(match.passerbys).length ? `路人队友：${match.passerbys.join('、')}` : '',
                match.hungry ? '这局用户饿着肚子在打（状态受影响）' : '',
                match.mvp ? '用户拿下本局 MVP' : '',
                '胜负、KDA、MVP 都是既定事实，回放只演绎过程，禁止翻案。',
            ].filter(Boolean).join('\n'),
            source: 'esports',
        },
        fmtPart([
            '写这一局的文字回放（180~300字）：像观战视角的解说复述，',
            '有开局、有转折点、有决定性的团战或时刻，提到路人队友的表现。',
            '直接输出正文，不要 JSON。',
        ]),
    ];
    return compose(`replay::${match.id || match.seq}`, parts);
}

// ============================================================
// 场景：群聊回话（战队群 / 教练私聊）
// ============================================================

export function buildChatReplyPrompt({ career, channel, personas, history, userText, todayFacts }) {
    const isCoach = channel === 'coach';
    const parts = [
        worldPart(career),
        {
            id: 'members', title: isCoach ? '教练人设' : '群成员人设', tag: '成员人设', group: '背景',
            content: personas,
            source: 'esports',
        },
        {
            id: 'today', title: '今天的事实', tag: '今天的事实', group: '生涯',
            content: todayFacts || '今天暂时没有特别的事。',
            source: 'esports',
        },
        {
            id: 'history', title: '最近的聊天', tag: '最近的聊天', group: '输入',
            content: asArray(history).slice(-10)
                .map((m) => `${m.senderName}：${truncate(m.text, 60)}`)
                .join('\n'),
            source: 'esports',
        },
        {
            id: 'incoming', title: '用户刚说', tag: '用户刚说', group: '输入',
            content: String(userText || '').trim(),
            source: 'user',
        },
        fmtPart(isCoach ? [
            '以教练的身份回 1~2 句。严格输出 JSON：',
            '{"replies":[{"speaker":"教练","text":"回话（15~60字，符合人设口吻）"}]}',
        ] : [
            '让 1~3 位群成员接话。严格输出 JSON：',
            '{"replies":[{"speaker":"成员的游戏ID","text":"回话（10~50字，口语化，符合各自人设）"}]}',
            'speaker 必须是上面人设里出现过的名字；不是每个人都要说话。',
        ]),
    ];
    return compose(`chat::${channel}`, parts);
}

// ============================================================
// 场景：复盘（训练赛 / 正式赛后）
// ============================================================

export function buildReviewPrompt({ career, personas, subject, opinion }) {
    const parts = [
        worldPart(career),
        {
            id: 'members', title: '参与复盘的人', tag: '参与复盘的人', group: '背景',
            content: personas,
            source: 'esports',
        },
        {
            id: 'subject', title: '复盘对象（事实已定）', tag: '复盘对象', group: '输入',
            content: subject,
            source: 'esports',
        },
        opinionPart(opinion),
        fmtPart([
            '生成一段复盘会记录：教练先说 2~3 句（指出问题与亮点），再让 1~2 位队员补充。',
            '严格输出 JSON：{"replies":[{"speaker":"名字","text":"发言（20~70字）"}]}',
            'speaker 用「教练」或队员的游戏 ID。基于事实，不虚构比分。',
        ]),
    ];
    return compose('review', parts);
}
