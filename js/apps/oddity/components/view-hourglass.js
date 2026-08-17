/**
 * 小奇怪 · 沙漏（双面心语 · 黑白颠倒）
 *
 * ── 核心 ──────────────────────────────────────────────────────────
 *   手机正着 → 白面,是 TA 在白昼里说得出口的那句。
 *   手机倒过来 → 黑色流体涨满整屏,字跟着转 180°,露出底下那句。
 *   翻转由 `deviceorientation` 自动判,也可以双击 / 从工具抽屉里手动翻。
 *
 * ── 这一版改了什么 ────────────────────────────────────────────────
 *
 * 1. **删掉了 DEFAULT_PAIRS**。以前这里躺着六组写死的情话,没配 API 时
 *    随机挑一组显示,并且提示「已生成 XX 的双面心语」—— 用户看到的是常量,
 *    以为是 AI 写的。现在没内容就是没内容,页面直接给召唤入口。
 * 2. **底部那条常驻工具条(oq-hg-actionbar)整个拿掉**。它压在自绘底栏上面,
 *    两条栏叠着谁都点不准;而且这一页的全部意义是「一句话铺满屏幕」,
 *    底下横着六个按钮就没气氛了。工具收进顶部细浮条的抽屉。
 * 3. 人设走 `nook.listWorldAis()` —— 以前是 `listSeatCandidates()` 不传 world,
 *    把所有世界观的角色都端出来了。
 */

import * as store from '../store.js';
import { parseLooseJson } from '../utils.js';
import { generate } from '../services/ai-service.js';
import * as nook from '../services/nook-bridge.js';
import { cleanLine } from '../services/anon-service.js';
import { SHARED_COMPONENTS } from './shared.js';

const PARTICLE_COUNT = 16;

export const OqViewHourglass = {
    name: 'OqViewHourglass',
    components: { ...SHARED_COMPONENTS },
    props: {
        app: { type: Object, default: null },
    },
    emits: ['notify'],
    data() {
        const settings = store.getSettings();
        return {
            flipped: false,
            particles: [],
            ripples: [],

            surfaceText: settings.hourglassSurfaceText || '',
            deepText: settings.hourglassDeepText || '',

            aiLoading: false,
            lastError: '',
            selectedAiId: settings.hourglassAiId || '',
            customPrompt: settings.hourglassCustomPrompt || '',
            disableEmoji: settings.hourglassDisableEmoji !== false,

            /** 抽屉里的二级页:'' | 'persona' */
            drawer: '',
        };
    },
    computed: {
        panel() { return store.getState().panel; },
        aiCandidates() { return nook.listWorldAis(); },
        activePersona() {
            if (this.selectedAiId) {
                const found = this.aiCandidates.find((c) => c.id === this.selectedAiId);
                if (found) return found;
            }
            return this.aiCandidates[0] || null;
        },
        personaName() { return this.activePersona?.name || ''; },
        hasContent() { return Boolean(this.surfaceText || this.deepText); },
        apiReady() { return nook.listApiRefs().length > 0; },
        fluidHeight() { return this.flipped ? '100%' : '24%'; },
        /** 空态时给一句「现在该做什么」,而不是一片白 */
        emptyHint() {
            if (!this.aiCandidates.length) return '当前世界观里还没有 AI 角色,先去 nook 添加一个';
            if (!this.apiReady) return nook.describeMissingApi();
            return '从右上角的抽屉里叫一句心语出来';
        },
    },
    watch: {
        surfaceText(val) { store.patchSettings({ hourglassSurfaceText: val }); },
        deepText(val) { store.patchSettings({ hourglassDeepText: val }); },
        selectedAiId(val) { store.patchSettings({ hourglassAiId: val }); },
        customPrompt(val) { store.patchSettings({ hourglassCustomPrompt: val }); },
        disableEmoji(val) { store.patchSettings({ hourglassDisableEmoji: val }); },
    },
    mounted() {
        this.buildParticles();
        this._rippleTimer = setInterval(() => {
            if (Math.random() > 0.45) this.addRipple();
        }, 2200);
        if (!this.selectedAiId && this.aiCandidates.length) {
            this.selectedAiId = this.aiCandidates[0].id;
        }
        this.initOrientationListener();
    },
    beforeUnmount() {
        if (this._rippleTimer) clearInterval(this._rippleTimer);
        this.detachOrientation();
        for (const ripple of this.ripples) clearTimeout(ripple.timer);
    },
    methods: {
        closePanel() {
            this.drawer = '';
            store.closePanel();
        },

        buildParticles() {
            const out = [];
            for (let i = 0; i < PARTICLE_COUNT; i += 1) {
                out.push({
                    id: `p-${i}`,
                    size: 2 + Math.random() * 6,
                    left: Math.random() * 100,
                    top: Math.random() * 100,
                    delay: Math.random() * 6,
                    duration: 4 + Math.random() * 4,
                });
            }
            this.particles = out;
        },

        addRipple() {
            const ripple = {
                id: `r-${Date.now().toString(36)}-${Math.floor(Math.random() * 999)}`,
                x: 15 + Math.random() * 70,
                y: 15 + Math.random() * 70,
                timer: null,
            };
            ripple.timer = setTimeout(() => {
                const index = this.ripples.findIndex((item) => item.id === ripple.id);
                if (index >= 0) this.ripples.splice(index, 1);
            }, 2000);
            this.ripples.push(ripple);
            if (this.ripples.length > 6) {
                const dropped = this.ripples.shift();
                if (dropped) clearTimeout(dropped.timer);
            }
        },

        // ---------- 翻转 ----------
        toggleFlip() {
            this.flipped = !this.flipped;
            for (let i = 0; i < 3; i += 1) setTimeout(() => this.addRipple(), i * 220);
        },

        initOrientationListener() {
            if (typeof window === 'undefined' || !window.DeviceOrientationEvent) return;
            this._onOrient = this.handleOrientation.bind(this);
            window.addEventListener('deviceorientation', this._onOrient, { passive: true });
        },

        handleOrientation(event) {
            const beta = Number(event?.beta);
            if (!Number.isFinite(beta)) return;
            const isUpsideDown = Math.abs(beta) > 130 || beta < -60;
            if (isUpsideDown !== this.flipped) {
                this.flipped = isUpsideDown;
                this.addRipple();
            }
        },

        detachOrientation() {
            if (this._onOrient) {
                window.removeEventListener('deviceorientation', this._onOrient);
                this._onOrient = null;
            }
        },

        // ---------- 召唤 ----------
        /**
         * 拿一组「表 / 里」。
         *
         * ★ 失败就是失败:把错误显示出来,**不切换到某组预设**。
         *   以前失败时会静默换一组常量并提示「已生成」—— 用户永远不知道
         *   自己的 Key 其实是坏的。
         */
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
                '给出一组反差极大的「双面心语」:',
                'surface —— 白昼里、理智还在的时候,你对 TA 说得出口的那句。克制、平常、留有余地。',
                'deep —— 手机颠倒过来、理智塌掉之后,你心底真正想说的那句。',
                '',
                '两句都在 24 字以内,不要旁白,不要引号。',
                this.disableEmoji ? '不要使用任何 emoji。' : '',
                '只输出 JSON:{"surface":"...","deep":"..."}',
            ].filter(Boolean).join('\n');

            const res = await generate({
                apiRef,
                systemPrompt: system,
                userTurn: '（此时此刻,你的表面话和心底那句是什么）',
                temperature: 1,
            });
            this.aiLoading = false;

            if (!res.ok) {
                this.lastError = res.error || '没有等到回应';
                this.$emit('notify', this.lastError);
                return;
            }
            const parsed = parseLooseJson(res.text);
            const surface = cleanLine(parsed?.surface, { disableEmoji: this.disableEmoji, max: 60 });
            const deep = cleanLine(parsed?.deep, { disableEmoji: this.disableEmoji, max: 60 });
            if (!surface || !deep) {
                this.lastError = 'AI 没有按格式回,再试一次';
                this.$emit('notify', this.lastError);
                return;
            }
            this.surfaceText = surface;
            this.deepText = deep;
            this.$emit('notify', `${persona.name} 的双面心语`);
        },

        saveToFavorites() {
            if (!this.hasContent) return;
            store.addFavorite({
                kind: 'hourglass',
                title: `${this.personaName || 'TA'} 的双面心语`,
                content: `【表】${this.surfaceText}\n【里】${this.deepText}`,
                meta: {
                    personaName: this.personaName,
                    surface: this.surfaceText,
                    deep: this.deepText,
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
        <div class="oq-hg" ref="stage" :class="{ 'is-flipped': flipped }" @dblclick="toggleFlip">
            <!-- 白面 -->
            <div class="oq-hg-white-layer" :class="{ 'is-faded': flipped }">
                <div class="oq-hg-status-tag">
                    <span class="oq-hg-tag-dot"></span>
                    <span>{{ personaName ? personaName + ' · 白昼' : '白昼' }}</span>
                </div>
                <div v-if="hasContent" class="oq-hg-content-box">
                    <p class="oq-hg-surface-text">{{ surfaceText }}</p>
                </div>
                <div v-else class="oq-hg-blank">
                    <p class="oq-hg-blank-title">还没有人说话</p>
                    <p class="oq-hg-blank-hint">{{ emptyHint }}</p>
                    <OqButton
                        v-if="aiCandidates.length && apiReady"
                        variant="primary"
                        :loading="aiLoading"
                        @click="summon"
                    >叫一句心语</OqButton>
                </div>
            </div>

            <!-- 黑面 -->
            <div class="oq-hg-black-fluid" :style="{ height: fluidHeight }" :class="{ 'is-active': flipped }">
                <div class="oq-hg-waves" aria-hidden="true"><i></i><i></i><i></i></div>
                <div class="oq-hg-sheen" aria-hidden="true"></div>
                <div class="oq-hg-particles" aria-hidden="true">
                    <i
                        v-for="dot in particles"
                        :key="dot.id"
                        :style="{
                            width: dot.size + 'px',
                            height: dot.size + 'px',
                            left: dot.left + '%',
                            top: dot.top + '%',
                            animationDelay: dot.delay + 's',
                            animationDuration: dot.duration + 's'
                        }"
                    ></i>
                </div>
                <span
                    v-for="ripple in ripples"
                    :key="ripple.id"
                    class="oq-hg-ripple"
                    :style="{ left: ripple.x + '%', top: ripple.y + '%' }"
                    aria-hidden="true"
                ></span>

                <div class="oq-hg-deep-wrapper" :class="{ 'is-visible': flipped }">
                    <div class="oq-hg-status-tag is-dark">
                        <span class="oq-hg-tag-dot is-dark"></span>
                        <span>心底</span>
                    </div>
                    <div class="oq-hg-content-box is-inverted">
                        <p class="oq-hg-deep-text">{{ deepText || '（这里还是空的）' }}</p>
                    </div>
                </div>
            </div>

            <!-- 工具抽屉：顶部细浮条上那一个键开的就是它 -->
            <OqPanel
                v-if="panel === 'tools'"
                :title="drawer === 'persona' ? '换一个人' : '沙漏'"
                :subtitle="drawer === 'persona' ? '双面心语由这个人设说出来' : (personaName ? ('现在是 ' + personaName) : '还没挑人')"
                :tall="drawer === 'persona'"
                :dark="flipped"
                @close="closePanel"
            >
                <div v-if="drawer === 'persona'">
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

                <div v-else>
                    <div class="oq-panel-actions">
                        <OqButton
                            variant="primary"
                            block
                            :loading="aiLoading"
                            :disabled="!aiCandidates.length"
                            @click="summon"
                        >{{ hasContent ? '换一组心语' : '叫一句心语' }}</OqButton>
                    </div>

                    <div class="oq-panel-row">
                        <OqMiniBtn @click="toggleFlip">{{ flipped ? '翻回白面' : '翻到黑面' }}</OqMiniBtn>
                        <OqMiniBtn @click="drawer = 'persona'">换个人</OqMiniBtn>
                        <OqMiniBtn :disabled="!hasContent" @click="saveToFavorites">收藏</OqMiniBtn>
                    </div>

                    <p v-if="lastError" class="oq-panel-error">{{ lastError }}</p>

                    <label class="oq-field">
                        <span class="oq-field-label">补充设定</span>
                        <textarea
                            v-model="customPrompt"
                            class="oq-input"
                            rows="3"
                            placeholder="例如：表面云淡风轻，心里其实一刻都没放下过"
                        ></textarea>
                    </label>

                    <OqSwitch v-model="disableEmoji" label="不要 emoji" hint="只出纯文字" />

                    <p class="oq-field-hint">把手机真的倒过来也会翻面。双击屏幕同理。</p>
                </div>

                <template v-if="drawer === 'persona'" #foot>
                    <OqButton block @click="drawer = ''">返回</OqButton>
                </template>
            </OqPanel>
        </div>
    `,
};

export default OqViewHourglass;
