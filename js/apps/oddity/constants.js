/**
 * 小奇怪 · 常量与默认值
 *
 * ★ 这个文件里**一个 hex 颜色都没有**。
 *   莫兰迪色板、主题变量全部在 `css/apps/oddity/index.css` 的 `--oq-*` 里,
 *   JS 只认 token 名(见 `theme.js`)。原型那几个 HTML 到处散着 inline hex,
 *   换个色调要改二十处 —— 这次让「不写 hex」成为物理约束。
 */

// ============================================================
// 表名 / 存储键
// ============================================================

export const STORE_LIBRARY = 'oqLibrary';
export const STORE_GAMES = 'oqGames';
export const STORE_SCORES = 'oqScores';
/**
 * 匿名三件套(回答箱 / 收信箱 / 漂流瓶)。
 *
 * ★ 为什么不塞进 `oqLibrary`:这三个页面每写一句话就要落盘一次,
 *   而 library 里躺着一百多条收藏 —— 合表就是「每回一句话把收藏重新序列化一遍」。
 *   分表的理由和 `oqGames` 完全一样(按写入频率切,不按业务切)。
 */
export const STORE_ANON = 'oqAnon';

/** oqLibrary 是单例表,永远只有这一条 */
export const LIBRARY_KEY = 'root';

/**
 * oqGames 里「当前这一局」的固定 id。
 *
 * ★ 用固定 id 而不是 `game-${Date.now()}`:一个玩法同时只可能有一局在进行中,
 *   固定 id 让「切走再切回来还在原局」变成 put 覆盖,不需要额外记「哪局是活的」。
 *   打完归档的那份才用时间戳 id(见 `ARCHIVE_PREFIX`)。
 */
export const GAME_MINESWEEPER = 'minesweeper';
export const GAME_HAVEYOU = 'haveyou';
export const GAME_GOMOKU = 'gomoku';
export const ARCHIVE_PREFIX = 'arc';

/** oqAnon 的三条单例记录 */
export const ANON_ASKBOX = 'askbox';
export const ANON_LETTERBOX = 'letterbox';
export const ANON_BOTTLE = 'bottle';

export const OQ_STORES = Object.freeze([
    { name: STORE_LIBRARY, keyPath: 'id' },
    { name: STORE_GAMES, keyPath: 'id' },
    { name: STORE_SCORES, keyPath: 'id' },
    { name: STORE_ANON, keyPath: 'id' },
]);

// ============================================================
// 超时
// ============================================================

export const TIMEOUT = Object.freeze({
    /** 普通(非流式)请求总时长 */
    normal: 60000,
    /**
     * 流式**空闲**超时:连续这么久没有新数据才算挂了。
     * 不是总时长 —— 一句台词生成十几秒很正常。
     */
    streamIdle: 45000,
});

// ============================================================
// 导航
// ============================================================

/**
 * 自绘底栏的四个 tab。
 *
 * `glyph` 是栏上那颗圆球里嵌的汉字 —— 用字不用 emoji(用户明确要求全站无 emoji)。
 */
export const TABS = Object.freeze([
    { id: 'play', glyph: '玩', label: '玩', desc: '两个人一起折腾' },
    { id: 'pinch', glyph: '捏', label: '捏', desc: '手闲的时候按两下' },
    { id: 'watch', glyph: '看', label: '看', desc: '什么都不干,就看着' },
    { id: 'favorite', glyph: '藏', label: '藏', desc: '收藏的心事与碎片' },
]);

/**
 * 每个 tab 下面的小东西。
 *
 * `immersive` 的那几个进去之后顶栏收成一条细浮条(`oq-slimbar`)。
 *
 * ★ 「看」下面**五个全部** immersive。之前只有沙漏是,结果在沙漏里是细浮条、
 *   切到打字机就变回一整块顶栏 + chip 行 —— 同一个 tab 里两套顶栏,
 *   每切一次页面整体上下跳一次。细浮条那套是用户明确喜欢的,那就全用它。
 * ★ `tools` 是这个小东西要不要在细浮条上挂工具键。没有工具的页面不挂,
 *   免得点开是个空面板。
 */
export const TAB_ITEMS = Object.freeze({
    play: [
        { id: 'minesweeper', label: '扫雷', sub: '点格子就扫,能拉 AI 对战' },
        { id: 'gomoku', label: '五子棋', sub: '五连即胜,能拉 AI 对弈' },
        { id: 'haveyou', label: '你有我没有', sub: '和 AI 拼谁的经历更离谱' },
    ],
    pinch: [
        { id: 'jelly', label: '果冻心', sub: '按一下会疼,摸一下会暖', tools: true },
    ],
    watch: [
        { id: 'hourglass', label: '沙漏', sub: '手机颠倒,表里翻转', immersive: true, tools: true },
        { id: 'typewriter', label: '打字机', sub: '写下又删除的是什么', immersive: true, tools: true },
        { id: 'askbox', label: '回答箱', sub: '有人匿名在问你', immersive: true, tools: true },
        { id: 'letterbox', label: '收信箱', sub: '你匿名去问别人', immersive: true, tools: true },
        { id: 'bottle', label: '漂流瓶', sub: '写一个,换一个', immersive: true, tools: true },
    ],
    favorite: [
        { id: 'favorites', label: '收藏夹', sub: '心跳瞬间、沙漏心语与踌躇记录' },
    ],
});

export const DEFAULT_SUB_TABS = Object.freeze({
    play: 'minesweeper',
    pinch: 'jelly',
    watch: 'hourglass',
    favorite: 'favorites',
});

// ============================================================
// 扫雷
// ============================================================

export const MS = Object.freeze({
    rows: 9,
    cols: 9,
    /** 用户要求:雷的数量 > 9 且 < 11 —— 也就是恰好 10 颗 */
    mines: 10,
    /** 没碰到雷 +1 */
    scoreSafe: 1,
    /** 碰到雷 -5 */
    scoreMine: -5,
});

/**
 * 两个座位的默认形状。
 * `token` 对应 CSS 里 `.oq-ms-cell[data-by]` 的染色 —— 谁翻开的格子带谁的色。
 * 名字只是兜底,开局时会被真实座位名(用户人设 / AI 人设)覆盖。
 */
export const MS_PLAYERS = Object.freeze([
    { id: 'p1', name: '玩家一', token: 'ring' },
    { id: 'p2', name: '玩家二', token: 'gem' },
]);

/**
 * 对手是谁。三种口味共用同一个引擎,只是 p2 的驱动方不同:
 *   local  同一台手机上的第二个真人
 *   ai     nook 里的 AI 人设(有 Key 调模型选格,没 Key 走本地棋手)
 */
export const OPPONENT_MODES = Object.freeze([
    { id: 'ai', label: '拉 AI 一起玩', desc: '从 nook 挑一个人设,它自己动手' },
    { id: 'local', label: '本地双人', desc: '两个人轮流用同一台手机' },
]);

// ============================================================
// 五子棋
// ============================================================

export const GO = Object.freeze({
    size: 15,
    /** 连成几子算赢 */
    winLen: 5,
});

// ============================================================
// 你有我没有
// ============================================================

export const HY = Object.freeze({
    /** 每人 5 条命 */
    lives: 5,
    /** 用户 + 最多 3 个 AI 座位(AGENTS.md §7 跨时空回合制的上限) */
    maxAiSeats: 3,
    /** 一条声明最多多少字 —— 超过就是在写小作文,不是在玩游戏 */
    claimMaxChars: 40,
    /** 声明判重时保留多少条历史 */
    claimMemory: 200,
});

/**
 * 规则正文。UI 和 prompt **共用这一份** ——
 * 分成两份写的话,AI 按 A 规则玩、界面按 B 规则判,谁都不会报错。
 */
export const HY_RULES = Object.freeze([
    '轮到你时,说一件「我有、但我猜你们都没有」的事。',
    '其他还活着的人逐个表态:我也有 / 我没有。',
    '没有人跟着有 → 声明成立,其余每人各扣 1 点。',
    '有人跟着有 → 声明失败,声明者自己扣 1 点。',
    '说出和之前重复的声明 → 直接扣 1 点,本轮作废。',
    '每人 5 点,扣完出局,最后一个活着的人赢。',
]);

// ============================================================
// 上下文分段(你有我没有的 prompt 层)
// ============================================================

/**
 * prompt 的分段清单,和 galgame 一个口径。
 *
 * `locked` 的段不给用户关 —— 关掉「扮演须知」和「输出格式」之后 AI 会开始写散文,
 * JSON 解析一条都认不出来,表现是「AI 一直跳过」。
 */
export const CONTEXT_SECTIONS = Object.freeze([
    { id: 'system', tag: '扮演须知', label: '扮演须知', locked: true, desc: '内置' },
    { id: 'world', tag: '世界观', label: '世界观', desc: 'nook' },
    { id: 'seat', tag: '你是谁', label: '你扮演的座位', desc: 'nook' },
    { id: 'rivals', tag: '牌桌', label: '同桌的人', desc: 'nook + 本机' },
    { id: 'rules', tag: '规则', label: '游戏规则', locked: true, desc: '内置' },
    { id: 'used', tag: '已出过的声明', label: '已出过的声明', desc: '本局' },
    { id: 'recent', tag: '最近几轮', label: '最近几轮实况', desc: '滑动窗口' },
    { id: 'custom', tag: '自定义', label: '自定义提示词', desc: '本机' },
    { id: 'format', tag: '输出格式', label: '输出格式', locked: true, desc: '内置' },
]);

export function createDefaultContextConfig() {
    const out = {};
    for (const section of CONTEXT_SECTIONS) out[section.id] = true;
    return out;
}

// ============================================================
// 字幕生成器
// ============================================================

/**
 * 版式。
 *
 * `width` 是整块的字符宽度(等宽字体下的列数),`insetRatios` 是第 2 / 4 行
 * 那两个词的起始列占总宽的比例,`centerTrim` 是中间那行比外圈窄多少列。
 *
 * ★ 这三个数是**量着用户给的样例反推**出来的,不是随手填的:
 *   样例里 ˡᵒᵛᵉ 版外圈总宽 49 列,内圈两个词起始列 12 / 36(= 49 × 0.245 / 0.735),
 *   中间那行总宽 45(= 49 − 4)。换任何词、换任何版式都按这套比例走,
 *   所以中文中心词、超长环绕词也不会散架。
 */
export const SUBTITLE_VARIANTS = Object.freeze([
    { id: 'standard', label: '5 行标准', width: 49, insetRatios: [0.245, 0.735], centerTrim: 4 },
    { id: 'compact', label: '紧凑', width: 33, insetRatios: [0.245, 0.735], centerTrim: 3 },
    { id: 'roomy', label: '宽松', width: 65, insetRatios: [0.245, 0.735], centerTrim: 6 },
]);

export const SUBTITLE_DEFAULTS = Object.freeze({
    surround: 'love',
    center: 'HER',
    variant: 'standard',
    upperCenter: true,
});

// ============================================================
// 收藏上限
// ============================================================

/** 收藏上限 —— 再多就成了翻不到底的列表 */
export const FAVORITE_LIMIT = 120;

// ============================================================
// 果冻心
// ============================================================

export const JELLY = Object.freeze({
    /** 短于这个时间、几乎没动 = 快速戳 = 疼 */
    tapMs: 160,
    /** 长于这个时间且有位移 = 抚摸 */
    strokeMs: 240,
    /** 互动过程里冒话的间隔 */
    lineGapMs: 820,
    /** 同屏最多几条气泡 —— 不限的话连续拖会糊成一片 */
    maxBubbles: 6,
    /** 默认粉色果冻心色值 (莫兰迪半透明粉) */
    defaultFill: 'rgba(244, 162, 197, 0.78)',
    hurtFill: 'rgba(255, 100, 140, 0.88)',
    sootheFill: 'rgba(248, 185, 212, 0.92)',
});

// ============================================================
// 沙漏（黑白颠倒与双面心语）
// ============================================================

export const HOURGLASS = Object.freeze({
    /** 静息水位(占整屏高度的百分比) */
    restLevel: 25,
    /** 倒置水位 */
    flipLevel: 80,
    /** 拖动时允许的水位范围 */
    minLevel: 6,
    maxLevel: 94,
    /** 翻转手机判定角度阈值 (beta) */
    tiltThreshold: 45,
});

// ============================================================
// 打字机（欲言又止与踌躇动效）
// ============================================================

export const TYPEWRITER = Object.freeze({
    /** 打字速度 (每个字毫秒数) */
    typeSpeedMs: 120,
    /** 删除速度 (每个字毫秒数) */
    deleteSpeedMs: 70,
    /** 犹豫停顿时间 */
    pauseMs: 1400,
    /** 最大历史草稿数 */
    maxHistory: 30,
});

// ============================================================
// 匿名三件套（回答箱 / 收信箱 / 漂流瓶）
// ============================================================

/**
 * 匿名代号。
 *
 * ★ 用「匿名用户 A/B/C」而不是 AI 的真名 —— 回答箱的整个玩法就建立在
 *   「你不知道这句话是谁说的」上面。代号在**落盘时**就定死并打乱,
 *   不是渲染时按数组下标生成:按下标生成的话,列表一排序代号就跟着变,
 *   用户能靠「昨天 A 是这句、今天 A 是那句」反推出是谁。
 */
export const ANON_ALPHABET = Object.freeze([
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M',
    'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
]);

export const ANON = Object.freeze({
    /** 一次「召唤一批」最多请求几个 AI —— 再多用户读不完,而且每个都是一次请求 */
    maxRoster: 12,
    /** 一条匿名对话保留多少轮(超出的从头砍) */
    threadLimit: 40,
    /** 回答箱 / 收信箱各自最多留多少条 */
    listLimit: 60,
    /** 漂流瓶最多留几轮 */
    roundLimit: 12,
    /** 单条正文上限 */
    textMax: 300,
    /** 喂给 murmur 的匿名概要最多几条 */
    briefLimit: 10,
});
