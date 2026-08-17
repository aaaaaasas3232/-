/**
 * 小奇怪 · 棋类共用块
 *
 * 扫雷和五子棋长得不一样,但有四块是一模一样的:
 *
 *   OqSeatSetup    开局前挑对手(拉 AI / 本地双人)
 *   OqShareSheet   打完把战绩卡发进 murmur(复用 murmur 的 game_record 卡)
 *   OqPromptLib    提示词库 —— 自定义提示词,注入所有 AI 对局(murmur 同款思路)
 *   OqScoreboard   游戏数据概要 —— 最近战绩一览
 *
 * 抄两遍的话迟早各改各的(AGENTS2 里同款教训一大把),所以收在这儿。
 * 全部只读 store / 调 store mutator,不碰引擎。
 */

import * as store from '../store.js';
import * as nook from '../services/nook-bridge.js';
import { OPPONENT_MODES } from '../constants.js';
import { SHARED_COMPONENTS } from './shared.js';
import { OqModal } from './oq-modal.js';
import { formatClock, formatDate, asArray } from '../utils.js';

// ============================================================
// 开局:挑对手
// ============================================================

export const OqSeatSetup = {
    name: 'OqSeatSetup',
    components: { ...SHARED_COMPONENTS },
    props: {
        /** 游戏名,只影响文案 */
        game: { type: String, default: '这局' },
        /** 确认按钮文案 */
        startLabel: { type: String, default: '开一局' },
    },
    emits: ['start'],
    data() {
        return {
            modes: OPPONENT_MODES,
            mode: 'ai',
            candidates: [],
            pickedAiId: '',
            sdkReady: false,
        };
    },
    computed: {
        hasApi() { return nook.listApiRefs().length > 0; },
        apiHint() {
            if (this.mode !== 'ai') return '';
            return this.hasApi ? '' : '没找到可用 Key —— AI 会用本地棋手代打,照样能玩';
        },
        canStart() {
            if (this.mode === 'local') return true;
            return Boolean(this.pickedAiId);
        },
        pickedCard() {
            return this.candidates.find((c) => c.id === this.pickedAiId) || null;
        },
    },
    mounted() {
        this.refresh();
    },
    methods: {
        async refresh() {
            this.sdkReady = nook.isReady();
            if (!this.sdkReady) {
                await nook.whenReady(6000);
                this.sdkReady = nook.isReady();
            }
            const playerCard = nook.getPlayerCard('');
            const world = nook.getWorld('', playerCard);
            this.candidates = nook.listSeatCandidates(world);
            if (!this.pickedAiId && this.candidates[0]) this.pickedAiId = this.candidates[0].id;
            if (!this.candidates.length) this.mode = 'local';
        },
        start() {
            if (!this.canStart) return;
            const me = nook.getPlayerCard('');
            const opponent = this.mode === 'ai'
                ? { name: this.pickedCard?.name || '对家', kind: 'ai', aiId: this.pickedAiId }
                : { name: '玩家二', kind: 'user', aiId: '' };
            this.$emit('start', {
                mode: this.mode,
                players: [
                    { name: me?.name || '我', kind: 'user', aiId: '' },
                    opponent,
                ],
            });
        },
    },
    template: `
        <OqCard :title="'和谁玩' + game" hint="AI 会带着 nook 里的人设上桌">
            <div class="oq-seatmodes">
                <button
                    v-for="m in modes"
                    :key="m.id"
                    type="button"
                    class="oq-seatmode"
                    :class="{ 'is-on': mode === m.id, 'is-off': m.id === 'ai' && sdkReady && !candidates.length }"
                    @click="mode = m.id"
                >
                    <b>{{ m.label }}</b>
                    <i>{{ m.id === 'ai' && sdkReady && !candidates.length ? 'nook 里还没有 AI 人设' : m.desc }}</i>
                </button>
            </div>

            <template v-if="mode === 'ai'">
                <p v-if="!sdkReady" class="oq-hy-tip">正在连接 nook…</p>
                <OqEmpty
                    v-else-if="!candidates.length"
                    icon-name="users"
                    text="nook 里还没有 AI 人设"
                    hint="去 nook →「人设」建一个,回来就能一起玩"
                />
                <div v-else class="oq-hy-picker">
                    <button
                        v-for="card in candidates"
                        :key="card.id"
                        type="button"
                        class="oq-hy-pick"
                        :class="{ 'is-on': pickedAiId === card.id }"
                        @click="pickedAiId = card.id"
                    >
                        <span class="oq-hy-pick-name">{{ card.name }}</span>
                        <span class="oq-hy-pick-sub">{{ card.personality || card.bio || '没写性格' }}</span>
                    </button>
                </div>
                <p v-if="apiHint" class="oq-hy-tip is-warn">{{ apiHint }}</p>
            </template>

            <OqButton variant="primary" block :disabled="!canStart" @click="start">{{ startLabel }}</OqButton>
        </OqCard>
    `,
};

// ============================================================
// 分享到 murmur
// ============================================================

export const OqShareSheet = {
    name: 'OqShareSheet',
    components: { ...SHARED_COMPONENTS, OqModal },
    props: {
        /** 'minesweeper' | 'gomoku' | 'haveyou' */
        kind: { type: String, required: true },
        /** 默认选中的联系人(通常是这局的 AI 对手) */
        defaultContactId: { type: String, default: '' },
    },
    emits: ['close', 'notify'],
    data() {
        return {
            targets: [],
            pickedId: '',
            sending: false,
        };
    },
    mounted() {
        this.targets = store.listShareTargets();
        this.pickedId = this.defaultContactId && this.targets.some((t) => t.id === this.defaultContactId)
            ? this.defaultContactId
            : (this.targets[0]?.id || '');
    },
    methods: {
        async send() {
            if (!this.pickedId || this.sending) return;
            this.sending = true;
            try {
                const result = await store.shareMatch(this.kind, this.pickedId);
                if (!result.ok) {
                    this.$emit('notify', result.error || '没发出去');
                    return;
                }
                const name = this.targets.find((t) => t.id === this.pickedId)?.name || '对方';
                this.$emit('notify', `战绩卡发给${name}了,去 murmur 看`);
                this.$emit('close');
            } finally {
                this.sending = false;
            }
        },
    },
    template: `
        <OqModal title="分享到 murmur" subtitle="战绩会变成一张卡片消息" @close="$emit('close')">
            <OqEmpty
                v-if="!targets.length"
                icon-name="users"
                text="nook 里还没有能收卡的人"
                hint="去 nook →「人设」建一个 AI"
            />
            <div v-else class="oq-sharelist">
                <button
                    v-for="t in targets"
                    :key="t.id"
                    type="button"
                    class="oq-sharerow"
                    :class="{ 'is-on': pickedId === t.id }"
                    @click="pickedId = t.id"
                >
                    <span class="oq-sharerow-name">{{ t.name }}</span>
                    <span class="oq-sharerow-sub">{{ t.occupation || t.personality || '' }}</span>
                </button>
            </div>
            <template #footer>
                <OqButton variant="ghost" @click="$emit('close')">算了</OqButton>
                <OqButton variant="primary" icon-name="share" :loading="sending" :disabled="!pickedId" @click="send">发出去</OqButton>
            </template>
        </OqModal>
    `,
};

// ============================================================
// 提示词库
// ============================================================

export const OqPromptLib = {
    name: 'OqPromptLib',
    components: { ...SHARED_COMPONENTS, OqModal },
    emits: ['close', 'notify'],
    data() {
        return {
            editingId: '',
            draftTitle: '',
            draftContent: '',
            adding: false,
        };
    },
    computed: {
        prompts() { return store.listCustomPrompts(); },
    },
    methods: {
        startAdd() {
            this.adding = true;
            this.editingId = '';
            this.draftTitle = '';
            this.draftContent = '';
        },
        startEdit(row) {
            this.adding = false;
            this.editingId = row.id;
            this.draftTitle = row.title;
            this.draftContent = row.content;
        },
        cancelEdit() {
            this.adding = false;
            this.editingId = '';
        },
        save() {
            const content = this.draftContent.trim();
            if (!content) {
                this.$emit('notify', '内容不能是空的');
                return;
            }
            if (this.adding) {
                store.addCustomPrompt({ title: this.draftTitle, content });
                this.$emit('notify', '加进去了,下一局就生效');
            } else if (this.editingId) {
                store.updateCustomPrompt(this.editingId, { title: this.draftTitle, content });
                this.$emit('notify', '改好了');
            }
            this.cancelEdit();
        },
        toggle(row) {
            store.updateCustomPrompt(row.id, { enabled: !row.enabled });
        },
        remove(row) {
            store.removeCustomPrompt(row.id);
            if (this.editingId === row.id) this.cancelEdit();
        },
    },
    template: `
        <OqModal title="提示词库" subtitle="这里的每一条都会注入所有 AI 对局" wide @close="$emit('close')">
            <div class="oq-plib">
                <p class="oq-plib-hint">
                    和 murmur 的提示词一个用法:写规矩、写风格、写忌口。
                    比如「说话要阴阳怪气」「输了要找借口」。开关掉的不发送。
                </p>

                <div v-if="!prompts.length && !adding" class="oq-plib-empty">还没有自定义提示词。</div>

                <div v-for="row in prompts" :key="row.id" class="oq-plib-row" :class="{ 'is-off': !row.enabled }">
                    <template v-if="editingId === row.id">
                        <OqInput v-model="draftTitle" placeholder="标题(可空)" :maxlength="24" />
                        <textarea class="oq-plib-textarea" v-model="draftContent" rows="4" placeholder="提示词内容"></textarea>
                        <div class="oq-plib-acts">
                            <OqButton size="sm" variant="ghost" @click="cancelEdit">算了</OqButton>
                            <OqButton size="sm" variant="primary" @click="save">保存</OqButton>
                        </div>
                    </template>
                    <template v-else>
                        <div class="oq-plib-head">
                            <b class="oq-plib-title">{{ row.title || '未命名' }}</b>
                            <OqSwitch :model-value="row.enabled" label="" @update:modelValue="toggle(row)" />
                        </div>
                        <p class="oq-plib-body">{{ row.content }}</p>
                        <div class="oq-plib-acts">
                            <OqButton size="sm" variant="ghost" icon-name="pen" @click="startEdit(row)">改</OqButton>
                            <OqButton size="sm" variant="ghost" icon-name="trash" @click="remove(row)">删</OqButton>
                        </div>
                    </template>
                </div>

                <template v-if="adding">
                    <div class="oq-plib-row">
                        <OqInput v-model="draftTitle" placeholder="标题(可空)" :maxlength="24" />
                        <textarea class="oq-plib-textarea" v-model="draftContent" rows="4" placeholder="提示词内容,比如:输了要嘴硬,赢了要谦虚"></textarea>
                        <div class="oq-plib-acts">
                            <OqButton size="sm" variant="ghost" @click="cancelEdit">算了</OqButton>
                            <OqButton size="sm" variant="primary" @click="save">加进去</OqButton>
                        </div>
                    </div>
                </template>
                <OqButton v-else variant="quiet" block icon-name="plus" @click="startAdd">写一条新的</OqButton>
            </div>
        </OqModal>
    `,
};

// ============================================================
// 游戏数据概要
// ============================================================

export const OqScoreboard = {
    name: 'OqScoreboard',
    components: { ...SHARED_COMPONENTS, OqModal },
    emits: ['close'],
    computed: {
        scores() { return store.getState().scores; },
        rows() {
            return asArray(this.scores).map((row) => ({
                ...row,
                when: `${formatDate(row.finishedAt)} ${formatClock(row.finishedAt)}`,
                winnerName: row.winner && row.winner !== 'draw'
                    ? (asArray(row.entries).find((e) => e.seatId === row.winner)?.name || '')
                    : '',
            }));
        },
    },
    template: `
        <OqModal title="游戏数据概要" subtitle="murmur 里的 AI 也看得到这一份" wide @close="$emit('close')">
            <OqEmpty v-if="!rows.length" icon-name="trophy" text="还没打完过一局" hint="打完一局它就会记在这儿" />
            <div v-else class="oq-scorelist">
                <div v-for="row in rows" :key="row.id" class="oq-scorerow">
                    <div class="oq-scorerow-head">
                        <b>{{ row.label }}</b>
                        <span class="oq-scorerow-when">{{ row.when }}</span>
                    </div>
                    <div class="oq-scorerow-body">
                        <span
                            v-for="e in row.entries"
                            :key="e.seatId"
                            class="oq-scorerow-seat"
                            :class="{ 'is-win': row.winner === e.seatId }"
                        >{{ e.name }} {{ e.score }}</span>
                        <span class="oq-scorerow-note">{{ row.winner === 'draw' ? '平局' : (row.winnerName ? row.winnerName + ' 赢' : '') }}{{ row.note ? ' · ' + row.note : '' }}</span>
                    </div>
                </div>
            </div>
        </OqModal>
    `,
};

export const GAME_COMMON = { OqSeatSetup, OqShareSheet, OqPromptLib, OqScoreboard };
