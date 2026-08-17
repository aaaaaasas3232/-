/**
 * 小奇怪 · 匿名三件套的公共件
 *
 * 回答箱 / 收信箱 / 漂流瓶长得不一样,但底下这几件事一模一样:
 *
 *   · 有没有可用的 API、当前世界观里有没有人
 *   · 一次性向一批 AI 发请求时的进度与「某个座位挂了就跳过」
 *   · 每条记录都要能重写(reroll) / 编辑 / 删除
 *   · 对话气泡怎么画、输入框怎么画
 *
 * 抽在这里,三个 view 只写自己那点玩法。
 *
 * ★ 不用 emoji,不用 ✕ 这种符号当按钮 —— 全站规矩(见 icons.js 顶部)。
 *   删除就写「删除」两个字。
 */

import * as store from '../store.js';
import * as anon from '../services/anon-service.js';
import * as nook from '../services/nook-bridge.js';
import { asArray } from '../utils.js';
import { SHARED_COMPONENTS } from './shared.js';

// ============================================================
// 对话气泡
// ============================================================

export const OqThread = {
    name: 'OqThread',
    props: {
        turns: { type: Array, default: () => [] },
        /** 对面这一侧显示成什么 */
        themLabel: { type: String, default: '' },
        /** 只展开最后几轮,其余折叠 —— 一条二十轮的对话会把整个列表撑没 */
        collapsed: { type: Boolean, default: false },
        limit: { type: Number, default: 2 },
    },
    emits: ['expand'],
    computed: {
        hiddenCount() {
            const total = asArray(this.turns).length;
            return this.collapsed && total > this.limit ? total - this.limit : 0;
        },
        shown() {
            const list = asArray(this.turns);
            return this.hiddenCount ? list.slice(-this.limit) : list;
        },
    },
    template: `
        <div v-if="shown.length" class="oq-thread">
            <button
                v-if="hiddenCount"
                type="button"
                class="oq-thread-more"
                @click="$emit('expand')"
            >上面还有 {{ hiddenCount }} 句</button>
            <div
                v-for="turn in shown"
                :key="turn.id"
                class="oq-turn"
                :class="turn.role === 'me' ? 'is-me' : 'is-them'"
            >
                <span class="oq-turn-who">{{ turn.role === 'me' ? '我' : (themLabel || '对方') }}</span>
                <p class="oq-turn-text">{{ turn.text }}</p>
            </div>
        </div>
    `,
};

// ============================================================
// 写字的地方
// ============================================================

export const OqComposer = {
    name: 'OqComposer',
    props: {
        modelValue: { type: String, default: '' },
        placeholder: { type: String, default: '' },
        submitLabel: { type: String, default: '送出' },
        busy: { type: Boolean, default: false },
        rows: { type: Number, default: 3 },
        maxlength: { type: Number, default: 300 },
    },
    emits: ['update:modelValue', 'submit', 'cancel'],
    computed: {
        canSubmit() {
            return !this.busy && String(this.modelValue || '').trim().length > 0;
        },
        left() {
            return this.maxlength - String(this.modelValue || '').length;
        },
    },
    template: `
        <div class="oq-composer">
            <textarea
                class="oq-input oq-composer-area"
                :rows="rows"
                :maxlength="maxlength"
                :placeholder="placeholder"
                :value="modelValue"
                @input="$emit('update:modelValue', $event.target.value)"
            ></textarea>
            <div class="oq-composer-foot">
                <span class="oq-composer-count">还能写 {{ left }} 字</span>
                <span class="oq-composer-acts">
                    <button type="button" class="oq-mini" @click="$emit('cancel')">收起</button>
                    <button
                        type="button"
                        class="oq-mini"
                        data-tone="accent"
                        :disabled="!canSubmit"
                        :class="{ 'is-loading': busy }"
                        @click="$emit('submit')"
                    >{{ busy ? '送出中' : submitLabel }}</button>
                </span>
            </div>
        </div>
    `,
};

/** 页面顶部那一条状态：现在有几个人在场 / 有没有 Key / 正在跑第几个 */
export const OqAnonStatus = {
    name: 'OqAnonStatus',
    props: {
        count: { type: Number, default: 0 },
        text: { type: String, default: '' },
        progress: { type: String, default: '' },
        error: { type: String, default: '' },
    },
    template: `
        <div class="oq-anon-status">
            <p v-if="progress" class="oq-anon-status-line is-busy">
                <span class="oq-anon-spin" aria-hidden="true"></span>{{ progress }}
            </p>
            <p v-else-if="error" class="oq-anon-status-line is-bad">{{ error }}</p>
            <p v-else class="oq-anon-status-line">{{ text }}</p>
        </div>
    `,
};

export const ANON_COMPONENTS = { ...SHARED_COMPONENTS, OqThread, OqComposer, OqAnonStatus };

// ============================================================
// 混入
// ============================================================

/**
 * 三个 view 共用的那一半。
 *
 * ★ `methods` 里全部用方法简写。写成箭头函数的话 `this` 会指向模块作用域,
 *   按钮点了没反应而且不报错(AGENTS.md §10 表里的第一行)。
 */
export const anonMixin = {
    props: {
        app: { type: Object, default: null },
    },
    emits: ['notify'],
    data() {
        const settings = store.getSettings();
        return {
            /** 正在跑批时显示「第 2 / 5 位」 */
            progress: '',
            error: '',
            /** 单条记录级别的忙碌位:`{ [id]: true }` */
            busyMap: {},
            expanded: {},
            customPrompt: settings.anonCustomPrompt || '',
            disableEmoji: settings.anonDisableEmoji !== false,
            shareToMurmur: settings.anonShareToMurmur !== false,
        };
    },
    computed: {
        panel() { return store.getState().panel; },
        people() { return anon.roster(); },
        worldLabel() { return anon.worldName(); },
        apiReady() { return nook.listApiRefs().length > 0; },
        running() { return this.progress !== ''; },
        aiOpts() {
            return { custom: this.customPrompt, disableEmoji: this.disableEmoji };
        },
    },
    watch: {
        customPrompt(value) { store.patchSettings({ anonCustomPrompt: value }); },
        disableEmoji(value) { store.patchSettings({ anonDisableEmoji: value }); },
        shareToMurmur(value) {
            store.patchSettings({ anonShareToMurmur: value });
            store.syncAnonToMurmur();
        },
    },
    beforeUnmount() {
        this._dead = true;
    },
    methods: {
        closePanel() {
            store.closePanel();
        },
        isBusy(id) {
            return this.busyMap[String(id)] === true;
        },
        setBusy(id, value) {
            // 直接赋值而不是 delete —— Vue 3 的 reactive 对 delete 也能追踪,
            // 但 `{...map}` 重建会让所有卡片一起重渲染
            this.busyMap[String(id)] = value === true;
        },
        toggleExpand(id) {
            this.expanded[String(id)] = !this.expanded[String(id)];
        },
        isExpanded(id) {
            return this.expanded[String(id)] === true;
        },
        /**
         * 跑一批。
         *
         * 逐个串行而不是 Promise.all —— 同一把 Key 上并发十个请求会直接吃 429,
         * 而这个页面本来就不赶时间。某一个失败只记一笔,不打断后面的。
         */
        async runBatch(list, worker, label = '正在等回应') {
            if (this.running) return { done: 0, failed: 0 };
            this.error = '';
            let done = 0;
            let failed = 0;
            const total = list.length;
            for (let i = 0; i < total; i += 1) {
                if (this._dead) break;
                this.progress = `${label} · 第 ${i + 1} / ${total} 位`;
                try {
                    const ok = await worker(list[i], i);
                    if (ok) done += 1; else failed += 1;
                } catch (err) {
                    console.warn('[oddity/anon] 批处理里有一位挂了', err);
                    failed += 1;
                }
            }
            this.progress = '';
            if (!done && failed) this.error = '一个回应都没等到,去 nook 检查一下 API';
            return { done, failed };
        },
        /** 没人 / 没 Key 时给一句能照着做的话,而不是空白 */
        guard() {
            if (!this.people.length) {
                this.$emit('notify', '当前世界观里还没有 AI 角色,先去 nook 添加');
                return false;
            }
            if (!this.apiReady) {
                this.$emit('notify', nook.describeMissingApi());
                return false;
            }
            return true;
        },
    },
};
