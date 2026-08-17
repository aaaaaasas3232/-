/**
 * relax-app / 内置盘子库
 *
 * 「盘子」是主体的托盘 —— 主体铺在盘子的内圈里(inset 区域)。
 * 全部是不规则形状(动森风),用 border-radius 的 8 值语法或 clip-path 实现,
 * 不用图片,所以可以任意染色 + 缩放。
 *
 * 盘子契约:
 *   {
 *     id, name,
 *     defaultTint,
 *     // 外形:二选一
 *     radius: 'xx% yy% ... / ...'   ← border-radius 8 值不规则圆角
 *     clip:   'polygon(...)'         ← 需要棱角/花边时用 clip-path
 *     rim: number                    ← 盘沿厚度(px),主体区域会 inset 这么多
 *     depth: number                  ← 立体阴影强度 0~1
 *     glaze: boolean                 ← 是否加一层高光釉面
 *   }
 *
 * 加新盘子:往 PLATES 里 push 一条。
 */

import { darken, lighten, rgba, safeColor } from '../palette.js';

export const PLATES = Object.freeze([
    {
        id: 'blob-soft',
        name: '软糖碟',
        defaultTint: '#fff5e4',
        radius: '62% 38% 44% 56% / 48% 56% 44% 52%',
        rim: 16,
        depth: 0.9,
        glaze: true,
    },
    {
        id: 'blob-pebble',
        name: '鹅卵石',
        defaultTint: '#b9c6d4',
        radius: '46% 54% 62% 38% / 58% 42% 58% 42%',
        rim: 14,
        depth: 1,
        glaze: false,
    },
    {
        id: 'round-classic',
        name: '圆盘',
        defaultTint: '#ffffff',
        radius: '50%',
        rim: 18,
        depth: 0.8,
        glaze: true,
    },
    {
        id: 'squircle-tray',
        name: '方托盘',
        defaultTint: '#ffd6a5',
        radius: '34% 30% 32% 36% / 32% 34% 30% 34%',
        rim: 15,
        depth: 0.85,
        glaze: false,
    },
    {
        id: 'cloud-plate',
        name: '云朵盘',
        defaultTint: '#ffffff',
        // 云朵轮廓:上缘多个鼓包
        clip: 'polygon(50% 0%, 62% 6%, 74% 2%, 84% 12%, 96% 20%, 100% 36%, 96% 54%, 100% 70%, 90% 84%, 74% 94%, 58% 100%, 42% 100%, 26% 94%, 12% 86%, 2% 70%, 0% 52%, 4% 34%, 12% 18%, 26% 8%, 38% 4%)',
        rim: 20,
        depth: 0.7,
        glaze: true,
    },
    {
        id: 'leaf-plate',
        name: '叶子盘',
        defaultTint: '#cfe8b0',
        radius: '4% 88% 12% 88% / 88% 12% 88% 8%',
        rim: 18,
        depth: 0.8,
        glaze: false,
    },
    {
        id: 'flower-plate',
        name: '花瓣盘',
        defaultTint: '#ffafcc',
        clip: 'polygon(50% 0%, 61% 10%, 76% 5%, 84% 18%, 98% 24%, 94% 40%, 100% 52%, 92% 64%, 96% 79%, 81% 84%, 72% 96%, 57% 93%, 44% 100%, 32% 91%, 17% 92%, 12% 78%, 0% 68%, 6% 54%, 1% 40%, 12% 30%, 10% 15%, 25% 12%, 36% 2%)',
        rim: 22,
        depth: 0.75,
        glaze: true,
    },
    {
        id: 'wood-board',
        name: '木托板',
        defaultTint: '#d7b49e',
        radius: '18% 18% 18% 18% / 26% 26% 26% 26%',
        rim: 14,
        depth: 1,
        glaze: false,
    },
    {
        // 来自解压4 的「白瓷方盘」,1:1 还原原 HTML 的视觉结构。
        // 解压4 的盘子由 3 层组成(注意:解压4 的 ctx.rect 是装饰用方框,
        // 真正承担主体容器的是 ctx.arc 内切圆;按用户实际记忆精简到 3 层):
        //   .container    奶茶色 #f0e8e0,圆角 48/400=12%,0 16px 48px rgba(0,0,0,0.08)
        //   canvas        白底 #fcf9f6,圆角 32/400=8%,0 4px 20px rgba(0,0,0,0.06) inset
        //   ctx.arc 170   内切圆 #ffffff,0 4px 10px rgba(0,0,0,0.05)
        // 项目里用 rx-plate / rx-plate-inner / rx-plate-center 三层对应。
        id: 'square-tile',
        name: '白瓷方盘',
        defaultTint: '#f0e8e0',          // 外圈(奶茶色)对应 .container
        radius: '12%',                    // 圆角 48/400
        rim: 0,
        depth: 0,
        glaze: false,
        outerShadow: '0 16px 48px rgba(0, 0, 0, 0.08)',  // .container 的投影
        inner: {                          // 中圈「画布容器」
            tint: '#fcf9f6',              // canvas 底色
            borderRadius: '8%',           // 32/400
            padding: 32,                  // 32/400
            shadow: 'inset 0 4px 20px rgba(0, 0, 0, 0.06)',  // canvas 的 inset 阴影
        },
        center: {                         // 最内切圆盘(主体容器,直接占满 inner)
            enabled: true,
            shape: 'round',
            tint: '#ffffff',
            matchInner: true,             // 直径 = inner 边长(占满 inner)
            shadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
        },
    },
]);

export function getPlate(id) {
    return PLATES.find(item => item.id === id) || PLATES[0];
}

/**
 * 盘子外壳样式(绑到盘子根元素)
 * @param {object} plateConfig scene.plate
 */
export function resolvePlateStyle(plateConfig = {}) {
    const preset = getPlate(plateConfig.presetId);
    const tint = safeColor(plateConfig.tint || preset.defaultTint, '#fff5e4');

    // 解压4 风格的外圈(扁平纯色 + 单层投影):
    //   不套斜向渐变和内阴影公式,完全按 preset.outerShadow 1:1 还原
    if (preset.outerShadow !== undefined) {
        return {
            background: tint,
            boxShadow: preset.outerShadow || 'none',
            borderRadius: preset.radius,
        };
    }

    const depth = preset.depth ?? 0.85;
    const style = {
        // 盘面:斜向渐变造出「有厚度」的观感
        background: `linear-gradient(155deg, ${lighten(tint, 0.34)} 0%, ${tint} 46%, ${darken(tint, 0.12)} 100%)`,
        boxShadow: [
            `inset 0 ${Math.round(6 * depth)}px ${Math.round(14 * depth)}px ${rgba(lighten(tint, 0.85), 0.75)}`,
            `inset 0 -${Math.round(8 * depth)}px ${Math.round(16 * depth)}px ${rgba(darken(tint, 0.3), 0.35)}`,
            `0 ${Math.round(14 * depth)}px ${Math.round(28 * depth)}px ${rgba(darken(tint, 0.45), 0.28)}`,
        ].join(', '),
    };

    if (preset.border) {
        // 三层套娃(解压4 风格):外壳也允许有 1px 描边,奶茶色外圈用得上
        style.border = `${preset.border.width}px solid ${preset.border.color}`;
    }

    if (preset.clip) {
        style.clipPath = preset.clip;
        // clip-path 会裁掉 box-shadow 的外阴影,所以圆角也一起给上做兜底
        style.borderRadius = '24%';
    } else {
        style.borderRadius = preset.radius;
    }

    return style;
}

/** 盘子中圈(画布容器 / 奶白方盘的承载)样式 */
export function resolvePlateInnerStyle(plateConfig = {}) {
    const preset = getPlate(plateConfig.presetId);

    // 三层套娃(解压4 风格):中圈 = 「画布容器」
    //   用 preset.inner.padding 做 inset,preset.inner.shadow 做内阴影
    if (preset.inner) {
        const cfg = preset.inner;
        const style = {
            inset: `${cfg.padding}px`,
            borderRadius: cfg.borderRadius || '50%',
            background: cfg.tint,
        };
        if (cfg.shadow) style.boxShadow = cfg.shadow;
        return style;
    }

    // 普通盘子:内圈 = 主体容器,按盘沿 inset,无独立样式
    const rim = preset.rim ?? 16;
    return {
        inset: `${rim}px`,
        borderRadius: preset.clip ? '20%' : preset.radius,
    };
}

/**
 * 最内切圆盘(主体 ToyHost 实际落脚处,解压4 ctx.arc 那层)
 * matchInner: true → 直径 = inner 边长(用 inner.padding 做 inset)
 */
export function resolvePlateCenterStyle(plateConfig = {}) {
    const preset = getPlate(plateConfig.presetId);
    if (!preset.center?.enabled) return null;

    const cfg = preset.center;

    // matchInner 模式:让 center 直接占满 inner 的内容区
    if (cfg.matchInner && preset.inner) {
        return {
            inset: `${preset.inner.padding}px`,
            borderRadius: cfg.shape === 'round' ? '50%' : (cfg.borderRadius || '0'),
            background: cfg.tint,
        };
    }

    // 旧模式:按百分比居中
    const size = (cfg.radiusPercent ?? 42.5) * 2;
    const offset = (100 - size) / 2;
    return {
        top: `${offset}%`,
        left: `${offset}%`,
        width: `${size}%`,
        height: `${size}%`,
        borderRadius: cfg.shape === 'round' ? '50%' : (cfg.borderRadius || '0'),
        background: cfg.tint,
        boxShadow: cfg.shadow,
    };
}

/** 釉面高光层;preset.glaze 为 false 时返回 null(调用方用 v-if 判断) */
export function resolvePlateGlaze(plateConfig = {}) {
    const preset = getPlate(plateConfig.presetId);
    if (!preset.glaze) return null;
    const tint = safeColor(plateConfig.tint || preset.defaultTint, '#fff5e4');
    return {
        background: `radial-gradient(70% 45% at 30% 18%, ${rgba(lighten(tint, 0.95), 0.75)} 0%, transparent 70%)`,
        borderRadius: preset.clip ? '24%' : preset.radius,
    };
}
