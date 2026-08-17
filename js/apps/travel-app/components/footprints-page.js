/**
 * 候鸟 · 足迹页
 *
 * 完成的旅行自动进这里。每条支持：回看全程、备注、生成概要、
 * 登记到世界（nook 两层幂等注册）、删除（二次确认）。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { fmtDate } from '../utils.js';
import { tripDurationLabel } from '../services/trip-flow.js';
import { TRIP_STATUS } from '../constants.js';

export const TvFootprintsPage = {
    name: 'TvFootprintsPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        footprints() { return this.s.trips.filter((t) => t.status === TRIP_STATUS.completed); },
    },
    methods: {
        title(trip) {
            const d = trip.destination || {};
            return `${d.placeName} · ${d.locationName}`;
        },
        meta(trip) {
            const names = (trip.companions || []).map((c) => c.name).join('、');
            return `${fmtDate(trip.completedAt)} · ${tripDurationLabel(trip.days)}${names ? ` · 和 ${names}` : ' · 独自'}`;
        },
        summarizing(trip) { return this.s.loading.summary === trip.id; },
        registering(trip) { return this.s.loading.register === trip.id; },
        view(trip) { store.openTripChat(trip.id); },
        note(trip) { store.openModal('note', { trip }); },
        summarize(trip) { store.generateTripSummary(trip.id); },
        register(trip) { store.openModal('nook-register', { trip }); },
        remove(trip) {
            store.openModal('confirm', {
                title: '删除这条足迹',
                text: `「${this.title(trip)}」的全部旅程记录和概要都会删掉，已经花掉的票款不会退回。`,
                danger: true,
                okLabel: '删除足迹',
                onOk: () => store.deleteTrip(trip.id),
            });
        },
        clearError() { store.clearError(); },
    },
    template: `
        <div class="tv-page">
            <TvEmpty v-if="!footprints.length" icon-name="footprints" title="还没有足迹" desc="走完一整趟旅行，它就会自动出现在这里。" />

            <div v-for="t in footprints" :key="t.id" class="tv-foot">
                <div class="tv-foot__head" @click="view(t)">
                    <div class="tv-foot__titles">
                        <p class="tv-foot__title">{{ title(t) }}</p>
                        <p class="tv-foot__meta">{{ meta(t) }}</p>
                    </div>
                    <span v-if="t.nook && t.nook.locationId" class="tv-tag is-known">已登记</span>
                </div>

                <p v-if="t.note" class="tv-foot__note">{{ t.note }}</p>

                <div v-if="t.summary" class="tv-foot__summary">
                    <p class="tv-foot__summary-k">概要（已注入 murmur）</p>
                    <p class="tv-foot__summary-v">{{ t.summary }}</p>
                </div>

                <div class="tv-foot__actions">
                    <TvButton size="sm" variant="ghost" icon-name="eye" @click="view(t)">回看全程</TvButton>
                    <TvButton size="sm" variant="ghost" icon-name="note" @click="note(t)">{{ t.note ? '改备注' : '写备注' }}</TvButton>
                    <TvButton size="sm" variant="ghost" icon-name="sparkle" :loading="summarizing(t)" @click="summarize(t)">{{ t.summary ? '重新概要' : '生成概要' }}</TvButton>
                    <TvButton size="sm" variant="ghost" icon-name="pinPlus" :loading="registering(t)" @click="register(t)">{{ t.nook && t.nook.locationId ? '查看登记' : '登记到世界' }}</TvButton>
                    <TvButton size="sm" variant="ghost" icon-name="trash" @click="remove(t)">删除</TvButton>
                </div>
            </div>

            <div v-if="s.error" class="tv-errorbar"><p>{{ s.error }}</p><button type="button" @click="clearError">知道了</button></div>
        </div>
    `,
};
