/**
 * 设置 App · API 管理模块 · 方法层
 *
 * 处理 API 密钥和 API 组的增删改查操作
 *
 * 数据通过 section.js 的内存缓存 SDK 操作（同步接口）
 */

import { PROVIDER_PRESETS } from './api-key-sdk.js';

// ============================================
// 方法构建器
// ============================================

export function buildApiManagerMethods() {
    function refresh() {
        try { window.refreshPhoneApps?.(); } catch (_) {}
    }
    return {
        // ============================================
        // Tab 切换
        // ============================================

        apiSetTab({ tab }) {
            const app = this.app;
            if (!app.state.apiMgr) app.state.apiMgr = {};
            app.state.apiMgr.tab = tab;
            refresh();
        },

        // ============================================
        // API Key 操作
        // ============================================

        apiNewKey() {
            const app = this.app;
            if (!app.state.apiMgr) app.state.apiMgr = {};

            // 获取默认 Provider 配置
            const defaultProvider = PROVIDER_PRESETS['openai-compatible'];

            app.state.apiMgr.editingKey = {
                id: `key_new_${Date.now()}`,
                label: '',
                provider: 'openai-compatible',
                baseUrl: defaultProvider?.baseUrl || '',
                apiKey: '',
                model: defaultProvider?.modelPlaceholder || '',
                enabled: true,
                params: {
                    temperature: 0.7,
                    top_p: 1,
                    max_tokens: 4096,
                    presence_penalty: 0,
                    frequency_penalty: 0,
                    stop: '',
                },
                timeout: 60,
                notes: '',
                proxyUrl: '',
                authHeader: '',
            };
            refresh();
        },

        apiEditKey({ id }) {
            const sdk = window.__apiSdk;
            if (!sdk) return;
            const key = sdk.apiKeySdk.get(id);
            if (!key) return;
            const app = this.app;
            if (!app.state.apiMgr) app.state.apiMgr = {};
            app.state.apiMgr.editingKey = { ...key };
            refresh();
        },

        apiDuplicateKey({ id }) {
            const sdk = window.__apiSdk;
            if (!sdk) return;
            const key = sdk.apiKeySdk.get(id);
            if (!key) return;
            const app = this.app;
            if (!app.state.apiMgr) app.state.apiMgr = {};
            app.state.apiMgr.editingKey = {
                ...key,
                id: `key_new_${Date.now()}`,
                label: `${key.label || key.id} (副本)`,
            };
            refresh();
        },

        apiSaveKey() {
            const sdk = window.__apiSdk;
            if (!sdk) return;

            const app = this.app;
            const editingKey = app.state.apiMgr?.editingKey;
            if (!editingKey) return;

            // 收集表单数据
            const formData = collectKeyFormData();

            // 构建保存对象
            const isNew = editingKey.id.startsWith('key_new_');
            const keyData = {
                ...editingKey,
                ...formData,
                id: isNew ? null : editingKey.id, // null 让 SDK 生成新 id
            };

            // 处理参数
            keyData.params = {
                temperature: parseFloat(formData.temperature ?? 0.7),
                top_p: parseFloat(formData.topP ?? 1),
                max_tokens: parseInt(formData.maxTokens ?? 4096, 10),
                presence_penalty: parseFloat(formData.presencePenalty ?? 0),
                frequency_penalty: parseFloat(formData.frequencyPenalty ?? 0),
                stop: formData.stop || '',
            };

            // 保存
            const saved = sdk.apiKeySdk.put(keyData);

            // 清除编辑状态
            app.state.apiMgr.editingKey = null;

            // 提示
            app.toolkit.island.notify('success', '已保存', saved.label || 'API 密钥');
            refresh();
        },

        apiCloseKeyEditor() {
            const app = this.app;
            if (app.state.apiMgr?.editingKey) {
                app.state.apiMgr.editingKey = null;
                refresh();
            }
        },

        apiDeleteKey({ id }) {
            const sdk = window.__apiSdk;
            if (!sdk) return;

            const key = sdk.apiKeySdk.get(id);
            if (!key) return;

            const confirmed = window.confirm(`确定要删除 API 密钥「${key.label || id}」吗？此操作不可恢复。`);
            if (!confirmed) return;

            sdk.apiKeySdk.remove(id);

            // 如果删除的是正在编辑的密钥，关闭编辑器
            if (this.app.state.apiMgr?.editingKey?.id === id) {
                this.app.state.apiMgr.editingKey = null;
            }

            this.app.toolkit.island.notify('info', '已删除', key.label || 'API 密钥');
            window.refreshPhoneApps?.();
        },

        apiKeyToggle({ id, enabled }) {
            const sdk = window.__apiSdk;
            if (!sdk) return;
            const key = sdk.apiKeySdk.get(id);
            if (!key) return;
            key.enabled = enabled;
            sdk.apiKeySdk.put(key);
            window.refreshPhoneApps?.();
        },

        // ============================================
        // API Group 操作
        // ============================================

        apiNewGroup() {
            const app = this.app;
            if (!app.state.apiMgr) app.state.apiMgr = {};
            app.state.apiMgr.editingGroup = {
                id: `grp_new_${Date.now()}`,
                name: '',
                strategy: 'round-robin',
                apiKeyIds: [],
            };
            refresh();
        },

        apiEditGroup({ id }) {
            const sdk = window.__apiSdk;
            if (!sdk) return;
            const group = sdk.apiGroupSdk.get(id);
            if (!group) return;
            const app = this.app;
            if (!app.state.apiMgr) app.state.apiMgr = {};
            app.state.apiMgr.editingGroup = { ...group };
            refresh();
        },

        apiSaveGroup() {
            const sdk = window.__apiSdk;
            if (!sdk) return;

            const app = this.app;
            const editingGroup = app.state.apiMgr?.editingGroup;
            if (!editingGroup) return;

            // 收集表单数据
            const formData = collectGroupFormData();

            // 构建保存对象
            const isNew = editingGroup.id.startsWith('grp_new_');
            const groupData = {
                ...editingGroup,
                ...formData,
                id: isNew ? null : editingGroup.id,
            };

            // 保存
            const saved = sdk.apiGroupSdk.put(groupData);

            // 清除编辑状态
            app.state.apiMgr.editingGroup = null;

            // 提示
            app.toolkit.island.notify('success', '已保存', saved.name || 'API 组');
            refresh();
        },

        apiCloseGroupEditor() {
            const app = this.app;
            if (app.state.apiMgr?.editingGroup) {
                app.state.apiMgr.editingGroup = null;
                refresh();
            }
        },

        apiDeleteGroup({ id }) {
            const sdk = window.__apiSdk;
            if (!sdk) return;

            const group = sdk.apiGroupSdk.get(id);
            if (!group) return;

            const confirmed = window.confirm(`确定要删除 API 组「${group.name || id}」吗？`);
            if (!confirmed) return;

            sdk.apiGroupSdk.remove(id);

            // 如果删除的是正在编辑的组，关闭编辑器
            if (this.app.state.apiMgr?.editingGroup?.id === id) {
                this.app.state.apiMgr.editingGroup = null;
            }

            this.app.toolkit.island.notify('info', '已删除', group.name || 'API 组');
            window.refreshPhoneApps?.();
        },

        apiTestKey({ id }) {
            const sdk = window.__apiSdk;
            if (!sdk) return;

            const key = sdk.apiKeySdk.get(id);
            if (!key) return;

            if (!key.baseUrl || !key.apiKey || !key.model) {
                this.app.toolkit.island.notify('warn', '无法测试', '请先填写 Base URL、API Key 与模型');
                return;
            }

            const finalUrl = (key.proxyUrl ? key.proxyUrl.replace(/\/$/, '') : key.baseUrl.replace(/\/$/, '')) + '/chat/completions';
            const headers = { 'Content-Type': 'application/json' };
            // 把含非 ISO-8859-1 字符的 header value 编一次码，绕过 fetch 的限制
            const sanitizeHeaderValue = (v) => {
                try {
                    if (!v) return v;
                    // 检测是否含非 ASCII 字符
                    if (/^[\x00-\x7f]*$/.test(v)) return v;
                    return '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(v))) + '?=';
                } catch (_) {
                    return v;
                }
            };
            if (key.authHeader && key.authHeader.trim()) {
                headers[key.authHeader.trim()] = sanitizeHeaderValue(key.apiKey);
            } else {
                headers['Authorization'] = 'Bearer ' + sanitizeHeaderValue(key.apiKey);
            }

            const body = JSON.stringify({
                model: key.model,
                messages: [{ role: 'user', content: 'hi' }],
                max_tokens: 8,
                temperature: 0,
            });

            const start = Date.now();
            this.app.toolkit.island.notify('info', '测试中…', key.label || key.id);

            fetch(finalUrl, {
                method: 'POST',
                headers,
                body,
                signal: AbortSignal.timeout((key.timeout || 60) * 1000),
            })
                .then(async resp => {
                    const latency = Date.now() - start;
                    let inputTokens = 0;
                    let outputTokens = 0;
                    let success = resp.ok;
                    let error = null;
                    if (resp.ok) {
                        try {
                            const data = await resp.json();
                            inputTokens = data.usage?.prompt_tokens || 0;
                            outputTokens = data.usage?.completion_tokens || 0;
                        } catch (_) {
                            // 解析失败但 HTTP 成功
                        }
                    } else {
                        try {
                            const txt = await resp.text();
                            error = `${resp.status} ${txt.slice(0, 120)}`;
                        } catch (_) {
                            error = `HTTP ${resp.status}`;
                        }
                    }

                    sdk.apiUsageSdk.log({
                        apiKeyId: key.id,
                        endpoint: '/chat/completions',
                        method: 'POST',
                        model: key.model,
                        inputTokens,
                        outputTokens,
                        totalTokens: inputTokens + outputTokens,
                        latency,
                        success,
                        error,
                        statusCode: resp.status,
                        note: '手动测试',
                    });

                    if (success) {
                        this.app.toolkit.island.notify('success', '测试成功', `${latency}ms · ${key.label || key.id}`);
                    } else {
                        this.app.toolkit.island.notify('error', '测试失败', error || `HTTP ${resp.status}`);
                    }
                    try { window.refreshPhoneApps?.(); } catch (_) {}
                })
                .catch(err => {
                    const latency = Date.now() - start;
                    sdk.apiUsageSdk.log({
                        apiKeyId: key.id,
                        endpoint: '/chat/completions',
                        method: 'POST',
                        model: key.model,
                        inputTokens: 0,
                        outputTokens: 0,
                        totalTokens: 0,
                        latency,
                        success: false,
                        error: err?.message || String(err),
                        statusCode: 0,
                        note: '手动测试',
                    });
                    this.app.toolkit.island.notify('error', '测试失败', err?.message || '网络错误');
                    try { window.refreshPhoneApps?.(); } catch (_) {}
                });
        },

        apiTestGroup({ id }) {
            const sdk = window.__apiSdk;
            if (!sdk) return;

            const group = sdk.apiGroupSdk.get(id);
            if (!group) return;

            // 简单测试：获取组内第一个可用的 API Key
            const testKey = sdk.apiKeySdk.get(group.apiKeyIds?.[0]);
            if (!testKey) {
                this.app.toolkit.island.notify('warn', '测试失败', '组内没有可用密钥');
                return;
            }

            // 记录测试日志
            sdk.apiUsageSdk.log({
                apiKeyId: testKey.id,
                groupId: group.id,
                endpoint: '/chat/completions',
                method: 'POST',
                model: testKey.model,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                latency: 0,
                success: true,
                error: null,
                statusCode: 0,
                note: '手动测试',
            });

            this.app.toolkit.island.notify('success', '测试记录', testKey.label || testKey.id);
            window.refreshPhoneApps?.();
        },

        // ============================================
        // 统计操作
        // ============================================

        apiSetStatsDays({ days }) {
            const app = this.app;
            if (!app.state.apiMgr) app.state.apiMgr = {};
            app.state.apiMgr.statsDays = days;
            refresh();
        },

        apiClearLogs() {
            const sdk = window.__apiSdk;
            if (!sdk) return;

            const confirmed = window.confirm('确定要清空所有调用记录吗？');
            if (!confirmed) return;

            sdk.apiUsageSdk.clearAll();
            this.app.toolkit.island.notify('info', '已清空', '调用记录');
            window.refreshPhoneApps?.();
        },
    };
}

// ============================================
// 表单数据收集
// ============================================

function collectKeyFormData() {
    const data = {};
    document.querySelectorAll('[data-api-field]').forEach(el => {
        const field = el.getAttribute('data-api-field');
        let value = el.value;
        if (el.type === 'range') value = parseFloat(value);
        data[field] = value;
    });
    return data;
}

function collectGroupFormData() {
    const data = {};
    const nameInput = document.querySelector('[data-group-field="name"]');
    if (nameInput) data.name = nameInput.value;

    const strategyRadio = document.querySelector('[data-group-field="strategy"]:checked');
    if (strategyRadio) data.strategy = strategyRadio.value;

    const selectedKeyIds = [];
    document.querySelectorAll('[data-group-key-id]:checked').forEach(el => {
        selectedKeyIds.push(el.getAttribute('data-group-key-id'));
    });
    data.apiKeyIds = selectedKeyIds;

    return data;
}