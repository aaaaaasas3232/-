/**
 * 小奇怪 · 弹窗外壳
 *
 * 包一层框架的 `AcModal`,把本 App 的弹窗规矩固化下来:
 *
 *   - 点遮罩关闭
 *   - **不要右上角的叉**(和湛蓝回忆 / 梦境编织一致 —— 那个叉在手机壳里会顶到状态栏)
 *   - 统一 `oq-modal` class,皮肤在 `index.css` 里换
 *
 * ★ 为什么包一层而不是每处传参:
 *   靠「每处都记得传 `:show-close="false"`」维持的一致性迟早会漏一个,
 *   而漏掉的那个只是「多了个叉」这种没人会专门报的小瑕疵,于是就永远那样了。
 *   **能收进组件的约定就别写成纪律。**(AGENTS2 §13.5.4)
 *
 * ⚠️ `class` 是透传到根元素 `.ac-overlay` 的,不是 `.ac-modal`。
 *    业务钩子要写后代选择器:`.oq-modal .ac-modal-body` ✓ / `.oq-modal.ac-modal` ✗
 *
 * ⚠️ 遮罩层的 z-index 必须 < 6 —— `.app-bottom`(home 指示条)是 6,
 *    盖住它就退不出 App 了(AGENTS.md §5)。压制写在 index.css。
 */

import { AcModal } from '@/src/core/components/ac-modal.js';

export const OqModal = {
    name: 'OqModal',
    components: { AcModal },
    props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        maxWidth: { type: String, default: '320px' },
        /** 少数场景(比如字幕预览)需要更宽 */
        wide: { type: Boolean, default: false },
    },
    emits: ['close'],
    computed: {
        width() { return this.wide ? '94%' : this.maxWidth; },
    },
    template: `
        <AcModal
            class="oq-modal"
            :title="title"
            :subtitle="subtitle"
            :max-width="width"
            :show-close="false"
            :close-on-backdrop="true"
            tone="warm"
            @close="$emit('close')"
        >
            <slot></slot>
            <template v-if="$slots.footer" #footer><slot name="footer"></slot></template>
        </AcModal>
    `,
};

export default OqModal;
