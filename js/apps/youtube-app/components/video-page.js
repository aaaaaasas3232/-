/**
 * 萤火 · 视频详情页（外部视频 / 自己与 AI 的作品共用）
 *
 * 外部视频：详情 + 首批评论在打开时生成过一次；「更多评论」每次 +5（一次 API）。
 * 作品：数据（播放 / 赞 / 评论总数）是 JS 算好的；「让观众评论」按批生成正文，
 *       生成到总数就停，按钮消失 —— 评论数只显示 99+，内部仍是真实数值。
 * 点频道主头像 / 评论人名字 → 才生成对方主页（不点不生成）。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { fmtCap, fmtCount, remainingComments } from '../services/stats.js';
import { COMMENT_PAGE } from '../constants.js';

export const YtVideoPage = {
    name: 'YtVideoPage',
    components: { ...UI },
    data() {
        return { commentDraft: '' };
    },
    computed: {
        s() { return store.getState(); },
        video() { return this.s.activeVideo; },
        isUpload() { return this.s.activeVideoKind === 'upload'; },
        isMine() { return this.isUpload && this.video?.ownerType === 'user'; },
        isAiWork() { return this.isUpload && this.video?.ownerType === 'ai'; },
        creator() {
            if (!this.video) return null;
            return store.getCreatorById(this.video.creatorId || this.video.ownerCreatorId);
        },
        creatorLive() { return this.creator ? store.creatorIsLive(this.creator) : false; },
        detail() { return this.video?.detail || null; },
        sections() {
            if (this.isUpload) return this.video?.sections || [];
            return this.detail?.sections || [];
        },
        intro() {
            if (this.isUpload) return this.video?.intro || this.video?.blurb || '';
            return this.detail?.intro || '';
        },
        viewsLabel() {
            const n = this.isUpload ? (this.video?.stats?.views || 0) : (this.video?.views || 0);
            return fmtCount(n) + ' 次观看';
        },
        likesLabel() {
            const n = this.isUpload ? (this.video?.stats?.likes || 0) : (this.detail?.likes || 0);
            return fmtCount(n);
        },
        comments() { return this.s.comments; },
        commentTotal() {
            if (this.isUpload) return this.video?.stats?.comments || 0;
            return Math.max(this.detail?.commentCount || 0, this.comments.length);
        },
        commentTotalLabel() { return fmtCap(this.commentTotal); },
        hasMoreComments() {
            if (this.isUpload) {
                return remainingComments(this.video?.stats?.comments, this.video?.generatedComments || 0) > 0;
            }
            return this.detail ? this.comments.length < this.commentTotal : false;
        },
        moreLabel() {
            return this.comments.length ? `更多评论（每次 ${COMMENT_PAGE} 条）` : '看看观众怎么说';
        },
        detailLoading() { return this.s.loading.detail; },
        commentsLoading() { return this.s.loading.comments || this.s.loading.userComments === this.video?.id; },
        favorited() { return Boolean(this.video?.favorited); },
        error() { return this.s.error; },
        aiRerolling() { return this.isAiWork && this.s.loading.aiVideo === this.video?.ownerCreatorId; },
    },
    methods: {
        back() { store.closeVideo(); },
        fmtLikes(n) { return fmtCount(n); },
        openCreator() {
            if (this.creator) store.openCreator(this.creator.creatorId);
        },
        openCommenter(comment) {
            if (comment.isUser || !comment.authorId) return;
            store.openCreator(comment.authorId);
        },
        favorite() { store.toggleFavorite(this.video); },
        share() { store.openModal('share', { video: this.video }); },
        loadMore() {
            if (this.isUpload) store.generateUserComments();
            else store.generateMoreComments();
        },
        retryDetail() { store.generateVideoDetail(this.video); },
        async sendComment() {
            const text = this.commentDraft.trim();
            if (!text) return;
            const ok = await store.postComment(text);
            if (ok) this.commentDraft = '';
        },
        edit() {
            store.openModal('upload-editor', { mode: 'edit', uploadId: this.video.id });
        },
        reroll() {
            store.openModal('reroll', {
                title: `重新让 ${this.video.ownerName} 拍一条`,
                onOk: (opinion) => store.generateAiVideo(this.video.ownerCreatorId, {
                    opinion, rerollOf: this.video.id,
                }),
            });
        },
        remove() {
            store.openModal('confirm', {
                title: '删除这条视频？',
                message: '视频和它的评论都会删除。分享出去的卡片会显示「内容已删除」。',
                okLabel: '删除',
                danger: true,
                onOk: () => store.deleteUpload(this.video.id),
            });
        },
        clearError() { store.clearError(); },
    },
    template: `
        <div class="yt-page yt-video" v-if="video">
            <div class="yt-subtop">
                <button type="button" class="yt-subtop__back" aria-label="返回" @click="back"><YtIcon name="back" :size="18" /></button>
                <span class="yt-subtop__title">{{ isUpload ? (isMine ? '我的视频' : '作品') : '视频' }}</span>
            </div>

            <YtCover :text="video.coverText" :hue="video.coverHue" :duration="video.durationLabel" />

            <h1 class="yt-video__title">{{ video.title }}</h1>
            <p class="yt-video__meta">{{ viewsLabel }}<template v-if="video.publishedLabel"> · {{ video.publishedLabel }}</template><template v-if="video.kind"> · {{ video.kind }}</template></p>

            <div class="yt-video__actions">
                <span class="yt-action is-static"><YtIcon name="like" :size="17" /><i>{{ likesLabel }}</i></span>
                <button type="button" class="yt-action" :class="{ 'is-on': favorited }" @click="favorite">
                    <YtIcon name="star" :size="17" /><i>{{ favorited ? '已收藏' : '收藏' }}</i>
                </button>
                <button type="button" class="yt-action" @click="share"><YtIcon name="share" :size="17" /><i>分享</i></button>
                <template v-if="isMine || isAiWork">
                    <button type="button" class="yt-action" @click="edit"><YtIcon name="pen" :size="17" /><i>编辑</i></button>
                    <button v-if="isAiWork" type="button" class="yt-action" @click="reroll"><YtIcon name="reroll" :size="17" /><i>重 roll</i></button>
                    <button type="button" class="yt-action is-danger" @click="remove"><YtIcon name="trash" :size="17" /><i>删除</i></button>
                </template>
            </div>

            <button v-if="creator" type="button" class="yt-video__creator" @click="openCreator">
                <YtAvatar :creator="creator" :size="40" :live="creatorLive" />
                <span class="yt-video__creator-main">
                    <b>{{ creator.name }}</b>
                    <span>{{ creator.profileGenerated ? fmtLikes(creator.followers) + ' 粉丝' : '点开看看 TA 的频道' }}</span>
                </span>
                <span v-if="creatorLive" class="yt-livetag"><i></i>直播中</span>
                <YtIcon v-else name="chevron" :size="16" />
            </button>

            <div v-if="error" class="yt-error">
                <p>{{ error }}</p>
                <div class="yt-error__actions">
                    <YtButton v-if="!isUpload && !detail" size="sm" variant="soft" @click="retryDetail">重试生成</YtButton>
                    <YtButton size="sm" variant="ghost" @click="clearError">知道了</YtButton>
                </div>
            </div>

            <YtLoading v-if="detailLoading || aiRerolling" :lines="['在看这条视频', '在记内容梗概', '快好了']" />

            <template v-else>
                <YtSection v-if="intro" title="简介">
                    <p class="yt-video__intro">{{ intro }}</p>
                </YtSection>

                <YtSection v-if="sections.length" title="视频内容" sub="文字模拟，读完等于看完">
                    <ol class="yt-chapters">
                        <li v-for="(sec, i) in sections" :key="i" class="yt-chapters__item">
                            <span class="yt-chapters__at">{{ sec.at || '·' }}</span>
                            <p class="yt-chapters__text">{{ sec.text }}</p>
                        </li>
                    </ol>
                </YtSection>

                <YtSection :title="'评论 ' + commentTotalLabel" :sub="isUpload ? '总量按你的粉丝规模算出' : ''">
                    <YtEmpty
                        v-if="!comments.length && !hasMoreComments"
                        icon-name="comment" title="还没有评论"
                        :desc="isUpload ? '粉丝还太少，或者视频刚发出去。' : '详情生成后评论会跟着出现。'"
                    />
                    <div v-for="c in comments" :key="c.id" class="yt-comment">
                        <button
                            type="button" class="yt-comment__avatar" :disabled="c.isUser || !c.authorId"
                            @click="openCommenter(c)"
                        >
                            <YtAvatar :creator="c.authorId ? (s.creators.find(x => x.creatorId === c.authorId) || null) : null" :name="c.authorName" :size="32" />
                        </button>
                        <div class="yt-comment__body">
                            <button
                                type="button" class="yt-comment__name" :disabled="c.isUser || !c.authorId"
                                @click="openCommenter(c)"
                            >{{ c.authorName }}<i v-if="c.isUser" class="yt-comment__metag">我</i></button>
                            <p class="yt-comment__text">{{ c.text }}</p>
                            <span v-if="c.likes" class="yt-comment__likes"><YtIcon name="like" :size="12" />{{ fmtLikes(c.likes) }}</span>
                        </div>
                    </div>

                    <YtButton
                        v-if="hasMoreComments"
                        variant="soft" size="sm" block icon-name="comment"
                        :loading="commentsLoading"
                        @click="loadMore"
                    >{{ moreLabel }}</YtButton>

                    <div class="yt-commentbox">
                        <input
                            class="yt-input" v-model="commentDraft" maxlength="120"
                            placeholder="说点什么…" @keydown.enter="sendComment"
                        />
                        <YtButton size="sm" variant="primary" icon-name="send" :disabled="!commentDraft.trim()" @click="sendComment">发</YtButton>
                    </div>
                </YtSection>
            </template>
        </div>
    `,
};
