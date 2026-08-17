/**
 * 设置 App · API 管理模块 · 方法层
 *
 * 处理 API 密钥和 API 组的增删改查操作
 *
 * 数据通过 section.js 的内存缓存 SDK 操作（同步接口）
 */

import { PROVIDER_PRESETS } from './api-key-sdk.js';
import {
    classifyApiError,
    buildDiagnosticReport,
    parseRepairSnippet,
} from './api-diagnostics.js';

/**
 * 最近一次测试失败的诊断结果。
 *
 * 存在模块级变量而不是 app.state 里：它是「上一次操作的产物」，
 * 不需要持久化、也不该在刷新后还留着一份可能已经不成立的报告。
 * 结构：{ keyId, code, report, at }
 */
let _lastDiagnostic = null;

export function getLastApiDiagnostic() {
    return _lastDiagnostic;
}

// ============================================
// 方法构建器
// ============================================

export function buildApiManagerMethods() {
    /**
     * 触发 detail 重画 ——
     *   ★ v0.49.1 修复:点击「新建 API」等弹窗不显示,需切出再切回才显示
     *   根因:之前只调 refreshPhoneApps() 改 apps.value,
     *   但 apps.value 不在 framework bridge 的 watch sources 里,
     *   bridge.syncRenderer 看 detailKey 没变 + tickChanged=false → 不重画 detail。
     *   修复:同时 ++detailRenderTick + bridge.syncNow({force:true}) 双保险
     *   (settings-app renderDetailPage 是 sync 函数,不会撞 v0.38 死循环)
     */
    function refresh() {
        if (typeof window === 'undefined') return;
        if (window.__detailRenderTick && typeof window.__detailRenderTick.value === 'number') {
            window.__detailRenderTick.value++;
        }
        const bridge = window.__appRendererBridge;
        if (bridge && typeof bridge.syncNow === 'function') {
            try { bridge.syncNow({ force: true }); } catch (_) {}
        }
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
            refresh();
        },

        apiKeyToggle({ id, enabled }) {
            const sdk = window.__apiSdk;
            if (!sdk) return;
            const key = sdk.apiKeySdk.get(id);
            if (!key) return;
            key.enabled = enabled;
            sdk.apiKeySdk.put(key);
            refresh();
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
            refresh();
        },

        async apiTestKey({ id }) {
            const sdk = window.__apiSdk;
            if (!sdk) return;

            const key = sdk.apiKeySdk.get(id);
            if (!key) return;

            if (!key.baseUrl || !key.apiKey || !key.model) {
                const diag = { code: 'API-CONFIG', title: '配置还没填完', cause: 'Base URL / API Key / 模型三个必填项里有空的。', fixes: ['把三个必填项都填上再测试'] };
                _lastDiagnostic = {
                    keyId: key.id, code: diag.code, at: Date.now(),
                    report: buildDiagnosticReport({ key, status: 0, diag }),
                };
                this.app.toolkit.island.notify('warning', `${diag.code} 配置未填完`, '请先填写 Base URL、API Key 与模型');
                refresh();
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

            let resp;
            try {
                resp = await fetch(finalUrl, {
                    method: 'POST',
                    headers,
                    body,
                    signal: AbortSignal.timeout((key.timeout || 60) * 1000),
                });
            } catch (err) {
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
                // 网络层失败：分类 + 存一份可复制的报告，灵动岛只显示错误码 + 一句结论。
                // 原来这里直接把 err.message 甩到岛上 —— 岛 3.5 秒就没了，
                // 用户既看不懂也来不及截图。
                const diag = classifyApiError({ err });
                _lastDiagnostic = {
                    keyId: key.id, code: diag.code, at: Date.now(),
                    report: buildDiagnosticReport({ key, status: 0, err, diag, latency }),
                };
                this.app.toolkit.island.notify('error', `${diag.code} ${diag.title}`, '点密钥卡片上的「诊断」看怎么修');
                refresh();
                return;
            }

            const latency = Date.now() - start;
            let inputTokens = 0;
            let outputTokens = 0;
            let success = resp.ok;
            let error = null;
            let rawBody = '';
            let badJson = false;
            let emptyContent = false;
            if (resp.ok) {
                try {
                    const data = await resp.json();
                    inputTokens = data.usage?.prompt_tokens || 0;
                    outputTokens = data.usage?.completion_tokens || 0;
                    // HTTP 200 但没有正文：连通了却拿不到内容，跟「成功」是两回事。
                    // 之前这种情况被当成测试通过，用户在聊天里才发现 AI 不说话。
                    const content = data?.choices?.[0]?.message?.content;
                    if (!content || !String(content).trim()) {
                        emptyContent = true;
                        success = false;
                        error = 'HTTP 200 但返回内容为空';
                    }
                } catch (_) {
                    // 解析失败但 HTTP 成功 —— 多半 Base URL 指到了网页而不是 API
                    badJson = true;
                    success = false;
                    error = 'HTTP 200 但返回的不是 JSON';
                }
            } else {
                try {
                    rawBody = await resp.text();
                    error = `${resp.status} ${rawBody.slice(0, 120)}`;
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
                _lastDiagnostic = null;   // 通了就把上一次的报告清掉，别留着误导
                this.app.toolkit.island.notify('success', '测试成功', `${latency}ms · ${key.label || key.id}`);
            } else {
                const diag = classifyApiError({ status: resp.status, body: rawBody, badJson, emptyContent });
                _lastDiagnostic = {
                    keyId: key.id, code: diag.code, at: Date.now(),
                    report: buildDiagnosticReport({ key, status: resp.status, body: rawBody, diag, latency }),
                };
                this.app.toolkit.island.notify('error', `${diag.code} ${diag.title}`, '点密钥卡片上的「诊断」看怎么修');
            }
            refresh();
        },

        // ============================================
        // 诊断 / 科普 / 修复（2026-08-13）
        // ============================================

        /** 打开上一次失败的诊断报告（可整段复制，Key 已打码） */
        apiOpenDiagnostic({ id } = {}) {
            const diag = _lastDiagnostic;
            if (!diag || (id && diag.keyId !== id)) {
                this.app.toolkit.island.notify('info', '暂无诊断记录', '先点一次「测试」');
                return;
            }
            const app = this.app;
            if (!app.state.apiMgr) app.state.apiMgr = {};
            app.state.apiMgr.diagnosticOpen = true;
            refresh();
        },

        apiCloseDiagnostic() {
            const app = this.app;
            if (app.state.apiMgr) app.state.apiMgr.diagnosticOpen = false;
            refresh();
        },

        /** 复制诊断报告到剪贴板 */
        async apiCopyDiagnostic() {
            const text = _lastDiagnostic?.report || '';
            if (!text) return;
            let ok = false;
            try {
                await navigator.clipboard.writeText(text);
                ok = true;
            } catch (_) {
                // 非安全上下文 / 无权限：退回 textarea + execCommand
                try {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    ok = document.execCommand('copy');
                    document.body.removeChild(ta);
                } catch (_) { ok = false; }
            }
            this.app.toolkit.island.notify(ok ? 'success' : 'warning',
                ok ? '诊断报告已复制' : '复制失败',
                ok ? '可以直接贴给别人问' : '请手动长按选中复制');
        },

        /** 打开 / 关闭「API 是什么」科普页 */
        apiToggleFaq() {
            const app = this.app;
            if (!app.state.apiMgr) app.state.apiMgr = {};
            app.state.apiMgr.faqOpen = !app.state.apiMgr.faqOpen;
            refresh();
        },

        /** 打开 / 关闭修复窗口 */
        apiToggleRepair({ id } = {}) {
            const app = this.app;
            if (!app.state.apiMgr) app.state.apiMgr = {};
            const cur = app.state.apiMgr.repairKeyId;
            app.state.apiMgr.repairKeyId = (cur && cur === id) ? null : (id || null);
            app.state.apiMgr.repairResult = null;
            refresh();
        },

        /**
         * 修复窗口的「解析并应用」。
         *
         * 用户把从服务商 / 朋友 / AI 那里拿到的一段配置整段粘进来，
         * 这里解析成字段写回密钥。支持 JSON / `键: 值` / `.env` 三种写法，
         * 键名做别名归一，不认识的键跳过而不是整段失败
         * （用户多半是整段拷来的，里面混着别的东西很正常）。
         */
        async apiApplyRepair({ id } = {}) {
            const sdk = window.__apiSdk;
            const app = this.app;
            if (!sdk || !id) return;
            const el = document.querySelector('[data-api-repair-input="1"]');
            const text = el ? el.value : '';
            const res = parseRepairSnippet(text);
            if (!app.state.apiMgr) app.state.apiMgr = {};
            if (!res.ok) {
                app.state.apiMgr.repairResult = { ok: false, message: res.error };
                this.app.toolkit.island.notify('warning', '没认出配置', res.error || '');
                refresh();
                return;
            }
            try {
                await sdk.apiKeySdk.update(id, res.patch);
            } catch (err) {
                app.state.apiMgr.repairResult = { ok: false, message: err?.message || '写入失败' };
                refresh();
                return;
            }
            app.state.apiMgr.repairResult = {
                ok: true,
                message: `已更新 ${res.recognized.length} 项：${res.recognized.join('、')}`
                    + (res.ignored.length ? `；忽略了 ${res.ignored.length} 项无关字段` : ''),
            };
            this.app.toolkit.island.notify('success', '配置已应用', '再点一次「测试」确认');
            refresh();
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
            refresh();
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
            refresh();
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