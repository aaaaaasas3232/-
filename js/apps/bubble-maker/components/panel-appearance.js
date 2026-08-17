/**
 * 气泡机 · 外观页(界面配色)
 *
 * 用户要求:「ui 整体颜色使用软编码,用户可以选择特定颜色更改,
 * 也可以一键复制变量名替换」。所以这一屏有三件事:
 *
 *   ① 四套内置主题 —— 每张卡是一个**迷你界面预览**(卡片 + 按钮 + 输入框),
 *      不是纯色块。改配色时能立刻看出「这套颜色下字读不读得清」。
 *   ② 逐项色板 —— 8 类 token,每项取色器 + 色值文本框双向联动,
 *      点变量名直接复制。
 *   ③ 批量配色 —— 复制全部变量名(空模板)/ 导出当前配色(带值)/ 粘一整段解析应用。
 *
 * ★ 预览用的是**同一套变量名**:把色表挂到预览容器的 style 上,
 *   里面的元素照常 `var(--bb-*)`。所以不可能出现「预览好看、应用后不一样」。
 */

import * as store from '../store.js';
import { SHARED_COMPONENTS } from './shared.js';
import {
    COLOR_CATEGORIES, PRESET_THEMES, ALL_TOKENS,
    resolveThemeColors, parseColorBatch, exportColorBatch, exportTokenNames,
    applyThemeVars,
} from '../theme.js';
import { asArray, copyText } from '../utils.js';
import { createThemePanelMixin } from '@/src/core/theme-panel-mixin.js';

/** 实时铺色 + 粘贴全部 + 已存配色改名/覆盖，四个配色面板共用同一份实现 */
const themePanelMixin = createThemePanelMixin({
    appId: 'bubble-maker',
    attr: 'data-bb-theme',
    applyThemeVars,
    parseColorBatch,
    store,
});

/** 迷你界面预览 —— 用真的控件片段渲染,不是色块列表 */
export const BbThemePreview = {
    name: 'BbThemePreview',
    props: {
        colors: { type: Object, required: true },
        compact: { type: Boolean, default: false },
    },
    computed: {
        style() { return { ...this.colors }; },
    },
    template: `
        <div class="bb-theme-preview" :class="{ 'is-compact': compact }" :style="style">
            <div class="bb-tp-card">
                <span class="bb-tp-title">气泡</span>
                <span class="bb-tp-sub">{{ compact ? '副标题' : '这行是次要文字' }}</span>
                <div class="bb-tp-row">
                    <span class="bb-tp-btn is-primary">应用</span>
                    <span class="bb-tp-btn">取消</span>
                </div>
                <div class="bb-tp-input"></div>
            </div>
        </div>
    `,
};

export const BbPanelAppearance = {
    name: 'BbPanelAppearance',
    components: { ...SHARED_COMPONENTS, BbThemePreview },
    mixins: [themePanelMixin],
    emits: ['notify'],
    data() {
        const settings = store.getSettings();
        return {
            baseThemeId: PRESET_THEMES.some((p) => p.id === settings.theme) ? settings.theme : 'porcelain',
            custom: { ...(settings.customThemeColors || {}) },
            openCategory: '',
            batchText: '',
            PRESET_THEMES,
            COLOR_CATEGORIES,
        };
    },
    computed: {
        settings() { return store.getSettings(); },
        savedThemes() { return asArray(this.settings.customThemes); },
        activeCustomId() { return this.settings.activeCustomThemeId || ''; },
        previewColors() { return resolveThemeColors(this.baseThemeId, this.custom); },
        changedCount() { return Object.keys(this.custom).length; },
        hasCustom() { return this.changedCount > 0; },
        /**
         * ★ 模板只能访问组件实例上的东西 —— 模块顶层 import 进来的常量
         *   在模板里是 `undefined`,写 `ALL_TOKENS.length` 会把整个组件渲染炸掉,
         *   而且是**运行时**才炸(build 和 lint 全绿)。要用就先在这儿转一道。
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
        resetAll() { this.custom = {}; },

        onApply() {
            store.applyTheme({ baseThemeId: this.baseThemeId, customColors: this.custom, customThemeId: '' });
            this.markThemeApplied();
            this.$emit('notify', '配色已应用');
        },
        onApplySaved(theme) {
            this.baseThemeId = theme.baseThemeId;
            this.custom = { ...theme.colors };
            store.applyTheme({ baseThemeId: theme.baseThemeId, customColors: theme.colors, customThemeId: theme.id });
            this.markThemeApplied();
            this.$emit('notify', `已切到「${theme.name}」`);
        },
        onSaveAs() {
            if (!this.hasCustom) { this.$emit('notify', '还没改过任何颜色'); return; }
            store.openModal('theme-save', { baseThemeId: this.baseThemeId, colors: { ...this.custom } });
        },
        onRename(theme) { this.onRenameSavedTheme(theme); },
        onOverwrite(theme) { this.onOverwriteSavedTheme(theme); },
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
            const ok = await copyText(text);
            this.$emit('notify', ok ? okMessage : '复制失败,浏览器不允许');
        },
    },
    template: `
        <div class="bb-panel-body">
            <BbSection title="内置配色" icon-name="palette">
                <div class="bb-theme-cards">
                    <button
                        v-for="preset in PRESET_THEMES"
                        :key="preset.id"
                        type="button"
                        class="bb-theme-card"
                        :class="{ 'is-active': baseThemeId === preset.id }"
                        @click="pickPreset(preset.id)"
                    >
                        <BbThemePreview :colors="presetColors(preset.id)" compact />
                        <span class="bb-theme-name">{{ preset.name }}</span>
                        <span class="bb-theme-desc">{{ preset.desc }}</span>
                    </button>
                </div>
            </BbSection>

            <BbSection title="实时预览" icon-name="eye">
                <BbThemePreview :colors="previewColors" />
                <div class="bb-row-between">
                    <BbButton variant="primary" size="sm" icon-name="check" @click="onApply">应用</BbButton>
                    <BbButton variant="line" size="sm" icon-name="save" :disabled="!hasCustom" @click="onSaveAs">存为新配色</BbButton>
                    <BbButton v-if="hasCustom" size="sm" icon-name="refresh" @click="resetAll">全部还原</BbButton>
                </div>
            </BbSection>

            <BbSection title="批量配色" icon-name="copy">
                <div class="bb-row-between">
                    <BbButton size="sm" variant="quiet" icon-name="copy" @click="onCopyNames">复制变量名</BbButton>
                    <BbButton size="sm" variant="quiet" icon-name="download" @click="onExport">导出当前</BbButton>
                    <BbButton size="sm" variant="primary" icon-name="check" @click="onPasteAllColors">粘贴全部</BbButton>
                </div>
                <BbTextarea
                    mono
                    v-model="batchText"
                    :rows="4"
                    placeholder="--bb-primary: #F2A9BE;&#10;--bb-surface: #FFFFFF;&#10;&#10;分号或换行分隔都行,不认识的变量会被忽略"
                />
                <BbButton variant="line" size="sm" block icon-name="check" @click="onApplyBatch">解析并套用</BbButton>
            </BbSection>

            <BbSection title="逐项调色" icon-name="settings" :hint="hasCustom ? '已改 ' + changedCount + ' 项' : tokenCount + ' 项可调'">
                <div v-for="cat in COLOR_CATEGORIES" :key="cat.name" class="bb-color-cat">
                    <button type="button" class="bb-color-cat-head" @click="toggleCategory(cat.name)">
                        <BbIcon :name="openCategory === cat.name ? 'chevronDown' : 'chevronRight'" />
                        <span>{{ cat.name }}</span>
                        <em>{{ cat.colors.length }}</em>
                    </button>
                    <div v-if="openCategory === cat.name" class="bb-color-rows">
                        <BbColorRow
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
            </BbSection>

            <BbSection v-if="savedThemes.length" title="我的配色" icon-name="layers">
                <div class="bb-theme-chips">
                    <span v-for="t in savedThemes" :key="t.id" class="bb-theme-chip" :class="{ 'is-active': activeCustomId === t.id }">
                        <button type="button" class="bb-theme-chip-main" @click="onApplySaved(t)">{{ t.name }}</button>
                        <button type="button" class="bb-theme-chip-act" title="改名" @click="onRename(t)">改名</button>
                        <button type="button" class="bb-theme-chip-act" title="用当前配色覆盖" :disabled="!hasCustom" @click="onOverwrite(t)">覆盖</button>
                        <button type="button" class="bb-theme-chip-del" aria-label="删除" @click="onDeleteSaved(t)">×</button>
                    </span>
                </div>
            </BbSection>
        </div>
    `,
};

export const APPEARANCE_COMPONENTS = { BbPanelAppearance, BbThemePreview };
