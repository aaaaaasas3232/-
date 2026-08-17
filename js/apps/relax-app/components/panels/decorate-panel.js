/**
 * relax-app / 「装扮」面板 —— 背景 / 盘子 / 装饰
 *
 * 三个子 tab 共用一套控件(RxTile / RxSwatches / RxSlider),视觉一致。
 *
 * ★ 「装饰」子 tab 打开时,舞台会进入 editable 模式(可拖可选中)——
 *   这个联动在父组件里做(`editable = activeTab==='decorate' && subTab==='deco'`),
 *   这里只负责 emit,不直接改舞台。
 *
 * ★ 三个子 tab 都可以上传自定义素材:
 *   - 背景:custom-images
 *   - 盘子:custom-plates(新增,取代只能用内置预设)
 *   - 装饰:custom-decorations(新增,可以贴自己的 png 贴纸)
 */

import { RxSection, RxSlider, RxSwatches, RxTile, RxToggle } from '../shared.js';
import { ICON_CLOSE } from '../icons.js';
import { BACKGROUNDS, resolveBackgroundStyle } from '../../assets/backgrounds.js';
import { PLATES, resolvePlateStyle } from '../../assets/plates.js';
import { DECORATIONS, DECORATION_GROUPS, getDecoration } from '../../assets/decorations.js';

const SUB_TABS = [
    { id: 'bg', label: '背景' },
    { id: 'plate', label: '盘子' },
    { id: 'deco', label: '装饰' },
];

export const DecoratePanel = {
    name: 'DecoratePanel',
    components: { RxSection, RxSlider, RxSwatches, RxTile, RxToggle },
    props: {
        scene: { type: Object, required: true },
        customImages: { type: Array, default: () => [] },
        customPlates: { type: Array, default: () => [] },
        customDecorations: { type: Array, default: () => [] },
        selectedDecorationUid: { type: String, default: null },
        subTab: { type: String, default: 'bg' },
    },
    emits: [
        'change-sub-tab',
        'set-bg-preset', 'set-bg-tint', 'set-bg-image', 'set-bg-filter',
        'upload-image', 'remove-image',
        'set-plate-enabled', 'set-plate-preset', 'set-plate-tint', 'set-plate-transform',
        'set-plate-custom', 'upload-plate', 'remove-plate',
        'add-decoration', 'add-custom-decoration', 'remove-custom-decoration',
        'update-decoration', 'remove-decoration', 'clear-decorations',
        'enter-deco-edit',
    ],
    data() {
        return {
            subTabs: SUB_TABS,
            backgrounds: BACKGROUNDS,
            plates: PLATES,
            decorationGroups: DECORATION_GROUPS,
            activeDecoGroup: DECORATION_GROUPS[0].id,
            // 装饰子 tab 上专门给「我的贴纸」多开一节,让用户上传的贴纸有归属
            customDecoGroup: { id: 'custom', name: '我的贴纸' },
        };
    },
    computed: {
        usingCustomImage() {
            return !!this.scene.background.customImageId;
        },
        usingCustomPlate() {
            return !!this.scene.plate.customId;
        },
        /**
         * 装饰分组 = 内置分组 + 「我的贴纸」。
         *
         * ★「我的贴纸」必须**恒定存在**。
         *   上传按钮就在这个分组的瓦片里,而这里以前写的是
         *   「有自定义贴纸时才把这个分组加进来」—— 于是形成死锁:
         *   想上传得先进这个分组,想让分组出现又得先有贴纸,
         *   结果用户第一张贴纸永远传不上去。
         */
        allDecorationGroups() {
            return [...this.decorationGroups, this.customDecoGroup];
        },
        groupedDecorations() {
            if (this.activeDecoGroup === 'custom') {
                return this.customDecorations.map(item => ({
                    id: `custom:${item.id}`,
                    name: item.name,
                    group: 'custom',
                    defaultTint: '#ffffff',
                    aspect: item.aspect || 1,
                    custom: true,
                    dataUrl: item.dataUrl,
                }));
            }
            return DECORATIONS.filter(item => item.group === this.activeDecoGroup);
        },
        selectedDecoration() {
            if (!this.selectedDecorationUid) return null;
            return this.scene.decorations.find(item => item.uid === this.selectedDecorationUid) || null;
        },
        selectedDecorationName() {
            const deco = this.selectedDecoration;
            if (!deco) return '';
            if (deco.presetId?.startsWith('custom:')) {
                const id = deco.presetId.slice(7);
                const record = this.customDecorations.find(item => item.id === id);
                return record?.name || '';
            }
            return getDecoration(deco.presetId)?.name || '';
        },
        selectedDecorationIsCustom() {
            return !!this.selectedDecoration?.presetId?.startsWith('custom:');
        },
        placedCount() {
            return this.scene.decorations.length;
        },
    },
    methods: {
        /** 瓦片预览:直接复用舞台的解析函数,预览和实物永远一致 */
        backgroundPreviewStyle(preset) {
            const isActive = preset.id === this.scene.background.presetId && !this.usingCustomImage;
            const tint = isActive ? this.scene.background.tint : preset.defaultTint;
            return resolveBackgroundStyle({ presetId: preset.id, tint }, null);
        },
        /**
         * 盘子预览:
         *   - 内置预设:走 resolvePlateStyle
         *   - 自定义盘子:直接 dataUrl 展示一张方图
         */
        platePreviewStyle(preset) {
            const isActive = preset.id === this.scene.plate.presetId && !this.usingCustomPlate;
            const tint = isActive ? this.scene.plate.tint : preset.defaultTint;
            return resolvePlateStyle({ presetId: preset.id, tint });
        },
        customPlateThumbStyle(record) {
            return {
                backgroundImage: `url("${record.dataUrl}")`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
            };
        },
        decorationSvg(presetId) {
            return getDecoration(presetId)?.svg || '';
        },
        decorationName(presetId) {
            return getDecoration(presetId)?.name || '';
        },
        onFileChange(event) {
            const file = event.target.files?.[0];
            if (file) this.$emit('upload-image', file);
            event.target.value = '';
        },
        onPlateFileChange(event) {
            const file = event.target.files?.[0];
            if (file) this.$emit('upload-plate', file);
            event.target.value = '';
        },
        onDecorationFileChange(event) {
            const file = event.target.files?.[0];
            if (file) this.$emit('add-custom-decoration', file);
            event.target.value = '';
        },
        /**
         * 「加装饰」瓦片点击。
         *   - 内置:直接 emit presetId
         *   - 自定义('custom:<id>'):同样 emit presetId,addDecoration 已经能识别
         */
        onPickDecoration(preset) {
            this.$emit('add-decoration', preset.id);
        },
        onPickCustomDecoration(customId) {
            this.$emit('add-decoration', `custom:${customId}`);
        },
        patchSelected(patch) {
            if (!this.selectedDecoration) return;
            this.$emit('update-decoration', { uid: this.selectedDecoration.uid, ...patch });
        },
        // 自定义盘子瓦片点选
        onPickPlateCustom(plateId) {
            this.$emit('set-plate-custom', plateId);
        },
        onRemovePlate(plateId) {
            this.$emit('remove-plate', plateId);
        },
        onRemoveCustomDeco(decoId) {
            this.$emit('remove-custom-decoration', decoId);
        },
    },
    template: `
        <div class="rx-panel rx-panel-decorate">
            <!-- 子 tab -->
            <div class="rx-subtabs" role="tablist">
                <button
                    v-for="tab in subTabs"
                    :key="tab.id"
                    type="button"
                    class="rx-subtab"
                    :class="{ 'is-active': tab.id === subTab }"
                    role="tab"
                    :aria-selected="String(tab.id === subTab)"
                    @click="$emit('change-sub-tab', tab.id)"
                >{{ tab.label }}</button>
            </div>

            <!-- ============ 背景 ============ -->
            <template v-if="subTab === 'bg'">
                <RxSection title="背景样式" hint="全部可改色">
                    <div class="rx-tile-grid">
                        <RxTile
                            v-for="preset in backgrounds"
                            :key="preset.id"
                            :label="preset.name"
                            :active="preset.id === scene.background.presetId && !usingCustomImage"
                            :aspect="0.72"
                            @select="$emit('set-bg-preset', preset.id)"
                        >
                            <span class="rx-bg-thumb" :style="backgroundPreviewStyle(preset)"></span>
                        </RxTile>
                    </div>
                </RxSection>

                <RxSection
                    v-if="!usingCustomImage"
                    title="背景颜色"
                >
                    <RxSwatches :value="scene.background.tint" @change="$emit('set-bg-tint', $event)" />
                </RxSection>

                <RxSection title="自己的图" hint="换成自己的照片">
                    <div class="rx-tile-grid">
                        <label class="rx-tile rx-tile-upload">
                            <span class="rx-tile-preview" style="aspect-ratio: 0.72">
                                <span class="rx-upload-plus">＋</span>
                            </span>
                            <span class="rx-tile-label">上传图片</span>
                            <input type="file" accept="image/*" @change="onFileChange" />
                        </label>

                        <RxTile
                            v-for="image in customImages"
                            :key="image.id"
                            :label="image.name"
                            :active="image.id === scene.background.customImageId"
                            :aspect="0.72"
                            @select="$emit('set-bg-image', image.id)"
                        >
                            <span
                                class="rx-bg-thumb"
                                :style="{ backgroundImage: 'url(' + image.dataUrl + ')', backgroundSize: 'cover', backgroundPosition: 'center' }"
                            ></span>
                        </RxTile>
                    </div>

                    <button
                        v-if="usingCustomImage"
                        type="button"
                        class="rx-btn rx-btn-ghost rx-btn-block"
                        @click="$emit('remove-image', scene.background.customImageId)"
                    >删掉这张图</button>
                </RxSection>

                <RxSection title="质感微调" hint="模糊 / 明度 / 饱和">
                    <RxSlider
                        label="模糊"
                        format="px"
                        :value="scene.background.blur"
                        :min="0" :max="20" :step="1"
                        @change="$emit('set-bg-filter', { blur: $event })"
                    />
                    <RxSlider
                        label="明度"
                        :value="scene.background.brightness"
                        :min="0.4" :max="1.6" :step="0.02"
                        @change="$emit('set-bg-filter', { brightness: $event })"
                    />
                    <RxSlider
                        label="饱和"
                        :value="scene.background.saturate"
                        :min="0" :max="2" :step="0.02"
                        @change="$emit('set-bg-filter', { saturate: $event })"
                    />
                </RxSection>
            </template>

            <!-- ============ 盘子 ============ -->
            <template v-else-if="subTab === 'plate'">
                <RxSection title="要不要盘子">
                    <RxToggle
                        label="显示盘子"
                        hint="关掉的话主体直接浮在背景上"
                        :value="scene.plate.enabled"
                        @change="$emit('set-plate-enabled', $event)"
                    />
                </RxSection>

                <template v-if="scene.plate.enabled">
                    <RxSection title="盘子形状" hint="不规则形状,全部可改色">
                        <div class="rx-tile-grid">
                            <RxTile
                                v-for="preset in plates"
                                :key="preset.id"
                                :label="preset.name"
                                :active="preset.id === scene.plate.presetId && !usingCustomPlate"
                                @select="$emit('set-plate-preset', preset.id)"
                            >
                                <span class="rx-plate-thumb" :style="platePreviewStyle(preset)"></span>
                            </RxTile>
                        </div>
                    </RxSection>

                    <RxSection
                        v-if="!usingCustomPlate"
                        title="盘子颜色"
                    >
                        <RxSwatches :value="scene.plate.tint" @change="$emit('set-plate-tint', $event)" />
                    </RxSection>

                    <!-- ★ 自定义盘子 -->
                    <RxSection title="自己的盘子" hint="PNG / JPG / SVG">
                        <div class="rx-tile-grid">
                            <label class="rx-tile rx-tile-upload">
                                <span class="rx-tile-preview" style="aspect-ratio: 1">
                                    <span class="rx-upload-plus">＋</span>
                                </span>
                                <span class="rx-tile-label">上传盘子</span>
                                <input type="file" accept="image/*" @change="onPlateFileChange" />
                            </label>

                            <RxTile
                                v-for="plate in customPlates"
                                :key="plate.id"
                                :label="plate.name"
                                :active="plate.id === scene.plate.customId"
                                @select="onPickPlateCustom(plate.id)"
                            >
                                <span class="rx-plate-thumb" :style="customPlateThumbStyle(plate)"></span>
                            </RxTile>
                        </div>

                        <button
                            v-if="usingCustomPlate"
                            type="button"
                            class="rx-btn rx-btn-ghost rx-btn-block"
                            @click="onRemovePlate(scene.plate.customId)"
                        >删掉这个盘子</button>
                    </RxSection>

                    <RxSection title="位置与大小">
                        <RxSlider
                            label="大小"
                            :value="scene.plate.scale"
                            :min="0.6" :max="1.4" :step="0.02"
                            @change="$emit('set-plate-transform', { scale: $event })"
                        />
                        <RxSlider
                            label="左右"
                            format="px"
                            :value="scene.plate.offsetX"
                            :min="-40" :max="40" :step="1"
                            @change="$emit('set-plate-transform', { offsetX: $event })"
                        />
                        <RxSlider
                            label="上下"
                            format="px"
                            :value="scene.plate.offsetY"
                            :min="-40" :max="40" :step="1"
                            @change="$emit('set-plate-transform', { offsetY: $event })"
                        />
                    </RxSection>
                </template>
            </template>

            <!-- ============ 装饰 ============ -->
            <template v-else>
                <RxSection title="加装饰" :hint="'已摆 ' + placedCount + ' 个'">
                    <div class="rx-subtabs rx-subtabs-mini">
                        <button
                            v-for="group in allDecorationGroups"
                            :key="group.id"
                            type="button"
                            class="rx-subtab"
                            :class="{ 'is-active': group.id === activeDecoGroup }"
                            @click="activeDecoGroup = group.id"
                        >{{ group.name }}</button>
                    </div>

                    <div class="rx-tile-grid">
                        <!-- 「我的贴纸」分组里第一颗永远是个上传按钮,固定在最前 -->
                        <label
                            v-if="activeDecoGroup === 'custom'"
                            class="rx-tile rx-tile-upload"
                        >
                            <span class="rx-tile-preview" style="aspect-ratio: 1">
                                <span class="rx-upload-plus">＋</span>
                            </span>
                            <span class="rx-tile-label">上传贴纸</span>
                            <input type="file" accept="image/*" @change="onDecorationFileChange" />
                        </label>

                        <RxTile
                            v-for="preset in groupedDecorations"
                            :key="preset.id"
                            :label="preset.name"
                            @select="preset.custom ? onPickCustomDecoration(preset.id.replace('custom:', '')) : onPickDecoration(preset)"
                        >
                            <span
                                v-if="preset.custom"
                                class="rx-deco-thumb"
                                :style="{
                                    backgroundImage: 'url(' + preset.dataUrl + ')',
                                    backgroundSize: 'contain',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                }"
                            ></span>
                            <span
                                v-else
                                class="rx-deco-thumb"
                                :style="{ color: preset.defaultTint }"
                                v-html="preset.svg"
                            ></span>
                        </RxTile>
                    </div>

                    <p
                        v-if="activeDecoGroup === 'custom' && !customDecorations.length"
                        class="rx-hint-text"
                    >还没传过贴纸。点上面的「＋」传一张 PNG（建议透明底），就能摆到舞台上了。</p>
                </RxSection>

                <!-- ★ 自定义贴纸管理:删除上传过的贴纸 -->
                <RxSection
                    v-if="customDecorations.length"
                    title="我的贴纸库"
                    :hint="customDecorations.length + ' 张'"
                >
                    <ul class="rx-sound-list">
                        <li
                            v-for="deco in customDecorations"
                            :key="deco.id"
                            class="rx-sound-row"
                        >
                            <span class="rx-sound-row-main">
                                <span
                                    class="rx-deco-thumb"
                                    :style="{
                                        width: '32px',
                                        height: '32px',
                                        backgroundImage: 'url(' + deco.dataUrl + ')',
                                        backgroundSize: 'contain',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'center',
                                        marginRight: '4px',
                                    }"
                                ></span>
                                <span class="rx-sound-row-name">{{ deco.name }}</span>
                            </span>
                            <button
                                type="button"
                                class="rx-sound-row-del"
                                aria-label="删除贴纸"
                                @click="onRemoveCustomDeco(deco.id)"
                            >${ICON_CLOSE}</button>
                        </li>
                    </ul>
                </RxSection>

                <RxSection
                    v-if="selectedDecoration"
                    :title="'调整「' + selectedDecorationName + '」'"
                    hint="在舞台上直接拖可以换位置"
                >
                    <!-- 自定义贴纸:不染色,跳过 tint 控件 -->
                    <RxSwatches
                        v-if="!selectedDecorationIsCustom"
                        :value="selectedDecoration.tint"
                        @change="patchSelected({ tint: $event })"
                    />
                    <p v-else class="rx-hint-text">自定义贴纸保持原色,不能改色。</p>
                    <RxSlider
                        label="大小"
                        :value="selectedDecoration.scale"
                        :min="0.3" :max="2.4" :step="0.05"
                        @change="patchSelected({ scale: $event })"
                    />
                    <RxSlider
                        label="旋转"
                        format="raw"
                        :value="selectedDecoration.rotate"
                        :min="-180" :max="180" :step="1"
                        @change="patchSelected({ rotate: $event })"
                    />
                    <div class="rx-btn-row">
                        <button
                            type="button"
                            class="rx-btn rx-btn-ghost"
                            @click="patchSelected({ flip: !selectedDecoration.flip })"
                        >左右翻转</button>
                        <button
                            type="button"
                            class="rx-btn rx-btn-danger"
                            @click="$emit('remove-decoration', selectedDecoration.uid)"
                        >移除</button>
                    </div>
                </RxSection>

                <RxSection v-else-if="placedCount" title="调整装饰位置">
                    <p class="rx-hint-text">点「编辑装饰位置」收起面板,直接拖动装饰换位置,点装饰再改颜色 / 大小 / 角度。</p>
                    <button
                        type="button"
                        class="rx-btn rx-btn-primary rx-btn-block"
                        @click="$emit('enter-deco-edit')"
                    >编辑装饰位置</button>
                </RxSection>

                <RxSection v-if="placedCount" title="清空">
                    <button
                        type="button"
                        class="rx-btn rx-btn-danger rx-btn-block"
                        @click="$emit('clear-decorations')"
                    >移除全部装饰</button>
                </RxSection>
            </template>
        </div>
    `,
};
