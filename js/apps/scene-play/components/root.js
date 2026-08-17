/**
 * 情景剧场 · 根组件
 *
 * 职责:配色落地、舞台常驻、抽屉开合、弹窗分发、生命周期。
 *
 * ── 关于配色怎么落地 ──────────────────────────────────────────────
 *
 * 组件里**一个颜色都不写**。这里只做两件事:
 *   1. 往 `.app-shell[data-app-id="scene-play"]` 上写 `data-sp-theme="xxx"`,
 *      让 `_theme.css` 里对应那套 `--sp-*` 生效;用户自定义的那几项
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
import { SpStage } from './stage.js';
import { SpDrawer } from './drawer.js';
import { applyThemeVars } from '../theme.js';

export function createScenePlayRoot() {
    return {
        name: 'ScenePlayRoot',
        components: { ...SHARED_COMPONENTS, ...MODAL_COMPONENTS, SpStage, SpDrawer },
        props: {
            app: { type: Object, required: true },
        },
        computed: {
            state() { return store.getState(); },
            ready() { return this.state.ready; },
            settings() { return store.getSettings(); },
            modal() { return this.state.modal; },
            toast() { return this.state.toast; },
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
                return this.$el?.closest?.('.app-shell') || document.querySelector('.app-shell[data-app-id="scene-play"]');
            },
            applyTheme() {
                const shell = this.shellEl();
                if (!shell) return;
                shell.setAttribute('data-sp-theme', this.settings.theme || 'jelly');
                applyThemeVars(shell, this.settings.customThemeColors || {});

                // ★ 从刚生效的 CSS 变量里读出来再转发给框架 —— CSS 仍是唯一真相,JS 只是搬运工
                const cs = getComputedStyle(shell);
                const read = (name) => cs.getPropertyValue(name).trim();
                const ink = read('--sp-text');
                const bg = read('--sp-bg');
                const indicator = read('--sp-home-indicator');
                if (ink) this.app.statusBarColor = ink;
                if (bg) this.app.background = bg;
                if (indicator) this.app.homeIndicatorColor = indicator;
                // ★ 重赋 apps.value 强制框架 computed 重算（core-shim 约定的通知路径），
                //   否则底部指示条那 40px 的背景会停在旧主题色（AGENTS2 §18.2）
                if (window.__phoneAppsRef?.value) window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
            },

            onNotify(message) { store.notify(message); },
            onCloseModal() { store.closeModal(); },
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
            store.teardown();
            void store.flushPersist();
        },
        template: `
            <div class="sp-root">
                <SpSpinner v-if="!ready" label="正在拉开幕布…" />

                <template v-else>
                    <div v-if="state.error" class="sp-banner is-danger">{{ state.error }}</div>

                    <SpStage @notify="onNotify" />
                    <SpDrawer @notify="onNotify" />

                    <template v-if="modal">
                        <SpSceneEditModal     v-if="modal.type === 'scene-edit'"        :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpSceneCategoryModal v-else-if="modal.type === 'scene-category'" :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpCategoryEditModal  v-else-if="modal.type === 'category-edit'" :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpSaveRenameModal    v-else-if="modal.type === 'save-rename'"   :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpSaveForkModal      v-else-if="modal.type === 'save-fork'"     @close="onCloseModal" @notify="onNotify" />
                        <SpSaveOverwriteModal v-else-if="modal.type === 'save-overwrite'" @close="onCloseModal" @notify="onNotify" />
                        <SpRerollModal        v-else-if="modal.type === 'reroll'"        :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpManualMessageModal v-else-if="modal.type === 'manual-message'" @close="onCloseModal" @notify="onNotify" />
                        <SpThemeNewModal      v-else-if="modal.type === 'theme-new'"     :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpThemeRenameModal   v-else-if="modal.type === 'theme-rename'"  :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpPickBubbleModal    v-else-if="modal.type === 'pick-bubble'"   :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpPaletteSaveModal   v-else-if="modal.type === 'palette-save'"  :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpRegexEditModal     v-else-if="modal.type === 'regex-edit'"    :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpClipEditModal      v-else-if="modal.type === 'clip-edit'"     :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpPickTheaterModal   v-else-if="modal.type === 'pick-theater'"  @close="onCloseModal" @notify="onNotify" />

                        <SpConfirmDeleteModal v-else-if="modal.type === 'confirm-delete-scene'"   kind="scene"   :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpConfirmDeleteModal v-else-if="modal.type === 'confirm-delete-save'"    kind="save"    :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpConfirmDeleteModal v-else-if="modal.type === 'confirm-delete-message'" kind="message" :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpConfirmDeleteModal v-else-if="modal.type === 'confirm-delete-theme'"   kind="theme"   :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpConfirmDeleteModal v-else-if="modal.type === 'confirm-delete-rule'"    kind="rule"    :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <SpConfirmDeleteModal v-else-if="modal.type === 'confirm-delete-clip'"    kind="clip"    :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                    </template>

                    <transition name="sp-toast">
                        <p v-if="toast" class="sp-toast" role="status">{{ toast }}</p>
                    </transition>
                </template>
            </div>
        `,
    };
}

export default createScenePlayRoot;
