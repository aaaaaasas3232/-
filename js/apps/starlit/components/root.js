/**
 * 点灯 · 根组件
 *
 * 负责五件事：
 *   1. mounted 时 hydrate（vue 模式框架不会替你调）
 *   2. 把「往 shell 写主题变量」的能力交给 store
 *   3. 主题变了，把状态栏 / 背景 / Home 条颜色从 CSS 读出来转发给框架
 *      （框架不认 CSS 变量，只认静态字段）
 *   4. 路由：拦截页 / 五个 tab / 一串覆盖页
 *   5. 卸载时把待落盘的东西刷掉，并保存推理墙视口
 *
 * 悬浮播放（弹幕 / 灵动岛 / 小电视）**不在这棵树里** ——
 * 它们画在 App 外面，由 services/ticker.js 独立管理，
 * 所以用户退出点灯之后它们照样在。
 */

import * as store from '../store.js';
import { TABS } from '../constants.js';
import { icon } from '../icons.js';
import { applyThemeVars, resolveThemeColors } from '../theme.js';
import { UI } from './ui.js';
import { PAGES } from './pages.js';
import { SlSurveyPage } from './survey-page.js';
import { SlLessonPage } from './lesson-page.js';
import { SlFlipPage } from './flip-page.js';
import { SlWallPage } from './wall-page.js';
import { SlDictPage, SlTickerPanel } from './dict-page.js';
import { SlThemePanel } from './theme-panel.js';
import { SlModals } from './modals.js';
import { SlCardDetail } from './cards.js';
import { SlMemeOverlay } from './meme-overlay.js';
import { usageLabel } from '../services/card-library.js';

const SlTabBar = {
    name: 'SlTabBar',
    props: {
        active: { type: String, required: true },
        dueCount: { type: Number, default: 0 },
        cardCount: { type: Number, default: 0 },
    },
    emits: ['pick'],
    computed: {
        tabs() { return TABS; },
    },
    methods: {
        iconOf(name) { return icon(name, { size: 20 }); },
        badge(id) {
            if (id === 'dict') return this.dueCount;
            if (id === 'wall') return 0;
            return 0;
        },
    },
    template: `
        <nav class="sl-tabbar">
            <button
                v-for="t in tabs" :key="t.id"
                type="button" class="sl-tabbar__item" :class="{ 'is-on': t.id === active }"
                @click="$emit('pick', t.id)"
            >
                <span class="sl-tabbar__icon" v-html="iconOf(t.icon)"></span>
                <span class="sl-tabbar__label">{{ t.label }}</span>
                <i v-if="badge(t.id)" class="sl-tabbar__dot"></i>
            </button>
        </nav>
    `,
};

export function createStarlitRoot() {
    return {
        name: 'SlRoot',
        components: {
            ...UI, ...PAGES, SlTabBar, SlSurveyPage, SlLessonPage, SlFlipPage,
            SlWallPage, SlDictPage, SlTickerPanel, SlThemePanel, SlModals, SlCardDetail,
            SlMemeOverlay,
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
            tab() { return this.s.tab; },
            view() { return this.s.view; },
            topic() { return store.activeTopic(); },
            lesson() { return store.activeLesson(); },
            card() { return store.activeCard(); },
            teachers() { return store.listTeacherCandidates(); },
            dictStats() { return store.dictStats(); },
            reviewCards() { return store.lessonCards(this.s.activeLessonId); },
            cardUsage() { return this.card ? usageLabel(this.card, this.s.lessons) : ''; },
            tickerSnapshot() { return store.tickerSnapshot(); },
            /** 覆盖页盖住 tab 内容和底栏 */
            overlayOpen() {
                return ['topic-new', 'survey', 'lesson', 'flip', 'wall', 'review', 'theme', 'ticker'].includes(this.view);
            },
            topTitle() {
                return ({
                    topics: '点灯', lessons: '课程', wall: '推理墙', dict: '词典', me: '我的',
                })[this.tab] || '点灯';
            },
            topSub() {
                if (this.tab === 'topics') return this.s.identity.hasWorld ? this.s.identity.worldName : '';
                if (this.topic) return this.topic.title;
                return '';
            },
            lampMark() { return icon('lamp', { size: 17 }); },
        },
        mounted() {
            store.registerThemeApplier((themeId, custom) => this.applyTheme(themeId, custom));

            // microtask 里启动，让首帧先画出骨架
            Promise.resolve().then(() => store.hydrate(this.app));

            this._onAppOpened = (e) => {
                if (e?.detail?.appId && e.detail.appId !== 'starlit') return;
                store.recheckIdentity();
            };
            window.addEventListener('phone:app-opened', this._onAppOpened);
        },
        beforeUnmount() {
            window.removeEventListener('phone:app-opened', this._onAppOpened);
            store.flushPersist();
        },
        methods: {
            // ---- 框架接线 ----
            shellEl() {
                if (typeof document === 'undefined') return null;
                return document.querySelector('.app-shell[data-app-id="starlit"]');
            },
            applyTheme(themeId, custom) {
                const el = this.shellEl();
                if (!el) return;
                el.setAttribute('data-sl-theme', themeId || 'lantern');
                applyThemeVars(el, custom || {});
                this.syncChromeColors(themeId, custom);
            },
            syncChromeColors(themeId, custom) {
                try {
                    const colors = resolveThemeColors(themeId, custom);
                    const el = this.shellEl();
                    const cs = el ? getComputedStyle(el) : null;
                    const read = (key) => colors[key] || (cs ? cs.getPropertyValue(key).trim() : '');
                    const text = read('--sl-text');
                    const bg = read('--sl-bg');
                    const indicator = read('--sl-home-indicator') || text;
                    if (text) this.app.statusBarColor = text;
                    if (bg) this.app.background = bg;
                    if (indicator) this.app.homeIndicatorColor = indicator;
                    // 重赋 apps.value 强制框架 computed 重算，否则背景层可能停在旧主题色
                    if (window.__phoneAppsRef?.value) {
                        window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
                    }
                } catch (err) {
                    console.warn('[starlit] 同步状态栏颜色失败', err);
                }
            },

            // ---- 路由 ----
            /**
             * 推理墙没有对应的 tab 页 —— 它是一张覆盖页。
             * 所以点它只开覆盖页，**不改 tab**：关掉之后回到原来那一栏，
             * 不然 tab 停在 'wall' 而没有匹配的分支，会得到一屏空白。
             */
            pickTab(id) {
                if (id === 'wall') {
                    if (!this.s.activeTopicId) { store.showToast('先建一个学习主题'); return; }
                    store.recomputeRegions();
                    store.setView('wall');
                    return;
                }
                store.setTab(id);
            },
            closeView() { store.setView(''); },
            notify(text) { store.showToast(text); },

            // ---- 主题 ----
            openNewTopic() { store.resetDraft(); store.setView('topic-new'); },
            async createTopic() { await store.createTopic(); },
            selectTopic(id) { store.selectTopic(id); },
            openPlan() {
                if (!this.topic) return;
                store.setView(this.topic.surveyStage === 'done' ? 'survey' : 'survey');
            },
            setTeacher(payload) { store.setTeacher(payload.source, payload.aiId); },
            confirmDeleteTopic(id) {
                const t = this.s.topics.find((x) => String(x.id) === String(id));
                store.openModal('confirm', {
                    title: '删掉这个主题？',
                    text: `「${t?.title || ''}」的课程、卡片、连线、词条会一起消失，不能撤销。`,
                    okText: '删掉',
                    danger: true,
                    action: 'delete-topic',
                    id,
                });
            },

            // ---- 问卷 ----
            retrySurvey() { store.generateSurvey(); },
            answerSurvey(p) { store.answerSurvey(p.id, p.value); },
            submitSurvey() { store.submitSurvey(); },
            planLessons(goal) { store.planLessons(goal); },

            // ---- 课程 ----
            openLesson(id) { store.openLesson(id, 'lesson'); },
            startLesson() { store.teacherSpeak(''); },
            sendLesson(text) { store.sendMessage(text); },
            endLesson() { store.endLesson(); },
            openFlip(id) { store.startFlip(id || this.s.activeLessonId); },
            sendFlip(text) { store.sendFlipMessage(text); },
            forceEndFlip() { store.finishFlip(false, 'user'); },
            openReview(id) {
                if (id) this.s.activeLessonId = String(id);
                store.setView('review');
            },
            saveNotes(text) { store.updateLesson(this.s.activeLessonId, { notes: text }); },
            addLesson() {
                store.openModal('prompt', {
                    title: '加一节课',
                    placeholder: '这节想学什么',
                    action: 'add-lesson',
                });
            },
            nextLesson() {
                const idx = this.s.lessons.findIndex((l) => String(l.id) === String(this.s.activeLessonId));
                const next = this.s.lessons[idx + 1];
                if (next) store.openLesson(next.id, 'lesson');
                else { store.setView(''); store.setTab('lessons'); }
            },

            // ---- 卡片 ----
            openCard(id) {
                this.s.activeCardId = String(id);
            },
            closeCard() { this.s.activeCardId = ''; },
            changeCard(patch) { store.updateCard(this.s.activeCardId, patch); },
            deleteCard() {
                store.openModal('confirm', {
                    title: '删掉这张卡？',
                    text: '挂在它身上的连线也会一起删掉。',
                    okText: '删掉',
                    danger: true,
                    action: 'delete-card',
                });
            },
            expandCard(payload) {
                store.expandCard(this.s.activeCardId, payload?.question || payload?.text || '');
            },
            linkFromCard() {
                store.beginLink(this.s.activeCardId);
                this.s.activeCardId = '';
                store.recomputeRegions();
                store.setView('wall');
            },
            unstackCard() { store.unstackCard(this.s.activeCardId); },

            // ---- 推理墙 ----
            moveCard(p) { store.moveCard(p.id, p.x, p.y); },
            stackCards(p) { store.stackCards(p.dragId, p.targetId); },
            finishLink(p) { store.completeLink(p.to, p.kind); },
            cancelLink() { store.cancelLink(); },
            tidyWall(viewport) { store.tidyWall(viewport); },
            fitWall(viewport) { store.fitAll(viewport); },
            focusRegion(p) { store.focusRegion(p.id, p.viewport); },
            newWallCard(p) { store.createBlankCard(p.x, p.y, 'note'); },
            spreadStack(id) { store.spreadStack(id); },
            closeSpread() { store.closeSpread(); },
            spreadStep(d) { store.spreadStep(d); },
            saveWallView() { store.setWallView({}); },
            toggleWallFull() { this.s.wall.full = !this.s.wall.full; },
            editLink(id) {
                const link = this.s.links.find((l) => String(l.id) === String(id));
                if (!link) return;
                store.openModal('link', {
                    kind: link.kind,
                    value: link.label,
                    action: 'edit-link',
                    id,
                });
            },

            // ---- 词典 ----
            addDict(draft) { store.addDictEntry(draft); },
            bulkDict(text) { store.addDictBulk(text); },
            updateDict(p) { store.updateDictEntry(p.id, p.patch); },
            deleteDict(id) { store.deleteDictEntry(id); },
            gradeDict(p) { store.gradeDictEntry(p.id, p.grade); },
            bucketDict(p) { store.setDictBucket(p.id, p.bucket); },
            enrichDict(ids) { store.enrichDict(ids); },
            updateTicker(p) { store.updateTickerSetting(p.group, p.patch); },

            // ---- 弹窗 ----
            closeModal() { store.closeModal(); },
            onModalConfirm(payload) {
                const action = this.s.modal?.payload?.action;
                const id = this.s.modal?.payload?.id;
                store.closeModal();
                if (action === 'delete-topic') store.deleteTopic(id);
                else if (action === 'delete-card') store.deleteCard(this.s.activeCardId);
                else if (action === 'add-lesson') store.addLesson(payload.value);
                else if (action === 'edit-link') {
                    if (payload.value?.remove) store.deleteLink(id);
                    else store.updateLink(id, payload.value);
                }
            },

            setImmersion(mode) {
                if (!this.topic) return;
                void store.setTopicImmersion(this.topic.id, mode);
            },
            setGlossMode(mode) { store.setGlossMode(mode); },
            setBubbleSplit(on) { store.setBubbleSplit(on); },
            setTranslateEngine(engine) { store.setTranslateEngine(engine); },

            /**
             * 长按翻译的统一入口。
             * 子组件要么给 { cardId }（整张卡），要么给 { text }（一段文字）。
             */
            onTranslate(payload) {
                if (!payload) return;
                if (payload.cardId) { void store.translateCard(payload.cardId); return; }
                const text = String(payload.text || '').trim();
                if (text) void store.translateText(text, { source: payload.source || '' });
            },
            onTranslationMove(pos) {
                store.moveTranslation(pos.x, pos.y);
            },
            closeTranslation() {
                store.closeTranslation();
            },
        },
        template: `
            <div class="sl-root">
                <header v-if="!overlayOpen" class="sl-top">
                    <span class="sl-top__mark" v-html="lampMark"></span>
                    <div class="sl-top__text">
                        <h1 class="sl-top__title">{{ topTitle }}</h1>
                        <p v-if="topSub" class="sl-top__sub">{{ topSub }}</p>
                    </div>
                </header>

                <div class="sl-body">
                    <div v-if="blocked" class="sl-blocked">
                        <SlEmpty icon-name="lamp" title="还差一步" :desc="blocked" />
                    </div>

                    <div v-else-if="!ready" class="sl-page"><SlSkeleton :rows="5" /></div>

                    <!-- 覆盖页 -->
                    <SlNewTopic
                        v-else-if="view === 'topic-new'"
                        :state="s" :teachers="teachers"
                        @back="closeView" @create="createTopic"
                        @gloss-mode="setGlossMode"
                    />
                    <SlSurveyPage
                        v-else-if="view === 'survey'"
                        :state="s" :topic="topic"
                        @back="closeView" @retry-survey="retrySurvey"
                        @answer="answerSurvey" @submit="submitSurvey" @plan="planLessons"
                    />
                    <SlLessonPage
                        v-else-if="view === 'lesson'"
                        :state="s" :topic="topic" :lesson="lesson"
                        @back="closeView" @start="startLesson" @send="sendLesson"
                        @end="endLesson" @open-card="openCard" @notes="openReview()"
                        @translate="onTranslate"
                    />
                    <SlFlipPage
                        v-else-if="view === 'flip'"
                        :state="s" :topic="topic" :lesson="lesson"
                        @back="closeView" @send="sendFlip" @force-end="forceEndFlip"
                    />
                    <SlReviewPage
                        v-else-if="view === 'review'"
                        :state="s" :lesson="lesson" :cards="reviewCards"
                        @back="closeView" @open-card="openCard" @wall="pickTab('wall')"
                        @flip="openFlip()" @notes="saveNotes" @next="nextLesson"
                    />
                    <SlWallPage
                        v-else-if="view === 'wall'"
                        :state="s" :topic="topic"
                        @back="closeView" @open-card="openCard" @move="moveCard" @stack="stackCards"
                        @link-done="finishLink" @link-cancel="cancelLink"
                        @tidy="tidyWall" @fit="fitWall" @focus-region="focusRegion"
                        @new-card="newWallCard" @spread="spreadStack" @spread-close="closeSpread"
                        @spread-step="spreadStep" @save-view="saveWallView"
                        @update-link="editLink" @toggle-full="toggleWallFull"
                    />
                    <SlTickerPanel
                        v-else-if="view === 'ticker'"
                        :state="s" :snapshot="tickerSnapshot"
                        @back="closeView" @update="updateTicker"
                    />
                    <SlThemePanel
                        v-else-if="view === 'theme'"
                        @close="closeView" @notify="notify"
                    />

                    <!-- 五个 tab -->
                    <template v-else>
                        <SlTopicsPage
                            v-if="tab === 'topics'"
                            :state="s"
                            @select="selectTopic" @new="openNewTopic" @open-plan="pickTab('lessons')"
                        />
                        <SlLessonsPage
                            v-else-if="tab === 'lessons'"
                            :state="s" :topic="topic"
                            @open="openLesson" @flip="openFlip" @plan="openPlan"
                            @review="openReview" @add="addLesson"
                        />
                        <SlDictPage
                            v-else-if="tab === 'dict'"
                            :state="s" :stats="dictStats"
                            @add="addDict" @bulk="bulkDict" @update="updateDict" @delete="deleteDict"
                            @grade="gradeDict" @bucket="bucketDict" @enrich="enrichDict"
                            @settings="() => { s.view = 'ticker'; }"
                        />
                        <SlMePage
                            v-else-if="tab === 'me'"
                            :state="s" :topic="topic" :teachers="teachers"
                            @theme="() => { s.view = 'theme'; }"
                            @ticker="() => { s.view = 'ticker'; }"
                            @teacher="setTeacher"
                            @delete-topic="confirmDeleteTopic"
                            @immersion="setImmersion"
                            @gloss-mode="setGlossMode"
                            @bubble-split="setBubbleSplit"
                            @translate-engine="setTranslateEngine"
                        />
                    </template>
                </div>

                <SlTabBar
                    v-if="ready && !blocked && !overlayOpen"
                    :active="tab" :due-count="dictStats.due || 0" :card-count="s.cards.length"
                    @pick="pickTab"
                />

                <!-- 卡片详情：盖在任何页面之上 -->
                <transition name="sl-sheet">
                    <div v-if="card" class="sl-sheet" @click.self="closeCard">
                        <SlCardDetail
                            :card="card" :usage="cardUsage"
                            :expanding="s.loading.expand === card.id"
                            @close="closeCard" @change="changeCard" @delete="deleteCard"
                            @expand="expandCard" @link="linkFromCard" @unstack="unstackCard"
                            @translate="onTranslate({ text: $event })"
                        />
                    </div>
                </transition>

                <!--
                    长按翻译的悬浮层。
                    ★ 挂在 sl-root 里而不是 body 上 —— 拖动时要按 sl-root 的
                      尺寸换算百分比，挂出去就没有参照系了。
                -->
                <SlMemeOverlay
                    v-if="s.translation"
                    :data="s.translation"
                    @move="onTranslationMove"
                    @close="closeTranslation"
                />

                <SlModals :modal="s.modal" @close="closeModal" @confirm="onModalConfirm" />

                <transition name="sl-toast">
                    <div v-if="s.toast" class="sl-toast">{{ s.toast }}</div>
                </transition>
            </div>
        `,
    };
}

export default createStarlitRoot;
