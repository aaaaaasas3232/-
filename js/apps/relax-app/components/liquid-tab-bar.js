/**
 * relax-app / Tab 栏(简化版)
 *
 * 原液态 tab 栏由「白色胶囊栏 + 白色鼓包 + 彩色液体球 + 小灰点 + 文字标签」组成,
 * 现在去掉胶囊栏容器和白色鼓包,只保留按钮本体和它的彩色液体球 / 小灰点 / 文字标签。
 *
 * 视觉要点:
 *   - tab-item 默认沉在底部显示小灰点 + 文字标签
 *   - 激活时整体上移 -32px,把彩色 blob 球托到栏上方,内嵌一个汉字
 *   - 弹性曲线 cubic-bezier(0.34, 1.4, 0.64, 1)
 *
 * 允许打断:旧 blob 立刻退场,不等上一段动画跑完(手感更跟手)
 */

export const LiquidTabBar = {
    name: 'LiquidTabBar',
    props: {
        // [{ id, glyph, label, color }]
        tabs: { type: Array, required: true },
        activeId: { type: String, default: '' },
    },
    emits: ['select'],
    data() {
        return {
            // 正在退场的 tab index(用来给旧 blob 上 is-out)
            leavingIndex: -1,
        };
    },
    computed: {
        activeIndex() {
            const index = this.tabs.findIndex(tab => tab.id === this.activeId);
            return index >= 0 ? index : 0;
        },
    },
    methods: {
        onSelect(index) {
            if (index === this.activeIndex) return;

            // 允许打断:旧 blob 立刻退场,不等上一段动画跑完
            this.leavingIndex = this.activeIndex;
            if (this._leaveTimer) clearTimeout(this._leaveTimer);
            this._leaveTimer = setTimeout(() => {
                this._leaveTimer = null;
                this.leavingIndex = -1;
            }, 460);

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
        <nav class="rx-tabbar" role="tablist">
            <div class="rx-tabbar-shell">
                <button
                    v-for="(tab, index) in tabs"
                    :key="tab.id"
                    type="button"
                    class="rx-tab-item"
                    :class="{ 'is-active': index === activeIndex }"
                    role="tab"
                    :aria-selected="String(index === activeIndex)"
                    :aria-label="tab.label"
                    @click="onSelect(index)"
                >
                    <span class="rx-tab-dot" :style="{ background: tab.color }"></span>
                    <span
                        class="rx-tab-blob"
                        :class="blobClass(index)"
                        :style="{ background: tab.color }"
                    >
                        <span class="rx-tab-blob-glyph">{{ tab.glyph }}</span>
                    </span>
                    <span class="rx-tab-label">{{ tab.label }}</span>
                </button>
            </div>
        </nav>
    `,
};
