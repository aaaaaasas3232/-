/**
 * 小奇怪 · 果冻心
 *
 * 一颗跟着手指变形的半透明心。快速戳 = 疼,按住慢慢摸 = 暖。
 *
 * ── 这一版改了什么 ────────────────────────────────────────────────
 *
 * 1. **删掉两组写死的台词**(DAMAGE_LINES / SOOTHE_LINES,一共 26 句)。
 *    改成「进页面时先跟真人设批量要一池子台词存着,摸的时候从池子里取」。
 *
 *    ★ 为什么是池子而不是每摸一下调一次:触摸反馈必须**当场**出字。
 *      等一次网络往返(几百毫秒到几秒)的话,气泡会在手指离开很久之后
 *      才冒出来,那就不是反馈了。池子存在 `library.personaLines[aiId]`,
 *      切走再回来不重新请求。
 *
 * 2. **拿掉工具栏上的「心声」键**。它和「摸一下就会说话」是同一件事的
 *    两个入口,而且按下去要等,体验比摸还差。现在说话只有一个来源:摸。
 *
 * 3. 工具收进面板(顶栏那个键),底部不再挂常驻工具条。
 *
 * 4. 人设走 `nook.listWorldAis()` —— 以前是 `listSeatCandidates()` 不传 world,
 *    把所有世界观的角色都端出来了(用户原话:「捏页的设定应该是从当前世界观
 *    下拉取的」)。
 */

import { JELLY } from '../constants.js';
import * as store from '../store.js';
import { clamp, pickOne, parseLooseJson, asArray } from '../utils.js';
import { generate } from '../services/ai-service.js';
import * as nook from '../services/nook-bridge.js';
import { cleanLine } from '../services/anon-service.js';
import { SHARED_COMPONENTS } from './shared.js';

/** 心形路径 —— 经典圆润心形 */
const HEART_PATH = 'm11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007-.004-.003-.001a.752.752 0 0 1-.704 0l-.003-.001Z';

/**
 * 能做的动作。
 *
 * ★ 这里只有**动作名**,没有台词 —— 台词一律现问 AI。
 *   以前每个动作后面跟着一句写死的回应,点十次都是同一句。
 */
const GESTURES = Object.freeze([
    { id: 'letter', name: '写情书', desc: '一笔一划写下名字' },
    { id: 'music', name: '放首歌', desc: '挑一首很轻的' },
    { id: 'choco', name: '递巧克力', desc: '一小颗,不太甜' },
    { id: 'hug', name: '抱一下', desc: '不说话,就抱着' },
    { id: 'water', name: '倒杯热水', desc: '放在手边' },
]);

let _bubbleSeq = 0;

export const OqToyJellyHeart = {
    name: 'OqToyJellyHeart',
    components: { ...SHARED_COMPONENTS },
    props: {
        app: { type: Object, default: null },
    },
    emits: ['notify'],
    data() {
        const settings = store.getSettings();
        return {
            heartPath: HEART_PATH,
            gestures: GESTURES,
            bubbles: [],
            heartTransform: '',
            heartFast: false,
            damage: false,
            touches: settings.jellyTouches || 0,

            poolLoading: false,
            lastError: '',
            selectedAiId: settings.jellyAiId || '',
            customPrompt: settings.jellyCustomPrompt || '',
            disableEmoji: settings.jellyDisableEmoji !== false,

            /** 抽屉里的二级页:'' | 'persona' | 'gesture' */
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
        personaName() { return this.activePersona?.name || '这颗心'; },
        apiReady() { return nook.listApiRefs().length > 0; },
        pool() {
            return store.getPersonaLines(this.activePersona?.id) || { hurt: [], soothe: [] };
        },
        poolReady() {
            return this.pool.hurt.length > 0 || this.pool.soothe.length > 0;
        },
        hint() {
            if (!this.aiCandidates.length) return '当前世界观里还没有 AI 角色,先去 nook 添加一个';
            if (this.poolLoading) return `正在听 ${this.personaName} 说话`;
            if (this.poolReady) return '轻轻戳一下会疼,按住慢慢摸会暖';
            if (!this.apiReady) return nook.describeMissingApi();
            return '从右上角把这颗心接上一个人设';
        },
    },
    watch: {
        touches(val) { store.patchSettings({ jellyTouches: val }); },
        selectedAiId(val) {
            store.patchSettings({ jellyAiId: val });
            void this.ensurePool();
        },
        customPrompt(val) { store.patchSettings({ jellyCustomPrompt: val }); },
        disableEmoji(val) { store.patchSettings({ jellyDisableEmoji: val }); },
    },
    mounted() {
        if (!this.selectedAiId && this.aiCandidates.length) {
            this.selectedAiId = this.aiCandidates[0].id;
        }
        void this.ensurePool();
    },
    beforeUnmount() {
        this._dead = true;
        this.stopLineTimer();
        this.detachHeart();
        if (this._damageTimer) clearTimeout(this._damageTimer);
        for (const bubble of this.bubbles) clearTimeout(bubble.timer);
    },
    methods: {
        closePanel() {
            this.drawer = '';
            store.closePanel();
        },

        // ---------- 台词池 ----------
        /**
         * 池子空了就去要一批。
         *
         * 一次请求同时要「疼」和「暖」两组 —— 分两次请求等于两倍延迟和两份配额,
         * 而它们本来就出自同一个人设、同一个语境。
         */
        async ensurePool({ force = false } = {}) {
            const persona = this.activePersona;
            if (!persona || this.poolLoading) return;
            if (!force && this.poolReady) return;
            const apiRef = nook.resolveApiRefFor(persona);
            if (!apiRef) {
                this.lastError = nook.describeMissingApi();
                return;
            }

            this.poolLoading = true;
            this.lastError = '';

            const system = [
                `你是【${persona.name}】。这颗果冻心就是你的心,被具象成了一颗能捏的东西。`,
                nook.describeAi(persona),
                nook.describeWorld(nook.getWorld('', nook.getPlayerCard(''))),
                this.customPrompt ? `补充设定:${this.customPrompt}` : '',
                '',
                'TA 会用两种方式碰你:',
                '  hurt —— 冷不丁快速戳一下。疼,而且不只是身体上的疼。',
                '  soothe —— 按住慢慢摩挲。暖,松下来,有点想说点什么。',
                '',
                '各写 10 句你在那一瞬间会脱口而出的短句。',
                '每句 14 字以内,口语,像被戳到时来不及组织语言的样子。',
                '十句之间要有变化 —— 别十句都在说同一件事。',
                this.disableEmoji ? '不要使用任何 emoji。' : '',
                '只输出 JSON:{"hurt":["..."],"soothe":["..."]}',
            ].filter(Boolean).join('\n');

            const res = await generate({
                apiRef,
                systemPrompt: system,
                userTurn: '（写下这两组话）',
                temperature: 1.05,
            });
            if (this._dead) return;
            this.poolLoading = false;

            if (!res.ok) {
                this.lastError = res.error || '没有等到回应';
                return;
            }
            const parsed = parseLooseJson(res.text);
            const clean = (list) => asArray(list)
                .map((s) => cleanLine(s, { disableEmoji: this.disableEmoji, max: 40, names: [persona.name] }))
                .filter(Boolean);
            const hurt = clean(parsed?.hurt);
            const soothe = clean(parsed?.soothe);
            if (!hurt.length && !soothe.length) {
                this.lastError = 'AI 没有按格式回,再试一次';
                return;
            }
            store.setPersonaLines(persona.id, { hurt, soothe });
        },

        // ---------- 气泡 ----------
        say(tone, text) {
            if (!text) return;
            if (this.bubbles.length >= JELLY.maxBubbles) {
                const dropped = this.bubbles.shift();
                if (dropped) clearTimeout(dropped.timer);
            }
            const angle = Math.random() * Math.PI * 2;
            const radius = 32 + Math.random() * 8;
            _bubbleSeq = (_bubbleSeq + 1) % 100000;
            const bubble = {
                id: `b-${Date.now().toString(36)}-${_bubbleSeq}`,
                tone,
                text,
                x: 50 + Math.cos(angle) * radius,
                y: 48 + Math.sin(angle) * radius * 0.72,
                timer: null,
            };
            bubble.timer = setTimeout(() => {
                const index = this.bubbles.findIndex((item) => item.id === bubble.id);
                if (index >= 0) this.bubbles.splice(index, 1);
            }, 3200);
            this.bubbles.push(bubble);
            return bubble;
        },

        /** 从池子里取一句。取空了顺手补一池,但**不阻塞**这一次触摸 */
        speakFromPool(tone) {
            const list = tone === 'hurt' ? this.pool.hurt : this.pool.soothe;
            if (!list.length) {
                void this.ensurePool();
                return;
            }
            this.say(tone, pickOne(list));
        },

        startLineTimer(tone) {
            this.stopLineTimer();
            this._lineTimer = setInterval(() => this.speakFromPool(tone), JELLY.lineGapMs + Math.random() * 320);
        },

        stopLineTimer() {
            if (this._lineTimer) clearInterval(this._lineTimer);
            this._lineTimer = null;
        },

        // ---------- 触摸 ----------
        onHeartDown(event) {
            if (event.button != null && event.button !== 0) return;
            event.preventDefault();
            this._touch = {
                startAt: Date.now(),
                startX: event.clientX,
                startY: event.clientY,
                moved: 0,
                stroking: false,
            };
            this.heartFast = true;
            this.heartTransform = '';

            if (event.pointerId != null && event.currentTarget?.setPointerCapture) {
                try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
            }
            this._heartMove = this.onHeartMove.bind(this);
            this._heartUp = this.onHeartUp.bind(this);
            window.addEventListener('pointermove', this._heartMove, { passive: false });
            window.addEventListener('pointerup', this._heartUp);
            window.addEventListener('pointercancel', this._heartUp);
        },

        onHeartMove(event) {
            const touch = this._touch;
            if (!touch) return;
            event.preventDefault();

            const dx = event.clientX - touch.startX;
            const dy = event.clientY - touch.startY;
            touch.moved = Math.hypot(dx, dy);
            const held = Date.now() - touch.startAt;
            if (held < JELLY.strokeMs || touch.moved <= 5) {
                this.heartTransform = '';
                return;
            }

            const rect = this.$refs.heartBox?.getBoundingClientRect();
            if (!rect) return;
            const offX = event.clientX - (rect.left + rect.width / 2);
            const offY = event.clientY - (rect.top + rect.height / 2);
            const tx = clamp(offX * 0.09, -20, 20);
            const ty = clamp(offY * 0.09, -20, 20);
            const skewX = clamp(-offY * 0.06, -10, 10);
            const skewY = clamp(offX * 0.06, -10, 10);
            const rotate = clamp((Math.atan2(offY, offX) * 180) / Math.PI * 0.02, -5, 5);
            this.heartTransform = `translate(${tx}px, ${ty}px) rotate(${rotate}deg) skewX(${skewX}deg) skewY(${skewY}deg)`;

            if (!touch.stroking) {
                touch.stroking = true;
                this.startLineTimer('soothe');
            }
        },

        onHeartUp() {
            const touch = this._touch;
            this.detachHeart();
            this.stopLineTimer();
            if (!touch) return;

            const held = Date.now() - touch.startAt;
            this.heartTransform = '';
            this.heartFast = false;
            this.touches += 1;

            if (held < JELLY.tapMs && touch.moved < 5) {
                this.pulseDamage();
                this.speakFromPool('hurt');
            } else if (held >= JELLY.strokeMs && touch.moved > 5) {
                this.speakFromPool('soothe');
            }
        },

        detachHeart() {
            if (this._heartMove) {
                window.removeEventListener('pointermove', this._heartMove);
                this._heartMove = null;
            }
            if (this._heartUp) {
                window.removeEventListener('pointerup', this._heartUp);
                window.removeEventListener('pointercancel', this._heartUp);
                this._heartUp = null;
            }
            this._touch = null;
        },

        pulseDamage() {
            this.damage = true;
            this.heartFast = false;
            if (this._damageTimer) clearTimeout(this._damageTimer);
            this._damageTimer = setTimeout(() => {
                this.damage = false;
                this._damageTimer = null;
            }, 500);
        },

        pulseSoothe() {
            this.heartFast = true;
            this.heartTransform = 'scale(1.08)';
            setTimeout(() => {
                this.heartFast = false;
                this.heartTransform = '';
            }, 180);
        },

        // ---------- 递点什么过去 ----------
        /**
         * 这一条**必须**现问 AI:递的东西不一样、当下的关系不一样,
         * 回应就不该一样。所以这里允许等 —— 用户是主动点的,不是摸的时候等。
         */
        async offer(gesture) {
            const persona = this.activePersona;
            this.closePanel();
            this.pulseSoothe();
            if (!persona) {
                this.$emit('notify', '当前世界观里还没有 AI 角色');
                return;
            }
            const apiRef = nook.resolveApiRefFor(persona);
            if (!apiRef) {
                this.$emit('notify', nook.describeMissingApi());
                return;
            }

            const placeholder = this.say('wait', '……');
            const system = [
                `你是【${persona.name}】。这颗果冻心就是你的心。`,
                nook.describeAi(persona),
                this.customPrompt ? `补充设定:${this.customPrompt}` : '',
                '',
                `TA 刚刚${gesture.name}(${gesture.desc})。`,
                '说一句你此刻脱口而出的话。18 字以内,口语,不要旁白不要引号。',
                this.disableEmoji ? '不要使用任何 emoji。' : '',
            ].filter(Boolean).join('\n');

            const res = await generate({
                apiRef,
                systemPrompt: system,
                userTurn: `（${gesture.name}）`,
                temperature: 1,
            });
            if (this._dead) return;

            // 占位气泡可能已经自己消失了,那就补一个新的
            const line = res.ok ? cleanLine(res.text, { disableEmoji: this.disableEmoji, max: 40, names: [persona.name] }) : '';
            const index = this.bubbles.findIndex((b) => b.id === placeholder?.id);
            if (!line) {
                if (index >= 0) {
                    clearTimeout(this.bubbles[index].timer);
                    this.bubbles.splice(index, 1);
                }
                this.$emit('notify', res.error || '没有等到回应');
                return;
            }
            this.touches += 1;
            if (index >= 0) {
                this.bubbles[index].text = line;
                this.bubbles[index].tone = 'soothe';
            } else {
                this.say('soothe', line);
            }
        },

        saveLastToFavorites() {
            const last = [...this.bubbles].reverse().find((b) => b.tone !== 'wait');
            if (!last) {
                this.$emit('notify', '还没有话可以收');
                return;
            }
            store.addFavorite({
                kind: 'heart',
                title: `${this.personaName} 说的`,
                content: last.text,
                meta: { personaName: this.personaName, touches: this.touches },
            });
            this.$emit('notify', '收进「藏」里了');
        },

        pickPersona(id) {
            this.selectedAiId = id;
            this.drawer = '';
        },

        clearBubbles() {
            for (const bubble of this.bubbles) clearTimeout(bubble.timer);
            this.bubbles = [];
        },
    },
    template: `
        <div class="oq-jelly">
            <div class="oq-jelly-header">
                <div class="oq-jelly-badge">
                    <span class="oq-jelly-dot"></span>
                    <span class="oq-jelly-persona-name">{{ personaName }}</span>
                    <span class="oq-jelly-count">碰过 {{ touches }} 次</span>
                </div>
            </div>

            <div class="oq-jelly-heart-box" ref="heartBox">
                <svg
                    class="oq-jelly-heart"
                    :class="{ 'is-damage': damage, 'is-fast': heartFast }"
                    :style="{ transform: heartTransform }"
                    viewBox="0 0 24 24"
                    @pointerdown="onHeartDown"
                >
                    <path :d="heartPath" />
                </svg>

                <div class="oq-jelly-bubbles" aria-hidden="true">
                    <span
                        v-for="bubble in bubbles"
                        :key="bubble.id"
                        class="oq-jelly-bubble"
                        :data-tone="bubble.tone"
                        :style="{ left: bubble.x + '%', top: bubble.y + '%' }"
                    >{{ bubble.text }}</span>
                </div>
            </div>

            <p class="oq-jelly-hint">{{ hint }}</p>

            <!-- 工具抽屉 -->
            <OqPanel
                v-if="panel === 'tools'"
                :title="drawer === 'persona' ? '换一个人' : (drawer === 'gesture' ? '递点什么过去' : '果冻心')"
                :subtitle="drawer ? '' : ('现在是 ' + personaName)"
                :tall="drawer !== ''"
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

                <div v-else-if="drawer === 'gesture'">
                    <OqRow
                        v-for="g in gestures"
                        :key="g.id"
                        :title="g.name"
                        :desc="g.desc"
                        @click="offer(g)"
                    />
                    <p class="oq-field-hint">每次的回应都是现问的,同一个动作不会得到同一句话。</p>
                </div>

                <div v-else>
                    <div class="oq-panel-actions">
                        <OqButton
                            variant="primary"
                            block
                            :loading="poolLoading"
                            :disabled="!aiCandidates.length"
                            @click="ensurePool({ force: true })"
                        >{{ poolReady ? '换一批说话方式' : '让这颗心开口' }}</OqButton>
                    </div>

                    <div class="oq-panel-row">
                        <OqMiniBtn @click="drawer = 'gesture'">递点什么</OqMiniBtn>
                        <OqMiniBtn @click="drawer = 'persona'">换个人</OqMiniBtn>
                        <OqMiniBtn @click="saveLastToFavorites">收藏刚才那句</OqMiniBtn>
                        <OqMiniBtn :disabled="!bubbles.length" @click="clearBubbles">擦掉气泡</OqMiniBtn>
                    </div>

                    <p v-if="lastError" class="oq-panel-error">{{ lastError }}</p>

                    <label class="oq-field">
                        <span class="oq-field-label">补充设定</span>
                        <textarea
                            v-model="customPrompt"
                            class="oq-input"
                            rows="3"
                            placeholder="例如：很怕被丢下，对声音特别敏感"
                        ></textarea>
                        <span class="oq-field-hint">改完点上面那个键重新要一批</span>
                    </label>

                    <OqSwitch v-model="disableEmoji" label="不要 emoji" hint="只出纯文字" />
                </div>

                <template v-if="drawer !== ''" #foot>
                    <OqButton block @click="drawer = ''">返回</OqButton>
                </template>
            </OqPanel>
        </div>
    `,
};

export default OqToyJellyHeart;
