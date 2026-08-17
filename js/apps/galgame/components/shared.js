/**
 * 湛蓝回忆 · 通用控件
 *
 * 全部是 Options API 普通对象(项目约定,和 relax-app / 梦境编织一致)。
 *
 * 这一层存在的意义:上层不再手写 `<button class="…">` 和一堆重复的表单结构。
 * 原型 8000 行里相当大一部分就是 `document.createElement` + `innerHTML` 拼这些东西,
 * 同一种「带标题的卡片」出现了七八遍,每次样式还都差一点。
 *
 * ★ 一条硬规矩:这里没有任何颜色。配色全部来自 `_theme.css` 的 `--gg-*`。
 */

import { icon } from '../icons.js';

// ============================================================
// 图标
// ============================================================

export const GgIcon = {
    name: 'GgIcon',
    props: {
        name: { type: String, required: true },
        size: { type: [Number, String], default: 0 },
    },
    computed: {
        html() { return icon(this.name); },
        style() {
            if (!this.size) return null;
            const px = typeof this.size === 'number' ? `${this.size}px` : this.size;
            return { '--gg-icon-size': px };
        },
    },
    template: `<span class="gg-icon" :style="style" v-html="html"></span>`,
};

// ============================================================
// 按钮
// ============================================================

export const GgButton = {
    name: 'GgButton',
    components: { GgIcon },
    props: {
        variant: { type: String, default: 'quiet' },   // primary | ghost | quiet | danger
        size: { type: String, default: 'md' },         // sm | md | lg
        iconName: { type: String, default: '' },
        iconOnly: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
        loading: { type: Boolean, default: false },
        block: { type: Boolean, default: false },
        label: { type: String, default: '' },
    },
    emits: ['click'],
    template: `
        <button
            type="button"
            class="gg-btn"
            :class="['gg-btn--' + variant, 'gg-btn--' + size, { 'is-icon-only': iconOnly, 'is-block': block, 'is-loading': loading }]"
            :disabled="disabled || loading"
            :aria-label="iconOnly ? (label || iconName) : null"
            @click="$emit('click', $event)"
        >
            <span v-if="loading" class="gg-btn-spinner" aria-hidden="true"></span>
            <GgIcon v-else-if="iconName" :name="iconName" />
            <span v-if="!iconOnly" class="gg-btn-label"><slot>{{ label }}</slot></span>
        </button>
    `,
};

// ============================================================
// 表单
// ============================================================

export const GgField = {
    name: 'GgField',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
    },
    template: `
        <label class="gg-field">
            <span v-if="label" class="gg-field-label">{{ label }}</span>
            <slot></slot>
            <span v-if="hint" class="gg-field-hint">{{ hint }}</span>
        </label>
    `,
};

export const GgInput = {
    name: 'GgInput',
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
            class="gg-input"
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

export const GgTextarea = {
    name: 'GgTextarea',
    props: {
        modelValue: { type: String, default: '' },
        placeholder: { type: String, default: '' },
        rows: { type: Number, default: 3 },
        maxlength: { type: Number, default: 0 },
    },
    emits: ['update:modelValue'],
    template: `
        <textarea
            class="gg-textarea"
            :rows="rows"
            :value="modelValue"
            :placeholder="placeholder"
            :maxlength="maxlength || null"
            @input="$emit('update:modelValue', $event.target.value)"
        ></textarea>
    `,
};

export const GgSelect = {
    name: 'GgSelect',
    props: {
        modelValue: { type: [String, Number], default: '' },
        options: { type: Array, default: () => [] },   // [{ value, label }]
        placeholder: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    template: `
        <select class="gg-select" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
            <option v-if="placeholder" value="">{{ placeholder }}</option>
            <option v-for="opt in options" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
        </select>
    `,
};

export const GgSwitch = {
    name: 'GgSwitch',
    props: {
        modelValue: { type: Boolean, default: false },
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
        disabled: { type: Boolean, default: false },
    },
    emits: ['update:modelValue'],
    template: `
        <label class="gg-switch" :class="{ 'is-disabled': disabled }">
            <span class="gg-switch-text">
                <span class="gg-switch-label">{{ label }}</span>
                <span v-if="hint" class="gg-switch-hint">{{ hint }}</span>
            </span>
            <input
                type="checkbox"
                class="gg-switch-input"
                :checked="modelValue"
                :disabled="disabled"
                @change="$emit('update:modelValue', $event.target.checked)"
            />
            <span class="gg-switch-track" aria-hidden="true"><i class="gg-switch-thumb"></i></span>
        </label>
    `,
};

export const GgSlider = {
    name: 'GgSlider',
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
        <label class="gg-slider">
            <span class="gg-slider-head">
                <span class="gg-slider-label">{{ label }}</span>
                <em class="gg-slider-value">{{ modelValue }}{{ suffix }}</em>
            </span>
            <input
                type="range"
                class="gg-slider-input"
                :min="min" :max="max" :step="step"
                :value="modelValue"
                @input="$emit('update:modelValue', Number($event.target.value))"
            />
        </label>
    `,
};

// ============================================================
// 结构
// ============================================================

export const GgSection = {
    name: 'GgSection',
    components: { GgIcon },
    props: {
        title: { type: String, default: '' },
        hint: { type: String, default: '' },
        iconName: { type: String, default: '' },
        collapsible: { type: Boolean, default: false },
        open: { type: Boolean, default: true },
    },
    emits: ['toggle'],
    template: `
        <section class="gg-section">
            <header v-if="title" class="gg-section-head" :class="{ 'is-clickable': collapsible }" @click="collapsible && $emit('toggle')">
                <GgIcon v-if="collapsible" :name="open ? 'chevronDown' : 'chevronRight'" />
                <GgIcon v-else-if="iconName" :name="iconName" />
                <span class="gg-section-title">{{ title }}</span>
                <span v-if="hint" class="gg-section-hint">{{ hint }}</span>
                <span class="gg-section-extra"><slot name="extra"></slot></span>
            </header>
            <div v-if="!collapsible || open" class="gg-section-body"><slot></slot></div>
        </section>
    `,
};

export const GgEmpty = {
    name: 'GgEmpty',
    components: { GgIcon },
    props: {
        iconName: { type: String, default: 'info' },
        text: { type: String, default: '还没有内容' },
        hint: { type: String, default: '' },
    },
    template: `
        <div class="gg-empty">
            <GgIcon class="gg-empty-icon" :name="iconName" />
            <p class="gg-empty-text">{{ text }}</p>
            <p v-if="hint" class="gg-empty-hint">{{ hint }}</p>
            <div class="gg-empty-action"><slot></slot></div>
        </div>
    `,
};

export const GgSpinner = {
    name: 'GgSpinner',
    props: { label: { type: String, default: '' } },
    template: `
        <div class="gg-spinner" role="status">
            <span class="gg-spinner-ring" aria-hidden="true"></span>
            <span v-if="label" class="gg-spinner-label">{{ label }}</span>
        </div>
    `,
};

export const GgTag = {
    name: 'GgTag',
    props: { tone: { type: String, default: '' } },
    template: `<span class="gg-tag" :data-tone="tone || null"><slot></slot></span>`,
};

/** 好感度条 —— 颜色档位走 data-tone,换主题时跟着变 */
export const GgAffectionBar = {
    name: 'GgAffectionBar',
    props: {
        value: { type: Number, default: 50 },
        tone: { type: String, default: 'mid' },
    },
    computed: {
        width() { return `${Math.max(0, Math.min(100, this.value))}%`; },
    },
    template: `
        <span class="gg-affection-bar" :data-tone="tone">
            <i class="gg-affection-fill" :style="{ width: width }"></i>
        </span>
    `,
};

export const SHARED_COMPONENTS = {
    GgIcon, GgButton, GgField, GgInput, GgTextarea, GgSelect,
    GgSwitch, GgSlider, GgSection, GgEmpty, GgSpinner, GgTag, GgAffectionBar,
};
