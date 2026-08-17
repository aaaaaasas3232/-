/**
 * 候鸟 · 探索页
 *
 * 「推荐」段是当前这批候选（刷新即覆盖，不累积）；
 * 「收藏」段是 destinations 表里 favorited 的那些，刷新带不走。
 * 点候选 → 详情页（详情那一刻才调 AI）。
 */

import * as store from '../store.js';
import { UI } from './ui.js';

/** 候选卡（推荐 / 收藏两段共用） */
export const TvCandidateCard = {
    name: 'TvCandidateCard',
    components: { ...UI },
    props: {
        item: { type: Object, required: true },
    },
    computed: {
        visited() {
            return store.getState().trips.some((t) => (
                t.status === 'completed'
                && t.destination?.placeName === this.item.placeName
                && t.destination?.locationName === this.item.locationName
            ));
        },
    },
    methods: {
        open() { store.openDetail(this.item); },
        fav(event) {
            event.stopPropagation();
            store.toggleFavorite(this.item);
        },
    },
    template: `
        <div class="tv-card" @click="open">
            <div class="tv-card__head">
                <div class="tv-card__titles">
                    <p class="tv-card__place">{{ item.placeName }}</p>
                    <h3 class="tv-card__location">{{ item.locationName }}</h3>
                </div>
                <button type="button" class="tv-fav" :class="{ 'is-on': item.favorited }" aria-label="收藏" @click="fav">
                    <TvIcon :name="item.favorited ? 'heartFill' : 'heart'" :size="17" />
                </button>
            </div>
            <p class="tv-card__blurb">{{ item.blurb }}</p>
            <div class="tv-card__foot">
                <span v-if="item.kind" class="tv-tag">{{ item.kind }}</span>
                <span v-for="t in item.tags" :key="t" class="tv-tag">{{ t }}</span>
                <span v-if="item.existingPlaceId" class="tv-tag is-known">世界已有地点</span>
                <span v-if="visited" class="tv-tag is-visited">去过</span>
            </div>
        </div>
    `,
};

export const TvExplorePage = {
    name: 'TvExplorePage',
    components: { ...UI, TvCandidateCard },
    computed: {
        s() { return store.getState(); },
        seg() { return this.s.exploreSeg; },
        feed() { return this.s.feed; },
        saved() { return this.s.destinations.filter((d) => d.favorited); },
        loading() { return this.s.loading.feed; },
    },
    methods: {
        pick(seg) { store.setExploreSeg(seg); },
        refresh() { store.generateFeed(); },
        clearError() { store.clearError(); },
    },
    template: `
        <div class="tv-page">
            <div class="tv-seg">
                <button type="button" class="tv-seg__btn" :class="{ 'is-on': seg === 'feed' }" @click="pick('feed')">推荐</button>
                <button type="button" class="tv-seg__btn" :class="{ 'is-on': seg === 'saved' }" @click="pick('saved')">收藏 {{ saved.length || '' }}</button>
            </div>

            <template v-if="seg === 'feed'">
                <div class="tv-feedbar">
                    <p class="tv-feedbar__note">都不感兴趣就换一批。<b>没收藏的会被换掉</b>，收藏过的和去过的不受影响。</p>
                    <TvButton icon-name="refresh" size="sm" variant="soft" :loading="loading" @click="refresh">{{ feed.length ? '换一批' : '生成候选' }}</TvButton>
                </div>

                <div v-if="loading && !feed.length" class="tv-center-block"><TvLoading /></div>
                <TvEmpty v-else-if="!feed.length" icon-name="compass" title="还没有候选" desc="点上面的「生成候选」，按你的世界观找几个能去的地方。" />
                <div v-else class="tv-grid">
                    <TvCandidateCard v-for="c in feed" :key="c.id" :item="c" />
                </div>
            </template>

            <template v-else>
                <TvEmpty v-if="!saved.length" icon-name="heart" title="还没收藏过地方" desc="在推荐里点心形，喜欢的地方就会留在这里，刷新也不会丢。" />
                <div v-else class="tv-grid">
                    <TvCandidateCard v-for="c in saved" :key="c.id" :item="c" />
                </div>
            </template>

            <div v-if="s.error" class="tv-errorbar">
                <p>{{ s.error }}</p>
                <button type="button" @click="clearError">知道了</button>
            </div>
        </div>
    `,
};
