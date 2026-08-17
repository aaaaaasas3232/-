/**
 * 赛点 · 赛程
 *
 * 待出战（策略三选一 → 逐局揭示）+ 未来赛程 + 最近官方赛果。
 * 积分榜与完整赛程在声浪（这里给跳转）。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { SERIES_STRATEGIES } from '../store.js';
import { listSeasonEvents } from '../services/forum-bridge.js';
import { asArray } from '../utils.js';

export const EgSeasonPage = {
    name: 'EgSeasonPage',
    components: { ...UI },
    data() {
        return { strategyId: 'steady', error: '', recent: [] };
    },
    computed: {
        s() { return store.getState(); },
        career() { return this.s.career; },
        season() { return this.career?.season || null; },
        pending() { return asArray(this.career?.pendingSeries); },
        upcoming() { return asArray(this.career?.upcoming); },
        strategies() { return SERIES_STRATEGIES; },
        reveal() { return this.s.seriesReveal; },
        revealGames() {
            if (!this.reveal) return [];
            return asArray(this.reveal.series?.result?.games).slice(0, this.reveal.revealed);
        },
        revealTotal() { return asArray(this.reveal?.series?.result?.games).length; },
        revealDone() { return this.reveal && this.reveal.revealed >= this.revealTotal; },
        revealResult() {
            const sr = this.reveal?.series;
            if (!sr?.result) return null;
            const mine = sr.homeId === this.career.userTeamId;
            const my = mine ? sr.result.homeScore : sr.result.awayScore;
            const opp = mine ? sr.result.awayScore : sr.result.homeScore;
            return {
                won: sr.result.winnerId === this.career.userTeamId,
                score: `${my}:${opp}`,
                mvp: sr.result.mvpName || '',
            };
        },
        openForumAction() {
            return JSON.stringify({ action: 'openApp', targetAppId: 'esports-forum' });
        },
    },
    mounted() {
        this.loadRecent();
    },
    methods: {
        teamOf(sr, side) {
            return side === 'home' ? (sr.homeName || sr.homeId || '待定') : (sr.awayName || sr.awayId || '待定');
        },
        async play(sr) {
            this.error = '';
            const result = await store.playSeries(sr.id, this.strategyId);
            if (!result.ok && result.error) this.error = result.error;
            await this.loadRecent();
        },
        next() { store.revealNextGame(); },
        closeReveal() { store.closeSeriesReveal(); },
        async loadRecent() {
            const rows = await listSeasonEvents({ limit: 30 });
            this.recent = Array.isArray(rows) ? rows.filter((r) => r.result) : [];
        },
        mineLabel(sr) {
            const home = sr.homeId === this.career?.userTeamId;
            const away = sr.awayId === this.career?.userTeamId;
            return home || away;
        },
        gameWinner(g) {
            return g.winner === this.career?.userTeamId ? '胜' : '负';
        },
    },
    template: `
        <div class="eg-page">
            <!-- 逐局揭示 -->
            <EgSection v-if="reveal" title="比赛进行中" :sub="reveal.series.label || ('BO' + reveal.series.bo)">
                <div class="eg-revealhead">
                    <b>{{ teamOf(reveal.series, 'home') }}</b>
                    <span>vs</span>
                    <b>{{ teamOf(reveal.series, 'away') }}</b>
                </div>
                <div v-for="g in revealGames" :key="g.no" class="eg-revealrow" :class="gameWinner(g) === '胜' ? 'is-win' : 'is-lose'">
                    <span>第 {{ g.no }} 局{{ g.peak ? '（巅峰对决 · 盲选）' : '' }}</span>
                    <b>{{ gameWinner(g) }}</b>
                </div>
                <EgBtn v-if="!revealDone" variant="blue" iconName="play" block @click="next">下一局</EgBtn>
                <template v-else>
                    <div class="eg-revealend" :class="revealResult && revealResult.won ? 'is-win' : 'is-lose'">
                        <b>{{ revealResult && revealResult.won ? '胜利' : '告负' }} {{ revealResult ? revealResult.score : '' }}</b>
                        <i v-if="revealResult && revealResult.mvp">系列赛 MVP：{{ revealResult.mvp }}</i>
                    </div>
                    <p class="eg-note">赛后楼已经开在声浪的「赛后讨论」板块，可以去看看网友怎么说，或生成赛报。</p>
                    <EgBtn variant="ghost" block @click="closeReveal">收起</EgBtn>
                </template>
            </EgSection>

            <!-- 待出战 -->
            <EgSection v-if="pending.length && !reveal" title="今日出战" :sub="season ? season.name : ''">
                <div v-for="sr in pending" :key="sr.id" class="eg-dutyrow">
                    <b>{{ teamOf(sr, 'home') }} vs {{ teamOf(sr, 'away') }}</b>
                    <i>{{ sr.label || ('BO' + sr.bo) }}</i>
                </div>
                <EgField label="赛前策略（进入胜率修正，可解释）">
                    <div class="eg-chiprow">
                        <button v-for="st in strategies" :key="st.id" type="button"
                            class="eg-chip" :class="{ 'is-on': strategyId === st.id }"
                            @click="strategyId = st.id">{{ st.label }}（+{{ st.value }}）</button>
                    </div>
                </EgField>
                <p v-if="error" class="eg-error">{{ error }}</p>
                <EgBtn variant="blue" iconName="swords" block :loading="s.loading.series" @click="play(pending[0])">开打（结果一次掷定，逐局揭示）</EgBtn>
            </EgSection>

            <!-- 未来赛程 -->
            <EgSection title="接下来的比赛" :sub="season ? (season.name + ' · ' + season.phaseLabel) : '休赛期'">
                <template #action>
                    <button type="button" class="eg-btn eg-btn--ghost eg-btn--sm" :data-app-action="openForumAction">去声浪看积分榜</button>
                </template>
                <div v-for="sr in upcoming" :key="sr.id" class="eg-dutyrow">
                    <b>第{{ sr.day }}天 · vs {{ sr.oppName }}</b>
                    <i>{{ sr.label || ('BO' + sr.bo) }}</i>
                </div>
                <EgEmpty v-if="!upcoming.length && !pending.length" iconName="trophy" title="近期没有你的比赛" desc="打打排位和训练赛，赛程会来的" />
            </EgSection>

            <!-- 最近官方赛果 -->
            <EgSection title="联盟近况">
                <div v-for="sr in recent.slice(0, 8)" :key="sr.id" class="eg-resultrow" :class="{ 'is-mine': mineLabel(sr) }">
                    <span>第{{ sr.day }}天</span>
                    <b>{{ sr.homeName }} {{ sr.result.homeScore }}:{{ sr.result.awayScore }} {{ sr.awayName }}</b>
                    <EgTag v-if="sr.result.mvpName" tone="warn">MVP {{ sr.result.mvpName }}</EgTag>
                </div>
                <EgEmpty v-if="!recent.length" iconName="rank" title="还没有已完成的比赛" />
            </EgSection>
        </div>
    `,
};
