/**
 * 萤火 · 我的 tab
 *
 * 我的频道卡（昵称 / 粉丝 / 数据总览）+ 我的视频（发布 / 编辑 / 删除）
 * + 设置组（图库 / 配色 / 提示词 / 重新配置）。
 *
 * 发视频不调 AI：播放 / 点赞 / 评论总数由 JS 按粉丝数种子算（stats.js），
 * 观众评论的**正文**才是按批生成的（在视频详情页里点）。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { fmtCount } from '../services/stats.js';

export const YtMePage = {
    name: 'YtMePage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        channel() { return store.userChannel(); },
        uploads() { return this.s.uploads.filter((u) => u.ownerType === 'user'); },
        totals() {
            let views = 0; let likes = 0;
            for (const u of this.uploads) {
                views += u.stats?.views || 0;
                likes += u.stats?.likes || 0;
            }
            return { views, likes };
        },
        galleryLabel() {
            const p = this.s.profile;
            return p?.galleryGroupId ? (p.galleryGroupName || '已绑定图组') : '未绑定';
        },
        userAvatar() { return this.s.identity.userAvatar; },
    },
    methods: {
        fmt(n) { return fmtCount(n); },
        publish() { store.openModal('upload-editor', { mode: 'publish' }); },
        editChannel() { store.openModal('channel-editor', {}); },
        openUpload(u) { store.openUpload(u); },
        openGallery() { store.openModal('gallery-picker', {}); },
        openTheme() { store.setView('theme'); },
        openPrompts() { store.setView('prompts'); },
        reconfigure() {
            store.openModal('confirm', {
                title: '重新走一遍首次配置？',
                message: '已有的视频、收藏、聊天都会保留，只是重新选材料和频道设置。',
                okLabel: '重新配置',
                onOk: () => store.reopenOnboarding(),
            });
        },
    },
    template: `
        <div class="yt-page">
            <section class="yt-mecard">
                <YtAvatar :name="channel.nickname" :url="userAvatar" :size="52" />
                <div class="yt-mecard__main">
                    <b class="yt-mecard__name">{{ channel.nickname }}</b>
                    <span class="yt-mecard__sub">{{ fmt(channel.followers) }} 粉丝{{ channel.bio ? ' · ' + channel.bio : '' }}</span>
                </div>
                <YtButton size="sm" variant="soft" icon-name="pen" @click="editChannel">编辑</YtButton>
            </section>

            <div class="yt-mestats">
                <div class="yt-mestats__item"><b>{{ uploads.length }}</b><span>视频</span></div>
                <div class="yt-mestats__item"><b>{{ fmt(totals.views) }}</b><span>总播放</span></div>
                <div class="yt-mestats__item"><b>{{ fmt(totals.likes) }}</b><span>总点赞</span></div>
            </div>

            <YtSection title="我的视频" :sub="uploads.length ? uploads.length + ' 条' : ''">
                <template #action>
                    <YtButton size="sm" variant="primary" icon-name="plus" @click="publish">发视频</YtButton>
                </template>
                <YtEmpty
                    v-if="!uploads.length"
                    icon-name="play" title="还没发过视频"
                    desc="发一条试试。观众会不会来评论，取决于你的粉丝规模。"
                />
                <YtVideoCard
                    v-for="u in uploads" :key="u.id"
                    :video="u" :show-author="false" dense
                    @open="openUpload"
                />
            </YtSection>

            <YtSection title="设置">
                <button type="button" class="yt-row" @click="openGallery">
                    <YtIcon name="image" :size="18" />
                    <span class="yt-row__label">头像图库</span>
                    <span class="yt-row__value">{{ galleryLabel }}</span>
                    <YtIcon name="chevron" :size="15" />
                </button>
                <button type="button" class="yt-row" @click="openTheme">
                    <YtIcon name="palette" :size="18" />
                    <span class="yt-row__label">界面配色</span>
                    <YtIcon name="chevron" :size="15" />
                </button>
                <button type="button" class="yt-row" @click="openPrompts">
                    <YtIcon name="doc" :size="18" />
                    <span class="yt-row__label">提示词与生成</span>
                    <YtIcon name="chevron" :size="15" />
                </button>
                <button type="button" class="yt-row" @click="reconfigure">
                    <YtIcon name="sliders" :size="18" />
                    <span class="yt-row__label">重新首次配置</span>
                    <YtIcon name="chevron" :size="15" />
                </button>
            </YtSection>
        </div>
    `,
};
