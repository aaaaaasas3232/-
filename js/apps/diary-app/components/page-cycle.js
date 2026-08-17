/**
 * 日记 · 生理期页
 *
 * 四块：状态大卡 → 日历 → 当天打卡 → 周期统计。
 *
 * ── 打卡是三态，不是勾选框 ────────────────────────────────────────
 *
 * 「来了 / 还没来 / 没记」必须是三个可区分的状态。用勾选框的话
 * 「没勾」既可能是「没来」也可能是「今天忘了记」，而这两者对 prompt 的
 * 影响完全相反 —— 产品明确要求「用户记录自己没有来」时要能对 AI 说死。
 *
 * 所以 UI 上给的是两个并列按钮（来了 / 还没来），再点一次取消回「没记」。
 *
 * ── 表单里出现哪些项，由用户自己决定 ──────────────────────────────
 *
 * `space.cycle.trackFields` 控制。默认开五项，其余在「记录项」里自己打开。
 * 一次性铺十项会让每天打卡变成负担，砍掉又满足不了「比市面上都细」。
 */

import * as store from '../store.js';
import { presets as LP } from '@/src/core/presets/index.js';
import { SHARED_COMPONENTS } from './shared.js';
import {
    CYCLE_STATE, CYCLE_MODE, TRACK_FIELDS, CARE_TONES,
    FLOW_LEVELS, PAIN_LEVELS, PAIN_SPOTS, SYMPTOMS,
    DISCHARGE_TYPES, PRODUCT_TYPES, MOODS, OWNER_KIND,
} from '../constants.js';
import {
    todayKey, formatDateLabel, daysInMonth,
    monthKey, compareDateKey, median, weekdayLabel,
} from '../utils.js';
import {
    resolveCycle, describeState, buildCalendarMarks,
    extractPeriodStarts, extractCycleLengths, extractPeriodLengths,
} from '../services/cycle-service.js';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export const DyCycle = {
    name: 'DyCycle',
    components: { ...SHARED_COMPONENTS },
    data() {
        return {
            WEEKDAYS, TRACK_FIELDS, CARE_TONES, CYCLE_MODE, MOODS,
            FLOW_LEVELS, PAIN_LEVELS, PAIN_SPOTS, SYMPTOMS,
            DISCHARGE_TYPES, PRODUCT_TYPES,
            month: monthKey(todayKey()),
            /** 打卡表编辑的是哪一天。默认今天，点日历会改。 */
            pickDate: todayKey(),
            showSettings: false,
        };
    },
    computed: {
        state() { return store.getState(); },
        /**
         * 生理期永远记在**用户自己**的本子上。
         * 翻 AI 的日记本时这一页显示的仍然是用户的数据 ——
         * AI 没有生理期，但「它知道我的情况」正是这个 App 的设定。
         */
        space() {
            const active = store.getActiveSpace();
            return active?.ownerKind === OWNER_KIND.USER ? active : store.getUserSpace();
        },
        readonly() { return store.getActiveSpace()?.ownerKind === OWNER_KIND.AI; },
        cfg() { return this.space?.cycle || {}; },
        days() { return store.cycleDaysOf(this.space?.id); },
        info() { return this.space ? resolveCycle(this.space, this.days) : { enabled: false }; },

        stateText() { return describeState(this.info); },
        stateSub() {
            const i = this.info;
            if (!i.enabled) return '';
            if (i.state === 'in-period' && i.predictedEnd) return `预计 ${formatDateLabel(i.predictedEnd)} 前后结束`;
            if (i.predictedStart) return `下次预计 ${formatDateLabel(i.predictedStart)}`;
            return '再记两次就能开始推算了';
        },
        irregularFlag() {
            const i = this.info;
            if (!i.enabled || !i.irregular) return '';
            return i.observedCycles.length >= 2
                ? `周期不规律 · 实测 ${Math.min(...i.observedCycles)}~${Math.max(...i.observedCycles)} 天`
                : '周期不规律';
        },
        todayState() {
            return store.getCycleDay(this.space?.id, todayKey())?.state || CYCLE_STATE.UNKNOWN;
        },

        // ── 日历 ────────────────────────────
        monthLabel() {
            const [y, m] = this.month.split('-');
            return `${y} 年 ${Number(m)} 月`;
        },
        monthStart() { return `${this.month}-01`; },
        monthEnd() {
            const [y, m] = this.month.split('-').map(Number);
            return `${this.month}-${String(daysInMonth(y, m)).padStart(2, '0')}`;
        },
        marks() {
            return this.space ? buildCalendarMarks(this.space, this.days, this.monthStart, this.monthEnd) : new Map();
        },
        entryDates() {
            const set = new Set();
            for (const e of store.entriesOf(store.getActiveSpace()?.id)) set.add(e.date);
            return set;
        },
        cells() {
            const [y, m] = this.month.split('-').map(Number);
            const first = new Date(y, m - 1, 1).getDay();
            const total = daysInMonth(y, m);
            const today = todayKey();
            const out = [];
            for (let i = 0; i < first; i += 1) out.push({ key: `pad-${i}`, pad: true });
            for (let d = 1; d <= total; d += 1) {
                const date = `${this.month}-${String(d).padStart(2, '0')}`;
                out.push({
                    key: date,
                    date,
                    day: d,
                    mark: this.marks.get(date) || '',
                    hasEntry: this.entryDates.has(date) ? '1' : '0',
                    isToday: date === today,
                    isFuture: compareDateKey(date, today) > 0,
                });
            }
            return out;
        },

        // ── 打卡表 ──────────────────────────
        record() {
            return store.getCycleDay(this.space?.id, this.pickDate)
                || { state: CYCLE_STATE.UNKNOWN, painSpots: [], symptoms: [], productChanges: 0 };
        },
        pickLabel() {
            return this.pickDate === todayKey()
                ? '今天'
                : `${formatDateLabel(this.pickDate, { withYear: true })} ${weekdayLabel(this.pickDate)}`;
        },
        hasField() {
            const on = new Set(this.cfg.trackFields || []);
            return (id) => on.has(id);
        },

        // ── 统计 ────────────────────────────
        starts() { return extractPeriodStarts(this.days); },
        cycleLengths() { return extractCycleLengths(this.starts); },
        periodLengths() { return extractPeriodLengths(this.days); },
        stats() {
            return [
                { label: '平均周期', value: this.cycleLengths.length ? median(this.cycleLengths) : (this.cfg.cycleLength || '—'), unit: '天' },
                { label: '平均经期', value: this.periodLengths.length ? median(this.periodLengths) : (this.cfg.periodLength || '—'), unit: '天' },
                { label: '记录次数', value: this.starts.length, unit: '次' },
            ];
        },
        history() {
            const rows = [];
            for (let i = this.starts.length - 1; i >= 1 && rows.length < 6; i -= 1) {
                const len = this.cycleLengths[i - 1];
                if (len == null) continue;
                rows.push({
                    key: this.starts[i],
                    date: formatDateLabel(this.starts[i - 1], { withYear: true }),
                    len,
                    // 条宽按 20~45 天映射到 0~100%，超出夹住
                    width: `${Math.min(100, Math.max(12, ((len - 18) / 27) * 100))}%`,
                });
            }
            return rows;
        },
    },
    methods: {
        // ── 日历 ────────────────────────────
        shiftMonth(delta) {
            const [y, m] = this.month.split('-').map(Number);
            const d = new Date(y, m - 1 + delta, 1);
            this.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        },
        pickCell(cell) {
            if (cell.pad || cell.isFuture) return;
            this.pickDate = cell.date;
        },

        // ── 打卡 ────────────────────────────
        setState(next) {
            if (this.readonly) return;
            const cur = this.record.state;
            store.setCycleDay(this.space.id, this.pickDate, {
                state: cur === next ? CYCLE_STATE.UNKNOWN : next,
            });
        },
        /**
         * 状态大卡上的两个按钮永远打「今天」的卡，和下面那张表（打的是 pickDate）
         * 不是一回事 —— 用户在日历上翻到上个月时，顶上那两个按钮不该改到上个月去。
         */
        markToday(next) {
            if (this.readonly) return;
            const cur = this.todayState;
            store.markToday(cur === next ? CYCLE_STATE.UNKNOWN : next, this.space.id);
        },
        patch(key, value) {
            if (this.readonly) return;
            store.setCycleDay(this.space.id, this.pickDate, { [key]: value });
        },

        // ── 设置 ────────────────────────────
        setCfg(key, value) {
            store.patchCycleConfig(this.space.id, { [key]: value });
        },
        toggleTrack(id) {
            const cur = new Set(this.cfg.trackFields || []);
            if (cur.has(id)) cur.delete(id);
            else cur.add(id);
            this.setCfg('trackFields', TRACK_FIELDS.filter((f) => cur.has(f.id)).map((f) => f.id));
        },
        async editWorldNote() {
            const text = await LP.modals.prompt({
                title: '这个世界观里怎么看这件事',
                message: '会原样告诉 TA。不填的话 TA 按当前世界观的常识来说。',
                value: this.cfg.worldNote || '',
                multiline: true,
                maxLength: 200,
            });
            if (text === null) return;
            this.setCfg('worldNote', text.trim());
        },
        async editCustomPrompt() {
            const text = await LP.modals.prompt({
                title: '额外想让 TA 知道的',
                message: '这段会原样加到告诉 TA 的内容后面。',
                value: this.cfg.customPrompt || '',
                multiline: true,
                maxLength: 300,
            });
            if (text === null) return;
            this.setCfg('customPrompt', text.trim());
        },
        careToneName() {
            return CARE_TONES.find((t) => t.id === this.cfg.careTone)?.name || '';
        },

        async enableCycle() {
            store.patchCycleConfig(this.space.id, { enabled: true });
            this.showSettings = true;
        },
    },
    template: `
    <div>
        <!-- 没开 -->
        <template v-if="!info.enabled">
            <DyEmpty icon-name="drop">
                还没有开启生理期记录。<br />开启之后会按你的周期推算，TA 也会知道。
            </DyEmpty>
            <DyBtn v-if="!readonly" block variant="primary" @click="enableCycle">开启记录</DyBtn>
        </template>

        <template v-else>
            <!-- 状态大卡 -->
            <div class="dy-cyclehero">
                <div class="dy-cyclehero__state">{{ stateText }}</div>
                <div class="dy-cyclehero__sub">{{ stateSub }}</div>
                <div v-if="irregularFlag" class="dy-cyclehero__flag">{{ irregularFlag }}</div>
                <div v-if="!readonly" class="dy-cyclehero__quick">
                    <DyBtn
                        :variant="todayState === 'period' ? 'primary' : ''"
                        @click="markToday('period')"
                    >今天来了</DyBtn>
                    <DyBtn
                        :variant="todayState === 'none' ? 'primary' : ''"
                        @click="markToday('none')"
                    >还没来</DyBtn>
                </div>
            </div>

            <!-- 日历 -->
            <DySection title="日历" style="margin-top:22px;">
                <div class="dy-cal__head">
                    <DyIconBtn name="left" label="上个月" @click="shiftMonth(-1)" />
                    <span class="dy-cal__month">{{ monthLabel }}</span>
                    <DyIconBtn name="right" label="下个月" @click="shiftMonth(1)" />
                </div>
                <div class="dy-cal__week">
                    <span v-for="w in WEEKDAYS" :key="w" class="dy-cal__wd">{{ w }}</span>
                </div>
                <div class="dy-cal__grid">
                    <button
                        v-for="c in cells" :key="c.key"
                        type="button" class="dy-cal__cell"
                        :class="{
                            'dy-cal__cell--pad': c.pad,
                            'is-today': c.isToday,
                            'is-focus': !c.pad && c.date === pickDate,
                            'is-future': c.isFuture,
                        }"
                        :data-mark="c.mark || null"
                        :data-has-entry="c.hasEntry"
                        @click="pickCell(c)"
                    >{{ c.day }}</button>
                </div>
                <div class="dy-cal__legend">
                    <span><i class="dy-cal__swatch" data-mark="period"></i>来了</span>
                    <span><i class="dy-cal__swatch" data-mark="none"></i>记了没来</span>
                    <span><i class="dy-cal__swatch" data-mark="predicted"></i>预计</span>
                    <span><i class="dy-cal__swatch" data-mark="fertile"></i>排卵期（推算）</span>
                </div>
            </DySection>

            <!-- 打卡 -->
            <DySection :title="pickLabel + ' 的记录'">
                <div class="dy-card">
                    <div class="dy-track">
                        <div class="dy-track__group">
                            <span class="dy-track__label">这一天</span>
                            <div class="dy-chips">
                                <button
                                    type="button" class="dy-chip dy-chip--wide"
                                    :class="{ 'is-on': record.state === 'period' }"
                                    :disabled="readonly" @click="setState('period')"
                                >来了</button>
                                <button
                                    type="button" class="dy-chip dy-chip--wide"
                                    :class="{ 'is-on': record.state === 'none' }"
                                    :disabled="readonly" @click="setState('none')"
                                >还没来</button>
                            </div>
                            <span v-if="record.state === 'none'" class="dy-track__hint">
                                记了「还没来」之后，在你自己改掉之前，TA 不会当成你已经来了。
                            </span>
                        </div>

                        <div v-if="hasField('flow')" class="dy-track__group">
                            <span class="dy-track__label">经量</span>
                            <DyScale
                                :model-value="record.flow || ''" :options="FLOW_LEVELS"
                                @update:model-value="patch('flow', $event)"
                            />
                        </div>

                        <div v-if="hasField('pain')" class="dy-track__group">
                            <span class="dy-track__label">痛经</span>
                            <DyScale
                                :model-value="record.pain || ''" :options="PAIN_LEVELS"
                                @update:model-value="patch('pain', $event)"
                            />
                            <DyChips
                                v-if="record.pain && record.pain !== 'none'"
                                :model-value="record.painSpots || []" :options="PAIN_SPOTS" multiple
                                @update:model-value="patch('painSpots', $event)"
                            />
                        </div>

                        <div v-if="hasField('mood')" class="dy-track__group">
                            <span class="dy-track__label">情绪</span>
                            <DyChips
                                :model-value="record.mood || ''" :options="MOODS"
                                @update:model-value="patch('mood', $event)"
                            />
                        </div>

                        <div v-if="hasField('symptom')" class="dy-track__group">
                            <span class="dy-track__label">身体症状</span>
                            <DyChips
                                :model-value="record.symptoms || []" :options="SYMPTOMS" multiple
                                @update:model-value="patch('symptoms', $event)"
                            />
                        </div>

                        <div v-if="hasField('discharge')" class="dy-track__group">
                            <span class="dy-track__label">分泌物</span>
                            <DyChips
                                :model-value="record.discharge || ''" :options="DISCHARGE_TYPES"
                                @update:model-value="patch('discharge', $event)"
                            />
                        </div>

                        <div v-if="hasField('temp')" class="dy-track__group">
                            <span class="dy-track__label">基础体温 <span class="dy-track__hint">摄氏度</span></span>
                            <input
                                class="dy-field" type="number" step="0.01" inputmode="decimal"
                                :value="record.temp || ''" :disabled="readonly" placeholder="36.50"
                                @input="patch('temp', $event.target.value)"
                            />
                        </div>

                        <div v-if="hasField('product')" class="dy-track__group">
                            <span class="dy-track__label">卫生用品</span>
                            <DyChips
                                :model-value="record.product || ''" :options="PRODUCT_TYPES"
                                @update:model-value="patch('product', $event)"
                            />
                            <div v-if="record.product" style="display:flex;align-items:center;gap:10px;">
                                <span class="dy-track__hint">今天换了</span>
                                <DyStepper
                                    :model-value="record.productChanges || 0" :min="0" :max="20" suffix=" 次"
                                    @update:model-value="patch('productChanges', $event)"
                                />
                            </div>
                        </div>

                        <div v-if="hasField('meds')" class="dy-track__group">
                            <span class="dy-track__label">用药</span>
                            <input
                                class="dy-field" :value="record.meds || ''" :disabled="readonly"
                                maxlength="40" placeholder="布洛芬 / 热敷 / 什么都没吃"
                                @input="patch('meds', $event.target.value)"
                            />
                        </div>

                        <div v-if="hasField('intimacy')" class="dy-track__group">
                            <div class="dy-row dy-row--static" style="padding:0;">
                                <span class="dy-row__label">同房</span>
                                <span class="dy-row__value"></span>
                                <DySwitch
                                    :model-value="!!record.intimacy"
                                    @update:model-value="patch('intimacy', $event)"
                                />
                            </div>
                            <div v-if="record.intimacy" class="dy-row dy-row--static" style="padding:0;">
                                <span class="dy-row__label">有避孕</span>
                                <span class="dy-row__value"></span>
                                <DySwitch
                                    :model-value="record.intimacyProtected !== false"
                                    @update:model-value="patch('intimacyProtected', $event)"
                                />
                            </div>
                        </div>

                        <div v-if="hasField('note')" class="dy-track__group">
                            <span class="dy-track__label">备注</span>
                            <textarea
                                class="dy-field" rows="2" maxlength="200" :disabled="readonly"
                                :value="record.note || ''" placeholder="今天感觉怎么样"
                                @input="patch('note', $event.target.value)"
                            ></textarea>
                        </div>
                    </div>
                </div>
            </DySection>

            <!-- 统计 -->
            <DySection title="周期">
                <div class="dy-stats">
                    <div v-for="s in stats" :key="s.label" class="dy-stat">
                        <div class="dy-stat__value">{{ s.value }}<span class="dy-stat__label" style="margin:0 0 0 2px;">{{ s.unit }}</span></div>
                        <div class="dy-stat__label">{{ s.label }}</div>
                    </div>
                </div>
                <div v-if="history.length" class="dy-history" style="margin-top:14px;">
                    <div v-for="h in history" :key="h.key" class="dy-history__row">
                        <span class="dy-history__date">{{ h.date }}</span>
                        <span class="dy-history__bar" :style="{ width: h.width }"></span>
                        <span class="dy-history__len">{{ h.len }} 天</span>
                    </div>
                </div>
            </DySection>

            <!-- 设置 -->
            <DySection
                v-if="!readonly"
                title="设置"
                :action="showSettings ? '收起' : '展开'"
                @action="showSettings = !showSettings"
            >
                <div v-if="showSettings" class="dy-card">
                    <DyRow label="推算方式" :clickable="false">
                        <DyChips
                            :model-value="cfg.mode" :allow-empty="false"
                            :options="[
                                { id: 'monthday', name: '每月几号' },
                                { id: 'cycle', name: '按周期' },
                            ]"
                            @update:model-value="setCfg('mode', $event)"
                        />
                    </DyRow>
                    <DyRow v-if="cfg.mode === 'monthday'" label="每个月几号" :clickable="false">
                        <DyStepper
                            :model-value="cfg.startDay" :min="1" :max="31" suffix=" 号"
                            @update:model-value="setCfg('startDay', $event)"
                        />
                    </DyRow>
                    <DyRow v-else label="周期长度" :clickable="false">
                        <DyStepper
                            :model-value="cfg.cycleLength" :min="15" :max="90" suffix=" 天"
                            @update:model-value="setCfg('cycleLength', $event)"
                        />
                    </DyRow>
                    <DyRow label="持续天数" :clickable="false">
                        <DyStepper
                            :model-value="cfg.periodLength" :min="1" :max="15" suffix=" 天"
                            @update:model-value="setCfg('periodLength', $event)"
                        />
                    </DyRow>
                    <DyRow label="提前提醒" :clickable="false">
                        <DyStepper
                            :model-value="cfg.remindDaysBefore" :min="0" :max="10" suffix=" 天"
                            @update:model-value="setCfg('remindDaysBefore', $event)"
                        />
                    </DyRow>
                    <DyRow label="周期不规律" :clickable="false">
                        <DySwitch
                            :model-value="!!cfg.irregular"
                            @update:model-value="setCfg('irregular', $event)"
                        />
                    </DyRow>
                    <DyRow label="TA 的态度" :clickable="false">
                        <DyChips
                            :model-value="cfg.careTone" :options="CARE_TONES" :allow-empty="false"
                            @update:model-value="setCfg('careTone', $event)"
                        />
                    </DyRow>
                    <DyRow
                        label="世界观里的说法" chevron
                        :value="cfg.worldNote || '按当前世界观常识'"
                        :muted="!cfg.worldNote"
                        @click="editWorldNote"
                    />
                    <DyRow
                        label="额外告诉 TA" chevron
                        :value="cfg.customPrompt || '没有'"
                        :muted="!cfg.customPrompt"
                        @click="editCustomPrompt"
                    />
                    <div class="dy-hr"></div>
                    <span class="dy-formrow__label">每天记录哪些</span>
                    <div class="dy-chips" style="margin-top:6px;">
                        <button
                            v-for="f in TRACK_FIELDS" :key="f.id"
                            type="button" class="dy-chip"
                            :class="{ 'is-on': hasField(f.id) }"
                            @click="toggleTrack(f.id)"
                        >{{ f.name }}</button>
                    </div>
                    <div class="dy-hr"></div>
                    <DyBtn variant="danger" block @click="setCfg('enabled', false)">关掉生理期记录</DyBtn>
                </div>
            </DySection>
        </template>
    </div>
    `,
};

export default DyCycle;
