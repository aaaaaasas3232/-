/**
 * 氧气 · 广场（标签优先的信息流）
 *
 * 卡片只显示：发帖人、标签、类型徽标、相对时间、热度。
 * ★ 不显示标题、正文、摘要 —— 「先看见的是人打的标签，不是内容」。
 * 右下角黑色悬浮圆钮 = 发帖（Q 弹按压）。
 */

import * as store from '../store.js';
import { UI } from './ui.js';

export const OxFeedPage = {
    name: 'OxFeedPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        feed() { return this.s.feed; },
        loading() { return this.s.loading.feed; },
        lowHint() { return store.oxygenLowHint(); },
        myRecent() {
            return store.listUserPosts().slice(0, 3);
        },
    },
    methods: {
        refresh() { void store.generateFeed(); },
        open(stub) { void store.openPost(stub); },
        openOwn(post) { void store.openOwnPost(post.id); },
        openAuthor(authorId) { void store.openAuthor(authorId, '因为 TA 的帖子认识的'); },
        compose() { store.openModal('composer', {}); },
        clearError() { store.clearError(); },
    },
    template: `
        <div class="ox-page ox-feedpage">
            <p v-if="lowHint" class="ox-lowhint">呼吸有点浅了</p>

            <div v-if="s.error" class="ox-errorbar">
                <span>{{ s.error }}</span>
                <button type="button" class="ox-errorbar__x" @click="clearError">好</button>
            </div>

            <OxLoading v-if="loading" :lines="['在听大家说什么', '标签正在长出来', '快好了']" />

            <template v-else>
                <OxEmpty
                    v-if="!feed.length"
                    icon-name="square"
                    title="广场还没长出内容"
                    desc="拉取一批标签级列表 —— 只有标签，正文点开才有。"
                >
                    <OxButton variant="ink" icon-name="refresh" @click="refresh">看看大家在说什么</OxButton>
                </OxEmpty>

                <template v-else>
                    <div v-if="myRecent.length" class="ox-feed-mine">
                        <p class="ox-feed-mine__label">你最近的呼吸</p>
                        <button
                            v-for="p in myRecent" :key="p.id" type="button"
                            class="ox-feed-mine__item" @click="openOwn(p)"
                        >
                            <span v-for="t in p.tags" :key="t" class="ox-tag">{{ t }}</span>
                        </button>
                    </div>

                    <div class="ox-feed-list">
                        <OxStubCard
                            v-for="stub in feed" :key="stub.id"
                            :stub="stub"
                            @open="open"
                            @open-author="openAuthor"
                        />
                    </div>

                    <div class="ox-feed-foot">
                        <OxButton icon-name="refresh" :loading="loading" @click="refresh">换一批</OxButton>
                        <p class="ox-muted">刷新不会弄丢收藏和你自己的帖子</p>
                    </div>
                </template>
            </template>

            <button type="button" class="ox-fab" aria-label="发帖" @click="compose">
                <OxIcon name="plus" :size="22" />
            </button>
        </div>
    `,
};
