/**
 * 湛蓝回忆 · 外观面板
 *
 * 用户要求:「整体颜色禁用硬编码需要软编码,用户可以自己配置颜色,
 * 可以一个一个颜色配置,也可以一键复制所有颜色变量然后覆盖。」
 *
 * 所以这一屏有三件事:
 *
 *   ① 四套内置主题 —— 每张卡是一个**迷你舞台预览**(名牌 + 对话框 + 两个选项),
 *      不是纯色块。改配色时能立刻看出「这套颜色下对话框好不好读」。
 *   ② 逐项色板 —— 13 类共 70 个 `--gg-*`,每项 color 取色器 + hex 文本框双向联动,
 *      点变量名直接复制。
 *   ③ 批量配色 —— 复制全部变量名(空模板)/ 导出当前配色(带值)/ 粘一整段解析应用。
 *
 * ★ 预览用的是**同一套变量名**:把色表挂到预览容器的 style 上,
 *   里面的元素照常 `var(--gg-*)`。所以不可能出现「预览好看、应用后不一样」。
 *
 * ★ 色值的真相始终在 `_theme.css`。这里只存**用户改过的那几项**(差异),
 *   没改的运行时从 CSS 读(`readPresetColors`)。JS 里不存第二份色表 ——
 *   原型正是栽在「JS 一份、CSS 一份、还散着几百处硬编码」上。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import {
    COLOR_CATEGORIES, PRESET_THEMES, ALL_TOKENS,
    resolveThemeColors, parseColorBatch, exportColorBatch, exportTokenNames,
    applyThemeVars,
} from '../theme.js';
import { asArray } from '../utils.js';
import { createThemePanelMixin } from '@/src/core/theme-panel-mixin.js';

/** 实时铺色 + 粘贴全部 + 已存配色改名/覆盖，四个配色面板共用同一份实现 */
const themePanelMixin = createThemePanelMixin({
    appId: 'galgame',
    attr: 'data-gg-theme',
    applyThemeVars,
    parseColorBatch,
    store,
});

/** 迷你舞台预览 —— 用真的 UI 片段渲染,不是色块列表 */
export const GgThemePreview = {
    name: 'GgThemePreview',
    props: {
        colors: { type: Object, required: true },
        compact: { type: Boolean, default: false },
    },
    computed: {
        style() { return { ...this.colors }; },
    },
    template: `
        <div class="gg-theme-preview" :class="{ 'is-compact': compact }" :style="style">
            <div class="gg-theme-preview-stage">
                <span class="gg-theme-preview-sprite"></span>
            </div>
            <div class="gg-theme-preview-box">
                <span class="gg-theme-preview-name">夏海遥</span>
                <p class="gg-theme-preview-text">{{ compact ? '你也来看海?' : '你也是来看海的吗?' }}</p>
            </div>
            <div class="gg-theme-preview-options">
                <span class="gg-theme-preview-option">坐下</span>
                <span class="gg-theme-preview-option is-visited">走过</span>
            </div>
        </div>
    `,
};

export const GgPanelTheme = {
    name: 'GgPanelTheme',
    components: { ...SHARED_COMPONENTS, GgThemePreview },
    mixins: [themePanelMixin],
    emits: ['notify'],
    data() {
        const settings = store.getSettings();
        return {
            baseThemeId: PRESET_THEMES.some((p) => p.id === settings.theme) ? settings.theme : 'azure',
            custom: { ...(settings.customThemeColors || {}) },
            openCategory: '',
            editorOpen: false,
            batchText: '',
            PRESET_THEMES,
            COLOR_CATEGORIES,
        };
    },
    computed: {
        state() { return store.getState(); },
        settings() { return store.getSettings(); },
        savedThemes() { return asArray(this.settings.customThemes); },
        activeCustomId() { return this.settings.activeCustomThemeId || ''; },
        previewColors() { return resolveThemeColors(this.baseThemeId, this.custom); },
        changedCount() { return Object.keys(this.custom).length; },
        hasCustom() { return this.changedCount > 0; },
        /**
         * ★ 模板只能访问组件实例上的东西 —— 模块顶层 import 进来的常量
         *   在模板里是 `undefined`,写 `ALL_TOKENS.length` 会直接把整个组件渲染炸掉
         *   (而且是**运行时**才炸,build 和 lint 全绿)。要用就先在这儿转一道。
         */
        tokenCount() { return ALL_TOKENS.length; },
    },
    methods: {
        presetColors(id) { return resolveThemeColors(id, {}); },
        pickPreset(id) {
            this.baseThemeId = id;
            // 切基础主题时清掉改动 —— 深色改的值套到浅色上会很怪
            this.custom = {};
        },

        toggleCategory(name) { this.openCategory = this.openCategory === name ? '' : name; },
        currentColor(key) { return this.previewColors[key] || ''; },
        /**
         * `<input type="color">` 只吃 `#rrggbb`。
         * token 里有相当一部分是 `rgba(...)`(遮罩、玻璃背景),塞给取色器会被
         * 当成非法值静默显示成黑色。这类只给旁边的文本框改,不显示取色器。
         */
        isSwatchable(key) { return /^#[0-9a-fA-F]{6}$/.test(this.currentColor(key)); },
        /** 取色器只在 `isSwatchable` 为真时才渲染,所以这里拿到的一定是合法 hex */
        swatchValue(key) { return this.currentColor(key); },
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
        resetAll() { this.custom = {}; },

        onApply() {
            store.applyTheme({ baseThemeId: this.baseThemeId, customColors: this.custom, customThemeId: '' });
            this.markThemeApplied();
            this.$emit('notify', '外观已应用');
        },
        onApplySaved(theme) {
            this.baseThemeId = theme.baseThemeId;
            this.custom = { ...theme.colors };
            store.applyTheme({ baseThemeId: theme.baseThemeId, customColors: theme.colors, customThemeId: theme.id });
            this.markThemeApplied();
            this.$emit('notify', `已切到「${theme.name}」`);
        },
        onRename(theme) {
            this.onRenameSavedTheme(theme);
        },
        onOverwrite(theme) {
            this.onOverwriteSavedTheme(theme);
        },
        onSaveAs() {
            if (!this.hasCustom) { this.$emit('notify', '还没改过任何颜色'); return; }
            store.openModal('theme-save', {
                baseThemeId: this.baseThemeId,
                colors: { ...this.custom },
            });
        },
        onDeleteSaved(theme) { store.removeCustomTheme(theme.id); },

        // ── 批量 ──────────────────────────
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
            this.$emit('notify', `已套用 ${valid} 项${ignored ? `(忽略 ${ignored} 个不认识的)` : ''},记得点「应用」`);
        },
        onExport() { this.copy(exportColorBatch(this.previewColors), `已复制当前 ${this.tokenCount} 项配色`); },
        onCopyNames() { this.copy(exportTokenNames(), '已复制全部变量名'); },
        onCopyOne(key) { this.copy(key, `已复制 ${key}`); },

        async copy(text, okMessage) {
            try {
                await navigator.clipboard.writeText(text);
                this.$emit('notify', okMessage);
                return;
            } catch (_) { /* 非安全上下文里 clipboard 不可用,走兜底 */ }
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.cssText = 'position:fixed;left:-9999px;';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                this.$emit('notify', okMessage);
            } catch (_) {
                this.$emit('notify', '复制失败,浏览器不允许');
            }
        },

        // ── 演出设置 ──────────────────────
        set(patch) { store.updateSettings(patch); },
    },
    template: `
        <div class="gg-panel-body">
            <!-- 内置主题 -->
            <GgSection title="内置主题" icon-name="palette">
                <div class="gg-theme-cards">
                    <button
                        v-for="preset in PRESET_THEMES"
                        :key="preset.id"
                        type="button"
                        class="gg-theme-card"
                        :class="{ 'is-active': baseThemeId === preset.id }"
                        @click="pickPreset(preset.id)"
                    >
                        <GgThemePreview :colors="presetColors(preset.id)" compact />
                        <span class="gg-theme-name">{{ preset.name }}</span>
                        <span class="gg-theme-desc">{{ preset.desc }}</span>
                    </button>
                </div>
            </GgSection>

            <!-- 实时预览 -->
            <GgSection title="实时预览" icon-name="eye">
                <GgThemePreview :colors="previewColors" />
                <div class="gg-row-actions">
                    <GgButton variant="primary" size="sm" icon-name="check" @click="onApply">应用</GgButton>
                    <GgButton variant="ghost" size="sm" icon-name="save" :disabled="!hasCustom" @click="onSaveAs">存为新配色</GgButton>
                    <GgButton v-if="hasCustom" size="sm" icon-name="refresh" @click="resetAll">全部还原</GgButton>
                </div>
            </GgSection>

            <!-- 自定义颜色 -->
            <GgSection
                title="自定义颜色"
                icon-name="settings"
                :hint="hasCustom ? '已改 ' + changedCount + ' 项' : tokenCount + ' 项可调'"
                collapsible
                :open="editorOpen"
                @toggle="editorOpen = !editorOpen"
            >
                <!-- 批量 -->
                <div class="gg-batch">
                    <div class="gg-batch-head">
                        <span class="gg-batch-title">批量配色</span>
                        <div class="gg-batch-actions">
                            <button type="button" class="gg-batch-mini" @click="onCopyNames">复制变量名</button>
                            <button type="button" class="gg-batch-mini" @click="onExport">导出当前</button>
                            <button type="button" class="gg-batch-mini is-primary" @click="onPasteAllColors">粘贴全部</button>
                        </div>
                    </div>
                    <GgTextarea
                        v-model="batchText"
                        :rows="4"
                        placeholder="--gg-primary: #5DADE2;&#10;--gg-dialogue-bg: rgba(240,248,255,0.92);&#10;&#10;分号或换行分隔都行,不认识的变量会被忽略"
                    />
                    <GgButton variant="ghost" size="sm" icon-name="check" @click="onApplyBatch">解析并套用</GgButton>
                </div>

                <!-- 逐项 -->
                <div v-for="cat in COLOR_CATEGORIES" :key="cat.name" class="gg-color-cat">
                    <button type="button" class="gg-color-cat-head" @click="toggleCategory(cat.name)">
                        <GgIcon :name="openCategory === cat.name ? 'chevronDown' : 'chevronRight'" />
                        <span>{{ cat.name }}</span>
                        <em>{{ cat.colors.length }}</em>
                    </button>
                    <div v-if="openCategory === cat.name" class="gg-color-rows">
                        <div v-for="item in cat.colors" :key="item.key" class="gg-color-row">
                            <span class="gg-color-label">
                                <span class="gg-color-label-top">
                                    {{ item.label }}<em v-if="custom[item.key]">已改</em>
                                </span>
                                <code class="gg-color-var" title="点击复制变量名" @click="onCopyOne(item.key)">{{ item.key }}</code>
                            </span>
                            <input
                                v-if="isSwatchable(item.key)"
                                type="color"
                                class="gg-color-swatch"
                                :value="swatchValue(item.key)"
                                :aria-label="item.label"
                                @input="setColor(item.key, $event.target.value)"
                            />
                            <input
                                type="text"
                                class="gg-color-hex"
                                :value="currentColor(item.key)"
                                :aria-label="item.label + ' 色值'"
                                @change="setColor(item.key, $event.target.value)"
                            />
                            <button v-if="custom[item.key]" type="button" class="gg-color-reset" aria-label="还原" @click="resetColor(item.key)">×</button>
                        </div>
                    </div>
                </div>
            </GgSection>

            <!-- 已保存 -->
            <GgSection v-if="savedThemes.length" title="我的配色" icon-name="layers">
                <div class="gg-theme-chips">
                    <span v-for="t in savedThemes" :key="t.id" class="gg-theme-chip" :class="{ 'is-active': activeCustomId === t.id }">
                        <button type="button" class="gg-theme-chip-main" @click="onApplySaved(t)">{{ t.name }}</button>
                        <button type="button" class="gg-theme-chip-act" aria-label="改名" title="改名" @click="onRename(t)">改名</button>
                        <button type="button" class="gg-theme-chip-act" aria-label="用当前配色覆盖" title="用当前配色覆盖" :disabled="!hasCustom" @click="onOverwrite(t)">覆盖</button>
                        <button type="button" class="gg-theme-chip-del" aria-label="删除" @click="onDeleteSaved(t)">×</button>
                    </span>
                </div>
            </GgSection>

            <!-- 演出 -->
            <GgSection title="演出" icon-name="play">
                <GgSwitch label="逐字显示" :model-value="settings.typewriter" @update:model-value="set({ typewriter: $event })" />
                <GgSlider v-if="settings.typewriter" label="打字速度" suffix=" ms/字" :min="4" :max="120" :step="2" :model-value="settings.typeSpeed" @update:model-value="set({ typeSpeed: $event })" />
                <GgSwitch label="显示立绘" :model-value="settings.showSprite" @update:model-value="set({ showSprite: $event })" />
                <GgSwitch label="显示场景背景" :model-value="settings.showScene" @update:model-value="set({ showScene: $event })" />
                <GgSwitch label="流式生成" hint="一边写一边给进度;关掉就等全部写完再显示" :model-value="settings.stream" @update:model-value="set({ stream: $event })" />
                <GgSwitch label="每次选择后判定好感度" hint="会多花一次很短的调用" :model-value="settings.autoAffection" @update:model-value="set({ autoAffection: $event })" />
                <GgSlider label="每次给几个选项" suffix=" 个" :min="2" :max="4" :model-value="settings.optionCount" @update:model-value="set({ optionCount: $event })" />
                <GgSlider label="一幕最多几句" suffix=" 句" :min="2" :max="10" :model-value="settings.maxSentences" @update:model-value="set({ maxSentences: $event })" />
            </GgSection>
        </div>
    `,
};

export const THEME_COMPONENTS = { GgPanelTheme, GgThemePreview };
