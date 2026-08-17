/**
 * 小奇怪 · 你有我没有
 *
 * ── 和原型的关系 ──────────────────────────────────────────────────
 *
 * 玩法来自 `QAQ/小奇怪/小游戏你又我`,但**只留了玩法**:
 *
 *   原型                                   现在
 *   ────────────────────────────────────  ──────────────────────────────
 *   公共 MQTT broker 真联机                 单机;状态只有一份,不存在对齐问题
 *   四个写死的角色 + 写死的人设 prompt        座位从 nook 人设里挑,1~3 个
 *   用户在欢迎页粘贴 API Key 并广播出去       走 nook 的 API 管理,每个座位一把
 *   正则从聊天里猜「谁在问谁」                 引擎状态机,不猜
 *   一把 Key 挂了整局停摆                     跳过那个座位继续(AGENTS.md §7)
 *   没有 Key 就完全不能玩                     本地词库兜底,标「本地模式」
 *
 * ── AI 回合怎么跑 ─────────────────────────────────────────────────
 *
 * 一次调用拿一个 JSON,不做流式 —— 一句 15 字的台词流式没有意义,
 * 反而多一层解析。解析失败 = 这个座位这一轮跳过,不是整局失败。
 *
 * 驱动方式是「看着状态变化决定要不要动手」(watch → tick),
 * 而不是在每个操作后面手动接一句 `runNextAi()` ——
 * 后者只要漏掉一处,牌局就会卡在某个 AI 的回合上,而且不报错。
 */

import * as store from '../store.js';
import * as hy from '../services/haveyou-engine.js';
import * as nook from '../services/nook-bridge.js';
import * as ai from '../services/ai-service.js';
import { buildPrompt, buildUserTurn, collectSources } from '../services/prompt-builder.js';
import { GAME_HAVEYOU, HY, HY_RULES } from '../constants.js';
import { islandIcon } from '../icons.js';
import { asArray, parseLooseJson, truncate } from '../utils.js';
import { SHARED_COMPONENTS } from './shared.js';
import { OqShareSheet } from './game-common.js';

/** AI 座位之间留一点间隔,不然三条回复会在同一帧刷完,读不过来 */
const AI_PACE_MS = 500;

export const OqGameHaveyou = {
    name: 'OqGameHaveyou',
    components: { ...SHARED_COMPONENTS, OqShareSheet },
    props: {
        app: { type: Object, default: null },
    },
    emits: ['notify'],
    data() {
        return {
            rules: HY_RULES,
            /** 建局界面:候选人设 + 勾选的 id */
            candidates: [],
            picked: [],
            sdkReady: false,
            /** 正在等某个座位的模型返回 */
            busySeatId: '',
            /** 用户输入的声明 */
            draft: '',
            /** 上下文面板 */
            showContext: false,
            contextParts: [],
            /** 分享面板 */
            sharing: false,
        };
    },
    computed: {
        match() {
            return store.getState().haveyou;
        },
        seats() {
            return this.match ? this.match.seats : [];
        },
        userSeat() {
            return this.seats.find((seat) => seat.kind === 'user') || null;
        },
        current() {
            return this.match ? hy.currentSeat(this.match) : null;
        },
        /** 轮到用户出声明 */
        myClaimTurn() {
            return Boolean(
                this.match && !this.match.finished
                && this.match.phase === 'claim'
                && this.current?.kind === 'user',
            );
        },
        /** 轮到用户表态 */
        myRespondTurn() {
            if (!this.match || this.match.phase !== 'respond') return false;
            return hy.pendingResponders(this.match).some((seat) => seat.kind === 'user');
        },
        pendingAi() {
            if (!this.match || this.match.finished) return null;
            if (this.match.phase === 'claim') {
                return this.current?.kind === 'ai' ? this.current : null;
            }
            if (this.match.phase === 'respond') {
                return hy.pendingResponders(this.match).find((seat) => seat.kind === 'ai') || null;
            }
            return null;
        },
        logLines() {
            return this.match ? this.match.log.slice(-60) : [];
        },
        modeLabel() {
            if (!this.match) return '';
            return this.match.mode === 'local' ? '本地模式' : 'AI 模式';
        },
        apiHint() {
            return nook.listApiRefs().length ? '' : nook.describeMissingApi();
        },
        winnerName() {
            if (!this.match?.finished) return '';
            const seat = this.seats.find((s) => s.id === this.match.winnerId);
            return seat ? seat.name : '';
        },
        canStart() {
            return this.picked.length >= 1;
        },
        claimMax() {
            return HY.claimMaxChars;
        },
        maxSeats() {
            return HY.maxAiSeats;
        },
        /**
         * 驱动信号。
         *
         * 把「该不该轮到 AI 动手」压成一个字符串,watch 它 —— 状态怎么变的不重要,
         * 变完之后该谁动手才重要。这样任何一条改状态的路径都不会漏掉驱动。
         */
        tickKey() {
            if (!this.match) return 'none';
            return [
                this.match.phase,
                this.match.turnIndex,
                this.match.roundNo,
                asArray(this.match.round?.responses).length,
                this.match.finished ? 'end' : 'run',
            ].join('|');
        },
    },
    watch: {
        tickKey: {
            immediate: true,
            handler() {
                this.$nextTick(() => this.tick());
            },
        },
        'match.finished': function onFinished(value) {
            if (value) this.reportEnd();
        },
    },
    mounted() {
        this.refreshCandidates();
    },
    beforeUnmount() {
        // 离开页面时把所有在飞的请求掐掉,免得回来之后突然蹦出三条旧台词
        ai.abortAll();
        if (this._paceTimer) clearTimeout(this._paceTimer);
    },
    methods: {
        // ---------- 建局 ----------
        async refreshCandidates() {
            this.sdkReady = nook.isReady();
            if (!this.sdkReady) {
                await nook.whenReady(6000);
                this.sdkReady = nook.isReady();
            }
            const playerCard = nook.getPlayerCard('');
            const world = nook.getWorld('', playerCard);
            this.candidates = nook.listSeatCandidates(world);

            // 上次选过的那几位如果还在,默认勾上
            const remembered = asArray(store.getSettings().haveyouSeatIds);
            const alive = remembered.filter((id) => this.candidates.some((c) => c.id === id));
            this.picked = alive.length
                ? alive.slice(0, HY.maxAiSeats)
                : this.candidates.slice(0, 2).map((c) => c.id);
        },

        togglePick(aiId) {
            const index = this.picked.indexOf(aiId);
            if (index >= 0) {
                this.picked.splice(index, 1);
                return;
            }
            if (this.picked.length >= HY.maxAiSeats) {
                this.$emit('notify', `最多 ${HY.maxAiSeats} 个 AI 座位`);
                return;
            }
            this.picked.push(aiId);
        },

        startMatch() {
            if (!this.canStart) {
                this.$emit('notify', '至少挑一个人陪你玩');
                return;
            }
            const playerCard = nook.getPlayerCard('');
            const seats = [
                { id: 'me', name: playerCard?.name || '我', kind: 'user', aiId: '' },
                ...this.picked.map((aiId, index) => {
                    const card = this.candidates.find((c) => c.id === aiId);
                    return { id: `ai-${index}`, name: card?.name || `对家 ${index + 1}`, kind: 'ai', aiId };
                }),
            ];
            const mode = nook.listApiRefs().length ? 'ai' : 'local';
            store.newHaveyou({ seats, mode });
            this.draft = '';
            if (mode === 'local') {
                this.$emit('notify', '没找到可用 Key,这局走本地模式');
            }
        },

        quitMatch() {
            ai.abortAll();
            store.endHaveyou();
            this.busySeatId = '';
            this.refreshCandidates();
        },

        // ---------- 用户操作 ----------
        submitDraft() {
            const text = this.draft.trim();
            if (!text) return;
            if (hy.isDuplicateClaim(this.match, text)) {
                this.$emit('notify', '这句之前说过了,换一个吧(硬要说会扣 1 点)');
            }
            const result = store.runHaveyou((state) => hy.submitClaim(state, {
                seatId: this.userSeat?.id,
                text,
            }));
            if (!result.ok) {
                const messages = {
                    'not-your-turn': '还没轮到你',
                    empty: '写点什么',
                    'too-long': `${HY.claimMaxChars} 字以内`,
                };
                this.$emit('notify', messages[result.reason] || '出不了牌');
                return;
            }
            this.draft = '';
        },

        answer(has) {
            store.runHaveyou((state) => hy.submitResponse(state, {
                seatId: this.userSeat?.id,
                has,
            }));
        },

        // ---------- AI 驱动 ----------
        /**
         * 看一眼现在该不该动手。
         *
         * `busySeatId` 是唯一的并发闸:同一时刻只允许一个座位在跑模型。
         * 三个座位一起发的话既看不清顺序,也容易同时撞同一把 Key 的限流。
         */
        tick() {
            if (!this.match || this.match.finished) return;
            if (this.busySeatId) return;
            const seat = this.pendingAi;
            if (!seat) return;

            this.busySeatId = seat.id;
            if (this._paceTimer) clearTimeout(this._paceTimer);
            this._paceTimer = setTimeout(() => {
                this._paceTimer = null;
                const phase = this.match?.phase;
                const run = phase === 'claim' ? this.runAiClaim(seat) : this.runAiRespond(seat);
                Promise.resolve(run).finally(() => {
                    this.busySeatId = '';
                    // 跑完顺手再看一眼:下一个座位可能也是 AI
                    this.$nextTick(() => this.tick());
                });
            }, AI_PACE_MS);
        },

        /** 组装这个座位这一轮的 prompt。预览和发送共用它 —— 保证「看到的就是发出去的」 */
        composeFor(seat, kind, extra = {}) {
            const library = store.getLibrary();
            const sources = collectSources({ state: this.match, seat, library });
            const prompt = buildPrompt(
                { sources, config: library.contextConfig, order: library.contextOrder, kind },
                { save: extra.save !== false },
            );
            return { sources, prompt };
        },

        async runAiClaim(seat) {
            if (this.match.mode === 'local') {
                const text = hy.pickLocalClaim(this.match);
                store.runHaveyou((state) => hy.submitClaim(state, {
                    seatId: seat.id,
                    text,
                    line: hy.localFlavor(true),
                }));
                return;
            }

            const { sources, prompt } = this.composeFor(seat, 'claim');
            const apiRef = nook.resolveApiRefFor(sources.aiCard, seat.order);
            if (!apiRef) {
                store.runHaveyou((state) => hy.skipClaimer(state, seat.id, '没有可用的 Key'));
                return;
            }

            const signal = ai.createAbort(seat.id);
            const res = await ai.generate({
                apiRef,
                systemPrompt: prompt.text,
                userTurn: buildUserTurn({ kind: 'claim', roundNo: this.match.roundNo }),
                signal,
            });
            ai.releaseAbort(seat.id);
            if (!this.match) return;   // 组件已经卸载 / 用户退出了这局

            const data = res.ok ? parseLooseJson(res.text) : null;
            const claim = String(data?.claim || '').trim();
            if (!claim) {
                // ★ 失败跳过这个座位,不掐整局(AGENTS.md §7)
                store.runHaveyou((state) => hy.skipClaimer(state, seat.id, res.error || '没解析出内容'));
                return;
            }
            store.runHaveyou((state) => hy.submitClaim(state, {
                seatId: seat.id,
                text: truncate(claim, HY.claimMaxChars),
                line: truncate(String(data?.line || ''), 30),
            }));
        },

        async runAiRespond(seat) {
            const round = this.match?.round;
            if (!round) return;
            const claimer = hy.getSeat(this.match, round.claimSeatId);

            if (this.match.mode === 'local') {
                const has = hy.localResponse(seat.id, round.key);
                store.runHaveyou((state) => hy.submitResponse(state, {
                    seatId: seat.id,
                    has,
                    line: hy.localFlavor(has),
                }));
                return;
            }

            const { sources, prompt } = this.composeFor(seat, 'respond');
            const apiRef = nook.resolveApiRefFor(sources.aiCard, seat.order);
            if (!apiRef) {
                store.runHaveyou((state) => hy.skipResponder(state, seat.id, '没有可用的 Key'));
                return;
            }

            const signal = ai.createAbort(seat.id);
            const res = await ai.generate({
                apiRef,
                systemPrompt: prompt.text,
                userTurn: buildUserTurn({
                    kind: 'respond',
                    claimText: round.text,
                    claimerName: claimer?.name || '有人',
                }),
                signal,
            });
            ai.releaseAbort(seat.id);
            if (!this.match) return;

            const data = res.ok ? parseLooseJson(res.text) : null;
            if (!data || typeof data.has !== 'boolean') {
                store.runHaveyou((state) => hy.skipResponder(state, seat.id, res.error || '没解析出内容'));
                return;
            }
            store.runHaveyou((state) => hy.submitResponse(state, {
                seatId: seat.id,
                has: data.has,
                line: truncate(String(data.line || ''), 30),
            }));
        },

        // ---------- 上下文面板 ----------
        /**
         * 「这一轮会发出去什么」。
         *
         * ★ 预览走 `save: false` —— 预览是个按钮,点一次写一次 localStorage
         *   会把真正发出去的那份快照冲掉。内容本身和发送**是同一个函数产出的**。
         */
        toggleContext() {
            this.showContext = !this.showContext;
            if (!this.showContext) return;
            const seat = this.pendingAi || this.seats.find((s) => s.kind === 'ai');
            if (!seat) {
                this.contextParts = [];
                return;
            }
            const kind = this.match?.phase === 'respond' ? 'respond' : 'claim';
            const { prompt } = this.composeFor(seat, kind, { save: false });
            this.contextParts = prompt.parts;
        },

        // ---------- 播报 ----------
        reportEnd() {
            const island = this.app?.toolkit?.island;
            if (!island?.notify || !this.match) return;
            island.notify(
                'success',
                '这局收了',
                this.winnerName ? `${this.winnerName}是最后活着的那个` : '所有人都出局了',
                { kind: 'oq-toast', icon: islandIcon('starFilled') },
            );
        },

        seatState(seat) {
            if (!seat.alive) return '出局';
            if (this.match.finished) return seat.id === this.match.winnerId ? '赢了' : '还站着';
            if (this.busySeatId === seat.id) return '在想';
            if (this.match.phase === 'claim' && this.current?.id === seat.id) return '该他说';
            if (this.match.phase === 'respond' && hy.pendingResponders(this.match).some((s) => s.id === seat.id)) return '等表态';
            return '';
        },
    },
    template: `
        <div class="oq-hy">
            <!-- 建局 -->
            <template v-if="!match">
                <OqCard title="挑几个人陪你玩" :hint="'最多 ' + maxSeats + ' 个'">
                    <p v-if="!sdkReady" class="oq-hy-tip">正在连接 nook…</p>
                    <OqEmpty
                        v-else-if="!candidates.length"
                        icon-name="users"
                        text="nook 里还没有 AI 人设"
                        hint="去 nook →「人设」建一个,回来就能坐上桌"
                    />
                    <div v-else class="oq-hy-picker">
                        <button
                            v-for="card in candidates"
                            :key="card.id"
                            type="button"
                            class="oq-hy-pick"
                            :class="{ 'is-on': picked.includes(card.id) }"
                            @click="togglePick(card.id)"
                        >
                            <span class="oq-hy-pick-name">{{ card.name }}</span>
                            <span class="oq-hy-pick-sub">{{ card.personality || card.bio || '没写性格' }}</span>
                        </button>
                    </div>
                    <p v-if="apiHint" class="oq-hy-tip is-warn">{{ apiHint }}</p>
                    <OqButton variant="primary" block :disabled="!canStart" @click="startMatch">开一局</OqButton>
                </OqCard>

                <OqCard title="怎么玩">
                    <ol class="oq-hy-rules">
                        <li v-for="(line, index) in rules" :key="index">{{ line }}</li>
                    </ol>
                </OqCard>
            </template>

            <!-- 对局 -->
            <template v-else>
                <OqCard :title="'第 ' + match.roundNo + ' 轮'" :hint="modeLabel">
                    <template #extra>
                        <OqButton size="sm" icon-name="close" icon-only label="退出这局" @click="quitMatch" />
                    </template>
                    <div class="oq-hy-seats">
                        <div
                            v-for="seat in seats"
                            :key="seat.id"
                            class="oq-hy-seat"
                            :class="{ 'is-out': !seat.alive, 'is-turn': current && current.id === seat.id && !match.finished }"
                        >
                            <span class="oq-hy-seat-name">{{ seat.name }}</span>
                            <OqLives :value="seat.lives" :max="5" />
                            <span class="oq-hy-seat-state">{{ seatState(seat) }}</span>
                        </div>
                    </div>
                </OqCard>

                <OqCard title="牌桌">
                    <div class="oq-hy-feed">
                        <p
                            v-for="line in logLines"
                            :key="line.seq"
                            class="oq-hy-line"
                            :data-kind="line.kind"
                        >{{ line.text }}</p>
                        <p v-if="busySeatId" class="oq-hy-line" data-kind="thinking">
                            <span class="oq-hy-dots"><i></i><i></i><i></i></span>
                        </p>
                    </div>
                </OqCard>

                <!-- 行动区 -->
                <OqCard v-if="!match.finished" title="该你了" :hint="myClaimTurn ? '说一件他们大概没有的事' : (myRespondTurn ? '表个态' : '')">
                    <template v-if="myClaimTurn">
                        <OqInput
                            v-model="draft"
                            :maxlength="claimMax"
                            placeholder="比如:在便利店门口站着把关东煮吃完过"
                            @enter="submitDraft"
                        />
                        <div class="oq-hy-actions">
                            <span class="oq-hy-count">{{ draft.length }} / {{ claimMax }}</span>
                            <OqButton variant="primary" icon-name="send" :disabled="!draft.trim()" @click="submitDraft">我有这个</OqButton>
                        </div>
                    </template>
                    <template v-else-if="myRespondTurn">
                        <p class="oq-hy-ask">「{{ match.round ? match.round.text : '' }}」—— 你有吗?</p>
                        <div class="oq-hy-actions">
                            <OqButton variant="primary" @click="answer(true)">我也有</OqButton>
                            <OqButton variant="ghost" @click="answer(false)">我没有</OqButton>
                        </div>
                    </template>
                    <p v-else class="oq-hy-tip">等{{ (pendingAi && pendingAi.name) || '对家' }}…</p>
                </OqCard>

                <!-- 结束 -->
                <OqCard v-else title="收工">
                    <p class="oq-hy-winner">{{ winnerName ? winnerName + ' 是最后一个还站着的。' : '所有人都躺下了,算平。' }}</p>
                    <div class="oq-hy-actions">
                        <OqButton variant="primary" icon-name="share" @click="sharing = true">分享到 murmur</OqButton>
                        <OqButton variant="quiet" icon-name="refresh" @click="quitMatch">换一批人再来</OqButton>
                    </div>
                </OqCard>

                <OqShareSheet
                    v-if="sharing"
                    kind="${GAME_HAVEYOU}"
                    :default-contact-id="(seats.find(s => s.kind === 'ai') || {}).aiId || ''"
                    @close="sharing = false"
                    @notify="$emit('notify', $event)"
                />

                <!-- 上下文 -->
                <OqCard v-if="match.mode !== 'local'" title="这一轮发出去什么" flat>
                    <template #extra>
                        <OqButton size="sm" variant="ghost" @click="toggleContext">{{ showContext ? '收起' : '看看' }}</OqButton>
                    </template>
                    <div v-if="showContext" class="oq-hy-context">
                        <div
                            v-for="part in contextParts"
                            :key="part.id"
                            class="oq-hy-part"
                            :class="{ 'is-off': !part.included }"
                        >
                            <div class="oq-hy-part-head">
                                <span class="oq-hy-part-title">{{ part.title }}</span>
                                <span class="oq-hy-part-meta">{{ part.source }} · {{ part.tokens }} tok</span>
                            </div>
                            <pre class="oq-hy-part-body">{{ part.content || '(这一段是空的)' }}</pre>
                        </div>
                        <p v-if="!contextParts.length" class="oq-hy-tip">没有 AI 座位在等着说话。</p>
                    </div>
                </OqCard>
            </template>
        </div>
    `,
};

export default OqGameHaveyou;
