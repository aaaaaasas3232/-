/**
 * 萤火 · 站内用户主页（频道主 / 观众 / 世界 AI 共用）
 *
 * 打开时才生成主页（不点不生成）。
 * 世界 AI 的频道：作品 = uploads 里 ownerType 'ai' 的记录，普通刷新永远不动；
 * 「让 TA 发视频」才生成新作品。
 * 直播间入口永远可进：不在播是静态房间，在播才有生成一场的按钮。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { fmtCount } from '../services/stats.js';
import { PERSON_KIND } from '../constants.js';

export const YtCreatorPage = {
    name: 'YtCreatorPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        creator() { return store.activeCreator(); },
        isAi() { return this.creator?.kind === PERSON_KIND.ai; },
        isViewer() { return this.creator?.kind === PERSON_KIND.viewer; },
        live() { return this.creator ? store.creatorIsLive(this.creator) : false; },
        loading() { return this.s.loading.person === this.creator?.creatorId; },
        aiVideoLoading() { return this.s.loading.aiVideo === this.creator?.creatorId; },
        aiUploads() { return this.isAi ? store.listAiUploads(this.creator.creatorId) : []; },
        works() { return this.creator?.works || []; },
        canChat() { return store.canChatWith(this.creator); },
        error() { return this.s.error; },
        friendLoading() { return this.s.loading.friend === this.creator?.creatorId; },
    },
    methods: {
        back() { store.closeCreator(); },
        fans(n) { return fmtCount(n); },
        follow() { store.toggleFollow(this.creator.creatorId); },
        chat() { store.openChat(this.creator.creatorId); },
        enterLive() { store.openLive(this.creator.creatorId); },
        retry() { store.generatePersonProfile(this.creator, { force: true }); },
        openWork(work) { store.openCreatorWork(this.creator, work); },
        openUpload(u) { store.openUpload(u); },
        askNewVideo() {
            store.openModal('confirm', {
                title: `让 ${this.creator.name} 发一条视频？`,
                message: '会按 TA 的人设生成一条新作品（一次 AI 调用）。生成后可以编辑、收藏、带意见重 roll。',
                okLabel: '让 TA 发',
                onOk: () => store.generateAiVideo(this.creator.creatorId, {}),
            });
        },
        addFriend() {
            store.openModal('confirm', {
                title: `把 ${this.creator.name} 加进角色库？`,
                message: '会在 nook 建一张 AI 人设卡，自动绑定当前世界观，简介里写清你们是怎么认识的。之后在 murmur 也能和 TA 聊。',
                okLabel: '加为好友',
                onOk: () => store.addFriend(this.creator.creatorId),
            });
        },
        clearError() { store.clearError(); },
    },
    template: `
        <div class="yt-page yt-creator" v-if="creator">
            <div class="yt-subtop">
                <button type="button" class="yt-subtop__back" aria-label="返回" @click="back"><YtIcon name="back" :size="18" /></button>
                <span class="yt-subtop__title">{{ isViewer ? '观众主页' : '频道' }}</span>
            </div>

            <section class="yt-creator__hero">
                <YtAvatar :creator="creator" :size="64" :live="live" />
                <div class="yt-creator__head">
                    <b class="yt-creator__name">{{ creator.name }}</b>
                    <span class="yt-creator__stats">
                        {{ fans(creator.followers) }} 粉丝 · 关注 {{ fans(creator.following) }}
                        <template v-if="isAi"> · 本世界 AI</template>
                    </span>
                    <div class="yt-creator__badges">
                        <i v-if="creator.followed" class="yt-person__followtag">已关注</i>
                        <i v-if="creator.nookPersonId" class="yt-person__friendtag">已在角色库</i>
                    </div>
                </div>
            </section>

            <div class="yt-creator__actions">
                <YtButton size="sm" :variant="creator.followed ? 'line' : 'primary'" icon-name="star" @click="follow">
                    {{ creator.followed ? '已关注' : '关注' }}
                </YtButton>
                <YtButton size="sm" variant="soft" icon-name="live" @click="enterLive">
                    {{ live ? '直播中，进去看' : '直播间' }}
                </YtButton>
                <YtButton v-if="canChat" size="sm" variant="soft" icon-name="comment" @click="chat">发起闲聊</YtButton>
                <YtButton
                    v-if="!isAi && creator.profileGenerated && !creator.nookPersonId"
                    size="sm" variant="ghost" icon-name="friend" :loading="friendLoading" @click="addFriend"
                >加为好友</YtButton>
            </div>

            <div v-if="error" class="yt-error">
                <p>{{ error }}</p>
                <div class="yt-error__actions">
                    <YtButton v-if="!creator.profileGenerated" size="sm" variant="soft" @click="retry">重试生成</YtButton>
                    <YtButton size="sm" variant="ghost" @click="clearError">知道了</YtButton>
                </div>
            </div>

            <YtLoading v-if="loading" :lines="['在翻 TA 的主页', '在看置顶和简介', '快好了']" />

            <template v-else>
                <YtSection v-if="creator.bio" title="简介">
                    <p class="yt-creator__bio">{{ creator.bio }}</p>
                </YtSection>

                <!-- 世界 AI：固定作品（不随刷新变化）+ 让 TA 发视频 -->
                <YtSection v-if="isAi" title="作品" :sub="aiUploads.length ? aiUploads.length + ' 条 · 不会被刷新冲掉' : ''">
                    <template #action>
                        <YtButton size="sm" variant="primary" icon-name="plus" :loading="aiVideoLoading" @click="askNewVideo">让 TA 发视频</YtButton>
                    </template>
                    <YtLoading v-if="aiVideoLoading" :lines="['TA 在拍了', 'TA 在剪了', '快发出来了']" />
                    <YtEmpty
                        v-else-if="!aiUploads.length"
                        icon-name="play" title="TA 还没发过视频"
                        desc="点右上角让 TA 发一条 —— 内容会贴着 TA 的人设来。"
                    />
                    <YtVideoCard
                        v-for="u in aiUploads" :key="u.id"
                        :video="u" :show-author="false" dense
                        @open="openUpload"
                    />
                </YtSection>

                <!-- 外部频道主 / 观众：代表作 -->
                <YtSection v-else-if="works.length" title="代表作" sub="点开会生成完整内容">
                    <button
                        v-for="w in works" :key="w.id"
                        type="button" class="yt-work" @click="openWork(w)"
                    >
                        <YtCover :text="w.coverText" :hue="w.coverHue" :duration="w.durationLabel" small />
                        <span class="yt-work__main">
                            <b>{{ w.title }}</b>
                            <span>{{ fans(w.views) }} 次观看</span>
                        </span>
                        <YtIcon name="chevron" :size="15" />
                    </button>
                </YtSection>

                <YtEmpty
                    v-else-if="creator.profileGenerated && isViewer"
                    icon-name="user" title="一个安静的观众"
                    desc="TA 没发过什么作品，但可以聊聊。"
                />
            </template>
        </div>
    `,
};
