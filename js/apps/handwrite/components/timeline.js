/**
 * 手书 · 时间轴
 *
 * ── 手机上的时间轴要解决的三个问题 ────────────────────────────────
 *
 * 1. **横向空间只有 390px**。所以时间轴自己横向滚动,轨道名收进左侧
 *    44px 的 sticky 槽,不做「左边一列固定 + 右边一列滚」的双栏 ——
 *    双栏在触屏上两边会各滚各的,对不齐。
 * 2. **手指比鼠标粗**。剪辑两端的拉伸把手做到 18px 宽(视觉上只有 4px),
 *    并且 `touch-action: none` 只加在把手和剪辑上,轨道空白处仍然能滑动列表。
 * 3. **没有右键**。复制 / 删除 / 分割全部放在顶部工具条上,作用于**选中的**剪辑。
 *
 * ── 拖动为什么用 window 监听而不是 pointer capture ────────────────
 *
 * `setPointerCapture` 在元素被 Vue 重渲染(比如拖动过程中列表顺序变了)
 * 时会连带丢掉捕获,表现是「拖到一半松手了」。挂在 window 上不受重渲染影响。
 */

import * as store from '../store.js';
import { HsIcon, HsButton } from './shared.js';
import { formatClock } from '../utils.js';
import { CLIP_TYPES, MIN_CLIP_MS } from '../constants.js';

/** 刻度步长候选:挑一个让标签间距落在 56~140px 的 */
const TICK_STEPS = [100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000];

export const HsTimeline = {
    name: 'HsTimeline',
    components: { HsIcon, HsButton },
    emits: ['notify'],
    data() {
        return {
            /** 拖动中的手势,null = 没在拖 */
            gesture: null,
            scrubbing: false,
        };
    },
    computed: {
        state() { return store.getState(); },
        project() { return store.getProject(); },
        timeline() { return store.getTimeline(); },
        zoom() { return store.getZoom(); },
        settings() { return store.getSettings(); },
        duration() { return store.getDuration(); },
        selectedId() { return this.state.selectedClipId; },

        tracks() { return this.project?.tracks || []; },

        /** 画布宽度:整片长度 + 一屏富余,方便往后拖 */
        canvasWidth() {
            return Math.max(360, this.msToPx(this.duration) + 280);
        },

        tickStep() {
            const target = 90;
            return TICK_STEPS.find((s) => this.msToPx(s) >= target) || TICK_STEPS[TICK_STEPS.length - 1];
        },

        ticks() {
            const step = this.tickStep;
            const end = this.pxToMs(this.canvasWidth);
            const out = [];
            for (let t = 0; t <= end; t += step) {
                out.push({ t, x: this.msToPx(t), label: formatClock(t) });
                if (out.length > 400) break;   // 防御:缩到最小时别画出上千个刻度
            }
            return out;
        },

        playheadX() { return this.msToPx(this.state.time); },

        clipsByTrack() {
            const map = {};
            for (const track of this.tracks) map[track.id] = [];
            for (const clip of this.project?.clips || []) {
                if (!map[clip.trackId]) map[clip.trackId] = [];
                map[clip.trackId].push(clip);
            }
            for (const key of Object.keys(map)) map[key].sort((a, b) => a.start - b.start);
            return map;
        },

        canSplit() {
            const clip = store.getSelectedClip();
            if (!clip) return false;
            const t = this.state.time;
            return t > clip.start + MIN_CLIP_MS && t < clip.start + clip.duration - MIN_CLIP_MS;
        },
    },
    methods: {
        // ── 单位换算 ────────────────────────────
        msToPx(ms) { return (Number(ms) || 0) / 1000 * this.zoom; },
        pxToMs(px) { return (Number(px) || 0) / this.zoom * 1000; },

        clipStyle(clip) {
            return {
                left: `${this.msToPx(clip.start)}px`,
                width: `${Math.max(14, this.msToPx(clip.duration))}px`,
            };
        },

        clipLabel(clip) {
            const meta = CLIP_TYPES.find((c) => c.id === clip.type);
            if (clip.type === 'type') return clip.text || '(空)';
            if (clip.type === 'delete') return `删 ${clip.count}`;
            if (clip.type === 'replace') return `${clip.from}→${clip.to}`;
            if (clip.type === 'hold') return `停 ${(clip.duration / 1000).toFixed(1)}s`;
            if (clip.type === 'effect') return this.effectNameOf(clip.effectId) || '效果';
            if (clip.type === 'bg') return `底 ${clip.backdrop}`;
            return meta?.label || clip.type;
        },

        // ── 手势 ────────────────────────────────
        localX(event) {
            const canvas = this.$refs.canvas;
            if (!canvas) return 0;
            const rect = canvas.getBoundingClientRect();
            return event.clientX - rect.left;
        },

        startGesture(mode, clip, event) {
            const track = this.tracks.find((t) => t.id === clip?.trackId);
            if (track?.locked) return this.$emit('notify', '这条轨锁着,先解锁');
            store.selectClip(clip.id);
            store.beginGesture(mode === 'move' ? '移动剪辑' : '调整时长');
            this.gesture = {
                mode,
                id: clip.id,
                originX: event.clientX,
                startAt: clip.start,
                startDuration: clip.duration,
            };
            window.addEventListener('pointermove', this.onGestureMove, { passive: false });
            window.addEventListener('pointerup', this.onGestureEnd);
            window.addEventListener('pointercancel', this.onGestureEnd);
            return true;
        },

        onGestureMove(event) {
            const g = this.gesture;
            if (!g) return;
            event.preventDefault();
            const deltaMs = this.pxToMs(event.clientX - g.originX);
            if (g.mode === 'move') {
                store.dragClip(g.id, g.startAt + deltaMs);
            } else if (g.mode === 'right') {
                store.resizeClip(g.id, g.startDuration + deltaMs, 'right');
            } else {
                store.resizeClip(g.id, g.startDuration - deltaMs, 'left');
            }
        },

        onGestureEnd() {
            if (!this.gesture) return;
            this.gesture = null;
            window.removeEventListener('pointermove', this.onGestureMove);
            window.removeEventListener('pointerup', this.onGestureEnd);
            window.removeEventListener('pointercancel', this.onGestureEnd);
            store.endGesture();
        },

        onClipDown(clip, event) {
            if (event.button != null && event.button !== 0) return;
            this.startGesture('move', clip, event);
        },

        onEdgeDown(clip, edge, event) {
            if (event.button != null && event.button !== 0) return;
            this.startGesture(edge, clip, event);
        },

        // ── 播放头 ──────────────────────────────
        onScrubDown(event) {
            store.pause();
            this.scrubTo(event);
            this.scrubbing = true;
            window.addEventListener('pointermove', this.onScrubMove, { passive: false });
            window.addEventListener('pointerup', this.onScrubEnd);
            window.addEventListener('pointercancel', this.onScrubEnd);
        },
        onScrubMove(event) {
            if (!this.scrubbing) return;
            event.preventDefault();
            this.scrubTo(event);
        },
        onScrubEnd() {
            this.scrubbing = false;
            window.removeEventListener('pointermove', this.onScrubMove);
            window.removeEventListener('pointerup', this.onScrubEnd);
            window.removeEventListener('pointercancel', this.onScrubEnd);
        },
        scrubTo(event) {
            store.seek(this.pxToMs(this.localX(event)));
        },

        /** 在某条轨的空白处点一下 = 在那儿新建一个剪辑 */
        onTrackBlank(track, event) {
            if (this.gesture) return;
            const at = Math.max(0, Math.round(this.pxToMs(this.localX(event))));
            const type = track.kind === 'effect' ? 'effect' : track.kind === 'bg' ? 'bg' : 'type';
            store.addClip({ type, trackId: track.id, start: at });
            store.setPanel('clip');
        },

        // ── 工具条 ──────────────────────────────
        onSplit() {
            if (!store.splitClip()) return;
        },
        onDuplicate() {
            const id = this.selectedId;
            if (!id) return this.$emit('notify', '先选中一个剪辑');
            store.duplicateClip(id);
        },
        onDelete() {
            const id = this.selectedId;
            if (!id) return this.$emit('notify', '先选中一个剪辑');
            store.openModal('confirm-clip', { id });
        },
        onToggleSnap() {
            store.setSetting('snap', !this.settings.snap);
            this.$emit('notify', this.settings.snap ? '吸附已开(0.1 秒一格)' : '吸附已关(0.01 秒一格)');
        },

        // ── 转发给 store 的动作 ─────────────────
        // ★ 模板里不直接引用模块 —— Options API 的模板只解析实例上的东西,
        //   靠 `this.store = store` 这种写法能跑但很脆,换个渲染路径就哑火。
        fmt(ms) { return formatClock(ms); },
        effectNameOf(id) { return store.getEffect(id)?.name || ''; },
        onTogglePlay() { store.togglePlay(); },
        onStop() { store.stopAndRewind(); },
        onStepClip(dir) { store.stepClip(dir); },
        onUndo() { store.undo(); },
        onRedo() { store.redo(); },
        onZoom(delta) { store.zoomBy(delta); },

        /** 播放时让播放头保持在可视区里 */
        followPlayhead() {
            const scroll = this.$refs.scroll;
            if (!scroll) return;
            const x = this.playheadX;
            const left = scroll.scrollLeft;
            const width = scroll.clientWidth;
            if (x < left + 40) scroll.scrollLeft = Math.max(0, x - 40);
            else if (x > left + width - 60) scroll.scrollLeft = x - width + 60;
        },
    },
    watch: {
        'state.time'() { if (this.state.playing) this.followPlayhead(); },
    },
    beforeUnmount() {
        this.onGestureEnd();
        this.onScrubEnd();
    },
    template: `
        <section class="hs-tl">
            <!-- 走带控制 -->
            <div class="hs-tl-bar">
                <div class="hs-tl-bar-group">
                    <HsButton icon-name="skipBack" icon-only label="上一个剪辑" size="sm" @click="onStepClip(-1)" />
                    <HsButton :icon-name="state.playing ? 'pause' : 'play'" icon-only :label="state.playing ? '暂停' : '播放'" size="sm" variant="primary" @click="onTogglePlay" />
                    <HsButton icon-name="stop" icon-only label="停止" size="sm" @click="onStop" />
                    <HsButton icon-name="skipForward" icon-only label="下一个剪辑" size="sm" @click="onStepClip(1)" />
                </div>

                <p class="hs-tl-clock">
                    <span class="hs-tl-clock-now">{{ fmt(state.time) }}</span>
                    <span class="hs-tl-clock-total">/ {{ fmt(duration) }}</span>
                </p>

                <div class="hs-tl-bar-group">
                    <HsButton icon-name="undo" icon-only label="撤销" size="sm" :disabled="!state.undoDepth" @click="onUndo" />
                    <HsButton icon-name="redo" icon-only label="重做" size="sm" :disabled="!state.redoDepth" @click="onRedo" />
                </div>
            </div>

            <div class="hs-tl-bar hs-tl-bar--second">
                <div class="hs-tl-bar-group">
                    <HsButton icon-name="scissors" icon-only label="在播放头处分割" size="sm" :disabled="!canSplit" @click="onSplit" />
                    <HsButton icon-name="copy" icon-only label="复制剪辑" size="sm" :disabled="!selectedId" @click="onDuplicate" />
                    <HsButton icon-name="trash" icon-only label="删除剪辑" size="sm" :disabled="!selectedId" @click="onDelete" />
                </div>
                <div class="hs-tl-bar-group">
                    <HsButton icon-name="magnet" icon-only label="吸附" size="sm" :active="settings.snap" @click="onToggleSnap" />
                    <HsButton icon-name="zoomOut" icon-only label="缩小" size="sm" @click="onZoom(-1)" />
                    <HsButton icon-name="zoomIn" icon-only label="放大" size="sm" @click="onZoom(1)" />
                </div>
            </div>

            <!-- 轨道区 -->
            <div class="hs-tl-scroll" ref="scroll">
                <div class="hs-tl-canvas" ref="canvas" :style="{ width: canvasWidth + 'px' }">
                    <!-- 刻度 -->
                    <div class="hs-tl-ruler" @pointerdown="onScrubDown">
                        <span
                            v-for="tick in ticks"
                            :key="tick.t"
                            class="hs-tl-tick"
                            :style="{ left: tick.x + 'px' }"
                        >{{ tick.label }}</span>
                    </div>

                    <!-- 每条轨 -->
                    <div
                        v-for="track in tracks"
                        :key="track.id"
                        class="hs-tl-track"
                        :data-kind="track.kind"
                        @pointerdown.self="onTrackBlank(track, $event)"
                    >
                        <span class="hs-tl-track-name">{{ track.label.slice(0, 2) }}</span>
                        <div
                            v-for="clip in (clipsByTrack[track.id] || [])"
                            :key="clip.id"
                            class="hs-tl-clip"
                            :class="{ 'is-on': clip.id === selectedId }"
                            :data-type="clip.type"
                            :style="clipStyle(clip)"
                            @pointerdown="onClipDown(clip, $event)"
                        >
                            <i class="hs-tl-grip hs-tl-grip--l" @pointerdown.stop="onEdgeDown(clip, 'left', $event)"></i>
                            <span class="hs-tl-clip-label">{{ clipLabel(clip) }}</span>
                            <i class="hs-tl-grip hs-tl-grip--r" @pointerdown.stop="onEdgeDown(clip, 'right', $event)"></i>
                        </div>
                    </div>

                    <!-- 播放头 -->
                    <div class="hs-tl-playhead" :style="{ left: playheadX + 'px' }" aria-hidden="true">
                        <i class="hs-tl-playhead-knob"></i>
                    </div>
                </div>
            </div>

            <p class="hs-tl-tip">
                拖剪辑改位置,拖两端改时长;点空白处新建。缩放 {{ zoom }} 像素 / 秒
            </p>
        </section>
    `,
};

export default HsTimeline;
