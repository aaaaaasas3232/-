/**
 * 萤火 · 配色页
 *
 * 三件事：
 *   1. 内置主题（迷你预览卡，用主题自己的变量画）
 *   2. 逐项色板 —— 每个 --yt-* 一行：取色器 + 文本框，点变量名复制
 *   3. 批量 —— 复制变量名 / 导出当前 / 粘贴整段覆盖
 * 已保存主题：应用 / 改名 / 用当前颜色覆盖 / 删除。
 *
 * 实时铺色、粘贴全部、覆盖已存主题来自框架 mixin（多个 App 共用那份实现）。
 * 色值真相在 CSS，这里只存差异。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import {
    ALL_TOKENS, COLOR_CATEGORIES, PRESET_THEMES,
    applyThemeVars, exportColorBatch, exportTokenNames, parseColorBatch, resolveThemeColors,
} from '../theme.js';
import { asArray } from '../utils.js';
import { createThemePanelMixin } from '@/src/core/theme-panel-mixin.js';

const themePanelMixin = createThemePanelMixin({
    appId: 'youtube',
    attr: 'data-yt-theme',
    applyThemeVars,
    parseColorBatch,
    store,
});

export const YtThemePanel = {
    name: 'YtThemePanel',
    components: { ...UI },
    mixins: [themePanelMixin],
    emits: ['close', 'notify'],
    data() {
        const profile = store.getState().profile || {};
        return {
            baseThemeId: PRESET_THEMES.some((p) => p.id === profile.themeId) ? profile.themeId : 'paper',
            custom: { ...(profile.customColors || {}) },
            openCategory: '',
            batchText: '',
            PRESET_THEMES,
            COLOR_CATEGORIES,
        };
    },
    computed: {
        s() { return store.getState(); },
        /** mixin 的 mounted 快照读这两个字段 */
        settings() {
            const profile = this.s.profile || {};
            return { theme: profile.themeId, customThemeColors: profile.customColors || {} };
        },
        savedThemes() { return asArray(this.s.profile?.customThemes); },
        activeCustomId() { return this.s.profile?.activeCustomThemeId || ''; },
        previewColors() { return resolveThemeColors(this.baseThemeId, this.custom); },
        changedCount() { return Object.keys(this.custom).length; },
        hasCustom() { return this.changedCount > 0; },
        /** ★ 模板拿不到模块顶层常量，必须转一道实例字段 */
        tokenCount() { return ALL_TOKENS.length; },
    },
    methods: {
        back() { this.$emit('close'); },
        pickPreset(id) {
            this.baseThemeId = id;
            // 换预设清掉单独改过的色 —— 深色的改动套到浅色上会很怪
            this.custom = {};
        },
        toggleCategory(name) { this.openCategory = this.openCategory === name ? '' : name; },
        currentColor(key) { return this.previewColors[key] || ''; },
        /** <input type="color"> 只吃 #rrggbb；rgba 的 token 只给文本框 */
        isSwatchable(key) { return /^#[0-9a-fA-F]{6}$/.test(this.currentColor(key)); },
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
            store.applyThemeSelection({ baseThemeId: this.baseThemeId, customColors: this.custom, customThemeId: '' });
            this.markThemeApplied();
            this.$emit('notify', '配色已应用');
        },
        onApplySaved(theme) {
            this.baseThemeId = theme.baseThemeId;
            this.custom = { ...theme.colors };
            store.applyThemeSelection({ baseThemeId: theme.baseThemeId, customColors: theme.colors, customThemeId: theme.id });
            this.markThemeApplied();
            this.$emit('notify', `已切到「${theme.name}」`);
        },
        onSaveAs() {
            if (!this.hasCustom) { this.$emit('notify', '还没改过任何颜色'); return; }
            store.openModal('theme-save', { baseThemeId: this.baseThemeId, colors: { ...this.custom } });
        },
        onRename(theme) {
            store.openModal('theme-rename', { theme });
        },
        onOverwrite(theme) {
            this.onOverwriteSavedTheme(theme);
        },
        onDeleteSaved(theme) {
            store.openModal('confirm', {
                title: '删除这套配色',
                message: `「${theme.name}」删掉就没了。`,
                danger: true,
                okLabel: '删除',
                onOk: () => store.removeCustomTheme(theme.id),
            });
        },

        onApplyBatch() {
            const text = String(this.batchText || '').trim();
            if (!text) { this.$emit('notify', '先粘点东西进来'); return; }
            const { colors, valid, ignored } = parseColorBatch(text);
            if (!valid) {
                this.$emit('notify', ignored ? `识别到 ${ignored} 个变量，但都不是萤火的色表` : '没解析出有效配置，检查一下格式');
                return;
            }
            this.custom = { ...this.custom, ...colors };
            this.batchText = '';
            this.$emit('notify', `已套用 ${valid} 项${ignored ? `（忽略 ${ignored} 个不认识的）` : ''}，记得点「应用」`);
        },
        onExport() { this.copy(exportColorBatch(this.previewColors), `已复制当前 ${this.tokenCount} 项配色`); },
        onCopyNames() { this.copy(exportTokenNames(), '已复制全部变量名'); },
        onCopyOne(key) { this.copy(key, `已复制 ${key}`); },

        async copy(text, okMessage) {
            try {
                await navigator.clipboard.writeText(text);
                this.$emit('notify', okMessage);
                return;
            } catch (_) { /* 非安全上下文 clipboard 不可用，走兜底 */ }
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
                this.$emit('notify', '复制失败，浏览器不允许');
            }
        },
    },
    template: `
        <div class="yt-page yt-themepage">
            <div class="yt-subtop">
                <button type="button" class="yt-subtop__back" aria-label="返回" @click="back"><YtIcon name="back" :size="18" /></button>
                <span class="yt-subtop__title">配色</span>
            </div>

            <YtSection title="内置主题">
                <div class="yt-theme-picks">
                    <button
                        v-for="p in PRESET_THEMES" :key="p.id"
                        type="button" class="yt-theme-pick" :class="{ 'is-on': baseThemeId === p.id }"
                        @click="pickPreset(p.id)"
                    >
                        <span class="yt-theme-pick__mini" :data-yt-theme="p.id">
                            <span class="yt-theme-pick__bar"></span>
                            <span class="yt-theme-pick__card"></span>
                            <span class="yt-theme-pick__dot"></span>
                        </span>
                        <span class="yt-theme-pick__name">{{ p.name }}</span>
                        <span class="yt-theme-pick__desc">{{ p.desc }}</span>
                    </button>
                </div>
                <div class="yt-row-actions">
                    <YtButton variant="primary" size="sm" icon-name="check" @click="onApply">应用</YtButton>
                    <YtButton size="sm" icon-name="save" :disabled="!hasCustom" @click="onSaveAs">存为新配色</YtButton>
                    <YtButton v-if="hasCustom" size="sm" variant="ghost" icon-name="refresh" @click="resetAll">全部还原</YtButton>
                </div>
                <p class="yt-muted">改颜色会立刻铺满整个 App 预览；不点「应用」就离开会退回原样。</p>
            </YtSection>

            <YtSection v-if="savedThemes.length" title="我的配色">
                <div class="yt-theme-chips">
                    <span v-for="t in savedThemes" :key="t.id" class="yt-theme-chip" :class="{ 'is-active': activeCustomId === t.id }">
                        <button type="button" class="yt-theme-chip__main" @click="onApplySaved(t)">{{ t.name }}</button>
                        <button type="button" class="yt-theme-chip__act" @click="onRename(t)">改名</button>
                        <button type="button" class="yt-theme-chip__act" :disabled="!hasCustom" title="用当前正在调的颜色覆盖" @click="onOverwrite(t)">覆盖</button>
                        <button type="button" class="yt-theme-chip__del" aria-label="删除" @click="onDeleteSaved(t)">×</button>
                    </span>
                </div>
            </YtSection>

            <YtSection title="批量配色">
                <div class="yt-row-actions">
                    <YtButton size="sm" icon-name="copy" @click="onCopyNames">复制变量名</YtButton>
                    <YtButton size="sm" icon-name="copy" @click="onExport">导出当前</YtButton>
                    <YtButton size="sm" variant="soft" @click="onPasteAllColors">粘贴全部</YtButton>
                </div>
                <textarea
                    v-model="batchText" class="yt-textarea" rows="4"
                    placeholder="--yt-primary: #C4485B;&#10;--yt-bg: #FBF7F4;&#10;&#10;分号或换行分隔都行，不认识的变量会被忽略"
                ></textarea>
                <YtButton size="sm" icon-name="check" @click="onApplyBatch">解析并套用</YtButton>
            </YtSection>

            <YtSection title="逐项调整" :sub="hasCustom ? '已改 ' + changedCount + ' 项' : tokenCount + ' 项可调'">
                <div v-for="cat in COLOR_CATEGORIES" :key="cat.name" class="yt-swatch-group">
                    <button type="button" class="yt-swatch-group__head" @click="toggleCategory(cat.name)">
                        <span>{{ cat.name }}</span>
                        <span class="yt-swatch-group__count">{{ cat.colors.length }}</span>
                    </button>
                    <div v-if="openCategory === cat.name" class="yt-swatch-group__body">
                        <div v-for="item in cat.colors" :key="item.key" class="yt-swatch">
                            <span class="yt-swatch__chip">
                                <span class="yt-swatch__fill" :style="{ background: currentColor(item.key) }"></span>
                                <input
                                    v-if="isSwatchable(item.key)"
                                    type="color" class="yt-swatch__picker"
                                    :value="currentColor(item.key)"
                                    :aria-label="item.label"
                                    @input="setColor(item.key, $event.target.value)"
                                />
                            </span>
                            <span class="yt-swatch__main">
                                <span class="yt-swatch__label">{{ item.label }}<i v-if="custom[item.key]" class="yt-swatch__changed">已改</i></span>
                                <code class="yt-swatch__token" title="点击复制变量名" @click="onCopyOne(item.key)">{{ item.key }}</code>
                            </span>
                            <input
                                type="text" class="yt-swatch__value"
                                :value="currentColor(item.key)"
                                :aria-label="item.label + ' 色值'"
                                @change="setColor(item.key, $event.target.value)"
                            />
                            <button v-if="custom[item.key]" type="button" class="yt-swatch__reset" aria-label="还原" @click="resetColor(item.key)">×</button>
                        </div>
                    </div>
                </div>
            </YtSection>
        </div>
    `,
};
