/**
 * 梦境编织 · 世界时间线弹窗
 *
 * 1:1 复原原版 `showWorldTimelineModal`(12495)。点顶栏那个「故事时间」齿轮弹出来的就是它。
 *
 * 结构(自上而下):
 *   年份     ‹ 2026 ›
 *   月份     12 个横排月份块,**有事件的月份右上角一个小圆点**
 *   日期     标准月历网格,有事件的日子带圆点,当前选中高亮
 *   当前故事时间   大字回显
 *   当日事件 该日期下的时间线事件列表
 *   确认设定
 *
 * 「有事件」的判断:`book.timelineEvents` 里 `time` 能解析成 `YYYY年M月D日` 的那些。
 * 写成别的格式(比如「第三年春」)的事件不参与日历标记 —— 它们本来也定位不到某一天。
 */

import * as store from '../store.js';
import { DwModal } from './dw-modal.js';
import { SHARED_COMPONENTS } from './shared.js';
import { findById } from '../utils.js';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 把 `2026年7月19日` 拆成 {y,m,d};拆不出来返回 null */
function parseCnDate(text) {
    const match = String(text || '').match(/(\d+)年(\d+)月(\d+)日/);
    if (!match) return null;
    return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function formatCnDate(y, m, d) {
    return `${y}年${m}月${d}日`;
}

export const DwWorldTimelineModal = {
    name: 'DwWorldTimelineModal',
    components: { DwModal, ...SHARED_COMPONENTS },
    props: {
        payload: { type: Object, default: () => ({}) },
    },
    emits: ['close', 'notify'],
    data() {
        const book = findById(store.getState().books, this.payload.bookId) || store.getOpenBook();
        const parsed = parseCnDate(book?.worldTime);
        const now = new Date();
        return {
            bookId: book?.id || '',
            year: parsed?.y ?? now.getFullYear(),
            month: parsed?.m ?? now.getMonth() + 1,
            day: parsed?.d ?? now.getDate(),
        };
    },
    computed: {
        book() { return findById(store.getState().books, this.bookId); },

        /** 只取能解析成具体某一天的事件 */
        datedEvents() {
            return (this.book?.timelineEvents || [])
                .map((e) => ({ event: e, date: parseCnDate(e.time) }))
                .filter((x) => x.date);
        },
        /** 本年里哪些月份有事件 */
        monthsWithEvents() {
            const set = new Set();
            for (const { date } of this.datedEvents) {
                if (date.y === this.year) set.add(date.m);
            }
            return set;
        },
        /** 当前年月里哪些天有事件 */
        daysWithEvents() {
            const set = new Set();
            for (const { date } of this.datedEvents) {
                if (date.y === this.year && date.m === this.month) set.add(date.d);
            }
            return set;
        },
        /** 选中那天的事件 */
        eventsOfDay() {
            return this.datedEvents
                .filter((x) => x.date.y === this.year && x.date.m === this.month && x.date.d === this.day)
                .map((x) => x.event);
        },

        /** 月历格子:前面补空位对齐星期,后面补满整周 */
        cells() {
            const first = new Date(this.year, this.month - 1, 1);
            const daysInMonth = new Date(this.year, this.month, 0).getDate();
            const lead = first.getDay();
            const out = [];
            for (let i = 0; i < lead; i += 1) out.push(null);
            for (let d = 1; d <= daysInMonth; d += 1) out.push(d);
            while (out.length % 7 !== 0) out.push(null);
            return out;
        },
        selectedText() {
            return formatCnDate(this.year, this.month, this.day);
        },
        months() {
            return Array.from({ length: 12 }, (_, i) => i + 1);
        },
    },
    methods: {
        shiftYear(delta) {
            this.year += delta;
            this.clampDay();
        },
        pickMonth(m) {
            this.month = m;
            this.clampDay();
        },
        pickDay(d) {
            if (d) this.day = d;
        },
        /** 从 1月31日 切到 2月时,31 号不存在 —— 夹到当月最后一天 */
        clampDay() {
            const max = new Date(this.year, this.month, 0).getDate();
            if (this.day > max) this.day = max;
        },
        onConfirm() {
            store.updateBook(this.bookId, { worldTime: this.selectedText });
            this.$emit('notify', `故事时间设为 ${this.selectedText}`);
            this.$emit('close');
        },
        onAddEvent() {
            const bookId = this.bookId;
            const time = this.selectedText;
            this.$emit('close');
            store.openModal('timeline-event', { bookId, mode: 'create', event: { time } });
        },
    },
    created() {
        this.WEEKDAYS = WEEKDAYS;
    },
    template: `
        <DwModal class="dw-timeline-modal" title="世界时间线" max-width="340px" @close="$emit('close')">
            <!-- 年份 -->
            <p class="dw-wt-label">年份</p>
            <div class="dw-wt-year">
                <button type="button" class="dw-wt-year-btn" aria-label="上一年" @click="shiftYear(-1)">
                    <DwIcon name="chevronLeft" />
                </button>
                <span class="dw-wt-year-value">{{ year }}</span>
                <button type="button" class="dw-wt-year-btn" aria-label="下一年" @click="shiftYear(1)">
                    <DwIcon name="chevronRight" />
                </button>
            </div>

            <!-- 月份 -->
            <p class="dw-wt-label">月份 <i class="dw-wt-dot-legend"></i> 有事件</p>
            <div class="dw-wt-months">
                <button
                    v-for="m in months"
                    :key="m"
                    type="button"
                    class="dw-wt-month"
                    :class="{ active: m === month }"
                    @click="pickMonth(m)"
                >
                    {{ m }}月
                    <i v-if="monthsWithEvents.has(m)" class="dw-wt-dot"></i>
                </button>
            </div>

            <!-- 日历 -->
            <p class="dw-wt-label">日期(点带 <i class="dw-wt-dot-legend"></i> 的日子看事件)</p>
            <div class="dw-wt-calendar">
                <div class="dw-wt-week">
                    <span v-for="w in WEEKDAYS" :key="w" class="dw-wt-weekday">{{ w }}</span>
                </div>
                <div class="dw-wt-days">
                    <button
                        v-for="(cell, i) in cells"
                        :key="i"
                        type="button"
                        class="dw-wt-day"
                        :class="{ 'is-empty': !cell, active: cell === day }"
                        :disabled="!cell"
                        @click="pickDay(cell)"
                    >
                        <template v-if="cell">{{ cell }}</template>
                        <i v-if="cell && daysWithEvents.has(cell)" class="dw-wt-dot"></i>
                    </button>
                </div>
            </div>

            <!-- 回显 -->
            <div class="dw-wt-current">
                <p class="dw-wt-current-label">当前故事时间</p>
                <p class="dw-wt-current-value">{{ selectedText }}</p>
            </div>

            <!-- 当日事件 -->
            <div v-if="eventsOfDay.length" class="dw-wt-events">
                <div v-for="event in eventsOfDay" :key="event.id" class="dw-wt-event">
                    <p class="dw-wt-event-title">{{ event.title || '(无标题)' }}</p>
                    <p v-if="event.description" class="dw-wt-event-desc">{{ event.description }}</p>
                </div>
            </div>
            <p v-else class="dw-wt-empty">这一天还没有记事件</p>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" @click="onAddEvent">记一条事件</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onConfirm">确认设定</button>
            </template>
        </DwModal>
    `,
};

export const TIMELINE_MODAL_COMPONENTS = { DwWorldTimelineModal };
