/**
 * 手书 · 弹窗外壳
 *
 * 包一层框架的 `AcModal`,把本 App 的弹窗规矩固化下来:
 *
 *   - 点遮罩关闭
 *   - **不要右上角的叉**(那个叉在手机壳里会顶到状态栏)
 *   - 统一 `hs-modal` class,皮肤在 `index.css` 里换
 *
 * ★ 为什么包一层而不是每处传参:
 *   靠「每处都记得传 `:show-close="false"`」维持的一致性迟早会漏一个,
 *   而漏掉的那个只是「多了个叉」这种没人会专门报的小瑕疵,于是就永远那样了。
 *   **能收进组件的约定就别写成纪律。**
 *
 * ⚠️ `class` 是透传到根元素 `.ac-overlay` 的,不是 `.ac-modal`。
 *    业务钩子要写后代选择器:`.hs-modal .ac-modal-body` ✓ / `.hs-modal.ac-modal` ✗
 */

import { AcModal } from '@/src/core/components/ac-modal.js';

export const HsModal = {
    name: 'HsModal',
    components: { AcModal },
    props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        maxWidth: { type: String, default: '318px' },
        wide: { type: Boolean, default: false },
    },
    emits: ['close'],
    computed: {
        width() { return this.wide ? '94%' : this.maxWidth; },
    },
    template: `
        <AcModal
            class="hs-modal"
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

/**
 * 确认弹窗。
 *
 * 所有破坏性操作都必须走它 —— 删掉一份攒了一小时的手书企划,
 * 不该是「点一下就没了」。
 */
export const HsConfirm = {
    name: 'HsConfirm',
    components: { HsModal },
    props: {
        title: { type: String, default: '确认' },
        message: { type: String, default: '' },
        confirmText: { type: String, default: '确认' },
        cancelText: { type: String, default: '再想想' },
        danger: { type: Boolean, default: false },
    },
    emits: ['close', 'confirm'],
    template: `
        <HsModal :title="title" @close="$emit('close')">
            <p class="hs-confirm-msg">{{ message }}</p>
            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="$emit('close')">{{ cancelText }}</button>
                <button
                    type="button"
                    class="ac-btn"
                    :class="danger ? 'ac-btn-danger' : 'ac-btn-primary'"
                    @click="$emit('confirm')"
                >{{ confirmText }}</button>
            </template>
        </HsModal>
    `,
};

export default HsModal;
