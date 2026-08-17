/**
 * 赛点 · 配色面板（赛训之夜 / 晨训 + 单变量自定义 + 整组粘贴覆盖）
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import {
    COLOR_CATEGORIES, PRESET_THEMES, exportColorBatch, parseColorBatch, resolveThemeColors,
} from '../theme.js';

export const EgThemePanel = {
    name: 'EgThemePanel',
    components: { ...UI },
    data() {
        return { draft: {}, batchText: '', showBatch: false };
    },
    computed: {
        s() { return store.getState(); },
        themeId() { return this.s.theme.id; },
        presets() { return PRESET_THEMES; },
        categories() { return COLOR_CATEGORIES; },
        merged() { return resolveThemeColors(this.themeId, { ...this.s.theme.custom, ...this.draft }); },
    },
    methods: {
        back() { store.setView(''); },
        /** token 值不是 6 位 hex（rgba 等）时，给原生拾色器一个 placeholder 底色 */
        pickerValue(key) {
            const v = (this.merged[key] || '').trim();
            return /^#([0-9a-f]{6})$/i.test(v) ? v : this.placeholderHex();
        },
        placeholderHex() { return '#ffffff'; },
        pickTheme(id) {
            this.draft = {};
            store.setTheme(id);
        },
        setColor(key, value) {
            this.draft = { ...this.draft, [key]: value };
        },
        async save() {
            await store.setCustomColors({ ...this.s.theme.custom, ...this.draft });
            this.draft = {};
            store.showToast('配色已保存');
        },
        async reset() {
            this.draft = {};
            await store.setCustomColors({});
            store.showToast('已恢复主题默认');
        },
        exportBatch() {
            this.batchText = exportColorBatch(this.merged);
            this.showBatch = true;
        },
        async importBatch() {
            const { colors, valid, ignored } = parseColorBatch(this.batchText);
            if (!valid) {
                store.showToast('没有识别到有效的变量');
                return;
            }
            await store.setCustomColors({ ...this.s.theme.custom, ...colors });
            this.draft = {};
            store.showToast(`覆盖了 ${valid} 个变量${ignored ? `，忽略 ${ignored} 个` : ''}`);
        },
    },
    template: `
        <div class="eg-overlay">
            <header class="eg-overlay__head">
                <button type="button" class="eg-overlay__back" @click="back"><EgIcon name="back" :size="18" /></button>
                <div class="eg-overlay__title"><b>配色</b><i>颜色全部走 token</i></div>
                <EgBtn size="sm" variant="soft" @click="exportBatch">整组导出</EgBtn>
                <EgBtn size="sm" variant="blue" @click="save">保存</EgBtn>
            </header>
            <div class="eg-overlay__body">
                <div class="eg-chiprow">
                    <button v-for="p in presets" :key="p.id" type="button"
                        class="eg-chip" :class="{ 'is-on': themeId === p.id }"
                        @click="pickTheme(p.id)">{{ p.name }}</button>
                    <EgBtn size="sm" variant="ghost" @click="reset">清自定义</EgBtn>
                </div>

                <div v-if="showBatch" class="eg-field">
                    <textarea class="eg-input eg-input--area" v-model="batchText" rows="6"></textarea>
                    <div class="eg-inline">
                        <EgBtn size="sm" variant="soft" @click="importBatch">粘贴覆盖</EgBtn>
                        <EgBtn size="sm" variant="ghost" @click="showBatch = false">收起</EgBtn>
                    </div>
                </div>

                <EgSection v-for="cat in categories" :key="cat.name" :title="cat.name">
                    <div v-for="c in cat.colors" :key="c.key" class="eg-colorrow">
                        <span class="eg-colorrow__label">{{ c.label }}</span>
                        <code class="eg-colorrow__token">{{ c.key }}</code>
                        <input type="color" class="eg-colorrow__pick"
                            :value="pickerValue(c.key)"
                            @input="setColor(c.key, $event.target.value)" />
                        <input class="eg-input is-mini" :value="merged[c.key] || ''"
                            @change="setColor(c.key, $event.target.value)" />
                    </div>
                </EgSection>
            </div>
        </div>
    `,
};
