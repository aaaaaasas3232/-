/**
 * 小奇怪 · 通用控件
 *
 * 全部是 Options API 普通对象(项目约定 —— Vue 3 是**浏览器全局**,
 * 不是 npm 包,这里不能 `import { defineComponent } from 'vue'`)。
 *
 * ★ 两条硬规矩:
 *   1. 这里没有任何颜色。配色全部来自 `css/apps/oddity/index.css` 的 `--oq-*`。
 *   2. `methods` 一律方法简写,禁止箭头函数 —— 箭头函数里 `this` 会丢,
 *      按钮点了没反应而且不报错(AGENTS.md §10 那张表的第一行)。
 */

import { icon } from '../icons.js';
import { OqModal } from './oq-modal.js';
import { OqPanel } from './oq-panel.js';

// ============================================================
// 图标
// ============================================================

export const OqIcon = {
    name: 'OqIcon',
    props: {
        name: { type: String, required: true },
        size: { type: [Number, String], default: 0 },
    },
    computed: {
        html() { return icon(this.name); },
        style() {
            if (!this.size) return null;
            const px = typeof this.size === 'number' ? `${this.size}px` : this.size;
            return { '--oq-icon-size': px };
        },
    },
    template: `<span class="oq-icon" :style="style" v-html="html"></span>`,
};

// ============================================================
// 按钮
// ============================================================

export const OqButton = {
    name: 'OqButton',
    components: { OqIcon },
    props: {
        variant: { type: String, default: 'quiet' },   // primary | ghost | quiet | danger
        size: { type: String, default: 'md' },         // sm | md | lg
        iconName: { type: String, default: '' },
        iconOnly: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
        loading: { type: Boolean, default: false },
        block: { type: Boolean, default: false },
        label: { type: String, default: '' },
    },
    emits: ['click'],
    template: `
        <button
            type="button"
            class="oq-btn"
            :class="['oq-btn--' + variant, 'oq-btn--' + size, { 'is-icon-only': iconOnly, 'is-block': block, 'is-loading': loading }]"
            :disabled="disabled || loading"
            :aria-label="iconOnly ? (label || iconName) : null"
            @click="$emit('click', $event)"
        >
            <span v-if="loading" class="oq-btn-spinner" aria-hidden="true"></span>
            <OqIcon v-else-if="iconName" :name="iconName" />
            <span v-if="!iconOnly" class="oq-btn-label"><slot>{{ label }}</slot></span>
        </button>
    `,
};

// ============================================================
// 卡片
// ============================================================

/**
 * ins 风格卡片。
 *
 * 用户对双人扫雷的原话:「按 ins 风格,卡片式布局」。
 * 五张卡共用这一个壳,所以圆角 / 阴影 / 留白只有一处定义。
 */
export const OqCard = {
    name: 'OqCard',
    props: {
        title: { type: String, default: '' },
        step: { type: String, default: '' },
        hint: { type: String, default: '' },
        flat: { type: Boolean, default: false },
    },
    template: `
        <section class="oq-card" :class="{ 'is-flat': flat }">
            <header v-if="title || step || $slots.extra" class="oq-card-head">
                <span v-if="step" class="oq-card-step">{{ step }}</span>
                <h3 v-if="title" class="oq-card-title">{{ title }}</h3>
                <span v-if="hint" class="oq-card-hint">{{ hint }}</span>
                <span class="oq-card-extra"><slot name="extra"></slot></span>
            </header>
            <div class="oq-card-body"><slot></slot></div>
        </section>
    `,
};

// ============================================================
// 表单
// ============================================================

export const OqField = {
    name: 'OqField',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
    },
    template: `
        <label class="oq-field">
            <span v-if="label" class="oq-field-label">{{ label }}</span>
            <slot></slot>
            <span v-if="hint" class="oq-field-hint">{{ hint }}</span>
        </label>
    `,
};

export const OqInput = {
    name: 'OqInput',
    props: {
        modelValue: { type: [String, Number], default: '' },
        placeholder: { type: String, default: '' },
        type: { type: String, default: 'text' },
        maxlength: { type: Number, default: 0 },
        disabled: { type: Boolean, default: false },
    },
    emits: ['update:modelValue', 'enter'],
    template: `
        <input
            class="oq-input"
            :type="type"
            :value="modelValue"
            :placeholder="placeholder"
            :maxlength="maxlength || null"
            :disabled="disabled"
            autocomplete="off"
            @input="$emit('update:modelValue', $event.target.value)"
            @keydown.enter="$emit('enter', $event)"
        />
    `,
};

export const OqSwitch = {
    name: 'OqSwitch',
    props: {
        modelValue: { type: Boolean, default: false },
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
        disabled: { type: Boolean, default: false },
    },
    emits: ['update:modelValue'],
    template: `
        <label class="oq-switch" :class="{ 'is-disabled': disabled }">
            <span class="oq-switch-text">
                <span class="oq-switch-label">{{ label }}</span>
                <span v-if="hint" class="oq-switch-hint">{{ hint }}</span>
            </span>
            <input
                type="checkbox"
                class="oq-switch-input"
                :checked="modelValue"
                :disabled="disabled"
                @change="$emit('update:modelValue', $event.target.checked)"
            />
            <span class="oq-switch-track" aria-hidden="true"><i class="oq-switch-thumb"></i></span>
        </label>
    `,
};

/** 一排互斥的小胶囊 —— 版式选择、主题选择都用它 */
export const OqSegment = {
    name: 'OqSegment',
    props: {
        modelValue: { type: [String, Number], default: '' },
        options: { type: Array, default: () => [] },   // [{ value, label, sub }]
    },
    emits: ['update:modelValue'],
    template: `
        <div class="oq-segment" role="tablist">
            <button
                v-for="opt in options"
                :key="String(opt.value)"
                type="button"
                class="oq-segment-item"
                :class="{ 'is-active': String(opt.value) === String(modelValue) }"
                role="tab"
                :aria-selected="String(String(opt.value) === String(modelValue))"
                @click="$emit('update:modelValue', opt.value)"
            >
                <span class="oq-segment-label">{{ opt.label }}</span>
                <span v-if="opt.sub" class="oq-segment-sub">{{ opt.sub }}</span>
            </button>
        </div>
    `,
};

// ============================================================
// 状态
// ============================================================

export const OqEmpty = {
    name: 'OqEmpty',
    components: { OqIcon },
    props: {
        iconName: { type: String, default: 'info' },
        text: { type: String, default: '还没有内容' },
        hint: { type: String, default: '' },
    },
    template: `
        <div class="oq-empty">
            <OqIcon class="oq-empty-icon" :name="iconName" />
            <p class="oq-empty-text">{{ text }}</p>
            <p v-if="hint" class="oq-empty-hint">{{ hint }}</p>
            <div class="oq-empty-action"><slot></slot></div>
        </div>
    `,
};

export const OqSpinner = {
    name: 'OqSpinner',
    props: { label: { type: String, default: '' } },
    template: `
        <div class="oq-spinner" role="status">
            <span class="oq-spinner-ring" aria-hidden="true"></span>
            <span v-if="label" class="oq-spinner-label">{{ label }}</span>
        </div>
    `,
};

export const OqTag = {
    name: 'OqTag',
    props: { tone: { type: String, default: '' } },
    template: `<span class="oq-tag" :data-tone="tone || null"><slot></slot></span>`,
};

/**
 * 纯 CSS 爱心。
 *
 * 用户明确要求「『雷』用纯 css 爱心表示不要 emoji」。
 * 形状是经典的三件套:一个旋转 45° 的方块 + 两个圆形伪元素,
 * 具体在 `index.css` 的 `.oq-heart`。这里只负责给一个语义节点。
 */
export const OqHeart = {
    name: 'OqHeart',
    props: { tone: { type: String, default: '' } },
    template: `<i class="oq-heart" :data-tone="tone || null" aria-hidden="true"></i>`,
};

/** 生命值:一排小心,空的是描边 */
export const OqLives = {
    name: 'OqLives',
    props: {
        value: { type: Number, default: 0 },
        max: { type: Number, default: 5 },
    },
    computed: {
        slots() {
            const out = [];
            for (let i = 0; i < this.max; i += 1) out.push(i < this.value);
            return out;
        },
    },
    template: `
        <span class="oq-lives" :aria-label="value + ' / ' + max">
            <i
                v-for="(filled, index) in slots"
                :key="index"
                class="oq-heart oq-heart--mini"
                :class="{ 'is-empty': !filled }"
                aria-hidden="true"
            ></i>
        </span>
    `,
};

// ============================================================
// 列表行
// ============================================================

/**
 * 一行可点的条目 —— 人设选择、草稿箱、匿名列表全用它。
 *
 * ★ 之前这些地方各自复用 `.oq-themerow`(主题选择器的行)。名字对不上语义,
 *   而且「换个配色」那行有色块槽位,别处用就是一个空洞。收成独立组件之后
 *   加新列表不用再想「借哪个 class」。
 */
export const OqRow = {
    name: 'OqRow',
    props: {
        title: { type: String, default: '' },
        desc: { type: String, default: '' },
        active: { type: Boolean, default: false },
        muted: { type: Boolean, default: false },
    },
    emits: ['click'],
    template: `
        <div class="oq-row" :class="{ 'is-active': active, 'is-muted': muted }">
            <button type="button" class="oq-row-main" @click="$emit('click', $event)">
                <span class="oq-row-title">{{ title }}</span>
                <span v-if="desc" class="oq-row-desc">{{ desc }}</span>
                <slot></slot>
            </button>
            <div v-if="$slots.acts" class="oq-row-acts"><slot name="acts"></slot></div>
        </div>
    `,
};

/** 面板 / 卡片里那一小排文字按钮(重写、编辑、删除) */
export const OqMiniBtn = {
    name: 'OqMiniBtn',
    props: {
        tone: { type: String, default: '' },   // '' | danger | accent
        disabled: { type: Boolean, default: false },
        loading: { type: Boolean, default: false },
    },
    emits: ['click'],
    template: `
        <button
            type="button"
            class="oq-mini"
            :data-tone="tone || null"
            :class="{ 'is-loading': loading }"
            :disabled="disabled || loading"
            @click="$emit('click', $event)"
        ><slot></slot></button>
    `,
};

export const SHARED_COMPONENTS = {
    OqIcon, OqButton, OqCard, OqField, OqInput, OqSwitch,
    OqSegment, OqEmpty, OqSpinner, OqTag, OqHeart, OqLives,
    OqRow, OqMiniBtn,
    // ★ 弹层也放进来。之前 OqModal 只注册在根组件上,而 Vue 的组件解析是
    //   **局部**的 —— 沙漏 / 打字机 / 果冻心模板里的 <OqModal> 全部解析失败,
    //   表现正是「点了设定没有任何反应」,控制台只有一条 warn。
    OqModal, OqPanel,
};
