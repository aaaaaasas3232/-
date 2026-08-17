/**
 * 点灯 · 弹窗
 *
 * 全 App 只有这一处弹窗（AGENTS 的规矩：同一个 App 内统一）。
 * 类名前缀 `sl-` —— 绝不复用全局 `.ac-overlay` 那种别人的前缀。
 * z-index 必须小于 6，否则会盖住底部 Home 指示条，用户退不出 App。
 */

import { LINK_KINDS } from '../constants.js';
import { UI } from './ui.js';

export const SlModals = {
    name: 'SlModals',
    components: { ...UI },
    props: {
        modal: { type: Object, default: null },
    },
    emits: ['close', 'confirm'],
    data() {
        return { input: '', pickedKind: 'because' };
    },
    computed: {
        type() { return this.modal?.type || ''; },
        payload() { return this.modal?.payload || {}; },
        kinds() { return LINK_KINDS; },
    },
    watch: {
        modal: {
            immediate: true,
            handler(m) {
                this.input = String(m?.payload?.value ?? '');
                this.pickedKind = String(m?.payload?.kind || 'because');
            },
        },
    },
    methods: {
        ok(value) {
            this.$emit('confirm', { type: this.type, value, payload: this.payload });
        },
    },
    template: `
        <transition name="sl-fade">
            <div v-if="modal" class="sl-overlay" @click.self="$emit('close')">
                <div class="sl-modal" :class="'sl-modal--' + type">

                    <!-- 确认 -->
                    <template v-if="type === 'confirm'">
                        <h3 class="sl-modal__title">{{ payload.title || '确认' }}</h3>
                        <p class="sl-modal__text">{{ payload.text }}</p>
                        <div class="sl-modal__foot">
                            <SlButton variant="ghost" @click="$emit('close')">{{ payload.cancelText || '算了' }}</SlButton>
                            <SlButton :variant="payload.danger ? 'danger' : 'primary'" @click="ok(true)">
                                {{ payload.okText || '确定' }}
                            </SlButton>
                        </div>
                    </template>

                    <!-- 输入 -->
                    <template v-else-if="type === 'prompt'">
                        <h3 class="sl-modal__title">{{ payload.title || '' }}</h3>
                        <p v-if="payload.text" class="sl-modal__text">{{ payload.text }}</p>
                        <textarea
                            v-if="payload.multiline"
                            class="sl-textarea" v-model="input" rows="4" :placeholder="payload.placeholder"
                        ></textarea>
                        <input v-else class="sl-input" v-model="input" :placeholder="payload.placeholder" />
                        <div class="sl-modal__foot">
                            <SlButton variant="ghost" @click="$emit('close')">取消</SlButton>
                            <SlButton variant="primary" :disabled="!input.trim()" @click="ok(input.trim())">
                                {{ payload.okText || '好' }}
                            </SlButton>
                        </div>
                    </template>

                    <!-- 改一条连线 -->
                    <template v-else-if="type === 'link'">
                        <h3 class="sl-modal__title">这条线</h3>
                        <div class="sl-modal__kinds">
                            <button
                                v-for="k in kinds" :key="k.id" type="button"
                                class="sl-kinds__item" :class="['sl-kinds__item--' + k.token, { 'is-on': pickedKind === k.id }]"
                                @click="pickedKind = k.id"
                            ><i></i>{{ k.label }}</button>
                        </div>
                        <input class="sl-input" v-model="input" placeholder="给这条线写一句话（可留空）" />
                        <div class="sl-modal__foot">
                            <SlButton variant="danger" icon-name="trash" @click="ok({ remove: true })">删掉这条线</SlButton>
                            <span class="sl-section__spacer"></span>
                            <SlButton variant="ghost" @click="$emit('close')">取消</SlButton>
                            <SlButton variant="primary" @click="ok({ kind: pickedKind, label: input.trim() })">保存</SlButton>
                        </div>
                    </template>

                    <!-- 兜底 -->
                    <template v-else>
                        <h3 class="sl-modal__title">{{ payload.title || '' }}</h3>
                        <p class="sl-modal__text">{{ payload.text }}</p>
                        <div class="sl-modal__foot">
                            <SlButton variant="primary" @click="$emit('close')">知道了</SlButton>
                        </div>
                    </template>

                </div>
            </div>
        </transition>
    `,
};

export default SlModals;
