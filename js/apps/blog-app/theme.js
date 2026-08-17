/**
 * 氧气 · 主题元数据
 *
 * ── 和 `css/apps/blog/index.css` token 段的分工 ──────────────────
 *   CSS token 段   两套内置主题的实际色值。**颜色的唯一真相。**
 *   本文件         「有哪些 token / 叫什么 / 归在哪类」，以及
 *                  自定义色的读取、应用与批量解析。
 *
 * 全 App 禁渐变，token 全是纯色。黑匣子页是固定黑底，不吃主题。
 */

/** 用户可编辑的颜色分类。分组顺序 = 配色页的展示顺序。 */
export const COLOR_CATEGORIES = Object.freeze([
    {
        name: '底色',
        colors: [
            { key: '--ox-bg', label: '页面底' },
            { key: '--ox-surface', label: '卡片底' },
            { key: '--ox-surface-2', label: '次表面' },
            { key: '--ox-elevated', label: '浮起层' },
        ],
    },
    {
        name: '文字',
        colors: [
            { key: '--ox-text', label: '正文' },
            { key: '--ox-text-2', label: '次要' },
            { key: '--ox-text-3', label: '弱化' },
            { key: '--ox-text-inverse', label: '反色' },
        ],
    },
    {
        name: '主按钮',
        colors: [
            { key: '--ox-ink', label: '主按钮底' },
            { key: '--ox-ink-press', label: '主按钮按下' },
            { key: '--ox-on-ink', label: '主按钮字' },
        ],
    },
    {
        name: '线与分隔',
        colors: [
            { key: '--ox-line', label: '分隔线' },
            { key: '--ox-line-soft', label: '浅线' },
            { key: '--ox-line-strong', label: '重线' },
        ],
    },
    {
        name: '标签',
        colors: [
            { key: '--ox-tag-bg', label: '标签底' },
            { key: '--ox-tag-text', label: '标签字' },
            { key: '--ox-tag-line', label: '标签边' },
            { key: '--ox-tag-on-bg', label: '选中标签底' },
            { key: '--ox-tag-on-text', label: '选中标签字' },
        ],
    },
    {
        name: '头像色板',
        colors: [
            { key: '--ox-ava-0', label: '头像一' },
            { key: '--ox-ava-1', label: '头像二' },
            { key: '--ox-ava-2', label: '头像三' },
            { key: '--ox-ava-3', label: '头像四' },
            { key: '--ox-ava-4', label: '头像五' },
            { key: '--ox-ava-5', label: '头像六' },
            { key: '--ox-ava-6', label: '头像七' },
            { key: '--ox-ava-7', label: '头像八' },
            { key: '--ox-ava-text', label: '头像字' },
        ],
    },
    {
        name: '状态',
        colors: [
            { key: '--ox-danger', label: '危险' },
            { key: '--ox-success', label: '成功' },
            { key: '--ox-warn', label: '提醒' },
        ],
    },
    {
        name: '输入框',
        colors: [
            { key: '--ox-input-bg', label: '输入底' },
            { key: '--ox-input-line', label: '输入边框' },
            { key: '--ox-input-focus', label: '聚焦描边' },
        ],
    },
    {
        name: '房间',
        colors: [
            { key: '--ox-room-bg', label: '房间底' },
            { key: '--ox-room-wall', label: '房间墙' },
            { key: '--ox-room-note', label: '纸条底' },
            { key: '--ox-room-note-text', label: '纸条字' },
            { key: '--ox-room-tagnote', label: '标签贴纸底' },
        ],
    },
    {
        name: '底栏与遮罩',
        colors: [
            { key: '--ox-nav-bg', label: '底栏底' },
            { key: '--ox-nav-line', label: '底栏线' },
            { key: '--ox-nav-icon', label: '未选中' },
            { key: '--ox-nav-active', label: '选中' },
            { key: '--ox-overlay', label: '弹窗遮罩' },
            { key: '--ox-skeleton', label: '骨架底' },
        ],
    },
]);

/** 所有可编辑 token 的扁平列表 */
export const ALL_TOKENS = Object.freeze(
    COLOR_CATEGORIES.flatMap((c) => c.colors.map((x) => x.key)),
);

const TOKEN_SET = new Set(ALL_TOKENS);

export const PRESET_THEMES = Object.freeze([
    { id: 'air', name: '空气', mode: 'light', desc: '白底黑字，默认' },
    { id: 'carbon', name: '碳', mode: 'dark', desc: '深夜也要呼吸' },
]);

export const PRESET_IDS = Object.freeze(PRESET_THEMES.map((p) => p.id));

// ============================================================
// 从 CSS 读预设色值（探针法，和萤火同款）
// ============================================================

const _presetCache = new Map();

export function readPresetColors(themeId) {
    const id = PRESET_IDS.includes(themeId) ? themeId : PRESET_IDS[0];
    if (_presetCache.has(id)) return _presetCache.get(id);

    if (typeof document === 'undefined') return {};
    const shell = document.querySelector('.app-shell[data-app-id="blog"]');
    if (!shell) return {};

    const probe = document.createElement('div');
    probe.setAttribute('data-ox-theme', id);
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

/** 预设 + 用户改动 = 最终色表 */
export function resolveThemeColors(themeId, customColors = {}) {
    return { ...readPresetColors(themeId), ...(customColors || {}) };
}

/**
 * 把一套自定义色写到元素上。
 * 传空对象 = 回到内置主题（必须逐个 removeProperty）。
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
 * 解析整段粘贴进来的配色。分号 / 换行都能当分隔符，注释被忽略。
 * 不在白名单里的变量名跳过而不是整段失败。
 */
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

/** 导出当前配色（带值），给用户拷走 */
export function exportColorBatch(colorMap = {}) {
    return COLOR_CATEGORIES
        .map((cat) => {
            const lines = cat.colors.map((c) => `${c.key}: ${colorMap[c.key] || ''};`);
            return `/* ${cat.name} */\n${lines.join('\n')}`;
        })
        .join('\n\n');
}

/** 只导出变量名（空模板），给用户照着填 */
export function exportTokenNames() {
    return COLOR_CATEGORIES
        .map((cat) => `/* ${cat.name} */\n${cat.colors.map((c) => `${c.key}: ;`).join('\n')}`)
        .join('\n\n');
}
