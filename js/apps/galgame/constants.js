/**
 * 湛蓝回忆 · 常量与默认值
 *
 * ★ 这个文件里**一个颜色都没有**。
 *   配色全部在 `css/apps/galgame/_theme.css` 的 `--gg-*` token 里,
 *   JS 只认 token 名(见 `theme.js` 的 COLOR_CATEGORIES)。
 *   原型 `湛蓝回忆.html` 其实也有一套 `:root` 变量,但同时散着上百处硬编码
 *   hex 和 inline style,换主题时那些纹丝不动 —— 这次让「不写 hex」成为物理约束。
 */

// ============================================================
// 表名 / 存储键
// ============================================================

export const STORE_GAMES = 'ggGames';
export const STORE_NODES = 'ggNodes';
export const STORE_LIBRARY = 'ggLibrary';

/** ggLibrary 是单例表,永远只有这一条 */
export const LIBRARY_KEY = 'root';

export const GG_STORES = Object.freeze([
    { name: STORE_GAMES, keyPath: 'id' },
    {
        name: STORE_NODES,
        keyPath: 'id',
        // 按局取节点是最高频的读操作,建索引免得全表扫
        indexes: [{ name: 'gameId', keyPath: 'gameId' }],
    },
    { name: STORE_LIBRARY, keyPath: 'id' },
]);

// ============================================================
// 超时
// ============================================================

export const TIMEOUT = Object.freeze({
    /** 普通(非流式)请求总时长 */
    normal: 90000,
    /**
     * 流式**空闲**超时:连续这么久没有新数据才算挂了。
     * 不是总时长 —— 生成一段两百字剧情跑一分钟很正常,总时长超时会把正常请求掐死。
     */
    streamIdle: 60000,
});

// ============================================================
// 输出协议
// ============================================================

/**
 * AI 一次返回「剧情 + 场景 + 情绪 + 选项」四段。
 *
 * ★ 原型是**两次**调用:先要剧情,再拿剧情去要选项。两个问题:
 *   1. 两倍延迟、两倍花费;
 *   2. 第二次调用的 system prompt 是拿第一次的
 *      `currentSystemPrompt.replace(/你的输出应该只包含剧情文本.*?为主角的反应留出空间。/s, ...)`
 *      正则改出来的 —— 而那段文字是运行时按世界观拼的,改一个字正则就失配,
 *      失配时会把「不要生成选项」原样发出去,然后要求它生成选项,自相矛盾。
 *   现在一次拿全,格式由 `parseStoryResponse` 解析,少一个环节就少一类 bug。
 */
export const TAGS = Object.freeze({
    text: 'TEXT',
    name: 'NAME',
    scene: 'SCENE',
    mood: 'MOOD',
    options: 'OPTIONS',
});

/** 立绘情绪 —— 和 `TAGS.mood` 里 AI 能填的值一一对应 */
export const MOODS = Object.freeze([
    { id: 'default', label: '默认' },
    { id: 'happy', label: '开心' },
    { id: 'angry', label: '愤怒' },
    { id: 'sad', label: '伤心' },
    { id: 'surprised', label: '惊讶' },
    { id: 'shy', label: '害羞' },
    { id: 'confused', label: '疑惑' },
]);

export const MOOD_IDS = Object.freeze(MOODS.map((m) => m.id));

/** AI 可能用中文写情绪名,这里做一层归一 */
export const MOOD_ALIAS = Object.freeze({
    默认: 'default', 平静: 'default', 普通: 'default', normal: 'default',
    开心: 'happy', 高兴: 'happy', 微笑: 'happy', 喜悦: 'happy',
    愤怒: 'angry', 生气: 'angry', 恼怒: 'angry',
    伤心: 'sad', 难过: 'sad', 哭: 'sad', 失落: 'sad',
    惊讶: 'surprised', 吃惊: 'surprised', 震惊: 'surprised',
    害羞: 'shy', 羞涩: 'shy', 脸红: 'shy',
    疑惑: 'confused', 困惑: 'confused', 不解: 'confused',
});

// ============================================================
// 题材
// ============================================================

export const GENRES = Object.freeze([
    { id: '', label: '不限' },
    { id: 'romance', label: '恋爱向' },
    { id: 'adventure', label: '冒险向' },
    { id: 'mystery', label: '悬疑向' },
    { id: 'fantasy', label: '奇幻向' },
    { id: 'scifi', label: '科幻向' },
    { id: 'daily', label: '日常向' },
    { id: 'healing', label: '治愈向' },
    { id: 'thriller', label: '惊悚向' },
]);

// ============================================================
// 上下文分段
// ============================================================

/**
 * prompt 的分段清单。
 *
 * `locked` 的段不给用户关 —— 关掉「编剧须知」和「输出格式」之后 AI 会开始写散文,
 * 解析器一条都认不出来,表现是「点了没反应」。
 *
 * 顺序就是默认注入顺序;用户可以在「上下文」面板里拖，存到 `game.contextOrder`。
 */
export const CONTEXT_SECTIONS = Object.freeze([
    { id: 'system', tag: '编剧须知', label: '编剧须知', locked: true, desc: '内置' },
    { id: 'world', tag: '世界观', label: '世界观', desc: 'nook' },
    { id: 'player', tag: '玩家', label: '玩家身份', desc: 'nook' },
    { id: 'cast', tag: '角色', label: '出场角色', desc: 'nook + 本机' },
    { id: 'scenes', tag: '场景', label: '可用场景', desc: 'nook + 本机' },
    { id: 'quest', tag: '主线', label: '主线任务', desc: '本机' },
    { id: 'affection', tag: '好感度', label: '好感度状态', desc: '本机' },
    { id: 'memory', tag: 'K链记忆', label: 'K 链记忆', desc: '自动压缩' },
    { id: 'notes', tag: '手记', label: '手动记忆', desc: '本机' },
    { id: 'recent', tag: '近期剧情', label: '近期剧情原文', desc: '滑动窗口' },
    { id: 'custom', tag: '自定义', label: '自定义提示词', desc: '本机' },
    { id: 'format', tag: '输出格式', label: '输出格式', locked: true, desc: '内置' },
]);

export function createDefaultContextConfig() {
    const out = {};
    for (const s of CONTEXT_SECTIONS) out[s.id] = true;
    return out;
}

// ============================================================
// 剧本(预设流程)
// ============================================================

/**
 * 「指导 prompt」的分段清单。
 *
 * 和 `CONTEXT_SECTIONS` 是两套:那一套是**边玩边生成**要用的上下文,
 * 这一套是**一次性写完整份剧本**要用的。共用一套的话会同时出现
 * 「一次只写一小段」和「把整个故事写完」两条互相打架的指令 ——
 * 原型就是栽在这种自相矛盾的 prompt 上(见 constants.TAGS 的注释)。
 *
 * `locked` 的三段是格式本身,关掉之后 AI 会写成小说,一行都解析不出来。
 */
export const SCRIPT_SECTIONS = Object.freeze([
    { id: 'role', tag: '剧本编剧须知', label: '编剧须知', locked: true, desc: '内置' },
    { id: 'world', tag: '世界观', label: '世界观', desc: 'nook' },
    { id: 'player', tag: '玩家', label: '玩家身份', desc: 'nook' },
    { id: 'cast', tag: '角色', label: '出场角色', desc: 'nook + 本机' },
    { id: 'scenes', tag: '场景', label: '可用场景', desc: 'nook + 本机' },
    { id: 'flow', tag: '我的游戏流程', label: '我写的游戏流程', desc: '你写的' },
    { id: 'budget', tag: '篇幅', label: '篇幅与分支', desc: '本机' },
    { id: 'format', tag: '剧本格式', label: '剧本格式', locked: true, desc: '内置' },
    { id: 'example', tag: '格式示例', label: '格式示例', locked: true, desc: '内置' },
    { id: 'rules', tag: '硬性要求', label: '硬性要求', locked: true, desc: '内置' },
]);

/** 生成整份剧本时的默认篇幅 */
export const SCRIPT_BUDGET = Object.freeze({
    /** 一共写几幕 */
    nodeCount: 12,
    /** 每一幕给几条选项 */
    branches: 2,
    /** 至少要有几个结局 */
    endings: 2,
});

/** 用户写的「游戏流程」上限 —— 再长就该拆成几份剧本了 */
export const SCRIPT_FLOW_MAX = 4000;

// ============================================================
// K 链记忆
// ============================================================

/**
 * K 链 = 滑动窗口 + 迭代式增量压缩。
 *
 * 一个「单元」要么是一条真实回合(r),要么是一次压缩产物(k)。
 * 单元满 `windowSize` 个就把它们整体打包压成一个新的 k,窗口重置成 `[k]`。
 *
 *   R1 R2 R3 R4            → 满 4 → K0            窗口 [K0]
 *   K0 R5 R6 R7            → 满 4 → K1            窗口 [K1]
 *   K1 R8 R9 R10           → 满 4 → K2            窗口 [K2]
 *
 * ★ 窗口状态是**每个节点自己的**(存在 `node.kState`),不是全局的。
 *   所以回到旧节点开新分支时,拿到的是那个节点当时的窗口 ——
 *   「那条故事线还没到该生成 K 的时候」这件事就自然成立了,不需要任何额外判断。
 */
export const KCHAIN_DEFAULTS = Object.freeze({
    enabled: true,
    /** 几个单元触发一次压缩 */
    windowSize: 4,
    /**
     * 除了窗口里的 r 单元,再额外保留最近几回合的**原文**。
     *
     * 为什么需要:压缩刚发生的那一瞬间窗口只剩一个 k,如果不留原文,
     * 下一轮 AI 手上一句原话都没有,人物立刻会「失忆式」跳戏。
     * 留 2 回合原文的代价很小,效果差别很明显。设 0 就是严格按窗口走。
     */
    rawTail: 2,
    /** 满了自动压缩;关掉就只在记忆面板里手动点 */
    autoCompress: true,
});

// ============================================================
// 默认设置
// ============================================================

export function createDefaultSettings() {
    return {
        theme: 'azure',
        customThemeColors: {},
        customThemes: [],
        activeCustomThemeId: '',

        kChain: { ...KCHAIN_DEFAULTS },

        /** 逐字机 */
        typewriter: true,
        typeSpeed: 28,          // ms / 字
        /** 流式生成 */
        stream: true,
        /** 一次给几个选项 */
        optionCount: 3,
        /** 一段剧情最多几句 */
        maxSentences: 5,
        temperature: 0.85,

        /** AI 判定好感度变化(每次选择后一次额外调用) */
        autoAffection: true,
        /** 显示立绘 */
        showSprite: true,
        /** 显示场景背景 */
        showScene: true,
    };
}

export function createDefaultQuest() {
    return { title: '', description: '', completed: false, completedAt: 0 };
}

// ============================================================
// UI
// ============================================================

/**
 * 舞台顶部那一排菜单键。
 *
 * ★ 新面板一律**追加在末尾**:`tests/e2e/__probe-galgame.mjs` 的浏览器半段是按下标
 *   `.gg-menu-btn[i]` 点面板的,插在中间会让那一串断言集体错位。
 */
export const PANELS = Object.freeze([
    { id: 'tree', label: '剧情树', icon: 'tree' },
    { id: 'log', label: '回顾', icon: 'log' },
    { id: 'prompt', label: '提示词', icon: 'sparkle' },
    { id: 'memory', label: '记忆', icon: 'memory' },
    { id: 'cg', label: 'CG', icon: 'gallery' },
    { id: 'save', label: '存档', icon: 'save' },
    { id: 'world', label: '设定', icon: 'globe' },
    { id: 'theme', label: '外观', icon: 'palette' },
    { id: 'script', label: '剧本', icon: 'script' },
]);

/** 单条选项最长字数 —— 超过就是 AI 没听话,截断显示 */
export const OPTION_MAX_CHARS = 60;

/** 自定义剧情输入上限 */
export const CUSTOM_PLOT_MAX = 500;

/** 剧情树一屏最多渲染多少节点(超过给「只看当前线」开关) */
export const TREE_SOFT_LIMIT = 240;
