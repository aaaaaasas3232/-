/**
 * 追光 · 日程页
 *
 * 今天的安排（已做的事，每件事固定时长）+ 活动目录（点了就消耗时间与精力）。
 * 关联 nook 作息：用户没在 nook 配置作息时提醒去设置。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import * as clockSvc from '../services/clock.js';
import { minuteToHm } from '../utils.js';

export const AcSchedulePage = {
    name: 'AcSchedulePage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        save() { return this.s.save; },
        entries() { return this.s.todaySchedule?.entries || []; },
        catalog() { return store.activityCatalog(); },
        remainText() {
            const h = clockSvc.remainHours(this.save.clock);
            return h <= 0 ? '今天已经排满到 24:00' : `今天还剩约 ${h.toFixed(1)} 小时可安排`;
        },
        routine() { return this.s.routine || { configured: true }; },
        kinds() {
            return [
                { id: 'course', label: '课程' },
                { id: 'work', label: '工作' },
                { id: 'social', label: '社交' },
                { id: 'rest', label: '休整' },
            ];
        },
    },
    methods: {
        minuteToHm,
        byKind(kind) { return this.catalog.filter((a) => a.kind === kind); },
        doIt(activity) {
            if (activity.locked) {
                store.showToast(activity.lockReason || '还不满足条件');
                return;
            }
            store.doActivity(activity.id);
        },
        goNook() {
            window.dispatchEvent(new CustomEvent('app:page-action', {
                detail: { action: 'openApp', appId: 'settings' },
            }));
        },
        askNextDay() { store.requestNextDay(); },
    },
    template: `
        <div class="zg-page">
            <div v-if="!routine.configured" class="zg-routinehint">
                <AcIcon name="alert" :size="16" />
                <div>
                    <b>你还没在 nook 里设置作息</b>
                    <p>设置后追光会参考你的真实节奏安排提醒（比如别把晚宴排到你现实的睡觉时间）。</p>
                </div>
                <AcBtn size="sm" variant="soft" @click="goNook">去设置</AcBtn>
            </div>

            <AcSection title="今天" :sub="remainText">
                <template #action>
                    <AcBtn size="sm" variant="line" iconName="moon" @click="askNextDay">收工跨日</AcBtn>
                </template>
                <AcEmpty v-if="!entries.length" iconName="hourglass" title="今天还什么都没做"
                    desc="从下面的目录里挑点事做，每件事有固定时长" />
                <div v-for="entry in entries" :key="entry.id" class="zg-slotrow">
                    <span class="zg-slotrow__time">{{ minuteToHm(entry.startMinute) }}</span>
                    <div class="zg-slotrow__main">
                        <b>{{ entry.label }} <i>{{ entry.hours }} 小时</i></b>
                        <p v-if="entry.decayApplied" class="zg-slotrow__decay">同类课程重复上，收益递减</p>
                        <p v-if="entry.payNote" class="zg-slotrow__pay">{{ entry.payNote }}</p>
                        <p v-if="entry.encounterNote" class="zg-slotrow__meet">{{ entry.encounterNote }}</p>
                    </div>
                </div>
            </AcSection>

            <AcSection v-for="kind in kinds" :key="kind.id" :title="kind.label">
                <div class="zg-actgrid">
                    <button v-for="activity in byKind(kind.id)" :key="activity.id" type="button"
                        class="zg-actcard" :class="{ 'is-locked': activity.locked }"
                        @click="doIt(activity)">
                        <b>{{ activity.label }}</b>
                        <span>{{ activity.hours }}h · 精力{{ activity.energy > 0 ? '+' + activity.energy : activity.energy }}</span>
                        <p>{{ activity.locked ? activity.lockReason : activity.desc }}</p>
                    </button>
                </div>
            </AcSection>
        </div>
    `,
};
