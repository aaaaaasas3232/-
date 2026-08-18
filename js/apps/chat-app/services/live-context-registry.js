/**
 * murmur · 「实时上下文块」注册表
 *
 * ── 它修的是什么 bug ──────────────────────────────────────────────
 *
 * 一起听 / 四叶草 / 灯塔 / 日记这四段是**发送时现算**的:歌词进度、心愿单、
 * 这个月发没发工资、经期第几天,每一项都会在两次打开 prompt 管理页之间变掉,
 * 所以 pre 快照里那份必然过期,`ai-service` 会在发送前把旧段剪掉、拼一份新的。
 *
 * 问题在于这套「剪掉 + 重拼」原来只写在 `ai-service` 里,而**预览只画了其中两段**
 * (一起听、日记)。结果:
 *
 *   - 四叶草和灯塔的正文从来没在「当前上下文」出现过,用户看不见,更没有开关 ——
 *     心愿单和工作近况被无声地发给了每一个 AI;
 *   - 一起听 / 日记虽然画了卡,但那两张卡也没有开关,关不掉。
 *
 * 现在四段只在这里声明一次:
 *
 *   - `prompt-manager` 用它画卡片 + 拼进 pre(所以用户看得见、能关)
 *   - `ai-service`     用它剪旧段 + 拼新段(所以 AI 收到的是最新的那份)
 *
 * 两端读同一份声明、同一份开关,「预览里关掉了发送时照样发」这类事从结构上不成立。
 *
 * ── 供给方约定 ────────────────────────────────────────────────────
 *
 * 各 App 自己挂 `window.<globalKey>`,形状固定为:
 *
 *   { heading, getContext(aiPersonId) -> string, isActive(aiPersonId) -> bool, strip(text) -> text }
 *
 * App 没装 / 没配置时 `getContext` 返回空串,这里就当这段不存在 —— 全链路 optional
 * chaining,卸载任何一个 App 都不会把聊天带下水。
 */

import { stripPromptBlock } from './prompt-tags.js';

/**
 * @typedef {object} LiveContextBlock
 * @property {string} id        卡片 id(contextOrder / 卡片开关按它存盘,**发布后别改**)
 * @property {string} tag       pre 里的成对标签名,必须和 ai-service 重拼时用的一致
 * @property {string} title     「当前上下文」里显示的标题
 * @property {string} group     归到「可用 Prompt」的哪个折叠组(= appId)
 * @property {string} globalKey window 上的供给方 key
 * @property {string} desc      折叠组里的一句话说明
 */

/** @type {LiveContextBlock[]} */
export const LIVE_CONTEXT_BLOCKS = [
    {
        id: 'listen-together',
        tag: '一起听',
        title: '一起听（实时）',
        group: 'music',
        globalKey: '__musicListenTogether',
        desc: '正在一起听时才出现：当前歌、唱到哪句、听了多久',
    },
    {
        id: 'shop-live',
        tag: '四叶草购物',
        title: '四叶草购物（实时）',
        group: 'shop',
        globalKey: '__shopContext',
        desc: '心愿单近况。每个 AI 看到的不一样，匿名礼物不会互相泄漏',
    },
    {
        id: 'job-live',
        tag: '灯塔求职',
        title: '灯塔求职（实时）',
        group: 'job',
        globalKey: '__jobContext',
        desc: '在职状态与最近几天的工作。同事知道细节，无关的人只知道一句',
    },
    {
        id: 'diary-live',
        tag: '日记本',
        title: '日记本（实时）',
        group: 'diary',
        globalKey: '__diaryContext',
        desc: '经期第几天、倒计时还剩几天这类每天都会变的数字',
    },
];

function getProvider(block) {
    if (typeof window === 'undefined') return null;
    try {
        return window[block.globalKey] || null;
    } catch (_) {
        return null;
    }
}

/**
 * 现算所有实时块的正文。
 *
 * @param {string} aiPersonId
 * @param {object} [opts]
 * @param {(block: LiveContextBlock) => boolean} [opts.isEnabled]
 *        用户开关。返回 false 的块**连正文都不算**(省掉一次可能不便宜的 getContext)。
 * @returns {Array<LiveContextBlock & { content: string }>} 只含正文非空的块，顺序同声明顺序
 */
export function collectLiveContextBlocks(aiPersonId, { isEnabled } = {}) {
    const out = [];
    for (const block of LIVE_CONTEXT_BLOCKS) {
        if (typeof isEnabled === 'function' && !isEnabled(block)) continue;
        const provider = getProvider(block);
        if (!provider?.getContext) continue;
        let content = '';
        try {
            content = String(provider.getContext(aiPersonId) || '').trim();
        } catch (err) {
            console.warn('[chat-live-context] getContext 失败', block.id, err);
            continue;
        }
        if (!content) continue;
        out.push({ ...block, content });
    }
    return out;
}

/**
 * 把 pre 里所有实时块整段剪掉(不管开关状态,一律剪 —— 剪完由调用方决定拼不拼回来)。
 *
 * 供给方自带 `strip` 时先用它(它认得自己的历史格式,比如没有标签的老快照),
 * 之后再按标签兜一刀,保证新老两种写法都能剪干净。
 */
export function stripLiveContextBlocks(text) {
    let src = String(text || '');
    for (const block of LIVE_CONTEXT_BLOCKS) {
        const provider = getProvider(block);
        if (provider?.strip) {
            try {
                src = String(provider.strip(src) || '');
            } catch (err) {
                console.warn('[chat-live-context] strip 失败', block.id, err);
            }
        }
        src = stripPromptBlock(src, block.tag);
    }
    return src;
}

/** 声明里有没有这个 id(prompt-tags 的标签解析要用) */
export function findLiveContextBlock(id) {
    const key = String(id || '');
    return LIVE_CONTEXT_BLOCKS.find((b) => b.id === key) || null;
}

export default { LIVE_CONTEXT_BLOCKS, collectLiveContextBlocks, stripLiveContextBlocks, findLiveContextBlock };
