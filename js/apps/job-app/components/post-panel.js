/**
 * 灯塔 · 一份工作的详情页
 *
 * 这一页把「用户可以完整给自己编辑工作」那条需求全部落在一个地方：
 *
 *   概览    今天能不能演、这个月拿了多少、下一笔什么时候到
 *   日历    工作日期表（点一天 → 演 / 改排班）
 *   记录    这份工作的所有小剧场
 *   设置    基本信息 / 薪资 / 排班 / 同事与不对付的人 / 小剧场专属提示词
 *
 * ── 为什么设置和日历不分成两页 ────────────────────────────────────
 *
 * 改排班之后要立刻在日历上看到结果。分两页的话用户得来回切，
 * 而「我把周三取消了对不对」这种确认，隔一次跳转就不成立了。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { JbCalendar } from './calendar.js';
import {
    PAY_MODES, SHIFT_MODES, WEEKDAYS, JOB_CATEGORIES, THEATER_LENGTHS,
} from '../constants.js';
import { describeShift, daysToPayday, nextPayday, isWorkday } from '../services/schedule-service.js';
import { describePay, labelOfLevel, computeDaily } from '../services/payroll-service.js';
import { todayKey, fmtDay, fmtDayShort, asArray, money } from '../utils.js';
import { defaultTheaterPrompt } from '../services/prompt-builder.js';
import { listWorldAis } from '../services/world-context.js';

const TABS = [
    { id: 'today', label: '今天' },
    { id: 'cal', label: '日历' },
    { id: 'log', label: '记录' },
    { id: 'set', label: '设置' },
];

export const JbPostPanel = {
    name: 'JbPostPanel',
    components: { ...UI, JbCalendar },
    emits: ['close'],
    data() {
        return {
            tab: 'today',
            pickedDay: todayKey(),
            extra: '',
            promptDraft: null,   // null = 没在编辑
        };
    },
    computed: {
        s() { return store.getState(); },
        post() { return store.currentPost(); },
        currency() { return this.s.identity.currency; },
        tabs() { return TABS; },
        payModes() { return PAY_MODES; },
        shiftModes() { return SHIFT_MODES; },
        weekdays() { return WEEKDAYS; },
        categories() { return JOB_CATEGORIES.filter((c) => c !== '全部'); },
        lengths() { return THEATER_LENGTHS; },
        busy() { return this.s.loading.theater; },

        theaters() { return this.post ? store.theatersOf(this.post.id) : []; },
        playedDays() { return this.post ? store.playedDaysOf(this.post.id) : []; },

        check() { return this.post ? store.playCheck(this.post, this.pickedDay) : { ok: false, text: '' }; },
        pickedTheater() {
            return this.theaters.find((t) => t.day === this.pickedDay) || null;
        },
        pickedIsWorkday() {
            return this.post ? isWorkday(this.post.shift, this.pickedDay) : false;
        },

        payLine() { return this.post ? describePay(this.post.pay, this.currency) : ''; },
        shiftLine() { return this.post ? describeShift(this.post.shift) : ''; },
        paydayLine() {
            const pay = this.post?.pay;
            if (pay?.mode !== 'monthly') return '';
            const n = daysToPayday(pay.payDay);
            const day = nextPayday(pay.payDay);
            if (n < 0) return '';
            if (n === 0) return `今天就是发薪日（${fmtDayShort(day)}）`;
            return `下一笔 ${fmtDayShort(day)} 到账，还有 ${n} 天`;
        },
        /** 这份工作一共挣了多少 —— 从小剧场里累计，月结的部分不在这儿 */
        earnedFromDays() {
            return money(this.theaters.reduce((sum, t) => sum + money(t.paid), 0));
        },

        ais() { return listWorldAis(this.s.identity.world); },
        colleagueIds() { return asArray(this.post?.colleagueIds); },
        rivalIds() { return asArray(this.post?.rivalIds); },

        promptText() {
            if (this.promptDraft !== null) return this.promptDraft;
            return this.post?.theaterPrompt || '';
        },
        promptDirty() {
            return this.promptDraft !== null && this.promptDraft !== (this.post?.theaterPrompt || '');
        },
        /**
         * 当前模式的说明文字。
         * 走 find 兜底而不是模板里直接 `.detail` —— 老数据里可能有已经删掉的
         * mode，模板里点空对象会整页白屏，而这种数据只有老用户才有。
         */
        payHint() {
            return PAY_MODES.find((m) => m.id === this.post?.pay?.mode)?.detail || '';
        },
        shiftHint() {
            return SHIFT_MODES.find((m) => m.id === this.post?.shift?.mode)?.detail || '';
        },
        /** 日结/打赏时，把「不同评级各拿多少」直接算给用户看 */
        payPreview() {
            const pay = this.post?.pay;
            if (!pay || pay.mode === 'monthly') return [];
            return ['bad', 'poor', 'ok', 'good', 'great'].map((lv) => ({
                id: lv,
                label: labelOfLevel(lv),
                value: computeDaily(pay, lv),
            }));
        },
    },
    methods: {
        close() { store.closePost(); },
        clearError() { store.clearError(); },
        fmtDay,
        fmtDayShort,
        levelLabel(lv) { return labelOfLevel(lv); },

        // ── 今天 / 日历 ──────────────────────────────
        pickDay(day) {
            if (!day) return;
            this.pickedDay = day;
            this.tab = 'cal';
        },
        stepCal(next) { store.setCalendar(next.year, next.month); },
        async toggleDay() {
            await store.toggleShiftDay(this.post, this.pickedDay);
        },
        async play() {
            const t = await store.generateTheater(this.post, this.pickedDay, {
                extra: this.extra.trim(),
                length: this.s.profile?.theaterLength,
            });
            if (t) this.extra = '';
        },
        openTheater(id) { store.openTheater(id); },

        // ── 设置 ────────────────────────────────────
        patch(key, value) {
            if (!this.post) return;
            this.post[key] = value;
        },
        patchPay(key, value) {
            if (!this.post) return;
            this.post.pay = { ...this.post.pay, [key]: value };
        },
        patchShift(key, value) {
            if (!this.post) return;
            this.post.shift = { ...this.post.shift, [key]: value };
        },
        toggleWeekday(id) {
            const arr = [...asArray(this.post?.shift?.weekdays)];
            const i = arr.indexOf(id);
            if (i >= 0) arr.splice(i, 1);
            else arr.push(id);
            this.patchShift('weekdays', arr.sort((a, b) => a - b));
        },
        toggleCast(kind, id) {
            if (!this.post) return;
            const key = kind === 'rival' ? 'rivalIds' : 'colleagueIds';
            const other = kind === 'rival' ? 'colleagueIds' : 'rivalIds';
            const arr = [...asArray(this.post[key])];
            const i = arr.indexOf(id);
            if (i >= 0) arr.splice(i, 1);
            else {
                arr.push(id);
                // 同一个人不能既是同事又是敌对 —— 两个都勾上时 prompt 里会
                // 出现「同事X」和「不对付X」两行，AI 会当成两个人
                this.post[other] = asArray(this.post[other]).filter((x) => x !== id);
            }
            this.post[key] = arr;
        },
        async saveAll() {
            await store.updatePost(this.post, {});
        },

        // ── 专属提示词 ──────────────────────────────
        editPrompt(v) { this.promptDraft = v; },
        async savePrompt() {
            await store.updatePost(this.post, { theaterPrompt: this.promptDraft ?? '' });
            this.promptDraft = null;
        },
        cancelPrompt() { this.promptDraft = null; },
        restorePrompt() {
            this.promptDraft = defaultTheaterPrompt(this.post || {});
        },

        // ── 辞职 ────────────────────────────────────
        resign() {
            const post = this.post;
            if (!post) return;
            const api = typeof window !== 'undefined' ? window.__phoneConfirm : null;
            const doIt = () => store.resign(post.id);
            if (!api?.request) { doIt(); return; }
            api.request({
                title: `辞掉「${post.title}」？`,
                text: '以后不再有这份工作的排班和收入。已经演过的小剧场会留着。',
                confirmLabel: '辞了',
                danger: true,
                onConfirm: doIt,
            });
        },
    },
    template: `
        <jb-panel :title="post ? post.title : '工作'" @close="close">
            <div v-if="!post" class="jb-empty"><p class="jb-empty__title">这份工作不见了</p></div>

            <template v-else>
                <jb-error :text="s.error" @close="clearError" />

                <div class="jb-seg jb-post__tabs">
                    <button
                        v-for="t in tabs" :key="t.id"
                        class="jb-seg__btn" :class="{ 'is-on': tab === t.id }"
                        @click="tab = t.id"
                    >{{ t.label }}</button>
                </div>

                <!-- ── 今天 ────────────────────────────────── -->
                <template v-if="tab === 'today'">
                    <section class="jb-card jb-card--pad jb-sum">
                        <div class="jb-sum__row">
                            <div>
                                <p class="jb-sum__k">这个月从这份工作</p>
                                <jb-money :value="earnedFromDays" :currency="currency" size="lg" tone="in" />
                            </div>
                            <div class="jb-sum__right">
                                <p class="jb-sum__k">钱包里现在</p>
                                <jb-money :value="s.balance" :currency="currency" tone="coin" />
                            </div>
                        </div>
                        <p v-if="paydayLine" class="jb-sum__pay">{{ paydayLine }}</p>
                        <p class="jb-sum__note">{{ payLine }} · {{ shiftLine }}</p>
                    </section>

                    <jb-section title="今天">
                        <div class="jb-card jb-card--pad">
                            <p class="jb-today__day">{{ fmtDay(pickedDay) }}</p>

                            <template v-if="pickedTheater">
                                <p class="jb-today__done">
                                    已经演过了 —— {{ levelLabel(pickedTheater.performance.level) }}
                                    <b v-if="pickedTheater.paid > 0">+{{ pickedTheater.paid }} {{ currency }}</b>
                                </p>
                                <jb-btn variant="soft" block icon="theater" @click="openTheater(pickedTheater.id)">
                                    去看这一天
                                </jb-btn>
                            </template>

                            <template v-else-if="!check.ok">
                                <p class="jb-today__blocked">{{ check.text }}</p>
                                <p class="jb-panel__note">
                                    休息日演不了。要改就去「日历」那一栏，或者在「设置」里改排班。
                                </p>
                            </template>

                            <template v-else>
                                <p class="jb-panel__note">
                                    演一场今天的班。演完会自动写一段当天记录，以后几天的剧情会接着它走。
                                </p>
                                <jb-field label="想让今天发生点什么（可以不写）">
                                    <jb-input v-model="extra" placeholder="比如：被临时叫去顶班" :maxlength="40" />
                                </jb-field>
                                <jb-btn variant="primary" size="lg" block icon="theater" :loading="busy" @click="play">
                                    开始今天
                                </jb-btn>
                            </template>
                        </div>
                    </jb-section>

                    <jb-loading v-if="busy" kind="theater" />

                    <jb-section v-if="theaters.length" title="最近几天">
                        <button
                            v-for="t in theaters.slice(0, 5)" :key="t.id"
                            class="jb-card jb-logitem"
                            @click="openTheater(t.id)"
                        >
                            <span class="jb-logitem__day">{{ fmtDayShort(t.day) }}</span>
                            <span class="jb-logitem__title">{{ t.title }}</span>
                            <span class="jb-logitem__lv">{{ levelLabel(t.performance.level) }}</span>
                            <span v-if="t.paid > 0" class="jb-logitem__pay">+{{ t.paid }}</span>
                        </button>
                    </jb-section>
                </template>

                <!-- ── 日历 ────────────────────────────────── -->
                <template v-else-if="tab === 'cal'">
                    <jb-calendar
                        :year="s.calendar.year" :month="s.calendar.month"
                        :shift="post.shift" :played-days="playedDays" :selected="pickedDay"
                        @step="stepCal" @pick="pickedDay = $event"
                    />

                    <section class="jb-card jb-card--pad jb-daybox">
                        <p class="jb-daybox__day">
                            {{ fmtDay(pickedDay) }}
                            <span class="jb-tag" :class="pickedIsWorkday ? 'jb-tag--ok' : ''">
                                {{ pickedIsWorkday ? '上班' : '休息' }}
                            </span>
                        </p>

                        <div v-if="pickedTheater" class="jb-daybox__done">
                            <p>{{ pickedTheater.title }} · {{ levelLabel(pickedTheater.performance.level) }}</p>
                            <jb-btn size="sm" variant="soft" @click="openTheater(pickedTheater.id)">去看这一天</jb-btn>
                        </div>

                        <div class="jb-daybox__btns">
                            <jb-btn
                                v-if="!pickedTheater"
                                variant="primary" :disabled="!check.ok" :loading="busy" icon="theater"
                                @click="play"
                            >{{ check.ok ? '演这一天' : check.text }}</jb-btn>
                            <jb-btn variant="line" icon="calendar" @click="toggleDay">
                                {{ post.shift.mode === 'custom'
                                    ? (pickedIsWorkday ? '这天不上了' : '这天要上班')
                                    : (pickedIsWorkday ? '这天请假' : '销假，照常上') }}
                            </jb-btn>
                        </div>
                        <p class="jb-panel__note">
                            改这一天只影响这一天。要改整体规律去「设置 → 排班」。
                        </p>
                    </section>
                </template>

                <!-- ── 记录 ────────────────────────────────── -->
                <template v-else-if="tab === 'log'">
                    <jb-empty
                        v-if="!theaters.length"
                        icon="scroll"
                        title="还没有工作记录"
                        desc="在「今天」那一栏演一场，这里就会有第一条。"
                    />
                    <template v-else>
                        <jb-section :title="'共 ' + theaters.length + ' 天'" sub="点进去可以改、可以重演">
                            <button
                                v-for="t in theaters" :key="t.id"
                                class="jb-card jb-logitem"
                                @click="openTheater(t.id)"
                            >
                                <span class="jb-logitem__day">{{ fmtDayShort(t.day) }}</span>
                                <span class="jb-logitem__title">{{ t.title }}</span>
                                <span class="jb-logitem__lv">{{ levelLabel(t.performance.level) }}</span>
                                <span v-if="t.paid > 0" class="jb-logitem__pay">+{{ t.paid }}</span>
                            </button>
                        </jb-section>

                        <jb-section title="工作梗概" sub="以后生成小剧场时会读它">
                            <div class="jb-card jb-card--pad jb-digests">
                                <p v-for="t in theaters.filter(x => x.digest)" :key="t.id" class="jb-digest">
                                    <b>{{ fmtDayShort(t.day) }}</b>{{ t.digest }}
                                </p>
                                <p v-if="!theaters.some(x => x.digest)" class="jb-panel__note">
                                    还没有梗概。梗概是演完之后自动写的，如果哪天没写出来，
                                    可以进那一天点「重新写梗概」。
                                </p>
                            </div>
                        </jb-section>
                    </template>
                </template>

                <!-- ── 设置 ────────────────────────────────── -->
                <template v-else>
                    <jb-section title="基本信息">
                        <div class="jb-card jb-card--pad">
                            <jb-field label="职位名" hint="改了之后 nook 人设里的「当前职业」也会跟着变">
                                <jb-input :model-value="post.title" :maxlength="20"
                                    @update:model-value="patch('title', $event)" />
                            </jb-field>
                            <jb-field label="单位">
                                <jb-input :model-value="post.company" :maxlength="20"
                                    @update:model-value="patch('company', $event)" />
                            </jb-field>
                            <jb-field label="地点">
                                <jb-input :model-value="post.place" :maxlength="20"
                                    @update:model-value="patch('place', $event)" />
                            </jb-field>
                            <jb-field label="日常在做什么" hint="这句会进小剧场的提示词，写得越具体越不容易跑题">
                                <jb-textarea :model-value="post.duty" :rows="3"
                                    @update:model-value="patch('duty', $event)" />
                            </jb-field>
                            <jb-field label="备注（可以不写）">
                                <jb-textarea :model-value="post.note" :rows="2"
                                    placeholder="比如：老板脾气不好 / 这份是瞒着家里做的"
                                    @update:model-value="patch('note', $event)" />
                            </jb-field>
                        </div>
                    </jb-section>

                    <jb-section title="怎么给钱">
                        <div class="jb-card jb-card--pad">
                            <div class="jb-seg">
                                <button
                                    v-for="m in payModes" :key="m.id"
                                    class="jb-seg__btn" :class="{ 'is-on': post.pay.mode === m.id }"
                                    @click="patchPay('mode', m.id)"
                                >{{ m.label }}</button>
                            </div>
                            <p class="jb-panel__note">{{ payHint }}</p>

                            <template v-if="post.pay.mode === 'monthly'">
                                <jb-field label="每月几号发" hint="1~28。超过当月天数会按当月最后一天算">
                                    <jb-input :model-value="post.pay.payDay" type="number"
                                        @update:model-value="patchPay('payDay', Number($event) || 1)" />
                                </jb-field>
                                <jb-field label="一个月多少" :hint="'单位：' + currency">
                                    <jb-input :model-value="post.pay.amount" type="number"
                                        @update:model-value="patchPay('amount', Number($event) || 0)" />
                                </jb-field>
                            </template>

                            <template v-else>
                                <jb-field v-if="post.pay.mode === 'daily'" label="保底（表现再差也有）" :hint="'单位：' + currency">
                                    <jb-input :model-value="post.pay.dailyBase" type="number"
                                        @update:model-value="patchPay('dailyBase', Number($event) || 0)" />
                                </jb-field>
                                <jb-field label="一天最多" :hint="'单位：' + currency">
                                    <jb-input :model-value="post.pay.dailyMax" type="number"
                                        @update:model-value="patchPay('dailyMax', Number($event) || 0)" />
                                </jb-field>
                                <div class="jb-paypreview">
                                    <span v-for="p in payPreview" :key="p.id" class="jb-paypreview__cell">
                                        <i>{{ p.label }}</i><b>{{ p.value }}</b>
                                    </span>
                                </div>
                                <p class="jb-panel__note">
                                    上面是各档表现实际到手的数。评级由小剧场里当天的表现决定，演完立刻进钱包。
                                </p>
                            </template>
                        </div>
                    </jb-section>

                    <jb-section title="什么时候上班">
                        <div class="jb-card jb-card--pad">
                            <div class="jb-seg">
                                <button
                                    v-for="m in shiftModes" :key="m.id"
                                    class="jb-seg__btn" :class="{ 'is-on': post.shift.mode === m.id }"
                                    @click="patchShift('mode', m.id)"
                                >{{ m.label }}</button>
                            </div>
                            <p class="jb-panel__note">{{ shiftHint }}</p>

                            <div v-if="post.shift.mode === 'weekly'" class="jb-weekpick">
                                <button
                                    v-for="w in weekdays" :key="w.id"
                                    class="jb-weekpick__btn"
                                    :class="{ 'is-on': post.shift.weekdays.includes(w.id) }"
                                    @click="toggleWeekday(w.id)"
                                >{{ w.short }}</button>
                            </div>

                            <p v-else-if="post.shift.mode === 'custom'" class="jb-panel__note">
                                去「日历」那一栏点日子。现在点亮了 {{ post.shift.days.length }} 天。
                            </p>
                        </div>
                    </jb-section>

                    <jb-section title="这份工作里有谁" sub="决定小剧场里谁会出场">
                        <div class="jb-card jb-card--pad">
                            <jb-field label="同事" hint="和你在同一条船上的人">
                                <div v-if="!ais.length" class="jb-panel__note">
                                    这个世界观下还没有 AI 人设。去「设置 → 人设」建几张卡。
                                </div>
                                <div v-else class="jb-picks">
                                    <button
                                        v-for="a in ais" :key="'c' + a.id"
                                        class="jb-pick" :class="{ 'is-on': colleagueIds.includes(a.id) }"
                                        @click="toggleCast('mate', a.id)"
                                    >
                                        {{ a.name }}
                                        <i v-if="a.occupation" class="jb-pick__role">{{ a.occupation }}</i>
                                    </button>
                                </div>
                            </jb-field>

                            <jb-field label="不对付的人" hint="会真的制造摩擦，不会无缘无故和解">
                                <div v-if="ais.length" class="jb-picks">
                                    <button
                                        v-for="a in ais" :key="'r' + a.id"
                                        class="jb-pick" :class="{ 'is-rival': rivalIds.includes(a.id) }"
                                        @click="toggleCast('rival', a.id)"
                                    >
                                        {{ a.name }}
                                        <i v-if="a.occupation" class="jb-pick__role">{{ a.occupation }}</i>
                                    </button>
                                </div>
                            </jb-field>

                            <p class="jb-panel__note">
                                同一个人只能选一边。勾了「不对付」会自动从「同事」里去掉 ——
                                两边都勾的话提示词里会出现两行同名的人，AI 会当成两个人。
                            </p>
                        </div>
                    </jb-section>

                    <jb-section title="这份工作的小剧场提示词" sub="只影响这份工作">
                        <div class="jb-card jb-card--pad">
                            <p class="jb-panel__desc">
                                入职时按这份工作生成的一段。它插在通用写法之后，
                                所以同样的指令，这里写的赢。
                            </p>
                            <jb-textarea
                                :model-value="promptText" :rows="7"
                                @update:model-value="editPrompt"
                            />
                            <div class="jb-prompt__btns">
                                <jb-btn size="sm" variant="ghost" icon="undo" @click="restorePrompt">复原</jb-btn>
                                <jb-btn v-if="promptDraft !== null" size="sm" variant="ghost" @click="cancelPrompt">
                                    取消
                                </jb-btn>
                                <jb-btn
                                    size="sm" variant="primary" :disabled="!promptDirty" @click="savePrompt"
                                >保存</jb-btn>
                            </div>
                        </div>
                    </jb-section>

                    <div class="jb-post__actions">
                        <jb-btn variant="primary" size="lg" block icon="check" @click="saveAll">
                            保存改动
                        </jb-btn>
                        <jb-btn variant="ghost" icon="exit" block @click="resign">辞掉这份工作</jb-btn>
                    </div>
                </template>
            </template>
        </jb-panel>
    `,
};
