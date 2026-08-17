/**
 * 追光 · 主题元数据
 *
 * 色值的唯一真相在 css/apps/actor/index.css 的 token 段。
 * 本文件只声明「有哪些 token / 叫什么 / 归在哪类」，以及读取与应用逻辑
 * （与氧气 theme.js 同款探针法）。
 */

export const COLOR_CATEGORIES = Object.freeze([
    {
        name: '底色',
        colors: [
            { key: '--ac-bg', label: '页面底' },
            { key: '--ac-surface', label: '卡片底' },
            { key: '--ac-surface-2', label: '次表面' },
            { key: '--ac-elevated', label: '浮起层' },
        ],
    },
    {
        name: '文字',
        colors: [
            { key: '--ac-text', label: '正文' },
            { key: '--ac-text-2', label: '次要' },
            { key: '--ac-text-3', label: '弱化' },
            { key: '--ac-on-accent', label: '主色上的字' },
        ],
    },
    {
        name: '主色与聚光',
        colors: [
            { key: '--ac-accent', label: '聚光金' },
            { key: '--ac-accent-soft', label: '聚光淡底' },
            { key: '--ac-ink', label: '主按钮底' },
            { key: '--ac-ink-press', label: '主按钮按下' },
            { key: '--ac-on-ink', label: '主按钮字' },
        ],
    },
    {
        name: '线与分隔',
        colors: [
            { key: '--ac-line', label: '分隔线' },
            { key: '--ac-line-soft', label: '浅线' },
        ],
    },
    {
        name: '状态',
        colors: [
            { key: '--ac-danger', label: '危机红' },
            { key: '--ac-danger-soft', label: '危机淡底' },
            { key: '--ac-success', label: '机遇绿' },
            { key: '--ac-success-soft', label: '机遇淡底' },
            { key: '--ac-warn', label: '行业琥珀' },
            { key: '--ac-warn-soft', label: '行业淡底' },
            { key: '--ac-violet', label: '隐藏紫' },
            { key: '--ac-violet-soft', label: '隐藏淡底' },
        ],
    },
    {
        name: '数值条',
        colors: [
            { key: '--ac-bar-bg', label: '进度条底' },
            { key: '--ac-bar-fill', label: '进度条填充' },
            { key: '--ac-bar-fame', label: '知名度条' },
            { key: '--ac-energy', label: '精力条' },
        ],
    },
    {
        name: '输入与底栏',
        colors: [
            { key: '--ac-input-bg', label: '输入底' },
            { key: '--ac-input-line', label: '输入边框' },
            { key: '--ac-nav-bg', label: '底栏底' },
            { key: '--ac-nav-active', label: '底栏选中' },
            { key: '--ac-overlay', label: '弹窗遮罩' },
        ],
    },
]);

export const ALL_TOKENS = Object.freeze(
    COLOR_CATEGORIES.flatMap((c) => c.colors.map((x) => x.key)),
);

const TOKEN_SET = new Set(ALL_TOKENS);

export const PRESET_THEMES = Object.freeze([
    { id: 'stage', name: '后台', mode: 'light', desc: '暖白底 + 聚光金，默认' },
    { id: 'premiere', name: '首映夜', mode: 'dark', desc: '深色红毯夜' },
]);

export const PRESET_IDS = Object.freeze(PRESET_THEMES.map((p) => p.id));

const _presetCache = new Map();

export function readPresetColors(themeId) {
    const id = PRESET_IDS.includes(themeId) ? themeId : PRESET_IDS[0];
    if (_presetCache.has(id)) return _presetCache.get(id);

    if (typeof document === 'undefined') return {};
    const shell = document.querySelector('.app-shell[data-app-id="actor-career"]');
    if (!shell) return {};

    const probe = document.createElement('div');
    probe.setAttribute('data-ac-theme', id);
    probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;';
    shell.appendChild(probe);

    const computed = getComputedStyle(probe);
    const out = {};
    for (const key of ALL_TOKENS) {
        const value = computed.getPropertyValue(key).trim();
        if (value) out[key] = value;
    }
    probe.remove();

    if (Object.keys(out).length > 0) _presetCache.set(id, out);
    return out;
}

export function resolveThemeColors(themeId, customColors = {}) {
    return { ...readPresetColors(themeId), ...(customColors || {}) };
}

export function applyThemeVars(element, customColors = {}) {
    if (!element) return;
    for (const key of ALL_TOKENS) {
        const value = customColors[key];
        if (value) element.style.setProperty(key, value);
        else element.style.removeProperty(key);
    }
}

export function parseColorBatch(raw) {
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

export function exportColorBatch(colorMap = {}) {
    return COLOR_CATEGORIES
        .map((cat) => {
            const lines = cat.colors.map((c) => `${c.key}: ${colorMap[c.key] || ''};`);
            return `/* ${cat.name} */\n${lines.join('\n')}`;
        })
        .join('\n\n');
}
