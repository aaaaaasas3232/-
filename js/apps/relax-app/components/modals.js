/**
 * relax-app / 弹窗
 *
 * 全部基于框架级 `AcModal`(src/core/components/ac-modal.js),
 * 用 `tone="candy"` 换成糖果粉主题 —— 不自己造外壳、不自己写遮罩。
 *
 * ★ 注意 class 透传:Vue 会把 `class` 挂到 AcModal 的**根元素 `.ac-overlay`** 上,
 *   不是 `.ac-modal`。所以业务 CSS 写 `.rx-confirm-modal .ac-modal-body`(后代),
 *   不要写 `.rx-confirm-modal.ac-modal`。
 *
 * ★ 不要在 slot 里再写关闭按钮 —— AcModal 自带右上角 ✕。
 */

import { AcModal } from '@/src/core/components/ac-modal.js';
import { ICON_CLOSE } from './icons.js';

/*
 * ★ 「我的捏捏」的编辑器以前也在这个文件里(RxCustomToyModal)。
 *   它现在是一整屏的页面 —— `components/pages/custom-toy-page.js`,
 *   由 relax-root 的 `view` 状态切换。这里不再有第二条打开它的路。
 */

/** 通用确认框(重置舞台 / 删素材 / 清空装饰都用它) */
export const RxConfirmModal = {
    name: 'RxConfirmModal',
    components: { AcModal },
    props: {
        title: { type: String, default: '确认一下' },
        message: { type: String, default: '' },
        confirmLabel: { type: String, default: '确定' },
        cancelLabel: { type: String, default: '算了' },
        danger: { type: Boolean, default: false },
    },
    emits: ['close', 'confirm'],
    template: `
        <AcModal
            class="rx-confirm-modal"
            tone="candy"
            :title="title"
            max-width="300px"
            @close="$emit('close')"
        >
            <p class="rx-confirm-text">{{ message }}</p>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">
                    {{ cancelLabel }}
                </button>
                <button
                    type="button"
                    class="ac-btn"
                    :class="danger ? 'ac-btn-danger' : 'ac-btn-primary'"
                    @click="$emit('confirm')"
                >{{ confirmLabel }}</button>
            </template>
        </AcModal>
    `,
};

/** 另存舞台 */
export const RxSaveSceneModal = {
    name: 'RxSaveSceneModal',
    components: { AcModal },
    props: {
        initialName: { type: String, default: '' },
    },
    emits: ['close', 'confirm'],
    data() {
        return {
            name: this.initialName || '',
        };
    },
    computed: {
        trimmed() {
            return this.name.trim();
        },
        canSave() {
            return this.trimmed.length > 0;
        },
    },
    mounted() {
        this.$nextTick(() => this.$refs.input?.focus());
    },
    methods: {
        onConfirm() {
            if (!this.canSave) return;
            this.$emit('confirm', this.trimmed.slice(0, 24));
        },
    },
    template: `
        <AcModal
            class="rx-save-modal"
            tone="candy"
            title="存一套舞台"
            subtitle="以后可以一键换回来"
            max-width="320px"
            @close="$emit('close')"
        >
            <input
                ref="input"
                v-model="name"
                class="rx-text-input"
                type="text"
                maxlength="24"
                placeholder="给它起个名字"
                @keydown.enter="onConfirm"
            />
            <p class="rx-input-counter">{{ trimmed.length }} / 24</p>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
                <button
                    type="button"
                    class="ac-btn ac-btn-primary"
                    :disabled="!canSave"
                    @click="onConfirm"
                >保存</button>
            </template>
        </AcModal>
    `,
};

/** 舞台存档库 */
export const RxSceneLibraryModal = {
    name: 'RxSceneLibraryModal',
    components: { AcModal },
    props: {
        scenes: { type: Array, default: () => [] },
    },
    emits: ['close', 'apply', 'remove'],
    methods: {
        formatDate(iso) {
            if (!iso) return '';
            const date = new Date(iso);
            if (Number.isNaN(date.getTime())) return '';
            const pad = (n) => String(n).padStart(2, '0');
            return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
        },
        summarize(scene) {
            const parts = [];
            if (scene?.toy?.id) parts.push('有主体');
            const count = Array.isArray(scene?.decorations) ? scene.decorations.length : 0;
            if (count) parts.push(`${count} 个装饰`);
            return parts.join(' · ') || '空舞台';
        },
    },
    template: `
        <AcModal
            class="rx-library-modal"
            tone="candy"
            title="舞台存档"
            :subtitle="scenes.length ? scenes.length + ' 套' : ''"
            max-width="340px"
            @close="$emit('close')"
        >
            <ul v-if="scenes.length" class="rx-library-list">
                <li v-for="scene in scenes" :key="scene.id" class="rx-library-row">
                    <button type="button" class="rx-library-main" @click="$emit('apply', scene)">
                        <span class="rx-library-name">{{ scene.name }}</span>
                        <span class="rx-library-meta">{{ summarize(scene) }}</span>
                        <span class="rx-library-date">{{ formatDate(scene.savedAt) }}</span>
                    </button>
                    <button
                        type="button"
                        class="rx-library-del"
                        aria-label="删除存档"
                        @click="$emit('remove', scene)"
                    >${ICON_CLOSE}</button>
                </li>
            </ul>

            <p v-else class="rx-hint-text">还没有存档。在舞台页点「存一套」就会出现在这里。</p>
        </AcModal>
    `,
};
