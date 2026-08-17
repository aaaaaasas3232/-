/**
 * 灯塔 · 提示词管理
 *
 * 和 murmur 的「回复提示词」同一套心智：**一段 system prompt 拆成若干张卡**，
 * 每张能单独开关、单独改、能调顺序，改完立刻影响下一次生成。
 *
 * ── 这一页看到的就是发出去的 ──────────────────────────────────────
 *
 * 卡列表和拼接用的是**同一份数据**（`store.promptCards()` → `prompt-builder`），
 * 不是两条路径。梦境编织原型最严重的 bug 就是预览和发送分了家：
 * 用户在预览里关掉世界观、保存、发送，世界观照发不误，而且不报任何错。
 *
 * 底部那个「看看发出去长什么样」直接调真正的 build 函数，
 * 所以它显示的字符串和 AI 收到的**逐字相同**。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { CARD_GROUPS, SCENE_LABELS } from '../services/prompt-cards.js';
import { SCENE_BUILDERS, estimateTokens } from '../services/prompt-builder.js';
import { icon } from '../icons.js';

const PREVIEW_SCENES = [
    { id: 'feed', label: '职位列表' },
    { id: 'talk', label: '面试对话' },
    { id: 'theater', label: '小剧场' },
];

export const JbPromptPanel = {
    name: 'JbPromptPanel',
    components: { ...UI },
    emits: ['close'],
    data() {
        return {
            openGroup: 'base',
            editing: '',        // 正在改哪张卡
            draft: '',
            previewScene: '',   // 空 = 没在看预览
        };
    },
    computed: {
        s() { return store.getState(); },
        cards() { return store.promptCards(); },
        groups() { return CARD_GROUPS; },
        sceneLabels() { return SCENE_LABELS; },
        previewScenes() { return PREVIEW_SCENES; },
        activeCount() { return this.cards.filter((c) => c.active).length; },
        editedCount() { return this.cards.filter((c) => c.edited).length; },
        upSvg() { return icon('chevronUp', { size: 15 }); },
        downSvg() { return icon('chevronDown', { size: 15 }); },

        /**
         * 预览。
         *
         * ★ 直接调真正的 build 函数，不另写一份拼接 —— 只要是两个函数，
         *   无论一开始写得多一致，都会分叉；这是时间问题不是能力问题。
         */
        preview() {
            if (!this.previewScene) return null;
            const build = SCENE_BUILDERS[this.previewScene];
            if (!build) return null;
            try {
                const { text } = build(this.sampleContext());
                return { text, tokens: estimateTokens(text) };
            } catch (err) {
                console.warn('[job] 预览拼装失败', err);
                return { text: `预览拼不出来：${err?.message || err}`, tokens: 0 };
            }
        },
    },
    methods: {
        groupCards(gid) { return this.cards.filter((c) => c.group === gid); },
        toggleGroup(gid) { this.openGroup = this.openGroup === gid ? '' : gid; },
        sceneList(card) {
            return card.scenes.map((s) => this.sceneLabels[s] || s).join(' · ');
        },

        setActive(card, on) { store.setPromptActive(card.id, on); },
        move(card, delta) { store.movePrompt(card.id, delta); },
        reset(card) {
            store.resetPrompt(card.id);
            if (this.editing === card.id) this.editing = '';
        },
        resetAll() { store.resetAllPrompts(); this.editing = ''; },

        startEdit(card) {
            this.editing = card.id;
            this.draft = card.text;
        },
        cancelEdit() { this.editing = ''; this.draft = ''; },
        save(card) {
            store.setPromptText(card.id, this.draft);
            this.editing = '';
        },

        togglePreview(scene) {
            this.previewScene = this.previewScene === scene ? '' : scene;
        },

        /**
         * 预览上下文。
         *
         * 世界观、货币、夹子、附加提示词、卡片正文全都走 `store.previewContext()`，
         * 也就是真正生成时用的那一份 —— 那才是用户在这一页要检查的东西。
         * 只有「本次任务针对哪一条」是占位的，因为预览时没有具体对象。
         */
        sampleContext() {
            const s = this.s;
            const post = s.posts[0];
            return {
                ...store.previewContext(),
                category: s.feedCategory,
                job: s.detailJob || { title: '（某个职位）', employer: '（某家单位）' },
                recruiter: { name: '（对面那个人）' },
                post: post || { title: '（你的工作）', pay: { mode: 'monthly', payDay: 10, amount: 0 } },
                day: store.helpers.todayKey(),
                colleagues: [], rivals: [], recentDigests: [],
                theater: { day: store.helpers.todayKey(), scenes: [] },
            };
        },
    },
    template: `
        <jb-panel title="提示词" @close="$emit('close')">
            <template #bar>
                <jb-btn v-if="editedCount" size="sm" variant="ghost" @click="resetAll">全部还原</jb-btn>
            </template>

            <p class="jb-panel__desc">
                这些是发给 AI 的原话。招聘板挂什么、HR 怎么说话、小剧场什么调子，
                都由它们决定。改了立刻生效，不用重启。
            </p>

            <div class="jb-pm__stat">
                <span>{{ activeCount }} / {{ cards.length }} 张在用</span>
                <span v-if="editedCount">{{ editedCount }} 张改过</span>
            </div>

            <!-- 分组 -->
            <div v-for="g in groups" :key="g.id" class="jb-pm__group">
                <button class="jb-pm__group-head" @click="toggleGroup(g.id)">
                    <span class="jb-pm__group-name">{{ g.label }}</span>
                    <span class="jb-pm__group-desc">{{ g.desc }}</span>
                    <span class="jb-pm__group-count">{{ groupCards(g.id).length }}</span>
                </button>

                <div v-if="openGroup === g.id" class="jb-pm__cards">
                    <article
                        v-for="c in groupCards(g.id)" :key="c.id"
                        class="jb-card jb-pmcard"
                        :class="{ 'is-off': !c.active }"
                    >
                        <header class="jb-pmcard__head">
                            <div class="jb-pmcard__title">
                                {{ c.title }}
                                <i v-if="c.locked" class="jb-tag">关不掉</i>
                                <i v-else-if="c.edited" class="jb-tag jb-tag--accent">改过</i>
                            </div>
                            <jb-switch
                                :model-value="c.active" :disabled="c.locked"
                                @update:model-value="setActive(c, $event)"
                            />
                        </header>

                        <p class="jb-pmcard__desc">{{ c.desc }}</p>
                        <p class="jb-pmcard__scenes">用在：{{ sceneList(c) }}</p>

                        <template v-if="editing === c.id">
                            <jb-textarea :model-value="draft" :rows="8"
                                @update:model-value="draft = $event" />
                            <div class="jb-pmcard__btns">
                                <jb-btn size="sm" variant="ghost" @click="cancelEdit">取消</jb-btn>
                                <jb-btn size="sm" variant="primary" @click="save(c)">保存</jb-btn>
                            </div>
                        </template>

                        <template v-else>
                            <pre class="jb-pmcard__body">{{ c.text }}</pre>
                            <div class="jb-pmcard__btns">
                                <button class="jb-iconbtn" v-html="upSvg" title="往前挪" @click="move(c, -1)"></button>
                                <button class="jb-iconbtn" v-html="downSvg" title="往后挪" @click="move(c, 1)"></button>
                                <jb-btn v-if="c.edited" size="sm" variant="ghost" icon="undo" @click="reset(c)">
                                    复原
                                </jb-btn>
                                <jb-btn size="sm" variant="line" icon="edit" @click="startEdit(c)">改</jb-btn>
                            </div>
                        </template>
                    </article>
                </div>
            </div>

            <p class="jb-panel__note">
                顺序有意义：靠后的段落在同类指令上会赢过靠前的。
                「这份工作专属的小剧场提示词」排在所有卡之后，所以它能覆盖上面的写法。
            </p>

            <!-- 预览 -->
            <jb-section title="看看发出去长什么样" sub="和 AI 收到的逐字相同">
                <div class="jb-chips">
                    <jb-chip
                        v-for="p in previewScenes" :key="p.id"
                        :active="previewScene === p.id" @click="togglePreview(p.id)"
                    >{{ p.label }}</jb-chip>
                </div>
                <div v-if="preview" class="jb-card jb-card--pad jb-pm__preview">
                    <p class="jb-pm__preview-stat">约 {{ preview.tokens }} token</p>
                    <pre class="jb-pm__preview-body">{{ preview.text }}</pre>
                    <p class="jb-panel__note">
                        「（某个职位）」这类括号内容是预览占位，真发的时候是当时那一条的真实信息。
                    </p>
                </div>
            </jb-section>
        </jb-panel>
    `,
};
