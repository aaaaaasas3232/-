/**
 * 四叶草 · 小剧场
 *
 * ── 为什么是结构化的，不是一大坨文本 ──────────────────────────────
 *
 * 台词存成 `scenes[].lines[] = { speaker, text }` 而不是一整段文字，换来三件事：
 *
 *   1. 用户能**改其中一句**，不用把整段重写
 *   2. 能**重 roll 单独一场**（暂时只做了整场重 roll，但结构已经支持）
 *   3. 将来的「情景聊天」App 要接着往下演，它需要知道每句是谁说的 ——
 *      纯文本得再解析一次，而解析一定会出错
 *
 * ── 编辑是就地的 ──────────────────────────────────────────────────
 *
 * 点一句台词直接变输入框，失焦即改。不做「编辑模式」开关 ——
 * 那会逼用户先想起「哦要先点编辑」，而他此刻只是想改一个错字。
 * 改完统一按「保存」落盘（不做自动保存，因为重 roll 会整场换掉，
 * 自动保存会让「我改了一半又想要原来的」变得不可能）。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { SpLoadingScreen } from './loading.js';
import { icon } from '../icons.js';
import { asArray, countWords, fmtTime } from '../utils.js';

export const SpTheaterPage = {
    name: 'SpTheaterPage',
    components: { ...UI, SpLoadingScreen },
    data() {
        return { dirty: false, editingId: '' };
    },
    computed: {
        s() { return store.getState(); },
        t() { return this.s.theater; },
        loading() { return this.s.loading.theater; },
        summarizing() { return this.s.loading.summary; },
        scenes() { return asArray(this.t?.scenes); },
        cast() { return asArray(this.t?.participants).map((p) => p.name).filter(Boolean); },
        words() {
            const all = this.scenes.flatMap((sc) => [sc.narration, ...asArray(sc.lines).map((l) => l.text)]);
            return countWords(all.join(''));
        },
        backSvg() { return icon('back', { size: 20 }); },
    },
    methods: {
        when(x) { return fmtTime(x); },
        close() { store.closeTheater(); },

        editLine(id) { this.editingId = id; },
        commitLine(line, e) {
            const next = String(e.target.value || '').trim();
            if (next !== line.text) { line.text = next; this.dirty = true; }
            this.editingId = '';
        },
        commitNarration(scene, e) {
            const next = String(e.target.value || '').trim();
            if (next !== scene.narration) { scene.narration = next; this.dirty = true; }
        },
        commitTitle(e) {
            const next = String(e.target.value || '').trim();
            if (next && next !== this.t.title) { this.t.title = next; this.dirty = true; }
        },
        dropLine(scene, line) {
            scene.lines = scene.lines.filter((l) => l.id !== line.id);
            this.dirty = true;
        },

        async save() {
            await store.saveTheaterEdits(this.t);
            this.dirty = false;
        },
        async reroll() {
            await store.rerollTheater(this.t);
            this.dirty = false;
        },
        async makeSummary() {
            await store.generateSummary(this.t);
        },
        share() {
            if (!this.t.summary) {
                store.showToast('先生成概要再分享');
                return;
            }
            store.openModal('share-theater', { theater: this.t });
        },
    },
    template: `
        <div class="sp-theater">
            <header class="sp-panel__bar">
                <button class="sp-iconbtn" @click="close" v-html="backSvg"></button>
                <span class="sp-panel__title">小剧场</span>
                <div class="sp-panel__bar-right">
                    <sp-btn v-if="dirty" size="sm" variant="primary" @click="save">保存</sp-btn>
                </div>
            </header>

            <sp-loading-screen v-if="loading" kind="theater" />

            <div v-else-if="!t" class="sp-panel__body">
                <sp-empty icon="theater" title="没有这一场" />
            </div>

            <div v-else class="sp-panel__body">
                <input class="sp-theater__title" :value="t.title" @change="commitTitle" spellcheck="false" />
                <p class="sp-theater__meta">
                    {{ cast.length ? cast.join('、') : '只有你' }} · {{ words }} 字 · {{ when(t.createdAt) }}
                </p>

                <section v-for="(sc, i) in scenes" :key="sc.id" class="sp-scene">
                    <header class="sp-scene__head">
                        <span class="sp-scene__no">第 {{ i + 1 }} 场</span>
                        <span v-if="sc.place" class="sp-scene__place">{{ sc.place }}</span>
                    </header>
                    <textarea
                        class="sp-scene__narration"
                        :value="sc.narration"
                        rows="2"
                        @change="commitNarration(sc, $event)"
                    ></textarea>
                    <div class="sp-lines">
                        <div v-for="l in sc.lines" :key="l.id" class="sp-line">
                            <span class="sp-line__who">{{ l.speaker }}</span>
                            <textarea
                                v-if="editingId === l.id"
                                class="sp-line__edit"
                                :value="l.text"
                                rows="2"
                                @blur="commitLine(l, $event)"
                            ></textarea>
                            <p v-else class="sp-line__text" @click="editLine(l.id)">{{ l.text }}</p>
                            <button class="sp-line__x" @click="dropLine(sc, l)">删</button>
                        </div>
                    </div>
                </section>

                <p v-if="t.closing" class="sp-theater__closing">{{ t.closing }}</p>

                <sp-section title="概要" sub="给 AI 记住的是这个">
                    <p v-if="t.summary" class="sp-theater__summary">{{ t.summary }}</p>
                    <p v-else-if="summarizing" class="sp-panel__note">正在写…</p>
                    <p v-else class="sp-panel__note">还没生成。概要会进 AI 的上下文，全文不会。</p>
                    <div class="sp-detail__tools">
                        <sp-btn size="sm" variant="ghost" icon="scroll" :loading="summarizing" @click="makeSummary">
                            {{ t.summary ? '重写概要' : '生成概要' }}
                        </sp-btn>
                        <sp-btn size="sm" variant="ghost" icon="share" @click="share">分享到聊天</sp-btn>
                        <sp-btn size="sm" variant="ghost" icon="dice" @click="reroll">整场重来</sp-btn>
                    </div>
                </sp-section>

                <p class="sp-panel__note sp-panel__note--faint">
                    这场戏的台词按人保存着。以后接上「情景聊天」，就能从这儿接着往下演。
                </p>
            </div>
        </div>
    `,
};
