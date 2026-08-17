/**
 * relax-app / 面板通用小组件
 *
 * 三个面板(主体 / 装扮 / 音声)都在用同一批控件。抽在这里的唯一目的是
 * 「换风格只改一处」—— 不要在各面板里另写一套 swatch / slider。
 */

import { CANDY_SWATCHES, readableInk, safeColor } from '../palette.js';
import { ICON_CHECK } from './icons.js';

/** 色板取色器:糖果预设 + 原生取色器兜底(想要预设外的颜色) */
export const RxSwatches = {
    name: 'RxSwatches',
    props: {
        value: { type: String, default: '#ffc8dd' },
        // 是否显示「自定义颜色」那颗彩虹按钮
        allowCustom: { type: Boolean, default: true },
    },
    emits: ['change'],
    computed: {
        swatches() {
            return CANDY_SWATCHES;
        },
        current() {
            return safeColor(this.value);
        },
    },
    methods: {
        isActive(hex) {
            return hex.toLowerCase() === this.current.toLowerCase();
        },
        pick(hex) {
            this.$emit('change', hex);
        },
        onCustomInput(event) {
            this.$emit('change', event.target.value);
        },
        inkFor(hex) {
            return readableInk(hex);
        },
    },
    template: `
        <div class="rx-swatches">
            <button
                v-for="item in swatches"
                :key="item.id"
                type="button"
                class="rx-swatch"
                :class="{ 'is-active': isActive(item.hex) }"
                :style="{ background: item.hex, color: inkFor(item.hex) }"
                :title="item.name"
                :aria-label="item.name"
                @click="pick(item.hex)"
            >
                <span v-if="isActive(item.hex)" class="rx-swatch-check">${ICON_CHECK}</span>
            </button>

            <label v-if="allowCustom" class="rx-swatch rx-swatch-custom" title="自定义颜色">
                <input type="color" :value="current" @input="onCustomInput" />
                <span class="rx-swatch-custom-ring"></span>
            </label>
        </div>
    `,
};

/** 带数值气泡的滑块 */
export const RxSlider = {
    name: 'RxSlider',
    props: {
        label: { type: String, default: '' },
        value: { type: Number, default: 0 },
        min: { type: Number, default: 0 },
        max: { type: Number, default: 1 },
        step: { type: Number, default: 0.01 },
        // 显示用的格式化:'percent' | 'px' | 'raw'
        format: { type: String, default: 'percent' },
    },
    emits: ['change'],
    computed: {
        display() {
            if (this.format === 'percent') return `${Math.round(this.value * 100)}%`;
            if (this.format === 'px') return `${Math.round(this.value)}px`;
            return String(Math.round(this.value * 100) / 100);
        },
    },
    methods: {
        onInput(event) {
            this.$emit('change', Number(event.target.value));
        },
    },
    template: `
        <div class="rx-slider">
            <div class="rx-slider-head">
                <span class="rx-slider-label">{{ label }}</span>
                <span class="rx-slider-value">{{ display }}</span>
            </div>
            <input
                class="rx-slider-input"
                type="range"
                :min="min"
                :max="max"
                :step="step"
                :value="value"
                @input="onInput"
            />
        </div>
    `,
};

/** 开关(圆润糖果风) */
export const RxToggle = {
    name: 'RxToggle',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
        value: { type: Boolean, default: false },
    },
    emits: ['change'],
    template: `
        <div class="rx-toggle-row">
            <div class="rx-toggle-text">
                <div class="rx-toggle-label">{{ label }}</div>
                <div v-if="hint" class="rx-toggle-hint">{{ hint }}</div>
            </div>
            <button
                type="button"
                class="rx-toggle"
                :class="{ 'is-on': value }"
                role="switch"
                :aria-checked="String(value)"
                @click="$emit('change', !value)"
            >
                <span class="rx-toggle-knob"></span>
            </button>
        </div>
    `,
};

/** 面板里的一个分区(标题 + 内容),统一间距和标题样式 */
export const RxSection = {
    name: 'RxSection',
    props: {
        title: { type: String, default: '' },
        hint: { type: String, default: '' },
    },
    template: `
        <section class="rx-section">
            <header v-if="title" class="rx-section-head">
                <h3 class="rx-section-title">{{ title }}</h3>
                <span v-if="hint" class="rx-section-hint">{{ hint }}</span>
                <slot name="action"></slot>
            </header>
            <div class="rx-section-body">
                <slot></slot>
            </div>
        </section>
    `,
};

/**
 * 素材瓦片(背景 / 盘子 / 装饰 / 主体的选择格子)
 * 预览内容走 slot,所以同一个瓦片能装渐变背景、SVG 盘子、SVG 装饰。
 */
export const RxTile = {
    name: 'RxTile',
    props: {
        label: { type: String, default: '' },
        active: { type: Boolean, default: false },
        // 瓦片宽高比
        aspect: { type: Number, default: 1 },
    },
    emits: ['select'],
    template: `
        <button
            type="button"
            class="rx-tile"
            :class="{ 'is-active': active }"
            @click="$emit('select')"
        >
            <span class="rx-tile-preview" :style="{ aspectRatio: String(aspect) }">
                <slot></slot>
            </span>
            <span class="rx-tile-label">{{ label }}</span>
            <span v-if="active" class="rx-tile-badge">${ICON_CHECK}</span>
        </button>
    `,
};
