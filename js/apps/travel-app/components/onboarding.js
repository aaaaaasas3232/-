/**
 * 候鸟 · 首次配置
 *
 * 一屏一件事：
 *   0  确认身份（默认用户 / 绑定世界 / 货币 / 世界简介）—— 只确认不可改
 *   1  挑世界观材料（夹子 + prompt 库条目）
 *   2  旅行口味 + 完成
 *
 * 完成后只生成候选列表。生成失败**不退回引导页** ——
 * 配置本身已经成功了，失败的只是第一批内容。
 */

import * as store from '../store.js';
import { UI } from './ui.js';

export const TvOnboarding = {
    name: 'TvOnboarding',
    components: { ...UI },
    data() {
        return { generating: false, failed: '' };
    },
    computed: {
        s() { return store.getState(); },
        ob() { return this.s.onboarding; },
        step() { return this.ob.step; },
        identity() { return this.s.identity; },
        canNext() { return true; },
    },
    methods: {
        prev() { store.setOnboardingStep(this.step - 1); },
        next() { store.setOnboardingStep(this.step + 1); },
        toggleClip(id) { store.toggleClip(id); },
        togglePrompt(id) { store.toggleLibraryPrompt(id); },
        onTaste(event) { store.setTaste(event.target.value); },
        async finish() {
            if (this.generating) return;
            this.generating = true;
            this.failed = '';
            const ok = await store.finishOnboarding();
            this.generating = false;
            // ★ 失败留在主界面（needsConfig 已经是 false），只把错误带过去
            if (!ok && this.s.error) this.failed = this.s.error;
        },
    },
    template: `
        <div class="tv-ob" :class="{ 'tv-ob--busy': generating }">
            <div v-if="generating" class="tv-ob__stage tv-ob__center">
                <TvLoading :lines="['正在打听这个世界哪里好玩', '在画候选路线', '快好了']" />
            </div>

            <div v-else class="tv-ob__stage">
                <!-- 第 0 屏：身份确认 -->
                <template v-if="step === 0">
                    <div class="tv-ob__hero"><TvIcon name="plane" :size="44" /></div>
                    <h1 class="tv-ob__title">候鸟</h1>
                    <p class="tv-ob__desc">按你所在世界的样子，生成能真的去一趟的地方。先确认按哪个世界来。</p>
                    <div class="tv-ob__panel">
                        <div class="tv-ob__pill"><span class="tv-ob__pill-k">旅行者</span><span class="tv-ob__pill-v">{{ identity.userName }}</span></div>
                        <div class="tv-ob__pill"><span class="tv-ob__pill-k">世界</span><span class="tv-ob__pill-v">{{ identity.worldName }}</span></div>
                        <div class="tv-ob__pill"><span class="tv-ob__pill-k">旅费货币</span><span class="tv-ob__pill-v is-coin">{{ identity.currency }}</span></div>
                        <div class="tv-ob__summary">
                            <p v-if="ob.loading" class="tv-ob__summary-empty">正在读世界观…</p>
                            <p v-else-if="s.identity.world && s.identity.world.summary" class="tv-ob__summary-text">{{ s.identity.world.summary }}</p>
                            <p v-else class="tv-ob__summary-empty">这个世界观还没写简介。也能生成，但内容会更靠 AI 自由发挥 —— 建议先去 nook 补一段。</p>
                        </div>
                    </div>
                </template>

                <!-- 第 1 屏：材料 -->
                <template v-else-if="step === 1">
                    <h1 class="tv-ob__title">带哪些设定上路</h1>
                    <p class="tv-ob__desc">勾中的会进入每次生成的提示词。不勾也行，世界简介永远会带上。</p>
                    <div class="tv-ob__panel">
                        <p class="tv-ob__group">世界观夹子</p>
                        <p v-if="!ob.clips.length" class="tv-ob__none">这个世界还没有夹子。</p>
                        <button
                            v-for="c in ob.clips" :key="c.id"
                            type="button" class="tv-ob__card" :class="{ 'is-on': ob.clipIds.includes(c.id) }"
                            @click="toggleClip(c.id)"
                        >
                            <span class="tv-ob__tick"></span>
                            <span class="tv-ob__card-main">
                                <span class="tv-ob__card-title">{{ c.title }}</span>
                                <span class="tv-ob__card-sub">{{ c.content.slice(0, 44) }}</span>
                            </span>
                        </button>

                        <p class="tv-ob__group">Prompt 库</p>
                        <p v-if="!ob.prompts.length" class="tv-ob__none">Prompt 库是空的，跳过就好。</p>
                        <button
                            v-for="p in ob.prompts" :key="p.id"
                            type="button" class="tv-ob__card" :class="{ 'is-on': ob.promptIds.includes(p.id) }"
                            @click="togglePrompt(p.id)"
                        >
                            <span class="tv-ob__tick"></span>
                            <span class="tv-ob__card-main">
                                <span class="tv-ob__card-title">{{ p.title }}</span>
                                <span v-if="p.path" class="tv-ob__card-path">{{ p.path }}</span>
                            </span>
                        </button>
                    </div>
                </template>

                <!-- 第 2 屏：口味 -->
                <template v-else>
                    <h1 class="tv-ob__title">想去什么样的地方</h1>
                    <p class="tv-ob__desc">写不写都行。写了的话，候选会更合你口味。</p>
                    <div class="tv-ob__panel">
                        <textarea
                            class="tv-textarea" rows="5"
                            :value="ob.taste"
                            placeholder="比如：想看海 / 喜欢安静的古迹 / 别推荐要爬山的"
                            @input="onTaste"
                        ></textarea>
                        <p v-if="failed" class="tv-ob__failed">{{ failed }}</p>
                    </div>
                </template>
            </div>

            <div v-if="!generating" class="tv-ob__foot">
                <div class="tv-ob__dots">
                    <span v-for="i in 3" :key="i" class="tv-ob__dot" :class="{ 'is-on': step === i - 1 }"></span>
                </div>
                <div class="tv-ob__actions">
                    <TvButton v-if="step > 0" variant="ghost" @click="prev">上一步</TvButton>
                    <TvButton v-if="step < 2" variant="primary" block @click="next">继续</TvButton>
                    <TvButton v-else variant="primary" block @click="finish">完成，看看能去哪</TvButton>
                </div>
            </div>
        </div>
    `,
};
