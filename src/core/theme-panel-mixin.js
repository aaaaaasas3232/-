/**
 * 框架层 · 配色面板的公共行为
 *
 * ── 解决什么 ────────────────────────────────────────────────────
 *
 * 项目里有四个 App 各自做了一套「可调配色」（梦境编织 / 湛蓝回忆 /
 * 情景聊天 / 气泡机）。四份代码几乎一样，也一起漏了同样三件事：
 *
 *   1. **改完不实时** —— 只有面板里那块小预览会变，真实界面要点「应用」。
 *      而面板往往盖住大半屏，用户根本判断不了这个颜色放到真界面上好不好看，
 *      只能「应用 → 关掉 → 看一眼 → 再打开」来回折腾。
 *   2. **存了不能改** —— 只有「存为新配色」和「删除」，改一版就多存一条，
 *      几次之后列表里躺着五六个「自定义主题」，谁也认不出哪个是哪个。
 *   3. **粘贴要三步** —— 典型流程是「复制变量名 → 丢给 AI 配色 → 复制回答 →
 *      回到 App」。到这一步剪贴板里已经有内容了，还要点进输入框、长按、选粘贴。
 *
 * 这个 mixin 把三件事一次补齐，各 App 只要在模板里摆按钮。
 *
 * ── 用法 ────────────────────────────────────────────────────────
 *
 *   import { createThemePanelMixin } from '@/src/core/theme-panel-mixin.js';
 *   import { ALL_TOKENS, applyThemeVars, parseColorBatch } from '../theme.js';
 *
 *   const themeMixin = createThemePanelMixin({
 *       appId: 'galgame',
 *       attr: 'data-gg-theme',
 *       applyThemeVars,
 *       parseColorBatch,
 *       store,                       // 需要 applyTheme / saveCustomTheme /
 *                                    // updateCustomTheme / removeCustomTheme
 *   });
 *
 *   export const GgThemePanel = {
 *       mixins: [themeMixin],
 *       data() { return { baseThemeId: 'azure', custom: {} }; },  // 名字固定
 *       ...
 *   };
 *
 * 约定（mixin 直接读组件上的这两个字段，名字不能改）：
 *   - `this.baseThemeId`  当前基础主题 id
 *   - `this.custom`       用户改过的 token（只存差异）
 */

/**
 * @param {object} opts
 * @param {string} opts.appId
 * @param {string} opts.attr             主题属性名，如 'data-gg-theme'
 * @param {Function} opts.applyThemeVars 来自该 App 的 theme.js
 * @param {Function} opts.parseColorBatch 同上
 * @param {object} opts.store            该 App 的 store 模块
 * @param {string} [opts.notifyEvent]    发提示用的事件名，默认 'notify'
 */
export function createThemePanelMixin(opts = {}) {
    const {
        appId, attr, applyThemeVars, parseColorBatch, store,
        notifyEvent = 'notify',
    } = opts;

    return {
        data() {
            return {
                /** 进面板那一刻的样子，用来在放弃修改时退回去 */
                __themeSnapshot: null,
                /** 点过「应用」之后就不回滚了 */
                __themeApplied: false,
            };
        },
        watch: {
            /**
             * 改一个颜色 → 整个 App 立刻变。
             * 只写 inline style，不落盘；落盘仍然是「应用」按钮的事。
             */
            custom: {
                deep: true,
                handler() { this.liveApplyTheme(); },
            },
            baseThemeId() { this.liveApplyTheme(); },
        },
        mounted() {
            const settings = this.settings || {};
            this.__themeSnapshot = {
                theme: settings.theme || this.baseThemeId,
                colors: { ...(settings.customThemeColors || {}) },
            };
        },
        beforeUnmount() {
            // 没点应用就离开：把界面退回进来时的样子，别留一屏没保存的颜色
            if (!this.__themeApplied) this.rollbackTheme();
        },
        methods: {
            themeShellEl() {
                if (typeof document === 'undefined') return null;
                return document.querySelector(`.app-shell[data-app-id="${appId}"]`);
            },

            liveApplyTheme() {
                const shell = this.themeShellEl();
                if (!shell) return;
                if (this.baseThemeId) shell.setAttribute(attr, this.baseThemeId);
                applyThemeVars(shell, this.custom || {});
                const cs = getComputedStyle(shell);
                const indicator = (cs.getPropertyValue('--gg-home-indicator')
                    || cs.getPropertyValue('--home-indicator')
                    || cs.getPropertyValue('--ac-home-indicator')
                    || '').trim();
                const app = this.app || window.__phoneAppsRef?.value?.find?.((a) => a.id === appId);
                if (app && indicator) app.homeIndicatorColor = indicator;
                if (window.__phoneAppsRef?.value) window.__phoneAppsRef.value = [...window.__phoneAppsRef.value];
            },

            rollbackTheme() {
                const shell = this.themeShellEl();
                const snap = this.__themeSnapshot;
                if (!shell || !snap) return;
                if (snap.theme) shell.setAttribute(attr, snap.theme);
                applyThemeVars(shell, snap.colors || {});
            },

            /** 点了「应用」之后调一次，之后离开不再回滚 */
            markThemeApplied() {
                this.__themeApplied = true;
                this.__themeSnapshot = {
                    theme: this.baseThemeId,
                    colors: { ...(this.custom || {}) },
                };
            },

            /**
             * 「粘贴全部」：直接读剪贴板 → 解析 → 套用，一步到位。
             *
             * 读不到剪贴板（非安全上下文 / 用户拒权）就把提示说清楚，
             * 让他退回「贴到输入框再点解析」那条路 —— 别只丢一句「失败了」。
             */
            async onPasteAllColors() {
                let text = '';
                try {
                    text = await navigator.clipboard.readText();
                } catch (_) {
                    this.$emit(notifyEvent, '浏览器不让直接读剪贴板，粘到下面的框里再点「解析并套用」');
                    return;
                }
                if (!String(text || '').trim()) {
                    this.$emit(notifyEvent, '剪贴板是空的');
                    return;
                }
                const { colors, valid, ignored } = parseColorBatch(text);
                if (!valid) {
                    // 解析不出来时把原文留在输入框，用户能看见自己复制的到底是什么
                    if ('batchText' in this) this.batchText = text;
                    this.$emit(notifyEvent, ignored
                        ? `识别到 ${ignored} 个变量，但都不是本 App 的色表`
                        : '剪贴板里没有配色变量，已贴到下面供你检查');
                    return;
                }
                this.custom = { ...this.custom, ...colors };
                this.$emit(notifyEvent, `已从剪贴板套用 ${valid} 项${ignored ? `（忽略 ${ignored} 个）` : ''}`);
            },

            /** 改名：不动配色，只改这套叫什么 */
            onRenameSavedTheme(theme, promptFn) {
                const ask = promptFn || ((cur) => (typeof window !== 'undefined' ? window.prompt('新名字', cur) : null));
                const next = ask(theme.name);
                if (next == null) return;
                const name = String(next).trim();
                if (!name) return;
                store.updateCustomTheme?.(theme.id, { name });
                this.$emit(notifyEvent, '已改名');
            },

            /** 用当前正在调的这套颜色覆盖已保存的那条 */
            onOverwriteSavedTheme(theme) {
                store.updateCustomTheme?.(theme.id, {
                    colors: { ...(this.custom || {}) },
                    baseThemeId: this.baseThemeId,
                });
                this.markThemeApplied();
                this.$emit(notifyEvent, `已更新「${theme.name}」`);
            },
        },
    };
}

export default { createThemePanelMixin };
