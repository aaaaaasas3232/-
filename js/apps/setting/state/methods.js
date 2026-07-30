/**
 * 设置 App · 业务方法（methods）· 非外观部分
 *
 * 把 4 个子页面的方法集中在这里：
 *   - worldBlock  世界观
 *   - userBlock   用户人设
 *   - aiBlock     AI 人设
 *   - apiBlock    API
 *
 * 「外观与通用」相关方法（updateAppearanceField / saveAppearance / resetAppearance /
 * toggleCaseHidden / toggleStatusBar）已迁到 appearance-general/methods.js。
 *
 * 持久化策略：
 *   - saveXxx：把 state.ui.xxx 写到 IndexedDB，标记 savedAt.xxx，notify 灵动岛。
 *   - resetXxx：把 state.ui.xxx 重置成默认，同时持久化一份默认值。
 *   - updateXxxField：只改 state 不落盘（用户要按保存）。
 *
 * this 上下文由 app-registry 注入 { app, toolkit, methods, services, ... }。
 */

import { DB_KEY, STORE_NAME, cloneDefaults } from '../defaults.js';

function notify(toolkit, kind, title, message) {
    toolkit.island.notify(kind, title, message);
}

function refresh() {
    window.refreshPhoneApps?.();
    // 强制让 Vue 重新评估 currentDetailView 等 reactive 链，
    // 这样 detail 内的 renderPage 才会重新执行。
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
// World 世界观
// ============================================

export function buildWorldMethods() {
    return {
        updateWorldField(payload = {}) {
            const world = this.app.state.ui.world;
            world[payload.field] = payload.value;
            refresh();
        },

        updateWorldKeyPointsText(payload = {}) {
            this.app.state.draft.worldKeyPointsText = payload.value || '';
        },

        async saveWorld() {
            const world = { ...this.app.state.ui.world };
            const text = this.app.state.draft.worldKeyPointsText || '';
            world.keyPoints = splitLines(text);
            this.app.state.ui.world.keyPoints = world.keyPoints;
            try {
                await this.toolkit.db.put(STORE_NAME.world, {
                    key: DB_KEY.world,
                    ...world,
                    updatedAt: Date.now(),
                });
                this.app.state.savedAt.world = Date.now();
                refresh();
                notify(this.toolkit, 'success', '世界观已保存', world.name || '未命名世界观');
            } catch (err) {
                console.error('[settings] saveWorld 失败', err);
                notify(this.toolkit, 'error', '保存失败', '请稍后再试');
            }
        },

        async resetWorld() {
            const defaults = cloneDefaults().world;
            this.app.state.ui.world = defaults;
            this.app.state.draft.worldKeyPointsText = '';
            try {
                await this.toolkit.db.put(STORE_NAME.world, {
                    key: DB_KEY.world,
                    ...defaults,
                    keyPoints: [],
                    updatedAt: Date.now(),
                });
            } catch (err) {
                console.warn('[settings] resetWorld 持久化失败', err);
            }
            refresh();
            notify(this.toolkit, 'success', '已恢复默认世界观', '');
        },
    };
}

// ============================================
// User 用户人设
// ============================================

export function buildUserMethods() {
    return {
        updateUserField(payload = {}) {
            const user = this.app.state.ui.user;
            user[payload.field] = payload.value;
            refresh();
        },

        updateUserPreferencesText(payload = {}) {
            this.app.state.draft.userPreferencesText = payload.value || '';
        },

        async saveUser() {
            const user = { ...this.app.state.ui.user };
            user.preferences = splitLines(this.app.state.draft.userPreferencesText || '');
            this.app.state.ui.user.preferences = user.preferences;
            try {
                await this.toolkit.db.put(STORE_NAME.user, {
                    key: DB_KEY.user,
                    ...user,
                    updatedAt: Date.now(),
                });
                this.app.state.savedAt.user = Date.now();
                refresh();
                notify(this.toolkit, 'success', '用户人设已保存', user.name || '我');
            } catch (err) {
                console.error('[settings] saveUser 失败', err);
                notify(this.toolkit, 'error', '保存失败', '请稍后再试');
            }
        },

        async resetUser() {
            const defaults = cloneDefaults().user;
            this.app.state.ui.user = defaults;
            this.app.state.draft.userPreferencesText = '';
            try {
                await this.toolkit.db.put(STORE_NAME.user, {
                    key: DB_KEY.user,
                    ...defaults,
                    preferences: [],
                    updatedAt: Date.now(),
                });
            } catch (err) {
                console.warn('[settings] resetUser 持久化失败', err);
            }
            refresh();
            notify(this.toolkit, 'success', '已恢复默认用户人设', '');
        },
    };
}

// ============================================
// AI 人设
// ============================================

export function buildAiMethods() {
    return {
        updateAiField(payload = {}) {
            const ai = this.app.state.ui.ai;
            ai[payload.field] = payload.value;
            refresh();
        },

        updateAiRulesText(payload = {}) {
            this.app.state.draft.aiRulesText = payload.value || '';
        },

        async saveAi() {
            const ai = { ...this.app.state.ui.ai };
            ai.rules = splitLines(this.app.state.draft.aiRulesText || '');
            this.app.state.ui.ai.rules = ai.rules;
            try {
                await this.toolkit.db.put(STORE_NAME.ai, {
                    key: DB_KEY.ai,
                    ...ai,
                    updatedAt: Date.now(),
                });
                this.app.state.savedAt.ai = Date.now();
                refresh();
                notify(this.toolkit, 'success', 'AI 人设已保存', ai.name || '默认 AI');
            } catch (err) {
                console.error('[settings] saveAi 失败', err);
                notify(this.toolkit, 'error', '保存失败', '请稍后再试');
            }
        },

        async resetAi() {
            const defaults = cloneDefaults().ai;
            this.app.state.ui.ai = defaults;
            this.app.state.draft.aiRulesText = '';
            try {
                await this.toolkit.db.put(STORE_NAME.ai, {
                    key: DB_KEY.ai,
                    ...defaults,
                    rules: [],
                    updatedAt: Date.now(),
                });
            } catch (err) {
                console.warn('[settings] resetAi 持久化失败', err);
            }
            refresh();
            notify(this.toolkit, 'success', '已恢复默认 AI 人设', '');
        },
    };
}

// ============================================
// API
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
                await this.toolkit.db.put(STORE_NAME.api, {
                    key: DB_KEY.api,
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
            const defaults = cloneDefaults().api;
            this.app.state.ui.api = defaults;
            try {
                await this.toolkit.db.put(STORE_NAME.api, {
                    key: DB_KEY.api,
                    ...defaults,
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

// ============================================
// helpers
// ============================================

function splitLines(text) {
    return (text || '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
}