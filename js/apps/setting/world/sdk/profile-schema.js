/**
 * 设置 App · 实体档案 Profile · 字段 schema
 *
 * 思路（参考 思路.txt §0.2）：
 *   每个实体的字段都有一个「可见性」标记，决定它在「详细 / 简略」模式下
 *   是否显示。约定三种 visibility：
 *
 *     - 'required'  (R) 两种模式都显示 + 必填
 *     - 'optional'  (O) 两种模式都显示 + 可空
 *     - 'advanced'  (A) 仅详细模式显示
 *
 *   模式只决定 UI 是否显示，不删数据。切到简略模式后 A 字段还在内存 / IndexedDB 里。
 *
 *   字段类型：
 *     - 'text'      单行 / 多行文本
 *     - 'tags'      标签引用数组（tagRefs）
 *     - 'refs'      实体引用数组
 *     - 'select'    枚举值单选
 *     - 'date'      日期字符串
 *
 *   本文件只导出常量，不做副作用。其他模块从这里读取「字段清单」。
 *
 *   加字段 = 加一行；改 visibility = 改一行；UI 跟 AI 上下文注入自动同步。
 */

export const VISIBILITY = Object.freeze({
    REQUIRED: 'required',
    OPTIONAL: 'optional',
    ADVANCED: 'advanced',
});

export const FIELD_TYPE = Object.freeze({
    TEXT: 'text',
    TAGS: 'tags',
    REFS: 'refs',
    SELECT: 'select',
    NUMBER: 'number',
    JSON: 'json',
    MBTI: 'mbti',
});

export const MBTI_OPTIONS = Object.freeze([
    'INTJ', 'INTP', 'ENTJ', 'ENTP',
    'INFJ', 'INFP', 'ENFJ', 'ENFP',
    'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
    'ISTP', 'ISFP', 'ESTP', 'ESFP',
]);

/**
 * 一个字段 schema 长这样：
 *
 *   {
 *     key: 'name',
 *     label: '名称',
 *     type: 'text',
 *     visibility: 'required',
 *     placeholder: '...',
 *     helper: '...',
 *     options?: [{ value, label }],
 *   }
 */

/* ============================================
 * 用户 (User)
 * ============================================ */

export const USER_SCHEMA = Object.freeze([
    Object.freeze({
        key: 'name',
        label: '显示名',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.REQUIRED,
        placeholder: '我 / 小张',
    }),
    Object.freeze({
        key: 'pronouns',
        label: '代词',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL,
        placeholder: '他 / 她 / 它',
    }),
    Object.freeze({
        key: 'summary',
        label: '一句话描述',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL,
        placeholder: '用一段话介绍自己',
        multiline: true,
        rows: 3,
    }),
    Object.freeze({
        key: 'preferences',
        label: '偏好',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL,
        placeholder: '每行一条偏好',
        multiline: true,
        rows: 4,
        listField: true,
        helper: '保存时按行切成数组。',
    }),
    Object.freeze({
        key: 'tagRefs',
        label: '标签',
        type: FIELD_TYPE.TAGS,
        visibility: VISIBILITY.OPTIONAL,
        helper: '从标签库中选择；可跨世界观复用。',
    }),
    Object.freeze({
        key: 'notes',
        label: '备注',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.ADVANCED,
        multiline: true,
        rows: 2,
    }),
    Object.freeze({
        key: 'currentLocationRef',
        label: '当前虚构地点',
        type: FIELD_TYPE.REFS,
        visibility: VISIBILITY.ADVANCED,
        helper: '与 AI 当日快照无关，仅记录「你自称在哪」。',
    }),
]);

/* ============================================
 * 通用区块定义（AI / User 共用）
 *
 * 思路：
 *   每个实体（AI / User）下都有一套「人设字段」，但每条字段都属于某个
 *   「区块」（base / preferences / habits /
 *   memory / phases / resources / paro / circle）。
 *
 *   每个区块有：
 *     key         —— 区块 ID（也对应实体对象里的字段，如 person.preferences）
 *     title       —— UI 上方区块标题
 *     subtitle    —— 区块副标题
 *     helper      —— 区块说明
 *     enabledKey  —— 该区块的 enabled 开关在父对象上的字段路径
 *     defaultEnabled —— 区块默认是否启用（false = 默认折叠）
 *     fields      —— 该区块下的字段 schema（每个字段 type 必须真实存在）
 *
 *   写一个区块：加一个对象到对应 SCHEMA 数组。
 *   添加字段：在该区块的 `fields` 里加一项。
 * ============================================ */

export const PERSONA_BASE_FIELDS = Object.freeze([
    Object.freeze({
        key: 'name', label: '姓名', type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.REQUIRED, placeholder: '小黄',
    }),
    Object.freeze({
        key: 'gender', label: '性别', type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL, placeholder: '男 / 女 / 其他',
    }),
    Object.freeze({
        key: 'age', label: '年龄', type: FIELD_TYPE.NUMBER,
        visibility: VISIBILITY.OPTIONAL, placeholder: '17',
    }),
    Object.freeze({
        key: 'appearance', label: '外貌', type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL, multiline: true, rows: 2,
        placeholder: '阳光少年，棕色短发，眼睛有神',
    }),
    Object.freeze({
        key: 'personality', label: '性格', type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL, placeholder: '活泼开朗，有点中二',
    }),
    Object.freeze({
        key: 'currentOccupation', label: '当前职业', type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL, placeholder: '学生 / 程序员 / 作家',
    }),
    Object.freeze({
        key: 'bio', label: '一句话简介', type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL, placeholder: '用一句话概括这个人',
    }),
    Object.freeze({
        key: 'experience', label: '角色介绍', type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL, multiline: true, rows: 4,
        placeholder: '小学接触游戏，初二开始打排位…',
    }),
]);

const TEXT_LIST = (key, placeholder, helper = '每行一条，保存时自动切成数组。') =>
    Object.freeze({
        key, type: FIELD_TYPE.TEXT, visibility: VISIBILITY.OPTIONAL,
        multiline: true, rows: 3, listField: true, placeholder, helper,
    });

const SIMPLE_TEXT = (key, label, placeholder, opts = {}) =>
    Object.freeze({
        key, label, type: FIELD_TYPE.TEXT, visibility: VISIBILITY.OPTIONAL,
        placeholder, ...opts,
    });

/* 偏好 preferences：喜欢/讨厌/爱好/过敏 */
/* 注：宠物/侍从/圈子这一类「与其他人设的关系」已迁移到独立的「圈子」section，
   不再放在偏好里。这样能够：
     1) 拉取到世界观下其他人设
     2) 对绑定的人设写一段「我视角下的认知」
     3) 与对方自己的人设彼此独立 */
const PREFERENCES_FIELDS = Object.freeze([
    TEXT_LIST('hobbies', '爱好（每行一条）'),
    TEXT_LIST('likes', '喜欢（每行一条）'),
    TEXT_LIST('dislikes', '讨厌（每行一条）'),
    TEXT_LIST('allergies', '过敏（每行一条）'),
]);

/* 资产状态 assets：余额（首页卡片编辑）+ 描述（金钱观 / 当前是否富裕等）。
   余额已通过主页卡片编辑，这里只展示描述文本。开关启用后才会出现在上下文。*/
const ASSET_NOTE_FIELDS = Object.freeze([
    TEXT_LIST('description', '资产说明（每行一条：如金钱观 / 经济处境 / 富裕度）'),
]);

/* 原生家庭字段已迁出到独立的「圈子」section，这里不再渲染。
   旧数据中残留的 family 字段（如 members / familyNotes）会在加载时被丢弃，
   但 persona 对象本身的结构不会被破坏。*/

/* schedule 模块的「作息条目」字段已迁到主页卡片编辑，这里不再通过编辑器渲染。
   存储字段 persona.schedule.{enabled,injectToPrompt,rhythm} 仍在 personality 默认值里，
   人设主页 schedule 卡片据此读写。*/

/* 月计划 monthlyPlan 已迁出到日程模块，这里不再渲染。*/

/* 记忆 memory：单一文本区域，每行一条 */
const MEMORY_FIELDS = Object.freeze([
    Object.freeze({
        key: 'text', label: '记忆', type: FIELD_TYPE.JSON,
        visibility: VISIBILITY.OPTIONAL, multiline: true, rows: 8,
        placeholder: '每行一条：记忆内容',
        helper: '每行一条，自动同步到上下文',
    }),
]);

/* 三观 worldview：自由文本列表，每行一条 */
const WORLDVIEW_FIELDS = Object.freeze([
    Object.freeze({
        key: 'text', label: '三观', type: FIELD_TYPE.JSON,
        visibility: VISIBILITY.OPTIONAL, multiline: true, rows: 6,
        placeholder: '每行一条：三观内容',
        helper: '每行一条，用户自定义填写',
    }),
]);

/* MBTI：类型选择 + 简介 */
const MBTI_FIELDS = Object.freeze([
    Object.freeze({
        key: 'type', label: 'MBTI 类型', type: FIELD_TYPE.MBTI,
        visibility: VISIBILITY.OPTIONAL,
        placeholder: '选择 MBTI 类型',
    }),
    Object.freeze({
        key: 'description', label: '简介', type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL, multiline: true, rows: 3,
        placeholder: '简单描述这个 MBTI 的特点',
    }),
]);

/* 心理内核 psychologicalCore：自由文本列表 */
const PSYCHOLOGICAL_FIELDS = Object.freeze([
    Object.freeze({
        key: 'text', label: '心理内核', type: FIELD_TYPE.JSON,
        visibility: VISIBILITY.OPTIONAL, multiline: true, rows: 6,
        placeholder: '每行一条：心理内核描述',
        helper: '每行一条，反映内心核心驱动',
    }),
]);

/* 道德底线 moralBoundary：自由文本列表 */
const MORAL_FIELDS = Object.freeze([
    Object.freeze({
        key: 'text', label: '道德底线', type: FIELD_TYPE.JSON,
        visibility: VISIBILITY.OPTIONAL, multiline: true, rows: 6,
        placeholder: '每行一条：道德底线描述',
        helper: '每行一条，定义不可逾越的底线',
    }),
]);

/* 技能与兴趣 skills：自由文本列表 */
const SKILLS_FIELDS = Object.freeze([
    Object.freeze({
        key: 'text', label: '技能与兴趣', type: FIELD_TYPE.JSON,
        visibility: VISIBILITY.OPTIONAL, multiline: true, rows: 6,
        placeholder: '每行一条：技能或兴趣',
        helper: '每行一条，列出擅长的技能和兴趣',
    }),
]);

// resources 区块不再使用 schema fields —— 它由独立的 resources-section.js
// 渲染（按 groupIds 列表绑定图组 + API 占位 + 提示词占位）。
// 这里保留一个占位 export，让旧引用不报错。
export const RESOURCES_FIELDS = Object.freeze([]);

/* 顶级元字段（不属于任何模块开关）*/
export const PERSONA_META_FIELDS = Object.freeze([
    Object.freeze({
        key: 'boundWorldId', label: '绑定世界观 ID', type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL, placeholder: 'world-xxx，留空为自由模式',
    }),
    Object.freeze({
        key: 'tagRefs', label: '标签', type: FIELD_TYPE.TAGS,
        visibility: VISIBILITY.OPTIONAL,
    }),
    SIMPLE_TEXT('notes', '备注', '自由备注', { multiline: true, rows: 2 }),
]);

/* ============================================
 * AI 人设 (AI Person) · 分组渲染
 * ============================================ */

/**
 * AI 人设的全部「区块」。每项是一个组，UI 会按组渲染。
 *   - 第一组「本体」特殊：必显，不需要 enabled 开关。
 *   - 其他「动态模块」组：默认折叠，只有 enabled === true 时展开。
 *   - 「人生阶段 / parO / 资源绑定」单独渲染。
 */
export const AI_PERSONA_GROUPS = Object.freeze([
    Object.freeze({
        key: 'base', title: '本体（核心资料）', alwaysOn: true,
        fields: PERSONA_BASE_FIELDS,
    }),
    Object.freeze({
        key: 'preferences', title: '偏好',
        subtitle: '爱好 / 喜欢 / 讨厌 / 过敏', moduleFlag: 'preferences.enabled',
        fields: PREFERENCES_FIELDS,
    }),
    Object.freeze({
        key: 'assetNotes', title: '资产',
        subtitle: '资产说明（金钱观 / 经济处境）',
        defaultEnabled: false, // 默认折叠
        fields: ASSET_NOTE_FIELDS,
    }),
    Object.freeze({
        key: 'memory', title: '记忆',
        subtitle: '每行一条人生重要记忆',
        moduleFlag: 'memory.enabled', fields: MEMORY_FIELDS,
    }),
    Object.freeze({
        key: 'worldview', title: '三观',
        subtitle: '自由填写每行一条',
        moduleFlag: 'worldview.enabled', fields: WORLDVIEW_FIELDS,
    }),
    Object.freeze({
        key: 'mbti', title: 'MBTI',
        subtitle: '类型选择 + 简介',
        moduleFlag: 'mbti.enabled', fields: MBTI_FIELDS,
    }),
    Object.freeze({
        key: 'psychological', title: '心理内核',
        subtitle: '每行一条内心核心驱动',
        moduleFlag: 'psychological.enabled', fields: PSYCHOLOGICAL_FIELDS,
    }),
    Object.freeze({
        key: 'moral', title: '道德底线',
        subtitle: '每行一条不可逾越的底线',
        moduleFlag: 'moral.enabled', fields: MORAL_FIELDS,
    }),
    Object.freeze({
        key: 'skills', title: '技能与兴趣',
        subtitle: '每行一条擅长技能或兴趣',
        moduleFlag: 'skills.enabled', fields: SKILLS_FIELDS,
    }),
    // 资源绑定已抽离为独立 section（由 resources-section.js 渲染），
    // 不再作为 persona group 出现。
]);

/* 兼容旧 schema 名：profile-schema 的 AI_SCHEMA 仍导出 legacy 形态，但渲染层优先使用 AI_PERSONA_GROUPS。*/
export const AI_SCHEMA = Object.freeze([
    Object.freeze({
        key: 'name',
        label: 'AI 名字',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.REQUIRED,
        placeholder: '默认 AI',
    }),
    Object.freeze({
        key: 'boundWorldRef',
        label: '绑定世界观',
        type: FIELD_TYPE.REFS,
        visibility: VISIBILITY.OPTIONAL,
        helper: '一个 AI 人设绑定一个世界观；不选则不绑定。',
    }),
    Object.freeze({
        key: 'role',
        label: '角色',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL,
        placeholder: '通用助手 / 心理陪伴 / 创作搭档',
    }),
    Object.freeze({
        key: 'tone',
        label: '语气',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL,
        placeholder: '温柔、克制、像朋友',
    }),
    Object.freeze({
        key: 'summary',
        label: '总述',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL,
        multiline: true,
        rows: 3,
        placeholder: 'AI 怎么说话、定位是什么',
    }),
    Object.freeze({
        key: 'rules',
        label: '规则',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL,
        multiline: true,
        rows: 5,
        listField: true,
        helper: '每行一条规则；保存时切成数组。',
    }),
    Object.freeze({
        key: 'tagRefs',
        label: '标签',
        type: FIELD_TYPE.TAGS,
        visibility: VISIBILITY.OPTIONAL,
    }),
    Object.freeze({
        key: 'notes',
        label: '备注',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.ADVANCED,
        multiline: true,
        rows: 2,
    }),
    Object.freeze({
        key: 'boundLocationRefs',
        label: '常驻地点',
        type: FIELD_TYPE.REFS,
        visibility: VISIBILITY.ADVANCED,
        helper: '决定 AI 能收到哪些天气 / 事件。',
    }),
]);

/* 用户（人设）也支持同样的分组（base 必显 + 8 个可选模块）*/
export const USER_PERSONA_GROUPS = AI_PERSONA_GROUPS;

/* ============================================
 * 世界观 (World)
 * ============================================ */

export const WORLD_SCHEMA = Object.freeze([
    Object.freeze({
        key: 'name',
        label: '名称',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.REQUIRED,
        placeholder: '给这个世界观起个名字',
    }),
    Object.freeze({
        key: 'summary',
        label: '一句话主旨',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.REQUIRED,
        multiline: true,
        rows: 2,
        placeholder: '用一句话概括世界观的核心氛围',
    }),
    Object.freeze({
        key: 'keyPoints',
        label: '要点',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL,
        multiline: true,
        rows: 5,
        listField: true,
        helper: '每行一条要点；保存时切成数组。',
    }),
    Object.freeze({
        key: 'timeline',
        label: '时间线 / 编年史',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.OPTIONAL,
        multiline: true,
        rows: 3,
        placeholder: '按年份或事件节点排列',
    }),
    Object.freeze({
        key: 'tagRefs',
        label: '标签',
        type: FIELD_TYPE.TAGS,
        visibility: VISIBILITY.OPTIONAL,
        helper: '挂到这个世界观自身的标签（例如「古风」「低魔」）。',
    }),
    Object.freeze({
        key: 'locations',
        label: '城市 / 地点',
        type: FIELD_TYPE.REFS,
        visibility: VISIBILITY.OPTIONAL,
        helper: '从下方「地点」标签组里挂载到本世界观。',
    }),
    Object.freeze({
        key: 'notes',
        label: '备注',
        type: FIELD_TYPE.TEXT,
        visibility: VISIBILITY.ADVANCED,
        multiline: true,
        rows: 2,
    }),
    Object.freeze({
        key: 'calendarSettings',
        label: '日历设置',
        type: FIELD_TYPE.JSON,
        visibility: VISIBILITY.ADVANCED,
        helper: '是否启用「工作日 / 休息日」、自定义周名等。',
    }),
]);

/* ============================================
 * 工具函数
 * ============================================ */

/**
 * 按当前 mode 过滤 schema 字段。
 *   - 'detailed' → 返回所有字段
 *   - 'minimal'  → 只保留 required + optional
 */
export function filterSchemaByMode(schema, mode = 'minimal') {
    if (mode === 'detailed') return schema.slice();
    return schema.filter(field => field.visibility !== VISIBILITY.ADVANCED);
}

/**
 * 按 entityType 拿到 schema。
 */
export function getSchema(entityType) {
    switch (entityType) {
        case 'user': return USER_SCHEMA;
        case 'ai': return AI_SCHEMA;
        case 'world': return WORLD_SCHEMA;
        default: return [];
    }
}

/**
 * 拿到「人设分组」清单（自带 base + 各模块）。给 UI 层渲染分组用。
 * @param {'ai'|'user'} entityType
 * @returns {ReadonlyArray<{key, title, subtitle?, moduleFlag?, fields: ReadonlyArray, alwaysOn?: boolean}>}
 */
export function getPersonaGroups(entityType) {
    if (entityType === 'ai') return AI_PERSONA_GROUPS;
    if (entityType === 'user') return USER_PERSONA_GROUPS;
    return [];
}

/**
 * 把「复杂 JSON 字段」从 textarea 字符串解析成 JSON 对象 / 数组。
 *   - 行式（每行一条）转成对应结构
 *   - 失败时回退到原始字符串
 */
export function parseFieldValue(field, raw) {
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (value == null || value === '') {
        if (field.type === FIELD_TYPE.JSON) return field.key === 'members'
            || field.key === 'weekly' || field.key === 'monthly' || field.key === 'goals'
            || field.key === 'events' || field.key === 'apiAccounts'
            ? [] : '';
        return '';
    }
    if (field.type === FIELD_TYPE.TEXT && field.listField) {
        return value.split('\n').map(s => s.trim()).filter(Boolean);
    }
    if (field.type === FIELD_TYPE.NUMBER) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    return value;
}

/**
 * 把一个字段标记映射成符号（R / O / A）。
 */
export function visibilitySymbol(visibility) {
    switch (visibility) {
        case VISIBILITY.REQUIRED: return 'R';
        case VISIBILITY.OPTIONAL: return 'O';
        case VISIBILITY.ADVANCED: return 'A';
        default: return '·';
    }
}

/**
 * 列出「必填」字段的 key（用于 §8.12 提到的 incompleteFields 计算）。
 */
export function getRequiredKeys(entityType) {
    return getSchema(entityType)
        .filter(field => field.visibility === VISIBILITY.REQUIRED)
        .map(field => field.key);
}