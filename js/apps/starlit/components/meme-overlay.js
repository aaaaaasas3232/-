/**
 * 点灯 · 长按翻译的悬浮层（梗图式描边中文）
 *
 * ── 为什么长这样 ──────────────────────────────────────────────────
 *
 * 它要同时满足两件互相打架的事：
 *   1. 盖在内容上面，一眼能看清（所以是白字黑描边，像梗图字幕）
 *   2. 不能挡住学生正在看的东西（所以能拖走，位置还记着）
 *
 * 做成弹窗就只能满足第一件 —— 弹窗一开，底下的原文就看不见了，
 * 而「对照着看」正是他长按的目的。
 *
 * ── 拖动 ──────────────────────────────────────────────────────────
 *
 * 长按才进入拖动，单击直接关掉。
 * 这是刻意的：这个层出现得很频繁，用户最常做的动作是「看完，关掉」，
 * 那就该让最轻的手势（点一下）对应最常做的事。
 *
 * ★ 坐标存百分比不存像素 —— 换个机型 / 转屏之后，
 *   像素坐标会把层甩到屏幕外，用户再也找不回来。
 *
 * ★ z-index 必须 < 6（`.app-bottom` 是 6），否则 home 指示条被盖住就退不出 App。
 */

import { LONG_PRESS_MS } from '../constants.js';
import { UI } from './ui.js';

export const SlMemeOverlay = {
    name: 'SlMemeOverlay',
    components: { ...UI },
    props: {
        /** { text, source, origin, kind, loading, error, x, y, hits } */
        data: { type: Object, required: true },
    },
    emits: ['move', 'close'],
    data() {
        return {
            dragging: false,
            /** 长按计时器起来之前不算拖动 —— 免得和滚动抢手势 */
            armed: false,
            moved: false,
        };
    },
    computed: {
        style() {
            return {
                left: `${this.data.x}%`,
                top: `${this.data.y}%`,
            };
        },
        /** 本地词典的结果是「词 = 释义」列表，和整句译文长得不一样 */
        hits() {
            return Array.isArray(this.data.hits) ? this.data.hits : [];
        },
        isLocal() {
            return this.data.kind === 'local' && this.hits.length > 0;
        },
    },
    methods: {
        onDown(event) {
            this.moved = false;
            this.armed = false;
            this._startX = event.clientX;
            this._startY = event.clientY;

            if (this._timer) clearTimeout(this._timer);
            this._timer = setTimeout(() => {
                this._timer = null;
                this.armed = true;
                this.dragging = true;
                // 进入拖动时给一次触感，让用户知道「现在可以拖了」
                try { navigator.vibrate?.(10); } catch (_) { /* 不支持就算了 */ }
            }, LONG_PRESS_MS);

            try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
        },

        onMove(event) {
            const dx = event.clientX - this._startX;
            const dy = event.clientY - this._startY;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) this.moved = true;

            // 还没长按到时限就滑走了 = 用户在滚页面，取消这次判定
            if (!this.armed) {
                if (this.moved && this._timer) {
                    clearTimeout(this._timer);
                    this._timer = null;
                }
                return;
            }

            event.preventDefault();
            const host = this.$el?.offsetParent || this.$el?.parentElement;
            if (!host) return;
            const rect = host.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            this.$emit('move', {
                x: ((event.clientX - rect.left) / rect.width) * 100,
                y: ((event.clientY - rect.top) / rect.height) * 100,
            });
        },

        onUp(event) {
            if (this._timer) { clearTimeout(this._timer); this._timer = null; }
            try { event.currentTarget.releasePointerCapture(event.pointerId); } catch (_) { /* ignore */ }

            const wasDragging = this.dragging;
            this.dragging = false;
            this.armed = false;

            // 没进入拖动、也没滑动 = 一次干净的点击 → 关掉
            if (!wasDragging && !this.moved) this.$emit('close');
        },
    },
    beforeUnmount() {
        if (this._timer) clearTimeout(this._timer);
    },
    template: `
        <div
            class="sl-meme"
            :class="{ 'is-dragging': dragging }"
            :style="style"
            role="status"
            @pointerdown="onDown"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointercancel="onUp"
        >
            <div v-if="data.loading" class="sl-meme__line sl-meme__line--wait">正在翻…</div>

            <div v-else-if="data.error" class="sl-meme__err">{{ data.error }}</div>

            <template v-else-if="isLocal">
                <div v-for="(h, i) in hits" :key="i" class="sl-meme__hit">
                    <b>{{ h.word }}</b>
                    <i v-if="h.pos">{{ h.pos }}</i>
                    <span>{{ h.meaning }}</span>
                </div>
            </template>

            <div v-else class="sl-meme__line">{{ data.text }}</div>

            <div class="sl-meme__foot">
                <span class="sl-meme__from">{{ data.kind === 'ai' ? 'AI 翻的' : '你的词典' }}</span>
                <span v-if="data.source" class="sl-meme__src">{{ data.source }}</span>
                <span class="sl-meme__tip">点一下收起 · 长按可以拖走</span>
            </div>
        </div>
    `,
};

export default SlMemeOverlay;
