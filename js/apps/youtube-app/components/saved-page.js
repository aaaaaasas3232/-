/**
 * 萤火 · 收藏 tab
 *
 * 外部视频的收藏 + 收藏的作品（自己 / AI 的）合在一起。
 * 刷新列表不影响这里 —— 收藏都活在 videos / uploads 表里。
 */

import * as store from '../store.js';
import { UI } from './ui.js';

export const YtSavedPage = {
    name: 'YtSavedPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        favorites() { return store.listFavorites(); },
    },
    methods: {
        open(v) {
            if (v.ownerType) store.openUpload(v);
            else store.openVideo(v);
        },
        openCreator(id) { store.openCreator(id); },
    },
    template: `
        <div class="yt-page">
            <YtEmpty
                v-if="!favorites.length"
                icon-name="star" title="还没收藏过视频"
                desc="视频详情页里点星标就收进这里，换多少批列表都不会丢。"
            />
            <YtVideoCard
                v-for="v in favorites" :key="v.id"
                :video="v" dense
                @open="open"
                @open-creator="openCreator"
            />
        </div>
    `,
};
