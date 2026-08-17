/**
 * 灯塔 · 根组件
 *
 * ── 它负责的四件事 ────────────────────────────────────────────────
 *   1. 挂载时 hydrate，以及每次 App 被打开时**重新对一次身份 + 补发工资**
 *   2. 把「往根节点写颜色变量」的能力交给 store
 *   3. 路由：引导页 / 四个 tab / 各种子页
 *   4. 把状态栏颜色从 CSS 读出来转发给框架
 *
 * ── vue 模式没有自动 hydrate ──────────────────────────────────────
 *
 * framework 不会替 vue 模式的 App 调 `methods.hydrate`。
 * 所以这里在 `mounted` 的 microtask 里自己启动 —— 放 microtask 是为了
 * 让首帧先画出来（骨架），而不是白屏等数据。
 * 封面设计器那次「永远卡在正在加载」就是漏了这一步。
 *
 * ── 状态栏颜色 ────────────────────────────────────────────────────
 *
 * 框架画状态栏时只认 `appConfig.statusBarColor` 这个静态字段，
 * 它不认识 CSS 变量。所以主题变了之后要**从 getComputedStyle 读出来转发**。
 * CSS 仍然是唯一真相，JS 只是搬运工 —— 这是 JS 里出现颜色的唯一合法方式。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { JbOnboarding } from './onboarding.js';
import { JbFeedPage, JbSavedPanel } from './feed-page.js';
import { JbDetailPanel } from './detail-page.js';
import { JbTalksPage, JbTalkPanel } from './talk-page.js';
import { JbWorkPage } from './work-page.js';
import { JbPostPanel } from './post-panel.js';
import { JbTheaterPanel } from './theater-panel.js';
import { JbMePage } from './me-page.js';
import { ME_PANEL_COMPONENTS, ME_PANEL_BY_VIEW } from './me-panels.js';
import { JbPromptPanel } from './prompt-panel.js';
import { JbThemePanel } from './theme-panel.js';
import { JbModals } from './modals.js';
import { TABS, TALK_STATUS } from '../constants.js';
import { applyThemeVars, resolveThemeColors } from '../theme.js';
import { icon } from '../icons.js';
import { fmtMoney } from '../utils.js';

const TabBar = {
    name: 'JbTabBar',
    props: {
        active: { type: String, required: true },
        talkDot: { type: Number, default: 0 },
        workCount: { type: Number, default: 0 },
    },
    emits: ['pick'],
    computed: {
        tabs() { return TABS; },
    },
    methods: {
        iconOf(name) { return icon(name, { size: 21 }); },
        badge(id) {
            if (id === 'talks' && this.talkDot > 0) return String(this.talkDot);
            if (id === 'work' && this.workCount > 0) return String(this.workCount);
            return '';
        },
    },
    template: `
        <nav class="jb-tabbar">
            <button
                v-for="t in tabs" :key="t.id"
                class="jb-tabbar__item" :class="{ 'is-on': t.id === active }"
                @click="$emit('pick', t.id)"
            >
                <span class="jb-tabbar__icon" v-html="iconOf(t.icon)"></span>
                <span class="jb-tabbar__label">{{ t.label }}</span>
                <i v-if="badge(t.id)" class="jb-tabbar__badge">{{ badge(t.id) }}</i>
            </button>
        </nav>
    `,
};

/**
 * view 名 → 组件名。
 * 「我的」下面那几个在 `me-panels.js` 里自己维护一份，这里只放主干的。
 */
const PANEL_BY_VIEW = Object.freeze({
    detail: 'jb-detail-panel',
    talk: 'jb-talk-panel',
    post: 'jb-post-panel',
    theater: 'jb-theater-panel',
    saved: 'jb-saved-panel',
    prompts: 'jb-prompt-panel',
    theme: 'jb-theme-panel',
});

export function createJobRoot() {
    return {
        name: 'JbRoot',
        components: {
            ...UI, TabBar, JbModals,
            JbOnboarding, JbFeedPage, JbSavedPanel, JbDetailPanel,
            JbTalksPage, JbTalkPanel, JbWorkPage, JbPostPanel, JbTheaterPanel,
            JbMePage, JbPromptPanel, JbThemePanel,
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
            currency() { return this.s.identity.currency; },
            balanceText() { return fmtMoney(this.s.balance); },

            openTalks() {
                return this.s.recruiters.filter((r) => r.status === TALK_STATUS.open).length;
            },
            workCount() { return this.s.posts.length; },

            topTitle() {
                return ({ market: '灯塔', talks: '面试', work: '在职', me: '我的' })[this.tab] || '灯塔';
            },
            topSub() {
                if (this.tab === 'market') return this.s.identity.worldName;
                if (this.tab === 'work' && this.s.identity.occupation) return this.s.identity.occupation;
                return '';
            },
            mark() { return icon('beacon', { size: 18 }); },
            coinMark() { return icon('coin', { size: 14 }); },

            /** 当前该显示哪个子页。主干的和「我的」下面的合起来查。 */
            panel() {
                return PANEL_BY_VIEW[this.view] || ME_PANEL_BY_VIEW[this.view] || '';
            },
        },
        mounted() {
            store.registerThemeApplier((themeId, custom) => this.applyTheme(themeId, custom));

            // microtask 里启动，让首帧先画出来
            Promise.resolve().then(() => store.hydrate(this.app));

            // 每次 App 被打开：重新对身份 + 补发欠的工资。
            // 「打开网页就动态计算」这条需求的触发点就在这里 ——
            // 不用定时器，因为定时器只在页面开着时走，而用户多半隔几天来一次。
            this._onAppOpened = (e) => {
                if (e?.detail?.appId && e.detail.appId !== 'job') return;
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
                el.setAttribute('data-jb-theme', themeId || 'dayshift');
                applyThemeVars(el, custom || {});
                this.syncChromeColors(el, themeId, custom);
            },

            /**
             * 把状态栏 / Home 条的颜色从 CSS 读出来转发给框架。
             * 主题一换就得重来一次，否则夜班主题下状态栏会是深色字、深底上看不见。
             */
            syncChromeColors(el, themeId, custom) {
                try {
                    const colors = resolveThemeColors(themeId, custom);
                    const cs = getComputedStyle(el);
                    const text = colors['--jb-text'] || cs.getPropertyValue('--jb-text').trim();
                    const bg = colors['--jb-bg'] || cs.getPropertyValue('--jb-bg').trim();
                    if (text) this.app.statusBarColor = text;
                    if (bg) this.app.background = bg;
                    if (text) this.app.homeIndicatorColor = text;
                    // ★ 重赋 apps.value 强制框架 computed 重算（core-shim 约定的通知路径），
                    //   否则背景层 / home 指示条可能停在旧主题色（AGENTS2 §18.2）
                    if (window.__phoneAppsRef?.value) window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
                } catch (err) {
                    console.warn('[job] 同步状态栏颜色失败', err);
                }
            },
        },
        template: `
            <div class="jb-root" data-jb-theme="dayshift">
                <!-- 顶栏。自绘，所以要自己让出状态栏那 54px -->
                <header class="jb-top">
                    <div class="jb-top__main">
                        <span class="jb-top__mark" v-html="mark"></span>
                        <div class="jb-top__text">
                            <h1 class="jb-top__title">{{ topTitle }}</h1>
                            <p v-if="topSub" class="jb-top__sub">{{ topSub }}</p>
                        </div>
                    </div>
                    <span v-if="ready && !needsConfig && !blocked" class="jb-top__coin">
                        <i v-html="coinMark"></i>{{ balanceText }}<span>{{ currency }}</span>
                    </span>
                </header>

                <div class="jb-body">
                    <!-- 拦截：没有用户 / 没绑世界观 -->
                    <div v-if="blocked" class="jb-blocked">
                        <jb-empty icon="globe" title="还差一步" :desc="blocked" />
                    </div>

                    <!-- 首屏骨架 -->
                    <div v-else-if="!ready" class="jb-page">
                        <jb-skeleton :rows="5" />
                    </div>

                    <!-- 首次配置 -->
                    <jb-onboarding v-else-if="needsConfig" />

                    <!-- 子页：盖在 tab 内容上 -->
                    <component v-else-if="panel" :is="panel" @close="closePanel" />

                    <!-- 四个 tab -->
                    <div v-else class="jb-page">
                        <jb-feed-page v-if="tab === 'market'" />
                        <jb-talks-page v-else-if="tab === 'talks'" />
                        <jb-work-page v-else-if="tab === 'work'" />
                        <jb-me-page v-else-if="tab === 'me'" />
                    </div>
                </div>

                <tab-bar
                    v-if="ready && !needsConfig && !blocked"
                    :active="tab" :talk-dot="openTalks" :work-count="workCount"
                    @pick="pickTab"
                />

                <jb-modals />

                <transition name="jb-toast">
                    <div v-if="s.toast" class="jb-toast">{{ s.toast }}</div>
                </transition>
            </div>
        `,
    };
}
