/**
 * 四叶草 · 购物车 / 结账
 *
 * ── 钱要看得见 ────────────────────────────────────────────────────
 *
 * 用户明确要求「整个资产货币链的流动要清晰透明」。所以结账区永远同时显示三个数：
 *
 *     现在有多少   —   这单花多少   =   付完剩多少
 *
 * 而且「付完剩多少」在不够时会变成负数并标红，**在点结账之前**就告诉他不够。
 * 常见的做法是点了才弹「余额不足」，那时候用户已经期待成功了。
 *
 * 这笔钱是真的：走 `sdk.assetFlow`，和红包、转账、定时收入同一本账。
 * 在这里花掉的，去 nook 的钱包页看得到。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { icon } from '../icons.js';
import { fmtMoney, money } from '../utils.js';

export const SpCartPage = {
    name: 'SpCartPage',
    components: { ...UI },
    data() {
        return { note: '' };
    },
    computed: {
        s() { return store.getState(); },
        currency() { return this.s.identity.currency; },
        rows() { return store.cartItems(); },
        total() { return store.cartTotal(); },
        balance() { return this.s.balance; },
        after() { return money(this.balance) - money(this.total); },
        enough() { return this.after >= 0; },
        busy() { return this.s.loading.checkout; },
        minusSvg() { return icon('minus', { size: 14 }); },
        plusSvg() { return icon('plus', { size: 14 }); },
    },
    methods: {
        fmt(n) { return fmtMoney(n); },
        dec(row) { store.setCartQty(row.id, (row.qty || 1) - 1); },
        inc(row) { store.setCartQty(row.id, (row.qty || 1) + 1); },
        drop(row) { store.setCartQty(row.id, 0); },
        clear() { store.clearCart(); },
        goShop() { store.setTab('market'); },

        async pay() {
            const res = await store.checkout({ note: this.note });
            if (!res.ok) return;
            this.note = '';
            // 结完账立刻问「要不要生成一段小剧场」——
            // 这是这个 App 最有意思的一步，藏在别处用户根本不会去点
            store.openModal('theater-setup', {
                occasion: 'purchase',
                orderId: res.order.id,
                subject: {
                    name: res.order.items.map((i) => i.label).join('、'),
                    price: res.order.total,
                    blurb: '',
                },
            });
        },
    },
    template: `
        <div class="sp-cart">
            <sp-empty
                v-if="!rows.length"
                icon="cart"
                title="购物车是空的"
                desc="去商品页或者探店页逛逛"
            >
                <sp-btn variant="soft" @click="goShop">去逛逛</sp-btn>
            </sp-empty>

            <template v-else>
                <section class="sp-cart__list">
                    <div v-for="row in rows" :key="row.id" class="sp-cart__row">
                        <div class="sp-cart__main">
                            <span class="sp-cart__name">{{ row.label }}</span>
                            <span class="sp-cart__sub">
                                <template v-if="row.snapshot && row.snapshot.brand">{{ row.snapshot.brand }}</template>
                                <template v-else-if="row.snapshot && row.snapshot.area">{{ row.snapshot.area }}</template>
                                <template v-if="row.serve"> · {{ row.serve === 'delivery' ? '外送' : '到店' }}</template>
                            </span>
                        </div>
                        <div class="sp-cart__right">
                            <sp-price :value="row.price * row.qty" :currency="currency" size="sm" />
                            <div class="sp-stepper">
                                <button @click="dec(row)" v-html="minusSvg"></button>
                                <span>{{ row.qty }}</span>
                                <button @click="inc(row)" v-html="plusSvg"></button>
                            </div>
                        </div>
                    </div>
                </section>

                <sp-section title="备注">
                    <sp-input v-model="note" placeholder="想跟店家说点什么（可以不写）" :maxlength="40" />
                </sp-section>

                <!-- 资金链路：三个数摆在一起，付之前就知道结果 -->
                <section class="sp-settle">
                    <h2 class="sp-settle__title">这一单</h2>
                    <div class="sp-settle__grid">
                        <div class="sp-settle__cell">
                            <span class="sp-settle__k">现在有</span>
                            <span class="sp-settle__v">{{ fmt(balance) }}</span>
                        </div>
                        <span class="sp-settle__op">−</span>
                        <div class="sp-settle__cell">
                            <span class="sp-settle__k">这单花</span>
                            <span class="sp-settle__v sp-settle__v--out">{{ fmt(total) }}</span>
                        </div>
                        <span class="sp-settle__op">=</span>
                        <div class="sp-settle__cell">
                            <span class="sp-settle__k">付完剩</span>
                            <span class="sp-settle__v" :class="{ 'sp-settle__v--bad': !enough }">
                                {{ enough ? fmt(after) : '-' + fmt(-after) }}
                            </span>
                        </div>
                    </div>
                    <p class="sp-settle__unit">单位：{{ currency }}</p>
                    <p v-if="!enough" class="sp-settle__warn">
                        还差 {{ fmt(-after) }} {{ currency }}。可以先删几件，或者去聊天里等谁送你。
                    </p>
                    <p v-else class="sp-settle__note">
                        付款会真的从你的钱包扣，和红包转账是同一本账。
                    </p>
                </section>

                <div class="sp-cart__actions">
                    <sp-btn variant="ghost" @click="clear">清空</sp-btn>
                    <sp-btn variant="primary" block :disabled="!enough" :loading="busy" @click="pay">
                        付 {{ fmt(total) }} {{ currency }}
                    </sp-btn>
                </div>

                <p v-if="s.error" class="sp-feed__error">{{ s.error }}</p>
            </template>
        </div>
    `,
};
