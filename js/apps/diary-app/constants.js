/**
 * 日记 · 枚举与默认值
 *
 * ★ 这个文件里**一个颜色值都没有**。主题只有 id，实际色值全在
 *   `css/apps/diary/_theme.css`。这是项目硬规矩：颜色的唯一真相在 CSS，
 *   JS 只搬运 id。（dream-weaver 原型栽在「JS 里一套色表 + 694 处硬编码 hex」上，
 *   换主题时纹丝不动。）
 *
 * ★ 也**没有 emoji**。所有状态标识用文字或 `icons.js` 里的线性 SVG。
 */

// ============================================================
// 空间
// ============================================================

/** 空间 = 一个人的日记本。用户一个，每个 AI 各一个。 */
export const OWNER_KIND = Object.freeze({ USER: 'user', AI: 'ai' });

export function makeSpaceId(ownerKind, ownerId) {
    return `${ownerKind}:${ownerId}`;
}

export function parseSpaceId(spaceId) {
    const raw = String(spaceId || '');
    const at = raw.indexOf(':');
    if (at === -1) return { ownerKind: OWNER_KIND.USER, ownerId: raw };
    return { ownerKind: raw.slice(0, at), ownerId: raw.slice(at + 1) };
}

// ============================================================
// 主题（莫兰迪）
// ============================================================

/**
 * 莫兰迪配色预设。低饱和、带灰调、无渐变。
 * `id` 会写到 `.app-shell` 的 `data-diary-theme` 上，色值由 `_theme.css` 认领。
 */
export const THEMES = Object.freeze([
    { id: 'oat', name: '燕麦', desc: '暖白与浅灰褐，最接近纸' },
    { id: 'clay', name: '陶土', desc: '褪色的砖红' },
    { id: 'sage', name: '鼠尾草', desc: '灰调的绿' },
    { id: 'mist', name: '雾蓝', desc: '阴天的窗' },
    { id: 'lilac', name: '藕荷', desc: '很淡的紫灰' },
    { id: 'ink', name: '墨', desc: '深色，夜里写字用' },
]);

export const DEFAULT_THEME = 'oat';

/** 排版风格 —— 影响字号、行距、纸张纹理，不影响颜色 */
export const LAYOUT_STYLES = Object.freeze([
    { id: 'plain', name: '素', desc: '无装饰，留白最多' },
    { id: 'ruled', name: '横线', desc: '淡淡的横格' },
    { id: 'grid', name: '方格', desc: '方格纸' },
]);

export const DEFAULT_LAYOUT = 'plain';

/** 正文字号档位（px），存 id 不存值，CSS 按 `data-diary-scale` 取 */
export const TEXT_SCALES = Object.freeze([
    { id: 'sm', name: '小' },
    { id: 'md', name: '中' },
    { id: 'lg', name: '大' },
]);

// ============================================================
// 写作时段
// ============================================================

/** 时段固定 5 小时；起点最晚 19 点，保证 24:00 前结束 */
export const WINDOW_HOURS = 5;
export const WINDOW_START_MIN = 0;
export const WINDOW_START_MAX = 19;
export const DEFAULT_WINDOW_START = 19;

// ============================================================
// 条目
// ============================================================

/**
 * 一天只能有一篇 `diary`；时段外写的一律是 `note`（便利贴，不限篇数）。
 * AI 生成的也走同一套判定 —— 这是产品的核心规则，不给任何绕过的口子。
 */
export const ENTRY_KIND = Object.freeze({ DIARY: 'diary', NOTE: 'note' });

/** 心情。**纯文字，不用 emoji**；色块由 CSS 按 `data-mood` 上色。 */
export const MOODS = Object.freeze([
    { id: 'calm', name: '平静' },
    { id: 'glad', name: '愉快' },
    { id: 'tender', name: '柔软' },
    { id: 'tired', name: '疲惫' },
    { id: 'low', name: '低落' },
    { id: 'anxious', name: '烦躁' },
    { id: 'blank', name: '空白' },
]);

export const WEATHERS = Object.freeze([
    { id: 'sunny', name: '晴' },
    { id: 'cloudy', name: '阴' },
    { id: 'rain', name: '雨' },
    { id: 'snow', name: '雪' },
    { id: 'wind', name: '风' },
]);

// ============================================================
// 纪念日 / 计划
// ============================================================

/**
 * `anniversary` 是**过去**的日子（相识、生日）→ 显示「已经 N 天」
 * `countdown`   是**将来**的事（音乐会、考试）→ 显示「还有 N 天」
 *
 * 两者共用一张表，靠 kind 区分。分成两张表的话「某个纪念日想改成倒计时」
 * 就得跨表搬家，而这是很常见的操作（考试考完了就变成纪念日）。
 */
export const MARKER_KIND = Object.freeze({ ANNIVERSARY: 'anniversary', COUNTDOWN: 'countdown' });

export const REPEAT_RULES = Object.freeze([
    { id: 'none', name: '不重复' },
    { id: 'yearly', name: '每年' },
    { id: 'monthly', name: '每月' },
]);

// ============================================================
// 经期
// ============================================================

/**
 * 推算方式。
 *
 * `monthday` 对应用户说的「一般每个月八号来」—— 按公历固定日期。
 * `cycle`    按周期天数从上次开始日往后推，更符合生理规律。
 *
 * 两种都要有：很多人心里记的就是「八号」，强行让她改成「28 天周期」
 * 反而对不上她自己的认知。
 */
export const CYCLE_MODE = Object.freeze({ MONTH_DAY: 'monthday', CYCLE_LENGTH: 'cycle' });

/** 每日打卡的三态。`none` 是「明确记录了今天没来」，和「还没记」必须分开。 */
export const CYCLE_STATE = Object.freeze({ UNKNOWN: 'unknown', PERIOD: 'period', NONE: 'none' });

/**
 * 打卡维度。`defaultOn` 的几项开箱可见，其余在「记录项」里自行打开 ——
 * 一次性铺十个维度会让每天打卡变成负担，而砍掉又满足不了「比市面上都细」。
 */
export const TRACK_FIELDS = Object.freeze([
    { id: 'pain', name: '痛经', desc: '程度 + 部位', defaultOn: true },
    { id: 'mood', name: '情绪', desc: '当天的状态', defaultOn: true },
    { id: 'meds', name: '用药', desc: '止痛药 / 其他', defaultOn: true },
    { id: 'product', name: '卫生用品', desc: '类型与更换次数', defaultOn: true },
    { id: 'note', name: '备注', desc: '自由文字', defaultOn: true },
    { id: 'flow', name: '经量', desc: '点滴到超多', defaultOn: false },
    { id: 'symptom', name: '身体症状', desc: '头痛 / 腹胀 / 长痘…', defaultOn: false },
    { id: 'discharge', name: '分泌物', desc: '性状（备孕 / 健康向）', defaultOn: false },
    { id: 'temp', name: '基础体温', desc: '每天固定时间量', defaultOn: false },
    { id: 'intimacy', name: '同房', desc: '含避孕与否', defaultOn: false },
]);

export const FLOW_LEVELS = Object.freeze([
    { id: 'spot', name: '点滴', level: 1 },
    { id: 'light', name: '少', level: 2 },
    { id: 'medium', name: '中', level: 3 },
    { id: 'heavy', name: '多', level: 4 },
    { id: 'flood', name: '超多', level: 5 },
]);

export const PAIN_LEVELS = Object.freeze([
    { id: 'none', name: '不痛', level: 0 },
    { id: 'mild', name: '轻微', level: 1 },
    { id: 'moderate', name: '明显', level: 2 },
    { id: 'severe', name: '难受', level: 3 },
    { id: 'extreme', name: '影响生活', level: 4 },
]);

export const PAIN_SPOTS = Object.freeze([
    { id: 'lower', name: '小腹' },
    { id: 'waist', name: '腰' },
    { id: 'back', name: '后背' },
    { id: 'leg', name: '腿根' },
    { id: 'head', name: '头' },
    { id: 'breast', name: '乳房' },
]);

export const SYMPTOMS = Object.freeze([
    { id: 'headache', name: '头痛' },
    { id: 'bloating', name: '腹胀' },
    { id: 'acne', name: '长痘' },
    { id: 'sleepy', name: '嗜睡' },
    { id: 'insomnia', name: '失眠' },
    { id: 'appetite', name: '食欲变化' },
    { id: 'nausea', name: '恶心' },
    { id: 'dizzy', name: '头晕' },
    { id: 'swelling', name: '水肿' },
    { id: 'tender', name: '乳房胀痛' },
]);

export const DISCHARGE_TYPES = Object.freeze([
    { id: 'none', name: '无' },
    { id: 'sticky', name: '黏稠' },
    { id: 'creamy', name: '乳状' },
    { id: 'watery', name: '稀薄' },
    { id: 'eggwhite', name: '蛋清拉丝' },
]);

export const PRODUCT_TYPES = Object.freeze([
    { id: 'pad', name: '卫生巾' },
    { id: 'tampon', name: '棉条' },
    { id: 'cup', name: '月经杯' },
    { id: 'disc', name: '月经碟' },
    { id: 'period_underwear', name: '生理裤' },
]);

/**
 * 周期阶段。用于给用户看，也进 prompt。
 * 「排卵期」是推算值不是实测值，文案里必须写成「大约」——
 * 说死了会让 AI 在聊天里给出不该有的确定性。
 */
export const CYCLE_PHASES = Object.freeze([
    { id: 'menstrual', name: '经期' },
    { id: 'follicular', name: '卵泡期' },
    { id: 'ovulation', name: '排卵期前后' },
    { id: 'luteal', name: '黄体期' },
    { id: 'late', name: '推迟' },
    { id: 'unknown', name: '未知' },
]);

/**
 * AI 该用什么态度提这件事。
 *
 * 这一项存在的理由：不同世界观下「月经」的含义完全不同 —— 现代都市里
 * 是私事，架空设定里可能是禁忌、也可能是完全公开的生理常识。
 * 让用户选口吻，比让 AI 自己猜稳。
 */
export const CARE_TONES = Object.freeze([
    { id: 'caring', name: '主动关心', desc: '会问一句、会记得让你别喝凉的' },
    { id: 'quiet', name: '安静照顾', desc: '不明说，但行为上照顾着' },
    { id: 'plain', name: '平常心', desc: '当成普通身体状况，不特别渲染' },
    { id: 'avoid', name: '不主动提', desc: '知道，但除非你先说，否则不提' },
]);

export const DEFAULT_CYCLE = Object.freeze({
    enabled: false,
    mode: CYCLE_MODE.MONTH_DAY,
    startDay: 8,
    cycleLength: 28,
    periodLength: 7,
    irregular: false,
    remindDaysBefore: 2,
    lastStart: '',
    careTone: 'caring',
    worldNote: '',
    customPrompt: '',
    trackFields: TRACK_FIELDS.filter((f) => f.defaultOn).map((f) => f.id),
});

/** 判定「紊乱」的阈值：近几次实测周期的极差超过这么多天 */
export const IRREGULAR_SPREAD_DAYS = 7;
/** 至少要有这么多次实测周期才敢下「规律 / 紊乱」的结论 */
export const MIN_CYCLES_FOR_JUDGEMENT = 3;

// ============================================================
// 上下文分段
// ============================================================

/**
 * Prompt 的段落定义 —— 顺序即默认注入顺序。
 *
 * `locked` 的段不给用户关：关掉「写作须知」AI 会开始写小作文，
 * 关掉「回写格式」它就不会用 `[记纪念日:]` 这类 token 了。
 *
 * `tag` 是 `<XX开始>` / `<XX结束>` 里的名字，用于按段替换 ——
 * 发布后**不要改**，改了老快照剪不干净（AGENTS2 §4.3 同款约定）。
 */
export const CONTEXT_SECTIONS = Object.freeze([
    { id: 'writeRules', tag: '写日记须知', label: '写作须知', locked: true, desc: '硬约束' },
    { id: 'identity', tag: '我是谁', label: '我是谁', desc: '本人设 8 字段' },
    { id: 'world', tag: '世界观', label: '世界观', desc: '来自 nook' },
    { id: 'peer', tag: '对方是谁', label: '对方是谁', desc: '另一侧的人设' },
    { id: 'spaceStyle', tag: '这本日记的调子', label: '日记本调子', desc: '空间风格设定' },
    { id: 'cycle', tag: '生理期', label: '生理期', desc: '实时推算' },
    { id: 'markers', tag: '纪念日与计划', label: '纪念日与计划', desc: '倒计时 / 已经多久' },
    { id: 'recentSelf', tag: '我最近写的', label: '我最近写的', desc: '自己的近期日记' },
    { id: 'recentPeer', tag: '对方最近写的', label: '对方最近写的', desc: '能看到对方的日记' },
    { id: 'todayNotes', tag: '今天的便利贴', label: '今天的便利贴', desc: '零碎记录' },
    { id: 'userWish', tag: '这次的要求', label: '这次的要求', desc: '重 roll 时用户提的意见' },
    { id: 'actionFormat', tag: '回写格式', label: '回写格式', locked: true, desc: '特殊 token 说明' },
]);

export function createDefaultContextConfig() {
    const out = {};
    for (const s of CONTEXT_SECTIONS) out[s.id] = true;
    return out;
}

/** 近期日记带几篇。再多就把当天要写的内容挤掉了（AGENTS2 §9.5）。 */
export const RECENT_DIARY_LIMIT = 5;
export const RECENT_PEER_LIMIT = 3;

/** 上下文预算：超了在预览里标红，但不自动裁 —— 自动裁会让用户搞不清少了什么 */
export const CONTEXT_TOKEN_BUDGET = 6000;

// ============================================================
// AI 回写格式
// ============================================================

/**
 * ★ 这段是**真的会拼进 system prompt 的正文**，不是给用户看的说明文档。
 *   （跨 App prompt 最常见的错误就是把功能介绍当 content 写进去，
 *   AI 收到一段废话。见 `src/core/app-prompt-registry.js` 顶部。）
 */
export const ACTION_FORMAT_HELP = `回写格式须知:
  - Principle: 写日记时如果提到了值得单独记下来的日子或计划，用下面的 token 单独成行标出来，系统会把它存进纪念日 / 倒计时。
  - Behaviors:
    - 想纪念一个已经过去的日子: [记纪念日:名称:YYYY-MM-DD:为什么想记住]
    - 想记一件将来要做的事: [记计划:名称:YYYY-MM-DD:一句说明]
    - 例: [记纪念日:第一次一起看雪:2025-12-18:那天她冻得说不出话还笑]
    - 例: [记计划:她的钢琴考级:2026-09-12:说好了要去听]
    - 单独成行，前后不要加引号或列表符号
    - 一篇最多两条，只记真的想留住的，不要把日记里每件事都变成条目
    - 日期不确定就不要用 token，在正文里写清楚就行`;

export const WRITE_RULES = `写日记须知:
  - Principle: 你在写自己的私人日记，写给自己看的，不是写给别人的汇报。
  - Behaviors:
    - 直接写正文，不要「好的」「以下是」这类开场白，不要标题
    - 不要 markdown 标记，不要分点罗列
    - 用第一人称，语气是自言自语，允许没头没尾
    - 只写今天真的发生过、或今天真的在想的事，不要编造没有依据的情节
    - 长度 150-400 字，写不满就短一点，不要凑字数
    - 不要每篇都总结升华，大部分日子就是平的`;

export const NOTE_RULES = `便利贴须知:
  - Principle: 现在不在写日记的时段，你写的是一张随手贴，不是日记。
  - Behaviors:
    - 一两句话，最多 60 字
    - 记一个念头、一件小事、一句想说的话
    - 不要起承转合，不要总结今天
    - 直接写内容，不要写「便利贴：」这种前缀`;

/** 时段外调用 AI 时的产物类型说明，拼在 writeRules 位置 */
export const KIND_RULES = Object.freeze({
    [ENTRY_KIND.DIARY]: WRITE_RULES,
    [ENTRY_KIND.NOTE]: NOTE_RULES,
});

// ============================================================
// AI 自配日记空间
// ============================================================

/**
 * 让 AI 自己决定日记本长什么样。
 *
 * 返回 JSON 而不是自定义分隔符 —— 嵌套结构用分隔符切非常脆，
 * 少一个冒号整条就废了（AGENTS2 §13.6.2 的结论）。
 */
export const SPACE_SETUP_PROMPT = `配置日记本须知:
  - Principle: 你要给自己的日记本挑一套外观和调子。按你的性格挑，不用迎合别人。
  - Behaviors:
    - 只输出一个 JSON 对象，不要任何解释文字，不要 markdown 代码围栏
    - 字段:
      title       日记本的名字，不超过 8 个字
      theme       从这几个里挑一个: oat(暖白) / clay(褪色砖红) / sage(灰绿) / mist(雾蓝) / lilac(淡紫灰) / ink(深色)
      layout      从这几个里挑一个: plain(素) / ruled(横线) / grid(方格)
      styleNote   一句话说明你写日记的习惯和口吻，30 字以内
      windowStart 你习惯在几点开始写日记，0 到 19 之间的整数
    - 例: {"title":"夜航","theme":"mist","layout":"ruled","styleNote":"写得很短，常常只有半句","windowStart":22}
    - windowStart 必须是 0-19 的整数，超出会被夹回来`;

export const TIMEOUT = Object.freeze({ normal: 90000, streamIdle: 60000 });

// ============================================================
// 默认空间
// ============================================================

export function createDefaultSpace(ownerKind, ownerId) {
    return {
        id: makeSpaceId(ownerKind, ownerId),
        ownerKind,
        ownerId: String(ownerId || ''),
        configured: false,
        title: '',
        theme: DEFAULT_THEME,
        layout: DEFAULT_LAYOUT,
        textScale: 'md',
        styleNote: '',
        birthday: '',
        windowStart: DEFAULT_WINDOW_START,
        cycle: { ...DEFAULT_CYCLE, trackFields: [...DEFAULT_CYCLE.trackFields] },
        contextConfig: createDefaultContextConfig(),
        contextOrder: CONTEXT_SECTIONS.map((s) => s.id),
        apiRef: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}
