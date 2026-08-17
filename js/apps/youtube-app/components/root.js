/**
 * 萤火 · 根组件
 *
 * 负责四件事：
 *   1. mounted 时 hydrate（vue 模式框架不会替你调），
 *      每次 App 被打开重新对一次身份（用户可能换了默认卡 / 换绑了世界）
 *   2. 把「往 shell 写主题变量」的能力交给 store
 *   3. 主题变了把状态栏 / 背景色从 CSS 读出来转发给框架（框架不认 CSS 变量）
 *   4. 路由：拦截页 / 引导页 / 五个 tab / 六个覆盖页（视频 / 主页 / 直播 / 闲聊 / 提示词 / 配色）
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { YtModals } from './modals.js';
import { YtOnboarding } from './onboarding.js';
import { YtHomePage } from './home-page.js';
import { YtChannelsPage } from './channels-page.js';
import { YtSavedPage } from './saved-page.js';
import { YtInboxPage } from './inbox-page.js';
import { YtMePage } from './me-page.js';
import { YtVideoPage } from './video-page.js';
import { YtCreatorPage } from './creator-page.js';
import { YtLivePage } from './live-page.js';
import { YtChatPage } from './chat-page.js';
import { YtPromptsPage } from './prompts-page.js';
import { YtThemePanel } from './theme-panel.js';
import { TABS } from '../constants.js';
import { applyThemeVars, resolveThemeColors } from '../theme.js';
import { icon } from '../icons.js';

const YtTabBar = {
    name: 'YtTabBar',
    props: {
        active: { type: String, required: true },
        dmCount: { type: Number, default: 0 },
    },
    emits: ['pick'],
    computed: {
        tabs() { return TABS; },
    },
    methods: {
        iconOf(name) { return icon(name, { size: 20 }); },
    },
    template: `
        <nav class="yt-tabbar">
            <button
                v-for="t in tabs" :key="t.id"
                type="button" class="yt-tabbar__item" :class="{ 'is-on': t.id === active }"
                @click="$emit('pick', t.id)"
            >
                <span class="yt-tabbar__icon" v-html="iconOf(t.icon)"></span>
                <span class="yt-tabbar__label">{{ t.label }}</span>
                <i v-if="t.id === 'inbox' && dmCount" class="yt-tabbar__dot"></i>
            </button>
        </nav>
    `,
};

export function createYoutubeRoot() {
    return {
        name: 'YtRoot',
        components: {
            ...UI, YtTabBar, YtModals, YtOnboarding,
            YtHomePage, YtChannelsPage, YtSavedPage, YtInboxPage, YtMePage,
            YtVideoPage, YtCreatorPage, YtLivePage, YtChatPage, YtPromptsPage, YtThemePanel,
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
            topTitle() {
                return ({
                    home: '萤火', channels: '频道', saved: '收藏',
                    inbox: '消息', me: '我的',
                })[this.tab] || '萤火';
            },
            topSub() {
                if (this.tab === 'home') return this.s.identity.worldName;
                return '';
            },
            sparkMark() { return icon('spark', { size: 17 }); },
            /** 覆盖页盖住 tab 内容和底栏 */
            overlayOpen() { return ['video', 'creator', 'live', 'chat', 'prompts', 'theme'].includes(this.view); },
            dmCount() { return this.s.dms.length; },
        },
        mounted() {
            store.registerThemeApplier((themeId, custom) => this.applyTheme(themeId, custom));

            // microtask 里启动，让首帧先画出骨架
            Promise.resolve().then(() => store.hydrate(this.app));

            this._onAppOpened = (e) => {
                if (e?.detail?.appId && e.detail.appId !== 'youtube') return;
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
                return document.querySelector('.app-shell[data-app-id="youtube"]');
            },

            applyTheme(themeId, custom) {
                const el = this.shellEl();
                if (!el) return;
                el.setAttribute('data-yt-theme', themeId || 'paper');
                applyThemeVars(el, custom || {});
                this.syncChromeColors(themeId, custom);
            },

            /** 状态栏 / Home 条颜色只认静态字段，从 CSS 读出来转发（CSS 仍是唯一真相） */
            syncChromeColors(themeId, custom) {
                try {
                    const colors = resolveThemeColors(themeId, custom);
                    const el = this.shellEl();
                    const cs = el ? getComputedStyle(el) : null;
                    const text = colors['--yt-text'] || (cs ? cs.getPropertyValue('--yt-text').trim() : '');
                    const bg = colors['--yt-bg'] || (cs ? cs.getPropertyValue('--yt-bg').trim() : '');
                    if (text) this.app.statusBarColor = text;
                    if (bg) this.app.background = bg;
                    if (text) this.app.homeIndicatorColor = text;
                    // ★ 重赋 apps.value 强制框架 computed 重算（core-shim 约定的通知路径），
                    //   否则背景层 / home 指示条可能停在旧主题色（AGENTS2 §18.2）
                    if (window.__phoneAppsRef?.value) window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
                } catch (err) {
                    console.warn('[youtube] 同步状态栏颜色失败', err);
                }
            },
        },
        template: `
            <div class="yt-root">
                <header v-if="!overlayOpen" class="yt-top">
                    <span class="yt-top__mark" v-html="sparkMark"></span>
                    <div class="yt-top__text">
                        <h1 class="yt-top__title">{{ topTitle }}</h1>
                        <p v-if="topSub" class="yt-top__sub">{{ topSub }}</p>
                    </div>
                </header>

                <div class="yt-body">
                    <!-- 拦截：没有用户 / 没绑世界观 -->
                    <div v-if="blocked" class="yt-blockedwrap">
                        <YtEmpty icon-name="globe" title="还差一步" :desc="blocked" />
                    </div>

                    <!-- 首屏骨架 -->
                    <div v-else-if="!ready" class="yt-page"><YtSkeleton :rows="5" /></div>

                    <!-- 首次配置 -->
                    <YtOnboarding v-else-if="needsConfig" />

                    <!-- 覆盖页 -->
                    <YtVideoPage v-else-if="view === 'video'" />
                    <YtCreatorPage v-else-if="view === 'creator'" />
                    <YtLivePage v-else-if="view === 'live'" />
                    <YtChatPage v-else-if="view === 'chat'" />
                    <YtPromptsPage v-else-if="view === 'prompts'" />
                    <YtThemePanel v-else-if="view === 'theme'" @close="closeView" @notify="notify" />

                    <!-- 五个 tab -->
                    <template v-else>
                        <YtHomePage v-if="tab === 'home'" />
                        <YtChannelsPage v-else-if="tab === 'channels'" />
                        <YtSavedPage v-else-if="tab === 'saved'" />
                        <YtInboxPage v-else-if="tab === 'inbox'" />
                        <YtMePage v-else-if="tab === 'me'" />
                    </template>
                </div>

                <YtTabBar
                    v-if="ready && !needsConfig && !blocked && !overlayOpen"
                    :active="tab" :dm-count="dmCount"
                    @pick="pickTab"
                />

                <YtModals />

                <transition name="yt-toast">
                    <div v-if="s.toast" class="yt-toast">{{ s.toast }}</div>
                </transition>
            </div>
        `,
    };
}
