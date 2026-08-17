/**
 * 追光 · 剧组页（项目列表 + 新建）与项目详情覆盖页
 *
 * 剧本两个来源：梦境编织改编（跨 App 只读桥）/ AI 按数值生成。
 * 试镜与每场戏都是 JS 掷定（seed 存盘），**没有重 roll**；AI 只负责演绎。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { PROJECT_TYPES, ROLE_LEVELS } from '../constants.js';
import { fmtMoney, fmtPercent } from '../utils.js';

const STATUS_LABEL = {
    draft: '待试镜', cast: '已定角', shooting: '拍摄中', wrapped: '已杀青', aired: '已上映',
};

export const AcWorkPage = {
    name: 'AcWorkPage',
    components: { ...UI },
    data() {
        return {
            creating: false,
            sourceKind: 'ai',
            books: [],
            booksLoading: false,
            pickedBookId: '',
            opinion: '',
        };
    },
    computed: {
        s() { return store.getState(); },
        projects() { return this.s.projects; },
        statusLabel() { return STATUS_LABEL; },
    },
    methods: {
        typeLabel(id) { return PROJECT_TYPES.find((t) => t.id === id)?.label || '剧'; },
        openProject(p) { store.setView('project', { projectId: p.id }); },
        async startCreate() {
            this.creating = true;
            this.booksLoading = true;
            this.books = await store.listDreamBooksForPick();
            this.booksLoading = false;
            if (!this.books.length) this.sourceKind = 'ai';
        },
        async generate() {
            const result = await store.generateScript({
                sourceKind: this.sourceKind,
                bookId: this.sourceKind === 'dream' ? this.pickedBookId : '',
                opinion: this.opinion,
            });
            if (result.ok) {
                this.creating = false;
                this.opinion = '';
                store.setView('project', { projectId: result.projectId });
            } else if (result.error) {
                store.showToast(result.error);
            }
        },
    },
    template: `
        <div class="zg-page">
            <AcSection title="剧本与项目" sub="数值不同，接到的角色也不同">
                <template #action>
                    <AcBtn size="sm" variant="ink" iconName="plus" @click="startCreate">找剧本</AcBtn>
                </template>
                <AcEmpty v-if="!projects.length" iconName="scroll" title="手里还没有剧本"
                    desc="从梦境编织改编一部，或者让行业按你的数值递本子来" />
                <div v-for="p in projects" :key="p.id" class="zg-projcard" @click="openProject(p)">
                    <div class="zg-projcard__head">
                        <b>《{{ p.title }}》</b>
                        <AcTag :tone="p.status === 'aired' ? 'success' : p.status === 'shooting' ? 'warn' : 'plain'">
                            {{ statusLabel[p.status] || p.status }}
                        </AcTag>
                    </div>
                    <p class="zg-projcard__syn">{{ p.synopsis }}</p>
                    <div class="zg-projcard__meta">
                        <span>{{ typeLabel(p.type) }}</span>
                        <span v-if="p.roleName">饰 {{ p.roleName }}</span>
                        <span v-if="p.source">改编自《{{ p.source.title }}》</span>
                        <span v-if="p.status === 'shooting'">{{ p.scenes.filter(s => s.done).length }}/{{ p.scenes.length }} 场</span>
                        <span v-if="p.airing">热度 {{ p.airing.heat }}</span>
                    </div>
                </div>
            </AcSection>

            <!-- 新建剧本弹层 -->
            <AcModalShell v-if="creating" title="找剧本" @close="creating = false">
                <div class="zg-seg">
                    <button type="button" class="zg-seg__item" :class="{ 'is-on': sourceKind === 'ai' }"
                        @click="sourceKind = 'ai'">行业递本子（AI 生成）</button>
                    <button type="button" class="zg-seg__item" :class="{ 'is-on': sourceKind === 'dream' }"
                        @click="sourceKind = 'dream'">从梦境编织改编</button>
                </div>
                <div v-if="sourceKind === 'dream'">
                    <AcLoading v-if="booksLoading" :lines="['去书架上看看']" />
                    <AcEmpty v-else-if="!books.length" iconName="book" title="梦境编织里还没有作品" desc="先去写一本，或者换成 AI 生成" />
                    <div v-else class="zg-booklist">
                        <button v-for="b in books" :key="b.id" type="button"
                            class="zg-bookrow" :class="{ 'is-on': pickedBookId === b.id }"
                            @click="pickedBookId = b.id">
                            <b>《{{ b.title }}》</b>
                            <span>{{ b.author || '佚名' }}</span>
                        </button>
                    </div>
                </div>
                <AcField label="想演什么样的（可空）">
                    <textarea class="zg-input zg-input--area" v-model.trim="opinion" rows="2"
                        placeholder="如：想要一个反差感强的反派"></textarea>
                </AcField>
                <template #actions>
                    <AcBtn variant="ghost" @click="creating = false">取消</AcBtn>
                    <AcBtn variant="ink" :loading="s.loading.script"
                        :disabled="sourceKind === 'dream' && !pickedBookId"
                        @click="generate">生成剧本</AcBtn>
                </template>
            </AcModalShell>
        </div>
    `,
};

export const AcProjectPage = {
    name: 'AcProjectPage',
    components: { ...UI },
    data() {
        return { pickedRole: '', sceneOpinion: '', expandedScene: -1 };
    },
    computed: {
        s() { return store.getState(); },
        project() {
            const id = this.s.viewPayload?.projectId;
            return this.s.projects.find((p) => p.id === id) || null;
        },
        roles() {
            return store.reachableRoleLevels();
        },
        statusLabel() { return STATUS_LABEL; },
        pay() {
            return this.project && this.s.save
                ? fmtMoney(this.project.payment?.amount || 0)
                : '0';
        },
    },
    methods: {
        fmtMoney,
        fmtPercent,
        roleLabel(id) { return ROLE_LEVELS.find((r) => r.id === id)?.label || ''; },
        close() { store.setView(''); },
        async doAudition() {
            if (!this.pickedRole) return;
            await store.auditionForRole(this.project.id, this.pickedRole);
        },
        start() { store.startShooting(this.project.id); },
        async shoot(index) {
            const result = await store.shootScene(this.project.id, index, this.sceneOpinion);
            if (result && !result.ok && result.error) store.showToast(result.error);
            else this.expandedScene = index;
            this.sceneOpinion = '';
        },
        settle() { store.settleProject(this.project.id); },
        resync() { store.resyncProjectSource(this.project.id); },
    },
    template: `
        <div class="zg-overlay">
            <header class="zg-overlay__head">
                <button type="button" class="zg-overlay__back" @click="close"><AcIcon name="back" :size="18" /></button>
                <b v-if="project">《{{ project.title }}》</b>
                <AcTag v-if="project" :tone="project.status === 'aired' ? 'success' : 'plain'">{{ statusLabel[project.status] }}</AcTag>
            </header>
            <div v-if="project" class="zg-overlay__body">
                <AcSection title="剧目">
                    <p class="zg-prose">{{ project.synopsis }}</p>
                    <div class="zg-kvrow"><span>角色</span><b>{{ project.roleName || '待定' }}</b></div>
                    <p v-if="project.roleDesc" class="zg-prose is-dim">{{ project.roleDesc }}</p>
                    <div class="zg-kvrow"><span>拍摄难度</span><b>{{ project.difficulty }}</b></div>
                    <div v-if="project.source" class="zg-kvrow">
                        <span>改编自</span>
                        <b>《{{ project.source.title }}》</b>
                        <AcBtn size="sm" variant="ghost" iconName="refresh" @click="resync">同步原作</AcBtn>
                    </div>
                </AcSection>

                <!-- 试镜 -->
                <AcSection v-if="project.status === 'draft'" title="试镜" sub="一次掷定，seed 存档可回放，不可重掷">
                    <div class="zg-rolegrid">
                        <button v-for="r in roles" :key="r.id" type="button"
                            class="zg-rolecell"
                            :class="{ 'is-on': pickedRole === r.id, 'is-far': !r.reachable }"
                            @click="pickedRole = r.id">
                            <b>{{ r.label }}</b>
                            <i>{{ r.comfortable ? '稳' : r.reachable ? '够一够' : '悬' }}</i>
                        </button>
                    </div>
                    <p v-if="project.auditionRecord && !project.auditionRecord.success" class="zg-note is-danger">
                        上次试镜{{ roleLabel(project.auditionRecord.roleLevelId) }}没过（成功率 {{ Math.round(project.auditionRecord.chance * 100) }}%，roll {{ project.auditionRecord.roll.toFixed(3) }}）。可以降档再试，或者认了。
                    </p>
                    <AcBtn variant="ink" block :disabled="!pickedRole" @click="doAudition">去试镜</AcBtn>
                </AcSection>

                <!-- 定角 → 开机 -->
                <AcSection v-else-if="project.status === 'cast'" title="定角">
                    <p class="zg-prose">{{ roleLabel(project.roleLevel) }}到手了。进组开机后，用日程里的时间一场一场拍。</p>
                    <p v-if="project.auditionRecord" class="zg-note">
                        试镜记录：成功率 {{ Math.round(project.auditionRecord.chance * 100) }}% · roll {{ project.auditionRecord.roll.toFixed(3) }} · seed {{ project.auditionRecord.seed }}
                    </p>
                    <AcBtn variant="gold" block @click="start">开机</AcBtn>
                </AcSection>

                <!-- 场次 -->
                <AcSection v-if="['shooting', 'wrapped', 'aired'].includes(project.status)"
                    title="场次" :sub="project.scenes.filter(sc => sc.done).length + '/' + project.scenes.length + ' 场 · 每场 4 小时'">
                    <div v-for="scene in project.scenes" :key="scene.index" class="zg-scenerow" :class="{ 'is-done': scene.done }">
                        <div class="zg-scenerow__head" @click="expandedScene = expandedScene === scene.index ? -1 : scene.index">
                            <b>第 {{ scene.index + 1 }} 场 · {{ scene.title }}</b>
                            <AcTag v-if="scene.done" :tone="'plain'">
                                {{ (project.performRecords.find(r => r.sceneIndex === scene.index) || {}).gradeLabel || '已拍' }}
                            </AcTag>
                            <AcBtn v-else-if="project.status === 'shooting'" size="sm" variant="ink"
                                :loading="s.loading.scene === project.id + '::' + scene.index"
                                @click.stop="shoot(scene.index)">开拍</AcBtn>
                        </div>
                        <div v-if="expandedScene === scene.index" class="zg-scenerow__body">
                            <p class="zg-prose is-dim">{{ scene.summary }}</p>
                            <p v-if="scene.narrative" class="zg-prose zg-scenerow__narrative">{{ scene.narrative }}</p>
                            <p v-if="scene.done" class="zg-note">这一场的成色已定档，除非整档回滚，否则不能重拍。</p>
                        </div>
                    </div>
                    <AcField v-if="project.status === 'shooting'" label="给下一场戏的意见（可空）">
                        <input class="zg-input" v-model.trim="sceneOpinion" placeholder="如：这场哭戏想收着演" maxlength="60" />
                    </AcField>
                </AcSection>

                <!-- 杀青结算 -->
                <AcSection v-if="project.status === 'wrapped'" title="杀青">
                    <p class="zg-prose">全部场次拍完了。结算后片酬入账、剧集上映，热度由每场戏的成色与你的知名度共同决定。</p>
                    <AcBtn variant="gold" block iconName="coin" @click="settle">杀青结算</AcBtn>
                </AcSection>

                <!-- 上映结果 -->
                <AcSection v-if="project.status === 'aired' && project.airing" title="上映">
                    <div class="zg-kvrow"><span>热度</span><b>{{ project.airing.heat }}/100（{{ project.airing.verdict === 'hit' ? '爆了' : project.airing.verdict === 'solid' ? '平稳' : '糊了' }}）</b></div>
                    <div class="zg-kvrow"><span>片酬</span><b>{{ pay }} {{ s.identity.currency }}</b></div>
                    <p class="zg-note">爆剧会带来综艺邀约倾斜与热搜词条（氧气的热搜会看到）。</p>
                </AcSection>
            </div>
        </div>
    `,
};
