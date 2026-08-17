/**
 * 氧气 · 通用小组件
 *
 * 按钮 / 分区 / 空态 / 加载 / 骨架 / 表单行 / 头像 / 标签 / stub 卡 /
 * 数字 / prompt 预览 —— 所有页面复用这一份，不许各页自己拼一遍。
 * 样式全部走 --ox-* token。禁 emoji、禁渐变。
 */

import { icon } from '../icons.js';
import * as store from '../store.js';
import { fmtCap, fmtCount } from '../utils.js';
import { postTypeLabel } from '../constants.js';

/** 图标（v-html 一层薄壳；name 是 icons.js 里的键，开发者受信任内容） */
export const OxIcon = {
    name: 'OxIcon',
    props: {
        name: { type: String, required: true },
        size: { type: Number, default: 18 },
    },
    computed: {
        svg() { return icon(this.name, { size: this.size }); },
    },
    template: `<span class="ox-icon" v-html="svg"></span>`,
};

/** 按钮：variant = ink（黑主钮）/ line / soft / ghost / danger */
export const OxButton = {
    name: 'OxButton',
    components: { OxIcon },
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
            class="ox-btn"
            :class="['ox-btn--' + variant, 'ox-btn--' + size, { 'is-block': block }]"
            :disabled="disabled || loading"
            @click="$emit('click', $event)"
        >
            <span v-if="loading" class="ox-btn__spin"></span>
            <OxIcon v-else-if="iconName" :name="iconName" :size="size === 'sm' ? 14 : 16" />
            <slot></slot>
        </button>
    `,
};

/** 分区标题 + 内容 */
export const OxSection = {
    name: 'OxSection',
    props: {
        title: { type: String, default: '' },
        sub: { type: String, default: '' },
    },
    template: `
        <section class="ox-section">
            <div v-if="title" class="ox-section__head">
                <h3 class="ox-section__title">{{ title }}</h3>
                <span v-if="sub" class="ox-section__sub">{{ sub }}</span>
                <span class="ox-section__spacer"></span>
                <slot name="action"></slot>
            </div>
            <slot></slot>
        </section>
    `,
};

/** 空态 */
export const OxEmpty = {
    name: 'OxEmpty',
    components: { OxIcon },
    props: {
        iconName: { type: String, default: 'logo' },
        title: { type: String, default: '这里还是空的' },
        desc: { type: String, default: '' },
    },
    template: `
        <div class="ox-empty">
            <span class="ox-empty__mark"><OxIcon :name="iconName" :size="26" /></span>
            <p class="ox-empty__title">{{ title }}</p>
            <p v-if="desc" class="ox-empty__desc">{{ desc }}</p>
            <div class="ox-empty__slot"><slot></slot></div>
        </div>
    `,
};

/** 加载动画：一个呼吸圈明暗起伏；超 12s 补一句挡重复点击 */
export const OxLoading = {
    name: 'OxLoading',
    components: { OxIcon },
    props: {
        lines: { type: Array, default: () => ['正在深呼吸', '在听大家说什么', '快好了'] },
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
        <div class="ox-loading">
            <span class="ox-loading__breath"><OxIcon name="logo" :size="24" /></span>
            <p class="ox-loading__text" :key="index">{{ text }}</p>
            <p v-if="slow" class="ox-loading__slow">有点慢，再等等 —— 别重复点，一次只会生成一份</p>
        </div>
    `,
};

/** 骨架屏 */
export const OxSkeleton = {
    name: 'OxSkeleton',
    props: { rows: { type: Number, default: 4 } },
    template: `
        <div class="ox-skeleton">
            <div v-for="i in rows" :key="i" class="ox-skeleton__item"></div>
        </div>
    `,
};

/** 表单行 */
export const OxField = {
    name: 'OxField',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
    },
    template: `
        <div class="ox-field">
            <div v-if="label" class="ox-field__head"><span class="ox-field__label">{{ label }}</span></div>
            <slot></slot>
            <p v-if="hint" class="ox-field__hint">{{ hint }}</p>
        </div>
    `,
};

/**
 * 头像：确定性单色槽位 + 首字（黑白气质，认脸靠 slot 不换）。
 * 用户自己的头像若是图片 URL 走 :src 白名单。
 */
export const OxAvatar = {
    name: 'OxAvatar',
    props: {
        name: { type: String, default: '' },
        slot_: { type: Number, default: -1 },
        url: { type: String, default: '' },
        size: { type: Number, default: 34 },
    },
    computed: {
        slotIdx() {
            if (this.slot_ >= 0) return this.slot_ % 8;
            const s = String(this.name || '?');
            let h = 0;
            for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
            return h % 8;
        },
        safeSrc() {
            const u = String(this.url || '').trim();
            return /^(https?:\/\/|data:image\/)/i.test(u) ? u : '';
        },
        style() {
            return { width: `${this.size}px`, height: `${this.size}px` };
        },
        initial() { return (this.name || '?')[0]; },
    },
    template: `
        <span class="ox-avatar" :class="'ox-avatar--p' + slotIdx" :style="style">
            <img v-if="safeSrc" :src="safeSrc" alt="" loading="lazy" />
            <i v-else class="ox-avatar__initial">{{ initial }}</i>
        </span>
    `,
};

/** 数字徽标：99+ 截断展示 */
export const OxCap = {
    name: 'OxCap',
    props: { value: { type: Number, default: 0 } },
    computed: {
        label() { return fmtCap(this.value); },
    },
    template: `<span class="ox-cap">{{ label }}</span>`,
};

/**
 * 标签级 stub 卡 —— 氧气的产品核心。
 * 只显示：发帖人、标签、类型徽标、相对时间、热度。
 * ★ 不渲染 seed / 正文 / 摘要的任何字符（DOM 里不出现正文字段）。
 */
export const OxStubCard = {
    name: 'OxStubCard',
    components: { OxAvatar, OxIcon },
    props: {
        stub: { type: Object, required: true },
    },
    emits: ['open', 'open-author'],
    computed: {
        typeLabel() { return postTypeLabel(this.stub.type); },
        opened() { return store.stubOpened(this.stub.id); },
        heatLabel() { return fmtCount(Math.max(1, (this.stub.heat || 1) * 7)) + ' 人路过'; },
        authorSlot() {
            const a = store.getAuthorById(this.stub.authorId);
            return a ? (a.slot || 0) : -1;
        },
    },
    template: `
        <article class="ox-stub" :class="{ 'is-opened': opened }">
            <button type="button" class="ox-stub__author" @click.stop="$emit('open-author', stub.authorId)">
                <OxAvatar :name="stub.authorName" :slot_="authorSlot" :size="30" />
                <span class="ox-stub__name">{{ stub.authorName }}</span>
                <span class="ox-stub__time">{{ stub.relLabel || '' }}</span>
            </button>
            <button type="button" class="ox-stub__body" @click="$emit('open', stub)">
                <span class="ox-stub__tags">
                    <span v-for="t in stub.tags" :key="t" class="ox-tag ox-tag--big">{{ t }}</span>
                </span>
                <span class="ox-stub__meta">
                    <i class="ox-stub__type">{{ typeLabel }}</i>
                    <i class="ox-stub__heat">{{ heatLabel }}</i>
                    <i v-if="opened" class="ox-stub__read">读过</i>
                    <i v-else class="ox-stub__unread">点开呼吸</i>
                </span>
            </button>
        </article>
    `,
};

/** prompt 分段预览（发送 text 与这里的 parts 来自同一次 compose） */
export const OxPromptParts = {
    name: 'OxPromptParts',
    props: {
        parts: { type: Array, default: () => [] },
        stats: { type: Object, default: () => ({}) },
    },
    template: `
        <div class="ox-ctx">
            <p class="ox-ctx__stat">共 {{ stats.included || 0 }} 段进入发送 · 约 {{ stats.tokens || 0 }} token</p>
            <div v-for="p in parts" :key="p.id" class="ox-ctx__part" :class="{ 'is-off': !p.included }">
                <div class="ox-ctx__main">
                    <span class="ox-ctx__title">{{ p.title }}</span>
                    <span class="ox-ctx__meta">{{ p.source || '本次生成' }} · {{ p.tokens }} token</span>
                </div>
                <span v-if="p.locked" class="ox-ctx__lock">必发</span>
            </div>
        </div>
    `,
};

/** 覆盖页顶栏（返回 + 标题 + 右侧插槽） */
export const OxSubtop = {
    name: 'OxSubtop',
    components: { OxIcon },
    props: { title: { type: String, default: '' } },
    emits: ['back'],
    template: `
        <div class="ox-subtop">
            <button type="button" class="ox-subtop__back" aria-label="返回" @click="$emit('back')"><OxIcon name="back" :size="18" /></button>
            <span class="ox-subtop__title">{{ title }}</span>
            <span class="ox-subtop__spacer"></span>
            <slot></slot>
        </div>
    `,
};

export const UI = {
    OxIcon, OxButton, OxSection, OxEmpty, OxLoading, OxSkeleton,
    OxField, OxAvatar, OxCap, OxStubCard, OxPromptParts, OxSubtop,
};
