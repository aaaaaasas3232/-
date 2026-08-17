/**
 * 情景剧场 · 外观
 *
 * 这一屏管两层东西,刻意分开:
 *
 *   ① **外观主题** —— 背景、气泡、头像、名字、时间戳、密度、卡片体裁。
 *      它跟着**情景**走:同一个 App 里不同情景可以完全不一样,
 *      而且能存成主题给别的情景复用。
 *   ② **界面配色** —— 抽屉、按钮、输入框这些「App 自己」的颜色。
 *      它是全局的,和情景无关。
 *
 * 把两者混在一起的话,用户改一个情景的背景会把整个 App 的配色也换掉 ——
 * 这是第一版的做法,试了一次就知道不行。
 *
 * ★ 两层都支持「复制变量名 → 改 → 粘回来」:
 *   界面配色是 `--sp-*`,卡片体裁是 `--spc-*`。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import { BubbleView } from '@/src/core/components/bubble-view.js';
import {
    COLOR_CATEGORIES, PRESET_THEMES, ALL_TOKENS, CARD_TOKENS,
    resolveThemeColors, parseColorBatch, exportColorBatch, exportTokenNames,
    parseCardVars, exportCardVars, exportCardTokenNames, applyThemeVars,
} from '../theme.js';
import { AVATAR_SHAPES, TIME_POSITIONS, NAME_POSITIONS, DENSITIES, CARD_BORDERS } from '../constants.js';
import { asArray, copyText, safeImageUrl } from '../utils.js';
import { createThemePanelMixin } from '@/src/core/theme-panel-mixin.js';

/** 实时铺色 + 粘贴全部 + 已存配色改名/覆盖，四个配色面板共用同一份实现 */
const themePanelMixin = createThemePanelMixin({
    appId: 'scene-play',
    attr: 'data-sp-theme',
    applyThemeVars,
    parseColorBatch,
    store,
});

export const SpPanelTheme = {
    name: 'SpPanelTheme',
    components: { ...SHARED_COMPONENTS, BubbleView },
    mixins: [themePanelMixin],
    emits: ['notify'],
    data() {
        const settings = store.getSettings();
        return {
            AVATAR_SHAPES, TIME_POSITIONS, NAME_POSITIONS, DENSITIES, CARD_BORDERS,
            PRESET_THEMES, COLOR_CATEGORIES, CARD_TOKENS,
            tab: 'look',
            // 界面配色的草稿(点「应用」才落盘)
            baseThemeId: PRESET_THEMES.some((p) => p.id === settings.theme) ? settings.theme : 'jelly',
            custom: { ...(settings.customThemeColors || {}) },
            openCategory: '',
            batchText: '',
            cardBatchText: '',
            bubbleChoices: [],
            bgUrlDraft: '',
        };
    },
    computed: {
        state() { return store.getState(); },
        settings() { return store.getSettings(); },
        scene() { return store.getScene(); },
        theme() { return store.getTheme(); },
        themes() { return store.getThemes(); },
        bubbles() { return this.state.bubbles; },
        savedPalettes() { return asArray(this.settings.customThemes); },
        /** 存的是「藏起来了没有」,开关上要显示的是反过来的「显示不显示」 */
        bannerVisible() { return this.settings.sceneBannerHidden !== true; },
        activePaletteId() { return this.settings.activeCustomThemeId || ''; },
        previewColors() { return resolveThemeColors(this.baseThemeId, this.custom); },
        changedCount() { return Object.keys(this.custom).length; },
        hasCustom() { return this.changedCount > 0; },
        /**
         * ★ 模板只能访问组件实例上的东西 —— 模块顶层 import 进来的常量
         *   在模板里是 `undefined`,写 `ALL_TOKENS.length` 会在**运行时**
         *   把整个组件渲染炸掉(build 和 lint 全绿)。要用就先在这儿转一道。
         */
        tokenCount() { return ALL_TOKENS.length; },
        cardVars() { return this.theme.cardVars || {}; },
        leftName() { return this.bubbleName(this.theme.bubbleLeftId); },
        rightName() { return this.bubbleName(this.theme.bubbleRightId); },
        sampleLeft() { return this.bubbles.left; },
        sampleRight() { return this.bubbles.right; },
    },
    methods: {
        // ── 聊天区 ────────────────────────
        setBannerVisible(visible) {
            store.setSceneBannerHidden(visible !== true);
            this.$emit('notify', visible ? '情景条已放回聊天区顶上' : '情景条已收起');
        },

        // ── 外观主题 ──────────────────────
        setTheme(patch) {
            if (!this.theme?.id) return;
            store.updateTheme(this.theme.id, patch);
        },
        setBg(patch) { this.setTheme({ background: { ...this.theme.background, ...patch } }); },
        setAvatar(patch) { this.setTheme({ avatar: { ...this.theme.avatar, ...patch } }); },
        setName(patch) { this.setTheme({ name: { ...this.theme.name, ...patch } }); },
        setTime(patch) { this.setTheme({ time: { ...this.theme.time, ...patch } }); },
        setCard(patch) { this.setTheme({ card: { ...this.theme.card, ...patch } }); },

        pickTheme(themeId) { store.updateScene({ themeId }); },
        onNewTheme() { store.openModal('theme-new', {}); },
        onDupTheme() { store.openModal('theme-new', { from: this.theme.id }); },
        onRenameTheme() { store.openModal('theme-rename', { id: this.theme.id, name: this.theme.name }); },
        onDeleteTheme() {
            if (this.themes.length < 2) { this.$emit('notify', '至少要留一套外观'); return; }
            store.openModal('confirm-delete-theme', { id: this.theme.id, name: this.theme.name });
        },

        applyBgUrl() {
            const url = safeImageUrl(this.bgUrlDraft);
            if (!url) { this.$emit('notify', '这个地址用不了,只收 http(s) 和 data:image'); return; }
            this.setBg({ kind: 'image', imageUrl: url });
            this.bgUrlDraft = '';
            this.$emit('notify', '背景换好了');
        },
        /**
         * 本地上传。
         *
         * 转成 data URL 存进主题 —— 存文件路径的话换个设备就打不开了。
         * 体积上限 2MB:再大的话 IndexedDB 里一套主题就好几兆,
         * 而聊天背景其实用不到那么高的分辨率。
         */
        onPickFile(event) {
            const file = event.target?.files?.[0];
            if (!file) return;
            if (!/^image\//.test(file.type)) { this.$emit('notify', '这不是图片'); return; }
            if (file.size > 2 * 1024 * 1024) { this.$emit('notify', '图片太大了(超过 2MB),压一下再传'); return; }
            const reader = new FileReader();
            reader.onload = () => {
                const url = safeImageUrl(String(reader.result || ''));
                if (!url) { this.$emit('notify', '读不出来,换一张试试'); return; }
                this.setBg({ kind: 'image', imageUrl: url });
                this.$emit('notify', '背景换好了');
            };
            reader.onerror = () => this.$emit('notify', '读图片失败');
            reader.readAsDataURL(file);
            event.target.value = '';
        },
        clearBg() { this.setBg({ kind: 'color', imageUrl: '' }); },

        // ── 气泡 ──────────────────────────
        async loadBubbles() {
            this.bubbleChoices = await store.loadBubbleChoices();
            if (!this.bubbleChoices.length) {
                this.$emit('notify', '气泡库是空的,先去「气泡机」做一套');
            }
        },
        bubbleName(id) {
            const hit = this.bubbleChoices.find((b) => String(b.id) === String(id));
            if (hit) return hit.name;
            return id ? '(已删除)' : '默认';
        },
        pickBubble(side) {
            store.openModal('pick-bubble', { side, themeId: this.theme.id });
        },

        // ── 卡片体裁 ──────────────────────
        onApplyCardBatch() {
            const text = String(this.cardBatchText || '').trim();
            if (!text) { this.$emit('notify', '先粘点东西进来'); return; }
            const { vars, valid, ignored } = parseCardVars(text);
            if (!valid) {
                this.$emit('notify', ignored ? `识别到 ${ignored} 个变量,但都不是卡片的` : '没解析出有效配置,检查一下格式');
                return;
            }
            this.setTheme({ cardVars: { ...this.cardVars, ...vars } });
            this.cardBatchText = '';
            this.$emit('notify', `已套用 ${valid} 项${ignored ? `(忽略 ${ignored} 个)` : ''}`);
        },
        onCopyCardNames() { this.copy(exportCardTokenNames(), '已复制卡片变量名'); },
        onExportCard() { this.copy(exportCardVars(this.cardVars), '已复制当前卡片配置'); },
        resetCardVars() {
            this.setTheme({ cardVars: {} });
            this.$emit('notify', '卡片样式已还原');
        },

        // ── 界面配色 ──────────────────────
        presetColors(id) { return resolveThemeColors(id, {}); },
        pickPalette(id) { this.baseThemeId = id; this.custom = {}; },
        toggleCategory(name) { this.openCategory = this.openCategory === name ? '' : name; },
        currentColor(key) { return this.previewColors[key] || ''; },
        isChanged(key) { return Object.prototype.hasOwnProperty.call(this.custom, key); },
        setColor(key, value) {
            const next = String(value || '').trim();
            if (!next) return;
            this.custom = { ...this.custom, [key]: next };
        },
        resetColor(key) {
            const next = { ...this.custom };
            delete next[key];
            this.custom = next;
        },
        resetAllColors() { this.custom = {}; },
        onApplyPalette() {
            store.applyTheme({ baseThemeId: this.baseThemeId, customColors: this.custom, customThemeId: '' });
            this.markThemeApplied();
            this.$emit('notify', '配色已应用');
        },
        onSavePalette() {
            if (!this.hasCustom) { this.$emit('notify', '还没改过任何颜色'); return; }
            store.openModal('palette-save', { baseThemeId: this.baseThemeId, colors: { ...this.custom } });
        },
        onUsePalette(palette) {
            this.baseThemeId = palette.baseThemeId;
            this.custom = { ...palette.colors };
            store.applyTheme({ baseThemeId: palette.baseThemeId, customColors: palette.colors, customThemeId: palette.id });
            this.markThemeApplied();
            this.$emit('notify', `已切到「${palette.name}」`);
        },
        onRenamePalette(palette) { this.onRenameSavedTheme(palette); },
        onOverwritePalette(palette) { this.onOverwriteSavedTheme(palette); },
        onDeletePalette(palette) { store.removeCustomTheme(palette.id); },
        onApplyBatch() {
            const text = String(this.batchText || '').trim();
            if (!text) { this.$emit('notify', '先粘点东西进来'); return; }
            const { colors, valid, ignored } = parseColorBatch(text);
            if (!valid) {
                this.$emit('notify', ignored ? `识别到 ${ignored} 个变量,但都不是本 App 的色表` : '没解析出有效配置,检查一下格式');
                return;
            }
            this.custom = { ...this.custom, ...colors };
            this.batchText = '';
            this.$emit('notify', `已套用 ${valid} 项${ignored ? `(忽略 ${ignored} 个)` : ''},记得点「应用」`);
        },
        onExportColors() { this.copy(exportColorBatch(this.previewColors), `已复制当前 ${this.tokenCount} 项配色`); },
        onCopyNames() { this.copy(exportTokenNames(), '已复制全部变量名'); },
        onCopyOne(key) { this.copy(key, `已复制 ${key}`); },

        async copy(text, okMessage) {
            const ok = await copyText(text);
            this.$emit('notify', ok ? okMessage : '复制失败,浏览器不允许');
        },
    },
    mounted() {
        void this.loadBubbles();
    },
    template: `
        <div class="sp-panel">
            <SpSegmented
                v-model="tab"
                :options="[{ value: 'look', label: '这个情景' }, { value: 'card', label: '卡片体裁' }, { value: 'ui', label: '界面配色' }]"
            />

            <!-- ── 这个情景的外观 ────────────────────── -->
            <template v-if="tab === 'look'">
                <!--
                    ★ 这一段放在「先选一个情景」的空状态**外面**:情景条的开关是
                      全局的,没选情景时也要能开关。藏在空状态后面的话,
                      把它关掉的人再也找不到开回来的地方。
                    ★ 模板本身是反引号字符串,注释里一个反引号都不能有 ——
                      写进去会把模板从中间截断,整个组件跟着报语法错。
                -->
                <SpSection title="聊天区" icon-name="theater">
                    <SpSwitch
                        label="顶上常驻情景"
                        hint="把这个情景写的内容摆在聊天区顶上,演到一半也能看见。点它可以展开 / 收起"
                        :model-value="bannerVisible"
                        @update:model-value="setBannerVisible"
                    />
                </SpSection>

                <SpEmpty v-if="!scene" icon-name="book" text="先选一个情景" hint="外观是跟着情景走的" />

                <template v-else>
                    <SpSection title="用哪套外观" icon-name="palette" :hint="theme.name">
                        <div class="sp-chips">
                            <button
                                v-for="t in themes"
                                :key="t.id"
                                type="button"
                                class="sp-chip"
                                :class="{ 'is-active': t.id === theme.id }"
                                @click="pickTheme(t.id)"
                            >{{ t.name }}</button>
                        </div>
                        <div class="sp-row-wrap">
                            <SpButton size="sm" variant="line" icon-name="plus" @click="onNewTheme">新建</SpButton>
                            <SpButton size="sm" variant="quiet" icon-name="copy" @click="onDupTheme">复制这套</SpButton>
                            <SpButton size="sm" variant="quiet" icon-name="edit" @click="onRenameTheme">改名</SpButton>
                            <SpButton size="sm" variant="danger" icon-name="trash" @click="onDeleteTheme">删除</SpButton>
                        </div>
                    </SpSection>

                    <SpSection title="背景" icon-name="image">
                        <SpSegmented
                            :model-value="theme.background.kind"
                            :options="[{ value: 'color', label: '纯色' }, { value: 'image', label: '图片' }]"
                            @update:model-value="setBg({ kind: $event })"
                        />
                        <template v-if="theme.background.kind === 'color'">
                            <SpColorRow
                                label="背景色"
                                :model-value="theme.background.color"
                                @update:model-value="setBg({ color: $event })"
                            />
                            <p class="sp-note">留空就跟着界面配色走。</p>
                        </template>
                        <template v-else>
                            <label class="sp-upload">
                                <input type="file" accept="image/*" @change="onPickFile" />
                                <span><SpIcon name="upload" /> 从相册选一张</span>
                            </label>
                            <SpField label="或者粘一个图片地址">
                                <SpInput v-model="bgUrlDraft" placeholder="https://… 或 data:image/…" @enter="applyBgUrl" />
                            </SpField>
                            <div class="sp-row-wrap">
                                <SpButton size="sm" variant="line" icon-name="check" @click="applyBgUrl">用这个地址</SpButton>
                                <SpButton v-if="theme.background.imageUrl" size="sm" variant="quiet" icon-name="close" @click="clearBg">去掉背景图</SpButton>
                            </div>
                        </template>
                        <SpSlider label="压暗 / 提亮" suffix="" :min="-40" :max="40" :model-value="theme.background.dim" @update:model-value="setBg({ dim: $event })" />
                        <SpSlider label="背景模糊" suffix="px" :min="0" :max="20" :model-value="theme.background.blur" @update:model-value="setBg({ blur: $event })" />
                    </SpSection>

                    <SpSection title="气泡" icon-name="bubble">
                        <div class="sp-bubble-preview">
                            <BubbleView v-if="sampleLeft" :config="sampleLeft" :shapes="bubbles.shapes" text="在吗" />
                            <BubbleView v-if="sampleRight" :config="sampleRight" :shapes="bubbles.shapes" text="在的" />
                            <p v-if="!sampleLeft && !sampleRight" class="sp-note">还没选气泡,现在用的是内置的默认样子。</p>
                        </div>
                        <div class="sp-row-wrap">
                            <SpButton size="sm" variant="line" icon-name="left" @click="pickBubble('left')">左侧:{{ leftName }}</SpButton>
                            <SpButton size="sm" variant="line" icon-name="bubble" @click="pickBubble('right')">右侧:{{ rightName }}</SpButton>
                        </div>
                        <p class="sp-note">气泡在「气泡机」里做。这里只是挑一套用。</p>
                    </SpSection>

                    <SpSection title="头像" icon-name="user">
                        <SpSwitch label="显示对方头像" :model-value="theme.avatar.showLeft" @update:model-value="setAvatar({ showLeft: $event })" />
                        <SpSwitch label="显示我的头像" :model-value="theme.avatar.showRight" @update:model-value="setAvatar({ showRight: $event })" />
                        <SpField label="形状">
                            <SpSegmented :model-value="theme.avatar.shape" :options="AVATAR_SHAPES" @update:model-value="setAvatar({ shape: $event })" />
                        </SpField>
                        <SpSlider label="大小" suffix="px" :min="20" :max="56" :model-value="theme.avatar.size" @update:model-value="setAvatar({ size: $event })" />
                    </SpSection>

                    <SpSection title="名字与时间" icon-name="text">
                        <SpField label="名字放哪儿">
                            <SpSegmented :model-value="theme.name.position" :options="NAME_POSITIONS" @update:model-value="setName({ position: $event })" />
                        </SpField>
                        <SpField label="时间戳放哪儿">
                            <SpSegmented :model-value="theme.time.position" :options="TIME_POSITIONS" @update:model-value="setTime({ position: $event })" />
                        </SpField>
                        <SpField label="行间距">
                            <SpSegmented :model-value="theme.density" :options="DENSITIES" @update:model-value="setTheme({ density: $event })" />
                        </SpField>
                    </SpSection>
                </template>
            </template>

            <!-- ── 卡片体裁 ──────────────────────────── -->
            <template v-else-if="tab === 'card'">
                <SpEmpty v-if="!scene" icon-name="book" text="先选一个情景" />
                <template v-else>
                    <SpSection title="轻量调整" icon-name="layers">
                        <SpSwitch label="毛玻璃" hint="日记 / 博客卡透出下面的背景" :model-value="theme.card.glass" @update:model-value="setCard({ glass: $event })" />
                        <SpField label="边框">
                            <SpSegmented :model-value="theme.card.border" :options="CARD_BORDERS" @update:model-value="setCard({ border: $event })" />
                        </SpField>
                        <SpSlider label="圆角" suffix="px" :min="0" :max="36" :model-value="theme.card.radius" @update:model-value="setCard({ radius: $event })" />
                        <SpColorRow label="卡片底色" :model-value="theme.card.tint" @update:model-value="setCard({ tint: $event })" />
                        <p class="sp-note">底色留空就跟着界面配色走。</p>
                    </SpSection>

                    <SpSection title="想改得更细" icon-name="copy" :hint="CARD_TOKENS.length + ' 项'">
                        <p class="sp-note">
                            复制变量名 → 改成你要的值 → 粘回下面的框。不认识的变量会被忽略。
                        </p>
                        <div class="sp-row-wrap">
                            <SpButton size="sm" variant="quiet" icon-name="copy" @click="onCopyCardNames">复制变量名</SpButton>
                            <SpButton size="sm" variant="quiet" icon-name="download" @click="onExportCard">导出当前</SpButton>
                        </div>
                        <SpTextarea
                            mono
                            v-model="cardBatchText"
                            :rows="4"
                            placeholder="--spc-bg: #FFF6F0;&#10;--spc-radius: 22px;"
                        />
                        <div class="sp-row-wrap">
                            <SpButton size="sm" variant="line" icon-name="check" @click="onApplyCardBatch">解析并套用</SpButton>
                            <SpButton size="sm" variant="quiet" icon-name="refresh" @click="resetCardVars">还原</SpButton>
                        </div>
                        <div class="sp-card-demo" :style="cardVars">
                            <article class="spc spc-diary">
                                <div class="spc-diary-body">这是日记体的样子。</div>
                            </article>
                            <aside class="spc spc-note">
                                <span class="spc-note-body">这是便签。</span>
                            </aside>
                        </div>
                    </SpSection>
                </template>
            </template>

            <!-- ── 界面配色 ──────────────────────────── -->
            <template v-else>
                <SpSection title="内置配色" icon-name="palette">
                    <div class="sp-palette-cards">
                        <button
                            v-for="p in PRESET_THEMES"
                            :key="p.id"
                            type="button"
                            class="sp-palette-card"
                            :class="{ 'is-active': baseThemeId === p.id }"
                            :style="presetColors(p.id)"
                            @click="pickPalette(p.id)"
                        >
                            <span class="sp-palette-swatches">
                                <i class="sp-palette-dot" data-slot="bg"></i>
                                <i class="sp-palette-dot" data-slot="primary"></i>
                                <i class="sp-palette-dot" data-slot="accent"></i>
                                <i class="sp-palette-dot" data-slot="surface"></i>
                            </span>
                            <span class="sp-palette-name">{{ p.name }}</span>
                            <span class="sp-palette-desc">{{ p.desc }}</span>
                        </button>
                    </div>
                    <div class="sp-row-wrap">
                        <SpButton variant="primary" size="sm" icon-name="check" @click="onApplyPalette">应用</SpButton>
                        <SpButton variant="line" size="sm" icon-name="save" :disabled="!hasCustom" @click="onSavePalette">存为新配色</SpButton>
                        <SpButton v-if="hasCustom" size="sm" variant="quiet" icon-name="refresh" @click="resetAllColors">全部还原</SpButton>
                    </div>
                </SpSection>

                <SpSection title="批量配色" icon-name="copy">
                    <div class="sp-row-wrap">
                        <SpButton size="sm" variant="quiet" icon-name="copy" @click="onCopyNames">复制变量名</SpButton>
                        <SpButton size="sm" variant="quiet" icon-name="download" @click="onExportColors">导出当前</SpButton>
                        <SpButton size="sm" variant="primary" icon-name="check" @click="onPasteAllColors">粘贴全部</SpButton>
                    </div>
                    <SpTextarea
                        mono
                        v-model="batchText"
                        :rows="4"
                        placeholder="--sp-primary: #F2A9BE;&#10;--sp-surface: #FFFFFF;"
                    />
                    <SpButton variant="line" size="sm" block icon-name="check" @click="onApplyBatch">解析并套用</SpButton>
                </SpSection>

                <SpSection title="逐项调色" icon-name="settings" :hint="hasCustom ? '已改 ' + changedCount + ' 项' : tokenCount + ' 项可调'">
                    <div v-for="cat in COLOR_CATEGORIES" :key="cat.name" class="sp-color-cat">
                        <button type="button" class="sp-color-cat-head" @click="toggleCategory(cat.name)">
                            <SpIcon :name="openCategory === cat.name ? 'chevronDown' : 'chevronRight'" />
                            <span>{{ cat.name }}</span>
                            <em>{{ cat.colors.length }}</em>
                        </button>
                        <div v-if="openCategory === cat.name" class="sp-color-rows">
                            <SpColorRow
                                v-for="item in cat.colors"
                                :key="item.key"
                                :label="item.label"
                                :token="item.key"
                                :model-value="currentColor(item.key)"
                                :changed="isChanged(item.key)"
                                resettable
                                @update:model-value="setColor(item.key, $event)"
                                @reset="resetColor(item.key)"
                                @copy-token="onCopyOne"
                            />
                        </div>
                    </div>
                </SpSection>

                <SpSection v-if="savedPalettes.length" title="我的配色" icon-name="layers">
                    <div class="sp-chips">
                        <span v-for="p in savedPalettes" :key="p.id" class="sp-chip-pair" :class="{ 'is-active': activePaletteId === p.id }">
                            <button type="button" class="sp-chip-main" @click="onUsePalette(p)">{{ p.name }}</button>
                            <button type="button" class="sp-chip-act" title="改名" @click="onRenamePalette(p)">改名</button>
                            <button type="button" class="sp-chip-act" title="用当前配色覆盖" :disabled="!hasCustom" @click="onOverwritePalette(p)">覆盖</button>
                            <button type="button" class="sp-chip-del" aria-label="删除" @click="onDeletePalette(p)">×</button>
                        </span>
                    </div>
                </SpSection>
            </template>
        </div>
    `,
};

export default SpPanelTheme;
