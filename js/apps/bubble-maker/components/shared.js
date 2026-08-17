/**
 * 气泡机 · 通用控件
 *
 * 全部是 Options API 普通对象(项目约定,和 relax-app / 湛蓝回忆一致)。
 *
 * 这一层存在的意义:上层不再手写 `<button class="…">` 和一堆重复的表单结构。
 * 参考软件里同一种「标签 + 滑块 + 数值」出现了三十多次,每次都是字符串拼 HTML
 * 再 `querySelector` 绑事件 —— 改一个间距要找三十处。
 *
 * ★ 一条硬规矩:这里没有任何颜色。配色全部来自 `_theme.css` 的 `--bb-*`。
 *   唯一出现色值的地方是 `BbColorRow` 的 `modelValue`,那是**用户在调的颜色**。
 */

import { icon } from '../icons.js';
import { isHexColor } from '@/src/core/bubble-style.js';

// ============================================================
// 图标
// ============================================================

export const BbIcon = {
    name: 'BbIcon',
    props: {
        name: { type: String, required: true },
        size: { type: [Number, String], default: 0 },
    },
    computed: {
        html() { return icon(this.name); },
        style() {
            if (!this.size) return null;
            const px = typeof this.size === 'number' ? `${this.size}px` : this.size;
            return { '--bb-icon-size': px };
        },
    },
    template: `<span class="bb-icon" :style="style" v-html="html"></span>`,
};

// ============================================================
// 按钮
// ============================================================

export const BbButton = {
    name: 'BbButton',
    components: { BbIcon },
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
            class="bb-btn"
            :class="['bb-btn--' + variant, 'bb-btn--' + size, { 'is-icon-only': iconOnly, 'is-block': block }]"
            :disabled="disabled"
            :aria-label="iconOnly ? (label || iconName) : null"
            @click="$emit('click', $event)"
        >
            <BbIcon v-if="iconName" :name="iconName" />
            <span v-if="!iconOnly" class="bb-btn-label"><slot>{{ label }}</slot></span>
        </button>
    `,
};

// ============================================================
// 表单
// ============================================================

export const BbField = {
    name: 'BbField',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
    },
    template: `
        <label class="bb-field">
            <span v-if="label" class="bb-field-label">{{ label }}</span>
            <slot></slot>
            <span v-if="hint" class="bb-field-hint">{{ hint }}</span>
        </label>
    `,
};

export const BbInput = {
    name: 'BbInput',
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
            class="bb-input"
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

export const BbTextarea = {
    name: 'BbTextarea',
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
            class="bb-textarea"
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

export const BbSelect = {
    name: 'BbSelect',
    props: {
        modelValue: { type: [String, Number], default: '' },
        options: { type: Array, default: () => [] },   // [{ value, label }]
        placeholder: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    template: `
        <select class="bb-select" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
            <option v-if="placeholder" value="">{{ placeholder }}</option>
            <option v-for="opt in options" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
        </select>
    `,
};

/** 分段选择 —— 选项少于 5 个时比下拉好用得多(一眼看全,一次点到) */
export const BbSegmented = {
    name: 'BbSegmented',
    props: {
        modelValue: { type: [String, Number], default: '' },
        options: { type: Array, default: () => [] },
        block: { type: Boolean, default: true },
    },
    emits: ['update:modelValue'],
    template: `
        <div class="bb-seg" :class="{ 'is-block': block }" role="group">
            <button
                v-for="opt in options"
                :key="String(opt.value)"
                type="button"
                class="bb-seg-item"
                :class="{ 'is-active': String(modelValue) === String(opt.value) }"
                @click="$emit('update:modelValue', opt.value)"
            >{{ opt.label }}</button>
        </div>
    `,
};

export const BbSwitch = {
    name: 'BbSwitch',
    props: {
        modelValue: { type: Boolean, default: false },
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
        disabled: { type: Boolean, default: false },
    },
    emits: ['update:modelValue'],
    template: `
        <label class="bb-switch" :class="{ 'is-disabled': disabled }">
            <span class="bb-switch-text">
                <span class="bb-switch-label">{{ label }}</span>
                <span v-if="hint" class="bb-switch-hint">{{ hint }}</span>
            </span>
            <input
                type="checkbox"
                class="bb-switch-input"
                :checked="modelValue"
                :disabled="disabled"
                @change="$emit('update:modelValue', $event.target.checked)"
            />
            <span class="bb-switch-track" aria-hidden="true"><i class="bb-switch-thumb"></i></span>
        </label>
    `,
};

/**
 * 滑块。
 *
 * ★ 右侧数值是**可输入的**。参考软件那边只显示不给改,想把圆角设成
 *   精确的 18 就得在滑轨上一点点蹭 —— 而这类工具用户十有八九心里有个准数。
 */
export const BbSlider = {
    name: 'BbSlider',
    props: {
        modelValue: { type: Number, default: 0 },
        min: { type: Number, default: 0 },
        max: { type: Number, default: 100 },
        step: { type: Number, default: 1 },
        label: { type: String, default: '' },
        suffix: { type: String, default: '' },
        compact: { type: Boolean, default: false },
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
        <div class="bb-slider" :class="{ 'is-compact': compact }">
            <div class="bb-slider-head">
                <span class="bb-slider-label">{{ label }}</span>
                <span class="bb-slider-value">
                    <input
                        class="bb-slider-num"
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
                class="bb-slider-input"
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
 * 三件事收在一起:色块取色器、色值文本框、还原。
 *
 * ★ `<input type="color">` 只吃 `#rrggbb`。像 `rgba(0,0,0,.2)` 这种塞进去会被
 *   当成非法值**静默显示成黑色**,用户以为自己把颜色改坏了。所以色块套
 *   `v-if="swatchable"`,非 hex 只给文本框。
 *   ⚠️ 别为此写一个 `'#000000'` 兜底常量 —— 那就成了「JS 里的硬编码颜色」,
 *      而且因为有 v-if 它永远跑不到(AGENTS2 §16.10 记过这条)。
 */
export const BbColorRow = {
    name: 'BbColorRow',
    components: { BbIcon },
    props: {
        modelValue: { type: String, default: '' },
        label: { type: String, default: '' },
        /** 变量名 —— 传了就显示成可点击复制的小字 */
        token: { type: String, default: '' },
        changed: { type: Boolean, default: false },
        resettable: { type: Boolean, default: false },
    },
    emits: ['update:modelValue', 'reset', 'copy-token'],
    computed: {
        swatchable() { return isHexColor(this.modelValue); },
    },
    template: `
        <div class="bb-color-row">
            <span class="bb-color-meta">
                <span class="bb-color-label">
                    {{ label }}<em v-if="changed" class="bb-color-flag">已改</em>
                </span>
                <code
                    v-if="token"
                    class="bb-color-token"
                    title="点击复制变量名"
                    @click="$emit('copy-token', token)"
                >{{ token }}</code>
            </span>
            <input
                v-if="swatchable"
                type="color"
                class="bb-color-swatch"
                :value="modelValue"
                :aria-label="label"
                @input="$emit('update:modelValue', $event.target.value)"
            />
            <input
                type="text"
                class="bb-color-hex"
                :value="modelValue"
                :aria-label="label + ' 色值'"
                spellcheck="false"
                @change="$emit('update:modelValue', $event.target.value)"
            />
            <button
                v-if="resettable && changed"
                type="button"
                class="bb-color-reset"
                aria-label="还原"
                @click="$emit('reset')"
            ><BbIcon name="refresh" /></button>
        </div>
    `,
};

// ============================================================
// 结构
// ============================================================

export const BbSection = {
    name: 'BbSection',
    components: { BbIcon },
    props: {
        title: { type: String, default: '' },
        hint: { type: String, default: '' },
        iconName: { type: String, default: '' },
        collapsible: { type: Boolean, default: false },
        open: { type: Boolean, default: true },
    },
    emits: ['toggle'],
    template: `
        <section class="bb-section" :class="{ 'is-open': !collapsible || open }">
            <header
                v-if="title"
                class="bb-section-head"
                :class="{ 'is-clickable': collapsible }"
                @click="collapsible && $emit('toggle')"
            >
                <BbIcon v-if="iconName" :name="iconName" />
                <span class="bb-section-title">{{ title }}</span>
                <span v-if="hint" class="bb-section-hint">{{ hint }}</span>
                <span class="bb-section-extra"><slot name="extra"></slot></span>
                <BbIcon v-if="collapsible" class="bb-section-caret" :name="open ? 'chevronDown' : 'chevronRight'" />
            </header>
            <div v-if="!collapsible || open" class="bb-section-body"><slot></slot></div>
        </section>
    `,
};

export const BbEmpty = {
    name: 'BbEmpty',
    components: { BbIcon },
    props: {
        iconName: { type: String, default: 'info' },
        text: { type: String, default: '还没有内容' },
        hint: { type: String, default: '' },
    },
    template: `
        <div class="bb-empty">
            <BbIcon class="bb-empty-icon" :name="iconName" />
            <p class="bb-empty-text">{{ text }}</p>
            <p v-if="hint" class="bb-empty-hint">{{ hint }}</p>
            <div class="bb-empty-action"><slot></slot></div>
        </div>
    `,
};

export const BbSpinner = {
    name: 'BbSpinner',
    props: { label: { type: String, default: '' } },
    template: `
        <div class="bb-spinner" role="status">
            <span class="bb-spinner-ring" aria-hidden="true"></span>
            <span v-if="label" class="bb-spinner-label">{{ label }}</span>
        </div>
    `,
};

export const BbTag = {
    name: 'BbTag',
    props: { tone: { type: String, default: '' } },
    template: `<span class="bb-tag" :data-tone="tone || null"><slot></slot></span>`,
};

export const SHARED_COMPONENTS = {
    BbIcon, BbButton, BbField, BbInput, BbTextarea, BbSelect, BbSegmented,
    BbSwitch, BbSlider, BbColorRow, BbSection, BbEmpty, BbSpinner, BbTag,
};
