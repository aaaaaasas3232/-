/**
 * 群聊小游戏 / 常量表
 *
 * 这里放三样东西：游戏注册元数据、存储 key、以及**所有节奏数值**。
 *
 * ★ 为什么把节奏数值集中放在这里
 *   原型里 `setTimeout(..., 800)` 这类数字散在六百多行里，改一次节奏要翻遍全文，
 *   而且同一件事（「AI 说完到下一个人」）在夜晚和白天写了两个不同的值 ——
 *   分不清是有意的还是手滑。集中之后，每个数字旁边能写清它是什么，
 *   谁想调手感也知道该动哪一行。
 *
 *   数值本身是照抄原型的，不要随手改：节奏就是手感（AGENTS2 §13.5.2）。
 */

// ---------------------------------------------------------------------------
// 存储
// ---------------------------------------------------------------------------

/**
 * 对局存档。
 *
 * ★ 这个 key 的存在本身就是本次重写最重要的改动之一。
 *   原型三个游戏的对局状态**只活在内存里**（`this.currentGame`），
 *   刷新一下、或者手机休眠一会儿被浏览器回收，一整局就没了 ——
 *   而狼人杀一局要打十几分钟。
 */
export const STORAGE_KEY = 'xiaoting::chat-games-v1';

/** 排行榜累计统计。对局结束时写一次，排行榜页读它。 */
export const STATS_KEY = 'xiaoting::chat-game-stats-v1';

/** 存档结构版本。改了 session 的字段含义就加一，加载时不认识的版本直接丢弃。 */
export const SCHEMA_VERSION = 1;

/**
 * 存档保留时长。
 *
 * 超过这个时间没动过的对局在下次加载时清掉 —— 否则用户开过的每一局
 * 都会永远躺在 localStorage 里。7 天足够覆盖「昨天玩到一半今天接着玩」。
 */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// 游戏元数据
// ---------------------------------------------------------------------------

export const GAME_IDS = Object.freeze({
    WEREWOLF: 'werewolf',
    UNDERCOVER: 'undercover',
    MONOPOLY: 'monopoly',
});

/**
 * 游戏大厅卡片用的元数据。
 * 颜色只放**语义名**（`tone`），具体色值在 CSS 里按 `[data-game-tone]` 给 ——
 * 这样以后 murmur 换皮的时候三张卡会跟着变（AGENTS2 §11.4 ⑦）。
 */
export const GAME_META = Object.freeze({
    [GAME_IDS.WEREWOLF]: {
        id: GAME_IDS.WEREWOLF,
        name: '狼人杀',
        desc: '经典桌游，考验推理与演技',
        tone: 'blue',
        minPlayers: 4,
        maxPlayers: 12,
        tag: '4-12 人',
    },
    [GAME_IDS.UNDERCOVER]: {
        id: GAME_IDS.UNDERCOVER,
        name: '谁是卧底',
        desc: '语言描述，找出隐藏的卧底',
        tone: 'pink',
        minPlayers: 3,
        maxPlayers: 10,
        tag: '3-10 人',
    },
    [GAME_IDS.MONOPOLY]: {
        id: GAME_IDS.MONOPOLY,
        name: '大富翁',
        desc: '掷骰买地收租，看谁先让对手破产',
        tone: 'slate',
        minPlayers: 2,
        maxPlayers: 4,
        tag: '2-4 人',
    },
});

/** 对局状态。`running` 之外的都不再被调度器推进。 */
export const SESSION_STATUS = Object.freeze({
    RUNNING: 'running',
    ENDED: 'ended',
    ABORTED: 'aborted',
});

// ---------------------------------------------------------------------------
// 节奏（毫秒）
// ---------------------------------------------------------------------------

/**
 * 通用节奏。
 *
 * ★ `AI_IDLE_TIMEOUT` 是「一次 AI 请求最多等多久」。
 *   原型没有这个，AI 挂起时整局就永远卡在那一步，按钮全灰，用户只能退出重开。
 */
export const TIMING = Object.freeze({
    /** 调度器扫描间隔。250ms 足够让节奏看起来是连续的，又不会烧 CPU。 */
    TICK: 250,
    /** 单次 AI 请求超时。超时按「AI 没想出来」处理，走各游戏的兜底决策。 */
    AI_TIMEOUT: 45000,
    /** AI 失败重试次数与间隔。 */
    AI_RETRY: 2,
    AI_RETRY_DELAY: 1000,
    /**
     * 「AI 正在思考」的最短展示时长。
     *
     * 接口快的时候（本地代理 200ms 就回来了）一整轮发言会「唰」地刷完，
     * 用户根本来不及读。给一个下限让节奏稳定。
     */
    MIN_THINK: 700,
});

/** 狼人杀节奏。数值来自原型，逐条对照过。 */
export const WEREWOLF_TIMING = Object.freeze({
    OPEN: 500,          // 开局到第一夜
    NIGHT_STEP: 800,    // 夜里两个角色行动之间
    NIGHT_RESOLVE: 1000,// 最后一个角色行动完到结算
    DAWN_LINE: 500,     // 天亮播报逐条
    TO_SPEECH: 1500,    // 播报完到第一个人发言
    TO_NIGHT: 1500,     // 白天结束到入夜
    NEXT_SPEAKER: 800,  // 一个人说完到下一个人
    TO_VOTE: 500,       // 最后一个人说完到投票
    VOTE_REVEAL: 400,   // 唱票逐条
    AFTER_LAST_WORDS: 1000,
    REVIEW_LINE: 700,   // 复盘逐条
});

/** 谁是卧底节奏。 */
export const UNDERCOVER_TIMING = Object.freeze({
    OPEN: 400,
    NEXT_SPEAKER: 1200,
    TO_DISCUSS: 800,
    DISCUSS_REPLY: 1000,
    TO_VOTE: 500,
    VOTE_STEP: 800,
    VOTE_REVEAL: 400,
    NEXT_ROUND: 1500,
    REVIEW_LINE: 1200,
});

/**
 * 大富翁节奏。
 *
 * ★ 前三个数字是**骰子动画的时间契约**，改了就会看到骰子还在转结果就出来了：
 *   ROLL_SPIN 必须等于 CSS `@keyframes cgRoll` 的时长，
 *   ROLL_SETTLE 必须等于 `.cg-dice` 的 transition 时长。
 */
export const MONOPOLY_TIMING = Object.freeze({
    ROLL_SPIN: 1500,    // 翻滚动画（= CSS cgRoll 1.5s）
    ROLL_SETTLE: 800,   // 停稳到开始走棋（原型是 setTimeout(...,800)）
    STEP: 220,          // 每走一格
    LAND: 500,          // 落地到触发格子事件
    EVENT: 900,         // 事件结算停留
    NEXT_TURN: 900,     // 交给下一位
    AI_ROLL: 1200,      // 轮到 AI 后多久自己掷
});
