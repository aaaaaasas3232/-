/**
 * 点灯 · 摸底问卷 → 水平侧写 → 定终点 → 排课
 *
 * 一屏走完四步，中间任何一步失败都能原地重来。
 * 问卷答完不是终点：还要问一句「你想达到什么程度」，
 * 起点和终点都有了，才排得出一条真正属于这个人的路线。
 */

import { UI } from './ui.js';

export const SlSurveyPage = {
    name: 'SlSurveyPage',
    components: { ...UI },
    props: {
        state: { type: Object, required: true },
        topic: { type: Object, default: null },
    },
    emits: ['back', 'retry-survey', 'answer', 'submit', 'plan'],
    data() {
        return { goal: '' };
    },
    computed: {
        questions() { return this.topic?.surveyQuestions || []; },
        stage() {
            if (!this.topic) return 'none';
            if (this.state.loading.survey) return 'making';
            if (this.topic.surveyStage === 'done') return 'goal';
            if (this.questions.length) return 'answering';
            return 'none';
        },
        answered() {
            return this.questions.filter((q) => String(q.answer || '').trim()).length;
        },
        suggested() { return this.state.survey.suggested || []; },
        busy() {
            return this.state.loading.survey || this.state.loading.profile || this.state.loading.plan;
        },
    },
    template: `
        <div class="sl-survey">
            <SlTopbar
                title="先摸个底"
                :sub="topic ? topic.title : ''"
                @back="$emit('back')"
            />

            <div class="sl-survey__scroll">
                <SlLoading
                    v-if="stage === 'making'"
                    :lines="['正在出题', '在想怎么才能问到点子上', '快好了']"
                />

                <SlEmpty
                    v-else-if="stage === 'none'"
                    icon-name="quiz"
                    title="还没有问卷"
                    desc="第一次上课之前，老师想先知道你现在在哪一层。"
                >
                    <SlButton variant="primary" icon-name="sparkle" @click="$emit('retry-survey')">出一份问卷</SlButton>
                </SlEmpty>

                <!-- 答题 -->
                <template v-else-if="stage === 'answering'">
                    <div class="sl-survey__hint">
                        <p>不会的直接跳过 —— 跳过本身也是信息。</p>
                        <SlProgress :value="answered" :total="questions.length" />
                        <span class="sl-survey__count">{{ answered }} / {{ questions.length }}</span>
                    </div>

                    <div v-for="(q, i) in questions" :key="q.id" class="sl-q">
                        <div class="sl-q__head"><span class="sl-q__n">{{ i + 1 }}</span>{{ q.q }}</div>

                        <div v-if="q.kind === 'choice'" class="sl-q__opts">
                            <button
                                v-for="(o, oi) in q.options" :key="oi" type="button"
                                class="sl-q__opt" :class="{ 'is-on': q.answer === o }"
                                @click="$emit('answer', { id: q.id, value: q.answer === o ? '' : o })"
                            >{{ o }}</button>
                        </div>

                        <textarea
                            v-else class="sl-textarea"
                            :value="q.answer"
                            :placeholder="q.placeholder || '随便说说'"
                            rows="3"
                            @input="$emit('answer', { id: q.id, value: $event.target.value })"
                        ></textarea>
                    </div>

                    <div class="sl-survey__foot">
                        <SlButton variant="ghost" icon-name="refresh" :disabled="busy" @click="$emit('retry-survey')">
                            换一份
                        </SlButton>
                        <span class="sl-section__spacer"></span>
                        <SlButton
                            variant="primary" icon-name="check"
                            :loading="state.loading.profile" :disabled="!answered"
                            @click="$emit('submit')"
                        >交卷</SlButton>
                    </div>
                </template>

                <!-- 定终点 -->
                <template v-else-if="stage === 'goal'">
                    <div class="sl-profile">
                        <div class="sl-profile__head"><SlIcon name="student" :size="16" /> 老师眼里的你</div>
                        <p v-if="state.survey.level" class="sl-profile__level">{{ state.survey.level }}</p>
                        <p class="sl-profile__text">{{ topic.learnerProfile }}</p>
                        <p class="sl-profile__note">这份侧写会一路跟着你更新，反转课堂里 AI 扮演的学生用的就是它。</p>
                    </div>

                    <SlSection title="你想到哪儿去" sub="起点有了，说说终点">
                        <div v-if="suggested.length" class="sl-goal__picks">
                            <button
                                v-for="(s, i) in suggested" :key="i" type="button"
                                class="sl-goal__pick" :class="{ 'is-on': goal === s }"
                                @click="goal = s"
                            >{{ s }}</button>
                        </div>
                        <textarea
                            class="sl-textarea" v-model="goal" rows="3"
                            placeholder="比如：能看懂英文技术文档不查词典 / 能自己从零写一个个人主页"
                        ></textarea>
                    </SlSection>

                    <div class="sl-survey__foot">
                        <span class="sl-section__spacer"></span>
                        <SlButton
                            variant="primary" icon-name="flag" block
                            :loading="state.loading.plan" :disabled="!goal.trim()"
                            @click="$emit('plan', goal.trim())"
                        >按这个排课</SlButton>
                    </div>
                </template>
            </div>
        </div>
    `,
};

export default SlSurveyPage;
