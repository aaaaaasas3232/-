/**
 * 日记 · 归档
 *
 * 按月列出这个日记本里写过的东西。日记和便利贴混在一条时间线上，
 * 靠左边那一列的样式区分 —— 分成两个 tab 的话，用户想回忆「那天前后
 * 发生了什么」就得来回切。
 *
 * 点某一天进详情，可以补写 / 修改 / 删除。补写往期日记走的是
 * `store.saveTodayEntry({ date })`，那条路径会把「非今天 = 日记」的
 * 判断做掉（补写的语义就是日记，不是随手记）。
 */

import * as store from '../store.js';
import { presets as LP } from '@/src/core/presets/index.js';
import { SHARED_COMPONENTS } from './shared.js';
import { MOODS, OWNER_KIND } from '../constants.js';
import {
    todayKey, monthKey, formatDateLabel, weekdayLabel, compareDateKey,
    truncate, countWords,
} from '../utils.js';

export const DyArchive = {
    name: 'DyArchive',
    components: { ...SHARED_COMPONENTS },
    data() {
        return {
            MOODS,
            month: monthKey(todayKey()),
            editing: false,
            draft: '',
            draftMood: '',
        };
    },
    computed: {
        state() { return store.getState(); },
        space() { return store.getActiveSpace(); },
        readonly() { return this.space?.ownerKind === OWNER_KIND.AI; },

        monthLabel() {
            const [y, m] = this.month.split('-');
            return `${y} 年 ${Number(m)} 月`;
        },
        /** 不给翻到未来的月份 —— 那里永远是空的，只会让人以为出 bug 了 */
        canNext() { return compareDateKey(this.month, monthKey(todayKey())) < 0; },

        /** 这个月每一天的汇总，只保留有内容的那些 */
        rows() {
            const sid = this.space?.id;
            if (!sid) return [];
            const entries = store.entriesOf(sid).filter((e) => monthKey(e.date) === this.month);
            const notes = store.notesOf(sid).filter((n) => monthKey(n.date) === this.month);

            const byDate = new Map();
            const touch = (date) => {
                if (!byDate.has(date)) byDate.set(date, { date, entry: null, notes: [] });
                return byDate.get(date);
            };
            for (const e of entries) if (String(e.content).trim()) touch(e.date).entry = e;
            for (const n of notes) if (String(n.content).trim()) touch(n.date).notes.push(n);

            return [...byDate.values()]
                .sort((a, b) => compareDateKey(b.date, a.date))
                .map((row) => ({
                    ...row,
                    day: Number(row.date.slice(8, 10)),
                    weekday: weekdayLabel(row.date),
                    preview: row.entry
                        ? truncate(row.entry.content, 60)
                        : truncate(row.notes[0]?.content || '', 60),
                    moodName: MOODS.find((m) => m.id === row.entry?.mood)?.name || '',
                    words: row.entry ? countWords(row.entry.content) : 0,
                }));
        },

        monthStat() {
            const diaries = this.rows.filter((r) => r.entry).length;
            const notes = this.rows.reduce((n, r) => n + r.notes.length, 0);
            if (!diaries && !notes) return '';
            const parts = [];
            if (diaries) parts.push(`${diaries} 篇日记`);
            if (notes) parts.push(`${notes} 张便利贴`);
            return parts.join(' · ');
        },

        // ── 某一天的详情 ────────────────────
        focus() { return this.state.focusDate; },
        focusRow() { return this.rows.find((r) => r.date === this.focus) || null; },
        focusEntry() { return this.focus ? store.getEntry(this.space?.id, this.focus) : null; },
        focusNotes() { return this.focus ? store.notesOf(this.space?.id, this.focus) : []; },
        focusLabel() {
            return this.focus ? `${formatDateLabel(this.focus, { withYear: true })} ${weekdayLabel(this.focus)}` : '';
        },
    },
    watch: {
        // 换月 / 换本子时把展开的那一天收起来，否则会显示上一个月的内容
        month() { store.setFocusDate(''); this.editing = false; },
        'state.activeSpaceId'() { store.setFocusDate(''); this.editing = false; },
    },
    methods: {
        shiftMonth(delta) {
            if (delta > 0 && !this.canNext) return;
            const [y, m] = this.month.split('-').map(Number);
            const d = new Date(y, m - 1 + delta, 1);
            this.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        },
        open(date) {
            store.setFocusDate(this.focus === date ? '' : date);
            this.editing = false;
        },
        close() {
            store.setFocusDate('');
            this.editing = false;
        },

        startEdit() {
            this.draft = this.focusEntry?.content || '';
            this.draftMood = this.focusEntry?.mood || '';
            this.editing = true;
        },
        save() {
            const text = this.draft.trim();
            if (!text) { store.toast('还没写东西'); return; }
            store.saveTodayEntry({
                spaceId: this.space.id,
                date: this.focus,
                content: text,
                mood: this.draftMood,
                author: this.space.ownerKind,
            });
            this.editing = false;
            store.toast('存下了');
        },
        async remove() {
            const ok = await LP.modals.confirm({
                title: '删掉这一篇', message: '删了就找不回来了。', okLabel: '删掉', danger: true,
            });
            if (!ok) return;
            store.removeEntryRecord(this.space.id, this.focus);
            this.editing = false;
            store.toast('删了');
        },
        async removeNote(id) {
            const ok = await LP.modals.confirm({ title: '撕掉这张', message: '', okLabel: '撕掉', danger: true });
            if (ok) store.removeNote(id);
        },
        moodName(id) { return MOODS.find((m) => m.id === id)?.name || ''; },
    },
    template: `
    <div>
        <div class="dy-monthbar">
            <DyIconBtn name="left" label="上个月" @click="shiftMonth(-1)" />
            <span class="dy-monthbar__label">{{ monthLabel }}</span>
            <DyIconBtn v-if="canNext" name="right" label="下个月" @click="shiftMonth(1)" />
            <span v-else style="width:30px;"></span>
        </div>

        <p v-if="monthStat" class="dy-small dy-muted" style="margin:-6px 0 14px;text-align:center;">
            {{ monthStat }}
        </p>

        <div v-if="rows.length" class="dy-archive__list">
            <template v-for="r in rows" :key="r.date">
                <button type="button" class="dy-arch" @click="open(r.date)">
                    <span class="dy-arch__date">
                        <span class="dy-arch__d">{{ r.day }}</span>
                        <span class="dy-arch__w">{{ r.weekday }}</span>
                    </span>
                    <span class="dy-arch__main">
                        <span class="dy-arch__text">{{ r.preview }}</span>
                        <span class="dy-arch__tags">
                            <span v-if="r.moodName" class="dy-arch__tag" :data-mood="r.entry.mood">{{ r.moodName }}</span>
                            <span v-if="r.entry" class="dy-arch__tag dy-arch__tag--plain">{{ r.words }} 字</span>
                            <span v-if="r.notes.length" class="dy-arch__tag dy-arch__tag--plain">
                                {{ r.notes.length }} 张便利贴
                            </span>
                        </span>
                    </span>
                </button>

                <!-- 展开的那一天 -->
                <div v-if="focus === r.date" class="dy-card" style="margin:0 0 14px;">
                    <div class="dy-section__head">
                        <span class="dy-section__title">{{ focusLabel }}</span>
                        <button type="button" class="dy-section__action" @click="close">收起</button>
                    </div>

                    <div v-if="editing" class="dy-composer">
                        <textarea class="dy-composer__input" v-model="draft" placeholder="那天怎么样？"></textarea>
                        <div class="dy-moods">
                            <button
                                v-for="m in MOODS" :key="m.id"
                                type="button" class="dy-mood-pick"
                                :class="{ 'is-on': draftMood === m.id }" :data-mood="m.id"
                                @click="draftMood = draftMood === m.id ? '' : m.id"
                            >{{ m.name }}</button>
                        </div>
                        <div class="dy-composer__bar">
                            <span class="dy-composer__actions">
                                <DyBtn size="sm" @click="editing = false">取消</DyBtn>
                                <DyBtn size="sm" variant="primary" @click="save">存下</DyBtn>
                            </span>
                        </div>
                    </div>

                    <template v-else>
                        <div v-if="focusEntry" class="dy-entry__body" style="padding:0 0 10px;">{{ focusEntry.content }}</div>
                        <p v-else class="dy-small dy-muted" style="margin:0 0 10px;">那天没有写日记。</p>

                        <div v-if="focusNotes.length" class="dy-notes" style="margin-bottom:10px;">
                            <div v-for="n in focusNotes" :key="n.id" class="dy-note">
                                <span class="dy-note__text">{{ n.content }}</span>
                                <span v-if="!readonly" class="dy-note__meta">
                                    <button type="button" class="dy-note__del" @click="removeNote(n.id)">
                                        <DyIcon name="close" />
                                    </button>
                                </span>
                            </div>
                        </div>

                        <div v-if="!readonly" class="dy-btnbar">
                            <DyBtn size="sm" icon-name="edit" @click="startEdit">
                                {{ focusEntry ? '改' : '补写这天' }}
                            </DyBtn>
                            <DyBtn v-if="focusEntry" size="sm" variant="danger" icon-name="trash" @click="remove">删</DyBtn>
                        </div>
                    </template>
                </div>
            </template>
        </div>

        <DyEmpty v-else icon-name="calendar" text="这个月还没有记录" />
    </div>
    `,
};

export default DyArchive;
