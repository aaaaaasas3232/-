/**
 * 赛点（esports-game）· 常量 —— 游戏客户端的「数值真相」
 *
 *   - 五张表名 / murmur 提示词 id / 超时
 *   - 排位模式（单排巅峰 / 双排 / 三排 / 五排）
 *   - 时间与体力成本（一局多久、一天最多几局、吃饭窗口）
 *   - 亲密关系（互关 / 情侣标门槛 / 日增益上限）
 *   - 英雄熟练度规则
 *   - 教练每日安排素材池（零 token 的群聊氛围层）
 */

export const STORES = Object.freeze({
    states: 'esgStates',        // 一档一条：巅峰分 / 熟练度 / 每日局数 / 待同步 / 揭示记录
    sessions: 'esgSessions',    // 排位场次（一次 N 局）
    matches: 'esgMatches',      // 单局（含懒生成的文字回放）
    relations: 'esgRelations',  // 亲密关系（互关 / 亲密值 / 情侣标）
    chats: 'esgChats',          // 战队群 / 教练私聊消息
});

export const TIMEOUT = Object.freeze({
    normal: 90000,
    long: 150000,
});

/** murmur 提示词 id（发布后不能改） */
export const PROMPT_IDS = Object.freeze({
    shared: 'esports-game-shared',
    coopPrefix: 'esports-coop-',
});

// ===========================================================================
// 排位模式
// ===========================================================================

export const RANK_MODES = Object.freeze([
    { id: 'solo', label: '巅峰单排', companions: 0, ratingFactor: 1, desc: '一个人扛着分往上爬' },
    { id: 'duo', label: '双排', companions: 1, ratingFactor: 0.6, desc: '带一个人，胜负同担' },
    { id: 'trio', label: '三排', companions: 2, ratingFactor: 0.6, desc: '三缺二的快乐局' },
    { id: 'five', label: '五排', companions: 4, ratingFactor: 0.5, desc: '满编车队，输赢都热闹' },
]);

export function rankModeById(id) {
    return RANK_MODES.find((m) => m.id === id) || RANK_MODES[0];
}

// ===========================================================================
// 时间 / 体力 / 吃饭
// ===========================================================================

/** 一局的排队分钟数（在模型 matchMinutes 之外） */
export const QUEUE_MINUTES = 6;
/** 一天最多打多少局排位（硬上限；时间与精力通常先见底） */
export const DAILY_GAME_CAP = 15;
/** 一次最多连打多少局 */
export const SESSION_GAME_CAP = 12;
/** 每局精力消耗（体能 ≥70 时 -1） */
export const ENERGY_PER_GAME = 3;
/** 精力低于该值不建议开排 */
export const ENERGY_FLOOR = 10;

/** 吃饭窗口（分钟）：跨过窗口没吃 → 饥饿减益，直到吃饭 */
export const MEAL_WINDOWS = Object.freeze({
    lunch: { from: 12 * 60, to: 13 * 60 + 30, label: '午饭' },
    dinner: { from: 18 * 60, to: 19 * 60 + 30, label: '晚饭' },
});
export const MEAL_MINUTES = 35;          // 吃一顿饭的时长
export const MEAL_ENERGY = 12;           // 吃饭回的精力
export const HUNGER_POWER_PENALTY = 4;   // 饿着打排位的战力惩罚

/** 训练赛：每天一场，3 局，不动巅峰分 */
export const TRAINING_GAMES = 3;
export const TRAINING_MINUTES = 55;
export const TRAINING_ENERGY = 10;

// ===========================================================================
// 巅峰分
// ===========================================================================

export const RATING_WIN_BASE = 18;
export const RATING_LOSE_BASE = 16;

// ===========================================================================
// 亲密关系
// ===========================================================================

export const INTIMACY_MAX = 100;
/** 一起打一局 +2；对同一个人每天最多 +10 */
export const INTIMACY_PER_GAME = 2;
export const INTIMACY_DAILY_CAP = 10;
/** 绑情侣标的亲密值门槛（只能和 AI 角色绑） */
export const COUPLE_TAG_GATE = 60;
/** 解绑扣的亲密值 */
export const COUPLE_UNBIND_COST = 20;
/** 默认情侣标名 */
export const DEFAULT_COUPLE_TAG = '峡谷同行';

export const INTIMACY_LEVELS = Object.freeze([
    { from: 0, label: '点头之交' },
    { from: 20, label: '固定队友' },
    { from: 40, label: '开黑搭子' },
    { from: 60, label: '默契拍档' },
    { from: 80, label: '灵魂双排' },
]);

export function intimacyLevelLabel(value) {
    const n = Math.max(0, Number(value) || 0);
    let label = INTIMACY_LEVELS[0].label;
    for (const l of INTIMACY_LEVELS) {
        if (n >= l.from) label = l.label;
    }
    return label;
}

// ===========================================================================
// 熟练度
// ===========================================================================

export const PROF_MAX = 100;
/** 用本命英雄打一局 +2 熟练；非本命 +1 */
export const PROF_PER_FOCUS_GAME = 2;
export const PROF_PER_GAME = 1;
/** 熟练度战力加成的档位 */
export function profPowerBonus(prof) {
    const p = Math.max(0, Number(prof) || 0);
    if (p >= 90) return 5;
    if (p >= 60) return 3;
    if (p >= 30) return 0;
    return -3;
}

// ===========================================================================
// 群聊氛围素材池（零 token）
// ===========================================================================

export const COACH_DAILY_POOL = Object.freeze([
    '今天安排：上午自由排位找手感，下午两点训练赛，晚饭后复盘。都把状态给我提起来。',
    '版本改动都看了吗？下午训练赛试新体系，输赢不重要，执行到位。',
    '昨天的问题都写进复盘文档了，今天训练赛我要看到改变。',
    '今天轻量训练，晚上早点休息。赛程密，身体是本钱。',
    '巅峰分掉了的自己加练，具体名单我就不点了，心里有数。',
    '下午训练赛对面是老对手了，把上次输的那套阵容再拉出来练。',
]);

export const COACH_NAG_POOL = Object.freeze([
    '今天的训练赛还没打，人呢？',
    '别光顾着冲分，训练赛才是正课。',
    '提醒一遍：训练赛，下午，别迟到。',
]);

export const TEAMMATE_CHATTER_POOL = Object.freeze([
    '有人双排吗，带我一个',
    '今天食堂的鸡腿饭可以',
    '刚那把对面打野是真的脏',
    '晚上一起看比赛录像？',
    '谁把训练室空调开这么低',
    '新版本这英雄有点东西，推荐练',
]);

// ===========================================================================
// 页面 tab
// ===========================================================================

export const TABS = Object.freeze([
    { id: 'lobby', label: '大厅', icon: 'gamepad' },
    { id: 'season', label: '赛程', icon: 'trophy' },
    { id: 'friends', label: '好友', icon: 'users' },
    { id: 'chats', label: '群聊', icon: 'comment' },
    { id: 'me', label: '我的', icon: 'me' },
]);
