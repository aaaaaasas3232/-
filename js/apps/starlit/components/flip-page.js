/**
 * 点灯 · 反转课堂
 *
 * 用户变成老师，AI 变成学生。
 *
 * 关键设计（不能改）：
 *   - AI **拿不到这节课的任何记忆**。它只知道「我是一个 xxx 水平的学生」，
 *     而那份 xxx 就是用户上这节课**之前**的水平侧写。
 *   - 提示词里不会告诉 AI「这是用户的水平」——只说「你是这个水平的学生」。
 *   - **下课按钮在 AI 手里**：它觉得自己听懂了才结束。
 *     用户也能强制结束，但那会记成「没讲通」。
 *
 * 讲得清楚，说明真的懂了。这是这个页面存在的全部理由。
 */

import { fmtTime } from '../utils.js';
import { UI } from './ui.js';

export const SlFlipPage = {
    name: 'SlFlipPage',
    components: { ...UI },
    props: {
        state: { type: Object, required: true },
        topic: { type: Object, default: null },
        lesson: { type: Object, default: null },
    },
    emits: ['back', 'send', 'force-end'],
    data() {
        return { draft: '', showLevel: false };
    },
    computed: {
        busy() { return this.state.loading.flip || this.state.loading.flipEnd; },
        ended() { return this.lesson?.flip?.status === 'done'; },
        level() { return this.lesson?.flip?.studentLevel || ''; },
        messages() { return this.state.messages; },
    },
    watch: {
        'state.messages.length'() { this.scrollDown(); },
        'state.loading.flip'() { this.scrollDown(); },
    },
    mounted() { this.scrollDown(true); },
    methods: {
        fmt(ts) { return fmtTime(ts); },
        scrollDown(instant) {
            this.$nextTick(() => {
                const el = this.$refs.scroll;
                if (!el) return;
                el.scrollTo({ top: el.scrollHeight, behavior: instant ? 'auto' : 'smooth' });
            });
        },
        send() {
            const body = this.draft.trim();
            if (!body || this.busy) return;
            this.draft = '';
            this.$emit('send', body);
        },
    },
    template: `
        <div class="sl-flip">
            <SlTopbar
                title="反转课堂"
                :sub="lesson ? ('第 ' + lesson.index + ' 节 · ' + lesson.title) : ''"
                @back="$emit('back')"
            >
                <template #actions>
                    <button type="button" class="sl-topbar__btn" @click="showLevel = !showLevel">
                        <SlIcon name="student" :size="18" />
                    </button>
                </template>
            </SlTopbar>

            <transition name="sl-drop">
                <div v-if="showLevel" class="sl-flip__level">
                    <div class="sl-flip__level-head">你面前这位同学的水平</div>
                    <p>{{ level || '零基础' }}</p>
                    <span class="sl-flip__level-note">他对这节课一无所知，也没有你们上课时的任何记忆。</span>
                </div>
            </transition>

            <div ref="scroll" class="sl-flip__scroll">
                <div class="sl-flip__banner">
                    <SlIcon name="flip" :size="18" />
                    <div>
                        <b>现在你是老师</b>
                        <i>把这节课讲给他听。他听懂了才会下课 —— 讲得清楚，说明你是真懂了。</i>
                    </div>
                </div>

                <template v-for="m in messages" :key="m.id">
                    <div v-if="m.role === 'system'" class="sl-sys">{{ m.text }}</div>
                    <div v-else class="sl-msg" :class="{ 'is-me': m.role === 'me' }">
                        <SlAvatar
                            class="sl-msg__ava"
                            :name="m.role === 'me' ? state.identity.userName : '学生'"
                            :url="m.role === 'me' ? state.identity.userAvatar : ''"
                            :bg="m.role === 'me' ? state.identity.userAvatarBg : ''"
                            :size="30"
                        />
                        <div class="sl-msg__col">
                            <div class="sl-msg__bubble" :class="{ 'is-student': m.role === 'student' }">
                                <p class="sl-msg__text">{{ m.text }}</p>
                            </div>
                            <span class="sl-msg__time">{{ fmt(m.createdAt) }}</span>
                        </div>
                    </div>
                </template>

                <SlLoading v-if="state.loading.flip" :lines="['他在想', '他好像有点没跟上', '他要开口了']" />
                <SlLoading v-if="state.loading.flipEnd" :lines="['正在复盘这堂课', '在看你哪里讲透了', '快好了']" />

                <div v-if="ended" class="sl-flip__done">
                    <SlIcon name="check" :size="18" />
                    <div>
                        <b>{{ lesson.flip.endedBy === 'ai' ? '他说他听懂了' : '你结束了这堂课' }}</b>
                        <i>{{ lesson.flip.summary }}</i>
                    </div>
                </div>
            </div>

            <div v-if="!ended" class="sl-composer">
                <div class="sl-composer__row">
                    <textarea
                        class="sl-composer__input"
                        v-model="draft"
                        placeholder="讲给他听 —— 从他能懂的地方开始"
                        rows="1"
                        :disabled="busy"
                        @keydown.enter.exact.prevent="send"
                    ></textarea>
                    <button type="button" class="sl-composer__send" :disabled="!draft.trim() || busy" @click="send">
                        <SlIcon name="send" :size="18" />
                    </button>
                </div>
                <div class="sl-composer__foot">
                    <span class="sl-flip__hint">下课按钮在他手里</span>
                    <span class="sl-section__spacer"></span>
                    <SlButton size="sm" variant="ghost" :loading="state.loading.flipEnd" @click="$emit('force-end')">
                        我讲不动了
                    </SlButton>
                </div>
            </div>

            <div v-else class="sl-composer">
                <SlButton variant="primary" block icon-name="back" @click="$emit('back')">回到课程</SlButton>
            </div>
        </div>
    `,
};

export default SlFlipPage;
