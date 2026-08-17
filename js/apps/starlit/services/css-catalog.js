/**
 * 点灯 · CSS 属性知识库
 *
 * 长按代码里的某一行 → 这一行如果是 CSS 声明，就查这张表，
 * 把「它是什么 / 为什么存在 / 能填什么 / 改了会怎样」摆出来给学生点。
 *
 * 这张表是**离线**的：改一个 display 的值不该去调 API。
 * 表里没有的属性走自由输入 + 「问老师」按钮（那才调 AI）。
 *
 * why 一栏是这个 App 的规矩：不写「它是干嘛的」，写「它当初为什么会出现」。
 */

/** value 里的 effect 是「改成它之后会发生什么」，学生点一下就能在预览里验证 */
export const CSS_PROPS = Object.freeze({
    display: {
        label: '显示方式',
        desc: '决定这个元素在页面里以什么「身份」参与排版。',
        why: '早年网页就是文档，元素只有「独占一行」和「跟在文字里」两种。display 就是这个分野的名字。后来页面越做越像应用，才陆续加上 flex（1；2013）和 grid（2017）——它们是为「排版」而不是「文档」发明的。',
        values: [
            { value: 'block', label: '块', effect: '独占一整行，宽度默认撑满父元素' },
            { value: 'inline', label: '行内', effect: '像一个词一样跟在文字里，设宽高无效' },
            { value: 'inline-block', label: '行内块', effect: '跟在文字里，但能设宽高' },
            { value: 'flex', label: '弹性容器', effect: '子元素排成一行，可以分配剩余空间' },
            { value: 'inline-flex', label: '行内弹性', effect: '同 flex，但自己是行内的' },
            { value: 'grid', label: '网格容器', effect: '子元素按行列落格子' },
            { value: 'none', label: '不显示', effect: '元素连位置都不占，像不存在一样' },
            { value: 'contents', label: '只留孩子', effect: '自己这个盒子消失，孩子直接交给上一层排' },
        ],
    },
    position: {
        label: '定位方式',
        desc: '决定 top/right/bottom/left 相对谁生效。',
        why: '最早只有文档流，元素一个接一个往下掉。想让某个东西「浮在上面」没有办法，于是有了 absolute / fixed。sticky 是最晚加的（要一个「滚到边上就钉住」的效果，之前只能写 JS）。',
        values: [
            { value: 'static', label: '默认', effect: '老实待在文档流里，top/left 无效' },
            { value: 'relative', label: '相对自己', effect: '从原来的位置偏移，但原位置还占着' },
            { value: 'absolute', label: '相对定位祖先', effect: '脱离文档流，相对最近的非 static 祖先定位' },
            { value: 'fixed', label: '相对视口', effect: '钉在屏幕上，滚动也不动' },
            { value: 'sticky', label: '滚到就钉住', effect: '正常排版，滚到阈值就吸住' },
        ],
    },
    'box-sizing': {
        label: '盒模型算法',
        desc: 'width/height 到底算不算 padding 和 border。',
        why: 'IE 早年算的是「含 padding 和边框」，其他浏览器算的是「只含内容」。两边吵了很多年，最后发现 IE 那套其实更好用 —— 于是标准把它收编成 border-box。今天几乎所有项目开头都会写一句全局 border-box。',
        values: [
            { value: 'content-box', label: '只算内容（默认）', effect: 'width:300px + padding:20px → 实际 340px 宽' },
            { value: 'border-box', label: '含内边距和边框', effect: 'width:300px 就是 300px，padding 从里面挤' },
        ],
    },
    padding: {
        label: '内边距',
        desc: '内容和自己边框之间的空隙。',
        why: '排版从铅字时代就有「字和框之间要留白」的规矩，CSS 只是把它搬了进来。',
        multi: [
            { n: 1, desc: '四边相同', example: 'padding: 20px' },
            { n: 2, desc: '上下 | 左右', example: 'padding: 10px 20px' },
            { n: 3, desc: '上 | 左右 | 下', example: 'padding: 10px 20px 15px' },
            { n: 4, desc: '上 右 下 左（顺时针）', example: 'padding: 10px 20px 15px 5px' },
        ],
        values: [
            { value: '0', label: '贴边', effect: '内容顶着边框，通常太挤' },
            { value: '8px', label: '很小', effect: '适合小标签' },
            { value: '16px', label: '常用', effect: '按钮、输入框的舒适值' },
            { value: '24px', label: '宽松', effect: '卡片内部' },
            { value: '1rem', label: '跟字号走', effect: '字变大它也变大' },
        ],
    },
    margin: {
        label: '外边距',
        desc: '自己和别人之间的空隙。',
        why: 'margin 有个著名的怪脾气：上下相邻的 margin 会**合并**成一个（取大的那个）。这不是 bug，是从印刷排版继承的规则 —— 两个段落之间只留一个段间距才对。',
        multi: [
            { n: 1, desc: '四边相同', example: 'margin: 20px' },
            { n: 2, desc: '上下 | 左右', example: 'margin: 10px auto' },
            { n: 4, desc: '上 右 下 左', example: 'margin: 10px 20px 15px 5px' },
        ],
        values: [
            { value: '0', label: '不留', effect: '紧贴相邻元素' },
            { value: '0 auto', label: '水平居中', effect: '块元素在父容器里左右居中（要有宽度）' },
            { value: '16px', label: '常用间隔', effect: '' },
            { value: '-8px', label: '负外边距', effect: '往回缩，会和相邻元素重叠' },
        ],
    },
    'flex-direction': {
        label: '主轴方向',
        desc: 'flex 容器里子元素往哪个方向排。',
        why: 'flex 的整套模型是「主轴 + 交叉轴」的抽象，就是为了让同一套属性既能横排也能竖排 —— 这样写响应式时改一个值就能整个转向。',
        values: [
            { value: 'row', label: '从左到右', effect: '默认，横着排' },
            { value: 'row-reverse', label: '从右到左', effect: '横着排但顺序反过来' },
            { value: 'column', label: '从上到下', effect: '竖着排，主轴变成垂直方向' },
            { value: 'column-reverse', label: '从下到上', effect: '竖着排且顺序反过来' },
        ],
    },
    'justify-content': {
        label: '主轴对齐',
        desc: '主轴上剩下的空间怎么分。',
        why: '在 flex 之前，把几个盒子「均匀分布」要靠计算百分比或者用表格，改一个元素就得重算一遍。',
        values: [
            { value: 'flex-start', label: '靠前', effect: '全部挤在主轴起点' },
            { value: 'center', label: '居中', effect: '整组居中，两边留一样多' },
            { value: 'flex-end', label: '靠后', effect: '全部挤到主轴终点' },
            { value: 'space-between', label: '两端对齐', effect: '首尾贴边，间隔均分' },
            { value: 'space-around', label: '环绕', effect: '每个元素左右各留一半间隔' },
            { value: 'space-evenly', label: '完全均分', effect: '所有缝隙一样宽，包括两头' },
        ],
    },
    'align-items': {
        label: '交叉轴对齐',
        desc: '垂直于主轴那一头怎么对齐。',
        why: '「垂直居中」曾经是前端最有名的难题，各种 hack 写了十几年。align-items:center 一行解决了它。',
        values: [
            { value: 'stretch', label: '拉满（默认）', effect: '子元素在交叉轴上被拉到一样高' },
            { value: 'flex-start', label: '顶端对齐', effect: '' },
            { value: 'center', label: '居中', effect: '经典的垂直居中' },
            { value: 'flex-end', label: '底端对齐', effect: '' },
            { value: 'baseline', label: '基线对齐', effect: '按文字的基线排齐，字号不同也整齐' },
        ],
    },
    gap: {
        label: '间隙',
        desc: 'flex / grid 子元素之间的缝。',
        why: '以前只能给每个子元素加 margin，然后再想办法把第一个和最后一个的多余 margin 去掉。gap 直接把「缝」变成了容器的属性。',
        values: [
            { value: '0', label: '无缝', effect: '' },
            { value: '8px', label: '窄', effect: '' },
            { value: '16px', label: '常用', effect: '' },
            { value: '24px', label: '宽', effect: '' },
            { value: '8px 16px', label: '行/列不同', effect: '行间距 8，列间距 16' },
        ],
    },
    color: {
        label: '文字颜色',
        desc: '这个元素里文字的颜色，会被子元素继承。',
        why: 'color 是少数会往下继承的属性之一 —— 这来自「文档」的直觉：一段话里的加粗字理应和周围一个颜色。',
        isColor: true,
        values: [
            { value: '#333333', label: '深灰', effect: '比纯黑柔和，长文更好读' },
            { value: '#000000', label: '纯黑', effect: '对比最强，也最硬' },
            { value: '#ffffff', label: '白', effect: '深色底上用' },
            { value: 'currentColor', label: '跟随当前色', effect: '常用于 SVG 描边跟着文字走' },
            { value: 'inherit', label: '继承父级', effect: '' },
        ],
    },
    'background-color': {
        label: '背景色',
        desc: '元素盒子的底色（不含外边距区域）。',
        why: '背景默认是透明的，这样嵌套的元素才能叠出层次 —— 如果默认是白色，网页就没法做任何叠加效果了。',
        isColor: true,
        values: [
            { value: 'transparent', label: '透明', effect: '露出下面的东西' },
            { value: '#ffffff', label: '白', effect: '' },
            { value: '#f5f5f5', label: '浅灰', effect: '轻微区分层次' },
            { value: 'rgba(0,0,0,0.5)', label: '半透明黑', effect: '常用作遮罩' },
        ],
    },
    'font-size': {
        label: '字号',
        desc: '文字大小。',
        why: 'em 这个单位来自铅字排版 —— 一个 em 就是当前字号里字母 M 的宽度。rem 是后来加的「相对根字号」，为了让整站缩放只改一个地方。',
        values: [
            { value: '12px', label: '很小', effect: '辅助信息' },
            { value: '14px', label: '小', effect: '正文下限' },
            { value: '16px', label: '标准', effect: '浏览器默认值' },
            { value: '20px', label: '大', effect: '小标题' },
            { value: '1.5rem', label: '相对根字号', effect: '根字号变它就变' },
            { value: '1.2em', label: '相对父字号', effect: '会层层叠乘，嵌套时要小心' },
        ],
    },
    'border-radius': {
        label: '圆角',
        desc: '把四个角磨圆。',
        why: '2005 年前后圆角只能切图拼，一个圆角框要四张图。border-radius 让整个网页设计的气质变了。',
        values: [
            { value: '0', label: '直角', effect: '' },
            { value: '8px', label: '小圆角', effect: '现代 UI 的常见值' },
            { value: '16px', label: '大圆角', effect: '卡片' },
            { value: '999px', label: '胶囊', effect: '两端变成半圆' },
            { value: '50%', label: '圆', effect: '正方形元素会变成正圆' },
        ],
    },
    overflow: {
        label: '溢出处理',
        desc: '内容装不下的时候怎么办。',
        why: '固定尺寸的盒子里放不下内容，这是排版必然会遇到的冲突。overflow 是这个冲突的裁决书。',
        values: [
            { value: 'visible', label: '溢出可见（默认）', effect: '内容跑出盒子外面也照样画' },
            { value: 'hidden', label: '裁掉', effect: '超出部分看不见，也不能滚' },
            { value: 'auto', label: '需要时滚动', effect: '装不下才出现滚动条' },
            { value: 'scroll', label: '总是滚动', effect: '装得下也留着滚动条位置' },
        ],
    },
    opacity: {
        label: '不透明度',
        desc: '整个元素（连同子元素）的透明程度。',
        why: '和 rgba 的区别是：opacity 作用于整棵子树，做不到「背景半透明但文字实心」。这个坑几乎每个人都踩过一次。',
        values: [
            { value: '1', label: '不透明', effect: '' },
            { value: '0.6', label: '半透', effect: '常用于禁用态' },
            { value: '0', label: '全透明', effect: '看不见但还占位置，也还能点' },
        ],
    },
    transform: {
        label: '变形',
        desc: '位移、旋转、缩放。',
        why: 'transform 走的是合成层，不触发重排 —— 所以做动画要用它而不是改 left/top。这是浏览器渲染管线倒逼出来的一条实践。',
        values: [
            { value: 'none', label: '无', effect: '' },
            { value: 'translateY(-4px)', label: '上移', effect: '常用于 hover 抬起' },
            { value: 'scale(1.05)', label: '放大', effect: '' },
            { value: 'rotate(3deg)', label: '旋转', effect: '' },
            { value: 'translate(-50%, -50%)', label: '居中位移', effect: '配合 absolute + 50% 做居中' },
        ],
    },
    transition: {
        label: '过渡',
        desc: '属性变化时不要瞬变，用一段时间过去。',
        why: '在 transition 出现之前，任何一点动效都要写 JS 定时器逐帧改样式。它把「动画」从脚本还给了样式。',
        values: [
            { value: 'none', label: '无过渡', effect: '瞬间切换' },
            { value: 'all 0.2s ease', label: '全属性 0.2 秒', effect: '省事，但性能上不如指名道姓' },
            { value: 'transform 0.28s cubic-bezier(0.32,0.72,0,1)', label: '弹一下', effect: 'iOS 风格的减速曲线' },
        ],
    },
    'text-align': {
        label: '文字对齐',
        desc: '行内内容在一行里怎么对齐。',
        why: '注意它对齐的是「行内内容」，不是块元素自己。想让一个 div 居中要用 margin:0 auto —— 这是初学者最常混淆的一对。',
        values: [
            { value: 'left', label: '左对齐', effect: '' },
            { value: 'center', label: '居中', effect: '' },
            { value: 'right', label: '右对齐', effect: '' },
            { value: 'justify', label: '两端对齐', effect: '拉伸词距填满整行' },
        ],
    },
    'box-shadow': {
        label: '阴影',
        desc: 'x偏移 y偏移 模糊 扩散 颜色。',
        why: '阴影是「这一层浮在上面」的唯一视觉语言。Material Design 之后它甚至被赋予了层级含义。',
        values: [
            { value: 'none', label: '无', effect: '' },
            { value: '0 1px 2px rgba(0,0,0,0.08)', label: '很轻', effect: '几乎只是一条边' },
            { value: '0 6px 18px rgba(0,0,0,0.12)', label: '浮起', effect: '卡片' },
            { value: 'inset 0 1px 3px rgba(0,0,0,0.15)', label: '内阴影', effect: '凹进去' },
        ],
    },
    'z-index': {
        label: '层叠顺序',
        desc: '谁盖在谁上面。',
        why: 'z-index 只在「层叠上下文」内部比较 —— 所以经常出现 z-index:9999 还是被盖住的情况。这不是玄学，是上下文规则。',
        values: [
            { value: 'auto', label: '默认', effect: '不建立新的层叠上下文' },
            { value: '1', label: '压住兄弟', effect: '' },
            { value: '10', label: '浮层', effect: '' },
        ],
    },
    width: {
        label: '宽度',
        desc: '内容区（或整个盒子，看 box-sizing）的宽度。',
        why: '百分比宽度是相对**父元素**的，而 vw 是相对视口的。这个区别是响应式布局里最常见的分歧点。',
        values: [
            { value: 'auto', label: '自动', effect: '块元素撑满，行内元素裹住内容' },
            { value: '100%', label: '撑满父元素', effect: '' },
            { value: '320px', label: '固定', effect: '' },
            { value: 'fit-content', label: '裹住内容', effect: '' },
            { value: 'min(100%, 640px)', label: '有上限的自适应', effect: '窄屏撑满，宽屏最多 640' },
        ],
    },
    height: {
        label: '高度',
        desc: '同 width，纵向。',
        why: '高度默认是 auto（由内容撑开），因为网页是「往下长」的 —— 这个不对称是从文档时代留下来的。',
        values: [
            { value: 'auto', label: '内容撑开', effect: '' },
            { value: '100%', label: '撑满父元素', effect: '父元素必须有确定高度，否则无效' },
            { value: '100vh', label: '一屏高', effect: '' },
            { value: '48px', label: '固定', effect: '' },
        ],
    },
});

/** 长按一行 CSS 时，从这一行里抠出「属性: 值」。抠不到返回 null。 */
export function parseDeclaration(line) {
    const m = String(line || '').match(/^\s*([a-zA-Z-]+)\s*:\s*([^;]+);?\s*$/);
    if (!m) return null;
    const prop = m[1].toLowerCase();
    return { prop, value: m[2].trim(), known: Boolean(CSS_PROPS[prop]) };
}

export function getPropInfo(prop) {
    return CSS_PROPS[String(prop || '').toLowerCase()] || null;
}

/** 属性名 → 这个属性缺省该配什么单位（用户只填数字时补上） */
const DEFAULT_UNIT = {
    width: 'px', height: 'px', padding: 'px', margin: 'px', gap: 'px',
    top: 'px', right: 'px', bottom: 'px', left: 'px',
    'font-size': 'px', 'border-radius': 'px', 'line-height': '',
    opacity: '', 'z-index': '', 'flex-grow': '', 'flex-shrink': '',
};

/** 纯数字自动补单位；已有单位 / 关键字 / 多值都原样返回 */
export function withUnit(prop, raw) {
    const value = String(raw ?? '').trim();
    if (!value) return value;
    const unit = DEFAULT_UNIT[String(prop || '').toLowerCase()];
    if (unit === undefined || unit === '') return value;
    return value
        .split(/\s+/)
        .map((part) => (/^-?\d+(\.\d+)?$/.test(part) ? part + unit : part))
        .join(' ');
}
