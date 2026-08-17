/**
 * 候鸟 · 旅行对话页
 *
 * 旁白居中；用户消息在右带自己头像；AI 消息在左带各自头像和名字
 * （可能同时有好几个 AI，必须区分得开）。
 *
 * 交互：
 *   - 「继续旁白」由用户点，一次生成一段（没有定时器）
 *   - 长按任意消息（或点右上的小点）→ 操作面板：让谁回复 / 继续旁白 / 编辑 / 重 roll / 删除
 *   - 输入区可以直接发自己的话；也能点头像 chip 直接让某个 AI 接一句
 *   - 旅行到最后一段自动结束：输入区关闭，历史仍可回看
 *   - 背景图（URL / 本地图）+ 模糊度按 trip 保存
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { safeImageUrl } from '../utils.js';
import { stageIcon, stageLabel, totalSlots, tripProgress } from '../services/trip-flow.js';

const LONG_PRESS_MS = 550;

/** 一条消息（旁白 / 用户 / AI 三种形态） */
export const TvTripMessage = {
    name: 'TvTripMessage',
    components: { ...UI },
    props: {
        msg: { type: Object, required: true },
    },
    emits: ['actions'],
    data() {
        return { _pressTimer: null, _pressed: false };
    },
    computed: {
        s() { return store.getState(); },
        isNarration() { return this.msg.role === 'narration'; },
        isUser() { return this.msg.role === 'user'; },
        stage() {
            const trip = store.currentTrip();
            if (!this.isNarration || !trip) return '';
            return stageLabel(Number(this.msg.slotIndex) || 0, trip.days);
        },
        stageIconName() {
            const trip = store.currentTrip();
            if (!trip) return 'sun';
            return stageIcon(Number(this.msg.slotIndex) || 0, trip.days);
        },
    },
    beforeUnmount() {
        this.clearPress();
    },
    methods: {
        openActions() {
            this.$emit('actions', this.msg);
        },
        /** 长按（pointer 按住 550ms）→ 操作面板；短按不做事 */
        pressStart() {
            this.clearPress();
            this._pressed = false;
            this._pressTimer = setTimeout(() => {
                this._pressed = true;
                this.openActions();
            }, LONG_PRESS_MS);
        },
        pressEnd() {
            this.clearPress();
        },
        clearPress() {
            if (this._pressTimer) {
                clearTimeout(this._pressTimer);
                this._pressTimer = null;
            }
        },
        onContextMenu(event) {
            event.preventDefault();
            this.openActions();
        },
    },
    template: `
        <div
            class="tv-msg"
            :class="{ 'is-narration': isNarration, 'is-user': isUser, 'is-ai': !isNarration && !isUser }"
            @pointerdown="pressStart"
            @pointerup="pressEnd"
            @pointercancel="pressEnd"
            @pointerleave="pressEnd"
            @contextmenu="onContextMenu"
        >
            <template v-if="isNarration">
                <div class="tv-msg__narration">
                    <p class="tv-msg__stage"><TvIcon :name="stageIconName" :size="12" /> {{ stage }}</p>
                    <p class="tv-msg__ntext">{{ msg.text }}</p>
                </div>
            </template>

            <template v-else-if="isUser">
                <div class="tv-msg__bubblewrap is-right">
                    <div class="tv-msg__bubble is-user"><p>{{ msg.text }}</p></div>
                    <TvAvatar :name="s.identity.userName" :url="s.identity.userAvatar" :bg="s.identity.userAvatarBg" :size="30" />
                </div>
            </template>

            <template v-else>
                <div class="tv-msg__bubblewrap">
                    <TvAvatar :name="msg.aiName" :url="msg.aiAvatar" :bg="msg.aiAvatarBg" :size="30" />
                    <div class="tv-msg__aiside">
                        <p class="tv-msg__aname">{{ msg.aiName }}</p>
                        <div class="tv-msg__bubble is-ai"><p>{{ msg.text }}</p></div>
                    </div>
                </div>
            </template>

            <button type="button" class="tv-msg__more" aria-label="操作" @click.stop="openActions"><TvIcon name="more" :size="14" /></button>
        </div>
    `,
};

export const TvTripPage = {
    name: 'TvTripPage',
    components: { ...UI, TvTripMessage },
    data() {
        return { draft: '' };
    },
    computed: {
        s() { return store.getState(); },
        trip() { return store.currentTrip(); },
        dest() { return this.trip?.destination || {}; },
        messages() { return this.s.messages; },
        ongoing() { return this.trip?.status === 'ongoing'; },
        completed() { return this.trip?.status === 'completed'; },
        companions() { return this.trip?.companions || []; },
        busy() { return !!(this.s.loading.narration || this.s.loading.reply); },
        progressPct() {
            if (!this.trip) return 0;
            return Math.round(tripProgress(this.trip.slotCount, this.trip.days) * 100);
        },
        stageText() {
            if (!this.trip) return '';
            if (this.completed) return '旅行已结束';
            const count = Number(this.trip.slotCount) || 0;
            if (count === 0) return '整装待发';
            return stageLabel(count - 1, this.trip.days);
        },
        remainText() {
            if (!this.trip || this.completed) return '';
            const left = totalSlots(this.trip.days) - (Number(this.trip.slotCount) || 0);
            return `还剩 ${left} 段`;
        },
        nextNarrationLabel() {
            const count = Number(this.trip?.slotCount) || 0;
            if (count === 0) return '出发（写第一段旁白）';
            return `继续旁白（${stageLabel(count, this.trip.days)}）`;
        },
        bgUrl() { return safeImageUrl(this.trip?.background?.url); },
        bgStyle() {
            if (!this.bgUrl) return {};
            return {
                backgroundImage: `url("${this.bgUrl.replace(/"/g, '%22')}")`,
                filter: `blur(${Number(this.trip?.background?.blur) || 0}px)`,
            };
        },
    },
    watch: {
        'messages.length'() {
            this.$nextTick(() => this.scrollToEnd());
        },
    },
    mounted() {
        this.scrollToEnd();
    },
    methods: {
        back() { store.closeTripView(); },
        openBackground() { store.openModal('background', {}); },
        openTheater() {
            // 出发小剧场回看：直接弹操作不值得，用确认弹窗展示纯文本足够
            const th = this.trip?.theater;
            if (!th) { store.showToast('这趟没有生成过出发小剧场'); return; }
            store.openModal('confirm', {
                title: th.title || '出发小剧场',
                text: th.scenes.map((sc) => {
                    const lines = sc.lines.map((l) => `${l.speaker}：${l.text}`).join('\n');
                    return `【${sc.place}】${sc.narration}\n${lines}`;
                }).join('\n\n') + (th.closing ? `\n\n${th.closing}` : ''),
                okLabel: '收好了',
                onOk: () => {},
            });
        },
        scrollToEnd() {
            const el = this.$refs.scroll;
            if (el) el.scrollTop = el.scrollHeight;
        },
        narrate() {
            if (!this.busy) store.continueNarration();
        },
        send() {
            const text = this.draft.trim();
            if (!text) return;
            this.draft = '';
            store.sendUserMessage(text);
        },
        replyBy(aiId) {
            if (!this.busy) store.generateAiReply(aiId, null);
        },
        openActions(msg) {
            store.openModal('msg-actions', { message: msg });
        },
        clearError() { store.clearError(); },
    },
    template: `
        <div class="tv-overlay-page tv-chat" v-if="trip">
            <!-- 背景层：用户自己传的旅行图 + 模糊度 -->
            <div v-if="bgUrl" class="tv-chat__bg" :style="bgStyle"></div>
            <div v-if="bgUrl" class="tv-chat__scrim"></div>

            <div class="tv-pagebar is-chat">
                <button type="button" class="tv-iconbtn" aria-label="返回" @click="back"><TvIcon name="back" /></button>
                <div class="tv-pagebar__mid">
                    <span class="tv-pagebar__title">{{ dest.placeName }} · {{ dest.locationName }}</span>
                    <span class="tv-pagebar__sub">{{ stageText }}<template v-if="remainText"> · {{ remainText }}</template></span>
                </div>
                <button type="button" class="tv-iconbtn" aria-label="出发小剧场" @click="openTheater"><TvIcon name="quote" /></button>
                <button type="button" class="tv-iconbtn" aria-label="背景" @click="openBackground"><TvIcon name="image" /></button>
            </div>

            <div class="tv-progress is-chat"><span class="tv-progress__bar" :style="{ width: progressPct + '%' }"></span></div>

            <div ref="scroll" class="tv-chat__scroll">
                <div v-if="!messages.length" class="tv-chat__hello">
                    <p>票已经在手里了。点下面的「出发」，旅行就从第一段旁白开始。</p>
                    <p class="is-sub">长按任何一条消息可以：让某位同行回复、继续旁白、编辑、重 roll、删除。</p>
                </div>
                <TvTripMessage v-for="m in messages" :key="m.id" :msg="m" @actions="openActions" />
                <div v-if="busy" class="tv-chat__typing"><TvLoading :lines="['笔尖在动', '在写这一段']" /></div>
                <div v-if="completed" class="tv-chat__end">
                    <span class="tv-chat__endline"></span>
                    <p>旅行结束了。这趟已经收进「足迹」，可以去写备注、生成概要、登记到世界。</p>
                    <span class="tv-chat__endline"></span>
                </div>
            </div>

            <div v-if="s.error" class="tv-errorbar is-chat"><p>{{ s.error }}</p><button type="button" @click="clearError">知道了</button></div>

            <div v-if="ongoing" class="tv-chat__composer">
                <div class="tv-chat__quick">
                    <button type="button" class="tv-chat__narrate" :disabled="busy" @click="narrate">
                        <TvIcon name="quote" :size="14" /> {{ nextNarrationLabel }}
                    </button>
                    <button
                        v-for="c in companions" :key="c.id"
                        type="button" class="tv-chat__aichip" :disabled="busy" :title="'让 ' + c.name + ' 说一句'"
                        @click="replyBy(c.id)"
                    >
                        <TvAvatar :name="c.name" :url="c.avatar" :bg="c.avatarBg" :size="20" />{{ c.name }}
                    </button>
                </div>
                <div class="tv-chat__inputrow">
                    <textarea
                        v-model="draft" class="tv-chat__input" rows="1"
                        placeholder="说点什么…"
                        @keydown.enter.exact.prevent="send"
                    ></textarea>
                    <button type="button" class="tv-chat__send" :disabled="!draft.trim()" aria-label="发送" @click="send"><TvIcon name="send" /></button>
                </div>
            </div>
            <div v-else class="tv-chat__closedbar">
                <TvIcon name="flag" :size="14" /> 旅行已结束，输入已关闭 —— 历史随时可以回看
            </div>
        </div>
    `,
};
