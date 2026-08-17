/**
 * 人设机 · 通用控件
 *
 * 抽这一层的判据不是「代码重复了几行」,是**「改一次要改几个地方」**
 * (`docs/framework-总览.md` §7)。下面每个组件都至少有三个消费方,
 * 比如 `PlSheet` 被题库 / 上下文 / 保存确认 / 建议详情 四处用。
 *
 * 原型对应位置的做法是每张卡各写一遍 `.card > .card-header > .card-title`,
 * 于是想统一调一下卡片间距要改二十几处。
 *
 * ★ 这里一个颜色都不写。所有视觉走 `css/apps/persona-lab/_base.css`。
 */

import { icon } from '../icons.js';
import { initialOf } from '../utils.js';

/** 图标。名字打错时渲染空,不会插出 "undefined"。 */
export const PlIcon = {
    name: 'PlIcon',
    props: { name: { type: String, required: true } },
    computed: { svg() { return icon(this.name); } },
    template: `<span class="pl-icon" v-html="svg"></span>`,
};

/** 头像。底色走 data-tone(token 名,不是 hex)—— 换主题时跟着变。 */
export const PlAvatar = {
    name: 'PlAvatar',
    components: { PlIcon },
    props: {
        name: { type: String, default: '' },
        tone: { type: String, default: 'rose' },
        scope: { type: String, default: 'ai' },
        size: { type: String, default: 'md' },
    },
    computed: {
        initial() { return initialOf(this.name); },
    },
    template: `
        <span class="pl-avatar" :data-tone="tone" :data-size="size">
            <span class="pl-avatar-text">{{ initial }}</span>
            <span class="pl-avatar-badge" :data-scope="scope">
                <PlIcon :name="scope === 'user' ? 'user' : 'bot'" />
            </span>
        </span>
    `,
};

/**
 * 按钮。
 *
 * `variant`: primary(粉) / ghost(描边) / quiet(纯文字) / danger
 * `size`: sm / md
 */
export const PlButton = {
    name: 'PlButton',
    components: { PlIcon },
    props: {
        label: { type: String, default: '' },
        iconName: { type: String, default: '' },
        variant: { type: String, default: 'ghost' },
        size: { type: String, default: 'md' },
        disabled: { type: Boolean, default: false },
        loading: { type: Boolean, default: false },
        block: { type: Boolean, default: false },
    },
    emits: ['click'],
    template: `
        <button
            type="button"
            class="pl-btn"
            :data-variant="variant"
            :data-size="size"
            :data-block="block ? '1' : null"
            :disabled="disabled || loading"
            @click="$emit('click', $event)"
        >
            <span v-if="loading" class="pl-btn-spin" aria-hidden="true"></span>
            <PlIcon v-else-if="iconName" :name="iconName" />
            <span v-if="label" class="pl-btn-label">{{ label }}</span>
        </button>
    `,
};

/**
 * 分段控件。tab 少于等于 4 个时用它,再多就该换抽屉了。
 * `item.dot === true` 时右上角点一个小点(用来提示「这一页有东西等着你处理」)。
 */
export const PlSegmented = {
    name: 'PlSegmented',
    props: {
        items: { type: Array, required: true },
        modelValue: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    template: `
        <div class="pl-segmented" role="tablist">
            <button
                v-for="item in items"
                :key="item.id"
                type="button"
                class="pl-segmented-item"
                :class="{ 'is-active': modelValue === item.id }"
                role="tab"
                :aria-selected="String(modelValue === item.id)"
                @click="$emit('update:modelValue', item.id)"
            >
                {{ item.label }}
                <span v-if="item.dot" class="pl-segmented-dot" aria-hidden="true"></span>
            </button>
        </div>
    `,
};

/** 开关 */
export const PlSwitch = {
    name: 'PlSwitch',
    props: {
        modelValue: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
    },
    emits: ['update:modelValue'],
    template: `
        <button
            type="button"
            class="pl-switch"
            role="switch"
            :aria-checked="String(modelValue)"
            :disabled="disabled"
            @click="$emit('update:modelValue', !modelValue)"
        ><span class="pl-switch-dot"></span></button>
    `,
};

/** 分区标题 */
export const PlSectionTitle = {
    name: 'PlSectionTitle',
    props: {
        title: { type: String, required: true },
        hint: { type: String, default: '' },
    },
    template: `
        <div class="pl-section-title">
            <h2>{{ title }}</h2>
            <p v-if="hint">{{ hint }}</p>
            <slot name="action" />
        </div>
    `,
};

/** 空状态。永远给一个「下一步该干嘛」,不要只写「暂无数据」。 */
export const PlEmpty = {
    name: 'PlEmpty',
    components: { PlIcon, PlButton },
    props: {
        iconName: { type: String, default: 'empty' },
        title: { type: String, default: '这里还是空的' },
        hint: { type: String, default: '' },
        actionLabel: { type: String, default: '' },
    },
    emits: ['action'],
    template: `
        <div class="pl-empty">
            <PlIcon :name="iconName" class="pl-empty-icon" />
            <p class="pl-empty-title">{{ title }}</p>
            <p v-if="hint" class="pl-empty-hint">{{ hint }}</p>
            <PlButton
                v-if="actionLabel"
                :label="actionLabel"
                variant="primary"
                size="sm"
                @click="$emit('action')"
            />
        </div>
    `,
};

export const PlSpinner = {
    name: 'PlSpinner',
    props: { label: { type: String, default: '' } },
    template: `
        <div class="pl-spinner" role="status">
            <span class="pl-spinner-ring" aria-hidden="true"></span>
            <span v-if="label" class="pl-spinner-label">{{ label }}</span>
        </div>
    `,
};

/**
 * 底部抽屉。
 *
 * 手机上比居中弹窗好用得多:拇指够得着、可以做得很高、关闭手势符合直觉。
 * 原型那些居中 modal 在 390px 宽的屏幕上会被挤成一条。
 */
export const PlSheet = {
    name: 'PlSheet',
    components: { PlIcon },
    props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        tall: { type: Boolean, default: false },
    },
    emits: ['close'],
    mounted() {
        this._esc = (e) => { if (e.key === 'Escape') this.$emit('close'); };
        document.addEventListener('keydown', this._esc);
    },
    beforeUnmount() {
        document.removeEventListener('keydown', this._esc);
    },
    template: `
        <div class="pl-sheet-overlay" @click.self="$emit('close')">
            <section class="pl-sheet" :data-tall="tall ? '1' : null" role="dialog" aria-modal="true">
                <header class="pl-sheet-head">
                    <span class="pl-sheet-grip" aria-hidden="true"></span>
                    <div class="pl-sheet-titles">
                        <h3 v-if="title">{{ title }}</h3>
                        <p v-if="subtitle">{{ subtitle }}</p>
                    </div>
                    <button type="button" class="pl-sheet-close" aria-label="关闭" @click="$emit('close')">
                        <PlIcon name="close" />
                    </button>
                </header>
                <div class="pl-sheet-body"><slot /></div>
                <footer v-if="$slots.footer" class="pl-sheet-foot"><slot name="footer" /></footer>
            </section>
        </div>
    `,
};

/** 自增高的多行输入。手机上比固定高度的 textarea 舒服很多。 */
export const PlTextarea = {
    name: 'PlTextarea',
    props: {
        modelValue: { type: String, default: '' },
        placeholder: { type: String, default: '' },
        minRows: { type: Number, default: 1 },
        maxRows: { type: Number, default: 6 },
    },
    emits: ['update:modelValue', 'submit'],
    watch: {
        modelValue() { this.$nextTick(() => this.resize()); },
    },
    mounted() { this.resize(); },
    methods: {
        resize() {
            const el = this.$refs.area;
            if (!el) return;
            // 先塌回去再量,否则删字时高度只增不减
            el.style.height = 'auto';
            const line = parseFloat(getComputedStyle(el).lineHeight) || 20;
            const max = line * this.maxRows;
            el.style.height = `${Math.min(el.scrollHeight, max)}px`;
            el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
        },
        onKeydown(e) {
            // 回车发送、Shift+回车换行。移动端软键盘的 Enter 不带 shiftKey,
            // 但也不会触发 keydown 的 isComposing,所以这里同时挡一下输入法组字。
            if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
            e.preventDefault();
            this.$emit('submit');
        },
    },
    template: `
        <textarea
            ref="area"
            class="pl-textarea"
            :rows="minRows"
            :placeholder="placeholder"
            :value="modelValue"
            @input="$emit('update:modelValue', $event.target.value)"
            @keydown="onKeydown"
        ></textarea>
    `,
};

export const SHARED_COMPONENTS = {
    PlIcon, PlAvatar, PlButton, PlSegmented, PlSwitch,
    PlSectionTitle, PlEmpty, PlSpinner, PlSheet, PlTextarea,
};
