/**
 * 设置 App · 默认值 + 预设
 *
 * 注意：
 *   - 世界 / 用户 / AI 人设的默认值已迁移到 `world/sdk/defaults.js`
 *     (DEFAULT_WORLD_INSTANCE / DEFAULT_USER_INSTANCE / DEFAULT_AI_INSTANCE)
 *   - 外观相关的常量已迁移到 `appearance-general/defaults.js`
 *   - 本文件仅保留 API 配置相关的常量
 */

const API_LABEL_DEFAULT = '默认 API';
const API_PROVIDER_DEFAULT = 'openai-compatible';
const API_BASEURL_DEFAULT = 'https://api.openai.com/v1';
const API_MODEL_DEFAULT = 'gpt-4o-mini';
const API_TEMPERATURE_DEFAULT = 0.7;

// ============================================
// API 预设选项（仍被 API 管理器 UI 使用）
// ============================================

export const PROVIDER_OPTIONS = Object.freeze([
    { value: 'openai-compatible', label: 'OpenAI 兼容（含 DeepSeek / 硅基 / Moonshot…）' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'custom', label: '自定义' },
]);

export const DEFAULT_API_PARAMS = Object.freeze({
    label: API_LABEL_DEFAULT,
    provider: API_PROVIDER_DEFAULT,
    baseUrl: API_BASEURL_DEFAULT,
    apiKey: '',
    model: API_MODEL_DEFAULT,
    temperature: API_TEMPERATURE_DEFAULT,
    notes: '',
});
