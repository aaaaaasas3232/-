/**
 * 小奇怪 · 扫雷(真实扫雷版)
 *
 * ── 2026-08 重做 ──────────────────────────────────────────────────
 *
 * 旧版要「把道具拖到格子上」才算扫,用户明确反悔:
 * 「扫雷不需要拖动道具啊 就跟真实扫雷一样就好了」,还要「能拉 AI 一起玩」。
 * 现在:
 *
 *   点格子      直接扫(轮到你才有效)
 *   长按格子    插旗 / 拔旗(不消耗回合,插了旗的格子点不动)
 *   对手        开局时选:nook 里的 AI 人设,或本地第二个真人
 *   AI 回合     watch tickKey → 自动动手(和「你有我没有」同一套驱动,
 *               漏一处手动接力就会卡死的教训只吃一次)
 *   AI 怎么选   有 Key:模型看盘面回 {"x","y","line"};没 Key / 回废话:
 *               引擎的本地棋手兜底(约束推理 + 最低风险),永远给合法格
 *
 * 计分规矩不变:轮流扫、+1/−5、连锁只有点的那格计分、10 颗雷。
 */

import * as store from '../store.js';
import * as ms from '../services/minesweeper-engine.js';
import * as boardAi from '../services/board-ai.js';
import * as ai from '../services/ai-service.js';
import { GAME_MINESWEEPER, MS } from '../constants.js';
import { islandIcon } from '../icons.js';
import { SHARED_COMPONENTS } from './shared.js';
import { OqSeatSetup, OqShareSheet } from './game-common.js';
import { asArray } from '../utils.js';

/** AI 出手前留的空档 —— 立刻落子会让人怀疑它根本没看盘 */
const AI_PACE_MS = 650;
/** 长按判定时长 */
const LONG_PRESS_MS = 480;

export const OqGameMinesweeper = {
    name: 'OqGameMinesweeper',
    components: { ...SHARED_COMPONENTS, OqSeatSetup, OqShareSheet },
    props: {
        app: { type: Object, default: null },
    },
    emits: ['notify'],
    data() {
        return {
            axis: Array.from({ length: MS.cols }, (_, i) => i + 1),
            /** 刚落子的那一格,闪一下 */
            flashIndex: -1,
            /** AI 正在想 */
            busy: false,
            /** 分享面板 */
            sharing: false,
        };
    },
    computed: {
        mineTotal() { return MS.mines; },
        match() { return store.getState().minesweeper; },
        cells() { return this.match ? this.match.cells : []; },
        players() { return this.match ? this.match.players : []; },
        scores() { return this.match ? this.match.scores : { p1: 0, p2: 0 }; },
        turn() { return this.match ? this.match.turn : 'p1'; },
        finished() { return this.match ? this.match.finished : false; },
        aiSeat() { return this.players.find((p) => p.kind === 'ai') || null; },
        userSeats() { return this.players.filter((p) => p.kind !== 'ai'); },
        /** 当前回合的座位 */
        turnSeat() { return this.players.find((p) => p.id === this.turn) || null; },
        /** 现在允许人点格子吗(AI 回合 / 结束都不行) */
        canTap() {
            return Boolean(this.match && !this.finished && this.turnSeat && this.turnSeat.kind !== 'ai' && !this.busy);
        },
        logLines() {
            if (!this.match) return [];
            return this.match.log.slice().reverse();
        },
        remaining() { return this.match ? ms.remainingSafe(this.match) : 0; },
        hitMineCount() { return this.match ? ms.hitMines(this.match) : 0; },
        flagCount() { return this.match ? ms.flagCount(this.match) : 0; },
        turnText() {
            if (!this.match) return '';
            if (this.finished) {
                if (this.match.winner === 'draw') return '打平了';
                return `${ms.playerName(this.match, this.match.winner)}赢了`;
            }
            if (this.busy && this.aiSeat) return `${this.aiSeat.name}在想…`;
            return `轮到${ms.playerName(this.match, this.turn)}`;
        },
        /** 驱动信号:状态一变就看一眼「是不是该 AI 动手了」 */
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
        if (this._flashTimer) clearTimeout(this._flashTimer);
        this.lpCancel();
    },
    methods: {
        // ---------- 开局 ----------
        onStart(payload) {
            store.newMinesweeper({ players: payload.players });
            this.$emit('notify', '开了,点格子就是扫,长按是插旗');
            const island = this.app?.toolkit?.island;
            if (island?.notify && payload.players.some((p) => p.kind === 'ai')) {
                const mate = payload.players.find((p) => p.kind === 'ai');
                island.notify('info', '一起玩 · 扫雷', `和${mate.name}开了一局,10 颗雷`, {
                    kind: 'oq-match',
                    icon: islandIcon('heartFilled'),
                });
            }
        },
        onQuit() {
            ai.abortAll();
            this.busy = false;
            store.endMinesweeper();
        },
        onReset() {
            // 换图但保留同一批座位
            const players = this.players.map((p) => ({ name: p.name, kind: p.kind, aiId: p.aiId }));
            store.newMinesweeper({ players });
            this.flashIndex = -1;
            this.$emit('notify', '换了一张新地图,雷还是 10 颗');
        },

        // ---------- 格子交互:点=扫,长按=旗 ----------
        cellClass(cell) {
            return {
                'is-open': cell.revealed,
                'is-mine': cell.revealed && cell.mine,
                'is-flag': !cell.revealed && cell.flag,
                'is-flash': this.flashIndex === cell.index,
            };
        },
        cellNumber(cell) {
            if (!cell.revealed || cell.mine || cell.adj === 0) return '';
            return String(cell.adj);
        },
        cellIndexFromEvent(event) {
            const el = event.target?.closest?.('.oq-ms-cell');
            if (!el) return null;
            const index = Number(el.dataset.index);
            return Number.isFinite(index) ? index : null;
        },

        onCellDown(event) {
            const index = this.cellIndexFromEvent(event);
            if (index == null || this.finished) return;
            this.lpCancel();
            this._lp = { index, x: event.clientX, y: event.clientY, fired: false };
            this._lpTimer = setTimeout(() => {
                this._lpTimer = null;
                if (!this._lp) return;
                this._lp.fired = true;
                try { navigator.vibrate?.(12); } catch (_) { /* 不支持就算了 */ }
                this.toggleFlag(this._lp.index);
            }, LONG_PRESS_MS);
        },
        onCellMove(event) {
            if (!this._lp || !this._lpTimer) return;
            if (Math.abs(event.clientX - this._lp.x) > 8 || Math.abs(event.clientY - this._lp.y) > 8) {
                this.lpCancel();
            }
        },
        onCellUp(event) {
            const lp = this._lp;
            const pending = Boolean(this._lpTimer);
            this.lpCancel();
            if (!lp) return;
            // 长按已经插过旗了,这次抬手不再当点击
            if (lp.fired) return;
            // 计时器还在跑 = 一次干净的短点 → 扫
            if (pending) {
                const index = this.cellIndexFromEvent(event);
                this.sweep(index != null ? index : lp.index);
            }
        },
        lpCancel() {
            if (this._lpTimer) {
                clearTimeout(this._lpTimer);
                this._lpTimer = null;
            }
            this._lp = null;
        },

        toggleFlag(index) {
            const result = store.flagMinesweeper(index);
            if (!result.ok) {
                if (result.reason === 'already-revealed') this.$emit('notify', '翻开的格子不用插旗');
                return;
            }
            this.$emit('notify', result.flagged ? '插了面旗,长按可以拔掉' : '旗拔了');
        },

        sweep(index) {
            if (index == null || !this.match || this.finished) return;
            if (!this.canTap) {
                this.$emit('notify', this.busy && this.aiSeat ? `${this.aiSeat.name}还在想` : `现在是${ms.playerName(this.match, this.turn)}的回合`);
                return;
            }
            const result = store.sweepMinesweeper(index, this.turn);
            if (!result.ok) {
                const messages = {
                    'not-your-turn': `现在是${ms.playerName(this.match, this.turn)}的回合`,
                    'already-revealed': '这一格已经翻开了',
                    flagged: '这格插着旗,长按拔掉才能扫',
                    finished: '这局已经结束了',
                };
                this.$emit('notify', messages[result.reason] || '扫不了');
                return;
            }
            this.afterMove(result);
        },

        afterMove(result) {
            if (!result?.entry) return;
            this.flashIndex = result.entry.index;
            if (this._flashTimer) clearTimeout(this._flashTimer);
            this._flashTimer = setTimeout(() => { this.flashIndex = -1; }, 420);
            this.reportMove(result);
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
            const signal = ai.createAbort('ms-turn');
            const move = await boardAi.minesweeperMove({
                state,
                seat: { ...seat, order: 1 },
                customPrompts: store.listCustomPrompts(),
                signal,
            });
            ai.releaseAbort('ms-turn');
            // 等待期间用户可能退出 / 重开了
            if (!this.match || this.match !== state || state.finished) return;
            if (move.index < 0) return;

            const result = store.sweepMinesweeper(move.index, seat.id);
            if (!result.ok) return;
            if (move.line) store.minesweeperFlavor(seat.id, move.line);
            this.afterMove(result);
        },

        // ---------- 播报 ----------
        reportMove(result) {
            const island = this.app?.toolkit?.island;
            if (!island?.notify) return;
            const entry = result.entry;
            if (this.finished) return;   // 终局另有一条
            if (result.hitMine) {
                island.notify(
                    'warning',
                    `${ms.playerName(this.match, entry.playerId)}踩到雷`,
                    `(${entry.x},${entry.y}) −5 分 · 当前 ${this.scores.p1} : ${this.scores.p2}`,
                    { kind: 'oq-sweep', icon: islandIcon('heartFilled') },
                );
            }
        },
        reportEnd() {
            const island = this.app?.toolkit?.island;
            if (!island?.notify || !this.match) return;
            const { p1, p2 } = this.scores;
            island.notify(
                'success',
                '这盘扫完了',
                this.match.winner === 'draw' ? `${p1} : ${p2},打平` : `${ms.playerName(this.match, this.match.winner)}赢 · ${p1} : ${p2}`,
                { kind: 'oq-match', icon: islandIcon('heartFilled') },
            );
        },

        seatState(seat) {
            if (!this.match) return '';
            if (this.finished) return this.match.winner === seat.id ? '赢了' : (this.match.winner === 'draw' ? '平' : '');
            if (this.busy && seat.kind === 'ai' && this.turn === seat.id) return '在想';
            return this.turn === seat.id ? '该他扫' : '等着';
        },
    },
    template: `
        <div class="oq-ms">
            <!-- 开局:挑对手 -->
            <template v-if="!match">
                <OqSeatSetup game="扫雷" start-label="布雷,开扫" @start="onStart" />
                <OqCard title="怎么玩">
                    <ol class="oq-hy-rules">
                        <li>9×9 的盘里藏着恰好 10 颗雷,两个人轮流扫。</li>
                        <li>点一下格子就是扫;数字是周围八格的雷数。</li>
                        <li>长按格子插旗做记号,插了旗的格子点不动。</li>
                        <li>没碰到雷 +1 分,踩到雷 −5 分;第一下永远安全。</li>
                        <li>扫到数字 0 会连锁摊开一片,但只有你点的那格计分。</li>
                        <li>安全格全翻完就结束,分高的赢。</li>
                    </ol>
                </OqCard>
            </template>

            <template v-else>
                <!-- 卡片一:座位与比分 -->
                <OqCard step="01" title="牌桌" :hint="turnText">
                    <template #extra>
                        <OqButton size="sm" icon-name="close" icon-only label="退出这局" @click="onQuit" />
                    </template>
                    <div class="oq-ms-seats">
                        <div
                            v-for="p in players"
                            :key="p.id"
                            class="oq-ms-seat"
                            :class="{ 'is-turn': !finished && turn === p.id, 'is-win': finished && match.winner === p.id }"
                            :data-owner="p.id"
                        >
                            <span class="oq-ms-seat-name">{{ p.name }}</span>
                            <strong class="oq-ms-seat-score">{{ scores[p.id] }}</strong>
                            <span class="oq-ms-seat-state">{{ p.kind === 'ai' ? 'AI · ' : '' }}{{ seatState(p) }}</span>
                        </div>
                    </div>
                </OqCard>

                <!-- 卡片二:雷区 -->
                <OqCard step="02" title="雷区" :hint="'剩 ' + remaining + ' 格安全区 · ' + flagCount + ' 面旗'">
                    <div class="oq-ms-frame">
                        <div class="oq-ms-axis-x">
                            <span class="oq-ms-axis-corner"></span>
                            <span v-for="n in axis" :key="'x' + n" class="oq-ms-axis-cell">{{ n }}</span>
                        </div>
                        <div class="oq-ms-body">
                            <div class="oq-ms-axis-y">
                                <span v-for="n in axis" :key="'y' + n" class="oq-ms-axis-cell">{{ n }}</span>
                            </div>
                            <div
                                class="oq-ms-grid"
                                :class="{ 'is-locked': !canTap }"
                                role="grid"
                                aria-label="雷区"
                                @pointerdown="onCellDown"
                                @pointermove="onCellMove"
                                @pointerup="onCellUp"
                                @pointercancel="lpCancel"
                            >
                                <button
                                    v-for="cell in cells"
                                    :key="cell.index"
                                    type="button"
                                    class="oq-ms-cell"
                                    :class="cellClass(cell)"
                                    :data-index="cell.index"
                                    :data-n="cellNumber(cell) || null"
                                    :data-by="cell.by || null"
                                    :aria-label="'坐标 ' + (cell.col + 1) + ' ' + (cell.row + 1)"
                                >
                                    <OqHeart v-if="cell.revealed && cell.mine" />
                                    <span v-else-if="!cell.revealed && cell.flag" class="oq-ms-flagmark" aria-hidden="true"></span>
                                    <span v-else-if="cellNumber(cell)" class="oq-ms-num">{{ cellNumber(cell) }}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <p class="oq-ms-tip">点一下扫,长按插旗。已经踩出 {{ hitMineCount }} 颗雷。</p>
                </OqCard>

                <!-- 卡片三:游戏信息 -->
                <OqCard step="03" title="游戏信息" hint="最新的在最上面">
                    <div class="oq-ms-log">
                        <p v-if="!logLines.length" class="oq-ms-log-empty">还没有人动手。</p>
                        <p
                            v-for="line in logLines"
                            :key="line.seq"
                            class="oq-ms-log-line"
                            :data-kind="line.kind"
                            :data-owner="line.playerId || null"
                        >{{ line.text }}</p>
                    </div>
                </OqCard>

                <!-- 卡片四:收尾 -->
                <OqCard step="04" :title="finished ? '收工' : '这一局'">
                    <div class="oq-ms-endacts">
                        <OqButton v-if="finished" variant="primary" icon-name="share" @click="sharing = true">分享到 murmur</OqButton>
                        <OqButton variant="quiet" icon-name="refresh" @click="onReset">换一张新地图</OqButton>
                        <OqButton variant="ghost" icon-name="users" @click="onQuit">换个对手</OqButton>
                    </div>
                    <p class="oq-ms-tip">重开会重新布雷,雷数恒定 10 颗。当前这盘走了 {{ match.moveCount }} 步。</p>
                </OqCard>

                <OqShareSheet
                    v-if="sharing"
                    kind="${GAME_MINESWEEPER}"
                    :default-contact-id="aiSeat ? aiSeat.aiId : ''"
                    @close="sharing = false"
                    @notify="$emit('notify', $event)"
                />
            </template>
        </div>
    `,
};

export default OqGameMinesweeper;
