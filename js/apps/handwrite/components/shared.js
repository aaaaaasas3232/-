/**
 * 手书 · 通用控件
 *
 * 全部是 Options API 普通对象(项目约定,Vue 是浏览器全局,**不 import vue**)。
 *
 * ★ 一条硬规矩:这里没有任何颜色。配色全部来自 `index.css` 的 `--hs-*`。
 * ★ 一条硬规矩:没有 emoji。要符号就去 `icons.js` 加一条 path。
 */

import { icon } from '../icons.js';

// ============================================================
// 图标
// ============================================================

export const HsIcon = {
    name: 'HsIcon',
    props: {
        name: { type: String, required: true },
        size: { type: [Number, String], default: 0 },
    },
    computed: {
        // v-html 的内容来自本 App 的图标表,是编译期常量,不含任何用户输入
        html() { return icon(this.name); },
        style() {
            if (!this.size) return null;
            const px = typeof this.size === 'number' ? `${this.size}px` : this.size;
            return { '--hs-icon-size': px };
        },
    },
    template: `<span class="hs-icon" :style="style" v-html="html"></span>`,
};

// ============================================================
// 按钮
// ============================================================

export const HsButton = {
    name: 'HsButton',
    components: { HsIcon },
    props: {
        variant: { type: String, default: 'quiet' },   // primary | ghost | quiet | danger
        size: { type: String, default: 'md' },         // sm | md | lg
        iconName: { type: String, default: '' },
        iconOnly: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
        loading: { type: Boolean, default: false },
        block: { type: Boolean, default: false },
        active: { type: Boolean, default: false },
        label: { type: String, default: '' },
    },
    emits: ['click'],
    template: `
        <button
            type="button"
            class="hs-btn"
            :class="['hs-btn--' + variant, 'hs-btn--' + size, { 'is-icon-only': iconOnly, 'is-block': block, 'is-loading': loading, 'is-active': active }]"
            :disabled="disabled || loading"
            :aria-label="iconOnly ? (label || iconName) : null"
            :aria-pressed="active ? 'true' : null"
            @click="$emit('click', $event)"
        >
            <span v-if="loading" class="hs-btn-spin" aria-hidden="true"></span>
            <HsIcon v-else-if="iconName" :name="iconName" />
            <span v-if="!iconOnly" class="hs-btn-label"><slot>{{ label }}</slot></span>
        </button>
    `,
};

// ============================================================
// 表单
// ============================================================

export const HsField = {
    name: 'HsField',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
    },
    template: `
        <label class="hs-field">
            <span v-if="label" class="hs-field-label">{{ label }}</span>
            <slot></slot>
            <span v-if="hint" class="hs-field-hint">{{ hint }}</span>
        </label>
    `,
};

export const HsInput = {
    name: 'HsInput',
    props: {
        modelValue: { type: [String, Number], default: '' },
        placeholder: { type: String, default: '' },
        type: { type: String, default: 'text' },
        maxlength: { type: Number, default: 0 },
        disabled: { type: Boolean, default: false },
    },
    emits: ['update:modelValue', 'enter'],
    template: `
        <input
            class="hs-input"
            :type="type"
            :value="modelValue"
            :placeholder="placeholder"
            :maxlength="maxlength || null"
            :disabled="disabled"
            @input="$emit('update:modelValue', $event.target.value)"
            @keydown.enter="$emit('enter', $event)"
        />
    `,
};

export const HsTextarea = {
    name: 'HsTextarea',
    props: {
        modelValue: { type: String, default: '' },
        placeholder: { type: String, default: '' },
        rows: { type: Number, default: 4 },
        maxlength: { type: Number, default: 0 },
        mono: { type: Boolean, default: false },
    },
    emits: ['update:modelValue'],
    template: `
        <textarea
            class="hs-textarea"
            :class="{ 'is-mono': mono }"
            :rows="rows"
            :value="modelValue"
            :placeholder="placeholder"
            :maxlength="maxlength || null"
            spellcheck="false"
            @input="$emit('update:modelValue', $event.target.value)"
        ></textarea>
    `,
};

export const HsSelect = {
    name: 'HsSelect',
    props: {
        modelValue: { type: [String, Number], default: '' },
        options: { type: Array, default: () => [] },   // [{ value, label }]
        placeholder: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    template: `
        <select class="hs-select" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
            <option v-if="placeholder" value="">{{ placeholder }}</option>
            <option v-for="opt in options" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
        </select>
    `,
};

export const HsSwitch = {
    name: 'HsSwitch',
    props: {
        modelValue: { type: Boolean, default: false },
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
        disabled: { type: Boolean, default: false },
    },
    emits: ['update:modelValue'],
    template: `
        <label class="hs-switch" :class="{ 'is-disabled': disabled }">
            <span class="hs-switch-text">
                <span class="hs-switch-label">{{ label }}</span>
                <span v-if="hint" class="hs-switch-hint">{{ hint }}</span>
            </span>
            <input
                type="checkbox"
                class="hs-switch-input"
                :checked="modelValue"
                :disabled="disabled"
                @change="$emit('update:modelValue', $event.target.checked)"
            />
            <span class="hs-switch-track" aria-hidden="true"><i class="hs-switch-thumb"></i></span>
        </label>
    `,
};

export const HsSlider = {
    name: 'HsSlider',
    props: {
        modelValue: { type: Number, default: 0 },
        min: { type: Number, default: 0 },
        max: { type: Number, default: 100 },
        step: { type: Number, default: 1 },
        label: { type: String, default: '' },
        suffix: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    template: `
        <label class="hs-slider">
            <span class="hs-slider-head">
                <span class="hs-slider-label">{{ label }}</span>
                <em class="hs-slider-value">{{ modelValue }}{{ suffix }}</em>
            </span>
            <input
                type="range"
                class="hs-slider-input"
                :min="min" :max="max" :step="step"
                :value="modelValue"
                @input="$emit('update:modelValue', Number($event.target.value))"
            />
        </label>
    `,
};

/** 分段控件 —— 手机上比下拉框好点得多 */
export const HsSegment = {
    name: 'HsSegment',
    props: {
        modelValue: { type: [String, Number], default: '' },
        options: { type: Array, default: () => [] },   // [{ value, label }]
        label: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    template: `
        <div class="hs-segment-wrap">
            <span v-if="label" class="hs-field-label">{{ label }}</span>
            <div class="hs-segment" role="group">
                <button
                    v-for="opt in options"
                    :key="String(opt.value)"
                    type="button"
                    class="hs-segment-item"
                    :class="{ 'is-on': String(modelValue) === String(opt.value) }"
                    @click="$emit('update:modelValue', opt.value)"
                >{{ opt.label }}</button>
            </div>
        </div>
    `,
};

// ============================================================
// 结构
// ============================================================

export const HsSection = {
    name: 'HsSection',
    components: { HsIcon },
    props: {
        title: { type: String, default: '' },
        hint: { type: String, default: '' },
        iconName: { type: String, default: '' },
        collapsible: { type: Boolean, default: false },
        open: { type: Boolean, default: true },
    },
    emits: ['toggle'],
    template: `
        <section class="hs-section">
            <header v-if="title" class="hs-section-head" :class="{ 'is-clickable': collapsible }" @click="collapsible && $emit('toggle')">
                <HsIcon v-if="collapsible" :name="open ? 'chevronDown' : 'chevronRight'" />
                <HsIcon v-else-if="iconName" :name="iconName" />
                <span class="hs-section-title">{{ title }}</span>
                <span v-if="hint" class="hs-section-hint">{{ hint }}</span>
                <span class="hs-section-extra"><slot name="extra"></slot></span>
            </header>
            <div v-if="!collapsible || open" class="hs-section-body"><slot></slot></div>
        </section>
    `,
};

export const HsEmpty = {
    name: 'HsEmpty',
    components: { HsIcon },
    props: {
        iconName: { type: String, default: 'info' },
        text: { type: String, default: '还没有内容' },
        hint: { type: String, default: '' },
    },
    template: `
        <div class="hs-empty">
            <HsIcon class="hs-empty-icon" :name="iconName" />
            <p class="hs-empty-text">{{ text }}</p>
            <p v-if="hint" class="hs-empty-hint">{{ hint }}</p>
            <div class="hs-empty-action"><slot></slot></div>
        </div>
    `,
};

export const HsSpinner = {
    name: 'HsSpinner',
    props: { label: { type: String, default: '' } },
    template: `
        <div class="hs-spinner" role="status">
            <span class="hs-spinner-ring" aria-hidden="true"></span>
            <span v-if="label" class="hs-spinner-label">{{ label }}</span>
        </div>
    `,
};

export const HsTag = {
    name: 'HsTag',
    props: { tone: { type: String, default: '' } },
    template: `<span class="hs-tag" :data-tone="tone || null"><slot></slot></span>`,
};

/**
 * 底部抽屉。
 *
 * 手机上 390px 宽,侧边面板放不下,所有次要内容一律从底部推上来。
 * ★ z-index 必须 < 6(框架的 `.app-bottom` 占 6),
 *   否则抽屉会盖住 Home 指示条,用户退不出 App。CSS 里给的是 5。
 */
export const HsSheet = {
    name: 'HsSheet',
    components: { HsIcon },
    props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        /** 'half' | 'full' */
        height: { type: String, default: 'half' },
    },
    emits: ['close'],
    template: `
        <div class="hs-sheet-mask" @click.self="$emit('close')">
            <section class="hs-sheet" :class="'hs-sheet--' + height" role="dialog" :aria-label="title">
                <header class="hs-sheet-head">
                    <span class="hs-sheet-grip" aria-hidden="true"></span>
                    <div class="hs-sheet-title-wrap">
                        <h2 class="hs-sheet-title">{{ title }}</h2>
                        <p v-if="subtitle" class="hs-sheet-sub">{{ subtitle }}</p>
                    </div>
                    <div class="hs-sheet-actions"><slot name="actions"></slot></div>
                    <button type="button" class="hs-sheet-close" aria-label="收起" @click="$emit('close')">
                        <HsIcon name="chevronDown" />
                    </button>
                </header>
                <div class="hs-sheet-body"><slot></slot></div>
                <footer v-if="$slots.footer" class="hs-sheet-foot"><slot name="footer"></slot></footer>
            </section>
        </div>
    `,
};

export const SHARED_COMPONENTS = {
    HsIcon, HsButton, HsField, HsInput, HsTextarea, HsSelect,
    HsSwitch, HsSlider, HsSegment, HsSection, HsEmpty, HsSpinner, HsTag, HsSheet,
};
