/**
 * 电竞双 App（声浪 esports-forum / 赛点 esports-game）共享底座
 *
 * 只放两边都要的纯函数与常量：
 *   - 游戏模型预设（MOBA 5v5 / 非对称 4v1 / 战术射击），位置、称谓、英雄池全部由模型决定
 *   - 每档独立时钟（与追光同一套语义：anchorMs + day + minute，快进回不了头）
 *   - 巅峰分段位表 / 强度合成
 *
 * 不碰 window / DOM / 存储，node 测试直接 import。
 * 论坛（声浪）是事实源：赛季、属性、时间都归它；赛点通过 externalAppRegistry 调服务。
 */

import { clamp } from '../social-shared/social-kit.js';

// ===========================================================================
// 游戏模型预设 —— 「预配置要做的精细」
// ===========================================================================

export const GAME_MODELS = Object.freeze([
    Object.freeze({
        id: 'moba',
        label: '5v5 峡谷推塔（MOBA）',
        desc: '两支五人队伍对垒，分路运营、团战决胜。KPL 式赛程的原生形态。',
        teamSize: 5,
        benchSize: 1,
        positions: Object.freeze([
            { id: 'clash', label: '对抗路', short: '对' },
            { id: 'jungle', label: '打野', short: '野' },
            { id: 'mid', label: '中路', short: '中' },
            { id: 'farm', label: '发育路', short: '发' },
            { id: 'roam', label: '游走', short: '游' },
        ]),
        heroNoun: '英雄',
        rankName: '巅峰赛',
        matchMinutes: 26,
        defaultGameName: '曜世战场',
        kdaStyle: 'kda',
        heroPool: Object.freeze([
            '破军', '青鸾', '雪竹', '衔烛', '白泽', '临渊', '折霜', '斩风', '灯野', '沉戟',
            '拂晓', '孤鸿', '赤瞳', '缚岳', '空蝉', '照夜', '苍梧', '衡曜', '洗墨', '惊蛰',
            '雾隐', '断弦', '星阑', '掠火', '扶摇', '听雷', '归尘', '澈影', '重明', '烬羽',
        ]),
    }),
    Object.freeze({
        id: 'asym',
        label: '4v1 非对称对抗',
        desc: '四名求生者与一名监管者的猫鼠博弈，IVL 式的心理战赛场。',
        teamSize: 5,
        benchSize: 1,
        positions: Object.freeze([
            { id: 'decoder', label: '破译位', short: '译' },
            { id: 'rescuer', label: '救援位', short: '救' },
            { id: 'kiter', label: '牵制位', short: '牵' },
            { id: 'assist', label: '辅助位', short: '辅' },
            { id: 'hunter', label: '监管者', short: '监' },
        ]),
        heroNoun: '角色',
        rankName: '巅峰排位',
        matchMinutes: 22,
        defaultGameName: '雾锁庄园',
        kdaStyle: 'asym',
        heroPool: Object.freeze([
            '提灯人', '幕后师', '假面客', '守钟人', '拾荒者', '摆渡人', '织梦女', '解剖学家',
            '邮差', '画中仙', '雕刻家', '驯鹰师', '默剧演员', '调香师', '锁匠', '夜莺',
            '掘墓人', '占卜师', '机械童', '傀儡师', '巡夜人', '糖果商', '标本师', '风筝手',
        ]),
    }),
    Object.freeze({
        id: 'shooter',
        label: '战术射击（大逃杀）',
        desc: '四人小队跳伞落地、缩圈决赛圈，PEL 式的积分战场。',
        teamSize: 4,
        benchSize: 1,
        positions: Object.freeze([
            { id: 'igl', label: '指挥位', short: '指' },
            { id: 'assault', label: '突击手', short: '突' },
            { id: 'lurker', label: '自由人', short: '由' },
            { id: 'sniper', label: '狙击手', short: '狙' },
        ]),
        heroNoun: '武器',
        rankName: '巅峰竞技',
        matchMinutes: 30,
        defaultGameName: '孤环行动',
        kdaStyle: 'br',
        heroPool: Object.freeze([
            '雷鸣-AR', '风切-SMG', '望星-SR', '短歌-DMR', '铁幕-LMG', '燕返-SG',
            '蜂刺-P', '霜牙-AR', '海啸-SMG', '天窗-SR', '荒原-DMR', '磐石-SG',
            '流萤-AR', '骤雨-SMG', '孤光-SR', '裂帛-DMR',
        ]),
    }),
]);

export function gameModelById(id) {
    return GAME_MODELS.find((m) => m.id === id) || GAME_MODELS[0];
}

export function positionLabel(model, positionId) {
    const m = typeof model === 'string' ? gameModelById(model) : (model || GAME_MODELS[0]);
    return m.positions.find((p) => p.id === positionId)?.label || positionId;
}

// ===========================================================================
// 每档独立时钟（语义与追光完全一致；常量内联避免跨 App import constants）
// ===========================================================================

export const DAY_SLOTS = Object.freeze([
    { id: 'morning', label: '早', minute: 9 * 60, desc: '上午 9:00' },
    { id: 'noon', label: '午', minute: 13 * 60, desc: '下午 1:00' },
    { id: 'evening', label: '晚', minute: 18 * 60 + 30, desc: '晚上 6:30' },
    { id: 'night', label: '深夜', minute: 22 * 60 + 30, desc: '夜里 10:30' },
]);

export const DAY_START_MINUTE = 8 * 60;    // 职业队的一天从 8:00 开始
export const DAY_END_MINUTE = 24 * 60;     // 24:00 封顶，等用户决定是否跨日

const DAY_MS = 86400000;

export function realDayKey(ms = Date.now()) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function createClock(now = Date.now()) {
    const anchor = new Date(now);
    anchor.setHours(0, 0, 0, 0);
    return {
        anchorMs: anchor.getTime(),
        day: 1,
        minute: clamp(new Date(now).getHours() * 60 + new Date(now).getMinutes(), DAY_START_MINUTE, DAY_END_MINUTE),
        syncReal: true,
        lastRealDayKey: realDayKey(now),
    };
}

/** 档内当前时刻对应的虚拟现实毫秒（喂给世界纪时映射） */
export function virtualMs(clock) {
    if (!clock) return Date.now();
    return clock.anchorMs + (clock.day - 1) * DAY_MS + clock.minute * 60000;
}

export function syncToRealTime(clock, now = Date.now()) {
    if (!clock?.syncReal) return { clock, crossedRealDay: false };
    const d = new Date(now);
    const next = { ...clock, minute: clamp(d.getHours() * 60 + d.getMinutes(), 0, DAY_END_MINUTE) };
    const key = realDayKey(now);
    const crossedRealDay = Boolean(clock.lastRealDayKey && clock.lastRealDayKey !== key);
    return { clock: next, crossedRealDay, realDayKey: key };
}

export function setSlot(clock, slotId) {
    const slot = DAY_SLOTS.find((s) => s.id === slotId);
    if (!slot) return clock;
    return { ...clock, minute: slot.minute, syncReal: false };
}

export function setSyncReal(clock, on, now = Date.now()) {
    if (!on) return { ...clock, syncReal: false };
    const d = new Date(now);
    return {
        ...clock,
        syncReal: true,
        minute: clamp(d.getHours() * 60 + d.getMinutes(), 0, DAY_END_MINUTE),
        lastRealDayKey: realDayKey(now),
    };
}

/** 推进若干分钟（打排位 / 训练消耗时长）。到 24:00 封顶，由 UI 问是否跨日。 */
export function advanceMinutes(clock, minutes) {
    const target = clock.minute + Math.max(0, Math.round(minutes));
    if (target >= DAY_END_MINUTE) {
        return { clock: { ...clock, minute: DAY_END_MINUTE, syncReal: false }, hitMidnight: true };
    }
    return { clock: { ...clock, minute: target, syncReal: false }, hitMidnight: false };
}

export function nextDay(clock, now = Date.now()) {
    return { ...clock, day: clock.day + 1, minute: DAY_START_MINUTE, lastRealDayKey: realDayKey(now) };
}

/** 快进 N 天：整个档的纪时一起走，回不了头 */
export function fastForward(clock, days) {
    const n = Math.max(1, Math.round(Number(days) || 0));
    return { ...clock, day: clock.day + n, minute: DAY_START_MINUTE, syncReal: false };
}

export function currentSlotId(clock) {
    const m = clock?.minute ?? 0;
    if (m < 11 * 60) return 'morning';
    if (m < 17 * 60) return 'noon';
    if (m < 21 * 60 + 30) return 'evening';
    return 'night';
}

export function currentSlotLabel(clock) {
    const id = currentSlotId(clock);
    return DAY_SLOTS.find((s) => s.id === id)?.label || '早';
}

export function offsetSummary(clock, now = Date.now()) {
    if (!clock) return '';
    const diffDays = Math.round((virtualMs(clock) - now) / DAY_MS);
    if (diffDays === 0) return '与现实同步';
    return diffDays > 0 ? `比现实快 ${diffDays} 天` : `比现实慢 ${Math.abs(diffDays)} 天`;
}

export function minuteToHm(minute) {
    const m = Math.max(0, Math.min(24 * 60, Math.round(Number(minute) || 0)));
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function clockHm(clock) {
    return minuteToHm(clock?.minute ?? 0);
}

/** 当日剩余可安排的小时数 */
export function remainHours(clock) {
    return Math.max(0, (DAY_END_MINUTE - (clock?.minute ?? 0)) / 60);
}

// ===========================================================================
// 巅峰分段位
// ===========================================================================

export const RANK_TIERS = Object.freeze([
    { from: 0, label: '荣耀黄金' },
    { from: 1200, label: '尊贵铂金' },
    { from: 1400, label: '永恒钻石' },
    { from: 1600, label: '至尊星耀' },
    { from: 1800, label: '最强王者' },
    { from: 2000, label: '无双王者' },
    { from: 2200, label: '荣耀王者' },
    { from: 2500, label: '传奇王者' },
]);

export function rankTierLabel(rating) {
    const n = Math.max(0, Number(rating) || 0);
    let label = RANK_TIERS[0].label;
    for (const t of RANK_TIERS) {
        if (n >= t.from) label = t.label;
    }
    return label;
}

// ===========================================================================
// 选手强度合成（论坛赛季模拟与赛点排位共用同一口径）
// ===========================================================================

/** 七维 → 单人综合战力（0~100）。操作意识为主，默契沟通其次。 */
export function playerPower(attrs = {}) {
    return Math.round(
        clamp(attrs.mechanics, 0, 100) * 0.26
        + clamp(attrs.awareness, 0, 100) * 0.24
        + clamp(attrs.pool, 0, 100) * 0.14
        + clamp(attrs.mentality, 0, 100) * 0.12
        + clamp(attrs.synergy, 0, 100) * 0.12
        + clamp(attrs.comms, 0, 100) * 0.07
        + clamp(attrs.stamina, 0, 100) * 0.05,
    );
}

/** 队伍强度：五人均值 + 默契加成（默契均值高的队伍 1+1>2） */
export function teamPower(memberAttrsList = []) {
    const list = memberAttrsList.filter(Boolean);
    if (!list.length) return 0;
    const avg = list.reduce((acc, a) => acc + playerPower(a), 0) / list.length;
    const synergyAvg = list.reduce((acc, a) => acc + clamp(a.synergy, 0, 100), 0) / list.length;
    return Math.round(avg + (synergyAvg - 50) * 0.1);
}
