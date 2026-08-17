/**
 * 追光 · 往 murmur 注册提示词
 *
 * 1. 静态卡（setup 注册）：告诉 AI「用户在这个世界是演员」的行为边界。
 * 2. 当前生涯概要卡（每次 hydrate / 大事后重放）：线级、代表作、近期大事。
 *    注入的是概要，不是流水账。
 */

import { PROMPT_IDS, tierSpec } from '../constants.js';
import { asArray, truncate } from '../utils.js';

export const ACTOR_PROMPTS = [
    {
        promptId: PROMPT_IDS.shared,
        label: '记得用户是演员',
        category: 'context',
        previewType: 'text',
        previewData: { text: '她最近刚进组，聊天时可能会提到拍戏的事。' },
        defaultActive: true,
        defaultOrder: 12,
        content: `【追光·演员身份】
用户在这个世界观里的职业是演员：
  - 相关时才提她的演艺生涯，用朋友口吻，不要报数据
  - 「追光·生涯概要」卡里写的是真的发生过的事，可以自然引用
  - 没写的事不要编（没获奖就不要恭喜获奖）
  - 她可能忙于拍戏、试镜、上课，作息不规律是正常的`,
    },
];

export function registerActorPrompts(toolkit) {
    if (!toolkit?.prompts?.register) return 0;
    return toolkit.prompts.register(ACTOR_PROMPTS);
}

/** 当前档的生涯概要卡（切档 / 大事后重放） */
export function buildCareerSummarySpec(save, timeline = []) {
    if (!save) return null;
    const spec = tierSpec(save.tier);
    const recent = asArray(timeline).slice(0, 5)
        .map((t) => `第${t.day}天 ${t.title}`)
        .join('；');
    const honors = asArray(save.honors).slice(0, 5).map((h) => h.title).join('、');
    return {
        promptId: `${PROMPT_IDS.stagePrefix}${save.id}`,
        label: `生涯·${spec.label}`,
        category: 'context',
        previewType: 'text',
        previewData: { text: truncate(recent || `${spec.label}演员`, 60) },
        defaultActive: true,
        defaultOrder: 42,
        content: `【追光·生涯概要】
用户当前是 ${spec.label} 演员（${spec.group}）。
${honors ? `拿过的荣誉：${honors}。` : ''}${recent ? `\n近期发生：${recent}。` : ''}
- 相关时才提，口吻像了解她近况的朋友
- 只提上面写到的事，不要加细节`,
    };
}

/** 重放当前档概要卡，注销其他档的旧卡 */
export function syncCareerPrompt(toolkit, save, timeline = []) {
    if (!toolkit?.prompts?.register) return 0;
    try {
        for (const entry of toolkit.prompts.list() || []) {
            const pid = String(entry?.promptId || entry?.id || '');
            if (pid.startsWith(PROMPT_IDS.stagePrefix) && pid !== `${PROMPT_IDS.stagePrefix}${save?.id}`) {
                toolkit.prompts.unregister(pid);
            }
        }
    } catch (err) {
        console.warn('[actor] 清理旧生涯卡失败', err);
    }
    const spec = buildCareerSummarySpec(save, timeline);
    if (!spec) return 0;
    return toolkit.prompts.register([spec]);
}
