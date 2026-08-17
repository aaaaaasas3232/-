/**
 * 点灯 · 推理墙
 *
 * 布满线索和红线的那面墙。原型是 MarginNote 的脑图：
 *   - 拖卡片、拖画布、双指/滑轮缩放
 *   - 从一张卡拉线到另一张（连线动画是 q 弹的）
 *   - 拖到重合 → 叠成一堆（左右错开，不完全遮盖）
 *   - 点卡片堆 → 摊开到画面中央，左右滑切换
 *   - 「整理」按钮：本地算一版最舒服的排布，不调 API
 *   - 「分块」：卡片太多时一小块一小块看
 *
 * ── 性能 ────────────────────────────────────────────────────────
 *   - 拖动走 rAF 节流，一帧最多算一次
 *   - 连线只在「卡片位置版本号」变化时重算，不是每次渲染都算
 *   - 视口外的卡片不渲染（超过 90 张才开启剔除 —— 少量卡片时
 *     剔除本身的开销比省下的还大）
 *   - 落盘攒批（store 里 520ms 一次），拖一下不会写几十次盘
 */

import { CARD_SIZE, LINK_KINDS, WALL_ZOOM } from '../constants.js';
import { clamp, edgeAnchor, overlapRatio, springPath } from '../utils.js';
import { UI } from './ui.js';
import { SlWallCard } from './cards.js';

/** 超过这个数量才开视口剔除 */
const CULL_FROM = 90;

export const SlWallPage = {
    name: 'SlWallPage',
    components: { ...UI, SlWallCard },
    props: {
        state: { type: Object, required: true },
        topic: { type: Object, default: null },
    },
    emits: [
        'back', 'open-card', 'move', 'stack', 'link-start', 'link-done', 'link-cancel',
        'tidy', 'fit', 'focus-region', 'new-card', 'spread', 'spread-close', 'spread-step',
        'delete-link', 'update-link', 'save-view', 'toggle-full',
    ],
    data() {
        return {
            /** 位置版本号：拖动时 +1，连线路径靠它触发重算 */
            posVersion: 0,
            dragId: '',
            dragOver: '',
            linkHover: '',
            pointer: { x: 0, y: 0 },
            showRegions: false,
            showKinds: false,
            pendingTo: '',
            viewport: { w: 0, h: 0 },
            _raf: 0,
            _start: null,
            _mode: '',
            _pressTimer: null,
        };
    },
    computed: {
        wall() { return this.state.wall; },
        cards() { return this.state.cards; },
        links() { return this.state.links; },
        linkKinds() { return LINK_KINDS; },

        /** stackId → 成员（按 stackOrder） */
        stacks() {
            const map = new Map();
            for (const c of this.cards) {
                if (!c.stackId) continue;
                const arr = map.get(c.stackId) || [];
                arr.push(c);
                map.set(c.stackId, arr);
            }
            for (const arr of map.values()) arr.sort((a, b) => (a.stackOrder || 0) - (b.stackOrder || 0));
            return map;
        },

        /** 真正要画的卡：堆里只画最上面那张 */
        visibleCards() {
            const top = new Set();
            for (const [, arr] of this.stacks) {
                if (arr.length) top.add(String(arr[arr.length - 1].id));
            }
            let list = this.cards.filter((c) => !c.stackId || top.has(String(c.id)));

            if (list.length > CULL_FROM && this.viewport.w) {
                const z = this.wall.zoom || 1;
                const pad = 260;
                const x0 = (-this.wall.x - pad) / z;
                const y0 = (-this.wall.y - pad) / z;
                const x1 = (-this.wall.x + this.viewport.w + pad) / z;
                const y1 = (-this.wall.y + this.viewport.h + pad) / z;
                list = list.filter((c) => {
                    const cx = Number(c.x) || 0;
                    const cy = Number(c.y) || 0;
                    return cx + (c.w || CARD_SIZE.w) > x0 && cx < x1
                        && cy + (c.h || CARD_SIZE.h) > y0 && cy < y1;
                });
            }
            return list;
        },

        cardIndex() {
            const map = new Map();
            for (const c of this.cards) map.set(String(c.id), c);
            return map;
        },

        /** 连线路径。依赖 posVersion，拖动时才重算。 */
        paths() {
            // eslint-disable-next-line no-unused-expressions
            this.posVersion;
            const out = [];
            for (const link of this.links) {
                const a = this.cardIndex.get(String(link.from));
                const b = this.cardIndex.get(String(link.to));
                if (!a || !b) continue;
                const ra = { x: Number(a.x) || 0, y: Number(a.y) || 0, w: a.w || CARD_SIZE.w, h: a.h || CARD_SIZE.h };
                const rb = { x: Number(b.x) || 0, y: Number(b.y) || 0, w: b.w || CARD_SIZE.w, h: b.h || CARD_SIZE.h };
                const ca = { x: ra.x + ra.w / 2, y: ra.y + ra.h / 2 };
                const cb = { x: rb.x + rb.w / 2, y: rb.y + rb.h / 2 };
                const pa = edgeAnchor(ra, cb.x, cb.y);
                const pb = edgeAnchor(rb, ca.x, ca.y);
                const kind = LINK_KINDS.find((k) => k.id === link.kind) || LINK_KINDS[0];
                out.push({
                    id: link.id,
                    d: springPath(pa.x, pa.y, pb.x, pb.y, Number(link.bulge) || 0),
                    token: kind.token,
                    dashed: kind.dashed,
                    label: link.label,
                    mid: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 },
                    by: link.by,
                });
            }
            return out;
        },

        /** 正在拉的那条线 */
        drawing() {
            const from = this.wall.linkingFrom;
            if (!from) return null;
            const a = this.cardIndex.get(String(from));
            if (!a) return null;
            const ra = { x: Number(a.x) || 0, y: Number(a.y) || 0, w: a.w || CARD_SIZE.w, h: a.h || CARD_SIZE.h };
            const p = edgeAnchor(ra, this.pointer.x, this.pointer.y);
            return springPath(p.x, p.y, this.pointer.x, this.pointer.y, 0.25);
        },

        spreadCards() {
            const sid = this.wall.spreadStackId;
            if (!sid) return [];
            return this.stacks.get(sid) || [];
        },

        canvasStyle() {
            return {
                transform: `translate3d(${this.wall.x}px, ${this.wall.y}px, 0) scale(${this.wall.zoom})`,
            };
        },
        gridStyle() {
            const s = 28 * this.wall.zoom;
            return {
                backgroundSize: `${s}px ${s}px`,
                backgroundPosition: `${this.wall.x}px ${this.wall.y}px`,
            };
        },
        zoomLabel() { return `${Math.round(this.wall.zoom * 100)}%`; },
    },
    mounted() {
        this.measure();
        this._onResize = () => this.measure();
        window.addEventListener('resize', this._onResize);
    },
    beforeUnmount() {
        window.removeEventListener('resize', this._onResize);
        if (this._raf) cancelAnimationFrame(this._raf);
        if (this._pressTimer) clearTimeout(this._pressTimer);
        this.$emit('save-view');
    },
    methods: {
        measure() {
            const el = this.$refs.stage;
            if (!el) return;
            this.viewport = { w: el.clientWidth, h: el.clientHeight };
        },

        /** 屏幕坐标 → 世界坐标 */
        toWorld(clientX, clientY) {
            const el = this.$refs.stage;
            if (!el) return { x: 0, y: 0 };
            const rect = el.getBoundingClientRect();
            const z = this.wall.zoom || 1;
            return {
                x: (clientX - rect.left - this.wall.x) / z,
                y: (clientY - rect.top - this.wall.y) / z,
            };
        },

        cardAt(clientX, clientY, exceptId) {
            const p = this.toWorld(clientX, clientY);
            // 从后往前找 —— 后画的在上面
            for (let i = this.visibleCards.length - 1; i >= 0; i -= 1) {
                const c = this.visibleCards[i];
                if (exceptId && String(c.id) === String(exceptId)) continue;
                const x = Number(c.x) || 0;
                const y = Number(c.y) || 0;
                if (p.x >= x && p.x <= x + (c.w || CARD_SIZE.w) && p.y >= y && p.y <= y + (c.h || CARD_SIZE.h)) {
                    return c;
                }
            }
            return null;
        },

        // ---- 画布手势 ----
        onStageDown(e) {
            if (e.target.closest?.('.sl-wc')) return;
            this._mode = 'pan';
            this._start = {
                x: e.clientX, y: e.clientY, wx: this.wall.x, wy: this.wall.y,
            };
            this.$refs.stage?.setPointerCapture?.(e.pointerId);
        },

        onStageMove(e) {
            if (this.wall.linkingFrom) {
                const p = this.toWorld(e.clientX, e.clientY);
                this.pointer = p;
                const hit = this.cardAt(e.clientX, e.clientY, this.wall.linkingFrom);
                this.linkHover = hit ? String(hit.id) : '';
                return;
            }
            if (!this._start) return;

            if (this._raf) return;
            this._raf = requestAnimationFrame(() => {
                this._raf = 0;
                if (!this._start) return;
                const dx = e.clientX - this._start.x;
                const dy = e.clientY - this._start.y;

                if (this._mode === 'pan') {
                    this.wall.x = this._start.wx + dx;
                    this.wall.y = this._start.wy + dy;
                } else if (this._mode === 'card' && this.dragId) {
                    const z = this.wall.zoom || 1;
                    this.$emit('move', {
                        id: this.dragId,
                        x: this._start.cx + dx / z,
                        y: this._start.cy + dy / z,
                    });
                    this.posVersion += 1;
                    const hit = this.cardAt(e.clientX, e.clientY, this.dragId);
                    this.dragOver = hit && this.isOverlapping(hit) ? String(hit.id) : '';
                }
            });
        },

        onStageUp() {
            if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
            if (this._mode === 'card' && this.dragId && this.dragOver) {
                this.$emit('stack', { dragId: this.dragId, targetId: this.dragOver });
            }
            if (this._mode === 'pan') this.$emit('save-view');
            this._mode = '';
            this._start = null;
            this.dragId = '';
            this.dragOver = '';
        },

        isOverlapping(target) {
            const drag = this.cardIndex.get(String(this.dragId));
            if (!drag || !target) return false;
            const a = { x: Number(drag.x) || 0, y: Number(drag.y) || 0, w: drag.w || CARD_SIZE.w, h: drag.h || CARD_SIZE.h };
            const b = { x: Number(target.x) || 0, y: Number(target.y) || 0, w: target.w || CARD_SIZE.w, h: target.h || CARD_SIZE.h };
            return overlapRatio(a, b) > 0.42;
        },

        // ---- 卡片手势 ----
        onCardDown(card, e) {
            e.stopPropagation();

            if (this.wall.linkingFrom) {
                if (String(card.id) !== String(this.wall.linkingFrom)) {
                    this.pendingTo = String(card.id);
                    this.showKinds = true;
                }
                return;
            }

            this._mode = 'card';
            this.dragId = String(card.id);
            this._start = {
                x: e.clientX, y: e.clientY,
                cx: Number(card.x) || 0, cy: Number(card.y) || 0,
            };
            this.wall.selectedId = String(card.id);
            this.$refs.stage?.setPointerCapture?.(e.pointerId);
        },

        onCardUp(card, e) {
            e.stopPropagation();
            const moved = this._start
                && (Math.abs(e.clientX - this._start.x) > 5 || Math.abs(e.clientY - this._start.y) > 5);
            if (this._pressTimer) { clearTimeout(this._pressTimer); this._pressTimer = null; }
            if (!moved && !this.wall.linkingFrom) {
                const stack = card.stackId ? this.stacks.get(card.stackId) : null;
                if (stack && stack.length > 1) this.$emit('spread', card.stackId);
                else this.$emit('open-card', card.id);
            }
            this.onStageUp();
        },

        onWheel(e) {
            e.preventDefault();
            const el = this.$refs.stage;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const factor = e.deltaY < 0 ? 1 + WALL_ZOOM.step : 1 / (1 + WALL_ZOOM.step);
            const before = this.wall.zoom;
            const next = clamp(before * factor, WALL_ZOOM.min, WALL_ZOOM.max);
            if (next === before) return;
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            this.wall.x = cx - ((cx - this.wall.x) * next) / before;
            this.wall.y = cy - ((cy - this.wall.y) * next) / before;
            this.wall.zoom = next;
            this.posVersion += 1;
        },

        stepZoom(dir) {
            const before = this.wall.zoom;
            const next = clamp(before * (dir > 0 ? 1.22 : 1 / 1.22), WALL_ZOOM.min, WALL_ZOOM.max);
            const cx = this.viewport.w / 2;
            const cy = this.viewport.h / 2;
            this.wall.x = cx - ((cx - this.wall.x) * next) / before;
            this.wall.y = cy - ((cy - this.wall.y) * next) / before;
            this.wall.zoom = next;
            this.posVersion += 1;
            this.$emit('save-view');
        },

        // ---- 连线 ----
        chooseKind(kindId) {
            this.showKinds = false;
            const to = this.pendingTo;
            this.pendingTo = '';
            this.linkHover = '';
            if (to) this.$emit('link-done', { to, kind: kindId });
        },
        cancelKinds() {
            this.showKinds = false;
            this.pendingTo = '';
            this.$emit('link-cancel');
        },

        stackCountOf(card) {
            if (!card.stackId) return 0;
            return (this.stacks.get(card.stackId) || []).length;
        },

        tiltOf(card) {
            // 固定的微旋转，让墙看起来像真贴过便利贴
            let h = 2166136261;
            const s = String(card.id);
            for (let i = 0; i < s.length; i += 1) {
                h ^= s.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return (((h >>> 0) % 1000) / 1000 - 0.5) * 2.4;
        },

        addHere() {
            const p = this.toWorld(
                (this.$refs.stage?.getBoundingClientRect().left || 0) + this.viewport.w / 2,
                (this.$refs.stage?.getBoundingClientRect().top || 0) + this.viewport.h / 2,
            );
            this.$emit('new-card', { x: Math.round(p.x - CARD_SIZE.w / 2), y: Math.round(p.y - CARD_SIZE.h / 2) });
        },

        doTidy() {
            this.$emit('tidy', { ...this.viewport });
            this.posVersion += 1;
        },
        doFit() {
            this.$emit('fit', { ...this.viewport });
            this.posVersion += 1;
        },
        pickRegion(id) {
            this.showRegions = false;
            this.$emit('focus-region', { id, viewport: { ...this.viewport } });
            this.posVersion += 1;
        },
    },
    template: `
        <div class="sl-wall" :class="{ 'is-full': wall.full }">
            <header class="sl-wall__top">
                <button type="button" class="sl-wall__icon" @click="$emit('back')">
                    <SlIcon name="back" :size="19" />
                </button>
                <div class="sl-wall__title">
                    <b>{{ topic ? topic.title : '推理墙' }}</b>
                    <i>{{ cards.length }} 张卡 · {{ links.length }} 条线</i>
                </div>
                <button type="button" class="sl-wall__icon" @click="showRegions = !showRegions">
                    <SlIcon name="focus" :size="18" />
                </button>
                <button type="button" class="sl-wall__icon" @click="$emit('toggle-full')">
                    <SlIcon name="expand" :size="18" />
                </button>
            </header>

            <div
                ref="stage" class="sl-wall__stage"
                :class="{ 'is-grid': wall.showGrid, 'is-linking': !!wall.linkingFrom }"
                :style="wall.showGrid ? gridStyle : null"
                @pointerdown="onStageDown"
                @pointermove="onStageMove"
                @pointerup="onStageUp"
                @pointercancel="onStageUp"
                @wheel.prevent="onWheel"
            >
                <div class="sl-wall__canvas" :style="canvasStyle">
                    <svg class="sl-wall__links">
                        <path
                            v-for="p in paths" :key="p.id"
                            :d="p.d"
                            class="sl-link"
                            :class="['sl-link--' + p.token, { 'is-dash': p.dashed, 'is-ai': p.by === 'ai' }]"
                            @click.stop="$emit('update-link', p.id)"
                        />
                        <path v-if="drawing" :d="drawing" class="sl-link sl-link--draw" />
                        <g v-for="p in paths" :key="p.id + '-l'">
                            <text v-if="p.label" :x="p.mid.x" :y="p.mid.y - 5" class="sl-link__label">{{ p.label }}</text>
                        </g>
                    </svg>

                    <SlWallCard
                        v-for="c in visibleCards" :key="c.id"
                        :card="c"
                        :selected="wall.selectedId === c.id"
                        :linking="wall.linkingFrom === c.id || linkHover === c.id"
                        :stack-count="stackCountOf(c)"
                        :tilt="tiltOf(c)"
                        :class="{ 'is-drag': dragId === c.id, 'is-target': dragOver === c.id }"
                        @pointerdown="onCardDown(c, $event)"
                        @pointerup="onCardUp(c, $event)"
                    />
                </div>

                <!-- 摊开的卡片堆 -->
                <transition name="sl-fade">
                    <div v-if="spreadCards.length" class="sl-spread" @click.self="$emit('spread-close')">
                        <div class="sl-spread__rail">
                            <div
                                v-for="(c, i) in spreadCards" :key="c.id"
                                class="sl-spread__card"
                                :class="{ 'is-on': i === wall.spreadIndex }"
                                :style="{ transform: 'translateX(' + ((i - wall.spreadIndex) * 78) + '%) scale(' + (i === wall.spreadIndex ? 1 : 0.86) + ')' }"
                                @click="i === wall.spreadIndex ? $emit('open-card', c.id) : $emit('spread-step', i - wall.spreadIndex)"
                            >
                                <div class="sl-spread__type">{{ c.type }}</div>
                                <h4>{{ c.title }}</h4>
                                <p>{{ c.brief }}</p>
                            </div>
                        </div>
                        <div class="sl-spread__bar">
                            <button type="button" @click="$emit('spread-step', -1)"><SlIcon name="back" :size="16" /></button>
                            <span>{{ wall.spreadIndex + 1 }} / {{ spreadCards.length }}</span>
                            <button type="button" @click="$emit('spread-step', 1)"><SlIcon name="chevron" :size="16" /></button>
                            <button type="button" class="sl-spread__x" @click="$emit('spread-close')"><SlIcon name="close" :size="16" /></button>
                        </div>
                    </div>
                </transition>

                <!-- 分块列表 -->
                <transition name="sl-slide">
                    <aside v-if="showRegions" class="sl-regions">
                        <div class="sl-regions__head">一块一块看</div>
                        <button
                            v-for="r in wall.regions" :key="r.id" type="button"
                            class="sl-regions__row" :class="{ 'is-on': wall.focusRegionId === r.id }"
                            @click="pickRegion(r.id)"
                        >
                            <b>{{ r.title }}</b>
                            <i>{{ r.count }} 张</i>
                        </button>
                        <p v-if="!wall.regions.length" class="sl-regions__empty">还没有连线，连起来之后这里会自动分块</p>
                        <button type="button" class="sl-regions__all" @click="doFit(); showRegions = false">看全部</button>
                    </aside>
                </transition>

                <!-- 选关系类型 -->
                <transition name="sl-pop">
                    <div v-if="showKinds" class="sl-kinds">
                        <div class="sl-kinds__head">这两张是什么关系</div>
                        <button
                            v-for="k in linkKinds" :key="k.id" type="button"
                            class="sl-kinds__item" :class="'sl-kinds__item--' + k.token"
                            @click="chooseKind(k.id)"
                        ><i></i>{{ k.label }}</button>
                        <button type="button" class="sl-kinds__cancel" @click="cancelKinds">取消</button>
                    </div>
                </transition>

                <div v-if="wall.linkingFrom" class="sl-wall__hint">
                    点另一张卡完成连线
                    <button type="button" @click="$emit('link-cancel')">取消</button>
                </div>
            </div>

            <footer class="sl-wall__bar">
                <button type="button" @click="stepZoom(-1)"><SlIcon name="close" :size="15" /></button>
                <span class="sl-wall__zoom">{{ zoomLabel }}</span>
                <button type="button" @click="stepZoom(1)"><SlIcon name="plus" :size="15" /></button>
                <span class="sl-section__spacer"></span>
                <button type="button" @click="addHere"><SlIcon name="plus" :size="16" /> 新卡</button>
                <button type="button" @click="doFit"><SlIcon name="focus" :size="16" /> 全览</button>
                <button
                    type="button" class="sl-wall__tidy"
                    :class="{ 'is-busy': state.loading.tidy }"
                    @click="doTidy"
                ><SlIcon name="tidy" :size="16" /> 整理</button>
            </footer>
        </div>
    `,
};

export default SlWallPage;
