/**
 * 小奇怪 · 五子棋
 *
 * 玩法来自 `QAQ/小奇怪/555`(五子棋 AI 对战原型),按项目规范重写:
 *
 *   规则判定    全在 gomoku-engine(JS 判胜负,AGENTS.md §7)
 *   AI 落子     services/board-ai:模型回 {"x","y","line"},
 *               没 Key / 回废话 → 引擎本地棋手兜底,永远给合法格
 *   驱动        watch tickKey → tick(),和扫雷 / 你有我没有同一套
 *   分享        终局一键发 murmur 的 game_record 卡
 *
 * 棋盘用 CSS grid 画 15×15 交叉点:手机宽度下每格 ~23px,点得准;
 * 最后一手描个圈,赢了的五连整条亮起来。
 */

import * as store from '../store.js';
import * as go from '../services/gomoku-engine.js';
import * as boardAi from '../services/board-ai.js';
import * as ai from '../services/ai-service.js';
import { GAME_GOMOKU } from '../constants.js';
import { islandIcon } from '../icons.js';
import { SHARED_COMPONENTS } from './shared.js';
import { OqSeatSetup, OqShareSheet } from './game-common.js';

const AI_PACE_MS = 620;

export const OqGameGomoku = {
    name: 'OqGameGomoku',
    components: { ...SHARED_COMPONENTS, OqSeatSetup, OqShareSheet },
    props: {
        app: { type: Object, default: null },
    },
    emits: ['notify'],
    data() {
        return {
            busy: false,
            sharing: false,
        };
    },
    computed: {
        match() { return store.getState().gomoku; },
        size() { return go.SIZE; },
        board() { return this.match ? this.match.board : []; },
        players() { return this.match ? this.match.players : []; },
        finished() { return this.match ? this.match.finished : false; },
        turn() { return this.match ? this.match.turn : 'black'; },
        turnSeat() { return this.players.find((p) => p.id === this.turn) || null; },
        aiSeat() { return this.players.find((p) => p.kind === 'ai') || null; },
        canTap() {
            return Boolean(this.match && !this.finished && this.turnSeat && this.turnSeat.kind !== 'ai' && !this.busy);
        },
        winSet() { return new Set(this.match ? this.match.winLine : []); },
        lastIndex() { return this.match ? this.match.lastIndex : -1; },
        turnText() {
            if (!this.match) return '';
            if (this.finished) {
                if (this.match.winner === 'draw') return '平局';
                return `${go.playerName(this.match, this.match.winner)}赢了`;
            }
            if (this.busy && this.aiSeat) return `${this.aiSeat.name}在想…`;
            const seat = this.turnSeat;
            return seat ? `轮到${seat.name}(${seat.id === 'black' ? '黑' : '白'})` : '';
        },
        logLines() {
            if (!this.match) return [];
            // 落子流水太密,只给最近的,台词和结果都在里面
            return this.match.log.slice(-40).reverse();
        },
        tickKey() {
            if (!this.match) return 'none';
            return [this.match.turn, this.match.moveCount, this.match.finished ? 'end' : 'run'].join('|');
        },
    },
    watch: {
        tickKey: {
            immediate: true,
            handler() { this.$nextTick(() => this.tick()); },
        },
        'match.finished': function onFinished(value) {
            if (value) this.reportEnd();
        },
    },
    beforeUnmount() {
        ai.abortAll();
        if (this._paceTimer) clearTimeout(this._paceTimer);
    },
    methods: {
        // ---------- 开局 ----------
        onStart(payload) {
            // 用户执黑先手;想让 AI 先手的话再开一局换过来也行,先不加开关
            store.newGomoku({ players: payload.players });
            this.$emit('notify', '开了,你执黑先手');
            const island = this.app?.toolkit?.island;
            if (island?.notify && payload.players.some((p) => p.kind === 'ai')) {
                const mate = payload.players.find((p) => p.kind === 'ai');
                island.notify('info', '一起玩 · 五子棋', `和${mate.name}开了一盘,15 路`, {
                    kind: 'oq-match',
                    icon: islandIcon('starFilled'),
                });
            }
        },
        onQuit() {
            ai.abortAll();
            this.busy = false;
            store.endGomoku();
        },
        onReset() {
            const players = this.players.map((p) => ({ name: p.name, kind: p.kind, aiId: p.aiId }));
            store.newGomoku({ players });
            this.$emit('notify', '重摆了一盘');
        },

        // ---------- 落子 ----------
        cellClass(index) {
            const v = this.board[index];
            return {
                'has-stone': Boolean(v),
                'is-black': v === 'black',
                'is-white': v === 'white',
                'is-last': index === this.lastIndex,
                'is-winline': this.winSet.has(index),
            };
        },
        onCellTap(event) {
            const el = event.target?.closest?.('.oq-go-cell');
            if (!el) return;
            const index = Number(el.dataset.index);
            if (!Number.isFinite(index)) return;
            if (!this.match || this.finished) return;
            if (!this.canTap) {
                this.$emit('notify', this.busy && this.aiSeat ? `${this.aiSeat.name}还在想` : `现在是${this.turnSeat ? this.turnSeat.name : '对面'}的回合`);
                return;
            }
            const result = store.placeGomoku(index, this.turn);
            if (!result.ok) {
                const messages = {
                    occupied: '这里已经有子了',
                    finished: '这盘已经下完了',
                    'not-your-turn': '还没轮到你',
                };
                this.$emit('notify', messages[result.reason] || '落不了子');
            }
        },

        // ---------- AI 回合 ----------
        tick() {
            if (!this.match || this.finished || this.busy) return;
            const seat = this.turnSeat;
            if (!seat || seat.kind !== 'ai') return;

            this.busy = true;
            if (this._paceTimer) clearTimeout(this._paceTimer);
            this._paceTimer = setTimeout(() => {
                this._paceTimer = null;
                Promise.resolve(this.runAiTurn(seat)).finally(() => {
                    this.busy = false;
                    this.$nextTick(() => this.tick());
                });
            }, AI_PACE_MS);
        },

        async runAiTurn(seat) {
            const state = this.match;
            if (!state || state.finished) return;
            const signal = ai.createAbort('go-turn');
            const move = await boardAi.gomokuMove({
                state,
                seat: { ...seat, order: 1, stone: seat.id },
                customPrompts: store.listCustomPrompts(),
                signal,
            });
            ai.releaseAbort('go-turn');
            if (!this.match || this.match !== state || state.finished) return;
            if (move.index < 0) return;

            const result = store.placeGomoku(move.index, seat.id);
            if (!result.ok) {
                // 模型和兜底都不该走到这里;真走到了就随缘再挑一格
                const retry = go.pickSmartCell(state, seat.id);
                if (retry >= 0) store.placeGomoku(retry, seat.id);
                return;
            }
            if (move.line) store.gomokuFlavor(seat.id, move.line);
        },

        // ---------- 播报 ----------
        reportEnd() {
            const island = this.app?.toolkit?.island;
            if (!island?.notify || !this.match) return;
            island.notify(
                'success',
                '这盘下完了',
                this.match.winner === 'draw'
                    ? '下满了,平局'
                    : `${go.playerName(this.match, this.match.winner)}五连成型`,
                { kind: 'oq-match', icon: islandIcon('starFilled') },
            );
        },

        seatState(seat) {
            if (!this.match) return '';
            if (this.finished) {
                if (this.match.winner === 'draw') return '平';
                return this.match.winner === seat.id ? '赢了' : '';
            }
            if (this.busy && seat.kind === 'ai' && this.turn === seat.id) return '在想';
            return this.turn === seat.id ? '该他落子' : '等着';
        },
    },
    template: `
        <div class="oq-go">
            <template v-if="!match">
                <OqSeatSetup game="五子棋" start-label="摆盘,开下" @start="onStart" />
                <OqCard title="怎么玩">
                    <ol class="oq-hy-rules">
                        <li>15×15 棋盘,你执黑先手,轮流落子。</li>
                        <li>横、竖、斜任意方向先连成五子的赢。</li>
                        <li>落子无悔;下满整盘算平。没有禁手。</li>
                        <li>拉 AI 玩时,它会带着 nook 里的人设边下边说。</li>
                    </ol>
                </OqCard>
            </template>

            <template v-else>
                <!-- 卡片一:座位 -->
                <OqCard step="01" title="棋桌" :hint="turnText">
                    <template #extra>
                        <OqButton size="sm" icon-name="close" icon-only label="退出这盘" @click="onQuit" />
                    </template>
                    <div class="oq-ms-seats">
                        <div
                            v-for="p in players"
                            :key="p.id"
                            class="oq-ms-seat"
                            :class="{ 'is-turn': !finished && turn === p.id, 'is-win': finished && match.winner === p.id }"
                            :data-stone="p.id"
                        >
                            <span class="oq-go-stonemark" :data-stone="p.id" aria-hidden="true"></span>
                            <span class="oq-ms-seat-name">{{ p.name }}</span>
                            <span class="oq-ms-seat-state">{{ p.kind === 'ai' ? 'AI · ' : '' }}{{ seatState(p) }}</span>
                        </div>
                    </div>
                </OqCard>

                <!-- 卡片二:棋盘 -->
                <OqCard step="02" title="棋盘" :hint="'第 ' + (match.moveCount + (finished ? 0 : 1)) + ' 手'">
                    <div
                        class="oq-go-board"
                        :class="{ 'is-locked': !canTap }"
                        :style="{ '--oq-go-size': size }"
                        role="grid"
                        aria-label="五子棋盘"
                        @pointerup="onCellTap"
                    >
                        <button
                            v-for="(v, index) in board"
                            :key="index"
                            type="button"
                            class="oq-go-cell"
                            :class="cellClass(index)"
                            :data-index="index"
                            :aria-label="'交叉点 ' + (index % size + 1) + ' ' + (Math.floor(index / size) + 1)"
                        ><i class="oq-go-stone" aria-hidden="true"></i></button>
                    </div>
                    <p class="oq-ms-tip">点交叉点落子。{{ aiSeat ? aiSeat.name + ' 执白。' : '两个人轮流用这台手机。' }}</p>
                </OqCard>

                <!-- 卡片三:实况 -->
                <OqCard step="03" title="实况" hint="最新的在最上面">
                    <div class="oq-ms-log">
                        <p v-if="!logLines.length" class="oq-ms-log-empty">还没有人落子。</p>
                        <p
                            v-for="line in logLines"
                            :key="line.seq"
                            class="oq-ms-log-line"
                            :data-kind="line.kind"
                        >{{ line.text }}</p>
                    </div>
                </OqCard>

                <!-- 卡片四:收尾 -->
                <OqCard step="04" :title="finished ? '收工' : '这一盘'">
                    <div class="oq-ms-endacts">
                        <OqButton v-if="finished" variant="primary" icon-name="share" @click="sharing = true">分享到 murmur</OqButton>
                        <OqButton variant="quiet" icon-name="refresh" @click="onReset">重摆一盘</OqButton>
                        <OqButton variant="ghost" icon-name="users" @click="onQuit">换个对手</OqButton>
                    </div>
                </OqCard>

                <OqShareSheet
                    v-if="sharing"
                    kind="${GAME_GOMOKU}"
                    :default-contact-id="aiSeat ? aiSeat.aiId : ''"
                    @close="sharing = false"
                    @notify="$emit('notify', $event)"
                />
            </template>
        </div>
    `,
};

export default OqGameGomoku;
