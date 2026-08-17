/**
 * 点灯 · 上课页（聊天器）
 *
 * ── 描边中文 ──────────────────────────────────────────────────────
 * 语言模式下，老师的每条气泡旁边贴一行**描边中文**（像梗图字幕那样）。
 * 不是微信那种「点一下翻译」—— 那一下点击会把沉浸感打断，
 * 而且学生会养成先看中文的习惯。贴在旁边、余光能扫到、
 * 但视线焦点仍在外文上，这是刻意的。
 *
 * 实现上它是绝对定位的一层，**不参与气泡内部的排版**，
 * 所以外文怎么换行都不受影响（产品明确要求）。
 *
 * ── 批改 ──────────────────────────────────────────────────────────
 * 学生写错了，老师会回一个 correct 块，它被挂到学生**上一条**消息上，
 * 直接显示「你写的 → 应该怎么写」，不用滚回去找。
 */

import { MODES } from '../constants.js';
import { fmtTime, looksLikeChinese } from '../utils.js';
import { UI } from './ui.js';
import { SlCardChip } from './cards.js';
import { longPressMixin } from './long-press.js';

const SlBubble = {
    name: 'SlBubble',
    components: { ...UI, SlCardChip },
    mixins: [longPressMixin],
    props: {
        message: { type: Object, required: true },
        cards: { type: Array, default: () => [] },
        teacherName: { type: String, default: '老师' },
        teacherAvatar: { type: String, default: '' },
        teacherBg: { type: String, default: '' },
        userName: { type: String, default: '我' },
        userAvatar: { type: String, default: '' },
        userBg: { type: String, default: '' },
        showGloss: { type: Boolean, default: false },
        /** 'meme' 描边贴边上 | 'tap' 点开才展开 */
        glossMode: { type: String, default: 'meme' },
    },
    emits: ['open-card', 'remove', 'translate'],
    data() {
        return { opened: false };
    },
    computed: {
        mine() { return this.message.role === 'me'; },
        system() { return this.message.role === 'system'; },
        gloss() { return this.showGloss ? String(this.message.gloss || '').trim() : ''; },
        /** 描边式：一直贴着 */
        memeGloss() { return this.glossMode === 'meme' ? this.gloss : ''; },
        /** 微信式：点开才出现 */
        tapGloss() { return this.glossMode === 'tap' ? this.gloss : ''; },
        correction() { return this.message.correction || null; },
        myCards() {
            const ids = new Set((this.message.cardIds || []).map(String));
            return this.cards.filter((c) => ids.has(String(c.id)));
        },
    },
    template: `
        <div v-if="system" class="sl-sys">{{ message.text }}</div>
        <div v-else class="sl-msg" :class="{ 'is-me': mine, 'has-gloss': !!memeGloss }">
            <SlAvatar
                class="sl-msg__ava"
                :name="mine ? userName : teacherName"
                :url="mine ? userAvatar : teacherAvatar"
                :bg="mine ? userBg : teacherBg"
                :size="30"
            />
            <div class="sl-msg__col">
                <div class="sl-msg__bubble">
                    <p
                        class="sl-msg__text sl-lp"
                        @pointerdown="onTextDown"
                        @pointermove="lpMove"
                        @pointerup="lpUp"
                        @pointercancel="lpUp"
                    >{{ message.text }}</p>

                    <!-- 描边中文：绝对定位，不参与气泡内部排版 -->
                    <span v-if="memeGloss" class="sl-gloss" :data-gloss="memeGloss">{{ memeGloss }}</span>

                    <!-- 微信式：一颗小按钮，点开才展开 -->
                    <button
                        v-if="tapGloss"
                        type="button"
                        class="sl-msg__tr"
                        :class="{ 'is-on': opened }"
                        :aria-label="opened ? '收起翻译' : '看翻译'"
                        @click="opened = !opened"
                    >译</button>
                </div>

                <transition name="sl-drop">
                    <p v-if="tapGloss && opened" class="sl-msg__trbody">{{ tapGloss }}</p>
                </transition>

                <div v-if="correction" class="sl-fix">
                    <div class="sl-fix__row">
                        <span class="sl-fix__tag">改成</span>
                        <span class="sl-fix__text">{{ correction.fixed }}</span>
                    </div>
                    <p v-if="correction.tip" class="sl-fix__tip">{{ correction.tip }}</p>
                </div>

                <div v-if="myCards.length" class="sl-msg__cards">
                    <SlCardChip
                        v-for="c in myCards" :key="c.id" :card="c"
                        @open="$emit('open-card', $event)"
                        @translate="$emit('translate', { cardId: $event })"
                    />
                </div>

                <span class="sl-msg__time">{{ fmt(message.createdAt) }}</span>
            </div>
        </div>
    `,
    methods: {
        fmt(ts) { return fmtTime(ts); },
        /** 长按气泡正文 → 翻译。划了词就只翻划中的那段 */
        onTextDown(e) {
            this.lpDown(e, () => {
                const picked = String(window.getSelection?.() || '').trim();
                this.$emit('translate', { text: picked || this.message.text });
            });
        },
    },
};

export const SlLessonPage = {
    name: 'SlLessonPage',
    components: { ...UI, SlBubble },
    props: {
        state: { type: Object, required: true },
        topic: { type: Object, default: null },
        lesson: { type: Object, default: null },
    },
    emits: ['back', 'send', 'start', 'end', 'open-card', 'notes', 'translate'],
    data() {
        return { draft: '', showObjectives: false, warn: '' };
    },
    computed: {
        isLang() { return this.topic?.mode === MODES.language; },
        /** 翻译贴哪儿。老档没这个字段时按描边式兜底 */
        glossMode() { return this.state.profile?.glossMode === 'tap' ? 'tap' : 'meme'; },
        teacherName() {
            return this.topic?.teacherName || (this.isLang ? 'Teacher' : '老师');
        },
        started() { return this.state.messages.length > 0; },
        busy() { return this.state.loading.reply || this.state.loading.summary; },
        objectives() { return this.lesson?.objectives || []; },
        placeholder() {
            if (!this.isLang) return '说说你的想法，或者问一句';
            const target = this.topic?.targetNative || this.topic?.target || '目标语言';
            return `用 ${target} 说 —— 说错也没关系，老师会改`;
        },
        loadingLines() {
            return this.isLang
                ? ['正在组织一句你能读懂的', '在挑一个更地道的说法', '快好了']
                : ['正在想怎么讲', '在找一个能跑起来的例子', '快好了'];
        },
    },
    watch: {
        'state.messages.length'() { this.scrollDown(); },
        'state.loading.reply'() { this.scrollDown(); },
    },
    mounted() { this.scrollDown(true); },
    methods: {
        scrollDown(instant) {
            this.$nextTick(() => {
                const el = this.$refs.scroll;
                if (!el) return;
                el.scrollTo({ top: el.scrollHeight, behavior: instant ? 'auto' : 'smooth' });
            });
        },
        onInput(e) {
            this.draft = e.target.value;
            // 语言模式下软提醒，不硬拦 —— 拦错了比不拦更烦人
            this.warn = this.isLang && looksLikeChinese(this.draft)
                ? `这节课要用${this.topic?.target || '目标语言'}说，试着写出来，老师会帮你改`
                : '';
        },
        send() {
            const body = this.draft.trim();
            if (!body || this.busy) return;
            this.draft = '';
            this.warn = '';
            this.$emit('send', body);
        },
    },
    template: `
        <div class="sl-lesson">
            <SlTopbar
                :title="lesson ? ('第 ' + lesson.index + ' 节 · ' + lesson.title) : '上课'"
                :sub="topic ? topic.title : ''"
                @back="$emit('back')"
            >
                <template #actions>
                    <button type="button" class="sl-topbar__btn" @click="showObjectives = !showObjectives">
                        <SlIcon name="target" :size="18" />
                    </button>
                    <button type="button" class="sl-topbar__btn" @click="$emit('notes')">
                        <SlIcon name="note" :size="18" />
                    </button>
                </template>
            </SlTopbar>

            <transition name="sl-drop">
                <div v-if="showObjectives" class="sl-goals">
                    <div class="sl-goals__head">本节目标</div>
                    <div v-for="o in objectives" :key="o.id" class="sl-goals__row" :class="'is-' + o.from">
                        <span class="sl-goals__dot"></span>
                        <span>{{ o.text }}</span>
                        <i v-if="o.from === 'stuck'">补课</i>
                        <i v-else-if="o.from === 'ai'">课上加的</i>
                    </div>
                    <p v-if="!objectives.length" class="sl-goals__empty">这节课还没定目标，老师会在开场时说清楚</p>
                    <p v-if="lesson && lesson.thesis" class="sl-goals__thesis">{{ lesson.thesis }}</p>
                </div>
            </transition>

            <div ref="scroll" class="sl-lesson__scroll">
                <div v-if="!started" class="sl-lesson__intro">
                    <SlEmpty
                        icon-name="teacher"
                        title="还没开始"
                        :desc="isLang
                            ? '这节课全程用目标语言。老师说的每一句旁边都会贴中文，你不用切来切去。'
                            : '这节课会一边写一边给你看效果。任何一条代码都能长按改，改完立刻在预览里看变化。'"
                    >
                        <SlButton variant="primary" icon-name="play" :loading="state.loading.reply" @click="$emit('start')">
                            开始上课
                        </SlButton>
                    </SlEmpty>
                </div>

                <SlBubble
                    v-for="m in state.messages" :key="m.id"
                    :message="m"
                    :cards="state.cards"
                    :teacher-name="teacherName"
                    :user-name="state.identity.userName"
                    :user-avatar="state.identity.userAvatar"
                    :user-bg="state.identity.userAvatarBg"
                    :show-gloss="isLang"
                    :gloss-mode="glossMode"
                    @open-card="$emit('open-card', $event)"
                    @translate="$emit('translate', $event)"
                />

                <SlLoading v-if="state.loading.reply" :lines="loadingLines" />
                <SlLoading v-if="state.loading.summary" :lines="['正在把这节课收成一张网', '在连红线', '快好了']" />
            </div>

            <div v-if="started" class="sl-composer">
                <p v-if="warn" class="sl-composer__warn">{{ warn }}</p>
                <div class="sl-composer__row">
                    <textarea
                        class="sl-composer__input"
                        :value="draft"
                        :placeholder="placeholder"
                        rows="1"
                        :disabled="busy"
                        @input="onInput"
                        @keydown.enter.exact.prevent="send"
                    ></textarea>
                    <button type="button" class="sl-composer__send" :disabled="!draft.trim() || busy" @click="send">
                        <SlIcon name="send" :size="18" />
                    </button>
                </div>
                <div class="sl-composer__foot">
                    <SlButton size="sm" variant="ghost" icon-name="flag" :disabled="busy" @click="$emit('send', '这里我没懂')">
                        我没懂
                    </SlButton>
                    <span class="sl-section__spacer"></span>
                    <SlButton size="sm" variant="line" icon-name="check" :loading="state.loading.summary" @click="$emit('end')">
                        下课
                    </SlButton>
                </div>
            </div>
        </div>
    `,
};

export default SlLessonPage;
