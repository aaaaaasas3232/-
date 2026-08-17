/**
 * 声浪 · 首次配置（七步向导）
 *
 * ① 身份（选手 ID / 论坛马甲）→ ② 项目（游戏模型 / 游戏名 / 位置）
 * → ③ 起点定位（青训替补 → 世界第一人）→ ④ 初始加点（预算随起点，人气锁定）
 * → ⑤ 战队（自己队必填，其余可一键随机；预览确定性队友）
 * → ⑥ 锚点（四大赛 + 娱乐赛可编辑，节日可启停）→ ⑦ 合同与开档
 *
 * 严肃配置：不完成不能进主界面；全程不调 AI。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import {
    ALLOC_KEYS, ATTR_DEFS, ATTR_MAX, START_TIERS, startTierSpec,
} from '../constants.js';
import {
    blankAllocation, defaultFestivalConfig, defaultTournamentConfig,
    randomizeTournaments, suggestAllocation, validateAllocation,
} from '../services/career-engine.js';
import { generateRoster, generateTeams } from '../services/npc-engine.js';
import { GAME_MODELS, gameModelById } from '../../esports-shared/esports-kit.js';
import { hashString } from '../utils.js';

export const EfOnboarding = {
    name: 'EfOnboarding',
    components: { ...UI },
    data() {
        const startTier = 3;
        return {
            step: 0,
            steps: ['身份', '项目', '起点', '加点', '战队', '锚点', '开档'],
            form: {
                gameId: '',
                realNameShown: '',
                region: '荣耀赛区',
                forumHandle: '',
                motto: '',
                honorsInit: '',
                modelId: 'moba',
                gameName: '',
                positionId: 'farm',
                startTier,
                attrs: blankAllocation(startTier).attrs,
                userTeamName: '',
                teamNames: {},
                tournaments: defaultTournamentConfig(),
                festivals: defaultFestivalConfig(),
                salary: { monthSalary: 0, winBonus: 0 },
                saveName: '第 1 档',
            },
            teamSeedSalt: 0,
            editingTournamentId: '',
            error: '',
            submitting: false,
        };
    },
    computed: {
        s() { return store.getState(); },
        models() { return GAME_MODELS; },
        model() { return gameModelById(this.form.modelId); },
        tiers() { return START_TIERS; },
        tierInfo() { return startTierSpec(this.form.startTier); },
        allocKeys() { return ALLOC_KEYS; },
        attrMax() { return ATTR_MAX; },
        allocation() { return validateAllocation(this.form.attrs, this.form.startTier); },
        defaultTeams() {
            const key = this.s.identity.profileKey;
            return key ? generateTeams(key) : [];
        },
        rosterPreview() {
            const key = this.s.identity.profileKey;
            if (!key) return null;
            return generateRoster(key, this.form.modelId, this.form.positionId);
        },
        myTeammates() {
            if (!this.rosterPreview) return [];
            return this.rosterPreview.players.filter((p) => p.teamId === 'team-1');
        },
        myCoach() {
            if (!this.rosterPreview) return null;
            return this.rosterPreview.coaches.find((c) => c.teamId === 'team-1') || null;
        },
        defaultHandle() {
            const key = this.s.identity.profileKey || 'x';
            return `峡谷来客${hashString(key) % 9000 + 1000}`;
        },
        salaryPlaceholder() { return this.tierInfo.monthSalary; },
        bonusPlaceholder() { return this.tierInfo.winBonus; },
        canNext() {
            if (this.step === 0) return Boolean(this.form.gameId.trim());
            if (this.step === 3) return this.allocation.ok;
            if (this.step === 4) return Boolean(this.userTeamNameFinal.trim());
            return true;
        },
        userTeamNameFinal() {
            return this.form.userTeamName || this.defaultTeams[0]?.defaultName || '';
        },
    },
    methods: {
        labelOf(key) {
            if (key === 'pool') return `${this.model.heroNoun}池`;
            return ATTR_DEFS.find((a) => a.key === key)?.label || key;
        },
        pickModel(id) {
            this.form.modelId = id;
            this.form.positionId = gameModelById(id).positions[0].id;
        },
        pickTier(tier) {
            this.form.startTier = tier;
            this.form.attrs = blankAllocation(tier).attrs;
        },
        bump(key, delta) {
            const next = Math.max(0, Math.min(ATTR_MAX, (Number(this.form.attrs[key]) || 0) + delta));
            const test = { ...this.form.attrs, [key]: next };
            const check = validateAllocation(test, this.form.startTier);
            if (delta > 0 && !check.ok) return;
            this.form.attrs = test;
        },
        autoAlloc() {
            this.form.attrs = suggestAllocation(this.form.startTier, this.s.identity.profileKey, this.form.positionId);
        },
        clearAlloc() {
            this.form.attrs = blankAllocation(this.form.startTier).attrs;
        },
        teamNameOfPreview(team) {
            return this.form.teamNames[team.id] || team.defaultName;
        },
        rollTeamNames() {
            this.teamSeedSalt += 1;
            const fresh = generateTeams(`${this.s.identity.profileKey}::salt${this.teamSeedSalt}`);
            const map = {};
            this.defaultTeams.forEach((team, i) => {
                if (team.id === 'team-1') return;
                map[team.id] = fresh[i]?.defaultName || team.defaultName;
            });
            this.form.teamNames = map;
        },
        rollMyTeamName() {
            this.teamSeedSalt += 1;
            const fresh = generateTeams(`${this.s.identity.profileKey}::mine${this.teamSeedSalt}`);
            this.form.userTeamName = fresh[hashString(`m${this.teamSeedSalt}`) % fresh.length].defaultName;
        },
        rollTournaments() {
            this.form.tournaments = randomizeTournaments(String(Date.now()));
        },
        resetTournaments() {
            this.form.tournaments = defaultTournamentConfig();
        },
        prev() { if (this.step > 0) this.step -= 1; },
        next() {
            this.error = '';
            if (this.step === 0 && !this.form.gameId.trim()) {
                this.error = '先给自己起一个选手 ID';
                return;
            }
            if (this.step === 3 && !this.allocation.ok) {
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
                const result = await store.completeSetup({
                    ...this.form,
                    forumHandle: this.form.forumHandle || this.defaultHandle,
                    userTeamName: this.userTeamNameFinal,
                });
                if (!result.ok) this.error = result.error || '配置失败';
            } finally {
                this.submitting = false;
            }
        },
    },
    template: `
        <div class="ef-onboarding">
            <header class="ef-onboarding__head">
                <h2>声浪 · 电竞生涯</h2>
                <p>先把这个电竞世界观搭起来：项目、赛制、战队、你自己。这些配置决定整条生涯的数值与概率。</p>
                <div class="ef-onboarding__steps">
                    <span v-for="(label, i) in steps" :key="label"
                        class="ef-onboarding__step" :class="{ 'is-on': i === step, 'is-done': i < step }">
                        {{ label }}
                    </span>
                </div>
            </header>

            <!-- ① 身份 -->
            <div v-if="step === 0" class="ef-onboarding__panel">
                <EfField label="选手 ID（赛场上的名字）">
                    <input class="ef-input" v-model.trim="form.gameId" placeholder="如：野火 / Rime" maxlength="14" />
                </EfField>
                <EfField label="对外展示的本名（可空）">
                    <input class="ef-input" v-model.trim="form.realNameShown" :placeholder="s.identity.userName" maxlength="12" />
                </EfField>
                <EfField label="赛区名">
                    <input class="ef-input" v-model.trim="form.region" maxlength="12" />
                </EfField>
                <EfField label="论坛马甲（默认匿名 —— 选手掉码很严重）" :hint="'不填就用：' + defaultHandle">
                    <input class="ef-input" v-model.trim="form.forumHandle" :placeholder="defaultHandle" maxlength="16" />
                </EfField>
                <EfField label="赛场宣言（可空）">
                    <input class="ef-input" v-model.trim="form.motto" placeholder="如：版本会变，冠军不变" maxlength="30" />
                </EfField>
                <EfField label="入行前荣誉（可空，AI 永远不会覆盖这里）">
                    <input class="ef-input" v-model.trim="form.honorsInit" placeholder="如：城市赛冠军、巅峰赛国服前十" maxlength="60" />
                </EfField>
            </div>

            <!-- ② 项目 -->
            <div v-else-if="step === 1" class="ef-onboarding__panel">
                <p class="ef-note">这个世界观的电竞项目是什么？模型决定位置表与比赛节奏（赛制都走 SAB 升降级）。</p>
                <div class="ef-modelgrid">
                    <button v-for="m in models" :key="m.id" type="button"
                        class="ef-modelcell" :class="{ 'is-on': form.modelId === m.id }"
                        @click="pickModel(m.id)">
                        <b>{{ m.label }}</b>
                        <i>{{ m.desc }}</i>
                        <em>{{ m.teamSize }} 人首发 · {{ m.rankName }}</em>
                    </button>
                </div>
                <EfField label="这款游戏在这个世界里叫什么">
                    <input class="ef-input" v-model.trim="form.gameName" :placeholder="model.defaultGameName" maxlength="14" />
                </EfField>
                <EfField label="你的位置">
                    <div class="ef-chiprow">
                        <button v-for="p in model.positions" :key="p.id" type="button"
                            class="ef-chip" :class="{ 'is-on': form.positionId === p.id }"
                            @click="form.positionId = p.id">{{ p.label }}</button>
                    </div>
                </EfField>
            </div>

            <!-- ③ 起点 -->
            <div v-else-if="step === 2" class="ef-onboarding__panel">
                <p class="ef-note">从哪里开始打？起点决定初始人气、加点预算、月薪与巅峰分 —— 越有名，树越大，风越大。</p>
                <div class="ef-tiergrid">
                    <button v-for="t in tiers" :key="t.tier" type="button"
                        class="ef-tiercell" :class="{ 'is-on': form.startTier === t.tier }"
                        @click="pickTier(t.tier)">
                        <b>{{ t.label }}</b><i>{{ t.group }}</i>
                    </button>
                </div>
                <div class="ef-tierinfo">
                    <p class="ef-tierinfo__group">{{ tierInfo.group }} —— {{ tierInfo.desc }}</p>
                    <div class="ef-tierinfo__rows">
                        <span>初始人气 <b>{{ tierInfo.fameBase }}</b>/100</span>
                        <span>加点预算 <b>{{ tierInfo.budget }}</b> 点</span>
                        <span>月薪基准 <b>{{ tierInfo.monthSalary }}</b></span>
                        <span>起始巅峰分 <b>{{ tierInfo.peakRating }}</b></span>
                    </div>
                </div>
            </div>

            <!-- ④ 加点 -->
            <div v-else-if="step === 3" class="ef-onboarding__panel">
                <div class="ef-allochead">
                    <span>预算 <b>{{ allocation.budget }}</b> · 已用 <b>{{ allocation.spent || 0 }}</b> · 剩 <b :class="{ 'is-over': !allocation.ok }">{{ allocation.ok ? allocation.left : '超了' }}</b></span>
                    <span class="ef-allochead__actions">
                        <EfBtn size="sm" variant="soft" @click="autoAlloc">按位置推荐</EfBtn>
                        <EfBtn size="sm" variant="ghost" @click="clearAlloc">清零</EfBtn>
                    </span>
                </div>
                <div v-for="key in allocKeys" :key="key" class="ef-allocrow">
                    <EfBar :label="labelOf(key)" :value="Number(form.attrs[key]) || 0" :max="attrMax" />
                    <div class="ef-allocrow__ops">
                        <button type="button" class="ef-step" @click="bump(key, -5)">-5</button>
                        <button type="button" class="ef-step" @click="bump(key, -1)">-</button>
                        <button type="button" class="ef-step" @click="bump(key, 1)">+</button>
                        <button type="button" class="ef-step" @click="bump(key, 5)">+5</button>
                    </div>
                </div>
                <div class="ef-allocrow is-locked">
                    <EfBar label="人气（由起点定位锁定）" :value="tierInfo.fameBase" :max="attrMax" kind="fame" />
                    <EfIcon name="lock" :size="16" />
                </div>
            </div>

            <!-- ⑤ 战队 -->
            <div v-else-if="step === 4" class="ef-onboarding__panel">
                <EfField label="你的战队叫什么（必填）">
                    <div class="ef-inline">
                        <input class="ef-input" v-model.trim="form.userTeamName" :placeholder="defaultTeams[0] ? defaultTeams[0].defaultName : ''" maxlength="14" />
                        <EfBtn size="sm" variant="soft" iconName="dice" @click="rollMyTeamName">随机</EfBtn>
                    </div>
                </EfField>
                <div class="ef-allochead">
                    <span>其余 17 支战队（可逐个改名）</span>
                    <span class="ef-allochead__actions">
                        <EfBtn size="sm" variant="soft" iconName="dice" @click="rollTeamNames">全部随机</EfBtn>
                    </span>
                </div>
                <div class="ef-teamlist">
                    <div v-for="team in defaultTeams.slice(1)" :key="team.id" class="ef-teamrow">
                        <EfAvatar :name="teamNameOfPreview(team)" :hue="team.hue" :size="28" />
                        <input class="ef-input is-mini" :value="form.teamNames[team.id] || ''" :placeholder="team.defaultName"
                            maxlength="14" @input="form.teamNames = { ...form.teamNames, [team.id]: $event.target.value }" />
                        <span class="ef-teamrow__tag">{{ team.tag }}</span>
                    </div>
                </div>
                <div class="ef-allochead"><span>你的队友（由档案确定性生成，进去后可换成 AI 角色卡）</span></div>
                <div class="ef-rostergrid">
                    <div v-for="p in myTeammates" :key="p.id" class="ef-rostercell">
                        <EfAvatar :name="p.gameId" :hue="p.hue" :size="32" />
                        <b>{{ p.gameId }}</b>
                        <i>{{ p.isSub ? '替补' : '首发' }} · {{ p.mbti }}</i>
                    </div>
                    <div v-if="myCoach" class="ef-rostercell is-coach">
                        <EfAvatar :name="myCoach.realName" :hue="myCoach.hue" :size="32" />
                        <b>{{ myCoach.realName }}指导</b>
                        <i>{{ myCoach.style }}</i>
                    </div>
                </div>
            </div>

            <!-- ⑥ 锚点 -->
            <div v-else-if="step === 5" class="ef-onboarding__panel">
                <div class="ef-allochead">
                    <span>段锚点 · 赛事（四大赛 + 娱乐赛，循环举办）</span>
                    <span class="ef-allochead__actions">
                        <EfBtn size="sm" variant="soft" iconName="dice" @click="rollTournaments">随机一套</EfBtn>
                        <EfBtn size="sm" variant="ghost" @click="resetTournaments">恢复默认</EfBtn>
                    </span>
                </div>
                <div v-for="t in form.tournaments" :key="t.id" class="ef-awardrow">
                    <div class="ef-awardrow__head" @click="editingTournamentId = editingTournamentId === t.id ? '' : t.id">
                        <label class="ef-check" @click.stop>
                            <input type="checkbox" v-model="t.enabled" />
                        </label>
                        <b>{{ t.name }}</b>
                        <span>{{ t.kind === 'major' ? '大赛' : '娱乐' }} · {{ t.format === 'sab' ? 'SAB' : t.format === 'cup' ? '十强杯' : '表演赛' }}</span>
                        <EfIcon name="chevron" :size="14" />
                    </div>
                    <div v-if="editingTournamentId === t.id" class="ef-awardrow__edit">
                        <EfField label="赛事名"><input class="ef-input" v-model.trim="t.name" maxlength="14" /></EfField>
                        <EfField label="个人夺冠奖金"><input class="ef-input" type="number" v-model.number="t.prizeChampion" min="0" /></EfField>
                        <EfField label="个人亚军奖金"><input class="ef-input" type="number" v-model.number="t.prizeRunner" min="0" /></EfField>
                        <EfField label="赛后休赛天数"><input class="ef-input" type="number" v-model.number="t.gapDays" min="1" max="60" /></EfField>
                    </div>
                </div>
                <div class="ef-allochead"><span>点锚点 · 世界观节日</span></div>
                <div v-for="fest in form.festivals" :key="fest.id" class="ef-festrow">
                    <label class="ef-check"><input type="checkbox" v-model="fest.enabled" /></label>
                    <b>{{ fest.name }}</b>
                    <span>每 {{ fest.everyDays }} 天 · {{ fest.desc }}</span>
                </div>
            </div>

            <!-- ⑦ 开档 -->
            <div v-else class="ef-onboarding__panel">
                <EfField label="月薪（世界观货币）" :hint="'不填按起点基准：' + salaryPlaceholder">
                    <input class="ef-input" type="number" v-model.number="form.salary.monthSalary" :placeholder="String(salaryPlaceholder)" min="0" />
                </EfField>
                <EfField label="赢一场系列赛的奖金" :hint="'不填按起点基准：' + bonusPlaceholder">
                    <input class="ef-input" type="number" v-model.number="form.salary.winBonus" :placeholder="String(bonusPlaceholder)" min="0" />
                </EfField>
                <EfField label="给第一档起个名字">
                    <input class="ef-input" v-model.trim="form.saveName" maxlength="12" />
                </EfField>
                <div class="ef-summary">
                    <p><b>{{ form.gameId }}</b> · {{ tierInfo.label }} · {{ userTeamNameFinal }}</p>
                    <p>{{ model.label }} · {{ form.gameName || model.defaultGameName }}</p>
                    <p v-if="form.motto">宣言：{{ form.motto }}</p>
                    <p class="ef-summary__hint">开档后时间从「现在」开始走，两天后第一个赛事开赛。快进、跨日、锚点、突发事件都长在这条档内时间轴上；重开一档，时间回到原点。</p>
                </div>
            </div>

            <p v-if="error" class="ef-error">{{ error }}</p>

            <footer class="ef-onboarding__foot">
                <EfBtn v-if="step > 0" variant="ghost" @click="prev">上一步</EfBtn>
                <span class="ef-onboarding__spacer"></span>
                <EfBtn v-if="step < steps.length - 1" variant="ink" :disabled="!canNext" @click="next">下一步</EfBtn>
                <EfBtn v-else variant="volt" :loading="submitting" @click="submit">开始生涯</EfBtn>
            </footer>
        </div>
    `,
};
