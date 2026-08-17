/**
 * 情景剧场 · 舞台(消息流 + 输入区)
 *
 * ── 背景 ──────────────────────────────────────────────────────────
 *
 * 背景图 / 底色由**外观主题**给,压暗和模糊做在一个独立的蒙层上,
 * 不做在背景本身上 —— 直接给背景加 `filter: blur()` 会把上面的消息也糊掉
 * (filter 会给子元素建新的层叠上下文,这一点很容易踩)。
 *
 * ── 滚动 ──────────────────────────────────────────────────────────
 *
 * 新消息进来时滚到底,但**只在用户本来就在底部时**滚 ——
 * 他正翻上面的旧内容时被强行拽到底,是聊天类界面最招人烦的一件事。
 *
 * ── 情景常驻条 ────────────────────────────────────────────────────
 *
 * 顶栏只有标题,设定本身要开抽屉、进弹窗才看得到,演到一半根本想不起来
 * 自己写过什么。所以在顶栏和消息流之间常驻一条,把 `scene.setting` 摆出来。
 *
 *   - 它是 `.sp-stage` 的**兄弟层**,不在 `.sp-flow` 里面 ——
 *     放进消息流的话会跟着一起滚走,而且会混进正则卡片的统计里
 *   - 收起时钳成两行,展开时自己滚(`max-height`),永远不会把消息区吃光
 *   - 折叠状态存 `settings`,不是组件 data(切情景 / 切存档时组件会重建)
 *   - 正文一律走插值,**绝不 v-html** —— `scene.setting` 是用户自己写的
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { SpMessage } from './message-item.js';
import { safeImageUrl } from '../utils.js';
import { MODES } from '../constants.js';
import * as nook from '../services/nook-bridge.js';

export const SpStage = {
    name: 'SpStage',
    components: { ...SHARED_COMPONENTS, SpMessage },
    emits: ['notify'],
    data() {
        return { draft: '', atBottom: true };
    },
    computed: {
        state() { return store.getState(); },
        scene() { return store.getScene(); },
        save() { return store.getSave(); },
        theme() { return store.getTheme(); },
        messages() { return this.state.messages; },
        rules() { return store.getCompiledRules(); },
        bubbles() { return this.state.bubbles; },
        generating() { return this.state.generating; },
        streamText() { return this.state.streamText; },
        genError() { return this.state.genError; },
        editingId() { return this.state.editingId; },
        empty() { return !this.messages.length && !this.generating; },
        settings() { return store.getSettings(); },

        // ── 情景常驻条 ──────────────────────────
        /** 没选情景就整条不画 —— 舞台自己已经有「还没有情景」的空状态了 */
        showBanner() { return Boolean(this.scene) && this.settings.sceneBannerHidden !== true; },
        bannerOpen() { return this.settings.sceneBannerOpen === true; },
        bannerText() {
            const text = String(this.scene?.setting || '').trim();
            return text || '这个情景还没写内容。点右边的笔补一句,AI 才知道该演什么。';
        },
        /** 正文是空的时候那句提示要淡一点,别看着像正文 */
        bannerEmpty() { return !String(this.scene?.setting || '').trim(); },
        /**
         * 附带信息。
         *
         * ★ 地点只在情景真的挑过地点时才去问 nook —— `locationId` 为空就直接
         *   返回,省掉每次重渲染的一趟场所列表。这里不做任何 AI 调用。
         */
        bannerFacts() {
            const scene = this.scene;
            if (!scene) return [];
            const out = [{ label: '体裁', value: this.modeLabel(scene.mode) }];
            if (scene.timeText) out.push({ label: '时间', value: scene.timeText });
            const place = this.locationName;
            if (place) out.push({ label: '地点', value: place });
            if (scene.aim) out.push({ label: '目标', value: scene.aim });
            return out;
        },
        locationName() {
            const scene = this.scene;
            if (!scene?.locationId) return '';
            const world = nook.getWorld(scene.worldId, nook.getUserCard(scene.userPersonaId));
            const hit = nook.listWorldLocations(world).find((l) => String(l.id) === String(scene.locationId));
            return hit?.name || '';
        },

        backgroundStyle() {
            const bg = this.theme.background;
            const style = {};
            if (bg.kind === 'image') {
                const url = safeImageUrl(bg.imageUrl);
                if (url) {
                    style.backgroundImage = `url("${url.replace(/["\\]/g, encodeURIComponent)}")`;
                    style.backgroundSize = 'cover';
                    style.backgroundPosition = 'center';
                }
            } else if (bg.color) {
                style.backgroundColor = bg.color;
            }
            if (bg.blur > 0) style.filter = `blur(${bg.blur}px)`;
            return style;
        },
        veilStyle() {
            const dim = Number(this.theme.background.dim) || 0;
            if (!dim) return { opacity: 0 };
            // 正数压暗、负数提亮。两种都走同一个蒙层,只是颜色不同
            return {
                background: dim > 0 ? 'var(--sp-stage-veil)' : 'var(--sp-surface)',
                opacity: String(Math.min(0.6, Math.abs(dim) / 100)),
            };
        },
        /**
         * 卡片层的 CSS 变量。
         *
         * 顺序是「面板上那几个开关派生出来的值」→「用户粘的 `--spc-*`」,
         * 后者赢。这样用户想精调时不用先去关掉面板上的开关 ——
         * 反过来的话他会发现「粘进去的圆角不生效」,而原因是被开关盖掉了。
         */
        cardVars() {
            const card = this.theme.card || {};
            const derived = {};
            if (Number.isFinite(card.radius)) derived['--spc-radius'] = `${card.radius}px`;
            if (card.tint) derived['--spc-bg'] = card.tint;
            return { ...derived, ...(this.theme.cardVars || {}) };
        },
        cardBorder() { return this.theme.card?.border || 'hairline'; },
        cardGlass() { return this.theme.card?.glass ? '1' : '0'; },
    },
    methods: {
        onScroll(e) {
            const el = e.target;
            this.atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        },
        scrollToBottom(force = false) {
            if (!force && !this.atBottom) return;
            this.$nextTick(() => {
                const el = this.$refs.flow;
                if (el) el.scrollTop = el.scrollHeight;
            });
        },

        async onSend() {
            const text = this.draft.trim();
            if (!text || this.generating) return;
            this.draft = '';
            this.scrollToBottom(true);
            const result = await store.generate({ kind: 'reply', userText: text });
            if (!result.ok) this.$emit('notify', result.error);
            this.scrollToBottom(true);
        },
        async onContinue() {
            if (this.generating) return;
            const kind = this.messages.length ? 'continue' : 'open';
            this.scrollToBottom(true);
            const result = await store.generate({ kind });
            if (!result.ok) this.$emit('notify', result.error);
            this.scrollToBottom(true);
        },
        onStop() { store.stopGeneration(); },

        onAddManual() { store.openModal('manual-message', {}); },

        // ── 情景常驻条 ──────────────────────────
        modeLabel(id) { return MODES.find((m) => m.id === id)?.label || '小剧场'; },
        /**
         * 展开 / 收起。
         *
         * ★ 收完要补一次滚动:这一条一变高变矮,下面的消息流跟着变矮变高,
         *   本来贴在底部的最后一句会被推出可视区。`scrollToBottom()` 不带 force,
         *   所以正在翻旧内容的人不会被拽走。
         */
        onToggleBanner() {
            store.toggleSceneBanner();
            this.scrollToBottom();
        },
        onHideBanner() {
            store.setSceneBannerHidden(true);
            this.$emit('notify', '已收起情景条。想找回来:抽屉 →「外观」→ 这个情景');
            this.scrollToBottom();
        },
        /** 复用已有的情景弹窗,不另做一个编辑器 */
        onEditScene() {
            if (!this.scene) return;
            store.openModal('scene-edit', { id: this.scene.id });
        },

        onEdit(id) { store.setEditing(id); },
        onCancelEdit() { store.setEditing(''); },
        onSaveEdit({ id, text }) {
            store.editMessage(id, text);
            store.setEditing('');
            this.$emit('notify', '改好了');
        },
        onRemove(message) { store.openModal('confirm-delete-message', { id: message.id }); },
        onReroll(message) {
            store.openModal('reroll', { id: message.id, after: store.countAfter(message.id) });
        },

        openDrawer(id) { store.setDrawer(id); },
    },
    watch: {
        'state.messages.length'() { this.scrollToBottom(); },
        streamText() { this.scrollToBottom(); },
        'state.activeSaveId'() { this.scrollToBottom(true); },
    },
    mounted() { this.scrollToBottom(true); },
    template: `
        <div class="sp-stage" :style="cardVars" :data-card-border="cardBorder" :data-card-glass="cardGlass">
            <div class="sp-stage-bg" :style="backgroundStyle" aria-hidden="true"></div>
            <div class="sp-stage-veil" :style="veilStyle" aria-hidden="true"></div>

            <header class="sp-stage-top">
                <button type="button" class="sp-stage-btn" aria-label="打开抽屉" @click="openDrawer('scenes')">
                    <SpIcon name="menu" />
                </button>
                <div class="sp-stage-title">
                    <span class="sp-stage-name">{{ scene ? scene.title : '情景剧场' }}</span>
                    <span v-if="save" class="sp-stage-sub">{{ save.name }} · {{ messages.length }} 段</span>
                </div>
                <button type="button" class="sp-stage-btn" aria-label="存档" @click="openDrawer('saves')">
                    <SpIcon name="save" />
                </button>
            </header>

            <!--
                情景常驻条 —— 演到一半也能一眼看到自己设定了什么。
                正文那一块整个是按钮:点哪儿都能展开 / 收起,不用去瞄那个小箭头。
                ★ 里面只放 span,不放第二个 button —— 按钮套按钮在部分浏览器里
                  会把内层的点击吞掉,而且键盘完全走不到。「不再显示」因此
                  放在外面那一列。
            -->
            <section v-if="showBanner" class="sp-scene-bar" :class="{ 'is-open': bannerOpen }">
                <button
                    type="button"
                    class="sp-scene-bar-main"
                    :aria-expanded="bannerOpen ? 'true' : 'false'"
                    :aria-label="bannerOpen ? '收起情景' : '展开情景'"
                    @click="onToggleBanner"
                >
                    <span class="sp-scene-bar-text" :class="{ 'is-empty': bannerEmpty }">{{ bannerText }}</span>
                    <span v-if="bannerOpen && bannerFacts.length" class="sp-scene-bar-facts">
                        <span v-for="f in bannerFacts" :key="f.label" class="sp-scene-bar-fact">
                            <em>{{ f.label }}</em>{{ f.value }}
                        </span>
                    </span>
                </button>
                <div class="sp-scene-bar-acts">
                    <button
                        type="button"
                        class="sp-scene-bar-btn"
                        :aria-label="bannerOpen ? '收起情景' : '展开情景'"
                        @click="onToggleBanner"
                    ><SpIcon :name="bannerOpen ? 'up' : 'down'" /></button>
                    <button type="button" class="sp-scene-bar-btn" aria-label="改这个情景" @click="onEditScene">
                        <SpIcon name="edit" />
                    </button>
                    <button
                        v-if="bannerOpen"
                        type="button"
                        class="sp-scene-bar-btn"
                        aria-label="不再显示情景条"
                        @click="onHideBanner"
                    ><SpIcon name="close" /></button>
                </div>
            </section>

            <div ref="flow" class="sp-flow" @scroll="onScroll">
                <SpEmpty
                    v-if="empty && scene"
                    icon-name="theater"
                    text="这一档还是空的"
                    hint="点下面的「开场」让 AI 起个头,或者自己先写一句"
                >
                    <SpButton variant="primary" icon-name="sparkle" @click="onContinue">开场</SpButton>
                </SpEmpty>

                <SpEmpty
                    v-else-if="!scene"
                    icon-name="book"
                    text="还没有情景"
                    hint="打开左边的抽屉,新建一个情景就能开始"
                >
                    <SpButton variant="primary" icon-name="plus" @click="openDrawer('scenes')">去建一个</SpButton>
                </SpEmpty>

                <SpMessage
                    v-for="m in messages"
                    :key="m.id"
                    :message="m"
                    :rules="rules"
                    :theme="theme"
                    :bubbles="bubbles"
                    :mode="scene ? scene.mode : 'dialogue'"
                    :editing="editingId === m.id"
                    @edit="onEdit"
                    @save-edit="onSaveEdit"
                    @cancel-edit="onCancelEdit"
                    @remove="onRemove"
                    @reroll="onReroll"
                />

                <!-- 流式生成中:显示实时文字,但**不落库**。中断时才决定要不要存 -->
                <div v-if="generating" class="sp-streaming">
                    <span class="sp-streaming-dot" aria-hidden="true"></span>
                    <p class="sp-streaming-text">{{ streamText || '正在想…' }}</p>
                </div>

                <p v-if="genError" class="sp-gen-error">{{ genError }}</p>
            </div>

            <footer class="sp-composer">
                <button type="button" class="sp-composer-btn" aria-label="自己写一条" @click="onAddManual">
                    <SpIcon name="plus" />
                </button>
                <textarea
                    class="sp-composer-input"
                    v-model="draft"
                    rows="1"
                    :placeholder="scene ? '写点什么…' : '先选一个情景'"
                    :disabled="!scene"
                ></textarea>
                <button
                    v-if="generating"
                    type="button"
                    class="sp-composer-send is-stop"
                    aria-label="停止生成"
                    @click="onStop"
                ><SpIcon name="stop" /></button>
                <button
                    v-else-if="draft.trim()"
                    type="button"
                    class="sp-composer-send"
                    aria-label="发送"
                    @click="onSend"
                ><SpIcon name="send" /></button>
                <button
                    v-else
                    type="button"
                    class="sp-composer-send is-ghost"
                    :disabled="!scene"
                    :aria-label="messages.length ? '让 AI 接着写' : '开场'"
                    @click="onContinue"
                ><SpIcon name="sparkle" /></button>
            </footer>
        </div>
    `,
};

export default SpStage;
