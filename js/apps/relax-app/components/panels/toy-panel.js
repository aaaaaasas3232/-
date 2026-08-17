/**
 * relax-app / 「捏捏」面板 —— 挑解压主体 + 给主体上色
 *
 * ★ 主体清单来自 registry,而且订阅了 onRelaxToysChanged ——
 *   主体是可以异步 import 进来的(以后气泡纸做懒加载也不用改这里)。
 *
 * ★ 空态很重要:一个主体都没登记时,这里要告诉人「怎么加」,
 *   而不是干干净净一片白让人以为坏了。
 *
 * ★ 主体缩放上限 0.6~1.6(用户要求「能放大的大小再大一点」)。
 *
 * ★ 「这个主体的声音」section:全局音声在「音声」tab 里配,这里配的是「这个主体
 *   单独用哪个音」—— 没配就走全局默认,有配就覆盖。
 */

import { RxSection, RxSlider, RxSwatches, RxTile } from '../shared.js';
import { RxSoundPicker } from '../sound-picker.js';
import { ICON_PENCIL } from '../icons.js';
import { listRelaxToys, onRelaxToysChanged } from '../../registry.js';
import { listSoundPresets } from '../../services/sound-service.js';

export const ToyPanel = {
    name: 'ToyPanel',
    components: { RxSection, RxSlider, RxSwatches, RxTile, RxSoundPicker },
    props: {
        scene: { type: Object, required: true },
        customSounds: { type: Array, default: () => [] },
    },
    emits: ['set-toy', 'set-toy-tint', 'set-toy-scale', 'set-toy-rows-cols', 'reset-toy', 'edit-custom', 'set-toy-sound', 'clear-toy-sound'],
    data() {
        return {
            toys: listRelaxToys(),
            soundPresets: listSoundPresets(),
        };
    },
    computed: {
        activeToy() {
            return this.toys.find(item => item.id === this.scene.toy.id) || null;
        },
        canReset() {
            return !!this.activeToy;
        },
        /**
         * 「板子规格」要不要显示。
         * ★ 光看 activeToy.configurable 不够 —— 「我的捏捏」切到自由 / 写代码
         *   之后整块只画一个东西,行列根本不参与渲染,再摆两个输入框在那儿
         *   就是「调了没反应」。做法存在主体自己的便签里,所以要读 toyStates。
         */
        config() {
            const declared = this.activeToy?.configurable || null;
            if (!declared || this.toyLayout !== 'grid') return null;
            return declared;
        },
        isCustom() {
            return !!this.activeToy?.customizable;
        },
        toyLayout() {
            const toyId = this.scene.toy.id;
            if (!toyId) return 'grid';
            const saved = this.scene.toyStates?.[toyId]?.layout;
            return (saved === 'free' || saved === 'code') ? saved : 'grid';
        },
        customHint() {
            if (this.toyLayout === 'code') return '沙箱里跑 · HTML + CSS + JS';
            if (this.toyLayout === 'free') return '整块自己画 · 摇杆鼠标那种';
            return 'HTML 模板 + CSS 样式';
        },
        gridLabel() {
            return `${this.scene.toy.rows} × ${this.scene.toy.cols}`;
        },
        /** 当前主体有没有单独的音色覆盖 */
        activeToySoundOverride() {
            if (!this.scene.toy.id) return null;
            return this.scene.toySounds?.[this.scene.toy.id] || null;
        },
        /** 覆盖用的内置音;用了自定义音时返回 null,让选择器只高亮一处 */
        toySoundPresetId() {
            const o = this.activeToySoundOverride;
            if (!o || o.customId) return null;
            return o.presetId || null;
        },
        toySoundCustomId() {
            return this.activeToySoundOverride?.customId || null;
        },
        /** 覆盖状态的可读 label —— 给「这个主体的声音」section 当 hint */
        soundOverrideLabel() {
            const o = this.activeToySoundOverride;
            if (!o || (o.presetId == null && o.customId == null)) return '用全局默认';
            if (o.customId) {
                const found = this.customSounds.find(s => s.id === o.customId);
                return found ? `自定义 · ${found.name}` : '自定义音(已删除)';
            }
            const preset = this.soundPresets.find(p => p.id === o.presetId);
            return preset ? `${preset.name}` : '内置音(已删除)';
        },
    },
    mounted() {
        this._unsubscribe = onRelaxToysChanged((list) => {
            this.toys = list;
        });
    },
    beforeUnmount() {
        this._unsubscribe?.();
    },
    methods: {
        onPick(toy) {
            // 再点一次当前主体 = 取下来,盘子留空。
            // ★ 但 deletable:false 的主体(巧克力、果冻)不吃这套 —— 重复点保持原样,
            //   否则用户想再点一下确认选中,结果把它点没了。
            if (this.scene.toy.id === toy.id) {
                if (toy.deletable === false) return;
                this.$emit('set-toy', { id: null });
                return;
            }
            this.$emit('set-toy', { id: toy.id, defaultTint: toy.defaultTint });
        },
        onRowsChange(value) {
            const rows = Math.round(Number(value));
            if (!Number.isFinite(rows)) return;
            this.$emit('set-toy-rows-cols', { rows, cols: this.scene.toy.cols });
        },
        onColsChange(value) {
            const cols = Math.round(Number(value));
            if (!Number.isFinite(cols)) return;
            this.$emit('set-toy-rows-cols', { rows: this.scene.toy.rows, cols });
        },
        openCustomEditor() {
            this.$emit('edit-custom', {
                rows: this.scene.toy.rows,
                cols: this.scene.toy.cols,
            });
        },
        /** per-toy 音色:点内置瓦片 → 设 preset;点自定义音 → 设 custom */
        onPickToySoundPreset(presetId) {
            this.$emit('set-toy-sound', { presetId, customId: null });
        },
        onPickToySoundCustom(sound) {
            this.$emit('set-toy-sound', { customId: sound.id, presetId: null });
        },
        onClearToySound() {
            this.$emit('clear-toy-sound');
        },
        /** 「试听」按钮 —— 不需要传 id,resolve 已经知道用哪个音 */
        onPreviewToySound() {
            this.$emit('preview-toy-sound');
        },
    },
    template: `
        <div class="rx-panel rx-panel-toy">
            <RxSection title="解压主体" hint="点一下放上舞台">
                <div v-if="toys.length" class="rx-tile-grid">
                    <RxTile
                        v-for="toy in toys"
                        :key="toy.id"
                        :label="toy.name"
                        :active="toy.id === scene.toy.id"
                        @select="onPick(toy)"
                    >
                        <span
                            class="rx-toy-thumb"
                            :style="{ color: toy.id === scene.toy.id ? scene.toy.tint : toy.defaultTint }"
                            v-html="toy.icon"
                        ></span>
                    </RxTile>
                </div>

                <div v-else class="rx-empty-card">
                    <div class="rx-empty-title">还没有装任何解压主体</div>
                    <p class="rx-empty-body">
                        主体(气泡纸捏捏、巧克力脆皮之类)是独立插件。
                        在 <code>js/apps/relax-app/toys/</code> 下建一个文件,
                        调一次 <code>registerRelaxToy()</code>,
                        再到同目录 <code>index.js</code> 里 import 一下,就会出现在这里。
                    </p>
                </div>
            </RxSection>

            <template v-if="activeToy">
                <RxSection
                    v-if="activeToy.tintable"
                    title="主体颜色"
                    :hint="activeToy.name"
                >
                    <RxSwatches :value="scene.toy.tint" @change="$emit('set-toy-tint', $event)" />
                </RxSection>

                <!-- ★ 板子规格:仅当主体声明 configurable(type:'grid')时显示。
                       果冻 / 巧克力没声明,这块自动消失。 -->
                <RxSection
                    v-if="config"
                    title="板子规格"
                    :hint="gridLabel + ' 格'"
                >
                    <div class="rx-grid-row">
                        <label class="rx-grid-field">
                            <span class="rx-grid-label">行</span>
                            <input
                                class="rx-grid-input"
                                type="number"
                                :min="config.min"
                                :max="config.max"
                                step="1"
                                :value="scene.toy.rows"
                                @change="onRowsChange($event.target.value)"
                            />
                        </label>
                        <label class="rx-grid-field">
                            <span class="rx-grid-label">列</span>
                            <input
                                class="rx-grid-input"
                                type="number"
                                :min="config.min"
                                :max="config.max"
                                step="1"
                                :value="scene.toy.cols"
                                @change="onColsChange($event.target.value)"
                            />
                        </label>
                    </div>
                    <div class="rx-grid-range">
                        <input
                            type="range"
                            :min="config.min"
                            :max="config.max"
                            step="1"
                            :value="scene.toy.rows"
                            @input="onRowsChange($event.target.value)"
                            aria-label="行数"
                        />
                        <input
                            type="range"
                            :min="config.min"
                            :max="config.max"
                            step="1"
                            :value="scene.toy.cols"
                            @input="onColsChange($event.target.value)"
                            aria-label="列数"
                        />
                    </div>
                </RxSection>

                <RxSection
                    v-if="isCustom"
                    title="自定义"
                    :hint="customHint"
                >
                    <button
                        type="button"
                        class="rx-btn rx-btn-primary rx-btn-block"
                        @click="openCustomEditor"
                    >
                        ${ICON_PENCIL}
                        <span>写 HTML / 换模板</span>
                    </button>
                </RxSection>

                <!-- ★ Per-toy 音色覆盖 —— 「全局默认 + 这个按钮单独覆盖」 -->
                <RxSection
                    title="这个主体的声音"
                    :hint="soundOverrideLabel"
                >
                    <RxSoundPicker
                        scope="toy"
                        :custom-sounds="customSounds"
                        :preset-id="toySoundPresetId"
                        :custom-id="toySoundCustomId"
                        @pick-preset="onPickToySoundPreset"
                        @pick-custom="onPickToySoundCustom"
                    />

                    <div v-if="activeToySoundOverride" class="rx-btn-row">
                        <button
                            type="button"
                            class="rx-btn rx-btn-ghost"
                            @click="onClearToySound"
                        >回到全局默认</button>
                    </div>
                </RxSection>

                <RxSection title="大小">
                    <RxSlider
                        label="主体缩放"
                        :value="scene.toy.scale"
                        :min="0.6"
                        :max="1.6"
                        :step="0.02"
                        @change="$emit('set-toy-scale', $event)"
                    />
                </RxSection>

                <RxSection v-if="canReset" title="重来一次" hint="把主体恢复到初始状态">
                    <button type="button" class="rx-btn rx-btn-ghost" @click="$emit('reset-toy')">
                        恢复主体
                    </button>
                </RxSection>
            </template>
        </div>
    `,
};
