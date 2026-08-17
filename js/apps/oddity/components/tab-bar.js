/**
 * 小奇怪 · 自绘底栏
 *
 * 框架的 tab 栏被关掉了(`nav: { type:'none' }`),这一条是自己画的。
 *
 * 视觉:四个按钮沉在底部,只露一个小点和文字;激活的那个整体上浮,
 * 把一颗嵌了汉字的圆球托到栏上方。曲线用弹性 cubic-bezier,
 * 允许打断 —— 连点两下时旧球立刻退场,不等上一段动画跑完(手感更跟手)。
 *
 * ★ 层级:tabbar 是 z-index 4。
 *   `.app-bottom`(home 指示条)是 6,App 内所有层必须 < 6,
 *   否则指示条被盖住就退不出 App(AGENTS.md §5 / §10)。
 *
 * ★ 汉字不是 emoji。用户明确要求全站不出现 emoji,
 *   所以「玩 / 捏 / 看 / 字」这四个字就是图标本身。
 */

export const OqTabBar = {
    name: 'OqTabBar',
    props: {
        // [{ id, glyph, label }]
        tabs: { type: Array, required: true },
        activeId: { type: String, default: '' },
    },
    emits: ['select'],
    data() {
        return {
            /** 正在退场的 tab 下标(给旧球上 is-out) */
            leavingIndex: -1,
        };
    },
    computed: {
        activeIndex() {
            const index = this.tabs.findIndex((tab) => tab.id === this.activeId);
            return index >= 0 ? index : 0;
        },
    },
    methods: {
        onSelect(index) {
            if (index === this.activeIndex) return;
            this.leavingIndex = this.activeIndex;
            if (this._leaveTimer) clearTimeout(this._leaveTimer);
            this._leaveTimer = setTimeout(() => {
                this._leaveTimer = null;
                this.leavingIndex = -1;
            }, 440);
            this.$emit('select', this.tabs[index].id);
        },
        blobClass(index) {
            if (index === this.activeIndex) return 'is-in';
            if (index === this.leavingIndex) return 'is-out';
            return '';
        },
    },
    beforeUnmount() {
        if (this._leaveTimer) clearTimeout(this._leaveTimer);
    },
    template: `
        <nav class="oq-tabbar" role="tablist">
            <div class="oq-tabbar-shell">
                <button
                    v-for="(tab, index) in tabs"
                    :key="tab.id"
                    type="button"
                    class="oq-tab-item"
                    :class="{ 'is-active': index === activeIndex }"
                    :data-tab="tab.id"
                    role="tab"
                    :aria-selected="String(index === activeIndex)"
                    :aria-label="tab.label"
                    @click="onSelect(index)"
                >
                    <span class="oq-tab-dot"></span>
                    <span class="oq-tab-blob" :class="blobClass(index)">
                        <span class="oq-tab-blob-glyph">{{ tab.glyph }}</span>
                    </span>
                    <span class="oq-tab-label">{{ tab.label }}</span>
                </button>
            </div>
        </nav>
    `,
};

export default OqTabBar;
