/**
 * 点灯 · 配色
 *
 * 走框架的 createThemePanelMixin，六件事一次到位：
 *   改一个颜色整个 App 立刻变 / 可命名保存 / 可改名 / 可覆盖 / 可删 /
 *   复制变量名 + 一键粘贴全部。
 *
 * mixin 直接读组件上的 `baseThemeId` 和 `custom` 两个字段，名字不能改。
 */

import { createThemePanelMixin } from '@/src/core/theme-panel-mixin.js';
import {
    ALL_TOKENS, COLOR_CATEGORIES, PRESET_THEMES,
    applyThemeVars, exportColorBatch, exportTokenNames,
    parseColorBatch, readPresetColors, resolveThemeColors,
} from '../theme.js';
import * as store from '../store.js';
import { UI } from './ui.js';

const themeMixin = createThemePanelMixin({
    appId: 'starlit',
    attr: 'data-sl-theme',
    applyThemeVars,
    parseColorBatch,
    store,
});

export const SlThemePanel = {
    name: 'SlThemePanel',
    mixins: [themeMixin],
    components: { ...UI },
    emits: ['close', 'notify'],
    data() {
        const p = store.getState().profile || {};
        return {
            baseThemeId: p.themeId || 'lantern',
            custom: { ...(p.customColors || {}) },
            batchText: '',
            openCat: '底色',
            saveName: '',
        };
    },
    computed: {
        state() { return store.getState(); },
        settings() {
            const p = this.state.profile || {};
            return { theme: p.themeId, customThemeColors: p.customColors };
        },
        presets() { return PRESET_THEMES; },
        categories() { return COLOR_CATEGORIES; },
        saved() { return this.state.profile?.customThemes || []; },
        resolved() { return resolveThemeColors(this.baseThemeId, this.custom); },
    },
    methods: {
        valueOf(key) {
            return this.custom[key] || this.resolved[key] || '';
        },
        setColor(key, value) {
            this.custom = { ...this.custom, [key]: value };
        },
        clearColor(key) {
            const next = { ...this.custom };
            delete next[key];
            this.custom = next;
        },
        previewOf(themeId) {
            const colors = readPresetColors(themeId);
            return {
                background: colors['--sl-bg'] || '',
                borderColor: colors['--sl-line'] || '',
            };
        },
        chipOf(themeId, key) {
            const colors = readPresetColors(themeId);
            return { background: colors[key] || '' };
        },
        pickPreset(id) {
            this.baseThemeId = id;
            this.custom = {};
        },
        apply() {
            store.applyTheme(this.baseThemeId, this.custom);
            this.markThemeApplied();
            this.$emit('notify', '已应用');
        },
        saveNew() {
            const name = this.saveName.trim() || `我的配色 ${this.saved.length + 1}`;
            store.saveCustomTheme(name, this.custom, this.baseThemeId);
            this.markThemeApplied();
            this.saveName = '';
            this.$emit('notify', `已存为「${name}」`);
        },
        useSaved(theme) {
            this.baseThemeId = theme.baseThemeId || this.baseThemeId;
            this.custom = { ...(theme.colors || {}) };
            store.useCustomTheme(theme.id);
            this.markThemeApplied();
            this.$emit('notify', `换成「${theme.name}」`);
        },
        removeSaved(theme) {
            store.removeCustomTheme(theme.id);
            this.$emit('notify', '已删除');
        },
        async copyNames() {
            try {
                await navigator.clipboard.writeText(exportTokenNames());
                this.$emit('notify', '变量名已复制，丢给 AI 让它配一套回来');
            } catch (_) {
                this.batchText = exportTokenNames();
                this.$emit('notify', '浏览器不让写剪贴板，已经贴到下面的框里');
            }
        },
        async copyCurrent() {
            try {
                await navigator.clipboard.writeText(exportColorBatch(this.resolved));
                this.$emit('notify', '当前配色已复制');
            } catch (_) {
                this.batchText = exportColorBatch(this.resolved);
                this.$emit('notify', '已贴到下面的框里');
            }
        },
        parseBatch() {
            const { colors, valid, ignored } = parseColorBatch(this.batchText);
            if (!valid) {
                this.$emit('notify', ignored ? `识别到 ${ignored} 个变量，但都不是本 App 的` : '没识别出配色变量');
                return;
            }
            this.custom = { ...this.custom, ...colors };
            this.$emit('notify', `套用了 ${valid} 项${ignored ? `（忽略 ${ignored} 个）` : ''}`);
        },
        resetAll() {
            this.custom = {};
            this.$emit('notify', '已回到内置配色');
        },
        tokenCount() { return ALL_TOKENS.length; },
    },
    template: `
        <div class="sl-theme">
            <SlTopbar title="配色" :sub="tokenCount() + ' 个可调项'" @back="$emit('close')">
                <template #actions>
                    <button type="button" class="sl-topbar__btn" @click="apply"><SlIcon name="check" :size="18" /></button>
                </template>
            </SlTopbar>

            <div class="sl-theme__scroll">
                <SlSection title="内置">
                    <div class="sl-theme__presets">
                        <button
                            v-for="p in presets" :key="p.id" type="button"
                            class="sl-theme__preset" :class="{ 'is-on': baseThemeId === p.id }"
                            :style="previewOf(p.id)"
                            @click="pickPreset(p.id)"
                        >
                            <span class="sl-theme__chips">
                                <i :style="chipOf(p.id, '--sl-primary')"></i>
                                <i :style="chipOf(p.id, '--sl-accent')"></i>
                                <i :style="chipOf(p.id, '--sl-link-red')"></i>
                            </span>
                            <b>{{ p.name }}</b>
                            <em>{{ p.desc }}</em>
                        </button>
                    </div>
                </SlSection>

                <SlSection v-if="saved.length" title="存过的">
                    <div v-for="t in saved" :key="t.id" class="sl-theme__saved">
                        <button type="button" class="sl-theme__saved-main" @click="useSaved(t)">
                            <b>{{ t.name }}</b>
                            <i>{{ Object.keys(t.colors || {}).length }} 项改动</i>
                        </button>
                        <button type="button" @click="onRenameSavedTheme(t)"><SlIcon name="edit" :size="14" /></button>
                        <button type="button" @click="onOverwriteSavedTheme(t)"><SlIcon name="check" :size="14" /></button>
                        <button type="button" @click="removeSaved(t)"><SlIcon name="trash" :size="14" /></button>
                    </div>
                </SlSection>

                <SlSection title="批量">
                    <div class="sl-theme__batch-btns">
                        <SlButton size="sm" variant="line" @click="copyNames">复制变量名</SlButton>
                        <SlButton size="sm" variant="line" @click="copyCurrent">导出当前</SlButton>
                        <SlButton size="sm" variant="primary" @click="onPasteAllColors">粘贴全部</SlButton>
                    </div>
                    <textarea
                        class="sl-textarea" v-model="batchText" rows="4"
                        placeholder="剪贴板读不了的时候，把配色贴到这里再点解析"
                    ></textarea>
                    <SlButton size="sm" variant="soft" :disabled="!batchText.trim()" @click="parseBatch">解析并套用</SlButton>
                </SlSection>

                <SlSection v-for="cat in categories" :key="cat.name" :title="cat.name">
                    <template #action>
                        <button type="button" class="sl-theme__fold" @click="openCat = openCat === cat.name ? '' : cat.name">
                            <SlIcon :name="openCat === cat.name ? 'close' : 'chevron'" :size="14" />
                        </button>
                    </template>
                    <div v-show="openCat === cat.name" class="sl-theme__colors">
                        <div v-for="c in cat.colors" :key="c.key" class="sl-theme__row">
                            <span class="sl-theme__swatch" :style="{ background: valueOf(c.key) }"></span>
                            <span class="sl-theme__label">{{ c.label }}</span>
                            <input
                                class="sl-input sl-input--mini"
                                :value="valueOf(c.key)"
                                @input="setColor(c.key, $event.target.value)"
                            />
                            <button v-if="custom[c.key]" type="button" @click="clearColor(c.key)">
                                <SlIcon name="refresh" :size="13" />
                            </button>
                        </div>
                    </div>
                </SlSection>

                <SlSection title="保存这一套">
                    <input class="sl-input" v-model="saveName" placeholder="给它起个名字" />
                    <div class="sl-theme__batch-btns">
                        <SlButton size="sm" variant="ghost" @click="resetAll">恢复内置</SlButton>
                        <SlButton size="sm" variant="line" @click="saveNew">存为新配色</SlButton>
                        <SlButton size="sm" variant="primary" @click="apply">应用</SlButton>
                    </div>
                </SlSection>
            </div>
        </div>
    `,
};

export default SlThemePanel;
