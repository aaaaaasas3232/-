/**
 * 灯塔 · 常量
 *
 * ★ 这个文件里**一个颜色都没有**。颜色全在 `css/apps/job/_theme.css`。
 *   四叶草那轮的结论：只要 JS 里还有 hex，换主题换的就是个寂寞。
 *
 * 「档案键」和四叶草同一套：一份求职数据属于「哪个默认用户 + 哪个世界观」
 * 这一对组合，键就是 `${userId}::${worldId}`。切默认用户换了世界观 → 键变了 →
 * 走首配；切回来 → 键又对上 → 职位、工作、小剧场原样恢复。
 */

export const APP_ID = 'job';

/** IndexedDB 表名。加表记得去 `src/core/db-catalog.js` 登记一条。 */
export const STORES = Object.freeze({
    profiles: 'jobProfiles',        // 一档一条：配置 / 主题 / prompt 改动 / 结算游标
    feeds: 'jobFeeds',              // 一档一条：当前这批职位（刷新即覆盖）
    items: 'jobItems',              // 收藏的职位（只有收藏的才进来）
    posts: 'jobPosts',              // 已入职的工作，最多 3 份
    recruiters: 'jobRecruiters',    // HR 人设 + 面试对话
    theaters: 'jobTheaters',        // 每日小剧场 + 当天梗概
});

/** 底部 tab */
export const TABS = Object.freeze([
    { id: 'market', label: '机会', icon: 'compass' },
    { id: 'talks', label: '面试', icon: 'chat' },
    { id: 'work', label: '在职', icon: 'briefcase' },
    { id: 'me', label: '我的', icon: 'user' },
]);

/** 同时最多能有几份工作。超过就得先辞掉一份。 */
export const MAX_JOBS = 3;

/** 一次生成几个职位。再多 AI 容易糊弄，再少不够翻。 */
export const FEED_SIZE = 8;

/**
 * 职位大类。AI 生成时会被要求从这里挑，避免每次刷新分类都换一套。
 * 刻意做得抽象 —— 具体是「灵植培育员」还是「数据标注」由世界观决定。
 */
export const JOB_CATEGORIES = Object.freeze([
    '全部', '技术', '手艺', '经营', '服务', '文书', '体力', '演艺', '其他',
]);

/** 用工性质。影响排班默认值和 AI 的措辞。 */
export const JOB_TYPES = Object.freeze([
    { id: 'fulltime', label: '全职' },
    { id: 'parttime', label: '兼职' },
    { id: 'gig', label: '散活' },
    { id: 'contract', label: '契约' },
]);

/**
 * 结算方式。这是整个 App 和资产系统之间的接口 ——
 * 每一种都对应 `payroll-service.js` 里的一条真实入账路径。
 */
export const PAY_MODES = Object.freeze([
    {
        id: 'monthly', label: '月结', icon: 'calendar',
        hint: '每月固定一天，进 App 时自动补发',
        detail: '设定「每月 10 号发 2000」之后，只要那天过了、你又打开了这个 App，钱就会补进钱包。补发是按整月算的，中间几个月没开也不会漏。',
    },
    {
        id: 'daily', label: '日结', icon: 'sun',
        hint: '演完当天的小剧场就到账，多少看表现',
        detail: '生成小剧场时 AI 会给当天一个表现评级，评级决定这一天拿多少。上限和下限由你自己设。',
    },
    {
        id: 'tip', label: '打赏', icon: 'coin',
        hint: '没有底薪，全看当天有没有人给',
        detail: '和日结走同一条路，但可能是 0 —— 没人给就是没人给。适合演艺、街头、自由职业。',
    },
]);

/** 排班方式 */
export const SHIFT_MODES = Object.freeze([
    {
        id: 'weekly', label: '按周排', hint: '每周固定几天上班',
        detail: '勾上周几要上班。没勾的那几天是休息日，点了也演不了。',
    },
    {
        id: 'custom', label: '自己排', hint: '在日历上点哪天算哪天',
        detail: '直接在日历上点。点亮 = 那天上班。',
    },
    {
        id: 'free', label: '自由', hint: '没有上下班，想哪天演就哪天演',
        detail: '自由职业没有休息日的概念。但**每天仍然只能演一场** —— 这是为了让时间真的在走。',
    },
]);

/** 周几。0 = 周日，和 `Date.getDay()` 对齐。 */
export const WEEKDAYS = Object.freeze([
    { id: 0, short: '日' }, { id: 1, short: '一' }, { id: 2, short: '二' },
    { id: 3, short: '三' }, { id: 4, short: '四' }, { id: 5, short: '五' },
    { id: 6, short: '六' },
]);

/** 面试结果 */
export const TALK_STATUS = Object.freeze({
    open: 'open',           // 还在聊
    hired: 'hired',         // 录用了
    rejected: 'rejected',   // 被拒了
    closed: 'closed',       // 用户自己撤了
});

/** 当天表现评级 → 结算系数。AI 只需要给出 level，钱由这里算。 */
export const PERFORMANCE_LEVELS = Object.freeze([
    { id: 'bad', label: '搞砸了', factor: 0 },
    { id: 'poor', label: '不太行', factor: 0.4 },
    { id: 'ok', label: '正常', factor: 0.7 },
    { id: 'good', label: '不错', factor: 1 },
    { id: 'great', label: '很出彩', factor: 1.35 },
]);

/** 小剧场篇幅档位 */
export const THEATER_LENGTHS = Object.freeze([
    { id: 'short', label: '短', words: '300~500 字' },
    { id: 'medium', label: '中', words: '600~900 字' },
    { id: 'long', label: '长', words: '1200~1600 字' },
]);

/** 超时 */
export const TIMEOUT = Object.freeze({
    normal: 90000,
});

/**
 * 提示词里给 AI 的输出契约。
 * 嵌套结构一律要 JSON，不用自定义分隔符 —— 分隔符少一个符号会解析歪而且看不出来。
 */
export const JSON_RULE = '只输出一个 JSON，不要任何解释文字，不要 markdown 代码围栏。';

/** 资金流水的来源类型。写进 `sdk.assetFlow` 的 `sourceType`。 */
export const FLOW_SOURCE = Object.freeze({
    salary: 'job-salary',     // 月结工资
    daily: 'job-daily',       // 日结 / 当天表现
    tip: 'job-tip',           // 打赏
    bonus: 'job-bonus',       // 额外奖金（小剧场里发生的）
});

/** localStorage：只存「上次用的档案键」做启动加速，真数据在 IndexedDB */
export const LAST_PROFILE_KEY = 'xiaoting::job-last-profile-v1';

/** 生成中的加载文案。按种类分，避免哪里都说同一句。 */
export const LOADING_LINES = Object.freeze({
    feed: ['正在翻招聘板', '在看哪家还缺人', '正在打听待遇'],
    detail: ['正在要一份职位说明', '在问清楚到底做什么', '正在看合同细则'],
    recruiter: ['对面正在看你的简历', '有人来接待你了', '正在整理措辞'],
    reply: ['对面在想怎么说', '正在斟酌用词'],
    theater: ['今天开始了', '正在打卡', '在等第一件事发生'],
    digest: ['正在写今天的工作记录'],
});

/** 每天最多能演几场。硬约束，不给改。 */
export const THEATER_PER_DAY = 1;
