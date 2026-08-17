/**
 * 手书 · 剪辑属性面板
 *
 * 选中一个剪辑之后能改的所有东西。
 *
 * ★ 一条设计取舍:改「文字」时会**顺手重算时长**(按字数),
 *   但只在用户没手动定过时长的时候。理由是「打三个字花 1.2 秒」是常识,
 *   而「把三个字改成三十个字、时长还是 1.2 秒」谁都不想要。
 *   手动拖过时长的剪辑不会被覆盖 —— 那是用户明确表达过的意图。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { CLIP_TYPES, STAGE_BACKDROPS, STAGE_POSITIONS, TEXT_ALIGNS } from '../constants.js';
import { formatClock } from '../utils.js';

export const HsPanelClip = {
    name: 'HsPanelClip',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    computed: {
        state() { return store.getState(); },
        clip() { return store.getSelectedClip(); },
        project() { return store.getProject(); },

        typeMeta() { return CLIP_TYPES.find((c) => c.id === this.clip?.type) || null; },
        isText() { return this.clip && ['type', 'delete', 'hold', 'replace', 'clear'].includes(this.clip.type); },

        effectOptions() {
            return [{ value: '', label: '不加效果' }, ...store.getEffects().map((e) => ({ value: e.id, label: e.name }))];
        },
        backdropOptions() {
            return STAGE_BACKDROPS.map((b) => ({ value: b.id, label: b.label }));
        },
        positionOptions() { return STAGE_POSITIONS.map((p) => ({ value: p.id, label: p.label })); },
        alignOptions() { return TEXT_ALIGNS.map((p) => ({ value: p.id, label: p.label })); },

        startSeconds() { return this.clip ? Number((this.clip.start / 1000).toFixed(2)) : 0; },
        durationSeconds() { return this.clip ? Number((this.clip.duration / 1000).toFixed(2)) : 0; },

        rangeText() {
            if (!this.clip) return '';
            return `${formatClock(this.clip.start)} → ${formatClock(this.clip.start + this.clip.duration)}`;
        },

        /** 这个剪辑跑完之后屏幕上是什么 —— 改删除字数时最需要看到的就是它 */
        preview() {
            if (!this.clip) return '';
            const frame = store.renderAt(store.getTimeline(), this.clip.start + this.clip.duration - 1);
            return frame.text || '(空)';
        },
    },
    methods: {
        patch(key, value) {
            if (!this.clip) return;
            store.updateClip(this.clip.id, { [key]: value }, { label: '改剪辑' });
        },
        patchStyle(key, value) {
            if (!this.clip) return;
            store.updateClip(this.clip.id, { style: { [key]: value } }, { label: '改单句样式' });
        },
        clearStyle() {
            if (!this.clip) return;
            store.updateClip(this.clip.id, { style: null }, { label: '恢复跟随舞台' });
            this.$emit('notify', '这一句恢复跟随舞台样式');
        },
        setStart(seconds) {
            this.patch('start', Math.max(0, Math.round(Number(seconds) * 1000)));
        },
        setDuration(seconds) {
            this.patch('duration', Math.max(120, Math.round(Number(seconds) * 1000)));
        },
        onDelete() {
            if (!this.clip) return;
            store.openModal('confirm-clip', { id: this.clip.id });
        },
        onDuplicate() {
            if (!this.clip) return;
            store.duplicateClip(this.clip.id);
        },
        onSeek() {
            if (!this.clip) return;
            store.seek(this.clip.start);
        },
    },
    template: `
        <div class="hs-panel hs-panel--clip">
            <HsEmpty
                v-if="!clip"
                icon-name="sliders"
                text="还没选中剪辑"
                hint="在时间轴上点一个方块,或者点轨道空白处新建一个"
            />

            <template v-else>
                <div class="hs-clip-head">
                    <span class="hs-clip-kind" :data-type="clip.type">{{ typeMeta ? typeMeta.label : clip.type }}</span>
                    <span class="hs-clip-range">{{ rangeText }}</span>
                    <HsButton icon-name="target" icon-only label="跳到这里" size="sm" @click="onSeek" />
                </div>
                <p v-if="typeMeta" class="hs-clip-desc">{{ typeMeta.desc }}</p>

                <!-- 内容 -->
                <HsField v-if="clip.type === 'type'" label="要打出来的文字">
                    <HsTextarea :model-value="clip.text" :rows="3" placeholder="写一句" @update:modelValue="patch('text', $event)" />
                </HsField>

                <template v-else-if="clip.type === 'delete'">
                    <HsSlider
                        label="删掉几个字" suffix=" 字"
                        :model-value="clip.count" :min="1" :max="40"
                        @update:modelValue="patch('count', $event)"
                    />
                    <p class="hs-clip-preview">删完屏幕上剩:<b>{{ preview }}</b></p>
                </template>

                <template v-else-if="clip.type === 'replace'">
                    <HsField label="把这段">
                        <HsInput :model-value="clip.from" placeholder="旧的文字" @update:modelValue="patch('from', $event)" />
                    </HsField>
                    <HsField label="换成">
                        <HsInput :model-value="clip.to" placeholder="新的文字" @update:modelValue="patch('to', $event)" />
                    </HsField>
                </template>

                <p v-else-if="clip.type === 'hold'" class="hs-clip-preview">
                    停顿期间屏幕不变,当前显示:<b>{{ preview }}</b>
                </p>

                <p v-else-if="clip.type === 'clear'" class="hs-clip-preview">
                    会把这一刻屏幕上的字全部逐个清掉。
                </p>

                <HsField v-else-if="clip.type === 'bg'" label="舞台底">
                    <HsSelect :model-value="clip.backdrop" :options="backdropOptions" @update:modelValue="patch('backdrop', $event)" />
                </HsField>

                <!-- 效果 -->
                <HsField v-if="clip.type !== 'bg'" label="效果预设" hint="效果轨上的剪辑也会叠加上来">
                    <HsSelect :model-value="clip.effectId" :options="effectOptions" @update:modelValue="patch('effectId', $event)" />
                </HsField>

                <!-- 时间 -->
                <div class="hs-clip-time">
                    <HsField label="起点(秒)">
                        <HsInput type="number" :model-value="startSeconds" @update:modelValue="setStart($event)" />
                    </HsField>
                    <HsField label="时长(秒)">
                        <HsInput type="number" :model-value="durationSeconds" @update:modelValue="setDuration($event)" />
                    </HsField>
                </div>

                <!-- 单句样式覆盖 -->
                <HsSection v-if="isText" title="只改这一句的样式" hint="不填就跟随舞台">
                    <HsSlider
                        label="字号" suffix=" px"
                        :model-value="(clip.style && clip.style.fontSize) || project.stage.fontSize"
                        :min="12" :max="72"
                        @update:modelValue="patchStyle('fontSize', $event)"
                    />
                    <HsSegment
                        label="位置"
                        :model-value="(clip.style && clip.style.position) || project.stage.position"
                        :options="positionOptions"
                        @update:modelValue="patchStyle('position', $event)"
                    />
                    <HsSegment
                        label="对齐"
                        :model-value="(clip.style && clip.style.align) || project.stage.align"
                        :options="alignOptions"
                        @update:modelValue="patchStyle('align', $event)"
                    />
                    <HsField label="颜色" hint="留空跟随主题;支持 #hex / rgb() / 颜色名">
                        <HsInput :model-value="(clip.style && clip.style.color) || ''" placeholder="#ffffff" @update:modelValue="patchStyle('color', $event)" />
                    </HsField>
                    <HsButton v-if="clip.style" size="sm" icon-name="refresh" @click="clearStyle">恢复跟随舞台</HsButton>
                </HsSection>

                <div class="hs-clip-foot">
                    <HsButton icon-name="copy" size="sm" @click="onDuplicate">复制</HsButton>
                    <HsButton icon-name="trash" size="sm" variant="danger" @click="onDelete">删除</HsButton>
                </div>
            </template>
        </div>
    `,
};

export default HsPanelClip;
