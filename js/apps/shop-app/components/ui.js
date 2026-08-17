/**
 * 四叶草 · 通用控件
 *
 * 全部无状态、只认 props。样式在 `css/apps/shop/_ui.css`，
 * 颜色一律走 `--sp-*` 变量 —— 这里不出现任何色值。
 *
 * 弹窗刻意**不用** AcModal：那套是动森风 squircle + 右上角凹陷叉，
 * 和韩系清新的调子不搭。这里的 `sp-sheet` 是自己的一套：
 * 从底部升起、圆角只在上面两个角、点遮罩关闭、没有叉。
 */

import { icon } from '../icons.js';

export const SpIcon = {
    name: 'SpIcon',
    props: {
        name: { type: String, required: true },
        size: { type: [Number, String], default: 20 },
    },
    computed: {
        svg() { return icon(this.name, { size: Number(this.size) || 20 }); },
    },
    template: `<span class="sp-icon" v-html="svg"></span>`,
};

export const SpBtn = {
    name: 'SpBtn',
    components: { SpIcon },
    props: {
        variant: { type: String, default: 'ghost' },   // primary | soft | ghost | line | danger
        size: { type: String, default: 'md' },          // sm | md | lg
        icon: { type: String, default: '' },
        block: Boolean,
        disabled: Boolean,
        loading: Boolean,
    },
    emits: ['click'],
    template: `
        <button
            class="sp-btn"
            :class="['sp-btn--' + variant, 'sp-btn--' + size, { 'is-block': block, 'is-loading': loading }]"
            :disabled="disabled || loading"
            @click="$emit('click', $event)"
        >
            <span v-if="loading" class="sp-btn__spin"></span>
            <sp-icon v-else-if="icon" :name="icon" :size="size === 'sm' ? 15 : 17" />
            <span class="sp-btn__label"><slot /></span>
        </button>
    `,
};

export const SpChip = {
    name: 'SpChip',
    props: {
        active: Boolean,
        tone: { type: String, default: '' },   // '' | accent | muted
    },
    emits: ['click'],
    template: `
        <button class="sp-chip" :class="[{ 'is-active': active }, tone && 'sp-chip--' + tone]" @click="$emit('click')">
            <slot />
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
        <div class="sp-field">
            <div v-if="label" class="sp-field__head">
                <span class="sp-field__label">{{ label }}</span>
                <slot name="label-extra" />
            </div>
            <slot />
            <p v-if="hint" class="sp-field__hint">{{ hint }}</p>
        </div>
    `,
};

export const SpInput = {
    name: 'SpInput',
    props: {
        modelValue: { type: [String, Number], default: '' },
        placeholder: { type: String, default: '' },
        type: { type: String, default: 'text' },
        maxlength: { type: Number, default: 0 },
        disabled: Boolean,
    },
    emits: ['update:modelValue', 'enter'],
    template: `
        <input
            class="sp-input"
            :type="type"
            :value="modelValue"
            :placeholder="placeholder"
            :maxlength="maxlength || undefined"
            :disabled="disabled"
            @input="$emit('update:modelValue', $event.target.value)"
            @keydown.enter="$emit('enter')"
        />
    `,
};

export const SpTextarea = {
    name: 'SpTextarea',
    props: {
        modelValue: { type: String, default: '' },
        placeholder: { type: String, default: '' },
        rows: { type: Number, default: 3 },
    },
    emits: ['update:modelValue'],
    template: `
        <textarea
            class="sp-textarea"
            :rows="rows"
            :value="modelValue"
            :placeholder="placeholder"
            @input="$emit('update:modelValue', $event.target.value)"
        ></textarea>
    `,
};

export const SpSwitch = {
    name: 'SpSwitch',
    props: { modelValue: Boolean },
    emits: ['update:modelValue'],
    template: `
        <button class="sp-switch" :class="{ 'is-on': modelValue }" @click="$emit('update:modelValue', !modelValue)">
            <span class="sp-switch__dot"></span>
        </button>
    `,
};

export const SpEmpty = {
    name: 'SpEmpty',
    components: { SpIcon },
    props: {
        icon: { type: String, default: 'clover' },
        title: { type: String, default: '这里还什么都没有' },
        desc: { type: String, default: '' },
    },
    template: `
        <div class="sp-empty">
            <span class="sp-empty__mark" v-html="markSvg"></span>
            <p class="sp-empty__title">{{ title }}</p>
            <p v-if="desc" class="sp-empty__desc">{{ desc }}</p>
            <div class="sp-empty__slot"><slot /></div>
        </div>
    `,
    computed: {
        markSvg() { return icon(this.icon, { size: 30 }); },
    },
};

/**
 * 骨架屏。
 *
 * 列表生成要好几秒，这段时间给「空」是不对的 ——
 * 用户会以为坏了。给骨架，他知道东西在路上。
 */
export const SpSkeleton = {
    name: 'SpSkeleton',
    props: {
        rows: { type: Number, default: 4 },
        variant: { type: String, default: 'card' },   // card | line
    },
    template: `
        <div class="sp-skeleton" :class="'sp-skeleton--' + variant">
            <div v-for="n in rows" :key="n" class="sp-skeleton__item"></div>
        </div>
    `,
};

/**
 * 底部升起的面板。本 App 所有弹层都用它。
 *
 * 规矩固化在组件里，不靠「每处都记得传这个参数」：
 *   - 点遮罩关闭，没有右上角的叉
 *   - 高度上限 `100%` 而不是 `80vh` —— vh 是**浏览器视口**，
 *     而这是个手机模拟器，弹层活在 `.app-shell` 里。
 *     桌面上 80vh 往往比手机屏还高，弹层会顶出屏幕。
 */
export const SpSheet = {
    name: 'SpSheet',
    components: { SpIcon },
    props: {
        title: { type: String, default: '' },
        desc: { type: String, default: '' },
        size: { type: String, default: 'md' },   // sm | md | lg | full
    },
    emits: ['close'],
    template: `
        <div class="sp-sheet-mask" @click.self="$emit('close')">
            <div class="sp-sheet" :class="'sp-sheet--' + size">
                <div class="sp-sheet__grip"></div>
                <header v-if="title" class="sp-sheet__head">
                    <div>
                        <h3 class="sp-sheet__title">{{ title }}</h3>
                        <p v-if="desc" class="sp-sheet__desc">{{ desc }}</p>
                    </div>
                    <slot name="head-extra" />
                </header>
                <div class="sp-sheet__body"><slot /></div>
                <footer v-if="$slots.footer" class="sp-sheet__foot"><slot name="footer" /></footer>
            </div>
        </div>
    `,
};

/** 一行「标签 → 值」，详情页和钱包页到处在用 */
export const SpKv = {
    name: 'SpKv',
    props: {
        label: { type: String, default: '' },
        value: { type: [String, Number], default: '' },
        strong: Boolean,
    },
    template: `
        <div class="sp-kv" :class="{ 'is-strong': strong }">
            <span class="sp-kv__k">{{ label }}</span>
            <span class="sp-kv__v"><slot>{{ value }}</slot></span>
        </div>
    `,
};

/** 分区标题 */
export const SpSection = {
    name: 'SpSection',
    props: {
        title: { type: String, default: '' },
        sub: { type: String, default: '' },
    },
    template: `
        <section class="sp-section">
            <header v-if="title" class="sp-section__head">
                <h2 class="sp-section__title">{{ title }}</h2>
                <span v-if="sub" class="sp-section__sub">{{ sub }}</span>
                <slot name="action" />
            </header>
            <slot />
        </section>
    `,
};

/**
 * 价格。
 *
 * 抽成组件是因为货币名来自世界观、随时可能是「灵石」「信用点」，
 * 而它在十几个地方出现。写死「金币」的话换个世界观就穿帮了。
 */
export const SpPrice = {
    name: 'SpPrice',
    props: {
        value: { type: [Number, String], default: 0 },
        currency: { type: String, default: '金币' },
        original: { type: [Number, String], default: 0 },
        size: { type: String, default: 'md' },
        prefix: { type: String, default: '' },
    },
    computed: {
        text() {
            const v = Number(this.value) || 0;
            return Number.isInteger(v) ? String(v) : v.toFixed(2);
        },
        originalText() {
            const v = Number(this.original) || 0;
            if (v <= 0) return '';
            return Number.isInteger(v) ? String(v) : v.toFixed(2);
        },
    },
    template: `
        <span class="sp-price" :class="'sp-price--' + size">
            <span v-if="prefix" class="sp-price__prefix">{{ prefix }}</span>
            <span class="sp-price__num">{{ text }}</span>
            <span class="sp-price__unit">{{ currency }}</span>
            <s v-if="originalText" class="sp-price__was">{{ originalText }}</s>
        </span>
    `,
};

export const UI = {
    SpIcon, SpBtn, SpChip, SpField, SpInput, SpTextarea, SpSwitch,
    SpEmpty, SpSkeleton, SpSheet, SpKv, SpSection, SpPrice,
};
