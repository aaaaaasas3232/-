/**
 * 框架层 · 「软编码配色」工具箱
 *
 * ── 解决什么 ──────────────────────────────────────────────────────
 *
 * 项目里已经有 App 做过同一件事:把界面配色全部收成 `--xx-*` token,
 * 让用户逐项调、批量粘贴、存成自己的配色(湛蓝回忆 / 灯塔求职 / 四叶草)。
 * 每家都各写了一份 `readPresetColors` / `parseColorBatch` / `applyThemeVars`,
 * 代码一模一样,只有 token 清单不同。
 *
 * 判据(`docs/framework-总览.md` §7):**改一次要改几个地方**。
 * 这里把逻辑收成一个工厂,各 App 只声明自己的 token 清单和预设主题。
 *
 * ── 用法 ──────────────────────────────────────────────────────────
 *
 *   // js/apps/your-app/theme.js
 *   import { createThemeTokens } from '@/src/core/theme-tokens.js';
 *
 *   export const COLOR_CATEGORIES = [
 *       { name: '底与面', colors: [{ key: '--xx-bg', label: '页面底色' }] },
 *   ];
 *   export const PRESET_THEMES = [{ id: 'day', name: '白天', desc: '默认' }];
 *
 *   export const themeTokens = createThemeTokens({
 *       appId: 'your-app',
 *       attr: 'data-xx-theme',
 *       categories: COLOR_CATEGORIES,
 *       presets: PRESET_THEMES,
 *   });
 *
 * ── 一条必须知道的事 ──────────────────────────────────────────────
 *
 * `readPresetColors()` 靠往 app-shell 里塞一个隐藏探针 div、给它挂主题属性、
 * 再 `getComputedStyle` 读值。所以 `_theme.css` 里**每套主题要写两个选择器**:
 *
 *   .app-shell[data-app-id="xx"][data-xx-theme="day"]   ← shell 自己
 *   .app-shell[data-app-id="xx"] [data-xx-theme="day"]  ← shell 内任意后代(探针)
 *
 * 只写前一个的话探针永远匹配不上,所有主题预览卡会**全部显示成当前主题**,
 * 而且不报任何错 —— 看起来只是「预览坏了」。
 */

/** 建一套配色工具 */
export function createThemeTokens({ appId, attr, categories = [], presets = [] } = {}) {
    const APP_ID = String(appId || '');
    const ATTR = String(attr || 'data-app-theme');
    const CATEGORIES = Object.freeze(categories.map((c) => Object.freeze({
        name: String(c.name || ''),
        colors: Object.freeze((c.colors || []).map((x) => Object.freeze({
            key: String(x.key || ''),
            label: String(x.label || x.key || ''),
        }))),
    })));
    const PRESETS = Object.freeze(presets.map((p) => Object.freeze({ ...p, id: String(p.id) })));
    const PRESET_IDS = Object.freeze(PRESETS.map((p) => p.id));
    const ALL_TOKENS = Object.freeze(CATEGORIES.flatMap((c) => c.colors.map((x) => x.key)));
    const TOKEN_SET = new Set(ALL_TOKENS);

    const cache = new Map();

    function shellEl() {
        if (typeof document === 'undefined') return null;
        return document.querySelector(`.app-shell[data-app-id="${APP_ID}"]`);
    }

    /**
     * 把某套预设主题的实际色值从 CSS 里读出来。
     *
     * ★ 为什么不在 JS 里存一份:那就是第二份真相。CSS 改了而 JS 没改,
     *   结果是「预览里是新色、应用后是旧色」—— 极难联想到原因。
     */
    function readPresetColors(themeId) {
        const id = PRESET_IDS.includes(themeId) ? themeId : PRESET_IDS[0];
        if (cache.has(id)) return cache.get(id);

        const shell = shellEl();
        if (!shell) return {};   // App 还没挂载,读不到就先返回空,下次再读

        const probe = document.createElement('div');
        probe.setAttribute(ATTR, id);
        probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;';
        shell.appendChild(probe);

        const computed = getComputedStyle(probe);
        const out = {};
        for (const key of ALL_TOKENS) {
            const value = computed.getPropertyValue(key).trim();
            if (value) out[key] = value;
        }
        probe.remove();

        // 只有真读到东西才缓存,免得把「还没挂载」的空结果缓存住
        if (Object.keys(out).length > 0) cache.set(id, out);
        return out;
    }

    /** 预设 + 用户改动 = 最终色表 */
    function resolveThemeColors(themeId, customColors = {}) {
        return { ...readPresetColors(themeId), ...(customColors || {}) };
    }

    /**
     * 把一套色值写到元素上(自定义配色就是这么生效的)。
     *
     * 传空对象表示「回到内置主题」—— 必须把之前写上去的变量逐个 remove。
     * 只是不写新值的话,旧的 inline 变量还在,会一直盖着 CSS。
     */
    function applyThemeVars(element, customColors = {}) {
        if (!element) return;
        for (const key of ALL_TOKENS) {
            const value = customColors[key];
            if (value) element.style.setProperty(key, value);
            else element.style.removeProperty(key);
        }
    }

    /**
     * 解析一整段配色文本。
     *
     * 格式:`--xx-primary: #F2A9BE;` —— 分号和换行都能当分隔符,
     * 冒号两边空格随意,`/* 注释 *\/` 会被忽略。
     *
     * ★ 不在白名单里的变量名**跳过而不是整段失败** —— 用户常常从别处整段拷来,
     *   里面混着别的 App 的变量很正常,为此让整次粘贴失败是最讨厌的体验。
     */
    function parseColorBatch(raw) {
        const text = String(raw || '').replace(/\/\*[\s\S]*?\*\//g, ' ');
        const colors = {};
        let valid = 0;
        let ignored = 0;
        for (const entry of text.split(/[;\n]+/)) {
            const line = entry.trim();
            if (!line) continue;
            const match = line.match(/^(--[a-z0-9-]+)\s*:\s*(.+?)\s*;?$/i);
            if (!match) continue;
            const key = match[1].toLowerCase();
            const value = match[2].trim();
            if (!value) continue;
            if (!TOKEN_SET.has(key)) { ignored += 1; continue; }
            colors[key] = value;
            valid += 1;
        }
        return { colors, valid, ignored };
    }

    /** 导出当前配色(带值),可以直接粘回来 */
    function exportColorBatch(colors = {}) {
        return CATEGORIES
            .map((cat) => {
                const lines = cat.colors.map((c) => `${c.key}: ${colors[c.key] || ''};`);
                return `/* ${cat.name} */\n${lines.join('\n')}`;
            })
            .join('\n\n');
    }

    /** 只导出变量名(空模板),方便照着填 */
    function exportTokenNames() {
        return CATEGORIES
            .map((cat) => `/* ${cat.name} */\n${cat.colors.map((c) => `${c.key}: ;`).join('\n')}`)
            .join('\n\n');
    }

    /** 用户改过多少项(只数认识的 token) */
    function countChanged(customColors = {}) {
        return Object.keys(customColors || {}).filter((k) => TOKEN_SET.has(k)).length;
    }

    return {
        appId: APP_ID,
        attr: ATTR,
        CATEGORIES,
        PRESETS,
        PRESET_IDS,
        ALL_TOKENS,
        readPresetColors,
        resolveThemeColors,
        applyThemeVars,
        parseColorBatch,
        exportColorBatch,
        exportTokenNames,
        countChanged,
    };
}

export default { createThemeTokens };
