/**
 * relax-app / 「我的捏捏」提示词生成器 + AI 回复拆分器
 *
 * ============================================================
 * 这不是一段固定文案
 * ============================================================
 * 以前编辑器里挂的是一整段写死的说明,不管用户想做气泡纸还是便签纸,
 * 读到的都是同一屏字。问题跟 app-maker 当年一样:
 * 80% 的段落跟这次要做的东西无关,AI 的注意力被稀释,
 * 真正的硬约束(占位符、:scope、只写一格)反而被淹掉。
 *
 * 这里改成 **按蓝图裁剪** —— 用户在页面上勾了什么,提示词里才有对应章节。
 * 写法参考 `js/apps/app-maker/survey/prompt.js`(分章 + 末尾自查清单)。
 *
 * ★ 本文件必须纯函数 + 零 DOM
 *   页面(Vue)和回归脚本(node)共用它,不能碰 window / document。
 *   (下面 import 的 toy-parts.js 只取两张冻结的表,那个文件在顶层也不碰 DOM。)
 *
 * ★ 提示词里的技术契约必须和 `toys/custom-html-board.js` 一字不差
 *   粘回来的代码是要真跑的:占位符名、CSS 变量名、状态类名写错一个,
 *   用户拿到的就是「贴进去没反应」。改主体的时候记得回来同步这里。
 *
 * ★ 两种布局模式,两份契约
 *   格子模式:「只写一格,板子复制 N 份」;
 *   自由模式:「整块画一个东西,交互靠 data-hb 零件」。
 *   两份契约的硬约束完全不同,混着发给 AI 一定会写出跑不动的代码,
 *   所以 buildCustomToyPrompt 是**整段分叉**的,不是在同一段里加几句话。
 */

import { TOY_PART_GUIDE, TOY_PART_ATTRS } from './toy-parts.js';

// ★ 消毒 / 体检跟提示词是同一套契约的两面(说清楚 + 拦住),
//   页面只 import 这一个 service,别在组件里各拉各的。
export {
    sanitizeToyHtml,
    sanitizeToyCss,
    sanitizeToyTemplate,
    validateToyTemplate,
    validateToyCode,
    escapeToyText,
    MAX_TOY_HTML_LEN,
    MAX_TOY_HTML_LEN_FREE,
    MAX_TOY_CSS_LEN,
    MAX_TOY_JS_LEN,
} from './toy-sanitizer.js';

// 零件速查表(自由模式)。编辑页的「零件速查」和下面的提示词读的是同一份。
export { TOY_PART_GUIDE, TOY_PART_ATTRS };

// ============================================================
// 蓝图(问卷答案)
// ============================================================

/** 形态 */
export const TOY_SHAPES = Object.freeze([
    { id: 'bubble', label: '气泡', desc: '鼓起来的圆' },
    { id: 'block', label: '方块', desc: '方的、有厚度' },
    { id: 'disc', label: '圆片', desc: '扁平的圆' },
    { id: 'blob', label: '不规则', desc: '手捏的歪形状' },
    { id: 'custom', label: '自己说', desc: '下面写清楚' },
]);

/** 触感 */
export const TOY_FEELS = Object.freeze([
    { id: 'bouncy', label: '软弹', desc: '压下去会回弹' },
    { id: 'crisp', label: '脆', desc: '一下就破' },
    { id: 'sticky', label: '黏', desc: '慢慢拉丝' },
    { id: 'sandy', label: '沙', desc: '散开、没有回弹' },
]);

/** 配色倾向 */
export const TOY_PALETTES = Object.freeze([
    { id: 'theme', label: '跟随主题色', desc: '用 --htmlbubble-tint' },
    { id: 'warm', label: '暖', desc: '奶油 / 蜜桃 / 焦糖' },
    { id: 'cool', label: '冷', desc: '薄荷 / 天蓝 / 雾紫' },
    { id: 'contrast', label: '高对比', desc: '重色 + 亮边' },
    { id: 'muted', label: '低饱和', desc: '灰调、安静' },
    { id: 'custom', label: '自己说', desc: '下面写清楚' },
]);

/** 动画强度 */
export const TOY_MOTIONS = Object.freeze([
    { id: 'none', label: '不要动画', desc: '只换样子' },
    { id: 'soft', label: '很轻', desc: '一点点缩放' },
    { id: 'normal', label: '正常', desc: '有弹性' },
    { id: 'lively', label: '夸张', desc: '大幅形变' },
]);

/**
 * 「哪些地方要能动」—— 只有自由模式用得上。
 * ★ id 必须是 toy-parts.js 认识的零件类型,提示词会照着 id 去查 TOY_PART_GUIDE。
 */
export const TOY_MOVES = Object.freeze(
    TOY_PART_GUIDE.map(item => ({ id: item.type, label: item.label, desc: item.gesture })),
);

/** 布局模式。三档自由度递增,契约完全不同。 */
export const TOY_LAYOUTS = Object.freeze([
    { id: 'grid', label: '格子板', desc: '一格重复铺满,气泡纸那种' },
    { id: 'free', label: '自由做', desc: '整块画一个,摇杆、鼠标那种' },
    { id: 'code', label: '写代码', desc: '连 JS 一起写,想做什么做什么' },
]);

const SHAPE_IDS = TOY_SHAPES.map(item => item.id);
const FEEL_IDS = TOY_FEELS.map(item => item.id);
const PALETTE_IDS = TOY_PALETTES.map(item => item.id);
const MOTION_IDS = TOY_MOTIONS.map(item => item.id);
const MOVE_IDS = TOY_MOVES.map(item => item.id);

/** 布局模式规整。存档里只可能是这三个值,别的一律当格子。 */
export function normalizeToyLayout(value) {
    if (value === 'free') return 'free';
    if (value === 'code') return 'code';
    return 'grid';
}

/** 自由文本上限。提示词是要整段复制走的,不能让一个字段撑爆。 */
const MAX_FREE_TEXT = 120;

/**
 * 把任意来源(老存档 / 用户输入 / 预设)规整成完整蓝图。
 * ★ 老版本的 toyState 里没有 blueprint 这个字段,走这里会拿到一份默认值,
 *   html / css 不受影响 —— 升级上来的用户不会掉存档。
 */
export function normalizeToyBlueprint(raw) {
    const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    return {
        idea: clampText(src.idea),
        shape: pickId(src.shape, SHAPE_IDS, 'bubble'),
        shapeCustom: clampText(src.shapeCustom),
        feel: pickId(src.feel, FEEL_IDS, 'bouncy'),
        palette: pickId(src.palette, PALETTE_IDS, 'theme'),
        paletteCustom: clampText(src.paletteCustom),
        pressChange: src.pressChange !== false,
        oneShot: src.oneShot === true,
        withText: src.withText === true,
        textSample: clampText(src.textSample, 24),
        decorated: src.decorated !== false,
        motion: pickId(src.motion, MOTION_IDS, 'normal'),
        darkAware: src.darkAware === true,
        // 自由模式专用:要哪几种零件。格子模式下这一项不参与提示词。
        moves: pickIds(src.moves, MOVE_IDS, ['press']),
    };
}

/** 空白蓝图 */
export function createToyBlueprint() {
    return normalizeToyBlueprint(null);
}

/**
 * 内置预设:一下填满问卷。
 * 挑的是差别最大的手感,而不是几种颜色 —— 颜色用户自己会改,手感不好想。
 *
 * ★ 每条都带 layout。点预设会**顺手把页面切到对应的布局模式** ——
 *   在格子模式下选「摇杆」却还按「只写一格」出提示词,拿回来的代码一定是废的。
 */
export const TOY_BLUEPRINT_PRESETS = Object.freeze([
    {
        id: 'bubble-wrap',
        name: '气泡纸',
        desc: '按一下瘪掉,不会复原',
        layout: 'grid',
        blueprint: {
            idea: '一整版气泡纸,按下去啵一声就瘪了',
            shape: 'bubble', feel: 'crisp', palette: 'theme',
            pressChange: true, oneShot: true, withText: false,
            decorated: true, motion: 'normal', darkAware: false,
        },
    },
    {
        id: 'choco',
        name: '巧克力块',
        desc: '掰一块,断面露出来',
        layout: 'grid',
        blueprint: {
            idea: '一整排巧克力,按下去像被掰断,露出里面的夹心',
            shape: 'block', feel: 'crisp', palette: 'warm',
            pressChange: true, oneShot: true, withText: false,
            decorated: true, motion: 'normal', darkAware: false,
        },
    },
    {
        id: 'jelly-cube',
        name: '果冻方糖',
        desc: '压扁再弹回来',
        layout: 'grid',
        blueprint: {
            idea: '半透明的果冻方糖,压下去会变扁再弹回来,可以一直捏',
            shape: 'block', feel: 'bouncy', palette: 'cool',
            pressChange: true, oneShot: false, withText: false,
            decorated: true, motion: 'lively', darkAware: false,
        },
    },
    {
        id: 'sticky-note',
        name: '便签纸',
        desc: '一格一张,上面有字',
        layout: 'grid',
        blueprint: {
            idea: '一叠便签纸,每张上面写一个字,按下去像被揭走',
            shape: 'block', feel: 'sandy', palette: 'muted',
            pressChange: true, oneShot: true, withText: true, textSample: '深呼吸',
            decorated: false, motion: 'soft', darkAware: true,
        },
    },
    // ── 下面四条是自由模式的 ────────────────────────────────
    {
        id: 'joystick',
        name: '摇杆',
        desc: '拖着走,松手弹回中间',
        layout: 'free',
        blueprint: {
            idea: '一根街机摇杆,底座是磨砂黑,帽子是彩色的,拖到哪它就歪到哪,松手弹回中间',
            shape: 'disc', feel: 'bouncy', palette: 'theme',
            moves: ['stick'],
            pressChange: true, oneShot: false, withText: false,
            decorated: true, motion: 'normal', darkAware: false,
        },
    },
    {
        id: 'mouse',
        name: '鼠标',
        desc: '左右键分开按,滚轮能滚',
        layout: 'free',
        blueprint: {
            idea: '一只圆头鼠标,左键右键各按各的,中间的滚轮能一直往下滚,底下还有个会亮的指示灯',
            shape: 'blob', feel: 'crisp', palette: 'theme',
            moves: ['press', 'slide'],
            pressChange: true, oneShot: false, withText: false,
            decorated: true, motion: 'soft', darkAware: false,
        },
    },
    {
        id: 'knob-panel',
        name: '旋钮台',
        desc: '转起来一格一格地咔',
        layout: 'free',
        blueprint: {
            idea: '一个金属质感的音量旋钮,周围一圈刻度,转起来一格一格地咔,转到头就转不动了',
            shape: 'disc', feel: 'crisp', palette: 'muted',
            moves: ['dial'],
            pressChange: false, oneShot: false, withText: false,
            decorated: true, motion: 'soft', darkAware: false,
        },
    },
    {
        id: 'control-box',
        name: '控制盒',
        desc: '拨杆 + 推子 + 大按钮',
        layout: 'free',
        blueprint: {
            idea: '一块深色控制面板,上面有几个拨动开关、一根推子和一颗按住会一直响的大红按钮,全部拨上去顶上的灯就亮了',
            shape: 'block', feel: 'crisp', palette: 'contrast',
            moves: ['toggle', 'slide', 'press'],
            pressChange: true, oneShot: false, withText: false,
            decorated: true, motion: 'soft', darkAware: false,
        },
    },
    // ── 下面四条要写 JS(沙箱模式)────────────────────────
    // ★ 挑的都是「不写 JS 就做不出来」的:有物理、有随机、有累积状态。
    //   放几个 free 模式也能做的例子,用户读完还是不知道这一档多了什么。
    {
        id: 'toss',
        name: '甩着玩',
        desc: '抓起来甩出去,会撞墙回弹',
        layout: 'code',
        blueprint: {
            idea: '一颗能抓起来甩出去的球,有重力,撞到边会弹回来,越撞越慢,撞的时候啪一声',
            shape: 'bubble', feel: 'bouncy', palette: 'theme',
            pressChange: true, oneShot: false, withText: false,
            decorated: true, motion: 'normal', darkAware: false,
        },
    },
    {
        id: 'draw',
        name: '跟手画',
        desc: '手指划到哪画到哪,能存下来',
        layout: 'code',
        blueprint: {
            idea: '一块画板,手指划到哪就画到哪,画的时候沙沙响,画完的东西下次打开还在,角落有个擦掉的按钮',
            shape: 'block', feel: 'sticky', palette: 'theme',
            pressChange: true, oneShot: true, withText: false,
            decorated: false, motion: 'soft', darkAware: false,
        },
    },
    {
        id: 'wheel',
        name: '转盘',
        desc: '拨一下自己转,慢慢停下',
        layout: 'code',
        blueprint: {
            idea: '一个分成几格的转盘,手指拨一下它就自己转起来,越转越慢最后停在某一格,经过每一格咔一声,停下时报出停在哪格',
            shape: 'disc', feel: 'crisp', palette: 'contrast',
            pressChange: true, oneShot: true, withText: true, textSample: '休息一下',
            decorated: true, motion: 'lively', darkAware: false,
        },
    },
    {
        id: 'tank',
        name: '小鱼缸',
        desc: '几条鱼自己游,点一下会散开',
        layout: 'code',
        blueprint: {
            idea: '一个小鱼缸,几条鱼自己慢慢游来游去,碰到缸壁会转向,手指点哪儿鱼就往哪儿聚过来,吓一下会四散',
            shape: 'blob', feel: 'bouncy', palette: 'cool',
            pressChange: true, oneShot: false, withText: false,
            decorated: true, motion: 'normal', darkAware: true,
        },
    },
]);

function pickId(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
}

/** 多选:滤掉不认识的、去重、空了就退回默认 */
function pickIds(value, allowed, fallback) {
    if (!Array.isArray(value)) return fallback.slice();
    const out = [];
    for (const item of value) {
        if (allowed.includes(item) && !out.includes(item)) out.push(item);
    }
    return out.length ? out : fallback.slice();
}

function clampText(value, max = MAX_FREE_TEXT) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, max);
}

function labelOf(list, id) {
    return list.find(item => item.id === id)?.label || '';
}

function clampGridValue(value, fallback) {
    const num = Math.floor(Number(value));
    if (!Number.isFinite(num)) return fallback;
    return Math.min(12, Math.max(2, num));
}

// ============================================================
// 提示词
// ============================================================

const HR = '\n---\n';
const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

/**
 * 章节编号器。裁剪之后编号必须是连续的 ——
 * 留一堆「三、(空)」的空洞,AI 会以为自己漏读了什么。
 */
function createSectionCounter() {
    let n = 0;
    return function section(title, body) {
        if (!body) return '';
        n += 1;
        const prefix = CN_NUM[n - 1] || String(n);
        return `\n## ${prefix}、${title}\n\n${body}\n`;
    };
}

function bullets(list) {
    return list.filter(Boolean).map(line => `- ${line}`).join('\n');
}

/**
 * 按蓝图生成一份「给 AI 的说明书」。
 *
 * @param {object} blueprint 问卷答案(会先过 normalizeToyBlueprint)
 * @param {{ rows?: number, cols?: number, layout?: 'grid'|'free' }} [options]
 *        rows/cols 是格子模式下用户真实配置的行列;layout 不传按格子走。
 * @returns {string}
 */
export function buildCustomToyPrompt(blueprint, options = {}) {
    const bp = normalizeToyBlueprint(blueprint);
    const layout = normalizeToyLayout(options.layout);
    if (layout === 'code') return buildCodePrompt(bp);
    if (layout === 'free') return buildFreePrompt(bp);
    return buildGridPrompt(bp, clampGridValue(options.rows, 4), clampGridValue(options.cols, 4));
}

// ------------------------------------------------------------
// 格子模式
// ------------------------------------------------------------

function buildGridPrompt(bp, rows, cols) {
    const section = createSectionCounter();

    const parts = [
        partIntro(),
        HR,
        section('我想要的东西', partWant(bp, rows, cols)),
        section('必须遵守的技术契约', partContract(rows, cols)),
        section('按下时要有什么变化', bp.pressChange ? partPress(bp) : ''),
        section('「用掉了」的一次性效果', bp.oneShot ? partOneShot(bp) : ''),
        section('格子里的文字', bp.withText ? partText(bp) : ''),
        section('渐变 / 阴影 / 描边', bp.decorated ? partDecor(bp) : ''),
        section('动画', bp.motion === 'none' ? '' : partMotion(bp, false)),
        section('深浅色适配', bp.darkAware ? partDark() : ''),
        HR,
        section('输出格式(这条最重要)', partOutput('.my-cell')),
        HR,
        `## 自查清单\n\n${buildToyChecklist(bp, rows, cols)}`,
    ];

    return parts.filter(Boolean).join('\n').replace(/\n{4,}/g, '\n\n\n');
}

// ------------------------------------------------------------
// 自由模式
// ------------------------------------------------------------

function buildFreePrompt(bp) {
    const section = createSectionCounter();

    const parts = [
        partIntroFree(),
        HR,
        section('我想要的东西', partWantFree(bp)),
        section('必须遵守的技术契约', partContractFree()),
        section('这次要用到的零件,以及它们该怎么写', partMovesFree(bp)),
        section('按下 / 拨动时要有什么变化', bp.pressChange ? partPressFree(bp) : ''),
        section('「用掉了」的一次性效果', bp.oneShot ? partOneShotFree() : ''),
        section('上面的文字', bp.withText ? partTextFree(bp) : ''),
        section('渐变 / 阴影 / 描边', bp.decorated ? partDecor(bp) : ''),
        section('动画', bp.motion === 'none' ? '' : partMotion(bp, true)),
        section('深浅色适配', bp.darkAware ? partDark() : ''),
        HR,
        section('输出格式(这条最重要)', partOutput('.my-toy')),
        HR,
        `## 自查清单\n\n${buildFreeChecklist(bp)}`,
    ];

    return parts.filter(Boolean).join('\n').replace(/\n{4,}/g, '\n\n\n');
}

function partIntroFree() {
    return `你是一个擅长用纯 CSS 做手感的前端。

我在一个叫「解压角」的小程序里做**自定义捏捏**。这次不是做一板重复的小格子,是在屏幕中央的一块**正方形区域**里,画出**一整个可以玩的小物件** —— 比如一根摇杆、一只鼠标、一个旋钮、一块控制面板。

这个物件的不同部位可以各干各的:这块能按、那块能拖、中间那个能转。**手势由小程序负责,你只要在元素上打一个标记,再用 CSS 把它画出来、让它跟着变。**

这不是做网页,是做一个能反复上手玩、摸上去有反馈的东西。手感比信息密度重要。`;
}

function partWantFree(bp) {
    const shapeText = bp.shape === 'custom'
        ? (bp.shapeCustom || '(没写清楚,你按「想做的东西」那句自己定)')
        : `${labelOf(TOY_SHAPES, bp.shape)}(${TOY_SHAPES.find(s => s.id === bp.shape)?.desc || ''})`;
    const paletteText = bp.palette === 'custom'
        ? (bp.paletteCustom || '(没写清楚,你自己配一套协调的)')
        : `${labelOf(TOY_PALETTES, bp.palette)}(${TOY_PALETTES.find(p => p.id === bp.palette)?.desc || ''})`;
    const moveText = bp.moves
        .map(id => `${labelOf(TOY_MOVES, id)}(${TOY_MOVES.find(m => m.id === id)?.desc || ''})`)
        .join('、');

    const lines = [
        bp.idea ? `**想做的东西**:${bp.idea}` : '**想做的东西**:用户没写,你按下面这些条件自己定一个,别做成空白方块。',
        `**整体形态**:${shapeText}`,
        `**触感**:${labelOf(TOY_FEELS, bp.feel)}(${TOY_FEELS.find(f => f.id === bp.feel)?.desc || ''})`,
        `**配色**:${paletteText}`,
        `**要能动的地方**:${moveText}`,
        '**画布**:一块正方形区域。短边的像素长度在 CSS 里能取到,就是 `var(--hb-unit)`。',
    ];

    if (bp.palette === 'theme') {
        lines.push('配色跟随主题色的意思是:主色一律从 `var(--htmlbubble-tint)` 取,不要写死颜色。用户在「捏捏」面板里换色时,你做的东西要跟着变。');
    }

    return bullets(lines);
}

function partContractFree() {
    return `下面每一条都是这个小程序**真实的运行方式**,写错了贴进去就是不动 / 不显示,而且不会报错。

**1. 整块只画一个东西,不会被复制。**
你输出的 HTML 会**原样放进舞台一次**。不要写「重复 16 个」,也不要用 \`{row}\` \`{col}\` \`{index}\` 这类占位符 —— 那是格子模式的东西,在这里会被换成 0。

**2. 外面只有一个空壳。**
真实结构是这样的(外层不用你写):

\`\`\`
<div class="hbfree-stage">
    ← 你写的 HTML 整段放在这里
</div>
\`\`\`

这个壳是 \`display: grid; place-items: center\` 的方形区域,**没有背景、没有边框、没有内边距**。所以你的根元素直接就会居中;想铺满就写 \`width:100%; height:100%\`。

**3. 交互靠 \`data-hb\`,不要写 JavaScript。**
\`<script>\`、\`onclick=\` 这些会在应用时被直接删掉。想让某一块能按 / 能拖,就在**那个元素**上加一个 \`data-hb="..."\`。小程序会接管它的指针事件,把结果写成 CSS 自定义属性和状态类,剩下的全靠你的 CSS。

**4. 变量都是纯数字,用的时候自己乘单位。**
\`--hb-deg\` 的值是 \`42\` 而不是 \`42deg\`。要转就写 \`rotate(calc(var(--hb-deg) * 1deg))\`,要位移就写 \`translateX(calc(var(--hb-x) * 50%))\`。
读的时候**永远带兜底值**:\`var(--hb-x, 0)\`。第一帧变量还没写进去,不带兜底整个 \`calc\` 会失效。

**5. 变量写在零件自己身上,另外在整块上镜像一份。**
- 零件自己和它的**子元素**:直接用 \`var(--hb-x)\`。
- 零件的**兄弟元素 / 外面的壳**:用镜像名 \`var(--hb-<你起的id>-x)\`。
  比如 \`data-id="left"\` 的按钮被按下时,任何地方都能读到 \`var(--hb-left)\`(0 或 1)——
  鼠标底下那颗「按左键就亮」的灯就是这么做的。

**6. 给每个零件起个 \`data-id\`。**
存档按这个名字对号入座(开关拨到哪、推子推到哪,下次打开还在),镜像变量也用它。不写的话会自动按 DOM 顺序编号,以后你一改结构,用户的存档就全错位了。

**7. CSS 会被包进一层作用域。**
你写的 CSS 原样塞进一个只作用于这块区域的壳里,所以:
- **不要**输出 \`<style>\` 标签,只给 CSS 正文。
- **不要**写 \`html\` / \`body\` / \`:root\` / \`*\` 开头的选择器,也不要碰 \`.app-\` \`.rx-\` \`.ac-\` 开头的类名 —— 那是外面的界面,会被拦掉。
- **不要**用多余的 \`}\` 提前把作用域闭合掉,那样写出来的东西一样会被拦掉。
- 类名自己起,建议带个短前缀避免撞车,比如 \`.my-\`。

**8. 尺寸从 \`var(--hb-unit)\` 算,不要写死 px。**
\`--hb-unit\` 是这块区域短边的像素数(手机上大约 260~320)。写 \`width: calc(var(--hb-unit, 280px) * .7)\` 这样的算式,换个屏幕才不会撑破或者缩成一团。
纯百分比也不安全:区域不一定是正方形,\`width:70%\` 和 \`height:70%\` 会把圆拉成蛋。

**9. 可以直接用的其他变量。**

| 变量 | 是什么 |
|---|---|
| \`--htmlbubble-tint\` | 用户选的主题色。想跟着换色就用它 |
| \`--rx-toy-tint\` | 同上,外层的那一份,兜底用 |
| \`--hb-unit\` | 这块区域的短边长度(带 px) |
| \`--rx-ease-bounce\` | 全局的弹性缓动曲线,做回弹用它 |

\`color-mix(in srgb, var(--htmlbubble-tint) 60%, white)\` 可以用。

**10. 压在零件上面的装饰,必须写 \`pointer-events: none\`。**
高光层、刻度层、中缝这类「只是好看」的元素,如果盖在能按的零件上面,会把手指挡住 —— 表现是「这块怎么按都没反应」。这是自由模式最容易踩的坑,画一层就顺手加一句。

**11. 不能有的东西。**
\`<script>\` / \`<style>\` / \`<iframe>\` / \`<object>\` / \`<embed>\` / \`<link>\` / \`<meta>\`、行内的 \`onclick=\` 之类、\`javascript:\` 链接、CSS 里的 \`@import\`。

**12. 不要引外部资源。**
没有网络图片、没有外部字体、没有 \`url(https://...)\`。要图形就用 CSS 渐变或者内联 \`<svg>\`。`;
}

/** 零件示例。★ 每段都是能直接跑的最小可用写法,别写伪代码。 */
const MOVE_SNIPPETS = Object.freeze({
    press: `\`\`\`html
<span class="my-key" data-hb="press" data-id="key1" data-release></span>
\`\`\`

\`\`\`css
.my-key {
    /* --hb-p 按住是 1,松开是 0 */
    transform: translateY(calc(var(--hb-p, 0) * 3px));
    filter: brightness(calc(1 - var(--hb-p, 0) * .12));
    transition: transform .09s ease, filter .09s ease;
}
/* 也可以直接用状态类,两种写法都行 */
.my-key.is-press { box-shadow: inset 0 3px 8px rgba(0,0,0,.35); }
\`\`\`

加 \`data-hold\` 可以让「按住不放」一直出声一直震;加 \`data-once\` 就变成一次性的,按过之后永久带上 \`is-popped\`(会存档)。`,

    toggle: `\`\`\`html
<span class="my-sw" data-hb="toggle" data-id="power"><i></i></span>
\`\`\`

\`\`\`css
.my-sw { position: relative; }
.my-sw i {
    position: absolute;
    left: 8%; right: 8%; height: 42%;
    top: 52%;                       /* 关:在下面 */
    transition: top .2s var(--rx-ease-bounce);
}
.my-sw.is-on i { top: 6%; }         /* 开:拨上去 */
\`\`\`

开关状态会存档,下次打开还是拨着的。`,

    stick: `\`\`\`html
<div class="my-base" data-hb="stick" data-id="stick" data-step="8">
    <span class="my-knob"></span>
</div>
\`\`\`

\`\`\`css
.my-base { position: relative; }
.my-knob {
    position: absolute;
    left: 50%; top: 50%;
    width: 46%; height: 46%;
    margin: -23% 0 0 -23%;
    /* --hb-x / --hb-y 是 -1 ~ 1,乘个百分比就是能走多远 */
    transform: translate(calc(var(--hb-x, 0) * 50%), calc(var(--hb-y, 0) * 50%));
    transition: transform .36s var(--rx-ease-bounce);
    pointer-events: none;
}
/* ★ 拖动中必须关掉过渡,否则手指走一步、帽子晚半拍 */
.my-base.is-active .my-knob { transition: none; }
\`\`\`

三件事一定要做对:
- \`data-hb="stick"\` 打在**底座**上(能抓的范围就是它),不是打在帽子上。
- 帽子和所有装饰层都要 \`pointer-events: none\`,否则手指抓的是帽子,一拖就丢。
- **松手会自动回到 0,0**,回弹靠上面那句 \`transition\`,不用你写 \`@keyframes\`。

另外还能拿到 \`--hb-dist\`(离中心多远,0~1)和 \`--hb-deg\`(方向角度)。`,

    slide: `\`\`\`html
<span class="my-wheel"
      data-hb="slide" data-id="wheel" data-axis="y"
      data-wrap data-gain="0.35" data-step="0.12"></span>
\`\`\`

\`\`\`css
.my-wheel {
    background: repeating-linear-gradient(180deg, #6a6070 0 3px, #423b4a 3px 6px);
    /* 齿纹一格 6px,一整程走 24px = 4 格,配 data-wrap 首尾正好接得上 */
    background-position-y: calc(var(--hb-y, 0) * -24px);
}
\`\`\`

- \`--hb-x\` / \`--hb-y\` 是 **0 ~ 1**,和屏幕坐标同向:0 在左边 / 上边,往右 / 往下拖变大。
- \`data-axis\` 选方向(\`x\` / \`y\` / \`xy\`),不写是两个方向都能拖。
- \`data-wrap\` 让它拖到头从另一头绕回来 —— 滚轮要靠它才能一直滚。
- \`data-gain\` 调灵敏度。**零件很小的时候一定要调小**:默认是「拖过自己一个身长 = 走完整程」,一个 20px 高的滚轮不调就是一碰到底。
- 还能拿到 \`--hb-scroll\`:不夹不绕的累计行程,可正可负。`,

    dial: `\`\`\`html
<div class="my-dial"
     data-hb="dial" data-id="vol"
     data-step="15" data-min="-150" data-max="150"></div>
\`\`\`

\`\`\`css
.my-dial {
    /* --hb-deg 是累计角度,纯数字,自己乘 1deg */
    transform: rotate(calc(var(--hb-deg, 0) * 1deg));
    transition: transform .08s linear;
}
.my-dial.is-active { transition: none; }
\`\`\`

- 手指绕着零件中心转,\`--hb-deg\` 就跟着累加,能一直转下去。
- \`data-min\` / \`data-max\` 限位(单位是度),不写就无限转。
- \`data-step="15"\` 每 15 度咔一下,旋钮的手感基本靠它。
- 还能拿到 \`--hb-turn\`(转了几圈,\`--hb-deg / 360\`)。`,
});

function partMovesFree(bp) {
    const guide = TOY_PART_GUIDE.filter(item => bp.moves.includes(item.type));
    if (!guide.length) return '';

    const table = [
        '| 标记 | 是什么 | 手势 | 会拿到的变量 | 会加的类 |',
        '|---|---|---|---|---|',
        ...guide.map(item => `| \`data-hb="${item.type}"\` | ${item.label} | ${item.gesture} | ${item.vars} | ${item.classes} |`),
    ].join('\n');

    const attrs = [
        '| 属性 | 作用 |',
        '|---|---|',
        ...TOY_PART_ATTRS.map(item => `| \`${item.attr}\` | ${item.desc} |`),
    ].join('\n');

    const blocks = guide.map(item => `### \`data-hb="${item.type}"\` —— ${item.label}\n\n${item.desc}\n\n${MOVE_SNIPPETS[item.type] || ''}`);

    return `这次只需要下面这几种零件。**没列出来的不要用**,用了也不会动。

${table}

一个零件可以在整块里出现多次(比如鼠标的左键和右键都是 \`press\`),只要 \`data-id\` 各不相同就行。

${blocks.join('\n\n')}

### 可以搭配的附加属性

${attrs}`;
}

function partPressFree(bp) {
    const feelHint = {
        bouncy: '软弹:先压扁(横向变宽、纵向变矮),再弹回来一点点过冲,用 `var(--rx-ease-bounce)`。',
        crisp: '脆:不要慢慢变形,要「一下子」—— 短促、幅度大、然后停住,可以配一道高光闪一下。',
        sticky: '黏:慢一点,回弹要拖尾,可以让形状回来得比颜色慢。',
        sandy: '沙:几乎不回弹,按下去就塌了,靠透明度和位移表现「散掉」。',
    }[bp.feel];

    return `用户要求动的时候有反馈。

- ${feelHint}
- 变化要**看得出来**。只改 2% 的亮度等于没做。
- 用 \`transform\`、\`opacity\`、\`filter\` 做变化,不要改 \`width\` / \`height\` / \`margin\` / \`box-shadow\`(那些会触发重排,拖动时每帧都在动会掉帧)。
- 拖动类的零件(摇杆 / 滑块 / 旋钮)在 \`is-active\` 期间**必须关掉 transition**,否则跟不上手指。松手之后再让 transition 生效,回弹才顺。
- 除了被按的那一块,整体也可以有点反应 —— 比如摇杆歪的时候底座跟着倾一点,靠镜像变量做。`;
}

function partOneShotFree() {
    return `用户要「用掉 / 戳破」这种一次性效果。给对应的 \`data-hb="press"\` 零件加上 \`data-once\`,它被按过之后就会永久带上 \`is-popped\`(存档,下次打开还在)。

- \`.你的零件.is-popped { ... }\` 是「已经用掉」的样子。
- 用过和没用过必须**一眼分得出来**:形状、颜色、阴影至少变两样。只降透明度不够。
- 这个状态是长期的,别在上面挂无限循环动画。
- 不要试图自己「恢复」,恢复由界面上的「恢复主体」按钮负责。`;
}

// ------------------------------------------------------------
// 写代码模式(沙箱)
// ------------------------------------------------------------

function buildCodePrompt(bp) {
    const section = createSectionCounter();

    const parts = [
        partIntroCode(),
        HR,
        section('我想要的东西', partWantCode(bp)),
        section('运行环境(这段决定了代码能不能跑)', partContractCode()),
        section('hb —— 和外面说话的唯一通道', partBridgeCode()),
        section('手感', bp.pressChange ? partPressCode(bp) : ''),
        section('要记住状态', bp.oneShot ? partOneShotCode() : ''),
        section('渐变 / 阴影 / 描边', bp.decorated ? partDecor(bp) : ''),
        section('动画', bp.motion === 'none' ? '' : partMotion(bp, true)),
        section('深浅色适配', bp.darkAware ? partDark() : ''),
        HR,
        section('输出格式(这条最重要)', partOutputCode()),
        HR,
        `## 自查清单\n\n${buildCodeChecklist(bp)}`,
    ];

    return parts.filter(Boolean).join('\n').replace(/\n{4,}/g, '\n\n\n');
}

function partIntroCode() {
    return `你是一个擅长用原生 Web 技术做手感的前端。

我在一个叫「解压角」的小程序里做**自定义捏捏**:屏幕中央有一块**正方形画布**,我要在里面放一个能反复上手玩的小东西。

这次 **HTML / CSS / JavaScript 三样都由你写**,没有框架、没有构建、没有依赖 —— 就是原生三件套。代码会跑在一个隔离的沙箱页面里,你在里面爱怎么写怎么写。

这不是做网页,是做一个摸上去有反馈、越玩越舒服的玩具。手感比信息密度重要。`;
}

function partWantCode(bp) {
    const shapeText = bp.shape === 'custom'
        ? (bp.shapeCustom || '(没写清楚,你按「想做的东西」那句自己定)')
        : `${labelOf(TOY_SHAPES, bp.shape)}(${TOY_SHAPES.find(s => s.id === bp.shape)?.desc || ''})`;
    const paletteText = bp.palette === 'custom'
        ? (bp.paletteCustom || '(没写清楚,你自己配一套协调的)')
        : `${labelOf(TOY_PALETTES, bp.palette)}(${TOY_PALETTES.find(p => p.id === bp.palette)?.desc || ''})`;

    const lines = [
        bp.idea ? `**想做的东西**:${bp.idea}` : '**想做的东西**:用户没写,你自己定一个能玩起来的,别做成静态图。',
        `**整体形态**:${shapeText}`,
        `**触感**:${labelOf(TOY_FEELS, bp.feel)}(${TOY_FEELS.find(f => f.id === bp.feel)?.desc || ''})`,
        `**配色**:${paletteText}`,
        '**画布**:一块正方形区域,大约 260~320 像素见方。真实尺寸随时能从 `hb.width` / `hb.height` 拿到。',
    ];

    if (bp.palette === 'theme') {
        lines.push('配色跟随主题色的意思是:主色一律用 `var(--tint)`(CSS 里)或者 `hb.tint`(JS 里),不要写死颜色。用户换色时你的东西要跟着变。');
    }

    return bullets(lines);
}

function partContractCode() {
    return `你的代码跑在一个 \`<iframe sandbox="allow-scripts">\` 里。它是个**独立的页面**,和外面的小程序不同源。这带来几条硬约束:

**1. 结构固定,只有一个容器。**
沙箱页面长这样(外层不用你写):

\`\`\`
<body>
  <div id="stage">  ← 你的 HTML 放在这里,也就是 hb.el
  </div>
</body>
\`\`\`

\`#stage\` 已经是 \`position: relative\`、铺满整个画布、\`display: grid; place-items: center\`。
\`html, body\` 已经清零边距、\`overflow: hidden\`、背景透明、\`touch-action: none\`、禁掉了长按选词和点击高亮。**这些不用你再写一遍。**

**2. 完全上不了网。**
沙箱的 CSP 是 \`connect-src 'none'\`、\`img-src data: blob:\`。所以:
- **不能** \`fetch\` / \`XMLHttpRequest\` / \`WebSocket\` / 动态 \`import()\`
- **不能**引外部图片、外部字体、CDN 上的任何库(没有 jQuery、没有 three.js、没有 lodash)
- 要图形就用 CSS 渐变、内联 \`<svg>\`、或者 \`<canvas>\` 自己画

**3. 碰不到外面。**
\`parent\`、\`top\`、\`localStorage\`、\`document.cookie\` 要么读不到要么是空的。**要出声、要震动、要存档,只能走 \`hb\`**(下一节)。

**4. 绝对不要写死循环。**
沙箱和界面共用一个线程。\`while (true)\` 或者 \`for(;;)\` 会把**整个 App 卡死**,用户只能杀掉重开。
需要持续动画就用 \`requestAnimationFrame\`,需要定时就用 \`setTimeout\` / \`setInterval\`。

**5. 可以用的 API 就是原生浏览器那一套。**
DOM、CSS、\`<canvas>\` 2D、\`requestAnimationFrame\`、\`Pointer Events\`、\`Web Animations\`、\`ResizeObserver\`、\`Math\`、\`performance.now()\` —— 全都有,随便用。ES6+ 语法也没问题。

**6. 用 Pointer Events,不要用 mouse / touch。**
\`pointerdown\` / \`pointermove\` / \`pointerup\` 一套通吃鼠标和手指。拖拽记得配 \`setPointerCapture\`,不然手指划出元素就断了。

**7. 尺寸别写死 px。**
画布大小随手机变。用百分比、\`aspect-ratio\`,或者 CSS 里的 \`var(--hb-unit)\`(画布短边长度,已经带 px)、JS 里的 \`hb.unit\`。
用 canvas 的话记得乘 \`devicePixelRatio\`,并且在 \`hb.on('resize', ...)\` 里重新设置 \`canvas.width/height\`,否则会糊。`;
}

function partBridgeCode() {
    return `沙箱里有一个全局对象 \`hb\`,这是**唯一**能和小程序本体说话的东西。

| 写法 | 作用 |
|---|---|
| \`hb.el\` | 你的容器(就是 \`#stage\`),DOM 挂它上面 |
| \`hb.width\` / \`hb.height\` | 画布当前像素尺寸 |
| \`hb.unit\` | 画布短边长度,按比例算尺寸时用 |
| \`hb.tint\` | 用户选的主题色(hex 字符串) |
| \`hb.sound({ rate })\` | 播一次用户在「音声」里选的音。\`rate\` 是音调,1 是原声,大了变尖 |
| \`hb.haptic('light' \\| 'medium' \\| 'heavy')\` | 震动 |
| \`hb.notify(标题, 内容)\` | 走手机顶部的灵动岛提示。**别频繁调**,一次玩法里最多一两次 |
| \`hb.state\` | 存档对象。**一进来就有值**,直接读 |
| \`hb.save({ 键: 值 })\` | 写存档(浅合并,自动防抖)。只能存 JSON 存得下的东西 |
| \`hb.on('resize', fn)\` | 画布尺寸变了(手机旋转、用户调缩放) |
| \`hb.on('tint', fn)\` | 用户换了主题色,参数是新的 hex |

CSS 里另外有 \`var(--tint)\`(= 主题色)和 \`var(--hb-unit)\`(= 画布短边)。

**关于声音**:一秒最多放 24 声,超了会被丢掉 —— 所以别在每一帧里都调 \`hb.sound()\`,只在「真的发生了什么」的时候响(撞墙、扣上、越过一格)。

**关于存档**:\`hb.state\` 一开始是 \`{}\`(第一次玩)或者上次存的东西。典型写法:

\`\`\`js
var score = hb.state.score || 0;
// ……玩法……
hb.save({ score: score });
\`\`\``;
}

function partPressCode(bp) {
    const feelHint = {
        bouncy: '软弹:压下去先变扁(横向变宽、纵向变矮),回来时过冲一点点再稳住。',
        crisp: '脆:不要慢慢变形,要「一下子」—— 短促、幅度大、然后停住。',
        sticky: '黏:慢一点,回弹拖尾,形状回来得比颜色慢。',
        sandy: '沙:几乎不回弹,按下去就塌了,靠透明度和位移表现散掉。',
    }[bp.feel];

    return `这东西被碰的时候要有明显反馈。

- ${feelHint}
- 视觉、声音、震动**三样一起给**。只有画面动、不出声不震,手感会薄一大截。
- 变化要看得出来。只改 2% 的亮度等于没做。
- 动画只动 \`transform\` / \`opacity\` / \`filter\`。改 \`width\` / \`height\` / \`top\` / \`left\` 会触发重排,拖动时每帧都在动会掉帧。
- 跟手的部分(拖动中的位置)直接写 \`transform\`,**不要**加 \`transition\` —— 加了就跟不上手指。松手之后的回弹才用 \`transition\`。`;
}

function partOneShotCode() {
    return `这东西要记住玩到哪儿了(分数、开关状态、摆放位置之类)。

- 进来时从 \`hb.state\` 读,记得给默认值:\`var n = hb.state.count || 0;\`
- 变了就 \`hb.save({ count: n })\`。它自带防抖,可以放心在事件里调。
- 只能存 JSON 存得下的东西 —— 函数、DOM 节点、Canvas 对象都存不进去。
- 存的量控制住(几 KB 以内)。要存一串轨迹点的话记得设上限,超了就丢最老的。
- 用户点界面上的「恢复主体」时,存档会被清空、你的代码会**整个重新跑一遍** —— 所以不用自己写复位逻辑,但也**不要**把状态藏在存档之外的地方。`;
}

function partOutputCode() {
    return `只输出三段代码:一段 HTML、一段 CSS、一段 JS,**不要解释、不要总结、不要写使用说明**。格式就是这样:

\`\`\`html
<div class="my-toy"></div>
\`\`\`

\`\`\`css
.my-toy {
    width: 60%;
    aspect-ratio: 1;
    ...
}
\`\`\`

\`\`\`js
var el = hb.el.querySelector('.my-toy');
el.addEventListener('pointerdown', function () {
    hb.sound({ rate: 1.1 });
    hb.haptic('light');
});
\`\`\`

三段都要有(HTML 那段可以很短,甚至只有一个容器,剩下的用 JS 建也行)。
HTML 不要包 \`<html>\` \`<body>\`,CSS 不要包 \`<style>\`,JS 不要包 \`<script>\`。`;
}

function buildCodeChecklist(bp) {
    const items = [
        '**没有** `while(true)` / `for(;;)`,持续动画用的是 `requestAnimationFrame`',
        '没有 `fetch` / `XMLHttpRequest` / `import()`,没有外部图片、字体、CDN 库',
        '没有读 `parent` / `top` / `localStorage`',
        '出声用 `hb.sound()`、震动用 `hb.haptic()`,不是自己 new Audio',
        '声音只在「真的发生了什么」时响,没有每帧都调',
        '交互用的是 pointer 事件,拖拽配了 `setPointerCapture`',
        '尺寸没写死 px,是按百分比 / `hb.unit` / `var(--hb-unit)` 算的',
        '监听了 `hb.on(\'resize\')`,画布变大变小都不会错位',
        '三段代码都给了,而且 HTML 不含 `<style>` / `<script>`',
    ];

    if (bp.palette === 'theme') items.push('主色来自 `hb.tint` / `var(--tint)`,并且监听了 `hb.on(\'tint\')`');
    if (bp.oneShot) items.push('状态从 `hb.state` 读、用 `hb.save()` 写,存的量在几 KB 以内');
    if (bp.pressChange) items.push('碰到的时候画面、声音、震动三样都有反应');
    if (bp.withText) items.push('字号是按 `hb.unit` 算的,不会溢出画布');
    if (bp.motion !== 'none') items.push('动画只动 `transform` / `opacity` / `filter`');
    if (bp.darkAware) items.push('深色背景下描边和高光仍然看得见');
    if (bp.decorated) items.push('高光在左上、内阴影在右下,光源方向统一');
    items.push('用 canvas 的话,乘了 `devicePixelRatio`,并且在 resize 时重设了尺寸');
    items.push('输出只有三段代码,没有多余的文字说明');

    return items.map(item => `- [ ] ${item}`).join('\n');
}

function partTextFree(bp) {
    const sample = bp.textSample || '(用户没指定内容,你自己定一个短词)';
    return `上面要有文字。

- 要显示的内容:${sample}
- 字号跟着区域走:用 \`calc(var(--hb-unit, 280px) * .05)\` 这类算法,**不要**写死 \`font-size: 14px\`。
- 加一句 \`overflow: hidden\` 兜底,字长了也不会顶破。
- 字体不要外链,用 \`font-family: inherit\` 或者系统字体栈。
- 文字层如果压在能按的零件上面,记得 \`pointer-events: none\`。`;
}

function partIntro() {
    return `你是一个擅长用纯 CSS 做手感的前端。

我在一个叫「解压角」的小程序里做**自定义捏捏**:屏幕中央是一块板子,板子被切成行 × 列个格子,每一格都是一个可以按的小东西。我现在要你写出**其中一格**的 HTML 和 CSS。

这不是做网页,是做一个能反复按着玩、按下去有反馈的小玩意。手感比信息密度重要。`;
}

function partWant(bp, rows, cols) {
    const shapeText = bp.shape === 'custom'
        ? (bp.shapeCustom || '(没写清楚,你按「想做的东西」那句自己定)')
        : `${labelOf(TOY_SHAPES, bp.shape)}(${TOY_SHAPES.find(s => s.id === bp.shape)?.desc || ''})`;
    const paletteText = bp.palette === 'custom'
        ? (bp.paletteCustom || '(没写清楚,你自己配一套协调的)')
        : `${labelOf(TOY_PALETTES, bp.palette)}(${TOY_PALETTES.find(p => p.id === bp.palette)?.desc || ''})`;

    const lines = [
        bp.idea ? `**想做的东西**:${bp.idea}` : '**想做的东西**:用户没写,你按下面这些条件自己定一个,别做成空白方块。',
        `**形态**:${shapeText}`,
        `**触感**:${labelOf(TOY_FEELS, bp.feel)}(${TOY_FEELS.find(f => f.id === bp.feel)?.desc || ''})`,
        `**配色**:${paletteText}`,
        `**板子规格**:${rows} 行 × ${cols} 列,一共 ${rows * cols} 格`,
    ];

    if (bp.palette === 'theme') {
        lines.push('配色跟随主题色的意思是:主色一律从 `var(--htmlbubble-tint)` 取,不要写死颜色。用户在「捏捏」面板里换色时,你的格子要跟着变。');
    }

    return bullets(lines);
}

function partContract(rows, cols) {
    return `下面每一条都是这个小程序**真实的运行方式**,写错了贴进去就是不动 / 不显示,而且不会报错。

**1. 你只写一格。**
板子会把你这段 HTML 复制 ${rows * cols} 份,每格一份。所以不要写 grid / flex 去排 ${rows}×${cols},也不要写「第几个格子长什么样」的循环。你的根元素就是**一格**,它的宽高由外面给,直接 \`width:100%; height:100%\` 就行。

**2. 每格外面已经有一个按钮壳。**
真实结构是这样的(外层不用你写):

\`\`\`
<button class="htmlbubble-host" data-index="0" data-row="0" data-col="0">
    ← 你写的 HTML 放在这里
</button>
\`\`\`

\`.htmlbubble-host\` 已经处理了点击、按下音效、震动,并且是 \`position: relative\`。你要绝对定位就直接 \`position:absolute\`,参照系就是这一格。

**3. 四个占位符。**
HTML 里写下面这四个记号,展开的时候会被换成当前格的数字:

| 记号 | 换成什么 |
|---|---|
| \`{row}\` | 当前格在第几行(从 0 开始) |
| \`{col}\` | 当前格在第几列(从 0 开始) |
| \`{index}\` | 当前格的序号(0 到 ${rows * cols - 1}) |
| \`{total}\` | 总格数(${rows * cols}) |

只有这四个。写 \`{i}\` / \`{n}\` / \`{{row}}\` 都不会被替换,会原样显示出来。
它们是**纯文本替换**,可以放进属性里,比如 \`style="--i:{index}"\`,也可以直接当内容显示。

**4. CSS 会被包进一层作用域。**
你写的 CSS 原样塞进一个只作用于这块板的壳里,所以:
- **不要**输出 \`<style>\` 标签,只给 CSS 正文。
- **不要**写 \`html\` / \`body\` / \`:root\` / \`*\` 开头的选择器,也不要碰 \`.app-\` \`.rx-\` \`.ac-\` 开头的类名 —— 那是外面的界面,会被拦掉。
- **不要**用多余的 \`}\` 提前把作用域闭合掉,那样写出来的东西一样会被拦掉。
- 类名自己起,建议带个前缀避免和别人撞,比如 \`.my-\`。

**5. 可以直接用的 CSS 变量(都已经设好了,取就行)。**

| 变量 | 是什么 |
|---|---|
| \`--htmlbubble-tint\` | 用户选的主题色。想跟着换色就用它 |
| \`--rx-toy-tint\` | 同上,主体外层的那一份,兜底用 |
| \`--bubble-skew\` | 这一格的随机倾斜角(每格不同,做手工感) |
| \`--bubble-round\` | 这一格的随机不规则圆角(每格不同) |
| \`--bubble-unit\` | 单格的基准边长(px),想按尺寸算字号时用 |
| \`--rx-ease-bounce\` | 全局的弹性缓动曲线,做回弹动画用它 |

\`color-mix(in srgb, var(--htmlbubble-tint) 60%, white)\` 这种写法可以用,但要在后面补一条不带 \`color-mix\` 的兜底,老 iOS 不认。

**6. 两个状态类。**
按钮壳会被加上这两个类,你的样式挂在它们下面:

- \`.htmlbubble-host.is-squish\` —— 按下的那一瞬间加上,动画跑完不会自己去掉,靠动画本身收尾。
- \`.htmlbubble-host.is-popped\` —— 这一格「已经被用过」的长期状态,会存档,下次打开还在。

写法是 \`.htmlbubble-host.is-popped .my-cell { ... }\`,不是 \`.my-cell.is-popped\`。

**7. 不能有的东西。**
\`<script>\` / \`<style>\` / \`<iframe>\` / \`<object>\` / \`<embed>\` / \`<link>\` / \`<meta>\`、行内的 \`onclick=\` 之类、\`javascript:\` 链接、CSS 里的 \`@import\` —— 这些会在应用的时候被直接删掉,写了等于白写。要交互只能靠 CSS 的 \`:active\` 和上面那两个状态类。

**8. 不要引外部资源。**
没有网络图片、没有外部字体、没有 \`url(https://...)\`。要图形就用 CSS 渐变或者内联 \`<svg>\`。`;
}

function partPress(bp) {
    const feelHint = {
        bouncy: '软弹:先压扁(横向变宽、纵向变矮),再弹回来一点点过冲,用 `var(--rx-ease-bounce)`。',
        crisp: '脆:不要慢慢变形,要「一下子」—— 短促、幅度大、然后停住,可以配一道裂纹或者高光闪一下。',
        sticky: '黏:慢一点,回弹要拖尾,可以让形状回来得比颜色慢,做出「拉丝」的感觉。',
        sandy: '沙:几乎不回弹,按下去就塌了,靠透明度和位移表现「散掉」。',
    }[bp.feel];

    return `用户要求按下去有变化。按下的那一瞬间,\`.htmlbubble-host\` 上会加 \`is-squish\` 这个类。

- ${feelHint}
- 变化要**看得出来**。只改 2% 的亮度等于没做。
- 用 \`transform\` 和 \`opacity\` 做形变,不要改 \`width\` / \`height\` / \`margin\`(那会触发重排,一次按十几格会掉帧)。
- 如果你在 \`transform\` 里用了 \`rotate\`,记得把 \`var(--bubble-skew)\` 也带上,否则每格的随机倾斜会在按下的瞬间被抹平、格子集体跳一下。`;
}

function partOneShot(bp) {
    return `用户要「戳破 / 用掉」这种一次性效果。这一格被按过之后,\`.htmlbubble-host\` 上会永久留下 \`is-popped\`(存档,下次打开还在)。

- \`.htmlbubble-host.is-popped .你的元素\` 是「已经用掉」的样子:${bp.feel === 'crisp' ? '瘪掉 / 裂开 / 塌陷' : '明显和没用过的那格不一样'}。
- 用过和没用过必须**一眼分得出来**:形状、颜色、阴影至少变两样。只降透明度不够。
- 这个状态是长期的,别在上面挂无限循环动画 —— 一屏几十格一起循环会烫手机。
- 不要试图自己「恢复」这一格,恢复由界面上的「恢复主体」按钮负责。`;
}

function partText(bp) {
    const sample = bp.textSample || '(用户没指定内容,你自己定一个短词)';
    return `每一格里要有文字。

- 要显示的内容:${sample}
- 想让每格不一样就用占位符,比如 \`<span class="my-num">{index}</span>\`。
- 字号跟着格子走:用 \`calc(var(--bubble-unit, 40px) * 0.28)\` 这类算法,**不要**写死 \`font-size: 14px\` —— 板子从 2×2 到 12×12 都可能,写死的字在 12×12 下会溢出来。
- 加一句 \`overflow: hidden\` 兜底,字长了也不会顶破格子。
- 字体不要外链,用 \`font-family: inherit\` 或者系统字体栈。`;
}

function partDecor(bp) {
    return `用户要渐变 / 阴影 / 描边这类质感。

- 光源统一从左上来:高光放左上,内阴影落右下。一格里两个方向的光会显得脏。
- 立体感用 \`inset\` 阴影堆,不要靠外阴影堆 —— 格子挨得很近,外阴影会糊成一片。
- 描边用 \`box-shadow: inset 0 0 0 1.5px ...\` 而不是 \`border\`,\`border\` 会改盒模型尺寸。
- 圆角优先用 \`var(--bubble-round)\`,每格不一样,看起来才像手工的。${bp.palette === 'theme' ? '\n- 渐变的两端都从 `var(--htmlbubble-tint)` 用 `color-mix` 推出来,换主题色时整格一起变。' : ''}`;
}

function partMotion(bp, free) {
    const level = {
        soft: '很轻:缩放幅度控制在 3% 以内,时长 0.2s 上下,几乎察觉不到但手感在。',
        normal: '正常:缩放 10%~20%,时长 0.3~0.45s,用 `var(--rx-ease-bounce)` 做一次过冲。',
        lively: '夸张:缩放可以到 25%,允许两次以上的过冲,时长 0.45~0.6s,但**必须停下来**,不要无限循环。',
    }[bp.motion];

    const last = free
        ? '- 跟手的部分(摇杆帽子、滑块、旋钮)用 `transition` 而不是 `@keyframes` —— keyframes 是一段录好的动画,拦不住手指中途改主意。'
        : '- 一屏最多 144 格同时在跑,别用 `box-shadow` 做动画属性。';

    return `动画强度:${labelOf(TOY_MOTIONS, bp.motion)}。

- ${level}
- \`@keyframes\` 可以写,名字起独特一点(比如 \`myCellSquish\`),不要叫 \`pop\` / \`squish\` 这种大众名字,会和内置的撞。
- 只动 \`transform\`、\`opacity\`、\`filter\`。
${last}`;
}

function partDark() {
    return `要考虑深色背景。这块板子会被摆在用户自己选的背景上,可能很亮也可能很暗。

- 用 \`@media (prefers-color-scheme: dark) { ... }\` 补一套暗色下的对比度,不要整体换配色方案。
- 不要依赖「背景是白的」来做效果 —— 半透明白色高光在深色背景上会变成灰雾。
- 描边 / 高光在两种模式下都要能看见。`;
}

function partOutput(rootClass) {
    const isFree = rootClass === '.my-toy';
    const name = rootClass.slice(1);

    return `只输出两段代码,一段 HTML 一段 CSS,**不要解释、不要总结、不要写使用说明**。格式就是这样:

\`\`\`html
<div class="${name}">
    <span class="my-shine"></span>
</div>
\`\`\`

\`\`\`css
${rootClass} {
    width: 100%;
    height: 100%;
    ...
}
\`\`\`

两段都必须有。HTML 那段不要包 \`<html>\` \`<body>\`,就是${isFree ? '这个物件本身' : '一格的内容'}。CSS 那段不要包 \`<style>\`,就是规则本身。`;
}

function buildToyChecklist(bp, rows, cols) {
    const items = [
        '只写了**一格**,没有自己去排 grid / flex 阵列',
        '根元素是 `width:100%; height:100%`,不依赖固定像素尺寸',
        '没有输出 `<style>` / `<script>` / `<iframe>` / `<link>`,没有 `onclick=`',
        'CSS 里没有 `html` / `body` / `:root` / `*` 开头的选择器,也没有 `.app-` `.rx-` `.ac-`',
        'CSS 大括号是配平的,没有多余的 `}`',
        '没有 `@import`,没有外部图片 / 字体链接',
    ];

    if (bp.palette === 'theme') items.push('主色来自 `var(--htmlbubble-tint)`,没有写死 hex');
    if (bp.pressChange) items.push('`.htmlbubble-host.is-squish` 下有明显可见的变化');
    if (bp.oneShot) items.push('`.htmlbubble-host.is-popped` 下和未使用状态一眼能分辨,且没有无限循环动画');
    if (bp.withText) items.push('字号是按 `var(--bubble-unit)` 算的,12×12 下也不会溢出');
    if (bp.motion !== 'none') items.push('动画只动 `transform` / `opacity` / `filter`,keyframes 名字独特');
    if (bp.motion === 'none') items.push('确实没有写任何 `@keyframes` / `transition` 动画');
    if (bp.darkAware) items.push('深色背景下描边和高光仍然看得见');
    if (bp.decorated) items.push('高光在左上、内阴影在右下,光源方向统一');
    items.push(`在 ${rows}×${cols}(共 ${rows * cols} 格)下试想过一遍:格子没有互相盖住、没有溢出板子`);
    items.push('输出只有两段代码,没有多余的文字说明');

    return items.map(item => `- [ ] ${item}`).join('\n');
}

function buildFreeChecklist(bp) {
    const items = [
        '整块只画了**一个**东西,没有自己去复制阵列,也没有用 `{index}` 这类占位符',
        `每个要动的地方都打了 \`data-hb\`,而且只用了这几种:${bp.moves.map(id => `\`${id}\``).join('、')}`,
        '每个零件都写了 `data-id`,名字互不重复',
        '所有 `var(--hb-...)` 都带了兜底值,比如 `var(--hb-x, 0)`',
        '角度 / 长度是自己乘的单位(`calc(var(--hb-deg) * 1deg)`),没有直接把纯数字塞进 rotate',
        '盖在零件上面的装饰层都写了 `pointer-events: none`',
        '尺寸是从 `var(--hb-unit)` 算的,没有写死 px,也没有靠 `width:X%` + `height:X%` 撑圆形',
        '没有输出 `<style>` / `<script>` / `<iframe>` / `<link>`,没有 `onclick=`',
        'CSS 里没有 `html` / `body` / `:root` / `*` 开头的选择器,也没有 `.app-` `.rx-` `.ac-`',
        'CSS 大括号是配平的,没有多余的 `}`',
        '没有 `@import`,没有外部图片 / 字体链接',
    ];

    if (bp.moves.includes('stick')) {
        items.push('`data-hb="stick"` 打在底座上而不是帽子上,帽子有 `pointer-events: none`');
        items.push('`.is-active` 时关掉了帽子的 transition,松手时又能靠 transition 弹回中间');
    }
    if (bp.moves.includes('slide')) items.push('滑块零件如果很小,已经用 `data-gain` 把灵敏度调下来了');
    if (bp.moves.includes('dial')) items.push('旋钮用的是 `--hb-deg` 累计角度,`.is-active` 时没有 transition 拖后腿');
    if (bp.moves.includes('toggle')) items.push('`.is-on` 和默认状态一眼分得出来');
    if (bp.palette === 'theme') items.push('主色来自 `var(--htmlbubble-tint)`,没有写死 hex');
    if (bp.oneShot) items.push('`.is-popped` 下和未使用状态一眼能分辨,且没有无限循环动画');
    if (bp.withText) items.push('字号是按 `var(--hb-unit)` 算的');
    if (bp.motion !== 'none') items.push('动画只动 `transform` / `opacity` / `filter`,keyframes 名字独特');
    if (bp.motion === 'none') items.push('确实没有写任何 `@keyframes` / `transition` 动画');
    if (bp.darkAware) items.push('深色背景下描边和高光仍然看得见');
    if (bp.decorated) items.push('高光在左上、内阴影在右下,光源方向统一');
    items.push('输出只有两段代码,没有多余的文字说明');

    return items.map(item => `- [ ] ${item}`).join('\n');
}

// ============================================================
// 把 AI 的回复拆成 HTML / CSS
// ============================================================

/** 语言标记 → 分类 */
const HTML_LANGS = new Set(['html', 'htm', 'xml', 'svg', 'vue', 'markup']);
const CSS_LANGS = new Set(['css', 'scss', 'less', 'sass', 'stylus']);
const JS_LANGS = new Set(['js', 'javascript', 'jsx', 'mjs', 'ts', 'typescript', 'node']);

/**
 * 把 AI 的整段回复拆成 HTML / CSS / JS。
 *
 * 覆盖五种最常见的形态:
 *   1) ```html + ```css(+ ```js)带语言标记的围栏
 *   2) 只有一段 HTML,CSS 塞在里面的 <style> 里、JS 塞在 <script> 里
 *   3) 没写语言的围栏(按内容猜)
 *   4) 没有围栏的裸文本
 *   5) 写代码模式下只回了 JS(HTML 全靠脚本建)—— 这种也算成功
 *
 * @param {string} text
 * @param {{ layout?: 'grid'|'free'|'code' }} [options]
 *        code 模式下 JS 才有意义,而且允许「只有 JS 没有 HTML」。
 * @returns {{ ok: boolean, html: string, css: string, js: string, detected: string[], reason: string }}
 */
export function splitAiReply(text, options = {}) {
    const isCode = normalizeToyLayout(options.layout) === 'code';
    const empty = { ok: false, html: '', css: '', js: '', detected: [], reason: '' };
    if (typeof text !== 'string' || !text.trim()) {
        return { ...empty, reason: '粘贴框是空的。' };
    }

    const blocks = extractFencedBlocks(text);
    const detected = [];
    let html = '';
    let css = '';
    let js = '';

    if (blocks.length) {
        const htmlBlocks = blocks.filter(b => b.kind === 'html');
        const cssBlocks = blocks.filter(b => b.kind === 'css');
        const jsBlocks = blocks.filter(b => b.kind === 'js');
        const unknownBlocks = blocks.filter(b => b.kind === 'unknown');

        if (htmlBlocks.length) {
            html = htmlBlocks.map(b => b.code).join('\n');
            detected.push('标了 html 的代码块');
        }
        if (cssBlocks.length) {
            css = cssBlocks.map(b => b.code).join('\n');
            detected.push('标了 css 的代码块');
        }
        if (jsBlocks.length) {
            js = jsBlocks.map(b => b.code).join('\n');
            detected.push('标了 js 的代码块');
        }

        // 没标语言的块:按内容猜,缺哪块补哪块
        for (const block of unknownBlocks) {
            const guess = guessKind(block.code);
            if (guess === 'js' && !js) {
                js = block.code;
                detected.push('没标语言、但看着像 JS 的代码块');
            } else if (guess === 'css' && !css) {
                css = block.code;
                detected.push('没标语言、但看着像 CSS 的代码块');
            } else if (guess !== 'css' && guess !== 'js' && !html) {
                html = block.code;
                detected.push('没标语言、但看着像 HTML 的代码块');
            } else if (!css && guess !== 'html') {
                css = block.code;
                detected.push('没标语言的第二段代码,当成 CSS');
            } else if (!html) {
                html = block.code;
                detected.push('没标语言的代码块,当成 HTML');
            }
        }
    } else {
        // 没有成对围栏:整段当代码看。
        // ★ AI 的回复被截断时会留下半截 ``` —— 先把这种孤零零的围栏行抹掉,
        //   否则它会当成文本进到模板里,在格子里显示出三个反引号。
        const raw = text.replace(/^[^\S\r\n]*```[a-zA-Z0-9_+-]*[^\S\r\n]*$/gm, '').trim();
        const guess = guessKind(raw);
        if (guess === 'js') {
            js = raw;
            detected.push('整段没有代码块,按 JS 处理');
        } else if (guess === 'css') {
            css = raw;
            detected.push('整段没有代码块,按 CSS 处理');
        } else if (guess === 'html') {
            html = raw;
            detected.push('整段没有代码块,按 HTML 处理');
        }
    }

    // HTML 里夹着 <style> / <script>:挪到对应的那一栏(AI 很爱这么写)
    if (html.includes('<style')) {
        const pulled = pullStyleBlocks(html);
        html = pulled.html;
        if (pulled.css) {
            css = css ? `${css}\n${pulled.css}` : pulled.css;
            detected.push('从 <style> 标签里取出来的 CSS');
        }
    }
    if (html.includes('<script')) {
        const pulled = pullScriptBlocks(html);
        html = pulled.html;
        if (pulled.js) {
            js = js ? `${js}\n${pulled.js}` : pulled.js;
            detected.push('从 <script> 标签里取出来的 JS');
        }
    }

    html = html.trim();
    css = css.trim();
    js = js.trim();

    if (!html && !css && !js) {
        return { ...empty, reason: '这段文字里没找到代码。把 AI 回复里的代码整段复制过来,连 ``` 一起带上也可以。' };
    }

    // 写代码模式:JS 自己就能把界面建出来,所以只有 JS 也算数
    if (isCode) {
        if (!html && !js) {
            return { ...empty, css, detected, reason: '只找到 CSS。写代码模式至少还要一段 HTML 或者 JS,不然画布上什么都不会出现。' };
        }
        return { ok: true, html, css, js, detected, reason: '' };
    }

    if (!html) {
        return {
            ok: false, html: '', css, js, detected,
            reason: '只找到 CSS,没找到 HTML。缺了 HTML 的话画出来是空的,把那一段也复制过来。',
        };
    }

    return { ok: true, html, css, js, detected, reason: '' };
}

/** 抠出所有 ``` 围栏块 */
function extractFencedBlocks(text) {
    const blocks = [];
    const re = /```([a-zA-Z0-9_+-]*)[^\S\r\n]*\r?\n([\s\S]*?)```/g;
    let match = re.exec(text);

    while (match) {
        const lang = (match[1] || '').toLowerCase();
        const code = match[2];
        if (code.trim()) {
            let kind = 'unknown';
            if (HTML_LANGS.has(lang)) kind = 'html';
            else if (CSS_LANGS.has(lang)) kind = 'css';
            else if (JS_LANGS.has(lang)) kind = 'js';
            blocks.push({ kind, code: code.replace(/\s+$/, '') });
        }
        match = re.exec(text);
    }
    return blocks;
}

/**
 * 猜一段代码是 HTML / CSS / JS。
 * 判据很土但够用:有 JS 关键字就是 JS;有标签就是 HTML;有「选择器 {」就是 CSS。
 * ★ JS 要先判 —— 一段 `el.style.cssText = "a:b"` 在 CSS 判据下也会命中。
 */
function guessKind(code) {
    const body = String(code).replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const hasJs = /\b(?:function|=>|const |let |var |addEventListener|querySelector|requestAnimationFrame|hb\.)/.test(body);
    const hasTag = /<[a-zA-Z][^>]*>/.test(body);
    const hasRule = /[^{}]*\{[^{}]*:[^{}]*\}/.test(body);
    if (hasJs && !hasTag) return 'js';
    if (hasTag && !hasRule) return 'html';
    if (!hasTag && hasRule) return 'css';
    if (hasTag && hasRule) return 'html';   // 带 <style> 的 HTML,后面会把 CSS 拆出来
    return 'unknown';
}

/** 把 HTML 里的 <style>…</style> 摘出来 */
function pullStyleBlocks(html) {
    const chunks = [];
    const stripped = html.replace(/<style\b[^>]*>([\s\S]*?)<\/\s*style\s*>/gi, (whole, inner) => {
        if (inner && inner.trim()) chunks.push(inner.trim());
        return '';
    })
        // 只有开标签没有闭合的残缺写法,一并清掉,别让 <style 漏进模板
        .replace(/<\/?\s*style\b[^>]*>/gi, '');

    return { html: stripped, css: chunks.join('\n') };
}

/** 把 HTML 里的 <script>…</script> 摘出来(只有写代码模式用得上) */
function pullScriptBlocks(html) {
    const chunks = [];
    const stripped = html.replace(/<script\b[^>]*>([\s\S]*?)<\/\s*script\s*>/gi, (whole, inner) => {
        if (inner && inner.trim()) chunks.push(inner.trim());
        return '';
    })
        .replace(/<\/?\s*script\b[^>]*>/gi, '');

    return { html: stripped, js: chunks.join('\n') };
}
