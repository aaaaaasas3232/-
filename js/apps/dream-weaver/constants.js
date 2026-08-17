/**
 * 梦境编织 · 常量与默认值
 *
 * ★ 这里只放「编译期就确定的枚举 / 默认值 / 文案」,不放任何颜色 hex ——
 *   颜色全部在 `css/apps/dream-weaver/_theme.css` 里以 `--dw-*` 定义。
 *   唯一例外是「书籍封面色」:那是用户从一组预设里选的**数据**,
 *   存进 IndexedDB 跟着书走,所以它以 token 名的形式存在(见 COVER_TONES)。
 */

// ============================================================
// 书籍封面色 —— 存的是 token 名,不是 hex
// ============================================================

/**
 * 封面用「色调名」而不是 hex。
 *
 * 原版存的是 `coverColor: '#C62828'`,于是换主题时所有封面纹丝不动,
 * 深色主题下选的颜色到了浅色主题就糊成一片。存 token 名之后,
 * 封面颜色由 CSS `[data-tone="ember"]` 决定,自动跟着主题走。
 */
export const COVER_TONES = Object.freeze([
    { id: 'ember', label: '炉火' },
    { id: 'ink', label: '墨' },
    { id: 'jade', label: '青' },
    { id: 'amber', label: '琥珀' },
    { id: 'violet', label: '紫菀' },
    { id: 'ocean', label: '海' },
    { id: 'rose', label: '绯' },
    { id: 'moss', label: '苔' },
]);

export const DEFAULT_COVER_TONE = 'ember';

/** 角色 / 地点标记也用同一套色调名 */
export const MARK_TONES = COVER_TONES.map((t) => t.id);

// ============================================================
// 叙事设置
// ============================================================

export const POV_OPTIONS = Object.freeze([
    { id: 'first', label: '第一人称', hint: '「我」' },
    { id: 'second', label: '第二人称', hint: '「你」' },
    { id: 'third', label: '第三人称', hint: '「他/她」' },
]);

export const VIEWPOINT_OPTIONS = Object.freeze([
    { id: 'god', label: '上帝视角', hint: '全知,可写任何人的内心' },
    { id: 'character', label: '角色视角', hint: '只写选定角色能感知到的' },
]);

export const NARRATIVE_OPTIONS = Object.freeze([
    { id: 'chronological', label: '顺叙', hint: '按时间先后' },
    { id: 'flashback', label: '倒叙', hint: '先果后因' },
    { id: 'interpolation', label: '插叙', hint: '中途插入回忆' },
    { id: 'supplementary', label: '补叙', hint: '事后补充交代' },
    { id: 'parallel', label: '平叙', hint: '多线并行' },
]);

/** 和原版顶栏「方向」下拉的三个选项一致 */
export const REPLY_DIRECTION_OPTIONS = Object.freeze([
    { id: 'auto', label: '自动', hint: '由 AI 判断往哪儿走' },
    { id: 'continue', label: '续写', hint: '顺着往下推' },
    { id: 'dialogue', label: '对话', hint: '多写人物交流' },
]);

/** 原版叙事手法有五项,包含「平叙」 */
export const NARRATIVE_METHOD_SHORT = Object.freeze({
    chronological: '顺',
    flashback: '倒',
    interpolation: '插',
    supplementary: '补',
    parallel: '平',
});

export const POV_SHORT = Object.freeze({ first: '一', second: '二', third: '三' });
export const VIEWPOINT_SHORT = Object.freeze({ god: '上帝', character: '角色' });

export const GENERATE_MODE_OPTIONS = Object.freeze([
    { id: 'paragraph', label: '段落', hint: '一次生成完整段落' },
    { id: 'sentence', label: '短句', hint: '一次一两句,便于把控' },
    { id: 'chapter', label: '整章', hint: '一次铺开一整章' },
]);

export const AUTHOR_STYLE_OPTIONS = Object.freeze([
    { id: 'balanced', label: '均衡' },
    { id: 'lyrical', label: '抒情' },
    { id: 'terse', label: '冷峻' },
    { id: 'humorous', label: '诙谐' },
    { id: 'classical', label: '古典' },
]);

// ============================================================
// 输入模式(剧情 / 金句 / Pia戏)
// ============================================================

/**
 * `historyStrategy` 决定这条输入携带多少历史进 prompt:
 *   latest_only    只带最近一条 —— 适合「剧情指令」这种一次性指示
 *   accumulate_all 带整章 —— 适合 Pia 戏这种需要完整上下文的共创
 *   recent_n       带最近 N 条
 *   none           不带历史
 */
export const HISTORY_STRATEGIES = Object.freeze([
    { id: 'latest_only', label: '仅最近一条' },
    { id: 'accumulate_all', label: '累积全部' },
    { id: 'recent_n', label: '最近 N 条' },
    { id: 'none', label: '不带历史' },
]);

export function createDefaultInputModes() {
    return [
        {
            id: 'plot',
            name: '剧情',
            icon: 'book',
            isPreset: true,
            placeholder: '描述接下来的剧情...',
            historyStrategy: 'latest_only',
            recentN: 5,
            promptTemplate:
                '【剧情指令】\n{内容}\n\n请根据以上信息，严格按照【叙事要求】中的视角、人称和叙事手法，生成{min}-{max}字的剧情内容。',
            recordOnly: false,
        },
        {
            id: 'quote',
            name: '金句',
            icon: 'star',
            isPreset: true,
            placeholder: '写下灵感金句...',
            historyStrategy: 'latest_only',
            recentN: 5,
            promptTemplate: '【灵感金句】\n{内容}\n\n请根据这句灵感金句，结合叙事要求，生成相关的优美段落。',
            recordOnly: true,
        },
        {
            id: 'pia',
            name: 'Pia戏',
            icon: 'drama',
            isPreset: true,
            placeholder: '输入角色台词或动作描写（作为文章内容）...',
            historyStrategy: 'accumulate_all',
            recentN: 5,
            promptTemplate:
                '【Pia戏内容】\n{内容}\n\n你正在参与Pia戏（角色扮演式小说共创），用户发送的内容是小说正文的一部分。请以你扮演的角色身份，延续上文风格，生成{min}-{max}字的后续内容。保持叙事连贯，自然衔接用户写的内容。',
            recordOnly: false,
        },
    ];
}

export const DEFAULT_ACTIVE_MODE_IDS = Object.freeze(['plot', 'quote', 'pia']);

/** 输入栏最多同时挂几个模式按钮 */
export const MAX_ACTIVE_MODES = 3;

// ============================================================
// 生成类提示词
// ============================================================

export function createDefaultGenerationPrompts() {
    return {
        basePrompt: '你是一个专业的小说创作助手。请根据用户的输入，创作优美流畅的小说内容。',
        typePrompts: {
            continue: '请继续创作故事内容，保持连贯性和文学性，严格遵循叙事要求。',
            reroll: '请重新创作这段内容，风格可以略有不同，但要遵循叙事要求。',
            expand: '请基于以下内容进行扩展和丰富，增加细节描写，保持叙事一致。',
            dialog: '请创作自然流畅的对话内容。',
            scene: '请创作生动的场景描写，遵循当前的叙事视角。',
        },
        savedTemplates: [],
    };
}

// ============================================================
// 显示设置
// ============================================================

export function createDefaultDisplaySettings() {
    return {
        fontSize: 15,
        lineHeight: 1.9,
        letterSpacing: 0,
        paragraphIndent: true,
        fontFamily: '',            // 空 = 跟随系统;非空 = 用户导入的字体名
        showBubbles: true,         // 对话是否渲染成气泡
        bubbleTail: true,          // 气泡是否带小尾巴
        highlightCharacters: true, // 正文里高亮角色名
        highlightLocations: true,  // 正文里高亮地点名
        showTokens: false,         // 每条消息显示 token 估算
        showTimestamps: false,
        compactMode: false,
    };
}

// ============================================================
// 正则气泡规则
// ============================================================

/**
 * 默认气泡识别规则。
 *
 * 原版这个函数**定义了两遍**(15650 / 21487),两份结构还不一样:
 * 一份带 `replacement`、一份只有 `pattern`,JS 只保留后写的那个,
 * 于是前面那份配套的替换逻辑成了死代码。这里只留一份,字段取并集。
 */
export function createDefaultBubbleRules() {
    return [
        {
            id: 'rule-dialogue',
            name: '中文引号对话',
            pattern: '[“"]([^”"]+)[”"]',
            flags: 'g',
            mode: 'segment',
            replacement: '',
            kind: 'dialogue',
            enabled: true,
            builtin: true,
        },
        {
            id: 'rule-inner',
            name: '括号内心独白',
            pattern: '[（(]([^）)]+)[）)]',
            flags: 'g',
            mode: 'segment',
            replacement: '',
            kind: 'inner',
            enabled: true,
            builtin: true,
        },
        {
            id: 'rule-aside',
            name: '方括号旁白',
            pattern: '\\[([^\\]]+)\\]',
            flags: 'g',
            mode: 'segment',
            replacement: '',
            kind: 'aside',
            enabled: false,
            builtin: true,
        },
        // ── 「画出来」的示例。默认关着 —— 开箱就改用户的正文太冒犯，
        //    但摆在这儿用户一眼能看懂这个模式能干什么，照着改就行。
        {
            id: 'rule-candy',
            name: '[糖果] 画成糖',
            pattern: '\\[糖果\\]',
            flags: 'g',
            mode: 'html',
            replacement: '<span style="display:inline-flex;align-items:center;vertical-align:-2px;"><svg viewBox="0 0 24 24" width="16" height="16"><ellipse cx="12" cy="12" rx="5" ry="5" fill="#ff7aa2"/><path d="M7 12 3 8v8z" fill="#ffc0d4"/><path d="M17 12l4-4v8z" fill="#ffc0d4"/></svg></span>',
            kind: 'aside',
            enabled: false,
            builtin: true,
        },
        {
            id: 'rule-tag',
            name: '[标签:xx] 画成小胶囊',
            pattern: '\\[标签:([^\\]]+)\\]',
            flags: 'g',
            mode: 'html',
            replacement: '<span style="display:inline-block;padding:1px 8px;border-radius:999px;background:rgba(198,40,40,.16);color:#e07070;font-size:.85em;">$1</span>',
            kind: 'aside',
            enabled: false,
            builtin: true,
        },
    ];
}

// ============================================================
// 生成器(小剧场 / 评论 / 日常)
// ============================================================

export const THEATER_TYPES = Object.freeze([
    { id: 'morning-kiss', label: '早安吻', prompt: '写一段两人早晨醒来的亲昵小剧场，轻松、甜、有生活感。' },
    { id: 'phone-chat', label: '手机聊天', prompt: '用手机聊天记录的形式写一段两人的日常对话，口语化，有来有回。' },
    { id: 'daily', label: '日常片段', prompt: '写一段两人日常生活里的小片段，平淡但有温度。' },
    { id: 'inner', label: '内心独白', prompt: '写一段角色此刻的内心独白，克制、真实，不要煽情。' },
]);

export const COMMENT_TYPES = Object.freeze([
    { id: 'novel', label: '小说评论', prompt: '以读者身份写几条对这段内容的评论，有夸有吐槽，像真实评论区。' },
    { id: 'danmaku', label: '弹幕', prompt: '以弹幕形式写十几条短评，密集、口语、玩梗。' },
    { id: 'review', label: '影评', prompt: '以影评人视角写一段专业但不装的评论。' },
]);

// ============================================================
// 字数 / 超时
// ============================================================

export const DEFAULT_WORD_RANGE = Object.freeze({ min: 500, max: 1500 });

export const WORD_RANGE_PRESETS = Object.freeze([
    { min: 200, max: 500, label: '短' },
    { min: 500, max: 1500, label: '中' },
    { min: 1500, max: 3000, label: '长' },
    { min: 3000, max: 6000, label: '整章' },
]);

/**
 * 超时。
 *
 * 原版写死 120s / 180s 总超时。流式生成里「总超时」是错的口径:
 * 一次三千字的生成跑两分钟完全正常。流式走**空闲超时**(见 `executeApiStream`),
 * 只有一次性请求才用总超时。
 */
export const TIMEOUT = Object.freeze({
    normal: 120000,   // 一次性请求的总超时
    streamIdle: 90000, // 流式:连续多久没数据才算断
});

// ============================================================
// 默认设置
// ============================================================

export function createDefaultSettings() {
    return {
        // 叙事
        pov: 'third',
        viewpoint: 'god',
        narrativeMethod: 'chronological',
        replyDirection: 'auto',
        generateMode: 'paragraph',
        defaultWordRange: { ...DEFAULT_WORD_RANGE },

        // 作者人格
        enableAuthorPersonality: false,
        authorStyle: 'balanced',
        enableStyleSummary: true,

        // 生成
        useStreamMode: true,
        enableBackgroundGeneration: true,

        // 外观
        theme: 'retro-dark',
        customThemes: [],
        activeCustomThemeId: '',
        customFont: null,          // { name, data } —— 用户导入的字体
        displaySettings: createDefaultDisplaySettings(),

        // 提示词
        generationPrompts: createDefaultGenerationPrompts(),

        // 上下文预算(0 = 不限制)
        contextTokenBudget: 0,
    };
}

/**
 * 上下文段落的默认开关。
 *
 * ★ 原版最大的功能性 bug 就在这里:`book.contextConfig` 的这些开关**只影响预览**,
 *   真正发送走的是 `buildPrompt`,它压根不读 contextConfig。用户在预览里关掉「世界观」,
 *   点发送照样把世界观发出去了。现在预览和发送共用同一个 `buildContextParts()`,
 *   这份配置是唯一入口。
 */
export function createDefaultContextConfig() {
    return {
        system: true,
        userIdentity: true,
        synopsis: true,
        world: true,
        characters: true,
        locations: true,
        timeline: true,
        narrative: true,
        chapterSummaries: true,
        chapterContext: true,
        messageContext: true,
        authorStyle: true,
        customPrompts: true,
    };
}

/** 上下文段落的展示元信息(标题 / 说明 / 顺序),预览面板和 builder 共用 */
export const CONTEXT_SECTIONS = Object.freeze([
    { id: 'system', tag: '系统指令', label: '系统指令', desc: '告诉 AI 它在做什么', locked: true },
    { id: 'userIdentity', tag: '用户身份', label: '我的身份', desc: '你在这本书里扮演谁' },
    { id: 'synopsis', tag: '故事梗概', label: '故事梗概', desc: '整本书讲什么' },
    { id: 'world', tag: '世界观', label: '世界观', desc: '背景设定' },
    { id: 'characters', tag: '角色设定', label: '角色设定', desc: '出场人物' },
    { id: 'locations', tag: '地点设定', label: '地点设定', desc: '场景地标' },
    { id: 'timeline', tag: '时间线', label: '时间线', desc: '已发生的关键事件' },
    { id: 'authorStyle', tag: '文风要求', label: '文风要求', desc: '作者人格与风格' },
    { id: 'narrative', tag: '叙事要求', label: '叙事要求', desc: '人称 / 视角 / 手法 / 字数' },
    { id: 'chapterSummaries', tag: '前情提要', label: '前情提要', desc: '之前章节的梗概' },
    { id: 'chapterContext', tag: '本章已有内容', label: '本章已有内容', desc: '当前章节正文' },
    { id: 'messageContext', tag: '近期往来', label: '近期往来', desc: '最近的输入与生成' },
    { id: 'customPrompts', tag: '自定义提示词', label: '自定义提示词', desc: '你为这本书写的额外要求' },
]);

// ============================================================
// 路由
// ============================================================

export const TABS = Object.freeze([
    { id: 'shelf', label: '书架', icon: 'bookshelf' },
    { id: 'profile', label: '我的', icon: 'profile' },
]);

/** 编辑器里的抽屉面板 */
export const EDITOR_PANELS = Object.freeze([
    { id: 'chapters', label: '目录', icon: 'list' },
    { id: 'context', label: '上下文', icon: 'layers' },
    { id: 'timeline', label: '时间线', icon: 'clock' },
    { id: 'tools', label: '工具', icon: 'sparkle' },
]);
