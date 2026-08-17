/**
 * 气泡机 · 形状页(SVG 工作台 + 形状库)
 *
 * ── 这一页合并了原来那个独立的「SVG 编辑器」 ──────────────────────
 *
 * 原来是一个单独的网页(`QAQ/代制作软件/svg预览.html`),做完的图形要手动复制
 * 代码再粘到气泡编辑器里。合进来之后:画完点一下就能装到尾巴上。
 *
 * ── 修掉的原型问题 ────────────────────────────────────────────────
 *
 * 1. **旋转中心算错**。原型 `viewBox` 缺失时退回 `width/height`,两者都没有时
 *    `cx/cy` 保持 0,图形绕左上角转,直接转出画布。现在统一走
 *    `readViewBox()`:没有 viewBox 就从 width/height 推,再没有给 24×24。
 * 2. **镜像与旋转的顺序不定**。原型把 `rotate` 和 `translate+scale` 按
 *    「有没有值」的顺序 push 进数组,于是「先转再镜像」和「先镜像再转」
 *    出来的结果不同,而界面上完全看不出这个顺序。现在固定为「先镜像后旋转」。
 * 3. **没有任何消毒**。原型把用户粘进来的 SVG 直接 `innerHTML`,
 *    `<svg><script>` 是会执行的。现在一律走白名单重建(`sanitizeSvg`)。
 * 4. **收藏没有名字**。原型的收藏项只有一张缩略图,存到第二十个就完全分不清。
 * 5. **删除后分页会停在空页**。原型删完只在「当前页 > 总页数」时才回退,
 *    删掉第 1 页最后一项时会留在一个什么都没有的第 1 页。这里改成不分页 ——
 *    形状库封顶 60 个,一屏网格滚动就够,分页本来就是多余的复杂度。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { CONTENT_DEFAULTS } from '../services/presets.js';
import { copyText } from '../utils.js';
import { SVG_MAX_CHARS } from '../constants.js';

export const BbPanelShape = {
    name: 'BbPanelShape',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    data() {
        return { SVG_MAX_CHARS };
    },
    computed: {
        state() { return store.getState(); },
        svg() { return this.state.svg; },
        result() { return store.getSvgResult(); },
        shapes() { return store.getShapes(); },
        hasSource() { return Boolean(String(this.svg.source || '').trim()); },
        activeTail() { return store.getActiveTail(); },
        strokeOn() { return Boolean(String(this.svg.stroke || '').trim()); },
        fillOn() { return Boolean(String(this.svg.fill || '').trim()); },
    },
    methods: {
        set(patch) { store.updateSvg(patch); },
        toggleFill() { this.set({ fill: this.fillOn ? '' : CONTENT_DEFAULTS.svgFill }); },
        toggleStroke() { this.set({ stroke: this.strokeOn ? '' : CONTENT_DEFAULTS.svgStroke }); },
        resetTransform() { store.resetSvgTransform(); },

        onSave() {
            if (!this.result) { this.$emit('notify', '还没有可以保存的图形'); return; }
            store.openModal('shape-name', { svg: this.result });
        },
        onApply() {
            if (!this.result) { this.$emit('notify', '先粘一段 SVG 进来'); return; }
            const shape = store.saveShape(`形状 ${this.shapes.length + 1}`);
            if (!shape) return;
            const ok = store.applyShapeToTail(shape.id);
            this.$emit('notify', ok ? '已存进形状库,并装到当前尾巴上' : '已存进形状库。回「设计」页加一条尾巴就能用');
        },
        async onCopy() {
            const ok = await copyText(this.result);
            this.$emit('notify', ok ? '已复制处理后的 SVG' : '复制失败,浏览器不允许');
        },
        onLoad(shapeId) {
            store.loadShapeToStudio(shapeId);
            this.$emit('notify', '已载入,改完记得再存一次');
        },
        onUse(shapeId) {
            const ok = store.applyShapeToTail(shapeId);
            this.$emit('notify', ok ? '已装到当前尾巴上' : '先去「设计 → 尾巴」加一条尾巴');
        },
        onRename(shape) { store.openModal('shape-rename', { id: shape.id, name: shape.name }); },
        onDelete(shape) { store.openModal('confirm-delete-shape', { id: shape.id, name: shape.name }); },
        clearSource() { this.set({ source: '' }); },
    },
    template: `
        <div class="bb-panel-body">
            <BbSection title="粘一段 SVG" icon-name="upload">
                <BbTextarea
                    mono
                    :rows="5"
                    :maxlength="SVG_MAX_CHARS"
                    :model-value="svg.source"
                    placeholder="把 <svg …>…</svg> 整段粘进来"
                    @update:model-value="set({ source: $event })"
                />
                <p v-if="svg.error" class="bb-note is-danger">{{ svg.error }}</p>
                <p v-else class="bb-note">粘进来的图形会先消毒再显示:脚本、外链、事件属性一律去掉,只留画图用的标签。</p>
                <BbButton v-if="hasSource" size="sm" variant="quiet" icon-name="close" @click="clearSource">清空</BbButton>
            </BbSection>

            <BbSection title="预览" icon-name="eye">
                <div class="bb-svg-stage">
                    <div v-if="result" class="bb-svg-art" v-html="result"></div>
                    <p v-else class="bb-svg-hint">上面粘一段 SVG,这里就会显示</p>
                </div>
            </BbSection>

            <BbSection title="上色" icon-name="palette">
                <BbSwitch label="填充" :model-value="fillOn" @update:model-value="toggleFill" />
                <BbColorRow v-if="fillOn" label="填充色" :model-value="svg.fill" @update:model-value="set({ fill: $event })" />

                <BbSwitch label="描边" :model-value="strokeOn" @update:model-value="toggleStroke" />
                <template v-if="strokeOn">
                    <BbColorRow label="描边色" :model-value="svg.stroke" @update:model-value="set({ stroke: $event })" />
                    <BbSlider label="描边粗细" suffix="px" :min="0" :max="12" :step="0.5" :model-value="svg.strokeWidth" @update:model-value="set({ strokeWidth: $event })" />
                </template>

                <BbSlider label="不透明度" suffix="%" :min="0" :max="100" :model-value="svg.opacity" @update:model-value="set({ opacity: $event })" />
                <p class="bb-note">上色会把图形自带的 fill / stroke 全部换掉 —— 多色插画粘进来会变成单色,这是有意的:尾巴需要能跟着气泡换色。</p>
            </BbSection>

            <BbSection title="旋转与翻转" icon-name="rotate">
                <BbSlider label="旋转" suffix="°" :min="-180" :max="180" :model-value="svg.rotation" @update:model-value="set({ rotation: $event })" />
                <div class="bb-row-between">
                    <BbButton size="sm" :variant="svg.flipX ? 'ghost' : 'quiet'" icon-name="flip" @click="set({ flipX: !svg.flipX })">左右镜像</BbButton>
                    <BbButton size="sm" :variant="svg.flipY ? 'ghost' : 'quiet'" icon-name="flip" @click="set({ flipY: !svg.flipY })">上下镜像</BbButton>
                    <BbButton size="sm" variant="quiet" icon-name="refresh" @click="resetTransform">复位</BbButton>
                </div>
                <p class="bb-note">旋转绕图形自己的中心(按 viewBox 算)。顺序固定是「先镜像、后旋转」,所以两个开关怎么点结果都一样。</p>
            </BbSection>

            <BbSection title="拿去用" icon-name="check">
                <div class="bb-stack">
                    <BbButton variant="primary" block icon-name="tail" :disabled="!result" @click="onApply">
                        {{ activeTail ? '存进库并装到当前尾巴' : '存进库' }}
                    </BbButton>
                    <div class="bb-row-between">
                        <BbButton size="sm" variant="line" icon-name="save" :disabled="!result" @click="onSave">存进库并起名</BbButton>
                        <BbButton size="sm" variant="quiet" icon-name="copy" :disabled="!result" @click="onCopy">复制 SVG</BbButton>
                    </div>
                </div>
            </BbSection>

            <BbSection title="形状库" icon-name="grid" :hint="shapes.length + ' / 60'">
                <BbEmpty v-if="!shapes.length" icon-name="shape" text="还没有存过形状" hint="上面粘一段 SVG,调好之后点「存进库」" />
                <div v-else class="bb-shape-grid">
                    <div v-for="s in shapes" :key="s.id" class="bb-shape-card">
                        <div class="bb-shape-card-art" v-html="s.svg"></div>
                        <span class="bb-shape-card-name">{{ s.name }}</span>
                        <div class="bb-shape-card-acts">
                            <button type="button" class="bb-mini" @click="onUse(s.id)">用</button>
                            <button type="button" class="bb-mini" @click="onLoad(s.id)">改</button>
                            <button type="button" class="bb-mini" @click="onRename(s)">名</button>
                            <button type="button" class="bb-mini is-danger" @click="onDelete(s)">删</button>
                        </div>
                    </div>
                </div>
            </BbSection>
        </div>
    `,
};

export const SHAPE_COMPONENTS = { BbPanelShape };
