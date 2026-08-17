/**
 * 小奇怪 · 匿名回答箱
 *
 * ── 玩法 ──────────────────────────────────────────────────────────
 *
 * 「召唤一批」→ 把当前世界观下的每一个 AI 都请一遍,各自投一个**他真的想问
 * 用户**的问题。问题落进箱子里,只带一个代号(匿名用户 A / B / C…),
 * **不带名字**。用户可以答、可以接着聊,但从头到尾不知道哪句是谁问的。
 *
 * 另一头:用户如果在 murmur 里打开「小奇怪 · 匿名箱里的往来」这张提示词卡,
 * AI 就能认出自己投过什么、对方怎么答的(卡里写死了「只认领自己那条」)。
 * 同步在 store 的 `syncAnonToMurmur()` 里做。
 *
 * ── 关于代号 ──────────────────────────────────────────────────────
 *
 * 代号在**写盘那一刻**就定死并打乱(`anon.mintAliases`),不是渲染时按下标算。
 * 按下标算的话列表一排序代号就跟着换,用户能靠这个反推出谁是谁。
 */

import * as store from '../store.js';
import * as anon from '../services/anon-service.js';
import { makeId, asArray, truncate } from '../utils.js';
import { anonMixin, ANON_COMPONENTS } from './anon-common.js';

const BOX = 'askbox';

export const OqViewAskbox = {
    name: 'OqViewAskbox',
    components: { ...ANON_COMPONENTS },
    mixins: [anonMixin],
    data() {
        return {
            /** 正在回答哪一条 */
            replyingId: '',
            replyText: '',
            /** 正在改写哪一条的问题本身 */
            editingId: '',
            editText: '',
        };
    },
    computed: {
        questions() { return store.anonList(BOX); },
        statusText() {
            if (!this.people.length) return '当前世界观里还没有 AI 角色';
            if (!this.questions.length) return `${this.people.length} 个人在场,箱子还是空的`;
            const unanswered = this.questions.filter((q) => !this.answeredOf(q)).length;
            return unanswered
                ? `箱子里有 ${this.questions.length} 个问题,${unanswered} 个还没答`
                : `箱子里有 ${this.questions.length} 个问题,都答过了`;
        },
    },
    methods: {
        answeredOf(question) {
            return asArray(question?.thread).some((turn) => turn.role === 'me');
        },

        // ---------- 召唤一批 ----------
        async summon() {
            if (!this.guard()) return;
            const people = this.people;
            const aliases = anon.mintAliases(people.length);

            const { done } = await this.runBatch(people, async (ai, index) => {
                const res = await anon.askQuestion(ai, index, this.aiOpts);
                if (!res.ok) return false;
                store.anonAdd(BOX, {
                    id: makeId('q'),
                    aiId: ai.id,
                    aiName: ai.name,
                    alias: aliases[index] || '匿名用户',
                    text: res.text,
                    thread: [],
                    createdAt: Date.now(),
                });
                return true;
            }, '正在收问题');

            if (done) this.$emit('notify', `箱子里多了 ${done} 个问题`);
        },

        // ---------- 单条：重写 / 编辑 / 删除 ----------
        async reroll(question) {
            if (this.isBusy(question.id) || !this.guard()) return;
            this.setBusy(question.id, true);
            const ai = this.people.find((p) => p.id === question.aiId) || this.people[0];
            const res = await anon.askQuestion(ai, 0, { ...this.aiOpts, avoid: question.text });
            this.setBusy(question.id, false);
            if (!res.ok) {
                this.$emit('notify', res.error || '这一位没有回应');
                return;
            }
            // 换了问题,原来的对话就对不上了 —— 一起清掉,而不是留着变成答非所问
            store.anonPatch(BOX, question.id, { text: res.text, thread: [] });
            this.$emit('notify', '换了一个问题');
        },

        startEdit(question) {
            this.editingId = question.id;
            this.editText = question.text;
            this.replyingId = '';
        },

        commitEdit() {
            const text = this.editText.trim();
            if (!text) return;
            store.anonPatch(BOX, this.editingId, { text });
            this.editingId = '';
            this.editText = '';
            this.$emit('notify', '已改写');
        },

        remove(question) {
            store.anonRemove(BOX, question.id);
            if (this.replyingId === question.id) this.replyingId = '';
            if (this.editingId === question.id) this.editingId = '';
            this.$emit('notify', '已扔掉这个问题');
        },

        // ---------- 回答与追聊 ----------
        startReply(question) {
            this.replyingId = this.replyingId === question.id ? '' : question.id;
            this.replyText = '';
            this.editingId = '';
        },

        async sendReply(question) {
            const text = this.replyText.trim();
            if (!text || this.isBusy(question.id)) return;

            store.anonAppendTurn(BOX, question.id, anon.makeTurn('me', text));
            this.replyText = '';
            this.expanded[question.id] = true;

            if (!this.apiReady) {
                this.$emit('notify', '答案记下了。配了 API 之后对方才会接话');
                return;
            }

            this.setBusy(question.id, true);
            const ai = this.people.find((p) => p.id === question.aiId) || this.people[0];
            const fresh = store.anonFind(BOX, question.id);
            const res = await anon.askboxFollowUp(ai, fresh, this.aiOpts);
            this.setBusy(question.id, false);

            if (!res.ok) {
                this.$emit('notify', res.error || '对面没有接话');
                return;
            }
            store.anonAppendTurn(BOX, question.id, anon.makeTurn('them', res.text));
        },

        // ---------- 工具面板 ----------
        clearAll() {
            store.anonClear(BOX);
            this.$emit('notify', '箱子已经空了');
            this.closePanel();
        },

        preview(question) {
            return truncate(question.text, 18);
        },
    },
    template: `
        <div class="oq-anon oq-anon--ask">
            <OqAnonStatus
                :count="questions.length"
                :text="statusText"
                :progress="progress"
                :error="error"
            />

            <div v-if="questions.length" class="oq-anon-list">
                <article
                    v-for="q in questions"
                    :key="q.id"
                    class="oq-anon-card"
                    :class="{ 'is-busy': isBusy(q.id) }"
                >
                    <header class="oq-anon-card-head">
                        <span class="oq-anon-alias">{{ q.alias }}</span>
                        <span class="oq-anon-flag">{{ answeredOf(q) ? '已回答' : '在等你' }}</span>
                    </header>

                    <p v-if="editingId !== q.id" class="oq-anon-ask">{{ q.text }}</p>
                    <OqComposer
                        v-else
                        v-model="editText"
                        placeholder="改成你想被问的样子"
                        submit-label="改好了"
                        :rows="2"
                        @submit="commitEdit"
                        @cancel="editingId = ''"
                    />

                    <OqThread
                        :turns="q.thread"
                        them-label="TA"
                        :collapsed="!isExpanded(q.id)"
                        @expand="toggleExpand(q.id)"
                    />

                    <OqComposer
                        v-if="replyingId === q.id"
                        v-model="replyText"
                        placeholder="写下你的回答。对方看得到,但你们谁都不知道对面是谁"
                        submit-label="送进箱子"
                        :busy="isBusy(q.id)"
                        @submit="sendReply(q)"
                        @cancel="replyingId = ''"
                    />

                    <footer v-if="editingId !== q.id" class="oq-anon-acts">
                        <OqMiniBtn tone="accent" @click="startReply(q)">
                            {{ replyingId === q.id ? '不答了' : (answeredOf(q) ? '接着聊' : '回答') }}
                        </OqMiniBtn>
                        <OqMiniBtn :loading="isBusy(q.id)" @click="reroll(q)">换一个</OqMiniBtn>
                        <OqMiniBtn @click="startEdit(q)">改写</OqMiniBtn>
                        <OqMiniBtn tone="danger" @click="remove(q)">删除</OqMiniBtn>
                    </footer>
                </article>
            </div>

            <div v-else-if="!running" class="oq-anon-empty">
                <p class="oq-anon-empty-title">箱子是空的</p>
                <p class="oq-anon-empty-hint">
                    请这个世界里的每个人各投一个问题进来。<br />
                    你能看见问题,但看不见是谁投的。
                </p>
                <OqButton variant="primary" :disabled="!people.length" @click="summon">收一批问题</OqButton>
            </div>

            <!-- 工具面板：顶部细浮条上那一个工具键开的就是它 -->
            <OqPanel
                v-if="panel === 'tools'"
                title="回答箱"
                :subtitle="worldLabel ? ('世界观 · ' + worldLabel) : ''"
                tall
                @close="closePanel"
            >
                <div class="oq-panel-actions">
                    <OqButton variant="primary" block :loading="running" :disabled="!people.length" @click="summon">
                        再收一批问题
                    </OqButton>
                </div>

                <label class="oq-field">
                    <span class="oq-field-label">给所有人的补充设定</span>
                    <textarea
                        v-model="customPrompt"
                        class="oq-input"
                        rows="3"
                        placeholder="例如：最近这个世界正在下一场停不了的雨，大家都有点睡不好"
                    ></textarea>
                    <span class="oq-field-hint">会拼进每一次请求,三个匿名页面共用这一段</span>
                </label>

                <OqSwitch v-model="disableEmoji" label="不要 emoji" hint="只出纯文字" />
                <OqSwitch
                    v-model="shareToMurmur"
                    label="让他们在 murmur 里记得这件事"
                    hint="开着才会注册那张提示词卡。用户仍然看不到是谁问的"
                />

                <div class="oq-panel-list">
                    <p class="oq-panel-list-title">在场的人（{{ people.length }}）</p>
                    <p class="oq-panel-list-body">{{ people.map(p => p.name).join('、') || '还没有人' }}</p>
                    <p class="oq-field-hint">名字只在这里出现一次,箱子里不会显示</p>
                </div>

                <template #foot>
                    <OqButton variant="danger" block :disabled="!questions.length" @click="clearAll">
                        清空整个箱子
                    </OqButton>
                </template>
            </OqPanel>
        </div>
    `,
};

export default OqViewAskbox;
