/**
 * 点灯 · 知识点词典 + 悬浮播放设置
 *
 * 词典有两个来源：用户自己一行一行加，和每节课老师塞进来的。
 * 加进来之后它们会以三种形态反复出现在你眼前：
 *   1. 弹幕：在手机屏幕上按你设定的位置和密度飘过
 *   2. 灵动岛：一条一条播（像音乐岛的歌词），点开能自评
 *   3. 手机壳外的小电视：滚动播放，或者当单词机用
 *
 * 自评（不记得 / 模糊 / 记错了 / 完全记得）会改变它下次出现的时间，
 * 「已记住」区的几乎不再出现，「不深刻」区的反复出现。
 */

import { DICT_BUCKETS, TICKER_DENSITY, TICKER_ZONES, TV_MODES, TV_SIZE } from '../constants.js';
import { describeDue } from '../services/srs.js';
import { UI } from './ui.js';

export const SlDictPage = {
    name: 'SlDictPage',
    components: { ...UI },
    props: {
        state: { type: Object, required: true },
        stats: { type: Object, default: () => ({}) },
    },
    emits: ['add', 'bulk', 'update', 'delete', 'grade', 'bucket', 'enrich', 'settings'],
    data() {
        return {
            filter: 'all',
            keyword: '',
            adding: false,
            form: { front: '', pos: '', back: '', hint: '' },
            bulkText: '',
            bulkOpen: false,
            drillId: '',
            drillShown: false,
        };
    },
    computed: {
        buckets() { return DICT_BUCKETS; },
        list() {
            const key = this.keyword.trim().toLocaleLowerCase();
            return this.state.dict.filter((d) => {
                if (this.filter === 'due' && !(Number(d.dueAt) <= Date.now())) return false;
                if (this.filter !== 'all' && this.filter !== 'due' && d.bucket !== this.filter) return false;
                if (!key) return true;
                return `${d.front} ${d.back} ${d.pos} ${d.hint}`.toLocaleLowerCase().includes(key);
            });
        },
        emptyFields() {
            return this.state.dict.filter((d) => !d.back || !d.hint).map((d) => d.id);
        },
        ticker() { return this.state.profile?.ticker || {}; },
        tv() { return this.state.profile?.tv || {}; },
    },
    methods: {
        due(entry) { return describeDue(entry); },
        submit() {
            const front = this.form.front.trim();
            if (!front) return;
            this.$emit('add', { ...this.form, front });
            this.form = { front: '', pos: '', back: '', hint: '' };
        },
        submitBulk() {
            const text = this.bulkText.trim();
            if (!text) return;
            this.$emit('bulk', text);
            this.bulkText = '';
            this.bulkOpen = false;
        },
        startDrill(entry) {
            this.drillId = this.drillId === entry.id ? '' : entry.id;
            this.drillShown = false;
        },
        gradeAndNext(entry, gradeId) {
            this.$emit('grade', { id: entry.id, grade: gradeId });
            this.drillId = '';
            this.drillShown = false;
        },
    },
    template: `
        <div class="sl-page">
            <SlSection title="知识点词典" :sub="stats.total + ' 条 · ' + (stats.due || 0) + ' 条待复习'">
                <template #action>
                    <SlButton size="sm" variant="soft" icon-name="tv" @click="$emit('settings')">悬浮播放</SlButton>
                </template>

                <div class="sl-dict__bar">
                    <div class="sl-dict__search">
                        <SlIcon name="search" :size="15" />
                        <input class="sl-input sl-input--bare" v-model="keyword" placeholder="搜一条" />
                    </div>
                    <div class="sl-seg sl-seg--sm">
                        <button type="button" :class="{ 'is-on': filter === 'all' }" @click="filter = 'all'">全部</button>
                        <button type="button" :class="{ 'is-on': filter === 'due' }" @click="filter = 'due'">待复习</button>
                        <button
                            v-for="b in buckets" :key="b.id" type="button"
                            :class="{ 'is-on': filter === b.id }" @click="filter = b.id"
                        >{{ b.label }}</button>
                    </div>
                </div>

                <div class="sl-dict__quick">
                    <span v-if="ticker.on" class="sl-dict__on"><i></i>弹幕播放中</span>
                    <span v-if="tv.on" class="sl-dict__on"><i></i>小电视开着</span>
                    <span class="sl-section__spacer"></span>
                    <SlButton
                        v-if="emptyFields.length"
                        size="sm" variant="ghost" icon-name="sparkle"
                        :loading="state.loading.enrich"
                        @click="$emit('enrich', emptyFields)"
                    >让老师补全 {{ emptyFields.length }} 条</SlButton>
                </div>
            </SlSection>

            <!-- 加一条 -->
            <SlSection title="自己加">
                <template #action>
                    <SlButton size="sm" variant="ghost" @click="bulkOpen = !bulkOpen">
                        {{ bulkOpen ? '一条条加' : '粘一整段' }}
                    </SlButton>
                </template>

                <template v-if="!bulkOpen">
                    <div class="sl-dict__form">
                        <input class="sl-input" v-model="form.front" placeholder="eat" />
                        <input class="sl-input sl-input--narrow" v-model="form.pos" placeholder="v." />
                        <input class="sl-input" v-model="form.back" placeholder="吃" />
                    </div>
                    <input class="sl-input" v-model="form.hint" placeholder="补充（词根 / 记忆钩子），可以留空" />
                    <SlButton variant="primary" size="sm" icon-name="plus" :disabled="!form.front.trim()" @click="submit">
                        加进去
                    </SlButton>
                </template>

                <template v-else>
                    <textarea
                        class="sl-textarea" v-model="bulkText" rows="6"
                        placeholder="一行一条，三种写法都认：&#10;eat v. 吃&#10;eat = 吃&#10;eat|v.|吃"
                    ></textarea>
                    <SlButton variant="primary" size="sm" icon-name="plus" :disabled="!bulkText.trim()" @click="submitBulk">
                        一次性加进去
                    </SlButton>
                </template>
            </SlSection>

            <!-- 列表 -->
            <SlSection :title="'共 ' + list.length + ' 条'">
                <SlEmpty
                    v-if="!list.length"
                    icon-name="cards"
                    title="这里还是空的"
                    desc="上课时老师会往里塞；你自己也能一行一行加。"
                />

                <div v-for="d in list" :key="d.id" class="sl-de" :class="['is-' + d.bucket, { 'is-muted': d.muted }]">
                    <div class="sl-de__main" @click="startDrill(d)">
                        <div class="sl-de__front">
                            {{ d.front }}
                            <i v-if="d.pos">{{ d.pos }}</i>
                        </div>
                        <div class="sl-de__back" :class="{ 'is-hidden': drillId === d.id && !drillShown }">
                            {{ drillId === d.id && !drillShown ? '想一下…' : d.back }}
                        </div>
                        <div v-if="d.hint && drillId !== d.id" class="sl-de__hint">{{ d.hint }}</div>
                    </div>

                    <div v-if="drillId === d.id" class="sl-de__drill">
                        <template v-if="!drillShown">
                            <SlButton size="sm" variant="primary" block @click="drillShown = true">看答案</SlButton>
                        </template>
                        <template v-else>
                            <button type="button" @click="gradeAndNext(d, 'forgot')">不记得</button>
                            <button type="button" @click="gradeAndNext(d, 'fuzzy')">模糊</button>
                            <button type="button" @click="gradeAndNext(d, 'wrong')">记错了</button>
                            <button type="button" class="is-on" @click="gradeAndNext(d, 'known')">完全记得</button>
                        </template>
                    </div>

                    <div class="sl-de__side">
                        <span class="sl-de__due">{{ due(d) }}</span>
                        <div class="sl-de__acts">
                            <button
                                v-for="b in buckets" :key="b.id" type="button"
                                :class="{ 'is-on': d.bucket === b.id }"
                                :title="b.desc"
                                @click="$emit('bucket', { id: d.id, bucket: b.id })"
                            >{{ b.label }}</button>
                            <button type="button" @click="$emit('update', { id: d.id, patch: { muted: !d.muted } })">
                                <SlIcon :name="d.muted ? 'eyeOff' : 'eye'" :size="14" />
                            </button>
                            <button type="button" @click="$emit('delete', d.id)"><SlIcon name="trash" :size="14" /></button>
                        </div>
                    </div>
                </div>
            </SlSection>
        </div>
    `,
};

/** 悬浮播放设置页 */
export const SlTickerPanel = {
    name: 'SlTickerPanel',
    components: { ...UI },
    props: {
        state: { type: Object, required: true },
        snapshot: { type: Object, default: () => ({}) },
    },
    emits: ['back', 'update'],
    computed: {
        ticker() { return this.state.profile?.ticker || {}; },
        island() { return this.state.profile?.island || {}; },
        tv() { return this.state.profile?.tv || {}; },
        zones() { return TICKER_ZONES; },
        densities() { return TICKER_DENSITY; },
        tvModes() { return TV_MODES; },
        tvRange() { return TV_SIZE; },
        topicOptions() {
            return [
                { id: '', label: '全部主题' },
                ...this.state.topics.map((t) => ({ id: t.id, label: t.title })),
            ];
        },
        caseHidden() { return Boolean(this.snapshot.caseHidden); },
    },
    methods: {
        set(group, patch) { this.$emit('update', { group, patch }); },
    },
    template: `
        <div class="sl-ticker">
            <SlTopbar title="悬浮播放" sub="让词条自己找上你" @back="$emit('back')" />

            <div class="sl-ticker__scroll">
                <SlSection title="弹幕" sub="在手机屏幕上飘">
                    <template #action>
                        <SlSwitch :model-value="!!ticker.on" @update:model-value="set('ticker', { on: $event })" />
                    </template>

                    <SlField label="出现在哪一带" hint="上部会避开状态栏和灵动岛，下部会避开底部指示条">
                        <SlSegment
                            :model-value="ticker.zone"
                            :options="zones"
                            @update:model-value="set('ticker', { zone: $event })"
                        />
                    </SlField>

                    <SlField label="密度">
                        <SlSegment
                            size="sm"
                            :model-value="ticker.density"
                            :options="densities"
                            @update:model-value="set('ticker', { density: $event })"
                        />
                    </SlField>

                    <SlField label="速度">
                        <SlSlider
                            :model-value="Number(ticker.speed) || 1" :min="0.4" :max="2.4" :step="0.1"
                            suffix="×"
                            @update:model-value="set('ticker', { speed: $event })"
                        />
                    </SlField>

                    <SlField label="播哪个主题的">
                        <SlSegment
                            size="sm"
                            :model-value="ticker.topicId || ''"
                            :options="topicOptions"
                            @update:model-value="set('ticker', { topicId: $event })"
                        />
                    </SlField>

                    <button type="button" class="sl-row" @click="set('ticker', { showBack: !ticker.showBack })">
                        <span>连释义一起飘</span>
                        <span class="sl-section__spacer"></span>
                        <SlSwitch :model-value="!!ticker.showBack" />
                    </button>
                    <button type="button" class="sl-row" @click="set('ticker', { includeMastered: !ticker.includeMastered })">
                        <span>「已记住」的也播</span>
                        <span class="sl-section__spacer"></span>
                        <SlSwitch :model-value="!!ticker.includeMastered" />
                    </button>
                </SlSection>

                <SlSection title="灵动岛" sub="一条一条播，点开能自评">
                    <template #action>
                        <SlSwitch :model-value="!!island.on" @update:model-value="set('island', { on: $event })" />
                    </template>
                    <SlField label="多久换一条">
                        <SlSlider
                            :model-value="Number(island.intervalMs) || 6000" :min="2000" :max="30000" :step="1000"
                            suffix="ms"
                            @update:model-value="set('island', { intervalMs: $event })"
                        />
                    </SlField>
                    <p class="sl-review__note">最小岛只显示一行；点开变中岛，那里有「不记得 / 模糊 / 记错了 / 完全记得」和分区按钮。</p>
                </SlSection>

                <SlSection title="小电视" sub="挂在手机壳外面的顶部">
                    <template #action>
                        <SlSwitch
                            :model-value="!!tv.on" :disabled="caseHidden"
                            @update:model-value="set('tv', { on: $event })"
                        />
                    </template>

                    <p v-if="caseHidden" class="sl-warn">
                        现在是无手机壳模式。小电视要贴在壳的顶边中央，没有壳就没有可贴的地方 —— 这个开关先锁住了。
                    </p>

                    <template v-else>
                        <SlField label="模式">
                            <SlSegment
                                :model-value="tv.mode"
                                :options="tvModes"
                                @update:model-value="set('tv', { mode: $event })"
                            />
                        </SlField>

                        <SlField label="大小" hint="也可以直接长按小电视，往上/往右拖拉大 —— 底边永远贴着壳顶中央，左右对称长">
                            <SlSlider
                                :model-value="Number(tv.width) || tvRange.def"
                                :min="tvRange.min" :max="tvRange.max" :step="2"
                                suffix="px"
                                @update:model-value="set('tv', { width: $event })"
                            />
                        </SlField>

                        <SlField v-if="tv.mode === 'roll'" label="多久换一条">
                            <SlSlider
                                :model-value="Number(tv.intervalMs) || 4200" :min="1500" :max="20000" :step="500"
                                suffix="ms"
                                @update:model-value="set('tv', { intervalMs: $event })"
                            />
                        </SlField>

                        <button
                            v-if="tv.mode === 'drill'" type="button" class="sl-row"
                            @click="set('tv', { maskBack: !tv.maskBack })"
                        >
                            <span>先遮住释义</span>
                            <span class="sl-section__spacer"></span>
                            <SlSwitch :model-value="!!tv.maskBack" />
                        </button>
                    </template>
                </SlSection>

                <p class="sl-review__note">
                    这三样东西画在 App 外面，所以你切去别的软件它们照样在。
                    页面切到后台会自动停，回来接着播 —— 不会在你看不见的时候空转。
                </p>
            </div>
        </div>
    `,
};

export default SlDictPage;
