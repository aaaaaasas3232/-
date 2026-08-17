/**
 * 追光 · 今日页
 *
 * 时钟卡（世界日期 + 档内天数 + 早中晚切换 + 快进 + 跨日）
 * 九维数值 + 精力 + 余额 / 护盾 / 阶段结算入口 / 事件流（公告 + 突发）。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { ATTR_DEFS, DAY_SLOTS, tierSpec } from '../constants.js';
import * as clockSvc from '../services/clock.js';
import { formatWorldClock, formatWorldDate } from '../services/world-context.js';
import { fmtMoney, fmtPercent } from '../utils.js';

export const AcTodayPage = {
    name: 'AcTodayPage',
    components: { ...UI },
    data() {
        return { showRisk: false };
    },
    computed: {
        s() { return store.getState(); },
        save() { return this.s.save; },
        profile() { return this.s.profile; },
        attrDefs() { return ATTR_DEFS; },
        slots() { return DAY_SLOTS; },
        tier() { return this.save ? tierSpec(this.save.tier) : null; },
        worldDate() {
            if (!this.save) return '';
            return formatWorldDate(clockSvc.virtualMs(this.save.clock), this.s.identity.worldId);
        },
        worldClock() {
            if (!this.save) return '';
            return formatWorldClock(clockSvc.virtualMs(this.save.clock), this.s.identity.worldId);
        },
        slotId() { return this.save ? clockSvc.currentSlotId(this.save.clock) : 'morning'; },
        offsetText() { return this.save ? clockSvc.offsetSummary(this.save.clock) : ''; },
        hm() { return this.save ? clockSvc.clockHm(this.save.clock) : ''; },
        shieldOn() {
            return this.save && this.save.shieldUntilDay >= (this.save.clock?.day || 0);
        },
        feed() {
            return (this.s.events || []).slice(0, 24);
        },
        pendingEvents() {
            return (this.s.events || []).filter((e) => !e.resolved);
        },
        risks() {
            return this.showRisk ? store.currentRiskPanel().slice(0, 8) : [];
        },
        honors() {
            return (this.save?.honors || []).slice(-4).reverse();
        },
    },
    methods: {
        fmtMoney,
        fmtPercent,
        kindMeta(kind) { return store.eventKindMeta(kind); },
        pickSlot(id) { store.setDaySlot(id); },
        toggleSync() { store.toggleSyncReal(!this.save?.clock?.syncReal); },
        askNextDay() { store.requestNextDay(); },
        askFastForward() { store.openModal({ type: 'fast-forward' }); },
        buyShield() { store.buyPrShield(); },
        openSettlement() { store.startSettlement(); },
        openTimeline() { store.setView('timeline'); },
        openAnchors() { store.setView('anchors'); },
        openEvent(ev) {
            if (!ev.resolved && ev.defId) store.openModal({ type: 'event', eventId: ev.id, defId: ev.defId });
        },
        narrate(ev) { store.narrateEvent(ev.id); },
    },
    template: `
        <div class="zg-page">
            <!-- 时钟卡 -->
            <section class="zg-clockcard">
                <div class="zg-clockcard__date">
                    <b>{{ worldDate }}</b>
                    <span>{{ worldClock }} · {{ hm }}</span>
                </div>
                <div class="zg-clockcard__meta">
                    <span>档内第 {{ save.clock.day }} 天</span>
                    <span>{{ offsetText }}</span>
                    <span>{{ save.clock.syncReal ? '现实同步中' : '手动时间' }}</span>
                </div>
                <div class="zg-clockcard__slots">
                    <button v-for="slot in slots" :key="slot.id" type="button"
                        class="zg-slotbtn" :class="{ 'is-on': slotId === slot.id }"
                        @click="pickSlot(slot.id)">{{ slot.label }}</button>
                    <button type="button" class="zg-slotbtn zg-slotbtn--sync" :class="{ 'is-on': save.clock.syncReal }"
                        @click="toggleSync" title="与现实时间同步">同步</button>
                </div>
                <div class="zg-clockcard__ops">
                    <AcBtn size="sm" variant="soft" iconName="forward" @click="askFastForward">快进</AcBtn>
                    <AcBtn size="sm" variant="line" iconName="moon" @click="askNextDay">进入下一天</AcBtn>
                    <AcBtn size="sm" variant="ghost" iconName="timeline" @click="openTimeline">大事记</AcBtn>
                    <AcBtn size="sm" variant="ghost" iconName="calendar" @click="openAnchors">锚点</AcBtn>
                </div>
            </section>

            <!-- 身份与数值 -->
            <AcSection :title="(profile.stageName || s.identity.userName) + ' · ' + tier.label" :sub="tier.group">
                <template #action>
                    <AcBtn size="sm" variant="gold" iconName="star" @click="openSettlement"
                        :loading="s.loading.settlement">阶段结算</AcBtn>
                </template>
                <div class="zg-statuslane">
                    <span class="zg-statuslane__cell"><AcIcon name="coin" :size="14" />{{ fmtMoney(s.balance) }} {{ s.identity.currency }}</span>
                    <span class="zg-statuslane__cell"><AcIcon name="energy" :size="14" />精力 {{ save.energy }}/100</span>
                    <span class="zg-statuslane__cell" :class="{ 'is-shield': shieldOn }">
                        <AcIcon name="shield" :size="14" />{{ shieldOn ? ('护盾至第 ' + save.shieldUntilDay + ' 天') : '无公关护盾' }}
                    </span>
                    <AcBtn v-if="!shieldOn" size="sm" variant="ghost" @click="buyShield">买断黑料</AcBtn>
                </div>
                <AcBar label="精力" :value="save.energy" kind="energy" />
                <div class="zg-attrgrid">
                    <AcBar v-for="def in attrDefs" :key="def.key"
                        :label="def.label" :value="Number(save.attrs[def.key]) || 0"
                        :kind="def.key === 'fame' ? 'fame' : ''" />
                </div>
                <button type="button" class="zg-linklike" @click="showRisk = !showRisk">
                    {{ showRisk ? '收起风险面板' : '展开风险面板（此刻每个突发事件的真实概率）' }}
                </button>
                <div v-if="showRisk" class="zg-risklist">
                    <div v-for="row in risks" :key="row.def.id" class="zg-riskrow">
                        <AcTag :tone="kindMeta(row.def.kind).tone">{{ kindMeta(row.def.kind).label }}</AcTag>
                        <b>{{ row.def.title }}</b>
                        <span class="zg-riskrow__p">{{ fmtPercent(row.p) }}</span>
                        <i v-if="row.parts && row.parts.shielded">护盾生效中</i>
                    </div>
                    <p class="zg-note">概率 = 分线曲线 × 属性护盾 × 公关护盾 × 状态。同一天的掷签结果是确定的，回档重放也一样。</p>
                </div>
            </AcSection>

            <!-- 荣誉 -->
            <AcSection v-if="honors.length" title="荣誉">
                <div class="zg-honorlane">
                    <span v-for="h in honors" :key="h.id" class="zg-honor"><AcIcon name="trophy" :size="13" />{{ h.title }}</span>
                </div>
            </AcSection>

            <!-- 待处理事件 -->
            <AcSection v-if="pendingEvents.length" title="待处理" sub="不处理会按默认方式收场">
                <div v-for="ev in pendingEvents" :key="ev.id" class="zg-eventcard is-pending" @click="openEvent(ev)">
                    <AcTag :tone="kindMeta(ev.kind).tone">{{ kindMeta(ev.kind).label }}</AcTag>
                    <div class="zg-eventcard__main">
                        <b>{{ ev.title }}</b>
                        <p>{{ ev.body }}</p>
                    </div>
                    <AcIcon name="chevron" :size="16" />
                </div>
            </AcSection>

            <!-- 事件流 / 公告 -->
            <AcSection title="动静" sub="公告与已发生的事">
                <AcEmpty v-if="!feed.length" iconName="megaphone" title="还没有动静" desc="把日子过起来，事情会来找你" />
                <div v-for="ev in feed" :key="ev.id" class="zg-eventcard" :class="{ 'is-unresolved': !ev.resolved }">
                    <AcTag :tone="kindMeta(ev.kind).tone">{{ kindMeta(ev.kind).label }}</AcTag>
                    <div class="zg-eventcard__main">
                        <b>{{ ev.title }} <i class="zg-eventcard__day">第{{ ev.day }}天</i>
                            <i v-if="ev.chance" class="zg-eventcard__chance">{{ ev.chance }}%</i></b>
                        <p>{{ ev.body }}</p>
                        <p v-if="ev.choice" class="zg-eventcard__choice">处理：{{ ev.choice }}{{ ev.outcome ? ' —— ' + ev.outcome : '' }}</p>
                        <p v-if="ev.narrative" class="zg-eventcard__narrative">{{ ev.narrative }}</p>
                        <button v-else-if="ev.resolved && ev.type === 'event' && ev.kind !== 'skip'"
                            type="button" class="zg-linklike" @click="narrate(ev)">演绎这段现场</button>
                    </div>
                    <button v-if="!ev.resolved && ev.defId" type="button" class="zg-eventcard__go" @click="openEvent(ev)">处理</button>
                </div>
            </AcSection>
        </div>
    `,
};
