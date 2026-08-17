/**
 * 萤火 · 主题元数据
 *
 * ── 和 `css/apps/youtube/index.css` token 段的分工 ────────────────
 *   CSS token 段   两套内置主题的实际色值。**颜色的唯一真相。**
 *   本文件         「有哪些 token / 叫什么 / 归在哪类」，以及
 *                  自定义色的读取、应用与批量解析。
 *
 * `COLOR_CATEGORIES` 只有 key 没有 value —— value 运行时从 CSS 读
 * （`readPresetColors` 塞探针 div 再 getComputedStyle）。
 * JS 里再存一份就成了第二份真相（候鸟同款教训）。
 */

/** 用户可编辑的颜色分类。分组顺序 = 配色页的展示顺序。 */
export const COLOR_CATEGORIES = Object.freeze([
    {
        name: '底色',
        colors: [
            { key: '--yt-bg', label: '页面底' },
            { key: '--yt-bg-soft', label: '浅底' },
            { key: '--yt-surface', label: '表面' },
            { key: '--yt-surface-2', label: '次表面' },
            { key: '--yt-elevated', label: '浮起层' },
        ],
    },
    {
        name: '主色',
        colors: [
            { key: '--yt-primary', label: '主色' },
            { key: '--yt-primary-soft', label: '主色淡底' },
            { key: '--yt-primary-strong', label: '主色深' },
            { key: '--yt-on-primary', label: '主色上的字' },
        ],
    },
    {
        name: '强调色',
        colors: [
            { key: '--yt-accent', label: '强调色' },
            { key: '--yt-accent-soft', label: '强调淡底' },
            { key: '--yt-on-accent', label: '强调上的字' },
        ],
    },
    {
        name: '文字',
        colors: [
            { key: '--yt-text', label: '正文' },
            { key: '--yt-text-2', label: '次要' },
            { key: '--yt-text-3', label: '弱化' },
            { key: '--yt-text-inverse', label: '反色' },
        ],
    },
    {
        name: '线与卡片',
        colors: [
            { key: '--yt-line', label: '分隔线' },
            { key: '--yt-line-soft', label: '浅线' },
            { key: '--yt-line-strong', label: '重线' },
            { key: '--yt-card', label: '卡片底' },
            { key: '--yt-card-hover', label: '卡片按下' },
            { key: '--yt-shadow', label: '阴影' },
        ],
    },
    {
        name: '封面色板',
        colors: [
            { key: '--yt-cover-0', label: '封面一' },
            { key: '--yt-cover-1', label: '封面二' },
            { key: '--yt-cover-2', label: '封面三' },
            { key: '--yt-cover-3', label: '封面四' },
            { key: '--yt-cover-4', label: '封面五' },
            { key: '--yt-cover-5', label: '封面六' },
            { key: '--yt-cover-6', label: '封面七' },
            { key: '--yt-cover-7', label: '封面八' },
            { key: '--yt-cover-text', label: '封面字' },
        ],
    },
    {
        name: '直播与弹幕',
        colors: [
            { key: '--yt-live', label: '直播红' },
            { key: '--yt-live-soft', label: '直播淡底' },
            { key: '--yt-stage', label: '直播画面底' },
            { key: '--yt-stage-text', label: '画面上的字' },
            { key: '--yt-danmaku-bg', label: '弹幕底' },
            { key: '--yt-danmaku-text', label: '弹幕字' },
            { key: '--yt-danmaku-mine', label: '我的弹幕' },
        ],
    },
    {
        name: '站内聊天',
        colors: [
            { key: '--yt-bubble-user-bg', label: '我的气泡' },
            { key: '--yt-bubble-user-text', label: '我的气泡字' },
            { key: '--yt-bubble-peer-bg', label: '对方气泡' },
            { key: '--yt-bubble-peer-text', label: '对方气泡字' },
        ],
    },
    {
        name: '状态',
        colors: [
            { key: '--yt-success', label: '成功' },
            { key: '--yt-warning', label: '提醒' },
            { key: '--yt-danger', label: '危险' },
            { key: '--yt-info', label: '信息' },
        ],
    },
    {
        name: '输入框',
        colors: [
            { key: '--yt-input-bg', label: '输入底' },
            { key: '--yt-input-line', label: '输入边框' },
            { key: '--yt-input-focus', label: '聚焦光晕' },
        ],
    },
    {
        name: '标签',
        colors: [
            { key: '--yt-tag-bg', label: '标签底' },
            { key: '--yt-tag-text', label: '标签字' },
            { key: '--yt-tag-line', label: '标签边' },
        ],
    },
    {
        name: '底栏',
        colors: [
            { key: '--yt-nav-bg', label: '底栏底' },
            { key: '--yt-nav-line', label: '底栏线' },
            { key: '--yt-nav-icon', label: '未选中' },
            { key: '--yt-nav-active', label: '选中' },
        ],
    },
    {
        name: '遮罩与骨架',
        colors: [
            { key: '--yt-overlay', label: '弹窗遮罩' },
            { key: '--yt-skeleton', label: '骨架底' },
        ],
    },
]);

/** 所有可编辑 token 的扁平列表 */
export const ALL_TOKENS = Object.freeze(
    COLOR_CATEGORIES.flatMap((c) => c.colors.map((x) => x.key)),
);

const TOKEN_SET = new Set(ALL_TOKENS);

export const PRESET_THEMES = Object.freeze([
    { id: 'paper', name: '纸灯', mode: 'light', desc: '暖白纸面 + 一点烛红，默认' },
    { id: 'dusk', name: '夜幕', mode: 'dark', desc: '熄灯后的放映厅' },
]);

export const PRESET_IDS = Object.freeze(PRESET_THEMES.map((p) => p.id));

// ============================================================
// 从 CSS 读预设色值
// ============================================================

const _presetCache = new Map();

/**
 * 读某套预设的实际色值：往 shell 里塞一个带 `data-yt-theme` 的隐藏探针，
 * 浏览器按 CSS 算出所有变量，再逐个读走。
 * （CSS 里每套主题必须同时写「shell 自身」和「shell 内后代」两个选择器，
 *   否则探针匹配不上，预览卡全显示成当前主题。）
 */
export function readPresetColors(themeId) {
    const id = PRESET_IDS.includes(themeId) ? themeId : PRESET_IDS[0];
    if (_presetCache.has(id)) return _presetCache.get(id);

    if (typeof document === 'undefined') return {};
    const shell = document.querySelector('.app-shell[data-app-id="youtube"]');
    if (!shell) return {};   // App 还没挂载，下次再读

    const probe = document.createElement('div');
    probe.setAttribute('data-yt-theme', id);
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
 * 传空对象 = 回到内置主题 —— 必须逐个 removeProperty，
 * 不写新值的话旧 inline 变量还在，会一直盖着 CSS。
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
 * ★ 不在白名单里的变量名跳过而不是整段失败 —— 用户常从别处整段拷来，
 *   混着别的 App 的变量很正常。
 *
 * @returns {{ colors: object, valid: number, ignored: number }}
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
