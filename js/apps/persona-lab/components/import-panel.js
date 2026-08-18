/**
 * 人设机 · 导入导出
 *
 * 导入:把别处的人设贴进来,变成一张本系统能用的卡。
 * 导出:把人设卡导出为可分享的文本格式。
 */

import { SHARED_COMPONENTS } from './shared.js';
import * as store from '../store.js';
import { listCards, cardToDraftText, resolveApiRef, describeApiRef } from '../services/nook-bridge.js';
import { convertToCardText, createAbort, abort, releaseAbort } from '../services/ai-service.js';
import { describePatch, readName, normalizeCardText } from '../services/card-schema.js';
import { SCOPES } from '../constants.js';

const SAMPLE = `{
  "name": "Lin Qi",
  "description": "23yo, works at a tiny bookstore...",
  "personality": "quiet, observant, dry humor",
  "first_mes": "......你也是来躲雨的?"
}`;

/** 导出格式选项 */
const EXPORT_FORMATS = [
    { id: 'yaml', label: 'YAML' },
    { id: 'json', label: 'JSON' },
    { id: 'markdown', label: 'Markdown' },
    { id: 'text', label: '纯文本' },
];

export const PlImport = {
    name: 'PlImport',
    components: { ...SHARED_COMPONENTS },
    props: { app: { type: Object, required: true } },
    emits: ['open', 'notify', 'back'],
    data() {
        return {
            scope: 'ai',
            SCOPES,
            SAMPLE,
            EXPORT_FORMATS,
            activeMode: 'import',
            exportFormat: 'yaml',
            exportText: '',
            exportCardId: '',
        };
    },
    computed: {
        state() { return store.getState(); },
        source: {
            get() { return this.state.importSource; },
            set(v) { store.setImportSource(v); },
        },
        result: {
            get() { return this.state.importResult; },
            set(v) { store.setImportResult(v); },
        },
        error() { return this.state.importError; },
        busy() { return this.state.busy === 'convert'; },

        api() { return describeApiRef(resolveApiRef()); },

        preview() {
            return this.result.trim() ? describePatch(this.result) : null;
        },

        /** 可导出的卡列表 */
        exportableCards() {
            if (!this.state.nookReady) return [];
            return listCards().map((c) => ({
                ...c,
                label: c.name + (c.scope === 'user' ? ' (用户)' : ' (AI)'),
            }));
        },
    },
    beforeUnmount() {
        abort('convert');
    },
    methods: {
        useSample() {
            this.source = SAMPLE;
        },

        async onConvert() {
            const raw = this.source.trim();
            if (!raw) {
                this.$emit('notify', '先把要转换的人设贴进来');
                return;
            }
            store.setImportError('');
            store.setBusy('convert');
            const signal = createAbort('convert');
            try {
                const res = await convertToCardText({ raw, signal });
                if (res.aborted) {
                    this.$emit('notify', '已停止');
                    return;
                }
                if (!res.ok) {
                    store.setImportError(res.error || '转换失败');
                    return;
                }
                store.setImportResult(normalizeCardText(res.text));
                this.$emit('notify', '转好了，确认一下再存进 nook');
            } finally {
                releaseAbort('convert');
                store.setBusy('');
            }
        },

        onStop() {
            abort('convert');
        },

        async onAdopt() {
            const text = this.result.trim();
            if (!text) return;
            const draft = await store.createDraft({
                scope: this.scope,
                text,
                title: readName(text),
            });
            store.setImportSource('');
            store.setImportResult('');
            this.$emit('notify', '已放进「在改的」，先问她两句试试');
            this.$emit('open', draft.id);
        },

        onSelectExportCard(card) {
            this.exportCardId = card.scope + ':' + card.id;
            const text = cardToDraftText(card.scope, card.id);
            this.exportText = this.formatExport(text);
        },

        formatExport(text) {
            if (!text) return '';
            try {
                const lines = text.trim().split('\n');
                if (this.exportFormat === 'yaml') {
                    return lines.map((l) => l.replace(/^(\s*)/, '$1')).join('\n');
                } else if (this.exportFormat === 'markdown') {
                    return lines.map((l) => l.replace(/^(\s*-\s*)/, '- ')).join('\n');
                } else if (this.exportFormat === 'text') {
                    return lines.map((l) => l.replace(/^[\s*\-:]+/, '').trim()).filter(Boolean).join('\n');
                }
                return text;
            } catch {
                return text;
            }
        },

        onCopyExport() {
            if (!this.exportText) return;
            navigator.clipboard.writeText(this.exportText).then(() => {
                this.$emit('notify', '已复制到剪贴板');
            }).catch(() => {
                this.$emit('notify', '复制失败，请手动选择文本');
            });
        },

        onBack() {
            this.$emit('back');
        },
    },
    template: `
        <div class="pl-import">
            <!-- 顶部导航 -->
            <header class="pl-import-header">
                <button type="button" class="pl-import-back" @click="onBack">
                    <PlIcon name="back" />
                </button>
                <h1>导入导出</h1>
            </header>

            <!-- 模式切换 -->
            <div class="pl-import-tabs">
                <button
                    type="button"
                    class="pl-import-tab"
                    :class="{ 'is-active': activeMode === 'import' }"
                    @click="activeMode = 'import'"
                >
                    <PlIcon name="import" />
                    <span>导入</span>
                </button>
                <button
                    type="button"
                    class="pl-import-tab"
                    :class="{ 'is-active': activeMode === 'export' }"
                    @click="activeMode = 'export'"
                >
                    <PlIcon name="export" />
                    <span>导出</span>
                </button>
            </div>

            <!-- 导入模式 -->
            <div v-if="activeMode === 'import'" class="pl-import-content">
                <section class="pl-import-section">
                    <div class="pl-import-section-head">
                        <span class="pl-import-section-title">原始人设</span>
                        <button type="button" class="pl-import-sample-btn" @click="useSample">使用示例</button>
                    </div>
                    <textarea
                        v-model="source"
                        class="pl-import-textarea"
                        rows="8"
                        placeholder="把人设粘贴到这里..."
                    ></textarea>
                </section>

                <section class="pl-import-api">
                    <PlIcon name="key" />
                    <span class="pl-import-api-label" :data-ok="api.ok ? '1' : '0'">{{ api.label }}</span>
                    <span v-if="api.sub" class="pl-import-api-sub">{{ api.sub }}</span>
                </section>

                <button
                    v-if="busy"
                    type="button"
                    class="pl-import-action"
                    @click="onStop"
                >
                    <span class="pl-import-action-spin"></span>
                    <span>停止</span>
                </button>
                <button
                    v-else
                    type="button"
                    class="pl-import-action pl-import-action--primary"
                    :disabled="!source.trim()"
                    @click="onConvert"
                >
                    <PlIcon name="heart" />
                    <span>转换为人设卡</span>
                </button>

                <p v-if="error" class="pl-import-error">{{ error }}</p>

                <!-- 转换结果 -->
                <section v-if="result.trim()" class="pl-import-section pl-import-result">
                    <div class="pl-import-section-head">
                        <span class="pl-import-section-title">转换结果</span>
                        <span v-if="preview" class="pl-import-preview-hint">识别到 {{ preview.filled }} 个字段</span>
                    </div>
                    <textarea v-model="result" class="pl-import-textarea pl-import-textarea--result" rows="10"></textarea>

                    <div v-if="preview" class="pl-import-patch">
                        <p class="pl-import-patch-head">存进 nook 后会变成：</p>
                        <ul class="pl-import-patch-list">
                            <li v-for="row in preview.rows" :key="row.key">
                                <span class="pl-import-patch-key">{{ row.label }}</span>
                                <span class="pl-import-patch-val">{{ row.display.join(' / ') }}</span>
                            </li>
                        </ul>
                    </div>

                    <div class="pl-import-scope">
                        <span class="pl-import-scope-label">存成</span>
                        <PlSegmented v-model="scope" :items="SCOPES" />
                    </div>

                    <button
                        type="button"
                        class="pl-import-action pl-import-action--primary"
                        @click="onAdopt"
                    >
                        <PlIcon name="check" />
                        <span>放入「在改的」</span>
                    </button>
                </section>
            </div>

            <!-- 导出模式 -->
            <div v-if="activeMode === 'export'" class="pl-import-content">
                <section class="pl-import-section">
                    <div class="pl-import-section-head">
                        <span class="pl-import-section-title">选择人设卡</span>
                    </div>
                    <div class="pl-import-card-list">
                        <button
                            v-for="card in exportableCards"
                            :key="card.scope + ':' + card.id"
                            type="button"
                            class="pl-import-card-item"
                            :class="{ 'is-selected': exportCardId === (card.scope + ':' + card.id) }"
                            @click="onSelectExportCard(card)"
                        >
                            <PlAvatar :name="card.name" :tone="card.id" :scope="card.scope" size="sm" />
                            <span class="pl-import-card-name">{{ card.name }}</span>
                            <span class="pl-import-card-scope">{{ card.scope === 'user' ? '用户' : 'AI' }}</span>
                        </button>
                    </div>
                </section>

                <section class="pl-import-section">
                    <div class="pl-import-section-head">
                        <span class="pl-import-section-title">导出格式</span>
                    </div>
                    <PlSegmented v-model="exportFormat" :items="EXPORT_FORMATS" />
                </section>

                <section v-if="exportCardId" class="pl-import-section">
                    <div class="pl-import-section-head">
                        <span class="pl-import-section-title">导出内容</span>
                        <button
                            type="button"
                            class="pl-import-copy-btn"
                            @click="onCopyExport"
                        >
                            <PlIcon name="copy" />
                            <span>复制</span>
                        </button>
                    </div>
                    <textarea
                        :value="exportText"
                        class="pl-import-textarea"
                        rows="12"
                        readonly
                    ></textarea>
                </section>

                <div v-if="!exportCardId" class="pl-import-hint">
                    <PlIcon name="empty" />
                    <span>请先选择要导出的人设卡</span>
                </div>
            </div>
        </div>
    `,
};

export default PlImport;
