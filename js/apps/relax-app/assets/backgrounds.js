/**
 * relax-app / 内置背景库
 *
 * 每个背景都是「程序化生成」的 —— 纯 CSS 渐变 + inline SVG 图案,不依赖任何图片文件。
 * 好处:全部可染色(tint 变了整张背景跟着变)、单文件构建也不会丢资源。
 *
 * 背景契约:
 *   { id, name, tintable, defaultTint, layers(tint) -> { backgroundImage, backgroundSize?, backgroundColor } }
 *
 * `layers(tint)` 返回可以直接摊到 style 上的对象。多层用逗号分隔,
 * **前面的层盖在后面的层上**(CSS background 的堆叠顺序)。
 *
 * 加新背景:往 BACKGROUNDS 数组里 push 一条即可,UI 会自动出现。
 */

import { lighten, darken, rgba, safeColor } from '../palette.js';

/** inline SVG 转 CSS url(),统一收口避免各处重复 encodeURIComponent */
function svgUrl(svg) {
    return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}")`;
}

export const BACKGROUNDS = Object.freeze([
    {
        id: 'plain',
        name: '纯色卡片',
        defaultTint: '#a2d2ff',
        tintable: true,
        layers(tint) {
            const c = safeColor(tint, '#a2d2ff');
            return {
                backgroundColor: c,
            };
        },
    },
    {
        id: 'checker-picnic',
        name: '野餐格子',
        defaultTint: '#cfe8b0',
        tintable: true,
        layers(tint) {
            const c = safeColor(tint, '#cfe8b0');
            const deep = darken(c, 0.14);
            const pale = lighten(c, 0.6);
            return {
                backgroundColor: pale,
                backgroundImage: [
                    `linear-gradient(45deg, ${rgba(deep, 0.35)} 25%, transparent 25%, transparent 75%, ${rgba(deep, 0.35)} 75%)`,
                    `linear-gradient(45deg, ${rgba(deep, 0.35)} 25%, transparent 25%, transparent 75%, ${rgba(deep, 0.35)} 75%)`,
                    `linear-gradient(180deg, ${pale} 0%, ${c} 100%)`,
                ].join(', '),
                backgroundSize: '44px 44px, 44px 44px, cover',
                backgroundPosition: '0 0, 22px 22px, 0 0',
            };
        },
    },
    {
        id: 'wood-table',
        name: '木纹桌面',
        defaultTint: '#d7b49e',
        tintable: true,
        layers(tint) {
            const c = safeColor(tint, '#d7b49e');
            const grain = svgUrl(`
                <svg xmlns="http://www.w3.org/2000/svg" width="120" height="18">
                    <rect width="120" height="18" fill="none"/>
                    <path d="M0 6 Q30 2 60 6 T120 6" stroke="${darken(c, 0.16)}" stroke-width="1.4" fill="none" opacity="0.5"/>
                    <path d="M0 13 Q34 9 68 13 T120 13" stroke="${darken(c, 0.1)}" stroke-width="1" fill="none" opacity="0.4"/>
                </svg>`);
            return {
                backgroundColor: c,
                backgroundImage: `${grain}, linear-gradient(165deg, ${lighten(c, 0.22)} 0%, ${c} 45%, ${darken(c, 0.12)} 100%)`,
                backgroundSize: '120px 18px, cover',
            };
        },
    },
    {
        id: 'stripe-candy',
        name: '糖果条纹',
        defaultTint: '#ffafcc',
        tintable: true,
        layers(tint) {
            const c = safeColor(tint, '#ffafcc');
            return {
                backgroundColor: lighten(c, 0.55),
                backgroundImage: `repeating-linear-gradient(112deg, ${rgba(c, 0.55)} 0px, ${rgba(c, 0.55)} 22px, ${rgba(lighten(c, 0.75), 0.9)} 22px, ${rgba(lighten(c, 0.75), 0.9)} 44px)`,
            };
        },
    },
]);

export function getBackground(id) {
    return BACKGROUNDS.find(item => item.id === id) || BACKGROUNDS[0];
}

/**
 * 把一条背景配置解析成可直接绑到 :style 的对象。
 * @param {object} bgConfig scene.background
 * @param {string|null} customImageUrl 用户上传的图(优先级最高)
 */
export function resolveBackgroundStyle(bgConfig = {}, customImageUrl = null) {
    if (customImageUrl) {
        return {
            backgroundColor: '#000',
            backgroundImage: `url("${customImageUrl}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: buildFilter(bgConfig),
        };
    }

    const preset = getBackground(bgConfig.presetId);
    const style = preset.layers(bgConfig.tint || preset.defaultTint) || {};

    /*
     * 关键:对没有显式给 backgroundRepeat 的预设,统一补一份 inline 默认值。
     *
     * 这是为了规避舞台上的 `.rx-stage-bg` 里这三条 CSS shorthand:
     *   background-repeat: no-repeat;
     *   background-position: center;
     *   background-size: cover;
     * shorthand 会把多值 inline 压成单值应用,导致「野餐格子」「奶油圆点」
     * 等多层 background-image 的小尺寸方格/dot 全被拉伸到全屏,舞台就崩成
     * 一团乱色。瓦片预览(`.rx-bg-thumb`)没有这些 CSS 覆盖,所以预览里正
     * 常,应用后就崩。
     *
     * 凡是 layers 显式声明了 backgroundRepeat 的(波浪条纹、散景)按它的来;
     * 否则按背景层数自动补 `repeat, ..., no-repeat`(最后一层是底色用 cover)。
     */
    const normalized = ensureLayerDefaults(style);

    return { ...normalized, filter: buildFilter(bgConfig) };
}

/**
 * 给多值 background-image 自动补齐 backgroundRepeat / backgroundPosition / backgroundSize,
 * 避免 CSS shorthand 默认值把多值压成单值。
 *
 * 规则:layer 数量 = background-image 里逗号分隔的项数;
 *   - 第一层到倒数第二层:都是「图案层」,默认 repeat + 0 0 + 自身大小(若 layers
 *     没声明 backgroundSize,我们用 'auto' 让浏览器根据原图自适配);
 *   - 最后一层:「底色层」,默认 no-repeat + center + cover。
 *
 * layers 自己已经声明了的字段不会被覆盖。
 */
function ensureLayerDefaults(style) {
    const image = style.backgroundImage;
    if (!image || typeof image !== 'string') return style;
    const layerCount = image.split('),').length; // 粗略:每层结尾是 `)`
    if (layerCount < 2) return style;

    const buildList = (defFirst, defLast) => {
        const arr = [];
        for (let i = 0; i < layerCount; i++) {
            arr.push(i === layerCount - 1 ? defLast : defFirst);
        }
        return arr.join(', ');
    };

    const out = { ...style };

    if (!('backgroundRepeat' in out)) {
        // 图案层 repeat,底色层 no-repeat
        out.backgroundRepeat = buildList('repeat', 'no-repeat');
    }
    if (!('backgroundPosition' in out)) {
        out.backgroundPosition = buildList('0 0', 'center');
    }
    if (!('backgroundSize' in out)) {
        // layers 自己声明过的会被跳过;没声明就给图案层 auto,底色层 cover
        // 但 layers 通常会声明 backgroundSize(只有 plain-sky / stripe-candy 没声明),
        // 所以这条主要是兜底
        out.backgroundSize = buildList('auto', 'cover');
    }

    return out;
}

function buildFilter(bgConfig = {}) {
    const parts = [];
    const blur = Number(bgConfig.blur) || 0;
    const brightness = bgConfig.brightness == null ? 1 : Number(bgConfig.brightness);
    const saturate = bgConfig.saturate == null ? 1 : Number(bgConfig.saturate);
    if (blur > 0) parts.push(`blur(${blur}px)`);
    if (brightness !== 1) parts.push(`brightness(${brightness})`);
    if (saturate !== 1) parts.push(`saturate(${saturate})`);
    return parts.length ? parts.join(' ') : 'none';
}
