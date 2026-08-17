/**
 * 候鸟 · 提示词组装（唯一真相）
 *
 * ── 一条硬规矩 ────────────────────────────────────────────────────
 * 每个 build* 都走 `composeContext()`，返回 `{ text, parts, stats }`：
 *   text   发给 AI 的那一份
 *   parts  「查看提示词」面板渲染的那一份
 * 是同一次调用的两个返回字段，物理上不可能不一致。
 *
 * ── 世界观是必传的 ────────────────────────────────────────────────
 * 简介 + 资金映射（货币名）两段 locked，用户不能关；
 * 可关的是夹子、prompt 库条目和口味。
 *
 * ★ 本文件是纯函数：不读 window、不读 store。所有数据由调用方传进来，
 *   node 测试直接 import。
 */

import { createContextComposer } from '@/src/core/context-composer.js';
import { DAY_PHASES, FEED_SIZE, JSON_RULE } from '../constants.js';
import { asArray, truncate } from '../utils.js';
import { slotToStage, tripDurationLabel } from './trip-flow.js';

const composer = createContextComposer({ namespace: 'travel' });

export { composer };

function part(id, title, content, opts = {}) {
    return {
        id,
        title,
        content: String(content || '').trim(),
        tag: opts.tag || title,
        active: opts.active !== false,
        locked: opts.locked === true,
        source: opts.source || '',
    };
}

// ============================================================
// 世界观底座 —— 所有生成都以它开头
// ============================================================

/**
 * @param {object} ctx
 * @param {object}   ctx.identity  world-context.readIdentity() 的快照
 * @param {string}   ctx.summary   世界观简介
 * @param {object[]} ctx.clips     选中的夹子
 * @param {object[]} ctx.prompts   选中的 prompt 库条目
 * @param {string}   ctx.taste     用户的旅行口味
 */
export function buildWorldParts(ctx = {}) {
    const { identity = {}, clips = [], prompts = [], taste = '', summary = '' } = ctx;
    const currency = identity.currency || '金币';

    const out = [];

    out.push(part('role', '你的角色',
        `你在为一个叫「候鸟」的旅行软件生成内容。这个软件活在下面这个世界里，`
        + `它推荐的每一个地点、每一段旅程都必须是这个世界里真的能去的地方。`
        + `不要出现现实世界的地名、品牌、货币和交通工具型号。`,
        { locked: true, source: '内置' }));

    out.push(part('world', `世界观：${identity.worldName || '未命名'}`,
        summary || '（这个世界观还没写简介，请按名字合理推测，但不要引入现实世界的地名和品牌。）',
        { locked: true, tag: '世界观', source: 'nook 世界观' }));

    out.push(part('currency', '资金映射',
        `这个世界的通用货币叫「${currency}」。\n`
        + `- 所有票价、花费都用「${currency}」计价，只给数字，不要带单位符号，不要写「元」「块」「$」。\n`
        + `- 定价符合这个世界的物价：近途便宜、远途或危险的地方贵。`,
        { locked: true, source: '内置' }));

    const clipList = asArray(clips).filter((c) => c && c.content);
    if (clipList.length) {
        out.push(part('clips', '世界观夹子',
            clipList.map((c) => `【${c.title}】\n${c.content}`).join('\n\n'),
            { source: 'nook 夹子' }));
    }

    const promptList = asArray(prompts).filter((p) => p && p.content);
    if (promptList.length) {
        out.push(part('prompts', '附加提示词',
            promptList.map((p) => `【${p.title}】\n${p.content}`).join('\n\n'),
            { source: 'prompt 库' }));
    }

    if (String(taste || '').trim()) {
        out.push(part('taste', '旅行口味', String(taste).trim(), { source: '首次配置' }));
    }

    return out;
}

// ============================================================
// 候选列表
// ============================================================

const FEED_SHAPE = `{
  "candidates": [
    {
      "placeName": "地点名（一张地图的容器，如某座城/某片山域），2~8 字",
      "locationName": "该地点下的具体场所（真正要去逛的那个点），2~10 字",
      "kind": "类型，2~4 字（如 古迹 / 集市 / 山水 / 秘境 / 港口）",
      "blurb": "一句话说清它为什么值得去，16~30 字，别写成广告词",
      "tags": ["两到三个短标签，每个 2~4 字"],
      "reusePlace": true 或 false（placeName 是否取自下面给出的「世界已有地点」）
    }
  ]
}`;

/**
 * 生成一批旅行候选。只出列表不出详情 —— 详情等用户点进去再生成。
 *
 * @param {object} ctx 世界底座 + 以下字段
 * @param {object[]} ctx.existingGeo  listWorldGeo() 的结果
 * @param {string[]} ctx.exclude      已出现过的「地点·场所」名
 * @param {number}   ctx.size
 */
export function buildFeedPrompt(ctx = {}) {
    const { existingGeo = [], exclude = [], size = FEED_SIZE } = ctx;
    const parts = buildWorldParts(ctx);

    const geoLines = asArray(existingGeo).slice(0, 20).map((p) => {
        const locs = asArray(p.locations).map((l) => l.name).filter(Boolean);
        return `- ${p.name}${locs.length ? `（已有场所：${locs.join('、')}）` : ''}`;
    });
    parts.push(part('geo', '世界已有地点',
        geoLines.length
            ? `这个世界目前已经登记了这些地点：\n${geoLines.join('\n')}\n`
              + `候选里可以有 1~2 个复用已有地点（在它下面找一个还没登记过的新场所），`
              + `其余请造这个世界里合理存在、但还没登记的新地点。`
            : '这个世界还没登记任何地点，全部候选都造新地点。',
        { locked: true, source: 'nook 空间' }));

    const excludeLine = asArray(exclude).length
        ? `\n- 这些已经出现过，这次全部换掉：${asArray(exclude).slice(0, 30).join('、')}`
        : '';

    parts.push(part('task', '这次要做什么',
        `列出 ${size} 个旅行候选。\n`
        + `- 每条必须同时给 placeName（地点）和 locationName（场所），两层缺一不可\n`
        + `- 名字要具体，一看就知道是这个世界的地方，不要「美丽小镇」「神秘森林」这种\n`
        + `- 类型拉开：有轻松的也有偏远的，有热闹的也有清净的\n`
        + `- reusePlace 只有在 placeName 逐字取自「世界已有地点」时才是 true`
        + excludeLine,
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${FEED_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 候选详情
// ============================================================

const DETAIL_SHAPE = `{
  "environment": "环境与到达方式，两段，每段 40~70 字",
  "features": ["三到四条特色 / 值得做的事，每条 12~24 字"],
  "risks": "风险与禁忌，一到两句，没有明显风险就写注意事项",
  "stayTime": "适合停留多久，一句话（如「一到两天」）",
  "ticketPrice": 数字（从出发地往返的旅费，用世界货币计价）,
  "notes": "出行注意事项，一到两句",
  "suggestedItems": ["两到三个建议携带物，每个 2~8 字"]
}`;

/**
 * 详情。用户点进候选才调，可以贵一点。
 * @param {object} ctx 世界底座 + { candidate }
 */
export function buildDetailPrompt(ctx = {}) {
    const { candidate = {} } = ctx;
    const parts = buildWorldParts(ctx);

    parts.push(part('target', '这个候选',
        `地点：${candidate.placeName || ''}\n场所：${candidate.locationName || ''}\n`
        + `类型：${candidate.kind || ''}\n一句话：${candidate.blurb || ''}`
        + (candidate.existingPlaceId ? '\n（这个地点在世界里已经登记过，写详情时不要和它已有的设定冲突）' : ''),
        { locked: true }));

    parts.push(part('task', '这次要做什么',
        '把上面这个候选展开成旅行详情。\n'
        + '- 已知信息不要改，只做扩写\n'
        + '- ticketPrice 是往返旅费：近途几十到几百，远途或难到达的上千\n'
        + '- 风险写真实的（野兽、禁地、潮汐、治安），不要都写「注意安全」\n'
        + '- suggestedItems 是这个世界里买得到的东西',
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${DETAIL_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 出发小剧场
// ============================================================

const THEATER_SHAPE = `{
  "title": "标题，6~12 字",
  "scenes": [
    {
      "place": "这一场发生在哪，2~8 字",
      "narration": "旁白，30~60 字，交代场景和动作",
      "lines": [
        { "speaker": "说话人的名字（必须是出场的人之一）", "text": "台词" }
      ]
    }
  ],
  "closing": "收尾，一到两句，20~40 字"
}`;

/** 行程要素段（小剧场和旁白共用） */
function buildTripParts(ctx = {}) {
    const { trip = {}, identity = {} } = ctx;
    const out = [];
    const dest = trip.destination || {};

    out.push(part('trip', '这趟旅行',
        `目的地：${dest.placeName || ''} · ${dest.locationName || ''}\n`
        + `安排：${tripDurationLabel(trip.days)}\n`
        + (dest.detail?.environment ? `目的地情况：${truncate(dest.detail.environment, 160)}\n` : '')
        + (dest.detail?.risks ? `已知风险：${truncate(dest.detail.risks, 80)}` : ''),
        { locked: true }));

    const cast = [
        `${identity.userName || '我'}（用户本人${ctx.userDesc ? `，${ctx.userDesc}` : ''}）`,
        ...asArray(trip.companions).map((c) => {
            const desc = asArray(ctx.companionDescs).find((d) => d.id === c.id)?.desc || '';
            return `${c.name}${desc ? `（${desc}）` : ''}`;
        }),
    ];
    out.push(part('cast', '同行的人', cast.join('\n'), { locked: true }));

    const items = asArray(trip.items);
    if (items.length) {
        out.push(part('items', '带上的东西',
            items.map((it) => `- ${it.label}${it.qty > 1 ? ` ×${it.qty}` : ''}`).join('\n')
            + '\n（这些是用户在四叶草真实买过的东西，旅途中可以自然用到，不要当摆设也不要句句都提）',
            { source: '四叶草' }));
    }

    if (String(trip.extra || '').trim()) {
        out.push(part('extra', '用户的附加要求', String(trip.extra).trim(), { source: '准备板' }));
    }

    return out;
}

/**
 * 出发前的小剧场。
 * @param {object} ctx 世界底座 + { trip, userDesc, companionDescs, opinion }
 */
export function buildTheaterPrompt(ctx = {}) {
    const parts = buildWorldParts(ctx);
    parts.push(...buildTripParts(ctx));

    if (String(ctx.opinion || '').trim()) {
        parts.push(part('opinion', '用户对上一版的意见',
            `${String(ctx.opinion).trim()}\n（这一版必须照着改，不要重复上一版被否掉的写法）`,
            { locked: true, source: '重 roll 意见' }));
    }

    parts.push(part('task', '这次要做什么',
        '写一场「出发前夜到动身」的小剧场，总字数 500~800 字，分 2~3 场。\n'
        + '- 内容是收拾行李、会合、出发路上，不要提前写到目的地\n'
        + '- 每个人说话要像自己，性格差异从台词里看得出来\n'
        + '- 旁白只写看得见的东西，不替角色解释心理\n'
        + '- speaker 只能用「同行的人」里列出的名字，不要凭空加人',
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${THEATER_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 旅行旁白（对话页逐段推进）
// ============================================================

const NARRATION_SHAPE = `{
  "narration": "这一段旁白正文"
}`;

/** 最近消息 → 文本（旁白和 AI 回复共用） */
function recentBlock(messages, limit = 14) {
    const rows = asArray(messages).slice(-limit).map((m) => {
        if (m.role === 'narration') return `【旁白】${m.text}`;
        if (m.role === 'user') return `${m.userName || '用户'}：${m.text}`;
        return `${m.aiName || 'AI'}：${m.text}`;
    });
    return rows.join('\n');
}

/**
 * 生成一段旁白。
 * @param {object} ctx 世界底座 + { trip, slotIndex, messages, opinion, userDesc, companionDescs }
 */
export function buildNarrationPrompt(ctx = {}) {
    const { trip = {}, slotIndex = 0, messages = [] } = ctx;
    const parts = buildWorldParts(ctx);
    parts.push(...buildTripParts(ctx));

    const { day, phase } = slotToStage(slotIndex, trip.days);
    const phaseLabel = DAY_PHASES[phase].label;
    const isFirst = Number(slotIndex) === 0;
    const isFinal = ctx.isFinal === true;

    const recent = recentBlock(messages);
    if (recent) {
        parts.push(part('recent', '旅行到目前为止', recent, { locked: true, tag: '近期旅程' }));
    }

    if (String(ctx.opinion || '').trim()) {
        parts.push(part('opinion', '用户对上一版的意见',
            `${String(ctx.opinion).trim()}\n（这一版必须照着改）`,
            { locked: true, source: '重 roll 意见' }));
    }

    let stageLine;
    if (isFirst) {
        stageLine = `现在写旅行的开头：第 1 天${phaseLabel}，从抵达目的地写起。`;
    } else if (isFinal) {
        stageLine = `现在写旅行的最后一段：第 ${day} 天${phaseLabel}。写收尾与归途，给这趟旅行一个落点，不要开新事件。`;
    } else {
        stageLine = `现在写第 ${day} 天${phaseLabel}这一段。`;
    }

    parts.push(part('task', '这次要做什么',
        `${stageLine}\n`
        + '- 只写一段旁白，80~160 字，第三人称，只写看得见的场景和大家的动作\n'
        + '- 要接住「旅行到目前为止」里最后几条的动向，不要凭空跳跃\n'
        + '- 给同行的人留互动的口子，但不要替任何人说台词\n'
        + '- 不要总结、不要抒情堆砌、不要预告后面的行程',
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${NARRATION_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 同行 AI 回复
// ============================================================

const REPLY_SHAPE = `{
  "text": "这个角色要说的话（可以带一个简短的动作描写）"
}`;

/**
 * 让某位同行 AI 接话。
 * @param {object} ctx 世界底座 + { trip, targetAi: {id,name,desc}, messages, replyTo }
 */
export function buildAiReplyPrompt(ctx = {}) {
    const { targetAi = {}, messages = [], replyTo = null } = ctx;
    const parts = buildWorldParts(ctx);
    parts.push(...buildTripParts(ctx));

    parts.push(part('speaker', '现在轮到谁说话',
        `${targetAi.name || 'AI'}${targetAi.desc ? `（${targetAi.desc}）` : ''}\n`
        + '接下来只以这个角色的身份说话。',
        { locked: true }));

    const recent = recentBlock(messages);
    if (recent) {
        parts.push(part('recent', '旅行到目前为止', recent, { locked: true, tag: '近期旅程' }));
    }

    if (replyTo && String(replyTo.text || '').trim()) {
        const who = replyTo.role === 'narration' ? '旁白' : (replyTo.speaker || '对方');
        parts.push(part('replyTo', '要回应的那句',
            `${who}：${truncate(replyTo.text, 240)}`,
            { locked: true }));
    }

    parts.push(part('task', '这次要做什么',
        `写 ${targetAi.name || '这个角色'} 的下一句话。\n`
        + '- 一到三句，像旅途中的随口聊天，不要演讲\n'
        + '- 符合这个角色的性格和说话方式\n'
        + '- 回应上文正在发生的事，不要开上帝视角\n'
        + '- 不要替用户或其他人说话',
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${REPLY_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 旅行概要（注入 murmur 的是它，不是全过程）
// ============================================================

/**
 * @param {object} ctx { trip, messages }
 */
export function buildSummaryPrompt(ctx = {}) {
    const { trip = {}, messages = [] } = ctx;
    const dest = trip.destination || {};
    const transcript = asArray(messages).map((m) => {
        if (m.role === 'narration') return `【旁白】${m.text}`;
        if (m.role === 'user') return `${m.userName || '用户'}：${m.text}`;
        return `${m.aiName || 'AI'}：${m.text}`;
    }).join('\n');

    const parts = [
        part('source', '这趟旅行',
            `目的地：${dest.placeName || ''} · ${dest.locationName || ''}\n`
            + `安排：${tripDurationLabel(trip.days)}\n`
            + `同行：${asArray(trip.companions).map((c) => c.name).join('、') || '（独自）'}\n\n`
            + `全过程：\n${truncate(transcript, 5000)}`,
            { locked: true }),
        part('task', '这次要做什么',
            '用两到三句话概括这趟旅行。\n'
            + '- 第一句说事：去了哪、和谁、做了什么\n'
            + '- 后面说人：路上谁的哪个瞬间值得记住\n'
            + '- 这段概要会成为 AI 的记忆，写「发生过什么」，不要写「这段写得怎么样」\n'
            + '- 不要复述台词原文',
            { locked: true }),
        part('format', '输出格式', '只输出这两三句话本身，不要引号，不要编号，不要任何解释。', { locked: true }),
    ];

    return composer.compose(parts);
}
