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
import { BUILTIN_SETS, countQuestions } from '../question-bank.js';
import { CONTEXT_SECTIONS, WORKBENCH_TABS } from '../constants.js';
import { buildPersonaPrompt, buildAdvisorPrompt } from '../services/prompt-builder.js';
import { QUIZ_FORMAT_GUIDE, parseQuizText, describeSet } from '../services/quiz-format.js';
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
        return { CONTEXT_SECTIONS, quizSource: '', importing: false };
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
            return BUILTIN_SETS.map((s) => this.toSetRow(s));
        },

        /** 用户自己导进来的。读 state 而不是 question-bank,这样导完立刻重渲染。 */
        customSets() {
            return this.state.customSets.map((s) => this.toSetRow(s));
        },

        /**
         * 导入预览。
         *
         * 和真正落库走的是**同一个** `parseQuizText` —— 预览里说"3 套 40 题",
         * 存进去就一定是这些,不会出现"看着解析对了、存完少一套"。
         */
        quizPreview() {
            if (!this.quizSource.trim()) return null;
            const { sets, notes } = parseQuizText(this.quizSource);
            return {
                sets: sets.map((s) => ({ name: s.name, desc: describeSet(s) })),
                notes: notes.slice(0, 6),
                moreNotes: Math.max(0, notes.length - 6),
            };
        },
    },
    methods: {
        onBack() { this.$emit('close'); },

        /** 模板里访问不到模块作用域的 import,抽屉开关统一走这两个方法 */
        openDrawer(id) { store.setDrawer(id); },
        closeDrawer() { store.setDrawer(null); },

        toSetRow(set) {
            return {
                id: set.id,
                name: set.name,
                desc: set.desc || describeSet(set),
                total: countQuestions(set.id),
                active: this.draft.quiz.setId === set.id,
            };
        },

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

        // ── 题库导入 ──────────────────────────
        openQuizImport() { store.setDrawer('quiz-import'); },
        backToQuiz() { store.setDrawer('quiz'); },

        async onCopyGuide() {
            try {
                await navigator.clipboard.writeText(QUIZ_FORMAT_GUIDE);
                this.$emit('notify', '格式说明已复制，连同题目一起发给 AI 就行');
            } catch (_) {
                // 剪贴板在 file:// 下可能不给用 —— 退回到「填进输入框自己选」
                this.quizSource = QUIZ_FORMAT_GUIDE;
                this.$emit('notify', '复制不了，已经填进下面的框，手动选中复制吧');
            }
        },

        async onImportQuiz() {
            if (this.importing) return;
            this.importing = true;
            try {
                const res = await store.importQuizSets(this.quizSource);
                if (!res.ok) {
                    this.$emit('notify', res.error);
                    return;
                }
                this.quizSource = '';
                const bits = [];
                if (res.added) bits.push(`新增 ${res.added} 套`);
                if (res.replaced) bits.push(`覆盖同名 ${res.replaced} 套`);
                this.$emit('notify', `${bits.join('，')}，共 ${res.questions} 题`);
                store.setDrawer('quiz');
            } finally {
                this.importing = false;
            }
        },

        onDeleteSet(set) {
            store.openModal('confirm', {
                title: `删掉题库「${set.name}」?`,
                text: '只删这套题，已经问过的对话和答案都还在。',
                danger: true,
                confirmLabel: '删除',
                onConfirm: async () => {
                    await store.removeCustomSet(set.id);
                    this.$emit('notify', '题库已删除');
                },
            });
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
                <PlSectionTitle title="内置" hint="点一下开始，再点一下收起" />
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

                <PlSectionTitle title="我导入的" :hint="customSets.length ? customSets.length + ' 套' : ''">
                    <template #action>
                        <PlButton label="导入" icon-name="import" variant="ghost" size="sm" @click="openQuizImport" />
                    </template>
                </PlSectionTitle>

                <PlEmpty
                    v-if="!customSets.length"
                    icon-name="quiz"
                    title="还没有自己的题库"
                    hint="在别处找一套题，让 AI 照着格式改一遍，粘进来就能用。"
                    action-label="去导入"
                    @action="openQuizImport"
                />

                <ul v-else class="pl-quiz-sets">
                    <li v-for="set in customSets" :key="set.id" class="pl-quiz-set-row">
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
                        <button type="button" class="pl-quiz-set-kill" aria-label="删除题库" @click="onDeleteSet(set)">
                            <PlIcon name="trash" />
                        </button>
                    </li>
                </ul>
            </PlSheet>

            <!-- 题库导入 -->
            <PlSheet
                v-else-if="drawer === 'quiz-import'"
                title="导入题库"
                subtitle="纯文本，一行一条「键：值」"
                tall
                @close="backToQuiz"
            >
                <p class="pl-ctx-note">
                    在别处找到一套题，把格式说明复制给 AI，让它照着改写，再把结果粘到下面。
                    键名只有「题库 / 说明 / 类型 / 问 / 选」这几个，认不出来的行会逐条告诉你。
                </p>

                <div class="pl-quiz-import-actions">
                    <PlButton label="复制格式说明" icon-name="copy" variant="ghost" size="sm" @click="onCopyGuide" />
                </div>

                <textarea
                    v-model="quizSource"
                    class="pl-code-input"
                    rows="10"
                    placeholder="题库：童年底色&#10;说明：8 题，问她是怎么长大的&#10;&#10;问：小时候家里最常有的声音是什么？&#10;选：电视一直开着&#10;选：谁在厨房忙&#10;选：很安静"
                ></textarea>

                <div v-if="quizPreview" class="pl-quiz-import-preview">
                    <p class="pl-quiz-import-head">会导入这些：</p>
                    <PlEmpty
                        v-if="!quizPreview.sets.length"
                        icon-name="quiz"
                        title="这段里没解析出题目"
                        hint="至少要有一行「问：…」。照格式说明改一遍再试。"
                    />
                    <ul v-else class="pl-patch-list">
                        <li v-for="(set, i) in quizPreview.sets" :key="i">
                            <span class="pl-patch-key">{{ set.name }}</span>
                            <span class="pl-patch-val">{{ set.desc }}</span>
                        </li>
                    </ul>
                    <p v-for="(note, i) in quizPreview.notes" :key="'n' + i" class="pl-quiz-import-note">{{ note }}</p>
                    <p v-if="quizPreview.moreNotes" class="pl-quiz-import-note">…还有 {{ quizPreview.moreNotes }} 条没显示</p>
                </div>

                <template #footer>
                    <PlButton label="返回" variant="quiet" @click="backToQuiz" />
                    <PlButton
                        label="导入"
                        icon-name="check"
                        variant="primary"
                        :loading="importing"
                        :disabled="!quizPreview || !quizPreview.sets.length"
                        @click="onImportQuiz"
                    />
                </template>
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
