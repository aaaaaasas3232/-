/**
 * 赛点 · 根组件
 *
 * 1. mounted 时 hydrate（拉声浪的生涯快照），每次打开重对身份
 * 2. 路由：拦截页（声浪未就绪 / 未首配）/ 五个 tab / 覆盖页 / 弹窗 / toast
 * 3. 主题变量写到 shell，chrome 颜色转发给框架
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { TABS } from '../constants.js';
import { icon } from '../icons.js';
import { applyThemeVars, resolveThemeColors } from '../theme.js';
import { EgLobbyPage } from './lobby-page.js';
import { EgSeasonPage } from './season-page.js';
import { EgFriendsPage } from './friends-page.js';
import { EgChatsPage } from './chats-page.js';
import { EgMePage } from './me-page.js';
import { EgSessionPage, EgFriendPage } from './overlays.js';
import { EgThemePanel } from './theme-panel.js';
import { EgModals } from './modals.js';

const EgTabBar = {
    name: 'EgTabBar',
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
        <nav class="eg-tabbar">
            <button v-for="t in tabs" :key="t.id" type="button"
                class="eg-tabbar__item" :class="{ 'is-on': t.id === active }"
                @click="$emit('pick', t.id)">
                <span class="eg-tabbar__icon" v-html="iconOf(t.icon)"></span>
                <span class="eg-tabbar__label">{{ t.label }}</span>
            </button>
        </nav>
    `,
};

export function createGameRoot() {
    return {
        name: 'EgRoot',
        components: {
            ...UI, EgTabBar, EgModals,
            EgLobbyPage, EgSeasonPage, EgFriendsPage, EgChatsPage, EgMePage,
            EgSessionPage, EgFriendPage, EgThemePanel,
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
            needsForumSetup() { return this.s.needsForumSetup; },
            hasCareer() { return Boolean(this.s.career); },
            tab() { return this.s.tab; },
            view() { return this.s.view; },
            openForumAction() {
                return JSON.stringify({ action: 'openApp', targetAppId: 'esports-forum' });
            },
        },
        mounted() {
            store.registerThemeApplier((themeId, custom) => this.applyTheme(themeId, custom));
            Promise.resolve().then(() => store.hydrate(this.app));

            this._onAppOpened = (e) => {
                if (e?.detail?.appId && e.detail.appId !== 'esports-game') return;
                store.refreshCareer({ full: false });
            };
            window.addEventListener('phone:app-opened', this._onAppOpened);
        },
        beforeUnmount() {
            window.removeEventListener('phone:app-opened', this._onAppOpened);
            store.flushPersist();
        },
        methods: {
            pickTab(id) { store.setTab(id); },
            shellEl() {
                if (typeof document === 'undefined') return null;
                return document.querySelector('.app-shell[data-app-id="esports-game"]');
            },
            applyTheme(themeId, custom) {
                const shell = this.shellEl();
                if (!shell) return;
                shell.setAttribute('data-eg-theme', themeId || 'nighttrain');
                const colors = resolveThemeColors(themeId, custom);
                applyThemeVars(shell, colors);
                const bg = colors['--eg-bg'];
                if (bg && this.app) {
                    this.app.background = bg;
                    this.app.statusBarColor = colors['--eg-text'] || this.app.statusBarColor;
                    this.app.homeIndicatorColor = colors['--eg-text-3'] || this.app.homeIndicatorColor;
                    if (window.__phoneAppsRef?.value) {
                        window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
                    }
                }
            },
        },
        template: `
            <div class="eg-app" :data-view="view || 'none'">
                <!-- 拦截 -->
                <div v-if="!ready" class="eg-boot"><EgLoading :lines="['连接服务器', '同步生涯', '快好了']" /></div>
                <div v-else-if="blocked" class="eg-blocked">
                    <EgEmpty iconName="gamepad" title="赛点还进不去" :desc="blocked" />
                </div>
                <div v-else-if="needsForumSetup" class="eg-blocked">
                    <EgEmpty iconName="link" title="先去声浪完成首配" desc="声浪（电竞论坛）是生涯的事实源：战队、赛制、属性都在那边配置，配置好赛点自动解锁。">
                        <button type="button" class="eg-btn eg-btn--blue" :data-app-action="openForumAction">打开声浪</button>
                    </EgEmpty>
                </div>

                <!-- 主体 -->
                <template v-else-if="hasCareer">
                    <main class="eg-main">
                        <EgLobbyPage v-if="tab === 'lobby'" />
                        <EgSeasonPage v-else-if="tab === 'season'" />
                        <EgFriendsPage v-else-if="tab === 'friends'" />
                        <EgChatsPage v-else-if="tab === 'chats'" />
                        <EgMePage v-else />
                    </main>
                    <EgTabBar :active="tab" @pick="pickTab" />

                    <!-- 覆盖页 -->
                    <transition name="eg-slide">
                        <EgSessionPage v-if="view === 'session'" />
                        <EgFriendPage v-else-if="view === 'friend'" />
                        <EgThemePanel v-else-if="view === 'theme'" />
                    </transition>
                </template>

                <div v-else class="eg-blocked">
                    <EgEmpty iconName="gamepad" title="没有进行中的档" desc="去声浪开一档，赛点跟着档走" >
                        <button type="button" class="eg-btn eg-btn--blue" :data-app-action="openForumAction">打开声浪</button>
                    </EgEmpty>
                </div>

                <!-- 弹窗 & toast -->
                <EgModals />
                <transition name="eg-fade">
                    <div v-if="s.toast" class="eg-toast">{{ s.toast }}</div>
                </transition>
            </div>
        `,
    };
}
