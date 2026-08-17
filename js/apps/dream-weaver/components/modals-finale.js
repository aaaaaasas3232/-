/**
 * 梦境编织 · 杀青梗面板
 *
 * 复原原版 `showFinaleConfigModal`(23816)→ `showFinaleModal`(23994) 两步:
 *
 *   第一步 配置:选模式(电视剧/电影/小说)、选角色(全员或某一个)、填场景描述
 *   第二步 面板:按模式给出可用卡片类型的 tab,下面是卡片列表,底部「收藏这组」
 *
 * ★ 原版在第一步选的角色和场景**没有被第二步用到**(写进实例字段就没人读了)。
 *   这里接上了:AI 填充卡片时会带上它们。
 */

import * as store from '../store.js';
import { DwModal } from './dw-modal.js';
import { SHARED_COMPONENTS } from './shared.js';
import { FINALE_CARD_COMPONENTS, FINALE_CARD_BY_TYPE } from './finale-cards.js';
import {
    FINALE_MODES, FINALE_TYPE_NAMES, FINALE_TYPE_ICONS, typesOfMode,
    blankCard, blankWeiboPost, blankWeiboComment, blankWeiboReply,
    blankGroupMessage, blankTweet, blankForumReply,
    generateFinaleCard, generateFinaleComment,
} from '../services/finale-service.js';
import { createAbort, abort, releaseAbort } from '../services/ai-service.js';
import { resolveCharacterName } from '../services/prompt-builder.js';
import { findById } from '../utils.js';

const GEN_SCOPE = '__finale__';

/** 按 `a.b.0.c` 这样的路径写值 —— 卡片是嵌套结构,逐层判断太啰嗦 */
function setByPath(target, path, value) {
    const keys = String(path).split('.');
    let node = target;
    for (let i = 0; i < keys.length - 1; i += 1) {
        const key = /^\d+$/.test(keys[i]) ? Number(keys[i]) : keys[i];
        if (node[key] == null) return;
        node = node[key];
    }
    const last = keys[keys.length - 1];
    node[/^\d+$/.test(last) ? Number(last) : last] = value;
}

export const DwFinaleModal = {
    name: 'DwFinaleModal',
    components: { DwModal, ...SHARED_COMPONENTS, ...FINALE_CARD_COMPONENTS },
    props: {
        payload: { type: Object, default: () => ({}) },
    },
    emits: ['close', 'notify'],
    data() {
        return {
            step: 'config',          // config | panel
            mode: 'tv',
            characterId: 'all',
            sceneDesc: '',
            activeType: 'weibo',
            busy: false,
        };
    },
    computed: {
        book() { return findById(store.getState().books, this.payload.bookId) || store.getOpenBook(); },
        modes() { return FINALE_MODES; },
        characters() { return this.book?.characters || []; },
        availableTypes() { return typesOfMode(this.mode); },
        cards() { return store.getFinaleCards(this.book?.id, this.activeType); },
        cardComponent() { return FINALE_CARD_BY_TYPE[this.activeType]; },
        typeName() { return FINALE_TYPE_NAMES[this.activeType] || '卡片'; },
        title() {
            return this.step === 'config' ? '杀青梗' : `杀青梗 · ${this.typeName}`;
        },
    },
    methods: {
        nameOf(character) { return resolveCharacterName(character) || '(未命名)'; },
        typeLabel(type) { return FINALE_TYPE_NAMES[type]; },
        typeIcon(type) { return FINALE_TYPE_ICONS[type]; },

        onStart() {
            this.activeType = this.availableTypes[0];
            this.step = 'panel';
        },

        // ── 卡片增删改 ────────────────────
        patchCard(cardIndex, { path, value }) {
            store.updateFinaleCards(this.book.id, this.activeType, (list) => {
                if (!list[cardIndex]) return list;
                setByPath(list[cardIndex], path, value);
                return list;
            });
        },

        onAddCard() {
            store.updateFinaleCards(this.book.id, this.activeType, (list) => [
                ...list,
                blankCard(this.activeType, this.book),
            ]);
        },

        /**
         * 卡片内的所有增删动作都在这里分发。
         *
         * 用一个 switch 而不是给每张卡各写一套 handler:五种卡的动作名不重叠,
         * 而且它们的共同点(改完写回 store + 防抖落盘)完全一样。
         */
        onCardAct(payload) {
            const { action } = payload;
            const type = this.activeType;

            if (action === 'ai-fill') { void this.aiFill(payload); return; }
            if (action === 'ai-comment') { void this.aiComment(payload); return; }

            store.updateFinaleCards(this.book.id, type, (list) => {
                const t = payload.topicIndex ?? payload.chatIndex ?? payload.tweetIndex
                    ?? payload.reviewIndex ?? payload.forumIndex ?? 0;
                const card = list[t];
                if (!card) return list;

                switch (action) {
                    // 微博
                    case 'add-post': card.posts.push(blankWeiboPost()); break;
                    case 'delete-post':
                        (card.posts || []).splice(payload.postIndex, 1);
                        break;
                    case 'add-comment':
                        card.posts[payload.postIndex].comments.push(blankWeiboComment());
                        break;
                    case 'delete-comment':
                        card.posts[payload.postIndex].comments.splice(payload.commentIndex, 1);
                        break;
                    case 'add-reply':
                        card.posts[payload.postIndex].comments[payload.commentIndex].replies.push(blankWeiboReply());
                        break;
                    case 'delete-reply':
                        card.posts[payload.postIndex].comments[payload.commentIndex].replies.splice(payload.replyIndex, 1);
                        break;
                    case 'delete-topic': list.splice(t, 1); break;

                    // 群聊
                    case 'add-message': card.messages.push(blankGroupMessage()); break;
                    case 'delete-message': card.messages.splice(payload.msgIndex, 1); break;
                    case 'delete-group': list.splice(t, 1); break;

                    // 推特
                    case 'add-tweet-post': card.posts.push(blankTweet()); break;
                    case 'delete-tweet': list.splice(t, 1); break;

                    // 影评
                    case 'delete-review': list.splice(t, 1); break;

                    // 论坛
                    case 'add-forum-reply': card.replies.push(blankForumReply()); break;
                    case 'delete-forum-reply': card.replies.splice(payload.replyIndex, 1); break;
                    case 'delete-forum': list.splice(t, 1); break;

                    default: break;
                }
                return list;
            });
        },

        // ── AI ────────────────────────────
        async aiFill(payload) {
            if (this.busy) return;
            const index = payload.topicIndex ?? payload.chatIndex ?? payload.tweetIndex
                ?? payload.reviewIndex ?? payload.forumIndex ?? 0;
            this.busy = true;
            const signal = createAbort(GEN_SCOPE);
            let result;
            try {
                result = await generateFinaleCard({
                    type: this.activeType,
                    mode: this.mode,
                    characterId: this.characterId,
                    sceneDesc: this.sceneDesc,
                    book: this.book,
                    orderedChapters: store.getOrderedChapters(),
                    chapter: store.getOpenChapter(),
                    library: store.getState().library,
                    signal,
                });
            } catch (err) {
                result = { ok: false, error: err?.message || String(err) };
            } finally {
                releaseAbort(GEN_SCOPE);
                this.busy = false;
            }

            if (!result.ok) {
                if (!result.aborted) this.$emit('notify', result.error || '生成失败');
                return;
            }
            store.updateFinaleCards(this.book.id, this.activeType, (list) => {
                list[index] = result.card;
                return list;
            });
            this.$emit('notify', 'AI 已填好这张卡');
        },

        async aiComment(payload) {
            if (this.busy) return;
            const t = payload.topicIndex ?? 0;
            const post = this.cards[t]?.posts?.[payload.postIndex];
            if (!post) return;

            this.busy = true;
            const signal = createAbort(GEN_SCOPE);
            let result;
            try {
                result = await generateFinaleComment({
                    mode: this.mode,
                    target: post.content || this.cards[t].title,
                    book: this.book,
                    orderedChapters: store.getOrderedChapters(),
                    chapter: store.getOpenChapter(),
                    library: store.getState().library,
                    signal,
                });
            } catch (err) {
                result = { ok: false, error: err?.message || String(err) };
            } finally {
                releaseAbort(GEN_SCOPE);
                this.busy = false;
            }

            if (!result.ok) {
                if (!result.aborted) this.$emit('notify', result.error || '评论生成失败');
                return;
            }
            store.updateFinaleCards(this.book.id, this.activeType, (list) => {
                list[t].posts[payload.postIndex].comments.push({
                    ...blankWeiboComment(),
                    ...result.comment,
                });
                return list;
            });
        },

        onStop() { abort(GEN_SCOPE); },

        onArchive() {
            const count = store.archiveFinaleCards(this.book.id, this.activeType);
            this.$emit('notify', count ? `已收藏 ${count} 张${this.typeName}` : '还没有卡片');
        },

        onBack() { this.step = 'config'; },
        onClose() {
            if (this.busy) abort(GEN_SCOPE);
            this.$emit('close');
        },
    },
    beforeUnmount() {
        if (this.busy) abort(GEN_SCOPE);
    },
    template: `
        <DwModal class="dw-finale-modal" :title="title" max-width="350px" @close="onClose">
            <!-- 第一步:配置 -->
            <template v-if="step === 'config'">
                <p class="dw-modal-hint">把这本书当成一部拍完的剧,看看「戏外」是什么样。</p>

                <DwField label="模式">
                    <div class="dw-finale-mode-selector">
                        <button
                            v-for="m in modes"
                            :key="m.id"
                            type="button"
                            class="dw-finale-mode-btn"
                            :class="{ active: mode === m.id }"
                            @click="mode = m.id"
                        >
                            <DwIcon :name="m.id === 'novel' ? 'book' : (m.id === 'movie' ? 'film' : 'tv')" />
                            <span>{{ m.label }}</span>
                        </button>
                    </div>
                </DwField>

                <DwField label="聚焦角色" hint="选「全员」就不特意围绕某个人">
                    <div class="dw-finale-chars">
                        <button
                            type="button"
                            class="dw-finale-char"
                            :class="{ active: characterId === 'all' }"
                            @click="characterId = 'all'"
                        >全员</button>
                        <button
                            v-for="c in characters"
                            :key="c.id"
                            type="button"
                            class="dw-finale-char"
                            :class="{ active: characterId === c.id }"
                            :data-tone="c.tone || null"
                            @click="characterId = c.id"
                        >{{ nameOf(c) }}</button>
                    </div>
                </DwField>

                <DwField label="场景描述" hint="选填。比如「最后一场雪戏拍完,凌晨三点」">
                    <DwTextarea v-model="sceneDesc" :rows="2" placeholder="留空也行" />
                </DwField>
            </template>

            <!-- 第二步:卡片面板 -->
            <template v-else>
                <div class="dw-finale-type-selector">
                    <button
                        v-for="type in availableTypes"
                        :key="type"
                        type="button"
                        class="dw-finale-type-btn"
                        :class="{ active: activeType === type }"
                        @click="activeType = type"
                    >
                        <DwIcon :name="typeIcon(type)" />{{ typeLabel(type) }}
                    </button>
                </div>

                <div class="dw-finale-content">
                    <div v-if="cards.length === 0" class="dw-finale-empty-state">
                        <DwIcon name="tv" />
                        <p class="dw-finale-empty-state-title">还没有{{ typeName }}</p>
                        <p class="dw-finale-empty-state-desc">
                            加一张空卡自己填,或者点卡片上的 ✦ 让 AI 按这本书的设定写一份。
                        </p>
                    </div>

                    <component
                        v-for="(card, i) in cards"
                        :key="card.id"
                        :is="cardComponent"
                        :card="card"
                        :index="i"
                        @patch="patchCard(i, $event)"
                        @act="onCardAct"
                    />

                    <button type="button" class="dw-finale-add-btn" @click="onAddCard">
                        <DwIcon name="plus" />添加{{ typeName }}
                    </button>
                </div>

                <p v-if="busy" class="dw-finale-busy">
                    AI 正在写…
                    <button type="button" class="dw-link-btn" @click="onStop">停止</button>
                </p>
            </template>

            <template #footer>
                <template v-if="step === 'config'">
                    <button type="button" class="ac-btn ac-btn-secondary" @click="onClose">取消</button>
                    <button type="button" class="ac-btn ac-btn-primary" @click="onStart">开始</button>
                </template>
                <template v-else>
                    <button type="button" class="ac-btn ac-btn-secondary" @click="onBack">重选</button>
                    <button type="button" class="ac-btn ac-btn-secondary" :disabled="cards.length === 0" @click="onArchive">收藏这组</button>
                    <button type="button" class="ac-btn ac-btn-primary" @click="onClose">完成</button>
                </template>
            </template>
        </DwModal>
    `,
};

export const FINALE_MODAL_COMPONENTS = { DwFinaleModal };
