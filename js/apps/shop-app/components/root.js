/**
 * 四叶草 · 根组件
 *
 * ── 它负责的四件事 ────────────────────────────────────────────────
 *   1. 挂载时 hydrate，以及每次 App 被打开时**重新对一次身份**
 *   2. 把「往根节点写颜色变量」的能力交给 store
 *   3. 把「实时上下文怎么读」注册给 murmur
 *   4. 路由：引导页 / 四个 tab / 详情 / 小剧场 / 「我的」子页
 *
 * ── vue 模式没有自动 hydrate ──────────────────────────────────────
 *
 * framework 不会替 vue 模式的 App 调 `methods.hydrate`。
 * 所以这里在 `mounted` 的 microtask 里自己启动 —— 放 microtask 是为了
 * 让首帧先画出来（骨架），而不是白屏等数据。
 *
 * ── 状态栏颜色 ────────────────────────────────────────────────────
 *
 * 框架画状态栏时只认 `appConfig.statusBarColor` 这个静态字段，
 * 它不认识 CSS 变量。所以主题变了之后要**从 getComputedStyle 读出来转发给框架**。
 * CSS 仍然是唯一真相，JS 只是搬运工。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { SpOnboarding } from './onboarding.js';
import { SpMarketPage, SpDinePage } from './feed-page.js';
import { SpCartPage } from './cart-page.js';
import { SpMePage } from './me-page.js';
import { ME_PANEL_COMPONENTS, ME_PANEL_BY_VIEW } from './me-panels.js';
import { SpThemePanel } from './theme-panel.js';
import { SpDetailPage } from './detail-page.js';
import { SpTheaterPage } from './theater-page.js';
import { SpModals } from './modals.js';
import { SpSkeleton } from './ui.js';
import { TABS } from '../constants.js';
import { applyThemeVars, resolveThemeColors } from '../theme.js';
import { icon } from '../icons.js';
import { onExternalChange, markGiftsSeen } from '../services/gift-service.js';

const TabBar = {
    name: 'SpTabBar',
    props: {
        active: { type: String, required: true },
        cartCount: { type: Number, default: 0 },
        meDot: { type: Boolean, default: false },
    },
    emits: ['pick'],
    computed: {
        tabs() { return TABS; },
    },
    methods: {
        iconOf(name) { return icon(name, { size: 21 }); },
        badge(id) {
            if (id === 'cart') return this.cartCount > 0 ? String(this.cartCount) : '';
            return '';
        },
    },
    template: `
        <nav class="sp-tabbar">
            <button
                v-for="t in tabs" :key="t.id"
                class="sp-tabbar__item" :class="{ 'is-on': t.id === active }"
                @click="$emit('pick', t.id)"
            >
                <span class="sp-tabbar__icon" v-html="iconOf(t.icon)"></span>
                <span class="sp-tabbar__label">{{ t.label }}</span>
                <i v-if="badge(t.id)" class="sp-tabbar__badge">{{ badge(t.id) }}</i>
                <i v-else-if="t.id === 'me' && meDot" class="sp-tabbar__dot"></i>
            </button>
        </nav>
    `,
};

export function createShopRoot() {
    return {
        name: 'SpRoot',
        components: {
            ...UI, SpSkeleton, TabBar, SpModals,
            SpOnboarding, SpMarketPage, SpDinePage, SpCartPage, SpMePage,
            SpThemePanel, SpDetailPage, SpTheaterPage,
            ...ME_PANEL_COMPONENTS,
        },
        props: {
            app: { type: Object, default: () => ({}) },
        },
        data() {
            // 同步兜底：首屏立刻有画面，不是 loading
            return { state: store.getState() };
        },
        computed: {
            s() { return this.state; },
            ready() { return this.s.ready; },
            blocked() { return this.s.blocked; },
            needsConfig() { return this.s.needsConfig; },
            tab() { return this.s.tab; },
            view() { return this.s.view; },
            cartCount() {
                return store.cartItems().reduce((n, r) => n + (r.qty || 1), 0);
            },
            meDot() {
                return this.s.orders.some((o) => o.type === 'gift-in' && o.seen === false);
            },
            /** 顶栏标题跟着 tab 走 */
            topTitle() {
                return ({ market: '四叶草', dine: '探店', cart: '购物车', me: '我的' })[this.tab] || '四叶草';
            },
            topSub() {
                if (this.tab === 'market' || this.tab === 'dine') return this.s.identity.worldName;
                return '';
            },
            cloverMark() { return icon('clover', { size: 18 }); },

            /** 「我的」下面那几个子页。配色页不在 me-panels 里，单独接一条。 */
            mePanel() {
                if (this.view === 'theme') return 'sp-theme-panel';
                return ME_PANEL_BY_VIEW[this.view] || '';
            },
        },
        watch: {
            /** 进「收到的」就把未读清掉，那个小圆点的意义是「有新的」不是「没看完」 */
            view(next) {
                if (next === 'gifts') {
                    const key = this.s.identity.profileKey;
                    if (key) {
                        markGiftsSeen(key).then((n) => {
                            if (n > 0) store.hydrate(this.app);
                        });
                    }
                }
            },
        },
        mounted() {
            store.registerThemeApplier((themeId, custom) => this.applyTheme(themeId, custom));

            // 外部（murmur 里 AI 送礼）写盘之后同步内存
            onExternalChange((kind, payload) => {
                if (payload?.profileKey && payload.profileKey !== this.s.identity.profileKey) return;
                store.hydrate(this.app);
            });

            // microtask 里启动，让首帧先画出来
            Promise.resolve().then(() => store.hydrate(this.app));

            // 每次 App 被打开重新对一次身份 —— 用户可能在设置里换了默认用户卡
            this._onAppOpened = (e) => {
                if (e?.detail?.appId && e.detail.appId !== 'shop') return;
                store.recheckIdentity();
            };
            window.addEventListener('phone:app-opened', this._onAppOpened);
        },
        beforeUnmount() {
            window.removeEventListener('phone:app-opened', this._onAppOpened);
            store.flushPersist();
        },
        methods: {
            pickTab(id) { store.setTab(id); },
            closePanel() { store.setView(''); },

            applyTheme(themeId, custom) {
                const el = this.$el?.nodeType === 1 ? this.$el : this.$el?.parentElement;
                if (!el) return;
                el.setAttribute('data-sp-theme', themeId || 'dawn');
                applyThemeVars(el, custom || {});
                this.syncChromeColors(el, themeId, custom);
            },

            /**
             * 把状态栏 / Home 条的颜色从 CSS 读出来转发给框架。
             * 主题一换就得重来一次，否则浅色主题下状态栏会是浅灰字、白底上看不见。
             */
            syncChromeColors(el, themeId, custom) {
                try {
                    const colors = resolveThemeColors(themeId, custom);
                    const cs = getComputedStyle(el);
                    const text = colors['--sp-text'] || cs.getPropertyValue('--sp-text').trim();
                    const bg = colors['--sp-bg'] || cs.getPropertyValue('--sp-bg').trim();
                    if (text) this.app.statusBarColor = text;
                    if (bg) this.app.background = bg;
                    if (text) this.app.homeIndicatorColor = text;
                    // ★ 重赋 apps.value 强制框架 computed 重算（core-shim 约定的通知路径），
                    //   否则背景层 / home 指示条可能停在旧主题色（AGENTS2 §18.2）
                    if (window.__phoneAppsRef?.value) window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
                } catch (err) {
                    console.warn('[shop] 同步状态栏颜色失败', err);
                }
            },
        },
        template: `
            <div class="sp-root" data-sp-theme="dawn">
                <!-- 顶栏。自绘，所以要自己让出状态栏那 54px -->
                <header class="sp-top">
                    <div class="sp-top__main">
                        <span class="sp-top__mark" v-html="cloverMark"></span>
                        <div class="sp-top__text">
                            <h1 class="sp-top__title">{{ topTitle }}</h1>
                            <p v-if="topSub" class="sp-top__sub">{{ topSub }}</p>
                        </div>
                    </div>
                </header>

                <div class="sp-body">
                    <!-- 拦截：没有用户 / 没绑世界观 -->
                    <div v-if="blocked" class="sp-blocked">
                        <sp-empty icon="globe" title="还差一步" :desc="blocked" />
                    </div>

                    <!-- 首屏骨架 -->
                    <div v-else-if="!ready" class="sp-page">
                        <sp-skeleton :rows="5" />
                    </div>

                    <!-- 首次配置 -->
                    <sp-onboarding v-else-if="needsConfig" />

                    <!-- 详情 / 小剧场 / 「我的」子页：盖在 tab 内容上 -->
                    <sp-detail-page v-else-if="view === 'detail'" />
                    <sp-theater-page v-else-if="view === 'theater'" />
                    <component v-else-if="mePanel" :is="mePanel" @close="closePanel" />

                    <!-- 四个 tab -->
                    <div v-else class="sp-page">
                        <sp-market-page v-if="tab === 'market'" />
                        <sp-dine-page v-else-if="tab === 'dine'" />
                        <sp-cart-page v-else-if="tab === 'cart'" />
                        <sp-me-page v-else-if="tab === 'me'" />
                    </div>
                </div>

                <tab-bar
                    v-if="ready && !needsConfig && !blocked"
                    :active="tab" :cart-count="cartCount" :me-dot="meDot"
                    @pick="pickTab"
                />

                <sp-modals />

                <transition name="sp-toast">
                    <div v-if="s.toast" class="sp-toast">{{ s.toast }}</div>
                </transition>
            </div>
        `,
    };
}
