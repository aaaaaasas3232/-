/**
 * 梦境编织 · 编辑器顶部工具栏
 *
 * 1:1 复原原版 `openChapterEditor`(7436-7554)那段 `.dw-enhanced-toolbar`。
 * 结构、类名、按钮顺序、图标、快捷设置的选项文案全部照抄:
 *
 *   .dw-enhanced-toolbar
 *     ├── .dw-toolbar-main            min-height 52px
 *     │     ├── .dw-toolbar-left      返回
 *     │     ├── .dw-toolbar-center    章节选择器 + 时间线选择器(齿轮滑动)
 *     │     └── .dw-toolbar-right     流式 / 分支 / 灵感夹子 / 更多
 *     └── .dw-quick-settings-panel    人称 · 方向 · 字数(可折叠)
 *
 * ★ 和原版唯一的实现差别:原版把颜色写成 inline style
 *   (`style="background:#1E1E1E;color:#E8E8E8;border:1px solid ..."`),
 *   这里改成 CSS 变量 —— 视觉一模一样,但换主题时能跟着变。
 *   原版那些 inline 颜色是它「换主题只换了个寂寞」的直接原因。
 */

import * as store from '../../store.js';
import { DwIcon } from '../shared.js';
import { DwSwipeSelector } from './swipe-selector.js';

export const DwToolbar = {
    name: 'DwToolbar',
    components: { DwIcon, DwSwipeSelector },
    props: {
        book: { type: Object, required: true },
        chapter: { type: Object, default: null },
        orderedChapters: { type: Array, default: () => [] },
        settings: { type: Object, required: true },
        quickSettingsVisible: { type: Boolean, default: false },
    },
    emits: ['back', 'notify', 'toggle-quick-settings'],
    computed: {
        /** 当前章所在的卷名 —— 原版显示的是卷名而不是书名 */
        volumeName() {
            if (!this.chapter) return this.book.volumes?.[0]?.name || '第一卷';
            const volume = this.book.volumes.find((v) => String(v.id) === String(this.chapter.volumeId));
            return volume?.name || '第一卷';
        },
        /** 原版显示「第 N 章」,N 是它在**本卷内**的序号 */
        chapterNumber() {
            if (!this.chapter) return '未选择';
            const volume = this.book.volumes.find((v) => String(v.id) === String(this.chapter.volumeId));
            if (!volume) return '未选择';
            const index = volume.chapterIds.findIndex((id) => String(id) === String(this.chapter.id));
            return index >= 0 ? `第${index + 1}章` : '未选择';
        },
        worldTimeDisplay() {
            return this.book.worldTime || '未设定时间';
        },
        chapterDataset() {
            const volumeIndex = this.chapter
                ? this.book.volumes.findIndex((v) => String(v.id) === String(this.chapter.volumeId))
                : 0;
            const volume = this.book.volumes[volumeIndex];
            const chapterIndex = volume && this.chapter
                ? volume.chapterIds.findIndex((id) => String(id) === String(this.chapter.id))
                : -1;
            return {
                'data-volume-index': String(volumeIndex < 0 ? 0 : volumeIndex),
                'data-chapter-index': String(chapterIndex),
            };
        },
        streamOn() {
            return this.settings.useStreamMode !== false;
        },
        /** 快捷设置里的「字数」是三档,不是具体数值 —— 照抄原版的映射 */
        wordCountTier() {
            const max = this.settings.defaultWordRange.max;
            if (max <= 500) return 'short';
            if (max <= 1000) return 'medium';
            return 'long';
        },
    },
    methods: {
        // ── 齿轮选择器 ────────────────────────
        onChapterNext() {
            if (!store.stepChapter(1)) this.$emit('notify', '已是最后一章');
        },
        onChapterPrev() {
            if (!store.stepChapter(-1)) this.$emit('notify', '已是第一章');
        },
        onChapterTap() {
            if (this.chapter) store.openModal('chapter-settings', { chapterId: this.chapter.id });
        },
        onTimeNext() {
            store.advanceWorldTime(this.book.id, 1);
        },
        onTimePrev() {
            store.advanceWorldTime(this.book.id, -1);
        },
        onTimeTap() {
            store.openModal('world-timeline', { bookId: this.book.id });
        },

        // ── 右侧按钮 ──────────────────────────
        onToggleStream() {
            const next = !this.streamOn;
            store.updateSettings({ useStreamMode: next });
            this.$emit('notify', next ? '流式生成已开启' : '流式生成已关闭');
        },
        onBranchManage() {
            store.openModal('branch-manager', { bookId: this.book.id });
        },
        onInspirationClip() {
            store.openPage('inspirations');
        },
        onMoreOptions() {
            store.openSheet('editor-more', {
                bookId: this.book.id,
                quickSettingsVisible: this.quickSettingsVisible,
            });
        },

        // ── 快捷设置 ──────────────────────────
        onPov(event) {
            store.updateSettings({ pov: event.target.value });
        },
        onDirection(event) {
            store.updateSettings({ replyDirection: event.target.value });
        },
        onWordCount(event) {
            const map = {
                short: { min: 200, max: 500 },
                medium: { min: 500, max: 1000 },
                long: { min: 1000, max: 2000 },
            };
            store.updateSettings({ defaultWordRange: map[event.target.value] || map.long });
        },
    },
    template: `
        <div class="dw-enhanced-toolbar">
            <div class="dw-toolbar-main">
                <div class="dw-toolbar-left">
                    <button
                        type="button"
                        class="dw-toolbar-btn dw-toolbar-btn-icon"
                        title="返回书架"
                        aria-label="返回书架"
                        @click="$emit('back')"
                    ><DwIcon name="chevronLeft" /></button>
                </div>

                <div class="dw-toolbar-center">
                    <DwSwipeSelector
                        kind="chapter"
                        :label="volumeName"
                        :value="chapterNumber"
                        :dataset="chapterDataset"
                        @next="onChapterNext"
                        @prev="onChapterPrev"
                        @tap="onChapterTap"
                    />
                    <DwSwipeSelector
                        kind="timeline"
                        label="故事时间"
                        :value="worldTimeDisplay"
                        @next="onTimeNext"
                        @prev="onTimePrev"
                        @tap="onTimeTap"
                    />
                </div>

                <div class="dw-toolbar-right">
                    <button
                        type="button"
                        class="dw-toolbar-btn dw-toolbar-btn-icon dw-btn-stream"
                        :class="{ 'dw-btn-active': streamOn }"
                        :title="streamOn ? '流式生成(已开启)' : '流式生成(已关闭)'"
                        :aria-label="streamOn ? '流式生成(已开启)' : '流式生成(已关闭)'"
                        @click="onToggleStream"
                    ><DwIcon :name="streamOn ? 'stream' : 'streamOff'" /></button>

                    <button
                        type="button"
                        class="dw-toolbar-btn dw-toolbar-btn-icon dw-btn-branch"
                        title="分支管理"
                        aria-label="分支管理"
                        @click="onBranchManage"
                    ><DwIcon name="branch" /></button>

                    <button
                        type="button"
                        class="dw-toolbar-btn dw-toolbar-btn-icon dw-btn-clip"
                        title="灵感夹子"
                        aria-label="灵感夹子"
                        @click="onInspirationClip"
                    ><DwIcon name="bookmark" /></button>

                    <button
                        type="button"
                        class="dw-toolbar-btn dw-toolbar-btn-icon"
                        title="更多操作"
                        aria-label="更多操作"
                        @click="onMoreOptions"
                    ><DwIcon name="moreHorizontal" /></button>
                </div>
            </div>

            <div class="dw-quick-settings-panel" :class="{ visible: quickSettingsVisible }">
                <div class="dw-quick-settings-row">
                    <div class="dw-quick-setting-item">
                        <span class="dw-quick-setting-label">人称</span>
                        <select class="dw-quick-setting-select" :value="settings.pov" @change="onPov">
                            <option value="first">一</option>
                            <option value="second">二</option>
                            <option value="third">三</option>
                        </select>
                    </div>
                    <div class="dw-quick-setting-item">
                        <span class="dw-quick-setting-label">方向</span>
                        <select class="dw-quick-setting-select" :value="settings.replyDirection" @change="onDirection">
                            <option value="auto">自动</option>
                            <option value="continue">续写</option>
                            <option value="dialogue">对话</option>
                        </select>
                    </div>
                    <div class="dw-quick-setting-item">
                        <span class="dw-quick-setting-label">字数</span>
                        <select class="dw-quick-setting-select" :value="wordCountTier" @change="onWordCount">
                            <option value="short">短</option>
                            <option value="medium">中</option>
                            <option value="long">长</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `,
};

export default DwToolbar;
