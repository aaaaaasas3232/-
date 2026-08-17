/**
 * 小奇怪 · 小浮窗（工具弹层）
 *
 * ── 三代变迁 ──────────────────────────────────────────────────────
 *
 *   一代  每页底部一条常驻工具条。和自绘底栏叠在一起,谁都点不准。
 *   二代  底部半屏抽屉。不占位了,但一开就吃掉大半个屏幕 ——
 *         用户原话:「不要这种半屏弹窗 就是小型弹窗」。
 *   三代  就是现在这个:一张从顶部那条细浮条底下落出来的小卡片。
 *
 * ── 三代为什么这么定 ──────────────────────────────────────────────
 *
 * 1. **从哪儿点的就从哪儿出来**。触发键在顶部的浮条上,卡片就落在浮条正下方,
 *    宽度只有内容区的一小截。视线不用跳,底下的内容也基本没被盖住。
 *    落点由 `--oq-pop-top` 决定 —— 根组件在开的那一刻量了触发键的位置写进去,
 *    不是拍脑袋写死的偏移量(「捏」页顶栏和「看」页细浮条高度差一大截)。
 *
 * 2. **必须 Teleport 到 `.oq-root`**。这些卡片写在各个 view 的模板里,而 view
 *    住在 `.oq-stage` 里 —— 那是个 `overflow-y: auto` 的滚动容器,
 *    绝对定位的子元素会跟着内容一起卷走。用户在匿名页往下翻两屏再点工具键,
 *    卡片会开在看不见的地方,而且一行报错都没有。
 *    挪到 `.oq-root`(`position:absolute; inset:0`,不滚)下面就不存在这回事。
 *    顺带还解决了另一个坑:果冻心和沙漏的根节点挂着 `touch-action: none`,
 *    卡片留在里面的话,里面的长列表在手机上一动不动。
 *
 * ── 和 OqModal 的分工 ─────────────────────────────────────────────
 *
 *   OqModal  居中大卡片。用于「打断你,必须回答一句」的确认。
 *   OqPanel  顶部落下的小卡片。用于「随手调一下」的工具。
 *
 * ★ z-index 必须 < 6 —— `.app-bottom`(home 指示条)是 6,盖住就退不出 App
 *   (AGENTS.md §5)。这里用 5,写在 index.css。
 */

export const OqPanel = {
    name: 'OqPanel',
    props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        /** 列表型内容(草稿箱、人设、问题列表)放开正文高度上限 */
        tall: { type: Boolean, default: false },
        /** 落在深色底(沙漏翻转态)上时换一套皮 */
        dark: { type: Boolean, default: false },
    },
    emits: ['close'],
    data() {
        return { closing: false };
    },
    mounted() {
        this._esc = (e) => { if (e.key === 'Escape') this.requestClose(); };
        document.addEventListener('keydown', this._esc);
    },
    beforeUnmount() {
        document.removeEventListener('keydown', this._esc);
        if (this._timer) clearTimeout(this._timer);
    },
    methods: {
        requestClose() {
            if (this.closing) return;
            this.closing = true;
            // 等收起动画跑完再真正卸载,否则卡片是「瞬间消失」而不是「收回去」
            this._timer = setTimeout(() => {
                this._timer = null;
                this.$emit('close');
            }, 180);
        },
        onScrim(event) {
            if (event.target === event.currentTarget) this.requestClose();
        },
    },
    template: `
        <Teleport to=".oq-root">
            <div
                class="oq-pop-layer"
                :class="{ 'is-closing': closing, 'is-dark': dark }"
                @click="onScrim"
            >
                <section class="oq-pop" :class="{ 'is-tall': tall }" role="dialog" aria-modal="true">
                    <header v-if="title || subtitle || $slots.head" class="oq-pop-head">
                        <slot name="head">
                            <span class="oq-pop-title">{{ title }}</span>
                            <span v-if="subtitle" class="oq-pop-sub">{{ subtitle }}</span>
                        </slot>
                    </header>
                    <div class="oq-pop-body"><slot></slot></div>
                    <footer v-if="$slots.foot" class="oq-pop-foot"><slot name="foot"></slot></footer>
                </section>
            </div>
        </Teleport>
    `,
};

export default OqPanel;
