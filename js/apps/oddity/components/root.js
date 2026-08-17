/**
 * 小奇怪 · 根组件
 *
 * 职责:主题落地、四个 tab 与其下小东西的切换、弹窗分发、生命周期。
 *
 * ── 布局 ──────────────────────────────────────────────────────────
 *
 *   顶栏      当前 tab 的名字 + 这个 tab 下的小东西切换 chip + 主题键
 *   舞台      当前选中的那个小东西(每个都是独立组件)
 *   底栏      自绘的四个 tab(components/tab-bar.js)
 *
 * ★ 沉浸项(沙漏 / 开屏艺术字)进去之后顶栏收成一条细浮条 ——
 *   这两个是「看着玩」的,顶栏那一整块会把气氛压掉。
 *   但**底栏永远留着**:顶栏可以收,导航不能收,否则用户只能靠划出去退出。
 *
 * ── 关于 hydrate ──────────────────────────────────────────────────
 *
 * vue 模式框架**不会**自动调 `app.methods.hydrate()`(AGENTS.md §2.2)。
 * renderPage 返回的是组件配置,没有可调位置,所以必须在 `mounted` 里自己拉。
 */

import * as store from '../store.js';
import { TABS, TAB_ITEMS } from '../constants.js';
import { THEMES, applyTheme, findShell } from '../theme.js';
import { SHARED_COMPONENTS } from './shared.js';
import { OqTabBar } from './tab-bar.js';
import { OqGameMinesweeper } from './game-minesweeper.js';
import { OqGameGomoku } from './game-gomoku.js';
import { OqGameHaveyou } from './game-haveyou.js';
import { OqPromptLib, OqScoreboard } from './game-common.js';
import { OqToyJellyHeart } from './toy-jelly-heart.js';
import { OqViewHourglass } from './view-hourglass.js';
import { OqViewTypewriter } from './view-typewriter.js';
import { OqViewAskbox } from './view-askbox.js';
import { OqViewLetterbox } from './view-letterbox.js';
import { OqViewBottle } from './view-bottle.js';
import { OqViewFavorites } from './view-favorites.js';

/** 小东西 id → 组件名。加新玩意儿时这里和 constants.TAB_ITEMS 一起改。 */
const ITEM_COMPONENTS = Object.freeze({
    minesweeper: OqGameMinesweeper,
    gomoku: OqGameGomoku,
    haveyou: OqGameHaveyou,
    jelly: OqToyJellyHeart,
    hourglass: OqViewHourglass,
    typewriter: OqViewTypewriter,
    askbox: OqViewAskbox,
    letterbox: OqViewLetterbox,
    bottle: OqViewBottle,
    favorites: OqViewFavorites,
});

/** 这几个组件要拿 app(要落盘 / 要调 AI);其余的纯前端,不给 */
const ITEMS_NEEDING_APP = Object.freeze(Object.keys(ITEM_COMPONENTS));

export function createOddityRoot() {
    return {
        name: 'OddityRoot',
        components: {
            ...SHARED_COMPONENTS,
            OqTabBar,
            OqPromptLib,
            OqScoreboard,
            OqGameMinesweeper,
            OqGameGomoku,
            OqGameHaveyou,
            OqToyJellyHeart,
            OqViewHourglass,
            OqViewTypewriter,
            OqViewAskbox,
            OqViewLetterbox,
            OqViewBottle,
            OqViewFavorites,
        },
        props: {
            app: { type: Object, required: true },
        },
        data() {
            return {
                tabs: TABS,
                themes: THEMES,
            };
        },
        computed: {
            state() { return store.getState(); },
            ready() { return this.state.ready; },
            settings() { return store.getSettings(); },
            tab() { return this.state.tab; },
            tabMeta() { return TABS.find((t) => t.id === this.tab) || TABS[0]; },
            items() { return TAB_ITEMS[this.tab] || []; },
            itemId() { return store.currentItemId(); },
            itemMeta() { return store.currentItemMeta(); },
            /** 当前这个小东西用哪个组件渲染 */
            itemComponent() { return ITEM_COMPONENTS[this.itemId] || ''; },
            /** 只有需要落盘 / 调 AI 的才把 app 传下去 */
            itemProps() {
                return ITEMS_NEEDING_APP.includes(this.itemId) ? { app: this.app } : {};
            },
            immersive() { return this.itemMeta?.immersive === true; },
            /** 这个小东西有没有工具抽屉。没有就不挂那个键,免得点开是空面板 */
            hasTools() { return this.itemMeta?.tools === true; },
            panelOpen() { return this.state.panel === 'tools'; },
            /** 细浮条上「换一个小东西」的浮层开着没有 */
            switching() { return this.state.panel === 'switch'; },
            modal() { return this.state.modal; },
            toast() { return this.state.toast; },
        },
        watch: {
            'settings.theme': {
                immediate: true,
                handler() { this.$nextTick(() => this.syncTheme()); },
            },
            toast(value) {
                if (!value) return;
                if (this._toastTimer) clearTimeout(this._toastTimer);
                this._toastTimer = setTimeout(() => {
                    store.clearToast();
                    this._toastTimer = null;
                }, 2600);
            },
        },
        methods: {
            syncTheme() {
                applyTheme(findShell(this.$el), this.settings.theme, this.app);
            },
            onTab(tabId) {
                store.setTab(tabId);
            },
            onItem(itemId) {
                store.setSubTab(this.tab, itemId);
            },
            /**
             * 量一下触发键落在哪儿,把小浮窗的落点写进 `--oq-pop-top`。
             *
             * ★ 为什么要量:「捏」是整块顶栏,「看」是一条细浮条,两者底边差着
             *   四五十像素。CSS 里写死一个偏移量,必然有一页是错的。
             * ★ 写在 `.oq-root` 上而不是 store 里 —— 这是纯视觉的一个坐标,
             *   不该进状态、不该落盘,更不该触发重渲染。
             */
            anchorPop(trigger) {
                const root = this.$el;
                if (!root?.getBoundingClientRect || !trigger?.getBoundingClientRect) return;
                const gap = 8;
                const top = trigger.getBoundingClientRect().bottom - root.getBoundingClientRect().top;
                root.style.setProperty('--oq-pop-top', `${Math.max(0, Math.round(top + gap))}px`);
            },
            onToggleTools(event) {
                this.anchorPop(event?.currentTarget);
                store.togglePanel('tools');
            },
            onToggleSwitch(event) {
                this.anchorPop(event?.currentTarget);
                store.togglePanel('switch');
            },
            /** 点浮层空白处收起。★ 不能复用 onToggleSwitch —— 那会拿浮层本身
             *  当触发键去量位置,把落点写成一个离谱的值留给下一次。 */
            onCloseSwitch() {
                store.closePanel();
            },
            onPickItem(itemId) {
                store.setSubTab(this.tab, itemId);   // 顺带把面板收掉(见 store.setSubTab)
            },
            onNotify(message) {
                if (!message) return;
                store.notify(String(message));
            },
            onOpenTheme() {
                store.openModal('theme', {});
            },
            onOpenPromptLib() {
                store.openModal('prompt-lib', {});
            },
            onOpenScoreboard() {
                void store.refreshScores('');
                store.openModal('scoreboard', {});
            },
            onPickTheme(themeId) {
                store.setTheme(themeId);
                store.closeModal();
            },
            onCloseModal() {
                store.closeModal();
            },
        },
        mounted() {
            // 放 microtask 里:让首帧先画出来,再去拉 IndexedDB
            Promise.resolve().then(() => store.hydrate(this.app));
            this.syncTheme();

            // 切到别的 App / 息屏时,把防抖里还没落的写掉
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
            <div class="oq-root" :class="{ 'is-immersive': immersive }">
                <OqSpinner v-if="!ready" label="正在翻箱子…" />

                <template v-else>
                    <!-- 顶栏:普通形态 -->
                    <header v-if="!immersive" key="normal-topbar" class="oq-topbar">
                        <div class="oq-topbar-line">
                            <div class="oq-topbar-title">
                                <span class="oq-topbar-name">{{ tabMeta.label }}</span>
                                <span class="oq-topbar-desc">{{ tabMeta.desc }}</span>
                            </div>
                            <div class="oq-topbar-acts">
                                <button
                                    v-if="tab === 'play'"
                                    type="button"
                                    class="oq-topbar-act"
                                    aria-label="提示词库"
                                    @click="onOpenPromptLib"
                                ><OqIcon name="book" /></button>
                                <button
                                    v-if="tab === 'play'"
                                    type="button"
                                    class="oq-topbar-act"
                                    aria-label="游戏数据概要"
                                    @click="onOpenScoreboard"
                                ><OqIcon name="trophy" /></button>
                                <button
                                    v-if="hasTools"
                                    type="button"
                                    class="oq-topbar-act"
                                    :class="{ 'is-active': panelOpen }"
                                    aria-label="工具"
                                    @click="onToggleTools"
                                ><OqIcon name="settings" /></button>
                                <button
                                    type="button"
                                    class="oq-topbar-theme"
                                    aria-label="换个配色"
                                    @click="onOpenTheme"
                                >
                                    <span class="oq-theme-dot"></span>
                                </button>
                            </div>
                        </div>

                        <!-- 这个 tab 下面有哪些小东西 -->
                        <div v-if="items.length > 1" class="oq-chiprow" role="tablist">
                            <button
                                v-for="item in items"
                                :key="item.id"
                                type="button"
                                class="oq-chip"
                                :class="{ 'is-active': item.id === itemId }"
                                role="tab"
                                :aria-selected="String(item.id === itemId)"
                                @click="onItem(item.id)"
                            >{{ item.label }}</button>
                        </div>
                        <p v-if="itemMeta" class="oq-topbar-sub">{{ itemMeta.sub }}</p>
                    </header>

                    <!--
                        顶栏:沉浸形态,收成一条细浮条。

                        ★ 「看」下面五个小东西**全部**走这一条。以前只有沙漏是沉浸的,
                          切到打字机就变回一整块顶栏 + chip 行,同一个 tab 里两套顶栏,
                          每切一次整页上下跳一次。
                        ★ 这条浮条现在是这些页面**唯一**的控制面:
                          名字点开是换页,圆点是直接跳,右边那个键开当前页的工具抽屉。
                          各页面底部不再挂常驻工具条(它们会和自绘底栏叠在一起)。
                    -->
                    <div v-else key="slimbar-topbar" class="oq-slimbar" :class="{ 'is-open': switching }">
                        <button
                            type="button"
                            class="oq-slimbar-name"
                            :aria-expanded="String(switching)"
                            @click="onToggleSwitch"
                        >
                            <span>{{ itemMeta ? itemMeta.label : '' }}</span>
                            <i class="oq-slimbar-caret" aria-hidden="true"></i>
                        </button>

                        <div v-if="items.length > 1" class="oq-slimbar-switch">
                            <button
                                v-for="item in items"
                                :key="item.id"
                                type="button"
                                class="oq-slimbar-dot"
                                :class="{ 'is-active': item.id === itemId }"
                                :aria-label="item.label"
                                @click="onItem(item.id)"
                            ></button>
                        </div>

                        <button
                            v-if="hasTools"
                            type="button"
                            class="oq-slimbar-tool"
                            :class="{ 'is-active': panelOpen }"
                            aria-label="工具"
                            @click="onToggleTools"
                        ><i></i><i></i><i></i></button>
                    </div>

                    <!-- 换一个小东西:细浮条下面掉出来的小列表 -->
                    <div v-if="immersive && switching" class="oq-slimmenu-layer" @click.self="onCloseSwitch">
                        <div class="oq-slimmenu">
                            <button
                                v-for="item in items"
                                :key="item.id"
                                type="button"
                                class="oq-slimmenu-item"
                                :class="{ 'is-active': item.id === itemId }"
                                @click="onPickItem(item.id)"
                            >
                                <span class="oq-slimmenu-name">{{ item.label }}</span>
                                <span class="oq-slimmenu-sub">{{ item.sub }}</span>
                            </button>
                        </div>
                    </div>

                    <!-- 舞台 -->
                    <main class="oq-stage">
                        <OqGameMinesweeper
                            v-if="itemId === 'minesweeper'"
                            key="minesweeper"
                            :app="app"
                            @notify="onNotify"
                        />
                        <OqGameGomoku
                            v-else-if="itemId === 'gomoku'"
                            key="gomoku"
                            :app="app"
                            @notify="onNotify"
                        />
                        <OqGameHaveyou
                            v-else-if="itemId === 'haveyou'"
                            key="haveyou"
                            :app="app"
                            @notify="onNotify"
                        />
                        <OqToyJellyHeart
                            v-else-if="itemId === 'jelly'"
                            key="jelly"
                            :app="app"
                            @notify="onNotify"
                        />
                        <OqViewHourglass
                            v-else-if="itemId === 'hourglass'"
                            key="hourglass"
                            :app="app"
                            @notify="onNotify"
                        />
                        <OqViewTypewriter
                            v-else-if="itemId === 'typewriter'"
                            key="typewriter"
                            :app="app"
                            @notify="onNotify"
                        />
                        <OqViewAskbox
                            v-else-if="itemId === 'askbox'"
                            key="askbox"
                            :app="app"
                            @notify="onNotify"
                        />
                        <OqViewLetterbox
                            v-else-if="itemId === 'letterbox'"
                            key="letterbox"
                            :app="app"
                            @notify="onNotify"
                        />
                        <OqViewBottle
                            v-else-if="itemId === 'bottle'"
                            key="bottle"
                            :app="app"
                            @notify="onNotify"
                        />
                        <OqViewFavorites
                            v-else-if="itemId === 'favorites'"
                            key="favorites"
                            :app="app"
                            @notify="onNotify"
                        />
                        <OqEmpty v-else text="这里还空着" hint="换个 tab 看看" />
                    </main>

                    <OqTabBar :tabs="tabs" :active-id="tab" @select="onTab" />

                    <!-- 提示词库 / 游戏数据概要 -->
                    <OqPromptLib
                        v-if="modal && modal.type === 'prompt-lib'"
                        @close="onCloseModal"
                        @notify="onNotify"
                    />
                    <OqScoreboard
                        v-if="modal && modal.type === 'scoreboard'"
                        @close="onCloseModal"
                    />

                    <!-- 配色 -->
                    <OqModal
                        v-if="modal && modal.type === 'theme'"
                        title="换个配色"
                        subtitle="整个小奇怪一起换"
                        @close="onCloseModal"
                    >
                        <div class="oq-themelist">
                            <button
                                v-for="theme in themes"
                                :key="theme.id"
                                type="button"
                                class="oq-themerow"
                                :class="{ 'is-active': theme.id === settings.theme }"
                                :data-theme="theme.id"
                                @click="onPickTheme(theme.id)"
                            >
                                <span class="oq-themerow-swatch"></span>
                                <span class="oq-themerow-text">
                                    <span class="oq-themerow-name">{{ theme.label }}</span>
                                    <span class="oq-themerow-desc">{{ theme.desc }}</span>
                                </span>
                            </button>
                        </div>
                    </OqModal>

                    <!-- 提示 -->
                    <p v-if="toast" class="oq-toast" role="status">{{ toast }}</p>
                </template>
            </div>
        `,
    };
}

export default createOddityRoot;
