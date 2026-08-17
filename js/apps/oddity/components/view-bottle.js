/**
 * 小奇怪 · 漂流瓶
 *
 * ── 一轮是怎么跑的 ────────────────────────────────────────────────
 *
 *   1. 你先写下自己那只瓶子里的话。
 *   2. 「扔出去」→ 当前世界观下的每个 AI 各写一只瓶子(一次性,串行请求)。
 *   3. **JS 一次性算死配对**:环形错位排列,没有人捡到自己的瓶子。
 *   4. 你看到的是一张海图:
 *        匿名用户 A 的漂流瓶漂到了 匿名用户 B
 *        你的漂流瓶漂到了 匿名用户 D
 *        你捡到了 匿名用户 C 的漂流瓶
 *      —— 从头到尾没有一个真名。
 *   5. 点开任意一组才生成内容:瓶子里写了什么、捡到的人读完说了什么。
 *      你自己捡到的那组由**你**来写读后感,AI 不替你写。
 *
 * ── 为什么配对要在 JS 里算,而不是让模型分 ──────────────────────────
 *
 * 模型分配会出现「A 的瓶子给了 A」和「两个人都捡到同一只」。
 * 这不是可以容忍的小概率瑕疵 —— 一旦出现,这一轮就没得玩了。
 * 环形错位(`anon.pairUp`)在数学上保证:n 个人 → n 组、互不重复、无自环。
 *
 * ── 代号 ──────────────────────────────────────────────────────────
 *
 * 代号在扔出去那一刻定死并打乱,和名单顺序无关(见 anon.mintAliases)。
 */

import * as store from '../store.js';
import * as anon from '../services/anon-service.js';
import { makeId, asArray, truncate, formatDate } from '../utils.js';
import { anonMixin, ANON_COMPONENTS } from './anon-common.js';

const BOX = 'bottle';
const ME = 'me';

export const OqViewBottle = {
    name: 'OqViewBottle',
    components: { ...ANON_COMPONENTS },
    mixins: [anonMixin],
    data() {
        return {
            myText: '',
            composing: false,
            /** 正在看哪一组：`${roundId}::${from}>${to}` */
            openKey: '',
            myNote: '',
            editingKey: '',
            editText: '',
        };
    },
    computed: {
        rounds() { return store.anonList(BOX); },
        latest() { return this.rounds[0] || null; },
        statusText() {
            if (!this.people.length) return '当前世界观里还没有 AI 角色';
            if (!this.rounds.length) return `${this.people.length + 1} 只瓶子可以一起扔下海`;
            return `扔过 ${this.rounds.length} 轮,最近一轮 ${this.latest.pairs.length} 只瓶子`;
        },
        openPair() {
            if (!this.openKey) return null;
            const [roundId, pairKey] = this.openKey.split('::');
            const round = store.anonFind(BOX, roundId);
            if (!round) return null;
            const [from, to] = String(pairKey).split('>');
            const sender = this.memberOf(round, from);
            const reader = this.memberOf(round, to);
            if (!sender || !reader) return null;
            return { round, pairKey, from, to, sender, reader };
        },
    },
    methods: {
        memberOf(round, key) {
            return asArray(round?.members).find((m) => m.key === String(key)) || null;
        },
        labelOf(member) {
            return member?.isMe ? '你' : (member?.alias || '某人');
        },
        pairKey(pair) {
            return `${pair.from}>${pair.to}`;
        },
        /** 一行海图文案。三种语气:与我无关 / 我扔的 / 我捡的 */
        pairLine(round, pair) {
            const sender = this.memberOf(round, pair.from);
            const reader = this.memberOf(round, pair.to);
            if (reader?.isMe) return `你捡到了 ${sender?.alias || '某人'} 的漂流瓶`;
            if (sender?.isMe) return `你的漂流瓶漂到了 ${reader?.alias || '某人'} 那里`;
            return `${sender?.alias || '某人'} 的漂流瓶漂到了 ${reader?.alias || '某人'} 那里`;
        },
        pairTone(round, pair) {
            const reader = this.memberOf(round, pair.to);
            const sender = this.memberOf(round, pair.from);
            if (reader?.isMe) return 'mine-in';
            if (sender?.isMe) return 'mine-out';
            return '';
        },
        threadOf(round, pairKey) {
            return asArray(round?.threads?.[pairKey]);
        },
        roundDate(round) {
            return formatDate(round.createdAt);
        },

        // ---------- 扔一轮 ----------
        openCompose() {
            if (!this.guard()) return;
            this.composing = true;
        },

        async throwRound() {
            const mine = this.myText.trim();
            if (!mine) return;
            if (!this.guard()) return;

            const people = this.people;
            // 用户也占一个位置 —— 代号一起发,免得「唯一没有代号的那个就是你」
            const aliases = anon.mintAliases(people.length + 1);
            const members = [
                { key: ME, alias: aliases[0], aiId: '', name: '我', isMe: true, text: mine },
                ...people.map((ai, i) => ({
                    key: ai.id, alias: aliases[i + 1], aiId: ai.id, name: ai.name, isMe: false, text: '',
                })),
            ];

            const round = {
                id: makeId('r'),
                createdAt: Date.now(),
                members,
                pairs: [],
                threads: {},
            };
            store.anonAdd(BOX, round);
            this.myText = '';
            this.composing = false;

            const written = await this.runBatch(people, async (ai, index) => {
                const res = await anon.writeBottle(ai, index, this.aiOpts);
                if (!res.ok) return false;
                const target = this.memberOf(store.anonFind(BOX, round.id), ai.id);
                if (target) target.text = res.text;
                return true;
            }, '正在等大家写完');

            // 只有真写出东西来的才下海。空瓶子进配对 = 点开是一张白纸
            const live = store.anonFind(BOX, round.id);
            if (!live) return;
            const keys = asArray(live.members).filter((m) => m.text).map((m) => m.key);
            if (keys.length < 2) {
                store.anonRemove(BOX, round.id);
                this.$emit('notify', written.done ? '瓶子太少了,凑不成一轮' : '一个回应都没等到');
                return;
            }
            store.anonPatch(BOX, round.id, { pairs: anon.pairUp(keys) });
            this.$emit('notify', `${keys.length} 只瓶子下海了`);
        },

        // ---------- 点开一组 ----------
        async open(round, pair) {
            const key = `${round.id}::${this.pairKey(pair)}`;
            if (this.openKey === key) {
                this.openKey = '';
                return;
            }
            this.openKey = key;
            this.myNote = '';
            const reader = this.memberOf(round, pair.to);
            // 我捡到的那只由我自己写读后感,不替我生成
            if (reader?.isMe) return;
            if (this.threadOf(round, this.pairKey(pair)).length) return;
            await this.generate(round, pair);
        },

        /** 让捡到瓶子的那个 AI 说点什么 */
        async generate(round, pair, { replace = false } = {}) {
            const key = this.pairKey(pair);
            const busyId = `${round.id}::${key}`;
            if (this.isBusy(busyId)) return;

            const sender = this.memberOf(round, pair.from);
            const reader = this.memberOf(round, pair.to);
            if (!sender || !reader || reader.isMe) return;
            if (!this.apiReady) {
                this.$emit('notify', '配了 API 之后才能看到 TA 读完说了什么');
                return;
            }

            this.setBusy(busyId, true);
            const readerAi = this.people.find((p) => p.id === reader.aiId) || { id: reader.aiId, name: reader.name };
            const res = await anon.readBottle(readerAi, sender.text, {
                ...this.aiOpts,
                thread: replace ? [] : this.threadOf(round, key),
            });
            this.setBusy(busyId, false);

            if (!res.ok) {
                this.$emit('notify', res.error || '这一位没有回应');
                return;
            }
            if (replace) {
                if (round.threads && Array.isArray(round.threads[key])) round.threads[key].length = 0;
            }
            store.anonAppendTurn(BOX, round.id, anon.makeTurn('them', res.text), `threads.${key}`);
        },

        /** 我捡到的那只：写我的读后感 */
        saveMyNote() {
            const pair = this.openPair;
            const text = this.myNote.trim();
            if (!pair || !text) return;
            store.anonAppendTurn(BOX, pair.round.id, anon.makeTurn('me', text), `threads.${pair.pairKey}`);
            this.myNote = '';
            this.$emit('notify', '记下了');
        },

        keepAsFavorite() {
            const pair = this.openPair;
            if (!pair) return;
            store.addFavorite({
                kind: 'bottle',
                title: `${this.labelOf(pair.sender)} 的漂流瓶`,
                content: pair.sender.text,
                meta: { personaName: pair.sender.alias },
            });
            this.$emit('notify', '收进「藏」里了');
        },

        // ---------- 编辑 / 删除 ----------
        startEdit(round, member) {
            this.editingKey = `${round.id}::${member.key}`;
            this.editText = member.text;
        },

        commitEdit() {
            const [roundId, memberKey] = this.editingKey.split('::');
            const round = store.anonFind(BOX, roundId);
            const member = this.memberOf(round, memberKey);
            const text = this.editText.trim();
            if (member && text) {
                member.text = text;
                store.anonTouch(BOX, roundId);
            }
            this.editingKey = '';
            this.editText = '';
            this.$emit('notify', '改好了');
        },

        removeRound(round) {
            store.anonRemove(BOX, round.id);
            if (this.openKey.startsWith(`${round.id}::`)) this.openKey = '';
            this.$emit('notify', '这一轮扔掉了');
        },

        clearAll() {
            store.anonClear(BOX);
            this.openKey = '';
            this.$emit('notify', '海面清空了');
            this.closePanel();
        },

        short(text) {
            return truncate(text, 30);
        },
    },
    template: `
        <div class="oq-anon oq-anon--bottle">
            <OqAnonStatus
                :count="rounds.length"
                :text="statusText"
                :progress="progress"
                :error="error"
            />

            <section v-if="composing" class="oq-anon-card is-draft">
                <header class="oq-anon-card-head">
                    <span class="oq-anon-alias">你的瓶子</span>
                    <span class="oq-anon-flag">没有人会知道是你写的</span>
                </header>
                <OqComposer
                    v-model="myText"
                    placeholder="写点你不打算让任何人认出来的话"
                    submit-label="扔下海"
                    :busy="running"
                    :rows="4"
                    @submit="throwRound"
                    @cancel="composing = false"
                />
            </section>

            <div v-if="rounds.length" class="oq-anon-list">
                <article v-for="round in rounds" :key="round.id" class="oq-bottle-round">
                    <header class="oq-bottle-round-head">
                        <span class="oq-bottle-round-title">{{ roundDate(round) }} 的这一轮</span>
                        <OqMiniBtn tone="danger" @click="removeRound(round)">删除</OqMiniBtn>
                    </header>

                    <ul class="oq-bottle-map">
                        <li
                            v-for="pair in round.pairs"
                            :key="pairKey(pair)"
                            class="oq-bottle-line"
                            :data-tone="pairTone(round, pair)"
                            :class="{ 'is-open': openKey === (round.id + '::' + pairKey(pair)) }"
                        >
                            <button type="button" class="oq-bottle-line-btn" @click="open(round, pair)">
                                <span class="oq-bottle-line-text">{{ pairLine(round, pair) }}</span>
                                <span class="oq-bottle-line-mark">
                                    {{ isBusy(round.id + '::' + pairKey(pair)) ? '拆开中' :
                                       (threadOf(round, pairKey(pair)).length ? '读过' : '未拆') }}
                                </span>
                            </button>
                        </li>
                    </ul>
                </article>
            </div>

            <div v-else-if="!composing && !running" class="oq-anon-empty">
                <p class="oq-anon-empty-title">海面上什么都没有</p>
                <p class="oq-anon-empty-hint">
                    你写一只,这个世界里的每个人各写一只,一起扔下去。<br />
                    谁的瓶子漂到谁手里,当场算好,谁都改不了。
                </p>
                <OqButton variant="primary" :disabled="!people.length" @click="openCompose">写我的那只</OqButton>
            </div>

            <!-- 拆开某一组。★ 工具卡开着时让位 —— 两张小浮窗叠在一起,
                 底下那张只露出一圈边,看着像渲染坏了。 -->
            <OqPanel
                v-if="openPair && panel !== 'tools'"
                :title="labelOf(openPair.sender) + ' 的漂流瓶'"
                :subtitle="labelOf(openPair.reader) + ' 捡到了它'"
                tall
                @close="openKey = ''"
            >
                <div v-if="editingKey !== (openPair.round.id + '::' + openPair.sender.key)" class="oq-bottle-note">
                    <p class="oq-bottle-note-text">{{ openPair.sender.text || '这只瓶子是空的' }}</p>
                </div>
                <OqComposer
                    v-else
                    v-model="editText"
                    placeholder="改写瓶子里的话"
                    submit-label="改好了"
                    :rows="4"
                    @submit="commitEdit"
                    @cancel="editingKey = ''"
                />

                <OqThread
                    :turns="threadOf(openPair.round, openPair.pairKey)"
                    :them-label="labelOf(openPair.reader)"
                />

                <OqComposer
                    v-if="openPair.reader.isMe"
                    v-model="myNote"
                    placeholder="你读完了。想说点什么就写在这里"
                    submit-label="记下来"
                    :rows="3"
                    @submit="saveMyNote"
                    @cancel="myNote = ''"
                />

                <template #foot>
                    <div class="oq-panel-row">
                        <OqMiniBtn
                            v-if="!openPair.reader.isMe"
                            tone="accent"
                            :loading="isBusy(openPair.round.id + '::' + openPair.pairKey)"
                            @click="generate(openPair.round, { from: openPair.from, to: openPair.to }, { replace: true })"
                        >换个反应</OqMiniBtn>
                        <OqMiniBtn @click="startEdit(openPair.round, openPair.sender)">改写瓶子</OqMiniBtn>
                        <OqMiniBtn @click="keepAsFavorite">收藏</OqMiniBtn>
                    </div>
                </template>
            </OqPanel>

            <!-- 工具面板 -->
            <OqPanel
                v-if="panel === 'tools'"
                title="漂流瓶"
                :subtitle="worldLabel ? ('世界观 · ' + worldLabel) : ''"
                tall
                @close="closePanel"
            >
                <div class="oq-panel-actions">
                    <OqButton
                        variant="primary"
                        block
                        :loading="running"
                        :disabled="!people.length"
                        @click="closePanel(); openCompose()"
                    >再扔一轮</OqButton>
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
                    <p class="oq-panel-list-title">配对是怎么定的</p>
                    <p class="oq-panel-list-body">
                        扔下去的那一刻,JS 把所有瓶子排成一个环,每个人捡到环上下一个人的。
                        所以一定不会捡到自己的,也不会两个人捡到同一只。定了就不再变。
                    </p>
                </div>

                <template #foot>
                    <OqButton variant="danger" block :disabled="!rounds.length" @click="clearAll">
                        清空所有轮次
                    </OqButton>
                </template>
            </OqPanel>
        </div>
    `,
};

export default OqViewBottle;
