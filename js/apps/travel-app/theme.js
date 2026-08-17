/**
 * 候鸟 · 主题元数据
 *
 * ── 和 `css/apps/travel/index.css` token 段的分工 ─────────────────
 *   CSS token 段   两套内置主题的实际色值。**颜色的唯一真相。**
 *   本文件         「有哪些 token / 叫什么 / 归在哪类」，以及
 *                  自定义色的读取、应用与批量解析。
 *
 * `COLOR_CATEGORIES` 只有 key 没有 value —— value 运行时从 CSS 读
 * （`readPresetColors` 塞探针 div 再 getComputedStyle）。
 * JS 里再存一份就成了第二份真相，改了 CSS 而 JS 没改的表现是
 * 「预览是新色、应用后是旧色」，极难排查。
 */

/** 用户可编辑的颜色分类。分组顺序 = 配色页的展示顺序。 */
export const COLOR_CATEGORIES = Object.freeze([
    {
        name: '底色',
        colors: [
            { key: '--tv-bg', label: '页面底' },
            { key: '--tv-bg-soft', label: '浅底' },
            { key: '--tv-surface', label: '表面' },
            { key: '--tv-surface-2', label: '次表面' },
            { key: '--tv-elevated', label: '浮起层' },
        ],
    },
    {
        name: '主色',
        colors: [
            { key: '--tv-primary', label: '主色' },
            { key: '--tv-primary-soft', label: '主色淡底' },
            { key: '--tv-primary-strong', label: '主色深' },
            { key: '--tv-on-primary', label: '主色上的字' },
        ],
    },
    {
        name: '强调色',
        colors: [
            { key: '--tv-accent', label: '强调色' },
            { key: '--tv-accent-soft', label: '强调淡底' },
            { key: '--tv-on-accent', label: '强调上的字' },
        ],
    },
    {
        name: '文字',
        colors: [
            { key: '--tv-text', label: '正文' },
            { key: '--tv-text-2', label: '次要' },
            { key: '--tv-text-3', label: '弱化' },
            { key: '--tv-text-inverse', label: '反色' },
        ],
    },
    {
        name: '线与卡片',
        colors: [
            { key: '--tv-line', label: '分隔线' },
            { key: '--tv-line-soft', label: '浅线' },
            { key: '--tv-line-strong', label: '重线' },
            { key: '--tv-card', label: '卡片底' },
            { key: '--tv-card-hover', label: '卡片按下' },
            { key: '--tv-shadow', label: '阴影' },
        ],
    },
    {
        name: '钱与票',
        colors: [
            { key: '--tv-price', label: '票价' },
            { key: '--tv-coin', label: '余额' },
            { key: '--tv-ticket-bg', label: '机票底' },
            { key: '--tv-ticket-line', label: '机票边' },
            { key: '--tv-ticket-accent', label: '机票强调' },
        ],
    },
    {
        name: '旅行对话',
        colors: [
            { key: '--tv-narration-bg', label: '旁白底' },
            { key: '--tv-narration-text', label: '旁白字' },
            { key: '--tv-bubble-user-bg', label: '我的气泡' },
            { key: '--tv-bubble-user-text', label: '我的气泡字' },
            { key: '--tv-bubble-ai-bg', label: 'AI 气泡' },
            { key: '--tv-bubble-ai-text', label: 'AI 气泡字' },
            { key: '--tv-chat-scrim', label: '背景压暗' },
        ],
    },
    {
        name: '状态',
        colors: [
            { key: '--tv-success', label: '成功' },
            { key: '--tv-warning', label: '提醒' },
            { key: '--tv-danger', label: '危险' },
            { key: '--tv-info', label: '信息' },
        ],
    },
    {
        name: '输入框',
        colors: [
            { key: '--tv-input-bg', label: '输入底' },
            { key: '--tv-input-line', label: '输入边框' },
            { key: '--tv-input-focus', label: '聚焦光晕' },
        ],
    },
    {
        name: '标签',
        colors: [
            { key: '--tv-tag-bg', label: '标签底' },
            { key: '--tv-tag-text', label: '标签字' },
            { key: '--tv-tag-line', label: '标签边' },
        ],
    },
    {
        name: '底栏',
        colors: [
            { key: '--tv-nav-bg', label: '底栏底' },
            { key: '--tv-nav-line', label: '底栏线' },
            { key: '--tv-nav-icon', label: '未选中' },
            { key: '--tv-nav-active', label: '选中' },
        ],
    },
    {
        name: '遮罩与骨架',
        colors: [
            { key: '--tv-overlay', label: '弹窗遮罩' },
            { key: '--tv-skeleton', label: '骨架底' },
        ],
    },
]);

/** 所有可编辑 token 的扁平列表 */
export const ALL_TOKENS = Object.freeze(
    COLOR_CATEGORIES.flatMap((c) => c.colors.map((x) => x.key)),
);

const TOKEN_SET = new Set(ALL_TOKENS);

export const PRESET_THEMES = Object.freeze([
    { id: 'sky', name: '晴空', mode: 'light', desc: '掺一点蓝的云白，默认' },
    { id: 'tide', name: '夜潮', mode: 'dark', desc: '深海蓝底，夜里不刺眼' },
]);

export const PRESET_IDS = Object.freeze(PRESET_THEMES.map((p) => p.id));

// ============================================================
// 从 CSS 读预设色值
// ============================================================

const _presetCache = new Map();

/**
 * 读某套预设的实际色值：往 shell 里塞一个带 `data-tv-theme` 的隐藏探针，
 * 浏览器按 CSS 算出所有变量，再逐个读走。
 * （CSS 里每套主题必须同时写「shell 自身」和「shell 内后代」两个选择器，
 *   否则探针匹配不上，预览卡全显示成当前主题。）
 */
export function readPresetColors(themeId) {
    const id = PRESET_IDS.includes(themeId) ? themeId : PRESET_IDS[0];
    if (_presetCache.has(id)) return _presetCache.get(id);

    if (typeof document === 'undefined') return {};
    const shell = document.querySelector('.app-shell[data-app-id="travel"]');
    if (!shell) return {};   // App 还没挂载，下次再读

    const probe = document.createElement('div');
    probe.setAttribute('data-tv-theme', id);
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
