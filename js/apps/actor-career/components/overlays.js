/**
 * 追光 · 覆盖页集合
 *
 * 大事记时间轴 / 锚点日历与配置 / 结局 / 提示词透明页。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import { loadPreview } from '../services/prompt-builder.js';
import { listSocialInfluenceProviders } from '@/src/core/social-influence-registry.js';
import { formatWorldDate } from '../services/world-context.js';

const KIND_META = {
    milestone: { label: '里程碑', tone: 'warn' },
    work: { label: '作品', tone: 'success' },
    award: { label: '奖项', tone: 'warn' },
    event: { label: '事件', tone: 'danger' },
    festival: { label: '节日', tone: 'info' },
    skip: { label: '快进', tone: 'plain' },
};

export const AcTimelinePage = {
    name: 'AcTimelinePage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        rows() { return this.s.timeline; },
    },
    methods: {
        close() { store.setView(''); },
        meta(kind) { return KIND_META[kind] || KIND_META.event; },
        dateOf(row) {
            const save = this.s.save;
            if (!save) return '';
            const ms = save.clock.anchorMs + (row.day - 1) * 86400000 + 12 * 3600000;
            return formatWorldDate(ms, this.s.identity.worldId);
        },
    },
    template: `
        <div class="zg-overlay">
            <header class="zg-overlay__head">
                <button type="button" class="zg-overlay__back" @click="close"><AcIcon name="back" :size="18" /></button>
                <b>大事记</b>
                <span class="zg-overlay__sub">重大事件自动同步到世界观时间轴</span>
            </header>
            <div class="zg-overlay__body">
                <AcEmpty v-if="!rows.length" iconName="timeline" title="时间轴还是空的" />
                <div v-for="row in rows" :key="row.id" class="zg-tlrow" :class="{ 'is-major': row.major }">
                    <span class="zg-tlrow__dot"></span>
                    <div class="zg-tlrow__main">
                        <div class="zg-tlrow__head">
                            <AcTag :tone="meta(row.kind).tone">{{ meta(row.kind).label }}</AcTag>
                            <b>{{ row.title }}</b>
                        </div>
                        <p class="zg-tlrow__date">第 {{ row.day }} 天 · {{ dateOf(row) }}</p>
                        <p v-if="row.detail" class="zg-tlrow__detail">{{ row.detail }}</p>
                    </div>
                </div>
            </div>
        </div>
    `,
};

export const AcAnchorsPage = {
    name: 'AcAnchorsPage',
    components: { ...UI },
    data() {
        return { editingAwardId: '', awards: [], festivals: [], dirty: false };
    },
    computed: {
        s() { return store.getState(); },
        calendar() { return store.anchorCalendar(60); },
    },
    mounted() {
        this.awards = JSON.parse(JSON.stringify(this.s.profile?.awards || []));
        this.festivals = JSON.parse(JSON.stringify(this.s.profile?.festivals || []));
    },
    methods: {
        close() { store.setView(''); },
        rollAwards() {
            this.awards = store.randomizeAwardConfig();
            this.dirty = true;
        },
        addAward() {
            this.awards.push({
                id: `award-${Date.now().toString(36)}`,
                name: '新奖项',
                cycleDays: 120,
                desc: '',
                enabled: true,
                conditions: { minFame: 20, minWorks: 1, minCraft: 40 },
                reward: { fame: 5, money: 20000, honor: '新奖项' },
                competitive: true,
                fieldStrength: 50,
            });
            this.dirty = true;
        },
        removeAward(id) {
            this.awards = this.awards.filter((a) => a.id !== id);
            if (this.editingAwardId === id) this.editingAwardId = '';
            this.dirty = true;
        },
        addFestival() {
            this.festivals.push({
                id: `fest-${Date.now().toString(36)}`,
                name: '新节日',
                everyDays: 60,
                desc: '',
                enabled: true,
            });
            this.dirty = true;
        },
        removeFestival(id) {
            this.festivals = this.festivals.filter((f) => f.id !== id);
            this.dirty = true;
        },
        markDirty() { this.dirty = true; },
        async saveAll() {
            await store.updateAnchors({ awards: this.awards, festivals: this.festivals });
            this.dirty = false;
        },
        dayDate(day) {
            const save = this.s.save;
            if (!save) return '';
            const ms = save.clock.anchorMs + (day - 1) * 86400000 + 12 * 3600000;
            return formatWorldDate(ms, this.s.identity.worldId);
        },
    },
    template: `
        <div class="zg-overlay">
            <header class="zg-overlay__head">
                <button type="button" class="zg-overlay__back" @click="close"><AcIcon name="back" :size="18" /></button>
                <b>锚点</b>
                <span class="zg-section__spacer"></span>
                <AcBtn v-if="dirty" size="sm" variant="ink" @click="saveAll">保存</AcBtn>
            </header>
            <div class="zg-overlay__body">
                <AcSection title="未来 60 天" sub="按当前档内时间推算">
                    <AcEmpty v-if="!calendar.length" iconName="calendar" title="近期没有锚点" />
                    <div v-for="(row, i) in calendar" :key="i" class="zg-anchorrow">
                        <AcTag :tone="row.kind === 'award' ? 'warn' : 'info'">{{ row.kind === 'award' ? '奖项' : '节日' }}</AcTag>
                        <b>{{ row.name }}</b>
                        <span>{{ row.inDays }} 天后 · {{ dayDate(row.day) }}</span>
                    </div>
                </AcSection>

                <AcSection title="奖项（段锚点）">
                    <template #action>
                        <AcBtn size="sm" variant="soft" iconName="dice" @click="rollAwards">随机一套</AcBtn>
                        <AcBtn size="sm" variant="ink" @click="addAward">新建</AcBtn>
                    </template>
                    <div v-for="award in awards" :key="award.id" class="zg-awardrow">
                        <div class="zg-awardrow__head" @click="editingAwardId = editingAwardId === award.id ? '' : award.id">
                            <label class="zg-check" @click.stop><input type="checkbox" v-model="award.enabled" @change="markDirty" /></label>
                            <b>{{ award.name }}</b>
                            <span>每 {{ award.cycleDays }} 天</span>
                            <AcIcon name="chevron" :size="14" />
                        </div>
                        <div v-if="editingAwardId === award.id" class="zg-awardrow__edit" @input="markDirty">
                            <AcField label="奖项名"><input class="zg-input" v-model.trim="award.name" maxlength="12" /></AcField>
                            <AcField label="举办周期（天）"><input class="zg-input" type="number" v-model.number="award.cycleDays" min="30" max="720" /></AcField>
                            <AcField label="得奖条件">
                                <div class="zg-condrow"><span>知名度 ≥</span><input class="zg-input is-mini" type="number" v-model.number="award.conditions.minFame" min="0" max="100" /></div>
                                <div class="zg-condrow"><span>完成作品 ≥</span><input class="zg-input is-mini" type="number" v-model.number="award.conditions.minWorks" min="0" max="20" /></div>
                                <div class="zg-condrow"><span>声台形表均值 ≥</span><input class="zg-input is-mini" type="number" v-model.number="award.conditions.minCraft" min="0" max="100" /></div>
                            </AcField>
                            <AcField label="奖金"><input class="zg-input" type="number" v-model.number="award.reward.money" min="0" /></AcField>
                            <AcBtn size="sm" variant="ghost" @click="removeAward(award.id)">删除这个奖项</AcBtn>
                        </div>
                    </div>
                </AcSection>

                <AcSection title="节日（点锚点）">
                    <template #action>
                        <AcBtn size="sm" variant="ink" @click="addFestival">新建</AcBtn>
                    </template>
                    <div v-for="fest in festivals" :key="fest.id" class="zg-festrow">
                        <label class="zg-check"><input type="checkbox" v-model="fest.enabled" @change="markDirty" /></label>
                        <input class="zg-input is-mini" v-model.trim="fest.name" maxlength="12" @input="markDirty" />
                        <span>每</span>
                        <input class="zg-input is-mini" type="number" v-model.number="fest.everyDays" min="7" max="720" @input="markDirty" />
                        <span>天</span>
                        <input class="zg-input" v-model.trim="fest.desc" placeholder="说明" @input="markDirty" />
                        <AcBtn size="sm" variant="ghost" @click="removeFestival(fest.id)">删除</AcBtn>
                    </div>
                </AcSection>
            </div>
        </div>
    `,
};

export const AcEndingPage = {
    name: 'AcEndingPage',
    components: { ...UI },
    computed: {
        s() { return store.getState(); },
        save() { return this.s.save; },
    },
    methods: {
        close() { store.setView(''); },
    },
    template: `
        <div class="zg-overlay">
            <header class="zg-overlay__head">
                <button type="button" class="zg-overlay__back" @click="close"><AcIcon name="back" :size="18" /></button>
                <b>{{ save?.name }} · 结局</b>
            </header>
            <div class="zg-overlay__body">
                <pre class="zg-ending">{{ save?.endingText || '还没有结局' }}</pre>
                <p class="zg-note">结局写完这一档还能继续玩日常 —— 拍拍戏、见见人。只是大多数人会在这里合上剧本。</p>
            </div>
        </div>
    `,
};

const PREVIEW_SCOPES = [
    { id: 'script', label: '剧本生成', scope: (s) => `script::${s.save?.id}` },
    { id: 'ff', label: '快进叙事', scope: (s) => `ff::${s.save?.id}` },
    { id: 'ending', label: '结局', scope: (s) => `ending::${s.save?.id}` },
    { id: 'event', label: '事件演绎', scope: (s) => `event::${s.save?.id}` },
];

export const AcPromptsPage = {
    name: 'AcPromptsPage',
    components: { ...UI },
    data() {
        return { active: 'script', previewText: '' };
    },
    computed: {
        s() { return store.getState(); },
        scopes() { return PREVIEW_SCOPES; },
        providers() {
            return [
                ...listSocialInfluenceProviders('blog'),
                ...listSocialInfluenceProviders('youtube'),
            ].filter((p, i, arr) => arr.findIndex((x) => x.key === p.key) === i)
                .filter((p) => p.sourceAppId === 'actor-career');
        },
    },
    mounted() { this.loadScope('script'); },
    methods: {
        close() { store.setView(''); },
        loadScope(id) {
            this.active = id;
            const def = PREVIEW_SCOPES.find((x) => x.id === id);
            this.previewText = def ? (loadPreview(def.scope(this.s)) || '') : '';
        },
    },
    template: `
        <div class="zg-overlay">
            <header class="zg-overlay__head">
                <button type="button" class="zg-overlay__back" @click="close"><AcIcon name="back" :size="18" /></button>
                <b>提示词与联动</b>
            </header>
            <div class="zg-overlay__body">
                <AcSection title="发出去的提示词" sub="预览与实际发送同源（同一次拼装）">
                    <div class="zg-seg">
                        <button v-for="sc in scopes" :key="sc.id" type="button"
                            class="zg-seg__item" :class="{ 'is-on': active === sc.id }"
                            @click="loadScope(sc.id)">{{ sc.label }}</button>
                    </div>
                    <pre v-if="previewText" class="zg-promptpre">{{ previewText }}</pre>
                    <AcEmpty v-else iconName="prompt" title="这个场景还没生成过" desc="生成一次后，这里能看到实际发送的完整提示词" />
                </AcSection>

                <AcSection title="社交影响 provider" sub="演员生涯 → 氧气 / 萤火的唯一通道">
                    <div v-for="p in providers" :key="p.key" class="zg-anchorrow">
                        <AcTag tone="info">{{ p.channels.join(' / ') || '全部' }}</AcTag>
                        <b>{{ p.label }}</b>
                        <span>→ {{ p.targetAppIds.join('、') }}</span>
                    </div>
                    <p class="zg-note">provider 只输出概要文本、不调 AI；由氧气 / 萤火在用户点击生成时收集。热搜词条会被氧气标注「与你有关」。</p>
                </AcSection>
            </div>
        </div>
    `,
};

