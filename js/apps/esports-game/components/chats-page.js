/**
 * 赛点 · 群聊
 *
 * 战队群（教练 + 队友，教练每天发安排，晚上没训练会点名）+ 教练私聊 + 复盘。
 * 用户发言 → 一次 AI 调用让成员按人设接话。消息不可编辑 / 删除 / 重 roll。
 */

import * as store from '../store.js';
import { UI } from './ui.js';

export const EgChatsPage = {
    name: 'EgChatsPage',
    components: { ...UI },
    data() {
        return { channel: 'team', draft: '', error: '' };
    },
    computed: {
        s() { return store.getState(); },
        career() { return this.s.career; },
        messages() { return this.s.chats[this.channel] || []; },
        sending() { return this.s.loading.chat === this.channel; },
        reviewing() { return this.s.loading.review; },
        channelName() { return this.channel === 'team' ? `${this.career?.teamName || '战队'}·大群` : '教练私聊'; },
    },
    watch: {
        messages() {
            this.$nextTick(() => {
                const el = this.$refs.scroll;
                if (el) el.scrollTop = el.scrollHeight;
            });
        },
    },
    mounted() {
        this.$nextTick(() => {
            const el = this.$refs.scroll;
            if (el) el.scrollTop = el.scrollHeight;
        });
    },
    methods: {
        async send() {
            const text = this.draft.trim();
            if (!text) return;
            this.draft = '';
            this.error = '';
            const result = await store.sendChat(this.channel, text);
            if (!result.ok && result.error) this.error = result.error;
        },
        async review() {
            this.error = '';
            const result = await store.startReview();
            if (!result.ok && result.error) this.error = result.error;
        },
        isMine(m) { return m.senderId === 'user'; },
        isSystem(m) { return m.kind === 'system'; },
    },
    template: `
        <div class="eg-page eg-page--chat">
            <div class="eg-chathead">
                <div class="eg-chiprow">
                    <button type="button" class="eg-chip" :class="{ 'is-on': channel === 'team' }" @click="channel = 'team'">战队群</button>
                    <button type="button" class="eg-chip" :class="{ 'is-on': channel === 'coach' }" @click="channel = 'coach'">教练私聊</button>
                </div>
                <EgBtn size="sm" variant="soft" iconName="book" :loading="reviewing" @click="review">发起复盘</EgBtn>
            </div>
            <p class="eg-note">{{ channelName }} · 说出去的话没有重 roll</p>

            <div class="eg-chatbody" ref="scroll">
                <div v-for="m in messages" :key="m.id"
                    class="eg-msg" :class="{ 'is-mine': isMine(m), 'is-system': isSystem(m) }">
                    <template v-if="isSystem(m)">
                        <span class="eg-msg__system">{{ m.text }}</span>
                    </template>
                    <template v-else>
                        <span v-if="!isMine(m)" class="eg-msg__sender">{{ m.senderName }}</span>
                        <span class="eg-msg__bubble">{{ m.text }}</span>
                    </template>
                </div>
                <EgEmpty v-if="!messages.length" iconName="comment" title="群里静悄悄" desc="发句话试试，教练和队友会接" />
            </div>

            <p v-if="error" class="eg-error">{{ error }}</p>
            <div class="eg-chatinput">
                <input class="eg-input" v-model.trim="draft" :placeholder="channel === 'team' ? '在群里说点什么' : '和教练说点什么'"
                    maxlength="120" @keyup.enter="send" />
                <EgBtn variant="blue" iconName="send" :loading="sending" @click="send"></EgBtn>
            </div>
        </div>
    `,
};
