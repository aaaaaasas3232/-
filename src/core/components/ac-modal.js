/**
 * AcModal —— 框架级通用弹窗组件(Animal Crossing 风格 squircle)
 *
 * ★ 归属说明
 *   本组件原先住在 `js/apps/chat-app/components/ac-modal.js`,但它没有任何
 *   chat 业务耦合 —— 任何 app 都能用。现已提升到 `src/core/components/`,
 *   chat 侧文件退化为 re-export shim,老 import 路径继续可用。
 *
 * 用法:
 *   import { AcModal } from '@/src/core/components/ac-modal.js';
 *
 *   <AcModal title="..." subtitle="..." @close="...">
 *     <!-- 主体内容(默认 slot) -->
 *     <textarea />
 *
 *     <!-- 底部按钮(具名 slot) -->
 *     <template #footer>
 *       <button class="ac-btn ac-btn-secondary" @click="$emit('close')">取消</button>
 *       <button class="ac-btn ac-btn-primary" @click="onConfirm">确认</button>
 *     </template>
 *   </AcModal>
 *
 * Props:
 *   - title           string  弹窗标题(默认空)
 *   - subtitle        string  副标题(可选,默认空)
 *   - showClose       bool    是否显示右上角关闭按钮(默认 true)
 *   - closeOnBackdrop bool    点击遮罩是否关闭(默认 true)
 *   - showHeader      bool    是否显示 header 区域(默认 true)
 *   - maxWidth        string  弹窗最大宽度,支持任意 CSS 单位(默认 '320px')
 *   - tone            'cool' | 'warm' | 'mint' | 'candy'  主题色(默认 'cool')
 *
 * Emits:
 *   - close
 *
 * 样式:
 *   - 基线样式在 `css/core/ac-modal.css`(裸 class,低优先级)
 *   - 各 app 用 `.app-shell[data-app-id="xxx"] .ac-*` 覆盖成自己的皮肤
 *
 * CSS Hooks:
 *   .ac-overlay / .ac-modal / .ac-modal-header / .ac-modal-title /
 *   .ac-modal-subtitle / .ac-modal-body / .ac-modal-footer / .ac-close /
 *   .ac-btn / .ac-btn-primary / .ac-btn-secondary / .ac-btn-danger
 *
 * ⚠️ `.ac-modal` 绝对不能加 `overflow: hidden` —— `.ac-close` 用 `top: -10px`
 *    故意露出弹窗外,加了就会被裁掉一半。
 */

const TONES = ['cool', 'warm', 'mint', 'candy'];

export const AcModal = {
    name: 'AcModal',
    props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        showClose: { type: Boolean, default: true },
        closeOnBackdrop: { type: Boolean, default: true },
        showHeader: { type: Boolean, default: true },
        maxWidth: { type: String, default: '320px' },
        tone: {
            type: String,
            default: 'cool',
            validator: (v) => TONES.includes(v),
        },
    },
    emits: ['close'],
    data() {
        return {
            closing: false,
        };
    },
    computed: {
        toneClass() {
            return `ac-tone-${this.tone}`;
        },
    },
    mounted() {
        this._escHandler = (e) => {
            if (e.key === 'Escape' && !this.closing) this.requestClose();
        };
        document.addEventListener('keydown', this._escHandler);
    },
    beforeUnmount() {
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
        }
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = null;
        }
    },
    methods: {
        requestClose() {
            if (this.closing) return;
            this.closing = true;
            // 等出场动画跑完再真正 emit close(280ms 对应 acBounceOut)
            this._closeTimer = setTimeout(() => {
                this._closeTimer = null;
                this.closing = false;
                this.$emit('close');
            }, 280);
        },
        onBackdropClick() {
            if (this.closeOnBackdrop) this.requestClose();
        },
    },
    template: `
        <div
            class="ac-overlay"
            :class="[toneClass, { 'ac-overlay--closing': closing }]"
            @click.self="onBackdropClick"
        >
            <div
                class="ac-modal"
                :class="[toneClass, { 'ac-modal--closing': closing }]"
                :style="{ maxWidth: maxWidth }"
                role="dialog"
                aria-modal="true"
            >
                <button
                    v-if="showClose"
                    type="button"
                    class="ac-close"
                    aria-label="关闭"
                    @click="requestClose"
                >✕</button>

                <div v-if="showHeader && (title || subtitle || $slots.header)" class="ac-modal-header">
                    <slot name="header">
                        <h2 v-if="title" class="ac-modal-title">{{ title }}</h2>
                        <p v-if="subtitle" class="ac-modal-subtitle">{{ subtitle }}</p>
                    </slot>
                </div>

                <div class="ac-modal-body">
                    <slot></slot>
                </div>

                <div v-if="$slots.footer" class="ac-modal-footer">
                    <slot name="footer"></slot>
                </div>
            </div>
        </div>
    `,
};

export default AcModal;
