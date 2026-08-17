/**
 * 小奇怪 · 打字机（欲言又止）
 *
 * 看 TA 在输入框里写下、停住、删掉、改成另一句的全过程。
 *
 * ── 这一版改了什么 ────────────────────────────────────────────────
 *
 * 1. **删掉 DEFAULT_PRESETS**。以前草稿箱空的时候会拿四条写死的草稿冒充
 *    「顾漾」的手笔,连署名都写好了。用户要求「去掉所有预设,真实 AI 拉取」——
 *    现在空就是空,页面给召唤入口。
 * 2. **底部常驻工具条拿掉**,收进顶部细浮条的抽屉(和沙漏一致)。
 * 3. 版式重做。以前 `.oq-tw-root` 是 `justify-content: space-between` +
 *    `min-height: 440px`,而中间只有一个小输入框 —— 于是标题和「在输入框里
 *    写下又删除的是什么…」之间被撑出一大块空白(用户截图里那个洞)。
 *    改成整块内容垂直居中的一栏,不再靠 space-between 撑。
 * 4. 人设走 `nook.listWorldAis()`(按当前世界观)。
 */

import { TYPEWRITER } from '../constants.js';
import * as store from '../store.js';
import { parseLooseJson, asArray } from '../utils.js';
import { generate } from '../services/ai-service.js';
import * as nook from '../services/nook-bridge.js';
import { cleanLine } from '../services/anon-service.js';
import { SHARED_COMPONENTS } from './shared.js';

/** 步骤列表洗一遍 —— 模型很爱把 count 写成字符串,或者塞一个没有 text 的 type */
function sanitizeSteps(raw, disableEmoji) {
    const out = [];
    for (const step of asArray(raw)) {
        const action = String(step?.action || '');
        if (action === 'type') {
            const text = cleanLine(step.text, { disableEmoji, max: 60 });
            if (text) out.push({ action: 'type', text });
        } else if (action === 'delete') {
            const count = Math.max(1, Math.floor(Number(step.count) || 0));
            if (count) out.push({ action: 'delete', count });
        } else if (action === 'pause') {
            out.push({ action: 'pause', ms: Math.min(4000, Math.max(200, Number(step.ms) || TYPEWRITER.pauseMs)) });
        }
        if (out.length >= 16) break;
    }
    return out;
}

export const OqViewTypewriter = {
    name: 'OqViewTypewriter',
    components: { ...SHARED_COMPONENTS },
    props: {
        app: { type: Object, default: null },
    },
    emits: ['notify'],
    data() {
        const settings = store.getSettings();
        const drafts = store.listHesitations();
        return {
            currentId: drafts.length ? drafts[0].id : '',
            displayText: '',
            isPlaying: false,
            isPaused: false,
            currentStepIdx: 0,

            aiLoading: false,
            lastError: '',
            selectedAiId: settings.typewriterAiId || '',
            customPrompt: settings.typewriterCustomPrompt || '',
            disableEmoji: settings.typewriterDisableEmoji !== false,

            /** 抽屉里的二级页:'' | 'drafts' | 'persona' | 'create' */
            drawer: '',
            createForm: { title: '', first: '', second: '', last: '' },
        };
    },
    computed: {
        panel() { return store.getState().panel; },
        drafts() { return store.listHesitations(); },
        currentDraft() {
            return this.drafts.find((d) => d.id === this.currentId) || this.drafts[0] || null;
        },
        steps() { return asArray(this.currentDraft?.steps); },
        hasDraft() { return this.steps.length > 0; },
        aiCandidates() { return nook.listWorldAis(); },
        activePersona() {
            if (this.selectedAiId) {
                const found = this.aiCandidates.find((c) => c.id === this.selectedAiId);
                if (found) return found;
            }
            return this.aiCandidates[0] || null;
        },
        personaName() { return this.activePersona?.name || ''; },
        apiReady() { return nook.listApiRefs().length > 0; },
        progressPct() {
            if (!this.steps.length) return 0;
            return Math.round((this.currentStepIdx / this.steps.length) * 100);
        },
        emptyHint() {
            if (!this.aiCandidates.length) return '当前世界观里还没有 AI 角色,先去 nook 添加一个';
            if (!this.apiReady) return nook.describeMissingApi();
            return '让 TA 在输入框里写一段,或者自己编一段';
        },
    },
    watch: {
        selectedAiId(val) { store.patchSettings({ typewriterAiId: val }); },
        customPrompt(val) { store.patchSettings({ typewriterCustomPrompt: val }); },
        disableEmoji(val) { store.patchSettings({ typewriterDisableEmoji: val }); },
        currentId() { this.play(); },
    },
    mounted() {
        if (!this.selectedAiId && this.aiCandidates.length) {
            this.selectedAiId = this.aiCandidates[0].id;
        }
        if (this.hasDraft) this.play();
    },
    beforeUnmount() {
        this.stop();
    },
    methods: {
        closePanel() {
            this.drawer = '';
            store.closePanel();
        },

        // ---------- 动效引擎 ----------
        stop() {
            if (this._timer) clearTimeout(this._timer);
            this._timer = null;
            this.isPlaying = false;
        },

        play() {
            this.stop();
            if (!this.hasDraft) return;
            this.displayText = '';
            this.currentStepIdx = 0;
            this.isPlaying = true;
            this.isPaused = false;
            this.step();
        },

        togglePlay() {
            if (!this.isPlaying) {
                this.play();
                return;
            }
            if (this.isPaused) {
                this.isPaused = false;
                this.step();
            } else {
                this.isPaused = true;
                if (this._timer) clearTimeout(this._timer);
            }
        },

        step() {
            if (this.isPaused || !this.isPlaying) return;
            const steps = this.steps;
            if (this.currentStepIdx >= steps.length) {
                this._timer = setTimeout(() => {
                    this.displayText = '';
                    this.currentStepIdx = 0;
                    this.step();
                }, 2600);
                return;
            }
            const step = steps[this.currentStepIdx];
            this.currentStepIdx += 1;

            if (step.action === 'type') {
                this.typeOut(step.text || '', () => this.step());
            } else if (step.action === 'delete') {
                this.deleteBack(Number(step.count) || this.displayText.length, () => this.step());
            } else {
                this._timer = setTimeout(() => this.step(), step.ms || TYPEWRITER.pauseMs);
            }
        },

        typeOut(target, done) {
            const chars = Array.from(target);
            let i = 0;
            const next = () => {
                if (this.isPaused || !this.isPlaying) return;
                if (i < chars.length) {
                    this.displayText += chars[i];
                    i += 1;
                    this._timer = setTimeout(next, TYPEWRITER.typeSpeedMs + Math.random() * 40);
                } else {
                    done?.();
                }
            };
            next();
        },

        deleteBack(count, done) {
            let remain = count;
            const next = () => {
                if (this.isPaused || !this.isPlaying) return;
                if (remain > 0 && this.displayText.length > 0) {
                    this.displayText = this.displayText.slice(0, -1);
                    remain -= 1;
                    this._timer = setTimeout(next, TYPEWRITER.deleteSpeedMs + Math.random() * 20);
                } else {
                    done?.();
                }
            };
            next();
        },

        // ---------- 召唤 ----------
        async summon() {
            if (this.aiLoading) return;
            const persona = this.activePersona;
            if (!persona) {
                this.$emit('notify', '当前世界观里还没有 AI 角色');
                return;
            }
            const apiRef = nook.resolveApiRefFor(persona);
            if (!apiRef) {
                this.lastError = nook.describeMissingApi();
                this.$emit('notify', this.lastError);
                return;
            }

            this.aiLoading = true;
            this.lastError = '';

            const system = [
                `你是【${persona.name}】。`,
                nook.describeAi(persona),
                nook.describeWorld(nook.getWorld('', nook.getPlayerCard(''))),
                this.customPrompt ? `补充设定:${this.customPrompt}` : '',
                '',
                '场景:你正对着和 TA 的聊天输入框。你打了一句真话,盯着看了几秒,',
                '又一个字一个字删掉,最后改成一句安全得多的话发出去。',
                '',
                '把这个过程拆成动作步骤输出。可用的动作只有三种:',
                '  {"action":"type","text":"..."}   敲字',
                '  {"action":"pause","ms":1200}     停住不动',
                '  {"action":"delete","count":8}    退格删掉几个字',
                '',
                '要求:至少一次 type → pause → delete → type,总步数不超过 10。',
                '每段 text 在 24 字以内。',
                this.disableEmoji ? '不要使用任何 emoji。' : '',
                '只输出 JSON:{"title":"四到六字的题目","steps":[...],"finalPreview":"最后留在框里的那句"}',
            ].filter(Boolean).join('\n');

            const res = await generate({
                apiRef,
                systemPrompt: system,
                userTurn: '（你在输入框里写下又删掉的是什么）',
                temperature: 1,
            });
            this.aiLoading = false;

            if (!res.ok) {
                this.lastError = res.error || '没有等到回应';
                this.$emit('notify', this.lastError);
                return;
            }
            const parsed = parseLooseJson(res.text);
            const steps = sanitizeSteps(parsed?.steps, this.disableEmoji);
            if (steps.length < 2) {
                this.lastError = 'AI 没有按格式回,再试一次';
                this.$emit('notify', this.lastError);
                return;
            }
            const created = store.addHesitation({
                title: cleanLine(parsed?.title, { disableEmoji: true, max: 16 }) || '欲言又止',
                author: persona.name,
                steps,
                finalPreview: cleanLine(parsed?.finalPreview, { disableEmoji: this.disableEmoji, max: 60 }),
            });
            this.select(created.id);
            this.drawer = '';
            this.$emit('notify', `${persona.name} 写了一段`);
        },

        // ---------- 草稿 ----------
        select(id) {
            this.currentId = id;
            this.drawer = '';
            store.closePanel();
        },

        removeDraft(id) {
            store.removeHesitation(id);
            if (this.currentId === id) {
                this.currentId = this.drafts.length ? this.drafts[0].id : '';
                this.stop();
                this.displayText = '';
                if (this.currentId) this.play();
            }
            this.$emit('notify', '删掉了');
        },

        submitCustom() {
            const form = this.createForm;
            const first = form.first.trim();
            if (!first) {
                this.$emit('notify', '至少要写第一句');
                return;
            }
            const steps = [
                { action: 'type', text: first },
                { action: 'pause', ms: 1400 },
                { action: 'delete', count: Array.from(first).length },
            ];
            const second = form.second.trim();
            if (second) {
                steps.push({ action: 'type', text: second });
                steps.push({ action: 'pause', ms: 1200 });
                steps.push({ action: 'delete', count: Array.from(second).length });
            }
            const last = (form.last || first).trim();
            steps.push({ action: 'type', text: last });
            steps.push({ action: 'pause', ms: 1800 });

            const created = store.addHesitation({
                title: form.title.trim() || '我写的',
                author: '我',
                steps,
                finalPreview: last,
            });
            this.createForm = { title: '', first: '', second: '', last: '' };
            this.select(created.id);
            this.$emit('notify', '编好了,开始播');
        },

        saveToFavorites() {
            if (!this.currentDraft) return;
            store.addFavorite({
                kind: 'typewriter',
                title: this.currentDraft.title,
                content: this.currentDraft.finalPreview || this.displayText,
                meta: {
                    personaName: this.currentDraft.author,
                    steps: this.currentDraft.steps,
                    finalPreview: this.currentDraft.finalPreview,
                },
            });
            this.$emit('notify', '收进「藏」里了');
        },

        pickPersona(id) {
            this.selectedAiId = id;
            this.drawer = '';
        },
    },
    template: `
        <div class="oq-tw-root">
            <div class="oq-tw-stage">
                <template v-if="hasDraft">
                    <div class="oq-tw-title-badge">
                        <span class="oq-tw-dot"></span>
                        <span class="oq-tw-title">{{ currentDraft.title }}</span>
                        <span v-if="currentDraft.author" class="oq-tw-author">· {{ currentDraft.author }}</span>
                    </div>

                    <p class="oq-tw-prompt-hint">在输入框里写下又删除的是什么</p>

                    <div class="oq-tw-input-shell">
                        <div class="oq-tw-screen">
                            <span class="oq-tw-text">{{ displayText }}</span>
                            <span class="oq-tw-cursor">_</span>
                        </div>
                    </div>

                    <div class="oq-tw-progress-bar">
                        <div class="oq-tw-progress-fill" :style="{ width: progressPct + '%' }"></div>
                    </div>

                    <button type="button" class="oq-tw-toggle" @click="togglePlay">
                        {{ (isPlaying && !isPaused) ? '暂停' : '继续' }}
                    </button>
                </template>

                <div v-else class="oq-tw-blank">
                    <p class="oq-tw-blank-title">输入框是空的</p>
                    <p class="oq-tw-blank-hint">{{ emptyHint }}</p>
                    <OqButton
                        v-if="aiCandidates.length && apiReady"
                        variant="primary"
                        :loading="aiLoading"
                        @click="summon"
                    >让 TA 写一段</OqButton>
                </div>
            </div>

            <!-- 工具抽屉 -->
            <OqPanel
                v-if="panel === 'tools'"
                :title="drawer === 'drafts' ? '草稿箱' : (drawer === 'persona' ? '换一个人' : (drawer === 'create' ? '自己编一段' : '打字机'))"
                :subtitle="drawer ? '' : (personaName ? ('现在是 ' + personaName) : '还没挑人')"
                :tall="drawer !== ''"
                @close="closePanel"
            >
                <!-- 草稿箱 -->
                <div v-if="drawer === 'drafts'">
                    <OqRow
                        v-for="d in drafts"
                        :key="d.id"
                        :title="d.title"
                        :desc="d.finalPreview || (d.author + ' 写的')"
                        :active="currentId === d.id"
                        @click="select(d.id)"
                    >
                        <template #acts>
                            <OqMiniBtn tone="danger" @click="removeDraft(d.id)">删除</OqMiniBtn>
                        </template>
                    </OqRow>
                    <OqEmpty v-if="!drafts.length" text="草稿箱是空的" hint="回上一层召唤一段" />
                </div>

                <!-- 换人 -->
                <div v-else-if="drawer === 'persona'">
                    <OqRow
                        v-for="c in aiCandidates"
                        :key="c.id"
                        :title="c.name"
                        :desc="c.personality || c.bio || '没写性格'"
                        :active="selectedAiId === c.id"
                        @click="pickPersona(c.id)"
                    />
                    <OqEmpty v-if="!aiCandidates.length" text="这个世界观里还没有 AI 角色" hint="去 nook 添加一个" />
                </div>

                <!-- 自己编 -->
                <div v-else-if="drawer === 'create'">
                    <label class="oq-field">
                        <span class="oq-field-label">题目</span>
                        <input v-model="createForm.title" class="oq-input" placeholder="没发出去的那句" />
                    </label>
                    <label class="oq-field">
                        <span class="oq-field-label">先打了这句（必填）</span>
                        <input v-model="createForm.first" class="oq-input" placeholder="我其实一直在想你" />
                    </label>
                    <label class="oq-field">
                        <span class="oq-field-label">又试了一句（可不填）</span>
                        <input v-model="createForm.second" class="oq-input" placeholder="你今天有空吗" />
                    </label>
                    <label class="oq-field">
                        <span class="oq-field-label">最后留下的</span>
                        <input v-model="createForm.last" class="oq-input" placeholder="早点休息" />
                    </label>
                </div>

                <!-- 主页 -->
                <div v-else>
                    <div class="oq-panel-actions">
                        <OqButton
                            variant="primary"
                            block
                            :loading="aiLoading"
                            :disabled="!aiCandidates.length"
                            @click="summon"
                        >让 TA 再写一段</OqButton>
                    </div>

                    <div class="oq-panel-row">
                        <OqMiniBtn @click="drawer = 'drafts'">草稿箱 {{ drafts.length }}</OqMiniBtn>
                        <OqMiniBtn @click="drawer = 'create'">自己编</OqMiniBtn>
                        <OqMiniBtn @click="drawer = 'persona'">换个人</OqMiniBtn>
                        <OqMiniBtn :disabled="!hasDraft" @click="saveToFavorites">收藏</OqMiniBtn>
                    </div>

                    <p v-if="lastError" class="oq-panel-error">{{ lastError }}</p>

                    <label class="oq-field">
                        <span class="oq-field-label">补充设定</span>
                        <textarea
                            v-model="customPrompt"
                            class="oq-input"
                            rows="3"
                            placeholder="例如：写到表白就会全部删掉，最后只发得出一句废话"
                        ></textarea>
                    </label>

                    <OqSwitch v-model="disableEmoji" label="不要 emoji" hint="只出纯文字" />
                </div>

                <template v-if="drawer !== ''" #foot>
                    <div v-if="drawer === 'create'" class="oq-panel-row">
                        <OqMiniBtn @click="drawer = ''">返回</OqMiniBtn>
                        <OqMiniBtn tone="accent" @click="submitCustom">编好了</OqMiniBtn>
                    </div>
                    <OqButton v-else block @click="drawer = ''">返回</OqButton>
                </template>
            </OqPanel>
        </div>
    `,
};

export default OqViewTypewriter;
