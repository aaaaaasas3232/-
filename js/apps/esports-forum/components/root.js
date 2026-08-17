/**
 * 声浪 · 根组件
 *
 * 1. mounted 时 hydrate（vue 模式框架不会替你调），每次打开重对身份
 * 2. 路由：拦截页 / 首配向导 / 四个 tab / 覆盖页 / 弹窗 / toast
 * 3. 主题变量写到 shell，chrome 颜色转发给框架（重赋 __phoneAppsRef 强制重算）
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { TABS } from '../constants.js';
import { icon } from '../icons.js';
import { applyThemeVars, resolveThemeColors } from '../theme.js';
import { EfOnboarding } from './onboarding.js';
import { EfHomePage } from './home-page.js';
import { EfBoardsPage, EfBoardPage, EfThreadPage } from './boards-page.js';
import { EfRatingPage } from './rating-page.js';
import { EfMePage } from './me-page.js';
import {
    EfSeasonPage, EfTeamsPage, EfPlayerPage, EfAnchorsPage, EfTimelinePage, EfRiskPage,
} from './overlays.js';
import {
    EfIdentitiesPage, EfSocialPage, EfPromptsPage, EfSavesPage, EfStageCardsPage, EfEndingPage,
} from './overlays2.js';
import { EfThemePanel } from './theme-panel.js';
import { EfModals } from './modals.js';

const EfTabBar = {
    name: 'EfTabBar',
    props: {
        active: { type: String, required: true },
    },
    emits: ['pick'],
    computed: {
        tabs() { return TABS; },
    },
    methods: {
        iconOf(name) { return icon(name, { size: 20 }); },
    },
    template: `
        <nav class="ef-tabbar">
            <button v-for="t in tabs" :key="t.id" type="button"
                class="ef-tabbar__item" :class="{ 'is-on': t.id === active }"
                @click="$emit('pick', t.id)">
                <span class="ef-tabbar__icon" v-html="iconOf(t.icon)"></span>
                <span class="ef-tabbar__label">{{ t.label }}</span>
            </button>
        </nav>
    `,
};

export function createForumRoot() {
    return {
        name: 'EfRoot',
        components: {
            ...UI, EfTabBar, EfOnboarding, EfModals,
            EfHomePage, EfBoardsPage, EfBoardPage, EfThreadPage, EfRatingPage, EfMePage,
            EfSeasonPage, EfTeamsPage, EfPlayerPage, EfAnchorsPage, EfTimelinePage, EfRiskPage,
            EfIdentitiesPage, EfSocialPage, EfPromptsPage, EfSavesPage, EfStageCardsPage,
            EfEndingPage, EfThemePanel,
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
            hasSave() { return Boolean(this.s.save); },
            overlayOpen() {
                return [
                    'board', 'thread', 'season', 'teams', 'player', 'anchors', 'timeline',
                    'risk', 'identities', 'social', 'prompts', 'saves', 'stagecards', 'ending', 'theme',
                ].includes(this.view);
            },
        },
        mounted() {
            store.registerThemeApplier((themeId, custom) => this.applyTheme(themeId, custom));
            Promise.resolve().then(() => store.hydrate(this.app));

            this._onAppOpened = (e) => {
                if (e?.detail?.appId && e.detail.appId !== 'esports-forum') return;
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
            openNewSave() { store.openModal({ type: 'new-save' }); },
            shellEl() {
                if (typeof document === 'undefined') return null;
                return document.querySelector('.app-shell[data-app-id="esports-forum"]');
            },
            applyTheme(themeId, custom) {
                const shell = this.shellEl();
                if (!shell) return;
                shell.setAttribute('data-ef-theme', themeId || 'stand');
                const colors = resolveThemeColors(themeId, custom);
                applyThemeVars(shell, colors);
                // chrome 颜色转发给框架（AGENTS2 §19.5：赋值后重赋 apps 数组强制重算）
                const bg = colors['--ef-bg'];
                if (bg && this.app) {
                    this.app.background = bg;
                    this.app.statusBarColor = colors['--ef-text'] || this.app.statusBarColor;
                    this.app.homeIndicatorColor = colors['--ef-text-3'] || this.app.homeIndicatorColor;
                    if (window.__phoneAppsRef?.value) {
                        window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
                    }
                }
            },
        },
        template: `
            <div class="ef-app" :data-view="view || 'none'">
                <!-- 拦截 -->
                <div v-if="!ready" class="ef-boot"><EfLoading :lines="['开门', '检票', '入座']" /></div>
                <div v-else-if="blocked" class="ef-blocked">
                    <EfEmpty iconName="wave" title="声浪还进不去" :desc="blocked" />
                </div>

                <!-- 首配 -->
                <EfOnboarding v-else-if="needsConfig" />

                <!-- 主体 -->
                <template v-else-if="hasSave">
                    <main class="ef-main">
                        <EfHomePage v-if="tab === 'home'" />
                        <EfBoardsPage v-else-if="tab === 'boards'" />
                        <EfRatingPage v-else-if="tab === 'rating'" />
                        <EfMePage v-else />
                    </main>
                    <EfTabBar :active="tab" @pick="pickTab" />

                    <!-- 覆盖页 -->
                    <transition name="ef-slide">
                        <EfBoardPage v-if="view === 'board'" />
                        <EfThreadPage v-else-if="view === 'thread'" />
                        <EfSeasonPage v-else-if="view === 'season'" />
                        <EfTeamsPage v-else-if="view === 'teams'" />
                        <EfPlayerPage v-else-if="view === 'player'" />
                        <EfAnchorsPage v-else-if="view === 'anchors'" />
                        <EfTimelinePage v-else-if="view === 'timeline'" />
                        <EfRiskPage v-else-if="view === 'risk'" />
                        <EfIdentitiesPage v-else-if="view === 'identities'" />
                        <EfSocialPage v-else-if="view === 'social'" />
                        <EfPromptsPage v-else-if="view === 'prompts'" />
                        <EfSavesPage v-else-if="view === 'saves'" />
                        <EfStageCardsPage v-else-if="view === 'stagecards'" />
                        <EfEndingPage v-else-if="view === 'ending'" />
                        <EfThemePanel v-else-if="view === 'theme'" />
                    </transition>
                </template>

                <!-- 有档案但没档（都删光了） -->
                <div v-else class="ef-blocked">
                    <EfEmpty iconName="save" title="没有可用的档" desc="开一个新档继续职业生涯">
                        <EfBtn variant="ink" @click="openNewSave">开新档</EfBtn>
                    </EfEmpty>
                </div>

                <!-- 弹窗 & toast -->
                <EfModals />
                <transition name="ef-fade">
                    <div v-if="s.toast" class="ef-toast">{{ s.toast }}</div>
                </transition>
            </div>
        `,
    };
}
