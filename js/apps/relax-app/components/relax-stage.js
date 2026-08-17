/**
 * relax-app / 舞台
 *
 * 层次(从下到上):
 *   1. 背景层    resolveBackgroundStyle()。filter 只作用在这一层,
 *                所以「背景模糊」不会把盘子和主体一起糊掉
 *   2. 盘子层    盘身 + 釉面高光 + 内圈(主体容器)。用户上传的盘子(customPlateUrl)
 *                会直接当背景图盖上去,绕过内置 preset 解析。
 *   3. 主体层    ToyHost(在盘子内圈里,或 fit:'stage' 时铺满舞台)
 *   4. 装饰层    可拖 / 可选中 / 有控制柄。自定义装饰('custom:<id>')用 <img>
 *                渲染,内置走 SVG。
 *
 * ★ 装饰坐标用 0~1 相对值(见 store.normalizeDecoration),换屏幕不跑位。
 *   拖拽时用 getBoundingClientRect 现算,不缓存 —— 面板弹出会改变舞台高度。
 *
 * ★ 舞台在「装扮」模式下才允许拖装饰(editable=true);
 *   玩的时候(舞台 tab)装饰是 pointer-events:none,免得挡住捏捏的手。
 */

import { resolveBackgroundStyle } from '../assets/backgrounds.js';
import { resolvePlateStyle, resolvePlateInnerStyle, resolvePlateGlaze, resolvePlateCenterStyle, getPlate } from '../assets/plates.js';
import { getDecoration } from '../assets/decorations.js';
import { getRelaxToy } from '../registry.js';
import * as store from '../store.js';
import { ToyHost } from './toy-host.js';
import { ICON_CLOSE } from './icons.js';

export const RelaxStage = {
    name: 'RelaxStage',
    components: { ToyHost },
    props: {
        scene: { type: Object, required: true },
        customImageUrl: { type: String, default: null },
        customPlateUrl: { type: String, default: null },
        /** 装饰是否可拖可选(装扮模式) */
        editable: { type: Boolean, default: false },
        selectedDecorationUid: { type: String, default: null },
        bridge: { type: Object, required: true },
    },
    emits: ['select-decoration', 'move-decoration', 'remove-decoration', 'commit-decoration'],
    data() {
        return {
            // 拖拽中的 uid —— 只用于加 class,坐标直接写回 store
            draggingUid: null,
        };
    },
    computed: {
        backgroundStyle() {
            return resolveBackgroundStyle(this.scene.background, this.customImageUrl);
        },
        plateVisible() {
            return this.scene.plate.enabled !== false;
        },
        /**
         * 盘子最终样式:
         *   - 用户上传了盘子(customPlateUrl 有值):直接当背景图盖一层,接管内置盘子样式
         *   - 否则走内置 preset 的解析函数
         */
        plateStyle() {
            if (this.customPlateUrl) {
                return {
                    backgroundImage: `url("${this.customPlateUrl}")`,
                    backgroundColor: 'transparent',
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    // 用户上传的图本身就是成品 → 不要外阴影 / 渐变,扁平贴上去
                    boxShadow: 'none',
                    borderRadius: '12%',
                };
            }
            return resolvePlateStyle(this.scene.plate);
        },
        /**
         * 釉面:用户上传的盘子不加釉面(图片本身就是成品)
         */
        plateGlazeStyle() {
            if (this.customPlateUrl) return null;
            return resolvePlateGlaze(this.scene.plate);
        },
        plateWrapStyle() {
            const plate = this.scene.plate;
            return {
                transform: `translate(${plate.offsetX}px, ${plate.offsetY}px) scale(${plate.scale})`,
            };
        },
        /**
         * 盘子中圈 = 主体的容器。
         * ★ 自定义盘子必须短路:内置 preset 的中圈会带自己的背景色
         *   (比如方瓷砖盘 inner.tint 是不透明的),直接盖在用户上传的盘子图中间,
         *   看起来就是「自定义盘子没生效」。用户的图本身就是成品,
         *   中圈只需要做一个居中的内缩容器,不画任何东西。
         */
        plateInnerStyle() {
            if (this.customPlateUrl) return { inset: '16%', borderRadius: '10%' };
            return resolvePlateInnerStyle(this.scene.plate);
        },
        plateShadowStyle() {
            // 自定义盘子:不要落影
            if (this.customPlateUrl) return { display: 'none' };
            // 盘子底下的落影,跟着盘子形状走;flat 盘子不画落影
            const preset = getPlate(this.scene.plate.presetId);
            return { borderRadius: preset.clip ? '46%' : preset.radius };
        },
        plateCenterStyle() {
            // 自定义盘子不需要内切圆(整个图就是盘子)
            if (this.customPlateUrl) return null;
            return resolvePlateCenterStyle(this.scene.plate);
        },
        toy() {
            return this.scene.toy.id ? getRelaxToy(this.scene.toy.id) : null;
        },
        /** fit:'stage' 的主体铺满舞台,不进盘子 */
        toyFillsStage() {
            return this.toy?.fit === 'stage';
        },
        /** 按 z 排好序的装饰,免得在模板里排序(渲染函数里排序会每次 re-render 都跑) */
        sortedDecorations() {
            return [...this.scene.decorations].sort((a, b) => (a.z || 0) - (b.z || 0));
        },
    },
    methods: {
        decorationStyle(deco) {
            // 自定义装饰:aspect 已经在 store.normalizeDecoration 里按 record.aspect 兜好
            const aspect = deco.aspect || 1;
            const width = 18 * deco.scale;
            return {
                left: `${deco.x * 100}%`,
                top: `${deco.y * 100}%`,
                width: `${width}%`,
                aspectRatio: String(aspect),
                transform: `translate(-50%, -50%) rotate(${deco.rotate}deg) scaleX(${deco.flip ? -1 : 1})`,
                color: deco.tint,
                zIndex: String(10 + (deco.z || 0)),
            };
        },
        /**
         * 自定义装饰的 SVG/HTML 渲染:
         *   - 内置:返回 getDecoration(presetId).svg
         *   - 自定义:返回 <img> 标签(浏览器加载 dataUrl)
         */
        decorationInnerHtml(deco) {
            if (deco.presetId?.startsWith('custom:')) {
                const record = store.resolveCustomDecoration(deco.presetId);
                const url = record?.dataUrl;
                if (!url) return '';
                return `<img class="rx-deco-custom-img" src="${url}" alt="" draggable="false" />`;
            }
            return getDecoration(deco.presetId)?.svg || '';
        },

        // ---------- 装饰拖拽 ----------
        onDecorationPointerDown(event, deco) {
            if (!this.editable) return;
            event.stopPropagation();

            const stageEl = this.$refs.stage;
            if (!stageEl) return;

            this.$emit('select-decoration', deco.uid);
            this.draggingUid = deco.uid;

            // 每次按下都重新量:面板展开/收起会改变舞台尺寸
            const rect = stageEl.getBoundingClientRect();
            // 记住「手指落点」与「装饰中心」的偏移,不然一按就跳到指尖
            const grabOffsetX = deco.x - (event.clientX - rect.left) / rect.width;
            const grabOffsetY = deco.y - (event.clientY - rect.top) / rect.height;

            const onMove = (moveEvent) => {
                const x = (moveEvent.clientX - rect.left) / rect.width + grabOffsetX;
                const y = (moveEvent.clientY - rect.top) / rect.height + grabOffsetY;
                this.$emit('move-decoration', {
                    uid: deco.uid,
                    x: Math.min(1, Math.max(0, x)),
                    y: Math.min(1, Math.max(0, y)),
                });
            };

            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                this.draggingUid = null;
                this.$emit('commit-decoration', deco.uid);
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        },

        onStageBackdropPointerDown() {
            // 点空白处取消选中
            if (this.editable && this.selectedDecorationUid) {
                this.$emit('select-decoration', null);
            }
        },

        onRemoveDecoration(event, uid) {
            event.stopPropagation();
            this.$emit('remove-decoration', uid);
        },

        /** 供父级转发「重来一次」 */
        resetToy() {
            return this.$refs.toyHost?.resetToy?.();
        },
    },
    template: `
        <div ref="stage" class="rx-stage" :class="{ 'is-editable': editable }" @pointerdown="onStageBackdropPointerDown">
            <!-- 1. 背景 -->
            <div class="rx-stage-bg" :style="backgroundStyle"></div>

            <!-- 2/3. 盘子 + 主体 -->
            <div v-if="toyFillsStage" class="rx-stage-toy-full">
                <ToyHost
                    ref="toyHost"
                    :toy-id="scene.toy.id"
                    :tint="scene.toy.tint"
                    :scale="scene.toy.scale"
                    :rows="scene.toy.rows"
                    :cols="scene.toy.cols"
                    :bridge="bridge"
                />
            </div>

            <div v-else class="rx-plate-wrap" :style="plateWrapStyle">
                <div v-if="plateVisible" class="rx-plate-shadow" :style="plateShadowStyle"></div>

                <div v-if="plateVisible" class="rx-plate" :style="plateStyle">
                    <div v-if="plateGlazeStyle" class="rx-plate-glaze" :style="plateGlazeStyle"></div>
                    <div class="rx-plate-inner" :style="plateInnerStyle">
                        <div v-if="plateCenterStyle" class="rx-plate-center" :style="plateCenterStyle">
                            <ToyHost
                                ref="toyHost"
                                :toy-id="scene.toy.id"
                                :tint="scene.toy.tint"
                                :scale="scene.toy.scale"
                                :rows="scene.toy.rows"
                                :cols="scene.toy.cols"
                                :bridge="bridge"
                            />
                        </div>
                        <ToyHost
                            v-else
                            ref="toyHost"
                            :toy-id="scene.toy.id"
                            :tint="scene.toy.tint"
                            :scale="scene.toy.scale"
                            :rows="scene.toy.rows"
                            :cols="scene.toy.cols"
                            :bridge="bridge"
                        />
                    </div>
                </div>

                <!-- 关了盘子:主体直接浮在舞台上 -->
                <div v-else class="rx-plate-inner rx-plate-inner--bare">
                    <ToyHost
                        ref="toyHost"
                        :toy-id="scene.toy.id"
                        :tint="scene.toy.tint"
                        :scale="scene.toy.scale"
                        :rows="scene.toy.rows"
                        :cols="scene.toy.cols"
                        :bridge="bridge"
                    />
                </div>
            </div>

            <!-- 4. 装饰 -->
            <div
                v-for="deco in sortedDecorations"
                :key="deco.uid"
                class="rx-deco"
                :class="{
                    'is-selected': editable && deco.uid === selectedDecorationUid,
                    'is-dragging': deco.uid === draggingUid,
                    'is-custom': deco.presetId && deco.presetId.startsWith('custom:'),
                }"
                :style="decorationStyle(deco)"
                @pointerdown="onDecorationPointerDown($event, deco)"
            >
                <span class="rx-deco-art" v-html="decorationInnerHtml(deco)"></span>

                <button
                    v-if="editable && deco.uid === selectedDecorationUid"
                    type="button"
                    class="rx-deco-remove"
                    aria-label="移除装饰"
                    @pointerdown.stop
                    @click="onRemoveDecoration($event, deco.uid)"
                >${ICON_CLOSE}</button>
            </div>
        </div>
    `,
};