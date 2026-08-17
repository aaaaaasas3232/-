/**
 * 梦境编织 · 主题数据
 *
 * ── 这个文件和 `_theme.css` 的分工 ────────────────────────────────
 *
 *   `_theme.css`   两套内置主题的实际颜色值。**颜色的唯一真相。**
 *   本文件         「有哪些 token / 分别叫什么 / 归在哪一类」这些**元信息**,
 *                  以及自定义主题的合并逻辑。
 *
 * 所以这里的 `PRESET_TOKENS` 只有 key,没有 value —— value 在运行时从 CSS 里读
 * (`readPresetColors`)。这样就不会出现「CSS 改了颜色、JS 里那份没跟着改」的双份真相。
 *
 * 原版正是栽在这上面:`DW_PRESET_THEMES` 在 JS 里写死了两套完整色表,
 * 同时代码里还散着 694 处硬编码 hex,三份东西谁也不认识谁。
 */

/** 用户可编辑的颜色分类 —— 照抄原版 `colorCategories`(28733),16 类 61 项 */
export const COLOR_CATEGORIES = Object.freeze([
    {
        name: '背景色系',
        colors: [
            { key: '--dw-bg', label: '主背景' },
            { key: '--dw-bg-alt', label: '次背景' },
            { key: '--dw-surface', label: '表面' },
            { key: '--dw-surface-alt', label: '次表面' },
            { key: '--dw-surface-container', label: '容器' },
        ],
    },
    {
        name: '主色系',
        colors: [
            { key: '--dw-primary', label: '主色' },
            { key: '--dw-primary-light', label: '主色亮' },
            { key: '--dw-primary-dark', label: '主色深' },
            { key: '--dw-primary-container', label: '主色容器' },
            { key: '--dw-primary-hover', label: '主色悬浮' },
            { key: '--dw-primary-active', label: '主色按下' },
            { key: '--dw-on-primary', label: '主色上的字' },
        ],
    },
    {
        name: '次色系',
        colors: [
            { key: '--dw-secondary', label: '次色' },
            { key: '--dw-secondary-container', label: '次色容器' },
            { key: '--dw-on-secondary', label: '次色上的字' },
        ],
    },
    {
        name: '强调与功能色',
        colors: [
            { key: '--dw-accent', label: '强调色' },
            { key: '--dw-accent-light', label: '强调色亮' },
            { key: '--dw-warning', label: '警告' },
            { key: '--dw-error', label: '错误' },
            { key: '--dw-success', label: '成功' },
            { key: '--dw-info', label: '信息' },
        ],
    },
    {
        name: '文字色系',
        colors: [
            { key: '--dw-text', label: '正文' },
            { key: '--dw-text-secondary', label: '次要文字' },
            { key: '--dw-text-tertiary', label: '弱文字' },
            { key: '--dw-text-inverse', label: '反色文字' },
        ],
    },
    {
        name: '边框与分割',
        colors: [
            { key: '--dw-border', label: '边框' },
            { key: '--dw-border-light', label: '浅边框' },
            { key: '--dw-border-strong', label: '重边框' },
            { key: '--dw-divider', label: '分割线' },
        ],
    },
    {
        name: '卡片与容器',
        colors: [
            { key: '--dw-card-bg', label: '卡片背景' },
            { key: '--dw-card-hover', label: '卡片悬浮' },
        ],
    },
    {
        name: '气泡颜色',
        colors: [
            { key: '--dw-bubble-sent', label: '我发出的' },
            { key: '--dw-bubble-received', label: '收到的' },
        ],
    },
    {
        name: '导航栏',
        colors: [
            { key: '--dw-nav-glow', label: '导航辉光' },
            { key: '--dw-nav-bg', label: '导航背景' },
            { key: '--dw-nav-border', label: '导航边框' },
            { key: '--dw-nav-active-bg', label: '选中背景' },
            { key: '--dw-nav-active-shadow', label: '选中阴影' },
            { key: '--dw-home-indicator', label: '底部横条' },
        ],
    },
    {
        name: '轮廓与遮罩',
        colors: [
            { key: '--dw-outline', label: '轮廓' },
            { key: '--dw-outline-variant', label: '轮廓变体' },
            { key: '--dw-outline-light', label: '浅轮廓' },
            { key: '--dw-overlay', label: '遮罩' },
            { key: '--dw-scrim', label: '幕布' },
        ],
    },
    {
        name: '阴影',
        colors: [{ key: '--dw-shadow-color', label: '阴影色' }],
    },
    {
        name: '毛玻璃',
        colors: [
            { key: '--dw-glass-bg', label: '玻璃背景' },
            { key: '--dw-glass-border', label: '玻璃边框' },
            { key: '--dw-glass-highlight', label: '玻璃高光' },
        ],
    },
    {
        name: '交互状态',
        colors: [
            { key: '--dw-hover-overlay', label: '悬浮层' },
            { key: '--dw-active-overlay', label: '按下层' },
            { key: '--dw-disabled-bg', label: '禁用背景' },
            { key: '--dw-disabled-text', label: '禁用文字' },
        ],
    },
    {
        name: '输入框',
        colors: [
            { key: '--dw-input-bg', label: '输入背景' },
            { key: '--dw-input-border', label: '输入边框' },
            { key: '--dw-input-focus', label: '聚焦光晕' },
        ],
    },
    {
        name: '标签徽章',
        colors: [
            { key: '--dw-tag-bg', label: '标签背景' },
            { key: '--dw-tag-border', label: '标签边框' },
            { key: '--dw-tag-text', label: '标签文字' },
        ],
    },
    {
        name: '正文高亮',
        colors: [
            { key: '--dw-highlight-char-bg', label: '角色底色' },
            { key: '--dw-highlight-loc-bg', label: '地点底色' },
            { key: '--dw-highlight-char-text', label: '角色文字' },
            { key: '--dw-highlight-loc-text', label: '地点文字' },
        ],
    },
]);

/** 所有可编辑 token 的扁平列表 */
export const ALL_TOKENS = Object.freeze(
    COLOR_CATEGORIES.flatMap((c) => c.colors.map((x) => x.key)),
);

export const PRESET_THEMES = Object.freeze([
    { id: 'retro-dark', name: '美式复古深色', mode: 'dark' },
    { id: 'oriental-light', name: '国风绿黄浅色', mode: 'light' },
]);

// ============================================================
// 从 CSS 读预设色值
// ============================================================

const _presetCache = new Map();

/**
 * 把某套预设主题的实际色值从 CSS 里读出来。
 *
 * 做法:临时造一个带 `data-dw-theme` 的隐藏节点挂进 app-shell,
 * 让浏览器按 `_theme.css` 算出所有变量,再 `getComputedStyle` 逐个读走。
 *
 * 为什么不在 JS 里存一份:那就成了第二份真相。CSS 改了颜色而 JS 那份没改,
 * 结果就是「预览里是新色、应用后是旧色」—— 而这种 bug 极难联想到原因。
 */
export function readPresetColors(themeId) {
    const id = PRESET_THEMES.some((p) => p.id === themeId) ? themeId : 'retro-dark';
    if (_presetCache.has(id)) return _presetCache.get(id);

    const shell = document.querySelector('.app-shell[data-app-id="dream-weaver"]');
    if (!shell) return {};   // App 还没挂载,读不到就先返回空,下次再读

    const probe = document.createElement('div');
    probe.setAttribute('data-dw-theme', id);
    probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;';
    shell.appendChild(probe);

    const computed = getComputedStyle(probe);
    const out = {};
    for (const key of ALL_TOKENS) {
        const value = computed.getPropertyValue(key).trim();
        if (value) out[key] = value;
    }
    probe.remove();

    // 只有真读到东西才缓存,避免把「还没挂载」的空结果缓存住
    if (Object.keys(out).length > 0) _presetCache.set(id, out);
    return out;
}

/** 预设 + 用户改动 = 最终色表 */
export function resolveThemeColors(themeId, customColors = {}) {
    return { ...readPresetColors(themeId), ...(customColors || {}) };
}

/**
 * 把一套色值写到元素上(自定义主题就是这么生效的)。
 * 传空对象表示「回到内置主题」—— 需要把之前写上去的变量逐个删掉,
 * 只是不写新值的话,旧的 inline 变量还在,会一直盖着 CSS。
 */
export function applyThemeVars(element, customColors = {}) {
    if (!element) return;
    for (const key of ALL_TOKENS) {
        const value = customColors[key];
        if (value) element.style.setProperty(key, value);
        else element.style.removeProperty(key);
    }
}
