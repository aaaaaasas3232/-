/**
 * 人设机 · 工作台
 *
 * 打开一份草稿后占满整屏(和梦境编织的编辑器同款):自绘顶栏 + 三段分页。
 * 库页的底部 tab 在这里让位 —— 打磨人设时不需要它,腾出来的空间给消息流。
 *
 * ⚠️ 顶栏要自己让开 **54px**:状态栏(时间 / 灵动岛 / 电量)浮在 `.app-shell`
 *    之上,不在文档流里。这个间距在 `_workbench.css` 里给,不在这儿写 style。
 */

import { SHARED_COMPONENTS } from './shared.js';
import { PlPanelAsk } from './panel-ask.js';
import { PlPanelRefine } from './panel-refine.js';
import { PlPanelCard } from './panel-card.js';
import * as store from '../store.js';
import { QUESTION_SETS, countQuestions } from '../question-bank.js';
import { CONTEXT_SECTIONS, WORKBENCH_TABS } from '../constants.js';
import { buildPersonaPrompt, buildAdvisorPrompt } from '../services/prompt-builder.js';
import { resolveApiRef, describeApiRef } from '../services/nook-bridge.js';

export const PlWorkbench = {
    name: 'PlWorkbench',
    components: { ...SHARED_COMPONENTS, PlPanelAsk, PlPanelRefine, PlPanelCard },
    props: {
        app: { type: Object, required: true },
        draft: { type: Object, required: true },
    },
    emits: ['close', 'notify'],
    data() {
        return { QUESTION_SETS, CONTEXT_SECTIONS };
    },
    computed: {
        state() { return store.getState(); },
        tab: {
            get() { return this.state.wbTab; },
            set(v) { store.setWbTab(v); },
        },
        drawer() { return this.state.drawer; },
        dirty() { return store.isDirty(this.draft); },
        api() { return describeApiRef(resolveApiRef()); },

        /** tab 上的小点:有待处理建议时提醒去「打磨」 */
        tabs() {
            return WORKBENCH_TABS.map((t) => ({
                ...t,
                dot: t.id === 'refine' && Boolean(this.draft.suggestion),
            }));
        },

        /**
         * 上下文预览。
         *
         * ★ 这里调的就是发送时调的那个函数,所以「看到的」和「发出去的」
         *   是同一次计算的两个返回字段,不可能不一致
         *   (框架 `context-composer` 的核心约定)。
         */
        contextPreview() {
            const build = this.state.askMode === 'advisor' ? buildAdvisorPrompt : buildPersonaPrompt;
            return build({ draft: this.draft, quiz: store.getCurrentQuiz(this.draft) });
        },

        quizSets() {
            return QUESTION_SETS.map((s) => ({
                id: s.id,
                name: s.name,
                desc: s.desc,
                total: countQuestions(s.id),
                active: this.draft.quiz.setId === s.id,
            }));
        },
    },
    methods: {
        onBack() { this.$emit('close'); },

        /** 模板里访问不到模块作用域的 import,抽屉开关统一走这两个方法 */
        openDrawer(id) { store.setDrawer(id); },
        closeDrawer() { store.setDrawer(null); },

        onPickQuiz(setId) {
            if (this.draft.quiz.setId === setId) {
                store.stopQuiz(this.draft.id);
                this.$emit('notify', '已收起题库');
            } else {
                store.startQuiz(this.draft.id, setId);
                this.$emit('notify', '题库已打开，直接点发送就用第一题问');
            }
            store.setDrawer(null);
            store.setWbTab('ask');
        },

        onToggleSection(section, enabled) {
            store.setContextSection(this.draft.id, section.id, enabled);
        },
        isSectionOn(section) {
            if (section.locked) return true;
            return this.draft.contextConfig[section.id] !== false;
        },
        partOf(sectionId) {
            return this.contextPreview.parts.find((p) => p.id === sectionId) || null;
        },

        goRefine() { store.setWbTab('refine'); },
        goAsk() {
            store.setWbTab('ask');
            store.setAskMode('advisor');
        },
        openQuiz() { store.setDrawer('quiz'); },
    },
    template: `
        <div class="pl-wb">
            <header class="pl-wb-top">
                <button type="button" class="pl-wb-back" aria-label="返回人设库" @click="onBack">
                    <PlIcon name="back" />
                </button>
                <div class="pl-wb-title">
                    <h1>{{ draft.title }}</h1>
                    <p>
                        <span class="pl-chip" :data-scope="draft.scope">{{ draft.scope === 'user' ? '用户人设' : 'AI 人设' }}</span>
                        <span v-if="dirty" class="pl-wb-dirty">未保存</span>
                    </p>
                </div>
                <button type="button" class="pl-wb-ctx" aria-label="查看发给 AI 的上下文" @click="openDrawer('context')">
                    <PlIcon name="link" />
                </button>
            </header>

            <nav class="pl-wb-tabs">
                <PlSegmented v-model="tab" :items="tabs" />
            </nav>

            <main class="pl-wb-body">
                <PlPanelAsk
                    v-if="tab === 'ask'"
                    :app="app"
                    :draft="draft"
                    @notify="$emit('notify', $event)"
                    @go-refine="goRefine"
                    @open-quiz="openQuiz"
                />
                <PlPanelRefine
                    v-else-if="tab === 'refine'"
                    :app="app"
                    :draft="draft"
                    @notify="$emit('notify', $event)"
                    @go-ask="goAsk"
                />
                <PlPanelCard
                    v-else
                    :app="app"
                    :draft="draft"
                    @notify="$emit('notify', $event)"
                />
            </main>

            <!-- 题库 -->
            <PlSheet
                v-if="drawer === 'quiz'"
                title="题库"
                subtitle="想不出问什么时，照着问一轮"
                tall
                @close="closeDrawer"
            >
                <ul class="pl-quiz-sets">
                    <li v-for="set in quizSets" :key="set.id">
                        <button
                            type="button"
                            class="pl-quiz-set"
                            :class="{ 'is-active': set.active }"
                            @click="onPickQuiz(set.id)"
                        >
                            <span class="pl-quiz-set-name">{{ set.name }}<span class="pl-quiz-set-count">{{ set.total }} 题</span></span>
                            <span class="pl-quiz-set-desc">{{ set.desc }}</span>
                            <span v-if="set.active" class="pl-tag">进行中 · 点一下收起</span>
                        </button>
                    </li>
                </ul>
            </PlSheet>

            <!-- 上下文 -->
            <PlSheet
                v-else-if="drawer === 'context'"
                title="这次会发出去什么"
                :subtitle="'约 ' + contextPreview.stats.tokens + ' token · ' + contextPreview.stats.included + ' 段生效'"
                tall
                @close="closeDrawer"
            >
                <p class="pl-ctx-note">
                    下面就是发给 AI 的全部内容。关掉的段落不会发出去 ——
                    这里看到的和实际发送的是同一次计算。
                </p>
                <p class="pl-api-line">
                    <PlIcon name="key" />
                    <span :data-ok="api.ok ? '1' : '0'">{{ api.label }}</span>
                    <span v-if="api.sub" class="pl-api-sub">{{ api.sub }}</span>
                </p>

                <ul class="pl-ctx-list">
                    <li v-for="section in CONTEXT_SECTIONS" :key="section.id" class="pl-ctx-item">
                        <div class="pl-ctx-head">
                            <span class="pl-ctx-name">{{ section.label }}</span>
                            <span v-if="partOf(section.id)" class="pl-ctx-token">{{ partOf(section.id).tokens }} tk</span>
                            <span v-if="section.locked" class="pl-tag">必带</span>
                            <PlSwitch
                                v-else
                                :model-value="isSectionOn(section)"
                                @update:model-value="onToggleSection(section, $event)"
                            />
                        </div>
                        <p class="pl-ctx-desc">{{ section.desc }}</p>
                        <pre
                            v-if="partOf(section.id) && partOf(section.id).content"
                            class="pl-ctx-body"
                        >{{ partOf(section.id).content }}</pre>
                        <p v-else class="pl-ctx-empty">这一段现在是空的，不会占位置。</p>
                    </li>
                </ul>
            </PlSheet>
        </div>
    `,
};

export default PlWorkbench;
