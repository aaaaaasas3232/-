/**
 * 情景剧场 · 一条消息
 *
 * ── 一条消息可能长成三种样子 ──────────────────────────────────────
 *
 *   1. **纯文本 + 对话体**  → 放进气泡(气泡从气泡机来)
 *   2. **纯文本 + 日记/博客体** → 放进对应的卡片
 *   3. **命中了正则**       → 那一段变成卡片,剩下的照常
 *
 * 所以渲染流程是:先按正则切块 → 逐块决定用什么壳。
 * 一条消息里可以既有气泡又有卡片(AI 说了两句话,中间发了一张博客)。
 *
 * ── 关于 v-html ───────────────────────────────────────────────────
 *
 * 卡片 HTML 由 `regex-engine.renderCard()` 产出,那里每一处插值都过了
 * `escapeHtml`。这是全 App 唯一一处 `v-html`,别在别处再开第二个。
 *
 * ── 头像 / 名字 / 时间戳 ──────────────────────────────────────────
 *
 * 全部由**外观主题**决定,不由气泡决定。参考的气泡编辑器把时间戳和头像
 * 做进了气泡样式里,结果是同一套气泡换个情景就用不了 —— 那不是气泡的属性,
 * 是这一屏排版的属性。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { BubbleView } from '@/src/core/components/bubble-view.js';
import { renderBlocks } from '../services/regex-engine.js';
import { formatTime, safeImageUrl, asArray } from '../utils.js';
import { createBubbleConfig } from '@/src/core/bubble-style.js';

/**
 * 没从气泡机拿到气泡时的兜底。
 *
 * ★ 用 CSS 变量而不是写死颜色:这样它跟着界面配色走,
 *   用户至少能看清字。写死一个粉色的话,深色配色下会白底黑字晃眼。
 *   `createBubbleConfig` 对不认识的值原样透传,`var()` 能一路走到 style 上。
 */
function fallbackBubble(side) {
    return createBubbleConfig({
        side,
        bgColor: side === 'right' ? 'var(--sp-primary-soft)' : 'var(--sp-surface)',
        textColor: 'var(--sp-text)',
        borderWidth: 1,
        borderColor: 'var(--sp-border)',
        radiusTL: 18, radiusTR: 18,
        radiusBR: side === 'right' ? 6 : 18,
        radiusBL: side === 'right' ? 18 : 6,
        shadowOpacity: 0,
        tails: [],
    });
}

export const SpMessage = {
    name: 'SpMessage',
    components: { ...SHARED_COMPONENTS, BubbleView },
    props: {
        message: { type: Object, required: true },
        /** 已编译的正则 */
        rules: { type: Array, default: () => [] },
        theme: { type: Object, required: true },
        bubbles: { type: Object, default: () => ({ left: null, right: null, shapes: [] }) },
        /** 场景默认体裁 */
        mode: { type: String, default: 'dialogue' },
        editing: { type: Boolean, default: false },
    },
    emits: ['edit', 'save-edit', 'cancel-edit', 'remove', 'reroll'],
    data() {
        return { draft: this.message.text, menuOpen: false };
    },
    watch: {
        editing(value) { if (value) this.draft = this.message.text; },
    },
    computed: {
        isUser() { return this.message.role === 'user'; },
        isSystem() { return this.message.role === 'system'; },
        side() { return this.isUser ? 'right' : 'left'; },
        who() { return store.speakerOf(this.message); },

        blocks() {
            return renderBlocks(this.message.text, this.rules, {
                authorName: this.who.name,
                timeText: this.timeText,
            });
        },

        bubbleConfig() {
            const picked = this.isUser ? this.bubbles.right : this.bubbles.left;
            return picked || fallbackBubble(this.side);
        },
        shapes() { return asArray(this.bubbles.shapes); },

        // ── 排版设定 ──────────────────────
        showAvatar() {
            if (this.isSystem) return false;
            return this.isUser ? this.theme.avatar.showRight : this.theme.avatar.showLeft;
        },
        avatarStyle() {
            const url = safeImageUrl(this.who.avatar);
            const size = `${this.theme.avatar.size}px`;
            const style = { width: size, height: size };
            if (url) style.backgroundImage = `url("${url.replace(/["\\]/g, encodeURIComponent)}")`;
            return style;
        },
        avatarInitial() { return (this.who.name || '?').slice(0, 1); },
        showNameAbove() { return !this.isSystem && this.theme.name.position === 'above' && Boolean(this.who.name); },
        showNameInline() { return !this.isSystem && this.theme.name.position === 'inline' && Boolean(this.who.name); },
        timeText() { return formatTime(this.message.createdAt); },
        showTimeAbove() { return !this.isSystem && this.theme.time.position === 'above'; },
        showTimeBelow() { return !this.isSystem && this.theme.time.position === 'below'; },
        /** 「气泡里」的时间戳做成正文后面的一小段,而不是绝对定位 —— 绝对定位会压住文字 */
        showTimeInside() { return !this.isSystem && this.theme.time.position === 'inside'; },

        /** 这一条要不要用气泡壳 */
        useBubble() {
            if (this.isSystem) return false;
            return this.mode === 'dialogue' || this.mode === 'mixed';
        },
        /** 纯文本块 —— 对话体下它们合成一个气泡,不是每块一个 */
        plainText() {
            return this.blocks.filter((b) => b.kind === 'text').map((b) => b.text.trim()).filter(Boolean).join('\n');
        },
        cardBlocks() { return this.blocks.filter((b) => b.kind === 'card'); },
        hasPlain() { return Boolean(this.plainText); },
    },
    methods: {
        toggleMenu() { this.menuOpen = !this.menuOpen; },
        onEdit() { this.menuOpen = false; this.$emit('edit', this.message.id); },
        onSave() { this.$emit('save-edit', { id: this.message.id, text: this.draft }); },
        onCancel() { this.$emit('cancel-edit'); },
        onRemove() { this.menuOpen = false; this.$emit('remove', this.message); },
        onReroll() { this.menuOpen = false; this.$emit('reroll', this.message); },
    },
    template: `
        <div
            class="sp-msg"
            :class="['is-' + side, { 'is-system': isSystem, 'is-editing': editing, 'has-menu': menuOpen }]"
            :data-density="theme.density"
        >
            <!-- 旁白 / 从小剧场导入的场景说明 -->
            <template v-if="isSystem">
                <template v-if="editing">
                    <textarea class="sp-msg-editor" v-model="draft" rows="4"></textarea>
                    <div class="sp-msg-editor-acts">
                        <button type="button" class="sp-msg-tool" @click="onCancel">取消</button>
                        <button type="button" class="sp-msg-tool is-primary" @click="onSave">保存</button>
                    </div>
                </template>
                <template v-else>
                    <!-- ★ 旁白也走正则。用户在「自己写一条」里贴一段 [博客:…] 时,
                         多半就是想要一张卡,而不是一行居中小字 -->
                    <p v-if="hasPlain" class="sp-msg-system">{{ plainText }}</p>
                    <div
                        v-for="(block, i) in cardBlocks"
                        :key="block.ruleId + '-' + i"
                        class="sp-card-slot"
                        v-html="block.html"
                    ></div>
                </template>
                <div class="sp-msg-tools">
                    <button type="button" class="sp-msg-tool" @click="onEdit">改</button>
                    <button type="button" class="sp-msg-tool is-danger" @click="onRemove">删</button>
                </div>
            </template>

            <template v-else>
                <div v-if="showTimeAbove || showNameAbove" class="sp-msg-meta">
                    <span v-if="showNameAbove">{{ who.name }}</span>
                    <span v-if="showTimeAbove">{{ timeText }}</span>
                </div>

                <div class="sp-msg-line">
                    <span
                        v-if="showAvatar"
                        class="sp-avatar"
                        :data-shape="theme.avatar.shape"
                        :style="avatarStyle"
                        :aria-label="who.name"
                    ><em v-if="!who.avatar">{{ avatarInitial }}</em></span>

                    <div class="sp-msg-body">
                        <span v-if="showNameInline" class="sp-msg-inline-name">{{ who.name }}</span>

                        <!-- 编辑态:不管什么体裁都变成一个文本框,免得改到一半看不到全文 -->
                        <template v-if="editing">
                            <textarea class="sp-msg-editor" v-model="draft" rows="4"></textarea>
                            <div class="sp-msg-editor-acts">
                                <button type="button" class="sp-msg-tool" @click="onCancel">取消</button>
                                <button type="button" class="sp-msg-tool is-primary" @click="onSave">保存</button>
                            </div>
                        </template>

                        <template v-else>
                            <!-- 正文 -->
                            <template v-if="hasPlain">
                                <BubbleView
                                    v-if="useBubble"
                                    :config="bubbleConfig"
                                    :shapes="shapes"
                                >
                                    {{ plainText }}<em v-if="showTimeInside" class="sp-msg-inline-time">{{ timeText }}</em>
                                </BubbleView>
                                <article v-else class="spc spc-diary" :style="theme.cardVars">
                                    <div class="spc-diary-body">{{ plainText }}</div>
                                    <footer v-if="showTimeInside" class="spc-diary-foot">{{ timeText }}</footer>
                                </article>
                            </template>

                            <!-- 正则命中的卡片 -->
                            <div
                                v-for="(block, i) in cardBlocks"
                                :key="block.ruleId + '-' + i"
                                class="sp-card-slot"
                                v-html="block.html"
                            ></div>
                        </template>

                        <div v-if="showTimeBelow" class="sp-msg-time-below">{{ timeText }}</div>
                    </div>

                    <button
                        type="button"
                        class="sp-msg-more"
                        :aria-label="menuOpen ? '收起操作' : '这条的操作'"
                        @click="toggleMenu"
                    >···</button>
                </div>

                <div v-if="menuOpen && !editing" class="sp-msg-tools">
                    <button type="button" class="sp-msg-tool" @click="onEdit">编辑</button>
                    <button type="button" class="sp-msg-tool" @click="onReroll">重 roll</button>
                    <button type="button" class="sp-msg-tool is-danger" @click="onRemove">删除</button>
                </div>
            </template>
        </div>
    `,
};

export default SpMessage;
