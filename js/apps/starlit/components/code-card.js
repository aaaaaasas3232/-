/**
 * 点灯 · 代码卡（这个 App 最重的一个组件）
 *
 * 它要同时做到：
 *   - 逐行高亮，重点行按 mark 上不同颜色
 *   - **点**一行 → 弹出这行的注释（注释不写在代码里，代码才干净）
 *   - **长按**一行 → 这行变成可编辑：CSS 声明给值选择器，其他给自由输入
 *   - 每行左边一个勾：取消勾选 = 注释掉这行，可以再勾回来
 *   - 预览区两个播放器：实时预览 / 「从一片空白里诞生」
 *
 * ── 为什么一定要长按 ────────────────────────────────────────────
 * 产品要求。也确实合理：一行一行地挂 pointerdown 计时器是有成本的，
 * 普通阅读态不该付这个钱。长按才进「可编辑模式」，进去之后才装那些监听。
 *
 * ── 性能 ────────────────────────────────────────────────────────
 * 高亮结果由 code-engine 缓存；预览 iframe 只在源码真的变了之后
 * （debounce 260ms）才重写 srcdoc —— 每敲一个字符就重建一次 iframe
 * 会把整个 App 拖垮。
 */

import {
    buildBirthFrames, buildPreviewDoc, codeLangs, focusMap,
    highlightLines, isLineDisabled, replaceLine, toggleLine,
} from '../services/code-engine.js';
import { getPropInfo, parseDeclaration, withUnit } from '../services/css-catalog.js';
import { BIRTH_PLAYER } from '../constants.js';
import { clamp } from '../utils.js';
import { UI } from './ui.js';

const LANG_LABEL = { html: 'HTML', css: 'CSS', js: 'JS' };

export const SlCodeCard = {
    name: 'SlCodeCard',
    components: { ...UI },
    props: {
        card: { type: Object, required: true },
        /** compact = 墙上的小卡（只画预览缩略，不给编辑） */
        compact: { type: Boolean, default: false },
    },
    emits: ['change', 'ask'],
    data() {
        return {
            lang: '',
            /** 点开注释的那一行 */
            openLine: 0,
            /** 长按进入编辑的那一行 */
            editLine: 0,
            editText: '',
            editDecl: null,
            /** 'live' | 'birth' */
            player: 'live',
            birthIndex: 0,
            birthPlaying: false,
            birthStep: BIRTH_PLAYER.defStep,
            srcdoc: '',
            _pressTimer: null,
            _renderTimer: null,
            _birthTimer: null,
        };
    },
    computed: {
        code() { return this.card?.code || {}; },
        langs() {
            const list = codeLangs(this.code);
            return list.length ? list : ['html'];
        },
        activeLang() {
            return this.langs.includes(this.lang) ? this.lang : this.langs[0];
        },
        source() { return String(this.code[this.activeLang] || ''); },
        lines() { return highlightLines(this.source, this.activeLang); },
        focus() { return focusMap(this.code.focus); },
        langLabel() { return LANG_LABEL; },
        previewHeight() {
            return clamp(Number(this.code.previewH) || 180, 90, 420);
        },
        /**
         * 只在切到「诞生」播放器时才算。
         * 这是个纯 computed —— 之前在这里缓存到 data 上过，
         * 那等于在自己的 getter 里写自己的响应式依赖，会递归求值。
         */
        birthFrames() {
            if (this.player !== 'birth') return [];
            return buildBirthFrames({ html: this.code.html, css: this.code.css, js: this.code.js });
        },
        birthFrame() {
            const list = this.birthFrames;
            if (!list.length) return null;
            return list[clamp(this.birthIndex, 0, list.length - 1)] || list[0];
        },
        /** 这一行有没有被勾掉 */
        disabledSet() {
            const set = new Set();
            this.lines.forEach((l) => {
                if (isLineDisabled(l.text, this.activeLang)) set.add(l.n);
            });
            return set;
        },
        openNote() {
            if (!this.openLine) return null;
            return this.focus[`${this.activeLang}:${this.openLine}`] || null;
        },
        editInfo() {
            if (!this.editDecl?.prop) return null;
            return getPropInfo(this.editDecl.prop);
        },
    },
    watch: {
        'card.id': {
            handler() {
                this.lang = '';
                this.openLine = 0;
                this.editLine = 0;
                this.birthIndex = 0;
                this.scheduleRender();
            },
        },
        player(v) {
            if (v === 'birth') { this.stopBirth(); this.birthIndex = 0; } else this.scheduleRender();
        },
    },
    mounted() {
        this.renderNow();
    },
    beforeUnmount() {
        if (this._pressTimer) clearTimeout(this._pressTimer);
        if (this._renderTimer) clearTimeout(this._renderTimer);
        this.stopBirth();
    },
    methods: {
        pickLang(l) {
            this.lang = l;
            this.openLine = 0;
            this.closeEdit();
        },

        lineClass(line) {
            const hit = this.focus[`${this.activeLang}:${line.n}`];
            return [
                hit ? `is-mark-${hit.mark}` : '',
                this.disabledSet.has(line.n) ? 'is-off' : '',
                this.openLine === line.n ? 'is-open' : '',
                this.editLine === line.n ? 'is-edit' : '',
            ].filter(Boolean);
        },

        noteOf(line) {
            return this.focus[`${this.activeLang}:${line.n}`]?.note || '';
        },

        // ---- 点：看注释 ----
        onLineClick(line) {
            if (this.editLine) return;
            if (!this.noteOf(line)) {
                // 没有注释的行点了不该有反应，否则用户以为坏了
                this.openLine = 0;
                return;
            }
            this.openLine = this.openLine === line.n ? 0 : line.n;
        },

        // ---- 长按：变可编辑 ----
        onPressStart(line, event) {
            if (this.compact) return;
            this._pressLine = line.n;
            if (this._pressTimer) clearTimeout(this._pressTimer);
            this._pressTimer = setTimeout(() => {
                this._pressTimer = null;
                this.enterEdit(line);
                if (event?.currentTarget?.classList) {
                    event.currentTarget.classList.add('is-popped');
                    setTimeout(() => event.currentTarget?.classList?.remove('is-popped'), 420);
                }
            }, 460);
        },
        onPressEnd() {
            if (this._pressTimer) { clearTimeout(this._pressTimer); this._pressTimer = null; }
        },

        enterEdit(line) {
            this.openLine = 0;
            this.editLine = line.n;
            this.editText = line.text.trim();
            this.editDecl = this.activeLang === 'css' ? parseDeclaration(line.text) : null;
            this.$nextTick(() => {
                const el = this.$refs.editInput;
                if (el?.focus) el.focus();
            });
        },
        closeEdit() {
            this.editLine = 0;
            this.editText = '';
            this.editDecl = null;
        },

        applyEdit() {
            if (!this.editLine) return;
            const next = replaceLine(this.source, this.editLine, this.editText);
            this.pushCode({ [this.activeLang]: next });
            this.closeEdit();
        },

        /** 点值选择器里的一个值 */
        pickValue(value) {
            if (!this.editDecl) return;
            const v = withUnit(this.editDecl.prop, value);
            this.editText = `${this.editDecl.prop}: ${v};`;
            this.editDecl = { ...this.editDecl, value: v };
            // 选了就直接生效，学生要的是「立刻在预览里看见变化」
            const next = replaceLine(this.source, this.editLine, this.editText);
            this.pushCode({ [this.activeLang]: next });
        },

        onCustomValue(raw) {
            if (!this.editDecl) return;
            const v = withUnit(this.editDecl.prop, raw);
            this.editText = `${this.editDecl.prop}: ${v};`;
        },

        // ---- 勾选：注释掉 / 恢复 ----
        toggleOff(line, event) {
            event?.stopPropagation?.();
            const next = toggleLine(this.source, this.activeLang, line.n);
            this.pushCode({ [this.activeLang]: next });
        },

        pushCode(patch) {
            const code = { ...this.code, ...patch };
            this.$emit('change', { code });
            this.scheduleRender(code);
        },

        /** 编辑框：CSS 声明只让改「值」那一半，其他语言整行自由改 */
        onEditInput(event) {
            const raw = String(event?.target?.value ?? '');
            if (this.editDecl) {
                this.onCustomValue(raw.replace(/^[^:]*:\s*/, '').replace(/;\s*$/, ''));
            } else {
                this.editText = raw;
            }
        },

        // ---- 预览 ----
        scheduleRender(codeOverride) {
            if (this._renderTimer) clearTimeout(this._renderTimer);
            this._renderTimer = setTimeout(() => {
                this._renderTimer = null;
                this.renderNow(codeOverride);
            }, 260);
        },
        renderNow(codeOverride) {
            const c = codeOverride || this.code;
            this.srcdoc = buildPreviewDoc({ html: c.html, css: c.css, js: c.js });
        },

        // ---- 诞生播放器 ----
        toggleBirth() {
            if (this.birthPlaying) { this.stopBirth(); return; }
            if (this.birthIndex >= this.birthFrames.length - 1) this.birthIndex = 0;
            this.birthPlaying = true;
            this.birthTick();
        },
        birthTick() {
            if (!this.birthPlaying) return;
            if (this.birthIndex >= this.birthFrames.length - 1) { this.stopBirth(); return; }
            this.birthIndex += 1;
            this._birthTimer = setTimeout(() => this.birthTick(), this.birthStep);
        },
        stopBirth() {
            this.birthPlaying = false;
            if (this._birthTimer) { clearTimeout(this._birthTimer); this._birthTimer = null; }
        },
        seekBirth(i) {
            this.stopBirth();
            this.birthIndex = clamp(Number(i) || 0, 0, this.birthFrames.length - 1);
        },
        resizePreview(delta) {
            const next = clamp(this.previewHeight + delta, 90, 420);
            this.$emit('change', { code: { ...this.code, previewH: next } });
        },
    },
    template: `
        <div class="sl-code" :class="{ 'is-compact': compact }">
            <!-- 预览区 -->
            <div class="sl-code__preview" :style="{ height: previewHeight + 'px' }">
                <iframe
                    class="sl-code__frame"
                    :srcdoc="player === 'birth' && birthFrame ? birthFrame.doc : srcdoc"
                    sandbox="allow-scripts"
                    title="预览"
                    referrerpolicy="no-referrer"
                ></iframe>
                <div v-if="player === 'birth' && birthFrame" class="sl-code__stage">{{ birthFrame.label }}</div>
            </div>

            <!-- 两个播放器 -->
            <div v-if="!compact" class="sl-code__players">
                <div class="sl-code__ptabs">
                    <button type="button" :class="{ 'is-on': player === 'live' }" @click="player = 'live'">
                        <SlIcon name="eye" :size="14" /> 实时
                    </button>
                    <button type="button" :class="{ 'is-on': player === 'birth' }" @click="player = 'birth'">
                        <SlIcon name="birth" :size="14" /> 诞生
                    </button>
                </div>

                <div v-if="player === 'birth'" class="sl-code__bar">
                    <button type="button" class="sl-code__play" @click="toggleBirth">
                        <SlIcon :name="birthPlaying ? 'pause' : 'play'" :size="14" />
                    </button>
                    <input
                        class="sl-code__seek" type="range" min="0" :max="birthFrames.length - 1"
                        :value="birthIndex" @input="seekBirth($event.target.value)"
                    />
                    <span class="sl-code__count">{{ birthIndex + 1 }}/{{ birthFrames.length }}</span>
                </div>

                <div class="sl-code__zoom">
                    <button type="button" @click="resizePreview(-40)">窄</button>
                    <button type="button" @click="resizePreview(40)">高</button>
                </div>
            </div>

            <!-- 语言页签 -->
            <div v-if="langs.length > 1" class="sl-code__tabs">
                <button
                    v-for="l in langs" :key="l" type="button"
                    :class="{ 'is-on': l === activeLang }" @click="pickLang(l)"
                >{{ langLabel[l] }}</button>
            </div>

            <!-- 代码 -->
            <div class="sl-code__body">
                <div
                    v-for="line in lines" :key="line.n"
                    class="sl-code__line" :class="lineClass(line)"
                    @click="onLineClick(line)"
                    @pointerdown="onPressStart(line, $event)"
                    @pointerup="onPressEnd"
                    @pointerleave="onPressEnd"
                    @pointercancel="onPressEnd"
                    @contextmenu.prevent="enterEdit(line)"
                >
                    <button
                        v-if="!compact" type="button" class="sl-code__tick"
                        :class="{ 'is-off': disabledSet.has(line.n) }"
                        @click="toggleOff(line, $event)"
                        :aria-label="disabledSet.has(line.n) ? '恢复这行' : '注释掉这行'"
                    ><i></i></button>
                    <span class="sl-code__n">{{ line.n }}</span>
                    <code class="sl-code__text" v-html="line.html"></code>
                    <span v-if="noteOf(line)" class="sl-code__dot"></span>
                </div>
            </div>

            <!-- 点开的注释 -->
            <transition name="sl-pop">
                <div v-if="openNote" class="sl-code__note" :class="'is-mark-' + (openNote.mark || 1)">
                    <span class="sl-code__note-n">第 {{ openLine }} 行</span>
                    <p>{{ openNote.note }}</p>
                </div>
            </transition>

            <!-- 长按之后的编辑面板 -->
            <transition name="sl-pop">
                <div v-if="editLine" class="sl-code__edit">
                    <div class="sl-code__edit-head">
                        <span>改第 {{ editLine }} 行</span>
                        <button type="button" @click="closeEdit"><SlIcon name="close" :size="15" /></button>
                    </div>

                    <div v-if="editInfo" class="sl-code__prop">
                        <div class="sl-code__prop-title">{{ editDecl.prop }} · {{ editInfo.label }}</div>
                        <p class="sl-code__prop-desc">{{ editInfo.desc }}</p>
                        <p class="sl-code__prop-why">{{ editInfo.why }}</p>

                        <div v-if="editInfo.multi" class="sl-code__multi">
                            <span v-for="m in editInfo.multi" :key="m.n">{{ m.n }} 个值：{{ m.desc }}</span>
                        </div>

                        <div class="sl-code__values">
                            <button
                                v-for="v in editInfo.values" :key="v.value" type="button"
                                class="sl-code__value" :class="{ 'is-on': editDecl.value === v.value }"
                                @click="pickValue(v.value)"
                            >
                                <b>{{ v.value }}</b>
                                <span>{{ v.label }}</span>
                                <i v-if="v.effect">{{ v.effect }}</i>
                            </button>
                        </div>
                    </div>

                    <input
                        ref="editInput" class="sl-code__input" type="text"
                        :value="editText"
                        @input="onEditInput"
                        @keydown.enter.prevent="applyEdit"
                        placeholder="直接改这一行"
                    />

                    <div class="sl-code__edit-foot">
                        <SlButton size="sm" variant="ghost" @click="$emit('ask', { line: editLine, text: editText })">
                            问老师
                        </SlButton>
                        <span class="sl-section__spacer"></span>
                        <SlButton size="sm" variant="primary" @click="applyEdit">应用</SlButton>
                    </div>
                </div>
            </transition>
        </div>
    `,
};

export default SlCodeCard;
