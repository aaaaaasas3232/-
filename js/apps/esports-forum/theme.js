/**
 * 声浪 · 主题元数据
 *
 * 色值的唯一真相在 css/apps/esports-forum/index.css 的 token 段。
 * 本文件只声明「有哪些 token / 叫什么 / 归在哪类」，以及读取与应用逻辑
 * （与追光 theme.js 同款探针法）。
 */

export const COLOR_CATEGORIES = Object.freeze([
    {
        name: '底色',
        colors: [
            { key: '--ef-bg', label: '页面底' },
            { key: '--ef-surface', label: '卡片底' },
            { key: '--ef-surface-2', label: '次表面' },
            { key: '--ef-elevated', label: '浮起层' },
        ],
    },
    {
        name: '文字',
        colors: [
            { key: '--ef-text', label: '正文' },
            { key: '--ef-text-2', label: '次要' },
            { key: '--ef-text-3', label: '弱化' },
            { key: '--ef-on-accent', label: '主色上的字' },
        ],
    },
    {
        name: '主色与电光',
        colors: [
            { key: '--ef-accent', label: '电光绿' },
            { key: '--ef-accent-soft', label: '电光淡底' },
            { key: '--ef-ink', label: '主按钮底' },
            { key: '--ef-ink-press', label: '主按钮按下' },
            { key: '--ef-on-ink', label: '主按钮字' },
        ],
    },
    {
        name: '线与分隔',
        colors: [
            { key: '--ef-line', label: '分隔线' },
            { key: '--ef-line-soft', label: '浅线' },
        ],
    },
    {
        name: '状态',
        colors: [
            { key: '--ef-danger', label: '舆情红' },
            { key: '--ef-danger-soft', label: '舆情淡底' },
            { key: '--ef-success', label: '胜场绿' },
            { key: '--ef-success-soft', label: '胜场淡底' },
            { key: '--ef-warn', label: '行业琥珀' },
            { key: '--ef-warn-soft', label: '行业淡底' },
            { key: '--ef-violet', label: '匿名紫' },
            { key: '--ef-violet-soft', label: '匿名淡底' },
        ],
    },
    {
        name: '数值条',
        colors: [
            { key: '--ef-bar-bg', label: '进度条底' },
            { key: '--ef-bar-fill', label: '进度条填充' },
            { key: '--ef-bar-fame', label: '人气条' },
            { key: '--ef-energy', label: '精力条' },
        ],
    },
    {
        name: '输入与底栏',
        colors: [
            { key: '--ef-input-bg', label: '输入底' },
            { key: '--ef-input-line', label: '输入边框' },
            { key: '--ef-nav-bg', label: '底栏底' },
            { key: '--ef-nav-active', label: '底栏选中' },
            { key: '--ef-overlay', label: '弹窗遮罩' },
        ],
    },
]);

export const ALL_TOKENS = Object.freeze(
    COLOR_CATEGORIES.flatMap((c) => c.colors.map((x) => x.key)),
);

const TOKEN_SET = new Set(ALL_TOKENS);

export const PRESET_THEMES = Object.freeze([
    { id: 'stand', name: '观众席', mode: 'light', desc: '冷白底 + 电光绿，默认' },
    { id: 'homecourt', name: '主场夜', mode: 'dark', desc: '深色灯牌夜' },
]);

export const PRESET_IDS = Object.freeze(PRESET_THEMES.map((p) => p.id));

const _presetCache = new Map();

export function readPresetColors(themeId) {
    const id = PRESET_IDS.includes(themeId) ? themeId : PRESET_IDS[0];
    if (_presetCache.has(id)) return _presetCache.get(id);

    if (typeof document === 'undefined') return {};
    const shell = document.querySelector('.app-shell[data-app-id="esports-forum"]');
    if (!shell) return {};

    const probe = document.createElement('div');
    probe.setAttribute('data-ef-theme', id);
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
