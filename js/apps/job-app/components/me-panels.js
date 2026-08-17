/**
 * 灯塔 · 「我的」下面那几个子页
 *
 * ★ 注册表的 key 必须是**组件名**，不是 view 名。
 *   四叶草那轮真的写错过：`{ flow: FlowPanel }` 配 `<component :is="'jb-flow-panel'">`
 *   解析不到任何东西，表现是「点了流水，什么都不出现」，
 *   控制台只有一条容易被淹掉的 Vue resolve 警告。
 *   而且这个 bug **只在 `:is` 动态挂载时炸**，静态写 `<jb-flow-panel />` 不炸。
 *
 * ★ 「view 名 → 组件名」的映射和组件定义放在同一个文件里。
 *   分到两处就会出现「加了面板但忘了加路由」这种只有点进去才发现的问题。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { THEATER_LENGTHS } from '../constants.js';
import { fmtTime } from '../utils.js';

/* ── 工资流水 ─────────────────────────────────────────────────── */

const FLOW_SOURCE_LABEL = {
    'job-salary': '月薪',
    'job-daily': '日结',
    'job-tip': '打赏',
    'job-bonus': '奖金',
};

const FlowPanel = {
    name: 'JbFlowPanel',
    components: { ...UI },
    emits: ['close'],
    computed: {
        s() { return store.getState(); },
        currency() { return this.s.identity.currency; },
        rows() { return store.jobFlow(80); },
        total() {
            return this.rows.reduce((sum, e) => sum + (e.direction === 'in' ? e.amount : -e.amount), 0);
        },
    },
    methods: {
        when(e) { return fmtTime(e.timestamp); },
        kind(e) { return FLOW_SOURCE_LABEL[e.sourceType] || '收入'; },
    },
    template: `
        <jb-panel title="工资流水" @close="$emit('close')">
            <p class="jb-panel__desc">
                只列这个 App 带来的。红包、转账、购物那些在 nook 的钱包页里。
            </p>

            <section class="jb-card jb-card--pad jb-flow__sum">
                <span>累计</span>
                <jb-money :value="total" :currency="currency" size="lg" tone="in" :sign="true" />
            </section>

            <jb-empty
                v-if="!rows.length"
                icon="wallet"
                title="还没有进账"
                desc="月结的工作到发薪日会自动补上；日结和打赏是演完当天就到。"
            />

            <div v-else class="jb-flow__list">
                <div v-for="e in rows" :key="e.id" class="jb-card jb-flowrow">
                    <div class="jb-flowrow__main">
                        <b>{{ e.note || e.counterpartyName }}</b>
                        <i>{{ kind(e) }} · {{ when(e) }}</i>
                    </div>
                    <jb-money
                        :value="e.direction === 'in' ? e.amount : -e.amount"
                        :currency="currency" size="sm"
                        :tone="e.direction === 'in' ? 'in' : 'out'" :sign="true"
                    />
                </div>
            </div>
        </jb-panel>
    `,
};

/* ── 生成设置 ─────────────────────────────────────────────────── */

const GenPanel = {
    name: 'JbGenPanel',
    components: { ...UI },
    emits: ['close'],
    computed: {
        s() { return store.getState(); },
        lengths() { return THEATER_LENGTHS; },
        length() { return this.s.profile?.theaterLength || 'medium'; },
        clipCount() { return (this.s.profile?.clipIds || []).length; },
        promptCount() { return (this.s.profile?.promptIds || []).length; },
        aim() { return this.s.profile?.aim || ''; },
    },
    methods: {
        setLength(id) { store.setTheaterLength(id); },
        reconfig() { store.reopenOnboarding(); },
        toPrompts() { store.setView('prompts'); },
    },
    template: `
        <jb-panel title="生成设置" @close="$emit('close')">
            <jb-section title="小剧场篇幅">
                <div class="jb-seg">
                    <button
                        v-for="l in lengths" :key="l.id"
                        class="jb-seg__btn" :class="{ 'is-on': length === l.id }"
                        @click="setLength(l.id)"
                    >{{ l.label }}</button>
                </div>
                <p class="jb-panel__note">
                    {{ lengths.find(l => l.id === length).words }}。长的更有戏，但每天都演的话会累。
                </p>
            </jb-section>

            <jb-section title="世界观材料">
                <div class="jb-card jb-card--pad">
                    <jb-kv label="夹子" :value="clipCount + ' 条'" />
                    <jb-kv label="prompt 库" :value="promptCount + ' 条'" />
                    <jb-kv label="求职方向" :value="aim || '（没写）'" />
                    <jb-btn variant="line" block icon="edit" @click="reconfig">重新挑一遍</jb-btn>
                    <p class="jb-panel__note">
                        重新挑不会丢掉工作、收藏和小剧场，只是换掉「生成时带什么材料」。
                    </p>
                </div>
            </jb-section>

            <jb-section title="想改得更细">
                <div class="jb-card jb-card--pad">
                    <p class="jb-panel__desc">
                        招聘板的写法、HR 的说话方式、录用尺度、小剧场的调子，
                        全都是可以逐条改的提示词。
                    </p>
                    <jb-btn variant="primary" block icon="scroll" @click="toPrompts">去提示词那一页</jb-btn>
                </div>
            </jb-section>
        </jb-panel>
    `,
};

/**
 * 给 `components: {}` 用的注册表。key 就是模板里能用的标签名。
 */
export const ME_PANEL_COMPONENTS = {
    JbFlowPanel: FlowPanel,
    JbGenPanel: GenPanel,
};

/** view 名 → 组件名 */
export const ME_PANEL_BY_VIEW = Object.freeze({
    flow: 'jb-flow-panel',
    gen: 'jb-gen-panel',
});

export { FlowPanel, GenPanel };
