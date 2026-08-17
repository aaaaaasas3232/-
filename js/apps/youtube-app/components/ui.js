/**
 * 萤火 · 通用小组件
 *
 * 按钮 / 分区 / 空态 / 加载 / 骨架 / 表单行 / 头像 / 封面 / 视频卡 /
 * 数字 / prompt 预览 —— 所有页面复用这一份，不许各页自己拼一遍。
 * 样式全部走 --yt-* token。
 */

import { icon } from '../icons.js';
import * as store from '../store.js';
import { fmtCap, fmtCount } from '../services/stats.js';

/** 图标（v-html 一层薄壳；name 是 icons.js 里的键，开发者受信任内容） */
export const YtIcon = {
    name: 'YtIcon',
    props: {
        name: { type: String, required: true },
        size: { type: Number, default: 18 },
    },
    computed: {
        svg() { return icon(this.name, { size: this.size }); },
    },
    template: `<span class="yt-icon" v-html="svg"></span>`,
};

/** 按钮：variant = primary / soft / line / ghost / danger */
export const YtButton = {
    name: 'YtButton',
    components: { YtIcon },
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
            class="yt-btn"
            :class="['yt-btn--' + variant, 'yt-btn--' + size, { 'is-block': block }]"
            :disabled="disabled || loading"
            @click="$emit('click', $event)"
        >
            <span v-if="loading" class="yt-btn__spin"></span>
            <YtIcon v-else-if="iconName" :name="iconName" :size="size === 'sm' ? 14 : 16" />
            <slot></slot>
        </button>
    `,
};

/** 分区标题 + 内容 */
export const YtSection = {
    name: 'YtSection',
    props: {
        title: { type: String, default: '' },
        sub: { type: String, default: '' },
    },
    template: `
        <section class="yt-section">
            <div v-if="title" class="yt-section__head">
                <h3 class="yt-section__title">{{ title }}</h3>
                <span v-if="sub" class="yt-section__sub">{{ sub }}</span>
                <span class="yt-section__spacer"></span>
                <slot name="action"></slot>
            </div>
            <slot></slot>
        </section>
    `,
};

/** 空态 */
export const YtEmpty = {
    name: 'YtEmpty',
    components: { YtIcon },
    props: {
        iconName: { type: String, default: 'spark' },
        title: { type: String, default: '这里还是空的' },
        desc: { type: String, default: '' },
    },
    template: `
        <div class="yt-empty">
            <span class="yt-empty__mark"><YtIcon :name="iconName" :size="26" /></span>
            <p class="yt-empty__title">{{ title }}</p>
            <p v-if="desc" class="yt-empty__desc">{{ desc }}</p>
            <div class="yt-empty__slot"><slot></slot></div>
        </div>
    `,
};

/**
 * 加载动画：一枚萤火在虚线上明暗浮动。
 * 文案每 2.4s 换一句；超过 12s 补一句「有点慢」挡住重复点击。
 */
export const YtLoading = {
    name: 'YtLoading',
    components: { YtIcon },
    props: {
        lines: { type: Array, default: () => ['正在打捞新视频', '在看大家发了什么', '快好了'] },
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
        <div class="yt-loading">
            <div class="yt-loading__stage">
                <span class="yt-loading__trail"></span>
                <span class="yt-loading__bug"><YtIcon name="spark" :size="22" /></span>
            </div>
            <p class="yt-loading__text" :key="index">{{ text }}</p>
            <p v-if="slow" class="yt-loading__slow">有点慢，再等等 —— 别重复点，一次只会生成一份</p>
        </div>
    `,
};

/** 骨架屏（首屏 hydrate 用） */
export const YtSkeleton = {
    name: 'YtSkeleton',
    props: { rows: { type: Number, default: 4 } },
    template: `
        <div class="yt-skeleton">
            <div v-for="i in rows" :key="i" class="yt-skeleton__item"></div>
        </div>
    `,
};

/** 表单行 */
export const YtField = {
    name: 'YtField',
    props: {
        label: { type: String, default: '' },
        hint: { type: String, default: '' },
    },
    template: `
        <div class="yt-field">
            <div v-if="label" class="yt-field__head"><span class="yt-field__label">{{ label }}</span></div>
            <slot></slot>
            <p v-if="hint" class="yt-field__hint">{{ hint }}</p>
        </div>
    `,
};

/**
 * 站内用户头像。
 * 传 creator 记录：图库映射的头像（异步灌进 store.avatarSrc，reactive 自动重画）
 * → AI 用人设头像 → 都没有就确定性色块 + 首字。
 * URL 走 :src 绑定（不走 v-html），再叠协议白名单。
 */
export const YtAvatar = {
    name: 'YtAvatar',
    props: {
        creator: { type: Object, default: null },
        /** 没有 creator 记录时的兜底（用户自己 / 私信发件人） */
        name: { type: String, default: '' },
        url: { type: String, default: '' },
        size: { type: Number, default: 34 },
        live: { type: Boolean, default: false },
    },
    computed: {
        info() {
            if (this.creator) return store.avatarInfo(this.creator);
            return { src: this.url || '', slot: (this.name || '?').charCodeAt(0) % 8, initial: (this.name || '?')[0] };
        },
        safeSrc() {
            const u = String(this.info.src || '').trim();
            return /^(https?:\/\/|data:image\/)/i.test(u) ? u : '';
        },
        style() {
            const s = { width: `${this.size}px`, height: `${this.size}px` };
            if (!this.safeSrc && this.info.bg) s.background = this.info.bg;
            return s;
        },
    },
    template: `
        <span class="yt-avatar" :class="['yt-avatar--p' + (info.slot || 0), { 'is-live': live }]" :style="style">
            <img v-if="safeSrc" :src="safeSrc" alt="" loading="lazy" />
            <i v-else class="yt-avatar__initial">{{ info.initial }}</i>
            <i v-if="live" class="yt-avatar__livedot"></i>
        </span>
    `,
};

/**
 * 文字模拟封面（视频没有真实画面，封面 = 色块 + 大字 + 时长角标）。
 * hue 0~7 对应 CSS 的 --yt-cover-N。
 */
export const YtCover = {
    name: 'YtCover',
    components: { YtIcon },
    props: {
        text: { type: String, default: '' },
        hue: { type: Number, default: 0 },
        duration: { type: String, default: '' },
        live: { type: Boolean, default: false },
        small: { type: Boolean, default: false },
    },
    computed: {
        slot() { return ((Number(this.hue) % 8) + 8) % 8; },
    },
    template: `
        <div class="yt-cover" :class="['yt-cover--h' + slot, { 'is-small': small }]">
            <span class="yt-cover__text">{{ text || '视频' }}</span>
            <span class="yt-cover__play"><YtIcon name="play" :size="small ? 12 : 16" /></span>
            <span v-if="live" class="yt-cover__live"><i></i>直播中</span>
            <span v-else-if="duration" class="yt-cover__duration">{{ duration }}</span>
        </div>
    `,
};

/**
 * 视频卡（列表 / 主页作品 / 收藏通用）。
 * 点封面 → open；点头像 / 名字 → open-creator（作者页懒生成的入口就在这）。
 */
export const YtVideoCard = {
    name: 'YtVideoCard',
    components: { YtCover, YtAvatar, YtIcon },
    props: {
        video: { type: Object, required: true },
        /** 显示作者行（作品页里自己的列表不用显示） */
        showAuthor: { type: Boolean, default: true },
        dense: { type: Boolean, default: false },
    },
    emits: ['open', 'open-creator'],
    computed: {
        creator() { return store.getCreatorById(this.video.creatorId || this.video.ownerCreatorId); },
        authorName() { return this.video.creatorName || this.video.ownerName || ''; },
        viewsLabel() {
            const views = this.video.ownerType ? (this.video.stats?.views || 0) : (this.video.views || 0);
            return fmtCount(views) + ' 次观看';
        },
        metaLabel() {
            const bits = [this.viewsLabel];
            if (this.video.publishedLabel) bits.push(this.video.publishedLabel);
            else if (this.video.publishedAt) bits.push('已发布');
            return bits.join(' · ');
        },
        isLive() { return this.creator ? store.creatorIsLive(this.creator) : false; },
    },
    template: `
        <article class="yt-vcard" :class="{ 'is-dense': dense }">
            <button type="button" class="yt-vcard__coverbtn" @click="$emit('open', video)">
                <YtCover :text="video.coverText" :hue="video.coverHue" :duration="video.durationLabel" :small="dense" />
            </button>
            <div class="yt-vcard__body">
                <button type="button" class="yt-vcard__title" @click="$emit('open', video)">{{ video.title }}</button>
                <div class="yt-vcard__meta">
                    <button
                        v-if="showAuthor && creator" type="button" class="yt-vcard__author"
                        @click="$emit('open-creator', creator.creatorId)"
                    >
                        <YtAvatar :creator="creator" :size="20" :live="isLive" />
                        <span>{{ authorName }}</span>
                    </button>
                    <span v-else-if="showAuthor && authorName" class="yt-vcard__author is-plain">{{ authorName }}</span>
                    <span class="yt-vcard__stats">{{ metaLabel }}</span>
                </div>
                <div v-if="video.tags && video.tags.length" class="yt-vcard__tags">
                    <span v-for="t in video.tags" :key="t" class="yt-tag">{{ t }}</span>
                </div>
            </div>
        </article>
    `,
};

/** 数字徽标：99+ 截断展示 */
export const YtCap = {
    name: 'YtCap',
    props: { value: { type: Number, default: 0 } },
    computed: {
        label() { return fmtCap(this.value); },
    },
    template: `<span class="yt-cap">{{ label }}</span>`,
};

/** prompt 分段预览（发送 text 与这里的 parts 来自同一次 compose） */
export const YtPromptParts = {
    name: 'YtPromptParts',
    props: {
        parts: { type: Array, default: () => [] },
        stats: { type: Object, default: () => ({}) },
    },
    template: `
        <div class="yt-ctx">
            <p class="yt-ctx__stat">共 {{ stats.included || 0 }} 段进入发送 · 约 {{ stats.tokens || 0 }} token</p>
            <div v-for="p in parts" :key="p.id" class="yt-ctx__part" :class="{ 'is-off': !p.included }">
                <div class="yt-ctx__main">
                    <span class="yt-ctx__title">{{ p.title }}</span>
                    <span class="yt-ctx__meta">{{ p.source || '本次生成' }} · {{ p.tokens }} token</span>
                </div>
                <span v-if="p.locked" class="yt-ctx__lock">必发</span>
            </div>
        </div>
    `,
};

export const UI = {
    YtIcon, YtButton, YtSection, YtEmpty, YtLoading, YtSkeleton,
    YtField, YtAvatar, YtCover, YtVideoCard, YtCap, YtPromptParts,
};
