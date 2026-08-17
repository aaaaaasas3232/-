/**
 * 小奇怪 · Prompt 组装(唯一真相)
 *
 * ── 和湛蓝回忆是同一套 ────────────────────────────────────────────
 *
 * 只有一个 `buildContextParts()`。它产出一组 part;
 * 「上下文」面板渲染这组 part,发送时把**同一组** part 交给 composer。
 *
 *   const { text, parts } = buildPrompt(ctx, { save: true });
 *   //      ↑ 发给 AI     ↑ 给用户看
 *
 * 两者是同一次调用的两个返回字段,**物理上不可能不一致**。
 * 段落开关 = `library.contextConfig[sectionId]`,面板里点一下立刻影响发送。
 *
 * ── 相对原型 ──────────────────────────────────────────────────────
 *
 * 原型(`QAQ/小奇怪/小游戏你又我`)的 prompt 是两条各写各的字符串:
 * `AI_PROMPTS[aiName]` 里塞死人设,轮到谁再用 `prompt += "\n现在轮到你了…"`
 * 现拼一段。人设改不了、段落关不掉、用户也看不见发出去的到底是什么。
 * 现在人设从 nook 现读,段落可开关,发送内容随时能看。
 *
 * ── 写 prompt 的风格 ──────────────────────────────────────────────
 *
 * 对齐 murmur / 湛蓝回忆(`docs/跨App注册Prompt指导方案.md` §5.1):
 *
 *   XX须知:
 *     - Principle: 一句话说清这段干嘛的
 *     - Behaviors:
 *       - 具体动作
 *       - 边界条件
 *
 * Principle 一条,Behaviors 三到六条,**不铺陈背景**。
 */

import { createContextComposer } from '@/src/core/context-composer.js';
import { CONTEXT_SECTIONS, HY, HY_RULES } from '../constants.js';
import { asArray, truncate } from '../utils.js';
import * as nook from './nook-bridge.js';

const composer = createContextComposer({ namespace: 'oddity' });

export { composer };

// ============================================================
// 各段正文
// ============================================================

function buildSystemPart({ seat }) {
    return `扮演须知:
  - Principle: 你在一张牌桌上扮演「${seat?.name || '一位玩家'}」玩「你有我没有」,直接以这个身份出牌,不要解释你在扮演。
  - Behaviors:
    - 只说这个角色会说的话,语气、用词、口头禅都按【你是谁】里的设定来
    - 一次只做**一件事**:该出声明就出声明,该表态就表态,不要顺带评论别人
    - 台词短。这是牌桌上的一句话,不是独白,${HY.claimMaxChars} 字以内
    - 想赢,但不要认真到扫兴 —— 输一条命也照样有反应
    - 不要提「AI」「模型」「提示词」,也不要复述规则`;
}

function buildWorldPart({ world }) {
    return nook.describeWorld(world);
}

function buildSeatPart({ seat, aiCard }) {
    const detail = nook.describeAi(aiCard);
    const head = `你现在是【${seat?.name || 'AI'}】,还剩 ${seat?.lives ?? 0} 点命。`;
    return [head, detail].filter(Boolean).join('\n');
}

/**
 * 同桌的人。
 *
 * 只给名字 + 剩余命数 + 一句话人设 —— 完整人设全塞进去会把 token 吃光,
 * 而且对「猜他有没有」这件事没有帮助:真正有用的是「他还剩几条命」。
 */
function buildRivalsPart({ state, seat }) {
    const others = asArray(state?.seats).filter((s) => s.id !== seat?.id);
    if (!others.length) return '';
    const lines = others.map((other) => {
        const card = other.kind === 'ai' && other.aiId ? nook.getAi(other.aiId) : null;
        const tag = other.alive ? `${other.lives} 点` : '已出局';
        const brief = card?.personality ? ` — ${truncate(card.personality, 30)}` : '';
        const who = other.kind === 'user' ? '(真人)' : '';
        return `- ${other.name}${who}:${tag}${brief}`;
    });
    return lines.join('\n');
}

function buildRulesPart() {
    return `规则:
${HY_RULES.map((line) => `  ${line}`).join('\n')}

注意: 判定由程序做,你不需要算分,也不要宣布谁赢了。`;
}

/**
 * 已经出过的声明。
 *
 * ★ 这一段是整个 prompt 里最要紧的:不给它,模型会反复说同一句,
 *   然后被判重扣血,玩家看到的是「这个 AI 好像有点傻」。
 */
function buildUsedPart({ state }) {
    const used = asArray(state?.log)
        .filter((entry) => entry.kind === 'claim')
        .map((entry) => entry.text)
        .slice(-24);
    if (!used.length) return '';
    return `这些已经被说过了,**换一个方向**:\n${used.map((line) => `- ${line}`).join('\n')}`;
}

/** 最近几轮实况 —— 语气和称呼要接得上 */
function buildRecentPart({ state, window = 14 }) {
    const lines = asArray(state?.log).slice(-window).map((entry) => entry.text);
    if (!lines.length) return '';
    return lines.join('\n');
}

function buildCustomPart({ customPrompts }) {
    const list = asArray(customPrompts).filter((p) => p.enabled && String(p.content || '').trim());
    if (!list.length) return '';
    return list.map((p) => (p.title ? `【${p.title}】\n${p.content.trim()}` : p.content.trim())).join('\n\n');
}

/**
 * 输出格式。
 *
 * ★ 只要 JSON,不要围栏、不要解释。解析走 `parseLooseJson`,
 *   它能剥围栏也能从一坨废话里抠出 `{...}`,但**抠不出根本没有的字段** ——
 *   所以字段名要在这里写死,并且给一个完整示例。
 */
function buildFormatPart({ kind }) {
    if (kind === 'respond') {
        return `输出格式须知:
  - Principle: 只输出一个 JSON 对象,解析器只认这两个字段,多一个字都会被丢掉。
  - Behaviors:
    - has: 布尔值。你这个角色**确实有**这件事就 true,没有就 false
    - line: 一句话反应,15 字以内,用你自己的口吻,不要复述问题
    - 按人设诚实作答,不要为了赢乱说;但如果角色本来就爱吹牛,那随他
    - 不要围栏、不要前后废话

示例:
{"has": false, "line": "这我真没有,你从哪儿听来的。"}`;
    }
    return `输出格式须知:
  - Principle: 只输出一个 JSON 对象,解析器只认这两个字段,多一个字都会被丢掉。
  - Behaviors:
    - claim: 你要声明的那件事,**不要**带「我有」两个字,直接写内容,${HY.claimMaxChars} 字以内
    - line: 说这句时的一句话神态或补充,15 字以内
    - claim 要具体、可判断,别写「有过很多经历」这种没法回答的
    - 不能和【已出过的声明】里的任何一条撞
    - 不要围栏、不要前后废话

示例:
{"claim": "在便利店门口站着把关东煮吃完过", "line": "别笑,那天真的很饿。"}`;
}

// ============================================================
// 组装
// ============================================================

/**
 * 收集这次生成要用到的全部外部数据。
 *
 * 单独抽出来是因为**上下文面板和发送都要它** —— 各读各的就会出现
 * 「面板里显示了这个人设,实际发出去是另一个」。
 */
export function collectSources({ state, seat, library } = {}) {
    const playerCard = nook.getPlayerCard('');
    const world = nook.getWorld('', playerCard);
    const aiCard = seat?.aiId ? nook.getAi(seat.aiId) : null;
    return {
        playerCard,
        world,
        aiCard,
        customPrompts: asArray(library?.customPrompts),
        state,
        seat,
    };
}

/**
 * 产出这次生成的全部上下文段落。
 *
 * **上下文面板和发送共用这一个函数** —— 整个 prompt 层最重要的一条约束。
 */
export function buildContextParts(ctx = {}) {
    const { sources, config = {}, kind = 'claim' } = ctx;
    if (!sources) return [];

    const bodies = {
        system: buildSystemPart({ seat: sources.seat }),
        world: buildWorldPart({ world: sources.world }),
        seat: buildSeatPart({ seat: sources.seat, aiCard: sources.aiCard }),
        rivals: buildRivalsPart({ state: sources.state, seat: sources.seat }),
        rules: buildRulesPart(),
        used: buildUsedPart({ state: sources.state }),
        recent: buildRecentPart({ state: sources.state }),
        custom: buildCustomPart({ customPrompts: sources.customPrompts }),
        format: buildFormatPart({ kind }),
    };

    return CONTEXT_SECTIONS.map((meta) => ({
        id: meta.id,
        title: meta.label,
        tag: meta.tag,
        content: bodies[meta.id] || '',
        // locked 段不给关 —— 关掉「扮演须知」和「输出格式」之后 AI 会开始写散文,
        // JSON 一条都解析不出来,表现是「这个座位一直被跳过」
        active: meta.locked ? true : config[meta.id] !== false,
        locked: meta.locked === true,
        source: meta.desc,
    }));
}

/**
 * 拼出最终 system prompt。
 *
 * `opts.save` 控制要不要写快照:发送时写(留一份「上次发出去的是什么」),
 * 面板预览时**不写** —— 预览是个 computed,每次重渲染都写一遍 localStorage
 * 既浪费又会把真正发出去的那份快照冲掉。
 *
 * 注意两条路径走的是**同一个函数**,只是要不要落快照的差别 ——
 * 「预览 == 发送」这条约束没有被破坏。
 *
 * @returns {{ text:string, parts:Array, stats:object }}
 */
export function buildPrompt(ctx = {}, opts = {}) {
    const parts = buildContextParts(ctx);
    const composeOpts = {
        order: asArray(ctx.order).length ? ctx.order : undefined,
    };
    if (opts.save === false) return composer.compose(parts, composeOpts);
    const scope = `${ctx.kind || 'claim'}::${ctx.sources?.seat?.id || 'none'}`;
    return composer.composeAndSave(scope, parts, composeOpts);
}

// ============================================================
// 本轮指令
// ============================================================

/**
 * 拼「这一轮要 AI 干什么」。
 *
 * 和 system prompt 分开:system 是设定(每轮基本不变,便于服务端缓存),
 * 这一段才是本轮指令。原型把两者拼成一个巨大字符串塞进 system,
 * 既浪费缓存,也让模型分不清「设定」和「现在要我干嘛」。
 */
export function buildUserTurn({ kind, claimText, claimerName, roundNo } = {}) {
    if (kind === 'respond') {
        return [
            `${claimerName || '有人'}说:「我有${claimText || '某件事'},你们没有。」`,
            '你有没有这件事?按你的人设诚实回答,然后甩一句话。只输出 JSON。',
        ].join('\n');
    }
    return [
        `第 ${roundNo || 1} 轮,轮到你出声明。`,
        '说一件你有、而且你觉得桌上其他人多半没有的事。越具体越好,别人一听就知道该怎么答。只输出 JSON。',
    ].join('\n');
}

/** 读上一次拼好的快照(「上次发出去的是什么」) */
export function readLastPrompt(kind, seatId) {
    return composer.load(`${kind || 'claim'}::${seatId || 'none'}`);
}
