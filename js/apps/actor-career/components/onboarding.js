/**
 * 追光 · 首次配置（六步向导）
 *
 * ① 身份 → ② 起点线（18线→1线自选）→ ③ 初始加点（预算随线级，知名度锁定）
 * → ④ 奖项与节日（可随机 / 可编辑得奖条件）→ ⑤ 30 位 NPC 预览 → ⑥ 开档
 *
 * 严肃配置：不完成不能进主界面；全程不调 AI。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import {
    ALLOC_KEYS, ATTR_DEFS, ATTR_MAX, TIERS, tierSpec,
} from '../constants.js';
import {
    blankAllocation, defaultAwardConfig, defaultFestivalConfig,
    randomizeAwards, suggestAllocation, validateAllocation,
} from '../services/career-engine.js';
import { generateRoster } from '../services/npc-engine.js';

const GENRE_OPTIONS = ['正剧', '古装', '悬疑', '喜剧', '偶像剧', '文艺片', '动作', '短剧'];

export const AcOnboarding = {
    name: 'AcOnboarding',
    components: { ...UI },
    data() {
        const startTier = 18;
        return {
            step: 0,
            steps: ['身份', '起点', '加点', '锚点', '圈子', '开档'],
            form: {
                stageName: '',
                agencyStatus: '独立艺人',
                genres: [],
                style: '',
                goal: '',
                representativeWork: '',
                startTier,
                attrs: blankAllocation(startTier).attrs,
                awards: defaultAwardConfig(),
                festivals: defaultFestivalConfig(),
                saveName: '第 1 档',
            },
            editingAwardId: '',
            error: '',
            submitting: false,
        };
    },
    computed: {
        s() { return store.getState(); },
        tiers() { return TIERS; },
        attrDefs() { return ATTR_DEFS; },
        allocKeys() { return ALLOC_KEYS; },
        attrMax() { return ATTR_MAX; },
        genreOptions() { return GENRE_OPTIONS; },
        agencyOptions() { return ['独立艺人', '小型工作室', '签约经纪公司', '头部经纪公司']; },
        tierInfo() { return tierSpec(this.form.startTier); },
        allocation() { return validateAllocation(this.form.attrs, this.form.startTier); },
        rosterPreview() {
            const key = this.s.identity.profileKey;
            return key ? generateRoster(key) : [];
        },
        canNext() {
            if (this.step === 0) return true;
            if (this.step === 2) return this.allocation.ok;
            return true;
        },
    },
    methods: {
        labelOf(key) { return ATTR_DEFS.find((a) => a.key === key)?.label || key; },
        pickTier(tier) {
            this.form.startTier = tier;
            const blank = blankAllocation(tier);
            // 线级变了预算变了：保守起见清零重分（知名度重锁）
            this.form.attrs = blank.attrs;
        },
        bump(key, delta) {
            const next = Math.max(0, Math.min(ATTR_MAX, (Number(this.form.attrs[key]) || 0) + delta));
            const test = { ...this.form.attrs, [key]: next };
            const check = validateAllocation(test, this.form.startTier);
            if (delta > 0 && !check.ok) return;
            this.form.attrs = test;
        },
        autoAlloc() {
            this.form.attrs = suggestAllocation(this.form.startTier, this.s.identity.profileKey);
        },
        clearAlloc() {
            this.form.attrs = blankAllocation(this.form.startTier).attrs;
        },
        toggleGenre(g) {
            const set = new Set(this.form.genres);
            if (set.has(g)) set.delete(g);
            else if (set.size < 4) set.add(g);
            this.form.genres = [...set];
        },
        rollAwards() {
            this.form.awards = randomizeAwards(String(Date.now()));
        },
        resetAwards() {
            this.form.awards = defaultAwardConfig();
        },
        prev() { if (this.step > 0) this.step -= 1; },
        next() {
            this.error = '';
            if (this.step === 2 && !this.allocation.ok) {
                this.error = this.allocation.error;
                return;
            }
            if (this.step < this.steps.length - 1) this.step += 1;
        },
        async submit() {
            if (this.submitting) return;
            this.submitting = true;
            this.error = '';
            try {
                const result = await store.completeSetup({ ...this.form });
                if (!result.ok) this.error = result.error || '配置失败';
            } finally {
                this.submitting = false;
            }
        },
    },
    template: `
        <div class="zg-onboarding">
            <header class="zg-onboarding__head">
                <h2>演员成长之路</h2>
                <p>先把你的起点定下来。这些配置决定整条生涯的数值与概率，值得认真填。</p>
                <div class="zg-onboarding__steps">
                    <span v-for="(label, i) in steps" :key="label"
                        class="zg-onboarding__step" :class="{ 'is-on': i === step, 'is-done': i < step }">
                        {{ label }}
                    </span>
                </div>
            </header>

            <!-- ① 身份 -->
            <div v-if="step === 0" class="zg-onboarding__panel">
                <AcField label="艺名"><input class="zg-input" v-model.trim="form.stageName" :placeholder="s.identity.userName" maxlength="16" /></AcField>
                <AcField label="经纪状态">
                    <div class="zg-chiprow">
                        <button v-for="opt in agencyOptions" :key="opt"
                            type="button" class="zg-chip" :class="{ 'is-on': form.agencyStatus === opt }"
                            @click="form.agencyStatus = opt">{{ opt }}</button>
                    </div>
                </AcField>
                <AcField label="擅长类型（最多 4 个）">
                    <div class="zg-chiprow">
                        <button v-for="g in genreOptions" :key="g"
                            type="button" class="zg-chip" :class="{ 'is-on': form.genres.includes(g) }"
                            @click="toggleGenre(g)">{{ g }}</button>
                    </div>
                </AcField>
                <AcField label="表演风格"><input class="zg-input" v-model.trim="form.style" placeholder="如：体验派，先把自己烧进去" maxlength="40" /></AcField>
                <AcField label="职业目标"><input class="zg-input" v-model.trim="form.goal" placeholder="如：三十岁前拿一座金梧桐" maxlength="40" /></AcField>
                <AcField label="代表作（可空）"><input class="zg-input" v-model.trim="form.representativeWork" placeholder="还没有也很正常" maxlength="40" /></AcField>
            </div>

            <!-- ② 起点线 -->
            <div v-else-if="step === 1" class="zg-onboarding__panel">
                <p class="zg-note">从 18 线到 1 线，你想从哪里开始？线级决定初始知名度、加点预算、片酬与突发事件概率 —— 越红，树越大，风越大。</p>
                <div class="zg-tiergrid">
                    <button v-for="t in tiers" :key="t.tier" type="button"
                        class="zg-tiercell" :class="{ 'is-on': form.startTier === t.tier }"
                        @click="pickTier(t.tier)">
                        <b>{{ t.label }}</b><i>{{ t.group }}</i>
                    </button>
                </div>
                <div class="zg-tierinfo">
                    <p class="zg-tierinfo__group">{{ tierInfo.group }} —— {{ tierInfo.groupDesc }}</p>
                    <div class="zg-tierinfo__rows">
                        <span>初始知名度 <b>{{ tierInfo.fameBase }}</b>/100</span>
                        <span>加点预算 <b>{{ tierInfo.budget }}</b> 点</span>
                        <span>日薪基准 <b>{{ tierInfo.dayPay }}</b></span>
                        <span>公关单价 <b>{{ tierInfo.prCost }}</b></span>
                    </div>
                </div>
            </div>

            <!-- ③ 加点 -->
            <div v-else-if="step === 2" class="zg-onboarding__panel">
                <div class="zg-allochead">
                    <span>预算 <b>{{ allocation.budget }}</b> · 已用 <b>{{ allocation.spent || 0 }}</b> · 剩 <b :class="{ 'is-over': !allocation.ok }">{{ allocation.ok ? allocation.left : '超了' }}</b></span>
                    <span class="zg-allochead__actions">
                        <AcBtn size="sm" variant="soft" @click="autoAlloc">推荐加点</AcBtn>
                        <AcBtn size="sm" variant="ghost" @click="clearAlloc">清零</AcBtn>
                    </span>
                </div>
                <div v-for="key in allocKeys" :key="key" class="zg-allocrow">
                    <AcBar :label="labelOf(key)" :value="Number(form.attrs[key]) || 0" :max="attrMax" />
                    <div class="zg-allocrow__ops">
                        <button type="button" class="zg-step" @click="bump(key, -5)">-5</button>
                        <button type="button" class="zg-step" @click="bump(key, -1)">-</button>
                        <button type="button" class="zg-step" @click="bump(key, 1)">+</button>
                        <button type="button" class="zg-step" @click="bump(key, 5)">+5</button>
                    </div>
                </div>
                <div class="zg-allocrow is-locked">
                    <AcBar label="知名度（由起点线锁定）" :value="tierInfo.fameBase" :max="attrMax" kind="fame" />
                    <AcIcon name="lock" :size="16" />
                </div>
            </div>

            <!-- ④ 锚点：奖项与节日 -->
            <div v-else-if="step === 3" class="zg-onboarding__panel">
                <div class="zg-allochead">
                    <span>段锚点 · 奖项（可编辑得奖条件）</span>
                    <span class="zg-allochead__actions">
                        <AcBtn size="sm" variant="soft" iconName="dice" @click="rollAwards">随机一套</AcBtn>
                        <AcBtn size="sm" variant="ghost" @click="resetAwards">恢复默认</AcBtn>
                    </span>
                </div>
                <div v-for="award in form.awards" :key="award.id" class="zg-awardrow">
                    <div class="zg-awardrow__head" @click="editingAwardId = editingAwardId === award.id ? '' : award.id">
                        <label class="zg-check" @click.stop>
                            <input type="checkbox" v-model="award.enabled" />
                        </label>
                        <b>{{ award.name }}</b>
                        <span>每 {{ award.cycleDays }} 天</span>
                        <AcIcon name="chevron" :size="14" />
                    </div>
                    <div v-if="editingAwardId === award.id" class="zg-awardrow__edit">
                        <AcField label="奖项名"><input class="zg-input" v-model.trim="award.name" maxlength="12" /></AcField>
                        <AcField label="举办周期（天）"><input class="zg-input" type="number" v-model.number="award.cycleDays" min="30" max="720" /></AcField>
                        <AcField label="得奖条件">
                            <div class="zg-condrow"><span>知名度 ≥</span><input class="zg-input is-mini" type="number" v-model.number="award.conditions.minFame" min="0" max="100" /></div>
                            <div class="zg-condrow"><span>完成作品 ≥</span><input class="zg-input is-mini" type="number" v-model.number="award.conditions.minWorks" min="0" max="20" /></div>
                            <div class="zg-condrow"><span>声台形表均值 ≥</span><input class="zg-input is-mini" type="number" v-model.number="award.conditions.minCraft" min="0" max="100" /></div>
                        </AcField>
                        <AcField label="奖金"><input class="zg-input" type="number" v-model.number="award.reward.money" min="0" /></AcField>
                    </div>
                </div>
                <div class="zg-allochead"><span>点锚点 · 世界观节日</span></div>
                <div v-for="fest in form.festivals" :key="fest.id" class="zg-festrow">
                    <label class="zg-check"><input type="checkbox" v-model="fest.enabled" /></label>
                    <b>{{ fest.name }}</b>
                    <span>每 {{ fest.everyDays }} 天 · {{ fest.desc }}</span>
                </div>
            </div>

            <!-- ⑤ NPC 名册预览 -->
            <div v-else-if="step === 4" class="zg-onboarding__panel">
                <p class="zg-note">这个档案专属的 30 位圈内人已经就位（由你的人设与世界确定性生成，换档不换人、换人设才换人）。每一档默认启用前 15 位，之后随时可调；其中 {{ rosterPreview.filter(n => n.hidden).length }} 位是隐藏人物，要靠实力或机缘揭开。</p>
                <div class="zg-rostergrid">
                    <div v-for="(npc, i) in rosterPreview" :key="npc.id" class="zg-rostercell" :class="{ 'is-hidden': npc.hidden }">
                        <AcAvatar :name="npc.hidden ? '?' : npc.name" :hue="npc.hue" :size="34" />
                        <b>{{ npc.hidden ? '？？？' : npc.name }}</b>
                        <i>{{ npc.hidden ? '未揭示' : npc.occupation }}</i>
                        <em v-if="!npc.hidden">{{ npc.mbti }}</em>
                    </div>
                </div>
            </div>

            <!-- ⑥ 开档 -->
            <div v-else class="zg-onboarding__panel">
                <AcField label="给第一档起个名字"><input class="zg-input" v-model.trim="form.saveName" maxlength="12" /></AcField>
                <div class="zg-summary">
                    <p><b>{{ form.stageName || s.identity.userName }}</b> · {{ tierInfo.label }}（{{ tierInfo.group }}）</p>
                    <p>{{ form.agencyStatus }}{{ form.genres.length ? ' · 擅长' + form.genres.join('/') : '' }}</p>
                    <p v-if="form.goal">目标：{{ form.goal }}</p>
                    <p class="zg-summary__hint">开档后时间从「现在」开始走。快进、跨日、锚点、突发事件都长在这条档内时间轴上；重开一档，时间回到原点。</p>
                </div>
            </div>

            <p v-if="error" class="zg-error">{{ error }}</p>

            <footer class="zg-onboarding__foot">
                <AcBtn v-if="step > 0" variant="ghost" @click="prev">上一步</AcBtn>
                <span class="zg-onboarding__spacer"></span>
                <AcBtn v-if="step < steps.length - 1" variant="ink" :disabled="!canNext" @click="next">下一步</AcBtn>
                <AcBtn v-else variant="gold" :loading="submitting" @click="submit">开始生涯</AcBtn>
            </footer>
        </div>
    `,
};
