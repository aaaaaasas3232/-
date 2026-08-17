/**
 * 声浪 · 板块（tab 页 + 板块信息流覆盖页 + 帖子楼层覆盖页）
 *
 * 预置帖零 token；AI 只在用户点击时介入：
 *   「让论坛热闹一下」批量 AI 帖 / 用户帖「生成评论」/ 围观楼「生成锐评」/ 赛后楼「生成赛报」。
 * 评论可删除（自己帖子下的持久评论），没有重 roll。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { presetPostBody, stanceLabel } from '../services/forum-engine.js';
import { asArray } from '../utils.js';

export const EfBoardsPage = {
    name: 'EfBoardsPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        boards() { return store.boards(); },
        heat() { return this.s.heat; },
    },
    methods: {
        openBoard(id) { store.setView('board', { boardId: id }); },
        heatOf(board) {
            if (board.teamId) return this.heat[board.teamId] || 40;
            return 50;
        },
        isMyTeam(board) { return board.teamId === this.s.profile?.userTeamId; },
    },
    template: `
        <div class="ef-page">
            <EfSection title="板块" sub="每支战队一个专区，外加总版与赛后楼">
                <button v-for="board in boards" :key="board.id" type="button"
                    class="ef-boardrow" @click="openBoard(board.id)">
                    <div class="ef-boardrow__main">
                        <b>{{ board.name }}<EfTag v-if="isMyTeam(board)" tone="success">主队</EfTag></b>
                        <i>{{ board.desc }}</i>
                    </div>
                    <div v-if="board.kind === 'team'" class="ef-boardrow__heat">
                        <span class="ef-boardrow__heatbar"><i :style="{ width: heatOf(board) + '%' }"></i></span>
                        <em>热度 {{ heatOf(board) }}</em>
                    </div>
                    <EfIcon name="chevron" :size="14" />
                </button>
            </EfSection>
        </div>
    `,
};

export const EfBoardPage = {
    name: 'EfBoardPage',
    components: { ...UI },
    data() {
        return { batchError: '' };
    },
    computed: {
        s() { return store.getState(); },
        boardId() { return this.s.viewPayload?.boardId || 'general'; },
        board() { return store.boards().find((b) => b.id === this.boardId) || { name: '板块', desc: '' }; },
        feed() { return store.boardFeed(this.boardId); },
        loadingBatch() { return this.s.loading.boardBatch; },
    },
    methods: {
        back() { store.setView(''); },
        openThread(post) { store.setView('thread', { postId: post.id, boardId: this.boardId }); },
        newPost() { store.openModal({ type: 'new-post', boardId: this.boardId }); },
        async liven() {
            this.batchError = '';
            const result = await store.aiBoardBatch(this.boardId);
            if (!result.ok && result.error) this.batchError = result.error;
            else if (result.ok) store.showToast(`来了 ${result.count} 条新帖`);
        },
    },
    template: `
        <div class="ef-overlay">
            <header class="ef-overlay__head">
                <button type="button" class="ef-overlay__back" @click="back"><EfIcon name="back" :size="18" /></button>
                <div class="ef-overlay__title"><b>{{ board.name }}</b><i>{{ board.desc }}</i></div>
                <EfBtn size="sm" variant="soft" iconName="fire" :loading="loadingBatch" @click="liven">热闹一下</EfBtn>
                <EfBtn size="sm" variant="ink" iconName="pen" @click="newPost">发帖</EfBtn>
            </header>
            <div class="ef-overlay__body">
                <p v-if="batchError" class="ef-error">{{ batchError }}</p>
                <EfPostCard v-for="post in feed" :key="post.id" :post="post" @open="openThread" />
                <EfEmpty v-if="!feed.length" iconName="board" title="这个板块今天很安静" desc="发一帖，或者点「热闹一下」让世界观网友进场" />
            </div>
        </div>
    `,
};

export const EfThreadPage = {
    name: 'EfThreadPage',
    components: { ...UI },
    data() {
        return {
            comments: [],
            page: 0,
            reply: '',
            replyIdentityId: '',
            error: '',
            loadingList: false,
        };
    },
    computed: {
        s() { return store.getState(); },
        postId() { return this.s.viewPayload?.postId || ''; },
        boardId() { return this.s.viewPayload?.boardId || ''; },
        post() { return store.findPost(this.postId, this.boardId); },
        body() {
            if (!this.post) return '';
            if (this.post.kind === 'preset') return presetPostBody(this.post, {});
            return this.post.body || '';
        },
        identities() { return asArray(this.s.profile?.identities); },
        isMyPost() { return this.post?.kind === 'user'; },
        canGenerate() { return this.post && (this.post.kind === 'user' || this.post.kind === 'ai'); },
        isRankWatch() { return this.post?.kind === 'rank-watch'; },
        isMatch() { return this.post?.kind === 'match'; },
        genLoading() { return this.s.loading.comments === this.postId; },
        roastLoading() { return this.s.loading.roast === this.postId; },
        reportLoading() { return this.s.loading.report === this.postId; },
        hasMore() {
            if (!this.post) return false;
            const presetShown = this.comments.filter((c) => !c.persisted).length;
            return presetShown < Math.min(this.post.commentTotal || 0, 40) && this.post.kind !== 'user' && this.post.kind !== 'ai';
        },
    },
    watch: {
        postId: { handler() { this.page = 0; this.load(); }, immediate: true },
    },
    methods: {
        back() { store.setView(this.boardId ? 'board' : '', this.boardId ? { boardId: this.boardId } : null); },
        stanceOf(c) { return stanceLabel(c.stance); },
        async load() {
            if (!this.post) { this.comments = []; return; }
            this.loadingList = true;
            try {
                const pages = [];
                for (let p = 0; p <= this.page; p += 1) {
                    pages.push(...await store.threadComments(this.post, p));
                }
                // 持久评论只保留一份（threadComments 每页都会带全部持久层）
                const seen = new Set();
                this.comments = pages.filter((c) => {
                    if (seen.has(c.id)) return false;
                    seen.add(c.id);
                    return true;
                });
            } finally {
                this.loadingList = false;
            }
        },
        async more() {
            this.page += 1;
            await this.load();
        },
        async send() {
            if (!this.reply.trim()) return;
            const result = await store.addUserComment({
                postId: this.postId, text: this.reply, identityId: this.replyIdentityId,
            });
            if (result.ok) {
                this.reply = '';
                await this.load();
            }
        },
        async generate() {
            this.error = '';
            const result = await store.generateCommentsFor(this.postId);
            if (!result.ok && result.error) this.error = result.error;
            await this.load();
        },
        async roast() {
            this.error = '';
            const result = await store.generateRankRoast(this.postId);
            if (!result.ok && result.error) this.error = result.error;
            await this.load();
        },
        async report() {
            this.error = '';
            const result = await store.generateMatchReport(this.postId);
            if (!result.ok && result.error) this.error = result.error;
        },
        async removeComment(c) {
            await store.deleteCommentById(c.id);
            await this.load();
        },
        async removePost() {
            await store.deleteUserPost(this.postId);
            this.back();
        },
    },
    template: `
        <div class="ef-overlay">
            <header class="ef-overlay__head">
                <button type="button" class="ef-overlay__back" @click="back"><EfIcon name="back" :size="18" /></button>
                <div class="ef-overlay__title"><b>帖子</b><i v-if="post">{{ post.authorHandle }} · 第{{ post.day }}天</i></div>
                <EfBtn v-if="isMyPost" size="sm" variant="danger" iconName="trash" @click="removePost">删帖</EfBtn>
            </header>
            <div class="ef-overlay__body" v-if="post">
                <article class="ef-thread">
                    <div class="ef-thread__meta">
                        <span class="ef-thread__author">{{ post.authorHandle }}</span>
                        <EfTag tone="plain">{{ stanceOf(post) }}</EfTag>
                    </div>
                    <h3 class="ef-thread__title">{{ post.title }}</h3>
                    <p class="ef-thread__body">{{ body }}</p>
                </article>

                <div class="ef-thread__tools">
                    <EfBtn v-if="canGenerate" size="sm" variant="soft" iconName="comment" :loading="genLoading" @click="generate">生成评论</EfBtn>
                    <EfBtn v-if="isRankWatch" size="sm" variant="soft" iconName="fire" :loading="roastLoading" @click="roast">生成锐评</EfBtn>
                    <EfBtn v-if="isMatch && !post.reportDone" size="sm" variant="soft" iconName="pen" :loading="reportLoading" @click="report">生成赛报</EfBtn>
                    <span class="ef-note">评论可删除，但没有重 roll</span>
                </div>
                <p v-if="error" class="ef-error">{{ error }}</p>

                <div class="ef-comments">
                    <div v-for="c in comments" :key="c.id" class="ef-comment">
                        <div class="ef-comment__meta">
                            <b>{{ c.handle }}</b>
                            <EfTag tone="plain">{{ stanceOf(c) }}</EfTag>
                            <span v-if="c.floor" class="ef-comment__floor">{{ c.floor }} 楼</span>
                            <button v-if="c.persisted && isMyPost" type="button" class="ef-comment__del" @click="removeComment(c)">
                                <EfIcon name="trash" :size="13" />
                            </button>
                        </div>
                        <p class="ef-comment__text">{{ c.text }}</p>
                    </div>
                    <EfBtn v-if="hasMore" size="sm" variant="ghost" block @click="more">更多评论</EfBtn>
                </div>

                <div class="ef-replybox">
                    <select class="ef-input is-mini" v-model="replyIdentityId">
                        <option value="">{{ identities.find(i => i.isMain) ? identities.find(i => i.isMain).name : '主身份' }}</option>
                        <option v-for="i in identities.filter(x => !x.isMain)" :key="i.id" :value="i.id">{{ i.name }}（小号）</option>
                    </select>
                    <input class="ef-input" v-model.trim="reply" placeholder="以马甲身份回一层" maxlength="120" @keyup.enter="send" />
                    <EfBtn size="sm" variant="ink" @click="send">回帖</EfBtn>
                </div>
            </div>
            <div class="ef-overlay__body" v-else>
                <EfEmpty title="帖子飘走了" desc="它可能是昨天的预置楼，已经沉了" />
            </div>
        </div>
    `,
};
