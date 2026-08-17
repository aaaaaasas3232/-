/**
 * 日记 · 配置向导
 *
 * 产品要求：「日记一进去要有一个配置，用户配置自己的生日月经、配置自己想纪念的
 * 日子理由、记录自己准备做的事跟倒计时、还有配置自己日记空间的主题颜色，
 * 用户配置完毕就可以进入日记 App 进入用户的日记空间」。
 *
 * ── 为什么是五步而不是一长页 ──────────────────────────────────────
 *
 * 生理期那一步字段最多（十来个），和「挑个颜色」放在同一屏会让人直接划过去。
 * 拆步之后每一屏只问一件事，而且**每一步都能跳过** ——
 * 强制填完才让进去的话，只想随手记两笔的用户第一次就流失了。
 *
 * 唯一必填的是第一步的「本子叫什么」，而它有默认值。
 *
 * ── 草稿存在哪 ───────────────────────────────────────────────────
 *
 * 生日 / 经期 / 纪念日这些**数据**存在组件自己的 `data` 里，
 * 点「完成」才落到 store —— 向导没走完不该产生半成品配置。
 *
 * **外观是例外**：主题 / 纸张 / 字号一选就写进 store。
 * 理由是这一步的全部意义就是「看看长什么样」，而根节点的 `data-diary-theme`
 * 读的是 store 里的 space，只改本地草稿的话点了颜色整页纹丝不动 ——
 * 用户会以为按钮是坏的。顺带的好处是中途退出再进来还记得挑过什么色。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import {
    THEMES, LAYOUT_STYLES, TEXT_SCALES, CYCLE_MODE, CARE_TONES,
    TRACK_FIELDS, MARKER_KIND, WINDOW_START_MIN, WINDOW_START_MAX,
    DEFAULT_CYCLE,
} from '../constants.js';
import { describeWindow, todayKey, formatDateLabel, makeId } from '../utils.js';
import * as nook from '../services/nook-bridge.js';

const STEPS = [
    { id: 'look', title: '这是一本什么样的日记', desc: '颜色和排版随时能改，先挑个顺眼的。' },
    { id: 'window', title: '你习惯什么时候写日记', desc: '这五个小时里写下的是日记，一天一篇。其他时候记的都是便利贴。' },
    { id: 'me', title: '关于你自己', desc: '生日和相识的日子会变成纪念日，也会让 TA 知道。' },
    { id: 'cycle', title: '要不要记录生理期', desc: '记了之后 TA 会知道，也会照顾着。不想记就跳过。' },
    { id: 'plans', title: '有什么想记住、想做的事', desc: '过去的日子会变成纪念日，将来的事会变成倒计时。' },
];

export const DySetup = {
    name: 'DySetup',
    components: { ...SHARED_COMPONENTS },
    props: {
        spaceId: { type: String, required: true },
    },
    data() {
        const space = store.getSpace(this.spaceId);
        const user = nook.getDefaultUser();
        return {
            stepIndex: 0,
            STEPS, THEMES, LAYOUT_STYLES, TEXT_SCALES, CARE_TONES, TRACK_FIELDS,
            CYCLE_MODE, WINDOW_START_MIN, WINDOW_START_MAX,

            form: {
                title: space?.title || (user?.name ? `${user.name}的日记` : '我的日记'),
                theme: space?.theme || 'oat',
                layout: space?.layout || 'plain',
                textScale: space?.textScale || 'md',
                windowStart: space?.windowStart ?? 19,
                birthday: space?.birthday || '',
                styleNote: space?.styleNote || '',
            },
            cycle: { ...DEFAULT_CYCLE, ...(space?.cycle || {}) },

            /** 相识日单独拿出来 —— 它其实是一条 marker，但在向导里当字段填更自然 */
            metDate: '',
            metNote: '',

            /** 第五步临时攒的条目，点完成时一次性写进去 */
            drafts: [],
            draft: { kind: MARKER_KIND.COUNTDOWN, title: '', date: '', reason: '' },
        };
    },
    computed: {
        step() { return STEPS[this.stepIndex]; },
        isLast() { return this.stepIndex === STEPS.length - 1; },
        windowText() { return describeWindow(this.form.windowStart); },
        today() { return todayKey(); },
        trackOn() { return this.cycle.trackFields || []; },
        canNext() {
            // 只有第一步有必填
            return this.step.id !== 'look' || String(this.form.title).trim().length > 0;
        },
    },
    methods: {
        next() {
            if (!this.canNext) return;
            if (this.isLast) { this.finish(); return; }
            this.stepIndex += 1;
            this.scrollTop();
        },
        back() {
            if (this.stepIndex === 0) return;
            this.stepIndex -= 1;
            this.scrollTop();
        },
        skip() {
            if (this.isLast) { this.finish(); return; }
            this.stepIndex += 1;
            this.scrollTop();
        },
        scrollTop() {
            this.$nextTick(() => {
                const body = this.$el?.querySelector?.('.dy-setup__body');
                if (body) body.scrollTop = 0;
            });
        },

        /**
         * 外观项写直通。
         *
         * ★ 必须同时改 `form` 和 store：`form` 是「完成」时提交的那份，
         *   store 是根节点渲染读的那份。只改一边的话，要么看不到变化，
         *   要么点完成时又被草稿里的旧值覆盖回去。
         */
        setLook(key, value) {
            this.form[key] = value;
            store.patchSpace(this.spaceId, { [key]: value });
        },

        setTrack(id, on) {
            const cur = new Set(this.cycle.trackFields || []);
            if (on) cur.add(id);
            else cur.delete(id);
            this.cycle.trackFields = TRACK_FIELDS.filter((f) => cur.has(f.id)).map((f) => f.id);
        },
        isTrackOn(id) {
            return (this.cycle.trackFields || []).includes(id);
        },

        addDraft() {
            const title = String(this.draft.title).trim();
            if (!title || !this.draft.date) return;
            this.drafts.push({ ...this.draft, title, id: makeId('draft') });
            this.draft = { kind: this.draft.kind, title: '', date: '', reason: '' };
        },
        removeDraft(id) {
            this.drafts = this.drafts.filter((d) => d.id !== id);
        },
        draftLabel(d) {
            return `${d.kind === MARKER_KIND.ANNIVERSARY ? '纪念' : '倒数'} · ${formatDateLabel(d.date, { withYear: true })}`;
        },

        finish() {
            const sid = this.spaceId;
            store.patchSpace(sid, {
                title: String(this.form.title).trim() || '我的日记',
                theme: this.form.theme,
                layout: this.form.layout,
                textScale: this.form.textScale,
                windowStart: Number(this.form.windowStart),
                birthday: this.form.birthday,
                styleNote: this.form.styleNote,
            });
            store.patchCycleConfig(sid, this.cycle);

            // 生日 / 相识日都是「每年会再来一次」的纪念日
            if (this.form.birthday) {
                store.addMarker({
                    spaceId: sid, kind: MARKER_KIND.ANNIVERSARY,
                    title: '生日', date: this.form.birthday, repeat: 'yearly', pinned: true,
                });
            }
            if (this.metDate) {
                store.addMarker({
                    spaceId: sid, kind: MARKER_KIND.ANNIVERSARY,
                    title: '我们认识的那天', date: this.metDate,
                    reason: this.metNote, repeat: 'yearly', pinned: true,
                });
            }
            for (const d of this.drafts) {
                store.addMarker({
                    spaceId: sid, kind: d.kind, title: d.title, date: d.date, reason: d.reason,
                    repeat: d.kind === MARKER_KIND.ANNIVERSARY ? 'yearly' : 'none',
                });
            }

            store.completeSetup(sid);
            store.toast('日记本准备好了');
        },
    },
    template: `
    <div class="dy-setup">
        <header class="dy-setup__head">
            <div class="dy-setup__step">第 {{ stepIndex + 1 }} 步 / 共 {{ STEPS.length }} 步</div>
            <h1 class="dy-setup__title">{{ step.title }}</h1>
            <p class="dy-setup__desc">{{ step.desc }}</p>
            <div class="dy-dots">
                <span v-for="(s, i) in STEPS" :key="s.id" :class="{ 'is-on': i <= stepIndex }"></span>
            </div>
        </header>

        <div class="dy-setup__body">
            <!-- ── 1. 本子的样子 ────────────────── -->
            <template v-if="step.id === 'look'">
                <DyFormRow label="日记本叫什么">
                    <input class="dy-field" v-model="form.title" maxlength="12" placeholder="我的日记" />
                </DyFormRow>

                <DyFormRow label="颜色">
                    <div class="dy-themes">
                        <button
                            v-for="t in THEMES" :key="t.id"
                            type="button" class="dy-theme"
                            :class="{ 'is-on': form.theme === t.id }"
                            :data-diary-theme="t.id"
                            @click="setLook('theme', t.id)"
                        >
                            <span class="dy-theme__swatch"><i></i><i></i><i></i></span>
                            <span class="dy-theme__name">{{ t.name }}</span>
                        </button>
                    </div>
                </DyFormRow>

                <DyFormRow label="纸张">
                    <DyChips
                        :model-value="form.layout" :options="LAYOUT_STYLES" :allow-empty="false" wide
                        @update:model-value="setLook('layout', $event)"
                    />
                </DyFormRow>

                <DyFormRow label="字号">
                    <DyChips
                        :model-value="form.textScale" :options="TEXT_SCALES" :allow-empty="false" wide
                        @update:model-value="setLook('textScale', $event)"
                    />
                </DyFormRow>
            </template>

            <!-- ── 2. 写作时段 ──────────────────── -->
            <template v-else-if="step.id === 'window'">
                <DyFormRow label="日记时段" :hint="'时段固定五个小时，最晚 ' + WINDOW_START_MAX + ' 点开始，保证当天写完。'">
                    <div class="dy-windowpick">
                        <input
                            class="dy-windowpick__range" type="range"
                            :min="WINDOW_START_MIN" :max="WINDOW_START_MAX" step="1"
                            :value="form.windowStart"
                            @input="form.windowStart = Number($event.target.value)"
                        />
                        <span class="dy-windowpick__text">{{ windowText }}</span>
                    </div>
                </DyFormRow>

                <div class="dy-card">
                    <p class="dy-small dy-muted" style="line-height:1.95;margin:0;">
                        在 {{ windowText }} 之间写下的内容会存成<b>当天的日记</b>，一天只有一篇，可以反复修改。<br />
                        其他时间写的会存成<b>便利贴</b>，一天可以记很多张。<br />
                        让 TA 代笔时也是同一套规则 —— 不在时段内，TA 写出来的也是便利贴。
                    </p>
                </div>
            </template>

            <!-- ── 3. 关于我 ────────────────────── -->
            <template v-else-if="step.id === 'me'">
                <DyFormRow label="生日">
                    <DyDate v-model="form.birthday" :max="today" />
                </DyFormRow>

                <DyFormRow label="和 TA 认识的日子" hint="任何已经过去的日期都可以填。">
                    <DyDate v-model="metDate" :max="today" />
                </DyFormRow>

                <DyFormRow v-if="metDate" label="那天发生了什么">
                    <input class="dy-field" v-model="metNote" maxlength="40" placeholder="想起来的一句话就行" />
                </DyFormRow>

                <DyFormRow label="你写日记的习惯" hint="会影响 TA 帮你起草时的口吻。不填也行。">
                    <input class="dy-field" v-model="form.styleNote" maxlength="60" placeholder="写得很短，常常只有半句" />
                </DyFormRow>
            </template>

            <!-- ── 4. 生理期 ────────────────────── -->
            <template v-else-if="step.id === 'cycle'">
                <div class="dy-card">
                    <div class="dy-row dy-row--static">
                        <span class="dy-row__label">记录生理期</span>
                        <span class="dy-row__value"></span>
                        <DySwitch v-model="cycle.enabled" />
                    </div>
                </div>

                <template v-if="cycle.enabled">
                    <DyFormRow label="你是怎么记日子的">
                        <DyChips
                            v-model="cycle.mode" :allow-empty="false" wide
                            :options="[
                                { id: CYCLE_MODE.MONTH_DAY, name: '每个月固定几号' },
                                { id: CYCLE_MODE.CYCLE_LENGTH, name: '按周期天数算' },
                            ]"
                        />
                    </DyFormRow>

                    <DyFormRow v-if="cycle.mode === CYCLE_MODE.MONTH_DAY" label="一般每个月几号来">
                        <DyStepper v-model="cycle.startDay" :min="1" :max="31" suffix=" 号" />
                    </DyFormRow>

                    <DyFormRow v-else label="周期多少天" hint="从这次来的第一天，到下次来的第一天。">
                        <DyStepper v-model="cycle.cycleLength" :min="15" :max="90" suffix=" 天" />
                    </DyFormRow>

                    <DyFormRow label="一般持续几天">
                        <DyStepper v-model="cycle.periodLength" :min="1" :max="15" suffix=" 天" />
                    </DyFormRow>

                    <DyFormRow label="上一次是什么时候" hint="填了才能马上开始推算，之后打卡会自动更新。">
                        <DyDate v-model="cycle.lastStart" :max="today" />
                    </DyFormRow>

                    <div class="dy-card">
                        <div class="dy-row dy-row--static">
                            <span class="dy-row__label">我的周期不太规律</span>
                            <span class="dy-row__value"></span>
                            <DySwitch v-model="cycle.irregular" />
                        </div>
                        <p class="dy-row__hint" style="margin:8px 0 0;">
                            打开之后，TA 不会拿具体日期跟你说死，只会大概知道快到了。
                        </p>
                    </div>

                    <DyFormRow label="提前几天提醒" hint="到了这个天数，TA 就会开始留意。填 0 表示当天才知道。">
                        <DyStepper v-model="cycle.remindDaysBefore" :min="0" :max="10" suffix=" 天" />
                    </DyFormRow>

                    <DyFormRow label="希望 TA 怎么对待这件事">
                        <DyChips v-model="cycle.careTone" :options="CARE_TONES" :allow-empty="false" />
                        <p class="dy-formrow__hint" v-for="t in CARE_TONES" :key="t.id" v-show="cycle.careTone === t.id">
                            {{ t.desc }}
                        </p>
                    </DyFormRow>

                    <DyFormRow
                        label="这个世界观里，大家怎么看这件事"
                        hint="不填的话 TA 会按当前世界观的常识来说。"
                    >
                        <textarea
                            class="dy-field" rows="3" v-model="cycle.worldNote" maxlength="200"
                            placeholder="例如：在这个设定里这是很私密的事，只有最亲近的人知道"
                        ></textarea>
                    </DyFormRow>

                    <DyFormRow label="每天想记录哪些" hint="打开的项目会出现在打卡表里。之后随时能改。">
                        <div class="dy-chips">
                            <button
                                v-for="f in TRACK_FIELDS" :key="f.id"
                                type="button" class="dy-chip"
                                :class="{ 'is-on': isTrackOn(f.id) }"
                                @click="setTrack(f.id, !isTrackOn(f.id))"
                            >{{ f.name }}</button>
                        </div>
                    </DyFormRow>
                </template>
            </template>

            <!-- ── 5. 纪念日 / 计划 ─────────────── -->
            <template v-else>
                <DyFormRow label="这是">
                    <DyChips
                        v-model="draft.kind" :allow-empty="false" wide
                        :options="[
                            { id: 'countdown', name: '将来要做的事' },
                            { id: 'anniversary', name: '想纪念的日子' },
                        ]"
                    />
                </DyFormRow>
                <DyFormRow label="叫什么">
                    <input class="dy-field" v-model="draft.title" maxlength="20" placeholder="期末考试 / 第一次见面" />
                </DyFormRow>
                <DyFormRow label="哪一天">
                    <DyDate v-model="draft.date" />
                </DyFormRow>
                <DyFormRow label="为什么想记住">
                    <input class="dy-field" v-model="draft.reason" maxlength="40" placeholder="不填也行" />
                </DyFormRow>
                <DyBtn block :disabled="!draft.title.trim() || !draft.date" @click="addDraft">加进去</DyBtn>

                <div v-if="drafts.length" class="dy-hr"></div>
                <div v-for="d in drafts" :key="d.id" class="dy-row dy-row--static">
                    <span class="dy-row__label">{{ d.title }}</span>
                    <span class="dy-row__value dy-row__value--muted">{{ draftLabel(d) }}</span>
                    <button type="button" class="dy-note__del" @click="removeDraft(d.id)">
                        <DyIcon name="close" />
                    </button>
                </div>
            </template>
        </div>

        <footer class="dy-setup__foot">
            <DyBtn v-if="stepIndex > 0" @click="back">上一步</DyBtn>
            <DyBtn v-else-if="!canNext" disabled>先起个名字</DyBtn>
            <DyBtn v-if="stepIndex > 0 && !isLast" variant="ghost" @click="skip">跳过</DyBtn>
            <DyBtn variant="primary" :disabled="!canNext" @click="next">
                {{ isLast ? '开始写吧' : '下一步' }}
            </DyBtn>
        </footer>
    </div>
    `,
};

export default DySetup;
