/**
 * 手书 · 舞台(文字效果渲染)
 *
 * ── 它做什么 ──────────────────────────────────────────────────────
 *
 * 把 `timeline-engine.renderAt()` 算出来的那一帧画到屏幕上。
 * **一行渲染逻辑都不做决策** —— 此刻有哪些字、挂了哪些效果,
 * 全是引擎算好的;舞台只负责把它变成 DOM。
 *
 * ── 为什么不用 v-html ─────────────────────────────────────────────
 *
 * 逐字动画需要每个字一个 span,最直接的写法是拼 HTML 字符串再 `v-html`。
 * 这里没有这么做:文字**全部来自用户脚本或 AI 输出**,
 * 一旦走 v-html 就必须保证每一处转义都没漏 —— 而漏掉一处不会报错,
 * 只会在某个用户写了 `<b>` 的时候悄悄生效。
 *
 * 改成 `v-for` + 文本插值之后,Vue 自己保证了转义,
 * 这条路径上**物理上不可能**出现注入。代价只是多一层数组,不值一提。
 *
 * ── 效果怎么落 ────────────────────────────────────────────────────
 *
 * 一个元素只能有一份 `animation-name`,所以舞台是三层:
 *
 *   .hs-stage-fx   第一个动效(整行)
 *     .hs-stage-fx2  第二个动效(整行)
 *       .hs-stage-line  静态描画(描边 / 发光 / 叠影)
 *         .hs-ch        逐字动效 + 逐字延迟
 *
 * 详见 `presets/effects.js` 的 `composeEffects`。
 */

import * as store from '../store.js';
import { composeEffects } from '../presets/effects.js';
import { safeColor } from '../utils.js';

export const HsStage = {
    name: 'HsStage',
    props: {
        /** 点舞台切播放/暂停(播放页要,编辑器不要 —— 那里要点选剪辑) */
        tapToPlay: { type: Boolean, default: false },
        /** 编辑器里舞台要小一点,给时间轴让位 */
        compact: { type: Boolean, default: false },
    },
    emits: ['tap'],
    computed: {
        state() { return store.getState(); },
        project() { return store.getProject(); },
        frame() { return store.getFrame(); },
        stage() { return this.project?.stage || {}; },

        /** 当前生效的舞台底:背景轨优先,没有就用企划默认 */
        backdrop() {
            return this.frame.backdrop || this.stage.backdrop || 'ink';
        },

        /** 这一刻生效的全部效果预设 */
        activeEffects() {
            return this.frame.effects
                .map((e) => store.getEffect(e.id))
                .filter(Boolean);
        },

        fx() { return composeEffects(this.activeEffects); },

        /** 剪辑可以覆盖舞台样式(某一句忽然放大) */
        styleOverride() {
            return this.frame.activeClip?.style || null;
        },

        textStyle() {
            const s = this.stage;
            const o = this.styleOverride || {};
            const style = {
                fontSize: `${o.fontSize || s.fontSize || 34}px`,
                fontWeight: String(s.fontWeight || 600),
                letterSpacing: `${o.letterSpacing != null ? o.letterSpacing : (s.letterSpacing || 0)}px`,
                lineHeight: String(s.lineHeight || 1.5),
                textAlign: o.align || s.align || 'center',
            };
            const color = safeColor(o.color || s.color);
            if (color) style.color = color;
            return { ...style, ...this.fx.paintVars };
        },

        alignClass() {
            return `hs-stage--${this.styleOverride?.position || this.stage.position || 'center'}`;
        },

        /**
         * 把文字切成「行 → 字」。
         *
         * 空格单独标出来:`white-space: pre` 在 inline-block 的 span 上表现
         * 不稳定,给它一个类由 CSS 撑宽度更可靠。
         */
        lines() {
            const text = this.frame.text || '';
            const out = [];
            let index = 0;
            for (const raw of text.split('\n')) {
                const chars = [];
                for (const ch of raw) {
                    chars.push({
                        ch,
                        key: index,
                        space: ch === ' ' || ch === '\u3000',
                        // 「刚打出来的字」才吃逐字动画,老字不该每帧重播一遍
                        fresh: index >= this.frame.typedFrom,
                        delayIndex: Math.max(0, index - this.frame.typedFrom),
                    });
                    index += 1;
                }
                out.push({ key: out.length, chars });
            }
            return out;
        },

        showCaret() {
            if (this.stage.caret === false) return false;
            return this.frame.typing || this.state.playing;
        },

        empty() {
            return !this.frame.text && !this.state.playing;
        },
    },
    methods: {
        charClass(char) {
            if (!this.fx.charLayer) return null;
            return char.fresh ? this.fx.charLayer.classes : null;
        },
        charStyle(char) {
            if (!this.fx.charLayer || !char.fresh) return null;
            return { ...this.fx.charLayer.vars, '--hs-fx-i': String(char.delayIndex) };
        },
        onTap() {
            if (!this.tapToPlay) return;
            this.$emit('tap');
        },
    },
    template: `
        <div
            class="hs-stage"
            :class="[alignClass, { 'is-compact': compact, 'is-tappable': tapToPlay }]"
            :data-backdrop="backdrop"
            @click="onTap"
        >
            <div class="hs-stage-vignette" aria-hidden="true"></div>

            <div class="hs-stage-inner">
                <div
                    class="hs-stage-fx"
                    :class="fx.wrapLayers[0] ? fx.wrapLayers[0].classes : null"
                    :style="fx.wrapLayers[0] ? fx.wrapLayers[0].vars : null"
                >
                    <div
                        class="hs-stage-fx2"
                        :class="fx.wrapLayers[1] ? fx.wrapLayers[1].classes : null"
                        :style="fx.wrapLayers[1] ? fx.wrapLayers[1].vars : null"
                    >
                        <div class="hs-stage-line" :class="fx.paintClasses" :style="textStyle">
                            <div v-for="line in lines" :key="line.key" class="hs-stage-row">
                                <span
                                    v-for="ch in line.chars"
                                    :key="ch.key"
                                    class="hs-ch"
                                    :class="[charClass(ch), { 'is-space': ch.space }]"
                                    :style="charStyle(ch)"
                                >{{ ch.ch }}</span><i
                                    v-if="showCaret && line.key === lines.length - 1"
                                    class="hs-caret"
                                    aria-hidden="true"
                                ></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <p v-if="empty" class="hs-stage-hint">这一刻屏幕上还没有字</p>
        </div>
    `,
};

export default HsStage;
