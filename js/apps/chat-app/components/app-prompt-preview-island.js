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

const PREVIEW_TYPE_LABELS = Object.freeze({
    'text': '文本预览',
    'music-card': '音乐卡片',
    'red-packet-card': '红包卡片',
    'location-card': '位置卡片',
});

// 局部 XSS escape 工具
function _escape(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================================
// 子组件:实时预览(每个 previewType 一个)
// ============================================================
const IslandMusicPreview = {
    name: 'IslandMusicPreview',
    props: { previewData: { type: Object, default: () => ({}) }, label: { type: String, default: '' } },
    computed: {
        html() {
            const d = this.previewData || {};
            const song = String(d.song || d.title || this.label || '未命名歌曲');
            const artist = String(d.artist || d.singer || '未知歌手');
            const cover = String(d.cover || '');
            const coverHtml = cover
                ? `<div class="pm-preview-card__cover" style="background-image:url('${_escape(cover)}')"></div>`
                : `<div class="pm-preview-card__cover pm-preview-card__cover--placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                    </svg>
                </div>`;
            return `
                <div class="pm-preview-card pm-preview-card--music">
                    ${coverHtml}
                    <div class="pm-preview-card__meta">
                        <div class="pm-preview-card__title">${_escape(song)}</div>
                        <div class="pm-preview-card__sub">${_escape(artist)}</div>
                    </div>
                </div>`;
        },
    },
    template: `<div class="app-prompt-preview-stage-inner" v-html="html"></div>`,
};
const IslandRedPacketPreview = {
    name: 'IslandRedPacketPreview',
    props: { previewData: { type: Object, default: () => ({}) }, label: { type: String, default: '' } },
    computed: {
        html() {
            const d = this.previewData || {};
            const message = String(d.message || d.title || this.label || '恭喜发财');
            const sender = String(d.sender || '对方发来红包');
            return `
                <div class="pm-preview-card pm-preview-card--red-packet">
                    <div class="pm-preview-card__redpacket-header">
                        <div class="pm-preview-card__redpacket-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="8" width="18" height="12" rx="2"/><circle cx="12" cy="14" r="2.5"/>
                            </svg>
                        </div>
                        <div class="pm-preview-card__redpacket-text">
                            <div class="pm-preview-card__redpacket-title">${_escape(message)}</div>
                            <div class="pm-preview-card__redpacket-sender">${_escape(sender)}</div>
                        </div>
                    </div>
                    <div class="pm-preview-card__redpacket-footer">
                        <span class="pm-preview-card__redpacket-cta">点击领取红包</span>
                    </div>
                </div>`;
        },
    },
    template: `<div class="app-prompt-preview-stage-inner" v-html="html"></div>`,
};
const IslandLocationPreview = {
    name: 'IslandLocationPreview',
    props: { previewData: { type: Object, default: () => ({}) }, label: { type: String, default: '' } },
    computed: {
        html() {
            const d = this.previewData || {};
            const name = String(d.name || d.title || this.label || '位置');
            const address = String(d.address || '');
            return `
                <div class="pm-preview-card pm-preview-card--location">
                    <div class="pm-preview-card__location-map">
                        <div class="pm-preview-card__location-grid"></div>
                        <div class="pm-preview-card__location-pin">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                            </svg>
                        </div>
                    </div>
                    <div class="pm-preview-card__location-info">
                        <div class="pm-preview-card__location-name">${_escape(name)}</div>
                        ${address ? `<div class="pm-preview-card__location-address">${_escape(address)}</div>` : ''}
                    </div>
                </div>`;
        },
    },
    template: `<div class="app-prompt-preview-stage-inner" v-html="html"></div>`,
};
const IslandTextPreview = {
    name: 'IslandTextPreview',
    props: { previewData: { type: Object, default: () => ({}) }, label: { type: String, default: '' } },
    computed: {
        html() {
            const d = this.previewData || {};
            const text = String(d.text || d.preview || this.label || '(空文本)');
            return `
                <div class="pm-preview-card pm-preview-card--text">
                    <div class="pm-preview-card__text">${_escape(text)}</div>
                </div>`;
        },
    },
    template: `<div class="app-prompt-preview-stage-inner" v-html="html"></div>`,
};

// ============================================================
// 主 island 组件
// ============================================================
export const AppPromptPreviewIsland = {
    name: 'AppPromptPreviewIsland',
    components: {
        IslandMusicPreview,
        IslandRedPacketPreview,
        IslandLocationPreview,
        IslandTextPreview,
    },
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
            return this.typeLabel || PREVIEW_TYPE_LABELS[this.previewType] || '卡片';
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
                <island-music-preview v-if="previewType === 'music-card'" :preview-data="previewObject" :label="label" />
                <island-red-packet-preview v-else-if="previewType === 'red-packet-card'" :preview-data="previewObject" :label="label" />
                <island-location-preview v-else-if="previewType === 'location-card'" :preview-data="previewObject" :label="label" />
                <island-text-preview v-else :preview-data="previewObject" :label="label" />
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