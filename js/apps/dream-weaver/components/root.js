/**
 * 梦境编织 · 根组件
 *
 * 职责:路由(书架 / 我的 / 编辑器)、弹窗与抽屉分发、主题与排版应用、生命周期。
 *
 * ── 关于主题怎么落地 ──────────────────────────────────────────────
 *
 * 组件里**一个颜色都不写**。这里做的只有两件事:
 *
 *   1. 往 `.app-shell[data-app-id="dream-weaver"]` 上写 `data-dw-theme="xxx"`,
 *      让 `_theme.css` 里对应那套 `--dw-*` 生效。
 *   2. 把「排版类」显示设置(字号/行距/字距/缩进/自定义字体)写成 CSS 变量。
 *      这些值来自用户拖滑块,编译期不可能知道,是 JS 写 style 的**唯一合法场景**。
 *
 * 原版是每次切主题就把几十个 `element.style.xxx` 重刷一遍
 * (`applyCSSVariables` + `refreshUI` + `forceReaderFontRepaint`,三个函数互相调),
 * 而那 694 处硬编码 hex 根本不受影响 —— 换主题只换了个寂寞。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { MODAL_COMPONENTS } from './modals.js';
import { GENERATE_MODAL_COMPONENTS } from './modals-generate.js';
import { THEME_MODAL_COMPONENTS } from './modals-theme.js';
import { TIMELINE_MODAL_COMPONENTS } from './modals-timeline.js';
import { FINALE_MODAL_COMPONENTS } from './modals-finale.js';
import { CHAPTER_INFO_MODAL_COMPONENTS } from './modals-chapter-info.js';
import { applyThemeVars } from '../theme.js';
import { DwShelf } from './shelf.js';
import { DwProfile } from './profile.js';
import { DwEditor } from './editor/index.js';
import { DwSheets } from './sheets.js';
import { DwInspirationPage } from './pages/inspiration-page.js';
import { DwIfLinePage } from './pages/ifline-page.js';
import { TABS } from '../constants.js';

export function createDreamWeaverRoot() {
    return {
        name: 'DreamWeaverRoot',
        components: {
            ...SHARED_COMPONENTS,
            ...MODAL_COMPONENTS,
            ...GENERATE_MODAL_COMPONENTS,
            ...THEME_MODAL_COMPONENTS,
            ...TIMELINE_MODAL_COMPONENTS,
            ...FINALE_MODAL_COMPONENTS,
            ...CHAPTER_INFO_MODAL_COMPONENTS,
            DwShelf, DwProfile, DwEditor, DwSheets,
            DwInspirationPage, DwIfLinePage,
        },
        props: {
            app: { type: Object, required: true },
        },
        data() {
            return { toast: '', TABS };
        },
        computed: {
            state() { return store.getState(); },
            ready() { return this.state.ready; },
            activeTab() { return this.state.activeTab; },
            inEditor() { return Boolean(this.state.openBookId); },
            modal() { return this.state.modal; },
            page() { return this.state.page; },
            settings() { return this.state.library.settings; },
            display() { return this.state.library.settings.displaySettings; },

            /** 排版变量 —— 直接绑到根节点的 style 上,阅读区的 CSS 读它们 */
            typographyStyle() {
                const d = this.display;
                return {
                    '--dw-reader-size': `${d.fontSize}px`,
                    '--dw-reader-line': String(d.lineHeight),
                    '--dw-reader-letter': `${d.letterSpacing}px`,
                    '--dw-reader-indent': d.paragraphIndent ? '2em' : '0',
                    '--dw-reader-font': this.settings.customFont ? `"${this.settings.customFont.name}", inherit` : 'inherit',
                    ...this.backgroundStyle,
                };
            },

            /**
             * 聊天背景。
             *
             * 原版是遍历 `#chat-container` / `.dw-chat-container` / `#editor-content`
             * 逐个写 inline style(`applyCustomBackground` 5893)。这里改成往根节点写三个变量,
             * 由 `_editor.css` 里 `.dw-chat-container` 的一条规则消费 ——
             * 好处是不用在每次重画后重新 apply 一遍(原版为此在 openChapterEditor 里挂了个 100ms 定时器)。
             *
             * 深色主题遮罩用黑、浅色用白 —— 和原版的 `isDark` 判断一致。
             */
            backgroundStyle() {
                const bg = store.getEffectiveBackground(this.state.openBookId);
                if (!bg) return { '--dw-chat-bg': 'transparent', '--dw-chat-blur': '0px' };

                const dark = (this.settings.theme || 'retro-dark') !== 'oriental-light';
                const overlay = dark ? '0, 0, 0' : '255, 255, 255';

                if (bg.type === 'image' && bg.imageUrl) {
                    // opacity 是「图片清晰度」,越大遮罩越淡 —— 和原版 (1 - opacity/100) 一致
                    const mask = 1 - (Number(bg.opacity) || 30) / 100;
                    return {
                        '--dw-chat-bg': `linear-gradient(rgba(${overlay},${mask}), rgba(${overlay},${mask})), url("${bg.imageUrl}")`,
                        '--dw-chat-blur': '0px',
                    };
                }
                if (bg.type === 'glass') {
                    const alpha = Number(bg.glassOpacity) || 0.1;
                    return {
                        '--dw-chat-bg': `rgba(${overlay}, ${alpha})`,
                        '--dw-chat-blur': `${Number(bg.glassBlur) || 10}px`,
                    };
                }
                return { '--dw-chat-bg': bg.color || 'transparent', '--dw-chat-blur': '0px' };
            },
        },
        watch: {
            'settings.theme': {
                immediate: true,
                handler() { this.$nextTick(() => this.applyTheme()); },
            },
            'settings.customFont': {
                immediate: true,
                handler() { this.$nextTick(() => this.applyFont()); },
            },
        },
        methods: {
            // ── 主题 / 字体 ────────────────────
            shellEl() {
                return this.$el?.closest?.('.app-shell') || document.querySelector('.app-shell[data-app-id="dream-weaver"]');
            },
            applyTheme() {
                const shell = this.shellEl();
                if (!shell) return;
                shell.setAttribute('data-dw-theme', this.settings.theme || 'retro-dark');

                // 自定义主题 = 在内置那套之上覆盖若干变量。写在 shell 的 inline style 上,
                // 优先级自然高于 `_theme.css`。改回内置主题时会把这些变量逐个 remove。
                applyThemeVars(shell, this.settings.customThemeColors || {});

                /**
                 * 状态栏 / Home 条 / 窗口底色是**框架**画的,它读的是 `appConfig` 上的字段,
                 * 不认识我们的 CSS 变量。换到浅色主题时如果不同步,状态栏还是浅灰字,
                 * 在白底上完全看不见。
                 *
                 * ★ 但这里也不写死颜色 —— 从刚生效的 CSS 变量里**读出来**再转发给框架。
                 *   `_theme.css` 仍然是颜色的唯一真相,JS 只是个搬运工。
                 *   (setAttribute 是同步的,getComputedStyle 会强制样式重算,读得到新值。)
                 */
                const cs = getComputedStyle(shell);
                const read = (name) => cs.getPropertyValue(name).trim();
                const ink = read('--dw-text');
                const bg = read('--dw-bg');
                const indicator = read('--dw-home-indicator');
                if (ink) this.app.statusBarColor = ink;
                if (bg) this.app.background = bg;
                if (indicator) this.app.homeIndicatorColor = indicator;
                // ★ 重赋 apps.value 强制框架 computed 重算（core-shim 约定的通知路径），
                //   否则背景层 / home 指示条可能停在旧主题色（AGENTS2 §18.2）
                if (window.__phoneAppsRef?.value) window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
            },
            /**
             * 注入 @font-face。
             *
             * style 标签复用同一个 id —— 原版每次导入字体都 append 一个新的 style,
             * 换十次字体页面里就躺着十份 base64 字体数据。
             */
            applyFont() {
                const font = this.settings.customFont;
                const id = 'dw-custom-font';
                let tag = document.getElementById(id);
                if (!font?.data) {
                    tag?.remove();
                    return;
                }
                if (!tag) {
                    tag = document.createElement('style');
                    tag.id = id;
                    document.head.appendChild(tag);
                }
                // 字体名来自文件名,可能含引号 —— 转义掉,否则会破坏 CSS 语法
                const safeName = String(font.name).replace(/["\\]/g, '');
                tag.textContent = `@font-face{font-family:"${safeName}";src:url("${font.data}");font-display:swap;}`;
            },

            // ── 路由 ──────────────────────────
            onTab(tabId) { store.setTab(tabId); },
            async onOpenBook(bookId) {
                const ok = await store.openBook(bookId);
                if (!ok) this.notify('这本书打不开了,可能已被删除');
            },
            onCloseBook() { store.closeBook(); },

            // ── 弹窗分发 ──────────────────────
            closeModal() { store.closeModal(); },
            closePage() { store.closePage(); },

            // ── 提示 ──────────────────────────
            notify(message) {
                if (!message) return;
                this.toast = String(message);
                if (this._toastTimer) clearTimeout(this._toastTimer);
                this._toastTimer = setTimeout(() => { this.toast = ''; this._toastTimer = null; }, 2600);

                // 顺带发一条灵动岛通知:用户可能已经切到别的 App,生成完成这类消息值得穿透出去
                try {
                    this.app?.toolkit?.island?.notify?.('info', '梦境编织', String(message));
                } catch (_) { /* 岛不可用不影响页内提示 */ }
            },
        },
        mounted() {
            // vue 模式 framework 不会自动调 hydrate(见 framework-指导方案 §1.3),
            // 放 microtask 里让首帧先画出来再拉数据
            Promise.resolve().then(() => store.hydrate(this.app));
            this.applyTheme();
            this.applyFont();

            // 页面隐藏 / 关闭前把防抖里挂着的写入落盘
            this._onHide = () => { void store.flushPersist(); };
            window.addEventListener('pagehide', this._onHide);
            document.addEventListener('visibilitychange', this._onHide);

            /**
             * 工具面板选完生成器类型后派发这个事件。
             *
             * 为什么走事件而不是层层 emit:触发点在
             * 「编辑器 → 工具面板 → 底部抽屉」三层里面,而结果弹窗挂在根组件上。
             * 一路 emit 上来要穿三层,每层都得加一个只为转发存在的 handler。
             *
             * ⚠️ 但这条链**必须有人接** —— 派发了没人监听是本项目最典型的
             * 「点了没反应」静默失败(AGENTS2 §6 第 2 条)。这个 listener 就是接收端。
             */
            this._onGenerator = (event) => {
                const { group, item } = event.detail || {};
                if (!group || !item) return;
                store.openModal('generate', { group, item });
            };
        window.addEventListener('dream-weaver:run-generator', this._onGenerator);

        /**
         * IF 线工作台。触发点散在工具面板、底部抽屉、编辑器更多操作里，
         * 落点是这里的全屏页 —— 监听必须挂在根组件上：
         * 挂在编辑器上的话，人在书架页时这个事件没人接，点了没反应。
         */
        this._onOpenIfLine = () => {
            store.setDrawer(null);
            store.openPage('ifline', { bookId: store.getState().openBookId });
        };
        window.addEventListener('dream-weaver:open-ifline', this._onOpenIfLine);
    },
    beforeUnmount() {
        if (this._toastTimer) clearTimeout(this._toastTimer);
        window.removeEventListener('pagehide', this._onHide);
        document.removeEventListener('visibilitychange', this._onHide);
        window.removeEventListener('dream-weaver:run-generator', this._onGenerator);
        window.removeEventListener('dream-weaver:open-ifline', this._onOpenIfLine);
            void store.flushPersist();
        },
        template: `
            <div class="dw-root" :style="typographyStyle">
                <DwSpinner v-if="!ready" label="正在唤醒…" />

                <template v-else>
                    <!-- 编辑器占满整屏,没有底部 tab -->
                    <DwEditor
                        v-if="inEditor"
                        :app="app"
                        @close="onCloseBook"
                        @notify="notify"
                    />

                    <template v-else>
                        <main class="dw-page">
                            <DwShelf v-if="activeTab === 'shelf'" :app="app" @open-book="onOpenBook" />
                            <DwProfile v-else :app="app" @notify="notify" />
                        </main>

                        <nav class="dw-tabbar" role="tablist">
                            <button
                                v-for="tab in TABS"
                                :key="tab.id"
                                type="button"
                                class="dw-tabbar-item"
                                :class="{ 'is-active': activeTab === tab.id }"
                                role="tab"
                                :aria-selected="String(activeTab === tab.id)"
                                @click="onTab(tab.id)"
                            >
                                <DwIcon :name="tab.icon" />
                                <span class="dw-tabbar-label">{{ tab.label }}</span>
                            </button>
                        </nav>
                    </template>
                </template>

                <!-- 全屏子页面：盖在书架/编辑器之上，自己带返回栏 -->
                <template v-if="page">
                    <DwInspirationPage v-if="page.type === 'inspirations'" :app="app" :payload="page.payload" @close="closePage" @notify="notify" />
                    <DwIfLinePage v-else-if="page.type === 'ifline'" :app="app" :payload="page.payload" @close="closePage" @notify="notify" />
                </template>

                <!-- 底部抽屉(菜单类) -->
                <DwSheets :app="app" @notify="notify" />

                <!-- 弹窗 -->
                <template v-if="modal">
                    <DwConfirmModal v-if="modal.type === 'confirm'" :payload="modal.payload" @close="closeModal" />
                    <DwRenameModal v-else-if="modal.type === 'rename'" :payload="modal.payload" @close="closeModal" />
                    <DwBookModal v-else-if="modal.type === 'book-edit'" :payload="modal.payload" @close="closeModal" />
                    <DwEditMessageModal v-else-if="modal.type === 'edit-message'" :payload="modal.payload" @close="closeModal" />
                    <DwRewriteSelectionModal v-else-if="modal.type === 'rewrite-selection'" :payload="modal.payload" @close="closeModal" />
                    <DwCharacterModal v-else-if="modal.type === 'character-edit'" :payload="modal.payload" @close="closeModal" />
                    <DwLocationModal v-else-if="modal.type === 'location-edit'" :payload="modal.payload" @close="closeModal" />
                    <DwMarkListModal v-else-if="modal.type === 'characters'" kind="characters" :payload="modal.payload" @close="closeModal" />
                    <DwMarkListModal v-else-if="modal.type === 'locations'" kind="locations" :payload="modal.payload" @close="closeModal" />
                    <DwChapterSettingsModal v-else-if="modal.type === 'chapter-settings'" :payload="modal.payload" @close="closeModal" />
                    <DwTimelineEventModal v-else-if="modal.type === 'timeline-event'" :payload="modal.payload" @close="closeModal" />
                    <DwInputModesModal v-else-if="modal.type === 'input-modes'" :payload="modal.payload" @close="closeModal" @notify="notify" />
                    <DwRegexModal v-else-if="modal.type === 'regex-rules'" :payload="modal.payload" @close="closeModal" />
                    <DwLibraryListModal v-else-if="modal.type === 'collected'" kind="collected" :payload="modal.payload" @close="closeModal" @notify="notify" />
                    <DwLibraryListModal v-else-if="modal.type === 'scenes'" kind="scenes" :payload="modal.payload" @close="closeModal" @notify="notify" />
                    <DwLibraryListModal v-else-if="modal.type === 'generated-history'" kind="generated" :payload="modal.payload" @close="closeModal" @notify="notify" />
                    <DwGenerationPromptsModal v-else-if="modal.type === 'generation-prompts'" :payload="modal.payload" @close="closeModal" />
                    <DwCustomPromptsModal v-else-if="modal.type === 'custom-prompts'" :payload="modal.payload" @close="closeModal" />
                    <DwDisplaySettingsModal v-else-if="modal.type === 'display-settings'" :payload="modal.payload" @close="closeModal" />
                    <DwBranchManagerModal v-else-if="modal.type === 'branch-manager'" :payload="modal.payload" @close="closeModal" @notify="notify" />
                    <DwTokensModal v-else-if="modal.type === 'tokens'" :payload="modal.payload" @close="closeModal" />
                    <DwFontModal v-else-if="modal.type === 'font-import'" :payload="modal.payload" @close="closeModal" />
                    <DwPickCharacterModal v-else-if="modal.type === 'pick-character'" :payload="modal.payload" @close="closeModal" />
                    <DwGenerateModal v-else-if="modal.type === 'generate'" :payload="modal.payload" @close="closeModal" @notify="notify" />
                    <DwThemeModal v-else-if="modal.type === 'theme'" :payload="modal.payload" @close="closeModal" @notify="notify" />
                    <DwWorldTimelineModal v-else-if="modal.type === 'world-timeline'" :payload="modal.payload" @close="closeModal" @notify="notify" />
                    <DwFinaleModal v-else-if="modal.type === 'finale'" :payload="modal.payload" @close="closeModal" @notify="notify" />
                    <DwChapterInfoModal v-else-if="modal.type === 'chapter-info'" :payload="modal.payload" @close="closeModal" @notify="notify" />
                    <DwBackgroundModal v-else-if="modal.type === 'background'" :payload="modal.payload" @close="closeModal" @notify="notify" />
                </template>

                <!-- 提示 -->
                <transition name="dw-toast">
                    <p v-if="toast" class="dw-toast" role="status">{{ toast }}</p>
                </transition>
            </div>
        `,
    };
}

export default createDreamWeaverRoot;
