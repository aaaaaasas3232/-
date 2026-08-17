/**
 * 声浪 · 首页
 *
 * 时间控制（档内时钟 / 跨日 / 快进）+ 今日赛程 + 选手状态
 * + 突发事件流 + 总版热帖预览 + 未来锚点。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { upcomingAnchors } from '../services/career-engine.js';
import { phaseLabel, seriesOfDay } from '../services/season-engine.js';
import {
    DAY_SLOTS, clockHm, currentSlotId, offsetSummary, remainHours, virtualMs,
} from '../../esports-shared/esports-kit.js';
import { formatWorldDate } from '../services/world-context.js';

export const EfHomePage = {
    name: 'EfHomePage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        save() { return this.s.save; },
        clock() { return this.save?.clock || {}; },
        slots() { return DAY_SLOTS; },
        slotId() { return currentSlotId(this.clock); },
        hm() { return clockHm(this.clock); },
        worldDate() {
            return formatWorldDate(virtualMs(this.clock), this.s.identity.worldId);
        },
        offsetText() { return offsetSummary(this.clock); },
        remainText() { return `今天还剩约 ${Math.round(remainHours(this.clock))} 小时`; },
        season() { return this.save?.season || null; },
        seasonLabel() { return this.season ? `${this.season.name} · ${phaseLabel(this.season)}` : '休赛期'; },
        todaySeries() {
            if (!this.season) return [];
            return seriesOfDay(this.season, this.clock.day || 1);
        },
        pendingMine() { return store.pendingUserSeries(); },
        openGameAction() {
            return JSON.stringify({ action: 'openApp', targetAppId: 'esports-game' });
        },
        recentEvents() { return this.s.events.slice(0, 5); },
        hotPosts() { return store.boardFeed('general').slice(0, 3); },
        anchors() {
            return upcomingAnchors({
                season: this.season,
                festivals: this.s.profile?.festivals,
                day: this.clock.day || 1,
                userTeamId: this.s.profile?.userTeamId,
                teamNameOf: store.teamNameOf,
            }).slice(0, 5);
        },
        fanScore() { return store.userFanScore(); },
        mealText() {
            const meals = this.save?.meals || {};
            if (meals.day !== (this.clock.day || 1)) return '午饭晚饭都还没吃';
            const parts = [];
            parts.push(meals.lunch ? '午饭吃过了' : '午饭还没吃');
            parts.push(meals.dinner ? '晚饭吃过了' : '晚饭还没吃');
            return parts.join('，');
        },
    },
    methods: {
        teamName(id) { return store.teamNameOf(id); },
        pickSlot(id) { store.setDaySlot(id); },
        toggleSync() { store.toggleSyncReal(!this.clock.syncReal); },
        nextDay() { store.requestNextDay(); },
        fastForward() { store.openModal({ type: 'fast-forward' }); },
        openThread(post) { store.setView('thread', { postId: post.id, boardId: post.boardId }); },
        openBoard() { store.setView('board', { boardId: 'general' }); },
        openSeason() { store.setView('season'); },
        openRisk() { store.setView('risk'); },
        openEvent(ev) {
            if (ev.type === 'event' && !ev.resolved) {
                store.openModal({ type: 'event', eventId: ev.id, defId: ev.defId });
            }
        },
        seriesLine(sr) {
            const mine = sr.homeId === this.s.profile.userTeamId || sr.awayId === this.s.profile.userTeamId;
            const home = this.teamName(sr.homeId) || '待定';
            const away = this.teamName(sr.awayId) || '待定';
            const score = sr.result ? ` ${sr.result.homeScore}:${sr.result.awayScore}` : '';
            return { mine, text: `${home} vs ${away}${score}`, label: sr.label || `BO${sr.bo}` };
        },
    },
    template: `
        <div class="ef-page">
            <!-- 时间卡 -->
            <div class="ef-clockcard">
                <div class="ef-clockcard__top">
                    <div>
                        <b class="ef-clockcard__day">第 {{ clock.day || 1 }} 天</b>
                        <span class="ef-clockcard__date">{{ worldDate }} · {{ hm }}</span>
                    </div>
                    <EfTag :tone="clock.syncReal ? 'success' : 'plain'">{{ offsetText }}</EfTag>
                </div>
                <div class="ef-clockcard__slots">
                    <button v-for="slot in slots" :key="slot.id" type="button"
                        class="ef-chip" :class="{ 'is-on': slotId === slot.id }"
                        @click="pickSlot(slot.id)">{{ slot.label }}</button>
                    <button type="button" class="ef-chip" :class="{ 'is-on': clock.syncReal }" @click="toggleSync">同步现实</button>
                </div>
                <p class="ef-note">{{ remainText }}</p>
                <div class="ef-clockcard__actions">
                    <EfBtn size="sm" variant="soft" iconName="forward" @click="fastForward">快进</EfBtn>
                    <EfBtn size="sm" variant="ink" iconName="chevron" @click="nextDay">进入下一天</EfBtn>
                </div>
            </div>

            <!-- 出战提醒 -->
            <div v-if="pendingMine.length" class="ef-duty">
                <EfIcon name="swords" :size="18" />
                <div class="ef-duty__main">
                    <b>今天有你的比赛</b>
                    <i>{{ seriesLine(pendingMine[0]).text }} · {{ seriesLine(pendingMine[0]).label }}</i>
                </div>
                <button type="button" class="ef-btn ef-btn--volt ef-btn--sm" :data-app-action="openGameAction">去赛点出战</button>
            </div>

            <!-- 今日赛程 -->
            <EfSection title="今日赛程" :sub="seasonLabel">
                <template #action>
                    <EfBtn size="sm" variant="ghost" @click="openSeason">积分与赛程</EfBtn>
                </template>
                <div v-if="todaySeries.length" class="ef-matchlist">
                    <div v-for="sr in todaySeries" :key="sr.id" class="ef-matchrow" :class="{ 'is-mine': seriesLine(sr).mine }">
                        <span class="ef-matchrow__label">{{ seriesLine(sr).label }}</span>
                        <b>{{ seriesLine(sr).text }}</b>
                        <EfTag v-if="sr.result" tone="plain">已结束</EfTag>
                        <EfTag v-else-if="seriesLine(sr).mine" tone="success">待出战</EfTag>
                        <EfTag v-else tone="info">今晚</EfTag>
                    </div>
                </div>
                <EfEmpty v-else iconName="calendar" title="今天没有比赛" desc="训练、排位、或者去论坛冲会儿浪" />
            </EfSection>

            <!-- 状态 -->
            <EfSection title="我的状态" :sub="'粉丝均分 ' + fanScore.toFixed(1)">
                <template #action>
                    <EfBtn size="sm" variant="ghost" iconName="alert" @click="openRisk">风险面板</EfBtn>
                </template>
                <EfBar label="精力" :value="save ? save.energy : 0" kind="energy" />
                <EfBar label="人气" :value="save ? (save.attrs.fame || 0) : 0" kind="fame" />
                <p class="ef-note">{{ mealText }}（吃饭在赛点 App 里解决）</p>
            </EfSection>

            <!-- 事件流 -->
            <EfSection v-if="recentEvents.length" title="最近发生">
                <div v-for="ev in recentEvents" :key="ev.id"
                    class="ef-eventrow" :class="['is-' + (ev.kind || 'note'), { 'is-open': ev.type === 'event' && !ev.resolved }]"
                    @click="openEvent(ev)">
                    <b>{{ ev.title }}</b>
                    <i>第{{ ev.day }}天{{ ev.chance ? ' · 概率 ' + ev.chance + '%' : '' }}{{ ev.resolved ? '' : ' · 待处理' }}</i>
                </div>
            </EfSection>

            <!-- 热帖 -->
            <EfSection title="总版热帖">
                <template #action>
                    <EfBtn size="sm" variant="ghost" @click="openBoard">进总版</EfBtn>
                </template>
                <EfPostCard v-for="post in hotPosts" :key="post.id" :post="post" @open="openThread" />
            </EfSection>

            <!-- 未来锚点 -->
            <EfSection v-if="anchors.length" title="接下来">
                <div v-for="(a, i) in anchors" :key="i" class="ef-anchorrow" :class="'is-' + a.kind">
                    <span class="ef-anchorrow__day">第{{ a.day }}天</span>
                    <b>{{ a.title }}</b>
                    <i v-if="a.detail">{{ a.detail }}</i>
                </div>
            </EfSection>
        </div>
    `,
};
