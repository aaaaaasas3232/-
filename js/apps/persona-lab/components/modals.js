/**
 * 人设机 · 弹窗
 *
 * 用框架的 `AcModal`(`src/core/components/ac-modal.js`),不自己造。
 * 换皮只在 `_modals.css` 里把 `--ac-*` 桥到本 App 的 token。
 *
 * ⚠️ 三条硬约束(`docs/提示词-HTML转App.md` 第 9 步):
 *    1. class 透传到根元素 `.ac-overlay`,业务钩子写后代选择器
 *    2. 不自绘关闭按钮和遮罩,AcModal 自带
 *    3. `.ac-modal` 永远不加 `overflow: hidden` —— 关闭按钮用 `top:-10px` 故意露在外面
 */

import { AcModal } from '@/src/core/components/ac-modal.js';
import { PlButton } from './shared.js';

/**
 * 确认框。
 *
 * `payload.onConfirm` 可以是 async。执行期间按钮转圈,避免用户连点两次 ——
 * 「删除」这类操作连点两次的后果是第二次落到别的记录上。
 */
export const PlConfirmModal = {
    name: 'PlConfirmModal',
    components: { AcModal, PlButton },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close'],
    data() {
        return { running: false };
    },
    computed: {
        title() { return this.payload.title || '确认'; },
        text() { return this.payload.text || ''; },
        danger() { return this.payload.danger === true; },
        confirmLabel() { return this.payload.confirmLabel || '确定'; },
        cancelLabel() { return this.payload.cancelLabel || '取消'; },
    },
    methods: {
        async onConfirm() {
            if (this.running) return;
            this.running = true;
            try {
                await this.payload.onConfirm?.();
            } catch (err) {
                console.warn('[persona-lab] 确认操作失败', err);
            } finally {
                this.running = false;
                this.$emit('close');
            }
        },
    },
    template: `
        <AcModal class="pl-modal" :title="title" tone="candy" @close="$emit('close')">
            <p v-if="text" class="pl-modal-text">{{ text }}</p>
            <template #footer>
                <PlButton :label="cancelLabel" variant="quiet" @click="$emit('close')" />
                <PlButton
                    :label="confirmLabel"
                    :variant="danger ? 'danger' : 'primary'"
                    :loading="running"
                    @click="onConfirm"
                />
            </template>
        </AcModal>
    `,
};

export const MODAL_COMPONENTS = { PlConfirmModal };
