/**
 * 梦境编织 · 杀青梗社交卡片(五种)
 *
 * 1:1 复原原版 `renderWeiboCards` / `renderGroupChatCards` / `renderTwitterCards` /
 * `renderReviewCards` / `renderForumCards`(24175-24563)。
 *
 * ★ 结构上有一处原版的巧思值得保留:**推特/影评/论坛复用微博那套 DOM**
 *   (`.dw-weibo-topic-card` / `.dw-weibo-post-card` / `.dw-weibo-comment-*`),
 *   只把头部渐变换个色。所以这三种卡不需要各写一套 CSS ——
 *   五种卡加起来只有两套骨架:微博系(话题+帖+评论)和群聊系(气泡流)。
 *
 * ★ 全部字段都可就地编辑(input / contenteditable),和原版一样。
 *   编辑走 `@input` → 往上 emit 一个 patch,由面板统一写回 store 并防抖落盘。
 */

import { DwIcon } from './shared.js';

/** 头像里那个字 */
function initial(name) {
    const text = String(name || '').trim();
    return text ? text[0] : '?';
}

/** 群聊头像的渐变按名字取,同名永远同色(原版 `charCodeAt(0) % 8`) */
function avatarTone(name) {
    const text = String(name || '?');
    return `tone-${text.charCodeAt(0) % 8}`;
}

/** contenteditable 的公共处理:只在 blur 时提交,避免每敲一个字都重渲染把光标顶掉 */
const editableMixin = {
    methods: {
        onEditableBlur(event, path) {
            this.$emit('patch', { path, value: event.target.innerText.trim() });
        },
        onInputChange(event, path) {
            this.$emit('patch', { path, value: event.target.value });
        },
    },
};

// ============================================================
// 微博
// ============================================================

export const DwWeiboCard = {
    name: 'DwWeiboCard',
    components: { DwIcon },
    mixins: [editableMixin],
    props: {
        card: { type: Object, required: true },
        index: { type: Number, required: true },
    },
    emits: ['patch', 'act'],
    methods: {
        initial,
        act(action, payload = {}) {
            this.$emit('act', { action, topicIndex: this.index, ...payload });
        },
    },
    template: `
        <article class="dw-weibo-topic-card">
            <header class="dw-weibo-topic-header">
                <span class="dw-weibo-topic-rank">{{ index + 1 }}</span>
                <div
                    class="dw-weibo-topic-text"
                    contenteditable="true"
                    data-placeholder="输入话题..."
                    @blur="onEditableBlur($event, 'title')"
                >{{ card.title }}</div>
                <input
                    class="dw-weibo-topic-hot"
                    :value="card.hot"
                    placeholder="热度"
                    aria-label="热度"
                    @change="onInputChange($event, 'hot')"
                />
                <div class="dw-weibo-topic-actions">
                    <button type="button" class="dw-weibo-topic-action-btn" title="AI 填充" aria-label="AI 填充" @click="act('ai-fill')">
                        <DwIcon name="heart" />
                    </button>
                    <button type="button" class="dw-weibo-topic-action-btn" title="删除话题" aria-label="删除话题" @click="act('delete-topic')">
                        <DwIcon name="trash" />
                    </button>
                </div>
            </header>

            <section
                v-for="(post, pi) in card.posts"
                :key="post.id"
                class="dw-weibo-post-card"
            >
                <header class="dw-weibo-post-header">
                    <span class="dw-weibo-avatar">{{ initial(post.username) }}</span>
                    <div class="dw-weibo-user-info">
                        <input
                            class="dw-weibo-username"
                            :value="post.username"
                            placeholder="昵称"
                            aria-label="昵称"
                            @change="onInputChange($event, 'posts.' + pi + '.username')"
                        />
                        <p class="dw-weibo-meta">{{ post.time || '刚刚' }}</p>
                    </div>
                </header>

                <div
                    class="dw-weibo-post-content"
                    contenteditable="true"
                    data-placeholder="在这里输入博文内容..."
                    @blur="onEditableBlur($event, 'posts.' + pi + '.content')"
                >{{ post.content }}</div>

                <div class="dw-weibo-post-actions">
                    <button type="button" class="dw-weibo-post-action-btn" @click="act('add-comment', { postIndex: pi })">
                        <DwIcon name="chat" />评论
                    </button>
                    <button type="button" class="dw-weibo-post-action-btn" @click="act('ai-comment', { postIndex: pi })">
                        <DwIcon name="heart" />AI 评论
                    </button>
                    <button type="button" class="dw-weibo-post-action-btn" @click="act('delete-post', { postIndex: pi })">
                        <DwIcon name="trash" />删除
                    </button>
                </div>

                <div v-if="post.comments && post.comments.length" class="dw-weibo-comments">
                    <div v-for="(cmt, ci) in post.comments" :key="cmt.id" class="dw-weibo-comment-item">
                        <span class="dw-weibo-comment-avatar">{{ initial(cmt.username) }}</span>
                        <div class="dw-weibo-comment-body">
                            <input
                                class="dw-weibo-comment-user"
                                :value="cmt.username"
                                placeholder="昵称"
                                aria-label="评论者昵称"
                                @change="onInputChange($event, 'posts.' + pi + '.comments.' + ci + '.username')"
                            />
                            <div
                                class="dw-weibo-comment-text"
                                contenteditable="true"
                                data-placeholder="输入评论..."
                                @blur="onEditableBlur($event, 'posts.' + pi + '.comments.' + ci + '.content')"
                            >{{ cmt.content }}</div>
                            <div class="dw-weibo-comment-meta">
                                <span>{{ cmt.time || '刚刚' }}</span>
                                <span class="dw-weibo-comment-action" @click="act('add-reply', { postIndex: pi, commentIndex: ci })">回复</span>
                                <span class="dw-weibo-comment-action" @click="act('delete-comment', { postIndex: pi, commentIndex: ci })">删除</span>
                            </div>

                            <div v-if="cmt.replies && cmt.replies.length" class="dw-weibo-replies">
                                <div v-for="(rep, ri) in cmt.replies" :key="rep.id" class="dw-weibo-reply-item">
                                    <span class="dw-weibo-reply-avatar">{{ initial(rep.username) }}</span>
                                    <div class="dw-weibo-comment-body">
                                        <input
                                            class="dw-weibo-comment-user"
                                            :value="rep.username"
                                            placeholder="昵称"
                                            aria-label="回复者昵称"
                                            @change="onInputChange($event, 'posts.' + pi + '.comments.' + ci + '.replies.' + ri + '.username')"
                                        />
                                        <div
                                            class="dw-weibo-comment-text"
                                            contenteditable="true"
                                            data-placeholder="输入回复..."
                                            @blur="onEditableBlur($event, 'posts.' + pi + '.comments.' + ci + '.replies.' + ri + '.content')"
                                        >{{ rep.content }}</div>
                                        <div class="dw-weibo-comment-meta">
                                            <!-- ★ 原版这个删除按钮画了但没绑事件,这里接上 -->
                                            <span class="dw-weibo-comment-action"
                                                  @click="act('delete-reply', { postIndex: pi, commentIndex: ci, replyIndex: ri })">删除</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div class="dw-weibo-topic-foot">
                <button type="button" class="dw-weibo-post-action-btn" @click="act('add-post')">
                    <DwIcon name="plus" />添加博文
                </button>
            </div>
        </article>
    `,
};

// ============================================================
// 群聊
// ============================================================

export const DwGroupChatCard = {
    name: 'DwGroupChatCard',
    components: { DwIcon },
    mixins: [editableMixin],
    props: {
        card: { type: Object, required: true },
        index: { type: Number, required: true },
    },
    emits: ['patch', 'act'],
    methods: {
        initial,
        avatarTone,
        act(action, payload = {}) {
            this.$emit('act', { action, chatIndex: this.index, ...payload });
        },
    },
    template: `
        <article class="dw-group-chat-card">
            <header class="dw-group-chat-header">
                <div class="dw-group-chat-name">
                    <DwIcon name="chat" />
                    <input
                        class="dw-group-name-input"
                        :value="card.name"
                        placeholder="群名称"
                        aria-label="群名称"
                        @change="onInputChange($event, 'name')"
                    />
                </div>
                <input
                    class="dw-group-chat-count"
                    type="number"
                    :value="card.memberCount"
                    aria-label="群人数"
                    @change="onInputChange($event, 'memberCount')"
                />
                <div class="dw-group-chat-actions">
                    <button type="button" class="dw-group-chat-action-btn" title="AI 填充" aria-label="AI 填充" @click="act('ai-fill')">
                        <DwIcon name="heart" />
                    </button>
                    <button type="button" class="dw-group-chat-action-btn" title="删除群聊" aria-label="删除群聊" @click="act('delete-group')">
                        <DwIcon name="trash" />
                    </button>
                </div>
            </header>

            <div class="dw-group-chat-messages">
                <div v-for="(msg, mi) in card.messages" :key="msg.id" class="dw-group-bubble-wrapper">
                    <span class="dw-group-bubble-avatar" :class="avatarTone(msg.username)">{{ initial(msg.username) }}</span>
                    <div class="dw-group-bubble-content">
                        <input
                            class="dw-group-bubble-name"
                            :value="msg.username"
                            placeholder="昵称"
                            aria-label="发言人"
                            @change="onInputChange($event, 'messages.' + mi + '.username')"
                        />
                        <div
                            class="dw-group-bubble"
                            contenteditable="true"
                            data-placeholder="输入消息内容..."
                            @blur="onEditableBlur($event, 'messages.' + mi + '.content')"
                        >{{ msg.content }}</div>
                        <div class="dw-group-bubble-actions">
                            <button type="button" class="dw-group-bubble-action" @click="act('delete-message', { msgIndex: mi })">
                                <DwIcon name="trash" />删除
                            </button>
                        </div>
                    </div>
                </div>

                <button type="button" class="dw-group-bubble-action dw-group-add" @click="act('add-message')">
                    <DwIcon name="plus" />添加消息
                </button>
            </div>
        </article>
    `,
};

// ============================================================
// 推特(复用微博骨架,蓝头)
// ============================================================

export const DwTwitterCard = {
    name: 'DwTwitterCard',
    components: { DwIcon },
    mixins: [editableMixin],
    props: {
        card: { type: Object, required: true },
        index: { type: Number, required: true },
    },
    emits: ['patch', 'act'],
    methods: {
        initial,
        act(action, payload = {}) {
            this.$emit('act', { action, tweetIndex: this.index, ...payload });
        },
    },
    template: `
        <article class="dw-weibo-topic-card is-twitter">
            <header class="dw-weibo-topic-header">
                <span class="dw-weibo-topic-rank">X</span>
                <input
                    class="dw-tweet-hashtag-input"
                    :value="card.hashtag"
                    placeholder="话题标签"
                    aria-label="话题标签"
                    @change="onInputChange($event, 'hashtag')"
                />
                <div class="dw-weibo-topic-actions">
                    <button type="button" class="dw-weibo-topic-action-btn" title="AI 填充" aria-label="AI 填充" @click="act('ai-fill')">
                        <DwIcon name="heart" />
                    </button>
                    <button type="button" class="dw-weibo-topic-action-btn" title="删除" aria-label="删除" @click="act('delete-tweet')">
                        <DwIcon name="trash" />
                    </button>
                </div>
            </header>

            <section v-for="(post, pi) in card.posts" :key="post.id" class="dw-weibo-post-card">
                <header class="dw-weibo-post-header">
                    <span class="dw-weibo-avatar">{{ initial(post.username) }}</span>
                    <div class="dw-weibo-user-info">
                        <input
                            class="dw-weibo-username"
                            :value="post.username"
                            placeholder="显示名"
                            aria-label="显示名"
                            @change="onInputChange($event, 'posts.' + pi + '.username')"
                        />
                        <div class="dw-tweet-handle-row">
                            <span>@</span>
                            <input
                                class="dw-tweet-handle-input"
                                :value="post.handle"
                                placeholder="handle"
                                aria-label="handle"
                                @change="onInputChange($event, 'posts.' + pi + '.handle')"
                            />
                            <span class="dw-weibo-meta">· {{ post.time || 'now' }}</span>
                        </div>
                    </div>
                </header>

                <div
                    class="dw-weibo-post-content"
                    contenteditable="true"
                    data-placeholder="What's happening?"
                    @blur="onEditableBlur($event, 'posts.' + pi + '.content')"
                >{{ post.content }}</div>

                <div class="dw-weibo-post-actions">
                    <button type="button" class="dw-weibo-post-action-btn" @click="act('delete-post', { postIndex: pi })">
                        <DwIcon name="trash" />删除
                    </button>
                </div>
            </section>

            <div class="dw-weibo-topic-foot">
                <button type="button" class="dw-weibo-post-action-btn" @click="act('add-tweet-post')">
                    <DwIcon name="plus" />添加推文
                </button>
            </div>
        </article>
    `,
};

// ============================================================
// 影评
// ============================================================

export const DwReviewCard = {
    name: 'DwReviewCard',
    components: { DwIcon },
    mixins: [editableMixin],
    props: {
        card: { type: Object, required: true },
        index: { type: Number, required: true },
    },
    emits: ['patch', 'act'],
    computed: {
        stars() { return [1, 2, 3, 4, 5]; },
    },
    methods: {
        initial,
        act(action, payload = {}) {
            this.$emit('act', { action, reviewIndex: this.index, ...payload });
        },
        setRating(n) {
            this.$emit('patch', { path: 'rating', value: n });
        },
    },
    template: `
        <article class="dw-weibo-topic-card is-review">
            <header class="dw-weibo-topic-header">
                <select
                    class="dw-review-type-select"
                    :value="card.type"
                    aria-label="影评长度"
                    @change="onInputChange($event, 'type')"
                >
                    <option value="short">短评</option>
                    <option value="long">长评</option>
                </select>

                <div class="dw-review-rating" role="radiogroup" aria-label="评分">
                    <button
                        v-for="n in stars"
                        :key="n"
                        type="button"
                        class="dw-star"
                        :class="{ 'is-on': n <= card.rating }"
                        :aria-label="n + ' 星'"
                        @click="setRating(n)"
                    ><DwIcon :name="n <= card.rating ? 'starFilled' : 'star'" /></button>
                </div>

                <div class="dw-weibo-topic-actions">
                    <button type="button" class="dw-weibo-topic-action-btn" title="AI 填充" aria-label="AI 填充" @click="act('ai-fill')">
                        <DwIcon name="heart" />
                    </button>
                    <button type="button" class="dw-weibo-topic-action-btn" title="删除" aria-label="删除" @click="act('delete-review')">
                        <DwIcon name="trash" />
                    </button>
                </div>
            </header>

            <section class="dw-weibo-post-card">
                <header class="dw-weibo-post-header">
                    <span class="dw-weibo-avatar">{{ initial(card.username) }}</span>
                    <div class="dw-weibo-user-info">
                        <input
                            class="dw-weibo-username"
                            :value="card.username"
                            placeholder="影评人"
                            aria-label="影评人"
                            @change="onInputChange($event, 'username')"
                        />
                        <p class="dw-weibo-meta">{{ card.time || '刚刚' }}</p>
                    </div>
                </header>
                <div
                    class="dw-weibo-post-content"
                    :class="{ 'is-long': card.type === 'long' }"
                    contenteditable="true"
                    data-placeholder="写点什么..."
                    @blur="onEditableBlur($event, 'content')"
                >{{ card.content }}</div>
            </section>
        </article>
    `,
};

// ============================================================
// 论坛
// ============================================================

export const DwForumCard = {
    name: 'DwForumCard',
    components: { DwIcon },
    mixins: [editableMixin],
    props: {
        card: { type: Object, required: true },
        index: { type: Number, required: true },
    },
    emits: ['patch', 'act'],
    methods: {
        initial,
        act(action, payload = {}) {
            this.$emit('act', { action, forumIndex: this.index, ...payload });
        },
    },
    template: `
        <article class="dw-weibo-topic-card is-forum">
            <header class="dw-weibo-topic-header">
                <input
                    class="dw-forum-title-input"
                    :value="card.title"
                    placeholder="帖子标题"
                    aria-label="帖子标题"
                    @change="onInputChange($event, 'title')"
                />
                <input
                    class="dw-forum-views-input"
                    :value="card.views"
                    placeholder="浏览"
                    aria-label="浏览量"
                    @change="onInputChange($event, 'views')"
                />
                <div class="dw-weibo-topic-actions">
                    <button type="button" class="dw-weibo-topic-action-btn" title="AI 填充" aria-label="AI 填充" @click="act('ai-fill')">
                        <DwIcon name="heart" />
                    </button>
                    <button type="button" class="dw-weibo-topic-action-btn" title="删除" aria-label="删除" @click="act('delete-forum')">
                        <DwIcon name="trash" />
                    </button>
                </div>
            </header>

            <section class="dw-weibo-post-card">
                <header class="dw-weibo-post-header">
                    <span class="dw-weibo-avatar">{{ initial(card.author) }}</span>
                    <div class="dw-weibo-user-info">
                        <div class="dw-forum-author-row">
                            <input
                                class="dw-weibo-username"
                                :value="card.author"
                                placeholder="楼主"
                                aria-label="楼主"
                                @change="onInputChange($event, 'author')"
                            />
                            <span class="dw-forum-badge">楼主</span>
                        </div>
                        <p class="dw-weibo-meta">{{ card.time || '刚刚' }}</p>
                    </div>
                </header>

                <div
                    class="dw-weibo-post-content"
                    contenteditable="true"
                    data-placeholder="主楼内容..."
                    @blur="onEditableBlur($event, 'content')"
                >{{ card.content }}</div>

                <div class="dw-weibo-post-actions">
                    <button type="button" class="dw-weibo-post-action-btn" @click="act('add-forum-reply')">
                        <DwIcon name="plus" />回复
                    </button>
                </div>
            </section>

            <div v-if="card.replies && card.replies.length" class="dw-weibo-comments">
                <div v-for="(rep, ri) in card.replies" :key="rep.id" class="dw-weibo-comment-item">
                    <span class="dw-weibo-comment-avatar">{{ initial(rep.author) }}</span>
                    <div class="dw-weibo-comment-body">
                        <div class="dw-forum-author-row">
                            <input
                                class="dw-weibo-comment-user"
                                :value="rep.author"
                                placeholder="昵称"
                                aria-label="回复者"
                                @change="onInputChange($event, 'replies.' + ri + '.author')"
                            />
                            <span class="dw-forum-floor">#{{ ri + 2 }}楼</span>
                        </div>
                        <div
                            class="dw-weibo-comment-text"
                            contenteditable="true"
                            data-placeholder="回复内容..."
                            @blur="onEditableBlur($event, 'replies.' + ri + '.content')"
                        >{{ rep.content }}</div>
                        <div class="dw-weibo-comment-meta">
                            <span>{{ rep.time || '刚刚' }}</span>
                            <span class="dw-weibo-comment-action" @click="act('delete-forum-reply', { replyIndex: ri })">删除</span>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    `,
};

export const FINALE_CARD_COMPONENTS = {
    DwWeiboCard, DwGroupChatCard, DwTwitterCard, DwReviewCard, DwForumCard,
};

/** type → 组件名,面板用 `<component :is>` 分发 */
export const FINALE_CARD_BY_TYPE = Object.freeze({
    weibo: 'DwWeiboCard',
    groupchat: 'DwGroupChatCard',
    twitter: 'DwTwitterCard',
    review: 'DwReviewCard',
    forum: 'DwForumCard',
});
