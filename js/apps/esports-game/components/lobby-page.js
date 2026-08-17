/**
 * 赛点 · 大厅
 *
 * 巅峰分卡 + 状态（精力 / 饭点 / 今日局数）+ 开排位（模式 / 局数 / 同行 / 英雄）
 * + 今日训练赛 + 最近场次。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import {
    DAILY_GAME_CAP, RANK_MODES, SESSION_GAME_CAP,
} from '../constants.js';
import { clockHm, currentSlotLabel } from '../../esports-shared/esports-kit.js';
import { deltaText, minutesText, winRateText, asArray } from '../utils.js';

export const EgLobbyPage = {
    name: 'EgLobbyPage',
    components: { ...UI },
    data() {
        return {
            modeId: 'solo',
            count: 3,
            companionIds: [],
            heroName: '',
            eatFirst: true,
            error: '',
        };
    },
    computed: {
        s() { return store.getState(); },
        career() { return this.s.career; },
        gs() { return this.s.gState; },
        modes() { return RANK_MODES; },
        mode() { return this.modes.find((m) => m.id === this.modeId) || this.modes[0]; },
        heroPool() { return store.model().heroPool; },
        heroNoun() { return store.model().heroNoun; },
        ratingLabel() { return store.ratingLabel(); },
        hm() { return clockHm(this.career?.clock); },
        slotLabel() { return currentSlotLabel(this.career?.clock); },
        todayGames() { return store.todayGames(); },
        cap() { return DAILY_GAME_CAP; },
        sessionCap() { return SESSION_GAME_CAP; },
        plan() { return store.rankPlan(this.count); },
        meals() { return store.mealStatus(); },
        hungry() { return store.isHungryNow(); },
        companions() { return store.companionOptions(); },
        pickedCompanions() {
            return this.companionIds
                .map((id) => this.companions.find((c) => c.id === id))
                .filter(Boolean);
        },
        trainingDone() { return store.trainingDoneToday(); },
        recentSessions() { return this.s.sessions.slice(0, 5); },
        planText() {
            if (!this.plan) return '';
            const bits = [`预计 ${minutesText(this.plan.totalMinutes)}`];
            if (this.plan.mealsNeeded.length) bits.push(`会跨过${this.plan.mealsNeeded.map((m) => m.label).join('、')}`);
            return bits.join(' · ');
        },
    },
    methods: {
        pickMode(id) {
            this.modeId = id;
            const max = this.modes.find((m) => m.id === id)?.companions || 0;
            this.companionIds = this.companionIds.slice(0, max);
        },
        toggleCompanion(c) {
            const set = new Set(this.companionIds);
            if (set.has(c.id)) set.delete(c.id);
            else if (set.size < this.mode.companions) set.add(c.id);
            this.companionIds = [...set];
        },
        async start() {
            this.error = '';
            const result = await store.startRankSession({
                modeId: this.modeId,
                count: this.count,
                companionIds: this.companionIds,
                heroName: this.heroName || this.heroPool[0],
                eatFirst: this.eatFirst,
            });
            if (!result.ok) {
                this.error = result.error || '';
                return;
            }
            store.setView('session', { sessionId: result.session.id, reveal: true });
        },
        async train() {
            this.error = '';
            const result = await store.playTraining();
            if (!result.ok && result.error) this.error = result.error;
        },
        openSession(sess) { store.setView('session', { sessionId: sess.id }); },
        eat(key) { store.eatMeal(key); },
        rateOf(sess) { return winRateText(sess.wins, sess.losses); },
        dText(v) { return deltaText(v); },
        countRange() {
            return Array.from({ length: this.sessionCap }, (_, i) => i + 1);
        },
        firstMealPending() {
            return asArray(this.plan?.mealsNeeded)[0]?.label || '';
        },
    },
    template: `
        <div class="eg-page">
            <!-- 巅峰分 -->
            <div class="eg-ratingcard">
                <div class="eg-ratingcard__main">
                    <b>{{ gs ? gs.rating : 0 }}</b>
                    <i>{{ ratingLabel }} · 历史最高 {{ gs ? gs.best : 0 }}</i>
                </div>
                <div class="eg-ratingcard__side">
                    <span>第 {{ career ? career.clock.day : 1 }} 天 · {{ hm }}（{{ slotLabel }}）</span>
                    <span>今日 {{ todayGames }}/{{ cap }} 局</span>
                </div>
            </div>

            <!-- 状态 -->
            <EgSection title="状态">
                <EgBar label="精力" :value="career ? career.energy : 0" kind="energy" />
                <div class="eg-mealrow">
                    <template v-for="m in meals" :key="m.key">
                        <EgTag v-if="m.eaten" tone="success">{{ m.label }}已吃</EgTag>
                        <EgBtn v-else-if="m.missed" size="sm" variant="danger" iconName="meal" @click="eat(m.key)">饿着呢，补{{ m.label }}</EgBtn>
                        <EgBtn v-else-if="m.open" size="sm" variant="soft" iconName="meal" @click="eat(m.key)">吃{{ m.label }}</EgBtn>
                        <EgTag v-else tone="plain">{{ m.label }}还早</EgTag>
                    </template>
                </div>
                <p v-if="hungry" class="eg-error">饿着肚子打排位有战力惩罚，先吃饭。</p>
            </EgSection>

            <!-- 开排位 -->
            <EgSection title="开始排位" :sub="mode.desc">
                <div class="eg-chiprow">
                    <button v-for="m in modes" :key="m.id" type="button"
                        class="eg-chip" :class="{ 'is-on': modeId === m.id }"
                        @click="pickMode(m.id)">{{ m.label }}</button>
                </div>

                <EgField :label="'连打几局（一次最多 ' + sessionCap + ' 局，打半天就真的过去半天）'">
                    <div class="eg-chiprow">
                        <button v-for="n in countRange()" :key="n" type="button"
                            class="eg-chip is-mini" :class="{ 'is-on': count === n }"
                            @click="count = n">{{ n }}</button>
                    </div>
                </EgField>

                <EgField v-if="mode.companions > 0" :label="'带上谁（最多 ' + mode.companions + ' 人；AI 会记得这段开黑）'">
                    <div class="eg-companions">
                        <button v-for="c in companions" :key="c.id" type="button"
                            class="eg-companion" :class="{ 'is-on': companionIds.includes(c.id) }"
                            @click="toggleCompanion(c)">
                            <b>{{ c.name }}</b>
                            <i>{{ c.type === 'ai' ? 'AI · ' : '' }}{{ c.desc }}</i>
                        </button>
                    </div>
                </EgField>

                <EgField :label="'这一轮主玩的' + heroNoun + '（练它涨熟练）'">
                    <select class="eg-input" v-model="heroName">
                        <option value="">{{ heroPool[0] }}（默认）</option>
                        <option v-for="h in heroPool" :key="h" :value="h">{{ h }}{{ gs && gs.focusHero === h ? '（本命）' : '' }}</option>
                    </select>
                </EgField>

                <label v-if="plan && plan.mealsNeeded.length" class="eg-checkline">
                    <input type="checkbox" v-model="eatFirst" />
                    <span>先把{{ firstMealPending() }}吃了再打（+35 分钟，回精力）</span>
                </label>

                <p class="eg-note">{{ planText }}；对局由系统一次掷定（seed 存档，没有重 roll），你可以逐局翻开。</p>
                <p v-if="error" class="eg-error">{{ error }}</p>
                <EgBtn variant="blue" iconName="play" block :loading="s.loading.rank" @click="start">开始匹配</EgBtn>
            </EgSection>

            <!-- 训练赛 -->
            <EgSection title="今日训练赛" :sub="trainingDone ? '已完成' : '教练在等'">
                <p class="eg-note" v-if="!trainingDone">每天一场，打完能在群里复盘；老不打训练赛，教练会在群里点名。</p>
                <p class="eg-note" v-else-if="gs && gs.lastTraining && gs.lastTraining.day === (career ? career.clock.day : 0)">
                    今日 vs {{ gs.lastTraining.oppName }}：{{ gs.lastTraining.wins }}:{{ gs.lastTraining.losses }}
                </p>
                <EgBtn v-if="!trainingDone" variant="soft" iconName="target" :loading="s.loading.training" @click="train">打训练赛（约 1 小时）</EgBtn>
            </EgSection>

            <!-- 最近场次 -->
            <EgSection title="最近场次">
                <button v-for="sess in recentSessions" :key="sess.id" type="button" class="eg-sessrow" @click="openSession(sess)">
                    <div class="eg-sessrow__main">
                        <b>{{ sess.modeLabel }} · {{ sess.wins }}胜{{ sess.losses }}负（{{ rateOf(sess) }}）</b>
                        <i>第{{ sess.day }}天 · {{ sess.heroName }}<template v-if="sess.companionsMeta && sess.companionsMeta.length"> · 与{{ sess.companionsMeta.map(c => c.name).join('、') }}</template></i>
                    </div>
                    <span class="eg-sessrow__delta" :class="sess.ratingDelta >= 0 ? 'is-up' : 'is-down'">{{ dText(sess.ratingDelta) }}</span>
                </button>
                <EgEmpty v-if="!recentSessions.length" iconName="rank" title="还没打过排位" desc="上面选好模式和局数就能开" />
            </EgSection>
        </div>
    `,
};
