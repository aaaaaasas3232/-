/**
 * 候鸟 · 行程页
 *
 * 三组：待出发（可进准备板 / 可退票删除）、旅行中（回到对话页）、
 * 已结束（看记录；管理动作在足迹页）。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { fmtDate, fmtMoney } from '../utils.js';
import { stageLabel, tripDurationLabel, tripProgress } from '../services/trip-flow.js';
import { TRIP_STATUS } from '../constants.js';

export const TvTripsPage = {
    name: 'TvTripsPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        prepared() { return this.s.trips.filter((t) => t.status === TRIP_STATUS.prepared); },
        ongoing() { return this.s.trips.filter((t) => t.status === TRIP_STATUS.ongoing); },
        completed() { return this.s.trips.filter((t) => t.status === TRIP_STATUS.completed); },
        empty() { return !this.prepared.length && !this.ongoing.length && !this.completed.length; },
    },
    methods: {
        title(trip) {
            const d = trip.destination || {};
            return `${d.placeName} · ${d.locationName}`;
        },
        duration(trip) { return tripDurationLabel(trip.days); },
        priceLine(trip) {
            return `${fmtMoney(trip.ticket?.price)} ${trip.ticket?.currency || ''}`;
        },
        progressLine(trip) {
            if (!trip.slotCount) return '还没出发的第一段';
            return `进行到 ${stageLabel(trip.slotCount - 1, trip.days)}`;
        },
        progressPct(trip) {
            return Math.round(tripProgress(trip.slotCount, trip.days) * 100);
        },
        dateLine(trip) { return fmtDate(trip.completedAt || trip.startedAt || trip.createdAt); },
        openPrep(trip) { store.openPrep(trip.id); },
        openChat(trip) { store.openTripChat(trip.id); },
        cancel(trip) {
            store.openModal('confirm', {
                title: '退票并删除',
                text: `「${this.title(trip)}」还没出发，票款 ${this.priceLine(trip)} 会原路退回。`,
                danger: true,
                okLabel: '退票删除',
                onOk: () => store.deleteTrip(trip.id),
            });
        },
    },
    template: `
        <div class="tv-page">
            <TvEmpty v-if="empty" icon-name="ticket" title="还没有行程" desc="去探索页挑个地方，买下机票就会出现在这里。" />

            <TvSection v-if="ongoing.length" title="旅行中">
                <div v-for="t in ongoing" :key="t.id" class="tv-trip" @click="openChat(t)">
                    <div class="tv-trip__main">
                        <p class="tv-trip__title">{{ title(t) }}</p>
                        <p class="tv-trip__sub">{{ duration(t) }} · {{ progressLine(t) }}</p>
                        <div class="tv-progress"><span class="tv-progress__bar" :style="{ width: progressPct(t) + '%' }"></span></div>
                    </div>
                    <TvIcon name="chevronRight" :size="16" />
                </div>
            </TvSection>

            <TvSection v-if="prepared.length" title="待出发">
                <div v-for="t in prepared" :key="t.id" class="tv-trip" @click="openPrep(t)">
                    <div class="tv-trip__main">
                        <p class="tv-trip__title">{{ title(t) }}</p>
                        <p class="tv-trip__sub">机票 {{ priceLine(t) }} · 还没出发</p>
                    </div>
                    <button type="button" class="tv-trip__x" @click.stop="cancel(t)">退票</button>
                </div>
            </TvSection>

            <TvSection v-if="completed.length" title="已结束" sub="管理和备注在「足迹」页">
                <div v-for="t in completed" :key="t.id" class="tv-trip is-done" @click="openChat(t)">
                    <div class="tv-trip__main">
                        <p class="tv-trip__title">{{ title(t) }}</p>
                        <p class="tv-trip__sub">{{ duration(t) }} · {{ dateLine(t) }}</p>
                    </div>
                    <span class="tv-trip__badge">回看</span>
                </div>
            </TvSection>
        </div>
    `,
};
