/**
 * 追光 · 通用小组件
 *
 * 图标 / 按钮 / 分区 / 空态 / 加载 / 表单行 / 弹窗壳 / 属性条 / 标签 / NPC 头像。
 * 所有页面复用这一份。样式全部走 --ac-* token，禁 emoji。
 */

import { icon } from '../icons.js';

export const AcIcon = {
    name: 'AcIcon',
    props: {
        name: { type: String, required: true },
        size: { type: Number, default: 18 },
    },
    computed: {
        svg() { return icon(this.name, { size: this.size }); },
    },
    template: `<span class="zg-icon" v-html="svg"></span>`,
};

/** variant = ink（主钮）/ line / soft / ghost / danger / gold */
export const AcBtn = {
    name: 'AcBtn',
    components: { AcIcon },
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
            class="zg-btn"
            :class="['zg-btn--' + variant, 'zg-btn--' + size, { 'is-block': block }]"
            :disabled="disabled || loading"
            @click="$emit('click', $event)"
        >
            <span v-if="loading" class="zg-btn__spin"></span>
            <AcIcon v-else-if="iconName" :name="iconName" :size="size === 'sm' ? 14 : 16" />
            <slot></slot>
        </button>
    `,
};

export const AcSection = {
    name: 'AcSection',
    props: {
        title: { type: String, default: '' },
        sub: { type: String, default: '' },
    },
    template: `
        <section class="zg-section">
            <div v-if="title" class="zg-section__head">
                <h3 class="zg-section__title">{{ title }}</h3>
                <span v-if="sub" class="zg-section__sub">{{ sub }}</span>
                <span class="zg-section__spacer"></span>
                <slot name="action"></slot>
            </div>
            <slot></slot>
        </section>
    `,
};

export const AcEmpty = {
    name: 'AcEmpty',
    components: { AcIcon },
    props: {
        iconName: { type: String, default: 'logo' },
        title: { type: String, default: '这里还是空的' },
        desc: { type: String, default: '' },
    },
    template: `
        <div class="zg-empty">
            <span class="zg-empty__mark"><AcIcon :name="iconName" :size="26" /></span>
            <p class="zg-empty__title">{{ title }}</p>
            <p v-if="desc" class="zg-empty__desc">{{ desc }}</p>
            <div class="zg-empty__slot"><slot></slot></div>
        </div>
    `,
};

export const AcLoading = {
    name: 'AcLoading',
    components: { AcIcon },
    props: {
        lines: { type: Array, default: () => ['灯光亮起', '摄影机就位', '快好了'] },
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
        <div class="zg-loading">
            <span class="zg-loading__breath"><AcIcon name="logo" :size="24" /></span>
            <p class="zg-loading__text" :key="index">{{ text }}</p>
            <p v-if="slow" class="zg-loading__slow">有点慢，再等等 —— 别重复点，一次只会生成一份</p>
        </div>
    `,
};

export const AcField = {
    name: 'AcField',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
    },
    template: `
        <div class="zg-field">
            <div v-if="label" class="zg-field__head"><span class="zg-field__label">{{ label }}</span></div>
            <slot></slot>
            <p v-if="hint" class="zg-field__hint">{{ hint }}</p>
        </div>
    `,
};

/** 覆盖全屏的弹窗壳：点遮罩关闭（persistent 时不关） */
export const AcModalShell = {
    name: 'AcModalShell',
    components: { AcIcon },
    props: {
        title: { type: String, default: '' },
        persistent: { type: Boolean, default: false },
        wide: { type: Boolean, default: false },
    },
    emits: ['close'],
    template: `
        <div class="zg-modal" @click.self="persistent ? null : $emit('close')">
            <div class="zg-modal__panel" :class="{ 'is-wide': wide }">
                <div class="zg-modal__head" v-if="title">
                    <span class="zg-modal__title">{{ title }}</span>
                    <button v-if="!persistent" type="button" class="zg-modal__close" @click="$emit('close')">
                        <AcIcon name="close" :size="16" />
                    </button>
                </div>
                <div class="zg-modal__body"><slot></slot></div>
                <div class="zg-modal__foot"><slot name="actions"></slot></div>
            </div>
        </div>
    `,
};

/** 属性进度条（0~100） */
export const AcBar = {
    name: 'AcBar',
    props: {
        label: { type: String, default: '' },
        value: { type: Number, default: 0 },
        max: { type: Number, default: 100 },
        kind: { type: String, default: '' },   // '' | fame | energy
        delta: { type: Number, default: 0 },
    },
    computed: {
        pct() {
            const v = Math.max(0, Math.min(this.max, this.value));
            return Math.round((v / this.max) * 100);
        },
    },
    template: `
        <div class="zg-bar" :class="kind ? 'zg-bar--' + kind : ''">
            <div class="zg-bar__meta">
                <span class="zg-bar__label">{{ label }}</span>
                <span class="zg-bar__value">{{ Math.round(value) }}<i>/{{ max }}</i>
                    <em v-if="delta" :class="delta > 0 ? 'is-up' : 'is-down'">{{ delta > 0 ? '+' + delta : delta }}</em>
                </span>
            </div>
            <div class="zg-bar__track"><div class="zg-bar__fill" :style="{ width: pct + '%' }"></div></div>
        </div>
    `,
};

/** 小标签：tone = danger / success / warn / info / violet / plain */
export const AcTag = {
    name: 'AcTag',
    props: {
        tone: { type: String, default: 'plain' },
    },
    template: `<span class="zg-tag" :class="'zg-tag--' + tone"><slot></slot></span>`,
};

/** NPC 头像：名字首字 + 确定性色相 */
export const AcAvatar = {
    name: 'AcAvatar',
    props: {
        name: { type: String, default: '?' },
        hue: { type: Number, default: 200 },
        size: { type: Number, default: 40 },
    },
    computed: {
        style() {
            return {
                width: `${this.size}px`,
                height: `${this.size}px`,
                background: `hsl(${this.hue}, 32%, 88%)`,
                color: `hsl(${this.hue}, 42%, 32%)`,
                fontSize: `${Math.round(this.size * 0.42)}px`,
            };
        },
        char() { return String(this.name || '?').slice(0, 1); },
    },
    template: `<span class="zg-avatar" :style="style">{{ char }}</span>`,
};

export const UI = {
    AcIcon, AcBtn, AcSection, AcEmpty, AcLoading, AcField, AcModalShell, AcBar, AcTag, AcAvatar,
};
