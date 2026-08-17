/**
 * 四叶草 · 商品卡 / 店铺卡
 *
 * ── 没有图 ────────────────────────────────────────────────────────
 *
 * 商品图是 AI 生成不出来的东西。放一张灰色占位符会让整个列表看着像坏了；
 * 硬塞随机图片又会和世界观对不上（赛博世界里冒出一张实拍的木碗）。
 *
 * 所以这里根本不留图位，改成**用排版承担识别度**：
 * 名字大、卖点一行、标签小字、价格右下。信息密度反而比带图的列表高，
 * 而且滚起来更快 —— 一屏能看到五六件，带图只能看两件。
 *
 * 卡片本体点击 = 进详情（会触发一次 AI 生成）；
 * 收藏按钮**必须 `.stop`**，否则点收藏会顺带进详情、白烧一次 token。
 */

import { UI } from './ui.js';
import { icon } from '../icons.js';

const FavButton = {
    name: 'SpFav',
    props: { on: Boolean },
    emits: ['toggle'],
    computed: {
        svg() { return icon('heart', { size: 16 }); },
    },
    template: `
        <button class="sp-fav" :class="{ 'is-on': on }" @click.stop="$emit('toggle')" :title="on ? '取消收藏' : '收藏'">
            <span v-html="svg"></span>
        </button>
    `,
};

export const SpProductCard = {
    name: 'SpProductCard',
    components: { ...UI, FavButton },
    props: {
        item: { type: Object, required: true },
        currency: { type: String, default: '金币' },
    },
    emits: ['open', 'fav', 'cart'],
    computed: {
        cartSvg() { return icon('plus', { size: 15 }); },
    },
    template: `
        <article class="sp-card sp-card--product" @click="$emit('open', item)">
            <header class="sp-card__head">
                <div class="sp-card__title-wrap">
                    <h3 class="sp-card__title">{{ item.name }}</h3>
                    <p v-if="item.brand" class="sp-card__brand">{{ item.brand }}</p>
                </div>
                <fav-button :on="!!item.favorited" @toggle="$emit('fav', item)" />
            </header>

            <p v-if="item.blurb" class="sp-card__blurb">{{ item.blurb }}</p>

            <div v-if="item.tags && item.tags.length" class="sp-card__tags">
                <span v-for="t in item.tags" :key="t" class="sp-tag">{{ t }}</span>
            </div>

            <footer class="sp-card__foot">
                <sp-price :value="item.price" :original="item.originalPrice" :currency="currency" />
                <button class="sp-card__cart" @click.stop="$emit('cart', item)" title="加入购物车">
                    <span v-html="cartSvg"></span>
                </button>
            </footer>

            <span v-if="item.source === 'user'" class="sp-card__mine">自己加的</span>
        </article>
    `,
};

export const SpStoreCard = {
    name: 'SpStoreCard',
    components: { ...UI, FavButton },
    props: {
        item: { type: Object, required: true },
        currency: { type: String, default: '金币' },
    },
    emits: ['open', 'fav'],
    computed: {
        starSvg() { return icon('star', { size: 13 }); },
        serveText() {
            const s = this.item.serve || [];
            const bits = [];
            if (s.includes('dinein')) bits.push('到店');
            if (s.includes('delivery')) bits.push('外送');
            return bits.join(' · ');
        },
    },
    template: `
        <article class="sp-card sp-card--store" @click="$emit('open', item)">
            <header class="sp-card__head">
                <div class="sp-card__title-wrap">
                    <h3 class="sp-card__title">{{ item.name }}</h3>
                    <p class="sp-card__brand">
                        <span v-if="item.area">{{ item.area }}</span>
                        <span v-if="item.area && item.category"> · </span>
                        <span v-if="item.category">{{ item.category }}</span>
                    </p>
                </div>
                <fav-button :on="!!item.favorited" @toggle="$emit('fav', item)" />
            </header>

            <p v-if="item.blurb" class="sp-card__blurb">{{ item.blurb }}</p>

            <div class="sp-card__meta">
                <span class="sp-rate"><i v-html="starSvg"></i>{{ Number(item.rating).toFixed(1) }}</span>
                <span v-if="item.signature" class="sp-card__sign">招牌 · {{ item.signature }}</span>
            </div>

            <footer class="sp-card__foot">
                <sp-price :value="item.priceLevel" :currency="currency" prefix="人均" />
                <span v-if="serveText" class="sp-card__serve">{{ serveText }}</span>
            </footer>

            <span v-if="item.source === 'user'" class="sp-card__mine">自己加的</span>
        </article>
    `,
};
