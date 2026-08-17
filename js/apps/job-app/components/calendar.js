/**
 * 灯塔 · 工作日期表
 *
 * 一个月的格子。四种状态叠在同一个格子上，各占不同的视觉通道，
 * 这样它们能同时出现而不打架：
 *
 *   上班 / 休息   底色
 *   今天          一圈描边
 *   演过了        右下角一个点
 *   请假          斜杠（在「按周排」模式下才有意义）
 *
 * ── 点一下只是「选中」 ────────────────────────────────────────────
 *
 * 改排班和生成小剧场都是有后果的操作，所以格子本身只负责选中，
 * 具体做什么由下面那排按钮决定。第一版做的是「双击切换上下班」——
 * 触屏上双击极难触发，而且失败时**没有任何反馈**，
 * 用户只会觉得这个日历点不动。
 */

import { UI } from './ui.js';
import { WEEKDAYS } from '../constants.js';
import { buildMonth, shiftMonth, monthStats } from '../services/schedule-service.js';
import { icon } from '../icons.js';
import { todayKey } from '../utils.js';

export const JbCalendar = {
    name: 'JbCalendar',
    components: { ...UI },
    props: {
        year: { type: Number, required: true },
        month: { type: Number, required: true },
        shift: { type: Object, default: () => ({}) },
        playedDays: { type: Array, default: () => [] },
        selected: { type: String, default: '' },
    },
    emits: ['step', 'pick'],
    computed: {
        weekdays() { return WEEKDAYS; },
        grid() {
            return buildMonth(this.year, this.month, {
                shift: this.shift,
                playedDays: this.playedDays,
            });
        },
        stats() {
            return monthStats(this.year, this.month, {
                shift: this.shift,
                playedDays: this.playedDays,
            });
        },
        prevSvg() { return icon('back', { size: 17 }); },
        nextSvg() { return icon('chevron', { size: 17 }); },
        today() { return todayKey(); },
    },
    methods: {
        step(d) {
            const next = shiftMonth(this.year, this.month, d);
            this.$emit('step', next);
        },
        cellClass(c) {
            return {
                'is-blank': c.blank,
                'is-work': !c.blank && c.workday,
                'is-rest': !c.blank && !c.workday,
                'is-off': !c.blank && c.off,
                'is-today': !c.blank && c.today,
                'is-played': !c.blank && c.played,
                'is-future': !c.blank && c.future,
                'is-picked': !c.blank && c.day === this.selected,
            };
        },
    },
    template: `
        <div class="jb-cal">
            <header class="jb-cal__bar">
                <button class="jb-iconbtn" v-html="prevSvg" @click="step(-1)"></button>
                <span class="jb-cal__month">{{ year }} 年 {{ month }} 月</span>
                <button class="jb-iconbtn" v-html="nextSvg" @click="step(1)"></button>
                <span class="jb-cal__stats">上班 {{ stats.work }} 天 · 演过 {{ stats.played }} 天</span>
            </header>

            <div class="jb-cal__week">
                <span v-for="w in weekdays" :key="w.id">{{ w.short }}</span>
            </div>

            <div class="jb-cal__grid">
                <button
                    v-for="(c, i) in grid.cells" :key="i"
                    class="jb-cal__cell"
                    :class="cellClass(c)"
                    :disabled="c.blank"
                    @click="$emit('pick', c.day)"
                >
                    <span v-if="!c.blank" class="jb-cal__num">{{ c.num }}</span>
                    <i v-if="c.played" class="jb-cal__dot"></i>
                </button>
            </div>

            <div class="jb-cal__legend">
                <span class="jb-cal__legend-item is-work">上班</span>
                <span class="jb-cal__legend-item is-rest">休息</span>
                <span class="jb-cal__legend-item is-played">演过了</span>
                <span class="jb-cal__legend-item is-today">今天</span>
            </div>
        </div>
    `,
};
