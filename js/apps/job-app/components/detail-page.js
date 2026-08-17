/**
 * 灯塔 · 职位详情
 *
 * 用户在这里看完，然后决定要不要去聊。
 *
 * ★ 「跟他聊聊」这个按钮是 HR 人设的**唯一**生成入口 ——
 *   需求原话「hr 的人设是在用户进入求职详情页看完以后、
 *   确认跟 hr 聊天的时候才生成的」。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { JOB_TYPES, MAX_JOBS, PAY_MODES } from '../constants.js';

const TYPE_LABEL = Object.fromEntries(JOB_TYPES.map((t) => [t.id, t.label]));
const PAY_LABEL = Object.fromEntries(PAY_MODES.map((p) => [p.id, p.label]));

export const JbDetailPanel = {
    name: 'JbDetailPanel',
    components: { ...UI },
    emits: ['close'],
    computed: {
        s() { return store.getState(); },
        job() { return this.s.detailJob; },
        d() { return this.job?.detail || null; },
        currency() { return this.s.identity.currency; },
        loading() { return this.s.loading.detail; },
        hiring() { return this.s.loading.recruiter; },
        isSpecial() { return Boolean(this.job?.track); },
        typeLabel() { return TYPE_LABEL[this.job?.jobType] || ''; },
        payLabel() { return PAY_LABEL[this.job?.payMode] || ''; },
        full() { return this.s.posts.length >= MAX_JOBS; },
        maxJobs() { return MAX_JOBS; },
        /** 已经在跟这家聊了吗 */
        talk() {
            const id = this.job?.id;
            if (!id) return null;
            return this.s.recruiters.find(
                (r) => String(r.jobId) === String(id) && r.status !== 'closed',
            ) || null;
        },
        talkLabel() {
            if (!this.talk) return this.isSpecial ? '去见星探' : '跟他聊聊';
            if (this.talk.status === 'hired') return '已经入职了';
            if (this.talk.status === 'rejected') return '这家拒了你';
            return '继续聊';
        },
    },
    methods: {
        close() { store.closeJob(); },
        save() { store.toggleSave(this.job); },
        reroll() { store.rerollDetail(); },
        clearError() { store.clearError(); },
        async talkTo() {
            if (!this.job) return;
            if (this.talk?.status === 'hired') {
                store.setTab('work');
                return;
            }
            if (this.talk?.status === 'rejected') {
                store.showToast('这家已经拒过你了。去招聘板换一批看看');
                return;
            }
            await store.startTalk(this.job);
        },
    },
    template: `
        <jb-panel :title="job ? job.title : '职位'" @close="close">
            <template #bar>
                <jb-btn size="sm" variant="ghost" :icon="job && job.favorited ? 'check' : 'bookmark'" @click="save">
                    {{ job && job.favorited ? '已收藏' : '收藏' }}
                </jb-btn>
            </template>

            <jb-error :text="s.error" @close="clearError" />

            <template v-if="job">
                <!-- 抬头 -->
                <section class="jb-detail__hero jb-card jb-card--pad">
                    <div class="jb-detail__hero-top">
                        <h1 class="jb-detail__title">{{ job.title }}</h1>
                        <span v-if="isSpecial" class="jb-tag jb-tag--accent">星探在找人</span>
                    </div>
                    <p class="jb-detail__meta">
                        <span v-if="job.employer">{{ job.employer }}</span>
                        <span v-if="job.area">{{ job.area }}</span>
                        <span v-if="typeLabel">{{ typeLabel }}</span>
                        <span v-if="payLabel">{{ payLabel }}</span>
                    </p>
                    <p class="jb-detail__pay">
                        {{ job.payText || (job.payAmount + ' ' + currency) }}
                    </p>
                    <p class="jb-detail__blurb">{{ job.blurb }}</p>
                    <p v-if="job.ask" class="jb-detail__ask">要求：{{ job.ask }}</p>
                    <div v-if="job.tags && job.tags.length" class="jb-chips jb-detail__tags">
                        <span v-for="t in job.tags" :key="t" class="jb-tag">{{ t }}</span>
                    </div>
                </section>

                <!-- 详情正文 -->
                <jb-loading v-if="loading" kind="detail" />

                <template v-else-if="d">
                    <jb-section title="这活是干什么的">
                        <div class="jb-card jb-card--pad jb-prose">
                            <p v-for="(p, i) in d.desc.split('\\n')" :key="i">{{ p }}</p>
                        </div>
                    </jb-section>

                    <jb-section v-if="d.duties.length" title="每天要做的">
                        <ul class="jb-detail__ul jb-card jb-card--pad">
                            <li v-for="(x, i) in d.duties" :key="i">{{ x }}</li>
                        </ul>
                    </jb-section>

                    <jb-section v-if="d.requires.length" title="他们要什么样的人">
                        <ul class="jb-detail__ul jb-card jb-card--pad">
                            <li v-for="(x, i) in d.requires" :key="i">{{ x }}</li>
                        </ul>
                    </jb-section>

                    <jb-section title="待遇与安排">
                        <div class="jb-card jb-card--pad">
                            <jb-kv label="结算" :value="job.payText || payLabel" strong />
                            <jb-kv v-if="d.workTime" label="上班时间" :value="d.workTime" />
                            <jb-kv
                                v-for="(x, i) in d.perks" :key="i"
                                label="另外" :value="x"
                            />
                        </div>
                    </jb-section>

                    <jb-section v-if="d.employerInfo" :title="job.employer || '用人单位'">
                        <div class="jb-card jb-card--pad jb-prose">
                            <p>{{ d.employerInfo }}</p>
                        </div>
                    </jb-section>

                    <jb-section v-if="d.process.length" title="怎么招">
                        <ol class="jb-detail__steps jb-card jb-card--pad">
                            <li v-for="(x, i) in d.process" :key="i">{{ x }}</li>
                        </ol>
                    </jb-section>

                    <jb-section v-if="d.voices.length" title="听人说">
                        <div class="jb-detail__voices">
                            <div v-for="(v, i) in d.voices" :key="i" class="jb-card jb-card--pad jb-voice">
                                <p class="jb-voice__who">{{ v.who }}<i v-if="v.role">{{ v.role }}</i></p>
                                <p class="jb-voice__text">{{ v.text }}</p>
                            </div>
                        </div>
                    </jb-section>

                    <div class="jb-detail__reroll">
                        <jb-btn size="sm" variant="ghost" icon="dice" @click="reroll">
                            这份详情不满意，重写一次
                        </jb-btn>
                    </div>
                </template>

                <jb-empty
                    v-else
                    icon="doc"
                    title="详情没拉下来"
                    desc="多半是 API 那边的问题。点一下重试。"
                >
                    <jb-btn variant="line" icon="refresh" @click="reroll">重试</jb-btn>
                </jb-empty>
            </template>

            <!-- 底部行动条 -->
            <div v-if="job" class="jb-detail__cta">
                <p v-if="full && !talk" class="jb-detail__cta-note">
                    你已经有 {{ maxJobs }} 份工作了，接不了新的。可以先聊着，但对方点头时会被拦下来。
                </p>
                <jb-btn
                    variant="primary" size="lg" block
                    :loading="hiring"
                    :disabled="talk && talk.status === 'rejected'"
                    @click="talkTo"
                >{{ talkLabel }}</jb-btn>
                <p v-if="!talk" class="jb-detail__cta-note">
                    点下去才会有人来接待你 —— 那个人是现造的，造好之后就一直是他。
                </p>
            </div>
        </jb-panel>
    `,
};
