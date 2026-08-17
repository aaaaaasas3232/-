/**
 * 萤火 · 频道 tab
 *
 * 两块：
 *   1. 世界频道 —— 当前世界绑定的 AI。作品**不随刷新变化**，
 *      「让 TA 发视频」才生成新作品（可编辑 / 带意见重 roll）。
 *   2. 认识的人 —— 点开过主页的频道主 / 观众（关注的排前面）。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { fmtCount } from '../services/stats.js';

export const YtChannelsPage = {
    name: 'YtChannelsPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        aiCreators() { return store.listAiCreators(); },
        people() {
            return store.listKnownPeople()
                .slice()
                .sort((a, b) => (b.followed - a.followed) || (b.updatedAt || 0) - (a.updatedAt || 0));
        },
    },
    methods: {
        fans(c) { return fmtCount(c.followers) + ' 粉丝'; },
        isLive(c) { return store.creatorIsLive(c); },
        worksCount(c) {
            return c.kind === 'ai' ? store.listAiUploads(c.creatorId).length : (c.works?.length || 0);
        },
        open(c) { store.openCreator(c.creatorId); },
    },
    template: `
        <div class="yt-page">
            <YtSection title="世界频道" sub="这个世界里的 AI">
                <YtEmpty
                    v-if="!aiCreators.length"
                    icon-name="tower" title="这个世界还没有绑定 AI"
                    desc="去「设置 → 人设」给这个世界绑几个 AI，他们就会在这里开频道。"
                />
                <button
                    v-for="c in aiCreators" :key="c.creatorId"
                    type="button" class="yt-person" @click="open(c)"
                >
                    <YtAvatar :creator="c" :size="42" :live="isLive(c)" />
                    <span class="yt-person__main">
                        <span class="yt-person__name">{{ c.name }}<i v-if="isLive(c)" class="yt-person__livetag">直播中</i></span>
                        <span class="yt-person__sub">{{ fans(c) }} · {{ worksCount(c) }} 个作品</span>
                    </span>
                    <YtIcon name="chevron" :size="16" />
                </button>
            </YtSection>

            <YtSection title="认识的人" sub="看过主页的才算认识">
                <YtEmpty
                    v-if="!people.length"
                    icon-name="users" title="还没认识谁"
                    desc="在视频页点频道主头像、在评论区点观众名字，看过主页就会出现在这里。"
                />
                <button
                    v-for="c in people" :key="c.creatorId"
                    type="button" class="yt-person" @click="open(c)"
                >
                    <YtAvatar :creator="c" :size="42" :live="isLive(c)" />
                    <span class="yt-person__main">
                        <span class="yt-person__name">
                            {{ c.name }}
                            <i v-if="c.followed" class="yt-person__followtag">已关注</i>
                            <i v-if="c.nookPersonId" class="yt-person__friendtag">好友</i>
                        </span>
                        <span class="yt-person__sub">{{ c.kind === 'viewer' ? '观众' : '频道主' }} · {{ fans(c) }}</span>
                    </span>
                    <YtIcon name="chevron" :size="16" />
                </button>
            </YtSection>
        </div>
    `,
};
