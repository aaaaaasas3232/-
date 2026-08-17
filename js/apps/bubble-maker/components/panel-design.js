/**
 * 气泡机 · 设计页
 *
 * 五个折叠区:底色 / 文字 / 形状与间距 / 描边与阴影 / 尾巴。
 *
 * ── 相对参考软件的取舍 ────────────────────────────────────────────
 *
 * 删掉的:
 *   - **时间戳、头像** —— 那是「一条消息」的排版,不是气泡样式。
 *     留在这里的后果是同一套气泡换个 App 就用不了(用户明确要求挪走)。
 *   - **「同步到 AI 气泡」按钮** —— 参考软件有两套完全独立的面板,
 *     所以需要一个同步按钮把改动搬过去。这里一次只编辑一个气泡,
 *     成对使用是在情景聊天里选左右两套,不需要同步。
 *   - **按字数换行(`wrapMode: 'chars'`)** —— 它的实现是给容器算一个 `ch` 宽度,
 *     中英混排时完全对不上;而「最大宽度」已经能表达同一个诉求。
 *
 * 改掉的:
 *   - 尾巴定位从「x / y 两个绝对偏移」换成「贴哪条边 + 沿边走多远 + 外移多少」。
 *     参考软件那套在改圆角或内边距之后尾巴会跑掉,得回头再调一次 x/y。
 *   - 每个滑块右边的数值**可以直接输入**。这类工具用户心里多半有个准数,
 *     在滑轨上蹭到 18 是件很折磨的事。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { BubbleView } from '@/src/core/components/bubble-view.js';
import {
    DESIGN_SECTIONS, BORDER_STYLES, TAIL_ANCHORS, TEXT_ALIGNS, RADIUS_MODES,
} from '../constants.js';
import { TAIL_SHAPES, TAIL_SHAPE_IDS, tailSvg, exportBubbleCss } from '@/src/core/bubble-style.js';
import { asArray, copyText } from '../utils.js';

// ============================================================
// 底色
// ============================================================

const SecFill = {
    name: 'BbSecFill',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    computed: {
        b() { return store.getActive(); },
        isGradient() { return this.b?.bgMode === 'gradient'; },
        stops() { return asArray(this.b?.gradientStops); },
    },
    methods: {
        set(patch) { store.updateBubble(patch); },
        addStop() { store.addGradientStop(); },
        setStop(id, patch) { store.updateGradientStop(id, patch); },
        delStop(id) { store.removeGradientStop(id); },
    },
    template: `
        <div class="bb-stack">
            <BbSegmented
                :model-value="b.bgMode"
                :options="[{ value: 'solid', label: '纯色' }, { value: 'gradient', label: '渐变' }]"
                @update:model-value="set({ bgMode: $event })"
            />

            <template v-if="!isGradient">
                <BbColorRow label="底色" :model-value="b.bgColor" @update:model-value="set({ bgColor: $event })" />
                <BbSlider label="不透明度" suffix="%" :min="0" :max="100" :model-value="b.bgOpacity" @update:model-value="set({ bgOpacity: $event })" />
            </template>

            <template v-else>
                <BbSegmented
                    :model-value="b.gradientType"
                    :options="[{ value: 'linear', label: '线性' }, { value: 'radial', label: '径向' }]"
                    @update:model-value="set({ gradientType: $event })"
                />
                <BbSlider
                    v-if="b.gradientType === 'linear'"
                    label="角度" suffix="°" :min="0" :max="360"
                    :model-value="b.gradientAngle" @update:model-value="set({ gradientAngle: $event })"
                />
                <template v-else>
                    <BbSlider label="圆心横向" suffix="%" :min="0" :max="100" compact :model-value="b.gradientCenterX" @update:model-value="set({ gradientCenterX: $event })" />
                    <BbSlider label="圆心纵向" suffix="%" :min="0" :max="100" compact :model-value="b.gradientCenterY" @update:model-value="set({ gradientCenterY: $event })" />
                </template>

                <div class="bb-stops">
                    <div v-for="(stop, i) in stops" :key="stop.id" class="bb-stop">
                        <BbColorRow
                            :label="'色标 ' + (i + 1)"
                            :model-value="stop.color"
                            @update:model-value="setStop(stop.id, { color: $event })"
                        />
                        <div class="bb-stop-row">
                            <BbSlider label="位置" suffix="%" compact :min="0" :max="100" :model-value="stop.position" @update:model-value="setStop(stop.id, { position: $event })" />
                            <BbButton size="sm" variant="quiet" icon-only icon-name="trash" label="删除色标" @click="delStop(stop.id)" />
                        </div>
                    </div>
                    <BbButton size="sm" variant="line" block icon-name="plus" @click="addStop">加一个色标</BbButton>
                </div>
                <BbSlider label="整体不透明度" suffix="%" :min="0" :max="100" :model-value="b.bgOpacity" @update:model-value="set({ bgOpacity: $event })" />
            </template>

            <BbSlider
                label="毛玻璃"
                suffix="px"
                :min="0" :max="30"
                :model-value="b.blur"
                @update:model-value="set({ blur: $event })"
            />
            <p class="bb-note">毛玻璃要底色半透明才看得出来。底色不透明度拉到 100% 时它没有效果。</p>
        </div>
    `,
};

// ============================================================
// 文字
// ============================================================

const SecText = {
    name: 'BbSecText',
    components: { ...SHARED_COMPONENTS },
    data() { return { TEXT_ALIGNS }; },
    computed: {
        b() { return store.getActive(); },
    },
    methods: {
        set(patch) { store.updateBubble(patch); },
    },
    template: `
        <div class="bb-stack">
            <BbColorRow label="文字颜色" :model-value="b.textColor" @update:model-value="set({ textColor: $event })" />
            <BbSlider label="字号" suffix="px" :min="9" :max="28" :model-value="b.fontSize" @update:model-value="set({ fontSize: $event })" />
            <BbSlider label="字重" :min="300" :max="800" :step="100" :model-value="b.fontWeight" @update:model-value="set({ fontWeight: $event })" />
            <BbSlider label="行高" :min="1" :max="2.6" :step="0.05" :model-value="b.lineHeight" @update:model-value="set({ lineHeight: $event })" />
            <BbSlider label="字距" suffix="px" :min="-1" :max="6" :step="0.5" :model-value="b.letterSpacing" @update:model-value="set({ letterSpacing: $event })" />
            <BbField label="对齐">
                <BbSegmented :model-value="b.textAlign" :options="TEXT_ALIGNS" @update:model-value="set({ textAlign: $event })" />
            </BbField>
        </div>
    `,
};

// ============================================================
// 形状与间距
// ============================================================

const SecBox = {
    name: 'BbSecBox',
    components: { ...SHARED_COMPONENTS },
    data() { return { RADIUS_MODES }; },
    computed: {
        b() { return store.getActive(); },
        settings() { return store.getSettings(); },
        mode() { return this.settings.radiusMode; },
    },
    methods: {
        set(patch) { store.updateBubble(patch); },
        setMode(m) { store.updateSettings({ radiusMode: m }); },
        setRadius(corner, v) { store.setRadius(corner, v, this.mode); },
    },
    template: `
        <div class="bb-stack">
            <BbSlider label="上下内边距" suffix="px" :min="0" :max="32" :model-value="b.paddingY" @update:model-value="set({ paddingY: $event })" />
            <BbSlider label="左右内边距" suffix="px" :min="0" :max="40" :model-value="b.paddingX" @update:model-value="set({ paddingX: $event })" />
            <BbSlider label="最大宽度" suffix="%" :min="30" :max="100" :model-value="b.maxWidth" @update:model-value="set({ maxWidth: $event })" />

            <BbField label="圆角" hint="「聊天角」会自动把靠说话人那一侧的下角收小">
                <BbSegmented :model-value="mode" :options="RADIUS_MODES" @update:model-value="setMode($event)" />
            </BbField>

            <BbSlider
                v-if="mode !== 'free'"
                label="圆角大小" suffix="px" :min="0" :max="40"
                :model-value="b.radiusTL"
                @update:model-value="setRadius('radiusTL', $event)"
            />
            <div v-else class="bb-corner-grid">
                <BbSlider label="左上" suffix="px" compact :min="0" :max="60" :model-value="b.radiusTL" @update:model-value="setRadius('radiusTL', $event)" />
                <BbSlider label="右上" suffix="px" compact :min="0" :max="60" :model-value="b.radiusTR" @update:model-value="setRadius('radiusTR', $event)" />
                <BbSlider label="左下" suffix="px" compact :min="0" :max="60" :model-value="b.radiusBL" @update:model-value="setRadius('radiusBL', $event)" />
                <BbSlider label="右下" suffix="px" compact :min="0" :max="60" :model-value="b.radiusBR" @update:model-value="setRadius('radiusBR', $event)" />
            </div>
        </div>
    `,
};

// ============================================================
// 描边与阴影
// ============================================================

const SecFrame = {
    name: 'BbSecFrame',
    components: { ...SHARED_COMPONENTS },
    data() { return { BORDER_STYLES }; },
    computed: {
        b() { return store.getActive(); },
    },
    methods: {
        set(patch) { store.updateBubble(patch); },
    },
    template: `
        <div class="bb-stack">
            <p class="bb-sub-title">边框</p>
            <BbSlider label="粗细" suffix="px" :min="0" :max="8" :step="0.5" :model-value="b.borderWidth" @update:model-value="set({ borderWidth: $event })" />
            <template v-if="b.borderWidth > 0">
                <BbColorRow label="边框颜色" :model-value="b.borderColor" @update:model-value="set({ borderColor: $event })" />
                <BbSlider label="边框不透明度" suffix="%" :min="0" :max="100" compact :model-value="b.borderOpacity" @update:model-value="set({ borderOpacity: $event })" />
                <BbField label="线型">
                    <BbSegmented :model-value="b.borderStyle" :options="BORDER_STYLES" @update:model-value="set({ borderStyle: $event })" />
                </BbField>
            </template>

            <div class="bb-divider"></div>

            <p class="bb-sub-title">外描边</p>
            <BbSlider label="粗细" suffix="px" :min="0" :max="8" :step="0.5" :model-value="b.outlineWidth" @update:model-value="set({ outlineWidth: $event })" />
            <template v-if="b.outlineWidth > 0">
                <BbColorRow label="外描边颜色" :model-value="b.outlineColor" @update:model-value="set({ outlineColor: $event })" />
                <BbSlider label="外描边不透明度" suffix="%" :min="0" :max="100" compact :model-value="b.outlineOpacity" @update:model-value="set({ outlineOpacity: $event })" />
            </template>
            <p class="bb-note">外描边画在边框外侧,不占位置。它跟着圆角走 —— 用 CSS 的 outline 会在圆角气泡上画出一个方框。</p>

            <div class="bb-divider"></div>

            <p class="bb-sub-title">阴影</p>
            <BbSlider label="不透明度" suffix="%" :min="0" :max="100" :model-value="b.shadowOpacity" @update:model-value="set({ shadowOpacity: $event })" />
            <template v-if="b.shadowOpacity > 0">
                <BbColorRow label="阴影颜色" :model-value="b.shadowColor" @update:model-value="set({ shadowColor: $event })" />
                <div class="bb-corner-grid">
                    <BbSlider label="横向" suffix="px" compact :min="-20" :max="20" :model-value="b.shadowX" @update:model-value="set({ shadowX: $event })" />
                    <BbSlider label="纵向" suffix="px" compact :min="-20" :max="20" :model-value="b.shadowY" @update:model-value="set({ shadowY: $event })" />
                    <BbSlider label="模糊" suffix="px" compact :min="0" :max="40" :model-value="b.shadowBlur" @update:model-value="set({ shadowBlur: $event })" />
                    <BbSlider label="扩散" suffix="px" compact :min="-10" :max="10" :model-value="b.shadowSpread" @update:model-value="set({ shadowSpread: $event })" />
                </div>
                <BbSwitch label="内阴影" hint="画在气泡内侧,做凹陷感" :model-value="b.shadowInset" @update:model-value="set({ shadowInset: $event })" />
                <p class="bb-note">模糊设 0、纵向给几像素,就是动森那种硬边落影。</p>
            </template>
        </div>
    `,
};

// ============================================================
// 尾巴
// ============================================================

const SecTail = {
    name: 'BbSecTail',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    data() {
        return {
            TAIL_ANCHORS,
            shapeOptions: TAIL_SHAPE_IDS.map((id) => ({ id, label: TAIL_SHAPES[id].label, svg: TAIL_SHAPES[id].svg })),
        };
    },
    computed: {
        b() { return store.getActive(); },
        tails() { return asArray(this.b?.tails); },
        activeId() { return store.getState().activeTailId; },
        tail() { return store.getActiveTail(); },
        shapes() { return store.getShapes(); },
        /** 当前尾巴用的是库里的形状还是内置形状 */
        usingLibrary() { return Boolean(this.tail?.shapeId); },
    },
    methods: {
        add(shape) { store.addTail({ shape }); },
        pick(id) { store.selectTail(id); },
        set(patch) { if (this.tail) store.updateTail(this.tail.id, patch); },
        del(id) { store.removeTail(id); },
        thumb(t) { return tailSvg(t, this.shapes); },
        useBuiltin(shape) { this.set({ shape, shapeId: '', svg: '' }); },
        useLibrary(shapeId) { this.set({ shapeId, svg: '' }); },
        toStudio() { store.setTab('shape'); },
    },
    template: `
        <div class="bb-stack">
            <BbField label="加一条尾巴">
                <div class="bb-shape-picks">
                    <button
                        v-for="s in shapeOptions"
                        :key="s.id"
                        type="button"
                        class="bb-shape-pick"
                        :title="s.label"
                        :aria-label="'加一条' + s.label + '尾巴'"
                        @click="add(s.id)"
                    ><span class="bb-shape-pick-art" v-html="s.svg"></span></button>
                </div>
            </BbField>

            <BbEmpty v-if="!tails.length" icon-name="tail" text="这个气泡还没有尾巴" hint="上面点一个形状就加上了;不加也完全没问题" />

            <template v-else>
                <div class="bb-tail-chips">
                    <button
                        v-for="(t, i) in tails"
                        :key="t.id"
                        type="button"
                        class="bb-tail-chip"
                        :class="{ 'is-active': t.id === activeId, 'is-off': !t.enabled }"
                        @click="pick(t.id)"
                    >
                        <span class="bb-tail-chip-art" v-html="thumb(t)"></span>
                        <span class="bb-tail-chip-no">{{ i + 1 }}</span>
                    </button>
                </div>

                <template v-if="tail">
                    <div class="bb-tail-editor">
                        <div class="bb-row-between">
                            <BbSwitch label="显示这条" :model-value="tail.enabled" @update:model-value="set({ enabled: $event })" />
                            <BbButton size="sm" variant="danger" icon-only icon-name="trash" label="删除这条尾巴" @click="del(tail.id)" />
                        </div>

                        <BbField label="形状">
                            <div class="bb-shape-picks">
                                <button
                                    v-for="s in shapeOptions"
                                    :key="s.id"
                                    type="button"
                                    class="bb-shape-pick"
                                    :class="{ 'is-active': !usingLibrary && tail.shape === s.id }"
                                    :title="s.label"
                                    :aria-label="s.label"
                                    @click="useBuiltin(s.id)"
                                ><span class="bb-shape-pick-art" v-html="s.svg"></span></button>
                            </div>
                        </BbField>

                        <BbField v-if="shapes.length" label="我画的形状">
                            <div class="bb-shape-picks">
                                <button
                                    v-for="s in shapes"
                                    :key="s.id"
                                    type="button"
                                    class="bb-shape-pick"
                                    :class="{ 'is-active': tail.shapeId === s.id }"
                                    :title="s.name"
                                    :aria-label="s.name"
                                    @click="useLibrary(s.id)"
                                ><span class="bb-shape-pick-art" v-html="s.svg"></span></button>
                            </div>
                        </BbField>
                        <BbButton v-else size="sm" variant="line" block icon-name="shape" @click="toStudio">去「形状」画一个自己的</BbButton>

                        <BbField label="贴哪条边">
                            <BbSegmented :model-value="tail.anchor" :options="TAIL_ANCHORS" @update:model-value="set({ anchor: $event })" />
                        </BbField>

                        <BbSlider label="沿边位置" suffix="%" :min="0" :max="100" :model-value="tail.along" @update:model-value="set({ along: $event })" />
                        <BbSlider label="外移" suffix="px" :min="-30" :max="30" :model-value="tail.offset" @update:model-value="set({ offset: $event })" />
                        <BbSlider label="大小" suffix="px" :min="6" :max="60" :model-value="tail.size" @update:model-value="set({ size: $event })" />
                        <BbSlider label="旋转" suffix="°" :min="-180" :max="180" :model-value="tail.rotation" @update:model-value="set({ rotation: $event })" />

                        <div class="bb-row-between">
                            <BbButton size="sm" :variant="tail.flipX ? 'ghost' : 'quiet'" icon-name="flip" @click="set({ flipX: !tail.flipX })">左右翻</BbButton>
                            <BbButton size="sm" :variant="tail.flipY ? 'ghost' : 'quiet'" icon-name="flip" @click="set({ flipY: !tail.flipY })">上下翻</BbButton>
                        </div>

                        <p class="bb-note">描边尾巴在气泡下、填充尾巴在气泡上 —— 气泡内那截描边自动被气泡盖掉,看起来像从气泡里长出来(iOS 短信风格)。</p>

                        <BbField label="颜色" hint="留空就跟着气泡底色走 —— 换底色时尾巴自动跟上">
                            <div class="bb-row-between">
                                <BbInput :model-value="tail.color" placeholder="跟随气泡" @update:model-value="set({ color: $event })" />
                                <BbButton v-if="tail.color" size="sm" variant="quiet" icon-only icon-name="refresh" label="跟随气泡" @click="set({ color: '' })" />
                            </div>
                        </BbField>
                        <BbSlider label="不透明度" suffix="%" :min="0" :max="100" compact :model-value="tail.opacity" @update:model-value="set({ opacity: $event })" />

                        <BbSlider label="描边粗细" suffix="px" :min="0" :max="6" :step="0.5" compact :model-value="tail.strokeWidth" @update:model-value="set({ strokeWidth: $event })" />
                        <BbColorRow v-if="tail.strokeWidth > 0" label="描边颜色" :model-value="tail.strokeColor" @update:model-value="set({ strokeColor: $event })" />
                    </div>
                </template>
            </template>
        </div>
    `,
};

// ============================================================
// 设计页外壳
// ============================================================

export const BbPanelDesign = {
    name: 'BbPanelDesign',
    components: {
        ...SHARED_COMPONENTS, BubbleView,
        BbSecFill: SecFill, BbSecText: SecText, BbSecBox: SecBox, BbSecFrame: SecFrame, BbSecTail: SecTail,
    },
    emits: ['notify'],
    data() { return { DESIGN_SECTIONS }; },
    computed: {
        state() { return store.getState(); },
        b() { return store.getActive(); },
        open() { return this.state.openSection; },
        tailCount() { return asArray(this.b?.tails).filter((t) => t.enabled).length; },
    },
    methods: {
        toggle(id) { store.setSection(id); },
        hintOf(id) {
            if (!this.b) return '';
            if (id === 'fill') return this.b.bgMode === 'gradient' ? '渐变' : '纯色';
            if (id === 'text') return `${this.b.fontSize}px`;
            if (id === 'box') return `圆角 ${this.b.radiusTL}`;
            if (id === 'frame') return this.b.borderWidth > 0 ? `边框 ${this.b.borderWidth}px` : '无边框';
            if (id === 'tail') return this.tailCount ? `${this.tailCount} 条` : '无';
            return '';
        },
        rename() { store.openModal('rename', { id: this.b.id, name: this.b.name }); },
        flip() { store.flipSide(); },
        async copyCss() {
            const ok = await copyText(exportBubbleCss(this.b));
            this.$emit('notify', ok ? '已复制这个气泡的 CSS' : '复制失败,浏览器不允许');
        },
    },
    template: `
        <div class="bb-panel-body">
            <BbEmpty v-if="!b" icon-name="bubble" text="气泡库是空的" hint="去「气泡库」新建一个,或者挑一套预设" />

            <template v-else>
                <div class="bb-title-row">
                    <button type="button" class="bb-title-main" @click="rename">
                        <span class="bb-title-name">{{ b.name }}</span>
                        <BbIcon name="edit" />
                    </button>
                    <BbButton size="sm" variant="quiet" icon-name="flip" @click="flip">
                        {{ b.side === 'right' ? '右侧' : '左侧' }}
                    </BbButton>
                    <BbButton size="sm" variant="quiet" icon-only icon-name="copy" label="复制 CSS" @click="copyCss" />
                </div>

                <BbSection
                    v-for="sec in DESIGN_SECTIONS"
                    :key="sec.id"
                    :title="sec.label"
                    :icon-name="sec.icon"
                    :hint="hintOf(sec.id)"
                    collapsible
                    :open="open === sec.id"
                    @toggle="toggle(sec.id)"
                >
                    <BbSecFill  v-if="sec.id === 'fill'" />
                    <BbSecText  v-else-if="sec.id === 'text'" />
                    <BbSecBox   v-else-if="sec.id === 'box'" />
                    <BbSecFrame v-else-if="sec.id === 'frame'" />
                    <BbSecTail  v-else-if="sec.id === 'tail'" @notify="$emit('notify', $event)" />
                </BbSection>
            </template>
        </div>
    `,
};

export const DESIGN_COMPONENTS = { BbPanelDesign };
