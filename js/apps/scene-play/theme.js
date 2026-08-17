/**
 * 情景剧场 · 界面配色元数据
 *
 * ── 和 `_theme.css` 的分工 ────────────────────────────────────────
 *
 *   `_theme.css`   四套内置配色的**实际色值**。颜色的唯一真相。
 *   本文件         「有哪些 token / 叫什么 / 归在哪一类」这些元信息。
 *
 * 读取 / 解析 / 应用的逻辑在 `src/core/theme-tokens.js`(和气泡机共用一份)。
 *
 * ── 两套 token,别混 ──────────────────────────────────────────────
 *
 *   `--sp-*`   **界面**配色(抽屉、按钮、输入框…)。这里管的就是它。
 *   `--spc-*`  **卡片**配色(日记体 / 博客体 / 便签的底色描边)。
 *              它归「外观主题」管,是跟着情景走的,同一个 App 里
 *              不同情景可以完全不一样 —— 所以不能放在这套全局 token 里。
 *              用户在外观页粘 `--spc-*` 就是在改那一层。
 */

import { createThemeTokens } from '@/src/core/theme-tokens.js';

/** 界面配色分类 */
export const COLOR_CATEGORIES = [
    {
        name: '底与面',
        colors: [
            { key: '--sp-bg', label: '页面底色' },
            { key: '--sp-surface', label: '卡片面' },
            { key: '--sp-surface-2', label: '次级面' },
            { key: '--sp-sunken', label: '凹槽面' },
            { key: '--sp-divider', label: '分割线' },
            { key: '--sp-border', label: '轮廓线' },
        ],
    },
    {
        name: '文字',
        colors: [
            { key: '--sp-text', label: '正文' },
            { key: '--sp-text-secondary', label: '次要文字' },
            { key: '--sp-text-tertiary', label: '弱文字' },
            { key: '--sp-text-inverse', label: '反色文字' },
        ],
    },
    {
        name: '主色',
        colors: [
            { key: '--sp-primary', label: '主色' },
            { key: '--sp-primary-soft', label: '主色淡' },
            { key: '--sp-primary-strong', label: '主色深' },
            { key: '--sp-on-primary', label: '主色上的字' },
            { key: '--sp-accent', label: '点缀色' },
            { key: '--sp-accent-soft', label: '点缀淡' },
        ],
    },
    {
        name: '抽屉',
        colors: [
            { key: '--sp-drawer-bg', label: '抽屉底色' },
            { key: '--sp-drawer-head', label: '抽屉头部' },
            { key: '--sp-drawer-tab', label: '抽屉分页' },
            { key: '--sp-drawer-tab-on', label: '分页选中' },
            { key: '--sp-drawer-shadow', label: '抽屉阴影' },
        ],
    },
    {
        name: '舞台',
        colors: [
            { key: '--sp-stage-bg', label: '舞台底色' },
            { key: '--sp-stage-veil', label: '背景蒙层' },
            { key: '--sp-meta', label: '名字 / 时间戳' },
            { key: '--sp-system', label: '旁白文字' },
            { key: '--sp-system-bg', label: '旁白底色' },
        ],
    },
    {
        name: '输入区',
        colors: [
            { key: '--sp-input-bg', label: '输入背景' },
            { key: '--sp-input-border', label: '输入描边' },
            { key: '--sp-input-focus', label: '聚焦光晕' },
            { key: '--sp-placeholder', label: '占位文字' },
            { key: '--sp-composer-bg', label: '输入区底色' },
        ],
    },
    {
        name: '控件',
        colors: [
            { key: '--sp-btn-bg', label: '按钮背景' },
            { key: '--sp-btn-border', label: '按钮描边' },
            { key: '--sp-btn-text', label: '按钮文字' },
            { key: '--sp-btn-shadow', label: '按钮落影' },
            { key: '--sp-track', label: '滑轨' },
            { key: '--sp-thumb', label: '滑块' },
            { key: '--sp-switch-off', label: '开关关闭' },
            { key: '--sp-switch-on', label: '开关打开' },
        ],
    },
    {
        name: '标签与状态',
        colors: [
            { key: '--sp-tag-bg', label: '标签背景' },
            { key: '--sp-tag-text', label: '标签文字' },
            { key: '--sp-success', label: '成功' },
            { key: '--sp-warning', label: '警告' },
            { key: '--sp-danger', label: '危险' },
        ],
    },
    {
        name: '遮罩与阴影',
        colors: [
            { key: '--sp-overlay', label: '弹窗遮罩' },
            { key: '--sp-shadow', label: '阴影色' },
            { key: '--sp-scrollbar', label: '滚动条' },
        ],
    },
];

export const PRESET_THEMES = [
    { id: 'jelly', name: '果冻', desc: '默认 · 马卡龙' },
    { id: 'peach', name: '蜜桃', desc: '暖橘奶油' },
    { id: 'soda', name: '汽水', desc: '薄荷淡蓝' },
    { id: 'plum', name: '夜莓', desc: '深色' },
];

export const themeTokens = createThemeTokens({
    appId: 'scene-play',
    attr: 'data-sp-theme',
    categories: COLOR_CATEGORIES,
    presets: PRESET_THEMES,
});

export const ALL_TOKENS = themeTokens.ALL_TOKENS;
export const PRESET_IDS = themeTokens.PRESET_IDS;
export const readPresetColors = themeTokens.readPresetColors;
export const resolveThemeColors = themeTokens.resolveThemeColors;
export const applyThemeVars = themeTokens.applyThemeVars;
export const parseColorBatch = themeTokens.parseColorBatch;
export const exportColorBatch = themeTokens.exportColorBatch;
export const exportTokenNames = themeTokens.exportTokenNames;
export const countChanged = themeTokens.countChanged;

// ============================================================
// 卡片层 token(--spc-*)
// ============================================================

/**
 * 日记体 / 博客体 / 便签这几种卡片的可调项。
 *
 * ★ 和上面那套是**两回事**:这一套跟着「外观主题」走,不同情景可以不一样。
 *   用户要求「不喜欢可以复制变量名、改内容、粘回编辑框」——
 *   所以这里也提供同样的复制 / 导出能力,只是落点是 `theme.cardVars`
 *   而不是全局配色。
 */
export const CARD_TOKENS = Object.freeze([
    { key: '--spc-bg', label: '卡片底色' },
    { key: '--spc-border', label: '卡片描边' },
    { key: '--spc-radius', label: '卡片圆角' },
    { key: '--spc-text', label: '卡片正文' },
    { key: '--spc-title', label: '卡片标题' },
    { key: '--spc-meta', label: '卡片附注' },
    { key: '--spc-accent', label: '卡片点缀' },
    { key: '--spc-pad', label: '卡片内边距' },
    { key: '--spc-blur', label: '毛玻璃强度' },
]);

/** 卡片 token 的批量文本(和界面配色分开,免得两边互相污染) */
export function exportCardTokenNames() {
    return `/* 卡片体裁 —— 日记 / 博客 / 便签 */\n${CARD_TOKENS.map((t) => `${t.key}: ;`).join('\n')}`;
}

export function exportCardVars(vars = {}) {
    return `/* 卡片体裁 */\n${CARD_TOKENS.map((t) => `${t.key}: ${vars[t.key] || ''};`).join('\n')}`;
}

/**
 * 解析卡片 token 文本。
 *
 * 和界面配色用同一套「不认识就跳过」的策略,但白名单是 `--spc-*`。
 * 值的清洗交给 `regex-engine.sanitizeStyleVars`(它已经挡掉了 `;` 和 `url(`)。
 */
export function parseCardVars(raw) {
    const text = String(raw || '').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const known = new Set(CARD_TOKENS.map((t) => t.key));
    const vars = {};
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
        if (!known.has(key)) { ignored += 1; continue; }
        vars[key] = value;
        valid += 1;
    }
    return { vars, valid, ignored };
}
