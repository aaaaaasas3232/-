/**
 * 候鸟 · 经历页
 *
 * 按当前世界的每个 AI 分组，列它「和用户一起走过」的旅程
 * （都是用户拉上的 —— 这个 App 里 AI 不会自己出门）。
 * 每条可以就地生成概要；概要会写进该 AI 的经历区 + murmur 的候鸟折叠组。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { fmtDate } from '../utils.js';
import { tripDurationLabel } from '../services/trip-flow.js';
import { TRIP_STATUS } from '../constants.js';
import * as world from '../services/world-context.js';

export const TvCompanionsPage = {
    name: 'TvCompanionsPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        /** [{ ai, trips: [...] }]，只列真的一起走过的 */
        groups() {
            const ais = world.listWorldAis(this.s.identity.world);
            const done = this.s.trips.filter((t) => t.status === TRIP_STATUS.completed);
            return ais.map((ai) => ({
                ai,
                trips: done.filter((t) => (t.companions || []).some((c) => String(c.id) === String(ai.id))),
            })).filter((g) => g.trips.length > 0);
        },
        soloTrips() {
            return this.s.trips.filter((t) => (
                t.status === TRIP_STATUS.completed && !(t.companions || []).length
            ));
        },
    },
    methods: {
        title(trip) {
            const d = trip.destination || {};
            return `${d.placeName} · ${d.locationName}`;
        },
        meta(trip) {
            return `${fmtDate(trip.completedAt)} · ${tripDurationLabel(trip.days)}`;
        },
        summarizing(trip) { return this.s.loading.summary === trip.id; },
        view(trip) { store.openTripChat(trip.id); },
        summarize(trip) { store.generateTripSummary(trip.id); },
    },
    template: `
        <div class="tv-page">
            <p class="tv-pagedesc">每位 AI 和你一起走过的旅程。生成概要后，概要会进它的记忆和 murmur 的「候鸟」折叠组 —— 注入的是概要，全过程留在这里回忆。</p>

            <TvEmpty v-if="!groups.length && !soloTrips.length" icon-name="users" title="还没有共同旅行" desc="下次买票时在准备板拉上同行的 AI，走完的旅程就会记在这里。" />

            <TvSection v-for="g in groups" :key="g.ai.id" :title="g.ai.name" :sub="g.trips.length + ' 趟'">
                <template #action><TvAvatar :name="g.ai.name" :url="g.ai.avatar" :bg="g.ai.avatarBg" :size="26" /></template>
                <div v-for="t in g.trips" :key="t.id" class="tv-exp">
                    <div class="tv-exp__main" @click="view(t)">
                        <p class="tv-exp__title">{{ title(t) }}</p>
                        <p class="tv-exp__meta">{{ meta(t) }}</p>
                        <p v-if="t.summary" class="tv-exp__summary">{{ t.summary }}</p>
                    </div>
                    <TvButton size="sm" variant="ghost" icon-name="sparkle" :loading="summarizing(t)" @click="summarize(t)">{{ t.summary ? '重新概要' : '生成概要' }}</TvButton>
                </div>
            </TvSection>

            <TvSection v-if="soloTrips.length" title="独自的旅程" :sub="soloTrips.length + ' 趟'">
                <div v-for="t in soloTrips" :key="t.id" class="tv-exp">
                    <div class="tv-exp__main" @click="view(t)">
                        <p class="tv-exp__title">{{ title(t) }}</p>
                        <p class="tv-exp__meta">{{ meta(t) }}</p>
                        <p v-if="t.summary" class="tv-exp__summary">{{ t.summary }}</p>
                    </div>
                    <TvButton size="sm" variant="ghost" icon-name="sparkle" :loading="summarizing(t)" @click="summarize(t)">{{ t.summary ? '重新概要' : '生成概要' }}</TvButton>
                </div>
            </TvSection>
        </div>
    `,
};
