/**
 * 梦境编织 · 章节信息管理 + 聊天背景
 *
 * 章节信息 1:1 复原原版 `showChapterInfoManager`(17335)—— **四个 tab**,
 * 不是我上一轮以为的三个:
 *
 *   梗概      本章内容梗概 + AI 生成
 *   角色视角  每个角色在本章经历了什么(可 AI 生成),IF 线会读它
 *   场景/角色 本章出场的角色和场景
 *   上下文    这一章进 prompt 时用全文还是只用梗概
 *
 * 「上下文」那个 tab 是最容易被忽略但最有用的一个:书写长了之后,
 * 前面几十章全文进上下文会把 token 吃光,把它们切成「只用梗概」是唯一的解法。
 */

import * as store from '../store.js';
import { DwModal } from './dw-modal.js';
import { SHARED_COMPONENTS } from './shared.js';
import { generate } from '../services/ai-service.js';
import { createAbort, abort, releaseAbort } from '../services/ai-service.js';
import { resolveCharacterName } from '../services/prompt-builder.js';
import { estimateTokens } from '@/src/core/context-composer.js';
import { htmlToText, findById, truncate } from '../utils.js';

const BASE = { DwModal, ...SHARED_COMPONENTS };
const GEN_SCOPE = '__chapterinfo__';

const TABS = [
    { id: 'summary', label: '梗概' },
    { id: 'character-view', label: '角色视角' },
    { id: 'scene-char', label: '场景/角色' },
    { id: 'context', label: '上下文' },
];

export const DwChapterInfoModal = {
    name: 'DwChapterInfoModal',
    components: BASE,
    props: {
        payload: { type: Object, default: () => ({}) },
    },
    emits: ['close', 'notify'],
    data() {
        return {
            tab: 'summary',
            busy: false,
            editingIndex: -1,
            draftCharacterId: '',
            draftSummary: '',
        };
    },
    computed: {
        chapterId() { return this.payload.chapterId || store.getState().openChapterId; },
        chapter() { return findById(store.getState().chapters, this.chapterId); },
        book() { return store.getOpenBook(); },
        info() { return store.getChapterInfo(this.chapterId) || {}; },
        tabs() { return TABS; },

        bodyText() {
            if (!this.chapter) return '';
            return this.chapter.messages
                .filter((m) => m.role !== 'note')
                .map((m) => htmlToText(m.content))
                .join('\n\n');
        },
        fullTokens() { return estimateTokens(this.bodyText); },
        summaryTokens() { return estimateTokens(this.info.summary || ''); },
        saved() { return Math.max(0, this.fullTokens - this.summaryTokens); },

        characters() { return this.book?.characters || []; },
        /** 添加视角时只列还没添加过的角色 */
        availableCharacters() {
            const used = new Set((this.info.characterViews || []).map((v) => String(v.characterId)));
            return this.characters.filter((c) => !used.has(String(c.id)));
        },
        characterOptions() {
            return [
                { id: '', label: '选择角色' },
                ...this.availableCharacters.map((c) => ({ id: c.id, label: this.nameOf(c) })),
            ];
        },
        editing() {
            return this.editingIndex >= 0 ? this.info.characterViews?.[this.editingIndex] : null;
        },
        appearing() {
            const ids = new Set((this.info.appearingCharacters || []).map(String));
            return this.characters.filter((c) => ids.has(String(c.id)));
        },
    },
    methods: {
        nameOf(c) { return resolveCharacterName(c) || '(未命名)'; },
        preview(text) { return truncate(text, 30); },

        // ── 梗概 ──────────────────────────
        onSummaryInput(value) {
            store.updateChapterInfo(this.chapterId, { summary: value });
        },

        async onGenerateSummary() {
            const content = this.bodyText;
            if (content.replace(/\s/g, '').length < 50) {
                this.$emit('notify', '本章内容太少,先写点东西再生成');
                return;
            }
            const text = await this.runAi(
                `请为以下小说章节内容生成一段简洁的梗概(50-150 字),概括主要事件、角色行动和关键转折。只输出梗概本身,不要「本章讲述了」这类开头。\n\n${truncate(content, 3000)}`,
            );
            if (!text) return;
            // 模型爱给梗概加引号/书名号,去掉
            const clean = text.replace(/^[「『"'《]+|[」』"'》]+$/g, '').slice(0, 200);
            store.updateChapterInfo(this.chapterId, { summary: clean });
            this.$emit('notify', '梗概已生成');
        },

        // ── 角色视角 ──────────────────────
        onStartAdd() {
            this.editingIndex = -2;   // -2 = 新增态
            this.draftCharacterId = this.availableCharacters[0]?.id || '';
            this.draftSummary = '';
        },
        onStartEdit(index) {
            this.editingIndex = index;
            const view = this.info.characterViews[index];
            this.draftCharacterId = view.characterId;
            this.draftSummary = view.summary || '';
        },
        onCancelEdit() {
            this.editingIndex = -1;
            this.draftSummary = '';
        },
        onSaveView() {
            const summary = this.draftSummary.trim();
            if (this.editingIndex === -2) {
                const character = findById(this.characters, this.draftCharacterId);
                if (!character) { this.$emit('notify', '先选一个角色'); return; }
                store.addCharacterView(this.chapterId, {
                    characterId: character.id,
                    characterName: this.nameOf(character),
                    tone: character.tone || '',
                    summary,
                });
            } else if (this.editingIndex >= 0) {
                store.updateCharacterView(this.chapterId, this.editingIndex, { summary });
            }
            this.onCancelEdit();
        },
        onDeleteView(index) {
            store.removeCharacterView(this.chapterId, index);
            if (this.editingIndex === index) this.onCancelEdit();
        },

        async onGenerateView() {
            const content = this.bodyText;
            if (content.replace(/\s/g, '').length < 50) {
                this.$emit('notify', '本章内容太少');
                return;
            }
            const character = findById(this.characters, this.draftCharacterId);
            if (!character) { this.$emit('notify', '先选一个角色'); return; }
            const name = this.nameOf(character);
            const brief = character.description ? `角色简介:${character.description}\n\n` : '';

            const text = await this.runAi(
                `请从角色【${name}】的视角,为以下小说章节生成一段梗概(80-150 字)。\n` +
                `要求:描述该角色在本章中经历了什么、看到了什么、内心的感受和想法变化。只输出梗概本身。\n\n` +
                `${brief}章节内容:\n${truncate(content, 2500)}`,
            );
            if (text) this.draftSummary = text;
        },

        // ── 场景 / 出场角色 ────────────────
        toggleAppearing(character) {
            const list = (this.info.appearingCharacters || []).map(String);
            const id = String(character.id);
            const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
            store.updateChapterInfo(this.chapterId, { appearingCharacters: next });
        },
        isAppearing(character) {
            return (this.info.appearingCharacters || []).map(String).includes(String(character.id));
        },
        onManageCharacters() {
            store.openModal('characters', { bookId: this.book.id });
        },
        onManageLocations() {
            store.openModal('locations', { bookId: this.book.id });
        },

        // ── 上下文模式 ────────────────────
        setContextMode(mode) {
            store.updateChapterInfo(this.chapterId, { contextMode: mode });
        },

        // ── AI 公共 ───────────────────────
        async runAi(instruction) {
            if (this.busy) return '';
            this.busy = true;
            const signal = createAbort(GEN_SCOPE);
            let result;
            try {
                result = await generate({
                    book: this.book,
                    orderedChapters: store.getOrderedChapters(),
                    chapter: this.chapter,
                    library: store.getState().library,
                    kind: 'chapter-info',
                    payload: { content: instruction },
                    input: instruction,
                    overrideUserTurn: instruction,
                    temperature: 0.5,   // 梗概要稳,不要发挥
                    stream: false,
                    signal,
                });
            } catch (err) {
                result = { ok: false, error: err?.message || String(err) };
            } finally {
                releaseAbort(GEN_SCOPE);
                this.busy = false;
            }
            if (!result.ok) {
                if (!result.aborted) this.$emit('notify', result.error || '生成失败');
                return '';
            }
            return result.text.trim();
        },
        onClose() {
            if (this.busy) abort(GEN_SCOPE);
            this.$emit('close');
        },
    },
    beforeUnmount() {
        if (this.busy) abort(GEN_SCOPE);
    },
    template: `
        <DwModal class="dw-cim-modal" title="章节信息" :subtitle="chapter ? chapter.title : ''" max-width="360px" @close="onClose">
            <div class="cim-tabs">
                <button
                    v-for="t in tabs"
                    :key="t.id"
                    type="button"
                    class="cim-tab"
                    :class="{ active: tab === t.id }"
                    @click="tab = t.id"
                >{{ t.label }}</button>
            </div>

            <!-- 梗概 -->
            <section v-if="tab === 'summary'" class="cim-panel">
                <DwField label="本章内容梗概" hint="50-200 字。设成「只用梗概」后,这一章进上下文时就只发这一段。">
                    <DwTextarea
                        :model-value="info.summary"
                        :rows="6"
                        placeholder="这一章发生了什么…"
                        @update:model-value="onSummaryInput"
                    />
                </DwField>
                <button type="button" class="cim-btn cim-btn-primary" :disabled="busy" @click="onGenerateSummary">
                    <DwIcon name="sparkle" />{{ busy ? '生成中…' : 'AI 生成梗概' }}
                </button>
                <p class="cim-hint">正文 {{ fullTokens }} tokens,梗概 {{ summaryTokens }} tokens,能省 {{ saved }}。</p>
            </section>

            <!-- 角色视角 -->
            <section v-else-if="tab === 'character-view'" class="cim-panel">
                <template v-if="editingIndex === -1">
                    <p class="cim-hint">记下每个角色在本章经历了什么。IF 线推演时会读这些。</p>
                    <DwEmpty
                        v-if="!info.characterViews || info.characterViews.length === 0"
                        icon-name="user"
                        title="还没有角色视角"
                        text="加一条,或者让 AI 从正文里提。"
                        action-label="添加"
                        @action="onStartAdd"
                    />
                    <div v-else class="cim-char-list">
                        <div v-for="(view, i) in info.characterViews" :key="i" class="cim-char-item">
                            <span class="cim-char-avatar" :data-tone="view.tone || null">{{ (view.characterName || '角').charAt(0) }}</span>
                            <div class="cim-char-main">
                                <p class="cim-char-name">{{ view.characterName || '未知角色' }}</p>
                                <p class="cim-char-sub">{{ preview(view.summary) || '暂无记录' }}</p>
                            </div>
                            <button type="button" class="dw-nav-icon-btn" aria-label="编辑" @click="onStartEdit(i)"><DwIcon name="edit" /></button>
                            <button type="button" class="dw-nav-icon-btn" aria-label="删除" @click="onDeleteView(i)"><DwIcon name="trash" /></button>
                        </div>
                    </div>
                    <button v-if="info.characterViews && info.characterViews.length" type="button" class="cim-btn cim-btn-secondary" @click="onStartAdd">
                        <DwIcon name="plus" />添加角色视角
                    </button>
                </template>

                <template v-else>
                    <button type="button" class="dw-modal-back" @click="onCancelEdit"><DwIcon name="chevronLeft" />返回列表</button>
                    <DwField v-if="editingIndex === -2" label="角色">
                        <DwSelect v-model="draftCharacterId" :options="characterOptions" />
                    </DwField>
                    <p v-else class="cim-editing-name">{{ editing ? editing.characterName : '' }}</p>
                    <DwField label="这一章他经历了什么">
                        <DwTextarea v-model="draftSummary" :rows="5" placeholder="看到了什么、想了什么、有什么变化" />
                    </DwField>
                    <button type="button" class="cim-btn cim-btn-secondary" :disabled="busy" @click="onGenerateView">
                        <DwIcon name="sparkle" />{{ busy ? '生成中…' : 'AI 生成' }}
                    </button>
                    <button type="button" class="cim-btn cim-btn-primary" @click="onSaveView">保存</button>
                </template>
            </section>

            <!-- 场景 / 角色 -->
            <section v-else-if="tab === 'scene-char'" class="cim-panel">
                <p class="cim-hint">勾上本章出场的角色。勾了之后生成时 AI 会更清楚这一章该有谁。</p>
                <DwEmpty
                    v-if="characters.length === 0"
                    icon-name="user"
                    title="这本书还没有角色"
                    action-label="去建一个"
                    @action="onManageCharacters"
                />
                <div v-else class="cim-appear-grid">
                    <button
                        v-for="c in characters"
                        :key="c.id"
                        type="button"
                        class="cim-appear-chip"
                        :class="{ active: isAppearing(c) }"
                        :data-tone="c.tone || null"
                        @click="toggleAppearing(c)"
                    >{{ nameOf(c) }}</button>
                </div>
                <DwRow label="管理角色" icon-name="user" chevron @click="onManageCharacters" />
                <DwRow label="管理地点" icon-name="location" chevron @click="onManageLocations" />
            </section>

            <!-- 上下文 -->
            <section v-else class="cim-panel">
                <p class="cim-hint">这一章被后面的章节当上下文读取时,用哪一种。</p>
                <button
                    type="button"
                    class="cim-mode-option"
                    :class="{ active: info.contextMode !== 'summary' }"
                    @click="setContextMode('full')"
                >
                    <span class="cim-mode-radio"></span>
                    <span class="cim-mode-main">
                        <span class="cim-mode-title">全文</span>
                        <span class="cim-mode-sub">完整正文,约 {{ fullTokens }} tokens</span>
                    </span>
                </button>
                <button
                    type="button"
                    class="cim-mode-option"
                    :class="{ active: info.contextMode === 'summary' }"
                    :disabled="!info.summary"
                    @click="setContextMode('summary')"
                >
                    <span class="cim-mode-radio"></span>
                    <span class="cim-mode-main">
                        <span class="cim-mode-title">只用梗概</span>
                        <span class="cim-mode-sub">
                            <template v-if="info.summary">约 {{ summaryTokens }} tokens,省 {{ saved }}</template>
                            <template v-else>要先在「梗概」里写一段</template>
                        </span>
                    </span>
                </button>
            </section>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-primary" @click="onClose">完成</button>
            </template>
        </DwModal>
    `,
};

// ============================================================
// 聊天背景
// ============================================================

/**
 * 1:1 复原原版 `showBackgroundSettingModal`(29579)+ `applyCustomBackground`(5893)。
 *
 * 三种类型:纯色 / 图片(带遮罩透明度)/ 毛玻璃(模糊 + 透明度)。
 * 优先级本书 → 全局,和原版一致;但原版从编辑器进来时**只写本书**,
 * 没有「设为全局」的口子 —— 这里补了一个作用域切换,不然全局那层永远设不了。
 */
export const DwBackgroundModal = {
    name: 'DwBackgroundModal',
    components: BASE,
    props: {
        payload: { type: Object, default: () => ({}) },
    },
    emits: ['close', 'notify'],
    data() {
        const bookId = this.payload.bookId || store.getState().openBookId;
        const book = findById(store.getState().books, bookId);
        const current = book?.customBackground || store.getState().library.settings.customBackground || { type: 'none' };
        return {
            bookId,
            // 默认写本书 —— 是从某本书里进来的,"设背景"最自然的意思就是给这本书设。
            // (原版根本没有全局这一档,从编辑器进来永远写 book.customBackground。)
            scope: 'book',
            type: current.type || 'none',
            color: current.color || '',
            imageUrl: current.imageUrl || '',
            opacity: Number(current.opacity) || 30,
            glassBlur: Number(current.glassBlur) || 10,
            glassOpacity: Math.round((Number(current.glassOpacity) || 0.1) * 100),
            error: '',
        };
    },
    mounted() {
        // 色板要一个具体的 hex 当初值,不能塞 `var(--dw-bg)` —— <input type=color> 只认 hex。
        // 所以从当前主题实际算出来的背景色里取,而不是在 JS 里写死一个。
        if (!this.color) {
            const shell = this.$el?.closest?.('.app-shell') || document.querySelector('.app-shell[data-app-id="dream-weaver"]');
            if (shell) {
                const raw = getComputedStyle(shell).getPropertyValue('--dw-bg').trim();
                if (/^#[0-9a-f]{6}$/i.test(raw)) this.color = raw;
            }
        }
    },
    computed: {
        scopeOptions() {
            return [
                { id: 'book', label: '仅这本书' },
                { id: 'global', label: '全部书' },
            ];
        },
        typeOptions() {
            return [
                { id: 'none', label: '纯色' },
                { id: 'image', label: '图片' },
                { id: 'glass', label: '毛玻璃' },
            ];
        },
        config() {
            if (this.type === 'image') {
                return this.imageUrl ? { type: 'image', imageUrl: this.imageUrl, opacity: this.opacity } : null;
            }
            if (this.type === 'glass') {
                return { type: 'glass', glassBlur: this.glassBlur, glassOpacity: this.glassOpacity / 100 };
            }
            return this.color ? { type: 'none', color: this.color } : null;
        },
    },
    methods: {
        async onPickImage(event) {
            const file = event.target.files?.[0];
            if (!file) return;
            // base64 背景图会跟着书一起存进 IndexedDB,几 MB 的图会让每次读书都变慢
            if (file.size > 4 * 1024 * 1024) {
                this.error = '图片超过 4MB,压一下再传(它会跟着这本书一起存)';
                return;
            }
            this.error = '';
            try {
                this.imageUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(file);
                });
                this.type = 'image';
            } catch (err) {
                this.error = `读取失败:${err?.message || err}`;
            }
        },
        onSave() {
            const config = this.config;
            if (!config) {
                this.$emit('notify', this.type === 'image' ? '先选一张图' : '先选一个颜色');
                return;
            }
            store.setBackground(this.scope, this.bookId, config);
            this.$emit('notify', this.scope === 'book' ? '已设为这本书的背景' : '已设为全局背景');
            this.$emit('close');
        },
        onReset() {
            store.setBackground(this.scope, this.bookId, null);
            this.$emit('notify', '已恢复默认');
            this.$emit('close');
        },
    },
    template: `
        <DwModal class="dw-bg-modal" title="聊天背景" max-width="330px" @close="$emit('close')">
            <DwField label="作用范围">
                <DwSegmented v-model="scope" :options="scopeOptions" />
            </DwField>

            <DwField label="类型">
                <DwSegmented v-model="type" :options="typeOptions" />
            </DwField>

            <template v-if="type === 'none'">
                <DwField label="颜色">
                    <input type="color" class="dw-bg-color" :value="color" aria-label="背景色" @input="color = $event.target.value" />
                </DwField>
            </template>

            <template v-else-if="type === 'image'">
                <label class="dw-font-pick">
                    <input type="file" accept="image/*" @change="onPickImage" />
                    <span>{{ imageUrl ? '换一张图' : '选择图片' }}</span>
                </label>
                <div v-if="imageUrl" class="dw-bg-preview" :style="{ backgroundImage: 'url(' + imageUrl + ')' }">
                    <span class="dw-bg-preview-mask" :style="{ opacity: 1 - opacity / 100 }"></span>
                    <span class="dw-bg-preview-text">正文大概长这样</span>
                </div>
                <DwField label="图片清晰度" hint="调低会盖一层底色,正文更好读">
                    <DwSlider v-model="opacity" :min="10" :max="100" suffix="%" />
                </DwField>
            </template>

            <template v-else>
                <DwField label="模糊">
                    <DwSlider v-model="glassBlur" :min="0" :max="30" suffix="px" />
                </DwField>
                <DwField label="遮罩浓度">
                    <DwSlider v-model="glassOpacity" :min="5" :max="50" suffix="%" />
                </DwField>
            </template>

            <p v-if="error" class="dw-modal-error">{{ error }}</p>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-danger" @click="onReset">恢复默认</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </DwModal>
    `,
};

export const CHAPTER_INFO_MODAL_COMPONENTS = { DwChapterInfoModal, DwBackgroundModal };
