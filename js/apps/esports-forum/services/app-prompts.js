/**
 * 声浪 · 往 murmur 注册提示词
 *
 * 1. 静态卡（setup 注册）：告诉 AI「用户在这个世界是职业电竞选手」的行为边界，
 *    以及游戏邀请 / 战绩分享消息该怎么接。
 * 2. 当前生涯概要卡（每次 hydrate / 大事后重放）：战队、赛季阶段、近期赛果。
 *    注入的是概要，不是流水账。
 *
 * ★ 匿名铁律写进静态卡：用户在论坛的匿名发帖，聊天里的 AI 永远不知道。
 */

import { PROMPT_IDS, startTierSpec } from '../constants.js';
import { asArray, truncate } from '../utils.js';

export const ESPORTS_PROMPTS = [
    {
        promptId: PROMPT_IDS.shared,
        label: '记得用户是电竞选手',
        category: 'context',
        previewType: 'text',
        previewData: { text: '她最近在打常规赛，聊天时可能提到训练和比赛。' },
        defaultActive: true,
        defaultOrder: 12,
        content: `【声浪·电竞身份】
用户在这个世界观里的职业是电竞选手：
  - 相关时才提 TA 的职业生涯，用朋友口吻，不要报数据面板
  - 「声浪·生涯概要」卡里写的是真的发生过的事，可以自然引用；没写的不要编
  - TA 训练作息不规律（训练赛到深夜、比赛日紧张）是正常设定
  - 收到「游戏邀请」类消息时按自己的性格和关系决定答应/婉拒，答应就顺着约时间
  - 收到 TA 分享的对局战绩时，可以点评、吐槽、共情，但只基于消息里给的信息
  - ★ 绝对边界：TA 可能在匿名论坛用马甲发帖。任何 AI 都不知道那些马甲是 TA，
    永远不要「识破」，除非 TA 亲口告诉你`,
    },
];

export function registerEsportsPrompts(toolkit) {
    if (!toolkit?.prompts?.register) return 0;
    return toolkit.prompts.register(ESPORTS_PROMPTS);
}

/** 当前档的生涯概要卡（切档 / 大事后重放） */
export function buildCareerSummarySpec({ save, profile, timeline = [], seasonName = '', teamName = '' }) {
    if (!save || !profile) return null;
    const spec = startTierSpec(save.startTier);
    const recent = asArray(timeline).slice(0, 5)
        .map((t) => `第${t.day}天 ${t.title}`)
        .join('；');
    const honors = asArray(save.honors).slice(0, 5).map((h) => h.title).join('、');
    const rank = asArray(save.rankSummaries).slice(0, 2)
        .map((r) => `${r.modeLabel}${r.wins}胜${r.losses}负（巅峰分${r.ratingAfter}）`)
        .join('；');
    return {
        promptId: `${PROMPT_IDS.careerPrefix}${save.id}`,
        label: `生涯·${teamName || '电竞'}`,
        category: 'context',
        previewType: 'text',
        previewData: { text: truncate(recent || `${spec.label}电竞选手`, 60) },
        defaultActive: true,
        defaultOrder: 42,
        content: `【声浪·生涯概要】
用户 ID「${profile.gameId}」，效力于${teamName || '战队'}${seasonName ? `，正在打「${seasonName}」` : '，处于休赛期'}。
${honors ? `拿过的荣誉：${honors}。` : ''}${rank ? `\n最近排位：${rank}。` : ''}${recent ? `\n近期发生：${recent}。` : ''}
- 相关时才提，口吻像了解 TA 近况的朋友
- 只提上面写到的事，不要加细节`,
    };
}

/** 重放当前档概要卡，注销其他档的旧卡 */
export function syncCareerPrompt(toolkit, spec, saveId) {
    if (!toolkit?.prompts?.register) return 0;
    try {
        for (const entry of toolkit.prompts.list() || []) {
            const pid = String(entry?.promptId || entry?.id || '');
            if (pid.startsWith(PROMPT_IDS.careerPrefix) && pid !== `${PROMPT_IDS.careerPrefix}${saveId}`) {
                toolkit.prompts.unregister(pid);
            }
        }
    } catch (err) {
        console.warn('[esports-forum] 清理旧生涯卡失败', err);
    }
    if (!spec) return 0;
    return toolkit.prompts.register([spec]);
}
