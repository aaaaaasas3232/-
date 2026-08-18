/**
 * 人设机 · 提问面板
 *
 * 主线在这一页:**用户通过提问观察这个人设满不满意。**
 *
 * 两种身份共用同一条消息流:
 *   - 扮演:人设本人回答(流式)
 *   - 顾问:读完这段对话给一条修改建议(结果同时落到「打磨」页)
 *
 * ── 手机化的两个决定 ──────────────────────────────────────────────
 *
 * 1. 原型是「左中右三栏」:人设 / 对话 / 建议同屏。390px 宽的屏幕塞不下,
 *    改成一条消息流 + 底部输入,建议单独一页。
 * 2. 题库原型是右侧一张常驻卡(选择器 + 进度条 + 四个按钮),
 *    改成**输入框上方一条**:当前这道题 + 选项。不做题的人完全看不到它。
 */

import { SHARED_COMPONENTS } from './shared.js';
import * as store from '../store.js';
import { askPersona, askAdvisor, createAbort, abort, releaseAbort } from '../services/ai-service.js';
import { parseAdvisorReply } from '../services/suggestion.js';
import { resolveApiRef, describeApiRef } from '../services/nook-bridge.js';
import { ASK_MODES, ROLE } from '../constants.js';
import { formatClock } from '../utils.js';

export const PlPanelAsk = {
    name: 'PlPanelAsk',
    components: { ...SHARED_COMPONENTS },
    props: {
        app: { type: Object, required: true },
        draft: { type: Object, required: true },
    },
    emits: ['notify', 'go-refine', 'open-quiz'],
    data() {
        return { ASK_MODES };
    },
    computed: {
        state() { return store.getState(); },
        messages() { return this.draft.messages; },
        quiz() { return store.getCurrentQuiz(this.draft); },
        busy() { return this.state.busy === 'persona' || this.state.busy === 'advisor'; },
        busyKind() { return this.state.busy; },
        api() { return describeApiRef(resolveApiRef()); },

        mode: {
            get() { return this.state.askMode; },
            set(v) { store.setAskMode(v); },
        },
        composer: {
            get() { return this.state.composer; },
            set(v) { store.setComposer(v); },
        },

        placeholder() {
            if (this.mode === 'advisor') return '想让顾问重点看什么？留空就让它自己挑';
            if (this.quiz) return '直接发送就用上面这道题来问';
            return '问她点什么…';
        },

        /**
         * 题干下面那一行状态。
         *
         * ★ 答过就应落到某一项。没选项的开放题才只显示「已答」。
         */
        quizState() {
            if (!this.quiz?.answer) return null;
            if (this.quiz.pickIndex >= 0) {
                return { loose: false, text: `她选了第 ${this.quiz.pickIndex + 1} 项` };
            }
            return { loose: true, text: '已答' };
        },

        canSend() {
            if (this.busy) return false;
            if (this.mode === 'advisor') return true;
            return Boolean(this.composer.trim() || this.quiz?.question);
        },
    },
    watch: {
        'draft.messages.length'() { this.scrollToEnd(); },
    },
    mounted() { this.scrollToEnd(); },
    beforeUnmount() {
        abort('persona');
        abort('advisor');
    },
    methods: {
        formatClock,

        scrollToEnd() {
            this.$nextTick(() => {
                const el = this.$refs.flow;
                if (el) el.scrollTop = el.scrollHeight;
            });
        },

        roleLabel(role) {
            if (role === ROLE.USER) return '我';
            if (role === ROLE.ADVISOR) return '顾问';
            if (role === ROLE.SYSTEM) return '系统';
            return this.draft.title;
        },

        onSend() {
            if (!this.canSend) return;
            if (this.mode === 'advisor') this.runAdvisor();
            else this.runPersona();
        },

        onStop() {
            abort(this.busyKind || 'persona');
        },

        // ── 扮演 ──────────────────────────────
        async runPersona() {
            const quiz = this.quiz;
            const typed = this.composer.trim();
            const question = typed || quiz?.question || '';
            if (!question) return;

            store.addMessage(this.draft.id, {
                role: ROLE.USER,
                text: question,
                quizRef: !typed && quiz ? { setId: quiz.setId, index: quiz.index } : null,
            });
            store.setComposer('');

            const reply = store.addMessage(this.draft.id, { role: ROLE.PERSONA, text: '', pending: true });
            store.setBusy('persona');
            store.setStreamingMessage(reply.id);

            const signal = createAbort('persona');
            try {
                const res = await askPersona({
                    draft: this.draft,
                    // 用户自己打字时不把测题塞进去 —— 他这一问和那道题无关
                    quiz: typed ? null : quiz,
                    input: question,
                    signal,
                    onChunk: (_delta, full) => {
                        store.updateMessage(this.draft.id, reply.id, { text: full });
                        this.scrollToEnd();
                    },
                });

                store.updateMessage(this.draft.id, reply.id, {
                    text: res.text || '',
                    pending: false,
                    error: res.ok || res.aborted ? '' : (res.error || '没有拿到回答'),
                });

                if (res.text && !typed && quiz) store.recordQuizAnswer(this.draft.id, res.text);
                if (!res.ok && !res.aborted) this.$emit('notify', res.error || '没有拿到回答');
            } finally {
                releaseAbort('persona');
                store.setBusy('');
                store.setStreamingMessage(null);
                this.scrollToEnd();
            }
        },

        // ── 顾问 ──────────────────────────────
        async runAdvisor() {
            const request = this.composer.trim();
            if (request) {
                store.addMessage(this.draft.id, { role: ROLE.USER, text: request });
                store.setComposer('');
            }

            const reply = store.addMessage(this.draft.id, { role: ROLE.ADVISOR, text: '', pending: true });
            store.setBusy('advisor');

            const signal = createAbort('advisor');
            try {
                const res = await askAdvisor({ draft: this.draft, quiz: this.quiz, request, signal });
                if (res.aborted) {
                    store.removeMessage(this.draft.id, reply.id);
                    return;
                }
                if (!res.ok) {
                    store.updateMessage(this.draft.id, reply.id, { pending: false, error: res.error || '顾问没能给出建议' });
                    this.$emit('notify', res.error || '顾问没能给出建议');
                    return;
                }

                const parsed = parseAdvisorReply(res.text);
                store.updateMessage(this.draft.id, reply.id, { text: parsed.note || res.text, pending: false });

                /**
                 * ★ 关键分支:解析不出格式时**不生成任何 diff**。
                 *   原型这里会调 `generateDefaultSuggestion()` 凭空造一条 —— 用户看到的
                 *   "AI 建议"里有一部分是 AI 从来没说过的。宁可少给,不能造。
                 */
                if (parsed.verdict === 'ok' && parsed.suggestion) {
                    store.setSuggestion(this.draft.id, parsed.suggestion, parsed.note);
                    this.$emit('notify', '有一条修改建议，去「打磨」看看');
                } else if (parsed.verdict === 'clean') {
                    store.setSuggestion(this.draft.id, null, parsed.note);
                    this.$emit('notify', '顾问说这一版没什么要改的');
                } else {
                    store.setSuggestion(this.draft.id, null, parsed.note);
                    this.$emit('notify', '顾问没按格式回，只能看原话，没法一键套用');
                }
            } finally {
                releaseAbort('advisor');
                store.setBusy('');
                this.scrollToEnd();
            }
        },

        // ── 题库 ──────────────────────────────
        onStepQuiz(delta) {
            if (!store.stepQuiz(this.draft.id, delta)) {
                this.$emit('notify', delta > 0 ? '已经是最后一题了' : '已经是第一题了');
            }
        },
        onCloseQuiz() {
            store.stopQuiz(this.draft.id);
        },
    },
    template: `
        <div class="pl-ask">
            <div ref="flow" class="pl-flow">
                <PlEmpty
                    v-if="!messages.length"
                    icon-name="ask"
                    title="先问她一句"
                    hint="问什么都行。想不出来就打开题库，照着问一轮，哪儿空一目了然。"
                    action-label="打开题库"
                    @action="$emit('open-quiz')"
                />

                <article
                    v-for="msg in messages"
                    :key="msg.id"
                    class="pl-msg"
                    :data-role="msg.role"
                >
                    <header class="pl-msg-head">
                        <span class="pl-msg-who">{{ roleLabel(msg.role) }}</span>
                        <span class="pl-msg-time">{{ formatClock(msg.createdAt) }}</span>
                    </header>
                    <p v-if="msg.text" class="pl-msg-text">{{ msg.text }}</p>
                    <p v-if="msg.pending && !msg.text" class="pl-msg-typing"><span></span><span></span><span></span></p>
                    <p v-if="msg.error" class="pl-msg-error">{{ msg.error }}</p>
                </article>
            </div>

            <!-- 当前测题 -->
            <div v-if="quiz" class="pl-quiz-strip">
                <header class="pl-quiz-head">
                    <span class="pl-quiz-name">{{ quiz.setName }}</span>
                    <span class="pl-quiz-count">{{ quiz.index + 1 }} / {{ quiz.total }}</span>
                    <button type="button" class="pl-quiz-close" aria-label="收起题库" @click="onCloseQuiz">
                        <PlIcon name="close" />
                    </button>
                </header>
                <p class="pl-quiz-q">{{ quiz.question }}</p>
                <!--
                    选项是给**她**挑的,不是给用户点的。
                    以前这里是按钮,点一下把选项填进输入框 —— 发出去就变成
                    「用户拿这句话在提问」,等于替角色答了题。
                -->
                <ul v-if="quiz.options.length" class="pl-quiz-options">
                    <li
                        v-for="(opt, i) in quiz.options"
                        :key="i"
                        class="pl-quiz-opt"
                        :data-picked="i === quiz.pickIndex ? '1' : null"
                    >
                        <PlIcon v-if="i === quiz.pickIndex" name="check" />
                        <span>{{ opt }}</span>
                    </li>
                </ul>
                <div class="pl-quiz-nav">
                    <PlButton label="上一题" icon-name="back" size="sm" variant="quiet" @click="onStepQuiz(-1)" />
                    <span
                        v-if="quizState"
                        class="pl-quiz-answered"
                        :data-loose="quizState.loose ? '1' : null"
                    >{{ quizState.text }}</span>
                    <PlButton label="下一题" size="sm" variant="quiet" @click="onStepQuiz(1)" />
                </div>
            </div>

            <!-- 输入区 -->
            <footer class="pl-composer">
                <div class="pl-composer-top">
                    <PlSegmented v-model="mode" :items="ASK_MODES" />
                    <button type="button" class="pl-composer-quiz" @click="$emit('open-quiz')">
                        <PlIcon name="quiz" /><span>题库</span>
                    </button>
                </div>
                <p v-if="!api.ok" class="pl-composer-warn">{{ api.sub }}</p>
                <div class="pl-composer-row">
                    <PlTextarea
                        v-model="composer"
                        :placeholder="placeholder"
                        :max-rows="5"
                        @submit="onSend"
                    />
                    <PlButton
                        v-if="busy"
                        icon-name="stop"
                        variant="ghost"
                        aria-label="停止"
                        @click="onStop"
                    />
                    <PlButton
                        v-else
                        icon-name="send"
                        variant="primary"
                        :disabled="!canSend"
                        @click="onSend"
                    />
                </div>
            </footer>
        </div>
    `,
};

export default PlPanelAsk;
