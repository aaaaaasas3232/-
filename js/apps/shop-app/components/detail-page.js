/**
 * 四叶草 · 详情页
 *
 * 商品和店铺共用一个壳，中间那段按 kind 分支。
 *
 * ── 详情是点进来才生成的 ──────────────────────────────────────────
 *
 * 列表只有名字、一句卖点和价格。规格、菜单、评价这些都等用户真的点进来
 * 才问 AI —— 一次列表 8 条的成本远低于 8 份详情，而用户真正会点开的
 * 通常只有一两件。这是这个 App 控 token 的主要手段。
 *
 * 生成期间铺满整块内容区的加载动画。**不做骨架屏**：
 * 骨架的前提是「结构已知、只差内容」，而这里连有几条规格都还不知道，
 * 画一堆假条目再整个换掉，跳变比等待更难受。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { SpLoadingScreen } from './loading.js';
import { FEED_KINDS } from '../constants.js';
import { icon } from '../icons.js';
import { asArray } from '../utils.js';

const Reviews = {
    name: 'SpReviews',
    props: { list: { type: Array, default: () => [] } },
    computed: {
        starSvg() { return icon('star', { size: 12 }); },
    },
    methods: {
        stars(n) { return Array.from({ length: Math.max(1, Math.min(5, n)) }); },
    },
    template: `
        <div class="sp-reviews">
            <article v-for="(r, i) in list" :key="i" class="sp-review">
                <header class="sp-review__head">
                    <span class="sp-review__user">{{ r.user }}</span>
                    <span class="sp-review__stars">
                        <i v-for="(x, k) in stars(r.rating)" :key="k" v-html="starSvg"></i>
                    </span>
                    <span v-if="r.when" class="sp-review__when">{{ r.when }}</span>
                </header>
                <p class="sp-review__text">{{ r.text }}</p>
            </article>
        </div>
    `,
};

export const SpDetailPage = {
    name: 'SpDetailPage',
    components: { ...UI, SpLoadingScreen, Reviews },
    computed: {
        s() { return store.getState(); },
        currency() { return this.s.identity.currency; },
        kind() { return this.s.detail?.kind || FEED_KINDS.product; },
        item() { return this.s.detail?.item || null; },
        isProduct() { return this.kind === FEED_KINDS.product; },
        detail() { return this.item?.detail || null; },
        loading() { return this.s.loading.detail; },
        paragraphs() {
            return String(this.detail?.desc || '').split(/\n+/).filter(Boolean);
        },
        menu() { return asArray(this.detail?.menu); },
        backSvg() { return icon('back', { size: 20 }); },
        canDineIn() { return asArray(this.item?.serve).includes('dinein'); },
        canDelivery() { return asArray(this.item?.serve).includes('delivery'); },
    },
    methods: {
        close() { store.closeDetail(); },
        fav() { store.toggleFavorite(this.item); },
        reroll() { store.rerollDetail(); },
        edit() { store.openModal('edit-item', { item: this.item, kind: this.kind }); },
        share() { store.openModal('share-item', { item: this.item }); },
        addCart(opts) { store.addToCart(this.item, opts || {}); },
        buyNow() {
            store.addToCart(this.item);
            store.setTab('cart');
        },
        addMenuItem(m) {
            store.addToCart(this.item, {
                label: `${this.item.name} · ${m.name}`,
                price: m.price,
                serve: this.s.serveMode,
            });
        },
        /** 探店：不买东西也能生成一场戏 */
        visit(mode) {
            store.openModal('theater-setup', {
                occasion: mode === 'delivery' ? 'delivery' : 'dinein',
                subject: {
                    name: this.item.name,
                    price: this.item.priceLevel,
                    blurb: this.item.blurb,
                },
            });
        },
    },
    template: `
        <div class="sp-detail">
            <header class="sp-detail__bar">
                <button class="sp-iconbtn" @click="close" v-html="backSvg"></button>
                <span class="sp-detail__bar-title">{{ item ? item.name : '' }}</span>
                <div class="sp-detail__bar-right">
                    <sp-btn size="sm" variant="ghost" icon="heart" @click="fav">
                        {{ item && item.favorited ? '已收藏' : '收藏' }}
                    </sp-btn>
                </div>
            </header>

            <sp-loading-screen v-if="loading" kind="detail" />

            <div v-else-if="!item" class="sp-detail__body">
                <sp-empty title="这件东西已经不在了" desc="列表刷新过，回去看看新的一批" />
            </div>

            <div v-else class="sp-detail__body">
                <section class="sp-detail__hero">
                    <h1 class="sp-detail__name">{{ item.name }}</h1>
                    <p class="sp-detail__sub">
                        <template v-if="isProduct">{{ item.brand }}<span v-if="item.brand && item.category"> · </span>{{ item.category }}</template>
                        <template v-else>{{ item.area }}<span v-if="item.area && item.category"> · </span>{{ item.category }}</template>
                    </p>
                    <p v-if="item.blurb" class="sp-detail__blurb">{{ item.blurb }}</p>
                    <div class="sp-detail__price">
                        <sp-price
                            v-if="isProduct"
                            :value="item.price" :original="item.originalPrice"
                            :currency="currency" size="lg"
                        />
                        <sp-price v-else :value="item.priceLevel" :currency="currency" size="lg" prefix="人均" />
                    </div>
                    <div v-if="item.tags && item.tags.length" class="sp-card__tags">
                        <span v-for="t in item.tags" :key="t" class="sp-tag">{{ t }}</span>
                    </div>
                </section>

                <div v-if="!detail" class="sp-detail__pending">
                    <p>这一份还没展开。</p>
                    <sp-btn variant="soft" icon="sparkle" @click="reroll">现在生成</sp-btn>
                </div>

                <template v-else>
                    <sp-section :title="isProduct ? '关于这件东西' : '关于这家店'">
                        <p v-for="(p, i) in paragraphs" :key="i" class="sp-detail__para">{{ p }}</p>
                    </sp-section>

                    <!-- 商品：规格 / 参数 / 配送 -->
                    <template v-if="isProduct">
                        <sp-section v-if="detail.specs && detail.specs.length" title="规格">
                            <sp-kv v-for="(k, i) in detail.specs" :key="i" :label="k.label" :value="k.value" />
                        </sp-section>
                        <sp-section v-if="detail.params && detail.params.length" title="参数">
                            <sp-kv v-for="(k, i) in detail.params" :key="i" :label="k.label" :value="k.value" />
                        </sp-section>
                        <sp-section v-if="detail.shipping" title="配送">
                            <p class="sp-detail__para">{{ detail.shipping }}</p>
                        </sp-section>
                        <sp-section v-if="detail.related && detail.related.length" title="搭配着看">
                            <div class="sp-card__tags">
                                <span v-for="r in detail.related" :key="r" class="sp-tag">{{ r }}</span>
                            </div>
                        </sp-section>
                    </template>

                    <!-- 店铺：营业信息 / 菜单 -->
                    <template v-else>
                        <sp-section title="到店信息">
                            <sp-kv v-if="detail.hours" label="营业" :value="detail.hours" />
                            <sp-kv v-if="detail.address" label="地址" :value="detail.address" />
                            <sp-kv v-if="detail.phone" label="联络" :value="detail.phone" />
                        </sp-section>

                        <sp-section v-if="menu.length" title="菜单" :sub="s.serveMode === 'delivery' ? '外送' : '到店'">
                            <div class="sp-menu">
                                <div v-for="m in menu" :key="m.id" class="sp-menu__row">
                                    <div class="sp-menu__main">
                                        <span class="sp-menu__name">
                                            {{ m.name }}
                                            <b v-if="m.signature" class="sp-menu__sign">招牌</b>
                                        </span>
                                        <span v-if="m.desc" class="sp-menu__desc">{{ m.desc }}</span>
                                    </div>
                                    <div class="sp-menu__right">
                                        <sp-price :value="m.price" :currency="currency" size="sm" />
                                        <sp-btn size="sm" variant="soft" @click="addMenuItem(m)">加</sp-btn>
                                    </div>
                                </div>
                            </div>
                        </sp-section>
                    </template>

                    <sp-section v-if="detail.reviews && detail.reviews.length" title="别人说">
                        <reviews :list="detail.reviews" />
                    </sp-section>

                    <div class="sp-detail__tools">
                        <sp-btn size="sm" variant="ghost" icon="dice" @click="reroll">重新生成</sp-btn>
                        <sp-btn size="sm" variant="ghost" icon="edit" @click="edit">改一改</sp-btn>
                        <sp-btn size="sm" variant="ghost" icon="share" @click="share">分享</sp-btn>
                    </div>
                </template>
            </div>

            <footer v-if="item && !loading" class="sp-detail__foot">
                <template v-if="isProduct">
                    <sp-btn variant="line" icon="cart" @click="addCart()">加购物车</sp-btn>
                    <sp-btn variant="primary" block @click="buyNow">去结账</sp-btn>
                </template>
                <template v-else>
                    <sp-btn v-if="canDineIn" variant="line" icon="pin" @click="visit('dinein')">到店</sp-btn>
                    <sp-btn v-if="canDelivery" variant="line" icon="truck" @click="visit('delivery')">外送</sp-btn>
                    <sp-btn variant="primary" block @click="buyNow">去结账</sp-btn>
                </template>
            </footer>
        </div>
    `,
};
