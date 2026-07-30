/**
 * 设置 App · 默认值 + 预设（外观与通用 之外的部分）
 *
 * 把所有「写死的初始值」集中到这里，便于：
 *  - 重置时直接复用
 *  - 国际化 / 改文案时只动一处
 *  - UI 预设（世界 / 用户 / AI / API）有统一形参
 *
 * 注意：
 *  - 外观相关的常量（DEFAULT_THEME / initialAppearance / CASE_PRESETS 等）
 *    已经迁到 appearance-general/ 子目录，不要在这里继续维护。
 */

const WORLD_NAME_DEFAULT = '默认世界观';
const WORLD_SUMMARY_DEFAULT = '一个待补充的世界观。先写一句话主旨，再用 key points 列出设定要点。';

const USER_NAME_DEFAULT = '我';
const USER_SUMMARY_DEFAULT = '用一段话描述自己，让 AI 更懂你。';

const AI_NAME_DEFAULT = '默认 AI';
const AI_ROLE_DEFAULT = '通用助手';
const AI_TONE_DEFAULT = '温柔、克制、像朋友';
const AI_SUMMARY_DEFAULT = '让 AI 知道自己是谁、怎么说话、要遵守什么。';

const API_LABEL_DEFAULT = '默认 API';
const API_PROVIDER_DEFAULT = 'openai-compatible';
const API_BASEURL_DEFAULT = 'https://api.openai.com/v1';
const API_MODEL_DEFAULT = 'gpt-4o-mini';
const API_TEMPERATURE_DEFAULT = 0.7;

// ============================================
// 子项默认值
// ============================================

export const DEFAULT_WORLD = Object.freeze({
    name: WORLD_NAME_DEFAULT,
    summary: WORLD_SUMMARY_DEFAULT,
    keyPoints: Object.freeze([]),
    timeline: '',
    notes: '',
    currencies: Object.freeze([
        Object.freeze({
            id: 'curr-default-gold',
            name: '金币',
            symbol: 'G',
            unit: '元',
            note: '这个世界的基础货币',
            exchangeToBase: null,
            baseCurrencyId: null,
            baseAmount: 1,
            isBase: true,
            order: 0,
            updatedAt: Date.now(),
        }),
    ]),
});

export const DEFAULT_USER = Object.freeze({
    name: USER_NAME_DEFAULT,
    pronouns: '',
    summary: USER_SUMMARY_DEFAULT,
    preferences: Object.freeze([]),
    notes: '',
});

export const DEFAULT_AI = Object.freeze({
    name: AI_NAME_DEFAULT,
    role: AI_ROLE_DEFAULT,
    tone: AI_TONE_DEFAULT,
    summary: AI_SUMMARY_DEFAULT,
    rules: Object.freeze([]),
    notes: '',
});

export const DEFAULT_API = Object.freeze({
    label: API_LABEL_DEFAULT,
    provider: API_PROVIDER_DEFAULT,
    baseUrl: API_BASEURL_DEFAULT,
    apiKey: '',
    model: API_MODEL_DEFAULT,
    temperature: API_TEMPERATURE_DEFAULT,
    notes: '',
});

/** 一个可写的快照（在 normalize/reset 时用） */
export function cloneDefaults() {
    return {
        world: { ...DEFAULT_WORLD, keyPoints: [] },
        user: { ...DEFAULT_USER, preferences: [] },
        ai: { ...DEFAULT_AI, rules: [] },
        api: { ...DEFAULT_API },
    };
}

// ============================================
// UI 预设（API 选项）
// ============================================

export const PROVIDER_OPTIONS = Object.freeze([
    { value: 'openai-compatible', label: 'OpenAI 兼容（含 DeepSeek / 硅基 / Moonshot…）' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'custom', label: '自定义' },
]);

// ============================================
// IndexedDB keys / 表名（外观与通用 已迁到 appearance-general/defaults.js）
// ============================================

export const DB_KEY = Object.freeze({
    world: 'active',
    user: 'active',
    ai: 'active',
    api: 'active',
});

export const STORE_NAME = Object.freeze({
    world: 'worldBook',
    user: 'userPersona',
    ai: 'aiPersona',
    api: 'apiProfiles',
});