/**
 * 声浪 · 通用小组件
 *
 * 图标 / 按钮 / 分区 / 空态 / 加载 / 表单行 / 弹窗壳 / 属性条 / 标签 / 头像 / 帖子卡。
 * 所有页面复用这一份。样式全部走 --ef-* token，禁 emoji。
 */

import { icon } from '../icons.js';
import { stanceLabel } from '../services/forum-engine.js';
import { fmtCap } from '../utils.js';

export const EfIcon = {
    name: 'EfIcon',
    props: {
        name: { type: String, required: true },
        size: { type: Number, default: 18 },
    },
    computed: {
        svg() { return icon(this.name, { size: this.size }); },
    },
    template: `<span class="ef-icon" v-html="svg"></span>`,
};

/** variant = ink（主钮）/ line / soft / ghost / danger / volt */
export const EfBtn = {
    name: 'EfBtn',
    components: { EfIcon },
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
            class="ef-btn"
            :class="['ef-btn--' + variant, 'ef-btn--' + size, { 'is-block': block }]"
            :disabled="disabled || loading"
            @click="$emit('click', $event)"
        >
            <span v-if="loading" class="ef-btn__spin"></span>
            <EfIcon v-else-if="iconName" :name="iconName" :size="size === 'sm' ? 14 : 16" />
            <slot></slot>
        </button>
    `,
};

export const EfSection = {
    name: 'EfSection',
    props: {
        title: { type: String, default: '' },
        sub: { type: String, default: '' },
    },
    template: `
        <section class="ef-section">
            <div v-if="title" class="ef-section__head">
                <h3 class="ef-section__title">{{ title }}</h3>
                <span v-if="sub" class="ef-section__sub">{{ sub }}</span>
                <span class="ef-section__spacer"></span>
                <slot name="action"></slot>
            </div>
            <slot></slot>
        </section>
    `,
};

export const EfEmpty = {
    name: 'EfEmpty',
    components: { EfIcon },
    props: {
        iconName: { type: String, default: 'wave' },
        title: { type: String, default: '这里还是空的' },
        desc: { type: String, default: '' },
    },
    template: `
        <div class="ef-empty">
            <span class="ef-empty__mark"><EfIcon :name="iconName" :size="26" /></span>
            <p class="ef-empty__title">{{ title }}</p>
            <p v-if="desc" class="ef-empty__desc">{{ desc }}</p>
            <div class="ef-empty__slot"><slot></slot></div>
        </div>
    `,
};

export const EfLoading = {
    name: 'EfLoading',
    components: { EfIcon },
    props: {
        lines: { type: Array, default: () => ['灯牌亮起', '解说入席', '快好了'] },
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
        <div class="ef-loading">
            <span class="ef-loading__breath"><EfIcon name="wave" :size="24" /></span>
            <p class="ef-loading__text" :key="index">{{ text }}</p>
            <p v-if="slow" class="ef-loading__slow">有点慢，再等等 —— 别重复点，一次只会生成一份</p>
        </div>
    `,
};

export const EfField = {
    name: 'EfField',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
    },
    template: `
        <div class="ef-field">
            <div v-if="label" class="ef-field__head"><span class="ef-field__label">{{ label }}</span></div>
            <slot></slot>
            <p v-if="hint" class="ef-field__hint">{{ hint }}</p>
        </div>
    `,
};

/** 覆盖全屏的弹窗壳：点遮罩关闭（persistent 时不关） */
export const EfModalShell = {
    name: 'EfModalShell',
    components: { EfIcon },
    props: {
        title: { type: String, default: '' },
        persistent: { type: Boolean, default: false },
        wide: { type: Boolean, default: false },
    },
    emits: ['close'],
    template: `
        <div class="ef-modal" @click.self="persistent ? null : $emit('close')">
            <div class="ef-modal__panel" :class="{ 'is-wide': wide }">
                <div class="ef-modal__head" v-if="title">
                    <span class="ef-modal__title">{{ title }}</span>
                    <button v-if="!persistent" type="button" class="ef-modal__close" @click="$emit('close')">
                        <EfIcon name="close" :size="16" />
                    </button>
                </div>
                <div class="ef-modal__body"><slot></slot></div>
                <div class="ef-modal__foot"><slot name="actions"></slot></div>
            </div>
        </div>
    `,
};

/** 属性进度条（0~100） */
export const EfBar = {
    name: 'EfBar',
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
        <div class="ef-bar" :class="kind ? 'ef-bar--' + kind : ''">
            <div class="ef-bar__meta">
                <span class="ef-bar__label">{{ label }}</span>
                <span class="ef-bar__value">{{ Math.round(value) }}<i>/{{ max }}</i>
                    <em v-if="delta" :class="delta > 0 ? 'is-up' : 'is-down'">{{ delta > 0 ? '+' + delta : delta }}</em>
                </span>
            </div>
            <div class="ef-bar__track"><div class="ef-bar__fill" :style="{ width: pct + '%' }"></div></div>
        </div>
    `,
};

/** 小标签：tone = danger / success / warn / info / violet / plain */
export const EfTag = {
    name: 'EfTag',
    props: {
        tone: { type: String, default: 'plain' },
    },
    template: `<span class="ef-tag" :class="'ef-tag--' + tone"><slot></slot></span>`,
};

/** 头像：名字首字 + 确定性色相 */
export const EfAvatar = {
    name: 'EfAvatar',
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
                background: `hsl(${this.hue}, 30%, 86%)`,
                color: `hsl(${this.hue}, 42%, 30%)`,
                fontSize: `${Math.round(this.size * 0.42)}px`,
            };
        },
        char() { return String(this.name || '?').slice(0, 1); },
    },
    template: `<span class="ef-avatar" :style="style">{{ char }}</span>`,
};

/** 帖子卡（信息流一行） */
export const EfPostCard = {
    name: 'EfPostCard',
    components: { EfTag, EfIcon },
    props: {
        post: { type: Object, required: true },
    },
    emits: ['open'],
    computed: {
        stanceText() { return stanceLabel(this.post.stance); },
        stanceTone() {
            return { fan: 'success', anti: 'danger', analyst: 'info', memer: 'warn', passerby: 'plain' }[this.post.stance] || 'plain';
        },
        kindTag() {
            return {
                official: '官博', match: '赛后', 'rank-watch': '围观', user: '我的帖', ai: '热帖',
            }[this.post.kind] || '';
        },
        commentText() { return fmtCap(this.post.commentTotal || 0, 99); },
    },
    template: `
        <button type="button" class="ef-post" :class="'is-' + (post.kind || 'preset')" @click="$emit('open', post)">
            <div class="ef-post__meta">
                <span class="ef-post__author">{{ post.authorHandle }}</span>
                <EfTag :tone="stanceTone">{{ stanceText }}</EfTag>
                <EfTag v-if="kindTag" tone="violet">{{ kindTag }}</EfTag>
                <span class="ef-post__day">第{{ post.day }}天</span>
            </div>
            <p class="ef-post__title">{{ post.title }}</p>
            <div class="ef-post__stats">
                <span><EfIcon name="heart" :size="12" /> {{ post.likes || 0 }}</span>
                <span><EfIcon name="comment" :size="12" /> {{ commentText }}</span>
            </div>
        </button>
    `,
};

export const UI = {
    EfIcon, EfBtn, EfSection, EfEmpty, EfLoading, EfField, EfModalShell, EfBar, EfTag, EfAvatar, EfPostCard,
};
