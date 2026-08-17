/**
 * 谁是卧底 / 提示词
 *
 * ★ 相对原型最大的改动在**投票**：
 *   原型的 `generateAIUndercoverVote` 注释写着「根据描述判断」，
 *   实现却是 `Math.random()` —— 卧底随机投一个平民，平民随机投一个人，
 *   连算好的 `descriptions` 变量都没用上（死变量）。
 *   于是这个游戏的核心乐趣（听描述抓卧底）在 AI 这边根本不存在，
 *   用户赢或输纯看运气。现在投票是真的走 AI，并且必须给出理由。
 */

import { describeRecentSpeech } from '../core/engine.js';

function selfBlock(session, me) {
    const lines = [
        `你是 ${me.seat} 号「${me.name}」。`,
        `你拿到的词是：【${me.word}】。`,
        '注意：场上大多数人拿到的是同一个词，只有极少数人（卧底）拿到的是另一个相近但不同的词。你不知道自己是哪一种。',
    ];
    if (me.personality) lines.push(`你的性格：${me.personality}`);
    return lines.join('\n');
}

function situation(session) {
    const alive = (session.players || []).filter((p) => p.alive);
    const out = (session.players || []).filter((p) => !p.alive);
    return [
        `第 ${session.round} 轮，还剩 ${alive.length} 人：${alive.map((p) => `${p.seat}号${p.name}`).join('、')}`,
        out.length ? `已出局：${out.map((p) => `${p.seat}号${p.name}`).join('、')}` : '还没有人出局。',
        '',
        '【所有人说过的话】',
        describeRecentSpeech(session, 30) || '（还没有人说话）',
    ].join('\n');
}

function base(session, me) {
    return `你正在和熟人们玩「谁是卧底」。你不是助手，你就是这局里的一个玩家。

【你的情况】
${selfBlock(session, me)}

【场上情况】
${situation(session)}

对局须知:
  - Principle: 藏住自己的词，同时从别人的描述里找出那个跟你不一样的人。
  - Behaviors:
    - 说口语、说短句。不要 Markdown，不要写旁白。
    - **绝对不能直接说出你的词，也不能说它的同音字、拼音、字数或偏旁。**
    - 描述要有信息量但留余地：太具体会暴露自己，太笼统会被当成卧底。
    - 不要复述规则，不要解释你在做什么。
    ${session.setup?.customPrompt ? `- ${String(session.setup.customPrompt).replace(/\n/g, ' ')}` : ''}`;
}

/** 一轮描述。 */
export function describePrompt(session, me, order) {
    const position = order.indexOf(me.id) + 1;
    const said = (session.log || [])
        .filter((l) => l.kind === 'speech' && l.round === session.round && l.playerId !== me.id)
        .map((l) => `${l.playerName}：${l.text}`);
    return {
        system: base(session, me),
        user: `第 ${session.round} 轮描述，你是第 ${position} 个说（共 ${order.length} 人）。
${said.length ? `这一轮前面的人已经说了：\n${said.join('\n')}\n` : ''}
用**一句话**（10 到 30 字）描述你的词。不要重复别人说过的角度。
直接说那句话，不要任何前缀、不要引号。`,
    };
}

/** 自由讨论。 */
export function discussPrompt(session, me, userSaid) {
    return {
        system: base(session, me),
        user: `现在是自由讨论时间。${userSaid ? `刚才有人说：「${userSaid}」\n` : ''}
用 1 句话表态：你觉得谁最可疑，或者为自己辩解一句。
直接说，不要前缀。`,
    };
}

/**
 * 投票。
 *
 * 要求给理由不只是为了好看 —— 强制 AI 先写理由能明显提高它选人的质量，
 * 而且理由会显示在唱票里，用户能看出 AI 到底有没有在听。
 */
export function votePrompt(session, me, candidates) {
    return {
        system: base(session, me),
        user: `投票时间。可以投的人：${candidates.map((p) => `${p.seat}号${p.name}`).join('、')}。

回顾一下每个人的描述，挑出那个描述得跟大家「不太对味」的人。
格式严格如下两行，不要有别的内容：
理由：（20 字以内，说明你为什么怀疑他）
投票：某某`,
    };
}

/** 复盘。 */
export function reviewPrompt(session, me, userSaid) {
    const pair = session.wordPair || {};
    const roles = (session.players || [])
        .map((p) => `${p.name}=${p.role === 'undercover' ? '卧底' : '平民'}`)
        .join('、');
    return {
        system: `${base(session, me)}

【复盘阶段】这局结束了。平民词是「${pair.civilian}」，卧底词是「${pair.undercover}」。身份：${roles}。
结果：${session.result?.summary || ''}`,
        user: userSaid
            ? `有人说：「${userSaid}」。用 1 句话接话。直接说，不要前缀。`
            : `用 1 句话吐槽一下这局。直接说，不要前缀。`,
    };
}

/**
 * 让 AI 出一对词（可选路径，设置里勾了才走）。
 * 嵌套结构一律要 JSON，不用自定义分隔符（AGENTS2 §13.6.2）。
 */
export function wordPairPrompt(typeLabel) {
    return {
        system: `你是「谁是卧底」的出题器。要出一对**相近但不同**的词。

出题须知:
  - Principle: 两个词要同类、都能被描述、差别要小到需要几轮才能分辨。
  - Behaviors:
    - 不要出同义词（描述不出差别），也不要出差异过大的词（一轮就被抓）。
    - 都要是常见词，不要生僻。
    - 只输出 JSON，不要任何解释：{"civilian":"词A","undercover":"词B"}`,
        user: `出一对「${typeLabel}」类的词。只返回 JSON。`,
    };
}
