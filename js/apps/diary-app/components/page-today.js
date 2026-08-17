/**
 * 日记 · 今日页
 *
 * 版面顺序就是产品逻辑：
 *   时段条 → 今天这一篇 → 便利贴 → 生理期 → 纪念日/倒计时
 *
 * ── 「日记 or 便利贴」的判定在哪 ──────────────────────────────────
 *
 * **不在这里**。这一页只读 `store.resolveWriteKind()` 的结果。
 * 判定收在 store 一处的原因：UI 显示的类型和实际存进去的类型必须一致，
 * 各判各的迟早出现「界面说在写日记、存下来是便利贴」。
 */

import * as store from '../store.js';
import { presets as LP } from '@/src/core/presets/index.js';
import { SHARED_COMPONENTS } from './shared.js';
import {
    ENTRY_KIND, MOODS, MARKER_KIND, CYCLE_STATE, OWNER_KIND,
} from '../constants.js';
import {
    todayKey, formatDateLabel, weekdayLabel, describeWindow,
    minutesUntilWindow, minutesLeftInWindow, countWords,
    daysFromToday, compareDateKey,
} from '../utils.js';
import { describeState } from '../services/cycle-service.js';

/** 分钟数 → 「3 小时 20 分」/「25 分钟」 */
function humanMinutes(mins) {
    if (mins == null) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
    return `${m} 分钟`;
}

export const DyToday = {
    name: 'DyToday',
    components: { ...SHARED_COMPONENTS },
    data() {
        return {
            MOODS,
            editing: false,
            draft: '',
            draftMood: '',
            quickNote: '',
        };
    },
    computed: {
        state() { return store.getState(); },
        space() { return store.getActiveSpace(); },
        isMine() { return this.space?.ownerKind === OWNER_KIND.USER; },
        today() { return todayKey(); },

        dayNum() { return String(Number(this.today.slice(8, 10))); },
        dateRest() {
            return `${Number(this.today.slice(5, 7))}月 · ${weekdayLabel(this.today)}`;
        },

        /** 读 minuteTick 让这些随时间自动重算 */
        writeKind() {
            void this.state.minuteTick;
            return store.resolveWriteKind(this.space);
        },
        windowOpen() { return this.writeKind === ENTRY_KIND.DIARY; },
        windowText() { return this.space ? describeWindow(this.space.windowStart) : ''; },
        windowHint() {
            void this.state.minuteTick;
            if (!this.space) return '';
            if (this.windowOpen) {
                const left = minutesLeftInWindow(this.space.windowStart);
                return left != null ? `日记时段，还剩 ${humanMinutes(left)}` : '日记时段';
            }
            const until = minutesUntilWindow(this.space.windowStart);
            return until != null
                ? `现在记下的是便利贴，${humanMinutes(until)}后开放日记`
                : '今天的日记时段已经过了，现在记下的是便利贴';
        },

        entry() { return store.getEntry(this.space?.id, this.today); },
        entryWords() { return this.entry ? countWords(this.entry.content) : 0; },
        canRevert() { return (this.entry?.revisions?.length || 0) > 0; },

        notes() { return store.notesOf(this.space?.id, this.today); },

        cycleInfo() {
            // 生理期永远看「我」的本子 —— AI 没有生理期，但它的本子里也该看得到
            return store.getCycleInfo(this.isMine ? this.space?.id : store.getUserSpaceId());
        },
        cycleText() { return describeState(this.cycleInfo); },
        cycleSub() {
            const info = this.cycleInfo;
            if (!info.enabled) return '';
            if (info.confirmedToday === CYCLE_STATE.NONE) return '今天记了「还没来」';
            if (info.confirmedToday === CYCLE_STATE.PERIOD) return '今天记了「来了」';
            return '还没记今天';
        },
        showCycle() { return this.cycleInfo.enabled; },

        /** 小组件：最近的两条倒计时 + 最近的两条纪念日 */
        widgets() {
            const list = store.markersOf(this.space?.id);
            const out = [];
            const today = this.today;

            const future = list
                .filter((m) => m.kind === MARKER_KIND.COUNTDOWN && m.date && compareDateKey(m.date, today) >= 0)
                .map((m) => ({ m, d: daysFromToday(m.date) }))
                .filter((x) => x.d != null)
                .sort((a, b) => a.d - b.d)
                .slice(0, 2);
            for (const { m, d } of future) {
                out.push({
                    id: m.id, title: m.title, date: formatDateLabel(m.date, { withYear: true }),
                    value: d, unit: d === 0 ? '就是今天' : '天后', today: d === 0,
                });
            }

            const past = list
                .filter((m) => m.kind === MARKER_KIND.ANNIVERSARY && m.date && compareDateKey(m.date, today) <= 0)
                .map((m) => ({ m, d: -(daysFromToday(m.date) || 0) }))
                .sort((a, b) => (b.m.pinned ? 1 : 0) - (a.m.pinned ? 1 : 0) || a.d - b.d)
                .slice(0, 4 - out.length);
            for (const { m, d } of past) {
                out.push({
                    id: m.id, title: m.title, date: formatDateLabel(m.date, { withYear: true }),
                    value: d, unit: d === 0 ? '就是今天' : '天了', today: d === 0,
                });
            }
            return out;
        },

        busy() { return this.state.busy; },
        aiLabel() { return this.isMine ? '让 TA 替我写' : '让 TA 写'; },
    },
    methods: {
        // ── 手写 ────────────────────────────
        startEdit() {
            this.draft = this.entry?.content || '';
            this.draftMood = this.entry?.mood || '';
            this.editing = true;
            this.$nextTick(() => this.$refs.composer?.focus?.());
        },
        cancelEdit() {
            this.editing = false;
            this.draft = '';
            this.draftMood = '';
        },
        saveEdit() {
            const text = this.draft.trim();
            if (!text) { store.toast('还没写东西'); return; }
            const saved = store.saveTodayEntry({
                spaceId: this.space.id,
                content: text,
                mood: this.draftMood,
                author: this.space.ownerKind,
            });
            this.editing = false;
            this.draft = '';
            store.toast(saved?.kind === ENTRY_KIND.NOTE ? '记成便利贴了' : '写好了');
        },
        draftWords() { return countWords(this.draft); },

        pickMood(id) {
            this.draftMood = this.draftMood === id ? '' : id;
        },
        setEntryMood(id) {
            if (!this.entry) return;
            store.upsertEntry({
                spaceId: this.space.id, date: this.today,
                content: this.entry.content,
                mood: this.entry.mood === id ? '' : id,
            });
        },

        // ── AI ──────────────────────────────
        async askAi() {
            if (this.busy) return;
            const hint = await LP.modals.prompt({
                title: this.windowOpen ? '让 TA 写今天的日记' : '让 TA 写一张便利贴',
                message: '想让 TA 写点什么？不写也行，TA 会自己看着办。',
                placeholder: '例如：写写今天的考试',
                multiline: true,
                maxLength: 120,
                okLabel: '开始写',
            });
            // null = 点了取消；空串 = 点了确定但没写，这是允许的
            if (hint === null) return;
            const result = await store.generateEntry({ spaceId: this.space.id, hint: hint.trim() });
            this.reportResult(result);
        },

        /**
         * 重 roll。
         *
         * 产品要求：「重 roll 的时候给用户弹窗，用户可以提修改意见，不提也行」。
         * 所以这里区分「取消」和「没填就确定」—— 后者是合法路径。
         */
        async reroll() {
            if (this.busy || !this.entry) return;
            const wish = await LP.modals.prompt({
                title: '重写一遍',
                message: '有什么想改的？不写就让 TA 自由发挥。',
                placeholder: '例如：写短一点，别提工作',
                multiline: true,
                maxLength: 120,
                okLabel: '重写',
            });
            if (wish === null) return;
            const result = await store.generateEntry({
                spaceId: this.space.id,
                // 空的 wish 传 undefined，让 prompt-builder 跳过「这次的要求」那一段
                wish: wish.trim() || undefined,
            });
            this.reportResult(result, '重写好了');
        },

        reportResult(result, okText) {
            if (!result?.ok) {
                LP.modals.alert({ title: '没写成', message: result?.error || '再试一次' });
                return;
            }
            const extra = result.markers?.length
                ? `，顺手记下了 ${result.markers.length} 个日子`
                : '';
            const base = okText || (result.kind === ENTRY_KIND.NOTE ? '记了一张便利贴' : '写好了');
            store.toast(base + extra);
        },

        revert() {
            if (store.revertEntry(this.space.id, this.today)) store.toast('翻回上一版了');
        },

        async removeEntry() {
            const ok = await LP.modals.confirm({
                title: '删掉今天这篇',
                message: '删了就找不回来了。',
                okLabel: '删掉',
                danger: true,
            });
            if (!ok) return;
            store.removeEntryRecord(this.space.id, this.today);
            store.toast('删了');
        },

        // ── 便利贴 ──────────────────────────
        addQuickNote() {
            const text = this.quickNote.trim();
            if (!text) return;
            store.addNote({ spaceId: this.space.id, content: text, author: this.space.ownerKind });
            this.quickNote = '';
        },
        async removeNote(id) {
            const ok = await LP.modals.confirm({ title: '撕掉这张', message: '', okLabel: '撕掉', danger: true });
            if (ok) store.removeNote(id);
        },
        noteTime(note) {
            const d = new Date(note.createdAt || Date.now());
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        },

        // ── 跳转 ────────────────────────────
        goCycle() { store.setTab('cycle'); },
        goPlans() { store.setTab('plans'); },
        markCycle(state) {
            store.markToday(state, this.isMine ? this.space.id : store.getUserSpaceId());
            store.toast(state === CYCLE_STATE.PERIOD ? '记下了' : '记了「还没来」');
        },

        moodName(id) { return MOODS.find((m) => m.id === id)?.name || ''; },
    },
    template: `
    <div>
        <div class="dy-dateline">
            <span class="dy-dateline__day">{{ dayNum }}</span>
            <span class="dy-dateline__rest">{{ dateRest }}</span>
        </div>

        <!-- 时段条 -->
        <div class="dy-window" :class="{ 'is-open': windowOpen }">
            <DyIcon :name="windowOpen ? 'pen' : 'note'" />
            <span class="dy-window__main">{{ windowHint }}</span>
            <span class="dy-window__time">{{ windowText }}</span>
        </div>

        <DyBusy v-if="busy" :text="busy" style="margin-bottom:16px;" />

        <!-- 今天这一篇 -->
        <DySection :title="windowOpen ? '今天' : '今天的日记'">
            <!-- 编辑中 -->
            <div v-if="editing" class="dy-composer">
                <textarea
                    ref="composer" class="dy-composer__input" v-model="draft"
                    :placeholder="windowOpen ? '今天怎么样？' : '随手记一句'"
                ></textarea>
                <div class="dy-moods">
                    <button
                        v-for="m in MOODS" :key="m.id"
                        type="button" class="dy-mood-pick"
                        :class="{ 'is-on': draftMood === m.id }"
                        :data-mood="m.id"
                        @click="pickMood(m.id)"
                    >{{ m.name }}</button>
                </div>
                <div class="dy-composer__bar">
                    <span class="dy-composer__count">{{ draftWords() }} 字</span>
                    <span class="dy-composer__actions">
                        <DyBtn size="sm" @click="cancelEdit">取消</DyBtn>
                        <DyBtn size="sm" variant="primary" icon-name="save" @click="saveEdit">存下</DyBtn>
                    </span>
                </div>
            </div>

            <!-- 已有 -->
            <article v-else-if="entry" class="dy-entry">
                <header class="dy-entry__head">
                    <span class="dy-entry__kind">日记</span>
                    <button
                        v-for="m in MOODS" :key="m.id"
                        v-show="entry.mood === m.id"
                        type="button" class="dy-entry__mood" :data-mood="m.id"
                        style="border:0;background:transparent;cursor:pointer;padding:0;"
                        @click="setEntryMood(m.id)"
                    >{{ m.name }}</button>
                    <span class="dy-entry__by">{{ entry.source === 'ai' ? 'TA 代笔' : '' }}</span>
                </header>
                <div class="dy-entry__body">{{ entry.content }}</div>
                <footer class="dy-entry__foot">
                    <DyBtn size="sm" icon-name="edit" @click="startEdit">改</DyBtn>
                    <DyBtn size="sm" icon-name="refresh" :disabled="!!busy" @click="reroll">重写</DyBtn>
                    <DyBtn v-if="canRevert" size="sm" icon-name="left" @click="revert">上一版</DyBtn>
                    <span class="dy-entry__spacer"></span>
                    <DyBtn size="sm" variant="danger" icon-name="trash" @click="removeEntry">删</DyBtn>
                </footer>
            </article>

            <!-- 空白 -->
            <div v-else class="dy-entry">
                <div class="dy-entry__blank">
                    <template v-if="windowOpen">今天还没写。</template>
                    <template v-else>今天的日记时段还没到<br />现在写下的会记成便利贴</template>
                </div>
                <footer class="dy-entry__foot">
                    <DyBtn size="sm" icon-name="pen" @click="startEdit">
                        {{ windowOpen ? '自己写' : '记一张便利贴' }}
                    </DyBtn>
                    <span class="dy-entry__spacer"></span>
                    <DyBtn size="sm" icon-name="quill" :disabled="!!busy" @click="askAi">{{ aiLabel }}</DyBtn>
                </footer>
            </div>
        </DySection>

        <!-- 生理期 -->
        <DySection v-if="showCycle" title="今天的身体">
            <button type="button" class="dy-cyclemini" @click="goCycle">
                <span class="dy-cyclemini__dot" :data-state="cycleInfo.state"></span>
                <span class="dy-cyclemini__main">
                    <span class="dy-cyclemini__state">{{ cycleText }}</span>
                    <span class="dy-cyclemini__sub">{{ cycleSub }}</span>
                </span>
            </button>
            <div
                v-if="isMine && cycleInfo.confirmedToday === null"
                class="dy-btnbar" style="margin-top:8px;"
            >
                <DyBtn size="sm" @click.stop="markCycle('period')">今天来了</DyBtn>
                <DyBtn size="sm" @click.stop="markCycle('none')">还没来</DyBtn>
            </div>
        </DySection>

        <!-- 便利贴 -->
        <DySection title="便利贴" :note="notes.length ? notes.length + ' 张' : ''">
            <div class="dy-quicknote" style="margin-bottom:8px;">
                <textarea
                    class="dy-quicknote__input" v-model="quickNote" rows="1"
                    placeholder="随手记一句"
                    @keydown.enter.exact.prevent="addQuickNote"
                ></textarea>
                <DyBtn size="sm" variant="ghost" icon-name="plus" :disabled="!quickNote.trim()" @click="addQuickNote" />
            </div>

            <div v-if="notes.length" class="dy-notes">
                <div v-for="n in notes" :key="n.id" class="dy-note">
                    <span class="dy-note__text">{{ n.content }}</span>
                    <span class="dy-note__meta">
                        <span>{{ noteTime(n) }}</span>
                        <button type="button" class="dy-note__del" @click="removeNote(n.id)">
                            <DyIcon name="close" />
                        </button>
                    </span>
                </div>
            </div>
            <DyEmpty v-else icon-name="note" text="今天还没有便利贴" />
        </DySection>

        <!-- 纪念日 / 倒计时 -->
        <DySection title="日子" action="全部" @action="goPlans">
            <div v-if="widgets.length" class="dy-widgets">
                <button
                    v-for="w in widgets" :key="w.id"
                    type="button" class="dy-widget" :class="{ 'is-today': w.today }"
                    @click="goPlans"
                >
                    <span class="dy-widget__title">{{ w.title }}</span>
                    <span class="dy-widget__num">
                        <template v-if="!w.today">
                            <span class="dy-widget__value">{{ w.value }}</span>
                            <span class="dy-widget__unit">{{ w.unit }}</span>
                        </template>
                        <span v-else class="dy-widget__unit">{{ w.unit }}</span>
                    </span>
                    <span class="dy-widget__date">{{ w.date }}</span>
                </button>
            </div>
            <DyEmpty v-else icon-name="flag" text="还没有记下什么日子" />
        </DySection>
    </div>
    `,
};

export default DyToday;
