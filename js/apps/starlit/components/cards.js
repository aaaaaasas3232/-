/**
 * 点灯 · 卡片渲染
 *
 * 一张卡在三个地方出现，形态不同：
 *   chip   聊天里跟着消息出现的小卡（点开看详情）
 *   wall   推理墙上的便利贴（只有标题 + 一句话，要快）
 *   full   卡片详情页（可编辑，代码卡在这里才给编辑器）
 *
 * 墙上那一版必须**极轻**：一个主题几百张卡都在同一棵 DOM 里，
 * 每张多两个监听、多一层 v-html，滑动就掉帧。
 */

import { CARD_ICON } from '../icons.js';
import { CARD_TYPE_META } from '../constants.js';
import { hostOf, safeHttpUrl, truncate } from '../utils.js';
import { UI } from './ui.js';
import { SlCodeCard } from './code-card.js';
import { longPressMixin } from './long-press.js';

/** 墙上的便利贴。刻意不用任何 transition，靠父层统一控制。 */
export const SlWallCard = {
    name: 'SlWallCard',
    components: { ...UI },
    props: {
        card: { type: Object, required: true },
        selected: { type: Boolean, default: false },
        linking: { type: Boolean, default: false },
        stackCount: { type: Number, default: 0 },
        tilt: { type: Number, default: 0 },
    },
    computed: {
        iconName() { return CARD_ICON[this.card.type] || 'note'; },
        typeLabel() { return CARD_TYPE_META[this.card.type]?.label || '卡片'; },
        style() {
            return {
                left: `${Number(this.card.x) || 0}px`,
                top: `${Number(this.card.y) || 0}px`,
                width: `${Number(this.card.w) || 168}px`,
                minHeight: `${Number(this.card.h) || 108}px`,
                transform: `rotate(${this.tilt}deg)`,
            };
        },
        line() {
            return this.card.brief || truncate(this.card.body, 40) || CARD_TYPE_META[this.card.type]?.hint || '';
        },
    },
    template: `
        <div
            class="sl-wc" :class="[
                'sl-wc--' + card.type,
                { 'is-sel': selected, 'is-link': linking, 'is-stack': stackCount > 1, 'is-pin': card.pinned }
            ]"
            :style="style"
            :data-card-id="card.id"
        >
            <span class="sl-wc__pin"></span>
            <div class="sl-wc__head">
                <span class="sl-wc__mark"><SlIcon :name="iconName" :size="13" /></span>
                <span class="sl-wc__type">{{ typeLabel }}</span>
                <span v-if="stackCount > 1" class="sl-wc__count">{{ stackCount }}</span>
            </div>
            <h4 class="sl-wc__title">{{ card.title }}</h4>
            <p v-if="line" class="sl-wc__line">{{ line }}</p>
            <span v-if="card.type === 'code'" class="sl-wc__badge">可预览</span>
            <span v-else-if="card.type === 'post'" class="sl-wc__badge">{{ card.post && card.post.host }}</span>
        </div>
    `,
};

/** 聊天里的小卡 */
export const SlCardChip = {
    name: 'SlCardChip',
    components: { ...UI },
    mixins: [longPressMixin],
    props: {
        card: { type: Object, required: true },
    },
    emits: ['open', 'translate'],
    computed: {
        iconName() { return CARD_ICON[this.card.type] || 'note'; },
        typeLabel() { return CARD_TYPE_META[this.card.type]?.label || '卡片'; },
        sub() {
            if (this.card.type === 'word') {
                const w = this.card.word || {};
                return [w.pos, w.meaning].filter(Boolean).join(' ');
            }
            if (this.card.type === 'post') return this.card.post?.host || '';
            return truncate(this.card.brief || this.card.body, 34);
        },
    },
    methods: {
        // 长按翻这张卡；单击照旧打开详情
        onDown(e) { this.lpDown(e, () => this.$emit('translate', this.card.id)); },
        onClick(e) {
            if (this.lpSwallowClick(e)) return;
            this.$emit('open', this.card.id);
        },
    },
    template: `
        <button
            type="button"
            class="sl-chip"
            :class="'sl-chip--' + card.type"
            @pointerdown="onDown"
            @pointermove="lpMove"
            @pointerup="lpUp"
            @pointercancel="lpUp"
            @pointerleave="lpUp"
            @click="onClick"
        >
            <span class="sl-chip__mark"><SlIcon :name="iconName" :size="15" /></span>
            <span class="sl-chip__text">
                <b>{{ card.title }}</b>
                <i v-if="sub">{{ sub }}</i>
            </span>
            <span class="sl-chip__type">{{ typeLabel }}</span>
        </button>
    `,
};

/** 词卡详情：词根是主角 */
export const SlWordBody = {
    name: 'SlWordBody',
    components: { ...UI },
    props: { card: { type: Object, required: true } },
    computed: {
        w() { return this.card.word || {}; },
        roots() { return Array.isArray(this.w.roots) ? this.w.roots : []; },
        examples() { return Array.isArray(this.w.examples) ? this.w.examples : []; },
    },
    template: `
        <div class="sl-word">
            <div class="sl-word__head">
                <span class="sl-word__term">{{ w.term || card.title }}</span>
                <span v-if="w.pos" class="sl-word__pos">{{ w.pos }}</span>
                <span class="sl-word__mean">{{ w.meaning }}</span>
            </div>

            <div v-if="roots.length" class="sl-word__roots">
                <div class="sl-word__roots-head"><SlIcon name="root" :size="14" /> 它从哪儿长出来的</div>
                <div v-for="(r, i) in roots" :key="i" class="sl-word__root">
                    <b>{{ r.part }}</b>
                    <span v-if="r.means">{{ r.means }}</span>
                    <i v-if="r.from">{{ r.from }}</i>
                </div>
            </div>

            <ul v-if="examples.length" class="sl-word__ex">
                <li v-for="(e, i) in examples" :key="i">{{ e }}</li>
            </ul>
        </div>
    `,
};

/** 帖子卡：链接必须真能点开 */
export const SlPostBody = {
    name: 'SlPostBody',
    components: { ...UI },
    props: { card: { type: Object, required: true } },
    computed: {
        url() { return safeHttpUrl(this.card.post?.url); },
        host() { return this.card.post?.host || hostOf(this.url); },
    },
    methods: {
        open() {
            if (!this.url) return;
            window.open(this.url, '_blank', 'noopener,noreferrer');
        },
    },
    template: `
        <div class="sl-post">
            <p class="sl-post__excerpt">{{ card.post && card.post.excerpt || card.brief }}</p>
            <div v-if="url" class="sl-post__link">
                <SlIcon name="link" :size="14" />
                <span class="sl-post__url">{{ url }}</span>
            </div>
            <SlButton v-if="url" variant="soft" size="sm" icon-name="globe" @click="open">
                去 {{ host }} 看原文
            </SlButton>
            <p v-else class="sl-post__bad">这张卡的链接不合法，已经拦下来了</p>
        </div>
    `,
};

/** 小测 */
export const SlQuizBody = {
    name: 'SlQuizBody',
    components: { ...UI },
    props: { card: { type: Object, required: true } },
    data() { return { picked: -1 }; },
    computed: {
        q() { return this.card.quiz || {}; },
        options() { return Array.isArray(this.q.options) ? this.q.options : []; },
        answered() { return this.picked >= 0; },
        right() { return this.picked === Number(this.q.answer); },
    },
    template: `
        <div class="sl-quiz">
            <p class="sl-quiz__q">{{ q.q }}</p>
            <button
                v-for="(o, i) in options" :key="i" type="button" class="sl-quiz__opt"
                :class="{
                    'is-right': answered && i === Number(q.answer),
                    'is-wrong': answered && i === picked && !right
                }"
                :disabled="answered"
                @click="picked = i"
            >{{ o }}</button>
            <p v-if="answered && q.why" class="sl-quiz__why">{{ q.why }}</p>
        </div>
    `,
};

/**
 * 卡片详情页。
 * 用户能改标题、摘要、正文；代码卡在这里挂完整编辑器。
 */
export const SlCardDetail = {
    name: 'SlCardDetail',
    components: { ...UI, SlCodeCard, SlWordBody, SlPostBody, SlQuizBody },
    mixins: [longPressMixin],
    props: {
        card: { type: Object, required: true },
        usage: { type: String, default: '' },
        expanding: { type: Boolean, default: false },
    },
    emits: ['close', 'change', 'delete', 'expand', 'link', 'unstack', 'translate'],
    data() {
        return { editing: false, form: { title: '', brief: '', body: '' }, question: '' };
    },
    computed: {
        typeLabel() { return CARD_TYPE_META[this.card.type]?.label || '卡片'; },
        iconName() { return CARD_ICON[this.card.type] || 'note'; },
        origin() {
            const m = String(this.card.body || '').split('【由来】');
            return m.length > 1 ? m.slice(1).join('【由来】').trim() : '';
        },
        mainBody() {
            return String(this.card.body || '').split('【由来】')[0].trim();
        },
    },
    methods: {
        startEdit() {
            this.form = {
                title: this.card.title || '',
                brief: this.card.brief || '',
                body: this.card.body || '',
            };
            this.editing = true;
        },
        saveEdit() {
            this.$emit('change', { ...this.form });
            this.editing = false;
        },
        onCodeChange(patch) {
            this.$emit('change', patch);
        },
        /**
         * 长按正文 → 翻译。
         * 传 selected 时只翻选中的那一段（用户先划词再长按的情况）。
         */
        onTextDown(e, fallback) {
            this.lpDown(e, () => {
                const picked = String(window.getSelection?.() || '').trim();
                this.$emit('translate', picked || fallback || '');
            });
        },
    },
    template: `
        <div class="sl-cd">
            <header class="sl-cd__head">
                <span class="sl-cd__mark" :class="'sl-cd__mark--' + card.type"><SlIcon :name="iconName" :size="17" /></span>
                <div class="sl-cd__title-box">
                    <input v-if="editing" class="sl-input" v-model="form.title" placeholder="标题" />
                    <h2 v-else class="sl-cd__title">{{ card.title }}</h2>
                    <p class="sl-cd__meta">
                        {{ typeLabel }}
                        <span v-if="usage"> · {{ usage }}</span>
                        <span v-if="card.edited"> · 你改过</span>
                    </p>
                </div>
                <button type="button" class="sl-cd__x" @click="$emit('close')"><SlIcon name="close" :size="18" /></button>
            </header>

            <div class="sl-cd__body">
                <SlWordBody v-if="card.type === 'word'" :card="card" />
                <SlPostBody v-else-if="card.type === 'post'" :card="card" />
                <SlQuizBody v-else-if="card.type === 'quiz'" :card="card" />
                <SlCodeCard v-else-if="card.type === 'code'" :card="card" @change="onCodeChange" @ask="$emit('expand', $event)" />

                <template v-if="editing">
                    <SlField label="一句话摘要">
                        <input class="sl-input" v-model="form.brief" placeholder="墙上只显示这一句" />
                    </SlField>
                    <SlField label="正文">
                        <textarea class="sl-textarea" v-model="form.body" rows="7"></textarea>
                    </SlField>
                </template>

                <template v-else>
                    <!-- 长按这几段任意一处都能翻译；划了词就只翻划中的那段 -->
                    <p
                        v-if="card.brief && card.type !== 'word'"
                        class="sl-cd__brief sl-lp"
                        @pointerdown="onTextDown($event, card.brief)"
                        @pointermove="lpMove" @pointerup="lpUp" @pointercancel="lpUp"
                    >{{ card.brief }}</p>
                    <p
                        v-if="mainBody"
                        class="sl-cd__text sl-lp"
                        @pointerdown="onTextDown($event, mainBody)"
                        @pointermove="lpMove" @pointerup="lpUp" @pointercancel="lpUp"
                    >{{ mainBody }}</p>
                    <div v-if="origin" class="sl-cd__origin">
                        <div class="sl-cd__origin-head"><SlIcon name="history" :size="14" /> 它是怎么来的</div>
                        <p
                            class="sl-lp"
                            @pointerdown="onTextDown($event, origin)"
                            @pointermove="lpMove" @pointerup="lpUp" @pointercancel="lpUp"
                        >{{ origin }}</p>
                    </div>
                    <p class="sl-cd__lphint">长按上面任意一段可以翻译</p>
                </template>

                <div v-if="card.tags && card.tags.length" class="sl-cd__tags">
                    <SlTag v-for="t in card.tags" :key="t">{{ t }}</SlTag>
                </div>

                <div class="sl-cd__ask">
                    <input class="sl-input" v-model="question" placeholder="对这张卡还有什么想问的" />
                    <SlButton
                        variant="soft" size="sm" icon-name="sparkle"
                        :loading="expanding"
                        @click="$emit('expand', { question }); question = ''"
                    >讲深一点</SlButton>
                </div>
            </div>

            <footer class="sl-cd__foot">
                <SlButton size="sm" variant="ghost" icon-name="thread" @click="$emit('link')">拉一条线</SlButton>
                <SlButton v-if="card.stackId" size="sm" variant="ghost" icon-name="stack" @click="$emit('unstack')">抽出来</SlButton>
                <span class="sl-section__spacer"></span>
                <SlButton v-if="!editing" size="sm" variant="line" icon-name="edit" @click="startEdit">编辑</SlButton>
                <SlButton v-else size="sm" variant="primary" icon-name="check" @click="saveEdit">保存</SlButton>
                <SlButton size="sm" variant="danger" icon-name="trash" @click="$emit('delete')">删除</SlButton>
            </footer>
        </div>
    `,
};

export const CARDS = { SlWallCard, SlCardChip, SlCardDetail, SlWordBody, SlPostBody, SlQuizBody };
