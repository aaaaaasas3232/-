/**
 * 日记 · 根组件
 *
 * 职责：路由（配置向导 / 五个 tab）、主题落地、生命周期。
 *
 * ── 主题怎么落地 ──────────────────────────────────────────────────
 *
 * 组件里**一个颜色都不写**。这里只做两件事：
 *
 *   1. 往根节点写 `data-diary-theme` / `data-diary-layout` / `data-diary-scale`，
 *      让 `_theme.css` 里对应那套 `--dy-*` 生效。
 *   2. 把算好的颜色从 CSS **读出来**转发给框架（状态栏 / home 条）——
 *      框架只认 appConfig 上的字段，不认识 CSS 变量，
 *      所以必须有这么一次搬运。这是 JS 里出现颜色值的唯一合法场景：
 *      值来自 CSS，JS 只是搬运工。
 *
 * 属性挂在 `.dy-root` 上而不是 `.app-shell` 上，因为**每个日记本可以有
 * 自己的颜色** —— AI 自己布置的本子换个 tab 就该整页换色。
 *
 * ── hydrate 谁来调 ────────────────────────────────────────────────
 *
 * ★ vue 模式框架**不会**自动调 `app.methods.hydrate()`（AGENTS.md §47：
 *   封面设计器整个 App 的按钮全是死的，就是因为等框架来调）。
 *   必须自己在 `mounted` 的 microtask 里踢一脚。
 */

import * as store from '../store.js';
import { presets as LP } from '@/src/core/presets/index.js';
import { SHARED_COMPONENTS } from './shared.js';
import { DySetup } from './setup.js';
import { DyToday } from './page-today.js';
import { DyArchive } from './page-archive.js';
import { DyCycle } from './page-cycle.js';
import { DyPlans } from './page-plans.js';
import { DyBooks } from './page-books.js';
import { DySettingsSheet } from './sheet-settings.js';
import { OWNER_KIND } from '../constants.js';
import { describeWindow } from '../utils.js';
import * as nook from '../services/nook-bridge.js';

const TABS = [
    { id: 'home', label: '今天', icon: 'pen' },
    { id: 'archive', label: '过去', icon: 'calendar' },
    { id: 'cycle', label: '身体', icon: 'drop' },
    { id: 'plans', label: '日子', icon: 'flag' },
    { id: 'books', label: '本子', icon: 'layers' },
];

const PAGES = {
    home: 'DyToday',
    archive: 'DyArchive',
    cycle: 'DyCycle',
    plans: 'DyPlans',
    books: 'DyBooks',
};

export function createDiaryRoot() {
    return {
        name: 'DiaryRoot',
        components: {
            ...SHARED_COMPONENTS,
            DySetup, DyToday, DyArchive, DyCycle, DyPlans, DyBooks, DySettingsSheet,
        },
        props: {
            app: { type: Object, required: true },
        },
        data() {
            return { TABS };
        },
        computed: {
            state() { return store.getState(); },
            ready() { return this.state.ready; },
            error() { return this.state.error; },
            space() { return store.getActiveSpace(); },
            tab() { return this.state.tab; },
            toast() { return this.state.toast; },
            sheet() { return this.state.sheet; },

            /**
             * 要不要走配置向导。
             *
             * 只有**我自己的**本子会走向导 —— AI 的本子由 AI 通过 API 布置，
             * 没布置过的在「本子」页是锁着的，进不到这里来。
             */
            needSetup() {
                if (!this.ready || !this.space) return false;
                return this.space.ownerKind === OWNER_KIND.USER && !this.space.configured;
            },

            pageComponent() { return PAGES[this.tab] || 'DyToday'; },

            title() {
                if (!this.space) return '日记';
                if (this.tab === 'books') return '日记本';
                return this.space.title || '日记';
            },
            subtitle() {
                if (!this.space) return '';
                if (this.tab === 'books') return '换一本来看';
                const owner = this.space.ownerKind === OWNER_KIND.AI
                    ? (nook.getAi(this.space.ownerId)?.name || 'TA')
                    : (nook.getDefaultUser()?.name || '我');
                return `${owner} · ${describeWindow(this.space.windowStart)}`;
            },

            /** 主题属性，挂在根节点上 */
            rootAttrs() {
                const s = this.space;
                return {
                    'data-diary-theme': s?.theme || 'oat',
                    'data-diary-layout': s?.layout || 'plain',
                    'data-diary-scale': s?.textScale || 'md',
                };
            },
        },
        watch: {
            // 换本子 / 换主题都要重新把状态栏颜色转发给框架
            'space.theme': { immediate: true, handler() { this.$nextTick(() => this.syncChrome()); } },
            'state.activeSpaceId': { handler() { this.$nextTick(() => this.syncChrome()); } },
        },
        mounted() {
            // ★ 框架不会帮你调 hydrate，自己在 microtask 里启动
            Promise.resolve().then(() => store.hydrate(this.app)).then(() => this.syncChrome());

            // 防抖窗口里的最后一次修改必须在页面隐藏前落盘，否则「改了没保存」
            this._onHide = () => { void store.flushPersist(); };
            window.addEventListener('pagehide', this._onHide);
            document.addEventListener('visibilitychange', this._onHide);
        },
        beforeUnmount() {
            window.removeEventListener('pagehide', this._onHide);
            document.removeEventListener('visibilitychange', this._onHide);
            // 切页 / 退出时把弹窗收掉，否则它会留在下一个 App 的界面上
            LP.modals.closeAll();
            void store.flushPersist();
        },
        methods: {
            /**
             * 把 CSS 算出来的颜色转发给框架画的状态栏和 home 条。
             *
             * 框架读的是 `appConfig.statusBarColor` 这几个字段，它不认识 CSS 变量。
             * 不同步的话，切到深色主题时状态栏时间还是黑的，糊在深色背景上看不见。
             */
            syncChrome() {
                const el = this.$refs.root;
                if (!el) return;
                const cs = getComputedStyle(el);
                const status = cs.getPropertyValue('--dy-status-bar').trim();
                const home = cs.getPropertyValue('--dy-home-indicator').trim();
                const bg = cs.getPropertyValue('--dy-bg').trim();
                if (status) this.app.statusBarColor = status;
                if (home) this.app.homeIndicatorColor = home;
                if (bg) this.app.background = bg;
                // ★ 重赋 apps.value 强制框架 computed 重算（core-shim 约定的通知路径），
                //   否则底部指示条那 40px 的背景会停在旧主题色（AGENTS2 §18.2）
                if (window.__phoneAppsRef?.value) window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
            },

            pick(id) {
                store.setTab(id);
            },
            openSettings() {
                store.openSheet('settings');
            },
        },
        template: `
        <div
            ref="root" class="dy-root"
            :data-diary-theme="rootAttrs['data-diary-theme']"
            :data-diary-layout="rootAttrs['data-diary-layout']"
            :data-diary-scale="rootAttrs['data-diary-scale']"
        >
            <!-- 还在加载 -->
            <div v-if="!ready" class="dy-body">
                <DyEmpty icon-name="book" :text="error || '正在打开日记本…'" />
            </div>

            <!-- 配置向导（全屏接管） -->
            <DySetup v-else-if="needSetup" :space-id="space.id" />

            <!-- 主界面 -->
            <template v-else-if="space">
                <header class="dy-topbar">
                    <div class="dy-topbar__row">
                        <span class="dy-topbar__title">{{ title }}</span>
                        <DyIconBtn name="sliders" label="设置" @click="openSettings" />
                    </div>
                    <div class="dy-topbar__sub">{{ subtitle }}</div>
                </header>

                <main class="dy-body">
                    <component :is="pageComponent" />
                </main>

                <nav class="dy-tabbar">
                    <button
                        v-for="t in TABS" :key="t.id"
                        type="button" class="dy-tab"
                        :class="{ 'is-active': tab === t.id }"
                        @click="pick(t.id)"
                    >
                        <DyIcon :name="t.icon" />
                        <span>{{ t.label }}</span>
                    </button>
                </nav>
            </template>

            <!-- 没有默认用户人设 -->
            <div v-else class="dy-body">
                <DyEmpty icon-name="user">
                    还没有默认用户人设。<br />
                    去 nook →「人设」里设一张默认卡，再回来。
                </DyEmpty>
            </div>

            <DySettingsSheet v-if="sheet && sheet.type === 'settings' && space" />
            <div v-if="toast" class="dy-toast">{{ toast }}</div>
        </div>
        `,
    };
}

export default createDiaryRoot;
