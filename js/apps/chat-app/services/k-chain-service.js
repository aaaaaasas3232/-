/**
 * chat-app · K 链记忆(业务层)
 *
 * SDK(`settingsSdk.kChain`)只管存。这里负责三件事:
 *
 *   1. **数回合** —— 用项目统一的回合口径(`context-rounds.js`),
 *      1 回合 = 1 组用户消息 + 紧随其后的 1 组 AI 消息
 *   2. **拼 prompt** —— 两段:当前记忆(总是带)、生成指令(**只在该压缩时才带**)
 *   3. **抠摘要** —— AI 回复里的 `[记忆:...]` token,落进链条,不显示成气泡
 *
 * ── 为什么搭在正常回复上,而不是单独调一次 API ─────────────────────
 *
 * 上一版 K 链是「攒够 N 轮 → 单独发一次压缩请求」。三个问题:
 * 翻倍花钱、多一条会失败的链路、而且失败时用户完全不知道
 * (后台 Promise 挂了,界面上什么都没变)。
 *
 * 现在:该压缩的那一轮,在 system prompt 末尾多挂一段
 * 「顺手把记忆更新一下,写在回复最后」。AI 一次调用同时产出回复和摘要。
 * 摘要没生成也不影响这次聊天 —— 下一轮会再要一次。
 *
 * ── 为什么「不够轮数就不拼那段指令」 ──────────────────────────────
 *
 * 用户明确要求的省 token 点。那段指令本身两百来字,每一轮都带上,
 * 而 20 轮里只有 4 轮真的需要它 —— 剩下 16 轮就是纯浪费。
 * `buildRequestBlock()` 在不该压缩时返回空串,调用方拿到空串就不拼。
 *
 * ── 时序 ──────────────────────────────────────────────────────────
 *
 *   发送前:  countPending() → 够了就把「生成指令」拼进 systemPrompt
 *   收到后:  parseAiResponse 抠出 [记忆:...] → ingest() → 新 K 入链,lastAt 推到现在
 *   下一轮:  countPending() 从 lastAt 之后重新数,回到 0
 */

import { groupIntoRounds } from './context-rounds.js';

/** 段落标签 —— 剪切/替换靠它定位,改这里要同步改 ai-service 的注入处 */
export const KCHAIN_TAG = 'K链记忆';
export const KCHAIN_REQUEST_TAG = 'K链生成';

/** AI 用这个 token 把摘要交回来 */
export const KCHAIN_TOKEN = '记忆';

function sdk() {
    return (typeof window !== 'undefined' && window.settingsSdk) || null;
}

function api() {
    return sdk()?.kChain || null;
}

function normalizeMode(mode) {
    return mode === 'story' ? 'story' : 'calendar';
}

// ============================================================
// 数回合
// ============================================================

/**
 * 拉这个会话的消息。
 *
 * 失败返回空数组 —— 读不到消息时应该表现成「一轮都没攒」(不触发压缩),
 * 而不是「攒够了」(拿着空上下文去生成摘要,会写出一段瞎编的记忆)。
 */
function readMessages(aiPersonId, mode) {
    try {
        const s = sdk();
        const user = s?.defaultUserCard?.getDefault?.() || s?.users?.getActive?.();
        if (!user) return [];
        const list = s?.chatMessages?.list?.(user, aiPersonId, normalizeMode(mode));
        return Array.isArray(list) ? list : [];
    } catch (err) {
        console.warn('[k-chain] 读消息失败', err);
        return [];
    }
}

/**
 * 距上次压缩过了几个回合。
 *
 * ★ 按 `lastAt` **现算**,不维护计数器。
 *   计数器一旦和真实消息对不上(重 roll、删消息、切设备)就永远错下去,
 *   而且错了没有任何迹象。现算的代价是每轮遍历一次消息列表,可以忽略。
 */
export function countPending(aiPersonId, mode, messages) {
    const a = api();
    if (!a) return 0;
    const slot = a.getSlot(aiPersonId, mode);
    const list = (Array.isArray(messages) ? messages : readMessages(aiPersonId, mode))
        .filter((m) => (Number(m?.timestamp) || 0) > (Number(slot.lastAt) || 0))
        .sort((x, y) => (Number(x.timestamp) || 0) - (Number(y.timestamp) || 0));
    if (!list.length) return 0;
    return groupIntoRounds(list).length;
}

/** 现在该不该让 AI 顺手生成一份摘要 */
export function shouldRequest(aiPersonId, mode, messages) {
    const a = api();
    if (!a) return false;
    const cfg = a.getConfig(aiPersonId);
    if (!cfg.enabled) return false;
    return countPending(aiPersonId, mode, messages) >= cfg.windowSize;
}

// ============================================================
// 拼 prompt
// ============================================================

/** 当前记忆段 —— 有内容就带上,和该不该压缩无关 */
export function buildContextBlock(aiPersonId, mode) {
    const a = api();
    if (!a) return '';
    if (!a.getConfig(aiPersonId).enabled) return '';
    const slot = a.getSlot(aiPersonId, mode);
    const content = String(slot.current?.content || '').trim();
    if (!content) return '';
    return [
        `这是你们之前聊过的内容压缩成的记忆(第 ${slot.current.index} 版,已覆盖 ${slot.current.rounds} 个回合):`,
        content,
    ].join('\n');
}

/**
 * 生成指令段 —— **不该压缩时返回空串**。
 *
 * 写法对齐项目里那套(`Principle` 一条 + `Behaviors` 三到六条),
 * 和 murmur 其他段落读起来是一个语气。
 */
export function buildRequestBlock(aiPersonId, mode, pending) {
    const a = api();
    if (!a) return '';
    const cfg = a.getConfig(aiPersonId);
    if (!cfg.enabled) return '';
    const rounds = Number.isFinite(pending) ? pending : countPending(aiPersonId, mode);
    if (rounds < cfg.windowSize) return '';

    const slot = a.getSlot(aiPersonId, mode);
    const prev = String(slot.current?.content || '').trim();

    return `记忆更新须知:
  - Principle: 这一轮除了正常回复,还要在**最末尾**用 [${KCHAIN_TOKEN}:内容] 交回一份更新后的记忆。
  - Behaviors:
    - 把上面那份旧记忆和这 ${rounds} 个回合**合并重写成一段连续的话**,不要写成「旧记忆 + 新增」两截
    - 必须留下: 说定了什么、关系怎么变的、对方的偏好和忌讳、还悬着没解决的事
    - 必须丢掉: 寒暄、语气词、重复出现的情绪、已经过去且不会再提的琐事
    - 用第三人称写,人名写全,控制在 300 字以内
    - [${KCHAIN_TOKEN}:…] 单独成段放在回复的最后,前后**绝不**加「|」
    - 它不会显示给用户看,所以不要在正常回复里提「我记下了」这类话
${prev ? `\n旧记忆(第 ${slot.current.index} 版):\n${prev}` : '\n(还没有旧记忆,这是第一份。)'}`;
}

// ============================================================
// 收摘要
// ============================================================

/**
 * 把 AI 交回来的摘要落进链条。
 *
 * @param {string} aiPersonId
 * @param {'calendar'|'story'} mode
 * @param {string} text     从 `[记忆:...]` 里抠出来的正文
 * @param {number} rounds   这一版覆盖了几个回合(显示用)
 * @param {number} lastAt   这一轮最后一条消息的时间戳 + 1 —— 计数的新起点。
 *                          必须由调用方给,理由见 SDK `applySummary` 的注释
 *                          (简单用 Date.now() 会把刚压缩掉的这一轮又数一遍)。
 */
export async function ingest(aiPersonId, mode, text, rounds, lastAt) {
    const a = api();
    const content = String(text || '').trim();
    if (!a || !content) return null;
    try {
        const saved = await a.applySummary(aiPersonId, mode, content, rounds, lastAt);
        if (saved) {
            console.log(`[k-chain] 第 ${saved.index} 版记忆已更新(覆盖 ${saved.rounds} 回合,${content.length} 字)`);
        }
        return saved;
    } catch (err) {
        // 落盘失败不能影响这一轮聊天 —— 下一轮 pending 还是够,会再要一次
        console.warn('[k-chain] 写入记忆失败,下一轮会重试', err);
        return null;
    }
}

// ============================================================
// 给 ai-service 用的全局挂载
// ============================================================

/**
 * 挂 `window.__chatKChain`。
 *
 * 和一起听 / 四叶草 / 灯塔同一个模式:发送时现算再拼进 systemPrompt。
 * 走全局而不是 import,是因为 `ai-service` 已经在用这套写法,
 * 而且这几段的共同点是「pre 快照必然过期,必须发送时算」(AGENTS2 §4.1)。
 */
export function installKChainBridge() {
    if (typeof window === 'undefined') return;
    window.__chatKChain = {
        tag: KCHAIN_TAG,
        requestTag: KCHAIN_REQUEST_TAG,
        countPending,
        shouldRequest,
        getContext: buildContextBlock,
        getRequest: buildRequestBlock,
        ingest,
    };
}

export default {
    KCHAIN_TAG,
    KCHAIN_REQUEST_TAG,
    KCHAIN_TOKEN,
    countPending,
    shouldRequest,
    buildContextBlock,
    buildRequestBlock,
    ingest,
    installKChainBridge,
};
