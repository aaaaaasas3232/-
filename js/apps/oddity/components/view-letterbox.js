/**
 * 小奇怪 · 匿名收信箱
 *
 * ── 和回答箱**方向相反** ──────────────────────────────────────────
 *
 *   回答箱  AI 匿名问用户 —— AI 知道你是谁,你不知道 AI 是谁。
 *   收信箱  用户匿名问 AI —— 你知道写给谁,AI 不知道是谁写的。
 *
 * ★ 所以这一页的 prompt **绝对不能拼用户人设卡**。
 *   拼进去 AI 就会在回信里叫出用户的名字,玩法当场塌掉,而且一行报错都没有。
 *   这条约束落在 `services/anon-service.js` 的 `buildLetterboxSystem()` 里 ——
 *   那个函数连 playerCard 这个参数都不接,想拼也拼不进去。
 *
 * ★ 收信人是**用户自己挑的**,所以这一侧显示真名是对的,不是泄漏。
 */

import * as store from '../store.js';
import * as anon from '../services/anon-service.js';
import { makeId, asArray, truncate } from '../utils.js';
import { anonMixin, ANON_COMPONENTS } from './anon-common.js';

const BOX = 'letterbox';

export const OqViewLetterbox = {
    name: 'OqViewLetterbox',
    components: { ...ANON_COMPONENTS },
    mixins: [anonMixin],
    data() {
        return {
            composing: false,
            draftTo: '',
            draftText: '',
            /** 正在往哪封信里追问 */
            followId: '',
            followText: '',
            editingId: '',
            editText: '',
        };
    },
    computed: {
        letters() { return store.anonList(BOX); },
        recipient() {
            return this.people.find((p) => p.id === this.draftTo) || this.people[0] || null;
        },
        statusText() {
            if (!this.people.length) return '当前世界观里还没有 AI 角色';
            if (!this.letters.length) return `可以往 ${this.people.length} 个人的信箱里投信,他们都不会知道是你`;
            const waiting = this.letters.filter((l) => !asArray(l.thread).some((t) => t.role === 'them')).length;
            return waiting
                ? `寄出去 ${this.letters.length} 封,${waiting} 封还没回音`
                : `寄出去 ${this.letters.length} 封,都回了`;
        },
    },
    mounted() {
        if (!this.draftTo && this.people.length) this.draftTo = this.people[0].id;
    },
    methods: {
        // ---------- 写一封新的 ----------
        openCompose() {
            if (!this.people.length) {
                this.$emit('notify', '当前世界观里还没有 AI 角色,先去 nook 添加');
                return;
            }
            if (!this.draftTo) this.draftTo = this.people[0].id;
            this.composing = true;
            this.followId = '';
            this.editingId = '';
        },

        async send() {
            const text = this.draftText.trim();
            const target = this.recipient;
            if (!text || !target) return;

            const letter = {
                id: makeId('l'),
                aiId: target.id,
                aiName: target.name,
                text,
                thread: [anon.makeTurn('me', text)],
                createdAt: Date.now(),
            };
            store.anonAdd(BOX, letter);
            this.draftText = '';
            this.composing = false;
            this.expanded[letter.id] = true;

            if (!this.apiReady) {
                this.$emit('notify', '信投进去了。配了 API 之后才会有回音');
                return;
            }
            await this.fetchReply(letter.id);
        },

        /** 让收信人回一封。`replaceLast` 用于「换一个回音」 */
        async fetchReply(letterId, { replaceLast = false } = {}) {
            const letter = store.anonFind(BOX, letterId);
            if (!letter || this.isBusy(letterId)) return;
            const target = this.people.find((p) => p.id === letter.aiId)
                || { id: letter.aiId, name: letter.aiName };

            this.setBusy(letterId, true);
            const history = replaceLast
                ? { ...letter, thread: asArray(letter.thread).filter((t, i, arr) => !(t.role === 'them' && i === arr.length - 1)) }
                : letter;
            const res = await anon.replyLetter(target, history, this.aiOpts);
            this.setBusy(letterId, false);

            if (!res.ok) {
                this.$emit('notify', res.error || `${letter.aiName} 没有回信`);
                return;
            }
            if (replaceLast) {
                const list = asArray(letter.thread);
                if (list.length && list[list.length - 1].role === 'them') list.pop();
            }
            store.anonAppendTurn(BOX, letterId, anon.makeTurn('them', res.text));
        },

        // ---------- 继续追问 ----------
        startFollow(letter) {
            this.followId = this.followId === letter.id ? '' : letter.id;
            this.followText = '';
            this.composing = false;
            this.editingId = '';
        },

        async sendFollow(letter) {
            const text = this.followText.trim();
            if (!text || this.isBusy(letter.id)) return;
            store.anonAppendTurn(BOX, letter.id, anon.makeTurn('me', text));
            this.followText = '';
            this.expanded[letter.id] = true;
            if (!this.apiReady) return;
            await this.fetchReply(letter.id);
        },

        // ---------- 编辑 / 删除 ----------
        startEdit(letter) {
            this.editingId = letter.id;
            this.editText = letter.text;
            this.followId = '';
        },

        commitEdit() {
            const text = this.editText.trim();
            if (!text) return;
            const letter = store.anonFind(BOX, this.editingId);
            if (letter) {
                // 首轮就是这封信本身,改正文要连着改第一轮,否则 AI 读到的还是旧的
                const first = asArray(letter.thread).find((t) => t.role === 'me');
                if (first) first.text = text;
            }
            store.anonPatch(BOX, this.editingId, { text });
            this.editingId = '';
            this.editText = '';
            this.$emit('notify', '已改写');
        },

        remove(letter) {
            store.anonRemove(BOX, letter.id);
            if (this.followId === letter.id) this.followId = '';
            if (this.editingId === letter.id) this.editingId = '';
            this.$emit('notify', '这封信收回来了');
        },

        clearAll() {
            store.anonClear(BOX);
            this.$emit('notify', '信箱清空了');
            this.closePanel();
        },

        lastReply(letter) {
            const list = asArray(letter.thread).filter((t) => t.role === 'them');
            return list.length ? list[list.length - 1] : null;
        },

        shortName(letter) {
            return truncate(letter.aiName || '某人', 8);
        },
    },
    template: `
        <div class="oq-anon oq-anon--letter">
            <OqAnonStatus
                :count="letters.length"
                :text="statusText"
                :progress="progress"
                :error="error"
            />

            <!-- 写新信 -->
            <section v-if="composing" class="oq-anon-card is-draft">
                <header class="oq-anon-card-head">
                    <span class="oq-anon-alias">寄给</span>
                    <span class="oq-anon-flag">署名：匿名</span>
                </header>
                <div class="oq-anon-picker">
                    <button
                        v-for="p in people"
                        :key="p.id"
                        type="button"
                        class="oq-chip"
                        :class="{ 'is-active': draftTo === p.id }"
                        @click="draftTo = p.id"
                    >{{ p.name }}</button>
                </div>
                <OqComposer
                    v-model="draftText"
                    placeholder="问点你当面问不出口的。TA 不会知道是你"
                    submit-label="投进信箱"
                    :busy="running"
                    @submit="send"
                    @cancel="composing = false"
                />
            </section>

            <div v-if="letters.length" class="oq-anon-list">
                <article
                    v-for="l in letters"
                    :key="l.id"
                    class="oq-anon-card"
                    :class="{ 'is-busy': isBusy(l.id) }"
                >
                    <header class="oq-anon-card-head">
                        <span class="oq-anon-alias">寄给 {{ shortName(l) }}</span>
                        <span class="oq-anon-flag">{{ lastReply(l) ? '有回音' : '还没回' }}</span>
                    </header>

                    <p v-if="editingId !== l.id" class="oq-anon-ask is-mine">{{ l.text }}</p>
                    <OqComposer
                        v-else
                        v-model="editText"
                        placeholder="改写这封信"
                        submit-label="改好了"
                        :rows="3"
                        @submit="commitEdit"
                        @cancel="editingId = ''"
                    />

                    <OqThread
                        :turns="l.thread"
                        :them-label="shortName(l)"
                        :collapsed="!isExpanded(l.id)"
                        :limit="3"
                        @expand="toggleExpand(l.id)"
                    />

                    <OqComposer
                        v-if="followId === l.id"
                        v-model="followText"
                        placeholder="再问一句,还是匿名的"
                        submit-label="再投一封"
                        :busy="isBusy(l.id)"
                        :rows="2"
                        @submit="sendFollow(l)"
                        @cancel="followId = ''"
                    />

                    <footer v-if="editingId !== l.id" class="oq-anon-acts">
                        <OqMiniBtn tone="accent" @click="startFollow(l)">
                            {{ followId === l.id ? '不问了' : '再问一句' }}
                        </OqMiniBtn>
                        <OqMiniBtn
                            :loading="isBusy(l.id)"
                            :disabled="!lastReply(l)"
                            @click="fetchReply(l.id, { replaceLast: true })"
                        >换个回音</OqMiniBtn>
                        <OqMiniBtn @click="startEdit(l)">改写</OqMiniBtn>
                        <OqMiniBtn tone="danger" @click="remove(l)">删除</OqMiniBtn>
                    </footer>
                </article>
            </div>

            <div v-else-if="!composing && !running" class="oq-anon-empty">
                <p class="oq-anon-empty-title">还没寄出过</p>
                <p class="oq-anon-empty-hint">
                    挑一个人,写一封不署名的信。<br />
                    TA 读得到内容,但不会知道是你写的。
                </p>
                <OqButton variant="primary" :disabled="!people.length" @click="openCompose">写一封</OqButton>
            </div>

            <OqPanel
                v-if="panel === 'tools'"
                title="收信箱"
                :subtitle="worldLabel ? ('世界观 · ' + worldLabel) : ''"
                tall
                @close="closePanel"
            >
                <div class="oq-panel-actions">
                    <OqButton
                        variant="primary"
                        block
                        :disabled="!people.length"
                        @click="closePanel(); openCompose()"
                    >写一封新的</OqButton>
                </div>

                <label class="oq-field">
                    <span class="oq-field-label">给所有人的补充设定</span>
                    <textarea
                        v-model="customPrompt"
                        class="oq-input"
                        rows="3"
                        placeholder="例如：最近这个世界正在下一场停不了的雨，大家都有点睡不好"
                    ></textarea>
                    <span class="oq-field-hint">三个匿名页面共用这一段</span>
                </label>

                <OqSwitch v-model="disableEmoji" label="不要 emoji" hint="只出纯文字" />

                <div class="oq-panel-list">
                    <p class="oq-panel-list-title">收信人不知道是谁写的</p>
                    <p class="oq-panel-list-body">
                        这一页给 AI 的提示词里不带你的人设卡,只告诉 TA「信箱收到了一封匿名来信」。
                        所以 TA 不会叫出你的名字,也不该猜到具体某个人头上。
                    </p>
                </div>

                <template #foot>
                    <OqButton variant="danger" block :disabled="!letters.length" @click="clearAll">
                        清空信箱
                    </OqButton>
                </template>
            </OqPanel>
        </div>
    `,
};

export default OqViewLetterbox;
