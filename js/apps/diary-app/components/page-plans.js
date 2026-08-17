/**
 * 日记 · 纪念日与计划
 *
 * 两组共用一张表（`diaryMarkers`），靠 `kind` 分：
 *   countdown    将来的事 → 「还有 N 天」
 *   anniversary  过去的日子 → 「已经 N 天」
 *
 * 用一张表是因为「考试考完了想留成纪念」是很常见的操作 ——
 * 分两张表的话这个动作就得跨表搬家，而搬家过程中丢字段是必然的。
 * 这里改 kind 就行。
 */

import * as store from '../store.js';
import { presets as LP } from '@/src/core/presets/index.js';
import { SHARED_COMPONENTS } from './shared.js';
import { MARKER_KIND, REPEAT_RULES, OWNER_KIND } from '../constants.js';
import {
    todayKey, formatDateLabel, daysFromToday, isValidDateKey,
} from '../utils.js';

export const DyPlans = {
    name: 'DyPlans',
    components: { ...SHARED_COMPONENTS },
    data() {
        return {
            REPEAT_RULES,
            editingId: '',
            form: null,
        };
    },
    computed: {
        state() { return store.getState(); },
        space() { return store.getActiveSpace(); },
        readonly() { return this.space?.ownerKind === OWNER_KIND.AI; },
        today() { return todayKey(); },

        all() { return store.markersOf(this.space?.id); },

        /** 将来的事：按最近的排前面 */
        countdowns() {
            return this.all
                .filter((m) => m.kind === MARKER_KIND.COUNTDOWN && m.date)
                .map((m) => ({ m, d: daysFromToday(m.date) }))
                .filter((x) => x.d != null)
                .sort((a, b) => {
                    // 已经过去的排到最后（但还留着，用户可能想改成纪念日）
                    const pa = a.d < 0 ? 1 : 0;
                    const pb = b.d < 0 ? 1 : 0;
                    return pa - pb || a.d - b.d;
                })
                .map(({ m, d }) => this.decorate(m, d));
        },

        /** 已经过去的日子：置顶的排前面，然后按「离今天近」排 */
        anniversaries() {
            return this.all
                .filter((m) => m.kind === MARKER_KIND.ANNIVERSARY && m.date)
                .map((m) => ({ m, d: daysFromToday(m.date) }))
                .filter((x) => x.d != null)
                .sort((a, b) => (b.m.pinned ? 1 : 0) - (a.m.pinned ? 1 : 0) || Math.abs(a.d) - Math.abs(b.d))
                .map(({ m, d }) => this.decorate(m, d));
        },
    },
    methods: {
        /** 算出「还有几天 / 已经几天」和单位 */
        decorate(m, d) {
            const isPast = d <= 0;
            const abs = Math.abs(d);
            return {
                ...m,
                dateLabel: formatDateLabel(m.date, { withYear: true }),
                value: abs,
                unit: d === 0 ? '' : (isPast ? '天了' : '天后'),
                isToday: d === 0,
                overdue: m.kind === MARKER_KIND.COUNTDOWN && d < 0,
                repeatName: REPEAT_RULES.find((r) => r.id === m.repeat)?.name || '',
            };
        },

        startNew(kind) {
            this.editingId = 'new';
            this.form = {
                kind,
                title: '',
                date: '',
                reason: '',
                repeat: kind === MARKER_KIND.ANNIVERSARY ? 'yearly' : 'none',
                pinned: false,
            };
        },
        startEdit(m) {
            if (this.readonly) return;
            this.editingId = m.id;
            this.form = {
                kind: m.kind, title: m.title, date: m.date,
                reason: m.reason, repeat: m.repeat, pinned: m.pinned,
            };
        },
        cancel() {
            this.editingId = '';
            this.form = null;
        },
        save() {
            const title = String(this.form.title).trim();
            if (!title) { store.toast('还没起名字'); return; }
            if (!isValidDateKey(this.form.date)) { store.toast('还没选日期'); return; }

            if (this.editingId === 'new') {
                store.addMarker({ ...this.form, title, spaceId: this.space.id });
                store.toast('记下了');
            } else {
                store.patchMarker(this.editingId, { ...this.form, title });
                store.toast('改好了');
            }
            this.cancel();
        },
        async remove(m) {
            const ok = await LP.modals.confirm({
                title: `删掉「${m.title}」`, message: '', okLabel: '删掉', danger: true,
            });
            if (!ok) return;
            store.removeMarker(m.id);
            if (this.editingId === m.id) this.cancel();
            store.toast('删了');
        },
        togglePin(m) {
            store.patchMarker(m.id, { pinned: !m.pinned });
        },
        /** 「考完了，留个纪念」—— 倒计时转纪念日 */
        toAnniversary(m) {
            store.patchMarker(m.id, { kind: MARKER_KIND.ANNIVERSARY, repeat: 'yearly' });
            store.toast('变成纪念日了');
        },
    },
    template: `
    <div>
        <!-- 编辑表单 -->
        <div v-if="form" class="dy-card" style="margin-bottom:18px;">
            <DyFormRow label="这是">
                <DyChips
                    v-model="form.kind" :allow-empty="false" wide
                    :options="[
                        { id: 'countdown', name: '将来要做的事' },
                        { id: 'anniversary', name: '想纪念的日子' },
                    ]"
                />
            </DyFormRow>
            <DyFormRow label="叫什么">
                <input class="dy-field" v-model="form.title" maxlength="20" placeholder="期末考试 / 那场音乐会" />
            </DyFormRow>
            <DyFormRow label="哪一天">
                <DyDate v-model="form.date" />
            </DyFormRow>
            <DyFormRow label="为什么想记住" hint="会一起告诉 TA。">
                <input class="dy-field" v-model="form.reason" maxlength="40" placeholder="不填也行" />
            </DyFormRow>
            <DyFormRow label="重复">
                <DyChips v-model="form.repeat" :options="REPEAT_RULES" :allow-empty="false" wide />
            </DyFormRow>
            <div class="dy-btnbar">
                <DyBtn @click="cancel">取消</DyBtn>
                <DyBtn variant="primary" @click="save">存下</DyBtn>
            </div>
        </div>

        <!-- 将来 -->
        <DySection
            title="要做的事"
            :action="readonly || form ? '' : '新增'"
            @action="startNew('countdown')"
        >
            <template v-if="countdowns.length">
                <div v-for="m in countdowns" :key="m.id">
                    <button type="button" class="dy-marker" @click="startEdit(m)">
                        <span class="dy-marker__num">
                            <span class="dy-marker__value">{{ m.isToday ? '今天' : m.value }}</span>
                            <span v-if="m.unit" class="dy-marker__unit">{{ m.unit }}</span>
                        </span>
                        <span class="dy-marker__main">
                            <span class="dy-marker__title">
                                {{ m.title }}
                                <span v-if="m.source === 'ai'" class="dy-marker__by">TA 记的</span>
                            </span>
                            <span v-if="m.reason" class="dy-marker__reason">{{ m.reason }}</span>
                            <span class="dy-marker__date">
                                {{ m.dateLabel }}<template v-if="m.overdue"> · 已经过了</template>
                            </span>
                        </span>
                    </button>
                    <div v-if="m.overdue && !readonly" class="dy-btnbar" style="margin:-4px 0 12px 60px;">
                        <DyBtn size="sm" variant="ghost" icon-name="heart" @click="toAnniversary(m)">留成纪念日</DyBtn>
                        <DyBtn size="sm" variant="ghost" icon-name="trash" @click="remove(m)">删掉</DyBtn>
                    </div>
                </div>
            </template>
            <DyEmpty v-else icon-name="clock" text="还没有在等的事" />
        </DySection>

        <!-- 过去 -->
        <DySection
            title="纪念日"
            :action="readonly || form ? '' : '新增'"
            @action="startNew('anniversary')"
        >
            <template v-if="anniversaries.length">
                <button
                    v-for="m in anniversaries" :key="m.id"
                    type="button" class="dy-marker" @click="startEdit(m)"
                >
                    <span class="dy-marker__num">
                        <span class="dy-marker__value">{{ m.isToday ? '今天' : m.value }}</span>
                        <span v-if="m.unit" class="dy-marker__unit">{{ m.unit }}</span>
                    </span>
                    <span class="dy-marker__main">
                        <span class="dy-marker__title">
                            {{ m.title }}
                            <span v-if="m.source === 'ai'" class="dy-marker__by">TA 记的</span>
                            <span v-if="m.pinned" class="dy-marker__by">常看</span>
                        </span>
                        <span v-if="m.reason" class="dy-marker__reason">{{ m.reason }}</span>
                        <span class="dy-marker__date">{{ m.dateLabel }} · {{ m.repeatName }}</span>
                    </span>
                </button>
            </template>
            <DyEmpty v-else icon-name="heart" text="还没有记下什么日子" />
        </DySection>

        <!-- 编辑中的那一条给一组操作 -->
        <div v-if="editingId && editingId !== 'new'" class="dy-btnbar">
            <DyBtn size="sm" icon-name="star" @click="togglePin(all.find(x => x.id === editingId))">
                {{ all.find(x => x.id === editingId)?.pinned ? '取消常看' : '设为常看' }}
            </DyBtn>
            <DyBtn size="sm" variant="danger" icon-name="trash" @click="remove(all.find(x => x.id === editingId))">
                删掉
            </DyBtn>
        </div>
    </div>
    `,
};

export default DyPlans;
