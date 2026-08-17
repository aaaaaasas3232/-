/**
 * 梦境编织 · 齿轮滑动选择器
 *
 * 顶部工具栏中间那两个「上下滑动切换」的控件(章节 / 故事时间)。
 * 原版 `bindChapterSelectorEvents`(11810)和 `bindTimelineSelectorEvents`(12040)
 * 是**两份一模一样的代码**,只有「切换目标」不同 —— 这里抽成一个组件,参数化那一处差别。
 *
 * ── 手感是照抄的,数值一个都没改 ──────────────────────────────────
 *
 *   拖动跟随    translateY(clamp(ΔY × 0.4, ±20))   阻尼 0.4,上限 20px
 *   齿轮阈值    每相对 lastTickY 移动 35px 触发一次切换
 *   触感        每次咔哒 vibrate(8),单次滑动 vibrate(12)
 *   弹回        transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)
 *   滚轮        累积 |deltaY| >= 30 触发一次,150ms 无新滚轮清零
 *   方向        上滑 / 滚轮向下 = next;下滑 / 滚轮向上 = prev
 *   点击        滑动后 100ms 内吞掉,否则打开对应弹窗
 *
 * ── 相对原版的两处调整(都是为了让手感真的生效)────────────────────
 *
 * 1. **`touch-action: none` 而不是原版的 `pan-y`。**
 *    `pan-y` 表示「允许浏览器纵向滚动」,一旦浏览器认定这是滚动手势就会接管,
 *    后面的 `preventDefault()` 直接失效 —— 手感时灵时不灵。这个控件的纵向手势
 *    100% 是自己的,声明 `none` 才能保证每次都跟手。
 *
 * 2. **补了鼠标拖拽。** 原版只有 touch + wheel,在桌面浏览器上 touch 事件根本不触发,
 *    只能滚滚轮。补一套 pointer 事件走同一条逻辑,桌面上也能拖出齿轮感。
 */

const TICK_THRESHOLD = 35;      // 每滑多少 px 咔哒一次
const MAX_OFFSET = 20;          // 内容跟手位移上限
const DAMPING = 0.4;            // 跟手阻尼
const WHEEL_THRESHOLD = 30;     // 滚轮累积阈值
const WHEEL_RESET_MS = 150;     // 多久没新滚轮就清零累积
const TICK_ANIM_MS = 250;       // tick-up / tick-down 动画时长
const SPRING = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';

function buzz(ms) {
    try { window.navigator?.vibrate?.(ms); } catch (_) { /* 不支持就算了 */ }
}

export const DwSwipeSelector = {
    name: 'DwSwipeSelector',
    props: {
        /** 'chapter' | 'timeline' —— 只影响配色(focused 时的边框色) */
        kind: { type: String, default: 'chapter' },
        /** 上面那行小字 */
        label: { type: String, default: '' },
        /** 下面那行主文字 */
        value: { type: String, default: '' },
        /** 附加到根节点的 data-* (原版章节选择器带 volume/chapter index) */
        dataset: { type: Object, default: () => ({}) },
    },
    emits: ['next', 'prev', 'tap'],
    data() {
        return {
            scrolling: false,   // 拖动中 —— 关掉 transition + 显示刻度线
            tick: '',           // '' | 'up' | 'down'
            offset: 0,          // 内容跟手位移
            focused: false,     // 点击后高亮(原版是 toggle)
        };
    },
    computed: {
        rootClass() {
            return [
                this.kind === 'timeline' ? 'dw-timeline-selector' : 'dw-chapter-selector',
                'dw-selector-swipe',
                {
                    scrolling: this.scrolling,
                    focused: this.focused,
                    'tick-up': this.tick === 'up',
                    'tick-down': this.tick === 'down',
                },
            ];
        },
        contentStyle() {
            // 拖动中直接写 transform,松手时由 spring 过渡回 0
            return {
                transform: `translateY(${this.offset}px)`,
                transition: this.scrolling ? 'none' : SPRING,
            };
        },
    },
    methods: {
        // ── 一次咔哒 ──────────────────────────
        fire(direction, { animate = false, strength = 8 } = {}) {
            buzz(strength);
            if (animate) this.playTick(direction === 'next' ? 'up' : 'down');
            this.$emit(direction);
        },

        playTick(name) {
            // 先清掉再设,否则连续两次同方向不会重放动画
            this.tick = '';
            if (this._tickTimer) clearTimeout(this._tickTimer);
            this.$nextTick(() => {
                this.tick = name;
                this._tickTimer = setTimeout(() => {
                    this.tick = '';
                    this._tickTimer = null;
                }, TICK_ANIM_MS + 50);
            });
        },

        // ── 拖动(touch / mouse 共用)──────────
        dragStart(clientY, clientX) {
            this._startY = clientY;
            this._startX = clientX;
            this._lastTickY = clientY;
            this._swiped = false;
            this.scrolling = true;
            this.offset = 0;
        },

        dragMove(clientY, clientX, event) {
            if (!this.scrolling) return;
            const deltaY = clientY - this._startY;
            const deltaX = clientX - this._startX;

            // 只认纵向手势:纵向位移要同时大于横向位移和 10px
            if (Math.abs(deltaY) <= Math.abs(deltaX) || Math.abs(deltaY) <= 10) return;

            this._swiped = true;
            event?.preventDefault?.();

            this.offset = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, deltaY * DAMPING));

            // 齿轮刻度:相对上一次咔哒的位置算,所以一次长滑会连续咔哒好几下
            const tickDelta = clientY - this._lastTickY;
            if (Math.abs(tickDelta) >= TICK_THRESHOLD) {
                this.fire(tickDelta < 0 ? 'next' : 'prev', { strength: 8 });
                this._lastTickY = clientY;
            }
        },

        dragEnd(clientY) {
            if (!this.scrolling) return;
            this.scrolling = false;
            this.offset = 0;   // 触发 spring 弹回

            /**
             * 原版这里还有一段「没触发过刻度就按总位移判断一次」的兜底,
             * 但它的条件是 `!isSwiping && |ΔY| > 30` —— 而 `isSwiping` 在 move 里
             * 只要竖滑超过 10px 就被置 true,所以 **|ΔY| > 30 时 isSwiping 必然已经是 true**,
             * 这个分支实际上永远进不去(死代码)。
             *
             * 这里保留它的**意图**:一次干脆的短滑(30~35px,还没够一格阈值)也应该切一格,
             * 否则用户会觉得「滑了但没反应」。判据改成「这次拖动一格都没咔哒过」。
             */
            const deltaY = clientY - this._startY;
            if (!this._ticked && Math.abs(deltaY) > 30) {
                this.fire(deltaY < 0 ? 'next' : 'prev', { animate: true, strength: 12 });
            }

            /**
             * 只有**真的滑过**才吞掉紧随其后的 click。
             *
             * ★ 这里踩过一次:一开始无条件吞,结果连普通点击都打不开弹窗 ——
             *   因为浏览器的事件顺序是 mousedown → mouseup → click,
             *   而 dragEnd 挂在 mouseup 上,等 click 到达时"吞掉"的标记已经立好了。
             *   原版没这个问题是因为它只有 touch、且那个标记只在滑动分支里才置位。
             */
            if (this._swiped) {
                this._swallowClick = true;
                if (this._clickTimer) clearTimeout(this._clickTimer);
                this._clickTimer = setTimeout(() => { this._swallowClick = false; this._clickTimer = null; }, 100);
            }
        },

        // ── touch ─────────────────────────────
        onTouchStart(e) {
            this._ticked = false;
            const t = e.touches[0];
            this.dragStart(t.clientY, t.clientX);
        },
        onTouchMove(e) {
            const before = this._lastTickY;
            const t = e.touches[0];
            this.dragMove(t.clientY, t.clientX, e);
            if (this._lastTickY !== before) this._ticked = true;
        },
        onTouchEnd(e) {
            this.dragEnd(e.changedTouches[0].clientY);
        },

        // ── mouse(原版没有,桌面上没它就只能滚滚轮)──
        onMouseDown(e) {
            if (e.button !== 0) return;
            this._ticked = false;
            this.dragStart(e.clientY, e.clientX);
            this._onMouseMove = (ev) => {
                const before = this._lastTickY;
                this.dragMove(ev.clientY, ev.clientX, ev);
                if (this._lastTickY !== before) this._ticked = true;
            };
            this._onMouseUp = (ev) => {
                this.dragEnd(ev.clientY);
                window.removeEventListener('mousemove', this._onMouseMove);
                window.removeEventListener('mouseup', this._onMouseUp);
            };
            window.addEventListener('mousemove', this._onMouseMove);
            window.addEventListener('mouseup', this._onMouseUp);
        },

        // ── wheel ─────────────────────────────
        onWheel(e) {
            e.preventDefault();
            this._wheelAccum = (this._wheelAccum || 0) + e.deltaY;
            if (this._wheelTimer) clearTimeout(this._wheelTimer);

            if (Math.abs(this._wheelAccum) >= WHEEL_THRESHOLD) {
                // 滚轮向下(deltaY > 0)= next,和「上滑 = next」是同一个心智模型
                this.fire(this._wheelAccum > 0 ? 'next' : 'prev', { animate: true, strength: 8 });
                this._wheelAccum = 0;
            }

            this._wheelTimer = setTimeout(() => { this._wheelAccum = 0; this._wheelTimer = null; }, WHEEL_RESET_MS);
        },

        onClick() {
            if (this._swallowClick) return;
            this.focused = !this.focused;
            this.$emit('tap');
        },
    },
    beforeUnmount() {
        if (this._tickTimer) clearTimeout(this._tickTimer);
        if (this._wheelTimer) clearTimeout(this._wheelTimer);
        if (this._clickTimer) clearTimeout(this._clickTimer);
        if (this._onMouseMove) window.removeEventListener('mousemove', this._onMouseMove);
        if (this._onMouseUp) window.removeEventListener('mouseup', this._onMouseUp);
    },
    template: `
        <div
            :class="rootClass"
            v-bind="dataset"
            @click="onClick"
            @touchstart="onTouchStart"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
            @touchcancel="onTouchEnd"
            @mousedown="onMouseDown"
            @wheel="onWheel"
        >
            <div class="dw-selector-content" :style="contentStyle">
                <div :class="kind === 'timeline' ? 'dw-timeline-label' : 'dw-chapter-volume'">{{ label }}</div>
                <div :class="kind === 'timeline' ? 'dw-timeline-date-display' : 'dw-chapter-number'">{{ value }}</div>
            </div>
        </div>
    `,
};

export default DwSwipeSelector;
