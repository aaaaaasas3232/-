/**
 * 声浪 · 覆盖页（一）：赛季详情 / 战队配置 / 选手页 / 锚点日历 / 大事记 / 风险面板
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { standingsBoards, phaseLabel } from '../services/season-engine.js';
import { riskPanel } from '../services/event-engine.js';
import { upcomingAnchors } from '../services/career-engine.js';
import { listWorldAis } from '../services/world-context.js';
import { fanScoreFor } from '../services/forum-engine.js';
import { asArray, fmtPercent } from '../utils.js';
import { positionLabel } from '../../esports-shared/esports-kit.js';

const EfOverlayHead = {
    name: 'EfOverlayHead',
    components: { ...UI },
    props: {
        title: { type: String, default: '' },
        sub: { type: String, default: '' },
    },
    emits: ['back'],
    template: `
        <header class="ef-overlay__head">
            <button type="button" class="ef-overlay__back" @click="$emit('back')"><EfIcon name="back" :size="18" /></button>
            <div class="ef-overlay__title"><b>{{ title }}</b><i v-if="sub">{{ sub }}</i></div>
            <slot></slot>
        </header>
    `,
};

// ============================================================
// 赛季详情：积分榜 + 全部赛程 + 收官排名
// ============================================================

export const EfSeasonPage = {
    name: 'EfSeasonPage',
    components: { ...UI, EfOverlayHead },
    data() {
        return { showAll: false };
    },
    computed: {
        s() { return store.getState(); },
        season() { return this.s.save?.season || null; },
        label() { return this.season ? phaseLabel(this.season) : '休赛期'; },
        boards() { return this.season ? standingsBoards(this.season) : []; },
        schedule() {
            if (!this.season) return [];
            const day = this.s.save.clock.day;
            const list = asArray(this.season.series)
                .slice()
                .sort((a, b) => a.day - b.day);
            return this.showAll ? list : list.filter((sr) => Math.abs(sr.day - day) <= 6);
        },
        finalRanking() {
            if (!this.season?.finalRanking) return [];
            return this.season.finalRanking;
        },
    },
    methods: {
        back() { store.setView(''); },
        teamName(id) { return id ? store.teamNameOf(id) : '待定'; },
        isMine(sr) {
            const my = this.s.profile?.userTeamId;
            return sr.homeId === my || sr.awayId === my;
        },
        rowClass(row) {
            return row.teamId === this.s.profile?.userTeamId ? 'is-mine' : '';
        },
    },
    template: `
        <div class="ef-overlay">
            <EfOverlayHead :title="season ? season.name : '赛季'" :sub="label" @back="back" />
            <div class="ef-overlay__body">
                <EfEmpty v-if="!season" iconName="trophy" title="休赛期" desc="下一项赛事官宣后这里会有完整赛程" />
                <template v-else>
                    <EfSection v-for="board in boards" :key="board.name" :title="board.name">
                        <div class="ef-standings">
                            <div class="ef-standings__row is-head">
                                <span>#</span><b>战队</b><span>胜</span><span>负</span><span>净</span><span>分</span>
                            </div>
                            <div v-for="(row, i) in board.rows" :key="row.teamId" class="ef-standings__row" :class="rowClass(row)">
                                <span>{{ i + 1 }}</span>
                                <b>{{ teamName(row.teamId) }}</b>
                                <span>{{ row.wins }}</span>
                                <span>{{ row.losses }}</span>
                                <span>{{ row.gameWin - row.gameLose }}</span>
                                <span>{{ row.points }}</span>
                            </div>
                        </div>
                    </EfSection>

                    <EfSection v-if="finalRanking.length" title="收官排名">
                        <div v-for="(id, i) in finalRanking.slice(0, 10)" :key="id" class="ef-liferow">
                            <span>第 {{ i + 1 }} 名</span><b>{{ teamName(id) }}</b>
                        </div>
                    </EfSection>

                    <EfSection title="赛程" :sub="showAll ? '全部' : '前后一周'">
                        <template #action>
                            <EfBtn size="sm" variant="ghost" @click="showAll = !showAll">{{ showAll ? '收起' : '看全部' }}</EfBtn>
                        </template>
                        <div v-for="sr in schedule" :key="sr.id" class="ef-matchrow" :class="{ 'is-mine': isMine(sr) }">
                            <span class="ef-matchrow__label">第{{ sr.day }}天 · {{ sr.label || ('BO' + sr.bo) }}</span>
                            <b>{{ teamName(sr.homeId) }} vs {{ teamName(sr.awayId) }}</b>
                            <EfTag v-if="sr.result" tone="plain">{{ sr.result.homeScore }}:{{ sr.result.awayScore }}</EfTag>
                            <EfTag v-else-if="isMine(sr)" tone="success">我的比赛</EfTag>
                        </div>
                    </EfSection>
                </template>
            </div>
        </div>
    `,
};

// ============================================================
// 战队配置：改名 / 名册 / AI 角色卡替换
// ============================================================

export const EfTeamsPage = {
    name: 'EfTeamsPage',
    components: { ...UI, EfOverlayHead },
    data() {
        return { openTeamId: 'team-1', renameDraft: '' };
    },
    computed: {
        s() { return store.getState(); },
        teams() { return this.s.roster?.teams || []; },
        worldAis() { return listWorldAis(); },
    },
    methods: {
        back() { store.setView(''); },
        teamName(id) { return store.teamNameOf(id); },
        playersOf(id) { return store.playersOfTeam(id); },
        coachOf(id) { return store.coachOfTeam(id); },
        posLabel(p) { return positionLabel(store.userModel(), p.positionId); },
        toggleTeam(id) {
            this.openTeamId = this.openTeamId === id ? '' : id;
            this.renameDraft = '';
        },
        async rename(teamId) {
            if (!this.renameDraft.trim()) return;
            await store.renameTeam(teamId, this.renameDraft);
            this.renameDraft = '';
        },
        rollAll() { store.randomizeTeamNames({ includeUserTeam: false }); },
        replaceWithAi(player) {
            store.openModal({ type: 'replace-slot', playerId: player.id, playerName: player.gameId });
        },
        restore(player) { store.removeReplacement(player.id); },
        isReplaced(player) { return Boolean(this.s.profile?.aiReplacements?.[player.id]); },
        openPlayer(p) { store.setView('player', { playerId: p.id }); },
    },
    template: `
        <div class="ef-overlay">
            <EfOverlayHead title="战队配置" sub="18 支战队 · 名册由档案确定性生成" @back="back">
                <EfBtn size="sm" variant="soft" iconName="dice" @click="rollAll">随机他队名</EfBtn>
            </EfOverlayHead>
            <div class="ef-overlay__body">
                <div v-for="team in teams" :key="team.id" class="ef-teamcard" :class="{ 'is-open': openTeamId === team.id }">
                    <button type="button" class="ef-teamcard__head" @click="toggleTeam(team.id)">
                        <EfAvatar :name="teamName(team.id)" :hue="team.hue" :size="34" />
                        <span class="ef-teamcard__name">
                            <b>{{ teamName(team.id) }}<EfTag v-if="team.id === s.profile.userTeamId" tone="success">主队</EfTag></b>
                            <i>{{ team.tag }} · 底力 {{ team.powerBase }} · 热度 {{ s.heat[team.id] || 0 }}</i>
                        </span>
                        <EfIcon name="chevron" :size="14" />
                    </button>
                    <div v-if="openTeamId === team.id" class="ef-teamcard__body">
                        <div class="ef-inline">
                            <input class="ef-input is-mini" v-model.trim="renameDraft" :placeholder="'改名：' + teamName(team.id)" maxlength="14" />
                            <EfBtn size="sm" variant="soft" @click="rename(team.id)">改名</EfBtn>
                        </div>
                        <div v-for="p in playersOf(team.id)" :key="p.id" class="ef-playerrow">
                            <button type="button" class="ef-playerrow__who" @click="openPlayer(p)">
                                <EfAvatar :name="p.gameId" :hue="p.hue" :size="30" />
                                <span><b>{{ p.gameId }}</b><i>{{ posLabel(p) }}{{ p.isSub ? ' · 替补' : '' }}{{ p.fromAi ? ' · AI 角色卡' : '' }}</i></span>
                            </button>
                            <EfBtn v-if="!isReplaced(p)" size="sm" variant="ghost" iconName="swap" @click="replaceWithAi(p)">换人</EfBtn>
                            <EfBtn v-else size="sm" variant="ghost" iconName="refresh" @click="restore(p)">还原</EfBtn>
                        </div>
                        <div v-if="coachOf(team.id)" class="ef-playerrow is-coach">
                            <span class="ef-playerrow__who">
                                <EfAvatar :name="coachOf(team.id).realName" :hue="coachOf(team.id).hue" :size="30" />
                                <span><b>{{ coachOf(team.id).realName }}指导</b><i>{{ coachOf(team.id).style }}</i></span>
                            </span>
                        </div>
                    </div>
                </div>
                <p class="ef-note">把占位选手换成世界观里的 AI 角色卡后，TA 的人设会进比赛叙事和社媒联动；数值仍沿用槽位（数值是战力系统的事实）。</p>
            </div>
        </div>
    `,
};

// ============================================================
// 选手页
// ============================================================

export const EfPlayerPage = {
    name: 'EfPlayerPage',
    components: { ...UI, EfOverlayHead },
    computed: {
        s() { return store.getState(); },
        player() { return store.playerById(this.s.viewPayload?.playerId); },
        isCoach() { return this.player?.role === 'coach'; },
        posLabel() {
            if (!this.player || this.isCoach) return '教练';
            return positionLabel(store.userModel(), this.player.positionId);
        },
        fanScore() {
            if (!this.player || !this.s.save) return 0;
            return fanScoreFor(this.s.identity.profileKey, this.player, this.s.save.clock.day, 0);
        },
        attrRows() {
            const attrs = this.player?.attrs || {};
            return [
                ['操作', attrs.mechanics], ['意识', attrs.awareness], ['沟通', attrs.comms],
                ['英雄池', attrs.pool], ['心态', attrs.mentality], ['体能', attrs.stamina], ['默契', attrs.synergy],
            ];
        },
    },
    methods: {
        back() { store.setView(''); },
        teamName(id) { return store.teamNameOf(id); },
    },
    template: `
        <div class="ef-overlay">
            <EfOverlayHead :title="player ? (player.gameId || player.realName) : '选手'" :sub="player ? teamName(player.teamId) : ''" @back="back" />
            <div class="ef-overlay__body" v-if="player">
                <div class="ef-idcard">
                    <EfAvatar :name="player.gameId || player.realName" :hue="player.hue" :size="52" />
                    <div class="ef-idcard__main">
                        <b>{{ player.gameId || (player.realName + '指导') }}</b>
                        <i>{{ posLabel }} · {{ player.gender }} · {{ player.age }} 岁</i>
                        <em>本名 {{ player.realName }} · {{ player.mbti }}</em>
                    </div>
                    <div class="ef-idcard__skill"><b>{{ fanScore.toFixed(1) }}</b><i>粉丝均分</i></div>
                </div>
                <EfSection title="人物">
                    <div class="ef-liferow"><span>性格</span><b>{{ (player.traits || []).join('；') }}</b></div>
                    <div class="ef-liferow"><span>小习惯</span><b>{{ player.quirk }}</b></div>
                    <div class="ef-liferow"><span>对你的态度</span><b>{{ player.attitude }}</b></div>
                </EfSection>
                <EfSection title="能力面板" v-if="!isCoach">
                    <EfBar v-for="[label, v] in attrRows" :key="label" :label="label" :value="v || 0" />
                </EfSection>
            </div>
        </div>
    `,
};

// ============================================================
// 锚点日历（赛事段锚点可编辑 + 节日点锚点启停）
// ============================================================

export const EfAnchorsPage = {
    name: 'EfAnchorsPage',
    components: { ...UI, EfOverlayHead },
    data() {
        return {
            tournaments: [],
            festivals: [],
            editingId: '',
        };
    },
    computed: {
        s() { return store.getState(); },
        anchors() {
            return upcomingAnchors({
                season: this.s.save?.season,
                festivals: this.s.profile?.festivals,
                day: this.s.save?.clock?.day || 1,
                userTeamId: this.s.profile?.userTeamId,
                horizon: 60,
                teamNameOf: store.teamNameOf,
            });
        },
    },
    mounted() {
        this.tournaments = asArray(this.s.profile?.tournaments).map((t) => ({ ...t }));
        this.festivals = asArray(this.s.profile?.festivals).map((f) => ({ ...f }));
    },
    methods: {
        back() { store.setView(''); },
        async saveTournaments() { await store.updateTournaments(this.tournaments); },
        async saveFestivals() { await store.updateFestivals(this.festivals); },
        addTournament() {
            this.tournaments.push({
                id: `t-${Date.now().toString(36)}`,
                name: '新赛事',
                kind: 'fun',
                format: 'showmatch',
                desc: '',
                prizeChampion: 10000,
                prizeRunner: 3000,
                gapDays: 5,
                enabled: true,
            });
        },
        removeTournament(id) {
            this.tournaments = this.tournaments.filter((t) => t.id !== id);
            if (this.editingId === id) this.editingId = '';
        },
        addFestival() {
            this.festivals.push({
                id: `fest-${Date.now().toString(36)}`,
                name: '新节日',
                everyDays: 60,
                desc: '',
                enabled: true,
            });
        },
        removeFestival(id) {
            this.festivals = this.festivals.filter((f) => f.id !== id);
        },
    },
    template: `
        <div class="ef-overlay">
            <EfOverlayHead title="锚点日历" sub="未来 60 天" @back="back" />
            <div class="ef-overlay__body">
                <EfSection title="接下来">
                    <div v-for="(a, i) in anchors" :key="i" class="ef-anchorrow" :class="'is-' + a.kind">
                        <span class="ef-anchorrow__day">第{{ a.day }}天</span>
                        <b>{{ a.title }}</b>
                        <i v-if="a.detail">{{ a.detail }}</i>
                    </div>
                    <EfEmpty v-if="!anchors.length" iconName="calendar" title="接下来两个月没有已知锚点" />
                </EfSection>

                <EfSection title="赛事（段锚点）" sub="改动在下个赛季生效">
                    <template #action>
                        <EfBtn size="sm" variant="soft" @click="addTournament">新建</EfBtn>
                        <EfBtn size="sm" variant="soft" @click="saveTournaments">保存</EfBtn>
                    </template>
                    <div v-for="t in tournaments" :key="t.id" class="ef-awardrow">
                        <div class="ef-awardrow__head" @click="editingId = editingId === t.id ? '' : t.id">
                            <label class="ef-check" @click.stop><input type="checkbox" v-model="t.enabled" /></label>
                            <b>{{ t.name }}</b>
                            <span>{{ t.format === 'sab' ? 'SAB' : t.format === 'cup' ? '十强杯' : '表演赛' }}</span>
                            <EfIcon name="chevron" :size="14" />
                        </div>
                        <div v-if="editingId === t.id" class="ef-awardrow__edit">
                            <EfField label="赛事名"><input class="ef-input" v-model.trim="t.name" maxlength="14" /></EfField>
                            <EfField label="个人夺冠奖金"><input class="ef-input" type="number" v-model.number="t.prizeChampion" min="0" /></EfField>
                            <EfField label="个人亚军奖金"><input class="ef-input" type="number" v-model.number="t.prizeRunner" min="0" /></EfField>
                            <EfField label="赛后休赛天数"><input class="ef-input" type="number" v-model.number="t.gapDays" min="1" max="60" /></EfField>
                            <EfBtn size="sm" variant="ghost" @click="removeTournament(t.id)">删除这场赛事</EfBtn>
                        </div>
                    </div>
                </EfSection>

                <EfSection title="节日（点锚点）">
                    <template #action>
                        <EfBtn size="sm" variant="soft" @click="addFestival">新建</EfBtn>
                        <EfBtn size="sm" variant="soft" @click="saveFestivals">保存</EfBtn>
                    </template>
                    <div v-for="fest in festivals" :key="fest.id" class="ef-festrow">
                        <label class="ef-check"><input type="checkbox" v-model="fest.enabled" /></label>
                        <input class="ef-input" v-model.trim="fest.name" maxlength="14" />
                        <span>每</span>
                        <input class="ef-input" type="number" v-model.number="fest.everyDays" min="7" max="720" />
                        <span>天</span>
                        <input class="ef-input" v-model.trim="fest.desc" placeholder="说明" />
                        <EfBtn size="sm" variant="ghost" @click="removeFestival(fest.id)">删除</EfBtn>
                    </div>
                </EfSection>
            </div>
        </div>
    `,
};

// ============================================================
// 大事记
// ============================================================

export const EfTimelinePage = {
    name: 'EfTimelinePage',
    components: { ...UI, EfOverlayHead },
    computed: {
        s() { return store.getState(); },
        rows() { return this.s.timeline; },
    },
    methods: {
        back() { store.setView(''); },
    },
    template: `
        <div class="ef-overlay">
            <EfOverlayHead title="生涯大事记" :sub="s.save ? s.save.name : ''" @back="back" />
            <div class="ef-overlay__body">
                <div v-for="t in rows" :key="t.id" class="ef-tlrow" :class="{ 'is-major': t.major }">
                    <span class="ef-tlrow__day">第{{ t.day }}天</span>
                    <div class="ef-tlrow__main">
                        <b>{{ t.title }}</b>
                        <i v-if="t.detail">{{ t.detail }}</i>
                    </div>
                    <EfTag v-if="t.major" tone="warn">大事</EfTag>
                </div>
                <EfEmpty v-if="!rows.length" iconName="timeline" title="还没有大事发生" />
            </div>
        </div>
    `,
};

// ============================================================
// 风险面板（概率透明）
// ============================================================

export const EfRiskPage = {
    name: 'EfRiskPage',
    components: { ...UI, EfOverlayHead },
    computed: {
        s() { return store.getState(); },
        rows() {
            const save = this.s.save;
            if (!save) return [];
            return riskPanel({
                attrs: save.attrs,
                day: save.clock.day,
                shieldUntilDay: save.shieldUntilDay,
                energy: save.energy,
                hasAlt: asArray(this.s.profile?.identities).some((i) => !i.isMain),
                triggeredOnceIds: save.triggeredOnceIds,
                lastTriggeredDayById: save.lastTriggeredDayById,
            });
        },
        shieldText() {
            const save = this.s.save;
            if (!save) return '';
            return save.shieldUntilDay >= save.clock.day
                ? `公关护盾生效中（至第 ${save.shieldUntilDay} 天，舆情概率 ×0.15）`
                : '当前没有公关护盾';
        },
    },
    methods: {
        back() { store.setView(''); },
        pct(p) { return fmtPercent(p); },
        buyShield() { store.buyPrShield(); },
    },
    template: `
        <div class="ef-overlay">
            <EfOverlayHead title="风险面板" sub="每个事件此刻的真实概率" @back="back">
                <EfBtn size="sm" variant="soft" iconName="shield" @click="buyShield">买断黑料</EfBtn>
            </EfOverlayHead>
            <div class="ef-overlay__body">
                <p class="ef-note">{{ shieldText }}。概率 = 人气曲线 × 属性护盾 × 公关护盾 × 状态修正，掷签带 seed，回放一致。</p>
                <div v-for="row in rows" :key="row.def.id" class="ef-riskrow" :class="'is-' + row.def.kind">
                    <div class="ef-riskrow__main">
                        <b>{{ row.def.title }}</b>
                        <i v-if="row.blocked === 'cooldown'">冷却中</i>
                        <i v-else-if="row.parts">人气 {{ pct(row.parts.base) }} × 护盾 {{ row.parts.guard.toFixed(2) }}{{ row.parts.shielded ? ' × 公关0.15' : '' }}{{ row.parts.lowEnergy > 1 ? ' × 疲劳1.3' : '' }}</i>
                    </div>
                    <span class="ef-riskrow__p">{{ pct(row.p) }}</span>
                </div>
            </div>
        </div>
    `,
};
