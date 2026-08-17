/**
 * 情景剧场 · 通用控件
 *
 * 全部是 Options API 普通对象(项目约定,和 relax-app / 湛蓝回忆一致)。
 *
 * ★ 一条硬规矩:这里没有任何颜色。配色全部来自 `_theme.css` 的 `--sp-*`。
 *   唯一出现色值的地方是 `SpColorRow` 的 `modelValue`,那是**用户在调的颜色**。
 *
 * ★ 和气泡机的 `shared.js` 是两份实现,不是遗漏:
 *   类名前缀不同(`sp-` / `bb-`),而 CSS 作用域靠的就是这个前缀。
 *   真正共用的是**逻辑**(配色工具箱、气泡渲染),已经抽到 `src/core/` 了。
 */

import { icon } from '../icons.js';
import { isHexColor } from '@/src/core/bubble-style.js';

export const SpIcon = {
    name: 'SpIcon',
    props: {
        name: { type: String, required: true },
        size: { type: [Number, String], default: 0 },
    },
    computed: {
        html() { return icon(this.name); },
        style() {
            if (!this.size) return null;
            const px = typeof this.size === 'number' ? `${this.size}px` : this.size;
            return { '--sp-icon-size': px };
        },
    },
    template: `<span class="sp-icon" :style="style" v-html="html"></span>`,
};

export const SpButton = {
    name: 'SpButton',
    components: { SpIcon },
    props: {
        variant: { type: String, default: 'quiet' },   // primary | ghost | quiet | danger | line
        size: { type: String, default: 'md' },         // sm | md | lg
        iconName: { type: String, default: '' },
        iconOnly: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
        block: { type: Boolean, default: false },
        label: { type: String, default: '' },
    },
    emits: ['click'],
    template: `
        <button
            type="button"
            class="sp-btn"
            :class="['sp-btn--' + variant, 'sp-btn--' + size, { 'is-icon-only': iconOnly, 'is-block': block }]"
            :disabled="disabled"
            :aria-label="iconOnly ? (label || iconName) : null"
            @click="$emit('click', $event)"
        >
            <SpIcon v-if="iconName" :name="iconName" />
            <span v-if="!iconOnly" class="sp-btn-label"><slot>{{ label }}</slot></span>
        </button>
    `,
};

export const SpField = {
    name: 'SpField',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
    },
    template: `
        <label class="sp-field">
            <span v-if="label" class="sp-field-label">{{ label }}</span>
            <slot></slot>
            <span v-if="hint" class="sp-field-hint">{{ hint }}</span>
        </label>
    `,
};

export const SpInput = {
    name: 'SpInput',
    props: {
        modelValue: { type: [String, Number], default: '' },
        placeholder: { type: String, default: '' },
        type: { type: String, default: 'text' },
        maxlength: { type: Number, default: 0 },
        disabled: { type: Boolean, default: false },
        mono: { type: Boolean, default: false },
    },
    emits: ['update:modelValue', 'enter'],
    template: `
        <input
            class="sp-input"
            :class="{ 'is-mono': mono }"
            :type="type"
            :value="modelValue"
            :placeholder="placeholder"
            :maxlength="maxlength || null"
            :disabled="disabled"
            spellcheck="false"
            @input="$emit('update:modelValue', $event.target.value)"
            @keydown.enter="$emit('enter', $event)"
        />
    `,
};

export const SpTextarea = {
    name: 'SpTextarea',
    props: {
        modelValue: { type: String, default: '' },
        placeholder: { type: String, default: '' },
        rows: { type: Number, default: 3 },
        maxlength: { type: Number, default: 0 },
        mono: { type: Boolean, default: false },
    },
    emits: ['update:modelValue'],
    template: `
        <textarea
            class="sp-textarea"
            :class="{ 'is-mono': mono }"
            :rows="rows"
            :value="modelValue"
            :placeholder="placeholder"
            :maxlength="maxlength || null"
            @input="$emit('update:modelValue', $event.target.value)"
        ></textarea>
    `,
};

export const SpSelect = {
    name: 'SpSelect',
    props: {
        modelValue: { type: [String, Number], default: '' },
        options: { type: Array, default: () => [] },
        placeholder: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    template: `
        <select class="sp-select" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
            <option v-if="placeholder" value="">{{ placeholder }}</option>
            <option v-for="opt in options" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
        </select>
    `,
};

export const SpSegmented = {
    name: 'SpSegmented',
    props: {
        modelValue: { type: [String, Number], default: '' },
        options: { type: Array, default: () => [] },
        block: { type: Boolean, default: true },
    },
    emits: ['update:modelValue'],
    template: `
        <div class="sp-seg" :class="{ 'is-block': block }" role="group">
            <button
                v-for="opt in options"
                :key="String(opt.value)"
                type="button"
                class="sp-seg-item"
                :class="{ 'is-active': String(modelValue) === String(opt.value) }"
                @click="$emit('update:modelValue', opt.value)"
            >{{ opt.label }}</button>
        </div>
    `,
};

export const SpSwitch = {
    name: 'SpSwitch',
    props: {
        modelValue: { type: Boolean, default: false },
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
        disabled: { type: Boolean, default: false },
    },
    emits: ['update:modelValue'],
    template: `
        <label class="sp-switch" :class="{ 'is-disabled': disabled }">
            <span class="sp-switch-text">
                <span class="sp-switch-label">{{ label }}</span>
                <span v-if="hint" class="sp-switch-hint">{{ hint }}</span>
            </span>
            <input
                type="checkbox"
                class="sp-switch-input"
                :checked="modelValue"
                :disabled="disabled"
                @change="$emit('update:modelValue', $event.target.checked)"
            />
            <span class="sp-switch-track" aria-hidden="true"><i class="sp-switch-thumb"></i></span>
        </label>
    `,
};

/** 滑块 —— 右侧数值可以直接输入 */
export const SpSlider = {
    name: 'SpSlider',
    props: {
        modelValue: { type: Number, default: 0 },
        min: { type: Number, default: 0 },
        max: { type: Number, default: 100 },
        step: { type: Number, default: 1 },
        label: { type: String, default: '' },
        suffix: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    methods: {
        emit(raw) {
            const n = Number(raw);
            if (!Number.isFinite(n)) return;
            this.$emit('update:modelValue', Math.min(this.max, Math.max(this.min, n)));
        },
    },
    template: `
        <div class="sp-slider">
            <div class="sp-slider-head">
                <span class="sp-slider-label">{{ label }}</span>
                <span class="sp-slider-value">
                    <input
                        class="sp-slider-num"
                        type="number"
                        :value="modelValue"
                        :min="min" :max="max" :step="step"
                        :aria-label="label"
                        @input="emit($event.target.value)"
                    />
                    <em v-if="suffix">{{ suffix }}</em>
                </span>
            </div>
            <input
                type="range"
                class="sp-slider-input"
                :min="min" :max="max" :step="step"
                :value="modelValue"
                :aria-label="label"
                @input="emit($event.target.value)"
            />
        </div>
    `,
};

/**
 * 一行颜色。
 *
 * ★ `<input type="color">` 只吃 `#rrggbb`,`rgba(...)` 塞进去会被当成非法值
 *   **静默显示成黑色**。所以色块套 `v-if="swatchable"`,非 hex 只给文本框。
 */
export const SpColorRow = {
    name: 'SpColorRow',
    components: { SpIcon },
    props: {
        modelValue: { type: String, default: '' },
        label: { type: String, default: '' },
        token: { type: String, default: '' },
        changed: { type: Boolean, default: false },
        resettable: { type: Boolean, default: false },
    },
    emits: ['update:modelValue', 'reset', 'copy-token'],
    computed: {
        swatchable() { return isHexColor(this.modelValue); },
    },
    template: `
        <div class="sp-color-row">
            <span class="sp-color-meta">
                <span class="sp-color-label">
                    {{ label }}<em v-if="changed" class="sp-color-flag">已改</em>
                </span>
                <code
                    v-if="token"
                    class="sp-color-token"
                    title="点击复制变量名"
                    @click="$emit('copy-token', token)"
                >{{ token }}</code>
            </span>
            <input
                v-if="swatchable"
                type="color"
                class="sp-color-swatch"
                :value="modelValue"
                :aria-label="label"
                @input="$emit('update:modelValue', $event.target.value)"
            />
            <input
                type="text"
                class="sp-color-hex"
                :value="modelValue"
                :aria-label="label + ' 色值'"
                spellcheck="false"
                @change="$emit('update:modelValue', $event.target.value)"
            />
            <button
                v-if="resettable && changed"
                type="button"
                class="sp-color-reset"
                aria-label="还原"
                @click="$emit('reset')"
            ><SpIcon name="refresh" /></button>
        </div>
    `,
};

export const SpSection = {
    name: 'SpSection',
    components: { SpIcon },
    props: {
        title: { type: String, default: '' },
        hint: { type: String, default: '' },
        iconName: { type: String, default: '' },
        collapsible: { type: Boolean, default: false },
        open: { type: Boolean, default: true },
    },
    emits: ['toggle'],
    template: `
        <section class="sp-section">
            <header
                v-if="title"
                class="sp-section-head"
                :class="{ 'is-clickable': collapsible }"
                @click="collapsible && $emit('toggle')"
            >
                <SpIcon v-if="iconName" :name="iconName" />
                <span class="sp-section-title">{{ title }}</span>
                <span v-if="hint" class="sp-section-hint">{{ hint }}</span>
                <span class="sp-section-extra"><slot name="extra"></slot></span>
                <SpIcon v-if="collapsible" class="sp-section-caret" :name="open ? 'chevronDown' : 'chevronRight'" />
            </header>
            <div v-if="!collapsible || open" class="sp-section-body"><slot></slot></div>
        </section>
    `,
};

export const SpEmpty = {
    name: 'SpEmpty',
    components: { SpIcon },
    props: {
        iconName: { type: String, default: 'info' },
        text: { type: String, default: '还没有内容' },
        hint: { type: String, default: '' },
    },
    template: `
        <div class="sp-empty">
            <SpIcon class="sp-empty-icon" :name="iconName" />
            <p class="sp-empty-text">{{ text }}</p>
            <p v-if="hint" class="sp-empty-hint">{{ hint }}</p>
            <div class="sp-empty-action"><slot></slot></div>
        </div>
    `,
};

export const SpSpinner = {
    name: 'SpSpinner',
    props: { label: { type: String, default: '' } },
    template: `
        <div class="sp-spinner" role="status">
            <span class="sp-spinner-ring" aria-hidden="true"></span>
            <span v-if="label" class="sp-spinner-label">{{ label }}</span>
        </div>
    `,
};

export const SpTag = {
    name: 'SpTag',
    props: { tone: { type: String, default: '' } },
    template: `<span class="sp-tag" :data-tone="tone || null"><slot></slot></span>`,
};

/** 列表里的一行 —— 情景 / 存档 / 正则 / 文案共用 */
export const SpRow = {
    name: 'SpRow',
    components: { SpIcon },
    props: {
        title: { type: String, default: '' },
        sub: { type: String, default: '' },
        active: { type: Boolean, default: false },
        badge: { type: String, default: '' },
    },
    emits: ['open'],
    template: `
        <div class="sp-row" :class="{ 'is-active': active }">
            <button type="button" class="sp-row-main" @click="$emit('open')">
                <span class="sp-row-title">
                    {{ title }}<em v-if="badge" class="sp-row-badge">{{ badge }}</em>
                </span>
                <span v-if="sub" class="sp-row-sub">{{ sub }}</span>
            </button>
            <div class="sp-row-acts"><slot name="actions"></slot></div>
        </div>
    `,
};

export const SHARED_COMPONENTS = {
    SpIcon, SpButton, SpField, SpInput, SpTextarea, SpSelect, SpSegmented,
    SpSwitch, SpSlider, SpColorRow, SpSection, SpEmpty, SpSpinner, SpTag, SpRow,
};
