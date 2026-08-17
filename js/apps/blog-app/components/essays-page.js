/**
 * 氧气 · 随笔（全局档；纯本地记录软件，页面里没有任何生成按钮）
 *
 * 两种浏览模式（参考 murmur 的日历 / 故事双模式）：
 *   日历：月历网格，有随笔的日期有黑点，点日期看当天全部
 *   故事：时间轴连续流，按时间倒序
 * 切用户卡、切世界都不丢 —— 随笔属于屏幕前的人。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { dayKey, fmtTime } from '../utils.js';

function monthShift(month, delta) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const OxEssaysPage = {
    name: 'OxEssaysPage',
    components: { ...UI },
    data() {
        return { selectedDay: dayKey() };
    },
    computed: {
        s() { return store.getState(); },
        view() { return this.s.essayView; },
        month() { return this.s.essayMonth; },
        monthLabel() {
            const [y, m] = this.month.split('-');
            return `${y} 年 ${Number(m)} 月`;
        },
        /** 月历格子：前置空位 + 天 */
        grid() {
            const [y, m] = this.month.split('-').map(Number);
            const first = new Date(y, m - 1, 1);
            const daysInMonth = new Date(y, m, 0).getDate();
            const lead = (first.getDay() + 6) % 7;   // 周一开头
            const cells = [];
            for (let i = 0; i < lead; i += 1) cells.push(null);
            for (let d = 1; d <= daysInMonth; d += 1) {
                cells.push(`${this.month}-${String(d).padStart(2, '0')}`);
            }
            return cells;
        },
        dotDays() { return store.essayDaysOfMonth(this.month); },
        dayEssays() { return store.essaysOfDay(this.selectedDay); },
        allEssays() { return this.s.essays; },
        today() { return dayKey(); },
    },
    methods: {
        setView(v) { store.setEssayView(v); },
        prevMonth() { store.setEssayMonth(monthShift(this.month, -1)); },
        nextMonth() { store.setEssayMonth(monthShift(this.month, 1)); },
        pickDay(day) { if (day) this.selectedDay = day; },
        dayNum(day) { return Number(day.split('-')[2]); },
        write() { store.openModal('essay', {}); },
        edit(essay) { store.openModal('essay', { essayId: essay.id }); },
        remove(essay) {
            store.openModal('confirm', {
                title: '删除这篇随笔',
                message: '删掉就没了，它不在任何云端。',
                danger: true,
                okLabel: '删除',
                onOk: () => store.removeEssay(essay.id),
            });
        },
        timeOf(essay) { return fmtTime(essay.createdAt); },
    },
    template: `
        <div class="ox-page ox-essayspage">
            <div class="ox-essays__top">
                <div class="ox-seg">
                    <button type="button" class="ox-seg__item" :class="{ 'is-on': view === 'calendar' }" @click="setView('calendar')">
                        <OxIcon name="calendar" :size="15" /> 日历
                    </button>
                    <button type="button" class="ox-seg__item" :class="{ 'is-on': view === 'story' }" @click="setView('story')">
                        <OxIcon name="timeline" :size="15" /> 故事
                    </button>
                </div>
                <span class="ox-essays__note">纯本地 · 永不调 AI · 不跟世界走</span>
            </div>

            <!-- 日历模式 -->
            <template v-if="view === 'calendar'">
                <div class="ox-cal">
                    <div class="ox-cal__head">
                        <button type="button" class="ox-cal__nav" @click="prevMonth"><OxIcon name="back" :size="15" /></button>
                        <span class="ox-cal__month">{{ monthLabel }}</span>
                        <button type="button" class="ox-cal__nav ox-cal__nav--next" @click="nextMonth"><OxIcon name="back" :size="15" /></button>
                    </div>
                    <div class="ox-cal__week">
                        <span v-for="w in ['一','二','三','四','五','六','日']" :key="w">{{ w }}</span>
                    </div>
                    <div class="ox-cal__grid">
                        <button
                            v-for="(day, i) in grid" :key="i" type="button"
                            class="ox-cal__cell"
                            :class="{
                                'is-empty': !day,
                                'is-selected': day === selectedDay,
                                'is-today': day === today,
                            }"
                            :disabled="!day"
                            @click="pickDay(day)"
                        >
                            <template v-if="day">
                                <span class="ox-cal__num">{{ dayNum(day) }}</span>
                                <i v-if="dotDays.has(day)" class="ox-cal__dot"></i>
                            </template>
                        </button>
                    </div>
                </div>

                <OxSection :title="selectedDay" :sub="dayEssays.length ? dayEssays.length + ' 篇' : ''">
                    <p v-if="!dayEssays.length" class="ox-muted">这一天没有留下字。</p>
                    <div v-for="e in dayEssays" :key="e.id" class="ox-essay">
                        <p class="ox-essay__text">{{ e.text }}</p>
                        <div class="ox-essay__meta">
                            <span v-if="e.mood" class="ox-tag">{{ e.mood }}</span>
                            <span class="ox-essay__time">{{ timeOf(e) }}</span>
                            <span class="ox-essay__spacer"></span>
                            <button type="button" class="ox-essay__act" @click="edit(e)"><OxIcon name="edit" :size="14" /></button>
                            <button type="button" class="ox-essay__act" @click="remove(e)"><OxIcon name="trash" :size="14" /></button>
                        </div>
                    </div>
                </OxSection>
            </template>

            <!-- 故事模式 -->
            <template v-else>
                <OxEmpty v-if="!allEssays.length" icon-name="essay" title="还没有随笔" desc="随笔只属于你：不发广场、不调 AI、切世界也不丢。" />
                <div v-else class="ox-story">
                    <div v-for="e in allEssays" :key="e.id" class="ox-story__item">
                        <div class="ox-story__rail"><i class="ox-story__dot"></i></div>
                        <div class="ox-story__card">
                            <p class="ox-essay__text">{{ e.text }}</p>
                            <div class="ox-essay__meta">
                                <span v-if="e.mood" class="ox-tag">{{ e.mood }}</span>
                                <span class="ox-essay__time">{{ e.day }} {{ timeOf(e).split(' ')[1] || '' }}</span>
                                <span class="ox-essay__spacer"></span>
                                <button type="button" class="ox-essay__act" @click="edit(e)"><OxIcon name="edit" :size="14" /></button>
                                <button type="button" class="ox-essay__act" @click="remove(e)"><OxIcon name="trash" :size="14" /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </template>

            <button type="button" class="ox-fab" aria-label="写随笔" @click="write">
                <OxIcon name="essay" :size="20" />
            </button>
        </div>
    `,
};
