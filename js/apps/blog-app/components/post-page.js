/**
 * 氧气 · 帖子页
 *
 * 正文在这里才出现（懒生成）。评论区默认全部折叠：
 * 列表只显示评论人和一条折叠条，点那条评论才翻开 ——
 * 翻开是 UI 行为，批量生成时正文已在本地，绝不一条评论一次 API。
 *
 * 隐藏彩蛋（作者本人的帖子）只在这一页露一行小字，广场那张卡不给任何暗示。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { fmtCap, fmtCount, remainingCount } from '../utils.js';
import { postTypeLabel } from '../constants.js';

export const OxPostPage = {
    name: 'OxPostPage',
    components: { ...UI },
    data() {
        return {
            unfolded: {},          // commentId -> true（翻开是 UI 状态，不落盘）
            showReading: false,    // 长文的阅读设置条
        };
    },
    computed: {
        s() { return store.getState(); },
        post() { return store.getActivePost(); },
        comments() { return this.s.comments; },
        loading() { return this.s.loading.post; },
        commentsLoading() { return this.s.loading.comments || Boolean(this.s.loading.userComments); },
        isMine() { return this.post?.ownerType === 'user'; },
        isAi() { return this.post?.ownerType === 'ai'; },
        /** 彩蛋：只有点开之后才认得出来，列表里那张卡跟普通帖子一模一样 */
        isEgg() { return store.isEggPost(this.post); },
        eggMood() { return this.isEgg ? String(this.post.mood || '') : ''; },
        noReplies() { return this.post && this.post.wantReplies === false; },
        typeLabel() { return this.post ? postTypeLabel(this.post.type) : ''; },
        paragraphs() {
            const text = String(this.post?.content || '');
            return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
        },
        remaining() {
            if (!this.post) return 0;
            return remainingCount(this.post.commentCount || 0, this.comments.length);
        },
        countLabel() { return fmtCap(this.post?.commentCount || 0); },
        statLine() {
            if (!this.post) return '';
            const bits = [];
            if (this.post.reach) bits.push(`${fmtCount(this.post.reach)} 人路过`);
            bits.push(`${fmtCount(this.post.likes || 0)} 次共鸣`);
            return bits.join(' · ');
        },
        reading() { return this.s.profile?.reading || { fontSize: 16, lineHeight: 1.9, pageWidth: 92 }; },
        contentStyle() {
            if (this.post?.type !== 'long') return {};
            return {
                fontSize: `${this.reading.fontSize}px`,
                lineHeight: String(this.reading.lineHeight),
                width: `${this.reading.pageWidth}%`,
            };
        },
        authorSlot() {
            const a = store.getAuthorById(this.post?.authorId);
            return a ? (a.slot || 0) : -1;
        },
    },
    methods: {
        back() { store.popView(); },
        openAuthor() {
            if (!this.post || this.isMine) return;
            if (this.isAi) return;
            void store.openAuthor(this.post.authorId, '因为 TA 的帖子认识的');
        },
        toggleComment(id) {
            this.unfolded = { ...this.unfolded, [id]: !this.unfolded[id] };
        },
        openCommenter(name) { void store.openCommenter(name); },
        more() { void store.loadMoreComments(); },
        firstBatch() { void store.generateUserComments(); },
        favorite() { void store.toggleFavorite(this.post.id); },
        share() { store.openModal('share', { postId: this.post.id }); },
        edit() { store.openModal('composer', { postId: this.post.id }); },
        reroll() {
            if (!this.isAi) return;
            store.openModal('reroll', { aiPersonId: this.post.aiPersonId, postId: this.post.id });
        },
        remove() {
            store.openModal('confirm', {
                title: '删除这条帖子',
                message: '删掉就没了。分享出去的卡片会显示内容已删除。',
                danger: true,
                okLabel: '删除',
                onOk: () => store.deletePost(this.post.id),
            });
        },
        setReading(patch) { store.setReadingPref(patch); },
    },
    template: `
        <div class="ox-page ox-postpage">
            <OxSubtop :title="typeLabel" @back="back">
                <button v-if="post && post.type === 'long'" type="button" class="ox-subtop__act" @click="showReading = !showReading">Aa</button>
            </OxSubtop>

            <div v-if="s.error" class="ox-errorbar"><span>{{ s.error }}</span></div>

            <OxLoading v-if="loading" :lines="['正文正在展开', '兑现标签的预感']" />

            <template v-else-if="post">
                <div v-if="showReading && post.type === 'long'" class="ox-readingbar">
                    <span class="ox-readingbar__label">字号</span>
                    <button type="button" class="ox-readingbar__btn" @click="setReading({ fontSize: reading.fontSize - 1 })">−</button>
                    <i>{{ reading.fontSize }}</i>
                    <button type="button" class="ox-readingbar__btn" @click="setReading({ fontSize: reading.fontSize + 1 })">+</button>
                    <span class="ox-readingbar__label">行距</span>
                    <button type="button" class="ox-readingbar__btn" @click="setReading({ lineHeight: reading.lineHeight - 0.1 })">−</button>
                    <i>{{ reading.lineHeight.toFixed(1) }}</i>
                    <button type="button" class="ox-readingbar__btn" @click="setReading({ lineHeight: reading.lineHeight + 0.1 })">+</button>
                    <span class="ox-readingbar__label">页宽</span>
                    <button type="button" class="ox-readingbar__btn" @click="setReading({ pageWidth: reading.pageWidth - 2 })">−</button>
                    <i>{{ reading.pageWidth }}%</i>
                    <button type="button" class="ox-readingbar__btn" @click="setReading({ pageWidth: reading.pageWidth + 2 })">+</button>
                </div>

                <header class="ox-post__head">
                    <button type="button" class="ox-post__author" @click="openAuthor">
                        <OxAvatar :name="post.authorName" :slot_="authorSlot" :size="34" />
                        <span class="ox-post__authorname">{{ post.authorName }}</span>
                        <span v-if="isMine" class="ox-post__ownerbadge">你</span>
                        <span v-else-if="isAi" class="ox-post__ownerbadge">TA</span>
                    </button>
                    <div class="ox-post__tags">
                        <span v-for="t in post.tags" :key="t" class="ox-tag ox-tag--big">{{ t }}</span>
                    </div>
                </header>

                <article class="ox-post__content" :class="'is-' + post.type" :style="contentStyle">
                    <p v-for="(p, i) in paragraphs" :key="i">{{ p }}</p>
                </article>

                <p v-if="isEgg" class="ox-eggmark">
                    <i class="ox-eggmark__dot"></i>
                    <span class="ox-eggmark__text">作者本人留下的</span>
                    <em v-if="eggMood" class="ox-eggmark__mood">{{ eggMood }}</em>
                </p>

                <div class="ox-post__stats">{{ statLine }}</div>

                <div class="ox-post__actions">
                    <OxButton size="sm" :variant="post.favorited ? 'ink' : 'line'" icon-name="star" @click="favorite">{{ post.favorited ? '已收藏' : '收藏' }}</OxButton>
                    <OxButton size="sm" icon-name="share" @click="share">分享</OxButton>
                    <template v-if="isMine || isAi">
                        <OxButton size="sm" icon-name="edit" @click="edit">编辑</OxButton>
                        <OxButton v-if="isAi" size="sm" icon-name="refresh" @click="reroll">重 roll</OxButton>
                        <OxButton size="sm" variant="danger" icon-name="trash" @click="remove">删除</OxButton>
                    </template>
                </div>

                <!-- 「只是说说」：没有评论区，连入口都没有 -->
                <section v-if="!noReplies" class="ox-comments">
                    <div class="ox-comments__head">
                        <span class="ox-comments__title">评论</span>
                        <OxCap :value="post.commentCount || 0" />
                        <span class="ox-comments__hint">点一条，才翻开一条</span>
                    </div>

                    <div v-if="!comments.length && !commentsLoading" class="ox-comments__first">
                        <OxButton
                            v-if="isMine || isAi"
                            size="sm" variant="soft" icon-name="comment"
                            @click="firstBatch"
                        >看看大家怎么说</OxButton>
                        <p v-else class="ox-muted">这条帖子的评论还没抵达</p>
                    </div>

                    <div class="ox-comments__list">
                        <div
                            v-for="c in comments" :key="c.id"
                            class="ox-comment" :class="{ 'is-open': unfolded[c.id] }"
                        >
                            <div class="ox-comment__row" role="button" tabindex="0" @click="toggleComment(c.id)">
                                <span class="ox-comment__who" role="button" @click.stop="openCommenter(c.authorName)">
                                    <OxAvatar :name="c.authorName" :size="24" />
                                    <span>{{ c.authorName }}</span>
                                </span>
                                <span class="ox-comment__fold">
                                    <i class="ox-comment__foldline"></i>
                                    <OxIcon name="fold" :size="14" />
                                </span>
                            </div>
                            <div class="ox-comment__body">
                                <p>{{ c.text }}</p>
                                <span class="ox-comment__likes">{{ c.likes || 0 }} 次共鸣</span>
                            </div>
                        </div>
                    </div>

                    <OxLoading v-if="commentsLoading" :lines="['评论正在赶来']" />

                    <div v-else-if="comments.length && remaining > 0" class="ox-comments__more">
                        <OxButton size="sm" variant="ghost" @click="more">还有 {{ remaining > 99 ? '99+' : remaining }} 条 · 再看 5 条</OxButton>
                    </div>
                </section>

                <p v-else class="ox-post__noreply">这条只是说说。没有评论区，风就这么吹过去了。</p>
            </template>

            <OxEmpty v-else icon-name="question" title="帖子不见了" desc="可能已被删除。" />
        </div>
    `,
};
