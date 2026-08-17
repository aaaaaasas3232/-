/**
 * 氧气 · 发现页（热搜 + 本地搜索）
 *
 * 顶部搜索框只过滤本地已缓存的帖子与随笔，不触发生成。
 * 热搜词条一次生成一批；热度由 JS 按小时窗演化，普通刷新不调 AI；
 * 显式点「换一批」才重新生成。provider 词条标「与你有关」。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { fmtCount } from '../utils.js';

export const OxDiscoverPage = {
    name: 'OxDiscoverPage',
    components: { ...UI },
    data() {
        return { query: '' };
    },
    computed: {
        s() { return store.getState(); },
        terms() { return store.sortedHotTerms(); },
        loading() { return this.s.loading.hot; },
        results() { return store.searchLocal(this.query); },
        searching() { return Boolean(this.query.trim()); },
    },
    methods: {
        refresh() { void store.generateHot(); },
        openTerm(id) { void store.openTerm(id); },
        openPost(post) { void store.openOwnPost(post.id); },
        heatOf(term) { return fmtCount(store.displayHeat(term)); },
        clearError() { store.clearError(); },
        openEssay(essay) {
            store.openModal('essay', { essayId: essay.id });
        },
    },
    template: `
        <div class="ox-page ox-discoverpage">
            <div class="ox-search">
                <OxIcon name="discover" :size="16" />
                <input
                    v-model="query" class="ox-search__input" type="text"
                    placeholder="只搜你已经读过的（不触发生成）"
                />
                <button v-if="query" type="button" class="ox-search__x" @click="query = ''">×</button>
            </div>

            <div v-if="s.error" class="ox-errorbar">
                <span>{{ s.error }}</span>
                <button type="button" class="ox-errorbar__x" @click="clearError">好</button>
            </div>

            <!-- 本地搜索结果 -->
            <template v-if="searching">
                <OxSection title="帖子" :sub="results.posts.length + ' 条'">
                    <p v-if="!results.posts.length" class="ox-muted">已缓存的帖子里没有这个词。</p>
                    <button
                        v-for="p in results.posts" :key="p.id" type="button"
                        class="ox-searchhit" @click="openPost(p)"
                    >
                        <span class="ox-searchhit__tags"><span v-for="t in p.tags" :key="t" class="ox-tag">{{ t }}</span></span>
                        <span class="ox-searchhit__brief">{{ (p.content || '').slice(0, 40) }}</span>
                    </button>
                </OxSection>
                <OxSection title="随笔" :sub="results.essays.length + ' 条'">
                    <p v-if="!results.essays.length" class="ox-muted">随笔里没有这个词。</p>
                    <button
                        v-for="e in results.essays" :key="e.id" type="button"
                        class="ox-searchhit" @click="openEssay(e)"
                    >
                        <span class="ox-searchhit__brief">{{ (e.text || '').slice(0, 46) }}</span>
                        <span class="ox-searchhit__day">{{ e.day }}</span>
                    </button>
                </OxSection>
            </template>

            <!-- 热搜榜 -->
            <template v-else>
                <OxLoading v-if="loading" :lines="['在听风声', '热度正在聚拢']" />

                <OxEmpty
                    v-else-if="!terms.length"
                    icon-name="fire"
                    title="这个世界还没有热搜"
                    desc="生成一批词条 —— 点词条才会生成它下面的帖子。"
                >
                    <OxButton variant="ink" icon-name="fire" @click="refresh">看看世界在吵什么</OxButton>
                </OxEmpty>

                <template v-else>
                    <OxSection title="热搜" sub="热度由本地演化，刷新不调 AI">
                        <div class="ox-hotlist">
                            <button
                                v-for="(t, i) in terms" :key="t.id" type="button"
                                class="ox-hotrow" :class="{ 'is-mine': t.fromProvider, 'is-top': i < 3 }"
                                @click="openTerm(t.id)"
                            >
                                <span class="ox-hotrow__rank">{{ i + 1 }}</span>
                                <span class="ox-hotrow__term">{{ t.term }}</span>
                                <span v-if="t.fromProvider" class="ox-hotrow__me">与你有关</span>
                                <span v-else-if="t.category" class="ox-hotrow__cat">{{ t.category }}</span>
                                <span class="ox-hotrow__heat">{{ heatOf(t) }}</span>
                            </button>
                        </div>
                    </OxSection>
                    <div class="ox-feed-foot">
                        <OxButton icon-name="refresh" :loading="loading" @click="refresh">换一批</OxButton>
                    </div>
                </template>
            </template>
        </div>
    `,
};

/**
 * 词条页：某个热搜下的帖子（依旧标签优先）。
 */
export const OxTermPage = {
    name: 'OxTermPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        term() { return store.getActiveTerm(); },
        loading() { return this.s.loading.term; },
        posts() { return this.term?.posts || []; },
    },
    methods: {
        back() { store.popView(); },
        open(stub) { void store.openPost(stub); },
        openAuthor(authorId) { void store.openAuthor(authorId, `在热搜「${this.term?.term || ''}」下认识的`); },
    },
    template: `
        <div class="ox-page ox-termpage">
            <OxSubtop :title="term ? term.term : '热搜'" @back="back" />
            <p v-if="term && term.fromProvider" class="ox-termpage__from">这条热搜和你有关{{ term.providerLabel ? '（来自 ' + term.providerLabel + '）' : '' }}</p>

            <div v-if="s.error" class="ox-errorbar"><span>{{ s.error }}</span></div>

            <OxLoading v-if="loading" :lines="['大家正在赶来讨论']" />

            <template v-else>
                <OxEmpty v-if="!posts.length" icon-name="fire" title="还没人讨论" desc="生成失败的话回上一页重进一次。" />
                <div v-else class="ox-feed-list">
                    <OxStubCard
                        v-for="stub in posts" :key="stub.id"
                        :stub="stub"
                        @open="open"
                        @open-author="openAuthor"
                    />
                </div>
            </template>
        </div>
    `,
};
