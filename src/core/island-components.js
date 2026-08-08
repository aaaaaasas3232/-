// ============================================
// component-island 内置组件库
//
// 全部以 Vue 组件配置（template + data + props + methods）形式导出。
// 由 app-renderer 在 hybrid 模式下扫描 <component-island /> 标签后挂载。
//
// 组件列表：
//   - island-toggle       iOS 风格开关
//   - island-slider       滑块
//   - island-input        受控输入框
//   - island-textarea     受控文本域
//   - island-select       下拉选择
//   - island-list         列表（带 tap / delete）
//   - island-counter      数字加减
// ============================================

import { registerIslandComponent } from './app-renderer.js';

// ===== toggle =====
const islandToggle = {
    props: {
        value: { type: Boolean, default: false },
        label: { type: String, default: '' },
        disabled: { type: Boolean, default: false },
    },
    emits: ['change', 'update:value'],
    template: `
        <div class="island-toggle" :class="{ 'is-disabled': disabled }">
            <span v-if="label" class="island-toggle-label">{{ label }}</span>
            <button
                type="button"
                class="island-toggle-switch"
                :class="{ on: value }"
                :disabled="disabled"
                @click="onClick"
                :aria-pressed="value"
            >
                <span class="island-toggle-knob"></span>
            </button>
        </div>
    `,
    methods: {
        onClick() {
            if (this.disabled) return;
            const next = !this.value;
            this.$emit('update:value', next);
            this.$emit('change', next);
        },
    },
};

// ===== slider =====
const islandSlider = {
    props: {
        value: { type: Number, default: 0 },
        min: { type: Number, default: 0 },
        max: { type: Number, default: 100 },
        step: { type: Number, default: 1 },
        label: { type: String, default: '' },
    },
    emits: ['change', 'update:value'],
    template: `
        <div class="island-slider">
            <div v-if="label" class="island-slider-label">{{ label }} <span class="island-slider-value">{{ value }}</span></div>
            <input
                type="range"
                class="island-slider-input"
                :value="value"
                :min="min"
                :max="max"
                :step="step"
                @input="onInput"
            />
        </div>
    `,
    methods: {
        onInput(event) {
            const v = Number(event.target.value);
            this.$emit('update:value', v);
            this.$emit('change', v);
        },
    },
};

// ===== input =====
const islandInput = {
    props: {
        value: { type: String, default: '' },
        label: { type: String, default: '' },
        placeholder: { type: String, default: '' },
        type: { type: String, default: 'text' },
        maxlength: { type: Number, default: 0 },
    },
    emits: ['change', 'update:value', 'submit'],
    template: `
        <div class="island-input">
            <label v-if="label" class="island-input-label">{{ label }}</label>
            <input
                :type="type"
                class="island-input-field"
                :value="value"
                :placeholder="placeholder"
                :maxlength="maxlength || undefined"
                @input="onInput"
                @keydown.enter="onEnter"
            />
        </div>
    `,
    methods: {
        onInput(event) {
            const v = event.target.value;
            this.$emit('update:value', v);
        },
        onChange(event) {
            this.$emit('change', event.target.value);
        },
        onEnter(event) {
            this.$emit('submit', event.target.value);
        },
    },
};

// ===== textarea =====
const islandTextarea = {
    props: {
        value: { type: String, default: '' },
        label: { type: String, default: '' },
        placeholder: { type: String, default: '' },
        rows: { type: Number, default: 4 },
        maxlength: { type: Number, default: 0 },
    },
    emits: ['update:value', 'change'],
    template: `
        <div class="island-textarea">
            <label v-if="label" class="island-textarea-label">{{ label }}</label>
            <textarea
                class="island-textarea-field"
                :value="value"
                :placeholder="placeholder"
                :rows="rows"
                :maxlength="maxlength || undefined"
                @input="onInput"
            ></textarea>
            <div v-if="maxlength" class="island-textarea-counter">{{ value.length }} / {{ maxlength }}</div>
        </div>
    `,
    methods: {
        onInput(event) {
            const v = event.target.value;
            this.$emit('update:value', v);
        },
    },
};

// ===== select =====
const islandSelect = {
    props: {
        value: { type: [String, Number], default: '' },
        options: { type: Array, default: () => [] },
        label: { type: String, default: '' },
    },
    emits: ['update:value', 'change'],
    template: `
        <div class="island-select">
            <label v-if="label" class="island-select-label">{{ label }}</label>
            <select
                class="island-select-field"
                :value="value"
                @change="onChange"
            >
                <option v-for="opt in options" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
            </select>
        </div>
    `,
    methods: {
        onChange(event) {
            const v = event.target.value;
            this.$emit('update:value', v);
            this.$emit('change', v);
        },
    },
};

// ===== list =====
const islandList = {
    props: {
        items: { type: Array, default: () => [] },
        labelKey: { type: String, default: 'label' },
        valueKey: { type: String, default: 'value' },
        emptyText: { type: String, default: '暂无数据' },
    },
    emits: ['select', 'delete'],
    template: `
        <div class="island-list">
            <div v-if="!items.length" class="island-list-empty">{{ emptyText }}</div>
            <div v-for="item in items" :key="item[valueKey] ?? item.id ?? $index" class="island-list-item">
                <div class="island-list-item-main" @click="onSelect(item)">
                    <span class="island-list-item-label">{{ item[labelKey] }}</span>
                    <span v-if="item.description" class="island-list-item-desc">{{ item.description }}</span>
                </div>
                <button v-if="item.deletable !== false" type="button" class="island-list-item-delete" @click="onDelete(item)">×</button>
            </div>
        </div>
    `,
    methods: {
        onSelect(item) {
            this.$emit('select', item);
        },
        onDelete(item) {
            this.$emit('delete', item);
        },
    },
};

// ===== counter =====
const islandCounter = {
    props: {
        value: { type: Number, default: 0 },
        min: { type: Number, default: 0 },
        max: { type: Number, default: 999 },
        step: { type: Number, default: 1 },
        label: { type: String, default: '' },
    },
    emits: ['update:value', 'change'],
    template: `
        <div class="island-counter">
            <span v-if="label" class="island-counter-label">{{ label }}</span>
            <div class="island-counter-controls">
                <button type="button" class="island-counter-btn" :disabled="value <= min" @click="dec">−</button>
                <span class="island-counter-value">{{ value }}</span>
                <button type="button" class="island-counter-btn" :disabled="value >= max" @click="inc">+</button>
            </div>
        </div>
    `,
    methods: {
        inc() {
            const next = Math.min(this.max, this.value + this.step);
            this.$emit('update:value', next);
            this.$emit('change', next);
        },
        dec() {
            const next = Math.max(this.min, this.value - this.step);
            this.$emit('update:value', next);
            this.$emit('change', next);
        },
    },
};

// 注册表
const COMPONENTS = {
    toggle: islandToggle,
    slider: islandSlider,
    input: islandInput,
    textarea: islandTextarea,
    select: islandSelect,
    list: islandList,
    counter: islandCounter,
};

/**
 * 把所有内置 island 组件注册到调度器。
 * framework 启动时调一次。
 */
export function registerBuiltInIslands() {
    for (const [name, component] of Object.entries(COMPONENTS)) {
        registerIslandComponent(name, component);
    }
    return COMPONENTS;
}

export const BUILT_IN_ISLAND_NAMES = Object.keys(COMPONENTS);