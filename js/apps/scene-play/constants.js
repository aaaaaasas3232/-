/**
 * 情景聊天 · 常量与默认值
 *
 * ★ 这个文件里**一个界面颜色都没有**。
 *   配色全在 `css/apps/scene-play/_theme.css` 的 `--sp-*` token 里,
 *   JS 只认 token 名(见 `theme.js`)。
 *
 * ── 这个 App 是什么 ──────────────────────────────────────────────
 *
 * 本质是**小剧场**,不一定是聊天软件的样子。同一个情景可以是:
 *   - 对话体:一来一回的气泡(气泡从「气泡机」里选)
 *   - 日记体:一段一段的手记
 *   - 博客体:带作者、配图位、互动数的贴文卡
 * 甚至混着来 —— 正则规则决定每一段渲染成什么。
 */

// ============================================================
// 表名
// ============================================================

export const STORE_LIBRARY = 'spLibrary';
export const STORE_SCENES = 'spScenes';
export const STORE_SAVES = 'spSaves';
export const STORE_MESSAGES = 'spMessages';

/** spLibrary 是单例表,永远只有这一条 */
export const LIBRARY_KEY = 'root';

export const SP_STORES = Object.freeze([
    { name: STORE_LIBRARY, keyPath: 'id' },
    {
        name: STORE_SCENES,
        keyPath: 'id',
        indexes: [{ name: 'categoryId', keyPath: 'categoryId' }],
    },
    {
        name: STORE_SAVES,
        keyPath: 'id',
        indexes: [{ name: 'sceneId', keyPath: 'sceneId' }],
    },
    {
        name: STORE_MESSAGES,
        keyPath: 'id',
        // 按存档取消息是最高频的读操作,建索引免得全表扫
        indexes: [{ name: 'saveId', keyPath: 'saveId' }],
    },
]);

// ============================================================
// 超时
// ============================================================

export const TIMEOUT = Object.freeze({
    /** 普通(非流式)请求总时长 */
    normal: 90000,
    /**
     * 流式**空闲**超时:连续这么久没有新数据才算挂了。
     * 不是总时长 —— 写一段五百字的日记跑一分钟很正常,
     * 总时长超时会把正常请求掐死。
     */
    streamIdle: 60000,
});

// ============================================================
// 体裁
// ============================================================

/**
 * 情景的默认体裁。
 *
 * 它只决定**默认**渲染成什么;正则规则可以让任意一段变成别的体裁,
 * 所以「混合」不是一个特殊模式,而是不设默认体裁的自然结果。
 */
export const MODES = Object.freeze([
    { id: 'dialogue', label: '对话体', desc: '一来一回的气泡,气泡从气泡机里选' },
    { id: 'diary', label: '日记体', desc: '一段一段的手记,不分说话人' },
    { id: 'blog', label: '博客体', desc: '带作者和互动数的贴文卡' },
    { id: 'mixed', label: '混合', desc: '交给正则决定每一段长什么样' },
]);

export const MODE_IDS = Object.freeze(MODES.map((m) => m.id));

/** 正则规则能渲染成的卡片类型 —— 和封面设计器里的四种一致 */
export const CARD_KINDS = Object.freeze([
    { id: 'dialogue-left', label: '对话体·左' },
    { id: 'dialogue-right', label: '对话体·右' },
    { id: 'diary', label: '日记体' },
    { id: 'blog', label: '博客体' },
    { id: 'note', label: '便签' },
    { id: 'plain', label: '纯文本' },
]);

export const CARD_KIND_IDS = Object.freeze(CARD_KINDS.map((c) => c.id));

// ============================================================
// 主题(聊天外观)
// ============================================================

export const AVATAR_SHAPES = Object.freeze([
    { value: 'circle', label: '圆' },
    { value: 'squircle', label: '圆角方' },
    { value: 'square', label: '方' },
]);

export const TIME_POSITIONS = Object.freeze([
    { value: 'none', label: '不显示' },
    { value: 'above', label: '气泡上方' },
    { value: 'below', label: '气泡下方' },
    { value: 'inside', label: '气泡里' },
]);

export const NAME_POSITIONS = Object.freeze([
    { value: 'none', label: '不显示' },
    { value: 'above', label: '气泡上方' },
    { value: 'inline', label: '和头像同行' },
]);

export const DENSITIES = Object.freeze([
    { value: 'compact', label: '紧凑' },
    { value: 'cozy', label: '适中' },
    { value: 'loose', label: '宽松' },
]);

export const CARD_BORDERS = Object.freeze([
    { value: 'none', label: '无' },
    { value: 'hairline', label: '细线' },
    { value: 'solid', label: '实线' },
    { value: 'dashed', label: '虚线' },
]);

// ============================================================
// 上下文分段
// ============================================================

/**
 * prompt 的分段清单。
 *
 * `locked` 的段不给用户关 —— 关掉「演出须知」和「输出格式」之后
 * AI 会开始写解说词,正则一条都认不出来,表现是「发出去没反应」。
 *
 * 顺序就是默认注入顺序;用户可以在「上下文」面板里调,存到 `scene.contextOrder`。
 */
export const CONTEXT_SECTIONS = Object.freeze([
    { id: 'system', tag: '演出须知', label: '演出须知', locked: true, desc: '内置' },
    { id: 'world', tag: '世界观', label: '世界观', desc: 'nook' },
    { id: 'user', tag: '我', label: '我是谁', desc: 'nook' },
    { id: 'cast', tag: '出场角色', label: '出场角色', desc: 'nook' },
    { id: 'scene', tag: '情景', label: '这个情景', desc: '本机' },
    { id: 'clips', tag: '文案库', label: '引用的文案', desc: '文案库' },
    { id: 'theater', tag: '前情', label: '接住的小剧场', desc: '四叶草' },
    { id: 'notes', tag: '设定', label: '手动设定', desc: '本机' },
    { id: 'recent', tag: '近期内容', label: '近期内容', desc: '滑动窗口' },
    { id: 'format', tag: '输出格式', label: '输出格式', locked: true, desc: '内置 + 正则' },
]);

export function createDefaultContextConfig() {
    const out = {};
    for (const s of CONTEXT_SECTIONS) out[s.id] = true;
    return out;
}

// ============================================================
// 侧边栏
// ============================================================

/**
 * 左侧抽屉的分页。
 *
 * 抽屉本身是**大圆角**的一整块,不是竖线分隔 —— 用户要求的可爱风来自这里。
 */
export const DRAWERS = Object.freeze([
    { id: 'scenes', label: '情景', icon: 'book' },
    { id: 'saves', label: '存档', icon: 'save' },
    { id: 'theme', label: '外观', icon: 'palette' },
    { id: 'regex', label: '正则', icon: 'regex' },
    { id: 'context', label: '上下文', icon: 'sparkle' },
    { id: 'clips', label: '文案库', icon: 'clip' },
]);

// ============================================================
// 默认设置
// ============================================================

export function createDefaultSettings() {
    return {
        theme: 'jelly',
        customThemeColors: {},
        customThemes: [],
        activeCustomThemeId: '',

        /**
         * 聊天区顶上那条「情景常驻条」。
         *
         * ★ 两个开关是**全局**的,不跟着情景走 —— 它是一个阅读习惯
         *   (「我想不想一直看到设定」),不是某个情景的属性。
         *   做成跟着情景走的话,用户每换一个情景就要重新收一次。
         */
        /** 展开(看全文)还是收起(只留两行) */
        sceneBannerOpen: false,
        /** 整条藏起来。嫌吵的人可以在外观面板里关掉 */
        sceneBannerHidden: false,

        /** 一次带多少条历史进上下文 */
        historyLimit: 24,
        /** 流式生成 */
        stream: true,
        temperature: 0.9,
        /** 一次让 AI 写多长 */
        length: 'medium',
    };
}

export const LENGTHS = Object.freeze([
    { value: 'short', label: '短', words: '80~150' },
    { value: 'medium', label: '中', words: '200~350' },
    { value: 'long', label: '长', words: '450~700' },
]);

/** 单条消息上限 —— 防止 AI 一口气写两万字把存档撑爆 */
export const MESSAGE_MAX_CHARS = 8000;

/** 重 roll 时用户可以提的修改意见上限 */
export const REROLL_NOTE_MAX = 300;
