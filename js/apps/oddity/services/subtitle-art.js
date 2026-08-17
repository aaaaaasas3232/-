/**
 * 小奇怪 · 字幕生成器引擎(纯逻辑)
 *
 * ★ 不碰 DOM、不碰 store。进来两个词加一个版式,出去一整块可以直接复制的纯文本。
 *
 * ── 要做的是什么 ──────────────────────────────────────────────────
 *
 * 用户想要的那种「中间一个大词,四周撒一圈同一个小词」的装饰块:
 *
 *     ˡᵒᵛᵉ                   ˡᵒᵛᵉ                  ˡᵒᵛᵉ
 *                 ˡᵒᵛᵉ                    ˡᵒᵛᵉ
 *
 *     ˡᵒᵛᵉ                HER                  ˡᵒᵛᵉ
 *
 *                 ˡᵒᵛᵉ                     ˡᵒᵛᵉ
 *     ˡᵒᵛᵉ                   ˡᵒᵛᵉ                  ˡᵒᵛᵉ
 *
 * 两件事:环绕词转成 Unicode 上标字符,五行错落排版。
 *
 * ── 排版为什么是这几个数 ──────────────────────────────────────────
 *
 * 不是随手填的,是**量着用户给的样例反推**的(详见 constants.js 的
 * SUBTITLE_VARIANTS 注释)。反推出比例之后,换词、换长度、换中文中心词
 * 都按同一套比例算列位,所以不会出现「换个词整块就散了」。
 *
 * ★ 列位一律按**等宽显示宽度**算,不是 `.length`。
 *   中心词填「她」时 length 是 1 但在等宽字体里占 2 格,
 *   按 length 排右边会少空一格,整块肉眼可见地歪。
 */

import { SUBTITLE_VARIANTS, SUBTITLE_DEFAULTS } from '../constants.js';
import { displayWidth } from '../utils.js';

// ============================================================
// 上标映射
// ============================================================

/**
 * Unicode 上标表。
 *
 * ★ 几个字母**根本没有**上标形式,这是 Unicode 的历史遗留不是遗漏:
 *     小写 q  —— 直到 Unicode 14 才有 U+107A5,在补充平面,多数字体不认
 *     大写 Q  —— 至今没有
 *   还有 C / F / S / X / Y / Z 只有小写上标没有大写上标,
 *   这里退化成小写上标(视觉上完全能用)。
 *
 *   真的一个都没有的字符原样保留,并且**告诉用户是哪几个**
 *   —— 悄悄吞掉或者换成问号,用户只会觉得「这个生成器有 bug」。
 */
export const SUPERSCRIPT_MAP = Object.freeze({
    // 小写
    a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ',
    j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ',
    r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ',

    // 大写(有专属上标的)
    A: 'ᴬ', B: 'ᴮ', D: 'ᴰ', E: 'ᴱ', G: 'ᴳ', H: 'ᴴ', I: 'ᴵ', J: 'ᴶ', K: 'ᴷ',
    L: 'ᴸ', M: 'ᴹ', N: 'ᴺ', O: 'ᴼ', P: 'ᴾ', R: 'ᴿ', T: 'ᵀ', U: 'ᵁ', V: 'ⱽ', W: 'ᵂ',

    // 数字
    0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹',

    // 常见标点
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    '.': '·', ',': 'ˏ', ':': '˸', '!': 'ꜝ', '/': 'ᐟ', '_': 'ˍ',
    "'": 'ʼ', '"': 'ʺ',
});

/**
 * 只有小写上标、没有大写上标的那几个字母。
 * 转出来照样好看,但要如实告诉用户「这几个换成小写形态了」。
 */
const UPPER_TO_LOWER_FALLBACK = Object.freeze({
    C: 'ᶜ', F: 'ᶠ', S: 'ˢ', X: 'ˣ', Y: 'ʸ', Z: 'ᶻ',
});

/**
 * 把一个词转成上标形态。
 *
 * @returns {{ text:string, missing:string[], downgraded:string[] }}
 *   `missing`    连近似形态都没有、原样留着的字符(去重,保持出现顺序)
 *   `downgraded` 大写换成了小写上标的字符
 */
export function toSuperscript(word) {
    const src = String(word ?? '');
    const missing = [];
    const downgraded = [];
    let text = '';

    for (const ch of src) {
        if (ch === ' ') { text += ' '; continue; }
        const direct = SUPERSCRIPT_MAP[ch];
        if (direct) { text += direct; continue; }
        const lowered = UPPER_TO_LOWER_FALLBACK[ch];
        if (lowered) {
            text += lowered;
            if (!downgraded.includes(ch)) downgraded.push(ch);
            continue;
        }
        // 真的没有 —— 原样留着,记一笔
        text += ch;
        if (!missing.includes(ch)) missing.push(ch);
    }

    return { text, missing, downgraded };
}

/** 把 missing / downgraded 拼成一句给用户看的话;都没有就返回 '' */
export function describeSubstitutions({ missing = [], downgraded = [] } = {}) {
    const parts = [];
    if (downgraded.length) parts.push(`${downgraded.join(' ')} 没有大写上标,已换成小写形态`);
    if (missing.length) parts.push(`${missing.join(' ')} 没有上标形态,原样保留了`);
    return parts.join(';');
}

// ============================================================
// 排版
// ============================================================

export function getVariant(id) {
    return SUBTITLE_VARIANTS.find((v) => v.id === id) || SUBTITLE_VARIANTS[0];
}

/**
 * 把若干段文字摆到指定列上,拼成一行。
 *
 * 列位按等宽显示宽度算。要摆的列已经被前一段占了(超长词)时,
 * 至少空一格再摆 —— 宁可这一行比设计的宽,也不能让两个词粘在一起。
 */
function placeRow(items) {
    let line = '';
    let cursor = 0;
    for (const item of items) {
        const text = String(item.text ?? '');
        if (!text) continue;
        const target = cursor === 0 && item.col <= 0
            ? 0
            : Math.max(Math.round(item.col), cursor + (cursor > 0 ? 1 : 0));
        line += ' '.repeat(Math.max(0, target - cursor));
        cursor = target + displayWidth(text);
        line += text;
    }
    // 行尾空格复制出去只是噪音
    return line.replace(/\s+$/, '');
}

/**
 * 生成整块。
 *
 * 结构固定是 7 行:外圈 / 内圈 / 空行 / 中心行 / 空行 / 内圈 / 外圈。
 * 上下严格镜像 —— 用户给的两个样例都是这个结构,而且镜像是这类装饰块
 * 唯一能「一眼看出是刻意排的」的特征。
 *
 * @param {object} opts
 * @param {string} opts.surround     环绕词(原文,函数内部转上标)
 * @param {string} opts.center       中心词(保持原样,只按开关决定要不要转大写)
 * @param {string} [opts.variant]    版式 id
 * @param {boolean} [opts.upperCenter]
 * @returns {{ text:string, lines:string[], superscript:string, centerText:string,
 *             missing:string[], downgraded:string[], note:string, variant:object }}
 */
export function buildBlock(opts = {}) {
    const variantId = opts.variant || SUBTITLE_DEFAULTS.variant;
    const variant = getVariant(variantId);

    const rawSurround = String(opts.surround ?? SUBTITLE_DEFAULTS.surround);
    const sup = toSuperscript(rawSurround);
    // 环绕词是空的就退化成一条中心行,而不是画出一堆空行
    const small = sup.text || '';

    let centerText = String(opts.center ?? SUBTITLE_DEFAULTS.center);
    if (opts.upperCenter !== false) centerText = centerText.toUpperCase();

    const width = variant.width;
    const smallW = displayWidth(small);
    const centerW = displayWidth(centerText);

    // 外圈:左贴边 / 居中 / 右贴边
    const outerCols = [0, Math.round((width - smallW) / 2), Math.max(0, width - smallW)];
    // 内圈:两个词落在外圈三个词的空档里(比例见 constants.js)
    const innerCols = variant.insetRatios.map((ratio) => Math.round(width * ratio));
    // 中心行比外圈窄一点,样例里就是这样 —— 中间那行不顶到最外沿
    const centerWidth = Math.max(smallW * 2 + centerW + 4, width - variant.centerTrim);
    const centerCols = [
        0,
        Math.round((centerWidth - centerW) / 2),
        Math.max(0, centerWidth - smallW),
    ];

    const rowOuter = small
        ? placeRow(outerCols.map((col) => ({ text: small, col })))
        : '';
    const rowInner = small
        ? placeRow(innerCols.map((col) => ({ text: small, col })))
        : '';
    const rowCenter = placeRow([
        { text: small, col: centerCols[0] },
        { text: centerText, col: centerCols[1] },
        { text: small, col: centerCols[2] },
    ]);

    const lines = [rowOuter, rowInner, '', rowCenter, '', rowInner, rowOuter];

    return {
        text: lines.join('\n'),
        lines,
        superscript: small,
        centerText,
        missing: sup.missing,
        downgraded: sup.downgraded,
        note: describeSubstitutions(sup),
        variant,
    };
}

/**
 * 给收藏用的一行摘要。
 * 直接存整块正文太长,列表里只显示这一行。
 */
export function summarize(record) {
    const small = String(record?.surround || '').trim();
    const center = String(record?.center || '').trim();
    return [small, center].filter(Boolean).join(' · ') || '未命名';
}
