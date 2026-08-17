/**
 * relax-app / 糖果色板 + 颜色工具
 *
 * 全 app 的取色器都从这里拿颜色,保证「动森治愈风糖果色」不被随手写的
 * 一次性 hex 稀释掉。想加色请加到 CANDY_SWATCHES,不要在组件里散写。
 */

/** 主取色盘:低饱和 + 高明度,治愈系 */
export const CANDY_SWATCHES = Object.freeze([
    { id: 'peach',     name: '蜜桃',   hex: '#ffc8dd' },
    { id: 'rose',      name: '玫瑰',   hex: '#ffafcc' },
    { id: 'lilac',     name: '香芋',   hex: '#cdb4db' },
    { id: 'sky',       name: '晴空',   hex: '#a2d2ff' },
    { id: 'mint',      name: '薄荷',   hex: '#b8f2e6' },
    { id: 'matcha',    name: '抹茶',   hex: '#cfe8b0' },
    { id: 'butter',    name: '黄油',   hex: '#ffe5a5' },
    { id: 'apricot',   name: '杏仁',   hex: '#ffd6a5' },
    { id: 'coral',     name: '珊瑚',   hex: '#ffb5a7' },
    { id: 'cocoa',     name: '可可',   hex: '#d7b49e' },
    { id: 'cream',     name: '奶油',   hex: '#fff5e4' },
    { id: 'cloud',     name: '云朵',   hex: '#ffffff' },
    { id: 'slate',     name: '雨云',   hex: '#b9c6d4' },
    { id: 'grape',     name: '葡萄',   hex: '#9f86c0' },
]);

/** 品牌主色 —— 顶栏 / 主按钮 / 激活态统一用这套 */
export const RELAX_TOKENS = Object.freeze({
    primary: '#e8788f',
    primarySoft: '#ffb3c6',
    primaryDeep: '#c85a75',
    ink: '#6b5560',
    inkSoft: '#a08b95',
    surface: '#fffaf6',
});

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value) {
    return typeof value === 'string' && HEX_RE.test(value.trim());
}

/** 非法颜色兜底,避免把 undefined 写进 style 造成整块渲染塌掉 */
export function safeColor(value, fallback = '#ffc8dd') {
    return isHexColor(value) ? value.trim() : fallback;
}

/** '#abc' → '#aabbcc' */
function expandHex(hex) {
    const raw = hex.trim().slice(1);
    if (raw.length === 3) {
        return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
    }
    return `#${raw}`;
}

export function hexToRgb(hex) {
    const full = expandHex(safeColor(hex));
    return {
        r: parseInt(full.slice(1, 3), 16),
        g: parseInt(full.slice(3, 5), 16),
        b: parseInt(full.slice(5, 7), 16),
    };
}

/** rgba() 字符串,用于阴影 / 半透明叠色 */
export function rgba(hex, alpha = 1) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 混合两色,ratio=0 全 a,ratio=1 全 b */
export function mix(a, b, ratio = 0.5) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const t = Math.min(1, Math.max(0, ratio));
    const to2 = (n) => Math.round(n).toString(16).padStart(2, '0');
    return `#${to2(ca.r + (cb.r - ca.r) * t)}${to2(ca.g + (cb.g - ca.g) * t)}${to2(ca.b + (cb.b - ca.b) * t)}`;
}

export function lighten(hex, amount = 0.2) {
    return mix(hex, '#ffffff', amount);
}

export function darken(hex, amount = 0.2) {
    return mix(hex, '#4a3b42', amount);
}

/** 感知亮度 0~1,用来决定描边/文字该用深色还是浅色 */
export function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** 在给定底色上可读的文字色 */
export function readableInk(hex) {
    return luminance(hex) > 0.68 ? RELAX_TOKENS.ink : '#ffffff';
}
