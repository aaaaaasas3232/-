/**
 * 设置 App · 外观与通用 · 手机壳状态（Case State）
 *
 * 提供手机壳相关的状态常量、背景生成和颜色处理函数。
 */

/**
 * 默认手机壳状态
 */
export const DEFAULT_CASE_STATE = Object.freeze({
    caseColor: 'linear-gradient(135deg, #f6d3e0 0%, #b4d7f2 100%)',
    caseRadius: 50,
    caseShadow: '0 20px 45px rgba(0, 0, 0, 0.25)',
    hideCase: false,
});

/**
 * 预设手机壳背景
 */
export const PRESET_CASE_BACKGROUNDS = [
    { label: '粉蓝渐变', value: 'linear-gradient(135deg, #f6d3e0 0%, #b4d7f2 100%)' },
    { label: '紫色渐变', value: 'linear-gradient(135deg, #d4a5ff 0%, #a5c4ff 100%)' },
    { label: '日出橙', value: 'linear-gradient(135deg, #ffd4a5 0%, #ffb5a5 100%)' },
    { label: '薄荷绿', value: 'linear-gradient(135deg, #a5ffd4 0%, #a5f0d4 100%)' },
    { label: '天空蓝', value: 'linear-gradient(135deg, #a5d4ff 0%, #d4f0ff 100%)' },
    { label: '玫瑰金', value: 'linear-gradient(135deg, #ffd4e0 0%, #ffd4d4 100%)' },
    { label: '星空紫', value: 'linear-gradient(135deg, #2d1b4e 0%, #4a2c7a 50%, #6b4d9e 100%)' },
    { label: '极光绿', value: 'linear-gradient(135deg, #0d3d2d 0%, #1a6b4a 50%, #2d9b6a 100%)' },
    { label: '纯白', value: '#ffffff' },
    { label: '纯黑', value: '#1a1a1a' },
    { label: '银灰', value: '#c0c0c0' },
    { label: '玫瑰金（实色）', value: '#e8c4c4' },
];

/**
 * 解析和规范化十六进制颜色
 * @param {string} color - 输入颜色（hex, rgb, rgba 或渐变）
 * @returns {string} 规范化后的颜色值
 */
export function normalizeHex(color) {
    if (!color || typeof color !== 'string') {
        return '#f6d3e0';
    }

    const trimmed = color.trim();

    // 如果是渐变，不做处理
    if (/^(linear-|radial-|conic-)/i.test(trimmed)) {
        return trimmed;
    }

    // 处理 rgba/rgb 格式
    const rgbaMatch = trimmed.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+)?\s*\)$/i);
    if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1], 10);
        const g = parseInt(rgbaMatch[2], 10);
        const b = parseInt(rgbaMatch[3], 10);
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    // 处理 hex 格式
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
        // 简写形式扩展
        if (trimmed.length === 4) {
            const r = trimmed[1];
            const g = trimmed[2];
            const b = trimmed[3];
            return `#${r}${r}${g}${g}${b}${b}`;
        }
        return trimmed.length === 7 ? trimmed : trimmed.slice(0, 7);
    }

    // 无法识别的格式，返回默认值
    return '#f6d3e0';
}

/**
 * 判断是否为渐变背景
 * @param {string} value - 背景值
 * @returns {boolean}
 */
export function isGradientBackground(value) {
    if (!value || typeof value !== 'string') return false;
    return /^(linear-|radial-|conic-)/i.test(value.trim());
}

/**
 * 获取有效的手机壳背景
 * @param {object} theme - 主题对象
 * @returns {string} 背景值
 */
export function getCaseBackground(theme) {
    if (!theme) return DEFAULT_CASE_STATE.caseColor;

    const value = theme.caseColor || theme.caseBg;
    if (!value) return DEFAULT_CASE_STATE.caseColor;

    const trimmed = String(value).trim();
    return trimmed || DEFAULT_CASE_STATE.caseColor;
}

/**
 * 根据预设 ID 获取预设背景
 * @param {string} presetId - 预设 ID
 * @returns {string} 预设背景值
 */
export function getPresetBackground(presetId) {
    const preset = PRESET_CASE_BACKGROUNDS.find((p, i) =>
        `preset-${i}` === presetId || p.label === presetId
    );
    return preset ? preset.value : DEFAULT_CASE_STATE.caseColor;
}

/**
 * 颜色对比度计算（用于判断文字颜色）
 * @param {string} color - 十六进制颜色
 * @returns {'light'|'dark'} 对比度类型
 */
export function getContrastType(color) {
    const hex = normalizeHex(color).replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    // 计算相对亮度
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 'dark' : 'light';
}
