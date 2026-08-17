/**
 * 四叶草 · 弹层
 *
 * 全部套 `SpSheet`（从底部升起、点遮罩关、没有叉）。
 * 这条规矩收在组件里而不是「每处都记得传参数」—— 靠纪律维持的一致性
 * 迟早会漏一个，而漏掉的那个通常只是「多了个叉」这种没人会专门报的小瑕疵。
 *
 * 一个 `<sp-modals>` 挂在根组件里，按 `state.modal.type` 分发。
 * 加一种弹层要改两处：这里的分发 + 下面加一个分支。两处都在同一个文件里，
 * 漏一处当场就能看见。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { FEED_KINDS, THEATER_OCCASIONS, THEATER_LENGTHS } from '../constants.js';
import { listWorldAis } from '../services/world-context.js';
import { shareItemToChat, shareTheaterToChat, userGiftToAi } from '../services/gift-service.js';
import { asArray, fmtMoney, money } from '../utils.js';

// ---------------------------------------------------------------------------
// 自己添加商品 / 店铺
// ---------------------------------------------------------------------------

const AddItem = {
    name: 'SpAddItem',
    components: { ...UI },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close'],
    data() {
        return {
            name: '', brand: '', category: '', blurb: '', desc: '',
            price: '', area: '', rating: '4.6', signature: '',
            serve: ['dinein'],
        };
    },
    computed: {
        s() { return store.getState(); },
        currency() { return this.s.identity.currency; },
        kind() { return this.payload.kind || FEED_KINDS.product; },
        isProduct() { return this.kind === FEED_KINDS.product; },
        ok() { return this.name.trim().length > 0; },
    },
    methods: {
        toggleServe(m) {
            const i = this.serve.indexOf(m);
            if (i >= 0) { if (this.serve.length > 1) this.serve.splice(i, 1); }
            else this.serve.push(m);
        },
        async submit() {
            if (!this.ok) return;
            await store.addManualItem(this.kind, this.isProduct ? {
                name: this.name, brand: this.brand, category: this.category || '其他',
                blurb: this.blurb, price: Number(this.price) || 0, desc: this.desc,
            } : {
                name: this.name, area: this.area, category: this.category || '其他',
                blurb: this.blurb, priceLevel: Number(this.price) || 0,
                rating: Number(this.rating) || 4.6, signature: this.signature,
                serve: this.serve, desc: this.desc,
            });
            this.$emit('close');
        },
    },
    template: `
        <sp-sheet :title="isProduct ? '自己加一件商品' : '自己加一家店'"
                  desc="自己加的会自动收藏，刷新带不走它" size="lg" @close="$emit('close')">
            <sp-field :label="isProduct ? '商品名' : '店名'">
                <sp-input v-model="name" :placeholder="isProduct ? '比如：桧木手冲壶' : '比如：巷口那家'" :maxlength="20" />
            </sp-field>
            <sp-field v-if="isProduct" label="店家">
                <sp-input v-model="brand" placeholder="谁做的 / 哪家卖的" :maxlength="16" />
            </sp-field>
            <sp-field v-else label="地段">
                <sp-input v-model="area" placeholder="在哪一带" :maxlength="16" />
            </sp-field>
            <sp-field label="分类">
                <sp-input v-model="category" placeholder="留空算「其他」" :maxlength="8" />
            </sp-field>
            <sp-field :label="isProduct ? '售价' : '人均'" :hint="'单位：' + currency">
                <sp-input v-model="price" type="number" placeholder="0" />
            </sp-field>
            <sp-field v-if="!isProduct" label="怎么吃">
                <div class="sp-chips">
                    <sp-chip :active="serve.includes('dinein')" @click="toggleServe('dinein')">到店</sp-chip>
                    <sp-chip :active="serve.includes('delivery')" @click="toggleServe('delivery')">外送</sp-chip>
                </div>
            </sp-field>
            <sp-field v-if="!isProduct" label="招牌">
                <sp-input v-model="signature" placeholder="最出名的那一道" :maxlength="14" />
            </sp-field>
            <sp-field label="一句话">
                <sp-input v-model="blurb" placeholder="一眼看过去是个什么东西" :maxlength="30" />
            </sp-field>
            <sp-field label="详细一点（可以不写）" hint="写了就当详情用，不用再让 AI 生成">
                <sp-textarea v-model="desc" :rows="4" />
            </sp-field>
            <template #footer>
                <sp-btn variant="ghost" @click="$emit('close')">算了</sp-btn>
                <sp-btn variant="primary" block :disabled="!ok" @click="submit">加进去</sp-btn>
            </template>
        </sp-sheet>
    `,
};

// ---------------------------------------------------------------------------
// 改一件东西
// ---------------------------------------------------------------------------

const EditItem = {
    name: 'SpEditItem',
    components: { ...UI },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close'],
    data() {
        const it = this.payload.item || {};
        return {
            name: it.name || '',
            blurb: it.blurb || '',
            price: String(it.kind === FEED_KINDS.product ? (it.price || '') : (it.priceLevel || '')),
            desc: it.detail?.desc || '',
        };
    },
    computed: {
        item() { return this.payload.item; },
        isProduct() { return this.item?.kind === FEED_KINDS.product; },
        currency() { return store.getState().identity.currency; },
    },
    methods: {
        async submit() {
            const patch = { name: this.name.trim(), blurb: this.blurb.trim() };
            if (this.isProduct) patch.price = money(this.price);
            else patch.priceLevel = money(this.price);
            if (this.item.detail) patch.detail = { ...this.item.detail, desc: this.desc };
            await store.updateItem(this.item, patch);
            this.$emit('close');
        },
    },
    template: `
        <sp-sheet title="改一改" desc="改完只影响这一件，不会重新问 AI" size="lg" @close="$emit('close')">
            <sp-field label="名字"><sp-input v-model="name" :maxlength="20" /></sp-field>
            <sp-field label="一句话"><sp-input v-model="blurb" :maxlength="30" /></sp-field>
            <sp-field :label="isProduct ? '售价' : '人均'" :hint="'单位：' + currency">
                <sp-input v-model="price" type="number" />
            </sp-field>
            <sp-field v-if="item && item.detail" label="详情正文">
                <sp-textarea v-model="desc" :rows="6" />
            </sp-field>
            <template #footer>
                <sp-btn variant="ghost" @click="$emit('close')">算了</sp-btn>
                <sp-btn variant="primary" block @click="submit">保存</sp-btn>
            </template>
        </sp-sheet>
    `,
};

// ---------------------------------------------------------------------------
// 分享 / 送礼（同一个弹层的两个动作）
// ---------------------------------------------------------------------------

const ShareItem = {
    name: 'SpShareItem',
    components: { ...UI },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close'],
    data() {
        return { aiId: '', note: '', mode: 'share', busy: false, err: '' };
    },
    computed: {
        s() { return store.getState(); },
        currency() { return this.s.identity.currency; },
        item() { return this.payload.item; },
        ais() { return listWorldAis(this.s.identity.world); },
        price() {
            const it = this.item || {};
            return money(it.kind === FEED_KINDS.product ? it.price : it.priceLevel);
        },
        balance() { return this.s.balance; },
        enough() { return this.mode !== 'gift' || this.balance >= this.price; },
        ok() { return Boolean(this.aiId) && this.enough && !this.busy; },
    },
    methods: {
        fmt(n) { return fmtMoney(n); },
        pick(id) { this.aiId = id; },
        async submit() {
            if (!this.ok) return;
            this.busy = true;
            this.err = '';
            try {
                if (this.mode === 'gift') {
                    const res = await userGiftToAi({
                        aiPersonId: this.aiId, item: this.item,
                        price: this.price, message: this.note,
                    });
                    if (!res.ok) { this.err = res.error || '送不出去'; return; }
                    await store.hydrate();
                    store.showToast('礼物已送出');
                } else {
                    await shareItemToChat({ aiId: this.aiId, item: this.item, note: this.note });
                    store.showToast('已分享到聊天');
                }
                this.$emit('close');
            } finally {
                this.busy = false;
            }
        },
    },
    template: `
        <sp-sheet title="发给谁" size="lg" @close="$emit('close')">
            <div class="sp-modes">
                <button class="sp-modes__btn" :class="{ 'is-on': mode === 'share' }" @click="mode = 'share'">
                    <b>分享</b><span>发一张卡片给他看</span>
                </button>
                <button class="sp-modes__btn" :class="{ 'is-on': mode === 'gift' }" @click="mode = 'gift'">
                    <b>送给他</b><span>真的付钱，做成礼物卡</span>
                </button>
            </div>

            <sp-field label="选一个人">
                <div class="sp-ai-picks">
                    <button
                        v-for="a in ais" :key="a.id"
                        class="sp-ai-pick" :class="{ 'is-on': aiId === a.id }"
                        @click="pick(a.id)"
                    >{{ a.name }}</button>
                </div>
                <p v-if="!ais.length" class="sp-panel__note">这个世界观下还没有 AI 人设。</p>
            </sp-field>

            <sp-field label="附一句话">
                <sp-input v-model="note" placeholder="可以不写" :maxlength="40" />
            </sp-field>

            <section v-if="mode === 'gift'" class="sp-settle sp-settle--mini">
                <div class="sp-settle__grid">
                    <div class="sp-settle__cell">
                        <span class="sp-settle__k">现在有</span><span class="sp-settle__v">{{ fmt(balance) }}</span>
                    </div>
                    <span class="sp-settle__op">−</span>
                    <div class="sp-settle__cell">
                        <span class="sp-settle__k">这份</span><span class="sp-settle__v sp-settle__v--out">{{ fmt(price) }}</span>
                    </div>
                    <span class="sp-settle__op">=</span>
                    <div class="sp-settle__cell">
                        <span class="sp-settle__k">剩下</span>
                        <span class="sp-settle__v" :class="{ 'sp-settle__v--bad': !enough }">{{ fmt(balance - price) }}</span>
                    </div>
                </div>
                <p class="sp-settle__unit">单位：{{ currency }}</p>
                <p v-if="!enough" class="sp-settle__warn">余额不够，送不了</p>
            </section>

            <p v-if="err" class="sp-feed__error">{{ err }}</p>

            <template #footer>
                <sp-btn variant="ghost" @click="$emit('close')">算了</sp-btn>
                <sp-btn variant="primary" block :disabled="!ok" :loading="busy" @click="submit">
                    {{ mode === 'gift' ? '付款并送出' : '分享' }}
                </sp-btn>
            </template>
        </sp-sheet>
    `,
};

// ---------------------------------------------------------------------------
// 分享小剧场概要
// ---------------------------------------------------------------------------

const ShareTheater = {
    name: 'SpShareTheater',
    components: { ...UI },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close'],
    data() { return { aiId: '', busy: false }; },
    computed: {
        s() { return store.getState(); },
        theater() { return this.payload.theater; },
        /** 优先列参演过的人 —— 分享给没参演的 AI 也行，但那不是常见意图 */
        ais() {
            const all = listWorldAis(this.s.identity.world);
            const cast = new Set(asArray(this.theater?.participants).map((p) => String(p.id)));
            return [...all].sort((a, b) => (cast.has(b.id) ? 1 : 0) - (cast.has(a.id) ? 1 : 0));
        },
    },
    methods: {
        async submit() {
            if (!this.aiId) return;
            this.busy = true;
            try {
                await shareTheaterToChat({ aiId: this.aiId, theater: this.theater });
                store.showToast('概要已发过去');
                this.$emit('close');
            } finally { this.busy = false; }
        },
    },
    template: `
        <sp-sheet title="分享这一场" desc="只发概要，不发全文" @close="$emit('close')">
            <p class="sp-theater__summary">{{ theater && theater.summary }}</p>
            <sp-field label="发给谁">
                <div class="sp-ai-picks">
                    <button
                        v-for="a in ais" :key="a.id"
                        class="sp-ai-pick" :class="{ 'is-on': aiId === a.id }"
                        @click="aiId = a.id"
                    >{{ a.name }}</button>
                </div>
            </sp-field>
            <template #footer>
                <sp-btn variant="ghost" @click="$emit('close')">算了</sp-btn>
                <sp-btn variant="primary" block :disabled="!aiId" :loading="busy" @click="submit">发过去</sp-btn>
            </template>
        </sp-sheet>
    `,
};

// ---------------------------------------------------------------------------
// 小剧场设置（生成前选谁参演）
// ---------------------------------------------------------------------------

const TheaterSetup = {
    name: 'SpTheaterSetup',
    components: { ...UI },
    props: { payload: { type: Object, default: () => ({}) } },
    emits: ['close'],
    data() {
        return {
            aiIds: [...asArray(this.payload.aiIds)],
            occasion: this.payload.occasion || 'purchase',
            length: 'medium',
            extra: '',
            busy: false,
        };
    },
    computed: {
        s() { return store.getState(); },
        ais() { return listWorldAis(this.s.identity.world); },
        occasions() { return THEATER_OCCASIONS; },
        lengths() { return THEATER_LENGTHS; },
        subject() { return this.payload.subject || {}; },
    },
    mounted() {
        // 上次选过谁就默认选上 —— 用户多半一直和同一批人玩
        if (!this.aiIds.length) {
            this.aiIds = [...asArray(this.s.profile?.theaterAiIds)];
        }
    },
    methods: {
        toggle(id) {
            const i = this.aiIds.indexOf(id);
            if (i >= 0) this.aiIds.splice(i, 1);
            else this.aiIds.push(id);
        },
        skip() { this.$emit('close'); },
        async submit() {
            this.busy = true;
            try {
                if (this.s.profile) {
                    this.s.profile.theaterAiIds = [...this.aiIds];
                    this.s.profile.theaterLength = this.length;
                    await store.flushPersist();
                }
                const t = await store.generateTheater({
                    occasion: this.occasion,
                    subject: this.subject,
                    aiIds: this.aiIds,
                    length: this.length,
                    extra: this.extra,
                    orderId: this.payload.orderId || '',
                });
                this.$emit('close');
                if (!t && this.s.error) store.showToast(this.s.error);
            } finally { this.busy = false; }
        },
    },
    template: `
        <sp-sheet title="要演一段吗" size="lg" @close="$emit('close')">
            <p class="sp-panel__desc">
                挑几个人，让他们围绕这件事演一小段。全程用你世界观里的设定，
                演完会存下来，概要会进他们的记忆。
            </p>

            <div v-if="subject.name" class="sp-subject">
                <span class="sp-subject__k">这次是关于</span>
                <span class="sp-subject__v">{{ subject.name }}</span>
            </div>

            <sp-field label="谁在场" hint="一个都不选也行，那就是你一个人">
                <div class="sp-ai-picks">
                    <button
                        v-for="a in ais" :key="a.id"
                        class="sp-ai-pick" :class="{ 'is-on': aiIds.includes(a.id) }"
                        @click="toggle(a.id)"
                    >{{ a.name }}</button>
                </div>
                <p v-if="!ais.length" class="sp-panel__note">这个世界观下还没有 AI 人设。</p>
            </sp-field>

            <sp-field label="什么场合">
                <div class="sp-chips">
                    <sp-chip
                        v-for="o in occasions" :key="o.id"
                        :active="occasion === o.id" @click="occasion = o.id"
                    >{{ o.label }}</sp-chip>
                </div>
            </sp-field>

            <sp-field label="多长">
                <div class="sp-chips">
                    <sp-chip
                        v-for="l in lengths" :key="l.id"
                        :active="length === l.id" @click="length = l.id"
                    >{{ l.label }} · {{ l.words }}</sp-chip>
                </div>
            </sp-field>

            <sp-field label="想让它发生什么（可以不写）">
                <sp-input v-model="extra" placeholder="比如：他一开始不太高兴" :maxlength="40" />
            </sp-field>

            <template #footer>
                <sp-btn variant="ghost" @click="skip">先不演</sp-btn>
                <sp-btn variant="primary" block :loading="busy" @click="submit">开演</sp-btn>
            </template>
        </sp-sheet>
    `,
};

// ---------------------------------------------------------------------------

const MODAL_MAP = {
    'add-item': AddItem,
    'edit-item': EditItem,
    'share-item': ShareItem,
    'share-theater': ShareTheater,
    'theater-setup': TheaterSetup,
};

export const SpModals = {
    name: 'SpModals',
    computed: {
        modal() { return store.getState().modal; },
        /**
         * ★ 返回**组件对象**，不是组件名。
         *
         * 原来这里是 `components: MODAL_MAP` + `return MODAL_MAP[type].name`，
         * 两句合起来是坏的：注册进去的 key 是 `'add-item'`（业务含义的名字），
         * 而 Vue 解析 `:is="'SpAddItem'"` 时只会去试
         * `registry['SpAddItem']` / camelize / capitalize 三种拼法，
         * 全都对不上 `'add-item'`。解析不到时 Vue **不报错**，
         * 直接把字符串当原生标签渲染出一个空的 `<spadditem></spadditem>` ——
         * 表现就是这五个弹层**点了全都没反应**，控制台只有一条容易被淹掉的
         * resolve 警告。
         *
         * 改成直接给对象，就从结构上没有「两处名字要对上」这回事了。
         * 同一个坑在 job-app 的 modals.js 里也踩过一次，改法一致。
         */
        current() {
            const type = this.modal?.type;
            if (!type) return null;
            const comp = MODAL_MAP[type];
            if (!comp) {
                // 分发表里没有 = 有人 openModal 了一个不存在的 type。
                // 静默返回的话表现是「点了没反应」，只能靠这条 warn 发现
                console.warn(`[shop] 没有名为 "${type}" 的弹层`);
                return null;
            }
            return comp;
        },
    },
    methods: {
        close() { store.closeModal(); },
    },
    template: `
        <component
            v-if="current"
            :is="current"
            :payload="modal.payload"
            @close="close"
        />
    `,
};
