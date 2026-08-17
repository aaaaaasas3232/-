/**
 * 四叶草 · 首次配置
 *
 * ── 为什么长得像新手机的载入界面 ──────────────────────────────────
 *
 * 这一步在做的事很重的：它决定这个购物软件里**所有内容**长什么样。
 * 用一个塞满选项的设置页去问，用户会当成「又一个设置页」随手划过去，
 * 然后抱怨生成的东西和世界观没关系。
 *
 * 所以借新设备激活那套语言：一屏一件事、大字、大量留白、
 * 底部一个继续键。它传达的是「这是开始，不是配置」。
 *
 * ── 四步 ──────────────────────────────────────────────────────────
 *   0 欢迎     确认「你在哪个世界、用什么钱」
 *   1 夹子     从世界观的碎知识里挑
 *   2 提示词   从 prompt 库里挑 + 补一句口味
 *   3 生成中   两张列表并行生成
 *
 * 世界观的**简介**和**资金映射**不在选项里 —— 它们是必传的，
 * 没有它们这个 App 就没有意义。第 0 屏把它们摆出来给用户确认，
 * 但不给关掉的开关。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { SpLoading } from './loading.js';
import { icon } from '../icons.js';
import { readSummary } from '../services/world-context.js';
import { truncate } from '../utils.js';

export const SpOnboarding = {
    name: 'SpOnboarding',
    components: { ...UI, SpLoading },
    data() {
        return { generating: false, failed: '' };
    },
    computed: {
        s() { return store.getState(); },
        ob() { return this.s.onboarding; },
        step() { return this.ob.step; },
        identity() { return this.s.identity; },
        summary() { return readSummary(this.identity.world); },
        cloverMark() { return icon('clover', { size: 40 }); },

        clips() { return this.ob.clips; },
        prompts() { return this.ob.prompts; },

        canNext() {
            // 夹子和提示词都允许一个都不选 —— 世界观简介本身就够生成了。
            // 强制至少选一个的话，没写过夹子的用户会卡在这一步出不去。
            return true;
        },
        stepTitle() {
            return ['欢迎来到四叶草', '这个世界里有什么', '还想让它知道什么'][this.step] || '';
        },
        stepDesc() {
            return [
                '这里卖的每一样东西都由这个世界决定。先确认一下你在哪儿。',
                '挑几个夹子。挑中的会进提示词，影响生成出来的商品和店铺。',
                '从 prompt 库里挑，或者直接用一句话说说你想逛到什么。',
            ][this.step] || '';
        },
    },
    methods: {
        next() {
            if (this.step >= 2) { this.finish(); return; }
            store.setOnboardingStep(this.step + 1);
        },
        back() { store.setOnboardingStep(this.step - 1); },
        toggleClip(id) { store.toggleClip(id); },
        togglePrompt(id) { store.toggleLibraryPrompt(id); },
        setTaste(v) { store.setTaste(v); },
        isClipOn(id) { return this.ob.clipIds.includes(id); },
        isPromptOn(id) { return this.ob.promptIds.includes(id); },
        brief(text) { return truncate(text, 56); },

        async finish() {
            this.generating = true;
            this.failed = '';
            const ok = await store.finishOnboarding();
            this.generating = false;
            // ★ 生成失败**不**把用户退回引导页。配置本身是成功的，
            //   失败的只是第一批内容 —— 退回去会让他以为配置没保存，
            //   然后从头再填一遍。留在列表页点「换一批」就行。
            if (!ok && this.s.error) this.failed = this.s.error;
        },
    },
    template: `
        <div class="sp-ob" v-if="!generating">
            <div class="sp-ob__stage">
                <div v-if="step === 0" class="sp-ob__hero">
                    <span class="sp-ob__mark" v-html="cloverMark"></span>
                </div>

                <h1 class="sp-ob__title">{{ stepTitle }}</h1>
                <p class="sp-ob__desc">{{ stepDesc }}</p>

                <!-- 0 · 欢迎：世界观简介 + 资金映射，两者必传，只确认不可关 -->
                <div v-if="step === 0" class="sp-ob__panel">
                    <div class="sp-ob__pill">
                        <span class="sp-ob__pill-k">世界观</span>
                        <span class="sp-ob__pill-v">{{ identity.worldName || '未命名' }}</span>
                    </div>
                    <div class="sp-ob__pill">
                        <span class="sp-ob__pill-k">这里用</span>
                        <span class="sp-ob__pill-v sp-ob__pill-v--coin">{{ identity.currency }}</span>
                        <span class="sp-ob__pill-note">所有标价都会是它</span>
                    </div>
                    <div class="sp-ob__summary">
                        <p v-if="summary" class="sp-ob__summary-text">{{ summary }}</p>
                        <p v-else class="sp-ob__summary-empty">
                            这个世界观还没写简介。可以先用着，回头去「设置 → 世界观」补一段，
                            生成出来的东西会准很多。
                        </p>
                    </div>
                </div>

                <!-- 1 · 夹子 -->
                <div v-else-if="step === 1" class="sp-ob__panel">
                    <div v-if="!clips.length" class="sp-ob__none">
                        这个世界观还没有夹子。跳过就行，之后在「设置 → 世界观 → 夹子」里加了随时能回来选。
                    </div>
                    <button
                        v-for="c in clips" :key="c.id"
                        class="sp-ob__card" :class="{ 'is-on': isClipOn(c.id) }"
                        @click="toggleClip(c.id)"
                    >
                        <span class="sp-ob__card-tick"></span>
                        <span class="sp-ob__card-main">
                            <span class="sp-ob__card-title">{{ c.title }}</span>
                            <span class="sp-ob__card-sub">{{ brief(c.content) }}</span>
                        </span>
                    </button>
                </div>

                <!-- 2 · prompt 库 + 口味 -->
                <div v-else class="sp-ob__panel">
                    <div v-if="ob.loading" class="sp-ob__none">正在读 prompt 库…</div>
                    <div v-else-if="!prompts.length" class="sp-ob__none">
                        prompt 库是空的。用下面那一栏说一句就够了。
                    </div>
                    <button
                        v-for="p in prompts" :key="p.id"
                        class="sp-ob__card" :class="{ 'is-on': isPromptOn(p.id) }"
                        @click="togglePrompt(p.id)"
                    >
                        <span class="sp-ob__card-tick"></span>
                        <span class="sp-ob__card-main">
                            <span class="sp-ob__card-title">{{ p.title }}</span>
                            <span class="sp-ob__card-path" v-if="p.path">{{ p.path }}</span>
                            <span class="sp-ob__card-sub">{{ brief(p.content) }}</span>
                        </span>
                    </button>

                    <div class="sp-ob__taste">
                        <label class="sp-ob__taste-label">再说一句（可以不写）</label>
                        <sp-textarea
                            :model-value="ob.taste"
                            :rows="3"
                            placeholder="比如：喜欢手作的旧东西，不要太贵的；店想找安静的"
                            @update:model-value="setTaste"
                        />
                    </div>
                </div>
            </div>

            <footer class="sp-ob__foot">
                <div class="sp-ob__dots">
                    <span v-for="n in 3" :key="n" class="sp-ob__dot" :class="{ 'is-on': n - 1 === step }"></span>
                </div>
                <div class="sp-ob__actions">
                    <sp-btn v-if="step > 0" variant="ghost" @click="back">上一步</sp-btn>
                    <sp-btn variant="primary" size="lg" block :disabled="!canNext" @click="next">
                        {{ step === 2 ? '开始生成' : '继续' }}
                    </sp-btn>
                </div>
            </footer>
        </div>

        <!-- 3 · 生成中 -->
        <div v-else class="sp-ob sp-ob--busy">
            <sp-loading kind="product" size="lg" />
            <p class="sp-ob__busy-title">正在按「{{ identity.worldName }}」布置店面</p>
            <p class="sp-ob__busy-desc">第一次要生成两张列表，之后就快了</p>
        </div>
    `,
};
