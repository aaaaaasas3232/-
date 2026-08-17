/**
 * 萤火 · 首页（视频列表）
 *
 * 列表只在首配后生成过一次；之后只有用户点「换一批」才再调 AI。
 * 收藏 / 已展开详情的视频存在 videos 表里，刷新带不走。
 */

import * as store from '../store.js';
import { UI } from './ui.js';

export const YtHomePage = {
    name: 'YtHomePage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        feed() { return this.s.feed; },
        loading() { return this.s.loading.feed; },
        error() { return this.s.error; },
    },
    methods: {
        refresh() {
            store.openModal('confirm', {
                title: '换一批视频？',
                message: '会重新按世界观生成一批列表（一次 AI 调用）。收藏过和看过详情的视频不会丢。',
                okLabel: '换一批',
                onOk: () => store.generateFeed(),
            });
        },
        generate() { store.generateFeed(); },
        open(video) { store.openVideo(video); },
        openCreator(id) { store.openCreator(id); },
        clearError() { store.clearError(); },
    },
    template: `
        <div class="yt-page">
            <div v-if="error" class="yt-error">
                <p>{{ error }}</p>
                <YtButton size="sm" variant="ghost" @click="clearError">知道了</YtButton>
            </div>

            <YtLoading v-if="loading" />

            <template v-else-if="feed.length">
                <div class="yt-feedbar">
                    <span class="yt-feedbar__hint">第 {{ s.feedBatch }} 批 · {{ feed.length }} 条</span>
                    <YtButton size="sm" variant="soft" icon-name="refresh" @click="refresh">换一批</YtButton>
                </div>
                <YtVideoCard
                    v-for="v in feed" :key="v.id"
                    :video="v"
                    @open="open"
                    @open-creator="openCreator"
                />
            </template>

            <YtEmpty
                v-else
                title="还没有视频"
                desc="点下面的按钮，按你的世界观生成第一批。"
            >
                <YtButton variant="primary" icon-name="refresh" :loading="loading" @click="generate">生成一批视频</YtButton>
            </YtEmpty>
        </div>
    `,
};
