/**
 * 灯塔 · 招聘板
 *
 * ── 「换一批」是有代价的操作 ──────────────────────────────────────
 *
 * 刷新会把没收藏的整批冲掉。这句说明必须**单独一行**放在按钮下面 ——
 * 和按钮并排的话它只剩半屏宽，折成两行还被挤扁，
 * 而它是这个操作唯一的预告，挤没了等于没写。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { JbJobCard } from './job-card.js';
import { JOB_CATEGORIES, MAX_JOBS } from '../constants.js';

export const JbFeedPage = {
    name: 'JbFeedPage',
    components: { ...UI, JbJobCard },
    computed: {
        s() { return store.getState(); },
        currency() { return this.s.identity.currency; },
        list() { return store.visibleFeed(); },
        cats() { return JOB_CATEGORIES; },
        loading() { return this.s.loading.feed; },
        full() { return this.s.posts.length >= MAX_JOBS; },
        maxJobs() { return MAX_JOBS; },
    },
    methods: {
        pickCat(c) {
            store.setFeedCategory(c);
        },
        refresh() { store.generateFeed(); },
        open(job) { store.openJob(job); },
        save(job) { store.toggleSave(job); },
        clearError() { store.clearError(); },
    },
    template: `
        <div class="jb-feed">
            <jb-error :text="s.error" @close="clearError" />

            <div v-if="full" class="jb-feed__banner">
                你已经有 {{ maxJobs }} 份工作了。还能看，但接不了新的 —— 去「在职」辞掉一份再来。
            </div>

            <div class="jb-chips jb-chips--scroll jb-feed__cats">
                <jb-chip
                    v-for="c in cats" :key="c"
                    :active="s.feedCategory === c"
                    @click="pickCat(c)"
                >{{ c }}</jb-chip>
            </div>

            <jb-loading v-if="loading && !list.length" kind="feed" />

            <template v-else>
                <jb-empty
                    v-if="!list.length"
                    icon="compass"
                    title="招聘板是空的"
                    desc="点下面那个按钮，看看这个世界现在缺什么人。"
                >
                    <jb-btn variant="primary" icon="refresh" :loading="loading" @click="refresh">
                        挂一批出来
                    </jb-btn>
                </jb-empty>

                <div v-else class="jb-feed__list">
                    <jb-job-card
                        v-for="j in list" :key="j.id"
                        :job="j" :currency="currency"
                        @open="open" @save="save"
                    />
                </div>
            </template>

            <div v-if="list.length" class="jb-feed__more">
                <jb-btn variant="line" icon="refresh" block :loading="loading" @click="refresh">
                    换一批
                </jb-btn>
                <p class="jb-feed__more-note">
                    换一批会把上面没收藏的全部换掉。收藏过的在「我的 → 收藏」里，不受影响。
                </p>
            </div>
        </div>
    `,
};

/** 收藏页 —— 和招聘板同一张卡，只是数据源不同 */
export const JbSavedPanel = {
    name: 'JbSavedPanel',
    components: { ...UI, JbJobCard },
    emits: ['close'],
    computed: {
        s() { return store.getState(); },
        currency() { return this.s.identity.currency; },
        list() { return this.s.saved; },
    },
    methods: {
        open(job) { store.openJob(job); },
        save(job) { store.toggleSave(job); },
    },
    template: `
        <jb-panel title="收藏的职位" @close="$emit('close')">
            <jb-empty
                v-if="!list.length"
                icon="bookmark"
                title="还没收藏过"
                desc="在招聘板上点右边那个书签，那一条就不会被「换一批」冲掉。"
            />
            <div v-else class="jb-feed__list">
                <jb-job-card
                    v-for="j in list" :key="j.id"
                    :job="j" :currency="currency"
                    @open="open" @save="save"
                />
            </div>
        </jb-panel>
    `,
};
