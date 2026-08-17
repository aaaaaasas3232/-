/**
 * App 制作 · 通用控件
 *
 * 问卷里翻来覆去就那么几种题型：单选一张卡、多选一堆卡、填一行字、填一段字。
 * 这些控件抽出来的判据不是「代码重复了几行」，是「改一次要改几个地方」——
 * 单选卡的选中样式如果散在九个 step 里，调一次间距要改九处。
 *
 * 所有控件都只负责「显示 + 抛事件」，不碰 store。
 * 状态永远单向：store → props → 控件 → emit → step 调 mutator → store。
 */

import { ICONS } from '../icons.js';

/**
 * 一段的标题 + 说明。
 *
 * 序号做成标题上方的一行小字，不做成标题左边的方块 ——
 * 方块会把标题往右推 32px，一行放不下的标题就得折行，
 * 而这九段里有四段的标题都在临界长度上。
 */
export const AmSectionHead = {
    name: 'AmSectionHead',
    props: {
        title: { type: String, default: '' },
        desc: { type: String, default: '' },
        index: { type: [String, Number], default: '' },
        total: { type: [String, Number], default: '' },
    },
    template: `
        <header class="am-sechead">
            <span v-if="index !== ''" class="am-sechead__kicker">第 {{ index }} 步{{ total !== '' ? ' / 共 ' + total + ' 步' : '' }}</span>
            <h2 class="am-sechead__title">{{ title }}</h2>
            <p v-if="desc" class="am-sechead__desc">{{ desc }}</p>
        </header>
    `,
};

/** 一个问题块：标题 + 可选说明 + 插槽内容 */
export const AmField = {
    name: 'AmField',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
        term: { type: String, default: '' },
    },
    template: `
        <div class="am-field">
            <div v-if="label" class="am-field__head">
                <label class="am-field__label">{{ label }}</label>
                <slot name="label-extra" />
            </div>
            <p v-if="hint" class="am-field__hint">{{ hint }}</p>
            <slot />
        </div>
    `,
};

/** 文本输入 */
export const AmInput = {
    name: 'AmInput',
    props: {
        modelValue: { type: String, default: '' },
        placeholder: { type: String, default: '' },
        maxlength: { type: Number, default: 0 },
        mono: { type: Boolean, default: false },
    },
    emits: ['update:modelValue'],
    template: `
        <input
            class="am-input"
            :class="{ 'is-mono': mono }"
            type="text"
            :placeholder="placeholder"
            :maxlength="maxlength || null"
            :value="modelValue"
            @input="$emit('update:modelValue', $event.target.value)"
        />
    `,
};

/** 多行输入 */
export const AmTextarea = {
    name: 'AmTextarea',
    props: {
        modelValue: { type: String, default: '' },
        placeholder: { type: String, default: '' },
        rows: { type: Number, default: 3 },
    },
    emits: ['update:modelValue'],
    template: `
        <textarea
            class="am-input am-input--area"
            :rows="rows"
            :placeholder="placeholder"
            :value="modelValue"
            @input="$emit('update:modelValue', $event.target.value)"
        ></textarea>
    `,
};

/**
 * 选项卡片组。单选和多选共用一个组件 ——
 * 它们的差别只有「选中时是替换还是追加」，样式和布局完全一样。
 *
 * options: [{ value, title, desc, sub, hint }]
 */
export const AmOptions = {
    name: 'AmOptions',
    props: {
        options: { type: Array, default: () => [] },
        modelValue: { type: [String, Number, Array, Boolean], default: '' },
        multiple: { type: Boolean, default: false },
        cols: { type: Number, default: 2 },
        compact: { type: Boolean, default: false },
    },
    emits: ['update:modelValue', 'pick'],
    computed: {
        tickIcon() { return ICONS.check; },
        selected() {
            if (this.multiple) return Array.isArray(this.modelValue) ? this.modelValue.map(String) : [];
            return [String(this.modelValue)];
        },
        gridStyle() {
            return { '--am-opt-cols': String(this.cols) };
        },
    },
    methods: {
        isOn(value) { return this.selected.indexOf(String(value)) >= 0; },
        pick(value) {
            this.$emit('pick', value);
            if (!this.multiple) { this.$emit('update:modelValue', value); return; }
            const cur = Array.isArray(this.modelValue) ? [...this.modelValue] : [];
            const i = cur.indexOf(value);
            if (i >= 0) cur.splice(i, 1); else cur.push(value);
            this.$emit('update:modelValue', cur);
        },
    },
    template: `
        <div class="am-opts" :class="{ 'is-compact': compact, 'is-multi': multiple }" :style="gridStyle">
            <button
                v-for="o in options" :key="o.value"
                type="button"
                class="am-opt"
                :class="{ 'is-on': isOn(o.value) }"
                :aria-pressed="isOn(o.value)"
                @click="pick(o.value)"
            >
                <span v-if="multiple" class="am-opt__tick" aria-hidden="true" v-html="tickIcon"></span>
                <span class="am-opt__title">{{ o.title }}</span>
                <span v-if="o.desc" class="am-opt__desc">{{ o.desc }}</span>
                <span v-if="o.sub" class="am-opt__sub">{{ o.sub }}</span>
            </button>
        </div>
    `,
};

/** 开关行 */
export const AmSwitch = {
    name: 'AmSwitch',
    props: {
        modelValue: { type: Boolean, default: false },
        label: { type: String, default: '' },
        desc: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    template: `
        <button type="button" class="am-switchrow" @click="$emit('update:modelValue', !modelValue)">
            <span class="am-switchrow__text">
                <span class="am-switchrow__label">{{ label }}</span>
                <span v-if="desc" class="am-switchrow__desc">{{ desc }}</span>
            </span>
            <span class="am-switch" :class="{ 'is-on': modelValue }"><i></i></span>
        </button>
    `,
};

/**
 * 提示条。tone: info / warn / danger / ok
 *
 * 带图标是因为这四种语气在无彩界面里只靠底色区分不够 ——
 * 浅黄和浅红缩到 12px 字号的一小条时，色差已经很难分辨了。
 */
export const AmNote = {
    name: 'AmNote',
    props: {
        tone: { type: String, default: 'info' },
    },
    computed: {
        icon() {
            return {
                info: ICONS.info,
                warn: ICONS.warn,
                danger: ICONS.warn,
                ok: ICONS.check,
            }[this.tone] || ICONS.info;
        },
    },
    template: `
        <div class="am-note" :class="'am-note--' + tone">
            <span class="am-note__icon" aria-hidden="true" v-html="icon"></span>
            <div class="am-note__body"><slot /></div>
        </div>
    `,
};

/** 一排小标签，用来展示「已经选了什么」 */
export const AmChips = {
    name: 'AmChips',
    props: {
        items: { type: Array, default: () => [] },
        empty: { type: String, default: '还没选' },
    },
    template: `
        <div class="am-chips">
            <span v-if="!items.length" class="am-chips__empty">{{ empty }}</span>
            <span v-for="(t, i) in items" :key="i" class="am-chip">{{ t }}</span>
        </div>
    `,
};

export const UI_COMPONENTS = {
    AmSectionHead, AmField, AmInput, AmTextarea, AmOptions, AmSwitch, AmNote, AmChips,
};
