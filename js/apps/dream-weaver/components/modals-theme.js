/**
 * 梦境编织 · 主题设置(带实时预览)
 *
 * 1:1 复原原版 `showThemeSettingModal`(28620)+ `renderThemePreview`(29333)。
 *
 * 原版这一屏有四块:
 *   ① 内置主题卡片 —— 两列,每张卡是一个 100px 高的**迷你 UI 预览**
 *      (三个色点 + 一收一发两条气泡 + 底部毛玻璃导航条),不是纯色块
 *   ② 自定义颜色 —— 16 个分类折叠色板,共 61 个 `--dw-*` 变量,每项 color + hex 双向联动
 *   ③ 实时预览 —— 迷你书架头 + 书卡 + 两条气泡 + 底栏,改一个颜色立刻重画
 *   ④ 已保存主题 chips + 「保存为新主题」/「应用主题」
 *
 * ★ 预览是**真的用那套颜色渲染一遍 UI 片段**,不是截图也不是色块列表 ——
 *   所以改完能立刻看出「这套配色下气泡好不好看」。这是它最好用的地方。
 */

import { DwModal } from './dw-modal.js';
import * as store from '../store.js';
import { SHARED_COMPONENTS, DwIcon } from './shared.js';
import { COLOR_CATEGORIES, PRESET_THEMES, ALL_TOKENS, resolveThemeColors, applyThemeVars } from '../theme.js';
import { icon } from '../icons.js';

const BASE = { DwModal, ...SHARED_COMPONENTS };

/**
 * 迷你 UI 预览。
 *
 * 用 CSS 变量注入到一个隔离的容器上,里面的元素全部 `var(--dw-*)` ——
 * 这样「预览用的颜色」和「真正应用后的颜色」走的是同一套变量名,
 * 不可能出现「预览好看、应用后不一样」。
 */
export const DwThemePreview = {
    name: 'DwThemePreview',
    props: {
        colors: { type: Object, required: true },
        compact: { type: Boolean, default: false },
    },
    computed: {
        style() {
            // 把整套 token 直接挂到预览容器上,内部元素照常用 var() 取
            return { ...this.colors };
        },
    },
    created() {
        this.bookIcon = icon('book');
        this.moonIcon = icon('moon');
        this.shelfIcon = icon('bookshelf');
        this.profileIcon = icon('profile');
    },
    template: `
        <div class="dw-theme-preview" :class="{ 'is-compact': compact }" :style="style">
            <!--
              紧凑版(主题卡片里那个 100px 的小格)按原版:
              三个色点 + 一对气泡 + 底部导航条。**不放书卡** —— 100px 里塞不下四层,
              硬塞的结果是导航条被 overflow:hidden 裁掉,反而看不到导航色。
            -->
            <div v-if="compact" class="dw-theme-preview-dots">
                <i class="dw-theme-preview-dot dot-primary"></i>
                <i class="dw-theme-preview-dot dot-secondary"></i>
                <i class="dw-theme-preview-dot dot-accent"></i>
            </div>

            <div v-else class="dw-theme-preview-header">
                <span class="dw-theme-preview-title">梦境书架</span>
                <span class="dw-theme-preview-moon" v-html="moonIcon"></span>
            </div>

            <div v-if="!compact" class="dw-theme-preview-card">
                <span class="dw-theme-preview-cover" v-html="bookIcon"></span>
                <div class="dw-theme-preview-meta">
                    <div class="dw-theme-preview-name">示例小说</div>
                    <div class="dw-theme-preview-sub">3 章节</div>
                </div>
            </div>

            <div class="dw-theme-preview-bubbles">
                <div class="dw-theme-preview-bubble is-received">{{ compact ? '你好' : '你好，很高兴见到你' }}</div>
                <div class="dw-theme-preview-bubble is-sent">你好！</div>
            </div>

            <div class="dw-theme-preview-nav">
                <span class="dw-theme-preview-nav-item is-active"><i v-html="shelfIcon"></i>书架</span>
                <span class="dw-theme-preview-nav-item"><i v-html="profileIcon"></i>我的</span>
            </div>
        </div>
    `,
};

export const DwThemeModal = {
    name: 'DwThemeModal',
    components: { ...BASE, DwThemePreview, DwIcon },
    props: {
        payload: { type: Object, default: () => ({}) },
    },
    emits: ['close', 'notify'],
    data() {
        const settings = store.getState().library.settings;
        return {
            baseThemeId: settings.theme === 'oriental-light' ? 'oriental-light' : 'retro-dark',
            // 用户改过的颜色(只存差异,没改的继承预设)
            custom: { ...(settings.customThemeColors || {}) },
            openCategory: '',
            editorOpen: false,
            batchText: '',
            /**
             * 打开弹窗那一刻的样子。
             * 改颜色是**实时铺到整个 App** 的（见 watch previewColors），
             * 用户点「取消/关闭」时要能原样退回去，所以进来先拍一张快照。
             */
            snapshot: {
                theme: settings.theme,
                colors: { ...(settings.customThemeColors || {}) },
                customThemeId: settings.activeCustomThemeId || '',
            },
            /** 点过「应用」之后关闭就不再回滚 */
            applied: false,
        };
    },
    computed: {
        settings() { return store.getState().library.settings; },
        savedThemes() { return this.settings.customThemes || []; },
        activeCustomId() { return this.settings.activeCustomThemeId || ''; },

        /** 预览用的完整色表 = 预设 + 用户改动 */
        previewColors() {
            return resolveThemeColors(this.baseThemeId, this.custom);
        },
        hasCustom() {
            return Object.keys(this.custom).length > 0;
        },
        presets() { return PRESET_THEMES; },
        categories() { return COLOR_CATEGORIES; },
    },
    watch: {
        /**
         * 改一个颜色 → 整个 App 立刻变。
         *
         * 以前只有弹窗里那块 100px 的迷你预览会变，真实界面要点「应用」才动 ——
         * 而弹窗盖住了大半屏，用户根本判断不了这个颜色放到真的书架、真的气泡上
         * 好不好看，只能反复「应用 → 关掉 → 看一眼 → 再打开」。
         *
         * 实时铺开之后，「应用」按钮的职责收窄成「把这套配色写进存档」，
         * 不点就在关闭时回滚（onClose）。
         */
        previewColors: {
            immediate: false,
            handler(colors) { this.liveApply(colors); },
        },
    },
    methods: {
        shellEl() {
            return document.querySelector('.app-shell[data-app-id="dream-weaver"]');
        },
        /** 把一套颜色即时铺到 shell 上（只改 inline style，不写盘） */
        liveApply(colors) {
            const shell = this.shellEl();
            if (!shell) return;
            shell.setAttribute('data-dw-theme', this.baseThemeId);
            applyThemeVars(shell, this.custom || {});
            // 状态栏 / 底色 / Home 指示条 归框架管，它读的是 appConfig 字段，这里同步一次
            try {
                const cs = getComputedStyle(shell);
                const app = this.$root?.app || this.payload?.app;
                if (app) {
                    const ink = cs.getPropertyValue('--dw-text').trim();
                    const bg = cs.getPropertyValue('--dw-bg').trim();
                    const indicator = cs.getPropertyValue('--dw-home-indicator').trim();
                    if (ink) app.statusBarColor = ink;
                    if (bg) app.background = bg;
                    if (indicator) app.homeIndicatorColor = indicator;
                    // ★ 重赋 apps.value 强制框架 computed 重算（core-shim 约定的通知路径），
                    //   否则背景层 / home 指示条可能停在旧主题色（AGENTS2 §18.2）
                    if (window.__phoneAppsRef?.value) window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
                }
            } catch (_) { /* 拿不到 app 就只改 shell，不影响主体验 */ }
            void colors;
        },
        /** 关弹窗时如果没点过应用，把界面退回打开前的样子 */
        rollback() {
            const shell = this.shellEl();
            if (!shell) return;
            shell.setAttribute('data-dw-theme', this.snapshot.theme || 'retro-dark');
            applyThemeVars(shell, this.snapshot.colors || {});
        },
        onClose() {
            if (!this.applied) this.rollback();
            this.$emit('close');
        },
        presetColors(id) {
            return resolveThemeColors(id, {});
        },
        isPresetActive(id) {
            return !this.activeCustomId && this.settings.theme === id;
        },
        pickPreset(id) {
            this.baseThemeId = id;
            // 切基础主题时清掉改动 —— 否则深色改的值套到浅色上会很怪
            this.custom = {};
        },

        toggleCategory(name) {
            this.openCategory = this.openCategory === name ? '' : name;
        },
        currentColor(key) {
            return this.previewColors[key] || '';
        },
        /**
         * `<input type="color">` 只接受 `#rrggbb`。
         *
         * token 里有相当一部分是 `rgba(...)`(遮罩、悬浮层、玻璃背景),
         * 塞给取色器会被它当成非法值静默显示成黑色。所以这类只给旁边的文本框编辑,
         * 不显示取色器(`isSwatchable` 控制),这个兜底值只是为了满足 input 的类型约束、
         * 实际不会被渲染出来 —— 它不是主题色,不算硬编码配色。
         */
        swatchValue(key) {
            const value = this.currentColor(key);
            return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000';
        },
        isSwatchable(key) {
            return /^#[0-9a-fA-F]{6}$/.test(this.currentColor(key));
        },
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
        resetAll() {
            this.custom = {};
        },

        onApply() {
            store.applyTheme({
                baseThemeId: this.baseThemeId,
                customColors: this.custom,
                customThemeId: '',
            });
            this.applied = true;
            this.$emit('notify', '主题已应用');
            this.$emit('close');
        },
        onApplySaved(theme) {
            store.applyTheme({
                baseThemeId: theme.baseThemeId,
                customColors: theme.colors,
                customThemeId: theme.id,
            });
            this.applied = true;
            this.$emit('notify', `已切换到「${theme.name}」`);
            this.$emit('close');
        },
        onSaveAs() {
            if (!this.hasCustom) {
                this.$emit('notify', '还没改过任何颜色');
                return;
            }
            store.openModal('rename', {
                title: '保存为新主题',
                value: '',
                placeholder: '给这套配色起个名字',
                onSubmit: (name) => {
                    const saved = store.saveCustomTheme({
                        name: name || '自定义主题',
                        baseThemeId: this.baseThemeId,
                        colors: this.custom,
                    });
                    if (saved) {
                        this.applied = true;
                        this.$emit('notify', `已保存「${saved.name}」`);
                    }
                },
            });
        },
        /** 改名：不动配色，只改这套主题叫什么 */
        onRenameSaved(theme) {
            store.openModal('rename', {
                title: '给这套配色改个名',
                value: theme.name,
                placeholder: '主题名',
                onSubmit: (name) => {
                    store.updateCustomTheme(theme.id, { name });
                    this.$emit('notify', '已改名');
                },
            });
        },
        /** 用当前正在调的这套颜色覆盖已保存的主题 —— 免得改一版存一条 */
        onOverwriteSaved(theme) {
            store.openModal('confirm', {
                title: `用当前配色覆盖「${theme.name}」？`,
                message: '这套主题原来的颜色会被替换掉，不能撤销。',
                onConfirm: () => {
                    store.updateCustomTheme(theme.id, {
                        colors: this.custom,
                        baseThemeId: this.baseThemeId,
                    });
                    this.applied = true;
                    this.$emit('notify', `已更新「${theme.name}」`);
                },
            });
        },
        onDeleteSaved(theme) {
            store.openModal('confirm', {
                title: `删掉「${theme.name}」？`,
                message: '只删这套保存的配色，当前界面不受影响。',
                danger: true,
                onConfirm: () => {
                    store.removeCustomTheme(theme.id);
                    this.$emit('notify', '已删除');
                },
            });
        },

        // ── 批量配置 ──────────────────────
        // 原版最好用的一块:一次性粘一整套配色进来,不用一个一个点。

        /**
         * 解析并应用。
         *
         * 格式照抄原版:`--dw-bg:#121212;--dw-primary:#C62828`,
         * 分号和换行都能当分隔符,冒号两边空格随意。
         * 不在白名单里的变量名直接忽略(而不是报错整段失败)——
         * 用户常常是从别处整段拷过来的,里面混着别的变量很正常。
         */
        onApplyBatch() {
            const text = String(this.batchText || '').trim();
            if (!text) {
                this.$emit('notify', '先粘点东西进来');
                return;
            }
            const { valid, ignored } = this.ingestColorText(text);
            if (valid === 0) {
                this.$emit('notify', ignored ? `识别到 ${ignored} 个变量但都不在本 App 的色表里` : '没解析出有效配置,检查一下格式');
                return;
            }
            this.batchText = '';
            this.$emit('notify', `已应用 ${valid} 项${ignored ? `(忽略 ${ignored} 个不认识的)` : ''}`);
        },

        /**
         * 「粘贴全部」：直接读剪贴板，解析、应用，一步到位。
         *
         * 典型流程是「复制变量名 → 丢给 AI 配色 → 复制它的回答 → 回来」。
         * 走到这一步用户手上已经有内容了，还要先点进输入框、长按、选粘贴，
         * 在手机上是三次操作。这个按钮把这三步合成一次。
         *
         * 读不到剪贴板（非安全上下文 / 用户拒权）就退回提示，让他手动贴。
         */
        async onPasteAll() {
            let text = '';
            try {
                text = await navigator.clipboard.readText();
            } catch (_) {
                this.$emit('notify', '浏览器不让直接读剪贴板，粘到下面的框里再点「解析并应用」');
                return;
            }
            if (!String(text || '').trim()) {
                this.$emit('notify', '剪贴板是空的');
                return;
            }
            const { valid, ignored } = this.ingestColorText(text);
            if (valid === 0) {
                // 解析不出来时把原文留在输入框里，用户能看到自己复制的到底是什么
                this.batchText = text;
                this.$emit('notify', ignored ? `识别到 ${ignored} 个变量但都不在色表里` : '剪贴板里没有 --dw-* 配置，已贴到下面供你检查');
                return;
            }
            this.$emit('notify', `已从剪贴板应用 ${valid} 项${ignored ? `(忽略 ${ignored} 个)` : ''}`);
        },

        /**
         * 解析一段 `--dw-xxx: 值;` 文本并合并进 custom。
         *
         * 分号和换行都能当分隔符，冒号两边空格随意，`/* 注释 *\/` 会被剥掉。
         * 不在白名单里的变量名直接忽略（而不是整段失败）—— 用户常常是从别处
         * 整段拷过来的，里面混着别的变量很正常。
         */
        ingestColorText(text) {
            const cleaned = String(text || '').replace(/\/\*[\s\S]*?\*\//g, ' ');
            const parsed = {};
            let valid = 0;
            let ignored = 0;
            for (const raw of cleaned.split(/[;\n]+/)) {
                const entry = raw.trim();
                if (!entry) continue;
                const match = entry.match(/^(--dw-[a-z0-9-]+)\s*:\s*(.+?)\s*;?$/i);
                if (!match) continue;
                const key = match[1].toLowerCase();
                if (!ALL_TOKENS.includes(key)) { ignored += 1; continue; }
                const value = match[2].trim();
                if (!value) continue;
                parsed[key] = value;
                valid += 1;
            }
            if (valid > 0) this.custom = { ...this.custom, ...parsed };
            return { valid, ignored };
        },

        /** 把所有变量名连同当前值倒出来 —— 拿去别处改完再粘回来 */
        onExportColors() {
            const colors = this.previewColors;
            const text = COLOR_CATEGORIES
                .map((cat) => {
                    const lines = cat.colors.map((c) => `${c.key}: ${colors[c.key] || ''};`);
                    return `/* ${cat.name} */\n${lines.join('\n')}`;
                })
                .join('\n\n');
            this.copy(text, `已复制当前 ${ALL_TOKENS.length} 项配色`);
        },

        /** 只倒变量名(不带值),方便照着填 */
        onCopyVarNames() {
            const text = COLOR_CATEGORIES
                .map((cat) => `/* ${cat.name} */\n${cat.colors.map((c) => `${c.key}: ;`).join('\n')}`)
                .join('\n\n');
            this.copy(text, '已复制全部变量名');
        },

        /** 单个变量名 —— 点色板行上那个灰色小标签 */
        onCopyVarName(key) {
            this.copy(key, `已复制 ${key}`);
        },

        async copy(text, okMessage) {
            try {
                await navigator.clipboard.writeText(text);
                this.$emit('notify', okMessage);
            } catch (_) {
                // 非安全上下文里 clipboard 不可用,退回 textarea + execCommand
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
            }
        },
    },
    template: `
        <DwModal class="dw-theme-modal" title="主题" max-width="340px" @close="onClose">
            <!-- ① 内置主题 -->
            <p class="dw-modal-hint">内置主题</p>
            <div class="dw-theme-cards">
                <div
                    v-for="preset in presets"
                    :key="preset.id"
                    class="dw-theme-card"
                    :class="{ active: baseThemeId === preset.id }"
                    role="button"
                    :aria-label="preset.name"
                    @click="pickPreset(preset.id)"
                >
                    <DwThemePreview :colors="presetColors(preset.id)" compact />
                    <div class="dw-theme-name">{{ preset.name }}</div>
                    <span class="dw-theme-check"><DwIcon name="check" /></span>
                </div>
            </div>

            <!-- ③ 实时预览(放在色板上面,改色时不用往下滚就能看到) -->
            <p class="dw-modal-hint">实时预览</p>
            <DwThemePreview :colors="previewColors" />

            <!-- ② 自定义颜色 -->
            <button type="button" class="dw-theme-editor-toggle" @click="editorOpen = !editorOpen">
                <DwIcon :name="editorOpen ? 'chevronDown' : 'chevronRight'" />
                <span>自定义颜色</span>
                <em v-if="hasCustom">已改 {{ Object.keys(custom).length }} 项</em>
            </button>

            <div v-if="editorOpen" class="dw-theme-editor">
                <!-- 批量配置:一次粘一整套,不用一个一个点 -->
                <div class="dw-batch-block">
                    <div class="dw-batch-head">
                        <span class="dw-batch-title">批量配置</span>
                        <div class="dw-batch-actions">
                            <button type="button" class="dw-batch-mini" @click="onCopyVarNames">复制变量名</button>
                            <button type="button" class="dw-batch-mini" @click="onExportColors">导出当前</button>
                            <button type="button" class="dw-batch-mini is-primary" @click="onPasteAll">粘贴全部</button>
                        </div>
                    </div>
                    <textarea
                        v-model="batchText"
                        class="dw-batch-input"
                        rows="4"
                        placeholder="--dw-bg: #121212;&#10;--dw-primary: #C62828;&#10;&#10;分号或换行分隔都行,不认识的变量会被忽略"
                    ></textarea>
                    <button type="button" class="dw-batch-apply" @click="onApplyBatch">解析并应用</button>
                </div>

                <button v-if="hasCustom" type="button" class="dw-theme-reset-all" @click="resetAll">全部恢复默认</button>

                <div v-for="cat in categories" :key="cat.name" class="dw-color-category">
                    <button type="button" class="dw-color-category-head" @click="toggleCategory(cat.name)">
                        <DwIcon :name="openCategory === cat.name ? 'chevronDown' : 'chevronRight'" />
                        <span>{{ cat.name }}</span>
                        <em>{{ cat.colors.length }}</em>
                    </button>

                    <div v-if="openCategory === cat.name" class="dw-color-rows">
                        <div v-for="item in cat.colors" :key="item.key" class="dw-color-row">
                            <span class="dw-color-label">
                                <span class="dw-color-label-top">
                                    {{ item.label }}
                                    <em v-if="custom[item.key]">已改</em>
                                </span>
                                <!-- 点变量名直接复制 —— 原版的小设计,批量配置时很省事 -->
                                <code
                                    class="dw-color-varname"
                                    title="点击复制变量名"
                                    @click="onCopyVarName(item.key)"
                                >{{ item.key }}</code>
                            </span>
                            <input
                                v-if="isSwatchable(item.key)"
                                type="color"
                                class="dw-color-input"
                                :value="swatchValue(item.key)"
                                :aria-label="item.label"
                                @input="setColor(item.key, $event.target.value)"
                            />
                            <input
                                type="text"
                                class="dw-color-hex"
                                :value="currentColor(item.key)"
                                :aria-label="item.label + ' 色值'"
                                @change="setColor(item.key, $event.target.value)"
                            />
                            <button
                                v-if="custom[item.key]"
                                type="button"
                                class="dw-color-reset"
                                aria-label="恢复默认"
                                @click="resetColor(item.key)"
                            >×</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ④ 已保存的主题 -->
            <template v-if="savedThemes.length">
                <p class="dw-modal-hint">已保存</p>
                <div class="dw-theme-chips">
                    <span
                        v-for="theme in savedThemes"
                        :key="theme.id"
                        class="dw-theme-chip"
                        :class="{ active: activeCustomId === theme.id }"
                    >
                        <button type="button" class="dw-theme-chip-main" @click="onApplySaved(theme)">
                            <i class="dw-theme-chip-dot" :style="{ background: resolveThemeColors(theme.baseThemeId, theme.colors)['--dw-primary'] }"></i>
                            {{ theme.name }}
                        </button>
                        <button type="button" class="dw-theme-chip-act" aria-label="改名" title="改名" @click="onRenameSaved(theme)"><DwIcon name="pen" /></button>
                        <button type="button" class="dw-theme-chip-act" aria-label="用当前配色覆盖" title="用当前配色覆盖" :disabled="!hasCustom" @click="onOverwriteSaved(theme)"><DwIcon name="save" /></button>
                        <button type="button" class="dw-theme-chip-del" aria-label="删除" @click="onDeleteSaved(theme)">×</button>
                    </span>
                </div>
            </template>

            <template #footer>
                <button type="button" class="ac-btn ac-btn-secondary" :disabled="!hasCustom" @click="onSaveAs">存为新主题</button>
                <button type="button" class="ac-btn ac-btn-primary" @click="onApply">应用</button>
            </template>
        </DwModal>
    `,
    created() {
        this.resolveThemeColors = resolveThemeColors;
    },
    beforeUnmount() {
        // 关弹窗（点遮罩 / 按 Esc）也要回滚，不能只靠 onClose 那一条路径
        if (!this.applied) this.rollback();
    },
};

export const THEME_MODAL_COMPONENTS = { DwThemeModal, DwThemePreview };
