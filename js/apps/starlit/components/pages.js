/**
 * 点灯 · 主题 / 课程 / 结课反思 / 我的
 *
 * 四个 tab 页放一个文件里 —— 它们都不复杂，拆成四个文件反而难找。
 * 复杂的（上课、推理墙、词典、反转课堂、代码卡）各有自己的文件。
 */

import {
    CODE_PRESETS, LANGUAGE_PRESETS, LESSON_STATUS, MODES, TEACHER_SOURCES,
    IMMERSION_MODES, GLOSS_MODES, TRANSLATE_ENGINES,
} from '../constants.js';
import { fmtAgo, truncate } from '../utils.js';
import { UI } from './ui.js';
import { SlCardChip } from './cards.js';

const STATUS_LABEL = {
    planned: '未开始',
    active: '进行中',
    done: '已上完',
    flipped: '反转过',
};

// ============================================================
// 主题列表
// ============================================================

export const SlTopicsPage = {
    name: 'SlTopicsPage',
    components: { ...UI },
    props: {
        state: { type: Object, required: true },
    },
    emits: ['select', 'new', 'delete', 'open-plan'],
    methods: {
        modeLabel(t) { return t.mode === MODES.language ? '语言' : '代码'; },
        sub(t) {
            const bits = [];
            if (t.target) bits.push(t.target);
            if (t.teacherName) bits.push(`${t.teacherName} 教`);
            else bits.push('模型直接教');
            return bits.join(' · ');
        },
        ago(t) { return fmtAgo(t.updatedAt); },
    },
    template: `
        <div class="sl-page">
            <SlSection title="学习主题" :sub="state.topics.length + ' 个'">
                <template #action>
                    <SlButton size="sm" variant="primary" icon-name="plus" @click="$emit('new')">开一个</SlButton>
                </template>

                <SlEmpty
                    v-if="!state.topics.length"
                    icon-name="lamp"
                    title="还没开始学什么"
                    desc="一个主题就是一面自己的推理墙。开一个吧 —— 老师会先出一份问卷摸摸你的底。"
                >
                    <SlButton variant="primary" icon-name="plus" @click="$emit('new')">开一个主题</SlButton>
                </SlEmpty>

                <div
                    v-for="t in state.topics" :key="t.id"
                    class="sl-topic" :class="{ 'is-on': t.id === state.activeTopicId }"
                    @click="$emit('select', t.id)"
                >
                    <span class="sl-topic__mark" :class="'is-' + t.mode">
                        <SlIcon :name="t.mode === 'language' ? 'globe' : 'code'" :size="16" />
                    </span>
                    <div class="sl-topic__text">
                        <h4>{{ t.title }}</h4>
                        <p>{{ sub(t) }}</p>
                    </div>
                    <div class="sl-topic__right">
                        <SlTag v-if="!t.planned" tone="warn">待规划</SlTag>
                        <span v-else class="sl-topic__ago">{{ ago(t) }}</span>
                    </div>
                </div>
            </SlSection>

            <SlSection v-if="state.activeTopicId" title="这个主题" :sub="state.identity.worldName">
                <div class="sl-quick">
                    <button type="button" class="sl-quick__item" @click="$emit('open-plan')">
                        <SlIcon name="book" :size="18" />
                        <b>{{ state.lessons.length }}</b><i>节课</i>
                    </button>
                    <div class="sl-quick__item">
                        <SlIcon name="graph" :size="18" />
                        <b>{{ state.cards.length }}</b><i>张卡</i>
                    </div>
                    <div class="sl-quick__item">
                        <SlIcon name="thread" :size="18" />
                        <b>{{ state.links.length }}</b><i>条线</i>
                    </div>
                    <div class="sl-quick__item">
                        <SlIcon name="flag" :size="18" />
                        <b>{{ state.stuck.filter(s => s.status !== 'resolved').length }}</b><i>卡住</i>
                    </div>
                </div>
            </SlSection>
        </div>
    `,
};

// ============================================================
// 新建主题
// ============================================================

export const SlNewTopic = {
    name: 'SlNewTopic',
    components: { ...UI },
    props: {
        state: { type: Object, required: true },
        teachers: { type: Array, default: () => [] },
    },
    emits: ['back', 'create', 'gloss-mode'],
    computed: {
        draft() { return this.state.draft; },
        isLang() { return this.draft.mode === MODES.language; },
        presets() { return this.isLang ? LANGUAGE_PRESETS : CODE_PRESETS; },
        immersions() { return IMMERSION_MODES; },
        glossModes() { return GLOSS_MODES; },
        glossMode() { return this.state.profile?.glossMode === 'tap' ? 'tap' : 'meme'; },
        sources() {
            return TEACHER_SOURCES.map((s) => ({
                ...s,
                disabled: s.id === 'persona' && this.teachers.length === 0,
            }));
        },
        canSubmit() { return Boolean(String(this.draft.title || '').trim()); },
    },
    methods: {
        pickMode(id) {
            this.draft.mode = id;
            this.draft.target = '';
            this.draft.targetNative = '';
        },
        pickPreset(p) {
            this.draft.target = p.label;
            this.draft.targetNative = p.native || '';
            if (!this.draft.title) {
                this.draft.title = this.isLang ? `学${p.label}` : p.label;
            }
        },
        pickSource(id) {
            if (id === 'persona' && this.teachers.length === 0) return;
            this.draft.teacherSource = id;
            if (id === 'persona' && !this.draft.teacherAiId && this.teachers[0]) {
                this.draft.teacherAiId = this.teachers[0].id;
            }
        },
    },
    template: `
        <div class="sl-new">
            <SlTopbar title="开一个学习主题" sub="一个主题 = 一面推理墙" @back="$emit('back')" />

            <div class="sl-new__scroll">
                <SlField label="学什么">
                    <div class="sl-modes">
                        <button
                            type="button" class="sl-modes__item" :class="{ 'is-on': draft.mode === 'language' }"
                            @click="pickMode('language')"
                        >
                            <SlIcon name="globe" :size="19" />
                            <b>语言</b>
                            <i>必须用目标语言对话，中文以描边字贴在旁边</i>
                        </button>
                        <button
                            type="button" class="sl-modes__item" :class="{ 'is-on': draft.mode === 'code' }"
                            @click="pickMode('code')"
                        >
                            <SlIcon name="code" :size="19" />
                            <b>代码</b>
                            <i>每行代码能长按改，预览窗能看网页怎么长出来</i>
                        </button>
                    </div>
                </SlField>

                <SlField :label="isLang ? '哪门语言' : '哪一块'">
                    <div class="sl-picks">
                        <button
                            v-for="p in presets" :key="p.id" type="button"
                            class="sl-picks__item" :class="{ 'is-on': draft.target === p.label }"
                            @click="pickPreset(p)"
                        >{{ p.label }}</button>
                    </div>
                    <input class="sl-input" v-model="draft.target" :placeholder="isLang ? '也可以自己填，比如古希腊语' : '也可以自己填，比如 Canvas 动画'" />
                </SlField>

                <SlField label="主题名字">
                    <input class="sl-input" v-model="draft.title" placeholder="给它起个名字" />
                </SlField>

                <SlField label="谁来教" hint="世界观里的 AI 会带着自己的性格上课；模型本身则只当一位好老师">
                    <div class="sl-sources">
                        <button
                            v-for="s in sources" :key="s.id" type="button"
                            class="sl-sources__item"
                            :class="{ 'is-on': draft.teacherSource === s.id, 'is-off': s.disabled }"
                            @click="pickSource(s.id)"
                        >
                            <SlIcon :name="s.id === 'persona' ? 'teacher' : 'sparkle'" :size="17" />
                            <b>{{ s.label }}</b>
                            <i>{{ s.disabled ? '这个世界里还没有绑定的 AI' : s.desc }}</i>
                        </button>
                    </div>

                    <div v-if="draft.teacherSource === 'persona'" class="sl-teachers">
                        <button
                            v-for="t in teachers" :key="t.id" type="button"
                            class="sl-teachers__item" :class="{ 'is-on': draft.teacherAiId === t.id }"
                            @click="draft.teacherAiId = t.id"
                        >
                            <SlAvatar :name="t.name" :url="t.avatar" :bg="t.avatarBg" :size="28" />
                            <span>{{ t.name }}</span>
                        </button>
                    </div>
                </SlField>

                <SlField
                    v-if="isLang"
                    label="老师说多少外文"
                    hint="循序渐进会按课程进度自动加大外文比例；之后在「我的」里随时能改"
                >
                    <div class="sl-opts">
                        <button
                            v-for="m in immersions" :key="m.id" type="button"
                            class="sl-opt" :class="{ 'is-on': draft.immersion === m.id }"
                            @click="draft.immersion = m.id"
                        >
                            <b>{{ m.label }}</b>
                            <i>{{ m.desc }}</i>
                        </button>
                    </div>
                </SlField>

                <SlField
                    v-if="isLang"
                    label="翻译怎么显示"
                    hint="这一条是全局设置，所有语言主题共用"
                >
                    <div class="sl-opts">
                        <button
                            v-for="g in glossModes" :key="g.id" type="button"
                            class="sl-opt" :class="{ 'is-on': glossMode === g.id }"
                            @click="$emit('gloss-mode', g.id)"
                        >
                            <b>{{ g.label }}</b>
                            <i>{{ g.desc }}</i>
                        </button>
                    </div>
                </SlField>

                <SlButton
                    variant="primary" block icon-name="sparkle"
                    :disabled="!canSubmit" :loading="state.loading.survey"
                    @click="$emit('create')"
                >建好，先出一份问卷</SlButton>
            </div>
        </div>
    `,
};

// ============================================================
// 课程表
// ============================================================

export const SlLessonsPage = {
    name: 'SlLessonsPage',
    components: { ...UI },
    props: {
        state: { type: Object, required: true },
        topic: { type: Object, default: null },
    },
    emits: ['open', 'flip', 'plan', 'review', 'add', 'delete'],
    computed: {
        lessons() { return this.state.lessons; },
        doneCount() {
            return this.lessons.filter((l) => l.status === LESSON_STATUS.done || l.status === LESSON_STATUS.flipped).length;
        },
        openStuck() { return this.state.stuck.filter((s) => s.status !== 'resolved'); },
    },
    methods: {
        statusLabel(l) { return STATUS_LABEL[l.status] || ''; },
        objectiveText(l) {
            const list = l.objectives || [];
            if (!list.length) return '目标由老师开课时定';
            return list.map((o) => o.text).join(' · ');
        },
        short(text, n) { return truncate(text, n); },
    },
    template: `
        <div class="sl-page">
            <template v-if="!topic">
                <SlEmpty icon-name="book" title="先选一个主题" desc="课程是挂在主题下面的。" />
            </template>

            <template v-else-if="!topic.planned">
                <SlEmpty
                    icon-name="flag"
                    title="还没排课"
                    :desc="topic.surveyStage === 'done'
                        ? '摸底做完了，说说你想到哪儿去，老师就能排出路线。'
                        : '老师会先出一份问卷摸摸你的底，然后才排课。'"
                >
                    <SlButton variant="primary" icon-name="sparkle" @click="$emit('plan')">
                        {{ topic.surveyStage === 'done' ? '去定终点' : '去做问卷' }}
                    </SlButton>
                </SlEmpty>
            </template>

            <template v-else>
                <SlSection :title="topic.title" :sub="doneCount + ' / ' + lessons.length + ' 节'">
                    <template #action>
                        <SlButton size="sm" variant="ghost" icon-name="refresh" @click="$emit('plan')">重排</SlButton>
                    </template>

                    <p v-if="topic.throughline" class="sl-through">{{ topic.throughline }}</p>
                    <SlProgress :value="doneCount" :total="lessons.length" />
                </SlSection>

                <div class="sl-lessons">
                    <div
                        v-for="l in lessons" :key="l.id"
                        class="sl-lc" :class="'is-' + l.status"
                    >
                        <div class="sl-lc__rail">
                            <span class="sl-lc__n">{{ l.index }}</span>
                            <i class="sl-lc__line"></i>
                        </div>
                        <div class="sl-lc__body" @click="$emit('open', l.id)">
                            <div class="sl-lc__head">
                                <h4>{{ l.title }}</h4>
                                <SlTag :tone="l.status === 'planned' ? '' : 'ok'">{{ statusLabel(l) }}</SlTag>
                            </div>
                            <p class="sl-lc__goal">{{ objectiveText(l) }}</p>
                            <p v-if="l.summary" class="sl-lc__sum">{{ short(l.summary, 56) }}</p>

                            <div class="sl-lc__acts" @click.stop>
                                <SlButton
                                    size="sm"
                                    :variant="l.status === 'planned' ? 'primary' : 'line'"
                                    :icon-name="l.status === 'planned' ? 'play' : 'teacher'"
                                    @click="$emit('open', l.id)"
                                >{{ l.status === 'planned' ? '开始上课' : '回到课堂' }}</SlButton>

                                <SlButton
                                    v-if="l.status !== 'planned'"
                                    size="sm" variant="soft" icon-name="flip"
                                    @click="$emit('flip', l.id)"
                                >{{ l.flip && l.flip.status === 'done' ? '再讲一次' : '反转课堂' }}</SlButton>

                                <SlButton
                                    v-if="l.summary"
                                    size="sm" variant="ghost" icon-name="note"
                                    @click="$emit('review', l.id)"
                                >总结</SlButton>
                            </div>
                        </div>
                    </div>
                </div>

                <SlSection v-if="openStuck.length" title="错题本" :sub="openStuck.length + ' 个还没通'">
                    <div v-for="s in openStuck" :key="s.id" class="sl-stuck">
                        <SlIcon name="flag" :size="15" />
                        <div class="sl-stuck__text">
                            <b>{{ s.point }}</b>
                            <i v-if="s.prerequisite">要先补：{{ s.prerequisite }}</i>
                            <i v-else-if="s.why">{{ s.why }}</i>
                        </div>
                        <SlTag v-if="s.status === 'scheduled'" tone="ok">已安排</SlTag>
                    </div>
                </SlSection>

                <SlButton variant="ghost" icon-name="plus" block @click="$emit('add')">自己加一节</SlButton>
            </template>
        </div>
    `,
};

// ============================================================
// 结课反思（只看这节课的东西）
// ============================================================

export const SlReviewPage = {
    name: 'SlReviewPage',
    components: { ...UI, SlCardChip },
    props: {
        state: { type: Object, required: true },
        lesson: { type: Object, default: null },
        cards: { type: Array, default: () => [] },
    },
    emits: ['back', 'open-card', 'wall', 'flip', 'notes', 'next'],
    data() {
        return { notes: '' };
    },
    watch: {
        lesson: {
            immediate: true,
            handler(l) { this.notes = l?.notes || ''; },
        },
    },
    computed: {
        flip() { return this.lesson?.flip || {}; },
        stuck() {
            return this.state.stuck.filter((s) => String(s.lessonId) === String(this.lesson?.id));
        },
    },
    template: `
        <div class="sl-review">
            <SlTopbar
                :title="lesson ? ('第 ' + lesson.index + ' 节 · 总结') : '总结'"
                :sub="lesson ? lesson.title : ''"
                @back="$emit('back')"
            />

            <div class="sl-review__scroll">
                <SlSection title="这节课打通了什么">
                    <p class="sl-review__sum">{{ lesson && lesson.summary || '还没有总结' }}</p>
                </SlSection>

                <SlSection title="这节课的卡片" :sub="cards.length + ' 张'">
                    <template #action>
                        <SlButton size="sm" variant="ghost" icon-name="graph" @click="$emit('wall')">去推理墙</SlButton>
                    </template>
                    <div class="sl-review__cards">
                        <SlCardChip v-for="c in cards" :key="c.id" :card="c" @open="$emit('open-card', $event)" />
                    </div>
                    <p class="sl-review__note">这里只看得到这节课的东西。整个主题的网在推理墙上。</p>
                </SlSection>

                <SlSection v-if="stuck.length" title="这节课卡住的地方">
                    <div v-for="s in stuck" :key="s.id" class="sl-stuck">
                        <SlIcon name="flag" :size="15" />
                        <div class="sl-stuck__text">
                            <b>{{ s.point }}</b>
                            <i v-if="s.why">{{ s.why }}</i>
                        </div>
                    </div>
                    <p class="sl-review__note">知识不是线性的。这些多半不是你笨，是还没学到更深的那一层 —— 老师已经把它们排到后面的课里了。</p>
                </SlSection>

                <SlSection v-if="flip.status === 'done'" title="反转课堂">
                    <p class="sl-review__sum">{{ flip.summary }}</p>
                    <div v-if="flip.clearOn && flip.clearOn.length" class="sl-review__list">
                        <span class="sl-review__list-head">你讲得很透</span>
                        <SlTag v-for="(x, i) in flip.clearOn" :key="i" tone="ok">{{ x }}</SlTag>
                    </div>
                    <div v-if="flip.shakyOn && flip.shakyOn.length" class="sl-review__list">
                        <span class="sl-review__list-head">讲的时候你自己也不确定</span>
                        <SlTag v-for="(x, i) in flip.shakyOn" :key="i" tone="warn">{{ x }}</SlTag>
                    </div>
                </SlSection>

                <SlSection title="你的笔记">
                    <textarea
                        class="sl-textarea" v-model="notes" rows="6"
                        placeholder="随手记点什么 —— 这一栏永远不会被 AI 覆盖"
                        @blur="$emit('notes', notes)"
                    ></textarea>
                </SlSection>

                <div class="sl-review__foot">
                    <SlButton
                        v-if="flip.status !== 'done'"
                        variant="primary" icon-name="flip" block
                        @click="$emit('flip')"
                    >开反转课堂 —— 换你来讲</SlButton>
                    <SlButton v-else variant="line" icon-name="chevron" block @click="$emit('next')">
                        去下一节
                    </SlButton>
                </div>
            </div>
        </div>
    `,
};

// ============================================================
// 我的
// ============================================================

export const SlMePage = {
    name: 'SlMePage',
    components: { ...UI },
    props: {
        state: { type: Object, required: true },
        topic: { type: Object, default: null },
        teachers: { type: Array, default: () => [] },
    },
    emits: [
        'theme', 'ticker', 'teacher', 'delete-topic',
        'immersion', 'gloss-mode', 'bubble-split', 'translate-engine',
    ],
    computed: {
        profile() { return this.state.profile || {}; },
        immersions() { return IMMERSION_MODES; },
        glossModes() { return GLOSS_MODES; },
        engines() { return TRANSLATE_ENGINES; },
        /** 只有语言主题才谈得上「说多少外文」 */
        isLangTopic() { return this.topic?.mode === MODES.language; },
        immersion() { return this.topic?.immersion === 'full' ? 'full' : 'gradual'; },
        glossMode() { return this.profile.glossMode === 'tap' ? 'tap' : 'meme'; },
        bubbleSplit() { return this.profile.bubble?.split !== false; },
        engine() { return this.profile.translate?.engine === 'ai' ? 'ai' : 'local'; },
        stat() {
            const done = this.state.lessons.filter((l) => l.status === 'done' || l.status === 'flipped').length;
            return {
                topics: this.state.topics.length,
                lessons: done,
                cards: this.state.cards.length,
                dict: this.state.dict.length,
            };
        },
    },
    template: `
        <div class="sl-page">
            <div class="sl-me__head">
                <SlAvatar
                    :name="state.identity.userName"
                    :url="state.identity.userAvatar"
                    :bg="state.identity.userAvatarBg"
                    :size="46"
                />
                <div>
                    <h3>{{ state.identity.userName }}</h3>
                    <p>{{ state.identity.hasWorld ? state.identity.worldName : '没绑世界观 · 模型直接教' }}</p>
                </div>
            </div>

            <div class="sl-me__stats">
                <div><b>{{ stat.topics }}</b><i>主题</i></div>
                <div><b>{{ stat.lessons }}</b><i>上完的课</i></div>
                <div><b>{{ stat.cards }}</b><i>卡片</i></div>
                <div><b>{{ stat.dict }}</b><i>词条</i></div>
            </div>

            <SlSection v-if="topic" title="当前主题的水平侧写" :sub="'第 ' + (topic.profileVersion || 0) + ' 版'">
                <p class="sl-profile__text">{{ topic.learnerProfile || '还没有 —— 做完问卷就有了' }}</p>
                <p class="sl-profile__note">每节课结束会覆盖重写一次（不是追加，所以它不会越滚越长）。反转课堂里 AI 扮演的学生用的就是这一份。</p>
            </SlSection>

            <SlSection v-if="topic" title="谁来教">
                <div class="sl-sources">
                    <button
                        type="button" class="sl-sources__item"
                        :class="{ 'is-on': topic.teacherSource !== 'persona' }"
                        @click="$emit('teacher', { source: 'model' })"
                    >
                        <SlIcon name="sparkle" :size="17" /><b>模型本身</b><i>不套人设</i>
                    </button>
                    <button
                        v-for="t in teachers" :key="t.id" type="button"
                        class="sl-sources__item"
                        :class="{ 'is-on': topic.teacherSource === 'persona' && topic.teacherAiId === t.id }"
                        @click="$emit('teacher', { source: 'persona', aiId: t.id })"
                    >
                        <SlAvatar :name="t.name" :url="t.avatar" :bg="t.avatarBg" :size="22" />
                        <b>{{ t.name }}</b><i>{{ t.role || '世界观里的 AI' }}</i>
                    </button>
                </div>
            </SlSection>

            <SlSection v-if="isLangTopic" title="老师说多少外文" sub="只影响当前这个主题">
                <div class="sl-opts">
                    <button
                        v-for="m in immersions" :key="m.id" type="button"
                        class="sl-opt" :class="{ 'is-on': immersion === m.id }"
                        @click="$emit('immersion', m.id)"
                    >
                        <b>{{ m.label }}</b>
                        <i>{{ m.desc }}</i>
                    </button>
                </div>
                <p class="sl-review__note">
                    循序渐进是按「这是第几节课」自动升档的：前 3 节中外夹着说，4~8 节以外文为主，
                    之后基本全外文。不用你手动切。
                </p>
            </SlSection>

            <SlSection title="翻译怎么显示">
                <div class="sl-opts">
                    <button
                        v-for="g in glossModes" :key="g.id" type="button"
                        class="sl-opt" :class="{ 'is-on': glossMode === g.id }"
                        @click="$emit('gloss-mode', g.id)"
                    >
                        <b>{{ g.label }}</b>
                        <i>{{ g.desc }}</i>
                    </button>
                </div>
            </SlSection>

            <SlSection title="长按翻译" sub="长按气泡、卡片上的文字">
                <div class="sl-opts">
                    <button
                        v-for="e in engines" :key="e.id" type="button"
                        class="sl-opt" :class="{ 'is-on': engine === e.id }"
                        @click="$emit('translate-engine', e.id)"
                    >
                        <b>{{ e.label }}</b>
                        <i>{{ e.desc }}</i>
                    </button>
                </div>
                <p class="sl-review__note">
                    选「让 AI 翻」时，每次只会把你长按的那一段（或那一张卡）发出去，
                    不带世界观、不带聊天记录 —— 就是为了省额度。
                </p>
            </SlSection>

            <SlSection title="设置">
                <button type="button" class="sl-row" @click="$emit('bubble-split', !bubbleSplit)">
                    <SlIcon name="book" :size="17" />
                    <span>把长回复拆成短气泡</span>
                    <i>{{ bubbleSplit ? '开' : '关' }}</i>
                    <SlIcon name="chevron" :size="15" />
                </button>
                <button type="button" class="sl-row" @click="$emit('ticker')">
                    <SlIcon name="tv" :size="17" />
                    <span>悬浮播放</span>
                    <i>{{ profile.ticker && profile.ticker.on ? '弹幕开着' : '关' }}{{ profile.tv && profile.tv.on ? ' · 小电视开着' : '' }}</i>
                    <SlIcon name="chevron" :size="15" />
                </button>
                <button type="button" class="sl-row" @click="$emit('theme')">
                    <SlIcon name="palette" :size="17" />
                    <span>配色</span>
                    <i>{{ profile.themeId }}</i>
                    <SlIcon name="chevron" :size="15" />
                </button>
                <button type="button" data-presence-center="starlit" class="sl-row">
                    <SlIcon name="settings" :size="17" />
                    <span>灵动岛与小组件</span>
                    <SlIcon name="chevron" :size="15" />
                </button>
            </SlSection>

            <SlSection v-if="topic" title="危险操作">
                <SlButton variant="danger" icon-name="trash" block @click="$emit('delete-topic', topic.id)">
                    删掉「{{ topic.title }}」
                </SlButton>
                <p class="sl-review__note">会连同它的课程、卡片、连线、词条一起删掉，不能撤销。</p>
            </SlSection>
        </div>
    `,
};

export const PAGES = {
    SlTopicsPage, SlNewTopic, SlLessonsPage, SlReviewPage, SlMePage,
};
