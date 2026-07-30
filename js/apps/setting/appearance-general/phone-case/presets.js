/**
 * 手机壳模块 · 预设配置
 *
 * 包含所有可选的预设方案：
 * - 纯色预设（Solid）
 * - 双色渐变预设（Gradient）
 * - 多色渐变预设（Multi）
 *
 * 使用 Object.freeze 冻结确保不可变
 */

/** 纯色预设 - 16 色板（占满两排 8×2） */
export const SOLID_PRESETS = Object.freeze([
    { id: 'cream',     value: '#F6EBDC' },
    { id: 'apricot',   value: '#E8C9B0' },
    { id: 'pink',      value: '#F5C6D6' },
    { id: 'lavender',  value: '#C9B6E4' },
    { id: 'sky',       value: '#A9C8E8' },
    { id: 'mint',      value: '#B8E0D2' },
    { id: 'gray',      value: '#C8CCD3' },
    { id: 'noir',      value: '#2E2E33' },
    { id: 'peach',     value: '#F2B5A0' },
    { id: 'rose',      value: '#E8A0BF' },
    { id: 'lilac',     value: '#B8A1D9' },
    { id: 'ocean',     value: '#7FB3D5' },
    { id: 'sage',      value: '#A8C9A0' },
    { id: 'sand',      value: '#D9C7A0' },
    { id: 'mocha',     value: '#A89076' },
    { id: 'midnight',  value: '#4A4E69' },
]);

/**
 * 从渐变预设的 value 字符串中解析出起始色与结束色。
 * 支持 "linear-gradient(135deg, #xxxxxx 0%, #yyyyyy 100%)" 这类格式。
 */
function parseGradientStops(value) {
    const match = value.match(/linear-gradient\([^,]+,\s*([^,]+),\s*([^)]+)\)/);
    if (!match) return { start: '#cccccc', end: '#999999' };
    return {
        start: match[1].trim().split(/\s+/)[0],
        end: match[2].trim().split(/\s+/)[0],
    };
}

/** 双色渐变预设 */
export const GRADIENT_PRESETS = Object.freeze(
    [
        { id: 'default', label: '樱蓝',    value: 'linear-gradient(135deg, #f6d3e0 0%, #b4d7f2 100%)' },
        { id: 'cream',   label: '奶杏',    value: 'linear-gradient(135deg, #fbe5d2 0%, #f6d3e0 100%)' },
        { id: 'sakura',  label: '樱霞',    value: 'linear-gradient(135deg, #fbcfe8 0%, #f472b6 100%)' },
        { id: 'mist',    label: '雾蓝',    value: 'linear-gradient(135deg, #cdd9f2 0%, #b6c9e8 100%)' },
        { id: 'mint',    label: '薄荷',    value: 'linear-gradient(135deg, #d4f1e9 0%, #a8dacd 100%)' },
        { id: 'sunset',  label: '晚霞',    value: 'linear-gradient(135deg, #f9c8b4 0%, #e58fa5 100%)' },
        { id: 'aurora',  label: '极光',    value: 'linear-gradient(135deg, #d9c2f0 0%, #a48bd9 100%)' },
        { id: 'night',   label: '夜空',    value: 'linear-gradient(145deg, #2b2f3a 0%, #0e1117 100%)' },
        { id: 'gold',    label: '鎏金',    value: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
        { id: 'ocean',   label: '海蓝',    value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
        { id: 'purple',  label: '星紫',    value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
        { id: 'rose',    label: '玫瑰',    value: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' },
    ].map(preset => {
        const { start, end } = parseGradientStops(preset.value);
        return Object.freeze({
            ...preset,
            startColor: start,
            endColor: end,
        });
    })
);

/** 多色渐变预设 */
export const MULTI_PRESETS = Object.freeze([
    { id: 'sunset',    label: '落日',     colors: ['#ff9a56', '#ff6b95', '#a855f7'], angle: 135 },
    { id: 'rainbow',   label: '彩虹',     colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'], angle: 90 },
    { id: 'dream',     label: '幻梦',     colors: ['#e0c3fc', '#8ec5fc', '#e0c3fc'], angle: 120 },
    { id: 'candy',     label: '糖果',     colors: ['#f093fb', '#f5576c', '#fda085'], angle: 45 },
    { id: 'aurora',    label: '极光',     colors: ['#00c6fb', '#005bea', '#a8edea', '#fed6e3'], angle: 180 },
    { id: 'sunrise',   label: '日出',     colors: ['#ff6b6b', '#feca57', '#fff720'], angle: 45 },
    { id: 'neon',      label: '霓虹',     colors: ['#ff0080', '#7928ca', '#0070f3'], angle: 135 },
    { id: 'peach',     label: '蜜桃',     colors: ['#ffecd2', '#fcb69f', '#ff8a65', '#ff6e7f'], angle: 60 },
]);

/** 预设角度 */
export const ANGLE_PRESETS = Object.freeze([
    { label: '0',  value: 0 },
    { label: '45', value: 45 },
    { label: '135',value: 135 },
    { label: '180',value: 180 },
    { label: '270',value: 270 },
    { label: '315',value: 315 },
]);

/** 导出统一预设对象 */
export const CASE_PRESETS = Object.freeze({
    solid: SOLID_PRESETS,
    gradient: GRADIENT_PRESETS,
    multi: MULTI_PRESETS,
    angles: ANGLE_PRESETS,
});
