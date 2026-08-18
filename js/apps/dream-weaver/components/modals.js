/**
 * 梦境编织 · 弹窗
 *
 * 全部用 `DwModal`(`components/dw-modal.js`)—— 它在框架 `AcModal` 之上固化了
 * 本 App 的弹窗规矩:**点遮罩关闭、不要右上角的叉、暖色调、高度按手机壳算**。
 *
 * ★ 两条硬约束(踩过的坑,别再踩):
 *   1. `class` 会一路透传到**根元素 `.ac-overlay`**,不是 `.ac-modal`。
 *      业务钩子一律写后代选择器:`.dw-book-modal .ac-modal-body` ✓
 *   2. 不要自绘遮罩,DwModal / AcModal 自带。
 *
 * 弹窗状态机在 store:`STATE.modal = { type, payload }`,根组件按 type 分发。
 * 好处是任何地方都能 `store.openModal('confirm', {...})`,不需要层层传 emit。
 */

import { DwModal } from './dw-modal.js';
import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import {
    COVER_TONES, POV_OPTIONS, VIEWPOINT_OPTIONS,
} from '../constants.js';
import { findById, formatRelative, truncate, countWords, formatNumber } from '../utils.js';
import { resolveCharacterName, buildPrompt } from '../services/prompt-builder.js';
import { validateRule, testRule, previewRule } from '../services/format-service.js';
import { estimateTokens } from '@/src/core/context-composer.js';
import { buildChapterBranchTree, countChapterForks } from '../services/branch-tree.js';

const BASE = { DwModal, ...SHARED_COMPONENTS };

/** 所有弹窗共用:标准 footer(取消 + 主按钮) */
const FooterMixin = {
    props: {
        payload: { type: Object, default: () => ({}) },
    },
    emits: ['close'],
};

// ============================================================
// 通用:确认 / 单字段
// ============================================================

export const DwConfirmModal = {
    name: 'DwConfirmModal',
    components: BASE,
    mixins: [FooterMixin],
    methods: {
        onConfirm() {
            const fn = this.payload.onConfirm;
            this.$emit('close');
            // 先关再跑:handler 里可能又要开一个弹窗,不先关会被自己覆盖掉
            if (typeof fn === 'function') fn();
        },
    },
    template: `
        <DwModal class="dw-confirm-modal" :title="payload.title || '确认'" max-width="300px" @close="$emit('close')">
            <p class="dw-modal-text">{{ payload.message }}</p>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">{{ payload.cancelLabel || '取消' }}</button>
                <button type="button" class="ac-btn" :class="payload.danger ? 'ac-btn-danger' : 'ac-btn-primary'" @click="onConfirm">
                    {{ payload.confirmLabel || '确定' }}
                </button>
            </template>
        </DwModal>
    `,
};

export const DwRenameModal = {
    name: 'DwRenameModal',
    components: BASE,
    mixins: [FooterMixin],
    data() {
        return { value: String(this.payload.value || '') };
    },
    methods: {
        onSubmit() {
            const next = this.value.trim();
            const fn = this.payload.onSubmit;
            this.$emit('close');
            if (typeof fn === 'function') fn(next);
        },
    },
    template: `
        <DwModal class="dw-rename-modal" :title="payload.title || '重命名'" max-width="320px" @close="$emit('close')">
            <DwInput v-model="value" :placeholder="payload.placeholder || ''" @enter="onSubmit" />
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onSubmit">保存</button>
            </template>
        </DwModal>
    `,
};

// ============================================================
// 书籍
// ============================================================

export const DwBookModal = {
    name: 'DwBookModal',
    components: BASE,
    mixins: [FooterMixin],
    data() {
        const book = this.payload.mode === 'edit' ? findById(store.getState().books, this.payload.bookId) : null;
        return {
            isEdit: this.payload.mode === 'edit',
            bookId: book?.id || '',
            title: book?.title || '',
            author: book?.author || '',
            synopsis: book?.synopsis || '',
            coverTone: book?.coverTone || COVER_TONES[0].id,
            worldId: book?.worldId || '',
            customWorldName: book?.customWorld?.name || '',
            customWorldDesc: book?.customWorld?.description || '',
        };
    },
    computed: {
        worldOptions() {
            const list = window.settingsSdk?.worlds?.list?.() || [];
            return [
                { id: '', label: '不绑定(自己填)' },
                ...list.map((w) => ({ id: String(w.id), label: w.name || '未命名世界' })),
            ];
        },
        canSave() {
            return this.title.trim().length > 0;
        },
    },
    methods: {
        async onSave() {
            if (!this.canSave) return;
            const patch = {
                title: this.title.trim(),
                author: this.author.trim(),
                synopsis: this.synopsis.trim(),
                coverTone: this.coverTone,
                worldId: this.worldId || null,
                customWorld: this.worldId
                    ? null
                    : (this.customWorldName || this.customWorldDesc
                        ? { name: this.customWorldName.trim(), description: this.customWorldDesc.trim() }
                        : null),
            };
            const fn = this.payload.onSaved;
            if (this.isEdit) {
                store.updateBook(this.bookId, patch);
                this.$emit('close');
            } else {
                const book = await store.createBook(patch);
                this.$emit('close');
                if (typeof fn === 'function') fn(book);
            }
        },
    },
    created() {
        this.COVER_TONES = COVER_TONES;
    },
    template: `
        <DwModal class="dw-book-modal" :title="isEdit ? '书籍信息' : '新建一本书'" max-width="330px" @close="$emit('close')">
            <DwField label="书名" required>
                <DwInput v-model="title" placeholder="给它起个名字" :maxlength="60" />
            </DwField>
            <DwField label="作者">
                <DwInput v-model="author" placeholder="留空就不显示" :maxlength="40" />
            </DwField>
            <DwField label="封面色">
                <DwToneSwatches v-model="coverTone" :tones="COVER_TONES" />
            </DwField>
            <DwField label="世界观" hint="绑定后会自动读取世界观里的设定">
                <DwSelect v-model="worldId" :options="worldOptions" />
            </DwField>
            <template v-if="!worldId">
                <DwField label="世界名">
                    <DwInput v-model="customWorldName" placeholder="比如 昭明十七年的洛阳" />
                </DwField>
                <DwField label="世界设定">
                    <DwTextarea v-model="customWorldDesc" :rows="3" placeholder="背景、规则、气氛…" />
                </DwField>
            </template>
            <DwField label="故事梗概" hint="会进上下文,让 AI 知道整本书往哪儿走">
                <DwTextarea v-model="synopsis" :rows="4" placeholder="一两段说清这本书讲什么" />
            </DwField>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" :disabled="!canSave" @click="onSave">
                    {{ isEdit ? '保存' : '创建' }}
                </button>
            </template>
        </DwModal>
    `,
};

// ============================================================
// 消息
// ============================================================

export const DwEditMessageModal = {
    name: 'DwEditMessageModal',
    components: BASE,
    mixins: [FooterMixin],
    data() {
        return { value: String(this.payload.value || '') };
    },
    methods: {
        onSave() {
            store.updateMessage(this.payload.chapterId, this.payload.messageId, { content: this.value });
            store.syncCurrentAltContent(this.payload.chapterId, this.payload.messageId);
            this.$emit('close');
        },
    },
    template: `
        <DwModal class="dw-edit-message-modal" title="编辑这一段" max-width="340px" @close="$emit('close')">
            <DwTextarea v-model="value" :rows="12" placeholder="正文…" />
            <p class="dw-modal-hint">改完会覆盖当前这条。其他分支在「分支管理」里。</p>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </DwModal>
    `,
};

export const DwRewriteSelectionModal = {
    name: 'DwRewriteSelectionModal',
    components: BASE,
    mixins: [FooterMixin],
    data() {
        return { hint: '' };
    },
    methods: {
        onRun() {
            const fn = this.payload.onRun;
            const hint = this.hint.trim();
            this.$emit('close');
            if (typeof fn === 'function') fn(hint);
        },
    },
    template: `
        <DwModal title="重写这一句" max-width="320px" @close="$emit('close')">
            <blockquote class="dw-modal-quote">{{ payload.text }}</blockquote>
            <DwField label="想怎么改" hint="留空就让 AI 自由发挥">
                <DwTextarea v-model="hint" :rows="3" placeholder="比如:更克制一点,别那么直白" />
            </DwField>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onRun">重写</button>
            </template>
        </DwModal>
    `,
};

// ============================================================
// 角色 / 地点
// ============================================================

export const DwCharacterModal = {
    name: 'DwCharacterModal',
    components: BASE,
    mixins: [FooterMixin],
    data() {
        const book = findById(store.getState().books, this.payload.bookId);
        const existing = this.payload.id ? findById(book?.characters, this.payload.id) : null;
        const preset = this.payload.preset || {};
        return {
            isEdit: Boolean(existing),
            name: existing?.name || preset.name || '',
            role: existing?.role || '',
            description: existing?.description || '',
            tone: existing?.tone || '',
            birthYear: existing?.birthYear ?? '',
            includeInPrompt: existing ? existing.includeInPrompt !== false : true,
        };
    },
    computed: {
        toneList() {
            return COVER_TONES;
        },
        canSave() {
            return this.name.trim().length > 0;
        },
    },
    methods: {
        onSave() {
            if (!this.canSave) return;
            const patch = {
                type: 'custom',
                name: this.name.trim(),
                role: this.role.trim(),
                description: this.description.trim(),
                tone: this.tone,
                birthYear: this.birthYear === '' ? null : Number(this.birthYear),
                includeInPrompt: this.includeInPrompt,
            };
            if (this.isEdit) store.updateCharacter(this.payload.bookId, this.payload.id, patch);
            else store.addCharacter(this.payload.bookId, patch);
            this.$emit('close');
        },
        onRemove() {
            store.removeCharacter(this.payload.bookId, this.payload.id);
            this.$emit('close');
        },
    },
    template: `
        <DwModal :title="isEdit ? '编辑角色' : '新建角色'" max-width="330px" @close="$emit('close')">
            <DwField label="名字" required>
                <DwInput v-model="name" placeholder="角色名" :maxlength="30" />
            </DwField>
            <DwField label="身份">
                <DwInput v-model="role" placeholder="比如 女主 / 反派 / 师父" :maxlength="30" />
            </DwField>
            <DwField label="设定" hint="性格、外貌、关键经历。会进上下文。">
                <DwTextarea v-model="description" :rows="4" />
            </DwField>
            <DwField label="标记色" hint="正文里这个名字会用这个颜色高亮">
                <DwToneSwatches v-model="tone" :tones="toneList" allow-empty />
            </DwField>
            <DwField label="出生年" hint="填了才能自动算年龄(需要故事时间也是年份格式)">
                <DwInput v-model="birthYear" type="number" placeholder="选填" />
            </DwField>
            <DwRow label="进入上下文" hint="关掉之后 AI 看不到这个角色">
                <template #trailing><DwSwitch v-model="includeInPrompt" label="进入上下文" /></template>
            </DwRow>

            <template #footer>
                <button v-if="isEdit" type="button" class="ac-btn ac-btn-danger" @click="onRemove">删除</button>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" :disabled="!canSave" @click="onSave">保存</button>
            </template>
        </DwModal>
    `,
};

export const DwLocationModal = {
    name: 'DwLocationModal',
    components: BASE,
    mixins: [FooterMixin],
    data() {
        const book = findById(store.getState().books, this.payload.bookId);
        const existing = this.payload.id ? findById(book?.locations, this.payload.id) : null;
        const preset = this.payload.preset || {};
        return {
            isEdit: Boolean(existing),
            name: existing?.name || preset.name || '',
            description: existing?.description || '',
            tone: existing?.tone || '',
            includeInPrompt: existing ? existing.includeInPrompt !== false : true,
        };
    },
    computed: {
        toneList() { return COVER_TONES; },
        canSave() { return this.name.trim().length > 0; },
    },
    methods: {
        onSave() {
            if (!this.canSave) return;
            const patch = {
                name: this.name.trim(),
                description: this.description.trim(),
                tone: this.tone,
                includeInPrompt: this.includeInPrompt,
            };
            if (this.isEdit) store.updateLocation(this.payload.bookId, this.payload.id, patch);
            else store.addLocation(this.payload.bookId, patch);
            this.$emit('close');
        },
        onRemove() {
            store.removeLocation(this.payload.bookId, this.payload.id);
            this.$emit('close');
        },
    },
    template: `
        <DwModal :title="isEdit ? '编辑地点' : '新建地点'" max-width="330px" @close="$emit('close')">
            <DwField label="地名" required><DwInput v-model="name" :maxlength="30" /></DwField>
            <DwField label="描述"><DwTextarea v-model="description" :rows="3" /></DwField>
            <DwField label="标记色"><DwToneSwatches v-model="tone" :tones="toneList" allow-empty /></DwField>
            <DwRow label="进入上下文">
                <template #trailing><DwSwitch v-model="includeInPrompt" label="进入上下文" /></template>
            </DwRow>
            <template #footer>
                <button v-if="isEdit" type="button" class="ac-btn ac-btn-danger" @click="onRemove">删除</button>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" :disabled="!canSave" @click="onSave">保存</button>
            </template>
        </DwModal>
    `,
};

/** 角色/地点列表管理 */
export const DwMarkListModal = {
    name: 'DwMarkListModal',
    components: BASE,
    mixins: [FooterMixin],
    props: {
        kind: { type: String, default: 'characters' },
    },
    computed: {
        book() { return findById(store.getState().books, this.payload.bookId); },
        isCharacters() { return this.kind === 'characters'; },
        items() {
            if (!this.book) return [];
            return this.isCharacters ? this.book.characters : this.book.locations;
        },
    },
    methods: {
        nameOf(item) {
            return this.isCharacters ? (resolveCharacterName(item) || '(未命名)') : (item.name || '(未命名)');
        },
        onAdd() {
            store.openModal(this.isCharacters ? 'character-edit' : 'location-edit', { bookId: this.payload.bookId });
        },
        onEdit(item) {
            store.openModal(this.isCharacters ? 'character-edit' : 'location-edit', {
                bookId: this.payload.bookId,
                id: item.id,
            });
        },
    },
    template: `
        <DwModal class="dw-list-modal" :title="isCharacters ? '角色' : '地点'" max-width="330px" @close="$emit('close')">
            <DwEmpty
                v-if="items.length === 0"
                :icon-name="isCharacters ? 'user' : 'location'"
                :title="isCharacters ? '还没有角色' : '还没有地点'"
                text="在正文里选中一个名字也可以直接建。"
                action-label="新建"
                @action="onAdd"
            />
            <div v-else class="dw-mark-list">
                <DwRow
                    v-for="item in items"
                    :key="item.id"
                    :label="nameOf(item)"
                    :hint="item.role || item.description ? truncate(item.role || item.description, 30) : ''"
                    :value="item.includeInPrompt === false ? '不进上下文' : ''"
                    chevron
                    @click="onEdit(item)"
                />
            </div>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">关闭</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onAdd">新建</button>
            </template>
        </DwModal>
    `,
    created() { this.truncate = truncate; },
};

// ============================================================
// 章节
// ============================================================

export const DwChapterSettingsModal = {
    name: 'DwChapterSettingsModal',
    components: BASE,
    mixins: [FooterMixin],
    data() {
        const chapter = findById(store.getState().chapters, this.payload.chapterId);
        return {
            title: chapter?.title || '',
            pov: chapter?.pov || '',
            povCharacterId: chapter?.povCharacterId || '',
            worldTime: chapter?.worldTime || '',
            summary: chapter?.summary || '',
            useSummary: chapter?.useSummary === true,
            isInnerView: chapter?.isInnerView === true,
        };
    },
    computed: {
        book() { return store.getOpenBook(); },
        povOptions() {
            return [{ id: '', label: '跟随全局' }, ...POV_OPTIONS];
        },
        characterOptions() {
            return [
                { id: '', label: '不限定' },
                ...(this.book?.characters || []).map((c) => ({ id: c.id, label: resolveCharacterName(c) || '(未命名)' })),
            ];
        },
    },
    methods: {
        onSave() {
            store.updateChapter(this.payload.chapterId, {
                title: this.title.trim() || '未命名章节',
                pov: this.pov || null,
                povCharacterId: this.povCharacterId || null,
                worldTime: this.worldTime.trim(),
                summary: this.summary.trim(),
                useSummary: this.useSummary,
                isInnerView: this.isInnerView,
            });
            this.$emit('close');
        },
    },
    created() { this.VIEWPOINT_OPTIONS = VIEWPOINT_OPTIONS; },
    template: `
        <DwModal title="章节设置" max-width="330px" @close="$emit('close')">
            <DwField label="章节名"><DwInput v-model="title" :maxlength="60" /></DwField>
            <DwField label="人称" hint="留空跟随全局设置"><DwSelect v-model="pov" :options="povOptions" /></DwField>
            <DwField label="限定视角角色" hint="只写这个角色能感知到的内容"><DwSelect v-model="povCharacterId" :options="characterOptions" /></DwField>
            <DwField label="故事时间" hint="比如 第三年春 / 2024-03-15"><DwInput v-model="worldTime" /></DwField>
            <DwField label="本章梗概" hint="给后面的章节当前情提要用"><DwTextarea v-model="summary" :rows="3" /></DwField>
            <DwRow label="梗概进入上下文" hint="关掉后这一章不出现在前情提要里">
                <template #trailing><DwSwitch v-model="useSummary" label="梗概进入上下文" /></template>
            </DwRow>
            <DwRow label="标记为内心视角章">
                <template #trailing><DwSwitch v-model="isInnerView" label="内心视角章" /></template>
            </DwRow>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onSave">保存</button>
            </template>
        </DwModal>
    `,
};

// ============================================================
// 时间线事件
// ============================================================

export const DwTimelineEventModal = {
    name: 'DwTimelineEventModal',
    components: BASE,
    mixins: [FooterMixin],
    data() {
        const event = this.payload.event || {};
        return {
            isEdit: this.payload.mode === 'edit',
            time: event.time || '',
            title: event.title || '',
            description: event.description || '',
            bindType: event.bindType || 'none',
            chapterId: event.chapterId || '',
            includeInPrompt: event.includeInPrompt !== false,
        };
    },
    computed: {
        bindOptions() {
            return [
                { id: 'none', label: '不绑定' },
                { id: 'chapter', label: '绑定章节' },
            ];
        },
        chapterOptions() {
            return [
                { id: '', label: '选择章节' },
                ...store.getOrderedChapters().map((c) => ({ id: c.id, label: c.title })),
            ];
        },
        canSave() { return this.title.trim().length > 0; },
    },
    methods: {
        onSave() {
            if (!this.canSave) return;
            const patch = {
                time: this.time.trim(),
                title: this.title.trim(),
                description: this.description.trim(),
                bindType: this.bindType,
                chapterId: this.bindType === 'chapter' ? this.chapterId : null,
                includeInPrompt: this.includeInPrompt,
            };
            if (this.isEdit) store.updateTimelineEvent(this.payload.bookId, this.payload.event.id, patch);
            else store.addTimelineEvent(this.payload.bookId, patch);
            this.$emit('close');
        },
    },
    template: `
        <DwModal :title="isEdit ? '编辑事件' : '新事件'" max-width="330px" @close="$emit('close')">
            <DwField label="发生了什么" required><DwInput v-model="title" placeholder="一句话概括" :maxlength="60" /></DwField>
            <DwField label="故事内时间" hint="随便怎么写,只是标签。顺序在时间线面板里自己上下移。">
                <DwInput v-model="time" placeholder="比如 第三年春" />
            </DwField>
            <DwField label="细节"><DwTextarea v-model="description" :rows="3" /></DwField>
            <DwField label="绑定"><DwSegmented v-model="bindType" :options="bindOptions" /></DwField>
            <DwField v-if="bindType === 'chapter'" label="章节"><DwSelect v-model="chapterId" :options="chapterOptions" /></DwField>
            <DwRow label="进入上下文">
                <template #trailing><DwSwitch v-model="includeInPrompt" label="进入上下文" /></template>
            </DwRow>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button type="button" class="ac-btn ac-btn-primary" :disabled="!canSave" @click="onSave">保存</button>
            </template>
        </DwModal>
    `,
};

// ============================================================
// 输入模式管理
// ============================================================

export const DwInputModesModal = {
    name: 'DwInputModesModal',
    components: BASE,
    mixins: [FooterMixin],
    data() {
        return { editingId: '' };
    },
    computed: {
        library() { return store.getState().library; },
        modes() { return this.library.inputModes; },
        activeIds() { return this.library.activeModeIds; },
        editing() { return findById(this.modes, this.editingId); },
    },
    methods: {
        isActive(mode) { return this.activeIds.includes(String(mode.id)); },
        onToggle(mode) {
            if (!store.toggleActiveMode(mode.id)) {
                this.$emit('notify', this.isActive(mode) ? '至少要留一个模式' : '输入栏最多挂 3 个模式');
            }
        },
        onCreate() {
            const mode = store.addInputMode({
                name: '新模式',
                icon: 'pen',
                placeholder: '输入内容…',
                promptTemplate: '【指令】\n{内容}\n\n请据此生成 {min}-{max} 字的内容。',
                recordOnly: false,
            });
            this.editingId = mode.id;
        },
        onDelete(mode) {
            if (!store.removeInputMode(mode.id)) {
                this.$emit('notify', '预设模式不能删除');
                return;
            }
            if (this.editingId === mode.id) this.editingId = '';
        },
        patch(key, value) {
            store.updateInputMode(this.editingId, { [key]: value });
        },
    },
    emits: ['close', 'notify'],
    template: `
        <DwModal class="dw-modes-modal" title="输入模式" max-width="340px" @close="$emit('close')">
            <template v-if="!editing">
                <p class="dw-modal-hint">勾选的模式会出现在输入栏上方,最多 3 个。</p>
                <div class="dw-mode-list">
                    <div v-for="mode in modes" :key="mode.id" class="dw-mode-row">
                        <DwIcon :name="mode.icon || 'book'" />
                        <div class="dw-mode-row-main">
                            <p class="dw-mode-row-name">
                                {{ mode.name }}
                                <span v-if="mode.isPreset" class="dw-mode-badge">预设</span>
                                <span v-if="mode.recordOnly" class="dw-mode-badge">只记录</span>
                            </p>
                            <p class="dw-mode-row-hint">{{ mode.placeholder }}</p>
                        </div>
                        <DwSwitch :model-value="isActive(mode)" :label="mode.name" @update:model-value="onToggle(mode)" />
                        <button type="button" class="dw-nav-icon-btn" aria-label="编辑" @click="editingId = mode.id"><DwIcon name="edit" /></button>
                    </div>
                </div>
            </template>

            <template v-else>
                <button type="button" class="dw-modal-back" @click="editingId = ''"><DwIcon name="chevronLeft" />返回列表</button>
                <DwField label="名称">
                    <DwInput :model-value="editing.name" :maxlength="8" @update:model-value="patch('name', $event)" />
                </DwField>
                <DwField label="输入框提示">
                    <DwInput :model-value="editing.placeholder" @update:model-value="patch('placeholder', $event)" />
                </DwField>
                <DwField label="提示词模板" hint="{内容} 会替换成你输入的文字,{min}/{max} 是字数区间">
                    <DwTextarea :model-value="editing.promptTemplate" :rows="6" @update:model-value="patch('promptTemplate', $event)" />
                </DwField>
                <DwRow label="只记录,不算正文" hint="像「金句」那样:参与上下文但不计入字数">
                    <template #trailing>
                        <DwSwitch :model-value="editing.recordOnly" label="只记录" @update:model-value="patch('recordOnly', $event)" />
                    </template>
                </DwRow>
                <DwRow v-if="!editing.isPreset" label="删除这个模式" danger @click="onDelete(editing)" />
            </template>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">关闭</button>
                <button v-if="!editing" type="button" class="ac-btn ac-btn-primary" @click="onCreate">新建模式</button>
            </template>
        </DwModal>
    `,
};

// ============================================================
// 正则规则
// ============================================================

/** HTML 模式的现成模板，点一下就填进去，省得从零写 */
const HTML_SNIPPETS = [
    {
        id: 'candy',
        label: '糖果',
        pattern: '\\[糖果\\]',
        html: '<span style="display:inline-flex;align-items:center;gap:2px;vertical-align:-2px;"><svg viewBox="0 0 24 24" width="16" height="16"><ellipse cx="12" cy="12" rx="5" ry="5" fill="#ff7aa2"/><path d="M7 12 3 8v8z" fill="#ffc0d4"/><path d="M17 12l4-4v8z" fill="#ffc0d4"/></svg></span>',
    },
    {
        id: 'heart',
        label: '心',
        pattern: '\\[心\\]',
        html: '<svg viewBox="0 0 24 24" width="15" height="15" style="vertical-align:-2px;"><path d="M12 21s-8-5.3-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 3.5C20 15.7 12 21 12 21z" fill="#e8506e"/></svg>',
    },
    {
        id: 'star',
        label: '星',
        pattern: '\\[星\\]',
        html: '<svg viewBox="0 0 24 24" width="15" height="15" style="vertical-align:-2px;"><path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.7 6.7 19.6l1.1-6L3.4 9.4l6-.8z" fill="#f2b544"/></svg>',
    },
    {
        id: 'tag',
        label: '标签块',
        pattern: '\\[标签:([^\\]]+)\\]',
        html: '<span style="display:inline-block;padding:1px 8px;border-radius:999px;background:rgba(198,40,40,.16);color:#e07070;font-size:.85em;">$1</span>',
    },
    {
        id: 'inner',
        label: '内心独白块',
        pattern: '\\{([^}]+)\\}',
        html: '<span style="display:block;margin:6px 0;padding:6px 10px;border-left:2px solid rgba(150,150,180,.5);color:rgba(190,190,210,.9);font-style:italic;">$1</span>',
    },
    {
        id: 'aside',
        label: '旁白条',
        pattern: '^※\\s*(.+)$',
        html: '<span style="display:block;margin:6px 0;padding:5px 10px;border-radius:6px;background:rgba(120,120,140,.14);color:rgba(200,200,215,.85);font-size:.92em;">$1</span>',
    },
];

export const DwRegexModal = {
    name: 'DwRegexModal',
    components: BASE,
    mixins: [FooterMixin],
    data() {
        return {
            editingId: '',
            sample: '他说“今天不错”，然后（心里却在想别的）。她递过来一颗[糖果]，[标签:关系+1]',
        };
    },
    computed: {
        rules() { return store.getState().library.bubbleRules; },
        editing() { return findById(this.rules, this.editingId); },
        mode() { return this.editing?.mode || 'segment'; },
        validation() {
            if (!this.editing) return { ok: true, error: '' };
            return validateRule(this.editing.pattern, this.editing.flags);
        },
        matches() {
            if (!this.editing || !this.validation.ok) return [];
            return testRule(this.editing.pattern, this.editing.flags, this.sample);
        },
        /** 效果预览：走 segmentContent 同一条路，所见即正文里的样子 */
        previewSegments() {
            if (!this.editing || !this.validation.ok) return [];
            return previewRule(this.editing, this.sample);
        },
        modeOptions() {
            return [
                { id: 'segment', label: '只标记' },
                { id: 'replace', label: '换文字' },
                { id: 'html', label: '画出来' },
            ];
        },
        modeHint() {
            return {
                segment: '匹配到的部分换个样式显示，正文本身不动。',
                replace: '把匹配到的换成另一段文字。用 $1 引用第一个捕获组。',
                html: '把匹配到的换成一小段 HTML —— [糖果] 就能画成一颗真的糖。用 $1 引用捕获组；脚本和事件属性会被自动去掉。',
            }[this.mode];
        },
        kindOptions() {
            return [
                { id: 'dialogue', label: '对话' },
                { id: 'inner', label: '内心' },
                { id: 'aside', label: '旁白' },
            ];
        },
        snippets() { return HTML_SNIPPETS; },
        modeLabel() {
            return { segment: '标记', replace: '替换', html: '绘制' };
        },
    },
    methods: {
        patch(key, value) { store.updateBubbleRule(this.editingId, { [key]: value }); },
        onToggleRule(rule, enabled) { store.updateBubbleRule(rule.id, { enabled }); },
        onCreate() {
            const rule = store.addBubbleRule({ name: '新规则', pattern: '', kind: 'dialogue', mode: 'segment' });
            this.editingId = rule.id;
        },
        onDelete(rule) {
            store.removeBubbleRule(rule.id);
            if (this.editingId === rule.id) this.editingId = '';
        },
        /** 套用一个现成模板：正则和 HTML 一起填，用户改改就能用 */
        useSnippet(s) {
            store.updateBubbleRule(this.editingId, {
                mode: 'html',
                pattern: s.pattern,
                replacement: s.html,
                name: this.editing?.name && this.editing.name !== '新规则' ? this.editing.name : s.label,
            });
        },
    },
    template: `
        <DwModal class="dw-regex-modal" title="正则规则" max-width="340px" @close="$emit('close')">
            <template v-if="!editing">
                <p class="dw-modal-hint">
                    三种用法：<b>只标记</b>把对话/内心/旁白染成不同样式；<b>换文字</b>把「甲」统一改成「乙」；
                    <b>画出来</b>把 <code>[糖果]</code> 这样的记号变成一颗真的糖。AI 输出里带上这些记号也一样生效。
                </p>
                <div class="dw-rule-list">
                    <div v-for="rule in rules" :key="rule.id" class="dw-rule-row">
                        <div class="dw-rule-row-main">
                            <p class="dw-rule-row-name">
                                {{ rule.name }}
                                <em class="dw-rule-mode-tag">{{ modeLabel[rule.mode || 'segment'] }}</em>
                            </p>
                            <code class="dw-rule-row-pattern">{{ rule.pattern || '(空)' }}</code>
                        </div>
                        <DwSwitch
                            :model-value="rule.enabled !== false"
                            :label="rule.name"
                            @update:model-value="onToggleRule(rule, $event)"
                        />
                        <button type="button" class="dw-nav-icon-btn" aria-label="编辑" @click="editingId = rule.id"><DwIcon name="edit" /></button>
                    </div>
                </div>
            </template>

            <template v-else>
                <button type="button" class="dw-modal-back" @click="editingId = ''"><DwIcon name="chevronLeft" />返回列表</button>
                <DwField label="名称"><DwInput :model-value="editing.name" @update:model-value="patch('name', $event)" /></DwField>

                <DwField label="怎么处理" :hint="modeHint">
                    <DwSegmented :model-value="mode" :options="modeOptions" @update:model-value="patch('mode', $event)" />
                </DwField>

                <DwField label="匹配什么" :hint="validation.ok ? (mode === 'segment' ? '第一个捕获组会作为显示内容' : '用 () 括起来的部分可以在下面用 $1 引用') : validation.error">
                    <DwInput :model-value="editing.pattern" placeholder="比如 \\[糖果\\]" @update:model-value="patch('pattern', $event)" />
                </DwField>

                <DwField v-if="mode === 'segment'" label="识别为">
                    <DwSegmented :model-value="editing.kind" :options="kindOptions" @update:model-value="patch('kind', $event)" />
                </DwField>

                <DwField v-else-if="mode === 'replace'" label="替换成">
                    <DwInput :model-value="editing.replacement" placeholder="换成这段文字，可用 $1" @update:model-value="patch('replacement', $event)" />
                </DwField>

                <template v-else>
                    <DwField label="画成什么（HTML）">
                        <DwTextarea :model-value="editing.replacement" :rows="4"
                                    placeholder='<span style="color:#f66">$1</span>'
                                    @update:model-value="patch('replacement', $event)" />
                    </DwField>
                    <div class="dw-rule-snippets">
                        <span class="dw-rule-snippets-label">现成的：</span>
                        <button v-for="s in snippets" :key="s.id" type="button" class="dw-rule-snippet" @click="useSnippet(s)">{{ s.label }}</button>
                    </div>
                </template>

                <DwField label="拿这段试">
                    <DwTextarea v-model="sample" :rows="3" />
                </DwField>

                <!-- 效果预览：和正文里长得一模一样（同一个 segmentContent） -->
                <p class="dw-rule-preview-label">效果预览</p>
                <div class="dw-rule-preview">
                    <p v-if="!validation.ok" class="dw-rule-error">{{ validation.error }}</p>
                    <p v-else-if="matches.length === 0" class="dw-rule-empty">这段样例里没有匹配到</p>
                    <p v-else class="dw-rule-preview-line">
                        <template v-for="(seg, i) in previewSegments" :key="i">
                            <span v-if="seg.type === 'html'" class="dw-seg dw-seg--html" v-html="seg.html"></span>
                            <span v-else-if="seg.type !== 'text'" class="dw-seg" :class="'dw-seg--' + seg.type">{{ seg.text }}</span>
                            <template v-else>{{ seg.text }}</template>
                        </template>
                    </p>
                    <p v-if="validation.ok && matches.length" class="dw-rule-preview-count">命中 {{ matches.length }} 处</p>
                </div>

                <DwRow v-if="!editing.builtin" label="删除这条规则" danger @click="onDelete(editing)" />
            </template>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">关闭</button>
                <button v-if="!editing" type="button" class="ac-btn ac-btn-primary" @click="onCreate">新建规则</button>
            </template>
        </DwModal>
    `,
};

// ============================================================
// 素材列表(收藏 / 灵感 / 场景 / 生成历史)
// ============================================================

export const DwLibraryListModal = {
    name: 'DwLibraryListModal',
    components: BASE,
    mixins: [FooterMixin],
    props: {
        kind: { type: String, required: true },   // collected | inspirations | scenes | generated
    },
    data() {
        return { draft: '' };
    },
    computed: {
        library() { return store.getState().library; },
        meta() {
            return {
                collected: { title: '收藏的段落', icon: 'starFilled', empty: '在正文里点星标就会收进来' },
                inspirations: { title: '灵感', icon: 'lightbulb', empty: '随手记点想法,回头能翻' },
                scenes: { title: '场景库', icon: 'image', empty: '把常用的场景存下来复用' },
                generated: { title: '生成历史', icon: 'history', empty: '小剧场 / 评论这类生成结果会存在这里' },
            }[this.kind];
        },
        items() {
            if (this.kind === 'collected') return this.library.collected;
            if (this.kind === 'inspirations') return this.library.inspirations;
            if (this.kind === 'scenes') return this.library.scenes;
            return this.library.generatedHistory;
        },
    },
    methods: {
        contentOf(item) {
            return item.content || item.text || item.description || '';
        },
        onRemove(item) {
            if (this.kind === 'collected') store.removeCollected(item.id);
            else if (this.kind === 'inspirations') store.removeInspiration(item.id);
            else if (this.kind === 'scenes') store.removeScene(item.id);
            else store.removeGeneratedRecord(item.id);
        },
        onAdd() {
            const text = this.draft.trim();
            if (!text) return;
            if (this.kind === 'inspirations') store.addInspiration(text);
            else if (this.kind === 'scenes') store.addScene({ name: text.slice(0, 20), description: text });
            this.draft = '';
        },
        async onCopy(item) {
            try {
                await navigator.clipboard.writeText(this.contentOf(item));
                this.$emit('notify', '已复制');
            } catch (_) { /* 剪贴板不可用就算了,不值得打扰用户 */ }
        },
    },
    emits: ['close', 'notify'],
    created() { this.formatRelative = formatRelative; },
    template: `
        <DwModal class="dw-library-modal" :title="meta.title" max-width="340px" @close="$emit('close')">
            <div v-if="kind === 'inspirations' || kind === 'scenes'" class="dw-library-add">
                <DwInput v-model="draft" :placeholder="kind === 'inspirations' ? '记一句…' : '场景描述…'" @enter="onAdd" />
                <DwButton variant="primary" size="sm" icon-name="plus" icon-only label="添加" @click="onAdd" />
            </div>

            <DwEmpty v-if="items.length === 0" :icon-name="meta.icon" :title="meta.title + '还是空的'" :text="meta.empty" />

            <ul v-else class="dw-library-list">
                <li v-for="item in items" :key="item.id" class="dw-library-item">
                    <div class="dw-library-item-main">
                        <p v-if="item.name || item.title" class="dw-library-item-title">{{ item.name || item.title }}</p>
                        <p class="dw-library-item-text">{{ contentOf(item) }}</p>
                        <p class="dw-library-item-time">{{ formatRelative(item.createdAt) }}</p>
                    </div>
                    <div class="dw-library-item-actions">
                        <button type="button" class="dw-nav-icon-btn" aria-label="复制" @click="onCopy(item)"><DwIcon name="copy" /></button>
                        <button type="button" class="dw-nav-icon-btn" aria-label="删除" @click="onRemove(item)"><DwIcon name="trash" /></button>
                    </div>
                </li>
            </ul>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">关闭</button>
            </template>
        </DwModal>
    `,
};

// ============================================================
// 生成提示词
// ============================================================

export const DwGenerationPromptsModal = {
    name: 'DwGenerationPromptsModal',
    components: BASE,
    mixins: [FooterMixin],
    computed: {
        prompts() { return store.getState().library.settings.generationPrompts; },
        typeList() {
            return [
                { id: 'continue', label: '继续创作' },
                { id: 'reroll', label: '重新生成' },
                { id: 'expand', label: '扩写' },
                { id: 'dialog', label: '对话' },
                { id: 'scene', label: '场景' },
            ];
        },
    },
    methods: {
        patchBase(value) {
            store.updateSettings({ generationPrompts: { ...this.prompts, basePrompt: value } });
        },
        patchType(typeId, value) {
            store.updateSettings({
                generationPrompts: {
                    ...this.prompts,
                    typePrompts: { ...this.prompts.typePrompts, [typeId]: value },
                },
            });
        },
    },
    template: `
        <DwModal title="生成提示词" max-width="340px" @close="$emit('close')">
            <p class="dw-modal-hint">这些会拼进「系统指令」那一段。改完可以去上下文面板确认效果。</p>
            <DwField label="基础提示词">
                <DwTextarea :model-value="prompts.basePrompt" :rows="4" @update:model-value="patchBase" />
            </DwField>
            <DwField v-for="type in typeList" :key="type.id" :label="type.label">
                <DwTextarea :model-value="prompts.typePrompts[type.id]" :rows="2" @update:model-value="patchType(type.id, $event)" />
            </DwField>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-primary" @click="$emit('close')">完成</button>
            </template>
        </DwModal>
    `,
};

// ============================================================
// 字体导入
// ============================================================

export const DwFontModal = {
    name: 'DwFontModal',
    components: BASE,
    mixins: [FooterMixin],
    data() {
        return { busy: false, error: '' };
    },
    computed: {
        current() { return store.getState().library.settings.customFont; },
    },
    methods: {
        async onPick(event) {
            const file = event.target.files?.[0];
            if (!file) return;
            // 字体会以 base64 存进 IndexedDB,几 MB 的字体会让每次读设置都变慢
            if (file.size > 8 * 1024 * 1024) {
                this.error = '字体文件超过 8MB,换一个小一点的';
                return;
            }
            this.busy = true;
            this.error = '';
            try {
                const data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(file);
                });
                store.updateSettings({
                    customFont: { name: file.name.replace(/\.[^.]+$/, ''), data },
                });
                this.$emit('close');
            } catch (err) {
                this.error = `读取失败:${err?.message || err}`;
            } finally {
                this.busy = false;
            }
        },
        onClear() {
            store.updateSettings({ customFont: null });
            this.$emit('close');
        },
    },
    template: `
        <DwModal title="正文字体" max-width="320px" @close="$emit('close')">
            <p class="dw-modal-hint">支持 .ttf / .otf / .woff / .woff2。只影响正文阅读区。</p>
            <p v-if="current" class="dw-modal-text">当前:{{ current.name }}</p>
            <label class="dw-font-pick">
                <input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" :disabled="busy" @change="onPick" />
                <span>{{ busy ? '读取中…' : '选择字体文件' }}</span>
            </label>
            <p v-if="error" class="dw-modal-error">{{ error }}</p>
            <template #footer>
                <button v-if="current" type="button" class="ac-btn ac-btn-danger" @click="onClear">恢复系统字体</button>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">关闭</button>
            </template>
        </DwModal>
    `,
};

// ============================================================
// 选角色(给内心视角改写这类用)
// ============================================================

export const DwPickCharacterModal = {
    name: 'DwPickCharacterModal',
    components: BASE,
    mixins: [FooterMixin],
    computed: {
        characters() {
            const book = findById(store.getState().books, this.payload.bookId);
            return book?.characters || [];
        },
    },
    methods: {
        nameOf(c) { return resolveCharacterName(c) || '(未命名)'; },
        onPick(character) {
            const fn = this.payload.onPick;
            this.$emit('close');
            if (typeof fn === 'function') fn(character);
        },
    },
    template: `
        <DwModal :title="payload.title || '选一个角色'" max-width="320px" @close="$emit('close')">
            <DwEmpty v-if="characters.length === 0" icon-name="user" title="还没有角色" text="先在「设定 → 角色」里建一个。" />
            <div v-else class="dw-mark-list">
                <DwRow
                    v-for="c in characters"
                    :key="c.id"
                    :label="nameOf(c)"
                    :hint="c.role"
                    chevron
                    @click="onPick(c)"
                />
            </div>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
            </template>
        </DwModal>
    `,
};

// ============================================================
// 自定义提示词(书级)
// ============================================================

/**
 * 每本书自己的额外要求,会作为「自定义提示词」那一段进上下文。
 *
 * 和「我的 → 生成提示词」的区别:那个是全局的、影响所有书;
 * 这个只影响当前这本(比如「这本书里不要出现现代词汇」)。
 */
export const DwCustomPromptsModal = {
    name: 'DwCustomPromptsModal',
    components: BASE,
    mixins: [FooterMixin],
    data() {
        return { editingId: '' };
    },
    computed: {
        book() { return findById(store.getState().books, this.payload.bookId); },
        prompts() { return this.book?.customPrompts || []; },
        editing() { return findById(this.prompts, this.editingId); },
        enabledCount() { return this.prompts.filter((p) => p.enabled !== false).length; },
    },
    methods: {
        commit(next) {
            store.updateBook(this.payload.bookId, { customPrompts: next });
        },
        onCreate() {
            const item = { id: `cp-${Date.now().toString(36)}`, title: '新要求', content: '', enabled: true };
            this.commit([...this.prompts, item]);
            this.editingId = item.id;
        },
        patch(key, value) {
            this.commit(this.prompts.map((p) => (p.id === this.editingId ? { ...p, [key]: value } : p)));
        },
        onToggle(item, enabled) {
            this.commit(this.prompts.map((p) => (p.id === item.id ? { ...p, enabled } : p)));
        },
        onDelete(item) {
            this.commit(this.prompts.filter((p) => p.id !== item.id));
            if (this.editingId === item.id) this.editingId = '';
        },
    },
    created() { this.truncate = truncate; },
    template: `
        <DwModal class="dw-list-modal" title="自定义提示词" max-width="340px" @close="$emit('close')">
            <template v-if="!editing">
                <p class="dw-modal-hint">
                    只对这本书生效,会作为「自定义提示词」那一段进上下文。
                    当前 {{ enabledCount }}/{{ prompts.length }} 条启用。
                </p>
                <DwEmpty
                    v-if="prompts.length === 0"
                    icon-name="note"
                    title="还没有额外要求"
                    text="比如「不要出现现代词汇」「对话多用短句」。"
                    action-label="写一条"
                    @action="onCreate"
                />
                <div v-else class="dw-mark-list">
                    <div v-for="item in prompts" :key="item.id" class="dw-mode-row">
                        <div class="dw-mode-row-main">
                            <p class="dw-mode-row-name">{{ item.title || '(无标题)' }}</p>
                            <p class="dw-mode-row-hint">{{ truncate(item.content, 30) || '(空)' }}</p>
                        </div>
                        <DwSwitch :model-value="item.enabled !== false" :label="item.title" @update:model-value="onToggle(item, $event)" />
                        <button type="button" class="dw-nav-icon-btn" aria-label="编辑" @click="editingId = item.id"><DwIcon name="edit" /></button>
                    </div>
                </div>
            </template>

            <template v-else>
                <button type="button" class="dw-modal-back" @click="editingId = ''"><DwIcon name="chevronLeft" />返回列表</button>
                <DwField label="标题" hint="只是给你自己看的">
                    <DwInput :model-value="editing.title" @update:model-value="patch('title', $event)" />
                </DwField>
                <DwField label="内容" hint="直接写给 AI 的要求,不用客气话">
                    <DwTextarea :model-value="editing.content" :rows="6" @update:model-value="patch('content', $event)" />
                </DwField>
                <DwRow label="删除这条" danger @click="onDelete(editing)" />
            </template>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">关闭</button>
                <button v-if="!editing" type="button" class="ac-btn ac-btn-primary" @click="onCreate">新建</button>
            </template>
        </DwModal>
    `,
};

// ============================================================
// 显示设置(原版「更多操作 → 显示设置」)
// ============================================================

export const DwDisplaySettingsModal = {
    name: 'DwDisplaySettingsModal',
    components: BASE,
    mixins: [FooterMixin],
    computed: {
        display() { return store.getState().library.settings.displaySettings; },
    },
    methods: {
        patch(key, value) { store.updateDisplaySettings({ [key]: value }); },
    },
    template: `
        <DwModal title="显示设置" max-width="330px" @close="$emit('close')">
            <p class="dw-modal-hint">只影响正文的显示,不改内容本身。</p>

            <DwField label="字号">
                <DwSlider :model-value="display.fontSize" :min="12" :max="22" suffix="px" @update:model-value="patch('fontSize', $event)" />
            </DwField>
            <DwField label="行距">
                <DwSlider :model-value="Math.round(display.lineHeight * 10)" :min="14" :max="26"
                          @update:model-value="patch('lineHeight', $event / 10)" />
            </DwField>
            <DwField label="字距">
                <DwSlider :model-value="display.letterSpacing" :min="0" :max="4" suffix="px" @update:model-value="patch('letterSpacing', $event)" />
            </DwField>

            <DwRow label="段首缩进">
                <template #trailing><DwSwitch :model-value="display.paragraphIndent" label="段首缩进" @update:model-value="patch('paragraphIndent', $event)" /></template>
            </DwRow>
            <DwRow label="对话渲染成气泡" hint="按「正则规则」识别对话">
                <template #trailing><DwSwitch :model-value="display.showBubbles" label="对话气泡" @update:model-value="patch('showBubbles', $event)" /></template>
            </DwRow>
            <DwRow label="气泡小尾巴">
                <template #trailing><DwSwitch :model-value="display.bubbleTail" label="气泡小尾巴" @update:model-value="patch('bubbleTail', $event)" /></template>
            </DwRow>
            <DwRow label="高亮角色名">
                <template #trailing><DwSwitch :model-value="display.highlightCharacters" label="高亮角色名" @update:model-value="patch('highlightCharacters', $event)" /></template>
            </DwRow>
            <DwRow label="高亮地点名">
                <template #trailing><DwSwitch :model-value="display.highlightLocations" label="高亮地点名" @update:model-value="patch('highlightLocations', $event)" /></template>
            </DwRow>
            <DwRow label="显示字数">
                <template #trailing><DwSwitch :model-value="display.showTokens" label="显示字数" @update:model-value="patch('showTokens', $event)" /></template>
            </DwRow>
            <DwRow label="显示时间">
                <template #trailing><DwSwitch :model-value="display.showTimestamps" label="显示时间" @update:model-value="patch('showTimestamps', $event)" /></template>
            </DwRow>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-primary" @click="$emit('close')">完成</button>
            </template>
        </DwModal>
    `,
};

// ============================================================
// 分支管理 · 本章脉络树
// ============================================================

/**
 * 递归节点。当前路径是主干;某段有多路时在该点分叉。
 * 事件全部冒泡给弹窗,改名 / 删除的草稿也只存在弹窗里一份。
 */
const DwBranchTreeNodes = {
    name: 'DwBranchTreeNodes',
    components: { ...SHARED_COMPONENTS },
    props: {
        nodes: { type: Array, default: () => [] },
        editingKey: { type: String, default: '' },
        draft: { type: String, default: '' },
        confirmKey: { type: String, default: '' },
        dim: { type: Boolean, default: false },
    },
    emits: [
        'update:draft', 'pick', 'rename-start', 'rename-save', 'rename-cancel',
        'ask-delete', 'confirm-delete', 'cancel-delete',
    ],
    methods: {
        keyOf(node, fork) { return `${node.id}:${fork.id}`; },
        segKey(node) { return `seg:${node.id}`; },
    },
    template: `
        <ol class="dw-btree-nodes" :class="{ 'is-dim': dim }">
            <li
                v-for="node in nodes"
                :key="node.id"
                class="dw-btree-node"
                :class="{ 'has-forks': node.forks.length }"
            >
                <div class="dw-btree-trunk">
                    <span class="dw-btree-dot" aria-hidden="true"></span>
                    <div class="dw-btree-body">
                        <p class="dw-btree-role">
                            {{ node.role }}
                            <template v-if="node.forks.length"> · {{ node.forks.length }} 路</template>
                        </p>
                        <p v-if="!node.forks.length" class="dw-btree-preview">{{ node.preview || '（空）' }}</p>
                    </div>
                    <button
                        v-if="!node.forks.length"
                        type="button"
                        class="dw-nav-icon-btn"
                        aria-label="删除这段"
                        @click.stop="$emit('ask-delete', { type: 'seg', node })"
                    ><DwIcon name="trash" /></button>
                </div>

                <div v-if="confirmKey === segKey(node)" class="dw-btree-confirm">
                    <span>删掉这段?</span>
                    <span class="dw-btree-confirm-actions">
                        <button type="button" @click="$emit('cancel-delete')">取消</button>
                        <button type="button" class="is-danger" @click="$emit('confirm-delete')">删除</button>
                    </span>
                </div>

                <ul v-if="node.forks.length" class="dw-btree-forks">
                    <li
                        v-for="fork in node.forks"
                        :key="fork.id"
                        class="dw-btree-fork"
                        :class="{ 'is-on': fork.active, 'is-dim': !fork.active }"
                    >
                        <div class="dw-btree-fork-row">
                            <template v-if="editingKey === keyOf(node, fork)">
                                <div class="dw-btree-rename">
                                    <DwInput
                                        :model-value="draft"
                                        maxlength="16"
                                        placeholder="分支名"
                                        @update:model-value="$emit('update:draft', $event)"
                                        @enter="$emit('rename-save', { node, fork })"
                                    />
                                </div>
                                <button type="button" class="dw-nav-icon-btn" aria-label="保存名称" @click="$emit('rename-save', { node, fork })">
                                    <DwIcon name="check" />
                                </button>
                                <button type="button" class="dw-nav-icon-btn" aria-label="取消" @click="$emit('rename-cancel')">
                                    <DwIcon name="close" />
                                </button>
                            </template>
                            <template v-else-if="confirmKey === keyOf(node, fork)">
                                <div class="dw-btree-confirm">
                                    <span>{{ fork.active ? '切到旁边再删这一路?' : '删掉这一路?' }}</span>
                                    <span class="dw-btree-confirm-actions">
                                        <button type="button" @click="$emit('cancel-delete')">取消</button>
                                        <button type="button" class="is-danger" @click="$emit('confirm-delete')">删除</button>
                                    </span>
                                </div>
                            </template>
                            <template v-else>
                                <button
                                    type="button"
                                    class="dw-btree-fork-pick"
                                    :class="{ 'is-on': fork.active }"
                                    @click="$emit('pick', { node, fork })"
                                >
                                    <span class="dw-btree-fork-mark" aria-hidden="true"></span>
                                    <span class="dw-btree-fork-name">{{ fork.name }}</span>
                                    <span v-if="!fork.active && fork.tailCount" class="dw-btree-fork-sub">{{ fork.tailCount }} 段</span>
                                </button>
                                <button type="button" class="dw-nav-icon-btn" aria-label="改名" @click.stop="$emit('rename-start', { node, fork })">
                                    <DwIcon name="edit" />
                                </button>
                                <button type="button" class="dw-nav-icon-btn" aria-label="删除分支" @click.stop="$emit('ask-delete', { type: 'fork', node, fork })">
                                    <DwIcon name="trash" />
                                </button>
                            </template>
                        </div>
                        <DwBranchTreeNodes
                            v-if="fork.children.length"
                            class="dw-btree-children"
                            :nodes="fork.children"
                            :editing-key="editingKey"
                            :draft="draft"
                            :confirm-key="confirmKey"
                            :dim="!fork.active"
                            @update:draft="$emit('update:draft', $event)"
                            @pick="$emit('pick', $event)"
                            @rename-start="$emit('rename-start', $event)"
                            @rename-save="$emit('rename-save', $event)"
                            @rename-cancel="$emit('rename-cancel')"
                            @ask-delete="$emit('ask-delete', $event)"
                            @confirm-delete="$emit('confirm-delete')"
                            @cancel-delete="$emit('cancel-delete')"
                        />
                    </li>
                </ul>
            </li>
        </ol>
    `,
};
DwBranchTreeNodes.components.DwBranchTreeNodes = DwBranchTreeNodes;

/**
 * 本章脉络。分支绑在章上,每段都可以分叉;
 * 选路 / 删路和编辑器里删文段走同一套 store。
 */
export const DwBranchManagerModal = {
    name: 'DwBranchManagerModal',
    components: { ...BASE, DwBranchTreeNodes },
    mixins: [FooterMixin],
    data() {
        return { editingKey: '', draft: '', confirmKey: '' };
    },
    computed: {
        chapter() { return store.getOpenChapter(); },
        nodes() { return this.chapter ? buildChapterBranchTree(this.chapter) : []; },
        segCount() { return this.chapter?.messages?.length || 0; },
        forkCount() { return countChapterForks(this.chapter?.branches); },
    },
    methods: {
        guardBusy() {
            if (!this.chapter || !store.isGenerating(this.chapter.id)) return false;
            this.$emit('notify', '这一章还在生成,等它跑完');
            return true;
        },
        onPick(payload) {
            if (this.guardBusy()) return;
            const fork = payload?.fork;
            const node = payload?.node;
            if (!fork || !node || fork.active) return;
            store.switchBranch(this.chapter.id, node.id, fork.id);
            this.editingKey = '';
            this.confirmKey = '';
        },
        onRenameStart(payload) {
            const fork = payload?.fork;
            const node = payload?.node;
            if (!fork || !node) return;
            this.confirmKey = '';
            this.editingKey = `${node.id}:${fork.id}`;
            this.draft = fork.rawName || '';
            this.$nextTick(() => {
                const input = this.$el?.querySelector?.('.dw-btree-rename .dw-input');
                if (input) {
                    input.focus();
                    input.select();
                }
            });
        },
        onRenameSave(payload) {
            const fork = payload?.fork;
            const node = payload?.node;
            if (!fork || !node || !this.chapter) return;
            store.renameBranchAlt(this.chapter.id, node.id, fork.id, this.draft);
            this.editingKey = '';
            this.draft = '';
            this.$emit('notify', '已记下名字');
        },
        onRenameCancel() {
            this.editingKey = '';
            this.draft = '';
        },
        onAskDelete(payload) {
            if (this.guardBusy()) return;
            this.editingKey = '';
            this.draft = '';
            if (payload?.type === 'seg' && payload.node) {
                this.confirmKey = `seg:${payload.node.id}`;
                return;
            }
            if (payload?.node && payload?.fork) {
                this.confirmKey = `${payload.node.id}:${payload.fork.id}`;
            }
        },
        onConfirmDelete() {
            if (!this.chapter || !this.confirmKey) return;
            if (this.guardBusy()) return;
            if (this.confirmKey.startsWith('seg:')) {
                store.removeMessage(this.chapter.id, this.confirmKey.slice(4));
                this.$emit('notify', '已删除这段');
            } else {
                const split = this.confirmKey.indexOf(':');
                const messageId = this.confirmKey.slice(0, split);
                const altId = this.confirmKey.slice(split + 1);
                store.removeBranchAlt(this.chapter.id, messageId, altId);
                this.$emit('notify', '已删除这一路');
            }
            this.confirmKey = '';
        },
        onCancelDelete() {
            this.confirmKey = '';
        },
    },
    emits: ['close', 'notify'],
    template: `
        <DwModal
            class="dw-list-modal dw-branch-modal"
            title="分支管理"
            :subtitle="chapter ? chapter.title : ''"
            max-width="340px"
            @close="$emit('close')"
        >
            <DwEmpty
                v-if="!chapter || segCount === 0"
                icon-name="branch"
                title="这一章还是空的"
                text="先写下一段。对某一段重新生成,这里就会分出岔路。"
            />
            <div v-else class="dw-btree">
                <p class="dw-btree-meta">{{ segCount }} 个文段 · {{ forkCount }} 处岔路</p>
                <p class="dw-btree-hint">
                    <template v-if="forkCount">点岔路切过去。改名会记住。删掉的路和文段一起去掉。</template>
                    <template v-else>对某一段重新生成,旧的那路会留在分叉上,可以随时切回来。</template>
                </p>
                <DwBranchTreeNodes
                    :nodes="nodes"
                    :editing-key="editingKey"
                    :draft="draft"
                    :confirm-key="confirmKey"
                    @update:draft="draft = $event"
                    @pick="onPick"
                    @rename-start="onRenameStart"
                    @rename-save="onRenameSave"
                    @rename-cancel="onRenameCancel"
                    @ask-delete="onAskDelete"
                    @confirm-delete="onConfirmDelete"
                    @cancel-delete="onCancelDelete"
                />
            </div>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-primary" @click="$emit('close')">完成</button>
            </template>
        </DwModal>
    `,
};

// ============================================================
// Tokens 监控(原版「更多操作 → Tokens监控」)
// ============================================================

/**
 * 这本书的 token 分布。
 *
 * 原版 `calculateTokensStats`(17237)用的是 `len * 0.5`,对纯中文勉强能用,
 * 混了英文就偏一倍。这里走框架的 `estimateTokens`(按字符类别分别计)。
 *
 * 显示三块:整本书总量、这次发送要占多少(含设定)、各章占比条。
 * 最后一块是最有用的 —— 哪一章特别肥一眼就看出来了。
 */
export const DwTokensModal = {
    name: 'DwTokensModal',
    components: BASE,
    mixins: [FooterMixin],
    computed: {
        book() { return store.getOpenBook(); },
        chapters() { return store.getOrderedChapters(); },
        rows() {
            const list = this.chapters.map((chapter) => {
                const body = chapter.messages
                    .filter((m) => m.role !== 'note')
                    .map((m) => m.content)
                    .join('\n');
                return {
                    id: chapter.id,
                    title: chapter.title,
                    tokens: estimateTokens(body),
                    words: countWords(body),
                    summaryTokens: chapter.useSummary ? estimateTokens(chapter.summary) : 0,
                };
            });
            const max = Math.max(1, ...list.map((r) => r.tokens));
            return list.map((r) => ({ ...r, percent: Math.round((r.tokens / max) * 100) }));
        },
        totalTokens() { return this.rows.reduce((n, r) => n + r.tokens, 0); },
        totalWords() { return this.rows.reduce((n, r) => n + r.words, 0); },
        /** 这次发送实际占多少 —— 直接问 prompt-builder,和真发出去的一致 */
        contextStats() {
            const book = this.book;
            if (!book) return { tokens: 0, included: 0, total: 0 };
            const result = buildPrompt({
                book,
                orderedChapters: this.chapters,
                chapter: store.getOpenChapter(),
                library: store.getState().library,
            });
            return result.stats;
        },
        budget() { return Number(store.getState().library.settings.contextTokenBudget) || 0; },
        overBudget() { return this.budget > 0 && this.contextStats.tokens > this.budget; },
    },
    created() {
        this.formatNumber = formatNumber;
    },
    template: `
        <DwModal class="dw-tokens-modal" title="Tokens 监控" max-width="340px" @close="$emit('close')">
            <div class="dw-tk-cards">
                <div class="dw-tk-card">
                    <p class="dw-tk-card-value">{{ formatNumber(totalTokens) }}</p>
                    <p class="dw-tk-card-label">全书 tokens</p>
                </div>
                <div class="dw-tk-card">
                    <p class="dw-tk-card-value">{{ formatNumber(totalWords) }}</p>
                    <p class="dw-tk-card-label">全书字数</p>
                </div>
                <div class="dw-tk-card" :class="{ 'is-over': overBudget }">
                    <p class="dw-tk-card-value">{{ formatNumber(contextStats.tokens) }}</p>
                    <p class="dw-tk-card-label">本次发送</p>
                </div>
            </div>

            <p class="dw-modal-hint">
                「本次发送」= 上下文面板里 {{ contextStats.included }}/{{ contextStats.total }} 段的合计,
                和真正发给 AI 的是同一份。<template v-if="budget">预算 {{ formatNumber(budget) }}。</template>
            </p>

            <p v-if="overBudget" class="dw-modal-error">
                超出预算了。去上下文面板关掉几段用不上的,或者把「前情提要」改成只留关键章。
            </p>

            <DwEmpty v-if="rows.length === 0" icon-name="chart" title="还没有内容" />
            <div v-else class="dw-tk-rows">
                <div v-for="row in rows" :key="row.id" class="dw-tk-row">
                    <div class="dw-tk-row-head">
                        <span class="dw-tk-row-title">{{ row.title }}</span>
                        <span class="dw-tk-row-value">{{ formatNumber(row.tokens) }}</span>
                    </div>
                    <span class="dw-tk-bar"><i :style="{ width: row.percent + '%' }"></i></span>
                    <p class="dw-tk-row-sub">
                        {{ formatNumber(row.words) }} 字
                        <template v-if="row.summaryTokens"> · 梗概 {{ row.summaryTokens }} tokens 进上下文</template>
                    </p>
                </div>
            </div>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-primary" @click="$emit('close')">完成</button>
            </template>
        </DwModal>
    `,
};

export const MODAL_COMPONENTS = {
    DwCustomPromptsModal, DwDisplaySettingsModal, DwBranchManagerModal, DwTokensModal,
    DwConfirmModal, DwRenameModal, DwBookModal, DwEditMessageModal, DwRewriteSelectionModal,
    DwCharacterModal, DwLocationModal, DwMarkListModal, DwChapterSettingsModal,
    DwTimelineEventModal, DwInputModesModal, DwRegexModal, DwLibraryListModal,
    DwGenerationPromptsModal, DwFontModal, DwPickCharacterModal,
};
