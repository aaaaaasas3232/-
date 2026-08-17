/**
 * 候鸟 · 往 murmur 注册提示词
 *
 * 折叠区里出现一组「候鸟」：
 *   1. 一条静态卡（setup 时注册）：告诉 AI 「你们可能一起旅行过」的行为边界。
 *   2. 每趟旅行的**概要**一张卡（生成概要时注册）：注入的是概要，不是全过程。
 *      全过程留在候鸟自己的对话页里给用户回忆。
 *
 * 三条规矩（购物 App 踩过坑）：
 *   - 静态卡必须在 `setup()` 里注册，放 hydrate 的话用户没开过候鸟就看不到。
 *   - promptId 发布后不能改（用户启停按 `${appId}::${promptId}` 存盘）。
 *   - 注册表是内存的，刷新就没 —— 概要卡要在每次 hydrate 后重放（syncTripSummaryPrompts）。
 */

import { PROMPT_IDS } from '../constants.js';
import { asArray, truncate } from '../utils.js';
import { tripDurationLabel } from './trip-flow.js';

export const TRAVEL_PROMPTS = [
    {
        promptId: PROMPT_IDS.shared,
        label: '记得一起旅行过的地方',
        category: 'context',
        previewType: 'text',
        previewData: { text: '上次去雾杉泽那趟，回程的船上你睡着了。' },
        defaultActive: true,
        defaultOrder: 10,
        content: `【候鸟·共同旅行】
旅行记忆须知:
  - Principle: 你可能和用户在「候鸟」里一起旅行过。真去过的旅程会以「旅行·地名」的卡片单独列出，那些是真的发生过的事。
  - Behaviors:
    - 相关时才提，用「上次在那边」这种回忆的口吻
    - 只提概要里有的事，不要给它编细节
    - 没有旅行卡片就是没一起去过，不要虚构行程
    - 那是过去时，不要当成正在发生的事继续演`,
    },
];

/** setup 时调：注册静态卡 */
export function registerTravelPrompts(toolkit) {
    if (!toolkit?.prompts?.register) return 0;
    return toolkit.prompts.register(TRAVEL_PROMPTS);
}

/** 一趟旅行的概要卡 spec */
export function buildTripSummarySpec(trip) {
    const dest = trip?.destination || {};
    const names = asArray(trip?.companions).map((c) => c.name).filter(Boolean);
    const place = [dest.placeName, dest.locationName].filter(Boolean).join('·');
    return {
        promptId: `${PROMPT_IDS.tripPrefix}${trip.id}`,
        label: `旅行·${truncate(place || '未知目的地', 12)}`,
        category: 'context',
        previewType: 'text',
        previewData: { text: truncate(trip.summary, 60) },
        defaultActive: true,
        defaultOrder: 40,
        content: `【候鸟·旅行记忆】
你和用户一起去过 ${place}（${tripDurationLabel(trip.days)}${names.length ? `，同行：${names.join('、')}` : ''}）。
发生过的事：${String(trip.summary || '').trim()}
- 相关时才提起，用回忆的口吻
- 只提上面写到的事，不要加细节`,
    };
}

/**
 * 把当前档案下所有「已生成概要」的旅行卡重放进注册表，
 * 并把不属于当前档案的旧卡注销（切档后 murmur 不该看到别档的旅行）。
 */
export function syncTripSummaryPrompts(toolkit, trips = []) {
    if (!toolkit?.prompts?.register) return 0;

    const wanted = asArray(trips).filter((t) => t && t.id && String(t.summary || '').trim());
    const wantedIds = new Set(wanted.map((t) => `${PROMPT_IDS.tripPrefix}${t.id}`));

    // 注销不属于当前档案的旅行卡（静态卡不在 tripPrefix 命名空间里，不受影响）
    try {
        for (const entry of toolkit.prompts.list() || []) {
            const pid = String(entry?.promptId || entry?.id || '');
            if (pid.startsWith(PROMPT_IDS.tripPrefix) && !wantedIds.has(pid)) {
                toolkit.prompts.unregister(pid);
            }
        }
    } catch (err) {
        console.warn('[travel] 清理旧旅行卡失败', err);
    }

    if (!wanted.length) return 0;
    return toolkit.prompts.register(wanted.map((t) => buildTripSummarySpec(t)));
}

/** 单独注销一张旅行卡（删除足迹时用） */
export function unregisterTripSummaryPrompt(toolkit, tripId) {
    if (!toolkit?.prompts?.unregister || !tripId) return false;
    return toolkit.prompts.unregister(`${PROMPT_IDS.tripPrefix}${tripId}`);
}
