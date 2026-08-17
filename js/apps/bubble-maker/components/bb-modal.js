/**
 * 气泡机 · 弹窗外壳
 *
 * 包一层 `AcModal`(框架的动森风 squircle 弹窗),把本 App 的规矩固化下来:
 *
 *   - 点遮罩关闭
 *   - **不要右上角的叉** —— 那个叉用 `top:-10px` 故意露在弹窗外,
 *     在手机壳里会顶到状态栏
 *   - 统一 `bb-modal` class,皮肤在 `_modals.css` 里换
 *
 * ★ 为什么包一层而不是每处传参:
 *   靠「每处都记得传 `:show-close="false"`」维持的一致性迟早会漏一个,
 *   而漏掉的那个只是「多了个叉」这种没人会专门报的小瑕疵,于是就永远那样了。
 *   **能收进组件的约定就别写成纪律。**
 *
 * ⚠️ `class` 是透传到根元素 `.ac-overlay` 的,不是 `.ac-modal`。
 *    业务钩子要写后代选择器:`.bb-modal .ac-modal-body` ✓ / `.bb-modal.ac-modal` ✗
 */

import { AcModal } from '@/src/core/components/ac-modal.js';

export const BbModal = {
    name: 'BbModal',
    components: { AcModal },
    props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        maxWidth: { type: String, default: '300px' },
        wide: { type: Boolean, default: false },
    },
    emits: ['close'],
    computed: {
        width() { return this.wide ? '94%' : this.maxWidth; },
    },
    template: `
        <AcModal
            class="bb-modal"
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

export default BbModal;
