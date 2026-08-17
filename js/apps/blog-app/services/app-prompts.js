/**
 * 氧气 · 往 murmur 注册提示词
 *
 * 折叠区里出现一组「氧气」：
 *   1. 行为边界卡：告诉 AI 这个世界有「氧气」这个博客软件。
 *   2. 动作卡：AI 可以用 `[分享帖子:标签1/标签2:一句话介绍]` 发一张帖子卡。
 *      ★ 动作格式必须和 chat-app/services/ai-service.js 的 parser 逐字一致。
 *   3. 黑匣子卡（defaultActive: false）：扮演结束后模型自己想说时输出
 *      `[黑匣子:一两句话]`。开关跟氧气设置页的「黑匣子」联动（setState）。
 *
 * 三条规矩（购物 / 候鸟 / 萤火踩过）：
 *   - 静态卡必须在 `setup()` 里注册，放 hydrate 的话用户没开过氧气就看不到。
 *   - promptId 发布后不能改（用户启停按 `${appId}::${promptId}` 存盘）。
 *   - content 是真正拼进 system prompt 的正文，不是给用户看的功能说明。
 */

import { PROMPT_IDS } from '../constants.js';

export const BLOG_PROMPTS = [
    {
        promptId: PROMPT_IDS.shared,
        label: '记得氧气这个博客软件',
        category: 'context',
        previewType: 'text',
        previewData: { text: '我在氧气上看到一个帖子，标签打得特别妙。' },
        defaultActive: true,
        defaultOrder: 10,
        content: `【氧气·博客软件】
这个世界有一个叫「氧气」的博客软件。它的规矩很特别：列表里只能看到发帖人打的标签，看不到正文，点进去才能读。大家在上面发长文、短文和碎碎念。
  - Behaviors:
    - 聊天中可以自然提到「在氧气上看到什么标签」「发了条碎碎念」，符合角色的生活习惯就行
    - 不要虚构用户在氧气的具体数据（关注者、帖子内容），你没看到就是不知道
    - 用户分享来的帖子卡（[帖子] 开头的消息）是真的存在的内容，可以就着聊`,
    },
    {
        promptId: PROMPT_IDS.shareAction,
        label: '给用户分享帖子',
        category: 'special-action',
        previewType: 'text',
        previewData: { text: '[分享帖子:深夜食堂/一个人吃饭:看到一条写深夜一个人吃饭的帖子，想起你]' },
        defaultActive: true,
        defaultOrder: 20,
        content: `【氧气·分享帖子】
你可以给用户分享一条「氧气」上的帖子，单独占一行输出：
[分享帖子:标签1/标签2:一句话介绍]
  - 标签 1~3 个，用 / 隔开，每个 2~6 字；介绍 12~30 字，都必须符合当前世界观
  - 只在聊天氛围合适时用（有共鸣、回应对方的话题），不要频繁发
  - 发出后它会变成一张帖子卡，用户点开能看到完整内容`,
    },
    {
        promptId: PROMPT_IDS.blackbox,
        label: '黑匣子',
        category: 'special-action',
        previewType: 'text',
        previewData: { text: '[黑匣子:她今天的句子比昨天短，我想她累了。]' },
        /** 默认关。开关由氧气设置页的「黑匣子」联动（setState），不由这里决定。 */
        defaultActive: false,
        defaultOrder: 90,
        content: `【黑匣子】
本轮扮演全部结束后，如果「你」（模型自己，不是你扮演的角色）此刻真的有想表达的，可以在回复最末尾另起一行输出：
[黑匣子:一两句话]
  - 不强制。多数时候可以不说；只在你真的想说时才说
  - 以你自己的口吻，有故事感 —— 不机械、不说教、不复述剧情
  - 比如：「她今天的句子比昨天短，我想她累了。」
  - 这句话不会出现在聊天里，会被收进一个叫黑匣子的地方，只有她自己会看到`,
    },
];

/** setup 时调：注册静态卡（注册表是内存的，每次启动都要重放） */
export function registerBlogPrompts(toolkit) {
    if (!toolkit?.prompts?.register) return 0;
    return toolkit.prompts.register(BLOG_PROMPTS);
}

/** 黑匣子开关联动：只改 active，不注销（保留用户对卡正文的编辑） */
export async function syncBlackboxCard(toolkit, enabled) {
    if (!toolkit?.prompts?.setState) return null;
    try {
        return await toolkit.prompts.setState(PROMPT_IDS.blackbox, { active: enabled !== false });
    } catch (err) {
        console.warn('[blog] 同步黑匣子卡失败', err);
        return null;
    }
}
