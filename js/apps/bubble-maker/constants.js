/**
 * 气泡机 · 常量与默认值
 *
 * ★ 这个文件里**一个颜色都没有**。
 *   界面配色全在 `css/apps/bubble-maker/_theme.css` 的 `--bb-*` token 里,
 *   JS 只认 token 名(见 `theme.js`)。
 *
 *   唯一的例外是「气泡预设自带的色值」—— 那是**用户内容**不是界面配色,
 *   它必须是具体的值(用户导出的 CSS 里不能出现本 App 的变量名,
 *   否则粘到别处就成了没有定义的变量)。这类值收在 `services/presets.js`。
 */

// ============================================================
// 表名
// ============================================================

export const STORE_LIBRARY = 'bbLibrary';
export const STORE_BUBBLES = 'bbBubbles';

/** bbLibrary 是单例表,永远只有这一条 */
export const LIBRARY_KEY = 'root';

export const BB_STORES = Object.freeze([
    { name: STORE_LIBRARY, keyPath: 'id' },
    { name: STORE_BUBBLES, keyPath: 'id' },
]);

// ============================================================
// 工作区
// ============================================================

/**
 * 顶部三档。
 *
 * ★ 参考软件把「用户气泡」和「AI 气泡」做成两组完全独立的面板,一共 8 个折叠区,
 *   改一个圆角要在两边各改一次。这里改成**一次只编辑一个气泡**,
 *   用不用来当用户气泡 / AI 气泡是「应用」时才决定的事(在情景聊天里选)。
 */
export const TABS = Object.freeze([
    { id: 'design', label: '设计', icon: 'bubble' },
    { id: 'shape', label: '形状', icon: 'shape' },
    { id: 'library', label: '气泡库', icon: 'layers' },
]);

/** 设计页的折叠区 */
export const DESIGN_SECTIONS = Object.freeze([
    { id: 'fill', label: '底色', icon: 'palette' },
    { id: 'text', label: '文字', icon: 'text' },
    { id: 'box', label: '形状与间距', icon: 'box' },
    { id: 'frame', label: '描边与阴影', icon: 'frame' },
    { id: 'tail', label: '尾巴', icon: 'tail' },
]);

/** 预览底纹 —— 只是给气泡找一个参照,不进任何存档 */
export const PREVIEW_BACKDROPS = Object.freeze([
    { id: 'paper', label: '米纸' },
    { id: 'sky', label: '晴空' },
    { id: 'dusk', label: '暮色' },
    { id: 'grid', label: '棋盘' },
]);

export const BORDER_STYLES = Object.freeze([
    { value: 'solid', label: '实线' },
    { value: 'dashed', label: '虚线' },
    { value: 'dotted', label: '点线' },
    { value: 'double', label: '双线' },
]);

export const TAIL_ANCHORS = Object.freeze([
    { value: 'bottom', label: '下' },
    { value: 'top', label: '上' },
    { value: 'left', label: '左' },
    { value: 'right', label: '右' },
]);

export const TEXT_ALIGNS = Object.freeze([
    { value: 'left', label: '左' },
    { value: 'center', label: '中' },
    { value: 'right', label: '右' },
]);

/** 圆角联动模式 */
export const RADIUS_MODES = Object.freeze([
    { value: 'all', label: '四角一起' },
    { value: 'chat', label: '聊天角' },
    { value: 'free', label: '逐角' },
]);

// ============================================================
// SVG 工作台
// ============================================================

/** 一条 SVG 库记录的上限,防止用户粘一整张插画进来把库撑爆 */
export const SVG_MAX_CHARS = 20000;

/** 预览示例文字 —— 长短各一条,能看出换行和最大宽度的效果 */
export const SAMPLE_TEXTS = Object.freeze([
    '今天的云走得很慢。',
    '我把窗户开了一条缝,风就从那儿钻进来,把桌上的纸吹得哗啦响。',
]);

// ============================================================
// 默认设置
// ============================================================

export function createDefaultSettings() {
    return {
        theme: 'porcelain',
        customThemeColors: {},
        customThemes: [],
        activeCustomThemeId: '',

        /** 预览底纹 */
        backdrop: 'paper',
        /** 预览里同时显示左右两侧(看对话时的整体感) */
        pairPreview: true,
        /** 圆角联动 */
        radiusMode: 'chat',
    };
}
