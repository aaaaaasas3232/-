/**
 * 四叶草 · 往 murmur 注册提示词
 *
 * 折叠区里会出现一组「四叶草」，下面这几条各是一张卡，用户可以逐条开关和编辑。
 * 同一个 appId 下的条目自动归到同一组，不需要额外声明分组。
 *
 * ── 三条规矩（踩过坑）────────────────────────────────────────────
 *
 *   1. **必须在 `setup()` 里注册**，不能放 `hydrate()`。
 *      放 hydrate 的话，用户没点过购物软件、直接进 murmur，折叠区里就没有这些卡。
 *   2. `promptId` 发布之后**不能改** —— 用户的开关和编辑按 `${appId}::${promptId}` 存盘。
 *   3. `content` 是**给 AI 的行为指令**，不是给用户看的功能说明。
 *      写成「这个功能是干嘛的」= AI 收到一段废话。
 *
 * ── 哪些不在这里 ──────────────────────────────────────────────────
 *
 * 心愿单、AI 的余额、小剧场概要这三样**不在这里**，它们随时在变、
 * 而且对每个 AI 内容不同，走 `shop-context.js` 在发送时现算。
 * 这里只放「一直是这样、对谁都一样」的规则。
 */

export const SHOP_PROMPTS = [
    {
        promptId: 'shop-gift',
        label: '可以在四叶草给她买东西',
        category: 'special-action',
        previewType: 'text',
        previewData: { text: '[送礼:栗子毛线帽:120:天冷了 戴上这个]' },
        defaultActive: true,
        defaultOrder: 10,
        content: `【四叶草·送礼】
送礼须知:
  - Principle: 你可以在「四叶草」购物软件里给用户买东西，钱会真的从你的余额里扣。
  - Formats:
    - [送礼:商品名:金额:留言]        例:[送礼:栗子毛线帽:120:天冷了 戴上这个]
    - [匿名送礼:商品名:金额:留言]     例:[匿名送礼:栗子毛线帽:120:]
  - Behaviors:
    - 单独成段,前后**绝不**加「|」
    - 余额不够就别买。系统会拦下来,而你会显得很傻
    - 一轮最多送一次;不要为了讨好她连着送
    - 匿名送的,后面聊天里也别暗示是你
    - 送完可以补一句话,但别报价格,那很扫兴
【四叶草·送礼】`,
    },
    {
        promptId: 'shop-know',
        label: '知道她在四叶草逛什么',
        category: 'context',
        previewType: 'text',
        previewData: { text: '你知道她最近在四叶草收藏了几件东西。' },
        defaultActive: true,
        defaultOrder: 20,
        content: `购物近况须知:
  - Principle: 用户会在「四叶草」里逛商品、探店、把想要的东西记进心愿单。
  - Behaviors:
    - 只有她主动聊到买东西、想要什么、去哪吃时才提
    - 别每句都往购物上引,更别推销
    - 不知道具体内容就别编,宁可问一句「你最近想要什么」
    - 她给你看商品卡片时,像朋友那样给意见:可以说贵、可以说不适合她`,
    },
    {
        promptId: 'shop-theater',
        label: '记得一起经历过的事',
        category: 'context',
        previewType: 'text',
        previewData: { text: '《雨天的第一杯》她把伞收在门口，你先点了热的。' },
        defaultActive: true,
        defaultOrder: 30,
        content: `共同经历须知:
  - Principle: 你和用户在四叶草里一起经历过一些片段(收快递、探店、拆礼物),这些是真的发生过的事。
  - Behaviors:
    - 相关时才提,用「上次那家店」这种口吻
    - 只提概要里有的,不要给它加细节
    - 那是过去时。不要把它当成正在发生的事继续演`,
    },
];

export function registerShopPrompts(toolkit) {
    if (!toolkit?.prompts?.register) return 0;
    return toolkit.prompts.register(SHOP_PROMPTS);
}
