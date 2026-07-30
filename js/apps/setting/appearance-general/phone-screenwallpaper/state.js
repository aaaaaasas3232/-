/**
 * 屏幕墙纸模块 · 状态管理
 *
 * 核心状态对象：
 * {
 *   type: 'image',                       // 当前固定为 image（仅支持图片）
 *   imageUrl: string,                    // 图片 URL（type='image' 时有效）
 *   imageSource: 'local' | 'url',        // 图片来源标记（用于 UI 提示）
 *   presetId: string | null,
 * }
 *
 * 兼容旧数据：旧版 state 可能含 type=solid/gradient、colors、angle、blur 等字段。
 * 反序列化时会丢弃（persist 字段保持不变，但 UI 不再提供编辑入口）。
 *
 * 提供：
 * - getState() / setState() - 读写状态
 * - buildWallpaper(state) - 根据状态构建 CSS background 字符串
 * - normalizeHex(color) - 标准化颜色为 6 位 hex
 * - serialize / deserialize - 持久化（用半结构化字符串塞到 appearance 字段里）
 */

// ============================================
// 默认状态
// ============================================

export const DEFAULT_SCREEN_WALLPAPER_STATE = Object.freeze({
    type: 'image',
    imageUrl: '',
    imageSource: 'url',
    presetId: null,
    blur: 0,
});

const BLUR_MIN = 0;
const BLUR_MAX = 20;

function clampBlur(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.min(BLUR_MAX, Math.max(BLUR_MIN, Math.round(n)));
}

// ============================================
// 状态存储（模块级单例）
// ============================================

let _state = { ...DEFAULT_SCREEN_WALLPAPER_STATE };

/** 获取当前屏幕墙纸状态 */
export function getState() {
    return { ..._state };
}

/** 设置屏幕墙纸状态（部分合并） */
export function setState(partial) {
    _state = { ..._state, ...partial };
}

/** 重置为默认状态 */
export function resetState() {
    _state = { ...DEFAULT_SCREEN_WALLPAPER_STATE };
}

// ============================================
// 背景构建
// ============================================

/**
 * 根据状态构建墙纸的 CSS background 字符串。
 * 仅返回「单条 background 值」。
 */
export function buildWallpaper(state) {
    const s = state || _state;
    const { type, colors, angle } = s;

    if (type === 'image' && s.imageUrl) {
        return `url("${escapeForCssUrl(s.imageUrl)}")`;
    }

    const safeColors = Array.isArray(colors) && colors.length ? colors : ['#ffe2ef', '#d6e8ff'];

    if (type === 'solid') {
        return normalizeHex(safeColors[0]);
    }

    // gradient / 默认
    return `linear-gradient(${Number(angle) || 160}deg, ${safeColors.map(normalizeHex).join(', ')})`;
}

// ============================================
// 工具函数
// ============================================

/** 标准化颜色为 6 位 hex（兼容 rgb / 简写） */
export function normalizeHex(color) {
    if (!color || typeof color !== 'string') return '#ffe2ef';

    const trimmed = color.trim().toLowerCase();

    if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
    if (/^#[0-9a-f]{3}$/.test(trimmed)) {
        const r = trimmed[1];
        const g = trimmed[2];
        const b = trimmed[3];
        return `#${r}${r}${g}${g}${b}${b}`;
    }

    const m = trimmed.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) {
        const r = (+m[1]).toString(16).padStart(2, '0');
        const g = (+m[2]).toString(16).padStart(2, '0');
        const b = (+m[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    return '#ffe2ef';
}

export function isGradient(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim().toLowerCase();
    return /^(linear-|radial-|conic-)/.test(trimmed);
}

export function isImageUrl(value) {
    if (typeof value !== 'string') return false;
    const t = value.trim();
    if (!t) return false;
    if (/^url\(/i.test(t)) return /^url\(\s*["']?(data:image\/|https?:|\/\/|\.|\/)/i.test(t);
    return /^(https?:|data:image\/|\/\/)/i.test(t);
}

/**
 * 把 URL 字符串塞进 url("...") 的 background 时需要把内部的 " 转义，
 * 直接丢给 CSS 会让浏览器报错。我们尽量挑没问题的部分。
 */
function escapeForCssUrl(url) {
    if (!url) return '';
    return String(url).replace(/"/g, '\\"').replace(/\\/g, '\\\\');
}

// ============================================
// 持久化序列化 / 反序列化
// ============================================
/**
 * 把「屏幕墙纸」状态打包成单个字符串，存到 appearance.screenWallpaper 字段。
 * 这样不需要新增 IndexedDB 表，直接复用 deviceSettings。
 *
 * 数据格式：JSON 字符串（最简）。失败时返回默认值的字符串。
 */
export function serialize(state) {
    const s = state || _state;
    try {
        return JSON.stringify({
            type: s.type,
            colors: s.colors,
            angle: s.angle,
            imageUrl: s.imageUrl || '',
            imageSource: s.imageSource || 'url',
            presetId: s.presetId || null,
            blur: clampBlur(s.blur),
        });
    } catch {
        return JSON.stringify({ ...DEFAULT_SCREEN_WALLPAPER_STATE, blur: 0 });
    }
}

/** 反序列化字符串 → 状态对象（缺失字段用默认值补） */
export function deserialize(data) {
    if (!data) return { ...DEFAULT_SCREEN_WALLPAPER_STATE };
    let obj = null;
    if (typeof data === 'object') {
        obj = data;
    } else if (typeof data === 'string') {
        try {
            obj = JSON.parse(data);
        } catch {
            obj = null;
        }
    }
    if (!obj || typeof obj !== 'object') {
        return { ...DEFAULT_SCREEN_WALLPAPER_STATE };
    }
    return {
        ...DEFAULT_SCREEN_WALLPAPER_STATE,
        ...obj,
        colors: Array.isArray(obj.colors) ? obj.colors : DEFAULT_SCREEN_WALLPAPER_STATE.colors,
        blur: clampBlur(obj.blur),
    };
}
