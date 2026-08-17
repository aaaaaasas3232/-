/**
 * 手书 · 常量与默认值
 *
 * ★ 这个文件里**一个颜色都没有**。
 *   配色全在 `css/apps/handwrite/index.css` 的 `--hs-*` token 里,
 *   JS 只认 token 名(见 `theme.js`)。
 *
 * 「手书」是一个**文字效果模拟视频**编辑器:不编码真视频,
 * 而是用时间轴驱动一段确定性的 DOM/CSS 文字动画。
 * 所以这里的常量分四类:表名 / 轨道 / 剪辑类型 / 上下文分段。
 */

// ============================================================
// 表名 / 存储键
// ============================================================

export const STORE_PROJECTS = 'hsProjects';
export const STORE_LIBRARY = 'hsLibrary';
export const STORE_ASSETS = 'hsAssets';

/** hsLibrary 是单例表,永远只有这一条 */
export const LIBRARY_KEY = 'root';

export const HS_STORES = Object.freeze([
    { name: STORE_PROJECTS, keyPath: 'id' },
    { name: STORE_LIBRARY, keyPath: 'id' },
    { name: STORE_ASSETS, keyPath: 'id' },
]);

// ============================================================
// 超时
// ============================================================

export const TIMEOUT = Object.freeze({
    /** 普通(非流式)请求总时长 */
    normal: 90000,
    /**
     * 流式**空闲**超时:连续这么久没有新数据才算挂了。
     * 不是总时长 —— 生成一份两百行的手书脚本跑一分钟很正常。
     */
    streamIdle: 60000,
});

// ============================================================
// 轨道
// ============================================================

/**
 * 三条轨道。
 *
 * ★ `text` 轨是**有状态**的:它上面的剪辑是对同一个文字缓冲区的顺序操作
 *   (打字 / 删除 / 替换 / 清空),所以顺序和起始时间共同决定了任意时刻的画面。
 *   `effect` 和 `bg` 轨是**无状态**的:某一时刻落在剪辑区间里就生效,出了就没了。
 *   这个区别是整个引擎的地基,加新轨道前先想清楚它属于哪一类。
 */
export const TRACK_KINDS = Object.freeze([
    { id: 'text', label: '文字轨', desc: '打字 / 删除 / 停顿 —— 决定屏幕上此刻有哪些字', stateful: true },
    { id: 'effect', label: '效果轨', desc: '抖动 / 叠加 / 发光 —— 落在区间内就生效', stateful: false },
    { id: 'bg', label: '背景轨', desc: '底色与氛围,只影响舞台背景', stateful: false },
]);

/** 新建企划时的默认轨道(id 固定,脚本解析器直接往这三条上落) */
export const DEFAULT_TRACK_IDS = Object.freeze({
    text: 'trk-text',
    effect: 'trk-effect',
    bg: 'trk-bg',
});

// ============================================================
// 剪辑类型
// ============================================================

/**
 * 文字轨上的操作类型。
 *
 * `label` 会直接出现在时间轴的剪辑块上,所以要短。
 */
export const CLIP_TYPES = Object.freeze([
    { id: 'type', label: '打字', track: 'text', desc: '逐字打出这段文字' },
    { id: 'delete', label: '删除', track: 'text', desc: '从末尾逐字退格' },
    { id: 'hold', label: '停顿', track: 'text', desc: '画面不变,单纯等待' },
    { id: 'replace', label: '替换', track: 'text', desc: '先删掉旧的,再打出新的' },
    { id: 'clear', label: '清空', track: 'text', desc: '把当前所有字逐字清掉' },
    { id: 'effect', label: '效果', track: 'effect', desc: '在这段时间里给文字挂一个预设' },
    { id: 'bg', label: '背景', track: 'bg', desc: '在这段时间里换一种舞台底' },
]);

export const CLIP_TYPE_IDS = Object.freeze(CLIP_TYPES.map((c) => c.id));

/** 各类型的默认时长(ms)。打字类会按字数再算一遍,这里只是兜底 */
export const CLIP_DEFAULT_MS = Object.freeze({
    type: 1200,
    delete: 600,
    hold: 800,
    replace: 1400,
    clear: 600,
    effect: 1500,
    bg: 3000,
});

/** 每个字默认占多少毫秒 —— 脚本没写时长时用它推算 */
export const CHAR_MS = Object.freeze({
    type: 130,
    delete: 70,
});

// ============================================================
// 舞台
// ============================================================

/** 文字在舞台上的位置(九宫格里常用的三档) */
export const STAGE_POSITIONS = Object.freeze([
    { id: 'center', label: '居中' },
    { id: 'top', label: '偏上' },
    { id: 'bottom', label: '偏下' },
]);

export const TEXT_ALIGNS = Object.freeze([
    { id: 'center', label: '居中' },
    { id: 'left', label: '左对齐' },
    { id: 'right', label: '右对齐' },
]);

/** 舞台底(纯 CSS,不用任何图片资源) */
export const STAGE_BACKDROPS = Object.freeze([
    { id: 'ink', label: '墨' },
    { id: 'dawn', label: '晨' },
    { id: 'dusk', label: '暮' },
    { id: 'deep', label: '渊' },
    { id: 'paper', label: '纸' },
    { id: 'neon', label: '霓' },
]);

/** 舞台画幅 —— 只影响预览框的比例,不影响时间轴 */
export const ASPECTS = Object.freeze([
    { id: '16:9', label: '横屏 16:9', ratio: 16 / 9 },
    { id: '4:3', label: '横屏 4:3', ratio: 4 / 3 },
    { id: '1:1', label: '方形 1:1', ratio: 1 },
    { id: '9:16', label: '竖屏 9:16', ratio: 9 / 16 },
]);

// ============================================================
// 时间轴
// ============================================================

/** 缩放档位:1 秒画多少像素 */
export const ZOOM_LEVELS = Object.freeze([16, 24, 36, 52, 76, 110, 160]);
export const DEFAULT_ZOOM_INDEX = 2;

/** 吸附栅格(ms)。关掉吸附时按 10ms 走 */
export const SNAP_MS = 100;
export const FINE_MS = 10;

/** 剪辑最短时长 —— 再短就点不中了 */
export const MIN_CLIP_MS = 120;

/** 单个企划的最长时长(10 分钟)。超过就不是「手书」是「电影」了 */
export const MAX_PROJECT_MS = 600000;

/** 前后跳帧的步长 */
export const FRAME_MS = 100;

/** 撤销栈深度(需求要求至少 30 步) */
export const UNDO_LIMIT = 40;

// ============================================================
// 上下文分段
// ============================================================

/**
 * prompt 的分段清单。
 *
 * `locked` 的段不给用户关 —— 关掉「手书须知」和「输出格式」之后模型会开始写散文,
 * 脚本解析器一条指令都认不出来,表现是「点了生成,什么都没变」。
 *
 * 顺序就是默认注入顺序;用户可以在提示词面板里调,存到 `project.contextOrder`。
 */
export const CONTEXT_SECTIONS = Object.freeze([
    { id: 'system', tag: '手书须知', label: '手书须知', locked: true, desc: '内置' },
    { id: 'world', tag: '世界观', label: '世界观', desc: 'nook' },
    { id: 'user', tag: '作者', label: '作者身份', desc: 'nook' },
    { id: 'ai', tag: '搭档', label: '搭档人设', desc: 'nook' },
    { id: 'brief', tag: '企划', label: '本次企划', desc: '本机' },
    { id: 'stage', tag: '舞台', label: '舞台与节奏', desc: '本机' },
    { id: 'effects', tag: '可用效果', label: '可用效果预设', desc: '本机' },
    { id: 'existing', tag: '现有脚本', label: '现有脚本', desc: '本机' },
    { id: 'custom', tag: '自定义', label: '自定义提示词', desc: '本机' },
    { id: 'grammar', tag: '脚本语法', label: '脚本语法', locked: true, desc: '内置' },
    { id: 'format', tag: '输出格式', label: '输出格式', locked: true, desc: '内置' },
]);

export function createDefaultContextConfig() {
    const out = {};
    for (const s of CONTEXT_SECTIONS) out[s.id] = true;
    return out;
}

// ============================================================
// 默认设置
// ============================================================

export function createDefaultSettings() {
    return {
        theme: 'ink',

        /** 时间轴 */
        snap: true,
        zoomIndex: DEFAULT_ZOOM_INDEX,

        /** 播放 */
        loop: false,
        /** 播放速度倍率 */
        rate: 1,

        /** 编辑 */
        autosave: true,
        /** 生成时用流式 */
        stream: true,
        temperature: 0.9,

        /** 首次打开时给过示例了没(给过就不再自动弹引导) */
        seenGuide: false,
    };
}

/** 新企划的默认舞台参数 */
export function createDefaultStage() {
    return {
        backdrop: 'ink',
        aspect: '16:9',
        position: 'center',
        align: 'center',
        fontSize: 34,
        fontWeight: 600,
        letterSpacing: 2,
        lineHeight: 1.5,
        /** 空 = 跟随主题的 --hs-stage-ink */
        color: '',
        /** 打字光标 */
        caret: true,
    };
}

// ============================================================
// UI
// ============================================================

/** 底部 tab 栏 */
export const TABS = Object.freeze([
    { id: 'works', label: '作品', icon: 'grid' },
    { id: 'effects', label: '效果', icon: 'sparkle' },
    { id: 'mine', label: '我的', icon: 'user' },
]);

/** 编辑器底部抽屉 */
export const EDITOR_PANELS = Object.freeze([
    { id: 'clip', label: '属性', icon: 'sliders' },
    { id: 'effects', label: '效果', icon: 'sparkle' },
    { id: 'script', label: '脚本', icon: 'code' },
    { id: 'prompt', label: '提示词', icon: 'wand' },
]);

/** 作品简介最长字数 */
export const DESC_MAX = 300;
/** 企划标题最长字数 */
export const TITLE_MAX = 40;
/** 脚本最长字数 —— 再长解析出来的剪辑数会把时间轴拖垮 */
export const SCRIPT_MAX = 8000;
/** 单个企划最多多少剪辑(超过就拒绝导入,给明确提示而不是卡死) */
export const MAX_CLIPS = 600;
