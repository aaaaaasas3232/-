/**
 * 灯塔 · 通用控件
 *
 * 全部无状态、只认 props。样式在 `css/apps/job/_ui.css`，
 * 颜色一律走 `--jb-*` 变量 —— 这里不出现任何色值。
 *
 * 弹层规矩（点遮罩关、没有叉、从底部升起）固化在 `JbSheet` 里而不是
 * 「每处都记得传参数」—— 靠纪律维持的一致性迟早会漏一个。
 */

import { icon } from '../icons.js';
import { LOADING_LINES } from '../constants.js';

export const JbIcon = {
    name: 'JbIcon',
    props: {
        name: { type: String, required: true },
        size: { type: [Number, String], default: 20 },
    },
    computed: {
        svg() { return icon(this.name, { size: Number(this.size) || 20 }); },
    },
    template: '<span class="jb-icon" v-html="svg"></span>',
};

export const JbBtn = {
    name: 'JbBtn',
    components: { JbIcon },
    props: {
        variant: { type: String, default: 'ghost' },   // primary | accent | soft | ghost | line | danger
        size: { type: String, default: 'md' },          // sm | md | lg
        icon: { type: String, default: '' },
        block: Boolean,
        disabled: Boolean,
        loading: Boolean,
    },
    emits: ['click'],
    template: `
        <button
            class="jb-btn"
            :class="['jb-btn--' + variant, 'jb-btn--' + size, { 'is-block': block, 'is-loading': loading }]"
            :disabled="disabled || loading"
            @click="$emit('click', $event)"
        >
            <span v-if="loading" class="jb-btn__spin"></span>
            <jb-icon v-else-if="icon" :name="icon" :size="size === 'sm' ? 15 : 17" />
            <span class="jb-btn__label"><slot /></span>
        </button>
    `,
};

export const JbChip = {
    name: 'JbChip',
    props: {
        active: Boolean,
        tone: { type: String, default: '' },   // '' | rival
    },
    emits: ['click'],
    template: `
        <button
            class="jb-chip"
            :class="[{ 'is-active': active }, tone && 'jb-chip--' + tone]"
            @click="$emit('click')"
        ><slot /></button>
    `,
};

export const JbField = {
    name: 'JbField',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
    },
    template: `
        <div class="jb-field">
            <div v-if="label" class="jb-field__head">
                <span class="jb-field__label">{{ label }}</span>
                <slot name="label-extra" />
            </div>
            <slot />
            <p v-if="hint" class="jb-field__hint">{{ hint }}</p>
        </div>
    `,
};

export const JbInput = {
    name: 'JbInput',
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
            class="jb-input"
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

export const JbTextarea = {
    name: 'JbTextarea',
    props: {
        modelValue: { type: String, default: '' },
        placeholder: { type: String, default: '' },
        rows: { type: Number, default: 3 },
    },
    emits: ['update:modelValue'],
    template: `
        <textarea
            class="jb-textarea"
            :rows="rows"
            :value="modelValue"
            :placeholder="placeholder"
            @input="$emit('update:modelValue', $event.target.value)"
        ></textarea>
    `,
};

export const JbSwitch = {
    name: 'JbSwitch',
    props: { modelValue: Boolean, disabled: Boolean },
    emits: ['update:modelValue'],
    template: `
        <button
            class="jb-switch" :class="{ 'is-on': modelValue }"
            :disabled="disabled"
            @click="$emit('update:modelValue', !modelValue)"
        ><span class="jb-switch__dot"></span></button>
    `,
};

export const JbSeg = {
    name: 'JbSeg',
    props: {
        modelValue: { type: [String, Number], default: '' },
        options: { type: Array, default: () => [] },   // [{ id, label }]
    },
    emits: ['update:modelValue'],
    template: `
        <div class="jb-seg">
            <button
                v-for="o in options" :key="o.id"
                class="jb-seg__btn" :class="{ 'is-on': o.id === modelValue }"
                @click="$emit('update:modelValue', o.id)"
            >{{ o.label }}</button>
        </div>
    `,
};

export const JbSection = {
    name: 'JbSection',
    props: {
        title: { type: String, default: '' },
        sub: { type: String, default: '' },
    },
    template: `
        <section class="jb-section">
            <header v-if="title" class="jb-section__head">
                <h2 class="jb-section__title">{{ title }}</h2>
                <span v-if="sub" class="jb-section__sub">{{ sub }}</span>
                <slot name="action" />
            </header>
            <slot />
        </section>
    `,
};

export const JbKv = {
    name: 'JbKv',
    props: {
        label: { type: String, default: '' },
        value: { type: [String, Number], default: '' },
        strong: Boolean,
    },
    template: `
        <div class="jb-kv" :class="{ 'is-strong': strong }">
            <span class="jb-kv__k">{{ label }}</span>
            <span class="jb-kv__v"><slot>{{ value }}</slot></span>
        </div>
    `,
};

/**
 * 金额。
 *
 * 抽成组件是因为货币名来自世界观、随时可能是「灵石」「信用点」，
 * 而它在二十几个地方出现。写死「金币」的话换个世界观就穿帮了。
 */
export const JbMoney = {
    name: 'JbMoney',
    props: {
        value: { type: [Number, String], default: 0 },
        currency: { type: String, default: '金币' },
        size: { type: String, default: 'md' },     // sm | md | lg
        tone: { type: String, default: '' },       // '' | in | out | coin
        sign: { type: Boolean, default: false },
    },
    computed: {
        num() {
            const v = Number(this.value) || 0;
            const abs = Math.abs(v);
            const body = Number.isInteger(abs) ? String(abs) : abs.toFixed(2);
            if (!this.sign) return body;
            return (v < 0 ? '−' : '+') + body;
        },
    },
    template: `
        <span class="jb-money" :class="['jb-money--' + size, tone && 'jb-money--' + tone]">
            <span class="jb-money__num">{{ num }}</span>
            <span class="jb-money__unit">{{ currency }}</span>
        </span>
    `,
};

export const JbEmpty = {
    name: 'JbEmpty',
    props: {
        icon: { type: String, default: 'beacon' },
        title: { type: String, default: '这里还什么都没有' },
        desc: { type: String, default: '' },
    },
    computed: {
        markSvg() { return icon(this.icon, { size: 30 }); },
    },
    template: `
        <div class="jb-empty">
            <span class="jb-empty__mark" v-html="markSvg"></span>
            <p class="jb-empty__title">{{ title }}</p>
            <p v-if="desc" class="jb-empty__desc">{{ desc }}</p>
            <div class="jb-empty__slot"><slot /></div>
        </div>
    `,
};

/**
 * 骨架屏。
 *
 * ★ 只用在「结构已知、只差内容」的地方（列表、首屏）。
 *   详情 / HR / 小剧场的生成期间用 `JbLoading` —— 那时候连有几条内容
 *   都不知道，画一堆假条目再整个换掉比等待更难受。
 */
export const JbSkeleton = {
    name: 'JbSkeleton',
    props: {
        rows: { type: Number, default: 4 },
        variant: { type: String, default: 'card' },   // card | line
    },
    template: `
        <div class="jb-skeleton" :class="'jb-skeleton--' + variant">
            <div v-for="n in rows" :key="n" class="jb-skeleton__item"></div>
        </div>
    `,
};

/**
 * 生成中的加载态。
 *
 * 三件事一起做，为的是让用户知道「过了多久」而不是「还在转」：
 *   - 光圈一圈 1.6 秒，能数
 *   - 每 2.4 秒换一句文案
 *   - 超过 12 秒承认「有点慢」
 * 最后那句挡掉了大半的重复点击。
 */
export const JbLoading = {
    name: 'JbLoading',
    props: {
        kind: { type: String, default: 'feed' },
    },
    data() {
        return { idx: 0, slow: false };
    },
    computed: {
        lines() { return LOADING_LINES[this.kind] || LOADING_LINES.feed; },
        line() { return this.lines[this.idx % this.lines.length]; },
        beam() { return icon('beacon', { size: 22 }); },
    },
    mounted() {
        this._t = setInterval(() => { this.idx += 1; }, 2400);
        this._slow = setTimeout(() => { this.slow = true; }, 12000);
    },
    beforeUnmount() {
        clearInterval(this._t);
        clearTimeout(this._slow);
    },
    template: `
        <div class="jb-loading">
            <span class="jb-loading__beam" v-html="beam"></span>
            <p class="jb-loading__line">{{ line }}</p>
            <p v-if="slow" class="jb-loading__slow">有点慢，再等等 —— 已经在路上了</p>
        </div>
    `,
};

export const JbError = {
    name: 'JbError',
    props: { text: { type: String, default: '' } },
    emits: ['close'],
    computed: {
        closeSvg() { return icon('close', { size: 15 }); },
    },
    template: `
        <div v-if="text" class="jb-error">
            <span>{{ text }}</span>
            <button class="jb-error__close" v-html="closeSvg" @click="$emit('close')"></button>
        </div>
    `,
};

export const JbSheet = {
    name: 'JbSheet',
    props: {
        title: { type: String, default: '' },
        desc: { type: String, default: '' },
        size: { type: String, default: 'md' },   // sm | md | lg | full
    },
    emits: ['close'],
    template: `
        <div class="jb-sheet-mask" @click.self="$emit('close')">
            <div class="jb-sheet" :class="'jb-sheet--' + size">
                <div class="jb-sheet__grip"></div>
                <header v-if="title" class="jb-sheet__head">
                    <div>
                        <h3 class="jb-sheet__title">{{ title }}</h3>
                        <p v-if="desc" class="jb-sheet__desc">{{ desc }}</p>
                    </div>
                    <slot name="head-extra" />
                </header>
                <div class="jb-sheet__body"><slot /></div>
                <footer v-if="$slots.footer" class="jb-sheet__foot"><slot name="footer" /></footer>
            </div>
        </div>
    `,
};

/** 子页外壳：一条返回栏 + 可滚的内容区。所有 panel 都套它。 */
export const JbPanel = {
    name: 'JbPanel',
    components: { JbIcon },
    props: {
        title: { type: String, default: '' },
    },
    emits: ['close'],
    computed: {
        backSvg() { return icon('back', { size: 20 }); },
    },
    template: `
        <div class="jb-panel">
            <header class="jb-panel__bar">
                <button class="jb-iconbtn" v-html="backSvg" @click="$emit('close')"></button>
                <span class="jb-panel__title">{{ title }}</span>
                <div class="jb-panel__bar-right"><slot name="bar" /></div>
            </header>
            <div class="jb-panel__body"><slot /></div>
        </div>
    `,
};

export const UI = {
    JbIcon, JbBtn, JbChip, JbField, JbInput, JbTextarea, JbSwitch, JbSeg,
    JbSection, JbKv, JbMoney, JbEmpty, JbSkeleton, JbLoading, JbError, JbSheet, JbPanel,
};
