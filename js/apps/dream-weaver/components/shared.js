/**
 * 梦境编织 · 通用控件
 *
 * 全部是 Options API 普通对象(项目约定,和 relax-app 一致)。
 * 这一层存在的意义:上层页面不再手写 `<button class="...">` 和一堆重复的表单结构 ——
 * 原版 30000 行里有相当大一部分就是这些东西反复复制粘贴。
 *
 * ★ 一条硬规矩:这里没有任何颜色。所有配色来自 `_theme.css` 的 `--dw-*`。
 */

import { icon } from '../icons.js';

// ============================================================
// 图标
// ============================================================

export const DwIcon = {
    name: 'DwIcon',
    props: {
        name: { type: String, required: true },
        size: { type: [Number, String], default: 0 },
    },
    computed: {
        html() { return icon(this.name); },
        style() {
            if (!this.size) return null;
            const px = typeof this.size === 'number' ? `${this.size}px` : this.size;
            return { '--dw-icon-size': px };
        },
    },
    template: `<span class="dw-icon" :style="style" v-html="html"></span>`,
};

// ============================================================
// 按钮
// ============================================================

export const DwButton = {
    name: 'DwButton',
    components: { DwIcon },
    props: {
        // primary 实心主色 / ghost 描边 / quiet 无边框 / danger 危险
        variant: { type: String, default: 'quiet' },
        size: { type: String, default: 'md' },      // sm | md | lg
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
            class="dw-btn"
            :class="[
                'dw-btn--' + variant,
                'dw-btn--' + size,
                { 'is-icon-only': iconOnly, 'is-block': block, 'is-loading': loading }
            ]"
            :disabled="disabled || loading"
            :aria-label="iconOnly ? (label || iconName) : null"
            @click="$emit('click', $event)"
        >
            <span v-if="loading" class="dw-btn-spinner" aria-hidden="true"></span>
            <DwIcon v-else-if="iconName" :name="iconName" />
            <span v-if="!iconOnly" class="dw-btn-label"><slot>{{ label }}</slot></span>
        </button>
    `,
};

// ============================================================
// 表单
// ============================================================

export const DwField = {
    name: 'DwField',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
        required: { type: Boolean, default: false },
    },
    template: `
        <label class="dw-field">
            <span v-if="label" class="dw-field-label">
                {{ label }}<em v-if="required" class="dw-field-required">*</em>
            </span>
            <slot></slot>
            <span v-if="hint" class="dw-field-hint">{{ hint }}</span>
        </label>
    `,
};

export const DwInput = {
    name: 'DwInput',
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
            class="dw-input"
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

export const DwTextarea = {
    name: 'DwTextarea',
    props: {
        modelValue: { type: String, default: '' },
        placeholder: { type: String, default: '' },
        rows: { type: Number, default: 4 },
        maxlength: { type: Number, default: 0 },
        autoGrow: { type: Boolean, default: false },
        maxHeight: { type: Number, default: 160 },
    },
    emits: ['update:modelValue'],
    methods: {
        onInput(event) {
            this.$emit('update:modelValue', event.target.value);
            if (this.autoGrow) this.resize();
        },
        resize() {
            const el = this.$refs.area;
            if (!el) return;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, this.maxHeight)}px`;
        },
    },
    mounted() {
        if (this.autoGrow) this.resize();
    },
    watch: {
        // 外部清空输入框(比如发送后)时也要把高度收回去,否则会留一个空白的高框
        modelValue() {
            if (this.autoGrow) this.$nextTick(() => this.resize());
        },
    },
    template: `
        <textarea
            ref="area"
            class="dw-textarea"
            :class="{ 'is-auto': autoGrow }"
            :value="modelValue"
            :placeholder="placeholder"
            :rows="rows"
            :maxlength="maxlength || null"
            @input="onInput"
        ></textarea>
    `,
};

export const DwSelect = {
    name: 'DwSelect',
    props: {
        modelValue: { type: [String, Number], default: '' },
        options: { type: Array, required: true },   // [{ id, label, hint? }]
    },
    emits: ['update:modelValue'],
    template: `
        <div class="dw-select">
            <select
                class="dw-select-native"
                :value="modelValue"
                @change="$emit('update:modelValue', $event.target.value)"
            >
                <option v-for="opt in options" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
            </select>
            <span class="dw-select-arrow" aria-hidden="true"></span>
        </div>
    `,
};

/** 分段选择器 —— 选项少(2~4 个)时比下拉好用,一眼能看到全部选项 */
export const DwSegmented = {
    name: 'DwSegmented',
    props: {
        modelValue: { type: [String, Number], default: '' },
        options: { type: Array, required: true },
    },
    emits: ['update:modelValue'],
    template: `
        <div class="dw-segmented" role="tablist">
            <button
                v-for="opt in options"
                :key="opt.id"
                type="button"
                class="dw-segmented-item"
                :class="{ 'is-active': String(opt.id) === String(modelValue) }"
                role="tab"
                :aria-selected="String(String(opt.id) === String(modelValue))"
                :title="opt.hint || opt.label"
                @click="$emit('update:modelValue', opt.id)"
            >{{ opt.label }}</button>
        </div>
    `,
};

export const DwSwitch = {
    name: 'DwSwitch',
    props: {
        modelValue: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
        label: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    template: `
        <button
            type="button"
            class="dw-switch"
            :class="{ 'is-on': modelValue, 'is-disabled': disabled }"
            :disabled="disabled"
            role="switch"
            :aria-checked="String(modelValue)"
            :aria-label="label || null"
            @click="$emit('update:modelValue', !modelValue)"
        ><span class="dw-switch-thumb"></span></button>
    `,
};

export const DwSlider = {
    name: 'DwSlider',
    props: {
        modelValue: { type: Number, default: 0 },
        min: { type: Number, default: 0 },
        max: { type: Number, default: 100 },
        step: { type: Number, default: 1 },
        suffix: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    computed: {
        percent() {
            const span = this.max - this.min;
            if (span <= 0) return 0;
            return ((this.modelValue - this.min) / span) * 100;
        },
    },
    template: `
        <div class="dw-slider">
            <input
                class="dw-slider-input"
                type="range"
                :min="min" :max="max" :step="step"
                :value="modelValue"
                :style="{ '--dw-slider-percent': percent + '%' }"
                @input="$emit('update:modelValue', Number($event.target.value))"
            />
            <span class="dw-slider-value">{{ modelValue }}{{ suffix }}</span>
        </div>
    `,
};

// ============================================================
// 布局
// ============================================================

/** 分区卡片 */
export const DwSection = {
    name: 'DwSection',
    components: { DwIcon },
    props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        iconName: { type: String, default: '' },
        collapsible: { type: Boolean, default: false },
        defaultOpen: { type: Boolean, default: true },
    },
    data() {
        return { open: this.defaultOpen };
    },
    template: `
        <section class="dw-section" :class="{ 'is-collapsed': collapsible && !open }">
            <header v-if="title || $slots.action" class="dw-section-head">
                <button
                    v-if="collapsible"
                    type="button"
                    class="dw-section-toggle"
                    :aria-expanded="String(open)"
                    @click="open = !open"
                >
                    <DwIcon :name="open ? 'chevronDown' : 'chevronRight'" />
                </button>
                <DwIcon v-else-if="iconName" :name="iconName" class="dw-section-icon" />
                <div class="dw-section-titles">
                    <h3 v-if="title" class="dw-section-title">{{ title }}</h3>
                    <p v-if="subtitle" class="dw-section-subtitle">{{ subtitle }}</p>
                </div>
                <div v-if="$slots.action" class="dw-section-action"><slot name="action"></slot></div>
            </header>
            <div v-show="!collapsible || open" class="dw-section-body"><slot></slot></div>
        </section>
    `,
};

/** 列表行(点进去 / 带开关 / 带说明) */
export const DwRow = {
    name: 'DwRow',
    components: { DwIcon },
    props: {
        label: { type: String, required: true },
        value: { type: String, default: '' },
        hint: { type: String, default: '' },
        iconName: { type: String, default: '' },
        chevron: { type: Boolean, default: false },
        danger: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
    },
    emits: ['click'],
    computed: {
        interactive() {
            return this.chevron || this.$attrs.onClick != null;
        },
    },
    template: `
        <div
            class="dw-row"
            :class="{ 'is-danger': danger, 'is-disabled': disabled, 'is-interactive': interactive }"
            :role="interactive ? 'button' : null"
            :tabindex="interactive && !disabled ? 0 : null"
            @click="!disabled && $emit('click', $event)"
            @keydown.enter="!disabled && $emit('click', $event)"
        >
            <DwIcon v-if="iconName" :name="iconName" class="dw-row-icon" />
            <div class="dw-row-main">
                <p class="dw-row-label">{{ label }}</p>
                <p v-if="hint" class="dw-row-hint">{{ hint }}</p>
            </div>
            <span v-if="value" class="dw-row-value">{{ value }}</span>
            <slot name="trailing"></slot>
            <DwIcon v-if="chevron" name="chevronRight" class="dw-row-chevron" />
        </div>
    `,
};

/** 空状态 */
export const DwEmpty = {
    name: 'DwEmpty',
    components: { DwIcon, DwButton },
    props: {
        iconName: { type: String, default: 'book' },
        title: { type: String, default: '空空如也' },
        text: { type: String, default: '' },
        actionLabel: { type: String, default: '' },
    },
    emits: ['action'],
    template: `
        <div class="dw-empty">
            <DwIcon :name="iconName" class="dw-empty-icon" />
            <p class="dw-empty-title">{{ title }}</p>
            <p v-if="text" class="dw-empty-text">{{ text }}</p>
            <DwButton v-if="actionLabel" variant="primary" size="sm" @click="$emit('action')">{{ actionLabel }}</DwButton>
        </div>
    `,
};

/** 色调选择器 —— 选的是 token 名,不是 hex(所以换主题时跟着变) */
export const DwToneSwatches = {
    name: 'DwToneSwatches',
    props: {
        modelValue: { type: String, default: '' },
        tones: { type: Array, required: true },     // [{ id, label }]
        allowEmpty: { type: Boolean, default: false },
    },
    emits: ['update:modelValue'],
    template: `
        <div class="dw-tones">
            <button
                v-if="allowEmpty"
                type="button"
                class="dw-tone dw-tone--none"
                :class="{ 'is-active': !modelValue }"
                title="不指定"
                @click="$emit('update:modelValue', '')"
            ></button>
            <button
                v-for="tone in tones"
                :key="tone.id"
                type="button"
                class="dw-tone"
                :class="{ 'is-active': tone.id === modelValue }"
                :data-tone="tone.id"
                :title="tone.label"
                :aria-label="tone.label"
                @click="$emit('update:modelValue', tone.id)"
            ></button>
        </div>
    `,
};

/** 底部抽屉 —— 比弹窗轻,用于「更多操作」这类临时菜单 */
export const DwSheet = {
    name: 'DwSheet',
    components: { DwIcon },
    props: {
        title: { type: String, default: '' },
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
        <div class="dw-sheet-overlay" @click.self="$emit('close')">
            <div class="dw-sheet" role="dialog" aria-modal="true">
                <div class="dw-sheet-grip" aria-hidden="true"></div>
                <header v-if="title" class="dw-sheet-head">
                    <h3 class="dw-sheet-title">{{ title }}</h3>
                    <button type="button" class="dw-sheet-close" aria-label="关闭" @click="$emit('close')">
                        <DwIcon name="close" />
                    </button>
                </header>
                <div class="dw-sheet-body"><slot></slot></div>
            </div>
        </div>
    `,
};

/** 菜单项(配合 DwSheet 用) */
export const DwMenuItem = {
    name: 'DwMenuItem',
    components: { DwIcon },
    props: {
        label: { type: String, required: true },
        iconName: { type: String, default: '' },
        hint: { type: String, default: '' },
        danger: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
    },
    emits: ['click'],
    template: `
        <button
            type="button"
            class="dw-menu-item"
            :class="{ 'is-danger': danger }"
            :disabled="disabled"
            @click="$emit('click')"
        >
            <DwIcon v-if="iconName" :name="iconName" />
            <span class="dw-menu-item-main">
                <span class="dw-menu-item-label">{{ label }}</span>
                <span v-if="hint" class="dw-menu-item-hint">{{ hint }}</span>
            </span>
        </button>
    `,
};

/** 标签 */
export const DwTag = {
    name: 'DwTag',
    props: {
        tone: { type: String, default: '' },
        removable: { type: Boolean, default: false },
    },
    emits: ['remove'],
    template: `
        <span class="dw-tag" :data-tone="tone || null">
            <slot></slot>
            <button v-if="removable" type="button" class="dw-tag-remove" aria-label="移除" @click.stop="$emit('remove')">×</button>
        </span>
    `,
};

/** 加载态 */
export const DwSpinner = {
    name: 'DwSpinner',
    props: { label: { type: String, default: '' } },
    template: `
        <div class="dw-spinner-wrap">
            <span class="dw-spinner" aria-hidden="true"></span>
            <span v-if="label" class="dw-spinner-label">{{ label }}</span>
        </div>
    `,
};

export const SHARED_COMPONENTS = {
    DwIcon, DwButton, DwField, DwInput, DwTextarea, DwSelect, DwSegmented,
    DwSwitch, DwSlider, DwSection, DwRow, DwEmpty, DwToneSwatches,
    DwSheet, DwMenuItem, DwTag, DwSpinner,
};
