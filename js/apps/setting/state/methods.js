/**
 * 设置 App · 业务方法（methods）· API 部分
 *
 * 世界 / 用户 / AI 人设的保存逻辑已迁移到 settings-sdk，
 * 详见 world/methods.js（世界观）、user/index.js（用户）、ai/index.js（AI）。
 *
 * 本文件仅保留旧 API 配置的 save/reset（已迁移到 api-manager，但保留备用）。
 *
 * this 上下文由 app-registry 注入 { app, toolkit, methods, services, ... }。
 */

import { DEFAULT_API_PARAMS } from '../defaults.js';

function notify(toolkit, kind, title, message) {
    toolkit.island.notify(kind, title, message);
}

function refresh() {
    window.refreshPhoneApps?.();
    const appsRef = typeof window !== 'undefined' ? window.__phoneAppsRef : null;
    if (appsRef && Array.isArray(appsRef.value)) {
        appsRef.value = [...appsRef.value];
    }
    const tickRef = typeof window !== 'undefined' ? window.__detailRenderTick : null;
    if (tickRef && typeof tickRef.value === 'number') {
        tickRef.value = tickRef.value + 1;
    }
}

// ============================================
// API（旧版简单配置，现已迁移到 API 管理器）
// ============================================

export function buildApiMethods() {
    return {
        updateApiField(payload = {}) {
            const api = this.app.state.ui.api;
            const { field, value } = payload;
            if (!field) return;
            if (field === 'temperature') {
                api.temperature = Number(value);
            } else {
                api[field] = value;
            }
            refresh();
        },

        async saveApi() {
            const api = { ...this.app.state.ui.api };
            try {
                await this.toolkit.db.put('apiProfiles', {
                    key: 'active',
                    ...api,
                    updatedAt: Date.now(),
                });
                this.app.state.savedAt.api = Date.now();
                refresh();
                notify(this.toolkit, 'success', 'API 已保存', api.label || '默认 API');
            } catch (err) {
                console.error('[settings] saveApi 失败', err);
                notify(this.toolkit, 'error', '保存失败', '请稍后再试');
            }
        },

        async resetApi() {
            this.app.state.ui.api = { ...DEFAULT_API_PARAMS };
            try {
                await this.toolkit.db.put('apiProfiles', {
                    key: 'active',
                    ...DEFAULT_API_PARAMS,
                    updatedAt: Date.now(),
                });
            } catch (err) {
                console.warn('[settings] resetApi 持久化失败', err);
            }
            refresh();
            notify(this.toolkit, 'success', '已恢复默认 API', '');
        },
    };
}
