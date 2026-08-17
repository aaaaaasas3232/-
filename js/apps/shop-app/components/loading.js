/**
 * 四叶草 · 加载动画
 *
 * 点进一件商品要等 AI 现生成详情，这几秒必须有东西看。
 *
 * ── 为什么是这个形态 ──────────────────────────────────────────────
 *
 * 转圈的问题是它只说「在忙」，不说「在忙什么」，也不说「还要多久」。
 * 这里做三件事：
 *   1. 四叶草的四瓣**依次亮起**，转一圈约 1.6 秒 —— 用户能数圈，
 *      于是「等了多久」是可感知的，比一个匀速转圈耐等得多
 *   2. 文案按种类换（翻货架 / 打听这家店 / 灯光暗下来了），
 *      而且**每 2.4 秒换一句**，让人知道它还活着
 *   3. 超过 12 秒补一句「有点慢，再等等」—— 不改变任何行为，
 *      只是承认「是的这次比较久」，而这一句能挡掉大半的重复点击
 *
 * 动画全用 CSS，JS 只负责换文案。组件卸载时清定时器。
 */

import { LOADING_LINES } from '../constants.js';
import { CLOVER_PATH } from '../icons.js';

export const SpLoading = {
    name: 'SpLoading',
    props: {
        /** product | store | detail | theater | summary */
        kind: { type: String, default: 'detail' },
        /** 覆盖内置文案 */
        label: { type: String, default: '' },
        size: { type: String, default: 'md' },   // sm | md | lg
    },
    data() {
        return { tick: 0, elapsed: 0 };
    },
    computed: {
        lines() {
            return LOADING_LINES[this.kind] || LOADING_LINES.detail;
        },
        text() {
            if (this.label) return this.label;
            return this.lines[this.tick % this.lines.length];
        },
        slow() { return this.elapsed >= 12; },
        cloverSvg() {
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${CLOVER_PATH}</svg>`;
        },
    },
    mounted() {
        this._lineTimer = setInterval(() => { this.tick += 1; }, 2400);
        this._clock = setInterval(() => { this.elapsed += 1; }, 1000);
    },
    beforeUnmount() {
        // ★ 不清的话组件卸载后定时器还在跑，对着已销毁的实例改 data
        clearInterval(this._lineTimer);
        clearInterval(this._clock);
    },
    template: `
        <div class="sp-loading" :class="'sp-loading--' + size">
            <div class="sp-loading__clover">
                <span class="sp-loading__leaf" v-for="n in 4" :key="n" :style="{ '--i': n - 1 }"></span>
                <span class="sp-loading__mark" v-html="cloverSvg"></span>
            </div>
            <p class="sp-loading__text">{{ text }}</p>
            <p v-if="slow" class="sp-loading__slow">有点慢，再等等</p>
        </div>
    `,
};

/** 铺满整块内容区的加载态（详情页、小剧场页用） */
export const SpLoadingScreen = {
    name: 'SpLoadingScreen',
    components: { SpLoading },
    props: {
        kind: { type: String, default: 'detail' },
        label: { type: String, default: '' },
    },
    template: `
        <div class="sp-loading-screen">
            <sp-loading :kind="kind" :label="label" size="lg" />
        </div>
    `,
};
