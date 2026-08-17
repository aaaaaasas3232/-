/**
 * 气泡机 · 根组件
 *
 * 职责:配色落地、三档切换、预览常驻、弹窗分发、生命周期。
 *
 * ── 布局 ──────────────────────────────────────────────────────────
 *
 *   顶栏(自绘,让开 54px 状态栏)
 *   预览台(常驻,不随 tab 切走)
 *   ├─ 设计 / 形状 / 气泡库  三档
 *   └─ 面板内容(滚动)
 *
 * 预览台**不跟着 tab 走**:调颜色的时候看不到气泡,等于闭着眼睛调。
 * 参考软件把预览放在页面最下方,手机上要来回滚,这是它最影响手感的一处。
 *
 * ── 关于配色怎么落地 ──────────────────────────────────────────────
 *
 * 组件里**一个颜色都不写**。这里只做两件事:
 *   1. 往 `.app-shell[data-app-id="bubble-maker"]` 上写 `data-bb-theme="xxx"`,
 *      让 `_theme.css` 里对应那套 `--bb-*` 生效;用户自定义的那几项
 *      用 inline style 覆盖上去(优先级自然高于 CSS)。
 *   2. 把状态栏 / Home 条颜色**从 CSS 变量里读出来**转发给框架 ——
 *      框架画这些东西时只认 `appConfig` 上的字段,不认识 CSS 变量。
 *      不同步的话切到深色配色时状态栏还是深灰字,在深底上完全看不见。
 *
 * ── 关于 hydrate ──────────────────────────────────────────────────
 *
 * vue 模式下框架**不会**自动调 `app.methods.hydrate()` ——
 * renderPage 返回的是组件配置,没有可调位置。所以必须在 `mounted` 里自己拉。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { MODAL_COMPONENTS } from './modals.js';
import { DESIGN_COMPONENTS } from './panel-design.js';
import { SHAPE_COMPONENTS } from './panel-shape.js';
import { LIBRARY_COMPONENTS } from './panel-library.js';
import { APPEARANCE_COMPONENTS } from './panel-appearance.js';
import { BbPreview } from './preview.js';
import { applyThemeVars } from '../theme.js';
import { TABS } from '../constants.js';

export function createBubbleMakerRoot() {
    return {
        name: 'BubbleMakerRoot',
        components: {
            ...SHARED_COMPONENTS,
            ...MODAL_COMPONENTS,
            ...DESIGN_COMPONENTS,
            ...SHAPE_COMPONENTS,
            ...LIBRARY_COMPONENTS,
            ...APPEARANCE_COMPONENTS,
            BbPreview,
        },
        props: {
            app: { type: Object, required: true },
        },
        data() {
            return { TABS, appearanceOpen: false };
        },
        computed: {
            state() { return store.getState(); },
            ready() { return this.state.ready; },
            settings() { return store.getSettings(); },
            tab() { return this.state.tab; },
            modal() { return this.state.modal; },
            toast() { return this.state.toast; },
            hasBubble() { return Boolean(store.getActive()); },
        },
        watch: {
            'settings.theme': { immediate: true, handler() { this.$nextTick(() => this.applyTheme()); } },
            'settings.customThemeColors': { deep: true, handler() { this.$nextTick(() => this.applyTheme()); } },
            toast(value) {
                if (!value) return;
                if (this._toastTimer) clearTimeout(this._toastTimer);
                this._toastTimer = setTimeout(() => { store.clearToast(); this._toastTimer = null; }, 2600);
            },
        },
        methods: {
            shellEl() {
                return this.$el?.closest?.('.app-shell') || document.querySelector('.app-shell[data-app-id="bubble-maker"]');
            },
            applyTheme() {
                const shell = this.shellEl();
                if (!shell) return;
                shell.setAttribute('data-bb-theme', this.settings.theme || 'porcelain');
                applyThemeVars(shell, this.settings.customThemeColors || {});

                // ★ 从刚生效的 CSS 变量里读出来再转发给框架 —— CSS 仍是唯一真相,JS 只是搬运工
                const cs = getComputedStyle(shell);
                const read = (name) => cs.getPropertyValue(name).trim();
                const ink = read('--bb-text');
                const bg = read('--bb-bg');
                const indicator = read('--bb-home-indicator');
                if (ink) this.app.statusBarColor = ink;
                if (bg) this.app.background = bg;
                if (indicator) this.app.homeIndicatorColor = indicator;
                // ★ 重赋 apps.value 强制框架 computed 重算（core-shim 约定的通知路径），
                //   否则背景层 / home 指示条可能停在旧主题色（AGENTS2 §18.2）
                if (window.__phoneAppsRef?.value) window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
            },

            setTab(id) { store.setTab(id); },
            onNotify(message) { store.notify(message); },
            onCloseModal() { store.closeModal(); },
            toggleAppearance() { this.appearanceOpen = !this.appearanceOpen; },
        },
        mounted() {
            // vue 模式框架不会自动调 hydrate;放 microtask 里让首帧先画出来再拉数据
            Promise.resolve().then(() => store.hydrate(this.app));
            this.applyTheme();

            this._onHide = () => { void store.flushPersist(); };
            window.addEventListener('pagehide', this._onHide);
            document.addEventListener('visibilitychange', this._onHide);
        },
        beforeUnmount() {
            if (this._toastTimer) clearTimeout(this._toastTimer);
            window.removeEventListener('pagehide', this._onHide);
            document.removeEventListener('visibilitychange', this._onHide);
            void store.flushPersist();
        },
        template: `
            <div class="bb-root">
                <BbSpinner v-if="!ready" label="正在打开工作台…" />

                <template v-else>
                    <header class="bb-topbar">
                        <span class="bb-topbar-title">气泡机</span>
                        <button
                            type="button"
                            class="bb-topbar-btn"
                            :class="{ 'is-active': appearanceOpen }"
                            aria-label="界面配色"
                            @click="toggleAppearance"
                        ><BbIcon name="palette" /></button>
                    </header>

                    <div v-if="state.error" class="bb-banner is-danger">{{ state.error }}</div>

                    <BbPreview v-if="hasBubble && !appearanceOpen" />

                    <nav v-if="!appearanceOpen" class="bb-tabs" role="tablist">
                        <button
                            v-for="t in TABS"
                            :key="t.id"
                            type="button"
                            role="tab"
                            class="bb-tab"
                            :class="{ 'is-active': tab === t.id }"
                            :aria-selected="tab === t.id"
                            @click="setTab(t.id)"
                        >
                            <BbIcon :name="t.icon" />
                            <span>{{ t.label }}</span>
                        </button>
                    </nav>

                    <main class="bb-scroll">
                        <template v-if="appearanceOpen">
                            <BbPanelAppearance @notify="onNotify" />
                        </template>
                        <template v-else>
                            <BbPanelDesign  v-if="tab === 'design'"  @notify="onNotify" />
                            <BbPanelShape   v-else-if="tab === 'shape'"   @notify="onNotify" />
                            <BbPanelLibrary v-else-if="tab === 'library'" @notify="onNotify" />
                        </template>
                    </main>

                    <template v-if="modal">
                        <BbRenameModal
                            v-if="modal.type === 'rename' || modal.type === 'shape-rename'"
                            :payload="modal.type === 'shape-rename' ? { ...modal.payload, kind: 'shape' } : modal.payload"
                            @close="onCloseModal" @notify="onNotify"
                        />
                        <BbShapeNameModal v-else-if="modal.type === 'shape-name'" @close="onCloseModal" @notify="onNotify" />
                        <BbThemeSaveModal v-else-if="modal.type === 'theme-save'" :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <BbConfirmDeleteModal
                            v-else-if="modal.type === 'confirm-delete-bubble'"
                            kind="bubble" :payload="modal.payload"
                            @close="onCloseModal" @notify="onNotify"
                        />
                        <BbConfirmDeleteModal
                            v-else-if="modal.type === 'confirm-delete-shape'"
                            kind="shape" :payload="modal.payload"
                            @close="onCloseModal" @notify="onNotify"
                        />
                    </template>

                    <transition name="bb-toast">
                        <p v-if="toast" class="bb-toast" role="status">{{ toast }}</p>
                    </transition>
                </template>
            </div>
        `,
    };
}

export default createBubbleMakerRoot;
