/**
 * 气泡机 · 界面配色元数据
 *
 * ── 和 `_theme.css` 的分工 ────────────────────────────────────────
 *
 *   `_theme.css`   四套内置主题的**实际色值**。颜色的唯一真相。
 *   本文件         「有哪些 token / 叫什么 / 归在哪一类」这些元信息。
 *
 * 所以下面只有 key,没有 value —— value 运行时从 CSS 读。
 * 这样不会出现「CSS 改了、JS 那份没跟着改」的双份真相。
 *
 * 读取 / 解析 / 应用的逻辑在 `src/core/theme-tokens.js`(和情景聊天共用一份)。
 *
 * ⚠️ 别把气泡本身的颜色和这里混为一谈:
 *    气泡的底色 / 文字色是**用户内容**,存的是具体值,导出的 CSS 要能粘到别处去用;
 *    这里的 `--bb-*` 是**界面配色**,只在本 App 的 shell 里有定义。
 */

import { createThemeTokens } from '@/src/core/theme-tokens.js';

/** 用户可编辑的颜色分类 */
export const COLOR_CATEGORIES = [
    {
        name: '底与面',
        colors: [
            { key: '--bb-bg', label: '页面底色' },
            { key: '--bb-surface', label: '卡片面' },
            { key: '--bb-surface-2', label: '次级面' },
            { key: '--bb-sunken', label: '凹槽面' },
            { key: '--bb-divider', label: '分割线' },
            { key: '--bb-border', label: '轮廓线' },
        ],
    },
    {
        name: '文字',
        colors: [
            { key: '--bb-text', label: '正文' },
            { key: '--bb-text-secondary', label: '次要文字' },
            { key: '--bb-text-tertiary', label: '弱文字' },
            { key: '--bb-text-inverse', label: '反色文字' },
        ],
    },
    {
        name: '主色',
        colors: [
            { key: '--bb-primary', label: '主色' },
            { key: '--bb-primary-soft', label: '主色淡' },
            { key: '--bb-primary-strong', label: '主色深' },
            { key: '--bb-on-primary', label: '主色上的字' },
            { key: '--bb-accent', label: '点缀色' },
            { key: '--bb-accent-soft', label: '点缀淡' },
        ],
    },
    {
        name: '控件',
        colors: [
            { key: '--bb-input-bg', label: '输入背景' },
            { key: '--bb-input-border', label: '输入描边' },
            { key: '--bb-input-focus', label: '聚焦光晕' },
            { key: '--bb-placeholder', label: '占位文字' },
            { key: '--bb-track', label: '滑轨' },
            { key: '--bb-thumb', label: '滑块' },
            { key: '--bb-switch-off', label: '开关关闭' },
            { key: '--bb-switch-on', label: '开关打开' },
        ],
    },
    {
        name: '按钮',
        colors: [
            { key: '--bb-btn-bg', label: '按钮背景' },
            { key: '--bb-btn-border', label: '按钮描边' },
            { key: '--bb-btn-text', label: '按钮文字' },
            { key: '--bb-btn-press', label: '按下底色' },
            { key: '--bb-btn-shadow', label: '按钮落影' },
        ],
    },
    {
        name: '标签与状态',
        colors: [
            { key: '--bb-tag-bg', label: '标签背景' },
            { key: '--bb-tag-text', label: '标签文字' },
            { key: '--bb-success', label: '成功' },
            { key: '--bb-warning', label: '警告' },
            { key: '--bb-danger', label: '危险' },
        ],
    },
    {
        name: '预览台',
        colors: [
            { key: '--bb-stage-bg', label: '预览台底' },
            { key: '--bb-stage-line', label: '预览台格线' },
            { key: '--bb-stage-label', label: '预览台文字' },
        ],
    },
    {
        name: '遮罩与阴影',
        colors: [
            { key: '--bb-overlay', label: '弹窗遮罩' },
            { key: '--bb-shadow', label: '阴影色' },
            { key: '--bb-scrollbar', label: '滚动条' },
        ],
    },
];

export const PRESET_THEMES = [
    { id: 'porcelain', name: '白瓷', desc: '默认 · 纯白干净' },
    { id: 'macaron', name: '马卡龙', desc: '奶油粉调' },
    { id: 'matcha', name: '抹茶', desc: '清浅绿意' },
    { id: 'ink', name: '夜阑', desc: '深色' },
];

export const themeTokens = createThemeTokens({
    appId: 'bubble-maker',
    attr: 'data-bb-theme',
    categories: COLOR_CATEGORIES,
    presets: PRESET_THEMES,
});

// 转发常用项,免得每个组件都写 `themeTokens.xxx`
export const ALL_TOKENS = themeTokens.ALL_TOKENS;
export const PRESET_IDS = themeTokens.PRESET_IDS;
export const readPresetColors = themeTokens.readPresetColors;
export const resolveThemeColors = themeTokens.resolveThemeColors;
export const applyThemeVars = themeTokens.applyThemeVars;
export const parseColorBatch = themeTokens.parseColorBatch;
export const exportColorBatch = themeTokens.exportColorBatch;
export const exportTokenNames = themeTokens.exportTokenNames;
export const countChanged = themeTokens.countChanged;
