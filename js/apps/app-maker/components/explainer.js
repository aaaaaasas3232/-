/**
 * 科普组件（可复用）
 *
 * ── 为什么要抽成组件 ──────────────────────────────────────────────
 * 「科普」在这个 App 里有**两个**用武之地，而且形态不同：
 *
 *   1. 独立的科普页 —— 用户主动来查：分类 → 词条 → 详情
 *   2. 问卷里的随手一问 —— 用户正在答题，看到「瀑布流」三个字不确定，
 *      想就地看一眼解释，看完继续答题，不能跳走
 *
 * 这两件事共享同一份词典和同一套详情排版。如果各写一份，
 * 加一个新词条就要改两个地方，而第二处一定会被忘掉。
 *
 * 所以这里导出三个东西：
 *   AmExplainer     完整的科普面板（给科普页用）
 *   AmExplainTip    一个小小的「?」按钮（给问卷里的每道题用）
 *   AmTermSheet     词条详情弹层（上面两个共用）
 *
 * 三个组件都不碰 store —— 科普只是查阅，没有需要持久化的状态。
 */

import { GLOSSARY_GROUPS, findGlossaryGroup, findGlossaryTerm } from '../glossary.js';
import { ICONS, groupIcon } from '../icons.js';

/** 词条详情。上下文只有一个词，所以做成从底部升起的一层。 */
export const AmTermSheet = {
    name: 'AmTermSheet',
    props: {
        term: { type: Object, default: null },
        /** 从分类进来的显示「返回分类」，从问卷直接点进来的只显示「知道了」 */
        backLabel: { type: String, default: '' },
    },
    emits: ['close', 'back'],
    computed: {
        icons() { return ICONS; },
        blocks() {
            const t = this.term || {};
            return [
                { key: 'simple', label: '一句话说', text: t.simple },
                { key: 'realLife', label: '生活里的例子', text: t.realLife },
                { key: 'detail', label: '再详细一点', text: t.detail },
                { key: 'contrast', label: '和别的词比一比', text: t.contrast },
                { key: 'tip', label: '描述需求时怎么用', text: t.tip, highlight: true },
            ].filter((b) => b.text);
        },
    },
    template: `
        <div class="am-sheet-mask" @click.self="$emit('close')">
            <section class="am-sheet" role="dialog" aria-modal="true">
                <div class="am-sheet__grip" aria-hidden="true"></div>
                <header class="am-sheet__head">
                    <div>
                        <h3 class="am-sheet__title">{{ term.word }}</h3>
                        <p v-if="term.pronunciation" class="am-sheet__pinyin">{{ term.pronunciation }}</p>
                    </div>
                    <button type="button" class="am-sheet__close" @click="$emit('close')" aria-label="关闭" v-html="icons.close"></button>
                </header>
                <div class="am-sheet__body">
                    <div
                        v-for="b in blocks" :key="b.key"
                        class="am-termblock"
                        :class="{ 'is-tip': b.highlight }"
                    >
                        <div class="am-termblock__label">{{ b.label }}</div>
                        <p class="am-termblock__text">{{ b.text }}</p>
                    </div>
                </div>
                <footer class="am-sheet__foot">
                    <button v-if="backLabel" type="button" class="am-btn am-btn--ghost" @click="$emit('back')">{{ backLabel }}</button>
                    <button type="button" class="am-btn am-btn--primary" @click="$emit('close')">知道了</button>
                </footer>
            </section>
        </div>
    `,
};

/** 分类里的词条列表 */
export const AmTermList = {
    name: 'AmTermList',
    props: {
        group: { type: Object, required: true },
    },
    emits: ['pick', 'back'],
    computed: {
        icons() { return ICONS; },
        glyph() { return groupIcon(this.group.id); },
    },
    template: `
        <div class="am-glist">
            <button type="button" class="am-glist__back" @click="$emit('back')">
                <span v-html="icons.chevronLeft"></span>所有分类
            </button>
            <div class="am-glist__head">
                <span class="am-gicon" v-html="glyph"></span>
                <div>
                    <h3 class="am-glist__title">{{ group.title }}</h3>
                    <p class="am-glist__desc">{{ group.desc }}</p>
                </div>
            </div>
            <div class="am-terms">
                <button
                    v-for="t in group.terms" :key="t.word"
                    type="button" class="am-termrow"
                    @click="$emit('pick', t.word)"
                >
                    <span class="am-termrow__word">{{ t.word }}</span>
                    <span class="am-termrow__simple">{{ t.simple }}</span>
                    <span class="am-termrow__arrow" aria-hidden="true" v-html="icons.chevronRight"></span>
                </button>
            </div>
        </div>
    `,
};

/**
 * 完整科普面板。
 *
 * 自己管三层状态（分类列表 / 词条列表 / 词条详情），
 * 外部只需要 `<am-explainer />` 一句话。
 */
export const AmExplainer = {
    name: 'AmExplainer',
    components: { AmTermList, AmTermSheet },
    props: {
        /** 只想展示部分分类时传 id 数组 */
        only: { type: Array, default: null },
        /** 搜索框要不要 */
        searchable: { type: Boolean, default: true },
    },
    /**
     * 往外抛「现在钻到第几层了」。
     * 外面那一层的页头是「不知道那叫什么」加一整段引言，占掉将近三分之一屏 ——
     * 点进分类之后那段话就是纯粹的重复，得让宿主有机会收掉它。
     */
    emits: ['nav'],
    data() {
        return { groupId: '', termWord: '', keyword: '' };
    },
    watch: {
        groupId: {
            immediate: true,
            handler(id) { this.$emit('nav', id ? findGlossaryGroup(id) : null); },
        },
    },
    computed: {
        icons() { return ICONS; },
        groups() {
            const all = this.only && this.only.length
                ? GLOSSARY_GROUPS.filter((g) => this.only.indexOf(g.id) >= 0)
                : GLOSSARY_GROUPS;
            return all;
        },
        group() { return this.groupId ? findGlossaryGroup(this.groupId) : null; },
        term() { return this.termWord ? findGlossaryTerm(this.groupId, this.termWord) : null; },
        /** 搜索是跨分类的 —— 用户想查一个词的时候，不知道它属于哪个分类才是常态 */
        hits() {
            const kw = this.keyword.trim();
            if (!kw) return [];
            const out = [];
            for (const g of this.groups) {
                for (const t of g.terms) {
                    if (t.word.indexOf(kw) >= 0 || (t.simple || '').indexOf(kw) >= 0) {
                        out.push({ groupId: g.id, groupTitle: g.title, term: t });
                    }
                }
            }
            return out.slice(0, 20);
        },
        totalTerms() {
            return this.groups.reduce((n, g) => n + g.terms.length, 0);
        },
    },
    methods: {
        glyph(id) { return groupIcon(id); },
        openGroup(id) { this.groupId = id; this.termWord = ''; },
        openTerm(word) { this.termWord = word; },
        openHit(hit) { this.groupId = hit.groupId; this.termWord = hit.term.word; },
        backToGroups() { this.groupId = ''; this.termWord = ''; },
        closeTerm() { this.termWord = ''; },
    },
    template: `
        <div class="am-explainer">
            <template v-if="!group">
                <div v-if="searchable" class="am-search">
                    <span class="am-search__icon" aria-hidden="true" v-html="icons.search"></span>
                    <input class="am-search__input" type="search" v-model="keyword" placeholder="搜一个词，比如「瀑布流」" />
                    <button v-if="keyword" type="button" class="am-search__clear" @click="keyword = ''" aria-label="清空" v-html="icons.close"></button>
                </div>

                <div v-if="keyword.trim()" class="am-hits">
                    <p v-if="!hits.length" class="am-hits__empty">没找到「{{ keyword }}」。换个说法试试，或者往下翻分类。</p>
                    <div v-else class="am-terms">
                        <button
                            v-for="(h, i) in hits" :key="i"
                            type="button" class="am-termrow"
                            @click="openHit(h)"
                        >
                            <span class="am-termrow__word">{{ h.term.word }}</span>
                            <span class="am-termrow__simple">{{ h.term.simple }}</span>
                            <span class="am-termrow__group">{{ h.groupTitle }}</span>
                        </button>
                    </div>
                </div>

                <div v-else class="am-gcards">
                    <button
                        v-for="g in groups" :key="g.id"
                        type="button" class="am-gcard"
                        @click="openGroup(g.id)"
                    >
                        <span class="am-gicon" v-html="glyph(g.id)"></span>
                        <span class="am-gcard__title">{{ g.title }}</span>
                        <span class="am-gcard__desc">{{ g.desc }}</span>
                        <span class="am-gcard__count">{{ g.terms.length }} 个词</span>
                    </button>
                </div>
            </template>

            <am-term-list v-else :group="group" @pick="openTerm" @back="backToGroups" />

            <am-term-sheet
                v-if="term"
                :term="term"
                back-label="返回列表"
                @close="closeTerm"
                @back="closeTerm"
            />
        </div>
    `,
};

/**
 * 问卷里的「?」按钮。
 *
 * 用法：`<am-explain-tip term="瀑布流" />`
 * 点一下就地弹出这个词的详情，看完关掉，用户不会离开当前题目。
 *
 * 找不到这个词就**什么都不渲染** —— 一个点了没反应的问号比没有问号更糟。
 */
export const AmExplainTip = {
    name: 'AmExplainTip',
    components: { AmTermSheet },
    props: {
        term: { type: String, required: true },
        label: { type: String, default: '' },
    },
    data() {
        return { open: false };
    },
    computed: {
        icons() { return ICONS; },
        found() {
            for (const g of GLOSSARY_GROUPS) {
                const hit = g.terms.find((t) => t.word === this.term);
                if (hit) return hit;
            }
            return null;
        },
    },
    template: `
        <span v-if="found" class="am-tip">
            <button type="button" class="am-tip__btn" @click="open = true">
                <span v-html="icons.question"></span>{{ label || '这是什么' }}
            </button>
            <am-term-sheet v-if="open" :term="found" @close="open = false" />
        </span>
    `,
};

export const EXPLAINER_COMPONENTS = { AmExplainer, AmExplainTip, AmTermSheet, AmTermList };
