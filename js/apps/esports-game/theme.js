/**
 * 赛点 · 主题元数据
 *
 * 色值的唯一真相在 css/apps/esports-game/index.css 的 token 段。
 * 游戏客户端默认深色（赛训之夜），另备浅色（晨训）。
 */

export const COLOR_CATEGORIES = Object.freeze([
    {
        name: '底色',
        colors: [
            { key: '--eg-bg', label: '页面底' },
            { key: '--eg-surface', label: '卡片底' },
            { key: '--eg-surface-2', label: '次表面' },
            { key: '--eg-elevated', label: '浮起层' },
        ],
    },
    {
        name: '文字',
        colors: [
            { key: '--eg-text', label: '正文' },
            { key: '--eg-text-2', label: '次要' },
            { key: '--eg-text-3', label: '弱化' },
            { key: '--eg-on-accent', label: '主色上的字' },
        ],
    },
    {
        name: '主色',
        colors: [
            { key: '--eg-accent', label: '电竞蓝' },
            { key: '--eg-accent-soft', label: '电竞蓝淡底' },
            { key: '--eg-volt', label: '胜利绿' },
            { key: '--eg-ink', label: '主按钮底' },
            { key: '--eg-ink-press', label: '主按钮按下' },
            { key: '--eg-on-ink', label: '主按钮字' },
        ],
    },
    {
        name: '线与状态',
        colors: [
            { key: '--eg-line', label: '分隔线' },
            { key: '--eg-line-soft', label: '浅线' },
            { key: '--eg-danger', label: '败北红' },
            { key: '--eg-danger-soft', label: '败北淡底' },
            { key: '--eg-success', label: '胜场绿' },
            { key: '--eg-success-soft', label: '胜场淡底' },
            { key: '--eg-warn', label: '提醒琥珀' },
            { key: '--eg-warn-soft', label: '提醒淡底' },
            { key: '--eg-love', label: '亲密粉' },
            { key: '--eg-love-soft', label: '亲密淡底' },
        ],
    },
    {
        name: '数值与底栏',
        colors: [
            { key: '--eg-bar-bg', label: '进度条底' },
            { key: '--eg-bar-fill', label: '进度条填充' },
            { key: '--eg-energy', label: '精力条' },
            { key: '--eg-input-bg', label: '输入底' },
            { key: '--eg-input-line', label: '输入边框' },
            { key: '--eg-nav-bg', label: '底栏底' },
            { key: '--eg-nav-active', label: '底栏选中' },
            { key: '--eg-overlay', label: '弹窗遮罩' },
        ],
    },
]);

export const ALL_TOKENS = Object.freeze(
    COLOR_CATEGORIES.flatMap((c) => c.colors.map((x) => x.key)),
);

const TOKEN_SET = new Set(ALL_TOKENS);

export const PRESET_THEMES = Object.freeze([
    { id: 'nighttrain', name: '赛训之夜', mode: 'dark', desc: '深蓝训练室，默认' },
    { id: 'morning', name: '晨训', mode: 'light', desc: '清晨的训练室' },
]);

export const PRESET_IDS = Object.freeze(PRESET_THEMES.map((p) => p.id));

const _presetCache = new Map();

export function readPresetColors(themeId) {
    const id = PRESET_IDS.includes(themeId) ? themeId : PRESET_IDS[0];
    if (_presetCache.has(id)) return _presetCache.get(id);

    if (typeof document === 'undefined') return {};
    const shell = document.querySelector('.app-shell[data-app-id="esports-game"]');
    if (!shell) return {};

    const probe = document.createElement('div');
    probe.setAttribute('data-eg-theme', id);
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
