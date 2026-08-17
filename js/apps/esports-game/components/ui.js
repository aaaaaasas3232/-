/**
 * 赛点 · 通用小组件（--eg-* token，禁 emoji）
 */

import { icon } from '../icons.js';

export const EgIcon = {
    name: 'EgIcon',
    props: {
        name: { type: String, required: true },
        size: { type: Number, default: 18 },
    },
    computed: {
        svg() { return icon(this.name, { size: this.size }); },
    },
    template: `<span class="eg-icon" v-html="svg"></span>`,
};

/** variant = ink / line / soft / ghost / danger / blue */
export const EgBtn = {
    name: 'EgBtn',
    components: { EgIcon },
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
            class="eg-btn"
            :class="['eg-btn--' + variant, 'eg-btn--' + size, { 'is-block': block }]"
            :disabled="disabled || loading"
            @click="$emit('click', $event)"
        >
            <span v-if="loading" class="eg-btn__spin"></span>
            <EgIcon v-else-if="iconName" :name="iconName" :size="size === 'sm' ? 14 : 16" />
            <slot></slot>
        </button>
    `,
};

export const EgSection = {
    name: 'EgSection',
    props: {
        title: { type: String, default: '' },
        sub: { type: String, default: '' },
    },
    template: `
        <section class="eg-section">
            <div v-if="title" class="eg-section__head">
                <h3 class="eg-section__title">{{ title }}</h3>
                <span v-if="sub" class="eg-section__sub">{{ sub }}</span>
                <span class="eg-section__spacer"></span>
                <slot name="action"></slot>
            </div>
            <slot></slot>
        </section>
    `,
};

export const EgEmpty = {
    name: 'EgEmpty',
    components: { EgIcon },
    props: {
        iconName: { type: String, default: 'gamepad' },
        title: { type: String, default: '这里还是空的' },
        desc: { type: String, default: '' },
    },
    template: `
        <div class="eg-empty">
            <span class="eg-empty__mark"><EgIcon :name="iconName" :size="26" /></span>
            <p class="eg-empty__title">{{ title }}</p>
            <p v-if="desc" class="eg-empty__desc">{{ desc }}</p>
            <div class="eg-empty__slot"><slot></slot></div>
        </div>
    `,
};

export const EgLoading = {
    name: 'EgLoading',
    components: { EgIcon },
    props: {
        lines: { type: Array, default: () => ['连接服务器', '加载战绩', '快好了'] },
    },
    data() {
        return { index: 0, slow: false, _timer: null, _slowTimer: null };
    },
    computed: {
        text() { return this.lines[this.index % this.lines.length] || '加载中'; },
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
        <div class="eg-loading">
            <span class="eg-loading__breath"><EgIcon name="gamepad" :size="24" /></span>
            <p class="eg-loading__text" :key="index">{{ text }}</p>
            <p v-if="slow" class="eg-loading__slow">有点慢，再等等 —— 别重复点，一次只会生成一份</p>
        </div>
    `,
};

export const EgField = {
    name: 'EgField',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
    },
    template: `
        <div class="eg-field">
            <div v-if="label" class="eg-field__head"><span class="eg-field__label">{{ label }}</span></div>
            <slot></slot>
            <p v-if="hint" class="eg-field__hint">{{ hint }}</p>
        </div>
    `,
};

export const EgModalShell = {
    name: 'EgModalShell',
    components: { EgIcon },
    props: {
        title: { type: String, default: '' },
        persistent: { type: Boolean, default: false },
        wide: { type: Boolean, default: false },
    },
    emits: ['close'],
    template: `
        <div class="eg-modal" @click.self="persistent ? null : $emit('close')">
            <div class="eg-modal__panel" :class="{ 'is-wide': wide }">
                <div class="eg-modal__head" v-if="title">
                    <span class="eg-modal__title">{{ title }}</span>
                    <button v-if="!persistent" type="button" class="eg-modal__close" @click="$emit('close')">
                        <EgIcon name="close" :size="16" />
                    </button>
                </div>
                <div class="eg-modal__body"><slot></slot></div>
                <div class="eg-modal__foot"><slot name="actions"></slot></div>
            </div>
        </div>
    `,
};

export const EgBar = {
    name: 'EgBar',
    props: {
        label: { type: String, default: '' },
        value: { type: Number, default: 0 },
        max: { type: Number, default: 100 },
        kind: { type: String, default: '' },   // '' | energy | love
    },
    computed: {
        pctWidth() {
            const v = Math.max(0, Math.min(this.max, this.value));
            return Math.round((v / this.max) * 100);
        },
    },
    template: `
        <div class="eg-bar" :class="kind ? 'eg-bar--' + kind : ''">
            <div class="eg-bar__meta">
                <span class="eg-bar__label">{{ label }}</span>
                <span class="eg-bar__value">{{ Math.round(value) }}<i>/{{ max }}</i></span>
            </div>
            <div class="eg-bar__track"><div class="eg-bar__fill" :style="{ width: pctWidth + '%' }"></div></div>
        </div>
    `,
};

export const EgTag = {
    name: 'EgTag',
    props: {
        tone: { type: String, default: 'plain' },
    },
    template: `<span class="eg-tag" :class="'eg-tag--' + tone"><slot></slot></span>`,
};

export const EgAvatar = {
    name: 'EgAvatar',
    props: {
        name: { type: String, default: '?' },
        hue: { type: Number, default: 210 },
        size: { type: Number, default: 40 },
    },
    computed: {
        style() {
            return {
                width: `${this.size}px`,
                height: `${this.size}px`,
                background: `hsl(${this.hue}, 34%, 30%)`,
                color: `hsl(${this.hue}, 60%, 80%)`,
                fontSize: `${Math.round(this.size * 0.42)}px`,
            };
        },
        char() { return String(this.name || '?').slice(0, 1); },
    },
    template: `<span class="eg-avatar" :style="style">{{ char }}</span>`,
};

export const UI = {
    EgIcon, EgBtn, EgSection, EgEmpty, EgLoading, EgField, EgModalShell, EgBar, EgTag, EgAvatar,
};
