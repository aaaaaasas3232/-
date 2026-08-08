/**
 * 设置 App · API 管理 SDK
 *
 * 提供高自由度的 API Key 管理能力：
 * - API Key：存储多个 API 密钥，支持自定义模型、URL、认证方式
 * - API Group：API 组，支持轮询策略（round-robin）
 * - Usage Logs：调用日志，记录每次请求的 token 消耗、延迟等
 *
 * 数据结构：
 * - apiKeys: { id, label, provider, baseUrl, apiKey, model, enabled, sortOrder, ...params }
 * - apiGroups: { id, name, apiKeyIds[], strategy: 'round-robin'|'sequential'|'random', currentIndex }
 * - apiUsageLogs: { id, apiKeyId, groupId?, timestamp, inputTokens, outputTokens, totalTokens, latency, model, success, error }
 *
 * Usage：
 *   import { apiKeySdk } from './api-key-sdk.js';
 *   apiKeySdk.list() / apiKeySdk.get(id) / apiKeySdk.put(key) / apiKeySdk.remove(id)
 *   apiGroupSdk.list() / apiGroupSdk.getNextInGroup(groupId)
 */

import { escapeHtml } from '@/src/core/escape.js';

// ============================================
// 全局 Sdk 实例（单例）
// ============================================

let _apiKeySdk = null;
let _apiGroupSdk = null;
let _apiUsageSdk = null;

/**
 * 获取 API Key SDK（延迟初始化，等 IndexedDB 就绪）
 */
export function getApiKeySdk() {
    return _apiKeySdk;
}

/**
 * 获取 API Group SDK
 */
export function getApiGroupSdk() {
    return _apiGroupSdk;
}

/**
 * 获取 API Usage Log SDK
 */
export function getApiUsageSdk() {
    return _apiUsageSdk;
}

/**
 * 初始化 API SDK（从 main.js hydrate 时调用）
 */
export function bootstrapApiSdk({ toolkit }) {
    const db = toolkit.db;

    _apiKeySdk = createApiKeySdk(db);
    _apiGroupSdk = createApiGroupSdk(db);
    _apiUsageSdk = createApiUsageSdk(db);

    return { apiKeySdk: _apiKeySdk, apiGroupSdk: _apiGroupSdk, apiUsageSdk: _apiUsageSdk };
}

// ============================================
// 工具函数
// ============================================

function uid(prefix = 'api') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
    return Date.now();
}

/**
 * ★ v0.62.6 统一查找 API Key:
 *   优先用 window.__apiSdk(来自 api-manager-section.js,有内存缓存),
 *   fallback 到 _apiKeySdk(由 bootstrapApiSdk 初始化,可能未初始化)
 *   → chat-app 等业务 app 即使没经过 settings app 也能找到 key
 */
function _getApiKeyById(id) {
    if (!id) return null;
    const sdk = window.__apiSdk?.apiKeySdk || _apiKeySdk;
    return sdk?.get?.(id) || null;
}

// ============================================
// API Key SDK
// ============================================

function createApiKeySdk(db) {
    const STORE = 'apiKeys';

    return {
        /** 列出所有 API Key */
        list() {
            const raw = db.getAll(STORE) || [];
            return raw.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        },

        /** 获取单个 API Key */
        get(id) {
            return db.get(STORE, id) || null;
        },

        /** 保存/更新 API Key */
        put(key) {
            if (!key.id) key.id = uid('key');
            key.updatedAt = now();
            if (key.sortOrder == null) key.sortOrder = now();
            db.put(STORE, key);
            return key;
        },

        /** 删除 API Key */
        remove(id) {
            db.remove(STORE, id);
        },

        /** 获取启用的 API Key */
        listEnabled() {
            return this.list().filter(k => k.enabled !== false);
        },

        /** 按 Provider 筛选 */
        listByProvider(provider) {
            return this.list().filter(k => k.provider === provider);
        },

        /** 获取单个 API Key 的统计 */
        getStats(id) {
            const logs = (_apiUsageSdk?.listByApiKey(id) || []);
            const totalCalls = logs.length;
            const successfulCalls = logs.filter(l => l.success !== false).length;
            const failedCalls = totalCalls - successfulCalls;
            const totalInputTokens = logs.reduce((sum, l) => sum + (l.inputTokens || 0), 0);
            const totalOutputTokens = logs.reduce((sum, l) => sum + (l.outputTokens || 0), 0);
            const totalTokens = logs.reduce((sum, l) => sum + (l.totalTokens || 0), 0);
            const avgLatency = totalCalls > 0
                ? Math.round(logs.reduce((sum, l) => sum + (l.latency || 0), 0) / totalCalls)
                : 0;
            const lastUsed = logs.length > 0
                ? Math.max(...logs.map(l => l.timestamp || 0))
                : null;

            return {
                totalCalls,
                successfulCalls,
                failedCalls,
                totalInputTokens,
                totalOutputTokens,
                totalTokens,
                avgLatency,
                lastUsed,
            };
        },
    };
}

// ============================================
// API Group SDK
// ============================================

function createApiGroupSdk(db) {
    const STORE = 'apiGroups';

    return {
        /** 列出所有 API 组 */
        list() {
            const raw = db.getAll(STORE) || [];
            return raw.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        },

        /** 获取单个 API 组 */
        get(id) {
            return db.get(STORE, id) || null;
        },

        /** 保存/更新 API 组 */
        put(group) {
            if (!group.id) group.id = uid('grp');
            group.updatedAt = now();
            if (group.sortOrder == null) group.sortOrder = now();
            db.put(STORE, group);
            return group;
        },

        /** 删除 API 组 */
        remove(id) {
            db.remove(STORE, id);
        },

        /**
         * 从组内获取下一个可用的 API Key
         * @param {string} groupId
         * @returns {{ apiKey: object, group: object } | null}
         */
        getNextInGroup(groupId) {
            const group = this.get(groupId);
            if (!group || !Array.isArray(group.apiKeyIds) || group.apiKeyIds.length === 0) {
                return null;
            }

            const strategy = group.strategy || 'round-robin';
            const ids = group.apiKeyIds;

            if (strategy === 'random') {
                // 随机选择
                const randomIdx = Math.floor(Math.random() * ids.length);
                const apiKey = _getApiKeyById(ids[randomIdx]);
                return apiKey && apiKey.enabled !== false ? { apiKey, group } : null;
            }

            if (strategy === 'sequential') {
                const apiKey = _getApiKeyById(ids[0]);
                return apiKey && apiKey.enabled !== false ? { apiKey, group } : null;
            }

            // 默认 round-robin：轮询
            const currentIdx = group.currentIndex || 0;
            const len = ids.length;
            let attempts = 0;

            while (attempts < len) {
                const idx = (currentIdx + attempts) % len;
                const apiKey = _getApiKeyById(ids[idx]);
                if (apiKey && apiKey.enabled !== false) {
                    // 更新组的当前索引
                    group.currentIndex = (idx + 1) % len;
                    this.put(group);
                    return { apiKey, group };
                }
                attempts++;
            }

            return null;
        },

        /**
         * 添加 API Key 到组
         */
        addApiKeyToGroup(groupId, apiKeyId) {
            const group = this.get(groupId);
            if (!group) return null;
            if (!Array.isArray(group.apiKeyIds)) group.apiKeyIds = [];
            if (!group.apiKeyIds.includes(apiKeyId)) {
                group.apiKeyIds.push(apiKeyId);
                this.put(group);
            }
            return group;
        },

        /**
         * 从组移除 API Key
         */
        removeApiKeyFromGroup(groupId, apiKeyId) {
            const group = this.get(groupId);
            if (!group || !Array.isArray(group.apiKeyIds)) return null;
            group.apiKeyIds = group.apiKeyIds.filter(id => id !== apiKeyId);
            // 如果移除的是当前轮询到的，调整索引
            if (group.currentIndex >= group.apiKeyIds.length) {
                group.currentIndex = 0;
            }
            this.put(group);
            return group;
        },
    };
}

// ============================================
// API Usage Log SDK
// ============================================

function createApiUsageSdk(db) {
    const STORE = 'apiUsageLogs';
    const MAX_LOGS = 1000; // 最多保留 1000 条日志

    return {
        /** 记录一次 API 调用 */
        log(entry) {
            const logEntry = {
                id: uid('log'),
                timestamp: now(),
                ...entry,
            };
            db.put(STORE, logEntry);

            // 定期清理旧日志
            this._maybeCleanup();
            return logEntry;
        },

        /** 按 API Key ID 查询日志 */
        listByApiKey(apiKeyId, limit = 100) {
            const all = db.getAll(STORE) || [];
            return all
                .filter(l => l.apiKeyId === apiKeyId)
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, limit);
        },

        /** 按 API 组 ID 查询日志 */
        listByGroup(groupId, limit = 100) {
            const all = db.getAll(STORE) || [];
            return all
                .filter(l => l.groupId === groupId)
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, limit);
        },

        /** 获取所有日志（按时间倒序） */
        listAll(limit = 200) {
            const all = db.getAll(STORE) || [];
            return all
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, limit);
        },

        /** 获取某时间范围内的日志 */
        listByTimeRange(startTime, endTime, limit = 500) {
            const all = db.getAll(STORE) || [];
            return all
                .filter(l => {
                    const t = l.timestamp || 0;
                    return t >= startTime && t <= endTime;
                })
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, limit);
        },

        /** 获取汇总统计 */
        getSummary(days = 7) {
            const startTime = now() - days * 24 * 60 * 60 * 1000;
            const logs = this.listByTimeRange(startTime, now(), 10000);

            const totalCalls = logs.length;
            const successfulCalls = logs.filter(l => l.success !== false).length;
            const failedCalls = totalCalls - successfulCalls;
            const totalInputTokens = logs.reduce((sum, l) => sum + (l.inputTokens || 0), 0);
            const totalOutputTokens = logs.reduce((sum, l) => sum + (l.outputTokens || 0), 0);
            const totalTokens = logs.reduce((sum, l) => sum + (l.totalTokens || 0), 0);
            const avgLatency = totalCalls > 0
                ? Math.round(logs.reduce((sum, l) => sum + (l.latency || 0), 0) / totalCalls)
                : 0;

            // 按 API Key 统计
            const byApiKey = {};
            for (const log of logs) {
                const kid = log.apiKeyId || 'unknown';
                if (!byApiKey[kid]) {
                    byApiKey[kid] = { calls: 0, tokens: 0, errors: 0 };
                }
                byApiKey[kid].calls++;
                byApiKey[kid].tokens += log.totalTokens || 0;
                if (log.success === false) byApiKey[kid].errors++;
            }

            return {
                days,
                totalCalls,
                successfulCalls,
                failedCalls,
                totalInputTokens,
                totalOutputTokens,
                totalTokens,
                avgLatency,
                byApiKey,
            };
        },

        /** 清空所有日志 */
        clearAll() {
            const all = db.getAll(STORE) || [];
            for (const item of all) {
                db.remove(STORE, item.id);
            }
        },

        /** 清空指定 API Key 的日志 */
        clearByApiKey(apiKeyId) {
            const all = db.getAll(STORE) || [];
            for (const item of all) {
                if (item.apiKeyId === apiKeyId) {
                    db.remove(STORE, item.id);
                }
            }
        },

        /** 内部：超过上限时清理旧日志 */
        _maybeCleanup() {
            const all = db.getAll(STORE) || [];
            if (all.length <= MAX_LOGS) return;
            const sorted = all.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            const toRemove = sorted.slice(0, all.length - MAX_LOGS);
            for (const item of toRemove) {
                db.remove(STORE, item.id);
            }
        },
    };
}

// ============================================
// API 调用执行器
// ============================================

/**
 * 执行 API 请求（自动处理轮询、认证、记录日志）
 */
export async function executeApiRequest({
    apiKeyId,
    groupId,
    endpoint,
    method = 'POST',
    body,
    headers = {},
    timeout = 60000,
}) {
    const startTime = performance.now();

    try {
        // 获取 API Key 配置
        let apiKeyConfig = null;
        let usedGroup = null;

        if (groupId) {
            // ★ v0.62.6:优先用 window.__apiSdk(来自 api-manager-section.js,有内存缓存),
            //   否则用 _apiGroupSdk(可能未初始化)
            const apiGroup = window.__apiSdk?.apiGroupSdk || _apiGroupSdk;
            const result = apiGroup?.getNextInGroup?.(groupId);
            if (!result) {
                throw new Error(`API 组 ${groupId} 没有可用的 API Key`);
            }
            apiKeyConfig = result.apiKey;
            usedGroup = result.group;
        } else if (apiKeyId) {
            // ★ 同上:优先用 window.__apiSdk,fallback 到 _apiKeySdk
            const apiKey = window.__apiSdk?.apiKeySdk || _apiKeySdk;
            apiKeyConfig = apiKey?.get?.(apiKeyId);
        }

        if (!apiKeyConfig) {
            throw new Error('未找到 API Key 配置');
        }

        // 构建请求
        const {
            baseUrl = 'https://api.openai.com/v1',
            apiKey,
            provider = 'openai-compatible',
            model,
        } = apiKeyConfig;

        // 处理 baseUrl
        let url = baseUrl.replace(/\/$/, '') + '/' + endpoint.replace(/^\//, '');

        // 构建请求头
        const requestHeaders = {
            'Content-Type': 'application/json',
            ...headers,
        };

        // 根据 Provider 添加认证头
        // ★ v0.62.7 修复:用 PROVIDER_PRESETS[provider].authType 动态判断,
        //   覆盖所有 OpenAI 兼容 provider(deepseek / siliconflow / moonshot / zhipu / ollama / custom)。
        //   历史 bug:之前只硬编码 5 个 provider name,导致 deepseek 等
        //   provider='deepseek' 的 key 不带 Authorization → deepseek API 返回 401。
        const preset = PROVIDER_PRESETS[provider] || null;
        const authType = preset?.authType || (provider === 'azure' ? 'api-key' : 'bearer');

        if (authType === 'bearer') {
            // OpenAI / openai-compatible / deepseek / siliconflow / moonshot / zhipu / ollama / custom
            requestHeaders['Authorization'] = `Bearer ${apiKey}`;
        } else if (authType === 'api-key' && provider === 'anthropic') {
            requestHeaders['x-api-key'] = apiKey;
            requestHeaders['anthropic-version'] = '2023-06-01';
        } else if (authType === 'api-key' && provider === 'gemini') {
            requestHeaders['x-goog-api-key'] = apiKey;
        } else if (authType === 'api-key' && provider === 'azure') {
            // Azure 使用 API Key 在 URL 或 header 中
            requestHeaders['api-key'] = apiKey;
        } else if (authType === 'api-key') {
            // 兜底:未知 api-key 类型 provider 也给个通用头(避免像 deepseek 这种漏网)
            requestHeaders['api-key'] = apiKey;
        }

        // 如果有自定义认证头(优先级最高,用户手填覆盖默认)
        if (apiKeyConfig.authHeader) {
            requestHeaders[apiKeyConfig.authHeader] = apiKey;
        }

        // 添加模型到 body（如果 body 是对象）
        let requestBody = body;
        if (typeof body === 'object' && model && provider !== 'anthropic') {
            requestBody = { ...body, model };
        }

        // 执行请求
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
            method,
            headers: requestHeaders,
            body: requestBody ? JSON.stringify(requestBody) : undefined,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const latency = Math.round(performance.now() - startTime);
        let result = null;
        let error = null;
        let inputTokens = 0;
        let outputTokens = 0;
        let totalTokens = 0;

        // 解析响应
        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');

        if (response.ok) {
            if (isJson) {
                result = await response.json();

                // 尝试从响应中提取 token 使用量
                if (result.usage) {
                    inputTokens = result.usage.prompt_tokens || 0;
                    outputTokens = result.usage.completion_tokens || 0;
                    totalTokens = result.usage.total_tokens || 0;
                } else if (result.usage && typeof result.usage === 'object') {
                    inputTokens = result.usage.input_tokens || result.usage.prompt_tokens || 0;
                    outputTokens = result.usage.output_tokens || result.usage.completion_tokens || 0;
                    totalTokens = result.usage.total_tokens || inputTokens + outputTokens;
                }
            } else {
                result = await response.text();
            }
        } else {
            if (isJson) {
                const errorData = await response.json();
                error = errorData.error?.message || JSON.stringify(errorData);
            } else {
                error = await response.text();
            }
        }

        // 记录到日志
        _apiUsageSdk?.log({
            apiKeyId: apiKeyConfig.id,
            groupId: usedGroup?.id || groupId,
            endpoint,
            method,
            model: model || apiKeyConfig.model,
            inputTokens,
            outputTokens,
            totalTokens,
            latency,
            success: response.ok,
            error: error || null,
            statusCode: response.status,
        });

        if (!response.ok) {
            throw new Error(error || `HTTP ${response.status}`);
        }

        return {
            success: true,
            data: result,
            usage: { inputTokens, outputTokens, totalTokens },
            latency,
            apiKeyId: apiKeyConfig.id,
            groupId: usedGroup?.id,
        };

    } catch (err) {
        const latency = Math.round(performance.now() - startTime);

        // 记录失败日志
        _apiUsageSdk?.log({
            apiKeyId: apiKeyId || 'unknown',
            groupId,
            endpoint,
            method,
            model: null,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            latency,
            success: false,
            error: err.message || String(err),
            statusCode: 0,
        });

        return {
            success: false,
            error: err.message || String(err),
            latency,
            apiKeyId,
            groupId,
        };
    }
}

// ============================================
// 默认 API 配置模板
// ============================================

export const PROVIDER_PRESETS = {
    'openai-compatible': {
        label: 'OpenAI 兼容',
        baseUrl: 'https://api.openai.com/v1',
        authHeader: 'Authorization',
        authType: 'bearer',
        modelPlaceholder: 'gpt-4o-mini',
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCall: true,
    },
    'openai': {
        label: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        authHeader: 'Authorization',
        authType: 'bearer',
        modelPlaceholder: 'gpt-4o',
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCall: true,
    },
    'anthropic': {
        label: 'Anthropic (Claude)',
        baseUrl: 'https://api.anthropic.com/v1',
        authHeader: 'x-api-key',
        authType: 'api-key',
        modelPlaceholder: 'claude-sonnet-4-20250514',
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCall: false,
    },
    'gemini': {
        label: 'Google Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        authHeader: 'x-goog-api-key',
        authType: 'api-key',
        modelPlaceholder: 'gemini-2.0-flash',
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCall: false,
    },
    'deepseek': {
        label: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        authHeader: 'Authorization',
        authType: 'bearer',
        modelPlaceholder: 'deepseek-chat',
        supportsStreaming: true,
        supportsVision: false,
        supportsFunctionCall: true,
    },
    'siliconflow': {
        label: '硅基流动',
        baseUrl: 'https://api.siliconflow.cn/v1',
        authHeader: 'Authorization',
        authType: 'bearer',
        modelPlaceholder: 'Qwen/Qwen2.5-7B-Instruct',
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCall: true,
    },
    'moonshot': {
        label: 'Moonshot（月之暗面）',
        baseUrl: 'https://api.moonshot.cn/v1',
        authHeader: 'Authorization',
        authType: 'bearer',
        modelPlaceholder: 'moonshot-v1-8k',
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCall: true,
    },
    'zhipu': {
        label: '智谱 GLM',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        authHeader: 'Authorization',
        authType: 'bearer',
        modelPlaceholder: 'glm-4',
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCall: true,
    },
    'ollama': {
        label: 'Ollama（本地）',
        baseUrl: 'http://localhost:11434/api',
        authHeader: 'Authorization',
        authType: 'bearer',
        modelPlaceholder: 'llama3',
        supportsStreaming: true,
        supportsVision: false,
        supportsFunctionCall: false,
        isLocal: true,
    },
    'azure': {
        label: 'Azure OpenAI',
        baseUrl: 'https://YOUR_RESOURCE.openai.azure.com',
        authHeader: 'api-key',
        authType: 'api-key',
        modelPlaceholder: 'gpt-4o',
        supportsStreaming: true,
        supportsVision: true,
        supportsFunctionCall: true,
    },
    'custom': {
        label: '自定义',
        baseUrl: '',
        authHeader: '',
        authType: 'bearer',
        modelPlaceholder: '',
        supportsStreaming: false,
        supportsVision: false,
        supportsFunctionCall: false,
    },
};

// ============================================
// API 调用参数模板
// ============================================

export const DEFAULT_API_PARAMS = {
    temperature: { default: 0.7, min: 0, max: 2, step: 0.1, label: 'Temperature' },
    top_p: { default: 1.0, min: 0, max: 1, step: 0.05, label: 'Top P' },
    max_tokens: { default: 4096, min: 1, max: 128000, step: 1, label: '最大输出 Tokens' },
    presence_penalty: { default: 0, min: -2, max: 2, step: 0.1, label: '存在惩罚' },
    frequency_penalty: { default: 0, min: -2, max: 2, step: 0.1, label: '频率惩罚' },
    stop: { default: '', type: 'text', label: '停止序列' },
    seed: { default: null, type: 'integer', label: '随机种子' },
    response_format: { default: 'text', options: ['text', 'json_object'], label: '响应格式' },
    thinking: { default: false, type: 'boolean', label: '深度思考（Claude）' },
    max_completion_tokens: { default: 4096, min: 1, max: 128000, step: 1, label: '最大完成 Tokens' },
};
