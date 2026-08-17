/**
 * 点灯 · 通用小组件
 *
 * 所有页面复用这一份，不许各页自己拼一遍。样式全走 --sl-* token。
 */

import { icon } from '../icons.js';

export const SlIcon = {
    name: 'SlIcon',
    props: {
        name: { type: String, required: true },
        size: { type: Number, default: 18 },
        stroke: { type: Number, default: 1.7 },
    },
    computed: {
        svg() { return icon(this.name, { size: this.size, stroke: this.stroke }); },
    },
    template: '<span class="sl-icon" v-html="svg"></span>',
};

/** variant = primary / soft / line / ghost / danger */
export const SlButton = {
    name: 'SlButton',
    components: { SlIcon },
    props: {
        variant: { type: String, default: 'line' },
        size: { type: String, default: 'md' },
        iconName: { type: String, default: '' },
        disabled: { type: Boolean, default: false },
        loading: { type: Boolean, default: false },
        block: { type: Boolean, default: false },
    },
    emits: ['click'],
    template: `
        <button
            type="button"
            class="sl-btn"
            :class="['sl-btn--' + variant, 'sl-btn--' + size, { 'is-block': block }]"
            :disabled="disabled || loading"
            @click="$emit('click', $event)"
        >
            <span v-if="loading" class="sl-btn__spin"></span>
            <SlIcon v-else-if="iconName" :name="iconName" :size="size === 'sm' ? 14 : 16" />
            <slot></slot>
        </button>
    `,
};

export const SlSection = {
    name: 'SlSection',
    props: {
        title: { type: String, default: '' },
        sub: { type: String, default: '' },
    },
    template: `
        <section class="sl-section">
            <div v-if="title" class="sl-section__head">
                <h3 class="sl-section__title">{{ title }}</h3>
                <span v-if="sub" class="sl-section__sub">{{ sub }}</span>
                <span class="sl-section__spacer"></span>
                <slot name="action"></slot>
            </div>
            <slot></slot>
        </section>
    `,
};

export const SlEmpty = {
    name: 'SlEmpty',
    components: { SlIcon },
    props: {
        iconName: { type: String, default: 'lamp' },
        title: { type: String, default: '这里还是空的' },
        desc: { type: String, default: '' },
    },
    template: `
        <div class="sl-empty">
            <span class="sl-empty__mark"><SlIcon :name="iconName" :size="26" /></span>
            <p class="sl-empty__title">{{ title }}</p>
            <p v-if="desc" class="sl-empty__desc">{{ desc }}</p>
            <div class="sl-empty__slot"><slot></slot></div>
        </div>
    `,
};

/**
 * 生成中：一盏灯亮起来，周围的星星依次点亮。
 * 超过 12 秒补一句提示，挡住重复点击。
 */
export const SlLoading = {
    name: 'SlLoading',
    components: { SlIcon },
    props: {
        lines: { type: Array, default: () => ['正在想怎么讲', '在翻它的来路', '快好了'] },
    },
    data() {
        return { index: 0, slow: false, _timer: null, _slowTimer: null };
    },
    computed: {
        text() { return this.lines[this.index % this.lines.length] || '生成中'; },
    },
    mounted() {
        this._timer = setInterval(() => { this.index += 1; }, 2400);
        this._slowTimer = setTimeout(() => { this.slow = true; }, 12000);
    },
    beforeUnmount() {
        if (this._timer) clearInterval(this._timer);
        if (this._slowTimer) clearTimeout(this._slowTimer);
    },
    template: `
        <div class="sl-loading">
            <div class="sl-loading__stage">
                <span class="sl-loading__lamp"><SlIcon name="lamp" :size="24" /></span>
                <i class="sl-loading__star sl-loading__star--a"></i>
                <i class="sl-loading__star sl-loading__star--b"></i>
                <i class="sl-loading__star sl-loading__star--c"></i>
            </div>
            <p class="sl-loading__text" :key="index">{{ text }}</p>
            <p v-if="slow" class="sl-loading__slow">有点慢，再等等 —— 别重复点，一次只会生成一份</p>
        </div>
    `,
};

export const SlSkeleton = {
    name: 'SlSkeleton',
    props: { rows: { type: Number, default: 4 } },
    template: `
        <div class="sl-skeleton">
            <div v-for="i in rows" :key="i" class="sl-skeleton__item"></div>
        </div>
    `,
};

export const SlField = {
    name: 'SlField',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
    },
    template: `
        <div class="sl-field">
            <div v-if="label" class="sl-field__head"><span class="sl-field__label">{{ label }}</span></div>
            <slot></slot>
            <p v-if="hint" class="sl-field__hint">{{ hint }}</p>
        </div>
    `,
};

export const SlAvatar = {
    name: 'SlAvatar',
    props: {
        name: { type: String, default: '' },
        url: { type: String, default: '' },
        bg: { type: String, default: '' },
        size: { type: Number, default: 30 },
    },
    computed: {
        safeUrl() {
            const u = String(this.url || '').trim();
            return /^(https?:\/\/|data:image\/)/i.test(u) ? u : '';
        },
        initial() { return (this.name || '').trim().slice(0, 1) || '师'; },
        style() {
            const s = { width: `${this.size}px`, height: `${this.size}px` };
            if (!this.safeUrl && this.bg) s.background = this.bg;
            return s;
        },
    },
    template: `
        <span class="sl-avatar" :style="style">
            <img v-if="safeUrl" :src="safeUrl" alt="" loading="lazy" />
            <i v-else class="sl-avatar__initial">{{ initial }}</i>
        </span>
    `,
};

/** 分段控件 */
export const SlSegment = {
    name: 'SlSegment',
    props: {
        modelValue: { type: [String, Number], default: '' },
        options: { type: Array, default: () => [] },
        size: { type: String, default: 'md' },
    },
    emits: ['update:modelValue'],
    template: `
        <div class="sl-seg" :class="'sl-seg--' + size">
            <button
                v-for="o in options" :key="o.id"
                type="button" class="sl-seg__item"
                :class="{ 'is-on': o.id === modelValue }"
                @click="$emit('update:modelValue', o.id)"
            >{{ o.label }}</button>
        </div>
    `,
};

/** 开关 */
export const SlSwitch = {
    name: 'SlSwitch',
    props: {
        modelValue: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
    },
    emits: ['update:modelValue'],
    template: `
        <button
            type="button" class="sl-switch"
            :class="{ 'is-on': modelValue, 'is-off': disabled }"
            :disabled="disabled"
            @click="$emit('update:modelValue', !modelValue)"
        ><i></i></button>
    `,
};

/** 滑块 */
export const SlSlider = {
    name: 'SlSlider',
    props: {
        modelValue: { type: Number, default: 0 },
        min: { type: Number, default: 0 },
        max: { type: Number, default: 100 },
        step: { type: Number, default: 1 },
        suffix: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    template: `
        <div class="sl-slider">
            <input
                type="range" :min="min" :max="max" :step="step" :value="modelValue"
                @input="$emit('update:modelValue', Number($event.target.value))"
            />
            <span class="sl-slider__val">{{ modelValue }}{{ suffix }}</span>
        </div>
    `,
};

/** 标签 */
export const SlTag = {
    name: 'SlTag',
    props: {
        tone: { type: String, default: '' },
    },
    template: '<span class="sl-tag" :class="tone ? \'sl-tag--\' + tone : \'\'"><slot></slot></span>',
};

/** 覆盖页的通用顶栏 */
export const SlTopbar = {
    name: 'SlTopbar',
    components: { SlIcon },
    props: {
        title: { type: String, default: '' },
        sub: { type: String, default: '' },
        backIcon: { type: String, default: 'back' },
    },
    emits: ['back'],
    template: `
        <header class="sl-topbar">
            <button type="button" class="sl-topbar__back" @click="$emit('back')">
                <SlIcon :name="backIcon" :size="20" />
            </button>
            <div class="sl-topbar__text">
                <h2 class="sl-topbar__title">{{ title }}</h2>
                <p v-if="sub" class="sl-topbar__sub">{{ sub }}</p>
            </div>
            <div class="sl-topbar__actions"><slot name="actions"></slot></div>
        </header>
    `,
};

/** 进度条 */
export const SlProgress = {
    name: 'SlProgress',
    props: {
        value: { type: Number, default: 0 },
        total: { type: Number, default: 1 },
    },
    computed: {
        pct() {
            const t = Math.max(1, this.total);
            return Math.min(100, Math.round((this.value / t) * 100));
        },
    },
    template: `
        <div class="sl-progress"><i :style="{ width: pct + '%' }"></i></div>
    `,
};

export const UI = {
    SlIcon, SlButton, SlSection, SlEmpty, SlLoading, SlSkeleton,
    SlField, SlAvatar, SlSegment, SlSwitch, SlSlider, SlTag, SlTopbar, SlProgress,
};
