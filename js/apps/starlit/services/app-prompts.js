/**
 * 点灯 · 往 murmur 注册提示词
 *
 * murmur 折叠区里出现一组「点灯」：
 *   1. 一条静态卡（setup 时注册）：告诉 AI「这个人在点灯里学东西」的边界。
 *   2. 每个学习主题一张进度卡（hydrate 后重放）：注入的是**概要**，
 *      不是全部课堂记录 —— 完整记录留在点灯里给用户自己回味。
 *
 * 三条规矩：
 *   - 静态卡必须在 `setup()` 里注册。放 hydrate 的话，用户没打开过点灯，
 *     murmur 折叠区里就看不到它。
 *   - promptId 发布后不能改（用户启停按 `${appId}::${promptId}` 存盘）。
 *   - 注册表在内存里，刷新就没 —— 进度卡每次 hydrate 后要重放。
 */

import { MODES } from '../constants.js';
import { asArray, truncate } from '../utils.js';

export const PROMPT_IDS = Object.freeze({
    shared: 'learning-context',
    topicPrefix: 'topic:',
});

export const STARLIT_PROMPTS = [
    {
        promptId: PROMPT_IDS.shared,
        label: '点灯 · 他在学什么',
        category: 'context',
        previewType: 'text',
        previewData: { text: '他最近在啃英语的词根，第 3 节课卡在时态上。' },
        defaultActive: true,
        defaultOrder: 30,
        content: `【点灯·学习中】
关于用户正在学的东西:
  - Principle: 用户在「点灯」里系统学习某些东西。每个学习主题会以「在学·xxx」的卡片单独列出，那些是真的在学的。
  - Behaviors:
    - 相关时才提，用「你最近不是在学那个吗」这种口吻
    - 只提卡片里写到的进度，不要替他编造学过的内容
    - 他卡住的地方可以顺口问一句，但不要在聊天里开课
    - 没有学习卡片就是没在学，不要虚构`,
    },
];

/** setup 时调 */
export function registerStarlitPrompts(toolkit) {
    if (!toolkit?.prompts?.register) return 0;
    return toolkit.prompts.register(STARLIT_PROMPTS);
}

/** 一个学习主题的进度卡 */
export function buildTopicSpec(topic, lessons = []) {
    const list = asArray(lessons);
    const done = list.filter((l) => l.status === 'done' || l.status === 'flipped');
    const current = list.find((l) => l.status === 'active')
        || list.find((l) => l.status === 'planned');
    const modeLabel = topic.mode === MODES.language ? '语言' : '代码';

    return {
        promptId: `${PROMPT_IDS.topicPrefix}${topic.id}`,
        label: `在学·${truncate(topic.title || '未命名', 12)}`,
        category: 'context',
        previewType: 'text',
        previewData: {
            text: `${done.length}/${list.length} 节${current ? ` · 正在第 ${current.index} 节` : ''}`,
        },
        defaultActive: true,
        defaultOrder: 42,
        content: `【点灯·学习进度】
他在学：${topic.title}（${modeLabel}${topic.target ? ` · ${topic.target}` : ''}）
${topic.goal ? `他的目标：${topic.goal}` : ''}
进度：一共 ${list.length} 节，已上完 ${done.length} 节${current ? `，现在在第 ${current.index} 节「${current.title}」` : ''}
${topic.learnerProfile ? `他现在的水平：${truncate(topic.learnerProfile, 160)}` : ''}
- 相关时才提，别每句话都往学习上扯
- 不要在聊天里替他上课，那是点灯的事`,
    };
}

/**
 * 把当前档案下所有「已经规划过」的主题重放进注册表，
 * 并注销不属于当前档案的旧卡（切用户 / 切世界后 murmur 不该看到别档的）。
 */
export function syncTopicPrompts(toolkit, topics = [], lessonsByTopic = {}) {
    if (!toolkit?.prompts?.register) return 0;

    const wanted = asArray(topics).filter((t) => t && t.id && t.planned);
    const wantedIds = new Set(wanted.map((t) => `${PROMPT_IDS.topicPrefix}${t.id}`));

    try {
        for (const entry of toolkit.prompts.list() || []) {
            const pid = String(entry?.promptId || entry?.id || '');
            if (pid.startsWith(PROMPT_IDS.topicPrefix) && !wantedIds.has(pid)) {
                toolkit.prompts.unregister(pid);
            }
        }
    } catch (err) {
        console.warn('[starlit] 清理旧学习卡失败', err);
    }

    if (!wanted.length) return 0;
    return toolkit.prompts.register(
        wanted.map((t) => buildTopicSpec(t, lessonsByTopic[t.id] || [])),
    );
}

export function unregisterTopicPrompt(toolkit, topicId) {
    if (!toolkit?.prompts?.unregister || !topicId) return false;
    return toolkit.prompts.unregister(`${PROMPT_IDS.topicPrefix}${topicId}`);
}
