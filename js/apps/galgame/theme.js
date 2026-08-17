/**
 * 湛蓝回忆 · 主题元数据
 *
 * ── 这个文件和 `_theme.css` 的分工 ────────────────────────────────
 *
 *   `_theme.css`   四套内置主题的**实际颜色值**。颜色的唯一真相。
 *   本文件         「有哪些 token / 叫什么 / 归在哪一类」这些元信息,
 *                  以及自定义色的合并 / 应用逻辑。
 *
 * 所以 `COLOR_CATEGORIES` 里只有 key,没有 value —— value 运行时从 CSS 读
 * (`readPresetColors`)。这样不会出现「CSS 改了、JS 那份没跟着改」的双份真相。
 *
 * 原型正是栽在这:`:root` 里有一套变量(思路对的),但 CSS 里还散着几百处硬编码
 * hex,以及 JS 里 `style.cssText = '...color: var(--x)...'` 混着写死的
 * `#999` / `rgba(0,0,0,0.2)` —— 换主题时那些纹丝不动。
 */

import { clamp } from './utils.js';

/** 用户可编辑的颜色分类 */
export const COLOR_CATEGORIES = Object.freeze([
    {
        name: '舞台',
        colors: [
            { key: '--gg-stage-bg', label: '舞台底色' },
            { key: '--gg-stage-veil', label: '舞台压暗' },
            { key: '--gg-stage-vignette', label: '暗角' },
        ],
    },
    {
        name: '对话框',
        colors: [
            { key: '--gg-dialogue-bg', label: '对话框背景' },
            { key: '--gg-dialogue-border', label: '对话框描边' },
            { key: '--gg-dialogue-text', label: '对话正文' },
            { key: '--gg-dialogue-narration', label: '旁白文字' },
            { key: '--gg-name-bg', label: '名牌背景' },
            { key: '--gg-name-text', label: '名牌文字' },
            { key: '--gg-cursor', label: '光标 / 继续箭头' },
        ],
    },
    {
        name: '选项',
        colors: [
            { key: '--gg-option-bg', label: '选项背景' },
            { key: '--gg-option-border', label: '选项描边' },
            { key: '--gg-option-text', label: '选项文字' },
            { key: '--gg-option-hover', label: '选项按下' },
            { key: '--gg-option-visited', label: '走过的选项' },
            { key: '--gg-option-custom', label: '自定义选项' },
        ],
    },
    {
        name: '主色',
        colors: [
            { key: '--gg-primary', label: '主色' },
            { key: '--gg-primary-soft', label: '主色淡' },
            { key: '--gg-primary-strong', label: '主色深' },
            { key: '--gg-on-primary', label: '主色上的字' },
            { key: '--gg-secondary', label: '次色' },
            { key: '--gg-secondary-soft', label: '次色淡' },
            { key: '--gg-highlight', label: '高亮' },
        ],
    },
    {
        name: '面板',
        colors: [
            { key: '--gg-panel-bg', label: '面板背景' },
            { key: '--gg-panel-header', label: '面板头部' },
            { key: '--gg-panel-border', label: '面板描边' },
            { key: '--gg-card-bg', label: '卡片背景' },
            { key: '--gg-card-border', label: '卡片描边' },
            { key: '--gg-card-hover', label: '卡片悬浮' },
        ],
    },
    {
        name: '文字',
        colors: [
            { key: '--gg-text', label: '正文' },
            { key: '--gg-text-secondary', label: '次要文字' },
            { key: '--gg-text-tertiary', label: '弱文字' },
            { key: '--gg-text-inverse', label: '反色文字' },
        ],
    },
    {
        name: '菜单按钮',
        colors: [
            { key: '--gg-menu-bg', label: '按钮背景' },
            { key: '--gg-menu-border', label: '按钮描边' },
            { key: '--gg-menu-icon', label: '按钮图标' },
            { key: '--gg-menu-active-bg', label: '按下背景' },
            { key: '--gg-menu-active-icon', label: '按下图标' },
        ],
    },
    {
        name: '剧情树',
        colors: [
            { key: '--gg-tree-bg', label: '画布底色' },
            { key: '--gg-tree-grid', label: '网格线' },
            { key: '--gg-tree-edge', label: '连线' },
            { key: '--gg-tree-edge-path', label: '当前线路连线' },
            { key: '--gg-tree-node', label: '节点' },
            { key: '--gg-tree-node-text', label: '节点文字' },
            { key: '--gg-tree-node-path', label: '当前线路节点' },
            { key: '--gg-tree-node-current', label: '所在节点' },
            { key: '--gg-tree-node-k', label: 'K 节点' },
            { key: '--gg-tree-node-ghost', label: '未展开分支' },
        ],
    },
    {
        name: '记忆 / 标签',
        colors: [
            { key: '--gg-k-bg', label: 'K 卡背景' },
            { key: '--gg-k-border', label: 'K 卡描边' },
            { key: '--gg-k-accent', label: 'K 卡强调' },
            { key: '--gg-tag-bg', label: '标签背景' },
            { key: '--gg-tag-text', label: '标签文字' },
            { key: '--gg-tag-border', label: '标签描边' },
        ],
    },
    {
        name: '好感度',
        colors: [
            { key: '--gg-affection-track', label: '进度槽' },
            { key: '--gg-affection-low', label: '低好感' },
            { key: '--gg-affection-mid', label: '中好感' },
            { key: '--gg-affection-high', label: '高好感' },
        ],
    },
    {
        name: '表单',
        colors: [
            { key: '--gg-input-bg', label: '输入背景' },
            { key: '--gg-input-border', label: '输入描边' },
            { key: '--gg-input-focus', label: '聚焦光晕' },
            { key: '--gg-input-text', label: '输入文字' },
            { key: '--gg-placeholder', label: '占位文字' },
        ],
    },
    {
        name: '状态',
        colors: [
            { key: '--gg-success', label: '成功' },
            { key: '--gg-warning', label: '警告' },
            { key: '--gg-danger', label: '危险' },
            { key: '--gg-info', label: '信息' },
            { key: '--gg-progress', label: '进度条' },
            { key: '--gg-progress-track', label: '进度槽' },
        ],
    },
    {
        name: '轮廓 / 阴影',
        colors: [
            { key: '--gg-divider', label: '分割线' },
            { key: '--gg-overlay', label: '弹窗遮罩' },
            { key: '--gg-shadow', label: '阴影色' },
            { key: '--gg-glass-bg', label: '玻璃背景' },
            { key: '--gg-glass-border', label: '玻璃描边' },
            { key: '--gg-scrollbar', label: '滚动条' },
        ],
    },
]);

/** 所有可编辑 token 的扁平列表 */
export const ALL_TOKENS = Object.freeze(
    COLOR_CATEGORIES.flatMap((c) => c.colors.map((x) => x.key)),
);

export const PRESET_THEMES = Object.freeze([
    { id: 'azure', name: '湛蓝', mode: 'light', desc: '原版配色' },
    { id: 'dusk', name: '暮樱', mode: 'light', desc: '暖粉黄昏' },
    { id: 'night', name: '夜航', mode: 'dark', desc: '深蓝夜色' },
    { id: 'ink', name: '墨林', mode: 'dark', desc: '青绿水墨' },
]);

export const PRESET_IDS = Object.freeze(PRESET_THEMES.map((p) => p.id));

// ============================================================
// 从 CSS 读预设色值
// ============================================================

const _presetCache = new Map();

/**
 * 把某套预设主题的实际色值从 CSS 里读出来。
 *
 * 做法:临时造一个带 `data-gg-theme` 的隐藏节点挂进 app-shell,
 * 让浏览器按 `_theme.css` 算出全部变量,再 `getComputedStyle` 逐个读走。
 *
 * 为什么不在 JS 里存一份:那就是第二份真相。CSS 改了而 JS 没改,
 * 结果是「预览里是新色、应用后是旧色」—— 这种 bug 极难联想到原因。
 */
export function readPresetColors(themeId) {
    const id = PRESET_IDS.includes(themeId) ? themeId : PRESET_IDS[0];
    if (_presetCache.has(id)) return _presetCache.get(id);

    if (typeof document === 'undefined') return {};
    const shell = document.querySelector('.app-shell[data-app-id="galgame"]');
    if (!shell) return {};   // App 还没挂载,读不到就先返回空,下次再读

    const probe = document.createElement('div');
    probe.setAttribute('data-gg-theme', id);
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
    if (Object.keys(out).length > 0) _presetCache.set(id, out);
    return out;
}

/** 预设 + 用户改动 = 最终色表 */
export function resolveThemeColors(themeId, customColors = {}) {
    return { ...readPresetColors(themeId), ...(customColors || {}) };
}

/**
 * 把一套色值写到元素上(自定义主题就是这么生效的)。
 *
 * 传空对象表示「回到内置主题」—— 必须把之前写上去的变量逐个 remove,
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

// ============================================================
// 批量配色文本
// ============================================================

/**
 * 解析一整段配色文本。
 *
 * 格式:`--gg-primary: #5DADE2;` —— 分号和换行都能当分隔符,冒号两边空格随意,
 * `/* 注释 *\/` 会被忽略。
 *
 * ★ 不在白名单里的变量名**跳过而不是整段失败** —— 用户常常是从别处整段拷来的,
 *   里面混着别的 App 的变量很正常,为此让整次粘贴失败是最讨厌的体验。
 *
 * @returns {{ colors:Object, valid:number, ignored:number }}
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
        if (!ALL_TOKENS.includes(key)) { ignored += 1; continue; }
        colors[key] = value;
        valid += 1;
    }
    return { colors, valid, ignored };
}

/** 把当前配色导出成可粘贴的文本(带值) */
export function exportColorBatch(colors = {}) {
    return COLOR_CATEGORIES
        .map((cat) => {
            const lines = cat.colors.map((c) => `${c.key}: ${colors[c.key] || ''};`);
            return `/* ${cat.name} */\n${lines.join('\n')}`;
        })
        .join('\n\n');
}

/** 只导出变量名(空模板),方便照着填 */
export function exportTokenNames() {
    return COLOR_CATEGORIES
        .map((cat) => `/* ${cat.name} */\n${cat.colors.map((c) => `${c.key}: ;`).join('\n')}`)
        .join('\n\n');
}

// ============================================================
// 好感度 → 档位
// ============================================================

/**
 * 好感度取哪一档颜色。
 *
 * ★ 返回的是**档位名**不是颜色值 —— CSS 里 `[data-tone="high"]` 决定实际颜色,
 *   所以换主题时好感度条也跟着变。这是「JS 存 token 名不存 hex」那条规矩
 *   在本 App 里的具体落地。
 */
export function affectionTone(value) {
    const v = clamp(value, 0, 100);
    if (v >= 70) return 'high';
    if (v >= 35) return 'mid';
    return 'low';
}
