/**
 * 手机壳模块 · 状态管理
 *
 * 核心状态对象：
 * {
 *   type: 'solid' | 'gradient' | 'multi',
 *   colors: string[],           // 颜色数组
 *   angle: number,             // 渐变角度 (0-360)
 *   presetId: string | null,   // 当前预设ID (用于高亮)
 * }
 *
 * 提供：
 * - getState() / setState() - 读写状态
 * - buildBackground(state) - 根据状态构建背景字符串
 * - normalizeHex(color) - 标准化颜色为6位hex
 * - isGradient(value) - 判断是否是渐变字符串
 */

// ============================================
// 默认状态
// ============================================

export const DEFAULT_CASE_STATE = Object.freeze({
    type: 'gradient',
    colors: ['#f6d3e0', '#b4d7f2'],
    angle: 135,
    presetId: 'default',
});

// ============================================
// 状态存储（模块级单例）
// ============================================

let _state = { ...DEFAULT_CASE_STATE };

/** 获取当前手机壳状态 */
export function getState() {
    return { ..._state };
}

/** 设置手机壳状态 */
export function setState(partial) {
    _state = { ..._state, ...partial };
}

/** 重置为默认状态 */
export function resetState() {
    _state = { ...DEFAULT_CASE_STATE };
}

// ============================================
// 背景构建
// ============================================

/**
 * 根据状态构建背景字符串
 */
export function buildBackground(state) {
    const { type, colors, angle } = state || _state;
    if (!colors || colors.length === 0) return '#f6d3e0';

    switch (type) {
        case 'solid':
            return normalizeHex(colors[0]);

        case 'gradient':
            if (colors.length === 1) return normalizeHex(colors[0]);
            return `linear-gradient(${angle || 135}deg, ${colors.map(normalizeHex).join(', ')})`;

        case 'multi':
            if (colors.length === 1) return normalizeHex(colors[0]);
            return `linear-gradient(${angle || 135}deg, ${colors.map(normalizeHex).join(', ')})`;

        default:
            return `linear-gradient(${angle || 135}deg, ${colors.map(normalizeHex).join(', ')})`;
    }
}

// ============================================
// 工具函数
// ============================================

/** 标准化颜色为6位hex */
export function normalizeHex(color) {
    if (!color || typeof color !== 'string') return '#f6d3e0';

    const trimmed = color.trim().toLowerCase();

    // 已经是hex
    if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;

    // 简写hex (#fff)
    if (/^#[0-9a-f]{3}$/.test(trimmed)) {
        const r = trimmed[1];
        const g = trimmed[2];
        const b = trimmed[3];
        return `#${r}${r}${g}${g}${b}${b}`;
    }

    // rgba/rgb 转 hex (简化处理)
    const rgbaMatch = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1], 10).toString(16).padStart(2, '0');
        const g = parseInt(rgbaMatch[2], 10).toString(16).padStart(2, '0');
        const b = parseInt(rgbaMatch[3], 10).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    // 返回原值（可能是已处理的渐变）
    return trimmed;
}

/** 判断是否是渐变字符串 */
export function isGradient(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim().toLowerCase();
    return /^(linear-|radial-|conic-)/.test(trimmed);
}

/** 从渐变字符串解析颜色和角度 */
export function parseGradient(gradientStr) {
    if (!isGradient(gradientStr)) return null;

    const match = gradientStr.match(/linear-gradient\((\d+)deg,\s*([^)]+)\)/);
    if (!match) return null;

    const angle = parseInt(match[1], 10);
    const colorsStr = match[2];
    const colors = colorsStr
        .split(',')
        .map(c => c.trim().replace(/\s+\d+%/g, '')) // 去掉颜色后面的位置值，如 "0%"
        .filter(Boolean);

    return { angle, colors };
}

/** 构建双色渐变字符串 */
export function buildGradient(colors, angle = 135) {
    if (!Array.isArray(colors) || colors.length === 0) return '#f6d3e0';
    if (colors.length === 1) return normalizeHex(colors[0]);
    return `linear-gradient(${angle}deg, ${colors.map(normalizeHex).join(', ')})`;
}

/** 构建多色渐变字符串 */
export function buildMultiGradient(colors, angle = 135) {
    return buildGradient(colors, angle);
}

// ============================================
// 序列化（用于存储）
// ============================================

/** 序列化状态为可存储格式 */
export function serialize(state) {
    return {
        ...state,
        background: buildBackground(state),
    };
}

/** 从存储格式反序列化 */
export function deserialize(data) {
    if (!data) return DEFAULT_CASE_STATE;

    if (data.type && data.colors) {
        return {
            type: data.type,
            colors: data.colors,
            angle: data.angle || 135,
            presetId: data.presetId || null,
        };
    }

    // 兼容旧格式（直接是背景字符串）
    if (typeof data === 'string') {
        if (isGradient(data)) {
            const parsed = parseGradient(data);
            if (parsed) {
                return {
                    type: 'gradient',
                    colors: parsed.colors,
                    angle: parsed.angle,
                    presetId: null,
                };
            }
        }
        return {
            type: 'solid',
            colors: [data],
            angle: 135,
            presetId: null,
        };
    }

    return DEFAULT_CASE_STATE;
}
