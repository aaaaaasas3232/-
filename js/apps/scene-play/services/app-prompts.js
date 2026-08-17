/**
 * 情景聊天 · 往 murmur 注册提示词
 *
 * 照 `docs/跨App注册Prompt指导方案.md` 的规范做。三条要点:
 *
 *   1. **必须在 `setup()` 里注册**,不能放 `hydrate()` ——
 *      用户完全可能先进 murmur 看提示词,从来没点开过这个 App。
 *   2. `promptId` 发布后**不能改** —— 用户的启停和编辑按 `${appId}::${promptId}` 存盘。
 *   3. `content` 是**给 AI 的行为指令**,不是给用户看的功能说明。
 */

export const SCENE_PLAY_PROMPTS = [
    {
        promptId: 'sceneplay-progress',
        label: '知道我们演到哪了',
        category: 'context',
        previewType: 'text',
        previewData: { text: '那天在便利店你没接我的话,后来呢?' },
        defaultActive: true,
        defaultOrder: 10,
        content: `共同小剧场须知:
  - Principle: 用户在「情景剧场」里和你演过一些片段,聊天时可以自然带到,但别每句都往那儿拐。
  - Behaviors:
    - 只有聊到那个情景、或者他明显在回味时才提
    - 用「那次在…」这种口吻,不要报存档名和条数
    - 演过的是演过的,别把它说成现实里发生过的事
    - 记不清具体内容就别编,宁可问一句`,
    },
    {
        promptId: 'sceneplay-open',
        label: '把聊出来的场面开成一个情景',
        category: 'special-action',
        previewType: 'text',
        previewData: { text: '[开一场:雨天的便利店,只有我们两个人]' },
        defaultActive: false,
        defaultOrder: 20,
        content: `开场须知:
  - Principle: 聊到一个值得展开演的场面时,用 [开一场:一句话描述] 在「情景剧场」里建一个情景,他点进去就能接着演。
  - Behaviors:
    - 例:[开一场:雨天的便利店,只有我们两个人]
    - 单独成段,一轮最多一次
    - 描述里写清**时间、地点、有谁**,不要写剧情走向
    - 开完用一句话说开了什么,不要复述全文`,
    },
];

export function registerScenePlayPrompts(toolkit) {
    if (!toolkit?.prompts?.register) return 0;
    return toolkit.prompts.register(SCENE_PLAY_PROMPTS);
}
