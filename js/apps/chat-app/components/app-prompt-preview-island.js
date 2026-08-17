/**
 * chat-app / 第三方 App Prompt 预览编辑器 island (v0.61.8)
 *
 *   业务含义:在 prompt-manager 的「可用 Prompt」卡片下方,
 *     内联展示一个 JSON 编辑器(textarea + 实时预览 + 复制/编辑/保存/复原)
 *     不弹窗,跟卡片一起下拉展示
 *
 *   设计:
 *     - 整个 island 包成一个 Vue 组件(framework mount)
 *     - 内部 textarea 用 v-model → previewObject computed 实时更新预览
 *     - 4 个操作按钮(复制/编辑/保存/复原)直接派发 app:page-action 事件
 *       (不走外部 method,绕过 addEventListener 禁忌)
 *
 *   注册:
 *     - chat-app/index.js createChatApp() 里 registerIslandComponent('app-prompt-preview', ...)
 */

import { renderAppPromptCardPreview, getPreviewTypeLabel } from './app-prompt-card.js';

// ============================================================
// 实时预览
// ------------------------------------------------------------
// ★ 这里以前给每种 previewType 各写了一个组件，各自拼一套
//   `.pm-preview-card--*` 的 HTML —— 和聊天里真正发出去的卡片
//   （share-cards.js）类名不同、结构不同、图标也不同。用户按预览调好，
//   发出来是另一副样子；想自定义样式还得写两套 CSS。
//
//   现在统一走 renderAppPromptCardPreview()，它内部调的就是聊天气泡用的
//   renderShareCardBody()。改一处两处一起变，不可能再漂移。
// ============================================================
const IslandCardPreview = {
    name: 'IslandCardPreview',
    props: {
        previewType: { type: String, default: 'text' },
        previewData: { type: Object, default: () => ({}) },
        label: { type: String, default: '' },
    },
    computed: {
        html() {
            return renderAppPromptCardPreview({
                previewType: this.previewType,
                previewData: this.previewData,
                label: this.label,
            });
        },
    },
    template: `<div class="app-prompt-preview-stage-inner" v-html="html"></div>`,
};

// ============================================================
// 主 island 组件
// ============================================================
export const AppPromptPreviewIsland = {
    name: 'AppPromptPreviewIsland',
    components: { IslandCardPreview },
    props: {
        appId: { type: String, default: '' },
        promptId: { type: String, default: '' },
        previewType: { type: String, default: 'text' },
        initialPreviewData: { type: Object, default: () => ({}) },
        originalPreviewData: { type: Object, default: null },
        label: { type: String, default: '' },
        typeLabel: { type: String, default: '' },
        // ★ v0.61.8:接收外部 action payload(JSON 字符串),内部派发 app:page-action
        saveAction: { type: String, default: '' },
        copyAction: { type: String, default: '' },
        toggleAction: { type: String, default: '' },
        restoreAction: { type: String, default: '' },
    },
    data() {
        const initial = this.initialPreviewData && typeof this.initialPreviewData === 'object'
            ? this.initialPreviewData : {};
        return {
            isReadOnly: true,
            jsonText: JSON.stringify(initial, null, 2),
            isSaving: false,
        };
    },
    computed: {
        previewObject() {
            if (!this.jsonText || !this.jsonText.trim()) return {};
            try {
                const parsed = JSON.parse(this.jsonText);
                this.parseError = '';
                return (parsed && typeof parsed === 'object') ? parsed : {};
            } catch (e) {
                this.parseError = String(e?.message || e);
                return this.initialPreviewData || {};
            }
        },
        hasChanges() {
            return this.jsonText !== JSON.stringify(this.initialPreviewData || {}, null, 2);
        },
        canSave() {
            return !this.isSaving && !this.parseError && this.jsonText.trim().length > 0;
        },
        effectiveTypeLabel() {
            return this.typeLabel || getPreviewTypeLabel(this.previewType);
        },
    },
    methods: {
        /** 派发一个 action 到 framework(走 document 上 app:page-action 事件) */
        _dispatchAction(actionJson) {
            if (!actionJson) return;
            try {
                const parsed = typeof actionJson === 'string' ? JSON.parse(actionJson) : actionJson;
                document.dispatchEvent(new CustomEvent('app:page-action', {
                    detail: parsed,
                    bubbles: true,
                }));
            } catch (err) {
                console.warn('[app-prompt-preview] action dispatch failed', err);
            }
        },
        onCopy() {
            const text = this.jsonText;
            try {
                if (navigator?.clipboard?.writeText) {
                    navigator.clipboard.writeText(text)
                        .then(() => {
                            this._notify('success', '已复制', 'JSON 已复制到剪贴板');
                        })
                        .catch((e) => {
                            this._notify('warning', '复制失败', String(e?.message || e));
                        });
                } else {
                    this._notify('warning', '复制失败', '当前环境不支持剪贴板 API');
                }
            } catch (e) {
                this._notify('warning', '复制失败', String(e?.message || e));
            }
            // 同时 dispatch framework action(让调用方有机会记录)
            this._dispatchAction(this.copyAction);
        },
        onToggleEdit() {
            this.isReadOnly = !this.isReadOnly;
            this._dispatchAction(this.toggleAction);
        },
        onRestore() {
            const base = this.originalPreviewData || this.initialPreviewData || {};
            this.jsonText = JSON.stringify(base, null, 2);
            this.parseError = '';
            this.isReadOnly = true;
            this._dispatchAction(this.restoreAction);
        },
        onSave() {
            if (!this.canSave) return;
            this.isSaving = true;
            try {
                // 把最新 previewObject 写到 __currentPreviewData,framework action handler 读取
                this._currentPreviewData = this.previewObject;
                this._dispatchAction(this.saveAction);
            } finally {
                setTimeout(() => { this.isSaving = false; }, 300);
            }
        },
        _notify(level, title, sub) {
            try {
                window.__phoneIsland?.notify?.(level, title, sub);
            } catch (_) { /* noop */ }
        },
    },
    mounted() {
        // 把 promptId 写到 mountPoint 上,方便 previewAppPrompt 找到 island
        if (this.$el) {
            try { this.$el.setAttribute('data-prompt-id', `${this.appId}::${this.promptId}`); } catch (_) {}
            try { this.$el.setAttribute('data-app-id', String(this.appId || '')); } catch (_) {}
        }
    },
    template: `
        <div class="app-prompt-preview-island">
            <div class="app-prompt-preview-stage">
                <island-card-preview :preview-type="previewType" :preview-data="previewObject" :label="label" />
            </div>
            <div class="app-prompt-preview-field">
                <label class="app-prompt-preview-label">
                    <span>{{ effectiveTypeLabel }}数据(JSON)</span>
                    <span v-if="parseError" class="app-prompt-preview-error">解析失败:{{ parseError }}</span>
                    <span v-else-if="hasChanges" class="app-prompt-preview-dirty">已修改</span>
                </label>
                <textarea
                    class="app-prompt-preview-textarea"
                    v-model="jsonText"
                    :readonly="isReadOnly"
                    spellcheck="false"
                    rows="8"></textarea>
            </div>
            <div class="app-prompt-preview-actions">
                <button type="button" class="app-prompt-preview-btn app-prompt-preview-btn--secondary"
                    title="复制 JSON"
                    @click="onCopy">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                </button>
                <button type="button" class="app-prompt-preview-btn app-prompt-preview-btn--secondary"
                    :title="isReadOnly ? '编辑' : '锁定'"
                    @click="onToggleEdit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>
                    </svg>
                </button>
                <button type="button" class="app-prompt-preview-btn app-prompt-preview-btn--secondary"
                    title="复原"
                    :disabled="!hasChanges" @click="onRestore">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 12a9 9 0 1 0 3-6.7"/>
                        <polyline points="3 4 3 10 9 10"/>
                    </svg>
                </button>
                <button type="button" class="app-prompt-preview-btn app-prompt-preview-btn--primary"
                    title="保存"
                    :disabled="!canSave" @click="onSave">
                    <svg v-if="!isSaving" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="9" stroke-dasharray="40" stroke-dashoffset="40">
                            <animate attributeName="stroke-dashoffset" from="40" to="0" dur="0.8s" repeatCount="indefinite"/>
                        </circle>
                    </svg>
                </button>
            </div>
        </div>
    `,
};

export default AppPromptPreviewIsland;