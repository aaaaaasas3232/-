/**
 * settings-sdk · 默认值 / 预设 / 数据模型
 *
 * 集中维护：
 *   - 三大基础实体 (user / ai / world) 默认实例
 *   - 系统标签组预设
 *   - 心情 / 平台预设
 *   - IndexedDB 表名常量
 *   - ID 生成工具
 *
 * 注意：时间系统常量已迁移到 sdk/chronology/
 *       地理系统常量已迁移到 sdk/geo/
 */

// ============================================
// 当前选中的 ID 默认值
// ============================================

export const DEFAULT_ACTIVE_USER_ID = 'user0';
export const DEFAULT_ACTIVE_AI_ID = 'ai0';
export const DEFAULT_ACTIVE_WORLD_ID = 'world0';

// ============================================
// 世界观默认实例
// ============================================

export const DEFAULT_WORLD_INSTANCE = Object.freeze({
    id: 'world0',
    name: '默认世界观',
    summary: '一个待补充的世界观。先写一句话主旨，再用要点列出设定。',
    // 专属体验模式：决定桌面 App 可见性与默认职业，不再靠各 App 猜标签。
    experienceMode: 'general',
    keyPoints: [],
    timeline: '',
    notes: '',
    tagRefs: [],
    locations: [],
    // 地点地图背景（世界级，例如中国地图）；各地点自己的 mapImageUrl
    // 用作场所地图背景（地区级，例如浙江地图）。
    mapImageUrl: '',

    // 时间线 + 锚点
    timelines: {
        personal: { user: [] },
        world: [],
    },

    // 时间锚点（段锚点 + 点锚点）
    anchors: [],

    // 资产系统：货币名称
    currencyName: '金币',

    // 自定义单位名称
    // v0.17：周期层级 = 大周期（年）/ 中周期（月）/ 小周期（日）。
    //       没有「基周期」/「周」概念，「小周期」就是「日」。
    //       dateFieldVisibility 字段顺序：大 / 中 / 小（去掉「基」/「周」）
    chronologySettings: {
        enabled: false,
        baseYear: 2000,
        // 大周期（如"洪武"）
        largeCycleName: '',
        // 大周期单位（如"年"）
        yearLabel: '年',
        // 中周期名称（如"新"）
        mediumCycleName: '',
        // 中周期单位（如"月"）
        monthLabel: '月',
        // 小周期名称（小周期 = 日；默认就叫「日」）
        smallCycleName: '日',
        // 「日」标签（小周期现在即代表日）
        dayLabel: '日',
        hourLabel: '时',
        customHours: [],
        // 周名称数组（7 天，对应周一到周日）
        weekDayNames: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
        // 日期录入时哪些周期字段可见（默认全部显示）。
        //   v0.17：仅剩 year / month / day
        dateFieldVisibility: { year: true, month: true, day: true },

        // ── 时差系统（2026-08-13 新增）────────────────────────────
        // 和上面的「纪时映射」是**两套并行**的东西，不要混：
        //   · 纪时映射（enabled）：用户和 AI 在**两个不同的世界**，
        //     时间单位本身就不一样（12:33 → 辰时）。
        //   · 时差（timeOffsetEnabled）：用户和 AI 在**同一个世界的不同地区**，
        //     单位一样，只是钟点差几个小时（东都 9:00 = 西陆 3:00）。
        // 两个都开时，先算时差再套纪时（时差是「几点」，纪时是「怎么叫」）。
        timeOffsetEnabled: false,
        userRegionName: '',        // 用户所在地区名（如「东都」）
        userOffsetHours: 0,        // 用户相对世界标准时的偏移（小时，可负、可 0.5）
        aiRegionName: '',          // AI 默认所在地区名（如「西陆」）
        aiOffsetHours: 0,          // AI 相对世界标准时的偏移
    },

    holidays: [],
    eventAggregator: {
        includePersonalEvents: false,
        includedOwners: [],
        visibility: {
            toUserSelf: true,
            toOtherUsers: false,
            toAiPersons: [],
        },
        showInWorldTimeline: false,
        displayStyle: 'dot',
    },
    createdAt: 0,
    updatedAt: 0,
});

// ============================================
// 用户默认实例
// ============================================

export const DEFAULT_USER_INSTANCE = Object.freeze({
    id: 'user0',
    name: '我',
    // 兼容旧字段
    pronouns: '',
    summary: '',

    // ★ v0.17 人设本体（8 字段）
    gender: '',
    age: '',
    appearance: '',
    personality: '',
    bio: '',
    experience: '',
    avatar: '',
    avatarBg: '',
    boundWorldId: '',

    // 兼容旧字段
    preferences: [],
    notes: '',
    tagRefs: [],
    currentLocationRef: null,
    assetDescription: '', // 旧版顶级字段；已迁移到 assetNotes 模块（v4.2），此处保留以兼容旧文档/导入

    // ★ v0.17 动态模块（默认关闭）
    //   injectMode: 'none' 不注入 | 'current' 当前状态 | 'full' 完整数据
    preferences:   { enabled: false, injectMode: 'none', hobbies: [], likes: [], dislikes: [], allergies: [], petName: '', petType: '', petPersonality: '' },
    schedule:      { enabled: false, injectMode: 'none' },
    rhythm:        { enabled: false, injectMode: 'none', entries: [] },
    mood:          { enabled: false, injectMode: 'current' },
    memory:        { enabled: false, injectMode: 'none', text: '' },
    worldview:     { enabled: false, injectMode: 'none', text: '' },
    space:         { enabled: false, injectMode: 'none' },
    mbti:          { enabled: false, injectMode: 'none', type: '', description: '' },
    psychological: { enabled: false, injectMode: 'none', text: '' },
    moral:         { enabled: false, injectMode: 'none', text: '' },
    skills:        { enabled: false, injectMode: 'none', text: '' },

    // ★ v0.22 资源绑定模块开关（默认开启，资源绑定 section 挂在 persona 编辑器内）
    resources:     { enabled: true, injectToPrompt: false },

    // ★ v0.18 资源绑定（按图组绑定）
    boundResources: {
        avatarGroupIds: [],
        stickerGroupIds: [],
        apiRefs: [],
        promptIds: [],
    },

    // ★ v0.20 资产系统 + 资产说明（金钱观 / 当前是否富裕）
    //   v4.2：assets / assetNotes 已升级到 v2（assetBalance + incomeEvents），旧字段不再保留
    assetNotes: { enabled: false, description: '' },

    // ★ v0.23 独立卡来源关系
    variantType: 'base',
    parentPersonaId: '',
    rootPersonaId: '',
    phaseMeta: { name: '', age: null, timelinePrompt: '' },

    // ★ v0.17 旧嵌套字段（启动时迁移为独立卡）
    lifePhases: [],
    activeLifePhaseId: '',
    parOs: [],

    // ★ v0.21 圈子：与世界观下其他人设的关系 / 我视角下的认知
    circle: { members: [] },

    // ★ v0.17 概率 / 每日快照
    moodProbability: { enabled: false, weights: {} },
    lastCalculatedDate: '',
    dailyMood: '',

    createdAt: 0,
    updatedAt: 0,
});

// ============================================
// AI 人设默认实例
// ============================================

export const DEFAULT_AI_INSTANCE = Object.freeze({
    id: 'ai0',
    name: '默认 AI',
    // 兼容旧字段
    boundWorldRef: '',
    role: '通用助手',
    tone: '温柔、克制、像朋友',
    summary: '',
    rules: [],
    notes: '',
    boundLocationRefs: [],
    tagRefs: [],
    sentimentMap: [],
    locationDistribution: [],
    moodDistribution: [],
    locationOverride: null,
    moodOverride: null,

    // ★ v0.17 人设本体（8 字段）
    gender: '',
    age: '',
    appearance: '',
    personality: '',
    bio: '',
    experience: '',
    avatar: '',
    avatarBg: '',
    boundWorldId: '',

    // ★ v0.17 动态模块（默认关闭）
    //   injectMode: 'none' 不注入 | 'current' 当前状态 | 'full' 完整数据
    preferences:    { enabled: false, injectMode: 'none', hobbies: [], likes: [], dislikes: [], allergies: [], petName: '', petType: '', petPersonality: '' },
    schedule:       { enabled: false, injectMode: 'none' },
    rhythm:         { enabled: false, injectMode: 'none', entries: [] },
    mood:           { enabled: false, injectMode: 'current' },
    memory:         { enabled: false, injectMode: 'none', text: '' },
    worldview:      { enabled: false, injectMode: 'none', text: '' },
    space:          { enabled: false, injectMode: 'none' },
    mbti:           { enabled: false, injectMode: 'none', type: '', description: '' },
    psychological:   { enabled: false, injectMode: 'none', text: '' },
    moral:          { enabled: false, injectMode: 'none', text: '' },
    skills:         { enabled: false, injectMode: 'none', text: '' },

    // ★ v0.22 资源绑定模块开关（默认开启）
    resources:      { enabled: true, injectToPrompt: false },

    // ★ v0.18 资源绑定（按图组绑定）
    boundResources: {
        avatarGroupIds: [],
        stickerGroupIds: [],
        apiRefs: [],
        promptIds: [],
    },

    // ★ v0.20 资产系统 + 资产说明（金钱观 / 当前是否富裕）
    //   v4.2：assets / assetNotes 已升级到 v2（assetBalance + incomeEvents），旧字段不再保留
    assetNotes: { enabled: false, description: '' },

    // ★ v0.23 独立卡来源关系
    variantType: 'base',
    parentPersonaId: '',
    rootPersonaId: '',
    phaseMeta: { name: '', age: null, timelinePrompt: '' },

    // ★ v0.17 旧嵌套字段（启动时迁移为独立卡）
    lifePhases: [],
    activeLifePhaseId: '',
    parOs: [],

    // ★ v0.21 圈子：与世界观下其他人设的关系 / 我视角下的认知
    circle: { members: [] },

    // ★ v0.17 概率 / 每日快照
    moodProbability: { enabled: false, weights: {} },
    lastCalculatedDate: '',
    dailyMood: '',

    createdAt: 0,
    updatedAt: 0,
});

// ============================================
// 标签 / 标签组 预设
// ============================================

export const SYSTEM_TAG_GROUPS = Object.freeze([
    {
        id: 'tgroup-system-personality',
        scope: 'global',
        name: '性格',
        description: '对象的核心性格',
        color: '#7c3aed',
        isSystem: true,
        suggestedTags: ['善良', '温柔', '阴沉', '神经质', '社恐', '外向', '腹黑', '豁达'],
    },
    {
        id: 'tgroup-system-occupation',
        scope: 'global',
        name: '职业',
        description: '对象的社会身份',
        color: '#0ea5e9',
        isSystem: true,
        suggestedTags: ['学生', '商人', '侠客', '医生', 'AI', '设计师', '工程师'],
    },
    {
        id: 'tgroup-system-species',
        scope: 'global',
        name: '种族 / 物种',
        description: '对象是什么"人"',
        color: '#10b981',
        isSystem: true,
        suggestedTags: ['人类', '妖族', '改造人', '神族', '仿生人'],
    },
    {
        id: 'tgroup-system-mood',
        scope: 'global',
        name: '心情 / 状态',
        description: '当下情绪（可被 sentimentMap 引用）',
        color: '#f59e0b',
        isSystem: true,
        suggestedTags: ['平静', '烦躁', '心动', '绝望', '兴奋', '孤独', '愤怒'],
    },
    {
        id: 'tgroup-system-genre',
        scope: 'global',
        name: '风格 / 调性',
        description: '世界观的艺术风格',
        color: '#ec4899',
        isSystem: true,
        suggestedTags: ['古风', '赛博朋克', '像素', '低魔', '治愈', '暗黑'],
    },
]);

// ============================================
// 心情预设
// ============================================

export const MOOD_PRESETS = Object.freeze([
    { value: 'happy', label: '开心' },
    { value: 'calm', label: '平静' },
    { value: 'melancholy', label: '忧郁' },
    { value: 'excited', label: '兴奋' },
    { value: 'lonely', label: '孤独' },
    { value: 'angry', label: '愤怒' },
    { value: 'peaceful', label: '安宁' },
    { value: 'anxious', label: '焦虑' },
]);

// ============================================
// IndexedDB 表名
// ============================================

export const SDK_STORES = Object.freeze({
    users: 'sdkUsers',
    aiPersons: 'sdkAiPersons',
    worlds: 'sdkWorlds',
    worldGroups: 'sdkWorldGroups',
    tagGroups: 'sdkTagGroups',
    tags: 'sdkTags',
    places: 'sdkPlaces',
    locations: 'sdkLocations',
    snapshots: 'sdkSnapshots',
    active: 'sdkActive',
    drafts: 'sdkDrafts',
    diaries: 'sdkDiaries',            // ★ v0.18 人设日记
    schedules: 'sdkSchedules',          // ★ v0.19 人设日程（id = `${entityType}:${entityId}:${date}`）
    weeklySchedules: 'sdkWeeklySchedules', // ★ v0.31 每周重复日程（id = `${entityType}:${entityId}:${dayOfWeek}`）
    chatContacts: '__deprecated__', // v0.27 联系人删除该表,字段保留防历史代码 import 报错
    chatMessages: 'chatMessages',   // ★ v0.30 chat-app 真实消息存储
    storyArchives: 'sdkStoryArchives', // ★ v0.42 chat-app 故事存档
    chatFavorites: 'sdkChatFavorites', // ★ v0.43 chat-app 单条收藏
    chatArchiveMessages: 'chatArchiveMessages', // ★ v0.61 chat-app 消息归档(昨天及更早的消息)
    appPromptStates: 'appPromptStates',       // ★ v0.61.5 第三方 App Prompt 用户状态(key = `${appId}::${promptId}`)
});

// 默认用户卡持久化 key（存在 sdkActive 表里）
export const ACTIVE_DEFAULT_USER_KEY = 'activeDefaultUser';

// ============================================
// ID 生成工具
// ============================================

/**
 * 规整 id 字符串（首字母开头 + 字母数字下划线-，长度 ≤64）
 */
export function normalizeInstanceId(raw, prefix = 'entity') {
    if (typeof raw === 'string' && /^[a-zA-Z][\w-]{0,63}$/.test(raw)) return raw;
    return `${prefix}-${randomSuffix()}`;
}

/**
 * 生成下一个自增 id（user0 / ai0 / world0 ...）。
 */
export function nextIndexedId(prefix, existingIds) {
    const used = new Set(existingIds || []);
    let i = 0;
    while (used.has(`${prefix}${i}`)) i++;
    return `${prefix}${i}`;
}

/**
 * 生成唯一短后缀（base36 8 位）。
 */
export function randomSuffix() {
    return Math.random().toString(36).slice(2, 10);
}

/**
 * 生成唯一 id（带前缀 + 时间戳 + 短后缀），用于无法递增的实体（如 anchor 等）。
 */
export function uniqueId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${randomSuffix()}`;
}

// ============================================
// 从子模块重新导出（保持向后兼容）
// ============================================

// 时间系统常量（已移除阶段相关常量；新增锚点）
// v0.17：周期层级 = 大周期（年）/ 中周期（月）/ 小周期（日），
//       已彻底移除「基周期」/「周」概念
export {
    TIMELINE_CATEGORIES,
    TIMELINE_TYPES,
    DEFAULT_TIMELINE_EVENT,
    DEFAULT_CHRONOLOGY_FALLBACK,
    DEFAULT_DIVISIONS,
    DEFAULT_12_HOURS,
    DEFAULT_24_HOURS,
    ANCHOR_TYPES,
    DEFAULT_ANCHOR,
    DEFAULT_WEEK_DAY_NAMES,
    DEFAULT_CURRENCY_NAME,
} from './chronology/chronology-constants.js';

// 地理系统常量
export {
    DEFAULT_PLACE,
    DEFAULT_LOCATION,
    REAL_CITIES,
} from './geo/geo-constants.js';
