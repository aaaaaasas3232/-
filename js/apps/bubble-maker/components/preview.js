/**
 * 气泡机 · 预览台
 *
 * ── 相对参考软件的改动 ────────────────────────────────────────────
 *
 * 参考软件的预览区固定显示「一条 AI + 一条用户」,两条各自读一份独立配置,
 * 于是编辑用户气泡时下面那条 AI 气泡纹丝不动 —— 看不出**一屏对话**是什么样。
 *
 * 这里改成:正在编辑的那一条高亮,对面那一条从库里取最近改过的
 * (取不到就镜像当前这条)。目的是让「圆角这么调、放在一起好不好看」
 * 这个判断在编辑时就能做出来,而不是应用到情景聊天之后才发现。
 *
 * 底纹是**看**的,不进任何存档 —— 它只是给半透明气泡一个参照。
 */

import * as store from '../store.js';
import { BubbleView } from '@/src/core/components/bubble-view.js';
import { SHARED_COMPONENTS } from './shared.js';
import { PREVIEW_BACKDROPS, SAMPLE_TEXTS } from '../constants.js';

export const BbPreview = {
    name: 'BbPreview',
    components: { ...SHARED_COMPONENTS, BubbleView },
    data() {
        return { PREVIEW_BACKDROPS, sampleIndex: 0 };
    },
    computed: {
        state() { return store.getState(); },
        settings() { return store.getSettings(); },
        active() { return store.getActive(); },
        counterpart() { return store.getCounterpart(); },
        shapes() { return store.getShapes(); },
        activeTailId() { return this.state.activeTailId; },
        sample() { return SAMPLE_TEXTS[this.sampleIndex % SAMPLE_TEXTS.length]; },
        /** 编辑中的气泡在上还是在下 —— 按它自己的 side 排,和真实聊天一致 */
        rows() {
            if (!this.active) return [];
            const me = { key: 'active', bubble: this.active, hot: true };
            const other = this.counterpart ? { key: 'other', bubble: this.counterpart, hot: false } : null;
            if (!other) return [me];
            return this.active.side === 'right' ? [other, me] : [me, other];
        },
    },
    methods: {
        setBackdrop(id) { store.updateSettings({ backdrop: id }); },
        togglePair() { store.updateSettings({ pairPreview: !this.settings.pairPreview }); },
        nextSample() { this.sampleIndex += 1; },
        visibleRows() {
            return this.settings.pairPreview ? this.rows : this.rows.filter((r) => r.hot);
        },
    },
    template: `
        <div class="bb-preview">
            <div class="bb-preview-stage" :data-backdrop="settings.backdrop">
                <div v-for="row in visibleRows()" :key="row.key" class="bb-preview-row" :class="{ 'is-dim': !row.hot }">
                    <BubbleView
                        :config="row.bubble"
                        :shapes="shapes"
                        :text="sample"
                        :highlight-tail="row.hot ? activeTailId : ''"
                    />
                </div>
            </div>

            <div class="bb-preview-bar">
                <div class="bb-preview-backdrops">
                    <button
                        v-for="b in PREVIEW_BACKDROPS"
                        :key="b.id"
                        type="button"
                        class="bb-backdrop-dot"
                        :class="{ 'is-active': settings.backdrop === b.id }"
                        :data-backdrop="b.id"
                        :title="b.label"
                        :aria-label="b.label"
                        @click="setBackdrop(b.id)"
                    ></button>
                </div>
                <div class="bb-preview-tools">
                    <BbButton size="sm" variant="quiet" icon-name="text" @click="nextSample">换句话</BbButton>
                    <BbButton
                        size="sm"
                        :variant="settings.pairPreview ? 'ghost' : 'quiet'"
                        icon-name="grid"
                        @click="togglePair"
                    >{{ settings.pairPreview ? '成对' : '单条' }}</BbButton>
                </div>
            </div>
        </div>
    `,
};

export default BbPreview;
