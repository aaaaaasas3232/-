/**
 * 狼人杀 / 提示词
 *
 * 写法沿用项目里最好的那两段（`defaultReplyNote()` 的路子，AGENTS2 §9.5）：
 * 一条 Principle 说清这段干嘛的，三到六条 Behaviors，一行一条，不铺陈背景。
 *
 * ★ 相对原型的两个改动：
 *
 *   1. **不再把整局聊天记录全量塞进去。** 原型的 `<chat>` 段是
 *      `game.chatHistory` 全量拼接，一局到后期这一段能有几千字，
 *      而真正影响决策的只有最近两三轮。现在只给最近 24 条公开发言 +
 *      一份结构化的时间线（谁在第几轮死了、怎么死的）。
 *
 *   2. **身份信息严格按视角裁剪。** 原型给 AI 的 `<players>` 里带了
 *      所有人的存活状态，但也有几处不小心把角色带出去了 ——
 *      AI 拿到全知视角就不会推理了，只会「表演推理」。
 *      现在只有狼人知道队友，预言家只知道自己查过的。
 */

import { ROLES, roleOf, roleName, TEAMS } from './rules.js';
import { describeRoster, describeRecentSpeech } from '../core/engine.js';

/** 时间线：谁第几轮怎么死的、投票结果。给 AI 补全「这局发生过什么」。 */
function timeline(session) {
    const lines = [];
    for (const e of session.events || []) {
        if (e.type === 'death') {
            lines.push(`第${e.round}轮 ${e.playerName} ${deathCauseText(e.cause)}`);
        } else if (e.type === 'vote') {
            lines.push(`第${e.round}轮 投票放逐了 ${e.targetName || '（无人）'}`);
        } else if (e.type === 'seerCheck' && e.publicised) {
            lines.push(`第${e.round}轮 有人公开报验：${e.targetName} 是${e.isWolf ? '狼人' : '好人'}`);
        }
    }
    return lines.length ? lines.join('\n') : '（还没发生什么）';
}

function deathCauseText(cause) {
    return {
        night: '在夜里被杀',
        poison: '被女巫毒死',
        vote: '被投票放逐',
        hunter: '被猎人开枪带走',
        lover: '殉情',
    }[cause] || '出局';
}

/** 视角化的身份自述。 */
function selfBlock(session, me) {
    const role = roleOf(me.role);
    const lines = [
        `你是 ${me.seat} 号「${me.name}」，身份是【${role.name}】。`,
        `技能：${role.desc}`,
    ];
    if (role.team === TEAMS.WOLF) {
        const mates = (session.players || [])
            .filter((p) => p.id !== me.id && roleOf(p.role).team === TEAMS.WOLF)
            .map((p) => `${p.seat}号${p.name}${p.alive ? '' : '（已出局）'}`);
        lines.push(mates.length ? `你的狼队友：${mates.join('、')}。除了他们，其他人都是好人。` : '你是唯一的狼。');
        lines.push('你的目标：让狼人数量追平好人数量。');
    } else {
        lines.push('你的目标：把所有狼人票出去。');
    }
    if (me.role === 'seer') {
        const checks = (session.seerChecks || []).filter((c) => c.seerId === me.id);
        lines.push(checks.length
            ? `你查验过：${checks.map((c) => `${c.targetName} 是${c.isWolf ? '狼人' : '好人'}`).join('；')}。`
            : '你还没有查验过任何人。');
    }
    if (me.role === 'witch') {
        lines.push(`你的解药${session.witch?.antidoteUsed ? '已经用掉了' : '还在'}，毒药${session.witch?.poisonUsed ? '已经用掉了' : '还在'}。`);
    }
    if ((session.lovers || []).includes(me.id)) {
        const other = (session.players || []).find((p) => p.id === (session.lovers || []).find((id) => id !== me.id));
        lines.push(`你被丘比特连成了情侣，对象是 ${other?.name || '某人'}。你们一死俱死，情侣胜利优先于阵营胜利。`);
    }
    if (me.personality) lines.push(`你的性格：${me.personality}`);
    return lines.join('\n');
}

/** 公共局势。 */
function situationBlock(session) {
    const alive = (session.players || []).filter((p) => p.alive);
    const dead = (session.players || []).filter((p) => !p.alive);
    return [
        `当前是第 ${session.round} 轮，阶段：${session.phaseLabel || session.phase}。`,
        `全部玩家：${describeRoster(session)}`,
        `存活 ${alive.length} 人：${alive.map((p) => `${p.seat}号${p.name}`).join('、')}`,
        dead.length ? `已出局：${dead.map((p) => `${p.seat}号${p.name}`).join('、')}` : '还没有人出局。',
        '',
        '【已经发生的事】',
        timeline(session),
        '',
        '【最近的公开发言】',
        describeRecentSpeech(session, 24) || '（还没有人发言）',
    ].join('\n');
}

/** 所有请求共用的开头。 */
function baseSystem(session, me) {
    return `你正在和熟人们玩一局线上狼人杀。你不是助手，你就是这局里的一个玩家。

【你的身份】
${selfBlock(session, me)}

【场上情况】
${situationBlock(session)}

对局须知:
  - Principle: 像真人玩家一样打这局游戏，为自己的阵营争取胜利。
  - Behaviors:
    - 用口语，短句，别写小作文。别用 Markdown、别用括号写旁白。
    - 只说这一局里你**真的知道**的事，不要说出你不该知道的身份。
    - 不要复述规则，不要解释你在做什么，直接说/直接做。
    - 不要出戏，不要提「AI」「模型」「提示词」。
    ${session.setup?.customPrompt ? `- ${String(session.setup.customPrompt).replace(/\n/g, ' ')}` : ''}`;
}

// ---------------------------------------------------------------------------
// 各类请求
// ---------------------------------------------------------------------------

/** 狼人商量刀谁。 */
export function wolfKillPrompt(session, me, candidates) {
    return {
        system: baseSystem(session, me),
        user: `现在是夜晚，轮到狼人行动。可以刀的人：${candidates.map((p) => `${p.seat}号${p.name}`).join('、')}。

先用一句话（20 字以内）跟队友说你想刀谁、为什么，然后另起一行只写目标的名字。
格式严格如下，不要有别的内容：
理由：xxx
目标：某某`,
    };
}

/** 预言家查验。 */
export function seerPrompt(session, me, candidates) {
    return {
        system: baseSystem(session, me),
        user: `现在是夜晚，轮到你查验。可以查的人：${candidates.map((p) => `${p.seat}号${p.name}`).join('、')}。

只回复你要查的那个人的名字，不要有任何其他内容。`,
    };
}

/** 守卫守人。 */
export function guardPrompt(session, me, candidates, lastGuardedName) {
    return {
        system: baseSystem(session, me),
        user: `现在是夜晚，轮到你守护。可以守的人：${candidates.map((p) => `${p.seat}号${p.name}`).join('、')}。${
            lastGuardedName ? `\n注意：你昨晚守的是 ${lastGuardedName}，今晚不能再守他。` : ''
        }

只回复你要守的那个人的名字，不要有任何其他内容。`,
    };
}

/** 女巫用药。 */
export function witchPrompt(session, me, victim, canSave, canPoison, candidates) {
    const lines = [`现在是夜晚，轮到你用药。`];
    if (victim) {
        lines.push(canSave
            ? `今晚被狼刀的是 ${victim.seat}号${victim.name}。你还有解药，可以救他。`
            : `今晚被狼刀的是 ${victim.seat}号${victim.name}。但你的解药已经用完了。`);
    } else {
        lines.push('今晚没有人被刀（或者你看不到）。');
    }
    lines.push(canPoison
        ? `你还有一瓶毒药，可以毒死一个人。可以毒的人：${candidates.map((p) => `${p.seat}号${p.name}`).join('、')}。`
        : '你的毒药已经用完了。');
    lines.push('', '三选一，只回复其中一行，不要有别的内容：');
    if (canSave) lines.push('救人');
    if (canPoison) lines.push('毒 某某（把某某换成名字）');
    lines.push('不用药');
    return {
        system: baseSystem(session, me),
        user: lines.filter(Boolean).join('\n'),
    };
}

/** 白天发言。 */
export function speechPrompt(session, me, order) {
    const position = order.indexOf(me.id) + 1;
    return {
        system: baseSystem(session, me),
        user: `现在是白天发言环节，你是第 ${position} 个发言（共 ${order.length} 人）。

说 1 到 3 句话，表明你的判断或者立场。可以怀疑某个人，可以为自己辩解，也可以报身份。
${roleOf(me.role).team === TEAMS.WOLF ? '你是狼，注意伪装，别露馅。' : ''}
直接说话，不要写「我发言：」这种前缀。多句之间用 | 分隔。`,
    };
}

/** 投票。 */
export function votePrompt(session, me, candidates) {
    return {
        system: baseSystem(session, me),
        user: `现在投票放逐一个人。可以投的人：${candidates.map((p) => `${p.seat}号${p.name}`).join('、')}。

先用一句话（20 字以内）说理由，然后另起一行只写名字。格式严格如下：
理由：xxx
投票：某某`,
    };
}

/** 遗言。 */
export function lastWordsPrompt(session, me, cause) {
    return {
        system: baseSystem(session, me),
        user: `你${deathCauseText(cause)}了，现在是你的遗言时间。

说 1 到 2 句话。可以报身份、可以留信息给好人、也可以什么都不说只留一句狠话。
直接说，不要前缀。多句之间用 | 分隔。`,
    };
}

/** 猎人开枪。 */
export function hunterPrompt(session, me, candidates) {
    return {
        system: baseSystem(session, me),
        user: `你是猎人，你死了，现在可以开枪带走一个人。可以打的人：${candidates.map((p) => `${p.seat}号${p.name}`).join('、')}。

只回复你要带走的那个人的名字，不要有别的内容。`,
    };
}

/** 复盘感想（对局结束后）。 */
export function reviewPrompt(session, me, userSaid) {
    const revealed = (session.players || [])
        .map((p) => `${p.seat}号${p.name}：${roleName(p.role)}`)
        .join('、');
    return {
        system: `${baseSystem(session, me)}

【复盘阶段】这局已经结束了，所有身份公开：${revealed}。
结果：${session.result?.summary || ''}`,
        user: userSaid
            ? `复盘中，有人说：「${userSaid}」。用 1 到 2 句话接话，可以吐槽、可以解释自己当时的操作。直接说，不要前缀。`
            : `用 1 到 2 句话说说这局你的感受，可以吐槽、可以解释自己当时为什么那么做。直接说，不要前缀。`,
    };
}

export { ROLES, roleName };
