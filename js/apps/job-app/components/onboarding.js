/**
 * 灯塔 · 首次配置
 *
 * 三屏：这是什么 → 挑材料 → 说说想找什么。
 *
 * ★ 最后一步会真的调 AI 拉第一批职位，而这一步**可能失败**（没配 API）。
 *   失败时**不把用户退回引导页** —— 配置本身已经成功了，
 *   失败的只是第一批内容。退回去的话用户会以为配置没保存，然后从头再填一遍。
 */

import * as store from '../store.js';
import { UI } from './ui.js';

export const JbOnboarding = {
    name: 'JbOnboarding',
    components: { ...UI },
    data() {
        return { busy: false, failed: '' };
    },
    computed: {
        s() { return store.getState(); },
        ob() { return this.s.onboarding; },
        step() { return this.ob.step; },
        worldName() { return this.s.identity.worldName || '你的世界'; },
        currency() { return this.s.identity.currency; },
        clips() { return this.ob.clips; },
        prompts() { return this.ob.prompts; },
        pickedCount() { return this.ob.clipIds.length + this.ob.promptIds.length; },
    },
    methods: {
        go(step) { store.setOnboardingStep(step); },
        toggleClip(id) { store.toggleClip(id); },
        togglePrompt(id) { store.toggleLibraryPrompt(id); },
        onAim(v) { store.setAim(v); },
        /**
         * ★ 「配置存好了」和「第一批职位拉下来了」是两件事。
         *
         *   `finishOnboarding` 先落盘再把 `needsConfig` 置 false，所以只要配置
         *   写成功，这个组件在 await 期间就已经被卸载了 —— 后面拉列表失败与否
         *   都不会把用户弹回来。这正是想要的：多步流程的最后一步失败时，
         *   前面几步的成果算数，不能整体回滚。
         *
         *   下面这个 `failed` 只会在**配置本身没存成**（拿不到档案键）时出现。
         *   拉列表的错误由招聘板自己显示。
         */
        async finish() {
            this.busy = true;
            this.failed = '';
            try {
                const ok = await store.finishOnboarding();
                if (!ok && this.s.needsConfig) {
                    this.failed = this.s.error || '配置没能存下来，再试一次';
                }
            } finally {
                this.busy = false;
            }
        },
    },
    template: `
        <div class="jb-ob">
            <div class="jb-ob__body">
                <!-- 第一屏 -->
                <template v-if="step === 0">
                    <p class="jb-ob__kicker">灯塔</p>
                    <h1 class="jb-ob__title">在「{{ worldName }}」里找一份工作</h1>
                    <p class="jb-ob__lead">
                        这里不预设任何职位。招聘板上挂什么，是按你这个世界的样子现问出来的。
                    </p>
                    <ul class="jb-ob__list">
                        <li><b>挣的钱是真的。</b>和聊天里的红包、四叶草的消费共用一个钱包。</li>
                        <li><b>要面试。</b>HR 是在你决定去聊的那一刻才生成的人，他会拒绝你。</li>
                        <li><b>入职之后每天有一段。</b>上班日能演一场小剧场，表现决定当天拿多少。</li>
                        <li><b>最多三份工作。</b>再多就得先辞掉一份。</li>
                    </ul>
                    <p class="jb-ob__note">结算单位：{{ currency }}（取自世界观）</p>
                </template>

                <!-- 第二屏 -->
                <template v-else-if="step === 1">
                    <h1 class="jb-ob__title">让它知道得多一点</h1>
                    <p class="jb-ob__lead">
                        勾中的内容会进每一次生成。什么都不勾也能用，只是招聘板会比较泛。
                    </p>

                    <jb-section title="世界观夹子" :sub="clips.length ? '共 ' + clips.length + ' 条' : ''">
                        <div v-if="!clips.length" class="jb-ob__blank">
                            这个世界观下还没有夹子。去「设置 → 世界观」加几条，回来就能勾了。
                        </div>
                        <div v-else class="jb-ob__picks">
                            <button
                                v-for="c in clips" :key="c.id"
                                class="jb-ob__pick" :class="{ 'is-on': ob.clipIds.includes(c.id) }"
                                @click="toggleClip(c.id)"
                            >
                                <b>{{ c.title }}</b>
                                <span>{{ c.content.slice(0, 40) }}</span>
                            </button>
                        </div>
                    </jb-section>

                    <jb-section title="prompt 库" :sub="prompts.length ? '共 ' + prompts.length + ' 条' : ''">
                        <div v-if="!prompts.length" class="jb-ob__blank">
                            prompt 库是空的，或者还没加载好。
                        </div>
                        <div v-else class="jb-ob__picks">
                            <button
                                v-for="p in prompts" :key="p.id"
                                class="jb-ob__pick" :class="{ 'is-on': ob.promptIds.includes(p.id) }"
                                @click="togglePrompt(p.id)"
                            >
                                <b>{{ p.title }}</b>
                                <span>{{ p.path || p.content.slice(0, 40) }}</span>
                            </button>
                        </div>
                    </jb-section>
                </template>

                <!-- 第三屏 -->
                <template v-else>
                    <h1 class="jb-ob__title">你想找什么样的活</h1>
                    <p class="jb-ob__lead">
                        随便写。它会影响招聘板上挂出来的东西，不写也行。
                    </p>
                    <jb-textarea
                        :model-value="ob.aim"
                        :rows="5"
                        placeholder="比如：想找个不用见人的、能坐着的活，钱少点没关系"
                        @update:model-value="onAim"
                    />
                    <p class="jb-ob__note">
                        已经勾了 {{ pickedCount }} 条材料。这些以后都能在「我的 → 生成设置」里改。
                    </p>
                    <div v-if="failed" class="jb-ob__failed">{{ failed }}</div>
                </template>
            </div>

            <footer class="jb-ob__foot">
                <jb-btn v-if="step > 0" variant="ghost" @click="go(step - 1)">上一步</jb-btn>
                <jb-btn v-if="step < 2" variant="primary" block @click="go(step + 1)">
                    {{ step === 0 ? '开始' : '下一步' }}
                </jb-btn>
                <jb-btn v-else variant="primary" block :loading="busy" @click="finish">
                    去看看有什么活
                </jb-btn>
            </footer>
        </div>
    `,
};
