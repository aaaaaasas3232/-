/**
 * 萤火 · 消息 tab（站内闲聊 + 私信收件箱）
 *
 * 闲聊：只有看过主页的人才能开聊（入口在对方主页）；这里是会话列表。
 * 私信：默认不生成内容，点「收一批私信」才调一次 AI；
 *       演员 / 爱豆 / 电竞等 provider 上线后，私信风向会跟着用户的经历变。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { fmtTime, truncate } from '../utils.js';

export const YtInboxPage = {
    name: 'YtInboxPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        seg() { return this.s.inboxSeg; },
        sessions() { return this.s.chatSessions; },
        dms() { return this.s.dms; },
        dmLoading() { return this.s.loading.dms; },
        providers() { return store.listProviders(); },
    },
    methods: {
        pickSeg(seg) { store.setInboxSeg(seg); },
        peerOf(session) { return store.getCreatorById(session.peerId); },
        openChat(session) { store.openChat(session.peerId); },
        preview(text) { return truncate(text, 30); },
        timeOf(ts) { return fmtTime(ts); },
        generateDms() { store.generateDms(); },
        deleteDm(dm) {
            store.openModal('confirm', {
                title: '删除这封私信？',
                message: `来自「${dm.fromName}」的私信会被删除，不可恢复。`,
                okLabel: '删除',
                danger: true,
                onOk: () => store.deleteDm(dm.id),
            });
        },
        openPrompts() { store.setView('prompts'); },
    },
    template: `
        <div class="yt-page">
            <div class="yt-seg">
                <button type="button" class="yt-seg__item" :class="{ 'is-on': seg === 'chats' }" @click="pickSeg('chats')">站内闲聊</button>
                <button type="button" class="yt-seg__item" :class="{ 'is-on': seg === 'dms' }" @click="pickSeg('dms')">私信<YtCap v-if="dms.length" :value="dms.length" /></button>
            </div>

            <!-- 闲聊会话列表 -->
            <template v-if="seg === 'chats'">
                <YtEmpty
                    v-if="!sessions.length"
                    icon-name="comment" title="还没有聊过天"
                    desc="打开某个人的主页，点「发起闲聊」。聊得投缘还可以把 TA 加进 nook 角色库。"
                />
                <button
                    v-for="ss in sessions" :key="ss.peerId"
                    type="button" class="yt-person"
                    @click="openChat(ss)"
                >
                    <YtAvatar :creator="peerOf(ss)" :size="42" />
                    <span class="yt-person__main">
                        <span class="yt-person__name">
                            {{ peerOf(ss) ? peerOf(ss).name : '未知用户' }}
                            <i v-if="peerOf(ss) && peerOf(ss).nookPersonId" class="yt-person__friendtag">好友</i>
                        </span>
                        <span class="yt-person__sub">{{ preview(ss.lastText) }}</span>
                    </span>
                    <span class="yt-person__time">{{ timeOf(ss.lastAt) }}</span>
                </button>
            </template>

            <!-- 私信收件箱 -->
            <template v-else>
                <div class="yt-dmbar">
                    <p class="yt-dmbar__hint">私信按你的频道处境生成。以后你在别的软件里的经历（演艺、赛场……）也会改变这里的风向。</p>
                    <div class="yt-dmbar__actions">
                        <YtButton size="sm" variant="primary" icon-name="mail" :loading="dmLoading" @click="generateDms">收一批私信</YtButton>
                        <YtButton size="sm" variant="ghost" icon-name="doc" @click="openPrompts">提示词与来源</YtButton>
                    </div>
                    <p v-if="providers.length" class="yt-dmbar__providers">已接入的经历来源：{{ providers.map(p => p.label).join('、') }}</p>
                </div>

                <YtLoading v-if="dmLoading" :lines="['邮差在路上', '在整理来信', '快好了']" />

                <YtEmpty
                    v-else-if="!dms.length"
                    icon-name="mail" title="收件箱是空的"
                    desc="点上面的按钮收一批。粉丝多的时候，来信会热闹很多。"
                />
                <article v-for="dm in dms" :key="dm.id" class="yt-dm">
                    <YtAvatar :name="dm.fromName" :size="36" />
                    <div class="yt-dm__body">
                        <div class="yt-dm__head">
                            <b>{{ dm.fromName }}</b>
                            <span v-if="dm.fromKind" class="yt-tag">{{ dm.fromKind }}</span>
                            <span v-if="dm.tone" class="yt-dm__tone">{{ dm.tone }}</span>
                        </div>
                        <p class="yt-dm__text">{{ dm.text }}</p>
                        <span class="yt-dm__time">{{ timeOf(dm.createdAt) }}</span>
                    </div>
                    <button type="button" class="yt-dm__del" aria-label="删除私信" @click="deleteDm(dm)">
                        <YtIcon name="trash" :size="15" />
                    </button>
                </article>
            </template>
        </div>
    `,
};
