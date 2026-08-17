/**
 * 四叶草 · 主题数据
 *
 * ── 和 `_theme.css` 的分工 ────────────────────────────────────────
 *   `_theme.css`   两套内置主题的实际色值。**颜色的唯一真相。**
 *   本文件         「有哪些 token / 叫什么 / 归在哪类」这些元信息，
 *                  以及自定义色的读写和批量解析。
 *
 * 所以下面的 `COLOR_CATEGORIES` 只有 key 没有 value —— value 运行时从 CSS 里读。
 * 在 JS 里再存一份就成了第二份真相，改了 CSS 而 JS 那份没改的表现是
 * 「预览里是新色、应用后是旧色」，这种 bug 极难联想到原因。
 */

/** 用户可编辑的颜色分类。分组顺序 = 色板里的展示顺序。 */
export const COLOR_CATEGORIES = Object.freeze([
    {
        name: '底色',
        colors: [
            { key: '--sp-bg', label: '页面底' },
            { key: '--sp-bg-soft', label: '浅底' },
            { key: '--sp-surface', label: '表面' },
            { key: '--sp-surface-2', label: '次表面' },
            { key: '--sp-elevated', label: '浮起层' },
        ],
    },
    {
        name: '主色',
        colors: [
            { key: '--sp-primary', label: '主色' },
            { key: '--sp-primary-soft', label: '主色淡底' },
            { key: '--sp-primary-strong', label: '主色深' },
            { key: '--sp-on-primary', label: '主色上的字' },
        ],
    },
    {
        name: '强调色',
        colors: [
            { key: '--sp-accent', label: '强调色' },
            { key: '--sp-accent-soft', label: '强调淡底' },
            { key: '--sp-on-accent', label: '强调上的字' },
        ],
    },
    {
        name: '钱',
        colors: [
            { key: '--sp-price', label: '售价' },
            { key: '--sp-coin', label: '余额' },
            { key: '--sp-income', label: '进账' },
            { key: '--sp-expense', label: '出账' },
        ],
    },
    {
        name: '文字',
        colors: [
            { key: '--sp-text', label: '正文' },
            { key: '--sp-text-2', label: '次要' },
            { key: '--sp-text-3', label: '弱化' },
            { key: '--sp-text-inverse', label: '反色' },
        ],
    },
    {
        name: '线与卡片',
        colors: [
            { key: '--sp-line', label: '分隔线' },
            { key: '--sp-line-soft', label: '浅线' },
            { key: '--sp-line-strong', label: '重线' },
            { key: '--sp-card', label: '卡片底' },
            { key: '--sp-card-hover', label: '卡片按下' },
            { key: '--sp-shadow', label: '阴影' },
        ],
    },
    {
        name: '状态',
        colors: [
            { key: '--sp-success', label: '成功' },
            { key: '--sp-warning', label: '提醒' },
            { key: '--sp-danger', label: '危险' },
            { key: '--sp-info', label: '信息' },
        ],
    },
    {
        name: '输入框',
        colors: [
            { key: '--sp-input-bg', label: '输入底' },
            { key: '--sp-input-line', label: '输入边框' },
            { key: '--sp-input-focus', label: '聚焦光晕' },
        ],
    },
    {
        name: '标签',
        colors: [
            { key: '--sp-tag-bg', label: '标签底' },
            { key: '--sp-tag-text', label: '标签字' },
            { key: '--sp-tag-line', label: '标签边' },
        ],
    },
    {
        name: '底栏',
        colors: [
            { key: '--sp-nav-bg', label: '底栏底' },
            { key: '--sp-nav-line', label: '底栏线' },
            { key: '--sp-nav-icon', label: '未选中' },
            { key: '--sp-nav-active', label: '选中' },
        ],
    },
    {
        name: '遮罩与骨架',
        colors: [
            { key: '--sp-overlay', label: '弹窗遮罩' },
            { key: '--sp-scrim', label: '幕布' },
            { key: '--sp-skeleton', label: '骨架底' },
            { key: '--sp-skeleton-shine', label: '骨架流光' },
        ],
    },
]);

/** 所有可编辑 token 的扁平列表 */
export const ALL_TOKENS = Object.freeze(
    COLOR_CATEGORIES.flatMap((c) => c.colors.map((x) => x.key)),
);

const TOKEN_SET = new Set(ALL_TOKENS);

export const PRESET_THEMES = Object.freeze([
    { id: 'dawn', name: '晨露', mode: 'light', desc: '掺一点绿的米白，日常用' },
    { id: 'dusk', name: '夜樱', mode: 'dark', desc: '墨绿底，夜里不刺眼' },
]);

// ============================================================
// 从 CSS 读预设色值
// ============================================================

const _presetCache = new Map();

/**
 * 把某套预设主题的实际色值从 CSS 里读出来。
 *
 * 做法：临时造一个带 `data-sp-theme` 的隐藏节点挂进 app-shell，
 * 让浏览器按 `_theme.css` 算出所有变量，再逐个读走。
 */
export function readPresetColors(themeId) {
    const id = PRESET_THEMES.some((p) => p.id === themeId) ? themeId : 'dawn';
    if (_presetCache.has(id)) return _presetCache.get(id);

    const shell = typeof document !== 'undefined'
        ? document.querySelector('.app-shell[data-app-id="shop"]')
        : null;
    if (!shell) return {};   // App 还没挂载，下次再读

    const probe = document.createElement('div');
    probe.setAttribute('data-sp-theme', id);
    probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;';
    shell.appendChild(probe);

    const computed = getComputedStyle(probe);
    const out = {};
    for (const key of ALL_TOKENS) {
        const value = computed.getPropertyValue(key).trim();
        if (value) out[key] = value;
    }
    probe.remove();

    // 只有真读到东西才缓存，别把「还没挂载」的空结果缓存住
    if (Object.keys(out).length > 0) _presetCache.set(id, out);
    return out;
}

/** 预设 + 用户改动 = 最终色表 */
export function resolveThemeColors(themeId, customColors = {}) {
    return { ...readPresetColors(themeId), ...(customColors || {}) };
}

/**
 * 把一套自定义色写到元素上。
 *
 * 传空对象表示「回到内置主题」—— 必须把之前写上去的变量逐个 remove，
 * 只是不写新值的话旧的 inline 变量还在，会一直盖着 CSS。
 */
export function applyThemeVars(element, customColors = {}) {
    if (!element) return;
    for (const key of ALL_TOKENS) {
        const value = customColors[key];
        if (value) element.style.setProperty(key, value);
        else element.style.removeProperty(key);
    }
}

// ============================================================
// 批量配色
// ============================================================

/**
 * 解析一整段粘贴进来的配色。
 *
 * 支持 `--sp-bg: #121212;` 这种写法，分号和换行都能当分隔符。
 * **不在白名单里的变量名直接跳过，而不是整段失败** —— 用户常常是从别处
 * 整段拷过来的，里面混着别的 App 的变量很正常（同 §13.5.5 的处理）。
 *
 * @returns {{ colors: object, accepted: string[], ignored: string[] }}
 */
export function parseColorBatch(raw) {
    const colors = {};
    const accepted = [];
    const ignored = [];
    const text = String(raw || '');

    for (const chunk of text.split(/[;\n\r]+/)) {
        const line = chunk.trim();
        if (!line) continue;
        const m = line.match(/^(--[\w-]+)\s*:\s*(.+)$/);
        if (!m) continue;
        const key = m[1].trim();
        const value = m[2].trim().replace(/[;,]+$/, '');
        if (!value) continue;
        if (TOKEN_SET.has(key)) {
            colors[key] = value;
            accepted.push(key);
        } else {
            ignored.push(key);
        }
    }
    return { colors, accepted, ignored };
}

/** 导出当前配色（带值），给用户拷走 */
export function formatColorBatch(colorMap = {}) {
    return ALL_TOKENS
        .filter((key) => colorMap[key])
        .map((key) => `${key}: ${colorMap[key]};`)
        .join('\n');
}

/** 只导出变量名（空模板），给用户照着填 */
export function formatTokenTemplate() {
    return ALL_TOKENS.map((key) => `${key}: ;`).join('\n');
}
