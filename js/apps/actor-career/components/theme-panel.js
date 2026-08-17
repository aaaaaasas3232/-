/**
 * 追光 · 配色页
 *
 * 两套内置主题 + 全 token 单变量修改 + 整组粘贴覆盖 + 导出。
 * 色值真相在 css/apps/actor/index.css，这里只是读与覆写。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import {
    COLOR_CATEGORIES, PRESET_THEMES, exportColorBatch, parseColorBatch, resolveThemeColors,
} from '../theme.js';

export const AcThemePanel = {
    name: 'AcThemePanel',
    components: { ...UI },
    data() {
        return {
            batchText: '',
            showBatch: false,
            colors: {},
        };
    },
    computed: {
        s() { return store.getState(); },
        categories() { return COLOR_CATEGORIES; },
        presets() { return PRESET_THEMES; },
        themeId() { return this.s.profile?.themeId || 'stage'; },
    },
    mounted() {
        this.reload();
    },
    methods: {
        close() { store.setView(''); },
        reload() {
            this.colors = resolveThemeColors(this.themeId, this.s.profile?.customColors || {});
        },
        async pickPreset(id) {
            await store.setTheme(id);
            await store.setCustomColors({});
            this.reload();
        },
        async changeColor(key, value) {
            const custom = { ...(this.s.profile?.customColors || {}), [key]: value };
            await store.setCustomColors(custom);
            this.reload();
        },
        async applyBatch() {
            const { colors, valid, ignored } = parseColorBatch(this.batchText);
            if (!valid) {
                store.showToast('没有解析到有效的变量');
                return;
            }
            await store.setCustomColors({ ...(this.s.profile?.customColors || {}), ...colors });
            store.showToast(`应用了 ${valid} 个变量${ignored ? `，忽略 ${ignored} 个` : ''}`);
            this.reload();
        },
        async resetCustom() {
            await store.setCustomColors({});
            this.reload();
        },
        exportAll() {
            this.batchText = exportColorBatch(this.colors);
            this.showBatch = true;
        },
    },
    template: `
        <div class="zg-overlay">
            <header class="zg-overlay__head">
                <button type="button" class="zg-overlay__back" @click="close"><AcIcon name="back" :size="18" /></button>
                <b>配色</b>
            </header>
            <div class="zg-overlay__body">
                <AcSection title="内置主题">
                    <div class="zg-chiprow">
                        <button v-for="p in presets" :key="p.id" type="button"
                            class="zg-chip" :class="{ 'is-on': themeId === p.id }"
                            @click="pickPreset(p.id)">{{ p.name }} · {{ p.desc }}</button>
                    </div>
                </AcSection>

                <AcSection title="逐个改">
                    <template #action>
                        <AcBtn size="sm" variant="ghost" @click="resetCustom">全部还原</AcBtn>
                    </template>
                    <div v-for="cat in categories" :key="cat.name" class="zg-themecat">
                        <p class="zg-themecat__name">{{ cat.name }}</p>
                        <div v-for="c in cat.colors" :key="c.key" class="zg-themerow">
                            <input type="color" class="zg-themerow__swatch"
                                :value="(colors[c.key] || '#ffffff').trim()"
                                @input="changeColor(c.key, $event.target.value)" />
                            <span>{{ c.label }}</span>
                            <code>{{ c.key }}</code>
                        </div>
                    </div>
                </AcSection>

                <AcSection title="整组配色">
                    <template #action>
                        <AcBtn size="sm" variant="ghost" @click="exportAll">导出当前</AcBtn>
                    </template>
                    <textarea class="zg-input zg-input--area" v-model="batchText" rows="6"
                        placeholder="--ac-bg: #FFFFFF;\n--ac-accent: #C9971F;"></textarea>
                    <AcBtn variant="ink" block @click="applyBatch">粘贴覆盖</AcBtn>
                </AcSection>
            </div>
        </div>
    `,
};
