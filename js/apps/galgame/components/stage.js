/**
 * 湛蓝回忆 · 舞台
 *
 * 背景 + 立绘 + 对话框 + 选项。原型那一屏的 1:1 结构:
 * 顶部一排圆形菜单键、左上角时间胶囊、中间立绘、下方对话框、对话框下方选项列表、
 * 选项上方一个「自定义剧情」按钮。
 *
 * ── 相对原型的改动 ────────────────────────────────────────────────
 *
 * - 走过的选项标出来,点它**直接跳到那条已经存在的分支**,不重新生成。
 *   原型每次都重新调 API,等于把之前那条线覆盖掉 —— 而分支树的全部意义
 *   就是「走过的都还在」。
 * - 「生成中」有真的进度感(收到多少字)和**停止**按钮。
 *   原型的进度条永远不动:`updateProgress` 在同一个作用域里被定义了两次
 *   (剧情一份、音乐播放器一份),函数声明提升后**后者吃掉前者**,
 *   于是生成剧情时刷的其实是音乐播放器的进度条。
 * - 右上角常驻 K 链角标:还差几幕压缩、当前压到 K几,一眼看得见。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { PANELS, CUSTOM_PLOT_MAX } from '../constants.js';
import { cssUrl, truncate } from '../utils.js';
import { affectionTone } from '../theme.js';

export const GgStage = {
    name: 'GgStage',
    components: { ...SHARED_COMPONENTS },
    emits: ['notify'],
    data() {
        return { PANELS };
    },
    computed: {
        state() { return store.getState(); },
        game() { return store.getGame(); },
        settings() { return store.getSettings(); },
        node() { return store.getCurrentNode(); },
        segments() { return store.getSegments(); },
        segment() { return store.getCurrentSegment(); },
        choices() { return store.getChoices(); },
        customChildren() { return store.getCustomChildren(); },
        kStats() { return store.getKStats(); },
        cast() { return store.getCast(); },
        /** 只读剧本:没写下文的选项直接说到头了,不去调 AI */
        presetMode() { return store.isPresetMode(); },
        ending() { return this.node?.ending || null; },

        bgStyle() {
            const url = this.settings.showScene ? store.getStageImage() : '';
            return url ? { backgroundImage: cssUrl(url) } : null;
        },
        spriteUrl() { return store.getStageSprite(); },

        speakerName() {
            const seg = this.segment;
            if (!seg?.speaker) return '';
            return seg.speaker;
        },
        isNarration() { return !this.segment?.speaker; },

        /** 这一幕放完、也没在生成 —— 该给玩家选了 */
        showChoices() {
            return this.state.awaitingChoice && !this.state.generating && this.choices.length > 0;
        },
        showContinue() {
            return !this.state.typing && !this.state.awaitingChoice && this.segments.length > 0;
        },

        sceneCounter() {
            return `第 ${(this.node?.depth ?? -1) + 1} 幕`;
        },
        worldTimeText() {
            return this.game?.worldTimeText || '现在';
        },

        /** 好感度小面板(只显示参与统计的角色) */
        affectionList() {
            const affection = this.game?.affection || {};
            return this.cast
                .filter((c) => c.trackAffection)
                .map((c) => {
                    const value = affection[c.id]?.value ?? 50;
                    return { id: c.id, name: c.name, value, tone: affectionTone(value), thoughts: affection[c.id]?.thoughts || '' };
                });
        },
    },
    methods: {
        onPanel(id) { store.setPanel(id); },
        onBoxClick() {
            if (this.state.generating) return;
            store.advanceDialogue();
        },
        onSkip() { store.skipToChoices(); },
        async onChoose(choice) {
            if (this.state.generating) return;
            if (choice.visitedNodeId) {
                store.setCurrentNode(choice.visitedNodeId);
                this.$emit('notify', '这条路走过,直接接上了');
                return;
            }
            const result = await store.chooseOption(choice.text);
            if (result && result.ok === false) this.$emit('notify', result.error);
        },
        onCustom() {
            store.openModal('custom-plot', { max: CUSTOM_PLOT_MAX });
        },
        onStop() { store.stopGeneration(); },
        async onRetry() {
            const result = await store.regenerateCurrent();
            if (result && result.ok === false) this.$emit('notify', result.error);
        },
        onVisitCustom(child) {
            store.setCurrentNode(child.id);
        },
        shortChoice(text) { return truncate(text, 40); },
    },
    template: `
        <div class="gg-stage" :style="bgStyle">
            <div class="gg-stage-veil" aria-hidden="true"></div>

            <!-- 顶部信息 -->
            <div class="gg-stage-top">
                <div class="gg-capsule">
                    <span class="gg-capsule-time">{{ worldTimeText }}</span>
                    <template v-if="node">
                        <span class="gg-capsule-sep">·</span>
                        <span class="gg-capsule-scene">{{ sceneCounter }}</span>
                    </template>
                </div>
                <!-- 一幕都还没有的时候不显示 K 角标 —— 挂个「K0」会让人以为已经压过一次了 -->
                <div v-if="node" class="gg-kbadge" :class="{ 'is-pending': kStats.pending }" :title="'K 链:窗口 ' + kStats.windowUsed + '/' + kStats.windowSize">
                    <span class="gg-kbadge-main">K{{ Math.max(0, kStats.kCount - 1) }}</span>
                    <span v-if="kStats.pending" class="gg-kbadge-sub">压缩中</span>
                    <span v-else-if="kStats.kCount === 0" class="gg-kbadge-sub">还差 {{ kStats.untilCompress }} 幕</span>
                    <span v-else class="gg-kbadge-sub">再 {{ kStats.untilCompress }} 幕</span>
                </div>
            </div>

            <!-- 菜单 -->
            <nav class="gg-menu" aria-label="功能菜单">
                <button
                    v-for="p in PANELS"
                    :key="p.id"
                    type="button"
                    class="gg-menu-btn"
                    :class="{ 'is-active': state.panel === p.id }"
                    :aria-label="p.label"
                    :title="p.label"
                    @click="onPanel(p.id)"
                >
                    <GgIcon :name="p.icon" />
                </button>
            </nav>

            <!-- 好感度 -->
            <div v-if="affectionList.length" class="gg-affection-hud">
                <div v-for="a in affectionList" :key="a.id" class="gg-affection-row" :title="a.thoughts">
                    <span class="gg-affection-name">{{ a.name }}</span>
                    <GgAffectionBar :value="a.value" :tone="a.tone" />
                </div>
            </div>

            <!-- 立绘 -->
            <div v-if="spriteUrl" class="gg-sprite-wrap">
                <img class="gg-sprite" :src="spriteUrl" alt="" />
            </div>

            <!-- 生成中 -->
            <div v-if="state.generating" class="gg-generating">
                <GgSpinner />
                <p class="gg-generating-text">正在写下一幕…{{ state.streamChars ? ' ' + state.streamChars + ' 字' : '' }}</p>
                <GgButton size="sm" variant="ghost" icon-name="stop" @click="onStop">停下</GgButton>
            </div>

            <!-- 对话区 -->
            <div class="gg-dialogue-area">
                <p v-if="state.genError" class="gg-gen-error">
                    <GgIcon name="warning" />{{ state.genError }}
                </p>

                <div
                    v-if="segments.length"
                    class="gg-dialogue"
                    :class="{ 'is-narration': isNarration }"
                    role="button"
                    tabindex="0"
                    @click="onBoxClick"
                    @keydown.enter.prevent="onBoxClick"
                    @keydown.space.prevent="onBoxClick"
                >
                    <span v-if="speakerName" class="gg-name" :class="{ 'is-player': segment.isPlayer }">{{ speakerName }}</span>
                    <p class="gg-dialogue-text">{{ state.typed }}<i v-if="state.typing" class="gg-cursor" aria-hidden="true"></i></p>
                    <span v-if="showContinue" class="gg-continue" aria-hidden="true">▼</span>
                </div>

                <div v-else-if="!state.generating" class="gg-dialogue is-empty">
                    <p class="gg-dialogue-text">故事还没开始。到「设定」里挑好世界观和出场角色,然后按下面的按钮。</p>
                </div>

                <!-- 跳过打字 -->
                <button v-if="state.typing" type="button" class="gg-skip" @click="onSkip">跳过</button>

                <!-- 结局 -->
                <p v-if="ending" class="gg-ending-banner">
                    <GgIcon name="flag" /><span>{{ ending.title || '结局' }}</span>
                </p>

                <!-- 选项 -->
                <div v-if="showChoices" class="gg-options">
                    <button
                        v-for="(choice, i) in choices"
                        :key="i"
                        type="button"
                        class="gg-option"
                        :class="{ 'is-visited': choice.visitedNodeId, 'is-blocked': choice.blocked }"
                        @click="onChoose(choice)"
                    >
                        <span class="gg-option-text">{{ shortChoice(choice.text) }}</span>
                        <span v-if="choice.visitedNodeId" class="gg-option-badge">走过</span>
                        <span v-else-if="choice.blocked" class="gg-option-badge">未写</span>
                    </button>

                    <button
                        v-for="child in customChildren"
                        :key="child.id"
                        type="button"
                        class="gg-option is-custom is-visited"
                        @click="onVisitCustom(child)"
                    >
                        <span class="gg-option-text">{{ shortChoice(child.choice.text) }}</span>
                        <span class="gg-option-badge">自定义</span>
                    </button>

                    <!-- 预设剧本里这两个按钮都会去调 AI,直接不给,免得点了只收到一句拒绝 -->
                    <div v-if="!presetMode" class="gg-options-extra">
                        <GgButton size="sm" variant="ghost" icon-name="pen" @click="onCustom">自己写一个</GgButton>
                        <GgButton size="sm" variant="quiet" icon-name="refresh" @click="onRetry">重写这一幕</GgButton>
                    </div>
                    <p v-else class="gg-options-preset">预设剧本 · 标「未写」的选项没有下文</p>
                </div>
            </div>
        </div>
    `,
};

export default GgStage;
