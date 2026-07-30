/**
 * 设置 App · API 管理模块 · 渲染层
 *
 * 提供高自由度的 API Key + API 组管理界面：
 * - API Key 列表 / 创建 / 编辑 / 删除
 * - API 组管理（轮询、顺序、随机策略）
 * - 调用统计展示
 * - 反代配置
 *
 * 页面结构：
 * - 顶部概览卡片（使用统计）
 * - Tab 导航：API 密钥 | API 组 | 统计
 * - API 密钥 Tab：列表 + 创建/编辑面板
 * - API 组 Tab：组列表 + 组内 Key 管理
 * - 统计 Tab：调用记录、Token 消耗
 *
 * 实现说明：
 *   IndexedDB 操作是异步的，但 renderPage 是同步的。
 *   解决方案：维护内存缓存 + 在后台异步同步。
 *   - list/get/listEnabled：返回缓存（立即可用）
 *   - put/remove：先更新缓存（同步），再写 IndexedDB（异步）
 *   - 首次进入时从 IndexedDB 加载到缓存
 */

import { escapeHtml } from '@/src/core/escape.js';
import { PROVIDER_PRESETS } from './api-key-sdk.js';

// ============================================
// 工具函数
// ============================================

function wvAction(method, payload = {}) {
    const obj = { action: 'appMethod', appId: 'settings', method, payload };
    return `data-app-action='${escapeHtml(JSON.stringify(obj))}'`;
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return '—';
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} 天前`;
    if (hours > 0) return `${hours} 小时前`;
    if (minutes > 0) return `${minutes} 分钟前`;
    return '刚刚';
}

function formatTokens(tokens) {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return String(tokens);
}

function getProviderLabel(provider) {
    return PROVIDER_PRESETS[provider]?.label || provider || '未知';
}

// ============================================
// 内存缓存 SDK（同步接口，底层异步写 IndexedDB）
// ============================================

const STORE_KEYS = 'apiKeys';
const STORE_GROUPS = 'apiGroups';
const STORE_LOGS = 'apiUsageLogs';

// 内存缓存
let _cacheKeys = [];
let _cacheGroups = [];
let _cacheLogs = [];
let _cacheLoaded = false;
let _loadingPromise = null;

function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadCacheAsync(db) {
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = (async () => {
        try {
            // 等 IndexedDB open() 完成再读，否则会抛「数据库未初始化」
            if (db.ready && typeof db.ready.then === 'function') {
                await db.ready.catch(err => {
                    console.error('[api-mgr] db.open 失败', err);
                });
            }
            const keys = (await db.getAll(STORE_KEYS)) || [];
            const groups = (await db.getAll(STORE_GROUPS)) || [];
            const logs = (await db.getAll(STORE_LOGS)) || [];
            _cacheKeys = keys.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            _cacheGroups = groups.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            _cacheLogs = logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            _cacheLoaded = true;
            console.log('[api-mgr] 缓存加载完成', { keys: _cacheKeys.length, groups: _cacheGroups.length, logs: _cacheLogs.length });
            // 数据加载完后异步触发刷新，让 UI 从「加载中」过渡到真正的内容
            if (typeof window !== 'undefined') {
                Promise.resolve().then(() => {
                    try { window.refreshPhoneApps?.(); } catch (_) {}
                });
            }
        } catch (err) {
            console.error('[api-mgr] 加载缓存失败，清空 promise 以便重试', err);
            // 清空 loadingPromise 让下次能重新尝试
            _loadingPromise = null;
            // 失败时也要刷一下 UI（让用户至少看到加载完成的占位）
            if (typeof window !== 'undefined') {
                Promise.resolve().then(() => {
                    try { window.refreshPhoneApps?.(); } catch (_) {}
                });
            }
        }
    })();
    return _loadingPromise;
}

/** 给外部 await "首次缓存加载完成",不暴露内部 _loadingPromise */
export async function waitApiSdkReady() {
    if (typeof window === 'undefined') return;
    const db = window.myDb;
    if (!db) return;
    return loadCacheAsync(db);
}

// 异步持久化：等待 db.ready 后再写入，避免「数据库未初始化」导致数据丢失
function _persist(db, fn) {
    if (!db) return;
    if (db.ready && typeof db.ready.then === 'function') {
        db.ready.then(() => {
            fn().catch(err => console.error('[api-mgr] 持久化失败', err));
        }).catch(err => console.error('[api-mgr] db.ready 失败', err));
    } else {
        fn().catch(err => console.error('[api-mgr] 持久化失败', err));
    }
}

// 同步 SDK：先从缓存返回，读写先更新缓存，再异步持久化
export function getApiSdk() {
    if (window.__apiSdk) return window.__apiSdk;

    const db = window.myDb;
    if (!db) return null;
    // 触发加载
    loadCacheAsync(db);

    const apiKeySdk = {
        list() {
            return _cacheKeys.slice();
        },
        get(id) {
            return _cacheKeys.find(k => k.id === id) || null;
        },
        put(key) {
            if (!key.id) key.id = uid('key');
            key.updatedAt = Date.now();
            if (key.sortOrder == null) key.sortOrder = Date.now();
            // 深拷贝：只保留可序列化的原始字段，防止 DataCloneError
            const clean = JSON.parse(JSON.stringify(key));
            // 更新缓存
            const idx = _cacheKeys.findIndex(k => k.id === clean.id);
            if (idx >= 0) _cacheKeys[idx] = clean;
            else _cacheKeys.push(clean);
            _cacheKeys.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            // 异步持久化（先等 db.ready）
            _persist(db, () => db.put(STORE_KEYS, clean));
            return clean;
        },
        remove(id) {
            _cacheKeys = _cacheKeys.filter(k => k.id !== id);
            _persist(db, () => db.remove(STORE_KEYS, id));
        },
        listEnabled() {
            return _cacheKeys.filter(k => k.enabled !== false);
        },
        getStats(id) {
            const logs = _cacheLogs.filter(l => l.apiKeyId === id);
            const totalCalls = logs.length;
            const successfulCalls = logs.filter(l => l.success !== false).length;
            const failedCalls = totalCalls - successfulCalls;
            const totalInputTokens = logs.reduce((sum, l) => sum + (l.inputTokens || 0), 0);
            const totalOutputTokens = logs.reduce((sum, l) => sum + (l.outputTokens || 0), 0);
            const totalTokens = logs.reduce((sum, l) => sum + (l.totalTokens || 0), 0);
            const avgLatency = totalCalls > 0
                ? Math.round(logs.reduce((sum, l) => sum + (l.latency || 0), 0) / totalCalls)
                : 0;
            return { totalCalls, successfulCalls, failedCalls, totalInputTokens, totalOutputTokens, totalTokens, avgLatency };
        },
    };

    const apiGroupSdk = {
        list() {
            return _cacheGroups.slice();
        },
        get(id) {
            return _cacheGroups.find(g => g.id === id) || null;
        },
        put(group) {
            if (!group.id) group.id = uid('grp');
            group.updatedAt = Date.now();
            if (group.sortOrder == null) group.sortOrder = Date.now();
            const clean = JSON.parse(JSON.stringify(group));
            const idx = _cacheGroups.findIndex(g => g.id === clean.id);
            if (idx >= 0) _cacheGroups[idx] = clean;
            else _cacheGroups.push(clean);
            _cacheGroups.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            _persist(db, () => db.put(STORE_GROUPS, clean));
            return clean;
        },
        remove(id) {
            _cacheGroups = _cacheGroups.filter(g => g.id !== id);
            _persist(db, () => db.remove(STORE_GROUPS, id));
        },
    };

    const apiUsageSdk = {
        log(entry) {
            const logEntry = {
                id: uid('log'),
                timestamp: Date.now(),
                ...entry,
            };
            const clean = JSON.parse(JSON.stringify(logEntry));
            _cacheLogs.unshift(clean);
            // 限制最多 1000 条
            if (_cacheLogs.length > 1000) _cacheLogs = _cacheLogs.slice(0, 1000);
            _persist(db, () => db.put(STORE_LOGS, clean));
            return clean;
        },
        listByApiKey(apiKeyId, limit = 100) {
            return _cacheLogs.filter(l => l.apiKeyId === apiKeyId).slice(0, limit);
        },
        listAll(limit = 200) {
            return _cacheLogs.slice(0, limit);
        },
        getSummary(days = 7) {
            const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
            const logs = _cacheLogs.filter(l => (l.timestamp || 0) >= startTime);
            const totalCalls = logs.length;
            const successfulCalls = logs.filter(l => l.success !== false).length;
            const failedCalls = totalCalls - successfulCalls;
            const totalInputTokens = logs.reduce((sum, l) => sum + (l.inputTokens || 0), 0);
            const totalOutputTokens = logs.reduce((sum, l) => sum + (l.outputTokens || 0), 0);
            const totalTokens = logs.reduce((sum, l) => sum + (l.totalTokens || 0), 0);
            const avgLatency = totalCalls > 0
                ? Math.round(logs.reduce((sum, l) => sum + (l.latency || 0), 0) / totalCalls)
                : 0;
            const byApiKey = {};
            for (const log of logs) {
                const kid = log.apiKeyId || 'unknown';
                if (!byApiKey[kid]) byApiKey[kid] = { calls: 0, tokens: 0, errors: 0 };
                byApiKey[kid].calls++;
                byApiKey[kid].tokens += log.totalTokens || 0;
                if (log.success === false) byApiKey[kid].errors++;
            }
            return { totalCalls, successfulCalls, failedCalls, totalInputTokens, totalOutputTokens, totalTokens, avgLatency, byApiKey };
        },
        clearAll() {
            const ids = _cacheLogs.map(l => l.id);
            _cacheLogs = [];
            ids.forEach(id => _persist(db, () => db.remove(STORE_LOGS, id)));
        },
    };

    window.__apiSdk = { apiKeySdk, apiGroupSdk, apiUsageSdk };
    // 即便外部不调用 api manager section,也先静默加载缓存,避免后续业务调用取不到 key
    loadCacheAsync(db);
    // 暴露加载 promise 供外部业务 await
    window.__apiSdkLoadingPromise = _loadingPromise;
    return window.__apiSdk;
}

// 调试工具：强制从 IndexedDB 重新加载缓存
if (typeof window !== 'undefined') {
    window.__apiForceReload = async function () {
        const db = window.myDb;
        if (!db) return { ok: false, error: 'no db' };
        _loadingPromise = null;
        _cacheLoaded = false;
        await loadCacheAsync(db);
        try { window.refreshPhoneApps?.(); } catch (_) {}
        return { ok: true, keys: _cacheKeys.length, groups: _cacheGroups.length, logs: _cacheLogs.length };
    };

    window.__apiInspectStore = function (storeName) {
        return new Promise((resolve) => {
            const db = window.myDb;
            if (!db) return resolve({ error: 'no db' });
            const ready = db.ready;
            const finish = () => {
                try {
                    const tx = db.db.transaction(storeName, 'readonly');
                    const store = tx.objectStore(storeName);
                    const req = store.getAll();
                    req.onsuccess = () => resolve({
                        store: storeName,
                        count: req.result.length,
                        items: req.result,
                    });
                    req.onerror = (e) => resolve({ error: e.target.error?.message });
                } catch (e) {
                    resolve({ error: e.message });
                }
            };
            if (ready && typeof ready.then === 'function') {
                ready.then(finish).catch(e => resolve({ error: e.message }));
            } else {
                finish();
            }
        });
    };
}

// ============================================
// 概览卡片
// ============================================

function renderOverviewCard(app) {
    const sdk = getApiSdk();
    if (!sdk) {
        return `
            <div class="api-mgr-overview api-mgr-overview--loading">
                <div class="api-mgr-overview__loading">加载中...</div>
            </div>
        `;
    }

    const keys = sdk.apiKeySdk.list();
    const groups = sdk.apiGroupSdk.list();
    const summary = sdk.apiUsageSdk.getSummary(7);
    const enabledCount = keys.filter(k => k.enabled !== false).length;

    return `
        <div class="api-mgr-overview">
            <div class="api-mgr-overview__grid">
                <div class="api-mgr-stat">
                    <div class="api-mgr-stat__value">${keys.length}</div>
                    <div class="api-mgr-stat__label">API 密钥</div>
                </div>
                <div class="api-mgr-stat">
                    <div class="api-mgr-stat__value">${enabledCount}</div>
                    <div class="api-mgr-stat__label">已启用</div>
                </div>
                <div class="api-mgr-stat">
                    <div class="api-mgr-stat__value">${groups.length}</div>
                    <div class="api-mgr-stat__label">API 组</div>
                </div>
                <div class="api-mgr-stat">
                    <div class="api-mgr-stat__value">${summary.totalCalls || 0}</div>
                    <div class="api-mgr-stat__label">本周调用</div>
                </div>
            </div>
            ${summary.totalTokens > 0 ? `
                <div class="api-mgr-overview__tokens">
                    <span class="api-mgr-token-badge">
                        <span class="api-mgr-token-badge__icon">◈</span>
                        <span>本周消耗</span>
                        <span class="api-mgr-token-badge__value">${formatTokens(summary.totalInputTokens)}</span>
                        <span class="api-mgr-token-badge__sep">输入</span>
                        <span class="api-mgr-token-badge__value">${formatTokens(summary.totalOutputTokens)}</span>
                        <span class="api-mgr-token-badge__sep">输出</span>
                    </span>
                </div>
            ` : ''}
        </div>
    `;
}

// ============================================
// Tab 导航
// ============================================

const TABS = [
    { id: 'keys', label: 'API 密钥' },
    { id: 'groups', label: 'API 组' },
    { id: 'stats', label: '统计' },
];

function renderTabs(activeTab) {
    return `
        <div class="api-mgr-tabs">
            ${TABS.map(tab => `
                <button class="api-mgr-tab ${activeTab === tab.id ? 'is-active' : ''}" ${wvAction('apiSetTab', { tab: tab.id })}>
                    ${escapeHtml(tab.label)}
                </button>
            `).join('')}
        </div>
    `;
}

// ============================================
// API 密钥 Tab
// ============================================

function renderKeysTab(app) {
    const sdk = getApiSdk();
    if (!sdk) {
        return `<div class="api-mgr-empty"><div class="api-mgr-empty__text">加载中...</div></div>`;
    }
    const keys = sdk.apiKeySdk.list();
    const editingKey = app.state.apiMgr?.editingKey;

    return `
        <div class="api-mgr-keys">
            <div class="api-mgr-section-head">
                <button class="api-mgr-btn api-mgr-btn--primary" ${wvAction('apiNewKey')}>
                    <span>+</span> 新建 API 密钥
                </button>
            </div>

            ${keys.length === 0 ? `
                <div class="api-mgr-empty">
                    <div class="api-mgr-empty__icon">○</div>
                    <div class="api-mgr-empty__text">还没有 API 密钥</div>
                    <div class="api-mgr-empty__hint">点击上方「新建 API 密钥」添加你的第一个密钥</div>
                </div>
            ` : `
                <div class="api-mgr-key-list">
                    ${keys.map(key => renderKeyCard(key, app)).join('')}
                </div>
            `}

            ${editingKey ? renderKeyEditor(app, editingKey) : ''}
        </div>
    `;
}

function renderKeyCard(key, app) {
    const sdk = getApiSdk();
    const stats = sdk?.apiKeySdk.getStats(key.id) || {};
    const isEnabled = key.enabled !== false;

    return `
        <div class="api-mgr-key-card ${isEnabled ? '' : 'is-disabled'}">
            <div class="api-mgr-key-card__head">
                <div class="api-mgr-key-card__info">
                    <div class="api-mgr-key-card__name">${escapeHtml(key.label || key.id)}</div>
                    <div class="api-mgr-key-card__meta">
                        <span class="api-mgr-key-card__provider">${escapeHtml(getProviderLabel(key.provider))}</span>
                        <span class="api-mgr-key-card__model">${escapeHtml(key.model || '未设置模型')}</span>
                    </div>
                </div>
                <label class="api-mgr-toggle" title="${isEnabled ? '点击禁用' : '点击启用'}">
                    <input type="checkbox" ${isEnabled ? 'checked' : ''} data-api-key-toggle="${escapeHtml(key.id)}" />
                    <span class="api-mgr-toggle__track"><span class="api-mgr-toggle__thumb"></span></span>
                </label>
            </div>

            ${key.baseUrl ? `
                <div class="api-mgr-key-card__url">
                    <span class="api-mgr-key-card__url-label">URL</span>
                    <span class="api-mgr-key-card__url-value">${escapeHtml(key.baseUrl)}</span>
                </div>
            ` : ''}

            <div class="api-mgr-key-card__stats">
                <div class="api-mgr-key-card__stat">
                    <span class="api-mgr-key-card__stat-value">${stats.totalCalls || 0}</span>
                    <span class="api-mgr-key-card__stat-label">调用</span>
                </div>
                <div class="api-mgr-key-card__stat">
                    <span class="api-mgr-key-card__stat-value">${formatTokens(stats.totalTokens || 0)}</span>
                    <span class="api-mgr-key-card__stat-label">Tokens</span>
                </div>
                <div class="api-mgr-key-card__stat">
                    <span class="api-mgr-key-card__stat-value">${stats.successfulCalls || 0}/${stats.totalCalls || 0}</span>
                    <span class="api-mgr-key-card__stat-label">成功</span>
                </div>
            </div>

            <div class="api-mgr-key-card__actions">
                <button class="api-mgr-btn api-mgr-btn--small" ${wvAction('apiEditKey', { id: key.id })}>编辑</button>
                <button class="api-mgr-btn api-mgr-btn--small api-mgr-btn--ghost" ${wvAction('apiTestKey', { id: key.id })}>测试</button>
                <button class="api-mgr-btn api-mgr-btn--small api-mgr-btn--ghost" ${wvAction('apiDuplicateKey', { id: key.id })}>复制</button>
                <button class="api-mgr-btn api-mgr-btn--small api-mgr-btn--danger" ${wvAction('apiDeleteKey', { id: key.id })}>删除</button>
            </div>
        </div>
    `;
}

function renderKeyEditor(app, editingKey) {
    const isNew = !editingKey.id || editingKey.id.startsWith('key_new');
    const title = isNew ? '新建 API 密钥' : '编辑 API 密钥';
    const params = editingKey.params || {};

    return `
        <div class="api-mgr-modal-overlay"
             onclick="(function(e){ if(e.target === e.currentTarget) window.__apiCloseKeyEditor && window.__apiCloseKeyEditor(); })(event)">
            <div class="api-mgr-modal">

                <div class="api-mgr-modal__head">
                    <div class="api-mgr-modal__title">${escapeHtml(title)}</div>
                </div>

                <div class="api-mgr-modal__body">
                    <div class="api-mgr-form">
                        <div class="api-mgr-form__section">
                            <div class="api-mgr-form__section-title">基本信息</div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">显示名称</label>
                                <input type="text" class="api-mgr-form__input"
                                    data-api-field="label"
                                    value="${escapeHtml(editingKey.label || '')}"
                                    placeholder="例如：我的 OpenAI Key" />
                            </div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">Provider</label>
                                <select class="api-mgr-form__select"
                                    data-api-field="provider"
                                    onchange="window.__apiProviderChanged && window.__apiProviderChanged(this.value)">
                                    ${Object.entries(PROVIDER_PRESETS).map(([value, preset]) => `
                                        <option value="${value}" ${editingKey.provider === value ? 'selected' : ''}>
                                            ${escapeHtml(preset.label)}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">Base URL</label>
                                <input type="text" class="api-mgr-form__input"
                                    data-api-field="baseUrl"
                                    value="${escapeHtml(editingKey.baseUrl || '')}"
                                    placeholder="https://api.openai.com/v1" />
                            </div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">API Key</label>
                                <input type="password" class="api-mgr-form__input"
                                    data-api-field="apiKey"
                                    value="${escapeHtml(editingKey.apiKey || '')}"
                                    placeholder="sk-..."
                                    autocomplete="off"
                                    oninput="window.__apiKeyInput && window.__apiKeyInput(this.value)" />
                                <div class="api-mgr-form__hint api-mgr-form__hint--warn">
                                    API Key 会以明文保存在本机 IndexedDB，请勿在公共设备使用
                                </div>
                            </div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">模型</label>
                                <select class="api-mgr-form__select" data-api-field="model">
                                    <option value="">-- 先填写 API Key --</option>
                                </select>
                            </div>
                        </div>

                        <div class="api-mgr-form__section">
                            <div class="api-mgr-form__section-title">调用参数</div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">Temperature</label>
                                <div class="api-mgr-form__range-row">
                                    <input type="range" class="api-mgr-form__range"
                                        data-api-field="temperature"
                                        min="0" max="2" step="0.1"
                                        value="${params.temperature ?? 0.7}" />
                                    <span class="api-mgr-form__range-value">${params.temperature ?? 0.7}</span>
                                </div>
                            </div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">Top P</label>
                                <div class="api-mgr-form__range-row">
                                    <input type="range" class="api-mgr-form__range"
                                        data-api-field="topP"
                                        min="0" max="1" step="0.05"
                                        value="${params.top_p ?? 1}" />
                                    <span class="api-mgr-form__range-value">${params.top_p ?? 1}</span>
                                </div>
                            </div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">最大输出 Tokens</label>
                                <input type="number" class="api-mgr-form__input"
                                    data-api-field="maxTokens"
                                    value="${params.max_tokens ?? 4096}"
                                    min="1" max="128000" />
                            </div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">存在惩罚</label>
                                <div class="api-mgr-form__range-row">
                                    <input type="range" class="api-mgr-form__range"
                                        data-api-field="presencePenalty"
                                        min="-2" max="2" step="0.1"
                                        value="${params.presence_penalty ?? 0}" />
                                    <span class="api-mgr-form__range-value">${params.presence_penalty ?? 0}</span>
                                </div>
                            </div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">频率惩罚</label>
                                <div class="api-mgr-form__range-row">
                                    <input type="range" class="api-mgr-form__range"
                                        data-api-field="frequencyPenalty"
                                        min="-2" max="2" step="0.1"
                                        value="${params.frequency_penalty ?? 0}" />
                                    <span class="api-mgr-form__range-value">${params.frequency_penalty ?? 0}</span>
                                </div>
                            </div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">停止序列</label>
                                <input type="text" class="api-mgr-form__input"
                                    data-api-field="stop"
                                    value="${escapeHtml(params.stop || '')}"
                                    placeholder="用 | 分隔多个序列" />
                            </div>
                        </div>

                        <div class="api-mgr-form__section">
                            <div class="api-mgr-form__section-title">高级设置</div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">自定义认证头</label>
                                <input type="text" class="api-mgr-form__input"
                                    data-api-field="authHeader"
                                    value="${escapeHtml(editingKey.authHeader || '')}"
                                    placeholder="如 Authorization（留空则自动）" />
                            </div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">请求超时（秒）</label>
                                <input type="number" class="api-mgr-form__input"
                                    data-api-field="timeout"
                                    value="${editingKey.timeout ?? 60}"
                                    min="5" max="300" />
                            </div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">备注</label>
                                <textarea class="api-mgr-form__textarea"
                                    data-api-field="notes"
                                    rows="2"
                                    placeholder="可选备注信息">${escapeHtml(editingKey.notes || '')}</textarea>
                            </div>
                        </div>

                        <div class="api-mgr-form__section">
                            <div class="api-mgr-form__section-title">反代设置（可选）</div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">反代 URL</label>
                                <input type="text" class="api-mgr-form__input"
                                    data-api-field="proxyUrl"
                                    value="${escapeHtml(editingKey.proxyUrl || '')}"
                                    placeholder="如 https://your-proxy.com/v1（留空则直连）" />
                                <div class="api-mgr-form__hint">
                                    使用反代可以隐藏真实 API 地址
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="api-mgr-modal__foot">
                    <button class="api-mgr-btn api-mgr-btn--ghost"
                        onclick="window.__apiCloseKeyEditor && window.__apiCloseKeyEditor()">取消</button>
                    <button class="api-mgr-btn api-mgr-btn--primary"
                        onclick="window.__apiSaveKey && window.__apiSaveKey()">保存</button>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// API 组 Tab
// ============================================

function renderGroupsTab(app) {
    const sdk = getApiSdk();
    if (!sdk) {
        return `<div class="api-mgr-empty"><div class="api-mgr-empty__text">加载中...</div></div>`;
    }
    const groups = sdk.apiGroupSdk.list();
    const allKeys = sdk.apiKeySdk.list();
    const editingGroup = app.state.apiMgr?.editingGroup;

    return `
        <div class="api-mgr-groups">
            <div class="api-mgr-section-head">
                <button class="api-mgr-btn api-mgr-btn--primary" ${wvAction('apiNewGroup')}>
                    <span>+</span> 新建 API 组
                </button>
                <div class="api-mgr-section-head__hint">API 组内的密钥会自动轮询使用</div>
            </div>

            ${groups.length === 0 ? `
                <div class="api-mgr-empty">
                    <div class="api-mgr-empty__icon">∾</div>
                    <div class="api-mgr-empty__text">还没有 API 组</div>
                    <div class="api-mgr-empty__hint">创建 API 组可以将多个密钥组合使用，实现负载均衡和轮询</div>
                </div>
            ` : `
                <div class="api-mgr-group-list">
                    ${groups.map(group => renderGroupCard(group, allKeys, app)).join('')}
                </div>
            `}

            ${editingGroup ? renderGroupEditor(app, editingGroup, allKeys) : ''}
        </div>
    `;
}

function renderGroupCard(group, allKeys, app) {
    const groupKeys = (group.apiKeyIds || [])
        .map(id => allKeys.find(k => k.id === id))
        .filter(Boolean);
    const enabledKeys = groupKeys.filter(k => k.enabled !== false);

    const strategyLabels = {
        'round-robin': '轮询',
        'sequential': '顺序',
        'random': '随机',
    };

    const strategyIcons = {
        'round-robin': '⟳',
        'sequential': '→',
        'random': '⚄',
    };

    return `
        <div class="api-mgr-group-card">
            <div class="api-mgr-group-card__head">
                <div class="api-mgr-group-card__info">
                    <div class="api-mgr-group-card__name">${escapeHtml(group.name || group.id)}</div>
                    <div class="api-mgr-group-card__meta">
                        <span class="api-mgr-group-card__strategy">
                            ${strategyIcons[group.strategy] || '⟳'} ${strategyLabels[group.strategy] || '轮询'}
                        </span>
                        <span class="api-mgr-group-card__count">${enabledKeys.length}/${groupKeys.length} 可用</span>
                    </div>
                </div>
            </div>

            ${groupKeys.length > 0 ? `
                <div class="api-mgr-group-card__keys">
                    ${groupKeys.map(key => `
                        <div class="api-mgr-group-card__key ${key.enabled === false ? 'is-disabled' : ''}">
                            <span class="api-mgr-group-card__key-icon">${key.enabled === false ? '○' : '●'}</span>
                            <span class="api-mgr-group-card__key-name">${escapeHtml(key.label || key.id)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class="api-mgr-group-card__empty">组内暂无密钥</div>
            `}

            <div class="api-mgr-group-card__actions">
                <button class="api-mgr-btn api-mgr-btn--small" ${wvAction('apiEditGroup', { id: group.id })}>编辑</button>
                <button class="api-mgr-btn api-mgr-btn--small api-mgr-btn--ghost" ${wvAction('apiTestGroup', { id: group.id })}>测试</button>
                <button class="api-mgr-btn api-mgr-btn--small api-mgr-btn--danger" ${wvAction('apiDeleteGroup', { id: group.id })}>删除</button>
            </div>
        </div>
    `;
}

function renderGroupEditor(app, editingGroup, allKeys) {
    const isNew = !editingGroup.id || editingGroup.id.startsWith('grp_new');
    const title = isNew ? '新建 API 组' : '编辑 API 组';

    const strategyOptions = [
        { value: 'round-robin', label: '轮询（推荐）', desc: '每次请求轮换到下一个密钥，均匀分布负载' },
        { value: 'sequential', label: '顺序', desc: '始终使用第一个可用密钥，用完才换下一个' },
        { value: 'random', label: '随机', desc: '每次随机选择密钥' },
    ];

    const selectedKeyIds = editingGroup.apiKeyIds || [];

    return `
        <div class="api-mgr-modal-overlay"
             onclick="(function(e){ if(e.target === e.currentTarget) window.__apiCloseGroupEditor && window.__apiCloseGroupEditor(); })(event)">
            <div class="api-mgr-modal">

                <div class="api-mgr-modal__head">
                    <div class="api-mgr-modal__title">${escapeHtml(title)}</div>
                </div>

                <div class="api-mgr-modal__body">
                    <div class="api-mgr-form">
                        <div class="api-mgr-form__section">
                            <div class="api-mgr-form__section-title">基本信息</div>

                            <div class="api-mgr-form__field">
                                <label class="api-mgr-form__label">组名称</label>
                                <input type="text" class="api-mgr-form__input"
                                    data-group-field="name"
                                    value="${escapeHtml(editingGroup.name || '')}"
                                    placeholder="例如：主力 API 组" />
                            </div>
                        </div>

                        <div class="api-mgr-form__section">
                            <div class="api-mgr-form__section-title">轮询策略</div>

                            ${strategyOptions.map(opt => `
                                <label class="api-mgr-strategy-option ${editingGroup.strategy === opt.value ? 'is-active' : ''}">
                                    <input type="radio" name="strategy" value="${opt.value}"
                                        ${editingGroup.strategy === opt.value ? 'checked' : ''}
                                        data-group-field="strategy" />
                                    <div class="api-mgr-strategy-option__content">
                                        <div class="api-mgr-strategy-option__title">${escapeHtml(opt.label)}</div>
                                        <div class="api-mgr-strategy-option__desc">${escapeHtml(opt.desc)}</div>
                                    </div>
                                </label>
                            `).join('')}
                        </div>

                        <div class="api-mgr-form__section">
                            <div class="api-mgr-form__section-title">选择密钥（可多选）</div>

                            ${allKeys.length === 0 ? `
                                <div class="api-mgr-form__empty-hint">
                                    还没有 API 密钥，请先创建密钥
                                </div>
                            ` : `
                                <div class="api-mgr-key-selector">
                                    ${allKeys.map(key => `
                                        <label class="api-mgr-key-option ${selectedKeyIds.includes(key.id) ? 'is-selected' : ''}">
                                            <input type="checkbox"
                                                data-group-key-id="${escapeHtml(key.id)}"
                                                ${selectedKeyIds.includes(key.id) ? 'checked' : ''} />
                                            <div class="api-mgr-key-option__content">
                                                <div class="api-mgr-key-option__name">${escapeHtml(key.label || key.id)}</div>
                                                <div class="api-mgr-key-option__meta">
                                                    ${escapeHtml(getProviderLabel(key.provider))}
                                                    ${key.model ? ` · ${escapeHtml(key.model)}` : ''}
                                                </div>
                                            </div>
                                            <span class="api-mgr-key-option__check">&#10003;</span>
                                        </label>
                                    `).join('')}
                                </div>
                            `}
                        </div>
                    </div>
                </div>

                <div class="api-mgr-modal__foot">
                    <button class="api-mgr-btn api-mgr-btn--ghost"
                        onclick="window.__apiCloseGroupEditor && window.__apiCloseGroupEditor()">取消</button>
                    <button class="api-mgr-btn api-mgr-btn--primary"
                        onclick="window.__apiSaveGroup && window.__apiSaveGroup()">保存</button>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// 统计 Tab
// ============================================

function renderStatsTab(app) {
    const sdk = getApiSdk();
    if (!sdk) {
        return `<div class="api-mgr-empty"><div class="api-mgr-empty__text">加载中...</div></div>`;
    }
    const days = app.state.apiMgr?.statsDays || 7;
    const summary = sdk.apiUsageSdk.getSummary(days);
    const logs = sdk.apiUsageSdk.listAll(100);
    const keys = sdk.apiKeySdk.list();

    const dayOptions = [
        { value: 7, label: '7 天' },
        { value: 30, label: '30 天' },
        { value: 90, label: '90 天' },
    ];

    const keyMap = {};
    keys.forEach(k => { keyMap[k.id] = k; });

    return `
        <div class="api-mgr-stats">
            <div class="api-mgr-stats__header">
                <div class="api-mgr-stats__title">调用统计</div>
                <div class="api-mgr-stats__range-selector">
                    ${dayOptions.map(opt => `
                        <button class="api-mgr-range-btn ${days === opt.value ? 'is-active' : ''}"
                            ${wvAction('apiSetStatsDays', { days: opt.value })}>
                            ${escapeHtml(opt.label)}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="api-mgr-stats__overview">
                <div class="api-mgr-stats-card">
                    <div class="api-mgr-stats-card__value">${summary.totalCalls || 0}</div>
                    <div class="api-mgr-stats-card__label">总调用次数</div>
                </div>
                <div class="api-mgr-stats-card">
                    <div class="api-mgr-stats-card__value api-mgr-stats-card__value--success">${summary.successfulCalls || 0}</div>
                    <div class="api-mgr-stats-card__label">成功</div>
                </div>
                <div class="api-mgr-stats-card">
                    <div class="api-mgr-stats-card__value api-mgr-stats-card__value--danger">${summary.failedCalls || 0}</div>
                    <div class="api-mgr-stats-card__label">失败</div>
                </div>
                <div class="api-mgr-stats-card">
                    <div class="api-mgr-stats-card__value">${summary.avgLatency || 0}ms</div>
                    <div class="api-mgr-stats-card__label">平均延迟</div>
                </div>
            </div>

            <div class="api-mgr-stats__tokens">
                <div class="api-mgr-tokens-grid">
                    <div class="api-mgr-tokens-cell">
                        <div class="api-mgr-tokens-cell__value">${formatTokens(summary.totalInputTokens || 0)}</div>
                        <div class="api-mgr-tokens-cell__label">输入 Tokens</div>
                    </div>
                    <div class="api-mgr-tokens-cell">
                        <div class="api-mgr-tokens-cell__value">${formatTokens(summary.totalOutputTokens || 0)}</div>
                        <div class="api-mgr-tokens-cell__label">输出 Tokens</div>
                    </div>
                    <div class="api-mgr-tokens-cell api-mgr-tokens-cell--total">
                        <div class="api-mgr-tokens-cell__value">${formatTokens(summary.totalTokens || 0)}</div>
                        <div class="api-mgr-tokens-cell__label">总 Tokens</div>
                    </div>
                </div>
            </div>

            ${Object.keys(summary.byApiKey || {}).length > 0 ? `
                <div class="api-mgr-stats__by-key">
                    <div class="api-mgr-stats__section-title">各密钥消耗</div>
                    <div class="api-mgr-key-stats">
                        ${Object.entries(summary.byApiKey).map(([keyId, stats]) => {
                            const key = keyMap[keyId];
                            return `
                                <div class="api-mgr-key-stat">
                                    <div class="api-mgr-key-stat__name">${escapeHtml(key?.label || keyId)}</div>
                                    <div class="api-mgr-key-stat__bar">
                                        <div class="api-mgr-key-stat__bar-fill"
                                            style="width: ${Math.min(100, (stats.tokens / (summary.totalTokens || 1)) * 100)}%"></div>
                                    </div>
                                    <div class="api-mgr-key-stat__meta">
                                        <span>${stats.calls} 调用</span>
                                        <span>${formatTokens(stats.tokens)} Tokens</span>
                                        ${stats.errors > 0 ? `<span class="api-mgr-key-stat__errors">${stats.errors} 失败</span>` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="api-mgr-stats__logs">
                <div class="api-mgr-stats__section-title">
                    最近调用记录
                    <button class="api-mgr-btn api-mgr-btn--small api-mgr-btn--danger api-mgr-btn--text" ${wvAction('apiClearLogs')}>清空</button>
                </div>

                ${logs.length === 0 ? `
                    <div class="api-mgr-empty">
                        <div class="api-mgr-empty__text">还没有调用记录</div>
                    </div>
                ` : `
                    <div class="api-mgr-log-list">
                        ${logs.slice(0, 50).map(log => {
                            const key = keyMap[log.apiKeyId];
                            return `
                                <div class="api-mgr-log-item ${log.success === false ? 'is-error' : ''}">
                                    <div class="api-mgr-log-item__head">
                                        <span class="api-mgr-log-item__status ${log.success === false ? 'is-error' : ''}">
                                            ${log.success !== false ? '✓' : '✗'}
                                        </span>
                                        <span class="api-mgr-log-item__key">${escapeHtml(key?.label || log.apiKeyId || '未知')}</span>
                                        <span class="api-mgr-log-item__model">${escapeHtml(log.model || '')}</span>
                                        <span class="api-mgr-log-item__time">${formatRelativeTime(log.timestamp)}</span>
                                    </div>
                                    <div class="api-mgr-log-item__body">
                                        <span class="api-mgr-log-item__tokens">
                                            <span class="api-mgr-log-item__token-in">↓${formatTokens(log.inputTokens || 0)}</span>
                                            <span class="api-mgr-log-item__token-out">↑${formatTokens(log.outputTokens || 0)}</span>
                                        </span>
                                        <span class="api-mgr-log-item__latency">${log.latency || 0}ms</span>
                                        ${log.statusCode ? `<span class="api-mgr-log-item__code">${log.statusCode}</span>` : ''}
                                        ${log.error ? `<span class="api-mgr-log-item__error">${escapeHtml(log.error)}</span>` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        </div>
    `;
}

// ============================================
// 主入口
// ============================================

export function renderApiManagerSection(app) {
    // 供全局 onclick 处理器使用
    window.__apiMgrApp = app;

    const sdk = getApiSdk();
    if (!sdk) {
        return `
            <div class="api-mgr-page">
                <div class="api-mgr-loading">
                    <div class="api-mgr-loading__spinner"></div>
                    <div class="api-mgr-loading__text">数据库未就绪</div>
                </div>
            </div>
        `;
    }

    // 缓存还没加载完之前显示 loading（避免渲染空列表）
    if (!_cacheLoaded) {
        // 确保后台在跑加载流程；窗口 myDb 已经存在但 await 还没完成
        loadCacheAsync(window.myDb);
        return `
            <div class="api-mgr-page">
                <div class="api-mgr-loading">
                    <div class="api-mgr-loading__spinner"></div>
                    <div class="api-mgr-loading__text">加载 API 管理器...</div>
                </div>
            </div>
        `;
    }

    const tab = app.state.apiMgr?.tab || 'keys';

    return `
        <div class="api-mgr-page">
            ${renderOverviewCard(app)}
            ${renderTabs(tab)}
            ${tab === 'keys' ? renderKeysTab(app) : ''}
            ${tab === 'groups' ? renderGroupsTab(app) : ''}
            ${tab === 'stats' ? renderStatsTab(app) : ''}
        </div>
    `;
}

// ============================================
// 全局弹窗交互处理器（供 inline onclick 使用）
// ============================================

if (typeof window !== 'undefined') {
    window.__apiCloseKeyEditor = function () {
        const app = window.__apiMgrApp;
        if (!app) return;
        if (app.state.apiMgr?.editingKey) {
            app.state.apiMgr.editingKey = null;
            try { window.refreshPhoneApps?.(); } catch (_) {}
        }
    };

    window.__apiCloseGroupEditor = function () {
        const app = window.__apiMgrApp;
        if (!app) return;
        if (app.state.apiMgr?.editingGroup) {
            app.state.apiMgr.editingGroup = null;
            try { window.refreshPhoneApps?.(); } catch (_) {}
        }
    };

    window.__apiSaveGroup = function () {
        const app = window.__apiMgrApp;
        if (!app || !app.state.apiMgr?.editingGroup) return;
        const editingGroup = app.state.apiMgr.editingGroup;
        const sdk = window.__apiSdk;
        if (!sdk) return;

        const nameInput = document.querySelector('[data-group-field="name"]');
        const strategyRadio = document.querySelector('[data-group-field="strategy"]:checked');
        const selectedKeyIds = [];
        document.querySelectorAll('[data-group-key-id]:checked').forEach(el => {
            selectedKeyIds.push(el.getAttribute('data-group-key-id'));
        });

        editingGroup.name = nameInput?.value || '';
        editingGroup.strategy = strategyRadio?.value || 'round-robin';
        editingGroup.apiKeyIds = selectedKeyIds;

        const isNew = editingGroup.id.startsWith('grp_new_');
        const groupData = { ...editingGroup, id: isNew ? null : editingGroup.id };
        const saved = sdk.apiGroupSdk.put(groupData);

        app.state.apiMgr.editingGroup = null;
        app.toolkit.island.notify('success', '已保存', saved.name || 'API 组');
        try { window.refreshPhoneApps?.(); } catch (_) {}
    };

    window.__apiSaveKey = function () {
        const formData = {};
        document.querySelectorAll('[data-api-field]').forEach(el => {
            const field = el.getAttribute('data-api-field');
            formData[field] = el.type === 'checkbox' ? el.checked : el.value;
        });

        const app = window.__apiMgrApp;
        if (!app || !app.state.apiMgr?.editingKey) return;
        const editingKey = app.state.apiMgr.editingKey;
        const sdk = window.__apiSdk;
        if (!sdk) return;

        editingKey.label = formData.label || '';
        editingKey.provider = formData.provider || editingKey.provider;
        editingKey.baseUrl = (formData.baseUrl || '').replace(/\/$/, '');
        editingKey.apiKey = formData.apiKey || '';
        editingKey.model = formData.model || '';
        editingKey.timeout = parseInt(formData.timeout, 10) || 60;
        editingKey.notes = formData.notes || '';
        editingKey.proxyUrl = formData.proxyUrl || '';
        editingKey.authHeader = formData.authHeader || '';
        editingKey.params = {
            temperature: parseFloat(formData.temperature ?? 0.7),
            top_p: parseFloat(formData.topP ?? 1),
            max_tokens: parseInt(formData.maxTokens ?? 4096, 10),
            presence_penalty: parseFloat(formData.presencePenalty ?? 0),
            frequency_penalty: parseFloat(formData.frequencyPenalty ?? 0),
            stop: formData.stop || '',
        };

        const isNew = editingKey.id.startsWith('key_new_');
        const keyData = { ...editingKey, id: isNew ? null : editingKey.id };
        const saved = sdk.apiKeySdk.put(keyData);

        app.state.apiMgr.editingKey = null;
        app.toolkit.island.notify('success', '已保存', saved.label || 'API 密钥');
        try { window.refreshPhoneApps?.(); } catch (_) {}
    };

    window.__apiProviderChanged = function (provider) {
        const preset = PROVIDER_PRESETS[provider];
        if (!preset) return;
        const baseUrlField = document.querySelector('[data-api-field="baseUrl"]');
        const modelSelect = document.querySelector('[data-api-field="model"]');
        if (baseUrlField) baseUrlField.value = preset.baseUrl || '';
        if (modelSelect) {
            modelSelect.innerHTML = '<option value="">-- 先填写 API Key --</option>';
        }
    };

    window.__apiKeyInput = async function (apiKey) {
        const app = window.__apiMgrApp;
        if (!app || !app.state.apiMgr?.editingKey) return;
        const editingKey = app.state.apiMgr.editingKey;

        const modelSelect = document.querySelector('[data-api-field="model"]');
        if (!modelSelect) return;

        const baseUrl = (document.querySelector('[data-api-field="baseUrl"]')?.value || editingKey.baseUrl || '').replace(/\/$/, '');
        const provider = document.querySelector('[data-api-field="provider"]')?.value || editingKey.provider || '';

        if (!apiKey || !baseUrl) {
            modelSelect.innerHTML = '<option value="">-- 先填写 API Key --</option>';
            return;
        }

        modelSelect.innerHTML = '<option value="">获取模型中...</option>';

        try {
            const models = await _fetchModels(baseUrl, apiKey, provider, editingKey);
            if (models.length > 0) {
                modelSelect.innerHTML = models.map(m =>
                    `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`
                ).join('');
                if (modelSelect.options.length > 0) modelSelect.value = models[0];
            } else {
                modelSelect.innerHTML = '<option value="">未获取到模型，请手动输入</option>';
            }
        } catch (err) {
            console.warn('[api-mgr] 获取模型列表失败', err);
            modelSelect.innerHTML = '<option value="">获取失败，请手动输入模型</option>';
        }
    };
}

/** 从 API 获取模型列表 */
async function _fetchModels(baseUrl, apiKey, provider, editingKey) {
    if (!baseUrl || !apiKey) return [];
    try {
        const proxyUrl = editingKey?.proxyUrl || '';
        const finalUrl = proxyUrl ? proxyUrl.replace(/\/$/, '') : baseUrl;
        const url = `${finalUrl}/models`;
        // 用 Uint8Array + TextEncoder 构造 header，避免 fetch 对非 ISO-8859-1 字符报错
        const encodedKey = new TextEncoder().encode(apiKey);
        const decodedKey = new TextDecoder('utf-8', { fatal: false }).decode(encodedKey);
        const headers = { 'Authorization': `Bearer ${decodedKey}` };
        const resp = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (data.data && Array.isArray(data.data)) {
            return data.data.map(m => m.id).sort();
        }
        if (Array.isArray(data)) {
            return data.map(m => typeof m === 'string' ? m : m.id).filter(Boolean).sort();
        }
        return [];
    } catch (err) {
        console.warn('[api-mgr] 获取模型列表失败', err);
        return [];
    }
}

// 在模块加载时触发一次缓存预热
if (typeof window !== 'undefined') {
    let _preloadStarted = false;
    function _startPreload() {
        if (_preloadStarted) return;
        if (!window.myDb) return;
        _preloadStarted = true;
        loadCacheAsync(window.myDb);
    }
    if (window.myDb) {
        _startPreload();
    } else {
        // 等 window.myDb 就绪后启动一次，然后停止轮询
        const checkInterval = setInterval(() => {
            if (window.myDb) {
                _startPreload();
                clearInterval(checkInterval);
            }
        }, 100);
        setTimeout(() => clearInterval(checkInterval), 5000);
    }
}