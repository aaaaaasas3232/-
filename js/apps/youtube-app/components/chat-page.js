/**
 * 萤火 · 站内闲聊页
 *
 * 规矩（和 murmur 不同，是刻意的）：
 *   - 消息**不能**重 roll、编辑、删除 —— 站内网友不是你的 AI 伙伴，说出去就是说出去了
 *   - 发一条消息 = 落盘 + 自动生成一条回复（一次 API）
 *   - 聊得投缘 → 「加为好友」注册进 nook 角色库（幂等），简介带相识缘由
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { FRIEND_HINT_AFTER } from '../constants.js';

export const YtChatPage = {
    name: 'YtChatPage',
    components: { ...UI },
    data() {
        return { draft: '' };
    },
    computed: {
        s() { return store.getState(); },
        peer() { return store.chatPeer(); },
        messages() { return this.s.chatMessages; },
        replying() { return this.s.loading.chat; },
        error() { return this.s.error; },
        friendLoading() { return this.s.loading.friend === this.peer?.creatorId; },
        showFriendHint() {
            return this.peer && !this.peer.nookPersonId && this.messages.length >= FRIEND_HINT_AFTER;
        },
    },
    watch: {
        messages() { this.$nextTick(() => this.scrollToEnd()); },
    },
    mounted() {
        this.scrollToEnd();
    },
    methods: {
        back() { store.closeChat(); },
        openPeer() { if (this.peer) store.openCreator(this.peer.creatorId); },
        scrollToEnd() {
            const el = this.$refs.scroll;
            if (el) el.scrollTop = el.scrollHeight;
        },
        async send() {
            const text = this.draft.trim();
            if (!text || this.replying) return;
            this.draft = '';
            await store.sendChatMessage(text);
        },
        addFriend() {
            store.openModal('confirm', {
                title: `把 ${this.peer.name} 加进角色库？`,
                message: '会在 nook 建一张 AI 人设卡，自动绑定当前世界观，简介里写清你们是怎么认识的。',
                okLabel: '加为好友',
                onOk: () => store.addFriend(this.peer.creatorId),
            });
        },
        clearError() { store.clearError(); },
    },
    template: `
        <div class="yt-chat" v-if="peer">
            <div class="yt-subtop">
                <button type="button" class="yt-subtop__back" aria-label="返回" @click="back"><YtIcon name="back" :size="18" /></button>
                <button type="button" class="yt-subtop__peer" @click="openPeer">
                    <YtAvatar :creator="peer" :size="28" />
                    <span>{{ peer.name }}</span>
                    <i v-if="peer.nookPersonId" class="yt-person__friendtag">好友</i>
                </button>
                <YtButton
                    v-if="!peer.nookPersonId"
                    size="sm" variant="ghost" icon-name="friend" :loading="friendLoading"
                    @click="addFriend"
                >加好友</YtButton>
            </div>

            <div ref="scroll" class="yt-chat__scroll">
                <p class="yt-chat__rule">站内闲聊没有撤回、编辑和重 roll —— 网友的话说出口就是说出口了。</p>

                <div
                    v-for="m in messages" :key="m.id"
                    class="yt-chat__row" :class="m.role === 'user' ? 'is-user' : 'is-peer'"
                >
                    <YtAvatar v-if="m.role !== 'user'" :creator="peer" :size="30" />
                    <div class="yt-chat__bubble">{{ m.text }}</div>
                </div>

                <div v-if="replying" class="yt-chat__row is-peer">
                    <YtAvatar :creator="peer" :size="30" />
                    <div class="yt-chat__bubble is-typing"><i></i><i></i><i></i></div>
                </div>

                <div v-if="showFriendHint" class="yt-chat__friendhint">
                    <p>聊得还挺投缘？可以把 TA 收进角色库，以后在 murmur 也能找到 TA。</p>
                    <YtButton size="sm" variant="soft" icon-name="friend" :loading="friendLoading" @click="addFriend">加为好友</YtButton>
                </div>

                <div v-if="error" class="yt-error">
                    <p>{{ error }}</p>
                    <YtButton size="sm" variant="ghost" @click="clearError">知道了</YtButton>
                </div>
            </div>

            <div class="yt-livebox yt-chat__box">
                <input
                    class="yt-input" v-model="draft" maxlength="200"
                    :placeholder="replying ? '对方正在输入…' : '和 ' + peer.name + ' 说点什么'"
                    :disabled="replying"
                    @keydown.enter="send"
                />
                <YtButton size="sm" variant="primary" icon-name="send" :disabled="!draft.trim() || replying" @click="send">发</YtButton>
            </div>
        </div>
    `,
};
