/**
 * 氧气 · 房间（冥想空间 / 白匣子）
 *
 * 白色的房间：纸条 / 自我标签随便贴、随便拖、随便删，全程本地。
 * 「整理」一次点击最多 3 次串行 API（聚类 → 她读一读 → 也许有礼物），
 * 完成的表现只有纸条归位和（也许）多一个几何体 —— 没有总结，没有说教。
 *
 * 她 = 一颗毛茸茸的球。出现与否由 JS 掷签（store.enterRoom），
 * 点击才开始对话，一句一调。她永远不先开口。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { icon } from '../icons.js';
import { xiaotingBodyColor } from '../utils.js';
import { SHAPES } from '../constants.js';

/** 几何体 SVG（两三个面用透明度分层，底色是 geo.color，禁渐变） */
function shapeSvg(shape, color, size) {
    const s = Number(size) || 44;
    const c = String(color || '#DDD');
    const stroke = 'rgba(0,0,0,0.22)';
    const bodies = {
        cube: `
            <polygon points="24,6 42,15 24,24 6,15" fill="${c}" stroke="${stroke}"/>
            <polygon points="6,15 24,24 24,42 6,33" fill="${c}" fill-opacity="0.75" stroke="${stroke}"/>
            <polygon points="42,15 24,24 24,42 42,33" fill="${c}" fill-opacity="0.55" stroke="${stroke}"/>`,
        sphere: `
            <circle cx="24" cy="24" r="17" fill="${c}" stroke="${stroke}"/>
            <ellipse cx="18" cy="18" rx="6" ry="4" fill="#FFFFFF" fill-opacity="0.5"/>`,
        pyramid: `
            <polygon points="24,6 42,38 24,32" fill="${c}" fill-opacity="0.6" stroke="${stroke}"/>
            <polygon points="24,6 6,38 24,32" fill="${c}" stroke="${stroke}"/>
            <polygon points="6,38 24,32 42,38" fill="${c}" fill-opacity="0.8" stroke="${stroke}"/>`,
        ring: `
            <circle cx="24" cy="24" r="16" fill="${c}" stroke="${stroke}"/>
            <circle cx="24" cy="24" r="7" fill="var(--ox-room-bg, #FFFFFF)" stroke="${stroke}"/>`,
        prism: `
            <polygon points="14,10 34,10 42,22 34,38 14,38 6,22" fill="${c}" stroke="${stroke}"/>
            <polygon points="14,10 34,10 34,38 14,38" fill="${c}" fill-opacity="0.7" stroke="${stroke}"/>`,
    };
    return `<svg viewBox="0 0 48 48" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">${bodies[shape] || bodies.sphere}</svg>`;
}

/** 毛茸茸的球：一圈确定性的短毛 + 圆身（她是内容物，配色素净） */
function furballSvg(colorL, size) {
    const s = Number(size) || 56;
    const body = xiaotingBodyColor(colorL);
    const fur = [];
    for (let i = 0; i < 26; i += 1) {
        const a = (i / 26) * Math.PI * 2;
        const wob = ((i * 7919) % 5) - 2;
        const r1 = 16;
        const r2 = 21 + wob;
        const x1 = 24 + Math.cos(a) * r1;
        const y1 = 24 + Math.sin(a) * r1;
        const x2 = 24 + Math.cos(a + 0.07) * r2;
        const y2 = 24 + Math.sin(a + 0.07) * r2;
        fur.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${body}" stroke-width="1.6" stroke-linecap="round"/>`);
    }
    return `<svg viewBox="0 0 48 48" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
        ${fur.join('')}
        <circle cx="24" cy="24" r="16.5" fill="${body}"/>
        <circle cx="19" cy="20" r="2.2" fill="rgba(255,255,255,0.55)"/>
    </svg>`;
}

export const OxRoomPage = {
    name: 'OxRoomPage',
    components: { ...UI },
    data() {
        return {
            input: '',
            listening: false,
            speechOk: typeof window !== 'undefined'
                && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
            selectedId: '',
            drag: null,          // { id, kind, dx, dy }
            dialogOpen: false,
            dialogInput: '',
            _rec: null,
        };
    },
    computed: {
        s() { return store.getState(); },
        items() { return this.s.roomItems; },
        geometries() { return store.roomGeometries(); },
        drawerCount() { return store.drawerGeometries().length; },
        x() { return this.s.xiaoting; },
        present() { return this.s.xiaotingPresent; },
        organizing() { return this.s.organize.running; },
        orgLabel() { return this.s.organize.label; },
        orgStep() { return this.s.organize.step; },
        ballSvg() { return furballSvg(this.x?.colorL ?? 85, 54); },
        ballName() { return this.x?.name || '?'; },
        dialog() { return this.s.xiaotingDialog; },
        thinking() { return this.s.xiaotingThinking; },
        memories() { return store.listMemories(); },
    },
    beforeUnmount() {
        this.stopVoice();
    },
    methods: {
        shapeHtml(geo) { return shapeSvg(geo.shape, geo.color, geo.sizeHint === '大' ? 56 : geo.sizeHint === '小' ? 34 : 44); },
        shapeLabel(id) { return (SHAPES.find((x) => x.id === id) || {}).label || id; },
        iconOf(name, size) { return icon(name, { size }); },

        // ── 贴东西 ────────────────────────────────────────
        async addNote() {
            if (!this.input.trim()) return;
            await store.addRoomItem(this.input, 'note');
            this.input = '';
        },
        async addTag() {
            if (!this.input.trim()) return;
            await store.addRoomItem(this.input, 'tag');
            this.input = '';
        },

        // ── 语音（Web Speech API；不支持自动降级为文本输入） ──
        toggleVoice() {
            if (this.listening) { this.stopVoice(); return; }
            const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!Rec) return;
            try {
                const rec = new Rec();
                rec.lang = 'zh-CN';
                rec.interimResults = false;
                rec.maxAlternatives = 1;
                rec.onresult = (e) => {
                    const text = e?.results?.[0]?.[0]?.transcript || '';
                    if (text) this.input = (this.input ? this.input + ' ' : '') + text;
                };
                rec.onend = () => { this.listening = false; this._rec = null; };
                rec.onerror = () => {
                    this.listening = false;
                    this._rec = null;
                    store.showToast('没听清，再试一次或直接打字');
                };
                rec.start();
                this._rec = rec;
                this.listening = true;
            } catch (_) {
                this.listening = false;
                store.showToast('这个浏览器不支持语音，直接打字吧');
            }
        },
        stopVoice() {
            try { this._rec?.stop?.(); } catch (_) { /* noop */ }
            this._rec = null;
            this.listening = false;
        },

        // ── 拖拽（纸条 / 标签 / 几何体共用） ────────────────
        startDrag(e, id, kind) {
            const stage = this.$refs.stage;
            if (!stage) return;
            const rect = stage.getBoundingClientRect();
            const item = kind === 'geo'
                ? this.geometries.find((g) => String(g.id) === String(id))
                : this.items.find((n) => String(n.id) === String(id));
            if (!item) return;
            this.selectedId = id;
            this.drag = {
                id, kind,
                dx: ((e.clientX - rect.left) / rect.width) * 100 - item.x,
                dy: ((e.clientY - rect.top) / rect.height) * 100 - item.y,
                moved: false,
            };
            try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) { /* noop */ }
        },
        onDragMove(e) {
            if (!this.drag) return;
            const stage = this.$refs.stage;
            if (!stage) return;
            const rect = stage.getBoundingClientRect();
            const nx = ((e.clientX - rect.left) / rect.width) * 100 - this.drag.dx;
            const ny = ((e.clientY - rect.top) / rect.height) * 100 - this.drag.dy;
            this.drag.moved = true;
            const list = this.drag.kind === 'geo' ? this.geometries : this.items;
            const item = list.find((n) => String(n.id) === String(this.drag.id));
            if (item) {
                item.x = Math.max(0, Math.min(88, nx));
                item.y = Math.max(0, Math.min(78, ny));
            }
        },
        async endDrag() {
            if (!this.drag) return;
            const { id, kind, moved } = this.drag;
            this.drag = null;
            if (!moved) return;
            const list = kind === 'geo' ? this.geometries : this.items;
            const item = list.find((n) => String(n.id) === String(id));
            if (!item) return;
            if (kind === 'geo') await store.moveGeometry(id, item.x, item.y);
            else await store.moveRoomItem(id, item.x, item.y);
        },

        select(id) { this.selectedId = this.selectedId === id ? '' : id; },
        async removeItem(id) {
            await store.removeRoomItem(id);
            if (this.selectedId === id) this.selectedId = '';
        },
        openGeometry(geo) {
            store.openModal('geometry', { geometryId: geo.id });
        },
        openDrawer() { store.openModal('drawer', {}); },

        organize() { void store.runOrganize(); },

        // ── 她 ────────────────────────────────────────────
        toggleDialog() { this.dialogOpen = !this.dialogOpen; },
        async sendDialog() {
            const text = this.dialogInput.trim();
            if (!text) return;
            this.dialogInput = '';
            await store.xiaotingSend(text);
            this.$nextTick(() => {
                const box = this.$refs.dialogList;
                if (box) box.scrollTop = box.scrollHeight;
            });
        },
        nameHer() { store.openModal('xiaoting-name', {}); },
        teachHer() { store.openModal('xiaoting-teach', {}); },
        forgetMemory(idx) { void store.removeMemory(idx); },
    },
    template: `
        <div class="ox-page ox-roompage">
            <div class="ox-room__intro">
                <span>把任何话贴进来。贴、拖、删、说，都只发生在本地。</span>
                <button v-if="drawerCount" type="button" class="ox-room__drawerbtn" @click="openDrawer">
                    <OxIcon name="drawer" :size="14" /> 抽屉 {{ drawerCount }}
                </button>
            </div>

            <!-- 白盒 -->
            <div
                ref="stage" class="ox-room__stage"
                @pointermove="onDragMove" @pointerup="endDrag" @pointercancel="endDrag"
            >
                <div class="ox-room__floor"></div>

                <!-- 纸条 / 自我标签 / 她留的小纸条 -->
                <div
                    v-for="n in items" :key="n.id"
                    class="ox-note"
                    :class="['ox-note--' + n.kind, { 'is-selected': selectedId === n.id }]"
                    :style="{ left: n.x + '%', top: n.y + '%', transform: 'rotate(' + (n.rot || 0) + 'deg)' }"
                    @pointerdown="e => startDrag(e, n.id, 'note')"
                    @click.stop="select(n.id)"
                >
                    <i v-if="n.groupLabel" class="ox-note__group">{{ n.groupLabel }}</i>
                    <span class="ox-note__text">{{ n.text }}</span>
                    <button
                        v-if="selectedId === n.id" type="button" class="ox-note__x"
                        @pointerdown.stop @click.stop="removeItem(n.id)"
                    >×</button>
                </div>

                <!-- 几何体（她的礼物） -->
                <div
                    v-for="g in geometries" :key="g.id"
                    class="ox-geo"
                    :style="{ left: g.x + '%', top: g.y + '%' }"
                    @pointerdown="e => startDrag(e, g.id, 'geo')"
                    @click.stop="openGeometry(g)"
                    v-html="shapeHtml(g)"
                ></div>

                <!-- 她（出现时才在；点击才说话） -->
                <button
                    v-if="present" type="button" class="ox-ball"
                    :title="ballName" @click.stop="toggleDialog"
                >
                    <span class="ox-ball__body" v-html="ballSvg"></span>
                    <span class="ox-ball__name">{{ ballName }}</span>
                </button>

                <!-- 整理进行中：一行小字 + 呼吸圈，不挡操作视线 -->
                <div v-if="organizing" class="ox-room__organizing">
                    <span class="ox-room__orgring"></span>
                    <span>{{ orgLabel }}（{{ orgStep }}/3）</span>
                </div>
            </div>

            <!-- 输入坞 -->
            <div class="ox-room__dock">
                <input
                    v-model="input" class="ox-room__input" type="text" maxlength="120"
                    placeholder="想说什么都可以"
                    @keydown.enter.prevent="addNote"
                />
                <button
                    v-if="speechOk" type="button" class="ox-room__mic" :class="{ 'is-on': listening }"
                    :title="listening ? '停止' : '语音输入'" @click="toggleVoice"
                ><OxIcon name="mic" :size="17" /></button>
            </div>
            <div class="ox-room__dockrow">
                <OxButton size="sm" :disabled="!input.trim()" @click="addNote">贴成纸条</OxButton>
                <OxButton size="sm" variant="soft" :disabled="!input.trim()" @click="addTag">贴成自我标签</OxButton>
                <span class="ox-room__spacer"></span>
                <OxButton size="sm" variant="ink" :loading="organizing" @click="organize">整理</OxButton>
            </div>

            <!-- 她的对话（极简浮层，不做聊天气泡堆） -->
            <div v-if="dialogOpen && present" class="ox-balltalk" @click.self="toggleDialog">
                <div class="ox-balltalk__panel">
                    <div class="ox-balltalk__head">
                        <span class="ox-balltalk__who" v-html="iconOf('logo', 16)"></span>
                        <span class="ox-balltalk__name">{{ ballName }}</span>
                        <button type="button" class="ox-balltalk__mini" @click="nameHer">取名</button>
                        <button type="button" class="ox-balltalk__mini" @click="teachHer">教她说话</button>
                        <span class="ox-room__spacer"></span>
                        <button type="button" class="ox-balltalk__x" @click="toggleDialog">×</button>
                    </div>
                    <div ref="dialogList" class="ox-balltalk__list">
                        <p v-if="!dialog.length" class="ox-balltalk__empty">她在。你可以说点什么，也可以什么都不说。</p>
                        <template v-for="(m, i) in dialog" :key="i">
                            <p v-if="m.role === 'user'" class="ox-balltalk__line is-user">{{ m.text }}</p>
                            <p v-else-if="m.role === 'peer'" class="ox-balltalk__line is-peer">{{ m.text }}</p>
                            <div v-else-if="m.role === 'memories'" class="ox-balltalk__memories">
                                <p v-if="m.text" class="ox-balltalk__line is-peer">{{ m.text }}</p>
                                <template v-else>
                                    <p class="ox-balltalk__memtitle">她记得的（你都可以拿走）：</p>
                                    <div v-for="(f, mi) in memories" :key="mi" class="ox-balltalk__mem">
                                        <span>{{ f.text }}</span>
                                        <button type="button" @click="forgetMemory(mi)">忘掉</button>
                                    </div>
                                </template>
                            </div>
                        </template>
                        <p v-if="thinking" class="ox-balltalk__line is-peer is-thinking">……</p>
                    </div>
                    <div class="ox-balltalk__inputrow">
                        <input
                            v-model="dialogInput" class="ox-room__input" type="text" maxlength="120"
                            placeholder="和她说一句（问「你记得什么」试试）"
                            @keydown.enter.prevent="sendDialog"
                        />
                        <OxButton size="sm" variant="ink" icon-name="send" :disabled="thinking" @click="sendDialog"></OxButton>
                    </div>
                </div>
            </div>
        </div>
    `,
};
