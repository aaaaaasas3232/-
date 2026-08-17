/**
 * 追光 · 根组件
 *
 * 1. mounted 时 hydrate（vue 模式框架不会替你调），每次打开重对身份
 * 2. 路由：拦截页 / 首配向导 / 五个 tab / 覆盖页 / 弹窗 / toast
 * 3. 主题变量写到 shell，状态栏颜色转发给框架
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { TABS } from '../constants.js';
import { icon } from '../icons.js';
import { applyThemeVars, resolveThemeColors } from '../theme.js';
import { AcOnboarding } from './onboarding.js';
import { AcTodayPage } from './today-page.js';
import { AcSchedulePage } from './schedule-page.js';
import { AcWorkPage, AcProjectPage } from './work-page.js';
import { AcCirclePage, AcNpcPage } from './circle-page.js';
import { AcMePage, AcSavesPage, AcStageCardsPage } from './me-page.js';
import { AcTimelinePage, AcAnchorsPage, AcEndingPage, AcPromptsPage } from './overlays.js';
import { AcThemePanel } from './theme-panel.js';
import { AcModals } from './modals.js';

const AcTabBar = {
    name: 'AcTabBar',
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
        <nav class="zg-tabbar">
            <button v-for="t in tabs" :key="t.id" type="button"
                class="zg-tabbar__item" :class="{ 'is-on': t.id === active }"
                @click="$emit('pick', t.id)">
                <span class="zg-tabbar__icon" v-html="iconOf(t.icon)"></span>
                <span class="zg-tabbar__label">{{ t.label }}</span>
            </button>
        </nav>
    `,
};

export function createActorRoot() {
    return {
        name: 'AcRoot',
        components: {
            ...UI, AcTabBar, AcOnboarding, AcModals,
            AcTodayPage, AcSchedulePage, AcWorkPage, AcProjectPage,
            AcCirclePage, AcNpcPage, AcMePage, AcSavesPage, AcStageCardsPage,
            AcTimelinePage, AcAnchorsPage, AcEndingPage, AcPromptsPage, AcThemePanel,
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
                return ['project', 'npc', 'saves', 'stagecards', 'timeline', 'anchors', 'ending', 'prompts', 'theme'].includes(this.view);
            },
        },
        mounted() {
            store.registerThemeApplier((themeId, custom) => this.applyTheme(themeId, custom));
            Promise.resolve().then(() => store.hydrate(this.app));

            this._onAppOpened = (e) => {
                if (e?.detail?.appId && e.detail.appId !== 'actor-career') return;
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
                return document.querySelector('.app-shell[data-app-id="actor-career"]');
            },
            applyTheme(themeId, custom) {
                const shell = this.shellEl();
                if (!shell) return;
                shell.setAttribute('data-ac-theme', themeId || 'stage');
                applyThemeVars(shell, resolveThemeColors(themeId, custom));
            },
        },
        template: `
            <div class="zg-app" :data-view="view || 'none'">
                <!-- 拦截 -->
                <div v-if="!ready" class="zg-boot"><AcLoading :lines="['开灯', '对焦']" /></div>
                <div v-else-if="blocked" class="zg-blocked">
                    <AcEmpty iconName="logo" title="追光还进不去" :desc="blocked" />
                </div>

                <!-- 首配 -->
                <AcOnboarding v-else-if="needsConfig" />

                <!-- 主体 -->
                <template v-else-if="hasSave">
                    <main class="zg-main">
                        <AcTodayPage v-if="tab === 'today'" />
                        <AcSchedulePage v-else-if="tab === 'schedule'" />
                        <AcWorkPage v-else-if="tab === 'work'" />
                        <AcCirclePage v-else-if="tab === 'circle'" />
                        <AcMePage v-else />
                    </main>
                    <AcTabBar :active="tab" @pick="pickTab" />

                    <!-- 覆盖页 -->
                    <transition name="zg-slide">
                        <AcProjectPage v-if="view === 'project'" />
                        <AcNpcPage v-else-if="view === 'npc'" />
                        <AcSavesPage v-else-if="view === 'saves'" />
                        <AcStageCardsPage v-else-if="view === 'stagecards'" />
                        <AcTimelinePage v-else-if="view === 'timeline'" />
                        <AcAnchorsPage v-else-if="view === 'anchors'" />
                        <AcEndingPage v-else-if="view === 'ending'" />
                        <AcPromptsPage v-else-if="view === 'prompts'" />
                        <AcThemePanel v-else-if="view === 'theme'" />
                    </transition>
                </template>

                <!-- 有档案但没档（都删光了） -->
                <div v-else class="zg-blocked">
                    <AcEmpty iconName="save" title="没有可用的档" desc="开一个新档继续演员之路">
                        <AcBtn variant="ink" @click="openNewSave">开新档</AcBtn>
                    </AcEmpty>
                </div>

                <!-- 弹窗 & toast -->
                <AcModals />
                <transition name="zg-fade">
                    <div v-if="s.toast" class="zg-toast">{{ s.toast }}</div>
                </transition>
            </div>
        `,
    };
}
