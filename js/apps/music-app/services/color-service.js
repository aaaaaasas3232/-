/**
 * music-app · services/color-service.js
 * 主题色提取 + CSS var 应用。
 *
 * 旧 music-app.js 的 extractColorFromImage / applyThemeColor / hexToRgb 拆出来。
 *
 * 提取算法:把图片画到 1x1 canvas → 取 RGB → 计算主色调
 */

const _cache = new Map();

/**
 * hex → {r,g,b}
 */
export function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return { r: 251, g: 114, b: 153 };
    const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return { r: 251, g: 114, b: 153 };
    return {
        r: parseInt(m[1], 16),
        g: parseInt(m[2], 16),
        b: parseInt(m[3], 16),
    };
}

/**
 * {r,g,b} → hex
 */
export function rgbToHex(r, g, b) {
    const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * 计算主色调变体
 * @param {string} baseHex
 * @returns {{primary, light, dark, translucent}}
 */
export function getColorVariants(baseHex) {
    const { r, g, b } = hexToRgb(baseHex);
    return {
        primary: baseHex,
        rgb: `${r}, ${g}, ${b}`,
        light: rgbToHex(Math.min(255, r + 40), Math.min(255, g + 40), Math.min(255, b + 40)),
        dark: rgbToHex(Math.max(0, r - 40), Math.max(0, g - 40), Math.max(0, b - 40)),
        translucent: `rgba(${r}, ${g}, ${b}, 0.15)`,
        soft: `rgba(${r}, ${g}, ${b}, 0.08)`,
    };
}

/**
 * 从图片 URL 提取主色
 * @param {string} url
 * @returns {Promise<string|null>} hex 颜色字符串,失败返回 null
 */
export async function extractColorFromImage(url) {
    if (!url) return null;
    if (_cache.has(url)) return _cache.get(url);

    return new Promise((resolve) => {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = typeof document !== 'undefined'
                        ? document.createElement('canvas')
                        : null;
                    if (!canvas) {
                        resolve(null);
                        return;
                    }
                    canvas.width = 1;
                    canvas.height = 1;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(null);
                        return;
                    }
                    ctx.drawImage(img, 0, 0, 1, 1);
                    const data = ctx.getImageData(0, 0, 1, 1).data;
                    const hex = rgbToHex(data[0], data[1], data[2]);
                    _cache.set(url, hex);
                    resolve(hex);
                } catch (err) {
                    console.warn('[music] extractColorFromImage failed', err);
                    resolve(null);
                }
            };
            img.onerror = () => {
                _cache.set(url, null);
                resolve(null);
            };
            img.src = url;
        } catch (err) {
            console.warn('[music] extractColorFromImage error', err);
            resolve(null);
        }
    });
}

/**
 * 把主题色应用到当前 player DOM 节点(设置 CSS var)
 * @param {HTMLElement|string} target - 元素或 selector
 * @param {string} hex
 */
export function applyThemeColor(target, hex) {
    if (!hex) return;
    const variants = getColorVariants(hex);
    const el = typeof target === 'string'
        ? document.querySelector(target)
        : target;
    if (!el) return;
    el.style.setProperty('--music-theme-color', variants.primary);
    el.style.setProperty('--music-theme-color-rgb', variants.rgb);
    el.style.setProperty('--music-theme-color-light', variants.light);
    el.style.setProperty('--music-theme-color-dark', variants.dark);
    el.style.setProperty('--music-theme-color-translucent', variants.translucent);
    el.style.setProperty('--music-theme-color-soft', variants.soft);
    el.setAttribute('data-theme-color', hex);
}

/**
 * 清除主题色(离开播放器时调)
 */
export function clearThemeColor(target) {
    const el = typeof target === 'string'
        ? document.querySelector(target)
        : target;
    if (!el) return;
    el.style.removeProperty('--music-theme-color');
    el.style.removeProperty('--music-theme-color-rgb');
    el.style.removeProperty('--music-theme-color-light');
    el.style.removeProperty('--music-theme-color-dark');
    el.style.removeProperty('--music-theme-color-translucent');
    el.style.removeProperty('--music-theme-color-soft');
    el.removeAttribute('data-theme-color');
}