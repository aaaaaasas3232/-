/**
 * 湛蓝回忆 · 根组件
 *
 * 职责:主题落地、舞台与面板的切换、弹窗分发、生命周期。
 *
 * ── 关于主题怎么落地 ──────────────────────────────────────────────
 *
 * 组件里**一个颜色都不写**。这里只做两件事:
 *
 *   1. 往 `.app-shell[data-app-id="galgame"]` 上写 `data-gg-theme="xxx"`,
 *      让 `_theme.css` 里对应那套 `--gg-*` 生效;用户自定义的那几项
 *      用 inline style 覆盖上去(优先级自然高于 CSS)。
 *   2. 把状态栏 / Home 条颜色**从 CSS 变量里读出来**转发给框架 ——
 *      框架画这些东西时只认 `appConfig` 上的字段,不认识 CSS 变量。
 *      不同步的话切到浅色主题时状态栏还是浅灰字,在白底上完全看不见
 *      (梦境编织那轮就是靠截图才发现的,AGENTS2 §11.9)。
 *
 * ── 关于 hydrate ──────────────────────────────────────────────────
 *
 * vue 模式下框架**不会**自动调 `app.methods.hydrate()`(AGENTS.md §47)——
 * template 模式那种「renderPage 同步阶段触发」的写法在这里不适用,
 * 因为 renderPage 返回的是组件配置,没有可调位置。所以必须在 `mounted` 里自己拉。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { MODAL_COMPONENTS } from './modals.js';
import { THEME_COMPONENTS } from './panel-theme.js';
import { ARCHIVE_PANELS } from './panel-archive.js';
import { GgPanelWorld } from './panel-world.js';
import { GgPanelMemory } from './panel-memory.js';
import { GgPanelPrompt } from './panel-prompt.js';
import { GgPanelScript } from './panel-script.js';
import { GgBranchTree } from './branch-tree.js';
import { GgStage } from './stage.js';
import { applyThemeVars } from '../theme.js';
import { PANELS } from '../constants.js';

export function createGalgameRoot() {
    return {
        name: 'GalgameRoot',
        components: {
            ...SHARED_COMPONENTS,
            ...MODAL_COMPONENTS,
            ...THEME_COMPONENTS,
            ...ARCHIVE_PANELS,
            GgPanelWorld, GgPanelMemory, GgPanelPrompt, GgPanelScript, GgBranchTree, GgStage,
        },
        props: {
            app: { type: Object, required: true },
        },
        data() {
            return { PANELS };
        },
        computed: {
            state() { return store.getState(); },
            ready() { return this.state.ready; },
            settings() { return store.getSettings(); },
            game() { return store.getGame(); },
            hasStory() { return this.state.nodes.length > 0; },
            panel() { return this.state.panel; },
            panelMeta() { return PANELS.find((p) => p.id === this.panel) || null; },
            modal() { return this.state.modal; },
            toast() { return this.state.toast; },
        },
        watch: {
            'settings.theme': { immediate: true, handler() { this.$nextTick(() => this.applyTheme()); } },
            'settings.customThemeColors': { deep: true, handler() { this.$nextTick(() => this.applyTheme()); } },
            toast(value) {
                if (!value) return;
                if (this._toastTimer) clearTimeout(this._toastTimer);
                this._toastTimer = setTimeout(() => { store.clearToast(); this._toastTimer = null; }, 2800);
                // 用户可能已经切到别的 App,「压缩完成 / 生成失败」这类值得穿透出去
                try { this.app?.toolkit?.island?.notify?.('info', '湛蓝回忆', String(value)); } catch (_) { /* 岛不可用不影响页内提示 */ }
            },
        },
        methods: {
            shellEl() {
                return this.$el?.closest?.('.app-shell') || document.querySelector('.app-shell[data-app-id="galgame"]');
            },
            applyTheme() {
                const shell = this.shellEl();
                if (!shell) return;
                shell.setAttribute('data-gg-theme', this.settings.theme || 'azure');
                applyThemeVars(shell, this.settings.customThemeColors || {});

                // ★ 从刚生效的 CSS 变量里读出来再转发给框架 —— CSS 仍是唯一真相,JS 只是搬运工
                const cs = getComputedStyle(shell);
                const read = (name) => cs.getPropertyValue(name).trim();
                const ink = read('--gg-text');
                const bg = read('--gg-stage-bg');
                const indicator = read('--gg-home-indicator');
                if (ink) this.app.statusBarColor = ink;
                if (bg) this.app.background = bg;
                if (indicator) this.app.homeIndicatorColor = indicator;
                // ★ 重赋 apps.value 强制框架 computed 重算（core-shim 约定的通知路径），
                //   否则底部指示条那 40px 的背景会停在旧主题色（AGENTS2 §18.2）
                if (window.__phoneAppsRef?.value) window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
            },

            onClosePanel() { store.setPanel(''); },
            onCloseModal() { store.closeModal(); },
            onNotify(message) { store.notify(message); },

            onNewGame() { store.openModal('new-game', {}); },
            /** 没有 API Key 的人从这条路进来:导一份写好的剧本,不调 AI 也能玩 */
            onOpenScript() { store.setPanel('script'); },
            async onStart() {
                const result = await store.generateNext({ kind: 'start' });
                if (!result.ok) store.notify(result.error);
            },
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
            <div class="gg-root">
                <GgSpinner v-if="!ready" label="正在唤醒…" />

                <template v-else>
                    <GgStage @notify="onNotify" />

                    <!-- 开局引导:没有任何剧情时压在舞台上 -->
                    <div v-if="!hasStory && !state.generating" class="gg-launcher">
                        <p class="gg-launcher-title">{{ game ? game.title : '湛蓝回忆' }}</p>
                        <p class="gg-launcher-sub">
                            {{ game ? '角色和世界观都备好了,按下面开始第一幕。' : '先建一局:挑一个世界观、一位玩家人设、几位出场角色。' }}
                        </p>
                        <GgButton v-if="game" variant="primary" size="lg" icon-name="play" @click="onStart">开始这个故事</GgButton>
                        <GgButton v-else variant="primary" size="lg" icon-name="plus" @click="onNewGame">新建一局</GgButton>
                        <GgButton size="sm" variant="quiet" icon-name="upload" @click="onOpenScript">导入一份写好的剧本</GgButton>
                    </div>

                    <!-- 面板 -->
                    <transition name="gg-panel">
                        <section v-if="panel" class="gg-panel" role="dialog" :aria-label="panelMeta ? panelMeta.label : ''">
                            <header class="gg-panel-head">
                                <GgIcon v-if="panelMeta" :name="panelMeta.icon" />
                                <h2 class="gg-panel-title">{{ panelMeta ? panelMeta.label : '' }}</h2>
                                <button type="button" class="gg-panel-close" aria-label="关闭" @click="onClosePanel">
                                    <GgIcon name="close" />
                                </button>
                            </header>

                            <GgBranchTree   v-if="panel === 'tree'"   @notify="onNotify" />
                            <GgPanelLog     v-else-if="panel === 'log'"    @notify="onNotify" />
                            <GgPanelPrompt  v-else-if="panel === 'prompt'" @notify="onNotify" />
                            <GgPanelMemory  v-else-if="panel === 'memory'" @notify="onNotify" />
                            <GgPanelCg      v-else-if="panel === 'cg'"     @notify="onNotify" />
                            <GgPanelSave    v-else-if="panel === 'save'"   @notify="onNotify" />
                            <GgPanelWorld   v-else-if="panel === 'world'"  @notify="onNotify" />
                            <GgPanelTheme   v-else-if="panel === 'theme'"  @notify="onNotify" />
                            <GgPanelScript  v-else-if="panel === 'script'" @notify="onNotify" />
                        </section>
                    </transition>

                    <!-- 弹窗 -->
                    <template v-if="modal">
                        <GgCustomPlotModal v-if="modal.type === 'custom-plot'" @close="onCloseModal" @notify="onNotify" />
                        <GgNoteModal v-else-if="modal.type === 'note-edit'" :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <GgPromptModal v-else-if="modal.type === 'prompt-edit'" :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                        <GgNewGameModal v-else-if="modal.type === 'new-game'" @close="onCloseModal" @notify="onNotify" />
                        <GgThemeSaveModal v-else-if="modal.type === 'theme-save'" :payload="modal.payload" @close="onCloseModal" @notify="onNotify" />
                    </template>

                    <!-- 提示 -->
                    <transition name="gg-toast">
                        <p v-if="toast" class="gg-toast" role="status">{{ toast }}</p>
                    </transition>
                </template>
            </div>
        `,
    };
}

export default createGalgameRoot;
