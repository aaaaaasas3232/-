/**
 * 手书 · 效果预设库
 *
 * ============================================================
 * 一、一个预设是什么
 * ============================================================
 *
 * 是一条**数据记录**,不是一段代码。它由两个正交的维度组成:
 *
 *   base   动起来的方式  → CSS `@keyframes hs-kf-<base>`
 *   paint  长什么样      → 描边 / 发光 / 叠影 / 错位 / 模糊 / 光标
 *
 * 再加一组数值参数(时长、幅度、逐字延迟、附加色),
 * 全部以 CSS 自定义属性的形式挂到舞台元素上。
 *
 * ★ 为什么要拆成「base + paint + 参数」而不是「一个预设一段 CSS」:
 *   用户要能**自己加预设**。如果预设是 CSS 片段,那就得让用户写 CSS
 *   并且把它注入样式表 —— 既不安全,也不是这个 App 的用户会做的事。
 *   拆成有限枚举 + 数值之后,「新建预设」变成了填一张表单,
 *   而所有可能的产物在编译期就已经被 CSS 覆盖到了。
 *
 * ★ 因此:**新增 base / paint 必须同时改 `css/apps/handwrite/index.css`。**
 *   只加这边的表现是:预设能建、能选、能存,舞台上纹丝不动,而且不报错。
 *
 * ============================================================
 * 二、和脚本解析器的约定
 * ============================================================
 *
 * `services/script-parser.js` 里的 `EFFECT_ALIAS` 把中文效果名映射到这里的 id。
 * 两边的 id 必须一一对应。内置预设的 id 发布后不要改 ——
 * 用户的企划里存的是 id。
 */

// ============================================================
// 枚举
// ============================================================

/** 动的方式。id 对应 CSS 里的 `@keyframes hs-kf-<id>`(none 除外) */
export const EFFECT_BASES = Object.freeze([
    { id: 'none', label: '不动', desc: '只上静态描画' },
    { id: 'shake', label: '抖动', desc: '左右上下小幅乱颤' },
    { id: 'breathe', label: '呼吸', desc: '透明度和大小缓慢起伏' },
    { id: 'fade-in', label: '渐显', desc: '从透明到实心' },
    { id: 'fade-out', label: '渐隐', desc: '从实心到透明' },
    { id: 'float-up', label: '上浮', desc: '从下方浮上来' },
    { id: 'sink-down', label: '下沉', desc: '从上方沉下去' },
    { id: 'glitch', label: '故障', desc: '不规则横向撕裂' },
    { id: 'blink', label: '闪烁', desc: '硬切的亮灭' },
    { id: 'scale-pulse', label: '缩放脉冲', desc: '一下一下地放大缩小' },
    { id: 'pop-in', label: '弹入', desc: '从小弹到正常大小' },
    { id: 'slide-left', label: '左滑', desc: '整体从右侧滑进来' },
    { id: 'blur-focus', label: '模糊聚焦', desc: '从虚到实' },
]);

/** 静态描画。id 对应 CSS 里的 `.hs-fx--paint-<id>` */
export const EFFECT_PAINTS = Object.freeze([
    { id: 'none', label: '无', desc: '保持文字原样' },
    { id: 'outline', label: '描边', desc: '空心字,只留轮廓' },
    { id: 'glow', label: '发光', desc: '字周围一圈辉光' },
    { id: 'ghost', label: '叠影', desc: '背后压一层半透明的自己' },
    { id: 'stack', label: '错位叠加', desc: '红蓝双影错开一点' },
    { id: 'blur', label: '模糊', desc: '整体虚化' },
    { id: 'caret', label: '光标', desc: '末尾跟一个方块光标' },
]);

export const EFFECT_BASE_IDS = Object.freeze(EFFECT_BASES.map((b) => b.id));
export const EFFECT_PAINT_IDS = Object.freeze(EFFECT_PAINTS.map((p) => p.id));

/** 预设分类,效果库面板按它分组 */
export const EFFECT_CATEGORIES = Object.freeze([
    { id: 'motion', label: '动态' },
    { id: 'entrance', label: '出入场' },
    { id: 'paint', label: '描画' },
    { id: 'custom', label: '我的预设' },
]);

// ============================================================
// 内置预设
// ============================================================

function preset(id, name, desc, category, patch) {
    return Object.freeze({
        id,
        name,
        desc,
        category,
        builtin: true,
        base: 'none',
        paint: 'none',
        duration: 700,
        easing: 'ease-in-out',
        /** 'infinite' 或次数 */
        iteration: 1,
        /** 幅度倍率,CSS 里乘在位移/缩放上 */
        amount: 1,
        /** 逐字错开(整行统一动 = false) */
        perChar: false,
        /** 逐字延迟步长(ms),perChar 为 true 时才有意义 */
        delayStep: 0,
        /** 附加色。空 = 跟随文字颜色 */
        ink: '',
        createdAt: 0,
        ...patch,
    });
}

/**
 * 十八套常用预设。
 *
 * 挑选原则:手书 / 歌词视频里真正高频出现的那些。
 * 不做「一百种花式动画」—— 预设太多用户根本挑不动,
 * 真正需要变化的是**参数**,而参数是可以自己调的。
 */
export const BUILTIN_EFFECTS = Object.freeze([
    preset('fx-shake', '抖动', '字轻轻发颤,像忍着什么', 'motion', {
        base: 'shake', duration: 320, iteration: 'infinite', easing: 'linear', amount: 1,
    }),
    preset('fx-shake-hard', '剧烈抖动', '崩溃感,配合大字号更明显', 'motion', {
        base: 'shake', duration: 130, iteration: 'infinite', easing: 'linear', amount: 2.6,
    }),
    preset('fx-breathe', '呼吸', '缓慢起伏,适合长停顿', 'motion', {
        base: 'breathe', duration: 2600, iteration: 'infinite', easing: 'ease-in-out', amount: 1,
    }),
    preset('fx-blink', '闪烁', '硬切的亮灭,不安定', 'motion', {
        base: 'blink', duration: 700, iteration: 'infinite', easing: 'steps(1, end)',
    }),
    preset('fx-scale-pulse', '缩放脉冲', '一下一下地强调', 'motion', {
        base: 'scale-pulse', duration: 1400, iteration: 'infinite', easing: 'ease-in-out', amount: 1,
    }),
    preset('fx-glitch', '故障', '横向撕裂,搭配错位叠加最像', 'motion', {
        base: 'glitch', paint: 'stack', duration: 900, iteration: 'infinite', easing: 'steps(3, end)', amount: 1.2,
    }),

    preset('fx-fade-in', '渐显', '从无到有,最稳的开场', 'entrance', {
        base: 'fade-in', duration: 700, iteration: 1, easing: 'ease-out',
    }),
    preset('fx-fade-out', '渐隐', '收尾用,配合【停顿】', 'entrance', {
        base: 'fade-out', duration: 900, iteration: 1, easing: 'ease-in',
    }),
    preset('fx-float-up', '上浮', '从下方浮上来', 'entrance', {
        base: 'float-up', duration: 800, iteration: 1, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', amount: 1,
    }),
    preset('fx-sink-down', '下沉', '从上方沉下去,句子变重', 'entrance', {
        base: 'sink-down', duration: 800, iteration: 1, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', amount: 1,
    }),
    preset('fx-pop-in', '逐字弹入', '一个字一个字蹦出来', 'entrance', {
        base: 'pop-in', duration: 420, iteration: 1, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        perChar: true, delayStep: 55, amount: 1,
    }),
    preset('fx-slide-left', '整行左滑', '整句从右边推进来', 'entrance', {
        base: 'slide-left', duration: 700, iteration: 1, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', amount: 1,
    }),
    preset('fx-blur-focus', '模糊聚焦', '从看不清到看清', 'entrance', {
        base: 'blur-focus', duration: 900, iteration: 1, easing: 'ease-out', amount: 1,
    }),

    preset('fx-outline', '描边', '空心字,底下的背景透出来', 'paint', {
        base: 'none', paint: 'outline', duration: 0, iteration: 1,
    }),
    preset('fx-glow', '发光', '字边一圈辉光', 'paint', {
        base: 'none', paint: 'glow', duration: 0, iteration: 1, amount: 1,
    }),
    preset('fx-ghost', '叠影', '背后压一层半透明的自己', 'paint', {
        base: 'none', paint: 'ghost', duration: 0, iteration: 1, amount: 1,
    }),
    preset('fx-offset-stack', '错位叠加', '红蓝双影错开,印刷套色没对准的感觉', 'paint', {
        base: 'none', paint: 'stack', duration: 0, iteration: 1, amount: 1,
    }),
    preset('fx-caret', '打字光标', '末尾跟一个闪的方块', 'paint', {
        base: 'none', paint: 'caret', duration: 900, iteration: 'infinite', easing: 'steps(1, end)',
    }),
]);

export const BUILTIN_EFFECT_IDS = Object.freeze(BUILTIN_EFFECTS.map((e) => e.id));

// ============================================================
// 归一化 / 新建
// ============================================================

function pickEnum(value, allowed, fallback) {
    const v = String(value || '');
    return allowed.includes(v) ? v : fallback;
}

function num(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

/**
 * 校验缓动函数。
 *
 * 这个值会进 inline style 的 `animation-timing-function`。
 * 只放行关键字和 cubic-bezier / steps 两种函数形式 ——
 * 别的一律退回 ease,不给任意字符串进 style 的机会。
 */
function safeEasing(raw) {
    const v = String(raw || '').trim();
    if (/^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end)$/i.test(v)) return v;
    if (/^cubic-bezier\(\s*[-\d.\s,]+\)$/i.test(v)) return v;
    if (/^steps\(\s*\d+\s*(,\s*(start|end|jump-[a-z]+)\s*)?\)$/i.test(v)) return v;
    return 'ease-in-out';
}

function safeInk(raw) {
    const v = String(raw || '').trim();
    if (!v) return '';
    if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
    if (/^rgba?\(\s*[\d.\s,%/]+\)$/i.test(v)) return v;
    if (/^hsla?\(\s*[\d.\s,%/deg]+\)$/i.test(v)) return v;
    if (/^[a-z]{3,20}$/i.test(v)) return v;
    return '';
}

export function normalizeEffect(raw = {}, { builtin = false } = {}) {
    const iterationRaw = raw.iteration;
    const iteration = iterationRaw === 'infinite' || iterationRaw === Infinity
        ? 'infinite'
        : num(iterationRaw, 1, 99, 1);
    return {
        id: String(raw.id || ''),
        name: String(raw.name || '未命名预设').slice(0, 20),
        desc: String(raw.desc || '').slice(0, 60),
        category: builtin ? pickEnum(raw.category, ['motion', 'entrance', 'paint'], 'motion') : 'custom',
        builtin: builtin === true,
        base: pickEnum(raw.base, EFFECT_BASE_IDS, 'none'),
        paint: pickEnum(raw.paint, EFFECT_PAINT_IDS, 'none'),
        duration: Math.round(num(raw.duration, 0, 20000, 700)),
        easing: safeEasing(raw.easing),
        iteration,
        amount: num(raw.amount, 0, 6, 1),
        perChar: raw.perChar === true,
        delayStep: Math.round(num(raw.delayStep, 0, 600, 0)),
        ink: safeInk(raw.ink),
        createdAt: Math.round(num(raw.createdAt, 0, Number.MAX_SAFE_INTEGER, 0)),
    };
}

/** 新建一条用户预设(默认从「抖动」起步,免得一进来是一片空白看不出效果) */
export function createUserEffect(patch = {}) {
    return normalizeEffect({
        base: 'shake',
        paint: 'none',
        duration: 400,
        easing: 'ease-in-out',
        iteration: 'infinite',
        amount: 1,
        perChar: false,
        delayStep: 0,
        createdAt: Date.now(),
        ...patch,
    }, { builtin: false });
}

// ============================================================
// 查找 / 落地
// ============================================================

/** 内置 + 用户自建,内置在前 */
export function allEffects(userEffects) {
    const custom = (Array.isArray(userEffects) ? userEffects : [])
        .map((e) => normalizeEffect(e, { builtin: false }))
        .filter((e) => e.id);
    return [...BUILTIN_EFFECTS, ...custom];
}

export function findEffect(userEffects, id) {
    if (!id) return null;
    return allEffects(userEffects).find((e) => String(e.id) === String(id)) || null;
}

export function effectName(userEffects, id) {
    return findEffect(userEffects, id)?.name || '';
}

/**
 * 把一个预设翻译成挂在元素上的 class 列表。
 *
 * ★ 只返回**枚举出来的**类名 —— 用户输入永远不会变成类名的一部分,
 *   所以这里不需要转义,也不可能被注入。
 */
export function effectClasses(effect) {
    if (!effect) return [];
    const out = ['hs-fx'];
    if (effect.base && effect.base !== 'none') out.push(`hs-fx--${effect.base}`);
    if (effect.paint && effect.paint !== 'none') out.push(`hs-fx--paint-${effect.paint}`);
    if (effect.perChar) out.push('hs-fx--per-char');
    return out;
}

/**
 * 把一个预设翻译成 CSS 自定义属性。
 *
 * 数值全部经过 `normalizeEffect` 的夹取,`ink` / `easing` 各有白名单 ——
 * 这三样是唯一会从用户输入流进 style 的东西。
 */
export function effectVars(effect) {
    if (!effect) return {};
    const vars = {
        '--hs-fx-dur': `${effect.duration}ms`,
        '--hs-fx-ease': effect.easing,
        '--hs-fx-iter': String(effect.iteration),
        '--hs-fx-amount': String(effect.amount),
        '--hs-fx-step': `${effect.delayStep}ms`,
    };
    if (effect.ink) vars['--hs-fx-ink'] = effect.ink;
    return vars;
}

/**
 * 把同时生效的多个预设合成舞台要的分层结构。
 *
 * ★ 为什么要分层:一个元素只能有一份 `animation-name`。
 *   「抖动 + 渐显」如果都往同一个 span 上挂,后定义的那条规则会把前一条整个盖掉,
 *   表现是「勾了两个效果只有一个在动」,而且不报错。
 *   所以舞台是两层嵌套的 div,一层一个动画,叠出来的变换自然相乘。
 *
 * 逐字类(perChar)的动画必须挂在**每个字**上而不是外层,单独拿出来。
 * 静态描画(描边 / 发光 / 叠影)只影响文字本身,累加到文字 span 上。
 *
 * @returns {{ wrapLayers:Array, charLayer:object|null, paintClasses:string[], paintVars:object }}
 */
export function composeEffects(effects) {
    const list = (Array.isArray(effects) ? effects : []).filter(Boolean);
    const wrapLayers = [];
    let charLayer = null;
    const paintClasses = new Set();
    let paintVars = {};

    for (const fx of list) {
        if (fx.paint && fx.paint !== 'none') {
            paintClasses.add(`hs-fx--paint-${fx.paint}`);
            paintVars = { ...paintVars, ...effectVars(fx) };
        }
        if (!fx.base || fx.base === 'none') continue;
        const layer = { classes: ['hs-fx', `hs-fx--${fx.base}`], vars: effectVars(fx) };
        if (fx.perChar) {
            if (!charLayer) {
                layer.classes.push('hs-fx--per-char');
                charLayer = layer;
            }
        } else if (wrapLayers.length < 2) {
            wrapLayers.push(layer);
        }
    }

    return { wrapLayers, charLayer, paintClasses: [...paintClasses], paintVars };
}

export default {
    BUILTIN_EFFECTS, EFFECT_BASES, EFFECT_PAINTS, EFFECT_CATEGORIES,
    normalizeEffect, createUserEffect, allEffects, findEffect,
    effectClasses, effectVars, composeEffects,
};
