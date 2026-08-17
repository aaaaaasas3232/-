/**
 * 梦境编织 · 往 murmur 注册提示词
 *
 * 照 `docs/跨App注册Prompt指导方案.md` 的规范做。三条要点:
 *
 *   1. **必须在 `setup()` 里注册**,不能放 `hydrate()` ——
 *      用户完全可能先进 murmur 看提示词,从来没点过这个 App。
 *   2. `promptId` 发布后**不能改** —— 用户的开关和编辑按它存盘。
 *   3. `content` 是给 AI 的行为指令,不是给用户看的功能说明。
 *
 * 注册的能力:让 AI 在聊天里能引用「用户正在写的书」,以及把聊到的点子直接存成灵感。
 */

export const DREAM_WEAVER_PROMPTS = [
    {
        promptId: 'novel-context',
        label: '知道我在写什么',
        category: 'context',
        previewType: 'text',
        previewData: { text: '你最近在写《长夜将尽》,主角是个不肯认输的守夜人。' },
        defaultActive: true,
        defaultOrder: 10,
        content: `创作近况须知:
  - Principle: 用户在「梦境编织」里写小说,聊天时可以自然地提到,但不要每句都扯回去。
  - Behaviors:
    - 只有用户主动聊到写作、卡文、灵感时才提
    - 用「你那本」这种口吻,不要报书名全称报三遍
    - 不要替他决定剧情走向,他问了再给建议
    - 不知道具体内容就别编,宁可问一句`,
    },
    {
        promptId: 'capture-inspiration',
        label: '把点子存进灵感库',
        category: 'special-action',
        previewType: 'text',
        previewData: { text: '[存灵感:黎明前的那半小时,城市是安静的]' },
        defaultActive: false,
        defaultOrder: 20,
        content: `存灵感须知:
  - Principle: 聊天里冒出值得写进小说的句子或点子时,用 [存灵感:内容] 存进用户的灵感库。
  - Behaviors:
    - 例:[存灵感:黎明前的那半小时,城市是安静的]
    - 单独成段,前后不要加「|」
    - 一轮最多一次,只存真的有意思的,别把闲聊都存进去
    - 存完用一句话说明存了什么,不要复述全文`,
    },
];

export function registerDreamWeaverPrompts(toolkit) {
    if (!toolkit?.prompts?.register) return 0;
    return toolkit.prompts.register(DREAM_WEAVER_PROMPTS);
}
