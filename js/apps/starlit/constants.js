/**
 * 点灯 · 枚举与默认值
 *
 * 这里只放「不含颜色」的常量。颜色一律在 css/apps/starlit/index.css。
 * 纯数据模块，不 import 任何运行时依赖 —— node 测试可以直接 import。
 */

/** IndexedDB 表名。改这里就要同步改 src/core/db-catalog.js。 */
export const STORES = Object.freeze({
    profiles: 'slProfiles',        // 一档一条：外观 / 弹幕设置 / 小电视设置
    topics: 'slTopics',            // 学习主题（一个主题 = 一个推理空间）
    lessons: 'slLessons',          // 课程（含目标 / 状态 / 总结 / 笔记）
    messages: 'slMessages',        // 上课 / 反转课堂的消息，一条一记录
    cards: 'slCards',              // 卡片库：全部卡片的唯一真相（可跨课复用）
    links: 'slLinks',              // 卡片之间的连线
    dict: 'slDictEntries',         // 知识点词典（含 SRS 调度字段）
    stuck: 'slStuckPoints',        // 错题本：死活不懂的知识点
});

/** 两种学习模式 */
export const MODES = Object.freeze({
    language: 'language',
    code: 'code',
});

export const MODE_META = Object.freeze({
    language: {
        label: '语言',
        desc: '必须用目标语言跟老师对话，中文翻译以描边字贴在气泡旁',
        // 卡片类型白名单（代码卡在语言模式下也允许 —— 语言里也有结构图）
        skills: ['word', 'concept', 'post', 'quiz'],
    },
    code: {
        label: '代码',
        desc: '每条重点代码可点开注释、长按变可编辑，预览窗能看网页怎么长出来',
        skills: ['concept', 'code', 'post', 'quiz'],
    },
});

/**
 * 语言教学的「浸没维度」—— 老师到底用多少外文说话。
 *
 * 这是**每个主题**自己的设定，不是全局的：
 * 同一个人可能英语想全浸没、日语才刚入门想循序渐进。
 *
 * gradual 的档位不让用户手调，按「这是第几节课」自动往上走 ——
 * 让学生自己判断「我该升级了吗」是把负担丢回给他，
 * 而课程序号是现成的、单调递增的、不会骗人的进度信号。
 */
export const IMMERSION_MODES = Object.freeze([
    {
        id: 'full',
        label: '从头到尾外文',
        desc: '老师一句中文都不说，翻译只在气泡旁边',
    },
    {
        id: 'gradual',
        label: '循序渐进',
        desc: '前几节中外夹着说，越往后外文越多',
    },
]);

export const DEFAULT_IMMERSION = 'gradual';

/**
 * 循序渐进的三个阶段。`until` 是「第几节课之前算这一档」。
 * ratio 只是写进 prompt 给老师看的目标感，不做机械校验 ——
 * 真去数外文字符占比会逼出很奇怪的句子。
 */
export const IMMERSION_STAGES = Object.freeze([
    {
        id: 'warm',
        until: 3,
        label: '起步',
        ratio: '外文四成、中文六成',
        rule: '每句外文后面**紧跟**一句中文把意思说明白；生词第一次出现时用中文点一下它是什么。',
    },
    {
        id: 'mixed',
        until: 8,
        label: '过渡',
        ratio: '外文七成、中文三成',
        rule: '正常句子直接用外文说；只有出现新语法点或抽象词时，才补一小句中文。',
    },
    {
        id: 'deep',
        until: Infinity,
        label: '沉浸',
        ratio: '基本全外文',
        rule: '正文只用外文。学生明确说「没懂」时，才用一句中文解释，解释完立刻切回外文。',
    },
]);

/**
 * 翻译的呈现形态。
 *
 * meme  贴在气泡旁的描边中文（原来就有的那种，像梗图字幕）
 * tap   气泡上一颗小按钮，点开才展开翻译（微信那种）
 *
 * 两种都留着是因为它们服务的是**两种学习状态**：
 * 想沉浸的人要余光扫得到又不打断；想确认的人要一个明确的「给我看」动作。
 */
export const GLOSS_MODES = Object.freeze([
    { id: 'meme', label: '描边贴边上', desc: '像梗图字幕，余光能扫到，不用点' },
    { id: 'tap', label: '点开才显示', desc: '像微信翻译，点一下气泡展开中文' },
]);

export const DEFAULT_GLOSS_MODE = 'meme';

/**
 * 一条回复拆成几个气泡。
 *
 * ★ 为什么要拆：语言模式下每个气泡旁边要贴描边中文，
 *   气泡一长，中文就没地方放了（要么盖住外文，要么被挤出屏幕）。
 *   所以气泡必须短 —— 一两行，中文正好贴得下。
 */
export const BUBBLE_SPLIT = Object.freeze({
    /** 单个气泡的软上限（字符数）。中文按 2 个宽度算，见 utils.displayWidth 的思路 */
    maxChars: 46,
    /** 低于这个长度的尾巴并回上一个气泡，免得出现只有两个字的孤儿泡 */
    minTail: 12,
    /** 一条回复最多拆几个 —— 再多就像刷屏了 */
    maxBubbles: 6,
});

/** 卡片长按翻译用哪种引擎 */
export const TRANSLATE_ENGINES = Object.freeze([
    {
        id: 'local',
        label: '本地词典',
        desc: '用你已经学过的词条拼，零消耗、瞬间出',
    },
    {
        id: 'ai',
        label: '让 AI 翻',
        desc: '更准，只把这张卡的内容发出去',
    },
]);

export const DEFAULT_TRANSLATE_ENGINE = 'local';

/**
 * 长按判定时长（ms）。
 * 250 太短会和滚动抢；600 太长用户以为没反应。
 */
export const LONG_PRESS_MS = 420;

/** 顶层 tab */
export const TABS = Object.freeze([
    { id: 'topics', label: '主题', icon: 'layers' },
    { id: 'lessons', label: '课程', icon: 'book' },
    { id: 'wall', label: '推理墙', icon: 'graph' },
    { id: 'dict', label: '词典', icon: 'cards' },
    { id: 'me', label: '我的', icon: 'user' },
]);

/** 课程状态 */
export const LESSON_STATUS = Object.freeze({
    planned: 'planned',     // 只有目标，还没上
    active: 'active',       // 正在上
    done: 'done',           // 上完了（有总结）
    flipped: 'flipped',     // 反转课堂也上完了
});

/** 卡片类型 */
export const CARD_TYPES = Object.freeze({
    concept: 'concept',   // 概念 / 由来（本 App 的灵魂：为什么诞生）
    word: 'word',         // 词卡：eat v. 吃 + 词根
    code: 'code',         // 代码卡：html/css/js + 重点行 + 注释 + 预览
    post: 'post',         // 帖子卡：真实链接
    quiz: 'quiz',         // 小测
    note: 'note',         // 用户自己记的笔记
    stuck: 'stuck',       // 卡住点（错题本同源）
});

export const CARD_TYPE_META = Object.freeze({
    concept: { label: '概念', hint: '它是什么、为什么会诞生' },
    word: { label: '词卡', hint: '词形 / 词性 / 释义 / 词根' },
    code: { label: '代码', hint: '可预览、可长按改' },
    post: { label: '帖子', hint: '外部真实链接' },
    quiz: { label: '小测', hint: '自测题' },
    note: { label: '笔记', hint: '你自己写的' },
    stuck: { label: '卡住', hint: '暂时不懂，留着以后回来' },
});

/**
 * 连线关系。红线是推理墙的灵魂 —— 默认就是 'because'（红）。
 * color 字段只写 token 名，真值在 CSS。
 */
export const LINK_KINDS = Object.freeze([
    { id: 'because', label: '因为', token: 'red', dashed: false },
    { id: 'derive', label: '演变为', token: 'amber', dashed: false },
    { id: 'same', label: '同源', token: 'green', dashed: true },
    { id: 'contrast', label: '对比', token: 'blue', dashed: true },
    { id: 'part', label: '组成', token: 'violet', dashed: false },
    { id: 'free', label: '相关', token: 'grey', dashed: true },
]);

/** 卡片默认尺寸（推理墙世界坐标，单位 px） */
export const CARD_SIZE = Object.freeze({
    w: 168,
    h: 108,
    // 代码卡更高（要放预览）
    codeW: 214,
    codeH: 142,
    // 卡片堆里每张的横向错位量：「不完全遮盖，有左右出入感」
    stackOffsetX: 13,
    stackOffsetY: 7,
});

/** 推理墙缩放范围 */
export const WALL_ZOOM = Object.freeze({ min: 0.35, max: 2.4, step: 0.12 });

/** 弹幕（悬浮播放）位置 */
export const TICKER_ZONES = Object.freeze([
    { id: 'all', label: '整屏' },
    { id: 'top', label: '上部' },
    { id: 'middle', label: '中部' },
    { id: 'bottom', label: '下部' },
]);

/** 弹幕密度：每条之间隔多久（ms） */
export const TICKER_DENSITY = Object.freeze([
    { id: 'sparse', label: '很稀', gap: 9000 },
    { id: 'calm', label: '稀', gap: 5200 },
    { id: 'normal', label: '正常', gap: 3000 },
    { id: 'dense', label: '密', gap: 1600 },
    { id: 'storm', label: '很密', gap: 800 },
]);

/**
 * 状态栏 / Home 指示条的安全区。
 * 状态栏容器高 50px（index.html 里写死），底部指示条区域约 34px。
 * 弹幕分区必须避开这两段，否则字会被状态栏和指示条压住。
 */
export const SAFE_INSET = Object.freeze({ top: 54, bottom: 38 });

/** 单词机（小电视 / 词典卡）的四个自评档 */
export const RECALL_GRADES = Object.freeze([
    { id: 'forgot', label: '不记得', factor: 0.0 },
    { id: 'fuzzy', label: '模糊', factor: 0.45 },
    { id: 'wrong', label: '记错了', factor: 0.2 },
    { id: 'known', label: '完全记得', factor: 1.0 },
]);

/** SRS 间隔梯度（单位：小时）。走到最后一档就基本不再出现。 */
export const SRS_STEPS = Object.freeze([0.2, 1, 6, 24, 72, 168, 360, 720]);

/** 词典条目的记忆分区 */
export const DICT_BUCKETS = Object.freeze([
    { id: 'weak', label: '不深刻', desc: '优先反复出现' },
    { id: 'normal', label: '正常', desc: '按调度出现' },
    { id: 'mastered', label: '已记住', desc: '几乎不再出现' },
]);

/** 小电视的两种模式 */
export const TV_MODES = Object.freeze([
    { id: 'roll', label: '滚动播放', desc: '一条接一条自动过' },
    { id: 'drill', label: '单词机', desc: '先遮住释义，你自评' },
]);

/** 小电视尺寸范围（px，宽） */
export const TV_SIZE = Object.freeze({ min: 96, max: 330, def: 148 });

/** AI 请求超时 */
export const TIMEOUT = Object.freeze({
    quick: 45000,
    normal: 90000,
    long: 150000,
});

/** 一节课的消息上下文最多带多少条进 prompt（省 token） */
export const CONTEXT_WINDOW = 22;

/** 问卷题目数量区间 */
export const SURVEY_SIZE = Object.freeze({ min: 6, max: 10 });

/** 常见目标语言（用户也能自己填） */
export const LANGUAGE_PRESETS = Object.freeze([
    { id: 'en', label: '英语', native: 'English' },
    { id: 'ja', label: '日语', native: '日本語' },
    { id: 'ko', label: '韩语', native: '한국어' },
    { id: 'fr', label: '法语', native: 'Français' },
    { id: 'de', label: '德语', native: 'Deutsch' },
    { id: 'es', label: '西班牙语', native: 'Español' },
    { id: 'ru', label: '俄语', native: 'Русский' },
    { id: 'la', label: '拉丁语', native: 'Latina' },
]);

/** 代码学习的技术栈预设 */
export const CODE_PRESETS = Object.freeze([
    { id: 'html', label: 'HTML 结构' },
    { id: 'css', label: 'CSS 样式' },
    { id: 'js', label: 'JavaScript' },
    { id: 'layout', label: '布局（盒模型 / flex / grid）' },
    { id: 'anim', label: '动画与过渡' },
    { id: 'dom', label: 'DOM 与事件' },
]);

/** 老师来源 */
export const TEACHER_SOURCES = Object.freeze([
    { id: 'persona', label: '世界观里的 AI', desc: '拉取人设，老师带着自己的性格上课' },
    { id: 'model', label: '模型本身', desc: '不套人设，只当一位好老师' },
]);

/** 「网页怎么从空白里诞生」播放器的默认单步时长（ms） */
export const BIRTH_PLAYER = Object.freeze({
    minStep: 120,
    maxStep: 1400,
    defStep: 460,
});
