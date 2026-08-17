/**
 * 候鸟 · 弹窗外壳
 *
 * 包一层框架级 `AcModal`，把本 App 的规矩固化：
 * 小巧（默认 300px）、点遮罩关闭、不要右上角的叉（省一层视觉噪音）、
 * 统一 `tv-modal` class（皮肤在 css/apps/travel/index.css 的弹窗段）。
 *
 * ⚠️ class 透传到根元素 `.ac-overlay`，业务钩子写后代选择器：
 *    `.tv-modal .ac-modal-body` ✓ / `.tv-modal.ac-modal` ✗
 */

import { AcModal } from '@/src/core/components/ac-modal.js';

export const TvModal = {
    name: 'TvModal',
    components: { AcModal },
    props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        maxWidth: { type: String, default: '300px' },
        wide: { type: Boolean, default: false },
    },
    emits: ['close'],
    computed: {
        width() { return this.wide ? '92%' : this.maxWidth; },
    },
    template: `
        <AcModal
            class="tv-modal"
            tone="cool"
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

export default TvModal;
