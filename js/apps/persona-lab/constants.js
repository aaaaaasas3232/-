/**
 * 人设机 · 常量
 *
 * ★ 这个文件里不允许出现任何颜色值。颜色的唯一真相是
 *   `css/apps/persona-lab/_theme.css`,JS 只写 token 名。
 */

export const APP_ID = 'persona-lab';

/** 人设卡归属:写回 nook 时决定进 sdkUsers 还是 sdkAiPersons */
export const SCOPES = Object.freeze([
    { id: 'ai', label: 'AI 人设' },
    { id: 'user', label: '用户人设' },
]);

/** 工作台内部的三段 */
export const WORKBENCH_TABS = Object.freeze([
    { id: 'ask', label: '提问' },
    { id: 'refine', label: '打磨' },
    { id: 'card', label: '档案' },
]);

/** 对话的两种身份 */
export const ASK_MODES = Object.freeze([
    { id: 'persona', label: '扮演', hint: '让人设本人回答,观察她像不像' },
    { id: 'advisor', label: '顾问', hint: '让顾问读完对话,指出人设哪里该补' },
]);

/** 消息角色 */
export const ROLE = Object.freeze({
    USER: 'user',
    PERSONA: 'persona',
    ADVISOR: 'advisor',
    SYSTEM: 'system',
});

/**
 * 超时。
 *
 * 流式用**空闲超时**(连续多久没数据),不是总时长 —— 生成一段长回答跑一分钟是正常的。
 */
export const TIMEOUT = Object.freeze({
    normal: 90000,
    streamIdle: 90000,
    convert: 120000,
});

/**
 * 上下文段落清单。
 *
 * 每一段都能被用户单独关掉(`draft.contextConfig[id] !== false`),
 * 而且**预览和实际发送读的是同一份** —— 见 `services/prompt-builder.js` 顶部的说明。
 *
 * `locked` 的段不给关:关掉之后模型会忘记自己在扮演谁 / 忘记按格式输出建议。
 */
export const CONTEXT_SECTIONS = Object.freeze([
    { id: 'duty', tag: '任务须知', label: '任务须知', desc: '这一轮要它做什么', locked: true },
    { id: 'persona', tag: '人设正文', label: '人设正文', desc: '当前草稿的全文', locked: true },
    { id: 'world', tag: '世界观', label: '世界观', desc: '人设卡绑定的世界观' },
    { id: 'partner', tag: '对话对象', label: '对话对象', desc: '默认用户卡:她在跟谁说话' },
    { id: 'quiz', tag: '当前测题', label: '当前测题', desc: '题库里正在问的那一题' },
    { id: 'transcript', tag: '对话记录', label: '对话记录', desc: '最近若干轮问答' },
    { id: 'format', tag: '输出格式', label: '输出格式', desc: '硬约束,关不掉', locked: true },
]);

/** 拼 prompt 时最多带多少轮问答 —— 再多对「像不像」的判断没有帮助,只是烧 token */
export const TRANSCRIPT_LIMIT = 12;

/** 建议历史保留条数。这是「翻一翻」用的,不是归档。 */
export const LOG_LIMIT = 60;

/** 草稿标题兜底 */
export const UNTITLED = '未命名人设';

/** 空草稿的正文占位(新建时先给一副骨架,免得用户面对一片空白) */
export const STARTER_TEXT = [
    '姓名：',
    '性别：',
    '年龄：',
    '外貌：',
    '性格：',
    '职业：',
    '一句话简介：',
    '角色介绍：',
].join('\n');
