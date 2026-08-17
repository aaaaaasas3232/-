/**
 * 日记 · 通用控件
 *
 * 全部是 Options API 普通对象（项目约定，和 relax-app / dream-weaver 一致）。
 *
 * ★ 一条硬规矩：这里没有任何颜色。所有配色来自 `_theme.css` 的 `--dy-*`。
 * ★ 也没有 emoji。需要符号的地方一律走 `icons.js` 的线性 SVG。
 *
 * 抽这一层的理由很实际：下面这些结构（分区标题、设置行、分档选择器、
 * 开关）在配置向导、生理期页、计划页、日记本设置里各出现三到五次。
 * 不抽的话改一次样式要改五个地方，而漏掉的那个不会报错，只会长得不一样。
 */

import { icon } from '../icons.js';

// ============================================================
// 基础
// ============================================================

export const DyIcon = {
    name: 'DyIcon',
    props: { name: { type: String, required: true } },
    computed: {
        html() { return icon(this.name); },
    },
    template: `<span class="dy-iconwrap" v-html="html"></span>`,
};

export const DyBtn = {
    name: 'DyBtn',
    components: { DyIcon },
    props: {
        variant: { type: String, default: '' },     // '' | primary | ghost | danger
        size: { type: String, default: '' },        // '' | sm
        iconName: { type: String, default: '' },
        block: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
    },
    emits: ['click'],
    computed: {
        cls() {
            return [
                this.variant ? `dy-btn--${this.variant}` : '',
                this.size ? `dy-btn--${this.size}` : '',
                this.block ? 'dy-btn--block' : '',
            ].filter(Boolean);
        },
    },
    template: `
        <button type="button" class="dy-btn" :class="cls" :disabled="disabled" @click="$emit('click', $event)">
            <DyIcon v-if="iconName" :name="iconName" />
            <span v-if="$slots.default"><slot></slot></span>
        </button>
    `,
};

export const DyIconBtn = {
    name: 'DyIconBtn',
    components: { DyIcon },
    props: {
        name: { type: String, required: true },
        label: { type: String, default: '' },
    },
    emits: ['click'],
    template: `
        <button type="button" class="dy-iconbtn" :aria-label="label || name" @click="$emit('click', $event)">
            <DyIcon :name="name" />
        </button>
    `,
};

// ============================================================
// 布局
// ============================================================

export const DySection = {
    name: 'DySection',
    props: {
        title: { type: String, default: '' },
        note: { type: String, default: '' },
        action: { type: String, default: '' },
    },
    emits: ['action'],
    template: `
        <section class="dy-section">
            <header v-if="title || action" class="dy-section__head">
                <span class="dy-section__title">{{ title }}</span>
                <span v-if="note" class="dy-section__note">{{ note }}</span>
                <button v-if="action" type="button" class="dy-section__action" @click="$emit('action')">{{ action }}</button>
            </header>
            <slot></slot>
        </section>
    `,
};

export const DyRow = {
    name: 'DyRow',
    components: { DyIcon },
    props: {
        label: { type: String, default: '' },
        value: { type: String, default: '' },
        muted: { type: Boolean, default: false },
        chevron: { type: Boolean, default: false },
        clickable: { type: Boolean, default: true },
    },
    emits: ['click'],
    template: `
        <component
            :is="clickable ? 'button' : 'div'"
            :type="clickable ? 'button' : null"
            class="dy-row"
            :class="{ 'dy-row--static': !clickable }"
            @click="clickable && $emit('click', $event)"
        >
            <span class="dy-row__label">{{ label }}</span>
            <span v-if="$slots.default" class="dy-row__value"><slot></slot></span>
            <span v-else class="dy-row__value" :class="{ 'dy-row__value--muted': muted }">{{ value }}</span>
            <span v-if="chevron" class="dy-row__chev"><DyIcon name="right" /></span>
        </component>
    `,
};

export const DyEmpty = {
    name: 'DyEmpty',
    components: { DyIcon },
    props: {
        iconName: { type: String, default: 'sheet' },
        text: { type: String, default: '' },
    },
    template: `
        <div class="dy-empty">
            <DyIcon :name="iconName" />
            <p class="dy-empty__text"><slot>{{ text }}</slot></p>
        </div>
    `,
};

export const DyBusy = {
    name: 'DyBusy',
    props: { text: { type: String, default: '' } },
    template: `
        <div class="dy-busy">
            <span>{{ text }}</span>
            <span class="dy-busy__track"><span class="dy-busy__bar"></span></span>
        </div>
    `,
};

// ============================================================
// 表单
// ============================================================

export const DyFormRow = {
    name: 'DyFormRow',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
    },
    template: `
        <div class="dy-formrow">
            <span v-if="label" class="dy-formrow__label">{{ label }}</span>
            <slot></slot>
            <span v-if="hint" class="dy-formrow__hint">{{ hint }}</span>
        </div>
    `,
};

export const DySwitch = {
    name: 'DySwitch',
    props: { modelValue: { type: Boolean, default: false } },
    emits: ['update:modelValue'],
    template: `
        <button
            type="button"
            class="dy-switch"
            :class="{ 'is-on': modelValue }"
            role="switch"
            :aria-checked="String(modelValue)"
            @click="$emit('update:modelValue', !modelValue)"
        >
            <span class="dy-switch__dot"></span>
        </button>
    `,
};

/**
 * 一组小方块。
 *
 * `multiple` 时 modelValue 是数组，否则是单值。
 * 单选时再点一下已选项会取消（`allowEmpty`）—— 打卡场景经常需要「点错了撤销」。
 */
export const DyChips = {
    name: 'DyChips',
    props: {
        modelValue: { type: [String, Array], default: '' },
        options: { type: Array, default: () => [] },
        multiple: { type: Boolean, default: false },
        allowEmpty: { type: Boolean, default: true },
        wide: { type: Boolean, default: false },
    },
    emits: ['update:modelValue'],
    methods: {
        isOn(id) {
            return this.multiple
                ? (Array.isArray(this.modelValue) ? this.modelValue : []).includes(id)
                : this.modelValue === id;
        },
        pick(id) {
            if (this.multiple) {
                const cur = Array.isArray(this.modelValue) ? this.modelValue.slice() : [];
                const at = cur.indexOf(id);
                if (at === -1) cur.push(id);
                else cur.splice(at, 1);
                this.$emit('update:modelValue', cur);
                return;
            }
            if (this.modelValue === id && this.allowEmpty) {
                this.$emit('update:modelValue', '');
                return;
            }
            this.$emit('update:modelValue', id);
        },
    },
    template: `
        <div class="dy-chips">
            <button
                v-for="opt in options"
                :key="opt.id"
                type="button"
                class="dy-chip"
                :class="{ 'is-on': isOn(opt.id), 'dy-chip--wide': wide }"
                @click="pick(opt.id)"
            >{{ opt.name }}</button>
        </div>
    `,
};

/** 分档横条（经量 / 痛经这类有序等级） */
export const DyScale = {
    name: 'DyScale',
    props: {
        modelValue: { type: String, default: '' },
        options: { type: Array, default: () => [] },
    },
    emits: ['update:modelValue'],
    methods: {
        pick(id) {
            this.$emit('update:modelValue', this.modelValue === id ? '' : id);
        },
    },
    template: `
        <div class="dy-scale">
            <button
                v-for="opt in options"
                :key="opt.id"
                type="button"
                class="dy-scale__item"
                :class="{ 'is-on': modelValue === opt.id }"
                @click="pick(opt.id)"
            >{{ opt.name }}</button>
        </div>
    `,
};

export const DyStepper = {
    name: 'DyStepper',
    components: { DyIcon },
    props: {
        modelValue: { type: Number, default: 0 },
        min: { type: Number, default: 0 },
        max: { type: Number, default: 99 },
        step: { type: Number, default: 1 },
        suffix: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    methods: {
        bump(delta) {
            const next = Math.min(this.max, Math.max(this.min, Number(this.modelValue || 0) + delta * this.step));
            this.$emit('update:modelValue', next);
        },
    },
    template: `
        <div class="dy-stepper">
            <button type="button" class="dy-stepper__btn" :disabled="modelValue <= min" @click="bump(-1)">
                <DyIcon name="down" />
            </button>
            <span class="dy-stepper__value">{{ modelValue }}{{ suffix }}</span>
            <button type="button" class="dy-stepper__btn" :disabled="modelValue >= max" @click="bump(1)">
                <DyIcon name="up" />
            </button>
        </div>
    `,
};

/**
 * 日期输入。
 *
 * 用原生 `type="date"` 而不是自造日历：移动端原生选择器体验更好，
 * 而且它天然返回 `YYYY-MM-DD` —— 正好是本 App 全域用的日期格式，
 * 不需要任何转换（转换就是出错的地方）。
 */
export const DyDate = {
    name: 'DyDate',
    props: {
        modelValue: { type: String, default: '' },
        max: { type: String, default: '' },
        min: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    template: `
        <input
            class="dy-field"
            type="date"
            :value="modelValue"
            :max="max || null"
            :min="min || null"
            @input="$emit('update:modelValue', $event.target.value)"
        />
    `,
};

export const SHARED_COMPONENTS = {
    DyIcon, DyBtn, DyIconBtn,
    DySection, DyRow, DyEmpty, DyBusy,
    DyFormRow, DySwitch, DyChips, DyScale, DyStepper, DyDate,
};

export default SHARED_COMPONENTS;
