/**
 * chat-app · services/prompt-tags.js
 *
 * ★ 2026-08-13:段落标签的实现已提升到框架层 `src/core/context-composer.js`。
 *   梦境编织也要用同一套 `<XX开始>` / `<XX结束>` 约定,再抄一份必然分叉
 *   (AGENTS2 §9.2「同一业务口径出现第二份实现的那一刻就该抽文件」)。
 *
 *   本文件退化成 **shim + chat 专属的标签名映射**:
 *     - wrap/strip/replace/has/sanitize  → 直接 re-export 框架实现,语义完全不变
 *     - resolveTagName                   → 留在这里,因为它映射的是 chat 的卡片 id/source
 *
 *   chat 内部所有老 import 路径一个字都不用改。
 *
 * 为什么要包标签(原注释保留):
 *   pre 是十几张卡片的正文用 `\n\n` 拼起来的一大坨。每段自己有 `#` 一级标题,
 *   但 AI 经常把相邻两段的内容串在一起(尤其「用户朋友圈」和「AI 朋友圈概要」)。
 *   显式边界标签能让模型清楚知道「这段到此为止」。
 *
 *   附带好处:有了成对标签,按段替换/剪切就不用再靠「找到下一个一级标题」这种脆弱启发式。
 *   历史上 `stripListenTogetherBlock` 就因为这个约定,要求那段内部不能出现 `#` 子标题。
 *
 * 兼容性:所有 strip / replace 都保留「找不到标签就退回老的标题定位」的分支,
 * 老用户 localStorage 里那份没有标签的 pre 仍然能被正确处理。
 */

import {
    sanitizeTag,
    openTag,
    closeTag,
    wrapBlock,
    stripBlock,
    replaceBlock,
    readBlock,
    hasBlock,
} from '@/src/core/context-composer.js';

export { sanitizeTag, openTag, closeTag };

// chat 侧的历史函数名 → 框架实现(名字保留,避免改动 20+ 处调用点)
export const wrapPromptBlock = wrapBlock;
export const stripPromptBlock = stripBlock;
export const replacePromptBlock = replaceBlock;
export const readPromptBlock = readBlock;
export const hasPromptBlock = hasBlock;

/** 卡片 source → 标签名。没命中的用卡片标题兜底。 */
const SOURCE_TAG_MAP = {
    'nook-user': '用户人设',
    'nook-ai': 'AI人设',
    'nook-world': '世界观',
    'murmur': '当前聊天回合',
    'reply-format': '回复格式',
    'user-moments': '用户朋友圈',
    'ai-moments': 'AI朋友圈',
    'sticker-library': '表情包库',
    'listen-together': '一起听',
    'shop-live': '四叶草购物',
    'job-live': '灯塔求职',
    'chat-preamble': '对话总则',
    // ★ 必须和 chat-ai-service 里 wrapPromptBlock('日记本', …) 用的名字**完全一致**。
    //   不一致的话:pre 里是 <日记本（实时）开始>，而发送前的 strip 找的是
    //   <日记本开始> —— 剪不掉，于是同一段内容被注入两遍，一份过期一份最新，
    //   模型按哪份说话全看运气。
    'diary': '日记本',
};

/**
 * 卡片 id → 标签名(优先级高于 source)。
 * 实时块那几条的权威声明在 `live-context-registry.js`,这里是同名副本 ——
 * 反过来 import 会成环(registry 依赖本文件的 stripPromptBlock)。改名要两边一起改。
 */
const ID_TAG_MAP = {
    'chat-preamble': '对话总则',
    'context-rounds': '当前聊天回合',
    'context-mode': '当前模式',
    'reply-format': '回复格式',
    'user-moments': '用户朋友圈',
    'ai-moments': 'AI朋友圈',
    'sticker-library': '表情包库',
    'listen-together': '一起听',
    'shop-live': '四叶草购物',
    'job-live': '灯塔求职',
    'diary-live': '日记本',
    'group-info': '群信息',
};

/**
 * 给一张「当前上下文」卡片推导标签名。
 * 卡片自己带 `tag` 时以它为准(实时块就是这么传的),其余按 id → source → 标题兜底。
 * @param {{id?:string, source?:string, title?:string, tag?:string}} card
 */
export function resolveTagName(card) {
    if (!card) return '提示词';
    if (card.tag) return sanitizeTag(card.tag);
    const id = String(card.id || '');
    const source = String(card.source || '');
    if (ID_TAG_MAP[id]) return ID_TAG_MAP[id];
    if (SOURCE_TAG_MAP[source]) return SOURCE_TAG_MAP[source];
    if (source.startsWith('context-mode-')) return '当前模式';
    if (source.startsWith('memory-summary')) return sanitizeTag(card.title || '记忆概要');
    if (id.startsWith('app-prompt::')) return sanitizeTag(card.title || 'App提示词');
    return sanitizeTag(card.title || '提示词');
}
