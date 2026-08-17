/**
 * 候鸟 · 根组件
 *
 * 负责四件事：
 *   1. mounted 时 hydrate（vue 模式框架不会替你调），
 *      每次 App 被打开重新对一次身份（用户可能换了默认卡）
 *   2. 把「往 shell 写主题变量」的能力交给 store
 *   3. 主题变了把状态栏 / 背景色从 CSS 读出来转发给框架（框架不认 CSS 变量）
 *   4. 路由：拦截页 / 引导页 / 五个 tab / 四个覆盖页（详情 / 准备 / 对话 / 配色）
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { TvModals } from './modals.js';
import { TvOnboarding } from './onboarding.js';
import { TvExplorePage } from './explore-page.js';
import { TvDetailPage } from './detail-page.js';
import { TvTripsPage } from './trips-page.js';
import { TvPrepPage } from './prep-page.js';
import { TvTripPage } from './trip-page.js';
import { TvFootprintsPage } from './footprints-page.js';
import { TvCompanionsPage } from './companions-page.js';
import { TvMePage } from './me-page.js';
import { TvThemePanel } from './theme-panel.js';
import { TABS } from '../constants.js';
import { applyThemeVars, resolveThemeColors } from '../theme.js';
import { icon } from '../icons.js';

const TvTabBar = {
    name: 'TvTabBar',
    props: {
        active: { type: String, required: true },
        ongoingCount: { type: Number, default: 0 },
    },
    emits: ['pick'],
    computed: {
        tabs() { return TABS; },
    },
    methods: {
        iconOf(name) { return icon(name, { size: 20 }); },
    },
    template: `
        <nav class="tv-tabbar">
            <button
                v-for="t in tabs" :key="t.id"
                type="button" class="tv-tabbar__item" :class="{ 'is-on': t.id === active }"
                @click="$emit('pick', t.id)"
            >
                <span class="tv-tabbar__icon" v-html="iconOf(t.icon)"></span>
                <span class="tv-tabbar__label">{{ t.label }}</span>
                <i v-if="t.id === 'trips' && ongoingCount" class="tv-tabbar__dot"></i>
            </button>
        </nav>
    `,
};

export function createTravelRoot() {
    return {
        name: 'TvRoot',
        components: {
            ...UI, TvTabBar, TvModals, TvOnboarding,
            TvExplorePage, TvDetailPage, TvTripsPage, TvPrepPage, TvTripPage,
            TvFootprintsPage, TvCompanionsPage, TvMePage, TvThemePanel,
        },
        props: {
            app: { type: Object, default: () => ({}) },
        },
        data() {
            return { state: store.getState() };
        },
        computed: {
            s() { return this.state; },
            ready() { return this.s.ready; },
            blocked() { return this.s.blocked; },
            needsConfig() { return this.s.needsConfig; },
            tab() { return this.s.tab; },
            view() { return this.s.view; },
            ongoingCount() { return this.s.trips.filter((t) => t.status === 'ongoing').length; },
            topTitle() {
                return ({
                    explore: '候鸟', trips: '行程', footprints: '足迹',
                    companions: '共同经历', me: '我的',
                })[this.tab] || '候鸟';
            },
            topSub() {
                if (this.tab === 'explore') return this.s.identity.worldName;
                return '';
            },
            planeMark() { return icon('plane', { size: 17 }); },
            /** 覆盖页盖住 tab 内容和底栏 */
            overlayOpen() { return ['detail', 'prep', 'chat', 'theme'].includes(this.view); },
        },
        mounted() {
            store.registerThemeApplier((themeId, custom) => this.applyTheme(themeId, custom));

            // microtask 里启动，让首帧先画出骨架
            Promise.resolve().then(() => store.hydrate(this.app));

            this._onAppOpened = (e) => {
                if (e?.detail?.appId && e.detail.appId !== 'travel') return;
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
            closeView() { store.setView(''); },
            notify(text) { store.showToast(text); },

            shellEl() {
                if (typeof document === 'undefined') return null;
                return document.querySelector('.app-shell[data-app-id="travel"]');
            },

            applyTheme(themeId, custom) {
                const el = this.shellEl();
                if (!el) return;
                el.setAttribute('data-tv-theme', themeId || 'sky');
                applyThemeVars(el, custom || {});
                this.syncChromeColors(themeId, custom);
            },

            /** 状态栏 / Home 条颜色只认静态字段，从 CSS 读出来转发（CSS 仍是唯一真相） */
            syncChromeColors(themeId, custom) {
                try {
                    const colors = resolveThemeColors(themeId, custom);
                    const el = this.shellEl();
                    const cs = el ? getComputedStyle(el) : null;
                    const text = colors['--tv-text'] || (cs ? cs.getPropertyValue('--tv-text').trim() : '');
                    const bg = colors['--tv-bg'] || (cs ? cs.getPropertyValue('--tv-bg').trim() : '');
                    if (text) this.app.statusBarColor = text;
                    if (bg) this.app.background = bg;
                    if (text) this.app.homeIndicatorColor = text;
                    // ★ 重赋 apps.value 强制框架 computed 重算（core-shim 约定的通知路径），
                    //   否则背景层 / home 指示条可能停在旧主题色（AGENTS2 §18.2）
                    if (window.__phoneAppsRef?.value) window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
                } catch (err) {
                    console.warn('[travel] 同步状态栏颜色失败', err);
                }
            },
        },
        template: `
            <div class="tv-root">
                <header v-if="!overlayOpen" class="tv-top">
                    <span class="tv-top__mark" v-html="planeMark"></span>
                    <div class="tv-top__text">
                        <h1 class="tv-top__title">{{ topTitle }}</h1>
                        <p v-if="topSub" class="tv-top__sub">{{ topSub }}</p>
                    </div>
                </header>

                <div class="tv-body">
                    <!-- 拦截：没有用户 / 没绑世界观 -->
                    <div v-if="blocked" class="tv-blocked">
                        <TvEmpty icon-name="globe" title="还差一步" :desc="blocked" />
                    </div>

                    <!-- 首屏骨架 -->
                    <div v-else-if="!ready" class="tv-page"><TvSkeleton :rows="5" /></div>

                    <!-- 首次配置 -->
                    <TvOnboarding v-else-if="needsConfig" />

                    <!-- 覆盖页 -->
                    <TvDetailPage v-else-if="view === 'detail'" />
                    <TvPrepPage v-else-if="view === 'prep'" />
                    <TvTripPage v-else-if="view === 'chat'" />
                    <TvThemePanel v-else-if="view === 'theme'" @close="closeView" @notify="notify" />

                    <!-- 五个 tab -->
                    <template v-else>
                        <TvExplorePage v-if="tab === 'explore'" />
                        <TvTripsPage v-else-if="tab === 'trips'" />
                        <TvFootprintsPage v-else-if="tab === 'footprints'" />
                        <TvCompanionsPage v-else-if="tab === 'companions'" />
                        <TvMePage v-else-if="tab === 'me'" />
                    </template>
                </div>

                <TvTabBar
                    v-if="ready && !needsConfig && !blocked && !overlayOpen"
                    :active="tab" :ongoing-count="ongoingCount"
                    @pick="pickTab"
                />

                <TvModals @notify="notify" />

                <transition name="tv-toast">
                    <div v-if="s.toast" class="tv-toast">{{ s.toast }}</div>
                </transition>
            </div>
        `,
    };
}
