/**
 * 四叶草 · 「我的」下面那几个子页
 *
 * 全部套同一个壳（返回栏 + 内容区），所以它们在一个文件里 ——
 * 分成六个文件的话，改一次壳要改六处。
 *
 * ── 心愿单是这一组里最要紧的 ──────────────────────────────────────
 *
 * 它不只是个清单，它是**一段实时提示词**：写进去的东西会立刻出现在
 * 每个 AI 的上下文里，AI 可以自己决定买不买。
 * 所以这一页要说清楚这件事，否则用户会以为它只是备忘录。
 *
 * 匿名送的礼物在这里显示成「有人」，但**不是真匿名** ——
 * 送的那个 AI 自己记得（见 `shop-context.js`）。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { icon } from '../icons.js';
import { fmtMoney, fmtTime, truncate } from '../utils.js';
import { listAllFlow } from '../services/wallet-service.js';
import { listApiRefs, resolveApiRef } from '../services/ai-service.js';
import { listClips } from '../services/world-context.js';

const Shell = {
    name: 'SpPanelShell',
    props: {
        title: { type: String, default: '' },
        desc: { type: String, default: '' },
    },
    emits: ['close'],
    computed: {
        backSvg() { return icon('back', { size: 20 }); },
    },
    template: `
        <div class="sp-panel">
            <header class="sp-panel__bar">
                <button class="sp-iconbtn" @click="$emit('close')" v-html="backSvg"></button>
                <span class="sp-panel__title">{{ title }}</span>
                <div class="sp-panel__bar-right"><slot name="action" /></div>
            </header>
            <div class="sp-panel__body">
                <p v-if="desc" class="sp-panel__desc">{{ desc }}</p>
                <slot />
            </div>
        </div>
    `,
};

// ---------------------------------------------------------------------------

const WishlistPanel = {
    name: 'SpWishlistPanel',
    components: { ...UI, Shell },
    data() {
        return { title: '', note: '', price: '' };
    },
    computed: {
        s() { return store.getState(); },
        currency() { return this.s.identity.currency; },
        pending() { return store.wishlist().filter((w) => !w.fulfilled); },
        done() { return store.wishlist().filter((w) => w.fulfilled); },
    },
    methods: {
        fmt(n) { return fmtMoney(n); },
        when(t) { return fmtTime(t); },
        add() {
            if (!this.title.trim()) return;
            store.addWish({ title: this.title, note: this.note, price: Number(this.price) || 0 });
            this.title = ''; this.note = ''; this.price = '';
        },
        drop(id) { store.removeWish(id); },
        who(w) {
            if (w.fulfilledBy === 'self') return '自己买的';
            if (w.anonymous) return '有人送的';
            return `${w.fulfilledByName || 'TA'} 送的`;
        },
    },
    template: `
        <shell title="心愿单" @close="$emit('close')">
            <p class="sp-panel__desc">
                写在这里的东西会实时出现在每个 AI 的提示词里，他们可以自己决定买不买。
                实现了不会弹通知 —— 那应该是个惊喜，你自己回来看到才有意思。
            </p>

            <section class="sp-wish-add">
                <sp-input v-model="title" placeholder="想要什么" :maxlength="24" @enter="add" />
                <div class="sp-wish-add__row">
                    <sp-input v-model="price" type="number" :placeholder="'大概多少 ' + currency" />
                    <sp-btn variant="primary" icon="plus" @click="add">加进去</sp-btn>
                </div>
                <sp-input v-model="note" placeholder="补一句（颜色、尺码、为什么想要）" :maxlength="40" />
            </section>

            <sp-section v-if="pending.length" title="还没实现" :sub="pending.length + ' 件'">
                <div v-for="w in pending" :key="w.id" class="sp-wish">
                    <div class="sp-wish__main">
                        <span class="sp-wish__title">{{ w.title }}</span>
                        <span v-if="w.note" class="sp-wish__note">{{ w.note }}</span>
                    </div>
                    <sp-price v-if="w.price" :value="w.price" :currency="currency" size="sm" />
                    <button class="sp-wish__x" @click="drop(w.id)">删</button>
                </div>
            </sp-section>

            <sp-section v-if="done.length" title="已经实现" :sub="done.length + ' 件'">
                <div v-for="w in done" :key="w.id" class="sp-wish is-done">
                    <div class="sp-wish__main">
                        <span class="sp-wish__title">{{ w.title }}</span>
                        <span class="sp-wish__note">{{ who(w) }} · {{ when(w.fulfilledAt) }}</span>
                    </div>
                    <button class="sp-wish__x" @click="drop(w.id)">删</button>
                </div>
            </sp-section>

            <sp-empty v-if="!pending.length && !done.length" icon="star" title="还没写过心愿" desc="写一条试试，说不定明天就有人送来" />
        </shell>
    `,
    emits: ['close'],
};

// ---------------------------------------------------------------------------

const GiftsPanel = {
    name: 'SpGiftsPanel',
    components: { ...UI, Shell },
    computed: {
        s() { return store.getState(); },
        currency() { return this.s.identity.currency; },
        list() { return this.s.orders.filter((o) => o.type === 'gift-in' || o.type === 'gift-out'); },
    },
    methods: {
        fmt(n) { return fmtMoney(n); },
        when(t) { return fmtTime(t); },
        from(o) {
            if (o.type === 'gift-out') return `送给 ${o.to?.name || 'TA'}`;
            if (o.anonymous) return '有人送的';
            return `${o.from?.name || 'TA'} 送的`;
        },
        makeTheater(o) {
            store.openModal('theater-setup', {
                occasion: o.type === 'gift-out' ? 'gift-out' : 'gift-in',
                orderId: o.id,
                aiIds: [o.from?.id || o.to?.id].filter(Boolean),
                subject: { name: o.items?.[0]?.label || '', price: o.total, blurb: o.note || '' },
            });
        },
    },
    template: `
        <shell title="收到的" @close="$emit('close')">
            <p class="sp-panel__desc">
                AI 在聊天里给你买的东西会到这里。匿名的只显示「有人」——
                但送的那位自己记得，你去问他也许会承认。
            </p>
            <sp-empty v-if="!list.length" icon="gift" title="还没有礼物" desc="把想要的写进心愿单，AI 看得到" />
            <div v-for="o in list" :key="o.id" class="sp-gift" :class="{ 'is-new': o.seen === false }">
                <div class="sp-gift__head">
                    <span class="sp-gift__name">{{ o.items && o.items[0] ? o.items[0].label : '一份礼物' }}</span>
                    <sp-price :value="o.total" :currency="currency" size="sm" />
                </div>
                <p class="sp-gift__from">{{ from(o) }} · {{ when(o.createdAt) }}</p>
                <p v-if="o.note" class="sp-gift__msg">「{{ o.note }}」</p>
                <div class="sp-gift__actions">
                    <sp-btn size="sm" variant="soft" icon="theater" @click="makeTheater(o)">生成小剧场</sp-btn>
                </div>
            </div>
        </shell>
    `,
    emits: ['close'],
};

// ---------------------------------------------------------------------------

const OrdersPanel = {
    name: 'SpOrdersPanel',
    components: { ...UI, Shell },
    computed: {
        s() { return store.getState(); },
        currency() { return this.s.identity.currency; },
        list() { return this.s.orders.filter((o) => o.type === 'purchase'); },
    },
    methods: {
        fmt(n) { return fmtMoney(n); },
        when(t) { return fmtTime(t); },
        names(o) { return (o.items || []).map((i) => `${i.label}${i.qty > 1 ? `×${i.qty}` : ''}`).join('、'); },
        makeTheater(o) {
            store.openModal('theater-setup', {
                occasion: 'purchase',
                orderId: o.id,
                subject: { name: this.names(o), price: o.total, blurb: o.note || '' },
            });
        },
    },
    template: `
        <shell title="订单" @close="$emit('close')">
            <sp-empty v-if="!list.length" icon="inbox" title="还没买过东西" />
            <div v-for="o in list" :key="o.id" class="sp-order">
                <div class="sp-order__head">
                    <span class="sp-order__names">{{ names(o) }}</span>
                    <sp-price :value="o.total" :currency="currency" size="sm" />
                </div>
                <p class="sp-order__meta">{{ when(o.createdAt) }}<span v-if="o.note"> · {{ o.note }}</span></p>
                <div class="sp-order__actions">
                    <sp-btn size="sm" variant="soft" icon="theater" @click="makeTheater(o)">生成小剧场</sp-btn>
                </div>
            </div>
        </shell>
    `,
    emits: ['close'],
};

// ---------------------------------------------------------------------------

const FlowPanel = {
    name: 'SpFlowPanel',
    components: { ...UI, Shell },
    computed: {
        s() { return store.getState(); },
        currency() { return this.s.identity.currency; },
        rows() { return listAllFlow('user', this.s.identity.user?.id, 80); },
        income() { return this.rows.filter((r) => r.direction === 'in').reduce((a, b) => a + (b.amount || 0), 0); },
        expense() { return this.rows.filter((r) => r.direction === 'out').reduce((a, b) => a + (b.amount || 0), 0); },
    },
    methods: {
        fmt(n) { return fmtMoney(n); },
        when(t) { return fmtTime(t); },
        isShop(r) { return String(r.sourceType || '').startsWith('shop-'); },
    },
    template: `
        <shell title="资金流水" @close="$emit('close')">
            <p class="sp-panel__desc">
                这是你完整的一本账，不只是购物。红包、转账、定时收入都在里面，
                带四叶草标记的是在这个 App 里发生的。
            </p>
            <div class="sp-flow__sum">
                <div class="sp-flow__sum-cell">
                    <span class="sp-flow__sum-v sp-flow__sum-v--in">+{{ fmt(income) }}</span>
                    <span class="sp-flow__sum-k">进账</span>
                </div>
                <div class="sp-flow__sum-cell">
                    <span class="sp-flow__sum-v sp-flow__sum-v--out">−{{ fmt(expense) }}</span>
                    <span class="sp-flow__sum-k">出账</span>
                </div>
                <div class="sp-flow__sum-cell">
                    <span class="sp-flow__sum-v">{{ fmt(s.balance) }}</span>
                    <span class="sp-flow__sum-k">现在有</span>
                </div>
            </div>
            <sp-empty v-if="!rows.length" icon="wallet" title="还没有任何流水" />
            <div v-for="r in rows" :key="r.id" class="sp-flowrow">
                <div class="sp-flowrow__main">
                    <span class="sp-flowrow__note">
                        <i v-if="isShop(r)" class="sp-flowrow__badge">四叶草</i>
                        {{ r.note || r.counterpartyName || '—' }}
                    </span>
                    <span class="sp-flowrow__when">{{ when(r.timestamp) }}</span>
                </div>
                <span class="sp-flowrow__amt" :class="r.direction === 'in' ? 'is-in' : 'is-out'">
                    {{ r.direction === 'in' ? '+' : '−' }}{{ fmt(r.amount) }}
                </span>
            </div>
        </shell>
    `,
    emits: ['close'],
};

// ---------------------------------------------------------------------------

const TheatersPanel = {
    name: 'SpTheatersPanel',
    components: { ...UI, Shell },
    computed: {
        s() { return store.getState(); },
        list() { return this.s.theaters; },
    },
    methods: {
        when(t) { return fmtTime(t); },
        brief(t) { return t.summary ? truncate(t.summary, 60) : '概要还没生成'; },
        cast(t) { return (t.participants || []).map((p) => p.name).join('、') || '只有你'; },
        open(t) { store.openTheater(t); },
        drop(t) { store.deleteTheater(t.id); },
    },
    template: `
        <shell title="小剧场" @close="$emit('close')">
            <p class="sp-panel__desc">
                每一场都存着完整台词。概要会进 AI 的记忆，全文不会 ——
                全文太长，塞进去会把你真正的聊天记录挤掉。
            </p>
            <sp-empty v-if="!list.length" icon="theater" title="还没演过" desc="买点东西，或者去店里坐坐" />
            <article v-for="t in list" :key="t.id" class="sp-theater-row" @click="open(t)">
                <div class="sp-theater-row__main">
                    <h3 class="sp-theater-row__title">{{ t.title }}</h3>
                    <p class="sp-theater-row__cast">{{ cast(t) }} · {{ when(t.createdAt) }}</p>
                    <p class="sp-theater-row__brief">{{ brief(t) }}</p>
                </div>
                <button class="sp-wish__x" @click.stop="drop(t)">删</button>
            </article>
        </shell>
    `,
    emits: ['close'],
};

// ---------------------------------------------------------------------------

const SettingsPanel = {
    name: 'SpSettingsPanel',
    components: { ...UI, Shell },
    computed: {
        s() { return store.getState(); },
        clips() {
            const chosen = new Set(this.s.profile?.clipIds || []);
            return listClips(this.s.identity.world).map((c) => ({ ...c, on: chosen.has(c.id) }));
        },
        promptCount() { return (this.s.profile?.promptIds || []).length; },
        apiRefs() { return listApiRefs(); },
        currentApi() {
            const ref = resolveApiRef();
            if (!ref) return null;
            return this.apiRefs.find((r) => r.type === ref.type && r.refId === ref.refId) || null;
        },
    },
    methods: {
        reconfigure() { store.reopenOnboarding(); },
    },
    template: `
        <shell title="生成设置" @close="$emit('close')">
            <sp-section title="这一档">
                <sp-kv label="用户" :value="s.identity.userName" />
                <sp-kv label="世界观" :value="s.identity.worldName" />
                <sp-kv label="货币" :value="s.identity.currency" />
            </sp-section>

            <sp-section title="正在用的世界观材料" :sub="clips.filter(c => c.on).length + ' 个夹子'">
                <div class="sp-card__tags">
                    <span v-for="c in clips.filter(x => x.on)" :key="c.id" class="sp-tag">{{ c.title }}</span>
                    <span v-if="!clips.some(x => x.on)" class="sp-tag">（一个都没选）</span>
                </div>
                <p class="sp-panel__note">另外还选了 {{ promptCount }} 条 prompt 库条目。</p>
            </sp-section>

            <sp-section title="用哪个 API">
                <p v-if="currentApi" class="sp-panel__note">
                    {{ currentApi.label }}<span v-if="currentApi.sub"> · {{ currentApi.sub }}</span>
                </p>
                <p v-else class="sp-panel__note sp-panel__note--warn">
                    还没有可用的 API。去「设置 → API 管理」加一个。
                </p>
                <p class="sp-panel__note">
                    默认跟随默认用户卡绑定的 API。想换的话去人设里改绑定，这里会跟着变。
                </p>
            </sp-section>

            <sp-section title="重新配置">
                <p class="sp-panel__note">
                    重新走一遍首次配置。已经收藏的东西、钱包、心愿单、小剧场都不会动，
                    只影响之后生成的内容。
                </p>
                <sp-btn variant="line" icon="refresh" @click="reconfigure">重新配置</sp-btn>
            </sp-section>
        </shell>
    `,
    emits: ['close'],
};

/**
 * 给 `components: {}` 用的注册表。
 *
 * ★ key 必须是**组件名**，不是 view 名。
 *   第一版写成 `{ wishlist: WishlistPanel }`，于是 `<component :is="'sp-wishlist-panel'">`
 *   解析不到任何东西 —— 表现是「点了心愿单，什么都不出现」，
 *   控制台只有一条 Vue 的 resolve 警告。浏览器探针抓到的就是这个。
 */
export const ME_PANEL_COMPONENTS = {
    SpWishlistPanel: WishlistPanel,
    SpGiftsPanel: GiftsPanel,
    SpOrdersPanel: OrdersPanel,
    SpFlowPanel: FlowPanel,
    SpTheatersPanel: TheatersPanel,
    SpSettingsPanel: SettingsPanel,
};

/**
 * view 名 → 组件名。
 *
 * 和上面那张表放在一起，是因为它们必须同时改 —— 分到两个文件里
 * 就会出现「加了面板但忘了加路由」这种只有点进去才发现的问题。
 */
export const ME_PANEL_BY_VIEW = Object.freeze({
    wishlist: 'sp-wishlist-panel',
    gifts: 'sp-gifts-panel',
    orders: 'sp-orders-panel',
    flow: 'sp-flow-panel',
    theaters: 'sp-theaters-panel',
    settings: 'sp-settings-panel',
});

export {
    WishlistPanel, GiftsPanel, OrdersPanel, FlowPanel, TheatersPanel, SettingsPanel,
};
