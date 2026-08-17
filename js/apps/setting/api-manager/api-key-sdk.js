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
    return (typeof window !== 'undefined' ? window.__apiSdk?.apiKeySdk : null) || _apiKeySdk;
}

/**
 * 获取 API Group SDK
 */
export function getApiGroupSdk() {
    return (typeof window !== 'undefined' ? window.__apiSdk?.apiGroupSdk : null) || _apiGroupSdk;
}

/**
 * 获取 API Usage Log SDK
 */
export function getApiUsageSdk() {
    return (typeof window !== 'undefined' ? window.__apiSdk?.apiUsageSdk : null) || _apiUsageSdk;
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
 * 调用统计必须写进 API 管理页实际使用的共享 SDK。
 * 历史实现只写 `_apiUsageSdk`，但 bootstrapApiSdk 从未被调用，因此所有业务 App
 * 虽然请求成功，统计页仍然一直是 0。
 */
function logApiUsage(entry) {
    const usageSdk = getApiUsageSdk();
    if (!usageSdk?.log) return null;
    try {
        return usageSdk.log(entry);
    } catch (err) {
        console.warn('[api-key-sdk] 写入调用统计失败', err);
        return null;
    }
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
 * 解析出这次请求要用哪个 API Key 配置。
 *
 * 抽出来是为了让 `executeApiRequest`(一次性)和 `executeApiStream`(流式)共用同一份
 * 「轮询 / 取 key」逻辑 —— 两份实现必然分叉,这是本项目反复踩过的坑。
 *
 * @returns {{ apiKeyConfig: object, usedGroup: object|null }}
 * @throws  找不到可用 key 时抛错
 */
function resolveApiKeyConfig({ apiKeyId, groupId }) {
    let apiKeyConfig = null;
    let usedGroup = null;

    if (groupId) {
        // ★ v0.62.6:优先用 window.__apiSdk(来自 api-manager-section.js,有内存缓存),
        //   否则用 _apiGroupSdk(可能未初始化)
        const apiGroup = (typeof window !== 'undefined' ? window.__apiSdk?.apiGroupSdk : null) || _apiGroupSdk;
        const result = apiGroup?.getNextInGroup?.(groupId);
        if (!result) {
            throw new Error(`API 组 ${groupId} 没有可用的 API Key`);
        }
        apiKeyConfig = result.apiKey;
        usedGroup = result.group;
    } else if (apiKeyId) {
        // ★ 同上:优先用 window.__apiSdk,fallback 到 _apiKeySdk
        const apiKey = (typeof window !== 'undefined' ? window.__apiSdk?.apiKeySdk : null) || _apiKeySdk;
        apiKeyConfig = apiKey?.get?.(apiKeyId);
    }

    if (!apiKeyConfig) {
        throw new Error('未找到 API Key 配置');
    }
    return { apiKeyConfig, usedGroup };
}

/**
 * 按 provider 拼出 url / headers / body。同样是给一次性和流式两条路径共用。
 */
function buildApiRequest(apiKeyConfig, { endpoint, headers = {}, body }) {
    const {
        baseUrl = 'https://api.openai.com/v1',
        apiKey,
        provider = 'openai-compatible',
        model,
    } = apiKeyConfig;

    const requestBaseUrl = apiKeyConfig.proxyUrl || baseUrl;
    const url = requestBaseUrl.replace(/\/$/, '') + '/' + String(endpoint || '').replace(/^\//, '');

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
    if (typeof body === 'object' && body && model && provider !== 'anthropic') {
        requestBody = { ...body, model };
    }

    return { url, requestHeaders, requestBody, provider, model };
}

/** provider 是否宣称支持流式 */
export function providerSupportsStreaming(provider) {
    const preset = PROVIDER_PRESETS[provider || 'openai-compatible'];
    return preset ? preset.supportsStreaming !== false : true;
}

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
    signal,
    source = '',
    note = '',
}) {
    const startTime = performance.now();
    let apiKeyConfigRef = null;
    let usedGroupRef = null;
    let modelRef = null;
    let statusCodeRef = 0;
    let usageLogged = false;

    try {
        const { apiKeyConfig, usedGroup } = resolveApiKeyConfig({ apiKeyId, groupId });
        apiKeyConfigRef = apiKeyConfig;
        usedGroupRef = usedGroup;
        const { url, requestHeaders, requestBody, model } = buildApiRequest(apiKeyConfig, {
            endpoint,
            headers,
            body,
        });
        modelRef = model || apiKeyConfig.model || null;

        // 执行请求
        const controller = new AbortController();
        const onExternalAbort = () => controller.abort(signal?.reason);
        if (signal) {
            if (signal.aborted) onExternalAbort();
            else signal.addEventListener('abort', onExternalAbort, { once: true });
        }
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        let response;
        try {
            response = await fetch(url, {
                method,
                headers: requestHeaders,
                body: requestBody ? JSON.stringify(requestBody) : undefined,
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeoutId);
            signal?.removeEventListener?.('abort', onExternalAbort);
        }
        statusCodeRef = response.status;

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
                const usage = result?.usage || result?.usage_metadata;
                if (usage && typeof usage === 'object') {
                    inputTokens = usage.input_tokens
                        || usage.prompt_tokens
                        || usage.promptTokenCount
                        || 0;
                    outputTokens = usage.output_tokens
                        || usage.completion_tokens
                        || usage.candidatesTokenCount
                        || 0;
                    totalTokens = usage.total_tokens
                        || usage.totalTokenCount
                        || inputTokens + outputTokens;
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
        logApiUsage({
            apiKeyId: apiKeyConfig.id,
            groupId: usedGroup?.id || groupId,
            endpoint,
            method,
            model: modelRef,
            inputTokens,
            outputTokens,
            totalTokens,
            latency,
            success: response.ok,
            error: error || null,
            statusCode: response.status,
            source,
            note,
        });
        usageLogged = true;

        if (!response.ok) {
            const httpError = new Error(error || `HTTP ${response.status}`);
            httpError.statusCode = response.status;
            throw httpError;
        }

        return {
            success: true,
            data: result,
            usage: { inputTokens, outputTokens, totalTokens },
            latency,
            apiKeyId: apiKeyConfig.id,
            groupId: usedGroup?.id || groupId,
            statusCode: response.status,
        };

    } catch (err) {
        const latency = Math.round(performance.now() - startTime);

        // HTTP 非 2xx 已在上面带真实状态码记录过，不能在 catch 再记一条 0，
        // 否则统计页会把一次失败显示成两次。
        if (!usageLogged) {
            logApiUsage({
                apiKeyId: apiKeyConfigRef?.id || apiKeyId || 'unknown',
                groupId: usedGroupRef?.id || groupId,
                endpoint,
                method,
                model: modelRef,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                latency,
                success: false,
                error: err.message || String(err),
                statusCode: statusCodeRef || Number(err?.statusCode) || 0,
                source,
                note,
            });
        }

        return {
            success: false,
            error: err.message || String(err),
            latency,
            apiKeyId: apiKeyConfigRef?.id || apiKeyId,
            groupId: usedGroupRef?.id || groupId,
            statusCode: statusCodeRef || Number(err?.statusCode) || 0,
        };
    }
}

// ============================================
// 流式调用（SSE）
// ============================================

/**
 * 从一行 SSE payload 里抠出增量文本。
 *
 * 各家的 delta 位置不一样,这里按「见过的形状」逐个试,而不是按 provider 名分支 ——
 * 同一个 provider 走不同网关时形状也可能变(很多中转把 anthropic 包成 openai 格式)。
 */
function extractStreamDelta(payload) {
    if (!payload || typeof payload !== 'object') return '';

    // OpenAI / 绝大多数兼容网关
    const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
    if (choice) {
        if (typeof choice.delta?.content === 'string') return choice.delta.content;
        if (typeof choice.delta?.reasoning_content === 'string') return '';   // 思维链不进正文
        if (typeof choice.text === 'string') return choice.text;
        if (typeof choice.message?.content === 'string') return choice.message.content;
    }

    // Anthropic messages 流
    if (payload.type === 'content_block_delta' && typeof payload.delta?.text === 'string') {
        return payload.delta.text;
    }

    // Gemini streamGenerateContent
    const geminiPart = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof geminiPart === 'string') return geminiPart;

    return '';
}

/**
 * 流式执行 API 请求（Server-Sent Events）。
 *
 * ★ 为什么需要它
 *   `executeApiRequest` 是一次性的:请求发出去,几十秒后一次性拿到全文。
 *   长文创作类 App（梦境编织）必须边生成边显示,否则用户面对一个转圈要等一分钟,
 *   而且中途没法叫停。
 *
 * ★ 超时用的是「空闲超时」,不是「总时长超时」
 *   这是流式和一次性请求最关键的差别。一次生成三千字的请求跑两分钟是完全正常的,
 *   给它设 60 秒总超时等于把正常请求掐死。真正该判定为「挂了」的是
 *   **连续 idleTimeout 毫秒没有收到任何新数据**。每收到一个 chunk 就重置这个计时器。
 *
 * ★ 中断
 *   传 `signal`(AbortSignal) 即可外部叫停。叫停时 **已经生成的部分照样通过 `text` 返回**,
 *   `aborted: true` —— 用户点「停止」之后不应该丢掉已经写出来的内容。
 *
 * @param {object}        opts
 * @param {string}        [opts.apiKeyId]
 * @param {string}        [opts.groupId]
 * @param {string}        [opts.endpoint='chat/completions']
 * @param {object}        opts.body            请求体(会自动加 stream:true 和 model)
 * @param {object}        [opts.headers]
 * @param {number}        [opts.idleTimeout=90000]  连续多久没数据判定为超时
 * @param {AbortSignal}   [opts.signal]        外部中断信号
 * @param {(delta:string, full:string) => void} [opts.onChunk] 每个增量回调
 * @returns {Promise<{success:boolean, text:string, aborted:boolean, error?:string, latency:number, usage:object}>}
 */
export async function executeApiStream({
    apiKeyId,
    groupId,
    endpoint = 'chat/completions',
    body,
    headers = {},
    idleTimeout = 90000,
    signal,
    onChunk,
    source = '',
    note = '',
} = {}) {
    const startTime = performance.now();
    let full = '';
    let aborted = false;
    let apiKeyConfigRef = null;
    let usedGroupRef = null;
    let modelRef = null;
    let statusCodeRef = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;

    // 内部 controller:既响应外部 signal,也响应空闲超时
    const controller = new AbortController();
    let idleTimer = null;
    const resetIdle = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            idleTimer = null;
            controller.abort(new Error('idle-timeout'));
        }, idleTimeout);
    };
    const onExternalAbort = () => {
        aborted = true;
        controller.abort(new Error('user-abort'));
    };
    if (signal) {
        if (signal.aborted) onExternalAbort();
        else signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
        const { apiKeyConfig, usedGroup } = resolveApiKeyConfig({ apiKeyId, groupId });
        apiKeyConfigRef = apiKeyConfig;
        usedGroupRef = usedGroup;

        const { url, requestHeaders, requestBody, provider, model } = buildApiRequest(apiKeyConfig, {
            endpoint,
            headers: { Accept: 'text/event-stream', ...headers },
            body: { ...(body || {}), stream: true },
        });
        modelRef = model;

        if (!providerSupportsStreaming(provider)) {
            throw new Error(`Provider ${provider} 不支持流式输出`);
        }

        resetIdle();
        const response = await fetch(url, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });
        statusCodeRef = response.status;

        if (!response.ok) {
            const raw = await response.text().catch(() => '');
            let message = raw;
            try {
                message = JSON.parse(raw)?.error?.message || raw;
            } catch (_) { /* 非 JSON 错误体,原样用 */ }
            const httpError = new Error(message || `HTTP ${response.status}`);
            httpError.statusCode = response.status;
            throw httpError;
        }
        if (!response.body) {
            throw new Error('响应没有可读流,当前环境或网关不支持流式');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let done = false;

        while (!done) {
            const { value, done: streamDone } = await reader.read();
            if (streamDone) break;
            resetIdle();

            buffer += decoder.decode(value, { stream: true });

            // SSE 事件之间用空行分隔;但很多网关只发 `data: ...\n`,
            // 所以这里按行处理,遇到 `data:` 就当一条。
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';        // 最后一段可能被截断,留到下一轮

            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line || line.startsWith(':')) continue;      // 心跳注释
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (data === '[DONE]') { done = true; break; }
                let payload;
                try {
                    payload = JSON.parse(data);
                } catch (_) {
                    continue;   // 半截 JSON,下一轮 buffer 会补齐
                }
                const usage = payload?.usage || payload?.usage_metadata || payload?.message?.usage;
                if (usage && typeof usage === 'object') {
                    inputTokens = usage.input_tokens
                        || usage.prompt_tokens
                        || usage.promptTokenCount
                        || inputTokens;
                    outputTokens = usage.output_tokens
                        || usage.completion_tokens
                        || usage.candidatesTokenCount
                        || outputTokens;
                    totalTokens = usage.total_tokens
                        || usage.totalTokenCount
                        || inputTokens + outputTokens;
                }
                const delta = extractStreamDelta(payload);
                if (!delta) continue;
                full += delta;
                try {
                    onChunk?.(delta, full);
                } catch (err) {
                    console.warn('[api-key-sdk] onChunk 回调抛错,已忽略', err);
                }
            }
        }

        if (idleTimer) clearTimeout(idleTimer);
        const latency = Math.round(performance.now() - startTime);

        logApiUsage({
            apiKeyId: apiKeyConfig.id,
            groupId: usedGroup?.id || groupId,
            endpoint,
            method: 'POST',
            model: model || apiKeyConfig.model,
            inputTokens,
            outputTokens,
            totalTokens,
            latency,
            success: true,
            error: null,
            statusCode: statusCodeRef || 200,
            source,
            note,
        });

        return {
            success: true,
            text: full,
            aborted: false,
            latency,
            usage: { inputTokens, outputTokens, totalTokens },
            apiKeyId: apiKeyConfig.id,
            groupId: usedGroup?.id || groupId,
            statusCode: statusCodeRef || 200,
        };
    } catch (err) {
        if (idleTimer) clearTimeout(idleTimer);
        const latency = Math.round(performance.now() - startTime);
        const isAbort = aborted || err?.name === 'AbortError' || /user-abort/.test(err?.message || '');
        const isIdle = /idle-timeout/.test(err?.message || String(err));

        // 用户主动停止不算失败,不写失败日志(否则日志里全是「失败」很难看)
        if (!isAbort) {
            logApiUsage({
                apiKeyId: apiKeyConfigRef?.id || apiKeyId || 'unknown',
                groupId: usedGroupRef?.id || groupId,
                endpoint,
                method: 'POST',
                model: modelRef || null,
                inputTokens,
                outputTokens,
                totalTokens,
                latency,
                success: false,
                error: err?.message || String(err),
                statusCode: statusCodeRef || Number(err?.statusCode) || 0,
                source,
                note,
            });
        }

        return {
            // ★ 中断时已经产出的文本要还给调用方 —— 用户点「停止」不该丢掉已经写出来的内容
            success: isAbort,
            aborted: isAbort,
            text: full,
            latency,
            usage: { inputTokens, outputTokens, totalTokens },
            error: isAbort ? '' : (isIdle ? `连续 ${Math.round(idleTimeout / 1000)} 秒没有收到数据,已断开` : (err?.message || String(err))),
            apiKeyId: apiKeyConfigRef?.id || apiKeyId,
            groupId: usedGroupRef?.id || groupId,
            statusCode: statusCodeRef || Number(err?.statusCode) || 0,
        };
    } finally {
        if (signal) signal.removeEventListener?.('abort', onExternalAbort);
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
