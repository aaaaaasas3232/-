/**
 * 点灯 · 推理墙
 *
 * 布满线索和红线的那面墙。原型是 MarginNote 的脑图：
 *   - 拖卡片、拖画布、双指/滑轮缩放
 *   - 从一张卡拉线到另一张（连线动画是 q 弹的）
 *   - 拖到重合 → 叠成一堆（左右错开，不完全遮盖）
 *   - 点卡片堆 → 摊开悬浮到画面中央，左右滑切换
 *   - 长按一张卡 → 就地弹菜单（打开 / 连线 / 抽出 / 删除）
 *   - 「整理」按钮：本地算一版最舒服的排布，不调 API
 *   - 「分块」：卡片太多时一小块一小块看
 *
 * ── ★ setPointerCapture 只能扣在「按下去的那个元素」上 ─────────
 *   曾经这里把 capture 一律扣在 stage 上，结果整面墙是死的：
 *     · pointerup 被改派给 stage，卡片自己的 pointerup 收不到
 *       → 点卡片不开详情、点卡堆不摊开
 *     · click 会派发到「按下点与抬手点的最近公共祖先」，抬手点被
 *       改派成 stage 之后，公共祖先就永远是 stage
 *       → 画布里的每一个按钮（看全部 / 分块 / 选关系 / 点红线）全哑
 *   所以：谁接到 pointerdown，capture 就扣给谁；画布上那些浮层
 *   （面板、菜单、摊开层、红线）根本不启动平移，让它们的 click 活着。
 *
 * ── 性能 ────────────────────────────────────────────────────────
 *   - 拖动走 rAF 节流，一帧最多算一次
 *   - 连线只在「卡片位置版本号」变化时重算，不是每次渲染都算
 *   - 视口外的卡片不渲染（超过 90 张才开启剔除 —— 少量卡片时
 *     剔除本身的开销比省下的还大）
 *   - 落盘攒批（store 里 520ms 一次），拖一下不会写几十次盘
 */

import { CARD_SIZE, LINK_KINDS, LONG_PRESS_MS, WALL_ZOOM } from '../constants.js';
import { clamp, edgeAnchor, overlapRatio, springPath } from '../utils.js';
import { UI } from './ui.js';
import { SlWallCard } from './cards.js';

/** 超过这个数量才开视口剔除 */
const CULL_FROM = 90;

/** 按在这些东西上不算「拖画布」—— 它们要自己的 click */
const UI_HIT = '.sl-wc, .sl-regions, .sl-kinds, .sl-spread, .sl-wmenu, .sl-wall__hint, .sl-link, .sl-link__hit';

/** 摊开视图里相邻两张卡的横向间距（px） */
const SPREAD_STEP = 118;

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
        'delete-link', 'update-link', 'save-view', 'toggle-full', 'unstack', 'delete-card',
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
            /** 长按卡片弹出的小菜单 { id, title, stacked, x, y } */
            menu: null,
            /** 摊开视图里横滑的实时位移（px） */
            spreadDrag: 0,
            spreadSwiping: false,
        };
    },
    /** 手势中间态放实例上而不是 data —— 每帧都在改，没必要走响应式 */
    created() {
        this._raf = 0;
        this._start = null;
        this._mode = '';
        this._pressTimer = null;
        this._pointers = new Map();
        this._pinch = null;
        this._swipe = null;
        this._swiped = false;
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
        spreadIndex() {
            return clamp(Number(this.wall.spreadIndex) || 0, 0, Math.max(0, this.spreadCards.length - 1));
        },

        menuCard() {
            return this.menu ? this.cardIndex.get(String(this.menu.id)) : null;
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
        this.$nextTick(() => this.measure());
        this._onResize = () => this.measure();
        window.addEventListener('resize', this._onResize);
        // 手指在舞台外面松开时舞台收不到 pointerup，多指计数会一直挂着
        this._onWinUp = (e) => this.trackUp(e);
        window.addEventListener('pointerup', this._onWinUp, true);
        window.addEventListener('pointercancel', this._onWinUp, true);
    },
    beforeUnmount() {
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('pointerup', this._onWinUp, true);
        window.removeEventListener('pointercancel', this._onWinUp, true);
        if (this._raf) cancelAnimationFrame(this._raf);
        this.cancelPress();
        this.$emit('save-view');
    },
    methods: {
        measure() {
            const el = this.$refs.stage;
            if (!el || !el.clientWidth) return;
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

        /** ★ capture 只扣在接到 pointerdown 的那个元素上，见文件头 */
        capture(e) {
            try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch (_) { /* 指针已经没了 */ }
        },
        isUiTarget(el) {
            return Boolean(el?.closest?.(UI_HIT));
        },

        // ---- 多指记账（双指缩放） ----
        // 只记触摸笔触：鼠标永远只有一根指头，混进来只会让计数漏掉一次就一直错
        trackDown(e) {
            if (e.pointerType === 'mouse') return;
            this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this._pointers.size === 2) this.startPinch();
        },
        trackMove(e) {
            if (!this._pointers.has(e.pointerId)) return;
            this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this._pinch) this.stepPinch();
        },
        trackUp(e) {
            if (!this._pointers.delete(e.pointerId)) return;
            if (this._pinch && this._pointers.size < 2) {
                this._pinch = null;
                this.$emit('save-view');
            }
        },
        startPinch() {
            const rect = this.$refs.stage?.getBoundingClientRect();
            if (!rect) return;
            const [a, b] = [...this._pointers.values()];
            // 捏合期间不许再拖卡片 / 平移，不然两套手势会打架
            this.cancelPress();
            this._mode = '';
            this._start = null;
            this.dragId = '';
            this.dragOver = '';
            this._pinch = {
                dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
                zoom: this.wall.zoom,
                wx: this.wall.x,
                wy: this.wall.y,
                cx: (a.x + b.x) / 2 - rect.left,
                cy: (a.y + b.y) / 2 - rect.top,
            };
        },
        stepPinch() {
            const p = this._pinch;
            if (!p || this._pointers.size < 2) return;
            const [a, b] = [...this._pointers.values()];
            const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
            const next = clamp((p.zoom * dist) / p.dist, WALL_ZOOM.min, WALL_ZOOM.max);
            this.wall.x = p.cx - ((p.cx - p.wx) * next) / p.zoom;
            this.wall.y = p.cy - ((p.cy - p.wy) * next) / p.zoom;
            this.wall.zoom = next;
            this.posVersion += 1;
        },

        // ---- 画布手势 ----
        onStageDown(e) {
            if (this._pinch || this.isUiTarget(e.target)) return;
            this.closeMenu();
            this.wall.selectedId = '';
            this._mode = 'pan';
            this._start = {
                x: e.clientX, y: e.clientY, wx: this.wall.x, wy: this.wall.y,
            };
            this.capture(e);
        },

        onStageMove(e) {
            if (this.wall.linkingFrom) {
                const p = this.toWorld(e.clientX, e.clientY);
                this.pointer = p;
                const hit = this.cardAt(e.clientX, e.clientY, this.wall.linkingFrom);
                this.linkHover = hit ? String(hit.id) : '';
                return;
            }
            if (!this._start || this._pinch) return;

            // 手指挪超过 6px 就不是「长按」了，是拖
            if (this._pressTimer
                && (Math.abs(e.clientX - this._start.x) > 6 || Math.abs(e.clientY - this._start.y) > 6)) {
                this.cancelPress();
            }

            if (this._raf) return;
            this._raf = requestAnimationFrame(() => {
                this._raf = 0;
                if (!this._start || this._pinch) return;
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
            this.cancelPress();
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
            if (this._pinch || this._pointers.size > 1) return;

            if (this.wall.linkingFrom) {
                if (String(card.id) !== String(this.wall.linkingFrom)) {
                    this.pendingTo = String(card.id);
                    this.showKinds = true;
                }
                return;
            }

            this.closeMenu();
            this._mode = 'card';
            this.dragId = String(card.id);
            this._start = {
                x: e.clientX, y: e.clientY,
                cx: Number(card.x) || 0, cy: Number(card.y) || 0,
            };
            this.wall.selectedId = String(card.id);
            this.capture(e);

            this.cancelPress();
            this._pressTimer = setTimeout(() => {
                this._pressTimer = null;
                this.openMenu(card, e.clientX, e.clientY);
            }, LONG_PRESS_MS);
        },

        onCardUp(card, e) {
            e.stopPropagation();
            const moved = this._start
                && (Math.abs(e.clientX - this._start.x) > 5 || Math.abs(e.clientY - this._start.y) > 5);
            // 弹菜单和双指缩放都会把 _mode 清空 —— 那两种情况抬手不算「点了这张卡」
            const tapped = this._mode === 'card' && this.dragId === String(card.id);
            this.cancelPress();
            if (tapped && !moved && !this.wall.linkingFrom) {
                const stack = card.stackId ? this.stacks.get(card.stackId) : null;
                if (stack && stack.length > 1) this.$emit('spread', card.stackId);
                else this.$emit('open-card', card.id);
            }
            this.onStageUp();
        },

        cancelPress() {
            if (this._pressTimer) { clearTimeout(this._pressTimer); this._pressTimer = null; }
        },

        // ---- 长按菜单 ----
        openMenu(card, clientX, clientY) {
            const rect = this.$refs.stage?.getBoundingClientRect();
            if (!rect) return;
            // 弹菜单就等于这次手势结束，别再跟着手指拖
            this._mode = '';
            this._start = null;
            this.dragId = '';
            this.dragOver = '';
            const stack = card.stackId ? (this.stacks.get(card.stackId) || []) : [];
            this.menu = {
                id: String(card.id),
                title: card.title || '这张卡',
                stacked: stack.length > 1,
                x: clamp(clientX - rect.left, 82, Math.max(82, rect.width - 82)),
                y: clamp(clientY - rect.top, 14, Math.max(14, rect.height - 196)),
            };
        },
        closeMenu() { this.menu = null; },
        menuDo(action) {
            const id = this.menu?.id;
            const stacked = this.menu?.stacked;
            const card = this.menuCard;
            this.closeMenu();
            if (!id) return;
            if (action === 'open') this.$emit('open-card', id);
            else if (action === 'link') this.$emit('link-start', id);
            else if (action === 'unstack') this.$emit('unstack', id);
            else if (action === 'spread' && stacked && card) this.$emit('spread', card.stackId);
            else if (action === 'delete') this.$emit('delete-card', id);
        },

        // ---- 摊开的卡片堆 ----
        spreadStyle(i) {
            const off = i - this.spreadIndex + this.spreadDrag / SPREAD_STEP;
            const a = Math.abs(off);
            const far = a > 3.2;
            return {
                transform: `translate3d(${(off * SPREAD_STEP).toFixed(1)}px, ${(Math.min(a, 3) * 7).toFixed(1)}px, 0)`
                    + ` rotate(${(off * 4.5).toFixed(2)}deg) scale(${Math.max(0.6, 1 - a * 0.14).toFixed(3)})`,
                opacity: far ? '0' : String(Math.max(0.26, 1 - a * 0.34).toFixed(2)),
                zIndex: String(30 - Math.round(a * 2)),
                pointerEvents: far ? 'none' : 'auto',
                animationDelay: `${Math.min(Math.abs(i - this.spreadIndex), 5) * 52}ms`,
            };
        },
        onSpreadDown(e) {
            this._swipe = { x: e.clientX, y: e.clientY };
            this._swiped = false;
            this.spreadDrag = 0;
            this.spreadSwiping = true;
        },
        onSpreadMove(e) {
            if (!this._swipe) return;
            const dx = e.clientX - this._swipe.x;
            if (Math.abs(dx) > 6) this._swiped = true;
            // 到头之后阻尼，手感上明确告诉用户「没有下一张了」
            const last = this.spreadCards.length - 1;
            const over = (this.spreadIndex === 0 && dx > 0) || (this.spreadIndex === last && dx < 0);
            this.spreadDrag = over ? dx * 0.32 : dx;
        },
        onSpreadUp() {
            if (!this._swipe) return;
            const dx = this.spreadDrag;
            this._swipe = null;
            this.spreadDrag = 0;
            this.spreadSwiping = false;
            if (Math.abs(dx) > 46) this.$emit('spread-step', dx < 0 ? 1 : -1);
        },
        onSpreadCard(i, id) {
            // 刚滑过一下，这次 click 是滑动的余波，不是「点它」
            if (this._swiped) { this._swiped = false; return; }
            if (i === this.spreadIndex) this.$emit('open-card', id);
            else this.$emit('spread-step', i - this.spreadIndex);
        },
        /**
         * 点空白处关掉。
         * ★ 横滑跨过了两张卡时，浏览器会把 click 派发到它们的公共祖先 ——
         *   正好是这层空白。不挡一下的话每滑一次都会把摊开层关掉。
         */
        onSpreadBlank() {
            if (this._swiped) { this._swiped = false; return; }
            this.$emit('spread-close');
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
            this.measure();
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
            this.measure();
            const p = this.toWorld(
                (this.$refs.stage?.getBoundingClientRect().left || 0) + this.viewport.w / 2,
                (this.$refs.stage?.getBoundingClientRect().top || 0) + this.viewport.h / 2,
            );
            this.$emit('new-card', { x: Math.round(p.x - CARD_SIZE.w / 2), y: Math.round(p.y - CARD_SIZE.h / 2) });
        },

        doTidy() {
            this.measure();
            this.$emit('tidy', { ...this.viewport });
            this.posVersion += 1;
        },
        doFit() {
            this.measure();
            this.$emit('fit', { ...this.viewport });
            this.posVersion += 1;
        },
        fitAllAndClose() {
            this.showRegions = false;
            this.doFit();
        },
        pickRegion(id) {
            this.measure();
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
                <button
                    type="button" class="sl-wall__icon" :class="{ 'is-on': showRegions }"
                    @click="showRegions = !showRegions"
                >
                    <SlIcon name="focus" :size="18" />
                </button>
                <button
                    type="button" class="sl-wall__icon" :class="{ 'is-on': wall.full }"
                    @click="$emit('toggle-full')"
                >
                    <SlIcon name="expand" :size="18" />
                </button>
            </header>

            <div
                ref="stage" class="sl-wall__stage"
                :class="{ 'is-grid': wall.showGrid, 'is-linking': !!wall.linkingFrom }"
                :style="wall.showGrid ? gridStyle : null"
                @pointerdown.capture="trackDown"
                @pointermove.capture="trackMove"
                @pointerup.capture="trackUp"
                @pointercancel.capture="trackUp"
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
                        />
                        <path v-if="drawing" :d="drawing" class="sl-link sl-link--draw" />
                        <!-- 加粗的透明替身：2px 的线在手机上根本点不中 -->
                        <path
                            v-for="p in paths" :key="p.id + '-hit'"
                            :d="p.d" class="sl-link__hit"
                            @click.stop="$emit('update-link', p.id)"
                        />
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
                        :class="{ 'is-drag': dragId === c.id, 'is-target': dragOver === c.id, 'is-menu': menu && menu.id === c.id }"
                        @pointerdown="onCardDown(c, $event)"
                        @pointerup="onCardUp(c, $event)"
                    />
                </div>

                <!-- 长按一张卡就地弹出来的小菜单（catch 层在前，菜单自然盖在它上面） -->
                <div v-if="menu" class="sl-wmenu__catch" @pointerdown.stop="closeMenu"></div>
                <transition name="sl-pop">
                    <div v-if="menu" class="sl-wmenu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }">
                        <div class="sl-wmenu__head">{{ menu.title }}</div>
                        <button type="button" @click="menuDo('open')"><SlIcon name="eye" :size="15" /> 打开</button>
                        <button type="button" @click="menuDo('link')"><SlIcon name="thread" :size="15" /> 拉一条线</button>
                        <button v-if="menu.stacked" type="button" @click="menuDo('spread')">
                            <SlIcon name="stack" :size="15" /> 摊开这一堆
                        </button>
                        <button v-if="menu.stacked" type="button" @click="menuDo('unstack')">
                            <SlIcon name="scissors" :size="15" /> 抽出来
                        </button>
                        <button type="button" class="is-danger" @click="menuDo('delete')">
                            <SlIcon name="trash" :size="15" /> 删掉
                        </button>
                    </div>
                </transition>

                <!-- 摊开的卡片堆 -->
                <transition name="sl-fade">
                    <div v-if="spreadCards.length" class="sl-spread" @click.self="onSpreadBlank">
                        <div
                            class="sl-spread__rail" :class="{ 'is-swiping': spreadSwiping }"
                            @click.self="onSpreadBlank"
                            @pointerdown="onSpreadDown"
                            @pointermove="onSpreadMove"
                            @pointerup="onSpreadUp"
                            @pointercancel="onSpreadUp"
                            @pointerleave="onSpreadUp"
                        >
                            <div
                                v-for="(c, i) in spreadCards" :key="c.id"
                                class="sl-spread__card"
                                :class="['sl-spread__card--' + c.type, { 'is-on': i === spreadIndex }]"
                                :style="spreadStyle(i)"
                                @click="onSpreadCard(i, c.id)"
                            >
                                <div class="sl-spread__type">{{ c.type }}</div>
                                <h4>{{ c.title }}</h4>
                                <p>{{ c.brief }}</p>
                                <span v-if="i === spreadIndex" class="sl-spread__go">点开看全文</span>
                            </div>
                        </div>
                        <div class="sl-spread__bar">
                            <button type="button" :disabled="spreadIndex === 0" @click="$emit('spread-step', -1)">
                                <SlIcon name="back" :size="16" />
                            </button>
                            <span>{{ spreadIndex + 1 }} / {{ spreadCards.length }}</span>
                            <button
                                type="button" :disabled="spreadIndex >= spreadCards.length - 1"
                                @click="$emit('spread-step', 1)"
                            ><SlIcon name="chevron" :size="16" /></button>
                            <button type="button" class="sl-spread__x" @click="$emit('spread-close')">
                                <SlIcon name="close" :size="16" />
                            </button>
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
                        <button type="button" class="sl-regions__all" @click="fitAllAndClose">看全部</button>
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
