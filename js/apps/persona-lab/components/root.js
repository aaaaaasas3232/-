/**
 * 人设机 · 根组件
 *
 * 职责:路由(人设库 / 导入 / 工作台)、弹窗分发、生命周期、提示。
 *
 * ── 组件里一个颜色都不写 ──────────────────────────────────────────
 *
 * 这里唯一和颜色沾边的事,是把 `_theme.css` 里已经生效的几个变量**读出来**
 * 转发给框架 —— 状态栏 / Home 指示条是框架画的,它只认 `appConfig` 上的字段,
 * 不认识 CSS 变量。所以必须有这么一次搬运,但真相仍然在 CSS 里。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { MODAL_COMPONENTS } from './modals.js';
import { PlLibrary } from './library.js';
import { PlImport } from './import-panel.js';
import { PlWorkbench } from './workbench.js';
import { whenReady } from '../services/nook-bridge.js';
import { abortAll } from '../services/ai-service.js';
import { APP_ID } from '../constants.js';

const ROOT_TABS = [
    { id: 'library', label: '人设库', icon: 'library' },
    { id: 'import', label: '导入', icon: 'import' },
];

export function createPersonaLabRoot() {
    return {
        name: 'PersonaLabRoot',
        components: { ...SHARED_COMPONENTS, ...MODAL_COMPONENTS, PlLibrary, PlImport, PlWorkbench },
        props: {
            app: { type: Object, required: true },
        },
        data() {
            return { toast: '', rootTab: 'library', ROOT_TABS };
        },
        computed: {
            state() { return store.getState(); },
            ready() { return this.state.ready; },
            draft() { return store.getOpenDraft(); },
            inWorkbench() { return Boolean(this.draft); },
            modal() { return this.state.modal; },
        },
        methods: {
            notify(message) {
                if (!message) return;
                this.toast = String(message);
                if (this._toastTimer) clearTimeout(this._toastTimer);
                this._toastTimer = setTimeout(() => { this.toast = ''; this._toastTimer = null; }, 2800);
            },

            onOpen(draftId) {
                if (!store.openDraft(draftId)) this.notify('这份草稿打不开了，可能已被删除');
            },
            onCloseDraft() { store.closeDraft(); },
            closeModal() { store.closeModal(); },
            goImport() { this.rootTab = 'import'; },

            /**
             * 把主题色转发给框架。
             *
             * ★ 从 `getComputedStyle` 读,不在 JS 里另写一份 hex ——
             *   `_theme.css` 始终是颜色的唯一真相,这里只是个搬运工。
             */
            syncChrome() {
                const shell = this.$el?.closest?.('.app-shell')
                    || document.querySelector(`.app-shell[data-app-id="${APP_ID}"]`);
                if (!shell) return;
                const cs = getComputedStyle(shell);
                const read = (name) => cs.getPropertyValue(name).trim();
                const bg = read('--pl-bg');
                const ink = read('--pl-text');
                const indicator = read('--pl-home-indicator');
                if (bg) this.app.background = bg;
                if (ink) this.app.statusBarColor = ink;
                if (indicator) this.app.homeIndicatorColor = indicator;
                // ★ 重赋 apps.value 强制框架 computed 重算（core-shim 约定的通知路径），
                //   否则背景层 / home 指示条可能停在旧主题色（AGENTS2 §18.2）
                if (window.__phoneAppsRef?.value) window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
            },
        },
        mounted() {
            // vue 模式下 framework 不会自动调 hydrate,放 microtask 里让首帧先画出来
            Promise.resolve().then(() => store.hydrate(this.app));

            /**
             * 等 nook。
             *
             * 不阻塞首帧:人设库页在 `nookReady` 之前显示「正在连接 nook」,
             * 而不是一个空列表 —— 空列表会让用户以为自己的人设卡都没了。
             */
            void whenReady().then((ok) => {
                store.setNookReady(ok);
                if (!ok) this.notify('没连上 nook，人设卡列表暂时读不到');
            });

            this.syncChrome();

            // 页面隐藏 / 关闭前把防抖里挂着的写入落盘,否则最后一次修改会丢
            this._onHide = () => { void store.flushPersist(); };
            window.addEventListener('pagehide', this._onHide);
            document.addEventListener('visibilitychange', this._onHide);
        },
        beforeUnmount() {
            if (this._toastTimer) clearTimeout(this._toastTimer);
            window.removeEventListener('pagehide', this._onHide);
            document.removeEventListener('visibilitychange', this._onHide);
            // 组件都要卸载了,还挂着的请求没有接收方,直接掐掉
            abortAll();
            void store.flushPersist();
        },
        template: `
            <div class="pl-root">
                <PlSpinner v-if="!ready" label="正在打开人设机…" />

                <template v-else>
                    <PlWorkbench
                        v-if="inWorkbench"
                        :app="app"
                        :draft="draft"
                        @close="onCloseDraft"
                        @notify="notify"
                    />

                    <template v-else>
                        <main class="pl-page">
                            <PlLibrary
                                v-if="rootTab === 'library'"
                                :app="app"
                                @open="onOpen"
                                @notify="notify"
                                @go-import="goImport"
                            />
                            <PlImport
                                v-else
                                :app="app"
                                @open="onOpen"
                                @notify="notify"
                                @back="rootTab = 'library'"
                            />
                        </main>

                        <nav class="pl-tabbar" role="tablist">
                            <button
                                v-for="tab in ROOT_TABS"
                                :key="tab.id"
                                type="button"
                                class="pl-tabbar-item"
                                :class="{ 'is-active': rootTab === tab.id }"
                                role="tab"
                                :aria-selected="String(rootTab === tab.id)"
                                @click="rootTab = tab.id"
                            >
                                <PlIcon :name="tab.icon" />
                                <span>{{ tab.label }}</span>
                            </button>
                        </nav>
                    </template>
                </template>

                <template v-if="modal">
                    <PlConfirmModal
                        v-if="modal.type === 'confirm'"
                        :payload="modal.payload"
                        @close="closeModal"
                    />
                </template>

                <transition name="pl-toast">
                    <p v-if="toast" class="pl-toast" role="status">{{ toast }}</p>
                </transition>
            </div>
        `,
    };
}

export default createPersonaLabRoot;
