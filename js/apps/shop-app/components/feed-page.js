/**
 * 四叶草 · 商品页 / 探店页
 *
 * 两个 tab 共用一个组件，只有 `kind` 不同。
 *
 * ── 「换一批」是有代价的操作，所以要说清楚 ────────────────────────
 *
 * 每按一次就是一次 AI 调用，而且**没收藏的那批会消失**。
 * 所以按钮旁边一直挂着一行小字说明，而不是等用户按完发现东西没了才解释。
 *
 * ── 收藏区在最上面 ────────────────────────────────────────────────
 *
 * 收藏的东西不受刷新影响，是这个页面里唯一稳定的部分。
 * 放最上面是因为：用户回到这一页多半是来找他收过的那件，
 * 而不是来看 AI 这次又编了什么。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { SpProductCard, SpStoreCard } from './item-card.js';
import { FEED_KINDS, PRODUCT_CATEGORIES, STORE_CATEGORIES, SERVE_MODES } from '../constants.js';

const FeedInner = {
    name: 'SpFeedInner',
    components: { ...UI, SpProductCard, SpStoreCard },
    props: {
        kind: { type: String, required: true },
    },
    computed: {
        s() { return store.getState(); },
        currency() { return this.s.identity.currency; },
        isProduct() { return this.kind === FEED_KINDS.product; },
        loading() { return this.s.loading[this.kind]; },
        categories() { return this.isProduct ? PRODUCT_CATEGORIES : STORE_CATEGORIES; },
        activeCategory() { return this.s.feedCategory[this.kind]; },
        serveModes() { return SERVE_MODES; },

        favorites() {
            const cat = this.activeCategory;
            return this.s.favorites
                .filter((f) => f.kind === this.kind)
                .filter((f) => cat === '全部' || f.category === cat)
                .filter((f) => this.matchServe(f));
        },
        /** 列表里去掉已经在收藏区露过面的，免得同一件出现两次 */
        feed() {
            const favIds = new Set(this.favorites.map((f) => String(f.id)));
            const cat = this.activeCategory;
            return this.s.feeds[this.kind]
                .filter((x) => !favIds.has(String(x.id)))
                .filter((x) => cat === '全部' || x.category === cat)
                .filter((x) => this.matchServe(x));
        },
        empty() { return !this.loading && !this.feed.length && !this.favorites.length; },
    },
    methods: {
        matchServe(item) {
            if (this.isProduct) return true;
            const serve = item.serve || [];
            return serve.includes(this.s.serveMode);
        },
        pickCategory(c) { store.setFeedCategory(this.kind, c); },
        pickServe(m) { store.setServeMode(m); },
        refresh() { store.generateFeed(this.kind); },
        open(item) { store.openDetail(this.kind, item); },
        fav(item) { store.toggleFavorite(item); },
        cart(item) { store.addToCart(item); },
        addManual() { store.openModal('add-item', { kind: this.kind }); },
    },
    template: `
        <div class="sp-feed">
            <div class="sp-feed__filters">
                <div v-if="!isProduct" class="sp-serve">
                    <button
                        v-for="m in serveModes" :key="m.id"
                        class="sp-serve__btn" :class="{ 'is-on': s.serveMode === m.id }"
                        @click="pickServe(m.id)"
                    >{{ m.label }}</button>
                </div>
                <div class="sp-chips">
                    <sp-chip
                        v-for="c in categories" :key="c"
                        :active="c === activeCategory"
                        @click="pickCategory(c)"
                    >{{ c }}</sp-chip>
                </div>
            </div>

            <div class="sp-feed__bar">
                <div class="sp-feed__bar-actions">
                    <sp-btn size="sm" variant="line" icon="plus" @click="addManual">自己加</sp-btn>
                    <sp-btn size="sm" variant="soft" icon="refresh" :loading="loading" @click="refresh">换一批</sp-btn>
                </div>
                <p class="sp-feed__note">
                    换一批 = 重新问一次 AI，<b>没收藏的会消失</b>
                </p>
            </div>

            <p v-if="s.error" class="sp-feed__error">
                {{ s.error }}
                <button class="sp-linkbtn" @click="refresh">重试</button>
            </p>

            <section v-if="favorites.length" class="sp-feed__group">
                <h2 class="sp-feed__group-title">收藏的{{ isProduct ? '商品' : '店' }} · {{ favorites.length }}</h2>
                <div class="sp-grid">
                    <component
                        :is="isProduct ? 'sp-product-card' : 'sp-store-card'"
                        v-for="item in favorites" :key="item.id"
                        :item="item" :currency="currency"
                        @open="open" @fav="fav" @cart="cart"
                    />
                </div>
            </section>

            <sp-skeleton v-if="loading" :rows="4" />

            <section v-else-if="feed.length" class="sp-feed__group">
                <h2 v-if="favorites.length" class="sp-feed__group-title">这一批</h2>
                <div class="sp-grid">
                    <component
                        :is="isProduct ? 'sp-product-card' : 'sp-store-card'"
                        v-for="item in feed" :key="item.id"
                        :item="item" :currency="currency"
                        @open="open" @fav="fav" @cart="cart"
                    />
                </div>
            </section>

            <sp-empty
                v-else-if="empty"
                :icon="isProduct ? 'bag' : 'store'"
                :title="isProduct ? '货架还是空的' : '还没打听到哪家店'"
                desc="按下面这个键，让它按你的世界观生成一批"
            >
                <sp-btn variant="primary" icon="sparkle" @click="refresh">生成一批</sp-btn>
            </sp-empty>
        </div>
    `,
};

export const SpMarketPage = {
    name: 'SpMarketPage',
    components: { FeedInner },
    template: `<feed-inner kind="product" />`,
};

export const SpDinePage = {
    name: 'SpDinePage',
    components: { FeedInner },
    template: `<feed-inner kind="store" />`,
};
