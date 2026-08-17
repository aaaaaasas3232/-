/**
 * 灯塔 · 面试
 *
 * 两个组件：列表（哪些人在等你回话）和对话页。
 *
 * ── 结果不是弹窗，是消息流里的一条 ────────────────────────────────
 *
 * 录用 / 被拒都直接长在对话里。弹窗会盖住刚说完的那句话，
 * 而那句话恰恰是「为什么」——用户被拒的时候最想看的就是它。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { TALK_STATUS } from '../constants.js';
import { fmtTime } from '../utils.js';

const STATUS_TEXT = {
    [TALK_STATUS.open]: '还在聊',
    [TALK_STATUS.hired]: '录用了',
    [TALK_STATUS.rejected]: '被拒了',
    [TALK_STATUS.closed]: '已结束',
};

export const JbTalksPage = {
    name: 'JbTalksPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        list() { return this.s.recruiters; },
    },
    methods: {
        open(id) { store.openTalk(id); },
        statusText(st) { return STATUS_TEXT[st] || ''; },
        statusClass(st) {
            if (st === TALK_STATUS.hired) return 'jb-tag jb-tag--ok';
            if (st === TALK_STATUS.rejected) return 'jb-tag jb-tag--bad';
            if (st === TALK_STATUS.open) return 'jb-tag jb-tag--accent';
            return 'jb-tag';
        },
        lastLine(hr) {
            const m = hr.messages?.[hr.messages.length - 1];
            if (!m) return '';
            return (m.role === 'user' ? '你：' : '') + m.text;
        },
        when(hr) { return fmtTime(hr.updatedAt || hr.createdAt); },
        toMarket() { store.setTab('market'); },
    },
    template: `
        <div class="jb-talks">
            <jb-empty
                v-if="!list.length"
                icon="chat"
                title="还没跟谁聊过"
                desc="去招聘板挑一个职位，看完详情之后点「跟他聊聊」，对面就会有人来接待你。"
            >
                <jb-btn variant="primary" icon="compass" @click="toMarket">去招聘板</jb-btn>
            </jb-empty>

            <button
                v-for="hr in list" :key="hr.id"
                class="jb-card jb-talkitem"
                @click="open(hr.id)"
            >
                <div class="jb-talkitem__head">
                    <span class="jb-talkitem__name">{{ hr.name }}</span>
                    <span class="jb-talkitem__title">{{ hr.title }}</span>
                    <span :class="statusClass(hr.status)">{{ statusText(hr.status) }}</span>
                </div>
                <p class="jb-talkitem__job">{{ hr.job.title }}<i v-if="hr.job.employer"> · {{ hr.job.employer }}</i></p>
                <p class="jb-talkitem__last">{{ lastLine(hr) }}</p>
                <p class="jb-talkitem__when">{{ when(hr) }}</p>
            </button>
        </div>
    `,
};

export const JbTalkPanel = {
    name: 'JbTalkPanel',
    components: { ...UI },
    emits: ['close'],
    data() {
        return { draft: '', showWho: false };
    },
    computed: {
        s() { return store.getState(); },
        hr() { return store.currentTalk(); },
        currency() { return this.s.identity.currency; },
        replying() { return this.s.loading.reply; },
        canSend() { return this.draft.trim().length > 0 && !this.replying && this.hr?.status === TALK_STATUS.open; },
        done() { return this.hr && this.hr.status !== TALK_STATUS.open; },
        hired() { return this.hr?.status === TALK_STATUS.hired; },
    },
    watch: {
        // 新消息进来后滚到底。用 nextTick 是因为 DOM 还没画出新那条
        'hr.messages.length': function scroll() {
            this.$nextTick(() => this.toBottom());
        },
    },
    mounted() {
        this.$nextTick(() => this.toBottom());
    },
    methods: {
        toBottom() {
            const el = this.$refs.flow;
            if (el) el.scrollTop = el.scrollHeight;
        },
        close() { store.closeTalk(); },
        clearError() { store.clearError(); },
        when(m) { return fmtTime(m.ts); },
        async send() {
            if (!this.canSend) return;
            const text = this.draft;
            this.draft = '';
            await store.sendTalk(text);
            this.$nextTick(() => this.toBottom());
        },
        toWork() {
            store.setTab('work');
        },
        async drop() {
            const ok = await confirmDrop();
            if (!ok || !this.hr) return;
            await store.deleteTalk(this.hr.id);
        },
    },
    template: `
        <jb-panel :title="hr ? hr.name : '面试'" @close="close">
            <template #bar>
                <jb-btn size="sm" variant="ghost" @click="showWho = !showWho">
                    {{ showWho ? '收起' : '这是谁' }}
                </jb-btn>
            </template>

            <div v-if="!hr" class="jb-empty">
                <p class="jb-empty__title">这场面试不见了</p>
            </div>

            <template v-else>
                <jb-error :text="s.error" @close="clearError" />

                <!-- 对面是谁：默认收起，展开才占地方 -->
                <section v-if="showWho" class="jb-card jb-card--pad jb-who">
                    <h3 class="jb-who__name">{{ hr.name }} <i>{{ hr.title }}</i></h3>
                    <jb-kv v-if="hr.age" label="年纪" :value="hr.age" />
                    <jb-kv v-if="hr.look" label="外形" :value="hr.look" />
                    <jb-kv v-if="hr.persona" label="性格" :value="hr.persona" />
                    <jb-kv v-if="hr.tone" label="说话" :value="hr.tone" />
                    <jb-kv v-if="hr.care" label="他看重" :value="hr.care" />
                    <jb-kv v-if="hr.dislike" label="他不要" :value="hr.dislike" />
                    <p class="jb-panel__note">
                        入职之后这份人设会跟着工作一起存下来，以后在小剧场里还是他。
                    </p>
                </section>

                <!-- 在招什么 -->
                <div class="jb-card jb-card--pad jb-talk__job">
                    <b>{{ hr.job.title }}</b>
                    <span v-if="hr.job.employer">{{ hr.job.employer }}</span>
                    <span v-if="hr.job.payText">{{ hr.job.payText }} {{ currency }}</span>
                </div>

                <!-- 对话 -->
                <div ref="flow" class="jb-talk__flow">
                    <div
                        v-for="m in hr.messages" :key="m.id"
                        class="jb-bubble"
                        :class="'jb-bubble--' + m.role"
                    >
                        <p class="jb-bubble__text">{{ m.text }}</p>
                        <span v-if="m.role !== 'system'" class="jb-bubble__time">{{ when(m) }}</span>
                    </div>

                    <div v-if="replying" class="jb-bubble jb-bubble--hr jb-bubble--typing">
                        <span class="jb-bubble__dot"></span>
                        <span class="jb-bubble__dot"></span>
                        <span class="jb-bubble__dot"></span>
                    </div>

                    <div v-if="done" class="jb-talk__verdict" :class="hired ? 'is-ok' : 'is-bad'">
                        <b>{{ hired ? '你被录用了' : '这次没成' }}</b>
                        <p v-if="hr.reason">{{ hr.reason }}</p>
                        <jb-btn v-if="hired" size="sm" variant="primary" @click="toWork">去看看这份工作</jb-btn>
                    </div>
                </div>
            </template>

            <!-- 输入区 -->
            <div v-if="hr && !done" class="jb-talk__input">
                <textarea
                    class="jb-textarea"
                    rows="2"
                    :value="draft"
                    placeholder="说点什么。他在等你开口"
                    @input="draft = $event.target.value"
                ></textarea>
                <jb-btn variant="primary" icon="send" :disabled="!canSend" :loading="replying" @click="send">
                    发出去
                </jb-btn>
            </div>

            <div v-else-if="hr" class="jb-talk__input jb-talk__input--done">
                <jb-btn variant="ghost" icon="trash" block @click="drop">删掉这场面试</jb-btn>
            </div>
        </jb-panel>
    `,
};

/**
 * 删除确认走**框架顶层弹窗**而不是自己画一个。
 * 这类「不可撤销」的操作全项目应该长一个样，用户才认得出来它的分量。
 */
function confirmDrop() {
    return new Promise((resolve) => {
        const api = typeof window !== 'undefined' ? window.__phoneConfirm : null;
        if (!api?.request) { resolve(true); return; }
        api.request({
            title: '删掉这场面试？',
            text: '对话记录和这个人都会消失，找不回来。',
            confirmLabel: '删掉',
            danger: true,
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false),
        });
    });
}
