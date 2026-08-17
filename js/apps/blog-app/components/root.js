/**
 * 氧气 · 根组件
 *
 * 1. mounted 时 hydrate（vue 模式框架不会替你调），每次打开重对身份
 * 2. 把「往 shell 写主题变量」的能力交给 store
 * 3. 主题变了把状态栏 / 背景色从 CSS 读出来转发给框架
 * 4. 路由：拦截页 / 引导页 / 五个 tab / 覆盖页
 *    （帖子 / 作者 / 闲聊 / 词条 / 私信 / 氧气 / 黑匣子 / 提示词 / 配色）
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { OxModals } from './modals.js';
import { OxOnboarding } from './onboarding.js';
import { OxFeedPage } from './feed-page.js';
import { OxPostPage } from './post-page.js';
import { OxDiscoverPage, OxTermPage } from './discover-page.js';
import { OxEssaysPage } from './essays-page.js';
import { OxRoomPage } from './room-page.js';
import { OxMePage, OxOxygenPage, OxInboxPage } from './me-page.js';
import { OxAuthorPage, OxChatPage } from './author-page.js';
import { OxBlackboxPage } from './blackbox-page.js';
import { OxPromptsPage } from './prompts-page.js';
import { OxThemePanel } from './theme-panel.js';
import { TABS } from '../constants.js';
import { applyThemeVars, resolveThemeColors } from '../theme.js';
import { icon } from '../icons.js';

const OxTabBar = {
    name: 'OxTabBar',
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
        <nav class="ox-tabbar">
            <button
                v-for="t in tabs" :key="t.id"
                type="button" class="ox-tabbar__item" :class="{ 'is-on': t.id === active }"
                @click="$emit('pick', t.id)"
            >
                <span class="ox-tabbar__icon" v-html="iconOf(t.icon)"></span>
                <span class="ox-tabbar__label">{{ t.label }}</span>
            </button>
        </nav>
    `,
};

export function createBlogRoot() {
    return {
        name: 'OxRoot',
        components: {
            ...UI, OxTabBar, OxModals, OxOnboarding,
            OxFeedPage, OxPostPage, OxDiscoverPage, OxTermPage, OxEssaysPage,
            OxRoomPage, OxMePage, OxOxygenPage, OxInboxPage,
            OxAuthorPage, OxChatPage, OxBlackboxPage, OxPromptsPage, OxThemePanel,
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
                    square: '广场', discover: '发现', room: '房间',
                    essays: '随笔', me: '我的',
                })[this.tab] || '氧气';
            },
            topSub() {
                if (this.tab === 'square' || this.tab === 'discover') return this.s.identity.worldName;
                if (this.tab === 'essays' || this.tab === 'room') return '只属于你';
                return '';
            },
            logoMark() { return icon('logo', { size: 17 }); },
            overlayOpen() {
                return ['post', 'author', 'chat', 'term', 'inbox', 'oxygen', 'blackbox', 'prompts', 'theme'].includes(this.view);
            },
            /** 随笔和房间不依赖世界观：blocked 时也放行这两个 tab */
            blockedButLocal() {
                return this.blocked && (this.tab === 'essays' || this.tab === 'room');
            },
        },
        mounted() {
            store.registerThemeApplier((themeId, custom) => this.applyTheme(themeId, custom));

            Promise.resolve().then(() => store.hydrate(this.app));

            this._onAppOpened = (e) => {
                if (e?.detail?.appId && e.detail.appId !== 'blog') return;
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
                return document.querySelector('.app-shell[data-app-id="blog"]');
            },

            applyTheme(themeId, custom) {
                const el = this.shellEl();
                if (!el) return;
                el.setAttribute('data-ox-theme', themeId || 'air');
                applyThemeVars(el, custom || {});
                this.syncChromeColors(themeId, custom);
            },

            /** 状态栏 / Home 条颜色只认静态字段，从 CSS 读出来转发（CSS 仍是唯一真相） */
            syncChromeColors(themeId, custom) {
                try {
                    const colors = resolveThemeColors(themeId, custom);
                    const el = this.shellEl();
                    const cs = el ? getComputedStyle(el) : null;
                    const text = colors['--ox-text'] || (cs ? cs.getPropertyValue('--ox-text').trim() : '');
                    const bg = colors['--ox-bg'] || (cs ? cs.getPropertyValue('--ox-bg').trim() : '');
                    if (text) this.app.statusBarColor = text;
                    if (bg) this.app.background = bg;
                    if (text) this.app.homeIndicatorColor = text;
                    // ★ 重赋 apps.value 强制框架 computed 重算（core-shim 约定的通知路径），
                    //   否则背景层 / home 指示条可能停在旧主题色（AGENTS2 §18.2）
                    if (window.__phoneAppsRef?.value) window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
                } catch (err) {
                    console.warn('[blog] 同步状态栏颜色失败', err);
                }
            },
        },
        template: `
            <div class="ox-root">
                <header v-if="!overlayOpen" class="ox-top">
                    <span class="ox-top__mark" v-html="logoMark"></span>
                    <div class="ox-top__text">
                        <h1 class="ox-top__title">{{ topTitle }}</h1>
                        <p v-if="topSub" class="ox-top__sub">{{ topSub }}</p>
                    </div>
                </header>

                <div class="ox-body">
                    <!-- 首屏骨架 -->
                    <div v-if="!ready" class="ox-page"><OxSkeleton :rows="5" /></div>

                    <!-- 覆盖页 -->
                    <OxPostPage v-else-if="view === 'post'" />
                    <OxAuthorPage v-else-if="view === 'author'" />
                    <OxChatPage v-else-if="view === 'chat'" />
                    <OxTermPage v-else-if="view === 'term'" />
                    <OxInboxPage v-else-if="view === 'inbox'" />
                    <OxOxygenPage v-else-if="view === 'oxygen'" />
                    <OxBlackboxPage v-else-if="view === 'blackbox'" />
                    <OxPromptsPage v-else-if="view === 'prompts'" />
                    <OxThemePanel v-else-if="view === 'theme'" @close="closeView" @notify="notify" />

                    <!-- 随笔 / 房间是全局档：没绑世界也能用 -->
                    <OxEssaysPage v-else-if="tab === 'essays'" />
                    <OxRoomPage v-else-if="tab === 'room'" />

                    <!-- 拦截：没有用户 / 没绑世界观（只拦社交部分） -->
                    <div v-else-if="blocked" class="ox-blockedwrap">
                        <OxEmpty icon-name="world" title="还差一步" :desc="blocked" />
                    </div>

                    <!-- 首次配置 -->
                    <OxOnboarding v-else-if="needsConfig" />

                    <!-- 其余 tab -->
                    <template v-else>
                        <OxFeedPage v-if="tab === 'square'" />
                        <OxDiscoverPage v-else-if="tab === 'discover'" />
                        <OxMePage v-else-if="tab === 'me'" />
                    </template>
                </div>

                <OxTabBar
                    v-if="ready && !overlayOpen"
                    :active="tab"
                    @pick="pickTab"
                />

                <OxModals />

                <transition name="ox-toast">
                    <div v-if="s.toast" class="ox-toast">{{ s.toast }}</div>
                </transition>
            </div>
        `,
    };
}
