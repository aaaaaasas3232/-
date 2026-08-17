/**
 * 四叶草 · 我的
 *
 * 这一页是个中枢：上面是钱包，下面是几个入口。
 *
 * ── 为什么钱包摆在最上面而且这么大 ────────────────────────────────
 *
 * 这个 App 里所有事都要花钱，而钱是**跨 App 共享**的（聊天里收的红包
 * 在这里能花，这里花掉的在 nook 钱包页看得到）。用户需要一眼看到
 * 「我现在有多少」，否则他会在结账那一刻才发现不够，而那时候
 * 购物车已经挑了十分钟。
 *
 * 收到的礼物有未读时，「收到的」那一项右边有个点 —— 心愿单被实现
 * **不会**推灵动岛通知，这是用户明确要的：那应该是个惊喜，
 * 得他自己进来发现。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { icon } from '../icons.js';
import { fmtMoney } from '../utils.js';
import { listAllFlow } from '../services/wallet-service.js';

export const SpMePage = {
    name: 'SpMePage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        currency() { return this.s.identity.currency; },
        userName() { return this.s.identity.userName; },
        worldName() { return this.s.identity.worldName; },
        balance() { return this.s.balance; },
        cloverMark() { return icon('clover', { size: 22 }); },

        wishPending() { return store.wishlist().filter((w) => !w.fulfilled).length; },
        wishDone() { return store.wishlist().filter((w) => w.fulfilled).length; },
        favCount() { return this.s.favorites.length; },
        theaterCount() { return this.s.theaters.length; },
        giftsIn() { return this.s.orders.filter((o) => o.type === 'gift-in'); },
        unseenGifts() { return this.giftsIn.filter((o) => o.seen === false).length; },
        purchaseCount() { return this.s.orders.filter((o) => o.type === 'purchase').length; },

        /** 本档在四叶草里的总支出，让「钱去哪了」有个答案 */
        spent() {
            const flows = listAllFlow('user', this.s.identity.user?.id, 200);
            return flows
                .filter((f) => String(f.sourceType || '').startsWith('shop-') && f.direction === 'out')
                .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
        },

        entries() {
            return [
                { view: 'wishlist', icon: 'star', label: '心愿单', hint: this.wishPending ? `还差 ${this.wishPending} 件` : '都实现了', dot: false },
                { view: 'gifts', icon: 'gift', label: '收到的', hint: `${this.giftsIn.length} 份`, dot: this.unseenGifts > 0 },
                { view: 'orders', icon: 'inbox', label: '订单', hint: `${this.purchaseCount} 单`, dot: false },
                { view: 'flow', icon: 'wallet', label: '资金流水', hint: '每一笔都在这儿', dot: false },
                { view: 'theaters', icon: 'theater', label: '小剧场', hint: `${this.theaterCount} 场`, dot: false },
                { view: 'theme', icon: 'palette', label: '配色', hint: '整套换或单个改', dot: false },
                { view: 'settings', icon: 'settings', label: '生成设置', hint: '世界观材料与 API', dot: false },
            ];
        },
    },
    methods: {
        fmt(n) { return fmtMoney(n); },
        go(view) {
            if (view === 'gifts') store.setView('gifts');
            else store.setView(view);
        },
        iconOf(name) { return icon(name, { size: 18 }); },
    },
    template: `
        <div class="sp-me">
            <section class="sp-wallet">
                <header class="sp-wallet__head">
                    <div>
                        <p class="sp-wallet__who">{{ userName }}</p>
                        <p class="sp-wallet__world">
                            <span class="sp-wallet__clover" v-html="cloverMark"></span>
                            {{ worldName }}
                        </p>
                    </div>
                </header>
                <div class="sp-wallet__amount">
                    <span class="sp-wallet__num">{{ fmt(balance) }}</span>
                    <span class="sp-wallet__unit">{{ currency }}</span>
                </div>
                <p class="sp-wallet__note">
                    和聊天里的红包、转账是同一个钱包。这里花掉的，那边也看得到。
                </p>
                <div class="sp-wallet__stats">
                    <div class="sp-wallet__stat">
                        <span class="sp-wallet__stat-v">{{ fmt(spent) }}</span>
                        <span class="sp-wallet__stat-k">在这儿花掉的</span>
                    </div>
                    <div class="sp-wallet__stat">
                        <span class="sp-wallet__stat-v">{{ favCount }}</span>
                        <span class="sp-wallet__stat-k">收藏</span>
                    </div>
                    <div class="sp-wallet__stat">
                        <span class="sp-wallet__stat-v">{{ wishDone }}/{{ wishDone + wishPending }}</span>
                        <span class="sp-wallet__stat-k">心愿实现</span>
                    </div>
                </div>
            </section>

            <section class="sp-entries">
                <button v-for="e in entries" :key="e.view" class="sp-entry" @click="go(e.view)">
                    <span class="sp-entry__icon" v-html="iconOf(e.icon)"></span>
                    <span class="sp-entry__main">
                        <span class="sp-entry__label">
                            {{ e.label }}
                            <i v-if="e.dot" class="sp-entry__dot"></i>
                        </span>
                        <span class="sp-entry__hint">{{ e.hint }}</span>
                    </span>
                    <span class="sp-entry__go" v-html="iconOf('chevron')"></span>
                </button>
            </section>
        </div>
    `,
};
