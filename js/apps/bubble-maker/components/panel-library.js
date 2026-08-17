/**
 * 气泡机 · 气泡库
 *
 * 库里的每张卡都是**真的气泡**(同一个 `BubbleView`,同一份样式函数),
 * 不是缩略图或色块 —— 色块看不出圆角和尾巴,而那恰恰是挑气泡时唯一在看的东西。
 *
 * 「新建」给的是一排预设:参考软件新建出来是一个纯蓝方块,
 * 用户第一步永远是把它改成别的样子。给一排能直接用的起点省掉这一步。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { BubbleView } from '@/src/core/components/bubble-view.js';
import { BUBBLE_PRESETS, previewPair } from '../services/presets.js';
import { formatDateTime } from '../utils.js';

export const BbPanelLibrary = {
    name: 'BbPanelLibrary',
    components: { ...SHARED_COMPONENTS, BubbleView },
    emits: ['notify'],
    data() {
        return { BUBBLE_PRESETS, filter: 'all', newOpen: false };
    },
    computed: {
        state() { return store.getState(); },
        shapes() { return store.getShapes(); },
        activeId() { return this.state.activeId; },
        list() {
            const all = this.state.bubbles;
            if (this.filter === 'star') return all.filter((b) => b.starred);
            if (this.filter === 'left') return all.filter((b) => b.side === 'left');
            if (this.filter === 'right') return all.filter((b) => b.side === 'right');
            return all;
        },
        filters() {
            return [
                { value: 'all', label: `全部 ${this.state.bubbles.length}` },
                { value: 'right', label: '右侧' },
                { value: 'left', label: '左侧' },
                { value: 'star', label: '收藏' },
            ];
        },
    },
    methods: {
        pick(id) {
            store.selectBubble(id);
            store.setTab('design');
        },
        star(id) { store.toggleStar(id); },
        async dup(id) {
            await store.duplicateBubble(id);
            this.$emit('notify', '已复制一份,可以放心改');
        },
        del(b) { store.openModal('confirm-delete-bubble', { id: b.id, name: b.name }); },
        async fromPreset(presetId, side) {
            await store.createFromPreset(presetId, side);
            this.newOpen = false;
            store.setTab('design');
            this.$emit('notify', '已加进库,直接改就行');
        },
        async blank() {
            await store.createBubble({ name: '新气泡' });
            this.newOpen = false;
            store.setTab('design');
        },
        pairOf(presetId) { return previewPair(presetId); },
        when(ts) { return formatDateTime(ts); },
    },
    template: `
        <div class="bb-panel-body">
            <BbSection title="新建" icon-name="plus" collapsible :open="newOpen" @toggle="newOpen = !newOpen">
                <div class="bb-preset-list">
                    <div v-for="p in BUBBLE_PRESETS" :key="p.id" class="bb-preset-card">
                        <div class="bb-preset-art">
                            <BubbleView :config="pairOf(p.id).left" :shapes="shapes" text="在吗" />
                            <BubbleView :config="pairOf(p.id).right" :shapes="shapes" text="在的" />
                        </div>
                        <div class="bb-preset-meta">
                            <span class="bb-preset-name">{{ p.name }}</span>
                            <span class="bb-preset-desc">{{ p.desc }}</span>
                        </div>
                        <div class="bb-preset-acts">
                            <button type="button" class="bb-mini" @click="fromPreset(p.id, 'left')">加左侧</button>
                            <button type="button" class="bb-mini" @click="fromPreset(p.id, 'right')">加右侧</button>
                        </div>
                    </div>
                </div>
                <BbButton variant="line" block icon-name="plus" @click="blank">从空白开始</BbButton>
            </BbSection>

            <BbSection title="我的气泡" icon-name="layers">
                <BbSegmented v-model="filter" :options="filters" />

                <BbEmpty
                    v-if="!list.length"
                    icon-name="bubble"
                    text="这一栏是空的"
                    hint="上面「新建」里挑一套预设,或者从空白开始"
                />

                <div v-else class="bb-lib-list">
                    <div
                        v-for="b in list"
                        :key="b.id"
                        class="bb-lib-card"
                        :class="{ 'is-active': b.id === activeId }"
                    >
                        <button type="button" class="bb-lib-art" :aria-label="'编辑 ' + b.name" @click="pick(b.id)">
                            <BubbleView :config="b" :shapes="shapes" text="今天天气不错" />
                        </button>
                        <div class="bb-lib-meta">
                            <span class="bb-lib-name">{{ b.name }}</span>
                            <span class="bb-lib-sub">{{ b.side === 'left' ? '左侧' : '右侧' }} · {{ when(b.updatedAt) }}</span>
                        </div>
                        <div class="bb-lib-acts">
                            <button
                                type="button"
                                class="bb-mini"
                                :class="{ 'is-on': b.starred }"
                                :aria-label="b.starred ? '取消收藏' : '收藏'"
                                @click="star(b.id)"
                            >收藏</button>
                            <button type="button" class="bb-mini" @click="dup(b.id)">复制</button>
                            <button type="button" class="bb-mini is-danger" @click="del(b)">删除</button>
                        </div>
                    </div>
                </div>
            </BbSection>

            <p class="bb-note">
                这些气泡在「情景聊天」里选得到:进一个情景 → 主题 → 气泡,左右两侧各挑一套。
            </p>
        </div>
    `,
};

export const LIBRARY_COMPONENTS = { BbPanelLibrary };
