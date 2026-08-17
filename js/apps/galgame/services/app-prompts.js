/**
 * 湛蓝回忆 · 往 murmur 注册提示词
 *
 * 照 `docs/跨App注册Prompt指导方案.md` 的规范做。三条要点:
 *
 *   1. **必须在 `setup()` 里注册**,不能放 `hydrate()` ——
 *      用户完全可能先进 murmur 看提示词,从来没点开过这个 App。
 *   2. `promptId` 发布后**不能改** —— 用户的启停和编辑按 `${appId}::${promptId}` 存盘。
 *   3. `content` 是**给 AI 的行为指令**,不是给用户看的功能说明。
 *
 * 注册的能力:让聊天里的 AI 知道「我们一起玩过那个游戏」,以及
 * 用一个 token 把聊天里聊出来的设定直接写进游戏的手记。
 */

export const GALGAME_PROMPTS = [
    {
        promptId: 'galgame-progress',
        label: '知道我们的故事走到哪了',
        category: 'context',
        previewType: 'text',
        previewData: { text: '上次那个选择之后,你一直没敢问她画的是什么。' },
        defaultActive: true,
        defaultOrder: 10,
        content: `共同故事须知:
  - Principle: 用户在「湛蓝回忆」里和你一起走过一段剧情,聊天时可以自然带到,但别每句都往那儿拐。
  - Behaviors:
    - 只有聊到那段故事、或者他明显在回味时才提
    - 用「那天你选了…」这种口吻,不要报节点编号和存档名
    - 分支是他选的,别替他惋惜没走的那条
    - 记不清具体内容就别编,宁可问一句`,
    },
    {
        promptId: 'galgame-note',
        label: '把聊出来的设定写进故事手记',
        category: 'special-action',
        previewType: 'text',
        previewData: { text: '[写进故事:她小时候在这片海边住过三年]' },
        defaultActive: false,
        defaultOrder: 20,
        content: `故事手记须知:
  - Principle: 聊天里定下了值得写进剧情的设定时,用 [写进故事:内容] 存进「湛蓝回忆」的手记,下次生成剧情时会读到。
  - Behaviors:
    - 例:[写进故事:她小时候在这片海边住过三年]
    - 单独成段,一轮最多一次
    - 只存**设定**(身世、约定、习惯、地点),不要存闲聊和情绪
    - 存完用一句话说存了什么,不要复述全文`,
    },
];

export function registerGalgamePrompts(toolkit) {
    if (!toolkit?.prompts?.register) return 0;
    return toolkit.prompts.register(GALGAME_PROMPTS);
}
