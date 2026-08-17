/**
 * 萤火 · 直播间纯逻辑（不碰 DOM / window，node 测试直接 import）
 *
 * 两件事：
 *   1. 离线直播间的静态内容 —— **不调 AI**，从已有的创作者数据合成几条消息。
 *      「主播不在时能点进去但没有不断生成的消息」，合成的这几条就够撑起房间。
 *   2. 弹幕调度的取数逻辑 —— 组件里只跑一个 250ms 的 interval，
 *      每 tick 用 `dueItems` 取「这一拍该出现的」，**绝不是一条弹幕一次 API**。
 */

import { asArray, hashString, seededRandom } from '../utils.js';

/**
 * 离线直播间：置顶公告 + 少量历史留言（确定性合成，同主播同结果）。
 * @param {object} creator 创作者记录（name / works / followers）
 * @returns {{notice:string, messages:{name:string, text:string}[]}}
 */
export function makeOfflineRoom(creator = {}) {
    const name = String(creator.name || '主播');
    const works = asArray(creator.works);
    const rnd = seededRandom(hashString(`offline::${creator.creatorId || name}`));

    const fanPool = [
        `什么时候开播呀`,
        `蹲一个下播回放`,
        `${name}今天也没播，先睡了`,
        `路过打卡`,
        `上次那场还没看完，等更新`,
        `每天来看一眼，习惯了`,
        `有人知道下次直播时间吗`,
    ];
    const picked = [];
    const used = new Set();
    const want = 3 + Math.floor(rnd() * 2);   // 3~4 条
    while (picked.length < want && used.size < fanPool.length) {
        const i = Math.floor(rnd() * fanPool.length);
        if (used.has(i)) continue;
        used.add(i);
        picked.push({
            name: `观众${String.fromCharCode(65 + Math.floor(rnd() * 26))}${Math.floor(rnd() * 90 + 10)}`,
            text: fanPool[i],
        });
    }
    if (works.length) {
        picked.unshift({
            name: '系统',
            text: `上一场直播的回放：「${String(works[0]?.title || '').slice(0, 18) || '未命名'}」`,
        });
    }
    return {
        notice: `${name} 暂时不在线。开播会在频道页亮起红点。`,
        messages: picked,
    };
}

/**
 * 取 [fromMs, toMs) 区间内到点的条目。
 *
 * ★ 区间是**左闭右开**：atSec 0 的条目必须在第一拍（from=0）就出现。
 *   第一版写成 (from, to] 时，弹幕池里 atSec=0 的整批永远不飘 ——
 *   而 AI 生成的池子第一条几乎总是 0。
 *
 * @param {{atSec:number}[]} items  已按 atSec 升序（不强制，内部会过滤不排序）
 * @param {number} fromMs 上一拍的播放头（毫秒）
 * @param {number} toMs   这一拍的播放头（毫秒）
 */
export function dueItems(items, fromMs, toMs) {
    return asArray(items).filter((it) => {
        const at = (Number(it?.atSec) || 0) * 1000;
        return at >= fromMs && at < toMs;
    });
}

/** 弹幕池的总时长（毫秒），播放头到这之后就算「这场看完了」 */
export function poolDurationMs(live) {
    let max = 0;
    for (const it of [...asArray(live?.hostLines), ...asArray(live?.danmaku)]) {
        const at = (Number(it?.atSec) || 0) * 1000;
        if (at > max) max = at;
    }
    return max + 4000;   // 最后一条飘完再留 4 秒
}

/** 弹幕的视觉参数（确定性：同一条永远同一行 / 同一速度） */
export function danmakuVisual(item, index) {
    const rnd = seededRandom(hashString(`dm::${index}::${item?.text || ''}`));
    return {
        top: 6 + Math.floor(rnd() * 74),            // 6% ~ 80%
        duration: 7 + rnd() * 5,                     // 7s ~ 12s 横穿
        slot: Math.floor(rnd() * 6),                 // 颜色槽 0~5（CSS 定义）
        size: rnd() < 0.18 ? 'lg' : 'md',
    };
}
