/**
 * 萤火 · 数据计算（纯函数，node 测试直接 import）
 *
 * 「用户视频有多少评论 / 播放」不调 AI —— 由粉丝数 + 视频 id 的种子随机算出来。
 * 同一条视频永远算出同一组数（seed = videoId），刷新不会跳。
 */

import { COUNT_CAP } from '../constants.js';
import { clamp, hashString, seededRandom } from '../utils.js';

/**
 * 用户视频的互动数据。
 * 粉丝越多互动越多，但不是线性：小频道靠熟人（保底），大频道有沉默大多数。
 *
 * @param {number} followers 粉丝数
 * @param {string} videoId   种子（同视频结果稳定）
 * @returns {{views:number, likes:number, comments:number}}
 */
export function computeUploadStats(followers, videoId) {
    const fans = Math.max(0, Number(followers) || 0);
    const rnd = seededRandom(hashString(String(videoId)));

    // 播放：粉丝的 8%~35% 会点开，再加一点自然流量
    const reachRate = 0.08 + rnd() * 0.27;
    const organic = Math.floor(rnd() * 24);            // 没粉丝也有几个路人
    const views = Math.floor(fans * reachRate) + organic;

    // 点赞：播放的 3%~12%
    const likeRate = 0.03 + rnd() * 0.09;
    const likes = Math.floor(views * likeRate);

    // 评论：播放的 0.5%~2.5%，熟人盘（粉丝 < 100）评论率反而高
    const chatty = fans > 0 && fans < 100 ? 0.06 : 0;
    const commentRate = 0.005 + rnd() * 0.02 + chatty;
    const comments = Math.floor(views * commentRate);

    return { views, likes, comments };
}

/**
 * 「还能生成几条评论」：真实总数封在 stats.comments 里，
 * 已生成 generated 条后剩余量（不为负）。
 */
export function remainingComments(totalComments, generatedCount) {
    return Math.max(0, (Number(totalComments) || 0) - (Number(generatedCount) || 0));
}

/** 99+ 显示（内部保存真实数值，只在展示层截断） */
export function fmtCap(value, cap = COUNT_CAP) {
    const n = Math.max(0, Number(value) || 0);
    return n > cap ? `${cap}+` : String(n);
}

/** 大数缩写：1.2万 / 3.4亿。保留一位小数，去掉尾随 .0 */
export function fmtCount(value) {
    const n = Math.max(0, Number(value) || 0);
    const short = (x) => {
        const s = x.toFixed(1).replace(/\.0$/, '');
        return s;
    };
    if (n >= 100000000) return `${short(n / 100000000)}亿`;
    if (n >= 10000) return `${short(n / 10000)}万`;
    return String(Math.floor(n));
}

/**
 * 外部视频的「发布于」标签：AI 不擅长报时间，JS 按 id 种子出一个稳定标签。
 */
export function publishedLabel(videoId) {
    const rnd = seededRandom(hashString(`pub::${videoId}`));
    const roll = rnd();
    if (roll < 0.12) return '刚刚';
    if (roll < 0.38) return `${1 + Math.floor(rnd() * 22)}小时前`;
    if (roll < 0.75) return `${1 + Math.floor(rnd() * 6)}天前`;
    if (roll < 0.92) return `${1 + Math.floor(rnd() * 3)}周前`;
    return `${1 + Math.floor(rnd() * 10)}个月前`;
}

/** 封面色相槽位（0~slots-1，稳定） */
export function coverHue(videoId, slots = 8) {
    return hashString(`hue::${videoId}`) % Math.max(1, slots);
}

/**
 * 主播这个时间窗内开不开播。可复现：同窗口同主播结果一致。
 * @param {string} creatorId
 * @param {number} windowStamp  Math.floor(now / LIVE_WINDOW_MS)
 * @param {number} chance       0~1
 */
export function isLiveNow(creatorId, windowStamp, chance) {
    const rnd = seededRandom(hashString(`live::${creatorId}::${windowStamp}`));
    return rnd() < clamp(chance, 0, 1);
}

/** 直播观众数：粉丝的 1%~6%，最少 3 个 */
export function liveViewers(followers, creatorId, windowStamp) {
    const fans = Math.max(0, Number(followers) || 0);
    const rnd = seededRandom(hashString(`viewers::${creatorId}::${windowStamp}`));
    return Math.max(3, Math.floor(fans * (0.01 + rnd() * 0.05)));
}
