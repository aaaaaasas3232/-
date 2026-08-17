/**
 * 情景剧场 · 弹窗外壳
 *
 * 包一层 `AcModal`(框架的动森风 squircle 弹窗),把本 App 的规矩固化下来:
 * 点遮罩关闭、不要右上角那个叉(它用 `top:-10px` 露在弹窗外,会顶到状态栏)、
 * 统一 `sp-modal` class。
 *
 * ⚠️ `class` 是透传到根元素 `.ac-overlay` 的,不是 `.ac-modal`。
 *    业务钩子要写后代选择器:`.sp-modal .ac-modal-body` ✓ / `.sp-modal.ac-modal` ✗
 */

import { AcModal } from '@/src/core/components/ac-modal.js';

export const SpModal = {
    name: 'SpModal',
    components: { AcModal },
    props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        maxWidth: { type: String, default: '306px' },
        wide: { type: Boolean, default: false },
    },
    emits: ['close'],
    computed: {
        width() { return this.wide ? '94%' : this.maxWidth; },
    },
    template: `
        <AcModal
            class="sp-modal"
            tone="candy"
            :title="title"
            :subtitle="subtitle"
            :max-width="width"
            :show-close="false"
            :close-on-backdrop="true"
            @close="$emit('close')"
        >
            <slot></slot>
            <template v-if="$slots.footer" #footer><slot name="footer"></slot></template>
        </AcModal>
    `,
};

export default SpModal;
