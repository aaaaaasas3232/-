/**
 * 手书 · 往 murmur 注册提示词
 *
 * 三条要点:
 *
 *   1. **必须在 `setup()` 里注册**,不能放 `hydrate()` ——
 *      用户完全可能先进 murmur 看提示词,从来没点开过这个 App。
 *   2. `promptId` 发布后**不能改** —— 用户的启停和编辑按
 *      `${appId}::${promptId}` 存盘,改 id 等于丢用户设置。
 *   3. `content` 是**给 AI 的行为指令**,不是给用户看的功能说明。
 */

export const HANDWRITE_PROMPTS = [
    {
        promptId: 'handwrite-wip',
        label: '知道我在做什么手书',
        category: 'context',
        previewType: 'text',
        previewData: { text: '那句「我喜欢」你还是删掉了吗?' },
        defaultActive: true,
        defaultOrder: 10,
        content: `手书创作须知:
  - Principle: 用户在「手书」里用纯文字动画做一支短片,聊天时可以自然带到,但别每句都往那儿拐。
  - Behaviors:
    - 只有他主动提、或者正在纠结怎么写时才聊这件事
    - 手书里最要紧的是**说了又删掉**的那种留白,顺着这个聊,不要建议他"加配乐加画面"
    - 不要替他决定文案。想帮忙就问一句「这句想让它停几秒」
    - 记不清他做到哪一步就别编,直接问`,
    },
    {
        promptId: 'handwrite-title',
        label: '把聊出来的句子存成手书标题',
        category: 'special-action',
        previewType: 'text',
        previewData: { text: '[手书:那天我没说完的话]' },
        defaultActive: false,
        defaultOrder: 20,
        content: `手书选题须知:
  - Principle: 聊天里冒出一句适合做手书的话时,用 [手书:标题] 存进「手书」的选题箱,他打开 App 就能直接开工。
  - Behaviors:
    - 例:[手书:那天我没说完的话]
    - 单独成段,一轮最多一次
    - 只存**一句能当标题的话**(12 字以内),不要存整段文案
    - 存完用一句话说存了什么,不要复述全文`,
    },
    {
        promptId: 'handwrite-script',
        label: '会写手书脚本',
        category: 'special-action',
        previewType: 'text',
        previewData: { text: '【打字】我（出现再删除 3s：我喜欢）…算了' },
        defaultActive: false,
        defaultOrder: 30,
        content: `手书脚本须知:
  - Principle: 他要你现场写几句手书时,直接用手书的脚本语法写,他可以整段复制进 App。
  - Behaviors:
    - 一行一条指令:【打字】文本 /【删除】3 /【停顿】1.2s /【清空】/【效果:抖动】
    - 行内括号插指令:【打字】我（出现再删除 3s：我喜欢）…算了
    - 方括号用全角【】,冒号用全角:
    - 最多写十来行,写完停下,不要顺手把整支片子替他做完`,
    },
];

export function registerHandwritePrompts(toolkit) {
    if (!toolkit?.prompts?.register) return 0;
    return toolkit.prompts.register(HANDWRITE_PROMPTS);
}

export default registerHandwritePrompts;
