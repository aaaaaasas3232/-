/**
 * 声浪 · 评分 tab
 *
 * 粉丝给选手打分：粉丝均分（实力 + 战绩动量 + 粉丝滤镜，JS 现算）+
 * 用户自己的打分（持久化）+ 确定性热评。用户自己也在被打分。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { positionLabel } from '../../esports-shared/esports-kit.js';

export const EfRatingPage = {
    name: 'EfRatingPage',
    components: { ...UI },
    data() {
        return { teamId: '' };
    },
    computed: {
        s() { return store.getState(); },
        teams() { return this.s.roster?.teams || []; },
        currentTeamId() { return this.teamId || this.s.profile?.userTeamId || 'team-1'; },
        rows() { return store.ratingRows(this.currentTeamId); },
        myScore() { return store.userFanScore(); },
        isMyTeam() { return this.currentTeamId === this.s.profile?.userTeamId; },
    },
    methods: {
        teamName(id) { return store.teamNameOf(id); },
        posLabel(p) { return positionLabel(store.userModel(), p.positionId); },
        rate(playerId, score) { store.ratePlayer(playerId, score); },
        openPlayer(p) { store.setView('player', { playerId: p.id }); },
    },
    template: `
        <div class="ef-page">
            <div v-if="isMyTeam" class="ef-myscore">
                <div class="ef-myscore__num">{{ myScore.toFixed(1) }}</div>
                <div class="ef-myscore__meta">
                    <b>{{ s.profile ? s.profile.gameId : '' }}（你）</b>
                    <i>粉丝们给你的当前均分 —— 打得好会涨，摆烂会掉</i>
                </div>
            </div>

            <div class="ef-teamchips">
                <button v-for="t in teams" :key="t.id" type="button"
                    class="ef-chip" :class="{ 'is-on': currentTeamId === t.id }"
                    @click="teamId = t.id">{{ teamName(t.id) }}</button>
            </div>

            <EfSection :title="teamName(currentTeamId) + ' 选手评分'">
                <div v-for="row in rows" :key="row.player.id" class="ef-raterow">
                    <button type="button" class="ef-raterow__who" @click="openPlayer(row.player)">
                        <EfAvatar :name="row.player.gameId" :hue="row.player.hue" :size="36" />
                        <span class="ef-raterow__name">
                            <b>{{ row.player.gameId }}</b>
                            <i>{{ posLabel(row.player) }}{{ row.player.isSub ? ' · 替补' : '' }}</i>
                        </span>
                    </button>
                    <div class="ef-raterow__scores">
                        <span class="ef-raterow__fan">{{ row.fanScore.toFixed(1) }}</span>
                        <div class="ef-raterow__mine">
                            <button v-for="n in 10" :key="n" type="button"
                                class="ef-ratedot" :class="{ 'is-on': row.myScore >= n }"
                                @click="rate(row.player.id, n)"></button>
                        </div>
                    </div>
                    <div class="ef-raterow__comments">
                        <p v-for="c in row.comments" :key="c.id"><b>{{ c.handle }}：</b>{{ c.text }}</p>
                    </div>
                </div>
            </EfSection>
        </div>
    `,
};
