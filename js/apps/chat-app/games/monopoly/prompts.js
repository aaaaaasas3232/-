/**
 * 大富翁 / 提示词
 *
 * AI 在这个游戏里只有两类决策：买不买、要不要加房。
 *
 * ★ 原型的 AI 完全没有决策 —— `aiRollMonopolyDice` 直接调 `rollMonopolyDice()`，
 *   「自由选择」那一格用 `Math.random() > 0.5`。它调 AI 只是为了生成
 *   真心话大冒险的**文案**，跟胜负毫无关系。
 *   加上经济系统之后 AI 必须真的会算账，否则用户在跟一堵墙玩。
 *
 * 决策类请求要求 AI 输出 JSON —— 结构化决策比自然语言好解析得多，
 * 而且解析失败时可以干脆地回落到启发式，不会把乱码当成决定。
 */

import { formatMoney, netWorth, estatesOf, baseRent } from './rules.js';
import { tileAt } from './board.js';

function situation(session, me) {
    const rows = (session.players || []).map((p) => {
        const own = estatesOf(session, p.id).map((e) => tileAt(e.index).name);
        return `${p.name}${p.id === me.id ? '（你）' : ''}：现金 ${formatMoney(p.money)}，净资产 ${formatMoney(netWorth(session, p))}，地产 ${own.length ? own.join('、') : '无'}${p.bankrupt ? '，已破产' : ''}`;
    });
    return rows.join('\n');
}

function base(session, me) {
    return `你正在和熟人们玩大富翁。你不是助手，你就是这局里的一个玩家。

【你是谁】
你是「${me.name}」。${me.personality ? `你的性格：${me.personality}` : ''}

【场上情况】
第 ${session.round} 轮（共 ${session.maxRounds} 轮，到时按净资产排名）
${situation(session, me)}

对局须知:
  - Principle: 目标是让自己净资产最高，或者把对手逼破产。
  - Behaviors:
    - 现金要留够，被收一次高额租金就破产是最蠢的死法。
    - 能集齐一整组地就尽量集齐，整组的租金翻倍。
    - 只按要求的格式输出，不要解释。`;
}

/** 买不买这块地。 */
export function buyPrompt(session, me, tile) {
    const groupTiles = tile.group
        ? `这块地属于「${tile.group}」组，集齐整组租金翻倍。`
        : '这是公用事业，两个都拿到租金翻倍。';
    return {
        system: base(session, me),
        user: `你停在了「${tile.name}」，售价 ${formatMoney(tile.price)}，你现在有 ${formatMoney(me.money)}。
${groupTiles}
买下之后别人停这里要付你约 ${formatMoney(baseRent(tile))} 起的租金。

只输出 JSON，不要别的：
{"buy": true 或 false, "say": "一句不超过 20 字的话"}`,
    };
}

/** 加不加房。 */
export function upgradePrompt(session, me, tile, cost) {
    return {
        system: base(session, me),
        user: `你停在自己的「${tile.name}」，而且已经集齐了整组。加一栋房要 ${formatMoney(cost)}，加完租金会明显上涨。
你现在有 ${formatMoney(me.money)}。

只输出 JSON，不要别的：
{"upgrade": true 或 false, "say": "一句不超过 20 字的话"}`,
    };
}

/** 破产 / 收租 / 抽卡时随口说一句，纯氛围。 */
export function reactPrompt(session, me, event) {
    return {
        system: base(session, me),
        user: `刚刚发生了：${event}
用一句不超过 20 字的话反应一下。直接说，不要引号不要前缀。`,
    };
}

/** 结束后的复盘。 */
export function reviewPrompt(session, me, userSaid) {
    return {
        system: `${base(session, me)}

【复盘】这局结束了：${session.result?.summary || ''}`,
        user: userSaid
            ? `有人说：「${userSaid}」。用 1 句话接话。直接说，不要前缀。`
            : `用 1 句话吐槽这局。直接说，不要前缀。`,
    };
}
