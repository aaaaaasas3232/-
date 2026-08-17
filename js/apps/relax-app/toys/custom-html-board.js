/**
 * relax-app / 内置解压主体:「我的捏捏」(用户自己写 HTML + CSS)
 *
 * ------------------------------------------------------------
 * 三种布局模式
 * ------------------------------------------------------------
 * A. 格子(layout: 'grid')—— 老玩法。
 *    一块 rows×cols 的板子,**每一格的内容都是用户写的同一段 HTML**。
 *    模板里可以用占位符,每格展开时替换成自己的坐标:
 *      {row}    行号,从 0 开始
 *      {col}    列号,从 0 开始
 *      {index}  第几格,0 ~ 总数-1
 *      {total}  总格数
 *
 * B. 自由(layout: 'free')—— 整块只画**一个**东西,不复制。
 *    为什么加这个:格子模式只能表达「一格重复 N 次 + 按一下换个样子」,
 *    想做摇杆、鼠标、旋钮这种「一个物件、不同部位各干各的、还要跟着手指走」
 *    根本无从下手。自由模式把整块交给用户,交互靠在自己的元素上打
 *    `data-hb="stick"` 这类标记,由 services/toy-parts.js 接管指针,
 *    把位置 / 角度 / 开关量写成 CSS 变量 —— 用户只写 CSS 就能让它跟手。
 *
 *    这一档不开放 JS:代码是直接注进本页的,必须先过消毒。
 *
 * C. 写代码(layout: 'code')—— HTML + CSS + **JS** 全放开。
 *    五种零件再多也补不全「用户想做什么」:甩出去会弹的球、跟手画线、
 *    双指捏合……这些只能靠 JS。
 *
 *    ★ 放开 JS 的前提是**换个地方跑**:代码进
 *      `<iframe sandbox="allow-scripts">`(不给 allow-same-origin),
 *      拿到的是不透明源 —— 读不到本页、读不到存档,CSP 又把网络掐死。
 *      详见 services/toy-sandbox.js。这一档**不消毒**,消了就没法用了。
 *
 * 用户写的 CSS 会被包进一层作用域再注入,只对这块板生效(grid / free 两档)。
 * code 档的 CSS 在 iframe 里面,天然就是隔离的。
 *
 * ------------------------------------------------------------
 * ★ 作用域是怎么做的(别改成 :scope)
 * ------------------------------------------------------------
 * 每次 mount 生成一个唯一 id,挂在根节点的 data-htmlbubble-scope 上,
 * 然后把用户 CSS 整段塞进 `[data-htmlbubble-scope="xxx"] { ... }`,
 * 靠 **CSS 原生嵌套** 让里面的 `.my-cell` 解析成后代选择器。
 *
 * 早期版本写的是 `:scope { ... }` —— 在普通 <style> 里 `:scope` 等价于 `:root`,
 * 于是用户的 `.my-cell` 实际变成了 `:root .my-cell`,**全站生效**。
 * 一个人写个 `div { display:none }` 能把整个 App 弄没。现在这版是真作用域。
 *
 * ------------------------------------------------------------
 * ★ 消毒不是可选项
 * ------------------------------------------------------------
 * 这里是 innerHTML 注入。以前的注释写「用户自己写自己用,信任源」——
 * 现在编辑页鼓励用户把 AI 生成的代码粘进来,这个前提不成立了。
 * 所以**渲染前再消毒一次**(services/toy-sanitizer.js):
 * 编辑页存盘时消过一次,这里是第二道 —— 老存档里可能还躺着消毒之前写进去的东西。
 *
 * ★ 主体内部不碰 localStorage、不插全局 <style>、不读 store。
 *   颜色只认 host.tint,持久化只走 host.setState,内置样式写在 css/apps/relax/_toys.css。
 */

import { registerRelaxToy } from '../registry.js';
import { sanitizeToyTemplate } from '../services/toy-sanitizer.js';
import { createToyParts } from '../services/toy-parts.js';
import { createToySandbox } from '../services/toy-sandbox.js';

const CUSTOM_ICON = `
<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="6" width="24" height="20" rx="4" stroke="currentColor" stroke-width="2"/>
    <path d="M12 13l-3 3 3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M20 13l3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M17 11l-2 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`;

/**
 * 内置模板(格子模式)。
 *
 * ★ 每条都必须同时有 html 和 css —— 编辑页 `getDefaultTemplateById(id).html`
 *   是直接取属性的,给不出对象就会在初始化时炸掉整个 App。
 * ★ id 发布后不要改:它存在 toyStates.activeTemplateId 里。
 * ★ 一格只写一格的样子,板子会自动铺开;不要在模板里自己排 grid。
 */
export const DEFAULT_HTML_TEMPLATES = Object.freeze([
    {
        id: 'bubble',
        name: '气泡',
        description: '最经典的一颗,按下去会瘪',
        html: '<span class="hb-bubble"></span>',
        css: `.hb-bubble {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    background:
        radial-gradient(circle at 34% 28%, rgba(255,255,255,.92), rgba(255,255,255,0) 56%),
        var(--htmlbubble-tint);
    box-shadow:
        inset 0 -3px 6px rgba(107,85,96,.18),
        0 2px 5px rgba(107,85,96,.16);
    transition: transform .18s ease;
}

.htmlbubble-host.is-popped .hb-bubble {
    background: color-mix(in srgb, var(--htmlbubble-tint) 42%, #cfc6be);
    box-shadow: inset 0 3px 7px rgba(107,85,96,.3);
    transform: scale(.9);
}`,
    },
    {
        id: 'choco',
        name: '巧克力块',
        description: '方方正正,有厚度',
        html: '<span class="hb-choco"></span>',
        css: `.hb-choco {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 5px;
    background:
        linear-gradient(150deg,
            color-mix(in srgb, var(--htmlbubble-tint) 70%, #6b4a3a) 0%,
            color-mix(in srgb, var(--htmlbubble-tint) 40%, #4a3025) 100%);
    box-shadow:
        inset 2px 2px 0 rgba(255,255,255,.28),
        inset -2px -3px 0 rgba(0,0,0,.22),
        0 2px 4px rgba(74,48,37,.3);
}

.htmlbubble-host.is-popped .hb-choco {
    background: linear-gradient(150deg, #6d5a50 0%, #4b3d36 100%);
    box-shadow: inset 0 3px 6px rgba(0,0,0,.35);
}`,
    },
    {
        id: 'jelly',
        name: '果冻方糖',
        description: '半透明,里面有个小核',
        html: '<span class="hb-jelly"><i></i></span>',
        css: `.hb-jelly {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 30% 34% 30% 34%;
    background: color-mix(in srgb, var(--htmlbubble-tint) 62%, transparent);
    box-shadow:
        inset 0 -4px 8px rgba(107,85,96,.16),
        inset 0 3px 6px rgba(255,255,255,.7),
        0 2px 6px rgba(107,85,96,.14);
}

.hb-jelly i {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 26%;
    height: 26%;
    margin: -13% 0 0 -13%;
    border-radius: 50%;
    background: rgba(255,255,255,.75);
}

.htmlbubble-host.is-popped .hb-jelly {
    background: color-mix(in srgb, var(--htmlbubble-tint) 26%, transparent);
}`,
    },
    {
        id: 'note',
        name: '便签纸',
        description: '带格子编号,适合改成字',
        html: '<span class="hb-note">{index}</span>',
        css: `.hb-note {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: 3px;
    background: color-mix(in srgb, var(--htmlbubble-tint) 34%, #fffdf6);
    box-shadow: 0 2px 4px rgba(107,85,96,.18);
    font-size: 11px;
    font-weight: 600;
    color: rgba(107,85,96,.55);
    transform: rotate(var(--hb-tilt, 0deg));
}

.htmlbubble-host.is-popped .hb-note {
    background: #ded7cf;
    color: rgba(107,85,96,.28);
}`,
    },
]);

/**
 * 内置模板(自由模式)。
 *
 * ★ 这四套是**协议说明书的可执行版本** —— 五种零件(press / toggle / stick /
 *   slide / dial)在这里都至少出现一次。用户看不懂速查表的时候,
 *   点一套进来读代码是最快的路。别把它们改成「只是好看」。
 * ★ 尺寸一律从 `var(--hb-unit)` 算(主体给的短边像素数)。
 *   写死 px 的话换个手机就撑破,写 % 的话在竖长方形舞台里会被拉变形。
 */
export const FREE_HTML_TEMPLATES = Object.freeze([
    {
        id: 'joystick',
        name: '摇杆',
        description: '按住拖,松手自己弹回中间',
        html: `<div class="jz-wrap">
    <div class="jz-base" data-hb="stick" data-id="stick" data-step="8">
        <span class="jz-dish"></span>
        <span class="jz-dots"></span>
        <span class="jz-knob"><i class="jz-cap"></i></span>
    </div>
    <span class="jz-hint">按住拖动</span>
</div>`,
        css: `.jz-wrap {
    display: grid;
    place-items: center;
    gap: 14px;
    width: 100%;
    height: 100%;
    perspective: 700px;
}

/* data-hb="stick" 打在底座上:能抓的范围就是它 */
.jz-base {
    position: relative;
    width: calc(var(--hb-unit, 280px) * .74);
    height: calc(var(--hb-unit, 280px) * .74);
    border-radius: 50%;
    background:
        radial-gradient(circle at 50% 16%, rgba(255,255,255,.26), transparent 54%),
        conic-gradient(from 200deg, #4c4350, #6f6472 22%, #3b3440 52%, #5c5364 78%, #4c4350);
    box-shadow:
        inset 0 8px 18px rgba(0,0,0,.42),
        inset 0 -3px 8px rgba(255,255,255,.16),
        0 12px 26px rgba(48,36,48,.34);
    /* --hb-stick-x / -y 是「整块」上的镜像变量,底座自己也能读到 */
    transform:
        rotateY(calc(var(--hb-stick-x, 0) * 9deg))
        rotateX(calc(var(--hb-stick-y, 0) * -9deg));
    transition: transform .34s var(--rx-ease-bounce);
}

/* 拖动中关掉过渡,否则手指走一步、帽子晚半拍 */
.jz-base.is-active { transition: none; }

.jz-dish {
    position: absolute;
    inset: 9%;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 34%, rgba(0,0,0,.42), rgba(0,0,0,.14) 72%);
    box-shadow: inset 0 4px 10px rgba(0,0,0,.55);
    pointer-events: none;
}

.jz-dots {
    position: absolute;
    inset: 4%;
    border-radius: 50%;
    background:
        radial-gradient(circle 3px at 50% 3%, rgba(255,255,255,.55) 96%, transparent),
        radial-gradient(circle 3px at 97% 50%, rgba(255,255,255,.55) 96%, transparent),
        radial-gradient(circle 3px at 50% 97%, rgba(255,255,255,.55) 96%, transparent),
        radial-gradient(circle 3px at 3% 50%, rgba(255,255,255,.55) 96%, transparent);
    pointer-events: none;
}

.jz-knob {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 48%;
    height: 48%;
    margin: -24% 0 0 -24%;
    border-radius: 50%;
    /* --hb-x / --hb-y 是 -1 ~ 1,乘个百分比就是帽子能走多远 */
    transform: translate(calc(var(--hb-x, 0) * 50%), calc(var(--hb-y, 0) * 50%));
    transition: transform .38s var(--rx-ease-bounce);
    pointer-events: none;
}

.jz-base.is-active .jz-knob { transition: none; }

.jz-cap {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background:
        radial-gradient(circle at 34% 26%, #fff 0%, rgba(255,255,255,.55) 16%, transparent 48%),
        radial-gradient(circle at 50% 64%,
            color-mix(in srgb, var(--htmlbubble-tint) 46%, #7a4f60) 0%,
            color-mix(in srgb, var(--htmlbubble-tint) 88%, #fff) 100%);
    box-shadow:
        0 8px 16px rgba(40,25,35,.44),
        inset 0 -5px 10px rgba(90,55,70,.32),
        inset 0 4px 8px rgba(255,255,255,.55);
}

.jz-hint {
    font-size: 11px;
    letter-spacing: .28em;
    color: rgba(107,85,96,.4);
}`,
    },
    {
        id: 'mouse',
        name: '鼠标',
        description: '左右键分开按,滚轮能滚',
        html: `<div class="ms-wrap">
    <div class="ms-body">
        <span class="ms-btn ms-btn-l" data-hb="press" data-id="left" data-release data-rate="1.2"></span>
        <span class="ms-btn ms-btn-r" data-hb="press" data-id="right" data-release data-rate="0.98"></span>
        <span class="ms-seam"></span>
        <span class="ms-wheel"
              data-hb="slide" data-id="wheel" data-axis="y"
              data-wrap data-gain="0.35" data-step="0.12" data-rate="1.7">
            <i class="ms-wheel-face"></i>
        </span>
        <span class="ms-led"></span>
    </div>
</div>`,
        css: `.ms-wrap {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
}

.ms-body {
    position: relative;
    width: calc(var(--hb-unit, 280px) * .5);
    height: calc(var(--hb-unit, 280px) * .8);
    border-radius: 48% 48% 40% 40% / 36% 36% 24% 24%;
    background:
        radial-gradient(120% 74% at 50% 6%, rgba(255,255,255,.85), transparent 58%),
        linear-gradient(168deg,
            color-mix(in srgb, var(--htmlbubble-tint) 32%, #fffaf6) 0%,
            color-mix(in srgb, var(--htmlbubble-tint) 60%, #cbb9c2) 100%);
    box-shadow:
        inset 0 -10px 20px rgba(107,85,96,.2),
        inset 0 4px 10px rgba(255,255,255,.9),
        0 14px 26px rgba(107,85,96,.26);
    /* 两个按键是方的,靠壳子把它们裁成鼠标的形状 */
    overflow: hidden;
}

.ms-btn {
    position: absolute;
    top: 0;
    width: 50%;
    height: 44%;
    background: linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,0) 72%);
    transition: transform .1s ease, filter .1s ease;
}
.ms-btn-l { left: 0; }
.ms-btn-r { right: 0; }

/* 按下的那一半往里陷 */
.ms-btn.is-press {
    transform: translateY(2px) scaleY(.985);
    filter: brightness(.9);
}

.ms-seam {
    position: absolute;
    left: 50%;
    top: 0;
    width: 2px;
    height: 44%;
    margin-left: -1px;
    background: linear-gradient(180deg, rgba(107,85,96,.3), rgba(107,85,96,.05));
    /* ★ 压在按键上的装饰一律要让开指针,否则中缝附近按不动 */
    pointer-events: none;
}

.ms-wheel {
    position: absolute;
    left: 50%;
    top: 11%;
    width: 15%;
    height: 21%;
    margin-left: -7.5%;
    border-radius: 999px;
    overflow: hidden;
    background: #4a424e;
    box-shadow:
        inset 0 0 0 1.5px rgba(255,255,255,.26),
        inset 0 4px 8px rgba(0,0,0,.5),
        0 2px 4px rgba(107,85,96,.3);
}

.ms-wheel-face {
    position: absolute;
    inset: 1px;
    border-radius: inherit;
    background:
        linear-gradient(90deg, rgba(0,0,0,.45), transparent 32%, transparent 68%, rgba(0,0,0,.45)),
        repeating-linear-gradient(180deg, #6a6070 0 3px, #423b4a 3px 6px);
    /* 齿纹一格 6px,一整程走 24px = 4 格,配 data-wrap 正好首尾接得上 */
    background-position: 0 0, 0 calc(var(--hb-y, 0) * -24px);
}

.ms-wheel.is-active {
    box-shadow:
        inset 0 0 0 1.5px rgba(255,255,255,.4),
        inset 0 4px 8px rgba(0,0,0,.5),
        0 0 10px color-mix(in srgb, var(--htmlbubble-tint) 70%, transparent);
}

/* 左键按下就亮 —— 灯不是左键的子元素,读的是整块上的镜像变量 --hb-left */
.ms-led {
    position: absolute;
    left: 50%;
    bottom: 7%;
    width: 26%;
    height: 4px;
    margin-left: -13%;
    border-radius: 999px;
    background: #ff5f8d;
    opacity: calc(.16 + var(--hb-left, 0) * .84);
    box-shadow: 0 0 calc(var(--hb-left, 0) * 16px) rgba(255,95,141,.85);
    transition: opacity .12s ease, box-shadow .12s ease;
    pointer-events: none;
}`,
    },
    {
        id: 'dial',
        name: '旋钮',
        description: '绕着中心转,每 15 度咔一下',
        html: `<div class="dl-wrap">
    <span class="dl-scale"></span>
    <div class="dl-knob"
         data-hb="dial" data-id="vol"
         data-step="15" data-min="-150" data-max="150" data-rate="1.7">
        <span class="dl-face"></span>
        <span class="dl-mark"></span>
    </div>
</div>`,
        css: `.dl-wrap {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
}

.dl-scale {
    position: absolute;
    width: calc(var(--hb-unit, 280px) * .78);
    height: calc(var(--hb-unit, 280px) * .78);
    border-radius: 50%;
    background: repeating-conic-gradient(
        from -151deg,
        rgba(107,85,96,.34) 0 1.2deg,
        transparent 1.2deg 15deg);
    /* 满量程之外的那一段刻度不画:-150 ~ 150 是 dial 的限位 */
    mask: conic-gradient(from -151deg, #000 0 302deg, transparent 302deg);
    -webkit-mask: conic-gradient(from -151deg, #000 0 302deg, transparent 302deg);
    pointer-events: none;
}

.dl-knob {
    position: relative;
    width: calc(var(--hb-unit, 280px) * .56);
    height: calc(var(--hb-unit, 280px) * .56);
    border-radius: 50%;
    background:
        conic-gradient(from 0deg,
            #efe4dc, #cec0b8 12%, #f6ece6 26%, #c9b9b2 44%,
            #f2e8e2 62%, #cabbb4 82%, #efe4dc);
    box-shadow:
        0 10px 22px rgba(107,85,96,.3),
        inset 0 -4px 10px rgba(107,85,96,.22),
        inset 0 4px 8px rgba(255,255,255,.85);
    /* --hb-deg 是累计角度,纯数字,自己乘 1deg */
    transform: rotate(calc(var(--hb-deg, 0) * 1deg));
    transition: transform .08s linear;
}

.dl-knob.is-active { transition: none; }

.dl-face {
    position: absolute;
    inset: 13%;
    border-radius: 50%;
    background:
        radial-gradient(circle at 36% 26%, rgba(255,255,255,.95), transparent 56%),
        linear-gradient(160deg,
            color-mix(in srgb, var(--htmlbubble-tint) 74%, #fff) 0%,
            color-mix(in srgb, var(--htmlbubble-tint) 44%, #8d6a78) 100%);
    box-shadow: inset 0 -3px 8px rgba(107,85,96,.28);
    pointer-events: none;
}

.dl-mark {
    position: absolute;
    left: 50%;
    top: 7%;
    width: 5%;
    height: 24%;
    margin-left: -2.5%;
    border-radius: 999px;
    background: #fffaf6;
    box-shadow: 0 0 6px rgba(255,255,255,.85);
    pointer-events: none;
}`,
    },
    {
        id: 'switchbox',
        name: '开关板',
        description: '三个拨杆、一根推子、一颗大按钮',
        html: `<div class="sw-panel">
    <span class="sw-lamp"></span>
    <div class="sw-row">
        <span class="sw-toggle" data-hb="toggle" data-id="a" data-rate="1.3"><i></i></span>
        <span class="sw-toggle" data-hb="toggle" data-id="b" data-rate="1.1"><i></i></span>
        <span class="sw-toggle" data-hb="toggle" data-id="c" data-rate="0.95"><i></i></span>
    </div>
    <div class="sw-fader" data-hb="slide" data-id="fader" data-axis="y" data-step="0.1" data-rate="1.4">
        <span class="sw-fader-fill"></span>
        <span class="sw-fader-cap"></span>
    </div>
    <span class="sw-big" data-hb="press" data-id="go" data-hold data-heavy data-rate="0.75"></span>
</div>`,
        css: `.sw-panel {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto 1fr;
    align-items: center;
    gap: 6% 8%;
    width: calc(var(--hb-unit, 280px) * .82);
    height: calc(var(--hb-unit, 280px) * .82);
    padding: 12% 9% 9%;
    box-sizing: border-box;
    border-radius: 22px 26px 20px 24px;
    background:
        linear-gradient(165deg, #4d4550 0%, #322c37 100%);
    box-shadow:
        inset 0 2px 4px rgba(255,255,255,.16),
        inset 0 -6px 14px rgba(0,0,0,.4),
        0 14px 28px rgba(48,36,48,.34);
}

/* 三个都拨上去才最亮 —— 读的是三个开关在整块上的镜像变量 */
.sw-lamp {
    position: absolute;
    left: 50%;
    top: 5%;
    width: 22%;
    height: 5px;
    margin-left: -11%;
    border-radius: 999px;
    background: color-mix(in srgb, var(--htmlbubble-tint) 90%, #fff);
    opacity: calc(.12 + (var(--hb-a, 0) + var(--hb-b, 0) + var(--hb-c, 0)) / 3 * .88);
    box-shadow: 0 0 calc((var(--hb-a, 0) + var(--hb-b, 0) + var(--hb-c, 0)) * 5px)
        color-mix(in srgb, var(--htmlbubble-tint) 80%, transparent);
    transition: opacity .2s ease, box-shadow .2s ease;
    pointer-events: none;
}

.sw-row {
    display: flex;
    gap: 9%;
    align-self: start;
}

.sw-toggle {
    position: relative;
    flex: 1;
    height: calc(var(--hb-unit, 280px) * .2);
    border-radius: 999px;
    background: linear-gradient(180deg, #241f28 0%, #3a3340 100%);
    box-shadow: inset 0 3px 7px rgba(0,0,0,.6);
}

.sw-toggle i {
    position: absolute;
    left: 8%;
    right: 8%;
    height: 42%;
    border-radius: 999px;
    background: linear-gradient(180deg, #fff 0%, #c4b7bd 100%);
    box-shadow: 0 3px 6px rgba(0,0,0,.45);
    /* 默认在下面,拨上去在上面 */
    top: 52%;
    transition: top .2s var(--rx-ease-bounce), background .2s ease;
}

.sw-toggle.is-on i {
    top: 6%;
    background: linear-gradient(180deg,
        color-mix(in srgb, var(--htmlbubble-tint) 92%, #fff) 0%,
        color-mix(in srgb, var(--htmlbubble-tint) 62%, #8a6070) 100%);
}

.sw-fader {
    position: relative;
    grid-row: span 2;
    width: calc(var(--hb-unit, 280px) * .13);
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(180deg, #201b24 0%, #383040 100%);
    box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.08), inset 0 3px 8px rgba(0,0,0,.6);
    overflow: hidden;
}

/* ★ --hb-y 跟屏幕坐标同向:0 在顶上,往下拖变大 */
.sw-fader-fill {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: calc(var(--hb-y, 0) * 100%);
    background: linear-gradient(180deg,
        color-mix(in srgb, var(--htmlbubble-tint) 80%, transparent) 0%,
        color-mix(in srgb, var(--htmlbubble-tint) 40%, transparent) 100%);
    pointer-events: none;
}

.sw-fader-cap {
    position: absolute;
    left: -14%;
    right: -14%;
    height: 13%;
    border-radius: 6px;
    background: linear-gradient(180deg, #fffaf6 0%, #b9aab2 100%);
    box-shadow: 0 4px 9px rgba(0,0,0,.45);
    top: calc(var(--hb-y, 0) * 87%);
    pointer-events: none;
}

.sw-big {
    grid-column: 1;
    justify-self: center;
    width: calc(var(--hb-unit, 280px) * .3);
    height: calc(var(--hb-unit, 280px) * .3);
    border-radius: 50%;
    background:
        radial-gradient(circle at 36% 28%, rgba(255,255,255,.9), transparent 52%),
        radial-gradient(circle at 50% 60%,
            color-mix(in srgb, var(--htmlbubble-tint) 84%, #fff) 0%,
            color-mix(in srgb, var(--htmlbubble-tint) 44%, #7c4f60) 100%);
    box-shadow:
        0 7px 0 color-mix(in srgb, var(--htmlbubble-tint) 30%, #4a3742),
        0 12px 20px rgba(0,0,0,.35);
    /* --hb-p 按住是 1,松开是 0 */
    transform: translateY(calc(var(--hb-p, 0) * 5px));
    filter: brightness(calc(1 - var(--hb-p, 0) * .1));
    transition: transform .09s ease, filter .09s ease;
}`,
    },
]);

/**
 * 内置模板(写代码模式)。
 *
 * ★ 这三套挑的都是**不写 JS 就绝对做不出来**的东西 ——
 *   甩出去会弹的球、跟手画线、点一下炸开的粒子。
 *   要是随便放几个「其实 free 模式就能做」的例子,用户读完还是不知道
 *   这一档到底多了什么。
 * ★ 每条都必须同时有 html / css / js(js 可以是空串,但键要在)。
 */
export const CODE_HTML_TEMPLATES = Object.freeze([
    {
        id: 'ball',
        name: '弹球',
        description: '抓住甩出去,会撞墙回弹',
        html: '<div class="bl-ball"></div>',
        css: `.bl-ball {
    position: absolute;
    left: 0;
    top: 0;
    width: 22%;
    aspect-ratio: 1;
    border-radius: 50%;
    background:
        radial-gradient(circle at 34% 27%, #fff 0%, rgba(255,255,255,.45) 20%, transparent 58%),
        var(--tint);
    box-shadow:
        0 7px 15px rgba(70,50,60,.3),
        inset 0 -5px 10px rgba(0,0,0,.18),
        inset 0 4px 8px rgba(255,255,255,.5);
    will-change: transform;
}`,
        js: `// 抓住球甩出去,松手之后它自己按重力飞、撞墙回弹。
var ball = hb.el.querySelector('.bl-ball');
var x = hb.width / 2;
var y = hb.height / 3;
var vx = 0, vy = 0, r = 0;
var dragging = false, lastX = 0, lastY = 0, lastT = 0;

function measure() { r = ball.offsetWidth / 2; }
measure();
hb.on('resize', measure);

hb.el.addEventListener('pointerdown', function (e) {
    dragging = true;
    vx = vy = 0;
    x = e.clientX; y = e.clientY;
    lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
    hb.haptic('light');
    try { hb.el.setPointerCapture(e.pointerId); } catch (err) {}
});

hb.el.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var now = performance.now();
    var dt = Math.max(1, now - lastT);
    // 换算成「每帧走多少像素」,松手时就是初速度
    vx = (e.clientX - lastX) / dt * 16;
    vy = (e.clientY - lastY) / dt * 16;
    x = e.clientX; y = e.clientY;
    lastX = e.clientX; lastY = e.clientY; lastT = now;
});

function release() { dragging = false; }
hb.el.addEventListener('pointerup', release);
hb.el.addEventListener('pointercancel', release);

function bounce() {
    var speed = Math.sqrt(vx * vx + vy * vy);
    if (speed < 1.6) return;   // 快停下时别一直哒哒响
    hb.sound({ rate: 0.8 + Math.min(1.2, speed / 22) });
    hb.haptic(speed > 12 ? 'medium' : 'light');
}

function tick() {
    if (!dragging) {
        vy += 0.9;                       // 重力
        x += vx;
        y += vy;
        var w = hb.width, h = hb.height;
        if (x < r)     { x = r;     vx = -vx * 0.72; bounce(); }
        if (x > w - r) { x = w - r; vx = -vx * 0.72; bounce(); }
        if (y < r)     { y = r;     vy = -vy * 0.72; bounce(); }
        if (y > h - r) { y = h - r; vy = -vy * 0.72; vx *= 0.98; bounce(); }
    }
    ball.style.transform = 'translate(' + (x - r) + 'px,' + (y - r) + 'px)';
    // ★ 一定要用 requestAnimationFrame。写 while 循环会把整个 App 卡死
    requestAnimationFrame(tick);
}
tick();`,
    },
    {
        id: 'doodle',
        name: '涂鸦板',
        description: '跟着手指画线,画的东西会存下来',
        html: `<canvas class="dw-pad"></canvas>
<button class="dw-clear" type="button">擦掉</button>`,
        css: `.dw-pad {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border-radius: 24px;
    background: #fffdf8;
    box-shadow: inset 0 0 0 1.5px rgba(107,85,96,.12), 0 8px 20px rgba(107,85,96,.14);
    touch-action: none;
}

.dw-clear {
    position: absolute;
    right: 6%;
    bottom: 5%;
    padding: 7px 15px;
    border: none;
    border-radius: 999px;
    background: color-mix(in srgb, var(--tint) 70%, #fff);
    color: #6b5560;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 3px 8px rgba(107,85,96,.25);
    cursor: pointer;
}

.dw-clear:active { transform: translateY(2px); }`,
        js: `// 手指按住画线。画完的笔画存进 hb.state,下次打开还在。
var pad = hb.el.querySelector('.dw-pad');
var clearBtn = hb.el.querySelector('.dw-clear');
var ctx = pad.getContext('2d');
var dpr = Math.min(2, window.devicePixelRatio || 1);

// 每一笔是一串点:[[x1,y1],[x2,y2],...],坐标存 0~1 的比例,
// 这样换个屏幕大小重画出来还是原样
var strokes = Array.isArray(hb.state.strokes) ? hb.state.strokes : [];
var MAX_POINTS = 3000;
var current = null;
var soundAt = 0;

function resize() {
    pad.width = Math.round(pad.clientWidth * dpr);
    pad.height = Math.round(pad.clientHeight * dpr);
    redraw();
}

function redraw() {
    ctx.clearRect(0, 0, pad.width, pad.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, pad.width * 0.016);
    ctx.strokeStyle = hb.tint;
    for (var i = 0; i < strokes.length; i += 1) {
        var pts = strokes[i];
        if (!pts || pts.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(pts[0][0] * pad.width, pts[0][1] * pad.height);
        for (var j = 1; j < pts.length; j += 1) {
            ctx.lineTo(pts[j][0] * pad.width, pts[j][1] * pad.height);
        }
        ctx.stroke();
    }
}

function countPoints() {
    var n = 0;
    for (var i = 0; i < strokes.length; i += 1) n += strokes[i].length;
    return n;
}

pad.addEventListener('pointerdown', function (e) {
    var rect = pad.getBoundingClientRect();
    current = [[(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height]];
    strokes.push(current);
    hb.haptic('light');
    try { pad.setPointerCapture(e.pointerId); } catch (err) {}
});

pad.addEventListener('pointermove', function (e) {
    if (!current) return;
    var rect = pad.getBoundingClientRect();
    current.push([(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height]);
    redraw();
    // 画的时候沙沙响,但别每个点都响
    var now = performance.now();
    if (now - soundAt > 110) {
        soundAt = now;
        hb.sound({ rate: 1.5 + Math.random() * 0.5 });
    }
});

function finish() {
    if (!current) return;
    current = null;
    // 点太多了就把最老的一笔丢掉,免得存档越滚越大
    while (countPoints() > MAX_POINTS && strokes.length > 1) strokes.shift();
    redraw();
    hb.save({ strokes: strokes });
}
pad.addEventListener('pointerup', finish);
pad.addEventListener('pointercancel', finish);

clearBtn.addEventListener('click', function () {
    strokes = [];
    redraw();
    hb.save({ strokes: strokes });
    hb.haptic('medium');
    hb.sound({ rate: 0.7 });
});

hb.on('resize', resize);
hb.on('tint', redraw);
resize();`,
    },
    {
        id: 'spark',
        name: '烟花',
        description: '点哪儿哪儿炸开一把星星',
        html: '<canvas class="sp-sky"></canvas>',
        css: `.sp-sky {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border-radius: 26px;
    background: radial-gradient(circle at 50% 40%, #2c2740 0%, #16131f 100%);
    box-shadow: inset 0 0 40px rgba(0,0,0,.6), 0 10px 24px rgba(20,16,28,.4);
    touch-action: none;
}`,
        js: `// 点一下就在那儿炸开一把粒子,自己飞散、变暗、消失。
var sky = hb.el.querySelector('.sp-sky');
var ctx = sky.getContext('2d');
var dpr = Math.min(2, window.devicePixelRatio || 1);
var parts = [];

function resize() {
    sky.width = Math.round(sky.clientWidth * dpr);
    sky.height = Math.round(sky.clientHeight * dpr);
}
hb.on('resize', resize);
resize();

function burst(px, py) {
    var n = 26 + Math.floor(Math.random() * 14);
    var hue = Math.random() * 360;
    for (var i = 0; i < n; i += 1) {
        var a = (Math.PI * 2 * i) / n + Math.random() * 0.3;
        var sp = (1.6 + Math.random() * 3.4) * dpr;
        parts.push({
            x: px, y: py,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: 1,
            hue: hue + Math.random() * 50,
            size: (1.4 + Math.random() * 2.2) * dpr,
        });
    }
    // 粒子太多会掉帧,超了就把最老的砍掉
    if (parts.length > 700) parts.splice(0, parts.length - 700);
    hb.sound({ rate: 0.85 + Math.random() * 0.6 });
    hb.haptic('medium');
}

sky.addEventListener('pointerdown', function (e) {
    var rect = sky.getBoundingClientRect();
    burst((e.clientX - rect.left) / rect.width * sky.width,
          (e.clientY - rect.top) / rect.height * sky.height);
});

function tick() {
    // 不清干净、盖一层半透明黑,自然就有拖尾
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(18,15,26,.28)';
    ctx.fillRect(0, 0, sky.width, sky.height);

    ctx.globalCompositeOperation = 'lighter';
    for (var i = parts.length - 1; i >= 0; i -= 1) {
        var p = parts[i];
        p.vy += 0.05 * dpr;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.016;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        ctx.fillStyle = 'hsla(' + p.hue + ',90%,' + (58 + p.life * 20) + '%,' + p.life + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    }
    requestAnimationFrame(tick);
}
tick();`,
    },
]);

/** 按布局模式取模板清单 */
function templateListOf(layout) {
    if (layout === 'free') return FREE_HTML_TEMPLATES;
    if (layout === 'code') return CODE_HTML_TEMPLATES;
    return DEFAULT_HTML_TEMPLATES;
}

/**
 * 按 id 取内置模板。
 * ★ 永远返回一个对象 —— 调用方是 `getDefaultTemplateById(id).html` 直接取属性的。
 *   id 对不上(比如存档里是粘贴出来的 'custom')就退回对应模式的第一条。
 * @param {string} templateId
 * @param {'grid'|'free'|'code'} [layout] 不传按格子模式查(老调用点不用改)
 */
export function getDefaultTemplateById(templateId, layout) {
    const list = templateListOf(layout);
    const hit = list.find(item => item.id === templateId);
    return hit || list[0];
}

/** 存档里的 layout 只认这三个值,别的一律当格子 */
function normalizeLayout(value) {
    if (value === 'free') return 'free';
    if (value === 'code') return 'code';
    return 'grid';
}

/** 配置区间 2~12:再小看不出是块板,再大在手机上糊成一团 */
function clampGrid(value, fallback, min = 2, max = 12) {
    const num = Math.floor(Number(value));
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
}

/**
 * 稳定的伪随机。
 * ★ 不能用 Math.random():每次重建板子都会换一批倾斜和圆角,
 *   用户调个行数就发现「所有格子的形状全变了」,像 bug。
 */
function pseudoRandom(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}

function blobRadius(seed) {
    const pick = (k) => 36 + Math.round(pseudoRandom(seed * 7 + k) * 26);
    return `${pick(1)}% ${pick(2)}% ${pick(3)}% ${pick(4)}% / ${pick(5)}% ${pick(6)}% ${pick(7)}% ${pick(8)}%`;
}

/**
 * 把 {row}/{col}/{index}/{total} 换成这一格的真实值。
 * ★ 自由模式也要走一趟(传 0/0/0/1)—— 用户从格子模式复制过来的代码里
 *   可能还留着 {index},不换的话会在页面上原样显示出「{index}」四个字。
 */
function expandTemplate(html, ctx) {
    return String(html || '')
        .replace(/\{row\}/g, String(ctx.row))
        .replace(/\{col\}/g, String(ctx.col))
        .replace(/\{index\}/g, String(ctx.index))
        .replace(/\{total\}/g, String(ctx.total));
}

function plainObject(value) {
    return (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
}

let scopeSeq = 0;

registerRelaxToy({
    id: 'custom-html-board',
    name: '我的捏捏',
    summary: '自己写 HTML,做专属捏捏',
    icon: CUSTOM_ICON,
    defaultTint: '#ffd6e0',
    tintable: true,
    fit: 'plate',
    aspect: 1,
    defaultSoundId: 'pop-soft',
    resettable: true,
    deletable: true,
    // ★ 只有格子模式吃这个。自由模式下「板子规格」那一栏会由 ToyPanel 自己收起来
    //   (它读 toyState.layout),这里保留声明是因为切回格子模式还要用。
    configurable: { type: 'grid', rows: 4, cols: 4, min: 2, max: 12 },
    // ★ 这是全 App 唯一一个 customizable 主体 —— 编辑页(components/pages/custom-toy-page.js)
    //   就是冲着它来的。取消这个标记,「写 HTML」按钮会从捏捏面板上消失。
    customizable: true,
    htmlTemplates: [
        ...DEFAULT_HTML_TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description, layout: 'grid' })),
        ...FREE_HTML_TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description, layout: 'free' })),
        ...CODE_HTML_TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description, layout: 'code' })),
    ],

    mount(host) {
        // ---------- 初始参数 ----------
        const saved = host.getState() || {};
        let layout = normalizeLayout(saved.layout);
        let rows = clampGrid(saved.rows, 4);
        let cols = clampGrid(saved.cols, 4);

        const fallback = getDefaultTemplateById(saved.activeTemplateId, layout);
        let activeTemplateId = saved.activeTemplateId || fallback.id;

        // 存档里没写过就用模板自带的;写过就用用户的
        let html = typeof saved.html === 'string' && saved.html.trim() ? saved.html : fallback.html;
        let css = typeof saved.css === 'string' && saved.css.trim() ? saved.css : fallback.css;
        let js = typeof saved.js === 'string' && saved.js.trim() ? saved.js : (fallback.js || '');

        // popped 必须在这里就兜成数组,后面 push 才不会炸
        let popped = Array.isArray(saved.popped) ? saved.popped.slice() : [];
        // 自由模式下每个零件的值(开关开着没、推子推到哪)
        let partValues = plainObject(saved.parts);
        // 写代码模式下用户自己 hb.save() 存的东西
        let codeState = plainObject(saved.codeState);

        // 最近一次 setSize 的结果,build() 之后要拿它重新算单位
        let lastWidth = 0;
        let lastHeight = 0;

        // ---------- DOM ----------
        const scopeId = `hb${Date.now().toString(36)}${(scopeSeq += 1)}`;

        const root = document.createElement('div');
        root.className = 'htmlbubble-root';
        root.setAttribute('data-htmlbubble-scope', scopeId);

        const styleEl = document.createElement('style');
        // ★ 这个 <style> 挂在 root 内部,跟着 root 一起被销毁 —— 不是全局样式表
        root.appendChild(styleEl);

        // 格子模式的两层:奶白板子 + 网格
        const board = document.createElement('div');
        board.className = 'htmlbubble-board';
        const grid = document.createElement('div');
        grid.className = 'htmlbubble-grid';
        board.appendChild(grid);

        /*
         * 自由模式的舞台。
         * ★ 故意不套 .htmlbubble-board —— 那层奶白圆角外壳是「一块气泡纸板」的样子,
         *   垫在摇杆或者鼠标底下就成了「摇杆自带一个托盘」。要不要盘子归
         *   「装扮 → 盘子」的开关管,主体不写死(和 demo-jelly 当年踩的是同一个坑)。
         */
        const stage = document.createElement('div');
        stage.className = 'hbfree-stage';

        /** 写代码模式的沙箱容器,里面只有一个 iframe */
        const codeSlot = document.createElement('div');
        codeSlot.className = 'hbcode-stage';

        host.el.appendChild(root);

        /** 自由模式的零件引擎。切走时销毁,不留监听。 */
        let parts = null;
        /** 写代码模式的沙箱。同上。 */
        let sandbox = null;
        /** 沙箱报错只提示一次 —— 用户代码可能每帧都抛,弹几十条岛提示就没法用了 */
        let codeErrorShown = false;

        function destroyParts() {
            if (parts) {
                parts.destroy();
                parts = null;
            }
        }

        function destroySandbox() {
            if (sandbox) {
                sandbox.destroy();
                sandbox = null;
            }
            if (codeSlot.parentNode) codeSlot.remove();
        }

        /** 用户 CSS → 包一层作用域再写进 <style>,顺手返回消毒后的 HTML */
        function renderCss() {
            const safe = sanitizeToyTemplate(html, css, { layout });
            styleEl.textContent = `[data-htmlbubble-scope="${scopeId}"] {\n${safe.css}\n}`;
            return safe;
        }

        function buildGrid(safe) {
            destroyParts();
            if (stage.parentNode) stage.remove();
            if (!board.parentNode) root.appendChild(board);

            grid.style.setProperty('--htmlbubble-rows', String(rows));
            grid.style.setProperty('--htmlbubble-cols', String(cols));
            grid.innerHTML = '';

            const poppedSet = new Set(popped);
            const total = rows * cols;

            for (let i = 0; i < total; i += 1) {
                const r = Math.floor(i / cols);
                const c = i % cols;

                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'htmlbubble-host';
                cell.dataset.index = String(i);
                cell.dataset.row = String(r);
                cell.dataset.col = String(c);
                cell.style.setProperty('--bubble-round', blobRadius(i + 1));
                cell.style.setProperty('--hb-tilt', `${(pseudoRandom(i + 1) * 2 - 1) * 5}deg`);
                if (poppedSet.has(i)) cell.classList.add('is-popped');

                // ★ 消毒后的 html 才允许进 innerHTML
                cell.innerHTML = expandTemplate(safe.html, { row: r, col: c, index: i, total });
                grid.appendChild(cell);
            }
        }

        function buildFree(safe) {
            if (board.parentNode) board.remove();
            if (!stage.parentNode) root.appendChild(stage);

            // ★ 重建 DOM 之前先把旧引擎拆掉:它手里攥着上一批节点的引用和
            //   window 上的 pointermove 监听,不拆就是一次实打实的泄漏。
            destroyParts();
            stage.innerHTML = expandTemplate(safe.html, { row: 0, col: 0, index: 0, total: 1 });

            parts = createToyParts(stage, {
                values: partValues,
                playSound: (opts) => host.playSound(opts),
                haptic: (strength) => host.haptic(strength),
                onPersist: (values) => {
                    partValues = values;
                    host.setState({ parts: values, layout });
                },
            });
        }

        /**
         * 写代码模式:整块交给沙箱 iframe。
         * ★ 用户 CSS 不进外面这个 <style> —— 它在 iframe 里面。
         *   忘了清的话,从别的档切过来时上一档的样式还挂着。
         */
        function buildCode() {
            styleEl.textContent = '';
            if (board.parentNode) board.remove();
            if (stage.parentNode) stage.remove();
            if (!codeSlot.parentNode) root.appendChild(codeSlot);

            codeErrorShown = false;

            if (sandbox) {
                sandbox.reload({ html, css, js });
                return;
            }
            sandbox = createToySandbox(codeSlot, {
                html,
                css,
                js,
                tint: host.tint,
                values: codeState,
                playSound: (opts) => host.playSound(opts),
                haptic: (strength) => host.haptic(strength),
                notify: (title, message) => host.notify('info', title, message),
                onPersist: (values) => {
                    codeState = values;
                    host.setState({ codeState: values, layout });
                },
                onError: (message) => {
                    if (codeErrorShown) return;
                    codeErrorShown = true;
                    host.notify('error', '这块捏捏报错了', message);
                },
            });
        }

        /** 整块重建。切模式 / 改代码 / 调行列都走这里。 */
        function build() {
            // 先把不属于当前这一档的运行时拆掉,免得两套同时活着抢指针
            if (layout !== 'free') destroyParts();
            if (layout !== 'code') destroySandbox();

            root.classList.toggle('is-free', layout === 'free');
            root.classList.toggle('is-code', layout === 'code');

            if (layout === 'code') {
                buildCode();
            } else {
                const safe = renderCss();
                if (layout === 'free') buildFree(safe);
                else buildGrid(safe);
            }
            applyUnit(lastWidth, lastHeight);
        }

        /**
         * 把容器尺寸换算成用户能用的长度单位。
         *   格子模式:--htmlbubble-unit = 一格的边长
         *   自由模式:--hb-unit = 容器短边,预设全靠它按比例缩放
         */
        function applyUnit(width, height) {
            const w = width || host.el.offsetWidth;
            const h = height || host.el.offsetHeight;
            if (!w || !h) return;
            const shortSide = Math.min(w, h);
            const cellSide = shortSide / Math.max(rows, cols);
            root.style.setProperty('--hb-unit', `${shortSide}px`);
            root.style.setProperty('--htmlbubble-unit', `${cellSide}px`);
            // ★ 别名。提示词从第一版起写的就是 --bubble-unit,而代码里一直只设
            //   --htmlbubble-unit —— 照着提示词写字号的人拿到的全是兜底值。
            //   两个名字都留着,老存档和新代码都能跑。
            root.style.setProperty('--bubble-unit', `${cellSide}px`);
        }

        build();

        // ---------- 交互(格子模式) ----------
        function squish(cell, index) {
            // 重播动画:先摘类、强制重排、再加回去
            cell.classList.remove('is-squish');
            void cell.offsetWidth;
            cell.classList.add('is-squish');

            host.playSound({ rate: 0.92 + pseudoRandom(index + 3) * 0.18 });
            host.haptic('light');

            if (!cell.classList.contains('is-popped')) {
                cell.classList.add('is-popped');
                popped.push(index);
                host.setState({ popped: popped.slice(), rows, cols, layout });

                if (popped.length === rows * cols) {
                    host.notify('success', '整块都捏过了', '在「捏捏」里点「恢复主体」再来一轮');
                }
            }
        }

        function onPointerDown(event) {
            const cell = event.target.closest?.('.htmlbubble-host');
            if (!cell || !grid.contains(cell)) return;
            event.preventDefault();
            squish(cell, Number(cell.dataset.index));
        }

        // 挂在 grid 上,自由模式下这棵子树根本不在文档里,不会误触发
        grid.addEventListener('pointerdown', onPointerDown);
        host.onCleanup(() => {
            grid.removeEventListener('pointerdown', onPointerDown);
            destroyParts();
            destroySandbox();
        });

        // ---------- controller ----------
        return {
            destroy() {
                destroyParts();
                destroySandbox();
                root.remove();
            },
            setTint(hex) {
                root.style.setProperty('--htmlbubble-tint', hex);
                root.style.setProperty('--rx-toy-tint', hex);
                // 沙箱是独立文档,CSS 变量传不进去,只能靠消息推
                sandbox?.setTint(hex);
            },
            setSize(width, height) {
                lastWidth = width;
                lastHeight = height;
                applyUnit(width, height);
            },
            setRowsCols(nextRows, nextCols) {
                rows = clampGrid(nextRows, rows);
                cols = clampGrid(nextCols, cols);
                // 调整个数 = 「重来」语义,旧的 popped 索引对不上新板子了
                popped = [];
                host.setState({ rows, cols, popped: [] });
                // free / code 跟行列无关,重建一遍反而会把玩到一半的东西打断
                if (layout === 'grid') build();
                else applyUnit(lastWidth, lastHeight);
            },
            /**
             * 编辑页点「应用到主体」时走这里(relax-root → toy-host.applyHtmlTemplate)。
             * ★ 热更而不是 remount —— 已经捏过的格子(popped)要保住,
             *   否则用户每改一次 CSS,板子就整个复原,没法边调边看效果。
             */
            setHtmlTemplate(payload) {
                if (!payload) return;
                if (typeof payload.html === 'string') html = payload.html;
                if (typeof payload.css === 'string') css = payload.css;
                if (typeof payload.js === 'string') js = payload.js;
                if (payload.activeTemplateId) activeTemplateId = payload.activeTemplateId;
                if (payload.layout) {
                    const next = normalizeLayout(payload.layout);
                    // 换模式 = 换了个完全不同的东西,上一套的进度留着没有意义,
                    // 而且零件名、格子序号、沙箱存档的键根本对不上
                    if (next !== layout) {
                        layout = next;
                        popped = [];
                        partValues = {};
                        codeState = {};
                    }
                }
                build();
            },
            reset() {
                popped = [];
                partValues = {};
                codeState = {};
                /*
                 * ★ 这里必须把 html / css / layout 一起写回去。
                 *   「恢复主体」在 relax-root 里是先 store.clearToyState() 再调这个 reset ——
                 *   clearToyState 是把整张便签删掉,用户写的代码也在那张便签上。
                 *   只写 popped / parts 的话,当场看不出问题(内存里的 html 还在),
                 *   等下次重挂主体才发现代码变回了默认模板 —— 自由模式下那可能是
                 *   一整个手柄的心血。恢复的是「进度」,不是「作品」。
                 */
                host.setState({
                    popped: [],
                    parts: {},
                    codeState: {},
                    rows,
                    cols,
                    layout,
                    html,
                    css,
                    js,
                    activeTemplateId,
                });
                if (layout === 'code') {
                    sandbox?.reset();
                    return;
                }
                if (layout === 'free') {
                    parts?.reset();
                    return;
                }
                grid.querySelectorAll('.htmlbubble-host').forEach((cell) => {
                    cell.classList.remove('is-popped', 'is-squish');
                });
            },
        };
    },
});
