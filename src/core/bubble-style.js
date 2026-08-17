/**
 * 框架层 · 聊天气泡的「配置 → 样式」唯一实现
 *
 * ── 为什么放在 src/core ──────────────────────────────────────────────
 *
 * 「气泡机」负责**做**气泡,「情景聊天」负责**用**气泡。两边都要把同一份
 * 配置对象翻译成同一组 CSS —— 判据(`docs/framework-总览.md` §7)是
 * 「改一次要改几个地方」:各写一份的话,气泡机里预览得好好的,套到聊天里
 * 就差一点点(圆角顺序错了、透明度没乘上去),而且**两边都不报错**。
 *
 * 所以这里是纯函数模块:输入配置对象,输出 style 对象和消毒过的 SVG 字符串。
 * 不碰 DOM、不读写存储、不 import 任何 App 的东西。
 *
 * ── 谁在用 ────────────────────────────────────────────────────────
 *
 *   js/apps/bubble-maker/    编辑时实时预览
 *   js/apps/scene-play/      渲染每一条消息
 *
 * ── 关于 SVG ──────────────────────────────────────────────────────
 *
 * 气泡尾巴的形状是**用户粘进来的 SVG**,直接 `v-html` 等于开了一个 XSS 口子
 * (`<svg><script>` 在 HTML 解析里是会执行的)。`sanitizeSvg()` 用白名单
 * 重建整棵树 —— 白名单之外的标签和属性一律丢掉,而不是「找危险的删掉」:
 * 黑名单永远列不全。
 */

// ============================================================
// 1) 默认配置
// ============================================================

/**
 * 一个气泡的完整配置。
 *
 * ★ 这里**没有任何主题色** —— 气泡的颜色是用户自己调的内容,
 *   和 App 的界面配色(`--bb-*` / `--sp-*`)是两回事。
 *   界面配色在各自的 `_theme.css` 里,JS 一个 hex 都不写;
 *   而气泡颜色属于「用户数据」,存的就是具体色值。
 */
export function createBubbleConfig(patch = {}) {
    return {
        id: String(patch.id || ''),
        name: String(patch.name || '未命名气泡'),
        side: patch.side === 'left' ? 'left' : 'right',

        // ── 背景 ──
        bgMode: patch.bgMode === 'gradient' ? 'gradient' : 'solid',
        bgColor: str(patch.bgColor, '#FFE0EC'),
        bgOpacity: num(patch.bgOpacity, 100, 0, 100),
        gradientType: patch.gradientType === 'radial' ? 'radial' : 'linear',
        gradientAngle: num(patch.gradientAngle, 135, 0, 360),
        gradientCenterX: num(patch.gradientCenterX, 50, 0, 100),
        gradientCenterY: num(patch.gradientCenterY, 50, 0, 100),
        gradientStops: normalizeStops(patch.gradientStops),

        /** 毛玻璃模糊半径,0 = 关闭 */
        blur: num(patch.blur, 0, 0, 40),

        // ── 文字 ──
        textColor: str(patch.textColor, '#5A4A52'),
        fontSize: num(patch.fontSize, 14, 9, 32),
        fontWeight: num(patch.fontWeight, 400, 300, 800),
        lineHeight: num(patch.lineHeight, 1.6, 1, 3),
        letterSpacing: num(patch.letterSpacing, 0, -2, 8),
        textAlign: ['left', 'center', 'right'].includes(patch.textAlign) ? patch.textAlign : 'left',

        // ── 盒子 ──
        paddingY: num(patch.paddingY, 10, 0, 40),
        paddingX: num(patch.paddingX, 14, 0, 48),
        maxWidth: num(patch.maxWidth, 72, 30, 100),   // 百分比
        radiusTL: num(patch.radiusTL, 18, 0, 60),
        radiusTR: num(patch.radiusTR, 18, 0, 60),
        radiusBR: num(patch.radiusBR, 18, 0, 60),
        radiusBL: num(patch.radiusBL, 6, 0, 60),

        // ── 边框 ──
        borderWidth: num(patch.borderWidth, 0, 0, 12),
        borderColor: str(patch.borderColor, '#F2B8CC'),
        borderOpacity: num(patch.borderOpacity, 100, 0, 100),
        borderStyle: ['solid', 'dashed', 'dotted', 'double'].includes(patch.borderStyle) ? patch.borderStyle : 'solid',

        /** 外描边(画在 border 之外,不占布局) */
        outlineWidth: num(patch.outlineWidth, 0, 0, 12),
        outlineColor: str(patch.outlineColor, '#FFFFFF'),
        outlineOpacity: num(patch.outlineOpacity, 100, 0, 100),

        // ── 阴影 ──
        shadowX: num(patch.shadowX, 0, -40, 40),
        shadowY: num(patch.shadowY, 2, -40, 40),
        shadowBlur: num(patch.shadowBlur, 8, 0, 60),
        shadowSpread: num(patch.shadowSpread, 0, -20, 20),
        shadowColor: str(patch.shadowColor, '#000000'),
        shadowOpacity: num(patch.shadowOpacity, 8, 0, 100),
        shadowInset: patch.shadowInset === true,

        // ── 尾巴 ──
        tails: asArray(patch.tails).map(createTail),

        updatedAt: Number(patch.updatedAt) || Date.now(),
    };
}

export function createTail(patch = {}) {
    return {
        id: String(patch.id || `tail-${Math.random().toString(36).slice(2, 8)}`),
        /** 形状来源:内置 preset key,或引用 SVG 库里的一条 */
        shape: str(patch.shape, 'drop'),
        /** 引用 SVG 库时存 id;为空表示用内置 preset */
        shapeId: String(patch.shapeId || ''),
        /** 直接内联的 SVG(库里的形状会在读取时填进来) */
        svg: String(patch.svg || ''),

        enabled: patch.enabled !== false,
        anchor: ['top', 'bottom', 'left', 'right'].includes(patch.anchor) ? patch.anchor : 'bottom',
        /** 沿锚定边的位置,0~100 百分比 */
        along: num(patch.along, 84, 0, 100),
        /**
         * 垂直于锚定边的偏移,px。**正数往气泡外**。
         *
         * ★ 默认给正值。给 0 或负值的话尾巴整个压在气泡里面,
         *   而它的颜色又默认跟随气泡底色 —— 结果是「加了尾巴但什么都没变」,
         *   用户会以为功能坏了。第一版的内置预设就踩了这个,截图才发现。
         */
        offset: num(patch.offset, 7, -60, 60),
        size: num(patch.size, 16, 4, 80),
        rotation: num(patch.rotation, 0, -180, 360),
        flipX: patch.flipX === true,
        flipY: patch.flipY === true,

        /** 留空 = 跟随气泡背景色(最常见的诉求,单独调色反而容易错位) */
        color: String(patch.color || ''),
        opacity: num(patch.opacity, 100, 0, 100),

        strokeWidth: num(patch.strokeWidth, 0, 0, 8),
        // 默认 #BCBCBC 灰 —— iOS 经典气泡的标志性灰边。粉色(#F2B8CC)是
        // 第一版的默认值,但任何形状都用粉色描边会显得诡异,用户也从来没
        // 主动想要过。
        strokeColor: str(patch.strokeColor, '#BCBCBC'),
    };
}

function normalizeStops(raw) {
    const list = asArray(raw)
        .map((s, i) => ({
            id: String(s?.id || `stop-${i}`),
            color: str(s?.color, '#FFE0EC'),
            position: num(s?.position, i === 0 ? 0 : 100, 0, 100),
            opacity: num(s?.opacity, 100, 0, 100),
        }))
        .sort((a, b) => a.position - b.position);
    if (list.length >= 2) return list;
    return [
        { id: 'stop-0', color: '#FFE0EC', position: 0, opacity: 100 },
        { id: 'stop-1', color: '#D9EDF7', position: 100, opacity: 100 },
    ];
}

// ============================================================
// 2) 颜色
// ============================================================

/**
 * 把 hex / rgb / rgba 统一成带透明度的 rgba()。
 *
 * ★ 不认识的写法**原样返回**,不做兜底猜测 —— 用户可能填的是
 *   `color-mix()` 或 CSS 变量名,猜一个颜色回去等于悄悄改了他的设计。
 *   不认识时透明度就不生效,这是可见的、能自己发现的行为。
 */
export function withAlpha(color, opacity = 100) {
    const raw = String(color || '').trim();
    const a = clamp(Number(opacity), 0, 100) / 100;
    if (!raw) return 'transparent';
    if (a >= 1) return raw;

    const hex = raw.match(/^#([0-9a-f]{3,8})$/i);
    if (hex) {
        const h = hex[1];
        let r; let g; let b; let baseA = 1;
        if (h.length === 3 || h.length === 4) {
            r = parseInt(h[0] + h[0], 16);
            g = parseInt(h[1] + h[1], 16);
            b = parseInt(h[2] + h[2], 16);
            if (h.length === 4) baseA = parseInt(h[3] + h[3], 16) / 255;
        } else if (h.length === 6 || h.length === 8) {
            r = parseInt(h.slice(0, 2), 16);
            g = parseInt(h.slice(2, 4), 16);
            b = parseInt(h.slice(4, 6), 16);
            if (h.length === 8) baseA = parseInt(h.slice(6, 8), 16) / 255;
        } else {
            return raw;
        }
        return `rgba(${r}, ${g}, ${b}, ${round(baseA * a, 3)})`;
    }

    const rgb = raw.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i);
    if (rgb) {
        const baseA = rgb[4] === undefined ? 1 : Number(rgb[4]);
        return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${round(baseA * a, 3)})`;
    }
    return raw;
}

/** `<input type="color">` 只吃 `#rrggbb`,别的都会被静默显示成黑色 */
export function isHexColor(value) {
    return /^#[0-9a-fA-F]{6}$/.test(String(value || '').trim());
}

// ============================================================
// 3) 配置 → 样式
// ============================================================

/** 气泡背景(纯色或渐变) */
export function bubbleBackground(cfg) {
    if (cfg.bgMode !== 'gradient') return withAlpha(cfg.bgColor, cfg.bgOpacity);
    const stops = normalizeStops(cfg.gradientStops)
        .map((s) => `${withAlpha(s.color, s.opacity * (cfg.bgOpacity / 100))} ${s.position}%`)
        .join(', ');
    if (cfg.gradientType === 'radial') {
        return `radial-gradient(circle at ${cfg.gradientCenterX}% ${cfg.gradientCenterY}%, ${stops})`;
    }
    return `linear-gradient(${cfg.gradientAngle}deg, ${stops})`;
}

/**
 * 气泡盒子的 style 对象(直接绑 `:style`)。
 *
 * 这里只放**定位相关** —— maxWidth(气泡最大宽度)。
 * 背景、边框、阴影等视觉**都跟着尾巴配色走**,由 `.bubble-view-tail-fill`
 * 那层的 inline style 设置(跟随气泡底色 + 描边色 + 融合 z-index)。
 *
 * 为什么要这么拆?iOS 短信气泡的「尾巴跟气泡内描边无重叠」效果靠三层
 * z-index 障眼法:
 *
 *     .bubble-view-box            z-index: 0 (默认)   ← 没显式 z-index,
 *                                                      不创建 stacking context
 *     .bubble-view-text           z-index: 1          ← 气泡本体夹在中间
 *     .bubble-view-tail-stroke    z-index: 0          ← 描边尾巴,在气泡下
 *     .bubble-view-tail-fill      z-index: 3          ← 填充尾巴,在气泡上
 *
 * 气泡盒本身**故意**保持 auto,这样描边尾巴(z:0)跟气泡本体的 background
 * 顺序由 DOM 顺序决定 —— text 在前(画气泡),描边尾巴 span 在后(画描边尾巴),
 * 但 z-index 1 的 text 会盖住 z-index 0 的描边尾巴。
 * 填充尾巴 z-index 3 在最上,气泡外那截(气泡 box 没覆盖到的部分)**完整可见**。
 *
 * ★ 返回**对象**而不是字符串:Vue 的 `:style` 收对象时会做 diff,
 *   字符串每次都是整串替换,调滑块时会把光标状态一起抖掉。
 */
export function bubbleBoxStyle(cfg) {
    return {
        maxWidth: `${cfg.maxWidth}%`,
    };
}

/**
 * 气泡本体的 style(底色 + 边框 + 内边距 + 阴影 + 文字 + 圆角)。
 *
 * 写在 `.bubble-view-text` 层 —— 这个层是 z-index: 1 的「夹心层」,
 * 能在描边尾巴(z:0)之上把贴在气泡内的那段描边尾巴盖掉。
 *
 * box-shadow / outline 也走这里:它们是气泡本体的视觉,不是容器的。
 */
export function bubbleTextStyle(cfg) {
    const style = {
        background: bubbleBackground(cfg),
        color: cfg.textColor,
        fontSize: `${cfg.fontSize}px`,
        fontWeight: String(cfg.fontWeight),
        lineHeight: String(cfg.lineHeight),
        letterSpacing: `${cfg.letterSpacing}px`,
        textAlign: cfg.textAlign,
        padding: `${cfg.paddingY}px ${cfg.paddingX}px`,
        borderRadius: `${cfg.radiusTL}px ${cfg.radiusTR}px ${cfg.radiusBR}px ${cfg.radiusBL}px`,
    };

    if (cfg.blur > 0) {
        style.backdropFilter = `blur(${cfg.blur}px)`;
        style.webkitBackdropFilter = `blur(${cfg.blur}px)`;
    }

    if (cfg.borderWidth > 0) {
        style.border = `${cfg.borderWidth}px ${cfg.borderStyle} ${withAlpha(cfg.borderColor, cfg.borderOpacity)}`;
    }

    // 外描边和阴影都走 box-shadow —— outline 不跟随 border-radius,
    // 圆角气泡上会画出一个方框(这是 outline 的规范行为,不是 bug,但没人想要)
    const layers = [];
    if (cfg.outlineWidth > 0) {
        layers.push(`0 0 0 ${cfg.outlineWidth}px ${withAlpha(cfg.outlineColor, cfg.outlineOpacity)}`);
    }
    if (cfg.shadowOpacity > 0 && (cfg.shadowBlur > 0 || cfg.shadowX || cfg.shadowY || cfg.shadowSpread)) {
        const inset = cfg.shadowInset ? 'inset ' : '';
        layers.push(`${inset}${cfg.shadowX}px ${cfg.shadowY}px ${cfg.shadowBlur}px ${cfg.shadowSpread}px ${withAlpha(cfg.shadowColor, cfg.shadowOpacity)}`);
    }
    if (layers.length) style.boxShadow = layers.join(', ');

    return style;
}

/**
 * 尾巴的定位 style。
 *
 * 定位模型:`anchor` 决定贴哪条边,`along` 是沿那条边走多远(百分比),
 * `offset` 是垂直于那条边的位移(正数往气泡外)。
 * 比「x / y 两个绝对偏移」好用的地方在于:改气泡圆角或内边距时尾巴不会跑掉。
 *
 * 如果 tail 上带了 `pos: { top, left, right, bottom }`(单位 px),
 * 就**完全覆盖** anchor/along/offset 模型,直接用绝对像素定位。
 * 经典(sms.js 同款)的「左上角 + 距左 10px / 距顶 6px」这种 corner 偏移
 * 不好用 anchor 模型表达(它是相对**角**而不是相对边),所以走 `pos`。
 * 另一个用 pos 的场景:用户想做不规则位置(比如尾巴贴在某个角的某点)。
 *
 * z-index **不返回在这里**。每条尾巴在模板里渲染**两个** span,各带一个
 * 写死的 z-index: 描边层 z:0,填充层 z:3。气泡本体 z:1 夹在中间 →
 * 气泡内那段描边尾巴被气泡盖掉、填充尾巴被气泡盖掉(但填充只画在气泡
 * 外的路径上,所以不漏色);气泡外描边尾巴直接可见、填充尾巴在气泡
 * 之上的部分也直接可见。**iOS 短信气泡的标准做法**,不需要 svg filter。
 */
export function tailStyle(tail, cfg) {
    const size = `${tail.size}px`;
    const style = {
        position: 'absolute',
        width: size,
        height: size,
        opacity: String(clamp(tail.opacity, 0, 100) / 100),
        pointerEvents: 'none',
    };

    const transforms = [];

    // ★ pos 模式(覆盖 anchor/along/offset)—— 经典尾巴等需要 corner 偏移的形状用这种
    if (tail.pos && typeof tail.pos === 'object') {
        if (typeof tail.pos.top === 'number') style.top = `${tail.pos.top}px`;
        if (typeof tail.pos.bottom === 'number') style.bottom = `${tail.pos.bottom}px`;
        if (typeof tail.pos.left === 'number') style.left = `${tail.pos.left}px`;
        if (typeof tail.pos.right === 'number') style.right = `${tail.pos.right}px`;
    } else if (tail.anchor === 'bottom' || tail.anchor === 'top') {
        style.left = `${tail.along}%`;
        transforms.push('translateX(-50%)');
        if (tail.anchor === 'bottom') style.bottom = `${-tail.offset}px`;
        else style.top = `${-tail.offset}px`;
    } else {
        style.top = `${tail.along}%`;
        transforms.push('translateY(-50%)');
        if (tail.anchor === 'left') style.left = `${-tail.offset}px`;
        else style.right = `${-tail.offset}px`;
    }

    if (tail.rotation) transforms.push(`rotate(${tail.rotation}deg)`);
    if (tail.flipX) transforms.push('scaleX(-1)');
    if (tail.flipY) transforms.push('scaleY(-1)');
    if (transforms.length) style.transform = transforms.join(' ');

    // 尾巴默认跟着气泡走 —— 单独调色是少数情况,而忘了改的话
    // 换气泡底色时会留下一个颜色对不上的小三角
    style.color = tail.color || flatBubbleColor(cfg);
    return style;
}

/**
 * 尾巴跟随气泡颜色时用哪个色。
 *
 * 渐变时取**离尾巴最近的那一端**:尾巴多半贴在底部,
 * 取第一个 stop 会得到顶部的颜色,看上去像贴错了。
 */
function flatBubbleColor(cfg) {
    if (cfg.bgMode !== 'gradient') return withAlpha(cfg.bgColor, cfg.bgOpacity);
    const stops = normalizeStops(cfg.gradientStops);
    const last = stops[stops.length - 1];
    return withAlpha(last.color, last.opacity * (cfg.bgOpacity / 100));
}

// ============================================================
// 4) 内置尾巴形状
// ============================================================

/**
 * 内置形状。
 *
 * 全部用 `currentColor` 填充 —— 这样 `tailStyle()` 里设一次 `color`
 * 就能同时管住 fill 和 stroke,不需要把颜色注入 SVG 字符串
 * (注入字符串意味着每次调色都要重新解析一遍 SVG,而且容易注错地方)。
 */
export const TAIL_SHAPES = Object.freeze({
    drop: {
        label: '水滴',
        svg: '<svg viewBox="0 0 20 20"><path d="M20 0 C20 12 12 20 0 20 C10 18 16 12 20 0 Z" fill="currentColor"/></svg>',
    },
    triangle: {
        label: '三角',
        svg: '<svg viewBox="0 0 20 20"><polygon points="0,0 20,0 0,20" fill="currentColor"/></svg>',
    },
    leaf: {
        label: '叶子',
        svg: '<svg viewBox="0 0 20 20"><path d="M0 0 Q20 0 20 20 Q10 14 0 0 Z" fill="currentColor"/></svg>',
    },
    round: {
        label: '圆点',
        svg: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="currentColor"/></svg>',
    },
    cloud: {
        label: '云朵',
        svg: '<svg viewBox="0 0 20 20"><circle cx="6" cy="12" r="5" fill="currentColor"/><circle cx="14" cy="9" r="6" fill="currentColor"/><circle cx="15" cy="15" r="4" fill="currentColor"/></svg>',
    },
    heart: {
        label: '心形',
        svg: '<svg viewBox="0 0 20 20"><path d="M10 18 C2 12 0 8 0 5.5 A5 5 0 0 1 10 4 A5 5 0 0 1 20 5.5 C20 8 18 12 10 18 Z" fill="currentColor"/></svg>',
    },
    star: {
        label: '星星',
        svg: '<svg viewBox="0 0 20 20"><polygon points="10,0 12.5,7 20,7 14,11.5 16.2,19 10,14.5 3.8,19 6,11.5 0,7 7.5,7" fill="currentColor"/></svg>',
    },
    spike: {
        label: '尖角',
        svg: '<svg viewBox="0 0 20 20"><polygon points="0,8 20,10 0,12" fill="currentColor"/></svg>',
    },

/**
 * iOS 经典短信气泡尾巴(双层:灰色描边 + 跟随气泡的填充)。
 *
 * 形状是 QAQ/sms.js 经典主题里那条斜尾巴 —— 描边画完整轮廓,
 * 填充画略内缩的填充形,叠起来就是 iOS 短信气泡的「带线边 + 实心底」。
 *
 * ★ 跟其他预设不同 —— 它是**双层结构**(`border` + `fill` 两份 svg)
 *   而不是单 SVG。原因见 bubble-view.js 模板里的注释:
 *   单 SVG 的话,描边尾巴贴在气泡内侧的那段会被看到 → 出现「气泡边
 *   + 尾巴描边」双线重叠。sms.js 是用三层 z-index 障眼法把这个消除的:
 *     ::before (描边) z-index 1 < .bubble-content z-index 2 < ::after (填充) z-index 3
 *   气泡盒夹在中间 → 把描边尾贴在气泡内侧的那段挡住 → 但填充尾巴仍然能
 *   浮在气泡盒上方,保证尾巴内部颜色正确。
 *   双层结构 + 三层 z-index = 跟 sms.js 1:1 视觉一致。
 *
 * ★ 描边色**写死 `#BCBCBC`**(其它预设用 currentColor 跟气泡走)。
 *   原因:iOS 经典气泡的灰边是 UI 设计的一部分 —— 灰边配白底是 iOS 短信
 *   的标志性长相。填充仍然走 currentColor 跟气泡,这样换色时是「气泡边
 *   + 填充」联动。
 *
 * ★ 默认**只画「右尾巴」**(贴在气泡左下角 → 整体在气泡的右边)。
 *   用户把它放到 `anchor: 'bottom' / along: 0%`(也就是气泡左下角)
 *   并把 `flipX: true` 打开 —— 这是 iOS AI 气泡的样子。
 *   用户气泡那边放在 `along: 100%`(气泡右下角)不翻转就行。
 */
    classic: {
        label: '经典(灰描边)',
        // 双层结构 —— BubbleView 检测到这两个字段会渲染两个 span,
        // 分别带不同的 z-index(描边 z-index:0,填充 z-index:3)
        border:
            '<svg viewBox="0 0 18 14">' +
                '<path d="M1.003,12 L1.003,2.004 C1.003,1.734 1.218,1.512 1.488,1.504 C3.466,1.446 5.152,1.98 6.93,2.43 C9.44,3.065 12.149,3.505 16.283,1.552 C16.438,1.479 16.62,1.49 16.765,1.582 C16.909,1.673 16.997,1.833 16.997,2.004 C16.997,4.657 15.533,6.897 13.326,8.616 C10.124,11.11 5.352,12.5 1.503,12.5 C1.227,12.5 1.003,12.276 1.003,12 ZM1.503,12 C7.751,12 16.497,8.252 16.497,2.004 C9.358,5.377 6.323,1.863 1.503,2.004 L1.503,12 Z" fill="none" stroke="#BCBCBC" stroke-width="1"/>' +
            '</svg>',
        fill:
            '<svg viewBox="0 0 18 14">' +
                '<path d="M1.503,12 c6.248,0 14.994,-3.748 14.994,-9.996 c-7.139,3.373 -10.174,-0.141 -14.994,0 l0,9.996 Z" fill="currentColor"/>' +
            '</svg>',
    },
});

export const TAIL_SHAPE_IDS = Object.freeze(Object.keys(TAIL_SHAPES));

/**
 * 取一条尾巴**最终要渲染的 SVG**(库形状 → 内联 svg → 内置 preset)。
 *
 * 实际渲染需要两份 SVG —— 描边版和填充版 —— 因为 iOS 经典气泡的「尾巴
 * 贴在气泡内那段没描边」效果靠两个独立 span + 三层 z-index 障眼法实现。
 *   .bubble-view-tail.is-stroke  z:0  ← 描边尾巴
 *   .bubble-view-text            z:1  ← 气泡本体,挡掉气泡内的描边尾巴
 *   .bubble-view-tail.is-fill    z:3  ← 填充尾巴,浮在气泡上
 * 任何一条尾巴都渲染两次(分两 span),用 `tailStrokeSvg()` 和
 * `tailFillSvg()` 分别拿描边版/填充版。
 *
 * `tailSvg()` 保留作为**合并版** —— 气泡机面板里画"形状预览" / "形状库"
 * 等**只要 1 个 svg 节点**的地方会用到。
 */
export function tailSvg(tail, shapeLibrary = []) {
    const raw = resolveRawTailSvg(tail, shapeLibrary);
    return applyTailPaint(raw, tail, 'fill');
}

/**
 * 描边版 SVG:用于 `.bubble-view-tail.is-stroke`(z:0,在气泡下)。
 *
 * - 单 fill 形状(预设里没有 `border`/`fill` 拆分的):返回**空填充**
 *   + stroke 继承的 svg —— 浏览器会把整条 path 用描边色画出来,内里透明。
 * - 双层 preset(有 `border` 字段,比如经典尾巴):返回 `preset.border`
 *   那段 path。**不带填充**,所以气泡内那截即使没被气泡盖掉,也不会露出
 *   颜色(只画 stroke)。
 * - 用户 SVG 库 / tail.svg 字段:用其原貌,辅以 `applyTailPaint` 调描边粗细。
 */
export function tailStrokeSvg(tail, shapeLibrary = []) {
    const raw = resolveRawTailSvg(tail, shapeLibrary, 'stroke');
    return applyTailPaint(raw, tail, 'stroke');
}

/**
 * 填充版 SVG:用于 `.bubble-view-tail.is-fill`(z:3,在气泡上)。
 *
 * - 单 fill 形状:用其原 svg —— 已经是 fill currentColor。
 * - 双层 preset:返回 `preset.fill` 那段 path(略内缩,正好嵌在描边里)。
 * - 用户 SVG:同 tailStrokeSvg 一样用原貌。
 */
export function tailFillSvg(tail, shapeLibrary = []) {
    const raw = resolveRawTailSvg(tail, shapeLibrary, 'fill');
    return applyTailPaint(raw, tail, 'fill');
}

/**
 * 解析一条尾巴要画什么 SVG(layer 决定要描边版还是填充版)。
 *
 * layer 传 'stroke' / 'fill'。对**单 fill 形状**(水滴、三角、叶子等):
 *   - stroke 层:把 fill 去掉,改 fill="none" → 让 stroke 看得见
 *   - fill   层:原样
 * 对**双层 preset**(经典尾巴带 `border`/`fill`):
 *   - stroke 层:返回 `border` 那段 path
 *   - fill   层:返回 `fill` 那段 path
 */
function resolveRawTailSvg(tail, shapeLibrary, layer) {
    let raw;
    if (tail.shapeId) {
        const hit = asArray(shapeLibrary).find((s) => String(s.id) === String(tail.shapeId));
        if (hit?.svg) raw = hit.svg;
    }
    if (!raw && tail.svg) raw = tail.svg;
    if (!raw) {
        const preset = TAIL_SHAPES[tail.shape] || TAIL_SHAPES.drop;
        // 双层 preset:按 layer 选 border/fill
        if (preset?.border && preset?.fill) {
            raw = layer === 'stroke' ? preset.border : preset.fill;
        } else {
            raw = preset?.svg || '';
            // 单 fill 形状被要求 stroke 层 → 把 fill 关掉,让 stroke 起作用
            if (layer === 'stroke') raw = swapFillForStroke(raw);
        }
    } else {
        // 用户提供的 svg:同样按需去 fill
        if (layer === 'stroke') raw = swapFillForStroke(raw);
    }
    return raw;
}

/**
 * 把 svg 里所有 fill="currentColor" / fill="#xxx" / fill="none" 都去掉,
 * 让 SVG 用透明填充(浏览器继承 root 的 fill 时,默认是黑色 —— 显式清掉)。
 *
 * 经典尾巴以外的预设(都是 fill currentColor)在描边层 span 上需要透明
 * 填充,否则即使 stroke 起作用,内部也被填上气泡色,等于两个 z-index 上
 * 都画了一份尾巴 → 视觉上气泡内的描边尾巴还是被填充遮住了 → 双层 z-index
 * 障眼法就白做了。
 */
function swapFillForStroke(svg) {
    if (typeof svg !== 'string') return '';
    // 把 fill="currentColor" 这类替换成 fill="none",剩下的 stroke 还在
    return svg.replace(/fill\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, 'fill="none"');
}

/**
 * 给已经消毒过的 SVG 补一层描边设置。
 *
 * layer 决定这次渲染的是「描边版」还是「填充版」:
 *   - 'stroke':用 tail.strokeColor 画描边;若有 own stroke(经典尾巴的
 *               border 段 path),不动颜色只替 stroke-width。
 *   - 'fill'   :默认没描边。如果原 SVG 里有 stroke 属性,移除掉 —— 否则
 *               经典尾巴的 border 段会在填充层也画上一道线。
 *
 * ★ 颜色继续吃 currentColor(走 span 的 color style),不在这里硬编颜色,
 *   这样换气泡主题时一根 span 上的 color 改了,描边 / 填充一起跟着走。
 */
function applyTailPaint(svg, tail, layer = 'fill') {
    const clean = sanitizeSvg(svg);
    if (!clean) return '';
    const hasOwnStroke = /<path[^>]*\bstroke=/.test(clean);
    const hasOwnFill = /<path[^>]*\bfill=/.test(clean);

    if (layer === 'fill') {
        // 填充层:不要描边。如果原 SVG(经典尾巴的 fill 段)有 stroke 属性,移除。
        if (!hasOwnStroke) return clean;
        return clean.replace(/\s+stroke\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    }

    // 描边层
    if (!(tail.strokeWidth > 0)) {
        // 没要求描边,但原 SVG 里有 stroke(经典尾巴 border 段):保留
        if (hasOwnStroke) return clean;
        // 否则要把 fill 关掉,否则浏览器默认黑色填充,会画出个实心尾巴
        if (hasOwnFill) return clean;
        return clean.replace(/<svg\b/i, '<svg fill="none"');
    }
    if (hasOwnStroke) {
        // 经典尾巴 border 段 path:写死了 stroke 颜色(走 stroke="currentColor"
        // 让它跟 span color 联动)。只替 stroke-width。
        const w = Number(tail.strokeWidth) || 0;
        return clean
            .replace(/stroke\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, 'stroke="currentColor"')
            .replace(/stroke-width\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, `stroke-width="${w}"`);
    }
    // 单 fill 形状的描边版:把 fill 改成 none,在根 svg 上加 stroke 颜色 + 宽度
    return clean.replace(
        /^<svg/i,
        `<svg fill="none" stroke="${escapeAttr(tail.strokeColor)}" stroke-width="${Number(tail.strokeWidth) || 0}"`,
    );
}

// ============================================================
// 5) SVG 消毒
// ============================================================

const SVG_TAGS = new Set([
    'svg', 'g', 'defs', 'title', 'desc', 'path', 'rect', 'circle', 'ellipse',
    'line', 'polyline', 'polygon', 'linearGradient', 'radialGradient', 'stop',
    'clipPath', 'mask',
]);

const SVG_ATTRS = new Set([
    'viewbox', 'width', 'height', 'transform', 'd', 'points', 'x', 'y', 'x1', 'y1',
    'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fill', 'fill-rule', 'fill-opacity',
    'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
    'stroke-opacity', 'stroke-miterlimit', 'opacity', 'offset', 'stop-color',
    'stop-opacity', 'gradientunits', 'gradienttransform', 'spreadmethod',
    'clip-path', 'clip-rule', 'mask', 'id', 'preserveaspectratio', 'fx', 'fy',
]);

/**
 * 白名单重建一棵 SVG 树。
 *
 * ★ 用「白名单重建」而不是「删掉危险的东西」:
 *   `<script>` / `onload=` / `href="javascript:"` / `<foreignObject>` 里塞 HTML /
 *   `<use href="//evil">` —— 黑名单永远列不全,而且列漏了完全不报错。
 *
 * ★ 顺带把 `width` / `height` 去掉、补上 `viewBox`:
 *   带死尺寸的 SVG 塞进 16px 的尾巴槽里会溢出;而完全没有尺寸信息时
 *   浏览器按规范画成 300×150,一张卡片直接被撑爆。
 *
 * @returns {string} 消毒后的 SVG;无法解析时返回 ''
 */
export function sanitizeSvg(raw) {
    const src = String(raw || '').trim();
    if (!src) return '';
    if (typeof DOMParser === 'undefined') return '';

    let doc;
    try {
        doc = new DOMParser().parseFromString(src, 'image/svg+xml');
    } catch (_) {
        return '';
    }
    if (!doc || doc.querySelector('parsererror')) return '';
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg') return '';

    const NS = 'http://www.w3.org/2000/svg';
    const out = document.createElementNS(NS, 'svg');

    const viewBox = readViewBox(root);
    out.setAttribute('viewBox', viewBox);
    // 让 CSS 完全掌握尺寸 —— 尾巴槽是多大就画多大
    out.setAttribute('width', '100%');
    out.setAttribute('height', '100%');
    out.setAttribute('preserveAspectRatio', root.getAttribute('preserveAspectRatio') || 'xMidYMid meet');

    for (const child of Array.from(root.childNodes)) {
        const copy = copyNode(child, NS);
        if (copy) out.appendChild(copy);
    }

    if (!out.childNodes.length) return '';
    try {
        return new XMLSerializer().serializeToString(out);
    } catch (_) {
        return '';
    }
}

function copyNode(node, NS) {
    if (node.nodeType === 3) {
        const text = String(node.nodeValue || '');
        return text.trim() ? document.createTextNode(text) : null;
    }
    if (node.nodeType !== 1) return null;

    const tag = node.nodeName;
    if (!SVG_TAGS.has(tag) && !SVG_TAGS.has(tag.toLowerCase())) return null;

    const el = document.createElementNS(NS, tag);
    for (const attr of Array.from(node.attributes || [])) {
        const name = attr.name.toLowerCase();
        if (!SVG_ATTRS.has(name)) continue;
        const value = String(attr.value || '');
        // url(#id) 是合法的(渐变/裁剪),url(http…) 不是 —— 后者能外链追踪
        if (/url\(\s*['"]?(?!#)/i.test(value)) continue;
        if (/javascript:|data:text\/html/i.test(value)) continue;
        el.setAttribute(attr.name, value);
    }
    for (const child of Array.from(node.childNodes)) {
        const copy = copyNode(child, NS);
        if (copy) el.appendChild(copy);
    }
    return el;
}

/** 没写 viewBox 时从 width/height 推一个,都没有就给 24×24 */
function readViewBox(root) {
    const raw = String(root.getAttribute('viewBox') || '').trim();
    if (raw) {
        const parts = raw.split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts.every((n) => Number.isFinite(n)) && parts[2] > 0 && parts[3] > 0) {
            return parts.join(' ');
        }
    }
    const w = parseFloat(root.getAttribute('width'));
    const h = parseFloat(root.getAttribute('height'));
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return `0 0 ${w} ${h}`;
    return '0 0 24 24';
}

/**
 * 统一 SVG 的上色方式:把每个图形自带的 fill / stroke 抹掉,
 * 换成外层 `<g>` 上的一套值。
 *
 * ★ 参考原型(`svg预览.html`)的做法,但修了它两个问题:
 *   1. 原型旋转时用 viewBox 的中心当轴,而没有 viewBox 时用 width/height ——
 *      两者都没有的图会绕 (0,0) 转,直接转出画布。这里统一走 `readViewBox`。
 *   2. 原型的镜像是 `translate(cx*2,0) scale(-1,1)`,写在 rotate 之后,
 *      于是「先转 45° 再镜像」和「先镜像再转 45°」出来的结果不一样,
 *      而 UI 上完全看不出这个顺序。这里固定为「先镜像后旋转」并写在注释里。
 *
 * @param {string} raw     原始 SVG
 * @param {object} opts    { fill, stroke, strokeWidth, opacity, rotation, flipX, flipY }
 * @returns {string} 消毒 + 重新上色后的 SVG
 */
export function repaintSvg(raw, opts = {}) {
    const clean = sanitizeSvg(raw);
    if (!clean) return '';

    let doc;
    try {
        doc = new DOMParser().parseFromString(clean, 'image/svg+xml');
    } catch (_) {
        return clean;
    }
    const root = doc?.documentElement;
    if (!root || doc.querySelector('parsererror')) return clean;

    const NS = 'http://www.w3.org/2000/svg';
    for (const el of Array.from(root.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon'))) {
        el.removeAttribute('fill');
        el.removeAttribute('stroke');
        el.removeAttribute('stroke-width');
        el.removeAttribute('opacity');
    }

    const [minX, minY, w, h] = readViewBox(root).split(' ').map(Number);
    const cx = minX + w / 2;
    const cy = minY + h / 2;

    const g = doc.createElementNS(NS, 'g');
    g.setAttribute('fill', opts.fill || 'none');
    g.setAttribute('stroke', opts.stroke || 'none');
    if (opts.stroke && opts.stroke !== 'none') {
        g.setAttribute('stroke-width', String(num(opts.strokeWidth, 1, 0, 40)));
        g.setAttribute('stroke-linecap', 'round');
        g.setAttribute('stroke-linejoin', 'round');
    }
    g.setAttribute('opacity', String(clamp(num(opts.opacity, 100, 0, 100), 0, 100) / 100));

    // 顺序固定为「先镜像、后旋转」。transform 是从右往左作用的,
    // 所以这里的书写顺序是 rotate 在前
    const t = [];
    const rotation = num(opts.rotation, 0, -360, 360);
    if (rotation) t.push(`rotate(${rotation} ${round(cx, 3)} ${round(cy, 3)})`);
    if (opts.flipX) t.push(`translate(${round(cx * 2, 3)} 0) scale(-1 1)`);
    if (opts.flipY) t.push(`translate(0 ${round(cy * 2, 3)}) scale(1 -1)`);
    if (t.length) g.setAttribute('transform', t.join(' '));

    while (root.firstChild) g.appendChild(root.firstChild);
    root.appendChild(g);

    try {
        return new XMLSerializer().serializeToString(root);
    } catch (_) {
        return clean;
    }
}

// ============================================================
// 6) 导出成可粘贴的文本
// ============================================================

/**
 * 把一个气泡导出成 CSS 片段。
 *
 * 给「想自己抄进别处」的用户用。**不含尾巴** —— 尾巴是绝对定位的独立元素,
 * 一段 CSS 表达不了,导出里会写明这一点而不是悄悄少东西。
 */
export function exportBubbleCss(cfg) {
    const style = bubbleBoxStyle(cfg);
    const lines = Object.entries(style)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `    ${kebab(k)}: ${v};`);
    const tailNote = asArray(cfg.tails).filter((t) => t.enabled).length
        ? '\n/* 这个气泡有尾巴。尾巴是独立的绝对定位元素,复制 CSS 带不走,\n   要一起用的话在情景聊天里选这套气泡。 */'
        : '';
    return `.my-bubble {\n${lines.join('\n')}\n}${tailNote}`;
}

// ============================================================
// 工具
// ============================================================

function asArray(v) {
    return Array.isArray(v) ? v : [];
}

function num(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    if (min !== undefined && max !== undefined) return clamp(n, min, max);
    return n;
}

function str(value, fallback) {
    const s = String(value ?? '').trim();
    return s || fallback;
}

function clamp(n, min, max) {
    return Math.min(max, Math.max(min, Number(n) || 0));
}

function round(n, digits = 2) {
    const p = 10 ** digits;
    return Math.round(n * p) / p;
}

function kebab(key) {
    return key.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function escapeAttr(value) {
    return String(value ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export default {
    createBubbleConfig,
    createTail,
    bubbleBoxStyle,
    bubbleTextStyle,
    bubbleBackground,
    tailStyle,
    tailSvg,
    tailStrokeSvg,
    tailFillSvg,
    sanitizeSvg,
    repaintSvg,
    withAlpha,
    isHexColor,
    exportBubbleCss,
    TAIL_SHAPES,
    TAIL_SHAPE_IDS,
};
