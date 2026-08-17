/**
 * BubbleView —— 框架级「按配置画一个聊天气泡」组件
 *
 * ★ 为什么在 src/core
 *   气泡机(编辑时预览)和情景聊天(渲染每条消息)画的是**同一个东西**。
 *   各写一份的话,编辑器里调好的样子搬到聊天里总会差一点,而且两边都不报错。
 *   判据见 `docs/framework-总览.md` §7:「改一次要改几个地方」。
 *
 * ★ 它只负责气泡本体
 *   头像、名字、时间戳**不在这里** —— 那些是「一条消息」的组成部分,
 *   属于情景聊天的排版设定,不属于气泡样式。参考软件把时间戳和头像做进了
 *   气泡编辑器,结果是同一套气泡换个 App 就用不了。
 *
 * 用法:
 *   import { BubbleView } from '@/src/core/components/bubble-view.js';
 *   <BubbleView :config="cfg" :shapes="svgLibrary" text="你好" />
 *   <BubbleView :config="cfg"><em>自定义内容</em></BubbleView>
 *
 * 样式基线在 `css/core/88-bubble-view.css`(裸 class,低优先级),
 * 各 App 用 `.app-shell[data-app-id="xxx"] .bubble-view` 覆盖细节。
 */

import { createBubbleConfig, bubbleBoxStyle, bubbleTextStyle, tailStyle, tailStrokeSvg, tailFillSvg } from '../bubble-style.js';

export const BubbleView = {
    name: 'BubbleView',
    props: {
        /** 气泡配置(`createBubbleConfig` 的产物) */
        config: { type: Object, required: true },
        /** SVG 形状库,尾巴引用 shapeId 时从这里找 */
        shapes: { type: Array, default: () => [] },
        /** 正文。给了 slot 就用 slot */
        text: { type: String, default: '' },
        /** 选中态(编辑器里用) */
        selected: { type: Boolean, default: false },
        /** 高亮某一条尾巴(编辑器里用) */
        highlightTail: { type: String, default: '' },
    },
    computed: {
        cfg() {
            // ★ 一律过一遍归一化:上游可能是 IndexedDB 读出来的旧结构,
            //   少一个字段就会让 `bubbleTextStyle` 拼出 `padding: undefinedpx`,
            //   浏览器丢掉整条声明,表现是「这个气泡没有内边距」且不报错
            return createBubbleConfig(this.config || {});
        },
        boxStyle() { return bubbleBoxStyle(this.cfg); },
        textStyle() { return bubbleTextStyle(this.cfg); },
        visibleTails() {
            return (Array.isArray(this.cfg.tails) ? this.cfg.tails : []).filter((t) => t.enabled);
        },
    },
    methods: {
        styleOf(tail) { return tailStyle(tail, this.cfg); },
        strokeStyleOf(tail) {
            // 描边层:用 strokeColor(默认 #BCBCBC 灰、iOS 经典)。
            const s = tailStyle(tail, this.cfg);
            s.color = tail.strokeColor || s.color;
            return s;
        },
        fillStyleOf(tail) {
            // 填充层:用 tail.color 或气泡底色。描边设 none,避免填充层也画出描边。
            const s = tailStyle(tail, this.cfg);
            // tailStyle 已经把 s.color 设为 tail.color 或气泡底色
            return s;
        },
        strokeOf(tail) { return tailStrokeSvg(tail, this.shapes); },
        fillOf(tail) { return tailFillSvg(tail, this.shapes); },
        isHot(tail) { return this.highlightTail && String(this.highlightTail) === String(tail.id); },
    },
    template: `
        <div class="bubble-view" :class="['is-' + cfg.side, { 'is-selected': selected }]">
            <div class="bubble-view-box" :style="boxStyle">
                <span
                    v-for="tail in visibleTails"
                    :key="'s-' + tail.id"
                    class="bubble-view-tail is-stroke"
                    :class="{ 'is-hot': isHot(tail) }"
                    :style="strokeStyleOf(tail)"
                    aria-hidden="true"
                    v-html="strokeOf(tail)"
                ></span>
                <span class="bubble-view-text" :style="textStyle"><slot>{{ text }}</slot></span>
                <span
                    v-for="tail in visibleTails"
                    :key="'f-' + tail.id"
                    class="bubble-view-tail is-fill"
                    :class="{ 'is-hot': isHot(tail) }"
                    :style="fillStyleOf(tail)"
                    aria-hidden="true"
                    v-html="fillOf(tail)"
                ></span>
            </div>
        </div>
    `,
};

export default BubbleView;
