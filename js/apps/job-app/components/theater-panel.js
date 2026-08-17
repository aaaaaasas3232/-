/**
 * 灯塔 · 一天的小剧场
 *
 * 看 / 改 / 重演 / 删。
 *
 * ── 为什么台词是结构化的而不是一大坨文本 ──────────────────────────
 *
 * 两个理由，都不是「看起来整齐」：
 *   1. 用户要能改**其中一句**。纯文本只能整篇替换。
 *   2. 以后的 idol App / 博客 App 要知道每一句是谁说的。
 *      纯文本它们得再解析一遍，而解析一定会出错。
 *
 * ── 重演会退钱 ────────────────────────────────────────────────────
 *
 * 重演前先把上一版带来的进账撤掉。不撤的话演一场刷十次，
 * 钱包能刷出十天的工资，流水里还全是同一天的重复记录。
 * 这条逻辑在 store 里（`rerollTheater` → `deleteTheater` → `revokeTheaterPay`），
 * 这里只负责把「会退钱」这件事说清楚。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { PERFORMANCE_LEVELS } from '../constants.js';
import { labelOfLevel } from '../services/payroll-service.js';
import { fmtDay } from '../utils.js';

export const JbTheaterPanel = {
    name: 'JbTheaterPanel',
    components: { ...UI },
    emits: ['close'],
    data() {
        return { editing: false, draft: null };
    },
    computed: {
        s() { return store.getState(); },
        t() { return store.currentTheater(); },
        post() {
            return this.s.posts.find((p) => String(p.id) === String(this.t?.postId)) || null;
        },
        currency() { return this.s.identity.currency; },
        busy() { return this.s.loading.theater; },
        digesting() { return this.s.loading.digest; },
        levels() { return PERFORMANCE_LEVELS; },
        levelText() { return this.t ? labelOfLevel(this.t.performance.level) : ''; },
        dayText() { return this.t ? fmtDay(this.t.day) : ''; },
        /** 编辑时用 draft，不直接改 t —— 用户点「取消」要能真的回到原样 */
        view() { return this.editing ? this.draft : this.t; },
    },
    methods: {
        close() { store.closeTheater(); },
        clearError() { store.clearError(); },

        startEdit() {
            // 深拷贝一份，避免编辑中途的半成品被别的地方读到
            this.draft = JSON.parse(JSON.stringify(this.t));
            this.editing = true;
        },
        cancelEdit() {
            this.editing = false;
            this.draft = null;
        },
        async saveEdit() {
            Object.assign(this.t, this.draft);
            await store.saveTheaterEdits(this.t);
            this.editing = false;
            this.draft = null;
        },
        setLine(sceneId, lineId, text) {
            const sc = this.draft.scenes.find((x) => x.id === sceneId);
            const ln = sc?.lines.find((x) => x.id === lineId);
            if (ln) ln.text = text;
        },
        setNarration(sceneId, text) {
            const sc = this.draft.scenes.find((x) => x.id === sceneId);
            if (sc) sc.narration = text;
        },
        dropLine(sceneId, lineId) {
            const sc = this.draft.scenes.find((x) => x.id === sceneId);
            if (sc) sc.lines = sc.lines.filter((x) => x.id !== lineId);
        },

        async reroll() {
            const t = this.t;
            if (!t) return;
            const api = typeof window !== 'undefined' ? window.__phoneConfirm : null;
            const doIt = () => store.rerollTheater(t);
            if (!api?.request) { doIt(); return; }
            api.request({
                title: '重演这一天？',
                text: `现在这一版会被删掉，当天到账的 ${t.paid || 0} ${this.currency} 也会一起撤回，然后重新演一次。`,
                confirmLabel: '重演',
                onConfirm: doIt,
            });
        },
        remove() {
            const t = this.t;
            if (!t) return;
            const api = typeof window !== 'undefined' ? window.__phoneConfirm : null;
            const doIt = () => store.deleteTheater(t.id);
            if (!api?.request) { doIt(); return; }
            api.request({
                title: '删掉这一天？',
                text: `当天到账的 ${t.paid || 0} ${this.currency} 会一起撤回。这天会重新变成「没演过」。`,
                confirmLabel: '删掉',
                danger: true,
                onConfirm: doIt,
            });
        },
        async rewriteDigest() {
            await store.generateDigest(this.post, this.t);
        },
    },
    template: `
        <jb-panel :title="dayText" @close="close">
            <template #bar>
                <jb-btn v-if="!editing" size="sm" variant="ghost" icon="edit" @click="startEdit">改</jb-btn>
                <template v-else>
                    <jb-btn size="sm" variant="ghost" @click="cancelEdit">取消</jb-btn>
                    <jb-btn size="sm" variant="primary" @click="saveEdit">保存</jb-btn>
                </template>
            </template>

            <div v-if="!t" class="jb-empty"><p class="jb-empty__title">这一天不见了</p></div>

            <template v-else>
                <jb-error :text="s.error" @close="clearError" />

                <!-- 抬头 -->
                <section class="jb-card jb-card--pad jb-th__hero">
                    <h1 v-if="!editing" class="jb-th__title">{{ t.title }}</h1>
                    <jb-input v-else :model-value="draft.title" :maxlength="24"
                        @update:model-value="draft.title = $event" />
                    <p class="jb-th__meta">
                        <span v-if="post">{{ post.title }}</span>
                        <span>{{ dayText }}</span>
                    </p>
                    <div class="jb-th__score">
                        <span class="jb-th__lv">{{ levelText }}</span>
                        <jb-money v-if="t.paid > 0" :value="t.paid" :currency="currency" tone="in" :sign="true" size="sm" />
                        <span v-else-if="post && post.pay.mode === 'monthly'" class="jb-th__nopay">月结，不按天发</span>
                        <span v-else class="jb-th__nopay">这天没进账</span>
                    </div>
                    <p v-if="t.performance.note" class="jb-th__note">{{ t.performance.note }}</p>
                </section>

                <!-- 正文 -->
                <div v-for="sc in view.scenes" :key="sc.id" class="jb-th__scene">
                    <h3 v-if="sc.place" class="jb-th__place">{{ sc.place }}</h3>

                    <p v-if="!editing && sc.narration" class="jb-th__narration">{{ sc.narration }}</p>
                    <jb-textarea v-else-if="editing" :model-value="sc.narration" :rows="2"
                        @update:model-value="setNarration(sc.id, $event)" />

                    <div v-for="ln in sc.lines" :key="ln.id" class="jb-th__line">
                        <span class="jb-th__who">{{ ln.speaker }}</span>
                        <p v-if="!editing" class="jb-th__text">{{ ln.text }}</p>
                        <template v-else>
                            <jb-textarea :model-value="ln.text" :rows="2"
                                @update:model-value="setLine(sc.id, ln.id, $event)" />
                            <jb-btn size="sm" variant="ghost" icon="trash" @click="dropLine(sc.id, ln.id)">
                                删掉这句
                            </jb-btn>
                        </template>
                    </div>
                </div>

                <p v-if="view.closing" class="jb-th__closing">{{ view.closing }}</p>

                <!-- 当天梗概 -->
                <jb-section title="这天的工作记录" sub="以后生成小剧场时会读它">
                    <div class="jb-card jb-card--pad">
                        <p v-if="t.digest" class="jb-th__digest">{{ t.digest }}</p>
                        <p v-else-if="digesting" class="jb-panel__note">正在写…</p>
                        <p v-else class="jb-panel__note">
                            这天还没有记录。没有记录的话，后面几天的剧情接不上这一天。
                        </p>
                        <jb-btn size="sm" variant="ghost" icon="refresh" :loading="digesting" @click="rewriteDigest">
                            {{ t.digest ? '重新写一份' : '现在写一份' }}
                        </jb-btn>
                    </div>
                </jb-section>

                <!-- 操作 -->
                <div v-if="!editing" class="jb-th__actions">
                    <jb-btn variant="line" icon="dice" block :loading="busy" @click="reroll">重演这一天</jb-btn>
                    <jb-btn variant="ghost" icon="trash" block @click="remove">删掉</jb-btn>
                </div>
            </template>
        </jb-panel>
    `,
};
