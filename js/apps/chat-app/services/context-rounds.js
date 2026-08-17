/**
 * chat-app · services/context-rounds.js
 *
 * 「聊天回合」的**唯一口径**。
 *
 * 历史 bug（v0.87 修复）：
 *   原来两处实现（index.js 的 computeContextRoundsPrompt、prompt-builder.js 的
 *   _computeContextRoundsPrompt）都把「连续同一侧的消息块」直接当成一个回合。
 *   于是 `用户说 → AI 答` 被算成 **2 个回合**，用户设 20 回合实际只拿到 10 组来回，
 *   正好是「记录的聊天数据少了一半」。
 *
 *   现在统一为：**1 回合 = 1 组用户消息 + 紧随其后的 1 组 AI 消息**。
 *
 * 这个文件只负责「怎么分组」和「取哪些」，不负责渲染成什么文本 ——
 * 两处调用方的正文格式化逻辑不一样（index.js 支持更多卡片类型），各自保留。
 */

/**
 * 过滤出「今天」的消息并按时间升序。
 * 过滤基准是调用方本地时区的 00:00:00 ~ 23:59:59.999。
 */
export function pickTodayMessages(messages) {
    const list = Array.isArray(messages) ? messages.slice() : [];
    if (list.length === 0) return [];
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    return list
        .filter((m) => {
            const ts = Number(m && m.timestamp) || 0;
            return ts >= dayStart && ts <= dayEnd;
        })
        .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
}

/**
 * 把时间升序的消息切成回合。
 *
 * 规则：
 *   1. 先把连续同一侧的消息合成「块」（用户连发三条 = 一个用户块）
 *   2. 每遇到一个**用户块**就开一个新回合；随后的 AI 块并进同一回合
 *   3. 对话由 AI 起头时（AI 主动发消息），那个 AI 块单独成一个回合
 *
 * 所以正常的 `用户 → AI → 用户 → AI` 是 **2 个回合**，不是 4 个。
 *
 * @param {Array} sortedMessages 已按时间升序、已过滤的消息
 * @returns {Array<Array>} 每个元素是一个回合内的消息数组（保持时间序）
 */
export function groupIntoRounds(sortedMessages) {
    const list = Array.isArray(sortedMessages) ? sortedMessages : [];
    const rounds = [];
    let current = null;
    let lastSide = null;

    for (const m of list) {
        if (!m || m.sender == null) continue;
        // 'ai' 之外的都算用户侧（历史数据里 sender 可能是 'user' / 用户 id）
        const side = m.sender === 'ai' ? 'ai' : 'user';
        // 用户重新开口 = 新回合。AI 那侧永远并入当前回合。
        const startsNewRound = !current || (side === 'user' && lastSide !== 'user');
        if (startsNewRound) {
            current = [];
            rounds.push(current);
        }
        current.push(m);
        lastSide = side;
    }
    return rounds;
}

/**
 * 一步到位：今天的消息 → 最近 N 个回合。
 * @returns {{rounds: Array<Array>, total: number}} total 是今天的回合总数（不受 limit 截断）
 */
export function takeRecentRounds(messages, limit = 20) {
    const today = pickTodayMessages(messages);
    if (today.length === 0) return { rounds: [], total: 0 };
    const all = groupIntoRounds(today);
    const n = Number(limit) > 0 ? Number(limit) : 20;
    return { rounds: all.slice(Math.max(0, all.length - n)), total: all.length };
}

/** 「当前聊天回合」段落的一级标题前缀 —— 替换/剪切都靠它定位，改这里要同步改 ai-service */
export const CONTEXT_ROUNDS_HEADING_PREFIX = '# 当前聊天回合';

/** 统一的段落标题文案 */
export function buildContextRoundsHeading(picked, limit) {
    return `${CONTEXT_ROUNDS_HEADING_PREFIX}(最近 ${picked} / ${limit} 回合，1 回合 = 用户说一次 + AI 回一次)`;
}
