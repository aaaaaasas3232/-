/**
 * 点灯 · 主题元数据
 *
 * 分工和候鸟一致：
 *   css/apps/starlit/index.css 的 token 段  ← 颜色的**唯一真相**
 *   本文件                                  ← 有哪些 token、叫什么、怎么读/写/解析
 *
 * 这里一个色值都不写。预设色值运行时用探针 div 从 CSS 里读。
 */

export const COLOR_CATEGORIES = Object.freeze([
    {
        name: '底色',
        colors: [
            { key: '--sl-bg', label: '页面底' },
            { key: '--sl-bg-soft', label: '浅底' },
            { key: '--sl-surface', label: '表面' },
            { key: '--sl-surface-2', label: '次表面' },
            { key: '--sl-elevated', label: '浮起层' },
        ],
    },
    {
        name: '主色',
        colors: [
            { key: '--sl-primary', label: '主色' },
            { key: '--sl-primary-soft', label: '主色淡底' },
            { key: '--sl-primary-strong', label: '主色深' },
            { key: '--sl-on-primary', label: '主色上的字' },
        ],
    },
    {
        name: '强调色',
        colors: [
            { key: '--sl-accent', label: '强调色' },
            { key: '--sl-accent-soft', label: '强调淡底' },
            { key: '--sl-on-accent', label: '强调上的字' },
        ],
    },
    {
        name: '文字',
        colors: [
            { key: '--sl-text', label: '正文' },
            { key: '--sl-text-2', label: '次要' },
            { key: '--sl-text-3', label: '弱化' },
            { key: '--sl-text-inverse', label: '反色' },
        ],
    },
    {
        name: '线与卡片',
        colors: [
            { key: '--sl-line', label: '分隔线' },
            { key: '--sl-line-soft', label: '浅线' },
            { key: '--sl-line-strong', label: '重线' },
            { key: '--sl-card', label: '卡片底' },
            { key: '--sl-card-hover', label: '卡片按下' },
            { key: '--sl-shadow', label: '阴影' },
        ],
    },
    {
        name: '推理墙',
        colors: [
            { key: '--sl-wall-bg', label: '墙面' },
            { key: '--sl-wall-grid', label: '网格线' },
            { key: '--sl-wall-note', label: '便利贴底' },
            { key: '--sl-wall-note-2', label: '便利贴底 2' },
            { key: '--sl-wall-pin', label: '图钉' },
            { key: '--sl-wall-halo', label: '选中光圈' },
        ],
    },
    {
        name: '红线与关系',
        colors: [
            { key: '--sl-link-red', label: '因为（红线）' },
            { key: '--sl-link-amber', label: '演变为' },
            { key: '--sl-link-green', label: '同源' },
            { key: '--sl-link-blue', label: '对比' },
            { key: '--sl-link-violet', label: '组成' },
            { key: '--sl-link-grey', label: '相关' },
        ],
    },
    {
        name: '课堂气泡',
        colors: [
            { key: '--sl-bubble-teacher-bg', label: '老师气泡' },
            { key: '--sl-bubble-teacher-text', label: '老师气泡字' },
            { key: '--sl-bubble-me-bg', label: '我的气泡' },
            { key: '--sl-bubble-me-text', label: '我的气泡字' },
            { key: '--sl-bubble-sys-bg', label: '系统条底' },
            { key: '--sl-bubble-sys-text', label: '系统条字' },
        ],
    },
    {
        name: '描边翻译',
        colors: [
            { key: '--sl-gloss-fill', label: '译文字色' },
            { key: '--sl-gloss-stroke', label: '译文描边' },
        ],
    },
    {
        name: '代码',
        colors: [
            { key: '--sl-code-bg', label: '代码底' },
            { key: '--sl-code-gutter', label: '行号区' },
            { key: '--sl-code-text', label: '代码正文' },
            { key: '--sl-code-tag', label: '标签名' },
            { key: '--sl-code-attr', label: '属性名' },
            { key: '--sl-code-string', label: '字符串' },
            { key: '--sl-code-number', label: '数字' },
            { key: '--sl-code-keyword', label: '关键字' },
            { key: '--sl-code-comment', label: '注释' },
            { key: '--sl-code-prop', label: 'CSS 属性' },
            { key: '--sl-code-value', label: 'CSS 值' },
            { key: '--sl-code-punct', label: '符号' },
        ],
    },
    {
        name: '重点高亮',
        colors: [
            { key: '--sl-mark-1', label: '重点一' },
            { key: '--sl-mark-2', label: '重点二' },
            { key: '--sl-mark-3', label: '重点三' },
            { key: '--sl-mark-4', label: '重点四' },
            { key: '--sl-mark-text', label: '重点上的字' },
        ],
    },
    {
        name: '状态',
        colors: [
            { key: '--sl-success', label: '成功' },
            { key: '--sl-warning', label: '提醒' },
            { key: '--sl-danger', label: '危险' },
            { key: '--sl-info', label: '信息' },
        ],
    },
    {
        name: '输入框',
        colors: [
            { key: '--sl-input-bg', label: '输入底' },
            { key: '--sl-input-line', label: '输入边框' },
            { key: '--sl-input-focus', label: '聚焦光晕' },
        ],
    },
    {
        name: '标签',
        colors: [
            { key: '--sl-tag-bg', label: '标签底' },
            { key: '--sl-tag-text', label: '标签字' },
            { key: '--sl-tag-line', label: '标签边' },
        ],
    },
    {
        name: '底栏',
        colors: [
            { key: '--sl-nav-bg', label: '底栏底' },
            { key: '--sl-nav-line', label: '底栏线' },
            { key: '--sl-nav-icon', label: '未选中' },
            { key: '--sl-nav-active', label: '选中' },
            { key: '--sl-home-indicator', label: 'Home 指示条' },
        ],
    },
    {
        name: '遮罩与骨架',
        colors: [
            { key: '--sl-overlay', label: '弹窗遮罩' },
            { key: '--sl-skeleton', label: '骨架底' },
        ],
    },
]);

export const ALL_TOKENS = Object.freeze(
    COLOR_CATEGORIES.flatMap((c) => c.colors.map((x) => x.key)),
);

const TOKEN_SET = new Set(ALL_TOKENS);

export const PRESET_THEMES = Object.freeze([
    { id: 'lantern', name: '灯下', mode: 'light', desc: '暖纸底，像摊开在台灯下的笔记' },
    { id: 'nightwall', name: '夜墙', mode: 'dark', desc: '深墨底，红线最亮的那一套' },
    { id: 'chalk', name: '青板', mode: 'dark', desc: '墨绿黑板，粉笔白字' },
]);

export const PRESET_IDS = Object.freeze(PRESET_THEMES.map((p) => p.id));

const _presetCache = new Map();

/**
 * 读某套预设的真实色值。
 * CSS 里每套主题都必须同时写「shell 自身」和「shell 内后代」两个选择器，
 * 否则这个探针匹配不上，配色页的迷你预览会全变成当前主题色。
 */
export function readPresetColors(themeId) {
    const id = PRESET_IDS.includes(themeId) ? themeId : PRESET_IDS[0];
    if (_presetCache.has(id)) return _presetCache.get(id);

    if (typeof document === 'undefined') return {};
    const shell = document.querySelector('.app-shell[data-app-id="starlit"]');
    if (!shell) return {};

    const probe = document.createElement('div');
    probe.setAttribute('data-sl-theme', id);
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

/**
 * 把一套自定义色写到元素上。
 * 传空对象 = 回到内置主题，所以没值的必须 removeProperty ——
 * 只写不删的话旧 inline 变量会一直盖着 CSS。
 */
export function applyThemeVars(element, customColors = {}) {
    if (!element) return;
    for (const key of ALL_TOKENS) {
        const value = customColors[key];
        if (value) element.style.setProperty(key, value);
        else element.style.removeProperty(key);
    }
}

/**
 * 解析整段粘贴的配色。分号 / 换行都算分隔符，注释忽略。
 * 不在白名单里的变量名跳过而不是整段失败 —— 用户常从别处整段拷来。
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

export function exportColorBatch(colorMap = {}) {
    return COLOR_CATEGORIES
        .map((cat) => {
            const lines = cat.colors.map((c) => `${c.key}: ${colorMap[c.key] || ''};`);
            return `/* ${cat.name} */\n${lines.join('\n')}`;
        })
        .join('\n\n');
}

export function exportTokenNames() {
    return COLOR_CATEGORIES
        .map((cat) => `/* ${cat.name} */\n${cat.colors.map((c) => `${c.key}: ;`).join('\n')}`)
        .join('\n\n');
}
