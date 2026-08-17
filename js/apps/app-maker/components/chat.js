/**
 * AI 需求翻译页
 *
 * 用户说大白话，AI 给出这个项目里的准确术语和具体的问卷建议，
 * 建议还能一键写回问卷。
 *
 * ── 为什么这一页值得单独存在 ──────────────────────────────────────
 * 问卷解决的是「有哪些选项」，解决不了「我想要的那个东西叫什么」。
 * 用户卡在后一步的时候，之前只能去科普页一个个词翻。
 * 这一页反过来：用户描述，AI 负责查词。
 */

import * as store from '../store.js';
import { askAssistant, applySuggestion, describeApiState } from '../services/ai.js';
import { buildBlueprint } from '../survey/blueprint.js';
import { ICONS } from '../icons.js';

const QUICK_ASKS = [
    '我想要那种一格一格的，点进去能看大图',
    '首页想要像小红书那样两列错落的',
    '删除的时候要弹个框问一下',
    '想在手机顶上那个小黑条显示进度',
    '桌面上想放个卡片直接看数字',
    '帮我看看现在的配置有没有问题',
];

export const AmChat = {
    name: 'AmChat',
    props: {
        state: { type: Object, required: true },
    },
    computed: {
        icons() { return ICONS; },
        chat() { return this.state.chat; },
        api() { return describeApiState(); },
        hasMessages() { return this.chat.messages.length > 0; },
    },
    methods: {
        async send(text) {
            const input = String(text ?? this.chat.input).trim();
            if (!input || this.chat.sending) return;

            store.pushChatMessage('user', input);
            this.chat.input = '';
            this.chat.error = '';
            this.chat.sending = true;
            this.scrollDown();

            const result = await askAssistant({
                blueprint: buildBlueprint(this.state.answers),
                history: this.chat.messages.slice(0, -1),
                input,
            });

            this.chat.sending = false;
            if (result.ok) {
                store.pushChatMessage('assistant', result.text, { suggestion: result.suggestion || null });
            } else {
                this.chat.error = result.error;
            }
            this.scrollDown();
        },
        apply(message) {
            const { applied, skipped } = applySuggestion(message.suggestion, store);
            message.applied = true;
            const parts = [];
            if (applied.length) parts.push(`已经填进问卷：${applied.join('、')}`);
            if (skipped.length) parts.push(`这几项没认出来，跳过了：${skipped.join('、')}`);
            store.pushChatMessage('system', parts.join('。') || '这条建议里没有能直接填的字段。');
            this.scrollDown();
        },
        clear() {
            store.clearChat();
        },
        onKeydown(e) {
            // 手机上回车就是换行，发送必须点按钮；桌面上 Cmd/Ctrl+Enter 发送
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                this.send();
            }
        },
        scrollDown() {
            this.$nextTick(() => {
                const el = this.$refs.scroll;
                if (el) el.scrollTop = el.scrollHeight;
            });
        },
    },
    mounted() {
        this.scrollDown();
    },
    template: `
        <div class="am-chat">
            <div class="am-veil"></div>
            <div class="am-chat__scroll" ref="scroll">
                <!-- 「清空」跟着内容一起滚走。做成浮在右上角的话，
                     会正好压在第一条用户消息上（用户消息是右对齐的）。 -->
                <div v-if="hasMessages" class="am-chat__toolrow">
                    <button type="button" class="am-chat__clear" @click="clear">清空对话</button>
                </div>

                <div v-if="!hasMessages" class="am-chat__intro">
                    <h2 class="am-chat__title">说人话就行</h2>
                    <p class="am-chat__lead">
                        你不用知道「瀑布流」「模态框」这些词。把想要的样子用大白话讲出来，
                        我告诉你它在这个项目里叫什么、问卷里该怎么选。
                    </p>
                    <div class="am-chat__api" :class="{ 'is-bad': !api.ok }">
                        <i aria-hidden="true"></i>{{ api.ok ? '正在用：' + api.text : api.text }}
                    </div>
                    <div class="am-chat__quicklabel">可以这么问</div>
                    <div class="am-chat__quick">
                        <button v-for="q in quickAsks" :key="q" type="button" @click="send(q)">{{ q }}</button>
                    </div>
                </div>

                <div v-for="m in chat.messages" :key="m.id" class="am-msg" :class="'am-msg--' + m.role">
                    <div class="am-msg__bubble">{{ m.content }}</div>
                    <button
                        v-if="m.role === 'assistant' && m.suggestion && !m.applied"
                        type="button" class="am-msg__apply"
                        @click="apply(m)"
                    >把这些填进问卷</button>
                    <span v-else-if="m.applied" class="am-msg__applied">已填进问卷</span>
                </div>

                <div v-if="chat.sending" class="am-msg am-msg--assistant">
                    <div class="am-msg__bubble am-msg__bubble--typing"><i></i><i></i><i></i></div>
                </div>

                <div v-if="chat.error" class="am-chat__error">{{ chat.error }}</div>
            </div>

            <div class="am-chat__composer">
                <textarea
                    class="am-chat__input"
                    rows="1"
                    v-model="chat.input"
                    :disabled="chat.sending"
                    placeholder="说说你想要什么样的"
                    @keydown="onKeydown"
                ></textarea>
                <button
                    type="button" class="am-chat__send"
                    :disabled="chat.sending || !chat.input.trim()"
                    aria-label="发送"
                    @click="send()"
                    v-html="icons.arrowUp"
                ></button>
            </div>
        </div>
    `,
    data() {
        return { quickAsks: QUICK_ASKS };
    },
};
