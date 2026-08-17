/**
 * 灯塔 · 配色
 *
 * 和梦境编织 / 四叶草同一套：单个颜色能改，也能把变量名整套复制然后一起覆盖。
 *
 * ── 三个按钮的分工 ────────────────────────────────────────────────
 *   复制变量名   给出空模板 `--jb-bg: ;`，用户拿去别处填
 *   导出当前     带值，用来备份或者分享给别人
 *   粘贴应用     解析一整段，**不认识的变量跳过而不是整段失败**
 *
 * 最后那条很重要：用户多半是从别的 App 或别人那儿整段拷来的，
 * 里面混着 `--sp-*` `--dw-*` 很正常。整段失败的话他根本不知道是哪一行的问题。
 *
 * ── 改色是实时的 ──────────────────────────────────────────────────
 *
 * 点一格颜色立刻写到根节点，整个 App 当场变。不做「预览 / 应用」两段式 ——
 * 配色这种东西必须边改边看，隔一层预览等于没看。
 */

import * as store from '../store.js';
import { UI } from './ui.js';
import {
    COLOR_CATEGORIES, PRESET_THEMES, ALL_TOKENS,
    resolveThemeColors, parseColorBatch, formatColorBatch, formatTokenTemplate,
} from '../theme.js';

export const JbThemePanel = {
    name: 'JbThemePanel',
    components: { ...UI },
    emits: ['close'],
    data() {
        return {
            openGroup: '底色',
            batchText: '',
            batchMsg: '',
        };
    },
    computed: {
        s() { return store.getState(); },
        themeId() { return this.s.profile?.themeId || 'dayshift'; },
        custom() { return this.s.profile?.customColors || {}; },
        presets() { return PRESET_THEMES; },
        groups() { return COLOR_CATEGORIES; },
        tokenCount() { return ALL_TOKENS.length; },
        /** 当前实际生效的色表：预设读自 CSS，再叠用户改过的 */
        resolved() { return resolveThemeColors(this.themeId, this.custom); },
        changedCount() { return Object.keys(this.custom).length; },
    },
    methods: {
        pickTheme(id) { store.setThemeId(id); },
        toggleGroup(name) { this.openGroup = this.openGroup === name ? '' : name; },
        valueOf(token) { return this.resolved[token] || ''; },
        isChanged(token) { return Object.prototype.hasOwnProperty.call(this.custom, token); },

        onColorInput(token, e) { store.setCustomColor(token, e.target.value); },
        onTextInput(token, e) { store.setCustomColor(token, String(e.target.value || '').trim()); },
        resetOne(token) { store.setCustomColor(token, ''); },
        resetAll() {
            store.resetColors();
            this.batchMsg = '已回到内置配色';
        },

        /**
         * `<input type="color">` 只认 `#rrggbb` 六位形式。
         *
         * 变量值可能是 `rgba(...)`（遮罩、阴影、毛玻璃那几个就是），
         * 这时候色块不可用，只能用右边那个文本框改 —— 所以两个都给，
         * 色块套 `v-if="isHex"`。
         *
         * ⚠️ 不要为此写一个 `'#000000'` 的兜底常量：那就成了「JS 里的硬编码颜色」，
         *    而且因为有 `v-if` 它永远跑不到。
         */
        hexOf(token) {
            const hex = String(this.valueOf(token)).trim().slice(1);
            return hex.length === 3
                ? `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
                : `#${hex}`;
        },
        isHex(token) {
            return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(this.valueOf(token)).trim());
        },

        async copyTemplate() {
            await this.writeClipboard(formatTokenTemplate(), '变量名已复制，去别处填好再粘回来');
        },
        async copyCurrent() {
            const map = {};
            for (const t of ALL_TOKENS) map[t] = this.valueOf(t);
            await this.writeClipboard(formatColorBatch(map), '当前配色已复制');
        },
        async writeClipboard(text, okMsg) {
            try {
                await navigator.clipboard.writeText(text);
                this.batchMsg = okMsg;
            } catch (_) {
                // 剪贴板可能被浏览器拦（非安全上下文）。塞进文本框让用户自己复制，
                // 比弹一句「复制失败」有用
                this.batchText = text;
                this.batchMsg = '浏览器不让直接写剪贴板，已经放到下面的框里了';
            }
        },
        applyBatch() {
            const { colors, accepted, ignored } = parseColorBatch(this.batchText);
            if (!accepted.length) {
                this.batchMsg = '这段里没有认识的变量。格式是 --jb-bg: #f4f6f8;';
                return;
            }
            store.applyColorBatch(colors);
            this.batchMsg = ignored.length
                ? `应用了 ${accepted.length} 个，跳过 ${ignored.length} 个不认识的`
                : `应用了 ${accepted.length} 个`;
        },
    },
    template: `
        <jb-panel title="配色" @close="$emit('close')">
            <template #bar>
                <jb-btn v-if="changedCount" size="sm" variant="ghost" @click="resetAll">还原</jb-btn>
            </template>

            <jb-section title="内置主题">
                <div class="jb-theme__picks">
                    <button
                        v-for="p in presets" :key="p.id"
                        class="jb-theme__pick" :class="{ 'is-on': p.id === themeId }"
                        :data-jb-theme="p.id"
                        @click="pickTheme(p.id)"
                    >
                        <span class="jb-theme__mini">
                            <i class="jb-theme__bar"></i>
                            <i class="jb-theme__card"></i>
                            <i class="jb-theme__dot"></i>
                        </span>
                        <span class="jb-theme__name">{{ p.name }}</span>
                        <span class="jb-theme__desc">{{ p.desc }}</span>
                    </button>
                </div>
                <p v-if="changedCount" class="jb-panel__note">
                    你改过 {{ changedCount }} 个颜色。换内置主题会把这些改动清掉。
                </p>
            </jb-section>

            <jb-section title="逐个改" :sub="'共 ' + tokenCount + ' 项'">
                <div v-for="g in groups" :key="g.name" class="jb-swatch-group">
                    <button class="jb-swatch-group__head" @click="toggleGroup(g.name)">
                        <span>{{ g.name }}</span>
                        <span class="jb-swatch-group__count">{{ g.colors.length }}</span>
                    </button>
                    <div v-if="openGroup === g.name" class="jb-swatch-group__body">
                        <div v-for="c in g.colors" :key="c.key" class="jb-swatch">
                            <span class="jb-swatch__chip" :style="{ background: valueOf(c.key) }">
                                <input
                                    v-if="isHex(c.key)"
                                    type="color" class="jb-swatch__picker"
                                    :value="hexOf(c.key)"
                                    @input="onColorInput(c.key, $event)"
                                />
                            </span>
                            <span class="jb-swatch__main">
                                <span class="jb-swatch__label">
                                    {{ c.label }}
                                    <i v-if="isChanged(c.key)" class="jb-swatch__changed">改过</i>
                                </span>
                                <input
                                    class="jb-swatch__value"
                                    :value="valueOf(c.key)"
                                    spellcheck="false"
                                    @change="onTextInput(c.key, $event)"
                                />
                                <code class="jb-swatch__token">{{ c.key }}</code>
                            </span>
                            <button v-if="isChanged(c.key)" class="jb-swatch__reset" @click="resetOne(c.key)">
                                还原
                            </button>
                        </div>
                    </div>
                </div>
            </jb-section>

            <jb-section title="整套覆盖">
                <div class="jb-batch__actions">
                    <jb-btn size="sm" variant="line" icon="copy" @click="copyTemplate">复制变量名</jb-btn>
                    <jb-btn size="sm" variant="line" icon="copy" @click="copyCurrent">导出当前</jb-btn>
                </div>
                <jb-textarea
                    v-model="batchText"
                    :rows="6"
                    placeholder="--jb-bg: #f4f6f8;&#10;--jb-primary: #3e5c86;&#10;（不认识的变量会自动跳过，不影响其他行）"
                />
                <div class="jb-batch__actions">
                    <jb-btn variant="primary" @click="applyBatch">解析并应用</jb-btn>
                </div>
                <p v-if="batchMsg" class="jb-panel__note">{{ batchMsg }}</p>
            </jb-section>
        </jb-panel>
    `,
};
