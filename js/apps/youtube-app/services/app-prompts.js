/**
 * 萤火 · 往 murmur 注册提示词
 *
 * 折叠区里出现一组「萤火」：
 *   1. 行为边界卡：告诉 AI 这个世界有「萤火」这个视频软件，聊天里可以自然聊到。
 *   2. 动作卡：AI 可以用 `[分享视频:标题:一句话介绍]` 给用户发一张视频卡。
 *      ★ 动作格式必须和 chat-app/services/ai-service.js 的 parser 逐字一致 ——
 *        「注册的说明」和「实际解析」不同源是跨 App 动作最常见的断头路。
 *
 * 三条规矩（购物 / 候鸟踩过）：
 *   - 静态卡必须在 `setup()` 里注册，放 hydrate 的话用户没开过萤火就看不到。
 *   - promptId 发布后不能改（用户启停按 `${appId}::${promptId}` 存盘）。
 *   - content 是真正拼进 system prompt 的正文，不是给用户看的功能说明。
 */

import { PROMPT_IDS } from '../constants.js';

export const YOUTUBE_PROMPTS = [
    {
        promptId: PROMPT_IDS.shared,
        label: '记得萤火这个视频软件',
        category: 'context',
        previewType: 'text',
        previewData: { text: '我昨天在萤火刷到一条好玩的视频。' },
        defaultActive: true,
        defaultOrder: 10,
        content: `【萤火·视频软件】
这个世界有一个叫「萤火」的视频软件，大家在上面发视频、看直播、发弹幕。
  - Behaviors:
    - 聊天中可以自然提到「在萤火刷到什么」「有人开播了」，符合角色的生活习惯就行
    - 不要虚构用户在萤火的具体数据（粉丝数、作品），你没看到就是不知道
    - 用户分享来的视频卡（[视频] 开头的消息）是真的存在的内容，可以就着聊`,
    },
    {
        promptId: PROMPT_IDS.shareAction,
        label: '给用户分享视频',
        category: 'special-action',
        previewType: 'text',
        previewData: { text: '[分享视频:废墟顶楼的日出:爬了三个小时就为这一刻]' },
        defaultActive: true,
        defaultOrder: 20,
        content: `【萤火·分享视频】
你可以给用户分享一条「萤火」上的视频，单独占一行输出：
[分享视频:视频标题:一句话介绍]
  - 标题 8~24 字，介绍 14~30 字，都必须符合当前世界观
  - 只在聊天氛围合适时用（安利、有共鸣、回应对方的话题），不要频繁发
  - 发出后它会变成一张视频卡，用户点开能看到完整内容`,
    },
];

/** setup 时调：注册静态卡 */
export function registerYoutubePrompts(toolkit) {
    if (!toolkit?.prompts?.register) return 0;
    return toolkit.prompts.register(YOUTUBE_PROMPTS);
}
