/**
 * 梦境编织 · 消息流
 *
 * 1:1 复原原版 `renderChatMessage`(20949)的气泡结构:
 *
 *   .dw-bubble-container                      居中,可整体左右偏移
 *     .dw-message-bubble.user / .ai           **88% 宽**,一角 4px 其余 20px
 *       .dw-bubble-header                     角色标签 · 时间
 *       .dw-bubble-content
 *       (底部一行:tokens)
 *     .dw-bubble-actions                      点气泡后从下方浮出的圆角工具条
 *       主排:改 / 重roll / 绑时间 / 收藏 / 复制 / 更多 / 删除
 *       .dw-hidden-action:点「更多」再展开 格式化 / 分支点 / 杀青
 *
 * ★ 注意气泡是**居中 88% 宽**的,不是聊天软件那种左右分列 ——
 *   这是小说编辑器,正文要占满宽度才好读,左右分列会白白浪费两侧空间。
 *   区分作者/AI 靠的是那个 4px 的尖角在左还是在右,以及左上角的小色块。
 *
 * ── 和原版的两处结构性差别(前面几轮已记录,这里重申)────────────
 *   1. 不再双轨存储:只有 `messages` 是真相,不再维护一份 HTML `content`
 *   2. 不再手动操作 DOM:分支在「分支管理」的脉络树里切,气泡上不画 2/2
 */

import * as store from '../../store.js';
import { SHARED_COMPONENTS } from '../shared.js';
import { segmentParagraphs, decorateCharacters } from '../../services/format-service.js';
import { resolveCharacterName } from '../../services/prompt-builder.js';
import { countWords, formatClock } from '../../utils.js';
import { estimateTokens } from '@/src/core/context-composer.js';

/** 工具条按钮定义 —— 顺序、图标、标题照抄原版 21063-21116 */
const MAIN_ACTIONS = [
    { action: 'edit', icon: 'edit', title: '修改', tone: 'plain' },
    { action: 'reroll', icon: 'refresh', title: '重新生成', tone: 'warn', aiOnly: true },
    { action: 'bind-timeline', icon: 'history', title: '绑定时间', tone: 'info' },
    { action: 'favorite', icon: 'bookmark', title: '收藏', tone: 'plain' },
    { action: 'copy', icon: 'copy', title: '复制', tone: 'plain' },
    { action: 'more', icon: 'moreVertical', title: '更多', tone: 'plain' },
];

/** `hidden: true` 的这几个平时不显示,点「更多」才展开 */
const HIDDEN_ACTIONS = [
    { action: 'format', icon: 'format', title: '格式化选择', tone: 'plain', hidden: true },
    { action: 'node', icon: 'branch', title: '建立分支点', tone: 'info', hidden: true },
    { action: 'finale', icon: 'tv', title: '杀青梗模拟', tone: 'warn', hidden: true },
];

const DELETE_ACTION = { action: 'delete', icon: 'trash', title: '删除', tone: 'danger' };

// ============================================================
// 单条消息
// ============================================================

const MessageBubble = {
    name: 'DwMessageBubble',
    components: SHARED_COMPONENTS,
    props: {
        message: { type: Object, required: true },
        book: { type: Object, required: true },
        chapter: { type: Object, required: true },
        display: { type: Object, required: true },
        rules: { type: Array, default: () => [] },
        active: { type: Boolean, default: false },
        moreOpen: { type: Boolean, default: false },
        selectMode: { type: Boolean, default: false },
    },
    emits: ['action', 'select-text', 'toggle-actions', 'toggle-more'],
    computed: {
        isAi() { return this.message.role === 'ai'; },
        isNote() { return this.message.role === 'note'; },
        bubbleClass() {
            if (this.isNote) return 'note';
            return this.isAi ? 'ai' : 'user';
        },
        roleLabel() {
            if (this.isNote) return '只记录';
            return this.isAi ? '正文' : '我';
        },
        paragraphs() {
            return segmentParagraphs(this.message.content, {
                rules: this.rules,
                characters: decorateCharacters(this.book.characters, resolveCharacterName),
                locations: this.book.locations,
                display: this.display,
            });
        },
        words() { return countWords(this.message.content); },
        tokens() { return estimateTokens(this.message.content); },
        actions() {
            const main = MAIN_ACTIONS.filter((a) => !a.aiOnly || this.isAi);
            return this.moreOpen ? [...main, ...HIDDEN_ACTIONS, DELETE_ACTION] : [...main, DELETE_ACTION];
        },
    },
    methods: {
        onMouseUp() {
            // 平时正文不许选字。选段模式里桌面拖选用这条;手机长按走 editor 的 selectionchange
            if (!this.selectMode) return;
            const selection = window.getSelection?.();
            const text = String(selection?.toString() || '').trim();
            if (text.length >= 2) {
                this.$emit('select-text', { text, messageId: this.message.id });
            }
        },
        act(action, payload) {
            if (action === 'more') {
                this.$emit('toggle-more', this.message.id);
                return;
            }
            this.$emit('action', { action, messageId: this.message.id, ...payload });
        },
        /** 选段模式下点气泡只用来选字 —— 工具条一浮出来就把要选的那几行盖住了 */
        onBubbleClick() {
            if (this.selectMode) return;
            this.$emit('toggle-actions', this.message.id);
        },
        isOnBtn(action) {
            if (action === 'favorite') return Boolean(this.message.favorite);
            if (action === 'format') return this.selectMode;
            return false;
        },
    },
    created() {
        this.formatClock = formatClock;
    },
    template: `
        <div
            class="dw-bubble-container"
            :class="{ 'is-active': active }"
            :data-bubble-id="message.id"
            @mouseup="onMouseUp"
            @touchend="onMouseUp"
        >
            <div
                class="dw-message-bubble"
                :class="[bubbleClass, { 'is-pending': message.pending, 'is-error': !!message.error }]"
                @click="onBubbleClick"
            >
                <div v-if="display.showBubbleHeader !== false" class="dw-bubble-header">
                    <span class="dw-bubble-role">{{ roleLabel }}</span>
                    <span class="dw-bubble-time">{{ formatClock(message.timestamp) }}</span>
                </div>

                <div class="dw-bubble-content">
                    <p v-for="(paragraph, pi) in paragraphs" :key="pi" class="dw-msg-p">
                        <template v-for="(seg, si) in paragraph" :key="si">
                            <span
                                v-if="seg.type === 'char' || seg.type === 'loc'"
                                class="dw-mark"
                                :class="'dw-mark--' + seg.type"
                                :data-tone="seg.tone || null"
                                @click.stop="act('open-mark', { segment: seg })"
                            >{{ seg.text }}</span>
                            <!-- 规则画出来的小东西（[糖果] → 一颗糖）。
                                 HTML 在 format-service 里已经过白名单消毒，插值也转义过。 -->
                            <span
                                v-else-if="seg.type === 'html'"
                                class="dw-seg dw-seg--html"
                                v-html="seg.html"
                            ></span>
                            <span
                                v-else-if="seg.type !== 'text'"
                                class="dw-seg"
                                :class="'dw-seg--' + seg.type"
                            >{{ seg.text }}</span>
                            <template v-else>{{ seg.text }}</template>
                        </template>
                    </p>
                    <span v-if="message.pending" class="dw-msg-caret" aria-hidden="true"></span>
                </div>

                <p v-if="message.error" class="dw-msg-error">{{ message.error }}</p>

                <div v-if="display.showTokens" class="dw-bubble-foot">
                    <span class="dw-message-tokens">{{ words }} 字 · 约 {{ tokens }} tokens</span>
                </div>
            </div>

            <!-- 从气泡下方浮出的工具条 -->
            <div class="dw-bubble-actions" :class="{ visible: active && !message.pending }">
                <button
                    v-for="btn in actions"
                    :key="btn.action"
                    type="button"
                    class="dw-bubble-action-btn"
                    :class="['tone-' + btn.tone, { 'is-on': isOnBtn(btn.action), 'dw-hidden-action': btn.hidden }]"
                    :title="btn.title"
                    :aria-label="btn.title"
                    @click.stop="act(btn.action)"
                ><DwIcon :name="btn.action === 'favorite' && message.favorite ? 'starFilled' : btn.icon" /></button>
            </div>
        </div>
    `,
};

// ============================================================
// 消息流
// ============================================================

export const DwMessageList = {
    name: 'DwMessageList',
    components: { ...SHARED_COMPONENTS, MessageBubble },
    props: {
        book: { type: Object, required: true },
        chapter: { type: Object, required: true },
        display: { type: Object, required: true },
        rules: { type: Array, default: () => [] },
        selectMode: { type: Boolean, default: false },
    },
    emits: ['action', 'select-text'],
    data() {
        return { activeId: '', moreId: '' };
    },
    watch: {
        selectMode(on) {
            // 进选段模式时把还开着的工具条收掉,它就浮在正文上方
            if (on) { this.activeId = ''; this.moreId = ''; }
        },
    },
    computed: {
        messages() { return this.chapter.messages; },
        chapterWords() { return store.getChapterWordCount(this.chapter); },
    },
    methods: {
        onToggleActions(messageId) {
            const next = this.activeId === messageId ? '' : messageId;
            this.activeId = next;
            // 换一条气泡时把「更多」收回去,免得下一条一打开就是展开态
            if (this.moreId !== next) this.moreId = '';
        },
        onToggleMore(messageId) {
            this.moreId = this.moreId === messageId ? '' : messageId;
        },
        onAction(payload) {
            // 点了任何操作就收起工具条 —— 否则删完一条,工具条还悬在原地指向已经不存在的消息
            this.activeId = '';
            this.moreId = '';
            this.$emit('action', payload);
        },
        scrollToBottom(smooth = true) {
            const el = this.$refs.scroller;
            if (!el) return;
            el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
        },
        /**
         * 流式生成时是否该自动跟随滚动。
         * 只有用户本来就在底部附近才跟 —— 他往上翻着看前文时把他拽回底部是最招人烦的行为之一。
         */
        isNearBottom(threshold = 120) {
            const el = this.$refs.scroller;
            if (!el) return true;
            return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
        },
    },
    template: `
        <div ref="scroller" class="dw-chat-container" :class="{ 'is-select-mode': selectMode }">
            <header class="dw-chapter-head">
                <h2 class="dw-chapter-title">{{ chapter.title }}</h2>
                <p class="dw-chapter-sub">
                    {{ chapterWords }} 字
                    <template v-if="chapter.worldTime"> · {{ chapter.worldTime }}</template>
                    <template v-if="chapter.isInnerView"> · 内心视角</template>
                </p>
            </header>

            <div v-if="messages.length === 0" class="dw-chat-welcome">
                <DwIcon name="pen" class="dw-icon-2xl" />
                <h3>开始创作</h3>
                <p>在下面写点什么,或者直接让 AI 起个头</p>
            </div>

            <MessageBubble
                v-for="message in messages"
                :key="message.id"
                :message="message"
                :book="book"
                :chapter="chapter"
                :display="display"
                :rules="rules"
                :active="activeId === message.id"
                :more-open="moreId === message.id"
                :select-mode="selectMode"
                @action="onAction"
                @select-text="$emit('select-text', $event)"
                @toggle-actions="onToggleActions"
                @toggle-more="onToggleMore"
            />
        </div>
    `,
};

export default DwMessageList;
