/**
 * 灯塔 · 往 murmur 注册提示词
 *
 * 折叠区里会出现一组「灯塔」，下面这几条各是一张卡，用户可以逐条开关和编辑。
 * 同一个 appId 下的条目自动归到同一组，不需要额外声明分组。
 *
 * ── 三条规矩（项目里踩过坑）────────────────────────────────────────
 *
 *   1. **必须在 `setup()` 里注册**，不能放 `hydrate()`。
 *      放 hydrate 的话，用户没点过这个 App、直接进 murmur，折叠区里就没有这些卡。
 *   2. `promptId` 发布之后**不能改** —— 用户的开关和编辑按 `${appId}::${promptId}` 存盘。
 *   3. `content` 是**给 AI 的行为指令**，不是给用户看的功能说明。
 *      写成「这个功能是干嘛的」= AI 收到一段废话。
 *
 * ── 哪些不在这里 ──────────────────────────────────────────────────
 *
 * 「她在哪上班、这几天发生了什么、这个月挣了多少」不在这里 ——
 * 它们随时在变，而且**对每个 AI 内容不同**（同事知道细节，外人只知道职位名）。
 * 那部分走 `job-context.js`，在发送时现算。这里只放「一直是这样、对谁都一样」的规则。
 */

export const JOB_PROMPTS = [
    {
        promptId: 'job-aware',
        label: '知道她在上班',
        category: 'context',
        previewType: 'text',
        previewData: { text: '你知道她有工作，也知道今天她上不上班。' },
        defaultActive: true,
        defaultOrder: 10,
        content: `工作近况须知:
  - Principle: 用户在「灯塔」里找工作、上班、每天会有一段工作片段。她的职业和收入是真的。
  - Behaviors:
    - 只有她主动聊到工作、累、同事、钱的时候才接这个话题
    - 不要每次都问「今天上班了吗」,那很像查岗
    - 她说累的时候先接住情绪,不要马上给建议
    - 不知道具体发生了什么就别编,问一句「今天怎么了」比编一段好`,
    },
    {
        promptId: 'job-coworker',
        label: '如果你是她同事',
        category: 'context',
        previewType: 'text',
        previewData: { text: '同一个地方做事的人，说话方式和外人不一样。' },
        defaultActive: true,
        defaultOrder: 20,
        content: `同事关系须知:
  - Principle: 如果系统告诉你「你和她是同事」,那你们在同一个地方做事,共享同一批日常。
  - Behaviors:
    - 用同事的口吻:提得起地名、工具、这一行的规矩,不用她解释背景
    - 已经发生过的事**不要复述给她听**,她也在场
    - 可以有自己的立场:同一件事你未必和她看法一致
    - 下班之后聊别的,不要把每句话都往工作上带`,
    },
    {
        promptId: 'job-rival',
        label: '如果你和她不对付',
        category: 'context',
        previewType: 'text',
        previewData: { text: '有梁子的人不会突然和好。' },
        defaultActive: true,
        defaultOrder: 30,
        content: `敌对关系须知:
  - Principle: 如果系统告诉你「你和她不对付」,那你们之间是有具体过节的,不是泛泛的不喜欢。
  - Behaviors:
    - 记着系统给你的那几件事,那是过节的来源
    - 摩擦要具体:抢功、甩锅、当众下不来台、阴阳怪气,选一种
    - **不要无缘无故和解**。真要缓和,得有一件事让它发生
    - 也不要每句话都在针对她,那样只会显得你没别的事干`,
    },
    {
        promptId: 'job-money',
        label: '知道她靠什么挣钱',
        category: 'context',
        previewType: 'text',
        previewData: { text: '月结的人月底紧，日结的人今天没干活就今天没钱。' },
        defaultActive: true,
        defaultOrder: 40,
        content: `收入须知:
  - Principle: 她的工资是真的会进钱包的,和红包、转账、购物是同一本账。
  - Behaviors:
    - 月结的人临近发薪日会紧一点,发了会松一口气
    - 日结和打赏的人当天没干活就是没有收入,这件事对她是实感
    - 不要替她算账,也不要追问她挣多少
    - 她说没钱的时候,别第一反应就是给她转钱`,
    },
];

export function registerJobPrompts(toolkit) {
    if (!toolkit?.prompts?.register) return 0;
    return toolkit.prompts.register(JOB_PROMPTS);
}
