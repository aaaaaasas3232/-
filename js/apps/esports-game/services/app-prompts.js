/**
 * 赛点 · 往 murmur 注册提示词
 *
 * 1. 静态卡（setup 注册）：AI 收到游戏邀请 / 战绩分享消息时该怎么接。
 * 2. 同游概要卡（hydrate / 每次排位后重放）：最近哪些 AI 和用户一起打过、
 *    亲密关系与情侣标 —— 只有一起打过的对局会写进来，AI 只知道自己参与的部分。
 */

import { PROMPT_IDS, intimacyLevelLabel } from '../constants.js';
import { asArray, truncate } from '../utils.js';

export const GAME_PROMPTS = [
    {
        promptId: PROMPT_IDS.shared,
        label: '游戏邀请与战绩怎么接',
        category: 'context',
        previewType: 'text',
        previewData: { text: '「游戏邀请」一起打排位吗？' },
        defaultActive: true,
        defaultOrder: 14,
        content: `【赛点·游戏消息】
用户可能在聊天里发这些游戏相关消息（都是纯文字，以「游戏邀请」「战绩分享」「对局分享」「战绩围观」开头）：
  - 游戏邀请：按你的性格和你们的关系决定答应或婉拒；答应就自然地约时间，不要立刻开始描写打游戏
  - 战绩分享 / 对局分享：可以点评、吐槽、共情；只基于消息里给的数字和事实，不要编细节
  - 战绩围观（别人的战绩）：可以一起八卦，也可以感到危机感或替对方说话
  - 「赛点·同游概要」卡里写了你真的和用户一起打过的对局，可以自然回忆；没写的不要编`,
    },
];

export function registerGamePrompts(toolkit) {
    if (!toolkit?.prompts?.register) return 0;
    return toolkit.prompts.register(GAME_PROMPTS);
}

/**
 * 同游概要卡：最近与 AI 一起打的对局 + 亲密关系。
 * @param {object} opts { saveId, gameName, sessions（含 companions type='ai' 的最近场次）, relations }
 */
export function buildCoopSummarySpec({ saveId, gameName, sessions = [], relations = [] }) {
    if (!saveId) return null;
    const aiSessions = asArray(sessions)
        .filter((s) => asArray(s.companionsMeta).some((c) => c.type === 'ai'))
        .slice(0, 4);
    const aiRelations = asArray(relations).filter((r) => r.targetType === 'ai' && (r.gamesTogether > 0 || r.coupleTag));
    if (!aiSessions.length && !aiRelations.length) return null;

    const sessionLines = aiSessions.map((s) => {
        const names = asArray(s.companionsMeta).filter((c) => c.type === 'ai').map((c) => c.name).join('、');
        return `第${s.day}天 与${names}${s.modeLabel}：${s.wins}胜${s.losses}负`;
    });
    const relationLines = aiRelations.map((r) => {
        const tag = r.coupleTag ? `，绑了情侣标「${r.coupleTag.name}」` : '';
        return `${r.name}：亲密 ${r.intimacy}/100（${intimacyLevelLabel(r.intimacy)}）${tag}`;
    });

    return {
        promptId: `${PROMPT_IDS.coopPrefix}${saveId}`,
        label: '同游概要',
        category: 'context',
        previewType: 'text',
        previewData: { text: truncate(sessionLines[0] || relationLines[0] || '', 60) },
        defaultActive: true,
        defaultOrder: 44,
        content: `【赛点·同游概要】
用户在《${gameName}》里的游戏社交（只有当事 AI 知道自己参与的部分，别人的不知道）：
${relationLines.length ? `关系：\n${relationLines.map((l) => `  - ${l}`).join('\n')}` : ''}
${sessionLines.length ? `最近一起打过：\n${sessionLines.map((l) => `  - ${l}`).join('\n')}` : ''}
- 如果你是上面提到的 AI，可以自然聊起这些对局与关系；不是就当不知道
- 情侣标是游戏内的公开关系标识，别的角色看得到用户主页上的它`,
    };
}

/** 重放当前档同游卡，注销其他档的旧卡 */
export function syncCoopPrompt(toolkit, spec, saveId) {
    if (!toolkit?.prompts?.register) return 0;
    try {
        for (const entry of toolkit.prompts.list() || []) {
            const pid = String(entry?.promptId || entry?.id || '');
            if (pid.startsWith(PROMPT_IDS.coopPrefix) && pid !== `${PROMPT_IDS.coopPrefix}${saveId}`) {
                toolkit.prompts.unregister(pid);
            }
        }
    } catch (err) {
        console.warn('[esports-game] 清理旧同游卡失败', err);
    }
    if (!spec) return 0;
    return toolkit.prompts.register([spec]);
}
