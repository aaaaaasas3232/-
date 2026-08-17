/**
 * 候鸟 · 通用小组件
 *
 * 按钮 / 分区 / 空态 / 加载 / 表单行 / 头像 / 骨架 —— 所有页面复用这一份，
 * 不许各页自己拼一遍。样式全部走 --tv-* token。
 */

import { icon } from '../icons.js';

/** 图标（v-html 一层薄壳；name 是 icons.js 里的键，开发者受信任内容） */
export const TvIcon = {
    name: 'TvIcon',
    props: {
        name: { type: String, required: true },
        size: { type: Number, default: 18 },
    },
    computed: {
        svg() { return icon(this.name, { size: this.size }); },
    },
    template: `<span class="tv-icon" v-html="svg"></span>`,
};

/** 按钮：variant = primary / soft / line / ghost / danger */
export const TvButton = {
    name: 'TvButton',
    components: { TvIcon },
    props: {
        variant: { type: String, default: 'line' },
        size: { type: String, default: 'md' },       // sm / md / lg
        iconName: { type: String, default: '' },
        disabled: { type: Boolean, default: false },
        loading: { type: Boolean, default: false },
        block: { type: Boolean, default: false },
    },
    emits: ['click'],
    template: `
        <button
            type="button"
            class="tv-btn"
            :class="['tv-btn--' + variant, 'tv-btn--' + size, { 'is-block': block }]"
            :disabled="disabled || loading"
            @click="$emit('click', $event)"
        >
            <span v-if="loading" class="tv-btn__spin"></span>
            <TvIcon v-else-if="iconName" :name="iconName" :size="size === 'sm' ? 14 : 16" />
            <slot></slot>
        </button>
    `,
};

/** 分区标题 + 内容 */
export const TvSection = {
    name: 'TvSection',
    props: {
        title: { type: String, default: '' },
        sub: { type: String, default: '' },
    },
    template: `
        <section class="tv-section">
            <div v-if="title" class="tv-section__head">
                <h3 class="tv-section__title">{{ title }}</h3>
                <span v-if="sub" class="tv-section__sub">{{ sub }}</span>
                <span class="tv-section__spacer"></span>
                <slot name="action"></slot>
            </div>
            <slot></slot>
        </section>
    `,
};

/** 空态 */
export const TvEmpty = {
    name: 'TvEmpty',
    components: { TvIcon },
    props: {
        iconName: { type: String, default: 'compass' },
        title: { type: String, default: '这里还是空的' },
        desc: { type: String, default: '' },
    },
    template: `
        <div class="tv-empty">
            <span class="tv-empty__mark"><TvIcon :name="iconName" :size="26" /></span>
            <p class="tv-empty__title">{{ title }}</p>
            <p v-if="desc" class="tv-empty__desc">{{ desc }}</p>
            <div class="tv-empty__slot"><slot></slot></div>
        </div>
    `,
};

/**
 * 加载动画：一只纸飞机沿虚线缓缓飘。
 * 文案每 2.4s 换一句；超过 12s 补一句「有点慢」挡住重复点击。
 * 禁渐变 —— 全部用纯色 + opacity 动画。
 */
export const TvLoading = {
    name: 'TvLoading',
    components: { TvIcon },
    props: {
        lines: { type: Array, default: () => ['正在打听路线', '在和当地人聊', '快好了'] },
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
        <div class="tv-loading">
            <div class="tv-loading__stage">
                <span class="tv-loading__trail"></span>
                <span class="tv-loading__plane"><TvIcon name="plane" :size="22" /></span>
            </div>
            <p class="tv-loading__text" :key="index">{{ text }}</p>
            <p v-if="slow" class="tv-loading__slow">有点慢，再等等 —— 别重复点，一次只会生成一份</p>
        </div>
    `,
};

/** 骨架屏（首屏 hydrate 用；结构未知的生成期用 TvLoading 不用它） */
export const TvSkeleton = {
    name: 'TvSkeleton',
    props: { rows: { type: Number, default: 4 } },
    template: `
        <div class="tv-skeleton">
            <div v-for="i in rows" :key="i" class="tv-skeleton__item"></div>
        </div>
    `,
};

/** 表单行：label + 控件 slot */
export const TvField = {
    name: 'TvField',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
    },
    template: `
        <div class="tv-field">
            <div v-if="label" class="tv-field__head"><span class="tv-field__label">{{ label }}</span></div>
            <slot></slot>
            <p v-if="hint" class="tv-field__hint">{{ hint }}</p>
        </div>
    `,
};

/**
 * 头像：有图用图，没图用名字首字。
 * URL 走 :src 绑定（Vue 属性绑定不走 v-html，安全），再加协议白名单。
 */
export const TvAvatar = {
    name: 'TvAvatar',
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
        initial() { return (this.name || '').trim().slice(0, 1) || '客'; },
        style() {
            const s = { width: `${this.size}px`, height: `${this.size}px` };
            // 用户配置的头像底色，运行时值，不算硬编码
            if (!this.safeUrl && this.bg) s.background = this.bg;
            return s;
        },
    },
    template: `
        <span class="tv-avatar" :style="style">
            <img v-if="safeUrl" :src="safeUrl" alt="" loading="lazy" />
            <i v-else class="tv-avatar__initial">{{ initial }}</i>
        </span>
    `,
};

/** 数字步进器 */
export const TvStepper = {
    name: 'TvStepper',
    props: {
        modelValue: { type: Number, default: 1 },
        min: { type: Number, default: 1 },
        max: { type: Number, default: 9 },
        suffix: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    methods: {
        step(delta) {
            const next = Math.min(this.max, Math.max(this.min, this.modelValue + delta));
            if (next !== this.modelValue) this.$emit('update:modelValue', next);
        },
    },
    template: `
        <span class="tv-stepper">
            <button type="button" aria-label="减少" :disabled="modelValue <= min" @click="step(-1)">-</button>
            <span class="tv-stepper__value">{{ modelValue }}{{ suffix }}</span>
            <button type="button" aria-label="增加" :disabled="modelValue >= max" @click="step(1)">+</button>
        </span>
    `,
};

/** prompt 分段预览（发送 text 与这里的 parts 来自同一次 compose） */
export const TvPromptParts = {
    name: 'TvPromptParts',
    props: {
        parts: { type: Array, default: () => [] },
        stats: { type: Object, default: () => ({}) },
    },
    template: `
        <div class="tv-ctx">
            <p class="tv-ctx__stat">共 {{ stats.included || 0 }} 段进入发送 · 约 {{ stats.tokens || 0 }} token</p>
            <div v-for="p in parts" :key="p.id" class="tv-ctx__part" :class="{ 'is-off': !p.included }">
                <div class="tv-ctx__main">
                    <span class="tv-ctx__title">{{ p.title }}</span>
                    <span class="tv-ctx__meta">{{ p.source || '本次生成' }} · {{ p.tokens }} token</span>
                </div>
                <span v-if="p.locked" class="tv-ctx__lock">必发</span>
            </div>
        </div>
    `,
};

export const UI = {
    TvIcon, TvButton, TvSection, TvEmpty, TvLoading, TvSkeleton,
    TvField, TvAvatar, TvStepper, TvPromptParts,
};
