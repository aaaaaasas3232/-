// @audit-ignore 气泡预设中的颜色是用户可编辑的主题数据，不是界面硬编码配色
/**
 * 气泡机 · 内置气泡预设
 *
 * ── 这里为什么可以写颜色 ──────────────────────────────────────────
 *
 * 项目规矩是「JS 里一个 hex 都不许出现」,那条规矩针对的是**界面配色**:
 * 界面配色写死在 JS 里,换主题时就换不动。
 *
 * 而气泡的底色 / 文字色是**用户内容**:
 *   - 它跟着气泡走,不跟着界面主题走(用户不会希望换个 App 皮肤,
 *     自己调了半天的粉色气泡突然变成绿的)
 *   - 用户导出的 CSS 要能粘到别处去用,里面出现 `var(--bb-primary)`
 *     就成了没有定义的变量
 *
 * 所以这几套「开箱即用」的气泡是具体色值,而且**一进库就是用户的了**,
 * 之后随便他改。
 *
 * 配色取自马卡龙 / 果冻色系:低饱和、高明度、偏奶油。
 */

import { createBubbleConfig } from '@/src/core/bubble-style.js';

/**
 * 「用户内容」类颜色的默认值,全 App 只有这一处。
 *
 * SVG 工作台的初始上色、新加渐变色标的初始色 —— 它们都会变成用户数据,
 * 所以必须是具体值(不能是 `var(--bb-*)`,那样导出的 SVG 粘到别处就没颜色了)。
 * 收在这个文件里是为了让「JS 里出现 hex」这件事只发生在一个有理由的地方。
 */
export const CONTENT_DEFAULTS = Object.freeze({
    /** SVG 工作台的默认填充 */
    svgFill: '#F2A9BE',
    /** SVG 工作台开启描边时的默认色 */
    svgStroke: '#8A7A80',
    /** 新加一个渐变色标时的兜底色 */
    gradientStop: '#FFFFFF',
});

/**
 * 内置预设。
 *
 * 每套都成对给出「右侧(自己)」和「左侧(对方)」两个气泡 ——
 * 单独一个气泡看不出好不好用,得看一屏对话摆在一起的样子。
 */
export const BUBBLE_PRESETS = Object.freeze([
    {
        id: 'strawberry',
        name: '草莓牛奶',
        desc: '奶粉底 + 水滴尾巴',
        right: {
            bgColor: '#FFD9E4', textColor: '#7A4A58',
            radiusTL: 20, radiusTR: 20, radiusBR: 8, radiusBL: 20,
            shadowY: 3, shadowBlur: 10, shadowColor: '#E091AB', shadowOpacity: 22,
            tails: [{ shape: 'drop', anchor: 'right', along: 84, offset: 7, size: 14, rotation: 90 }],
        },
        left: {
            bgColor: '#FFFFFF', textColor: '#6B5A61',
            radiusTL: 20, radiusTR: 20, radiusBR: 20, radiusBL: 8,
            borderWidth: 1.5, borderColor: '#F6DCE4',
            shadowY: 3, shadowBlur: 10, shadowColor: '#C9A6B2', shadowOpacity: 16,
            tails: [{ shape: 'drop', anchor: 'left', along: 84, offset: 7, size: 14, rotation: 90, flipX: true }],
        },
    },
    {
        id: 'mint',
        name: '薄荷汽水',
        desc: '清透 + 细描边',
        right: {
            bgColor: '#CFEDE4', textColor: '#3F6A5E',
            radiusTL: 22, radiusTR: 22, radiusBR: 6, radiusBL: 22,
            borderWidth: 1.5, borderColor: '#A5D9C9',
            shadowY: 2, shadowBlur: 8, shadowColor: '#5FA994', shadowOpacity: 18,
            tails: [{ shape: 'leaf', anchor: 'bottom', along: 90, offset: 7, size: 14, rotation: 180 }],
        },
        left: {
            bgColor: '#F4FBF8', textColor: '#4A6B62',
            radiusTL: 22, radiusTR: 22, radiusBR: 22, radiusBL: 6,
            borderWidth: 1.5, borderColor: '#CDE9DF',
            shadowY: 2, shadowBlur: 8, shadowColor: '#5FA994', shadowOpacity: 12,
            tails: [{ shape: 'leaf', anchor: 'bottom', along: 10, offset: 7, size: 14, rotation: 180, flipX: true }],
        },
    },
    {
        id: 'lemon',
        name: '柠檬布丁',
        desc: '厚描边 · 动森味',
        right: {
            bgColor: '#FFF0C2', textColor: '#7A6234',
            radiusTL: 22, radiusTR: 22, radiusBR: 22, radiusBL: 22,
            borderWidth: 2.5, borderColor: '#F0D488',
            shadowY: 4, shadowBlur: 0, shadowColor: '#E5C270', shadowOpacity: 60,
            tails: [{ shape: 'round', anchor: 'bottom', along: 92, offset: 9, size: 11, strokeWidth: 2.5, strokeColor: '#F0D488' }],
        },
        left: {
            bgColor: '#FFFDF6', textColor: '#6E6349',
            radiusTL: 22, radiusTR: 22, radiusBR: 22, radiusBL: 22,
            borderWidth: 2.5, borderColor: '#EDE2C4',
            shadowY: 4, shadowBlur: 0, shadowColor: '#DCCFA8', shadowOpacity: 55,
            tails: [{ shape: 'round', anchor: 'bottom', along: 8, offset: 9, size: 11, strokeWidth: 2.5, strokeColor: '#EDE2C4' }],
        },
    },
    {
        id: 'grape',
        name: '葡萄冻',
        desc: '毛玻璃 · 半透',
        right: {
            bgColor: '#C9B6E8', bgOpacity: 62, blur: 12, textColor: '#463461',
            radiusTL: 24, radiusTR: 24, radiusBR: 10, radiusBL: 24,
            borderWidth: 1, borderColor: '#FFFFFF', borderOpacity: 60,
            shadowY: 6, shadowBlur: 18, shadowColor: '#6B4E9B', shadowOpacity: 22,
            tails: [],
        },
        left: {
            bgColor: '#FFFFFF', bgOpacity: 55, blur: 12, textColor: '#5A4E68',
            radiusTL: 24, radiusTR: 24, radiusBR: 24, radiusBL: 10,
            borderWidth: 1, borderColor: '#FFFFFF', borderOpacity: 70,
            shadowY: 6, shadowBlur: 18, shadowColor: '#6B4E9B', shadowOpacity: 14,
            tails: [],
        },
    },
    {
        id: 'cocoa',
        name: '可可奶盖',
        desc: '暖褐 · 无尾巴',
        right: {
            bgColor: '#E4CBB3', textColor: '#5C4433',
            radiusTL: 18, radiusTR: 18, radiusBR: 18, radiusBL: 18,
            shadowY: 2, shadowBlur: 10, shadowColor: '#8A6748', shadowOpacity: 20,
            tails: [],
        },
        left: {
            bgColor: '#FBF5EE', textColor: '#645244',
            radiusTL: 18, radiusTR: 18, radiusBR: 18, radiusBL: 18,
            borderWidth: 1.5, borderColor: '#EADDCD',
            shadowY: 2, shadowBlur: 10, shadowColor: '#8A6748', shadowOpacity: 12,
            tails: [],
        },
    },
    {
        id: 'plain',
        name: '白纸',
        desc: '什么都没有,从头调',
        right: {
            bgColor: '#FFFFFF', textColor: '#4A4A4A',
            radiusTL: 14, radiusTR: 14, radiusBR: 14, radiusBL: 14,
            borderWidth: 1, borderColor: '#E4E4E4',
            shadowOpacity: 0, tails: [],
        },
        left: {
            bgColor: '#F6F6F6', textColor: '#4A4A4A',
            radiusTL: 14, radiusTR: 14, radiusBR: 14, radiusBL: 14,
            borderWidth: 1, borderColor: '#E4E4E4',
            shadowOpacity: 0, tails: [],
        },
    },

    /*
     * 经典 —— 1:1 复刻 QAQ/sms.js 经典主题(「builtin-classic」)。
     *
     * 这套气泡的标志是那条 iOS 短信同款的小斜尾巴,贴在气泡**左上/右上
     * 角附近**,距离气泡顶 6px、距离气泡左/右 10px。这是 sms.js 的招牌几何:
     * 尾巴不在气泡下边(那是聊天机器人的画法),而在气泡顶部 —— 跟 iOS 短信
     * 一致。
     *
     * 关键观察:sms.js 的尾巴跟气泡**几何上不重叠** —— 尾巴距气泡左/右 10px,
     * 而气泡左边框在 0.4px(border 0.8 居中),两者相距 10px。所以尾巴的灰描
     * 边和气泡的灰边在视觉上不连成一条线,看起来就是"无痕衔接"。
     * 这是几何效果,不是什么 z-index 障眼法 —— 几何对了,根本不会出现那条
     * 多余灰线。
     *
     * 定位参数完全照搬 sms.js CSS 变量:
     *   --bubble-border-radius: 22px
     *   --bubble-border-width: 0.8px
     *   --ai-bg-color: #FFFFFF      --user-bg-color: #E8E8E8
     *   --ai-border-color: #BCBCBC  --user-border-color: #BCBCBC
     *   --tail-width: 12px          --tail-height: 10px
     *   --tail-offset-x: 10px       --tail-offset-y: 6px
     */
    {
        id: 'classic',
        name: '经典',
        desc: 'iOS 短信 · 灰描边 + 经典尾巴',
        right: {
            bgColor: '#E8E8E8', textColor: '#4A4A4A',
            radiusTL: 22, radiusTR: 22, radiusBR: 22, radiusBL: 22,
            borderWidth: 0.8, borderColor: '#BCBCBC',
            shadowOpacity: 0,
            tails: [{ shape: 'classic', size: 12, pos: { top: 6, right: 10 } }],
        },
        left: {
            bgColor: '#FFFFFF', textColor: '#333333',
            radiusTL: 22, radiusTR: 22, radiusBR: 22, radiusBL: 22,
            borderWidth: 0.8, borderColor: '#BCBCBC',
            shadowOpacity: 0,
            tails: [{ shape: 'classic', size: 12, pos: { top: 6, left: 10 }, flipX: true }],
        },
    },
]);

/**
 * 取一套预设的某一侧,补成完整配置。
 *
 * @param {string} presetId
 * @param {'left'|'right'} side
 */
export function buildPreset(presetId, side = 'right') {
    const preset = BUBBLE_PRESETS.find((p) => p.id === presetId) || BUBBLE_PRESETS[0];
    const part = side === 'left' ? preset.left : preset.right;
    return createBubbleConfig({
        ...part,
        side,
        name: `${preset.name}·${side === 'left' ? '左' : '右'}`,
    });
}

/** 预设卡片用的缩略配置(左右各一) */
export function previewPair(presetId) {
    return { left: buildPreset(presetId, 'left'), right: buildPreset(presetId, 'right') };
}
