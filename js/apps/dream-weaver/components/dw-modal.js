/**
 * 梦境编织 · 弹窗外壳
 *
 * 包一层框架的 `AcModal`,固化本 App 的三条弹窗规矩:
 *
 *   1. **点遮罩关闭**,不显示右上角的关闭按钮
 *      —— 原版所有弹窗都是 `modal.onclick = e => { if (e.target === modal) modal.remove(); }`,
 *         没有一个带叉。手机上大拇指够右上角很别扭,点旁边关掉才是这个 App 的习惯。
 *   2. `tone="warm"` —— 和复古红的调子对得上
 *   3. 高度按 `.app-shell` 算,不按浏览器视口
 *      (框架基线是 `max-height: 80vh`,而 vh 是浏览器视口;
 *        这是个手机模拟器,弹窗活在 shell 里,桌面上 80vh 会比手机屏还高。
 *        具体覆盖在 `_modals.css`。)
 *
 * ★ 为什么做成组件而不是逐个传 `:show-close="false"`:
 *   App 里有 20 多个弹窗,靠每个都记得传参数 = 迟早漏一个,
 *   而漏了之后只是"多了个叉"这种没人会报的小瑕疵。收进一个组件就不用记了。
 *
 * 用法和 AcModal 一样,`class` 会一路透传到 `.ac-overlay`:
 *
 *   <DwModal class="dw-theme-modal" title="主题" max-width="340px" @close="...">
 *     正文
 *     <template #footer><button class="ac-btn ac-btn-primary">确定</button></template>
 *   </DwModal>
 */

import { AcModal } from '@/src/core/components/ac-modal.js';

export const DwModal = {
    name: 'DwModal',
    components: { AcModal },
    props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        maxWidth: { type: String, default: '330px' },
        /** 极少数场景(生成中不想被误关)可以关掉遮罩关闭 */
        closeOnBackdrop: { type: Boolean, default: true },
    },
    emits: ['close'],
    template: `
        <AcModal
            class="dw-modal"
            tone="warm"
            :title="title"
            :subtitle="subtitle"
            :max-width="maxWidth"
            :show-close="false"
            :close-on-backdrop="closeOnBackdrop"
            @close="$emit('close')"
        >
            <slot></slot>
            <template v-if="$slots.footer" #footer><slot name="footer"></slot></template>
        </AcModal>
    `,
};

export default DwModal;
